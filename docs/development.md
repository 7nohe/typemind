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

## Content UI and Styling

- The content UI renders inside a Shadow DOM to avoid affecting page styles.
- Tailwind CSS is injected into the Shadow DOM only (`assets/style.css`).
- The extension targets `textarea` and `contenteditable` editing hosts.
- Accepting a suggestion with Tab inserts the completion at the current caret position (replacing any selected text) and moves the cursor to the end of the inserted text.
- Provider contract: the completion provider returns only the minimal insertion string to place at the caret. It must not echo the existing text, and it may include necessary leading whitespace.
- Prompt heuristics: `src/core/prompt/context-analyzer.ts` computes tone/intent/topic hints used when building the final prompt.

## Completion Behavior

- Trigger timing:
  - On space, Enter, or common punctuation (.,!?;:、。 など)
  - On character keys once the currentトークン長が3文字以上
  - Debounce 200ms + レート制御（`RateLimitedExecutor`）
- Prompt policy（差分のみ）:
  - 最大挿入長 ≈ 60 文字（プロバイダは短く簡潔に）
  - 句読点方針: 次の自然な区切りまでを推奨。必要なら閉じ句読点を1つだけ付与。ただし `After` 側が句読点で始まる場合は重複禁止。
  - 先頭空白は必要なときのみ許容。末尾スペースは原則禁止。

## Debugging

- Logs are prefixed with `[AICompletion]`.
- Background logs: `chrome://extensions` → “service worker” link under the extension → Console.
- Content logs: regular DevTools console on the target page.
- Timeout handling: If you see `On-device AI timed out.`, the Chrome on-device model did not respond within the budget. This is logged at `debug` level to avoid noise. You can increase the timeout in `src/background/service-worker.ts` (`responseTimeout`) or switch provider to OpenAI in settings.

## Release Checklist

- [ ] `npm run lint` and `npm run typecheck` are clean
- [ ] `npm run build` produces `dist` with `manifest.json`, `background.js`, `content.js`, and `popup/`
- [ ] Manual sanity test on a page with a textarea
- [ ] Update `CHANGELOG.md` and docs as needed
