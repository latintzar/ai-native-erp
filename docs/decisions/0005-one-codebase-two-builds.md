# 0005 · One codebase, two builds; the kit runtime stays theatre
**Date:** 2026-09-05 · **Status:** accepted

## Context
The design lives at kit.soyrocoto.com and the product at app.soyrocoto.com. Peter asked it directly:
«It would be a duplicate with a backend hooked up, right? Or a connection…» A duplicate drifts
within a week; a connection makes the design build wait on the product being up.

## Decision
**Neither: one codebase, two builds.** `app/` is the app, written once to the locked design system.
It builds as the **design kit** against fixtures and the kit runtime, and as the **product** against
the backend with login and tenant; the only seam is `runtime-client.ts`, and both builds carry the
same contract shape. **The kit runtime is theatre for design research**: it never merges, ports or
folds into the product runtime, and it carries no tenant product logic. What crosses is design —
surfaces, contracts, specs, floors — implemented fresh on the product's own spine.

## Consequences
A design change lands once and both builds carry it, and a new capability gets its shape in
`runtime-client.ts` before either side implements it. The cost is discipline at one file: tenant
logic leaking into the kit runtime breaks the arrangement quietly, and decision
[0006](0006-the-kit-runtime-in-production.md) is why that bites.

## Source
[THE-KIT-TO-PRODUCT-PLAN](../THE-KIT-TO-PRODUCT-PLAN.md) (archived at `v0.196.0`) ·
[`docs/FEED-IA.md`](../FEED-IA.md) §204.2 (2026-09-05 afternoon) · [`AGENTS.md`](../../AGENTS.md).
