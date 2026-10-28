# THE STOCK & LOTS SPEC — Traceable physical inventory

**Status:** canonical production contract for **LOT-01**. This document specifies the target
behaviour for lots, receipts, counts, reservations, allocations, physical depletion, traceability
and recall. It does not claim that a durable inventory service, supplier integration, warehouse
scanner, or provider connection is already live.

## LOT-00 · Authority, scope and reading order

This is a rank-3 detailed contract in the authority chain:

1. [THE-ARCHITECTURE.md](THE-ARCHITECTURE.md) decides system ownership, source-of-truth rules and
   supersessions.
2. [THE-SYSTEM-SPEC.md](THE-SYSTEM-SPEC.md) decides production runtime, roles, lifecycle,
   security, reliability and stock meaning under **INV-01**.
3. This document decides detailed **LOT-01** lot behaviour and the literal anatomy of its controls.
   [THE-PRODUCT-SHEET-SPEC.md](THE-PRODUCT-SHEET-SPEC.md) decides the surrounding Product Sheet,
   and [THE-INTERACTION-SPEC.md](THE-INTERACTION-SPEC.md) decides shared route, draft, overlay,
   focus, responsive and accessibility behaviour.
4. [THE-WIRING-TASKLIST.md](omitted-sources.md) turns the contracts into owned work and test
   evidence; it cannot weaken them.

[THE-OBJECT-MAP.md](THE-OBJECT-MAP.md) is the companion ownership reference. It names a lot and a
lot commitment as related domain objects, never a fourth primary object-sheet grammar. A lot opens
an inspector/drawer or focused Stock route; it is not a Product Sheet.

This contract applies only to a **tenant, exact SKU, stock location and canonical inventory unit**.
A family, category, supplier name, similarly named item, customer alias, supplier-email subject or
forecast cannot select, create, merge or consume a lot. Supplier email is retained source evidence;
it is not an inventory command.

The words **must**, **must not**, **only**, and **never** are acceptance requirements. “Suggested”
means a user may change or decline it before an authoritative command; it is not recorded as fact
until the command succeeds.

## LOT-01 · What a lot is and what it is not

A lot gives a business a truthful answer to four separate questions:

- Which exact SKU and physical location does this material belong to?
- Which physical identifier was observed on it, and what source supports that identifier?
- How much of that identified material is recorded after receipts, counts and actual depletion?
- Which order lines are holding, using or have consumed it?

It does **not** turn an expected delivery, a supplier claim, a daily estimate, a demand prediction,
a customer order, a barcode scan waiting to be saved, or a quantity slider into physical stock.

### The words on screen

| Product term | Meaning | Must never be shortened into |
|---|---|---|
| **Lot number** | The physical supplier/manufacturer/internal label a person entered or selected for one named lot. It is displayed for people; it is not the database identity. | “Lot slider”, automatic code, guessed code |
| **Recorded balance** | Evidence-backed physical quantity for the SKU/location after accepted receipts, counts, physical depletion and approved physical corrections. | availability, forecast, expected delivery |
| **Unassigned stock** | Recorded physical quantity whose lot identity is not known well enough to call it a named lot. It is visible and auditable. | a made-up lot number or hidden residual |
| **Available to promise** | Recorded physical quantity less active holds/allocations, subject to SKU/location fulfilment policy. | recorded balance or supplier promise |
| **Expected delivery** | Supplier-confirmed inbound with source and due time. It does not add to a lot or balance until actually received. | stock on hand |
| **Daily stock estimate** | A user planning assumption. It does not add to a lot, balance, availability or delivery promise. | expected delivery |
| **Reserve** | Hold a quantity for a work item without claiming physical stock left the location. | receipt, dispatch or deduction |
| **Assign stock to lots** | Split an already recorded physical balance between named lot positions and Unassigned stock. It does not change the balance. | order allocation, receipt or dispatch |
| **Allocate** | Attach a named lot/unassigned quantity to one albarán line for fulfilment. It does not deduct physical stock. | receipt or dispatch |
| **Record stock sent** | Record actual physical depletion attributable to a fulfilled line/lot. | reserve, allocate or print |

### Non-negotiable lot laws

1. A durable **lot ID** is an opaque immutable ID. A visible lot number is typed by a person or
   selected from an existing named lot. A slider changes **quantity only**; it never chooses or
   creates a lot number.
2. A visible lot number is not globally unique and is not a primary key. The same normalized text
   may appear in several tenants, SKUs, locations, suppliers, dates or genuinely distinct physical
   lots. The system never auto-merges records because their displayed codes match.
3. A newly named lot requires an entered lot number and provenance. If the physical lot number is
   not known, the quantity remains **Unassigned stock**. The product must not synthesize a plausible
   supplier lot code from time, SKU, receipt, or a rule.
4. Only accepted physical receipt, count, physical depletion and approved physical-correction
   events can change **Recorded balance**. Reserve, allocate, release and reassign only change
   commitment/attribution projections. They cannot add or remove physical quantity.
5. A receipt is evidence that quantity arrived. A count is evidence of the physical total found at
   a moment. A named lot found while counting has **physical-count** provenance; it must not be
   described as supplier-delivered material without supplier evidence.
6. Every physical quantity is either in exactly one named lot position or in the explicit
   unassigned position for its SKU/location/unit. The positions add to Recorded balance exactly.
7. A fulfilled/dispatched traceable line records the lot(s) actually consumed. One line can use
   many lots; the commercial line does not split merely because its trace splits.
8. Historical receipts, accepted counts, issued albarán snapshots and physical-depletion facts are
   immutable. A correction adds a linked compensating/replacement fact with actor, reason,
   provenance and revision. It never rewrites history.
9. A lot with zero physical remainder may be depleted/closed but remains readable for source,
   history, recall and issued documents. An expired or blocked lot remains evidence; ordinary
   allocation is blocked by policy rather than hiding it.
10. “No lot recorded” and “no stock recorded” are different states. The former can coexist with an
    unassigned physical balance; the latter means no accepted physical evidence exists.

### SKU traceability policy

Each sellable SKU owns an explicit, versioned **traceability policy**. It is not inherited silently
from a family/category and is shown in **Product details & history**:

| Policy | Receipt and count | Reserve/allocation/depletion | Default wording |
|---|---|---|---|
| **Lot required** | Physical quantity cannot be finalized as unassigned. A new named lot needs a typed lot number. | Every reserve, allocation and depletion names a current eligible lot. | “This product needs a lot number.” |
| **Record when known** | Physical quantity may be explicitly recorded as Unassigned stock when its lot is not known. | A traceable line names lots when known; unassigned consumption is explicit and remains audit-visible. | “Add the lot number when you have it.” |
| **Lot not used** | No named lot controls are offered. Physical balance remains SKU/location evidence. | The system records SKU-level reserve/allocation/depletion with no false lot reference. | “Lots are not used for this product.” |

A user with catalogue permission can change this policy only through its own revision-checked
Product-details command with a reason. Raising it to **Lot required** is blocked while unassigned
stock or untraceable active commitments remain; the screen names affected records and offers their
safe resolution doors. Lowering it never deletes existing lot history.

## LOT-02 · Object ownership, identity and evidence

### Ownership graph

~~~mermaid
flowchart TD
  T[Tenant] --> SKU[Exact sellable SKU]
  SKU --> P[Inventory position: SKU + location + canonical unit]
  P --> L[Named lot]
  P --> U[Unassigned physical position]
  R[Receipt / count / depletion evidence] --> LP[Physical lot posting]
  LP --> P
  LP --> L
  SRC[Retained supplier source] -. supports .-> L
  L --> LC[Lot commitment]
  AL[Albarán line] --> LC
  AL --> DP[Physical depletion posting]
  DP --> L
  DP --> P
~~~

The relation from an albarán line to a lot commitment is a fulfilment relation, not ownership
transfer. The relation from a retained source to a lot is evidence and remains readable even if
parsing or classification changes later.

### Durable objects

| Object | Owner and immutable identity | Required fields | Mutable/versioned fields | Must never contain |
|---|---|---|---|---|
| **Inventory position** | tenant + SKU + location + canonical inventory unit | position ID, SKU/location/unit, policy revision | derived physical/commitment projections, cursor | family/category stock, supplier prediction, browser draft |
| **Named lot** | opaque lot ID, one tenant/SKU/location | lot ID, tenant, SKU, location, display lot number, normalized lookup value, origin, created event/actor/time | trace metadata revisions, lifecycle, display correction history | quantity as editable source-of-truth field, another SKU’s stock |
| **Unassigned position** | one durable position per inventory position, no invented lot ID/code | inventory-position ID, explicit unassigned marker | derived physical/commitment projection | synthetic supplier lot number |
| **Lot source link** | opaque source-link ID | lot ID, retained-source ID or count/receipt event ID, relation type, actor/time | review status; never original bytes/text | copied supplier-message text as editable business data |
| **Physical lot posting** | opaque posting ID, one source event and one position target | posting ID, event ID, lot ID or unassigned marker, signed canonical quantity, unit revision, purpose, actor/time | none; reversal is a new posting | forecast, reservation or uncommitted local draft |
| **Lot commitment** | opaque commitment ID, one tenant/SKU/location and work target | commitment ID, target kind/ID, lot/unassigned marker, quantity, state, source command/revision | state through append-only supersession/release facts | physical balance adjustment or unnamed target |
| **Lot trace revision** | opaque revision ID | lot ID, changed fields, prior/new values, reason, actor/time | none | modification of physical receipt/count/depletion fact |
| **Recall case** | opaque recall-case ID | scope, initiating evidence, state, actor/time | findings/review decisions | silent lot archive or message send |

### Named-lot identity fields

| Field | Field contract | Validation and saved result |
|---|---|---|
| **Lot number** | Required text for a new named lot. Placeholder: “For example, BATCH-0426”. It preserves entered display casing/punctuation and records a normalized lookup key separately. | Trim surrounding whitespace; reject blank, control characters, input beyond 120 characters and normalized collision until the person chooses **Use existing lot** or **Create a separate lot**. It is not generated by the system. |
| **Same physical lot?** | Appears only after a normalized-code match. Existing choices show lot number, SKU, location, supplier if known, received/count date, expiry if known, physical remainder and lifecycle. | Selecting one adds a posting/commitment to that exact lot ID. Selecting **Create a separate lot** requires **Why is this a separate lot?** and preserves matching candidates in review history. |
| **Why is this a separate lot?** | Required choice: **Different supplier**, **Different expiry**, **Different delivery**, **Different location**, **Different physical label**, or **Other reason**. **Other reason** opens **Explain the difference**. | Explain-the-difference is required, 3–500 characters, for Other. The reason is immutable provenance for the identity decision. |
| **Supplier** | Optional source selector, never free-text identity proof. Shows a retained supplier/source object or **No supplier recorded**. | A choice creates a source relation; it does not alter prior receipts. It can be absent for count-discovered material. |
| **Expiry date** | Optional date with timezone-free calendar meaning. Placeholder: “DD/MM/YYYY”. | Must be a real calendar date. A past date is allowed as evidence but marks the lot expired; it does not prevent recording a truthful receipt/count. |
| **Location** | Fixed to stock operation’s location and shown read-only in split editor. A transfer uses its own movement workflow. | A lot cannot be created across locations by editing this field. |
| **Source evidence** | Read-only link(s) to receipt, count, retained email, import row or attachment that supports claim. | Adding a link writes a trace revision/source link. It never overwrites original source. |

A lot number typed from a physical label may be used only after the person has selected exact
SKU/location context. The form deliberately does not search all tenant codes before establishing
that context; it prevents an innocent code match from leaking another SKU/location’s data.

### Code collision and duplicate decision

