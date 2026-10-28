/* THE GRID — `U08`, the cell grid, and the canonical screen behind B4 · C1 · C2.
 *
 * P3 owns this file and lands it FIRST, because P4's C1 and C2 read it (BUILD-PLAN §6): «B4's
 * editable grid is the same table with different values in the cells.» That sentence is the whole
 * design brief, so the component holds NO opinion about what a cell contains — it holds the
 * anatomy of a table nobody opens often:
 *
 *   · a cell that opens in place and commits on Enter or on blur
 *   · a selection, and ONE act that moves every selected row at once
 *   · a STALE MARK on rows nobody has touched for a long time, so staleness is on the face of the
 *     table rather than in a report about the table
 *   · a segmented control that changes which family is on screen
 *
 * B4 hands it costs in one column. C1 hands it prices in one column — a DATA delta, nothing else.
 * C2 hands it four, which is a COLUMN delta and the proof that D9 never produces a second screen.
 * The reduction counts all three against this one file, and it can because the file cannot tell
 * them apart.
 *
 * THE UNIT SHARES THE NUMBER'S LINE, in every cell, at 320px as well as at 1440px. A grid is
 * scanned rather than read, and a column of bare numbers over a «€/kg» sitting in a head somewhere
 * is exactly the mis-sale the law exists to stop — so the cell is a `Figure` and the Figure owns
 * its unit. The stage scrolls sideways at its minimum width; a cell never wraps.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE as BTN } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { HintDot, COLOR } from 'baseui/badge';
import { Input, SIZE as INPUT } from 'baseui/input';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import { Figure } from '../../rocoto/figure';

/* ── THE SHAPE OF A TABLE ─────────────────────────────────────────────────────────────────── */

export type GridColumn = {
  id: string;
  /** the column head */
  title: React.ReactNode;
  /** a quieter second line under the head — «12 customers», the tier's own count (C2/C4) */
  note?: React.ReactNode;
};

export type GridRow = {
  id: string;
  /** what the row is about. The caller passes a `<Name />`, so no name is typed here (law 10). */
  name: React.ReactNode;
  /** every value in this row is denominated in this — «€/kg», «€/caja» */
  unit: string;
  /** by column id */
  values: Record<string, number>;
  /** how long since anybody touched this row. The stale mark reads this and nothing else. */
  daysSinceTouched: number;
  /** which family the row belongs to; the segmented control filters on it */
  group?: string;
};

export type GridGroup = {
  id: string;
  title: string;
  /** how many rows stand on that shelf — read before it is pressed, so an empty shelf says so */
  count?: number;
};

export type GridProps = {
  columns: GridColumn[];
  rows: GridRow[];
  /** a cell was committed */
  onEdit: (rowId: string, columnId: string, next: number) => void;
  /** one act moved every selected row by a percentage */
  onBulk?: (rowIds: string[], percent: number) => void;
  /** rows untouched for longer than this carry the stale mark */
  staleAfterDays?: number;
  /** the families on offer. One family draws no control, because there is nothing to switch. */
  groups?: GridGroup[];
  group?: string;
  onGroup?: (id: string) => void;
  /** what the whole table holds, in three or four words */
  caption?: React.ReactNode;
  /** decimals in a cell. Money is 2. */
  decimals?: number;
  /** the width the table refuses to go below; the stage scrolls sideways instead of wrapping */
  minWidth?: number;
};

