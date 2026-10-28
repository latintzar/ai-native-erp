# Catalogue, working sheets and export contracts — §175 (supersedes §168–§169 where stated)

2026-08-31. Design contract for the kept frontend and future runtime. This is an addendum to
THE-STANDARD-CATALOG, THE-OBJECT-MAP and THE-WIRING-INDEX, not another product model.
The current Product/Stock correction supersedes the older category-first presentation: Stock preserves tenant/source order by default.
Category and A–Z are optional sort choices inside Filters; no internal category appears in a default row. §169 makes English primary and Spanish a
secondary generated demo snapshot. Neither authorizes runtime wiring or the app-domain flip.

## 0 · Order-review profile and line interpretation grammar

The enabled catalogue is the tenant's literal SKU list. The screen is named **Stock**. Search
stays visible beside one compact **Filters** trigger, while **New product** remains on the right.
The trigger owns every list narrowing/sort choice as a draft: **Sort by** is **Source order** by
default, **Category** or **A–Z**; **Items** is **SKUs** or **Uncoded**; **Status** is **Current** or
**Archived**; and **Related product** is **Any item** or one explicit direct relation. Source order
means the tenant’s retained source/import order, not an inferred priority or alphabetical fallback.
Default rows show no Internal category. Desktop uses a contained popover and phone a bottom sheet.
**Apply** commits the complete draft to the list, **Clear** resets it to Source order / SKUs / Current /
Any item, and the trigger alone may show a compact applied count/summary. No choice applies immediately
and no separate Sort or archive control renders. Upload begins inside New product. Stock update, price
update, supplier inbox and tariff controls are absent while their capabilities are disabled.

Every coded-SKU list row has one identity and one destination: own artwork face, literal name, source
SKU when present and Unit. An accepted uncoded row has the same one-door grammar but a neutral
face, literal wording/unit and no artwork association. The whole row opens that Product Sheet. Internal
category is available only through Filters or the sheet; Related products is a separate explicit
record-to-record filter over reviewed `RelatedItemLink` endpoints. Neither is a sellable row. Missing coded-SKU artwork shows an honest review state;
it never repeats a group or related-product image. Fish, produce and meat fixtures remain isolated
tenant/demo worlds and cannot cross-populate search or artwork.

### Order-line interpretation states

Order review uses five orthogonal records. These are human-facing states and data contracts, not a
model implementation design.

| State | When it applies | Albarán rendering | Operator action | Durable result |
|---|---|---|---|---|
| **Exact SKU** | One tenant SKU and all required line fields are understood. | Normal product row. | Edit ordinary product, quantity, unit or note. | Accepted line references the exact SKU and retains source wording. |
| **Field check** | SKU is known but one field is ambiguous or abnormal, such as quantity, unit or pack note. | Normal row; only the cited field is wrapped/underlined in red, with its specific local reason. | Correct the field or dismiss the check with free text where policy permits. | New field revision re-evaluates only that check; dismissal remains scoped to the evidence revision. |
| **Off-SKU provisional** | Literal requested item is not in the tenant SKU list and the tenant permits one-off lines. | Entire provisional row is faded grey and italic. | **Accept once**, **Edit** or **Reject**. | Accepting preserves a one-off literal line and does not create an SKU, alias, Internal category/group, Related products link, artwork or ERP master. Rejecting preserves source evidence but excludes the line. |
| **Multiple SKU choice** | Two or more real SKUs remain plausible and no honest top candidate exists. | Compact product-line/choice hybrid with each candidate's own image, name, SKU and unit. No candidate is preselected. | Select one candidate, or choose **Something else** to move to off-SKU review. | Selection resolves and reflows to a normal product row; it records the exact chosen SKU and candidate-set evidence. Nothing commits before selection. |
| **Reply attention** | The uncertainty is about the request or customer response rather than line identity. | A reasoned, dismissible tray immediately above the conversation handoff dock. It can coexist with any line state. | **Open chat** / native email, or dismiss with free text. | Records attention, source scope and dismissal/resolution evidence; Rocoto does not send in this profile. |

A quantity outside optional tenant/customer typical ranges is a **Field check** around quantity,
not an off-SKU product. A strange pack/preparation phrase on a known SKU is a field check around
that phrase. An unknown product is never rendered as the first candidate. A reply flag always says
why attention is needed. Accepting, correcting or choosing does not claim the customer was
contacted; native handoff and the albarán edit are separate acts.

### Literal units

A ProductSKU owns one declared **Unit** reference and retained source label. Tenant Unit vocabulary may include kg, g, unit, box, tray, bunch, bottle, bag and tenant-specific terms. A selector is grouped and searchable, with **Use “[literal]”** as a reviewable value when permitted. A reusable `UnitConversion` records an explicit multiplier; an active product override wins over an eligible global conversion only for that exact SKU. A line snapshots the chosen Unit and any separately approved conversion revision. Without an exact conversion, the UI preserves the literal quantity/Unit and asks for review; it never converts. Unit-specific UI appears only for a real governed fact such as decimal precision, exact pack conversion, nominal/catch-weight reference or final measured weight.

