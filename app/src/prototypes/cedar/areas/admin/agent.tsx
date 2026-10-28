import { soles } from '../../currency';
/* TU AGENTE — the contract, surfaced, with the contract performing itself at the head.
 *
 * «Your Rocoto agent, or your customer agent, something like that — where they can tweak the
 * settings of how it handles stuff» (FEED-IA §53). And the design job attached to it: «there needs
 * to probably be a real example, like animated chats… we want to do it super nicely.»
 *
 * ═══ THE WIREFRAME (§51.24 · THE-ADMIN-CANON §2.1) ══════════════════════════════════════════
 *
 *   ┌─ TU AGENTE · one column, scrolling (§87) ────────────────────────────────────────────────┐
 *   │ STAGE    the bring-to-life performance — the real control on the left, the conversation    │
 *   │          it governs on the right, one caption under it (stage.tsx, §6 of the canon)        │
 *   ├──────────────────────────────────────────────────────────────────────────────────────────┤
 *   │ DIALS    the contract rendered as GrantRows: confirm · upTo · ceiling · prices · checkIn ·│
 *   │          assortment · ambiguity · off-catalogue · the appetite. The SENTENCE is the value; │
 *   │          saffron where Rocoto acts alone                                                   │
 *   ├──────────────────────────────────────────────────────────────────────────────────────────┤
 *   │ LIVE     WHO ROCOTO ANSWERS (THE-JOURNEY-CANON §5.1–5.2 · §91.4.10) — the mode, the        │
 *   │          accounts it is live for as doors, the channel they arrive on, and the one act     │
 *   │          «Choose customers». It stands directly under the dials because the answer to      │
 *   │          «what does it handle» now has a WHO in it, and it is ALWAYS REACHABLE: the month  │
 *   │          bar opens the same flow the first time, this region every time after              │
 *   ├──────────────────────────────────────────────────────────────────────────────────────────┤
 *   │ VOICE    the REGISTER (tone · brevity · voice notes — GrantRows, and NOT ONE of them wears │
 *   │          the saffron mark) · the name it answers by · the languages · tú or usted          │
 *   ├──────────────────────────────────────────────────────────────────────────────────────────┤
 *   │ ROUTING  topic → the person it goes to (a DOOR into Team) · the holding line meanwhile ·   │
 *   │          one flat line: the register sets the words, the dials set the authority (§5.12)   │
 *   ├──────────────────────────────────────────────────────────────────────────────────────────┤
 *   │ NET      the six checks, named — the band is the proof, the dials say what gets checked    │
 *   ├──────────────────────────────────────────────────────────────────────────────────────────┤
 *   │ WALK     the capability questionnaire's door — skippable, blocking nothing (U2 stands)     │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS   HeadingXSmall (a section) · LabelMedium (a grant's sentence, a row's label) ·
 *                LabelXSmall (a grant's own name, the machinery line) · ParagraphXSmall (the line
 *                under a row).
 *   STATES       a dial is a door onto the SAME question component the questionnaire walks, so
 *                re-answering here goes through the code path that answered it first. The stage is
 *                a sandbox: touching it changes what the performance does and nothing else. The
 *                tone card carries the Company DNA — what Rocoto read off the house's own
 *                messages, with its evidence, droppable line by line.
 *
 * ═══ WHY THE DIALS ARE READ OFF `home` AND NOT LISTED HERE ══════════════════════════════════
 * THE-ADMIN-CANON §5's placement rule is data (`grants.ts`), so this seat asks the contract which
 * settings belong to it. A setting that moves to Operations leaves this seat by changing one
 * character in the contract — and can never end up rendered on both, which is exactly the
 * double-home tension the rule exists to close.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { useConfig } from '../../config';
import CapabilityQuestionnaire, { GrantQuestion } from '../../capability';
import { GrantRow, List, Row, Section, TILE } from '../../rows';
import Stage from '../../stage';
import { CHECKS, CHECK_COUNT_WORD } from '../../net';
/* THE BOUND'S OWN LEDGER AND ITS OWN CARD (§91.4.10). The seat READS the activation fold and MOUNTS
   the going-live card the journey already owns — the same component, never a second copy of it
   (§27.5), and it never learns what a cohort is beyond the ids the fold hands it.
   ⚠ WHY THE CARD AND NOT THE SEAM. `openCohortFlow` reaches the copy the JOURNEY CARD mounts, and
   the journey card stands in the rail — which the phone does not draw. A control that works at 1600
   and does nothing at 390 is worse than no control, so this seat holds its own instance and the
   seam stays exactly what it was: the month bar's way in. */
import { COHORT_CAP, record, useActivation } from '../../activation';
import { GoLiveCard } from '../../activation-web';
import { Door, openCustomer, openUser, useSetupTail } from '../../anchors';
import { buildSales, todayId, type Sale } from '../../sale';
import { useDay } from '../../day';
import {
  ALL_SETTINGS, CEILING_STEPS, MARGIN_STEPS, agentSettings, registerSettings, setGrants,
  settingOf, toggleDnaLine, useGrants,
  type Appetite, type CapabilityQuestion, type GrantId, type Grants, type Margin,
} from '../../grants';
import { houseStyle, useKnows } from '../../knows';
import { houseVoice } from '../../insights';
import {
  ESCALATION_TOPICS, LANGUAGES, mainNumber, memberOf, setCompany, useCompany,
  type Address, type EscalationTopic, type Language,
} from '../../company';
import type { AreaMeta } from '../../shell/area';
/* §122 — the agent's own name is authored, so it edits where it is read. */
import { LiveValue } from '../../live-value';

export const meta: AreaMeta = {
  id: 'agent',
  title: 'Your agent',
  owner: 'V2-ADMIN',
  /* §87 — an administration seat is a settings surface and scrolls as one column. */
  panes: false,
};

/** WHICH DIAL THE STAGE OPENS ON. The ceiling, because it is the setting whose consequence is the
 *  most legible in one frame — the same order, answered or held, depending on one number. The
 *  contract carries the script (`example`), so this is a POINTER and not a performance. */
const STAGE_DIAL: GrantId = 'ceiling';

