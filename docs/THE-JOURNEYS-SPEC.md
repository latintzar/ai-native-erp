# THE JOURNEYS SPEC — Cross-system acceptance from source to customer outcome

> **Authority and status.** This is the public-safe acceptance contract for the required end-to-end journeys. It joins the System, Product Sheet, Catalogue, Intelligence, Stock/Lots and Interaction specifications without replacing them. Every mapped production boundary remains `SPECIFIED` until it has its own scoped actual evidence. A design-kit screen, a saved browser draft, a print dialog, an image proposal or a provider request is never proof of an accepted stock, price, document or customer-message outcome.

## JNY-00 — Shared acceptance laws

| Law | Required behaviour | Forbidden shortcut |
|---|---|---|
| One source, many views | Preserve source identity, source wording, actor, time, revision and the exact line/lot/document relationship. A later view names its source and scope. | Treat a similar name, phone, screenshot, product family, price or repeated wording as proof of the same record. |
| Draft before consequence | A user can save/reopen a scoped draft; drafts retain validation detail and do not write stock, prices, documents or messages. | Turn an autosave, preview, photo upload or inference into an accepted business event. |
| Permission at the command | The server checks tenant, role, object scope, current revision and policy for every write, issue, message and recovery action. | Assume a visible button, an old browser grant or a client setting proves authority. |
| Exact states and copy | Pending, incomplete, invalid, conflict, denied, unavailable, failed, accepted and externally receipted remain distinct. Copy names the known fact and the next action. | Say received, sent, printed, delivered, final or synced without the matching acceptance/receipt evidence. |
| Customer-visible distinction | Before a customer-facing message or albarán is created, the operator sees what that recipient will see: scope, price treatment, missing final facts and revision. | Hide a policy choice and let a customer discover it only from a surprising document. |
| Notes do not become SKUs | Recurrent preparation, brochure or spoken options may remain source notes indefinitely. The tenant chooses whether a line remains a base item plus note or becomes a reviewed mapped variation. | Create, enrich, price, stock or ERP-map a sellable SKU merely because wording repeats. |

### Shared state-copy register

These strings are acceptance copy, not generic placeholders. Business names, product wording, prices, quantities and customer data come from the accepted source/projection and are never translated or invented.

| Situation | Operator copy | Customer-visible result |
|---|---|---|
| Draft | **Saved as a draft. Nothing has changed yet.** | No message, document, stock or price change. |
| Missing evidence | **More information is needed before this can be confirmed.** | No claim of completion. |
| Permission denied | **You do not have permission to make this change.** | No message or document is created. |
| Revision conflict | **This changed while you were reviewing it. Review the latest version before saving.** | The latest accepted record remains visible; no stale overwrite. |
| Provider unavailable | **The message service is unavailable. Your confirmed changes are still saved.** | No claim that a chat confirmation was sent. |
| Photo review required | **Review the photographed values before updating the albarán.** | The prior approved document remains the current version. |
| Concern dismissal | **Why are you dismissing this check? · optional** | No resolution or success claim; the concern remains reopenable. |
| Confirmed resolution | **Thanks for editing.** Only after the evidence-backed correction/resolution command succeeds. | The corrected revision may be used according to its document/message policy. |

### Tenant policy snapshot required by all journeys

Each accepted action records the effective policy revision, not the browser's remembered value. The relevant settings are displayed before the consequence and stored with the resulting document/message attempt:

- **Confirm orders in chat** is governed by `grants.confirm`. Without that grant, no customer confirmation request is eligible.
- **Include prices in confirmations** is governed by `config.confirmation.includePrices` and defaults to `false`. It never changes a saved price or document snapshot.
- **Show prices on albaranes** is governed by `config.albaran.values`. It controls customer-facing document values; it does not change internal ERP/commercial facts.
- A customer quote is eligible only when all three controls above are enabled. Turning one off preserves the other remembered settings but removes quote eligibility. A failed durable settings write leaves the prior effective settings in force and names the save error.
- `productRequests.suggestNewSkus` defaults to `false`. Repeated wording remains a note/proposal while false; manual reviewed creation is the only route to a new sellable SKU.
- `productRequests.erpLines` defaults to `base-item-note`; the tenant may select `mapped-variation` only through a reviewed mapping policy. Neither value invents an ERP result or sends anything externally.

The setting names above are the persisted policy keys. UI labels must make their customer consequence clear rather than expose raw key names as unexplained business copy.

## JNY-01 — Phone source with seven product lines to an approved receipt or draft

