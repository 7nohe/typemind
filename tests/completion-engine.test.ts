import { describe, expect, it, vi } from 'vitest';
import { CompletionEngine } from '../src/core/completion/completion-engine';

describe('CompletionEngine', () => {
  it('generates basic completions with stub provider', async () => {
    let lastPrompt = '';
    const stubProvider = {
      async prompt(input: string) {
        lastPrompt = input;
        const suggestion = input.includes('weather') ? ' sunny and mild.' : ' example completion.';
        return JSON.stringify({
          suggestions: [
            {
              text: suggestion,
            },
            {
              text: `${suggestion.trim()} with light winds.`,
            },
          ],
        });
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
    expect(lastPrompt).not.toContain('Context window:');
    expect(suggestions.length).toBeGreaterThan(0);
    const first = suggestions[0]!;
    expect(typeof first.text).toBe('string');
    expect(first.text).toContain('sunny');
  });

  it('includes prompt debug context when enabled', async () => {
    let lastPrompt = '';
    const stubProvider = {
      async prompt(input: string) {
        lastPrompt = input;
        return JSON.stringify({ suggestions: [{ text: ' debug sample.' }] });
      },
    };
    const engine = new CompletionEngine(
      {
        aiConfig: { temperature: 0.5, topK: 1, maxTokens: 32 },
        includePromptDebugContext: true,
      },
      stubProvider
    );
    await engine.generateCompletions({
      inputText: 'Test prompt',
      cursorPosition: 10,
      contextMetadata: { domain: 'generic', language: 'en' },
    });
    expect(lastPrompt).toContain('Context window:');
  });
});

describe('CompletionEngine caching and parsing', () => {
  it('falls back to ranking raw text when provider returns plain string', async () => {
    const provider = {
      prompt: vi.fn().mockResolvedValue('Finish the sentence gracefully.'),
    };
    const engine = new CompletionEngine(
      { aiConfig: { temperature: 0.2, topK: 1, maxTokens: 32 } },
      provider
    );
    const result = await engine.generateCompletions({
      inputText: 'Finish the sentence',
      cursorPosition: 20,
      contextMetadata: { domain: 'generic', language: 'en' },
    });
    expect(provider.prompt).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('Finish the sentence gracefully.');
  });

  it('reuses cached suggestions for identical requests', async () => {
    const provider = {
      prompt: vi
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({ suggestions: [{ text: ' first suggestion.' }] })
        )
        .mockResolvedValueOnce(
          JSON.stringify({ suggestions: [{ text: ' second suggestion.' }] })
        ),
    };
    const engine = new CompletionEngine(
      { aiConfig: { temperature: 0.2, topK: 1, maxTokens: 32 } },
      provider
    );
    const request = {
      inputText: 'Cache this please',
      cursorPosition: 17,
      contextMetadata: { domain: 'generic', language: 'en' },
    };

    const first = await engine.generateCompletions(request);
    const second = await engine.generateCompletions(request);

    expect(provider.prompt).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second[0]?.text).toBe(' first suggestion.');
  });
});
