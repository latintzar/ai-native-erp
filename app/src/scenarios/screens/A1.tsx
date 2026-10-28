/* A1 · Confirm an interpreted order.
 *
 * THE KEYSTONE. Twenty-four cards lean on this one: it owns the order card's anatomy for the whole
 * product. Drawn first, drawn three times from one markup, and frozen.
 *
 * POSITIVE SPACE. What must be legible on an order card before a person may commit it, and the
 * gesture that commits it: the customer, the lines as Rocoto read them, THE CUSTOMER'S OWN WORDS
 * KEPT BESIDE THE READING, and the hold that ends the decision. It also carries the `D3.reply`
 * exit door as one control on the message (BUILD-PLAN §3.5).
 *
 * THE SECTOR THESIS' PROOF LIVES HERE. The line's secondary row is DATA, not markup: fish shows
 * zona and arte, meat shows the lote, fruit shows calibre and categoría, and the component that
 * draws them is one component reading `family.lineFields`. Run the sector switch above the card
 * and watch the markup stay still.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { HoldToConfirm, OrderState } from '../canonical/order-surface';
import { GThread, GErpfile } from '../ghosts/regions';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A1',
  title: 'Confirm an interpreted order',
  group: 'A',
  frame: 'desk',
  ifText: 'every order is checked and confirmed by a person',
  dims: ['D2.all', 'D3.confirm', 'D3.reply'],
  job: 'Confirm an order Rocoto interpreted from a message.',
  decides:
    "what must be legible on an order before a person commits it — the customer, the lines as Rocoto read them, and the customer's own words beside the reading — and the gesture that commits it",
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'the composer', ref: 'chat' },
    { region: 'the dossier', ref: 'J1a' },
    { region: "today's file", ref: 'G2' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: [],
  kit: ['Message', 'Transcript', 'Overlay Card', 'Figure', 'Button', 'Tag', 'Ghost'],
  canonical: 'order-surface',
  delta: 'origin',
  deltaText: 'the card that IS the order surface; the other thirteen delta from it',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 2,
  fills: ['order'],
  reads: ['record'],
  live:
    "hold the primary and it fills, the order commits, its state changes and the primary leaves; click the customer's words and the transcript opens over the card; the sector switch re-renders the lines from the cast",
};

export default function A1() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [committed, setCommitted] = React.useState(false);
  const [handedOff, setHandedOff] = React.useState(false);

  /* the sector switch hands this screen a different cast; the state that belongs to THIS order
     goes back to the start with it, because it is a different order */
  React.useEffect(() => { setCommitted(false); setHandedOff(false); }, [cast.sector]);

  return (
    <DeskChassis dossier selected={2} rows={11} height={880}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={cast}
            state={<OrderState>{committed ? 'Confirmed' : 'Waiting on you'}</OrderState>}
            replyDoor={
              /* §3.5 — the exit door for a message that is not an order. ONE control, on the
                 message, and OPEN-9 still holds what happens after the hand-off. */
              <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => setHandedOff(true)}>
                {handedOff ? 'Handed over' : 'Answer'}
              </Button>
            }
            primary={
              committed ? undefined : (
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
          {/* where the confirmed order lands next — decided on G2 */}
          <GErpfile />
        </div>

        {/* the conversation this order arrived on. The one SETTLED surface in the product, so it
            reads at higher confidence than an undecided region. */}
        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
