/* B4 · Revise agreed costs.  `D7.contract` · desk · canonical `grid` — ORIGIN.
 *
 * THE GRID NOBODY OPENS OFTEN. Cost under a contract does not arrive; it is agreed, and then it
 * sits. So the subject of this card is not the edit — it is STALENESS ON THE FACE OF THE TABLE:
 * a row nobody has moved for seven months carries its mark on its own name, and the age of every
 * row reads in the last column. A table of rarely-changed numbers that will not tell you which
 * ones are old is a table that quietly sells last winter's price all summer.
 *
 * P4 READS THIS CANONICAL. C1 is this table with prices in the cells (a data delta) and C2 is C1
 * with one column per tier (a column delta). The file cannot tell the three apart, which is the
 * mechanical proof that D9 never produces a second screen.
 *
 * DRAWN WITH MEAT, which is the home: Mercolleida's Thursday table plus a negotiated differential.
 * Fruit runs seasonal contracts; in fish only the farmed and frozen lines qualify — Lubina de
 * estero can sit under contract, Merluza fresca never will — and the sector switch shows exactly
 * that, because every number on the screen is derived from the cast.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Grid, { type GridRow } from '../canonical/grid';
import { GRegion, GCatalogue } from '../ghosts/regions';
import { useSector } from '../shell/context';
import { type Cast, type Product } from '../data/cast';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'B4',
  title: 'Revise agreed costs',
  group: 'B',
  frame: 'desk',
  ifText: 'cost is an agreed figure that holds for weeks or months',
  dims: ['D7.contract'],
  job: 'Move the agreed costs that have gone stale.',
  decides:
    'how a table of rarely-changed numbers shows its own age — and how several rows move in one act',
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: 'the price this cost feeds', ref: 'C3' },
    { region: 'the list this cost sits behind', ref: 'C1' },
  ],
  open: [{ region: 'the catalogue these rows come from', ref: 'OPEN-2' }],
  primitives: ['U08'],
  kit: ['Segmented Control', 'Checkbox', 'Input', 'Button', 'Hint Dot', 'Figure', 'Ghost'],
  canonical: 'grid',
  delta: 'origin',
  deltaText: 'the card that IS the grid; C1 puts prices in the cells and C2 adds a column per tier',
  sector: { fish: 'Δ', meat: '=', fruit: 'Δ' },
  drawnWith: 'meat',
  thread: [2],
  step: 1,
  fills: ['cost'],
  reads: [],
  live:
    'click a cell and it opens in place, committing on Enter; select rows and one act moves them all by a percentage; the stale mark sits on rows nobody has touched for months; the segmented control changes the family',
};

/* ── THE NUMBERS, DERIVED ─────────────────────────────────────────────────────────────────────
 * Law 10 governs names; the same discipline is worth holding for figures, because a typed number
 * is a number that stops being true the moment the cast moves. A contract cost is therefore read
 * from the cast in three steps, in this order, so that every product in every sector has one:
 *   1. the batch the cast holds for it — what this house actually paid
 *   2. the order line's price stepped back by the trade's own working margin, where no batch exists
 *   3. the sector's own median batch cost, where neither exists
 */
const WORKING_MARGIN = 1.42;

/** WHERE THE MEDIAN IS USED, IT IS SHAPED. Three products falling back on the same median print
 *  the same figure three times, which reads as a rendering fault rather than as a coincidence, so
 *  the median is stepped by the product's own position in the shelf. Deterministic, so the same
 *  shelf holds the same figures every time it is opened. */
const SPREAD = [1, 0.78, 1.35, 0.92, 1.24];

function contractCost(cast: Cast, product: Product, index: number): number {
  const batch = cast.batches.find((b) => b.product === product.id);
  if (batch) return Math.round((batch.cost + Number.EPSILON) * 100) / 100;
  const line = cast.order.lines.find((l) => l.product === product.id);
  if (line) return Math.round((line.price / WORKING_MARGIN) * 100) / 100;
  const costs = cast.batches.map((b) => b.cost).sort((a, b) => a - b);
  const median = costs[Math.floor(costs.length / 2)] ?? 0;
  return Math.round(median * SPREAD[index % SPREAD.length] * 100) / 100;
}

/** How long a row has sat. Deterministic by position, so the same shelf shows the same ages every
 *  time it is opened and the stale mark is never a coincidence. */
const AGES = [9, 214, 41, 386, 63];

export default function B4() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const [group, setGroup] = React.useState<string>(cast.families[0].id);
  const [rows, setRows] = React.useState<GridRow[]>([]);

  /* the sector switch hands this screen a different account. A different account's contracts are
     different contracts, so the table is rebuilt and the selection starts again. */
  React.useEffect(() => {
    setGroup(cast.families[0].id);
    setRows(
      cast.products.map((p, i) => ({
        id: p.id,
        name: <Name of={p} />,
        unit: `€/${p.unit}`,
        values: { agreed: contractCost(cast, p, i) },
        daysSinceTouched: AGES[i % AGES.length],
        group: p.family,
      })),
    );
  }, [cast]);

  const edit = (rowId: string, columnId: string, next: number) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, values: { ...r.values, [columnId]: next }, daysSinceTouched: 0 } : r,
      ),
    );

  const bulk = (ids: string[], percent: number) =>
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(r.id)
          ? {
              ...r,
              daysSinceTouched: 0,
              values: Object.fromEntries(
                Object.entries(r.values).map(([k, v]) => [k, Math.round(v * (1 + percent / 100) * 100) / 100]),
              ),
            }
          : r,
      ),
    );

  const groups = cast.families.map((f) => ({
    id: f.id,
    title: f.name,
    count: rows.filter((r) => r.group === f.id).length,
  }));
  const onShelf = rows.filter((r) => r.group === group);

  return (
    /* the day's list is not the day's orders here — this surface stands in the catalogue, and the
       catalogue is nobody's yet (OPEN-2) */
    <DeskChassis daybar={false} daylist={{ open: 2, label: 'the catalogue' }} selected={-1} rows={12} height={760}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
        <Grid
          caption="What we pay, by contract"
          columns={[{ id: 'agreed', title: 'Agreed', note: 'held since the last revision' }]}
          rows={rows}
          groups={groups}
          group={group}
          onGroup={setGroup}
          onEdit={edit}
          onBulk={bulk}
          staleAfterDays={90}
          minWidth={560}
        />

        {/* THE REST OF THE SHELF. Five rows are the cast; a real contract table runs to hundreds,
            and the catalogue that holds them is decided by nobody yet. */}
        <GCatalogue rows={onShelf.length === 0 ? 10 : 7} label="the rest of the shelf" />

        {/* where a cost goes once it is agreed */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale600 }}>
          <GRegion to="C3" height={92} label="the price it feeds" />
          <GRegion to="C1" height={92} label="the list it sits behind" />
        </div>
      </div>
    </DeskChassis>
  );
}
