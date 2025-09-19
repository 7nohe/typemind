import { describe, expect, it } from 'vitest';
import { analyzeContext } from '../src/core/prompt/context-analyzer';
import type { CompletionRequest } from '../src/types/completion.d';

const baseRequest = (overrides: Partial<CompletionRequest>): CompletionRequest => ({
  inputText: '',
  cursorPosition: 0,
  contextMetadata: {},
  ...overrides,
});

describe('context analyzer', () => {
  it('infers email style, intent, and topics', () => {
    const body = 'Dear team,\nPlease review the quarterly budget proposal before Friday.\n';
    const request = baseRequest({
      inputText: body,
      cursorPosition: body.length,
      contextMetadata: {
        domain: 'mail.google.com',
        language: 'en-US',
        pageTitle: 'Budget Review',
      },
      contextText:
        'Budget meeting notes: finalize headcount allocation and marketing spend for Q3.',
    });

    const result = analyzeContext({
      request,
      domainType: 'gmail',
      textBefore: body,
      textAfter: '',
      currentParagraph: 'Please review the quarterly budget proposal before Friday.',
    });

    expect(result.writingStyle).toBe('formal');
    expect(result.formContext).toBe('email-compose');
    expect(result.preferredLength).toBe('medium');
    expect(result.detectedIntent).toBe('instruction');
    expect(result.recentTopics).toEqual(expect.arrayContaining(['budget']));
    expect(result.recentTopics.length).toBeGreaterThan(0);
    expect(result.contextWindow).toContain('[CURSOR]');
    expect(result.contextWindow).toContain('budget proposal');
    expect(result.pageSummary).toContain('Budget Review');
  });

  it('recognizes technical context for code discussions', () => {
    const snippet =
      'function addNumbers(a: number, b: number) {\n  return a + b;\n}\n\n// TODO: add validation to guard negative inputs and return early when values are undefined to avoid NaN propagation.\n';
    const request = baseRequest({
      inputText: snippet,
      cursorPosition: snippet.length,
      contextMetadata: {
        domain: 'github.com',
        language: 'en',
        pageTitle: 'PR #42 Update',
      },
      contextText: 'Pull request updates for implementing math helpers and guard clauses.',
    });

    const result = analyzeContext({
      request,
      domainType: 'github',
      textBefore: snippet,
      textAfter: '',
      currentParagraph:
        '// TODO: add validation to guard negative inputs and return early when values are undefined to avoid NaN propagation.',
    });

    expect(result.writingStyle).toBe('technical');
    expect(result.formContext).toBe('code-review');
    expect(result.preferredLength).toBe('long');
    expect(result.detectedIntent).toBe('statement');
    expect(result.recentTopics.length).toBeGreaterThan(0);
  });
});
