import { afterEach, describe, expect, it } from 'vitest';
import { getTextAndCaret, isCaretAtLineEnd } from '../src/content/caret-utils';

afterEach(() => {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  document.body.innerHTML = '';
});

describe('isCaretAtLineEnd (textarea)', () => {
  it('returns true when caret is at end of line', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'hello world';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    expect(isCaretAtLineEnd(textarea)).toBe(true);
  });

  it('returns false when characters follow the caret on the same line', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'hello world';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(5, 5);

    expect(isCaretAtLineEnd(textarea)).toBe(false);
  });

  it('treats trailing whitespace as eligible end-of-line', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'hello   ';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(5, 5);

    expect(isCaretAtLineEnd(textarea)).toBe(true);
  });
});

describe('isCaretAtLineEnd (contenteditable)', () => {
  it('returns false when inline text remains after caret', () => {
    const host = document.createElement('div');
    host.contentEditable = 'true';
    host.innerHTML = 'Hello <span>world</span>';
    document.body.appendChild(host);

    const textNode = host.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, textNode.length);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isCaretAtLineEnd(host)).toBe(false);
  });

  it('treats block descendants as separate lines', () => {
    const host = document.createElement('div');
    host.contentEditable = 'true';
    host.innerHTML = '<div>first</div><div>second</div>';
    document.body.appendChild(host);

    const firstDiv = host.firstChild as HTMLDivElement;
    const textNode = firstDiv.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, textNode.length);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isCaretAtLineEnd(host)).toBe(true);
  });

  it('treats Notion contenteditable leaf as single line despite blocks below', () => {
    const page = document.createElement('div');
    page.className = 'notion-page-content';
    page.contentEditable = 'true';

    let blockIdCounter = 0;
    const makeBlock = (text: string): HTMLDivElement => {
      const block = document.createElement('div');
      block.setAttribute('data-block-id', `block-${blockIdCounter += 1}`);
      const flex = document.createElement('div');
      flex.style.display = 'flex';
      const leaf = document.createElement('div');
      leaf.className = 'notranslate';
      leaf.contentEditable = 'true';
      leaf.dataset.contentEditableLeaf = 'true';
      leaf.textContent = text;
      flex.appendChild(leaf);
      block.appendChild(flex);
      return block;
    };

    const topBlock = makeBlock('みなさん、こんにちは。');
    const middleBlock = makeBlock('何かサジェストしてね');
    const bottomBlock = makeBlock('今後もよろしくお願いいたします。');

    page.append(topBlock, middleBlock, bottomBlock);
    document.body.appendChild(page);

    const middleLeaf = middleBlock.querySelector('[data-content-editable-leaf="true"]') as HTMLDivElement;
    const textNode = middleLeaf.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, textNode.length);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isCaretAtLineEnd(middleLeaf)).toBe(true);
  });

  it('returns true when caret is at end of editable content', () => {
    const host = document.createElement('div');
    host.contentEditable = 'true';
    host.innerHTML = 'Hello <span>world</span>';
    document.body.appendChild(host);

    const spanText = (host.querySelector('span')?.firstChild ?? host.firstChild) as Text;
    const range = document.createRange();
    range.setStart(spanText, spanText.textContent?.length ?? 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isCaretAtLineEnd(host)).toBe(true);
  });

  it('returns false when selection is not collapsed', () => {
    const host = document.createElement('div');
    host.contentEditable = 'true';
    host.textContent = 'selection';
    document.body.appendChild(host);

    const textNode = host.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, textNode.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isCaretAtLineEnd(host)).toBe(false);
  });
});

describe('getTextAndCaret', () => {
  it('returns text and caret position for textarea', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'abc';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(2, 2);

    expect(getTextAndCaret(textarea)).toEqual({ text: 'abc', caret: 2 });
  });

  it('returns text and caret for contenteditable host', () => {
    const host = document.createElement('div');
    host.contentEditable = 'true';
    host.textContent = 'abc';
    document.body.appendChild(host);

    const textNode = host.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getTextAndCaret(host)).toEqual({ text: 'abc', caret: 1 });
  });
});
