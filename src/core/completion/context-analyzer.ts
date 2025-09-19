import type { ContextMetadata } from '../../types/completion.d';

export class ContextAnalyzer {
  extractMetadata(): ContextMetadata {
    const hasDoc = typeof document !== 'undefined';
    const hasLoc = typeof location !== 'undefined';
    const pageTitle = hasDoc ? document.title : undefined;
    const url = hasLoc ? location.href : undefined;
    const domain = hasLoc ? new URL(location.href).hostname : undefined;
    const language = hasDoc
      ? document.documentElement.getAttribute('lang') || navigator.language || 'en'
      : 'en';

    return {
      ...(pageTitle ? { pageTitle } : {}),
      ...(url ? { url } : {}),
      ...(domain ? { domain } : {}),
      language,
    } as ContextMetadata;
  }

  extractContextText(maxChars = 2000): string {
    if (typeof document === 'undefined') return '';
    const text = document.body?.innerText ?? '';
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  }
}
