/* THE CHANGE NOTICE — `U11`, and the one screen in the catalogue whose BODY IS A FUNCTION OF TIME.
 *
 * The brief's `U11`: «States that something has changed and lists exactly which records are
 * affected. Never alters anything automatically.» Two halves, and the second one is the harder:
 * the notice is the product's promise that a change to a recorded order moves nothing on its own.
 * So the law is drawn into the component rather than left to the three cards that call it —
 * EVERY RECORD BELOW STAYS AS IT IS UNTIL A PERSON CHOOSES, and «Leave them as they are» is
 * PREPENDED BY THIS FILE, so no caller can ship a notice where it is second.
 *
 * THREE CARDS INSTANTIATE IT (BUILD-PLAN §9.1, cluster S2):
 *   A13      origin — the blast radius of a change to a recorded order, at the worst position on
 *            the thread: after the albarán exists, before the goods leave.
 *   A13-bis  control delta — anchored to a SENT albarán, and the primary opens a credit line
 *            instead of an edit.
 *   C5       data delta (P4 reads this file) — the affected records are ORDERS taken at the old
 *            price, not downstream commitments. Same notice, same «leave them» first, same
 *            per-row figure; the rows carry customers and a euro difference.
 *
 * THE PROPS THAT CARRY THE DELTAS
 *   `what`      the change itself, in the caller's words. It is a statement of fact, never an
 *               instruction, because the notice has not done anything.
 *   `rows`      the affected records. A PURE FUNCTION OF THE CALLER'S STATE: A13 recomputes them
 *               as the order travels, C5 recomputes each row's figure as an outcome is chosen.
 *   `outcomes`  what may be done about it. «Leave them as they are» is not in this array — it is
 *               added here, first, always.
 *   `primary`   a door out of the notice. A13-bis's credit line hangs here.
 *   `empty`     what the notice says when the change lands nowhere downstream. Drawn as a real
 *               sentence with its pointer, because «no records affected» is a fact worth reading.
 *
 * NO NAME IS TYPED IN THIS FILE (law 10). Every row's words are composed by the card from
 * `data/cast.ts`.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { ButtonGroup, MODE } from 'baseui/button-group';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Figure } from '../../rocoto/figure';
import RefChip from '../shell/RefChip';

/* ── THE ROW ──────────────────────────────────────────────────────────────────────────────── */

/** What the change does to one record. Three words, and each of them says what IS.
 *  · `holds`     the record is still true after the change; it needs nothing.
 *  · `reopens`   it comes back for a second pass — a sheet re-cut, an albarán re-issued.
 *  · `gone`      it is already out of the building. The row carries the hour it left. */
export type NoticeState = 'holds' | 'reopens' | 'gone';

export const STATE_TEXT: Record<NoticeState, string> = {
  holds: 'Holds',
  reopens: 'Reopens',
  gone: 'Gone',
};

export type NoticeRow = {
  id: string;
  /** the record — «the picking sheet», a customer's name */
  what: React.ReactNode;
  /** the card that decides that record, so a row is a door and the ghost beside it lights */
  ref?: string;
  /** when it committed — «printed 06:40» */
  when?: string;
  /** the number the row carries: A13's quantity, C5's euro difference */
  figure?: { value: number; was?: number; unit?: string; decimals?: number };
  state: NoticeState;
  /** what happens to this record, in one clause, on the row it belongs to (law 7) */
  consequence: React.ReactNode;
};

/** One thing that may be done about the change. `leave` is supplied by this file. */
export type Outcome = {
  id: string;
  /** one to three words (law 7) */
  label: string;
  /** what choosing it does, in one clause — read under the row of buttons */
  detail: React.ReactNode;
};

/** THE FIRST BUTTON, ALWAYS, AND THE ONE SELECTED ON ARRIVAL. Its detail is where `U11`'s law —
 *  «never alters anything automatically» — is written, so the promise is on screen before anybody
 *  has touched the card. Exported so a caller can read its id, never so it can be moved. */
export const LEAVE: Outcome = {
  id: 'leave',
  label: 'Leave them as they are',
  detail: 'Every record above stays exactly as it is, and the change stays on the order for you.',
};

