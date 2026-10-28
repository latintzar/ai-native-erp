# Rocoto kit and product candidates

One Vite project contains the component gallery, scenarios and named product candidates. They import the
same theme in `src/rocoto-theme.ts` and components in `src/rocoto/`. A shared-source change reaches
consumers when they are rebuilt and deployed. Gallery-only examples can change independently.

Outside this project, `Rocoto-Labs/site` owns marketing. `Rocoto-Labs/albaranes-bridge` is a
standalone prototype for trying delivery-note imports. Each owns its styles. The site also pins the component subset used by its join page in
[`vendor/rocoto-kit`](https://github.com/Rocoto-Labs/site/tree/main/vendor/rocoto-kit), with its
source commit recorded. A kit change reaches that consumer when a site commit adopts the update
and rebuilds it. This project is private application source, not a published cross-repository package.
A future extracted package would need versioned releases and pinned consumer dependencies.

| Entry | Serves | Live at |
|---|---|---|
| `index.html` → `src/main.tsx` | **The kit** — the design system's reference site, Uber-docs shape | https://kit.soyrocoto.com |
| `app.html` → `src/prototypes/cedar/main.tsx` | **Cedar** — the product candidate, built on the shared kit | Named build entry: `https://demo.soyrocoto.com/cedar/`; old kit address transitions through the gallery release |
| `scenarios.html` → `src/scenarios/main.tsx` | **The situations catalogue** built on the kit | https://kit.soyrocoto.com/scenarios.html |

The scenarios entry is built and served but no longer a canvas — its standing is stated in
[`docs/archive/SCENARIOS-STATUS.md`](../docs/omitted-sources.md). The dated keyboard,
screen-reader and reduced-motion audit is [`ACCESSIBILITY.md`](ACCESSIBILITY.md); verify its
findings against the current source when changing those surfaces.
Its third-party attribution is recorded in [LICENSES-AND-ATTRIBUTION.md](../docs/kit/LICENSES-AND-ATTRIBUTION.md).

The kit hostname owns the design-system gallery. CI serves Cedar
at `demo.soyrocoto.com/cedar/`, with `/` and `/app.html` retained as compatible development entries.
The earlier kit-hosted Cedar snapshot is preserved; its transition follows the
[kit publisher](../docs/omitted-sources.md). Staging runs the product backend; its frontend will be commissioned
with the wired product build. See
[product versions](../docs/PRODUCT-MAP.md) and [environments](../docs/ENGINEERING.md#environments-and-release-authority).

The [Cedar candidate](src/prototypes/cedar/README.md) is a design build: its browser model and fixtures demonstrate behaviour. Its proposed
implementation, if selected for adoption, is [THE-KIT-TO-PRODUCT-PLAN](../docs/THE-KIT-TO-PRODUCT-PLAN.md),
[THE-AI-SPEC](../docs/THE-AI-SPEC.md), and [THE-IMPLEMENTATION-SPEC](../docs/THE-IMPLEMENTATION-SPEC.md).
The components and design system stay shared when product adapters are added. Wiring is a later
work package; this repository cleanup preserves the design. Peter can keep exploring it, retain it
as a reference or choose another direction.

Another possibility for Rocoto gets a sibling under `src/prototypes/<codename>/`, with its own UI,
fixtures, specification and stub/runtime configuration. A short unique codename can remain stable
while the idea changes; candidates can address the same market or different problems. Reuse the
shared kit deliberately. Candidate experiments stay in their source; adopted kit changes reach
all consumers on rebuild. The gallery's app-primitives section demonstrates Cedar-owned examples.
Development candidates can mix fixtures, browser storage, SQLite, Postgres and private reads from
an account Peter explicitly selects for that Rocoto trial. Record its actual owner and consumer in
company Operations. Their declared target and intended use set the lifecycle. Candidate
source, protected runtime state and browser state each keep their own preservation and reset choice.

Version a candidate's source together: UI, fixtures, assets and specifications belong to one Git
commit. A reference tag such as `prototype-cedar-2026-09-08` can preserve a selected snapshot;
the build and its review evidence identify that commit. `app.html` remains Cedar's compatibility entry.
The `v*` tag namespace belongs to the guarded publication workflow. Existing published kit
provenance and its verification limits are in [engineering readiness](../docs/ENGINEERING-READINESS.md#prototype-reference).

---

## Prerequisites

- **Node 22**, matching `.nvmrc` and CI.
- **React is pinned to 18.3.1.** React 19 removed function-component `defaultProps` and `baseui@16`
  breaks on it. The pin is load-bearing.
- `npm ci` in this directory (or `make install` from the repository root).
- For the drive harnesses: Python 3 with `playwright` and its Chromium browser installed.

## Run

```bash
npm run dev         # UI and fixtures only, from app/
```

Vite serves the component gallery at `http://localhost:8080/`, the prototype at `/app.html`, and
scenarios at `/scenarios.html`, with hot reload. For another worktree use
`npm run dev -- --port 8081`; each task owns its server. `?theme=proof` exercises the alternate brand.

For the app and its own prototype API, run `make dev` from the repository root instead. It prints
the assigned app/runtime URLs, reserved ports and runtime-state lifetime. Temporary server state is
the default. Preserve it outside Git trees with:

```bash
make dev RUNTIME_STATE=/home/peter/.local/state/rocoto/cedar UI_PORT=8081
```

Browser state is independent and follows its origin; a stable `UI_PORT` reuses that origin. Export
or migration of that browser state remains an explicit operation.
`RUNTIME_ENV=/absolute/path/to/private.env` selects the runtime's provider configuration. The
candidate's per-operation permissions determine reads, writes, messages, calls and other effects.
Private account data on a published preview uses server-side authentication and an owned access
policy. This command runs the shared prototype runtime; a candidate with a separate service keeps
its own explicit run command and configuration beside its source.

## Build

| Command | Output | Contents |
|---|---|---|
| `npm run build:app-en` | `dist-export-review/` | Cedar in both languages: `/cedar/` English, `/cedar/es/` Castellano; `index.html` is an alias of `app.html` for demo |
| `npm run build:kit` | `dist-kit/` | Gallery, shared resources, source receipt and Cedar compatibility link |
| `npm run build:app-es` | `dist/` | The standalone Spanish snapshot the kit gallery publishes |

`build:app-en` runs the two builds sequentially in one process — English first, then the Spanish
snapshot into `cedar/es/` with its own base and the same browser state. Both are generated from
the English source; [Spanish-snapshot.md](Spanish-snapshot.md) holds the transform, the tables and
the language preference. `ROCOTO_BUILD_OUT_DIR=dist-<name>` builds into a worker's own directory,
and `ROCOTO_BUNDLE_DIST=dist-<name>` points `tools/bundle-budget.mjs` at it.

Vite replaces each target's output directory. Build in the task's own worktree and check the exit
status before serving its artifact. CI builds the English prototype for demo.
The kit release workflow publishes the gallery and `kit-version.json` from one source commit.
It preserves earlier scenarios/document snapshots and the previous Cedar entry in release backups.
The gallery and prototype have distinct build commands and deployment ownership;
[publication checks](../docs/omitted-sources.md) enforce that separation.

## Verify

Run the frontend type and theme checks below; `make gates` from the repository root runs the full
set of repository checks.

```bash
npx tsc -p tsconfig.app.json     # types; the parked surfaces under areas/_parked and shell/_parked are typechecked too
node tools/theme-gate.mjs        # the re-theme law: no hard-coded paint outside the theme
```

**The drive harnesses** are tracked in [`../drives/`](../drives/). They exercise the built bundle
with seeded browser state and fixtures, covering recording, reordering, printing, catalogue,
customers, chats and whole-app journeys. Run `make drives` from the repository root after the
English build; its runner pins the expected suites and checks. `ROCOTO_DIST` selects the local
candidate (default `app/dist-export-review`); `ROCOTO_URL` selects a published candidate. Individual
suites document their supported options. Read each result's declared scope and provider posture.

Two things about them are worth knowing before you write another one:

- **Read the thing that actually scrolls.** Under §38's pane model `window.scrollY` is nailed to
  zero on the desk, so an assertion that reads the window goes green for the wrong reason. The
  suites read the list pane's `scrollTop` (`[data-testid=list-pane]`) and fall back to the window
  on the phone. A check that cannot go red is not a check.
- **Chromium needs lean flags on this box** (`--disable-gpu --disable-software-rasterizer
  --renderer-process-limit=1 …`). A renderer killed under memory pressure is not a failing
  assertion.

**The bar is looking.** Screenshots at **1600** and **390**, read as images. Grepping the HTML
proves nothing — this build shipped blank three times historically on greps that passed.

## Deploy

A merged PR changing prototype inputs deploys this frontend and its prototype API through
[CI's development target](../docs/omitted-sources.md). Maintained operator UI changes select the
separate staging target; unrelated documentation changes select neither publication.
The kit gallery has its own publication. Its human-authorized `vX.Y.Z` tag workflow
is the single publisher; see [engineering readiness](../docs/ENGINEERING-READINESS.md).
Review source/build identity and the rendered journey at desktop and mobile widths after a deploy.

---

## What the design system is

**Uber's Base Web, adopted whole.** Not the principles — the literal thing (`baseui@16.1.1`, MIT).
Every control's variants, sizes, shapes, states and transitions are Base's engineering, running
unmodified. Rocoto supplies exactly three things:

1. **The brand colours** — ink `#1A1413`, saffron `#C01B2C`
2. **Inter** — the company face, on every typography step
3. **The dotted paper** — 14px grid of 1px dots, on conversational surfaces

Everything else — type scale, spacing, radii, motion, elevation, density — is Base's own.

The kit's reference site has the Uber-docs shape: components by UI name in the sidebar, one page
per component, and on every page a usage line, every example live, a **Specs** toggle (hover any
element and its real measurements draw on it, read from the DOM) and a **Props** table generated
from the component's own `types.ts`.

## The laws

- **THE RE-THEME LAW (SUPER KEY).** The brand — colours, font, corner radii, dots — lives ONLY
  in the `BRAND` block of `src/rocoto-theme.ts` (`makeTheme(brand)`). Changing brand is editing
  that block; nothing else may hard-code a colour, a font family, or a radius — kit pages,
  components, **app surfaces** and **scenario screens** alike. Enforced by `node tools/theme-gate.mjs`
  (fails the check on hard-coded paint; `// theme-gate-allow: <why>` is the audited escape hatch).
  Proven live: open any page with **`?theme=proof`** — a garish alternate brand — and everything
  must visibly move. An element that doesn't move is hard-coded, and that is a bug.
- **Colour is not a status system.** Ink does the work. `negative`/`warning`/`positive` collapse
  onto ink in the theme; there is no red/amber/green anywhere.
- **Saffron marks only the AI's own act** — one law on every surface, marketing included. The one
  sanctioned exception is the **connect wash** (FEED-IA §51.20): the brand hue at 4–13% of the
  paper on the three integration surfaces, mixed from theme tokens, a ground rather than an ink.
- **A price's unit shares the number's line.** Always.
- **No monospace on product surfaces.** Sans with tabular figures.
- **Spanish product copy says what IS.**
- **No ornament.** No paper textures, tape, dog-ears, rotation. The distinctiveness is the
  constraint, not decoration.
- **Kit copy is Uber's, verbatim.** Demo content in the kit is Base's own example copy —
  UNTHEMED. Putting trade content on a control («Elegir lote» on a dropdown) silently decides
  which control serves which moment of the product; that mapping is the situations catalogue's
  job, made explicitly. Trade copy appears ONLY in scenario screens and in the app. (Peter,
  2026-08-21: "too committal, too themed, too biased — Uber's has content examples only because
  they actually have a good app already; we are yet to do this systematically.")
- **Component API references are generated.** Props from `types.ts` (`tools/extract-props.mjs`),
  measurements from the live DOM (`src/kit/redline.tsx`). Product behaviour and wiring specifications are maintained Markdown in `../docs/`.

The app adds its own laws on top of these; they are stated in one screen in
[`../README.md`](../README.md) and in full in [`docs/FEED-IA.md`](../docs/FEED-IA.md).

## The method (three tiers)

1. **Use** — Base has it → 1:1, re-themed. ~80 components.
2. **Fork** — Base has something close → `node tools/fork.mjs --source-root /path/to/baseweb <base-component> <name> "<why>"`
   duplicates its real source from the explicitly supplied, version-matched upstream checkout into
   `src/rocoto/<name>/`, keeps Uber's MIT
   notice, logs every edit in `CHANGES.md` marked `ROCOTO:`. Forked so far: **candado** (Slider —
   a set of tiers moving under one lock) · **reparto** (Slider — one line split across lotes) ·
   **captura** (File Uploader — the bay's three doors) · **la entrega** (Sliding Button — one hand,
   in a vehicle, in rain).
3. **Grow** — Base has nothing → fork Base's own `template-component` scaffold, so even new
   components inherit the overrides contract, theme-driven styling and focus handling.
   Grown (all English UI names, all browser-verified by their authors): **Figure** (the numeric
   display: superseded value struck through, unit on the number's line) · **Message** ·
   **Composer** · **Voice Button** (the app's golden gesture machine: hold, 90px-left cancel,
   70px-up hands-free, 1s discard, tap-lock) · **Waveform** (live/static/scrub) · **Transcript**
   (composes Overlay Card) · **Overlay Card** (the chromeless overlay; the doctrine page) ·
   **Gallery** (ported thresholds from the app's viewer) · **Signature Pad** · **Charts**
   (Line/Bar/Area on visx, ink marks on paper) · **Ghost** (structured skeleton for scenario
   negative space; inert, nestable, re-brands via color-mix) · **Weight Entry** (the odometer
   grammar of §16) · **Price Accordion** (pricing's finite fractal) · **Stock Announcement** ·
   **Memory Log** · **Produce Icons** · **Paper** (the print surface's real sheet geometry).
   Each grown component's `index.ts` carries the same export shape as Base's own
   `template-component`, so a consumer imports a Rocoto component exactly the way it imports a
   Base one.

## Layout of this directory

```
index.html · app.html · scenarios.html   the three entries
vite.config.ts                           gallery/scenarios/app inputs; npm run dev uses port 8080
tsconfig.app.json                        the app's typecheck (parked surfaces included)
src/rocoto-theme.ts   THE BRAND BLOCK — the one place brand lives; makeTheme + the colour-law sweep
src/kit/              the reference site: App.tsx (Uber's taxonomy) · chrome.tsx (Section/Tile/Grid/Row)
                      · redline.tsx (the Specs overlay) · sections/*.tsx (every Base example)
                      · props.json (checked-in generated reference)
src/rocoto/<name>/    Rocoto's own components, forked or grown, each with its CHANGES.md
src/scenarios/        the situations catalogue: screens, chassis, ghosts, data, the reduction
src/prototypes/<codename>/  product alternatives, each with its own README/spec and candidate source
src/prototypes/cedar/       the existing sales/products/customers/administration candidate (see below)
tools/                the generators and the gate (see below)
public/               inter.woff2 · brand/ · paintings/ · map/ (OSM raster tiles) · notes/
dist-export-review/   English prototype build; dist-kit/ the gallery build; dist/ the Spanish snapshot
                      (all gitignored; each worktree owns its outputs)
```

### `src/prototypes/cedar` — the existing candidate

**The shell** owns what is true on every surface; an area owns its own surface and nothing else.

| File | What it is |
|---|---|
| `App.tsx` · `main.tsx` | The entry. Same providers, same theme, same components as the kit. The config wraps everything, above the router and the frame. |
| `shell/area.ts` · `route-meta.ts` | The area contract and lightweight route register. A route has its component under `areas/` or `areas/admin/` and its metadata in `route-meta.ts`; `App.tsx` loads the selected component lazily. |
| `shell/index.ts` | The shell's public face — what an area package may import. |
| `shell/frame.tsx` | The app assembled: navigation · day bar · the open strip · the area · the chats widget. |
| `shell/rail.tsx` · `shell/bottom-nav.tsx` | The desk rail (mark, tabs, the person at its foot) and the phone's bottom row — the same navigation in two housings. |
| `shell/viewport.ts` | Shared responsive thresholds for phone, stacked panes, wide sheets and the Copilot. |
| `shell/day-bar.tsx` | The day, the area's name, the export door. One line, three things. |
| `shell/printing.tsx` | The export centre — the header's one door onto PRINT · ERP · EMAIL. |
| `shell/chats.tsx` · `threads.ts` · `media.tsx` · `embeds.tsx` | The chat widget (the only door there is), the threads folded out of the sales, the voice notes and images, and the work-standing-in-talk embeds. |
| `shell/open-items.tsx` · `open.tsx` · `page.tsx` · `glyphs.tsx` | The open-albaranes strip, the open pointer, the area page anatomy, the navigation's marks. |
| `shell/search-modal.tsx` | **THE ONE SEARCH** (§91.2). Every search in the app, in one box: the field leads, the list beneath varies by intent, every row is a door. Summoned by any mark, by the rail's Find row, and by «/» or ⌘K. |

**The areas** (`src/prototypes/cedar/areas/`) are `sales.tsx`, `stock.tsx` and `customers.tsx`, with
Administration's settings under `areas/admin/`. `_parked/` holds earlier surfaces for reference.
The router's globs exclude that directory; the app typecheck includes it.

**The model and the organs** live at the root of `src/prototypes/cedar/`:

| File | What it holds |
|---|---|
| `sale.ts` | THE SALE — the central object and the event ledger it folds from. |
| `company.ts` | THE COMPANY — the fourth object, and what Administration is a reading of. |
| `catalogue.ts` | The inventory's four strata, grounded on Rocoto's own tree. |
| `tiers.ts` · `stock-tiers.tsx` | The tarifas: the registry, the sheet, and the log every price change lands in. |
| `grants.ts` | What the house lets Rocoto do alone, and the questions that set them. |
| `net.ts` | The six checks that stand over every order — the trust net, named in one place. |
| `knows.ts` · `knows-web.tsx` | What Rocoto has learned, and the surface that brings it to life. |
| `trace.ts` | Every correction, made readable as labeled training data. |
| `print-queue.ts` · `print-view.tsx` | Printing as a background job, and paper as a place in the app. |
| `suppliers.ts` · `supplier-forwarding.tsx` | Partner forwarding on cutoff timers — the fourth export rail. |
| `incoming.ts` · `inbox.tsx` | The arrivals ledger, and the supplier email feed as a real inbox. |
| `config.ts` | The onboarding's answers as one live structure, and how they set the app's emphasis. |
| `anchors.tsx` | The object doors (`openCustomer` / `openProduct` / `openOrder`) and the «from your setup» affordance. |
| `rows.tsx` | The ONE section grammar every seat in the app is written in (§51.24). |
| `glyphs.tsx` | The marks: `GlyphId` is the vocabulary of meanings, `MAP` says which mark draws each one. |
| `detail.tsx` | The sale, open — the document, the annotation, the actions. |
| `product-card.tsx` · `product-face.tsx` | The product sheet, and the face of the goods. |
| `customer-profile.tsx` | The customer, open. |
| `search.tsx` | The MATCH — elastic terms, the fold, the highlight — and the old expanding seat, kept for the surfaces still standing in it. |
| `pin-map.tsx` · `round-map.tsx` · `round-map-geo.ts` | The pin on a real map (live), and the drawn round it replaced (parked but compiling). |
| `connect.tsx` | The connect zone — the one place allowed to feel like plugging something in. |
| `truck-chip.tsx` · `day.ts` · `rules.ts` · `capability.tsx` | The truck on the card, the derived day, the rules a person leaves running, the capability questionnaire. |
| `reference-data.ts` · `reference-lexicon.ts` · `painting-map.ts` | Generated reference data and painting rows. The painting map also contains reviewed resolver logic and curated aliases that the generator preserves. |

`capture.tsx`, `order-open.tsx`, `supplier-forwarding.tsx` and `shell/open.tsx` retain earlier
compositions and are covered by the app typecheck; the current app entrypoints do not import
them. `export-period.ts` retains export-coverage logic exercised by `test-export-period.mjs`.
The router and current specs identify the active surfaces when revisiting these references.

### `tools/` — the generators

| Tool | What it does |
|---|---|
| `theme-gate.mjs` | Fails on hard-coded colour, font family or radius outside the theme. |
| `fork.mjs` | Duplicates a Base component's real source into `src/rocoto/<name>/` with its MIT notice and a `CHANGES.md`; requires `--source-root /path/to/baseweb` and copies its license. Existing destinations are preserved. |
| `extract-props.mjs` | Reads Base and local component `types.ts` into `src/kit/props.json`; requires `--source-root /path/to/baseweb`. `--output /tmp/props.json` writes a review copy. |
| `build-reference.mjs` (+ `reference-authored.mjs`, `reference-gloss.mjs`) | Builds the standard product reference into `src/prototypes/cedar/reference-data.ts` and `reference-lexicon.ts`. Deterministic and byte-identical. |
| `build-round-map.mjs` | Cuts `src/prototypes/cedar/round-map-geo.ts` from official Catalan administrative geometry. Its 5 MB source cache is gitignored and re-fetched on demand. |
| `build-map-tiles.py` | Draws the pin's ground once into `public/map/` — Positron cartography off OpenStreetMap data, rendered in a headless browser, hard-capped, no key and no meter (§86.7). The runtime never calls a tile server. |

The painted library's own machinery lives in [`../library/paintings/`](../library/paintings/)
([maintenance commands](../library/paintings/README.md)), and its historical
ledger is [`docs/archive/PAINTINGS-TRACKER.md`](../docs/omitted-sources.md).


## Base Web dependency and source references

`npm ci` installs the Base Web version recorded in `package-lock.json` into `node_modules/baseui`.
The component gallery and Rocoto's checked-in components build from that dependency. The original
`bw-src/`, `bw-docs/` and `baseui-src/` reference checkouts are absent from this repository.
The fork and props-extraction helpers accept `--source-root /path/to/baseweb`, pointing to a
Base Web checkout containing `package.json`, `LICENSE` and `src/`. They verify its version
against our package lock before writing. Tool paths resolve from the checkout, independent of
your shell directory. Existing forks retain [Uber's MIT notice](src/rocoto/LICENSE.baseweb.txt),
restored byte-for-byte from the [preserved upstream license](../docs/omitted-sources.md).

For a local screenshot after `make dev`, pass its printed URL to
`python3 app/tools/screenshot.py --url <printed-url> --output /tmp/rocoto-kit.png`
from the repository root. The script
captures the page and exits unsuccessfully when it observes HTTP or browser errors. Playwright
and Chromium are installed by the repository's development setup.

The former `devshot.py` and `shot-kit.py` fixed-port session helpers, the completed E182 drive
updater and the loose `public_inter.woff2` duplicate were retired during the file census.
Their [original source tree](../docs/omitted-sources.md)
remains recoverable in Git. The font served by every entrypoint is `public/inter.woff2`.

## Gotchas that already cost a day

- **React is pinned 18.3.1.** React 19 removed function-component `defaultProps`; baseui 16 breaks.
- **baseui 16's `createLightTheme` reads foundation colours from `overrides.colors`** — top-level
  keys (`primaryA`, `primaryFontFamily`) are silently inert. There is no font primitive; Inter is
  stamped onto every typography step after theme creation (see `rocoto-theme.ts`).
- **The dots must be `background-image` + `background-size` separately** — the shorthand-in-image
  form is silently dropped. And pick the dot colour for contrast: `borderOpaque` equals
  `backgroundSecondary` in Base's light theme (both `#F3F3F3`), which paints them invisible.
- **CJS interop namespaces carry `default`** — mapping `Object.entries(import * as X)` into JSX
  renders an object (React #130). Filter it.
- **`react-virtualized` is a real dependency** of the data-table examples — it's in package.json;
  removing it breaks the kit next `npm install`.
- **The phone must be the phone.** `app.html` carries `<meta name="viewport" content="width=device-width">`;
  without it a handset lays the page out at 980px, `usePhone()` reads false, the rail draws instead
  of the bottom navigation, and every touch target is a third of its size.
- **Never let a `&&` chain swallow an error before a commit.** A scripted edit once mangled an
  import and the chain committed it broken. Gate commits on `tsc`.

## Export review references

Acceptance: `../drives/drive-189-output-objects.py` (`ROCOTO_EXPORT_ONLY=1`) walks the export
centre's library, the template editor, the file download and the email plan; 
`../drives/drive-200-library.py` pins the library's own anatomy. `drive-export-workflows.py`
retired at E200.02 with the unmounted `export-library.tsx` it drove (THE-OUTPUTS-SPEC OUT-09.1).
[`../docs/export-integration-research-2026-08/DELIVERY.md`](../docs/omitted-sources.md)
records the older release evidence.

The separate review artifacts can be regenerated with `python3 tools/generate-export-review.py` (openpyxl; `ROCOTO_EXPORT_REVIEW` optionally selects the output folder). It writes the seven fictional XLSX examples plus a validation manifest and render copies. The published PDFs/PNGs were rendered with LibreOffice and visually checked; the app's real-data workbooks are generated independently by `manual-exports.ts`.
