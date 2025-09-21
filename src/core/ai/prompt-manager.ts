import type { CompletionOptions } from '../../types/completion.d';

export interface AIConfig {
  readonly temperature: number;
  readonly topK: number;
  readonly maxTokens: number;
  readonly systemPrompt?: string;
  readonly contextWindow?: number;
  readonly outputLanguage?: 'en' | 'es' | 'ja';
  readonly expectedInputs?: ChromeAI.ExpectedContent[];
  readonly expectedOutputs?: ChromeAI.ExpectedContent[];
}

const TIMEOUT_ABORT_REASON = 'engine:timeout';
const EXTERNAL_ABORT_REASON = 'engine:cancelled';

export class ChromeAIManager {
  private readonly sessions: Map<string, ChromeAI.AISession> = new Map();
  private readonly sessionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async getOrCreateSession(config: AIConfig, scope = 'global'): Promise<ChromeAI.AISession> {
    const sessionKey = this.generateSessionKey(config, scope);
    let session = this.sessions.get(sessionKey);
    if (!session) {
      session = await this.createSession(config);
      this.sessions.set(sessionKey, session);
    }
    this.bumpExpiration(sessionKey, session);
    return session;
  }

  async prompt(text: string, aiConfig: AIConfig, options?: CompletionOptions): Promise<string> {
    const baseSession = await this.getOrCreateSession(aiConfig, options?.sessionScope);
    const workingSession = (await this.safeClone(baseSession)) ?? baseSession;
    const abortGuards = this.createAbortGuards(options);
    try {
      const promptOptions = this.buildPromptOptions(abortGuards.controller, options);
      return await workingSession.prompt(text, promptOptions);
    } catch (err) {
      throw mapChromeAbortError(err, abortGuards);
    } finally {
      abortGuards.cleanup();
      if (workingSession !== baseSession) {
        try {
          workingSession.destroy();
        } catch {
          // ignore clone destroy errors
        }
      }
    }
  }

  private createAbortGuards(options?: CompletionOptions): ChromeAbortGuards {
    const controller = new AbortController();
    const timeoutMs = options?.responseTimeout ?? 10000;
    let abortedByTimeout = false;
    let abortedByExternal = false;

    const timeoutId = setTimeout(() => {
      abortedByTimeout = true;
      controller.abort(TIMEOUT_ABORT_REASON);
    }, timeoutMs);

    const cleanupExternalAbort = this.bindExternalAbort(
      controller,
      options?.abortSignal,
      () => {
        abortedByExternal = true;
      }
    );

    return {
      controller,
      isTimeoutAbort: (): boolean => abortedByTimeout,
      isExternalAbort: (): boolean =>
        abortedByExternal || options?.abortSignal?.aborted === true,
      cleanup: (): void => {
        clearTimeout(timeoutId);
        cleanupExternalAbort();
      },
    };
  }

  private buildPromptOptions(
    controller: AbortController,
    options?: CompletionOptions
  ): ChromeAI.PromptOptions {
    const promptOptions: ChromeAI.PromptOptions & Record<string, unknown> = {
      signal: controller.signal,
    };
    if (options?.responseTimeout !== undefined) {
      promptOptions.responseTimeout = options.responseTimeout;
    }
    if (options?.responseConstraint !== undefined) {
      promptOptions.responseConstraint = options.responseConstraint;
    }
    if (options?.omitResponseConstraintInput !== undefined) {
      promptOptions.omitResponseConstraintInput = options.omitResponseConstraintInput;
    }
    return promptOptions;
  }

  private bindExternalAbort(
    controller: AbortController,
    externalSignal: AbortSignal | undefined,
    onAbort: () => void
  ): () => void {
    if (!externalSignal) {
      return () => { };
    }
    if (externalSignal.aborted) {
      onAbort();
      controller.abort(externalSignal.reason ?? EXTERNAL_ABORT_REASON);
      return () => { };
    }
    const handleAbort = (): void => {
      onAbort();
      controller.abort(externalSignal.reason ?? EXTERNAL_ABORT_REASON);
    };
    externalSignal.addEventListener('abort', handleAbort, { once: true });
    return () => {
      externalSignal.removeEventListener('abort', handleAbort);
    };
  }