| Situation | Screen response | Authoritative result |
|---|---|---|
| No normalized match in this tenant/SKU/location | Show **New lot number** and required identity fields. | A lot-created event plus contextual posting, atomically where required. |
| One plausible same-context match | Show **Use existing lot: [code]** and **Create a separate lot**. Existing row includes trace detail to decide. | No merge occurs until a person selects existing. |
| Several same-context matches | Show **More than one lot has this number** with date/source/location/expiry/remainder. Require choice or separate-lot reason. | No default selection and no first-result behaviour. |
| Same code in another SKU/location/tenant | Do not expose protected records. Make no claim code is free/used outside current permitted scope. | A current-context new lot may be created if valid. |
| Legacy/generated-looking code | Label **Legacy lot label** with evidence confidence. It is selectable only after review. | Historical evidence only; appearance is never fresh source proof. |

## LOT-03 · Quantity, unit and ledger mathematics

### One exact quantity grammar

Every quantity uses the SKU’s canonical inventory unit and permitted decimal precision recorded on
the SKU’s unit/equivalence revision. The server receives decimal strings and performs decimal
arithmetic; binary floating-point values are not authority. A displayed conversion is an explanation
only until an explicit permitted conversion command selects a recorded equivalence revision.

| Rule | Requirement |
|---|---|
| Quantity field | Decimal text input with visible unit suffix and accessible name such as **Quantity from lot BATCH-0426, kilograms**. Empty is not zero. Zero is valid only where workflow permits it. |
| Precision | Input accepts only SKU configured scale. A whole-unit SKU rejects 1.5; a 0.001 kg SKU rejects more than three fractional places. Error names accepted increment. |
| Unit | A lot cannot mix units. A source-unit conversion shows source quantity, conversion rule/revision and canonical result before save. Unknown unit blocks physical command. |
| Negative value | Never valid in direct quantity field. A decrease is lower counted-after value or explicit physical depletion/reversal command. |
| Rounding | No silent rounding. A value that would round changes only after user edits it to permitted value. Sum calculations use same decimal scale and show exact residual. |
| Location | All split rows operate in one location. Cross-location transfer is paired physical movement with own evidence and is outside receipt/count/allocation editor. |

### Balance and commitment equations

~~~text
Recorded balance
  = Σ named-lot physical quantities + unassigned physical quantity

Available to promise
  = max(0, eligible recorded physical quantity − active commitments)

Receipt split
  = Σ receipt allocations to named lots + receipt allocation to unassigned = received quantity

Count-after split
  = Σ named-lot quantities after count + unassigned quantity after count = counted total

Allocation split
  = Σ active allocations for target line + explicit unallocated remainder = requested quantity
~~~

Eligible recorded physical quantity excludes lot blocked by expiry/quality/recall policy for new
ordinary allocation. It does not pretend blocked material disappeared from Recorded balance. An
active reservation becoming confirmed allocation replaces/supersedes same held quantity; it does
not subtract twice from Available to promise.

All equations are exact at canonical precision. A save button remains disabled until relevant
equation is satisfied or workflow expressly permits stated partial/unassigned remainder. Summary
never hides residual through rounding, last-row adjustment or synthetic lot.

### The only physical-change paths

| Accepted operation | Physical position result | Commitment result | What it must not do |
|---|---|---|---|
| **Receive stock** | Adds receipt quantity across named lots and/or unassigned position. | None unless separate hold requested afterwards. | Replace balance, infer delivery from supplier message, merge same-code lots automatically. |
| **Record stock count** | Sets new total through atomic per-lot/unassigned after quantities; emitted deltas reconcile physical ledger. | Existing commitments remain; shortages may become overcommitted and need resolution. | Treat suggested FIFO split as fact without review, rewrite receipt, cancel commitments silently. |
| **Record physical depletion** | Deducts actual consumed/lost/damaged/returned-out quantity from named lot/unassigned position. | Fulfils/releases associated commitment as applicable. | Deduct because document printed or merely allocated. |
| **Correct physical fact** | Adds linked compensating/replacement physical event, never in-place edit. | No unreviewed commitment rewrite. | Erase old event/history. |
| **Reserve / allocate / release / reassign** | **No change.** | Creates, changes, releases or supersedes commitments. | Change Recorded balance, lot receipt history or expected delivery. |
| **Reattribute unassigned stock to named lot** | Net zero: subtracts unassigned and adds named lot in one atomic physical-attribution event. | May then support separate allocation. | Create quantity, call it receipt, hide source/reason. |

### Atomicity and impossible states

A physical command writes all event rows, postings, audit record and outbox record in one
transaction. If any row is invalid, none is committed. A successful response includes accepted
command ID, aggregate revision and event cursor. A screen may wait for projection cursor, but must
never claim successful stock change before acceptance.

The command boundary rejects:

- receipt split whose sum differs from received quantity;
- count-after split whose sum differs from counted total;
- named lot with missing/unknown unit or lot from another tenant/SKU/location;
- physical posting that makes named or unassigned physical position negative;
- ordinary allocation above eligible free quantity;
- commitment that double-counts unreleased reservation and allocation;
- reattribution unable to debit sufficient recorded unassigned quantity;
- edit against stale inventory-position, lot or target-line revision; and
- a second acceptance with same idempotency key but a different payload.


## LOT-04 · Shared LotSplitEditor anatomy — LOT-S01 to LOT-S08

The **LotSplitEditor** is one shared, context-aware editor. It is used by **Receive stock**,
**Record a stock count**, **Assign stock to lots**, and Albarán-line **Allocate stock**. It keeps the same identity selector, quantity
slider, exact input, totals, validation and review grammar while changing the mathematical meaning
of each quantity label. It must not create three almost-identical local stores or separate lot-book
rules.

On desk/stacked desk it is a dialog when the flow fits in one sustained decision; on phone it is a
full-screen sheet. It follows **INTX-04**: it never opens a second modal above itself, has one body
scrollport, and moves review into the same surface. It follows **INTX-06**: content stays inside
the 720 px inclusive reading cap, retains 44 × 44 px targets and has no horizontal overflow at
1600, 1024, 768, 390 or 320 px.

### Literal nested anatomy

~~~text
Stock
  → Receive stock | Record a stock count | Lots → Assign stock to lots
Albarán line
  → Allocate stock
    → LotSplitEditor
      → Context header (LOT-S01)
      → Split rows
        → Existing/new/unassigned identity selector (LOT-S02)
          → Existing-lot picker
          → New-lot identity form
          → Duplicate decision
        → Quantity slider (LOT-S03)
        → Exact quantity field (LOT-S04)
        → Row status and remove action
      → Add/remove lot rows (LOT-S05)
      → Assigned/unassigned/consequence summary (LOT-S06)
      → Inline errors, loading and conflict surface (LOT-S07)
      → Review and named final action (LOT-S08)
~~~

### LOT-S01 · Split context and balance header

| Visible element | Exact text and behaviour |
|---|---|
| Receive title | **Split received stock**. Help: “Choose where the quantity that arrived belongs. This will increase recorded stock.” |
| Count title | **Match this count to lots**. Help: “Set what is physically there now. This updates recorded stock.” |
| Stock-assignment title | **Assign stock to lots**. Help: “Split the stock already recorded between lot numbers. This does not change recorded stock.” |
| Fulfilment-allocation title | **Allocate stock**. Help: “Choose which recorded stock this work uses. This does not change recorded stock.” |
| Product context | **[Product name] · [SKU code]**. **Open product** is a separate explicit door; it does not discard an edited split. |
| Location/unit | **[Location] · [Unit]**, read-only. If unit is unknown: **Stock unit is missing. Add a stock unit before recording lots.** Final actions unavailable. |
| Physical summary | **Recorded balance** [value / Still to record], **Last physical count** [time / Physical count still to record]. Allocation also shows **Available to promise** [value / Not available]. |
| Dismiss | **Cancel** before a changed draft; after edit it follows shared confirmation: **Discard this stock change?** / **Keep editing** / **Discard changes**. |

The context header stays visible while editor body scrolls on phone. It names the current operation;
it must not use generic **Edit lots**.

### LOT-S02 · Existing/new lot identity selector

~~~text
Lot allocation row
  → Existing lot | New lot | Unassigned stock
    → Existing lot picker
      → Search lot number
      → Eligible/current-status rows
      → Select exact lot
    → New lot identity form
      → Lot number
      → Supplier/source and expiry
      → Duplicate decision where needed
    → Unassigned stock explanation
~~~

| Control | Exact label, default and result |
|---|---|
| Row kind | Accessible radio group: **Existing lot**, **New lot**, **Unassigned stock**. Permitted choices follow traceability policy and operation. Initial type is never selected from matching text without review. |
| Existing-lot picker | Label **Choose a recorded lot**. Search placeholder: “Search lot number”. Rows read **[lot number] · [remaining] [unit] · [expiry/No expiry recorded]**. A blocked row says why and cannot be chosen for ordinary allocation. |
| New-lot trigger | **Add a new lot**. Opens identity fields in current row, not a nested dialog. It is available during a split while unsplit quantity remains. |
| Lot-number field | **Lot number**. Placeholder: “For example, BATCH-0426”. Required for named lot. Help: “Use the number on the stock or its paperwork.” |
| Unassigned selection | **Unassigned stock**. Receipt/count help: “The quantity is physical stock, but its lot number is not known.” Allocation help: “Use this only for stock already recorded as unassigned.” |
| Collision panel | Heading **We found a matching lot number**. Actions: **Use existing lot**, **Create a separate lot**, **Go back**. It lists meaningful current-context evidence, never automatic default. |
| Separate reason | **Why is this a separate lot?** and, where needed, **Explain the difference**. Save unavailable until valid. |

A user may add several **New lot** rows during one split. A repeated entered lot number on another
open row triggers the same collision choice against saved records and pending rows. Selecting the
same pending lot consolidates quantity into one row only after the person confirms it is the same
physical material.

### LOT-S03 · Quantity slider

The slider is a quick visual quantity control. It is never the only input and never displays a lot
identifier as its value.

| Context | Label and range | Interaction behaviour |
|---|---|---|
| Receipt | **Quantity received for this lot**; 0 to receipt quantity still unassigned, at SKU precision. | Starts at 0 for new row. Moving it changes exact field and remaining receipt total. |
| Count | **Counted after for this lot**; 0 to count total still distributable, at SKU precision. | Shows derived **[+/- amount] from recorded**. It permits higher after-count value if physical count supports it. |
| Reserve/allocate | **Quantity for this lot**; 0 to lot eligible free quantity, at SKU precision. | Disabled with reason for depleted, expired, recalled, blocked or fully committed lots. |
| Assign stock to lots | **Recorded after this lot split**; 0 to fixed Recorded balance still distributable, at SKU precision. | Moving it changes another named/unassigned row in the draft so the fixed balance remains whole. |
| Reattribute unassigned | **Quantity to give this lot**; 0 to recorded unassigned physical quantity. | Creates no stock; remaining unassigned changes in opposite direction. |
| Physical depletion | **Quantity sent from this lot**; 0 to currently allocated/eligible quantity, per command policy. | It cannot silently spill shortfall to another lot. |

The slider has minimum, maximum, step and accessible value text in canonical unit. Arrow keys move
one configured increment; Page Up/Page Down move ten increments or 10% of range, whichever is
defined in local implementation; Home/End move to valid minimum/maximum. Drag, click, touch and
keyboard have identical values and validation. At high precision, the exact input remains the
reliable method; no tiny slider position is required for a small decimal.

### LOT-S04 · Exact quantity field

Every allocation row contains adjacent decimal input. It is authoritative for precise editing.

