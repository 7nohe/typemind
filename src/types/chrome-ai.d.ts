/* Minimal type declarations for Chrome AI APIs used in this project. */

declare namespace ChromeAI {
  // Newer LanguageModel API (Chrome 128+):
  // See https://developer.chrome.com/docs/ai/prompt-api

  type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

  interface ModelParams {
    defaultTopK: number;
    maxTopK: number;
    defaultTemperature: number;
    maxTemperature: number;
  }

  interface CreateOptions {
    temperature?: number;
    topK?: number;
    /** Output language BCP-47 tag (Prompt API may require specifying this). */
    outputLanguage?: string;
    /** Replaces systemPrompt; an optional list of initial instruction messages. */
    initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    /** Optional monitor to observe model download progress */
    monitor?: (m: DownloadMonitor) => void;
    /** AbortSignal to cancel creation */
    signal?: AbortSignal;
    expectedOutputs?: Array<{ type: 'text'; languages: string[] }>;
  }

  /** Minimal monitor interface for model download events */
  interface DownloadMonitor {
    addEventListener(type: 'downloadprogress', listener: (e: DownloadProgressEvent) => void): void;
  }

  interface DownloadProgressEvent extends Event {
    /** A value between 0 and 1 indicating download completion ratio */
    loaded: number;
  }

  interface PromptOptions {
    /** AbortSignal to cancel the prompt */
    signal?: AbortSignal;
    /** Response constraints (not used in this project) */
    responseConstraints?: unknown;
  }

  interface AISession {
    prompt(input: string, options?: PromptOptions): Promise<string>;
    destroy(): void;
    /** Optional usage fields available in newer Chrome versions */
    // inputQuota?: number;
    // inputUsage?: number;
  }

  interface LanguageModelAPI {
    availability(): Promise<Availability>;
    params(): Promise<ModelParams>;
    create(options?: CreateOptions): Promise<AISession>;
  }

  interface WriterAPIConfig {
    tone?: 'formal' | 'casual' | 'creative' | 'professional';
    format?: 'plain-text' | 'markdown';
    length?: 'shorter' | 'longer' | 'as-is';
  }

  interface RewriterAPIConfig {
    context?: string;
    tone?: 'as-is' | 'more-formal' | 'more-casual' | 'professional';
    length?: 'as-is' | 'shorter' | 'longer';
  }

  interface WriterAPI {
    write(text: string, config?: WriterAPIConfig): Promise<string>;
  }

  interface RewriterAPI {
    rewrite(text: string, config?: RewriterAPIConfig): Promise<string>;
  }

  interface AI {
    languageModel: LanguageModelAPI;
    // Optional, not yet standardized in Chrome: feature-detect before use.
    writer?: WriterAPI;
    rewriter?: RewriterAPI;
  }
}

// For web contexts that still expose `ai`, keep declaration for compatibility.
declare const ai: ChromeAI.AI;

// Extensions should use the global `LanguageModel` object per latest docs.
declare const LanguageModel: ChromeAI.LanguageModelAPI;
