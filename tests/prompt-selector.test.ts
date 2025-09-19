import { describe, expect, it } from 'vitest';
import {
  PromptSelector,
  detectDomainType,
  type CompletionContext,
} from '../src/core/prompt/selector';

const baseContext = (overrides: Partial<CompletionContext> = {}): CompletionContext => ({
  textBefore: '',
  textAfter: '',
  currentSentence: '',
  currentParagraph: '',
  domainType: 'generic',
  pageTitle: '',
  formContext: '',
  writingStyle: 'neutral',
  preferredLength: 'short',
  recentTopics: [],
  contextWindow: '[CURSOR]',
  pageSummary: '',
  detectedIntent: 'statement',
  ...overrides,
});

describe('detectDomainType', () => {
  it('detects well-known domains', () => {
    expect(detectDomainType('https://github.com/org/repo')).toBe('github');
    expect(detectDomainType('https://mail.google.com/mail')).toBe('gmail');
    expect(detectDomainType('https://twitter.com/thread')).toBe('social');
    expect(detectDomainType('https://docs.google.com/document/d/1')).toBe('docs');
  });

  it('falls back to generic for unknown or invalid URLs', () => {
    expect(detectDomainType('https://example.com')).toBe('generic');
    expect(detectDomainType('not a url')).toBe('generic');
  });
});

describe('PromptSelector', () => {
  const selector = new PromptSelector();

  const extractSections = (prompt: string): string[] => prompt.split(/\n{2,}/u);

  it('includes technical guidance for GitHub contexts', () => {
    const prompt = selector.selectPrompt(
      baseContext({
        domainType: 'github',
        textBefore: '```ts\nfunction test() {}',
      })
    );
    const sections = extractSections(prompt);
    expect(sections.some((section) => /TECHNICAL COMPLETION RULES/u.test(section))).toBe(true);
  });

  it('includes business tone guidance for Gmail contexts', () => {
    const prompt = selector.selectPrompt(
      baseContext({
        domainType: 'gmail',
        formContext: 'email-compose',
      })
    );
    expect(prompt).toMatch(/BUSINESS WRITING PRINCIPLES/u);
  });

  it('omits domain prompt for generic contexts', () => {
    const prompt = selector.selectPrompt(baseContext());
    expect(prompt).not.toMatch(/COMPLETION RULES/u);
  });
});
