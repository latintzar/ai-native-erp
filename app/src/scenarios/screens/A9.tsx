/* A9 · Supply the conversion once.
 *
 * `D5.any-unit`, the conversion not known. The customer orders in cajas, the catalogue sells by the
 * kilo, and nobody has ever told the software how much a caja holds.
 *
 * POSITIVE SPACE. The one-time ratio capture, and that it is STORED AGAINST THE PRODUCT and never
 * asked again. One field, one press, and every order after this one converts on its own.
 *
 * THE CONFLICT THIS CARD HAS TO STATE, and does. A stored ratio assumes a stable one. Fruit has
 * that — a caja de Mango de barco is 4 kg by definition. Fish and meat do not: a caja de Merluza
 * is six kilos and a bit, and the truth arrives on the scale. THE RESOLUTION, DRAWN: where the
 * pack is nominal the stored ratio is used to PLACE AND PRICE the order and is SUPERSEDED AT F1 by
 * the weighed value. A9's number and F1's number are the same fact at two moments, and they share
 * the Figure and its supersede law. The weighed slot is drawn EMPTY until the scale speaks —
 * never zero, because zero is a number the product does not know.
 *
 * The pack's own `nominal` flag in `cast.ts` is what decides which of the two this account is
 * living in, so the toggle appears in fish and meat and the fruit card is simply shorter.
 *
 * REDUCTION: **A9 ≡ F2** — one screen, two entry points. The same `Capture` component, at the desk
 * here and at the bench there.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { OrderState } from '../canonical/order-surface';
import { Resolution, Capture, packWord, withPackPlural, type Write } from '../canonical/resolution';
import { Figure } from '../../rocoto/figure';
import RefChip from '../shell/RefChip';
import { GThread, GCatalogue } from '../ghosts/regions';
import { customerOf, productOf, type Order } from '../data/cast';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A9',
  title: 'Supply the conversion once',
  group: 'A',
  frame: 'desk',
  ifText: 'a customer may order in any unit, and the ratio between their unit and the catalogue’s is not on file',
  dims: ['D5.any-unit', 'D3.setup'],
  job: 'Enter how much one pack holds, and store it on the product.',
  decides:
    'the ratio between the unit a customer orders in and the unit the catalogue sells in — entered once, held by the product, and superseded by the scale where the pack is nominal',
  inherits: [
    { region: "the order card's anatomy", ref: 'A1' },
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'the dossier', ref: 'J1a' },
    { region: 'the same fact captured at the bench', ref: 'F2' },
    { region: 'the weighed value that supersedes it', ref: 'F1' },
  ],
  open: [
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
    { region: 'the catalogue that holds the pack', ref: 'OPEN-2' },
  ],
  primitives: ['U01'],
  kit: ['Input', 'Figure', 'Segmented Control', 'Tag', 'Button', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: 'a one-field capture opens in the line and lands on the product',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1, 4],
  step: 3,
  fills: ['product.pack_factor'],
  reads: ['record'],
  live:
    'type the ratio and the line resolves as you type; store it and a tag says it is on the product; where the pack is nominal a toggle shows the pair — the nominal that places the order and the empty slot the scale fills at F1',
};

export default function A9() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [typed, setTyped] = React.useState('');
  const [stored, setStored] = React.useState(false);
  const [moment, setMoment] = React.useState<React.Key>('nominal');

  const customer = customerOf(cast, cast.order.customer);

  /* THE LINE WITH NO RATIO ON FILE. The first line whose product is bought in a pack — the ratio
     the person is about to supply is the one `cast.ts` already holds, so the card can check its
     own arithmetic against the catalogue rather than against a builder's guess. */
  const target = React.useMemo(() => {
    const line = cast.order.lines.find((l) => productOf(cast, l.product).pack) ?? cast.order.lines[0];
    const product = productOf(cast, line.product);
    const pack = product.pack;
    /* WHOLE PACKS. The customer counted boxes, so the number they said is a count of boxes — and
       a count is a whole number. Rounding it here keeps the line honest before the ratio lands. */
    const packs = pack ? Math.max(1, Math.round(line.qty / pack.factor)) : line.qty;
    return { line, product, pack, packs };
  }, [cast]);

  const { line, product, pack, packs } = target;
  const ratio = Number(typed.replace(',', '.'));
  const resolves = Number.isFinite(ratio) && ratio > 0;
  const resolved = resolves ? Math.round(packs * ratio * 10) / 10 : null;

  React.useEffect(() => {
    setTyped('');
    setStored(false);
    setMoment('nominal');
  }, [cast.sector]);

  /* before the ratio lands the line is what the customer said — a count of packs. After it, the
     line is the catalogue's own unit with the pack kept beside it. */
  const order: Order = React.useMemo(
    () => ({
      ...cast.order,
      lines: cast.order.lines.map((l) =>
        l.id === line.id
          ? stored && resolved !== null && pack
            ? { ...l, qty: resolved, unit: product.unit, wasQty: packs }
            : { ...l, qty: packs, unit: pack ? packWord(packs, pack.unit) : l.unit, wasQty: undefined }
          : l,
      ),
    }),
    [cast.order, line.id, stored, resolved, pack, packs, product.unit],
  );

  const writes: Write[] | undefined =
    stored && resolved !== null && pack
      ? [
          {
            object: 'This line',
            text: `${packs} ${packWord(packs, pack.unit)} · ${resolved.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit}`,
            ref: 'A1',
          },
          {
            object: product.name,
            text: `a ${pack.unit} holds ${ratio.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit}, on every order from now on`,
            ref: 'F2',
          },
        ]
      : undefined;

  return (
    <DeskChassis dossier selected={2} rows={11} height={1080}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={withPackPlural(cast, product.id, packs)}
            order={order}
            state={<OrderState>{stored ? 'Ready for you' : 'One line waiting'}</OrderState>}
            openLine={line.id}
            renderOpenLine={() => (
              <Resolution
                ask={
                  <>
                    How much one {pack ? pack.unit : product.unit} of <Name of={product} /> holds.{' '}
                    {customer.name} orders it that way, and the catalogue sells it by the{' '}
                    {product.unit}.
                  </>
                }
                writes={writes}
                after={
                  /* THE PAIR, where the pack is nominal. Two moments of one fact. */
                  pack?.nominal && stored && resolved !== null ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
                      <SegmentedControl activeKey={moment} onChange={({ activeKey }) => setMoment(activeKey)}>
                        <Segment key="nominal" label="Placing the order" />
                        <Segment key="weighed" label="Leaving the warehouse" />
                      </SegmentedControl>

                      {moment === 'nominal' ? (
                        <div style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Figure value={resolved} unit={product.unit} decimals={1} size="large" />
                          <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
                            nominal
                          </Tag>
                          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                            Enough to place the order and to price it.
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Figure
                            value={resolved}
                            unit={product.unit}
                            decimals={1}
                            size="large"
                            overrides={{
                              Value: { style: () => ({ textDecoration: 'line-through' }) },
                              Unit: { style: () => ({ textDecoration: 'line-through' }) },
                            }}
                          />
                          {/* the empty slot: shown empty, and filled by the scale */}
                          <span
                            style={{
                              display: 'inline-block',
                              minWidth: 88,
                              height: theme.sizing.scale900,
                              borderBottom: `2px dashed ${theme.colors.borderOpaque}`,
                            }}
                            aria-label="the weighed value, waiting for the scale"
                          />
                          <RefChip to="F1" size="mini">
                            the scale fills this
                          </RefChip>
                        </div>
                      )}
                    </div>
                  ) : pack && !pack.nominal && stored ? (
                    <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                      A {pack.unit} of <Name of={product} /> holds{' '}
                      {ratio.toLocaleString('es-ES', { minimumFractionDigits: 1 })} {product.unit} by
                      definition, so this number stands all the way to the albarán.
                    </p>
                  ) : undefined
                }
              >
                <Capture
                  label={`One ${pack ? pack.unit : product.unit} holds`}
                  unit={product.unit}
                  value={typed}
                  onChange={setTyped}
                  onStore={() => setStored(true)}
                  stored={stored}
                  storedOn={<Name of={product} />}
                  storeLabel="Store it on the product"
                />
                {!stored && resolved !== null && (
                  <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'baseline' }}>
                    <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                      {packs} {packWord(packs, pack ? pack.unit : product.unit)} comes to
                    </span>
                    <Figure value={resolved} unit={product.unit} decimals={1} size="default" />
                  </div>
                )}
              </Resolution>
            )}
          />

          <GCatalogue rows={6} />
        </div>

        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
