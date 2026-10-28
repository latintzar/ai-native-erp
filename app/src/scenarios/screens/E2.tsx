/* E2 · Divide a line across two or more batches.
 *
 * THE BOUNDARY. One line, two landings, two costs. Dragging the boundary moves quantity from one
 * lote to the other and the blended cost and the margin recompute while the hand is still on the
 * control — because the division IS the profit on that line, and a person deciding it should see
 * the consequence at the moment of deciding rather than in a report on Friday.
 *
 * THE INVARIANT IS THE FORK'S, NOT THIS SCREEN'S. `el reparto` holds the parts as the gaps between
 * its boundaries, so the sum is the total by construction and `U04`'s law — «it is not possible to
 * create or lose units by dragging» — needs no validation anywhere on this card.
 *
 * SECTOR: THE FREQUENCY, NOT THE SCREEN (C-3). Fish, most mornings — two vessels land the same
 * species before the orders are placed. Fruit, occasionally — a pallet is one lote and it is
 * large. Meat, rarely — a weekly contract price and large deliveries. That answers the brief's own
 * first open question by sector rather than by a number, and it changes nothing about the screen
 * and everything about where the screen lives.
 *
 * WHICH LINE AND WHICH LOTES, AND WHY IT IS DERIVED. `cast.ts` holds one landing row per lote id,
 * and its own traceability table already has a lote spanning two products — L-2208 carries both
 * Merluza and Rape, L-2214 both Pulpo and Lubina — because a lote in this trade is A LANDING and a
 * landing holds what came off the boat. So this card picks the first line of the order for which
 * the day landed two lotes priced in that line's own unit and both below the line's price, and
 * allocates across those two at their own recorded costs. Every number on the screen comes from
 * the cast; the choice of which two is arithmetic, and it holds under all three sectors.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import BatchLine, { type Allocation } from '../canonical/batch-line';
import { Reparto } from '../../rocoto/reparto';
import { GLines, GBatchbook, GRegion } from '../ghosts/regions';
import Name from '../shell/Name';
import { useSector } from '../shell/context';
import type { Cast, OrderLine } from '../data/cast';
import { batchOf, productOf } from '../data/cast';

export const meta: ScenarioMeta = {
  id: 'E2',
  title: 'Divide a line across two or more batches',
  group: 'E',
  frame: 'desk',
  ifText: 'a line requires two or more lotes',
  dims: ['D12.lot', 'D12.lot+animal', 'D12.lot+fisheries'],
  job: 'Divide one line across the lotes that fill it, and show what the division costs.',
  decides:
    'where the boundary between two lotes sits on one line — and the blended cost and the margin that boundary produces, while it is being moved',
  inherits: [
    { region: 'the rest of the order', ref: 'A1' },
    { region: 'the price the margin is against', ref: 'C3' },
    { region: 'the albarán these lotes print on', ref: 'G1' },
    { region: 'everything each lote carries', ref: 'E3' },
  ],
  open: [
    { region: 'the batch ledger the lotes live in', ref: 'OPEN-5' },
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
  ],
  primitives: ['U04'],
  kit: ['Reparto', 'Figure', 'Tag', 'Button', 'Ghost'],
  canonical: 'batch-line',
  delta: 'control',
  deltaText: 'the boundary, and the blended cost and margin it moves',
  sector: { fish: '=', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1],
  step: 5,
  fills: [],
  reads: ['lot', 'cost'],
  live:
    'drag the boundary and the two quantities move against each other while the blended cost and the margin recompute; add a lote and a second boundary appears where the day landed a third',
};

/* ── WHICH LINE, AND WHICH LANDINGS ───────────────────────────────────────────────────────────
 * Deterministic, and cast-only. A landing qualifies for a line when it is priced in that line's
 * own unit; the division uses the two cheapest qualifying landings that sit under the line's
 * price, with the line's own lote leading. */

type Division = { line: OrderLine; lots: string[]; spare?: string };

const landingsFor = (cast: Cast, line: OrderLine): string[] =>
  cast.batches
    .filter((b) => productOf(cast, b.product).unit === line.unit)
    .slice()
    .sort((a, b) => a.cost - b.cost)
    .map((b) => b.id);

