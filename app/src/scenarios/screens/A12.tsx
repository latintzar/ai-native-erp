/* A12 · Supply something outside the agreed list.
 *
 * `D10.restricted-catalogue`, and the customer ordered off-list. A HORECA supply agreement
 * enumerates what a house may order, and then the chef orders something else, which is the whole
 * reason the dimension exists.
 *
 * POSITIVE SPACE. The exception to an agreed catalogue: supply it or hold it, AND WHETHER THE
 * EXCEPTION IS THIS ONCE OR FROM NOW ON. Two decisions of different sizes on one screen, and the
 * second one is the one the product is really for — an agreement that quietly drifts is an
 * agreement nobody can price.
 *
 * THE SECOND WRITE, MADE LOUD. Choosing «Always» writes to the customer's agreed list on J1a and
 * the snackbar NAMES THE RECORD IT CHANGED. A product that changes a standing agreement without
 * saying which one it changed is a product a person stops trusting on the day it matters.
 *
 * MEAT IS THE HOME. Agreed cuts are how meat is sold to restaurants. Fruit is medium. In fish the
 * constraint is availability rather than agreement, so D3s does this work instead — the same
 * screen, a different reason for standing in front of it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SnackbarElement } from 'baseui/snackbar';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { HoldToConfirm, OrderState } from '../canonical/order-surface';
import { Resolution, Fork, AlwaysTail, type ForkOption, type Write } from '../canonical/resolution';
import RefChip from '../shell/RefChip';
import { GThread, GCatalogue } from '../ghosts/regions';
import { customerOf, productOf } from '../data/cast';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A12',
  title: 'Supply something outside the agreed list',
  group: 'A',
  frame: 'desk',
  ifText: 'a customer may order an agreed subset of the catalogue, and this order names something outside it',
  dims: ['D10.restricted-catalogue', 'D3.resolve'],
  job: 'Decide whether this off-list line goes out, and whether the agreement changes with it.',
  decides:
    'whether an off-list line is supplied or held, and whether the exception holds for this order alone or joins the agreed list',
  inherits: [
    { region: "the order card's anatomy", ref: 'A1' },
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'the agreed list this writes to', ref: 'J1a' },
    { region: 'the same decision under availability', ref: 'D3s' },
  ],
  open: [
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
    { region: 'the catalogue the agreed list is carved out of', ref: 'OPEN-2' },
  ],
  primitives: ['U01'],
  kit: ['Button', 'Snackbar', 'Tag', 'Figure', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: 'two exception buttons in the line, and a scope control that reaches the agreement',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'meat',
  thread: [1, 4],
  step: 3,
  fills: ['record.catalogue[]'],
  reads: ['record'],
  live:
    'supply it or hold it; press Always and the agreed list gains the product with a snackbar naming the record it changed, and the tag moves from this order to settled',
};

export default function A12() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [verdict, setVerdict] = React.useState<string | null>(null);
  const [always, setAlways] = React.useState(false);
  const [committed, setCommitted] = React.useState(false);

  const customer = customerOf(cast, cast.order.customer);

  /* THE OFF-LIST LINE. The agreement covers the rest of this order; the last line names something
     it does not, which is exactly how an agreement gets tested in practice. */
  const target = cast.order.lines[cast.order.lines.length - 1];
  const product = productOf(cast, target.product);
  const agreed = cast.products.filter((p) => p.id !== product.id);

  React.useEffect(() => {
    setVerdict(null);
    setAlways(false);
    setCommitted(false);
  }, [cast.sector]);

  /* held: the line leaves the order and its money leaves with it */
  const order = React.useMemo(
    () =>
      verdict === 'hold'
        ? { ...cast.order, lines: cast.order.lines.filter((l) => l.id !== target.id) }
        : cast.order,
    [cast.order, verdict, target.id],
  );

  const options: ForkOption[] = [
    {
      id: 'supply',
      label: 'Supply it',
      consequence: `It leaves on ${cast.order.deliveryDay}`,
    },
    {
      id: 'hold',
      label: 'Hold it',
      consequence: `It waits for a word from ${customer.name}`,
    },
  ];

  const writes: Write[] | undefined = verdict
    ? [
        {
          object: 'This order',
          text:
            verdict === 'supply'
              ? `${product.name} goes out with the rest`
              : `${product.name} waits, and the other ${order.lines.length} lines go out`,
          ref: 'A1',
        },
        {
          object: `${customer.name}'s agreed list`,
          text: always
            ? `${product.name} joins the ${agreed.length + 1} products they may order`
            : `it holds at ${agreed.length} products, and this exception rides on the order alone`,
          ref: 'J1a',
        },
      ]
    : undefined;

  return (
    <DeskChassis dossier selected={2} rows={11} height={1080}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={cast}
            order={order}
            state={<OrderState>{committed ? 'Confirmed' : verdict ? 'Ready for you' : 'One line waiting'}</OrderState>}
            reason={
              <>
                {customer.name} may order {agreed.length} products under their agreement. This order
                names one more.
              </>
            }
            openLine={verdict === 'hold' ? undefined : target.id}
            renderOpenLine={() => (
              <Resolution
                ask={
                  <>
                    <Name of={product} /> sits outside {customer.name}&rsquo;s agreed list. Does it
                    go out?
                  </>
                }
                writes={writes}
                tail={
                  verdict === 'supply' ? (
                    <AlwaysTail
                      scope={<>{customer.name}&rsquo;s agreed list</>}
                      always={always}
                      onAlways={() => setAlways(true)}
                      onceText="This order only"
                    />
                  ) : undefined
                }
                after={
                  always ? (
                    <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
                      <SnackbarElement
                        message={`${product.name} is on ${customer.name}'s agreed list.`}
                        actionMessage="Open the record"
                        actionOnClick={() => {
                          window.location.hash = '#/J1a';
                        }}
                      />
                      <RefChip to="J1a" size="mini">
                        the record it changed
                      </RefChip>
                    </div>
                  ) : undefined
                }
              >
                <Fork options={options} chosen={verdict} onChoose={setVerdict} />
              </Resolution>
            )}
            primary={
              committed || !verdict ? undefined : (
                <HoldToConfirm onConfirm={() => setCommitted(true)}>Hold to confirm</HoldToConfirm>
              )
            }
            exits={
              committed ? (
                <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                  It is on today&rsquo;s file, under {cast.order.deliveryDay}.
                </p>
              ) : undefined
            }
          />

          {/* the shelf the agreement is carved out of */}
          <GCatalogue rows={6} />
        </div>

        <GThread rows={8} />
      </div>
    </DeskChassis>
  );
}
