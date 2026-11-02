# Rocoto

AI-native ERP for food distributors

Rocoto is an AI-native ERP for fresh-food distributors. It starts with the customer order and helps the team prepare, weigh and deliver it during the night shift.

Peter Neyra developed the product with design partners over two months in their warehouses, following the work from incoming orders to packing and delivery.

[Website](https://soyrocoto.com) · [Open demo](https://preview.atelierneyra.com/apps/erp/app.html) · [Product tour](docs/product-tour.md) · [Documentation](https://docs.atelierneyra.com/ai-native-erp/overview/)

[![Rocoto Sales showing restaurant orders, seafood line items and packing-list and delivery-note print controls](https://atelierneyra.com/assets/product-motion-v4/ai-native-erp.jpg)](https://preview.atelierneyra.com/apps/erp/app.html)

## A night-shift order

1. **Review a restaurant’s order.** Match its words to the distributor’s goods, pack units and customer prices.
2. **Print the work.** Produce packing sheets and delivery notes. A worker can write the actual fish weight on the sheet in red pen.
3. **Photograph the sheet.** Its QR identifies the saved print; recorded page geometry maps each handwritten cell to the original order line.
4. **Review the reading.** Compare proposed weights with the ink crops, accept the values and carry the order into its delivery paperwork.

## Product areas

| Area | What it does |
| --- | --- |
| Sales | Review incoming orders, customer terms, preparation and final quantities. |
| Products | Import supplier rows, review goods and pack conversions, and associate catalogue illustrations. |
| Customers | Keep the customer’s usual products, prices and substitution context. |
| Printing | Produce A4/A5 packing and delivery sheets with saved line-level geometry. |
| Paper readback | Register a photograph, inspect handwriting crops and review values against their order lines. |
| Stock and connections | Retain lots and units alongside the selected messaging, model, voice and artwork adapters. |

The hosted workspace uses sample records. Print/readback code and provider adapters are included; real handwriting acceptance and the browser-to-persistent-backend integration have their own verification steps.

[Product tour](docs/product-tour.md) explains the complete journey, UX decisions and source modules. [Release status](RELEASE-STATUS.md) identifies each implementation’s tested scope.

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

[Product tour](docs/product-tour.md) · [First result](docs/getting-started.md) · [Architecture](docs/architecture.md) · [Design decisions](docs/decisions.md) · [Full specifications](docs/design.md) · [Function reference](docs/reference/source-index.md) · [Verification](docs/verification.md)

## Licence

Original code is [MIT licensed](LICENSE). Dependencies, fonts and artwork retain their [own notices](NOTICE.md). [Image provenance](docs/assets/erp/NOTES.md) records the original components and sample data.

[made by atelier neyra](https://atelierneyra.com)
