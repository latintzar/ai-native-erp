/* H6 · Nobody is doing anything.
 *
 * THE FINISHED STATE, drawn so that a founder can see what it looks like when the product has
 * worked: a record on the distributor's side of which albaranes reached which customer systems,
 * and no controls at all. The card's whole content is that there is nothing to do.
 *
 * It is the third data delta on `arrival-record`, and the one that most tests the reduction: G2's
 * destination is one accounting system, H2's is a person, and H6's is a machine at the other end
 * of a handshake somebody authorised once, months ago. Same four questions, same table.
 *
 * WHICH SYSTEM IS A GHOST, pointing at OPEN-15 — the list of systems is data the founder has not
 * given yet, and it is the same hole that gates H4. Drawing a plausible product name in that
 * column would be inventing the answer to the most commercially valuable open question in the
 * catalogue.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import ArrivalRecord, { ArrivalHead, type ArrivalRow } from '../canonical/arrival-record';
import { todaysAlbaranes } from '../canonical/release';
import { GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'H6',
  title: 'Nobody is doing anything',
  group: 'H',
  frame: 'desk',
  ifText: 'the customer authorised a connection once, and every albarán since arrives on its own',
  dims: ['D15.connected'],
  job: 'See that today’s albaranes are already inside the customers’ own systems.',
  decides:
    'how the finished state is drawn — a record of what arrived where, and a screen with nothing to press',
  inherits: [
    { region: 'the handshake that got here', ref: 'H5' },
    { region: 'the albaranes themselves', ref: 'G1' },
    { region: 'the same record for a link', ref: 'H2' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [
    { region: 'which systems these are', ref: 'OPEN-15' },
    { region: "the day's bar and the day's list", ref: 'OPEN-1' },
  ],
  primitives: [],
  kit: ['Ghost'],
  canonical: 'arrival-record',
  delta: 'data',
  deltaText: 'the rows are customer systems and what came back is an acceptance',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 9,
  fills: [],
  reads: ['albarán'],
  live: 'none, and that is the point; the sector switch changes the customers and the table stands',
};

/** How long each write took to land, in seconds. Small numbers, and that is the finished state. */
const ACCEPTED = ['+2s', '+1s', '+4s', '+2s', '+1s'];

export default function H6() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const docs = todaysAlbaranes(cast);

  const rows: ArrivalRow[] = docs.map((doc, i) => ({
    id: doc.number,
    what: `Albarán ${doc.number}`,
    sub: `${doc.lines} lines`,
    where: (
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
        <Name of={doc.customer} />
        {/* which cost-control system sits at the other end — OPEN-15 */}
        <GRegion open={15} shape="line" height={10} label="their system" />
      </span>
    ),
    left: doc.at,
    back: [{ label: 'accepted', value: `${doc.at} ${ACCEPTED[i % ACCEPTED.length]}` }],
  }));

  return (
    <DeskChassis selected={1} rows={9} height={760} daylist={{ label: "the day's albaranes" }}>
      <ArrivalRecord
        columns={{ what: 'Albarán', where: 'Customer system', left: 'Sent', back: 'What came back' }}
        rows={rows}
        head={<ArrivalHead>Today’s albaranes are inside the customers’ own systems already.</ArrivalHead>}
        foot={
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {docs.length} of {docs.length} arrived. The next one arrives the same way.
          </p>
        }
      />
    </DeskChassis>
  );
}
