# 0009 · The bridge repository split
**Date:** 2026-09-07 · **Status:** split retained; general prototype policy revised 2026-09-08

**Current scope:** small trials and throwaway code stay with the product or subject they explore,
in ordinary named folders and task branches. Demo is the shared development/prototype environment;
staging is for integrated product code. A dedicated repository or subdomain follows an actual
independent ownership need. The existing bridge repository is retained; its preview lives at
`demo.soyrocoto.com/albaranes/`. The company
[domain register](../omitted-sources.md)
records each hostname's purpose and environment. Peter's correction is preserved in
[FEED-IA §215](../FEED-IA.md#215).

## Preserved decision and current consequences

The [original 7 September decision](../omitted-sources.md)
records the bridge extraction and the earlier class-based repository/host policy. Its source and
rationale remain in Git history. The general class policy has been replaced by the current scope
above and [the engineering workflow](../ENGINEERING.md#keep-useful-discoveries-and-share-adopted-behaviour).

The bridge retains its existing source history, scoped configuration and deployment. New small
trials stay with their owning product or subject. Reusable discoveries are linked from their
shared contract; adopted implementations acquire explicit consumers and tests before entering
a maintained product build. Repository separation follows independent ownership and deployment
needs. Demo hosts prototype reviews; staging rehearses integrated product changes.

[0010](0010-three-repositories.md) records the product/site/company source split.
[0011](0011-evidence-and-engineering-boundaries.md) records integration and release evidence.
