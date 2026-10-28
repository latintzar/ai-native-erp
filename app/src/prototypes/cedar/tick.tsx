/* THE TICK — the confidence organ, and the TWO actions a person is ever owed.
 *
 * ═══ WHAT PETER ASKED FOR, VERBATIM (FEED-IA §120.2) ════════════════════════════════════════
 * «The confidence needs to be really nice, visual, and nicely tucked away, meaning a tick,
 * otherwise not an issue, but not an issue. It needs to be somehow really well and really nice
 * and fun, like a grammarly design team-level.»
 *
 * So the organ has exactly two registers, and the quiet one is the default:
 *
 *   ALL WELL     a TICK. One mark, drawn, in the accent that means Rocoto's own act — and NO
 *                WORD AT ALL. A settled document says nothing, the way Grammarly's own mark says
 *                nothing when a sentence is fine. It is 20px and it is the whole of the state.
 *   AN ISSUE     the mark of the action owed, and the action's own word beside it. This is the
 *                only case that surfaces as more than a tick, which is the whole of §120.2.
 *
 * ═══ AND THE ONLY TWO WORDS IT CAN EVER SAY (FEED-IA §120.3, sharpening §110/§110.1) ═════════
 * «The whole "act clarify hold the handoff" is wrong. I told you already: either they need to
 * edit and double-check the delivery note, or they need to reply to the customer. Those are the
 * two actions. I guess you can put the different reasons why, but there are two things.»
 *
 * EDIT · REPLY. Two, closed, in one record, so a third can never be written into a surface by
 * hand. The four checkpoint words survive as `PolicyId` — `sale.ts`'s own lower-case ids, which
 * this file FOLDS and never prints. Nothing a person reads says ACT, CLARIFY, HOLD or HANDOFF.
 *
 * ═══ THE RESTRAINT IS THE STATE, AND IT IS SAYABLE (FEED-IA §120.4) ═════════════════════════
 * «In all cases, if it needs to pass something to review, it would basically restrain itself from
 * replying. In some of the cases, it's expecting an answer through the delivery note. In other
 * cases, it's expecting the person to message the user themselves. In all cases, if they message
 * the user themselves clarifying stuff, the runtime would obviously take that in and reason with
 * that.»
 *
 * So each action carries its RELEASE — the sentence that says how the restraint ends — and both
 * are written as what IS rather than as what is missing (the copy law):
 *   EDIT   «Your edit sends it.»            the answer arrives THROUGH the albarán
 *   REPLY  «Rocoto reads what you write.»   the co-present loop, said in one line
 *
 * ═══ THERE IS NO NUMBER HERE, AND THERE CANNOT BE (§9 · §9.13) ══════════════════════════════
 * No percentage, no score, no bar, no five-point anything. The type has two members and a null;
 * a confidence figure has nowhere to live in it. This is §9's ban in its positive form.
 *
 * ═══ AND IT IS NOT A TRAFFIC LIGHT (§51's colour law, §72.3) ═══════════════════════════════
 * The settled tick wears the ACCENT because a settled document is ROCOTO'S OWN ACT — it read the
 * message and it answered. An owed action wears INK, because the hand about to do it is the
 * person's. Nothing here is red, nothing is amber, and the difference between the two registers
 * is a mark and a word rather than a hue.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Glyph, STEP, type GlyphId } from './glyphs';
import { dismissedNow, useDismissals } from './dismissals';
import { jobOf, type PolicyId, type Sale } from './sale';

/* ── THE TWO ACTIONS ──────────────────────────────────────────────────────────────────────── */

/** THE WHOLE VOCABULARY OF THIS ORGAN. Two members, and `null` for the settled case — which is
 *  an ABSENCE of work rather than a third kind of it (§72.3's calm, typed). */
export type Owed = 'edit' | 'reply';

