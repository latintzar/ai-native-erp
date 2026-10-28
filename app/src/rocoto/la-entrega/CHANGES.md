# la entrega

Forked from Base Web `src/sliding-button/` (v16.1.1). MIT, Copyright (c) Uber Technologies, Inc.

**Why.** A driver marks a stop delivered at the door — one-handed, in a vehicle, sometimes in rain.
Base's Sliding Button carries a centred string and puts the hand on a 56px grabber. The driver's
swipe has to carry the STOP itself, and the whole row has to be the target, because the thing being
read and the thing being pushed are one object.

## Inherited untouched

The overrides contract · `getOverrides` · the shared-props shape · theme-driven styling · the focus
ring and the Enter/Space path · the disabled and loading states · the slide-back timer · the
animation tokens · the RTL handling · the pointer-capture drag and its global listeners.

## Rocoto's edits

- **The row carries the stop.** `label` is a `React.ReactNode` rather than a `string`, and it reads
  from the row's left edge instead of its centre — a stop is a block of facts, and a block of facts
  is read down a left edge. (`types.ts`, `styled-components.ts` → `Label`)
- **The whole track is the target.** `onPointerDown` moved from the Grabber to the Track, so the
  drag begins wherever the thumb landed. The grabber keeps only its job of saying which way the row
  travels. (`la-entrega.tsx` → `<Track onPointerDown>`)
- **The after-state is its own words.** `completedLabel` replaces Base's repeat of the label, and
  the swept row keeps its handle clear so the tick sits beside what the row now says.
  (`types.ts`, `la-entrega.tsx`, `styled-components.ts` → `CompletedLabel`)
- **The row can arrive swept.** `isCompleted` is controllable, so a morning's list re-read at the
  fourth stop shows the first three as done rather than animating them again. Left out, the row
  runs Base's own state. (`la-entrega.tsx`)
- **A third threshold, `door` = 0.5.** Base ships 0.2 and 0.8: 0.2 fires on a wet thumb glancing
  off the row, 0.8 asks a gloved hand to cross the whole width of a phone that is also holding a
  crate. Half is the driver's number, and it is the default here. (`constants.ts`,
  `default-props.ts`)
- **A `large` size.** The gloved row: `scale1600` instead of `scale1400`, with a 72px handle. Both
  heights stay theme sizing steps, so a re-brand carries them. (`constants.ts`,
  `styled-components.ts` → `rowHeight`)
- **The aria label is the surface's own.** Base falls back to `label`; here the label is a node, so
  the row asks for words rather than stringifying a subtree. (`la-entrega.tsx`)

## Where it is used

`canonical/drop-list.tsx` — I3 (mark stops as delivered) and I4 (capture a signature).
