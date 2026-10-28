/* TUS DATOS — what Rocoto has learned of them, what it reads in it, and the round trip out again.
 *
 * ═══ PETER'S THREE DUTIES, IN ONE SEAT (FEED-IA §60) ════════════════════════════════════════
 * «Administration also houses whatever we need to put that has to do with their TRAINING DATA —
 * it's probably about "your data".»
 *
 *   1 · THE LEARNING STATUS   «showing the status of learning their relationships etc., their
 *                             behavior» — what Rocoto holds OF THEM, made checkable.
 *   2 · THE INSIGHTS          twelve of them, named one by one: typical earnings · orders a day ·
 *                             average order value · best customers · fluctuations · best sellers ·
 *                             seasons · what a basket CHANGED · most profitable · most issues ·
 *                             who DROPPED · who orders DIFFERENT things. «So think of this.»
 *   3 · THE PROJECTION        «therefore the customer list will obviously go into our customers
 *                             thing based on updates» — the readings are not trapped here; they
 *                             ride the customer objects on the desk (`areas/customers.tsx`).
 *
 * And the register he set with it: «This is the really heavy stuff now… Do it well, design it
 * well, document it well.»
 *
 * ═══ WHY IT IS ONE SEAT AND NOT TWO (THE-DATA-CANON §1.1) ═══════════════════════════════════
 * Administration's own boundary rule says it holds what is set RARELY, and half of §60's list is
 * daily work — «who dropped their order values and might need attention» is a call-them-today
 * item. The resolution is not a compromise: **the seat is the LEDGER and the desk is the ACTION.**
 * The analysis is read whole here, occasionally, the way an admin seat is read; the actionable
 * readings project onto the Customers book as row lines and narrows, where the work happens.
 * Splitting them would also break the round trip this file was built around — gave → learned →
 * shows → take back — which is the loop that makes the retention dial and `forgetImports` legible.
 *
 * ═══ THE SAFFRON LINE (THE-DATA-CANON §1.3) ═════════════════════════════════════════════════
 * ANALYSIS is Rocoto's own act and carries the `NoticedMark`: the best-customer SELECTION, the
 * profitability reading, every «para atender» card. ARITHMETIC is counting and stays plain ink:
 * facturación, pedidos al día, valor medio, the week's shape, the sellers. A sum is the house's
 * own number, and saffron on a sum would dilute the mark that makes a READING trustworthy.
 *
 * ═══ THE CADENCE (FEED-IA §63) ══════════════════════════════════════════════════════════════
 * «It's not something you have to do constantly. It doesn't really matter.» The computation is a
 * pure fold and recomputes on every read — that is an invisible consistency guarantee. The
 * PRESENTATION is periodic: figures are framed as closed periods and hold still. A number that
 * trembles with every arriving order is a ticker, and the ticker lives in the river.
 *
 * ═══ THE WIREFRAME (§51.24 — regions, contents, type steps, states) ═════════════════════════
 *
 *   ┌─ TUS DATOS · one column, panes:false (the §87 admin exemption) ──────────────────────────┐
 *   │ 1 LO QUE ROCOTO SABE   the import DOOR while nothing is imported · the EVENT card once it │
 *   │                        is (file · when · readback · forgetImports on the same card) ·     │
 *   │                        four COVERAGE facts — LABEL · COUNT «of N» · 2px meter, each one a │
 *   │                        DOOR onto its own derivation card · one method line under the grid │
 *   │                        · what today taught it · the door into the web                     │
 *   │ 2 HOW ACCURATE IT IS   the checkpoint's five internal measures (§9.14) — five COUNT facts │
 *   │                        in the coverage grid's own anatomy, each a DOOR onto the rule and  │
 *   │                        the real documents it was counted over; the HELD one is where the  │
 *   │                        prepared-and-withheld albarán is legible (§9.11) · one method line │
 *   │                        · «Serious mistakes» shipped as a gap, because §28 owns it          │
 *   │ 3 TUS NÚMEROS          three lead Facts, each with a 32px sparkline, an ink delta chip    │
 *   │                        AND ITS OWN METHOD LINE · «Tus semanas» line · «Tus temporadas»    │
 *   │                        (waits for a year) — both charts in thousands, both in a Plot      │
 *   │ 4 TUS CLIENTES         «Tus mejores clientes» · «Los más rentables» — ranked, FILLED      │
 *   │                        magnitude bars scaled to the spread · «Para atender» observation   │
 *   │                        cards DEALT ACROSS THE KINDS, each a door                          │
 *   │ 5 TUS PRODUCTOS        «Los que más vendes» — ranked, with the goods' own faces            │
 *   │ 6 THE GDPR ROUND TRIP  llévatelo todo (six sources, §24.2) · retención · el acuerdo        │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS   HeadingXSmall (a region) · HeadingMedium (a lead figure, tabular) · LabelMedium
 *                (a row, a ranked name, a coverage count) · LabelXSmall (a fact's label, a
 *                count's «of N») · ParagraphSmall (an observation's sentence) · ParagraphXSmall
 *                (evidence, methods).
 *   STATES       NOTHING AT REST: a region renders only where its evidence exists. «Tus
 *                temporadas» waits with an affirmative line and the import door rather than
 *                drawing a chart of one month; «para atender» shows only the readings that fired.
 *   METHOD       EVERY block carries its method line — window, world, cost basis (§63) — and
 *                every NUMBER carries its own, so a reader can attribute a sentence to a figure.
 *   WINDOW       THE ANALYSIS ENDS AT TODAY (§63 · AUDIT-2 C15). The river runs three days of
 *                horizon above today; this seat reads none of them. The cut is `insights.ts`'s
 *                own (`upToToday`), inside every fold, so no surface can plot a day that has
 *                yet to happen.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { LineChart, BarChart } from '../../../../rocoto/charts';
import { useConfig } from '../../config';
import { List, Row, Section } from '../../rows';
import { BringYourHistory, Hydration, KnowsWeb } from '../../knows-web';
import { NoticedMark } from '../../customer-profile';
import { useImport, useKnows, count } from '../../knows';
import { taughtToday, tracesOf } from '../../trace';
import { useDay, plural } from '../../day';
import { useGrants } from '../../grants';
import { buildSales, dayLabelFromId, isDraft, isStanding, policyOf, todayId, type Sale } from '../../sale';
import { accuracyTally, CRITICAL_ERROR_OPEN } from '../../net';
import { Door, openCustomer, openOrder, openProduct, useSetupTail } from '../../anchors';
/* THE STAGE THE HOUSE IS STANDING IN, read (never written) — the seat opens on the upload where
   the journey sent it there (P1-7). */