/* ── AND THEN IT PLAYS THE ROW YOU LAST TOUCHED (THE-ADMIN-CANON §6's own rule) ───────────────
 * The canon says «the stage plays the setting whose row was last touched», and until §5's rows
 * landed there was one setting with a performance, so a constant was the whole of it. There are
 * five now, and a seat that always opened on the ceiling would be a seat where four of them
 * demonstrate nothing.
 *
 * THE CONTRACT ANSWERS WHICH ONES CAN PLAY. A setting performs where it carries an `example`, so
 * the list below is READ off `ALL_SETTINGS` rather than written here — a setting that gains a
 * performance next month joins the rotation by gaining a field, and this file learns nothing.
 * (§53: «bring it to life» has to be a thing the canon can keep growing.)
 */
const PLAYABLE: GrantId[] = ALL_SETTINGS.filter((q) => q.example).map((q) => q.id);

function useLastTouched(fallback: GrantId): GrantId {
  const grants = useGrants();
  const before = React.useRef(grants);
  const [at, setAt] = React.useState<GrantId>(fallback);
  React.useEffect(() => {
    const was = before.current;
    before.current = grants;
    if (was === grants) return;
    /* the store publishes the WHOLE object on every write, so which row a person touched is a
       reading of the object rather than something a caller has to report */
    const moved = PLAYABLE.find((id) => was[id as keyof Grants] !== grants[id as keyof Grants]);
    if (moved) setAt(moved);
  }, [grants]);
  return at;
}

/* ═══ THE HOUSE'S APPETITE (FEED-IA §68 · THE-EXPORT-CANON §16.7) ═══════════════════════════════
 *
 * «The grace window is a setting. It still means they're slaves to the system. I told you earlier —
 * this is a SETTING, an APPETITE, bro.» And the spine the section is tested against:
 *
 *     THE SYSTEM LEADS ATTENTION. THE HOUSE LEADS APPETITE.
 *
 * What is worth noticing is Rocoto's judgment, said quietly on the row (§67.6). How eagerly a
 * document leaves is the house's own decision, made once here and changed in one row.
 *
 * ═══ WHY THE ENTRY IS WRITTEN HERE AND NOT IN THE CONTRACT ══════════════════════════════════
 * `grants.ts` already holds the VALUE — `dispatch` and `dispatchWait`, their types, their defaults,
 * their parser — and its own header says where the rest belongs: «THE VALUE LIVES HERE; ITS ROW
 * LIVES IN TU AGENTE.» So the row is written in the seat that renders it, against the store that
 * owns it. The entry is the contract's own shape (`CapabilityQuestion`), so the day it moves into
 * `CAPABILITY_QUESTIONS` beside the other ten it moves as-is, and `agentSettings()` picks it up
 * with no edit here — the two ids join `GrantId` and this constant is deleted. That is the whole
 * of the debt, and it is named rather than left to be found.
 *
 * ═══ IT GOVERNS THE SYSTEM RAIL AND NOTHING ELSE (§68.3) ════════════════════════════════════
 * «PRINTING ALWAYS MANUAL.» Paper is a hand at every notch, the bay's packing list is a hand at
 * every notch, and the customer's copy answers to the clock. A setting called «automatic sending»
 * would silently claim the printer, so the row is named for the rail it actually moves — and the
 * rail is named by its own name (§15.3.1: never a category where a name exists).
 */

/** THE TWO NOTCHES THAT ARE ROCOTO'S OWN ACT — the saffron mark, and nothing else, marks them. */
const AUTO_NOTCHES: Appetite[] = ['at-once', 'after-a-margin'];

/** THE MARGIN, IN THE TRADE'S OWN WORDS. A length a person says out loud, never a countdown
 *  (§16.7: «a window is stated as an hour, never as a countdown»). */
const marginWords = (m: Margin): string =>
  (m === 60 ? 'an hour' : m === 30 ? 'half an hour' : 'ten minutes');

/* ── THE MARGIN'S CLOCK, WRITTEN ONCE (§68.2 · §66.1, AUDIT-2 C19) ────────────────────────────
 * One setting used to state two different clocks two presses apart. The ROW said «It goes to the
 * day's file HALF AN HOUR AFTER IT IS READ»; the same setting opened said «It reaches the day's
 * file ONCE THE MARGIN HAS PASSED, and an edit starts the margin again». Both were wrong in the
 * same way and each was wrong in its own:
 *
 *   THE ROW STATED THE CLOCK §68.2 KILLED. «Opening starting timer is dumb» — dead, and confirmed.
 *   A margin that runs from the moment a document is read is a margin a person starts by LOOKING,
 *   which is the behaviour that ruling threw out.
 *   AND IT USED §66.1'S WORD FOR SOMETHING ELSE. «Read» in this app means a human paid attention
 *   to a document. Spending it on a machine's parse inside a settings row is the one string
 *   teaching two meanings.
 *   THE MODAL WAS RIGHT ABOUT THE CLOCK AND SILENT ABOUT ITS LENGTH, so a person reading the row
 *   and a person reading the card could not check one against the other.
 *
 * SO THERE IS ONE SENTENCE AND BOTH ALTITUDES SAY IT. The clock runs on EDITS — the margin is over
 * when nothing has moved for its length — which is what the modal always meant by «an edit starts
 * the margin again», said forwards. The row fills the length in because it has the house's setting
 * in hand; the card says «the margin» because it is the thing being chosen. Same words, same
 * clock, and neither can drift because there is only one place to change them.
 */
const marginSentence = (rail: string, wait?: Margin): string =>
  `It reaches ${rail} once ${wait ? marginWords(wait) : 'the margin'} has passed with the line as it stands`;

/** THE SENTENCE THE ROW READS — one per notch, each of them a statement of what happens. */
const appetiteWords = (rail: string, notch: Appetite, wait: Margin): string => {
  if (notch === 'at-once') return `It goes to ${rail} as it comes`;
  if (notch === 'on-a-press') return `It goes to ${rail} when you press`;
  return marginSentence(rail, wait);
};

/** THE ENTRY, written against the rail's REAL NAME. It is a factory because the name is the
 *  house's own — «Sage 50» once they connect one, «the day's file» until they do — and a row that
 *  said «your ERP» to a house that has one is the category §15.3 retires. */