/** THE TWO WORDS A PERSON EVER READS HERE, written once so a third cannot be typed into a card.
 *  Each one names its own object: the albarán, and the customer. */
export const OWED_WORD: Record<Owed, string> = {
  edit: 'Edit the delivery note',
  reply: 'Reply to the customer',
};

/** HOW THE RESTRAINT ENDS (§120.4) — one sentence each, and both say what happens rather than
 *  what is missing. They are the difference between a queue and a co-present machine. */
export const OWED_RELEASE: Record<Owed, string> = {
  edit: 'Your edit sends it.',
  reply: 'Rocoto reads what you write.',
};

/** THE SETTLED STATE'S ONE WORD, and it is a LABEL rather than paint: the tick says it to a
 *  screen reader and to a hovering hand, and says nothing on screen. It is «Settled» rather than
 *  «Rocoto answered» because a document the house wrote at its own desk is settled too, and
 *  claiming Rocoto answered one of those would be the organ inventing an act. */
const SETTLED_WORD = 'Settled';

/** ONE MARK PER ACTION, out of the app's own vocabulary (§30: an icon used always is language).
 *  `doc` is the albarán everywhere in this app; `chat` is the conversation everywhere in it. */
const OWED_MARK: Record<Owed, GlyphId> = { edit: 'doc', reply: 'chat' };

/** THE FOLD — the machine's four ids, read as the person's two actions.
 *
 *  IT IS `sale.ts`'S OWN `jobOf` AND NEVER A SECOND OPINION. That function already answers the
 *  one question §120.3 asks — could Rocoto FORM the albarán? — and returns `check` where a draft
 *  stands and `answer` where words are owed. This renames its answer into §120's grammar and adds
 *  nothing: a surface that folded the verdicts a second way would be a second machine.
 *
 *  A COLD START IS A REPLY, and it is the one clause this file owns. `policyOf` routes a
 *  stranger's first order through the `newAccount` topic, and what a person does about a stranger
 *  is write to them — `customers-made.ts`'s own law: a person opens the account from their name. */
export function actionOwed(sale: Sale, cold = false): Owed | null {
  /* AN ANSWERED ANXIETY ASKS NOTHING MORE (§127.2). A person who dismissed this one told Rocoto
     WHY, and that why is kept — so the organ settles and the red clears, «the moment the person
     acts or dismisses-with-why» (§127.3). It is the first clause because it outranks the fold: a
     dismissal is a decision a human took about this very document. */
  if (dismissedNow(sale.id)) return null;
  if (cold) return 'reply';
  const job = jobOf(sale);
  if (!job) return null;
  return job.id === 'check' ? 'edit' : 'reply';
}

/** THE SAME ANSWER, FOR A COMPONENT — subscribed, so a dismissal anywhere on screen settles every
 *  organ reading the same document in the same frame. Surfaces use this; folds use `actionOwed`.
 *
 *  IT TAKES A NULLABLE SALE ON PURPOSE. A surface asking «what does the open anxiety want» has no
 *  document while nothing is open, and a hook may not be called behind a branch — so the absence
 *  is answered here (nothing owed, because there is nothing) rather than worked around by the
 *  caller inventing an empty `Sale` to hand in. */
export function useOwed(sale: Sale | null, cold = false): Owed | null {
  useDismissals();
  return sale ? actionOwed(sale, cold) : null;
}

