/* MEMORY LOG — the chain by which a thing that was asked for became a thing that is known.
 *
 * The product matches what a customer asked for against what is actually in the list, and when the
 * two are not the same word it matches on MEMORY — what is known about this customer. That memory
 * is not a table someone loaded; it is CREATED, one clarification at a time. Every confirmation a
 * person makes becomes an event in it, and future matching gets better because of it. So the memory
 * IS a log, and this page is that log for one interpreted item.
 *
 * WHAT THIS PAGE HAS TO PROVE, and what each tile is for:
 *
 *   A GUESS IS SAFFRON. A SETTLED FACT IS INK. Read «Candidates offered» beside «Settled and
 *   remembered»: the same name, saffron in one and ink in the other, and nothing else changed. The
 *   accent marks the machine's own act — its proposal, its match — and the moment a person confirms,
 *   the accent leaves and never comes back.
 *
 *   THE EMPTY SLOT IS NEVER FILLED WITH A GUESS. Every tile carries the same «Remembered as» row.
 *   Until a person settles it, that row holds an empty slot — even in the tiles where the machine
 *   has a match it likes and could easily have written in. That is the whole discipline: the guess
 *   lives in the log where it is marked as a guess, and the answer row stays honest.
 *
 *   A SETTLED MEMORY IS QUIET. It has a ground, a hairline and no accent anywhere near it. An
 *   unsettled one is loud about being open: a ring instead of a dot, and the standing said in words.
 *
 * DEMO CONTENT IS DELIBERATELY ABOUT NOTHING — «Item A-2», «Customer 1», «Staff 1». A themed log
 * would quietly decide which moment of the product this component serves, and that mapping is the
 * situations catalogue's job, made explicitly, later.
 */
import * as React from 'react';
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import { Section, Tile, Grid, Row } from '../chrome';
import { MemoryLog } from '../../rocoto/memory-log';
import type { MemoryEvent, MemoryCandidate } from '../../rocoto/memory-log';

/* ── THE SUBJECT ──────────────────────────────────────────────────────────────────────────── */

const CUSTOMER = 'Customer 1';

/** the words the order arrived in — kept as they arrived, because tidying them into the name of a
 *  thing in the list would answer the question this log exists to hold open */
const ASKED = 'two of the small ones';

const CANDIDATES: MemoryCandidate[] = [
  { id: 'a1', name: 'Item A-1', detail: 'Variant 1 · 12 per box', strength: 0.82 },
  { id: 'a2', name: 'Item A-2', detail: 'Variant 2 · 12 per box', strength: 0.64 },
  { id: 'a3', name: 'Item A-3', detail: 'Variant 3 · 6 per box', strength: 0.41 },
];

/* ── THE SEVEN STEPS, each one written once and composed into the chains below ─────────────── */

/** 1 — receipt */
const RECEIVED: MemoryEvent = {
  id: 'received',
  kind: 'received',
  at: '09:41',
  by: CUSTOMER,
  note: 'The order arrived, in the words it arrived in.',
  said: { author: 'received', text: 'Two of the small ones, please.', time: '09:41' },
};

/** 2 — clarification, both halves of it */
const ASKED_BACK: MemoryEvent = {
  id: 'asked-back',
  kind: 'clarified',
  at: '09:43',
  by: 'Staff 1',
  note: 'Asked which of the three was meant.',
  said: { author: 'sent', text: 'Which of the three do you mean?', time: '09:43' },
};

const ANSWERED: MemoryEvent = {
  id: 'answered',
  kind: 'clarified',
  at: '09:44',
  by: CUSTOMER,
  said: { author: 'received', text: 'The one we took last time.', time: '09:44' },
};

/** 3 — the machine's match. Its own act, and until a person says so, a guess. */
const MATCHED: MemoryEvent = {
  id: 'matched',
  kind: 'matched',
  at: '09:44',
  by: 'Rocoto',
  note: 'Matched on what this customer took last time.',
  match: 'Item A-2',
};

/** 3 — the other outcome: the chain stays open, and the slot stays empty */
const UNMATCHED: MemoryEvent = {
  id: 'unmatched',
  kind: 'unmatched',
  at: '09:45',
  by: 'Rocoto',
  note: 'This one stays open for a person to name.',
};

