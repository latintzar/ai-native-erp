# Accessibility — source audit, 2026-08-26

**Scope clarified 2026-09-08:** this is the August source inspection, including its then-current
language, focus and touch-target findings. Preserve those observations as dated evidence; compare
them with the current source and tests before treating a listed gap as open or fixed. Current
shared interaction requirements are in [THE-INTERACTION-SPEC](../docs/THE-INTERACTION-SPEC.md).

An engineering register, read off the code on 2026-08-26. Every claim cites the file it came from,
and where nobody has checked something it says so.

**This is not a conformance claim.** No screen-reader pass has been run against this build, no
contrast audit covers the whole palette, and none of the four verify gates
(`baseweb/README.md`, «Verify») is an accessibility check. What follows is the register: the
behaviour the design laws produce, the keyboard coverage that exists, and the gaps, named as gaps.

---

## 1 · What the design laws produce

### The editable grammar is at rest, not on hover (FEED-IA §51.14)

The one decision on this page that carries the most access weight, and it was made on access
grounds. Every value a hand can write over wears **a hairline underline at rest, always** — the
pointer only paints the ground and closes the ring, and opening draws the box. `src/app/detail.tsx`
records why:

> WHY IT STANDS AT REST AND NOT ON HOVER. A mark that appears under a pointer is a mark a person
> has to hunt for, and on a phone it can never appear at all — so «which of these numbers can I
> change» was answerable only by a mouse. It costs one hairline to answer it for everybody.

**The affordance is a real button.** `Editable` renders `<button type="button">` carrying
`aria-label`, `aria-expanded`, and a `:focus-visible` rule — a 2px `borderSelected` outline at 1px
offset. So an editable value is in the tab order, announces its name and its open state, activates
on Enter and Space, and draws its own focus ring.

**Hover may never move geometry** (§37.3, stated in the same file): the ring is a 1px solid
*transparent* border at rest that is only painted under a pointer, and the padding it reclaims with
a negative margin never changes. A hover «may paint, tint and reveal, and it may never mount,
unmount, pad, or resize». Nothing on these surfaces is mounted by a pointer, which means nothing on
them is reachable only by a pointer.

There are **two copies** of this component — `src/app/detail.tsx` and `src/app/rows.tsx`, the second
built to the first's construction «same steps … same focus ring». `rows.tsx` names the collapse as
owed. Two copies of a focus behaviour is two places for it to drift.

### Colour is not a status system

`negative`, `warning` and `positive` collapse onto ink in `src/rocoto-theme.ts`; there is no
red/amber/green anywhere, and saffron marks only Rocoto's own act. State is carried structurally
instead — «closed or open is the state, structurally» (§21).

This is an accessibility property that fell out of a design law: **no status in this app is encoded
by hue alone**, so no status is lost to a colour-vision difference. It holds as long as the law
holds, and `node tools/theme-gate.mjs` fails the build on hard-coded paint outside the theme.

### The dot grid is a decorative ground

The dots mean exactly one thing — «this is the talk» (§11). Measured:

- The mark is `dots(theme.colors.mono400)` at a 14px tile with 1px dots — every call site passes
  `mono400` (`src/app/detail.tsx`, `shell/chats.tsx`, `shell/embeds.tsx`, `stage.tsx`,
  `src/rocoto/signature-pad/`).
- Base's light theme sets `mono400: '#E2E2E2'` (`bw-src/src/themes/light-theme/color-foundation-tokens.ts`).
- Against white paper that is a contrast ratio of about **1.30:1**.

That is far below any text threshold, and it is the right number for what it is: the dots carry no
text and no control. **The information they signal is carried redundantly** — every surface they
paint also renders the conversation itself (bubbles, a composer, names, times), so a reader who
cannot see the dots at all still reads a chat as a chat. Stated as a reading, not as a measurement:
nobody has tested it with a low-vision reader.

One loose end found while measuring: `dotInk()` and `DOT_TINT` are exported from
`src/rocoto-theme.ts` and **have no call site** in `src/`. The accent-tinted ground THE-APP-V2 §6.3
asked for is not currently painted by that helper.

### A price's unit shares the number's line

Stated as a law in `baseweb/README.md` and implemented as an inline `<em>` inside the figure. It is
a comprehension rule rather than an assistive-technology rule, but it has the same effect: the rate
and its unit are one reading unit, and they stay one at 320px.

---

## 2 · The keyboard coverage that exists

Read out of the handlers, not from intent:

