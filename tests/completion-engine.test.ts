import { CompletionEngine } from '../src/core/completion/completion-engine';

describe('CompletionEngine', () => {
  it('generates basic completions with stub provider', async () => {
    const stubProvider = {
      async prompt(input: string) {
        return input.includes('weather') ? ' sunny and mild.' : ' example completion.';
      },
    };
    const engine = new CompletionEngine(
      {
        aiConfig: { temperature: 0.7, topK: 3, maxTokens: 64 },
      },
      stubProvider
    );
    const suggestions = await engine.generateCompletions({
      inputText: 'The weather today is',
      cursorPosition: 21,
      contextMetadata: { domain: 'weather', language: 'en' },
    });
    expect(suggestions.length).toBeGreaterThan(0);
    const first = suggestions[0]!;
    expect(typeof first.text).toBe('string');
    expect(first.text).toContain('sunny');
  });
});
