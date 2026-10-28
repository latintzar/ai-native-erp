> Historical source audit. Current licence and redistribution inventory: [NOTICE](../../NOTICE.md). Counts, paths and open points below describe the earlier source at its recorded date.

# Licences and attribution

Everything in this directory that somebody else wrote, what it is licensed under, and where its
attribution is honoured. Read against the tree on 2026-08-26; every row cites the file it was read
from, so a claim here can be checked rather than trusted.

**Rocoto's own code is PROPRIETARY — all rights reserved (Peter, 2026-08-28, FEED-IA §75.2).**
«Public github» was the QUALITY BAR, never a publication plan; `package.json` says `UNLICENSED`
and `private: true`. Nothing on this page decides
it — see [The licence this repository does not yet state](#the-licence-this-repository-does-not-yet-state).

---

## What is carried here

| What | Licence | Where it lives | Attribution honoured in |
|---|---|---|---|
| **Base Web** — Uber's design system, source | MIT, Copyright (c) Uber Technologies, Inc. | `baseweb/bw-src/` (+ `bw-src.tgz`) | `baseweb/bw-src/LICENSE`, and a header in each source file |
| **Base Web** — the compiled package | MIT | `baseweb/baseui-src/` (+ `baseui.tgz`), `node_modules/baseui` | `baseui-src/package.json` (`"license": "MIT"`) |
| **Base Web** — the documentation site | MIT (same repository) | `baseweb/bw-docs/` | file headers only; no LICENSE at that root |
| **The four forked components** | MIT, Uber's, plus Rocoto's edits | `baseweb/src/rocoto/{candado,reparto,captura,la-entrega}/` | each component's `CHANGES.md` + per-file headers |
| **The map tiles** — rendered here from OpenStreetMap data | ODbL (data), open styles (Positron / OpenMapTiles), MIT (OpenFreeMap) | `app/public/map/<z>/**` — 425 PNGs at zooms 8–14 | drawn on screen by `app/src/prototypes/cedar/pin-map.tsx`, built by `app/tools/build-map-tiles.py` |
| **Inter** | SIL Open Font License 1.1 | `baseweb/public/inter.woff2`, `@fontsource/inter` | `node_modules/@fontsource/inter/LICENSE` |
| **Fraunces** | SIL Open Font License 1.1 | `app/public/fonts/fraunces/fraunces-latin-500-700.woff2` | `app/public/fonts/fraunces/OFL.txt` |
| **WhatsApp channel mark** — official green logo used only to identify the source channel | WhatsApp trademark; source file published on Wikimedia Commons | `baseweb/src/assets/whatsapp-logo-green.png` | this ledger; in-product accessible text names WhatsApp |
| **The painted product library** | AI-generated works commissioned by this project | `baseweb/public/paintings/` — 694 webp | `assets/paintings/manifest.json` (prompt + request id per file) |
| **jsQR** — the QR decoder the bundle carries for browsers with no `BarcodeDetector` | Apache-2.0, Copyright (c) Cosmo Wolfe | `baseweb/src/app/vendor/jsqr.js` — jsqr@1.4.0's published `dist/jsQR.js` | `baseweb/src/app/vendor/jsqr-LICENSE.txt`, and the header on the file itself |
| **Runtime dependencies** | MIT / ISC, per package | `baseweb/package.json` | the packages' own metadata |
| **Real supplier documents** | third parties'; **NEVER PUBLISHED — by decision** (§75.3) | `assets/real-catalogs/` — on disk, outside git by an explicit .gitignore entry | closed 2026-08-28 |

---

## jsQR — Apache-2.0, vendored rather than installed

`baseweb/src/app/vendor/jsqr.js` is the QR decoder the app loads where the browser has no
`BarcodeDetector` of its own — iOS Safari, which is every iPhone, and desktop Chrome on Linux
(THE-QR-SPEC QR-05.5). Upstream: **https://github.com/cozmo/jsQR**, Apache-2.0, Copyright (c) Cosmo
Wolfe. The vendored file is the published `dist/jsQR.js` of **jsqr@1.4.0**, byte for byte between
the two lines the header marks, plus the one newline that puts the closing marker on a line of its
own (the published file ends without one), so a `sha256sum` of the marked region answers with the
digest of `dist/jsQR.js` + `\n` rather than the file's own — sha256
`bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859`,
npm shasum `8efb8d0a7cc6863cb6d95116b9069123ce9eb2d1` — with four lines added above it and three
below, which hand the UMD wrapper a real `module` so the bundler can carry it as an ES module and
split it into its own lazily-fetched chunk. The Apache-2.0 text as published is at
`baseweb/src/app/vendor/jsqr-LICENSE.txt`.

**Why it is vendored and not a dependency.** `node_modules` on the build box is one tree shared by
every concurrent build of the kit, and an install mid-round rewrites that tree under the other
builds (THE-QR-SPEC QR-09 says so in as many words). A file in the repo is a dependency nobody
else's install can move, and it is what lets the drive prove the decoder offline.

---

## Base Web — MIT, vendored three times

The design system is Uber's Base Web, adopted whole rather than imitated (`baseweb/README.md`,
«What the design system is»). It arrives here four ways, and they are not the same artifact:

