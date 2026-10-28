/* THE MONO-ACCOUNT JOURNEY — its surfaces (THE-JOURNEY-CANON §1.2, §3, §5, §6 · FEED-IA §91).
 *
 * ═══ THE FOUR THINGS THIS FILE DRAWS ════════════════════════════════════════════════════════
 *
 *   1 · THE CARD          §91.1 · §91.3. It stands in the sidebar's foot, directly above the
 *                         account chip, and it says THE NEXT THING — one thing, never a list.
 *                         Collapsed rail: a square with a circular progress ring, green for what
 *                         is done and grey for what is left.
 *   2 · THE MODAL         §91.1 · §91.2. Pressing the card opens a card in the MIDDLE of the
 *                         screen, the Claude command-palette shape. Escape or a press outside
 *                         closes it, and it CLOSES FAR FASTER THAN IT OPENS.
 *   3 · THE READY RETURN  §91.4.6. The calm reveal: what Rocoto learned, and the value stated as
 *                         THEIR OWN PAST YEAR. It stands where the history lands, and the modal
 *                         opens it again whenever they want it.
 *   4 · GOING LIVE        §91.4.10. The bounded cohort, and one explicit act.
 *
 * ═══ THE CARD AND THE MONTH BAR ARE ONE OBJECT ══════════════════════════════════════════════
 * §91.1 puts the onboarding card at the sidebar's foot; §91.4.9 asks for a persistent process
 * strip carrying the month's plan, «at the bottom/foot», staying consistent. Read together those
 * are one thing that keeps going rather than two strips competing for a foot: the card shows the
 * next onboarding step while there is one, and the next MONTH step after that, and it never
 * changes shape or place. Two strips would be the app telling a person two things about what to do
 * next, in two grammars, eight pixels apart. Recorded here as a reading, for Peter to rule on.
 *
 * ═══ THE WIREFRAME (§51.24 — regions, contents, type steps, states) ═════════════════════════
 *
 *   ┌─ THE CARD · rail expanded ───────────────┐   ┌─ collapsed ─┐
 *   │ NEXT   «Connect your WhatsApp Business»  │   │    ◯ 3/10   │  a ring, and nothing else
 *   │ RING   ◯  3 of 10                        │   └─────────────┘
 *   └──────────────────────────────────────────┘
 *
 *   ┌─ THE MODAL · centred, 640 ───────────────────────────────────────────────────┐
 *   │ HEAD    «Your first month»                       HeadingXSmall · the count    │
 *   │ NOW     the step they are on, open: its own words and its own act             │
 *   │ LIST    the ten, each with its ring mark, done above and to come below        │
 *   └──────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS  HeadingMedium (the reveal) · HeadingXSmall (a modal head, a figure) ·
 *               LabelMedium (a step) · LabelSmall (the card's next thing) ·
 *               ParagraphXSmall (a method, a denominator).
 *   STATES      `data-journey` on the card states expanded/collapsed; `data-step` names the step
 *               the account stands on, so a drive reads the state rather than inferring it.
 *
 * ═══ WHAT IT IS MADE OF ═════════════════════════════════════════════════════════════════════
 * Nothing is drawn for the occasion. The figures are `Fact` — the app's one stat tile. The steps
 * are `Row` in `List`. The organisation question is `GrantQuestion`, the app's OWN control, mounted
 * rather than copied (§27.5). The cohort is `SearchSeat` over `matches`/`termsOf` ranked by
 * `bestCustomers` — the same ranking Your data prints. Every layer is `OverlayCard`. No new
 * gradient: §51.20's connect wash stays on its three connect surfaces, and the accent stays what it
 * is — Rocoto's own acts.
 *
 * ═══ AND IT IS NOT PROJECT-MANAGEMENT SOFTWARE (§12.4) ══════════════════════════════════════
 * No due dates, no streak, no confetti on the tenth ring. The card says the next thing and the
 * modal says where they are. That is the whole of it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Checkbox, LABEL_PLACEMENT } from 'baseui/checkbox';
import { Input } from 'baseui/input';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import { CASTS, SECTORS, type Cast, type Customer } from '../../scenarios/data/cast';
import { StatefulPopover, PLACEMENT as POPOVER_PLACEMENT, TRIGGER_TYPE as POPOVER_TRIGGER } from 'baseui/popover';
import { StatefulMenu } from 'baseui/menu';
import { Door, openCustomer } from './anchors';
import { GrantQuestion } from './capability';
import { switchHouse, useConfig, type SectorKey } from './config';
import { plural, useDay } from './day';
import { NoticedMark } from './customer-profile';
import { Glyph, STEP as GLYPH } from './glyphs';
import { operationsSettings, useGrants } from './grants';
import { bestCustomers, bestSellers, wholeSoles } from './insights';
import {
  aboutNode, amount, basketOf, count, historyOf, importedMonths, importedMonthsFor, nodeById,
  useImport, useKnows, type BasketLine, type ImportedMonth, type Knows,
} from './knows';
import { mainNumber, memberOf, useCompany } from './company';
import { List, Row, Section, type MarkId } from './rows';
import { Fact } from './shell/printing';
import { matches, termsOf, SearchSeat } from './search';
import { buildSales, type Sale } from './sale';
import { usePhone } from './shell';
import { useCalm } from './shell/rail';
import { AreaChart, CURVE, SIZE as CHART_SIZE } from '../../rocoto/charts';
import PrintSheet, { SheetFoot, SheetMasthead } from '../../scenarios/canonical/print-sheet';
import type { PaperColumn, PaperRow } from '../../rocoto/paper';
import { AdminSeatMark } from './shell/glyphs';
import { connectEdge, connectTile, connectWash } from '../../rocoto-theme';
import {
  armCohort, record, seedStage, stageNamed, useActivation, useMonthFacts, COHORT_CAP,
  type Activation, type JourneyStep, type MonthFact, type RevealScreen, type StageId,
  type StageLanding,
} from './activation';
import { runFirstSteps } from './activation-guide';
import { WorkflowDialog } from './workflow-dialog';

/* ── TWO LAYOUT PRIMITIVES, LOCAL AND DELIBERATELY SMALL ──────────────────────────────────────
 * `Grid` and `Method` are ten lines each and exist on Your data as private helpers of that seat.
 * They are re-stated here rather than lifted into `rows.tsx` because promoting a layout box into
 * the shared grammar is a design-system decision, not this package's to take.
 */
function Grid({ children, testid }: { children: React.ReactNode; testid: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: theme.sizing.scale600,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function Method({ children, testid }: { children: React.ReactNode; testid?: string }) {
  const [, theme] = useStyletron();
  return (
    <p
      data-method={testid ?? 'yes'}
      style={{
        margin: 0,
        ...theme.typography.ParagraphXSmall,
        color: theme.colors.contentTertiary,
        maxWidth: '68ch',
        minWidth: 0,
      }}
    >
      {children}
    </p>
  );
}

/* ═══ THE RING (§91.3) ═══════════════════════════════════════════════════════════════════════
 * «Sidebar collapsed → the card becomes a SQUARE with just a circular progress ring — green for
 * progress, grey for what's left.»
 *
 * TWO ARCS OF ONE CIRCLE, and the colours are Peter's own words read onto the theme's own tokens:
 * `positive` is the ramp's green and `mono400` its grey, so the ring re-brands with everything
 * else and owns no paint. It is drawn with `stroke-dasharray` rather than as two paths, because
 * one circle with one gap is a ring and two arcs meeting is a seam.
 */
export function ProgressRing({
  done,
  of,
  size = 32,
  label,
}: {
  done: number;
  of: number;
  size?: number;
  label?: string;
}) {
  const [, theme] = useStyletron();
  const stroke = size >= 28 ? 3 : 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = of > 0 ? Math.min(Math.max(done / of, 0), 1) : 0;

  return (
    <svg
      data-testid="journey-ring"
      data-done={done}
      data-of={of}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ display: 'block', flex: '0 0 auto' }}
    >
      {/* WHAT IS LEFT — the whole circle, in the quiet grey. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={theme.colors.mono400}
        strokeWidth={stroke}
      />
      {/* WHAT IS DONE — the same circle, painted from twelve o'clock, clockwise. */}
      {share > 0 && (
        <circle
          data-testid="journey-ring-done"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.colors.positive}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * share} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

/* ── THE MARK A FINISHED STEP WEARS, in the list ──────────────────────────────────────────── */
function StepMark({ done }: { done: boolean }) {
  const [, theme] = useStyletron();
  return (
    <span
      data-step-done={done ? 'yes' : 'no'}
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        flex: '0 0 auto',
        borderRadius: '50%',
        border: `1px solid ${done ? 'transparent' : theme.colors.borderOpaque}`,
        background: done ? theme.colors.positive : 'transparent',
        color: done ? theme.colors.backgroundPrimary : theme.colors.contentSecondary,
      }}
    >
      {done && <Glyph id="check" size={GLYPH.small} />}
    </span>
  );
}

/* ═══ WHERE A STEP GOES ══════════════════════════════════════════════════════════════════════ */

/** §10 / §91.4.8's door, owned by P1 and named here. It is a registration and not an import: an
 *  import would put this package inside the chats' file graph for one call. */
type Opener = () => void;
let OPEN_TEST: Opener | null = null;

/** P1 calls this once, from wherever it mounts the roleplay test chat. */
export const registerTestSeam = (fn: Opener | null): void => {
  OPEN_TEST = fn;
};

/** The door, pressed. With no seam registered it opens THE CONVERSATION — the surface §10.2 puts
 *  the «New test chat» action on, and the place the test will be started from. It presses the
 *  launcher the frame already mounts rather than reaching into the chats' own state: this package
 *  and the chats widget share no store, and one `querySelector` is smaller connective tissue than
 *  a second opener wired through the frame (§27.3). It disappears the moment P1 registers a seam.
 *  IT IS NEVER A CONTROL THAT DOES NOTHING (§43): both branches land somewhere real. */
export function openTestChat(): void {
  if (OPEN_TEST) {
    OPEN_TEST();
    return;
  }
  document.querySelector<HTMLButtonElement>('[data-testid=chats-launcher][data-open=no]')?.click();
}

/**
 * LAND ON THE SURFACE A MOMENT SHOWS (FEED-IA §100).
 *
 * Two of the eight moments open on an address and nothing else. The other six open on a LAYER
 * another package owns — the journey's own modal, the conversation the roleplay runs in — and this
 * reaches them the way this app already reaches one from a distance: it presses the control the
 * frame has already mounted rather than wiring a second opener through the tree.
 *
 * THE ADDRESS MOVES FIRST AND THE PRESS FOLLOWS IT, because the card lives in the rail and the rail
 * is mounted on every surface — so the frame is already painted when the press lands.
 *
 * IT LIVES HERE, WITH `openTestChat`, BECAUSE BOTH ITS CALLERS ARE STAGE CHANGES: the founder
 * seat's switch and the front door's three flows (§105). One landing, one place.
 */
