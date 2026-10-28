# THE PARSING SPEC — how a document becomes rows

**Authority:** FEED-IA §196.5 (E193.05), standing on §191.1 (one capture grammar) and §191.2 (a
photo asks for rows). **Boundary:** SRC-01 / THE-SOURCE-PRIVACY-SPEC owns what may be RETAINED;
this document owns what is READ. Where they disagree about retention, the privacy contract wins.

Peter, 2026-09-04, recorded whole in FEED-IA §196:

> for the parsing and qr shit, not sure what youre using. i have no idea. maybe we need an api.
> idk. maybe use parsewise so its solid cos like im not sure that for the tabular data if claude
> ocr will be best. how do u set it to recognise standard formats and stuff?

Three questions, and this document answers all three: **what reads a table** (§1), **how it is set
to recognise a standard format** (§2, and the answer is proven against the live API in §6), and
**what the surface does with the answer** (§4).

---

## PAR-00 · The one-sentence law

**A parse is a proposal.** §191.1: «A capture is not an OCR result… no field is silently
invented.» Nothing extracted becomes an albarán line, a stock movement or a catalogue row until a
person has seen it beside the source and pressed once. Every state of the road — reading, read,
runtime out of reach, extraction unavailable — is SAID on the surface, and the source stays on
screen in all four so the manual road is never further than the next line.

## PAR-01 · Two readers, and the rule that picks between them

| The source | Who reads it | Why |
|---|---|---|
| A TSV paste, a CSV, a `.txt` export — anything that ALREADY has rows | `parseStockTable` / the chip parser, in the browser, deterministically | An exact reading beats a probabilistic one. Text that is already a table needs no model, costs nothing, works with no runtime, and leaves the bytes in the tab. |
| A photo, a scan, a PDF, a `.xlsx`/`.docx` binary | **Parsewise**, through the kit runtime | These have no rows to read — they have LAYOUT. Reading a table out of layout is a document-intelligence job with citations, and Peter's own doubt is the right one: a general vision model asked to read a 40-line albarán is guessing at column boundaries. |

`parsing.ts` holds the predicate (`isTextTable` / `isExtractable`) so the surfaces that capture —
the albarán intake, the stock batch and the supplier-list door — cannot disagree about which road a
file takes.

⚠ **One refinement, on the `.xlsx` row: a workbook the BROWSER can open is read exactly.** The
catalogue door already opens `.xlsx` with ExcelJS in the page, and the principle in this table's own
right-hand column decides it — an exact reading beats a probabilistic one. Paying a provider to
guess at cells the file states would be the rule losing to its own table. PAR-04.3 states the
predicate that door uses.

**And a photograph of paper THIS HOUSE PRINTED takes a third road, before either of these.** The
packing sheet records where it put every box, so that photo is read against a known geometry rather
than inferred: [THE-PAPER-SPEC](THE-PAPER-SPEC.md), and PAR-11 below.

⚠ **The browser never holds the key.** Parsewise authenticates with an `X-API-Key` header, and its
own documentation says «never embed them in client-side code». The kit is a static page. That is
the whole reason E193.06 exists: `runtime.parse(file, kind)` posts to `/api/parse` on the kit's own
origin, and the service behind it carries the key. `runtime-client.ts` is the only file in the kit
that names the service.

## PAR-02 · How a standard format is declared — «how do u set it to recognise standard formats»

**By telling it, in JSON Schema, and by telling it that the table REPEATS.** Two halves; the second
one is the half that is easy to miss and the one that decides whether a four-line albarán comes
back as four rows or as one (§6 proves both outcomes against the live API).

### PAR-02.1 · The three kinds

`parsing.ts` `PARSE_FIELDS` names them; the runtime turns each into the schema below.

| `kind` | Fields | The document |
|---|---|---|
| `albaran` | product · quantity · unit · price · lot | A delivery note or a customer's written order |
| `catalogue` | sku · name · unit · price | A supplier's price list or product list |
| `stock` | product · quantity · unit · lot · date | A stock count, a goods-in sheet, a market ticket |

Header facts ride alongside the lines and are extracted the same way: `document_number`,
`document_date` (ISO 8601), `counterparty`.

### PAR-02.2 · The schema (albarán, verbatim — the other two are the same shape)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "document_number": {"type": "string", "description": "The delivery-note number printed on the page."},
    "document_date":   {"type": "string", "description": "The delivery date, ISO 8601 YYYY-MM-DD."},
    "counterparty":    {"type": "string", "description": "The customer or supplier the document is addressed to."},
    "lines": {
      "type": "array",
      "description": "One entry per goods line in the table. Ignore totals, taxes and carriage rows.",
      "items": {"type": "object", "properties": {
        "code":       {"type": "string", "description": "The product code or SKU exactly as printed, empty when absent."},
        "name":       {"type": "string", "description": "The product name exactly as printed."},
        "quantity":   {"type": "number", "description": "The quantity as a number; a comma decimal separator means a decimal point."},
        "unit":       {"type": "string", "description": "The unit of the quantity exactly as printed (kg, caja, ud, manojo)."},
        "unit_price": {"type": "number", "description": "The price for one unit as a number, without a currency symbol."},
        "lot":        {"type": "string", "description": "The lot or batch identifier for the line, empty when absent."}
      }}
    }
  }
}
```

Every `description` is load-bearing. Parsewise's own guidance — «describe the value first, then
where to find it», «specify the output format explicitly», «call out what NOT to extract» — is why
the comma-decimal rule and «ignore totals, taxes and carriage rows» are written into the field and
not hoped for.

### PAR-02.3 · The repeating table needs a DIMENSION — this is the part that decides everything

A Parsewise agent produces **one value per project** by default. A table is not one value. To get
one row per goods line, the line-level agents carry a **dynamic dimension**:

```
POST /api/v1/projects/{id}/dimensions/
{ "name": "Line",
  "description": "One instance per goods line in the delivery-note table. Each printed table row
                  is one line; totals, taxes and carriage rows are not lines.",
  "example_values": "Merluza grande, Pulpo cocido, Gamba roja",
  "value_type": "string" }

POST /api/v1/projects/{id}/agents/
{ "name": "Quantity", "value_type": "number",
  "extraction_instructions": "The quantity on this goods line as a number. A comma decimal
     separator means a decimal point: \"12,5\" is 12.5. Return the number alone, without the unit.",
  "dimensions": [{ "dimension_id": "<Line>", "are_values_dynamic": true }] }
```

Six agents, one per column: `Product code` · `Product name` · `Quantity` · `Unit` ·
`Unit price (EUR)` · `Lot`. Header facts (`Document number`, `Document date`, `Counterparty`) carry
**no** dimension, because they are one value for the whole page. `value_type` is `string` or
`number` and nothing else — Parsewise lists `bool`/`date`/`datetime` for backwards compatibility and
says plainly they are not wired end to end, so a date is a `string` whose format the task states.

### PAR-02.3a · NAME THE INSTANCE KEY, or the agents key their rows differently

A dynamic dimension discovers its instance labels at extraction time — **per agent**. Two agents
looking at the same four-line table can come back keyed differently (one by «MER-001 Merluza
grande», another by «1», «2», «3», «4»), and a runtime that groups rows by `dimension_value` then
emits EIGHT rows for a four-line albarán: four complete ones and four carrying only a name.
Observed on the live path, 2026-09-04, against the kit runtime.

So the dimension's `description` must SAY what one instance is, in the words the page uses:

> «One instance per goods line. The instance is identified by the product code printed at the start
> of the line; where a line has no code, by its product name exactly as printed. Totals, taxes and
> carriage rows are not lines.»

The runtime must also drop any row whose only populated field is the label, and merge the rows that
are one printed line — belt and braces, because a stable description is a prompt, not a guarantee.

⚠ **Joining on the instance's id is not one of the defences, and PAR-09.2 is the receipt.** This
section first asked for a join on `dimension_instances[0].id`; the payload does not support it. The
provider mints a **fresh instance id per result row** — the recorded clean read carries 23 ids for
four lines — so an id join splits every line into one row per column. The label is the only key the
payload offers, and the merge in PAR-09.2 is what makes the label safe.

⚠ **`auto_map: true` on the convenience endpoint does NOT attach this dimension**, and §6.1 is the
receipt: the same page, the same schema, four printed lines, one returned row with every column
concatenated. The dimension is the difference between a working reader and a plausible-looking one.

### PAR-02.4 · The multi-document case

Where several sources are read together (a morning's photos), the system-managed `Document`
dimension goes on the line agents alongside `Line`, or `auto_attach_document_dimension: true` is
set at project creation. Combining them intersects: one row per line per document.

## PAR-03 · The runtime's contract

`runtime.parse(file, kind)` → `POST /api/parse` (multipart `file` + `kind`) → `ParseResult`:

```ts
type ParsedRow  = { name: string; qty?: number; unit?: string; price?: number; lot?: string; raw: string };
type ParseResult = { rows: ParsedRow[]; columns: string[]; confidence: number;
                     provider: 'parsewise';
                     evidence: { pages: number; tables: number; documentId?: string;
                                 lineOrder: 'numbered' | 'read-order' | 'unknown';
                                 rowsMerged: number; rowsDropped: number } };
