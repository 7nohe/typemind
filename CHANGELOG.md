# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-09-20

- Initial release: MV3 TypeScript extension scaffold with background service worker, content overlay, popup UI, and core AI wrappers.
- Completion engine: structured JSON response contract (≤3 suggestions), per-page session scopes, abort-aware prompting, and trimmed minimal insertions that honor punctuation rules.
- UX: Overlay cycles through multiple ranked suggestions, surfaces provider notices, and supports editor-specific accept shortcuts (`Tab` for textareas, `Cmd/Ctrl + Shift + Enter` for Notion/contenteditables).
- Performance: Keystroke-driven prefetcher, AI warmup messaging, 200ms debounce, and rate limiting reduce first-token latency while preserving cache efficiency.
- Settings & docs: Added `Completion Language` selector, `Include prompt debug context` toggle, and refreshed README/AGENTS/development guides to cover the new behaviors.