| Copy | What it is | Version | Licence evidence |
|---|---|---|---|
| `node_modules/baseui` | the runtime dependency the app imports | **16.1.1** (`package.json` asks `^16.1.1`) | the package's own MIT |
| `baseweb/bw-src/src/` | Base's full TypeScript **source**, the fork source | recorded as **16.1.1** by the forks' `CHANGES.md` | `bw-src/LICENSE` — MIT, Copyright (c) Uber Technologies, Inc.; 1,717 files also carry the header |
| `baseweb/baseui-src/` | Base's **compiled** package — 922 `.js` + 914 `.d.ts` | **18.2.0**, per `baseui-src/package.json` | `baseui-src/package.json` declares `"license": "MIT"`; 752 of 1,837 files carry the header |
| `baseweb/bw-docs/` | Base's documentation site — usage pages and 491 examples, the content source | unrecorded | 221 files carry the Uber header; **no LICENSE file at `bw-docs/`** |

Upstream: **https://github.com/uber/baseweb** — MIT. The full licence text as vendored is at
`baseweb/bw-src/LICENSE`.

Three facts a public reader is owed:

- **`baseui-src/` is a different version from the one the app runs.** The build depends on 16.1.1;
  that tree is 18.2.0. It is not documented in `baseweb/README.md`, which describes only `bw-src/`
  and `bw-docs/`.
- **`bw-docs/` carries no LICENSE at its own root.** It comes from the same MIT repository and its
  files carry Uber's header, but a reader who opens only that directory finds no licence. Dropping
  a copy of `bw-src/LICENSE` into it would close that.
- **Which upstream commit each tree was cut from is unrecorded.** That is ledger **H3** and it is
  open work; it is a reproducibility gap rather than a licence gap, because MIT is satisfied by the
  notice, which is present.

## The four forked components

`node tools/fork.mjs` duplicates a Base component's real source into `src/rocoto/<name>/`, keeps
Uber's MIT notice, and opens a `CHANGES.md` where every Rocoto edit is logged and marked `ROCOTO:`
at the site (`baseweb/README.md`, «The method»). Four components exist on those terms:

| Rocoto component | Forked from | Why | Notice |
|---|---|---|---|
| **candado** | `bw-src/src/slider/` | a set of price tiers moving under one lock | `src/rocoto/candado/CHANGES.md` |
| **reparto** | `bw-src/src/slider/` | one order line divided across lotes | `src/rocoto/reparto/CHANGES.md` |
| **captura** | `bw-src/src/file-uploader/` | the loading bay's three doors | `src/rocoto/captura/CHANGES.md` |
| **la entrega** | `bw-src/src/sliding-button/` | one hand, in a vehicle, in rain | `src/rocoto/la-entrega/CHANGES.md` |

Each `CHANGES.md` opens with the same line — «Forked from Base Web `src/<component>/` (v16.1.1).
MIT, Copyright (c) Uber Technologies, Inc.» — and then separates what was inherited untouched from
what Rocoto changed.

