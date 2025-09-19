import type { CompletionOptions } from '../../types/completion.d';

export interface AIConfig {
  readonly temperature: number;
  readonly topK: number;
  readonly maxTokens: number;
  readonly systemPrompt?: string;
  readonly contextWindow?: number;
}

export class ChromeAIManager {
  private readonly sessions: Map<string, ChromeAI.AISession> = new Map();

  async getOrCreateSession(config: AIConfig): Promise<ChromeAI.AISession> {
    const sessionKey = this.generateSessionKey(config);
    if (!this.sessions.has(sessionKey)) {
      const session = await this.createSession(config);
      this.sessions.set(sessionKey, session);
      setTimeout(() => {
        const s = this.sessions.get(sessionKey);
        if (s) s.destroy();
        this.sessions.delete(sessionKey);
      }, 300_000); // 5 minutes
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.sessions.get(sessionKey)!;
  }

  async prompt(text: string, aiConfig: AIConfig, options?: CompletionOptions): Promise<string> {
    const session = await this.getOrCreateSession(aiConfig);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), options?.responseTimeout ?? 5000);
    try {
      return await session.prompt(text, { signal: controller.signal });
    } catch (err) {
      // Normalize AbortError → friendlier message for upstream handling
      const name = (err as { name?: string } | undefined)?.name ?? '';
      const msg = String(err ?? '');
      if (name === 'AbortError' || /aborted|AbortError/i.test(msg)) {
        throw new Error('AI timeout');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async createSession(config: AIConfig): Promise<ChromeAI.AISession> {
    const LM = this.resolveLanguageModel();
    if (!LM || typeof LM.availability !== 'function' || typeof LM.create !== 'function') {
      throw new Error('AI not available: not-defined');
    }
    const availability = await LM.availability();
    console.debug('[AICompletion] AI availability', availability);
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
    const options: Partial<ChromeAI.CreateOptions> = {
      temperature: config.temperature,
      topK: config.topK,
      outputLanguage: chooseOutputLanguage(),
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          // eslint-disable-next-line no-console
          console.debug('[AICompletion] model download progress', Math.round(e.loaded * 100), '%');
        });
      },
    };
    if (config.systemPrompt !== undefined) {
      options.initialPrompts = [{ role: 'system', content: config.systemPrompt }];
    }
    return LM.create(options);
  }

  private resolveLanguageModel(): ChromeAI.LanguageModelAPI | undefined {
    const g = globalThis as unknown as {
      LanguageModel?: ChromeAI.LanguageModelAPI;
    };
    if (g.LanguageModel && typeof g.LanguageModel.availability === 'function')
      return g.LanguageModel;
    return undefined;
  }

  private generateSessionKey(config: AIConfig): string {
    return [config.temperature, config.topK, config.maxTokens, config.systemPrompt ?? ''].join(':');
  }
}

function chooseOutputLanguage(): 'en' | 'es' | 'ja' {
  const lang = (navigator?.language || 'en').toLowerCase();
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}
