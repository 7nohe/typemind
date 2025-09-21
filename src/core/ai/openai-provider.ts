import type { CompletionOptions } from '../../types/completion.d';
import type { AIConfig } from './prompt-manager';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionsResponse {
  choices: Array<{
    message: ChatMessage;
  }>;
}

export class OpenAIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = 'gpt-4o-mini'
  ) { }

  async prompt(text: string, aiConfig: AIConfig, options?: CompletionOptions): Promise<string> {
    if (!this.apiKey) throw new Error('OpenAI API key is missing');
    const abortGuards = createAbortGuards(options);
    try {
      const requestBody = buildChatBody(text, aiConfig, this.model, options);
      const response = await sendChatRequest(requestBody, this.apiKey, abortGuards.controller);
      const content = extractCompletionText(response);
      if (!content) throw new Error('OpenAI: empty response');
      return content.replace(/\s+$/u, '');
    } catch (error) {
      throw mapAbortError(error, abortGuards);
    } finally {
      abortGuards.cleanup();
    }
  }
}

interface JsonSchemaResponseFormat {
  type: 'json_schema';
  json_schema: {
    name: string;
    schema: unknown;
    strict?: boolean;
  };
}

type ChatRequestBody = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  response_format?: JsonSchemaResponseFormat;
};

function buildChatBody(
  text: string,
  aiConfig: AIConfig,
  model: string,
  options?: CompletionOptions
): ChatRequestBody {
  const messages: ChatMessage[] = [];
  if (aiConfig.systemPrompt) {
    messages.push({ role: 'system', content: aiConfig.systemPrompt });
  }
  messages.push({ role: 'user', content: text });

  const body: ChatRequestBody = {
    model,
    messages,
    temperature: aiConfig.temperature,
    max_tokens: aiConfig.maxTokens,
  };

  if (options?.responseConstraint) {
    const responseFormat: JsonSchemaResponseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'CompletionSuggestions',
        schema: options.responseConstraint,
        strict: true,
      },
    };
    body.response_format = responseFormat;
  }

  return body;
}

async function sendChatRequest(
  body: ChatRequestBody,
  apiKey: string,
  controller: AbortController
): Promise<ChatCompletionsResponse> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI error: ${res.status} ${msg}`);
  }
  return (await res.json()) as ChatCompletionsResponse;
}

function extractCompletionText(response: ChatCompletionsResponse): string | undefined {
  return response.choices?.[0]?.message?.content;
}

interface AbortGuards {
  controller: AbortController;
  isTimeoutAbort: () => boolean;
  isExternalAbort: () => boolean;
  cleanup: () => void;
}

function createAbortGuards(options?: CompletionOptions): AbortGuards {
  const controller = new AbortController();
  const timeoutMs = options?.responseTimeout ?? 10000;
  let abortedByTimeout = false;
  let abortedByExternal = false;

  const timeoutId = setTimeout(() => {
    abortedByTimeout = true;
    controller.abort('timeout');
  }, timeoutMs);

  const cleanupExternal = bindExternalAbort(controller, options?.abortSignal, () => {
    abortedByExternal = true;
  });

  return {
    controller,
    isTimeoutAbort: (): boolean => abortedByTimeout,
    isExternalAbort: (): boolean =>
      abortedByExternal || options?.abortSignal?.aborted === true,
    cleanup: (): void => {
      clearTimeout(timeoutId);
      cleanupExternal();
    },
  };
}

function mapAbortError(error: unknown, guards: AbortGuards): Error {
  const err = normalizeError(error);
  if (isAbortError(err)) {
    if (guards.isTimeoutAbort()) return new Error('AI timeout');
    if (guards.isExternalAbort()) return new Error('AI aborted');
    return new Error('AI aborted');
  }
  return err;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error ?? 'Unknown error'));
}

function isAbortError(error: Error): boolean {
  return error.name === 'AbortError' || /aborted|AbortError/i.test(error.message);
}

function bindExternalAbort(
  controller: AbortController,
  externalSignal: AbortSignal | undefined,
  onAbort: () => void
): () => void {
  if (!externalSignal) {
    return () => { };
  }
  if (externalSignal.aborted) {
    onAbort();
    controller.abort(externalSignal.reason ?? 'external-abort');
    return () => { };
  }
  const handleAbort = (): void => {
    onAbort();
    controller.abort(externalSignal.reason ?? 'external-abort');
  };
  externalSignal.addEventListener('abort', handleAbort, { once: true });
  return () => {
    externalSignal.removeEventListener('abort', handleAbort);
  };
}
