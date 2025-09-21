import type {
  AppMessage,
  CompletionRequestPayload,
  CompletionResponsePayload,
  WarmupRequestPayload,
} from '../types/completion.d';
import { CompletionEngine } from '../core/completion/completion-engine';
import { PreferencesStore, type Preferences } from '../core/storage/preferences';
import { OpenAIProvider } from '../core/ai/openai-provider';
import { ChromeAIManager, type AIConfig } from '../core/ai/prompt-manager';
import { SYSTEM_PROMPT } from '../core/prompt/prompts';
import { logger } from '../utils/logger';

const prefsStore = new PreferencesStore();

interface ProviderInfo {
  readonly preference: 'chrome-ai' | 'openai';
  readonly resolved: 'chrome-ai' | 'openai' | 'fallback';
}

type CompletionStatus = Exclude<CompletionResponsePayload['status'], undefined>;

interface EngineCacheEntry {
  readonly key: string;
  readonly engine: CompletionEngine;
  readonly providerInfo: ProviderInfo;
}

let engineCache: EngineCacheEntry | null = null;

async function getEngine(): Promise<{ engine: CompletionEngine; providerInfo: ProviderInfo }> {
  const prefs = await prefsStore.get();
  const cacheKey = buildEngineCacheKey(prefs);
  if (engineCache && engineCache.key === cacheKey) {
    return { engine: engineCache.engine, providerInfo: engineCache.providerInfo };
  }

  const outputLanguage = prefs.completionLanguage === 'auto' ? undefined : prefs.completionLanguage;
  const aiConfig = {
    temperature: prefs.temperature,
    topK: prefs.topK,
    maxTokens: prefs.maxTokens,
    systemPrompt: SYSTEM_PROMPT,
    ...(outputLanguage ? { outputLanguage } : {}),
  } satisfies AIConfig;

  // Decide provider based on explicit preference
  let provider: ChromeAIManager | OpenAIProvider;
  let resolved: ProviderInfo['resolved'];
  if (prefs.provider === 'openai') {
    provider = new OpenAIProvider(prefs.openaiApiKey ?? '', prefs.openaiModel ?? 'gpt-4o-mini');
    resolved = 'openai';
  } else {
    provider = new ChromeAIManager();
    resolved = 'chrome-ai';
  }

  const engine = new CompletionEngine(
    {
      aiConfig,
      maxSuggestions: 3,
      responseTimeout: 10000,
      includePromptDebugContext: prefs.includePromptDebugContext,
    },
    provider
  );

  engineCache = {
    key: cacheKey,
    engine,
    providerInfo: { preference: prefs.provider, resolved },
  };

  return { engine, providerInfo: engineCache.providerInfo };
}

function buildEngineCacheKey(prefs: Preferences): string {
  const parts = [
    prefs.provider,
    prefs.temperature.toString(10),
    prefs.topK.toString(10),
    prefs.maxTokens.toString(10),
    prefs.includePromptDebugContext ? '1' : '0',
    prefs.completionLanguage,
  ];
  if (prefs.provider === 'openai') {
    parts.push(prefs.openaiModel ?? 'gpt-4o-mini');
    parts.push(prefs.openaiApiKey ?? '');
  }
  return parts.join('|');
}

function classifyProviderError(message: string, providerInfo?: ProviderInfo): {
  status: CompletionStatus;
  error?: string;
  logLevel: 'debug' | 'warn';
} {
  if (providerInfo?.resolved === 'openai') {
    if (/api key is missing/i.test(message)) {
      return {
        status: 'UNAVAILABLE',
        error: 'Add your OpenAI API key in Settings to enable the OpenAI provider.',
        logLevel: 'warn',
      };
    }
    return {
      status: 'UNAVAILABLE',
      error: message,
      logLevel: 'warn',
    };
  }
  if (/needs\s+download/i.test(message)) {
    return {
      status: 'NEEDS_DOWNLOAD',
      error: 'On-device model not installed. Open settings to download.',
      logLevel: 'warn',
    };
  }
  if (/downloading/i.test(message)) {
    return {
      status: 'DOWNLOADING',
      error: 'On-device model is downloading. Please retry shortly.',
      logLevel: 'debug',
    };
  }
  if (/timeout/i.test(message)) {
    return { status: 'TIMEOUT', logLevel: 'debug' };
  }
  return {
    status: 'UNAVAILABLE',
    error: 'On-device AI is unavailable on this device.',
    logLevel: 'warn',
  };
}

async function safeGetProviderInfo(): Promise<ProviderInfo | undefined> {
  try {
    return (await getEngine()).providerInfo;
  } catch {
    return undefined;
  }
}

interface WarmupResponsePayload {
  readonly ok: boolean;
  readonly provider?: ProviderInfo;
}

async function handleCompletionRequest(
  req: CompletionRequestPayload,
  sendResponse: (response: CompletionResponsePayload) => void
): Promise<void> {
  let providerInfo: ProviderInfo | undefined;
  try {
    const { engine, providerInfo: info } = await getEngine();
    providerInfo = info;
    const suggestions = await engine.generateCompletions(req);
    sendResponse({ suggestions, provider: info } satisfies CompletionResponsePayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { status, error, logLevel } = classifyProviderError(message, providerInfo);
    const logContext = providerInfo?.resolved === 'openai' ? 'OpenAI provider error' : logLevel === 'debug' ? 'AI timeout' : 'AI unavailable';
    logger[logLevel](logContext, err);
    if (!providerInfo) providerInfo = await safeGetProviderInfo();
    const payload: CompletionResponsePayload = {
      suggestions: [],
      status,
      ...(error ? { error } : {}),
      ...(providerInfo ? { provider: providerInfo } : {}),
    };
    sendResponse(payload);
  }
}

async function handleWarmupRequest(
  payload: WarmupRequestPayload,
  sendResponse: (response: WarmupResponsePayload) => void
): Promise<void> {
  try {
    if (payload.phase === 'availability') {
      const providerInfo = await safeGetProviderInfo();
      sendResponse({ ok: providerInfo !== undefined, ...(providerInfo ? { provider: providerInfo } : {}) });
      return;
    }

    const { providerInfo } = await getEngine();
    sendResponse({ ok: true, provider: providerInfo });
  } catch (err) {
    logger.debug('Warmup request failed', err);
    sendResponse({ ok: false });
  }
}

chrome.runtime.onMessage.addListener((message: AppMessage, _sender, sendResponse): boolean => {
  void (async (): Promise<void> => {
    try {
      if (message.type === 'COMPLETION_REQUEST' || message.type === 'COMPLETION_PREFETCH') {
        const req = message.payload as CompletionRequestPayload;
        await handleCompletionRequest(req, sendResponse);
        return;
      }
      if (message.type === 'AI_WARMUP_REQUEST') {
        const payload = message.payload as WarmupRequestPayload;
        await handleWarmupRequest(payload, sendResponse);
        return;
      }
    } catch (err) {
      logger.error('Error processing message', err);
      sendResponse({ suggestions: [] } satisfies CompletionResponsePayload);
    }
  })();
  return true; // keep message channel open for async
});

// No fallback suggestions: we return an error message to the content script instead.