export function landStage(landing: StageLanding): void {
  window.location.hash = landing.at;
  if (landing.kind === 'hash') return;
  window.setTimeout(() => {
    if (landing.kind === 'chats') {
      openTestChat();
      return;
    }
    document.querySelector<HTMLButtonElement>('[data-testid=journey-card]')?.click();
  }, 280);
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE CHAPTER TRANSITION — the one cinematic beat (FEED-IA §102.1)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ═══ PETER'S ASK, VERBATIM ══════════════════════════════════════════════════════════════════
 * «Like in product walkthroughs and demos, you have divider parts — "now we're gonna see what
 * it'll be like a few months after you've started using it" — and it takes one of those dreamy,
 * cloud-feeling transitions, the way the Lambda-class launch videos feel, almost futuristic, the
 * way Westworld felt. This is kind of what we're doing here. This is the bottom line.»
 *
 * ═══ IT IS A LICENSED EXCEPTION, BOUNDED THE WAY THE CONNECT WASH IS ════════════════════════
 * The motion doctrine of this app is austere on purpose, and §51.20's connect wash is the standing
 * precedent for how an exception is taken: NAMED, bounded to a stated set of surfaces, greppable,
 * and mixed from theme tokens so the gate stays green with no escape hatch. This is the second
 * such licence and it is narrower than the first — ONE EVENT owns it.
 *
 *   WHAT THE LICENCE COVERS   a stage change, and nothing else. `playChapter` has exactly two
 *                             callers: the founder seat's stage switch, and the front door's own
 *                             three flows (§105) — which is the same act at the app's threshold.
 *   WHAT IT MAY NEVER COVER   a house switch (that re-seeds and reloads), any navigation, any
 *                             area change, any modal. A chapter divider on a click is a loading
 *                             screen with ambition, and the drive asserts the absence.
 *   WHY IT DOES NOT BREAK THE COLOUR LAW   nothing here is the accent as an INK. It is a WASH —
 *                             the brand hue at 4–10% of the paper — plus a blur of what is already
 *                             on the screen. The saffron still means «Rocoto acted» and appears
 *                             nowhere in this layer.
 *
 * ═══ THE CHOREOGRAPHY, AND WHY IT IS SHAPED THIS WAY ════════════════════════════════════════
 * A chapter divider has one job: to hold the moment of the cut, so the app is ALREADY THE NEXT
 * STAGE when the light lifts. So the beat is three movements and the app changes inside the second
 * one — nobody ever watches a surface re-seed itself.
 *
 *   OPEN    700ms · easeDecelerate   the veil blooms, the app behind it goes soft, and the line
 *                                    arrives a beat later, settling from 1.03 to rest. GENEROUS,
 *                                    because arriving somewhere is the event.
 *   HOLD    900ms                    the stage is seeded and the app lands, under the light.
 *   CLOSE   220ms · easeAccelerate   §91.1's asymmetry, and the same reason it exists there: «the
 *                                    modal CLOSES FAR FASTER than it opens». Leaving is a
 *                                    dismissal and wants to be over. 700 against 220, measured,
 *                                    and the layer stops taking presses on the frame it starts.
 *
 * ═══ AND A CALM READER GETS THE CHAPTER WITHOUT THE CINEMA ══════════════════════════════════
 * `prefers-reduced-motion` lands the new stage IMMEDIATELY and shows the chapter line as a STILL —
 * no bloom, no blur, no scale, nothing that moves. The divider is information before it is
 * delight, so it is the motion that goes and never the sentence.
 */

/** THE THREE MOVEMENTS, in milliseconds, stated once and read by the player and the drive alike. */
export const CHAPTER_OPEN = 700;
export const CHAPTER_HOLD = 900;
export const CHAPTER_CLOSE = 220;
/** what a calm reader gets instead: the line, standing still, for as long as it takes to read */
export const CHAPTER_STILL = 900;

type ChapterPhase = 'open' | 'hold' | 'close';
type ChapterBeat = { line: string; phase: ChapterPhase; calm: boolean } | null;

/* ── THE BEAT IS A MODULE STORE, AND THE REASON IS THE BEAT ITSELF ────────────────────────────
 * A chapter divider plays PRECISELY WHILE THE APP UNDERNEATH IT IS BEING REPLACED: a stage change
 * re-seeds the ledger and lands somewhere else, which can carry the router between the two worlds
 * (§53) and swap the whole subtree the frame is drawing. State held in the component that draws
 * the veil is therefore state held in the one place a navigation tears down — MEASURED: the veil
 * vanished about 450ms into the hold, the instant the app changed under it, which is the exact
 * failure this beat exists to prevent.
 *
 * So the beat lives where every other fact in this app lives — one module-level store with
 * subscribers, read through `useSyncExternalStore` — and the host is a pure reader of it. The
 * timers are the module's too, so nothing can unmount the beat out from under itself.
 */
let BEAT: ChapterBeat = null;
const beatListeners = new Set<() => void>();
let beatTimers: number[] = [];

const publishBeat = (next: ChapterBeat): void => {
  BEAT = next;
  for (const fn of beatListeners) fn();
};

const subscribeBeat = (fn: () => void): (() => void) => {
  beatListeners.add(fn);
  return () => { beatListeners.delete(fn); };
};

const beatNow = (): ChapterBeat => BEAT;

/**
 * PLAY THE CHAPTER, THEN LAND THE STAGE.
 *
 * `land` runs INSIDE the beat — under the light, while the veil is at full — so a person never
 * watches the ledger being rewritten.
 *
 * A CALM READER GETS ONE MOVEMENT: the act lands at once and the line stands still. The divider is
 * information before it is delight, so it is the motion that goes and never the sentence.
 */
export function playChapter(line: string, land: () => void): void {
  if (typeof window === 'undefined') {
    land();
    return;
  }
  beatTimers.forEach((t) => window.clearTimeout(t));
  beatTimers = [];
  const calm = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  publishBeat({ line, phase: 'open', calm });
  const after = (ms: number, fn: () => void) => beatTimers.push(window.setTimeout(fn, ms));
  if (calm) {
    /* ── THE STILL IS ON THE SCREEN BEFORE THE WORK STARTS ────────────────────────────────────
       `land()` re-seeds a ledger and re-renders the whole app, and React commits nothing until the
       handler that called it returns — so landing synchronously here put several hundred
       milliseconds of work between the press and the first paint of the line, and the still a calm
       reader is owed simply never appeared. Two frames put the line on the glass first; the act
       then runs under it, exactly as it does under the veil. */
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => land()));
    after(CHAPTER_STILL, () => publishBeat(null));
    return;
  }
  after(CHAPTER_OPEN, () => {
    publishBeat(BEAT ? { ...BEAT, phase: 'hold' } : null);
    land();
  });
  after(CHAPTER_OPEN + CHAPTER_HOLD, () => publishBeat(BEAT ? { ...BEAT, phase: 'close' } : null));
  after(CHAPTER_OPEN + CHAPTER_HOLD + CHAPTER_CLOSE, () => publishBeat(null));
}
/** THE CHAPTER LINE EACH MOMENT ANNOUNCES ITSELF WITH (§102.1: «each stage announces itself as a
 *  chapter»). The words live in the WEB layer because they are a surface's; the ladder they are
 *  keyed to is the model's (`activation.ts`'s `STAGES`) and stays there. Every one of them says
 *  what IS at that moment — a chapter card states where the story has got to.
 *
 *  «A few months in…» IS PETER'S OWN LINE and ships exactly as he wrote it. */
export const CHAPTER: Record<StageId, string> = {
  invite: 'Day one. The link arrives.',
  claimed: 'They are in, on their own address.',
  uploading: 'Add your business details.',
  processing: 'Review imported records.',
  ready: 'Review complete.',
  testing: 'They try it on.',
  bounded: 'The first accounts go live.',
  mature: 'A few months in…',
};

/**
 * THE HOST — mounted once by the frame, above every surface, and empty until a chapter is asked
 * for. It is the whole of the exception: one fixed layer, one line, and three timers.
 */
export function ChapterHost() {
  const [, theme] = useStyletron();
  /* THE ONE THING THE BEAT ASKS THE CONTINUUM (§103): a display step that fills a desk would run
     off a 390px screen, so the line takes the ladder's step below it there. */
  const phone = usePhone();
  const beat = React.useSyncExternalStore(subscribeBeat, beatNow, beatNow);
  /* THE TWO-FRAME ENTRANCE. A layer that renders at its resting value never transitions to it, so
     the resting value is asked for on the NEXT frame — the chats panel's own technique, and the
     reason this beat can be a transition rather than a keyframe. */
  const [arrived, setArrived] = React.useState(false);
  const opening = beat !== null && beat.phase === 'open';
  React.useEffect(() => {
    if (!opening) { setArrived(false); return undefined; }
    const id = window.requestAnimationFrame(() => setArrived(true));
    return () => window.cancelAnimationFrame(id);
  }, [opening]);

  if (!beat) return null;
  const { line, phase, calm } = beat;

  /** the light is up while the beat is opening or holding, and down the frame the exit begins */
  const lit = calm || phase === 'hold' || (phase === 'open' && arrived);
  const step = phase === 'close' ? CHAPTER_CLOSE : CHAPTER_OPEN;
  const curve = phase === 'close' ? theme.animation.easeAccelerate : theme.animation.easeDecelerate;

  /* ── THE CLOUD, MIXED FROM TOKENS AND HOLDING NO COLOUR OF ITS OWN ──────────────────────────
   * THREE LAYERS, AND EACH ONE IS DOING A DIFFERENT PART OF «DREAMY»:
   *
   *   1 · THE BLUR      the app is still there, out of focus. That is the whole difference between
   *                     a chapter divider and a loading screen: a loading screen has nothing
   *                     behind it. 28px is past legibility and short of erasure — shapes, no words.
   *   2 · THE PAPER     a translucent scrim of the app's own ground, so the blurred work reads as
   *                     LIGHT FALLING ON IT rather than as a page that went away. It is mixed
   *                     toward `transparent`, which is geometry and not paint, so the gate holds.
   *   3 · THE BLOOM     the brand hue off the upper middle, gone by the edges, drifting outward
   *                     across the whole beat. A gradient that holds perfectly still reads as a
   *                     printed background; one that breathes reads as light.
   *
   * Every colour is `color-mix` over a theme token — `?theme=proof` moves the whole thing with the
   * brand, exactly as `connectWash` does, and no literal is written anywhere in it.
   */
  const paper = `color-mix(in srgb, ${theme.colors.mono100} 82%, transparent)`;
  const bloom = `radial-gradient(120% 92% at 50% 32%,`
    + ` color-mix(in srgb, ${theme.colors.accent} 20%, transparent) 0%,`
    + ` color-mix(in srgb, ${theme.colors.accent} 7%, transparent) 46%,`
    + ` transparent 78%)`;

  return (
    <div
      data-testid="chapter"
      data-phase={calm ? 'still' : phase}
      data-line={line}
      data-calm={calm ? 'yes' : 'no'}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        /* OVER EVERYTHING THE APP STACKS, including the chats panel (9) and Base's own layers the
           journey modal opens from inside the beat. A chapter divider something painted over would
           be the one object in the app whose whole job is to be the only thing on screen. */
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.sizing.scale1600,
        background: paper,
        ...(calm ? null : { backdropFilter: lit ? 'blur(28px)' : 'blur(0px)' }),
        opacity: lit ? 1 : 0,
        /* THE LAYER STOPS TAKING PRESSES THE FRAME THE EXIT BEGINS (§91.1) — the app underneath is
           live again before the paint has finished. */
        pointerEvents: phase === 'close' ? 'none' : 'auto',
        transition: calm
          ? undefined
          : `opacity ${step}ms ${curve}, backdrop-filter ${step}ms ${curve}`,
      }}
    >
      {/* THE BLOOM, DRIFTING. It opens at rest and grows a few per cent across the whole beat — a
          breath, at the edge of noticing, which is what stops the light reading as a printed
          panel. A calm reader gets the same light, standing still. */}
      <span
        data-testid="chapter-bloom"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: bloom,
          transform: calm || !lit ? 'scale(1)' : 'scale(1.08)',
          transition: calm
            ? undefined
            : `transform ${CHAPTER_OPEN + CHAPTER_HOLD}ms ${theme.animation.easeOutCurve}`,
        }}
      />

      {/* ── THE CHAPTER LINE ───────────────────────────────────────────────────────────────
          One sentence, at DISPLAY step — the ladder's own top, which is where a chapter card in a
          launch film lives and a step no heading in the app uses, so the beat cannot be mistaken
          for a screen. It arrives after the light and SETTLES rather than flying: 1.03 → 1 is a
          breath, not a zoom. Nothing else is on this layer — no mark, no progress, no stage name. */}
      <p
        data-testid="chapter-line"
        style={{
          position: 'relative',
          margin: 0,
          maxWidth: '18ch',
          textAlign: 'center',
          ...(phone ? theme.typography.DisplayXSmall : theme.typography.DisplaySmall),
          color: theme.colors.contentPrimary,
          opacity: lit ? 1 : 0,
          transform: calm || lit ? 'scale(1) translateY(0)' : 'scale(1.03) translateY(12px)',
          transition: calm
            ? undefined
            : `opacity ${step}ms ${curve} ${phase === 'close' ? 0 : 140}ms,`
              + ` transform ${step}ms ${curve} ${phase === 'close' ? 0 : 140}ms`,
        }}
      >
        {line}
      </p>
    </div>
  );
}

/* ═══ THE MODAL (§91.1 · §91.2) ══════════════════════════════════════════════════════════════
 * «Pressing it opens A MODAL IN THE MIDDLE; the modal collapses by clicking outside or Esc. Look
 * at how Claude does the modal thing. The modal CLOSES FAR FASTER than it opens.»
 *
 * ═══ THE ASYMMETRY IS THE WHOLE FEELING, AND IT IS TWO NUMBERS ══════════════════════════════
 * A layer that leaves as slowly as it arrives feels like something you have to wait out. Arriving
 * is an event and wants a moment; LEAVING IS A DISMISSAL AND WANTS TO BE OVER — so the card opens
 * on Base's 400ms decelerating curve and closes on 100ms of the accelerating one, and its pointer
 * events are dropped the frame the close begins, so the app underneath is live again before the
 * paint has finished. Four hundred against one hundred is «far faster», measured.
 *
 * ═══ AND IT IS THE COMMAND-PALETTE SHAPE (§91.2) ════════════════════════════════════════════
 * «I think all search should be like this in fact. Makes search VERY simple, or rather very
 * consistent.» This is the first surface in that grammar: centred, one head, a list beneath it
 * whose rows each carry their own mark. The search field arrives with the surfaces that search;
 * what is settled here is the BOX — centred, 640, one grammar — so the next one inherits it.
 */
/**
 * ARRIVING AT A CARD STARTS AT ITS TOP — §98.3's own lesson, one layer in.
 *
 * On a phone this modal is a FULL-HEIGHT SHEET (`placement: bottom`, `size: full`), so a body
 * taller than the glass shows its END rather than its beginning: the journey opened at 390 on the
 * tenth step of the list, with the step the person is actually on above the screen. That is §107's
 * breath law failing at the level of geometry — a step whose purpose is off-screen is not a step
 * that breathes. So the card puts its own scrollport at the top on the frame it opens, whichever
 * ancestor that port turns out to be, and the layer keeps every other behaviour it has.
 */
