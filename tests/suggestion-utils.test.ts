import { describe, expect, it } from 'vitest';
import {
  trimSuggestions,
  trimSuggestionOverlap,
  sanitizeSuggestionText,
} from '../src/content/suggestion-utils';

describe('trimSuggestionOverlap', () => {
  it('removes overlapping prefix between existing text and suggestion', () => {
    const prefix = '次に実行結果を見て';
    const suggestion = '実行結果を見てみます';
    expect(trimSuggestionOverlap(prefix, suggestion)).toBe('みます');
  });

  it('returns suggestion unchanged when there is no overlap', () => {
    const prefix = 'Hello ';
    const suggestion = 'world';
    expect(trimSuggestionOverlap(prefix, suggestion)).toBe('world');
  });

  it('removes only the longest overlap', () => {
    const prefix = 'analysis';
    const suggestion = 'sis result';
    expect(trimSuggestionOverlap(prefix, suggestion)).toBe(' result');
  });

  it('returns empty string when suggestion is fully duplicated', () => {
    const prefix = 'abc';
    const suggestion = 'abc';
    expect(trimSuggestionOverlap(prefix, suggestion)).toBe('');
  });

  it('removes overlap against trailing suffix to avoid duplication after caret', () => {
    const prefix = 'We will ';
    const suggestion = 'test this soon';
    const suffix = 'test this soon after launch';
    expect(trimSuggestionOverlap(prefix, suggestion, suffix)).toBe('');
  });

  it('keeps only the non-overlapping tail when suffix overlaps suggestion end', () => {
    const prefix = 'Look at ';
    const suggestion = 'results now';
    const suffix = 'now please';
    expect(trimSuggestionOverlap(prefix, suggestion, suffix)).toBe('results ');
  });
});

describe('sanitizeSuggestionText', () => {
  it('preserves leading whitespace while trimming trailing blanks', () => {
    expect(sanitizeSuggestionText('  next step  ')).toBe('  next step');
  });

  it('drops strings that contain only whitespace', () => {
    expect(sanitizeSuggestionText('\n\t')).toBe('');
  });
});

describe('trimSuggestions', () => {
  it('filters out suggestions that are fully duplicated by existing text', () => {
    const prefix = 'typed';
    const suggestions = ['typed', 'typed more'];
    expect(trimSuggestions(prefix, suggestions)).toEqual([' more']);
  });

  it('keeps multiple adjusted suggestions in order', () => {
    const prefix = 'The result shows';
    const suggestions = ['shows improvement', ' improvement is clear'];
    expect(trimSuggestions(prefix, suggestions)).toEqual([' improvement', ' improvement is clear']);
  });

  it('removes suffix overlaps when provided', () => {
    const prefix = '前提として';
    const suffix = '補完結果を確認する';
    const suggestions = ['補完結果を確認する', '補完結果を確認するとき'];
    expect(trimSuggestions(prefix, suggestions, suffix)).toEqual(['とき']);
  });

  it('falls back to original suggestions when trimming empties all values', () => {
    const prefix = 'abc';
    const suffix = 'abc';
    const suggestions = ['abc', ''];
    expect(trimSuggestions(prefix, suggestions, suffix)).toEqual(['abc']);
  });
});