```

`lineOrder`, `rowsMerged` and `rowsDropped` arrived with PAR-09 and they say what the runtime did to
the provider's answer: where the row order came from, how many groups were one printed line, and how
many carried nothing but a label. The kit types them as it reads them; PAR-09.4 owns the surface.

What the runtime owes this contract (E193.06 owns the implementation; these are its obligations):

1. **It holds the key.** `PARSEWISE_API_KEY`, server-side, never in a response, never in a log.
2. **It configures the format.** Project → upload → dimension → agents → launch, per PAR-02, from
   a stored template per `kind`. The browser sends a file and a word; it never sends a schema.
3. **It waits.** A run is «done and successful» only when `pipeline_running=false` **and** every
   agent's `extraction_status` is `Processed` or `No Result` — Parsewise's own FAQ is explicit that
   `pipeline_running=false` alone also happens on a cancelled or failed run. Measured on the probe
   in §6.2: about **two and a half minutes** end to end for a one-page albarán. The endpoint may
   therefore hold the request open, or answer `202` with a poll token; either way the kit's
   `reading` state is a real wait and must not time out at ten seconds.
   ⚠ **That number was two numbers.** PAR-10 takes it apart: Parsewise's own time for one page is
   **44–191 s** with a p50 of **77 s**, measured over 47 live reads, and the rest was the ladder that
   asked every 25 s. The done-definition in this clause stands exactly as written; how often it is
   ASKED, and of which endpoint, is PAR-10.3's.
4. **It maps `resolution_status` to confidence, and never hides it.** `Resolved` → the value stands.
   `Requires attention` → the value stands and the row is flagged for the eye. `No result` /
   `Not resolved` / `Ignored` → the field is EMPTY, never guessed. `confidence` is the share of
   stated fields that came back `Resolved`.
5. **It keeps the citation.** Every Parsewise value carries `[document_name, page_number]`.
   `evidence.pages` / `evidence.tables` are read off that, so the kit's evidence line is a fact.
6. **The paper lives for one read.** The uploaded bytes are a transient source view
   (SRC-PRIV-07). One read is one project, it holds one document, and the project is deleted once
   the rows are returned — the document and every result derived from it go with it. What survives
   in Rocoto is the derived, reviewed facts. PAR-10.4 states why the project is per-read and what
   the deletion covers.

## PAR-04 · What the kit does with the answer

### PAR-04.1 · The albarán intake (`albaran-intake.tsx`)

The source card grows one seat, `albaran-intake-extraction`, wearing `data-state`:

| `data-state` | What it says | What stands beside it |
|---|---|---|
| `reading` | «Reading the document…» | the source, the manual composer |
| `read` | «Read by Parsewise · 1 page · 1 table · 4 rows · 92%» | the proposed lines |
| `unreachable` | «Runtime offline · Write the lines from the source.» | **Read it again**, the manual composer |
| `unavailable` | «Extraction unavailable · Write the lines from the source.» | **Read it again**, the manual composer |

**The proposal, and what it may write.** Each row is matched against the house's catalogue by the
same resolver the manual stock road uses — exact code, then a narrowing word match. A row that
matches nothing stays a proposal, says so, and is excluded from the count; the albarán may only
carry goods the house sells (§191.7). The quantity sits in a 44 px input a hand corrects before
anything is written. **Put N lines on the albarán** then calls `addLine` — the composer's own
event, no second road into the ledger (§41.4).

**The proposal is planned from its longest values (§194.2 · §195).** The terminal's width is a
COLUMN PLAN sized once per proposal off its longest quantity and longest unit, so «12,5 kg» and
«999.999,125 manojo» share one column and the figures line up down the card; on a phone the seat
takes its own line when the plan will not fit beside the name. The seat holds the number a hand can
type — no thousands grouping inside an editor, which is a display concern of the LINE and a parsing
hazard in a field.

**The price is the house's.** §191.4: «No price, discount or issued-document money is inferred or
rewritten.» The paper's stated unit price is shown as evidence on the row («the note says 13,50
€/kg») and is NOT written; the line takes the house's own price list exactly as the manual road
takes it, and §192.2's type-in-place editor owns it from the moment the line exists.

### PAR-04.2 · The stock batch (`stock-batch-entry.tsx`)

The held source card states the same four postures in `stock-batch-reading`. §191.2's rule holds
unchanged — a source never becomes stock because it was attached — so a read offers **Put N rows in
the table** and the rows land in the SAME spreadsheet-like review every other stock road converges
on, with its own **Confirm stock** at the end. Rows whose product does not resolve stay out of the
table rather than arriving unnamed.

⚠ **AND THE CARD CARRIES THE ROWS (E200.08).** It used to carry only a COUNT. A sheet of five
products of which the house's book knows three said «Read by Parsewise · 1 page · 1 table · 5 rows ·
86%» over a button offering three, and the other two left without a word — the evidence line
counting one thing and the act counting another, with the difference silently dropped. That is the
quiet version of the failure §191.1 names. The card now shows EVERY row the paper gave, in the
proposal grammar `intake-road.tsx` owns: the matched rows with their code and lot, the unmatched
ones saying «New to the house · add it as a product first», each with its own 44 px quantity seat
under one column plan. **Put N rows in the table** still writes only the ready ones, and
`stock-batch-reading` publishes `data-read` (what the paper gave) beside `data-rows` (what the press
will write) so a proof can tell the two numbers apart. The door itself is named for what it does —
«Read a stock sheet», the same words at every width, replacing «File or photo» / «File or paste»,
which named the device and named it differently on each screen.

⚠ **AND «CONFIRM STOCK» IS A FLOOR (E200.08, found by LOOKING at 1600).** The batch's own footer is
sticky at `bottom: 0`, and a sticky bottom pins to the scroll container's CONTENT edge — `workflow-
body` carries 24 px of padding there on a desk and 16 px on a phone. So the opaque band stopped
short of the body's own edge and the review scrolled into the strip below it: a row's second line
standing in the open under the button, half a row hanging past a control that is meant to be the
end of the surface. It read as a rendering fault. Padding cannot close it and neither can a negative
margin — sticky grows the box upward, away from the strip, and both were measured. A background-
coloured shadow offset by that same 24 px does, clipped by the scroller at its own edge, with NO
geometry moved, so every drive that measures Confirm stock keeps its numbers. The claim is read off
the PIXELS: with the last review row scrolled against the foot, the strip holds no ink at either
width. E200.08 did not create this — it made it constant, because the card is tall by design now.

⚠ **The negative that used to stand here is repealed.** The card said «OCR is not connected yet»,
which spent a sentence on a thing that is now connected and, worse, was a sentence about what the
product could NOT do. It is replaced by what IS: the evidence line when there is one, the honest
runtime posture when there is not, and in both cases the next thing to do.

**A READ WITH NOTHING TO PRESS IS STILL A HAND-BACK (E195.20).** Three of the four postures said
what to do next; `read` did not. A source Parsewise found no table in — or whose rows match nothing
in this house's book — printed its evidence line and stopped, which leaves a person holding a
finished sentence and no way on. The card now carries the hand-back sentence in EVERY terminal state
where no button can be pressed, and `stock-batch-reading` publishes `data-rows` so a proof can tell
the two apart without reading prose. Measured against the deployed runtime: a small image with no
table answers in about 41 seconds with `0 rows`, `0 pages`, `0 tables`, confidence `0`.

*The albarán intake carries the same hand-back, and it is proven the same way.* `albaran-intake.tsx`
appends the fallback sentence to a `read` that landed no row, and `drive-198-parsing-qr.py`'s
`parsing_zero_rows` band holds it at 1366×768 and 390×844 — the stub answering the exact body the
deployed runtime returns (`rows: []`, `0 pages`, `0 tables`, `0.0`, `lineOrder: unknown`). The band
also holds what MUST stay true around it: `data-state` is `read` (the runtime answered, so no retry
control appears), the evidence line still states what read it, nothing is proposed, and the source
card stays. Red first against the E193 dist — `304 / 2`, both reds reading «PAR-04.2 · and where
no rows arrived it still hands the work back · Read by Parsewise · 0 pages · 0 tables · 0 rows ·
0% · check the line order» — and `306 / 0` on this one. Pin `parsing-qr` 294 → **306**.

**THE WAIT IS PART OF THE CONTRACT.** The runtime holds the request open — a small image measured
about 41 s and E193's public proof measured 85–136 s on the same road — so a surface, and any proof
of it, must WAIT for the terminal state rather than read the card mid-read. A drive that read the
card at once recorded «Reading the document…» and called it a failure of the product (E193 public
proof, `stock-photo` 20/3). `drive-191-stock-photo-session.py` now waits with an explicit budget
(`ROCOTO_READ_BUDGET_MS`, default 240 s) and states the posture it is in.

**THE PROOF THAT THE KIT REALLY ASKED IS THE REQUEST, NEVER AN ERROR.** «The journey reaches the kit
runtime for extraction» was read off a transport failure — the 501 a static harness answers a POST
with. A runtime that answers 200 leaves no such footprint, and a local build with no runtime makes
no request at all (`runtime-client.ts` · `localWithoutRuntime`), so the claim was false in BOTH
postures. It is now read off the POST itself, and the offline posture asserts its own truth: no
`/api` request, and the honest «Runtime offline» on the card.

### PAR-04.3 · The catalogue (`areas/stock.tsx` · «Upload a supplier list»)

**E200.08 opens the door this section used to defer.** `kind: 'catalogue'` was declared, the
runtime read it, and the kit called it from nowhere — so a supplier's price list arriving the way
one actually arrives, as a phone photograph of a printed sheet or as a PDF, met a dead end: the PDF
was refused with «Automatic PDF review is ready to connect» and the photo was held under «Reading is
pending; no products have been created». Two sentences about what the software would not do, on a
road that had been open since E193.

**Which reader reads it, on this door.** PAR-01's rule, with its principle stated in full: an exact
reading beats a probabilistic one, and it costs nothing. So a CSV, a TSV, a `.txt` export AND an
`.xlsx` the browser opens with ExcelJS are read exactly, in the page, by `parseSheet`. What is left
— a photograph, a scan, a PDF — has no rows to read, only layout, and goes to Parsewise as
`kind=catalogue`. (PAR-01's table lists `.xlsx` under the extractor; this door refines it. A
workbook the browser can open needs no model, and sending one would be paying a provider to guess
at cells the file states.)

**The answer lands in the review queue that already exists.** A read row becomes a sheet row through
`parsedSheet`: the SKU keys the identity (`skuIdentity`), a row without one takes the anonymous
identity every unlabelled CSV row takes, and the line Parsewise cited (`raw`) becomes the source
cell a person compares the reviewed row against. So a photographed list meets the same identity
checks, the same editable name/code/unit, the same inclusion toggles, the same
«I reviewed the product names, codes and units.» gate and the same **Add** as a CSV. One review,
three doors.

| `data-state` on `catalogue-photo-pending` | What `catalogue-reading-state` says | What stands beside it |
|---|---|---|
| `reading` | «Reading the document…» | the source, the paste road, the file road |
| `read` | «Read by Parsewise · 2 pages · 2 tables · 6 rows · 91%» | the reviewed queue |
| `unreachable` | «Runtime offline · Write the lines from the source.» | **Read it again**, **Remove**, the other roads |
| `unavailable` | «Extraction unavailable · Write the lines from the source.» | **Read it again**, **Remove**, the other roads |

**A read alone mints no product.** The queue's own gate stands unmoved: a read fills the review, and
`catalogue-readback-confirmed` plus **Add** is what writes. A read that landed no row opens no empty
queue and says the hand-back sentence.

### PAR-04.4 · `ParsedRow.code` and `ParsedRow.date` — two fields the agents read and the answer dropped

PAR-02.1's table declares four fields on the catalogue kind and five on the stock kind, and
`LINE_AGENTS` has asked for every one of them since it was written. Two of them had no seat in the
answer, so they were read from the paper and thrown away on the way out.

**`code`.** The runtime folds a line's code into `name` only when the line printed no name (`said =
name or code`), which is right for an albarán: the kit resolves a row against product name OR code,
so a nameless line still has a road home. On a supplier's CATALOGUE that fold loses the thing the
document is a list of. A price list prints «SUP-4401 · Merluza de pincho · kg · 14,20» and the house
importing it would have had to retype every SKU by hand. So `ParsedRow` carries an optional `code`
and `parsewise.py` emits it where the row printed a code BESIDE its name.

**`date`.** The stock kind's `Date` agent reads «the date printed on this stock row, as ISO 8601».
A goods-in sheet counted on Thursday and typed on Saturday was becoming Saturday's goods, because
the day had nowhere to travel. So `ParsedRow` carries an optional `date`, `parsewise.py` emits it
where the agent answered a real ISO day — a value it could not put in that shape is left unstated
rather than reshaped by the runtime — and the stock table takes it as the row's production date.
Where the paper printed none the house's own today stands, exactly as the manual road and the
pasted table already do, and the person sees and edits every one of them before **Confirm stock**.

Both are optional on purpose: a runtime answering without them still parses, and the review queue
asks for a missing code as its own identity check («Code»), which is the posture that was already
there for a CSV with no SKU column.

## PAR-04.5 · ONE ROAD, THREE DOORS — `intake-road.tsx`

Opening a second and third door is how three surfaces start disagreeing about what a read means. So
the albarán road's own parts were lifted into `intake-road.tsx` and all three kinds use them:

| | What it owns |
|---|---|
| `SourceButton` · `DoorGrid` | **Take photo · Upload file · Paste** — one grammar, 64 px doors, three across at every width, each answering the hand and the keyboard |
| `readingSentence` | the four postures' sentences, rendered in ONE place, so the three doors cannot word them three ways |
| `useProposals` · `ProposalRows` · `proposalPlan` | what the paper said, matched against the house's book, in a 44 px seat under one column plan |

`albaran-intake.tsx` keeps only what an albarán knows — the price list its lines take their rate
from, and the ledger event that writes them. `stock-batch-entry.tsx` keeps the review table and its
**Confirm stock**. The catalogue door keeps its reviewed queue.

⚠ **A defect the lift exposed, and closed.** Base's `Root` and its `InputContainer` carry separate
backgrounds, and the quantity seat only dressed the Root. The container kept the theme's own
`backgroundSecondary` — the exact grey of the proposal row behind it — so the figure read as loose text on the
row while the seat's white showed only as a 14 px sliver hanging off the right of the unit, past
the enhancer, like a rendering fault. Found by LOOKING at 390. The container and the enhancer go
transparent and the Root's trailing padding goes, so the seat is one white field under its inset
border; measured 128 px wide and 48 px high on every row, at 1600 and at 390. All three doors
inherited the repair from one edit, which is the whole argument for the lift.

⚠ **And a second one the lift exposed: the door had no state.** Lifted, `SourceButton` carried
`cursor: default` and nothing else — no hover, no focus ring — while every card-button the kit
already ships (`product-card.tsx`, `export-library.tsx`) pairs those three: the pointer stays an
arrow because the surface is a card, and the card answers with a filled background under the hand
and a 2 px ring under the keyboard. A 64 px bordered control with no state reads as a panel, and a
person on the keyboard cannot see where they are. An inline `style` cannot SAY `:hover`, which is
why it went unsaid; the door takes a Styletron class instead. The claim is read off the shipped
stylesheet for the class the door actually wears, never off a hover a drive simulates — and one
edit fixed all three doors.

## PAR-05 · Failure, and what is never done about it

| The failure | What the person sees | What the app does |
|---|---|---|
| The runtime is not there (`RuntimeUnreachable`) | «Runtime offline» + the manual road | Nothing. No rows, no cached answer, no «we'll try later». |
| The runtime answers non-200 | «Extraction unavailable» + the manual road | Offers **Read it again**. |
| Parsewise finds no table | `read` with zero rows, AND the same hand-back sentence the other postures carry — «Add each product below and check every quantity before you confirm.» / «Write the lines from the source.» (E195.20) | Says what it read, then says what to do. A terminal state with nothing to press must never end in a full stop. |
| A field comes back unresolved | That field is empty in the proposal | Never fills it from the row beside it, from a default, or from the product. |
| A row matches no product | The row shows, marked, excluded from the count | Never invents an SKU (§191.7). |
| The person edits a quantity | The edit is the value | The extracted number is not restored behind them. |

## PAR-06 · The proof — run against the live API from the box, 2026-09-04

Both probes ran against `https://api.parsewise.ai/api/v1` with the live key held in the box's
`.env.local`. The page was a generated one-page Spanish albarán (four goods lines, code · name ·
quantity · unit · price · lot, plus a total row), rendered to PNG.

