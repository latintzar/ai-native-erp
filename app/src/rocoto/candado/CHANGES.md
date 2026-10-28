# candado

Forked from Base Web `src/slider/` (v16.1.1). MIT, Copyright (c) Uber Technologies, Inc.

**Why.** C4 moves every price tier at once and the spread between the tiers must hold. Base's Slider moves one value; el candado is a SET of Base sliders under one lock — drag any one and every other moves with it, holding the invariant. Releasing the lock unlinks them and one tier moves alone. Base's own track, thumb, thumb-value, focus ring and keyboard handling are kept exactly as Base built them.

## Inherited untouched

The overrides contract · getOverrides · shared-props shape · theme-driven styling · focus
ring and keyboard handling · disabled and loading states · animation tokens.

## Rocoto's edits

- (one line per edit; every one also marked `ROCOTO:` at the site)

1. **The two-thumb ceiling comes off.** Base throws above two thumbs («our design doesn't support
   more than two»); a set of linked values is this fork's whole subject, so the only rule left is
   that a slider has at least one thumb. `slider.tsx`.
2. **Hover state is a set, not two booleans** (`isHovered0` / `isHovered1`), for the same reason.
   `slider.tsx`.
3. **The focused thumb is found by position among its siblings**, rather than by Base's «first
   child or not», which can only tell two thumbs apart. `slider.tsx`.
4. **`onChange` carries the thumb that moved** — `{ value, index }`. A lock has to know which hand
   pulled before it can move the others, and Base's `{ value }` alone does not say. `slider.tsx`,
   `types.ts`.
5. **The track paints N+1 bands.** Base writes the one- and two-thumb cases out by hand;
   `trackBands()` writes the rule underneath both once, for any number of thumbs.
   `styled-components.ts`.
6. **Base's stateful containers are dropped.** The SET is the stateful shape here, and the surface
   that owns the tiers owns their values. `stateful-slider.tsx` / `stateful-slider-container.ts`
   removed, `index.ts`.
7. **Grown beside the fork: `Candado`** — the lock itself. A row per value, one Base slider each,
   and one invariant across them: `spread` (every value moves by the same amount) or `ratio`
   (every value scales by the same factor). Releasing the lock unlinks them and one row moves
   alone. The invariant is the exported pure function `moveLinked`. A locked drag that would push
   any value off the track is shortened to what the whole set can take, so the set never loses its
   shape at the ends. `candado.tsx`, `candado-styled.ts`.