/* ── THE SCREEN ───────────────────────────────────────────────────────────────────────────── */

export type ChangeNoticeProps = {
  /** the change, stated */
  what: React.ReactNode;
  /** the hour it arrived */
  when?: string;
  /** who or what the notice is anchored to — a customer, an albarán */
  anchor?: React.ReactNode;
  rows: NoticeRow[];
  /** what the caller offers. `LEAVE` is prepended here. */
  outcomes: Outcome[];
  /** the chosen outcome's id, controlled */
  outcome: string;
  onOutcome: (id: string) => void;
  /** the evidence that ORDERS the outcomes, riding the row of buttons it orders — «last time
   *  they took a credit». Never a score; always something the product counted. */
  outcomesNote?: React.ReactNode;
  /** what the notice says when the change reaches nothing downstream */
  empty?: React.ReactNode;
  /** a door out — A13-bis's credit line */
  primary?: React.ReactNode;
  /** what the product does and where the next step lives, riding the control it qualifies */
  boundary?: React.ReactNode;
  /** a block above the table — a photograph, a chip row */
  aside?: React.ReactNode;
};

export default function ChangeNotice({
  what,
  when,
  anchor,
  rows,
  outcomes,
  outcome,
  onOutcome,
  outcomesNote,
  empty,
  primary,
  boundary,
  aside,
}: ChangeNoticeProps) {
  const [, theme] = useStyletron();
  const all = [LEAVE, ...outcomes];
  const index = Math.max(0, all.findIndex((o) => o.id === outcome));
  const chosen = all[index] ?? LEAVE;
  const reopens = rows.filter((r) => r.state === 'reopens').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      {/* ── the change, stated. The notice has done nothing, so this is a fact and not a prompt. ── */}
      <header style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...theme.typography.HeadingSmall }}>{what}</div>
          {(anchor || when) && (
            <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              {anchor}
              {anchor && when ? ' · ' : ''}
              {when}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
          <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
            {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </Tag>
          {reopens > 0 && (
            <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
              {reopens} can reopen
            </Tag>
          )}
        </div>
      </header>

      {aside}

      {/* ── the records, exactly ── */}
      {rows.length > 0 ? (
        <div
          style={{
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            overflow: 'hidden',
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                gap: theme.sizing.scale600,
                alignItems: 'baseline',
                padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
                background: row.state === 'gone' ? theme.colors.backgroundSecondary : 'transparent',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={theme.typography.LabelMedium}>{row.what}</span>
                  {row.ref && <RefChip to={row.ref} size="mini" />}
                  {row.when && (
                    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                      {row.when}
                    </span>
                  )}
                </div>
                <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  {row.consequence}
                </div>
              </div>

              <div style={{ whiteSpace: 'nowrap' }}>
                {row.figure && (
                  <Figure
                    value={row.figure.value}
                    was={row.figure.was}
                    unit={row.figure.unit}
                    decimals={row.figure.decimals ?? 0}
                    size="compact"
                  />
                )}
              </div>

              <div style={{ whiteSpace: 'nowrap' }}>
                <Tag
                  closeable={false}
                  kind={TAG_KIND.neutral}
                  hierarchy={row.state === 'gone' ? HIERARCHY.primary : HIERARCHY.secondary}
                >
                  {STATE_TEXT[row.state]}
                </Tag>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            padding: theme.sizing.scale600,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
          }}
        >
          {empty}
        </div>
      )}

      {/* ── what may be done about it. THE FIRST BUTTON IS ALWAYS «Leave them as they are», and it
             is first because this file puts it there, not because a caller remembered. ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
        {outcomesNote && (
          <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            {outcomesNote}
          </p>
        )}
        <ButtonGroup
          mode={MODE.radio}
          size={SIZE.compact}
          kind={KIND.secondary}
          selected={index}
          onClick={(_event, i) => onOutcome(all[i].id)}
        >
          {all.map((o) => (
            <Button key={o.id}>{o.label}</Button>
          ))}
        </ButtonGroup>
        <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {chosen.detail}
        </p>
      </div>

      {(primary || boundary) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
          {primary}
          {boundary && (
            <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
              {boundary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
