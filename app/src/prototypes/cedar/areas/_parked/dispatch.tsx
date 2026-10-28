/* PARKED (THE-APP-V2 §1): «Deliveries are secondary — the next step of fulfilment, not the main step.» Out of the area glob; the file stays readable and still typechecks. */
/* DISPATCH — F/G/I, the day's second half.
 *
 * THE ONE SENTENCE THIS SURFACE SERVES (THE-ALBARAN-THESIS §0): the app is the day's journey to a
 * correct albarán. Orders became lines upstairs; here the lines become weights, the batches attach,
 * the document releases, and the round takes it out. Four moments, in the order the morning walks
 * them, on one surface — because they are one document getting closer to being true.
 *
 * WHAT THE PUZZLE ASSEMBLES, and none of it is new:
 *   · `print-sheet` (P5) holding F0's own day, its own groupings and its own column set — imported
 *     from F0 rather than rebuilt, so the sheet the warehouse carries and the card that decided it
 *     cannot drift apart.
 *   · `weight-entry` (the timer method, the chevron ladder, the scale photo) opening on the LINE it
 *     belongs to, as its own moment, on an Overlay Card.
 *   · `release` (P6) — the albarán at its last editable moment, with the gate standing above it.
 *   · `drop-list`, `la-entrega` and `round-view` (P6) — the stops, the sweep, and the desk while
 *     the van is out.
 *
 * THE BLEND LAW, DRAWN (THE-ALBARAN-THESIS §0). Weighing is a property of the LINE. The setup's
 * answer decides which lines OPEN with the scale on them, and every line on the document carries
 * the switch either way — a house that weighs the media canal and takes the caja de chorizo as
 * ordered is the normal house, and one albarán carries both.
 *
 * THE GATE IS THE SECTOR'S (LOT-LAW §"What this means" §4). Fish hard-blocks a line until its lote
 * is on it; meat blocks until the line records which box label carries the reference; produce
 * releases on origen and categoría and lets the lote be blank, because most days it legitimately
 * is. The gate SENTENCE says what is required, and the count says how far the document has got.
 *
 * ROUNDS AND `delivery.mode`. A collect house still has a round — its customers come to the
 * counter — so the round is de-emphasised and never removed: it stands one press away, and la
 * entrega moves onto the albarán itself, which is where a counter handover actually happens.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import { Figure } from '../../figure';
import { WeightEntry } from '../../../../rocoto/weight-entry';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { Entrega, THRESHOLD, SIZE as ENTREGA_SIZE } from '../../../../rocoto/la-entrega';
import PrintSheet, { SheetMasthead, SheetFoot } from '../../../../scenarios/canonical/print-sheet';
import Release, { ReleaseState, buildAlbaran, todaysAlbaranes, type Albaran, type AlbaranLine } from '../../../../scenarios/canonical/release';
import DropList, { buildRound, type Stop } from '../../../../scenarios/canonical/drop-list';
import { useDay, setDay, withId } from '../../day';
import RoundView from '../../../../scenarios/canonical/round-view';
import { day as pickingDay, GROUPINGS, keyOf, sortOf, COLUMNS as PICK_COLUMNS, Heading } from '../../../../scenarios/screens/F0';
import type { Grouping } from '../../../../scenarios/screens/F0';
import type { PaperRow } from '../../../../rocoto/paper';
import { lineFacts, type Cast } from '../../../../scenarios/data/cast';
import Name from '../../../../scenarios/shell/Name';
import { useConfig, type Derived } from '../../config';
import { Derivation } from '../../anchors';
import Page from '../../shell/page';
import type { AreaMeta } from '../../shell/area';

export const meta: AreaMeta = {
  id: 'dispatch',
  title: 'Dispatch',
  owner: 'APP-C',
};

/* ── THE SECTION ──────────────────────────────────────────────────────────────────────────────
 * One anatomy for the four moments: a heading that NAMES the moment, the derivation that decided
 * how it opens with its door back to Settings, then the surface. Chrome, and nothing else. */

function Section({
  title,
  derivation,
  aside,
  children,
}: {
  title: React.ReactNode;
  derivation?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{title}</h2>
        {aside}
      </header>
      {derivation}
      {children}
    </section>
  );
}

