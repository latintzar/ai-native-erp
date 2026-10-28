# Rocoto ERP proof plan: two self-serve workflow labs

**Checked:** 2026-08-31. **Purpose:** learn and commit to an export design through safe, repeatable test tenants. This is deliberately not a logo shortlist, not an integration claim, and not accounting/tax guidance. The companion [fixtures](erp-proof-fixtures.json) contain nine fictional records only; none has been sent to an ERP.

## Decision: run only these two labs first

| Lab | Why it earns a test slot | What has been inspected | What has not happened |
|---|---|---|---|
| **Bsale Chile sandbox** | Self-service API sandbox account with email validation; developer docs say an account can obtain a sandbox `access_token`, but do not state its duration. It has public REST resource schemas, price-list update, stock receipt, order/dispatch document and `salesId` duplicate protection. [Sandbox signup](https://account.bsale.dev/users/create) [Sandbox/auth](https://docs.bsale.dev/get-started/) | API schemas/routes cited below, including Chile-specific data model. | No account, token, request, write, tax enrollment or live fiscal document. |
| **ERPNext on Frappe Cloud** | 14-day self-serve trial, public generic CRUD API, deliberately inspectable DocType metadata, and strongest documented food workflow: UOM conversion, batches, receipt, Delivery Note and invoice separation. [Trial](https://frappecloud.com/pricing) [REST/meta](https://docs.frappe.io/framework/user/en/guides/integration/rest_api) | Generic API behavior plus official workflow documentation. | No tenant, token, metadata response or mutation. Fields below are **candidate field names to confirm from tenant metadata**, not fixed published payload contracts. |

A third lab should wait. Bsale gives a low-friction, vendor-published API/sandbox contract; ERPNext gives the richer canonical workflow. Adding more vendors before completing both will create comparison noise instead of a committed design.

## Common design contract (before vendor mapping)

Use the fixture `external_id` as the idempotency key, retain source-message metadata outside the ERP, and keep both `requested_quantity` and `delivered_quantity`/`final_weight` rather than replacing one with the other. Never write invoices, payments, accounts receivable or tax enrollment while learning the workflow.

The test must record: request hash, external ID, returned vendor ID, state, stock before/after, price list/version, UOM conversion, lot and expiry if accepted, and response/error. A successful HTTP response does not prove correct operational semantics.

## Bsale Chile: exact published API proof packet

**Authentication and base:** all calls use `access_token` header; the published Chile API uses `https://api.bsale.io`. A Bsale account is the final access gate for the test token; production token/OAuth is not needed for this lab. [First steps](https://docs.bsale.dev/get-started/) [OAuth](https://docs.bsale.dev/oauth/)

| Fixture/object | Published route and inspected fields | Safe QA operation | Proven gap / guardrail |
|---|---|---|---|
| Customer `RQA-CUST-001/2` | `POST /v1/clients.json`. Published example includes `code`, `company`, `firstName`, `lastName`, `email`, `phone`, `address`, `city`, `municipality`; `code` stores the RUT. [Clients](https://docs.bsale.dev/clientes/) | Create customer once; `GET /v1/clients.json?code=...` before retry. | Requiredness is not labelled field-by-field; use exact vendor example on the sandbox and record validation response. Avoid credit fields. |
| Product parent | `POST /v1/products.json` publishes `name`, `stockControl`, `productTypeId`, with optional `allowDecimal`, `serialNumber`, `isLot`, taxes. [Products](https://docs.bsale.dev/productos-y-servicios/) | Create `RQA-PROD-TOM`, allow decimals; first list product types from the sandbox to select valid `productTypeId`. | Product is not saleable until its variant exists. `isLot` wording is about repeatable series; it is **not enough proof** of food lot/expiry workflow. |
| SKU/variant | `POST /v1/variants.json`; schema exposes `productId`, `description`, `unlimitedStock`, `allowNegativeStock`, `barCode`, `code`, `unit`. [Variants](https://docs.bsale.dev/PE/variantes/) | Create `RQA-TOM-001`, then read it back. | Verify country-specific Chile schema after sandbox selection; no catch-weight model was established. |
| Price update | There is **no POST price-list API**. Inspect with `GET /v1/price_lists.json`, then `GET /v1/price_lists/{id}/details.json?code=...`; update existing detail with `PUT /v1/price_lists/{listId}/details/{detailId}.json`, body `{"variantValue": 18000, "id": detailId}`. [Price lists](https://docs.bsale.dev/listas-de-precio/) | Set morning price only after the sandbox already has a price list/detail. Persist list/detail IDs and old/new price. | Creating/naming a price list is a UI/import setup task; do not invent a REST create route. |
| Goods receipt/observed count | Bsale stock docs publish `POST /v1/stocks/receptions.json` and identify `document` as intake-document name; stock model is per variant/office. [Stocks](https://docs.bsale.dev/PE/stocks/) | First inspect the full sandbox schema/example; only then receive `RQA-LOT-001` and separately post observed-count adjustment if documented in that tenant. | Search result verifies route but not every receipt body field. No runnable receipt payload is supplied here. |
| Order/dispatch | `POST /v1/documents.json` is the published sale/pre-sale document route. It accepts `documentTypeId`, `officeId`, `priceListId`, dates, client/clientId and `details` with `variantId`; `dispatch:1` deducts stock. `salesId` returns existing document rather than duplicate when same type already has it. [Documents](https://docs.bsale.dev/documentos/) | First list sandbox document types/offices and choose a **non-electronic** sales-note/order type. Create `RQA-SO-001` using `salesId`; read it back; retry same `salesId`. | Official guide supports a partial guide from an existing sale document. Exact API route/body for a separate guide/partial delivery must be taken from the selected Chile sandbox document type; do not use an invoice as a proxy. [Partial guide UI](https://ayuda.bsale.io/support/solutions/articles/151000212129-generar-una-gu%C3%ADa-de-despacho-a-partir-de-un-documento-existente) |

**Bsale stage gate:** credentials + sandbox account; a valid office, product type, document type, existing price list/detail; test user permitted to create records. Do not activate SII enrollment, issue electronic document, or create payment.

## ERPNext: generic route proof plus tenant-metadata gate

**Authentication/routes:** create a dedicated test user’s API key/secret in the UI and pass `Authorization: token key:secret`. v1 `POST /api/resource/{DocType}` creates a record; v2 `GET /api/v2/doctype/{DocType}/meta` returns the exact active tenant metadata. Roles govern permissions. [Token auth](https://docs.frappe.io/framework/user/en/api/rest) [REST/meta](https://docs.frappe.io/framework/user/en/guides/integration/rest_api) [Permissions](https://docs.frappe.io/framework/user/en/basics/users-and-permissions)

| Fixture/object | Route and operational proof | Candidate fields only — inspect `/meta` before write | Gap / acceptance criterion |
|---|---|---|---|
| Customer | `POST /api/resource/Customer`; Customer docs establish name, billing currency, price list and payment terms as business fields. [Customer](https://docs.frappe.io/erpnext/customer) | `customer_name`, `customer_group`, `territory`, `default_price_list` plus tenant-required defaults. | Do not send a static payload until metadata and required-field flags are captured. |
| Item/UOM | `POST /api/resource/Item`; Item docs require item code/group and describe stock UOM; UOM conversion supports packaging. [Item](https://docs.frappe.io/erpnext/item) [UOM sales](https://docs.frappe.io/erpnext/Selling-in-different-UOM) | `item_code`, `item_name`, `item_group`, `stock_uom`, `is_stock_item`, `has_batch_no`, `has_expiry_date`, `uoms`. | Exact child-table field names/version differences must be read from Item metadata. |
| Price | `POST /api/resource/Item Price`; ERPNext documents an Item Price per item/selling price list/UOM/rate. [UOM prices](https://docs.frappe.io/erpnext/Selling-in-different-UOM) | `price_list`, `item_code`, `uom`, `price_list_rate`. | Create the Price List master in UI first unless metadata confirms all required fields and a test owner chooses to expand scope. |
| Lot + receipt | `POST /api/resource/Batch` then a Stock Entry/Material Receipt; official opening-stock workflow requires batch before receipt and Item Code/Qty/Basic Rate/Batch No. [Opening stock](https://docs.frappe.io/erpnext/opening-stock) | Batch and Stock Entry fields must come from `/meta`; likely concepts: `item`, `batch_id`, `expiry_date`, `stock_entry_type`, `to_warehouse`, `items`. | Submission changes stock. Dry-run metadata and draft creation first; only submit after explicit test design review. |
| Sales order/delivery | `POST /api/resource/Sales Order`, then Delivery Note. Official flow is Sales Order → Delivery Note → Sales Invoice; Delivery Note carries batch/serial and source warehouse. [Order](https://docs.frappe.io/erpnext/sales-order) [Delivery](https://docs.frappe.io/erpnext/delivery-note) | `customer`, `selling_price_list`, `items`, and tenant-generated child-row fields. | Never create invoice. The test is passed only if submitted partial Delivery Note reduces stock and leaves order delivery status open for remaining quantity. |
| Observed count | Use the documented Stock Reconciliation UI/CSV template rather than assuming a stable REST payload. [Stock reconciliation](https://docs.frappe.io/erpnext/stock-reconciliation) | Download tenant template and preserve headers. | REST record is possible generically, but exact child schema and submit policy are intentionally unverified; use CSV/manual review. |

**ERPNext stage gate:** create free Frappe Cloud test site; configure Company, Chart defaults, Warehouse, Item Group, UOM, Customer Group, Territory and a dedicated API user with least privilege; capture metadata for `Customer`, `Item`, `Item Price`, `Batch`, `Stock Entry`, `Sales Order`, `Delivery Note`. No credentials or API calls have been made.

## Repeatable learning sequence

1. **Dry-run only:** validate fixture uniqueness, normalize UOMs and output the proposed object dependency order locally. The supplied `erp-verify.py` is read-only and dry-run by default; no write harness is supplied because Bsale receipt/guide body and ERPNext tenant schemas remain gated.
2. **Read-only discovery:** with test credentials, list Bsale office/product/document types/price lists and request ERPNext `meta` for each stated DocType. Save sanitized response structures only.
3. **Master mapping:** create two customers, two product parents/variants (Bsale) or items (ERPNext), then test one stable SKU lookup/retry.
4. **Morning tariff:** update one existing Bsale price-list detail; ERPNext create/adjust Item Price only after metadata confirms it. Preserve old value/version.
5. **Receipt and observed count:** Bsale after route-body inspection; ERPNext via tenant CSV/manual reconciliation. Compare observed against ledger, then create one separately labeled correction.
6. **WhatsApp order:** parse a fictitious message into a reviewed staging record only. No inbound WhatsApp integration is claimed or tested.
7. **Lot/final weight then partial delivery:** Bsale stops unless sandbox proves it; ERPNext uses batch-aware Item/Delivery Note after a manual test design check. Deliver 1.95 of 2 cases and retain 0.05 open.
8. **Office retry:** Bsale repeats `salesId`; ERPNext preflights the external ID/designated reference, then stops if its tenant has no approved uniqueness rule.

## Explicit stop conditions

- Credentials cannot be placed in fixtures, source control, chat or a vendor request; when a future harness exists it must read only environment variables and default to dry-run.
- Any route that creates a fiscal invoice, payment, receipt, account/AR entry, tax enrollment, or production tenant record is out of scope.
- “Schema inspected” means documentation was read. “Sandbox executed” must only be recorded after an authenticated test tenant response is saved and reviewed. At present, **zero operations were executed**.

## Connection-onboarding addendum: prove read access before any write

The practical connection ranking is: **(1) Bsale sandbox token**, **(2) Zoho Inventory OAuth consent**, **(3) ERPNext dedicated API key**. Bsale and Zoho are the two closest to a familiar OAuth/API-key developer experience. ERPNext is deliberately third because its user/role and tenant metadata setup is useful, but less immediate.

| Connection | Exact next signup/connection action | Identity and approval boundary | First read-only verification | Minimum initial scope / credential | Write gate |
|---|---|---|---|---|---|
| **Bsale Chile sandbox** | Open the [Bsale API sandbox signup](https://account.bsale.dev/users/create), complete email validation, then obtain the documented sandbox `access_token`; API documentation does not state a duration. [Sandbox steps](https://docs.bsale.dev/get-started/) | Requires a real email and acceptance of Bsale terms; API documentation does not establish a phone requirement. No partner negotiation or payment is required. The user must supply/approve the account identity; do not invent it. | `GET https://api.bsale.io/v1/clients.json` with `access_token`, then list offices, product types, document types and price lists. This proves tenant/token only. | One sandbox `access_token`; it is unique per user. No OAuth integration app is needed for sandbox exploration. | Read results must show a sandbox office, product type and non-electronic document type. Only then create fictitious masters. |
| **Zoho Inventory OAuth** | Sign up for the [14-day trial](https://www.zoho.com/us/inventory/help/getting-started/sign-up.html), then in Zoho Developer Console choose **Add Client ID** and register a local/test application with its redirect URI. Start the authorization URL, sign in and explicitly accept the consent screen. [OAuth flow](https://www.zoho.com/inventory/api/v1/oauth/) | Requires a real Zoho identity, company/organization details and an interactive consent by the account owner. No paid subscription is needed for the 14-day trial. Do not create a client secret or accept consent on somebody else’s identity. | `GET https://www.zohoapis.com/inventory/v1/organizations` with `Authorization: Zoho-oauthtoken {access_token}`. It returns `organization_id`, needed by subsequent API calls. [Organizations](https://www.zoho.com/inventory/api/v1/organizations/) | Request only `ZohoInventory.settings.READ` for the first call. The grant uses `response_type=code`, a matching redirect URI and short-lived code; use **online** access first so no refresh token is retained. [Scopes/flow](https://www.zoho.com/inventory/api/v1/oauth/) | Record organization ID and plan, then separately obtain `contacts.READ` and `items.READ` to inspect. Request CREATE scopes only after the user agrees to the exact fixture write batch. |
| **ERPNext/Frappe Cloud** | Sign up for a [14-day Frappe Cloud trial](https://frappecloud.com/pricing), create an ERPNext site, then create a dedicated test user and generate API keys at **User → API Access → Generate Keys**. [Token steps](https://docs.frappe.io/framework/user/en/api/rest) | Requires the test-site owner’s account and configuration choices (company, default masters, roles). No partner process/payment required for trial, but the owner must create the user/key. | `GET /api/v2/doctype/Customer/meta`, then `Item`, `Sales Order`, `Delivery Note` and `Stock Entry` metadata using `Authorization: token key:secret`. This proves route, identity, permissions and exact active schema. [REST v2 metadata](https://docs.frappe.io/framework/user/en/guides/integration/rest_api) | Dedicated least-privilege API key/secret. Assign only read permissions initially; Frappe checks access under that user. | Metadata must confirm required fields and role access before draft master creation. No stock transaction submission until the documented manual flow is reviewed. |

### Zoho is now the optional third learning lab

Zoho qualifies for an **onboarding/read-only** comparison because the trial and OAuth consent are self-serve and the scopes are explicit. It does not replace Bsale/ERPNext for the first workflow build: its Mexico operational/localization fit and the relevant plan gates remain unproven. Its correct first artifact is an OAuth consent plus organization read—not a product, order, invoice or payment write.

### Status vocabulary for the work log

- **Documentation inspected:** vendor route/schema read; no credential used.
- **Connected/read verified:** user-approved account, correct scope/token, a read-only request returned tenant data.
- **Fixture write verified:** user-approved disposable tenant, exact fixture batch created and read back.
- **Operational workflow verified:** stock/price/lot/partial-delivery state transitions were checked by a human. Nothing in this report is presently beyond **documentation inspected**.

## Operation-level cascade and file fallback

Use the matrix in [latam-erp-research.md](latam-erp-research.md) as the source of truth. Bsale’s most practical pattern is API for masters/read/retry, a vendor price-list importer for morning tariffs, and guide-detail/document import only where the selected tenant’s non-electronic document type supports it. ERPNext’s practical pattern is one test key plus downloaded tenant templates; it is the better fallback when a route schema is dynamic. Zoho begins at OAuth/read verification and has a genuine price-list CSV/TSV importer, but no write batch is approved.

A CSV **export** is never considered importer support. “Generic import” is accepted only where the vendor documents it as a record-creation/update importer and the active tenant can download the actual template. Every file run must retain the downloaded template version, import preview/result, external IDs and a duplicate-safe re-run result.

The hardened verifier supports `ZOHO_EXPECTED_ORGANIZATION_ID`; set it before a Zoho read check when tenant identity must be established. Without it, a successful response proves only schema-valid access, not that the intended organization was reached.

### Bsale API environment correction (supersedes prior trial wording)

For the practical Bsale lab, use the API documentation’s self-service sandbox signup at [account.bsale.dev/users/create](https://account.bsale.dev/users/create), reached from [First steps](https://docs.bsale.dev/get-started/). It requires email validation; the official API source does **not** state a 30-day duration or phone requirement. The generic commercial trial must not be used as proof of sandbox API availability.

Production customer OAuth is **not** tier 1: [Bsale OAuth documentation](https://docs.bsale.dev/oauth/) says the integrator must submit the vendor form and receive `app_id`/integrator credentials, including `usrToken`. It is tier 2 (self-service customer authorization after developer/integrator approval). The proof plan remains sandbox-only until that approval exists.