/** 4 — the best candidates */
const OFFERED: MemoryEvent = {
  id: 'offered',
  kind: 'candidates',
  at: '09:44',
  by: 'Rocoto',
  note: 'Three best candidates, strongest first.',
  candidates: CANDIDATES,
};

/** 5 + 6 — a person confirms, and the match lands on the right one */
const CONFIRMED_BY_STAFF: MemoryEvent = {
  id: 'confirmed-staff',
  kind: 'confirmed',
  at: '09:46',
  by: 'Staff 1',
  note: 'Confirmed on review.',
  match: 'Item A-2',
};

const CONFIRMED_BY_CUSTOMER: MemoryEvent = {
  id: 'confirmed-customer',
  kind: 'confirmed',
  at: '09:47',
  by: CUSTOMER,
  note: 'Confirmed by the customer, in the thread.',
  said: { author: 'received', text: 'Yes, that one.', time: '09:47' },
  match: 'Item A-2',
};

/** 7 — saved in memory forever. The figure rides along because what a customer calls one thing and
 *  what the list counts as one thing are different numbers, and that equivalence is learned here
 *  once and then kept with the name. */
const SETTLED: MemoryEvent = {
  id: 'settled',
  kind: 'settled',
  at: '09:46',
  note: 'Kept for every order after this one. One of them counts as five units here.',
  match: 'Item A-2',
  figure: { value: 5, unit: 'units', decimals: 0 },
};

/** later — the memory is overridden, and the predecessor survives the change */
const OVERRIDDEN: MemoryEvent = {
  id: 'superseded',
  kind: 'superseded',
  at: '11:02',
  by: 'Staff 2',
  note: 'Changed on the next order, and the earlier memory stays legible.',
  match: 'Item A-3',
  was: 'Item A-2',
};

const UP_TO_MATCH: MemoryEvent[] = [RECEIVED, ASKED_BACK, ANSWERED, MATCHED];
const FULL_CHAIN: MemoryEvent[] = [...UP_TO_MATCH, OFFERED, CONFIRMED_BY_STAFF, SETTLED];

const Full: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ width: '100%' }}>{children}</div>
);

/* ── THE EXAMPLES ─────────────────────────────────────────────────────────────────────────── */

/* UNKNOWN — the order has arrived and nothing else has happened yet. One event, one node, and the
 * answer row already present and already empty. */
function Unknown() {
  return (
    <Full>
      <MemoryLog asked={ASKED} customer={CUSTOMER} events={[RECEIVED]} />
    </Full>
  );
}

/* CANDIDATES OFFERED — the machine's shortlist as a RECORD: it was offered, and nobody has decided.
 * The rows are text, out of the tab order, with no chevron promising something to press. */
function Offered() {
  return (
    <Full>
      <MemoryLog asked={ASKED} customer={CUSTOMER} events={[RECEIVED, OFFERED]} />
    </Full>
  );
}

/* AWAITING CONFIRMATION — the same shortlist as a DECISION. `onConfirm` turns the rows into real
 * targets: click one, or tab into the group and walk it with the arrows, Home and End, then Enter
 * or Space. Confirming appends the person's own event and the permanent entry, and the answer row
 * fills in ink for the first time. */
function Awaiting() {
  const [events, setEvents] = React.useState<MemoryEvent[]>([...UP_TO_MATCH, OFFERED]);
  const decided = events.length > UP_TO_MATCH.length + 1;

  const confirm = (candidate: MemoryCandidate) =>
    setEvents([
      ...UP_TO_MATCH,
      OFFERED,
      {
        id: 'confirmed',
        kind: 'confirmed',
        at: '09:46',
        by: 'Staff 1',
        note: 'Confirmed on review.',
        match: candidate.name,
      },
      {
        id: 'kept',
        kind: 'settled',
        at: '09:46',
        note: 'Kept for every order after this one.',
        match: candidate.name,
      },
    ]);

  return (
    <Full>
      <MemoryLog
        asked={ASKED}
        customer={CUSTOMER}
        events={events}
        onConfirm={decided ? undefined : confirm}
      />
      <Row>
        <Button
          size={BUTTON_SIZE.mini}
          kind={KIND.tertiary}
          disabled={!decided}
          onClick={() => setEvents([...UP_TO_MATCH, OFFERED])}
        >
          Ask again
        </Button>
      </Row>
    </Full>
  );
}