| Control | Contract |
|---|---|
| Label | **Exact quantity** plus canonical unit, for example **Exact quantity (kg)**. In count context: **Counted after (kg)**. |
| Placeholder | “0” visual placeholder only. Untouched empty field remains empty and does not count as zero. |
| Behaviour | Typing updates slider only after valid decimal parse. Intermediate text such as “1.” remains local draft, without rounding. Blur/Save validates precision, range and split total. |
| Error copy | **Enter a quantity.**; **Use increments of [unit increment].**; **This cannot be below 0.**; **There are only [amount] [unit] free in this lot.**; **The split is [amount] [unit] over the total.** |
| Unit explain | **This product is counted in [unit].** If source conversion selected: **[source quantity] [source unit] = [canonical quantity] [unit]**, with door to evidence/rule revision. |

A stepper may appear only as secondary increment/decrement control inside 44 px target rule. It uses
same precision and error path as exact input; it cannot bypass them.

### LOT-S05 · Add/remove lot rows

~~~text
Split rows
  → named/unassigned allocation row
    → identity controls
    → quantity controls
    → row evidence/status
    → Remove lot
  → Add another lot
  → Add unassigned stock, where policy permits
~~~

| Control | Exact copy and behaviour |
|---|---|
| Add another lot | **Add another lot**. Adds one blank **New lot** row after last non-empty row, focuses **Lot number**, and retains all other draft rows. |
| Add unassigned | **Add unassigned stock**. Available only where policy allows and only once per split; focuses its exact quantity field. |
| Remove row | **Remove lot**. For changed nonzero row, asks **Remove this lot from the split?** / **Keep lot** / **Remove lot**. It changes draft totals only; it never deletes durable lot. |
| Clear amount | **Clear quantity** appears for existing selected row with zeroed quantity; it keeps identity selection for reuse in same draft. |
| Row status | **[amount] [unit] assigned**, **No quantity yet**, **Needs a lot number**, **Expired**, **Already fully allocated**, **Changed elsewhere**, or operation-specific status. Status is text, not colour alone. |

A zero-quantity blank row is not sent in a physical command. A zero-quantity saved lot row is never
created merely because a person opened **Add another lot**.

### LOT-S06 · Assigned, unassigned and consequence summary

Summary sits directly below editable rows and directly above final actions. It is visible without
hover and updates while typing.

| Context | Required summary rows | Save eligibility |
|---|---|---|
| Receipt | **Received**; **Assigned to named lots**; **Unassigned stock**; **Still to split**. | Still to split must be 0. Unassigned allowed only by policy. |
| Count | **Counted total**; **Named lots after count**; **Unassigned after count**; **Difference from recorded**. | Named lots after count + Unassigned after count equals Counted total exactly. |
| Reserve/allocate | **Needed for this line**; **Reserved/allocated**; **Still not covered**; **Available to promise after this save**. | Full action needs zero remainder. Partial reserve has explicit partial action and shortage state. |
| Assign stock to lots | **Recorded balance**; **Named lots after split**; **Unassigned stock after split**; **Still to assign**. | Named lots after split + Unassigned stock after split must equal fixed Recorded balance exactly. |
| Reattribute | **Recorded unassigned stock**; **Giving this lot**; **Unassigned after this change**; **Recorded balance stays [value]**. | Cannot exceed current unassigned physical quantity. |
| Depletion | **To record as sent**; **Attributed to lots**; **Still not attributed**; **Recorded balance after save**. | Lot-required SKU needs zero un-attributed amount. |

Summary wording is factual. It says **2 kg still not covered**, never bare **Expected 2 kg**. A red
value has text explanation and programmatic relation to field causing it.

### LOT-S07 · Validation, availability and transient state

The editor has one inline error summary above first invalid row and field-level message next to each
affected control. It uses operation-specific copy:

| State | Exact copy and allowed next action |
|---|---|
| Missing lot number | **Enter the lot number on the stock or choose Unassigned stock.** Focus Lot number. |
| Duplicate decision | **Choose the matching lot or explain why this is separate.** Open collision panel. |
| Split short | **[amount] [unit] still need a place.** Add/select row or choose permitted unassigned stock. |
| Split over | **You have assigned [amount] [unit] too much.** Reduce a row. |
| Depleted | **This lot has no recorded quantity left. Choose another lot.** It stays readable in picker. |
| Expired/blocked | **This lot is not available for a new allocation because [reason].** A permitted override is separate reviewed command, never enabled ordinary slider. |
| Unknown unit | **We cannot match this lot because its stock unit is missing. Add the stock unit first.** No physical final action. |
| Source unavailable | **The source is no longer available. You can keep the lot number, but review its evidence before saving.** Physical command follows policy; source absence recorded. |
| Save failed | **We couldn’t save this stock change. Your values are still here.** Keep rows, identities, source choices and idempotency key. |
| Checking outcome | **Checking this stock change…** Disable only duplicate final command and resolve through idempotency lookup. |
| Changed elsewhere | **Stock changed while you were editing. Review the latest quantities.** Show before/latest/draft; offer **Use latest**, **Keep my draft**, **Cancel**. |
| Permission changed | **You no longer have permission to record stock. Your draft has not been saved.** Keep safe local text until route policy removes it; do not expose protected values. |
| Offline | **You’re offline. This stock change has not been saved.** Physical commands cannot be presented as complete. Eligible draft may be **Not saved yet**. |

### LOT-S08 · Review, final action and completion

Final action is named for consequence: **Save receipt**, **Save stock count**, **Reserve stock**,
**Assign stock to lots**, **Save lot split**, **Reserve stock**, **Allocate stock**, **Save lot reassignment**, or **Record stock sent**. It enters **Review** in same
dialog/sheet if it changes physical balance, resolves conflict, uses exception, or affects
fulfilment commitment.

~~~text
Review
  → operation and exact SKU/location
  → physical consequence / explicit no-physical-change statement
  → every lot + quantity
  → unassigned quantity, if any
  → source/reason links
  → affected commitments/shortage, if any
  → Back to edit | named final command
~~~

Success acknowledgement names result and factual next door:

- **Receipt saved. Recorded balance is now [amount] [unit].** — **View stock history**
- **Stock count saved. [increase/decrease] [amount] [unit] recorded.** — **View lots**
- **Lot split saved. Recorded balance is still [amount] [unit].** — **View lots**
- **Stock reserved for [albarán reference].** — **View albarán**
- **Stock allocated to [albarán reference]. Recorded balance has not changed.** — **View allocation**
- **Stock sent recorded. Recorded balance is now [amount] [unit].** — **View fulfilment history**

After success, close returns focus to changed Product/Albarán summary. A projection may still catch
up; local surface says **Updating the stock view…** until cursor arrives, then shows factual row. It
never substitutes optimistic number as truth.


## LOT-05 · Receive stock anatomy — LOT-R01 to LOT-R06

~~~text
Product Sheet
  → Stock
    → Receive stock (LOT-R01)
      → Receipt details (LOT-R02)
        → quantity received
        → stock location
        → received at
      → Source evidence (LOT-R03)
        → supplier / retained email / import row / delivery reference
      → Split received stock (LOT-R04; shared LOT-S01–LOT-S07)
        → existing named lots
        → new typed lots
        → permitted unassigned stock
      → Review receipt (LOT-R05)
      → Save receipt / result (LOT-R06)
~~~

### LOT-R01 · Entry and empty state

Product Sheet Stock has **Receive stock** when actor has **inventory.receipt** permission and SKU is
active/stock-enabled. It opens pre-scoped to exact SKU and chosen/default permitted location. It is
disabled, with adjacent reason, when stock disabled, SKU archived, no location exists, or actor
lacks permission.

| State | Exact visible text and next action |
|---|---|
| No physical evidence | **No stock recorded yet. Record what arrived or count what is here.** Actions: **Receive stock**, **Record a stock count** where permitted. |
| Existing balance/no lots | **[amount] [unit] recorded, with no lot number.** Action: **Receive stock**; later reattribution separate. |
| Loading | **Loading stock details…** with disabled final action; no stale total masquerades as current. |
| Archived SKU | **This product is archived. Stock history is still available.** No receipt command. |
| Missing permission | **You do not have permission to receive stock.** Keep history doors if read permission permits. |

### LOT-R02 · Receipt details form

| Field/control | Default, validation and copy |
|---|---|
| **Quantity received ([unit])** | Empty required decimal greater than 0 at SKU precision. Help: “Add only the quantity that has arrived.” Error: **Enter a quantity greater than 0.** |
| **Location** | Default permitted stock location; required selection if more than one. Help: “Stock is recorded separately for each location.” |
| **Received at** | Default current tenant-local date/time; may be changed to valid past/current timestamp under policy. Future time requires explicit operational permission and review label **Future receipt time**. |
| **Delivery reference** | Optional text, maximum 120 characters. Help: “For example, the supplier’s delivery note number.” It is evidence metadata, not lot number. |
| **Continue to lots** | Disabled until required receipt details valid. Preserves draft and opens LOT-R04; writes nothing. |
| **Cancel** | Writes nothing and follows changed-draft rule. |

Receipt form never offers **Expected delivery** as quantity source. A source may establish inbound
expectation, but only a person recording actual arrival makes receipt command.

### LOT-R03 · Receipt source evidence

~~~text
Receipt details
  → Source evidence
    → Supplier (optional recorded source)
    → Delivery reference (optional)
    → Related supplier email / uploaded document (optional retained source link)
    → No source available acknowledgement (role/policy-gated)
~~~

Selected source appears in review as **Source: [label]** with **Open source**. If email or
attachment has not been admitted/authorized, editor says **This source is not available here** and
does not leak content. Receipt may be entered without supplier source only where actor has physical
stock role; review says **No supplier source recorded**.

### LOT-R04 · Split received stock

The editor passes exact received quantity into **LOT-S01** through **LOT-S07**.

- A person can select an existing named lot when delivery adds to the **same physical lot**.
  Picker makes evidence decision visible; same code is never enough by itself.
- **Add a new lot** is available at any point. It requires **Lot number** and uses
  **supplier-receipt** origin plus receipt source links. It may include optional supplier/expiry.
- **Unassigned stock** is offered only for **Record when known**. Its row says: **The receipt will
  increase recorded stock without a lot number.** It is unavailable for **Lot required**.
- Receipt sum formula is always shown. Final receipt review unavailable while short/over.
- A new lot added mid-split does not reset selected existing rows, receipt quantity or source
  evidence. Removing it changes only unsaved split.

### LOT-R05 · Receipt review

Review lists in order: product/SKU, location, received timestamp, source/reference, total received,
each named lot number and quantity, unassigned quantity, resulting Recorded balance, actor and
policy exception. It states **This adds physical stock.** It does not say allocation, expected,
forecast, or availability unless separate availability summary is calculated.

If user entered new lot colliding with source-discovered existing code, review repeats selected
**Use existing lot** / **Create a separate lot** decision and reason. Identity decision is auditable,
not hidden in picker state.

### LOT-R06 · Save receipt and result

**Save receipt** sends one idempotent revision-checked **stock.receipt.record** command. Acceptance
atomically writes receipt event, any new-lot creation events, one physical posting per named lot or
unassigned amount, audit record and outbox entry. Retry reuses idempotency key.

Failed receipt retains full split. Concurrent receipt/count produces shared conflict surface;
accepting latest data reruns availability checks but does not replace typed lot numbers or source
choices. Saved receipt remains in stock history even if related email/source later redacted; source
relation records access/status change without rewriting receipt facts.

## LOT-05A · Batch stock intake — LOT-B01 to LOT-B08

This is the shared operational path behind **Stock update**. It lets a warehouse reuse yesterday's
shape without treating yesterday's quantities, production dates or lot numbers as today's facts.
Every source becomes one reviewable receipt batch; none writes inventory before **Confirm stock**.

~~~text
Stock update
  → choose a starting point (LOT-B01)
    → Recent
    → Favorites
    → Add manually
    → File, pasted rows or phone photo
  → normalize exact SKU rows (LOT-B02)
  → review the batch matrix (LOT-B03)
    → product / SKU
    → quantity / canonical unit
    → production date
    → optional typed lot number
  → resolve or remove every unrecognized row (LOT-B04)
  → review physical consequences (LOT-B05)
  → Confirm stock once (LOT-B06)
  → batch result and history (LOT-B07)
