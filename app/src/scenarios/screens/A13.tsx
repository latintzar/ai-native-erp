/* A13 · See what a change affects.
 *
 * THE ORIGIN OF `canonical/change-notice`. A13-bis deltas from it, and P4's C5 instantiates it
 * with orders in the table instead of downstream commitments.
 *
 * POSITIVE SPACE. The blast radius: which downstream things are already committed — the lote
 * reserved, the picking sheet printed, the weights taken, the albarán released, the line in
 * today's file, the stop on a round — and which of them come back. Nothing moves on its own.
 * Drawn at the worst position the plan names (FLOWS §8.3): after the albarán exists, before the
 * goods leave.
 *
 * THE LIVE INTERACTION IS THE CARD. `U11`'s body is a FUNCTION OF HOW FAR THE ORDER HAS
 * TRAVELLED, so the card hands that function its argument: move the order along its thread and
 * the table gains and loses rows in front of you, and the ghosted regions downstream appear and
 * disappear with them. The blast radius is drawn twice — once as records, once as architecture —
 * and they cannot disagree, because one array produces both.
 *
 * THE SECTOR IS A CLOCK, NOT A SCREEN. Fish's point of no return is the morning dispatch, hours
 * earlier than fruit's or meat's, so the same card shows «It left at 07:10» far more often. The
 * hour is a configuration, and the switch above the card moves it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import type { ScenarioMeta, SectorId } from '../meta';
import DeskChassis from '../chassis/desk';
import ChangeNotice, { type NoticeRow, type Outcome } from '../canonical/change-notice';
import { GLines, GSheet, GErpfile, GRoute, GRegion } from '../ghosts/regions';
import { customerOf, productOf, batchOf } from '../data/cast';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A13',
  title: 'See what a change affects',
  group: 'A',
  frame: 'desk',
  ifText: 'the customer changes an order that is already recorded',
  dims: [],
  job: 'Show everything a change to a recorded order reaches, and let a person decide about each of it.',
  decides:
    'which downstream records a change reaches, which of them come back for a second pass, and that the person chooses — the notice moves nothing on its own',
  inherits: [
    { region: "the order's lines", ref: 'A1' },
    { region: 'the lote the line draws on', ref: 'E1' },
    { region: 'the picking sheet', ref: 'F0' },
    { region: 'the weights taken at the bench', ref: 'F1' },
    { region: 'the albarán', ref: 'G1' },
    { region: "today's file", ref: 'G2' },
    { region: 'the stop on the round', ref: 'I5' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: ['U11'],
  kit: ['Segmented Control', 'Button Group', 'Figure', 'Tag', 'Ghost'],
  canonical: 'change-notice',
  delta: 'origin',
  deltaText: 'the card that IS the change notice; A13-bis and C5 delta from it',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  fills: [],
  reads: ['order', 'lot', 'line.sent_qty'],
  live:
    "move the order along its thread and the notice's table gains and loses rows in front of you, with the ghosted regions downstream appearing beside them; «Leave them as they are» is the first button at every position",
};

/* ── THE THREAD POSITIONS ─────────────────────────────────────────────────────────────────────
 * The five places an order can be standing when the change arrives, on thread 1. They are the
 * card's only control, and moving between them is the whole argument. */

const POSITIONS: Array<{ key: string; label: string; step: number }> = [
  { key: 'desk', label: 'On the desk', step: 4 },
  { key: 'lots', label: 'Lots allocated', step: 5 },
  { key: 'picked', label: 'Picked and weighed', step: 7 },
  { key: 'albaran', label: 'Albarán released', step: 8 },
  { key: 'round', label: 'On the round', step: 10 },
];

/* THE HOUR IS THE CONFIGURATION (the card's sector delta). A fish house dispatches before most
 * kitchens open; a fruit house mid-morning; a meat house later still. Same table, same rows — the
 * clock is the only thing the sector moves, and it is why the row that reads «It left» comes up
 * far more often in fish.
 *
 * `changed` carries one hour PER POSITION, because a change that arrives while the order is still
 * on the desk cannot arrive after the van did. Move the control and the hour moves with it. */