const divide = (cast: Cast): Division | undefined => {
  for (const line of cast.order.lines) {
    const priced = landingsFor(cast, line);
    const affordable = priced.filter((id) => (batchOf(cast, id)?.cost ?? Infinity) < line.price);
    if (affordable.length < 2) continue;
    const pair = affordable.slice(0, 2);
    /* the line's own lote leads, because that is the one the allocation started from */
    const lots = line.lot && pair.includes(line.lot) ? [line.lot, ...pair.filter((id) => id !== line.lot)] : pair;
    const spare = priced.find((id) => !lots.includes(id));
    return { line, lots, spare };
  }
  return undefined;
};

/** kg divide by halves; a caja or a pieza divides by whole packs. */
const stepFor = (line: OrderLine) => (line.unit === 'kg' ? 0.5 : 1);

const round = (n: number, step: number) => Math.round(n / step) * step;

/** The opening division: the line's own lote carries the greater share, and the other takes the
 *  rest — so the sum is the line before a hand ever touches the boundary. */
const opening = (division: Division | undefined): number[] => {
  if (!division || division.lots.length < 2) return division ? [division.line.qty] : [];
  const { line } = division;
  const first = round(line.qty * 0.6, stepFor(line));
  return [first, line.qty - first];
};

export default function E2() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const division = React.useMemo(() => divide(cast), [cast]);
  const line = division?.line ?? cast.order.lines[0];
  const step = stepFor(line);

  const [lots, setLots] = React.useState<string[]>(() => division?.lots ?? []);
  const [parts, setParts] = React.useState<number[]>(() => opening(division));
  const [open, setOpen] = React.useState<string | null>(null);

  /* a different sector is a different order, so the division starts again with it */
  React.useEffect(() => {
    setLots(division?.lots ?? []);
    setParts(opening(division));
    setOpen(null);
  }, [division]);

  const allocations: Allocation[] = lots.map((id, i) => ({ batch: id, qty: parts[i] ?? 0 }));
  const product = productOf(cast, line.product);
  const spare = division?.spare;

  /** a third landing takes one step off the largest part, so the boundary it adds is visible and
   *  the blend moves the moment it exists */
  const addLot = () => {
    if (!spare) return;
    const largest = parts.indexOf(Math.max(...parts));
    const next = parts.map((p, i) => (i === largest ? p - step : p));
    setLots([...lots, spare]);
    setParts([...next, step]);
  };

  return (
    <DeskChassis dossier selected={2} rows={12} height={940}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <BatchLine
            cast={cast}
            line={line}
            allocations={allocations}
            showCost
            openBatch={open}
            onOpenBatch={setOpen}
            note={
              <>
                <Name of={product} /> came off {lots.length} of this morning&rsquo;s landings, at{' '}
                {lots.length} prices. The boundary decides which kilos come from which.
              </>
            }
            divide={
              <Reparto
                total={line.qty}
                value={parts}
                step={step}
                minPart={step}
                onChange={({ value }) => setParts(value)}
                labels={lots.map((id) => id)}
                captions={lots.map((id) => {
                  const b = batchOf(cast, id);
                  return b ? `${b.cost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/${product.unit}` : '';
                })}
                valueToLabel={(v) =>
                  `${v.toLocaleString('es-ES', {
                    minimumFractionDigits: line.unit === 'kg' ? 1 : 0,
                    maximumFractionDigits: line.unit === 'kg' ? 1 : 0,
                  })} ${line.unit}`
                }
              />
            }
            action={
              spare && !lots.includes(spare) ? (
                <div>
                  <Button kind={KIND.secondary} size={SIZE.compact} onClick={addLot}>
                    Add {spare}
                  </Button>
                </div>
              ) : (
                <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                  This morning landed {lots.length}.
                </p>
              )
            }
          />

          {/* how often this happens is the sector's answer, and it is the card's own argument */}
          <div
            style={{
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius300,
              padding: theme.sizing.scale500,
              background: theme.colors.backgroundSecondary,
              ...theme.typography.ParagraphSmall,
            }}
          >
            {FREQUENCY[cast.sector]}
          </div>

          <GLines rows={Math.max(1, cast.order.lines.length - 1)} label="the order's other lines" />
          <GRegion to="C3" height={80} label="the price this margin is against" />
        </div>

        <GBatchbook rows={6} />
      </div>
    </DeskChassis>
  );
}

/** C-3, in one clause per sector: the brief's own first open question, answered by sector. */
const FREQUENCY: Record<string, string> = {
  fish: 'Most mornings: two vessels land the same species before the orders are placed.',
  meat: 'Rarely: a weekly contract price and deliveries large enough to cover a line on their own.',
  fruit: 'Occasionally: a pallet is one lote and it is large.',
};
