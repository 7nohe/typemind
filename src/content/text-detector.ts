export type TextLikeElement = HTMLTextAreaElement | HTMLElement; // HTMLElement for contenteditable

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
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement) return active;
  if (active instanceof HTMLElement && active.isContentEditable) return active;
  return null;
}
