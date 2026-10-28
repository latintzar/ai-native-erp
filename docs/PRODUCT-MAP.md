# Product versions and sources

This reference records version relationships and evidence. The subject’s source and specification
remain the working context. Last inspected: 2026-09-09.
Validate the relevant row against the current tree and deployment before acting.

`app.soyrocoto.com` is an earlier app deployment. The maintained prototype at
`kit.soyrocoto.com/app.html` is the [Cedar candidate](../app/src/prototypes/cedar/README.md):
[app/app.html](../app/app.html) loads its React source. Peter may keep exploring it or choose another direction;
adoption, wiring and replacement require that later decision. Demo previews
the prototype; staging runs the product backend with its own database. Its frontend is reserved
for the wired product build. A published address establishes deployment, not a live customer product.
The migration organizes existing source, proposed designs, documentation and environment ownership.
Wiring and completing proposed product architecture are separate work packages.

Product alternatives are siblings under `app/src/prototypes/`, with stable codenames and revisions
in Git. Multiple candidates can explore the same market, a different problem or a different
interaction model. They share the kit and explicitly selected capabilities; each owns its proposal.

| Subject | Intended behaviour | Prototype / source | Existing implementation and limits |
|---|---|---|---|
| Earlier app frontend | Existing published experience; the current request determines whether to maintain, explore or replace it. Kit contracts describe one candidate successor | [`v0.196.0`, `apps/rocoto/product/webapp`](omitted-sources.md) preserves the recorded base source at `22a49151`, including its sibling `packages/rocoto-tokens` and Android theme/font dependencies. | `app.soyrocoto.com` belongs to Vercel project `rocoto-app`. Its deployment metadata records a prebuilt upload with `gitDirty=1`; exact correspondence between preserved base source and deployed artifact remains unproven. Establish that provenance before reproducing or changing the deployment. Its predecessor routing describes existing behaviour; source migration alone selects neither rerouting nor replacement. |
| Cedar: Sales, Products, Customers, Administration | Proposed [system](THE-SYSTEM-SPEC.md), [interaction](THE-INTERACTION-SPEC.md), [implementation](THE-IMPLEMENTATION-SPEC.md) | [Candidate source and ownership](../app/src/prototypes/cedar/README.md), [compatible app entry](../app/app.html), [shared scenario fixtures](../app/src/scenarios); kit.soyrocoto.com/app.html is the earlier published reference; the corrected gallery publisher transitions it to the named `demo.soyrocoto.com/cedar/` build. Check the actual release receipt before assuming that transition is deployed | CI publishes this candidate to demo. Staging accepts the product backend and serves no prototype frontend. The product data adapter is proposed wiring work in [#44](omitted-sources.md); adoption requires a selected scope and its own integration evidence. |
| Cedar Copilot | [AI spec](THE-AI-SPEC.md), [outputs](THE-OUTPUTS-SPEC.md) | [candidate Copilot](../app/src/prototypes/cedar/copilot), [runtime client](../app/src/prototypes/cedar/runtime-client.ts), [kit runtime](../mock-api) | Compare these with backend callers before changing anything called “copilot”. Prototype provider calls establish only their exercised paths. |
| Prototype houses and seed data | Reproducible examples for design and integration proofs; the proposed product adapter supplies customer data | [Scenario cast](../app/src/scenarios/data/cast.ts), [house configuration](../app/src/prototypes/cedar/config.ts), [day fixtures](../app/src/prototypes/cedar/day.ts) | The app loads fixtures and browser state. These are separate from backend tenant records; replacing fixture imports with the product adapter remains [#44](omitted-sources.md). |
| Shared product illustrations | [Implementation §3](THE-IMPLEMENTATION-SPEC.md) describes a growing shared subject/tile index. [Intelligence INTEL-11](THE-INTELLIGENCE-SPEC.md) permits shared asset bytes and presentation-only library visuals; each approved SKU artwork association requires its own SKU/revision-specific review | [Library and maintenance tools](../library/paintings/README.md), [public tiles](../app/public/paintings), [resolver](../app/src/prototypes/cedar/painting-map.ts) | The checked-in library has 794 tiles. Current generation helpers can extend it; prototype artwork requests and the provider adapter do not implement persistent cross-customer library growth. A resolver fallback is presentation evidence, separate from an approved SKU artwork association. |
| Shared vendor integrations | Company-owned accounts and access; each consuming application/environment has explicit configuration | [Vendor bindings](omitted-sources.md), [backend](../backend), [prototype runtime](../mock-api), company [services/access](omitted-sources.md) | Registration, provider-account ownership, implemented adapter, and successful integration are separate evidence. Prototype and backend clients have their existing owners. Extracting shared implementation is later product work when supported consumers and an adopted contract call for it. |
| Cedar commerce and onboarding | [Money](../app/src/prototypes/cedar/MONEY-SPEC.md), [onboarding](../app/src/prototypes/cedar/ONBOARDING-SPEC.md), [payment evidence](../app/src/prototypes/cedar/PAYMENTS-SPEC.md) | [Cedar source](../app/src/prototypes/cedar/README.md), [native supporting API](../app/src/prototypes/copper/README.md), [shared seed manifest](../testdata-cedar.json) | One development experience: sequential setup, pricing enabled/stock disabled defaults, direct Yape/Plin requests, Prometeo bank validation, NubeFact invoicing, Money and Sales crosslinks. Local HTTP/browser proofs exercise persistent requests and receipt propagation. External provider commissioning, wallet reference correlation and real tax acceptance retain their own evidence. [Declared target](../app/src/prototypes/cedar/money-runtime.json) keeps the verified app entry until foundation publication corrections merge. |
| Product runtime and intake intelligence | [AI spec](THE-AI-SPEC.md), [schema](THE-SCHEMA-SPEC.md), [connections](THE-CONNECTIONS-SPEC.md) | Shared UI/fixtures above; contracts describe the target | [Backend guide](../backend/README.md) and generated [architecture](../backend/ARCHITECTURE.md) describe the existing runtime. The target design and existing implementation differ. Integration requires evidence per capability. |
| Operator console and operational alerts | [Console spec](THE-OPERATOR-CONSOLE-SPEC.md) | Compare Cedar's founder surface, the console proposal and maintained backend callers | [ops.py](../backend/ops.py) records durable alerts locally; [#65](omitted-sources.md) retires founder paging in source. The running production version requires its own release evidence. Better Stack health monitoring and a designed operator inbox are separate capabilities. |
| Kit publication and earlier app deployment | The published kit is the current prototype reference; product adoption is a separate decision | [Kit publication](omitted-sources.md) owns the gallery and records the Cedar compatibility transition | [Environment decision](decisions/0008-environments.md) records the old app and kit relationship. Inspect deployment evidence before changing either. The current tag workflow publishes the kit, not the new customer product. |
| Leo / Hermes predecessors | Historical inspiration; current Rocoto contracts above govern Rocoto | Code ownership is outside this repository unless an actual dependency is found | [Repository split](decisions/0010-three-repositories.md) records the boundaries. Verify callers, services and consumers before proposing removal. Their age or their influence on Rocoto is insufficient evidence to delete them. |

## Resolving competing versions

Use Peter's current explicit directive, the applicable accepted decision and current subject spec
to establish intent. Use source, tests and deployment records to establish reality. Resolve
discrepancies from that evidence before escalating; routine implementation and migration choices
belong to the engineer. Ask Peter only when a meaningful choice of intended behaviour, design or
launch scope remains unresolved, and continue independent work. A historical archive can explain
a decision; current specs and acceptance evidence determine whether it remains applicable.

The [documentation index](INDEX.md) locates detailed contracts. [Engineering workflow](ENGINEERING.md)
defines the checks; [readiness](ENGINEERING-READINESS.md) records evidence and remaining product-readiness work.
