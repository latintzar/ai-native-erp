# Glossary — the trade's Spanish words

Rocoto is built for Spanish food distributors, and the trade's own nouns are terms rather than
translations: the documents in `docs/` use them untranslated and the app prints them on screen.
This page defines each one in English and says where a reader meets it.

Two conventions worth knowing before the list. **The shipped surface is Spanish and the thinking
layer is English** — code, comments, identifiers and every document in `docs/` — so a word may
appear here as a Spanish noun in the UI and as an English identifier in the source. And **the
depth clause** (FEED-IA §48): the product classifies to the variety, never to the category, which
is why several of these words name a level rather than a thing.

---

## The document, the price, the person

### albarán
**The delivery note — the document that travels with the goods and says what was actually
delivered.** It is the product's whole subject: «What we help with is making the albarán… That's
the big document of truth» ([`docs/archive/THE-ALBARAN-THESIS.md`](../omitted-sources.md) §0), and
invoicing is downstream of it.

*Where it appears:* everywhere. The sale IS an albarán becoming true — `src/prototypes/cedar/sale.ts`,
`src/prototypes/cedar/detail.tsx` (the sheet and its editor), `src/prototypes/cedar/print-view.tsx` (the paper), the open
strip in the shell. The word is in 105 source files.

### tarifa
**A price band: a name and a set of prices, which customers point at.** A house runs several; a
customer sits on one. «A tarifa is a NAME and a set of prices; it owns no customers — the customers
point at it, which is what lets a customer move without a tarifa being rewritten»
(`src/prototypes/cedar/tiers.ts`).

*Where it appears:* Stock's third seat is **Tarifas** (`src/prototypes/cedar/stock-tiers.tsx`); the registry, the
per-SKU-per-day price stamps and the change log live in `src/prototypes/cedar/tiers.ts`. Money is final at print.

### comercial
**The salesperson who holds a set of accounts — their own book of customers.** The design load is
six to ten comerciales holding 30–50 customers each (FEED-IA §12), which is why «whose accounts
these are» is a scope the river narrows by rather than a filter.

*Where it appears:* a role in the team model — `ROLE_DOES.comercial` reads «Their own accounts and
book, the tarifas in view, discount up to the ceiling» (`src/prototypes/cedar/company.ts`); the scope switch in
`src/prototypes/cedar/areas/sales.tsx`; a fact on every customer (`src/prototypes/cedar/areas/customers.tsx`).

### lote
**A batch of food that shared a fate — same boat and same day, same cutting room and same morning,
same field and same picking.** The point of it is one question: if something goes wrong, what else
do we recall, and who has it?

*Where it appears:* a line fact and an event kind on the ledger (`lot`, `src/prototypes/cedar/sale.ts`), a field
in the line editor (`src/prototypes/cedar/detail.tsx`), and the trazabilidad block on the printed sheet.
The full story is [`docs/archive/LOTS-EXPLAINED.md`](../omitted-sources.md) — the life of a lot number
from the boat to the auditor — and what the law actually demands, per sector with the articles
cited, is [`docs/archive/LOT-LAW.md`](../omitted-sources.md). Neither is repeated here.

---

## The goods, and where they come from

### gama I–V
**Trade shorthand for how far a product has been processed.** A reader will meet «cuarta gama» and
«quinta gama» constantly. The common usage is I fresh, II preserved, III frozen, IV
washed-and-cut ready to eat, V cooked ready to heat — that reading is the trade's own and no
document in this build states it; FEED-IA §863 names it only as «gama I–V classification for
processing levels».

**It has no legal definition.** [`docs/archive/THE-STANDARD-CATALOG.md`](../omitted-sources.md)
§1.4 opened three sources and found none: «gama» appears **0 times** in the Código Alimentario
Español consolidated to 2026, whose own taxonomy classifies by state («frescas, desecadas,
deshidratadas y congeladas»); and RD 3484/2000, the act usually cited for it, was repealed in 2022.
The numbering above is how the trade uses the words, not a standard.

*Where it appears:* in the product reference as real trade vocabulary — `cuarta gama fruta`,
`cuarta gama hortalizas` map onto ladder nodes in `src/prototypes/cedar/reference-lexicon.ts`. The reference must
not be surprised by a gama IV or V line (FEED-IA §48).

### las Mercas
**Spain's network of public wholesale markets** — the two that matter here are **Mercamadrid** and
**Mercabarna** (Barcelona). They are where a distributor buys, and their product lists are the
trade's living commercial vocabulary.

*Where it appears:* they are the reference's spine and its acceptance test. Mercamadrid gives 538
productos across 1,214 variedades over four markets; Mercabarna gives 132 fruit-and-vegetable, 171
fish-and-shellfish and 244 flower rows plus a daily price feed
([`docs/archive/THE-STANDARD-CATALOG.md`](../omitted-sources.md) §1.3). Coverage of **both** is the
bar the reference is accepted against (FEED-IA §50). In code they surface as external ids on a
ladder node (`src/prototypes/cedar/reference-lexicon.ts`) and in the catalogue's own account of where it came
from (`src/prototypes/cedar/catalogue.ts`).

