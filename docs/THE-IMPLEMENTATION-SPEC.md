# THE IMPLEMENTATION SPEC — the product, function by function, in the order a person meets it, literally how it will be

**Scope:** proposed implementation of [Cedar](../app/src/prototypes/cedar/README.md), when selected
for adoption. This plan preserves that candidate's design intent; other candidates keep their own
specification and can adopt individual capabilities without adopting the whole direction.

Peter, §208: «i have no idea if the repo and spec etc is actually good and if it's actually gonna achieve what kit app.html promises … implementation is gonna FUCK UP if we do it otherwise.» This document is the answer: one walk from creating the account to the history upload, each function with the surface (the kit), the runtime road, the tool we will literally use, what is stored, what is learned, and how it is proven. Where a spec already answers, this points at it; where a decision was open, this closes it. Tools fixed by §208.10: LLM = Anthropic, always · image generation = Ideogram · OCR = chosen below. The kit's runtime is theatre (§204) and appears here only as the stand-in each road is proven against.

**How to read a row.** Person → Surface (kit) → Runtime → Tool → Stored → Learned → Proof. A cell that says «spec» names the section that already holds the full contract.

## 0 · The spine every row rides
- **One log, one scope.** Every act is an event in `events` ([PRODUCT-SPEC §3](omitted-sources.md)), scope-keyed by tenant with Postgres row-level security as the second wall (§12). Nothing is a second pipeline.
- **One provider seam.** Rocoto's backend → Anthropic SDK ([STACK.md](omitted-sources.md)); [backend/brain/llm.py](../backend/brain/llm.py) is the existing structured tool-call helper. Qualify and extend an owned backend seam for the adopted intelligence contract. Haiku for per-message reads, Sonnet for reads that need a whole day or a whole document, Opus for design-time writing (schemas, clauses, templates). No other LLM in the product.
- **One evidence rule.** Every model output carries what it read; the surface shows it beside the number (THE-INTELLIGENCE-SPEC INT-01).
- **One proof discipline.** Design drives exercise the prototype locally or on demo. Contract and integration tests exercise the implemented product runtime against isolated data; staging uses a synthetic tenant and sandbox providers for the integrated product journey. Compare that journey with the accepted prototype reference (THE-KIT-TO-PRODUCT-PLAN). Prototype publication remains on demo.

## 1 · The account, and logging in
| | |
|---|---|
| Person | opens app.soyrocoto.com; one circle: Google sign-in ([PRODUCT-SPEC §17.13](omitted-sources.md) S0); later, the same on the phone |
| Surface | ACT-01 (THE-SYSTEM-SPEC): the onboarding ring without numbers (§196.4), «Next step · Claim the account» |
| Runtime | session auth as today (`sup_api`, session + CSRF), tenant from the session, never from the body; roles per FND-01 |
| Tool | Google sign-in (exists); magic link for the desk (§17.13 S2) |
| Stored | `tenants`, `operators`, `team_members`, `onboarding_progress` |
| Proof | the alta drive: S0 only mandatory; every other step re-enterable from the panel |

## 2 · Connection setup — WhatsApp, email, phone, literally
**Cedar's implemented WhatsApp integration (9 September 2026):** real Embedded Signup,
Business-app coexistence and history are now observed in the Cedar WhatsApp demo. The
[working implementation and full-Cedar integration contract](../app/src/prototypes/cedar/connections/IMPLEMENTATION.md)
owns the actual API, source-to-UX mapping, import and recovery behavior. It supersedes older
forward-only history and fixture-completion assumptions for this Cedar integration. The broader
adoption table below remains proposed product work where its own runtime proof is pending.

The current [Cedar product map](../app/src/prototypes/cedar/PRODUCT-SPEC.md) connects these channels to Sales, Delivery Notes and Money. Its [Unipile email/document](../app/src/prototypes/cedar/EMAIL-IMPLEMENTATION.md) and [Twilio/Deepgram phone](../app/src/prototypes/cedar/PHONE-IMPLEMENTATION.md) implementations now have scoped runtime and browser contract proofs. Peter supplies the remaining credentials after the UX work. These are development implementations; the table below describes maintained-product adoption, including outbound email and automatic order processing beyond the verified source-view capability.

