/* H2 · The delivery record.
 *
 * THE BRIEF'S H2 SAYS «send a link AND see whether it was opened». That is two jobs, and the send
 * act already has a card: I1. So H2 keeps only the record, and the one-job rule holds without a
 * split — which is the cleanest illustration in the catalogue of what the rule is for.
 *
 * A WATCHING SCREEN (§3.4). Sent, opened, when. Nothing else, and nothing to press.
 *
 * WHO OPENED IT IS A GHOST, pointing at J1a. A customer's contacts live on the customer page, and
 * until that page says who the contacts are, «by whom» is a column with a real shape and no value
 * — so it is drawn as a shape, in the column, rather than quietly dropped. That is law 4 applied
 * to a cell rather than to a region.
 */
import * as React from 'react';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import ArrivalRecord, { ArrivalHead, type ArrivalRow } from '../canonical/arrival-record';
import { todaysAlbaranes } from '../canonical/release';
import { GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'H2',
  title: 'The delivery record',
  group: 'H',
  frame: 'desk',
  ifText: 'a link is sent to the customer, who opens it and reads the albarán in a web page',
  dims: ['D15.link'],
  job: 'See which albaranes reached their customer, and which of them were opened.',
  decides:
    'the receipt trail per albarán — sent, opened, when — and that the record is the whole of it',
  inherits: [
    { region: 'the send control', ref: 'I1' },
    { region: 'what the customer saw', ref: 'H3' },
    { region: 'the albaranes themselves', ref: 'G1' },
    { region: "the customer's contacts", ref: 'J1a' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [{ region: "the day's bar and the day's list", ref: 'OPEN-1' }],
  primitives: [],
  kit: ['Ghost'],
  canonical: 'arrival-record',
  delta: 'data',
  deltaText: 'the rows are customers and what came back is an opening, not an accepted line count',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 9,
  fills: [],
  reads: ['albarán'],
  live:
    'no controls; the sector switch changes the customers and the hours and the table stands exactly as it is',
};

/** When each link was opened, and where one is still unopened. Hours, not names. */
const OPENED: Array<string | null> = ['09:31', '08:58', null, '10:12', '09:04'];

export default function H2() {
  const { cast } = useSector();
  const docs = todaysAlbaranes(cast);

  const rows: ArrivalRow[] = docs.map((doc, i) => {
    const opened = OPENED[i % OPENED.length];
    return {
      id: doc.number,
      what: `Albarán ${doc.number}`,
      sub: `${doc.lines} lines`,
      where: <Name of={doc.customer} />,
      left: doc.at,
      back: opened
        ? [
            { label: 'opened', value: opened },
            {
              label: 'by',
              /* the contact who opened it — a customer's contacts are decided on J1a. The blank is
                 the width of a name, because that is what will stand in it. */
              value: (
                <span style={{ display: 'inline-flex', width: 132, verticalAlign: 'middle' }}>
                  <GRegion to="J1a" shape="line" height={10} label="the contact" />
                </span>
              ),
            },
          ]
        : undefined,
      pending: opened ? undefined : 'Waiting to be opened',
    };
  });

  return (
    <DeskChassis selected={1} rows={9} height={760} daylist={{ label: "the day's albaranes" }}>
      <ArrivalRecord
        columns={{ what: 'Albarán', where: 'Customer', left: 'Sent', back: 'What came back' }}
        rows={rows}
        head={<ArrivalHead>Every albarán that went out today, and what the link did after it arrived.</ArrivalHead>}
      />
    </DeskChassis>
  );
}