type Clock = {
  reserved: string; printed: string; weighed: string; released: string; filed: string; dispatch: string;
  changed: [string, string, string, string, string];
};

const CLOCK: Record<SectorId, Clock> = {
  fish: {
    reserved: '06:20', printed: '06:40', weighed: '06:55', released: '07:02', filed: '07:05', dispatch: '07:10',
    changed: ['06:15', '06:26', '06:58', '07:06', '07:38'],
  },
  meat: {
    reserved: '09:40', printed: '10:00', weighed: '10:20', released: '10:32', filed: '10:35', dispatch: '10:40',
    changed: ['09:20', '09:48', '10:24', '10:36', '11:05'],
  },
  fruit: {
    reserved: '08:20', printed: '08:45', weighed: '09:05', released: '09:12', filed: '09:15', dispatch: '09:20',
    changed: ['08:05', '08:28', '09:08', '09:14', '09:52'],
  },
};

/** How much more of the first line the customer now wants. A quantity, never a name. */
const MORE = 4;

export default function A13() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [at, setAt] = React.useState(3);
  const [outcome, setOutcome] = React.useState('leave');

  /* a different sector is a different order, so the decision starts again with it */
  React.useEffect(() => { setOutcome('leave'); }, [cast.sector]);

  const clock = CLOCK[cast.sector];
  const changedAt = clock.changed[at];
  const customer = customerOf(cast, cast.order.customer);
  const raised = cast.order.lines[0];
  const dropped = cast.order.lines[cast.order.lines.length - 1];
  const raisedProduct = productOf(cast, raised.product);
  const droppedProduct = productOf(cast, dropped.product);
  const lot = batchOf(cast, raised.lot ?? '');

  /* ── ONE ARRAY, TWO DRAWINGS ────────────────────────────────────────────────────────────────
   * Each commitment states the position at which it exists, the row it puts in the notice, and
   * the region it puts on the surface. The records and the architecture are therefore the same
   * claim rendered twice, and they cannot drift apart. */
  const gone = at >= 4;

  const commitments: Array<{ from: number; row: NoticeRow; region: React.ReactNode }> = [
    {
      from: 1,
      row: {
        id: 'lot',
        what: <>Reserved on {lot ? lot.id : raised.lot}</>,
        ref: 'E1',
        when: clock.reserved,
        figure: { value: raised.qty + MORE, was: raised.qty, unit: raised.unit },
        state: 'reopens',
        consequence: 'The reservation is drawn again at the new quantity.',
      },
      region: <GRegion key="lot" to="E1" height={64} label="the lote" />,
    },
    {
      from: 2,
      row: {
        id: 'sheet',
        what: <>The picking sheet</>,
        ref: 'F0',
        when: `printed ${clock.printed}`,
        state: 'reopens',
        consequence: 'The sheet is cut again for this round.',
      },
      region: <GSheet key="sheet" />,
    },
    {
      from: 2,
      row: {
        id: 'weights',
        what: <>The weights at the bench</>,
        ref: 'F1',
        when: clock.weighed,
        figure: { value: raised.qty, unit: raised.unit },
        state: 'reopens',
        consequence: <>The bench weighs <Name of={raisedProduct} /> again.</>,
      },
      region: <GRegion key="weights" to="F1" height={64} label="the weights" />,
    },
    {
      from: 3,
      row: {
        id: 'albaran',
        what: <>The albarán</>,
        ref: 'G1',
        when: `released ${clock.released}`,
        state: gone ? 'gone' : 'reopens',
        consequence: gone
          ? `It left at ${clock.dispatch}, so it stands and tomorrow carries the difference.`
          : 'It is issued again with the new lines.',
      },
      region: <GRegion key="albaran" to="G1" height={88} label="the albarán" />,
    },
    {
      from: 3,
      row: {
        id: 'file',
        what: <>Today&rsquo;s file</>,
        ref: 'G2',
        when: `written ${clock.filed}`,
        state: 'reopens',
        consequence: 'The line goes to the accounting system with the next file.',
      },
      region: <GErpfile key="file" />,
    },
    {
      from: 4,
      row: {
        id: 'route',
        what: <>The stop on the round</>,
        ref: 'I5',
        when: clock.dispatch,
        state: 'gone',
        consequence: 'The van is out, so the stop stands as it is.',
      },
      region: <GRoute key="route" to="I5" rows={4} />,
    },
  ];

  const live = commitments.filter((c) => at >= c.from);
  const rows = live.map((c) => c.row);
  const reopens = rows.filter((r) => r.state === 'reopens').length;

  /* The outcomes are the acts the blast radius makes available — so they grow with it, and at the
     position where the goods have gone the only honest act left is to settle it tomorrow. */
  const outcomes: Outcome[] = [
    {
      id: 'lines',
      label: 'Apply to the lines',
      detail: (
        <>
          The order carries {raised.qty + MORE} {raised.unit} of <Name of={raisedProduct} />, and each
          record above is decided one by one.
        </>
      ),
    },
    ...(reopens > 0
      ? [{
          id: 'reopen',
          label: 'Reopen what it reaches',
          detail: `The ${reopens} ${reopens === 1 ? 'record' : 'records'} marked Reopens come back for a second pass; the rest stand.`,
        }]
      : []),
    ...(gone
      ? [{
          id: 'settle',
          label: 'Settle it tomorrow',
          detail: `Today's albarán stands as it left at ${clock.dispatch}, and the difference rides tomorrow's.`,
        }]
      : []),
  ];

  /* an outcome that the new position no longer offers goes back to the first button */
  const offered = new Set(['leave', ...outcomes.map((o) => o.id)]);
  const chosen = offered.has(outcome) ? outcome : 'leave';

  return (
    <DeskChassis selected={2} rows={11} height={1120}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
        {/* ── THE CARD'S ONE CONTROL. Where the order stands when the change arrives. ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
          <SegmentedControl
            activeKey={String(at)}
            onChange={({ activeKey }) => setAt(Number(activeKey))}
          >
            {POSITIONS.map((p, i) => (
              <Segment key={String(i)} label={p.label} />
            ))}
          </SegmentedControl>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            Step {POSITIONS[at].step} of an order&rsquo;s life · the change arrived at {changedAt}
          </span>
        </div>

        <ChangeNotice
          what={
            <>
              <Name of={customer} /> raised <Name of={raisedProduct} /> to {raised.qty + MORE}{' '}
              {raised.unit} and took <Name of={droppedProduct} /> off the order
            </>
          }
          anchor={cast.order.deliveryDay}
          when={`recorded ${cast.order.placedAt}, changed ${changedAt}`}
          rows={rows}
          empty={
            <>
              The change lands on the order&rsquo;s lines and stops there — the lote, the sheet and
              the albarán are all still ahead of it.
            </>
          }
          outcomes={outcomes}
          outcome={chosen}
          onOutcome={setOutcome}
        />

        {/* ── THE BLAST RADIUS AS ARCHITECTURE. The same array that fills the table puts these
               here, so a record and its region arrive and leave together. Hovering a row's chip
               lights the region it names. ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
          <span
            style={{
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Downstream of this order
          </span>
          <div style={{ display: 'flex', gap: theme.sizing.scale500, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 1 220px', minWidth: 180, maxWidth: 240 }}>
              <GLines rows={3} />
            </div>
            {live.map((c) => (
              <div key={c.row.id} style={{ flex: '0 1 220px', minWidth: 180, maxWidth: 240 }}>
                {c.region}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DeskChassis>
  );
}