## 1 · Three different objects

| Object | Identity and owner | What it can do |
|---|---|---|
| Universal reference | Versioned canonical subject and attributes, with sourced classification | Ground a name and suggest imagery/vocabulary. It never enrolls a SKU in a tenant catalogue. |
| Internal category/group | Tenant-scoped, reviewable finding for browsing and classification feedback | It can group mango and papaya without relating them. It has no commercial balance, Product Sheet, order price or albarán line. |
| Related products link | Explicit direct `RelatedItemLink` between two existing catalogue-record IDs—each a coded SKU or accepted uncoded sale item—with actor/time/reason/source | It supports reciprocal navigation only. It is non-transitive and has no category, price, stock, lot, source, artwork or order fact. |
| Sellable SKU | Tenant-scoped immutable product id and source-row identity; house name, external code, unit and status | Own prices, aliases, stock/lot history, artwork association and order-line references. It never inherits from a category/group or Related products link. |

“Mango”, “Mango avión” and “Mango indio” are independently named SKUs when the house sells them
that way. Relating them to Mango preserves all three original names, codes, rows and prices.
An unqualified “Mango” is not proof of a specific origin, variety or transport method. Attributes
remain unspecified until evidence or a person states them; “General” must not become an invented
commercial product name. An Internal category proposal carries source, review state and optional confidence; it is not an
order-resolution or commercial assertion. A category/group change never rewrites historical
albaranes or silently transfers stock/prices.

Gamba roja de Palamós and its congelada SKU can be connected by one deliberate Related products link.
Fresh and frozen remain distinct sellable identities and have their own price sheet and history. A note
saying “congelada” on a single line is not sufficient to create a SKU; repeated usage may propose
one, with evidence. An accepted proposal creates/links the explicit product id before it is used
as a sellable catalogue member. The kit's `sellable` amendment flag represents that reviewed state;
it is not a production authorization or classification engine.

## 2 · Durable shapes and invariant fields

- `TenantCatalogue`: tenant id, revision, source import ids, membership/archival events and scope.
  Sector assists suggestions; tenant membership is authoritative. Mixed real businesses remain
  possible. Demo fish/fruit/meat worlds have isolated fixture identities and storage namespaces.
- `InternalCategoryGroup`: tenant id, group id, display label, optional reviewed reference subject,
  source/review actor/time and provenance. It is classification context only; it never creates a
  commercial relationship or supplies artwork.
- `RelatedItemLink`: tenant id, relation id, two existing catalogue-record references (each a coded
  `ProductSKU` or accepted `UncodedSaleItem`), reciprocal display policy, actor/time/reason/source
  and lifecycle. It is direct and non-transitive: a link A–B plus B–C does not imply A–C. Only a
  reviewed inline **Related products** picker between two existing exact records may create or remove it.
- `ProductSKU`: tenant id, product id, retained source row/external code, original and display names,
  internal category/group review state, attributes with source/confidence/override, Unit,
  status and revision; SKU-scoped illustration asset/revision and generation/review state. Two equal
  names are not equal ids. Reviewed source business columns and row order may persist under the
  minimization policy. Original file bytes stay with the provider/user; THE-SOURCE-PRIVACY-SPEC
  governs transient parsing and re-selection.
- `ProductAlias`: tenant id, optional customer id, literal phrase, target exact SKU, scope,
  provenance and validity. An ambiguous alias must not select a more specific SKU silently.
- `IllustrationAsset`: immutable asset id/checksum, canonical visual subject, manifest aliases,
  source/provider, prompt/model/version where generated, approval and permitted usage. A visual
  alias does not assert species, SKU equivalence, stock membership or a regulatory classification.
- `UnitDefinition`: tenant id, unit id/label, exact-SKU equivalence where reviewed,
  factor/base unit, precision and revision. An unknown equivalence remains unknown.
- `TariffPrice`: tenant, SKU, tariff id, currency, exact decimal unit price, Unit/base unit,
  effective period, version, actor/source. Each tariff owns its own historical time series.
- `OrderLine`: stable line id, exact-SKU/candidate resolution evidence, written phrase, quantity, selected
  unit and frozen equivalence revision, price source/pin, derived total, lot, packing note and test
  lineage. Historical documents keep their frozen commercial facts — including a `klass` written
  before FEED-IA §197.2, which stays READABLE and is never rendered or written again.
- `CatalogueProposal`: tenant, proposal id/type, supporting note/import/conversation revisions,
  proposed relation/attributes, model/prompt version, confidence, review status/actor and supersession.
  Dismissal remains evidence; it must not delete or silently adopt the customer's language.

All mutations require tenant/actor authority and optimistic revision checks. Schema expansion is
additive. Archive records actor/time/reason and preserves foreign keys; there is no physical SKU
or albarán deletion in these interactions. Test lineage exists on rows, events and exported jobs.

