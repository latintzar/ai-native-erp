# price-accordion

**GROWN** on Base Web's own component anatomy (v16.1.1). MIT, Copyright (c) Uber Technologies, Inc.

**Why.** «Everything is technically in pricing… everything is a tier. Tariffs are a tier.» The
complexity of pricing in this trade is a finite fractal with two axes — horizontal is tiers,
vertical is chronology — and it has exactly four levels. Base ships nothing that edits a price
*structure*: it has a Slider that moves one value and an Accordion that opens a panel, and the
subject here is a row that knows which of four shapes its price has and opens onto that one.

**The level is a property of the ITEM.** Two items in the same catalogue sit at different levels
(the blend law, THE-ALBARÁN-THESIS §0), so this is one component with four bodies, never four
components and never a per-account mode.

| Level | What it is | What opens |
|---|---|---|
| 1 | one price, fixed | the number, larger, and who pays it |
| 2 | tiers, fixed | a row of tier chips, scrolling horizontally |
| 3 | tiers that change daily holding a fixed relationship | the ramp: an anchor and its offsets |
| 4 | tiers that change daily, all discretionary | a grid of tiers by days, and its log as a chart |

## Inherited from Base, untouched

The `overrides` contract and `getOverrides` · `$`-prefixed shared style props · the `data-baseweb`
stamp · the accordion's Header / ToggleIcon / Content / ContentAnimationContainer anatomy and its
motion tokens · the slider's geometry (2px track, 24px handle, the 3px focus ring, the value bubble
above the thumb) · `Input` for every number being typed · `ButtonGroup` in radio mode for the
grid/chart switch · every colour, radius, type step and duration from the theme.

## What is Rocoto's

1. **The four-level union** (`types.ts`). One `PriceModel`, discriminated by `level`, so the row
   cannot be in an ambiguous state and the compiler knows which body is legal.
2. **The level glyph.** Each level drawn as its own shape — one mark · a row of marks · a row of
   marks on a ramp · a field of marks with time running down it. It never carries the meaning
   alone: the level line beside it says the same thing in words.
3. **The ramp** (`ramp.tsx`) — the founder's Photoshop gradient picker. Stops on a price ramp, and
   the RELATIONSHIP between them is what is edited. Dragging a stop changes its offset; dragging
   the anchor slides the whole set with every relationship intact; the spread printed in the card
   header holds still while it does, which is the claim of level 3 made checkable in public.
4. **The clamp is part of the invariant** (`moveAnchor`, and el candado's rule for the same
   reason): a move that would push a following stop off the ramp is shortened to what the set can
   take, so the constellation never flattens against an end.
5. **Pinning** (`setStopPinned`). A pinned stop locks to an absolute price and stops following the
   anchor. Its percentage becomes a reading rather than a rule and drifts as the anchor passes
   underneath — pin every stop and the item is behaving as a level 4 while still stored as a level
   3, which is exactly how items drift up the fractal. The surface says so when it happens.
6. **The append-only log** (`writeCell`). Writing a level-4 cell adds an entry rather than
   replacing one, so the number it superseded is still in the data and the Figure keeps it struck
   through beside the new one. The supersede law held in the model, not just in the drawing.
7. **The growth box.** Base's accordion measures its panel and animates a pixel height; one grid
   row interpolating `0fr → 1fr` says the same thing with no measurement to go stale, and keeps
   the content in the document, which is what `aria-controls` needs.
8. **The arithmetic is pure and exported** (`utils.ts`) — `stopPrice`, `stopOffset`, `moveStop`,
   `moveAnchor`, `setStopPinned`, `spreadOf`, `cellValue`, `writeCell`, `headline`. A rule a price
   structure keeps should be readable and testable without a browser.

## The keyboard

A following stop moves in **percentage points** (`OFFSET_STEP`, ×10 with Shift), because its
offset is the thing that exists. The anchor and a pinned stop move in **money**, because a price is
what they hold. `Home`/`End` take a handle to the ramp's ends. Every handle is a `role="slider"`
with `aria-valuetext` that reads the tier, its percentage and its price; `readOnly` takes the
handles out of the tab order and stands the pins down to static marks.

## What is deliberately absent

No colour carries meaning. A pinned stop is **hollow**, a superseded number is **struck**, a
following stop is **filled** — line and weight do the work, and there is no traffic light. The
accent is untouched: nothing here is the AI's own act.
