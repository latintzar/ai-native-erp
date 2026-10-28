# THE UNITS SPEC

**Canonical child of:** [THE ARCHITECTURE](THE-ARCHITECTURE.md) → `COM-01` commercial policy and `INV-01` inventory facts.
**Detailed authority for:** one Product Unit, tenant Unit vocabulary, reusable global `UnitConversion` objects, Product Sheet overrides, conversion evidence and the capability-gated price/lot/stock boundary.
**Read with:** [THE SYSTEM SPEC](THE-SYSTEM-SPEC.md) `COM-01`, [THE OBJECT MAP](THE-OBJECT-MAP.md), [THE CATALOGUE CONTRACT](THE-CATALOGUE-CONTRACT-SPEC.md), [THE STOCK & LOTS SPEC](THE-STOCK-LOTS-SPEC.md), and [THE INTERACTION SPEC](THE-INTERACTION-SPEC.md). Where this document gives a more detailed unit rule, it controls those documents' broad unit language. It does not change the canonical object hierarchy or make the browser kit a production ledger.

---

## UNT-00 · Active product contract

**Active rule.** A Product has one visible, editable **Unit**. There is no **Sold by** concept, no `Sell` role, and no second product-level sales-unit control. `Product.unit` is the product's current Unit and its identity history protects it after commercial use. Product creation and bulk intake show this field as **Unit**.

A Unit is a tenant-owned business word (`kg`, `box`, `bot`, `crate`, `half tray`, or a custom word). Its kind and decimal precision make entry and scanning safer; they never imply physical content or an equivalence. Original source wording remains evidence and can differ from the current Product Unit.

The reading order on the Product Sheet is fixed:

```text
Product name → SKU → Unit → [Price / lots / recorded stock when each capability is enabled]
```

Price, lots and recorded stock are direct capability-gated facts **under Unit**. They never become a second Unit role or appear merely because a conversion exists. One tariff is labelled **Price**; multiple tariffs use **Tariffs**.

### UNT-00.1 · Authority and deferral

1. Original source and issued-document snapshots retain the observed unit words and quantities.
2. `TenantUnitDefinition` owns reusable tenant vocabulary.
3. `Product.unit` owns the current product Unit.
4. `UnitConversion` owns an explicit reusable multiplier between two Units.
5. A line, price, receipt, lot movement and issued document freeze the Unit/conversion revision actually used.

This specifies product and conversion behaviour only. Production command/event handling, source parsing, AI proposals, supplier/ERP mapping and any derived runtime remain deferred. A family, category, supplier, customer, similar SKU, parser result or AI response cannot silently set a Unit or conversion.

### UNT-00.2 · Terms

- **Unit** — the one current product field and visible label.
- **Tenant Unit** — reusable tenant vocabulary with label, kind, precision, status and revision.
- **UnitConversion** — an explicit multiplier from one Tenant Unit to another.
- **Global conversion** — tenant reusable default, usable by eligible products.
- **Product override** — a conversion saved from one Product Sheet that replaces the applicable global conversion for that exact SKU only.
- **Measurement evidence** — a supplier note, nominal pack statement or catch-weight requirement. It may explain why a conversion is needed, but is not itself a conversion and never calculates.
- **Original Unit** — unchanged source evidence, never rewritten to hide the source phrase.

---

## UNT-01 · Objects and inheritance

### UNT-01.1 · `TenantUnitDefinition`

```text
TenantUnitDefinition
  tenantId, unitId
  label, pluralLabel?
  kind: mass | volume | count | package | custom
  precision: 0..6
  status: active | retired
  revision, createdAt, createdBy, retiredAt?, retiredBy?
```

A new word may be `custom`. `box`, `pot`, `bot` and `crate` do not imply a multiplier.

### UNT-01.2 · `Product.unit`

```text
Product
  skuId
  unitRef                         // the sole current Product Unit
  originalUnitEvidence?           // source text/provenance, separate from unitRef
  revision, changedAt, changedBy
```

Before prices, orders, stock movements or issued documents exist, an authorised person can edit Unit. Once they do, a different Unit requires **Add variation** rather than reinterpreting history. This does not create or update a conversion automatically.

### UNT-01.3 · `UnitConversion`

