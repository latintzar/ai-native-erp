# captura — «la captura»

Forked from Base Web `src/file-uploader/` (v16.1.1). MIT, Copyright (c) Uber Technologies, Inc.

**Why.** B3 captures a supplier's albarán at the loading bay. Base's uploader has one door — a
drop zone with a browse button — because a web form has one. The trade has three, and which one a
document comes through is a fact about the trade rather than about the software:

| Door | Where | Dimension |
|---|---|---|
| `camera` | the phone at the bay, while the lorry is still open | `D7.doc-paper` (B3) |
| `drop` | the desk, where a person chooses a file | `D7.doc-digital` (B2) |
| `arrived` | it was already here — **nobody chose this file** | `D7.doc-digital`, the ordinary case |

The third is the one no uploader models, and it is the commonest: the albarán came in by email
with the goods' paperwork, and the first act available on it is reading it, never picking it. A
drop zone standing over a file nobody chose invites a person to choose it again — which is exactly
the invented busywork the catalogue exists to remove.

## Inherited untouched

The overrides contract · `getOverrides` · the shared-props shape · theme-driven styling · focus
ring and keyboard handling · disabled and loading states · animation tokens · the whole drop
door (`FileUploaderBasic`, called exactly as Base calls it) · the file rows, their progress bars,
their delete control and their `aria-live` announcements · `processFileOnDrop` and every size,
type and count check around it.

## Rocoto's edits

- **`constants.ts` — `DOOR`.** The three doors, with the trade's reason for each written down.
- **`types.ts` — `CapturaProps`.** `FileUploaderProps` plus `door` · `doors` · `onDoorChange` ·
  `onCapture` · `viewfinder` · `framed` · `arrived` · `labels`, and the `Door` / `Arrived` types.
  Every one of Base's own props still works exactly as Base documents it.
- **`types.ts` — `CapturaOverrides`.** `Doors` · `Door` · `Viewfinder` · `Guide` · `Shutter` ·
  `Arrived` · `ArrivedLine`, merged into the existing overrides object, so a surface restyles a
  door the same way it restyles a file row.
- **`styled-components.ts` — six new elements**, each built the way Base builds the ones above
  them: `styled` on a shared style-props object, every value read off `$theme`. The viewfinder is
  drawn at a sheet's own proportion (210 / 297), so a person aims by filling the frame.
- **`captura.tsx` — the door switch.** The chooser is drawn only where there is a choice: a
  surface offering one door draws no strip, the same way a rail with one destination draws no
  menu (brief §6). The `drop` branch is Base's `FileUploaderBasic` call, moved inside its door and
  otherwise untouched.
- **`captura.tsx` — the camera door.** A viewfinder with a corner guide, and a shutter whose words
  change once the edges are found, because the act has changed: taking, then keeping.
- **`captura.tsx` — the arrived door.** No control at all — who sent it, what it called itself,
  and when it landed.
- **`captura.tsx` — the door is controlled or uncontrolled**, Base's own convention for a
  component with one piece of state.
- **`captura.tsx` — `toSpliced` → `filter`.** `Array.prototype.toSpliced` is ES2023 and this build
  targets ES2020. Identical behaviour.
- **`captura.tsx` — `defaultProps` removed.** React 18.3 deprecates `defaultProps` on function
  components and warns on every render; the two defaults are taken in the destructure instead, so
  the fork runs with a clean console.
- **`captura.tsx` — `react-uid` → a local id.** `react-uid` is baseui's own nested dependency and
  is not resolvable from this tree. A row id only has to be stable for the life of the row.
- **`captura.tsx` — Base's dev guards read through one cast**, because the props they warn about
  are already removed from the public type and indexing the typed object is an error under
  `strict`. The guard is worth keeping: the type only protects callers who are compiled.
- **`file-uploader.tsx` → `captura.tsx`**, and `FileUploader` → `Captura`. The component is named
  for what it does in this product.
- **Imports rewritten** from Base's own relative paths (`../button`, `../styles`) to the published
  package paths (`baseui/button`, `baseui`), because the fork lives outside Base's source tree.
