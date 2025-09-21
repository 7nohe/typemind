import type {
  CompletionOptions,
  CompletionRequest,
  CompletionSuggestion,
} from '../../types/completion.d';
import { ChromeAIManager, type AIConfig } from '../ai/prompt-manager';
import { CompletionCache, RateLimitedExecutor } from '../storage/cache-manager';
import { SuggestionRanker } from './suggestion-ranker';
import { analyzeContext } from '../prompt/context-analyzer';
import { PromptSelector, detectDomainType, type CompletionContext } from '../prompt/selector';
import { PromptOptimizer } from '../prompt/optimizer';
import { deriveSessionScope } from './session-scope';

export interface EngineConfig {
  readonly maxSuggestions?: number;
  readonly responseTimeout?: number;
  readonly aiConfig: AIConfig;
  readonly includePromptDebugContext?: boolean;
}

export class CompletionEngine {
  private readonly cache = new CompletionCache();
  private readonly executor = new RateLimitedExecutor();
  private readonly ranker = new SuggestionRanker();
  private readonly ai: {
    prompt: (text: string, aiConfig: AIConfig, options?: CompletionOptions) => Promise<string>;
  };
  private readonly maxSuggestions: number;
  private readonly responseTimeout: number;
  private readonly selector = new PromptSelector();
  private readonly optimizer = new PromptOptimizer();
  private currentAbortController: AbortController | null = null;
  private readonly includePromptDebugContext: boolean;

  constructor(
    cfg: EngineConfig,
    provider?: {
      prompt: (text: string, aiConfig: AIConfig, options?: CompletionOptions) => Promise<string>;
    }
  ) {
    this.maxSuggestions = cfg.maxSuggestions ?? 3;
    this.responseTimeout = cfg.responseTimeout ?? 10000;
    this.aiConfig = cfg.aiConfig;
    this.ai = provider ?? new ChromeAIManager();
    this.includePromptDebugContext = cfg.includePromptDebugContext ?? false;
  }

  private readonly aiConfig: AIConfig;

  async generateCompletions(
    request: CompletionRequest,
    options: CompletionOptions = {}
  ): Promise<CompletionSuggestion[]> {
    this.cancelInFlight('engine:new-request');

    const cached = this.cache.get(this.keyOf(request));
    if (cached) {
      return cached;
    }

    const promptText = this.buildPrompt(request);
    const sessionScope = this.buildSessionScope(request);
    const responseConstraint = this.buildResponseSchema();
    const rawResult = await this.executePrompt(
      promptText,
      sessionScope,
      responseConstraint,
      options
    );
    if (rawResult === null) return [];

    const ranked = this.rankSuggestions(rawResult);
    this.cache.set(this.keyOf(request), ranked);
    return ranked;
  }

  private buildSessionScope(request: CompletionRequest): string {
    return deriveSessionScope({
      ...(request.contextMetadata.url !== undefined
        ? { url: request.contextMetadata.url }
        : {}),
      ...(request.contextMetadata.pageTitle !== undefined
        ? { pageTitle: request.contextMetadata.pageTitle }
        : {}),
    });
  }

  private async executePrompt(
    promptText: string,
    sessionScope: string,
    responseConstraint: ReturnType<CompletionEngine['buildResponseSchema']>,
    options: CompletionOptions
  ): Promise<string | null> {
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    const startedAt = Date.now();
    const requestId = this.generateRequestId();
    this.logPromptStart(requestId);

    try {
      const result = await this.executor.execute(() =>
        this.ai.prompt(promptText, this.aiConfig, {
          responseTimeout: options.responseTimeout ?? this.responseTimeout,
          sessionScope,
          responseConstraint,
          omitResponseConstraintInput: false,
          abortSignal: abortController.signal,
        })
      );
      this.logPromptSuccess(startedAt, requestId, result);
      return result;
    } catch (error) {
      if (this.isAbortError(error)) {
        this.logPromptAbort(startedAt);
        return null;
      }
      throw error;
    } finally {
      if (this.currentAbortController === abortController) {
        this.currentAbortController = null;
      }
    }
  }

  private rankSuggestions(rawResult: string): CompletionSuggestion[] {
    const parsedTexts = this.parseSuggestions(rawResult);
    if (parsedTexts === null) {
      return this.ranker.rank([rawResult]).slice(0, this.maxSuggestions);
    }
    if (parsedTexts.length === 0) return [];
    return this.ranker.rank(parsedTexts.slice(0, this.maxSuggestions));
  }

