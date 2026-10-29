# AI-native ERP for fresh-food distributors

Rocoto is an AI-native ERP for distributors selling fresh food to restaurants, bars and other trade customers. It starts at the order desk, where customer messages become an exact list of goods to pick and deliver.

Peter Neyra developed Rocoto with design partners over two months in their warehouses. The product is designed for the speed of the night shift: an order becomes the working paper used to pick, weigh and deliver fresh food.

## Order, paper and review

The team reviews an incoming customer order and prints the appropriate packing sheets and delivery notes. On the warehouse floor, a worker can write the actual fish weight in red pen. A phone photograph brings the sheet back: its QR identifies the printed document, and the saved page geometry associates written cells with the original order lines. A person reviews the proposed readings against the ink before accepting them.

The source includes print views, QR reading, registration and review code. Handwriting uses a configured vision provider; provider acceptance and the full real-world paper workflow require their own commissioning and evidence. The QR carries an opaque document and geometry locator, while commercial details remain in the system. See [paper](THE-PAPER-SPEC.md), [QR](THE-QR-SPEC.md), [outputs](THE-OUTPUTS-SPEC.md) and [release status](../RELEASE-STATUS.md).

## The distributor’s order

A customer might ask for six crates of plum tomatoes. The delivery note needs an exact product, grade, calibre and pack conversion: Roma plum tomato, Extra, calibre M, six 5 kg crates. Customer preferences and the team’s product knowledge determine that interpretation.

Orders arrive through WhatsApp messages, voice notes, email or calls. Product identity, requested and actual weight, availability, substitutions and agreed customer prices stay attached to the order through preparation and delivery.

~~~mermaid
flowchart LR
  A["WhatsApp · voice · email · calls"] --> B["Proposed order"]
  H["Customer history · catalogue · tariffs"] --> B
  B --> C["Review products, units and substitutions"]
  C --> D["Print packing list and delivery note"]
  D --> E["Handwrite actual weight and photograph sheet"]
  E --> F["Match QR and line · review reading"]
  F --> G["Stock, payment and order history"]
~~~

## Shared product records

One product identity connects catalogue intake, illustrations, units and pack conversions, customer tariffs, stock lots and order lines. Catalogue review separates the supplier’s source rows from the business record the operator accepts.

The original artwork adapter supports provider-generated product illustrations. Existing illustrations are included with the interactive sample; new generation uses the operator’s configured artwork account. [Provider setup](providers.md) and [catalogue workflow](workflows.md#catalogue-to-order) identify the implementation and required accounts.

## Interface decisions

| Decision | Reason |
| --- | --- |
| Review proposed commercial records | Restaurant shorthand needs the distributor’s product knowledge. |
| Preserve source and correction evidence | Operators can trace an interpretation to its message, document or prior record. |
| Keep base, pack and priced units distinct | Cases, kilograms, actual weights and customer billing describe different quantities. |
| Carry one identity through the work | Picking, stock and documents refer to the same accepted product and order. |
| Share document and output contracts | The albarán, packing list and screen readback describe consistent business state. |
| Start with order intake | The deck’s entry point is repetitive interpretation work at the order desk. |

## Continue the original work

The repository contains an interactive browser product, a persistent FastAPI/PostgreSQL backend, provider adapters and detailed product contracts. The browser workspace and persistent backend have distinct state and integration boundaries; [release status](../RELEASE-STATUS.md) records their tested scope.

The broader intelligence design covers customer history, supply expectations, substitution preferences, pricing and margin. Those contracts guide continued implementation. Each component’s verified scope remains in [verification](verification.md).

Start with [the first result](getting-started.md), then [architecture](architecture.md), [decisions](decisions.md) and the [full design specifications](design.md). The native Products area is reached through Products in the navigation, at app.html#/stock.

## Product source

This overview restores the framing from Peter Neyra’s final September 2026 Rocoto pre-seed deck and the retained product specifications. The tomato order is a product example. Commercial pipeline, market-size and fundraising figures remain with their original private source.
