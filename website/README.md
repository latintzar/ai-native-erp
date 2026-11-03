# Rocoto’s original food-distributor website

Rocoto is an AI-native ERP for food distributors. This package restores its original bilingual product website, including the sales, purchasing, owner and custom-agent pages and their original animated product interfaces.

[Open demo](https://preview.atelierneyra.com/apps/erp/app.html) · [GitHub](https://github.com/latintzar/ai-native-erp) · [Product guide](https://docs.atelierneyra.com/ai-native-erp/overview/)

The original site was recovered from its 8 September 2026 source. Sales shows the order sheet being written and the review queue clearing. Purchasing shows stock, daily prices, catalogue and supplier intake. The owner page connects orders to the operating report. The original illustrations, visual component code and site styles remain together.

## Browse locally

```sh
python3 -m http.server 8081 --bind 127.0.0.1
```

Open <http://127.0.0.1:8081/en/> or the original Spanish homepage at <http://127.0.0.1:8081/>.

| Page | Experience |
| --- | --- |
| [Homepage](en/index.html) | Orders arriving through existing customer channels |
| [Sales](en/sales.html) | An order sheet being built, review exceptions and warehouse paper |
| [Purchasing](en/procurement.html) | Stock, daily prices, products and supplier documents |
| [Owner](en/owner.html) | Operating activity and a sample report |
| [Custom agents](en/custom.html) | Domain-specific agent applications |
| [Original onboarding proposal](en/get-started.html) | The September 2026 service proposal and setup process |
| [Sample report](en/sample-report.html) | The original published example |

The current adoption actions open the published ERP demo, source and setup guides. The original commercial proposal is dated on its page. Account creation, lead capture, calendar booking, calls and the old company APIs stay with their existing owners.

## Edit the original visual islands

```sh
npm ci
npm run build
```

Node 22 or later is recommended. The lockfile pins React 18.3.1 and esbuild 0.28.2. `src/marketing.tsx` mounts only the original visual components; their source, token snapshot and CSS are included. Rebuilding produces `assets/hero.js`, `assets/hero.css` and the bundled third-party notices.

[Recovery and changes](docs/RESTORATION.md) identifies the exact source revision, retained pages, asset hashes, endpoint changes and archive boundaries. [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) preserves dependency and font attribution.