### PAR-06.1 · What happens WITHOUT the dimension — the failure this spec exists to prevent

`POST /extract/` with the PAR-02.2 schema and `auto_map=true`. The header facts came back
perfectly — `counterparty: "Restaurant Can Sabate"`, `document_date: "2026-09-03"`,
`document_number: "2026/0418"`, every one `Resolved`. **The four lines came back as ONE:**

```json
"lines": [{ "code": "MER-001\nPUL-004\nGAM-010\nALM-002",
            "name": "Merluza grande; Pulpo cocido; Gamba roja; Almeja fina",
            "quantity": 12.5, "unit": "kg, caja", "unit_price": 13.5, ... }]
```

Four codes in one string, four names in another, and **one** quantity — the first line's. A reader
built on that would have silently dropped three quarters of an albarán.

### PAR-06.2 · What happens WITH it

Same page, PAR-02.3's configuration: a dynamic `Line` dimension on six column agents. **23 result
rows** (four lines × six columns, minus the one lot the paper does not state), every stated value
`Resolved`, every one citing `["albaran.png", 1]`:

| Line | code | name | quantity | unit | unit price | lot |
|---|---|---|---:|---|---:|---|
| 1 | MER-001 | Merluza grande | 12.5 | kg | 13.50 | L-250903 |
| 2 | PUL-004 | Pulpo cocido | 21 | kg | 18.90 | L-250902 |
| 3 | GAM-010 | Gamba roja | 3 | caja | 92.00 | L-250903 |
| 4 | ALM-002 | Almeja fina | 4.25 | kg | 31.40 | *(absent — and correctly `No result`, not invented)* |