**Notice retention, counted:** reparto 6/6 files, captura 8/8, la-entrega 7/7, candado 7/8. The one
file without the header is `src/rocoto/candado/candado.tsx`, and adding it there is a one-line fix.

The **grown** components (Figure, Composer, Voice Button, Waveform, Paper and the rest) are not
forks of a Base control, but they are built on Base's own `template-component` scaffold and several
say so in their own `CHANGES.md` — `src/rocoto/weight-entry/CHANGES.md` and
`src/rocoto/price-accordion/CHANGES.md` both carry «Base Web is MIT, Copyright (c) Uber
Technologies, Inc.»

## The map tiles — rendered here, from open parts, and where the credit is drawn

«The location has to be a PIN. Real map. Not some custom made map» (FEED-IA §25), and «the map, can
we not use mapbox or some shit? and ensure we have the quota, don't want a bill because of some
accidental operation» (§86.7). So the ground under the pin is **425 PNGs across zooms 8 to 14**,
checked into `app/public/map/<z>/<x>/<y>.png` — there is no tile server on this render path and no
map engine; `app/src/prototypes/cedar/pin-map.tsx` draws a grid of `<img>`, and the runtime
therefore cannot cost anything.

**Seven zooms, because a picture answers two questions.** Zoom 14 is one customer's street, which
is what a thumbnail and a Delivery Note ask for. A preparation map has to hold every delivery in
the book at once — about 35 km across, roughly 3,700 px at zoom 14 — so `print-measures.ts` fits
the marker bounds and takes the sharpest checked-in zoom that holds them: 13 for one run, 9 for a
whole upcoming book on a phone, with 8 as headroom under it. `app/tools/build-map-tiles.py` draws
every zoom under one ceiling (440 tiles) and prints what each run spent. The z14 strip was widened
to five tiles by three on 2026-09-11, which is what took the ground from 380 pictures to 425 and
closed the 34 sharp tiles a fit could ask for and nobody had drawn.

**The count in this document is a command, so it can be checked rather than believed:**

```
find app/public/map -name '*.png' | wc -l     # 425
grep -n '^MAX_TILES' app/tools/build-map-tiles.py     # MAX_TILES = 440
```

The tool's own last line says the same pair after every run: «tiles: 425 wanted · N drawn at
512×512px · 425 on disk».

**Why they are rendered rather than downloaded.** Every hosted tile service forbids the one thing
that guarantee requires — keeping the tiles. Checked before the tool was written:

- **OpenStreetMap's Tile Usage Policy**: «You must not: Bulk download ("scrape") tiles or offer
  prefetch features.» The tiles this replaced were fetched against that sentence.
- **CARTO Basemaps T&C §9.c**: no «downloading or extracting map content in bulk», no «proxying or
  caching the content on the server side», device caches capped at thirty days. Their raster
  basemaps now also require an API key and are being retired.
- **Mapbox Product Terms (2026-06) §1.9**: the customer «shall … (ii) not perform bulk or automated
  queries, (iii) not scrape or systematically download Licensed Map Content, … (v) not export,
  download, cache or store Licensed Map Content», and §2.8.1 forbids showing map content «by using
  a screenshot or other static image instead of accessing … directly from the Mapping APIs».

So `baseweb/tools/build-map-tiles.py` draws them once from openly licensed parts, in a headless
browser, and the parts carry their own permissions:

| Part | What it is | Licence |
| --- | --- | --- |
| The data | OpenStreetMap | **ODbL 1.0** — free to use, share and adapt, with attribution |
| The vector tiles | OpenFreeMap's public planet (`tiles.openfreemap.org`) | **MIT**; no key, no registration, no limits, weekly planet downloads published |
| The style | Positron, the open light basemap on the OpenMapTiles schema | open (BSD-3 / MIT lineage), used unmodified |
| The renderer | MapLibre GL JS | **BSD-3-Clause**, fetched at build time only |

## The second ground — Google Maps, where a key is configured

