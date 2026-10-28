/* E1 · The line fits in one batch.
 *
 * THE CARD THAT EXISTS TO PROVE THE PRODUCT DOES NOT INVENT BUSYWORK. The ordinary case is the
 * common case: the line fits, the oldest lote holding that product fills it, one line of ink says
 * which — and there is no control at all. A product that asked a person to confirm this would be
 * asking a hundred times a morning for an answer it already has.
 *
 * SO THE DELTA FROM E2 IS THE CONTROL, AND THE CONTROL IS ABSENT. Both cards render
 * `canonical/batch-line`; E2 passes `el reparto` and E1 passes nothing, because a line inside one
 * lote has no boundary to move. That is the reduction's claim about S11, and it is one prop.
 *
 * A ROW IS A DOOR. The one gesture on this card leads sideways rather than forward: the lote chip
 * opens the lote in place, and from there the batch record (E3) is one chip away.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import BatchLine, { oldestBatchFor } from '../canonical/batch-line';
import { GLines, GBatchbook, GRegion } from '../ghosts/regions';
import Name from '../shell/Name';
import { useSector } from '../shell/context';
import { batchOf, productOf, supplierOf } from '../data/cast';

export const meta: ScenarioMeta = {
  id: 'E1',
  title: 'The line fits in one batch',
  group: 'E',
  frame: 'desk',
  ifText: 'a family records a lote and the line fits inside one of them',
  dims: ['D12.lot', 'D12.lot+animal', 'D12.lot+fisheries'],
  job: 'Show how a line is filled when the oldest lote holds enough.',
  decides:
    'that the ordinary allocation happens on its own — the oldest lote holding that product fills the line, one line of ink says which, and the screen asks for nothing',
  inherits: [
    { region: 'the rest of the order', ref: 'A1' },
    { region: 'the albarán this lote prints on', ref: 'G1' },
    { region: 'everything the lote carries', ref: 'E3' },
  ],
  open: [
    { region: 'the batch ledger the lotes live in', ref: 'OPEN-5' },
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
  ],
  primitives: [],
  kit: ['Figure', 'Tag', 'Ghost'],
  canonical: 'batch-line',
  delta: 'control',
  deltaText: 'there is no boundary to move, so there is no control',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 5,
  fills: [],
  reads: ['lot'],
  live:
    'hover or press the lote chip and the lote opens in place, carrying the door to everything it holds; the sector switch changes the lote and leaves the screen exactly where it was',
};

export default function E1() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [open, setOpen] = React.useState<string | null>(null);

  const line = cast.order.lines[0];
  const product = productOf(cast, line.product);
  const lot = oldestBatchFor(cast, line.product) ?? line.lot;
  const batch = lot ? batchOf(cast, lot) : undefined;

  /* the lote a line lands in belongs to that line's own order; a different sector is a different
     order, so what is open here goes back to closed with it */
  React.useEffect(() => { setOpen(null); }, [cast.sector]);

  return (
    <DeskChassis dossier selected={2} rows={11} height={820}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <BatchLine
            cast={cast}
            line={line}
            allocations={lot ? [{ batch: lot, qty: line.qty }] : []}
            openBatch={open}
            onOpenBatch={setOpen}
            note={
              batch ? (
                <>
                  The oldest lote holding <Name of={product} /> filled it: {batch.id}, landed {batch.day} from{' '}
                  <Name of={supplierOf(cast, batch.supplier)} />, {batch.qty} {product.unit} on hand.
                </>
              ) : null
            }
          />

          {/* the other lines of the same order — A1 owns what a line looks like */}
          <GLines rows={cast.order.lines.length - 1} label="the order's other lines" />

          {/* where this allocation is read next */}
          <GRegion to="G1" height={96} label="the albarán" />
        </div>

        {/* where the lotes live between capture and use */}
        <GBatchbook rows={6} />
      </div>
    </DeskChassis>
  );
}