```text
UnitConversion
  conversionId, tenantId
  fromUnitRef, toUnitRef
  multiplierDecimal               // `1 from = multiplier to`; exact decimal, never float
  status: active | retired
  scope: global | product
  productSkuId?                   // required only for scope: product
  effectiveFrom, effectiveTo?
  evidence?, revision, supersedes?
  createdAt, createdBy, reviewedAt?, reviewedBy?
```

`1 box = 8 kg` is one `UnitConversion` with `fromUnitRef=box`, `toUnitRef=kg`, `multiplierDecimal=8`.

Resolution is deliberately simple:

1. Find an active product-scoped conversion for the exact SKU and matching Unit pair.
2. Otherwise use the active eligible global conversion for that pair.
3. Otherwise the relation is unknown; no quantity, price, lot or stock calculation is inferred.

A product override is a first-class object created/edited from that product's Product Sheet. It shadows only the matching global conversion for that exact SKU; it never mutates the global object, sibling products, related products or category members. The Product Sheet makes the source explicit: **Global conversion** or **This product's conversion**.

### UNT-01.4 · Snapshots and invariants

A commercial or inventory fact captures a `UnitUseSnapshot`:

```text
UnitUseSnapshot
  renderedUnitLabel, quantityDecimal, precision
  conversionId?, conversionRevision?
  multiplierDecimal?
  sourceOrMeasurementEvidence?
  capturedAt, actorOrSystem
```

- A Unit label or matching kind is never a conversion.
- Conversions can calculate only in their effective scope and retain their revision.
- A nominal pack statement or catch-weight requirement is measurement evidence, not a `UnitConversion`; it never calculates stock, availability, financial total or tariff conversion automatically.
- A price is always per named Unit. `€10/kg` never becomes `€10/box` without a saved, applicable exact conversion and an explicit price action.
- Current Unit/conversion changes never rewrite issued lines, lots, movements or documents.

---

## UNT-02 · Product Sheet and Settings anatomy

### UNT-02.1 · Product Sheet

```text
Product identity
  Product name                              // live · a press puts the caret in the heading
  SKU                                       // live field
  Unit [kg]                                 // live field · filtering list · typed word accepted
    Conversions
      Global conversion: 1 box = 8 kg       [Override]
      This product: 1 crate = 6 kg          [Edit]
      Add conversion
  [Price]                                   // only when pricing capability is enabled
  [Lots / Recorded stock]                   // only when inventory capability is enabled
```

- **Unit** is the only product Unit field, and it is a **live field** (E193.01 · FEED-IA §196.1 —
  «same for units»): one combobox that carries the house's own vocabulary — this product's Unit,
  its conversions' units, the tenant `TenantUnitDefinition` list and every Unit standing on the
  catalogue — filters that list as the person types, and **accepts the typed word as new**, saving
  it as a `TenantUnitDefinition` on commit. ⚠ SUPERSEDES the «tenant vocabulary selector with
  **Other unit…**» reading: there is no closed list and no escape-hatch option, because writing a
  word IS the way a house gets a new one. The same component seats every place a Unit is chosen —
  Product Sheet, New product, the conversion rule's two ends — so a unit is picked one way in the
  whole product.
- A Unit already used by orders, prices or stock is **held**: the field states «This Unit is
  already used by orders, prices, or stock. Add a variation to use another Unit.» and carries
  **Add variation** on its own label row (UNT-01.2). Held is a state of the field, not a door to a
  dialog.
- **Conversions** is a compact sub-object surface owned by the Product Sheet, not another generic product field.
- An applicable global conversion is already the default; it does not need to be attached or copied. **Override** opens a product-scoped conversion prefilled from the global relation; saving creates a distinct override with its own revision and provenance.
- **Add conversion** offers `1 [from Unit] = [positive decimal] [to Unit]`, scope and an optional note. A person chooses **Global conversion** or **This product**; the latter is the exact-product exception.
- An unknown pair says **Needs a conversion**. It never guesses package contents or creates a conversion from typed words.
- A missing/pending Product image, category, relation, price, lot or stock state remains separate from Unit.

### UNT-02.2 · Settings → Units

Settings owns Tenant Unit vocabulary and global conversions:

```text
Settings → Units
  Units
    Unit name · plural · kind · decimals
  Global conversions
    1 box = 8 kg · Active
```