/* ── THE ONE RED CLAIM (FEED-IA §127.3) ───────────────────────────────────────────────────────
 * «Red is reserved for ONE claim — a human being is waiting on you. The dot appears only while
 * something downstream is blocked on the person: a withheld reply not yet sent… It NEVER marks
 * Rocoto's own uncertainty (that is the anxiety card, in the product's neutral/saffron), never
 * decorates resolved history, and clears the moment the person acts or dismisses-with-why.»
 *
 * SO IT IS A REPLY AND ONLY A REPLY. An EDIT is Rocoto unsure about its own draft — its own
 * uncertainty, which §127.3 puts explicitly out of red's reach. A REPLY is a person on the other
 * end of a conversation with the answer missing, which is the sentence red is allowed to say.
 *
 * THE HUE IS THE BRAND'S OWN ACCENT, AND THAT IS SANCTIONED RATHER THAN SMUGGLED.
 * `rocoto-theme.ts` collapses negative/warning/positive onto ink («there is no traffic light in
 * this product»), so there is no second hue to reach for and `colors.negative` would paint this
 * claim in ink. `attention-dot.tsx` is where §127.3's widening is written down — the accent now
 * marks the AI's own act AND the one claim that a person is waiting, and nothing else moves. This
 * organ takes the same accent from the same reservation, so the dot, the outline and the mark are
 * one claim in one colour.
 */
/** ⚠ RETIRED IN FAVOUR OF `attention-dot.tsx`'s `waitingOnAPerson` (§127.3). The claim is decided
 *  in ONE fold — the file where the accent's reservation was widened by exactly one sentence — so
 *  a surface asking «is this red» asks THAT and never a rule of its own. This helper stays only as
 *  the tick's own paint question, and it is deliberately narrower than the claim: the ORGAN turns
 *  the action's mark to the accent where the action is a reply, which is the same case. */
export const isRed = (owed: Owed | null): boolean => owed === 'reply';

/* ── THE ORGAN ────────────────────────────────────────────────────────────────────────────── */

/** the seat both registers stand in, so the row's height is identical settled and owed (§37.3).
 *
 *  EXPORTED because the organ LEADS the dock's state row, so it is the tallest thing on that
 *  row's first line and therefore the row's own single-line height. `detail.tsx` takes the number
 *  from here rather than restating it — a state row whose height was typed out separately would
 *  drift the day this seat moves, and that row's whole yielding rule stands on the height being
 *  exactly one line (§129.5 · THE-CHECKPOINT-AUDIT finding 2). */
export const TICK_SEAT = 20;
const SEAT = TICK_SEAT;

/** the tick's own path length, measured off the `d` below — the dash that draws it */
const STROKE_LENGTH = 15;

/**
 * THE SETTLED MARK, AND IT DRAWS ITSELF.
 *
 * A ring in the accent, and a tick stroked into it over one timing token: `strokeDashoffset` from
 * the path's own length to zero, on `easeOutCurve`. Paint only — the circle is at rest from the
 * first frame and nothing under this mark is being animated, so a settling tick cannot move a
 * pixel of the row it rides.
 *
 * REDUCED MOTION LANDS IT DRAWN, which is the honest resolved state: the document IS settled, and
 * a person who asked for stillness is owed the fact rather than the performance.
 *
 * ⚠ AND IT IS INK, NOT RED (FEED-IA §127.3 · THE-CHECKPOINT-AUDIT finding 1). This ring and its
 * tick were drawn in the accent, so a SETTLED document — the state whose whole meaning is «nothing
 * is owed here» — wore the app's one urgent colour on every dock in the house. It is the exact
 * inversion of §127.3: red says a person is waiting, and this mark says nobody is. The HELD
 * register below keeps the accent where `owed === 'reply'`, which is the claim itself.
 */
function Settled() {
  const [css, theme] = useStyletron();
  const drawn = css({
    animationName: {
      from: { strokeDashoffset: `${STROKE_LENGTH}` },
      to: { strokeDashoffset: '0' },
    } as unknown as string,
    animationDuration: theme.animation.timing400,
    animationTimingFunction: theme.animation.easeOutCurve,
    animationFillMode: 'both',
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0ms' },
  });
  return (
    <svg
      width={SEAT}
      height={SEAT}
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={{ display: 'block', flex: '0 0 auto', overflow: 'visible' }}
    >
      {/* THE RING IS THE SEAT, at the weight `confirm`'s own ringed tick stands at — so this mark
          reads as a member of the app's icon family rather than as a decoration. */}
      <circle cx="10" cy="10" r="8.5" fill="none" stroke={theme.colors.contentTertiary} strokeWidth="1.25" opacity="0.4" />
      <path
        className={drawn}
        d="M6.1 10.3 L8.8 13 L13.9 7.5"
        fill="none"
        stroke={theme.colors.contentTertiary}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={STROKE_LENGTH}
      />
    </svg>
  );
}