### 2.1 · E186 New product list intake — one source surface, one review queue

**Add a product list** is a contained New product path, not a peer catalogue action. Its first
screen has two equally clear ways to provide one source: **Drop a file** and **Paste a product list**. Excel and CSV enter review; a selected PDF is handled only by the explicit unavailable state below. On desktop they occupy two balanced panes inside the shared task frame; on phone they stack
in that order with one primary continue action. Choosing either source creates one
`CatalogueIntakeSession`; there is no column mapping, Placement field, category picker or Related
items candidate step before results.

| Object | Session-visible facts | Durable boundary | It cannot do |
|---|---|---|---|
| `CatalogueIntakeSession` | opaque session id; tenant/actor/origin; source kind `excel_or_csv_file` or `pasted_text`; ordered item count; current visible state; transient raw selection/text | minimal source reference/checksum for a file or scoped text fingerprint, actor/time and final session outcome | retain raw file bytes/pasted text after the active session, admit an SKU, write category/group, make a relation, or invoke a runtime/provider by implication |
| `CatalogueIntakeReviewQueue` | one ordered queue for that session; state and next action for every item | accepted/failed/deferred decision summary only | reorder or merge literal source rows silently, treat a queue acknowledgement as a completed import, or manufacture a result |
| `CatalogueIntakeReviewItem` | source row/text locator and original wording retained as evidence; collective readback exposes editable **Product name** / **SKU** / **Unit** and explicit **Include** / **Skip** only | only an explicitly confirmed SKU's literal fields, provenance, actor/time and decision; an optional internal classification suggestion/default remains non-blocking metadata for later Product-Sheet review | create a `RelatedItemLink`, convert units, require per-row classification/artwork/source-history work, approve artwork, set price/stock or alter an Albarán merely because it was reviewed |

The queue uses these exact human-facing states and recovery doors:

| State | Visible next action | Recovery / truth rule |
|---|---|---|
| **Ready for input** | Drop a file or paste a product list | no source has been accepted; manual Add one remains available |
| **Reading source** | Cancel | transient read only; do not claim an imported record |
| **Automatic PDF review · Ready to connect** | Choose Excel or CSV, or paste the list | the selected PDF was not stored, parsed or queued; it is an honest unavailable capability, not a malformed import |
| **Review needed** | Review, correct, add or skip each item | original wording stays beside the readback; every duplicate-SKU row is corrected or skipped before confirmation |
| **Ready** | Add the reviewed item | no automated result or background process is claimed |
| **Source unavailable** | Reselect the file or paste again | raw source is not recoverable from a prior session |
| **Save failed** | Try again, keep editing or leave the unchanged draft | preserve decisions in the current screen; avoid duplicate creation |
| **Added** | Open the exact Product Sheet or continue the queue | means one explicit SKU confirmation succeeded, never that all rows succeeded |

The visible seam names are `catalogue.intake.opened`, `catalogue.intake.source.accepted`,
`catalogue.intake.review.ready`, `catalogue.intake.item.decided`,
`catalogue.intake.completed` and `sku.created`. They identify audit/UI handoffs only. E186 does
not prescribe a parser, model, worker, durable queue, provider or runtime behind them. Add one uses the same visible identity grammar: Product name, SKU and Unit. Its review is identity-only;
bulk intake uses the collective row readback. Internal classification may be retained as a quiet suggestion/default but is never a visible per-row intake decision. **Related products is deliberately absent from ordinary review.**

### 2.2 · E187 accepted uncoded sale items and request-history door

Products presents one deliberately mixed list of **Coded SKUs** and **Uncoded sale items**. The
record-kind filter is a real list filter, alongside Internal category, Related products and source
state; it is not a category or a silent promotion workflow. A coded SKU retains its literal
company name/SKU/Unit. An uncoded sale item is available only after the operator has used
**Accept once** on an off-SKU Albarán line and then deliberately chosen **Keep in Products**. It
keeps the literal line wording/unit and admission Albarán reference. It may be sparse forever.

| Record kind | Can own | Must never infer or create |
|---|---|---|
| Coded SKU | company identity, exact-SKU requests/history, internal category, reviewed art, direct relations and all independently gated future commercial/inventory facts | relation/category-inherited commercial facts |
| Accepted uncoded sale item | literal wording/unit, request history, internal category, neutral presentation, notes/change history, direct relations to either kind | a SKU code, artwork association/control, tariff, stock/lot, ERP master, customer alias, category membership or relation merely because it recurs |

**Related products** links are direct reciprocal record-to-record links: coded↔coded, coded↔uncoded or
uncoded↔uncoded. They are sparse, reasoned and non-transitive. Internal category/group membership,
name similarity, shared purchaser, source text and request co-occurrence cannot create one. The
Product Sheet's **Related products** section and list filter use the same links.

