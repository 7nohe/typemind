export type Tone = 'formal' | 'casual' | 'creative' | 'professional';
export type Format = 'plain-text' | 'markdown';
export type Length = 'shorter' | 'longer' | 'as-is';
export type Provider = 'chrome-ai' | 'openai';

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
}

export const defaultPreferences: Preferences = {
  enabled: true,
  provider: 'chrome-ai',
  tone: 'professional',
  format: 'plain-text',
  length: 'as-is',
  temperature: 0.7,
  topK: 3,
  maxTokens: 150,
  openaiModel: 'gpt-4o-mini',
};

export class PreferencesStore {
  private static readonly KEY = 'ai_completion_preferences_v1';

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
