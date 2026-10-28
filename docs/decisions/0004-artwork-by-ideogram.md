# 0004 · Artwork is painted by Ideogram, in the library's own style
**Date:** 2026-09-05 · **Status:** accepted

## Context
Every product in the app carries a painted tile, and one locked prompt is why 794 paintings look
like one library. A house uploads its own catalogue, most of it already painted; the rest has to be
painted on the spot and still belong.

## Decision
**Ideogram paints, and the library's own prompt is the style.** A product arrives — typed, imported,
or read off a sheet — and the library is asked by name: a tile that exists is served; a tile that
does not is generated through the API with that same locked prompt, stored, and served from then on.
**The subject clause is written by a model**: Claude Opus writes it in the library's clause grammar
(«a single raw red prawn, a deep scarlet shell with long fine antennae and a curled tail») from the
product's name, sort and form; the locked prompt wraps it, and Ideogram paints.

## Consequences
The style holds by construction: the prompt is locked and the clause follows a grammar, so nobody
writes a per-image description. Each new painting joins the central index, so the library grows with
every house that arrives. `IDEOGRAM_API_KEY` is the credit it spends, `ARTWORK_SHARED_SECRET` the
house saying who may spend it; with either absent, health answers «awaiting key».

## Source
[`docs/FEED-IA.md`](../FEED-IA.md) §202.1, §202.8 (2026-09-05 morning), §208.10 · [THE-OUTPUTS-SPEC](../THE-OUTPUTS-SPEC.md) · [`mock-api/deploy/env-names.txt`](../omitted-sources.md).
