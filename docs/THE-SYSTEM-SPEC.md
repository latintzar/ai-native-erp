# THE SYSTEM SPEC — Cedar's proposed production behaviour

**Scope:** [Cedar](../app/src/prototypes/cedar/README.md), one product candidate. Its adoption remains
a selected work package; sibling candidates can propose different behaviour.

**Status:** canonical target specification within this proposal under
[THE-ARCHITECTURE.md](THE-ARCHITECTURE.md). It is intentionally stronger than the browser kit.
Nothing here claims a service, connector, model, or operational workflow is deployed until its
release gate has evidence.

## SYS-00 · Scope and authority

This specification defines the proposed production behaviour for Cedar's tenant application:
identity, data, commands, read models, sheets, catalogue, stock, commercial documents, utilities,
intelligence boundaries, integrations, administration, operations, security, onboarding, and
release. It resolves a conflict by this order:

1. [THE-ARCHITECTURE.md](THE-ARCHITECTURE.md) decides system shape and supersessions.
2. This document decides production behaviour.
3. [THE-INTERACTION-SPEC.md](THE-INTERACTION-SPEC.md),
   [THE-PRODUCT-SHEET-SPEC.md](THE-PRODUCT-SHEET-SPEC.md),
   [THE-CATALOGUE-CONTRACT-SPEC.md](THE-CATALOGUE-CONTRACT-SPEC.md), and
   [THE-INTELLIGENCE-SPEC.md](THE-INTELLIGENCE-SPEC.md) decide shared interaction and detailed
   domain behaviour within those boundaries.
4. [THE-WIRING-TASKLIST.md](omitted-sources.md) assigns and proves implementation. It cannot
   weaken a requirement here.

“Must” means a release requirement. “May” means a permitted implementation choice that cannot
break an invariant. Every product decision in this document is settled; provider credentials,
legal registrations, physical delivery arrangements, and customer approval are activation inputs,
not unmade product decisions.

## SYS-01 · Master product and UI hierarchy

This is the literal product map. It describes the application a person uses, rather than a task
backlog. A descendant may add a field only in the detailed section that owns it; it may not
change its parent object, action, or source of truth. Every visible leaf uses the shared state
frame in `OBJ-02`, then its own named copy below.

- **Tenant application**
  - **Global shell**
    - **Tenant switcher** — active tenant name; **Switch tenant**; signed-in member; session and
      capability state. Switching clears the previous tenant's cached rows, drafts, subscriptions,
      search results, and open routes before the new tenant is read.
    - **Primary navigation** — **Sales**, **Products**, **Customers**, **Money**, **Administration**. Stock remains an optional capability. A selected
      item names the workspace; a disabled item says why it is unavailable. Supplier email is not
      a peer Stock item.
    - **Global work controls** — **Search**, **Notifications**, **Help and support**, and the
      user menu. Search returns tenant-authorized object doors with object type, current state and
      provenance; it never searches another tenant or turns a source phrase into a business fact.
    - **Global utilities** — **Stock update** (`UTL-01`), **New product** (`UTL-02`), and
      **Export** (`UTL-04`). **Add a product list** (`UTL-03`) is a secondary route inside **New
      product**, not a peer utility. Each command keeps its own history, permissions and recovery;
      no worksheet silently performs a utility's command.
    - **Universal feedback** — saving/checked-save/conflict/permission/offline banners, job
      centre, realtime freshness and advisory presence. These report one authoritative command or
      projection state; they are never a fake success toast.
  - **Sales workspace** (`ALB-01`, `DOC-01`)
    - **Sales list** — date/state/customer/assignee/source filters; **New albarán**; rows open
      one Albarán Sheet. A row shows an honest draft, prepared, issued, dispatched, delivered,
      corrected, voided or archived state, never an inferred delivery result.
    - **Albarán Sheet**
      - header, customer door, business day, delivery state, source/actor provenance and return
        navigation (`ALB-N`);
      - native request/message/attachment evidence and channel capability (`ALB-S`);
      - exact order lines: product resolution, quantity, unit/equivalence, price, calculated
        total, class, genuine lot and freeform note (`ALB-L`);
      - red, exact-scope response/check concerns and review/dismiss path (`ALB-C`);
      - delivery snapshot, preparation/allocation, dispatch, delivered/failed/returned evidence
        (`ALB-D`);
      - issue preview, immutable document revision, print, download, document email and receipt
        history (`ALB-O`);
      - correction, void, archive and eligible draft deletion (`ALB-M`).
    - **Sales history and reporting** — projection filters, totals, timing and source evidence;
      actions open an object or a scoped Export job, never rewrite a document.
  - **Stock workspace** (`CAT-01`, `SRC-01`, `INV-01`, `COM-01`, `PRD-01`)
    - **Stock index** — tenant SKU search/filter, reference classification feedback, family
      navigator, archived browsing and source-review status. The workspace title remains
      **Stock**; it does not add a second **Catalogue** heading. Internal category and Related products are navigation
      only, not products.
    - **Product Sheet** — exact catalogue-record identity and kind-eligible facts; a coded SKU may own tariff prices/history, **Recorded balance**,
      lots, **Daily stock estimate** and related supplier emails, while both record kinds keep exact-record request history/insights,
      and **Product details & history**. Product → Stock → Lots exposes **Assign stock to lots**: fixed Recorded-balance attribution among typed/selectable lot numbers and Unassigned stock; it is not Albarán fulfilment allocation. [THE-STOCK-LOTS-SPEC.md](THE-STOCK-LOTS-SPEC.md) is authoritative for LOT-01. Its nested anatomy is authoritative in the Product Sheet
      Spec (`PRD-N`, `PRD-P`, `PRD-S`, `PRD-O`, `PRD-E`, `PRD-I`, `PRD-D`, `PRD-C`, `PRD-A`).
    - **Incoming stock sources** — authorized supplier email/source feed, parsing/quarantine/review,
      native source doors and relationship evidence. The feed lives inside **Stock update** and
      exact-SKU related email rows return to it from a Product Sheet. It is never a peer Stock
      screen or a second product/stock truth seat.
    - **Stock update** — exact SKU, physical movement, location, quantity/unit, genuine lot,
      source, preview, acknowledgement and reversal; it cannot create an SKU.
    - **Commercial configuration** — tariffs, unit/equivalence revisions, tax/rule profiles and
      price history. **Set by percentage** is a reviewed multi-tariff operation, not a linked
      price switch or a gross-margin calculation.
  - **Customers workspace** (`CUS-01`)
    - **Customers list** — search/filter/state; **New customer**; rows show current status and
      open one Customer Sheet.
    - **Customer Sheet**
      - identity, customer state, return navigation and customer actions (`CUS-N`);
      - contacts, permitted channels and consent/preference (`CUS-C`);
      - assigned follow-up actions (`CUS-A`);
      - exact-SKU frequent products, upcoming albaranes and immutable history (`CUS-F`, `CUS-O`);
      - contained evidence-backed insights (`CUS-I`);
      - readable **Delivery and Account**, archive, merge and data export (`CUS-D`).
  - **Money workspace** (`CEDAR-MONEY`, FEED-IA §227–232)
    - **Overview** — bank balance, incoming receipt history, explicitly identified forecast and nested invoice/payment history cards.
    - **Invoices** — immutable invoice identity, source Delivery Note, tax acceptance and outstanding balance.
    - **Payments** — document-bound requests, copy/send history, authenticated receipt allocation, partial/paid/review states.
    - **Working capital and customer credit** — repayment plans and customer receivables using the same customer/invoice identities.
    - [Cedar Money contract](../app/src/prototypes/cedar/MONEY-SPEC.md) owns the detailed development implementation and provider-evidence boundaries. Rocoto subscription billing remains in Administration.
  - **Administration workspace** (`ADM-01`, `FND-01`, `INTG-01`)
    - **Organization and legal profile** — name, identifiers, addresses, locale, timezone,
      currency, legal/tax/document profile and document numbering.
    - **Business operations** — calendar, cutoffs, locations, stock/allocation/exception policy,
      delivery zones/routes, traceability and delivery evidence policy.
    - **Commercial policy** — tariff registry, tax categories, unit/equivalence policy, customer
      price policy, price approvals and reference-release selection.
    - **People and security** — members, invitations, roles/capabilities, ownership transfer,
      session revocation, MFA/SSO, access/support approvals, retention/legal hold and audit.
    - **Connections and automation** — mailbox, customer messaging, ERP/accounting, printer,
      carrier, storage, identity and billing connections; scoped automation grants, budgets,
      notification/escalation policy and test/revoke controls.
    - **Billing and data** — plan/seats/usage/invoices, payment portal, exports, imports,
      retention, DSAR/rectification/redaction, recovery, test lineage and diagnostics.
    - **Reliability** — projection/job/reconciliation health, backup/restore evidence, incident
      mode and audit search. Each setting is a revisioned editor, not a static form.
  - **Cross-cutting system services**
    - authenticated tenant commands, append-only events, transactional outbox and versioned
      projections (`FND-03`);
    - realtime cursor/presence, offline draft and idempotent retry (`OPS-01`);
    - source retention, import mapping, native channels and sync/reconciliation (`SRC-01`,
      `INTG-01`);
    - predictive/interactive intelligence and image jobs which produce proposals/jobs only
      (`INT-01`, `INT-02`);
    - output snapshots, delivery, print/export/download/email/ERP receipts (`DOC-01`);
    - shared navigation, overlay/focus/draft and cross-sheet propagation (`INTX-01` and
      [THE-INTERACTION-SPEC.md](THE-INTERACTION-SPEC.md));
    - accessibility, privacy/security, resilience, onboarding, activation and release evidence
      (`QLT-01`, `QLT-02`, `ACT-01`, `REL-01`).

A sheet section is not permission to duplicate an object. For example, a supplier message stays a
source, an action stays a customer child, a line stays an albarán child, and a print/output attempt
stays a job/receipt. The detailed anatomies below specify their fields and controls.

## FND-01 · Tenant identity, authentication, and authorization

### Tenant isolation

Every authoritative record has a tenant ID except platform reference data and platform audit
records. The server resolves the tenant from the authenticated membership and active-tenant
selection; a browser payload cannot choose an arbitrary tenant ID. All reads, writes, searches,
event subscriptions, file URLs, jobs, and provider callbacks enforce this boundary before returning
existence information.

A user can belong to more than one tenant. Switching tenant clears tenant-scoped cache, realtime
subscription, optimistic queues, open object routes, and local search indexes before loading the
next tenant. A session never carries records from two tenants in one projection response.

### Roles and capabilities

Roles are named bundles of capabilities. The server authorizes a capability on every command and
query; role labels in the client are convenience only. A tenant may grant a narrower capability,
but it may not create a capability beyond the matrix below.

| Role | Allowed | Explicitly excluded unless separately granted |
|---|---|---|
| Tenant owner | all tenant administration, membership, billing, data lifecycle, activation, integrations, commercial and operational work | platform-wide reference editing; routine access to another tenant |
| Administrator | team, business settings, catalogue, customers, operations, reporting, data exports, connection setup | subscription cancellation/plan changes, owner transfer, organization closure, break-glass audit access |
| Commercial | customers, customer contacts/actions, draft/ready albaranes, permitted price proposals, source review | tariff policy, issued-document correction, stock counts, exports to external systems, team/data settings |
| Operations manager | catalogue, stock, preparation/delivery, albaranes, output jobs, permitted price and supplier-source review | billing, owner/security changes, unrestricted data export |
| Warehouse/delivery | assigned stock updates, lots, preparation, dispatch/delivery acknowledgement, read assigned document/customer delivery facts | tariff changes, source-account access, customer marketing data, issue/void, billing, data export |
| Finance | tariffs, document issue/correction, document/export jobs, reporting, accounting integration status | stock movements, customer-contact consent, team, provider secrets, catalogue merge/archive unless separately granted |
| Viewer/auditor | tenant projections, immutable document/audit reads within scope | every mutating command, source download where policy withholds it, provider connection management |
| Integration service | one declared adapter's bounded commands and callback verification | interactive login, arbitrary tenant read, user/role/billing changes, cross-connection actions |
| Platform support | no standing tenant-data access | access occurs only through owner-approved, time-bound, audited break-glass scope with read-only default |

Privileges are checked again when a queued/offline command reaches the server. Removing a member,
revoking a connection, changing a role, or ending break-glass access takes effect immediately for
new commands and subscriptions. A user cannot retain access by keeping an old tab open.

### Authentication and session policy

Production supports verified email or managed identity login, strong second factor for owner,
administrator, finance, and break-glass roles, and short-lived access tokens with rotating refresh
sessions. Device/session management shows active sessions and supports revocation. Passwords,
OAuth refresh tokens, API keys, and provider secrets never enter events, projections, browser
storage, exports, or audit payloads; they live in a secret manager and are referenced by opaque
connection IDs.

## FND-02 · Canonical records, identity, history, and lifecycle

### Required record envelope

Every domain object, event, proposal, source, and job carries the fields appropriate to it:

| Field | Requirement |
|---|---|
| `id` | opaque, globally unique stable identifier; never reused after archive, deletion, or failed provider work |
| `tenantId` | server-assigned for tenant data and never trusted from a client body |
| `revision` | monotonically increasing aggregate revision for concurrency and sheet acknowledgement |
| `createdAt`, `recordedAt` | server time; a client-supplied observed time is retained separately when useful |
| `actor` | authenticated member, scoped service, system rule, or approved support actor; no anonymous “system” writes |
| `causationId`, `correlationId` | links a change to the command, source, job, workflow, or parent interaction that caused it |
| `schemaVersion` | lets events/projections evolve without reinterpretation |
| `testLineage` | marks test/sandbox data and blocks it from production exports, learning, billing, or external sends |
| `retentionClass` | drives source/document/personal-data retention and redaction policy |

IDs are opaque in UI routes and API responses. Human document numbers are tenant/day/profile
projections and can change formatting rules without replacing the underlying albarán ID.

### The catalogue hierarchy

The canonical product model is **reference catalogue → tenant catalogue → exact sellable record**,
where an exact record is a coded `SKU` or an accepted `UncodedSaleItem`, with independent Internal
category/group classification and explicit `RelatedItemLink` records. The
exact ownership rules are in [THE-OBJECT-MAP.md](THE-OBJECT-MAP.md). The operational rules are:

- Reference concepts classify and suggest vocabulary. They are not tenant inventory, a commercial
  SKU, a customer alias, or a price source.
- Tenant catalogue admission comes from retained import/source evidence, a manual confirmed SKU,
  or an approved proposal. It is tenant-local.
- An Internal category/group helps browsing/classification and a `RelatedItemLink` joins exactly two
  existing catalogue records for reciprocal navigation; each endpoint is a coded `SKU` or accepted
  `UncodedSaleItem`. They are independent: category co-membership does not
  create a link. Neither is saleable nor owns a Product Sheet, price, tariff history, stock, lot,
  artwork assignment or order history.
- Every active or archived catalogue record has an immutable record ID. A coded `SKU` owns its
  independent price/tariff, artwork, stock/lot, source, alias and order facts; an accepted
  `UncodedSaleItem` retains literal request facts and does not acquire those SKU capabilities.
- A matching display name, reference classification, Internal category/group or RelatedItemLink is never a merge key.
  Merge is a separate reviewed, authorized command that preserves both source identities and
  historic references.

### Original identity and aliases

An `OriginalIdentity` is immutable source evidence: source artifact/row/span, original name,
external code, observed unit/text, parser version, and received time. A current display name or
code is a revisioned SKU projection. Editing the latter never changes old albarán snapshots or the
original identity.

An alias has `skuId`, phrase, normalized index key, scope, provenance, validity, reviewer, and
revision. Scope is exactly one of:

- `reference`: a vocabulary hint; it cannot create tenant membership or select an SKU by itself;
- `tenant`: reviewed search/matching aid for this tenant only;
- `customer`: additionally names one customer and can be considered only while resolving that
  customer's source language.

Ambiguous aliases return candidates or a review state. They do not pick the most specific SKU or
cross a customer boundary.

### Archive, deletion, redaction, and restoration

Archive is a reversible lifecycle change. An archived SKU disappears from default active catalogue,
pricing, stock-update, and direct-add surfaces; it remains in historical sheets, documents, audit,
source evidence, and explicit archived browsing. It cannot receive new stock, pricing, artwork,
or new sales lines until restored. Archive does not reuse ID, delete a price series, or erase lots.

Issued albaranes and their audit facts are never ordinary-user deletions. Eligible drafts,
unadopted leads, temporary uploads, and personal data can be deleted/redacted only through a
policy-checked command. The system records actor, reason, policy basis, targets, dependent
projections, and whether content was redacted or cryptographically erased. Retention keeps the
minimum legal/audit shell without retaining content unnecessarily. No deletion is silently
implemented as a search filter.

## FND-03 · Commands, events, projections, and audit

### Command contract

All mutations use the same envelope. The endpoint path names the command family; the server
validates its typed body before emitting an event.

```json
{
  "commandId": "opaque-id",
  "kind": "sku.details.update",
  "target": {"type": "sku", "id": "opaque-id"},
  "expectedRevision": 17,
  "idempotencyKey": "opaque-id",
  "payload": {},
  "clientObservedAt": "optional ISO-8601 timestamp"
}
```

The server supplies tenant, actor, recorded time, authorization result, schema version, and
correlation identifiers. `commandId` and `idempotencyKey` are stable across retry. Repeating the
same key and canonical payload returns the original acknowledgement; reusing a key with a different
payload returns an idempotency violation and makes no change.

Every mutable existing aggregate requires `expectedRevision`. Creation commands use a client
creation key plus idempotency key and return the previously created object on retry. State-changing
commands such as issue, archive, restore, dispatch, delivery acknowledgement, price write, stock
count, output submit, connection revoke, billing change, and membership change never auto-merge.

Successful acknowledgement:

```json
{
  "status": "accepted",
  "commandId": "opaque-id",
  "aggregate": {"type": "sku", "id": "opaque-id", "revision": 18},
  "eventIds": ["opaque-id"],
  "projectionCursor": "opaque-cursor",
  "effects": [{"type": "artwork.job", "id": "opaque-id", "state": "queued"}]
}
```

