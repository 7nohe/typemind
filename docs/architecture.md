# Architecture

## Overview

An event-driven Chrome Extension (MV3) that provides privacy-first, on-device text completion using Chrome AI APIs. It consists of:

- Background Service Worker: orchestrates AI calls and enforces explicit provider choice (Chrome AI vs OpenAI)
- Content Script: detects inputs and renders React suggestion UI (Tailwind)
- Popup: React settings UI backed by `chrome.storage`
- Core modules: AI wrappers, completion engine, prompt heuristics, storage, utils

## Message Flow

1. Content script observes typing and sends `COMPLETION_REQUEST` with context (paragraph, sentence, page metadata). Lightweight triggers (`.`, `/`, `Enter`, `(`, `=>`) issue `COMPLETION_PREFETCH` messages, and page load fires an `AI_WARMUP_REQUEST` to prime the model.
2. Background runs `CompletionEngine`: cache lookup → session scope hashing (`deriveSessionScope`) → context analyzer → prompt optimizer → provider request (structured JSON schema + abort wiring).
3. Content script displays overlay Web Component, cycles up to 3 suggestions, handles accept/dismiss, and surfaces provider notices (e.g., OpenAI opt-in).

## Performance

- Session reuse via `ChromeAIManager` with per-page session scopes (`deriveSessionScope`)
- Keystroke prefetch + AI warmup reduce first-token latency
- Context analyzer (`src/core/prompt/context-analyzer.ts`) extracts tone/intent/topics to improve prompt relevancy
- Structured JSON parsing (max 3 suggestions) with ranking + overlap trimming
- LRU-like cache for recent prompts
- Debounce + rate-limiting to avoid flooding API
- Vite multi-entry build: background, content, popup

## Session Scope & Prefetch

- `src/core/completion/session-scope.ts` hashes URL/title into a stable scope so Chrome AI sessions stay warm per host.
- `src/content/prefetch-detector.ts` recognizes keystrokes for speculative requests; `createPrefetchRequest` queues them with a shared pending counter.
- The overlay consumes pending state to show "Generating…" without flashing empty suggestions.
