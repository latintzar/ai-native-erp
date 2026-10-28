/* THE ARRIVAL RECORD — what went, where, when, and what came back.
 *
 * P6 owns this file, and it is the file that has to PROVE OR BREAK the sharpest reduction claim in
 * BUILD-PLAN §9.1: **G2 ≡ G3 ≡ H2 ≡ H6**. MAP paired only G2 with G3; the plan claims four cards
 * are one watching table. The four:
 *
 *   G2  D14.erp        the day's file reached the accounting system        origin
 *   G3  no connection  the same table, and the row carries a download      control delta
 *   H2  D15.link       the albarán reached the customer, who opened it     data delta
 *   H6  D15.connected  the albarán reached the customer's own system       data delta
 *
 * THE SHAPE THAT SURVIVED THE DRAWING. Every one of the four is a list of DISPATCHES, and every
 * dispatch answers exactly four questions in the same order:
 *
 *   WHAT went · WHERE it went · WHEN it left · WHAT CAME BACK
 *
 * The column HEADS are data, because «the accounting system» and «the customer» are the same slot
 * with different words in it. The fourth column is a LIST OF FACTS rather than a single value,
 * which is what lets «312 lines accepted» and «opened 09:31 by Marta» be the same column — and it
 * is the one place the four cards genuinely differ in shape, so it is the one place the component
 * had to bend. A dispatch still out carries `pending` instead, and the row says what is true right
 * now rather than leaving a hole.
 *
 * ONE CONTROL SLOT PER ROW, unused on three of the four cards. G3 puts its download there. That is
 * the whole of the control delta — no branch, no second table.
 *
 * WHAT IS NOT HERE, and would have broken it: a per-sector export. G2's sector delta is ROWS IN A
 * COLUMN MAP (SECTORS §10), which is `aside` content, not a different table.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';

/** One thing that came back. The value is a node, because on H2 the «who» is a ghost pointing at
 *  J1a and on H6 the receiving system is a ghost pointing at OPEN-15 — a fact nobody has yet is
 *  still a fact in that column, and it belongs in the column rather than in a footnote. */
export type ArrivalFact = { label: string; value: React.ReactNode };

export type ArrivalRow = {
  id: string;
  /** what went — a document, a day's file */
  what: React.ReactNode;
  /** the second line under it */
  sub?: React.ReactNode;
  /** where it went — the accounting system, the customer, the customer's own system */
  where: React.ReactNode;
  /** when it left */
  left: string;
  /** what came back. Several facts, because «opened, by whom, when» is three of them. */
  back?: ArrivalFact[];
  /** the dispatch is still travelling — say what is true now */
  pending?: string;
  /** the one control slot. G3's download stands here; the other three cards leave it empty. */
  control?: React.ReactNode;
};

export type ArrivalRecordProps = {
  /** the four column heads, in words. The heads are data — that is the reduction. */
  columns: { what: string; where: string; left: string; back: string };
  rows: ArrivalRow[];
  /** the line that says what this record is a record OF. It rides the table it justifies. */
  head?: React.ReactNode;
  /** the column map (G2), the unit check (G3) — everything that is not a dispatch */
  aside?: React.ReactNode;
  /** the count at the foot */
  foot?: React.ReactNode;
};

const COLUMNS = 'minmax(0, 1.4fr) minmax(0, 1fr) 72px minmax(0, 1.3fr)';
const GAP = 'scale700';

export default function ArrivalRecord({ columns, rows, head, aside, foot }: ArrivalRecordProps) {
  const [, theme] = useStyletron();

  const headCell = (text: string, align: 'left' | 'right' = 'left') => (
    <span
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        textAlign: align,
      }}
    >
      {text}
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      {head}

      <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: COLUMNS,
            gap: theme.sizing[GAP],
            padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
            background: theme.colors.backgroundSecondary,
            borderBottom: `1px solid ${theme.colors.borderOpaque}`,
          }}
        >
          {headCell(columns.what)}
          {headCell(columns.where)}
          {headCell(columns.left, 'right')}
          {headCell(columns.back)}
        </div>

        {rows.map((row, i) => (
          <div
            key={row.id}
            style={{
              display: 'grid',
              gridTemplateColumns: COLUMNS,
              gap: theme.sizing[GAP],
              alignItems: 'baseline',
              padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
              borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={theme.typography.LabelSmall}>{row.what}</div>
              {row.sub && (
                <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  {row.sub}
                </div>
              )}
            </div>

            <div style={{ ...theme.typography.ParagraphSmall, minWidth: 0 }}>{row.where}</div>

            <div
              style={{
                ...theme.typography.ParagraphSmall,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {row.left}
            </div>

            {/* WHAT CAME BACK. Several facts on one column, which is what makes «312 lines
                accepted» and «opened 09:31 by Marta» the same slot. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
              {row.back?.map((f) => (
                <div key={f.label} style={{ ...theme.typography.ParagraphSmall, minWidth: 0 }}>
                  <span style={{ color: theme.colors.contentTertiary }}>{f.label} </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{f.value}</span>
                </div>
              ))}
              {row.pending && (
                <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                  {row.pending}
                </div>
              )}
              {row.control && <div style={{ marginTop: theme.sizing.scale200 }}>{row.control}</div>}
            </div>
          </div>
        ))}
      </div>

      {foot}
      {aside}
    </div>
  );
}

/** The line above the table that says what this record is a record of. One clause; the evidence
 *  rides the table it justifies rather than standing as a paragraph of its own. */
export function ArrivalHead({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        borderLeft: `3px solid ${theme.colors.contentPrimary}`,
        paddingLeft: theme.sizing.scale500,
        ...theme.typography.ParagraphSmall,
      }}
    >
      {children}
    </div>
  );
}
