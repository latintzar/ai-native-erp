# The element inventory

Every element Rocoto needs, across every dimension and every situation, mapped onto Base Web's 91
directories. Written 2026-08-21, after installing Base's full source at `baseweb/bw-src/`.

---

## 0 · Nothing here reduces anything

The worry worth answering first: does adopting Base shrink what we build? It does the opposite, and
the mechanism is worth stating because it governs every row below.

Base ships **~80 real components plus 11 directories of machinery** — 927 source files, 74,600
lines. Every one arrives with its full variant matrix already built: kinds, sizes, shapes, fits,
and every state (rest, hover, active, focus-visible, disabled, loading, error, selected), each with
a declared transition. That is the depth that is hard to reach by hand and trivial to inherit.

So the rule is three tiers, and **only the third tier is ever a blank page**:

| Tier | What it means | Count |
|---|---|---|
| **Use** | Base has it. Take it 1:1, re-themed. Zero code written. | ~62 |
| **Fork** | Base has something close. Duplicate its source, edit the copy, slot it in. | ~14 |
| **Grow** | Base has no equivalent. Fork `template-component` — Base's own scaffold — so the new thing is still built the Base way. | ~7 |

A tier-3 component still inherits the overrides contract, `getOverrides`, the shared-props shape,
theme-driven styling, and focus/keyboard handling. Rocoto never hand-rolls a control again.

---

## 1 · Use as-is (~62)

Re-themed by `rocoto-theme.ts` and otherwise untouched. Grouped by the job they do here.

**Typography roles.** Semantic `Display*` and `Heading*` roles use Fraunces; `Paragraph*`,
`Label*`, controls and Base's raw font steps use Inter so fields and number-heavy operational text
stay direct. `ROCOTO_HEADING_FONT` in `app/src/rocoto-theme.ts` is the single switch that moves
headings and the wordmark back to the shared sans face.

**The desk's structure.** `app-nav-bar` · `header-navigation` · `side-navigation` (ajustes) ·
`layout` · `layout-grid` · `flex-grid` · `block` · `divider` · `breadcrumbs` (catálogo ▸ pescado ▸
merluza) · `heading` · `typography` · `icon` · `link`

**The phone's structure.** `mobile-header` · `bottom-navigation` · `button-dock` (the sticky action
bar under the thumb) · `list`

**Tables.** `data-table` is the desk itself — virtualised, sortable, filterable, resizable, with
row selection and batch actions already built. `table` · `table-semantic` · `table-grid` cover the
smaller ones (the ficha's price history, the report's rows).

**Fields.** `input` · `textarea` · `select` · `combobox` (typing "merl" in the composer) ·
`checkbox` · `radio` · `switch` · `stepper` (quantity ±) · `slider` · `segmented-control`
(hoy / semana / mes) · `form-control` (the label + caption + error wrapper every field needs) ·
`phone-input` (+34, WhatsApp onboarding) · `pin-code` (the customer with no account opening their
link) · `payment-card` (Stripe checkout on /billing)

**Time.** `datepicker` — a full calendar system: `calendar`, `month`, `week`, `day`,
`calendar-header`, range selection, quick-select presets. Delivery dates, the day being viewed, the
report's range. · `timepicker` (the delivery window) · `timezonepicker`

**Overlay.** `modal` (desk) · `sheet` (phone bottom sheet) · `drawer` (the dossier sliding in) ·
`dialog` · `popover` · `tooltip` · `menu` (the row's ⋯) · `layer` (the portal machinery underneath
all of it)

**Feedback.** `spinner` · `skeleton` · `progress-bar` · `progress-steps` (onboarding) · `snackbar` ·
`toast`

**Content.** `card` · `tile` · `accordion` · `tabs` · `tabs-motion` · `tag` · `tag-group` ·
`avatar` · `badge` · `aspect-ratio-box` (every product photo and albarán scan) · `page-control`
(gallery dots) · `tree-view` (catalogue hierarchy) · `pagination`

**Files.** `file-uploader` and `file-uploader-basic` — drag-drop, file-type and size validation,
per-file progress, retry, error surfacing. Catalogue import on /importar, albarán PDFs, photos.

**Movement and place.** `dnd-list` (reorder route stops, reorder the catalogue) · `map-marker`
(the route map, which Rocoto already has as `webapp/src/map/mapkit.ts`) · `sliding-button` (swipe
to confirm)

**Machinery, not components.** `helpers` · `styles` · `themes` · `tokens` · `types` · `utils` ·
`a11y` · `test` · `locale` · `template-component` · `helper`

---

## 2 · Fork and edit (~14)

Base has something close. Duplicate the source, mark every edit `ROCOTO:`, log it in `CHANGES.md`.

> **Corrected 2026-08-21.** An earlier version of this table carried a set of "paper objects" —
> a torn ticket, a rotated stamp, a dog-eared corner, a taped slip. They are cut. Base has no
> texture and no rotation anywhere in it, so ornament laid on top of Base reads as a costume: two
> visual languages in one product. The distinctiveness comes from the constraint (Base's rigor,
> ink-only, saffron reserved for the AI's own act, Rocoto's type and radii), never from ornament.
> Their jobs are done by Base components — a receipt is a `card`, a stamp is a `tag`, "awaits a
> person" is sort order plus a `tag`, an explanation is a `banner`, a day's strip is a `list`.