import { stageOf, useActivationEvents } from '../../activation';
import { Produce } from '../../product-face';
import {
  attentionReadings, attentionSpread, averageOrder, bestCustomers, bestSellers, coverage,
  coverageDetail, coverageMethod, wholeSoles, ordersPerDay, profitables, seasons, typicalTake,
  weekShape, windowWords,
  type AttentionReading, type Coverage, type Level, type Ranked,
} from '../../insights';
import { RETENTIONS, setCompany, useCompany, type Retention } from '../../company';
/* THE RETENTION CLOCK IS DRAWN ONCE, IN `voice.ts` (§137.1 · E195.41). This seat and the phone
   rail's notice are the two places a tenant reads it, and they read the same strings. */
import { RETENTION_OBJECT, retentionClock, retentionPeriod } from '../../voice';
import type { AreaMeta } from '../../shell/area';
/* ── §122 · THE ROUND TRIP OUT ACTUALLY GOES OUT ──────────────────────────────────────────────
   Six Export buttons stood here with no `onClick` at all. The takeout builds off the same folds
   this seat already draws — never a second arithmetic (§0) — and the seat hands them in. */
import { takeAway, type ExportBundle, type ExportId } from '../../export-files';
/* §106 · §127.3 — the derivation card and its method line, lifted out of this file and imported
   back, so the reasoning door on the customer sheet opens THE SAME dive. */
import { DerivationCard, Method } from '../../reasoning-door';
import { useThreads } from '../../shell/threads';
import { priceOn, tierNameOf, tiersOfHouse, useTiers } from '../../tiers';

export const meta: AreaMeta = {
  id: 'data',
  /* PETER'S OWN WORDS (§60: «it's probably about "your data"»), settled 2026-08-26 as UNIFORM
     ENGLISH across the rail. The internal id stays `data` and the glyph stays `data` — §30 glyph
     stability; only the surface name grew. */
  title: 'Your data',
  owner: 'V2-ADMIN',
  /* §87 — an administration seat is a settings surface and scrolls as one column. */
  panes: false,
};

/* ── THE METHOD LINE, AND THE CARD IT BELONGS TO, BOTH LIFTED (§106 · §127.3) ────────────────
 * This seat GREW the §106 derivation card — head, then the rule line, then the house's own record
 * walked through it as real rows. §127.3 asks the customer sheet's reasoning door to open «the
 * same dive», and two derivation cards would be two answers to «why did you do that» — the one
 * question this product cannot afford to answer twice. So the organ moved to `reasoning-door.tsx`
 * beside the affordance that opens it, and this seat is a caller. Same pixels, same testids, one
 * object. `Method` travelled with it: it was private here and private in `activation-web.tsx`, and
 * a third caller is where a private copy stops being defensible.
 */

/* ── A LEAD FIGURE (§2.1–2.3) ─────────────────────────────────────────────────────────────────
 * Label over figure over a 32px sparkline, with the direction as an INK chip beside the number.
 * The Stripe grammar, and the app's own: `Fact`'s anatomy at a promoted step, because these three
 * are what the region is about and the rest of it qualifies them.
 *
 * THE DELTA IS INK AND A GLYPH, NEVER A COLOUR. Direction lives in the ▲/▼ and in the words —
 * colour carries identity, structure carries state, and a green number is a status system.
 */
