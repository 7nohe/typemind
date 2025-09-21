import { describe, expect, it } from 'vitest';
import { sliceContextAroundCaret, CONTEXT_WINDOW_SIZE } from '../src/content/context-window';

describe('sliceContextAroundCaret', () => {
  it('returns entire string when shorter than window', () => {
    const text = 'short text';
    expect(sliceContextAroundCaret(text, 2)).toBe(text);
  });

  it('captures symmetric window around caret when possible', () => {
    const text = 'a'.repeat(2000);
    const caret = 1000;
    const slice = sliceContextAroundCaret(text, caret);
    expect(slice.length).toBe(CONTEXT_WINDOW_SIZE);
    expect(slice).toBe(text.slice(500, 1500));
  });

  it('handles caret near start by clamping to beginning', () => {
    const text = 'abc'.repeat(400);
    const caret = 10;
    const slice = sliceContextAroundCaret(text, caret);
    expect(slice).toBe(text.slice(0, caret + Math.floor(CONTEXT_WINDOW_SIZE / 2)));
  });

  it('returns empty string when input is empty', () => {
    expect(sliceContextAroundCaret('', 0)).toBe('');
  });
});
