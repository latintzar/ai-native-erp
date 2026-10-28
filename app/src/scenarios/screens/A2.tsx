/* A2 · Watch an order that proceeded.
 *
 * THE CATALOGUE'S CLEANEST PROOF THAT REVIEW IS A DIMENSION. A2 is A1 with the primary REMOVED
 * and nothing put in its place — one prop, `primary`, left off the same component. The brief says
 * the card exists precisely to show the missing button, and C-8 says the gate is drawn once; both
 * are satisfied by a call to `canonical/order-surface` that omits a single argument.
 *
 * POSITIVE SPACE. What a screen is when the person has no decision: everything is still legible,
 * the row's own state says the order already left, and the space a gesture would have occupied is
 * simply not there.
 *
 * NO CONTROLS (BUILD-PLAN §3.4). One disclosure that opens in place — hover the state and it says
 * when it went — and the sector switch. An agent that adds a button to this card has broken its
 * subject.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { OrderState } from '../canonical/order-surface';
import { GThread, GErpfile } from '../ghosts/regions';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A2',
  title: 'Watch an order that proceeded',
  group: 'A',
  frame: 'desk',
  ifText: 'only orders carrying something the software could not resolve are held, and this one carried nothing',
  dims: ['D2.exceptions'],
  job: 'Show an order that went through without a person, and that there is nothing here to do.',
  decides:
    'what an order screen is when the person has no decision — the same card, legible, with the gesture that ends a decision absent rather than disabled',
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'the dossier', ref: 'J1a' },
    { region: "today's file", ref: 'G2' },
    { region: 'the lines and their anatomy', ref: 'A1' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: [],
  kit: ['Message', 'Transcript', 'Overlay Card', 'Figure', 'Tag', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: 'the primary is removed and nothing replaces it',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 2,
  fills: [],
  reads: ['order'],
  live:
    'there is no primary and nothing stands in its place; hover the state and one line opens in place — «It left at 07:10» — and the sector switch re-renders the lines from the cast',
};

/** THE ONE DISCLOSURE THE CARD IS ALLOWED (§3.4). It opens in place, under the state it explains,
 *  and it closes when the hand leaves. It adds no act — it reads out a fact the row already
 *  carries, which is why a watching card may have it. */
function ProceededState({ at }: { at: string }) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.sizing.scale200 }}
    >
      <span tabIndex={0} style={{ outline: 'none' }}>
        <OrderState>Sent</OrderState>
      </span>
      {open && (
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          It left at {at}.
        </span>
      )}
    </div>
  );
}

export default function A2() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  return (
    <DeskChassis dossier selected={4} rows={11} height={880}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={cast}
            state={<ProceededState at="07:10" />}
            reason={<>Every line read cleanly, so it proceeded on its own.</>}
            /* `primary` IS ABSENT. That omission is the card. */
          />
          <GErpfile />
        </div>
        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