~~~

### LOT-B01 · Starting point and reusable lists

The source chooser is one compact control with **Recent**, **Favorites**, **Add manually**, and
**File or paste**; a phone labels the final source **File or photo**. It opens on **Add manually**
for a single quick receipt. It never opens on a hidden last-used mode.

- **Recent** shows one prior accepted receipt batch at a time. Previous and next chevrons have
  44 by 44 pixel targets and no position counter. **Use this batch** deep-copies its product rows
  into a new draft. The prior quantities, dates and lot numbers are editable proposals.
- A heart copies that source shape into the tenant user's **Favorites** preference. A favorite is a
  reusable starting template, not a pointer to mutable historical evidence. Removing the favorite
  never deletes its accepted receipt history.
- **Favorites** is a one-column phone grid and two-column desk grid. Every card identifies the
  number of products and gives product name plus quantity/unit; it never shows internal category.
- **Add manually** resolves only an exact current SKU identity. Search accepts product name and SKU
  code. No-match offers **New product** and cannot create stock for free text.
- List order follows the tenant's source order. Internal category may be used only after the user
  explicitly chooses category sort/filter on the Products surface.

The durable production objects are **Stock receipt batch** and its ordered **Stock receipt batch
rows**. Recent reads accepted batches. Favorites store only a preference-owned snapshot of row
shape and source batch ID; they are not inventory evidence.

### LOT-B02 · File, paste and photo intake boundary

File drop, file chooser, table paste and phone **Take photo** converge on the same normalization and
review seam. Accepted tabular columns are **SKU or product**, **quantity**, **unit**, **production
date**, and **lot number**. Header aliases may be localized, but matching is always to one exact
tenant SKU.

A photo is evidence awaiting extraction. Captured bytes remain in memory for the open intake and
must be released on replace, cancel, route change or tab close unless the user explicitly submits
them into an authorized retained-source service. The browser prototype must say **Photo attached**
and require review; it must never invent OCR output or imply a provider completed. Production OCR
returns proposed cells plus source spans and confidence for review. It cannot call a stock command.

Pasted/file rows that cannot resolve, have an invalid quantity, or use an incompatible unit remain
in a visible **rows need attention** block. They do not disappear. The user must repair them or
explicitly **Skip these rows**; that action removes only those proposed rows and is recorded in
draft telemetry, never as accepted stock.

### LOT-B03 · Review matrix and phone anatomy

At desk widths the review is a true aligned matrix with stable columns: **Product**, **Quantity**,
**Unit**, **Production date**, **Lot number**, and row action. It accepts multi-row clipboard paste
and offers **Copy table** as tab-separated values. A long name wraps inside the product cell; it
does not shift quantity, unit, date or lot columns.

At 559 pixels and below, each matrix row becomes one contained card. Product identity and remove
action lead; quantity with unit follows; production date and lot number stack below. Inputs remain
at least 44 pixels high and the sticky confirmation bar stays above safe area and the on-screen
keyboard. Numeric fields accept the SKU precision, values from 0.001 through the tenant maximum,
decimal comma or point, and retain the literal draft while being edited.

**Add product** selects from existing SKUs and appends a blank review row. It never creates a related
product, category membership or new SKU. Reordering rows changes presentation only; identity is an
opaque draft-row ID.

### LOT-B04 · Production date and lot number

Production date is a calendar fact separate from received-at time. It can be blank if the tenant
does not track it. **Use today's date** is an explicit per-row convenience that writes the tenant's
current business date, evaluated in the workspace timezone at invocation, into **Lot number** using
the tenant's configured compact date format (Kit: **YYYYMMDD**). It never changes **Production date**,
is never automatic or a legal-lot assertion, and the user may edit or clear the result before
confirmation. A midnight/timezone boundary recomputes on the next invocation; it does not rewrite an
already typed draft.

The generated visible number is not identity. On confirmation, every newly named physical lot gets
an opaque lot ID, even if two rows display the same date-derived code. A normalized collision enters
the existing **Use existing lot / Create a separate lot** decision from LOT-S02. Where lot number
is blank, the row follows the SKU traceability policy: explicit Unassigned stock if allowed, or a
blocking row error if Lot required.

### LOT-B05 · Final review and failure

Before the final action, the batch names the row count, location, physical quantity and lot or
Unassigned destination for every SKU. It states **This adds physical stock**. No row calls a
favorite, photo, supplier email, OCR proposal, prior batch or pasted line a receipt.

**Confirm stock** remains disabled while any kept row is invalid or unresolved. Cancel/back follows
the changed-draft rule. Storage, network, authorization, validation and revision failures retain the
exact rows, quantities, dates, lot strings, skipped-row decision and source label. A concurrent
receipt/count rejects stale base revisions and offers refresh/review; it never last-writer-wins.

### LOT-B06 · One atomic command

One confirmation submits one idempotent, revision-checked **stock.receipt_batch.record** command.
The command contains an ordered row per exact SKU/location, each with canonical quantity/unit,
production date, source link, and named-lot or explicit Unassigned target. Validation is
all-or-nothing. Acceptance atomically creates the batch, its row receipts, any approved named lots,
physical postings, audit record and outbox records. A retry with the same idempotency key cannot
double any row.

A production response returns batch ID, aggregate revisions and event cursor. The client may show
**Updating the stock view…** until every affected Product Sheet projection reaches that cursor.
A local browser ledger is interaction evidence only and cannot be described as cross-device stock.

### LOT-B07 · History, favorites and adjustments

After acceptance, Recent and stock history read the durable batch by ID. Opening it shows actor,
accepted time, source, ordered rows and direct Product/Lot doors. Correcting a row never edits the
accepted batch. It opens the appropriate receipt correction, physical count, physical correction or
zero-net lot reassignment and records a linked compensating fact.

Product Sheet **Available lots** shows only named lot positions with recorded physical remainder
greater than zero, plus explicit Unassigned stock where present. Each row gives remaining and free
quantity and opens immutable movement/commitment history. **Adjust balance** starts a governed
physical count/correction; **Assign stock to lots** is the zero-net route. A removal is never a
delete button on a lot.

### LOT-B08 · Kit proof boundary

The Kit may persist batch templates and accepted demo events in browser storage to prove responsive
interaction. It must keep captured image bytes session-only and label photo/OCR as pending review.
It must not claim server durability, multi-user concurrency, warehouse authorization, provider OCR
completion or production Albarán allocation from that local memory. Production allocation joins an
Albarán line to opaque lot-position IDs from the authoritative projection; a displayed lot number
or browser batch-row ID is never that join.

## LOT-06 · Record a physical count anatomy — LOT-C01 to LOT-C07

A count is a measured total at a location/time, then a truthful attribution of **after-count**
quantity among named lots and unassigned stock. It is not receipt, prediction, adjustment slider or
promise.

~~~text
Product Sheet
  → Stock
    → Record a stock count (LOT-C01)
      → Count total and time (LOT-C02)
      → Match this count to lots (LOT-C03)
        → existing lot counted-after rows (LOT-C04)
        → Add a lot found in this count (LOT-C05)
        → unassigned after-count row
        → explicit traceability-loss route when needed
      → Review count and commitments (LOT-C06)
      → Save stock count / result (LOT-C07)
~~~

### LOT-C01 · Entry and prior evidence

Entry label: **Record a stock count**. Supporting copy: **Enter what is physically here now.**
Header shows **Recorded balance [amount/Still to record]** and **Last physical count [time/Physical count still to record]**. It never substitutes Available to promise, inbound or estimate for before value.

When no prior evidence exists, screen says **No previous stock count. Start with what you can
physically count.** A zero count is valid and distinguishable from no count. For **Lot not used**,
count uses SKU-level count flow without named lot controls.

### LOT-C02 · Count total and time

| Field/control | Default, validation and copy |
|---|---|
| **Physically counted ([unit])** | Empty required decimal equal to or greater than 0 at SKU precision. Help: “Count what is here, not what you expect to arrive.” Error: **Enter 0 or more.** |
| **Counted at** | Default current tenant-local date/time. Permitted historical count carries review warning if later events exist. |
| **Count reference** | Optional text up to 120 characters. Help: “For example, the count sheet or shelf check.” |
| **Continue to lots** | Enabled once valid. Opens LOT-C03 with no write. |

With unknown stock unit, screen says **Add a stock unit before recording a count.** It must not
present guessed conversion or final-save path.

### LOT-C03 · Suggested start, not invented traceability

**LOT-S01** through **LOT-S07** appear with count-specific labels. System constructs draft from
latest accepted physical position only:

1. Existing named rows begin at recorded remainder.
2. Existing unassigned stock begins at recorded remainder.
3. If new total is lower, system may present explicitly labelled **Suggested count split** based on
   tenant documented oldest-receipt ordering. Help: **This is only a starting point. Change it to
   match what you found.**
4. If new total is higher, difference begins as **Unassigned after count**. It is not called
   delivery or assigned to supplier lot.
5. No suggestion may put shortfall onto arbitrary last lot, claim FIFO/expiry proves physical trace,
   or save before person reviews complete after-count split.

### LOT-C04 · Per-lot counted-after controls

~~~text
[Lot number] · [source/date] · [recorded before] · [expiry/status]
  → Counted after slider (LOT-S03)
  → Counted after exact field (LOT-S04)
  → Derived change: [− / +] [amount] [unit]
  → Open lot history
~~~

**Counted after** is editable truth because it allows reductions and newly found quantity without a
second contradictory deduction field. For reduction row says, for example, **3 kg fewer than
recorded**; leftward slider movement is requested visual deduction control. For increase it says
**2 kg more than recorded**. User may type exact amount.

Slider maximum is count total still distributable, not prior lot remainder: count may truthfully
find more named lot. Minimum is 0. **Difference from recorded** updates after every valid change.
A row source/history door is read-only and cannot open over changed count draft without explicit
**Open lot history** decision.

### LOT-C05 · Add a lot found in this count and unassigned fallback

**Add a lot found in this count** adds **New lot** row using **LOT-S02** and explanation:
**Enter the lot number you can see. This records what you found; it does not create a supplier
receipt.** Origin is **physical-count**, with count timestamp/reference and optional observed source
link.

A person can add several discovered lots mid-split. Count total distributes across existing lots,
new count-discovered lots and **Unassigned after count**. The latter says: **Physical stock with no
lot number recorded.** It is permitted only by policy.

When person cannot honestly say which existing named lots remain, recovery is explicit:

~~~text
I cannot tell which lots remain
  → Explain why lot traceability is lost
  → Review affected named lots and active commitments
  → Move remaining counted quantity to Unassigned stock
  → Save count with traceability-loss event
~~~

This action is only for configured inventory-reconciliation role. It requires **Why can’t you
identify the remaining lots?** (3–500 characters) and review acknowledgement:
**This keeps the physical count, but removes the named lot attribution for [amount] [unit].**

It sets selected named lots’ after-count quantities to zero and puts truthful remaining count in
Unassigned stock, so count-after equation holds. It does not invent distribution, rewrite receipt
history or delete lot records. Zero-remainder lots remain historical.

For **Lot required**, unassigned count unavailable. Recovery says **This product needs each counted
quantity assigned to a lot.** It offers **Keep editing** and audit-safe escalation door, never fake
“unknown” code.

### LOT-C06 · Count review and commitments

Review has four visual groups:

1. **Count** — prior Recorded balance, physically counted total, signed difference and count time.
2. **Lots after count** — each named lot before → after, source/expiry status, new/count-found
   marker, and Unassigned after count where applicable.
3. **Work already held** — active reservations/allocations by albarán reference. If count makes
   lot/position overcommitted, review says **[amount] [unit] are already reserved or allocated but
   are no longer recorded.** It names affected work and opens **Resolve stock shortfall**.
