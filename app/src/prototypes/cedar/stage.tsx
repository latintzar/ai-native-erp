import { soles } from './currency';
/* THE STAGE — the setting performs its consequence (FEED-IA §53 · THE-ADMIN-CANON §6).
 *
 * ═══ THE ASSIGNED DESIGN JOB, VERBATIM ══════════════════════════════════════════════════════
 * «There needs to probably be a real example, like animated chats» · giving «an insight into some
 * backend behavior or some process… we want to do it super nicely» · «Apple bringing multi-touch
 * interactions to life» · «the Monzo aesthetic would be doing that really well» · «Can we bring it
 * to life in a way that isn't confusing to see?… this is your job now to think about that.»
 *
 * ═══ THREE CONCEPTS WERE DELIBERATED; THIS IS THE ONE ═══════════════════════════════════════
 * THE SETTING PERFORMS ITS CONSEQUENCE — one real control on the left, the conversation it governs
 * on the right, and touching the control changes what the conversation does. The other two (a
 * backstage strip narrating the machinery; a handoff played across two devices) were dropped for
 * the same reason: they SHOW you a process, and Apple's multi-touch demo did something else —
 * it put the INPUT and its CONSEQUENCE in one frame, so the person learns the rule by moving the
 * thing themselves rather than by watching a film about it.
 *
 * IT IS CONTRACT-DRIVEN, WHICH IS WHY IT KEEPS BUILDING. Every `AgentSetting` carries its own
 * `example: StageScript`, so a setting that arrives next month arrives with its own performance and
 * this file learns nothing new. That is the answer to §53's own forward question — «should we, in
 * the runtime itself, have some data contract of what settings can be changed, so then we surface
 * those and we bring those to life?» — made structural: the UI is a renderer of the contract and
 * the stage is a PLAYER of it.
 *
 * ═══ THE WIREFRAME (§51.24) ═════════════════════════════════════════════════════════════════
 *
 *   ┌─ THE STAGE · head of the agent seat ─────────────────────────────────────────────────────┐
 *   │ LEFT    the REAL GrantRow for the focused setting, bound to a SANDBOX copy of the grants   │
 *   │         · the question's own chips under it — touching one IS the input                    │
 *   │ RIGHT   chat paper: dots ground · real Message bubbles · the real albarán embed            │
 *   │ UNDER   ONE caption line, swapping with the branch                                         │
 *   │ INSIDE  one quiet machinery line under the deciding bubble, naming the check it ran         │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS   LabelXSmall (the machinery line, the caption's label) · ParagraphSmall (the
 *                caption) · the Message kit's own steps inside the bubbles. The stage types nothing
 *                of its own, which is what makes it look like the app rather than like a demo.
 *   STATES       playing (turns arriving on speech timing) · resolved (all turns, held 2.5s) ·
 *                settled (a hand pressed the manual notch's send — the loop stops) · reduced
 *                motion (resolved immediately, no loop, no repaint).
 *
 * ═══ IT PLAYS THE SETTING WHOSE ROW WAS LAST TOUCHED (§6's own rule) ════════════════════════
 * TWO PERFORMANCES STAND ON THIS STAGE TODAY. The CEILING's — «may Rocoto say yes to this order» —
 * is handed in by the seat as a contract entry and its `example`. THE APPETITE's — «and then how
 * soon does the albarán travel» (THE-EXPORT-CANON §16.7: «the stage performs all three») — is
 * carried here, because `dispatch` has yet to join `GrantId` and therefore has no contract entry to
 * hang an example on. Which one is playing is read off the grants store itself: it publishes the
 * whole `Grants` on every write, so the stage sees which FIELD moved and follows that row. The seat
 * above learned nothing and gained no second prop.
 *
 * THE APPETITE'S THREE BRANCHES, and the one sentence each of them is: AUTO — it is with the rail
 * already, the quiet line naming the hour it went. GRACE — it goes at the hour on the line, the
 * customer changes their mind, and the line states a later hour, because an edit restarts the
 * margin. MANUAL — the albarán stands ready under `[⇄ Send to Sage 50]`, which becomes «Going to
 * Sage 50» and then the same quiet line, in place (§59.1). Never a countdown, at any notch.
 *
 * ═══ WHAT IT IS MADE OF, AND WHY THAT MATTERS ═══════════════════════════════════════════════
 * Every component on this stage is the app's own, lifted: `Message` and `groupThread` from the kit
 * (the same bubbles the Chats overlay draws), `ChatEmbed` for the albarán (the same card the
 * customer's thread carries), `ChatCard` for the handover, `dots()` for the ground, `GrantRow` for
 * the control. THE ORDER IT PLAYS IS A REAL SALE off the cast's own river — a real customer, a real
 * figure, real lines. Nothing here is a drawing of the app: it IS the app, running a script.
 *
 * ZERO VIDEO, ZERO CURSOR, ZERO FAKE UI. The interface performs itself.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Message, groupThread, AUTHOR } from '../../rocoto/message';
import { dots, DOT_TILE } from '../../rocoto-theme';
import type { Cast } from '../../scenarios/data/cast';
import { ChatCard, ChatEmbed } from './shell/embeds';
import { lengthOf, utterancesOf } from './shell/threads';
import { CHECKS, type CheckId } from './net';
import { GrantRow } from './rows';
import { Glyph, STEP } from './glyphs';
import { clockAfter } from './day';
import { useConfig } from './config';
import {
  grantsNow, setGrants, settingOf, useGrants,
  type Appetite, type CapabilityQuestion, type GrantId, type Grants, type Margin,
} from './grants';
import type { Sale } from './sale';

/* ── THE SCRIPT GRAMMAR ───────────────────────────────────────────────────────────────────────
 * A script is DATA, and this is its whole vocabulary. Four shapes, and a new setting's example is
 * written in them rather than in JSX — which is the difference between a stage that grows with the
 * contract and ten hand-built demos that rot at different speeds.
 */