/**
 * ┌─ THE TICK, IN ITS TWO REGISTERS ───────────────────────────────────────────────────────────┐
 * │  SETTLED   ( ✓ )                                                                           │
 * │  OWED      [▤] Edit the albarán            or      [▭] Reply to the customer               │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * AND TWO FORMS, BECAUSE THE ROWS IT RIDES ARE DIFFERENT WIDTHS. `word` is the organ whole — the
 * mark and the action — and it is what a surface with a line to spare mounts. `mark` is the mark
 * alone, for a row whose other columns are already spoken for: the pinned order face in a 400px
 * panel, where a word here would eat the albarán's own name. The STATE IS IDENTICAL in both: it
 * is on the attributes and on the label, so a `mark` never says less than it knows.
 *
 * THE STATE IS ON THE ATTRIBUTES, ALWAYS. `data-owed` is `edit` · `reply` · `none`, `data-held`
 * says whether Rocoto restrained its reply, and `data-policy` carries the machine's own lower-case
 * id for the harnesses. A drive reads the organ's state without reading a word off a screen.
 */
export function ConfidenceTick({
  owed,
  form = 'word',
  policy,
  testid = 'tick',
}: {
  /** which of the two actions is owed, or `null` where the document is settled */
  owed: Owed | null;
  form?: 'mark' | 'word';
  /** the machine's own id, carried for the harnesses and never painted (§120.3) */
  policy?: PolicyId;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  const held = owed !== null;
  const red = isRed(owed);
  /* THE WHOLE STATE IN ONE STRING — the word and, where one is owed, how the restraint ends. */
  const says = held ? `${OWED_WORD[owed]} · ${OWED_RELEASE[owed]}` : SETTLED_WORD;
  /* AND IT IS ANNOUNCED WHEREVER IT IS NOT DRAWN. A settled tick paints no word and a `mark` form
     paints none either, so those two are IMAGES with a name; a `word` form already says itself and
     a label over it would announce the sentence twice. `title` rides all three, for the hand. */
  const named = !held || form === 'mark';
  return (
    <span
      data-testid={testid}
      data-owed={owed ?? 'none'}
      data-held={held ? 'yes' : 'no'}
      data-policy={policy}
      data-form={form}
      /* THE ONE RED CLAIM, STATED (§127.3) — «a human being is waiting on you», and nothing else
         in this app may say it. A drive reads the claim without reading a colour off a pixel. */
      data-red={red ? 'yes' : 'no'}
      role={named ? 'img' : undefined}
      aria-label={named ? says : undefined}
      title={says}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale200,
        flex: '0 0 auto',
        minWidth: 0,
      }}
    >
      {held ? (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: SEAT,
            height: SEAT,
            flex: '0 0 auto',
            color: red ? theme.colors.accent : theme.colors.contentPrimary,
          }}
        >
          <Glyph id={OWED_MARK[owed]} size={STEP.small} />
        </span>
      ) : (
        <Settled />
      )}

      {/* THE WORD IS THE ISSUE'S OWN HALF (§120.2: «otherwise not an issue»). A settled tick has
          no word, and that silence is the design rather than an omission. */}
      {held && form === 'word' && (
        <span
          data-testid={`${testid}-word`}
          style={{
            ...theme.typography.LabelXSmall,
            color: red ? theme.colors.accent : theme.colors.contentPrimary,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {OWED_WORD[owed]}
        </span>
      )}
    </span>
  );
}
