# reparto

Forked from Base Web `src/slider/` (v16.1.1). MIT, Copyright (c) Uber Technologies, Inc.

**Why.** E2 divides one order line across two or more lotes. Base's Slider hard-limits itself to
two thumbs (`limitValue` throws on a third) and its model is a RANGE — «where do the handles
sit». El reparto's model is a DIVISION — «how much is in each part» — so the public value is an
array of quantities that sums to a total, and the handles are derived from it. `U04`'s law («it is
not possible to create or lose units by dragging») is then true by construction rather than by
validation.

## Inherited untouched

The overrides contract · `getOverrides` · the shared-props shape · theme-driven styling · Base's
focus-visible ring and `forkFocus` / `forkBlur` · disabled state · the cursor rules · `react-range`
as the drag engine · `getTrackBackground` as the track paint · **the float-the-value-on-drag
lockup** (`ThumbValue` + `InnerThumb`), which is the reason this control was forked from the
Slider rather than grown from the template.

## Rocoto's edits

- `types.ts` — `value` is an array of QUANTITIES, one per part, plus a required `total`.
  `Params.value` returns quantities, never boundaries. Added `minPart`, `labels`, `captions`;
  dropped the stateful container and `StatefulSlider` (a division is always driven by the surface
  that owns the line).
- `reparto.tsx` — `limitValue` (throws above two thumbs) replaced by `settle`, which normalises a
  division to at least two non-negative parts whose last one absorbs the rounding.
- `reparto.tsx` — parts ⇄ boundaries conversion on the way in and out (`boundaries` / `parts`).
  This is the invariant, and it is eight lines.
- `reparto.tsx` — `clamp` adds a floor per part, so a drag cannot empty a part to zero.
- `reparto.tsx` — two hover flags (Base has exactly two thumbs) replaced by a hovered index.
- `reparto.tsx` — the focused-thumb index read from the child list rather than from
  `parentNode.firstChild === target`, which can only tell thumb 0 from thumb 1.
- `reparto.tsx` — `ThumbValue` floats the PAIR the boundary is between, not one number: one grows
  exactly as much as the other shrinks, and reading them together is how a person sees that
  nothing was created or lost.
- `reparto.tsx` — Base's two ticks (min · max) replaced by a legend naming each part, plus the
  total on its own line under the bar.
- `styled-components.ts` — `InnerTrack` paints N bands off a colour list built from the boundary
  count, instead of Base's fixed two-or-three. Base's own `getTrackBackground` already takes N
  values and N+1 colours, so the arithmetic stays Base's and only the input grew.
- `styled-components.ts` — `Thumb` is a standing rule with a grip rather than a circular knob: a
  circle sits ON a track, a rule DIVIDES it, and the shape has to say which is happening.
- `styled-components.ts` — the track has area (14px) rather than a 2px hairline, and no side
  padding: the bar IS the total, and a bar that stops short of its container reads as a bar that
  lost some of the quantity.
- `styled-components.ts` — added `Legend` / `LegendItem` / `LegendMark`, each on the overrides
  contract like every other element in the family.
- `constants.ts` — added `GEOMETRY` (track · boundary · grip) and `WEAVE`, the two ends of Base's
  own border ramp that the parts alternate between. No second hue enters the system: this product
  has no traffic light, and a split is not a status.
