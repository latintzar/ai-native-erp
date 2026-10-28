# 0002 · The language model is always Anthropic's
**Date:** 2026-09-05 · **Status:** accepted

## Context
The product calls a language model on every inbound turn, every free-form product line, every
Copilot answer and the whole history intake. A provider choice spreads into prompts, token
accounting, latency budgets and evals, and is expensive to hold in two places.

## Decision
**The LLM is Anthropic's models, always** — Peter, 2026-09-05: «LLM will always be anthropic's
models». THE-AI-SPEC names the provider seam as Anthropic. Which model runs which road is a
configuration value: Opus for the schema and the artwork clause, Sonnet for the synthesiser and the
vision reads, Haiku for the scale-readers and the spoken turn.

## Consequences
One account, one key (`ANTHROPIC_API_KEY`), one seam to stub in tests; model names live in
`backend/config.py`, so a swap is an environment change and an eval run. The one place another
provider appears is the kit runtime's handwriting research road, which reads `GEMINI_API_KEY` —
THE-IMPLEMENTATION-SPEC §5 says it in a line: «the kit's research ran Gemini; the product runs
Claude». The kit is design research (decision [0005](0005-one-codebase-two-builds.md)).

## Source
[`docs/FEED-IA.md`](../FEED-IA.md) §208.10, «Fixed tools: LLM = Anthropic's models, always»
(2026-09-05 night) · [THE-AI-SPEC §6](../THE-AI-SPEC.md) · [THE-IMPLEMENTATION-SPEC §5](../THE-IMPLEMENTATION-SPEC.md).