**Purpose.** A phone-originated source describes seven product lines. The journey preserves the seven source lines and their wording, resolves each only through review, and directs each accepted line to the correct business act. It does not assume that every phone source is a stock receipt, an order, a new SKU request or permission to message a customer. The parent boundaries are the [source contract](THE-SYSTEM-SPEC.md#src-01), [catalogue contract](THE-SYSTEM-SPEC.md#cat-01), [inventory/lot contract](THE-STOCK-LOTS-SPEC.md#lot-01), interactive catalogue review and the [shared interaction contract](THE-INTERACTION-SPEC.md#intx-01).

### Preconditions and authority

- The external source reference and minimal extracted business facts are retained in the tenant's source envelope with consent/retention policy, channel identity, actor and received time. A phone number alone is not a customer or product identity.
- The operator has the relevant source-read permission. Accepting a receipt additionally requires the stock/receipt command grant; adopting or creating a product additionally requires the catalogue/product policy; creating an albarán line requires its own document permission.
- A current source revision, exact tenant and target location/document are selected before any accepted command. A missing location, product identity, unit, lot policy or revision is a blocking incomplete state, not a default.

### Exact journey

1. **Capture the seven lines.** The operator creates or opens the phone-source draft. Each row retains the original wording, source position and any stated quantity/unit. The source sheet says **7 lines to review** only when seven retained source rows exist; it never substitutes a family total or inferred line count.
2. **Resolve one line at a time.** Deterministic matching may offer exact SKU candidates; bounded reasoning may explain a proposal. The operator sees the source wording, candidate identity, unit evidence and ambiguity. A similar name, old price, customer preference or model confidence cannot select a SKU automatically.
3. **Choose the business meaning.** For every line, the operator explicitly selects the permitted next act: keep as a source note, link a known SKU, start a reviewed candidate/adoption flow, add a receipt line, or add an albarán draft line. A source line is never both a receipt and a sale because its wording happened to recur.
4. **Keep recurring options honest.** A preparation or brochure option remains **Keep as note** by default. The operator may choose **Propose a reviewed product option** only when the tenant policy permits it; `suggestNewSkus=false` prevents automatic SKU hardening. Source wording and an internal preparation note remain evidence, never a sellable option. `base-item-note` may carry a separately approved `customerOption` snapshot alongside the base sellable item; it never copies an internal preparation note. `mapped-variation` requires a reviewed tenant mapping. The customer-facing document preview names the accepted line/option treatment before issue.
5. **Validate receipt facts when a receipt is chosen.** The operator supplies exact SKU, location, quantity, unit, source reference and lot split where required. The lot editor shows assigned/unassigned quantity and cannot save an over-assigned, negative, unit-mismatched or stale split. A proposed quantity remains a draft until the stock command accepts it.
6. **Review the seven-line summary.** The review groups the seven original lines into accepted receipt lines, albarán draft lines, product-review items and notes. It names every unresolved line and the consequence that will occur. The primary action says **Save 7-line review**; a separate command names the accepted act, such as **Record receipt**.
7. **Accept only the selected act.** The server checks tenant, permission, expected revision, idempotency key, source lineage, lot invariant and target state. It returns accepted event identifiers and projection state, or a specific denied/conflict/invalid response.
8. **Show truthful completion.** Accepted receipt lines update the inventory projection only after the accepted stock event. Accepted albarán lines remain a document draft until the independent issue flow. Product proposals remain reviewable; notes remain notes. The source view retains the seven-line lineage after any partial success.

### Failure, recovery and customer outcome matrix

| Boundary | Required failure/recovery behaviour | Customer-visible outcome |
|---|---|---|
| Source unavailable or quarantined | Show **This source is unavailable for review.** Keep no writable derived draft; offer the permitted recovery route. | No product, stock, document or message claim. |
| Fewer/more than seven retained lines | Show the actual retained count and source gap; do not label it seven. Preserve the source draft. | No inferred line is shown to a customer. |
| Ambiguous or missing SKU | Show **Choose a product before recording this line.** Keep the source words and candidates; allow a reviewed proposal, not silent creation. | No invented product name/code/price. |
| Recurrence/brochure wording | Keep it as source note or reviewed proposal according to policy. Reopening it does not convert it into a SKU. | The customer sees the accepted line/option distinction before a document is issued. |
| Receipt split invalid/conflicted | Keep the draft and show the exact unassigned/over-assigned or revision problem. No stock projection moves. | No availability or received-goods claim. |
| Partial batch acceptance | List accepted line identifiers and unresolved rows separately. Retry only idempotent unaccepted rows after review. | No “all seven received” message unless all seven receipt commands were accepted. |
| Unknown SKU with box/kg wording | Preserve the source product words and both stated unit forms. Require a reviewed exact SKU and approved conversion/equivalence before a receipt quantity can be calculated; **Choose a product before recording this line.** remains visible. | No invented SKU, box-to-kg conversion, stock or price. |
| Interrupted entry/reopen | Store a tenant-scoped draft with source revision and unresolved-row state. On reopen, refetch current source/target revisions and show the conflict/changed state before any write. | No saved/received/customer claim merely because the draft reopens. |
| Sequential Stock update handoff | Use **Find a product or SKU code** (`UTL-B01`) to resolve one exact SKU. **New product** (`UTL-B02`) is a deliberate reviewed route with no stock/price prefill. **Receive stock**/**Record a stock count** (`UTL-B03`) says **Nothing has been recorded yet** until the canonical editor command is accepted. | **Save & next item** (`UTL-B04`) returns to an empty chooser only after one acknowledged idempotent receipt/count with its LOT-01 split; **Save and finish** (`UTL-B05`) ends the sequence. Conflict/cancel (`UTL-B06`) retains the current item only and cannot advance. | A sequence is never labelled a bulk receipt, and no next item inherits product, quantity, lot, source or validation state. |

### Boundary variants

| Case | Operator action and permission | Draft/recovery state | Customer-visible outcome |
|---|---|---|---|
| Unknown SKU, boxes and kg | A source reader retains the literal product/unit wording. A stock command is unavailable until a permitted reviewer chooses an exact SKU and approved unit/equivalence evidence. | The source row remains an unresolved draft with both `box` and `kg` facts; there is no guessed conversion. | No product, received quantity, availability or price is shown. |
| Interrupted seven-line review | The same permitted user can reopen the scoped draft; a changed source/target revision requires re-review before the separate command is enabled. | Persist only draft intent, source lineage and per-row validation; preserve accepted rows separately from unresolved rows. | No recovery screen says all seven accepted or sends a customer update. |

### Required proof

- Seven-line source fixture with repeated wording, an unknown product/box-kg source row, a note-only option, a valid multi-lot receipt and a revision conflict.
- Permission-denial, duplicate-retry, partial-batch and unit/lot-invariant traces, each scoped to a synthetic tenant.
- Accessibility evidence for phone/full-screen review: source reading order, named actions, focus return, screen-reader labels, 390 px and 320 px no-overflow checks.
- A source-to-event lineage report proving that accepted receipt quantity is neither double-recorded nor confused with an albarán quantity.

## JNY-02 — Working paper to actual kg/price review and final albarán

**Purpose.** A working paper may be printed before actual kilograms and final prices are known. Handwritten values or a photo are evidence to review, never a direct update. The final albarán is a new accepted document revision with its own customer-visible price policy and traceable relationship to the working paper. It composes the [Albarán](THE-SYSTEM-SPEC.md#alb-01), [document](THE-SYSTEM-SPEC.md#doc-01), [commercial](THE-SYSTEM-SPEC.md#com-01), lot, finished-albarán prediction, concern and recovery contracts.

### Preconditions and authority

- The working print identifies its selected document revision, scope, print profile and whether physical printing is unknown, requested, provider-receipted or failed. A browser preview or print-dialog request is not physical-print proof.
- The operator can read the source document; changing actual quantity/price requires the relevant commercial/document grant. Uploading a paper photo has its own media/retention consent and review permission; it does not grant document-write authority.
- The line carries distinct ordered quantity, actual quantity, Unit, optional measured weight, price source and price basis. Exact decimal and unit policy apply before a total is accepted.

### Paper-review and source-photo control anatomy

The detailed paper authority is [INTEL-06A](THE-INTELLIGENCE-SPEC.md#intel-06a-corrected-paper-review-and-final-print-state). These IDs map its concrete application controls to build tasks; a current client screen is bounded kit support, never a production media service, accepted amendment or physical-print receipt.

| Control ID | Sheet → section → control | Opened surface, field/state and exact copy | Command boundary and customer outcome |
|---|---|---|---|
| **JNY-R01** | Albarán → Paper check → review surface and stage | `albaran-paper-review` exposes `data-stage="current|working|stale|final"`; `albaran-paper-stage` names **Current paper**, **Working paper**, **Working paper changed** or **Final paper**. | A stage is derived from print/review revisions. It is not proof that a printer, driver or customer received paper. |
| **JNY-R02** | Albarán → Paper check → retained source/photo state | `albaran-paper-photo`, `albaran-paper-source` and `albaran-paper-missing` distinguish transient photo, external/session source label, opening/missing state and the exact warning **The photo is gone from this session. Add it again to finish the review.** An accepted review survives byte expiry when its document/source fingerprint still matches; then say **The photo is gone from this session. Your completed review is saved.** | Photo bytes/evidence are restricted. No photo state changes a line, reads figures automatically or proves source acceptance. |
| **JNY-R03** | Albarán → Paper check → photo input/retry/failure | `albaran-paper-photo-input` accepts `image/*`; the initial mobile action is **Take photo** and an attached-camera replacement is **Retake photo**. Upload/file replacement remains **Replace**. Permission denial, picker cancellation and capture failure keep the working review and expose **Try again**; cancel returns focus to **Take photo**, success to the attached-source card, and retake cancellation preserves the prior source. | A failed local save keeps only active-page retry state. It does not attach an authoritative asset, erase an earlier source or alter actuals. |
| **JNY-R04** | Albarán → Paper check → review completion | `albaran-paper-review-state` exposes `data-review-finished="yes|no"`; A new/replacement **Finish review** requires matching available source/document state. Session byte expiry does not revoke an accepted review whose durable source reference and document fingerprint still match. Replacement source or material document edit invalidates that acceptance. A later canonical print is still required for **Final paper**. | An omitted flag, click or earlier print cannot make paper final, issue a document or claim physical completion. |
| **JNY-R05** | Albarán line → working-paper correction → exact actual fields | `quantity-write-<line-id>`, `rate-inline-<line-id>`, `row-rate-<line-id>` and `final-weight-put-<line-id>` have visible **Actual quantity**/**Actual unit price** labels after print. | Each accepted correction remains an ordinary revision-checked line command; it cannot globally reprice, infer a unit/lot or apply photo/OCR values. |

### Exact journey

1. **Create a working paper snapshot.** The operator selects a current draft/revision and the print scope. The preview says **Working copy — actual quantities and prices may still change.** It displays a revision reference and, where appropriate, blank fields for handwritten actual kg and final unit price. It does not present a final total when final facts are unknown.
2. **Capture actual values manually or as a photo proposal.** Manual entry uses one field per selected line: **Actual quantity**, **Actual unit**, **Measured weight**, **Final unit price** and **Reason/source**. A photo is read transiently as an untrusted attachment with page/document/revision match proposal, extracted candidates and evidence coordinates. Neither path changes a line while it is merely captured.
3. **Review source against current revision.** The review names the paper revision, current document revision, each proposed before/after value, unit/basis, confidence/uncertainty and missing evidence. If the source document changed, show **This changed while you were reviewing it. Review the latest version before saving.** A stale paper cannot overwrite a newer accepted line.
4. **Handle concerns without fake resolution.** The reviewer may request correction, keep a concern open, or dismiss it with the one optional field **Why are you dismissing this check? · optional**. There are no preset dismissal chips, categories or client-side reason codes. A dismissal does not resolve the concern; only an evidence-backed correction/resolution command can do that.
5. **Validate commercial and stock consequences.** The server checks expected revision, unit equivalence, exact decimal precision, price authority, tax/total policy, lot allocation/depletion consequences and document permissions. A missing final price remains missing; an available tariff/current price is labelled as such and is not silently promoted to final.
6. **Confirm the amendment.** The review action says **Save reviewed actuals**. Acceptance emits a document/amendment event linked to the working-paper/source evidence; a new immutable albarán revision is rendered from those accepted facts. The previous paper/revision remains inspectable and stale where applicable.
7. **Issue/reprint through the customer policy.** The operator previews the customer document with its exact price treatment. `config.albaran.values=false` removes price rows/totals from the customer-facing albarán; `true` permits only accepted frozen price values. The copy says either **Prices are hidden on this delivery note.** or **Prices are shown on this delivery note.** before issue. This presentation setting does not alter internal ERP/commercial price facts. A separately approved `customerOption` snapshot is rendered only with its accepted base item/variation treatment; internal preparation notes are never copied into customer output.
8. **Record outcome truthfully.** The resulting state separately reports document revision accepted, preview rendered, print request/provider receipt, email/message request and any external receipt. It never turns the earlier working print into a final document or a provider response into customer delivery proof.

### Failure, recovery and customer outcome matrix

| Boundary | Required failure/recovery behaviour | Customer-visible outcome |
|---|---|---|
| Handwriting/photo unreadable or uncertain | Preserve reference/coordinates and require external retrieval or re-selection; show **Review the photographed values before updating the albarán.** Require manual correction or retain the prior approved value. | No fabricated kg, price or total. |
| Photo duplicates/stale page | Detect document/revision mismatch and duplicate lineage; offer review/relink, never blind reapply. | The prior accepted document remains authoritative. |
| Unit or price-basis mismatch | Explain the supplied and required unit/basis; keep the draft. Do not convert or calculate a rate without policy/evidence. | No misleading final quantity/price. |
| Permission denied or concern unresolved | Preserve permitted draft/evidence; block the write/issue command and name the permission or unresolved concern. | No final albarán or success acknowledgement. |
| Render/print/provider failure | Preserve accepted document revision and state which later output failed. Retry only the output job with its own idempotency/evidence. | No claim that paper was printed, emailed or delivered. |
| Partial delivery across named lots | Review actual delivered/depleted quantity per named lot against the accepted allocation. Keep unfulfilled balance and lot conflicts visible; a later delivery is a separate act. | Draft amendment retains lot IDs, assigned/unassigned balance and revision. It cannot allocate the remaining quantity by assumption. | The customer document states only the accepted delivered lines/quantity; it does not imply full delivery. |
| Proposed substitution | Present source/stock reason, proposed exact replacement, unit/price effect and customer-facing wording. A permitted operator records a request; customer approval is a separate evidenced event before final issue. | No final document mutation while approval is pending/denied/expired or the target revision changes. | No substituted item appears as accepted, delivered or approved before the matching customer-approval evidence. |

### Boundary variants

| Case | Operator action and permission | Draft/recovery state | Customer-visible outcome |
|---|---|---|---|
| Partial delivery across lots | A document/stock-authorized reviewer attributes accepted actual delivery/depletion to named lots and confirms any unfulfilled balance. | Keep the cross-lot allocation and document amendment as a revisioned draft until both invariants and document command accept. | The final albarán reflects only accepted partial delivery; it never silently completes the remainder. |
| Substitution needs approval | The operator may propose an exact substitute with its line/unit/price consequence, but the final-issue path requires separately recorded customer approval. | Keep proposal, customer-approval request/receipt, expiry and revision conflict distinct from the final document command. | The customer sees the proposed item before approval and sees it as a final line only after its accepted approval and document revision. |

### Required proof

- Synthetic working-paper fixture with unknown final price, actual kg in a supported unit, unit mismatch, stale paper, duplicate photo and disputed annotation.
- Independent review trace proving capture → proposal → human review → accepted amendment → immutable final revision; no OCR/photo direct write path.
- Exact-copy, keyboard/mobile, permission-denial, conflict and output-state tests. The concern test must prove the optional free-text dismissal rule and that dismissal alone does not resolve.
- A rendered customer-document comparison for both `config.albaran.values` values, showing that price visibility changes presentation only and never changes accepted commercial facts.

## JNY-03 — Four SKU price changes and truthful in-chat confirmation

**Purpose.** An operator changes prices for four distinct sellable SKUs, reviews the batch, saves it with effective policy, and optionally requests a customer-facing in-chat confirmation. The confirmation and the albarán have independent price-visibility policies. No setting can convert a draft or provider request into an accepted price/message outcome. The parent boundaries are [commercial policy](THE-SYSTEM-SPEC.md#com-01), [administration/settings](THE-SYSTEM-SPEC.md#adm-01), [customer-option ownership](THE-OBJECT-MAP.md#obj-02-primary-objects-and-their-owners), [option/review policy](THE-SYSTEM-SPEC.md#cat-01-1-recurring-customer-options-and-preparation-notes), [quote change control](THE-SYSTEM-SPEC.md#cat-01-2-option-quote-acceptance-and-change-control), [confirmation/ERP controls](THE-SYSTEM-SPEC.md#adm-01-1-customer-request-confirmation-and-erp-policy-controls), [ERP representation](THE-SYSTEM-SPEC.md#utl-02-1-product-request-policy-and-erp-representation), [messaging integration](THE-SYSTEM-SPEC.md#intg-01), Albarán/document rules and quality gates.

### Preconditions and authority

- Four exact SKU identities, tariff identities, Units, currency/tax context, price source and expected revisions are selected. Related/family prices are labelled suggestions only and never substitute for an exact SKU price.
- The operator holds the tenant commercial write grant; a live chat request additionally requires the tenant messaging policy and recipient/channel authorization. A document preview/issue requires its own document permission.
- The effective policy snapshot includes `grants.confirm`, `config.confirmation.includePrices`, `config.albaran.values`, commercial approval/effective-time policy and the selected tariff/customer scope. A durable settings-write failure leaves the prior effective snapshot unchanged and reports the error.

### Customer confirmation and product-option control anatomy

| Control ID | Sheet → section → control | Opened surface, field/state and exact copy | Command boundary and customer outcome |
|---|---|---|---|
| **JNY-C01** | Product Sheet → Prices → **Customer confirmations** settings door | Tertiary door says `Customer confirmations: off`, `Customer confirmations: quantities only` or `Customer confirmations: with prices`; it opens the shared **Customer confirmations** settings modal in place, with the Product Sheet retained beneath it. | Opening the modal is navigation only; it does not save, send or infer a price. Back/Forward closes/restores the modal and its selected customer preview without losing the underlying Product context. The customer sees nothing. |
| **JNY-C02** | Operations → **Customer confirmations** row/deep route → shared settings sheet | The Operations row and accessible deep route open the same shared **Customer confirmations** modal. Help: **Changes save immediately. Existing messages and issued documents stay as they were.** The sheet has a named close, preserves viewport/focus return, and restores its exact selected customer preview through Back/Forward. | Settings commands are separately authorized and revisioned; a route/open state is not evidence that settings were saved. |
| **JNY-C03** | Operations → Customer confirmations → policy → **Confirm orders in chat** | Independent checkbox bound to `grants.confirm`. Off effect: **Automatic confirmations are off. Orders come to your team.** | Controls confirmation eligibility only. It never sends a preview or silently switches a recipient/channel. |
| **JNY-C04** | Operations → Customer confirmations → policy → **Include prices in confirmations** | Independent checkbox bound to `config.confirmation.includePrices`. When it is off, copy says **Rocoto confirms the items without prices.** Its choice remains remembered if another quote control is off. | Price values may be considered only with current price evidence and all three quote controls; toggling does not edit tariff/customer price data. |
| **JNY-C05** | Operations → Customer confirmations → policy → **Show prices on albaranes** | Independent checkbox bound to `config.albaran.values`. Hidden-price explanation: **Albarán prices are hidden, so confirmation prices are hidden too. Your include-prices choice is kept for later.** | A customer quote needs this control as well as C03/C04. Internal prices remain available for data and invoicing in the ERP; customer presentation changes no commercial fact. |
| **JNY-C06** | Operations → Customer confirmations → preview → **Preview for customer** | Select field has accessible name **Preview for customer**. It lists permitted current customers only; names are displayed as saved business data. | Changes the local preview subject only. It does not change customer identity, a recipient or an order. |
| **JNY-C07** | Operations → Customer confirmations → preview → **Current confirmation preview** | When today's price-change ledger has entries, shows its latest four distinct exact SKU IDs, including reviewed/minted variants; without one it says **Example catalogue items**. For each line it uses only today's saved customer override or the selected customer's assigned tariff. In the customer preview a missing value says **Price to confirm** then **We will confirm the missing prices before proceeding.** | **Example only. Nothing is sent. Live customer delivery is not connected in this kit.** No seeded, old, related-SKU, other-customer or invented price fallback; it is not a hard-coded first-four catalogue preview. |
| **JNY-C08** | Operations → Customer confirmations → policy effect → **Confirmation policy effect** | Explains the current combined three-control consequence, including **Confirmations may include today’s saved customer or tariff price. Missing or old prices stay “price to confirm”.** | Explanation is not a provider request, quote acceptance or delivery receipt. |
| **JNY-C09** | Operations → Customer confirmations → preview → operator review state | When a price quote is otherwise eligible but one of the four current exact-SKU facts is absent, an operator-only status says **Order is part confirmed. Review the prices still to set.** | This status is not part of the customer message, does not change a price or recipient, and never proves delivery, acceptance or a provider receipt. |
| **JNY-P01** | Operations → Customer confirmations → Product requests and options → **Suggest a product review for recurring requests** | Independent checkbox bound to `productRequests.suggestNewSkus`, default off. Off copy: **Recurring requests stay as line notes. They never become catalogue items automatically.** On copy: **Rocoto may offer a review. Only your explicit approval creates a product.** | Repetition never creates a SKU. A source/preparation note stays internal until a separately approved `customerOption` snapshot exists; the customer-facing document shows the accepted base-item/customer-option or approved variation distinction before issue. |
| **JNY-P02** | Operations → Customer confirmations → Product requests and options → **How product options reach your ERP** | Select: **Existing item with line notes** (`base-item-note`) or **Use a mapped variation when available** (`mapped-variation`). `base-item-note` means an approved `customerOption` snapshot alongside the existing sellable item, never an internal preparation note. Help: **This does not create ERP items.** | `mapped-variation` requires an approved mapping; missing destination support, option field or surcharge representation requires review. No silent fallback, live sync or new ERP item claim. |
| **JNY-P03** | Operations → Customer confirmations → settings save state → error alert | `role=alert`: **Saving this setting stalled. Your previous choice is still in use. Try again.** The failed control returns focus to its labelled setting. | Failed durable write retains the prior effective policy snapshot; preview/message/document outcomes continue to use it. |
| **JNY-P04** | Operations → Customer confirmations → sheet footer → **Done** | Primary **Done** closes the settings surface after immediate settings attempts. It is not a second publish/send action. | Closing never converts a preview into a message, a price draft into an accepted price, or a note into a SKU. |

### Customer-option review and outward-copy anatomy

The detailed option authority is [CAT-14A](THE-CATALOGUE-CONTRACT-SPEC.md#cat-14a-order-note-and-product-option-review), with object/policy links in JNY-03. `prepNote` is the kit compatibility field for **internal comments**. Only an approved, customer-audience `customerOption` snapshot with review/source/actor/time evidence may reach confirmation or customer paper.

| Control ID | Sheet → section → control | Opened surface, field/state and exact copy | Command boundary and customer outcome |
|---|---|---|---|
| **JNY-O01** | Albarán line → **Comments** | comment-open opens a line-scoped author/time thread and internal composer. No Team note explanation box. | Comments/recurrence remain internal evidence, never customer/catalogue authority. |
| **JNY-O02** | Comments → **Use this comment…** | **Keep as comment**/**Review wording** are secondary actions in a closed disclosure. | Review/keep affects only scoped review state. |
| **JNY-O03** | Review → fields | **Customer note** and separately **Product name** keep outward wording and SKU candidate distinct. | Typing alone changes no customer copy, variation or ERP fact. |
| **JNY-O04** | Customer text approval | **Use on delivery note**/**Remove from delivery note** approve/remove outward snapshot. Direct **Add note** → **Save note** is independently authored/approved. | Requires actor/time/source/review; no fabricated incoming message or historical rewrite. |
| **JNY-O05** | Review → **Create a separate product** | Secondary disclosure hands the retained comment to the shared variation review. The required **Product name**, **SKU** and **Unit** are confirmed there; **Cancel review** has no consequence. | No catalogue row, price or artwork request exists before the shared SKU confirmation. Confirmed creation opens independent pricing; this order and its source note remain unchanged. |
| **JNY-O06** | Albarán/customer paper → outward option projection | `paper-customer-option-<line-id>` renders only `customerOptionText()` after the approved/audience/review/source/actor/time filter. | Internal `prepNote`, raw asked wording and unreviewed notes never appear in confirmation, outward delivery view, customer paper or ERP line note. |

### Exact journey

1. **Build the four-SKU draft.** The editor identifies each SKU, tariff, previous accepted value, proposed value, Unit, effective time and source/reason. The primary draft copy is **Saved as a draft. Nothing has changed yet.** A change to one row never applies to the other three by family relationship or similar name.
2. **Validate the whole batch.** Before save, the server validates decimal, currency, selling-unit, tariff lifecycle, effective policy, target scope and expected revision for all four rows. The review shows each valid/invalid row. An invalid row cannot be hidden behind a batch-level “saved” toast.
3. **Accept the price command.** The command is atomic where the tenant commercial policy requires it; otherwise accepted and rejected rows are explicitly separated with idempotency keys. Accepted price events retain before/after values, actor, effective time and policy revision. The current/future price changes; issued albarán snapshots do not rewrite.
4. **Show the communication consequence before requesting it.** The review panel shows the three independent settings and their combined quote rule:
   - `grants.confirm=false`: **Confirm orders in chat is off. No confirmation will be sent.**
   - `config.confirmation.includePrices=false`: **Include prices in confirmations is off. Prices will not be included.**
   - `config.albaran.values=false`: **Show prices on albaranes is off. Prices are hidden on albaranes.**
   - all three enabled: **Quotes are available for this customer.**

   A quote requires all three enabled settings. When today's price-change ledger has entries, the preview identifies the chosen account and its latest four distinct exact SKU IDs, including reviewed/minted variants; otherwise it is explicitly labelled **Example catalogue items**. It uses only each SKU's exact **today's saved customer override** or the chosen account's **assigned tariff**. It never uses seeded data, a hard-coded catalogue subset, an old fallback, a related SKU value or another customer's tariff. In the customer preview a missing value says **Price to confirm** and **We will confirm the missing prices before proceeding.** The separate operator state says **Order is part confirmed. Review the prices still to set.** Turning one setting off retains the other saved choices but removes quote eligibility. The preview never sends a message.
5. **Request only an allowed message.** A chat request is a separate command after accepted price changes. A non-price confirmation may be eligible under the confirmation grant; a quote request requires all three settings above, the approved recipient/channel, exact accepted four-SKU scope and the effective policy snapshot. The request records whether values were included; it never rebuilds values from stale draft state.
6. **Report transport truthfully.** The UI distinguishes **Message request saved**, **Submitted to the message service**, **Accepted by the message service**, **Delivery status is unavailable**, **Failed to send**, and the provider's matching receipt. It does not claim customer receipt/delivery from a queued or submitted request.
7. **Prepare later albarán independently.** If those SKUs appear on a later albarán, the document uses its own accepted line price and `config.albaran.values` policy snapshot. A chat that includes prices does not force document prices visible; a hidden-price chat does not erase commercial facts.

### Failure, recovery and customer outcome matrix

| Boundary | Required failure/recovery behaviour | Customer-visible outcome |
|---|---|---|
| One SKU is stale/invalid | Keep all four draft rows with row-level reasons; require review of the latest record. Do not silently save three as four. | No message names an unaccepted fourth price. |
| Batch permission/policy denial | Explain which command/policy is denied and preserve the draft where safe. | No price change or chat request is claimed. |
| Chat disabled/no recipient/no channel grant | Save accepted prices if their command succeeded; show **Confirm orders in chat is off. No confirmation will be sent.** or a specific channel/recipient reason. | No unexpected message. |
| One quote control disabled | Preserve the other remembered settings and show which of Confirm orders in chat, Include prices in confirmations or Show prices on albaranes blocks the quote. | No price quote is requested; an eligible non-price confirmation remains separately truthful. |
| Settings write failure | Keep the prior effective settings and show the save error; do not preview or request a quote from an unsaved toggle. | No surprise change in chat/albarán price treatment. |
| Provider failure/retry | Preserve price acceptance separately from message attempt; retry the idempotent message request only after policy/recipient review. | No sent/delivered claim without a matching provider receipt. |
| Price visibility policy | Show the exact three-setting result and record the policy snapshot with the attempt/document; internal ERP price remains unaffected. | The customer sees prices only when the quote/document policy permits them. |
| Brochure/recurring option | Keep source/brochure wording as a note unless an explicit review accepts a `customerOption` snapshot or a mapped variation. It cannot inherit an internal preparation note. | Reopen the note/review without altering the base SKU, tariff or issued history. | The customer sees the accepted base-item/customer-option or variation distinction before issue, never an automatic new SKU. |
| Daily rate changes after an accepted quote | Detect the quote's accepted price/policy snapshot and open a new review for any later rate. Do not mutate the accepted quote or issued document snapshot. | Preserve quote revision, later rate proposal and approval state independently. | The customer is asked to review a new price where policy requires; historic quote wording/value is not rewritten. |
| ERP cannot carry option or surcharge | Block the adapter request when the selected representation has no approved destination field/mapping. Offer review; do not silently drop, flatten or invent the option/surcharge. | Keep the option/price draft and mapping problem recoverable without claiming a sync. | No customer or ERP outcome is claimed until a permitted reviewed representation is accepted. |

### Boundary variants

| Case | Operator action and permission | Draft/recovery state | Customer-visible outcome |
|---|---|---|---|
| Recurring brochure option | A permitted reviewer keeps the request as a note or explicitly approves a `customerOption` snapshot/mapped variation; recurrence itself grants nothing. | Keep source wording, approval/mapping state and base SKU separate; no new SKU is auto-created. | The customer sees the explicit accepted option distinction before an albarán, never an internal preparation note. |
| Daily rate changes after quote acceptance | A commercial-authorized reviewer opens a new price/quote review when a current rate changes after a quote snapshot was accepted. | Preserve the original accepted quote and later proposal separately; never rewrite the historic value or message body. | The customer sees a review/request for the new price only where policy permits; the prior accepted quote remains truthful. |
| ERP cannot represent an option/surcharge | A permitted operator resolves a missing ERP option/surcharge representation through reviewed mapping or retains the draft. | The adapter request is blocked with a recoverable mapping state; no silent flattening, item creation or live-sync claim. | No final customer/ERP consequence appears until the reviewed representation is accepted. |

### Required proof

- Four-SKU synthetic batch with one stale row, one retired tariff, different Units, a permission denial and a successful exact-decimal acceptance path.
- Tests for every combination of `grants.confirm`, `config.confirmation.includePrices` and `config.albaran.values`, including customer-preview snapshots, settings-write failure and no-outbound test transport.
- Provider request/submission/receipt/failure/retry trace proving no customer-delivery claim without the matching receipt.
- Accessibility and copy audit: each setting consequence has an accessible name, explanatory copy, keyboard path, mobile layout and no untranslated/altered business data.

## JNY-04 — Cross-journey evidence and release gate

A journey advances only when its mapped task leaves hold their own required and actual evidence. The journey contract never aggregates a few kit checks into `WIRED` or `PRODUCTION` status.

| Evidence level | What it can prove | What it cannot prove |
|---|---|---|
| Fixture/replay | Deterministic parsing, policy matrix, draft/state copy, decimal/unit calculations and idempotency behaviour under synthetic lineage. | A tenant-authorized production write, external provider acceptance or customer delivery. |
| Controlled integration | Named tenant policy/permission checks, accepted command/event traces and adapter behaviour in a controlled environment. | Broad customer compatibility, physical print, message delivery or ERP application without their own receipts. |
| Release evidence | Versioned acceptance report, privacy/security review, rollback/recovery plan, accessibility evidence and Peter's explicit deployment go under `REL-01.03`. | Automatic authorization to deploy a changed workflow. |

The system-wide release ledger must include each journey's happy path, every listed negative path, evidence scope, source revision, policy revision, fixture lineage and unresolved gaps. A missing proof blocks the affected claim while leaving other independently accepted work truthful.

## JNY-05 — New SKU to price, customer quote, albarán edit and reprint

**Purpose.** A new sellable SKU is a deliberate identity, not a free-text placeholder or an inferred family member. The journey follows that exact SKU through its first price, a customer quote, an albarán draft, a later edit and a reprint. It preserves original SKU bytes and historic document snapshots. The kit demonstrates scoped browser drafts and UI evidence only; the production catalogue, price, message, document and print commands remain separate contracts.

### Preconditions and authority

- The operator selects the tenant and holds current product-create authority. **Product name**, **SKU** and **Unit** are the only explicit fields. SKU is required for a new sellable record; canonical storage trims leading/trailing whitespace, compares duplicates case-insensitively, and preserves internal punctuation and leading zeroes. Unit begins unselected; `kg` is never assumed. A known unit or an explicit literal custom unit is required.
- Manual creation creates no relation and has no category, Placement, family or related-candidate input. A direct relation is written only by the separate inline **Related products** picker after both exact records exist; it never creates an SKU or opens a creation modal.
- Each command has its own tenant, actor, current permission, expected revision and idempotency key: create SKU, write Price, request quote, amend albarán, issue document revision, request output, and confirm physical print. Price authority, customer/channel authority and document/print authority are not implied by product-create authority.

### Exact journey

1. **Start a scoped identity draft.** The direct form presents Product name, SKU and Unit. Empty initial fields do not announce a failure before interaction; the disabled confirmation explains the next required field after it is touched. Cancel, close, Upload catalogue and browser Back retain a tenant-scoped draft until explicit discard. No product, price, image request or stock record is created by opening or typing.
2. **Review identity and exact SKU conflict.** The form trims only outer SKU whitespace for storage and compares canonical SKU values case-insensitively while preserving internal punctuation and leading zeroes. A collision names the matching SKU and offers **Open existing SKU**; it does not merge names or create a sibling code. For a variation, Back retains description and manually changed identity when the description is unchanged; edited description returns to review rather than claiming a model interpretation.
3. **Commit one stable SKU.** The create command validates current Unit/SKU policy and persists the SKU identity with one request identity before any dependent action. If a dependent catalogue write fails, retry resumes that same SKU/request identity; it never creates a second SKU or second artwork request. The result has no inherited customer history, stock, image, price or tariff revisions.
4. **Set the first exact-SKU Price.** The price sheet opens only after SKU/catalogue persistence succeeds. It names SKU, tariff, currency and Unit. A price draft is not a price event. The server checks tenant, tariff lifecycle, expected price revision, effective time and commercial permission; saved price revisions are append-only. Historic albarán lines retain their issued price/unit/name snapshots.
5. **Review a customer quote.** The operator selects the exact customer and current recipient/channel. The preview identifies exact SKU, price source, tariff/customer override, current policy snapshot and any missing price. It is eligible only under the confirmation, customer-recipient and price-visibility policies. **Message request saved**, provider submission, provider acceptance, delivery unavailable and delivery receipt remain separate states.
6. **Create and edit an albarán independently.** A later albarán draft selects the exact SKU and an accepted current price according to the document policy. Editing quantity, price, customer or delivery facts produces a revision-checked document amendment; it does not rewrite the quote, prior price event or earlier issued albarán. A stale document opens latest-review, not a silent overwrite.
7. **Reprint with print truth.** Native print starts in **Print requested** only. Browser print dialog opening, native callback, PDF bytes or `downloadStarted` prove neither physical printing nor local-file persistence. A permitted operator must explicitly choose **Confirm printed** after physical confirmation; the command records document revision, output scope, actor/time and evidence. Reprint always names the selected document revision. A stale revision requires choosing/reviewing the current or historical version before output.

### Failure, recovery and customer outcome matrix

| Boundary | Required failure/recovery | Customer-visible outcome |
|---|---|---|
| Missing SKU or Unit | Retain the draft, point to the exact missing labelled field, and make no default Unit choice. Internal classification is never an intake requirement. | No product, price, quote or document claim. |
| Exact SKU collision | Preserve typed raw SKU and draft; offer **Open existing SKU**. A separate code is required for a separate SKU. | No duplicate-looking product or confused quote. |
| Partial SKU/catalogue persistence | Retain creation request identity and name which store accepted; retry resumes it. Artwork and Price do not start until both identity stores accept. | No new-product success claim or image/price event. |
| First-price conflict/denial | Preserve price draft and show latest revision/policy reason. Do not alter earlier albaranes. | Quote/document keep their last accepted snapshots. |
| Quote policy/channel/provider failure | Keep accepted price separately from quote request; show exact policy, recipient or provider state. | No sent, received or delivered claim without the matching receipt. |
| Albarán stale edit | Fetch latest document revision and preserve proposed field changes for review. | Prior issued version remains authoritative. |
| Print/download uncertainty | Show **Print requested** or **Download started** only. Do not say saved locally or printed physically. | Customer sees only an issued/reissued document revision, never a false physical-print claim. |
| Physical confirmation denied/missing | Retain requested output state and require an authorized explicit **Confirm printed** command. | No “printed” claim. |

### Desktop, phone and interruption requirements

- Desktop uses the fixed workflow frame with named header, Back/Close and visible footer. At 390 px and 320 px it remains viewport-bounded with one body scrollport, accessible labelled controls and no horizontal overflow. The Price, quote and print stages retain the initiating SKU/document context on return.
- Escape, Close, browser Back, Upload catalogue, app reload and a network interruption preserve the scoped SKU/price/document draft or show the exact unavailable/revision state. They never create a SKU, issue an albarán, start an artwork job or confirm print.
- Required evidence: exact-string SKU fixture (leading zero/case/punctuation/meaningful whitespace), blank-unit/category denial, custom-unit fixture, duplicate/retry trace, independent first-price/customer-quote/albarán snapshot chain, stale document/reprint fixture, native-print requested/Confirm printed/downloadStarted negative matrix, and desktop/390/320 accessibility traces.

## JNY-06 — Operator-reported shortage to reviewed impact, customer copy and partial/unknown delivery

**Purpose.** An operator can report a new shortage without converting it into a confirmed supplier event, delivery fact or customer message. The journey identifies affected exact-SKU commitments, reviews customer copy and recipients, and keeps partial delivery, unknown delivery and later evidence distinct.

### Preconditions and authority

- The operator has shortage-report authority for the tenant/location and selects source, affected exact SKU/lot where known, factual quantity/status, and confidence. Unknown supplier response, ETA, substitute or delivered amount stays unknown.
- Impact calculation is a read projection over current commitments, stock/lot evidence and document revisions. Changing a shortage, customer recipient, delivery state, substitution or albarán requires its own current permission and expected revision.
- Customer recipient/channel consent and communication policy are resolved at request time. The visible recipient list is not a send grant. A generated copy proposal is an editable draft and cannot claim supplier confirmation, delivery, price, substitute or contact outcome without accepted evidence.

### Exact journey

1. **Record the operator fact as a draft.** **Report shortage** captures exact SKU/lot if known, reported unavailable quantity, location, source wording and operator time. It deliberately permits **Unknown quantity** and **Unknown delivery status**. Save draft produces no stock movement, supplier message, customer message or document amendment.
2. **Review affected commitments.** The impact view identifies affected albarán/order lines by exact SKU, delivery date, allocated lot and document revision. It distinguishes confirmed shortage evidence, operator report, forecast concern and no-impact result. Related family items, similar names and estimated stock do not become affected commitments by default.
3. **Choose customer treatment per commitment.** The operator chooses retain delivery as planned, propose partial quantity, request customer decision, propose approved substitute, or mark delivery status unknown. Each choice has explicit quantity/unit/price/document consequence. Partial delivery preserves the remainder; unknown delivery never defaults to complete or failed.
4. **Review copy and recipients.** The message review displays every recipient, channel, consent/authority result, exact SKU wording, known quantity, unknown facts, requested response and document revision. Copy may say **We are checking availability** or **We can deliver part of this order** only where the underlying fact supports it. It never says dispatched, delivered, supplier-confirmed or refunded from an operator draft.
5. **Request communication separately.** A send request persists exact recipients, copy revision, policy snapshot and idempotency key. Provider queued/submitted/accepted/failed/delivery-unavailable/receipt states are retained independently. One failed recipient does not turn successful or unsent recipients into a collective delivery claim.
6. **Accept partial or unknown delivery evidence.** When delivery evidence arrives, the operator reviews exact delivered quantity/unit/lot and document impact. An accepted partial delivery creates a new document/stock revision and retains unfulfilled balance. An unknown outcome remains **Delivery status is unknown** and keeps follow-up open.
7. **Recover after interruption.** Reopen pulls current shortage, commitment, policy and document revisions. Changed stock, customer consent, recipient, lot or document evidence requires re-review; prior message/outcome receipts remain immutable.

### Failure, recovery and customer outcome matrix

| Boundary | Required failure/recovery | Customer-visible outcome |
|---|---|---|
| Report lacks SKU/quantity/location | Keep literal report and unknown fields; block only actions requiring the missing fact. | No false shortage scope or delivery change. |
| Impact revision changed | Show changed commitment/lot/document and retain the proposed treatment for review. | Customer is not contacted from stale impact. |
| No authorized recipient/channel | Preserve reviewed copy and recipient problem; do not silently use another address/channel. | No message request. |
| Copy exceeds evidence | Block the unsupported assertion and point to the missing delivery/supplier evidence. | No claim of dispatch, delivery, substitution, credit or confirmation. |
| Partial message send/provider failure | List each request/receipt separately; retry only failed idempotent recipients after current-policy review. | No collective sent/delivered claim. |
| Partial delivery invariant failure | Keep actual/remainder/lot allocation draft; block over-delivery, wrong unit or stale lot amendment. | Document does not silently complete the remainder. |
| Unknown delivery | Preserve follow-up state and distinguish unknown from delayed, failed and delivered. | Customer-visible copy names uncertainty without invented ETA. |

### Desktop, phone and interruption requirements

- Desktop impact review pairs affected commitments with recipient/copy review; phone presents the same evidence in a single ordered scroll sequence, retaining the shortage ID in header/back context. At 390 px and 320 px, status chips do not replace written states and each recipient action has an accessible name.
- Closing, reload, offline state and browser Back preserve a scoped report/copy draft but not a send or delivery acceptance. On reopen, all volatile commitment, consent and document revisions are checked again.
- Required evidence: exact-SKU/lot impact fixture, no-impact and unknown-quantity cases, mixed recipient permission/provider outcomes, evidence-bounded copy audit, partial-delivery/remainder/lot conflict trace, unknown-delivery follow-up trace, and desktop/390/320 interruption/focus/no-overflow evidence.

## JNY-07 — Template gallery to configured copy, scoped output and history

**Purpose.** A gallery template and column builder produce a versioned recipe. **Use template** then creates a tenant-scoped saved copy, which can be used for Print, File, scheduled Email or a later verified ERP profile. They do not assert that a file was saved locally, delivered to a person, imported by an ERP or superseded an earlier report. Template, saved copy, source scope, column definition, schedule, run and file/history record stay distinct.

### Preconditions and authority

- The operator has read/export authority for the selected tenant, source scope and sensitive columns. Template visibility is policy-scoped; opening a gallery card does not grant access to its data fields.
- The builder starts from a named template or blank recipe. **Use template** creates an independent saved copy. The same saved-copy identity, selectors and activity status are used by Export Centre and day-level print/download shortcuts; category, product, salesperson, truck, date, page and layout never drift between those surfaces. Each column declares stable field ID, label, source scope, transform/version, sensitivity/redaction policy, ordering and null treatment. A typed column label never invents a source field.
- Saving a template, configuring/editing a saved copy, running an export, downloading a file, scheduling Email, sharing it, replacing a template/copy and deleting history are distinct authorized commands with current template/copy/source/policy revisions and idempotency where applicable.

### Exact journey

1. **Browse the template gallery.** Gallery cards state template name, source scope, permitted columns, last approved template revision and whether the template is unavailable for the current role. Email begins with **Subcontractor delivery pack** and **Daily albaranes to accounting**. **Build your own with Copilot** creates a reviewable user-owned proposal/template or copy; it does not send or schedule. Preview is a local recipe view; it creates no saved copy, schedule or output.
2. **Build exact columns.** The operator adds/removes/reorders fields from permitted schema controls, chooses null/redaction handling and sees a source/column preview. A column referencing unavailable, cross-tenant, personally restricted or stale schema data is marked invalid. The builder never fills a column with a similarly named field.
3. **Save a template revision.** The save review shows template name, selected columns, source scope, policy/schema revision and visibility. The command stores a new immutable template revision or conflict state; it does not mutate an older template in place or alter historical output definitions.
4. **Use template and configure a saved copy.** Required fields are saved-copy name, destination, source template/version, scope/filter chips (salesperson, day/period, product, category, labels), permitted fields/columns, settings and connection profile. Print adds paper/copies; File format/name; Email recipient rule, attachment and schedule. The command creates an independent copy; it does not modify the template or any prior output.
5. **Schedule Email where selected.** A scheduled Email copy carries a separately versioned schedule: recipient rule, attachment/template revision, connection profile, cadence/timezone, next run, active/paused state and history. **Edit schedule**, **Pause**, **Resume** and **Remove schedule** are explicit. **Send history** is a hover/card action outside the editor. Before submission, review the final rendered draft and any unusual/new change note. This is a pre-send review contract only: future intelligence may propose those values, but runtime remains deferred. A due time is not a sent or delivered claim.
6. **Request a scoped output.** The operator chooses current source window and saved-copy version. The server validates tenant, export grant, source scope, column policy, row filter, saved-copy revision and destination policy, then returns the appropriate requested state with run ID. Rendering/queueing and `downloadStarted` are separate from durable availability.
7. **Review history and recover.** History names template and saved-copy revisions, source cutoff, row count, redaction policy, checksum/storage receipt, schedule/run state and retention. `downloadStarted` means the browser began download only; it never means the user saved a local file. Source/template/copy/policy change during a run yields stale/expired/cancelled/partial states with exact included/excluded scope. A draft builder or copy configuration can reopen with its selections; phone does not hide transform, redaction, source cutoff or history/version facts behind an icon-only action.

### Failure, recovery and customer outcome matrix

| Boundary | Required failure/recovery | Customer-visible outcome |
|---|---|---|
| Template or field permission denied | Keep the current builder draft, mark denied column/scope and offer permitted alternatives. | No data/file claim. |
| Schema/recipe conflict | Show latest revision beside draft fields and require review/save-as-new/retry according to policy. | Earlier recipe/files remain unchanged. |
| Export request denied/failed | Keep recipe/source selection, name the failed command and do not create a completed-file history row. | No file available/sent claim. |
| Queue/render partial | Record run ID and exact included/excluded rows/reason; separate retry from new request. | No complete-report claim. |
| Download started | Say **Download started** only. Do not infer local-file save, opening or recipient access. | No customer/recipient outcome. |
| Stale source/policy | Preserve prior run/history and require a new scoped review; no silent refresh of file bytes. | No misleading current-data claim. |
| Retention/deletion | Mark expired/deleted/unavailable with policy reason while retaining permitted audit metadata. | No claim that a historical file remains accessible. |

### Desktop, phone and interruption requirements

- Desktop exposes gallery, builder, review and history as named layers with Back/Close and draft restoration. Phone uses a single bounded sheet flow with full column labels, source scope, redaction, transform and version visible before save/run. Both 390 px and 320 px support keyboard/focus return and no horizontal overflow.
- Browser Back, reload, offline state and permission change preserve local builder intent only. They never save a recipe, start a file run, claim a completed download or update history. On reopen the current schema/policy/recipe revisions are checked before write/run.
- Required evidence: tenant-isolated gallery fixture, denied sensitive column, schema conflict/save-as-new trace, source-cutoff/recipe-revision file manifest, requested/queued/partial/completed/expired run matrix, downloadStarted-not-local-save negative trace, history immutability test, and desktop/390/320 accessibility/interruption evidence.

## JNY-08 — First-time setup to controlled activation

**Purpose.** A newly provisioned tenant completes a clear, resumable setup path: one organisation question at a time, a named salesperson’s WhatsApp line, authorised intake, explicit review, a controlled roleplay and an activation decision. The journey makes a browser kit’s unavailable analysis state useful without presenting it as a model, import, connection, customer communication or production activation.

### Preconditions and authority

- The authenticated owner/session and tenant are known before setup opens. A browser-held sector or sample world is never tenant identity, role authority or proof that a production tenant is provisioned.
- The shared task frame is 800 × 600 px on desktop, clamped to the viewport, with one body scroll and fixed header. Phone uses the dynamic viewport with an 8 px inset; the active field, error and action remain reachable at 360 × 800, 390 × 844 and 393 × 873, including on-screen keyboard states.
- A team member, WhatsApp number, upload source and activation state each have their own tenant-scoped identifier and revision. A number does not grant a salesperson customer access, send authority or access to another line. WhatsApp access begins forward-only at accepted connection time; setup never requests or implies historic-chat access.
- Source file bytes, raw incoming messages and provider credentials stay in their owning source/connection boundary. Setup history retains only accepted facts, safe draft state and recovery identifiers.

### Exact journey

1. **Open and resume one setup task.** The owner opens **Setting Rocoto up** in the shared task frame. The header keeps Close reachable and the body has one scrollport. Resume returns to the current unanswered fact and retained permitted draft; it does not replay a prior external action or mark an earlier browser click complete.
2. **Answer organisation facts singly.** The journey displays one labelled organisation/policy question, records its expected revision and offers the next question only after the accepted answer. Back/Close keeps a draft where policy permits. A response about legal profile, hours or operating preference is not an activation or delivery grant.
3. **Connect a salesperson line explicitly.** The owner selects or adds one valid WhatsApp Business number, identifies its named salesperson/owner and sees its scoped connection state. The owner may add another line later without changing the first line’s owner, customers or messages. A visible number, chip or configured card never claims a live provider connection or outbound send.
4. **Authorise and submit intake.** The owner opens the upload route, chooses permitted delivery-note history and product/customer material, and sees source type, scope, validation and retention state before submission. The source remains an intake/review record; an upload preview does not make products sellable, create stock or expose raw files in assistant/customer history.
5. **Review analysis truthfully.** When no approved analysis runtime is available, the step says **Analysis and publishing are unavailable here.** The operator may explicitly mark a manual review complete only after reviewing the accepted intake facts. That mark is a review event, not a model run, publish, supplier fact, stock event or activation.
6. **Run controlled roleplay.** The authorised operator chooses the bounded roleplay/test path and sees the customer/account scope and test lineage. A roleplay turn stays controlled; it does not contact a customer, reuse a provider session or widen the salesperson’s scope.
7. **Review activation gates.** The checklist names remaining organisation, policy, connection-test, roleplay, billing/legal and owner-acceptance facts. Only accepted required facts enable the activation decision; optional unavailable rails remain clearly unavailable without blocking unrelated review.
8. **Recover interruption and permission changes.** Reload, offline, denied upload, expired connection authorisation or role removal preserves the safe draft and names the exact recovery route. On reopen the service refetches current tenant, role, source and policy revisions before any new command.

### Failure, recovery and customer outcome matrix

| Boundary | Required failure/recovery behaviour | Customer-visible outcome |
|---|---|---|
| Organisation answer invalid or stale | Keep the labelled answer/draft, show field or revision conflict and refetch before save. | No tenant policy or activation claim. |
| WhatsApp line unverified, revoked or owned by another salesperson | Keep the connection state and named owner separate; require a fresh authorised connection/reassignment command. | No customer message, line takeover or account exposure. |
| Upload unsupported, quarantined or interrupted | Preserve the accepted source reference and permitted draft only; show retry/reselect/permission route. | No product, stock, import or analysis-complete claim. |
| Analysis unavailable | Show the unavailable state and allow manual review of accepted facts. | No generated suggestion, publication or provider-health claim. |
| Roleplay/activation denied or interrupted | Preserve the checklist and unresolved gate; retry uses current role/policy and a new controlled test when required. | No live activation, delivery or customer contact. |
| Phone keyboard/small screen | Header/Close, active question, error and primary act remain reachable; one intentional body scroll handles the sequence. | No hidden completion or accidental external action. |

### Required proof

- Provisioned-tenant fixture covering one-question organisation flow, two independently owned WhatsApp lines, authorised upload/review, unavailable analysis/manual-review state, controlled roleplay and activation gate.
- Tenant/role/connection/source-revision denial and reload/offline recovery traces proving no raw-file retention in assistant or customer history and no provider send/model claim.
- Desktop **1920 × 1080**, **1536 × 864** and **1366 × 768**, plus phone **360 × 800**, **390 × 844** and **393 × 873** evidence; **1280 × 800** and **320 × 740** remain boundary checks for the 800 × 600 shared frame, body scroll, keyboard reachability, focus return and no horizontal overflow.

## JNY-09 — Salesperson-scoped day to authorised output activity

**Purpose.** A salesperson works only their owned line and assigned accounts for the day, sees truthful Sales counts, prepares the correct scoped output and can arrange authorised cross-cover without silently widening access. The day’s immutable print/reprint activity preserves the source revision, actor and outcome state independently of a browser dialog.

### Preconditions and authority

- The current authenticated actor has a tenant-scoped role, one or more owned numbers and explicit account/route assignment facts. A displayed owner chip, default filter or cached browser selection is not authority.
- Sales filters, totals, output scope and cross-cover selection all use current account/order revisions and the actor’s effective role/policy. Counts distinguish accounts, orders and documents rather than substituting one for another.
- A cross-cover selection requires an explicit authorised coverage record naming covering actor, covered salesperson/line, time boundary, scope and audit identity. It is neither an ownership transfer nor a broad tenant read grant.
- Rendering/printing uses a frozen output revision, paper/copies profile, actor/time, run key and immutable artifact/reprint relation. Native browser dialog opening is submission-attempt evidence only; physical outcome remains requested, accepted, failed or unknown until the appropriate acknowledgement/receipt.

### Exact journey

1. **Open the owned day.** The salesperson enters Sales on their own number/account scope. The visible line/owner chips and active filter name the current scope; Sales counts show only current permitted accounts/orders and state the filter basis.
2. **Inspect scoped orders and counts.** The salesperson can open an assigned customer/order and return to the same day/filter. A result count cannot include an unassigned account merely because it has the same route, product, phone prefix or previous customer interaction.
3. **Prepare own-day output.** The actor selects permitted orders/documents from that scoped result. The output review shows exact order ids, frozen revision, document profile, A4/A5 and copies before request. A daily/packing request never silently includes the rest of the tenant’s book.
4. **Request and review immutable output.** The renderer saves the generated outgoing artifact before the browser print request. Lifecycle status and icon **Activity** open the same trail, recording requested actor/UTC time, source/version, template/profile, paper/copies, run key and selected job ids. **Open copy**, **Try again** and **Previous request** reopen or relate immutable work; they do not rebuild it from later edits. Direct header **Print** stays out of overflow. **Flag** and **Unflag** are independent direct Albarán acts: each records actor/time in the durable ledger and the same Activity trail, without changing Viewed/read, lifecycle, paper or output evidence. **Archive** remains direct when permitted.
5. **Handle print/reprint truthfully.** Popup block, cancellation, browser closure, download or `afterprint` leaves the physical outcome unconfirmed. A same-attempt retry retains the original identity; a deliberate reprint receives a new run key and `reprintOf` link. Confirmation of an older copy remains historical after later order changes.
6. **Select authorised cross-cover.** A permitted manager selects named covering salesperson/line and bounded account/order scope. The covering user sees that temporary scope and its expiry/audit reason; unrelated owned numbers and accounts remain absent. The salesperson cannot self-select a broader scope.
7. **Recover scope or revision change.** Revocation, coverage expiry, order edit, role change or reload re-evaluates the active scope and frozen output. Existing immutable activity remains readable to authorised users; new output/print/retry requires fresh scope and current revision.

### Failure, recovery and customer outcome matrix

| Boundary | Required failure/recovery behaviour | Customer-visible outcome |
|---|---|---|
| Missing/changed owned line or account assignment | Clear the stale filter, explain the lost scope and return to permitted Sales results. | No access or message to removed accounts. |
| Count/filter mismatch | Show the selected account/order/document identities and recompute from current scope before output. | No misleading own-day total or missing/extra document. |
| Cross-cover denied, expired or conflicted | Keep the manager’s proposal/audit reason; do not change ownership or reveal the target book. | No widened customer access, print or message. |
| Output revision changed | Keep the selected IDs and mark the request stale; require review of current revision before a new run. | No document from mixed old/new facts. |
| Browser print unknown or popup blocked | Preserve requested/printing/unknown state and same-attempt recovery; require acknowledgement or verified receipt for confirmation. | No “printed”, delivery or customer receipt claim. |
| Reprint after edit | Keep prior immutable artifact/activity and require a deliberate new linked run. | The customer sees only the deliberately issued copy; prior copy is not rewritten. |

### Required proof

- Two-salesperson synthetic tenant fixture with independently owned WhatsApp lines, assigned-account Sales filters/counts, scoped day output and a manager-authorised bounded cross-cover record.
- Permission/revocation/expiry/cross-tenant/filter-count traces showing no self-service scope widening and no unassigned customer/order/document exposure.
- Immutable output fixture proving requested/unknown state, popup-blocked same-attempt retry, old-copy confirmation after an order edit, linked reprint activity and no physical-print claim without acknowledgement/receipt.
- Desktop **1920 × 1080**, **1536 × 864** and **1366 × 768**, plus phone **360 × 800**, **390 × 844** and **393 × 873** evidence; **1280 × 800** and **320 × 740** remain boundary checks for scoped filters, account/order return, cross-cover selection, activity/reprint controls, keyboard/focus recovery and no horizontal overflow.


## JNY-10 — Accepted off-SKU request to traceable uncoded product history

**Purpose.** An operator receives an item outside the company SKU list, accepts it deliberately
for this Albarán, optionally keeps it in Products as an uncoded sale item, and later returns from
its request history to the exact original line without losing their Products context. The journey
creates no automatic SKU, stock, price, tariff, ERP record, customer alias or outbound message.

### Exact journey

1. The off-SKU line is grey italic and is bounded as one line. The operator chooses **Accept once**,
   **Edit** or **Reject**. Accept records line-specific evidence only; a repeat phrase remains a
   repeat phrase, not a product master.
2. From the accepted line/history action, **Keep in Products** is an explicit second decision. The
   resulting Uncoded sale item displays literal wording/unit, Internal category when reviewed, direct
   Related products and **Requested personalisations**. It visibly identifies itself as uncoded and
   never receives artwork because it has no coded SKU.
3. The operator may add a direct relation to a coded or uncoded existing record only through the
   deliberate relation editor. Category/group co-members, spelling similarity and the same customer
   cannot create a relation.
4. Opening a Request row enters its exact Albarán and focuses the cited line/source scope. Back
   restores the selected Products filters, sheet and scroll anchor. If that context is no longer
   authorized/available, it safely returns to the exact Uncoded sale-item sheet.
5. A later **Assign SKU** proposal, if separately enabled, shows source/history/relations and
   requires a reviewed destination; it preserves the uncoded record's historic evidence. In the
   order-review profile it is unavailable.

### Required proof

- Exact/off-SKU/choice/quantity-concern fixtures prove the three distinct states and only scoped red
  targets; a free-text dismissal and relevant edit/send re-evaluation are visible in full Albarán
  and condensed Messages card.
- An uncoded record fixture proves explicit admission, mixed Products filtering, literal unit,
  direct cross-kind relation, exact Requested-personalisations deep-link and Browser/visible Back restoration.
- Permission, stale return-token, reload and archive fixtures prove no hidden promotion, no lost
  historical line and no generic-catalogue return. Evidence is captured at all six named viewports.

## JNY-11 — Phone order correction and compact-list recovery

**Purpose.** An operator scans a dense day, opens one Albarán, corrects a long product/quantity line with software keyboard visible, moves to next document with their thumb, then returns to exact list context. The route stays reliable when rows grow from genuine product detail.

### Exact journey

1. Operator scans Sales or Messages. Each record sits in its rounded inset hit area; hover/focus/current paint that object only. Visible order card states operational facts only: customer, delivery day/document, line count, source/run/work state. It shows no euro value under active profile.
2. They open the only row destination. Every product line reads exact illustration → literal name/relevant detail → one right-aligned quantity/unit fact. A long note/class wraps below title, increasing only that row's height while terminal fact remains aligned.
3. Quantity uncertainty wraps only quantity field in red with concise note above. Product tie presents question/product hybrid; off-SKU is grey italic with Accept once/Edit/Reject. One scoped resolution creates no price, SKU, stock movement or customer message.
4. On phone, visual viewport contracts, field/current value and Save remain visible, and scroll reserves bottom previous/next dock. They save or retain draft, then use 48 px bottom **Next delivery note**. Position changes without losing result set. Header Back stays distinct 48 px control.
5. Back returns to former filter/scroll/selected-card context. Inset current shape remains visible. If authorization/revision change makes route unavailable, existing safe return applies rather than nearest unrelated list row.

### Required proof

- 1366×768, 1536×864, 390×844 and 393×873 capture transparent outer lists, gutters, hover/current/focus, unvalued order card, long wrapped product, exact field/choice/off-SKU forms, product imagery and aligned terminal unit.
- 360×800, 390×844 and 393×873 keyboard traces show focused edit/current value/Save or Next above visual viewport and no footer/dock overlap. End-of-set navigation, Back/Forward, cancel/retry and reload preserve or safely recover route context.
- Assertions reject euro amounts in compact order/history/list cards, full-width hover paint, repeated Quantity/Unit headers, horizontal overflow, hidden applied-filter changes and row press opening nested customer/source destination.

## JNY-12 — One applied Export scope from filter to output attempt

**Purpose.** Operator narrows daily output without a filter wall, selects a saved copy or a gallery template to configure as a saved copy, and creates one truthful Print, Email or Files request from applied scope.

1. They open shared centred **Export center** from navbar, Sales or Albarán. Header shows current scope and one **Filters** trigger, then **Print**, **Email** and **Files** destinations. Template/saved-copy/paper objects use inset rounded cards; no full-width row or nested action silently changes scope.
2. Each destination opens its responsive **Saved copies** grid. **Templates** opens only recipes compatible with the active destination; changing destination never exposes a Print/File recipe as an Email recipe or mutates another destination’s saved copy. In Email, **Subcontractor delivery pack** and **Daily albaranes to accounting** are the initial examples; **Build your own with Copilot** makes a reviewable user-owned proposal, never an implicit send. **Use template** configures an independent saved copy with source template/version, destination, scope chips, permitted fields/columns, settings and connection profile; it is not an earlier output attempt. Email opens recipient/channel/revision/schedule review, exposes Send history outside the editor, and scheduled Email exposes its next run/history plus Edit/Pause/Resume/Remove schedule. Files opens current-data file setup.
3. They open Filters: desktop popover or phone bottom sheet. Day, salesperson, period and scope are labelled draft choices. Preview/count remains previous applied scope while draft changes.
4. **Apply** changes summary/count/preview together. **Clear** restores all-day/default. Close/Back without Apply drops draft. Choosing a saved copy, or using a contained template to configure one, and a Print, Email or Files action captures applied scope only.
5. Activity truthfully records requested browser print, email request or download and actor/time/capture. It never treats filter application, dialog closure, afterprint or download start as physical output success, email acceptance or delivery.

### Required proof

- Desktop/phone filter-open captures, draft-vs-applied assertion, Clear/default, denied/stale scope, route return and output-capture scope tests.
- Visual review rejects parallel chip walls, hard-coded-looking full-modal templates, favourite toggles standing in for saved-copy configuration, scope drift, tiny click targets and cards with full-width hover paint. It also rejects an Email destination hidden in Connections, a direct Print/Activity/Flag/Archive action inside a three-dot menu, and a template/saved-copy action that mutates output history.

## JNY-13 — Morning tariffs to customer discount and reliable Albarán

**Purpose.** An operator updates prices quickly, gives one customer a temporary reduction, verifies
the open Albarán, then releases the reduction without corrupting the tariff or issued history.

1. **Choose the workspace posture.** An owner enables Pricing in App settings. Product, Customer,
   Stock and Albarán projections update from that same persisted capability; no AI grant or print
   preference is changed.
2. **Correct one price on desktop.** From an exact Product Sheet, the operator types in a tariff
   card. Enter validates and appends one exact SKU/tariff revision, then focuses the next card. A
   stale/invalid/failed value stays in place for repair.
3. **Run the morning matrix on phone.** **Update prices** opens on the current/first target. All
   tariffs remain visible, one is outlined, decimal input stays focused, and thumb Previous/Next
   walks tariff then product. The closing reading lists every accepted revision and supports Undo.
4. **Assign the account.** A multi-tariff customer chooses one named tariff. A one-tariff tenant
   has no meaningless selector. An exact-SKU customer price, if added, remains a separate revision
   that supersedes the assigned tariff only for that SKU.
5. **Schedule a temporary discount.** Customer → Pricing → **Temporary discount** records percentage,
   start and release dates. Current/upcoming state and History are visible. It never rewrites tariff
   or customer-SKU price rows.
6. **Resolve the open Albarán.** For an unprinted, unpinned line the resolver applies exact-SKU
   customer price or assigned tariff, then the active account discount, then exact Unit factor.
   A manual line price remains deliberate; a printed document reads its frozen money snapshot.
7. **Release and recover.** **Release** ends the agreement and immediately exposes the underlying
   price. History retains creator/time/schedule/release. Releasing never writes an inverse tariff
   change. Disabling Pricing hides working money UI while retaining all records.

| Boundary | Required behavior |
|---|---|
| Invalid percentage/date overlap | Keep editor and draft; no agreement event. Server rejects ≤0, ≥100, missing/reversed dates and unauthorized overlap policy. |
| Concurrent tariff/customer-price edit | Expected revision conflict identifies exact SKU/tariff/customer source and retains typed value. No last-write-wins concealment. |
| Discount starts later or has ended | Show Scheduled or historic state; current Albarán price remains underlying value. |
| Price changed after printing | Issued/printed snapshot remains unchanged. Deliberate reissue creates linked output revision under Output rules. |
| Capability disabled | No working price action or value leaks into Product/Customer/Albarán; data and audit history remain durable. |
| Offline/command unknown | Preserve idempotency key and draft, show requested/unknown truthfully, and reconcile before retry. |

Required proof is `drive-191-pricing-matrix.py`: desktop inline/Enter advancement; mobile all-visible
matrix, focus, rotating stat and 56 px controls; one-tariff collapse; scheduled discount affecting an
open Albarán then releasing exactly; and persisted Pricing off/on with no ledger loss. Production
completion additionally requires server conflict, permission, offline/idempotency, timezone boundary
and issued-document fixtures.
