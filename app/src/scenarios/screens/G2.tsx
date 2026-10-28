/* G2 · Confirm the data reached the accounting system.
 *
 * A WATCHING SCREEN (§3.4). There is no control on it, and the card's content is that there is
 * nothing to press: what went, where, when it left, and what came back.
 *
 * THE SECTOR DELTA IS ROWS IN A COLUMN MAP, never a sector-specific export (SECTORS §10). The map
 * below the record is built from the family's own `recordFields`, so the sector switch adds and
 * removes rows in it and changes nothing else on the screen — one file shape, one screen, and the
 * traceability travels as extra columns rather than as a different product.
 *
 * AND THE MAP IS WHERE THE HOLE IS. Fish and meat files carry lote and traceability columns the
 * receiving program may have no field for, and the brief does not say what happens then. Those
 * rows carry OPEN-12 in the column they would map to, so the hole is visible in the place it
 * actually bites rather than in a footnote.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import ArrivalRecord, { ArrivalHead, type ArrivalRow } from '../canonical/arrival-record';
import { GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import { familyOf } from '../data/cast';

export const meta: ScenarioMeta = {
  id: 'G2',
  title: 'Confirm the data reached the accounting system',
  group: 'G',
  frame: 'desk',
  ifText: "the company's existing system produces the albarán, from data Rocoto sends",
  dims: ['D14.erp'],
  job: 'See that the day went into the accounting system, and what it said back.',
  decides:
    'what proof of arrival is made of — what went, where, when it left and what came back — and that a finished integration is a screen with nothing to press',
  inherits: [
    { region: 'the albaranes this file covers', ref: 'G1' },
    { region: 'the same screen with a file instead of a write', ref: 'G3' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [
    { region: "the day's file, and where it waits", ref: 'OPEN-5' },
    { region: "the day's bar and the day's list", ref: 'OPEN-1' },
    { region: 'the columns the receiving program has no field for', ref: 'OPEN-12' },
  ],
  primitives: [],
  kit: ['Ghost'],
  canonical: 'arrival-record',
  delta: 'origin',
  deltaText: 'the card that IS the arrival record; G3, H2 and H6 delta from it',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 11,
  fills: [],
  reads: ['albarán'],
  live:
    'no controls at all; the sector switch adds and removes rows in the column map underneath and leaves the record above it untouched',
};

/** The days behind today, and what each of them carried. Figures, derived nowhere else. */
const DAYS = [
  { day: '22.08', at: '07:22', docs: 14, lines: 168 },
  { day: '21.08', at: '07:19', docs: 12, lines: 141 },
  { day: '20.08', at: '07:31', docs: 15, lines: 187 },
  { day: '19.08', at: '07:14', docs: 11, lines: 129 },
  { day: '18.08', at: '07:26', docs: 13, lines: 152 },
];

/** The columns every file carries, whatever the house sells. */
export const BASE_COLUMNS = ['customer', 'date', 'product', 'quantity', 'unit', 'price', 'total'];

export default function G2() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  /* THE MAP IS DATA. The family's own field set, which is the whole of C-2, becomes the extra
     rows of the column map — and nothing about the screen knows which sector it is in. */
  const family = familyOf(cast, cast.products[0]);

  const rows: ArrivalRow[] = DAYS.map((d) => ({
    id: d.day,
    what: `File ${d.day}`,
    sub: `${d.docs} albaranes · ${d.lines} lines`,
    where: 'the accounting system',
    left: d.at,
    back: [{ label: 'accepted', value: `${d.lines} lines` }],
  }));

  return (
    <DeskChassis selected={0} rows={9} height={980} daybar={false} daylist={{ open: 5, label: "the day's files" }}>
      <ArrivalRecord
        columns={{ what: 'What went', where: 'Where', left: 'Left', back: 'What came back' }}
        rows={rows}
        head={<ArrivalHead>Every line of every albarán, written straight into the accounting system.</ArrivalHead>}
        aside={
          <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                ...theme.typography.LabelXSmall,
                color: theme.colors.contentTertiary,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              The column map
            </h2>
            <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
              {[...BASE_COLUMNS.map((c) => ({ field: c, open: false })), ...family.recordFields.map((c) => ({ field: c, open: true }))].map(
                (row, i) => (
                  <div
                    key={row.field}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) 24px minmax(0, 1fr)',
                      gap: theme.sizing.scale400,
                      alignItems: 'center',
                      padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
                      borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
                    }}
                  >
                    <span style={theme.typography.ParagraphSmall}>{row.field}</span>
                    <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary }}>→</span>
                    {row.open ? (
                      /* the receiving program's field for a traceability column, which nobody has
                         named — the hole, drawn where it bites */
                      <GRegion open={12} shape="line" height={10} label="their column" />
                    ) : (
                      <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                        {row.field.toUpperCase()}
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
            <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              {family.recordFields.length} of these rows come from the {family.name} field set, and
              they are the rows a receiving program answers for one house at a time.
            </p>
          </section>
        }
      />
    </DeskChassis>
  );
}