const card = (theme: ReturnType<typeof useStyletron>[1]): React.CSSProperties => ({
  border: `1px solid ${theme.colors.borderOpaque}`,
  borderRadius: theme.borders.radius400,
  background: theme.colors.backgroundPrimary,
  padding: theme.sizing.scale700,
  minWidth: 0,
});

/* ── THE DAY'S PICKING ────────────────────────────────────────────────────────────────────────
 * F0's sheet, in the app. The grouping control is live here for the same reason it is live there:
 * every warehouse has an opinion about it, and the same rows re-sort under headings that move
 * while the three columns hold their positions. */

function PickingSheet({ cast }: { cast: Cast }) {
  const [, theme] = useStyletron();
  const [grouping, setGrouping] = React.useState<Grouping>('customer');

  const picks = React.useMemo(() => pickingDay(cast), [cast]);

  const rows: PaperRow[] = React.useMemo(() => {
    const sorted = [...picks].sort(sortOf(grouping, cast));
    const out: PaperRow[] = [];
    let held = '';
    for (const pick of sorted) {
      const group = keyOf(grouping, pick);
      if (group !== held) {
        held = group;
        out.push({ id: `h-${group}`, cells: { item: <Heading>{group}</Heading>, for: '', qty: '' } });
      }
      out.push({
        id: pick.id,
        cells: {
          item: <Name of={pick.product} />,
          qty: `${pick.qty} ${pick.unit}`,
          for: (
            <>
              {pick.stop}. <Name of={pick.customer} />
            </>
          ),
        },
        /* A FAMILY WHOSE LINE FIELDS ALREADY NAME THE LOTE printed it twice on the sub-line —
           «lote L-2208 · lote L-2208». One fact, said once. */
        sub: [...(pick.lot ? [{ label: 'lote', value: pick.lot }] : []), ...lineFacts(cast, pick.product)]
          .filter((f, i, all) => f.value && all.findIndex((x) => x.label === f.label) === i),
        note: pick.note ? <em>&ldquo;{pick.note}&rdquo;</em> : undefined,
      });
    }
    return out;
  }, [picks, grouping, cast]);

  const stops = new Set(picks.map((p) => p.customer.id)).size;
  const at = GROUPINGS.findIndex((g) => g.key === grouping);

  return (
    <PrintSheet
      heading="The day's picking"
      standfirst="Everything that has to leave today, in one picker's hands. The same sheet stands on a phone in the cold room."
      controls={
        /* THREE EXPLICIT SEGMENTS. Base keys a Segment by its child's index, and a mapped list
           hands `onChange` a React array key instead — the strip then silently stops selecting. */
        <span data-testid="grouping">
          <SegmentedControl
            activeKey={at}
            onChange={({ activeKey }) => setGrouping(GROUPINGS[Number(activeKey)].key)}
          >
            <Segment label={GROUPINGS[0].label} description={GROUPINGS[0].description} />
            <Segment label={GROUPINGS[1].label} description={GROUPINGS[1].description} />
            <Segment label={GROUPINGS[2].label} description={GROUPINGS[2].description} />
          </SegmentedControl>
        </span>
      }
      aside={
        <span
          data-testid="sheet-count"
          style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}
        >
          {picks.length} lines · {stops} stops
        </span>
      }
      columns={PICK_COLUMNS}
      rows={rows}
      masthead={
        <SheetMasthead
          document="Picking list"
          recipient={`Warehouse · grouped ${GROUPINGS[at].label.toLowerCase()}`}
          day={cast.order.deliveryDay}
          serial={`from ${cast.hour}`}
        />
      }
      runningHead={
        <>
          Picking list · {cast.order.deliveryDay} · grouped {GROUPINGS[at].label.toLowerCase()}
        </>
      }
      foot={
        <SheetFoot
          totals={`${picks.length} lines across ${stops} stops. Every weighed line comes back on the delivery note below.`}
        />
      }
      stageWidth={520}
      height={560}
      action={<Button kind={KIND.primary} size={SIZE.compact}>Print</Button>}
    />
  );
}

