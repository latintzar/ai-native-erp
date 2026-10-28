/* THE BATCH LINE — the canonical screen behind E1 and E2.
 *
 * ONE LINE OF AN ORDER, AND THE LOTES IT DRAWS ON. The reduction claims E1 and E2 are one screen
 * (S11) and that the delta is a control: E1 has no boundary because there is nothing to divide,
 * E2 has one because the line outgrew a single lote. Both render this file; E1 passes no `divide`
 * and E2 passes `el reparto`. That is the whole difference, and it is one prop.
 *
 * THE LAW THIS SCREEN CARRIES. A division of a quantity across lotes cannot create or lose units
 * (U04). The fork enforces it by construction — the parts ARE the gaps between the boundaries —
 * so this screen never validates a sum, and the number under the line stays the number the
 * customer ordered no matter how hard the boundary is dragged.
 *
 * WHAT IS FULL FIDELITY HERE AND WHAT IS NOT. The line and its lotes are the subject. The order
 * around the line belongs to A1 and the ledger the lotes live in is OPEN-5; both are pointered
 * greys supplied by the cards, never drawn here.
 *
 * P5 owns this file.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Tag, KIND as TAG_KIND, HIERARCHY, SIZE as TAG_SIZE } from 'baseui/tag';
import { Figure } from '../../rocoto/figure';
import type { Cast, OrderLine } from '../data/cast';
import { batchOf, productOf, supplierOf, lineFacts } from '../data/cast';
import Name from '../shell/Name';
import RefChip from '../shell/RefChip';

/** One part of the line: a lote, and how much of the line comes out of it. */
export type Allocation = { batch: string; qty: number };

/* ── THE ARITHMETIC, exported so the cards read it rather than repeat it ───────────────────── */

/** What the line cost, per unit, across every lote it draws on. Two vessels at two prices make
 *  one number, and that number is what the margin is against. */
export const blendedCost = (cast: Cast, allocations: Allocation[]): number => {
  const total = allocations.reduce((s, a) => s + a.qty, 0);
  if (total === 0) return 0;
  const spend = allocations.reduce((s, a) => s + a.qty * (batchOf(cast, a.batch)?.cost ?? 0), 0);
  return spend / total;
};

/** The margin the line carries at that blended cost, as a share of the price. */
export const marginOn = (price: number, cost: number): number =>
  price === 0 ? 0 : ((price - cost) / price) * 100;

/** The lote a line fills itself from when nobody chooses: the oldest one holding that product. */
export const oldestBatchFor = (cast: Cast, productId: string): string | undefined =>
  cast.batches
    .filter((b) => b.product === productId)
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))[0]?.id;

/* ── THE SCREEN ───────────────────────────────────────────────────────────────────────────── */

export type BatchLineProps = {
  cast: Cast;
  /** the line being filled */
  line: OrderLine;
  /** the lotes it comes out of. One is E1; two or more is E2. */
  allocations: Allocation[];
  /** the boundary control. E2 hands in `el reparto`; E1 hands in nothing, because a line that
   *  fits in one lote has no boundary and therefore no control (that IS E1's subject). */
  divide?: React.ReactNode;
  /** the control that adds a part, under the division */
  action?: React.ReactNode;
  /** what the division cost, and the margin it leaves. E2 reads `cost`; E1 reads only `lot`. */
  showCost?: boolean;
  /** the lote opened in place — a row is a door, forward and sideways */
  openBatch?: string | null;
  onOpenBatch?: (id: string | null) => void;
  /** the one line of ink that states how this line was filled */
  note?: React.ReactNode;
  /** WHERE THE OPENED LOTE LEADS. The catalogue points at E3 with a cross-reference chip, and
   *  that is this prop's default. The app holds the batch record on the same surface, so it hands
   *  in its own way there instead. Additive: left off, the chip is exactly what E1 and E2 draw. */
  renderBatchLink?: (batchId: string) => React.ReactNode;
};

