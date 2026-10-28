# Spanish snapshot

`app.html` remains the English iteration surface. `app-spanish.html` is a separate generated `es-ES` snapshot. Build it with `vite build --mode spanish-snapshot`; that mode transforms English TSX source literals before JSX compilation and emits only the Spanish entry and its assets.

## Two publications of the same snapshot

| Command | Where the Spanish entry lands | Browser state |
|---|---|---|
| `npm run build:app-es` | `dist/app-spanish.html` — the standalone snapshot the kit gallery publishes | its own `rocoto-spanish-app-` keys |
| `npm run build:app-en` | `dist-export-review/cedar/es/index.html` — inside the development artifact, beside `/cedar/` | the same `rocoto-app-` keys as `/cedar/` |

`tools/build-english-app.mjs` runs the second build itself, sequentially after the English one, reusing this same `vite.config.ts` mode so the transform and the reviewed tables apply identically. It sets `base` to `/cedar/es/`, skips the public files the English build already wrote to the artifact root (`ROCOTO_BUILD_PUBLIC_FILES=0`), and sets `ROCOTO_SPANISH_STATE=shared`.

**Shared state is what makes the language a setting rather than a second demo.** `prepareSpanishDisplaySource` rewrites every `rocoto-app-` key to `rocoto-spanish-app-` so that trying the standalone snapshot leaves English design data alone. Inside the development artifact the two entries are one workspace in two languages, so `ROCOTO_SPANISH_STATE=shared` skips that rewrite: a person switching language mid-demo keeps their day, their orders and their setup. `cedar/prototype.json` records `spanishEntry` and `spanishEntrySha256` beside the English entry's hash, and `cedar/es/spanish-snapshot-provenance.json` sits beside the Spanish entry.

`tools/bundle-budget.mjs` leaves `cedar/es/` out of its total on purpose: a browser loads one of the two entries, never both, so counting the pair would answer «what must the browser parse» with the size of two builds.

## Choosing the language

`src/prototypes/cedar/display-language.ts` owns the whole decision and holds no React: the shared unprefixed key `rocoto-display-language` (`en` | `es`), the map from any entry path to the other language's entry, and the boot decision both entries run before they render. `tools/test-display-language.mjs` checks it directly.

- **Settings → Language** offers exactly the languages the running build published. Choosing one stores the preference, writes the same answer into the company record's `language` field, and goes to that language's entry with the hash — the surface a person is standing on — intact.
- **On the English entry** a stored Castellano replaces the address with the Spanish entry. **On the Spanish entry** it stays: a Spanish link opened directly is a person asking for Spanish, so the entry records itself as the answer.
- `src/prototypes/cedar/app-root.tsx` is the one mount both `main.tsx` and `snapshot/main-spanish.tsx` call, so the providers, the hosts and that boot decision are written once. The Spanish entry adds only Base's `es` locale, for the components that carry their own words.

### A language with no build is not a destination

`tools/build-english-app.mjs` is the only thing that writes a Spanish entry, so it is the only thing that says one exists: every entry document it publishes — `app.html`, `index.html`, `cedar/index.html` and `cedar/es/index.html` — carries `<meta name="rocoto-spanish-entry" content="/cedar/es/">`. `display-language.ts` reads that marker and the served document's own `lang`, and both decide:

| What the document says | What boot does |
|---|---|
| no marker (`make dev`, the kit gallery, an older artifact) | stays English, and Settings offers English alone |
| marker, English address, stored Castellano | relocates to the published Spanish entry, hash and all |
| Spanish address, `lang="es"` | stays Spanish and records the entry |
| Spanish address, `lang="en"` (the host served the English fallback) | one hop to `/cedar/es/index.html`; English there too records `unpublished`, so English stands and the picker offers English alone |

Before this, the relocation target was a constant: under `make dev` — which publishes no `cedar/es/` — one press of Castellano left Cedar for the dev server's SPA fallback, and the stored preference sent every later load of `/app.html` back there, with the Settings screen that could undo it exactly what could no longer mount. `tools/test-display-language.mjs` holds every row of that table, and `drives/drive-cedar-country.py` walks the two broken origins in a browser: a copy of the artifact with the marker stripped, and a copy whose `cedar/es/index.html` is the English document.

### The four shipped output names