/* ── THE DOCUMENT THE DAY IS STILL FORMING ────────────────────────────────────────────────────
 * The strip above this page names it: the last tile, still taking lines. So the weights and the
 * gate below work on THAT document — same number, same customer, same line count — rather than on
 * a second copy of a document the strip has already sent. */

const formingDocument = (cast: Cast): Albaran => {
  const docs = todaysAlbaranes(cast);
  const forming = docs[docs.length - 1];
  /* the number belongs to the DAY's list, so the strip's tile and this screen name one document */
  return { ...buildAlbaran(cast, { customer: forming.customer.id, lines: forming.lines }), number: forming.number };
};

/** WHICH LINES OPEN WITH THE SCALE ON THEM. The setup's answer, per line, and never more than a
 *  starting assumption — the switch is on every row whatever this returns. */
const weighsByDefault = (line: AlbaranLine, derived: Derived): boolean => {
  if (derived.weighing.prompt === 'every-line') return true;
  if (derived.weighing.prompt === 'variable-lines') return line.product.variableWeight;
  return false;
};

/** THE SUPPLIER GAVE NO CODE for these. Deterministic, so the screenshot is the same screenshot
 *  every time, and grounded: LOT-LAW §9 says a synthesized, documented code is what the sector
 *  does and what an inspector accepts. Every third line arrives with the code still to make. */
const supplierGaveNoCode = (i: number) => i % 3 === 1;

/** The published FEDEPESCA convention, `L + iniciales + fecha`, built from the cast: the supplier
 *  the day bought from, and the day itself. Nothing here is typed. */
const synthesizedLot = (cast: Cast, albaran: Albaran): string => {
  const initials = cast.suppliers[0].name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const date = (albaran.day.match(/(\d{2})\.(\d{2})/) ?? ['', '22', '08']).slice(1).join('');
  return `L-${initials}${date}`;
};

/* ── THE WEIGHTS ────────────────────────────────────────────────────────────────────────────── */

type LineState = {
  /** the weight that actually left, in the display unit. Absent = the line leaves as ordered. */
  given?: number;
  /** the line's own weigh switch, when a hand has moved it off the setup's default */
  weighs?: boolean;
  /** the lote a hand attached, where the supplier gave none */
  lot?: string;
};

