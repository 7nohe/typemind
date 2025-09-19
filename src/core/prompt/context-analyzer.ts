import type { CompletionRequest } from '../../types/completion.d';
import type { DomainType, WritingStyle } from './selector';

const EN_STOPWORDS = new Set([
  'the',
  'and',
  'that',
  'with',
  'this',
  'have',
  'about',
  'your',
  'from',
  'into',
  'there',
  'their',
  'subject',
  'regards',
  'please',
  'thank',
  'thanks',
  'would',
  'could',
  'should',
  'also',
  'been',
  'were',
  'will',
  'very',
  'here',
  'just',
  'have',
  'been',
]);

const JA_STOPWORDS = new Set([
  'こと',
  'もの',
  'よう',
  'ため',
  'これ',
  'それ',
  'ここ',
  'する',
  'さん',
  'ます',
  'です',
]);

export type DetectedIntent = 'statement' | 'question' | 'instruction' | 'narrative';

export interface ContextAnalysis {
  readonly writingStyle: WritingStyle;
  readonly formContext: string;
  readonly preferredLength: 'short' | 'medium' | 'long';
  readonly recentTopics: string[];
  readonly contextWindow: string;
  readonly pageSummary: string;
  readonly detectedIntent: DetectedIntent;
}

export interface ContextAnalysisInput {
  readonly request: CompletionRequest;
  readonly domainType: DomainType;
  readonly textBefore: string;
  readonly textAfter: string;
  readonly currentParagraph: string;
}

export function analyzeContext(input: ContextAnalysisInput): ContextAnalysis {
  const { request, domainType, textBefore, textAfter, currentParagraph } = input;
  const contextText = request.contextText ?? '';
  const writingStyle = inferWritingStyle(
    domainType,
    textBefore,
    contextText,
    request.contextMetadata.pageTitle ?? ''
  );
  const formContext = detectFormContext(
    domainType,
    textBefore,
    request.contextMetadata.pageTitle ?? ''
  );
  const preferredLength = inferPreferredLength(currentParagraph, writingStyle);
  const recentTopics = extractTopics(
    `${currentParagraph}\n${contextText}`,
    request.contextMetadata.language ??
      (typeof navigator !== 'undefined' ? navigator.language : 'en') ??
      'en'
  );
  const contextWindow = buildContextWindow(textBefore, textAfter);
  const pageSummary = summarizeContext(contextText, request.contextMetadata.pageTitle ?? '');
  const detectedIntent = detectIntent(textBefore, currentParagraph);

  return {
    writingStyle,
    formContext,
    preferredLength,
    recentTopics,
    contextWindow,
    pageSummary,
    detectedIntent,
  };
}

function inferWritingStyle(
  domainType: DomainType,
  textBefore: string,
  contextText: string,
  pageTitle: string
): WritingStyle {
  const snippet = `${textBefore} ${contextText} ${pageTitle}`.toLowerCase();
  if (domainType === 'github' || /```|function\b|class\b|interface\b|const\s+/u.test(textBefore)) {
    return 'technical';
  }
  if (domainType === 'gmail' || /dear\s|regards|best,/u.test(snippet)) {
    return 'formal';
  }
  if (
    /😊|😄|lol|haha|！|！/u.test(textBefore) ||
    /(よろしく|ありがとうございます)/u.test(textBefore)
  ) {
    return 'casual';
  }
  if (/story|once upon|imagine|描写/u.test(snippet)) {
    return 'creative';
  }
  return 'neutral';
}

function detectFormContext(domainType: DomainType, textBefore: string, pageTitle: string): string {
  const lower = textBefore.toLowerCase();
  if (domainType === 'gmail' || /subject:\s|dear|regards/u.test(lower)) {
    return 'email-compose';
  }
  if (
    domainType === 'github' ||
    /pull\s+request|issue\s+#|bug\s+report/u.test(lower) ||
    /pull request|issue/u.test(pageTitle.toLowerCase())
  ) {
    return 'code-review';
  }
  if (/meeting notes|agenda|action items/u.test(lower)) {
    return 'meeting-notes';
  }
  if (/todo\s*:|steps\s*:|first,\s|next,\s/u.test(lower)) {
    return 'task-list';
  }
  return 'general';
}

function inferPreferredLength(
  currentParagraph: string,
  writingStyle: WritingStyle
): 'short' | 'medium' | 'long' {
  const sentences = splitSentences(currentParagraph);
  const words = currentParagraph.trim().split(/\s+/u).filter(Boolean);
  const avgLength = words.length / Math.max(sentences.length, 1);
  if (avgLength < 8) return 'short';
  if (avgLength >= 18 || writingStyle === 'technical') return 'long';
  return 'medium';
}

function extractTopics(text: string, language: string): string[] {
  const counts = new Map<string, number>();

  collectCounts(
    (text.match(/[A-Za-z][A-Za-z0-9_-]{2,}/gu) ?? [])
      .map((token) => token.toLowerCase())
      .filter((token) => !EN_STOPWORDS.has(token)),
    counts
  );

  const japanese = (
    text.match(/[\p{Script=Hiragana}\p{Script=Katakana}ー]{2,}|[\p{Script=Han}]{1,}/gu) ?? []
  )
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !JA_STOPWORDS.has(token));
  collectCounts(japanese, counts);

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .filter((word, idx, arr) => arr.indexOf(word) === idx)
    .slice(0, 5);

  if (sorted.length === 0 && language.toLowerCase().startsWith('ja')) {
    return japanese.slice(0, 3);
  }
  return sorted;
}

function collectCounts(tokens: string[], counts: Map<string, number>): void {
  tokens.forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
}

function buildContextWindow(before: string, after: string): string {
  const left = normalizeWhitespace(before.slice(Math.max(0, before.length - 200)));
  const right = normalizeWhitespace(after.slice(0, 140));
  return `${left}[CURSOR]${right}`.trim();
}

function summarizeContext(contextText: string, pageTitle: string): string {
  const normalized = normalizeWhitespace(contextText);
  if (!normalized) return pageTitle;
  const sentences = splitSentences(normalized);
  const summary = sentences.slice(0, 2).join(' ');
  if (!summary) return pageTitle;
  const combined = pageTitle ? `${pageTitle}: ${summary}` : summary;
  return combined.slice(0, 240);
}

function detectIntent(textBefore: string, currentParagraph: string): DetectedIntent {
  const combined = `${textBefore}\n${currentParagraph}`.toLowerCase();
  if (/\?\s*$/u.test(textBefore)) return 'question';
  if (/(please|let me know|could you|can you|お手数ですが)/u.test(combined)) return 'instruction';
  if (/(once upon|story|reminded me|i remember|物語|ストーリー)/u.test(combined))
    return 'narrative';
  return 'statement';
}

function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/(?<=[.!?。！？])/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}
