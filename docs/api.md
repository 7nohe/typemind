# API

## Types

- `CompletionRequest` — input text, cursor position, and context metadata
- `CompletionSuggestion` — text and confidence score

## Core Classes

- `ChromeAIManager` — session lifecycle for Prompt API
- `CompletionEngine` — builds prompts, caches, ranks suggestions
- `WriterService` — optional Writer API with fallback prompt template
- `RewriterService` — optional Rewriter API with fallback prompt template
