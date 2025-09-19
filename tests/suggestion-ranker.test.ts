import { describe, expect, it } from 'vitest';
import { SuggestionRanker } from '../src/core/completion/suggestion-ranker';

describe('SuggestionRanker', () => {
  const ranker = new SuggestionRanker();

  it('ranks suggestions by confidence and trims trailing whitespace', () => {
    const ranked = ranker.rank(['Hello there!  ', 'Hi', 'Greetings.']);
    expect(ranked[0]?.text).toBe('Hello there!');
    expect(ranked.some((suggestion) => suggestion.text.endsWith(' '))).toBe(false);
  });

  it('filters out empty candidates', () => {
    const ranked = ranker.rank(['   ', 'Complete sentence.']);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.text).toBe('Complete sentence.');
  });
});