function AtItsTop({ testid, children }: { testid: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  /* IT IS THE PHONE'S PROBLEM AND THE PHONE'S FIX. On a desk the card is centred and shorter than
     the glass, so it already opens at its top and there is nothing to correct — reaching for a
     scrollport there is a layer touching a surface it does not own. */
  const phone = usePhone();
  const at = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (!phone) return undefined;
    /* ⚠ ONLY THE CARD'S OWN PORT, AND THAT IS WHY THE TEST IS `position: fixed`. The first walk
       took the first scrollable ancestor it met, which on a desk is the PAGE — so opening any card
       yanked the surface underneath it to the top, and a control the drive had scrolled to moved
       out from under the pointer mid-press. The layer's card is the one fixed scrollport in the
       chain, so that is the one thing this touches. */
    const top = () => {
      let node: HTMLElement | null = at.current;
      while (node) {
        if (node.scrollHeight > node.clientHeight + 1) {
          if (window.getComputedStyle(node).position === 'fixed') node.scrollTop = 0;
          return;
        }
        node = node.parentElement;
      }
    };
    /* ⚠ AND IT HAS TO BE ASKED AGAIN AFTER THE LAYER TAKES FOCUS. Measured on the phone: the port
       came back with `scrollTop: 415` on a 1.259px body, because the layer moves focus into the
       card and the browser scrolls whatever it focused into view — after this effect has run. Two
       later frames settle it, and a person who has scrolled the card themselves is long past both. */
    top();
    /* IT IS HELD AT THE TOP FOR AS LONG AS THE CARD IS ARRIVING. Base moves focus into the layer
       and the browser scrolls what it focused into view — measured at `scrollTop: 415` on a 1.259px
       body — and that happens on the layer's own animation, not on this effect's frame. So the port
       is put back on every frame of the opening (`timing400`, plus a frame), and then left alone:
       nobody scrolls a card that is still growing, and everything after that is the person's. */
    let live = true;
    const hold = () => { if (!live) return; top(); window.requestAnimationFrame(hold); };
    const frame = window.requestAnimationFrame(hold);
    const stop = window.setTimeout(() => { live = false; }, 460);
    return () => {
      live = false;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(stop);
    };
  }, [phone]);
  return (
    <div
      ref={at}
      data-testid={testid}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
    >
      {children}
    </div>
  );
}