/** WHO IS SPEAKING. Three standings, mapped onto the Message kit's four: the customer is a
 *  `received`, Rocoto is an `ai` (the one standing that wears the identity mark), the house is a
 *  `sent`. There is no `system` on this stage: a thread talking about itself is chrome, and the
 *  stage's own caption already says what is happening. */
export type StageVoice = 'customer' | 'rocoto' | 'house';

/** WHAT AN EMBED ON THE STAGE IS. `albaran` renders the sale's real document card; `handover`
 *  renders the app's embed shell around the person a topic went to; `press` is the manual notch's
 *  own control, which transforms in place (§59.1). All three are the app's own grammar — the stage
 *  owns no card of its own. */
export type StageChip =
  | { kind: 'albaran' }
  | { kind: 'handover'; to: string; line: string }
  /** THE HAND ON THE RAIL (THE-EXPORT-CANON §16.7, the MANUAL notch). «Where the press lives:
   *  exactly where it already lives — `[⇄ Send to Sage 50]` on the document's dock. No new control,
   *  no queue, no folder, no approval screen.» So the stage draws that control and nothing else,
   *  and pressing it is the notch's whole consequence: the box becomes its next state where it
   *  stands, then dissolves into the rail's line.
   *
   *  `at` IS THE MORNING'S HOUR, NOT THE READER'S. The whole stage is a document's own morning, so
   *  the hour the press lands on comes off that clock — a wall-clock «23:14» under an albarán
   *  stamped 07:20 would be the one number on this surface that belonged to nobody. */
  | { kind: 'press'; rail: string; at: string };

export type StageTurn = {
  who: StageVoice;
  /** what is said. It is timed at the app's own speaking rate, so a long line takes longer. */
  text: string;
  /** THE MONZO LAYER, one quiet line under a deciding bubble: which of the six checks ran. The
   *  words come out of `net.ts`, so the stage and the grants section cannot drift about the net. */
  check?: CheckId;
  /** THE SAME QUIET SEAT, FOR A RAIL RATHER THAN A CHECK (THE-EXPORT-CANON §16.7). An appetite is
   *  not one of the net's six: the net decides whether a document is READY, the appetite decides
   *  how eagerly it LEAVES. So its machinery line names the rail and the hour — «Sage 50 · goes at
   *  08:11» — and it is an hour at every notch, never a countdown, which is §16.3 clause 2 and the
   *  one thing about the window that survived §68. Same seat, same type step, different fact. */
  rail?: string;
  /** an embed riding under the bubble */
  chip?: StageChip;
};

export type StageBranch = {
  id: string;
  /** which value of the control this branch is the consequence of */
  when: (g: Grants) => boolean;
  /** ONE line under the stage, swapping in sync with the branch */
  caption: string;
  turns: StageTurn[];
};

export type StageScript = {
  /** the opening every branch starts from — the customer's message, and Rocoto reading it */
  opening: StageTurn[];
  branches: StageBranch[];
};

/**
 * WHAT A SCRIPT IS WRITTEN AGAINST.
 *
 * A performance that hard-coded «350 €» would be a drawing of a demonstration: the order on the
 * stage is a REAL sale off the cast's river, so its figure is whatever that morning's document
 * actually came to, and the branch that flips is «is this order inside the house's ceiling». The
 * script therefore arrives as a FACTORY — the contract entry declares how to write itself against
 * a real order, and the seat hands it one.
 *
 * It is also what keeps a new setting cheap: the entry writes its own example against this context
 * and the player learns nothing.
 */
