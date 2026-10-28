# Cedar collection API contract

## Selected runtime

[The launcher](runtime/__main__.py) serves [cedar_service.py](runtime/cedar_service.py) and [cedar_store.py](runtime/cedar_store.py). Cedar owns the Money interface and synthetic source documents. This service owns persistent collection ledgers, private buyer links, operator-controlled provider connections and document submission. Yape/Plin payments go to the seller's configured destination; Prometeo reads account evidence; NubeFact submits electronic documents. The earlier gateway service and adapters remain historical source/test coverage, outside the default routes and operator interface.

## Authority and persistence

- `POST /api/cedar/workspaces {}` returns `{id, token, mode:"sample"}`. The random bearer token controls that synthetic workspace only. The store hashes capabilities and encrypts workspace payloads with the service Fernet key.
- Owner routes require `Authorization: Bearer <workspace token>`. Operator routes require the separate private service token. Provider credentials, session keys and full account identifiers remain operator/server data. Owners receive their own bounded movement feed and fiscal projections.
- Buyer capabilities reveal only their document, current balance, masked configured destination and a restricted receipt timeline. Public buyer routes read, with one exception: `POST /collect/{id}/{token}/approve` records the payment the checkout's own act makes, and it answers only while the workspace's bank is Cedar's own seed. QR bytes require the same valid capability.
- SQLite `BEGIN IMMEDIATE` transactions protect request creation, opening receipt imports, idempotency and allocation. State lives in `cedar.sqlite`; historical gateway records remain in their own database.
- Exact configured origins control CORS. Request/body/workspace capacity and expiring rate limits bound the anonymous synthetic entry. Live provider access is explicitly configured and defaults disabled.

## Owner routes

`POST /api/cedar/requests` accepts:

```text
invoice_id, document_id, seller_name, seller_ruc?, customer_name?, description,
invoice_amount_minor, amount_minor, currency:PEN,
receiving_bank:bbva|interbank|scotiabank, account_label, reference,
idempotency_key, sample_clock?, initial_receipts?[], billing_draft?
```

