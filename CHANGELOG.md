# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- Docs: Updated provider policy, context analyzer coverage, and testing guidance.
- Build: Added GitHub Actions workflow running npm typecheck, lint, test, and build on pushes/PRs.

## [0.1.1] - 2025-09-15

- Change: Tab accept now inserts the suggested completion at the caret (replacing any selected text) instead of replacing the entire textarea value.
- Prompt tuning: provider returns minimal insertion only; max ≈ 60 chars; punctuation policy avoids duplication and favors natural boundary.
- Completion timing: triggers on space/Enter/punctuation or when current token length ≥ 3, with 200ms debounce.

## [0.1.0] - 2025-09-13

- Initial scaffold for MV3 TypeScript extension
- Core AI wrappers, completion engine, content UI, popup, and docs
