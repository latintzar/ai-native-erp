/* A8 · Choose the quantity over or under.
 *
 * `D5.any-unit`, the conversion known but not a whole number. The customer asked in the unit they
 * think in, the goods come in a pack that will not divide, and somebody has to decide which way it
 * goes.
 *
 * POSITIVE SPACE. The rounding choice — over and under, both priced, both spelled in the pack the
 * warehouse actually lifts — AND THAT THE CUSTOMER IS TOLD WHICH WAY IT WENT. The reply is
 * composed for the person, verbatim and editable, and they send it. Never rounded quietly: a
 * kilogram that appears out of nowhere on an invoice is a phone call at eight in the morning.
 *
 * FRUIT IS THE HOME, and the asymmetry is real. A caja is indivisible, so «2 cajas or 3» is a
 * genuine fork every day. In fish and meat the sold unit is a continuous kilo and the case is
 * rarer — the same screen, on a quieter clock.
 *
 * THE SITUATION IS DERIVED FROM THE CAST: the customer sent a second message asking for a product
 * the order does not yet carry, in a quantity that lands two and a half packs in. Every name is
 * the cast's; the arithmetic is the pack's own.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { OrderState } from '../canonical/order-surface';
import { Resolution, Fork, packWord, priceOf, withPackPlural, type ForkOption, type Write } from '../canonical/resolution';
import { Composer } from '../../rocoto/composer';
import { Message } from '../../rocoto/message';
import { GThread } from '../ghosts/regions';
import { customerOf, productOf, type Order } from '../data/cast';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A8',
  title: 'Choose the quantity over or under',
  group: 'A',
  frame: 'desk',
  ifText: 'a customer may order in any unit, and the conversion for this line lands between two whole packs',
  dims: ['D5.any-unit', 'D3.resolve'],
  job: 'Send the pack above or the pack below, and tell the customer which way it went.',
  decides:
    'which whole pack a part-pack order becomes, and that the customer hears it in the same breath',
  inherits: [
    { region: "the order card's anatomy", ref: 'A1' },
    { region: 'the rail', ref: 'K' },
    { region: 'the thread the reply joins', ref: 'chat' },
    { region: 'the dossier', ref: 'J1a' },
    { region: 'the ratio the arithmetic runs on', ref: 'A9' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: ['U01'],
  kit: ['Button', 'Composer', 'Message', 'Figure', 'Tag', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: 'two chips inside the line, and a composed reply under the order',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fruit',
  thread: [1],
  step: 3,
  fills: ['line.qty'],
  reads: ['record'],
  live:
    'press over or under and the line takes that quantity, the total moves and the composer fills with the outgoing message, verbatim and editable; press send and the thread gains it',
};

export default function A8() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [sent, setSent] = React.useState<string | null>(null);

  const customer = customerOf(cast, cast.order.customer);

  /* THE PART-PACK LINE, DERIVED. A product the order does not carry yet, bought in a pack, asked
     for at two and a half packs — the smallest quantity that cannot be honoured either way. */
  const situation = React.useMemo(() => {
    const onOrder = new Set(cast.order.lines.map((l) => l.product));
    const product =
      cast.products.find((p) => p.pack && !onOrder.has(p.id)) ??
      cast.products.find((p) => p.pack) ??
      cast.products[0];
    const factor = product.pack ? product.pack.factor : 1;
    const packUnit = product.pack ? product.pack.unit : product.unit;
    const asked = Math.round(factor * 2.5 * 10) / 10;
    const under = { packs: 2, qty: Math.round(factor * 2 * 10) / 10 };
    const over = { packs: 3, qty: Math.round(factor * 3 * 10) / 10 };
    return { product, factor, packUnit, asked, under, over, price: priceOf(cast, product) };
  }, [cast]);

  const { product, factor, packUnit, asked, under, over, price } = situation;
  const pick = chosen === 'over' ? over : chosen === 'under' ? under : null;

  /* the reply, composed from the cast's own names and the pack's own arithmetic */
  const reply = React.useMemo(() => {
    if (!pick) return '';
    return `${product.name}: ${pick.packs} ${packWord(pick.packs, packUnit)}, which comes to ${pick.qty.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit}. A ${packUnit} holds ${factor} ${product.unit}.`;
  }, [pick, product, packUnit, factor]);

  React.useEffect(() => {
    setChosen(null);
    setDraft('');
    setSent(null);
  }, [cast.sector]);

  React.useEffect(() => {
    setDraft(reply);
    setSent(null);
  }, [reply]);

  /* the order, with the second message and the line it asks for */
  const askText = `And ${asked.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit} of ${product.name}, if you have it.`;
  const order: Order = React.useMemo(
    () => ({
      ...cast.order,
      words: [...cast.order.words, askText],
      lines: [
        ...cast.order.lines,
        {
          id: 'a8',
          product: product.id,
          qty: pick ? pick.qty : asked,
          unit: product.unit,
          wasQty: pick ? pick.packs : undefined,
          price,
        },
      ],
    }),
    [cast.order, askText, product.id, pick, asked, price],
  );

  const options: ForkOption[] = [
    {
      id: 'under',
      label: `${under.packs} ${packWord(under.packs, packUnit)} · ${under.qty.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit}`,
      consequence: `${(asked - under.qty).toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit} under the ask`,
    },
    {
      id: 'over',
      label: `${over.packs} ${packWord(over.packs, packUnit)} · ${over.qty.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit}`,
      consequence: `${(over.qty - asked).toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit} over the ask`,
    },
  ];

  const writes: Write[] | undefined = pick
    ? [
        {
          object: 'This line',
          text: `${pick.packs} ${packWord(pick.packs, packUnit)} · ${pick.qty.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit}`,
          ref: 'A1',
        },
        {
          object: `${customer.name}'s thread`,
          text: sent ? 'the reply is with them' : 'the reply is written and waiting for your send',
          ref: 'chat',
        },
      ]
    : undefined;

  return (
    <DeskChassis dossier selected={2} rows={11} height={1120}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={pick ? withPackPlural(cast, product.id, pick.packs) : cast}
            order={order}
            state={<OrderState>{pick ? 'Ready for you' : 'One line waiting'}</OrderState>}
            openLine="a8"
            renderOpenLine={() => (
              <Resolution
                ask={
                  <>
                    A {packUnit} of <Name of={product} /> holds {factor} {product.unit}, and{' '}
                    {customer.name} asked for{' '}
                    {asked.toLocaleString('es-ES', { minimumFractionDigits: 1 })} {product.unit} —
                    two and a half of them. Which whole {packUnit} count leaves?
                  </>
                }
                writes={writes}
              >
                <Fork options={options} chosen={chosen} onChoose={setChosen} />
              </Resolution>
            )}
          />

          {/* ── THE REPLY. Composed for the person, sent by the person. ── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              What {customer.name} hears
            </span>
            {sent && (
              <Message author="sent" time={cast.order.placedAt} status="sent">
                {sent}
              </Message>
            )}
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={() => {
                if (draft.trim() === '') return;
                setSent(draft);
                setDraft('');
              }}
              disabled={!pick}
              placeholder={`Write to ${customer.name}`}
              sendLabel="Send the reply"
            />
          </section>
        </div>

        {/* the conversation behind the composer */}
        <GThread rows={8} />
      </div>
    </DeskChassis>
  );
}
