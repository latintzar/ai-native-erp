/* C1 · Revise a price list.
 *
 * `D8.list` with `D9.one`: a written price list, one price for every customer, changed
 * occasionally. And that is B4's table with prices in the cells instead of costs — a DATA DELTA
 * and nothing more. Same grid, same bulk act, same stale mark, same segmented control. The card
 * exists to prove the sentence, so it draws it rather than asserting it.
 *
 * POSITIVE SPACE. The price grid: a cell that opens in place, one act that moves a selection, and
 * a marker on any row nobody has touched for a long time, so staleness is on the FACE of the
 * table rather than in a report about the table.
 *
 * WHY THAT MARKER MATTERS HERE MORE THAN ON B4. A stale cost is a number the house has stopped
 * paying. A stale PRICE is a number the house is still charging — every day, on every order, to
 * every customer — and it goes on being charged until somebody looks. The stale mark is the
 * looking, and it is on the row it belongs to.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Grid, { type GridRow } from '../canonical/grid';
import { listPrice, AGES } from '../canonical/margin-desk';
import { GCatalogue, GTiers, GRegion } from '../ghosts/regions';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C1',
  title: 'Revise a price list',
  group: 'C',
  frame: 'desk',
  ifText: 'the selling price is a written price list, and one list serves every customer',
  dims: ['D8.list', 'D9.one'],
  job: 'Revise the written price list.',
  decides:
    'that a price list is a table nobody opens often — edited in place, moved in bulk, and carrying a mark on any row untouched for months so staleness is on the face of the table',
  inherits: [
    { region: "the costs behind these prices", ref: 'B4' },
    { region: 'the tier columns', ref: 'C2' },
    { region: 'orders already taken at the old price', ref: 'C5' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [{ region: 'the catalogue this list hangs on', ref: 'OPEN-2' }],
  primitives: ['U08'],
  kit: ['Input', 'Checkbox', 'Hint Dot', 'Segmented Control', 'Button', 'Figure', 'Ghost'],
  canonical: 'grid',
  delta: 'data',
  deltaText: "B4's grid with prices in the cells instead of costs",
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fruit',
  thread: [2],
  step: 4,
  fills: ['price'],
  reads: ['cost'],
  live:
    'click a cell and it opens in place, committing on Enter; select rows and one act moves every one of them by a percentage; the stale mark sits on rows untouched for months and leaves the moment a row is edited',
};

export default function C1() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const [group, setGroup] = React.useState<string>(cast.families[0].id);
  const [rows, setRows] = React.useState<GridRow[]>([]);

  /* a different sector is a different account, so it is a different list */
  React.useEffect(() => {
    setGroup(cast.families[0].id);
    setRows(
      cast.products.map((p, i) => ({
        id: p.id,
        /* the grid's stale mark is a dot pinned to this node's top right, so the name carries
           its own clearance and the dot never lands on the last letter of «Palamós» */
        name: (
          <span style={{ display: 'inline-block', paddingRight: 12 }}>
            <Name of={p} />
          </span>
        ),
        unit: `€/${p.unit}`,
        values: { list: listPrice(cast, p, 0) },
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
    <DeskChassis daybar={false} daylist={{ open: 2, label: 'the catalogue' }} selected={-1} rows={12} height={780}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
        <Grid
          caption="What we charge, by list"
          columns={[{ id: 'list', title: 'List price', note: 'one list, every customer' }]}
          rows={rows}
          groups={groups}
          group={group}
          onGroup={setGroup}
          onEdit={edit}
          onBulk={bulk}
          staleAfterDays={90}
          minWidth={560}
        />

        {/* the rest of the shelf: five rows are the cast, a real list runs to hundreds */}
        <GCatalogue rows={onShelf.length === 0 ? 10 : 7} label="the rest of the shelf" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.sizing.scale600 }}>
          {/* the same table with one column per tier — the whole of C2 */}
          <GTiers rows={4} to="C2" label="the tiers" />
          {/* where the numbers in these cells came from */}
          <GRegion to="B4" height={92} label="the costs behind them" />
          {/* the orders stamped before this revision */}
          <GRegion to="C5" height={92} label="orders already taken" />
        </div>
      </div>
    </DeskChassis>
  );
}