An acknowledgement means the authoritative transaction committed. It does not mean an email was
sent, a printer printed, an ERP accepted data, an artwork provider generated an image, or a
projection has reached every client. Those outcomes have their own events and job receipts.

### Error contract and conflict policy

| Response | Meaning | Required client behaviour |
|---|---|---|
| 400 | malformed or schema-invalid command | preserve draft, show field-specific error, do not announce success |
| 401 | session missing/expired | preserve local draft securely, sign in, then retry only with the same key after user review |
| 403 | capability or tenant policy denies act | preserve read-safe draft, show unavailable state, do not leak protected facts |
| 404 | object is not visible in this tenant | show safe unavailable state, not global existence |
| 409 | revision conflict | retain local draft and load the authoritative version plus changed fields/events; require a deliberate retry/merge |
| 410 | object/source expired, redacted, or hard-deleted under policy | explain unavailable history and remove unsafe local content |
| 422 | valid shape but illegal business transition or invariant | show the exact blocked rule and allowed next action |
| 429 | rate or budget limit | retain draft/proposal and show retry-after; no background uncontrolled retry |
| 5xx / network | outcome unknown until idempotency lookup resolves it | mark “checking save”; never create a second command or false failure/success |

The server serializes each aggregate stream. It may safely rebase a stale edit only if the command
names a disjoint low-risk field set, the current values of those fields equal the command's base
hashes, and the acknowledgement says `rebased`. The permitted set is customer freeform contact
metadata, personal view preference, and draft-only unshared note text. SKU identity, aliases,
units, prices, tariff membership, stock, lots, albarán lines, document state, concerns, outputs,
roles, connections, billing, and retention never auto-rebase. There are no user-visible locks;
presence warns about concurrent work but cannot block reading.

### Event envelope and authoritative streams

Committed events are append-only and schema-versioned:

```json
{
  "eventId": "opaque-id",
  "tenantId": "server-assigned",
  "aggregate": {"type": "albaran", "id": "opaque-id", "sequence": 42},
  "globalPosition": 987654,
  "type": "albaran.line.quantity.changed",
  "schemaVersion": 1,
  "payload": {},
  "actor": {"kind": "member", "id": "opaque-id"},
  "causationId": "command-id",
  "correlationId": "opaque-id",
  "occurredAt": "server timestamp",
  "effectiveAt": "business-effective timestamp",
  "recordedAt": "server timestamp",
  "testLineage": false
}
```

| Stream | Examples of authoritative events | Main projections |
|---|---|---|
| tenant/identity | `tenant.provisioned`, `member.role.changed`, `tenant.setting.changed`, `consent.recorded` | active membership, settings, access matrix, activation status |
| source | `source.registered`, `source.parsed`, `source.quarantined`, `source.link.reviewed` | import/source inbox, related emails, evidence detail |
| catalogue/SKU | `sku.created`, `sku.details.updated`, `sku.alias.reviewed`, `category.reviewed`, `related_item_link.changed`, `sku.archived/restored` | catalogue/search, Product Sheet identity, Internal category and Related products |
| commercial | `tariff.created/retired`, `tariff.price.written`, `unit.equivalence.declared` | price sheet, price timeline, quotation readiness |
| inventory | `stock.received`, `stock.counted`, `stock.variance.recorded`, `stock.physically.depleted`, `lot.created`, `lot.receipt.attributed`, `lot.count.attributed`, `lot.position.reassigned`, `lot.reserved/allocated/commitment.released`, `lot.depletion.attributed`, `inventory.overcommitment.detected` | SKU physical ledger/lots, fixed-balance attribution, Recorded balance, availability and Albarán allocation candidates |
| planning | `stock.estimate.set/changed/paused/retired` | Daily stock estimate history; never Recorded balance, lot or availability inputs |
| customer | `customer.created/updated`, `contact.changed`, `customer.action.created/completed`, `customer.alias.reviewed` | Customer Sheet, customer search, work lists |
| albarán | `albaran.created`, `line.added/removed/changed`, `concern.raised/resolved/dismissed`, `albaran.viewed`, `albaran.flagged/unflagged`, `albaran.prepared`, `document.issued`, `delivery.dispatched/delivered`, `document.corrected/voided` | Albarán Sheet, Sales list, customer/SKU histories and Activity |
| output/job | `output.requested`, `output.snapshot.created`, `output.submitted`, `output.receipt.recorded`, `output.failed/cancelled` | Export centre, document/delivery status |
| integration | `connection.authorized`, `webhook.accepted`, `sync.cursor.advanced`, `sync.failed/recovered` | connection status, reconciliation dashboard |
| audit/security | `breakglass.granted/ended`, `data.exported`, `record.redacted`, `policy.denied` | audit search, data-request report |

The precise event schemas are versioned contracts. `albaran.flagged` and `albaran.unflagged` each carry the Albarán, actor, server time and command identity and fold to one durable flag state. They are independent of `albaran.viewed`/read state: opening may record Viewed, while Flag/Unflag is an explicit attention act. Both event families appear in chronological Activity and neither changes lifecycle, output completion or document facts. A projection never adds a business fact not
present in an event, retained source, or deterministic calculation whose inputs and version are
recorded.

### Projections, cursors, and audit

Read projections are versioned, tenant-filtered, and rebuildable. Every sheet response states
`objectId`, `revision`, `asOf`, and projection watermark. A command acknowledgement provides a
cursor so the client can wait for or reconcile its own read model. Search indexes include only
active tenant-visible data and preserve source/alias scope. A projection lag indicator is shown
when a requested view has not reached its required cursor.

The transactional outbox is written with the event transaction. Consumers are at-least-once and
idempotent by event/job key. Reconciliation detects missed projection, provider, and output
receipt work; it emits repair facts rather than silently modifying history. Audit records include
who, what capability, target, before/after summaries or protected diff references, reason where
required, command/event IDs, source/job connections, and outcome. Audit access is capability
controlled and itself audited.

## OBJ-01 · Shared object-sheet contract

Product, Customer, and Albarán Sheets share these behaviours:

- one stable object route and one projection identity;
- identity and lifecycle state before detail;
- contextual actions only where state and authority allow them;
- independent editor drafts with Save, Cancel, failure, conflict, permission, and offline states;
- keyboard Enter saves a focused valid field where safe; Escape abandons that editor only; focus
  moves to errors or returned context predictably;
- browser Back and mobile back return through the actual opening path, including related-object
  context; reload retrieves the stable object route;
- one scroll container per sheet/overlay, no hidden horizontal data, touch targets and numeric
  controls usable at a narrow mobile viewport;
- loading skeletons name their section, not false values; empty is different from unavailable,
  permission denied, archived, deleted/redacted, and offline;
- success renders only after authoritative acknowledgement. Optimistic UI is visibly pending and
  reverts/preserves the draft on failure.

All visible fields show provenance where it changes the meaning: source, actor/time, current
revision, derived calculation, or pending evaluation. Read projections may be stale only with an
honest freshness indicator. [THE-INTERACTION-SPEC.md](THE-INTERACTION-SPEC.md) is authoritative
for the shared surface stack, responsive geometry, focus/scroll/draft return, overlay nesting and
cross-sheet propagation; the control records below remain authoritative for their visible copy and
commands.

### Copy, labels, and control behaviour