Comma decimals read as decimals («12,5» → 12.5, «4,25» → 4.25). The unit «caja» survived beside
three «kg». The total row was not read as a line. The missing lot came back absent rather than
borrowed from the row above — which is the single most important behaviour on the page, because a
borrowed lot is a traceability lie.

**Timing:** upload → parse → launch → six agents processed → results in about **two and a half
minutes** for one page. That is the number PAR-03.3's wait is sized against, and it is why the
kit's `reading` state is a state and not a spinner with a timeout.

⚠ **What these probes do NOT prove.** One synthetic page, printed type, one language, clean
contrast. They prove the CONFIGURATION and the failure mode; they do not measure accuracy on a
creased handwritten note photographed in a market at 05:40, and no line in this spec claims they
do. The accuracy question is a corpus question and it belongs to the runtime's own evaluation.

## PAR-06.3 · And the kit's own half, proven separately

`drives/drive-198-parsing-qr.py` drives the four postures at 1920 · 1536 · 1366 · 393 · 390 · 360 and
ends **294 GREEN / 0 RED** with no runtime answering, and **297 GREEN / 0 RED** once E193.06's
runtime is up on 127.0.0.1:8790 (the W6 leg then runs and reports its posture — it read
«Read by Parsewise · 1 page · 1 table» through the real service), proven red first by **six source
flips across 33 deliberate reds** —
including the two that matter most here: a resolver that falls back to «the first product» reds
«the word the house never sold does not resolve» with `["yes","yes","yes"]` and puts `merluza` on
the albarán twice; and `rate = row.price ?? priceOf(...)` reds §191.4 by printing the paper's own
figures as the house's money. ⚠ In that harness the ROWS come from the harness. It proves the kit's
handling of a `ParseResult`; PAR-06.1 and PAR-06.2 above are what prove Parsewise.

## PAR-07 · What is owed

- **The runtime.** E193.06 builds it; until it answers, every kit surface here shows
  `unreachable`, which is the honest state and is drive-proven in `drive-198-parsing-qr.py`.
