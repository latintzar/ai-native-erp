/* Price Accordion — the pricing fractal, made navigable by one component.
 * Grown in src/rocoto/price-accordion/; this page demonstrates it like any other component.
 *
 * The demo data is deliberately blank — Item A, Tier 1 — because which control serves which
 * moment of the trade is the situations catalogue's job to decide, not the kit's.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';
import { PriceAccordion } from '../../rocoto/price-accordion';
import type { PriceModel, View } from '../../rocoto/price-accordion';

const UNIT = '€/unit';

/* ── THE DEMO STRUCTURES, ONE PER LEVEL ───────────────────────────────────────────────────── */

const LEVEL_1: PriceModel = { level: 1, price: 3.4, since: '12 March' };

const LEVEL_1_CHANGED: PriceModel = { level: 1, price: 3.65, was: 3.4, since: 'this morning' };

const LEVEL_1_EMPTY: PriceModel = { level: 1, price: null };

const LEVEL_2: PriceModel = {
  level: 2,
  tiers: [
    { id: 't1', name: 'Tier 1', price: 4.1 },
    { id: 'std', name: 'Standard', price: 4.6 },
    { id: 'vol', name: 'Volume', price: 5.2, was: 5.35 },
  ],
};

const level3 = (over: Partial<Extract<PriceModel, { level: 3 }>> = {}): PriceModel => ({
  level: 3,
  anchor: 4.8,
  anchorName: 'Centre',
  min: 3,
  max: 7.5,
  stops: [
    { id: 't1', name: 'Tier 1', offset: -12.5 },
    { id: 'std', name: 'Standard', offset: -4 },
    { id: 'vol', name: 'Volume', offset: 18 },
  ],
  ...over,
});

const DAYS = ['Today', 'Yesterday', 'Wed', 'Tue', 'Mon'];
const TIERS = [
  { id: 't1', name: 'Tier 1' },
  { id: 'std', name: 'Standard' },
  { id: 'vol', name: 'Volume' },
];
/* one run per tier, today first */
const RUNS: Record<string, number[]> = {
  t1: [4.2, 4.1, 4.15, 3.95, 4.0],
  std: [4.8, 4.7, 4.75, 4.55, 4.6],
  vol: [5.4, 5.2, 5.3, 5.1, 5.05],
};

const level4 = (): PriceModel => {
  const log = DAYS.flatMap((day, index) =>
    TIERS.map((tier) => ({
      id: `${day}:${tier.id}:0`,
      day,
      tierId: tier.id,
      price: RUNS[tier.id][index],
    }))
  );
  /* somebody changed their mind about Standard this morning: the entry is APPENDED, so the price
     it replaced is still in the log and the cell keeps it struck through */
  log.push({ id: 'Today:std:1', day: 'Today', tierId: 'std', price: 4.95 });
  return { level: 4, tiers: TIERS, days: DAYS, log };
};

/* ── A LIVE ROW ───────────────────────────────────────────────────────────────────────────── */

type LiveProps = {
  name: string;
  initial: PriceModel;
  open?: boolean;
  note?: string;
  readOnly?: boolean;
  disabled?: boolean;
  /** hold a level-3 handle lit, so a drag can be read standing still */
  activeStopId?: string;
  /** hold a level-4 cell open, so writing one can be read standing still */
  editingTierId?: string;
  initialView?: View;
};

const Live = ({
  name,
  initial,
  open = false,
  note,
  readOnly,
  disabled,
  activeStopId,
  editingTierId,
  initialView,
}: LiveProps) => {
  const [price, setPrice] = React.useState<PriceModel>(initial);
  const [expanded, setExpanded] = React.useState(open);
  const [view, setView] = React.useState<View>(initialView ?? 'grid');
  return (
    <div style={{ width: '100%' }}>
      <PriceAccordion
        name={name}
        note={note}
        price={price}
        onPriceChange={setPrice}
        expanded={expanded}
        onExpandedChange={setExpanded}
        view={view}
        onViewChange={setView}
        activeStopId={activeStopId}
        editingTierId={editingTierId}
        readOnly={readOnly}
        disabled={disabled}
        unit={UNIT}
      />
    </div>
  );
};

