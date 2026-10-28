# Weight Entry — CHANGES

**GROWN**, not forked: Base Web ships an `Input` and a `Stepper`, and this is neither. The
component follows Base's own `src/template-component/` scaffold — the same file layout, the same
`$`-prefixed shared style props, the same `Overrides` contract through `getOverrides`, the same
`data-baseweb` stamp, the same `index.ts` export shape — so a consumer imports it exactly the way
it imports a Base control. Base Web is MIT, Copyright (c) Uber Technologies, Inc.

## What it adds to the system

- **The timer method.** Digits enter from the right and shift the number leftward through its
  units — `5` → `0,005`, `0` → `0,050`, `2` → `0,502`, `0` → `5,020`. No decimal point is ever
  typed and no cursor is ever placed. The shift is animated with FLIP on the digit nodes
  themselves: each typed digit is a DOM node with an identity, so it travels to the column it now
  occupies rather than being redrawn there. Seeing the number move is what makes the method
  learnable, so it is the part of this component with the least room to be wrong.
- **The odometer.** One increment mark above and one below EVERY digit place, on the digit's own
  column — which is why every slot is a fixed box on Base's spacing scale: the grid IS the
  instrument. Held, a mark repeats and accelerates from 240 ms to 60 ms.
- **The scale photo.** The reading arrives attributed, with the photograph kept as a chip that
  previews and bins. Reading a display is the AI's own act, so it is the one place in this
  component that takes the accent. A correction by hand keeps the photo's number struck through
  beside the new one, on the shared **Figure** lockup.
- **Ordered against given**, in ink at both ends. Over and under are directions, not verdicts.

## 2026-08-24 — the ladder died, the digit took its place (FEED-IA §16)

Peter, on the shipped field: «This very bad. Should be above and below the numbers themselves… On
desktop the chevron thing doesn't make sense — people use a keyboard.» What changed:

- **The labelled ladder is gone.** `LADDER` (`columns` · `stack` · `none`), the `Ladder`, `Rung`,
  `RungName` and `RungLabel` elements, and the row of rung names under the number all went with it.
  A detached column of `1 kg · 100 g · 10 g · 1 g` made the person map a label to a digit in their
  head; now the digit place IS the label and the mark sits on the digit's own column.
- **Every column has a mark**, not only the last four. The old build drew four rungs whatever the
  number was, so a five-digit weight had two digits nothing could reach. One list of columns now
  drives all three rows, which makes a mark drifting off its digit impossible rather than unlikely.
- **`marks: auto | on | off`** replaces `ladder`. `auto` is the doctrine: drawn outright for a
  coarse pointer, held at zero opacity on a desk until the field is hovered or focused — the rows
  keep their room, so a control never appears by pushing the number down.
- **The desk is keyboard-first.** Click the number and type; ← → move a rule under the digit place;
  ↑ ↓ step that place; Enter, or the focus leaving the field, fires the new `onCommit`. The marks
  left the tab order (`tabIndex={-1}`) — the arrows already reach every place, and eight extra tab
  stops on one number is a tab key nobody can predict.
- **Grouping.** Kilo digits past three take a separator column, so ten thousand kilos reads as one
  number and not as five digits somebody has to count.
- **An empty field says «To confirm»** rather than standing on a fake zero — the pad zeros stay
  dimmed and the sentence says what is still to happen.

## Notes worth keeping

- **Grams are the whole arithmetic.** Every value inside is an integer of grams; a kilo is a
  thousand of them. Nothing here can round a weight wrong.
- **The unit rides in a column of its own** that is present on all three readout rows and hidden on
  two, so `kg` sits on the number's line whatever the marks do to the stack's height. Centring
  it on the stack — the first version — put the unit a few pixels off the baseline, which is the
  price-unit law failing quietly.
- **The rule marks the COLUMN, not the digit.** It is drawn on the row rather than on the digit
  node, so a digit that shifts leftward travels out from under it and the place stays where the
  hand left it.
- **The layout never changes while a digit is in flight.** Font size is applied at the commit, and
  every slot is the same fixed box, so FLIP only ever has translation to compensate. A digit
  crossing the comma is promoted to kilo size instantly and then glides — deliberately, because a
  size that animates would reflow its neighbours mid-flight.
- **`prefers-reduced-motion`** turns the flight off; the number still lands in the same place.