/** «7 months» · «3 days» — the age of a row, in the largest unit that still reads as a number. */
export function ageText(days: number): string {
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days`;
  const months = Math.round(days / 30);
  if (months < 18) return `${months} ${months === 1 ? 'month' : 'months'}`;
  return `${Math.round(days / 365)} years`;
}

/* ── THE CELL ─────────────────────────────────────────────────────────────────────────────────
 * Reading and editing are the same place. A click opens Base's own Input over the figure at the
 * figure's own size, and Enter or a blur commits — no edit mode, no save bar, no second screen. */

function Cell({
  value,
  unit,
  decimals,
  onCommit,
}: {
  value: number;
  unit: string;
  decimals: number;
  onCommit: (next: number) => void;
}) {
  const [, theme] = useStyletron();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  const open = () => {
    setDraft(String(value).replace('.', ','));
    setEditing(true);
  };

  const commit = () => {
    const next = parseFloat(draft.replace(',', '.'));
    setEditing(false);
    if (!Number.isNaN(next) && next !== value) onCommit(next);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        size={INPUT.compact}
        value={draft}
        onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        endEnhancer={unit}
        overrides={{ Root: { style: { width: '100%' } } }}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
      style={{
        textAlign: 'right',
        cursor: 'text',
        whiteSpace: 'nowrap',
        padding: `${theme.sizing.scale200} ${theme.sizing.scale300}`,
        borderRadius: theme.borders.radius200,
      }}
    >
      <Figure value={value} unit={unit} decimals={decimals} size="compact" />
    </div>
  );
}

/* ── THE TABLE ────────────────────────────────────────────────────────────────────────────── */

export default function Grid({
  columns,
  rows,
  onEdit,
  onBulk,
  staleAfterDays = 90,
  groups,
  group,
  onGroup,
  caption,
  decimals = 2,
  minWidth = 640,
}: GridProps) {
  const [, theme] = useStyletron();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [percent, setPercent] = React.useState('2,5');

  const shown = group ? rows.filter((r) => r.group === group) : rows;
  /* a selection survives a family switch only where the row survives it */
  const live = selected.filter((id) => shown.some((r) => r.id === id));
  const allOn = shown.length > 0 && live.length === shown.length;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  const apply = () => {
    const p = parseFloat(percent.replace(',', '.'));
    if (!onBulk || Number.isNaN(p) || live.length === 0) return;
    onBulk(live, p);
    setSelected([]);
  };

  const track = `${onBulk ? '34px ' : ''}minmax(180px, 1.4fr) ${columns
    .map(() => 'minmax(120px, 1fr)')
    .join(' ')} minmax(110px, 0.8fr)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      {/* ── the head of the surface: what this table holds, and which family is on it ── */}
      <div style={{ display: 'flex', gap: theme.sizing.scale600, alignItems: 'center', flexWrap: 'wrap' }}>
        {caption && (
          <span style={{ ...theme.typography.LabelMedium, flex: 1, minWidth: '14ch' }}>{caption}</span>
        )}
        {groups && groups.length > 1 && (
          <SegmentedControl
            activeKey={group ?? groups[0].id}
            onChange={({ activeKey }) => onGroup?.(String(activeKey))}
          >
            {groups.map((g) => (
              <Segment key={g.id} label={g.title} badge={g.count !== undefined ? String(g.count) : undefined} />
            ))}
          </SegmentedControl>
        )}
      </div>

      {/* ── ONE ACT MOVES EVERY SELECTED ROW. It stands above the table it changes, holds the
             count it will touch, and leaves when nothing is selected. ── */}
      {onBulk && live.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: theme.sizing.scale500,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: theme.sizing.scale400,
            borderRadius: theme.borders.radius300,
            background: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.borderOpaque}`,
          }}
        >
          <span style={theme.typography.LabelSmall}>
            {live.length} {live.length === 1 ? 'row' : 'rows'}
          </span>
          <div style={{ width: 132 }}>
            <Input
              size={INPUT.compact}
              value={percent}
              onChange={(e) => setPercent((e.target as HTMLInputElement).value)}
              endEnhancer="%"
              aria-label="move the selected rows by"
            />
          </div>
          <Button kind={KIND.primary} size={BTN.compact} onClick={apply}>
            Move them
          </Button>
          <Button kind={KIND.tertiary} size={BTN.compact} onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}

      {/* ── the table. It scrolls sideways at its minimum rather than wrapping a cell. ── */}
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            minWidth,
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            overflow: 'hidden',
          }}
        >
          {/* the column head */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: track,
              gap: theme.sizing.scale400,
              alignItems: 'end',
              padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
              background: theme.colors.backgroundSecondary,
              borderBottom: `1px solid ${theme.colors.borderOpaque}`,
            }}
          >
            {onBulk && (
              <Checkbox
                checked={allOn}
                isIndeterminate={live.length > 0 && !allOn}
                onChange={(e) =>
                  setSelected((e.target as HTMLInputElement).checked ? shown.map((r) => r.id) : [])
                }
                aria-label="every row on screen"
              />
            )}
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Product
            </span>
            {columns.map((c) => (
              <div key={c.id} style={{ textAlign: 'right' }}>
                <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {c.title}
                </div>
                {c.note && (
                  <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                    {c.note}
                  </div>
                )}
              </div>
            ))}
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
              Last moved
            </span>
          </div>

          {/* the rows */}
          {shown.map((row, i) => {
            const stale = row.daysSinceTouched >= staleAfterDays;
            const on = live.includes(row.id);
            return (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: track,
                  gap: theme.sizing.scale400,
                  alignItems: 'center',
                  padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
                  borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
                  background: on ? theme.colors.backgroundSecondary : 'transparent',
                }}
              >
                {onBulk && (
                  <Checkbox
                    checked={on}
                    onChange={(e) => toggle(row.id, (e.target as HTMLInputElement).checked)}
                    aria-label="this row"
                  />
                )}

                {/* THE STALE MARK rides the row's own name, because staleness is a fact about this
                    row and evidence rides the element it justifies (law 7). */}
                <div style={{ minWidth: 0, ...theme.typography.LabelSmall }}>
                  {stale ? (
                    /* the offsets push the dot CLEAR of the last letter. Base only supplies
                       defaults when the anchor is a bare string, and a mark sitting on top of the
                       word it marks reads as a rendering fault rather than as a fact. */
                    <HintDot color={COLOR.primary} horizontalOffset="-12px" verticalOffset="-2px">
                      <span>{row.name}</span>
                    </HintDot>
                  ) : (
                    row.name
                  )}
                </div>

                {columns.map((c) => (
                  <Cell
                    key={c.id}
                    value={row.values[c.id]}
                    unit={row.unit}
                    decimals={decimals}
                    onCommit={(next) => onEdit(row.id, c.id, next)}
                  />
                ))}

                <span
                  style={{
                    ...theme.typography.ParagraphXSmall,
                    color: stale ? theme.colors.contentPrimary : theme.colors.contentTertiary,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ageText(row.daysSinceTouched)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
