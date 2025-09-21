const DEFAULT_WINDOW = 1000;

export function sliceContextAroundCaret(text: string, caret: number, windowSize = DEFAULT_WINDOW): string {
  if (!text) return '';
  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(0, caret - halfWindow);
  const end = Math.min(text.length, caret + halfWindow);
  return text.slice(start, end);
}

export const CONTEXT_WINDOW_SIZE = DEFAULT_WINDOW;
