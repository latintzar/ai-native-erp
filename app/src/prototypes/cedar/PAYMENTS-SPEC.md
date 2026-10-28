# Cedar payment requests and reconciliation

## Ownership and intent

This exploration belongs to the [Cedar prototype](README.md), following Peter's
[September 9 direction](../../../../docs/FEED-IA.md#225). From an existing order, delivery note
or invoice, Rocoto issues a payment request with a known document association. The buyer pays using
Yape, Plin or an interoperable payment flow. Authenticated payment evidence updates the originating
document automatically. The preferred route is fee-free and gives sellers the easiest available setup.

Cedar owns its UI, supporting API, persistent state and seeded scenario. The [supporting service](../copper/README.md) retains its existing source and commissioned development target. Its [service contract](../copper/SPEC.md) describes authorization, provider transport, matching and recovery.

## Current implementation

The [Money specification](MONEY-SPEC.md) defines the dashboard, nested invoice/payment records and crosslinks to Sales. [Onboarding](ONBOARDING-SPEC.md) collects business details and order channels, then reuses the payment and invoice connection flows. Pricing starts enabled; stock starts disabled. Settings reopens the same setup bodies.

The selected route is direct Yape/Plin collection, Prometeo account reads and transaction validation, and NubeFact invoicing. The [browser client](money-api.ts) creates document-bound requests in the [native API](../copper/runtime/cedar_service.py), then imports receipt and authorized fiscal updates into the shared workspace ledger. Every collectible priced order automatically preserves its document-number payment reference before fiscal preparation. A separately reviewed fiscal draft attaches to the exact commercial goods and total. NubeFact assigns its own seller-series number after explicit commissioning and draft authorization. Public buyer pages query their own remaining balance. Sample, manual and verified bank evidence retain distinct sources. An operator commissions the merchant payment destination and provider access.

The default local preview can run from scoped fixtures. The declared public development preview uses the persistent API target in [money-runtime.json](money-runtime.json). The integration drive proves this connection through real local HTTP and isolated SQLite, including separate buyer/seller contexts, reload and service reconstruction. Prometeo/NubeFact clients and operator commands are implemented; actual external account and payment evidence remains a commissioning step. Legacy processor experiments remain historical source and are absent from the default Cedar routes.

## Proposed Cedar flow

1. Select the seller's permitted payment connection and an existing order or document. Preserve
   its Cedar identity, seller, amount and currency in an immutable payment request before issuing
   the buyer link or QR.
2. Present the supported Yape/Plin or interoperable payment route. Record the provider's actual
   setup prerequisites and commercial terms with the selected connection.
3. Receive authenticated payment notifications and recover missed notifications through an
   authoritative query. Match the seller, request reference, amount and currency before recording
   a confirmed payment on the originating Cedar document.
4. Preserve the confirmation source, provider or bank payment ID, timestamps and document
   association in payment history. Duplicate deliveries have one effect; refunds and reversals
   remain linked to the original payment. Additional or ambiguous payments require review.

Provider-confirmed payment evidence needs an explicit source in Cedar's model, alongside the
existing person-recorded payment history. Payment state remains a separate facet from fulfilment.
Creation timeouts retain the same request for recovery; confirmation and allocation must survive
restarts before the flow is described as wired.

## The reference is the order's own number

> «WHy is the immudable reference CEDAR0named??? it's a payment for an order. lol.»
> — Peter, 14 September 2026 ([FEED-IA §252](../../../../docs/FEED-IA.md))

A buyer types this string into a wallet and a bank statement carries it back, so it is the number
printed on the document that buyer holds.

- **What it reads.** `paymentReference(invoice)` in [money-model.ts](money-model.ts): the issued
  invoice's own number (`F001-00000123`), and the Delivery Note's number (`1409-114`) while a
  billing draft still carries the internal `PAY-…` placeholder. Once NubeFact accepts a draft, the
  fiscal number is what a person reads and what the builder answers.
- **Where it is frozen.** [money-api.ts](money-api.ts) sends it as the request's `reference` when
  the collection request is created; the service stores it among the immutable bindings, so the
  reference a request is created with is the reference it keeps.
- **Uniqueness.** One reference allocates once inside a workspace. The seeded book states each
  reference in [fixtures/money-v1.json](fixtures/money-v1.json) and `test-money-seed.mjs` holds
  each of those 72 values to the builder, so the file and the code cannot drift. A second payment
  on the same document records its receipt under the number plus a two-digit suffix
  (`F001-00000002-02`), which is the only shape the allocator ever adds.
- **Two matching keys.** The bank monitor and owner recheck match the exact account and currency,
  then the stated reference or, when the bank supplies an empty reference, the current exact amount.

## Exact payment amounts (§250)

The service reserves an exact cash amount under the same SQLite transaction that creates or updates
the request. `invoice_amount_minor` stays the commercial principal. `balance_minor` is its remaining
principal; `amount_minor` is that balance plus `rounding_minor` (0–99 cents). The buyer sees
**Paga exactamente**, the exact cash total, and **Pedido / Redondeo** separately. A receipt records
actual cash and its rounding separately; invoice settlement and the fiscal payload use principal.
Merchant receipt history shows the same split.
`sample_received_minor`, `manual_received_minor` and `confirmed_received_minor` expose actual cash
for the buyer's receipt summary; the corresponding principal totals retain their fiscal meaning.

Each quote has a `quote_id`. The buyer submits it with the phone and approval code; a changed quote
returns `payment_quote_changed` and the page refreshes the payable total. A partial receipt reduces
principal and reserves a new quote. Retries and restarts retain the request, quote and receipt identity.

Issued amounts remain reserved within the workspace and currency for their lifetime, including paid
and superseded quotes. This conservative reservation makes late transfers reviewable against their
original request. A new request whose 100-cent window is occupied returns `unique_amount_exhausted`
atomically. An already accepted partial receipt stays recorded: its remaining principal receives a
versioned `reference-required` quote. Any colliding issued amount also becomes reference-required.
Those requests remain payable through their exact reference or authenticated buyer link. Reclaiming
historical reservations requires a separately proven settlement-expiry policy.

Reference matching accepts a positive incoming credit whose principal fits the remaining balance.
An empty reference can use exactly one current, unique quote on the bound account and currency;
the movement's bank date must reach the quote's Peru calendar date. A stated reference selects only
its own key. Currency/account mismatches, debits, oversized principal, superseded amounts and ambiguous
evidence stay in Review. Provider mode, authorized bank reads and commissioned-document guards still
apply. The provider's explicit payer name appears only as merchant review context. The owner feed
states **Matched by: Exact amount** when that key succeeded.
Bank evidence here has day precision; distinguishing an earlier transfer on the same calendar day
remains part of the commissioned provider's timing proof.

The [native tests](../copper/tests/test_cedar_amounts.py) cover concurrent allocation, restart,
exhaustion, partial requoting, late/ambiguous evidence, all matching guards and unchanged fiscal
principal. The [browser drive](../../../../drives/drive-cedar-unique-amount.py) walks the local HTTP
buyer flow at 1600, 390 and 320; model/API/store tests preserve actual cash and rounding through
import, duplicate polling and browser reload.

## The buyer's checkout

> «can we just clone that and serve the links in our own demo domain as a new tab that goes through
> the motions? would make this all super more real»  — Peter, 14 September 2026

The payment link opens Cedar's own Yape approval-code checkout on the collection service's domain,
in a new tab, and goes through the motions.

- **The page.** `GET /collect/{id}/{token}` — the amount and the order's number at the top, the
  Yape mark, «Ingresa tu celular Yape» behind its `+51`, six single-character approval-code boxes,
  «Encuéntralo en el menú de Yape.», one act «Yapear S/ 149.90» that stands once both fields are
  valid, and under it «Pago para el pedido 1409-114 · <seller>». The seller's own QR stands behind
  a second act, «Pagar con QR». Source: [cedar-buyer.html](../copper/runtime/web/cedar-buyer.html)
  and its stylesheet and script beside it; the page is Spanish-source because it is served to a
  Peruvian buyer by the service rather than rendered from Cedar's snapshot tables.
- **The act.** `POST /collect/{id}/{token}/approve` with `{phone, code, quote_id}` — the one public write,
  rate-limited per request id, idempotent on request, phone and code. In sample mode the service
  records the current exact quote as one receipt (`source: sample`, `method: yape`, the order's own
  reference) and answers the new status; a workspace with its own commissioned account answers 409
  and the page states that Yape's app completes the payment. The contract is in the
  [service spec](../copper/SPEC.md#the-checkout).
- **The merchant receipt loop.** `CollectionSync` polls one owner request-updates cursor every five
  seconds; the receipt imports through `importCollection` and the order reads **Paid** within one
  poll. Provenance stays in the data (`source: sample` on the receipt), out of the buyer's words.
- **Commissioning.** The day Izipay is commissioned the same page posts the same phone and code to
  the processor's Yape-code flow, and the page, the reference and the merchant's side are unchanged.
- **Proof.** [drives/drive-cedar-order-payments.py](../../../../drives/drive-cedar-order-payments.py) walks the
  merchant's Cedar and the buyer's tab in two browser contexts at 1600, 390 and 320; the runtime
  tests in [test_cedar_native.py](../copper/tests/test_cedar_native.py) hold the route's sample-mode
  gate, idempotency, rate limit and token check.

## Payment route and fees

Yape, Plin and their interoperable routes define the current research scope. Prefer a fee-free
route; assess direct wallet access and bank QR, collection and notification services alongside the
existing provider adapters. A working payment page, interoperable QR and automated reconciliation
each need their own evidence for the selected account and service combination.

The acceptance record must identify transaction commissions, setup or recurring fees, settlement
or withdrawal charges, who pays each charge, seller prerequisites and delegated access. Establish
that a usable payment reference reaches the confirmation/query response and supports seller-specific
reconciliation. A fee-free end-to-end route remains under investigation. Bank-specific integration
and Plin acceptance each require an implemented adapter and an exercised provider flow.

## Access and acceptance

A trial uses an account Peter explicitly selects, including his own account. Company Operations
records the actual owner, consuming service, environment and permitted operations and external
effects. Authentic records stay private and credentials remain in the selected consumer's
configuration. Provider eligibility and any commercial approval apply to that selected account.

Prove an existing Cedar document produces its own request, an authenticated payment updates that
same document automatically, duplicates remain idempotent, mismatches retain review, and a missing
callback is recovered. Preserve evidence through restart and exercise a reversal. Record the
request, document, seller/environment, provider payment ID, callback, matching result, fees and
funds destination. Fixture proofs, provider sandbox evidence, controlled live payment evidence and
product release acceptance remain separate records.

## Implemented evidence path

The bank monitor and owner recheck share the two-key allocator above: exact account/currency, a stated reference or current unique amount, one positive movement, and principal at or below the outstanding balance. A partial movement reduces the balance once; oversized principal and ambiguous evidence remain in the owner-visible review feed. Money charts actual bank cash and links each allocated movement to its request, commercial document and Delivery Note.

A seller-approved immutable billing snapshot carries customer RUC/address, line quantities/units, source currency/conversion, totals and tax. Commissioning binds the issuer and fiscal numbering; per-draft authorization fixes the payload fingerprint. Once the complete amount is confirmed by authenticated Prometeo evidence, the service submits the reserved NubeFact document. Lost responses recover by querying that same series and number. Owner views show the resulting fiscal state separately from payment. Sample invoices retain sample acceptance and cannot acquire a live issuable snapshot later.

A static seller QR and a Cedar link alone do not establish that the wallet transfer carries Cedar's reference. The live account pilot must prove that reference in the bank response before claiming automatic wallet-to-document correlation. Current provider fixtures prove the strict allocator and invoice transition; account coverage, fees and real transfer propagation remain explicit commissioning evidence.

## Automatic dispatch and commercial documents

The [Money lifecycle](MONEY-SPEC.md#order-owned-payment-lifecycle--gap-item-2-15-september-2026)
owns automatic order registration, first contact at delivery, timing policy, explicit holds,
reviewed commercial changes, reminder scheduling and durable customer-conversation rows. The native
commercial document binds seller/customer identity, priced lines, PEN total and the actual order
reference. Owner bulk creation is atomic per25 documents; attachment of fiscal details requires the
same commercial snapshot. The published checkout drive selects the declared sample runtime only with
`ROCOTO_PUBLISHED=1`; isolated runs use the same native routes with fresh local SQLite state.

### Buyer order identity and receipt time (FEED-IA §257.1)

The checkout URL binds the order before the buyer opens it. The order reference remains a plain
order detail, and approval submits only the buyer's phone and approval code. Its header serves the
product's checked-in `app/public/brand/rocoto-mark.svg`; the runtime copy is byte-verified in the
native checkout test. The mark's home link occupies44px in each dimension.

Public receipt timeline rows add `effective_at`: a provider receipt keeps bank booking time, an
opening fixture receipt keeps its ledger time, and a new sample/manual receipt uses the native
`received_at`. Owner `created_at` keeps the original ledger clock. Buyer history and the paid receipt
format that effective instant in America/Lima, matching the merchant's receipt arrival.

Commercial order revisions refresh the remaining-principal quote inside the same workspace transaction.
The revision response carries the new quote immediately; earlier quote identifiers remain stale,
and issued amounts stay reserved. Idempotent revisions retain their existing quote. Batch creation
uses the same allocator and preserves receipt principal, rounding and original arrival clocks.

Reading a predecessor link reserves its formerly displayed face amount and remaining principal
before quote history initializes, including paid links. This keeps a later unreferenced transfer
from inheriting another order. Native quote hydration stays outside the fixture-authorship
signature; conversion metrics count receipt principal, while cash views retain actual cash.