function appetiteSetting(rail: string): CapabilityQuestion {
  return {
    id: 'dispatch' as GrantId,
    home: 'agent',
    prompt: `When does a delivery note go to ${rail}?`,
    aside: `This sets when a delivery note goes to ${rail}. Paper prints when you press.`,
    choices: [
      {
        value: 'at-once',
        label: 'As it comes',
        hint: `It reaches ${rail} the moment Rocoto has read it.`,
      },
      {
        value: 'after-a-margin',
        label: 'After a margin',
        hint: `${marginSentence(rail)}.`,
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
      /* THE BOUNDARY IS THE LABEL'S OWN WORK (§68.3 · §51.7, AUDIT-2 C19/C31). The row used to
         carry «Your own eagerness, on the system rail. Paper stays a press.» — a sentence in a
         lexicon this app does not speak, guarding against a misreading the label already prevents.
         The label names the rail by its own name («When it goes to Sage 50»), so a person reading
         it knows exactly which road this setting moves; and the card behind it still says what
         paper does, in the `aside`, where the choice is actually being made. */
      label: `When it goes to ${rail}`,
      mark: 'send',
    },
    value: (g) => appetiteWords(rail, g.dispatch, g.dispatchWait),
    rocoto: (g) => AUTO_NOTCHES.includes(g.dispatch),
  };
}

/* ── THE RAMP, AS AN OFFER (THE-EXPORT-CANON §16.7's last section) ────────────────────────────
 * §32's path — «the sweep teaches the net, the grants widen, the press replaces the sweep» — is no
 * longer a mechanism that moves by itself. THE HOUSE MOVES THE NOTCH, AND ROCOTO MAY ONLY OFFER
 * THE NEXT ONE. The five rules, and where each of them lives in the code below:
 *
 *   1 · ON THE SETTING'S OWN ROW, in Tu agente — never a notification, never the desk, never the
 *       chat, never an albarán. It is rendered inside the appetite row's own box and nowhere else
 *       in this file, and `grep RampOffer` is the audit.
 *   2 · IT STATES A FACT AND NOTHING ELSE, and the next notch sits beside it as a one-tap change.
 *       The fact is COUNTED off the house's own river (`sentToErp`), never composed.
 *   3 · ONCE PER NOTCH. There is exactly one offer per notch — the notch above the one they are
 *       standing on — and the top notch has none, so a house at «as it comes» is never offered
 *       anything. Declining is doing nothing, and doing nothing is a complete answer.
 *   4 · IT WITHDRAWS ITSELF the moment the streak breaks or the setting moves. Both fall out of
 *       the arithmetic: a single document corrected after it went empties the offer, and moving
 *       the notch recomputes which offer (if any) belongs to the new one.
 *   5 · IT NEVER COUNTS DOWN, NEVER NAGS, AND IS NEVER A CRITICISM IN MANUAL. The sentence is
 *       about what their own mornings have done, in the affirmative, with no comparison in it —
 *       «a house that presses is not behind, it is a house that presses.»
 */

/** WHAT THE NEXT NOTCH UP IS, and the top notch's honest answer: nothing. */
const NEXT_NOTCH: Partial<Record<Appetite, Appetite>> = {
  'on-a-press': 'after-a-margin',
  'after-a-margin': 'at-once',
};

/** the one-tap change beside the fact — what the house GETS, said as the thing it is */
const NOTCH_OFFER: Record<Appetite, string> = {
  'at-once': 'Let them go as they come',
  'after-a-margin': 'Let them go after a margin',
  'on-a-press': 'Keep them under your press',
};

/** A RUN WORTH STATING. One document is not evidence and a sentence about one would be Rocoto
 *  asking rather than reporting, so the offer waits until the house's own mornings have a number
 *  in them. Twenty is well inside a single morning at §12's design load (300 orders a day), which
 *  is what makes it a floor rather than a wait. */
const RUN_ENOUGH = 20;

/** WHAT THE HOUSE'S OWN MORNINGS HAVE DONE, counted off the river and never composed: how many
 *  albaranes have gone to the system, across how many days, and whether every one of them stood as
 *  it went. `stale` on the ERP send is the read model's own word for «the goods moved after it
 *  travelled», which is exactly the correction that breaks a streak. */
function erpRun(sales: Sale[]): { gone: number; days: number; clean: boolean } {
  const gone = sales.filter((s) => s.sentToErp);
  const days = new Set(gone.map((s) => s.day)).size;
  return { gone: gone.length, days, clean: gone.every((s) => !s.sentToErp?.stale) };
}

/* ═══ THE COMPANY DNA (THE-CHECKPOINT §5.2 · FEED-IA §83.2) ══════════════════════════════════
 *
 * «Also support a profile based on the company's real communication history — current concept:
 * Company DNA. This can be inferred from WhatsApp/email history rather than forcing the customer
 * to write a style prompt.»
 *
 * ═══ IT SHOWS WHAT IT READ, AND THAT IS THE WHOLE DESIGN ════════════════════════════════════
 * A register inferred from somebody's own messages is a claim about them, and a claim about
 * somebody with no evidence under it is the software having an opinion. So every line Rocoto read
 * stands here with the facts it was read off — the same anatomy every observation in this app
 * carries — and the method under them says how the reading was made.
 *
 * ═══ EDITABLE, NEVER FORCED ═════════════════════════════════════════════════════════════════
 * Two clauses, both built. NEVER FORCED: it is a fourth chip beside three named registers, and
 * the default is `cordial`, so a house that never presses it has a register it chose (§83.2 —
 * offered, never imposed). EDITABLE: any line can be dropped, dropping one is a complete answer
 * that needs no confirmation, and it can be put back with the same press. The register RE-READS
 * when a line goes, which is what makes the edit worth having — drop «you open with a good
 * morning» and the house's own register reads dry.
 *
 * ═══ AND A HOUSE THAT HAS BROUGHT NOTHING IN GETS THE DOOR, NOT A GUESS ═════════════════════
 * `read: false` says what the reading comes from and opens «Your data», where a year of messages
 * is brought in. Inventing a register off no messages would be exactly what §5.2 is avoiding.
 */
function CompanyDna({
  voice,
  all,
  dropped,
}: {
  voice: ReturnType<typeof houseVoice>;
  /** every line, dropped ones included — the dropped ones are how they get put back */
  all: ReturnType<typeof houseVoice>['lines'];
  dropped: string[];
}) {
  const [, theme] = useStyletron();

  const head = (
    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
      Your own house
    </span>
  );

  if (!voice.read) {
    return (
      <div
        data-testid="company-dna"
        data-read="no"
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
      >
        {head}
        <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '58ch' }}>
          Rocoto learns your register from delivery notes, product files, and customer records you choose to provide.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="company-dna"
      data-read="yes"
      data-register={voice.register}
      data-lines={voice.lines.length}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      {head}
      <span data-testid="dna-register" style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>
        {voice.sentence}
      </span>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius200,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {all.map((o, i) => {
          const gone = dropped.includes(o.id);
          return (
            <div
              key={o.id}
              data-dna-line={o.id}
              data-kept={gone ? 'no' : 'yes'}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: theme.sizing.scale400,
                padding: theme.sizing.scale500,
                borderTop: i === 0 ? undefined : `1px solid ${theme.colors.borderOpaque}`,
                minWidth: 0,
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    ...theme.typography.ParagraphSmall,
                    /* A DROPPED LINE STAYS LEGIBLE AND STEPS BACK. It is still a thing Rocoto
                       read, and a house that changes its mind has to be able to read it again. */
                    color: gone ? theme.colors.contentTertiary : theme.colors.contentPrimary,
                    minWidth: 0,
                  }}
                >
                  {o.sentence}
                </span>
                {/* ── ONE FACT PER LINE (read off the shot) ────────────────────────────────
                    Joined with a middot they ran together as «168 of your 296 accounts reach you
                    on WhatsApp, the phone or at the counter — your own accounts · the same form
                    across 12 months of messages — the year you brought in»: two separate readings
                    wearing one sentence, with an em-dash and a middot doing different jobs three
                    words apart. Evidence is a LIST, so it is drawn as one. */}
                <span
                  data-dna-evidence={o.id}
                  style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}
                >
                  {o.evidence.map((e, n) => (
                    <span
                      key={n}
                      style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}
                    >
                      {e.where ? `${e.fact} — ${e.where}` : e.fact}
                    </span>
                  ))}
                </span>
              </span>
              <span style={{ flex: '0 0 auto' }}>
                <Button
                  kind={KIND.tertiary}
                  size={SIZE.mini}
                  shape={SHAPE.pill}
                  data-testid={`dna-toggle-${o.id}`}
                  onClick={() => toggleDnaLine(o.id)}
                >
                  {gone ? 'Put it back' : 'Drop'}
                </Button>
              </span>
            </div>
          );
        })}
      </div>

      <span
        data-testid="dna-method"
        style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, maxWidth: '62ch' }}
      >
        {voice.method}
      </span>
    </div>
  );
}

