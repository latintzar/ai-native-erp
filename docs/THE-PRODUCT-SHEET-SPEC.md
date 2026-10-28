# Product sheet — archetype, controls and current UI contract, §§176–191

Source: FEED-IA §§176–191 plus the governing E191 board. E188 supplies the shared physical grammar;
E189 supplies the Product/Stock ontology and source-order correction; E190 makes the Product Sheet a
composed work surface rather than a labelled database stack; E191 supplies reversible Pricing and
Stock/lots postures, batch/photo intake and the high-speed tariff matrix. E187 retains the uncoded-record boundary
where later releases do not replace it. Authority: [architecture](THE-ARCHITECTURE.md) → [system
specification](THE-SYSTEM-SPEC.md) → [shared interaction specification](THE-INTERACTION-SPEC.md) →
this control contract. Domain ontology: [catalogue contract](THE-CATALOGUE-CONTRACT-SPEC.md).
Historical acceptance: [English design backlog](omitted-sources.md). E191 supplied
the verified product-sheet baseline; its guarded publication and exact evidence are recorded in
[RELEASE-191](omitted-sources.md).

## 0.0 · THE LIVE-FIELD LAW (E193.01 · FEED-IA §196.1)

Peter, 2026-09-04, on the served E192 sheet:

> the product sheet looks weird and hardcoded for half the stuff, they dont look optional and have
> weird structure, like it's a blend of hard non editable looking stuff and then like fucking
> collapsable sections which is dumb, it doesnt look like live dropdowns. in general any time its a
> field that is sort of cms related like a form field for a product there should be a dropdown with
> suggestions appear which filters as people type… same for units, same for like other shit.

This section governs every other section below it. Where an earlier row describes a passive
label/value card, a «direct edit door» into a dialog, or a disclosure, **this law replaces it**.

1. **Every CMS-like product field is a live field.** Code, Unit, Description, Internal category,
   Group and the Related-products picker are one shared component — `app/src/prototypes/cedar/live-field.tsx`,
   a `LiveField` built on Base Web's own `Combobox` (the same organ `detail.tsx` uses for the
   albarán line's unit and lot; never a second dropdown engine). The field IS the value's seat:
   the input stands where the value is read, one press puts the caret in it, Enter or leaving the
   field commits, Escape leaves it. ⚠ SUPERSEDES §0.2.1's «Code and Unit … each object owns its
   value, state and one direct edit door» and the **Edit product** dialog it opened.
2. **The list is the house's own, and it filters.** A live field's suggestions are the tenant's
   real values — the categories and groups already filed, the units already sold in, the products
   already in the catalogue. Typing filters them: values that BEGIN with what was typed lead,
   values that CONTAIN it follow. Nothing is offered that the house did not put there.
3. **The typed word is accepted as new.** When nothing matches, the list's last row offers the
   typed word marked **New**; taking it writes a new category, group or `TenantUnitDefinition`.
   The one exception is **Related products**, whose value must name an EXISTING record: that field
   declines a typed word and never opens New product (§0.2.3 stands).
4. **Optional looks optional; set looks set.** An optional field that is empty carries the word
   **Optional** once, on its label's row, and a placeholder that says what to write. A set field
   takes the white ground and the value at label weight. A **held** field (a Unit already used by
   orders, prices or stock) keeps the quiet ground, states its reason and carries the way on.
   No field says «Not set».
5. **Nothing folds.** The Product Sheet has no collapsible section: Available lots, Daily stock
   estimate, Stock history and **Source & changes** stand open under flat headings. ⚠ SUPERSEDES
   the `sku-lots-toggle` / `sku-replenishment-toggle` / `sku-movements-toggle` / `sku-dossier-toggle`
   disclosures and the identity head's clock that hid Details & history. Source & changes sits
   directly before Product performance, so performance is still the end of the main reading
   sequence (§0.2.5).
6. **What is left of the dialogs.** One survives — **Unit conversions**, which is a sub-object
   surface and not a field (UNT-02.1), reached from the Conversions row and exiting by Back.
   Archive keeps its confirmation. Nothing else on this sheet opens a dialog to change one word.
