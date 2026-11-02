# Product tour

Rocoto is an AI-native ERP for food distributors. It turns messages and calls into orders, carries them through the warehouse’s night shift, and keeps printed packing sheets, handwritten weights and delivery notes linked to the same records.

Orders arrive in WhatsApp, voice notes, email and calls. Warehouse teams need to identify the right product quickly, prepare it, record its actual weight and get the paperwork out before the delivery run.

## A fish order through the night shift

1. **Review the order.** A restaurant’s message becomes proposed product lines. In Sales, check the customer, product, pack conversion and agreed price. The order carries the original request into preparation.
2. **Print for the bench.** Choose the packing list or delivery-note layout and A4 or A5 paper. A saved print records the order lines and the exact position of each writable cell.
3. **Weigh the fish.** The worker writes the actual weight in red pen on the printed sheet. A sheet can contain several orders; its QR identifies the saved print and its page geometry.
4. **Photograph and review.** The reading pipeline registers the photo against that geometry and proposes values beside crops of the handwriting. A person accepts a reading against its original order line.
5. **Finish the order.** Reviewed final quantities remain with the order used for the delivery note and its later history. The paper and screen describe the same goods.

The browser demo lets you inspect sample orders and their print/review interfaces. The full paper journey combines that interface, the released reading pipeline, a configured handwriting provider and warehouse acceptance.

## Product areas

| Area | What you do | Result |
| --- | --- | --- |
| Sales | Review incoming orders and preparation. | Customer, goods, units, prices and actual weights stay on one order. |
| Products | Import supplier rows and review product identity, codes and pack conversions. | An accepted catalogue item can be reused in orders, stock and documents. |
| Customers | Keep customer terms, usual products and substitutions with the trading relationship. | The distributor has the context needed to interpret restaurant shorthand. |
| Printing and readback | Print working sheets and review photographed handwriting. | A saved manifest maps a reading to the exact printed line. |
| Stock and lots | Represent availability, provenance and allocation in base and pack units. | Preparation can refer to the relevant lot and quantity. |
| Connections and artwork | Configure message, call, parsing and illustration adapters. | Each provider has an explicit input, account and verification boundary. |

## Design decisions

- **Orders lead the interface.** The product grew through two months with warehouse design partners. Night-shift speed shaped the order-first screen and the preparation sequence.
- **Paper carries structured identity.** A QR locates the saved print; measured page geometry locates each cell. This also supports several orders on one sheet.
- **A reading remains reviewable.** The proposed number travels with its ink crop. Acceptance belongs to the person preparing the order.
- **Units describe different jobs.** Crates, kilograms, requested quantities, actual weights and priced units retain their individual meaning.

## Reached stage

The released browser uses sample records and its own stores. The persistent FastAPI/PostgreSQL backend has a separate tested starter. Print geometry, QR registration, readback and provider adapters are retained in source; connecting the browser to that backend and accepting real warehouse handwriting are explicit continuation steps. Existing catalogue paintings are included; fresh illustration generation uses the separate artwork adapter and your account.

## Modules

| Source | Responsibility |
| --- | --- |
| [Order intake](../app/src/prototypes/cedar/order-intake.ts) | Turn source context into proposed order lines. |
| [Sales workspace](../app/src/prototypes/cedar/areas/sales.tsx) | Present orders and their current work. |
| [Catalogue import](../app/src/prototypes/cedar/onboarding-catalogue.tsx) | Review supplier input before accepting catalogue records. |
| [Print queue](../app/src/prototypes/cedar/print-queue.ts) | Retain print attempts, work and history. |
| [Print geometry](../app/src/prototypes/cedar/paper-manifest.ts) | Save page, order, line and cell positions in millimetres. |
| [Readback interface](../app/src/prototypes/cedar/paper-read-back.tsx) | Review ink crops and accept values onto order lines. |
| [Paper service](../mock-api/app/paper.py) | Register photographed pages and call the selected reading provider. |
| [Persistent runtime](../backend/runtime.py) | Coordinate scoped events, model work and deterministic outbound gates. |

## Guides

| Guide | What it covers |
|---|---|
| [Product](product.md) | The distributor workflow, original ambition and implementation boundaries |
| [First result](getting-started.md) | Run the product and explore its sample food distributor |
| [Workflows](workflows.md) | Catalogue import, orders, delivery and documents |
| [Architecture](architecture.md) | Workspace, persistent backend and provider boundaries |
| [Decisions](decisions.md) | Product and engineering choices, with source references |
| [Design specifications](design.md) | The full ERP product and interaction model |
| [Functions and modules](reference/source-index.md) | Navigation through 804 modules and 11,015 named symbols |
| [Verification](verification.md) | Tests, persistent-data proof and integration status |


## Setup and implementation

[First result](getting-started.md) · [Backend setup](backend-starter.md) · [Provider setup](providers.md) · [Architecture](architecture.md) · [Design decisions](decisions.md) · [Full specifications](design.md) · [Function reference](reference/source-index.md) · [Release status](../RELEASE-STATUS.md)

[made by atelier neyra](https://atelierneyra.com)
