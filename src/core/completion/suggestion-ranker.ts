import type { CompletionSuggestion } from '../../types/completion.d';

export class SuggestionRanker {
  rank(candidates: string[]): CompletionSuggestion[] {
    // Very simple heuristic: prefer non-empty, end with punctuation, shorter first
    // Preserve leading whitespace (can be necessary for natural insertion).
    const scored = candidates
      .map((text) => this.rtrim(text))
      .filter((t) => t.length > 0)
      .map((text) => ({
        text,
        confidence: this.score(text),
      }))
      .sort((a, b) => b.confidence - a.confidence);

    return scored.slice(0, 3);
  }

  private score(text: string): number {
    let score = 0.5;
    if (/[.!?]$/.test(text)) score += 0.2;
    if (text.length < 140) score += 0.1; // prefer snappy
    if (/^[A-Z]/.test(text)) score += 0.05; // starts cleanly
    return Math.max(0, Math.min(1, score));
  }

  private rtrim(text: string): string {
    return text.replace(/\s+$/u, '');
  }
}