| Surface | Keys | File |
|---|---|---|
| **The sweep** — walk the river and print | `←` `→` walk to the previous/next document · `P`/`p` print **and advance** · `Escape` releases the innermost thing (the word, then the day, then whose accounts these are) | `src/app/areas/sales.tsx` |
| **The band walk** | `↑` `↓` cycle the rows · `Enter` picks | `src/app/areas/sales.tsx` |
| **The catalogue** | `↑` `↓` step · `Home` first · `End` last | `src/app/areas/stock.tsx` |
| **Chip entry** — the order line as chips | `Space` seals a chip · `↑` `↓` walk the suggestion shelf · `Tab` completes from the shelf · `Enter` commits · `Escape` closes the shelf · `Backspace` at position 0 rejoins the previous chip · `←` `→` cross between chips at their edges | `src/app/chip-entry.tsx` |
| **The voice button** | `Enter` starts; when the recorder locks, focus is moved to the send control so the keyboard path never lands on a control that has gone | `src/rocoto/voice-button-kit/stateful-container.ts` |
| **Every Base control** | Base's own keyboard handling, unmodified — the four forks each record it as «inherited untouched» in their `CHANGES.md` | `src/rocoto/{candado,reparto,captura,la-entrega}/` |

**The global handler stands down properly.** The sweep's `ours()` guard returns false inside
`INPUT`, `TEXTAREA`, `SELECT`, anything `contentEditable`, anything inside
`[role="combobox"]`, `[role="listbox"]`, `[role="dialog"]` or `[role="alertdialog"]`, and whenever
an overlay is on screen; it also ignores events with `ctrlKey`, `metaKey`, `altKey`, or
`defaultPrevented`. A single-letter shortcut that hijacks typing is the classic failure here, and
this one does not.

**Focus rings survive the resets.** `outline: 'none'` appears at 25 sites in `src/` (excluding
`_parked/`). Every one this register opened replaces it rather than removing it:

- `src/rocoto/price-accordion/styled-components.ts` — a `:focus-visible` outline, 3px `borderAccent`
- `src/rocoto/{candado,reparto,voice-button-kit}/` — Base's own `$isFocusVisible` box-shadow ring,
  driven by `isFocusVisible` / `forkFocus` / `forkBlur` from `baseui/utils/focusVisible`
- `src/rocoto/composer/styled-components.ts` — the ring moves to the wrapper's `:focus-visible`
- `src/app/chip-entry.tsx` — a React-tracked `focused` flag paints an inset 1px `borderSelected` ring
  on the chip shell (it shows for pointer focus too, which is the safer direction)

Sites not opened one by one: `src/rocoto/{gallery,charts,message}`, `src/kit/sections/*`,
`src/scenarios/screens/A2.tsx`. Unverified rather than broken.

---

## 3 · Motion

`prefers-reduced-motion` is honoured in four places, and one of them is honoured properly rather
than nominally:

- **The Administration stage** (`src/app/stage.tsx`, THE-ADMIN-CANON §6). `useStillness()` asks
  `matchMedia('(prefers-reduced-motion: reduce)')`, **subscribes to its `change` event** so a person
  who turns motion off mid-session is believed without a reload, and lands the resolved state:
  «no walk, no loop, no repaint — and the same information, which is the test a reduced-motion path
  has to pass to be a real one.» The information is not withheld from the person who asked for
  stillness; only the animation is.
- `src/rocoto/gallery/styled-components.ts` — transitions live behind a
  `@media (prefers-reduced-motion: no-preference)` guard, so stillness is the default branch.
- `src/rocoto/transcript/transcript.tsx` — the follow-along scroll drops from `smooth` to `auto`.
- `src/rocoto/message/styled-components.ts` — three `@media (prefers-reduced-motion: reduce)` blocks.

**Unverified:** whether every other animated surface (the settle, the landing ring, the FLIP digits
in Weight Entry, the print-queue countdown) has a stillness path. Nobody has swept for it.

---

## 4 · Semantics, as counted

Landmarks and headings exist and are hand-placed rather than generated:

