# API

## Types

- `CompletionRequest` — input text, cursor position, and context metadata
- `CompletionSuggestion` — ranked insertion candidates returned to the content script
- `CompletionOptions` — provider options (timeouts, session scope, response schema, abort signals)
- `AppMessageType` — `'COMPLETION_REQUEST' | 'COMPLETION_PREFETCH' | 'SETTINGS_UPDATE' | 'UI_STATE_CHANGE' | 'AI_WARMUP_REQUEST'`
- `WarmupRequestPayload` — `{ phase: 'availability' | 'activate'; scope?: string }`

## Core Modules

- `ChromeAIManager` — session lifecycle for Prompt API; maintains per-scope caches and abort guards
- `OpenAIProvider` — OpenAI Chat Completions wrapper with abort wiring and timeout normalization
- `CompletionEngine` — builds prompts, caches, applies structured response schema, ranks up to 3 suggestions
- `session-scope` — hashes URL/title into a stable `scope` used for session reuse and warmup
- `prefetch-detector` — determines when to issue speculative background requests from keystrokes