### merma
**Shrinkage: the weight or value that disappears between buying and selling** — ice melt, trimming
loss, spoilage, a box that arrives short.

*Where it appears:* **in the trade's vocabulary and in the documents' background, not in this
build.** A word-boundary search of `baseweb/src/` on 2026-08-26 returns no occurrences. It is listed
here because a reader of a real supplier's albarán meets it, and because its absence is a fact about
the current model rather than a decision recorded anywhere.

---

## The round, the warehouse, the driver

### reparto
**In the trade: the delivery round — the run a van does in a morning.** *In this build the word
names something else,* and the difference matters: **Reparto** is the forked Base slider that
divides one order line across several lotes (`src/rocoto/reparto/`, scenario E2), where the invariant
is that dragging can neither create nor lose units.

*Where the delivery round actually lives:* it is modelled as the **round**, with a zone and a truck —
`src/prototypes/cedar/truck-chip.tsx` («the round is a fact about a CUSTOMER, not about a surface»),
`src/prototypes/cedar/round-map.tsx` and `round-map-geo.ts`, and the pin on the real map in `src/prototypes/cedar/pin-map.tsx`.

### repartidor
**The driver who runs the round and hands the goods over at the door.**

*Where it appears:* one of the five roles in the team model — `ROLE_DOES.repartidor` reads «Routes,
entregas and cobros on the round» (`src/prototypes/cedar/company.ts`). The gesture built for their hands is
**la entrega** (`src/rocoto/la-entrega/`): a swipe that carries the whole stop, designed for one hand,
in a vehicle, sometimes in rain.

### almacén
**The warehouse — both a place and a job.**

*As a place:* one of the house's addresses, and modelled apart from the fiscal domicile because they
answer different questions. «The fiscal domicile goes on documents; the almacén drives the [map]»
(`src/prototypes/cedar/areas/admin/business.tsx`), where **Direcciones** carries the domicilio fiscal, one or more
almacenes, and the pin.

*As a job:* a role — `ROLE_DOES.almacen` reads «Picking, stock and goods-in» (`src/prototypes/cedar/company.ts`).

---

## The house's own identity, and getting paid

### razón social
**The registered legal name of the company** — the name that goes on documents, which is often not
the name anybody says out loud.

*Where it appears:* a lead fact on **My Business**, beside the CIF — «Razón social · CIF» in the
Administration area's business card (`src/prototypes/cedar/areas/admin/business.tsx`, FEED-IA §53).

### CIF
**The company's Spanish tax identification number** — «all your CIF, all the fiscal stuff» is one of
the two facts §53 leads with (`src/prototypes/cedar/company.ts`).

*Where it appears:* beside the razón social on My Business (`src/prototypes/cedar/areas/admin/business.tsx`), and
it is a printed fact on the albarán.

*One note, and it is general knowledge rather than anything this repository states:* Spanish
administration issues the **NIF** for legal entities today, and «CIF» is the older name the trade
kept. Both refer to the same number in ordinary use.

### SEPA (recibo domiciliado)
**Direct debit: the house pulls the money from the customer's account on agreed terms.** In the
trade the instrument is called a *recibo* and having one on file is *domiciliar el pago*.

*Where it appears:* one of the four payment terms the house sets — `PAYMENT_TERMS` in
`src/prototypes/cedar/company.ts` carries `sepa` → «SEPA direct debit», beside `onDelivery`, `thirtyDays` and
`transfer`. It is the single source of truth for the agent when a customer asks «¿cómo os pago?».

The word **recibo** itself does not appear in `baseweb/src/`; the concept is carried by `sepa`.

### contado
**Payment at the moment of delivery — cash or card at the door, nothing owed afterwards.**

*Where it appears:* **the word is not in the build.** The nearest modelled term is `onDelivery` →
«On delivery» in `PAYMENT_TERMS` (`src/prototypes/cedar/company.ts`). Whether the Spanish surface should say «al
contado» is undecided and unrecorded.

---

## Adjacent words the same screens use

These are not defined at length, but a reader meets them in the role descriptions and on the
documents, and they are all in `src/prototypes/cedar/company.ts`:

| Word | What it means | Where |
|---|---|---|
| **factura** | the invoice — downstream of the albarán, once the goods are delivered | `ROLE_DOES.oficina`: «Facturas and cobros» |
| **cobro** | the collection: actually getting paid for what was invoiced | `ROLE_DOES.oficina`, `ROLE_DOES.repartidor` |
| **entrega** | the hand-over of the goods at the door | `ROLE_DOES.repartidor`; the `la-entrega` component |
| **gerente** | the manager who runs the house | `ROLE_DOES.gerente`: «The business, the tarifas, the agent's dials, the team.» |
| **oficina** | the back office | `ROLE_DOES.oficina` |
| **pedido** | the order as the customer asks for it, before it becomes an albarán | `src/prototypes/cedar/insights.ts` — «PEDIDOS AL DÍA», «VALOR MEDIO DEL PEDIDO» |
