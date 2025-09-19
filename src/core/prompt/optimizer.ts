export class PromptOptimizer {
  optimizeForLatency(prompt: string, maxTokens: number): string {
    const estimated = this.estimateTokens(prompt);
    if (estimated <= maxTokens) return prompt;
    // Naive compression: remove lines labeled as examples or verbose sections
    const lines = prompt
      .split(/\n/u)
      .filter((l) => !/^EXAMPLE(S)?[:\s]/iu.test(l) && !/EXAMPLE PATTERNS:/iu.test(l));
    const compact = lines.join('\n');
    if (this.estimateTokens(compact) <= maxTokens) return compact;
    // If still long, keep the last 4000 chars as a final fallback
    return compact.slice(-4000);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // rough heuristic
  }
}