«Delivery notes», «Packing list», «Packing sheets» and «Day sheet» are deliberately absent from the seed dictionary. `output-templates.ts` declares them as `name:` values on the records it SEEDS, and inside the development artifact the two entries share one unprefixed store key (`rocoto:outputs:templates`) — so a seed entry wrote Spanish names into the record the English design build then read back, and the English Sales day header said «Albaranes · 32 left». `snapshot/spanish-display-source.ts` maps the four where they are RENDERED instead — `areas/sales.tsx`, `print-screen.tsx`, `shell/printing.tsx` and `print-view.tsx` — so the stored record stays one language-neutral set of English shipped names and a name a person TYPES stays their own words.

**Language is the words; Country is the market.** `workspace-capabilities.ts` owns Peru/Spain — currency, prices and the Money book — and its key sits outside the `rocoto-app-` prefix too. All four combinations render: English or Castellano, each with soles or euros. A country change leaves the language alone and a language change leaves the market alone; `drives/drive-cedar-country.py` walks all four and asserts money in each, English + Spain included.

**One currency, one grammar.** Spain reads es-ES everywhere — «15.269,00 €» — so `money-model.ts`'s formatters take the market's locale the way `currency.ts`'s `soles()` already does, and Money and Sales print the same shape one click apart. The drive reads the separators themselves rather than asserting a «€» is somewhere on screen.

## What Spain presents today

Country is a market and currency selector, not a geography migration. With Spain selected, the workspace reads euros end to end — balance, invoices, transactions, advances, customer credit, tariffs and every resting figure — converted from the canonical PEN amounts at the seeded reference rate in `currency.ts`. What stays as it is: the synthetic fish cast is Catalan, its customers carry Barcelona addresses and coordinates, and the delivery map draws that round. Real invoice, bank and provider evidence keeps its own recorded currency in either country. A Spain demo therefore shows Spanish words, euro amounts and a Barcelona round, which is the intended shape; moving the cast to another geography is a separate, explicit piece of work.

The transform parses source with Babel before JSX compilation and only replaces reviewed dictionary entries in `src/prototypes/cedar`, `src/scenarios` and `src/rocoto`. It supports JSX text, static literals, and template literals with their `${…}` expressions intact. It never changes runtime DOM, identifiers, routes, test IDs, typed user input, customer names, product names or SKU values. Seeded demonstration conversations are translated at build time; messages typed during use retain the writer’s own words. At build time Vite derives the exact source commit, stamps it into `app-spanish.html`, and emits `spanish-snapshot-provenance.json`. Extend the reviewed JSON dictionaries for new source copy; never fork a UI component for Spanish.

Status: generated Spanish demo; coverage and review are separate. All tabs and fixture copy have translation entries. Runtime and visual verification must be recorded before claiming completion. English app.html is never overwritten by a snapshot-only publish.

## Spanish editorial review (§174)

Use Spain Spanish and name the business action: **Catálogo** for the working product list, **albarán**, **pedido**, **tarifa**, **variante**, **lote**, **responsable**. Reserve stock for quantities in the warehouse. Account activation is **Activar la cuenta**, and the knowledge graph is **Mapa de conocimiento**, not a website.

The snapshot has its own `rocoto-spanish-app-*` local storage so trying the demo cannot overwrite English design data or pull old English fixture messages into Spanish. Machine states, routes, IDs, enums and provider field names remain stable; snapshot-only display adapters give state and classification values Spanish labels.

Template translations preserve expressions and allow their order to follow Spanish grammar. Joined UI sentences are translated without changing comparison literals. Fixture reviews using older semantic kinds are resolved to literal/template/JSX syntax kinds at the lookup seam.

Publication copies only new hashed assets and the Spanish entry/provenance. It never overwrites the existing English asset files or app.html. Source fingerprints and the public entry are checked after publication.

## Verification of the editorial revision

- Build and TypeScript checks passed; all ten repository push gates passed.
- Eleven administration pages loaded with no page errors or horizontal overflow.
- Fish, fruit/vegetable and meat catalogues, new-product forms and chat lists opened successfully.
- Served pages were inspected at 1600 and 390 pixels. The albarán retained its ID; quantity and unit editing worked independently; product/customer sheets and the export modal opened with no page errors.
- A Chromium renderer crash was observed during a broad route walk. The same crash also occurred on the previous build; controlled reruns passed both versions, and the Hotel Rec route passed five fresh runs. It is recorded rather than counted as an uninterrupted green walk.
- English app.html matched its own pre-deploy hash after each Spanish publication. No runtime or app.soyrocoto.com changes were made.

The source dictionaries contain reviewed copy for main and secondary surfaces; these checks are not a claim that every possible combination of user data and UI state was manually visited. [GitHub issues](../docs/omitted-sources.md) track further English layout work; the [earlier acceptance record](../docs/omitted-sources.md) preserves its design history.
