import type { TextLikeElement } from './text-detector';

const BLOCK_TAGS = new Set([
  'DIV',
  'P',
  'LI',
  'UL',
  'OL',
  'SECTION',
  'ARTICLE',
  'MAIN',
  'NAV',
  'ASIDE',
  'HEADER',
  'FOOTER',
  'BLOCKQUOTE',
  'PRE',
]);

function sliceLineSegment(text: string, caret: number): string {
  if (!text) return '';
  const rest = text.slice(caret);
  const match = rest.match(/^[^\r\n]*/u);
  return match ? match[0] ?? '' : '';
}

export function getTextAndCaret(el: TextLikeElement): { text: string; caret: number } {
  if (el instanceof HTMLTextAreaElement) {
    const caret = el.selectionStart ?? el.value.length;
    return { text: el.value, caret };
  }
  const host = el;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { text: host.innerText ?? host.textContent ?? '', caret: 0 };
  }

  const range = sel.getRangeAt(0);
  if (!host.contains(range.endContainer)) {
    return { text: host.innerText ?? host.textContent ?? '', caret: 0 };
  }

  const full = document.createRange();
  full.selectNodeContents(host);
  const allText = full.toString();

  const pre = range.cloneRange();
  pre.selectNodeContents(host);
  pre.setEnd(range.endContainer, range.endOffset);
  const caret = pre.toString().length;

  return { text: allText, caret };
}

export function isCaretAtLineEnd(el: TextLikeElement): boolean {
  if (el instanceof HTMLTextAreaElement) {
    return isTextareaCaretAtLineEnd(el);
  }

  return isContentEditableCaretAtLineEnd(el);
}

function isTextareaCaretAtLineEnd(el: HTMLTextAreaElement): boolean {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if (start === null || end === null) return false;
  if (start !== end) return false;
  const lineSegment = sliceLineSegment(el.value, end);
  return lineSegment.trim().length === 0;
}

function isContentEditableCaretAtLineEnd(host: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  if (!host.contains(range.endContainer)) return false;

  const lineContainer = findLineContainer(range.endContainer, host);
  const afterRange = document.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  const endContainer = lineContainer ?? host;
  if (endContainer instanceof HTMLElement) {
    afterRange.setEnd(endContainer, endContainer.childNodes.length);
  } else {
    afterRange.selectNodeContents(host);
    afterRange.setStart(range.endContainer, range.endOffset);
  }
  const afterText = afterRange.toString();
  const lineSegment = sliceLineSegment(afterText, 0);
  return lineSegment.trim().length === 0;
}

function findLineContainer(node: Node, host: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== host) {
    if (current instanceof HTMLElement && isBlockBoundary(current, host)) {
      return current;
    }
    current = current.parentNode;
  }
  if (host instanceof HTMLElement) return host;
  return null;
}

function isBlockBoundary(el: HTMLElement, host: HTMLElement): boolean {
  if (el.dataset.contentEditableLeaf === 'true') return true;
  if (el.hasAttribute('data-block-id')) return true;
  if (el.parentElement === host) return true;
  if (BLOCK_TAGS.has(el.tagName)) return true;
  try {
    const display = window.getComputedStyle(el).display;
    return display === 'block' || display === 'flex' || display === 'grid' || display === 'list-item';
  } catch {
    return false;
  }
}