export type StageContext = {
  /** what the order on the stage comes to, in soles */
  figure: number;
  /** the same figure in the trade's own words, unit on the number (the price-unit law) */
  figureWords: string;
  /** who an escalation goes to, by name — the house's own routing, not a placeholder */
  handover: string;
  /** the day the order is for, as the document says it */
  day: string;
  /** who sent it */
  customer: string;
  /** ── THE GOODS THE ORDER'S FIRST LINE NAMES, in the catalogue's own words ─────────────────
   *  Law 10 reaches the stage too: an ambiguity performance has to be ABOUT something, and the
   *  something has to be the house's own. A fish house watches it happen to merluza and a meat
   *  house to a cut, because the word comes off the staged sale rather than out of a script.
   *  OPTIONAL, so a script written before this field existed still runs. */
  goods?: string;
};

export type StageExample = (ctx: StageContext) => StageScript;

/* ═══ THE APPETITE'S OWN PERFORMANCE (THE-EXPORT-CANON §16.7 · FEED-IA §68) ═══════════════════
 * «The stage performs all three. One order arrives; the control walks the three notches and the
 * same document is seen leaving at once, waiting out its margin, and sitting under a press — three
 * behaviours, one script, no prose. That is the dial explaining itself by running.»
 *
 * IT IS THE SAME DOCUMENT IN ALL THREE. The opening makes the albarán — an appetite is about how
 * eagerly a document LEAVES, so the document has to exist before the notch means anything — and
 * each branch is that one albarán going at a different eagerness. The ceiling's performance answers
 * «may Rocoto say yes»; this one answers «and then how soon does it travel».
 *
 * WHY IT IS WRITTEN HERE RATHER THAN ON A CONTRACT ENTRY. `dispatch` holds its VALUE in `grants.ts`
 * and its ROW is built locally in `areas/admin/agent.tsx`, because the id has yet to join `GrantId`
 * — a seam both files name. So the stage carries the performance and asks the CONTRACT FIRST
 * (`settingOf('dispatch')`, and that entry's own `example` if it brings one): the day the entry
 * lands in `CAPABILITY_QUESTIONS`, the stage starts using it and everything below goes unreachable.
 * A seam that closes itself beats one somebody has to remember.
 *
 * EVERY HOUR IS THE DOCUMENT'S OWN. `clockAfter` is the app's clock — the arithmetic the river's
 * stamps are made with — walked forward from the order's real arrival by the margin the house
 * actually chose. And it is an HOUR at every notch, never a countdown (§16.7).
 */

/** the beat at which the customer changes their mind, on this performance. The script's own timing
 *  rather than a fact about any house — one invented number, named once so it cannot spread. */
const EDIT_AFTER = 6;

/** THE MARGIN, IN THE TRADE'S OWN WORDS — a length a person says out loud. */
const marginWords = (m: Margin): string =>
  (m === 60 ? 'an hour' : m === 30 ? 'half an hour' : 'ten minutes');

/** WHAT THE ROW READS AT EACH NOTCH. One statement of what happens, per notch. */
const appetiteWords = (rail: string, notch: Appetite, wait: Margin): string => {
  if (notch === 'at-once') return `It goes to ${rail} as it comes`;
  if (notch === 'on-a-press') return `It goes to ${rail} when you press`;
  return `It goes to ${rail} ${marginWords(wait)} after it is read`;
};

/**
 * THE THREE NOTCHES, PLAYED. `rail` is the house's own system by its own name (§15.3.1: never a
 * category where a name exists), `at` is the order's real arrival hour, `wait` the chosen margin.
 */