«can the maps all be google maps?» (Peter, 2026-09-11). A build that carries
`VITE_GOOGLE_MAPS_KEY` draws Google's ground on the pictures a person opened to look at: the
fitted preparation map, the nested delivery map, and a full-size captioned place map such as the
Delivery Note's. The Maps JavaScript API draws all of them, washed to grayscale so the pin stays
the only weight on the picture. `app/src/prototypes/cedar/google-ground.ts` owns the singleton
loader and its timeout.

**The Maps Static API is used nowhere, and that is the quota answer (§86.7).** It was, for one
build, and the meter said what it cost: Prep mounts one thumbnail per upcoming delivery, so a
single screen open asked Google for **129 still pictures** before anybody scrolled — measured at
390 with a configured key, and it scaled with the book. Every thumbnail and every captionless small
map draws the checked-in files now, and this repository has no still-picture road left to take.

**What a session costs, in the numbers rather than in a slogan.** ONE MAPS JAVASCRIPT LOAD PER
PICTURE A PERSON OPENS; AT MOST THREE PICTURES STAND OPEN AT ONCE — Prep's fitted map, a row's map
screen, and a Delivery Note's own map. The `<script>` is fetched once per page, so counting script
requests can never see this: the metered unit is `new api.Map`, and each open picture builds its
own. So a person walking N delivery rows opens N map screens and spends N loads, one at a time,
three standing at the most, and the whole upcoming book on one screen still spends ONE because a
thumbnail draws the files. `drives/drive-cedar-print-workflow.py` counts those constructions against
a stubbed Maps API and asserts both numbers: three with Prep, a map screen and a note open, two once
the note is closed.

**The account's daily cap is what bounds a session, and it is the fence that has to be set.** The
page bounds what one screen costs; a person can still open a hundred pictures in an afternoon, so
the quota cap is the number that decides the bill. It is set on the account, beside the referrer and
API restrictions, before the key is issued.

**The quota posture, stated.** A Maps browser key travels in the page, so it is fenced on the
account rather than hidden: an HTTP-referrer restriction to the published host, an API restriction
to **Maps JavaScript alone**, and a daily quota cap. The page adds the fourth fence and the rule
above adds the fifth: the API loads once, on demand, with a timeout, only the pictures a person
opened may reach for it, and **every failure — a missing key, a timeout, an over-quota
`gm_authFailure` — falls back to the checked-in tiles**. Drives, CI and an offline review run with
no key at all, so the free ground stays the truth for every proof and every screenshot.

**The loader waits for the library.** Under `loading=async` Google publishes `google.maps` as a
loader and attaches the `Map` and `OverlayView` constructors when `importLibrary('maps')` resolves,
so `loadGoogleMaps` resolves only after that promise has returned and both constructors are
functions — and it asks for the library only once Google's own ready `callback` (named in the script
URL) has fired, because the bootstrap's `onload` arrives before `importLibrary` exists. A caller that read them at `script.onload` would have fallen back to the files on a real
key that attached them one tick later — silently, because that fallback is the same picture.

**A repository variable proves nothing; a photograph does.** The drive answers the loader with the
exact slice this app declares, which proves OUR contract on that seam and nothing about Google's.
The live proof is one published page showing `data-ground="google"` on its own figure, taken with a
real key at publication. Until that picture exists, the Google ground is a claim about the stub.

**Each ground carries its own credit, and only its own.** Google renders Google's attribution
inside Google's map, in Google's words; `MAP_CREDIT` is drawn in the figure's caption where the
checked-in files are the ground. A caption that printed a credit for a map it was not standing on
is the failure this rule closes. The marks on Google's ground are the app's own DOM controls, drawn
into an `OverlayView` pane, so the identity, the press and the keyboard posture are the same on
both grounds.

**The credit is rendered, on the map itself.** `app/src/prototypes/cedar/pin-map.tsx` exports `MAP_CREDIT` and puts
**«© OpenStreetMap · OpenMapTiles»** in the figure's caption — the element carries
`data-testid="map-credit"`, so it is assertable, and `drive-customers` asserts both names are on
the picture. The figure also carries `data-ground`, so a proof can state which of the two grounds
it photographed. OpenFreeMap's own required wording is «OpenFreeMap © OpenMapTiles Data from
OpenStreetMap», of which they state «You do not need to display the OpenFreeMap part, but it is
nice if you do» — the host is credited here and in the tool's header instead of on a 168px figure.