export default function BatchLine({
  cast,
  line,
  allocations,
  divide,
  action,
  showCost = false,
  openBatch = null,
  onOpenBatch,
  note,
  renderBatchLink,
}: BatchLineProps) {
  const [, theme] = useStyletron();
  const product = productOf(cast, line.product);
  const facts = lineFacts(cast, product);
  const cost = blendedCost(cast, allocations);
  const margin = marginOn(line.price, cost);

  return (
    <section
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      {/* ── the line, exactly as A1 draws a line, because it is the same line ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto auto',
          gap: theme.sizing.scale600,
          alignItems: 'baseline',
          padding: theme.sizing.scale600,
          borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={theme.typography.LabelMedium}>
            <Name of={product} />
          </div>
          {facts.length > 0 && (
            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              {facts.map((f) => `${f.label} ${f.value}`).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ whiteSpace: 'nowrap' }}>
          <Figure value={line.qty} unit={line.unit} decimals={line.unit === 'kg' ? 1 : 0} size="compact" />
        </div>
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <Figure value={line.qty * line.price} unit="€" size="compact" />
          <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            {line.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/{product.unit}
          </div>
        </div>
      </div>

      {/* ── the lotes it comes out of ── */}
      <div style={{ padding: theme.sizing.scale600, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
        {note && (
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {note}
          </p>
        )}

        {divide}

        {/* every part, as a row that opens */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {allocations.map((a, i) => {
            const batch = batchOf(cast, a.batch);
            const open = openBatch === a.batch;
            return (
              <div key={a.batch} style={{ borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}` }}>
                <div
                  role={onOpenBatch ? 'button' : undefined}
                  tabIndex={onOpenBatch ? 0 : undefined}
                  onClick={onOpenBatch ? () => onOpenBatch(open ? null : a.batch) : undefined}
                  onMouseEnter={onOpenBatch ? () => onOpenBatch(a.batch) : undefined}
                  onKeyDown={
                    onOpenBatch
                      ? (e) => { if (e.key === 'Enter') onOpenBatch(open ? null : a.batch); }
                      : undefined
                  }
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                    gap: theme.sizing.scale500,
                    alignItems: 'baseline',
                    padding: `${theme.sizing.scale400} 0`,
                    cursor: onOpenBatch ? 'pointer' : 'default',
                  }}
                >
                  <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary} size={TAG_SIZE.small}>
                    {a.batch}
                  </Tag>
                  <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
                    {batch ? (
                      <>
                        <Name of={supplierOf(cast, batch.supplier)} /> · landed {batch.day} · {batch.qty} {product.unit} on hand
                      </>
                    ) : null}
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <Figure value={a.qty} unit={line.unit} decimals={line.unit === 'kg' ? 1 : 0} size="compact" />
                  </span>
                </div>

                {/* the lote, opened in place. What it holds is E3's subject; this is the door. */}
                {open && batch && (
                  <div
                    style={{
                      background: theme.colors.backgroundSecondary,
                      borderRadius: theme.borders.radius200,
                      padding: theme.sizing.scale500,
                      marginBottom: theme.sizing.scale400,
                      display: 'flex',
                      gap: theme.sizing.scale600,
                      alignItems: 'baseline',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ ...theme.typography.ParagraphSmall }}>
                      {batch.qty} {product.unit} landed {batch.day} from{' '}
                      <Name of={supplierOf(cast, batch.supplier)} />
                    </span>
                    {renderBatchLink ? (
                      renderBatchLink(a.batch)
                    ) : (
                      <RefChip to="E3">everything this lote carries</RefChip>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {action}

        {/* ── what the division costs. The margin moves while the boundary does. ── */}
        {showCost && (
          <div
            style={{
              display: 'flex',
              gap: theme.sizing.scale700,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              paddingTop: theme.sizing.scale500,
            }}
          >
            <Slot label={allocations.length > 1 ? 'Blended cost' : 'Cost'}>
              <Figure value={cost} unit={`€/${product.unit}`} size="default" />
            </Slot>
            <Slot label="Sold at">
              <Figure value={line.price} unit={`€/${product.unit}`} size="default" />
            </Slot>
            <Slot label="Margin">
              <Figure value={margin} unit="%" decimals={1} size="large" />
            </Slot>
          </div>
        )}
      </div>
    </section>
  );
}

/** A label above a figure. The label names the number; the unit stays on the number's own line. */
function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <span style={{ whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}