export function CentredModal({
  isOpen,
  onClose,
  ariaLabel,
  size = 640,
  testid,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel: string;
  size?: number | string;
  testid: string;
  /** A FUNCTION IS CALLED ONLY ONCE THE CARD OPENS (`OverlayCard`'s own contract) — which is how a
   *  heavy body stays unfolded behind a closed layer. */
  children: React.ReactNode | (() => React.ReactNode);
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const calm = useCalm();
  /* THE CANON'S OWN PAIR (§3.1): «open on `animation.timing400` with `easeOutCurve`, close on
     `animation.timing100` with `easeInCurve` — the same pair `rail.tsx` already uses for the rail's
     own width». And `useCalm()` returns the transition undefined in BOTH directions, exactly as
     `railMotion` does — motion is Rocoto's to switch off. */
  const motion = ($phase: string) => (calm ? {} : {
    transitionDuration: $phase === 'closing' ? theme.animation.timing100 : theme.animation.timing400,
    transitionTimingFunction: $phase === 'closing'
      ? theme.animation.easeInCurve
      : theme.animation.easeOutCurve,
  });
  return (
    <OverlayCard
      isOpen={isOpen}
      onClose={onClose}
      scrim={SCRIM.dim}
      placement={phone ? 'bottom' : 'center'}
      size={phone ? 'full' : size}
      ariaLabel={ariaLabel}
      overrides={{
        Card: {
          style: ({ $phase }) => ({
            ...motion($phase),
            /* THE APP IS LIVE AGAIN THE FRAME THE CLOSE BEGINS. The card outlives `isOpen` so its
               exit can paint; taking the pointer off it is what stops that from being a half-second
               of an invisible sheet eating presses. */
            pointerEvents: $phase === 'closing' || $phase === 'closed' ? 'none' : 'auto',
          }),
        },
        Scrim: {
          style: ({ $phase }) => ({
            ...motion($phase),
            pointerEvents: $phase === 'closing' || $phase === 'closed' ? 'none' : 'auto',
          }),
        },
      }}
    >
      {() => (
        <AtItsTop testid={testid}>
          {typeof children === 'function' ? children() : children}
        </AtItsTop>
      )}
    </OverlayCard>
  );
}

/* ═══ THE READY RETURN (§91.4.6) ═════════════════════════════════════════════════════════════
 * «The email brings them back; what they find is CALM, a really nice flow: what Rocoto learned
 * about their business, and THE VALUE STATED AS THEIR OWN PAST — if Rocoto had handled the past
 * year: you'd have saved X hours, reviewed only Y% of orders… Spotify-Wrapped-like: top customers,
 * top products, products that could sell more, customers that could buy more, biggest opportunity
 * accounts. The value lands in their head FIRST.»
 *
 * ═══ WRAPPED, WITHOUT THE PARTY ═════════════════════════════════════════════════════════════
 * What makes a Wrapped land is not confetti, it is that every number is ABOUT THEM and they know
 * it. So this is their own name in the heading, their own accounts by name, their own goods, and
 * under every figure the sentence saying what it was counted over. The one projection on the page
 * — the hours — prints its own assumption beside it, because a person who can argue with the
 * arithmetic is a person who believes the rest of it.
 */
export function ReadyReturn({
  cast,
  onTest,
  onContinue,
  testid = 'ready',
}: {
  cast: Cast;
  /** §11.4's primary, which is the journey's own next move: into the walk and the test */
  onTest?: () => void;
  /** §106.1's own last act — out of the ending and into the guided steps (§91.4.7) */
  onContinue?: () => void;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  /* THIS IS THE ONE SURFACE THAT ASKS FOR THE WRAPPED, and the flag is what keeps six analyses off
     the rail (see `activationOf`'s `reveal`). */
  const a = useActivation(cast, true);

  /* NOTHING TO SAY BEFORE THE YEAR IS IN AND MARKED THROUGH (canon §1.1). «Ready» over an account
     whose history is still with the account manager is the claim §11.3 forbids. */
  if (!a.ready) return null;

  return (
    <div
      data-testid={testid}
      data-activation="ready"
      data-steps-done={a.done}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale900,
        padding: theme.sizing.scale700,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      {/* THE NAV STANDS FIRST AND NEVER LEAVES (§106.1). Its last stop is the ending. */}
      <RevealNav screens={NAV_STOPS} />

      {a.reveal.map((screen, i) => (
        <RevealScreenView key={screen.id} screen={screen} first={i === 0} />
      ))}

      {/* ── THE FRACTAL ENDING (§106.1) ────────────────────────────────────────────────────────
          «At its end: the whole thing — all the data, dive-inable fractally — before they click to
          continue.» So the acts live HERE, at the end of the reading, and there is one of each:
          Continue into the guided steps, and the sheet. The two that used to stand at the foot —
          «Test your Rocoto» and «See what Rocoto learned» — are what the ending and the walk are:
          the walk's own last beat opens the test chat (§91.4.8), and every figure on the ending
          opens what Rocoto learned about it. Three primaries at the foot of a Wrapped is the app
          asking a person to choose an exit from a moment that has one. */}
      <FractalEnding
        cast={cast}
        a={a}
        onContinue={() => {
          record({ cast, kind: 'open-return' });
          (onContinue ?? onTest ?? openTestChat)();
        }}
      />
    </div>
  );
}

/* ── ONE SCREEN OF THE WRAPPED (canon §6.2, §6.4) ─────────────────────────────────────────────
 * Read top to bottom, one idea each: a heading, one figure or one chart or one list, and the method
 * line that says what it was counted over. TWO CHART TYPES ON SIX SCREENS and no third — «a Wrapped
 * that draws a chart per screen is decoration, and §25's calm is the clause it breaks».
 */
function RevealScreenView({ screen, first }: { screen: RevealScreen; first: boolean }) {
  const [, theme] = useStyletron();
  const money = screen.id === 'who' || screen.id === 'room';
  const goods = screen.id === 'what' || screen.id === 'room';

  return (
    <section
      /* THE NAV'S OWN ADDRESS (§106.1). A screen a strip can name is a screen it can jump to. */
      id={`reveal-${screen.id}`}
      data-reveal={screen.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale500,
        paddingTop: first ? 0 : theme.sizing.scale700,
        borderTop: first ? undefined : `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'flex-start', minWidth: 0 }}>
        {first && <NoticedMark label="Ready for review" />}
        {first ? (
          <h2
            data-testid="ready-head"
            style={{ margin: 0, ...theme.typography.HeadingMedium, minWidth: 0 }}
          >
            {screen.label}
          </h2>
        ) : (
          <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall, minWidth: 0 }}>{screen.label}</h3>
        )}
      </div>

      {/* THE FIGURES. On the first screen they are the readback's own counts; on the second they
          are the two things this app can actually measure about their year. */}
      {screen.figures && (
        <div
          data-testid={first ? 'ready-facts' : `reveal-${screen.id}-figures`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: theme.sizing.scale600,
            minWidth: 0,
          }}
        >
          {screen.figures.map((f) => (
            <span key={f.id} data-figure={f.id} data-value={f.value} style={{ minWidth: 0 }}>
              <Fact label={f.label} value={f.value} testid={`${first ? 'ready' : screen.id}-${f.id}`} />
            </span>
          ))}
        </div>
      )}

      {/* THE ONE AREA CHART, on the one screen that is a quantity over time (canon §6.3). */}
      {screen.series && screen.series.length > 1 && (
        <div data-testid={`reveal-${screen.id}-chart`} style={{ minWidth: 0 }}>
          <AreaChart
            data={screen.series.map((d, i) => ({ x: i, y: d.figure }))}
            formatX={(x) => screen.series?.[Math.round(x)]?.month ?? ''}
            curve={CURVE.monotone}
            /* THE DEFAULT SIZE, NOT THE COMPACT ONE. `compact` gives the value axis a 32px gutter,
               and a house's month is a six-figure euro number — the first build printed «.000» down
               the left edge, which is a chart that has stopped being readable. */
            size={CHART_SIZE.large}
            height={200}
            emptyText="A year of delivery notes draws this."
          />
        </div>
      )}

      {/* THE RANKED LISTS. One visual for one job: the row's own share bar, three times. */}
      {screen.rows && screen.rows.length > 0 && (
        <List testid={`reveal-${screen.id}-rows`}>
          {screen.rows.map((r) => (
            <Row
              key={r.id}
              testid={`reveal-${screen.id}-${r.id}`}
              mark={goods ? 'crate' : 'who'}
              label={goods
                ? r.name
                : <Door onOpen={() => openCustomer(r.id)} label={`Open ${r.name}`} testid={`reveal-open-${r.id}`}>{r.name}</Door>}
              sub={r.detail}
              value={money && r.figure > 0 ? wholeSoles(r.figure) : undefined}
            />
          ))}
        </List>
      )}

      <Method testid={`reveal-${screen.id}`}>{screen.said}</Method>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE FRACTAL ENDING — what the Wrapped ends in (FEED-IA §106.1 · §106.4 · §107)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ═══ PETER'S ASK, VERBATIM ══════════════════════════════════════════════════════════════════
 * «POST-ANALYSIS FEELS LIKE SPOTIFY WRAPPED, and AT ITS END: the whole thing — ALL the data,
 * DIVE-INABLE FRACTALLY (every figure opens into its parts, and those into theirs) before they
 * click to continue. A STICKY NAVIGATION carries that final all-data view. A Download PDF act
 * stands there.»
 *
 * ═══ THE ENDING IS FOUR FIGURES AND NOTHING ELSE, AND THAT IS THE WHOLE PICTURE ═════════════
 * The first instinct — gather the six screens' lists onto one last page — is the failure the
 * return already learnt once and wrote down in this file: «the reveal repeated four of its own six
 * screens forty pixels above the seat's own». So the ending holds the four MEASURED figures of
 * their year and every one of them OPENS. All the data is there; it is under the numbers rather
 * than beside them, which is what «fractally» means and what §107's breath law asks for — one
 * purpose per view, air around it.
 *
 * ═══ THE MACHINERY IS ALREADY IN THE HOUSE (§106.4) ═════════════════════════════════════════
 * Nothing here mints a number. The DRILL is the data seat's own derivation card, lifted: a rule
 * line, then the house's own accounts and goods walked through it, each one a door. The FOLDS are
 * the intelligence layer — `bestCustomers`, `bestSellers`, `basketOf`, `historyOf`,
 * `importedMonths`, `importedMonthsFor`, and the web's own tree — which §106.4 names as the one
 * module every smart surface calls. This file composes them; it owns no arithmetic.
 *
 * ═══ THE WIREFRAME (§51.24 — regions, contents, type steps, states) ═════════════════════════
 *
 *   ┌─ THE STICKY NAV · top of the return, through the whole scroll ────────────────────────────┐
 *   │ Ready · Your year · Best customers · What sells most · Could sell more · Calls · All of it │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *   ┌─ ALL OF IT · the last section ───────────────────────────────────────────────────────────┐
 *   │ HEAD    «All of it»                                              HeadingXSmall            │
 *   │ FIGURES 4 doors — accounts · goods · patterns · albaranes         Fact, in a button        │
 *   │ METHOD  what the four were counted over                          ParagraphXSmall          │
 *   │ ACTS    [Continue]  [Download PDF]                                                        │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *   ┌─ THE DIVE · one card, a trail, a level ──────────────────────────────────────────────────┐
 *   │ TRAIL   All of it › Your accounts › Bar Manolo › Merluza          LabelXSmall, pressable  │
 *   │ HEAD    the level's own name                                      HeadingXSmall           │
 *   │ RULE    what this level was counted over                          ParagraphXSmall         │
 *   │ ROWS    the parts, each a door onto ITS parts                     List / Row              │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS  HeadingXSmall (a level's head) · LabelMedium (a row) · LabelXSmall (the trail) ·
 *               ParagraphXSmall (a rule line). The ending types nothing of its own.
 *   STATES      `data-dive` carries the address the card stands on and `data-dive-level` its
 *               depth, so a drive reads the descent rather than inferring it from what is painted.
 */

/** ONE PART OF A FIGURE. `into` is the address of the level UNDER this row, where there is one;
 *  a row with neither `into` nor `open` is a leaf, and it wears no chevron so it promises none. */
type DiveRow = {
  id: string;
  name: string;
  value?: string;
  detail?: string;
  into?: string;
  /** a door out into the app's own record, where the row IS an object the app holds */
  open?: () => void;
};

/** ONE LEVEL. `said` is what this level was counted over — never optional, for the same reason a
 *  Wrapped screen's own denominator is not: a number whose window is unstated cannot be checked. */
type Dive = { at: string; label: string; said: string; rows: DiveRow[] };

/** ONE REGISTER ON ONE GRID. The Wrapped's figures are labelled in two: the first screen's are
 *  titles («Customers linked») and the second's are fragments read under their number («orders
 *  read»). Each is right where it stands and wrong beside the other, and the ending and the sheet
 *  are the two places they stand together — so both raise the first letter and nothing else. */
const titled = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** the top of every descent, and the four doors the ending draws */
const DIVE_ROOTS = ['accounts', 'goods', 'patterns', 'months'] as const;

/** how many rows one level shows. Enough to see the shape, few enough to read (the derivation
 *  card's own rule: «the derivation, not a dump of the rows behind a number»). */
const DIVE_ROWS = 12;

/**
 * THE DESCENT, FOLDED.
 *
 * Pure, and made ENTIRELY of the intelligence layer's own folds — so a level of this card and the
 * region of the app that draws the same fact cannot disagree. It takes what it reads rather than
 * reaching for it, which is what lets the drive fold a level without a browser.
 */
function diveOf(cast: Cast, sales: Sale[], knows: Knows, at: string): Dive | null {
  const [kind, a, b] = at.split(':');

  if (kind === 'accounts') {
    const ranked = bestCustomers(cast, sales, DIVE_ROWS);
    return {
      at,
      label: 'Your accounts',
      said: ranked.method,
      rows: ranked.rows.map((r) => ({
        id: r.id, name: r.name, value: wholeSoles(r.figure), detail: r.detail, into: `customer:${r.id}`,
      })),
    };
  }

  if (kind === 'goods') {
    const ranked = bestSellers(cast, sales, DIVE_ROWS);
    return {
      at,
      label: 'Products',
      said: ranked.method,
      rows: ranked.rows.map((r) => ({
        id: r.id, name: r.name, value: wholeSoles(r.figure), detail: r.detail, into: `product:${r.id}`,
      })),
    };
  }

  /* THE PATTERNS OPEN INTO THE TREE, because that is what a pattern IS in this product: a
     customer's word landing on a branch (§106.4's routing fold, drawn as rows rather than as a
     second copy of the web's graph). */
  if (kind === 'patterns') {
    return {
      at,
      label: 'Imported patterns',
      said: `${count(knows.observations.length)} ${plural(knows.observations.length, 'pattern')} on `
        + `${knows.tree.length} ${plural(knows.tree.length, 'catalogue category', 'catalogue categories')}`,
      rows: knows.tree.slice(0, DIVE_ROWS).map((n) => {
        const into = knows.links.filter((l) => l.kind === 'route' && l.to === n.id).length;
        const learned = aboutNode(knows, n.id).length;
        return {
          id: n.id,
          name: n.name,
          value: `${count(learned)} ${plural(learned, 'pattern')}`,
          detail: `${count(into)} ${plural(into, 'customer')} use this category`,
          into: `branch:${n.id}`,
        };
      }),
    };
  }

  if (kind === 'branch') {
    const node = nodeById(knows.tree, a);
    if (!node) return null;
    const routes = knows.links.filter((l) => l.kind === 'route' && l.to === a);
    return {
      at,
      label: node.name,
      said: `Customers whose product requests use ${node.name}.`,
      rows: routes.slice(0, DIVE_ROWS).map((l) => {
        const customer = cast.customers.find((c) => c.id === l.from);
        return {
          id: l.from,
          name: customer?.name ?? l.from,
          value: `seen ${count(l.seen)} times`,
          detail: customer ? `${customer.channel}` : undefined,
          into: customer ? `customer:${customer.id}` : undefined,
        };
      }),
    };
  }

  /* THE MONTHS ARE THE ALBARANES' OWN PARTS — the hydration's minted ledger, which is the same
     twelve the seasons curve draws two screens above (`importedMonths`). */
  if (kind === 'months') {
    const months = importedMonths(cast);
    return {
      at,
      label: 'Your months',
      said: 'Every month of the year you sent — each account’s own delivery weekdays counted on the '
        + 'calendar, each delivery note at what one of theirs comes to.',
      rows: months.map((m) => ({
        id: m.key,
        name: `${m.label} ${m.year}`,
        value: wholeSoles(m.figure),
        detail: `${count(m.albaranes)} delivery notes`,
        into: `month:${m.key}`,
      })),
    };
  }

  if (kind === 'month') {
    const rows = cast.customers
      .map((c) => {
        const month = importedMonthsFor(cast, c).find((m) => m.key === a);
        return month && month.albaranes > 0 ? { customer: c, month } : null;
      })
      .filter((r): r is { customer: Customer; month: ImportedMonth } => r !== null)
      .sort((x, y) => y.month.figure - x.month.figure)
      .slice(0, DIVE_ROWS);
    const label = rows[0]?.month.label ?? a;
    return {
      at,
      label: `${label}, account by account`,
      said: 'What each account took that month, on their own delivery weekdays.',
      rows: rows.map(({ customer, month }) => ({
        id: customer.id,
        name: customer.name,
        value: wholeSoles(month.figure),
        detail: `${count(month.albaranes)} delivery notes`,
        into: `customer:${customer.id}`,
      })),
    };
  }

  if (kind === 'customer') {
    const customer = cast.customers.find((c) => c.id === a);
    if (!customer) return null;
    const basket = basketOf(cast, customer);
    return {
      at,
      label: customer.name,
      said: `What ${customer.name} takes, folded down the product column of their own `
        + `${count(basket.albaranes)} delivery notes.`,
      rows: basket.lines.slice(0, DIVE_ROWS).map((l) => ({
        id: l.product.id,
        name: l.product.name,
        value: wholeSoles(l.figure),
        detail: `${amount(l.qty)} ${l.unit} across ${count(l.albaranes)} delivery notes`,
        into: `line:${customer.id}:${l.product.id}`,
      })),
    };
  }

  if (kind === 'product') {
    const product = cast.products.find((p) => p.id === a);
    if (!product) return null;
    const rows = cast.customers
      .map((c) => {
        const line = basketOf(cast, c).lines.find((l) => l.product.id === a);
        return line ? { customer: c, line } : null;
      })
      .filter((r): r is { customer: Customer; line: BasketLine } => r !== null)
      .sort((x, y) => y.line.figure - x.line.figure)
      .slice(0, DIVE_ROWS);
    return {
      at,
      label: product.name,
      said: `The accounts whose own record carries ${product.name}.`,
      rows: rows.map(({ customer, line }) => ({
        id: customer.id,
        name: customer.name,
        value: wholeSoles(line.figure),
        detail: `${amount(line.qty)} ${line.unit} across ${count(line.albaranes)} delivery notes`,
        into: `line:${customer.id}:${a}`,
      })),
    };
  }

  /* THE FLOOR OF THE DESCENT — the documents themselves. A row here names one albarán and what it
     carried of this good; it opens nothing, because these are the RECORD'S own albaranes and a
     chevron onto a screen that cannot show them would be a door that leads nowhere (§43). */
  if (kind === 'line') {
    const customer = cast.customers.find((c) => c.id === a);
    const product = cast.products.find((p) => p.id === b);
    if (!customer || !product) return null;
    const carried = historyOf(cast, customer)
      .filter((doc) => doc.lines.some((l) => l.product.id === b))
      .slice(0, DIVE_ROWS);
    return {
      at,
      label: `${product.name} · ${customer.name}`,
      said: `Every delivery note of theirs that carried ${product.name}.`,
      rows: carried.map((doc) => {
        const line = doc.lines.find((l) => l.product.id === b);
        return {
          id: doc.id,
          name: doc.number,
          value: line ? `${amount(line.given)} ${line.unit}` : undefined,
          detail: doc.day,
        };
      }),
    };
  }

  return null;
}

/* ── THE CARD THE FIGURES OPEN ────────────────────────────────────────────────────────────────
 * ONE CARD AND A TRAIL, never a stack of layers. A fractal drawn as modal-over-modal buries the
 * app under four scrims by the third level and gives a person no way back except four Escapes;
 * a trail says exactly where they are and every crumb is the way back to it.
 */
function DiveCard({
  cast,
  sales,
  knows,
  trail,
  onTrail,
  onClose,
}: {
  cast: Cast;
  sales: Sale[];
  knows: Knows;
  /** the addresses walked, root first */
  trail: string[];
  onTrail: (next: string[]) => void;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const at = trail[trail.length - 1] ?? '';
  const level = React.useMemo(
    () => (at ? diveOf(cast, sales, knows, at) : null),
    [cast, sales, knows, at],
  );
  /* THE TRAIL IS THE WAY BACK, AND ONLY THAT. A breadcrumb that ends in the level you are
     standing on prints its name twice — once at LabelXSmall and again as the head eight pixels
     below, which is the «one sentence twice, forty pixels apart» failure this app has already
     paid for once. The head says where you are; the trail says how to leave. */
  const crumbs = React.useMemo(
    () => trail.slice(0, -1).map((step) => diveOf(cast, sales, knows, step)?.label ?? step),
    [trail, cast, sales, knows],
  );

  return (
    <CentredModal
      isOpen={trail.length > 0}
      onClose={onClose}
      ariaLabel={level?.label ?? 'Open a figure'}
      testid="dive-card"
    >
      {() => (level === null ? null : (
        <div
          data-dive={at}
          data-dive-level={trail.length}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
        >
          {/* ── THE TRAIL. Every crumb before the last is pressable and walks back to it. ─── */}
          <div
            data-testid="dive-trail"
            data-crumbs={crumbs.length}
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: theme.sizing.scale200,
              minWidth: 0,
            }}
          >
            {crumbs.map((name, i) => (
              <span key={trail[i]} style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200, minWidth: 0 }}>
                {i > 0 && (
                  <span aria-hidden="true" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
                    ›
                  </span>
                )}
                <Door
                  onOpen={() => onTrail(trail.slice(0, i + 1))}
                  label={`Back to ${name}`}
                  testid={`dive-back-${trail[i]}`}
                >
                  <span style={theme.typography.LabelXSmall}>{name}</span>
                </Door>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
            <h2 data-testid="dive-head" style={{ margin: 0, ...theme.typography.HeadingXSmall, minWidth: 0 }}>
              {level.label}
            </h2>
            <Method testid={`dive-${at}`}>{level.said}</Method>
          </div>

          {level.rows.length === 0 ? (
            <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              This fills in as their delivery notes land.
            </p>
          ) : (
            <List testid="dive-rows">
              {level.rows.map((r) => (
                <Row
                  key={r.id}
                  testid={`dive-row-${r.id}`}
                  mark={at.startsWith('goods') || at.startsWith('customer') ? 'crate'
                    : at.startsWith('months') || at.startsWith('line') ? 'doc' : 'who'}
                  label={r.name}
                  sub={r.detail}
                  value={r.value}
                  wrapValue
                  onOpen={r.into ? () => onTrail([...trail, r.into as string]) : r.open}
                />
              ))}
            </List>
          )}

          <div>
            <Button kind={KIND.primary} size={SIZE.compact} data-testid="dive-done" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ))}
    </CentredModal>
  );
}

/* ═══ THE SHEET, AND A FILE THAT IS REALLY A PDF (§106.1) ═════════════════════════════════════
 * «A Download PDF act stands there (the PrintSheet organ is its instrument).»
 *
 * THE SHEET IS THE ORGAN, HANDED DATA AND CHANGED IN NO OTHER WAY — the same component the
 * albarán, the day's picking list and the invoice come off. And the ACT WRITES A REAL PDF: a
 * download is the one thing a web page does outside its own window, so a button labelled «PDF»
 * that saves a text file is a label that lies about the file it just put on somebody's disk. The
 * writer below is thirty lines of the format's own skeleton — one page, one built-in font — and
 * what it prints is EXACTLY the rows the stage above it draws.
 *
 * ⚠ MEASURED FIGURES ONLY, AND J2'S HOURS ARE ABSENT. The canon's open stands: «there is no
 * measured value for the per-order minutes yet», so «you'd have saved X hours» is on no screen and
 * on no sheet. A paper artefact outlives the screen it was made on, which is exactly why an
 * unmeasured figure may not ride one.
 */

/** the handful of code points the trade writes that WinAnsi does not take from Latin-1 */
const WIN_ANSI: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99,
};

/** ONE STRING, AS THE FONT'S OWN BYTES — escaped for a PDF literal on the way. */
function pdfText(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const code = WIN_ANSI[ch] ?? ch.codePointAt(0) ?? 63;
    const byte = code < 256 ? code : 63;
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out.push(0x5c);
    out.push(byte);
  }
  return out;
}

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0) & 0xff);

/** A4 at 72dpi, and the margin every line starts at. */
const PAGE = { w: 595, h: 842, left: 56, top: 786, step: 17 };

/** ONE LINE OF THE SHEET, AS THE PDF HOLDS IT. `head` is the one bold step; everything else is
 *  the body face, and a blank line is a rest. */
type PdfLine = { text: string; head?: boolean; gap?: number };

/** THE WHOLE FILE, BYTE BY BYTE. The cross-reference table is a table of BYTE OFFSETS, so the
 *  objects are appended to one array and each one's start is recorded as it lands. */
function pdfBytes(lines: PdfLine[]): ArrayBuffer {
  const stream: number[] = [];
  let y = PAGE.top;
  for (const line of lines) {
    y -= line.gap ?? 0;
    if (line.text) {
      stream.push(...ascii(`BT /${line.head ? 'F1' : 'F2'} ${line.head ? 13 : 10} Tf ${PAGE.left} ${y} Td (`));
      stream.push(...pdfText(line.text));
      stream.push(...ascii(') Tj ET\n'));
    }
    y -= PAGE.step;
  }

  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PAGE.w} ${PAGE.h}]`
      + '/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>',
    null, /* the content stream, spliced in as bytes */
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
  ];

  const bytes: number[] = [...ascii('%PDF-1.4\n')];
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(bytes.length);
    bytes.push(...ascii(`${i + 1} 0 obj\n`));
    if (body === null) {
      bytes.push(...ascii(`<</Length ${stream.length}>>\nstream\n`));
      bytes.push(...stream);
      bytes.push(...ascii('\nendstream'));
    } else {
      bytes.push(...ascii(body));
    }
    bytes.push(...ascii('\nendobj\n'));
  });

  const xref = bytes.length;
  bytes.push(...ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  for (const at of offsets) bytes.push(...ascii(`${String(at).padStart(10, '0')} 00000 n \n`));
  bytes.push(...ascii(`trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new ArrayBuffer(bytes.length);
  new Uint8Array(out).set(bytes);
  return out;
}

/** PUT THE FILE ON THEIR DISK — the Plan seat's own helper, in the one form this sheet needs. */
function savePdf(name: string, bytes: ArrayBuffer): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** the file's own name — the house, so two of them in a downloads folder are two files a person
 *  can tell apart */
const yearFile = (house: string): string =>
  `rocoto-${house.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-your-year.pdf`;

/** WHAT BOTH THE PAPER AND THE FILE SAY. One list, read twice, so what was looked at and what was
 *  saved cannot differ. */
function sheetOf(a: Activation): { rows: PaperRow[]; lines: PdfLine[] } {
  const measured = [
    ...(a.reveal.find((s) => s.id === 'ready')?.figures ?? []),
    ...(a.reveal.find((s) => s.id === 'past')?.figures ?? []),
  ];
  const said = new Map(a.reveal.map((s) => [s.id, s.said]));

  return {
    rows: measured.map((f) => ({
      id: f.id,
      cells: { what: titled(f.label), figure: f.value },
    })),
    lines: [
      { text: a.house, head: true },
      { text: 'What your last year came to.', gap: 4 },
      { text: '', gap: 8 },
      ...measured.map((f) => ({ text: `${titled(f.label)}   ${f.value}` })),
      { text: '', gap: 8 },
      { text: 'Source window', head: true },
      ...[said.get('ready'), said.get('past')]
        .filter((s): s is string => Boolean(s))
        .flatMap((s) => wrapWords(s, 96).map((text) => ({ text }))),
    ],
  };
}

/** a measure the page has room for, broken on words — the one piece of typography the file has to
 *  do for itself, because a PDF text line does not wrap */
function wrapWords(s: string, at: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    if (line && (line + ' ' + word).length > at) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out;
}

function YearPaper({ a, isOpen, onClose }: { a: Activation; isOpen: boolean; onClose: () => void }) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  /* A SAVE THAT SAYS IT SAVED (the Plan seat's own lesson). The file lands in a folder nobody is
     looking at, so from the screen's side a working act and a dead one are the same picture. The
     name of the file that was written is the evidence, and it stands on the surface. */
  const [saved, setSaved] = React.useState<string | null>(null);
  const sheet = React.useMemo(() => sheetOf(a), [a]);

  const columns: PaperColumn[] = [
    { key: 'what', label: 'What', width: '1fr' },
    { key: 'figure', label: 'Figure', width: '150px', align: 'end' },
  ];

  return (
    <CentredModal isOpen={isOpen} onClose={onClose} ariaLabel="Your year, on paper" size={720} testid="year-paper-card">
      {() => (
        <div data-testid="year-paper" data-rows={sheet.rows.length} style={{ minWidth: 0 }}>
          <PrintSheet
            heading="Your year, on paper"
            standfirst={`${a.house} · figures from the year you shared.`}
            columns={columns}
            rows={sheet.rows}
            stageWidth={phone ? 288 : 470}
            height={phone ? 400 : 645}
            masthead={(
              <SheetMasthead
                issuer="Rocoto"
                document="Your year"
                recipient={a.house}
                day={a.method}
              />
            )}
            foot={<SheetFoot totals={a.reveal.find((s) => s.id === 'past')?.said ?? ''} />}
            action={(
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button
                    kind={KIND.primary}
                    size={SIZE.compact}
                    data-testid="year-paper-save"
                    onClick={() => {
                      const name = yearFile(a.house);
                      savePdf(name, pdfBytes(sheet.lines));
                      setSaved(name);
                    }}
                  >
                    Save the PDF
                  </Button>
                  <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="year-paper-close" onClick={onClose}>
                    Done
                  </Button>
                </div>
                {saved && (
                  <span
                    data-testid="year-paper-saved"
                    data-file={saved}
                    style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}
                  >
                    {saved} is in your downloads.
                  </span>
                )}
              </div>
            )}
          />
        </div>
      )}
    </CentredModal>
  );
}

/* ── THE ENDING ITSELF ────────────────────────────────────────────────────────────────────── */

/** WHICH DESCENT EACH FIGURE OPENS. The four measured counts of their year, and the part of the
 *  record each one is a count OF. A figure with no parts is not on this grid. */
const DIVE_OF_FIGURE: Record<string, typeof DIVE_ROOTS[number]> = {
  customers: 'accounts',
  goods: 'goods',
  patterns: 'patterns',
  orders: 'months',
};

function FractalEnding({
  cast,
  a,
  onContinue,
}: {
  cast: Cast;
  a: Activation;
  /** §91.4.7's own next move — the guided first steps */
  onContinue: () => void;
}) {
  const [, theme] = useStyletron();
  const ledger = useDay(cast.sector);
  const knows = useKnows(cast);
  const sales = React.useMemo(() => buildSales(cast, ledger), [cast, ledger]);
  const [trail, setTrail] = React.useState<string[]>([]);
  const [paper, setPaper] = React.useState(false);

  /* THE FOUR FIGURES, READ OFF THE WRAPPED'S OWN SCREENS. Nothing is recomputed here: the ending
     is the same numbers the six screens printed, with their parts underneath. */
  const figures = React.useMemo(() => {
    const all = [
      ...(a.reveal.find((s) => s.id === 'ready')?.figures ?? []),
      ...(a.reveal.find((s) => s.id === 'past')?.figures ?? []),
    ];
    return all.filter((f) => DIVE_OF_FIGURE[f.id]);
  }, [a.reveal]);

  return (
    <section
      id="reveal-whole"
      data-reveal="whole"
      data-testid="fractal"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale600,
        paddingTop: theme.sizing.scale700,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall, minWidth: 0 }}>All of it</h3>

      <div
        data-testid="fractal-figures"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: theme.sizing.scale600,
          minWidth: 0,
        }}
      >
        {figures.map((f) => (
          <DiveDoor
            key={f.id}
            id={f.id}
            label={titled(f.label)}
            value={f.value}
            onOpen={() => setTrail([DIVE_OF_FIGURE[f.id]])}
          />
        ))}
      </div>

      <Method testid="fractal">{a.method} Open any of them to see what it is a count of.</Method>

      <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        {/* «Continue», NEVER «Next» (§108.1's own word, and the app's law). */}
        <Button kind={KIND.primary} size={SIZE.compact} data-testid="fractal-continue" onClick={onContinue}>
          Continue
        </Button>
        <Button kind={KIND.secondary} size={SIZE.compact} data-testid="fractal-pdf" onClick={() => setPaper(true)}>
          Download PDF
        </Button>
      </div>

      <DiveCard
        cast={cast}
        sales={sales}
        knows={knows}
        trail={trail}
        onTrail={setTrail}
        onClose={() => setTrail([])}
      />
      <YearPaper a={a} isOpen={paper} onClose={() => setPaper(false)} />
    </section>
  );
}

/** A FIGURE THAT OPENS. It is the app's own `Fact`, standing in a door — the figure is unchanged
 *  and the BOX around it is what says it can be pressed, so a number never learns to look like a
 *  control. */
function DiveDoor({
  id,
  label,
  value,
  onOpen,
}: {
  id: string;
  label: string;
  value: string;
  onOpen: () => void;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  return (
    <button
      type="button"
      data-testid={`fractal-open-${id}`}
      data-dive-into={DIVE_OF_FIGURE[id]}
      aria-label={`${label} — open what it is a count of`}
      onClick={onOpen}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{
        display: 'flex',
        textAlign: 'left',
        padding: theme.sizing.scale500,
        borderRadius: theme.borders.radius300,
        border: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        boxShadow: over ? theme.lighting.shadow400 : 'none',
        transitionProperty: 'box-shadow',
        transitionDuration: theme.animation.timing400,
        transitionTimingFunction: theme.animation.easeOutCurve,
        color: theme.colors.contentPrimary,
        cursor: 'pointer',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <Fact label={label} value={value} testid={`fractal-${id}`} />
    </button>
  );
}

/** THE NAV'S OWN WORDS. A screen's HEADING is a sentence about that screen — «If Rocoto had
 *  handled your last year» — and a NAV LABEL is the shortest name a stranger can still place. The
 *  strip took the headings for one build and the first stop alone spent a third of the card, so
 *  every other name sat off the right edge. Seven short names, each of which still says what is
 *  under it, in the screens' own order with the ending last. */
const NAV_STOPS: Array<{ id: string; label: string }> = [
  { id: 'ready', label: 'Ready' },
  { id: 'past', label: 'Your year' },
  { id: 'who', label: 'Best customers' },
  { id: 'what', label: 'What sells most' },
  { id: 'room', label: 'Could sell more' },
  { id: 'call', label: 'Worth a call' },
  { id: 'whole', label: 'All of it' },
];

/* ── THE STICKY NAVIGATION (§106.1) ──────────────────────────────────────────────────────────
 * «A STICKY NAVIGATION carries that final all-data view.» Seven screens is a long scroll, and a
 * nav that only appears once you have arrived at the end is a nav for people who no longer need
 * one. So it stands at the TOP of the return and never leaves — which is the same law the web's
 * own header keeps (THE-APP-V2 §6.1: what this place is never scrolls away).
 */
function RevealNav({ screens }: { screens: Array<{ id: string; label: string }> }) {
  const [, theme] = useStyletron();
  const at = React.useRef<HTMLDivElement>(null);

  /* THE PORT IS THE CARD'S, NEVER THE PAGE'S. The return is a layer with its own scrollport, so
     the jump walks up to the first ancestor that actually scrolls and moves THAT — a
     `scrollIntoView` would take whatever the browser decided was scrollable and can drag the
     surface behind the layer with it. */
  const jump = (id: string) => {
    const nav = at.current;
    const target = document.getElementById(`reveal-${id}`);
    if (!nav || !target) return;
    let port: HTMLElement | null = nav.parentElement;
    while (port && port.scrollHeight <= port.clientHeight + 1) port = port.parentElement;
    if (!port) return;
    port.scrollTop += target.getBoundingClientRect().top
      - port.getBoundingClientRect().top - nav.getBoundingClientRect().height;
  };

  return (
    <div
      ref={at}
      data-testid="reveal-nav"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        display: 'flex',
        gap: theme.sizing.scale300,
        /* THE STRIP DECLARES ITS OWN OVERFLOW (§77.2). Seven names do not fit 390px, and a nav
           that wraps to three rows moves the whole surface under it every time it re-renders. */
        overflowX: 'auto',
        paddingBottom: theme.sizing.scale400,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      {screens.map((s) => (
        <Button
          key={s.id}
          kind={KIND.tertiary}
          size={SIZE.mini}
          shape={SHAPE.pill}
          data-testid={`reveal-nav-${s.id}`}
          onClick={() => jump(s.id)}
          overrides={{ BaseButton: { style: { flex: '0 0 auto', whiteSpace: 'nowrap' } } }}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}

/* ═══ GOING LIVE, BOUNDED (§91.4.10 · §11.5·5) ═══════════════════════════════════════════════
 * «Enabling their WhatsApp live FOR CERTAIN CUSTOMERS ONLY — a flow of its own. The setting lives
 * UNDER THE AGENT SETTINGS (not Connections — that's more of a technical thing): "only for certain
 * customers", a permission-class toggle, always reachable later.»
 *
 * THIS IS THE FLOW; THE SETTING IS THE AGENT SEAT'S. The row that says «only for certain
 * customers» is a permission-class row and belongs beside the other things Rocoto is allowed to
 * do — another package's file, reached here by seam (`openCohortFlow`) so the seat can open this
 * card without owning it and this card never draws a second copy of a setting (§27.5).
 *
 * ═══ THE SUGGESTIONS ARE A RANKING, NEVER A RECOMMENDATION (§28) ════════════════════════════
 * «Exact rules for recommending the first live customer cohort» is on Peter's own open list,
 * verbatim. So this offers the ranking the house's own record already produces — the accounts by
 * what they have taken this month, which is `bestCustomers` — and says so in the fold's own words.
 * It marks nobody «recommended», pre-selects nobody, and prints no rule.
 *
 * ═══ AND THE ACT IS EXPLICIT ════════════════════════════════════════════════════════════════
 * Ticking an account changes nothing. One named act at the foot writes the record, and the button
 * says exactly what it arms — the count — so nobody turns ten real restaurants on by pressing
 * something ambiguous. In this design build the act ARMS A LABELLED STATE and reaches nothing.
 */
export function GoLiveCard({
  cast,
  isOpen,
  onClose,
}: {
  cast: Cast;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const a = useActivation(cast);
  const ledger = useDay(cast.sector);
  const [query, setQuery] = React.useState('');
  const [picked, setPicked] = React.useState<string[]>(a.cohort.customers);

  React.useEffect(() => {
    if (isOpen) setPicked(a.cohort.customers);
  }, [isOpen, a.cohort.customers]);

  /* THE RANKING IS FOLDED WHEN THE CARD IS OPEN, and not before. This component is mounted by the
     journey card, which stands in the RAIL — so an always-on `bestCustomers` here would run the
     month's whole customer analysis on every surface in the app. */
  const ranked = React.useMemo(
    /* THE WINDOW IS NAMED HERE (the polish round, P0-3's seam). `bestCustomers` ranks over the
       imported YEAR by default now — that is the reveal's own register — and this card's rows say
       «… this month», which is the window it has always ranked its suggestions over (§28's note
       above). So the call states it rather than inheriting somebody else's. */
    () => (isOpen
      ? bestCustomers(cast, buildSales(cast, ledger), COHORT_CAP, 'month')
      : { rows: [], method: '' }),
    [cast, ledger, isOpen],
  );

  const byId = React.useMemo(() => {
    const m = new Map<string, Customer>();
    for (const c of cast.customers) m.set(c.id, c);
    return m;
  }, [cast]);

  const terms = termsOf(query);
  const found = React.useMemo(() => {
    if (terms.length === 0) return [];
    return cast.customers
      .filter((c) => matches(terms, [c.name.toLowerCase(), c.channel.toLowerCase()]))
      .slice(0, 12);
  }, [cast, query]);

  const on = (id: string) => picked.includes(id);
  const full = picked.length >= COHORT_CAP;

  const toggle = (id: string) => {
    setPicked((prev) => (prev.includes(id)
      ? prev.filter((x) => x !== id)
      : prev.length >= COHORT_CAP ? prev : [...prev, id]));
  };

  /** WHICH CHANNELS THIS COHORT WOULD BE ANSWERED ON — «confirmation of which WhatsApp/channel
   *  will be affected», counted off the accounts themselves rather than assumed. */
  const channels = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const id of picked) {
      const c = byId.get(id);
      if (!c) continue;
      seen.set(c.channel, (seen.get(c.channel) ?? 0) + 1);
    }
    return [...seen.entries()].sort((x, y) => y[1] - x[1]);
  }, [picked, byId]);

  /** THE LIST, LED BY WHAT IS ALREADY TICKED (P0-4). The picked accounts first, in the order they
   *  were chosen, then the ranking with those it has already named removed — so every tick the
   *  count and the act refer to is a row on the screen. */
  const shown = React.useMemo(() => {
    const rank = new Map(ranked.rows.map((r) => [r.id, r]));
    const rows: Array<{ customer: Customer; detail?: string }> = [];
    const said = (id: string) => {
      const r = rank.get(id);
      return r ? `${wholeSoles(r.figure)} this month · ${r.detail}` : undefined;
    };
    for (const id of picked) {
      const c = byId.get(id);
      if (c) rows.push({ customer: c, detail: said(id) });
    }
    for (const r of ranked.rows) {
      if (picked.includes(r.id)) continue;
      const c = byId.get(r.id);
      if (c) rows.push({ customer: c, detail: said(r.id) });
    }
    return rows;
  }, [picked, ranked, byId]);

  const line = (c: Customer, detail?: string) => (
    <div
      key={c.id}
      data-cohort-row={c.id}
      data-picked={on(c.id) ? 'yes' : 'no'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        padding: `${theme.sizing.scale400} 0`,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      <Checkbox
        checked={on(c.id)}
        disabled={full && !on(c.id)}
        onChange={() => toggle(c.id)}
        labelPlacement={LABEL_PLACEMENT.right}
        overrides={{ Input: { props: { 'data-testid': `cohort-pick-${c.id}` } } }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>
            <Door onOpen={() => openCustomer(c.id)} label={`Open ${c.name}`} testid={`cohort-open-${c.id}`}>
              {c.name}
            </Door>
          </span>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            {c.channel}
            {detail ? ` · ${detail}` : ''}
          </span>
        </span>
      </Checkbox>
    </div>
  );

  return (
    <CentredModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Choose the first customers to go live"
      testid="cohort-card"
    >
      <div data-picked={picked.length} data-armed={a.cohort.armed ? 'yes' : 'no'} style={{ display: 'contents' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
        <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
          Choose the first customers to go live
        </h2>
        {/* WHAT THE ACT DOES, SAID AS WHAT IS. Rocoto answers the accounts on this list; every
            other account keeps arriving exactly as it does today. */}
        <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          Choose the accounts to include. All other accounts remain with your team.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
        <SearchSeat
          value={query}
          onChange={setQuery}
          label="Search your customers by name"
          testid="cohort-search"
          fill
        />
        <span
          data-testid="cohort-count"
          style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap', flex: '0 0 auto' }}
        >
          {picked.length} of {COHORT_CAP}
        </span>
      </div>

      <div style={{ maxHeight: '42vh', overflowY: 'auto', minWidth: 0 }}>
        {terms.length > 0 ? (
          <div data-testid="cohort-found">
            {found.length === 0 ? (
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                Your book has other names — try another word.
              </p>
            ) : (
              found.map((c) => line(c))
            )}
          </div>
        ) : (
          <div data-testid="cohort-ranked">
            {/* THE CONTEXT IS THE FOLD'S OWN SENTENCE — what each account has taken this month, in
                one window. A ranking that did not say what it ranked by would be the recommendation
                rule §28 keeps open, dressed as a list. */}
            <Method testid="cohort">{ranked.method}</Method>
            {/* ── WHAT IS ALREADY CHOSEN LEADS THE LIST (THE ACCEPTANCE WALK, P0-4) ───────────
                «The counter says 4 of 10, the primary says "Turn Rocoto on for these 4" — and 0 of
                10 checkboxes on screen are checked.» Both numbers were honest and the LIST was the
                lie: it drew the ranking alone, and a house that had already gone live for four
                accounts is a house whose four are not necessarily this month's top ten. «These 4»
                pointed at nothing a person could see. So the chosen accounts stand first, ticked,
                and the ranking follows with the ones it has not already named — one list, and the
                count under it is a count of rows on the screen. */}
            {shown.map(({ customer, detail }) => line(customer, detail))}
          </div>
        )}
      </div>

      <p
        data-testid="cohort-channels"
        style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}
      >
        {picked.length === 0
          ? 'Pick the accounts to include first.'
          : `${picked.length} ${picked.length === 1 ? 'account' : 'accounts'} · ${channels.map(([ch, n]) => `${n} on ${ch}`).join(' · ')}.`}
      </p>

      <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        {/* ── THE EXPLICIT ACT, GATED BY THE TICKS (P0-4 · §108.1's own pattern) ─────────────
            It names the count in its own label, so the press and its consequence are one sentence.
            It used to be ABSENT while nothing was chosen, on the argument that a disabled control
            has an ambiguous meaning; the walk overturns that. A control that appears when you have
            done enough teaches nothing about what «enough» is, and §108.1 settles the grammar for
            this whole build — the Google domain-setup pattern, where the tick VISIBLY enables the
            button. So it stands at every count and the ticks are what arm it. */}
        <Button
          kind={KIND.primary}
          size={SIZE.compact}
          data-testid="cohort-arm"
          disabled={picked.length === 0}
          onClick={() => {
            armCohort({ cast, customers: picked });
            onClose();
          }}
        >
          {picked.length === 0 ? 'Turn Rocoto on' : `Turn Rocoto on for these ${picked.length}`}
        </Button>
        <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="cohort-close" onClick={onClose}>
          Later
        </Button>
      </div>

      {/* WHERE THIS BUILD STANDS, STATED ONCE AND PLAINLY. */}
      <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
        Preview only · messages go out from the customer’s chat.
      </p>
    </CentredModal>
  );
}

/* ── THE SEAM THE AGENT SEAT USES (§91.4.10) ─────────────────────────────────────────────────
 * The permission-class row «only for certain customers» lives on the agent seat, which is another
 * package's file. It opens THIS flow rather than drawing a second one: one registration, and the
 * seat never learns what a cohort is.
 */
let OPEN_COHORT: Opener | null = null;
export const registerCohortSeam = (fn: Opener | null): void => {
  OPEN_COHORT = fn;
};
/** The agent seat's row calls this. */
export const openCohortFlow = (): void => {
  OPEN_COHORT?.();
};

/* ═══ THE STEP, OPENED (canon §1.2) ══════════════════════════════════════════════════════════
 * What the modal shows when a step is the one they are on. Six of the ten do their own work here —
 * claiming, the organisation questions, the WhatsApp signup, the upload with its provider link,
 * the processing state and going live — and the rest are doors into the app.
 *
 * THE JOURNEY BEGINS BEFORE THE ACCOUNT EXISTS (canon §8, P2's fifth delta). Steps 1–5 are this
 * package's too: the map's P2 began at the ready moment; §91's journey begins at the claim.
 */
function StepBody({
  cast,
  step,
  onGoLive,
  onReveal,
  onConnect,
  onClose,
}: {
  cast: Cast;
  step: JourneyStep;
  onGoLive: () => void;
  onReveal: () => void;
  /** §108's own surface — the arrival and the proof, raised by the one act */
  onConnect: () => void;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const { config } = useConfig();
  const grants = useGrants();
  const company = useCompany();
  const imported = useImport(cast.sector);
  const org = operationsSettings(grants);
  const nextOrg = org.find((q) => !grants.answered.includes(q.id));
  const [address, setAddress] = React.useState('');
  const [stepError, setStepError] = React.useState('');
  const whatsappLines = company.whatsapp.map((line) => ({ ...line, owner: line.owner ? memberOf(company, line.owner)?.name : undefined }));

  const line = (children: React.ReactNode) => (
    <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
      {children}
    </p>
  );

  const act = (label: string, testid: string, onClick: () => void) => (
    <Button kind={KIND.primary} size={SIZE.compact} data-testid={testid} onClick={onClick}>
      {label}
    </Button>
  );

  switch (step.id) {
    /* ── STEP 1 · CLAIM (canon §1.2) ─────────────────────────────────────────────────────────
     * «Peter sends their link; they claim the account (real auth, email). Super secure, all of
     * it.» The address is CARRIED BY THE LINK and shown fixed: «a field they could retype is a
     * field that could open somebody else's house». */
    case 'claim':
      return (
        <>
          {line('Your account link opens this workspace on the address it was sent to.')}
          <div data-testid="claim-address" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Email</span>
            <span style={{ ...theme.typography.LabelMedium, wordBreak: 'break-all' }}>
              {company.email}
            </span>
          </div>
          {act('Claim the account', 'step-claim-act', () => record({ cast, kind: 'claim' }))}
        </>
      );

    /* ── STEP 2 · ORGANISATION ───────────────────────────────────────────────────────────────
     * «One question at a time (the org questions asked singly, a trick to get them mentally
     * involved).» IT IS THE APP'S OWN QUESTION COMPONENT, mounted rather than copied — an answer
     * given here is the same answer Operations shows, and there is no second store (§27.5). */
    case 'organisation':
      return nextOrg ? (
        <div data-testid="step-organisation" data-question={nextOrg.id} style={{ minWidth: 0 }}>
          <GrantQuestion q={nextOrg} />
        </div>
      ) : (
        line('Business details are saved. You can edit them in Operations.')
      );

    /* ── STEP 3 · WHATSAPP REVIEW ────────────────────────────────────────────────────────────
     * This UI reviews the house's lines, owners and privacy boundary. It does not open Meta or
     * claim a connection. The one act records a prepared local review; a verified provider
     * callback is the only event that may later record `whatsapp-connect`. */
    case 'whatsapp':
      return (
        <>
          <TwoMarks />
          {line(`Connect ${mainNumber(company)} — the number your customers already write to.`)}
          <div data-testid="setup-whatsapp-lines" style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelSmall }}>Lines and owners</span>
            {whatsappLines.map((item) => <span key={item.number} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{item.number} · {item.owner ? `Assigned to ${item.owner}` : 'Shared line'}</span>)}
          </div>
          <List testid="connect-facts">
            {SAFE.map((f) => (
              <Row key={f.id} testid={`connect-fact-${f.id}`} mark={f.mark} label={f.says} sub={f.sub} />
            ))}
          </List>
          {act('Review connection', 'step-whatsapp-act', () => {
            try {
              record({ cast, kind: 'whatsapp-prepared', value: mainNumber(company) });
              setStepError('');
              onConnect();
            } catch {
              setStepError('Saving is still pending. Keep this review open and try again.');
            }
          })}
          {stepError && <span role="alert" data-testid="setup-step-save-error" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{stepError}</span>}
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            Connection details, additional lines, and their owners are managed in Connections.
          </span>
          <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => { window.location.hash = '#/admin/connections'; onClose(); }}>
            Manage lines and owners
          </Button>
        </>
      );

    /* ── STEP 4 · DATA ───────────────────────────────────────────────────────────────────────
     * «The specific list of what we need (delivery-note history first), drag-and-drop themselves,
     * OR share a link with your ERP provider.» THE LIST IS WHAT WE NEED, never what is missing: a
     * row states what it is and whether it has landed. */
    case 'data':
      return (
        <>
          {line('Delivery notes first — a year of them. They carry customer, product, quantity, '
            + 'unit and date, which is every prior at once.')}
          <List testid="data-wanted">
            <Row
              testid="want-albaranes"
              mark="doc"
              label="Delivery Note history, 12 months"
              sub="Customer × product × quantity × unit × date."
              value={imported ? `Landed · ${count(imported.albaranes)} documents` : 'Waiting'}
              wrapValue
            />
            <Row
              testid="want-products"
              mark="crate"
              label="Your product list"
              sub="Names customers use when they contact you."
              value={imported ? `Landed · ${count(imported.grounded)}` : 'Waiting'}
              wrapValue
            />
            <Row
              testid="want-customers"
              mark="who"
              label="Your customer list"
              sub="Names, addresses, zones, the comercial."
              value={imported ? `Landed · ${count(imported.customers)}` : 'Waiting'}
              wrapValue
            />
          </List>
          {act('Upload delivery notes', 'step-data-act', () => {
            window.location.hash = '#/admin/data';
            onClose();
          })}

          {/* THE PROVIDER LINK — «share a link with your ERP provider / put their email and we'll
              invite them to upload». It is its own object: somebody who is not the account holder
              puts files into this house, and nothing else. */}
          <div data-testid="provider-link" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelSmall }}>Create an upload link for your ERP team</span>
            <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
              <Input
                value={address}
                onChange={(e) => setAddress((e.target as HTMLInputElement).value)}
                placeholder="their address"
                aria-label="Your ERP provider’s address"
                overrides={{ Root: { style: { flex: '1 1 220px', minWidth: 0 } },
                             Input: { props: { 'data-testid': 'provider-address' } } }}
              />
              <Button
                kind={KIND.secondary}
                size={SIZE.compact}
                data-testid="provider-send"
                disabled={address.trim().length === 0}
                onClick={() => {
                  record({ cast, kind: 'share', value: address.trim() });
                  setAddress('');
                }}
              >
                Create upload link
              </Button>
            </div>
          </div>
        </>
      );

    /* ── STEP 5 · PROCESSING ─────────────────────────────────────────────────────────────────
     * «Your data is being processed (an hourglass-class icon in a really fun way); waiting for the
     * email / your account manager. Behind it: Peter's manual regression; the account is MANUALLY
     * MARKED processed.» The copy says what IS and names the person who has the work; it never says
     * how long it takes, because the honest answer depends on Peter's queue. */
    case 'processing':
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.sizing.scale400, minWidth: 0 }}>
            <Hourglass />
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
              {imported && (
                <span data-testid="processing-facts" style={{ ...theme.typography.LabelSmall }}>
                  {count(imported.albaranes)} delivery notes · {count(imported.customers)} customers ·{' '}
                  {count(imported.grounded)} products
                </span>
              )}
              {line('Your imported data is waiting for review. Confirm the records before you use them in the workspace.')}
            </div>
          </div>
          {/* PETER'S OWN MARK, MADE A CONTROL. It is the founder's act and it is labelled as one —
              the design build carries it here so the whole journey is walkable. */}
          {act('Finish review', 'step-processing-act',
            () => record({ cast, kind: 'processed', by: 'customer' }))}
        </>
      );

    case 'return':
      return (
        <>
          {line('Review activity and patterns from your records.')}
          {act('Review your year', 'step-return-act', () => {
            record({ cast, kind: 'open-return' });
            onReveal();
          })}
        </>
      );

    case 'first-steps':
      return (
        <>
          {line('A short walk through the app. One thing at a time — press the real control or the '
            + 'button, both do the same thing.')}
          {act('Start the walk', 'step-first-steps-act', () => {
            onClose();
            /* THE MODAL LEAVES FIRST. A spotlight over a layer is two overlays, and the walk's whole
               property is that exactly one thing is pressable. */
            window.setTimeout(() => runFirstSteps({ cast }), 300);
          })}
        </>
      );

    case 'roleplay':
      return (
        <>
          {line('Write as one of your own customers writes, and watch what comes back. Test '
            + 'conversations stay inside the house.')}
          {act('Open a test chat', 'step-roleplay-act', () => {
            onClose();
            window.setTimeout(openTestChat, 300);
          })}
        </>
      );

    case 'month':
      return (
        <>
          {line(step.words)}
          {act('Open the agent settings', 'step-month-act', () => {
            window.location.hash = '#/admin/agent';
            onClose();
          })}
        </>
      );

    case 'live':
      return (
        <>
          {line(`Up to ${COHORT_CAP} accounts, chosen by you. It stays under the agent settings, so `
            + 'you can widen it whenever you want.')}
          {act('Choose them', 'step-live-act', () => {
            onClose();
            window.setTimeout(onGoLive, 300);
          })}
        </>
      );

    default:
      return null;
  }
}

/** THE HOURGLASS (§91.4.5: «an hourglass-class icon in a really fun way»). It is the app's own
 *  clock mark, turning once every four seconds — one moving thing on a calm card, so the state
 *  reads as WORKING rather than as stuck. A calm reader gets it standing still. */
function Hourglass() {
  const [css, theme] = useStyletron();
  const calm = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spin = css({
    display: 'inline-flex',
    flex: '0 0 auto',
    color: theme.colors.contentSecondary,
    ...(calm ? {} : {
      animationName: {
        '0%': { transform: 'rotate(0deg)' },
        '60%': { transform: 'rotate(180deg)' },
        '100%': { transform: 'rotate(180deg)' },
      },
      animationDuration: '4s',
      animationIterationCount: 'infinite',
      animationTimingFunction: theme.animation.easeInOutCurve,
    }),
  });
  return (
    <span data-testid="processing-hourglass" className={spin} aria-hidden="true">
      <Glyph id="clock" size={GLYPH.large} />
    </span>
  );
}

/** The connection is forward-only. Existing chats remain in WhatsApp and are never imported. */
function TwoMarks() {
  const [, theme] = useStyletron();
  const tile: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    width: 48,
    height: 48,
    flex: '0 0 auto',
    borderRadius: theme.borders.radius300,
    background: connectTile(theme.colors.accent, theme.colors.backgroundPrimary),
    color: theme.colors.accent,
  };
  return (
    <div
      data-testid="connect-marks"
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.sizing.scale500,
        padding: theme.sizing.scale700,
        borderRadius: theme.borders.radius300,
        border: `1px solid ${connectEdge(theme.colors.accent, theme.colors.borderOpaque)}`,
        background: connectWash(theme.colors.accent, theme.colors.backgroundPrimary),
        minWidth: 0,
      }}
    >
      <span data-mark="whatsapp" style={tile}>
        <Glyph id="chat" size={GLYPH.large} />
      </span>
      <span style={{ flex: '0 1 72px', height: 1, background: connectEdge(theme.colors.accent, theme.colors.borderOpaque) }} />
      <span data-mark="rocoto" style={tile}>
        <AdminSeatMark id="agent" size={GLYPH.large} />
      </span>
    </div>
  );
}

const SAFE: Array<{ id: string; mark: MarkId; says: string; sub: string }> = [
  { id: 'app', mark: 'chat', says: 'WhatsApp on your phone keeps working', sub: 'You answer from it exactly as you do today.' },
  { id: 'number', mark: 'at', says: 'Your number stays yours', sub: 'It is registered to your own business, and it stays that way.' },
  { id: 'forward', mark: 'clock', says: 'New messages appear from the moment you connect', sub: 'Earlier chats stay in WhatsApp.' },
  { id: 'off', mark: 'sliders', says: 'Disappearing messages, view-once and live location switch off', sub: 'Meta switches these three off on a connected number.' },
];

/** A calm, explicit boundary immediately after a WhatsApp connection. */
export function WhatsappSyncCard({
  cast: _cast,
  isOpen,
  onClose,
  onDone,
}: {
  cast: Cast;
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [, theme] = useStyletron();
  return (
    <CentredModal isOpen={isOpen} onClose={onClose} ariaLabel="WhatsApp connection prepared" size={560} testid="whatsapp-sync">
      {() => <div data-sync="prepared" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
        <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Connection prepared</h2>
        <p data-testid="whatsapp-forward-only" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          Meta authorization is still required. New messages will appear only after the provider confirms the connection; earlier chats will stay in WhatsApp and will not be imported.
        </p>
        <Button kind={KIND.primary} size={SIZE.compact} data-testid="sync-continue" onClick={onDone}>Continue</Button>
      </div>}
    </CentredModal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE FRONT DOOR — the app opens with the question (FEED-IA §105 · §105.1 · §105.2)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ═══ PETER'S ASK, VERBATIM ══════════════════════════════════════════════════════════════════
 * «When you first go on app.html — literally the home — it asks you what type of experience you
 * want to have.» And then, sharpening it the same hour: «It's flows. I see 3: First, then
 * Post-analysis, and Months-in.» And for the seeded data: «At the bottom right or something, a
 * button opening a dropdown for the kind of seeded data.»
 *
 * ═══ THREE FLOWS, NOT EIGHT STAGES ══════════════════════════════════════════════════════════
 * §100's ladder has eight rungs and it keeps all eight — the founder seat's switch is the
 * mid-session remote and reaches every one of them. THE FRONT DOOR IS THREE, because three is
 * what a person arriving is actually choosing between: the setup, the return, or the app in use.
 * Each door is a rung of that same ladder, so this file adds no second model:
 *
 *   First          → `invite`   the first-login checkpoint: claim → org → WhatsApp → the upload
 *   Post-analysis  → `ready`    the reading is back: the return, and onward
 *   Months-in      → `mature`   the whole book live, the journey behind them
 *
 * ═══ IT IS THE HOME'S OWN QUESTION, AND IT IS ANSWERED ONCE ═════════════════════════════════
 * «Literally the home» is the address rule, and it is the whole guard: the door stands at the home
 * address while this browser has yet to answer it, and nowhere else. A person who already knows
 * where they are going — a deep link into a seat, a returning visitor — walks straight in. The
 * answer is remembered in its own key, DELIBERATELY OUTSIDE the seeded set, so the founder's own
 * house switch stays a remote rather than a way of re-asking a question already settled.
 *
 * ═══ WHAT PRESSING ONE DOES ═════════════════════════════════════════════════════════════════
 * Exactly what the founder seat's switch does, because it is the same act at the app's threshold:
 * `seedStage` writes the ledger to that moment and `landStage` opens the surface it shows — both
 * under §102.1's chapter beat, which is the ONE cinematic moment in this app and belongs to this
 * change of stage as much as to the seat's.
 *
 * ═══ THE WIREFRAME (§51.24) ═════════════════════════════════════════════════════════════════
 *
 *   ┌─ THE FRONT DOOR · the §91.1 centred modal, 640 ───────────────────────────────────────────┐
 *   │ HEAD    «What do you want to see?»                                       HeadingXSmall     │
 *   │ FLOWS   ▸ First          claim → the setup → WhatsApp → the year in       three rows       │
 *   │         ▸ Post-analysis  the reading comes back                                            │
 *   │         ▸ Months-in      the whole book live                                               │
 *   │ CORNER  Seeded data · [Peix Vilalta ⌄]                       quiet, bottom-right           │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS  HeadingXSmall (the head) · LabelMedium (a flow, via `Row`) · ParagraphSmall (the
 *               line under the head) · LabelXSmall (the corner's own word).
 *   STATES      `data-testid=front-door` exists only while the question stands; the corner states
 *               the standing house so a drive reads the composition rather than inferring it.
 *
 * IT DRAWS NOTHING OF ITS OWN. The box is `CentredModal` (§91.1), the rows are `List`/`Row` with
 * the marks the founder seat already gives these moments, and the corner is the app's own popover
 * and menu. A front door built out of new components would be the one screen in the product that
 * was not the product.
 */

/** the key that remembers the answer. NOT in `SEEDED_KEYS` on purpose (see the header). */
export const FRONT_DOOR_KEY = 'rocoto-app-front-door';

export type FlowId = 'first' | 'post' | 'months';

/** THE THREE FLOWS, and the rung of §100's ladder each one enters at. Peter's own three words are
 *  the names and they ship exactly as he wrote them.
 *
 *  ⚠ AND THE LINE UNDER EACH NAME IS A LABEL, NOT DOCTRINE (THE-CHECKPOINT-AUDIT finding 9 ·
 *  THE-CONTENT-CANON §1, §3). «"bring the year in", "the whole book is live and the journey is
 *  behind them" — these read like the FEED-IA doctrine translated one notch, not plain labels for
 *  a founder picking a demo stage.» Right on both counts: «the journey» is this spec's word for a
 *  thing the screen never calls that, and a reader who has to map our vocabulary onto the app is
 *  decoding rather than choosing. Each line says WHAT THE APP WILL LOOK LIKE when it opens, in the
 *  words the app itself uses — the canon's own test, applied to the one screen that greets a
 *  stranger before any of the others. */
export const FLOWS: Array<{ id: FlowId; stage: StageId; name: string; said: string; mark: MarkId }> = [
  {
    id: 'first',
    stage: 'invite',
    name: 'First',
    said: 'Day one. The account is waiting to be claimed and set up.',
    mark: 'send',
  },
  {
    id: 'post',
    stage: 'ready',
    name: 'Post-analysis',
    said: 'The year is read. The reading is waiting to be opened.',
    mark: 'eye',
  },
  {
    id: 'months',
    stage: 'mature',
    name: 'Months-in',
    said: 'Months in. The whole book is live and every day’s orders are running.',
    mark: 'check',
  },
];

const homeAddress = (): boolean => {
  const h = window.location.hash;
  return h === '' || h === '#' || h === '#/';
};

/** Has this browser been through the door? */
export function frontDoorAnswered(): boolean {
  try {
    return Boolean(window.localStorage.getItem(FRONT_DOOR_KEY));
  } catch {
    /* a prototype in a private window still has to run — and one that cannot remember an answer
       asks the question again, which is the honest behaviour rather than a silent skip */
    return false;
  }
}

function rememberFrontDoor(flow: FlowId): void {
  try {
    window.localStorage.setItem(FRONT_DOOR_KEY, flow);
  } catch {
    /* nothing to remember it with; the app still opens where they asked */
  }
}

/**
 * THE DOOR — mounted by the frame, and null on every visit that has already answered it.
 */
export function FrontDoor() {
  const [, theme] = useStyletron();
  const { config, derived } = useConfig();
  const cast = derived.cast;
  const [standing, setStanding] = React.useState(
    () => typeof window !== 'undefined' && homeAddress() && !frontDoorAnswered(),
  );

  /* THE ADDRESS IS PART OF THE GUARD, so it is watched: a person who walks off the home while the
     question is up has answered it by going somewhere, and the door has no business following. */
  React.useEffect(() => {
    const on = () => { if (!homeAddress()) setStanding(false); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  if (!standing) return null;

  const enter = (flow: FlowId, stage: StageId) => {
    rememberFrontDoor(flow);
    setStanding(false);
    /* THE SAME ONE BEAT (§102.1). The seed and the landing happen inside it, under the light. */
    playChapter(CHAPTER[stage], () => {
      seedStage(stage, cast);
      landStage(stageNamed(stage).landing);
    });
  };

  return (
    <CentredModal
      isOpen
      /* THERE IS NOWHERE BEHIND THE THRESHOLD. Every other layer in this app closes on Esc or a
         press outside, because behind every other layer there is work. Behind this one there is
         only the question, so the ways out are the three doors. */
      onClose={() => {}}
      ariaLabel="What do you want to see?"
      testid="front-door"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
        <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall, minWidth: 0 }}>
          What do you want to see?
        </h2>
        <p
          style={{
            margin: 0,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
            maxWidth: '52ch',
          }}
        >
          {/* ONE PLAIN SENTENCE ABOUT WHAT PRESSING ONE DOES (THE-CONTENT-CANON §3, «lead with
              what they get, never the method»). It said «Rocoto opens on the flow you pick» —
              «flow» is our word for the three rows, not a word the reader brought. */}
          {`Pick one to open ${cast.house.name}’s workspace.`}
        </p>
      </div>

      <List testid="front-door-flows">
        {FLOWS.map((f) => (
          <Row
            key={f.id}
            id={f.id}
            testid={`front-door-${f.id}`}
            mark={f.mark}
            label={f.name}
            sub={f.said}
            wrapValue
            onOpen={() => enter(f.id, f.stage)}
          />
        ))}
      </List>

      {/* ── THE SEEDED DATA, IN THE CORNER (§105.1) ─────────────────────────────────────────
          «At the bottom right or something, a button opening a dropdown for the kind of seeded
          data.» So it is quiet and it is last: the flow is the question and the house is the
          setting the question is asked in. The word above it names what the control holds; the
          control itself says which house is standing, which is where a row already says what it
          currently holds. Picking one re-seeds the app and comes back to this same door with that
          house standing — the composition a drive can read. */}
      <div
        data-testid="front-door-corner"
        data-house={config.cast}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: theme.sizing.scale300,
          minWidth: 0,
        }}
      >
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
          Business
        </span>
        <StatefulPopover
          placement={POPOVER_PLACEMENT.topRight}
          triggerType={POPOVER_TRIGGER.click}
          /* over the modal's own layer, the way every menu in this app opens over the surface
             that carries it (stock's acts menu found the number) */
          overrides={{ Body: { style: { zIndex: 13 } } }}
          content={({ close }) => (
            <StatefulMenu
              items={SECTORS.map((sec) => ({ id: sec, label: CASTS[sec].house.name }))}
              onItemSelect={({ item }) => {
                close();
                if (item.id !== config.cast) switchHouse(item.id as SectorKey);
              }}
              overrides={{
                List: {
                  props: { 'data-testid': 'front-door-house-menu' },
                  style: { minWidth: '200px' },
                },
              }}
            />
          )}
        >
          <Button
            kind={KIND.tertiary}
            size={SIZE.mini}
            data-testid="front-door-house"
            aria-haspopup="menu"
          >
            {`${cast.house.name} ⌄`}
          </Button>
        </StatefulPopover>
      </div>
    </CentredModal>
  );
}

/* ═══ THE JOURNEY MODAL ══════════════════════════════════════════════════════════════════════ */

export function JourneyModal({
  cast,
  isOpen,
  onClose,
  onGoLive,
  onReveal,
  onConnect,
}: {
  cast: Cast;
  isOpen: boolean;
  onClose: () => void;
  onGoLive: () => void;
  onReveal: () => void;
  onConnect: () => void;
}) {
  const [, theme] = useStyletron();
  /* ── THE PHONE GETS ONE SEAT PER FACT, FULL MEASURE (§77.2 · THE ACCEPTANCE WALK, P0-2) ─────
   * The step rows put the label and its reading on ONE line, and at 390 both of them can shrink:
   * «Set what it may do» came out one word per line beside «0 of 4 answered», which is §51.1's «a
   * card must read» failing on the very list the journey is. So on the phone the reading takes a
   * line of its own, at full measure, and the label keeps the row. */
  const phone = usePhone();
  const a = useActivation(cast);
  const month = useMonthFacts(cast, a.cohort.customers.length);
  const step = a.next ?? a.steps[a.steps.length - 1];

  return (
    <WorkflowDialog isOpen={isOpen} title={a.ready ? 'This month' : 'Set up your workspace'} ariaLabel="Your journey" onClose={onClose} step={`${a.done} of ${a.of}`} testId="journey-modal">
      <div data-testid="journey-progress" style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0, ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
        <ProgressRing done={a.done} of={a.of} size={28} />
        <span>{a.done} of {a.of} complete</span>
      </div>

      {/* ── THE STEP THEY ARE ON, OPEN. One thing, said whole, with its own act under it. */}
      <div
        data-testid="journey-now"
        data-step={step.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale500,
          padding: theme.sizing.scale600,
          borderRadius: theme.borders.radius300,
          background: theme.colors.backgroundSecondary,
          minWidth: 0,
        }}
      >
        {/* THE HEAD NAMES THE STEP AND NOTHING ELSE. Its `sub` is the LIST's line, and the body
            under this says the same thing in more words — printing both put one sentence on the
            card twice, forty pixels apart. */}
        <h3 style={{ margin: 0, ...theme.typography.LabelLarge, minWidth: 0 }}>{step.title}</h3>
        <StepBody
          cast={cast}
          step={step}
          onGoLive={onGoLive}
          onReveal={onReveal}
          onConnect={onConnect}
          onClose={onClose}
        />
      </div>

      {/* ── THE TEN, SO THEY ALWAYS KNOW WHERE THEY ARE (§12.3). Each row carries its own mark and
             its own counted line — the icon-per-row grammar §91.2 asks for. */}
      {/* ONE MARK PER ROW (canon §3.2, and the app's identity law). The first build drew `Row`'s
          own tile AND the step's ring, so every line carried two marks for one object. The mark IS
          the state here — a ring for what is left, a tick for what is done — so the row is built on
          the list's own box and skips the generic tile. */}
      <div
        data-testid="journey-steps"
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          background: theme.colors.backgroundPrimary,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {a.steps.map((s, i) => (
          <div
            key={s.id}
            data-row={`step-${s.id}`}
            data-done={s.done ? 'yes' : 'no'}
            data-here={s.id === a.step ? 'yes' : 'no'}
            style={{
              display: 'flex',
              alignItems: phone ? 'flex-start' : 'center',
              flexWrap: phone ? 'wrap' : 'nowrap',
              gap: theme.sizing.scale500,
              padding: theme.sizing.scale500,
              borderTop: i === 0 ? undefined : `1px solid ${theme.colors.borderOpaque}`,
              background: s.id === a.step ? theme.colors.backgroundSecondary : 'transparent',
              minWidth: 0,
            }}
          >
            <StepMark done={s.done} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>{s.label}</span>
              <span
                style={{
                  ...theme.typography.ParagraphXSmall,
                  color: theme.colors.contentSecondary,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                  minWidth: 0,
                }}
              >
                {s.sub}
              </span>
            </span>
            {s.words && (
              <span
                data-value={`step-${s.id}`}
                style={{
                  ...theme.typography.LabelXSmall,
                  color: theme.colors.contentTertiary,
                  textAlign: phone ? 'left' : 'right',
                  /* a whole line of its own on the phone, and the end of the row on a desk */
                  flex: phone ? '1 0 100%' : '0 1 auto',
                  minWidth: 0,
                }}
              >
                {s.words}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── WHAT THE MONTH IS CARRYING (§12.1, §12.2). Only once there is a month to carry. */}
      {a.ready && (
        <div
          data-testid="journey-month"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
        >
          {month.map((m: MonthFact) => (
            <span
              key={m.id}
              data-metric={m.id}
              data-value={m.value}
              style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}
            >
              <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}>
                <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>{m.label}</span>
                <span
                  style={{
                    ...theme.typography.LabelSmall,
                    marginLeft: 'auto',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {m.value}
                </span>
              </span>
              <span data-said={m.id} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                {m.said}
              </span>
            </span>
          ))}
        </div>
      )}
    </WorkflowDialog>
  );
}