**Requested personalisations** is a compact chronology, not a duplicated order ledger. A row identifies date/customer,
original request wording and document status sufficiently to choose it, then opens the exact
Albarán and highlights the exact source/line. The door carries an opaque return-context token:
Products query/filter, selected list row/sheet, scroll anchor and focus target. Albarán Back consumes
the token and returns to that exact Product spot; invalid/stale token falls back safely to the
relevant Product Sheet, never a generic catalogue root. A history row never makes its historical
line editable through the product list.

A later explicit **Assign SKU** can offer a reviewed new/existing coded SKU destination, preserving
source line, uncoded item, request history and relations as historical evidence. It is outside the
order-review gate unless separately authorized; E187 defines the visible record boundary only.

## 3 · Events, folds and learning

> **E186 boundary.** This section records deferred production/runtime design. E186 may define only
> the visible intake result and its review/copy states; it does not implement or further design a
> parser, model call, event stream, fold, cost ledger, learning loop or provider integration.

Source-reference registration and transient parse results are separate events. Reviewable Internal
category, alias, Related products and illustration suggestions run outside the order reasoning loop. Fast deterministic
normalization is tier zero; a cheap parsing/classification model handles uncertain text; the
reasoning brain handles actual order decisions. Each model call records tenant, purpose, tokens,
cost, input evidence, model/prompt version and outcome. Budget and permission checks happen before
calls. Approved changes become versioned catalogue events consumed by the order projection.

Suggested event boundaries: `catalogue.import.source_registered`, `catalogue.sku.created/updated/archived`,
`catalogue.relationship.proposed/reviewed`, `catalogue.alias.reviewed`, `unit.equivalence.changed`,
`tariff.price.changed`, `illustration.proposed/approved`, `order.line.quantity.changed`,
`order.line.unit.changed`, `order.line.note.changed`, and `concern.raised/resolved/dismissed`.
Names are proposed integration boundaries, not claims these production events already exist.

The runtime owns durable event ordering, idempotency and tenant-safe folds. The kit's local ledger
proves the UI seam only. Catalogue and tariff folds publish revisions; the brain uses the relevant
revision/effective time and can explain its evidence. Historical replay freezes those revisions
and compares against shipped albaranes. A later learned fact cannot leak into an earlier replay.
Promotion of a note into a variation needs a reviewed proposal; notes stay freeform and their
history is retained. Model output alone never archives, reprices or merges a SKU.

## 4 · Quantity, unit and price are separate decisions

Quantity and Unit have separate visible labels and separate underlined targets on the albarán
row, including mobile. Quantity edits write only quantity. Unit edits write only the Unit and its declared equivalence. The existing fold can derive the new unit price from a known
factor; otherwise it marks price pending and asks for that unit's price. It must never invent a
weight, carry a per-kilo price as a per-box price, or change a sibling line/tariff.

“Change the Unit” differs from converting a physical quantity while preserving total:
the latter is an explicit conversion operation and carries amount, rate and equivalence together.
Final packed weight has its own field; lot is a real batch identity.

⚠ **THERE IS NO CLASS FIELD ON A LINE, OR ANYWHERE ELSE** (FEED-IA §197.2 «Remove class
everywhere» · §193.4). This clause read «Class is internal free text with recommendations and an
information affordance; it never prints on the customer document» — the whole object is repealed,
stated here rather than deleted. **The SKU carries what the market sells by; the lot carries when
the goods came in; there is no third taxonomy between them.** A grade word a person still types
claims nothing and rides the name as their own words (§41.5). The one `categoría` that remains is
the produce trade's **arriving trazabilidad record** on the batch — read off the lot's paperwork,
legally bound to the invoice, never a seat the app offers to fill.

Rate precedes derived total; both retain their units on the number's line. Totals use server-side
exact decimal arithmetic and cannot be supplied independently by the client.

## 5 · One sheet structure, with object-specific work

The stable product-sheet hierarchy is exact SKU/name → literal code → editable Unit → capability-gated Price/lot/stock → Related products → Internal category → Requested personalisations → exact row-linked Order history → contained Product performance. Product performance is last in the main sequence; source/change history remains a header-owned secondary destination. This is a hierarchy of contained work objects, not identical full-width database rows. Product identity uses this SKU’s own approved artwork. A missing or pending image has an honest, actionable state; it never masquerades as its parent’s art. Working product controls expose tariff prices and variants, each opening its
own editable price sheet. Stock/lot activity and chronological price history follow; insights
combine a compact graph with a supported qualitative reading and an expandable evidence dossier.

Customer identity/contact comes first, then tariff and compact frequent-product memory, then
upcoming/in-flight and historical orders. Delivery/account details remain editable and accessible
without displacing the frequent action. Insights follow the record. Albaranes keep writable
commercial facts together, line concerns on the uncertain line, response concern above the native
source conversation, and concise badges in the header. A source email remains an email thread;
forwarding is read-only, connected accounts expose their actual reply capability.

