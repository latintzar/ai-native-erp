# THE AI SPEC — three parts: data intake · the runtime · the Copilot

**Scope:** proposed intelligence for [Cedar](../app/src/prototypes/cedar/README.md). Backend source
and integration evidence establish what already exists. A sibling candidate chooses its own
proposal and explicitly reuses suitable capabilities; this design alone selects no roadmap work.

The clarity layer over what exists (PRODUCT-SPEC, ORDER-BRAIN-RUNTIME, the backend). Three parts, and they hold everything. Where a thing is already specified, this points at it; where it is missing, this says what it is. Design, not build (§203, §204). The kit's runtime is theatre and is not in here.

```
DATA INTAKE  ──feeds──▶  THE RUNTIME  ──serves──▶  the house (rows, drafts, flags, images)
(what they give us,      (decides on every           ▲
 preprocessed, stored)    message and order)         │ acts on the house's behalf, by proposal
                                                THE COPILOT
```


**Peter's stream, stated once (§209).** The runtime is trained by two intakes and only two: **the SKU intake** (the catalogue: each product's schema, units and packs, its names, its painting from the central index) and **the history intake** (the customer's history: what each customer wrote and what was delivered, turned into aliases, habits, prices, windows, golden pairs). Both are rows. The runtime reads those rows on every message. The Copilot reads the same rows and the day's book. The free-form engine in the UI reads the same rows through the index. One set of rows, four readers. Nothing else is «the AI».

```
THE SKU INTAKE ─┐                     ┌─▶ the turn (every message and order)
                ├─▶ THE ROWS (Postgres) ┼─▶ the UI's fields (index first, a cheap read second)
THE HISTORY ────┘                     ├─▶ the Copilot (proposes, the house applies)
   INTAKE                             └─▶ the paper readers (our paper, foreign paper)
```

## 1 · DATA INTAKE — what the house gives us, how it is processed, where it lives, what it feeds

**What it is.** Everything a house hands over before and while it runs: the catalogue, the WhatsApp history, the history of orders delivered, the customer list, and every order the runtime takes from then on. Processed into rows. Those rows feed the runtime with what it needs to decide, and they fill every prefilled row in the app (dropdowns, autofill, suggestions are reads of these tables — relational, no model).

**The process, in order.**
1. **Land.** A file arrives (paste, upload, the Historial doors [PRODUCT-SPEC §17.21](omitted-sources.md)) as a row in `ingest_queue` (tenant, kind, file, status). An unreadable file says so by name and never fails the batch.
2. **Read into rows.**
   - catalogue → `skuparse` (§5.10.2, exists) → `catalogue_skus` rows + the preview diff;
   - WhatsApp export (.txt/.zip per customer) → a deterministic chat parser (timestamp · sender · body; media lines noted) → `messages_history` — **new**;
   - order history (invoices, albaranes, ERP exports: what was actually delivered, per customer per day) → the document readers (§17.6 invoice path; the vision read of THE-IMPLEMENTATION-SPEC §5 for foreign paper) → `deliveries_history` (customer, date, doc, lines: text · qty · unit · price) — **new**;
   - customer list (CSV) → `customers` (exists: `customer_profiles`).
3. **Normalise.** Names folded (accents, case); units to base units with pack factors (`units`); dates to delivery days; the customer resolved by phone, then name.
4. **Align.** Per customer per day: the messages of that day against the lines delivered that day, one model read per day-pair, fixed form, spans as evidence → `golden_pairs` (customer, message, delivered lines, spans, confirmed) — **new**. Delivered lines with no message are marked «no message» (phone, walk-in). This is the one model call in the intake.
5. **Derive the model rows, deterministically, from the pairs:** `sku_aliases` (this customer's word → this SKU), `customer_habits` (typical quantity per product, order groups, day-of-week rhythm, `customer_window_dow`), `customer_sku_prices`, `learned_patterns` (the detection bank, ORDER-BRAIN L1/L5). All exist except the pairs behind them.
6. **Propose, never write silently** (§17.14.5): the derived rows land as proposals in the house's review («Lo que suele pedir», §17.6); accepted → rows. From then on every accepted or corrected live order writes the same rows (ORDER-BRAIN L5).

**The database structures** (Postgres; two layers today — the app tables in `db.py`, tenant-keyed, and the spine in `schema_runtime.sql`, scope-keyed by `ltree` — THE-SCHEMA-SPEC SCH-00; all names are today's unless marked new; the full DDL of the new ones is THE-SCHEMA-SPEC SCH-01).

| Table | Columns that matter | Fed by | Read by |
|---|---|---|---|
| `catalogue_skus` | code · name · unit · family · category · pack · price · art | step 2 | everything |
| `customer_profiles` | name · phones · addresses · tariff · hard-limit pill | step 2 | the runtime, the UI |
| `messages_history` **new** | customer · ts · sender · body · media | step 2 | step 4 |
| `deliveries_history` **new** | customer · date · doc · lines[] | step 2 | step 4, prices, habits |
| `golden_pairs` **new** | customer · message · delivered lines · spans · confirmed · at | step 4, live accepts | the backtest (2.6), step 5 |
| `sku_aliases` | customer · phrase · sku · confidence · source | step 5, live corrections | the runtime's detect and read |
| `customer_habits` · `customer_window_dow` | customer · sku · typical qty · unit · dow · group · window | step 5, the nightly sweep | the runtime's predict and validate; the UI's ranking |
| `customer_sku_prices` | customer · sku · price · tariff · since | step 5 | the albarán |
| `learned_patterns` | kind · pattern · hits · misses | step 5, the weekly eval | the runtime's detect (L1) |
| `event` (spine) · `orders` (dual-written today) · `order_events` · `open_loop` (the tab) | the live log, the live orders, the open tabs | the runtime | everything |

**What it feeds.** (a) The runtime: at message time it reads this customer's aliases, habits, window, prices and the tenant's patterns — the context rows of §5.0 step 4. (b) The app: every dropdown and autofill is a query over these tables through one typo-tolerant index (`pg_trgm` + `tsvector`, owned by the proposed backend index in §4.4) ranked by habits when a customer is in context; a free-form line («12 cajas merluza grande») is that index for the product plus one cheap read for the structure, constrained to rows the index holds.

**Exists / owed.** Exists: `skuparse`, the alias learning (`learn.py`), habits and windows, the training surface (§17.6), the Historial doors specified (§17.21, not built). Owed: the chat parser, `deliveries_history`, the alignment read, `golden_pairs`, the index as one shared service.

## 2 · THE RUNTIME — how it decides on every message and order

**What it is.** The product backend ([PRODUCT-SPEC §3–§5](omitted-sources.md), `runtime`): the event log, the memory organs, the bounded turn, one reasoning call per message, gated actions, the daily sweep. It already runs; this section states the decision process it must run best, given what the intake feeds it.

**What it must do on every message** (Peter, §203/§205):
- decide whether it is an order, and take it — predicting what will actually be sold to this customer;
- flag what needs flagging: an item · several items · part of an item · a message that needs a reply · both (an item in a message that needs a reply); usually one thing at once;
- prefill the reply it thinks the house should send, as a draft;
- know when to generate an image (a new product).

**The process, per message, cheapest first** (the spine, ORDER-BRAIN L1–L5, with the intake's rows plugged in):
1. **Append** the message to the log (§5.0 step 1).
2. **Detect** (deterministic, free): the pattern bank + this customer's aliases tag spans — order cues, quantities, units, products, negations, corrections, questions. No cue → a conversational turn (the mind replies; no order).
3. **Recall** (no model): this customer's context rows (aliases, habits, window, prices), the open tabs, the last seven days (§4.1).
4. **One read** (Haiku, fixed form): lines {product, quantity, unit, day} · questions the customer asked · what the customer needs answered · corrections to earlier lines. Full context, one pass (L2).
5. **Validate** (code, L3): SKU exists · quantity within this customer's range · unit and pack known · day is a delivery day · antecedents exist · line count equals detected count.
6. **Predict what will be sold:** every line becomes the delivered form — quantity in the delivered unit through the pack factor and the habit («una caja» → 5 kg for this customer), the price from `customer_sku_prices`, the day from the window; the stock ledger is checked; a shortfall is a flag with substitutes from the house's own rows.
7. **Gate per line** (L4): auto-fill when detect, read and validators agree and the retrieval margin is wide; otherwise the line is flagged.
8. **Flag — one primary flag per message**, from this table:

| Flag | When | The house sees | The draft says |
|---|---|---|---|
| an item | one line fails a validator or the gate | the line outlined, the reason under it | the question for that line, with the house's options |
| several items | more than one line fails | each outlined; one head line «3 lines need you» | one message with the questions in order |
| part of an item | quantity or unit uncertain, product sure | the figure outlined, the product plain | «¿12 kg o 12 cajas?» |
| a message needs a reply | a question, a complaint, a change of time; no order line at stake | the message in the river with «needs response» | the reply, prefilled |
| both | an order line and a question in one message | the line outlined and the message flagged | the confirmation plus the answer |
| a shortfall | stock below the predicted line | the line flagged red with the substitute | the shortage message with the options |
| a new product | the index and the read agree it is unknown | the line as «new product» with the proposed row | «is it this?» with the closest rows, or the proposal to add it |

9. **Draft the reply** from the flag: confirmation · question with options · shortage with substitutes · answer. Spanish, the tone law (§5.9.3), addressed to this customer, prefilled in the composer (§196.9). Sent only per the house's setting: ask the customer, or land on review (§17.6 layer 2, §5.8).
10. **Write:** the order draft with its flags, the draft reply, the evidence (spans, rows matched, validators) → the review sheet, or auto-confirm where the rules allow (`accept_rules`, §5.8).
11. **The image:** a line resolved as a new product opens a proposed product row (name · category · unit · sort · form, from the read) → Opus writes the subject clause in the library's grammar (§202.8) → the locked prompt → Ideogram → the tile lands and the row shows it. Never for an existing product; never without the house accepting the row.
12. **Learn** (L5): the house accepts or corrects → aliases, habits, a pattern candidate, a golden pair.

**What «works best» means.** One model read per message; everything else free; p50 under 3 s from message to state; the deterministic share rising week on week (the bank grows, the read's share shrinks); auto-filled lines that the house corrects under 5 %.

**The proof — the promise.** «With all their data, about 95 % of orders come out perfect.» Perfect: every line's product, quantity, unit, day and customer as the house would have entered them. Excluded by name: a product this customer never ordered · an order over three times the customer's typical total · lines the house's rules send to manual check · messages with no delivered counterpart. Measured by the backtest: split `golden_pairs` by date, derive the rows from the earlier part, replay the later messages through this process with the runtime's own code, compare to the delivered lines; report line exactness, order exactness, the excluded share, the ten worst misses with evidence; fail closed under a pinned floor per house. Today's number: to measure — the harness does not exist yet.

**Exists / owed.** Exists: steps 1–5, 7, 9–10, 12 in the backend (§5.0, `runtime.py`, `learn.py`, the tabs, the sweep). Owed: step 6 as a typed prediction with the stock check in the gate; the flag kinds as one typed field on the order draft (today: doubts, review reasons); the draft reply as a first-class row the composer reads; step 11; the backtest harness; SLO views for the numbers above.

## 3 · THE COPILOT — it acts to do stuff for the house

**What it is.** The panel's agent ([PRODUCT-SPEC §17.18](omitted-sources.md): its own organ, not the customer-mind). It reads the house's book and rows, and does things for the house: proposes, the house applies. Every act is a diff card with one tap to apply and an undo receipt, recorded in `sup_audit`.

**What it can do.** Open, flag or hold orders · write the supply report and the drafted replies when stock is short · change the catalogue (rename, merge, unit, price — each diff spelling out what cascades: aliases, habits, open orders) · change settings and templates · set the day's buttons · answer any question the views can answer, with the rows linked. It never speaks to a customer, never writes a row without the tap, never invents a quantity, price or availability beyond what it read.

**Its context.** The day's book (orders, flags, tabs), the stock ledger, the customer in context, the intake's rows, the configuration, the session's last twenty turns. No customer drawer.

**The process, per ask.** Assemble the context (deterministic, capped) → one read (Sonnet; the proposals in fixed shapes) → ground (drop any proposal naming a row absent from the context) → cards → the tap → the same gates a person's act runs → audit → learn nothing on its own.

**The proof.** Every proposal names rows present in the context; nothing is applied without the tap; the report's numbers equal the views'.

**Exists / owed.** Exists: the customer-mind (`run_turn`), the panel API (`sup_api`), the kit's design of the surface and the proposal grammar (E198–E199, theatre). Owed: the organ (`panel_chat`), its tool registry over `sup_api`, the diff cards, the audit rows.

## Across the three

- **Provider:** Anthropic through Rocoto's backend SDK integration ([STACK.md](omitted-sources.md)); [backend/brain/llm.py](../backend/brain/llm.py) is the existing structured tool-call helper. The adopted intelligence work qualifies and extends an owned backend seam against its contract. Haiku for the message read and the UI's cheap reads; Sonnet for the alignment read and the Copilot; Opus for the clause writer. Deterministic everywhere else.
- **Evidence:** every model output carries what it read and which rows matched; the house sees the evidence beside the number.
- **Stats:** SQL views over the log and the tables — need you · handled · exactness (backtest and live corrections) · manual-check rate · time to albarán · cost per order · Copilot proposals applied — recomputed from raw rows by a test.
- **Proposed intelligence dependencies:** intake (chat parser, deliveries, alignment, golden pairs, the index) → the runtime's owed steps and the backtest → the Copilot organ. The current task selects the scope; [the engineering workflow](ENGINEERING.md) governs review, unresolved product choices and release authority.
- **Owed outside the design:** Twilio inactive; Anthropic credit; an Ideogram REST key.

## 4 · The work — what gets built from this, with its contract (§206.3 «then the AI work», written to be built from without a conversation)

Every workstream below names proposed files, functions with signatures, tests and the evidence that proves it. Tables are THE-SCHEMA-SPEC's. Provider integration belongs to Rocoto's backend, as above. GitHub issues select work from this design and record its dependencies and proof; implementation follows the existing task and release authority.

### 4.1 The intake (§1; THE-IMPLEMENTATION-SPEC §10)
| Piece | File | Contract |
|---|---|---|
| landing | `backend/ingest.py` | `land(tenant, kind, file) -> IngestFile` — hash-idempotent; `status` walks landed → parsed → proposed → accepted |
| chat export parser | `backend/chat_export.py` | `parse_wa_export(bytes) -> Iterator[Msg(ts, sender, body, media)]` — deterministic; WhatsApp's .txt grammar in es/en/ca; media lines yield `media=name, body=''` |
| deliveries reader | `backend/deliveries_import.py` | `read_table(bytes, mapping) -> rows` for CSV/Excel; `map_headers(sample) -> mapping` is ONE Haiku call per file (which column is customer/date/product/qty/unit/price/doc), cached by header hash |
| normaliser | `backend/normalise.py` | `fold(name)`, `to_base_unit(qty, unit, pack) -> (qty, unit)`, `resolve_customer(tenant, phone, name) -> customer_id | Proposal` |
| product resolution | `backend/resolve_products.py` | `resolve(tenant, texts: set[str]) -> dict[text, sku_id | NewProduct]` — the Rocoto-owned index first (Postgres trigram over `catalogue_skus`, `sku_aliases`), the leftovers in ONE batched Sonnet read (the Batch API), fixed form `{text, sku_id | null, schema?}` |
| alignment | `backend/align.py` | `align_day(tenant, customer_id, day) -> list[GoldenPair]` — the day's messages + the day's delivered lines → one Sonnet read, fixed form with spans; unattributed lines flagged `no_message` |
| derivation | `backend/derive.py` (SQL) | `refresh_habits(tenant)`, `refresh_seasons(tenant)`, `refresh_substitutions(tenant)` — nightly, idempotent, each writes `refreshed_at` |
| proposals | `backend/proposals.py` | `propose(tenant, kind, rows) -> ProposalBatch`; `accept(batch_id, ids)` writes aliases, habits, groups, new products; the Historial surface (§17.21) is the door |
| tests | `backend/tests/test_intake_*.py` | a fixture export of 2 years × 30 customers × 3,000 lines parses under 60 s; re-landing is a no-op; a synthetic chat export aligns 95 %+ of lines to a fixture delivery log with the read stubbed by a recorded fixture; one live Sonnet test guarded by the key |

### 4.2 The backtest (§2, the promise)
`tools/backtest.py --tenant X --split 2026-06-01` → derives the rows from pairs before the split, replays every later message through `runtime.run_turn` with egress stubbed, compares to the delivered lines, prints per-line and per-order exactness, the excluded share by class, the ten worst misses with spans, and exits 1 under the pinned floor in `backtest_floors.json`. Run on demand after a relevant runtime change or intake.

### 4.3 The runtime's owed steps (§2 steps 6, 8, 9, 11)
| Step | File | Contract |
|---|---|---|
| predict what is sold | `backend/predict.py` | `predict(draft, habits, prices, stock) -> PredictedLines` — the delivered unit through the pack factor and the habit; the price; the day from the window; a stock shortfall → a `shortfall` flag with substitutes from the house's own rows |
| one primary flag | `backend/flags.py` | `flag(draft, validators, read) -> list[Flag]` with exactly one `primary=true`; kinds per §2 step 8; writes `order_flags` |
| the draft reply | `backend/drafts.py` | `draft(flag, customer, tone) -> DraftReply` — Haiku, fixed form, Spanish, the tone law; writes `draft_replies`; the composer reads it (§196.9) |
| the image trigger | `backend/artwork.py` (product; fresh per §204) | `on_new_product(schema) -> SubjectRequest` — index lookup → Opus clause → STYLE_LOCK → Ideogram → normalise → `catalogue_subjects` + tile; `awaiting_key` when the key is absent |
| tests | `backend/tests/test_runtime_*.py` | each function on fixtures; the seven flag kinds each produced once; the drafts pass the copy gate |

### 4.4 The light layer (§1 «what it feeds», THE-IMPLEMENTATION-SPEC §3)
`backend/index.py`: `search(tenant, kind, q, customer_id=None) -> ranked rows` (trigram + tsvector, ranked by habits). `backend/structure.py`: `structure_line(tenant, text) -> {product, qty, unit, pack, class, spans}` (Haiku, fixed form, constrained to index candidates); `structure_product(text) -> Schema` (Opus); `ask_next_day(tenant, prose) -> Question` (the Typeform road). Tests: every picker under 20 ms on 10,000 rows; the structure reads on a 200-line fixture with recorded answers.

### 4.5 The Copilot organ (§3; THE-IMPLEMENTATION-SPEC §8)
`backend/panel_chat.py`: `ask(tenant, session, text) -> Reply` — assemble (the day's book, stock, the customer, the model rows, the configuration, 20 turns) → Sonnet with the **tool registry** (`backend/acts.py`: every UI act as a typed function, generated from the kit's acts list so a registry test can diff them) → proposals grounded against the context → chips (the shapes the UI renders) → `apply(tenant, proposal_id)` runs the act through the gates and writes `sup_audit`. Tests: grounding (no proposal names a row outside the context); the registry diff (every UI act ↔ function ↔ chip); nothing applied without `apply`.

### 4.6 Stats (Across the three)
`backend/views_stats.sql` (the views) and `tools/stats-recompute.py` (recompute one day from raw rows; assert equality). Views: need_you, handled, exactness (backtest + live), manual_check_rate, time_to_albaran, runtime_slos, cost_per_order, copilot_use.

### 4.7 The order, sized
These dependencies apply when implementing this intelligence design. The selected issue and
[adoption plan](THE-KIT-TO-PRODUCT-PLAN.md) identify which prerequisites its slice needs.

1. THE-SCHEMA-SPEC SCH-08 steps 1–3 (RLS everywhere, the hash chain, encryption) — first, because every table after inherits them.
2. 4.1 intake + 4.2 backtest — the first house's number is the proof.
3. 4.3 the runtime's owed steps.
4. 4.4 the light layer.
5. 4.5 the Copilot organ.
6. 4.6 stats.
THE-CONNECTIONS-SPEC's three rails run beside 2–3, each its own workstream, in staging with the seeded tenant.

## 5 · Three worked examples — the whole thing with values, so the gaps show

### 5.1 A message becomes an order, a flag and a draft
Bar Paco (customer 2208-390, window Fri 07:00–09:30, tariff 3) sends on WhatsApp, Thursday 20:41: «ponme lo de siempre y 3 cajas de gamba pa mañana».
1. **Append** → `event(scope=rocoto.paco, type=wa.message)`.
2. **Detect** (free): the bank tags «ponme» = order verb, «lo de siempre» = standing-order cue, «3 cajas» = quantity+pack, «gamba» = product word, «mañana» = day cue.
3. **Recall** (free): Paco's rows — habits: group «lo de siempre» = {12 kg merluza, 2 kg pulpo cocido}; alias «gamba» → `PV-1002 Gamba roja` (confidence 0.96, 41 orders); pack «caja» for PV-1002 = 5 kg; window says «mañana» = Friday, delivered Friday; price PV-1002 tariff 3 = 15,80 €/kg; open tabs: none.
4. **One read** (Haiku, ~2 s, ~0.3 ¢): `{lines: [{product: "lo de siempre", qty: null, unit: null, group: true}, {product: "gamba", qty: 3, unit: "caja"}], day: "2026-09-04", questions: [], needs_reply: false}` with spans.
5. **Validate** (code): group exists ✓ · PV-1002 exists ✓ · 3 cajas within Paco's range (typical 2–4) ✓ · pack factor known ✓ · Friday is a delivery day ✓ · line count 2 = detected 2 ✓.
6. **Predict**: lines in delivered form: merluza 12 kg @ 14,20 · pulpo cocido 2 kg @ 21,00 · gamba roja **15 kg** (3 × 5) @ 15,80 = 237,00 € — stock ledger: gamba roja available 40 kg ✓.
7. **Gate**: every line auto — detect, read and validators agree; margin wide.
8. **Flag**: none needed. (Had the ledger held 8 kg, the primary flag would be `shortfall` on the gamba line with substitutes from Paco's own rows: gamba blanca 12 kg, and the draft would say so.)
9. **Draft reply** (Haiku, Spanish, tone law): «Hecho, Paco: lo de siempre y 15 kg de gamba roja para mañana viernes. Te llega en la franja de la mañana.» — status `drafted`; sent automatically because Paco's rule is `confirm: doubt` and there is no doubt; otherwise it waits in the composer.
10. **Write**: `orders` + `order_events` + `draft_replies`; the house sees the order in Friday's river as handled, with the evidence line «read from 1 message · 2 lines · group + alias».
11. **Learn**: on Friday's delivery confirmation → a golden pair (message ↔ the three delivered lines); habit «3 cajas» support +1.
Cost of the turn: one Haiku read + one Haiku draft ≈ 0.6 ¢. Latency: under 3 s to state.

### 5.2 A free-form product line in the app («is it matching or indexing?»)
The house types on a new albarán: «12 cajas merluza grande 3/4».
- **Index first** (no model, < 20 ms): trigram over this house's `catalogue_skus.name` and `sku_aliases.alias` returns candidates: `PV-1001 Merluza` (0.91), `PV-1007 Merluza grande` (0.97), `PV-1003 Merluza · filetes` (0.62), ranked up by the customer's habits when a customer is in context.
- **One cheap read** (Haiku, ~1.5 s, ~0.2 ¢), constrained to those candidates: `{product: "PV-1007", qty: 12, unit: "caja", pack: "3/4", class: null, spans: {...}}`. It may only pick a candidate or say «new».
- **Validate**: pack «3/4» is a known caliber for PV-1007 ✓; 12 cajas → 12 × 4 kg = 48 kg in the delivered unit.
- **The row fills**: product, 48 kg, unit price from the tariff, the painting from the index. If the read had said «new», the line shows «New product · Merluza grande 3/4» with the proposal to add it (§3's SKU road: Opus writes the schema, the index is asked, the tile is painted).
So: **matching by index for anything the house already has; understanding by one read only to structure the words and choose among the index's candidates; the read never invents a row.**

### 5.3 A history export becomes the model
The house uploads `pedidos_2025.xlsx` (14,200 lines, 61 customers) and Bar Paco's WhatsApp export (.txt, 2,300 messages).
1. **Land**: `ingest_file(sha256=…, kind=deliveries)`; a second upload of the same file is a no-op.
2. **Map headers** (one Haiku call, cached by header hash): Cliente → customer · Fecha → date · Artículo → product_text · Cant. → qty · Ud. → unit · Precio → price · Albarán → doc.
3. **Parse** by code → 14,200 `deliveries_history` rows; 3 unreadable rows named by row number, kept as refused.
4. **Normalise**: customers resolved by phone (58) or name (3 proposals); units to base; dates to delivery days.
5. **Resolve products**: 412 distinct product texts; 371 hit the index (code or exact name); 41 go in ONE batched Sonnet read → 36 mapped (with confidence), 5 «new» proposed.
6. **Align** Paco's chat: 214 customer-days with both a message and deliveries → 214 Sonnet reads in one overnight batch → 198 golden pairs (16 days flagged «no message» or ambiguous, shown to the house once).
7. **Derive** by SQL: Paco's aliases («gamba» → PV-1002, «lo de siempre» → group), habits (Friday 12 kg merluza, typical total 210 €), window (07:00–09:30), prices; per product: the season curve (gamba roja −40 % in August) and one substitution (PV-1010 → PV-1012 from March).
8. **Propose**: 61 customer sheets with «Lo que suele pedir», 5 new products, 3 customer matches — accepted in bulk.
9. **Backtest**: split at 2025-10-01; replay 3,100 later messages: line exactness 91 %, order exactness 84 %, excluded 9 % (new things 4 %, big orders 2 %, manual classes 3 %). The house sees its own number before going live; the floor is pinned at what was measured.
Cost: ~41 + 214 batched reads ≈ 2–3 € for the house's whole history. Time: the parse in minutes, the batch overnight.

## 6 · The proposed intelligence service (§209)

Everything above the rows is one service: **the index + the reads + the proposal grammar**, with four clients — the turn, the UI's fields, the Copilot, the paper readers. It needs the rows (Postgres), the provider seam (Anthropic), the index (pg_trgm), and the contracts in §4. Its proposed source is `backend/intelligence/`, with the modules of §4, its own tests and SLO views; the implementation task settles module placement against the existing backend.

When this design is adopted, commission its integration on staging against that environment's synthetic tenant data and sandbox providers. A prototype can exercise an explicit development adapter against its own fixtures or isolated service data. Product and prototype clients can share the contract described in [THE-KIT-TO-PRODUCT-PLAN](THE-KIT-TO-PRODUCT-PLAN.md); each build retains its own configuration and data boundary. Product production data and rollout remain under the [release authority](ENGINEERING.md#environments-and-release-authority). A feature flag controls availability after integration and release evidence exist.

The kit remains a place to try the design while the service is implemented and proven. Select work through the current task and the dependencies in §4.7; measure provider cost and performance with that integration's evidence.
