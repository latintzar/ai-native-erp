# 0003 · Paper is read by Anthropic vision; Parsewise is retired from the product
**Date:** 2026-09-06 · **Status:** accepted

## Context
Two kinds of paper reach the product: the packing sheet this house printed and got back with pen on
it, and a document somebody else printed. Parsewise held the second road at 73–120 seconds a page,
and Peter left the reader open: «for the OCR its up to you».

## Decision
**Anthropic vision reads paper, with deterministic code before and after it.** Our own paper: the
print-time manifest, the QR and three corner marks, registration onto the page, per-cell crops, the
ink floor — then Claude reads the handwritten cells with the printed context, each reading landing
on its exact line with the crop as evidence. Foreign paper: rectify the page, then one context-rich
Sonnet read filling a fixed form (text, quantity, unit, price; supplier, date, number), validated by
code and landing as proposals a person accepts. **Parsewise is retired from the product.**

## Consequences
The target is under 30 seconds a page, against Parsewise's 73–120, and one provider reads both
roads, so the confidence posture and the review surface are shared rather than doubled. The kit
runtime keeps its Parsewise road: its measured floors are the evidence this decision rests on.

## Source
[THE-IMPLEMENTATION-SPEC §5](../THE-IMPLEMENTATION-SPEC.md), «Anthropic vision, deterministic before
and after, Parsewise retired from the product», under [`docs/FEED-IA.md`](../FEED-IA.md) §208.10 ·
[THE-PAPER-SPEC](../THE-PAPER-SPEC.md) · [THE-PARSING-SPEC](../THE-PARSING-SPEC.md).
