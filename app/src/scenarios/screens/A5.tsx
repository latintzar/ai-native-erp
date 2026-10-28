/* A5 · Approve an unusually large order.
 *
 * POSITIVE SPACE. What «unusual» is made of on screen: this customer's own normal beside today's
 * figure, the last ten orders drawn so the normal is a shape and not a claim, and the ONE control
 * that lets it through.
 *
 * THE SECTOR DELTA IS THE UNIT, AND IT IS A REAL ONE. A threshold in euros is meaningless where
 * the cost moves every morning — in fish it would fire on every cheap-merluza day and stay silent
 * on an expensive one, which is the opposite of what it is for. So a fish house and a meat house
 * count the threshold in KILOS and a fruit house in CAJAS, and the switch above the card moves the
 * unit on the reason line, on both figures and on the chart's own title. The brief gives `D2` no
 * unit; this card is where that shows (BUILD-PLAN §11 Q5).
 *
 * ONE CONTROL. A1 ends its decision with a hold, because confirming a whole order should cost a
 * second of intent. A5 ends its decision with a single press, because the person is not confirming
 * the order — they are letting a threshold through, and the order is confirmed after them.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import type { ScenarioMeta, SectorId } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { OrderState } from '../canonical/order-surface';
import { GThread } from '../ghosts/regions';
import { Figure } from '../../rocoto/figure';
import { BarChart } from '../../rocoto/charts';
import { customerOf, productOf, type Cast, type Order, type OrderLine, type Product } from '../data/cast';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A5',
  title: 'Approve an unusually large order',
  group: 'A',
  frame: 'desk',
  ifText: 'orders above a quantity are held, and this one is above it',
  dims: ['D2.threshold'],
  job: 'Let an unusually large order through, with what makes it unusual on the screen beside it.',
  decides:
    "what «unusual» is made of — this customer's own normal, today's figure in the same unit, and the last ten orders behind both — and the single control that lets it through",
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'the lines and their anatomy', ref: 'A1' },
    { region: 'the dossier the normal is read from', ref: 'J1a' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: [],
  kit: ['Bar Chart', 'Figure', 'Button', 'Message', 'Transcript', 'Overlay Card', 'Tag', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: 'an evidence block above the lines, and one let-it-through press instead of the hold',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1],
  step: 2,
  fills: ['order'],
  reads: ['record'],
  live:
    "press Let it through and the order commits, its state changes and the control leaves; hover a bar for that order's figure; the sector switch changes the unit the threshold is counted in, which is the card's argument",
};

/* ── THE THRESHOLD'S UNIT ─────────────────────────────────────────────────────────────────────
 * The configuration the brief does not supply. Weighed houses count kilos; a fruit house counts
 * boxes, because a caja is what leaves the building and what the customer asks in. */
const THRESHOLD_UNIT: Record<SectorId, string> = { fish: 'kg', meat: 'kg', fruit: 'cajas' };

const KILO = 'kg';

/** The line in kilos. `pack.factor` in `cast.ts` counts KILOS IN ONE PACK — a caja de Merluza is
 *  6,5 kg, a caja de chorizo sarta 5 kg, a pieza of media canal 42 kg — so a line already in kilos
 *  is itself, and a line bought by the pack multiplies. */
const kilos = (p: Product, l: OrderLine): number => (l.unit === KILO ? l.qty : l.qty * (p.pack ? p.pack.factor : 1));

/** The line in boxes. The customer's own figure where they gave one — `wasQty` is exactly that,
 *  under A7's supersede law — and otherwise the pack divides the weight. */
const cajas = (p: Product, l: OrderLine): number =>
  l.wasQty !== undefined ? l.wasQty : p.pack && p.pack.unit !== l.unit ? l.qty / p.pack.factor : l.qty;

const sizeOf = (cast: Cast, order: Order, unit: string): number =>
  order.lines.reduce((sum, l) => {
    const p = productOf(cast, l.product);
    return sum + (unit === KILO ? kilos(p, l) : cajas(p, l));
  }, 0);

/** How much bigger today is. One number, applied to every line, so today's order is this
 *  customer's own order at four times the size rather than an invented one. */
const TIMES = 4;