Create/edit/view reuse the same field names and relationships. Keyboard Enter commits a focused
field, Escape closes its editor, and browser Back returns through the actual sheet/menu path.
No sheet invents a second product/customer copy; doors name and open the stable object id. At
390px controls remain touchable, numbers legible, sections aligned and overlays scroll internally.

## 6 · Catalogue navigation and artwork coverage

The applied default is **Source order**: the tenant’s retained source/import order, with no Internal-category heading or category label in default rows. **Filters** may apply **Sort by Category** or **Sort by A–Z**; those alternate presentations do not alter source order data or create a relationship. The older category-first default is superseded.

**Category** and **A–Z** are optional applied **Sort by** values. **Related product** is an applied
direct-relation value, never a subgroup or hidden hierarchy. Search applies alongside the applied filter
set and covers house names, codes and reviewed customer aliases. All Sort by, Items, Status and Related
product values are composed in the one Filters draft and take effect only through **Apply**; **Clear**
returns Source order / SKUs / Current / Any item. Preferences belong to the viewer and do not mutate
tenant catalogue membership.

The image manifest is the library. Name aliases such as camote/boniato resolve an existing image;
they never add a product to a fish tenant. A generic visual fallback is not a taxonomic match.
Missing exact imagery shows a SKU-scoped reviewed request state. A reference/library, category/group
or Related products image is not an approved match for another SKU. Prompt/API availability must be
inspected and reported honestly; a local image lookup is not evidence of a working Ideogram
integration. Production
provider credentials, budget, storage, review and provenance are governed by
[THE-INTELLIGENCE-SPEC.md](THE-INTELLIGENCE-SPEC.md) INTEL-11; this contract retains the
exact-SKU, Internal category/group and Related products ownership boundary.

## 7 · Export centre: status first, controls on the same object

The navbar summarizes actionable work; opening it shows the selected business day directly.
Printing and file download are the daily primary tasks. Date selection is a secondary control.
Email delivery and ERP transport are separate status/detail destinations. Counts name their unit
(orders/jobs/pages) and are never combined into an unexplained badge. Archived rows are excluded
by explicit policy; review-blocked rows remain separately explained.

Printing captures A4/A5 and order revisions, groups divider + albaranes per truck, and keeps packing
runs consistent. Queue submission is not proof of physical printing. Files default to all active
orders of the selected day, including previously exported rows; changed-since-download is optional
and uses exact revisions independently of printing. A browser can state “Download started”; it
cannot prove disk saving or ERP acceptance. Format compatibility requires a versioned, validated
adapter profile. Generic Rocoto CSV is named as such.

Customer email exposes schedule, recipient, exact document revision, attempt/result and provider
receipt. Mail inbox integration does not imply outbound albarán policy. ERP adapters explicitly
support manual/daily/continuous cadence, timezone/cutoff, pause, cursor, last accepted revision,
next run, heartbeat freshness and per-record failure/retry. Unknown/unreachable/stale status
never becomes “synced”. Setup and future connections remain explicit design states; the kit makes
no live provider calls. Detailed durable job contracts remain INDEX §15.4–§15.8.

## 8 · English working version and Spanish snapshot

`app.html` remains English. `app-spanish.html` is generated from the same component sources with a
reviewed source-context translation dictionary; no hand-maintained frontend fork or DOM text
rewriter. The snapshot includes visible and accessible UI, errors, dialogs, static fixture
messages and headings while preserving user-entered values, product names, identifiers and links.
Template expressions retain their logic and interpolate translated surrounding copy. Provenance
records source commit plus dictionary/generator identity and build artifact checksums.

A snapshot is accepted only after representative reachable states at 1600/390, creation/editing,
source conversations, exports, settings and navigation have been exercised in Spanish. An English
fallback is an owed translation, not a green count. English and Spanish storage must not translate
or corrupt product ids/events. Later production locale preferences are a separate runtime task.

## 9 · Acceptance ledger and wiring ownership

- A7.17: tenant membership, Internal category/group and explicit Related products links, visual aliases and catalogue ordering.
- A3.31: independently editable quantity/unit and deliberate action/history/insight structure.
- A8.16: date-specific export overview and evidence-bound status/action presentation.
- D1.7: generated secondary Spanish snapshot, complete copy inventory and guarded kit publication.

Each task's files, executable drive and done-when are in THE-WIRING-TASKLIST. Before production,
prove tenant denial, revision conflict, idempotent replay, archive, independent tariffs, unknown
unit equivalence and provider failure. Before kit publication, prove fresh fish/fruit/meat worlds,
Internal-category/Related-products navigation, edit independence, export date/revision state, locale identity preservation,
RED→GREEN assertions and served 1600/390 pixels. This document specifies those obligations; it
does not claim that runtime implementation or the pending design verification has passed.


## 10 · Canonical ontology and human review (§175)

The universal reference is a classifier and vocabulary, not inventory. Its category/type/attribute
IDs must never be overloaded as tenant InternalCategoryGroup IDs, RelatedItemLink IDs or SKU IDs. TenantCatalogue membership comes
from retained imports, explicit creation and reviewed adoption. A mixed real business is legal;
the three demo casts are isolated fixtures, not tenant access policy.

