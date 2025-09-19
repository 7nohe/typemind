import {
  BUSINESS_COMPLETION_PROMPT,
  CONTEXT_ANALYZER_PROMPT,
  CONTEXT_INTEGRATION_PROMPT,
  CREATIVE_COMPLETION_PROMPT,
  TECHNICAL_COMPLETION_PROMPT,
  SAFETY_PROMPT,
} from './prompts';

export type DomainType = 'github' | 'gmail' | 'social' | 'docs' | 'generic';
export type WritingStyle = 'formal' | 'casual' | 'technical' | 'creative' | 'neutral';

export interface CompletionContext {
  textBefore: string;
  textAfter: string;
  currentSentence: string;
  currentParagraph: string;
  domainType: DomainType;
  pageTitle: string;
  formContext: string;
  writingStyle: WritingStyle;
  preferredLength: 'short' | 'medium' | 'long';
  recentTopics: string[];
  contextWindow: string;
  pageSummary: string;
  detectedIntent: 'statement' | 'question' | 'instruction' | 'narrative';
}

const DOMAIN_MATCHERS: ReadonlyArray<{ type: DomainType; patterns: readonly string[] }> = [
  { type: 'github', patterns: ['github.com'] },
  { type: 'gmail', patterns: ['gmail.com', 'mail.google.com'] },
  { type: 'social', patterns: ['x.com', 'twitter.com', 'facebook.com', 'instagram.com'] },
  { type: 'docs', patterns: ['docs.google.com', 'notion.so'] },
];

export class PromptSelector {
  selectPrompt(context: CompletionContext): string {
    const domainPrompt = this.domainPrompt(context);
    const analyzer = CONTEXT_ANALYZER_PROMPT;
    const contextPrompt = CONTEXT_INTEGRATION_PROMPT.replace('{context}', JSON.stringify(context));
    const safetyPrompt = SAFETY_PROMPT;
    return [domainPrompt, analyzer, contextPrompt, safetyPrompt]
      .filter((p) => p.length > 0)
      .join('\n\n');
  }

  private domainPrompt(ctx: CompletionContext): string {
    if (ctx.domainType === 'github' || /```/.test(ctx.textBefore))
      return TECHNICAL_COMPLETION_PROMPT;
    if (ctx.domainType === 'gmail' || /email|件名|宛先/i.test(ctx.formContext))
      return BUSINESS_COMPLETION_PROMPT;
    if (ctx.domainType === 'social' || ctx.writingStyle === 'casual')
      return CREATIVE_COMPLETION_PROMPT;
    return '';
  }
}

export function detectDomainType(url: string): DomainType {
  try {
    const host = new URL(url).hostname;
    for (const { type, patterns } of DOMAIN_MATCHERS) {
      if (patterns.some((pattern) => host.includes(pattern))) return type;
    }
    return 'generic';
  } catch {
    return 'generic';
  }
}