/** The nine Fridays before this one, and the variation their sizes carry. Data, so the chart is
 *  the same shape under every sector and only its scale and its unit move. */
const PAST = [
  { day: '20.06', factor: 0.92 },
  { day: '27.06', factor: 1.08 },
  { day: '04.07', factor: 0.84 },
  { day: '11.07', factor: 1.12 },
  { day: '18.07', factor: 1.0 },
  { day: '25.07', factor: 0.96 },
  { day: '01.08', factor: 1.16 },
  { day: '08.08', factor: 0.88 },
  { day: '15.08', factor: 1.04 },
];

export default function A5() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [committed, setCommitted] = React.useState(false);
  React.useEffect(() => { setCommitted(false); }, [cast.sector]);

  const unit = THRESHOLD_UNIT[cast.sector];
  const customer = customerOf(cast, cast.order.customer);
  const usual = sizeOf(cast, cast.order, unit);
  const threshold = Math.round(usual * 2);

  /* the same order at four times the size, and IN THE UNIT THE CUSTOMER ASKED IN — the conversion
     lockup is A7's subject, and borrowing it here would put a second argument on the card */
  const lines = cast.order.lines.map((l) => ({ ...l, qty: l.qty * TIMES, wasQty: undefined }));

  /* the message has to be the message that PRODUCED these lines — a card whose words say 12 kg
     over an order of 48 kg has quietly stopped being one situation */
  const asked = lines
    .map((l) => `${l.qty} ${l.unit} ${productOf(cast, l.product).name}`)
    .join(', ');
  const reasonGiven = 'We have a wedding on Saturday.';

  const order: Order = {
    ...cast.order,
    lines,
    words: [`For ${cast.order.deliveryDay}: ${asked}.`, reasonGiven],
    utterances: [
      { at: 0, text: `For ${cast.order.deliveryDay}: ${asked}.` },
      { at: 4200, text: reasonGiven },
    ],
  };
  const today = sizeOf(cast, order, unit);

  const bars = [
    ...PAST.map((p) => ({ label: p.day, value: Math.round(usual * p.factor) })),
    { label: 'Today', value: Math.round(today) },
  ];

  return (
    <DeskChassis dossier selected={1} rows={11} height={1020}>
      {/* the evidence chart wants room for all ten of its labels — the stage scrolls sideways
          before the positive space is crushed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: theme.sizing.scale600, minWidth: 740 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={cast}
            order={order}
            state={committed ? <OrderState>Confirmed</OrderState> : <OrderState>Waiting on you</OrderState>}
            reason={
              <>
                Orders above {threshold} {unit} are held for you. Today is {Math.round(today)} {unit}.
              </>
            }
            /* ── THE EVIDENCE, ABOVE THE LINES IT EXPLAINS ─────────────────────────────────────
               Two figures in the threshold's own unit, and the ten orders they are drawn from. No
               score, no percentage: the shape of ten Fridays is what makes today unusual. */
            aside={
              <div
                style={{
                  border: `1px solid ${theme.colors.borderOpaque}`,
                  borderRadius: theme.borders.radius300,
                  padding: theme.sizing.scale500,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.sizing.scale500,
                }}
              >
                <div style={{ display: 'flex', gap: theme.sizing.scale800, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Their usual Friday
                    </div>
                    <Figure value={usual} unit={unit} decimals={0} size="default" />
                  </div>
                  <div>
                    <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Today
                    </div>
                    <Figure value={Math.round(today)} was={usual} unit={unit} decimals={0} size="default" />
                  </div>
                  <div>
                    <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Held above
                    </div>
                    <Figure value={threshold} unit={unit} decimals={0} size="default" />
                  </div>
                </div>
                <BarChart
                  title={`${customer.name}'s last ten orders · ${unit}`}
                  data={bars}
                  emphasis="Today"
                  unit={unit}
                  decimals={0}
                  height={180}
                />
              </div>
            }
            primary={
              committed ? undefined : (
                <Button kind={KIND.primary} size={SIZE.large} onClick={() => setCommitted(true)}>
                  Let it through
                </Button>
              )
            }
            exits={
              committed ? (
                <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                  It is on today&rsquo;s file, under {order.deliveryDay}, for <Name of={customer} />.
                </p>
              ) : undefined
            }
          />
        </div>
        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