  private bumpExpiration(sessionKey: string, session: ChromeAI.AISession): void {
    const existingTimer = this.sessionTimers.get(sessionKey);
    if (existingTimer !== undefined) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      try {
        session.destroy();
      } catch {
        // ignore destroy errors
      }
      this.sessions.delete(sessionKey);
      this.sessionTimers.delete(sessionKey);
    }, 300_000);
    this.sessionTimers.set(sessionKey, timer);
  }

  private async createSession(config: AIConfig): Promise<ChromeAI.AISession> {
    const LM = this.resolveLanguageModel();
    if (!LM || typeof LM.availability !== 'function' || typeof LM.create !== 'function') {
      throw new Error('AI not available: not-defined');
    }
    const resolvedOutputLanguage = chooseOutputLanguage(config.outputLanguage);
    const expectedInputs =
      config.expectedInputs ?? buildDefaultExpectedInputs(resolvedOutputLanguage);
    const expectedOutputs =
      config.expectedOutputs ?? buildDefaultExpectedOutputs(resolvedOutputLanguage);

    const availability = await LM.availability(
      buildAvailabilityOptions(expectedInputs)
    );
    console.debug('[AICompletion] AI availability', availability);
    this.assertAvailability(availability);

    const expectedInputsClone = cloneExpected(expectedInputs);
    const expectedOutputsClone = cloneExpected(expectedOutputs);

    const options: Partial<ChromeAI.CreateOptions> = {
      temperature: config.temperature,
      topK: config.topK,
      outputLanguage: resolvedOutputLanguage,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          // eslint-disable-next-line no-console
          console.debug('[AICompletion] model download progress', Math.round(e.loaded * 100), '%');
        });
      },
    };
    if (expectedInputsClone) {
      options.expectedInputs = expectedInputsClone;
    }
    if (expectedOutputsClone) {
      options.expectedOutputs = expectedOutputsClone;
    }
    if (config.systemPrompt !== undefined) {
      options.initialPrompts = [{ role: 'system', content: config.systemPrompt }];
    }
    return LM.create(options);
  }

  private assertAvailability(availability: ChromeAI.Availability): void {
    if (availability === 'downloadable') {
      // Do not auto-start downloads. Defer to settings page for explicit user action.
      throw new Error('AI needs download');
    }
    if (availability === 'downloading') {
      throw new Error('AI downloading');
    }
    if (availability !== 'available') {
      throw new Error(`AI not available: ${availability}`);
    }
  }

  private resolveLanguageModel(): ChromeAI.LanguageModelAPI | undefined {
    const g = globalThis as unknown as {
      LanguageModel?: ChromeAI.LanguageModelAPI;
    };
    if (g.LanguageModel && typeof g.LanguageModel.availability === 'function')
      return g.LanguageModel;
    return undefined;
  }

  private generateSessionKey(config: AIConfig, scope: string): string {
    return [
      scope,
      config.temperature,
      config.topK,
      config.maxTokens,
      config.systemPrompt ?? '',
      config.outputLanguage ?? 'auto',
    ].join(':');
  }

  private async safeClone(session: ChromeAI.AISession): Promise<ChromeAI.AISession | null> {
    const cloneFn = (session as {
      clone?: (() => Promise<ChromeAI.AISession | undefined>) | null;
    }).clone;
    if (typeof cloneFn !== 'function') return null;
    try {
      const cloned = await cloneFn.call(session);
      return cloned ?? null;
    } catch (error) {
      console.debug('[AICompletion] Session clone failed; reusing base session', { error });
      return null;
    }
  }
}

interface ChromeAbortGuards {
  controller: AbortController;
  isTimeoutAbort: () => boolean;
  isExternalAbort: () => boolean;
  cleanup: () => void;
}

function mapChromeAbortError(error: unknown, guards: ChromeAbortGuards): Error {
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

function chooseOutputLanguage(preferred?: 'en' | 'es' | 'ja'): 'en' | 'es' | 'ja' {
  if (preferred) return preferred;
  const lang = (navigator?.language || 'en').toLowerCase();
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}

function buildDefaultExpectedInputs(language: 'en' | 'es' | 'ja'): ChromeAI.ExpectedContent[] {
  return [{ type: 'text', languages: [language] }];
}

function buildDefaultExpectedOutputs(language: 'en' | 'es' | 'ja'): ChromeAI.ExpectedContent[] {
  return [{ type: 'text', languages: [language] }];
}

function buildAvailabilityOptions(
  inputs: ChromeAI.ExpectedContent[] | undefined,
): ChromeAI.AvailabilityOptions {
  const options: ChromeAI.AvailabilityOptions = {};
  const clonedInputs = cloneExpected(inputs);
  if (clonedInputs) options.expectedInputs = clonedInputs;
  return options;
}

function cloneExpected(
  contents: ChromeAI.ExpectedContent[] | undefined
): ChromeAI.ExpectedContent[] | undefined {
  if (!contents || contents.length === 0) return undefined;
  return contents.map((item) => ({
    ...item,
    ...(item.languages ? { languages: [...item.languages] } : {}),
  }));
}