7. **The same fields everywhere.** New product asks for Product name, SKU and Unit in the same
   component and the same grammar (§195's checkout-grade consistency), and the conversion rule's
   two ends are the same Unit field. A person meets one field, not five.

8. **And «same for like other shit» is the rest of the app.** E200.07 carries this whole section
   outward: every pick-from-a-list field in the Customers area and in Administration is the same
   `LiveField`, on the same grammar, with the same floors — the law is stated once for the whole
   application in [THE-INTERACTION-SPEC](THE-INTERACTION-SPEC.md) **INTX-17**, and `LiveChoice`,
   the attached menu those seats used, is retired.

**Drive:** `drives/drive-194-product-fields.py` (seven widths: 1920 · 1600 · 1536 · 1366 · 393 ·
390 · 360, including the phone's keyboard posture) — **228 GREEN / 0 RED** at its pin after E200.07.
**Read by a harness:** `[data-live-field=<id>]`,
`data-live-state` (set|empty), `data-live-optional`, `data-live-suggestions`, `data-live-new`,
`data-live-held`, `[data-live-input=<id>]`, `[data-live-list=<id>]`, `[data-live-option]` (known|new).

## 0. Active order-review profile — exact screen contract

This section governs the current English product. The E191 Kit deliberately begins **Pricing** and
**Stock & lots** on behind two independent persisted workspace switches so both complete postures can
be reviewed; production defaults remain off until a tenant enables them. Turning either switch off
removes its Product, Customer, Albarán, Export and action surfaces without deleting its ledger, and
turning it back on restores the same facts. Supplier-email/provider intake, provider sending and ERP
execution remain separately unavailable. The Product Sheet must feel complete in every posture; it
may not leave empty commercial placeholders, disabled fields inside the work surface, or founder
explanations.

### 0.1 Desktop and phone frame

- Desktop sheet uses the shared 12-column content grid, a maximum readable width of 1,120 px and
  32 px outer gutters (24 px at 1366×768). Sections align to the same left and right grid lines.
  Identity spans all columns; evidence cards use 6+6 or 8+4 spans and wrap at their specified
  breakpoint rather than squeezing labels.
- At 767 px and below the sheet is full-screen. The 48×48 px Back chevron sits on the left edge;
  previous/next, when the user opened from a result set, are 48×48 px controls on the top right.
  The application footer is hidden. Content has 16 px side padding and one vertical scrollport.
- Long names, source SKUs and unit labels wrap. They never shrink below body text, overlap an
  action, or create horizontal scrolling. Hover-only doors also remain as labelled/icon actions on
  touch and keyboard focus.

### 0.2 Reading order and every active control

The active sheet is SKU-first and uses one predictable visual grid. It does not manufacture a code,
unit, commercial fact or relation in order to make a sparse product look complete.

1. **Identity and artwork**
   - Reading order is exact product name → literal SKU/code when one exists → editable **Unit**.
     Existing imported records with no code show their retained source identity honestly; a visible
     placeholder or generated code is prohibited. A newly created sellable product still requires
     its operator-supplied SKU.
   - The exact-SKU image is the artwork surface: 112×112 px on desktop and 88×88 px on phone.
     It has one adjacent/overlaid accessible 44×44 px pencil action, labelled **Upload artwork**
     when none is associated and **Replace artwork** when one is associated. The action opens the
     shared reviewed-artwork flow. There is no visible **Illustration** field, description editor or
     separate image-editor section on the Product Sheet. An accepted uncoded sale item has a neutral
     face and no artwork action.
   - Product name and art form the identity header; the name is edited where it is read (one
     press puts the caret in the heading — §0.0.1). Code, Unit and Description are live fields on
     the same grid beneath it, in that order, followed by the Conversions row. ⚠ §0.0 SUPERSEDES
     the earlier «one direct edit door» reading: there is no **Edit product** dialog. Source
     values, aliases and revisions stand in the flat **Source & changes** section before Product
     performance. Archive/restore is the only destructive secondary product action, and it lives
     in that section.

2. **Capability-gated commercial facts**
   - Only when their named capability is enabled, **Price**, lot and recorded stock appear directly
     below Unit in that order. Missing evidence says **Still to record** or **Set price**, never zero.
     A one-tariff tenant shows one **Price** card. Multiple tariffs form a responsive two-column card
     grid on desktop and one column on phone. Each card owns its tariff name, current product price,
     effective state and History door. **Manage tariffs** opens the shared company tariff registry;
     renaming there retains the stable tariff ID and every historical price.
   - Unit is editable only under the established unit-lock policy. Choosing a unit reveals UI only
     for an actual governed fact—precision, an approved equivalence, nominal/catch-weight reference
     or a required final-weight field. It never assumes a conversion, weight, price basis or stock.

3. **Catalogue context**
   - **Related products** is an inline live picker of deliberately linked *existing* exact records
     (§0.0.3): it stands open — no Edit mode in front of it — filters the catalogue as the person
     types, and CHOOSING a row IS the link. It never opens New product, creates an SKU, accepts a
     typed word, or turns category co-members into relations. Each manually linked row carries
     **Remove**; an authored relation says **Recorded**.
   - **Internal category** follows the relation picker as a quiet, reviewable classification fact,
     written through two live fields — **Category** and **Group**, both optional, both offering the
     house's own filing and accepting a new word (§0.0.2–3). Until a product is filed, the field is
     empty and its placeholder states what Rocoto reads it as from the reference. The section keeps
     its door to the Copilot for bulk classification (§196.2). It is not shown in Stock's default
     rows, is not a placement workflow, and has no commercial, artwork, stock, lot or order
     ownership.

4. **Requested personalisations and exact order history**
   - **Requested personalisations** lists only retained note/request facts linked to this exact SKU.
     Each row names the request briefly and opens the cited Albarán line; Back returns to this exact
     Product Sheet, selected row, query/filter and scroll anchor.
   - **Order history** follows, defaults to the five most recent exact-SKU lines, and expands in
     place. Each row opens only its Albarán and returns to the exact origin. Category/group and
     Related-products membership never contribute another SKU’s history.

5. **Product performance — the final main section**
   - **Product performance** stays at the bottom in one contained, subtle square-grid field. Its
     metric and chart cards show evidence from completed Delivery Notes for this exact record only: completed
     orders, distinct customers, quantity over time and quantity by customer. Every card is a
     clickable keyboard/touch door to the exact values and cited Albaráns.
   - A single observation remains a point or bar, never a fabricated trend. Quantities with
     incompatible Units are split or labelled separately; they are never silently added. Missing
     evidence has an honest empty state rather than a zero or demo statistic.
   - Product performance is the end of the main reading sequence. Source identity, aliases,
     artwork provenance and chronological field changes remain reachable from the header's
     details/change-history action; they do not create another full-width section after Stats.

### 0.2.1 · E187 coded and uncoded product sheets

The frame and reading order above are shared by the two exact sellable-record kinds. A **Coded SKU**
shows literal **SKU** and its independently gated commercial/inventory bands. An **Uncoded sale
item** instead shows **Uncoded sale item** and the literal wording/unit accepted from its source
Albarán; it never displays a fabricated SKU code or empty commercial placeholders. It has a neutral
face, with no artwork association, artwork status or artwork control. Both record kinds can show
Internal category, Related products, **Requested personalisations**, Stats when evidence exists, notes/change history
and archive state.

**Requested personalisations** replaces generic product-history narration. It is a compact
exact-record list with request date/customer/literal request and status. Its row opens that exact Albarán with the cited
line highlighted. The header Back/Browser Back returns to the same Product Sheet and restores the
Products filter/query, selected record and scroll anchor. Opening a request cannot edit it from the
Product Sheet or imply it has become a stock, tariff or ERP record.

Related-products options always identify record kind. A coded or uncoded record may be directly related
to either kind. No category/group co-member appears in the selector. **Assign SKU** is not a normal
sheet action: any future promotion is a separately authorized reviewed migration preserving the
uncoded record's source and request history.

### 0.3 Creation, import and sparse states

**New product** opens the standard task frame: 800×600 px desktop, at most 8 px from the viewport,
one internal scrollport, and full-screen on phone. All entry points use the same frame and field
grammar.

- The first screen offers **Add one product** and **Add a product list** as two contained paths.
  Add a product list is not a separate Products toolbar action.
- Add one has three deliberate steps:
  1. **Product** — **Product name** and required **SKU**.
  2. **How it is sold** — required **Unit**, the same live field the sheet carries (§0.0.7): it
     offers the trade's starter words beside every Unit the house already uses, filters as the
     person types, and keeps the written word literally when nothing fits. It does not infer a
     conversion, package content or price basis.
  3. **Review** — identity only: exact Product name, SKU and Unit. It is the final editable
     readback before **Create product**, not a classification, artwork or source-history task. There
     is no Category picker, Placement field, family filing, Related products candidate list,
     per-product Internal category result or artwork-status control in this path. **Create product**
     is the only committing action. Internal classification may be retained as a quiet internal
     suggestion/default, then reviewed later on the Product Sheet.
- **Add a product list** is one simple input surface: **Drop a file**, **Paste a product list**, or
  **Take photo** on a phone. Excel and CSV enter the review queue; a PDF shows **Automatic PDF review
  · Ready to connect** with **Choose Excel or CSV, paste the list, or take a photo** and is not stored or
  queued. A photo is session-only source evidence; without a connected extractor it says **Photo
  attached** and asks the operator to complete/check Product name, SKU and Unit. It never invents an
  OCR result, category, relation, artwork, price or stock fact.
  On desktop its two input panes sit side by side within the 800 × 600 task frame; on phone they
  stack with 16 px spacing and one bottom action. The operator supplies one source at a time. There
  is no field mapping, Placement screen or relationship review before results. Either source opens
  one collective **Catalogue intake readback**. Rows retain their raw row/text locator and original
  wording as source evidence, but expose editable **Product name**, **SKU** and **Unit** plus
  **Include**/**Skip** only. The operator confirms that collective processed readback; **Add**
  commits only included rows. A repeated canonical SKU blocks confirmation until the operator
  corrects or skips the affected row. Internal classification may be retained as a quiet
  source-derived suggestion/default, but is never a per-row intake chore; artwork, source history
  and Related products are reviewed later on the Product Sheet.
- Queue states are **Ready for input**, **Reading source**, **Review needed**, **Ready**, **Save
  failed** and **Added**. They expose only their truthful recovery: correct a named field, skip an
  item, reselect/paste again, retry, return to an unchanged manual draft, or open an added exact
  SKU. No parser, model, provider or background review is claimed. Raw file bytes and pasted text remain in the active session; only a
  minimal source reference/checksum or text fingerprint, locator, reviewed literal facts, result,
  actor/time and decision may cross the review boundary. A queue result never creates an automatic
  category/group write, Related products link, unit conversion, artwork approval, price, stock or
  customer-visible fact.
- Success opens the new exact Product Sheet. Its illustration state is **Needs illustration** until
  a reviewed asset is associated. A reference/library or related-product image is labelled a candidate;
  it never fills the gap as approved artwork.
- Validation copy names the field: **Add a product name**, **Add an SKU**, **Add a Unit**, **This SKU is already used by [product]**. Failure keeps every entry and offers
  **Try again**; Cancel/Back never saves a partial product.

A Product has one visible **Unit**. Units are tenant-defined literal business vocabulary. The UI selects a known Unit or preserves a new literal label for review; it does not guess a conversion. A reusable `UnitConversion` records one positive exact multiplier such as `1 box = 8 kg`: the applicable global conversion is the default, while a Product Sheet can save an exact-product exception that shadows it only for that SKU and Unit pair. Nominal pack text, catch-weight handling and final-weight requirements remain separate measurement facts; they do not become competing Product units or calculating conversions. Merely choosing **box**, **bottle**, **kg** or another label does not invent weight, price basis, stock quantity or equivalence. Price, lots and recorded stock sit immediately under Unit only when their own capability is enabled.

## 1. What the sheet represents

The sheet is one **company sellable catalogue record**, identified by sector/tenant and a stable record ID: either a coded SKU or an accepted uncoded sale item. The universal reference and Internal category may classify it; explicit Related products links connect it only to deliberately related existing catalogue records of either kind. Neither classification nor a link owns prices, images, customer aliases, stock or history. Native/imported, manually created and confirmed related coded SKUs all use `ProductCard`; the accepted-uncoded sheet keeps the same primary-sheet frame and reading order while omitting facts that record kind cannot own.

Keep original import/source names and codes separately from the current display name/code. Editing changes the current projection, records before/after values and an actor/time/revision, and never changes SKU ID or old order snapshots. Equal imported names with different source SKUs stay separate. Customer aliases have optional customer scope; they never replace the canonical SKU name. The kit stores and searches them; runtime language matching must respect that scope.

`sku-record.ts` owns identity projections only. It does not create a second pricing, catalogue or stock ledger. `tiers.ts` remains the price authority; `incoming.ts` remains the movement authority; `catalogue.ts` remains the category/adoption and Related products review authority. Every new helper has live callers.

## 2. One hierarchy, including sparse states

1. **Identity:** exact record/name, retained literal code and artwork surface only for a coded SKU, and editable Unit. No code or artwork ownership is invented for an accepted uncoded item or sparse import.
2. **Capability-gated current facts:** Price, lots and recorded stock appear immediately below unit only when their own capability is enabled. One tariff is **Price**; multi-tariff tenants may use **Tariffs**. No evidence is never a zero.
3. **Related products and Internal category:** an inline picker adds/removes reviewed direct links between existing exact records; it never creates an SKU or modal. Internal category follows as independent reviewable context. Neither transfers price, stock, lot, source, artwork or history.
4. **Requested personalisations and Orders:** retained note/request facts, then Upcoming & in flight and exact Order history. Every row uses the exact catalogue-record ID and returns to its exact origin after opening the Albarán.
5. **Source evidence:** when the inventory and supplier-intake capability is enabled, compact exact-SKU source cards show permitted provider/source metadata, relation/review state and return context. No Related-products-inherited messages. Stock update owns the incoming feed and source reader; the Product Sheet is never an inbox.
6. **Product performance:** the final main section; a contained bottom grid field with exact-record
   completed order count, distinct customer count and evidence-backed quantity-by-date and
   quantity-by-customer cards. No category/group or Related-products total is presented as that
   record’s evidence, and incompatible Units are not aggregated.

Details/change history remains a header-owned secondary destination for original identity, source,
aliases, artwork provenance, field revisions and archive state. It is not another main section
after Product performance.

Hierarchy, reading order, typography and components are shared between the catalogue pane and a product opened from an albarán. [The shared interaction specification](THE-INTERACTION-SPEC.md) owns cross-sheet routes, return context, focus, scroll, overlay nesting and responsive geometry. Desktop panes own one scrollport; a phone sheet and its overlays fit the viewport and scroll vertically. Long identifiers and source names wrap rather than force horizontal scrolling.

## 2A. Interface anatomy — sections, controls, menus, fields and states

This is the **UI structure**, not a task breakdown. A nested item below is something the person
sees, edits, opens or is told. PRD IDs connect it to the detailed control contract in §10. Shared
field/save/loading/permission patterns are inherited from OBJ-01; the specific text and overrides
below take precedence for this sheet. No button may invent a different form or default.

Production-only asynchronous/permission controls are fully designed here but must stay unavailable
in the kit until their real adapter exists. The kit/provider boundary remains visible; this anatomy
is not a claim that every production state is currently executable.

- **Product sheet — one company’s sellable product**
  - **Identity**
    - Return control — PRD-N01
      - From catalogue: **Back to catalogue**.
      - From an order: **Back to the albarán**.
      - Result: restore the actual origin, its selection and scroll position.
      - Unsaved nested form: keep the draft in its history layer; apply the shared leave-review rule before discarding it.
    - Product title — PRD-N02
      - Text: current product name; wraps onto another line when long.
      - Supporting row: company SKU code, when present; **Unit {unit}**.
      - Classification breadcrumb: reference category path, informational rather than another product sheet.
      - Edited state: actor/time is secondary; original identity remains under Product details & history.
      - Archived state: **Archived product**, consequence text and **Restore product**; historical reading remains available.
      - Loading: identity skeleton without invented name, price or image.
      - Missing/access-denied: **Product unavailable**; explain absence or permission safely; offer the actual return control.
    - **Artwork surface** — PRD-N03 / PRD-A01
      - Visible image: this product’s approved exact-SKU association, never a category/group or
        Related-products implicit assignment. The image itself owns one accessible ≥44 px pencil
        action: **Upload artwork** if absent or **Replace artwork** if an asset exists.
      - The action enters the shared reviewed-artwork flow: permitted PNG/JPEG/WebP upload, candidate
        comparison, **Use for this product**, **Reject** and truthful unavailable/error/retry states.
        Its durable artwork object, provenance and approval rules remain defined in §7.
      - There is no visible **Illustration** field, description field or separate illustration editor
        in this Product Sheet. Archived/read-only records may inspect provenance but cannot mutate it.
    - **Edit details** — PRD-N06 / PRD-D01
      - Opens **Edit product details**.
        - Scope text: **Edit how this product is named and described. Prices, stock and artwork have separate controls. Your original details and past orders stay unchanged.**
        - Field: **Product name**.
          - Default: current saved name; required; original source name is retained separately.
          - Empty: **Enter a product name.**
          - Too long in production: **Use 200 characters or fewer.**
        - Field: **Your SKU code · optional**.
          - Default: current code; preserve leading zeros and meaningful punctuation.
          - Empty: no code supplied; never generate a fake customer SKU.
          - Duplicate: show the matching company records and a review choice; no automatic merge.
        - Field: **Unit**.
          - Default: current Unit.
          - Before commercial history: select a registered unit; custom units use the shared unit/equivalence editor.
          - After commercial history: locked; **This unit is already used by prices or stock. Add a variation to sell in another unit.**
          - No unit: **Choose how this product is sold.**
        - Field: **Description · optional**.
          - Multiline; current saved description; meaningful newlines retained.
          - Not the source order note or an artwork prompt; no automatic cross-field rewriting.
        - Group: **Names customers use**.
          - Help: **Save the names people use when ordering. Choose one customer if a name only has that meaning for them.**
          - Each row.
            - Name input: the actual alternate wording.
            - Customer selector: **All customers** or one named company customer.
              - Menu: searchable list; selected value shown; scope is never global across tenants.
              - Missing permitted customer: **Unavailable customer**; retain the saved scope instead of broadening it.
            - **Remove**: removes this draft row only; save commits the change.
          - **Add a name**: append/focus one empty row.
          - Empty saved group: **Other names show here.**
        - Footer.
          - **Cancel**: discard this editor’s changes, retain all saved records.
          - **Save details**: validate and commit at the captured revision.
          - Saving: **Saving details…**; prevent duplicate submission.
          - Failure: **We couldn’t save these details. Your changes are still here.**
          - Conflict: show latest and draft field values; **Review latest** / **Keep editing**; no silent overwrite.
  - **Catalogue context and Related products** — PRD-N04–05
    - Snapshot: **Related products**, then **Internal category**, with the current exact product/code
      named once.
      - **Related products** is an inline searchable picker of deliberately linked existing exact
        catalogue records—coded SKUs or accepted uncoded sale items—not a category or sibling group.
        Selecting a result opens that record’s full sheet;
        adding/removing an item records a reviewed direct relation and never opens New product.
      - Imported rows without a direct relationship, category/group co-members, customer/order wording
        and similarity remain independent. A zero-related-product record has an honest empty state.
      - New products are created only through the separate New product flow; the relationship picker
        can link them only after their own explicit catalogue-record admission.
  - **Prices** — PRD-P01–06
    - This is a set of contained price objects, never another unbounded label/value list.
    - One tariff: heading **Price**, one full card and History. The company tariff name stays quiet
      inside the card because there is no competing tariff.
    - Multiple tariffs: date context **Today · {date}**, then a responsive two-column card grid at
      desktop and one column on phone. Cards retain equal gutters but grow naturally for long names,
      large prices, empty states and status text; no value overlaps its action.
    - **Manage tariffs** is a direct section action for every enabled pricing profile. It opens the
      shared company tariff registry, not product identity edit or a product-local duplicate.
        - Tariff row: name, customer count, retirement state.
        - Name input: current name; required; rename retains stable ID/history.
        - Customer count: opens assigned customers with their actual customer doors.
        - **Add tariff**: create a new stable ID; never reuse a retired tariff’s history.
        - Retire action: preview affected customers and their replacement tariff; confirm or cancel.
        - Reorder: presentation order only; no price reassignment.
        - Return: restore this product’s pricing context.
    - Tariff card.
      - Name: the company’s own tariff name, unmodified as business data.
      - Known price: amount with currency and Unit.
      - Unknown price: **Set price**, never a numeric zero.
      - Effective/retired state and the latest revision context are factual secondary content.
      - The card has exactly two destinations: its primary price control opens **Today’s price** for
        this product and tariff; its explicit **History** control opens this tariff’s price history.
        Neither nested action makes the entire grid ambiguous.
        - Tariff buttons: named choices with selected state; changing one with an unsaved value opens the unsaved review.
        - Field: **Today’s price for {product}**.
          - Blank draft; saved price/context is a labelled reference, not an implicit write.
          - Decimal input; positive finite number; comma/dot input accepted; unit/currency visible.
          - Invalid: **Enter a price greater than zero.**
        - Context row.
          - **Last price** with time/actor when known.
          - **Price still to set** when none exists.
          - **Suggested starting price** only for a compatible related unit; no save until explicitly entered.
        - Actions.
          - **Save & next**: persist this tariff, then open the next.
          - **Save price** at the last tariff: commit once.
          - **Skip**: leave this tariff unchanged and move on.
          - **Done**: close if no unsaved value; otherwise open the review below.
        - Unsaved review.
          - **You have an unsaved price**.
          - **Save it or discard it before switching tariffs / closing.**
          - **Keep editing**: retain focus and draft.
          - **Discard changes**: abandon only this pending value, then perform the requested navigation.
          - **Save price**: validate/save, then perform that navigation; unavailable during unresolved conflict.
        - Save failure: keep value, tariff and position; **We couldn’t save this price. Try again.**
        - Concurrent change: show latest saved value with actor/time beside draft; **Use latest price** / **Save my price**; revision checked again at commit.
        - Completed multi-price run.
          - Heading: **Prices saved**.
          - Changed product/tariff rows with before→after prices.
          - **Done**: return; no second misleading Publish step.
          - **Undo changes**: compensating/reverting operation with its own permission/revision checks and visible failures.
      - **History**.
        - Opens **{tariff} — Price history** with product name.
        - Named tariff buttons change which independent history is read.
        - Chart: this tariff’s price revisions; axes label time and currency/unit.
        - Revision list: each saved point, including same-day changes, actor and timestamp.
        - Empty: **Price history starts with this tariff’s first saved price.**
        - **Set a new price**: open entry for this tariff; absent on archived/read-only product.
        - **Close**: return to the same sheet.
    - **Set by percentage**.
      - Opens a local multi-tariff draft.
        - Starting-tariff selector: **Use {tariff} as the starting price**; selected state explicit.
        - Starting-price field: positive amount in this product’s currency/unit.
        - Other tariff fields: signed percentage; generated price shown beside each.
        - Formula: `starting price × (1 + percentage / 100)`, rounded to currency precision.
        - Example: €10 and +10% produces €11; this is not gross profit margin.
        - Re-select starting tariff: preserve preview currency values and recalculate relative percentages.
        - **Save**: atomic relationship and all resulting prices.
        - **Cancel**: discard the complete draft.
        - Missing starting price / invalid result: explain the field; Save unavailable.
        - Failure/conflict: retain all draft inputs and reviewed scope; no partial silent update.
  - **Stock** — PRD-S01–06
    - Summary.
      - **Recorded balance**: receipts/count projection and unit, including an approximation marker when the source count was approximate.
      - Context: **Receipts and recorded counts · updated {time}**.
      - Last physical count: amount, unit and time; or **No stock count yet.**
      - No evidence: **Still to record**; a saved zero is **0 {unit}**.
      - Explanation: daily estimates do not change this balance; availability is a separate projection.
    - **Receive stock**.
      - Opens **Receive stock** for the named product.
        - **Quantity received · {unit}**: blank, required decimal >0.
        - **Split received stock**: select existing lot or type **Lot number** for a new lot; exact
          quantity slider and number field divide receipt. Missing physical label is explicit
          **Unassigned stock** where SKU policy permits; no synthesized code.
        - Help: **Add only the quantity that arrived.**
        - **Cancel**: writes nothing.
        - **Save receipt**: append one idempotent receipt and reviewed split; keep fields on error.
          [THE-STOCK-LOTS-SPEC.md](THE-STOCK-LOTS-SPEC.md) LOT-R01–LOT-R06 is authoritative.
    - **Record a stock count**.
      - Opens **Record a stock count** for the named product.
        - **Total physically counted · {unit}**: blank, required decimal ≥0.
        - **Match this count to lots**: every row uses **Counted after** slider plus exact numeric
          field, with derived increase/decrease from recorded. Oldest-receipt ordering may be a
          visible suggestion only; it never asserts physical traceability.
        - **Add a lot found in this count**: typed **Lot number**, source and quantity; origin is
          physical count, not supplier receipt. New lots may be added mid-split.
        - **Unassigned after count**: visible where policy permits. If named lots cannot honestly
          be identified, reconciliation explicitly moves remaining count to Unassigned stock with
          reason; it never invents a lot code.
        - **Cancel**: retains saved balance/lots and discards draft review.
        - **Save count**: atomic count/variance/after-count split. Named lots after count plus
          Unassigned after count equal counted total exactly. Stale stock needs renewed review;
          failure preserves all fields. [THE-STOCK-LOTS-SPEC.md](THE-STOCK-LOTS-SPEC.md)
          LOT-C01–LOT-C07 is authoritative.
    - **Lots · {N} recorded**.
      - Each row.
        - Real **Lot number**, known supplier/receipt or count date, expiry/status.
        - **Received**, **Adjustments**, **Deducted**, **Remaining · recorded**, all with unit.
        - **Reserved**, **Allocated**, **Released** remain separate from physical movement.
      - **Assign stock to lots**.
        - Opens fixed Recorded-balance split. It divides already recorded physical stock among
          existing named lots, typed new lots and Unassigned stock.
        - Each row has quantity slider and exact numeric field; identity is selected or typed,
          never chosen by slider.
        - **Save lot split** needs named lots plus Unassigned stock equal fixed Recorded balance.
          It writes zero-net attribution history and does not receive, count, reserve, allocate
          to an order, or deduct stock.
        - If stock is committed to an albarán, commitment is named and user changes it from that
          Albarán line before reducing its lot position.
        - [THE-STOCK-LOTS-SPEC.md](THE-STOCK-LOTS-SPEC.md) LOT-L01–LOT-L07 is authoritative.
      - None: **No lots recorded. Add a lot number when you receive, count, or assign recorded stock.**
      - Unassigned: **{quantity} {unit} recorded without a lot number.** Visible physical state,
        never fake lot or hidden discrepancy.
      - Production lot drawer.
        - Source receipts/attachments; trace evidence; expiry when supplied; commitments,
          dispatch/count corrections and affected order lines.
        - **Edit lot details**: permitted trace fields, evidence and reason; expected revision;
          Save/Cancel. Unknown expiry/source labelled; no category/group-wide replacement.
    - **Daily stock estimate**.
      - Disclosure summary: quantity/unit/daily time, or **Still to set**.
      - Help: **How much you usually expect to have at this time each day. This is your team’s estimate; recorded stock stands as it is.**
      - **Set daily estimate** / **Edit estimate**.
        - **Expected quantity · {unit}**: current value or blank; decimal ≥0.
        - **Daily time**: saved value or 06:00; valid local time; company timezone shown in production.
        - **Cancel**: discard draft rule.
        - **Save estimate**: version the planning rule; no physical movement or customer announcement.
      - **Stop estimate**: stop future planning; retain rule history; failed stop leaves it active visibly.
    - **Stock history**.
      - Receipt/count/adjustment rows with time, actor, quantity, unit, lot and source.
      - Daily estimates are not physical movement rows.
      - Load more: paginated runtime history, explicit fetching/failure/retry without changing stock.
  - **Orders** — PRD-O01–02
    - **Upcoming & in flight**.
      - Rows: customer, date/status and this product’s quantity/unit.
      - Customer door: opens actual customer sheet.
      - Order door: opens the actual albarán with context preserved.
      - No work: **No upcoming orders for this product.**
      - **Show all {N} orders** / **Show fewer**: complete matching set.
    - **History**.
      - Completed and archived orders, original snapshot values preserved.
      - No history: **No completed orders for this product yet.**
      - Same customer/order doors and expansion behavior; no inherited category/group or Related-products orders.
  - **Source evidence** — PRD-E01–04, only when inventory and supplier intake are enabled
    - Compact exact-SKU evidence card.
      - Permitted provider/source metadata, relation/effect, review status and date; no durable raw
        email body, attachment bytes or fabricated preview.
      - Opens the exact source from **Stock update** with a Back chevron and **Return to product**.
        - The source reader renders authorized provider content in memory and offers **Open Gmail**
          or **Open Outlook** when an exact/provider-home native door is available.
        - It is read-only in the E185 profile. A later reply control requires the independent
          connected-provider capability; forwarded mail remains read-only.
        - Back/Forward/reload retains opaque source reference and originating SKU context.
        - Missing source: **Source unavailable** with safe reason and return action, never another
          email/source substituted silently.
    - **Show all {N} sources** / **Show fewer sources**: expand this product’s actual evidence set.
    - Empty: **No related source evidence for this product.**
    - Source permission failure: do not expose another tenant’s metadata.
  - **Sales insights** — PRD-I01–05
    - One contained card; heading plus **Completed orders only**.
    - Metrics: **Orders**, **Customers**, **Sales**.
      - Actual completed exact-product lines; date window and before-tax basis visible.
      - Missing data is unavailable, not numeric zero; real zero remains zero.
    - Time chart.
      - Two or more recorded days: labelled completed-order series with accessible numerical values.
      - One day: **There’s one day of sales so far. Trends appear as more days are recorded.**
      - No completed sales: **No completed sales yet**; explain when data will appear.
    - **Sales by customer · Top 5** / **All customers**.
      - Buyer name opens customer sheet; bar/value uses actual completed line value.
    - **View customers** / **Hide customers**.
      - Complete buyer list with order count and sales value.
      - Customer-price control.
        - Current inherited tariff and optional own price.
        - **Customer price** amount, unit/currency, history.
        - **Save price**: this customer/product only.
        - **Use tariff price**: end override while retaining history.
        - Cancel/error/conflict preserve authoritative current value and unsaved draft separately.
  - **Product details & history** — PRD-D01–05
    - Collapsed by default; opens readable information rather than another mixed edit form.
    - **Saved product details**.
      - Current product name, company code, Unit and optional description.
      - **Edit details** opens the same identity form described above.
    - **Original name / Original code / Source**.
      - Immutable imported/manually supplied identity and evidence.
      - Technical product ID is secondary, readable/copyable for support; never editable.
    - **Reference classification**.
      - Known path or **Not yet classified**; explains categorisation ownership.
      - Catalogue-level **Discuss category** opens a scoped conversation.
        - **How should these products be grouped?** text input.
        - **Review change** obtains a typed proposal; manual fallback explicitly labelled in the kit.
        - Proposed category; named affected products and exact scope; identity/prices/history retained.
        - **Apply category change** commits the reviewed proposal; **Keep {category}** closes without mutation.
        - Stale/ambiguous/permission/failure states retain the conversation and proposal; no arbitrary broad recategorisation.
    - **Names customers use**.
      - Saved wording plus exact customer scope; **No other names saved** when empty.
    - **Detail changes · {N}**.
      - Each revision: actor/time, operation, actual changed field before→after including code/description/name scopes.
      - None: **No edits since this product was added.**
    - **Archive product**.
      - Opens **Archive {product}?**.
        - Consequence: **It will no longer be offered for new orders. Past orders, prices, stock records and artwork will stay. You can restore it later.**
        - Outstanding work listed in production; never silently cancelled.
        - **Keep product**: no write.
        - **Archive product**: permission/revision-checked archive, stable ID retained.
        - Failure: remain open; saved active/archived state does not change without confirmation.
    - Archived state.
      - Replace commercial edit actions with **Restore product**.
      - Restore retains all original/current details, prices, art associations and history.
      - Restoration does not invent missing prices, stock or provider connection.

## 3. State matrix

| State | What leads | What is available | What must never be invented |
|---|---|---|---|
| Established SKU | Literal identity and exact illustration state | Exact-SKU orders, quantity-only patterns, top customers and Details & changes; future commercial/inventory bands only under their gates | Category/group or Related-products totals represented as SKU totals |
| Imported, ready for review | Imported literal identity/code/unit and review state | Same exact-SKU sheet with explicit source/history | Merging another equal-name import row or inventing a price |
| Imported, sparse | Missing exact facts and honest review state | Same exact-SKU sheet with explicit empty states | Price, stock count, purchases or images that do not exist |
| Manual product | Literal name/SKU/unit, review and confirm | Same exact-SKU sheet; own artwork request state | A fake interpretation/provider receipt |
| New related SKU | Direct-origin context and its own reviewed literal identity | Own Product Sheet; empty independent history | Origin price/history silently copied into the new SKU |
| Existing related SKU | Same immediate controls as any SKU | Own exact-SKU history and Related products navigation | Inherited illustration as its assigned artwork |
| Candidate from customer wording | Original wording/evidence, Review & add | Review boundary, then adopt and open pricing | Writable commercial tariffs or stocked status before adoption |
| Edited SKU | Same identity and hierarchy, update provenance | Original name/code and before/after record remain in dossier | Renamed ID, lost artwork, historical order rewrites |
| Archived SKU | Explicit archived banner and Restore | Read-only tariffs/history, stock/lots/orders/insights/art/dossier | New price, receive/count, artwork assignment or new-order offerings |
| Failed save | Error beside the intact draft | Correct values, retry or cancel | Success feedback or a dismissed draft before persistence |
| Revision conflict | Latest record stays authoritative; draft remains | Explicit close/reopen instruction to review the newer version | Overwriting a later edit silently |

Unit changes are allowed only before established commercial history exists. Once prices, orders or stock movements exist, changing the Unit would reinterpret history; the editor explains that a different Unit requires a variation. Archive is reversible and preserves all earlier references. It removes the SKU from active catalogue browsing, bulk pricing and the direct add-line offer. Archived catalogue browsing and direct links still work.

## 4. Creation and review

New product and the existing-record relationship picker begin with different business decisions:

- **New product:** `identity (Product name, SKU, Unit) → review → confirm → stable exact SKU`.
- **Related products:** `select existing exact record inline → review direct relation → save or remove link`.
  This path never opens New product or creates an SKU.
- **Add a product list:** `Drop a file or Paste a product list → review queue or honest PDF-unavailable recovery → explicit item confirmation → stable exact SKU`.

The visible identity controls are **Product name**, **SKU** and **Unit**. Internal category is not part of creation or bulk readback; a source-derived internal suggestion/default may be reviewed later on the Product Sheet, where **Not organised** remains valid. Related products appears only after the inline picker writes an exact-record relation. SKU is required for a newly created sellable product in the kit; a blank value never slips through as a generated or hidden code. Existing imported records that genuinely have no code remain readable as such until a person assigns one. Canonical SKU storage trims leading/trailing whitespace and compares case-insensitively for duplicates, while preserving internal punctuation and leading zeroes. The draft survives Back from manual review and a failed write.

Nothing is created by opening the form, supplying a file/paste, or typing a description. The review exposes original wording and editable identity. Confirmation is the write boundary. Repeated save attempts reuse the same creation request identity. Persist direct-relation wording separately. Pricing does not wait for illustration work and, in the active unvalued profile, neither surface appears as a follow-up.

The kit preserves the entered wording for manual review and does not claim an automated interpretation. A future runtime proposal must be versioned, preserve the original wording, expose its evidence and uncertainties, and remain editable before confirmation. Ambiguous proposals do not silently mutate other SKUs.

Observed candidates similarly require review/adoption before price writes. Their source dossier explains that customer language alone does not establish a SKU, stock or price. After adoption the normal SKU details editor is available.

## 5. Prices and history

A tariff is `(tenant, SKU, tariff, currency, unit)` with dated, append-only revisions. Every tariff owns its chart, its empty state and its revision list. Multiple changes on the same day remain separate points. A native demo SKU may have an explicitly seeded history; a newly created SKU cannot claim that seed.

The price entry shows Last price only when a price actually exists. A related SKU’s current price can be shown as a labelled starting suggestion only if Units match; it is not saved until the user enters and saves a value. Different-unit category/group or Related-products prices are not useful suggestions. Price still to set is a first-class state. Existing undo and percentage/tariff controls continue using the shared price machinery.

Tariff IDs are stable, including after retirement. Allocating another tariff cannot reuse a retired identity or attach its old price history. Legacy registries recover their allocation floor from both active IDs and saved history; the persisted allocation counter also reserves retired, unpriced IDs. Removing an anchor retires the relationship, not the prices it already wrote.

An empty percentage anchor cannot write zero prices. The anchor stays editable in percentage mode; Save commits the complete relationship and its tariff prices together. A failed tariff, customer-price, percentage or registry save preserves the existing ledger and the draft, with an inline retry error. No advance, success toast or Undo retraction occurs before persistence.

Customer-specific price changes remain available in the completed-customer breakdown of an active SKU. Archived sheets expose historical information without those write actions.

## 6. Stock and order truth

[THE-STOCK-LOTS-SPEC.md](THE-STOCK-LOTS-SPEC.md) is authoritative for Product Stock lots.
Receive stock writes positive arrival split across typed/selected named lots and explicit
Unassigned stock where policy permits; blank identity is never generated substitute. Stock count
permits zero and records physical total plus variance, while prior receipts stay historical. Its
after-count split assigns every named lot and Unassigned stock exactly to counted total; any
oldest-receipt ordering is only reviewable suggestion. **Assign stock to lots** is separate
fixed-balance physical-attribution action: it may add typed lots and split recorded stock, but its
zero-net event changes neither Recorded balance nor an Albarán commitment. **Allocate stock** lives
on an Albarán line and holds fulfilment stock; it does not change physical balance. Record movements
through shared ledger, not sheet-only number. Browser-kit values demonstrate interaction only and
cannot be described as production inventory truth.

The sheet uses `recordedStock` from the existing incoming-event authority, excluding daily rule emissions. Daily stock estimates can be set, edited and stopped using the rule ledger; their quantity/time are planning assumptions. The older generic `fold` still serves legacy planning surfaces and must not be labelled a physical balance in runtime wiring. Canonical INV-01 supersedes rules-as-receipts doctrine. Archive does not erase old rules or movements; existing commitments remain reviewable.

Orders and insights join on exact SKU ID. Delivery/in-flight work and completed/archived history are separate views. Completed-sale graphics use actual projected order lines and prices before tax. A newly imported/manual/variant SKU has no copied buyer history. One day of observations yields metrics and actual customer-sales bars, not a fabricated time trend. Multiple receipts for the same supplier lot aggregate before depletion, so an allocation is subtracted once.

## 7. Artwork is an independent reviewed process

Each SKU has its own association. Exact library matches supply initial illustration; a category/group or Related-products image is not an automatic assignment to another SKU. Renaming preserves the association through retained original identity. Missing/requested/review/approved states are visible. Uploading a PNG/JPEG/WebP under the stated limit creates a review candidate; only Use for this SKU assigns it. Requesting a replacement keeps the last approved asset visible. Archived artwork can be inspected but not assigned.

Ideogram is the artwork road, and §16 states it end to end — reference, description taken verbatim, subject swapped in place, generation, the family check by eye, the file contract and the gate. Inside the browser kit a saved request stays a local request; the provider call belongs to the house (a workstation today, `POST /api/artwork` on the box the moment it holds `IDEOGRAM_API_KEY`). The provider adapter must supply durable job status, provider/model/receipt, prompt/style versions, tenant/SKU/revision, error/retry/cancel states, asset provenance and reviewer approval. No provider success is simulated. The complete provider, prompt, review and operational contract is THE-INTELLIGENCE-SPEC; catalogue contract §12 retains the inventory audit. E175.13 is not provider completion.

## 8. Navigation, persistence and failure

Details, price entry, price history, creation, artwork, archive confirmation and stock entry are browser history layers. Opening from an albarán adds an order-product layer containing a stable product ID. Back closes the current layer and restores the order context; Forward reopens it. Product changes reset product-specific editors and scroll position. Source-evidence navigation hides rather than destroys the catalogue/product panes, preserving their scroll context. Deep links include the source message and originating SKU. Back/Forward restores the correct screen; an absent message shows a recovery state, never another message presented as the requested one. All document hooks stay mounted when a product replaces the visible document content, preventing conditional-hook crashes.

Catalogue selection and creation update the stable SKU URL, so reload opens the same product. Returning to the catalogue or changing archive visibility clears the old product URL. Visible search context survives a product selection; an external target hidden by the query clears that query. A variation confirmed from an order note follows the same adoption, own-artwork and immediate-pricing path, without changing the source order or note.

Catalogue, tariff, standing-rule and identity stores persist before announcing success. Import retention is awaited before catalogue rows are created; a partial price failure names what did save and retries those same SKU IDs. Known customer-wording candidates are adopted under their existing ID. Creation retries never reset an artwork association or approved candidate. Failed standing-rule writes keep the prior rule and the edited values.

The kit identity store checks expected revision and persists before announcing success. Storage quota failure is an editable error. Original import bytes remain managed by the existing import/export store. These browser stores demonstrate interaction and recovery; they are not multi-tenant backend storage.

The English bundle groups shared UI dependencies to avoid an excessive parallel script graph during repeated sheet reloads. Spanish snapshot build output is not changed by this grouping. Browser tests must record runtime/request failures, not suppress them.

## 9. Runtime handoff and verification

Required ports/events: `SkuDetailsUpdated(expectedRevision,before,after,actor)`, `SkuArchived`, `SkuRestored`, `VariationProposed`, `VariationConfirmed`, `TariffPriceWritten`, `StockReceived`, `StockCounted`, `StockVarianceRecorded`, `ArtworkRequested`, `ArtworkCandidateReady`, `ArtworkApproved/Rejected`, plus existing order/history projections. Every write carries tenant/SKU, stable request ID and expected revision where relevant. Server authorization and idempotency are mandatory. Failed writes cannot emit successful UI acknowledgements.

The backend must retain source values, resolve customer-scoped aliases, enforce unit/archive policy at the command boundary, return exact-SKU projections, and preserve immutable historical order units/names/prices. The design kit does not claim these runtime connections are already live.

`drive-176-sheet.py` exercises the full lifecycle at 1600×1100 and 390×844. `drive-176-edges.py` covers imports, candidate adoption, failed persistence, review-gated artwork and order-origin navigation. `drive-177-save-states.py` adds quota-denied price/customer-price/margin/rule/adoption/import retries, stable new-product URLs and tariff-ID migration. `drive-158-notes.py` exercises the same automatic-pricing boundary from the order. Run the existing import/export, customer and concern drives to guard shared components. Release notes record actual pass counts, reviewed screenshots, source commit and served English hash. E175 is updated item by item; unrelated broad work is not silently marked complete.

## 10. The archetype: every control has one job

This is the control-level contract for PRD-01 in THE-SYSTEM-SPEC. It complements the system’s
shared OBJ-01 form/menu/error rules. A target contract is not an assertion that every production
permission, asynchronous state or service already exists in the browser kit. The linked task graph
records that distinction. Keep stable control IDs when improving copy so evidence remains traceable.

The sheet answers, in order: **What product is this? What does it cost? What stock has been
recorded? What work and source messages concern it? What do its sales show? What details and
changes are on file?** A section cannot become a second settings page. Use one scrollport, one
primary action per open form, and no generic overflow menu for frequent work.

| Control ID | Visible copy / information | Exact job and availability |
|---|---|---|
| PRD-N01 | Back to catalogue / Back to the albarán | Return to the actual origin and its selection, query, scroll and draft. On narrow layouts this returns to the list rather than selecting the first product again. Browser Forward restores the sheet. |
| PRD-N02 | Product name; literal code; Unit | SKU-first identity in that order. Missing code is omitted rather than generated. Never use reference, Internal category or Related products as the sellable record. Long names wrap. |
| PRD-N03 | Image pencil: Upload artwork / Replace artwork | One exact-SKU artwork association, surfaced only as an image-owned accessible ≥44 px pencil action into PRD-A01. There is no visible Illustration field/editor. The current approved image survives pending replacement. |
| PRD-N04 | Related products · Internal category | Inline picker of explicitly linked existing exact catalogue records (coded SKU or accepted uncoded sale item), followed by quiet internal category context. Category/group co-members never enter the picker; each row opens its own sheet. |
| PRD-N05 | Add/remove related product | Reviews one direct relation between existing exact records. It never opens PRD-C01, creates an SKU or opens a creation modal. Hidden for archived products or permission-denied users, with the permission reason available in the sheet. |
| PRD-N06 | Edit details | Opens only the identity form PRD-D01. It does not edit tariffs, receive stock, change a lot, reclassify a whole category or approve artwork. |
| PRD-P01 | Price / Tariffs | A one-tariff tenant says **Price** and shows one value/history; only a multi-tariff tenant says **Tariffs**. A missing value is never 0. |
| PRD-P02 | Tariff price / Set price | Opens price entry for the named tariff and stable SKU. Do not switch to a category/group or Related SKU. Only active writable SKUs offer the action. |
| PRD-P03 | History | Opens that tariff’s own chart and revision list. Remains readable when archived. The accessible name includes tariff and product. |
| PRD-P04 | Set by percentage | Opens a draft relationship with one explicit anchor tariff, anchor price and percentages for the others. Derived values are previews until Save. |
| PRD-P06 | Independent tariff prices | No persistent link toggle on the active sheet. Each tariff save changes that tariff only. Use the reviewed percentage workflow for an explicit multi-tariff change. The old kit specimen chain is not the production sheet contract. |
| PRD-P05 | Tariffs | Opens the company tariff registry, retaining product context. Registry IDs survive rename, reorder and retirement. |
| PRD-S01 | Stock / Recorded balance | Receipt/count balance with unit, last update and last physical count. Not live warehouse availability. Excludes scheduled estimates. Not recorded means no evidence, while a recorded zero displays 0. |
| PRD-S02 | Receive stock | Record an actual receipt, with quantity and optional supplier lot. It adds quantity; it does not replace the balance. |
| PRD-S03 | Record a stock count | Record the total physically counted. Preview balance before/after and variance, and review lot deductions before saving. |
| PRD-S04 | Lots · N recorded / Lots · none recorded | Expands actual lot codes, supplier/date, received, deducted and remaining quantities. Missing supplier/expiry is unknown, not inferred from a category/group or Related SKU. No synthetic supplier code. |
| PRD-S05 | Daily stock estimate | Separate planning disclosure. Quantity/time describes the team’s usual expectation, not promised inbound or a physical movement. |
| PRD-S06 | Stock history | Chronological receipt/count/adjustment evidence; timestamp, amount, unit, lot and source where available. Daily estimates are excluded from physical movement history. |
| PRD-O01 | Orders / Upcoming & in flight / History | Exact-SKU orders split by operational state. Each row opens the real albarán; completed/archive history remains. Empty sections explain absence rather than disappearing. |
| PRD-O02 | Show all N orders / Show fewer | Expands the complete matching set. Runtime pagination retains count and loading/failure/retry state; it cannot quietly truncate. |
| PRD-E01 | Source evidence | Exact-SKU source cards with permitted metadata and native source door. No category/group, Related-products or supplier-name-only matching. In the active profile, a supplier/source feed remains absent until its gate is enabled. |
| PRD-E02 | Source card | Opens the exact provider/source context, retaining the originating SKU. Unavailable evidence names the missing/access state and offers return. |
| PRD-E03 | Show all N sources / Show fewer sources | Expands exact-SKU source evidence only. Does not change the catalogue filter. |
| PRD-E04 | Open source feed | Opens the separately gated Stock update source feed with a return-to-product link. Connection settings remain a separate permissioned action. |
| PRD-I01 | Sales insights | Quiet contained card. Shows completed-order evidence, SKU scope, date window and before-tax basis; no predictions masquerading as measurements. |
| PRD-I02 | Orders / Customers / Sales | Count of completed matching orders, distinct buyers, and sum of exact-SKU completed line values. Zero, absent and unavailable remain distinct. |
| PRD-I03 | Sales by customer | Up to five buyers ranked by actual line value, labelled bars, numeric values and customer links. No decorative values or shared category/group or Related-products history. |
| PRD-I04 | View customers / Hide customers | Expands all observed buyers with order count, sales value and permitted customer-price action. No empty Explore destination. |
| PRD-I05 | Customer price | Opens an override for this customer and this SKU, showing inherited tariff versus explicit override. Removing an override restores inheritance without deleting its history. |
| PRD-D01 | Product details & history | Readable current and original identity, description, names customers use, classification/source, field changes and archive. It is not another editor. |
| PRD-D02 | Reference classification | Explains how the reference categorises this SKU. Category feedback is a separate scoped proposal, never an editable taxonomy text field disguised as product details. |
| PRD-D03 | Detail changes · N | Expands actor/time and changed fields before→after, including code, unit, description, customer scope and archive. “Details updated” alone is insufficient. |
| PRD-D04 | Archive product | Opens consequence review. Removes the active offering, retains references/history and warns about outstanding work. Not Delete. |
| PRD-D05 | Restore product | Restores the same ID and retained records. Does not invent prices, stock or provider availability. |

### 10.1 Product details form — PRD-D01

Menu order is fixed: heading and scope → name → code/unit → description → names customers use →
inline errors → Cancel / Save details. The form opens with current saved values and captures the
expected record revision. Pending save locks duplicate submission, not draft text selection.

| Field/control | Label, default and input | Validation and consequence |
|---|---|---|
| name | Product name; current name; required text | Trim outer whitespace; retain meaningful accents/case. Required, 1–200 characters in production. No silent reference-name replacement. |
| code | SKU on creation; current code in details | Required for a new sellable SKU. Canonical storage trims only leading/trailing whitespace and compares case-insensitively for duplicates. Internal punctuation and leading zeroes are retained. A duplicate blocks confirmation and names the matching record. Existing imported empty codes remain explicit rather than fabricated. |
| unit | Unit; current Unit | Required explicit unit. Lock after price, order or movement history exists; explain Add variation for another unit. A custom unit needs an explicit equivalence before conversions, not a guessed weight. |
| description | Description · optional; current text; multiline | Preserve meaningful newlines, maximum 2,000 characters in production. Not an order-line note and not an image prompt override. |
| customer name | Names customers use; current names | Each row has a name plus customer scope. Blank new rows do not create empty aliases. Preserve original order wording in evidence separately. |
| name scope | All customers / selected customer; current scope | All customers means this company only, never every tenant. A missing/archived scope is explicitly labelled and not broadened. Search the tenant’s permitted customer set. |
| Add a name | Append one empty name row | Focus the new input. No write until Save details. |
| Remove | Remove this draft name row | Save commits removal from future matching; historical orders are untouched. Accessible name identifies the row. |
| Cancel | Discard this editor’s unsaved changes | Return to the same sheet. Browser Back preserves the draft for Forward while the layer exists; navigating away with a dirty draft uses the shared discard/keep contract. |
| Save details | Commit validated fields at expected revision | Stay open on validation/storage/network/conflict failure. Never close or display success before the authoritative save. |

Copy for a locked unit: “This unit is already used by prices or stock. Add a variation to sell in
another unit.” Conflict: “Someone changed this product while you were editing. Your changes haven’t
been saved. Review the latest details before trying again.” Runtime offers Review latest and Keep
editing, with a field diff; the kit currently retains the draft and instructs close/reopen.

The kit implements trim/required checks and revision-aware persistence. Production length,
duplicate-code and dirty-navigation contracts are explicit build obligations, not claims of current
server enforcement.

### 10.2 Creation/review — PRD-C01

| Step/control | Exact copy / field | Behaviour |
|---|---|---|
| Open | New product | Opens the standard shared task frame. It offers **Add one product** and **Add a product list**; neither creates a record on open. |
| New product identity | Product name; SKU; Unit | All three are required before confirmation. Canonical SKU storage trims outer whitespace, compares case-insensitively, and preserves internal punctuation and leading zeroes. Existing sparse records remain code-less when their source is code-less; no code is generated. |
| Product list | Drop a file / Paste a product list | Excel/CSV enters one collective processed readback; PDF uses the explicit unavailable recovery. Rows edit only Product name, SKU and Unit plus Include/Skip. Internal classification may be retained as a quiet default for later Product-Sheet review; it has no pre-result mapping, Illustration editor or relation candidates. |
| Review | Review product / Create product | One-product review is identity-only: Product name, SKU and Unit. Bulk review is the collective readback with row Include/Skip. Internal category is reviewed later on the Product Sheet; neither review claims a parser/model/provider or creates price, stock, relation or artwork approval. |
| Related products | Select existing product | This is a separate inline picker on the Product Sheet. It may save or remove a reviewed direct relation only after both exact catalogue records already exist. It never opens creation or manufactures a SKU. |
| Duplicate / failure | Open existing / Create separate product; We couldn’t add this product. Your details are still here. | A duplicate requires an explicit choice. Failed creation retains review draft and request identity; retry resolves the same request without duplicate SKU creation. |

Candidate review uses the same interpretation/adoption boundary. A candidate has no sellable tariff,
recorded stock or approved artwork merely because it appeared in a conversation. After confirmation,
it becomes a normal SKU using the same sheet—not a special lightweight variant page.

### 10.3 Price entry, percentages and tariff history — PRD-P02–05

| Menu/control | Exact job, fields and copy |
|---|---|
| Price editor heading | Name this SKU and selected tariff. A related SKU’s name remains visible at every step. |
| Tariff selector | Named tariff buttons; actual selected state. Switching tariffs preserves each unsaved value or explicitly asks before dropping it. Never duplicate the visible tariff count as “1 of 3.” |
| Price field | Today’s price; decimal input; currency and Unit on the same line. Current value is context, not an implicitly saved value. Required positive finite price for commercial save; an authorised zero-price policy must be explicit. |
| Price context | Last price with author/time; or Price still to set. A compatible related-SKU price may say Suggested starting price, and remains unsaved until entered and confirmed. |
| Save & next | Persist current tariff then move to the next. At the last tariff say Save price. Failure stays on the current field. Keyboard Enter follows the same boundary unless a conflict needs review. |
| Skip / Done | Skip leaves this tariff unchanged. Done closes when there is no unsaved input; a pending value must be saved or explicitly discarded under the shared form contract. It is not a hidden bulk commit. |
| Conflict | Show latest saved and user draft, who/when. Use latest / Save my price are explicit; no automatic last-write-wins. Runtime rechecks revision on the chosen commit. |
| Margin mode | Anchor tariff selector, positive anchor price, each other tariff’s signed percentage, derived currency preview. The formula is `anchor price × (1 + percentage / 100)`, rounded to currency precision. This is an increase/decrease from another selling price, not gross profit margin. Say Set by percentage. Example: €10 with +10% gives €11. |
| Margin Save / Cancel | Save the reviewed relationship and complete derived prices atomically; Cancel discards the relationship draft. Missing anchor cannot manufacture zero prices. |
| History header/tariff switch | Price history for the product and selected tariff; switch to another tariff’s own series/list. Never combine histories by category/group or Related products. |
| History chart/list | Each saved revision is retained, including multiple on one day. Units/currency and timestamps visible; the list is the accessible numerical alternative. No data says No price history for this tariff yet. |
| Set a new price | Opens entry for the tariff being reviewed. Archived records omit this write action; Close remains. |
| Tariff registry | Stable named tariffs; rename, add, reorder, review customers, retire with explicit reassignment where needed. Registry lifecycle is company-wide and must disclose affected customers/products before commit. |
| Customer override | Show the inherited tariff, explicit customer price if any, unit/currency and change history. Save price applies only to this customer/SKU; Use tariff price ends the override, not the tariff. |

Runtime field-level validation and complete dirty-editor behaviour remain COM-01/OBJ-01 tasks.
The kit’s actual save recovery and independent histories are evidenced by the 176/177 drives.

### 10.4 Stock and lots — PRD-S01–06

**[THE-STOCK-LOTS-SPEC.md](THE-STOCK-LOTS-SPEC.md) is detailed authority for LOT-01.** This
registry gives Product Sheet entry points; its detailed fields, sliders, source links, review,
permissions, conflicts and state matrices are linked LOT controls.

| Surface/control | Fields, default and action |
|---|---|
| Receive stock | **Quantity received** in SKU unit, blank required decimal >0; location/time/source; then **Split received stock**. Existing/new **Lot number** rows and Unassigned stock sum exactly to receipt. **Save receipt** adds physical quantity; Cancel writes nothing. See LOT-R01–LOT-R06. |
| Record a stock count | **Physically counted** in SKU unit, blank required decimal ≥0; prior balance or **No previous stock count**. Zero valid. Then **Match this count to lots** with after-count sliders and exact fields. See LOT-C01–LOT-C07. |
| Count review | Before → after, signed variance, every lot before → **Counted after**, Unassigned after, source/reason and active commitments. Suggested oldest-receipt order editable only. Named lots after count + Unassigned after count = counted total. |
| Add a lot found in this count | Typed **Lot number**, duplicate decision, source and amount. Count-found evidence, never supplier receipt. New lot can be added during split. |
| Assign stock to lots | Product → Stock → Lots action. Fixed Recorded balance divided across existing lots, typed new lots and Unassigned stock with slider + exact numeric fields. It has no order picker. See LOT-L01–LOT-L07. |
| Save lot split | Requires exact fixed total. Writes zero-net lot-position attribution with source/reason; **Recorded balance stays [amount] [unit]**. It does not receive, count, reserve, allocate or deduct. |
| Albarán allocation | **Allocate stock** is separate line-fulfilment workflow. It reserves/allocates existing eligible positions to one exact Albarán line; it never changes Recorded balance. See LOT-A01–LOT-A08. |
| Receipt/count/split error | **We couldn’t save this stock change. Your values are still here.** Retain draft, row identities, source choices and idempotency identity. No success acknowledgement before acceptance. |
| Lot list | Real Lot number, source/date, received/adjustments/deducted/remaining and reserved/allocated/released separately. Empty: **No lots recorded.** Unassigned stock always visible. See LOT-V01–LOT-V05. |
| Lot detail | Source receipts, trace provenance, expiry, movements, commitments, linked order lines and recall. **Edit lot details** needs role/revision/reason; issued snapshot never rewrites. See LOT-D01–LOT-D06. |
| Daily stock estimate | Estimated quantity in SKU unit and daily time, current values or blank/06:00. Tenant timezone shown. Copy: **How much you usually expect to have at this time each day.** |
| Set / Edit / Stop estimate | Version planning rule. Stop ends future planning, retains history, never receives stock, promises delivery or announces availability. |
| Stock history | Receipt, physical count, variance, physical depletion and zero-net lot split; actor/time, amount/unit, lot and source. Planning/forecast stays outside physical history. |


**Meaning of “expected”:** never a standalone unexplained number. Supplier-confirmed inbound is
labelled Expected delivery with supplier, quantity, due time and source. A user-set recurring amount
is Daily stock estimate. A model forecast is Predicted demand with horizon and evidence. Recorded
stock, reservation, allocation, dispatched quantity and available-to-promise remain separate typed
projections. The product sheet must not subtract or add one into another without the stated domain
rule. Legacy rule-based availability consumers remain migration tasks in the full system plan.

### 10.5 Artwork — PRD-A01

The Product Sheet surface is the image and its accessible **Upload artwork**/**Replace artwork** pencil;
it does not expose a visible Illustration field/editor. That action identifies this exact SKU and opens
the reviewed artwork flow. Runtime artwork description/prompt data, when available, belongs inside
the reviewed request flow rather than the Product Sheet. Request artwork records one owned job intent;
it does not imply provider submission. Upload artwork accepts only validated image files and creates a
candidate. Review shows candidate versus current approved image; Use for this product assigns only the
reviewed candidate. Reject, Retry, Cancel generation and Regenerate are distinct runtime actions with
the lifecycle defined in THE-INTELLIGENCE-SPEC. They must not be drawn as working controls before
their adapters exist. Close returns without assigning.

Kit-specific limits are PNG/JPEG/WebP under 1.5 MB and local reviewed upload/request persistence.
The production provider’s file limits, storage validation and image job schema live in the intelligence
contract. They are not interchangeable. No category/group or Related-products image becomes another SKU’s approved asset.

### 10.6 Readable sections and archive

Orders, related emails, insights and details are readable by default. A disclosure uses a sentence-case
label and exposes `aria-expanded`; the expanded content does not add a second scrollport. Source links
preserve the origin; external provider actions are labelled and opened safely. Empty evidence states do
not offer dead View more controls. Loading, unavailable and empty are separate server states.

Archive confirmation: **Archive this product?** “It will no longer be offered for new orders. Past
orders, prices, stock records and artwork will stay.” Buttons: Keep product / Archive product.
Outstanding orders are listed in runtime; archive never silently cancels them. Restore uses the same
stable ID, records actor/time and does not repopulate missing data. Permission failure retains the
sheet and explains who can perform the action without leaking other tenants’ identity.

## 11. Copy, accessibility and production completion

Use the exact copy tables in THE-SYSTEM-SPEC as the shared content authority and this section as
product-specific detail. No standalone Dossier, Explore, Manage, Expected, Unknown error or action
label whose effect depends on reading a tooltip. Headings name the information; buttons name the
result. Put essential labels outside placeholders. Preserve business names, SKU codes, supplier
subjects, customer wording and locale-sensitive decimals as data.

Every interactive control needs a visible or accessible name, keyboard operation, visible focus and
proper disabled/pending semantics. Informational tooltips supplement, never replace, field help. Charts
have textual values. At 320 px the sheet uses one column; modal actions remain reachable with the
keyboard open. Critical saves announce success/error in a live region without moving focus to a toast.

Before production completion, validate every control against permission denied, empty/partial data,
loading, stale revision, retry, offline, duplicate request, archived source and provider-unavailable
states. A successful screenshot does not close those tasks. THE-WIRING-TASKLIST and its machine-readable
graph own dependencies and status; release notes contain actual executed kit evidence.

## 12. Catalogue reading order and artwork audit

This current correction supersedes earlier category-first sheet drawings. A Product Sheet is a catalogue record with work
attached, not a dashboard assembled from every available fact. Its fixed reading order is **exact
SKU/name → literal code → editable Unit → capability-gated Price/lot/stock → Related products →
Internal category → Requested personalisations → exact Order history → grid-backed Stats → one details
disclosure**. The same sequence applies to active, sparse, related and archived records.

- The identity block carries exact name, literal code when present, editable Unit and the
  image-owned artwork pencil. It does not repeat price, stock or source summaries, and it never
  presents an Illustration field/editor.
- **Related products** is an inline existing-record picker. It never creates a record, opens a modal
  or makes category/group co-members related. **Internal category** is a subsequent independent,
  reviewable fact with no commercial or artwork inheritance.
- Price, lots and stock appear directly below unit only under their capability gates. One tariff says
  **Price**; **Tariffs** appears only when more than one exists. Unit-specific surfaces need a real
  governing fact and never infer an equivalence, weight, rate or stock count.
- Requested personalisations and Order history contain exact-SKU rows only. Each door opens the cited
  Albarán and preserves the return token, so Back restores the same Product Sheet, query/filter,
  selected record and scroll anchor.
- **Stats** is a bounded bottom section on a subtle square grid. Every card/chart opens evidence for
  the exact SKU, with an accessible values table; sparse data remains visibly sparse.

All existing write/recovery states stay in their owning controls: price history, stock receipt/count/
lot split, saved notices, stale stock revision, retained stock draft, detail save failure, archive/
restore and artwork review. A quieter page must not make a failed write or an independent SKU look
inherited. The image’s durable reviewed-artwork object and provider/runtime contract remain in §7;
This correction changes the UI surface only and explicitly defers that runtime work.

## 13. E188 Product list and identity geometry

FEED-IA §188 and INTX-12 supersede earlier smaller/flat product-list drawings. This is an exact-record-reading rule, not an invitation to merge ontology for visual convenience.

- **Products list row:** transparent list track; one inset rounded 44 px minimum hit area with a visible gutter to the next record. It contains a 56 px record face (owned exact art for a coded SKU; neutral, non-owned face for an uncoded sale item), a flexible column with literal product name first and one concise identity line second (coded: \`SKU · Unit\`; uncoded: \`Uncoded sale item · literal unit\`), then one right-aligned Unit terminal. The primary press opens only that record's sheet. Hover/focus/current uses the same inner shape; it never paints full list width or makes sibling controls accidental doors.
- **Wrap and density:** product name/source SKU may wrap and make the row taller. Art and terminal unit remain aligned; no arbitrary heading repeats above compact rows, no identity is ellipsised into ambiguity and no horizontal scrolling occurs at named phone widths. Secondary fact appears only where it identifies the exact item.
- **Exact art truth:** list faces are 56 px; coded-SKU Sheet identity art is 112 px desktop/88 px phone. On phone, artwork precedes a full-width identity copy block so long names never collapse beside it. Each coded SKU keeps its own reviewed association/state. An accepted uncoded item has no artwork association; reference, category, related or sibling art is never silently promoted.
- **Relationship visibility:** Internal category, direct Related products and Requested personalisations remain separate sheet facts. They may guide concise identity wording but cannot turn group co-members into related rows or make a variation inherit the current SKU's source, price, stock, unit or history.
- **Mobile:** same grid remains: art → flexible identity → terminal unit. Touch focus and selected return use inset shape. Long names grow vertically rather than collapsing terminal facts.

E188 acceptance requires coded, sparse coded, accepted uncoded, variation/related and missing-art fixtures at 1366×768, 1536×864, 390×844 and 393×873. Capture must show literal identity, coded-SKU art truth and neutral uncoded faces, natural wrapping, fixed terminal unit and same hover/current geometry without enabling commercial or inventory controls.

## 14. E191 pricing hierarchy and Product Sheet controls

Pricing is a commercial record attached to exact identities. The Product Sheet reads one ordered
hierarchy: tenant tariff registry → exact SKU price revisions per tariff → customer tariff assignment
→ optional exact-SKU customer price → optional time-bounded account discount. A line-specific manual
price and an issued Albarán snapshot remain later, separate facts. Category, family, Related products,
artwork, stock and Unit conversion never copy or infer a price.

### PRD-P01 · Desktop tariff cards

- With multiple tariffs, **Tariffs** is a two-column grid of contained cards at desktop widths. Each
  card names one tariff, shows its current exact-SKU price and price Unit, and opens that tariff's
  own History. Odd counts leave an ordinary empty grid cell; cards do not stretch into a different
  grammar.
- The figure is the editor. Select it, type over the selected value, and press Enter to validate,
  append the revision and focus the next tariff card. Blur commits a valid draft; Escape cancels.
  Invalid, zero, negative, excessive-precision or failed saves retain the draft and focus and never
  advance. Opening a desktop price never opens a modal.
- **Same price for all tariffs** and percentage relationships remain explicit product-level pricing
  operations. They show affected tariffs and use their existing review/save/cancel rules; ordinary
  inline editing never silently enters either mode.
- With one tariff the section is titled **Price**, shows one card and removes tariff-selection and
  assignment vocabulary. **Manage tariffs** remains the deliberate registry door.

### PRD-P02 · Phone high-speed price matrix

- Phone price entry is one bounded sheet. The exact product image/name stay fixed above an
  all-visible vertical tariff list. Every tariff row shows name and current price; exactly one row
  has the shared active outline. There is no dropdown, horizontal chip strip, position counter or
  giant ERP table.
- The active price field uses `inputmode=decimal`, owns focus on entry and after every step, and is
  kept above the visual keyboard. One compact, tappable supporting stat cycles among last price,
  number of revisions and last update time; it does not become three dashboard cards.
- A 56 px Previous chevron, quiet Done action and 56 px Next chevron sit immediately above the
  keyboard/safe area. Next saves or skips in reading order: remaining tariffs for this product,
  then the first tariff for the next product. Previous reverses that order. Horizontal product
  swipe is an additional route between products and never discards a typed draft.
- A one-tariff tenant removes the tariff list and advances product-to-product. Linked same-price
  tariffs save as one product cell. A pasted price list remains a product confirmation queue because
  its values already arrived with exact targets.

### PRD-P03 · Capability posture

**Pricing** is a persisted workspace capability, distinct from AI autonomy grants and print-value
policy. Turning it off immediately removes Product price sections, Stock price launchers, Customer
commercial controls and Albarán price columns/totals/tariff actions. It retains every tariff,
assignment, revision, discount and issued snapshot. Turning it on restores the same records. The kit
opens Pricing for review; production setup records the tenant's explicit choice.

## 15. E191 catalogue-source truth boundary

The normal Products view preserves the tenant catalogue's stored source sequence. Internal category is
available only through the explicit **Category** display sort and on the Product Sheet; it is never a
default list heading, row subtitle, relationship or source-order rewrite. **A–Z** is a separate
explicit display sort. Closing the Filters sheet without Apply changes neither sequence nor scope.

Kit fixtures must not impersonate a tenant catalogue whose source rows are unavailable. The tracked
Sitjar production study proves a 308-row catalogue existed and proves two exact source identities:
`PMR2 PIMIENTO ROJO 1ª` and `CEG CEBOLLA SACO 25KG`. It does not publish the source file or its full
row order. Therefore the fruit/veg Kit fixture may use those exact identities and clearly internal
design rows, but it may not reconstruct the other 306 SKUs from transcript phrases, invent their SKU
codes, or claim to mirror Sitjar. When the tenant-scoped source becomes available through an
authorised import, it replaces the fixture as a whole and retains every supplied row, literal code,
Unit and source position.

The default row remains one inset rounded hit surface inside a transparent track: 56 px exact-product
art, wrapping product name, literal SKU fact or honest missing-code state, and terminal Unit. Hover,
focus and selected state paint that same inset shape. At 390 px it has no horizontal overflow and
does not reveal category. The Product Sheet order remains name/art → Code → Unit/conversions →
capability-gated Price → capability-gated Available lots/stock → Related products → Internal
category → Requested personalisations → Order history → Stats.

## 16. Artwork — the road, the file, the gate

FEED-IA §200.2 (Peter, 2026-09-04): «Why doesn't one of the shrimps actually have an image for that?
You should have the whole ideogram API, by the way, hooked up… it should be in the specification we
can make you ship from there.»

**Every catalogue product and every reviewed sellable variant carries a painting.** A row that
resolves to one draws it in the list, on the sheet and on the albarán line; the drawn family mark
stands for customer wording that is still waiting to be adopted (§7 keeps that distinction). The
house makes the missing ones, and this section is how.

**The road has been walked end to end.** The prawn Peter saw — «Gamba roja de Palamós · congelada» —
wears `gamba-roja-congelado` and «Patata monalisa» wears a round golden tuber, both painted by the
library's own prompt over a clause in the library's own grammar. The gate reads 0 of 32.

### 16.1 · The road, in the order it is walked

Each step is checkable by a person.

**ONE PROMPT PAINTS THE WHOLE LIBRARY** (FEED-IA §202.1, Peter, 2026-09-05: «the images etc gotta be
all with that same ghibli/monet prompt that the main library generated as»). The style is held by
`STYLE_LOCK` in `build_subjects.py` — one string, the same for all 791 nodes — and the only thing that
ever changes is the subject clause it wraps. A per-image description is not this library's prompt,
however well the picture it makes turns out: it hands the style to whatever the provider said about
one tile that day, and the receipt it leaves is a text this repository does not hold.

1. **The clause.** Write what the thing LOOKS like, in the library's own clause grammar — «a single
   raw red prawn, a deep scarlet shell with long fine antennae and a curled tail». A form or a state
   is a clause of its own on its kind (`cocido`, `pelado`, `congelado`); a variety is an L2 sort, and
   it earns a clause only where the look differs. **The clause names the look and never the trade
   word for it**: «a single monalisa potato» painted the MONA LISA in a potato's colours, so the
   monalisa's clause says «a single smooth round potato, a tuber with a light golden skin and very
   shallow eyes» and the cultivar stays in the name, where it belongs. §202.8 puts this sentence in
   a model's hands at runtime — Opus writes the clause in this same grammar from the house's own
   product — which is why the grammar is written down rather than improvised per tile.
2. **The locked prompt wraps it.** The string that goes out is `STYLE_LOCK.format(subject=<clause>)`
   and nothing else. It is reproducible from this repository, which is what makes the receipt in the
   manifest a receipt.
3. **The clause enters the grammar.** The new subject is added to `build_subjects.py` — a prep on its
   kind, or a sort under it — so `python3 build_subjects.py` emits that same clause and that same
   prompt, and the tile can be repainted years later without anybody guessing what made it. A clause
   that lives only in the manifest is a one-off; a clause in the grammar is the library.
4. **Generate.** The family's own square, several candidates, one aspect ratio per call.
5. **The family check, by eye.** Open the candidates beside the tiles this one will stand next to —
   its kind's other forms, its sort's siblings — and pick the one that sits in the family. **This
   step is a person looking**, and a painting joins the library only after somebody has looked at
   it there, at tile size and at chip size, in the list and on the sheet.
6. **The ground.** This library's ground is a **plain pure white square** — `assets/paintings/set/`
   holds RGB WebP with a soft ground-contact shadow, and `normalize.py` snaps that ground to 255.
   A cut-out subject on transparency belongs to a library that ships alpha; the day one does,
   `remove_background` is the step that makes it, and the check is the tile's own mode.
7. **Placement.** `assets/paintings/raw/<slug>.webp` holds what the provider painted;
   `normalize.py <slug>` trims it to its own ink, scales the longest side to three quarters of a
   1024 canvas, centres it on white and writes `assets/paintings/set/<slug>.webp`; the same bytes
   are copied to `app/public/paintings/<slug>.webp`, which is what the app serves. The manifest
   (`assets/paintings/manifest.json`) records the subject clause, the prompt, the request and
   response ids and `status: done`, so a later `build_map.py` keeps the row. **The receipt is what
   was actually sent**: `prompt` holds the exact string, `prompt_method: style-lock` names how it was
   built, and a tile that replaces an earlier attempt keeps that attempt's ids under `superseded`. A
   plausible prompt written into a field that says what went out is a fabricated receipt — and so is
   a `prompt: null`, which is what the describe road could only leave behind.

   **INK THAT STANDS ALONE IS PAPER.** A render can come back on a grainy ground carrying flecks
   the size of a full stop; each one passes the neighbour test, four of them in a row pass the run
   test, and the trim then measures the FRAME instead of the painting — the superseded monalisa
   render's box read 982 × 989 and the tuber would have shipped at four fifths of the weight its
   siblings carry. Connected ink under `MIN_BLOB` is ignored when the box is measured. The floor is
   far below anything a subject is made of: the frozen prawn's thirteen ice flakes are islands of 33
   to 352 px and every one is kept. **What the rule drops at the edge it also crops**, because the
   crop is the measured box: two specks of 31 px and 20 px lie past that prawn's ice, its box goes
   812 × 386 → 791 × 386, and the 20 px one falls outside the crop. Four pixels of ice at the placed
   size, written down because the next tile it happens to may be a subject rather than a speck.
8. **The map entry.** `painting-map.ts` gains the row — `{ slug, es, l1, l2, l3 }` — and, where the
   tenant's SKU name differs from the library's own name, one reviewed line in
   `CURATED_EXACT_SKU_ALIASES` binds them. That binding is evidence, not a matching rule: it is
   written only when the qualifier it drops leaves the pictured subject and its form the same.

   **A KEY IS A LIST OF WORDS.** The library keys a row by its slug words — `pez-espada`,
   `patata-monalisa`, `ancas-de-rana` — and a hyphen is a character nobody writing a delivery note
   ever types, so a key of more than one word was invisible to the sort rung and to the kind rung
   both. Every rung reads a key as its WORDS: all of them present in the name, in any order. A key of
   one word keeps the plain substring test it always had, so the widening reaches only the shape that
   was blind. Where several rows match, the winner is the one whose words sit TIGHTEST where they
   were found — the span they cover over the length of the key — and length settles a tie. Length
   alone hands «Pierna de cordero con rinonada sin jarrete» a shank, because «Jarrete de cordero» is
   one character the longer and every word of it is somewhere in that phrase.

   **A KIND THE LIBRARY HOLDS ONLY AS ITS VARIETIES** binds through `KIND_STANDS_FOR`, one reviewed
   line at a time. «Jamón al corte» names a cured ham and the way it is sold; the library paints
   serrano, ibérico, cocido and fresco and holds no plain «Jamón», so the row stood without a face.
   The standing rule is that **a picture may say less than the name and never something else**: the
   cured leg says «a cured ham», which is what the house wrote, and stops there, while «Patata agria»
   for a monalisa would say another variety. That one sentence decides every binding of this kind.
   **It is never derived.** A fallback on the first word of `l1` gathers the eight rows under «jamon»
   and picks the plainest name — «Jamón cocido», pink deli ham for a cured leg.

   **A TILE REFUSED AT REVIEW IS HELD OUT BY SLUG**, in `SUPPRESSED_PAINTINGS`, so the refusal covers
   every seat that resolves to that file: the SKU's face, the writing line's resolving face, and the
   `illustration` column `catalogue-export.tsx` writes into the sheet a tenant sends its customers. A
   suppressed hit answers with the drawn mark and never walks on to a neighbouring variety, because a
   picture of another variety is the thing the review refused. `suppressedPaintingFor` names the held
   tile so the gate can report the debt.

   **A SUPPRESSION IS A DEBT, AND IT CAN HIDE A SECOND ONE.** The set is empty today: the monalisa
   potato was repainted and released. Releasing it also released a wrong answer the refusal had been
   swallowing — the lexicon word «lisa», a mullet, resolved to «Patata monalisa» on four letters
   sitting inside «monalisa». **So a release is measured on the whole corpus like any other rung
   change**, and the fragment rung was closed with it: the written word must begin and end where a
   word does inside the library's name, the same law the other direction already followed.

   **A FRAGMENT IS WORDS TOO.** The rung that answers a SHORTER word — somebody writes «gamba» and
   the library's name is longer — read characters, so «rana» wore serrano shoulder («rana» inside
   «serrana»), «choco» wore CHOCOLATE and «dill» wore a veal shoulder fillet. Reading it as words
   moved 33 of 10,483 surfaces: two corrections, eighteen accidental pictures becoming the honest
   drawn mark, and seven stems or singulars that lose a reasonable picture until the Spanish-plural
   round lands. **A picture may say less than the name and never something else**, and the drawn mark
   always says less.

   **The resolution table is `app/tools/test-painting-map.mjs`.** It resolves every binding in
   `reference-lexicon.ts`, every name in the painted library and every row of every house — ten
   thousand real trade surfaces — through both callers, holds the reading against a recorded one, and
   pins the round trip (every painted subject wears its own tile by its own name), the commission
   (reachable by slug, never by a word) and the named seats. A rung is widened one measurement at a
   time: snapshot, change, diff, read every surface that changed its mind.
9. **The gate.** `python3 tools/artwork-gate.py` lists every product and sellable variant that would
   render without a painting and exits 1 while the list has anything in it. It reads the app's own
   tables through `app/tools/artwork-tables.mjs` and resolves them with `exactPaintingFor`, the
   same function the row calls, so a green gate means the app draws a picture on every row.

   **IT NAMES THE TWO DEBTS APART.** A row without a painting is either a subject NOBODY HAS PAINTED
   yet — closed by walking steps 1 to 8 — or a subject somebody painted and a reviewer REFUSED,
   closed by repainting one tile. Reporting both as «no painting resolves for this name» sent a
   session to read the resolver when the fault was in the picture, so the gate says which debt it is
   and names the held-out file.

   **AND IT RIDES IN THE PUBLIC PROOF.** `drives/drive-197-artwork.py` reads the gate for its own
   row count and asserts its verdict as a leg, and that drive is the `artwork` suite in
   `drives/run-193-public-proof.py`. So the data half of §200.2 and the pixel half go red together
   in one runner, and neither can quietly stop being checked. The gate reads **All 32 products and
   sellable variants carry artwork** and the drive **81 GREEN / 0 RED** at 1600 × 1000 and 390 × 844.

   **WHAT A MACHINE CAN HOLD, AND WHAT IT CANNOT.** The drive asserts every row draws the exact file
   the gate resolved for it — the two halves nailed together at the file — and the gate asserts the
   shipped tile is byte-identical to the reviewed one. Neither says WHAT THE PICTURE SHOWS. No pixel
   statistic can: the refused Mona-Lisa portrait and the potato that replaced it have mean hues of
   40.2° and 42.9°, so «assert the tile reads yellow» would have signed the refusal. The subject is
   step 5, and step 5 is a person looking.

### 16.2 · The file contract

| fact | value |
|---|---|
| format | WebP, RGB, quality 92 |
| canvas | 1024 × 1024 |
| subject | the longest side at 0.75 of the canvas, centred, its ground-contact shadow inside the box |
| ground | pure white, opaque |
| name | the slug — lowercase, accents folded, every other character a hyphen (`gamba-roja-congelado`) |
| source | `assets/paintings/set/<slug>.webp` (reviewed) and `assets/paintings/raw/<slug>.webp` (as painted) |
| shipped | `app/public/paintings/<slug>.webp`, byte-identical to the reviewed set |
| map | one `PAINTINGS` row keyed by `slug`, plus a curated alias where the tenant's name differs |

### 16.3 · The runtime road — `POST /api/artwork`

The road above runs from a workstation. The same road runs on the box, so the house can ship it from
this specification: `mock-api/app/artwork.py`, behind `kit.soyrocoto.com/api`, holding the key the way
the runtime holds every other secret (THE-RUNTIME-SPEC RUN-12).

    POST /api/artwork  X-Rocoto-Artwork-Key: <the house secret>
                       {"reference": "gamba-roja", "describe_only": true}
      → {description, reference{slug,url}}

    POST /api/artwork  X-Rocoto-Artwork-Key: <the house secret>
                       {"name": "Gamba roja · congelado", "reference": "gamba-roja",
                        "description": "…", "replace": "…", "subject": "…"}
      → {name, slug, reference, description, prompt, image{data,url,bytes,content_type},
         provider{adapter_id,model_id,generation_id,reported_cost_usd_micros}, file{…}}

**THIS ROAD IS STILL THE DESCRIBE ROAD, AND §202.1 HAS OVERTAKEN IT.** The two calls above were
built for the reference-and-swap method; the law is now one prompt for every painting, over a clause
a model writes in the library's grammar (§202.8). The endpoint owes a third shape — `{"name", "sort",
"form"}` in, the clause written by Opus, `STYLE_LOCK` wrapped around it, the prompt returned in the
receipt — and the describe pair stays only as long as something still calls it. Until that lands, a
tile made through this endpoint is not made the way the library is made.

Two calls, because the older method has two steps: read the description, then name the exact words to
swap. `replace` must appear in the description once — absent it answers `subject_not_found`, twice it
answers `subject_ambiguous`, and both are 422. The provider is the pinned adapter
`ideogram-v4-async@1` from `specs/intelligence/v1/image-job.schema.json`: multipart submit, a
`generation_id` back, polled at `/v1/generations/{id}`, with a bounded wait — a job still running at
the ceiling answers `generate_stalled` and names the generation id, which is the signature of a
quota that ran out mid-queue.

**The key, and the door.** `IDEOGRAM_API_KEY` in the environment, beside the other four
(`PARSEWISE_API_KEY`, `DEEPGRAM_API_KEY`, `GOOGLE_PLACES_API_KEY`, `TWILIO_*`) — and, because this is
the one road that spends generation credit per call, a house secret of its own:
`ARTWORK_SHARED_SECRET`, presented on `X-Rocoto-Artwork-Key` and held to 24 characters or more. That
header sits outside the CORS allow-list on purpose, so the road belongs to the house's own tooling
over the wire. `ARTWORK_HOURLY_CEILING` (40) bounds what any caller past the door can spend in an
hour. `GET /api/health` reports **`artwork: configured | awaiting key`** — its own words, because the
road is built and waiting rather than absent, and `configured` means BOTH halves are held. Both names
are in `mock-api/deploy/env-names.txt`, so the deploy carries them the moment `.env.local` holds them.
**The runtime road takes the key the moment the house holds it**, and every other part of this
section is unchanged by its arrival. THE-RUNTIME-SPEC RUN-12 is the whole contract.
