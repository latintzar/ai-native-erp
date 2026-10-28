> Proposed adoption plan for [Cedar](../app/src/prototypes/cedar/README.md). Apply the selected parts when Peter chooses this direction or a capability from it. Other candidates can solve the same or a different problem. Implementation readiness is recorded separately in [ENGINEERING-READINESS.md](ENGINEERING-READINESS.md).

# THE KIT-TO-PRODUCT PLAN — proposed adoption of Cedar

Peter, 2026-09-05: «Is this in a nice, clean order within the Kit, with the plan of how you would implement it to take it to app.soyrocoto.com? It wouldn't be the actual code of the Kit. It would be a duplicate with a backend hooked up, right? Or a connection… some way that can then be updated in some clean way.»

## Shared frontend and build boundaries
**Adopt selected source into maintained product code.** Cedar lives in
[`app/src/prototypes/cedar`](../app/src/prototypes/cedar), with its HTML entry at [`app/app.html`](../app/app.html).
It is React, Base Web, Styletron and Vite source. The maintained prototype uses fixtures,
browser stores and the separately deployed kit runtime. If adopted, the selected UI and reusable
components move or are extracted into the maintained frontend/shared owners, with explicit product
data/auth/tenant adapters. Preserve the accepted candidate commit and artifact. `runtime-client.ts` supplies a
provider-call seam today; changing its base URL alone cannot replace fixture and browser-store
reads. The adapter work is [#44](omitted-sources.md).

Sharing means source imports within this app. A shared component change affects consumers in the
next build; an already deployed artifact changes only when that environment receives a deployment.
Other repositories consume their own source or an explicit dependency, rather than live-importing
the kit website. The existing customer frontend remains separate until a reviewed product cutover;
[the product map](PRODUCT-MAP.md) locates its retained source and deployment-provenance gap.
The kit runtime stays a separate prototype service (§204.2).

## What is kept from the past, and what is not
| Kept | Why |
|---|---|
| the kit's components, states, copy, drives, specs | the preserved design and its recorded checks; release evidence identifies the surfaces and widths exercised |
| PRODUCT-SPEC and the backend | the runtime and its spine; THE-AI-SPEC points at them |
| the backend's API and tables | reused where current contracts and integration tests establish the required behaviour |
| FEED-IA, the RELEASE records | the record of decisions; read-only |

| Not kept | Why |
|---|---|
| The earlier customer screens, historically `webapp/src` | A selected replacement can supersede these at an explicit cutover; retained source and existing deployment are mapped in [PRODUCT-MAP.md](PRODUCT-MAP.md). |
| the kit's theatre runtime (`mock-api/`) | separately deployed prototype service; stays with the kit rather than folding into the product runtime |
| the kit's fixtures as data | the product build reads the API |

## The order of work
1. **The adapters.** Inventory fixture, browser-store and provider reads. Define explicit design and product data adapters; `runtime-client.ts` is the existing provider-call seam, not the complete data layer. Product routes supply the contracted shapes with tenant/auth enforcement (THE-RUNTIME-SPEC lists prototype calls; THE-AI-SPEC §2 defines the product runtime behind them). Contract tests cover both adapters.
2. **The selected source.** For a whole-candidate adoption, move the selected UI into the ordinary maintained product frontend when creating that build. For a feature adoption, extract only the chosen implementation into its product/shared owner. Retain the accepted Cedar source commit and build artifact; any continued prototype imports the explicitly shared components and keeps its own fixtures and stub. The maintained frontend uses product API/auth/tenant adapters and acquires no implicit dependency on prototype stores.
3. **Auth and tenant.** The product build boots from the session (who, which house) instead of the seeded cast; every fixture read becomes an API read, surface by surface, in the order of the feature map in INDEX.md. [THE-AUTH-WIRING-SPEC](THE-AUTH-WIRING-SPEC.md) records the existing auth mechanisms to verify and reuse; [THE-IMPLEMENTATION-SPEC](THE-IMPLEMENTATION-SPEC.md) gives the current account contract.
4. **The data intake and the runtime's owed steps** (THE-AI-SPEC §1–§2) land in the backend; the surfaces already show them.
5. **The Copilot organ** (THE-AI-SPEC §3).
6. **The drives run against the product build** with a seeded tenant at staging.soyrocoto.com.

## For someone arriving from outside
Read [INDEX.md](INDEX.md), the relevant subject spec, THE-AI-SPEC for intelligence work, this plan,
and the applicable release record. The specs are Markdown in `docs/`, versioned with the source in
Git. The public `/product-docs/` site is an earlier generated snapshot; use the repository for
current contracts. Superseded sections identify their successor in place.

## Adopting a selected change while preserving the reference (§209)
1. Explore the change in its named candidate: directive → candidate spec → prototype change → tests/drives → PR → development preview. A different possibility gets a sibling; the shared kit changes only when that is the intended scope. Peter reviews the candidate on his phone. Selection and the adoption plan go in the relevant GitHub issue and release milestone.
2. If the change needs new intelligence or new data, the contract grows first (`runtime-client.ts` — the shape), the intelligence service implements it (THE-AI-SPEC §6), and the kit's design build switches that one call from the theatre to the service. The theatre keeps serving everything the service does not do yet.
3. The product build carries the same screen dark, behind its flag; staging runs the same drives against the service and the real backend.
4. The flag opens per house. The live app shows the new screen; the old screen is gone with the flag.
5. The prototype runtime changes through ordinary PRs and deploys separately. Staging runs the maintained implementation with its own data and sandbox providers; the approved production release follows that integration proof. Maintenance of the existing customer screens stays scoped to that implementation until a selected cutover.