Two honest notes still open:

- The on-screen credit reads **«© OpenStreetMap»**, not **«© OpenStreetMap contributors»**, which is
  what OSM's attribution guidance asks for and what the source-file headers already say. A one-word
  change, not yet made.
- The **thumbnail hover labels** in `business.tsx` and `truck-chip.tsx` still carry the literal
  «© OpenStreetMap» rather than importing `MAP_CREDIT`; they are other packages' files. The
  authoritative credit is the caption on the full map each of those squares opens. The four hover
  labels that DO read `MAP_CREDIT` stay true under a configured key, because the squares they ride
  are captionless thumbnails and those are always the checked-in files. **The truck chip is closed**
  (2026-09-11): its hover label credited the map it OPENS, and that picture is captioned, so a build
  with a key would have shown Google's attribution on it while the chip still named OpenStreetMap.
  The label says the round now — `roundWords(shown)` and nothing else — and the picture's own caption
  carries whichever ground it is standing on. **`customers.tsx`
  is done** (2026-08-28, W10): its 72px square's hover label reads `MAP_CREDIT` itself, and
  `drive-customers` asserts the square and the picture behind it credit the map in the SAME words.
  **`detail.tsx` is done too** (2026-08-28, AUDIT-2 W5): the albarán's own 72px square imports
  `MAP_CREDIT` and its hover label now reads «… · © OpenStreetMap · OpenMapTiles», the same words
  the picture it opens renders; `drive-35`'s `sheet_w5` step asserts it, and putting the literal
  back turns that assertion red.

## The painted product library — AI-generated, commissioned by this project

The product faces are **paintings generated with Ideogram**, commissioned for this build. They are
machine-generated works, not photographs, not stock, and not any person's drawings:

- **694 files** ship at `baseweb/public/paintings/` (all `.webp`); `assets/paintings/manifest.json`
  holds **795 entries** — 694 `done`, 95 `pending`, plus 4 probes, 1 alias and 1 orphan.
- Every entry records the exact **prompt**, the Ideogram **`request_id`** and **`response_id`**, and
  the raw file it came from. The provenance of each image is therefore recorded per image rather
  than asserted in prose.
- Raw output never ships. A normalization pass trims the subject, white-points the ground and
  re-centres it (`assets/paintings/normalize.py`, and `notes/THE-DENSE-BRIEF-DESIGN.md` §219).
- The human ledger is [`archive/PAINTINGS-TRACKER.md`](../omitted-sources.md); the machine truth
  is the manifest.

**One thing to state plainly, because a public reader will read the prompts:** every prompt names a
style by reference to named artists — «a style blending Studio Ghibli background art with Claude
Monet's impressionism» (`assets/paintings/manifest.json`, every entry). That is the recorded
stylistic direction. What it implies for redistribution of the resulting images is a question for
Peter and for counsel; this page records the fact and decides nothing.

## WhatsApp channel mark

`baseweb/src/assets/whatsapp-logo-green.png` is a local copy of the official green WhatsApp logo supplied for channel identification. Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:WhatsApp_Logo_green.svg). WhatsApp and its logo are trademarks of their respective owner. Rocoto does not claim ownership, affiliation, or endorsement, and the mark is not used as an application action or product brand.

## Inter — SIL Open Font License 1.1

Rocoto's operational face is **Inter**, shipped as `baseweb/public/inter.woff2` and installed as
`@fontsource/inter@5.3.0`, whose `package.json` declares `"license": "OFL-1.1"` and whose `LICENSE`
carries «Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) … licensed under
the SIL Open Font License, Version 1.1».

The OFL permits bundling and web-serving. It forbids selling the font by itself and requires the
licence to travel with the font. **The copy served from `public/inter.woff2` travels without the
licence text beside it** — a `public/inter-OFL.txt` next to it would close that, and it has not been
added.

## Fraunces — SIL Open Font License 1.1

