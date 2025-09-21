import { describe, expect, it } from 'vitest';
import { deriveSessionScope } from '../src/core/completion/session-scope';

describe('deriveSessionScope', () => {
  it('generates deterministic scope from URL', () => {
    const first = deriveSessionScope({ url: 'https://example.com/path/file.ts?ref=123' });
    const second = deriveSessionScope({ url: 'https://example.com/path/file.ts#section' });
    expect(first).toBe(second);
  });

  it('falls back to page title when URL is missing', () => {
    const scope = deriveSessionScope({ pageTitle: 'My Document' });
    expect(scope.startsWith('scope:')).toBe(true);
  });

  it('defaults to global when no context provided', () => {
    expect(deriveSessionScope({})).toBe('scope:b5e903a3');
  });
});
