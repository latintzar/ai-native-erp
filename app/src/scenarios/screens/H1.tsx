/* H1 · Print it.
 *
 * THE LAYOUT IS THE SUBJECT, because the sheet is read at arm's length on a loading bay by
 * somebody holding a crate: what is large, what is small, and what is on the page because it must
 * be. So the card is a sheet at true A4 proportion on a preview stage, and nothing else.
 *
 * AND THIS CARD IS THE TEST THAT E3'S DECISION IS RIGHT. If the traceability field set is DATA,
 * one line block absorbs all three sectors and only the PAGE COUNT moves. If it is not, H1 becomes
 * three layouts. Run the sector switch on this card and read the page count in the corner of the
 * stage:
 *
 *     fish   8 facts per line → 3 sub-lines → 76px rows → TWO SHEETS
 *     meat   6 facts per line → 2 sub-lines → 62px rows → ONE SHEET
 *     fruit  6 facts per line → 2 sub-lines → 62px rows → ONE SHEET
 *
 * The column heads never move. That is the proof, and it is arithmetic rather than an opinion —
 * `el papel` paginates by computation, so the number in the corner is the same number every time.
 *
 * IT IS A DATA DELTA ON F0. P5's `print-sheet` is the canonical: a masthead, a foot, a stage and a
 * control strip. H1 hands it a different masthead, a different column set and different rows, and
 * changes nothing else — which is exactly the claim S14 makes and the reason this card reads P5's
 * file rather than growing a second one.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import PrintSheet, { SheetMasthead, SheetFoot } from '../canonical/print-sheet';
import { buildAlbaran } from '../canonical/release';
import type { PaperColumn, PaperRow } from '../../rocoto/paper';
import { GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'H1',
  title: 'Print it',
  group: 'H',
  frame: 'desk',
  paper: true,
  ifText: 'the albarán is printed and handed over with the goods',
  dims: ['D15.paper'],
  job: 'Print the albarán so it can be read at arm’s length on a loading bay.',
  decides:
    'the printed albarán’s layout — what is large, what is small, and that the traceability rides a sub-line so one column set serves every family',
  inherits: [
    { region: 'the sheet’s own chrome and its stage', ref: 'F0' },
    { region: 'the traceability rows', ref: 'E3' },
    { region: 'the lines', ref: 'A1' },
    { region: 'the document this prints', ref: 'G1' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [
    { region: 'the house’s own letterhead', ref: 'OPEN-18' },
    { region: "the day's bar and the day's documents", ref: 'OPEN-1' },
  ],
  primitives: [],
  kit: ['el papel', 'Paper Stage', 'Button', 'Tag', 'Ghost'],
  canonical: 'print-sheet',
  delta: 'data',
  deltaText: 'the document is the albarán rather than the picking list — a masthead, a column set and rows',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1],
  step: 9,
  fills: [],
  reads: ['albarán', 'lot.traceability[]'],
  live:
    'run the sector switch and watch the page count in the corner of the stage go from two sheets to one while the column heads stand still; press Print and the surface states what went',
};

const COLUMNS: PaperColumn[] = [
  { key: 'product', label: 'Product', width: 'minmax(0, 1fr)' },
  { key: 'lote', label: 'Lote', width: '84px' },
  { key: 'sent', label: 'Sent', width: '86px', align: 'end' },
  { key: 'total', label: '€', width: '86px', align: 'end' },
];

const money = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function H1() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const albaran = React.useMemo(() => buildAlbaran(cast), [cast]);
  const [printed, setPrinted] = React.useState(false);

  React.useEffect(() => setPrinted(false), [cast.sector]);

  const rows: PaperRow[] = albaran.lines.map((line) => ({
    id: line.id,
    cells: {
      product: <Name of={line.product} />,
      lote: line.lot,
      sent: `${line.sent.toLocaleString('es-ES', {
        minimumFractionDigits: line.unit === 'kg' ? 1 : 0,
        maximumFractionDigits: line.unit === 'kg' ? 1 : 0,
      })} ${line.unit}`,
      total: `${money(line.sent * line.price)} €`,
    },
    /* THE SUB-LINE — the whole of the sector delta, and the whole of the page-count argument. */
    sub: line.trace,
  }));

  const facts = albaran.lines[0].trace.length;

  return (
    <DeskChassis selected={4} rows={10} height={1000} daylist={{ label: "the day's albaranes" }}>
      <PrintSheet
        heading={`Albarán ${albaran.number}`}
        standfirst={
          <>
            {facts} traceability facts on every line, on a second line under the product name. The
            column heads stay where they are in all three sectors; the page count is the number that
            moves.
          </>
        }
        columns={COLUMNS}
        rows={rows}
        stageWidth={620}
        height={720}
        masthead={
          <SheetMasthead
            issuer={<GRegion open={18} shape="line" height={22} label="the house" />}
            document="Albarán"
            recipient={<Name of={albaran.customer} />}
            day={albaran.day}
            serial={albaran.number}
          />
        }
        runningHead={
          <>
            <span>
              Albarán {albaran.number} · {albaran.customer.name}
            </span>
            <span>{albaran.day}</span>
          </>
        }
        foot={
          <SheetFoot
            totals={
              <>
                {albaran.lines.length} lines · {money(albaran.total)} €
              </>
            }
            signature="Received by"
          />
        }
        aside={
          printed ? (
            <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
              Sent to the printer
            </Tag>
          ) : undefined
        }
        controls={
          <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setPrinted(true)}>
              Print
            </Button>
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              It goes on the crate with the goods.
            </span>
          </div>
        }
      />
    </DeskChassis>
  );
}