export const appetiteExample = (rail: string, at: string, wait: Margin): StageExample =>
  ({ figureWords, day, customer }) => {
    const editedAt = clockAfter(at, EDIT_AFTER);
    const goes = clockAfter(at, wait);
    const goesAgain = clockAfter(editedAt, wait);
    return {
      opening: [
        { who: 'customer', text: `Morning — the usual for ${day}, and two extra cajas of gamba.` },
        {
          who: 'rocoto',
          text: `Received. ${customer}’s order for ${day}, ${figureWords}. It is confirmed.`,
          chip: { kind: 'albaran' },
        },
      ],
      branches: [
        {
          id: 'at-once',
          when: (g) => g.dispatch === 'at-once',
          caption: `As it comes, the delivery note reaches ${rail} the moment Rocoto has read it.`,
          turns: [
            {
              who: 'rocoto',
              text: `It is with ${rail} already.`,
              rail: `${rail} · went ${at}`,
            },
          ],
        },
        {
          id: 'after-a-margin',
          when: (g) => g.dispatch === 'after-a-margin',
          /* THE EDIT IS THE HALF OF THIS NOTCH THAT MATTERS. A margin is only worth having because
             a morning changes its mind inside it, so the performance changes its mind and the line
             states the new hour — «an edit restarts the margin», seen rather than said. */
          caption: `After a margin, it goes at the hour on the line, and an edit starts the margin again.`,
          turns: [
            {
              who: 'rocoto',
              text: `It goes to ${rail} at ${goes}.`,
              rail: `${rail} · goes at ${goes}`,
            },
            { who: 'customer', text: 'Make it three cajas of gamba.' },
            {
              who: 'rocoto',
              text: `Three cajas. The margin starts again.`,
              rail: `${rail} · goes at ${goesAgain}`,
            },
          ],
        },
        {
          id: 'on-a-press',
          /* the fallback branch, as every script's last one is: a value this build has never seen
             still lands on a legible performance rather than on an empty stage */
          when: () => true,
          caption: `On your press, it stands ready and goes when your hand sends it.`,
          turns: [
            {
              who: 'rocoto',
              text: `It is ready for ${rail}.`,
              chip: { kind: 'press', rail, at: editedAt },
            },
          ],
        },
      ],
    };
  };

/**
 * THE APPETITE'S CONTROL, in the contract's own shape.
 *
 * ⚠ THE WORDS ARE `areas/admin/agent.tsx`'s, DELIBERATELY IDENTICAL. The row a person opens under
 * the stage and the row standing ON the stage have to say the same thing, and until `dispatch` is a
 * `GrantId` there is no one place for them to say it from. Both copies die together: the entry
 * joins `CAPABILITY_QUESTIONS`, `settingOf('dispatch')` starts answering, and this function and the
 * seat's `appetiteSetting` both go. Change one of them and change the other in the same commit.
 */
export function appetiteControl(rail: string): CapabilityQuestion {
  return {
    id: 'dispatch' as GrantId,
    home: 'agent',
    prompt: `When does a delivery note go to ${rail}?`,
    aside: `This sets when a delivery note goes to ${rail}. Paper prints when you press.`,
    choices: [
      { value: 'at-once', label: 'As it comes', hint: `It reaches ${rail} the moment Rocoto has read it.` },
      {
        value: 'after-a-margin',
        label: 'After a margin',
        hint: `It reaches ${rail} once the margin has passed, and an edit starts the margin again.`,
      },
      {
        value: 'on-a-press',
        label: 'When you approve it',
        hint: 'It goes when you approve it — one by one, or the whole day at once.',
      },
    ],
    selected: (g) => [g.dispatch],
    choose: (_g, v) => ({ dispatch: v as Appetite }),
    row: {
      label: `When it goes to ${rail}`,
      sub: 'Your own eagerness, on the system rail. Paper stays a press.',
      mark: 'send',
    },
    value: (g) => appetiteWords(rail, g.dispatch, g.dispatchWait),
    rocoto: (g) => g.dispatch !== 'on-a-press',
  };
}

/* ── THE PLAYER ───────────────────────────────────────────────────────────────────────────── */

/** how long the resolved state is held before the performance runs again (THE-ADMIN-CANON §6) */
export const HOLD_MS = 2500;

/* ── HOW FAST A TURN ARRIVES, AND THE SHOT THAT SETTLED IT ────────────────────────────────────
 * The first build timed each bubble at `lengthOf(utterancesOf(...))` — the app's own SPEECH clock,
 * 150 words a minute, which is what the voice notes are timed at. The screenshot came back with an
 * empty dot grid: the opening line is sixteen words, so the stage sat blank for six and a half
 * seconds before its first bubble.
 *
 * THE CLOCK WAS RIGHT AND THE RATE WAS WRONG. Nobody is LISTENING to this conversation — they are
 * READING it, and reading runs about two and a half times speaking. So the speech clock stays the
 * source (a long line still takes longer than a short one, and the timing is still the app's own
 * rather than a number somebody liked) and the stage runs it at reading pace, clamped at both ends:
 * a two-word line still registers as a turn, and no line holds the stage long enough to feel stuck.
 */
const READING = 2.5;
const MIN_TURN_MS = 650;
const MAX_TURN_MS = 1600;

const turnMs = (turn: StageTurn): number => {
  const spoken = lengthOf(utterancesOf(turn.text, turn.who));
  return Math.min(MAX_TURN_MS, Math.max(MIN_TURN_MS, spoken / READING));
};

/** THE READING CLOCK, FOR ANY PERFORMANCE THAT IS NOT A CONVERSATION. A hydration beat has a
 *  caption rather than a bubble, and it should hold for as long as that caption takes to read —
 *  the same clock, handed the same words, so two performances in this app can never disagree about
 *  how fast a sentence goes by. */
