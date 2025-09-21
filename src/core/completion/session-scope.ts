interface ScopeContext {
  readonly url?: string;
  readonly pageTitle?: string;
}

const SCOPE_PREFIX = 'scope';

export function deriveSessionScope(ctx: ScopeContext): string {
  const base = normalizeContext(ctx) || 'global';
  return `${SCOPE_PREFIX}:${hashString(base)}`;
}

function normalizeContext({ url, pageTitle }: ScopeContext): string {
  if (url) {
    const normalizedUrl = sanitizeUrl(url);
    if (normalizedUrl) return normalizedUrl;
  }
  if (pageTitle) return pageTitle.trim();
  return '';
}

function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return rawUrl;
  }
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