- **The catalogue review surface** for `kind: 'catalogue'` (CAT-01's territory, PAR-04.3).
- **A corpus.** Real albaranes, real handwriting, real phone photographs, scored per field, with
  the per-field `resolution_status` mapped to a threshold below which the row arrives empty rather
  than wrong.
- **Deletion.** PAR-03.6 states that the Parsewise project is deleted after a read; the runtime
  must actually do it, and the release must show the deletion call.

---

# PAR-08 · THE DEGRADATION FLOOR — what the reader does to a photograph that got worse

**Authority:** FEED-IA §198 (E193.23). Peter, 2026-09-04, verbatim:

> for the parsing and qr shit, which should work flawlessly… i expect this to be fully working when
> we wire everything, as long as you design it all well, spec it well etc so that when you build and
> test it's piss play cos you can even test it by exporting and downresolutioning and even muddling
> or adding fake dirt to the image and then running it through scanning all programmatically without
> requiring me to print and test

PAR-06 ended by naming its own debt: «they do not measure accuracy on a creased handwritten note
photographed in a market at 05:40, and no line in this spec claims they do.» This section is the
first half of that debt paid — the same page, damaged the way a morning damages it, read through
the **live** runtime, compared field by field against the clean read.

**Measured 2026-09-04** against `https://kit.soyrocoto.com/api/parse`, `kind=albaran`, serially,
one Parsewise project per read. The command, verbatim:

```
/dev/shm/e193-harness-venv/bin/python tools/parse-harness.py --out <dir> --json <dir>/parse.json
```

Eight variants and no more, on purpose: each read is a full project — upload, dimension, seven
agents, launch, poll, delete — and cost **112 to 188 seconds** of a live provider's time. The reads
are cached on disk; only `--refresh` spends that time twice.

## PAR-08.0 · What «correct» means here

The reference is the **clean read**, not a hand-typed key. PAR-06.2 already checked the clean read
against the paper by eye — four lines, comma decimals as decimals, «caja» beside three «kg», the
total row not read as a line, the missing lot absent rather than borrowed. Comparing every degraded
read against THAT isolates exactly one variable, the damage, and asks the only question this
harness is entitled to ask: **does the picture getting worse change the answer?** A separate key
would fold the provider's own accuracy back in and measure two things at once.

The clean read, which every row below is measured against:

| # | name | qty | unit | price | lot |
|---:|---|---:|---|---:|---|
| 1 | Merluza grande | 12.5 | kg | 13.50 | L-250903 |
| 2 | Pulpo cocido | 21 | kg | 18.90 | L-250902 |
| 3 | Gamba roja | 3 | caja | 92.00 | L-250903 |
| 4 | Almeja fina | 4.25 | kg | 31.40 | *(absent)* |

Four rows, confidence 1.00, one page, one table, 188 s.

## PAR-08.1 · The sweep

| Variant | What it is | rows | name | qty | unit | price | lot | identical? | s |
|---|---|---:|---:|---:|---:|---:|---:|---|---:|
| `clean` | the sheet as exported | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | **yes** | 188 |
| `res-0.50` | half the printed density | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | **yes** | 112 |
| `blur-1.0` | gaussian blur σ 1 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | **yes** | 164 |
| `rot-10` | rotated 10° | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | **yes** | 112 |
| **`combo-0540`** | **a phone photo of a creased sheet at 05:40** — blur + skew + crease + dirt + uneven light + JPEG 50 twice | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | **yes** | 137 |
| `skew-mild` | mild perspective skew | 4/4 | 4/4 | **0/4** | **0/4** | 4/4 | 4/4 | no | 137 |
| `jpeg-30` | JPEG quality 30 | 4/4 | 0/4 | 0/4 | 2/4 | 0/4 | 1/4 | no | 137 |
| `dirt-05` | opaque blobs over 5 % and a coffee ring | **8/4** | 0/8 | — | — | — | — | no | 113 |

**THE FLOOR: the reader returns the clean read's exact rows through half the printed density,
σ 1 blur, a 10° rotation, and the whole 05:40 morning.** The morning photograph — the one Peter
named — reads perfectly: four lines, every name, quantity, unit, price and lot identical, in 137
seconds.

## PAR-08.2 · The three that changed, and what each one actually says

**`skew-mild` — the reader degraded HONESTLY, which is the behaviour the spec demands.** Names,
prices and lots came back right; **quantity and unit came back EMPTY on all four rows.** PAR-05:
«A field comes back unresolved → that field is empty in the proposal → never fills it from the row
beside it, from a default, or from the product.» That is exactly what happened. A skewed page cost
two columns and the reader said so instead of guessing. ✓ **This is a pass of the rule, recorded
as a change of the answer.**

**`jpeg-30` — every VALUE was right and the ORDER was lost.** Read the row diff and the four lines
are intact and internally consistent — Almeja fina · 4.25 · kg · 31.40 · no lot; Gamba roja · 3 ·
caja · 92.00 · L-250903 — but they came back **alphabetical**: Almeja, Gamba, Merluza, Pulpo. That
is THE-RUNTIME-SPEC §RUN-04.2's known shape: `all_dimension_values.Line` comes back alphabetical,
and the runtime sorts on its own «Line number» agent to put the paper's order back. **Under JPEG 30
the Line-number agent did not resolve, the sort had nothing to sort on, and the alphabetical order
survived silently.** ⚠ **DEFECT, and it is OWED (PAR-09):** the runtime must not present rows in an
order it could not establish. Either the order is known and the rows carry it, or the proposal says
so — a person checking a delivery note reads down the paper, and a proposal that re-sorts their
lines without saying it is a proposal they have to re-sort by hand.

**`dirt-05` — eight rows for a four-line albarán.** This is PAR-02.3a's failure mode, live: the
dynamic `Line` dimension discovered its instance labels per agent, one set keyed by product code
(`MER-001`…) and one by product name (`Merluza grande`…), and the join emitted both — four complete
rows and four carrying only a label. PAR-02.3a states the two defences: join on the instance's
**id**, and **drop any row whose only populated field is the label**. ⚠ **The second one did not
fire here and that is a DEFECT, OWED (PAR-09).** The lesson holds and gets sharper: a stable
dimension description is a prompt, not a guarantee, and belt-and-braces has to actually be
buckled — a reader that hands a person eight lines for a four-line note has broken the one promise
PAR-00 makes, that a parse is a proposal a person can check against the source at a glance.

## PAR-08.3 · The harness, and what it is not

`tools/parse-harness.py` builds the variants with `tools/degrade.py` — the same deterministic,
seeded library the QR harness damages the packing mark with, so the two floors are comparable
numbers rather than two people's adjectives. `drives/drive-201-degradation.py` re-asserts ONE
variant of this table against the live runtime, opt-in behind `ROCOTO_RUNTIME_LIVE_PARSE=1`, for
the same reason `drive-198`'s W6 leg is opt-in: it spends a provider's time and a real key.

⚠ **What this still does not prove.** One synthetic page, printed type, one language, four lines.
It proves what damage does to a reading; it does not measure accuracy across real handwriting,
real suppliers' layouts or real phone photographs. PAR-07's corpus is still owed and this section
does not discharge it — it narrows it to «the corpus question is now about CONTENT, because the
CAPTURE question has an answer».

## PAR-09 · The two defects, CLOSED — and the three words the answer now carries

**Closed 2026-09-04 (W14) in `mock-api/app/parsewise.py`'s shaping, proven red-then-green on recorded
reads, held by `drive-201`, and re-proven live through `https://kit.soyrocoto.com/api/parse` at code
`73f1b3b2a26c`.** Both fixes obey one rule, and it is the rule PAR-00 already made: **what the
runtime did to the provider's answer is ON the answer.** A sort that re-orders a delivery note and a
join that doubles its rows are the same silence, and the cure for silence is a sentence.

### PAR-09.1 · The order defect — `evidence.lineOrder`

Every `ParseResult` now names where its row order came from:

| `lineOrder` | what it means |
|---|---|
| `numbered` | Every line stated its position through the «Line number» agent, and the rows stand in it. |
| `read-order` | Every line cites a page and no two lines share one, so the pages **are** the reading order. |
| `unknown` | Neither. The rows go out whole, and the answer states that the order behind them was not established. |

A line that states no position still keeps its place behind the ones that do (§RUN-04.2), and a
numbering that covers only part of the table leaves the list as a whole `unknown` — half a numbering
orders half a page.

⚠ **«The order they arrived in» is not an answer, and three recordings are why.** The obvious
fallback — where the rows first appeared in the provider's result list — was measured before it was
trusted: Parsewise groups its results by agent, and the order of the labels inside an agent moves
from read to read. The recorded clean read's first-appearance order is exactly its own alphabetical
listing (`all_dimension_values.Line`, §RUN-04.2); the two recorded degraded reads are two other
orders. Arrival is the provider's bookkeeping, so an order taken from it would be a claim about the
paper made out of something that is not about the paper. Beyond the «Line number» agent the payload
carries exactly one position — the **page** each value cites — and `read-order` is read off that and
nothing else.

### PAR-09.2 · The row-split defect — the merge, and its count

Groups that are one printed line are merged before they are rows, and `evidence.rowsMerged` says how
many folds it took. The runtime joins two groups on a **fact the page states**, never on a likeness:

- two groups stating the **same line number** are one line — a position holds one line;
- a group carrying nothing beyond its label folds into the line it names: its whole label is that
  line's stated position («1» beside Line number 1), or its code, or its name, or the code/name pair
  the other's label spells out («Merluza grande» inside «MER-001 Merluza grande»);
- **two groups that both carry goods stay two lines.** A note may print the same product twice, and
  a merge that ate a repeat would delete a delivery.

A merged line takes the other's values only into its **empty** fields — picking between two stated
answers on a person's behalf is the guessing §PAR-03.4 forbids — and an ambiguous match is left
alone rather than resolved by the machine.

Then PAR-02.3a's second defence fires, buckled at last: a group carrying nothing but its own label,
standing beside groups that carry goods, is dropped and counted in `evidence.rowsDropped`. It fires
only beside goods. A read where **nothing** came back but names is a thin read and it is returned
thin — PAR-05 keeps the line and empties the field, and reporting an empty page for a page with a
table on it would be the invention this runtime never makes.

⚠ **PAR-02.3a's first defence was withdrawn, because the payload cannot carry it** (the correction is
written into that section too): the provider mints a fresh `dimension_instances[0].id` per result
row — 23 ids for the four lines of the recorded clean read — so an id join splits every line into one
row per column. The label is the only key on offer and this merge is what makes it safe.

### PAR-09.3 · The fixtures — and what recording them proved

`backend/tests/record_degraded_reads.py` re-read the two damaged images through Parsewise and wrote
the results bodies verbatim into `backend/tests/fixtures/parsewise-jpeg-30-raw.json` and
`parsewise-dirt-05-raw.json` (the PNGs are byte-identical to the ones the harness sent — the recorder
checks). `backend/tests/fixtures/albaran-degraded-reads.json` gained what `/api/parse` answered on
both variants under the old shaping, so the fix has the defect itself as its key.

⚠ **Neither re-read reproduced its defect.** Same pixels, same day, same configuration: the «Line
number» agent resolved this time, and every agent keyed its instances alike. **Both defects are
non-deterministic provider behaviours**, which settles how they must be guarded — a live call can
report a good read and prove nothing, so the guard is a recording. Each defect is put back into its
own recording by ONE stated change (the position agent unresolved; one agent's labels swapped for the
positions the other agents stated), and against the pre-fix shaping those bodies return exactly what
the live reads returned: four lines out of printed order, and **eight rows for a four-line note**
named `MER-001 · PUL-004 · GAM-010 · ALM-002` plus four labels.

