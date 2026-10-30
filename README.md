# Rocoto

AI-native ERP for food distributors

Rocoto is an AI-native ERP for fresh-food distributors. It starts with the customer order and helps the team prepare, weigh and deliver it during the night shift.

Peter Neyra developed the product with design partners over two months in their warehouses, following the work from incoming orders to packing and delivery.

[Website](https://soyrocoto.com) · [Open app](https://preview.atelierneyra.com/apps/erp/app.html) · [Documentation](https://docs.atelierneyra.com/ai-native-erp/overview/)

[![Rocoto](https://atelierneyra.com/assets/product-motion-v3/ai-native-erp.jpg)](https://preview.atelierneyra.com/apps/erp/app.html)

## From order to delivery

1. **Review the order.** Customer messages, voice notes, emails and calls become proposed lines for the distributor to review against its catalogue and customer prices.
2. **Print for the shift.** The same orders produce packing lists for the warehouse and delivery notes for customers. Workers can write the actual fish weight on the packing sheet in red pen.
3. **Bring the paper back.** A phone photo and the sheet’s QR locator identify the printed document; its recorded layout maps handwriting to the original line for human review.

The browser workspace includes sample orders, print views, QR capture and review interfaces. The paper-reading pipeline and provider adapters are present in the source; real handwriting/provider acceptance and the browser-to-persistent-backend integration have separate verification steps. See [product guide](docs/product.md), [provider setup](docs/providers.md) and [release status](RELEASE-STATUS.md).

## Run the workspace

Use Node 22.12+ and npm.

```sh
git clone https://github.com/latintzar/ai-native-erp.git
cd ai-native-erp
make install-ui
make dev-ui
```

Open [localhost:8080/app.html](http://127.0.0.1:8080/app.html). Explore the sample food distributor, then open **Products** and paste a three-row supplier catalogue into the import review. The [first-result guide](docs/getting-started.md) walks through the original interface.

The browser workspace uses sample records and browser storage. The persistent backend has a separate starter; connecting the workspace to that backend is documented integration work. [Release status](RELEASE-STATUS.md) identifies each part’s tested scope.

## Run the backend

Use Python 3.12, PostgreSQL 16, `vector` and `ltree`.

```sh
make install
make starter-proof
```

The starter creates a local database, loads products and orders, approves an order and verifies it after PostgreSQL restarts. It also checks authentication and tenant access. [Backend setup](docs/backend-starter.md) explains the service and Docker options.

## Connect your services

Follow [provider setup](docs/providers.md) to configure your own AI, identity, calling, email and artwork accounts through a private environment file. Each integration lists its purpose, credentials and current verification status. [Agent instructions](AGENTS.md) give your coding agent the same setup path.

## Documentation

| Guide | What it covers |
|---|---|
| [Product](docs/product.md) | The distributor workflow, original ambition and implementation boundaries |
| [First result](docs/getting-started.md) | Run the product and explore its sample food distributor |
| [Workflows](docs/workflows.md) | Catalogue import, orders, delivery and documents |
| [Architecture](docs/architecture.md) | Workspace, persistent backend and provider boundaries |
| [Decisions](docs/decisions.md) | Product and engineering choices, with source references |
| [Design specifications](docs/design.md) | The full ERP product and interaction model |
| [Functions and modules](docs/reference/source-index.md) | Navigation through 804 modules and 11,015 named symbols |
| [Verification](docs/verification.md) | Tests, persistent-data proof and integration status |

## Licence

Original code is [MIT licensed](LICENSE). Dependencies, fonts and artwork retain their [own notices](NOTICE.md). [Image provenance](docs/assets/erp/NOTES.md) records the original components and sample data.

[made by atelier neyra](https://atelierneyra.com)