4. **Evidence and reason** — count reference, traceability-loss reason if used, actor, policy
   exception and source links.

Final copy: **This updates recorded stock. It does not change expected delivery or daily stock
estimate.** It also says **Existing reservations and allocations will not be cancelled
automatically.** Actor can save honest physical count with known shortfall only if role permits;
accepted result creates blocking shortage/exception until resolved.

### LOT-C07 · Save count and result

**Save stock count** submits **stock.count.record** with count total, after-count split, base
position/lot revisions, evidence/reference and traceability-loss reason if used. Acceptance
atomically records:

- one **stock.counted** fact with physical total and time;
- one **stock.variance.recorded** fact where prior evidence exists;
- signed physical-posting deltas for each named lot/unassigned position whose after quantity changed;
- **lot.count.attributed** facts recording submitted after-count assignment;
- **lot.created** and source links for newly named count-found lot;
- overcommitment exception/event where active commitments exceed resulting eligible physical stock;
  and
- audit/outbox records.

No event calls positive count difference supplier receipt. No historical receipt mutates. If later
count/receipt changes position before save, command rejects stale revision and shows precise row.
User may refresh suggestion, retain draft or cancel; system never merges old count with current
position invisibly.




## LOT-L · Assign stock to lots — LOT-L01 to LOT-L07

**Assign stock to lots** is a Product Sheet Stock action. It answers “which lot numbers do the
physical stock we have today belong to?” It is a fixed-balance attribution editor: it divides the
already accepted **Recorded balance** for one exact SKU/location/unit among named lot positions and
explicit **Unassigned stock**. It never chooses an Albarán, reserves stock, allocates to a customer,
receives stock, counts stock, or changes physical balance.

~~~text
Product Sheet → Stock → Lots → Assign stock to lots
  → fixed Recorded-balance context (LOT-L01)
  → current named and unassigned positions (LOT-L02)
  → split rows with exact quantity sliders/fields (LOT-L03)
  → existing/new lot identity and evidence (LOT-L04)
  → fixed-total summary and validation (LOT-L05)
  → review → Save lot split (LOT-L06)
  → conflict, active-commitment and history handling (LOT-L07)
~~~

### LOT-L01 · Entry, meaning and fixed context

The button label is **Assign stock to lots**. Help: **Split the stock already recorded between lot
numbers. This does not change recorded stock.** It is visible only with inventory-read plus
inventory-reconcile permission, an active stock-enabled SKU, known unit, permitted location, and a
Recorded balance. No physical evidence state keeps button unavailable with **Record stock first,
then assign it to lots.**

Header is fixed to **[Product] · [SKU]**, **[Location] · [Unit]**, **Recorded balance [amount]**,
and **Last physical count [time / Physical count still to record]**. It never shows an order/customer picker.
If balance is zero, title remains usable only to review historical positions; **Save lot split** is
unavailable because no positive physical quantity can be assigned.

### LOT-L02 · Current positions before the split

The body starts with **Stock recorded now** and one row for every named lot plus **Unassigned stock**
where quantity exists. Each row reads **[lot number or Unassigned stock] · [current quantity] [unit]
· [source/expiry status]**. The initial draft exactly reproduces current physical positions. It does
not preselect a supplier, guessed lot code, FIFO rule, forecast or existing Albarán allocation.

A person may move quantity from unassigned to named lot, from named lot to unassigned, or between
named lots only through visible source/reason-aware changes. The editor shows **[amount] [unit]
currently committed to orders** beneath a row when commitment exists; commitment does not alter the
fixed balance but constrains unsafe reassignment.

### LOT-L03 · Split rows and quantity controls

Every row uses **LOT-S02**, **LOT-S03** and **LOT-S04** with stock-assignment labels:

- Existing named lot: **Recorded after this lot split ([unit])** slider plus exact numeric field.
- Unassigned stock: **Recorded without a lot number after this split ([unit])** slider plus exact
  numeric field.
- New named lot: typed **Lot number**, then **Recorded after this lot split ([unit])** slider plus
  exact numeric field.
- The slider changes quantity only. Lot selection/creation is through the identity controls.
- Moving one row updates **Still to assign** and never automatically changes another hidden row.
  A person must make the full split explicit before save.

The slider range is 0 to fixed Recorded balance still distributable. Exact input is authoritative
at SKU precision. A named lot with active commitment cannot be reduced below the quantity that is
still actively reserved/allocated to it; the exact row error names the affected commitment.

### LOT-L04 · Enter/select a lot and source evidence

**Add a lot** inserts a typed identity row inside the current split; it never opens a second modal.
It uses the same **Lot number**, duplicate decision, supplier, expiry and source fields as
**LOT-S02**. The added lot’s origin is **manual-reconciliation**, not a receipt. Required supporting
evidence is either a retained source link or the checkbox **Physical label checked today** plus
**Why are you assigning this stock to this lot?** (3–500 characters).

A matching display code presents **Use existing lot** / **Create a separate lot**. It never merges
on code text. A missing physical label remains **Unassigned stock**; there is no generated lot code.
A person can add several new lots during one split and may remove only unsaved rows. **Remove lot**
does not delete a durable lot; it moves its draft quantity elsewhere before the fixed-total rule
will allow save.

### LOT-L05 · Fixed-total summary and validation

Summary has **Recorded balance**, **Assigned to named lots**, **Unassigned stock**, and **Still to
assign**. The equation is:

~~~text
Named lots after split + Unassigned stock after split = fixed Recorded balance
~~~

The screen does not offer a partial save. **Still to assign** must be 0. Exact errors are:

- **[amount] [unit] still need a place.**
- **You have assigned [amount] [unit] too much.**
- **Enter the lot number on the stock or leave this quantity unassigned.**
- **[amount] [unit] are still allocated to [reference]. Change that allocation before moving this stock.**
- **This product is counted in [unit]. Use increments of [increment].**

### LOT-L06 · Review and Save lot split

Review title: **Review lot split**. It lists fixed Recorded balance before/after, every named lot
before → after, Unassigned stock before → after, each new lot/source/reason, affected commitments,
actor and time. It states **Recorded balance will not change. No stock will be received, counted or
sent.**

**Save lot split** sends one revision-checked idempotent **lot.position.reassign** command. It
writes equal-and-opposite physical-attribution postings plus **lot.position.reassigned** event and
audit/outbox records. The net physical quantity is zero. Receipt/count/depletion history stays
unchanged. Success says **Lot split saved. Recorded balance is still [amount] [unit].** with
**View lots**.

### LOT-L07 · Conflict, commitments and history

If physical balance, a lot position or a related commitment changes while editor is open, save
rejects stale revision and says **Stock changed while you were editing. Review the latest lot
split.** It shows before/latest/draft rows and **Use latest**, **Keep my draft**, **Cancel**.

If a draft would leave a named lot below active commitments, the screen says **[amount] [unit] are
still reserved or allocated to [reference].** It offers **Open allocation** but does not mutate the
order commitment. Reassigning a commitment belongs to the Albarán-line **LOT-A05** path. Every
saved physical attribution appears in lot history as **Lot split recorded** with source/reason and
explicit **Recorded balance unchanged**.

## LOT-07 · Albarán-line reserve, allocate, reassign and physically deplete — LOT-A01 to LOT-A08

**Assign stock to lots** is the Product Stock physical-attribution action and is specified by
**LOT-L01** through **LOT-L07**. This section is only for fulfilment commitments entered as
**Allocate stock** from an eligible Albarán line. The Albarán route already knows the exact line.
A fulfilment allocation cannot target a family, category, customer name, free-text request or
unresolved product candidate.

~~~text
Albarán Sheet → exact line → Allocate stock (LOT-A01)
  → fixed line context
  → eligible stock list (LOT-A02)
  → reserve or allocate split (LOT-A03, LOT-A04)
  → change/reassign selected lots (LOT-A05)
  → record physical stock sent when it happened (LOT-A06)
  → result/history (LOT-A07)
  → shortages, expiry, recall, conflicts and policy exceptions (LOT-A08)
~~~

### LOT-A01 · Work target and intent

| Control | Exact copy and behaviour |
|---|---|
| Entry | **Allocate stock** opens only from an eligible Albarán line with **For [product] on [albarán reference]**. Product, quantity/unit and line ID are read-only. The Product Sheet does not offer an Albarán chooser here; its distinct action is **Assign stock to lots**. |
| Intent | Accessible radio group: **Reserve for later** / **Allocate for fulfilment**. Help: “Reserve holds stock. Allocate names the lots intended for this line. Neither changes recorded stock.” |
| Requested amount | Read-only **Needed for this line: [amount] [unit]**. Permitted partial workflow never changes commercial line quantity or unit. |
| Cancel | **Cancel** leaves commitment facts unchanged. Changed local split follows discard rule. |

**Reserve for later** is suitable for unissued/draft workflow where policy allows. **Allocate for
fulfilment** requires eligible operational line state. Document issue/print never implies either.

### LOT-A02 · Eligible stock list

Picker/list is scoped to exact SKU, location, unit, policy and target line. It has separate
headings, not a mixed opaque total:

~~~text
Available lots
  → Lot number · free quantity · expiry/status · source/date
Recorded unassigned stock
  → free quantity · traceability warning
Unavailable lots
  → expired / recalled / blocked / depleted / fully committed rows with reason
~~~

Rows sort by tenant declared fulfilment policy, but sort is suggestion, not hidden allocation. User
chooses quantity through **LOT-S03** and **LOT-S04**. **Open lot history** preserves allocation draft
after explicit choice.

On first open the editor also proposes a complete eligible split in that declared policy order. Each
proposed row shows **lot number · location/position · quantity used · remaining after**, and the
underlying command carries the opaque lot-position ID and the inventory/line revisions from which it
was calculated. The person may **Accept proposed allocation** or edit quantities. Editing any
otherwise eligible policy-ordered proposal requires a short reason on the changed split; blocked-lot
exceptions retain the stronger role/reason/quality-impact contract below. If quantity, eligibility,
policy, line or position revision changes before save, the proposal becomes **Stock changed — review
the latest proposal**. Rocoto reprojects from current positions without overwriting the person's
draft; the person explicitly uses the new proposal or reconciles the edit. Acceptance appends the
exact proposed/edited position IDs, displayed locations, quantities, policy revision, base position
revisions, actor, reason and time to immutable allocation evidence. A later reallocation supersedes
that evidence; it never rewrites it.

Ordinary allocation excludes expired, recalled, blocked, depleted and fully committed lots. Visible
reason is concrete: **Expired on [date]**, **On hold for quality review**, **Fully allocated to
[reference]**, or **No recorded quantity left**. Permitted exception is explicit reviewed command
with role, reason and quality/recipient impact; never unexplained enabled slider.

### LOT-A03 · Reserve stock

**LOT-S01** through **LOT-S07** show reserve equation. Final action is **Reserve stock**. Full
reserve needs all requested quantity covered; person with policy permission may choose **Reserve
[amount] [unit] and mark the rest unavailable**. Review says:

> **[amount] [unit] will be reserved. [amount] [unit] are still not covered. Recorded balance will not change.**

Accepted command creates **lot.reserved** / commitment facts with target line and expiry policy. It
replaces previous reservation only through explicit supersession event. It does not make dispatch,
physical deduction, delivery promise or price change.

### LOT-A04 · Allocate stock for fulfilment

Full allocation editor title: **Allocate stock**. Summary: **Needed for this line**, **Allocated**,
**Still not covered**, **Available to promise after this save**. It offers **Allocate stock** only
when all required amount covered, unless permitted partial allocation selected and labelled
uncovered amount.

If same line has active reservation, review says **This replaces the existing reservation with a
named allocation.** Commit transition is one logical held quantity, never reservation plus
allocation twice. It records every lot/unassigned commitment with stable target line and current
albarán fulfilment revision.