  private generateRequestId(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  private logPromptStart(requestId: string): void {
    console.debug('[CompletionEngine] Sending prompt to AI. Request ID:', requestId);
  }

  private logPromptSuccess(startedAt: number, requestId: string, rawResult: string): void {
    const seconds = (Date.now() - startedAt) / 1000;
    console.debug(
      '[CompletionEngine] Received response from AI. Duration:',
      seconds,
      's. Request ID:',
      requestId,
      'Raw result:',
      rawResult
    );
  }

  private logPromptAbort(startedAt: number): void {
    console.debug('[CompletionEngine] Prompt aborted before completion', {
      durationMs: Date.now() - startedAt,
    });
  }

  private keyOf(req: CompletionRequest): string {
    return `${req.contextMetadata.domain ?? 'general'}::${req.contextMetadata.language ?? 'en'}::${req.inputText
      }::${req.cursorPosition}`;
  }

  private buildPrompt(req: CompletionRequest): string {
    const before = req.inputText.slice(0, req.cursorPosition);
    const after = req.inputText.slice(req.cursorPosition);
    const currentParagraph = this.extractParagraph(req.inputText, req.cursorPosition);
    const currentSentence = this.extractSentence(req.inputText, req.cursorPosition);
    const domainType = detectDomainType(req.contextMetadata.url ?? '');
    const ctx = this.createCompletionContext(
      req,
      before,
      after,
      currentParagraph,
      currentSentence,
      domainType
    );
    const prompt = this.composePrompt(this.selector.selectPrompt(ctx), ctx, before, after);

    // Best-effort latency guard
    return this.optimizer.optimizeForLatency(prompt, this.aiConfig.maxTokens ?? 256);
  }

  private createCompletionContext(
    req: CompletionRequest,
    before: string,
    after: string,
    currentParagraph: string,
    currentSentence: string,
    domainType: ReturnType<typeof detectDomainType>
  ): CompletionContext {
    const contextAnalysis = analyzeContext({
      request: req,
      domainType,
      textBefore: before,
      textAfter: after,
      currentParagraph,
    });

    return {
      textBefore: before,
      textAfter: after,
      currentSentence,
      currentParagraph,
      domainType,
      pageTitle: req.contextMetadata.pageTitle ?? '',
      formContext: contextAnalysis.formContext,
      writingStyle: contextAnalysis.writingStyle,
      preferredLength: contextAnalysis.preferredLength,
      recentTopics: contextAnalysis.recentTopics,
      contextWindow: contextAnalysis.contextWindow,
      pageSummary: contextAnalysis.pageSummary,
      detectedIntent: contextAnalysis.detectedIntent,
    };
  }

  private composePrompt(
    assembled: string,
    ctx: CompletionContext,
    before: string,
    after: string
  ): string {
    const maxLen = 50;
    const instructions = [
      'Respond with JSON that satisfies the schema.',
      `suggestions[].text must be the minimal insertion (<=${maxLen} chars) keeping Before+INSERTION+After natural.`,
      'Provide up to 3 suggestions total; omit extras even if multiple variants are possible.',
      'Avoid duplicating existing text and strip trailing whitespace. Return [] if nothing fits.',
    ].join(' ');

    const sections: string[] = [];
    if (this.includePromptDebugContext) {
      if (assembled.trim().length > 0) {
        sections.push(assembled);
      }
      sections.push(`Context window: ${ctx.contextWindow || '[CURSOR]'}`);
    }
    sections.push(instructions, `Before: ${before}`, `After: ${after}`);
    return sections.join('\n\n');
  }

  private extractSentence(text: string, caret: number): string {
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const start = before.lastIndexOf('.', Math.max(0, before.length - 2));
    const endRel = after.indexOf('.') >= 0 ? after.indexOf('.') + 1 : 0;
    const startIdx = start >= 0 ? start + 1 : Math.max(0, before.lastIndexOf('\n'));
    const endIdx =
      caret + (endRel > 0 ? endRel : after.indexOf('\n') >= 0 ? after.indexOf('\n') : 0);
    return text.slice(startIdx, endIdx > startIdx ? endIdx : caret).trim();
  }

  private extractParagraph(text: string, caret: number): string {
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const startIdx = Math.max(0, before.lastIndexOf('\n\n'));
    const endRel = after.indexOf('\n\n');
    const endIdx = endRel >= 0 ? caret + endRel : text.length;
    return text.slice(startIdx, endIdx).trim();
  }

  private buildResponseSchema(): unknown {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['suggestions'],
      properties: {
        suggestions: {
          type: 'array',
          minItems: 0,
          maxItems: this.maxSuggestions,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['text'],
            properties: {
              text: {
                type: 'string',
                description:
                  'Minimal insertion string to place at the caret. Exclude any surrounding context already present.',
              },
            },
          },
        },
      },
    };
  }

  private parseSuggestions(raw: string): string[] | null {
    try {
      const data = JSON.parse(raw) as {
        suggestions?: Array<{ text?: unknown }>;
      };
      if (!Array.isArray(data.suggestions)) return null;
      return data.suggestions
        .map((item) => (typeof item?.text === 'string' ? item.text : ''))
        .filter((text) => text.length > 0);
    } catch {
      return null;
    }
  }

  private cancelInFlight(reason: unknown = 'engine:cancelled'): void {
    if (this.currentAbortController && !this.currentAbortController.signal.aborted) {
      this.currentAbortController.abort(reason);
    }
    this.currentAbortController = null;
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.message === 'AI aborted';
  }
}