An Internal category/group is classification context, while a `RelatedItemLink` is a deliberate direct
relationship between two exact catalogue records; each endpoint is a coded `ProductSKU` or accepted
`UncodedSaleItem`. Neither creates a hidden base SKU. A supplier can
independently sell both “Gamba roja de Palamós” and “Gamba roja de Palamós congelada”. Their names,
external codes, prices, price history, stock and order references survive both category grouping and
relation links. The universal reference supplies classification suggestions, not a replacement name.
A RelatedItemLink has no price to inherit silently. A price copied at creation is a proposed initial
value with its source, not shared price/history. Changing a category or related link cannot change a
commercial fact.

Each coded SKU owns its own illustration association. Asset storage can deduplicate identical approved
bytes, but an Internal category/group or `RelatedItemLink` never grants illustration approval to
another record; an accepted uncoded item keeps its neutral face and no artwork association. Visual equivalence is reviewed separately from classification and
commercial identity. The catalogue row, order row, Product Sheet and Related products selector read the
same SKU association.
Retain every reviewed imported SKU name/code/unit and its opaque source-row identity verbatim; normalized display names, customer-specific
aliases and classification are separate versioned facts.

### Variant creation and interpretation

A new sellable product is created only through **New product** with Product name, operator-supplied SKU
and Unit. One-product review is identity-only; bulk intake rows expose only Product name/SKU/Unit and
Include/Skip. Source/import processing may retain a non-blocking internal classification suggestion/default,
but that is reviewed later on the Product Sheet and never creates a direct relation. **Related products** is a separate inline picker that searches existing
exact records and saves one reviewed link only after both records exist. It cannot create a SKU, open a
creation modal, infer a variant, or transfer source, price, stock, lot, artwork or history.

A later runtime proposal may be a reviewable suggestion only. Its model/provider mechanism, prompt,
cost and approval workflow are deferred from this UI contract and must not be inferred from the
preprocessing review. The durable exact-SKU artwork association remains independent after creation.

### Product sheet state matrix

| State | Identity / immediate work | History and insight | Artwork / Related products |
|---|---|---|---|
| Imported, fully mapped | Original SKU/code and reviewed Internal category; price only when gated | Actual SKU orders; lots/tariffs only when separately enabled | Own approved asset; Related products only if explicitly linked |
| Imported, sparse | Same literal identity; missing unit/code/category shown as review-needed | Explicit empty sections, never synthetic customer/stock history | Missing image request; no invented attributes |
| New manual SKU | Required Product name, SKU and Unit; no Placement/Related products choice | Empty history until real acts exist | Internal category/artwork are later Product-Sheet work, never a creation-review chore |
| New confirmed related SKU | Independent SKU and own Product Sheet; price only when gated | Own empty history; no parent’s historical series | One deliberate link and own art request |
| Existing related SKU | Same controls as a product, own price/history/stock when gated | Own observations, even if sparse | Related products selector at the top |
| Edited SKU | Stable ID, original name retained, before/after event and revision | Existing history retained | Changed visual attributes require new review; old approved revision retained |
| Candidate from customer language | Evidence, proposed meaning, review actions; not presented as stocked SKU | Source notes/messages, not invented sales | No generation until reviewed creation |
| Archived SKU | Read-only historical context with restore policy | All references remain valid | No new orders by default; image retained |

No category opens a product sheet. Its hover/focus feedback action opens a conversation about the
classification of the group. The reply proposes explicit affected SKU IDs and a destination/diff;
confirmation changes the classification projection and logs the user's reason. Unknown language
stays an open proposal, not a guessed bulk mutation. Permissions/revision checks apply to every SKU.

## 11 · Concern evidence, scope and co-presence (§175)

A visible concern is a local, revision-aware UI record. Its exact target is one message or email card,
one editable field, one full product row, or one contiguous group of rows. It names one short
colleague-style reason, offers dismissal, and has no generic score, floating note, global banner or
independent badge state.

Presentation uses one thin brand-red boundary around that exact target. Its short dismissible
explanation sits immediately above the source card or target; it never drifts into unrelated row
space. A reply concern is immediately above the matching source card and native handoff. The full
Albarán and its condensed order-in-chat card use the same scope, boundary, explanation and actions.

A choice ambiguity is a compact question/product hybrid with clear options. Selecting an exact SKU
resolves it and reflows it into a normal product row. An off-SKU literal stays grey and italic with
**Accept once**, **Edit** and **Reject**; acceptance remains a one-off and creates no SKU, category,
relation, stock, artwork or outbound message.

Lifecycle is raised → active → re-evaluating after a relevant edit or sent message → resolved,
replaced, dismissed, or still active. A relevant change may replace or dismiss a stale reply note
and may show a brief dismissible acknowledgement. It never silently erases history: the prior
reason, target and outcome remain available in local disclosure history. Unrelated edits,
navigation, printing and failed saves do not resolve it. The composer tray uses this same reason,
scope and lifecycle.