Success: **Stock allocated to [albarán reference]. Recorded balance has not changed.** It offers
**Record stock sent** only when line reaches valid fulfilment state; allocation itself is never
shown as physical departure.

### LOT-A05 · Reassign an Albarán-line allocation

User changes selected lots through **Change allocation**. Review header: **Reassign allocated stock**
and statement **Recorded balance stays [amount] [unit].** Editor shows prior allocation, draft
allocation and exact row consequence.

| Situation | Allowed action | Invariant |
|---|---|---|
| Replace named lot with another eligible named lot | Change row quantities and **Save lot reassignment**. | Existing commitment superseded/released and replacement created atomically; physical positions unchanged. |
| Reduce/release allocation | **Release stock** with target/result. | Commitment falls; Recorded balance unchanged. |
| Need to name physical stock before allocation | **Assign stock to lots** opens the Product Stock physical-attribution route with the current allocation draft preserved. | The Albarán commitment editor cannot create/change physical lot positions. Return only after the independent **Save lot split** command succeeds. |
| Need quantity not recorded unassigned | **This quantity is not recorded as unassigned stock. Receive it or count it first.** | No allocation/new-lot save path mints stock. |
| Change already sent/issued trace | **Create correction** opens document/fulfilment correction workflow. | Historical depletion/issued snapshot immutable. |

Naming stock during an allocation is deliberately unavailable in this editor. The allocation
draft can open **Assign stock to lots**, retain its target-line context, and return after the
independent physical-attribution command. The physical action’s source/reason and
**manual-reconciliation** origin are specified by **LOT-L04** through **LOT-L06**.

### LOT-A06 · Record actual stock sent

**Record stock sent** is separate fulfilment action, normally entered from allocated Albarán line:

~~~text
Record stock sent
  → [Albarán reference] · [product] · [location]
  → amount physically sent
  → actual lot split
  → sent at
  → reason / evidence for variance if different from allocation
  → Review → Record stock sent
~~~

Default split copies active allocation as proposal. Person can adjust it only through same exact lot
controls and must explain material difference. Command rejects lot quantity above current physical
remainder or traceability policy; it does not take hidden remainder from last row. Acceptance writes
**stock.physically.depleted** and **lot.depletion.attributed**, marks linked commitment
fulfilled/released as appropriate, updates Recorded balance and leaves document issue/print untouched.

For **Lot required**, sent amount fully attributable to named lots. For **Record when known**,
explicit Unassigned stock row permitted and review says **[amount] [unit] will be sent without a
recorded lot number.** For **Lot not used**, result is SKU-level depletion with no invented lot.

### LOT-A07 · Result and history

After accepted reservation/allocation/reassignment/depletion, initiating Albarán line, Product Stock
summary, lot list and lot history refresh after projection cursor. History labels distinguish facts:

- **Reserved for [reference]** — commitment; no physical change.
- **Allocated to [reference]** — commitment; no physical change.
- **Allocation changed for [reference]** — prior and replacement amounts.
- **Stock sent for [reference]** — physical depletion.
- **Unassigned stock named as [lot number]** — zero-net reattribution, source/reason included.

No row calls reservation/allocation **received**, **deducted** or generic **stock update**. Compact
physical ledger labels **Received · Adjustments · Deducted · Remaining**; commitment sub-row labels
**Reserved · Allocated · Released**. This avoids calling allocation receipt.

### LOT-A08 · Exceptions and live changes

| State | Exact copy and required response |
|---|---|
| Quantity no longer free | **[amount] [unit] were allocated while you were editing. Review the latest stock.** Refresh/reapply only after explicit choice. |
| Allocation shortfall after count | **[amount] [unit] are allocated but no longer recorded. Resolve this before fulfilment.** Doors: **Change allocation**, **Release stock**, **Record a count correction** where allowed. |
| Expired/recall block | **This lot cannot be used for this order because [reason].** Door: **View lot details**; approved exception uses own review. |
| Target line changed | **This albarán line changed while you were editing. Review the line before allocating stock.** Never attach old quantities to changed product/unit. |
| Target deleted/voided | **This albarán is no longer available for stock allocation. Your stock has not changed.** Retain draft until safe discard. |
| Offline / uncertain | **This allocation has not been saved.** / **Checking this allocation…** Query idempotency before retry. |
| Permission loss | **You no longer have permission to allocate stock.** No values/doors beyond retained safe draft policy. |

## LOT-08 · Lots surface, source links, history and recall — LOT-D01 to LOT-D06

### Product Sheet stock anatomy

~~~text
Product Sheet → Stock
  → Recorded balance
  → Receive stock / Record a stock count
  → Lots
    → named lot rows
    → Unassigned stock row when present
    → Assign stock to lots
    → Stock history
  → Daily stock estimate (separate planning disclosure)
~~~

**Lots** is disclosure/card within Stock, never peer navigation seat. Heading **Lots · [N] recorded**
when named lots exist and **Lots · none recorded** otherwise. It has **Assign stock to lots** when
physical evidence exists and actor is permitted. Albarán-line **Allocate stock** remains in the
Albarán fulfilment context. Related supplier-email section belongs elsewhere on
Product Sheet as source evidence; it does not become Stock tab or allocation source by name matching.

### LOT-D01 · Lot row and overview

Named lot row has accessible door **Open lot [lot number]** and shows:

~~~text
[Lot number]                         [expiry/status]
[Supplier or No supplier recorded] · [received/count date]
Received [q] · Adjustments [q] · Deducted [q] · Remaining [q] [unit]
Reserved [q] · Allocated [q]          [Open lot]
~~~

Each number is projection at identified cursor. **Remaining** means recorded physical remainder, not
available-to-promise. Where they differ, row also says **[q] [unit] free to allocate**. Unassigned
row says **Unassigned stock** and shows same physical rows without pretending it has lot number.

### LOT-D02 · Source and identity inspector

Opening lot shows inspector/focused route titled **Lot [lot number]** and these read-only sections:

1. **Identity** — exact SKU, location, lot number, origin (**Received**, **Found in a count**, or
   **Named during reconciliation**), created time/actor and lifecycle.
2. **Source** — source receipts/counts, supplier if recorded, delivery references, retained emails
   or attachments with authorization-aware **Open source**, expiry and source status.
3. **Current stock** — Recorded remaining, active reserve/allocation, free-to-allocate amount and
   plain-language status.

If source deleted/redacted/restricted, show **Source unavailable** plus safe audit marker, not broken
link or copied protected content.

### LOT-D03 · Movement and commitment history

History is chronological and immutable. Each item has type, signed canonical quantity, unit,
actor/time, source/reason and relation doors:

| History type | Required wording |
|---|---|
| Receipt attribution | **Received [q] [unit]** |
| Count adjustment | **Counted [q] [unit] after check** plus before/after where applicable |
| Physical depletion | **Stock sent [q] [unit]** or named loss/return reason |
| Zero-net reattribution | **Named from unassigned stock** / **Moved to unassigned stock**; Recorded balance unchanged |
| Reservation/allocation | **Reserved for [reference]** / **Allocated to [reference]**; no physical-change label |
| Release/reassignment | **Reservation released** / **Allocation changed** with prior/new amount |
| Trace metadata change | **Lot details updated** with reason and field-level before/after; not receipt rewrite |

History has **Show older activity** with loading/failure/empty states and cursor pagination. It
preserves time and actor/timezone needed for audit, while displaying tenant-local time consistently.

### LOT-D04 · Linked lines and recall

Inspector has **Used in orders** and **Recall** sections.

- **Used in orders** lists only authorized albarán lines with document reference, customer display
  name where permitted, line status, allocated/sent quantity and issue/delivery time. Each opens
  exact line context, not generic order search.
- **Recall** has **Find affected orders**. It opens authorized recall query scoped to exact lot ID,
  optional date/location/status filters, named results, generated-at time and source cursor. Empty:
  **No matching orders found.** It never says “safe” or “all clear” merely because projection
  delayed or source unavailable.
- Recall case creation is dedicated governed workflow. It records initiator, evidence, scope and
  delivery/message outcomes separately. Query does not send message, reserve stock, archive lot or
  change order.

### LOT-D05 · Edit trace details

**Edit lot details** changes only versioned trace metadata: lot-number display correction, supplier
link, expiry, source links, quality status and explanation. It never changes
receipt/count/depletion quantities or issued document snapshot.

~~~text
Lot details → Edit lot details
  → Lot number / supplier / expiry / source links / quality status
  → Why are you changing these details?
  → Review changes
  → Save lot details
~~~

Form pre-populates current values; **Why are you changing these details?** required (3–500
characters). Lot-number correction runs collision review and retains prior display value in history.
Conflict: **Lot details changed while you were editing. Review the latest details.** Permission:
**You do not have permission to change lot details.**

### LOT-D06 · Lifecycle and restrictions

Derived lifecycle: **Active**, **Depleted**, **Expired**, **Blocked**, **Recalled**,
**Archived as historical**, or **Unknown traceability** where applicable. It derives from physical
quantity, expiry, quality/recall facts and source/trace status. User may not set lifecycle in a
dropdown without governing command/evidence.

**Archive as historical** only for zero-physical, zero-active-commitment lot with reason/review.
It removes from ordinary pickers but retains all evidence/history. Recalled/blocked lot cannot be
archived merely to remove warning. Restore/unblock/recall resolution requires governing quality/recall
command and appropriate role.


## LOT-08A · Stock Lots view anatomy — LOT-V01 to LOT-V05

The Product Sheet’s **Lots** disclosure is the short operational view. A fuller Stock list uses same
projection and terms; it must not calculate a second lot balance.

### LOT-V01 · Lots heading and entry

**Lots · [N] recorded** opens/expands named lot inventory for exact SKU/location. With no named lot
it reads **Lots · none recorded**. If unassigned physical quantity exists, a second factual line
reads **[amount] [unit] recorded without a lot number.** It is not omitted because named lots also
exist. Controls are **Receive stock**, **Record a stock count**, **Assign stock to lots**, and **View stock
history**, each shown only when its own permission/state allows it.

### LOT-V02 · Named and unassigned rows

Rows use the **LOT-D01** grammar, respect Product Sheet loading/empty/archive states, and have
separate primary **Open lot [number]** door plus nested actions with 44 px targets. The unassigned
row is never selectable as a named lot; its action is **Name unassigned stock** and opens the
zero-net reattribution route only when capability permits.

### LOT-V03 · Filters, sort and search

The fuller Stock list provides **Search lot number**, **Location**, **Status**, **Expiry**, and
**Show only stock available to allocate**. Filters change projection view only. They do not change
lot lifecycle, position, allocation or expected delivery. Sort labels are **Expiry first**, **Oldest
received first**, **Most stock first**, and **Lot number A–Z**. Current fulfilment policy sorting is
labelled **Suggested for fulfilment** rather than hidden.

### LOT-V04 · Empty, sparse and unavailable states

| State | Exact copy |
|---|---|
| No stock evidence | **No stock recorded yet. Record what arrived or count what is here.** |
| Physical stock but no named lots | **No lots recorded. [amount] [unit] are recorded without a lot number.** |
| Filter has no result | **No lots match these filters.** Action: **Clear filters**. |
| Source missing | **Some lot sources are unavailable. Stock history is still shown.** |
| Archived SKU | **This product is archived. Lots and stock history are read-only.** |
| No location permission | **Stock at this location needs permission.** No count/quantity leak. |

### LOT-V05 · View refresh and live state

The heading shows **Updated [time]** once the projection cursor has caught up. While a receipt,
count, allocation or depletion is accepted but not projected it says **Updating the stock view…**.
A later factual change names its nature: **A stock count was recorded while you were viewing** or
**Stock was allocated to [reference]**; it never merely flashes a new total. Expanded/collapsed
state and filters stay in local view context but do not make a stale physical value authoritative.