/* CONFIRMED BY STAFF — the salesperson's review is one of the two hands that can settle this. */
function ConfirmedByStaff() {
  return (
    <Full>
      <MemoryLog
        asked={ASKED}
        customer={CUSTOMER}
        events={[...UP_TO_MATCH, OFFERED, CONFIRMED_BY_STAFF]}
      />
    </Full>
  );
}

/* CONFIRMED BY THE CUSTOMER — the other hand. The confirmation is quoted as the message it was,
 * drawn by the conversation primitive itself rather than paraphrased into the log's own voice. */
function ConfirmedByCustomer() {
  return (
    <Full>
      <MemoryLog
        asked={ASKED}
        customer={CUSTOMER}
        events={[...UP_TO_MATCH, OFFERED, CONFIRMED_BY_CUSTOMER]}
      />
    </Full>
  );
}

/* SETTLED AND REMEMBERED — the end of the chain. The permanent entry is quiet: its own ground, the
 * pair it will be read by, and no accent within reach of it. The Figure beside it carries the other
 * half of what was learned — one of them turned out to be five. */
function Settled() {
  return (
    <Full>
      <MemoryLog
        asked={ASKED}
        customer={CUSTOMER}
        events={[...UP_TO_MATCH, OFFERED, CONFIRMED_BY_STAFF, SETTLED]}
      />
    </Full>
  );
}

/* OVERRIDDEN LATER — a memory is not a stone. The later fact stands and the earlier one is struck
 * through where it sits, in the answer row and in the log, which is Figure's predecessor treatment
 * applied to a name instead of a number. */
function Overridden() {
  return (
    <Full>
      <MemoryLog
        asked={ASKED}
        customer={CUSTOMER}
        events={[...UP_TO_MATCH, OFFERED, CONFIRMED_BY_STAFF, SETTLED, OVERRIDDEN]}
      />
    </Full>
  );
}

/* OPEN — nothing matched, and the interface says so. The node is a ring, the standing reads «Open»,
 * and the empty slot appears twice: in the event, and in the answer row it refuses to fill. */
function Open() {
  return (
    <Full>
      <MemoryLog asked={ASKED} customer={CUSTOMER} events={[RECEIVED, ASKED_BACK, UNMATCHED]} />
    </Full>
  );
}

/* COMPACT — one rung down Base's type scale, for a log that sits beside something rather than
 * carrying a screen on its own. */
function Compact() {
  return (
    <Full>
      <MemoryLog
        asked={ASKED}
        customer={CUSTOMER}
        size="compact"
        events={[...UP_TO_MATCH, OFFERED, CONFIRMED_BY_STAFF, SETTLED]}
      />
    </Full>
  );
}

/* PLAIN, HEADLESS — the same chain with its own surface dropped and its head off, for a housing
 * that already carries a customer's name and already paints a card. */
function Plain() {
  return (
    <Full>
      <MemoryLog
        asked={ASKED}
        customer={CUSTOMER}
        housing="plain"
        head={false}
        events={[...UP_TO_MATCH, OFFERED, CONFIRMED_BY_STAFF]}
      />
    </Full>
  );
}

/* THE WHOLE CHAIN — all seven steps end to end, and a way to watch them arrive in order. «Replay»
 * takes it back to the receipt; «Next» adds the next event. The standing, the nodes and the answer
 * row all re-read themselves at every step, so the walk is the component's own logic running rather
 * than a set of pictures. */
function WholeChain() {
  const [shown, setShown] = React.useState(FULL_CHAIN.length);
  const events = FULL_CHAIN.slice(0, shown);
  const done = shown >= FULL_CHAIN.length;
  return (
    <Full>
      <MemoryLog asked={ASKED} customer={CUSTOMER} events={events} />
      <Row>
        <Button size={BUTTON_SIZE.mini} kind={KIND.tertiary} onClick={() => setShown(1)}>
          Replay
        </Button>
        <Button
          size={BUTTON_SIZE.mini}
          kind={KIND.tertiary}
          disabled={done}
          onClick={() => setShown((n) => Math.min(FULL_CHAIN.length, n + 1))}
        >
          Next
        </Button>
      </Row>
    </Full>
  );
}

