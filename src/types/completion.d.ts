export interface ContextMetadata {
  readonly domain?: string;
  readonly language?: string;
  readonly pageTitle?: string;
  readonly url?: string;
}

export interface CompletionRequest {
  readonly inputText: string;
  readonly cursorPosition: number;
  readonly contextMetadata: ContextMetadata;
  readonly contextText?: string;
}

export interface CompletionSuggestion {
  readonly text: string;
  readonly confidence: number; // 0..1
}

export interface CompletionOptions {
  readonly maxSuggestions?: number;
  readonly responseTimeout?: number; // ms
}

export type AppMessageType = 'COMPLETION_REQUEST' | 'SETTINGS_UPDATE' | 'UI_STATE_CHANGE';

export interface AppMessage<T = unknown> {
  readonly type: AppMessageType;
  readonly payload: T;
  readonly correlationId: string;
}

export interface CompletionResponsePayload {
  readonly suggestions: CompletionSuggestion[];
  readonly status?: 'NEEDS_DOWNLOAD' | 'DOWNLOADING' | 'UNAVAILABLE' | 'TIMEOUT';
  readonly error?: string;
  readonly provider?: {
    readonly preference: 'chrome-ai' | 'openai';
    readonly resolved: 'chrome-ai' | 'openai' | 'fallback';
  };
}

export interface CompletionRequestPayload extends CompletionRequest {}