**The proof:** 13 new checks in `backend/tests/test_parse_degraded.py` (suite 53 → **66**, all green;
all 13 red against the pre-fix module), 4 new offline checks in `drive-201-degradation.py`
(**32 GREEN / 0 RED**, up from 28) and one more on its live leg. Live, after the deploy: `jpeg-30`
**4/4 rows, every field the clean read's, 137 s** and `dirt-05` **4/4 rows, every field the clean
read's, 163 s**, both answering `lineOrder: numbered · rowsMerged: 0 · rowsDropped: 0`.

### PAR-09.4 · What is owed after the closure

- **The kit's own surface.** The runtime states `lineOrder`; the albarán intake still shows the same
  evidence line whatever it says. A read that comes back `unknown` should say so on the proposal, in
  the place the person reads before they check the paper — `app/src/prototypes/cedar/parsing.ts`'s
  `evidenceLine`, which this round left alone.
- **THE-RUNTIME-SPEC §RUN-04.2** describes the sort as the whole answer to the ordering question. It
  now has three answers and needs the paragraph.
- **The dimension description.** PAR-02.3a's wording («the instance is identified by the product code
  printed at the start of the line…») is still the wording the runtime does NOT send — the agents
  carry the original description, and this round bought its safety with the merge instead. Sending
  the sharper description would change what the provider returns, so it is a measurement of its own.
- **PAR-07's corpus**, unchanged and still owed.

---

# PAR-10 · THE WAIT — the provider's floor, and the runtime's own share of it

**Authority:** FEED-IA §198 («which should work flawlessly»), §196.5. Board rows E195.10 · E195.11.

A person photographs a delivery note in a market and holds the phone while the app reads it. §PAR-03
sized that wait off ONE number — PAR-06.2's «about two and a half minutes» — and that number turned
out to be two numbers added together: what Parsewise takes, and how long the runtime went before
asking again. This section separates them, states both as measurements, and says which one the
runtime owns.

## PAR-10.1 · What the day's journal said

The **67 reads between 14:01:27 and 20:17:13 on 2026-09-04** — the whole retained journal up to the
deploy restart at 20:21:50 — read straight off the box
(`journalctl -u rocoto-kit-runtime --since '2026-09-04 00:00:00' | grep 'parsewise read'`):

| | ms |
|---|---:|
| fastest | 40 433 |
| p50 | 111 000 |
| p90 | 162 587 |
| slowest | 214 278 |

(Percentiles nearest-rank, over that window. One window, one set of numbers: every count in this
section and on board rows E195.10 · E195.11 is this one.)

