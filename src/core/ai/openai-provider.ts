import type { CompletionOptions } from '../../types/completion.d';
import type { AIConfig } from './prompt-manager';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionsResponse {
  choices: Array<{
    message: ChatMessage;
  }>;
}

export class OpenAIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = 'gpt-4o-mini'
  ) {}

  async prompt(text: string, aiConfig: AIConfig, options?: CompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is missing');
    }
    const controller = new AbortController();
    const timeoutMs = options?.responseTimeout ?? 5000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body = {
        model: this.model,
        messages: [
          ...(aiConfig.systemPrompt ? [{ role: 'system', content: aiConfig.systemPrompt }] : []),
          { role: 'user', content: text },
        ],
        temperature: aiConfig.temperature,
        max_tokens: aiConfig.maxTokens,
      } as const;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`OpenAI error: ${res.status} ${msg}`);
      }
      const json = (await res.json()) as ChatCompletionsResponse;
      const content: string | undefined = json.choices?.[0]?.message?.content;
      if (!content) throw new Error('OpenAI: empty response');
      // Preserve leading whitespace; trim only trailing whitespace/newlines.
      return content.replace(/\s+$/u, '');
    } finally {
      clearTimeout(timeout);
    }
  }
}