Amounts are strict integer minor units. `invoice_amount_minor` is the immutable document total; `balance_minor` is its remaining principal; `amount_minor` is the server-owned cash quote, with 0–99 extra cents held as `rounding_minor`. A quote is reserved atomically and carries a `quote_id`; [the exact-amount contract](../cedar/PAYMENTS-SPEC.md#exact-payment-amounts-250) defines rotation, lifetime reservations and reference-required exhaustion recovery. `invoice_id` can identify a commercial billing draft before a fiscal invoice exists. One workspace/billing document has one persistent request and buyer URL. A refreshed link reuses that ledger, so an earlier link shows the current outstanding. The collection reference is the document's own number as a person reads it — the issued invoice's number, or the Delivery Note's number while a billing draft waits for one — unique within the workspace and frozen with the request. A second payment on the same document records its receipt under that number plus a two-digit suffix (`F001-00000002-02`). Document/seller/RUC/currency/total/reference/receiving-bank and optional billing snapshot bindings remain immutable. Existing sample invoices without a snapshot cannot acquire one through a refreshed request.

Opening receipts apply once in the creation transaction; their matched principal sum (cash minus optional `rounding_minor`) must reconcile total to remaining amount. An exact idempotency replay returns the same request without reapplying receipts. A changed snapshot under the same key conflicts. Later receipts use `POST /api/cedar/requests/{id}/receipts` with `amount_minor,currency,reference,method,source,created_at?`; owner-controlled sources are `sample` or `manual`. Once a live destination is bound, sample writes are refused for that request.

`GET /api/cedar/requests` and `GET /api/cedar/requests/{id}` return the stored document binding, `buyer_url`, receipt list, and current totals: `balance_minor`, `sample_minor`, `manual_minor`, `confirmed_minor`, plus `pending|partial|paid`. Only authenticated live Prometeo receipts contribute to `confirmed_minor`. A paid ledger backed by examples/manual entries preserves those sources. Currency or overpayment mismatches stay in review and do not reduce the balance. The same receipt reference cannot allocate twice through another request or source.

`sample_clock` anchors synthetic events to Cedar's retained scenario date; default subsequent receipt times advance from it. `received_at` records server arrival separately. Real bank evidence retains the provider date.

`GET/POST /api/cedar/setup` reads/writes synthetic setup fields. `GET /api/cedar/bank` returns `ready:false` until the operator selects an authenticated account, then its masked account, balance, currency, source, provider environment and observation time.

`GET /api/cedar/bank/movements` returns `{ready,mode,as_of,movements}` for the authorized workspace. Rows expose `id,source:prometeo,mode,date,detail,reference,currency,account_mask,debit_minor,credit_minor,allocated_minor,unallocated_minor,status,reason,request_id,invoice_id,document_id,payer_name?,match_key?`. The explicit bank payer name is review context; `match_key` records reference or amount. Dates use `YYYY-MM-DD`; detail/reference are bounded to 500/120 characters. Account numbers, session credentials and opaque provider extra data stay private. `POST /api/cedar/bank/match {movement_id,request_id}` retries a live movement under the same exact association contract and returns the full owner request. A workspace cannot see or allocate another workspace's evidence.

### Billing draft and fiscal owner actions

New billing documents can include the immutable normalized `billing_draft`:

```text
version:1, origin:cedar-draft, customer_id, customer_name, customer_ruc,
customer_address, seller_name, seller_ruc, series:Fxxx, issued_date, due_date,
currency:PEN, source_currency:EUR|PEN, source_total_minor, fx_rate:decimal-string,
tax_rate:0|18, net_minor, tax_minor, total_minor,
lines:[{id,description,quantity:decimal-string,unit,total_minor}]
```

Party/amount/currency bindings and unique line IDs are checked on creation. Billing snapshot version 2 is the current Cedar contract and requires a PEN source with `fx_rate:1`; version 1 retains delayed collection creation for stored EUR-source drafts. Line totals, net/tax totals and every recorded conversion must conserve the document total. The server allocates line net/tax rounding deterministically. Invoice addresses and unit mappings are checked before fiscal authorization; a zero-tax document requires the operator's explicit exempt/unaffected classification.

Owner request reads add `fiscal`: `phase`, nullable `mode`, `payment_requirement:confirmed`, `can_issue`, `can_query`, and available `record_id,series,number,draft_fingerprint,authorized_at,checked_at,error,accepted_by_sunat,voided,issue_date,issue_date_policy`. Optional fields are omitted when absent; `mode` and `issue_date` explicitly permit null. Phases are `unprepared`, `awaiting-authorization`, `authorized`, `submitting`, `query-required`, `pending`, `accepted`, `rejected` and `voided`. Public buyer reads contain the payment timeline, excluding billing/fiscal detail.

`POST /api/cedar/requests/{id}/invoice {}` submits the server's reviewed, reserved draft; `/invoice/query {}` queries that same fiscal identity. Both return the complete owner request. Provider configuration alone grants neither action. Issuance requires per-document operator authorization and `confirmed_minor == invoice_amount_minor`; sample/manual paid claims do not meet that gate. The issue date is the Lima calendar date when the first submission is claimed, under the reviewed `server-on-first-submission` policy. That date, final payload and number are persisted atomically before HTTP. Subsequent queries/recovery preserve them. The source's commercial preparation/due dates remain in the billing snapshot.

## Buyer routes and destination

`GET /collect/{id}/{token}` opens the buyer's Yape approval-code checkout in Spanish; `/status` returns its scoped snapshot and `/qr` serves its configured raster. The page polls the current balance, presents separate receipt evidence and stops polling at a covered balance.

### The checkout

The card carries the amount and the order's own number, the Yape mark, «Ingresa tu celular Yape» behind its `+51`, six single-character approval-code boxes that a pasted code fills at once and the arrow keys walk, «Encuéntralo en el menú de Yape.», and one act reading «Yapear S/ 149.90». A valid nine-digit phone and a six-digit code enable the act; under it the page states the order and the seller. The seller's own QR stands behind a second act, «Pagar con QR», wherever a destination is configured. The page states its amounts in tabular figures with the unit on the number's line, keeps 44 px seats down to a 320 px viewport, and honours `prefers-reduced-motion`. Its palette lives in CSS custom properties at the top of `cedar-buyer.css`, outside the app's theme, because the wallet's own purple belongs to the wallet.

`POST /collect/{id}/{token}/approve` accepts `{phone: 9########, code: ######, quote_id}` under the buyer capability. It answers `409 wallet_app_completes_payment` for a workspace holding a commissioned Prometeo account, a bound live destination or a commissioned request — a real payment comes from the buyer's own Yape app, and the page states that — and `429 retry_later` after eight attempts on one request id inside a minute. In sample mode it verifies the current quote identity (a changed quote answers `409 payment_quote_changed`) and records its exact cash amount plus separate rounding as one receipt with `source: sample`, `method: yape` and the order's own reference, and returns the buyer snapshot. The same request, phone and code arriving again record one payment; a request with 50 recorded approvals answers `receipt_capacity`. The status snapshot carries `approval_code`, the boolean the page reads to know which of the two routes completes this payment. The day Izipay is commissioned this route posts the same pair to the processor's Yape-code flow and everything above it is unchanged.

`POST /api/operator/workspaces/{id}/destination` accepts `method:yape|plin`, exact selected `account_number`, `currency:PEN`, optional nine-digit Peruvian `phone`, `qr_base64`, `account_ownership_confirmed:true`, explicit `request_ids`, and `real_documents_confirmed:true`. This requires a commissioned live Prometeo connection and selected account. PNG/JPEG input is capped at 128 KB and 128–2048 pixels per dimension, decoded and re-encoded without metadata. A destination is immutable once configured and attaches only to the operator-selected, reviewed request IDs with matching accounts and an empty receipt ledger. New requests remain sample until separately commissioned. A changed receiving account never rewrites existing request/destination bindings. The operator must verify QR ownership; image validation does not establish the encoded recipient's identity. Unconfigured pages present an explicit example request. The interface invents neither wallet links nor QR payment payloads.

## Operator bank and invoice routes

All routes below are under `/api/operator/workspaces/{id}` and require operator authorization:

| Route | Contract |
| --- | --- |
| `POST /providers` | Prometeo `api_key`; NubeFact `api_url,token,seller_ruc`, with explicit sandbox/live environment. Existing bindings are immutable. |
| `POST /bank/login` | Provider, username, password, optional challenge fields and resume flag. Returns authentication phase, excluding session key. |
| `GET /bank/clients`, `POST /bank/client` | Resolve provider-required business client selection. |
| `GET /bank/accounts`, `POST /bank/select-account` | Read authenticated accounts; select exact account number and currency. |
| `POST /bank/movements` | Read account movements for a bounded date range, authenticate account membership, persist source evidence and attempt exact allocation. |
| `POST /bank/match` | Retry an explicit movement/request association under the same strict contract. |
| `POST /bank/monitor` | Explicitly enable/disable commissioned live account monitoring; interval 300–3600 seconds. |
| `POST /bank/logout` | End provider session and clear the saved key. |
| `POST /invoices` | Reserve document identity and frozen payload before one NubeFact submission. |
| `POST /invoices/{record_id}/query` | Query that same reserved document identity. |
| `POST /invoices/commission` | Bind a seller/series counter with `seller_ruc,series,next_number,unit_codes`, explicit seller authorization and exclusive numbering confirmation. |
| `POST /requests/{request_id}/invoice/authorize` | Approve the exact `draft_fingerprint`, confirm seller/real-document authority, select optional zero-tax classification, and explicitly enable optional `auto_issue_after_payment`. |

Movement identity includes workspace, provider, account, currency and provider movement ID. Automatic allocation requires one request matching the immutable account number and currency, then either its stated bank reference or, for an empty reference, its one current unique cash quote. The movement has zero debit and a positive credit whose principal fits the remaining balance. Reference-free evidence must reach the quote’s Peru calendar date. Wrong stated references retain their own matching key. Partial credits reduce the remaining balance; a whole movement is allocated once to one document. The allocated plus unallocated amount equals its original credit. Live allocation also requires explicit request commissioning through destination or fiscal document review. Keys and account selection alone keep an unpaid example uncommissioned. Duplicate reads preserve one allocation. Reference/detail strings establish neither payer identity nor invoice association by themselves. Excess, ambiguous, changed and mismatched evidence stays in review. Static merchant QR reference propagation must be proved with the real wallet/bank integration.

Enabled bank monitors are indexed by due time in SQLite. The lifespan worker polls at five-second ticks, takes up to ten due jobs with concurrency capped at three, and uses per-workspace session locks plus a durable 90-second job lease. Each bounded run reads a rolling seven-day window through the same authenticated movement path, refreshes the selected balance/observation time, and records its outcome. A run times out after 50 seconds; transient errors back off up to one hour, while expired authorization or disabled live access pauses monitoring. Shutdown cancels workers cleanly; restart resumes due jobs from the index. Default synthetic workspaces and disabled live access perform zero background provider calls.

NubeFact seller identity, amount and PEN currency must match the source request and commissioned route. A protected counter reserves the fiscal number during document authorization. A SQLite uniqueness boundary assigns each live seller/series to one workspace; the operator confirms its exclusive use across external systems. Normalized drafts generate the provider payload server-side. The earlier raw-payload operator submission remains available for historical sandbox experiments; live use requires the same authorized record and frozen payload as owner issuance.

Optional automatic issuance uses a durable index of authorized, fully confirmed records, with three concurrent workers and bounded batches of ten. A restart before the HTTP claim resumes that work. A persisted `submitting` claim stays query-only after a crash; it never resends blindly. Commissioning failures defer the pending job for five minutes. Exact repeats return the existing record. Provider `aceptada_por_sunat:true` records acceptance; false without additional evidence remains pending. Authenticated annulment records `voided`; contradictory later responses cannot undo accepted/voided state. Documented provider codes 20/22 record rejection and require correction review; code 23 (already-existing number) requires identity review because an identity-only query cannot prove the prior document's customer/amount. Other uncertain results preserve the number for query. SUNAT error evidence remains visible as a review state. Acceptance and payment stay separate. Provider links remain internal metadata, and the service performs no buyer email dispatch.

## Evidence and commissioning

Local browser and HTTP proofs exercise actual persistence, capabilities, buyer polling, duplicate handling, account binding and uncertain invoice recovery with fixture provider responses. A production claim additionally needs commissioned seller/provider contracts, actual authentication, verified recipient/payment evidence, confirmed bank reference behavior, seller authorization and accepted SUNAT documents. [Setup and verification commands](README.md).

## Automatic order collection owner actions

`POST /api/cedar/requests` accepts an optional `commercial_document` version1/origin`cedar-order` with
seller name, customer ID/name, document number, PEN total and priced `DraftLine` goods. Its line sum,
identity, total and reference must exactly match the request. This commercial collection precedes
fiscal preparation. `POST /api/cedar/requests/batch` takes `{requests:[...]}` with1–25 inputs, validates
all inputs first and commits the group in one encrypted workspace mutation. Existing idempotency and
immutable document guards apply to every member. Capacity is2000 requests/10000 receipts per workspace,
subject to the existing encrypted size limit.

`POST /api/cedar/requests/{id}/commercial-document` takes `{expected_fingerprint,commercial_document}`.
It preserves order/customer/currency identity and received principal, validates the prior fingerprint,
and requires a commercial request preceding fiscal preparation and commissioning. The returned owner
snapshot includes `commercial_fingerprint`. `POST /api/cedar/requests/{id}/billing-draft` takes the
reviewed `{billing_draft}` and validates the same identity, total and goods before attachment. The
existing fiscal authorization and provider submission guards govern the attached draft.

`POST /api/cedar/requests/{id}/dispatch` takes `{by:"auto"|"manual"}`. A manual action records native
merchant-authored evidence. Exact customer-channel text, first contact and subsequent send records
are owned by the browser Money ledger and restored into the existing customer-conversation seam.
This endpoint records the owner action boundary; external provider delivery needs its owning transport.

`POST /api/cedar/workspace/fixture-rollover` takes `{from_day,to_day}` on the sample runtime. It rotates
a wholly fixture-owned pristine workspace atomically, preserves old encrypted evidence, closes old
public payment capabilities and returns the replacement owner binding. The same old-workspace/day pair
is idempotent. Provider/destination/fiscal commissioning, manual sends, commercial revisions and
post-opening receipts retain the existing workspace. The browser independently checks its fixture
signature and authored chase evidence before requesting rotation.