⚠ **FOUR RUNTIME STARTS SIT INSIDE THE MEASUREMENT WINDOW, and the A→B comparison has to say so**
(the E194/E195 integration, from the box's own journal, `journalctl -u rocoto-kit-runtime`):
**14:21:50 · 17:14:57 · 20:21:50 · 01:23:29**, with a fifth at 01:41:41 after the last read of the
ten-read set at 01:36:05. The 20:21:50 restart is the one this section names — it is the A/B
boundary, the deploy that put E195.11's ladder live. **The other three are not that**, and two of
them are INSIDE the A window: the 67 reads of «A» were served by a process that was replaced twice
while they ran. So «A» is a window rather than a single build, and the honest reading of A→B is
«the ladder's rungs are visible in A and gone in B» — which the rung arithmetic above shows
directly — rather than «this one change moved the p50 by 33 s». The claim the numbers carry on
their own is the one PAR-10.2 makes from the PROVIDER's own time, which is measured per read and
does not depend on which process asked.

Every single value sat on one of eight rungs — 41 · 60 · 86 · 112 · 137 · 162 · 188 · 214 s — and
those rungs are arithmetic, not weather: the wait slept 5 s and multiplied the delay by 1.4 up to a
25 s cap, so it asked at 5, 12, 22, 36, 55, 80, 105, 130, 155, 180, 205 s and the ~3 s of setup put
each answer where the journal found it. A read is reported at the first rung AFTER it finished, so
the ladder alone could add up to 25 s to any read.

## PAR-10.2 · The floor, measured directly

The historical `tools/parse-floor-probe.py` measurement (E195.10) ran on the box against the live API, doing exactly what
`read_raw` does but polling every **2 seconds** and recording, at each poll, the elapsed time and
every agent's `extraction_status`. Twenty-three reads of the one-page fixture albarán across three
sessions, in the order they ran:

| session | provider finished (s) |
|---|---|
| 2026-09-04 20:0x | 81.9 · 72.9 · 105.0 |
| 2026-09-04 20:4x (the agent-POST A/B) | 100.1 · 82.2 · 114.2 · 111.3 · 123.7 · 95.1 · 118.5 · 112.0 |
| 2026-09-05 01:0x (the setup A/B, the row count, the byte run) | 62.7 · 74.7 · 53.8 · 56.6 · 56.7 · 58.3 · 76.6 · 64.8 · 78.7 · 77.0 · 86.0 · 63.2 |

**The floor is the provider's.** The same page, read on the same configuration, took **53.8 s to
123.7 s**, and the whole band moved between sessions — the 20:4x reads sit at a median of 112 s, the
01:0x reads at 64 s. That is the provider's own queue, and no loop on this side reaches it.

**The runtime now states that floor on every read.** Since E195.11 a second journal line,
`parsewise waited`, carries the provider's own time in ms. Over the **47 reads between 20:23:51 on
2026-09-04 and 00:37:48 on 2026-09-05**: fastest **44 054 ms**, p50 **76 702**, p90 **135 467**,
slowest **190 722**. So the honest band for one page through this provider is **44–191 s**, and its
middle is about **77 s**.

**Row count: what was actually shown.** Twenty goods lines against four, the same page otherwise —
same header, same columns, same typeface (`backend/tests/make_fixture_albaran.py <path> 20`) — three
reads an arm, interleaved so provider drift hits both alike:

| page | provider finished (s) | median | result rows |
|---|---|---:|---:|
| 4 goods lines | 77.0 · 78.7 · 86.0 | **78.7** | 30 |
| 20 goods lines | 65.6 · 99.9 · 110.8 | **99.9** | 142 |

**Five times the rows moved the median by 21 s and the two arms overlap** — the fastest 20-line read
(65.6 s) beat every 4-line read. With three runs an arm and a 45 s spread inside one of them, this
cannot separate a row-count effect from the provider's own run-to-run variation; what it does say is
that a page with five times the goods lines was nowhere near five times slower. The one place the
extra rows show plainly is the parsing stage: `parsing_state` reached `ready` at 19.5 · 22.3 · 42.8 s
on the long page against 12.7 · 15.7 · 17.1 s on the short one.

⚠ The earlier reading of this — «row count does not move it», taken from a four-line page against a
two-line page — claimed more than two pages one row apart can carry. This table replaces it.

The transcript says where the rest of the time goes: document parsing holds the first **8–43 s**,
extraction then runs, the three header agents finish first, and the seven dimensioned agents flip to
`Processed` together at the end, when resolution consolidates them. Nothing in that sequence is the
runtime's to shorten.

⚠ **A target this measurement refuses.** «p50 under 30 s» was the goal E195 set out with. It cannot
be had from this provider with this configuration: the fastest complete read ever measured here is
53.8 s, the live p50 of the provider's own time is 77 s, and all of it is Parsewise's processing.
Reaching 30 s means a different reader, not a different loop — and §PAR-07's corpus question would
have to be re-answered for it. The honest number is written above.

## PAR-10.3 · What the runtime owns, and what it now does

The runtime's share of a read is three things: the setup POSTs, the poll granularity, and the
results-plus-delete tail. Measured on the box, and the calls counted off the box's own httpx journal
lines grouped by project id — one group is one read:

| per read | A · the old ladder (n=67) | B · E195.11 (n=47) | C · the gate (n=10) |
|---|---:|---:|---:|
| setup (project → upload → dimension → 10 agents → launch) | 2.93 s | **1.60 s** | **1.60 s** |
| worst case added by the poll ladder | 25 s | **4 s** | **4 s** |
| `GET /agents/status/` — the endpoint the provider calls expensive | 7 | **1** | **1** |
| `GET /agents/` — 10 agent objects, 10 430 B an answer | 7 | 20 | **4** |
| `GET /projects/{id}/status/` — 116 B an answer | 0 | 0 | 18 |
| **TOTAL Parsewise calls** | 28.0 | 36.0 | **38.0** |
| **bytes pulled while polling** | 104.1 KB | 208.4 KB | **47.5 KB** |
| read as the journal reports it, p50 | 111.0 s | 77.7 s | 69.3 s |

(Medians. A and B are the complete reads in their windows; C is the ten reads of the fixture through
`https://kit.soyrocoto.com/api/parse` between 01:25:22 and 01:36:05 on 2026-09-05, after the
01:23:29 deploy. The byte figures apply the measured median payloads — gate 116 B, `/agents/`
10 430 B, `/agents/status/` 4 803 B — to each read's own call counts. The two setup rows are the
probe's own timings, `setup-seq` against `setup-par`, not journal counts.)

**THE CALL COUNT ROSE, AND IT IS STATED HERE BECAUSE IT ROSE.** 28 → 36 → 38 calls per read: the
gate adds one call a rung and the belt adds about four reads of the agents list, and that is more
requests than the loop this replaced made. What fell is the weight of them — the polling bytes went
104 KB → 208 KB → **47.5 KB**, below where they started — and the endpoint now asked eighteen times
a read is the one Parsewise built to be asked that often, at 116 bytes an answer.

**The conflict with the provider's guidance, quoted on both sides.** Parsewise's `AGENTS.md`, step 5
of «The usual flow», says: «Extraction runs typically take at least tens of seconds and often
minutes — **poll every 30-60s rather than hammering the endpoint on a tight loop**.» Its OpenAPI
schema says of `GET /projects/{id}/status/`: «Compact processing status for a project, **intended
for frequent polling (for example, every 5 seconds)** while documents are being parsed or agents are
running», and of `GET /projects/{id}/agents/status/`: «**More expensive** than
`GET /projects/{project_id}/status/`; we recommend polling this endpoint only while
`pipeline_running` is true.» The two guidances point different ways, and this loop follows the
second: the question asked every rung goes to the endpoint documented for five-second polling, and
the two calls that carry §PAR-03.3's predicate are asked when it says the pipeline has gone quiet.

**Why the trade is taken.** A person is holding a phone over a delivery note. The provider's own
time is 44–191 s and none of it is ours to remove; the only thing left to lose is the gap between
the provider finishing and the app saying so. At a 30 s poll that gap is up to 30 s on a 77 s read —
a third again of the wait, for nothing. At a 4 s cap it is at most 4 s, and it costs 18 calls of
116 bytes. **If that trade is ever refused, `POLL_CAP` is the one number to change** — at 8 s the
gap doubles and the gate calls roughly halve; the ladder is three constants at the top of
`mock-api/app/parsewise.py`.

### The three calls, and the one that is asked often

1. **The gate — `GET /projects/{id}/status/`, every rung.** Compact (116 B measured), 97 ms, and
   the endpoint the provider documents for frequent polling. It carries `pipeline_running` and it
   **decides nothing**: it says only whether the other two are worth asking yet.
2. **`GET /agents/`** — the first half of the predicate. Each agent carries its own
   `extraction_status` (Parsewise: «so you do not need an additional request to know whether it has
   finished extracting»), and a fresh agent is `Pending`, so an agent cannot read done before it has
   run. 10 430 B measured — ten agent objects — which is why it is no longer asked twenty times.
3. **`GET /agents/status/`** — the second half, the expensive one, asked once.

**The gate may delay the question and may never answer it.** Every fifth rung asks the full pair
whatever the gate said (`GATE_EVERY = 5`), so a gate that lagged, stuck at `true`, or started
answering 500 could cost a finished read five rungs — about twenty seconds — and could never hold
one open. `backend/tests/test_parse_wait.py` holds both directions: a quiet gate beside a pending
agent still times out, and a gate that never opens still finishes on the belt.

**§PAR-03.3's done-definition is untouched.** «Done» is still `pipeline_running=false` AND every
agent `Processed` or `No Result`, both read fresh, on the same rung, before the wait returns. The
predicate is the same predicate; the gate is a question about whether to ask it.

### The two concurrencies, each A/B'd against its own arm

E195.11 made two things concurrent that had been sequential: the ten agent POSTs, and the document
upload beside the dimension creation. Two of seven live reads that day came back **thin** — four
rows with names and quantities, every unit, price and lot empty — and a race in the setup was a
plausible cause. Each concurrency was therefore tested against its own arm on the box, interleaved
so provider drift hits both alike:

| what varied | queued | concurrent | what came back |
|---|---|---|---|
| the ten agent POSTs (2026-09-04 20:4x) | 100.1 · 114.2 · 123.7 · 118.5 s | 82.2 · 111.3 · 95.1 · 112.0 s | **4/4 and 4/4 complete** — 30 result rows, every agent resolving |
| the upload beside the dimension (2026-09-05 01:0x) | 56.7 · 58.3 · 76.6 · 64.8 s | 62.7 · 74.7 · 53.8 · 56.6 s | **4/4 and 4/4 complete** — 30 result rows, every agent resolving |

⚠ **What the first experiment did and did not vary.** It was four reads with the agent POSTs queued
against four with them concurrent — and only that. The probe's `full-seq` mode raced the upload and
the dimension in BOTH arms, so the second concurrency stayed untested until the second experiment
above; `tools/parse-floor-probe.py` now carries a `full-setup-seq` mode that varies it, and its
`full-seq` branch no longer implies a difference it never made.

⚠ **And neither experiment is powerful.** Sixteen reads against a defect rate near two in ten cannot
detect a small increase. What they show is that no arm produced a defective read at all, in either
experiment, on either concurrency.

### What ten live reads of one page also showed

The ten reads of the fixture through `https://kit.soyrocoto.com/api/parse` between 01:25:22 and
01:36:05 on 2026-09-05, after the deploy that put the gate live: **eight came back with all four
rows complete**, one came back with a single row, and one came back with **no rows at all** after
31.7 s — faster than any provider time measured before it. That read's wait was honest and the
journal states it: `{"msg":"parsewise waited","ms":31693,"outcome":"9 polls"}`, and rung 9 is not a
belt rung (9 % 5 = 4), so the gate read quiet, then every agent read terminal, then
`pipeline_running` read false. All three agreed: the provider ended that run early and found
nothing. §PAR-05 left the fields empty rather than inventing them and the read reported `0 rows`.
The old ladder would have reported the same nothing at about 39.5 s (its rungs are 5 · 12 · 21.8 ·
35.5 s of sleep, plus the setup and the tail) instead of 33.4 s — a ladder changes when a read is
noticed, never what the provider found. No Parsewise call in this whole journal answered anything
but 2xx, so this is not throttling either.

So the same page, the same configuration, the same hour, still returns complete · thin · empty.
§PAR-09.3 recorded these as non-deterministic provider behaviours and they are unchanged: **8
complete, 1 partial, 1 empty in 10** today. §PAR-07's corpus is what answers it, and this round did
not touch accuracy.

### The two `pipeline_running` endpoints, measured against each other

`GET /projects/{id}/status/` and `GET /projects/{id}/agents/status/` both carry `pipeline_running`,
and whether they agree decides whether the cheap one may be the gate. Measured on the box across
**14 probe reads, 439 paired polls**: the two GETs were issued in ONE `asyncio.gather`, with the
order they are listed in ALTERNATING per poll so dispatch order cannot masquerade as a difference.

- **439 polls, 0 disagreements.** Every poll, including all fourteen final ones, read the same flag
  from both endpoints.
- The two requests left this side 1.75 ms apart at the median (max 8.2 ms).
- They are not the same cost: the compact one answered in **85 ms** at the median, the expensive one
  in **135 ms**, and their bodies are **116 B** against **4 803 B**.

**WHY THE GATE IS SAFE BY CONSTRUCTION, and the 439 polls are the belt's evidence rather than its
licence.** The measurement above says the two endpoints agreed 439 times out of 439. A measurement
of a provider's behaviour is a fact about the hours it was taken in, so the loop is built to be
correct EVEN IF the gate is wrong, in each of the three ways it can be:

- **The gate says «still running» when the run is finished.** It costs rungs, and it is bounded:
  `GATE_EVERY = 5` asks the full pair on every fifth rung whatever the gate said, so a permanently
  stuck gate delays a finished read by at most four rungs — about 16 s on the shipped ladder — and
  can never hold one open. `test_parse_wait.py` proves it with a gate that never opens.
- **The gate says «quiet» when the run is still going.** It costs nothing at all: the gate opens the
  DOOR to the predicate, and §PAR-03.3's predicate — `pipeline_running=false` AND every agent
  `Processed`/`No Result`, both read fresh on the same rung — then answers for itself. A gate that
  lies quiet buys one extra pair of calls and the wait continues. `test_parse_wait.py` proves that
  direction too: a quiet gate beside a pending agent times out rather than returning.
- **The gate stops answering.** A refusal or a timeout on the gate is read as «keep waiting», so the
  belt carries the read on the same four-rung bound as the first case.

So the ONLY thing the gate can change is WHEN the predicate is asked, and the worst case is bounded
by a constant in the file. `POLL_CAP` is the one number to change if that trade is ever refused.

⚠ **What the first pass claimed here, and why it is withdrawn.** E195.10 recorded that the compact
endpoint «LAGS», on ONE poll out of nine recorded runs: floor-run-2 at t=72.91 read `true` from the
compact endpoint while the expensive one read `false`. In that probe the two GETs were issued
**sequentially, cheap first** — the compact call went out **76 ms before** the expensive one, which
is the direction the call order predicts and enough on its own to explain the difference. Eight of
the nine runs agreed at the final poll. The claim was larger than its evidence and is replaced by
the 439-poll measurement above.

## PAR-10.4 · One read is one project, and the paper dies with it

Parsewise's API does offer the parts a long-lived project would need — `DELETE
/projects/{id}/documents/{document_id}/` («Permanently delete a document and all extraction results
derived from it»), a reserved system `Document` dimension whose values mirror file names, and a
`filters` query on `/results/`. A per-kind project holding pre-created agents was considered on that
evidence and **rejected on a correctness ground, stated here so it is not re-proposed**:

`pipeline_running` is a PROJECT fact, `POST /agents/launch/` launches the project, and
`GET /agents/status/` reports agents, not documents. The only per-document signal the API offers is
`pending_documents`, which covers PARSING and says nothing about extraction. So in a shared project
a read could only know it was done by watching for its own document's rows to appear — and an agent
that legitimately returns `No Result` for that document never appears, so «all columns present»
either waits forever or weakens §PAR-03.3. Two reads at once would also each wait for the other's
document, and the kit does fire concurrent reads: four projects were in flight together in the
journal at 19:46 on 2026-09-04.

**What IS: one read is one project.** It holds one document, and deleting the project deletes the
document and every result derived from it. That is what makes the project-level done-signal mean
«this read», and it is the same act that keeps §PAR-03.6 · SRC-PRIV-07 — the customer's paper lives
at the provider for the length of one read, and the deletion is reported in the journal as
`deleted` or `retained_<status>`.

### The signal the API offers that this loop does not use: a completion callback

Polling is not the only way Parsewise will tell a caller a run has finished, and the record has to
say so. Read with the kit's own key from the box on 2026-09-05:

```
GET /api/v1/webhooks/events/     → 200
[{"name":"agent.completion.succeeded",
  "description":"Fired when an agent extraction pipeline completes successfully for a project.",
  "group":"agent"},
 {"name":"agent.completion.failed",
  "description":"Fired when an agent extraction pipeline fails terminally.","group":"agent"}]
GET /api/v1/webhooks/            → 200 []          (this tenant has none registered)
```

`POST /api/v1/webhooks/` takes `url` («HTTPS URL Parsewise will POST webhook events to»),
`subscribed_events`, an optional `name`, and optional custom `headers` («Encrypted at rest») — so a
shared secret can ride along. `POST /api/v1/webhooks/{id}/test/` sends one synthetic `webhook.ping`
so a handler can be proven before any real event fires. The runtime already answers publicly, at
`kit.soyrocoto.com/api`, so the address exists.

**What the OpenAPI schema documents, exactly.** The SUBSCRIPTION side is fully specified:
`V1WebhookSubscriptionWriteRequest` (an HTTPS `url` up to 2048 chars, `subscribed_events`, an
optional `name`, and `headers` — «Custom HTTP headers to include with every delivery. Encrypted at
rest. Up to 10 entries; values up to 1KB each; total ≤ 4KB», with Host, Connection, Content-Length,
Transfer-Encoding, Content-Type and any `Parsewise-*` header reserved), `V1WebhookSubscription` on
the read side (`is_active`, `created_at`, header KEYS with values always redacted),
`V1WebhookEvent` for the two event names, and `V1WebhookTestResponse` — `ok`, `status_code`,
`duration_ms`, `error`, `delivery_id` — which is the RESULT OF THE ATTEMPT, one try with no retries,
recorded as a `WebhookDelivery` row for audit. What the schema leaves to be measured is the one
thing a handler is written against: **the body Parsewise POSTs to the subscribed URL**. The schema
names no delivery-payload object, so the first step of taking this road is `POST
/webhooks/{id}/test/` against a live handler and reading what actually arrives — a `webhook.ping`
first, then one real `agent.completion.succeeded`.

**Why the ladder still stands and the callback is owed rather than taken:** subscriptions are
TENANT-scoped rather than per project, so one URL receives the completion of every read this key
ever launches and the runtime must match each event to the request holding the phone open; the
delivered body is measured before it is parsed, per the paragraph above; correlating an inbound POST
with an in-flight read is a dictionary in one uvicorn process and a shared bus the moment there are
two; and a callback that is late or lost still needs a ladder underneath it. That is a design, and
PAR-10.5 owes it as one rather than half-built under a latency fix.

## PAR-10.5 · What is owed after this

- **The completion webhook.** `agent.completion.succeeded` exists, the subscription endpoint exists,
  and the runtime has a public address. Taken properly it replaces twenty polls with one inbound
  POST, and the ladder stays underneath as the fallback. What it needs first: the DELIVERED BODY
  measured — the OpenAPI specifies the subscription, its headers and the test call's result
  (`V1WebhookTestResponse`), and leaves the POSTed event body to be read off a live handler, so the
  first step is `POST /webhooks/{id}/test/`'s `webhook.ping` and then one real
  `agent.completion.succeeded` — a shared secret in the subscription's `headers` (encrypted at rest,
  ≤ 10 entries, ≤ 4 KB), a correlation from `project_id` to the waiting request, and an answer for
  two workers.
- **A poll token.** `/api/parse` holds a request open for the provider's 44–191 s. THE-RUNTIME-SPEC
  §RUN-11.7 already names the answer if a proxy or a phone network starts cutting it: a `202` and a
  token, not a shorter wait. Nothing here changes that seam.
- **The 30-second read.** It belongs to the corpus question of §PAR-07: a different reader for the
  common case, measured against the same fixture and the same degradations, with Parsewise kept for
  what it is best at. This spec states the floor so that decision has a number to beat.
- **A latency line in the app.** The kit's `reading` posture says «Reading the document…» and says
  nothing about how long that is. The measured band belongs on that surface; `parsing.ts`'s
  `evidenceLine` is where it would go, and this round left it alone.
- **A row count with real weight.** PAR-10.2's 20-line page is still a synthetic page. Whether a
  real forty-line albarán photographed at 05:40 reads in the same band is §PAR-07's corpus question
  wearing a stopwatch.

---

## PAR-11 · Our own paper is read by THE-PAPER-SPEC

Everything above reads a document **somebody else printed**. Paper this house printed takes the other
road, and it has its own document: [THE-PAPER-SPEC](THE-PAPER-SPEC.md) — the layout manifest recorded
at print time, `POST /api/paper/read`, and the floor it was measured at (FEED-IA §199.1).


### Parsewise probe execution — 2026-09-08

The maintained [probe](../tools/parse-floor-probe.py) runs from a development checkout with an
explicit `--fixture` and `PARSEWISE_API_KEY` supplied from the chosen sandbox provider account.
`--help` and configuration checks run without provider dependencies or host secret files.
The earlier measurements above retain their original provider posture and results.