export const readingMs = (text: string): number =>
  Math.min(MAX_TURN_MS, Math.max(MIN_TURN_MS, lengthOf(utterancesOf(text, 'rocoto')) / READING));

/** DOES THIS MACHINE WANT STILLNESS. Asked once and watched, because the setting can change while
 *  the page is open and a person who turns motion off should not have to reload to be believed. */
export function useStillness(): boolean {
  const [still, setStill] = React.useState(false);
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setStill(query.matches);
    on();
    query.addEventListener?.('change', on);
    return () => query.removeEventListener?.('change', on);
  }, []);
  return still;
}

/* ── THE WALK, SHARED (THE-DATA-CANON §4.3) ───────────────────────────────────────────────────
 * Hydration's dress is THIS grammar — «real lifted components performing on sandbox data, walked
 * by the stage player's own timing machinery» — so the walk is a hook rather than a private effect
 * of one component. Two performances now run on it: the agent seat's conversation (which LOOPS,
 * because a demonstration you can come back to has to be running when you do) and the import's
 * three beats (which run ONCE, because an import is an EVENT and an event that replays is a
 * screensaver).
 *
 * ONE TIMER AT A TIME, cleared on every change, so a person who touches something mid-performance
 * restarts it rather than watching two of them race.
 */
export function useWalk({
  steps,
  msOf,
  still,
  loop,
  from = 1,
}: {
  /** how many steps the performance has */
  steps: number;
  /** how long step `i` holds before the next one arrives */
  msOf: (i: number) => number;
  /** this machine wants stillness: land the whole thing, no walk, no loop, no repaint */
  still: boolean;
  /** hold the resolved state and run again (a demonstration), or stop on it (an event) */
  loop: boolean;
  /** how many steps are already there on arrival — the stage opens with the customer's message
   *  already written; a hydration opens with nothing */
  from?: number;
}): { shown: number; land: () => void; done: boolean } {
  const [shown, setShown] = React.useState(still ? steps : from);

  React.useEffect(() => {
    setShown(still ? steps : from);
  }, [still, steps, from]);

  React.useEffect(() => {
    if (still) return;
    if (shown >= steps) {
      if (!loop) return;
      const hold = window.setTimeout(() => setShown(0), HOLD_MS);
      return () => window.clearTimeout(hold);
    }
    const next = window.setTimeout(() => setShown((n) => n + 1), msOf(shown));
    return () => window.clearTimeout(next);
  }, [shown, steps, still, loop, msOf]);

  /** ANY INPUT LANDS IT. The performance is skippable by construction (§4.5): a press, a scroll or
   *  a key puts the resolved state on screen immediately — nobody is ever made to wait out a piece
   *  of theatre to reach the thing they came for. */
  const land = React.useCallback(() => setShown(steps), [steps]);

  return { shown, land, done: shown >= steps };
}

/* ── THE QUIET LINE'S OWN SEAT ────────────────────────────────────────────────────────────────
 * One style, two facts — the net's check and the rail's hour (§16.7) — because the Monzo layer is
 * ONE thing on this stage and a second style would read as a second kind of machinery.
 */
const quietLine = (theme: ReturnType<typeof useStyletron>[1]): React.CSSProperties => ({
  margin: `0 ${theme.sizing.scale600} ${theme.sizing.scale400}`,
  ...theme.typography.LabelXSmall,
  color: theme.colors.contentTertiary,
  fontVariantNumeric: 'tabular-nums',
});

/* ── THE PRESS, TRANSFORMING IN PLACE (FEED-IA §59.1 · THE-EXPORT-CANON §16.7) ────────────────
 * «`[⇄ Send to Sage 50]` → `[⇄ Going to Sage 50]` → the control dissolves and the rail's row states
 * "Sage 50 · went 07:41". Nothing stacks, and the bar's height is identical on both sides of the
 * press.» So it is ONE seat with three states, and the third one is not a control at all — it is
 * the same quiet line the other two notches end on, which is what makes all three branches finish
 * in the same place.
 *
 * IT IS THE ONE INPUT ON THIS STAGE THAT SETTLES IT. A demonstration loops because nobody has
 * touched it; a person who has just sent something and watches it un-send two seconds later is
 * being shown a screensaver. Pressing therefore stops the loop, and moving the dial starts it again.
 *
 * REDUCED MOTION LANDS ON `rest`, WHICH IS THE HONEST RESOLVED STATE OF THIS NOTCH: in MANUAL the
 * document sits waiting for a hand, and a hand is not something the performance may mime.
 */
