# Development Guide

This document explains how to build, run, test, and contribute to the Chrome AI Text Completion extension.

## Prerequisites

- Node.js 18+ and npm 9+
- Chrome 128+ (with on‑device AI capabilities if you want to test the Chrome AI provider)

## Install

```bash
npm install
```

## Build and Run

This project uses Vite for MV3 (background + popup) and a separate Vite config to build the content script as a single IIFE bundle (required for MV3 content scripts).

- Production build (recommended during development for consistency):

```bash
npm run build
```

This runs two builds:

- `vite build` → background, popup
- `vite build -c vite.content.config.ts` → content (IIFE, no top‑level imports)

### Load the extension

1. Open `chrome://extensions`
2. Toggle “Developer mode” on
3. Click “Load unpacked” and select the `dist` folder

When you re‑build, click the “Reload” button on the extension card to update.

## Dev Watch (optional)

The default `dev` script runs a watch build for the main Vite config. To also watch the content script, you can run a second watcher in another terminal:

```bash
# Terminal A
vite build --watch

# Terminal B
vite build -c vite.content.config.ts --watch
```

You can optionally add `concurrently` if you prefer a single `dev` command.

## Linting and Type Checking

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint (strict rules)
```

The repo enforces strict TypeScript and ESLint rules (no `any`, explicit return types, function size guidelines, etc.). Please keep changes warning‑free.

## Tests

```bash
npm test
```

Vitest + jsdom are configured. Add specs under `tests/` when changing core logic or prompts.

## Project Layout (key files)

- `public/manifest.json` — MV3 manifest (copied into `dist/manifest.json`)
- `src/background/service-worker.ts` — Background service worker (type: module)
- `src/content/index.tsx` — Content script (built to single IIFE `dist/content.js`)
- `src/popup/index.html` — Popup entry
- `src/popup/popup.tsx` — Popup UI (React + Tailwind)
- `src/core/**` — Core logic (AI providers, engine, storage, utils)
- `vite.config.ts` — Build for background + popup
- `vite.content.config.ts` — Build for content (IIFE)

## Providers and Privacy

- Default behavior: Chrome AI (on-device). Users may manually switch to OpenAI if they provide an API key. Do not auto-fallback.
- OpenAI usage is opt-in in the popup settings. The API key is stored in `chrome.storage.local` and never committed to the repo.
- Advanced preferences: `includePromptDebugContext` adds assembled prompt + window to provider input (disabled by default). `completionLanguage` forces Chrome AI output (`auto`, `en`, `ja`, `es`). Keep migrations backward-compatible.

## Content UI and Styling

- The content UI renders inside a Shadow DOM to avoid affecting page styles.
- Tailwind CSS is injected into the Shadow DOM only (`assets/style.css`).
- The extension targets `textarea` and `contenteditable` editing hosts (including Notion).
- Accept shortcuts: `Tab` (textarea) and `Cmd/Ctrl + Shift + Enter` (Notion & other contenteditables). Navigation across multiple suggestions uses `Alt/Option + [` or `Alt/Option + ]`.
- Accepting inserts only the non-overlapping tail of the suggestion so existing text is never duplicated.
- Provider contract: the completion provider returns only the minimal insertion string to place at the caret. It must not echo the existing text, and it may include necessary leading whitespace.
- Prompt heuristics: `src/core/prompt/context-analyzer.ts` computes tone/intent/topic hints used when building the final prompt.

## Completion Behavior

- Trigger timing:
  - On space, Enter, or common punctuation (.,!?;:、。 など)
  - On character keys once the currentトークン長が2文字以上
  - Debounce 200ms + レート制御（`RateLimitedExecutor`）
- Prefetching: `.`, `/`, `Enter`, `(`, and `=>` trigger background `COMPLETION_PREFETCH` without showing UI.
- Warmup: the content script sends `AI_WARMUP_REQUEST` on mount so Chrome AI can prime/download models early.
- Prompt policy (diff only):
  - Responses must be returned as `{"suggestions": [{"text": string}]}` JSON (up to 3 entries). If empty, return `[]`.
  - Maximum insertion length ≈ 50 characters (providers should keep suggestions short and concise).
  - Punctuation policy: Suggest up to the next natural delimiter. If needed, add only one closing punctuation mark. However, if the `After` side starts with punctuation, do not duplicate.
  - Leading whitespace is allowed only when necessary. Trailing spaces are generally prohibited.

- Logs are prefixed with `[AICompletion]`.
- Background logs: `chrome://extensions` → “service worker” link under the extension → Console.
- Content logs: regular DevTools console on the target page.
- Timeout/abort handling: background surfaces `AI timeout` or `AI aborted` errors when the `AbortSignal` fires (10s default). Respect cancellation when wrapping provider calls or adding new middleware.

## Release Checklist

- [ ] `npm run lint` and `npm run typecheck` are clean
- [ ] `npm run build` produces `dist` with `manifest.json`, `background.js`, `content.js`, and `popup/`
- [ ] `npm run package` outputs `artifacts/typemind-extension.zip` for Chrome Web Store upload
- [ ] Manual sanity test on a page with a textarea
- [ ] Update `CHANGELOG.md` and docs as needed
