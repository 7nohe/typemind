# Chrome AI Text Completion Extension

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

> Privacy-first text completion powered by Chrome's built-in AI (Gemini Nano)

## Features

- 🔒 Complete Privacy: On-device by default; OpenAI requires explicit opt-in
- ⚡ Fast: Sub-200ms response time target with offline capability
- 🌍 Universal: Works on any website with text input fields
- 🎯 Context-Aware: Heuristic analyzer feeds tone/intent/topic signals into prompt selection
- 🛠️ Developer-Friendly: TypeScript + Vite + React + Tailwind

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
3. Press `Tab` to accept or `Esc` to dismiss
4. Customize settings via the extension popup (choose Chrome AI or OpenAI)

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
