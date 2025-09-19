# Architecture

## Overview

An event-driven Chrome Extension (MV3) that provides privacy-first, on-device text completion using Chrome AI APIs. It consists of:

- Background Service Worker: orchestrates AI calls and enforces explicit provider choice (Chrome AI vs OpenAI)
- Content Script: detects inputs and renders React suggestion UI (Tailwind)
- Popup: React settings UI backed by `chrome.storage`
- Core modules: AI wrappers, completion engine, prompt heuristics, storage, utils

## Message Flow

1. Content script observes typing and sends `COMPLETION_REQUEST` with context (paragraph, sentence, page metadata)
2. Background runs `CompletionEngine`: cache lookup → context analyzer → prompt assembly → provider request
3. Content script displays overlay Web Component and handles accept/dismiss

## Performance

- Session reuse via `ChromeAIManager`
- Context analyzer (`src/core/prompt/context-analyzer.ts`) extracts tone/intent/topics to improve prompt relevancy
- LRU-like cache for recent prompts
- Debounce + rate-limiting to avoid flooding API
- Vite multi-entry build: background, content, popup
