/* C6 · Price everything waiting for one customer.
 *
 * The empty-slot queue, and with it the product's answer to the 06:00 collision. An order
 * confirmed before the morning's cost has landed cannot carry a price, and the copy law forbids
 * printing a number the product does not know — so the line holds an EMPTY SLOT, shown empty and
 * never as zero, and the morning is finished in one pass when the cost arrives.
 *
 * POSITIVE SPACE. Every line waiting on a price for one customer, with that customer's last price
 * and last agreed margin on the row as evidence, completed in one pass, and committed once.
 *
 * TWO REASON LINES, ONE SCREEN (BUILD-PLAN §3.1). `D8.negotiated` fills this queue because no rule
 * could compute the price. A `D8.margin` house on `D7.market-voice` fills the same queue at 06:15
 * because the cost had not been discovered when the order was confirmed. One primitive answers
 * both, so both reasons are drawn — and every row says which one put it there.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { SnackbarElement } from 'baseui/snackbar';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import SlotQueue, { filledCount, type Slot, type SlotValues } from '../canonical/slot-queue';
import { GLines } from '../ghosts/regions';
import { customerOf, productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C6',
  title: 'Price everything waiting for one customer',
  group: 'C',
  frame: 'desk',
  ifText:
    'lines are waiting on a price — agreed with the customer each time, or stamped before the morning’s cost had landed',
  dims: ['D8.negotiated', 'D8.margin', 'D7.market-voice'],
  job: 'Give every waiting line of one customer its price, in one pass.',
  decides:
    'that a line with no price yet holds an empty slot rather than a zero, and that a customer’s waiting lines are finished in one pass with what they last paid on the row',
  inherits: [
    { region: 'the order’s lines', ref: 'A1' },
    { region: 'the customer dossier', ref: 'J1a' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: ['U09'],
  kit: ['Input', 'Button Dock', 'Button', 'Tag', 'Snackbar', 'Figure', 'Ghost'],
  canonical: 'slot-queue',
  delta: 'origin',
  deltaText: 'the card that IS the empty-slot queue; both reasons for an empty slot land on it',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [2],
  step: 5,
  fills: ['price'],
  reads: ['cost', 'record'],
  live:
    'tab from slot to slot and each one stays visibly empty until it is filled; the line total and the pass total appear as a price lands; the dock commits the whole pass at once',
};

export default function C6() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const customer = customerOf(cast, cast.order.customer);

  /* The queue, built from the cast: this customer's own lines, plus the rest of the sector's
     catalogue waiting behind them. Every name comes out of `cast.ts`; the quantities and the
     evidence are the queue's own arithmetic. */
  const slots: Slot[] = React.useMemo(() => {
    const fromOrder: Slot[] = cast.order.lines.map((l, i) => {
      const product = productOf(cast, l.product);
      const batch = cast.batches.find((b) => b.product === product.id);
      return {
        id: l.id,
        product,
        qty: l.qty,
        unit: l.unit,
        /* the first two came off an order confirmed before the cost landed; the rest are agreed */
        reason: i < 2 ? ('cost-pending' as const) : ('agreed' as const),
        lastPrice: Math.round(l.price * 0.96 * 100) / 100,
        lastMargin: 24 + i * 3,
        cost: batch?.cost,
      };
    });
    const others: Slot[] = cast.products.slice(3, 5).map((product, i) => {
      const batch = cast.batches.find((b) => b.product === product.id);
      return {
        id: `w${i}`,
        product,
        qty: 4 + i * 2,
        unit: product.unit,
        reason: 'agreed' as const,
        lastPrice: batch ? Math.round(batch.cost * 1.3 * 100) / 100 : undefined,
        lastMargin: 30 - i * 2,
        cost: batch?.cost,
      };
    });
    return [...fromOrder, ...others];
  }, [cast]);

  const [values, setValues] = React.useState<SlotValues>({});
  const [committed, setCommitted] = React.useState(false);
  /* a different sector is a different account and a different morning */
  React.useEffect(() => { setValues({}); setCommitted(false); }, [cast.sector]);

  const filled = filledCount(slots, values);
  const complete = filled === slots.length;

  return (
    <DeskChassis dossier selected={1} rows={11} height={920}>
      <SlotQueue
        cast={cast}
        customer={customer}
        day={cast.order.deliveryDay}
        reasons={[
          <>
            <strong>D8.negotiated</strong> — the price on these lines is agreed with{' '}
            {customer.name} each time an order is placed, so a rule has none to give.
          </>,
          <>
            <strong>D8.margin with D7.market-voice</strong> — the order was confirmed at{' '}
            {cast.order.placedAt} and the cost landed at {cast.hour}. These lines held their slot
            open until the number existed.
          </>,
        ]}
        slots={slots}
        values={values}
        onChange={(next) => { setValues(next); setCommitted(false); }}
        commit={
          <Button
            kind={KIND.primary}
            size={SIZE.large}
            disabled={!complete}
            onClick={() => setCommitted(true)}
          >
            {complete ? `Stamp ${slots.length} lines` : `${slots.length - filled} slots to go`}
          </Button>
        }
        aside={
          <div style={{ marginTop: theme.sizing.scale500 }}>
            {/* the second write, made visible: the pass names what it closed */}
            {committed && (
              <SnackbarElement
                message={`${slots.length} lines stamped for ${customer.name}. The pass is closed.`}
                actionMessage="Open the orders"
                actionOnClick={() => { window.location.hash = '#/A1'; }}
              />
            )}
            {/* the orders these lines belong to — A1 owns the anatomy */}
            <GLines rows={4} />
          </div>
        }
      />
    </DeskChassis>
  );
}