export default function PriceAccordionSection() {
  return (
    <Section
      t="Price Accordion"
      n="An item row that opens onto its price structure — one price, fixed tiers, tiers hanging off an anchor at ± percentages, or a grid of tiers by days with a log behind it. The level is a property of the item, so one row serves all four."
    >
      <Grid>
        <Tile
          span={12}
          name="The four levels, shut"
          rule="Shut, every level is the same row: glyph · name · level line · figure · chevron. The glyph draws the level's own shape and the line says it in words, so nothing has to be decoded. Two items in the same catalogue sit at different levels — the level belongs to the item."
        >
          <Live name="Item A" initial={LEVEL_1} />
          <Live name="Item B" initial={LEVEL_2} />
          <Live name="Item C" initial={level3()} />
          <Live name="Item D" initial={level4()} />
        </Tile>

        <Tile
          span={6}
          name="Level 1 · one price, open"
          rule="Open, it is barely more than shut: the number, larger, and who pays it. Write a new one and the old one stays struck through beside it."
        >
          <Live name="Item A" initial={LEVEL_1} open />
        </Tile>

        <Tile
          span={6}
          name="Level 2 · tiers, open"
          rule="The row expands horizontally into its tiers — Monzo's entity chips, each with its figure beneath its name. Click a chip to write its price."
        >
          <Live name="Item B" initial={LEVEL_2} open />
        </Tile>

        <Tile
          span={12}
          name="Level 3 · anchor and offsets"
          rule="The gradient picker: stops on a price ramp, and the relationship between them is what is being edited. Drag a stop and its offset changes. Drag Centre and the whole set travels with it, every relationship intact — the spread printed in the header holds still while it does. Arrow keys move a following stop in percentage points and the anchor in money; Shift multiplies by ten."
        >
          <Live name="Item C" initial={level3()} open />
        </Tile>

        <Tile
          span={6}
          name="Level 3 · a stop under the hand"
          rule="The drag, held still: the handle grows, its value rides above it, and its row in the list lights up. It still drags — the lit state is lent by a prop, so the same component can be photographed and used."
        >
          <Live name="Item C" initial={level3()} open activeStopId="vol" />
        </Tile>

        <Tile
          span={6}
          name="Level 3 · a pinned stop"
          rule="A pinned stop is hollow and holds an absolute price. Its percentage becomes a reading rather than a rule, and it drifts as the anchor passes underneath — pin them all and the item is behaving as a level 4, which is exactly how items get there."
        >
          <Live
            name="Item C"
            initial={level3({
              stops: [
                { id: 't1', name: 'Tier 1', offset: -12.5 },
                { id: 'std', name: 'Standard', offset: -4, pinned: true, price: 4.6 },
                { id: 'vol', name: 'Volume', offset: 18 },
              ],
            })}
            open
          />
        </Tile>

        <Tile
          span={12}
          name="Level 4 · the daily grid"
          rule="Discretionary: a person decides what each tier is for that item that day. Tiers run across, days run down, today is the first row and the only writable one. Standard was written twice this morning, so the cell carries both numbers."
        >
          <Live name="Item D" initial={level4()} open />
        </Tile>

        <Tile
          span={6}
          name="Level 4 · a cell being written"
          rule="The number is typed in place, with its unit on its own line. Enter writes it, Escape leaves it, and writing APPENDS to the log rather than replacing what was there."
        >
          <Live name="Item D" initial={level4()} open editingTierId="t1" />
        </Tile>

        <Tile
          span={6}
          name="Level 4 · the log as a chart"
          rule="The same log read down the other axis: one trace per tier, told apart by stroke because a colour here would have to mean something. This is the vertical axis of the fractal — chronology — drawn as itself."
        >
          <Live name="Item D" initial={level4()} open initialView="chart" />
        </Tile>

        <Tile
          span={6}
          name="Changed today"
          rule="A price that moved keeps its predecessor struck through beside it, shut and open alike. The pair states the direction — no arrow, no colour."
        >
          <Live name="Item E" initial={LEVEL_1_CHANGED} />
          <Live name="Item E" initial={LEVEL_1_CHANGED} open />
        </Tile>

        <Tile
          span={6}
          name="Waiting for its first price"
          rule="An item with its price still to come holds the figure's place open and says so on the level line. The one act available stands inside."
        >
          <Live name="Item F" initial={LEVEL_1_EMPTY} />
          <Live name="Item F" initial={LEVEL_1_EMPTY} open />
        </Tile>

        <Tile
          span={6}
          name="Read-only"
          rule="The record, open to read: every figure stands, the handles leave the tab order, and the pins hold. Passing no onPriceChange has the same effect."
        >
          <Live
            name="Item G"
            initial={level3({
              stops: [
                { id: 't1', name: 'Tier 1', offset: -12.5 },
                { id: 'std', name: 'Standard', offset: -4, pinned: true, price: 4.6 },
                { id: 'vol', name: 'Volume', offset: 18 },
              ],
            })}
            open
            readOnly
          />
        </Tile>

        <Tile
          span={6}
          name="Inert"
          rule="Disabled: the row still states its price, and nothing responds to a hand."
        >
          <Live name="Item H" initial={LEVEL_2} open disabled />
        </Tile>
      </Grid>
    </Section>
  );
}