export default function Agent() {
  const [, theme] = useStyletron();
  const grants = useGrants();
  const company = useCompany();
  const { config, derived } = useConfig();
  const cast = derived.cast;
  const ledger = useDay(cast.sector);

  const dials = agentSettings(grants);
  /* THE REGISTER ROWS ARE THE SAME CONTRACT AND A DIFFERENT SECTION (§5 · grants.ts). The seat
     asks the contract for both lists and writes neither of them down. */
  const register = registerSettings(grants);
  const [card, setCard] = React.useState<GrantId | null>(null);
  const [walking, setWalking] = React.useState(false);
  const open = card ? settingOf(card) ?? null : null;

  /* A DOOR FROM ANOTHER SURFACE ARRIVES WITH THE ANSWER IT WANTS (`anchors.tsx`). «From your
     setup» beside a flagged order opens the gate question here, on this seat, rather than dropping
     the person on the seat and leaving them to find it. */
  const tail = useSetupTail('agent');
  React.useEffect(() => {
    if (tail === 'gate') setCard('ceiling');
    if (tail === 'capture') setWalking(true);
  }, [tail]);

  /* ── THE ORDER THE STAGE PLAYS ───────────────────────────────────────────────────────────
   * A REAL sale off the house's own river. Nothing on the stage is a number somebody typed: the
   * figure, the day, the customer and the lines are the document's own.
   *
   * WHICH real sale is the whole trick, and a screenshot taught it. The first build took the
   * BIGGEST order of the day — «a ceiling is only legible on an order big enough to reach one» —
   * and the biggest order was over three thousand soles, which is the TOP of the dial. So every
   * value of the control gave the same branch, and a demonstration whose control does nothing is
   * worse than no demonstration.
   *
   * THE ORDER HAS TO BE ONE THE DIAL CAN CROSS. So the pick is the sale whose figure sits nearest
   * the MIDDLE of the ceiling's own range — between the lowest step and the highest — which makes
   * some steps answer it and some hold it. The number is still the document's; only the choice of
   * document is ours, and it is chosen for legibility rather than for size.
   */
  const sales = React.useMemo(() => buildSales(cast, ledger), [cast, ledger, grants]);
  const staged: Sale | undefined = React.useMemo(() => {
    const today = todayId(cast);
    const low = CEILING_STEPS[0];
    const high = CEILING_STEPS[CEILING_STEPS.length - 1];
    const middle = (low + high) / 2;
    const enough = (s: Sale) => s.lines.length >= 2;
    const crossable = (s: Sale) => s.figure > low && s.figure < high;
    const rank = (pool: Sale[]) =>
      pool.slice().sort((a, b) => Math.abs(a.figure - middle) - Math.abs(b.figure - middle))[0];
    const mine = sales.filter((s) => s.day === today && enough(s));
    return rank(mine.filter(crossable))
      ?? rank(sales.filter((s) => enough(s) && crossable(s)))
      ?? rank(mine)
      ?? sales[0];
  }, [sales, cast]);

  /** who a price question goes to — the house's own routing, resolved to a name */
  const handover = memberOf(company, company.escalation.price)?.name ?? company.members[0].name;

  const stageDial = settingOf(useLastTouched(STAGE_DIAL));
  const script = staged && stageDial?.example
    ? stageDial.example({
      figure: staged.figure,
      figureWords: soles(staged.figure, 0),
      handover: handover.split(/\s+/)[0],
      day: staged.deliveryDay,
      customer: staged.customer.name,
      /* THE HOUSE'S OWN GOODS, so the ambiguity performance is about merluza in a fish house and
         about a cut in a meat one (law 10 reaches the stage). */
      goods: staged.lines[0]?.product.name,
    })
    : null;

  /* ── THE COMPANY DNA (§5.2) ───────────────────────────────────────────────────────────────
   * What the house's own year of messages says about the way it writes, and what that comes to.
   * Both are PURE READS — `knows.ts` states the facts, `insights.ts` names the register — and the
   * house's own edits are the dropped ids it carries, so the seat computes nothing of its own. */
  const knows = useKnows(cast);
  const voice = React.useMemo(
    () => houseVoice(cast, knows, grants.dnaDropped),
    [cast, knows, grants.dnaDropped],
  );
  /** every line the year taught, dropped ones included — a house puts one back from this list */
  const dnaAll = React.useMemo(() => houseStyle(knows), [knows]);

  /* THE NAME IS NOT ONE OF THESE ANY MORE (§122). It edits on its own row; what is left here is
     the two answers that are genuinely a CHOICE from a closed set — the languages it holds a
     conversation in, and whether it addresses a customer as tú or usted. */
  const [voiceCard, setVoiceCard] = React.useState<'languages' | 'address' | null>(null);
  const [routeCard, setRouteCard] = React.useState<EscalationTopic | null>(null);

  /* ═══ WHO ROCOTO ANSWERS (THE-JOURNEY-CANON §5.1–5.2 · FEED-IA §91.4.10) ══════════════════════
   *
   * «The setting lives UNDER THE AGENT SETTINGS (not Connections — that's more of a technical
   * thing): "only for certain customers", a permission-class toggle, ALWAYS REACHABLE LATER.»
   *
   * ═══ WHY IT IS A REGION AND NOT A STEP ══════════════════════════════════════════════════════
   * The month bar opens the going-live flow the first time. Until this region existed that was the
   * ONLY door, so a house that had gone live for four accounts had no surface on which to read who
   * they were, add a fifth, or take one off — «always reachable later» reachable exactly once. The
   * region is the standing answer; the card it opens is the same card the month bar opens, reached
   * through `openCohortFlow` so this seat never draws a second copy of it (§27.5).
   *
   * ═══ THE COHORT NARROWS THE WHO AND NEVER WIDENS THE WHAT (canon §5.2) ══════════════════════
   * The classes a house has set are the dials directly above, and they hold for every account on
   * this list. So the classes row POINTS at them in one flat line rather than drawing a second copy
   * of nine settings a few hundred pixels under the first.
   */
  const live = useActivation(cast);
  const [choosing, setChoosing] = React.useState(false);
  const [openAll, setOpenAll] = React.useState(false);
  /** the accounts the ledger says are live, resolved to the house's own customers */
  const liveAccounts = React.useMemo(() => {
    const by = new Map(cast.customers.map((c) => [c.id, c]));
    return live.cohort.customers.flatMap((id) => {
      const c = by.get(id);
      return c ? [c] : [];
    });
  }, [cast, live.cohort.customers]);
  /** the whole book is answered — §82.7's own end of the ladder, and the ledger's `expand` */
  const whole = live.status === 'whole';
  const number = mainNumber(company);
  /** WHAT ROCOTO DOES ALONE, read off the contract the dials above render — the same source, so
   *  the classes line and the rows it points at can never say two different things. */
  const alone = dials.filter((q) => q.rocoto(grants)).map((q) => q.row.label);

  /* ── THE APPETITE (§68 · canon §16.7) ─────────────────────────────────────────────────────
   * The rail by its own name, the entry built against it, and the offer computed off the river the
   * stage is already reading — one `buildSales`, two readers, and no second count of the morning.
   */
  const rail = derived.erp.label;
  const appetite = React.useMemo(() => appetiteSetting(rail), [rail]);
  const [appetiteCard, setAppetiteCard] = React.useState(false);
  const run = React.useMemo(() => erpRun(sales), [sales]);
  /** the notch above the one they are standing on, offered only where their own mornings have
   *  earned the sentence — rules 2, 3 and 4 in one expression */
  const offer = NEXT_NOTCH[grants.dispatch];
  const offering = offer && run.clean && run.gone >= RUN_ENOUGH ? offer : null;

  return (
    <div
      data-testid="seat-agent"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale900, minWidth: 0 }}
    >
      {/* ── THE STAGE (THE-ADMIN-CANON §6) ─────────────────────────────────────────────────── */}
      {script && stageDial && staged && (
        <Stage
          question={stageDial}
          script={script}
          sale={staged}
          cast={cast}
          handover={handover.split(/\s+/)[0]}
        />
      )}

      {/* ── THE DIALS ──────────────────────────────────────────────────────────────────────────
          AND THE LEAD IS GONE (content canon §8, AUDIT-2 C19). «Each line says who does the work —
          and which of the six checks it sets.» is a sentence describing the shape of the rows
          underneath it, which is the lead the canon deletes by name: every row already says who
          does the work, in its own sentence, and names its check on its own line. */}
      <Section
        title="Response settings"
        testid="dials"
      >
        <List testid="grant-rows">
          {dials.map((q) => (
            <GrantRow key={q.id} q={q} onOpen={() => setCard(q.id)} />
          ))}

          {/* ── THE APPETITE, LAST (§68 · canon §16.7) ─────────────────────────────────────
              It sits at the foot of the dials because it is the one about the document LEAVING,
              and everything above it is about the document being made. The offer rides INSIDE the
              row's own box — rule 1 — which is why the row is wrapped rather than drawn alone: a
              button cannot hold a button, so the fact and its one-tap change are the row's second
              storey rather than its children. No hairline between them: one row, two lines. */}
          <div data-row="grant-dispatch-seat" style={{ borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
            <GrantRow q={appetite} onOpen={() => setAppetiteCard(true)} testid="row-grant-dispatch" />
            {offering && (
              <div
                data-testid="dispatch-offer"
                data-offers={offering}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.sizing.scale500,
                  flexWrap: 'wrap',
                  /* it lines up under the row's own sentence, so it reads as that row speaking */
                  padding: `0 ${theme.sizing.scale600} ${theme.sizing.scale600}`,
                  paddingLeft: `calc(${theme.sizing.scale600} + ${TILE}px + ${theme.sizing.scale500})`,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    ...theme.typography.ParagraphXSmall,
                    color: theme.colors.contentSecondary,
                    flex: 1,
                    minWidth: '20ch',
                  }}
                >
                  {run.gone} delivery notes have gone to {rail}{' '}
                  {run.days === 1 ? 'in a single morning' : `over ${run.days} mornings`}, and every
                  one of them stood as it went.
                </span>
                <Button
                  kind={KIND.secondary}
                  size={SIZE.mini}
                  data-testid="dispatch-take-offer"
                  onClick={() => setGrants({ dispatch: offering })}
                >
                  {NOTCH_OFFER[offering]}
                </Button>
              </div>
            )}
          </div>
        </List>
      </Section>

      {/* ── WHO ROCOTO ANSWERS (THE-JOURNEY-CANON §5.1–5.2 · FEED-IA §91.4.10) ────────────────
          It stands directly under the dials because «what does it handle» now has a WHO in it, and
          it stands here at every stage — before the first account goes live, while four are, and
          after the whole book is. The month bar is the other door onto the same card. */}
      <Section
        title="Who receives responses"
        lead={whole
          ? 'Every account in your book is included.'
          : 'Only the customers you name are included.'}
        testid="live"
        actions={whole ? undefined : (
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            data-testid="live-choose"
            onClick={() => setChoosing(true)}
          >
            Choose customers
          </Button>
        )}
      >
        <List testid="live-rows">
          {/* THE MODE — the permission class, said as the state it is in. The second notch is an
              act rather than a chip, because opening the book to every account is the one press in
              this product that permits an outward message to a house's whole book (§11.5·5). */}
          <Row
            testid="live-mode"
            mark="who"
            label="Who receives responses"
            value={whole ? 'Everyone in your book' : 'The customers you name'}
            control={whole ? undefined : (
              <Button
                kind={KIND.tertiary}
                size={SIZE.mini}
                data-testid="live-open-all"
                onClick={() => setOpenAll(true)}
              >
                Open it to everyone
              </Button>
            )}
          />

          {/* THE LIST ITSELF — every account a DOOR onto its own card (§43), which is what makes
              «who is live» checkable rather than a count. It appears once there is a list: a row
              saying «0 accounts» is a row about nothing. */}
          {whole ? (
            <Row
              testid="live-who"
              mark="check"
              label="Live for"
              value={`All ${cast.customers.length} of your accounts`}
              wrapValue
            />
          ) : liveAccounts.length > 0 ? (
            <Row
              testid="live-who"
              mark="check"
              label={`Live for ${liveAccounts.length} of ${COHORT_CAP}`}
              value={(
                <span data-testid="live-accounts" style={{ display: 'inline', minWidth: 0 }}>
                  {liveAccounts.map((c, i) => (
                    <React.Fragment key={c.id}>
                      {i > 0 ? ' · ' : null}
                      <Door
                        onOpen={() => openCustomer(c.id)}
                        label={`Open ${c.name}`}
                        testid={`live-account-${c.id}`}
                      >
                        {c.name}
                      </Door>
                    </React.Fragment>
                  ))}
                </span>
              )}
              wrapValue
              onOpen={() => setChoosing(true)}
            />
          ) : null}

          {/* THE CHANNEL, BY ITS OWN NAME (canon §5.4: WHO · CHANNEL · WHAT, and the channel «is
              the one that gets forgotten»). */}
          <Row
            testid="live-channel"
            mark="chat"
            label="The channel they reach"
            value={number ? `WhatsApp Business · ${number}` : 'WhatsApp Business'}
            wrapValue
          />

          {/* WHAT IT MAY DO FOR THEM — one flat line pointing at the dials above, because the
              cohort narrows the WHO and the dials set the WHAT (canon §5.2). A second copy of nine
              settings under the first is the double-home this seat's own header rules out. */}
          <Row
            testid="live-classes"
            mark="check"
            label="Response authority"
            value={alone.length > 0
              ? `Automatic: ${alone.join(' · ')}. The rest reaches a person first.`
              : 'Every one of these reaches a person first.'}
            wrapValue
          />
        </List>
      </Section>

      {/* ── THE VOICE, AND THE REGISTER (§5.1 · §5.3 · §5.9) ───────────────────────────────────
          THE REGISTER ROWS LEAD, because «how does it write» is the biggest fact about how it
          speaks and the three under them qualify it — the name it signs, the languages it holds,
          and how it addresses a stranger.

          AND NOT ONE OF THEM WEARS THE SAFFRON MARK. `rocoto: () => false` on all three, in the
          contract, deliberately: the mark means Rocoto acts on its own, and a register is not an
          act. Read down this seat and the marks stop at the dials — which is «tone and autonomy
          are separate» said in ink rather than in a sentence. */}
      <Section title="How it speaks" testid="voice">
        <List testid="voice-rows">
          {register.map((q) => (
            <GrantRow key={q.id} q={q} onOpen={() => setCard(q.id)} />
          ))}
          {/* ── A DOOR ONTO AN EMPTY ROOM (§122) ─────────────────────────────────────────
              This row opened a card that said «It answers as Marco, in fish trade, on behalf of
              Peix Vilalta» and gave a Done button. A press, a modal, a sentence, and no way to
              change the one thing the row is named after — the worst version of the disease,
              because the app took the press and then had nothing behind it.
              The name is AUTHORED — the house chose the word its customers hear — so it edits
              where it is read, and the card is gone. */}
          <Row
            testid="agent-name"
            mark="chat"
            label="The name it answers by"
            sub="What a customer hears on the phone and reads on WhatsApp."
            token
            value={
              <LiveValue
                value={company.agent.name}
                label="The name the agent answers by"
                placeholder="Name it"
                testid="agent-name-value"
                width={200}
                onWrite={(name) => setCompany({ agent: { ...company.agent, name: name || company.agent.name } })}
              />
            }
          />
          <Row
            testid="agent-languages"
            mark="catalogue"
            label="Languages"
            sub="The languages it holds a conversation in."
            value={company.agent.languages.map((l) => LANGUAGES.find((x) => x.value === l)?.label ?? l).join(' · ')}
            wrapValue
            onOpen={() => setVoiceCard('languages')}
          />
          <Row
            testid="agent-address"
            mark="who"
            label="Tú or usted"
            sub="How it addresses a customer on their first order."
            value={company.agent.address === 'usted' ? 'Usted' : 'Tú'}
            onOpen={() => setVoiceCard('address')}
          />
        </List>
      </Section>

      {/* ── THE ROUTING ────────────────────────────────────────────────────────────────────
          Topic → a person. EVERY ONE OF THOSE PEOPLE IS A DOOR (§43): the name on this row opens
          their card in Team, and their card names the topics that reach them. Both directions, one
          fact — which is clause five of the card style, «actions connected across surfaces». */}
      <Section title="Who takes it from here" testid="routing">
        <List testid="routing-rows">
          {ESCALATION_TOPICS.map((t) => {
            const who = memberOf(company, company.escalation[t.value]);
            return (
              <Row
                key={t.value}
                testid={`route-${t.value}`}
                mark="send"
                label={t.label}
                /* NO SUB (THE-CONTENT-CANON §4, substance). One string printed on every row of a
                   list is not a helper, it is wallpaper: four rows carried the same sentence and
                   only the topic and the person ever differed. The heading says what the section
                   is, the label says the topic, the value says who — the row is complete. */
                value={
                  who ? (
                    <button
                      type="button"
                      data-testid={`route-${t.value}-who`}
                      data-door="object"
                      onClick={(e) => { e.stopPropagation(); openUser(who.id); }}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        font: 'inherit',
                        color: 'inherit',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                      }}
                    >
                      {who.name}
                    </button>
                  ) : (
                    'Pick somebody'
                  )
                }
                onOpen={() => setRouteCard(t.value)}
              />
            );
          })}
          <Row
            testid="holding-line"
            mark="ask"
            label="The line it says meanwhile"
            sub="What a customer hears while somebody is being reached."
            value={company.holdingLine}
            wrapValue
            onOpen={() => setRouteCard('price')}
          />
          {/* ── TONE IS NOT AUTONOMY (THE-CHECKPOINT §5.12) ──────────────────────────────────
              «Tone and autonomy are separate. A warm/friendly tone must not imply permissive
              operational authority.» It stands HERE, at the foot of the handoff, because the
              handoff is the moment where the two could be confused: the register decides how
              warmly Rocoto says it is reaching somebody, and the dials decide when it has to.

              ONE FLAT LINE, AND IT WEARS NO CHEVRON. There is nothing to open — it is a fact
              about the seat a person is standing on, and a chevron would promise a screen. */}
          <Row
            testid="tone-authority"
            mark="check"
            label="Tone and authority"
            value="The register sets the words. Response settings set automatic actions."
            wrapValue
          />
        </List>
      </Section>

      {/* ── THE NET (FEED-IA §32.B) ────────────────────────────────────────────────────────
          «Trust is not a vibe about 200 orders; it is trust in THE NET.» The dials above say what
          Rocoto may do; this says what is checked before it does any of it. Both read `net.ts`, so
          the two lists cannot drift. */}
      {/* ── AND THE COLUMN SAYS WHAT DIFFERS, ONCE (AUDIT-2 C19 · §51.24 · the content canon) ──
          Two walls stood here. The VALUE column printed «You set this one» on five consecutive
          rows and «Always on» on the sixth — one bit of information spread over six lines, where
          the only row a reader needed to find was the odd one. And the change check's fourteen-word
          sentence was printed VERBATIM TWICE inside two hundred pixels: once as its own row's sub,
          and again in a paragraph underneath saying «The change check runs on its own» plus the
          same sentence.

          SO THE VALUE NAMES THE DIAL. Each check that a house sets says WHICH setting sets it, in
          the dial's own row label, read out of `grants.ts` — six different values, each of them a
          fact, and each of them the name of a row a few hundred pixels above. The one check with
          no dial says «Always on», which is now the only thing on the column that is not a name,
          so it finds the eye by itself.
          AND THE PARAGRAPH IS GONE. «Runs on its own» is what «Always on» says, and the sentence
          it repeated is already on that row. */}
      <Section title={`The ${CHECK_COUNT_WORD} checks`} testid="net">
        <List testid="net-rows">
          {CHECKS.map((c) => (
            <Row
              key={c.id}
              testid={`check-${c.id}`}
              mark="check"
              label={c.name}
              sub={c.catches}
              value={(c.grant && settingOf(c.grant)?.row.label) || 'Always on'}
              wrapValue
            />
          ))}
        </List>
      </Section>

      {/* ── THE WALK ───────────────────────────────────────────────────────────────────────
          The questionnaire, one question at a time, skippable at every step and blocking nothing
          (THE-INTELLIGENCE §11, and U2: it gates the app nowhere). */}
      <Section title="Go through them one at a time" testid="walk">
        <div>
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            onClick={() => setWalking(true)}
            data-testid="open-questionnaire"
          >
            Answer them one by one
          </Button>
        </div>
      </Section>

      <CapabilityQuestionnaire isOpen={walking} onClose={() => setWalking(false)} />

      {/* THE GOING-LIVE CARD, THE JOURNEY'S OWN — mounted here so the region works on the desk and
          on a phone alike. Its folds run only while it is open. */}
      <GoLiveCard cast={cast} isOpen={choosing} onClose={() => setChoosing(false)} />

      {/* ── OPENING THE BOOK, AS AN EXPLICIT ACT (canon §5.4 · §82.7 · checkpoint §11.5·5) ─────
          «Do not enable live sending accidentally. Require an explicit activation step.» So the
          second notch of the permission class is a card with the three facts on it — WHO, WHICH
          CHANNEL, WHAT IT MAY DO — and one named act that says exactly what it arms. It writes the
          ledger's own `expand`, which is the event §82.7 already defines for the whole book. */}
      <OverlayCard
        isOpen={openAll}
        onClose={() => setOpenAll(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Activate every account"
      >
        <div
          data-testid="live-open-all-card"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
        >
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
            Activate every account
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
            {[
              { id: 'who', label: 'Who', says: `All ${cast.customers.length} accounts in your book` },
              { id: 'channel', label: 'Channel', says: number ? `WhatsApp Business · ${number}` : 'WhatsApp Business' },
              {
                id: 'what',
                label: 'What',
                says: alone.length > 0
                  ? `On its own: ${alone.join(' · ')}`
                  : 'Every message reaches a person first',
              },
            ].map((f) => (
              <div
                key={f.id}
                data-fact={f.id}
                style={{ display: 'flex', gap: theme.sizing.scale600, alignItems: 'baseline', minWidth: 0 }}
              >
                <span
                  style={{
                    ...theme.typography.LabelXSmall,
                    color: theme.colors.contentTertiary,
                    flex: '0 0 auto',
                    width: '7ch',
                  }}
                >
                  {f.label}
                </span>
                <span style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>{f.says}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              data-testid="live-open-all-arm"
              onClick={() => {
                record({ cast, kind: 'expand' });
                setOpenAll(false);
              }}
            >
              Turn it on for everyone
            </Button>
            <Button
              kind={KIND.tertiary}
              size={SIZE.compact}
              data-testid="live-open-all-close"
              onClick={() => setOpenAll(false)}
            >
              Keep the named list
            </Button>
          </div>
          {/* WHERE THIS BUILD STANDS, in the same sentence the going-live card already uses. */}
          <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            Preview only · messages go out from the customer’s chat.
          </p>
        </div>
      </OverlayCard>

      {/* ONE DIAL, RE-ANSWERED — the identical component the walk mounts */}
      <OverlayCard
        isOpen={open !== null}
        onClose={() => setCard(null)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Response settings"
      >
        {open ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <GrantQuestion q={open} />
            {/* THE FOURTH REGISTER SHOWS ITS WORKING (§5.2). It is the only chip on this card
                whose answer was READ rather than picked, so it is the only one that owes the
                house evidence — and the evidence is editable, which is what makes it an offer. */}
            {open.id === 'tone' && <CompanyDna voice={voice} all={dnaAll} dropped={grants.dnaDropped} />}
            <div>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setCard(null)} data-testid="grant-done">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <span />
        )}
      </OverlayCard>

      {/* ── THE APPETITE'S OWN CARD ────────────────────────────────────────────────────────
          THE MARGIN IS A DEPENDENT VALUE, NOT A SECOND ROW. Canon §16.7 declares it as its own
          entry «shown only under tras un margen», and the honest place for a value that exists
          only inside one notch is inside that notch's own card: the three notches are the
          question, and the middle one opens its length underneath itself. A row in the list that
          appeared and disappeared as a sibling would be the list changing height when a chip is
          pressed, which is the jump §59.1 bans.

          THE CHIPS ARE THE CONTRACT'S OWN WORDS. `q.choices`, `q.selected` and `q.choose` drive
          this card, so the card and the row can never disagree about what a notch is called. */}
      <OverlayCard
        isOpen={appetiteCard}
        onClose={() => setAppetiteCard(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel={appetite.prompt}
      >
        <div
          data-question="dispatch"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
        >
          <div>
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{appetite.prompt}</h2>
            <p
              style={{
                margin: `${theme.sizing.scale300} 0 0`,
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentSecondary,
              }}
            >
              {appetite.aside}
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300, minWidth: 0 }}>
            {appetite.choices.map((c) => {
              const on = appetite.selected(grants).includes(c.value);
              return (
                <span key={c.value} data-chip={c.value} data-selected={on ? 'yes' : 'no'}>
                  <Button
                    kind={on ? KIND.primary : KIND.secondary}
                    shape={SHAPE.pill}
                    size={SIZE.compact}
                    data-testid={`grant-dispatch-${c.value}`}
                    onClick={() => setGrants(appetite.choose(grants, c.value))}
                  >
                    {c.label}
                  </Button>
                </span>
              );
            })}
          </div>

          <p
            data-testid="grant-hint-dispatch"
            style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}
          >
            {appetite.choices.find((c) => c.value === grants.dispatch)?.hint}
          </p>

          {/* THE MARGIN — one length, chosen, the same for every document. «The confidence-derived
              window of §16.3 is dead»: the moment its length varied by our reading of an order it
              stopped being their setting and became our mechanism again. */}
          {grants.dispatch === 'after-a-margin' && (
            <div
              data-testid="dispatch-margin"
              style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}
            >
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
                The margin
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300, minWidth: 0 }}>
                {MARGIN_STEPS.map((m) => (
                  <span key={m} data-chip={String(m)} data-selected={grants.dispatchWait === m ? 'yes' : 'no'}>
                    <Button
                      kind={grants.dispatchWait === m ? KIND.primary : KIND.secondary}
                      shape={SHAPE.pill}
                      size={SIZE.compact}
                      data-testid={`grant-margin-${m}`}
                      onClick={() => setGrants({ dispatchWait: m })}
                    >
                      {marginWords(m)}
                    </Button>
                  </span>
                ))}
              </div>
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                An edit starts the margin again, so the corrected one travels.
              </p>
            </div>
          )}

          <div>
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              onClick={() => setAppetiteCard(false)}
              data-testid="dispatch-done"
            >
              Done
            </Button>
          </div>
        </div>
      </OverlayCard>

      {/* THE VOICE'S OWN CARDS */}
      <OverlayCard
        isOpen={voiceCard !== null}
        onClose={() => setVoiceCard(null)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="How it speaks"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
            {voiceCard === 'languages' ? 'Languages' : 'Tú or usted'}
          </h2>
          {voiceCard === 'languages' && (
            <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
              {LANGUAGES.map((l) => {
                const on = company.agent.languages.includes(l.value);
                return (
                  <span key={l.value} data-selected={on ? 'yes' : 'no'}>
                    <Button
                      kind={on ? KIND.primary : KIND.secondary}
                      shape={SHAPE.pill}
                      size={SIZE.compact}
                      data-testid={`language-${l.value}`}
                      onClick={() => {
                        const next = on
                          ? company.agent.languages.filter((x) => x !== l.value)
                          : [...company.agent.languages, l.value as Language];
                        /* a house speaks at least one language, so the last one on stays on */
                        setCompany({ agent: { ...company.agent, languages: next.length ? next : company.agent.languages } });
                      }}
                    >
                      {l.label}
                    </Button>
                  </span>
                );
              })}
            </div>
          )}
          {voiceCard === 'address' && (
            <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
              {(['usted', 'tu'] as Address[]).map((a) => (
                <span key={a} data-selected={company.agent.address === a ? 'yes' : 'no'}>
                  <Button
                    kind={company.agent.address === a ? KIND.primary : KIND.secondary}
                    shape={SHAPE.pill}
                    size={SIZE.compact}
                    data-testid={`address-${a}`}
                    onClick={() => setCompany({ agent: { ...company.agent, address: a } })}
                  >
                    {a === 'usted' ? 'Usted' : 'Tú'}
                  </Button>
                </span>
              ))}
            </div>
          )}
          <div>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setVoiceCard(null)} data-testid="voice-done">
              Done
            </Button>
          </div>
        </div>
      </OverlayCard>

      {/* WHO TAKES A TOPIC — the roster, as a choice */}
      <OverlayCard
        isOpen={routeCard !== null}
        onClose={() => setRouteCard(null)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Who takes it from here"
      >
        {routeCard ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
              {ESCALATION_TOPICS.find((t) => t.value === routeCard)?.label}
            </h2>
            <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
              {company.members.map((m) => (
                <span key={m.id} data-selected={company.escalation[routeCard] === m.id ? 'yes' : 'no'}>
                  <Button
                    kind={company.escalation[routeCard] === m.id ? KIND.primary : KIND.secondary}
                    shape={SHAPE.pill}
                    size={SIZE.compact}
                    data-testid={`route-to-${m.id}`}
                    onClick={() => setCompany({ escalation: { ...company.escalation, [routeCard]: m.id } })}
                  >
                    {m.name}
                  </Button>
                </span>
              ))}
            </div>
            <div>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setRouteCard(null)} data-testid="route-done">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <span />
        )}
      </OverlayCard>
    </div>
  );
}