Changing or retiring a global conversion preserves its history. It cannot overwrite a product override. Settings does not create a product Unit, SKU, price, lot, stock movement, order line or ERP record.

### UNT-02.3 · Controls retained by the taskgraph

| ID | Active behaviour |
|---|---|
| **UNT-U01 · Unit** | Show and edit only `Product.unit`. After commercial history, guide to **Add variation** for another Unit. |
| **UNT-U02 · Add conversion** | Create one positive exact multiplier as global or this-product scope. Nominal/catch-weight text remains separate measurement evidence. |
| **UNT-U03 · Conversion row** | Show `1 [from] = [multiplier] [to]`, scope/source and **Edit**. An applicable global row is the default and may be overridden; an override never edits its global parent. |
| **UNT-U04 · Capability facts** | Render Price, lots and recorded stock immediately under Unit only under their independent capability gates. No conversion enables these domains. |
| **UNT-U05 · Settings** | Manage tenant vocabulary and reusable global UnitConversions. No Unit word alone creates a conversion. |

### UNT-02.4 · Narrow layout and recovery

On phone, Unit and its conversion action remain before the capability facts; conversion fields stack `from Unit → multiplier → to Unit → scope → note → Save`. Save failure preserves every draft. A missing conversion, stale revision or permission failure describes the affected object and does not create a false success state.

---

## UNT-03 · Deferred runtime boundary

The following remain future implementation seams, not current browser-kit claims: governed command/event streams, formula evaluation, customer aliases, parser/AI suggestions, exact inventory aggregation, tariff conversion, ERP mapping, supplier evidence review and cross-device conflict handling. They must use the active `Product.unit` + scoped `UnitConversion` model and frozen snapshots above; they must not revive a parallel Sold by/Sell unit model.

AI may later suggest a Tenant Unit or UnitConversion with evidence, but cannot create either, select it for a product, or change price/stock/order data without an authorised human command.

## UNT-06 · Deferred downstream seams

The active model gives later domains one clear dependency: every price, lot, stock movement, line and issued document names its own Unit and, where used, an exact `UnitConversion` snapshot. Those downstream implementations are not active claims in this product-design milestone.

- **Price:** always an exact amount per named Unit; changing its denominator is a separate price revision.
- **Lots and recorded stock:** retain their physical Unit. A future projection may aggregate only through an applicable exact conversion snapshot; otherwise it preserves a separate unknown/incompatible component.
- **Albarán line:** retains the requested/actual Unit and any conversion used for that line. Editing a line does not mutate Product Unit or UnitConversion.
- **Export and ERP:** use frozen document/movement facts and validate target mappings later. They never create Product Units or conversions as a side effect.

## UNT-07 · Persistence and migration boundary

The browser kit's local state is interaction evidence only. A future durable implementation must version `TenantUnitDefinition`, `Product.unit`, `UnitConversion` and snapshots separately; preserve local drafts on conflict/failure; and never promise server ordering, production audit retention, AI decisions or ERP acceptance from browser state.

Legacy `Product.pack`, nominal-pack text and catch-weight flags may be shown as **Imported conversion evidence**. They remain non-calculating until a person saves an explicit multiplier as a scoped `UnitConversion`. Any former five-role unit-profile language is superseded by `Product.unit` plus scoped `UnitConversion`; it is retained in historical material only and is not a current UI, object or wiring requirement.

## UNT-08 · Design acceptance

Before this design can be represented as connected runtime, prove that:

1. A product has exactly one visible **Unit** field; no Sold by/Sell role appears.
2. Product creation and bulk intake use **Unit** and never infer `kg`, a pack multiplier or a category relation.
3. `1 box = 8 kg` is an explicit, revisioned `UnitConversion` with exact decimal multiplier.
4. A global conversion can be reused without copying it; a product override shadows only that product and keeps its own provenance.
5. Nominal and catch-weight evidence remains visibly separate from the multiplier and non-calculating.
6. Unit and conversion changes never rewrite an issued line, price, lot, stock movement or document.
7. Price, lot and stock fields remain directly under Unit and appear only under their own capability gates.
8. Missing conversion, stale revision, rejection and save failure preserve input and make no false success claim.

The production command/event/runtime, parser/AI and provider/ERP proof for these statements is explicitly deferred.