The rule for all three (§17.3): a card with a status, a connect button and a settings drawer; four states only: `no configurado · conectando · conectado (prueba) · conectado (directo)`. One sense, one event: every inbound lands as ONE event on the resolved party's scope; identity resolves by `endpoint(kind, addr)`; an unknown sender is a prospect scope, never a drop.

| Rail | Person | Tool, literally | Runtime road | Stored | Proof |
|---|---|---|---|---|---|
| **WhatsApp** | taps Connect, grants in Meta's Embedded Signup, their own WABA number binds to the tenant (proven 2026-07-28) | Meta WhatsApp Cloud API through Rocoto-owned backend adapters ([existing provider client](../backend/whatsapp_cloud.py)); the shared Rocoto line for houses without a number | webhook → `whatsapp_cloud.py` → junk gate → identity → `events` → the loop (THE-AI-SPEC §2) | `channel_connection`, `channel_number`, `whatsapp_messages` (encrypted, §9) | a test message round-trips on a test WABA in staging; the drive covers the card's four states |
| **Email** | taps «Connect your email» — one door — and picks the method inside: Gmail · Microsoft 365 · the address we give them (§109.1, the kit's connections seat) | **Unipile** (hosted auth for Gmail, Microsoft 365 and IMAP; webhooks on new mail; send-as; attachments as raw MIME) for their own mailbox; our own inbound address (`pedidos+<tenant>@`) through the same parser for the forwarding case | Unipile webhook → `inbound_mail` → the junk gate → identity by sender address → ONE event → the loop; three body shapes land: prose, tabular (attachment or pasted grid → the document reader, §5), link-only (fetched as evidence, never truth) | `channel_connection(kind=email, provider=unipile)`, `inbound_mail`, the thread ids | a mail with a pasted grid becomes a review row with the grid attached; the drive covers connect, the three shapes, disconnect |
| **Phone** | taps Connect, picks the number model (THE-VOICE-CONNECTION-SPEC VOICE-02), sees the four states | **Twilio** (voice, recording dual-channel, the +34 number) — selected Cedar account commissioning follows the scoped phone contract; Deepgram nova-3 for the diarised Spanish transcript | VOICE-05 wiring, VOICE-06 contract, `voice_reply.py` (Anthropic already) | `calls`, `transcript_facts`, recordings per VOICE-21 custody | VOICE-23; deterministic development HTTP/WebSocket/browser proof, then selected provider call proof |
| **Sending** | replies from the app's own chat popup or email thread (THE-OUTPUTS-SPEC OUT-05) | the same rails; WhatsApp through the house's number, email through Unipile send-as | `actions.py` send primitives, gated (§5.0 step 7) | `events` (lane world) | the outbound drive counts one send per act |

Settings live in Administration → Connections (the kit's seat, ADM-01). «Canal caído» is the loudest aviso (§17.23): a down rail is silent lost orders.

## 3 · Products — how they are used, tagged, painted, and how the runtime uses that
| | |
|---|---|
| Person | pastes or uploads the list, or types one product free-form; later reads a supplier's list off a photo (§5) |
| Surface | PRD-01 the sheet with live fields (§196.1), CAT-01 admission, the code alone (§200.1), «Code pending» section (§201), the list with paintings |
| Runtime | **the SKU road:** the free text → **Opus writes the schema** (name · family · kind · sort · form · unit · pack · tags, in the catalogue's ontology, THE-CATALOGUE-CONTRACT-SPEC) → deterministic validators (unit known, pack factor, family exists) → the row lands as a proposal (§17.14.5) → **the photo matching**: the schema's subject is looked up in the **central index** (our painted library: today 794 subjects, cross-tenant, the house's names mapped to subjects, painting-map's resolver) → a hit serves the tile → a miss triggers **Opus writing the subject clause** in the library's grammar (§202.8) → STYLE_LOCK → **Ideogram** → normalise → the tile lands and the index grows. Every house's new product grows the library once. |
| Tool | Opus (schema, clause) · Ideogram REST (paint) · the index in Postgres (`catalogue_subjects`, `subject_tiles`, `subject_aliases`), served from object storage |
| Stored | `catalogue_skus` (tenant), `catalogue_directory`, the central index (shared, no tenant data in it: subjects and tiles only) |
| Learned | tags and families from the schema road; the customer's words for a product from §7; the library from every miss |
| How the runtime uses it | the catalogue card (§5.10.1) in every turn; the index for every dropdown; families for the day's paper grouping; tags for the Copilot's answers |
| Proof | the artwork gate (0 of N without a tile); the schema road's fixture tests; drive-197-artwork; a new product typed in staging gets its tile within a minute |

## 4 · Sales and Customers — delivery notes, and making a new albarán
| | |
|---|---|
| Person | Sales: the river by day with flags in red, the day head with its two tiles, the albarán with the row law (§192–§195), «New albarán» with the four doors (photo · file · paste · scan). Customers: the sheet, «Lo que suele pedir», the chat and email inside the app |
| Surface | ALB-01, CUS-01, the kit as published (RELEASE-195) |
| Runtime | an order arrives by any rail → THE-AI-SPEC §2 (detect → one read → validate → predict what is sold → one primary flag → the draft reply → the review sheet or auto-confirm) → `orders`, `order_events`; a new albarán by hand or from a door → the same rows; the customer sheet reads `customer_habits`, `sku_aliases`, `customer_sku_prices` |
| Tool | Anthropic Haiku for the read; the rails of §2 for the reply |
| Stored | `orders`, `order_events`, `open_loop` (tabs), `pending_turn`, `timer` |
| Learned | every accept or correction → aliases, habits, a pattern candidate, a golden pair (THE-AI-SPEC §1 step 6) |
| Proof | the E192–E199 drives against the theatre; the backtest against the golden pairs; the SLO views |

## 5 · Image recognition — foreign paper and our own
**The OCR decision (§208.10: «up to you»): Anthropic vision, deterministic before and after, Parsewise retired from the product.**
- **Our own paper** (the packing list we printed): THE-PAPER-SPEC as built — the manifest recorded at print time, QR + three corner marks, OpenCV registration to the page, per-cell crops, written/untouched by ink floors, then **Claude reads the handwritten cells** with the printed context (the kit's research ran Gemini; the product runs Claude), readings land on the exact line with the crop as evidence. Measured floors: 0.17 mm registration, 100 % classification, 89–100 % values at «half-assed».
- **Foreign paper** (a supplier's albarán, a customer's list, a stock sheet): rectify the page (the same registration code without marks: page detection by contour + deskew), then **one context-rich vision read with Sonnet** filling a fixed form (lines: text · quantity · unit · price; header: supplier · date · number), validated by code (sums, units, dates), graded by the same confidence posture, landing as proposals. Target under 30 s a page; Parsewise's 73–120 s floor is why it goes.
- **The QR** decodes natively where the browser has a detector and by the library road on iOS Safari (E200.09).
| Person | takes a half-assed photo; sees the readings beside the ink; accepts or edits; the lines land |
| Surface | the read-back review (E196.3), the stock photo review, the capture doors |
| Stored | readings as `order_events`; the photo dropped after the read; the manifest by token |
| Proof | tools/paper-harness.py (prints, handwrites, ruins, reads, asserts exact); the foreign-paper corpus with the same harness; both in the runner |

## 6 · Printing — it works
| Person | the day's two tiles (albarán · packing), Preview → the print screen (full-screen on the phone, prev/next, Edit beside the paper), Print |
| Surface | THE-OUTPUTS-SPEC OUT-01–OUT-04 (templates as one architecture; the library; the day's buttons; the print screen), DOC-01 |
| Runtime | the template's layout renders the paper (E200.01: printing never rewrites the house default); the print records the mark and posts the manifest (THE-PAPER-SPEC PAP-02); print activity and confirmations as today |
| Tool | the browser's print (`browser-print.tsx`), A4/A5 |
| Stored | `output_templates` (E200.01's store, then the runtime), the manifest by token, print activity |
| Proof | drive-200-template-model (byte-identical paper for the shipped templates), drive-200-print-screen, drive-196-paper-manifest |

## 7 · Settings and the account — refining how it works
| Person | Administration: Business, Connections, Agent (how Rocoto acts: `behaviour.py`'s vocabulary — doubts · off-list · voice · scope · confirm · custom · calls), Units, Geography, Team, Operations, Plan, Data, Avisos |
| Surface | ADM-01; every setting ships with a working default and says what it is (§17.14) |
| Runtime | `agent_settings`, `behaviour`, `manifest_*`, `doc_prefs`, `aviso_routing`; the Copilot proposes diffs to these (§8) |
| Stored | those tables, every change in `sup_audit` |
| Proof | the admin drives; a settings change reflected in the next turn's assembled context |

## 8 · The Copilot — a CLI over the app, answering in chips
| Person | asks in words; gets chips: chat-minimised pieces of the app (an order row, a template row, a schedule row, a settings diff), each with one tap to apply and an undo |
| Surface | THE-COPILOT-SPEC, E198–E199 as designed (rows not posters; yields beside a priced document) |
| Runtime | **the tool registry = the app's own acts.** Every act a person can take in the UI is a named function with typed arguments (the kit's acts already exist as functions: open, flag, hold, accept, set seat, duplicate template, schedule email, change setting, add product, draft reply). The Copilot's read (Sonnet) returns proposals that name those functions and their arguments; the runtime grounds them (rows must exist in the context), renders each as the same chip the UI would show, and executes only on the tap through the same gates and audit. Templates and email schedules are first-class: «send the packing list to the driver at 06:00 on delivery days» becomes a schedule chip. Chat replaces a node-based builder because the acts are the nodes. |
| Tool | Anthropic Sonnet; Haiku for the cheap decider |
| Stored | sessions (`agent_tasks`), proposals, `sup_audit`; no customer drawer |
| Proof | the grounding tests (every proposal names rows in context; nothing applied without the tap); a registry test that every UI act has its function and every function has its chip |

## 9 · Their messages — encrypted, tamper-evident, and usable to learn
- **In transit:** TLS everywhere (Caddy); webhooks signature-verified before anything is read (§12).
- **At rest:** the box's disks encrypted (LUKS on the Hetzner volume); message bodies, transcripts and attachments encrypted per tenant at the column level (libsodium secretbox, a per-tenant data key wrapped by a master key held only in the runtime's environment, rotated on schedule); Postgres row-level security by tenant as the second wall.
- **Tamper-evident:** the event log is append-only by construction (no UPDATE/DELETE grants on `events`); each event carries the hash of the previous event on its scope (a hash chain); a nightly Merkle root over the day's events is written to a separate store (object storage with object lock) and to the tenant's data page, so any edit of history is detectable. Backups nightly (`pg_dump`, encrypted) with a monthly restore drill into a scratch database (THE-AI-SPEC §1 refinement 8).
- **Learning from it without leaking it:** per tenant, everything (aliases, habits, golden pairs) — the house's own model. Across tenants, only what carries no house or customer: the central product index (subjects, clauses, tiles), the detection bank's generic patterns (order verbs, unit words, corrections) contributed as anonymised pattern candidates, and aggregate accuracy stats. The DPA (`legal/` in [Rocoto-Labs/company](omitted-sources.md)) states this; a tenant's raw messages never train anything shared. Retention per THE-RUNTIME-SPEC and VOICE-21.

## 10 · The final boss — ingesting their history, at that scale
**What arrives:** a CSV or Excel export of orders or delivery notes (one or two years, hundreds of customers, tens of thousands of lines), invoices as PDFs, and WhatsApp exports per customer. «Crazy data» is small for Postgres and large only for a model; so the pipeline is deterministic wherever it can be and batched where it must read.

**The pipeline, step by step (batch, resumable, idempotent by file hash):**
1. **Land** the file → `ingest_queue` (hash, kind, size, status). A file lands once; re-upload is a no-op.
2. **Parse** deterministically: CSV/Excel by header mapping (a small mapping read by Haiku once per file to name the columns: customer · date · product text · quantity · unit · price · document); PDFs through §5's reader; chat exports by the chat parser. Rows → `deliveries_history` (raw, one row per line, with the source file and row number as provenance).
3. **Normalise** by code: names folded, dates to delivery days, units to base units, customers resolved by phone then name (unresolved → a proposal, not a guess).
4. **Resolve products to the catalogue.** First the index (exact code, exact name, alias); the leftover product texts, deduplicated (a two-year export of one house has a few hundred distinct texts, not tens of thousands), go through **one batched Sonnet read** (the Anthropic Batch API: asynchronous, half price) mapping each distinct text to a catalogue row or «new product» with a schema per §3; the house confirms the new ones as proposals.
5. **Align messages to deliveries** where a chat export exists: per customer per day, one batched read → `golden_pairs` (THE-AI-SPEC §1 step 4). No chat export → the delivery rows alone still feed everything below except the wording.
6. **Derive, by SQL, per customer and per product** — this is what we learn, and it is history attached to the product as much as to the customer:
   - per customer × product: first and last order, count, typical quantity and unit, the day-of-week rhythm, the usual bundle (`customer_habits`, order groups);
   - per product: the season curve (weekly volume across the year), the price history, the variants that co-occur (a product that stops while another starts — a substitution, recorded as a pair with its date);
   - per customer: the window, the tariff, the drift (a customer whose volume fell);
   - the tenant's calendar: delivery days, holidays inferred from gaps.
   These are the rows the runtime reads at message time and the Customers sheet shows as «Lo que suele pedir» and «what changed».
7. **Propose, never write silently:** assignments, aliases, groups, new products, merges — accepted in bulk on the Historial surface (§17.21), one screen per kind.
8. **Measure:** the backtest (THE-AI-SPEC §2) runs on the uploaded history the moment it lands: the house sees its own number before going live.

**Scale, honestly:** 100,000 lines parse in minutes on the box; a few hundred distinct product texts cost one batched read; alignment costs one read per customer-day with a chat export, batched overnight. No model is trained; the «machine learning» is the rows above plus the reinforcement loop (ORDER-BRAIN L5). Seasons and substitutions are SQL over `deliveries_history` with a nightly refresh, shown as sentences with their evidence («Gamba roja: 40 % less in August for three years»).

## 11 · Anything else — what would bite implementation if unsaid
- **Staging.** A seeded tenant on the real backend (the kit's cast) where every drive runs before production. Without it, nothing above is proven end to end.
- **Feature flags per surface** for the product build, so the kit's app ships dark and opens by tenant.
- **Spanish is what ships** (§0.11 language law); the kit is English by design; the product build renders the Spanish dictionary the kit already carries, gated by the copy law in both languages.
- **The phone as a device:** the product build is installable (PWA), camera and print through the browser; offline posture per OPS-01.
- **Billing** as specified (§17.10, the seat bands); the alta's zero-charge card step.
- **Observability:** the SLO views (THE-AI-SPEC §1), the journals, an external availability probe; the review inbox for what the runtime hands up.
- **Support and the kill switch:** every rail has a pause in Administration; «Canal caído» reaches the owner by two rails.
- **What needs Peter before implementation:** Anthropic credit, the Twilio account, an Ideogram REST key, a Unipile account, the Meta app's production review for Embedded Signup at scale.

## 12 · The proof that the kit's promise is met
| Promise on app.html | Proven by |
|---|---|
| orders come in by WhatsApp, email and phone and land on one river | the three rails' round-trip tests in staging; one event per inbound |
| the house corrects less every week | the backtest number and the live correction rate, per house, in Stats |
| a half-assed photo of our paper reads back exactly | tools/paper-harness.py floors, pinned |
| the paper prints as configured | drive-200-template-model's byte equality; the print screen drive |
| the Copilot does what the UI does | the registry test: every act ↔ function ↔ chip |
| their data is safe | the hash-chain check, the RLS cross-tenant test, the restore drill |

Nothing here is built until Peter has read it (§203.0). The order of work stays THE-AI-SPEC §9's, with §2 (connections) and §10 (history) as the first two implementation workstreams after the front end lands.