## LOT-09 · Command, API, event and projection contract

### Command transport

Target clients call tenant-scoped command endpoints over authenticated transport. Every mutable
request includes UUID-like **Idempotency-Key**, caller identity/tenant context and **If-Match** base
revision(s) for every aggregate it relies on. API validates schema, role, tenant, object relation,
lifecycle, decimal precision, policy and revision before event transaction.

Successful acceptance returns only after durable commit:

~~~json
{
  "commandId": "cmd_opaque",
  "status": "accepted",
  "aggregateRevision": 42,
  "eventCursor": "evt_cursor_opaque"
}
~~~

Projection reads may include **atLeastCursor** and report **projectionCursor**. Client waits or
shows **Updating the stock view…** until projection cursor reaches event cursor. API never returns
fake provider/warehouse receipt as if command performed external action.

### Target endpoint and payload boundary

| Command / endpoint | Required body fields | Critical preconditions |
|---|---|---|
| **POST /v1/tenants/{tenantId}/stock-receipt-batches** → **stock.receipt_batch.record** | ordered rows with exact SKU/location, quantity/canonical unit, production date, source links, named-lot or explicit Unassigned target, per-position base revisions | inventory-receipt permission for every row, all exact SKUs active/stock-enabled, all row and split equalities valid, every collision decision explicit; command is all-or-nothing |
| **POST /v1/tenants/{tenantId}/skus/{skuId}/stock-receipts** → **stock.receipt.record** | location ID, received quantity/unit, receivedAt, receipt reference/source links, allocations of lot/unassigned with lot ID or new-lot identity and quantity | active stock-enabled SKU, receipt permission, unit/precision valid, receipt equality, new-lot collision decision |
| **POST /v1/tenants/{tenantId}/skus/{skuId}/stock-counts** → **stock.count.record** | location ID, counted total/unit, countedAt, reference/source links, after allocations, traceability-loss decision/reason if used | count permission, count-after equality, base lot/position revisions current, policy permits unassigned row |
| **POST /v1/tenants/{tenantId}/skus/{skuId}/lot-position-splits** → **lot.position.reassign** | location ID, expected position/lot revisions, fixed recorded balance/unit, after allocations of named lots/unassigned, source/reason for named attribution | inventory-reconcile permission, exact fixed-total equality, no negative position, no active commitment undercut, typed new-lot collision decision |
| **POST /v1/tenants/{tenantId}/albaran-lines/{lineId}/lot-commitments** → **lot.reserve** / **lot.allocate** | intent, location ID, target line revision, requested quantity/unit, allocations, permitted partial reason | target has exact active SKU/unit, actor/line state allow intent, quantities free/eligible, no double hold |
| **POST /v1/tenants/{tenantId}/lot-commitments/{commitmentId}/reassignments** → **lot.allocation.reassign** | base commitment/position revisions, replacement allocations, release/reassign reason | commitment active/target current, selected positions already exist and are free/eligible, issued/sent trace uses correction path |
| **POST /v1/tenants/{tenantId}/albaran-lines/{lineId}/stock-depletions** → **stock.depletion.record** | physical sent quantity/unit, sentAt, allocations, reason/source for difference from commitment | valid fulfilment state, actual quantity attributable, named lots policy-eligible, no negative positions |
| **PATCH /v1/tenants/{tenantId}/lots/{lotId}** → **lot.trace.update** | expected revision, permitted metadata fields, reason | trace-edit role, same tenant/SKU/location, collision review for code change |
| **POST /v1/tenants/{tenantId}/recall-queries** → **lot.recall.query** | lot IDs/scope, filters, purpose | recall-read permission; query has no state-changing side effect |

Endpoint shapes are contract boundaries, not mandate for framework/database. Equivalent RPC transport
may be used only if it preserves command names, fields, error semantics, authorization and
idempotency.

### Events

| Event | Aggregate | Required payload facts | Projection consequence |
|---|---|---|---|
| **lot.created** | inventory position | opaque lot ID, SKU/location, entered display/normalized code, origin, collision decision/reason, actor/time | lot lookup/detail/list readable at cursor |
| **lot.source.linked** | lot | lot/source IDs, relation type, provenance/status | source evidence appears without copied source content |
| **stock.receipt_batch.accepted** | receipt batch | batch ID, ordered receipt IDs/SKU IDs, source kind/link, actor/time, idempotency key | Recent batch history and audit read update; it changes no balance without its row receipt postings |
| **stock.received** | inventory position | receipt ID, quantity/unit, location, actual received time, source/reference | Recorded balance/history increase only through postings |
| **lot.receipt.attributed** | lot | receipt ID, lot/unassigned target, signed quantity/unit | named/unassigned physical position increases |
| **stock.counted** | inventory position | count ID, counted total/unit, time/reference, prior evidence cursor | count history and Recorded balance reconcile |
| **stock.variance.recorded** | inventory position | prior/after/difference values/unit, count ID | variance/read model updates; no supplier-receipt wording |
| **lot.count.attributed** | lot/position | count ID, target, submitted after quantity, generated signed delta, traceability-loss flag | current named/unassigned remainder reflects count |
| **lot.traceability.relinquished** | inventory position/lots | affected lot IDs, moved quantity, reason, count ID | lots change/zero, unassigned increases, audit warning persists |
| **stock.physically.depleted** | inventory position | depletion ID, quantity/unit, actual time/reason, target line if any | Recorded balance/history decreases |
| **lot.depletion.attributed** | lot/position | depletion ID, target, signed quantity/unit | lot/unassigned remainder decreases; line trace resolves |
| **lot.reserved** | commitment | commitment ID, target line, lot/unassigned target, quantity/unit, expiry | Available-to-promise/line reads update; physical balance unchanged |
| **lot.allocated** | commitment | commitment ID, target line, lot/unassigned target, quantity/unit | allocation reads update; physical balance unchanged |
| **lot.commitment.released** | commitment | prior commitment, reason, release quantity | free quantity/line state updates; physical balance unchanged |
| **lot.allocation.reassigned** | commitment | prior/replacement commitments, target, reason | line trace changes; physical balance unchanged |
| **lot.unassigned.reattributed** | inventory position/lots | source unassigned amount, target lot ID, equal offsetting quantities, reason/evidence | named/unassigned positions change zero-net; Recorded balance unchanged |
| **lot.position.reassigned** | inventory position/lots | before/after named and unassigned positions, equal offsetting quantities, source/reason | typed lot split changes attribution zero-net; Recorded balance unchanged |
| **lot.trace.updated** | lot | revision, changed metadata fields, reason | detail/history/source refresh |
| **lot.lifecycle.changed** | lot | derived/authorized lifecycle fact and cause | picker eligibility/status changes; history remains |
| **inventory.overcommitment.detected** | inventory position/commitment | affected target(s), quantity, cause/cursor | fulfilment exception/shortfall visible; no silent release |

External messages, warehouse scans, ERP syncs and supplier-email parsers produce retained source or
adapter events first. They become commands above only after authorization/validation. Job queue
acknowledgement is not receipt, count or physical depletion.

### Required projections

| Projection | Reader contract |
|---|---|
| **Inventory position summary** | Recorded balance, evidence time, last physical count, active commitments, available-to-promise and cursor; expected/estimate streams separate. |
| **Stock receipt batch history** | accepted batch identity, actor/time/source, ordered exact-SKU receipt rows and direct Product/Lot doors; favorite preference is joined separately and never mutates evidence. |
| **Lot list** | named/unassigned rows, physical ledger totals, commitment totals, status/reason, no ambiguous code merge. |
| **Lot detail/history** | immutable event/posting timeline, source links/access state, current position/commitments and object doors. |
| **Allocation picker** | current eligible free quantity per permitted lot/unassigned row, policy block reasons and target-line revision. |
| **Albarán line fulfilment** | requested/reserved/allocated/sent/uncovered quantities and exact lot trace, with issued snapshot separation. |
| **Stock history** | receipts, counts, variances, physical depletion and zero-net reattribution distinct from planning and commitments. |
| **Recall trace** | authorized lot → lines/documents and line/document → lots traversal at declared cursor/time. |
| **Audit/exception queue** | collision decisions, source gaps, traceability loss, expired overrides, overcommitment and failed/retryable integration facts. |


## LOT-10 · Complete states, permission, concurrency and recovery

### Physical and traceability state matrix

| State | Product Stock / Lots surface | Editor behaviour | Prohibited false implication |
|---|---|---|---|
| No stock recorded | **No stock recorded yet.** | Receive/count may start; allocation has no eligible quantity. | Zero stock or zero lots. |
| Recorded zero | **Recorded balance 0 [unit].** | Count/receipt available; historical lots readable. | Missing evidence. |
| Unassigned only | **[q] [unit] recorded, with no lot number.** | Reattribute only with source/reason; allocation follows SKU policy. | Named supplier lot exists. |
| One named lot | **Lots · 1 recorded.** | One exact lot row; never omit unassigned if it also exists. | All balance is free/available. |
| Many named lots | **Lots · [N] recorded.** | Rows retain separate opaque IDs even where code text matches. | Same code means same physical lot. |
| New receipt | **Receipt not saved yet** only in draft. | No projection change before command acceptance. | Incoming message/scan already increased stock. |
| Count increase | **[q] [unit] more than recorded.** | Difference starts unassigned or typed discovered lot. | Supplier receipt occurred. |
| Count decrease | **[q] [unit] fewer than recorded.** | User sets after quantities; traceability-loss route explicit. | FIFO suggestion is proof. |
| Active reserve/allocation | **[q] [unit] reserved/allocated.** | Change/release needs target revision. | Recorded balance changed. |
| Fully depleted lot | **No recorded quantity left.** | Detail/history readable; ordinary allocation disabled with reason. | Lot disappeared. |
| Expired/blocked/recalled | Status/reason visible. | Ordinary allocation disabled; governed exception/correction path only. | Physical stock zero or source deleted. |
| Archived SKU | Stock history readable; stock writes unavailable. | Draft cannot commit. | SKU or issued trace disappeared. |
| Deleted/redacted source | **Source unavailable.** | Retain safe audit marker; no source-content leak. | Underlying receipt/count disappeared. |

### Editor and system state matrix

| State | Required copy and behaviour |
|---|---|
| Loading initial position | **Loading stock details…** Skeleton mirrors header/list; actions wait for authority/current cursor. |
| Loading lot/source history | **Loading lot history…** / **Loading source details…** with independent retry; safe current data stays readable. |
| Empty picker search | **No recorded lots match that search.** Offer **Add a new lot** only in permitted context. |
| Sparse source | **No supplier recorded** / **No expiry recorded** / **No source recorded** exactly where absent; no generic dash that resembles loading. |
| Invalid field | Field message, error summary and retained draft; focus order follows INTX-02. |
| Duplicate code | Collision panel requires existing/separate decision; no implicit row select. |
| Save in progress | **Saving receipt…**, **Saving stock count…**, **Reserving stock…**, **Allocating stock…**, **Saving lot reassignment…**, or **Recording stock sent…**. Only duplicate final action disabled. |
| Unknown result | **Checking this stock change…** by idempotency lookup. Reopening/retrying cannot duplicate. |
| Revision conflict | Exact before/latest/draft values and owner action; user chooses rebase/reapply/cancel. No last-writer-wins for quantity/lot identity. |
| Concurrent commitment | Availability recalculates after accepted cursor; stale selection gets exact unavailable message. |
| Permission denied | **You do not have permission to [action].** Protected lot/source details absent from DOM/hover text. |
| Offline | **You’re offline. This stock change has not been saved.** Eligible local draft may remain; no physical operation queues as presumed complete. |
| Network failure | **We couldn’t save this stock change. Your values are still here.** Retry preserves idempotency key/payload. |
| Server validation | Field/row-keyed error; no generic “Something went wrong.” |
| Hard deletion/retention | **This record is no longer available.** Unsafe cached draft/values cleared under INTX-02; audit-safe reference remains where required. |

