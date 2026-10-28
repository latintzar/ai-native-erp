/* J1a · The customer page's architecture.
 *
 * POSITIVE SPACE. Which blocks exist on a customer and in what order — and NOTHING about their
 * contents. Every heading here is a decision this card makes; every body is a Ghost carrying the
 * pointer to the card that owns it. A page that drew its blocks' contents would have decided
 * eight other cards' screens in passing, which is the exact failure the method exists to stop.
 *
 * THE ORDER IS THE ARGUMENT. The record is read DURING a morning, not browsed: identity names the
 * page, then the blocks a mid-order question lands on — what they take, what they pay, what they
 * may order — then the blocks set once, then the log. It is one array in `canonical/customer-page`,
 * so moving a block is one edit and zero screens.
 *
 * LIVE. Click any block and the catalogue goes to the card that owns it. The page IS the web, and
 * navigating it is its whole interaction. Hovering a block lights its chip, and the other way
 * round.
 *
 * TWELVE CARDS LEAN ON THIS ONE. The dossier drawer every desk card carries is this page, folded.
 */
import * as React from 'react';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import CustomerPage from '../canonical/customer-page';
import { customerOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'J1a',
  title: "The customer page's architecture",
  group: 'J',
  frame: 'desk',
  ifText: "a customer's page is open",
  dims: [],
  job: 'Decide which blocks a customer record holds and in what order they stand.',
  decides:
    'which blocks exist on a customer and in what order — identity, preferred varieties, agreed prices, tier, agreed catalogue, volume arrangement, delivery days, order history — with every body left to the card that owns it',
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: 'identity, contacts and addresses', ref: 'A4' },
    { region: 'preferred varieties', ref: 'J2' },
    { region: 'agreed prices', ref: 'C8' },
    { region: 'the tier', ref: 'C7' },
    { region: 'the agreed catalogue', ref: 'A12' },
    { region: 'the volume arrangement', ref: 'C9b' },
    { region: 'the delivery days', ref: 'I2' },
    { region: 'the anatomy of one learned fact', ref: 'J1b' },
  ],
  open: [
    { region: 'the order history block', ref: 'OPEN-1' },
    { region: 'the customer list beside the page', ref: 'OPEN-3' },
  ],
  primitives: [],
  kit: ['Ghost'],
  canonical: 'customer-page',
  delta: 'origin',
  deltaText: 'the card that IS the customer page; J1b opens one of its blocks',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [4],
  step: 2,
  fills: [],
  reads: ['record'],
  live:
    'click any block and the catalogue goes to the card that owns it; hovering a block lights its chip in the strip below, and hovering a chip lights the block — the page is a map and reading it is the interaction',
};

export default function J1a() {
  const { cast } = useSector();
  const customer = customerOf(cast, cast.order.customer);

  return (
    /* the column beside the page is the CUSTOMER list, not the day's orders — the same chassis,
       retargeted in one prop, and the openness travels with it */
    <DeskChassis
      selected={1}
      rows={12}
      height={1320}
      daybar={false}
      daylist={{ open: 3, label: 'the customers' }}
    >
      <CustomerPage cast={cast} customer={customer} />
    </DeskChassis>
  );
}
