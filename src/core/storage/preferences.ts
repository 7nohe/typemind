export type Tone = 'formal' | 'casual' | 'creative' | 'professional';
export type Format = 'plain-text' | 'markdown';
export type Length = 'shorter' | 'longer' | 'as-is';
export type Provider = 'chrome-ai' | 'openai';
export type CompletionLanguage = 'auto' | 'en' | 'es' | 'ja';

export interface Preferences {
  readonly enabled: boolean;
  readonly provider: Provider;
  readonly tone: Tone;
  readonly format: Format;
  readonly length: Length;
  readonly temperature: number; // 0..1
  readonly topK: number; // 1..40
  readonly maxTokens: number; // tokens per completion
  readonly openaiApiKey?: string;
  readonly openaiModel?: string;
  readonly includePromptDebugContext: boolean;
  readonly completionLanguage: CompletionLanguage;
}

export const defaultPreferences: Preferences = {
  enabled: true,
  provider: 'chrome-ai',
  tone: 'professional',
  format: 'plain-text',
  length: 'as-is',
  temperature: 0.5,
  topK: 1,
  maxTokens: 60,
  openaiModel: 'gpt-4o-mini',
  includePromptDebugContext: false,
  completionLanguage: 'auto',
};

export class PreferencesStore {
  static readonly KEY = 'ai_completion_preferences_v1';

  async get(): Promise<Preferences> {
    const res = await chrome.storage.local.get(PreferencesStore.KEY);
    const value = res[PreferencesStore.KEY] as Partial<Preferences> | undefined;
    const merged = { ...defaultPreferences, ...(value ?? {}) } as Preferences;
    const provider = merged.provider === 'openai' ? 'openai' : 'chrome-ai';
    const normalized: Preferences = { ...merged, provider };
    return normalized;
  }

  async set(patch: Partial<Preferences>): Promise<void> {
    const current = await this.get();
    const next = { ...current, ...patch } satisfies Preferences;
    await chrome.storage.local.set({ [PreferencesStore.KEY]: next });
  }
}
