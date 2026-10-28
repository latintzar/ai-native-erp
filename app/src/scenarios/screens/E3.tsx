/* E3 · Traceability attaches to the batch.
 *
 * THE SINGLE MOST IMPORTANT SECTOR FIX IN THE CATALOGUE, AND IT IS SETTLED (C-2). D12 is a
 * PER-FAMILY traceability profile with four values, and the field set is DATA:
 *
 *   none            —                                                        ambiente y secos
 *   lot             lote · variedad · categoría · calibre · origen · GGN      fruta y verdura
 *   lot+animal      lote · birth · rearing · slaughter · cutting · plant       carne
 *   lot+fisheries   lote · nombre científico · zona · arte · método · …        pescado y marisco
 *
 * ONE BLOCK, DIFFERENT ROWS. Run the sector switch above this card and watch the field set change
 * while the component underneath stays still — that switch IS the card, and it is the proof C-2 is
 * right. It is also what makes a mixed house ordinary: merluza and media canal on one albarán are
 * two families in one catalogue, and nothing special happens.
 *
 * NO ACTION. Everything here arrived with the goods and was captured at reception — off a
 * supplier's document (B2), off a photograph at the loading bay (B3), or spoken at the lorry
 * (D1s). ROCOTO NEVER AUTHORS A LOTE. Entered once at intake, printed on every albarán that draws
 * on that lote, and never asked again.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import BatchRecord from '../canonical/batch-record';
import { GBatchbook, GRegion } from '../ghosts/regions';
import RefChip from '../shell/RefChip';
import { useSector } from '../shell/context';
import { familyOf, productOf } from '../data/cast';

export const meta: ScenarioMeta = {
  id: 'E3',
  title: 'Traceability attaches to the batch',
  group: 'E',
  frame: 'desk',
  ifText: "a family's D12 profile is lot, lot+animal or lot+fisheries",
  dims: ['D12.lot', 'D12.lot+animal', 'D12.lot+fisheries'],
  job: 'Show that traceability is a property of the lote and is captured once.',
  decides:
    'that the traceability field set belongs to the FAMILY and is data — one block whose rows change with the family, entered once at intake and printed on every albarán that draws on that lote',
  inherits: [
    { region: 'the supplier document the facts were read off', ref: 'B2' },
    { region: 'the photograph the loading bay retained', ref: 'B3' },
    { region: 'the spoken intake where no document exists', ref: 'D1s' },
    { region: 'the albarán this record prints on', ref: 'G1' },
    { region: 'the printed sheet at arm’s length', ref: 'H1' },
  ],
  open: [{ region: 'the batch ledger and the document inbox', ref: 'OPEN-5' }],
  primitives: [],
  kit: ['Tag', 'Ghost'],
  canonical: 'batch-record',
  delta: 'origin',
  deltaText: 'the card that IS the batch record; the field set is the family, and the family is data',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [3],
  step: 4,
  fills: ['lot.traceability[]'],
  reads: [],
  live:
    'the sector switch changes the field set from one component — eight rows in fish, six in meat, six in fruit — while the block, the header and the page stay exactly where they are',
};

export default function E3() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const batch = cast.batches[0];
  const product = productOf(cast, batch.product);
  const family = familyOf(cast, product);

  return (
    <DeskChassis selected={-1} rows={10} daylist={{ open: 5, label: 'the batch ledger' }} height={780}>
      <BatchRecord
        cast={cast}
        batch={batch}
        provenance={
          <>
            {family.recordFields.length} facts arrived with the goods and were captured once at
            reception. Rocoto reads a lote; the goods carry it.
          </>
        }
        consumers={
          <>
            <RefChip to="G1">the albarán</RefChip>
            <RefChip to="H1">the printed sheet</RefChip>
            <RefChip to="E1">the line it fills</RefChip>
            <RefChip to="E2">the line it shares</RefChip>
          </>
        }
        aside={
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
            {/* the photograph the loading bay kept, beside the facts it stands behind */}
            <GRegion to="B3" height={168} label="the retained photograph" />
            {/* the document the facts were read off, where one arrived */}
            <GRegion to="B2" height={92} label="the supplier's document" />
            {/* where a lote waits between capture and use */}
            <GBatchbook rows={5} />
          </div>
        }
      />
    </DeskChassis>
  );
}