| Element | Where |
|---|---|
| `<main>` | `src/app/shell/frame.tsx` |
| `<aside>` + `<nav>` | `src/app/shell/rail.tsx` (the desk rail, both postures) |
| `<nav>` | `src/app/shell/bottom-nav.tsx` (the phone's row) |
| `<h1>` | `src/app/App.tsx` — the area's own name |
| `<header>` | every sheet: `detail.tsx`, `product-card.tsx`, `customer-profile.tsx`, `inbox.tsx`, `knows-web.tsx`, `areas/customers.tsx` |

ARIA attributes in `src/app/` (excluding `_parked/`): **119** `aria-label`, 56 `aria-hidden`, 10
`aria-expanded`, 9 `aria-current`, 5 `aria-pressed`, 4 `aria-selected`, 3 `aria-activedescendant`,
2 `aria-controls`. Roles used: `img` ×6, `listbox` ×4, `option` ×3, `tab` ×2, `tablist`, `dialog`
×2, `combobox` ×2, `alertdialog` ×2.

**Images.** The product paintings render as `<img alt="" loading="lazy" decoding="async">`
(`src/app/product-face.tsx`) — an empty alt is correct here, because the product's name is always
rendered beside its face and a repeated name is noise rather than information. The map draws
`role="img"` on its tile grid with the OpenStreetMap credit in the caption (`src/app/pin-map.tsx`),
and the truck chip carries `role="img"` with an `aria-label` that speaks the whole round
(`src/app/truck-chip.tsx`), which is the same reasoning applied to a glyph.

**The phone is the phone.** `app.html` carries
`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, and the
README records what its absence cost: the page lays out at 980px, `usePhone()` reads false, the rail
draws instead of the bottom navigation, and every touch target becomes a third of its size.

---

## 5 · The gaps

Named as gaps. None of these is fixed, and none of them is hidden.

1. **`app.html` declares the wrong language.** It carries `lang="en"` and ships Spanish copy.
   `index.html` carries `lang="es"` and ships Uber's English demo copy — the same error, reversed.
   (`scenarios.html` carries `lang="es"` and ships trade Spanish, which is right.) A screen reader
   pronounces the app's Spanish with an English voice today. Two one-word fixes.
2. **Live regions — CLOSED 2026-08-28 (`de67b2620`).** `src/app` now carries three polite live
   regions, and that list is the design: the day's counted press, the Messages count, and the
   document's state row — each empty at rest, speaking only when its own sentence changes.
   Every other counter deliberately stays silent (one act announces once; the export centre's
   badge restates acts a bar above and would double-speak). The eight regions inside
   `src/rocoto/` components stand as before.
3. **No skip link.** The desk rail is the first thing in the tab order on every area, and there is
   no way past it to `<main>` except by tabbing through it.
4. **The hover tint has no keyboard twin on most row surfaces.** 24 `onMouseEnter` sites live in
   `src/app/`, against 9 `onFocus`. Two pair them — `src/app/anchors.tsx` sets the same state from
   `onFocus`/`onBlur`, and `src/app/areas/stock.tsx` tests `:focus-visible` explicitly. The rest
   (`rows.tsx`, `areas/sales.tsx`, `areas/customers.tsx`, `knows-web.tsx` and others) tint on hover
   only. The elements are real `<button>`s, so they are reachable and operable — what is missing is
   the *visible* «you are here» a mouse user gets free.
   The mechanical cause is worth writing down: those rows are styled with a plain inline
   `style={{…}}` object, and inline styles **cannot express `:focus-visible` at all**. Only three
   files in `src/app/` contain the string `focus-visible` (`detail.tsx`, `rows.tsx`,
   `areas/stock.tsx`). Moving those rows onto Styletron's `css()` is what would make a focus style
   expressible.
5. **The dot grid sits at ~1.30:1.** Correct for a decorative ground; it does mean the «this is a
   conversation» signal is invisible to a low-vision reader, and it is carried redundantly by
   content rather than by design intent.
6. **No accessibility gate.** The four gates are `tsc`, `theme-gate.mjs`, the Playwright drive
   suites, and looking at screenshots. Adding an axe pass to the suites that already boot `dist/`
   would be cheap — they already fail on any console error, so they already have the harness.

## 6 · What nobody has checked

Unknown, and listed so that it is not mistaken for absent:

- **Screen readers.** No pass with NVDA, JAWS or VoiceOver. Every semantic claim above is read off
  the source, not heard.
- **Contrast, beyond the one measurement in §1.** Base's own light theme was designed against
  Base's own bar; Rocoto's ink `#1A1413` and saffron `#C01B2C` have not been swept against every
  ground they land on. `?theme=proof` proves re-theming, not legibility.
- **Touch-target sizes.** The Uber Base extract's 48px target rule is the bar this build measures
  against (`/root/leo/docs/design/base-uber-extract/`); no sweep has confirmed every control meets
  it at 390px.
- **Zoom and reflow at 200%.** The §38 pane model nails the page's own scroll to zero and gives each
  pane its own scrollport; how that behaves under browser zoom is untested.
- **Keyboard reachability, end to end.** Individual handlers are read above; nobody has tabbed
  through a whole area and recorded where focus goes.
