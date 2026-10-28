/* I3 · Mark stops as delivered.
 *
 * ONE-HANDED, IN A VEHICLE, POSSIBLY IN RAIN. Those conditions are the design, and everything on
 * the screen follows from them: today's stops in route order, targets large enough for a glove,
 * ONE gesture per stop, and the count that remains legible from the seat.
 *
 * THE GESTURE IS A SWIPE, NOT A TAP, and `la entrega` is the fork that makes it — Base's Sliding
 * Button with the STOP itself in the track and the whole row as the target. A tap is what a phone
 * does when it is dropped; a swipe across half the door is a decision.
 *
 * THE CONTROL DELTA IS PER CUSTOMER AND NEVER PER SECTOR (SECTORS §9). A stop that settles cash
 * carries an amount to collect and the control that records it; a stop on credit carries neither
 * — the flag lives on the customer in `cast.ts`. Run the sector switch and only the NUMBER OF ROWS
 * carrying the control changes: fruit has the most cash at the counter, fish and meat less. That
 * is the whole of the sector story on this card, and it is a data story.
 *
 * WHAT IS MISSING IN TWO SECTORS. A van carrying fish or meat is carrying a cold chain, and some
 * distributors record a temperature at the drop. Nothing in D17 or in the brief captures it, so
 * the round carries `OPEN-13` where that reading would stand.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import PhoneChassis from '../chassis/phone';
import DropList, { buildRound, type Stop } from '../canonical/drop-list';
import { GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'I3',
  title: 'Mark stops as delivered',
  group: 'I',
  frame: 'phone',
  ifText: 'drivers are recorded in Rocoto and each one sees their own stops in route order',
  dims: ['D16.on-delivery', 'D17.driver'],
  job: 'Mark each stop delivered at the door, one-handed.',
  decides:
    'the driver’s whole screen — stops in route order, one swipe per stop, the count that remains, and the cash stop’s second act',
  inherits: [
    { region: 'the albarán behind each stop', ref: 'G1' },
    { region: 'the signature', ref: 'I4' },
    { region: 'the distributor’s view of the same round', ref: 'I5' },
    { region: 'the delivery address', ref: 'J1a' },
  ],
  open: [
    { region: 'who put the stops in this order', ref: 'OPEN-17' },
    { region: 'the temperature at the door', ref: 'OPEN-13' },
  ],
  primitives: ['U15'],
  kit: ['la entrega', 'Figure', 'Button', 'Tag', 'Ghost'],
  canonical: 'drop-list',
  delta: 'origin',
  deltaText: 'the card that IS the drop list; I4 puts a pad on one of its stops',
  sector: { fish: '=', meat: '=', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1],
  step: 10,
  fills: ['drop.delivered'],
  reads: ['albarán', 'record.credit'],
  live:
    'swipe a stop across half the row and it is delivered — the count that remains drops by one; press Collect on a cash stop and the amount is settled; the sector switch changes how many rows carry that control',
};

export default function I3() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const stops = React.useMemo(() => buildRound(cast), [cast]);
  const [delivered, setDelivered] = React.useState<Record<string, string>>({});
  const [collected, setCollected] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setDelivered({});
    setCollected({});
  }, [cast.sector]);

  /* the clock the round is being run against — each stop is marked at the slot it was reached */
  const mark = (stop: Stop) => setDelivered((d) => ({ ...d, [stop.id]: stop.slot }));

  const cash = stops.filter((s) => s.collect !== undefined).length;

  return (
    <PhoneChassis
      height={660}
      width={380}
      placement="bottom"
      header={{ open: 17 }}
      behind={{ open: 17, label: 'the round' }}
      rows={3}
    >
      <DropList
        stops={stops}
        delivered={delivered}
        onDeliver={mark}
        collected={collected}
        onCollect={(stop) => setCollected((c) => ({ ...c, [stop.id]: true }))}
        title={cast.order.deliveryDay}
        foot={
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, paddingTop: theme.sizing.scale300 }}>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              {cash} {cash === 1 ? 'stop settles' : 'stops settle'} at the door today.
            </span>
            {/* the temperature some vans record at the drop — in neither D17 nor the brief */}
            <GRegion open={13} shape="line" height={12} label="the temperature at the door" />
          </div>
        }
      />
    </PhoneChassis>
  );
}