function Lead({
  label,
  level,
  format,
  testid,
}: {
  label: string;
  level: Level;
  format: (n: number) => string;
  testid: string;
}) {
  const [, theme] = useStyletron();
  const up = level.delta ? level.delta.to >= level.delta.from : undefined;
  const move = level.delta ? Math.abs(level.delta.to - level.delta.from) : 0;

  return (
    <div
      data-lead={testid}
      data-value={level.value}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
        <span
          data-figure={testid}
          style={{
            ...theme.typography.HeadingMedium,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
          }}
        >
          {format(level.value)}
        </span>
        {level.delta && move > 0 && (
          <span
            data-delta={testid}
            data-direction={up ? 'up' : 'down'}
            style={{
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentSecondary,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {up ? '▲' : '▼'} {format(move)} vs. the day before
          </span>
        )}
      </span>
      {/* A SPARKLINE IS A SHAPE, AND TWO POINTS HAVE NONE (§77.2's sibling — the kit's own words
          for this size: «a shape, not a reading»). The window ends at today (C15), so on a ledger
          two days deep the spark drew a bare diagonal slash across the method line under it. It
          returns the moment there is a third reading for it to be the shape of. */}
      {level.spark.length > 2 && (
        <div style={{ position: 'relative', minWidth: 0 }}>
          <LineChart
            size="sparkline"
            title=""
            decimals={0}
            locale="es-ES"
            series={[{ name: label, data: level.spark.map((y, x) => ({ x, y })) }]}
            curve="linear"
          />
        </div>
      )}
      {/* EVERY NUMBER CARRIES ITS OWN METHOD (§63 · AUDIT-2 C33). The three leads used to stand
          over one welded paragraph — «Counted over 619 albaranes… Today's mean: 288 albaranes…» —
          in which no reader could attribute a sentence to a figure, and `ordersPerDay`'s method
          was computed and thrown away. A method belongs UNDER the number it explains. */}
      <Method testid={testid}>{level.method}</Method>
    </div>
  );
}

/* ── A RANKED LIST (§2.4, §2.6, §2.9) ─────────────────────────────────────────────────────────
 * Name · figure · a magnitude bar. The bar is the ranking made scannable and it is the whole
 * chart this needs — a rank is a comparison of five things, and five things do not want axes.
 * Every name is a DOOR (§43), which is what makes a ranking actionable rather than a poster.
 *
 * ═══ THE BAR IS A FILL IN A TRACK, AND IT IS SCALED TO THE SPREAD (§51.14 · AUDIT-2 C34) ═════
 * TWO FAULTS IN ONE MARK, and a screenshot carried both. The bar was a lone 2px rule running
 * under the name — which is EXACTLY the mark this app uses to say *editable*, worn by five rows
 * that are not. And it was drawn as a share of the leader, so «What you sell most» at 100.907 →
 * 93.408 € — a seven per cent spread — printed four rules a reader cannot tell apart.
 *
 * So: a TRACK holds the whole list and a FILL sits in it — two marks, neither of them the entry
 * hairline — and the fill is scaled across the SPREAD of the rows on screen, from the smallest to
 * the largest, with a floor so the last row is still a bar. The bar is the SHAPE of the ranking;
 * the exact figure is stated in full on the row beside it, which is where a number belongs.
 */
/** the shortest a fill may be drawn — under this it stops reading as a bar */
const FILL_FLOOR = 0.12;

/** the row's length in its own list: the spread from the smallest figure to the largest. */
const spreadOf = (rows: Ranked[], figure: number): number => {
  const figures = rows.map((r) => r.figure);
  const low = Math.min(...figures);
  const high = Math.max(...figures);
  if (!(high > low)) return 1;
  return FILL_FLOOR + (1 - FILL_FLOOR) * ((figure - low) / (high - low));
};
function RankedList({
  rows,
  format,
  onOpen,
  face,
  testid,
}: {
  rows: Ranked[];
  format: (n: number) => string;
  onOpen: (id: string) => void;
  /** product rows carry the goods' own face; customer rows do not (§51.2 — a face is a PRODUCT's) */
  face?: boolean;
  testid: string;
}) {
  const [, theme] = useStyletron();
  return (
    <div data-testid={testid} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {rows.map((r) => (
        <div
          key={r.id}
          data-ranked={r.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale200,
            padding: `${theme.sizing.scale400} 0`,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}>
            {face && (
              <span style={{ flex: '0 0 auto', alignSelf: 'center' }}>
                <Produce of={{ name: r.name }} size="mini" />
              </span>
            )}
            <span style={{ ...theme.typography.LabelMedium, flex: 1, minWidth: 0 }}>
              <Door onOpen={() => onOpen(r.id)} label={`Open ${r.name}`} testid={`ranked-${r.id}`}>
                {r.name}
              </Door>
            </span>
            {r.detail && (
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
                {r.detail}
              </span>
            )}
            <span
              style={{
                ...theme.typography.LabelMedium,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
              }}
            >
              {format(r.figure)}
            </span>
          </div>
          {/* THE MAGNITUDE BAR — a 4px track carrying an ink fill. The track is what makes it a
              bar rather than a rule: a mark with a container behind it cannot be read as the
              editable hairline, and the reader can see how much of the list a row holds. */}
          <span
            aria-hidden="true"
            data-bar={r.id}
            style={{
              display: 'block',
              height: 4,
              width: '100%',
              borderRadius: 2,
              background: theme.colors.mono300,
            }}
          >
            <span
              style={{
                display: 'block',
                height: 4,
                width: `${Math.round(spreadOf(rows, r.figure) * 100)}%`,
                borderRadius: 2,
                background: theme.colors.contentPrimary,
              }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── AN OBSERVATION CARD (§2.8, .10, .11, .12) ────────────────────────────────────────────────
 * A sentence, its evidence, and a door. It carries the `NoticedMark` because it is a READING —
 * Rocoto looked at the record and made a claim — and a claim without its evidence beside it is the
 * thing this product exists to replace.
 */
function Observation({ reading }: { reading: AttentionReading }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-reading={reading.kind}
      data-reading-customer={reading.customer}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale200,
        padding: theme.sizing.scale500,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, minWidth: 0 }}>
        <NoticedMark label="Read from your records" />
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary, flex: 1, minWidth: 0 }}>
          <Door onOpen={() => openCustomer(reading.customer)} label={`Open ${reading.name}`} testid={`attend-${reading.customer}`}>
            {reading.name}
          </Door>
          {' — '}
          {reading.line.toLowerCase()}
        </span>
      </span>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
        {reading.evidence}
      </span>
    </div>
  );
}

/* ── A COVERAGE FACT (THE-DATA-CANON §3.3) ────────────────────────────────────────────────────
 * A COUNT, its denominator on the count's own line, and a 2px hairline meter under it.
 *
 * ⚠ AND NEVER A PERCENTAGE. `knows.ts` is the standing law here: an observation is a sentence with
 * evidence, and there is no field that can hold a confidence percentage — a bare percent is the
 * thing this product replaces. So the claim is a count, the meter is that count made scannable,
 * and there is no gauge, no radial dial, and no bar chart of an import.
 *
 * ═══ THE VALUE SLOT HOLDS A NUMBER (§75.8 · AUDIT-2 C33) ════════════════════════════════════
 * It used to hold the whole sentence — «Rhythms → The rhythm of all 296 of your customers.» —
 * so three of the four tiles repeated «296 of your customers» and the fourth repeated its own
 * label inside its value. A stat tile's value is a figure. The sentence still exists: it is the
 * door's own name, and it heads the card the door opens.
 *
 * ═══ AND THE FACT IS A DOOR (§63 · AUDIT-2 C18) ═════════════════════════════════════════════
 * «It should all be decided in front of you live.» Pressing a fact opens the rule the count was
 * made by, with real accounts and real goods walked through it. The seat used to print «Every
 * figure opens.» under four facts that had no door at all — the sentence is gone and the doors
 * are here, which is the half of that promise worth keeping.
 */
/* ═══ IT IS ONE COMPONENT NOW, AND ACCURACY IS ITS SECOND CALLER (§27.5) ══════════════════════
 * §9.14's five internal measures want exactly this anatomy — a count, its denominator on the
 * count's own line, a 2px meter, and a door onto the rule the count was made by — and a second
 * copy of it forty lines down would be two places the «never a percentage» law has to be kept.
 * So the props became the four primitives it always read, and both regions call it.
 */
function CountFact({
  id,
  label,
  held,
  of,
  words,
  onOpen,
  kind,
}: {
  id: string;
  label: string;
  held: number;
  of: number;
  /** the door's own name, and the heading of the card it opens */
  words: string;
  onOpen: () => void;
  /** which register this fact belongs to, so a drive and a reader can tell them apart */
  kind: 'coverage' | 'accuracy';
}) {
  const [, theme] = useStyletron();
  const share = of > 0 ? Math.min(1, held / of) : 0;
  return (
    <div
      data-coverage={kind === 'coverage' ? label : undefined}
      data-accuracy-fact={kind === 'accuracy' ? id : undefined}
      data-held={held}
      data-of={of}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{label}</span>
      {/* THE DENOMINATOR SHARES THE COUNT'S OWN LINE. A figure whose «of 296» drops to a line
          underneath is read as the figure alone — the same mis-read the price-unit law names. */}
      <span
        data-count={id}
        style={{
          ...theme.typography.LabelMedium,
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.sizing.scale200,
          flexWrap: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 0,
        }}
      >
        <Door onOpen={onOpen} label={words} testid={`${kind}-${id}`}>
          {count(held)}
        </Door>
        <em
          style={{
            ...theme.typography.LabelXSmall,
            color: theme.colors.contentTertiary,
            fontStyle: 'normal',
            whiteSpace: 'nowrap',
          }}
        >
          of {count(of)}
        </em>
      </span>
      <span
        aria-hidden="true"
        style={{ display: 'block', height: 2, borderRadius: 2, background: theme.colors.mono300, minWidth: 0 }}
      >
        <span style={{ display: 'block', height: 2, width: `${Math.round(share * 100)}%`, borderRadius: 2, background: theme.colors.contentPrimary }} />
      </span>
    </div>
  );
}

/** the region grid the facts and leads stand on — one shape, three regions */
function Grid({ children, testid }: { children: React.ReactNode; testid: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: theme.sizing.scale600,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ── THE PLOT'S OWN GUTTERS (§77.2 · AUDIT-2 C14, C29) ────────────────────────────────────────
 * An SVG root clips at its own edge, and the chart kit's compact frame reserves 32px on the left
 * and 14px on the right for its ticks. Two labels ran past that and were cut mid-glyph: the
 * season chart's value axis printed «.000 / .000 / 0», the leading digits of 500.000 and 1.000.000
 * eaten by the left gutter so two ticks carried the identical unreadable label; and the week
 * chart's last day printed «mon 2», the 5 sliced at the right edge, under a caption naming 25.
 *
 * TWO FIXES, AND THE FIRST IS THE UNIT. Both charts are read in THOUSANDS, and the method line
 * says so in words — the answer «Your weeks» already carried and «Your seasons» was still fed raw
 * soles against. The exact figures are stated in full where a figure belongs: the leads above.
 *
 * THE SECOND IS THIS BOX: paper reserved on both sides of the plot, with the SVG's own clip
 * lifted so a tick that runs past the frame lands on that paper instead of being sliced. It is a
 * container decision, so it is made here and the chart kit stays the chart kit. The clip lives on
 * an element this seat does not render, which is the one thing a style object cannot reach — the
 * same instrument, and the same reason, as the frame's thin-scrollbar sheet.
 */
function PlotPaper() {
  return (
    <style
      data-testid="plot-gutters"
      dangerouslySetInnerHTML={{ __html: '[data-plot] svg { overflow: visible; }' }}
    />
  );
}

function Plot({ children, testid }: { children: React.ReactNode; testid: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-plot="yes"
      data-testid={testid}
      style={{
        position: 'relative',
        minWidth: 0,
        paddingLeft: theme.sizing.scale800,
        paddingRight: theme.sizing.scale800,
      }}
    >
      {children}
    </div>
  );
}

/** A DAY, SHORT ENOUGH FOR AN AXIS. The app's own day label, cut to the two parts a person reads
 *  on a chart — «vie 22» — because a full ISO date under every point is five labels of noise. */
const shortDay = (id: string): string => {
  const words = dayLabelFromId(id);
  const bits = words.split(/\s+/);
  return bits.length > 1 ? `${bits[0].slice(0, 3).toLowerCase()} ${bits[bits.length - 1].split('.')[0]}` : words;
};

/** what leaves, when a house asks for everything. Six real objects, named as the app names them
 *  everywhere else — a promise made in the app's own nouns is a promise a person can check.
 *
 *  THE SUBS ARE THE SAME LENGTH ON PURPOSE (§77.2). They stand in one List, so an eight-word line
 *  beside a fourteen-word one is a row that is taller than its neighbours for no reason a reader
 *  can see. Written to one measure, the rows keep one height at every width.
 *
 *  THE LAST THREE ARE THE CHECKPOINT'S (§24.2 · MAP 24.2). «Sources: products · customers · orders
 *  · albaranes · pricing · WhatsApp · email · supplier · ERP.» Three of the nine had no row: the
 *  catalogue itself, pricing as a SERIES rather than as today's sheet, and what came in from
 *  suppliers. A round trip that gave back less than it took is the one thing this region may not
 *  be. */
const EXPORTS: Array<{ id: ExportId; label: string; sub: string }> = [
  { id: 'customers', label: 'Your customers', sub: 'Every account, with what each takes and when.' },
  { id: 'orders', label: 'Your orders and delivery notes', sub: 'Every document, with its lines, lotes and stamps.' },
  { id: 'transcripts', label: 'Your conversations', sub: 'What was said, on WhatsApp and on the phone.' },
  { id: 'catalogue', label: 'Your catalogue', sub: 'Every product, with its code, unit and pack.' },
  { id: 'prices', label: 'Your prices', sub: 'Every tarifa and every price, day by day.' },
  { id: 'incoming', label: 'Your suppliers and goods in', sub: 'Every lote that landed, with its cost and day.' },
];

/* ═══ HOW ACCURATE IT IS — THE FIVE INTERNAL MEASURES (THE CHECKPOINT §9.14) ══════════════════
 * «Customers repeatedly ask: "How accurate is it?" and "Will it know when not to reply and tell me
 * that I need to step in?"» Both questions are answered here, off the ledger, in the grammar this
 * seat already speaks: a COUNT with its denominator on the count's own line, a hairline meter, and
 * a door onto the rule the count was made by, with real documents walked through it.
 *
 * ⚠ AND NEVER A PERCENTAGE, for the same reason the coverage facts above carry none: a bare
 * percent is the thing this product replaces. Four of §9.14's five are counted here; the fifth —
 * what counts as a SERIOUS mistake — has no definition yet and the row says so in words.
 */
type Measure = {
  id: string;
  /** the fact's own label, above the count */
  label: string;
  held: number;
  of: number;
  /** the door's name and the card's heading */
  words: string;
  /** the rule the count was made by, stated where a stranger can hold the figure to it */
  rule: string;
  /** the documents it was counted over — the derivation, walked */
  walk: Sale[];
};

/** the handful a card walks. The derivation, never a dump of six hundred rows. */
const WALK = 5;

/** DEALT ACROSS THE VERDICTS, the way «para atender» is dealt across its kinds (`attentionSpread`).
 *  The first five held documents of a morning are whatever the hours happened to produce — five
 *  holds in a row says nothing about clarifying or handing over, and the whole point of the card
 *  is to show what «held» actually covers. So one is taken from each verdict in turn until the
 *  handful is full, and a morning that reached only one verdict still fills it from that one. */
function spreadByPolicy(sales: Sale[], take: number): Sale[] {
  const lanes = new Map<string, Sale[]>();
  for (const s of sales) {
    const id = policyOf(s).id;
    const lane = lanes.get(id);
    if (lane) lane.push(s);
    else lanes.set(id, [s]);
  }
  const out: Sale[] = [];
  const queues = [...lanes.values()];
  for (let round = 0; out.length < take; round += 1) {
    const before = out.length;
    for (const q of queues) {
      if (out.length >= take) break;
      if (q[round]) out.push(q[round]);
    }
    if (out.length === before) break;
  }
  return out;
}

export default function Data() {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const company = useCompany();
  const cast = derived.cast;
  const knows = useKnows(cast);
  const ledger = useDay(cast.sector);
  const grants = useGrants();
  const imported = useImport(cast.sector);
  const events = useActivationEvents();
  const [history, setHistory] = React.useState(false);
  const [web, setWeb] = React.useState(false);
  const [keepCard, setKeepCard] = React.useState(false);

  /* ── THE SEAT OPENS ON THE UPLOAD WHERE IT WAS SENT TO IT (the walk, P1-7) ───────────────────
   * The journey's own review card promises «Rocoto opens on the upload» and the step landed a
   * person mid-page with the door still shut. Two halves, and this is both of them:
   *
   *   THE TAIL. `#/admin/data/upload` opens «Bring your history» on arrival — the same grammar
   *   every other setup door in the app already uses (`anchors.tsx`), so a step, a mail or a
   *   support link can send somebody to the act rather than to the seat.
   *   THE STAGE. A house whose year is ON ITS WAY IN and has not arrived has exactly one thing to
   *   do on this seat, and the step that sent them here says so. So the door opens once on arrival
   *   in that state, and closing it is a complete answer — it is not re-opened while the seat
   *   stands, which is what makes it an arrival and not a trap.
   */
  const tail = useSetupTail('data');
  const opened = React.useRef(false);
  React.useEffect(() => {
    if (opened.current) return;
    const waiting = !imported && stageOf(cast.sector, events, imported) === 'uploading';
    if (tail !== 'upload' && !waiting) return;
    opened.current = true;
    setHistory(true);
  }, [tail, cast.sector, events, imported]);
  /* WHICH FACT IS OPEN (§63 · C18). One card at a time, named by the fact's own id. */
  const [openFact, setOpenFact] = React.useState<Coverage | null>(null);

  /* ONE FOLD OF THE DAY, HANDED DOWN. Every region below is a reading of the same `sales`, so the
     seat can never say two different things about one morning — the house law of the fold. */
  const sales = React.useMemo(() => buildSales(cast, ledger), [cast, ledger, grants]);

  const take = React.useMemo(() => typicalTake(cast, sales), [cast, sales]);
  const orders = React.useMemo(() => ordersPerDay(cast, sales), [cast, sales]);
  const average = React.useMemo(() => averageOrder(cast, sales), [cast, sales]);
  const week = React.useMemo(() => weekShape(cast, sales), [cast, sales]);
  /* THE SEASONS READ THE IMPORTED LEDGER (§4, §6.4) — eleven minted months plus the live one. Every
     other fold on this seat is a read of `sales` alone; this is the one that also reads the EVENT,
     because a season is the one thing five days of a morning cannot hold. */
  const season = React.useMemo(() => seasons(cast, sales, imported), [cast, sales, imported]);
  /* ── THE SEAT ASKS FOR THE SEAT'S OWN WINDOWS (FEED-IA §106.2 · insights.ts's two registers) ──
     «The Wrapped is the MOMENT, the seat is the LEDGER — one number set, two registers.» The two
     rankings are the ones that differ: the reveal ranks the imported YEAR under its year curve, and
     this seat ranks the month a person is standing in and the days the river holds, because this is
     the working surface about their morning. The window is named here rather than assumed, so the
     seat can never silently inherit somebody else's. */
  const best = React.useMemo(() => bestCustomers(cast, sales, 5, 'month'), [cast, sales]);
  const profit = React.useMemo(() => profitables(cast, sales), [cast, sales]);
  const sellers = React.useMemo(() => bestSellers(cast, sales, 5, 'live'), [cast, sales]);
  const attention = React.useMemo(() => attentionReadings(cast, sales), [cast, sales]);
  /* THE COVERAGE READS THE HYDRATED LEDGER (§60 · C5). The fed card and the four facts beside it
     are one reading of one book: the moment an import lands, the counts under it are the imported
     book's own — never the 296-account sample still standing in an event that named 2.667. */
  const cover = React.useMemo(() => coverage(cast, imported), [cast, imported]);

  /* HOW MANY CORRECTIONS THIS MORNING TAUGHT (§33.2 item 5). Read off the day's own ledger through
     `trace.ts`, and SUBSCRIBED to (`useDay`) — a count read out of a module singleton without
     subscribing is a number that is right once and then quietly wrong. */
  const taught = React.useMemo(() => taughtToday(cast), [cast, ledger]);
  const retention = RETENTIONS.find((r) => r.value === company.retention) ?? RETENTIONS[1];
  const clock = retentionClock(company.retention);

  /* ── HOW ACCURATE IT IS (§9.14) ────────────────────────────────────────────────────────────
     ONE FOLD OF THE DAY, AGAIN. The tally reads the same `sales` every region above reads and the
     same trace corpus the «What today taught it» row counts, so this seat can never say the
     morning went two ways. */
  const today = React.useMemo(() => todayId(cast), [cast]);
  const traces = React.useMemo(() => tracesOf(cast), [cast, ledger]);
  const acc = React.useMemo(
    () => accuracyTally(sales, today, traces),
    [sales, today, traces],
  );
  const [openMeasure, setOpenMeasure] = React.useState<string | null>(null);

  /* ── WHAT A TAKEOUT IS MADE OF (§122 · §24.2) ───────────────────────────────────────────────
     The six files are six readings of THIS seat's own folds — `sales` is the one every region
     above reads, the cast is the book, the threads are the conversations, and the price reader is
     handed in rather than imported into `export-files.ts`, so the takeout can never become a
     second pricing opinion. */
  useTiers();
  const threads = useThreads(cast);
  const bands = React.useMemo(() => tiersOfHouse(cast), [cast]);
  const takeout: ExportBundle = React.useMemo(() => ({
    cast,
    sales,
    threads,
    tiers: bands,
    priceOn: (product, tier) => priceOn(cast, product, tier, today),
    tierNameOf: (id) => tierNameOf(cast, id),
    today,
  }), [cast, sales, threads, bands, today]);
  /** how big each file was, said in the control's own seat once it has gone (§76, §59.1) */
  const [took, setTook] = React.useState<Partial<Record<ExportId, number>>>({});

  const measures: Measure[] = React.useMemo(() => {
    /* the same cut the tally makes: a draft is not a decision (§74.4) */
    const day = sales.filter((s) => s.day === today && !isDraft(s));
    const touched = new Set(traces.map((t) => t.saleId));
    const held = day.filter((s) => policyOf(s).id !== 'act');
    return [
      {
        id: 'read',
        label: 'Read as it arrived',
        held: acc.read,
        of: acc.orders,
        words: 'Documents read as received',
        rule: 'Today’s delivery notes that stood as read were received.',
        walk: day.filter((s) => !touched.has(s.id)).slice(0, WALK),
      },
      {
        id: 'alone',
        label: 'Confirmed alone',
        held: acc.alone,
        of: acc.orders,
        words: 'Documents confirmed on arrival',
        rule: 'Confirmed on arrival after every check passed, with the figures as read.',
        walk: day.filter((s) => s.autoCommitted).slice(0, WALK),
      },
      {
        id: 'held',
        label: 'Held for a person',
        held: acc.held,
        of: acc.orders,
        words: 'Prepared and waiting for review',
        rule: 'The delivery note is ready and waiting: a question is already out to the customer, the desk owes a fact, or a named person needs to respond.',
        walk: spreadByPolicy(held, WALK),
      },
      {
        id: 'settled',
        label: 'Settled after a hold',
        held: acc.settled,
        of: acc.held,
        words: 'Holds somebody has already answered',
        rule: 'Of the held documents, the ones already answered.',
        walk: held.filter((s) => !isStanding(s, today)).slice(0, WALK),
      },
      {
        id: 'corrected',
        label: 'Put right by hand',
        held: acc.corrected,
        of: acc.orders,
        words: 'Documents corrected by hand',
        rule: 'Every word put back, unit flipped, note written and amount filled, counted by the document it happened on.',
        walk: day.filter((s) => touched.has(s.id)).slice(0, WALK),
      },
    ];
  }, [sales, today, traces, acc]);

  const measure = measures.find((m) => m.id === openMeasure) ?? null;

  return (
    <div
      data-testid="seat-data"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale1000, minWidth: 0 }}
    >
      <PlotPaper />
      {/* ═══ 1 · LO QUE ROCOTO SABE ══════════════════════════════════════════════════════════
          THE DOOR LEADS THE REGION (THE-DATA-CANON §4.2). Before an import the only true thing to
          say is what an import would buy, so the DropDoor itself is the first thing on the seat —
          not a row that opens a card that holds a door. Accepting a file then performs on THIS
          surface: the bar on the card's top edge, the three beats, and the readback card standing
          as the permanent event with `forgetImports` beside it.

          THE ROW THAT USED TO STAND HERE IS GONE, and that is the §60 point: hydration is a moment
          the person is IN, not a setting they visit. The fuller card — the web, the samples — is
          still one press away on the rows below. */}
      {/* THE SECTION LEAD IS GONE (THE-CONTENT-CANON §4 — kill the slot, never write shorter prose
          into it). The heading names the thing and the card directly under it states the
          proposition once; the lead was the second of three sentences saying the same thing. */}
      <Section title="Imported history" testid="learning">
        {/* NO `lead` HERE ON PURPOSE (THE-CONTENT-CANON §9 item 3): the sentence lives once, as
            `WHAT_A_YEAR_TEACHES` on the drop door itself, and this seat takes the default. */}
        <Hydration
          cast={cast}
          testid="hydration"
          onOpenWeb={() => setWeb(true)}
        />

        <Grid testid="coverage-facts">
          {cover.map((c) => (
            <CountFact
              key={c.id}
              kind="coverage"
              id={c.id}
              label={c.label}
              held={c.held}
              of={c.of}
              words={c.words}
              onOpen={() => setOpenFact(c)}
            />
          ))}
        </Grid>
        {/* «Every figure opens.» IS GONE FROM THIS LINE (C18). It was a promise the surface did
            not keep, and the door on each count now says it better than a sentence can. What is
            left is the method: what the four facts were counted over, and it moves with the
            import exactly as they do. */}
        <Method testid="coverage">{coverageMethod(cast, imported)}</Method>

        <List testid="learning-rows">
          {/* NOTHING AT REST. The row exists from the first correction onwards, which is the first
              moment it says anything — «0 correcciones» is a line spent on an absence. */}
          {taught > 0 && (
            <Row
              testid="taught"
              mark="archive"
              label="Corrections today"
              sub={`${taught} ${plural(taught, 'correction')} recorded.`}
              value="Open"
              wrapValue
            />
          )}
          {/* ONE INTAKE DOOR, AND THIS ROW IS NOT IT (§4.1). The organ above is where a file lands;
              this card is where the import is READ — the three sample patterns it taught, and the
              customer it taught them about. It appears once there is an import to read. */}
          {knows.imported && (
            <Row
              testid="history"
              mark="archive"
              label="Imported patterns"
              sub="Order patterns from imported delivery notes."
              value="Open"
              onOpen={() => setHistory(true)}
            />
          )}
          <Row
            testid="knows-web"
            mark="who"
            label="Customer product links"
            sub="Products linked to customer histories."
            value="Open"
            onOpen={() => setWeb(true)}
          />
        </List>
      </Section>

      {/* ═══ 2 · HOW ACCURATE IT IS (THE CHECKPOINT §9.14) ═══════════════════════════════════
          It stands directly under what Rocoto KNOWS, because it is the next question a person
          asks of that: this is what it did with it. Every fact is a count with its denominator on
          the count's own line, and every one of them opens the rule it was counted by. */}
      <Section title="Accuracy and review" testid="accuracy">
        {/* THE FOUR VERDICTS ARE STATED ON THE DOM, AND DRAWN NOWHERE. `policyOf` names every
            decision ACT · CLARIFY · HOLD · HANDOFF, and those are the machine's words: a review
            row speaks the reading and the rubric chip, and a person never meets a policy in caps
            (§10.10). The counts ride the region so a drive — and the test panel that comes after
            this — can read what was decided without a surface having to shout it. */}
        <div
          data-accuracy="yes"
          data-orders={acc.orders}
          data-policy-act={acc.policy.act ?? 0}
          data-policy-clarify={acc.policy.clarify ?? 0}
          data-policy-hold={acc.policy.hold ?? 0}
          data-policy-handoff={acc.policy.handoff ?? 0}
          style={{ display: 'contents' }}
        >
          <Grid testid="accuracy-facts">
            {measures.map((m) => (
              <CountFact
                key={m.id}
                kind="accuracy"
                id={m.id}
                label={m.label}
                held={m.held}
                of={m.of}
                words={m.words}
                onOpen={() => setOpenMeasure(m.id)}
              />
            ))}
          </Grid>
        </div>
        <Method testid="accuracy">
          {dayLabelFromId(today)} · each figure opens its supporting delivery notes.
        </Method>

        {/* THE FIFTH MEASURE SHIPS AS A GAP, which is the only honest form it has: what counts as
            a serious mistake is a call about this house's own trade, and a count against a
            threshold nobody set would be the software inventing the standard it grades itself by.
            The seat's own precedent is «Tus temporadas», which waits the same way. */}
        <List testid="accuracy-rows">
          <Row
            testid="critical"
            mark="flag"
            label="Serious mistakes"
            sub={CRITICAL_ERROR_OPEN}
            value="Yours to set"
            wrapValue
          />
        </List>
      </Section>

      {/* ═══ 3 · TUS NÚMEROS — arithmetic, plain ink ═════════════════════════════════════════ */}
      <Section title="Your numbers" testid="numbers">
        <Grid testid="number-leads">
          <Lead label="Today’s takings" level={take} format={wholeSoles} testid="take" />
          <Lead label="Orders a day" level={orders} format={(n) => count(Math.round(n))} testid="orders" />
          <Lead label="Average order value" level={average} format={wholeSoles} testid="average" />
        </Grid>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
          <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>Your weeks</h3>
          {/* ── THE AXIS HAS TO FIT, AND A SCREENSHOT SAID IT DID NOT ────────────────────────
              A six-figure day total printed «.000» down the left edge: at SIZE.compact the frame
              reserves a fixed gutter for its value axis, and «237.997» does not fit in it. The
              honest fix is not a bigger chart — it is the unit the axis is READ in. A week's shape
              is read in thousands, the method line says so in words, and every label is three
              characters. The figures themselves are stated exactly, in full, in the leads above. */}
          <Plot testid="week-chart">
            <LineChart
              title=""
              size="compact"
              decimals={0}
              locale="es-ES"
              curve="linear"
              /* ONE LABEL PER DAY (C15's aftermath). The window is now the days that have
               happened, and on a short window the axis asks for more ticks than there are
               points — so it asked for x = 0.4 and 0.8 and got «thu 21» three times over. A
               label is drawn where a READING is, and nowhere else. */
            formatX={(x) => (Math.abs(x - Math.round(x)) < 1e-6 ? shortDay(week.labels[Math.round(x)] ?? '') : '')}
              series={[{ name: 'This week', data: week.now.map((y, x) => ({ x, y: Math.round(y / 1000) })) }]}
            />
          </Plot>
          <Method testid="week">{week.method} In thousands of soles.</Method>
        </div>

        {/* ⚠ THE SEASON REGION WAITS, AND THE WAIT IS THE HONEST ANSWER. The ledger holds one
            month; a twelve-bar chart of one month is a picture of nothing. So it says what would
            fill it and offers the door — a gap shipped as a gap.
            AND THE WAIT IS ONE SURFACE, NOT TWO (THE-DATA-CANON §2.0f). The sentence and the door
            ARE the form a gap takes; a method line under them was the same fact in a second
            wording, so `seasons()` returns none while it waits and this draws none. The footnote
            comes back with the chart it qualifies. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
          <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>Your seasons</h3>
          {season.months.length >= 2 ? (
            <Plot testid="season-chart">
              {/* THE SAME THOUSANDS THE LINE CHART ABOVE ALREADY READS IN (C14). Fed raw soles,
                  this axis printed «.000 / .000 / 0» — two ticks with one unreadable label. The
                  unit leaves the bars' own scale and goes into the method line, which is where a
                  unit that applies to every mark on a chart belongs. */}
              <BarChart
                title=""
                size="compact"
                decimals={0}
                locale="es-ES"
                data={season.months.map((m) => ({ label: m.label, value: Math.round(m.value / 1000) }))}
              />
            </Plot>
          ) : (
            <div data-testid="season-waiting" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
              <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '58ch' }}>
                A year of delivery notes draws your seasons, month by month.
              </span>
              {/* THE BUTTON WALKS TO THE ONE DOOR, IT DOES NOT OPEN A SECOND ONE (§4.1). A surface
                  with two ways to accept a file has two grammars for the same act, and the second
                  one is the one that rots. */}
              <div>
                <Button
                  kind={KIND.secondary}
                  size={SIZE.compact}
                  data-testid="season-import"
                  onClick={() => document.querySelector('[data-testid="hydration"]')?.scrollIntoView({ block: 'center' })}
                >
                  Bring your history
                </Button>
              </div>
            </div>
          )}
          {season.method && <Method testid="season">{season.method} In thousands of soles.</Method>}
        </div>
      </Section>

      {/* ═══ 4 · TUS CLIENTES — analysis, Rocoto's own readings ══════════════════════════════ */}
      <Section title="Your customers" testid="customers-region">
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, ...theme.typography.LabelMedium }}>
            <NoticedMark label="Based on your records" />
            Your best customers
          </h3>
          <RankedList rows={best.rows} format={wholeSoles} onOpen={openCustomer} testid="best-customers" />
          <Method testid="best">{best.method}</Method>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, ...theme.typography.LabelMedium }}>
            <NoticedMark label="Based on your records" />
            The most profitable
          </h3>
          <RankedList rows={profit.rows} format={wholeSoles} onOpen={openCustomer} testid="profitables" />
          <Method testid="profit">{profit.method}</Method>
        </div>

        {attention.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
            <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>Need attention</h3>
            <div
              data-testid="attention"
              data-count={attention.length}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: theme.sizing.scale400, minWidth: 0 }}
            >
              {attentionSpread(attention, 6).map((r) => (
                <Observation key={`${r.customer}-${r.kind}`} reading={r} />
              ))}
            </div>
            {/* THE PROJECTION'S OWN DOOR (§60.3). The seat is the ledger; the desk is the action —
                so the region ends by walking the person to the book with the narrow already on. */}
            <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
              <Button
                kind={KIND.secondary}
                size={SIZE.compact}
                data-testid="to-attend"
                onClick={() => { window.location.hash = '#/customers/narrow/attend'; }}
              >
                See all {attention.length} in your book
              </Button>
            </div>
            <Method testid="attention">
              Read over each customer’s last five delivery notes and the delivery notes of{' '}
              {windowWords(cast, sales)}. One reading per customer: the one that most wants a call.
            </Method>
          </div>
        )}
      </Section>

      {/* ═══ 5 · TUS PRODUCTOS ══════════════════════════════════════════════════════════════
          The goods carry their own faces here — a painting is the PRODUCT's identity (§51.2), and
          this is a product context, which is exactly where it is licensed. */}
      <Section title="Your products" testid="products-region">
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
          <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>What you sell most</h3>
          <RankedList rows={sellers.rows} format={wholeSoles} onOpen={openProduct} face testid="best-sellers" />
          <Method testid="sellers">{sellers.method}</Method>
        </div>
      </Section>

      {/* ═══ 6 · THE ROUND TRIP OUT ═════════════════════════════════════════════════════════
          Unchanged, and it is the reason the analysis lives on this seat: gave → learned → shows
          → take back is ONE loop, and the last leg is what makes the first honest. */}
      {/* THE SECTION LEAD IS GONE (THE-CONTENT-CANON §4). Each row already names its file and
          carries its own Export button; the sentence above them narrated the list. */}
      <Section title="Take it all with you" testid="export">
        <List testid="export-rows">
          {EXPORTS.map((e) => (
            <Row
              key={e.id}
              testid={`export-${e.id}`}
              mark="export"
              label={e.label}
              sub={e.sub}
              /* ── AND THE BUTTON DOES THE THING IT IS NAMED AFTER (§122) ──────────────
                 All six of these stood without an `onClick`: a control that named a file and
                 produced nothing. A dead VALUE only fails to answer; a dead BUTTON makes a
                 promise and breaks it — and it broke this region's own reason for existing,
                 «the last leg is what makes the first honest». One press writes the CSV.
                 THE ACT SAYS SO, ONCE (§76). A download leaves nothing on the screen, so the
                 row states what went — «2.140 rows» — in the control's own seat, never a
                 second row under it (§59.1). */
              control={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale300, paddingRight: theme.sizing.scale500, flex: '0 0 auto' }}>
                  {took[e.id] !== undefined && (
                    <span
                      data-testid={`export-${e.id}-took`}
                      style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}
                    >
                      {count(took[e.id] ?? 0)} {plural(took[e.id] ?? 0, 'row')}
                    </span>
                  )}
                  <Button
                    kind={KIND.tertiary}
                    size={SIZE.mini}
                    shape={SHAPE.pill}
                    data-testid={`export-${e.id}-go`}
                    onClick={() => setTook((was) => ({ ...was, [e.id]: takeAway(e.id, takeout, cast.house.name) }))}
                  >
                    Export
                  </Button>
                </span>
              }
            />
          ))}
        </List>
      </Section>

      {/* ═══ ONE ANSWER TO «HOW LONG DO YOU KEEP MY CALLS» (§195 · E195.41) ══════════════════
          This section held ONE row, «Recordings and transcripts», and quoted the dial for both —
          while the phone rail's retention notice said audio goes the moment its transcript is
          ready and the transcript lives twelve months. Two answers, same tenant, same app.
          The dial governs the TRANSCRIPT and says so by its own label; audio is VOICE-09B's
          custody rule rather than a choice, so it stands here as a fact in the phone rail's own
          words — `retentionClock()` draws both surfaces, so they cannot drift apart again. */}
      <Section title="How long conversations are kept" testid="retention">
        <List testid="retention-rows">
          <Row
            testid="retention"
            mark="clock"
            label={RETENTION_OBJECT.transcript}
            sub={retention.sub}
            value={retentionPeriod(clock, RETENTION_OBJECT.transcript)}
            wrapValue
            onOpen={() => setKeepCard(true)}
          />
          <Row
            testid="retention-audio"
            mark="clock"
            label={RETENTION_OBJECT.audio}
            value={retentionPeriod(clock, RETENTION_OBJECT.audio)}
            wrapValue
          />
          <Row
            testid="retention-pending"
            mark="clock"
            label={RETENTION_OBJECT.pending}
            value={retentionPeriod(clock, RETENTION_OBJECT.pending)}
            wrapValue
          />
        </List>
      </Section>

      <Section title="The agreement" testid="dpa">
        <List testid="dpa-rows">
          <Row
            testid="dpa"
            mark="doc"
            label="Data processing agreement"
            sub="How signed data processing applies to your records."
            value="Signed"
            onOpen={() => { window.location.hash = '#/admin/plan'; }}
          />
        </List>
      </Section>

      <BringYourHistory isOpen={history} onClose={() => setHistory(false)} cast={cast} />
      <KnowsWeb isOpen={web} onClose={() => setWeb(false)} cast={cast} />

      {/* ═══ WHERE A COUNT COMES FROM (§63 · AUDIT-2 C18) ══════════════════════════════════
          «It should all be decided in front of you live, and an interaction can be evident from
          it.» The card states the RULE the count was made by and then walks the house's own
          accounts and goods through it, each one a door of its own — the derivation, not a dump
          of the rows behind a number. */}
      <OverlayCard
        isOpen={openFact !== null}
        onClose={() => setOpenFact(null)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel={openFact?.words ?? 'Where a count comes from'}
      >
        {openFact && (
          <div
            data-testid="coverage-card"
            data-coverage-card={openFact.id}
            style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{openFact.label}</h2>
              <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
                {openFact.words}
              </span>
            </div>
            <Method testid={`coverage-rule-${openFact.id}`}>{coverageDetail(cast, openFact.id).rule}</Method>
            <List testid="coverage-examples">
              {coverageDetail(cast, openFact.id).examples.map((e) => (
                <Row
                  key={e.id}
                  testid={`worked-${e.id}`}
                  mark={e.kind === 'product' ? 'archive' : 'who'}
                  label={e.name}
                  value={e.says}
                  wrapValue
                  onOpen={() => {
                    setOpenFact(null);
                    if (e.kind === 'product') openProduct(e.id);
                    else openCustomer(e.id);
                  }}
                />
              ))}
            </List>
            <div>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setOpenFact(null)} data-testid="coverage-done">
                Done
              </Button>
            </div>
          </div>
        )}
      </OverlayCard>

      {/* ═══ WHERE AN ACCURACY COUNT COMES FROM — AND WHAT WAS WITHHELD (§9.11 · §9.14) ══════
          The same derivation card the coverage facts open, asked of the day's own documents. On
          the HELD measure it is the one surface in the app where the abstention is legible whole:
          the albarán Rocoto had ready, beside the reason it did not send it. «Rocoto can prepare
          an internal suggested interpretation while still withholding it from the customer» — the
          preparation has always existed and this is where a person can see it.

          IT NEVER REACHES THE CUSTOMER. The prepared reading is composed for this card out of the
          document; nothing writes it into a thread, which is the only stream a customer sees. */}
      {measure && (
        <DerivationCard
          isOpen
          onClose={() => setOpenMeasure(null)}
          title={measure.label}
          says={measure.words}
          rule={measure.rule}
          testid="accuracy-card"
          ruleTestid={`accuracy-rule-${measure.id}`}
          walk={measure.walk.map((s2) => {
            const policy = policyOf(s2);
            return {
              id: s2.id,
              label: s2.customer.name,
              /* ── TWO FACTS IN THE GREEDY COLUMN, AND A PHONE DECIDED IT ────────────────────
                 The row carried three for one build — the name, the reason it was held, and the
                 interpretation Rocoto had ready — and 390px showed what that costs: the reason
                 clamped to «It cha…» and the value column collided with the customer's own name.
                 Three facts do not fit two columns. The row keeps the two the card is ABOUT. */
              sub: policy.withheld ?? s2.reading,
              verdict: policy.id,
              onOpen: () => { setOpenMeasure(null); openOrder(s2.id); },
            };
          })}
        />
      )}

      <OverlayCard
        isOpen={keepCard}
        onClose={() => setKeepCard(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="How long conversations are kept"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>How long conversations are kept</h2>
          <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            {RETENTIONS.map((r) => (
              <span key={r.value} data-selected={company.retention === r.value ? 'yes' : 'no'}>
                <Button
                  kind={company.retention === r.value ? KIND.primary : KIND.secondary}
                  shape={SHAPE.pill}
                  size={SIZE.compact}
                  data-testid={`retention-${r.value}`}
                  onClick={() => setCompany({ retention: r.value as Retention })}
                >
                  {r.label}
                </Button>
              </span>
            ))}
          </div>
          <p data-testid="retention-says" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary, maxWidth: '56ch' }}>
            {retention.sub}
          </p>
          <div>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setKeepCard(false)} data-testid="retention-done">
              Done
            </Button>
          </div>
        </div>
      </OverlayCard>

      {/* the window every arithmetic region above was counted over, said once at the foot */}
      <p
        data-testid="data-foot"
        style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}
      >
        {windowWords(cast, sales)}
      </p>
    </div>
  );
}
