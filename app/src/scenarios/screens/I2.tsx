/* I2 · Check the delivery time the software inferred.
 *
 * THE INFERENCE IS THE AI'S OWN ACT, so it is the one place in P6 that carries saffron — and the
 * moment a hand corrects it the saffron LEAVES, because the value is now the person's. That
 * transition is the clearest statement of the colour law anywhere in this package: the accent is
 * not «important», it is «Rocoto did this».
 *
 * THE EVIDENCE IS WHAT THE PRODUCT COULD ACTUALLY KNOW — the customer's standing delivery days,
 * where their last deliveries landed, and when this order was placed. No confidence score: a
 * number between 0 and 1 tells a person nothing they can act on, and «14 of their last 16» tells
 * them everything.
 *
 * THE SECTOR CHANGES THE DEFAULT AND NOTHING ELSE. Fish delivers the morning it was ordered, fruit
 * the next day, meat on fixed weekly days. Same control, same evidence rows, three answers. The
 * rhythm table below is the one fact this card holds that `cast.ts` does not yet carry — it is a
 * per-account configuration, and when the founder confirms it, it moves into the cast and this
 * file loses four lines.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { TimePicker } from 'baseui/timepicker';
import adapter from 'baseui/datepicker/utils/date-fns-adapter';
import { FormControl } from 'baseui/form-control';
import type { ScenarioMeta, SectorId } from '../meta';
import DeskChassis from '../chassis/desk';
import InferredSlot from '../canonical/inferred-slot';
import { GLines, GRoute } from '../ghosts/regions';
import { useSector } from '../shell/context';
import { customerOf } from '../data/cast';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'I2',
  title: 'Check the delivery time the software inferred',
  group: 'I',
  frame: 'desk',
  ifText:
    'the albarán goes when the goods are confirmed delivered, and the scheduled time is the confirmation',
  dims: ['D16.on-delivery', 'D17.scheduled'],
  job: 'Read the delivery time Rocoto inferred, and correct it if it is wrong.',
  decides:
    'that an inferred value arrives with the evidence it stood on, and that correcting it hands the value to the person — the mark of the software leaves with the inference',
  inherits: [
    { region: 'the order this slot belongs to', ref: 'A1' },
    { region: "the customer's standing delivery days", ref: 'J1a' },
    { region: 'the round it joins', ref: 'I5' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
    { region: 'who puts the round in order', ref: 'OPEN-17' },
  ],
  primitives: [],
  kit: ['Time Picker', 'Form Control', 'Tag', 'Ghost'],
  canonical: 'inferred-slot',
  delta: 'origin',
  deltaText: 'the card that IS the inferred slot',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1],
  step: 10,
  fills: [],
  reads: ['record', 'order'],
  live:
    'move the Time Picker and the slot becomes yours — the saffron mark leaves and the evidence line names the correction; the sector switch changes the inferred default and leaves the control and the evidence rows exactly where they are',
};

/** THE DELIVERY RHYTHM, per account. Fish delivers the morning it was ordered; fruit the next
 *  morning; meat on the two fixed days a week a HORECA contract names. It belongs in `cast.ts` the
 *  day the founder confirms it — until then it lives here, where the card that uses it can say so. */
const RHYTHM: Record<SectorId, { hour: number; minute: number; days: string; recent: string; when: string }> = {
  fish: {
    hour: 9,
    minute: 0,
    days: 'Every morning',
    recent: 'Their last six arrived between 08:50 and 09:20',
    when: 'the same morning it was ordered',
  },
  meat: {
    hour: 10,
    minute: 30,
    days: 'Tuesday and Friday',
    recent: 'Their last six arrived between 10:15 and 11:00',
    when: 'their next contracted day',
  },
  fruit: {
    hour: 7,
    minute: 30,
    days: 'Monday to Saturday',
    recent: 'Their last six arrived between 07:20 and 08:05',
    when: 'the morning after it was ordered',
  },
};

const at = (h: number, m: number): Date => {
  const d = new Date(2026, 7, 22, h, m, 0, 0);
  return d;
};

const label = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function I2() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const rhythm = RHYTHM[cast.sector];
  const customer = customerOf(cast, cast.order.customer);

  const inferred = React.useMemo(() => at(rhythm.hour, rhythm.minute), [rhythm]);
  const [slot, setSlot] = React.useState<Date>(inferred);

  React.useEffect(() => setSlot(inferred), [inferred]);

  const corrected = label(slot) !== label(inferred);

  return (
    <DeskChassis selected={2} rows={10} height={760}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <InferredSlot
          title={<Name of={customer} />}
          subtitle={`${cast.order.deliveryDay} · ordered ${cast.order.placedAt}`}
          slot={label(slot)}
          inferred={label(inferred)}
          evidence={[
            { label: 'Delivery days', value: rhythm.days },
            { label: 'Last six drops', value: rhythm.recent },
            {
              label: 'This order',
              value: corrected
                ? `You set the slot at ${label(slot)}, and it stays there`
                : `Placed ${cast.order.placedAt}, for ${rhythm.when}`,
            },
          ]}
          control={
            <FormControl label="The slot">
              <TimePicker
                adapter={adapter}
                format="24"
                step={900}
                value={slot}
                onChange={(d) => { if (d) setSlot(d); }}
              />
            </FormControl>
          }
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
          {/* what is being delivered */}
          <GLines rows={3} />
          {/* the round this drop joins, and whoever put the stops in that order */}
          <GRoute rows={5} />
        </div>
      </div>
    </DeskChassis>
  );
}
