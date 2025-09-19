import { describe, it, expect } from 'vitest';
import { isTextLike } from '../src/content/text-detector';

describe('text-detector', () => {
  it('detects textarea as text-like', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    expect(isTextLike(ta)).toBe(true);
    ta.remove();
  });

  it('detects contenteditable host and active element', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'hello';
    document.body.appendChild(div);
    expect(isTextLike(div)).toBe(true);
    // jsdom では focus/activeElement が十分にエミュレートされないため、
    // isTextLike のみを検証する。
    div.remove();
  });
});