| Rocoto needs | Forked from | What changes |
|---|---|---|
| **voice-button** ✅ done | `button-timed` | The countdown becomes elapsed recording time; the drain animation becomes the listening pulse; the `TimerContainer` override slot carries the transcript. |
| **la firma** | `avatar` | The AI's mark. An avatar is already "who did this" — Rocoto's is its own face in saffron, the one place saffron appears. |
| **el reparto** (U04) | `slider` | Multi-thumb exists; the edit is the **invariant** — parts always sum to the total, so moving one edge pushes its neighbour. Base's own trick of floating the value above the thumb on drag stays. |
| **el candado** (U05) | `slider` | Two linked sliders holding a ratio; releasing the lock unlinks them. |
| **la captura** | `file-uploader` | Three doors, one component: camera on the phone, drop on the desk, **and the albarán that simply arrived by email** — a state where the file was never chosen by anyone. |
| **el momento** | `modal` + `sheet` | One isolated moment, two frames: modal at the desk, sheet on the phone. The fork is the shared shell so a situation is written once. |
| **la entrega** | `sliding-button` | The driver's swipe-to-confirm at the door. |
| **el compositor** | `textarea` | The chat composer: attachments row, voice hold, send. Base's textarea brings auto-resize and the enhancer slots. |
| **es_ES** | `locale/es_AR.ts` | Spanish exists upstream; Spain's forms differ from Argentina's. A copy-and-edit. |

---

## 3 · Grow from `template-component` (5)

No Base equivalent. Fork Base's own scaffold so they are still assembled the Base way — and each
one is **drawn like a Base component**: flat, precise, tokened, no texture.

- **la cifra** — the figure lockup, and the supersede law made visible: a changed number keeps its
  struck predecessor legible. Unit shares the number's line, always. The single most-used element
  in the product and the one Base genuinely lacks.
- **la onda** — a real waveform, for recording and for scrubbing back.
- **el pad de firma** — the customer's finger on the driver's phone at the door.
- **la voz oída** — the empty slot: a line the recogniser could not hold, shown empty with its
  recording attached, never guessed into.
- **el papel** — the print sheet. `print/PrintDay.tsx` exists. Paper output is genuinely ours,
  and it is the one place where paper is the actual medium rather than a metaphor.

Two candidates were dropped after checking Base's source: **el hilo** (chat bubbles) and **el
visor** (media lightbox). Rocoto already has both, and `layer` + `aspect-ratio-box` +
`page-control` supply the lightbox's machinery — so these are ports, not new components.

---

## 4 · Per-surface walkthrough

What each surface is actually assembled from.

**Pedidos, the desk.** `data-table`, with rows awaiting a person sorted first and marked by an
ink `tag` + `drawer` for the dossier + `menu` per row + `momento` for each isolated decision +
`cifra` in every money cell + `datepicker` for the day + `segmented-control` for the span.

**Chat.** the ported bubbles + `compositor` + `combobox` (product autocomplete) + `voice-button` +
`file-uploader` (attachments) + the ported lightbox on `layer` + `aspect-ratio-box` +
`page-control` + `avatar` + `firma` when Rocoto wrote the message + `banner` when it explains why.

**The lonja, 05:30, phone.** `momento` as a sheet + `voice-button` + `onda` + `cifra` (with
yesterday struck through) + `input` to correct it + `card` per capture + `list` for the morning +
`voz oída` for what it could not hold.

**Albaranes.** `captura` in all three doors + `aspect-ratio-box` (the scan) + `data-table` (the
parsed lines) + `cifra` + an ink `tag` when reconciled + `banner` when the arithmetic disagrees.

**Catálogo.** `tree-view` + `data-table` + `breadcrumbs` + `aspect-ratio-box` + `file-uploader`
(bulk import) + `progress-bar` + `dnd-list` (order) + `combobox` + edit-in-place in the table.

**Clientes.** `tabs` + `data-table` (their prices) + `cifra` + `accordion` (history) + `avatar` +
`phone-input` + `drawer`.

**Rutas.** `map-marker` + `dnd-list` (reorder stops) + `timepicker` (windows) + `list` on the
driver's phone + `entrega` (swipe at the door) + `pad de firma` + `captura` (photo of the drop).

**The customer, no account.** `pin-code` + `list` + `stepper` + `cifra` + `entrega` + `pad de
firma` + `payment-card`. The public frame — cool grey — and Base's `locale` in Spanish.

**Ajustes, plan, gente.** `side-navigation` + `form-control` + every field + `switch` +
`progress-steps` (onboarding) + `payment-card` + `modal`.

**Informe, print.** `papel` + `table-semantic` + `cifra` + `datepicker` (range).

---

## 5 · The count

- **Use 1:1:** ~62 components, zero lines written.
- **Fork:** 9, of which **1 is done** (`voice-button`).
- **Grow from the scaffold:** 5.

Fourteen components to author, against roughly sixty-two inherited whole — and nine of the
fourteen are edits to working code rather than blank files.

The number that matters more is the one going the other way: how many hand-rolled controls in the
current app this retires. That is being counted by the transition audit, not guessed here.

## 6 · Open

- `banner`, `notification`, `system-banner`, `message-card` and `toast` all ship Base's
  positive/warning/negative kinds. `rocoto-theme.ts` already collapses those onto ink, so the
  traffic light cannot reappear through them. Worth re-proving by render, not by reading.
- `rating` has no obvious job here yet. Left out rather than invented a use for.
- `checkbox-v2` / `radio-v2` are Base's newer takes; pick one line and hold it.