Rocoto uses short, familiar, reader-first operational language. The reference point is the
clarity discipline in [Monzo's Writing Principles](https://monzo.com/tone-of-voice): say what
matters to the reader first, use normal words, name the actor and outcome, and be clear and kind
when something fails. Rocoto's copy is original; operational work does not use jokes, marketing
language, or unexplained specialist terms.

Every primary control has a stable control ID, visible sentence-case label, accessible name,
single stated outcome, state-specific help, and a defined Save/Cancel/disabled/error path. Labels
do not rely on a tooltip or placeholder. A generic `Error`, `Manage`, `Explore`, `Details`, or
bare `Expected` label is prohibited when a more precise action or fact is available. Preserve
customer, supplier, and business-entered names as data; do not rewrite them into product copy.

| Term or label | Exact meaning and required treatment |
|---|---|
| **Recorded balance** | Receipt/count movement projection in a stated SKU unit, with last update and last physical count. It is not live warehouse availability and excludes planning estimates. `Still to record` means there is no supporting movement evidence; `0` means a recorded zero. |
| **On hand** | May be used only where a physical stock policy has reconciled the exact location/lot scope. It names that scope and timestamp. Otherwise use **Recorded balance**. |
| **Available to promise** | A separately calculated, dated projection: recorded physical quantity less named reservations/allocations, subject to the tenant's declared exception rule. It never includes a planning estimate, unverified supplier message, or unknown-unit quantity. If it cannot be calculated, say **Availability not calculated**. |
| **Expected delivery** | Supplier-confirmed inbound only. Show supplier, exact quantity/unit, due time, source link, and confirmation state. It does not change recorded balance or promise availability by itself. |
| **Daily stock estimate** | A user-set recurring planning assumption with quantity, time, tenant timezone, owner, and history. It changes no physical balance, availability, receipt, or delivery promise. |
| **Predicted demand** | A model forecast with horizon, evidence, version, and uncertainty state. It is not stock, supplier inbound, or a customer commitment. |
| **Product details & history** | Readable persistent section: current/original identity, description, aliases, classification, source links, field changes, and archive history. It replaces the vague word “dossier”. |
| **Edit details** | Dedicated identity editor only: product/customer name, code, unit where allowed, description, and scoped aliases/contact fields. It never edits price, stock, lot, artwork, category-wide classification, issued document, or connection setting. |
| **Set by percentage** | Explicit reviewed multi-tariff draft. Formula: `anchor price × (1 + percentage / 100)`, rounded to currency precision. €10 with +10% previews €11. It is not gross margin. |
| **Independent tariff prices** | The active Product Sheet has no persistent link/chain toggle. Saving a tariff changes that tariff only; percentage save is the only explicit multi-tariff write. |
| **Checking save** | Network outcome is unknown and being resolved by idempotency lookup. It is neither saved nor failed. |
| **Couldn’t save …** | Name the object and preserve the draft: for example, “We couldn’t save this stock update. Your values are still here.” Never say only “Something went wrong.” |

Buttons lead with the result: **Save details**, **Add contact**, **Create action**, **Record a
stock count**, **Issue albarán**, **Archive product**. Destructive or lasting actions use a plain
consequence sentence, a safe cancel label, and a specific final action. Disabled controls show the
state/capability reason in adjacent text; hidden controls are used only when revealing them would
leak protected information.

### OBJ-02 · Shared control anatomy and leaf states

The following frame applies to every named control in the Customer and Albarán anatomies. It
keeps simple labels from hiding different behaviour. A control ID identifies one visible leaf; its
object-specific section fixes its copy, fields and command. A component may not silently replace a
named label with an icon-only action.

1. **Sheet frame**
   1. The landmark heading names the object: **Customer** or **Albarán** plus its current
      identity/state. A status badge is text as well as colour.
   2. A return control says where it goes, such as **Back to customers** or **Back to sales**. It
      preserves the actual route context, not a guessed home screen.
   3. The primary action has one outcome and one current availability rule. When unavailable,
      adjacent help names the missing capability, lifecycle state or required fact.
   4. A named `More … actions` menu has a visible text label, a keyboard-accessible menu button,
      focus return to its trigger, and only actions valid for the current object/state.
2. **Section frame**
   1. Loading uses the exact section name — for example **Loading contacts…** or **Loading
      lines…** — with a labelled skeleton and safe navigation.
   2. Empty uses the section's explicit empty heading and one permitted next action. It never
      substitutes a zero, a sample, a guessed result, or an absent section.
   3. Ready shows its evidence/freshness when that changes the meaning. A row is a door to the
      named object or opens its declared editor; it is never an unlabelled click target.
   4. A section denied by policy says **You don’t have permission to view [section].** It reveals
      no protected count, identifier, source snippet, contact value or money value.
   5. Offline says **You’re offline. Showing the last saved [section].** A stale timestamp is
      shown. A local eligible draft says **Not saved yet**; it is not merged into the projection.
3. **Editor frame**
   1. An editor has a sentence-case heading, one short purpose sentence where needed, visible
      field labels, current/default values, required/optional marker, inline validation, and
      **Cancel** plus a specific save action.
   2. `Cancel` discards only this editor's local draft and leaves the last acknowledged projection
      unchanged. Closing an editor follows the same rule; a non-empty changed draft asks **Discard
      your changes?** with **Keep editing** / **Discard changes**.
   3. A valid save says **Saving [object]…** while its command is pending. It says **Checking
      save…** only when a network outcome is unknown and idempotency lookup is running.
   4. A validation failure focuses the summary and the first invalid field. A server failure says
      **We couldn’t save this [object]. Your changes are still here.** A conflict says **This
      [object] changed while you were editing. Review the latest version before trying again.**
      Permission says **You don’t have permission to save this [object].** All retain a safe
      local draft until the user cancels or resolves it.
   5. A disabled save gives the concrete reason beside the button, such as **Add a customer name
      before saving** or **Choose a Unit before saving this line.** It is not merely dimmed.
4. **Lasting-action frame**
   1. Archive, merge, issue, dispatch, delivery, correction, void, delete, export and external
      send each open a review/confirmation surface. It names target, consequence, blockers,
      authority and source/history effect before the final action.
   2. Confirmation buttons pair a safe return action with the exact command, for example **Keep
      draft** / **Discard draft** or **Cancel** / **Issue albarán**. A completed action appears
      only after acknowledgement; a provider result waits for its receipt.
   3. A capability/state change while the surface is open turns the final control into a precise
      unavailable state and preserves the review input. It never submits under a stale permission.

## PRD-01 · Product Sheet: exact sellable SKU

### Required structure

A Product Sheet is always one exact tenant catalogue record: a coded `SKU` or an accepted
`UncodedSaleItem`. Its stable order is:

1. identity: current name, Unit, active/archive status, Internal category and Related products; a coded SKU also owns its code, original-source door and approved/pending/missing artwork state;
2. exact-record Albaráns: upcoming/in-flight first, then historical issued/delivered/corrected work;
3. **Patterns**: a quiet contained quantity/order-count/customer card with exact-record evidence;
4. **Product details & history**: original identities, aliases/scopes, Internal category review,
   RelatedItemLink history, source links, artwork history, revisions and archive/restore evidence;
5. for a coded SKU when the separate pricing/tariffs gate is enabled: tariff rows with exact SKU price, currency,
   unit, effective time, source and price-history door; unset is `Set price`, never zero;
6. for a coded SKU when the separate inventory/supplier-intake gate is enabled: **Recorded balance**, lots, Stock
   update handoff and compact source evidence; source reader stays subordinate to Stock update.

An Internal category/group and Related products link do not get this layout. A Related products selector
can reveal deliberately linked catalogue records, but another coded SKU's price, stock, buyer graph, artwork approval
or order history is never drawn as the current SKU's fact.

### Product Sheet state matrix

| State | What leads and is writable | Required truth and recovery | Never do |
|---|---|---|---|
| Loading | identity skeleton and route context | section-level loading; cancel/navigation remains safe | show a cached value as current without freshness |
| No selected SKU / empty tenant | catalogue empty state and New product/Upload doors where authorized | explain that no product sheet exists until an SKU is admitted | create a fake default SKU |
| Import awaiting review | source reference/row identity and parse status | original availability, review-queue path, retryable source/review failures | add it to sellable catalogue or price it automatically |
| Imported sparse SKU | original identity and current known name/unit | missing unit/code/Internal category/image/history says unknown/review-needed; disabled price/stock/source bands do not render | infer price, stock, category/group art, buyers or attributes |
| Imported complete SKU | own identity, Internal category and exact order evidence | independent history/source provenance; gates decide tariff/stock/source bands | merge equal names or copy another SKU's data |
| New manual draft | labelled Product name, exact SKU and Unit only | no stable SKU until confirm; drafts survive local validation errors. Internal classification may be retained as a quiet suggestion/default for later Product Sheet review | create on form open, require Placement/manual group filing, show a per-product category/artwork/source review task, or claim AI/provider confirmation |
| New confirmed SKU | stable SKU and own Product Sheet | independent empty history/insights; artwork may be pending | seed another SKU's price, stock, buyer history, art or relation |
| Add variation review | originating SKU context plus original difference and reviewed interpretation | confirmation creates a new independent SKU; Related products remains an existing-record inline link only | mutate origin, create a link from variation/import/manual creation, or treat difference as a freeform child without SKU ID |
| Existing related SKU | same layout/rights as any SKU | own independent tariffs, art, stock, lots, orders and history when gated | inherit category/group or Related products facts silently |
| Editing / save pending | exact edited field, pending marker, Cancel | prior projection remains readable; command key/revision retained | advance history or show saved before acknowledgement |
| Save validation/failure | draft and field error remain | retry/cancel; no derived update from failed write | discard draft, toast success, or mutate sibling fields |
| Revision conflict | latest authoritative field values, local draft, changed-field explanation | explicit reload/compare/reapply path; no automatic high-risk merge | overwrite later edit or hide conflict |
| Permission denied | readable allowed portions and unavailable action | explain capability needed without leaking source/financial content | make a disabled button appear saved |
| Offline | last known projection marked stale; local draft separately marked | queue only eligible command after review; reconcile by idempotency/revision on reconnect | count offline stock/price/archive/art changes as committed |
| Archived | banner and historical Product details & history | read history/sources; Restore only with authority | receive stock, set prices, assign art, or offer new lines |
| Deleted/redacted/expired | safe unavailable/reason state | remove unsafe cache; follow a permitted historical link if one remains | pretend object is merely empty or reveal protected source |

A Unit change is allowed only before price, stock, or albarán history exists. Once any
commercial history exists, a different Unit requires a separate SKU/variant or a governed
conversion policy that preserves historic unit revisions. A Product Sheet's detailed UI and
implementation contract remains [THE-PRODUCT-SHEET-SPEC.md](THE-PRODUCT-SHEET-SPEC.md).


### Product control registry and copy authority

[THE-PRODUCT-SHEET-SPEC.md](THE-PRODUCT-SHEET-SPEC.md) §§10–11 is the field-by-field authority
for Product controls. It assigns stable IDs `PRD-N`, `PRD-P`, `PRD-S`, `PRD-O`, `PRD-E`, `PRD-I`,
`PRD-D`, `PRD-C`, and `PRD-A`; a task or UI change must cite the ID rather than inventing a second
copy rule. The system contract adds these release requirements:

| Control group | Visible labels and menu boundary | Required save/disabled/error behaviour |
|---|---|---|
| Navigation and identity | **Back to catalogue** or **Back to the albarán**; product name/code/**Unit**; image-owned **Upload artwork**/**Replace artwork** pencil; **Internal category**; **Related products**; **Edit details** | return preserves origin/selection; the image action is the only artwork control and opens reviewed artwork; no visible Illustration field/editor renders. Internal category/group never opens a Product Sheet and Related products opens only explicit `RelatedItemLink` endpoints; unavailable states do not leak protected data |
| Prices | **Price** for one tariff; **Tariffs** for two or more; **Set price**, **History**, **Set by percentage**, **Independent tariff prices** | each save targets one SKU/tariff unless reviewed percentage save is confirmed; stale/invalid values stay in editor; no chain/link toggle |
| Stock | **Recorded balance**, **Receive stock**, **Record a stock count**, **Lots**, **Daily stock estimate**, **Stock history** | receipt/count command must be acknowledged before balance changes; estimate uses a separate planning rule and can never alter recorded balance |
| Orders and source evidence | **Upcoming orders**, **Order history**, **Show all N orders**; when gated, **Source evidence** | rows use exact SKU evidence; unavailable source says why and returns to product context; Stock update owns incoming feed/source reader, not a peer Products/Catalogue inbox |
| Insights | **Patterns**, **Orders**, **Quantity ordered**, **Customers**, **Typical order** | contained card states exact SKU/order window/unit; no fake or other-SKU data and no dead Explore action |
| Details and archive | **Product details & history**, **Reference classification**, **Detail changes · N**, **Archive product**, **Restore product** | readable details are separate from editor; archive confirmation names retained history/outstanding work; restore does not invent data |
| Create and artwork | **New product**, **Add variation**, **Review product**, **Create variation**;  after confirmation, image-owned **Upload artwork**/**Replace artwork** pencil | ordinary creation/import has no Placement, Related products candidate, Illustration field or Request illustration control. The confirmed SKU may carry a missing/pending artwork status; only the image-owned action can create a reviewed candidate. Opening a form never creates an SKU or provider job; failures retain original words and pending state |

`Edit details` has the only product identity form. Its fixed order is Product name; Your SKU code;
Unit; Description; Names customers use; inline errors; **Cancel** / **Save details**. Product
prices, lots, stock, Internal category/group or Related-products classification, artwork, and archive each use their own named control.
A user can never change a Unit after commercial history through this editor; it explains
**Add a variation to sell in another unit** instead. The detailed spec defines fields, defaults,
validation, conflict copy, menus, and production-versus-kit status for every `PRD-*` control.
## CUS-01 · Customer Sheet: relationship and current work

### Required structure and actions

A Customer Sheet is one tenant customer, not an inferred person record. It has:

1. identity and contacts: legal/trading name, status, verified contacts/channels, contact roles,
   consent/preferences, delivery/account facts, and source/provenance;
2. current actions: create, assign, reschedule, complete, reopen, and dismiss only an explicit
   action; each action has owner, due time, status, links, and completion evidence;
3. frequent products: exact-SKU rows derived from stated completed historical lines and time
   window, with customer-scoped alias where applicable;
4. upcoming work: non-final albaranes grouped by delivery/operational state;
5. history: issued/delivered/corrected/voided documents with their immutable snapshots;
6. **Insights**: a quiet contained card with supported evidence, calculation/rule/model version, validity, and
   source doors; no invented conclusion;
7. **Delivery and Account**: original source identities, aliases, address/contact revision history, permissions,
   archive/merge/deletion events.

An action is not an albarán, an insight is not a contact field, and a frequent product is not a
customer-specific price or standing order. Each has its own owner and evidence.

### Customer Sheet state matrix

| State | What leads and can happen | Required truth and recovery | Never do |
|---|---|---|---|
| Loading | customer route and identity skeleton | clear section loading and safe return | show another customer's cached facts |
| Empty tenant / no customers | onboarding/import invitation and manual customer creation where allowed | contacts/actions/frequent/upcoming/history/insights state why they are empty | create sample customers or fake recommendations |
| New customer draft | source/manual identity, consent/contact fields, validate/save | stable ID only on confirmation; duplicate warning is reviewable evidence | merge/create on matching text alone |
| Imported sparse customer | known identity and source | missing contact/address/consent is visibly unknown; user may fill independently | invent contact, delivery route, tier, or sales history |
| Active customer with no contacts | identity and Add contact action | explicit “no verified contact”; contacts editor works independently | treat an unverified address/email as contact permission |
| Active customer with complete current facts | identity, contacts, delivery/account facts, actions, frequent/upcoming/history/insight sections | each section names its evidence window/freshness and its empty state where applicable | copy another customer's route, tariff, contacts, or history |
| Contact editing/saving/failure | field-specific editor and validation | preserve draft; retry/cancel; audit source/actor after success | lose prior contact or silently change consent |
| Action empty | Create action | named no-action state | imply an AI task exists |
| Action active/completed | status, owner, due date, linked object, completion/reopen history | state change is command-acknowledged and auditable | complete an action because a related albarán changed unless the command says so |
| Frequent products empty | explanation of required completed history | frequency window and exact evidence when present | borrow category/group/Related-products or tenant-wide patterns or turn zero into no demand |
| Upcoming empty | clear no-upcoming state | scheduled/draft/ready work appears only from albarán projection | turn a source message into an albarán without creation/review |
| History empty | clear no-issued/delivered history state | source links remain separate | show customer-wide guessed totals |
| Insights unavailable/pending | insight state, inputs and refresh time | no unsupported card; retry/evaluation explanation | declare an insight from raw absence |
| Editing/saving/failure/conflict | current field/action and retained draft | same acknowledgement/error/conflict rules as OBJ-01 | silently merge customer profile fields that are not permitted low-risk rebase |
| Permission denied | allowed projection with redacted parts | safe explanation and no hidden data | leak contacts, source text, or commercial history |
| Offline | last known profile marked stale plus local draft | sync/revision resolution on reconnect | send contact/action changes or claim a completion |
| Archived/merged | banner, successor link where permitted, historical access | restore or merge review only with authority | erase document attribution or make old ID disappear without explanation |
| Deleted/redacted | safe unavailable state | purge local sensitive cache and follow retention policy | render as a blank ordinary customer |


### Customer Sheet anatomy

The fixed anatomy below is the canonical visible structure. Bracketed IDs identify the single
control record in the following registry; `OBJ-02` supplies the common loading, save, conflict,
permission, deleted and offline mechanics. The page title is **Customer**, not a generic profile.

1. **Customer frame**
   1. **Return navigation** [`CUS-N01`]
      1. Button: **Back to customers** when opened from the list; **Back to the albarán** when
         opened from a linked document.
      2. Behaviour: restores the source list/query/selection/scroll or source albarán. Browser
         Forward restores this sheet. If origin is unavailable, use **Back to customers**.
   2. **Identity header** [`CUS-N02`]
      1. Visible values: customer name, optional **Your customer code**, and status **Active** or
         **Paused**. The name is the sheet heading and the code never substitutes for it.
      2. Status behaviour: **Paused** keeps history readable. **New albarán** explains when a
         tenant policy blocks new work for a paused customer; pause never archives or cancels work.
   3. **Customer actions** [`CUS-N03`, `CUS-N04`, `CUS-D02`]
      1. Primary button: **New albarán**. It opens a new draft preselected to this customer and
         nothing is persisted until that draft is saved. Disabled help is one of **This customer is
         archived**, **This customer is paused for new work**, or **You don’t have permission to
         create an albarán**.
      2. Secondary button: **Edit details**. It opens only CUS-D01.
      3. Menu button: **More customer actions**. Its menu contains **Archive customer**,
         **Merge customer**, and **Export customer data** only when permitted. It is not an
         icon-only overflow or a generic **Manage** action.
2. **Contacts** [`CUS-C01`–`CUS-C03`]
   1. Section heading: **Contacts**. Primary button: **Add contact**. Empty heading: **No
      contacts yet**. Empty help: “Add the person who orders, receives deliveries or handles
      accounts.”
   2. Each contact row names the person, role, preferred contact method and current usable
      channel status. It opens the Contact editor; channel text without consent/verification is
      labelled **Awaiting confirmation** and is not a message door.
   3. The row menu has **Edit contact**, **Make main contact**, and **Archive contact**. **Make
      main contact** is disabled with **Add a usable contact method first** when no permitted
      channel exists. **Archive contact** asks “Archive [contact name]?” and says “This contact
      will no longer be used for new messages. Past orders and messages will still show who they
      came from.” Buttons: **Keep contact** / **Archive contact**.
3. **Actions** [`CUS-A01`–`CUS-A03`]
   1. Section heading: **Actions**. Button: **Create action**. Empty heading: **No actions yet**.
      Empty help: “Create an action when someone needs to follow up.”
   2. A row shows its task, owner, due date and state: **Open**, **Completed**, or **Dismissed**.
      It opens its editor; an overdue state reads **Overdue**, never a red-only signal.
   3. Valid row menu actions are **Complete**, **Reopen**, **Change owner**, **Change date**, and
      **Dismiss action**. Completion cannot be inferred from an albarán state. A completed or
      dismissed item remains in history with actor/time/reason.
4. **Frequent products** [`CUS-F01`, `CUS-F02`]
   1. Section heading: **Frequent products**. Empty heading: **Frequent products show here**. Empty
      help: “Products will appear here after completed albaranes.”
   2. A row names the exact SKU, customer-scoped name when one exists, completed-line count and
      labelled date window. **Open product** opens that SKU in customer context. **Start albarán**
      opens a customer draft with the SKU selected but no persisted line until the draft is saved.
      It says **Set a price before adding this product** or **This product is archived** when that
      is the real blocker.
5. **Upcoming and history** [`CUS-O01`, `CUS-O02`]
   1. **Upcoming** shows draft, ready, prepared, scheduled or dispatched albaranes only. Empty
      heading: **Upcoming albaranes show here**. Each row uses its current state, delivery date when
      known and an **Open albarán** door.
   2. **History** shows issued, delivered, corrected and voided documents. Empty heading: **No
      past albaranes yet**. **Show all N albaranes** loads the next explicit page and preserves
      earlier records; it never silently replaces history with a time-window summary.
6. **Insights** [`CUS-I01`, `CUS-I02`]
   1. Section heading: **Insights**. Empty heading: **Insights show here**. The quiet contained card
      shows only a supported reading with its evidence window, calculation/model version and last
      refresh.
   2. **Show evidence** expands permitted albarán/source facts; **Hide evidence** closes it and
      returns focus to the control. A pending card says **Checking customer activity…**. It never
      presents a prediction as a measured fact or creates a customer field.
7. **Delivery and Account** [`CUS-D01`, `CUS-D02`]
   1. The persistent readable cards are **Delivery** and **Account**; they are visible, never hidden in a catch-all disclosure. It contains current and
      original identity, aliases/scopes, price list, delivery facts, changes, archive/merge events
      and source doors. It is not called a dossier and does not expose a mixed editor.
   2. **Edit details** opens the identity/account form only. Contact editing, an albarán's delivery
      snapshot, prices, stock and history each retain their named control.

### Customer control registry and copy authority

The Customer Sheet uses `CUS-*` control IDs. It is a record of a house's working relationship with
one customer, not a profile inferred from a phone number or a sales chart. The fixed reading order
is **Customer** → **Contacts** → **Actions** → **Frequent products** → **Upcoming** → **History** →
**Insights** → **Delivery and Account**. Sections stay visible with precise empty copy; they
do not disappear and make the sheet look complete by omission.

| ID | Visible control and exact copy | Job, defaults, and boundary |
|---|---|---|
| CUS-N01 | **Back to customers** / **Back to the albarán** | Returns to actual origin, query, selection and scroll. Forward restores the sheet. |
| CUS-N02 | Customer name; optional customer code; **Active** / **Paused** | Header shows current tenant customer identity. A paused customer is readable and can be used only where tenant policy permits; it is not archived. |
| CUS-N03 | **New albarán** | Starts a draft for this exact customer. Hidden/disabled with a reason if the customer is archived, paused by policy, or the actor lacks authority. |
| CUS-N04 | **Edit details** | Opens CUS-D01 only. It does not change contacts, an active albarán, a tariff's price, a delivery record, or a customer merge. |
| CUS-C01 | **Contacts** / **Add contact** / **No contacts yet** | Contains named people and permitted channels. An empty state says “Add the person who orders, receives deliveries or handles accounts.” |
| CUS-C02 | Contact row: name · role · preferred contact method | Opens CUS-C03. A contact row never claims consent or a verified channel from an unverified imported value. |
| CUS-C03 | **Edit contact**; **Make main contact**; **Archive contact** | Row menu actions name the person. Archive retains historical source/document attribution. “Make main contact” requires a currently usable channel. |
| CUS-A01 | **Actions** / **Create action** / **No actions yet** | Work items are explicit, assigned, dated records. Empty help: “Create an action when someone needs to follow up.” |
| CUS-A02 | Action row: task; owner; due date; state | One row opens its action editor. No AI recommendation is rendered as an action without an action record. |
| CUS-A03 | **Complete**, **Reopen**, **Change owner**, **Change date**, **Dismiss action** | The menu appears only when that transition is valid. Completion/dismissal records actor/time; dismissal requires a short reason. |
| CUS-F01 | **Frequent products** / **Frequent products show here** | Exact-SKU rows from completed customer history in a labelled date window. Empty help: “Products will appear here after completed albaranes.” |
| CUS-F02 | Product row / **Open product** / **Start albarán** | Product opens exact SKU with customer scope. Start albarán adds nothing until the albarán draft is saved; archived/unpriced SKU action names why it is unavailable. |
| CUS-O01 | **Upcoming** / **Upcoming albaranes show here** | Shows draft, ready, prepared, scheduled and dispatched work by named state. Each row opens its real albarán. |
| CUS-O02 | **History** / **Past albaranes show here** / **Show all N albaranes** | Shows issued, delivered, corrected and voided records with their snapshot state. Pagination cannot quietly omit older history. |
| CUS-I01 | **Insights** / **Insights show here** | Quiet contained card. Every reading names evidence window, calculation/model version and refresh time. No prediction is styled as a measurement. |
| CUS-I02 | **Show evidence** / **Hide evidence** | Opens supporting albarán/source facts within the actor's permission scope. It does not create an editable customer fact. |
| CUS-D01 | **Delivery and Account** | Readable current/original identity, customer aliases, price list, delivery details, change history, archive/merge events, and source links. It is not an editor. |
| CUS-D02 | **Archive customer** / **Merge customer** / **Export customer data** | These live in the named **More customer actions** menu, not a generic icon. Each asks for authorization/reason/scope and has its own confirmation. |

#### CUS-D01 · Edit customer details

The fixed menu order is heading **Edit customer details**; Customer name; Customer code; Price
list; Delivery address; Delivery notes; Customer status; inline errors; **Cancel** / **Save details**.
It opens with saved values and expected revision.

| Field/control | Label, default, validation, and save rule |
|---|---|
| Customer name | **Customer name**; current name; required 1–200 characters after trim. Preserve accents/case. Matching names show a review warning, never an automatic merge. |
| Customer code | **Your customer code · optional**; current code; 0–100 characters and leading zeros preserved. Duplicate is a review warning. |
| Price list | **Price list**; current approved tenant tariff or **Use company default**. Only active tariffs appear. Changing it affects future price lookup, not issued documents or customer-specific overrides. |
| Delivery address | **Delivery address**; blank/known structured address. Country, town/city, postcode, address lines and access note are separate fields. A blank address is an honest state; do not infer one from a route. |
| Delivery notes | **Delivery notes · optional**; current text; maximum 2,000 characters. It informs future drafts; a prepared/issued albarán retains its delivery snapshot. |
| Customer status | **Active** default for a new customer, or **Paused** with required pause reason. Pause never archives history and cannot silently cancel work. |
| Cancel / Save details | **Cancel** discards only this draft. **Save details** validates and sends expected revision. On failure: “We couldn’t save this customer. Your changes are still here.” On conflict: “Someone changed this customer while you were editing. Review the latest details before trying again.” |

#### CUS-C03 · Contact editor

Heading **Add contact** or **Edit contact**. Field order is Contact name; Role; Phone; Email;
Preferred contact method; Can receive order updates; inline errors; **Cancel** / **Save contact**.
Contact name is required. Phone and email are optional individually, but at least one usable channel
is required before selecting a preferred method or enabling order updates. Roles are **Ordering**,
**Delivery**, **Accounts**, and **Other**; default is **Other**. Order-update permission is off by
default and can be enabled only with an eligible channel and recorded consent/provenance. Save error:
“We couldn’t save this contact. Your changes are still here.” Archive says: “This contact will no
longer be used for new messages. Past orders and messages will still show who they came from.”

#### CUS-A03 · Action editor and high-risk menu

Heading **Create action** or **Edit action**. Fields are **What needs doing?** (required, 1–500
characters), **Assigned to** (current actor by default when eligible), **Due** (**Today**, **Tomorrow**,
or **Choose date**), and **Related albarán · optional** (same customer only). Buttons are **Cancel**
and **Create action** / **Save action**. Past due dates require an explicit **Save anyway** choice;
the system never silently changes them. Complete asks **Complete this action?** with optional
**What happened?**. Dismiss asks **Dismiss this action?** with required **Why is it no longer
needed?**. Failures retain inputs: “We couldn’t create this action. Your details are still here.”

**Merge customer** opens a separate review: **Find the customer to merge with**; selected customer;
source/contact/address/albarán impact; **Cancel** / **Review merge** / **Merge customers**. It
requires elevated authority, expected revisions for both records, an explicit canonical survivor,
and reason. It never runs on a name/phone match alone. **Archive customer?** says “They will no
longer be offered for new work. Past albaranes and contacts will stay.” Buttons: **Keep customer** /
**Archive customer**. **Export customer data** opens the normal scoped export job; it never starts a
download on click.
## ALB-01 · Albarán Sheet: commercial and fulfilment truth

### What the sheet owns

The Albarán Sheet is the central continuous work object. It begins with a manually entered or
source-linked request and progresses through review, fulfilment, issue, dispatch, delivery, and
correction. The sheet must always show its revision/state, customer, selected business day,
delivery context, and source/actor provenance.

Each line contains distinct editable facts:

| Fact | Rule |
|---|---|
| Original phrase and source evidence | preserved verbatim enough to inspect the native source; normalized resolution is separate |
| SKU resolution | exact tenant SKU ID or explicit unresolved/review state. Internal category/group or Related products is not a substitute SKU. |
| Quantity | exact decimal quantity with declared precision; editing quantity changes only quantity. |
| Unit | selected unit plus frozen unit/equivalence revision. Editing unit changes only unit; it does not pretend a conversion exists. |
| Unit equivalence | explicit product/SKU-scoped equivalence revision, factor, dimensional basis, precision, and source. Unknown stays unknown. |
| Rate/price | exact decimal currency amount per stated Unit, tariff revision or manual pin source, tax treatment, and effective time. |
| Total | server-calculated from allowed quantity/rate/tax rounding policy; client cannot save an independent total. |
| Class | internal free text/recommendation with provenance; it never prints on the customer document unless a configured legal profile explicitly requires it. |
| Lot | authentic lot identity or intentionally blank/no lot recorded. A generated placeholder is forbidden. |
| Freeform note | full text attached to exact line or document with actor/time; it cannot silently become a variant, SKU alias, or class. |
| Concern | one or more exact target scopes: source block, line, field, or explicit line group, with evidence/predicate version and independent lifecycle. |

A physical conversion preserving a quantity/total is a separate explicit operation with source and
equivalence; it is not a unit-label edit. Unit/rate conflicts block issue until resolved. Manual
price pins are labelled and retain their reason/source. A document uses the tenant's tax/legal
profile; it cannot issue in production with a missing required profile.

### Money, document issue, and reprint

Draft lines can show a current tariff-derived rate or pending price. `document.issue` validates
all required lines, permissions, tax/legal profile, unit/equivalence, stock/exception policy, and
customer/delivery information. It records an immutable document revision containing customer and
seller snapshots, line SKU IDs and names, original quantity/unit/equivalence revisions, rates,
tax, totals, price sources, rounding policy, lots/classes where configured, and content hash.

`print.request` references a document revision and rendering profile. Reprinting references that
same revision. It cannot recalculate money or update a price history. A material correction after
issue creates a governed successor revision, correction/credit, or void according to the tenant's
legal configuration, with linked source and audit. A print queue acceptance is not proof of paper
output; a printer/provider receipt or user-confirmed manual result is separate.

### Concerns and native source

A concern carries type, precise target, original evidence references/revisions, rule/model version,
state, actor/timestamps, and causal event IDs. Response concerns visibly enclose the native source
block. Check concerns enclose only the affected field, line, or declared line group in red; color
is supplemented by text and programmatic semantics. Multiple concerns can coexist. Editing an
unrelated line, printing, navigation, or dismissing another concern cannot resolve one.

Resolution is an authoritative event after the relevant evidence/rule is re-evaluated. Dismissal
is scoped to that evidence revision and keeps the reason. A failed save leaves the concern active.
A source email/message remains native text/media/thread evidence. The sheet exposes actual reply
capability from the connected channel; forwarding-only remains read-only and is never styled as a
live reply control.

### Albarán state matrix

| State | What is editable / shown | Required result and recovery | Never do |
|---|---|---|---|
| Loading | stable route/context skeleton | section loading, safe back, no stale data presented as current | show a different albarán cache |
| New manual draft | customer, delivery, lines, source-free note | validation and explicit save create stable work ID | issue/print/send a non-persisted draft |
| New source-linked draft | native source, extracted proposal, line evidence | source remains native; user/authorized automation creates/reviews lines | overwrite source words or claim it was replied to |
| Empty/incomplete | missing customer, SKU, quantity, unit, rate, legal, allocation, or delivery requirements | exact blockers and permitted completion action | fill missing unit, price, lot, or customer from a guess |
| Review/concern state | exact scoped concern(s), editable target, source block | re-evaluate after relevant successful change; independent dismissal/reason | resolve from unrelated edit or hide red scope |
| Ready for preparation | validated commercial draft and disclosed stock/exception state | prepare/allocation actions use current revision | treat a reservation as physical pick/delivery |
| Preparing/allocated | exact lot allocation/quantity, pack/class/note | record partial/failed allocation and retry; preserve lot evidence | allocate category/group or Related-products stock or generated lots |
| Editable pre-issue | separate quantity, unit, rate, class, lot, note controls | each write has its own command/acknowledgement/revision | let total be independently editable or auto-convert unknown units |
| Saving / evaluation pending | per-field pending state; concerns may say checking | retain draft and identify command outcome | announce success or resolution before server acknowledgement |
| Validation/save failure | field/line error and intact draft | retry/cancel and no state advance | clear a line, publish total, or resolve concern |
| Revision conflict | authoritative line/document plus local draft and changed evidence | explicit comparison/reapply path; high-risk facts need deliberate command | silently overwrite quantity/unit/rate/lot/status |
| Permission denied | readable safe portions and unavailable action | explain capability/state condition | show an action as successful or disclose protected source |
| Offline | last confirmed revision marked stale; local draft separately marked | no issue/print/send/stock commit; queue eligible safe draft commands then reconcile | promise delivery, freeze money, or resolve concerns locally |
| Issued | immutable document revision, legal/print profile, output history | reprint/download exact revision; corrections create linked new act | alter commercial snapshot in place |
| Dispatched/delivered | delivery event evidence, times, actor/provider/manual proof | correction/exception and history paths remain | infer delivery from queue/start click |
| Corrected/voided | links to prior/successor documents and reason | retain all snapshots and audit; output scopes identify revision | erase original or relabel it as current |
| Archived | historical readable context | audit/reprint if policy permits; no ordinary editing | make it disappear from customer/SKU history |
| Deleted/redacted/expired | safe unavailable state and legal retention explanation | remove unsafe client cache | render as a blank draft or allow reuse of number/ID |

### Albarán Sheet anatomy and control registry

This is the literal interface for one continuous fulfilment record. IDs are stable: `ALB-N`
(navigation/header), `ALB-S` (native source), `ALB-L` (lines), `ALB-C` (concerns), `ALB-D`
(delivery and fulfilment), `ALB-O` (issue/output), and `ALB-M` (lifecycle menu). Each leaf also
uses the shared `OBJ-02` state frame. The sheet never calls a queue, proposal or cache a completed
delivery/document.

1. **Albarán frame**
   1. **Return navigation** [`ALB-N01`]
      1. Button: **Back to sales**, **Back to customer**, or **Back to product**, according to the
         actual opener. It preserves route/filter/selection/scroll. Reload opens the stable
         albarán route; Forward restores it.
   2. **Identity and status** [`ALB-N02`]
      1. Heading: **Albarán** followed by the human document number when assigned, otherwise
         **Draft albarán**. Supporting row: customer door, selected business day, state, last saved
         time and source/actor provenance.
      2. State labels are **Draft**, **Needs review**, **Ready to prepare**, **Preparing**,
         **Issued**, **Dispatched**, **Delivered**, **Corrected**, **Voided**, and **Archived**.
         Each is text and semantic state, not colour alone.
   3. **Primary state action** [`ALB-N03`]
      1. A new manual/source-linked object offers **Save draft**. Its disabled explanation names
         the missing customer or required request context.
      2. An eligible reviewed draft offers **Prepare albarán**. It is disabled with a compact
         blocker list headed **Finish these before preparing**: missing product, quantity, unit,
         conversion, price, delivery fact, required lot/allocation or unresolved required check.
      3. A prepared/issued object exposes only the next allowed outcome under ALB-D/ALB-O. A
         state action cannot issue, dispatch or deliver from an unsaved local draft.
2. **Original request and native channel**
   1. **Original request** [`ALB-S01`]. A source-linked record shows the original message or
      attachment with received time, sender/channel, source relation and preserved wording/media.
      **Open original conversation** opens the native-source context and returns to this albarán.
   2. **Reply** [`ALB-S02`]. Where a verified connection permits it, button **Reply** opens the
      connection's explicit reply composer. Its result is **Message sent** only after a provider
      receipt. While sending: **Sending message…**; failure: **We couldn’t send this message. Your
      reply is still here.**
   3. **Read-only/manual request** [`ALB-S03`]. A forwarding-only or unavailable rail shows
      **This connection is read only. Reply in your email.** It does not render a fake reply
      button. A manual draft shows **No linked message** and a labelled **Request notes** field;
      notes are not re-labelled as a native source.
3. **Customer and delivery context**
   1. **Customer door** [`ALB-D01`]. The customer row uses the selected customer name and **Open
      customer** door. **Change customer** is available only before issue and only when
      line/source/price consequences are reviewed; it never changes issued snapshots.
   2. **Delivery editor** [`ALB-D02`]. Section heading: **Delivery**. The read view shows delivery
      date, address, route when set, delivery notes and current fulfilment state. Button: **Edit
      delivery**. Its fields, in order, are **Delivery date** (tenant business day by default),
      **Delivery address**, **Route · optional**, **Delivery notes · optional**, inline errors,
      **Cancel** / **Save delivery**. Existing customer defaults prefill a new draft but become an
      albarán snapshot only after save. A required address/date uses **Add a delivery address** or
      **Choose a delivery date** beside the invalid field. `Save delivery` changes delivery only.
   3. **Fulfilment actions** [`ALB-D03`]. These are state- and role-specific: **Start preparing**,
      **Record allocation**, **Mark as dispatched**, **Mark as delivered**, **Record failed
      delivery**, and **Record return**. Each opens a review with event time (now by default,
      editable only with authority), method, actor and required evidence. **Mark as delivered**
      asks “Mark this albarán as delivered?” and says “Record delivery only when you have delivery
      evidence.” Buttons: **Cancel** / **Mark as delivered**. A dispatch click is never delivery
      evidence.
4. **Lines**
   1. **Lines section** [`ALB-L01`]. Heading: **Lines**. Button: **Add line**. Empty heading:
      **No lines yet**. Empty help: “Add the products this customer asked for.” A draft with no
      lines cannot prepare or issue.
   2. **Product picker** [`ALB-L02`]. **Add line** opens **Find a product**. Field: **Product**
      with placeholder **Search this customer’s products**. Results search exact active tenant
      SKUs and, only in this customer context, their customer-scoped aliases. A result states the
      current SKU name, Unit, price state and matching alias/source. No match says **No
      products found** with **New product** and **Cancel**; an Internal category/group or Related products is never a
      result that can be sold.
   3. **Add/edit line form** [`ALB-L03`]. Selecting a SKU opens **Add line** with fields in this
      fixed order:
      1. **Product** — selected exact SKU; **Change product** returns to Find a product before the
         line is saved.
      2. **Quantity** — required decimal greater than zero, using the SKU/unit precision. Invalid
         input says **Enter a quantity greater than 0**.
      3. **Unit** — required Unit. It defaults to the SKU Unit. A different unit
         must show an approved equivalence revision and converted basis; otherwise it says **We
         need a conversion for [unit] before we can price this line.** The editor never guesses a
         conversion or edits a unit label to change physical quantity.
      4. **Price per [unit]** — current permitted tariff price when one exists; otherwise **Set
         price first**. It accepts a decimal money value only with currency/tax treatment. A
         manual change is labelled **Set a different price**, requires a reason when policy says
         so, and retains tariff/manual-pin provenance.
      5. **Total** — read-only calculated result, labelled **Calculated from quantity and price**.
         It is never a field and cannot be typed or pasted as an override.
      6. **Class · optional** — internal classification text or reviewed recommendation. It is
         not printed unless the effective legal document profile explicitly requires it.
      7. **Lot · optional** — choose a genuine available lot or **No lot recorded**. The list shows
         real code, received, deducted and remaining quantities; it never generates a lot code.
         Quantity above remaining is blocked unless the named tenant exception policy and
         authorization permit it.
      8. **Note · optional** — freeform line note, maximum 2,000 characters, retained with
         actor/time. It does not create an SKU, alias, conversion or class.
      9. Buttons: **Cancel** / **Add line**. A successful save makes one exact line and revises
         its total; the original request phrase stays alongside resolution evidence.
   4. **Saved line** [`ALB-L04`]. A saved line's visible row reads product, quantity + unit,
      **Price per [unit]**, **Total**, class/lot/note status and any scoped concern. Button **Edit
      line** opens the same field form with **Cancel** / **Save line**. A save changes only
      explicitly changed editable facts and reruns affected pricing/allocation/concern evaluations.
      Error: **We couldn’t save this line. Your changes are still here.** Conflict: **This line
      changed while you were editing. Review the latest line before trying again.**
   5. **Remove line** [`ALB-L05`]. The line menu has **Remove line** before issue. It asks “Remove
      [product name]?” and, where source-backed, says “The original request will stay linked to
      this albarán.” Buttons: **Keep line** / **Remove line**. After issue, row changes use
      correction, not removal.
   6. **Unit equivalence door** [`ALB-L06`]. This appears beside any non-default unit: label **How
      this unit converts**, factor, precision, source, effective revision and **Open unit policy**
      when authorized. It is a separate governed relation; a line editor cannot invent it.
   7. **Order-review line dispositions** [ALB-L07]. The active profile is
      unvalued: a line displays product, quantity, unit, optional final weight and attached note.
      Price, tax, unit price, line total, document total and lot allocation are not rendered or
      required. The full ALB-L03/L04 commercial fields above become active only when
      ProductCapabilityProfile enables albarán values and pricing.
      1. **Exact SKU** — normal line linked to one tenant SKU.
      2. **Field check** — one thin red boundary encloses only the exact field, full product row or contiguous rows at issue. One short dismissible colleague-style reason sits immediately above it; no floating note or unrelated red row follows.
      3. **Off-SKU provisional** — grey italic literal row with **Accept once**, **Edit** and **Reject**. Accept records a one-off only; it creates no SKU, alias, Internal category, Related products, artwork, stock, ERP data or outbound message.
      4. **Multiple SKU choice** — compact question/product hybrid with clear candidate options, image, literal name, SKU and unit; no default selection. A selected candidate reflows to a normal product row. **Something else** moves to off-SKU review.
      5. **Reply attention** is orthogonal and immediately above the matching native conversation source card. The full Albarán, composer tray and condensed order-in-chat card use the same exact scope, reason, dismissal and re-evaluation lifecycle; native handoff cannot send through Rocoto.
   8. **Disposition persistence** [ALB-L08]. Every decision records tenant/order/line/source
      revision, prior disposition, exact field or candidate set, actor/time and supersession.
      Canonical commands are `CorrectOrderLineField`, `AcceptProvisionalOrderLine`,
      `RejectOrderLine`, `SelectOrderLineSKU`, `RejectOrderLineSKUCandidates` and
      `DismissReplyAttention`. Their accepted events are respectively `OrderLineFieldCorrected`,
      `ProvisionalOrderLineAccepted`, `OrderLineRejected`, `OrderLineSKUSelected`,
      `OrderLineSKUCandidatesRejected` and `ReplyAttentionDismissed`. Candidate rejection carries
      the complete candidate-set evidence and converts the same literal line to off-SKU review; it
      creates no SKU. Browser state may stage the choice but cannot acknowledge an accepted order
      line. A model proposal alone cannot select, accept, reject, dismiss or contact the customer.
5. **Checks and concerns**
   1. **Exact-scope concern** [`ALB-C01`]. Section heading: **Checks**. A concern encloses exactly
      its source block, line, field or named line group in red plus icon/text. The label says
      **Check this [field/line]** and shows the specific rule/evidence version and source door.
      Red never spreads to unrelated lines.
   2. **Fix it** [`ALB-C02`]. This button moves focus to the exact editable target. On successful
      relevant save, the system says **Checking this change…** and re-evaluates that target only.
      It says **Check resolved** only after a resolution event.
   3. **Dismiss check** [`ALB-C03`]. This opens **Dismiss this check?** with **Why are you
      dismissing this check? · optional**, scope/evidence revision, **Cancel** / **Dismiss check**.
      The explanation is a free-text field; no preset reason buttons, chips or category picker.
      Dismissal is authorized, audited and applies only to this concern/evidence revision. It never
      resolves a sibling concern or hides an unresolved required blocker.
6. **Issue, document and output**
   1. **Issue availability** [`ALB-O01`]. Button **Issue albarán** is available only after all
      issue requirements pass and an actor has finance/document authority. Disabled copy is
      **Finish these before issuing** followed by the exact missing profile, line,
      customer/delivery, unit/equivalence, stock/exception or concern fact.
   2. **Issue review** [`ALB-O02`]. The review is headed **Issue albarán?**. It shows
      customer/seller legal snapshot, delivery snapshot, every line's quantity/unit/rate/tax/total,
      document profile, total, source/manual price indicators, required checks and the
      immutable-revision consequence. Buttons: **Cancel** / **Issue albarán**. Failure says **We
      couldn’t issue this albarán. Nothing has been issued.** An unknown outcome says **Checking
      issue…** and resolves via idempotency.
   3. **Document actions** [`ALB-O03`]. Once issued, the document section shows **Document
      revision**, profile, issue time, content revision and output history. It offers **Print**,
      **Download PDF**, and **Send by email** only when policy/connection/capability permit. Absent
      rail help is explicit, for example **Connect an email service before sending this document**.
   4. **Output state** [`ALB-O04`]. Exact words are **Print requested** until printer receipt;
      **Download started** for browser download; **Email queued** until provider acceptance;
      **Email sent** only after provider receipt; **Delivery failed** with retry/repair state.
      Printing/reprinting always references the named issued revision and never recalculates money.
7. **Lifecycle menu**
   1. **More albarán actions** [`ALB-M01`]. Pre-issue it may contain **Archive draft** and
      **Discard draft** only if retention/policy permits. **Discard draft** says “Discard this
      draft? The original message will stay.” Buttons: **Keep draft** / **Discard draft**.
   2. **Correction and void** [`ALB-M02`]. Issued work offers **Create correction** and, for the
      proper finance/legal authority, **Void albarán**. **Create correction** opens a
      successor/review record; it never edits the issued lines in place. **Void albarán** asks for
      **Why is this being voided?** (required), explains that the original will remain in history,
      and uses **Cancel** / **Void albarán**.
   3. **Archive draft** [`ALB-M03`]. It says “This draft will leave active work. Its history will
      stay.” Buttons: **Keep draft** / **Archive draft**. Archive does not delete the
      document/source ID.
   4. **Unavailable history** [`ALB-M04`]. Deleted, redacted and expired records show the safe
      `OBJ-02` unavailable state. Document number, source text and protected person/contact data
      are not exposed merely because an old route was visited.

## CAT-01 · Catalogue admission, Internal category, Related products and artwork

Catalogue actions are deliberate and reviewable:

1. register the external source reference, validate format/security and read content transiently;
2. parse source rows into proposals with row/span evidence and parser version;
3. suggest Internal category, aliases, Unit and visual description without changing
   commercial facts; ordinary creation/import does not solicit or retain Related products candidates;
4. let an authorized person review/edit/confirm or leave Internal category **Not organised**;
5. create/modify the tenant SKU through a revisioned, idempotent command; only **Edit related products** can write a direct RelatedItemLink; a variation is a separate new
   SKU and never writes a relation as part of creation;
6. open the exact SKU's own Product Sheet; pricing/history enters only when its independent gate is
   enabled;
7. queue optional artwork work only after approved visual description, policy and budget checks.

`CreateSKU`, `CreateVariationSKU`, `UpdateSkuDetails`, `ReviewAlias`, `ReviewInternalCategory`,
`ChangeRelatedItemLink`, `ArchiveSKU`, and `RestoreSKU` are separate commands. A no-op review, rejected proposal, duplicate
submission, parser failure, or artwork failure preserves the source/proposal and never creates an
unpriced ghost SKU or mutates a sibling.

Artwork has its own `SKUArtworkAssociation`, candidate asset, provenance, approved revision, and
lifecycle: missing → requested → queued → generating → review → approved; failed/cancelled retain
retry/cancel evidence. Only a provider receipt advances an external job to generating. The last
approved SKU asset remains visible while a replacement awaits review. The detailed AI/image
contract belongs to [THE-INTELLIGENCE-SPEC.md](THE-INTELLIGENCE-SPEC.md); this section requires
that a category/group or Related-products image never becomes an automatic SKU assignment.

### CAT-01.1 · Recurring customer options and preparation notes

A `CustomerOptionDefinition` is a customer/request record with tenant/account permission scope,
optional customer or brochure scope, original wording, cadence/window, source evidence, owner, and
lifecycle/revision. Its text fields are separately tagged `internal` or `customer-approved`: a
customer-approved option description may coexist with an internal preparation instruction. It may
state preparation, pack, declared weight, an approved base SKU, and a permitted commercial
treatment. It is not a product master. It cannot own stock, a tariff, artwork, a standalone product
line, or an external master record. `SaleLine.prepNote` is internal bench/packer work and never
becomes customer-confirmation copy merely because an option recurs.

Where an option is used, the albarán line stays an exact approved base SKU and carries an immutable
`OptionLineSnapshot`: option-definition/source IDs where present; the customer-approved
presentation, separately retained internal preparation instruction, pack/weight facts, base SKU
and tariff/price revision, currency/tax, explicit line surcharge or final line-unit price,
reviewer/approval, and policy revision. The option can change that line's preparation and
commercial fact, but cannot mutate the base SKU, its tariff, stock, Internal category/Related-products, or another order. Only
`customer-approved` wording can appear in a customer confirmation; internal text remains internal.

Recurrence is evidence of demand, never catalogue admission. It may remain a note indefinitely.
Only an authorized, explicit `CreateSKU`/`CreateVariant` confirmation creates a tenant SKU; that
command records the option/source as causation and still requires normal SKU identity, unit,
commercial policy, and review checks. A request can instead be rejected, deferred, attached as a
customer-scoped alias, or represented as an approved base-item note without changing the
catalogue. No job, import, intelligence proposal, confirmation, or ERP response may infer this
command from repeated use.

### CAT-01.2 · Option quote, acceptance, and change control

A quote/confirmation snapshots the exact base-line commercial fact and any approved option
surcharge/final unit price. A later daily price update, option-definition edit, preparation edit,
or policy change does not rewrite an accepted quote or issued document. A proposed material
commercial change creates a new review/confirmation revision and requires the configured
reapproval before it can replace the accepted terms. The original option and every prior snapshot
remain readable to authorized roles with their audience and source provenance.

## SRC-01 · Imports, supplier sources, and related email

### Inbound source contract

Inbound routes accept only configured tenant mailboxes, authorized uploads, verified webhooks, or
scoped manual capture. They record connection/source identity, received time, permitted metadata/checksum, external reference, declared media type/size, scan outcome, parser version and retention class. Raw inbound email bodies and incoming file bytes are transient only in Rocoto. Original custody stays with the provider/user. Rocoto persists authorized source references, minimal reviewed business facts and actor/parser lineage; it cannot reconstruct a missing original from a summary. THE-SOURCE-PRIVACY-SPEC governs fetch, cache, logging, model input, deletion and legacy cleanup. Suspicious, oversized, unsupported, duplicate, or unverified artifacts are quarantined
with reason and recovery path; they do not reach parsers, AI, stock, or external send queues.

A supplier email can contain an availability list, invoice-like attachment, receipt, change note,
or a source clue. It is source evidence, not a peer Products/Catalogue seat. Its relationships are
source links to an import batch, SKU, lot proposal, or albarán. A source link records evidence
span/row, relationship kind, confidence/review state, actor/model, and current target revision.
A Product Sheet shows only compact **Source evidence** links for its exact SKU, with an empty
**No related source evidence** state and native source return context. Stock update owns the
source-reader/feed only when the separately gated inventory-and-supplier capability is enabled.

### Upload utility (UTL-03)

**Add a product list** is the secondary path inside **New product**. It replaces the identity form
inside the same bounded task frame; Back restores that manual draft. Its first surface offers
**Drop a file**, **Paste a product list**, or on a phone **Take photo**. Excel/CSV and pasted rows are reviewable; a selected PDF/photo shows **Automatic review · Ready to connect** until the separately authorised extractor exists, and keeps the source available for manual review without claiming parsed rows. Desktop contains the file/drop and paste controls in one source object; phone presents **Take photo**, **Upload file**, and **Paste** as equal actions. The operator supplies one source at a time. There is no
column mapping, Placement screen, category picker or Related products review before results. It is not
a global utility, Stock tab or parallel action beside Products filters.

| State | Required behaviour |
|---|---|
| Ready for input | name supported file/photo type and size requirements and the pasted-text boundary; accept one source through Take photo, Upload file/drop, or Paste and retain no raw source across reload |
| Reading source | bounded transient read, progress/cancel and checksum or text fingerprint; do not claim a parsed/added record |
| Review needed | show each row/text locator and original wording beside the collective editable Product name, SKU and Unit readback plus duplicate/required-field state and explicit Include/Skip state; require a readback confirmation before Add; every duplicate canonical SKU source row remains separately reviewable and blocks confirmation until corrected or skipped. Internal category, artwork status and source history remain retained evidence or quiet defaults for later Product Sheet review, never per-row intake work. The intake review has no visible Illustration field/editor or artwork-request control |
| Ready | Add commits only included reviewed rows; no automatic decision, provider or model result is claimed |
| Source unavailable | reselect the file or paste again; a prior raw source is not reconstructed |
| Save failed | retain current review decisions, offer retry/keep editing and avoid duplicate SKU creation |
| Added | open one explicitly confirmed exact SKU or continue the queue; do not call the whole source completed |

The shared `CatalogueIntakeSession` / ordered `CatalogueIntakeReviewQueue` grammar is specified in
Catalogue Contract §2.1. Raw file bytes and pasted text remain session-only. The durable seam is a
minimal source reference/checksum or text fingerprint, item locator, reviewed literal facts, result,
actor/time and decision. No ordinary item review creates an Internal category/group write, Related
items link, unit conversion, artwork approval, price, stock, outbound document, provider send or
ERP master. Source/group wording remains evidence. Original download is offered only when the
external/session source is actually available; it is never reconstructed from retained review data.

## INV-01 · Stock, lots, availability, and Stock update utility

[THE-STOCK-LOTS-SPEC.md](THE-STOCK-LOTS-SPEC.md) is detailed **LOT-01** authority. It defines
opaque lot ID versus typed display lot number, explicit Unassigned stock position, shared
split-editor anatomy, receipt/count source semantics, Product **Assign stock to lots**, Albarán-line
commitment allocation, physical depletion, command/API/event boundaries, recall and release proof.
Where older inventory text calls lot-code field an ID, synthesizes code, or calls Product physical
attribution **Allocate stock**, LOT-01 supersedes it.


Inventory is an evidence ledger, not an editable number. A physical movement names exact SKU,
movement type, quantity, unit, declared equivalence revision when conversion is used, location,
lot if known, source evidence, actor, recorded/effective time, and reversal relation where
applicable. Receipt, physical count, physical variance, confirmed physical depletion, adjustment,
transfer and reversal are physical facts. Reservation, allocation and release are commitment facts
for availability. A count accepts zero; it creates a count fact and any variance, not an
overwritten receipt total.

### Recorded stock, availability, inbound, and planning are separate

1. **Recorded balance** is the evidence-only physical projection for the exact SKU/unit/location
   scope. It uses posted receipt, count, physical variance/depletion and reversal facts under the
   declared inventory policy. It shows calculation time and last physical count. It never includes
   a standing rule, planned usage, supplier claim, demand prediction, reservation, allocation, or
   an unknown-unit value. Its history names every physical input. A legacy rule-derived fold is a
   migration/reconciliation item, not a physical movement and not a permitted input to this
   projection.
2. **Lots** retain typed/display lot numbers and opaque IDs, their received, adjustments, deducted and remaining quantities from linked physical facts. **No lot recorded** is honest. A lot is not inferred from a product name, category/group, Related-products or planned delivery. Product **Assign stock to lots** is revision-checked zero-net physical-attribution split across named lots and Unassigned stock; positions still add exactly to Recorded balance. Albarán **Allocate stock** is distinct commitment operation.
3. **Available to promise** is a separate dated calculation: recorded physical quantity minus
   named reservation/allocation quantities under the tenant's approved exception policy. It shows
   its input watermark and refuses to calculate across unknown/incompatible units. It is not a
   delivery promise simply because a number exists.
4. **Expected delivery** is a supplier-confirmed inbound record, separate from stock. It shows
   supplier, quantity/unit, due time, source link and confirmation state. It changes neither
   Recorded balance nor Available to promise unless a later physical receipt is recorded.
5. **Daily stock estimate** is a user-owned recurring planning rule with quantity, time, tenant
   timezone, owner and revision history. It changes no physical movement, Recorded balance,
   availability, lot remaining, receipt or delivery promise. A demand prediction is a separate
   intelligence output and has the same non-physical boundary.

Balances and availability retain calculation time, input watermark, location/lot scope,
reservation policy and unknown components. Quantities of incompatible or unknown units are shown
separately, never added. A lot is a real identity from a supplier/source or authorized internal lot
record. Blank means no lot recorded. Multiple receipts for the same real lot can be joined by that
lot ID; they are not joined merely by label similarity.

### Stock update utility (UTL-01)

| State | Required behaviour |
|---|---|
| Start | choose movement type and exact active SKU; archived SKU requires restore before normal update |
| Locate | choose or create authorized location; display current projection freshness and unknown-unit warning |
| Quantity/unit | validate decimal precision and compatible unit/equivalence; unknown conversion blocks a derived balance/price claim |
| Lot/source | Receipt/count opens LOT-01 split editor: select existing lot or type **Lot number** with source; explicit Unassigned stock is used where policy permits, never generated substitute. Product **Assign stock to lots** is fixed-balance attribution; Albarán allocation is separate commitment command. |
| Preview | display event effect, calculation basis, existing revision, and required exception/approval |
| Commit | send idempotent revision-checked inventory command; show accepted movement separately from projection refresh |
| Conflict/failure | retain entered movement, load latest ledger context, require deliberate retry; no accidental duplicate receipt/count |
| Offline | permit saved local draft only; do not change availability or allocation until server ack |
| Reversal | create a linked reversal with reason and authority; do not edit historical movement |

New product discovery is deliberately absent from Stock update. It routes to UTL-02 with source
context so the user cannot create stock against an Internal category/group, Related products link, raw phrase, or unreviewed candidate.

### UTL-01.1 · Sequential Stock update handoff

The Stock update utility is a chooser, not a second inventory writer. It can hand one active SKU
and one intent to that SKU's canonical receipt/count editor; it carries no quantity, lot, source,
or stock draft. The editor owns validation, LOT-01 split, revision check, inventory command, and
success acknowledgement. The following visible leaves are stable controls:

| Control | Exact copy and behaviour |
|---|---|
| `UTL-B01` | **Find a product or SKU code**. A complete SKU code resolves as an exact folded code identity before name matching. Extra descriptive words after a real product match may remain in the query. |
| `UTL-B02` | **No SKU matches “[phrase]”. Stock is recorded only against an existing SKU.** The only recovery action is **New product**, which opens UTL-02 as a deliberate manual route; it does not create, prefill, price, stock, or select a SKU. More than one real match says **More than one SKU matches. Add a word or use its SKU code.** |
| `UTL-B03` | On one resolved SKU, **Receive stock** and **Record a stock count** open that exact SKU's editor. It names the SKU and says **Nothing has been recorded yet** before a command succeeds. |
| `UTL-B04` | Chooser-origin receipt/count editor primary **Save & next item**. It first commits the same idempotent, revision-checked individual receipt/count and LOT-01 split as the Product Sheet. Only on acknowledgement does it return to an empty Stock update chooser. The next item inherits neither product, quantity, lot, source, validation state, nor draft. |
| `UTL-B05` | **Save and finish** commits the same one independent event and closes the batch handoff. A direct Product Sheet editor retains **Save receipt** or **Save count**; it never receives a batch-next control. |
| `UTL-B06` | Save conflict/failure says the exact stock change could not be saved, preserves the full current editor draft, and cannot advance to another item. Cancel asks whether to discard; **Keep editing** preserves the current item only. |

A batch is a sequence of independently reviewable movements, never a fabricated bulk transaction.
A later item cannot be saved on behalf of an earlier failed item. The resulting history identifies
each receipt/count and its own source/lot state; a missing lot remains explicit Unassigned stock.

## COM-01 · Tariffs, units, taxes, money, and price history

### Exact monetary and unit rules

Money is represented as a decimal string/decimal database value with ISO currency, amount scale,
rounding mode, tax treatment, and unit. Binary floating-point values are rejected at the command
boundary. Price is `(tenant, SKU, tariff, currency, sellingUnit, effectivePeriod, revision)`.
Each tariff owns a separate append-only history for each exact SKU. Multiple changes on the same
day retain ordered timestamps/revisions. Retiring a tariff ends future eligibility but preserves
historic lookup; its ID is never reused.

A `UnitDefinition` has ID/literal labels, dimension, precision, scope, effective period and revision. A Product has one `Product.unit`; [THE-UNITS-SPEC.md](THE-UNITS-SPEC.md) defines reusable `UnitConversion` objects with an exact decimal multiplier and global or product scope. An active product override shadows an eligible global conversion only for its exact SKU. Package contents are never inherited from category/group or Related-products truth; nominal/catch-weight does not authorize exact conversion. Unknown conversion remains unknown. The UI never converts price, total, stock, or physical quantity without a recorded valid conversion revision. Price, lot and stock capability fields appear directly under Unit; no conversion enables them.

Quantity, unit, rate, tax, and total are separate facts. The server calculates total from the
issued draft's quantity × rate and configured tax/rounding policy. A manual rate can pin a line
with actor/reason/source. The client cannot submit a total that overrides calculation. A tariff
switch records its exact effect and only changes the permitted draft/document scope.

### Price operations

| Operation | Command rule | History rule |
|---|---|---|
| Set first price | exact SKU/tariff/unit/currency/effective time and authority required | append price revision; no implicit zero or category/group or Related-products copy |
| Change price | revision check, reason/source where tenant policy requires | append before/after facts; old price remains queryable |
| Customer-specific price | explicit customer + SKU + unit/effective scope, authority, and expiry/review | does not rewrite tariff or other customers' price history |
| Use related price as suggestion | only same Unit and labelled source | acceptance writes a new SKU price; suggestion is not a stored inherited price |
| Retire tariff | authorization and effective time | preserves all price history, prevents new assignment |
| Set by percentage | explicit selected SKU/tariff rows, anchor price, percentage, currency rounding, review of every before/after amount and one authorized atomic confirmation | formula is `anchor price × (1 + percentage / 100)`; €10 with +10% previews €11; it is not gross margin and never a persistent link |
| Independent tariff save | one SKU/tariff/unit/currency/effective-time command with expected revision | changing one tariff does not alter another; the live Product Sheet has no chain/link toggle |
| Change Unit | prohibited after commercial history unless governed conversion policy exists | normally create a new variant/SKU to keep history meaningful |
| Issue document | freeze actual line rate/source/unit/tax/total in immutable snapshot | reprint uses snapshot, never current price |

## DOC-01 · Delivery, print, documents, and output

### Delivery model

Delivery configuration holds service zones, routes/stops, cutoff windows, operating calendar,
carrier/manual posture, evidence requirements, and exception policy. An albarán records a snapshot
of applicable delivery facts when prepared/issued; later route setting changes do not rewrite it.
Preparation, dispatch, delivery, failed delivery, and return each require an event with actor/time,
method, and evidence appropriate to the tenant's policy. A click on “dispatch” is not delivery.

### Export utility (UTL-04) and output jobs

Export is a job-producing utility for documents, daily packs, catalogues, price series, stock
reports, source/audit data, or integration payloads. It cannot change business records.

| State | Required behaviour |
|---|---|
| Configure | choose authorized object/date/selection, format, profile/version, destination, include/exclude archive policy, and test/production scope |
| Validate | name blocked records, required legal/export profile, sensitive-data policy, invalid units, and integration readiness before snapshot |
| Snapshot | immutable selection, aggregate revisions, business timezone, payload hash, content checksum, actor, and idempotency key |
| Queue/run | durable job state and attempts; queue submission is distinct from external receipt |
| Download | browser may say download started; it cannot claim local disk save. Access URL is scoped and expires by policy. |
| Email/ERP/printer | record exact revision/recipient/profile/adapter and provider/printer receipt separately; unknown/stale remains unknown/stale |
| Partial failure | retain per-record outcomes, retry eligible failures with stable idempotency key, do not re-send successful records |
| Cancel/expire | state and reason are audited; cancellation cannot retract an already accepted external result |
| Offline | configuration draft may persist locally; snapshot/submission waits for server acknowledgement |

A print job captures print profile, content revision/hash, copies, target/adapter, attempts, and
receipt/failure. An ERP job captures adapter profile/version, cadence, cursor, idempotency key,
last accepted revision, retry schedule, and reconciliation state. An email job captures recipient,
consent/policy checks, template/document revision, provider message ID/receipt, and bounce/failure.
A download has no provider receipt; it is recorded as delivery of a scoped file URL where policy
requires it.

### Salesperson scope for daily work and output

Every customer and eligible albarán has an explicit responsible member. Every connected WhatsApp
line has its own tenant-scoped connection record and may name an owner member; ownership does not
grant a wider role or access to another tenant. **My customers** and **My orders** resolve from the
signed-in member plus current assignments. A day count is computed from the same filtered
projection that opens and prints those albaranes, so the label, count, selection and output cannot
silently use different scopes.

Daily Print/Files defaults to the signed-in member. The selector uses person chips with name and
recognizable line/number context; **All salespeople** or another member appears only when the current
role can read and output that scope. Selecting a colleague creates a scoped review, not
impersonation, reassignment, or a new messaging grant. The output snapshot records selected member
IDs, actor, business day, document revisions, profile and filters. Activity names **Requested by**
and, where separately confirmed, **Confirmed by**. Reprint retains the original snapshot and links a
new attempt. Revoked access blocks the new request while preserving historical audit facts.

## UTL-02 · New product utility

**New product** and **Add variation** share one recoverable task frame, not identical
unnecessary steps. Direct manual creation collects known identity fields and confirms once. An
Add variation route preserves what was said about the difference, then reviews an editable
interpretation. Original wording, current display name, exact SKU code, Internal category, Unit and a separate existing-record Related products link are distinct facts. Add variation never
creates that link. No opening, typing, AI suggestion or saved proposal admits an SKU.

| Control | Field/step → validation → command → next destination |
|---|---|
| **UTL-N01** | **New product** opens the 800 × 600 task frame at identity. **Add variation** opens the same frame at description with one originating exact SKU as context for the difference, never as a relation write. Unknown source entry carries literal evidence but no assumed SKU/unit/quantity/price. |
| **UTL-N02** | **Product name** and **SKU** have persistent labels and separate fields. Name must be nonempty; newly created SKU code is required and preserved exactly, including case/zeros/punctuation. Validation after interaction; blank initial form is not a stack of error messages. Existing imported no-code records remain readable and need deliberate assignment, not generated identity. |
| **UTL-N03** | **Internal category** is a reviewable suggested finding or deliberate **Not organised** state; it is not a picker/Placement requirement or a one-product/bulk-intake chore. Category/group co-membership never creates Related products. Later Product Sheet classification review preserves all commercial IDs. |
| **UTL-N04** | **Unit** selects a known literal unit or **Other unit…** with a required exact label. A manual new product begins unselected, never guessed kg. Variation may propose its base unit for explicit review. Dimension/precision/package/catch-weight controls follow THE-UNITS-SPEC; an unknown custom unit is not silently weight or piece. |
| **UTL-N05** | **Add variation** asks **What makes this SKU different?** → **Review variation** → editable Product name/SKU/Unit with original words visible. The review is identity-only: correction and missing identity facts may appear, while Internal category and artwork status remain later Product Sheet context; no visible Illustration field/editor renders. Confirmation creates one independent variation SKU and never creates a Related products link. No automatic review is claimed; the user directly edits the literal identity. Back and re-review of unchanged words preserve the person's edits. |
| **UTL-N06** | **Create product**/**Create variation** validates identity and duplicate policy, confirms one tenant SKU under a stable creation request ID and opens its own Product Sheet. Server transaction persists SKU/provenance only; Related products links are separate existing-record edits. No stock, default zero price, price editor or ERP item is created while their gates are disabled. |
| **UTL-N07** | Exact existing code blocks a duplicate. **Open existing product** is an actual explicit door; similar names are review choices, not merges. A retried creation's own existing ID is recovery, not a false duplicate. Runtime resolves unknown outcome by request ID before any retry. |
| **UTL-N08** | **Add a product list** is a secondary action inside New product. Its one intake surface is file/drop, Paste, and phone **Take photo**; Excel/CSV and pasted rows enter the ordered review queue, while a selected PDF/photo has the honest **Automatic review · Ready to connect** recovery and remains manual-review evidence without a parsed/queued claim; no column mapping, Placement or Related products review appears before the queue. An attached source renders as one contained evidence card with **Remove** and **Replace**/**Retake photo**. Immediate draft handoff keeps that card and current review until the person returns or finishes; icon-only Back restores the unchanged identity draft and creation ID. Raw file/photo bytes and text are session-only; only a minimal source reference/checksum or text fingerprint, locator, reviewed literal facts and decision may persist. Returning never silently applies queue rows to the manual draft. |
| **UTL-N09** | Dirty Close/Cancel/Back/route uses Keep editing/Discard or an intentional saved draft; failure preserves text/context and names what saved. Browser split stores are only kit evidence: stable creation ID supports recovery but is not the production transaction. |
| **UTL-N10** | After SKU confirmation, the image-owned **Upload artwork**/**Replace artwork** pencil can enter the independent per-SKU artwork candidate/review state. There is no creation-step artwork request, **Request illustration**, **Review later** or visible Illustration field. Any future provider request remains a separate reviewed capability and must not be represented as a provider outcome. Image failure leaves a usable SKU and truthful image state. Pricing begins only after its independent gate, never as a condition or automatic follow-up of creation. |

**Save proposal** remains available where an uncertain source/interpretation needs later review;
it stores the original evidence, proposed fields and decisions but no sellable record. Reject/defer
are auditable decisions on that proposal. Recurring notes need not ever harden into SKUs.

### UTL-02.1 · Product-request policy and ERP representation

The tenant policy `productRequests.suggestNewSkus` defaults to `false`. When off, a recurring
customer request stays an option/preparation note or, if a person explicitly saves it, a
`CatalogueProposal` indefinitely. It does not open or create an SKU because a request recurs. When
on, Rocoto may offer a reviewable proposal draft with source/cadence evidence; explicit save and
the separate confirmed catalogue command are still required before any SKU is created, provisioned,
priced, stocked or exported.

`productRequests.erpLines` defaults to `base-item-note`. It has exactly two values:

- `base-item-note`: an approved configured ERP base item is exported and only a separately
  approved customer-option description is carried in the permitted line note/snapshot; internal
  preparation wording is excluded;
- `mapped-variation`: an existing, reviewed tenant-SKU-to-ERP-variation mapping is exported.

ERP/accounting remains the external data and invoicing authority. An unprovisioned option or new
SKU never silently creates an ERP product master. An option export carries its approved base item,
customer-approved option description, and the line's financial fact (surcharge or final unit price)
only when the selected destination supports that field and the mapped variation/base-item policy.
Internal preparation text is never exported as customer copy. Before an ERP output job snapshots
data, it validates the selected policy, existing ERP item/mapping, units, legal/value policy,
option audience, financial-field capability, and adapter readiness. A missing mapping/base item or
unsupported note/surcharge/final-price field leaves the order/export in an explicit blocked review
state with the reason and next permitted action; it never drops the option or financial fact to
force delivery. Retry reuses the same idempotency key and does not invent an external master.

## INT-01 and INT-02 · Intelligence boundary

[THE-INTELLIGENCE-SPEC.md](THE-INTELLIGENCE-SPEC.md) is authoritative for predictive AI,
interactive AI, proposals, evaluation, and image generation. This system specifies only these
non-negotiable boundaries:

- intelligence reads tenant-authorized, retention-eligible evidence through typed views;
- every model/provider call carries purpose, tenant, input evidence IDs/revisions, prompt/model
  version, policy/budget decision, output ID, cost/usage metadata, and outcome;
- its outputs are proposals, explanations, concern evaluations, or image-job state, never direct
  mutation of a commercial aggregate;
- a human or authorized deterministic policy invokes the same command path used by the UI;
- AI cannot archive/merge an SKU, set a price, issue/print/send a document, change stock, resolve
  a concern, change roles/settings, or contact a customer without an authorized command;
- model failures, unavailable providers, budget exhaustion, and unsupported confidence return
  honest unavailable/pending states; they do not turn into a synthetic answer;
- tenant data, customer aliases, and test data never cross tenant/evaluation boundaries.

## INTG-01 · Integrations and synchronization

Human salesperson calling is governed in detail by
[THE-VOICE-CONNECTION-SPEC.md](THE-VOICE-CONNECTION-SPEC.md). It extends this integration boundary
with regulated number/forwarding setup, routes and schedules, browser/Android call UI, independent
call/recording/transcript/identity states, opaque provider custody, failure recovery and staged
release evidence. It does not authorize the separate AI voice runtime or make a Kit call preview a
provider call.

Every external rail is an adapter with a versioned profile, scoped secret reference, connection
state, health, webhook verification, idempotency, replay policy, and audit. A connection state is
one of `not-configured`, `authorizing`, `connected`, `degraded`, `paused`, `revoked`, `failed`, or
`removed`; UI copy reflects the actual state and last verified time.

| Rail | Inbound boundary | Outbound boundary | Required truth |
|---|---|---|---|
| Mailbox/email | verified provider webhook or authorized poll → source reference + transient access | authorized reply/document-email job → provider receipt | connected mailbox does not imply permission to send; forwarding-only stays read-only |
| Customer messaging | verified inbound message/media → source/event | explicit message job → provider receipt/status webhook | sent/seen/delivered are distinct provider facts |
| ERP/accounting | signed/authorized import → source/adaptor mapping | immutable export snapshot → adapter acknowledgement/cursor | queueing is not synced; profiles are versioned and reconciled |
| Printer/file delivery | print/download request | adapter/spool receipt or scoped-file delivery | browser/download cannot prove physical print or disk save |
| Delivery/carrier | webhook/poll evidence or manual authorized proof | dispatch/delivery job where connected | no status inferred from route scheduling |
| Identity/SSO | identity assertion with tenant-membership check | session/revocation lifecycle | external identity never bypasses tenant capability checks |
| Billing provider | signed provider billing event | subscription/payment method portal request | Rocoto subscription state is separate from a distributor's customer receivables |

Webhook ingestion verifies origin, signature, timestamp/replay window, schema, tenant/connection
mapping, and idempotency before recording a source/receipt. Adapter retries use exponential bounded
backoff, a dead-letter/review state, and manual replay with a new attempt audit. Sync cursors advance
only after durable accepted processing. Reconciliation compares source snapshot/revision against
last acknowledged external state and records divergence instead of overwriting either side.

## ADM-01 · Administration, billing, data, and settings

Administration is a tenant-owned configuration area. Every setting has its own revision, actor,
effective time, validation, save acknowledgement, audit record, and scope. Tenant settings and
personal preferences are separate. All setting editors support loading, editable, validating,
saving, saved, validation error, conflict, permission denied, offline draft, and archived/deleted
states; no setting reports saved before the server acknowledgement.

| Administration domain | Concrete settings and actions | Guard / state rule |
|---|---|---|
| Organization and legal profile | trading/legal name, identifiers, addresses, logo, locale, time zone, currency, document numbering, tax/legal document profile, fiscal contacts; edit, verify, archive/replace profile | issue/export is blocked if its effective legal profile is incomplete; historical documents retain their snapshot |
| Business calendar and operations | business day boundary, weekdays, holidays, cutoffs, service windows, minimums, lead times, delivery zones/routes, locations, stock policy, exception policy; create/edit/reorder/retire | effective-dated changes never rewrite existing albarán snapshots; conflict shows current rule and affected future work |
| Team and access | invite, role/capability grant, role change, suspend, remove, ownership transfer, session revoke, break-glass approval/review | owner-only acts require strong authentication; suspension immediately ends new command/subscription access; no self-escalation |
| Security and privacy | MFA requirement, allowed domains/SSO, session duration, source visibility, export approval, retention classes, legal hold, consent wording, data-region policy; edit/review/export audit | lowering protection needs owner authority and reason; active legal hold blocks destructive removal |
| Catalogue and commercial policy | tariff registry, tax categories, unit/equivalence policy, price approval policy, customer-price policy, archive policy, reference release selection; create/change/retire/review | tariff/unit changes preserve history and cannot silently reprice documents; reference release rollback is versioned |
| Inventory and fulfilment policy | locations, lot/traceability rules, allocation mode, count approval, negative-stock/exception policy, delivery evidence policy; edit/test/activate | changes are tested against sample/test lineage before activation; incomplete policy blocks relevant final act, not data entry |
| Automation and grants | explicit autonomy grants, threshold/exception rules, notification escalation, agent budget/capability limits; enable/disable/review | grants are tenant-scoped, versioned, revocable, and audit-visible; no grant bypasses required human/legal approval |
| Connections | mailboxes, messaging lines, ERP, optional managed print bridges, carriers, storage, identity, billing; add, authorize, test, pause, reconnect, revoke, remove | secrets are opaque references; each messaging line can have one responsible member; a browser-print preference stores paper/copies, never a local printer name; test uses test lineage; revoke stops future use and preserves receipts/audit |
| Notifications and personal preferences | per-user channels, quiet hours, locale, density, saved filters, default tenant/home, accessibility preferences; edit/reset | personal preference never changes tenant policy; offline draft reconciles as low-risk field-only rebase |
| Billing and plan | plan, contractual status, seat/usage view, invoice history, payment-method portal, tax billing contact, cancellation/reactivation; request/change/approve | only owner/billing authority; subscription billing is separate from customer payment tracking; restricted state preserves read/export rights per policy |
| Data controls | data inventory, imports, export-all, access report, retention schedule, legal hold, DSAR export, rectification, delete/redact request, recovery window; request/approve/execute/revoke | each job is scoped/audited and policy checked; issued documents obey retention/legal limits; export never crosses tenant |
| Test, migration, and support | test mode, fixture reset, migration/import reports, sandbox connection, support access request, diagnostics bundle; enable/run/clear/revoke | test lineage is isolated; clearing test data cannot touch production; support access is time-bound/audited |
| Audit and reliability | audit search, projection health, job reconciler, backup/restore exercise records, incident mode; view/acknowledge/retry authorized repair | repair writes events/attempts; audit data is append-only and access controlled |

No configuration page is a decorative form. Each control has a command, capability, validation,
state, audit trace, and effect model. Disabling a connection, an automation grant, or a member
halts future acts but does not rewrite historic jobs/events. Settings that affect a given albarán,
price, route, or output are snapshotted or effective-dated so history remains explainable.

### ADM-01.1 · Customer-request, confirmation, and ERP policy controls

The **Customer requests and confirmations** settings panel has these independently revisioned
controls. It loads current value plus effective time and audit link; **Cancel** restores the saved
value, **Save settings** is disabled until a valid change, and a conflict/failure/offline state
keeps the draft with a specific retry or review path.

| Control | Field, default, and exact behaviour |
|---|---|
| **Include prices in confirmations** | `confirmation.includePrices: boolean`, default `false`. Help: “Include prices only when this tenant allows valued albaranes.” A priced customer confirmation is permitted only when the actor holds `grants.confirm`, this flag is true, and `config.albaran.values` permits valued output. Turning any one off preserves stored prices and issued snapshots; it removes prices from future eligible confirmations rather than erasing business facts. |
| **Suggest new SKUs from product requests** | `productRequests.suggestNewSkus: boolean`, default `false`. Help: “Repeated requests stay as notes until someone creates a product.” `false` never auto-opens an SKU proposal because a request recurs. `true` permits an evidence-linked review proposal only; it never creates an SKU or external master. |
| **ERP order line** | `productRequests.erpLines: 'base-item-note' | 'mapped-variation'`, default `'base-item-note'`. Choices are **Base item with note** and **Mapped variation**. Help names the configured base item or mapping requirement. Save rejects an unavailable base item, absent reviewed variation mapping, incompatible unit, or no ERP authorization; it leaves the selected policy/draft visible and blocks the affected export rather than substituting a master. |

A user with no administration capability sees the current effective policy only where policy allows,
without mutable controls or protected connection identifiers. Each successful change writes an
effective-dated policy revision and audit event. Every confirmation or ERP export retains the exact
policy revision, base-item/variation mapping, option audience, and financial line snapshot it used.

### ADM-01.2 · Messaging lines and responsible salespeople

A tenant may connect several WhatsApp numbers. Each row shows provider, formatted number, connection
state, last verified time and an optional responsible member as a person chip. A connection is forward-only from its accepted connection time: setup never requests, ingests, backfills, displays or implies access to earlier WhatsApp conversation history. **Add number** starts a
new provider authorization; **Assign salesperson** changes only tenant ownership metadata after a
revision-checked administration command. One provider account/number cannot be silently connected
twice. Unassigned is an explicit state. Pausing, revoking or reassigning a line never rewrites the
source, sender, assignee or receipt captured on an earlier message/order.

Inbound sources retain the actual line that received them. Customer **Main channel** selects an
eligible contact route independently of account ownership. **Open chat** opens the matching connected
conversation; **Send email** opens the email composer when reply is authorized. A member chip is not
a permission grant, and an unavailable line cannot be simulated by a local connected badge.

## OPS-01 · Realtime, presence, concurrency, offline, and operations

### Realtime and presence

Clients subscribe only to tenant-authorized projection topics and receive ordered change notices
with cursor, object type/ID, revision, and permitted summary. They refetch protected detail through
the normal read API. Subscription gaps trigger cursor catch-up; an unbridgeable gap triggers a
full tenant-scoped refetch. Reconnect does not replay events directly into the UI without
projection authorization.

Presence is advisory: active viewer/editor, object, and non-sensitive action category with expiry.
It is not a lock, source of truth, or authorization grant. Tenants can limit presence visibility by
role. A concurrent edit still uses expected revision and conflict handling.

### Offline and sync

The client stores the minimum encrypted, tenant-partitioned offline cache permitted by policy. It
separates confirmed projection, editable local draft, and queued command. Queued commands retain
command/idempotency IDs, expected revision, base hashes, and explicit user intent. On reconnect it
first resolves uncertain outcomes by idempotency lookup, then sends eligible commands in causal
order, then refreshes projections.

Offline never issues documents, dispatches/delivers, prints, sends mail/messages, calls ERP,
changes price/tariff/unit, writes stock/lot, archives/restores, changes settings/roles/billing, or
resolves/dismisses concerns. Those actions become saved drafts/request intents at most. A
reconnected stale draft gets the same server conflict policy; it is never force-applied.

### Operational health and recovery

Each service exposes health, dependency health, queue lag, projection lag, cursor age, job
backlog, reconciliation divergence, provider status, and last successful backup/restore exercise.
Operators receive alerts for tenant isolation failure, event-write error, backup failure,
projection/outbox divergence, dead-letter growth, repeated provider receipt failure, auth anomaly,
and data-export/deletion failure.

Production objectives are: no acknowledged event loss; recovery point objective of five minutes or
less; recovery time objective of sixty minutes or less for core command/read availability; and a
documented, exercised restore/replay procedure. Backups are encrypted, access-controlled, region
policy compliant, and restore-tested against isolated environments. Projection rebuild/replay must
verify counts, hashes, stream sequence, and document snapshot integrity before cutover.

## QLT-01 · Security, privacy, and audit

Security is enforced in depth:

- tenant-scoped database policies plus server-side authorization; no client filter substitutes for
  either one;
- TLS in transit, encrypted data/object storage/backups at rest, secret manager for credentials,
  and scoped signed download/upload URLs;
- secure session cookies/tokens, CSRF/XSS/CSP protections appropriate to the client surface,
  request size/type limits, rate limits, and abuse detection;
- malware scanning and quarantine for every accepted file/media source before broad processing;
- provider webhooks verified before retention/processing, outbound destinations allowlisted through
  connection policy, and egress logged;
- least-privilege service identities, key rotation, dependency/vulnerability patch process, and
  production change approval;
- immutable/auditable administrative and commercial actions, including denied high-risk attempts;
- data minimization: sheets and exports receive only fields needed for the role/action;
- privacy requests, retention, redaction, legal hold, export approval, and break-glass access are
  policy-controlled and auditable.

Audit records are append-only, tamper-evident through controlled storage and integrity checks, and
separate sensitive payload from searchable summary. Reading audit/event/source records is itself
an auditable capability. Support access defaults to read-only, expires automatically, and never
exposes credentials.

## QLT-02 · Accessibility, performance, reliability, and recovery UX

### Accessibility

The production client meets WCAG 2.2 AA for supported browsers/devices. It uses semantic
headings/landmarks, labeled fields, deterministic focus movement, keyboard-only operation,
visible focus, touch-safe target sizes, error summary plus field linkage, accessible numeric/unit
controls, and screen-reader announcements for save/pending/error/conflict status. Red concern
boundaries also have text/icon/programmatic description. Charts have data-table/equivalent summary;
artwork has meaningful text or declared decorative status. Motion respects reduced-motion settings.
Every state matrix row above is testable with keyboard and screen reader, not only by pixels.

### Performance and resilience budgets

For a warmed authenticated session, the production target is p95 under 300 ms for a permitted
projection query and p95 under one second for a non-provider command acknowledgement under normal
load. Large imports, exports, AI work, file scans, print rendering, and external sync are jobs
with visible progress and do not block interactive command transactions. The client paginates
history, virtualizes large lists, defers noncritical media/insights, and bounds local cache by
tenant policy. Performance tests cover cold/warm, slow network, degraded dependency, large
catalogue, large history, mobile viewport, and reconnect behaviour.

A failure reports what is known: pending, accepted, queued, submitted, receipt received, failed,
or unknown outcome. It never substitutes a cheerful success message for uncertainty. Recovery UI
keeps the user's valid draft and identifies the exact object/revision/action needing attention.

## ACT-01 · Onboarding, migration, activation, and support

### Empty tenant and onboarding state machine

A newly provisioned tenant is empty by design. It shows the owner the real setup sequence and
never creates demo customers, products, prices, stock, sales, or provider receipts in production.
Test/sample data is permitted only in explicit test lineage.

The current Cedar sequence is the [onboarding contract](../app/src/prototypes/cedar/ONBOARDING-SPEC.md),
accepted in FEED-IA §231–232. It follows subscription payment and uses the reviewed focused
connection wrapper, with the same body available as a Settings modal. Each screen asks one field
or choice. The development demo offers a walkthrough or the prepared Sales workspace.

1. **Business name**, **Business address** with Google suggestions, then **Peruvian RUC**.
2. **First order channel** — choose WhatsApp, email or phone and complete its setup.
3. **More order channels** — show the connected channel ticked; add another or continue.
4. **Payments and invoicing** — receiving Yape/Plin destination, Prometeo bank access and NubeFact setup.
5. **Product catalogue** — existing intake and product confirmation, retaining review, skipped and failed states.
6. **Invoice history** — optional history upload, then explicit Gmail permission for supplier/customer invoice discovery where Gmail is connected. Found documents enter review.
7. **Congratulations** — **Start selling** opens Sales. Pricing and valued Delivery Notes start enabled; stock starts disabled, with independent settings switches.

The sample walkthrough retains explicit test lineage, prefilled editable fields and provider
provenance. The readiness states below continue to govern actual tenant capabilities and production
activation; completion of a sample connection remains sample evidence.

Back restores accepted prior answers, Close retains only an explicit tenant-scoped draft, and reload
resolves the current server state before resuming. Permission loss, provider failure, invalid file,
partial parse, conflict and offline state each keep the recoverable input and name the next permitted
action. Completing the visual journey does not activate a provider, admit an SKU, send a message, or
authorize production.

| State | Required completed facts | What Rocoto enables | What remains blocked/honest |
|---|---|---|---|
| Provisioned | verified owner and tenant ID | owner sign-in, basic organization setup | commercial/output/provider actions |
| Organization ready | legal/business profile, timezone/locale, initial operating policy | team invitations, customer/catalogue intake | issue if legal profile/tax/doc requirements incomplete |
| Data intake | source registered and transient parser/review progress | import review, New product, manual customer/SKU work | no claim that imported proposals are sellable/stocked |
| Catalogue ready | at least one reviewed active SKU with required Unit and price policy | Product Sheet, draft albarán lines, Stock update where policy allows | price/stock unknown state remains honest per SKU |
| Operations ready | delivery/stock/exception policy and required roles configured | preparation, allocation, delivery work | issue/dispatch where required policy/connection is incomplete |
| Connection tested | connection authorization, scoped test transaction and receipt/reconciliation | explicitly configured live rail | other rails and untested credentials remain not configured |
| Roleplay verified | tenant runs representative source → albarán → document/output scenario in test/controlled state | activation review | no automatic live sending until approval |
| Activated | owner accepts checklist; legal/billing/operational gates pass | production commands within configured grants | missing optional rail remains visibly absent, never simulated |
| Restricted/paused | billing/security/policy or owner action causes restriction | read/export/recovery rights according to policy | new external sends/high-risk mutations as configured |
| Closing/closed | export/retention/transfer plan accepted | support/data lifecycle process | new tenant work; records follow retention policy |

### Migration and support

Migration retains external source references, reviewed business facts, mapping decisions, original external identifiers, row
reports, and rollback/compensating command plan. It validates tenant isolation, duplicates,
unit/price compatibility, archive state, and totals before activation. A migration does not
silently reshape historical commercial documents. The customer receives an import report that
separates accepted, skipped, ambiguous, failed, and still-review-needed records.

Support begins with tenant-approved diagnostics that exclude secrets and unnecessary content. Any
break-glass access is requested, scoped, time-limited, logged, and reviewable by the tenant owner.
Support may diagnose and propose; it does not silently repair business data outside authorized
commands.

## REL-01 · Observability, evaluation, test evidence, and release gates

### Required test coverage

Every feature ID has unit, integration, contract, end-to-end, accessibility, failure, and recovery
coverage appropriate to its risk. The minimum release suite proves:

| Area | Required proofs |
|---|---|
| Tenant/auth | cross-tenant denial for read/write/search/subscription/file/job; role change/session revoke; support break-glass expiry |
| Commands/events | schema validation, idempotency replay, unknown outcome lookup, sequence ordering, optimistic conflict, allowed low-risk rebase, audit and outbox atomicity |
| Catalogue/SKU | reference versus tenant distinction, source retention, customer alias scope, Internal-category/Related-products independence, exact-SKU art/stock/history, archive/restore, duplicate retry, file-or-paste intake review and no-pre-result mapping |
| Money/units | decimal precision, tariff history, currency/unit mismatch, unknown equivalence, manual pin, server total, issued snapshot/reprint, correction linkage |
| Inventory | receipt/count/zero/variance/reversal, genuine/blank lot, incompatible-unit separation, exact-SKU allocation, archive block, duplicate command protection |
| Sheets | every Product/Customer/Albarán state-matrix row, keyboard/screen reader, narrow mobile, loading/error/conflict/permission/offline/deleted handling, related-object return paths |
| Sources/intelligence | malware/quarantine, source provenance, supplier-email product linkage/empty state, proposal review, no direct AI mutation, provider unavailable and budget denial |
| Outputs/integrations | immutable snapshot, partial failure/retry, receipt versus queue, webhook replay/signature failure, cursor/reconciliation, external duplicate prevention |
| Administration | every setting domain/action/state, effective-date snapshot, owner/role guard, billing/data lifecycle, test lineage isolation, connection revoke |
| Reliability | backup restore, projection rebuild, outbox replay, dependency outage, concurrent edits, reconnect, degraded queue, incident recovery |

AI evaluation uses tenant-safe, consent/retention-eligible test sets, chronological replay where
prediction is involved, frozen model/prompt versions, separated development/evaluation/production
lineage, and error analysis linked to evidence. The detailed intelligence evaluation and image job
gates live in `THE-INTELLIGENCE-SPEC.md`; no accuracy, provider availability, or generated asset
claim is made without recorded evaluation/receipt evidence.

### Release gates

A production release requires all of the following:

1. approved versioned schema migration with backup, restore, forward migration, and rollback or
   compensating-event plan tested in an isolated environment;
2. tenant isolation, authorization, event/outbox/projection, source retention, money/unit,
   stock/lot, and document-snapshot contract tests green;
3. all three sheet matrices driven at desktop and narrow mobile, including keyboard/screen reader,
   save failure, conflict, permission, offline, archive, and deleted/redacted states;
4. every administered setting/action/state testable with named authority and audit result;
5. connection-specific test transaction and receipt/reconciliation for each rail being enabled;
6. security review, dependency scan, secret/egress review, privacy/retention review, and
   accessibility/performance budgets met;
7. observability dashboards, alerts, runbooks, on-call ownership, backup/restore proof, and
   incident/recovery drill ready;
8. test lineage proven excluded from billing, intelligence learning, exports, and external sends;
9. owner-facing activation checklist and rollback/incident communications prepared;
10. release evidence recorded against the feature IDs in `THE-WIRING-TASKLIST.md`.

A UI-only build can pass its own kit evidence but cannot pass these production gates. A feature is
not reduced to a stub because a dependency is missing; it remains unavailable with its real state
and activation requirement until the contract, operation, and evidence are complete.

### ALB-01.4 · Comments and customer line notes

A line has separate audiences. **Add note**/**Edit note** edits customer delivery-note wording; **Comments** opens internal discussion. The panel is 400 px wide on desktop and full width on phone, with product/document identity, **Comments** and **Delivery note** tabs and **Close**. It scrolls internally. Back/Escape closes the top layer and Forward restores its exact line/tab. Session drafts survive closing; failure preserves text without claiming saved.

Internal comments are append-only and line-scoped, with actor/time/text. They never enter customer confirmation, customer paper or ERP description. Customer text is limited to 500 characters and saved through an authorized command with audience, actor/time, source/review evidence and document revision. Directly authored text cites its own business event; it needs no fabricated email or intermediate comment. Clearing removes the current outward snapshot; issued/sent snapshots stay immutable.

Customer text renders once beneath the product with a 2 px neutral left rule and preserved newlines. Internal discussion has only a compact comment door on the row. **Use this comment…** contains secondary **Review wording**, **Keep as comment**, **Use on delivery note**, **Remove from delivery note**, and separately **Create a separate product**. Opening/repetition never creates SKU/price/stock/artwork/ERP state. Production comments require stable IDs, edits as revisions, permission, resolution/reopen, mentions/notifications under explicit send policy and audit; the kit's local compatibility prep-note events do not prove these services.

### CUS-01.4 · Pricing and communication anatomy

| Control | Exact operator surface, action and boundary |
|---|---|
| **CUS-P01** | **Pricing** is always visible before history. One tariff shows its name without a switcher. Several tariffs offer a selected default for this customer. **Manage tariffs** opens tariff settings, never a product price editor. |
| **CUS-P02** | **Set a product price** searches exact SKU names/codes, including independently created variants and products absent from recent orders. No Internal category/group or Related products is priceable. |
| **CUS-P03** | Selected product editor shows current amount/source/unit, positive decimal price and **Save price**. Save appends one customer+exact-SKU price exception, leaving the tariff, other SKU and other customer unchanged. Failure keeps the draft and says saved prices did not change. Only custom price exceptions are listed, independently of recent-order membership; ordinary tariff prices are available in the editor and are not repeated in the card. Empty state: **No custom prices.** Show four exceptions initially; **Show all [N] prices** expands the full list and **Show fewer** restores it. The picker includes manually added and imported exact SKUs, not just products on recent orders. |
| **CUS-P04** | **Temporary discount** shows the current/upcoming percentage and start/end dates, **History**, **Add discount**/**Schedule another**, and direct **Release**. Saving appends a versioned customer agreement; Release records its actual end and immediately reveals the unchanged underlying exact-SKU/tariff price. Overlap, invalid dates, stale revision or permission failure keep the draft and name the conflict. |
| **CUS-P05** | Main-channel header: **Orders by [channel]** and one action: **Send email**, **Open chat**, **Call**, **Open phone history** when no real phone exists, or **Open conversation** for portal/in-person. Never call a generated display number. Each communication-history row opens its exact customer conversation/source; only the header is the compose action. |

After Insights, visible **Delivery** and **Account** cards hold order days/usual order, requested delivery time, channel, payment terms, connected system, delivery run and account owner. Clear delivery time says **Use the standard delivery run**. Frequent products has only **Last N albaranes** as its window. **Concerns** uses **No concerns** as its empty state. No founder-facing explanation belongs in the working sheet. The architecture and evidence detail stay in documentation or an intentional details surface.


### CUS-01.5 · Working copy

Use **Open chat**, **Send email**, **Call** or **Open conversation** for the one main channel action. History rows open the selected conversation. Customer sections are **Pricing**, **Frequent products**, **Upcoming**, **History**, **Insights**, visible **Delivery**/**Account**, **Delivery changes** and **Concerns**. Expanded insights use **Order value**, **Order summary** and **Patterns**. Window/count labels are concise (`Last 5 albaranes`, `12 months`); methodology and architecture stay in documentation. Empty state: **No concerns.** There is no Contact them/Write to them pair, founder narration, or Customer details & history disclosure.

## SYS-182 · Connected production contracts

### CUS-01.6 · Customer creation anatomy

| Control | Exact fields and UI | Validation, command and connected state |
|---|---|---|
| **CUS-E01** | **New customer** uses the shared task frame; **Customer name**, **Phone**, **Email**, **Delivery address**, **Delivery run**, **Main channel**. Footer **Create customer** / **Cancel**. | No duplicated Contact/Write to them section. Optional facts stay blank, not synthetic defaults. Label required fields for the chosen action; names never serve as immutable IDs. |
| **CUS-E02** | Phone/email are separate contact methods; Main channel is an explicit choice. Phone/WhatsApp require a valid reachable phone; email requires a valid email address. | Preserve literal contact evidence and normalized transport form separately. No fabricated display number becomes a callable number. Saved email opens Send email/connected draft or the truthful external route according to capability. |
| **CUS-E03** | Delivery address accepts free text; real verified address suggestions may be selected; Delivery run can be assigned explicitly. | Free text is not geocoding. No fabricated coordinates or silent nearest route. Unknown map location stays unknown while the address remains useful; route/geocode is a separate reviewed change. |
| **CUS-E04** | A possible duplicate names the existing account with **Open existing customer** and explicit **Create separate customer**. | Similar name/contact is evidence, never automatic upsert/merge. Duplicate decision and creation use a stable request ID, current tenant and authority. Repeated request returns the same accepted ID. |
| **CUS-E05** | Create success opens the created Customer Sheet with main-channel action and empty honest work/history. | Persist customer/contact/relationship transaction before acknowledgement. A failed store/network request retains all fields and writes no successful-looking account to the list. Legacy unscoped browser records remain preserved for explicit migration, never projected across sectors or allowed to block safe new scoped writes. |
| **CUS-E06** | Dirty navigation, conflict, permission/offline and unknown-save states use the shared recovery controls. | Failure cannot switch the sector/customer or reset contact fields. Production key is tenant ID, not the kit's demo-sector discriminator. No current user's private contact data can enter a different tenant's suggestions or export. |
| **CUS-E07** | Customer **Pricing** assigns a named tariff; **Set a product price** selects any exact active SKU then its rate/unit, optional policy review/expiry; **Temporary discount** schedules percentage/start/end and direct **Release**. | One tariff needs no switcher. An override is customer + exact SKU + unit + currency + effective period, never a mutation of the SKU tariff or sibling. A discount is a versioned customer agreement applied after the underlying exact-SKU/tariff resolution; overlap policy, effective timezone, stale revision and Release are server-authoritative. New customer does not inherit another customer's arbitrary custom rate or discount. |

### COM-01.3 · Prices connect to quotes and albaranes

The effective price resolver takes `(tenant, customer, exactSku, quantityUnit, effectiveAt,
policyRevision)` and returns either a complete decimal price source or a typed missing/conflicting
state. Its precedence is a valid explicitly pinned albarán line, then a permitted customer/SKU
override, then the assigned active tariff's exact-SKU rate, then one valid active customer discount
applied to that resolved underlying amount. Unit conversion requires a recorded
exact applicable equivalence. Missing price never becomes zero, a sibling's price or a nominal
pack estimate. Fees/options have their own explicitly approved line snapshot.

Each accepted tariff/override/discount schedule or release event invalidates affected *draft*
quotation projections. Discount evaluation uses the tenant business timezone, explicit starts/ends,
server-owned overlap policy and agreement revision; conflict or ambiguity returns a typed review
state rather than compounding discounts. Release ends the agreement and exposes the underlying
price without writing an inverse price revision. The UI reviews before/after values and retains
manual pins under policy. Issued/sent/printed snapshots,
earlier customer confirmations and old charts never rewrite themselves. The three confirmation
settings remain independent: confirm in chat, include prices there, and show albarán prices; only
their permitted effective policy allows quoting, and unknown final measured kg remains explicit.
An insight drilldown reads those same exact events and can open their editor, not mutate a value.

### INT-01.7 · Assistant and availability incidents

#### Order-review profile boundary

In the active profile this assistant is internal. It may collect a supply issue, show exact
affected-order cards, draft wording, summarize tool activity and open the native communication
door. It cannot create CommunicationProposal or OutboundAttempt, send customer content, claim a
provider state or mutate catalogue/order data from an ordinary chat turn. The outbound sequence
below remains the full future-domain contract and is unreachable until customerOutbound is
independently enabled with production evidence.


`AssistantConversation` owns tenant/operator-authorized authored entries and minimal proposal/tool
history. `AvailabilityIncident` owns exact SKU/location scope, type (`current-availability`,
`inbound-delay`, `quality-hold`, `uncertain`), reported/observed times, literal quantity/unit where
known, evidence references and status. `ImpactProposal` owns projection/evidence revisions,
affected exact order/line IDs, missing-unit blockers and proposed alternatives. `CommunicationProposal`
owns selected order-recipient IDs, channel, exact reviewed text, digest, policy revision and approval.
An `OutboundAttempt` owns immutable request identity and per-recipient accepted/rejected/unknown
receipts. These are not one mutable chat message with a “sent” boolean.

The sequence is **report → review impact → review exact copy/recipients → authorize command →
reconcile each result**. Each transition checks current scope and revisions. A confirmed operator
report can be evidence for an impact proposal without overwriting physical stock; a delayed inbound
report cannot remove stock already on hand. Zero affected orders leaves an active monitoring
incident and no broadcast. Stock/source/order events may update impact and suggest a follow-up;
the suggestion needs fresh review and cannot auto-send from a previous approval. Unknown unit
conversion permits a qualitative reviewed warning, never a fabricated quantitative promise.

Category feedback uses the same assistant conversation but returns a separate classification
proposal. Applying it changes only authorized relationships after an explicit before/after review.
It does not rename imported SKUs, merge products, copy prices or replace artwork. An AI model,
tool result or user message cannot grant write/send authority. INTEL-17 owns transport, model
release, tool schemas, receipt validation, retention and dictation contracts.

### DOC-01.5 · Print attempt, reprint and physical evidence

The production aggregate is `OutputJob` with immutable artifact/revision/profile and one or more
`PrintAttempt` records. Attempt envelope: tenant, actor, request/attempt ID, subject IDs, document
revision set, content checksum, profile/version, paper A4/A5, copies per subject, ordered truck
groups, target capability and capturedAt. Retry before submission reuses that intent; a deliberate
new physical reprint has a new attempt linked by `reprintOf`. The job's content is not regenerated
from the current product/customer settings during retry.

State edges are `prepared → submitted-unconfirmed → confirmed`, or `prepared → failed-before-submit`;
provider transports may add `provider-accepted`, `partially-confirmed`, `unknown`, `cancelled` and
`reconciled`. Browser popup blocked/preparation failure can retry the same prepared artifact. Once
submission may have occurred, do not retry automatically: look up the receipt or ask for an explicit
new reprint. Browser dialog cancellation is not reliably observable, and `afterprint` is not a
physical receipt. Confirmation requires actor/time and human attestation or verified printer
receipt tied to this attempt. Receipt replay is idempotent; unexpected IDs/hashes are quarantined.

Remaining work compares the latest eligible document/packing revision with confirmed coverage and
unresolved attempts. It excludes unchanged confirmed output, includes changed revisions, and shows
unconfirmed attempts separately for review. The compact **Activity** door beside the status exposes requester/confirmation actor, actual UTC timestamps rendered in the business timezone, version and copies. A new print request does not overwrite earlier who/when evidence. Counts distinguish documents, pages, requested copies,
confirmed copies and attempts. Confirmation of an older revision after a newer edit cannot mark
the latest revision as printed. A reprint cannot create an invoice, reprice, dispatch or archive.

Browser source rendering uses the actual albarán/packing/truck components and all captured policy
facts; print markup is unscaled and paginated, with ready fonts/assets. The document profile records
optional albarán **Final weight**, **Unit price**, and **Line total** fields plus packing **1 column** or
**2 columns**, mandatory truck grouping, and **Route order**, **Customer A–Z**, **Order value**, or
**Lifetime value** sorting within each truck. Two-column packing pairs whole order blocks into
independent lanes, never splits an order across lanes, and never mixes truck runs. Preview, page
count, first request, same-attempt retry, **Open copy**, and deliberate reprint all use the captured
profile and captured sort values; a later preference cannot reinterpret the artifact. A default A4
profile does not ignore an A5 choice. A real printer bridge needs tenant/device enrollment,
authenticated signed jobs, profile/capability checks, spooler IDs, bounded retries, per-document/copy
receipts, revocation, offline reconciliation and deployment evidence. A website alone does not gain
silent printing.

### DOC-01.6 · Custom export recipes

> **Superseded by [THE-OUTPUTS-SPEC.md](THE-OUTPUTS-SPEC.md) OUT-01.2** (E200 · FEED-IA §202).
> `ExportTemplate` and `SavedOutput` become one `Template` carrying paper, copies, layout, marks and its day seat. The history below is kept.

A versioned `ExportTemplate` and configured `SavedOutput` are distinct objects. A template is a reusable recipe; **Use template** creates one independent saved copy. Navbar Export, Sales-day and Albarán shortcuts resolve the selected saved-output ID and revision rather than a favourite. Applied category/product/salesperson/truck/date/page/activity filters choose the current output selection; they never overwrite a saved output until an explicit configuration save. No surface may silently substitute a template, saved output or applied scope.

An `ExportTemplate` has tenant/stable ID/version/name, compatible destination(s), allowed data subject,
ordered stable column IDs, authorized source-field references, headings, typed transforms and format
policy. A `SavedOutput` has its own stable ID/name, one destination, source-template/version,
scope/filter chips, permitted fields/columns, destination settings and connection profile. Print adds
paper/copies; File adds format/name; Email adds recipient rule, attachment and a separately versioned
schedule. The builder edits a template draft. Column chevrons choose source fields *inside the column*;
drag/drop and keyboard move controls change the same ordering. Sample/current-data preview and file
generation use the same mapping engine. Neither object contains copied private rows.

The Export gallery is destination-scoped: it shows only templates compatible with the active Print,
Email or Files destination. Email starts with **Subcontractor delivery pack** and **Daily albaranes to
accounting**, plus **Build your own with Copilot** as a reviewed proposal seam. Generation snapshots
data revisions and the selected saved-output/template versions, validates missing/retired fields and
authorization, then produces an immutable artifact and download history. CSV/Excel formula injection
is neutralized according to the format policy; values/types/decimal and unit columns remain explicit.
Editing or archiving a template/saved output cannot erase an earlier generated file, mutate an output
attempt or imply ERP synchronization. External delivery is its own separately authorized job.

### MSG-24-HISTORICAL · WhatsApp service-window contract — superseded by MSG-25

**Entities/events.** `conversation_workspace_snapshot` carries actor, thread ID, draft encryption reference, scroll anchor, reply target, sidebar/full posture, source route and expiry; it is a client/session restoration aid, not communication evidence. `channel_window_evidence` is provider-issued account/channel/conversation identity, observed time, verified window state, source event/ref and expiry. `template_revision` stores tenant, provider template ID, locale, category, immutable body/variable schema, approval state and provider receipt; a dispatch uses its rendered immutable revision, never an arbitrary source draft; raw customer drafts are separate encrypted draft records. `template_submission` carries draft revision, actor, idempotency key, provider request/receipt refs and transition audit: `draft`, `submitting`, `pending`, `approved`, `rejected`, `failed`. `outbound_template_attempt` references approved revision, rendered variable values, consent/policy decision and provider receipt. No state transition alone says delivered.

**Chooser and review-session ownership.** `outbound_entry_selection` is a transient UI operation, scoped to tenant, actor and the existing `conversation_id`; it may list only visible, non-test WhatsApp conversations and never creates a customer or conversation record. The selected conversation ID becomes the composer’s existing thread context. A `template_review_session` is scoped at minimum to tenant/channel/conversation/actor and carries only review mode, submission state and safe draft-form fields; its free-form intent remains the separately encrypted conversation draft. Sessions cannot cross customer/thread boundaries. The browser reference may retain this only in per-thread session memory; production persistence follows tenant encryption, expiry and audit policy. On `submitting`, the idempotent submission job—not a mounted dialog timer—owns the transition to `pending`/terminal state, so close, route change, reload or unmount cannot leave a session permanently `submitting`. The UI restores focus only after the closing dialog’s focus lock has released: chooser close → its opener; selected customer → that thread’s composer; outbound review close → its composer.

**Permissions/errors/audit.** Only members with channel-view permission may enumerate the outbound chooser; only members with channel-send permission may create attempts; only designated administrators submit/replace templates. Runtime rechecks tenant, channel ownership, policy/consent, verified window and immutable approved-and-enabled exact-language template immediately before dispatch; free-form reply is allowed only in the 24 hours after the last user message, otherwise only an approved WhatsApp template may send. Closed/missing/stale provider evidence blocks freeform sending. Provider timeout, rejection, paused/disabled state, permission denial and failure preserve both free-form intent and template form and report a non-sendable result; Escape/close restores composer focus; duplicate idempotency keys return the stored result. Audit retains actor/time/action/object revision/evidence reference/decision/error code, omitting raw body from operational logs. Communication content follows source-retention and encryption policy; native email remains provider custody.

**Projection and operations.** Read models expose current reply capability, template approval and source freshness without inferring approval from UI state. Templates, provider evidence and output attempts use outbox/webhook reconciliation and watermarks; backfill only rebuilds projections, never recreates a send. Metrics are intercept rate, template-match acceptance, submission approval/median decision time, blocked-send reasons, provider receipt latency, chooser-to-composer completion and draft recovery; dimensions are tenant/channel/provider/template/category/actor role, with privacy thresholds and no raw text. Template approval/paused/disabled/rejected changes arrive by provider webhook and do not return a submitted draft to send review before approved-and-enabled. The current kit implementation is explicitly `reference_only`; it has no provider credentials, webhook ingestion, template submission or outbound execution.


### MSG-25 · Communication workspace records for order review

MSG-25 is the live release-profile system contract. MSG-24-HISTORICAL remains future-domain
reference only and is unreachable while customerOutbound is disabled.

**ConversationWorkspaceSnapshot** contains tenant, actor/session, source route, thread ID, scroll
anchor, posture (collapsed or expanded), update time and expiry. There is no sidebar posture and no
customer-send draft in this profile. An albarán route may park one snapshot; only a return to that
source restores it. Tenant, permission or unrelated-route change invalidates it.

**SourceConversationReference** contains provider/channel, provider-custodied opaque thread/source
reference, customer ID, authorized message projections, sync cursor/freshness and native deep-link
capability. Raw email/file content follows THE-SOURCE-PRIVACY-SPEC and is not copied into a second
Rocoto mailbox. **NativeDoorOpened** records actor/time/source/destination kind only. It is not a
send, reply, delivery or read receipt.

**ReplyAttention** contains tenant, order/thread/source revision, exact reason, optional line/field
scope, lifecycle, dismissal rationale, actor/time and supersession. It may coexist with any
OrderLineInterpretation. Dismissal never edits a line or says the customer was contacted. New source
evidence may reopen it under a new evidence revision.

**AssistantConversation** contains internal operator-authored turns, recoverable internal draft,
bounded proposal/activity references, actor/time and retention policy. Tool results are typed
summaries linked to domain objects; operational logs omit raw text. A normal assistant turn writes
no catalogue/order event and performs no external communication. Domain changes return through
their separately authorized, revision-checked commands.

**Capability boundary.** ProductCapabilityProfile.customerOutbound is disabled for the
order-review release. The customer conversation has no composer, New message chooser, WhatsApp
24-hour/template path, email reply editor, outbound attempt or provider-send command. Connected WhatsApp access is forward-only from connection time and never supplies past conversation history. It exposes
only native **Open chat**, **Open Gmail** or **Open Outlook** plus communication history. Full
messaging adapters and templates may be built for a later profile, but projections and APIs must
reject their use while this gate is closed. The optional scheduled subcontractor order-list email,
if commissioned, is a separate Export delivery job with explicit recipient, schedule, document
revision, approval and receipts; it is never a customer-conversation shortcut.

**Projection and operations.** The workspace read model joins conversation summary, authorized
source turns, ReplyAttention and condensed unvalued albarán cards. It restores posture and scroll
without claiming fresh provider state. Metrics cover workspace open/restore, native-door use,
reply-attention lifecycle, order-card open, source freshness and assistant proposal-to-explicit-act
conversion. Dimensions are tenant/channel/object/actor role with privacy thresholds; raw content is
excluded. Reconciliation can update provider-sourced history only from verified inbound evidence.
No browser event establishes that a person replied or a provider delivered anything.


## E187 · Accepted uncoded sale items and shared output seam

`UncodedSaleItem` is a tenant-scoped product projection created only by a reviewed
`KeepAcceptedOffSkuLineInProducts` command that references an accepted `ProvisionalOrderLine` and
its exact Albarán/source revision. Required facts are item ID, tenant, literal display wording,
literal unit, source/admission reference, actor/time, record state and revision. Optional
independently revisioned facts are internal category, direct `RelatedItemLink` endpoints,
notes/change-history and request-history projections. It has a neutral presentation and no artwork
association/control, SKU code, tariff, stock/lot, ERP master or customer-alias field.
`AssignUncodedItemToSku` is a future,
separately authorized migration command; it must retain source/admission/request/relation evidence
and cannot rewrite frozen Albarán lines.

`RelatedItemLink` replaces SKU-only language at the relation seam: each endpoint is a coded `SKU`
or `UncodedSaleItem`; both endpoints are tenant-scoped, exact, distinct and revision checked. The
command records reason/source/actor/time. It is reciprocal in projection, sparse and
non-transitive. Category, customer, text similarity, repeated request and artwork cannot write it.
`RequestHistoryEntry` is a read-only exact-record → Albarán-line projection carrying no copied
commercial fact. Its route return token obeys INTX-02 and never serializes protected source text.

The current output UI uses one `ExportTemplate` → `SavedOutput` → immutable `OutputJob` /
`PrintAttempt` seam across navbar Export, Sales-day and Albarán. A saved output identifies its
destination, source-template/version, configured scope/filter chips, selected document kind, paper
format/copies or file/email settings and packing layout/sort choices; capture freezes that chosen
saved-output revision and the eligible source values. Browser execution may write
`print_dialog_opened` or `download_started` attempt evidence only. `confirm_printed` requires
actor/time/attestation or verified receipt. Scheduled Email is a distinct output schedule with
recipient rule, attachment/template revision, connection profile, cadence/timezone, next run,
active/paused state and send history; it is never a customer-chat send. A reprint has its own attempt
ID and `reprintOf`; it cannot replace history or cause issue, delivery, archive, ERP sync or customer
communication. Email/ERP adapters remain independently capability-gated.

**E187 boundary.** These names are durable-domain and UI seam requirements. They do not prescribe
or claim a Runtime, parsing/model-learning loop, provider adapter, image-generation job,
intelligence evaluation or Copilot execution.


## E188 · Projection and event implications of the physical grammar

E188 is a presentation/projection correction, not a new runtime. Existing objects continue to own their facts; client fixture values must not bypass \`ProductCapabilityProfile\`. In the active order-review profile, \`OrderSummaryProjection\`, \`CustomerOrderHistoryProjection\`, \`MessageEmbeddedOrderProjection\`, Sales-day summary and \`OutputPreviewProjection\` omit all monetary fields. The server must make that omission profile-authoritative, so a hidden fixture total cannot reappear through list, hover preview, Export card or route return.

\`OrderLineProjection\` has an ordered responsive presentation contract: exact item art reference, literal display name, relevant detail values, terminal quantity/unit, disposition and exact concern scope. It does not duplicate price fields in the base row. \`FieldCheckProjection\`, \`OrderLineCandidateSetProjection\` and \`ProvisionalOrderLineProjection\` select the field-wrap, choice-hybrid and off-SKU forms respectively; none changes the underlying line until the existing explicit disposition command is accepted. A return token carries list/filter/scroll/selected-object context only; selected/current paint is a client rendering state, not a durable order event.

\`ExportFilterDraft\` is local and non-authoritative. **Apply** sends one validated scope request containing actor, tenant, draft revision and selected filters; resulting \`OutputScopeProjection\` alone drives counts, previews and \`OutputJob\` capture. **Clear** requests canonical default scope. Until Apply, no activity, output job, download, print attempt or capability state changes. This establishes one future event seam without claiming an implemented service.

Phone visual-viewport dimensions, hover, cursor and bottom-dock posture are transient client state. They create no domain event. Existing navigation/draft/analytics may record only named control/result metadata; raw product/customer/message text, keyboard geometry and visual screenshots are not operational event payloads.

**E188 nonclaim.** This contract does not enable prices, tariffs, stock/lots, supplier ingest, customer outbound, provider send, external print confirmation, model parsing, image jobs or Copilot execution. For the active UI profile, Runtime/model learning, UI-embedded intelligence and Copilot execution remain the sole separately deferred phase.
