# Kit reference material

The shared kit gallery lives in [app/](../../app), with its entry at [app/index.html](../../app/index.html).
The [Cedar candidate](../../app/src/prototypes/cedar/README.md) uses that kit through the compatible
[app.html](../../app/app.html) entry and owns its model, fixtures and runtime client. This directory
holds supporting design material and the earlier implementation graph.

- [Current product specifications](../INDEX.md): Markdown versioned with the application in Git.
- [Kit-to-product plan](../THE-KIT-TO-PRODUCT-PLAN.md): proposed adoption of selected Cedar source with product data/auth adapters.
- [AI spec](../THE-AI-SPEC.md) and [implementation spec](../THE-IMPLEMENTATION-SPEC.md): the intended
  intelligence and wiring proposal for Cedar.
- [Published kit reference](https://kit.soyrocoto.com/app.html): the separate publication recorded
  in [RELEASE-196](../omitted-sources.md); [readiness](../ENGINEERING-READINESS.md) records provenance.
- [Published product docs](https://kit.soyrocoto.com/product-docs/): an earlier generated snapshot.
  The repository index above supplies current contracts.

## Contents

| Path | Role |
|---|---|
| [GLOSSARY.md](GLOSSARY.md) | Product and trade terminology. |
| [SCENARIOS-METHOD.md](SCENARIOS-METHOD.md), [BRIEF-ORIGINAL.md](BRIEF-ORIGINAL.md), [INVENTORY.md](INVENTORY.md) | Design method, original brief and dated inventory. |
| [LICENSES-AND-ATTRIBUTION.md](LICENSES-AND-ATTRIBUTION.md) | Reference attribution. |
| [specs/intelligence/v1/](specs/intelligence/v1), [specs/output/v1/](specs/output/v1) | Versioned schema artifacts; check their callers and current subject contract when changing them. |
| [specs/taskgraph/v1/](specs/taskgraph/v1) | Historical task/control/journey/evidence inventory. Its old canonical labels, scope, paths and statuses describe that snapshot. |
| [scripts/](scripts) | Historical E181 reconciliation scripts tied to that inventory. |

The archived [wiring tasklist](../omitted-sources.md) renders the earlier graph.
Current implementation work follows subject specs and GitHub issues. App development and
verification commands live in [app/README.md](../../app/README.md) and the root Makefile.

## Retired documentation publisher

On 2026-09-07 the obsolete `tools/build_product_docs.py`, its exclusive deep-link checker and
`tools/product_docs_assets/` were removed. The generator expected the pre-migration directory
structure, and the current build, CI, tests and publisher had no callers. Its source remains in
[Git history at 99e5169685c4cd45f6c4a241d79a37e9843b1322](../omitted-sources.md).
The historical graph and release records retain their original references for provenance.

The completed `tools/reconcile_e182.py` migration was also retired; its last source is in Git at
`42d27ccc`. Replaying it would apply old directives to a directory structure replaced by this one.

Published `/product-docs/` files remain the earlier snapshot. The kit publisher preserves their
existing manifest; this retirement changes no deployed files. A future documentation site can
publish current Markdown through a tested build without reviving the old graph as product authority.