These are UI events and observable obligations only. Durable concern storage, model evaluation,
provider reconciliation and learning remain later seams; the current release does not imply them.

## 12 · Artwork source audit (2026-08-31)

Inspected `assets/paintings/subjects.json` (790 subjects, each with a prompt field) and `manifest.json`
(795 manifest entries with separate workflow status: 789 done, 4 probe, 1 alias-of, 1 orphan). These are
separate inventories, not a one-to-one SKU/artwork claim. `build_subjects.py`,
`kinds_ref.py`, `build_map.py`, `reference_gate.py` and `pipeline.py` retain the generation and
index workflow. `pipeline.py` records external job/image results; it is not itself a generation
API client. `enqueue.py` points to a historical scratch batch directory, so it is not a durable
product worker. Current tools expose no Ideogram generation tool; no IDEOGRAM-named environment
variable was present in the build process. This is not proof that no account credential exists
elsewhere. No paid generation or provider health check was performed in this pass.

Runtime job contract: tenant/SKU/revision, reviewed visual description, reference/style prompt
version, prompt hash, provider/model/options, idempotency key, budget authorization, provider job
receipt, attempt/error/retry-after, immutable candidate asset/checksum and review actor/time.
States: missing → requested → queued → generating → review → approved; failed/cancelled have
explicit retry/cancel actions; outdated candidates cannot replace artwork for a changed SKU.
Only an accepted provider response advances queued to generating. Preserve the last approved
asset while replacement is pending. Artwork failures never remove the SKU or block order editing.
THE-INTELLIGENCE-SPEC.md INTEL-11 supersedes this abbreviated transition list with the full
versioned provider, webhook/poll, cancellation, stale-candidate and dead-letter state machine.


## 13 · Product sheet implementation contract (§176)

[THE-PRODUCT-SHEET-SPEC.md](THE-PRODUCT-SHEET-SPEC.md) expands §10’s state matrix into the canonical implemented UI and persistence contract. E186 supersedes older tenant/reference/family/SKU wording with literal SKU, Internal category/group and explicit Related products. The same sheet serves every adopted SKU; tariff charts and stock ledger enter only under their own gates. Original identity and aliases, reviewed creation/artwork, archive/restore and order-origin navigation remain exact-SKU scoped. Runtime/server/LLM/Ideogram obligations remain distinct from kit completion.

## 14 · Production intelligence reconciliation (INTEL-01 / INTEL-02)

This section and [THE-INTELLIGENCE-SPEC.md](THE-INTELLIGENCE-SPEC.md) govern production AI,
provider, job and proposal behaviour. They supersede an earlier reading of §§3, 6, 10–12 that
could imply a local preview, a generic library image, or model output is an authoritative
catalogue change. They do not change the exact-SKU, Internal category/group, Related products and reference ontology above.

### Three visual roles, never conflated

1. A **universal library illustration** is a reusable reference/lookup asset. It may be indexed
   by a canonical subject, form or alias and storage bytes may be deduplicated. It does not enrol
   a tenant SKU, assert a taxonomic fact, or approve commercial use.
2. **Category/group presentation art** is optional navigation decoration for an Internal category/group.
   It must be labelled as category/group presentation and may not appear as a SKU identity image
   on an order row, product identity block, export, or print document.
3. A **SKU artwork association** binds one immutable approved asset/checksum to one SKU and one
   reviewed visual revision. Every variant has its own association state: approved, missing,
   pending, stale or rejected. A library candidate can be proposed for several SKUs, but each
   association needs its own evidence, SKU revision check and human approval. There is no
   inheritance or automatic propagation from an Internal category/group, Related products link, alias,
   canonical subject or sibling SKU.

An asset can be physically deduplicated without making its approvals shared. A changed SKU visual
description invalidates pending candidates for that SKU only. Its last approved art remains until
a new SKU-specific candidate passes review. Artwork failure never blocks pricing, stock or order
editing.

### Catalogue intelligence boundary

Internal-category feedback, deliberate related-product interpretation and source enrichment produce versioned typed
proposals with evidence, target revisions and an explicit affected-record diff. A human review turns
an accepted proposal into the same authoritative command path used by an ordinary form. The model
cannot itself archive, merge, reprice, create a sellable SKU, alter stock, assign a lot, publish,
print, send, approve art, dismiss/resolve a concern, or mutate a projection.

An Internal category/group owns only classification/navigation. A RelatedItemLink owns only its two
navigation endpoints. Neither owns a member’s price, unit, stock, lot, order history, original
source identity or artwork association. An undo is a new revision-checked event, not a rewrite of
historical documents.

### CAT-14A · Order note and product-option review

