/* THE DUAL VALUE — the canonical screen behind F1 and F3, and the catalogue's best unification.
 *
 * `U10` says: two related values on one line, both kept and both shown. The brief names two pairs
 * and the trade supplies a third:
 *
 *   ordered → sent      F1, a scale in the warehouse                    (fish, meat)
 *   grade held → sold   F3, class B on the shelf leaving as class A     (fruit)
 *   caja → kg           the market buys in packs and the customer in kg (all three)
 *
 * THEY ARE ONE LOCKUP. The first value is struck and kept, the second stands beside it, and which
 * pair appears is the sector rather than the screen (C-4). A dispatch surface drawn as a whole
 * -order weighing mode serves fish alone and has to be rebuilt for meat, so the weigh state is
 * PER LINE: a media canal that must be weighed and a caja de chorizo that must not sit on adjacent
 * rows, and the line that takes no weight carries a plain figure and no input.
 *
 * THE SUPERSEDE LAW LIVES IN `Figure`. Where both sides are numbers in the same unit, the pair IS
 * Base-grown `Figure`'s own `was` lockup, so a struck value looks identical here, on A7's converted
 * quantity and on B1's yesterday. Where the units differ — 8 cajas → 32 kg — the two figures stand
 * side by side, each with its unit on its own number's line, and no new control appears.
 *
 * P5 owns this file.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Figure } from '../../rocoto/figure';
import RefChip from '../shell/RefChip';

/** One side of the pair. A number carries a unit; a word carries a name. */
export type Side = {
  value: number | string;
  /** shares the number's own line, always */
  unit?: string;
  decimals?: number;
};

const isNumber = (s: Side): s is Side & { value: number } => typeof s.value === 'number';

/* ── THE LOCKUP ───────────────────────────────────────────────────────────────────────────────
 * Exported, because it is the SHARED LOCKUP the reduction files under C-5: A7 carries it on a
 * converted quantity, F1 on a weight and F3 on a grade. One shape, three screens. */

export function Pair({ from, to, size = 'default' }: { from: Side; to?: Side; size?: 'compact' | 'default' | 'large' }) {
  const [, theme] = useStyletron();

  /* the value that stands alone: this line has one number and it is finished */
  if (!to) {
    return isNumber(from) ? (
      <Figure value={from.value} unit={from.unit} decimals={from.decimals ?? 0} size={size} />
    ) : (
      <span style={theme.typography.LabelMedium}>{from.value}</span>
    );
  }

  /* both sides numbers in the same unit — Figure's own supersede lockup, unchanged */
  if (isNumber(from) && isNumber(to) && from.unit === to.unit) {
    return (
      <Figure
        value={to.value}
        was={from.value}
        unit={to.unit}
        decimals={to.decimals ?? from.decimals ?? 0}
        size={size}
      />
    );
  }

  /* the units differ, or the values are words. The same shape by hand: the first struck and kept,
     the second standing, and each unit on its own number's line.
     The struck side is drawn as ONE piece of text rather than as a Figure, because a strike drawn
     across a component is a strike that can silently fail to cross it — the rule has to belong to
     the same text node as the characters it crosses out. */
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: theme.sizing.scale300, whiteSpace: 'nowrap' }}>
      <span
        aria-hidden="true"
        style={{
          ...theme.typography.ParagraphSmall,
          textDecoration: 'line-through',
          color: theme.colors.contentTertiary,
        }}
      >
        {isNumber(from)
          ? from.value.toLocaleString('es-ES', {
              minimumFractionDigits: from.decimals ?? 0,
              maximumFractionDigits: from.decimals ?? 0,
            })
          : from.value}
        {from.unit ? ` ${from.unit}` : ''}
      </span>
      {isNumber(to) ? (
        <Figure value={to.value} unit={to.unit} decimals={to.decimals ?? 0} size={size} />
      ) : (
        <span style={theme.typography.LabelMedium}>{to.value}</span>
      )}
    </span>
  );
}

/* ── THE SCREEN ───────────────────────────────────────────────────────────────────────────── */

export type DualRow = {
  id: string;
  /** the product, drawn through `Name` by the card that owns the data */
  title: React.ReactNode;
  /** the family's own facts under the name — the same secondary row A1 draws */
  facts?: React.ReactNode;
  /** the value the line arrived with */
  from: Side;
  /** the value that leaves. Absent until it is captured. */
  to?: Side;
  /** the control that captures the second value. Absent means this line has no second value at
   *  all — which is the per-line weigh state, and it is why this list serves a mixed order. */
  control?: React.ReactNode;
  /** what the pair does to the money, on the row it happened on */
  consequence?: React.ReactNode;
};

export type DualValueProps = {
  /** the surface's own name */
  heading: React.ReactNode;
  /** who and when — the order this dispatch belongs to */
  standfirst?: React.ReactNode;
  /** the pair's two names, on the head of the list */
  pair: { from: string; to: string };
  rows: DualRow[];
  /** what the pass adds up to */
  foot?: React.ReactNode;
  /** the gesture that ends the pass */
  action?: React.ReactNode;
};

export default function DualValue({ heading, standfirst, pair, rows, foot, action }: DualValueProps) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      <header style={{ minWidth: 0 }}>
        <div style={theme.typography.HeadingXSmall}>{heading}</div>
        {standfirst && (
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {standfirst}
          </div>
        )}
      </header>

      {/* the pair, named once, at the head of the list it governs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.sizing.scale300,
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        <span>{pair.from}</span>
        <span aria-hidden="true">→</span>
        <span>{pair.to}</span>
      </div>

      <div
        style={{
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          overflow: 'hidden',
          background: theme.colors.backgroundPrimary,
        }}
      >
        {rows.map((row, i) => (
          <div
            key={row.id}
            style={{
              borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
              padding: theme.sizing.scale500,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale300,
            }}
          >
            <div style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={theme.typography.LabelMedium}>{row.title}</div>
                {row.facts && (
                  <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                    {row.facts}
                  </div>
                )}
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <Pair from={row.from} to={row.to} />
              </div>
            </div>

            {row.control}
            {row.consequence}
          </div>
        ))}
      </div>

      {foot}
      {action}
    </div>
  );
}

/* ── THE SECTOR WHERE THE SCREEN DOES NOT EXIST ───────────────────────────────────────────────
 * F1 in fruit and F3 in fish and meat. Group K's law applies inside a card as well as on a rail:
 * the surface is gone, and what stands in its place is a sentence about what the day does instead
 * plus the door to the card that does the work. */

export function Absent({
  title,
  because,
  instead,
}: {
  /** what the day does instead, as a heading that names it */
  title: React.ReactNode;
  /** the configuration that produced the absence */
  because: React.ReactNode;
  /** the card that carries the warehouse decision in this sector */
  instead: { ref: string; region: string };
}) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        padding: theme.sizing.scale700,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale400,
        minWidth: 0,
      }}
    >
      <div style={theme.typography.HeadingXSmall}>{title}</div>
      <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
        {because}
      </p>
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        <RefChip to={instead.ref}>{instead.region}</RefChip>
        <RefChip to="K">the rail this destination left</RefChip>
      </div>
    </div>
  );
}
