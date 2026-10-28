/* C2 · Revise a price list with several tiers.
 *
 * THE EXEMPLAR OF THE WHOLE REDUCTION, and the reason group C is checked against this card:
 * D9 must never produce a second screen. C2 is C1 with more columns. Not a different table, not a
 * «pro» mode, not a tier editor — the same grid, the same cell, the same bulk act, the same stale
 * mark, holding one column or four.
 *
 * POSITIVE SPACE. How a tier becomes a column. A control adds tiers, one to four, IN FRONT OF
 * YOU, and the table grows sideways while everything else on the screen stands still. At one tier
 * this card is C1, pixel for pixel, and that is the proof rather than the caption.
 *
 * EACH COLUMN CARRIES ITS OWN COUNT — «3 customers» under the head — so a house widening its list
 * can see who each new column is for while it is being made.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Grid, { type GridRow } from '../canonical/grid';
import { listPrice, tiersOf, AGES } from '../canonical/margin-desk';
import { GCatalogue, GRegion } from '../ghosts/regions';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C2',
  title: 'Revise a price list with several tiers',
  group: 'C',
  frame: 'desk',
  ifText: 'the selling price is a written price list, and several tiers each carry their own',
  dims: ['D8.list', 'D9.many'],
  job: 'Revise a price list that holds a column per tier.',
  decides:
    'that a tier is a COLUMN on the price list rather than a second screen — the same grid at one tier or at four, with each column carrying the count of customers it serves',
  inherits: [
    { region: 'the same list at one tier', ref: 'C1' },
    { region: 'the costs behind these prices', ref: 'B4' },
    { region: 'who sits on each tier', ref: 'J1a' },
    { region: 'orders already taken at the old price', ref: 'C5' },
  ],
  open: [{ region: 'the catalogue this list hangs on', ref: 'OPEN-2' }],
  primitives: ['U08'],
  kit: ['Input', 'Checkbox', 'Hint Dot', 'Segmented Control', 'Button', 'Figure', 'Ghost'],
  canonical: 'grid',
  delta: 'column',
  deltaText: "C1's one price column becomes one column per tier",
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fruit',
  thread: [2],
  step: 4,
  fills: ['price'],
  reads: ['cost'],
  live:
    'move the control from one tier to four and the columns arrive in front of you, each carrying the count of customers on it, while the rows, the bulk act and the stale mark stand exactly still',
};

const COUNTS = [1, 2, 3, 4];

export default function C2() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const allTiers = React.useMemo(() => tiersOf(cast, 4), [cast]);
  const [count, setCount] = React.useState(4);
  const [group, setGroup] = React.useState<string>(cast.families[0].id);
  const [rows, setRows] = React.useState<GridRow[]>([]);

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
        /* every tier's price is computed for every row; the control decides how many are shown,
           so adding a column adds no work anywhere else on the screen */
        values: Object.fromEntries(allTiers.map((t, ti) => [t.id, listPrice(cast, p, ti)])),
        daysSinceTouched: AGES[i % AGES.length],
        group: p.family,
      })),
    );
  }, [cast, allTiers]);

  const shown = allTiers.slice(0, count);

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
    <DeskChassis daybar={false} daylist={{ open: 2, label: 'the catalogue' }} selected={-1} rows={12} height={820}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
        {/* THE CARD'S ONE CONTROL. Move it and the table grows sideways. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
            Tiers on this list
          </span>
          <SegmentedControl
            activeKey={String(count)}
            onChange={({ activeKey }) => setCount(Number(activeKey))}
          >
            {COUNTS.map((n) => (
              <Segment
                key={n}
                artwork={undefined}
                label={n === 1 ? 'One' : `${n} tiers`}
                description={
                  n === 1
                    ? 'every customer on one price'
                    : `${allTiers.slice(0, n).reduce((s, t) => s + t.customers, 0)} customers`
                }
              />
            ))}
          </SegmentedControl>
        </div>

        <Grid
          caption="What we charge, by list"
          columns={shown.map((t) => ({
            id: t.id,
            title: t.name,
            note: `${t.customers} ${t.customers === 1 ? 'customer' : 'customers'}`,
          }))}
          rows={rows}
          groups={groups}
          group={group}
          onGroup={setGroup}
          onEdit={edit}
          onBulk={bulk}
          staleAfterDays={90}
          /* THE TABLE'S OWN FLOOR, and nothing above it. The grid's track already refuses to go
             below roughly 110px a column, so asking for more than that only forces a sideways
             scroll on a desk that could have shown the whole list. Four tiers need a wide desk;
             below it the stage scrolls sideways and a cell still never wraps. */
          minWidth={460 + shown.length * 110}
        />

        <GCatalogue rows={onShelf.length === 0 ? 10 : 7} label="the rest of the shelf" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.sizing.scale600 }}>
          <GRegion to="C1" height={92} label="the same list at one tier" />
          <GRegion to="J1a" height={92} label="who is on each tier" />
          <GRegion to="C5" height={92} label="orders already taken" />
        </div>
      </div>
    </DeskChassis>
  );
}