function Press({ rail, at, onSent }: { rail: string; at: string; onSent: () => void }) {
  const [, theme] = useStyletron();
  const [state, setState] = React.useState<'rest' | 'going' | 'gone'>('rest');

  React.useEffect(() => {
    if (state !== 'going') return;
    const t = window.setTimeout(() => setState('gone'), MIN_TURN_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  return (
    <div
      data-testid="stage-press"
      data-state={state}
      style={{ margin: `0 ${theme.sizing.scale600} ${theme.sizing.scale400}`, minWidth: 0 }}
    >
      {state === 'gone' ? (
        <p data-testid="stage-rail" data-rail={`${rail} · went ${at}`} style={{ ...quietLine(theme), margin: 0 }}>
          {rail} · went {at}
        </p>
      ) : (
        <Button
          kind={KIND.secondary}
          size={SIZE.compact}
          data-testid="stage-press-send"
          disabled={state === 'going'}
          startEnhancer={<Glyph id="erp" size={STEP.small} />}
          onClick={() => {
            setState('going');
            onSent();
          }}
        >
          {state === 'going' ? `Going to ${rail}` : `Send to ${rail}`}
        </Button>
      )}
    </div>
  );
}

/* ── WHICH PERFORMANCE IS ON (THE-ADMIN-CANON §6, and §16.7's «the stage performs all three») ──
 * The canon's rule is «the stage plays the setting whose row was last touched», and the store makes
 * that readable without anybody being asked to report it: `grants.ts` publishes the WHOLE `Grants`
 * on every write, so the stage compares the object it holds with the one that just arrived and sees
 * which FIELD moved. Touch the ceiling row under the stage and the ceiling performs; touch the
 * appetite row and the appetite does.
 *
 * IT COSTS THE SEAT ABOVE NOTHING. `agent.tsx` hands the stage one dial and keeps handing it one
 * dial; a second performance did not become a second prop, a second constant or a second pointer to
 * keep in step.
 *
 * AND THE STAGE'S OWN CONTROL DOES NOT COUNT AS A TOUCH — that falls out for free, because the
 * stage writes to its SANDBOX and the sandbox is not the store. Playing with a demonstration may
 * not change which demonstration is playing.
 */
type Focus = 'given' | 'appetite';

/**
 * THE STAGE.
 *
 * `question` is the real contract entry whose row stands on the left. `script` is that entry's own
 * `example`. `sale` is a real order off the cast, and it is what the albarán embed draws.
 */
export function Stage({
  question,
  script,
  sale,
  cast,
  handover,
}: {
  question: CapabilityQuestion;
  script: StageScript;
  /** a real order off today's river — the document the performance produces */
  sale: Sale;
  cast: Cast;
  /** the person an escalation goes to, by name — read off the house's own escalation routing */
  handover: string;
}) {
  const [, theme] = useStyletron();
  const live = useGrants();
  const still = useStillness();
  /* the house's own system, by its own name — the appetite's performance is about THAT rail */
  const { derived } = useConfig();
  const rail = derived.erp.label;

  /* ── THE SANDBOX (THE-ADMIN-CANON §6) ────────────────────────────────────────────────────
   * The control on the stage is REAL — it is the same `GrantRow` the section under it draws — and
   * what it writes is a COPY. Touching a demonstration may not change what the house has actually
   * granted its agent: that would be a stage that costs something to play with, and a stage that
   * costs something is a stage nobody touches.
   *
   * IT STARTS FROM THE LIVE ANSWERS, so the performance a person sees first is THEIR house's
   * behaviour rather than a default nobody chose. */
  const [sandbox, setSandbox] = React.useState<Grants>(() => grantsNow());
  const [focus, setFocus] = React.useState<Focus>('given');

  /* ── THE LAST-TOUCHED READING ────────────────────────────────────────────────────────────
   * One comparison against the last `Grants` this stage saw. A field that moved is a row somebody
   * touched, and the performance follows it — AND THE SANDBOX TAKES THAT ANSWER, because a stage
   * still showing an older value would be a demonstration disagreeing with the row that started it.
   */
  const before = React.useRef(live);
  React.useEffect(() => {
    const was = before.current;
    before.current = live;
    if (was === live) return;
    /* ── THE RULE, GENERALISED, AND THE DEBT PAID (THE-ADMIN-CANON §6) ─────────────────────
     * This used to ask ONE further question — «did the field belonging to the question I was
     * handed move?» — which was true while exactly two performances stood here. §5's register
     * rows put five more settings on this seat, and with the narrow test a person pressing «Dry»
     * on the tone card watched the stage keep performing the register they had just left: the
     * SEAT had already re-pointed `question` at the moved dial, and the stage refused the new
     * value because the field that moved was not the field it had been watching a beat earlier.
     *
     * SO THE SEAT ANSWERS «WHICH DIAL» AND THE STAGE ANSWERS «WITH WHICH ANSWERS». Any write to
     * the store re-seeds the sandbox, because a stage showing an older value than the row that
     * started it is the one thing the sandbox may never do. Playing with the demonstration still
     * costs nothing: that writes to the SANDBOX, and the sandbox is not the store, so `live`
     * never moves and this effect never runs. */
    const appetiteMoved = was.dispatch !== live.dispatch || was.dispatchWait !== live.dispatchWait;
    setFocus(appetiteMoved ? 'appetite' : 'given');
    setSandbox(live);
  }, [live]);

  /* ── THE APPETITE'S PERFORMANCE, BUILT AGAINST THE SAME REAL ORDER ───────────────────────
   * The contract is asked first, so the day `dispatch` becomes a proper entry this reaches for its
   * row and its own `example` and the local pair above stops being read.
   */
  const appetite = React.useMemo(
    () => settingOf('dispatch' as GrantId) ?? appetiteControl(rail),
    [rail],
  );
  const appetiteScript = React.useMemo(() => {
    const ctx: StageContext = {
      figure: sale.figure,
      figureWords: soles(sale.figure, 0),
      handover,
      day: sale.deliveryDay,
      customer: sale.customer.name,
      goods: sale.lines[0]?.product.name,
    };
    return (appetite.example ?? appetiteExample(rail, sale.at, sandbox.dispatchWait))(ctx);
  }, [appetite, rail, sale, handover, sandbox.dispatchWait]);

  /** the dial standing on the left, and the script it is the input to */
  const dial = focus === 'appetite' ? appetite : question;
  const playing = focus === 'appetite' ? appetiteScript : script;

  const branch = React.useMemo(
    () => playing.branches.find((b) => b.when(sandbox)) ?? playing.branches[playing.branches.length - 1],
    [playing, sandbox],
  );

  const turns = React.useMemo(() => [...playing.opening, ...branch.turns], [playing, branch]);

  /* ── THE ONE ACT THAT SETTLES THE STAGE ──────────────────────────────────────────────────
   * A hand on the manual notch's press stops the loop (see `Press`). Moving anything starts it
   * again, which is what «a performance restarts when you touch it» already meant. */
  const [sent, setSent] = React.useState(false);
  React.useEffect(() => {
    setSent(false);
  }, [branch.id, focus]);

  /* ── THE WALK ────────────────────────────────────────────────────────────────────────────
   * `shown` is how many turns have arrived. One timer at a time, cleared on every change, so a
   * person who touches the control mid-performance restarts the performance rather than watching
   * two of them race. `prefers-reduced-motion` lands the resolved state and stops: no walk, no
   * loop, no repaint — and the same information, which is the test a reduced-motion path has to
   * pass to be a real one.
   */
/* THE STAGE IS NEVER EMPTY. It opens with the customer's message ALREADY THERE and the answer
   arriving — which is both the honest reading (a conversation starts because somebody wrote) and
   the fix for a surface that used to paint a blank dot grid on arrival. */
  const msOf = React.useCallback((i: number) => turnMs(turns[i]), [turns]);
  const { shown } = useWalk({ steps: turns.length, msOf, still, loop: !sent, from: 1 });

  const visible = turns.slice(0, shown);
  const authors = visible.map((t) =>
    (t.who === 'customer' ? AUTHOR.received : t.who === 'rocoto' ? AUTHOR.ai : AUTHOR.sent));
  const grouped = groupThread(authors);

  /* the chips a question offers, out of the contract itself — the same `choices` the questionnaire
     walks and the same `choose` it writes with, aimed at the sandbox instead of the store */
  const selected = dial.selected(sandbox);

  return (
    <section
      data-testid="stage"
      data-branch={branch.id}
      /** which setting is performing, and which row put it there — the last-touched rule, readable */
      data-dial={dial.id}
      data-focus={focus}
      data-playing={still ? 'still' : shown < turns.length ? 'yes' : 'held'}
      style={{
        display: 'grid',
        /* TWO COLUMNS WHERE THERE IS ROOM AND ONE WHERE THERE IS NOT. `auto-fit` with a floor is
           what makes the input and its consequence stay in ONE FRAME on a desk — which is the whole
           of the concept — and stack in the reading order (control, then what it does) on a phone. */
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: theme.sizing.scale700,
        padding: theme.sizing.scale700,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      {/* ── LEFT: THE REAL CONTROL ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <div
          style={{
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <GrantRow
            q={dial}
            grants={sandbox}
            testid="stage-control"
            chevron={false}
            /* pressing the ROW steps to the next value, so the whole row is live and not just the
               chips under it — the control is the input, at every grain */
            onOpen={() => {
              const at = dial.choices.findIndex((c) => selected.includes(c.value));
              const next = dial.choices[(at + 1) % dial.choices.length];
              setSandbox((g) => ({ ...g, ...dial.choose(g, next.value) }));
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
          {dial.choices.map((c) => {
            const on = selected.includes(c.value);
            return (
              <span key={c.value} data-chip={c.value} data-selected={on ? 'yes' : 'no'}>
                <Button
                  kind={on ? KIND.primary : KIND.secondary}
                  shape={SHAPE.pill}
                  size={SIZE.compact}
                  data-testid={`stage-${dial.id}-${c.value}`}
                  onClick={() => setSandbox((g) => ({ ...g, ...dial.choose(g, c.value) }))}
                >
                  {c.label}
                </Button>
              </span>
            );
          })}
        </div>

        {/* ── THE CAPTION (§6's UNDER region) ─────────────────────────────────────────────────
            ONE line, swapping with the branch. It is the sentence that makes the demonstration
            legible without narrating it: what the setting is now, and therefore what just happened
            on the right. */}
        <p
          data-testid="stage-caption"
          style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
        >
          {branch.caption}
        </p>

        {/* THE SANDBOX SAYS SO, ONCE, AND AFFIRMATIVELY. A person who has just moved a control has
            to know whether their house moved with it. «Your own setting stands» is the fact; the
            way to actually change it is the section below the stage, and the button says that. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
            Your own setting stands: {dial.value(live)}
          </span>
          <Button
            kind={KIND.tertiary}
            size={SIZE.mini}
            shape={SHAPE.pill}
            data-testid="stage-apply"
            onClick={() => setGrants({ ...dial.choose(live, selected[0] ?? '') }, dial.id)}
          >
            Set it to what the stage shows
          </Button>
        </div>
      </div>

      {/* ── RIGHT: THE CONVERSATION ITSELF ──────────────────────────────────────────────────
          The chat's own ground (§11: the dot grid MEANS a conversation, and on this seat it appears
          here and nowhere else), the kit's own bubbles, the app's own embeds. */}
      <div
        data-testid="stage-paper"
        style={{
          minHeight: 320,
          padding: `${theme.sizing.scale400} ${theme.sizing.scale400} ${theme.sizing.scale600}`,
          borderRadius: theme.borders.radius300,
          backgroundImage: dots(theme.colors.mono400),
          backgroundSize: (theme as unknown as { brand?: { dotTile: string } }).brand?.dotTile ?? DOT_TILE,
          backgroundColor: theme.colors.mono100,
          minWidth: 0,
        }}
      >
        {visible.map((turn, i) => (
          <React.Fragment key={`${branch.id}-${i}`}>
            <Message
              author={turn.who === 'customer' ? AUTHOR.received : turn.who === 'rocoto' ? AUTHOR.ai : AUTHOR.sent}
              grouped={grouped[i]}
            >
              {turn.text}
            </Message>

            {/* ── THE MACHINERY, ONE QUIET LINE (the Monzo layer) ────────────────────────────
                Under the bubble where the decision was made, naming the check that made it. It is
                read out of `net.ts`, so the six checks the grants section names and the check this
                line names are the same six — a demonstration that invented its own vocabulary would
                be teaching the wrong words. */}
            {turn.check && (
              <p
                data-testid={`stage-check-${turn.check}`}
                data-check={turn.check}
                style={quietLine(theme)}
              >
                {CHECKS.find((c) => c.id === turn.check)?.name ?? turn.check}
                {' · '}
                {dial.value(sandbox)}
              </p>
            )}

            {/* ── THE SAME SEAT, SAYING WHAT THE RAIL DID (THE-EXPORT-CANON §16.7) ───────────
                «Sage 50 · goes at 08:11» — the rail by its own name and the hour it goes at. It
                stands under the bubble that decided, exactly where a check stands, because on this
                stage there is ONE quiet line and it says whichever machinery just ran. */}
            {turn.rail && (
              <p data-testid="stage-rail" data-rail={turn.rail} style={quietLine(theme)}>
                {turn.rail}
              </p>
            )}

            {turn.chip?.kind === 'albaran' && (
              <ChatEmbed embed={{ kind: 'albaran', sale }} cast={cast} />
            )}
            {turn.chip?.kind === 'handover' && (
              <ChatCard
                kind="reasoning"
                testid="stage-handover"
                label={`Handed to ${handover}`}
                owed
              >
                <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary, minWidth: 0 }}>
                  {turn.chip.line}
                </span>
              </ChatCard>
            )}
            {turn.chip?.kind === 'press' && (
              <Press rail={turn.chip.rail} at={turn.chip.at} onSent={() => setSent(true)} />
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

export default Stage;
