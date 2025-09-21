import { describe, expect, it } from 'vitest';
import { shouldPrefetchForKey } from '../src/content/prefetch-detector';

describe('shouldPrefetchForKey', () => {
  it('prefetches for simple punctuation keys', () => {
    expect(shouldPrefetchForKey('.', 'foo.')).toBe(true);
    expect(shouldPrefetchForKey('/', 'fetch/')).toBe(true);
    expect(shouldPrefetchForKey('Enter', 'line')).toBe(true);
    expect(shouldPrefetchForKey('(', 'call(')).toBe(true);
  });

  it('prefetches when arrow functions detected', () => {
    expect(shouldPrefetchForKey('>', 'const fn = () =>')).toBe(true);
    expect(shouldPrefetchForKey('>', 'const fn = () => ')).toBe(true);
  });

  it('does not prefetch for unrelated keys', () => {
    expect(shouldPrefetchForKey('a', 'abc')).toBe(false);
    expect(shouldPrefetchForKey('Shift', 'abc')).toBe(false);
  });
});
