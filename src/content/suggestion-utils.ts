function removeOverlap(source: string, target: string, direction: 'start' | 'end'): string {
  const limit = Math.min(source.length, target.length);
  for (let overlap = limit; overlap > 0; overlap -= 1) {
    const sourceSlice = direction === 'end'
      ? source.slice(source.length - overlap)
      : source.slice(0, overlap);
    const targetSlice = target.slice(0, overlap);
    if (sourceSlice === targetSlice) {
      return direction === 'end'
        ? source.slice(0, source.length - overlap)
        : source.slice(overlap);
    }
  }
  return source;
}

export function trimSuggestionOverlap(
  prefix: string,
  suggestion: string,
  suffix?: string
): string {
  if (!suggestion) return suggestion;

  let trimmed = suggestion;

  const maxLeadingOverlap = Math.min(prefix.length, suggestion.length);
  for (let overlap = maxLeadingOverlap; overlap > 0; overlap -= 1) {
    const prefixSlice = prefix.slice(prefix.length - overlap);
    const suggestionSlice = suggestion.slice(0, overlap);
    if (prefixSlice === suggestionSlice) {
      trimmed = suggestion.slice(overlap);
      break;
    }
  }

  if (!trimmed || !suffix) return trimmed;

  const withoutLeading = removeOverlap(trimmed, suffix, 'start');
  if (withoutLeading.length === 0) return withoutLeading;
  return removeOverlap(withoutLeading, suffix, 'end');
}

export function trimSuggestions(
  prefix: string,
  suggestions: string[],
  suffix = ''
): string[] {
  const trimmed = suggestions
    .map((suggestion) => trimSuggestionOverlap(prefix, suggestion, suffix))
    .map((suggestion) => sanitizeSuggestionText(suggestion))
    .filter((suggestion): suggestion is string => suggestion.length > 0);
  if (trimmed.length > 0) {
    return trimmed;
  }
  return suggestions
    .map((suggestion) => sanitizeSuggestionText(suggestion))
    .filter((suggestion): suggestion is string => suggestion.length > 0);
}

export function sanitizeSuggestionText(text: string): string {
  if (!text) return '';
  const withoutTrailing = text.replace(/[\s\u00a0]+$/u, '');
  if (withoutTrailing.trim().length === 0) {
    return '';
  }
  return withoutTrailing;
}