A `prepNote` is a bench/packing instruction. It is internal document content, scoped to its
order line, and may remain on this albarán, the same customer’s future albaranes, or every
occurrence forever. It may appear on an authorized internal packing copy, but it is **never**
automatically quoted in a customer confirmation, email, outward-facing delivery view or ERP note.
The existing `prep-note` event has no audience/approval field, so no current filter can safely
infer that it is customer-visible.

A customer-visible option is a separate typed line snapshot, `customerOption`, with literal text,
`audience: "customer"`, `status: "approved"`, operator/review id, source event ids/revisions and
recorded time. It must be explicitly written or approved for the exact document. Confirmation
composition may include only that approved customer option; it must exclude `prepNote`, raw
`asked` wording, model text and unreviewed recurring notes. A customer request, a repeated phrase,
a supplier message or a model observation is evidence for a later review only; **repetition is not
consent to create a product option or send wording to the customer**.

Internal discussion opens from **Comments** in the line title. The right-side panel contains the exact-line author/time history and composer. The optional **Use this comment…** disclosure holds **Keep as comment** and **Review wording**. Review includes separate **Customer note** and **Product name** fields, explicit **Use on delivery note** and **Create separate product** actions. A direct **Add note**/**Save note** flow authors approved customer text with its own event evidence; no intermediate internal comment or fabricated email is required. See ALB-X01–04 for exact geometry/state/copy. The old inline Team note explanation box is retired.

`productRequests.suggestNewSkus` defaults to `false`. When false it suppresses recurrence-based
prompting entirely; it does not hide the manual review route and cannot create a SKU. When true it
may show the fact that the same note occurred for the same scoped customer/product, followed by the
literal consent boundary above. `productRequests.erpLines` defaults to `base-item-note`: the ERP
line remains the reviewed base item plus an explicitly approved `customerOption` snapshot where the
adapter permits it. A `mapped-variation` setting may map only an already reviewed, sellable
variation through its own fresh revision-checked decision; it never retroactively changes historic
document snapshots.

Production creation is one authorized, idempotent `product_sku.create_from_review` command with
the base SKU and catalogue revisions, note/source evidence refs, operator-confirmed display name,
Internal-category/attribute review ids and visual-description revision. It is atomic: either the SKU and its
review lineage exist together, or neither does. A `RelatedItemLink` is a later separate command after
both endpoint records exist. Product creation contains no inherited customer price, line
quantity, stock, lot, tariff, artwork association or source note. The current browser kit’s local
review record is a retained UI convenience only; it is not a production authorization ledger.

A created option becomes an independent SKU. Its price, Unit, stock/lots, aliases, image
request and SKU artwork approval have their own reviews and commands. The original albarán still
carries its original base item and internal note unless a separate operator explicitly edits that
document. No option creation automatically requests artwork, adopts an image, changes
Internal category/group or Related products link, or makes a note customer-visible.

### Stock, inbound and recommendation language

Catalogue intelligence must keep a **Recorded balance**, a **Daily stock estimate**, a
**Supplier-confirmed inbound**, and a **Rocoto suggestion** as separate typed fields. Each names
its SKU/revision, source evidence, `as_of` time, expiry and validation state. A daily estimate is
planning data, not a physical reset or an inbound promise; it must never be rendered as actual
stock or “back tomorrow.” A supplier inbound is shown only from an explicit confirmed supplier
source. When neither a fresh recorded balance nor confirmed inbound exists, the visible label is
**Availability not confirmed**.

No category feedback, variant interpretation, image job, or source alias can upgrade a planning
estimate into stock evidence. A supply announcement draft may describe uncertainty, but cannot
promise availability or a date from a par rule, historic pattern, forecast or model suggestion.
Every recipient preview names the affected records and opens the field-level evidence before a
human can approve dispatch.

### Source/provenance and inventory audit

The audited image inventories have deliberately different meanings. `assets/paintings/subjects.json`
contains **790 subjects and 790 prompt fields**. `manifest.json` contains **795 entries** with
separate workflow states (**789 done, 4 probe, 1 alias-of, 1 orphan** at the recorded audit).
Neither count proves a running provider integration or a one-to-one SKU/artwork relation. The
actual file inventory, manifest entries, prompt inventory and tenant SKU associations must remain
separate reports.

`build_subjects.py`, `kinds_ref.py`, `build_map.py`, `reference_gate.py` and `pipeline.py` are
retained source/provenance workflow material; `pipeline.py` records external results and is not a
durable generation worker. Raw prompts, provider request/response identifiers, tenant evidence,
storage paths, credentials and cost detail are restricted operational data. Public docs and
ordinary UI may expose only safe provenance such as prompt/style version and hash, provider/model
identifier, asset checksum, review state and authorized reference.

The production adapter is specified, but not claimed connected, in INTEL-11: versioned
`ideogram-v4-async@1`, SKU-scoped job state, signed webhook/poll reconciliation, temporary-result
ingest, budget authorization, candidate validation, and human review. It replaces no historical
source asset unless that SKU’s approved association changes through a command/event.