function WeightRow({
  line,
  index,
  state,
  weighs,
  onToggle,
  onOpen,
}: {
  line: AlbaranLine;
  index: number;
  state: LineState;
  weighs: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const [, theme] = useStyletron();
  const given = state.given;
  const facts = line.trace.filter((f) => f.value).slice(0, 2);

  return (
    <div
      data-line={line.id}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 104px 168px 132px',
        gap: theme.sizing.scale500,
        alignItems: 'center',
        padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
        borderTop: index === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={theme.typography.LabelSmall}>
          <Name of={line.product} />
        </div>
        <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {facts.map((f) => `${f.label} ${f.value}`).join(' · ')}
        </div>
      </div>

      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <Figure value={line.ordered} unit={line.unit} decimals={line.unit === 'kg' ? 1 : 0} size="compact" />
      </span>

      {/* THE LINE'S OWN SWITCH. It is here on every row, whatever the setup answered — a house
          weighs some products and takes others as ordered, and one albarán carries both. */}
      <span data-weighs={weighs ? 'yes' : 'no'} style={{ display: 'flex', gap: theme.sizing.scale200 }}>
        <Button
          kind={weighs ? KIND.primary : KIND.tertiary}
          size={SIZE.mini}
          shape={SHAPE.pill}
          onClick={onToggle}
          aria-pressed={weighs}
          data-testid={`weigh-${line.id}`}
        >
          Weighs
        </Button>
        <Button
          kind={weighs ? KIND.tertiary : KIND.primary}
          size={SIZE.mini}
          shape={SHAPE.pill}
          onClick={onToggle}
          aria-pressed={!weighs}
          data-testid={`asordered-${line.id}`}
        >
          As ordered
        </Button>
      </span>

      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {weighs ? (
          given === undefined ? (
            <Button kind={KIND.secondary} size={SIZE.mini} onClick={onOpen} data-testid={`scale-${line.id}`}>
              Weigh it
            </Button>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              data-testid={`scale-${line.id}`}
              style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
            >
              {/* THE SCALE SPEAKS IN KILOS. On a line the catalogue sells by the kilo it replaces
                  the quantity, and the ordered figure stays legible under it. On a line sold by the
                  caja or the pieza the count is what is charged, so the weight rides the line as a
                  weight and the count stands where it stood. */}
              <Figure
                value={given}
                was={line.unit === 'kg' ? line.ordered : undefined}
                unit="kg"
                decimals={1}
                size="compact"
              />
            </button>
          )
        ) : (
          <Figure value={line.ordered} unit={line.unit} decimals={line.unit === 'kg' ? 1 : 0} size="compact" />
        )}
      </span>
    </div>
  );
}

/* ── THE GATE ─────────────────────────────────────────────────────────────────────────────────
 * What a line has to carry before this document can leave, per LOT-LAW §4 — and the act that gets
 * it there, on the line that is waiting for it.
 *
 * ONE PREDICATE, THREE SECTORS, so the sentence, the count, the waiting rows and the release
 * button can never disagree about what «ready» means. */

const has = (line: AlbaranLine, label: string): boolean =>
  line.trace.some((f) => f.label === label && !!f.value);

export const gateMet = (line: AlbaranLine, gate: Derived['dispatch']['gate']): boolean => {
  if (gate === 'origin+category') return has(line, 'origen') && has(line, 'categoría');
  /* fish and meat both need the reference to reach the buyer; what differs is what carries it,
     and both are recorded on the line as its lote */
  return line.lot !== '';
};

function GateBlock({
  albaran,
  cast,
  derived,
  onAttach,
}: {
  albaran: Albaran;
  cast: Cast;
  derived: Derived;
  onAttach: (lineId: string, lot: string) => void;
}) {
  const [, theme] = useStyletron();
  const gate = derived.dispatch.gate;
  const waiting = albaran.lines.filter((l) => !gateMet(l, gate));
  const ready = albaran.lines.length - waiting.length;
  /* produce releases with a blank lote, and saying WHICH lines those are is the honest version of
     a note that would otherwise read as an excuse */
  const blankLote = gate === 'origin+category' ? albaran.lines.filter((l) => l.lot === '') : [];
  const synth = synthesizedLot(cast, albaran);

  return (
    <div data-testid="gate" style={{ ...card(theme), padding: theme.sizing.scale600, background: theme.colors.backgroundSecondary }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
        <span style={theme.typography.LabelSmall}>{derived.lots.short}</span>
        <span data-testid="gate-count" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {ready} of {albaran.lines.length} lines carry it
        </span>
      </div>

      {waiting.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, marginTop: theme.sizing.scale500 }}>
          {waiting.map((line) => (
            <div
              key={line.id}
              data-waiting={line.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: theme.sizing.scale500,
                flexWrap: 'wrap',
                paddingTop: theme.sizing.scale400,
                borderTop: `1px solid ${theme.colors.borderOpaque}`,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={theme.typography.LabelSmall}>
                  <Name of={line.product} />
                </span>
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block' }}>
                  {/* EACH SECTOR'S OWN SENTENCE. A produce line waiting for nothing must not be
                      told to go and find a box label — that is the meat gate's act, and printing
                      it here sends a picker to a shelf that has no answer on it. */}
                  {gate === 'hard'
                    ? `The supplier sent this one under their own paperwork. The house code follows the trade's convention: initials and the day.`
                    : gate === 'conditional'
                      ? `Record which box label carries the reference, and the line releases.`
                      : line.trace
                          .filter((f) => f.label === 'origen' || f.label === 'categoría')
                          .map((f) => `${f.label} ${f.value}`)
                          .join(' · ')}
                </span>
              </span>

              {gate === 'origin+category' ? (
                /* the line is already releasable: what it carries is the whole of the gate */
                <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
                  Ready
                </Tag>
              ) : gate === 'hard' ? (
                <Button
                  kind={KIND.secondary}
                  size={SIZE.compact}
                  onClick={() => onAttach(line.id, synth)}
                  data-testid={`attach-${line.id}`}
                >
                  Use {synth}
                </Button>
              ) : (
                <span style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
                  {cast.batches.map((b) => (
                    <Button
                      key={b.id}
                      kind={KIND.secondary}
                      size={SIZE.mini}
                      shape={SHAPE.pill}
                      onClick={() => onAttach(line.id, b.id)}
                      data-testid={`attach-${line.id}-${b.id}`}
                    >
                      {b.id}
                    </Button>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {blankLote.length > 0 && (
        <p style={{ margin: `${theme.sizing.scale400} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {blankLote.length === 1 ? 'One line travels' : `${blankLote.length} lines travel`} on origen
          and categoría alone — {blankLote.map((l) => l.product.name).join(' and ')}. A lote joins
          them the day a supplier sends one.
        </p>
      )}
    </div>
  );
}

/* ── THE ROUND ────────────────────────────────────────────────────────────────────────────────
 * The stops, and the desk while the van is out. Two surfaces, one round: the driver's list sweeps
 * a stop, and the desk's view marks only the one thing worth a glance — lateness. */

const HOURS = ['09:00', '10:00', '11:00'];

function TheRound({ cast }: { cast: Cast }) {
  const [, theme] = useStyletron();
  const stops = React.useMemo(() => buildRound(cast), [cast]);
  const [delivered, setDelivered] = React.useState<Record<string, string>>({});
  const [collected, setCollected] = React.useState<Record<string, boolean>>({});
  const [hourAt, setHourAt] = React.useState(2);

  React.useEffect(() => {
    setDelivered({});
    setCollected({});
  }, [cast.sector]);

  const sweep = (stop: Stop) =>
    setDelivered((d) => ({ ...d, [stop.id]: HOURS[hourAt].replace(/:\d\d$/, ':52') }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 360px) minmax(0, 1fr)', gap: theme.sizing.scale700, alignItems: 'start' }}>
      <div data-testid="drop-list" style={card(theme)}>
        <DropList
          stops={stops}
          delivered={delivered}
          onDeliver={sweep}
          collected={collected}
          onCollect={(s) => setCollected((c) => ({ ...c, [s.id]: true }))}
          renderAddress={(s) => (
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
              delivery note {s.albaran}
            </span>
          )}
          title={cast.order.deliveryDay}
          foot={
            <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              Push a row across to mark it delivered. The delivery note travelling with it is signed at the
              door.
            </p>
          }
        />
      </div>

      <div data-testid="round-view" style={card(theme)}>
        <RoundView
          stops={stops.map((s) => ({ ...s, delivered: delivered[s.id] }))}
          hour={HOURS[hourAt]}
          now="10:40"
          control={
            <span data-testid="round-hour" style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale400 }}>
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>
                The round is due by
              </span>
              <SegmentedControl activeKey={hourAt} onChange={({ activeKey }) => setHourAt(Number(activeKey))}>
                <Segment label={HOURS[0]} />
                <Segment label={HOURS[1]} />
                <Segment label={HOURS[2]} />
              </SegmentedControl>
            </span>
          }
        />
      </div>
    </div>
  );
}

/* ── THE SURFACE ──────────────────────────────────────────────────────────────────────────── */

export default function Dispatch() {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const cast = derived.cast;

  const base = React.useMemo(() => formingDocument(cast), [cast]);
  const [lines, setLines] = React.useState<Record<string, LineState>>({});
  const [note, setNote] = React.useState('');
  /* the release is a fact about the DAY, not about this area: the strip and Today hear it */
  const dayEdits = useDay(cast.sector);
  const released = dayEdits.released.includes(base.number);
  const setReleased = (on: boolean) =>
    setDay((prev) => ({ released: on ? withId(prev.released, base.number) : prev.released.filter((n) => n !== base.number) }));
  const [handed, setHanded] = React.useState(false);
  const [openLine, setOpenLine] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<number | null>(null);
  const [roundOpen, setRoundOpen] = React.useState(false);

  /* a different cast is a different morning on a different bench */
  React.useEffect(() => {
    setLines({});
    setNote('');
    setReleased(false);
    setHanded(false);
    setOpenLine(null);
  }, [cast.sector]);

  const weighs = (line: AlbaranLine): boolean => lines[line.id]?.weighs ?? weighsByDefault(line, derived);

  /* THE DOCUMENT AS IT NOW STANDS. Every act on this page lands here: the weight a hand captured,
     the lote a hand attached, and the total the two of them make. */
  const albaran: Albaran = React.useMemo(() => {
    const next = base.lines.map((line, i) => {
      const state = lines[line.id] ?? {};
      const lot = supplierGaveNoCode(i) ? state.lot ?? '' : line.lot;
      const weighed = state.weighs ?? weighsByDefault(line, derived);
      /* the weight replaces the quantity only where the catalogue sells by the kilo; a caja line
         is charged by the count and carries its weight as a weight */
      const sent = weighed && state.given !== undefined && line.unit === 'kg' ? state.given : line.ordered;
      return {
        ...line,
        lot,
        sent,
        trace: line.trace
          .map((f) => (f.label === 'lote' ? { ...f, value: lot } : f))
          .filter((f) => f.value),
      };
    });
    return {
      ...base,
      lines: next,
      total: Math.round(next.reduce((s, l) => s + l.sent * l.price, 0) * 100) / 100,
    };
  }, [base, lines, derived]);

  /* ONE PREDICATE, read here and inside the gate block, so the button and the count agree */
  const held = albaran.lines.filter((l) => !gateMet(l, derived.dispatch.gate)).length;
  const heldWord = derived.dispatch.gate === 'conditional' ? 'box label' : 'lote';

  const open = openLine ? albaran.lines.find((l) => l.id === openLine) : undefined;
  const openBase = openLine ? base.lines.find((l) => l.id === openLine) : undefined;

  return (
    <Page title="Dispatch">
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale1000, minWidth: 0 }}>
        {/* ── 1 · THE SHEET THE WAREHOUSE CARRIES ── */}
        <Section title="The picking sheet">
          <div style={card(theme)}>
            <PickingSheet cast={cast} />
          </div>
        </Section>

        {/* ── 2 · THE WEIGHTS, LINE BY LINE ── */}
        <Section
          title={`Weights on delivery note ${albaran.number}`}
          aside={
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              <Name of={albaran.customer} /> · {albaran.day}
            </span>
          }
          derivation={
            <Derivation q="weighing" align="stack">
              {derived.weighing.label}, and any line can be weighed.
            </Derivation>
          }
        >
          <div data-testid="weight-lines" style={{ ...card(theme), padding: 0 }}>
            {albaran.lines.map((line, i) => (
              <WeightRow
                key={line.id}
                line={line}
                index={i}
                state={lines[line.id] ?? {}}
                weighs={weighs(line)}
                onToggle={() =>
                  setLines((s) => ({ ...s, [line.id]: { ...s[line.id], weighs: !weighs(line) } }))
                }
                onOpen={() => {
                  setDraft(lines[line.id]?.given ?? null);
                  setOpenLine(line.id);
                }}
              />
            ))}
          </div>
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '68ch' }}>
            A weighed line keeps both numbers: what was ordered stays legible under what left, and the
            price follows the weight that left.
          </p>
        </Section>

        {/* ── 3 · THE LAST EDITABLE MOMENT ── */}
        <Section
          title="The release gate"
          derivation={<Derivation q="sector" align="stack">{derived.dispatch.gateLabel}</Derivation>}
        >
          <div style={card(theme)}>
            <Release
              albaran={albaran}
              note={note}
              onNote={setNote}
              linesMaxHeight={320}
              state={<ReleaseState>{released ? 'Released' : 'Forming'}</ReleaseState>}
              aside={
                <GateBlock
                  albaran={albaran}
                  cast={cast}
                  derived={derived}
                  onAttach={(id, lot) => setLines((s) => ({ ...s, [id]: { ...s[id], lot } }))}
                />
              }
              primary={
                released ? (
                  <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Tag
                      closeable={false}
                      kind={TAG_KIND.neutral}
                      hierarchy={HIERARCHY.primary}
                      contentMaxWidth={null}
                    >
                      Delivery Note {albaran.number} released
                    </Tag>
                    <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                      {derived.dispatch.rounds === 'lead'
                        ? 'It travels with the round below.'
                        : 'It waits at the counter with the goods.'}
                    </span>
                  </div>
                ) : (
                  <Button
                    kind={KIND.primary}
                    size={SIZE.compact}
                    disabled={held > 0}
                    onClick={() => setReleased(true)}
                    data-testid="release"
                  >
                    Release delivery note {albaran.number}
                  </Button>
                )
              }
              after={
                held > 0 ? (
                  <span data-testid="held" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                    {/* THE SENTENCE FOLLOWS THE GATE. A meat line is waiting for the box label
                        that carries its reference, and telling its picker it is waiting for a lote
                        sends them to the wrong shelf. */}
                    {held === 1
                      ? `One line takes its ${heldWord} next.`
                      : `${held} lines take their ${heldWord} next.`}
                  </span>
                ) : undefined
              }
              send={
                /* LA ENTREGA ON THE ALBARÁN. A collect house hands over at its own counter, so the
                   handover rides the document rather than a stop on a van's round. */
                released && derived.dispatch.rounds === 'quiet' ? (
                  <div data-testid="counter-entrega" style={{ maxWidth: 420 }}>
                    <Entrega
                      size={ENTREGA_SIZE.large}
                      threshold={THRESHOLD.door}
                      isCompleted={handed}
                      onComplete={() => setHanded(true)}
                      aria-label={`hand delivery note ${albaran.number} over at the counter`}
                      label={
                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={theme.typography.LabelMedium}>
                            <Name of={albaran.customer} /> collects
                          </span>
                          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                            Delivery Note {albaran.number} · {albaran.lines.length} lines
                          </span>
                        </span>
                      }
                      completedLabel={<span>{albaran.customer.name} took it at the counter</span>}
                    />
                  </div>
                ) : undefined
              }
            />
          </div>
        </Section>

        {/* ── 4 · THE ROUND ── */}
        <Section
          title={derived.dispatch.rounds === 'lead' ? 'The day’s round' : 'The pickups'}
          derivation={<Derivation q="delivery" align="stack">{derived.dispatch.roundsLabel}.</Derivation>}
        >
          {derived.dispatch.rounds === 'lead' ? (
            <TheRound cast={cast} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
              <div style={{ ...card(theme), display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
                <span style={theme.typography.LabelMedium}>
                  {buildRound(cast).length} customers come for their goods today
                </span>
                <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '64ch' }}>
                  Each one signs their delivery note at the counter, on the document itself. The round is
                  still here for the days a van goes out.
                </span>
                <span>
                  <Button
                    kind={KIND.secondary}
                    size={SIZE.compact}
                    onClick={() => setRoundOpen((o) => !o)}
                    data-testid="show-round"
                  >
                    {roundOpen ? 'Hide the round' : 'Show the round'}
                  </Button>
                </span>
              </div>
              {roundOpen && <TheRound cast={cast} />}
            </div>
          )}
        </Section>
      </div>

      {/* ── THE WEIGHT, AS ITS OWN MOMENT ────────────────────────────────────────────────────
          The scale is a place you go to and come back from: one line, one number, one decision.
          A bare card, because the card's own action closes it. */}
      <OverlayCard
        isOpen={!!open}
        onClose={() => setOpenLine(null)}
        scrim={SCRIM.dim}
        size={420}
        ariaLabel={open ? `Weigh ${open.product.name}` : 'Weigh'}
      >
        {open && openBase ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600 }}>
            <div>
              <div style={theme.typography.HeadingXSmall}>
                <Name of={open.product} />
              </div>
              <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                <Name of={albaran.customer} /> · delivery note {albaran.number} · lote {open.lot || 'to follow'}
              </div>
            </div>

            <WeightEntry
              key={open.id}
              label="Weight given"
              defaultValue={lines[open.id]?.given ?? undefined}
              /* the comparison row belongs to a line ordered in the unit the scale speaks in;
                 a line ordered by the caja is compared on its count, upstairs on the row */
              ordered={open.unit === 'kg' ? open.ordered : undefined}
              unit="kg"
              scaleReading={openBase.sent}
              onChange={(v) => setDraft(v.kilos)}
            />

            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              data-testid="put-on-line"
              onClick={() => {
                if (draft !== null) {
                  const id = open.id;
                  setLines((s) => ({ ...s, [id]: { ...s[id], given: draft, weighs: true } }));
                }
                setOpenLine(null);
              }}
            >
              Put it on the line
            </Button>
          </div>
        ) : (
          <span />
        )}
      </OverlayCard>
    </Page>
  );
}
