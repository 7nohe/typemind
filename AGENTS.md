**Purpose**

- This document defines guardrails for agents (AI/automation tools/helper scripts) to safely and consistently contribute to this repository.
- It ensures that development and maintenance preserve the project’s pillars: privacy‑first, maintainability, and performance.

**Principles**

- Privacy first: prefer on‑device processing; only send data externally when the user explicitly opts in.
- Minimal deltas: keep changes scoped and purpose‑driven; respect existing design.
- Type‑safety and static analysis: comply with TypeScript strict mode and ESLint rules.
- Performance: target sub‑200ms responses; avoid redundant work and excessive re-renders.

**Codebase Overview**

- Build: Vite (background/popup) + IIFE build for content
- UI: React + Tailwind (isolated via Shadow DOM)
- MV3: `public/manifest.json` → output `dist/`
- Key entries:
  - Background: `src/background/service-worker.ts`
  - Content: `src/content/index.tsx` (textarea‑only behavior)
  - Popup: `src/popup/popup.tsx` / `src/popup/index.html`
  - Core: `src/core/**` (AI wrappers, completion engine, storage)
  - Session scope helpers: `src/core/completion/session-scope.ts`
  - Prefetch & suggestion utilities: `src/content/prefetch-detector.ts`, `src/content/suggestion-utils.ts`

**Provider Policy**

- Users explicitly choose between Chrome AI (default) and OpenAI. Do not auto-switch without user intent.
- When Chrome AI is unavailable, surface status messaging rather than silently falling back.
- When using OpenAI, the UI must clearly warn that text is sent externally and require explicit opt-in.

**Agent Roles**

- Implementation Agent: adds features/fixes with minimal diffs; opens PRs aligned with design.
- Reviewer Agent: checks guardrails, type‑safety, lint, build.
- Docs Agent: updates README/Docs and examples, reflecting changes.

**Suggested Workflow**

- 1. Clarify goals: confirm acceptance criteria in bullet points
- 2. Design notes: affected areas, public API changes, perf/privacy impacts
- 3. Implement: minimal, focused changes under `src/**`
- 4. Types/Lint: `npm run typecheck && npm run lint`
- 5. Build: `npm run build` (content is also built as IIFE)
- 6. Tests: `npm test` (add/adjust as needed)
- 7. Docs: update README/Docs/CHANGELOG appropriately

**Guardrails**

- Do not (without proposal/approval):
  - Expand MV3 permissions/host permissions.
  - Add tracking/analytics that send data externally.
  - Inject global CSS (to avoid breaking pages); keep UI in Shadow DOM.
- When changing code:
  - Content script must be IIFE (`dist/content.js`) with no top‑level imports.
  - Inject Tailwind only inside the Shadow DOM via `<link>`.
  - Completion providers must honour the structured response contract: return JSON with `suggestions: [{ text: string }]`, up to 3 entries. The engine will fall back to rank raw text but JSON keeps analytics consistent.
- Target text inputs safely: support `textarea` and contenteditable editing hosts (`src/content/text-detector.ts`).
  - Tab accept inserts the completion at the caret without replacing the entire textarea (`src/content/index.tsx`).
  - Abort signals are now plumbed through the engine—always propagate `AbortSignal` when adding async layers to avoid leaks.

**Coding Standards**

- TypeScript strict; explicit return types; no `any`.
- ESLint as configured in `.eslintrc.json` (function size guidelines apply).
- Minimize side effects; do not break public APIs or data contracts.
- Preferences now include `includePromptDebugContext` and `completionLanguage`; ensure new fields remain backward-compatible with stored `chrome.storage.local` shape.

**Build/Run**

- Install deps: `npm install`
- Types/Lint: `npm run typecheck` / `npm run lint`
- Production build: `npm run build`
  - Vite: background + popup
  - IIFE: `vite.content.config.ts` builds content to a single file
- Tests: `npm test`
- Load in Chrome: load `dist` via `chrome://extensions` → “Load unpacked”

**Security & Privacy**

- Do not commit API keys. OpenAI keys are stored in `chrome.storage.local` (local only).
- OpenAI usage must be clearly disclosed in the popup settings (`src/popup/popup.tsx`).
- Use `src/utils/logger.ts` for logs; never include personal data.

**UI/UX Guidelines**

- Overlay UI is isolated in Shadow DOM; positioned near the caret.
- Accessibility: proper roles/labels, Esc to dismiss, Tab to accept.
- Do not mutate the page DOM beyond adding a host `<div>`.
- Completion timing: trigger on space/Enter/common punctuation, or when the current token length ≥ 2 characters; keep 200ms debounce.
- Accept shortcuts: textarea → `Tab`; other contenteditable hosts → `Cmd/Ctrl + Shift + Enter`. Multi-suggestion navigation uses `Alt/Option + [` and `Alt/Option + ]`.
- Overlay shows loading when suggestions are pending; avoid UI that flashes when `pending` count > 0.

**Performance Guidelines**

- Use 200ms debounce and the rate‑limited executor (`src/core/storage/cache-manager.ts`).
- Cache recent results with TTL and size constraints.
- Prefer prefetching (see `createPrefetchRequest`) on lightweight triggers such as `.`, `/`, `Enter`, `(`, arrow functions (`=>`). Warm up AI sessions via `AI_WARMUP_REQUEST` to reduce first-byte latency.

**Extension Points**

- Providers: `CompletionEngine` supports DI via `provider.prompt()` (`src/core/completion/completion-engine.ts`).
- Context heuristics: `src/core/prompt/context-analyzer.ts` derives tone/intent/topic hints fed into prompt selection; adjust here before touching templates.
- Prompt templates: `src/core/prompt/prompts.ts` and `src/core/prompt/selector.ts` orchestrate assembled instructions.
- Chrome AI: `src/core/ai/prompt-manager.ts` manages session reuse and availability checks.
- OpenAI provider: `src/core/ai/openai-provider.ts` (Chat Completions API).
- Provider output contract: return only the minimal insertion string to place at the caret (no echo, no quotes). Leading whitespace is allowed if necessary for natural spacing.
- Session scope hashing lives in `src/core/completion/session-scope.ts`; reuse helpers instead of ad hoc scopes. Warmup & prefetch messaging uses `COMPLETION_PREFETCH` and `AI_WARMUP_REQUEST` payloads.

**Review Checklist**

- [ ] Minimal, goal‑oriented diff
- [ ] Typecheck/Lint/Build/Tests pass
- [ ] No style leaks outside Shadow DOM
- [ ] Textarea‑only behavior preserved
- [ ] Privacy policy respected (external sends only when opted‑in)

**Troubleshooting**

- Content “Cannot use import statement outside a module” → verify IIFE build (`vite.content.config.ts`).
- `process is not defined` → ensure Vite `define` in config inlines `process.env.NODE_ENV`.
- Popup too narrow → check min‑width classes in `src/popup/index.html`.
- No suggestions → inspect background logs for provider errors and verify on-device model availability.

**Glossary**

- Provider: implementation that generates completions (Chrome AI or OpenAI).
- Shadow DOM: container used to isolate UI styles from the page.
