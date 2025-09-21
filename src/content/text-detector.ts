export type TextLikeElement = HTMLTextAreaElement | HTMLElement; // HTMLElement for contenteditable

let lastActiveTextInput: TextLikeElement | null = null;

export function isTextLike(el: Element | null): el is TextLikeElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLElement) {
    if (el.isContentEditable || el.hasAttribute('contenteditable')) return true;
    // If an inner child inside a contenteditable host was targeted
    return !!el.closest('[contenteditable]');
  }
  return false;
}

export function getActiveTextInput(): TextLikeElement | null {
  const resolved = resolveTextLike(document.activeElement);
  if (resolved) {
    lastActiveTextInput = resolved;
    return resolved;
  }
  if (lastActiveTextInput && lastActiveTextInput.isConnected) {
    return lastActiveTextInput;
  }
  lastActiveTextInput = null;
  return null;
}

function resolveTextLike(element: Element | null): TextLikeElement | null {
  if (!element) return null;
  if (element instanceof HTMLTextAreaElement) return element;
  if (element instanceof HTMLElement) {
    if (element.isContentEditable) return element;
    const host = element.closest('[contenteditable]');
    if (host instanceof HTMLElement) return host;
  }
  return null;
}
