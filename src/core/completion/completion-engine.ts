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

export interface EngineConfig {
  readonly maxSuggestions?: number;
  readonly responseTimeout?: number;
  readonly aiConfig: AIConfig;
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

  constructor(
    cfg: EngineConfig,
    provider?: {
      prompt: (text: string, aiConfig: AIConfig, options?: CompletionOptions) => Promise<string>;
    }
  ) {
    this.maxSuggestions = cfg.maxSuggestions ?? 3;
    this.responseTimeout = cfg.responseTimeout ?? 5000;
    this.aiConfig = cfg.aiConfig;
    this.ai = provider ?? new ChromeAIManager();
  }

  private readonly aiConfig: AIConfig;

  async generateCompletions(
    request: CompletionRequest,
    options: CompletionOptions = {}
  ): Promise<CompletionSuggestion[]> {
    const cached = this.cache.get(this.keyOf(request));
    if (cached) {
      return this.ranker.rank([cached]);
    }

    const promptText = this.buildPrompt(request);

    const result = await this.executor.execute(async () =>
      this.ai.prompt(promptText, this.aiConfig, {
        responseTimeout: options.responseTimeout ?? this.responseTimeout,
      })
    );

    this.cache.set(this.keyOf(request), result);
    return this.ranker.rank([result]).slice(0, this.maxSuggestions);
  }

  private keyOf(req: CompletionRequest): string {
    return `${req.contextMetadata.domain ?? 'general'}::${req.contextMetadata.language ?? 'en'}::${
      req.inputText
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
    const maxLen = 60;
    const insertionRules = [
      'OUTPUT FORMAT: Return only the minimal insertion string to place at the caret so that Before + INSERTION + After is natural.',
      `- No explanations, quotes, or markdown. Max length: ${maxLen} characters (1–20 words typically).`,
      '- Do not repeat text from Before or After.',
      '- Whitespace: include necessary leading whitespace/newlines only; avoid trailing spaces.',
      '- Punctuation: prefer closing at a natural boundary; include at most one closing mark; never duplicate punctuation already at the start of After.',
      '- If nothing should be inserted, return an empty string.',
    ].join('\n');

    return [
      assembled,
      `Context summary: ${ctx.pageSummary || 'n/a'}`,
      `Context window: ${ctx.contextWindow || '[CURSOR]'}`,
      insertionRules,
      `Before: ${before}`,
      `After: ${after}`,
      'Insertion:',
    ].join('\n\n');
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
}
