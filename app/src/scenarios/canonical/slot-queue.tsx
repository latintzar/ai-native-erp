/* THE SLOT QUEUE — the canonical screen behind C6, and the product's answer to the 06:00
 * collision.
 *
 * U09: «items awaiting a value, grouped by customer, completed in one pass. The empty value is
 * shown as empty and never as zero.» That last clause is the whole component. A zero in a price
 * column is a number the product does not know, printed as if it did; every downstream total then
 * quietly believes it. So a slot that has no value yet DRAWS ITSELF EMPTY and says what it is
 * waiting for.
 *
 * ONE PRIMITIVE, TWO REASONS (BUILD-PLAN §3.1). A line can be waiting because no rule could
 * compute its price — `D8.negotiated`, where the price is agreed line by line — or because the
 * number exists in two hours: a `D8.margin` house that discovers its cost at the market cannot
 * stamp a price on an order confirmed at 06:00, and the copy law forbids showing a number the
 * product does not know. Both are the same screen and the same pass, so the queue carries BOTH
 * reason lines and each row says which one put it there.
 *
 * THE EVIDENCE RIDES THE ROW (law 7). What this customer last paid, and the margin last agreed
 * with them, sit on the row they justify — never in a panel above the table.
 *
 * P4 owns this file. C6 is its origin and, so far, its only instantiation.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { ButtonDock } from 'baseui/button-dock';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Figure } from '../../rocoto/figure';
import type { Cast, Customer, Product } from '../data/cast';
import Name from '../shell/Name';

/* ── THE SLOT ─────────────────────────────────────────────────────────────────────────────── */

/** Why a line is waiting. Both reasons are the same primitive; the row says which one it is. */
export type SlotReason = 'agreed' | 'cost-pending';

export type Slot = {
  id: string;
  product: Product;
  qty: number;
  /** the unit the quantity is in */
  unit: string;
  /** why this line has no price yet */
  reason: SlotReason;
  /** what this customer last paid for it, per unit — the evidence that orders the guess */
  lastPrice?: number;
  /** the margin last agreed with this customer, in points */
  lastMargin?: number;
  /** today's cost per unit, where it is already known */
  cost?: number;
};

/** The value in a slot. `undefined` is EMPTY and is drawn empty; there is no zero here. */
export type SlotValues = Record<string, number | undefined>;

export const filledCount = (slots: Slot[], values: SlotValues): number =>
  slots.filter((s) => values[s.id] !== undefined).length;

/** What the pass is worth once it is complete — computed only over the slots that have a value,
 *  so an unfinished pass never quotes a total that assumes an empty slot is free. */
export const passValue = (slots: Slot[], values: SlotValues): number =>
  slots.reduce((sum, s) => sum + (values[s.id] === undefined ? 0 : (values[s.id] as number) * s.qty), 0);

/* ── THE ROW ──────────────────────────────────────────────────────────────────────────────── */

const REASON_TEXT: Record<SlotReason, string> = {
  agreed: 'Agreed line by line',
  'cost-pending': 'Waiting on this morning’s cost',
};

function SlotRow({
  slot,
  value,
  onChange,
  index,
}: {
  slot: Slot;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  index: number;
}) {
  const [, theme] = useStyletron();
  const empty = value === undefined;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto auto auto minmax(150px, 190px)',
        gap: theme.sizing.scale600,
        alignItems: 'center',
        padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
        borderTop: index === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={theme.typography.LabelMedium}>
          <Name of={slot.product} />
        </div>
        <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {REASON_TEXT[slot.reason]}
        </div>
      </div>

      <Figure value={slot.qty} unit={slot.unit} decimals={slot.unit === 'kg' ? 1 : 0} size="compact" />

      {/* THE EVIDENCE, on the row it justifies. Never a confidence score; what they last paid. */}
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {slot.lastPrice !== undefined ? (
          <>
            <Figure value={slot.lastPrice} unit={`€/${slot.product.unit}`} size="compact" />
            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
              last time
            </div>
          </>
        ) : null}
      </div>

      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {slot.lastMargin !== undefined ? (
          <>
            <span style={theme.typography.LabelSmall}>{slot.lastMargin}%</span>
            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
              margin agreed
            </div>
          </>
        ) : null}
      </div>

      {/* THE SLOT. Empty is empty: no placeholder number, no zero, and the state says so in a
          word. The unit shares the number's line, as an end enhancer inside the field. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
        <Input
          size={INPUT_SIZE.compact}
          value={empty ? '' : String(value)}
          type="number"
          inputMode="decimal"
          endEnhancer={`€/${slot.product.unit}`}
          aria-label={`price for ${slot.product.name}`}
          onChange={(e) => {
            const raw = (e.target as HTMLInputElement).value;
            onChange(raw === '' ? undefined : Number(raw));
          }}
        />
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
          {empty ? 'Waiting for a price' : `${(slot.qty * (value as number)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € on the line`}
        </span>
      </div>
    </div>
  );
}

/* ── THE SCREEN ───────────────────────────────────────────────────────────────────────────── */

export type SlotQueueProps = {
  cast: Cast;
  /** the one customer this pass belongs to. U09 groups by customer, and so does the screen. */
  customer: Customer;
  /** the day the lines are for */
  day: string;
  /** the reason lines — one per configuration that fills this queue. Both are drawn. */
  reasons: React.ReactNode[];
  slots: Slot[];
  values: SlotValues;
  onChange: (values: SlotValues) => void;
  /** what commits the whole pass */
  commit: React.ReactNode;
  /** what stands beside the queue */
  aside?: React.ReactNode;
};

export default function SlotQueue({
  cast,
  customer,
  day,
  reasons,
  slots,
  values,
  onChange,
  commit,
  aside,
}: SlotQueueProps) {
  const [, theme] = useStyletron();
  const filled = filledCount(slots, values);
  const waiting = slots.length - filled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      <header style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={theme.typography.HeadingSmall}>
            <Name of={customer} />
          </div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {day} · {customer.tier} · {cast.label}
          </div>
        </div>
        <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
          {waiting > 0 ? `${waiting} slots open` : 'Every line priced'}
        </Tag>
      </header>

      {/* BOTH REASON LINES, on the one screen. One primitive answers «no rule could compute this»
          and «the number exists in two hours», and the founder should see both at once. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
        {reasons.map((r, i) => (
          <div
            key={i}
            style={{
              borderLeft: `3px solid ${theme.colors.contentPrimary}`,
              paddingLeft: theme.sizing.scale500,
              ...theme.typography.ParagraphSmall,
            }}
          >
            {r}
          </div>
        ))}
      </div>

      {/* THE PASS. Tab moves from slot to slot in the browser's own order, which is the order the
          rows are printed in — the pass is one column of hands, top to bottom. */}
      <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
        {slots.map((slot, i) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            index={i}
            value={values[slot.id]}
            onChange={(next) => onChange({ ...values, [slot.id]: next })}
          />
        ))}
      </div>

      {/* THE PASS'S OWN TOTAL follows the same law as the slots it is made of: a sum over empty
          slots is a number the product does not know, so it stands empty until one is filled and
          then counts only what has landed. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
          {filled} of {slots.length} priced
        </span>
        {filled > 0 ? (
          <Figure value={passValue(slots, values)} unit="€" size="large" />
        ) : (
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary }}>
            The pass adds up as prices land
          </span>
        )}
      </div>

      <ButtonDock primaryAction={commit} />

      {aside}
    </div>
  );
}
