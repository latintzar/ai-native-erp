# Cedar — Rocoto app prototype

Start with the [Cedar product architecture](PRODUCT-SPEC.md): business setup → conversations → orders → Delivery Notes → collection → invoicing and Money. It owns the domain map, shared identities, scenario consistency and connection boundaries. The
[operations hub contract](OPERATIONS-HUB-SPEC.md) owns the current navigation, setup and daily-work refinement. The [live preparation handover](../../../../docs/HANDOFF-CEDAR-LIVE-PREP.md) records the current build, provider proofs, publication and continuation plan.

One possible direction for Rocoto: a configurable workspace for sales, products, customers and
administration. `cedar` identifies this candidate; its market, problem and design can evolve.
Revisions live in Git. Another possibility gets a sibling directory under `src/prototypes/`,
including when it explores the same users or problem. Product adoption is a separate decision.

The “kit app” is this prototype: [app.html](../../../app.html) loads [main.tsx](main.tsx).
Published builds expose `/cedar/` on the development host. `/app.html` and `/` remain development
compatibility entries; source revisions stay in Git. The old kit-hosted entry transitions through
the separately guarded gallery release, after this named development artifact is verified.
[app/README.md](../../../README.md) gives local preview, build and verification commands.
Earlier audits and release receipts refer to this source as `app/src/app/` (or `baseweb/src/app/`
before the repository split); their recorded paths and revisions remain historical evidence.

| Part | Source |
|---|---|
| Candidate UI and behaviour | [App.tsx](App.tsx), [areas](areas), [shell](shell), and the model modules in this directory |
| Candidate fixtures and browser state | [config.ts](config.ts), [day.ts](day.ts), [sale.ts](sale.ts); imports the shared [scenario cast](../../scenarios/data/cast.ts) |
| Prototype provider calls | [runtime-client.ts](runtime-client.ts) and the separately configured [mock-api](../../../../mock-api/README.md); these exercise selected providers, not the proposed tenant backend |
| Yape/Plin collection | [Cedar payment specification](PAYMENTS-SPEC.md) owns the order-to-payment-request and automatic reconciliation flow; the [native collection service](../copper/README.md) supplies its persistent development API |
| Money and seller setup | [Money specification](MONEY-SPEC.md), [money model](money-model.ts), [browser store](money-store.ts), and [Money workspace](areas/money.tsx): Prometeo account data, direct Yape/Plin requests and NubeFact invoicing with scoped fixtures and native HTTP integration |
| Sequential onboarding | [Onboarding contract](ONBOARDING-SPEC.md), [demo entrance](demo-welcome.tsx), [setup flow](cedar-onboarding.tsx); business/channel/catalogue state reuses the workspace models |
| Connected channels | [WhatsApp provider/session](connections/IMPLEMENTATION.md), [Unipile email and document review](EMAIL-IMPLEMENTATION.md) with [email inside Cedar, the hybrid connection](EMAIL-INTEGRATION-SPEC.md), [Twilio/Deepgram phone](PHONE-IMPLEMENTATION.md) with [phone inside Cedar, the hybrid connection](PHONE-INTEGRATION-SPEC.md), and [call interactions](CALL-UX.md); shared private access and explicit provider proof |
| Shared kit | [components](../../rocoto), [theme](../../rocoto-theme.ts), and [gallery](../../kit); the gallery's app-primitives pages demonstrate Cedar-owned components |
| Shared illustrations | [public tiles](../../../public/paintings) and [library maintenance](../../../../library/paintings/README.md); [painting-map.ts](painting-map.ts) is this candidate's resolver |
| Founder design input | Peter's [original situations brief, 21 August 2026](../../../../docs/kit/BRIEF-ORIGINAL.md), followed by the recorded directives in [FEED-IA](../../../../docs/FEED-IA.md) |
| Design and proposed implementation | [System](../../../../docs/THE-SYSTEM-SPEC.md), [interaction](../../../../docs/THE-INTERACTION-SPEC.md), [AI](../../../../docs/THE-AI-SPEC.md), [implementation](../../../../docs/THE-IMPLEMENTATION-SPEC.md), [adoption plan](../../../../docs/THE-KIT-TO-PRODUCT-PLAN.md) |

These design and wiring documents describe Cedar's proposal. A sibling keeps its own specification,
fixtures and runtime configuration, and can explicitly reuse useful parts. The existing
`rocoto-app-*` browser keys and `rocoto-runtime-base` override belong to this candidate; another
candidate uses its own namespace or isolated origin. A trial can use an account Peter explicitly
selects, including his own account. Company Operations records its actual owner, consuming service,
environment and permitted operations and external effects; credentials stay in the selected consumer's
private configuration. [The workflow](../../../../docs/ENGINEERING.md) covers review and adoption.
The [company roadmap](../../../../docs/omitted-sources.md) connects current
commercial priorities to the work issue where a product capability is selected for adoption.

The current payment exploration belongs to Cedar. The preferred route lets buyers pay with Yape,
Plin or an interoperable flow, with automatic reconciliation to the originating order or document
and a fee-free preference. The payment spec distinguishes this intended Cedar flow from the current
provider harness and records the wiring, provider access and commercial evidence still to establish.

The [declared Money runtime](money-runtime.json) selects the current development/demo API and UI entry.
[Shared fixture lifecycle](fixtures/README.md) owns reproducible seeded records; the data remains
linked to Cedar’s existing customers and Delivery Notes. [Money](MONEY-SPEC.md) records the
UI → API → persistent evidence → provider boundaries. Rocoto subscription billing remains separate.

The [September workspace refinement](../../../../docs/omitted-sources.md) records the category hierarchy, two-step setup, phone/chat interactions and durable WhatsApp intake.

The [live preparation release](../../../../docs/omitted-sources.md) records Prep, country controls and the simplified disconnected call entry.

## Development build receipts

Build the publishable artifact after committing the reviewed source: `npm run build:app-en`
records the checkout's current commit in `cedar/prototype.json`. One command produces both
entries — `/cedar/` in English and `/cedar/es/` in Castellano, generated from this same source by
the snapshot transform ([Spanish snapshot](../../../Spanish-snapshot.md)) — so the receipt carries
`entrySha256` and `spanishEntrySha256` together and a publication names what was served in each
language. Before packaging, compare that
receipt with `git rev-parse HEAD` and the requested development release commit. The entry hash
must also match the generated HTML. The [product receiver](../../../../docs/omitted-sources.md)
preserves immutable generations; a corrected publication receives a new committed source and
fresh build. After activation, verify the public receipt, served HTML and prototype API code
together. Cedar's native collection service keeps its own declared development artifact and
private state, under the same [owned experience](PRODUCT-SPEC.md).
