# Chrome AI Text Completion Extension

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

> Privacy-first text completion powered by Chrome's built-in AI (Gemini Nano)

## Features

- 🔒 Complete Privacy: On-device by default; OpenAI requires explicit opt-in
- ⚡ Fast: Sub-200ms response time target with offline capability
- 🌍 Universal: Works on any website with text input fields
- 🎯 Context-Aware: Heuristic analyzer feeds tone/intent/topic signals into prompt selection
- 🔁 Multi-Suggestion Overlay: Cycle through up to three completions without leaving the keyboard
- 🛠️ Developer-Friendly: TypeScript + Vite + React + Tailwind
- 🚀 Prefetch & warmup: keystroke-driven prefetch queues and session warmups reduce first-byte latency

## Quick Start

### Installation (from source)

1. Install dependencies

```bash
npm install
```

2. Build the extension

```bash
npm run build
```

3. Load in Chrome

- Open chrome://extensions
- Enable "Developer mode"
- Click "Load unpacked" and select the `dist` folder

### Usage

1. Click on any text field
2. Start typing to see AI-powered suggestions
3. Accept with the shortcut that matches your editor:
   - `Tab` in textareas (default web inputs)
   - `Cmd/Ctrl + Shift + Enter` in other contenteditables
4. Cycle through suggestions with `Alt/Option + [` and `Alt/Option + ]`
5. Press `Esc` to dismiss or open settings via the extension popup (choose Chrome AI or OpenAI)

> ℹ️ **First time setup:** Chrome AI APIs require experimental browser flags. Follow [the usage guide](docs/usage.md) to enable the necessary flags and verify the on-device model before loading the extension.

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Lint
npm run lint

# Watch build (rebuilds to dist/ on change)
npm run dev

# Production build
npm run build

# Run unit tests (Vitest)
npm test

# Production build
npm run build
```

Continuous integration (GitHub Actions) runs typecheck, lint, tests, and build on every push and pull request.

## Architecture

Built with modern web technologies:

- TypeScript 5.0+
- Chrome AI Prompt API (session reuse via `ChromeAIManager`)
- React + Tailwind for UI (Popup + Content overlay)
- Manifest V3 Service Worker
- Bundled with Vite (multi-entry)

See docs/architecture.md for detailed design decisions.

## Contributing

We welcome contributions! Please read CONTRIBUTING.md and CODE_OF_CONDUCT.md.

## License

Apache 2.0 - see LICENSE.
