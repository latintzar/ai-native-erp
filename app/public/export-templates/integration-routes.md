# Rocoto export: integration routes for Spanish distribution SMEs

**Scope and evidence date:** 31 August 2026.  This note is deliberately limited to Spanish editions of Sage products and an ERP-neutral route for food-and-beverage wholesalers supplying restaurants. It does not assume that a feature of Sage 50 US/Canada, Sage 50 Accounts UK/Ireland, or Sage 200 outside Spain is available in Spain. Vendor statements below link to primary Sage Spain pages, Knowledgebase articles, its Spain Community Hub, or Sage’s developer portal.

## Decision rule

Start with the customer’s existing ERP and its supported import/API surface. Put a cloud ERP on the shortlist only where the customer is willing to choose or replace a system and can demonstrate the needed stock, lot, weight, tariff, order, delivery-note (*albarán*) and invoice flows. Leave a Windows/local connector as a later, per-customer project. Do not build against a partner’s bespoke ERP until its supplier supplies versioned technical material and a test environment.

Rocoto must be configurable as the authoritative source **per business field**, rather than claiming to be the source for the whole record. The customer signs that configuration before the first sync.

## Sage Spain: confirmed routes and limits

| Product and Spain evidence | Confirmed supported route | What remains unknown / must be tested | Practical recommendation |
|---|---|---|---|
| **Sage 50 España** | Sage’s Spain requirements explicitly say to use the Sage 50 development SDK/Plugin for external creation of Sage 50 data; product personalisations must use that approved tool. The same document permits a separately-created database account for *reading/exploiting* data, but reserves `sa` and `Sage50` to Sage’s internal database management. [Sage 50 minimum requirements](https://es-kb.sage.com/portal/app/portlets/results/viewdocument.jsp?solutionid=240425085124947)  Sage’s Spanish Community Hub also directs developers to Sage 50 technical documentation and the partner route. [Sage 50 API discussion](https://communityhub.sage.com/es/sage-50/f/discusion-general/196667/sage-50-api) | Public material reviewed does not establish a self-serve REST API, public OpenAPI schema, endpoint coverage, SDK licence/partner terms, or a published canonical CSV template for each commercial object. Obtain the SDK documentation, licence terms and a version-matched test company from Sage/its distributor before committing. | **Later local connector candidate**, delivered through the SDK/plugin or vendor/partner-supported mechanism. Read-only reporting extraction can be evaluated with an independent least-privilege DB user only after vendor approval; never write tables directly. |
| **Sage 200 España / 200c Spain** | Sage describes Sage 200 Advanced as supporting external API integrations and an advanced import manager. [Sage 200 Advanced catalogue](https://www.sage.com/es-es/-/media/images/sagedotcom/spain/es-es/pdf/productos/sage%20200/folleto%20sage%20200%20advanced%20edition_.pdf) Its developer portal publishes a product-labelled **200c (España)** Sales API, including a `Rates` tag. [Sage 200 Sales API](https://developer.sage.com/200c/apis/sage-200-sales-api/v1.0.0/sage-200-sales-api/tags/rates) Sage’s Community Hub has a verified answer pointing Spain users to the API reference and says commercial terms require Sage sales. [API access](https://communityhub.sage.com/es/sage-200/f/discusion-general/180469/acceso-a-la-api)  The Spain product has import/export tooling: users access it via Inicio → Utilidades → Importación-Exportación; custom guides can be supplied through Sage/distributor, and Article maintenance can generate a template. [Import/export menu](https://communityhub.sage.com/es/sage-200/f/discusion-general/227071/duda-modulo-gestion-sage-200) [article template](https://communityhub.sage.com/es/sage-200/f/discusion-general/218577/campos-en-guias-de-importacion) | We have not validated tenant eligibility, authentication/credential provisioning, enabled modules, API write coverage for orders/delivery notes/lots/weights, pagination/rate limits, or whether a guide exists for each object. A Sage forum answer says purchase-invoice import has no standard guide and may need support to create one—so a generic “CSV import” claim would be unsafe. [Purchase-invoice CSV answer](https://communityhub.sage.com/es/sage-200/f/discusion-general/217860/importacion-fichero-csv-en-sage-200-para-facturas-de-compras) | **Viable vendor-supported pilot candidate.** Prefer the documented Spain API for operational sync when the customer’s entitlement exposes the required resources; otherwise use a Sage-approved import guide/templates with a controlled import queue. Do not infer API access from the marketing claim alone. |

### Trial and operating constraints

* **Sage 50 España test:** current installation guidance explicitly supports a **demonstration-mode installation** and creation of an example-data company. That is evidence for a local product demo/test, not a promise of a production-like integration sandbox or SDK entitlement. [Sage 50 installation guide](https://es-kb.sage.com/portal/app/portlets/results/viewsolution.jsp?solutionid=230731113258903)
* **Sage 200 España test:** Sage’s Veri*Factu FAQ describes creating a separate empty pilot company for tests. It is not a public general trial offer; invoice validation in that scenario requires a matching certificate/NIF. [Sage 200 FAQ](https://www.sage.com/es-es/-/media/Files/SageDotCom/Master/gated-assets/marketing-automation/FY25/es/Sage_200_FAQS_VeriFactu.pdf) Ask Sage/partner for a non-production integration tenant or a restored, anonymised test company.
* **Sage 50 Windows/local:** Spain’s current requirements describe local Sage 50 on an office PC/server, with SQL Server managing the database and terminals connecting to it; the then-current guidance recommends Windows 11 Pro/Pro for Workstations or Windows Server 2025 and SQL Server 2025 for new installations. [Sage 50 requirements](https://es-kb.sage.com/portal/app/portlets/results/viewsolution.jsp?page=1&position=0&q=requisitos&solutionid=230731115225667) Its product page says local full functionality is through local-network installation or remote access, while its cloud option is browser-accessible. [Sage 50 product page](https://www.sage.com/es-es/productos/sage-50cloud/) Treat the connector as Windows-adjacent: run in the customer’s approved network, avoid exposing SQL or a local Swagger endpoint to the public internet, and let their IT/partner own updates, backups, AV/firewall exceptions and credentials.
* **Sage 200 deployment:** the current Sage Spain product page describes it as cloud-operated and accessible from Mac, Windows and tablets. This is a product-access statement, not evidence that every Spain customer installation or its API is cloud-hosted. [Sage 200 product page](https://www.sage.com/es-es/productos/sage-200/)

### What not to do

Never write directly to Sage SQL tables, trigger database jobs, reuse `sa`/`Sage50`, reverse-engineer schemas as a write contract, or make an unapproved database change. Sage 50’s own requirements say its internal SQL users are exclusive to Sage and recommend its SDK/plugin for external data creation. For Sage 200, use only documented API operations or Sage-managed/import-guide mechanisms. In both systems, treat database reads as a separately approved reporting integration with least privilege, a version lock and reconciliation—not as permission to mutate data.

## ERP-neutral distribution contract

### Record identity and customer mapping

Every integration entity carries three identities:

1. `rocoto_id`: immutable UUID owned by Rocoto.
2. `external_id`: immutable ID issued by the ERP/customer system, namespaced by `erp_instance_id` and entity type.
3. `display_code`/name: human-facing values only; never a matching key.

For customers, retain the ERP’s customer code/account number and legal/tax identifier where lawfully available, plus site/delivery-address IDs. Maintain an explicit mapping table keyed by `(erp_instance_id, entity_type, external_id)` with `rocoto_id`, lifecycle status, first/last observed time and source version. Names, trading names, group names, contact names and delivery address text may repeat and are non-keys. Potential duplicate candidates may be shown to an operator, but no automatic merge occurs on name similarity. A merge is a recorded business decision, with predecessor IDs retained as aliases; an unlink has an effective timestamp.

### Canonical business objects and required semantics

| Object | Minimum contract | Direction/ownership decision |
|---|---|---|
| Customer + delivery site | immutable IDs; legal/trading name; tax ID where allowed; account status; payment/credit data only if in scope; delivery site ID, address, route/window | Set separately for customer master, contact/site, credit status and terms. ERP normally owns statutory account fields; Rocoto may own commercial enrichment only if explicitly elected. |
| Product/SKU | supplier/internal SKU IDs; barcode where used; description; active state; base stock UoM; sales UoM/conversion; tax category; catch-weight flag | Choose source for catalogue, descriptions, UoM conversions and availability independently. A price or stock source must never be inferred from the product source. |
| Tariff / price condition | tariff ID; customer or customer group scope; SKU; UoM; currency; net/gross basis; quantity break; effective start/end; discount/surcharge; price-list revision | The signed matrix selects one owner. If ERP owns prices, Rocoto only consumes the resolved tariff/conditions or submits a price request for ERP validation. |
| Stock snapshot | warehouse/location; SKU; stock UoM; on-hand, allocated, available, blocked/quarantine; `as_of`; inventory revision | Snapshot is a state view, owned by the chosen stock system. It cannot explain how stock changed and must not be replayed as a movement. |
| Stock movement / lot | immutable movement ID; event time; warehouse/bin; SKU; quantity and UoM; reason; lot/batch ID; expiry/best-before if managed; source document/line | Use append-only movements for receipts, allocations, picks, adjustments, returns and despatches. Lot and catch-weight attributes travel at the physical line, not only at SKU level. |
| Sales order | order ID/revision; customer and delivery site IDs; requested delivery date; status; lines with SKU, ordered qty/UoM, agreed price/condition reference, substitution policy | One owner controls order state and commitments. Other system may propose/create only through an acknowledged command and must not independently advance fulfilment status. |
| Delivery note (*albarán*) | delivery-note ID/status; order/line references; actual ship/delivery time; warehouse/route; delivered quantities; substitutions; lot/batch, expiry and actual weight for each line; proof/exception reference | Fulfilment system owns the execution facts. Partial deliveries form distinct albarán lines/documents linked back to original order lines; never overwrite the order quantity. |

**Variable weight and units.** Preserve `ordered_qty`, `allocated_qty`, `picked_qty`, `delivered_qty`, `invoiced_qty` as separate values, each with UoM. For catch-weight items also carry `units/cases`, `net_weight`, `weight_uom`, and the pricing basis (per case, per kg, etc.). Conversion uses versioned product/UoM rules; do not silently convert or round after the fact. Price reconciliation uses the agreed condition and the actual billable quantity/weight defined by the commercial policy.

**Snapshot versus movement.** Snapshots are pulled/issued on a cadence for availability and repair; movements are event records for audit and replay. Each stock snapshot identifies its scope and `as_of` time. Reconciliation compares a computed movement balance with the ERP snapshot, then creates an exception; it does not manufacture a correction movement without approval.

### Ownership and direction matrix

Before activation, complete this matrix for every implementation and version it with an effective date:

| Field group | System of record | Allowed direction | Conflict rule |
|---|---|---|---|
| customer identity, account status, tax/credit fields | named: ERP or Rocoto | ERP→Rocoto / Rocoto→ERP / read-only | reject non-owner change; route to owner |
| product and UoM conversion | named | one-way or approved command | owner version wins; no code/name matching |
| price/tariff/discount | named | one-way or quote/validate | owner resolves effective price at order time |
| stock state and allocation | named | snapshot/movement export; optional reservation command | owner accepts/rejects reservation; never blind overwrite |
| order lifecycle | named | command + status event | owner assigns document numbers and final state |
| albarán, lot and actual weight | fulfilment owner | event export | immutable execution facts; corrections are new events |

The default for a pre-existing ERP is ERP-owned customer identity, catalogue, tariff, stock, order fulfilment and accounting documents; Rocoto is a consumer/orchestrator until the customer explicitly elects another owner. The exact mapping can therefore support a future Rocoto-owned pricing or catalogue setup without a schema redesign.

### Transport safety, receipts and reconciliation

* Every outbound command has `message_id` (UUID), `idempotency_key`, source object ID/revision, payload hash, sender, destination and correlation ID. The receiver stores and returns the prior result for a repeated idempotency key.
* Acknowledge in stages: `accepted` (syntactically received), `applied` (business change persisted), or `rejected` (machine-readable reason, failed field and retryability). Accepted is not a claim that an ERP document exists.
* Export events use monotonic per-source sequence/cursor plus event time. Consumers persist the cursor only after durable application. Do not rely on timestamps alone.
* Commands and imports go to a durable queue/staging log, with validation and an operator-visible exception list. Batch imports receive a batch ID and a per-row receipt; retry only failed rows with the same idempotency semantics.
* Reconcile at least daily: counts and hashes per entity, customer mapping exceptions, active SKU/UoM differences, tariff effective-date overlaps, order-line ordered/delivered/invoiced balances, stock by warehouse/SKU/lot, and documents created after a failed/unknown receipt. Escalate material mismatch; do not auto-create financial or stock corrections.

## Customer qualification checklist

Qualify a customer before committing to any integration route:

1. **Process fit:** supplier/wholesaler to hospitality customers; warehouses, routes, partial deliveries, albaranes, returns, lots/expiry, catch weight and pricing basis actually used.
2. **System identity:** exact product, country edition, deployment (SaaS/on-prem/hosted), version/build, modules, customisations/add-ons, legal entity/company database and number of warehouses.
3. **Supported access:** named vendor/partner, written statement of supported API/SDK/import route, entitlement/fees, test environment, relevant API reference or import guide/template, auth method, rate/volume limits and support boundary.
4. **Business coverage test:** demonstrate one customer with two delivery sites; one tariff with effective dates/quantity break; one catch-weight/lot SKU; an order split across two albaranes; a substitution/shortage; a return; and invoice reconciliation.
5. **Data readiness:** stable customer/account/site and SKU IDs; UoM and conversion table; tariff IDs; warehouse/bin and lot policy; document numbering/status rules; historical data needed; duplicate/merged customer policy.
6. **Authority and security:** who approves system-of-record choices; service account and least privilege; data protection basis for contacts; network path; retention/audit needs; backup and incident owner.
7. **Operational control:** ownership matrix signed; cutover and rollback plan; reconciliation thresholds; exception SLA; business users empowered to resolve mapping and price/stock conflicts.

Disqualify or defer where the customer cannot identify its edition/version, has no stable IDs, insists on direct database writes, cannot supply a test company/data, or needs write coverage that the vendor will not document.

## Bespoke ERP: provider-document intake workflow

1. Open an **evidence register**: customer, ERP supplier, product/version, supplied date, document URL/file checksum, contact, licence/confidentiality restriction, and expiry/review date. Label every capability `confirmed`, `unknown`, or `needs vendor test`.
2. Request the supplier’s versioned integration pack: API/OpenAPI or SDK reference, authentication and scopes, webhooks/events, rate limits, object schemas, error catalogue, pagination/cursors, idempotency guidance, supported imports/exports with field templates, sandbox/test company, release/change policy, and supported deployment/network topology.
3. Map the pack to the canonical objects above. For every field record source path, type/UoM/currency/time zone, cardinality, requiredness, direction, owner, transformation, validation, and a named sample document. Do not map an undocumented table or assume an endpoint exists because the UI has a screen.
4. Run a vendor-witnessed compatibility test in the test company using the business coverage test in the checklist. Capture requests/responses, imports, resulting ERP documents, error handling and reconciliation outcomes. Mark coverage `confirmed` only after this proof.
5. Freeze a connector compatibility matrix by ERP product/version/module. Re-run the regression pack for vendor upgrades or customisation changes; keep production disabled until the matrix is approved.

## Recommended sequencing

1. **Manual/file first:** accept a Sage-approved or provider-supplied template only after field-level mapping and per-row receipt/reconciliation are defined. Use export/import batches for low-frequency master data or controlled migration—not an undocumented pseudo-API.
2. **Easy cloud API next:** choose a cloud ERP only after the provider can prove the full contract in a sandbox; use its documented API, scoped credentials and receipts. Do not select on generic “inventory API” marketing.
3. **Windows/local later:** offer Sage 50 Spain and comparable local ERPs as supported connector projects when an installed customer, its partner, exact version and SDK/test company are in hand.
4. **Custom ERP last:** start only from the provider evidence register and test pack above.

No cloud account, payment, implementation commitment or connector build is authorised by this analysis.