Rocoto's semantic heading and wordmark face is **Fraunces**, bundled as the Latin 500–700 weight
range at `app/public/fonts/fraunces/fraunces-latin-500-700.woff2`. Its complete SIL Open Font
License 1.1 travels beside it at `app/public/fonts/fraunces/OFL.txt`.

## The other runtime dependencies

Read from `baseweb/package.json` and the installed packages:

| Package | Version asked | Licence |
|---|---|---|
| `baseui` | ^16.1.1 | MIT |
| `react` · `react-dom` | ^18.3.1 (**the pin is load-bearing**) | MIT |
| `styletron-react` · `styletron-engine-monolithic` | ^6.1.1 · ^1.0.0 | MIT |
| `@visx/*` (axis, curve, grid, group, scale, shape) | ^4.0.0 | MIT |
| `lucide-react` | 1.34.0 | ISC |
| `react-virtualized` · `react-window` · `react-vis` | ^9.22.6 · ^1.8.11 · ^1.11.6 | MIT |
| `email-validator` | ^2.0.4 | MIT |
| `@fontsource/inter` | ^5.3.0 | OFL-1.1 |
| `vite` · `typescript` · `@vitejs/plugin-react` | dev only | MIT / Apache-2.0 |

A generated, machine-checked version of this table does not exist. Producing one
(`npx license-checker` or equivalent, committed) is open work, and it belongs with ledger **H2** —
the repository has no CI and no real npm scripts today.

## Real supplier documents — outside the repository, and Peter's call

`assets/real-catalogs/` holds **147 CSV files** (1.8 MB) taken from real suppliers' own documents —
the material for the never-surprised exam described in
[`archive/THE-STANDARD-CATALOG.md`](../omitted-sources.md).

**They are on disk and they are not in git.** The monorepo's root `.gitignore` excludes `*.csv`
(line 65, under «Large files»), so `git ls-files` returns zero for that directory and a clone
carries none of it. That is verified, and it is incidental rather than decided — the exclusion is a
size rule, not a publication rule.

Whether any of it may go public is **ledger H9**, and it is **Peter's call**. This page does not
answer it and nothing here should be read as answering it.

## The licence this repository does not yet state

**Rocoto's own code — `src/kit/`, `src/app/`, `src/scenarios/`, `src/rocoto/`'s grown components,
`tools/`, the notes — carries no licence, and choosing one is Peter's decision.**

The one licence string that exists is an artifact rather than a choice:
`baseweb/package.json` declares `"name": "baseweb"`, `"version": "1.0.0"` and `"license": "ISC"` —
the defaults `npm init` writes, alongside a `"test"` script that exits 1. Nobody chose ISC and
nothing should be inferred from it.

Until Peter decides, the honest reading of this tree is: **the vendored third-party parts carry
their own licences, stated above, and Rocoto's own work is unlicensed — all rights reserved by
default.** Two things follow, and both are his to direct:

1. **Pick a licence, or state that it is deliberately unlicensed.** Either answer is publishable;
   silence is the only one that is not.
2. **Fix the package manifest in the same pass**, so the declared licence is the decided one.

## The small fixes this page found

Each is a few lines, and none is decided here:

- `src/rocoto/candado/candado.tsx` — add the Uber MIT header the other seven files carry.
- `bw-docs/` — drop in a copy of `bw-src/LICENSE`.
- `public/inter.woff2` — put the OFL text beside the file it licenses.
- `pin-map.tsx` — the rendered credit says «© OpenStreetMap · OpenMapTiles»; OSM's guidance asks for
  «© OpenStreetMap contributors», which is already the wording in the file headers.
- The remaining three thumbnail hover labels (`detail.tsx`, `business.tsx`, `truck-chip.tsx`) —
  import `MAP_CREDIT` from `pin-map.tsx` instead of repeating the string, so the credit has one
  home. `customers.tsx` took this on 2026-08-28 and is the worked example.
- `baseweb/package.json` — the name, version and licence are scaffold defaults, pending Peter's call.
- `baseui-src/` — undocumented in `baseweb/README.md`, and a version behind neither the dependency
  nor the fork source.