/* ── THE PAGE ─────────────────────────────────────────────────────────────────────────────── */

export default function MemoryLogSection() {
  return (
    <Section
      t="Memory Log"
      n="how one thing that was asked for became a thing that is known — receipt, clarification, match or the lack of one, candidates, a person's confirmation, and the entry that is kept; the machine's guess is saffron, the settled fact is ink, and the answer stays an empty slot until a person fills it"
    >
      <Grid>
        <Tile
          span={4}
          name="Unknown"
          rule="The order has arrived and nothing else has happened. The answer row is already here and already empty — it is built before there is anything to put in it, which is what stops anything being put in it early."
        >
          <Unknown />
        </Tile>

        <Tile
          span={4}
          name="Candidates offered"
          rule="The machine's shortlist as a record: Monzo's action row — rank tile, name, one-line subtitle, trailing figure. Nobody has decided, so the rows are text, the keyboard walks past them in one step, and no chevron promises something to press."
        >
          <Offered />
        </Tile>

        <Tile
          span={4}
          name="Awaiting confirmation"
          rule="The same shortlist as a decision. Click a row, or tab into the group and use the arrows, Home and End, then Enter or Space. Confirming writes the person's own event and the permanent entry, and the answer row fills in ink for the first time."
        >
          <Awaiting />
        </Tile>

        <Tile
          span={4}
          name="Confirmed by staff"
          rule="The salesperson's review is one of the two hands that can settle this. Their name is ink, their node is ink: the accent belongs to the machine and this was not the machine's act."
        >
          <ConfirmedByStaff />
        </Tile>

        <Tile
          span={4}
          name="Confirmed by the customer"
          rule="The other hand. The confirmation is quoted as the message it actually was — drawn by the conversation primitive itself, not paraphrased into the log's voice, so the evidence and the record are the same object."
        >
          <ConfirmedByCustomer />
        </Tile>

        <Tile
          span={4}
          name="Settled and remembered"
          rule="The end of the chain, and it is quiet: its own ground, the pair it will be read by, and no accent within reach. Compare the name here with the same name under «Candidates offered» — ink against saffron is the whole difference between a fact and a guess."
        >
          <Settled />
        </Tile>

        <Tile
          span={6}
          name="Overridden later"
          rule="A memory is not a stone. The later fact stands and the earlier one is struck through where it sits, in the log and in the answer row — Figure's predecessor treatment applied to a name instead of a number. The pair states the change, so no arrow and no colour are needed."
        >
          <Overridden />
        </Tile>

        <Tile
          span={6}
          name="Open"
          rule="Nothing matched, and the interface says so. A ring instead of a dot, «Open» in words, and the empty slot twice over: once in the event, once in the answer row it refuses to fill. The slot is ink — a lack of a match is the machine being honest about its edge, not an error."
        >
          <Open />
        </Tile>

        <Tile
          span={6}
          name="Compact"
          rule="One rung down Base's type scale, for a log that sits beside something rather than carrying a screen on its own. Every relationship on the card holds: the spine, the rank tiles, the quiet permanent entry."
        >
          <Compact />
        </Tile>

        <Tile
          span={6}
          name="Plain, headless"
          rule="The plain housing drops the card's own surface and the head prop drops its subject line, for a housing that already paints a card and already says whose memory this is. The chain and the answer row are the part that never goes."
        >
          <Plain />
        </Tile>

        <Tile
          span={12}
          name="The whole chain"
          rule="All seven steps end to end: receipt, clarification, the machine's match, the candidates, the person's confirmation, the match landing on the right one, and the entry that is kept. «Replay» goes back to the receipt and «Next» adds one event — the standing, the nodes and the answer row all re-read themselves at every step, so this is the component's own logic running rather than eleven pictures of it."
        >
          <WholeChain />
        </Tile>
      </Grid>
    </Section>
  );
}
