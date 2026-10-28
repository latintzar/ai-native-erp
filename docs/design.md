# Product design and specifications

Start with the product, then follow the system beneath it. These retained specifications describe the full original ERP direction; current implementation evidence is in `RELEASE-STATUS.md`.

| Subject | Contract |
|---|---|
| Product and shared systems | [System](THE-SYSTEM-SPEC.md), [object map](THE-OBJECT-MAP.md), [architecture](THE-ARCHITECTURE.md), [schema](THE-SCHEMA-SPEC.md) |
| Interaction and workflow | [Interaction](THE-INTERACTION-SPEC.md), [journeys](THE-JOURNEYS-SPEC.md), [implementation](THE-IMPLEMENTATION-SPEC.md) |
| Catalogue and interpretation | [Catalogue](THE-CATALOGUE-CONTRACT-SPEC.md), [product sheet](THE-PRODUCT-SHEET-SPEC.md), [parsing](THE-PARSING-SPEC.md) |
| Quantity and stock | [Units](THE-UNITS-SPEC.md), [stock lots](THE-STOCK-LOTS-SPEC.md) |
| Documents and physical work | [Outputs](THE-OUTPUTS-SPEC.md), [paper](THE-PAPER-SPEC.md), [QR](THE-QR-SPEC.md) |
| Runtime and intelligence | [AI](THE-AI-SPEC.md), [intelligence](THE-INTELLIGENCE-SPEC.md), [runtime](THE-RUNTIME-SPEC.md), [Copilot](THE-COPILOT-SPEC.md) |
| Channels and source access | [Connections](THE-CONNECTIONS-SPEC.md), [source privacy](THE-SOURCE-PRIVACY-SPEC.md), [voice](THE-VOICE-CONNECTION-SPEC.md) |
| Cedar’s concrete workspace | [Product](../app/src/prototypes/cedar/PRODUCT-SPEC.md), [operations hub](../app/src/prototypes/cedar/OPERATIONS-HUB-SPEC.md), [onboarding](../app/src/prototypes/cedar/ONBOARDING-SPEC.md) |
| Native collection | [Payments](../app/src/prototypes/cedar/PAYMENTS-SPEC.md), [Money](../app/src/prototypes/cedar/MONEY-SPEC.md), [service](../app/src/prototypes/copper/SPEC.md) |

The product brief and shared kit explain the interaction language. New code should use their actual components and semantic tokens. Product visuals come from those rendered components, with source and capture evidence; the artwork library keeps its generation/normalization records.

Specifications distinguish an intended system from an adopted/wired capability. Follow their relevant source and the release’s current proof before claiming provider acceptance, a connected UI/backend path or a completed intelligence module.