### Roles and separation of duties

System role matrix under **FND-01** decides membership. Lots use narrow capabilities:

| Capability | Allows | Does not allow by itself |
|---|---|---|
| **inventory.read** | permitted position/list/lot history and source metadata | hidden source content, count, receipt, allocation, export or trace edit |
| **inventory.receipt** | actual receipt and receipt split | edit count, override expiry, allocate order, delete evidence |
| **inventory.count** | physical count and normal after-count attribution | traceability-loss action, expiry override, document correction |
| **inventory.reconcile** | zero-net unassigned reattribution and count traceability-loss with reason | rewrite physical history or issue document |
| **inventory.allocate** | reserve/allocate/release within ordinary eligibility | physical depletion, expiry/recall override, arbitrary target change |
| **inventory.fulfil** | actual physical depletion in valid line state | alter issued document snapshot or supplier source |
| **inventory.trace.edit** | permitted lot metadata revision with reason | alter stock quantities/history |
| **inventory.exception** | approved expired/blocked allocation and constrained shortfall resolution | bypass tenant/row authorization or make missing source true |
| **recall.read** / **recall.manage** | query / create governed recall cases | automatically message customers or mark delivery complete |

A person may have several capabilities through tenant role. Every command records effective actor,
role/capability, tenant, client/idempotency identity and decision reason where required.

### Workspace capability state

**Stock & lots** is a workspace capability, independent of Pricing. The E191 review build starts it
on so both postures can be inspected; production setup records the tenant's deliberate choice.

| Capability state | Stock and Product surfaces | Albarán surfaces | Data and return |
|---|---|---|---|
| On | **Stock update**, stock balance, Available lots, receipt/count/adjust actions are present when permissions allow. | Lot field, allocation trace and eligible FIFO proposal may appear. | Reads/writes authoritative inventory under normal permission and revision rules. |
| Off | Inventory commands, balance, lot list and stock-only empty states are absent. Product identity, unit, category and order history remain. | Lot field, lot allocation rows and lot proposal gate are absent; other order guards remain. | No stock/lot history is deleted or rewritten. Turning on restores the same authoritative projections. |
| Unavailable by release/tenant contract | Settings explains availability; no hidden deep-link command. | No lot command or protected lot value is rendered. | Existing retained history follows migration/export policy; the UI never implies it is zero. |

Turning the capability off while a changed stock draft exists follows the shared discard/keep
decision before settings apply. A saved deep link resolves to the nearest safe Product/Albarán
surface and states **Stock & lots is off for this workspace**; it does not show a broken panel.

## LOT-11 · Interaction, accessibility and cross-sheet consistency

**INTX-01** is authoritative for shared geometry and interaction. Requirements below apply it to lot
work and do not introduce unrelated design system.

### Focus, overlays, responsiveness and drafts

1. Focused route title always operation-specific: **Receive stock**, **Record a stock count**,
   **Assign stock to lots**, **Allocate stock**, **Reassign allocated stock**, **Record stock sent**,
   or **Lot [number]**.
   The system never calls all operations **Edit lots**.
2. Changed split draft is tied to tenant, SKU, location, operation, target line where any, base
   revisions and idempotency key. Opening source/product/albarán door asks shared discard/continue
   decision and restores draft/scroll/context on safe return.
3. Allocation picker and lot inspector are picker/route surfaces, never dialog nested above changed
   dialog. LotSplitEditor review replaces body in same active surface.
4. At 560 px and above, rows keep labels, summary and exact field in readable inner column. At
   559 px and below, every allocation row stacks identity, status, slider, exact field and remove
   action vertically; summary and final action stay visible above safe-area/bottom navigation.
5. Long lot numbers wrap or truncate with accessible full name. They do not overlay quantity, turn
   controls into unlabeled icons or cause horizontal scroll.

### Accessible quantity control

- Each slider and exact input has programmatic relation to lot number, recorded/free amount,
  operation, unit and error. Example accessible label: **Counted after for lot BATCH-0426,
  kilograms. Recorded before: 12 kilograms.**
- Visual slider track has 44 px minimum target; thumb/track use non-colour focus and pressed state.
  Assistive technology can operate exact field without slider.
- Slider cannot convey allocation completeness only by track colour. Summary text and field error
  give exact short/over/unavailable amount.
- **Existing lot**, **New lot**, **Unassigned stock** use radio-group semantics; picker rows use
  listbox semantics; **Add another lot**, **Remove lot**, source doors and final commands are named
  buttons/links with standard keyboard behaviour.
- Screen-reader announcements identify meaningful change: **2 kilograms still to split**,
  **Receipt saved. Recorded balance is now 18 kilograms**, or **This lot is expired and cannot be
  allocated**. They never repeat private supplier-email text.

### Cross-sheet propagation

| Accepted event family | Product Stock | Albarán line | Lot inspector | Must remain separate |
|---|---|---|---|---|
| Receipt/count/physical depletion | Recorded balance, lots and physical history refresh after cursor | fulfilment availability warning may refresh | position/history refresh | expected delivery, daily estimate, issued snapshot |
| Reserve/allocate/release/reassign | Available-to-promise and commitment rows refresh; Recorded balance remains | requested/reserved/allocated/uncovered state refresh | commitment history refresh | physical receipt/deduction history |
| Unassigned reattribution | named/unassigned rows refresh with zero-net history | affected allocation can use new named lot after separate command | source/reason event shown | Recorded balance / receipt time |
| Source/trace metadata update | lot row source/status changes | only linked trace context changes | identity/source/history refresh | normalized source content / physical quantities |
| Recall/quality block | lot status and picker eligibility refresh | relevant line gets exact concern/fulfilment block | recall evidence state refresh | unrelated products/lots/orders |

Presence may state permitted colleague is counting/allocating SKU/location; it must not lock sheet,
leak lot/source data, or replace revision checking.

## LOT-12 · Acceptance, migration and release evidence

### Required acceptance evidence

A **LOT-01** release record is complete only when build task graph links every control and proves all
of following against durable command/event/projection implementation:

1. **Identity:** typed new number; one/many matching codes; separate-lot reason; same text in
   restricted context; source link; expiry; legacy label; and no automatic code synthesis or
   code-as-primary-key path.
2. **Receipt:** zero/negative/invalid precision rejection; one/many named lots; permitted
   unassigned receipt; lot-required rejection; source missing/available; exact split sum; retry;
   duplicate idempotency; concurrency with count; immutable history after correction.
3. **Count:** no prior evidence; recorded zero; increase/decrease; one/many/unassigned rows; typed
   newly found lot; suggested split changed/declined; exact count-after equality; traceability-loss;
   active commitment shortage; stale revision; unknown unit; correct history/after position.
4. **Physical lot split:** zero/one/many named lots; fixed Recorded balance; typed new lot mid-split; duplicate choice; named/unassigned movement; active-commitment floor; exact split equality; stale revision; source/reason; and proof that **Save lot split** changes no physical balance.
5. **Allocation:** no free stock; one/many existing eligible lots; partial reserve; full
   allocation; reservation conversion without double hold; release/reassign; expired/recalled/
   depleted/fully committed rejection; door to independent **Assign stock to lots** where physical
   attribution is missing; proof that physical balance is unchanged by every commitment action.
6. **Depletion:** exact allocation trace; changed actual split with reason; policy enforcement;
   no negative position; line/document separation; retry/idempotency; resulting balance/history.
7. **Trace and recall:** lot → source → receipt/count → line/document and reverse traversal,
   unavailable source, permissions, trace revision/reason, zero/depleted/archive lifecycle,
   recall query no-side-effect rule, historical snapshot preservation.
8. **Controls/states:** every **LOT-V01**, **LOT-V02**, **LOT-V03**, **LOT-V04**, **LOT-V05**,
   **LOT-S01**, **LOT-S02**, **LOT-S03**, **LOT-S04**, **LOT-S05**, **LOT-S06**, **LOT-S07**,
   **LOT-S08**, **LOT-R01**, **LOT-R02**, **LOT-R03**, **LOT-R04**, **LOT-R05**, **LOT-R06**,
   **LOT-B01**, **LOT-B02**, **LOT-B03**, **LOT-B04**, **LOT-B05**, **LOT-B06**, **LOT-B07**,
   **LOT-B08**, **LOT-C01**, **LOT-C02**, **LOT-C03**, **LOT-C04**, **LOT-C05**, **LOT-C06**, **LOT-C07**,
   **LOT-L01**, **LOT-L02**, **LOT-L03**, **LOT-L04**, **LOT-L05**, **LOT-L06**,
   **LOT-L07**, **LOT-A01**, **LOT-A02**, **LOT-A03**, **LOT-A04**, **LOT-A05**, **LOT-A06**, **LOT-A07**,
   **LOT-A08**, **LOT-D01**, **LOT-D02**, **LOT-D03**, **LOT-D04**, **LOT-D05**, and
   **LOT-D06** has applicable normal, keyboard, touch, loading, empty, validation, save failure,
   unknown result, conflict, permission, offline, archived/deleted and source-unavailable proof.
9. **Responsive/accessibility:** desk, compressed desk, stacked desk and phone at 1600, 1024, 768,
   390 and 320 px show no horizontal overflow; direct controls 44 px; keyboard, screen-reader,
   reduced-motion, high-zoom and coarse-pointer complete same safe flow.
10. **Security/reliability:** tenant isolation, object-ID authorization, source redaction, role
   denial, retention, idempotency, outbox replay, projection rebuild, audit completeness, backup
   restore and disaster-recovery checks have recorded evidence.

### Legacy kit and data migration

Browser-kit/in-memory lot ledger is interaction evidence only. Production migration must not claim
accumulated display code is independently verified physical lot.

1. Import each legacy persisted lot record as distinct opaque lot ID with **legacy-import** origin,
   original display code, imported record reference, retained timestamp and confidence marker.
2. Where one legacy code aggregates several historical receipts, preserve aggregation as one
   imported evidence record marked **Legacy aggregated history**. Do not fabricate receipt-level
   split or supplier identity absent from old data.
3. Legacy generated/synthesized label remains historical display evidence marked
   **generated-legacy-label**. It never creates new target lot automatically and needs review before
   supporting current traceability decision.
4. Migrate physical balance, named positions, unassigned position and active commitments only
   through reconciliation report proving balance equations. Failed/ambiguous row stays visible
   migration exception; never silently rounded, merged or dropped.
5. Establish cutover cursor. Temporary dual writes compare event/projection totals, retain
   idempotency, and have explicit rollback/read-only plan. Legacy browser store is not competing
   source after cutover.
6. Only after migration/reconciliation, authorization, recovery and release evidence pass may a
   target service be described production-ready. This document is not that evidence.

### Build dependency order

~~~text
FND-01/FND-02/FND-03, INV-01, OBJ-01, INTX-01
  → opaque lot identity + retained source relations
    → decimal physical ledger + unassigned position + revision/idempotency rules
      → shared LotSplitEditor (LOT-S01–LOT-S08)
        → receipt flow (LOT-R01–LOT-R06)
        → batch stock intake (LOT-B01–LOT-B08)
        → count-after flow (LOT-C01–LOT-C07)
        → physical lot assignment flow (LOT-L01–LOT-L07)
        → reserve/allocate/reassign/deplete flow (LOT-A01–LOT-A08)
          → lot detail/trace/recall (LOT-D01–LOT-D06)
            → projection rebuild, migration, security/recovery and release evidence
~~~

Wiring task list must map every leaf ID to named implementation task, test and release artifact. A
polished kit path counts only as interaction evidence until authoritative boundary, durable
event/projection behaviour and relevant acceptance proof are complete.
