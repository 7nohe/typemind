const SIMPLE_KEYS = new Set<string>(['.', '/', 'Enter', '(']);

export function shouldPrefetchForKey(key: string, beforeText: string): boolean {
  if (!key) return false;
  if (SIMPLE_KEYS.has(key)) return true;
  if (key === '>') {
    const trimmed = beforeText.trimEnd();
    return trimmed.endsWith('=>');
  }
  return false;
}
