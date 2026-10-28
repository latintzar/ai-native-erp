/* THE ANXIETY — Rocoto's worry about an order possibly being wrong, as a thing you can answer.
 *
 * ═══ WHAT PETER FIGURED OUT, VERBATIM (FEED-IA §127, «I think we figured out something brilliant»)
 * «If there's something that clearly needs attention, they click on it, and it shows the delivery
 * note. It then shows that there is an issue with one of the things… Maybe, for marketing's sake,
 * we show the message, then the reasoning for why we think there's an issue, and then the full
 * order, where we show them the delivery note below. After dismissing the issue, it asks, "Is
 * there any reason why?" and says, "They have a big weekend," or "It's a national holiday coming
 * up," or something like that. Put that in there. It's the things about the anxiety the AI has
 * about the order being possibly wrong: something we can dismiss, or we take action. When we take
 * action, naturally, we think about it and then maybe drop the issue… It could also let you dive
 * in and explore the underlying info behind that… If the message is "I held off on replying,"
 * maybe show it with a red outline.»
 *
 * ═══ SO THE OBJECT IS AN ANXIETY, AND IT HAS EXACTLY THREE PARTS AND EXACTLY THREE ANSWERS ══
 *
 *   ┌─ THE ANXIETY ──────────────────────────────────────────────────────────────────────────┐
 *   │  I held off on replying                                              [ × ]             │
 *   │                                                                                        │
 *   │  The message      «Y ponme rape»                              ← what arrived           │
 *   │  Why this stands  ● Quick one on the Rape — how much do you want?                      │
 *   │                   [ Why I think so ⌄ ]  → every reason, the line, what was read         │
 *   │  The order        Rape          amount owed        0,00 €                              │
 *   │                   Merluza       12 kg            177,84 €                              │
 *   │                   Albarán 2208-110 · Friday 22.08          ← the albarán, below         │
 *   │                                                                                        │
 *   │  [ Reply to the customer ]   [ Dismiss ]                                               │
 *   └────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * THE ORDER OF THE THREE IS HIS, LITERALLY: message → reasoning → full order with the albarán
 * below. It is not a layout preference; it is the argument the card makes, in the order a person
 * has to hear it to judge it.
 *
 * THE TWO ACTIONS ARE §120'S TWO, and the card adds no third: EDIT the albarán, or REPLY to the
 * customer. `tick.tsx` owns which one, off `sale.ts`'s own `jobOf`, so the card and the organ that
 * opened it can never name different work.
 *
 * ═══ AND DISMISSING IS A CONVERSATION, NOT A DELETE (§127.2) ════════════════════════════════
 * «Is there any reason why?» — asked, with the trade's own words offered and a field that takes
 * anything. What they say is kept (`dismissals.ts`), because the human's why is the learning
 * material this whole product is built to collect (§110's co-present loop, with a capture beat on
 * the dismiss act itself).
 *
 * ═══ THE DIVE IS THE HOUSE'S OWN MACHINERY, NOT A SECOND ONE (§127.1 · §106) ════════════════
 * «It could also let you dive in and explore the underlying info behind that.» Every sentence in
 * the reasoning block is `sale.ts`'s own: `topReason` picks the one that leads, `exceptionReasons`
 * holds the rest, `flagsOf` holds the facts under them, and the dive walks exactly those — the
 * rule, then the house's own record read through it. Nothing here writes a reason.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { Figure } from './figure';
import { OverlayCard } from '../../rocoto/overlay-card';
import { useConfig } from './config';
import { anxietyOf, dismiss, dismissedNow, useAnxieties, useDismissals } from './dismissals';
import { Method, ReasoningDoor } from './reasoning-door';
import {
  exceptionReasons, flagsOf, policyOf, qtyWords, topReason,
  type Sale,
} from './sale';
import { OWED_RELEASE, OWED_WORD, isRed, type Owed } from './tick';
/* §196.3 · the one red-flag vocabulary. The concern note IS «an alert or message for a flagged
   order», so it wears the red identifier wherever it stands — inside the line's tab, above a
   source block, or in the composer's tray. */
import { FLAG_EDGE, FLAG_WORD, FlagWord, flagInk, flagOutline } from './red-flag';

/* ── THE HEAD, AND IT IS ROCOTO TALKING (§127.1, his line, verbatim) ──────────────────────────
 * «If the message is "I held off on replying"…» — so that IS the message, in Rocoto's own voice,
 * at full size. It is true of both actions: on an EDIT the confirmation was withheld too, which is
 * §120.4's whole point («in all cases… it would basically restrain itself from replying»).
 */
const HELD_WORD = 'I held off on replying';

/** WHAT THE CARD IS FOR, said once under the head: the release, which is the thing a person
 *  actually wants to know — how this ends. `tick.tsx` owns both sentences. */
const releaseOf = (owed: Owed): string => OWED_RELEASE[owed];

/* ── ONE BLOCK OF THE ARGUMENT ────────────────────────────────────────────────────────────── */

function Part({ label, children, testid }: { label: string; children: React.ReactNode; testid: string }) {
  const [, theme] = useStyletron();
  return (
    <div data-testid={testid} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
      {/* THE HEADING NAMES THE THING (the content canon): a noun, blatant, no observation. */}
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{label}</span>
      {children}
    </div>
  );
}

/* ── PART TWO · THE REASONING, AND IT OPENS (§127.1's dive) ────────────────────────────────── */

/**
 * WHY THIS STANDS — the leading sentence, graphically, and every fact under it one press away.
 *
 * THE GRAPHICAL FORM IS THE APP'S OWN and it is deliberately not a chart: the reason wears the
 * accent dot that means «Rocoto did this» everywhere in this app, at the weight a person reads
 * first, and the DIVE under it is the derivation — each remaining reason on its own line with the
 * line it is about and the amount that provoked it. That is «the underlying info behind that»,
 * read off the document rather than composed here.
 */
function Reasoning({ sale, testid = 'anxiety-reasoning' }: { sale: Sale; testid?: string }) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  /* ── THE ANXIETY AGES, IT NEVER EVAPORATES (§127.3's second tense) ──────────────────────────
   * `policyOf` recomputes from the document's CURRENT state, so a hold that has since been acted
   * on answers `act` and its reasoning DISAPPEARS. The record kept at the moment of restraint is
   * what the aged door reads: «on live work the anxiety asks for an act; on history it only
   * explains» — same object, two tenses. The live reading leads where there is one; the record
   * answers where there is not, so the door never opens onto nothing. */
  useAnxieties();
  const born = anxietyOf(sale.id);
  const live = topReason(sale);
  const lead = live ?? (born ? { text: born.withheld } : null);
  const aged = !live && Boolean(born);
  const rest = exceptionReasons(sale).filter((r) => r.text !== lead?.text);
  const flags = flagsOf(sale);
  const withheld = policyOf(sale).withheld ?? born?.withheld;

  return (
    <div data-testid={testid} data-open={open ? 'yes' : 'no'} data-aged={aged ? 'yes' : 'no'} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      <span
        data-testid={`${testid}-lead`}
        style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary, minWidth: 0 }}
      >
        {/* ⚠ THE LEAD MARK IS INK (FEED-IA §127.3 · THE-CHECKPOINT-AUDIT finding 1). It was a 6px
            accent disc — the SAME artwork at the SAME size as `attention-dot`'s claim — sitting in
            front of Rocoto's own worry. §127.3 rules that out in one clause: red «NEVER marks
            Rocoto's own uncertainty (that is the anxiety card, in the product's neutral)». Two
            identical dots meaning two different things is how one believable claim becomes a
            decoration, so this one keeps its seat and gives up its colour. */}
        <span
          aria-hidden="true"
          style={{ flex: '0 0 auto', width: 6, height: 6, borderRadius: '50%', background: theme.colors.contentTertiary, transform: 'translateY(-2px)' }}
        />
        {lead ? lead.text : 'Rocoto is reading this one.'}
      </span>

      {/* THE DOOR (§127.1 · §106's derivation grammar). Offered, never imposed; it opens the
          underlying info and it blocks nothing. It is absent where there is nothing under it —
          a control that opens an empty drawer is furniture. */}
      {(rest.length > 0 || flags.length > 0 || withheld) && (
        <span style={{ alignSelf: 'flex-start' }}>
          {/* THE DOOR IS THE HOUSE'S OWN (`reasoning-door.tsx`, §127.3's chip / §106's grammar):
              never filled, never a captured fact, never blocking — Rocoto offering its own past
              reasoning for inspection. Its tense follows the record: it ASKS on live work and
              EXPLAINS on history, which is the same object read at two moments. */}
          <ReasoningDoor
            testid={`${testid}-door`}
            label={aged ? 'Why I did that' : 'Why I think so'}
            onOpen={() => setOpen((was) => !was)}
          >
            {aged ? 'Why I did that' : 'Why I think so'}
          </ReasoningDoor>
        </span>
      )}

      {open && (
        <div
          data-testid={`${testid}-dive`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale200,
            paddingLeft: theme.sizing.scale500,
            borderLeft: `2px solid ${theme.colors.mono300}`,
            ...theme.typography.ParagraphXSmall,
            color: theme.colors.contentSecondary,
            minWidth: 0,
          }}
        >
          {/* THE RULE THE DECISION WAS MADE BY, stated where a stranger can hold the record to it
              (§106's own method line, in the shared organ's type). */}
          <Method testid={`${testid}-rule`}>
            {aged
              ? `Rocoto held its reply and asked for the ${born?.owed === 'reply' ? 'reply' : 'edit'}, at ${born?.at}.`
              : 'Rocoto holds its reply whenever the delivery note is short of a fact only you can give.'}
          </Method>
          {/* THE READING ROCOTO PREPARED AND DID NOT SEND (§9.11) — the one fact the abstention is
              actually about, and the only place in this app a person can see it. */}
          {withheld && <span data-testid={`${testid}-withheld`}>{withheld}</span>}
          {/* EVERY OTHER REASON, on its own line and named by the axis it speaks on (§72.3). */}
          {rest.map((r) => (
            <span key={r.text} data-testid={`${testid}-also`} data-axis={r.axis}>{r.text}</span>
          ))}
          {/* AND THE FACTS THE REASONS WERE READ OFF — the line, and the number that provoked it. */}
          {flags.map((f) => (
            <span key={f.id} data-testid={`${testid}-fact`} data-flag={f.kind}>
              {f.line.product.name}
              {f.times !== undefined
                ? ` · ${f.times}× what they usually take`
                : f.line.unreadable
                  ? ' · they named the goods only'
                  : ` · ${qtyWords(f.line.given, f.line.unit)}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── PART THREE · THE ORDER, WITH THE ALBARÁN BELOW (§127.1) ──────────────────────────────── */

function OrderPart({ sale, testid = 'anxiety-order' }: { sale: Sale; testid?: string }) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  return (
    <div data-testid={testid} data-lines={sale.lines.length} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      {sale.lines.map((l) => (
        <span
          key={l.id}
          data-testid={`${testid}-line`}
          style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, ...theme.typography.ParagraphSmall, minWidth: 0 }}
        >
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {l.product.name}
          </span>
          <span style={{ flex: '0 0 auto', color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
            {l.unreadable ? 'amount owed' : qtyWords(l.given, l.unit)}
          </span>
          {derived.albaran.valued && (
            <span style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
              <Figure value={l.given * l.price} unit="S/" decimals={2} size="compact" locale="en-PE" />
            </span>
          )}
        </span>
      ))}
      {/* «AND THEN THE FULL ORDER, WHERE WE SHOW THEM THE DELIVERY NOTE BELOW» — the albarán, named
          and dated, under its own lines. A document with no number yet says the day and stops,
          because a number it does not have is not a fact to print. */}
      <span
        data-testid={`${testid}-albaran`}
        style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, paddingTop: theme.sizing.scale300 }}
      >
        {sale.number && sale.number !== 'TEST' ? `Delivery Note ${sale.number} · ${sale.deliveryDay}` : `For ${sale.deliveryDay}`}
      </span>
    </div>
  );
}

/* ── THE DISMISSAL'S OWN QUESTION (§127.2, his sentence verbatim) ─────────────────────────── */

const WHY_ASK = 'Is there any reason why?';

function WhyAsk({
  onSave,
  onBack,
  testid = 'anxiety-why',
}: {
  onSave: (why: string, offered: boolean) => void;
  onBack: () => void;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  const [typed, setTyped] = React.useState('');
  return (
    <div data-testid={testid} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelMedium }}>{WHY_ASK}</span>
      {/* THE TRADE'S OWN WORDS, OFFERED (§83.2). One press answers and closes — the offered line IS
          the answer, so making somebody press it and then press Save would be asking twice. */}
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>

      </div>
      <Input
        size={INPUT_SIZE.compact}
        value={typed}
        onChange={(e) => setTyped(e.currentTarget.value)}
        placeholder="Your reason (optional)"
        aria-label={WHY_ASK}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && typed.trim()) onSave(typed.trim(), false);
        }}
        overrides={{ Input: { props: { 'data-testid': `${testid}-field` } } }}
      />
      <div style={{ display: 'flex', gap: theme.sizing.scale300, minWidth: 0 }}>
        <Button
          kind={KIND.primary}
          size={SIZE.compact}
          shape={SHAPE.pill}
          data-testid={`${testid}-save`}
          onClick={() => onSave(typed.trim(), false)}
        >
          Dismiss it
        </Button>
        <Button kind={KIND.tertiary} size={SIZE.compact} shape={SHAPE.pill} data-testid={`${testid}-back`} onClick={onBack}>
          Back to the issue
        </Button>
      </div>
    </div>
  );
}

/* ══ THE CARD ═══════════════════════════════════════════════════════════════════════════════ */

export function AnxietyCard({
  sale,
  owed,
  message,
  isOpen,
  onClose,
  onAct,
  now,
}: {
  sale: Sale;
  /** which of the two actions this anxiety asks for — `tick.tsx`'s one fold, handed in */
  owed: Owed;
  /** THE MESSAGE — what arrived, in the customer's own words. Absent where the document was
   *  written at the desk, which is the honest shape: nothing arrived, so nothing is quoted. */
  message?: string;
  isOpen: boolean;
  onClose: () => void;
  /** the person took the action — the housing knows where that leads (the sheet, or the composer) */
  onAct: (owed: Owed) => void;
  /** the day's own clock, for the hour a dismissal is stamped with */
  now: string;
}) {
  const [, theme] = useStyletron();
  const [asking, setAsking] = React.useState(false);
  const red = isRed(owed);

  /* a card that opens is a card that opens on the ISSUE, never mid-question */
  React.useEffect(() => {
    if (isOpen) setAsking(false);
  }, [isOpen, sale.id]);

  const answer = (why: string, offered: boolean) => {
    const p = policyOf(sale);
    dismiss({ sale: sale.id, concern: 'anxiety', policy: p.id, withheld: p.withheld ?? p.says, why, offered, at: now });
    onClose();
  };

  return (
    <OverlayCard isOpen={isOpen} onClose={onClose} size={520} ariaLabel={HELD_WORD} overrides={{ Root: { style: { zIndex: 12 } } }}>
      <div
        data-testid="anxiety-card"
        data-sale={sale.id}
        data-owed={owed}
        /* THE ONE RED CLAIM, ON THE CARD ITSELF (§127.3). «Dude, I need you to reply» — a human
           being is waiting on this person, and that is the only sentence red says in this product.
           An EDIT is Rocoto's own uncertainty and wears the ordinary hairline. */
        data-red={red ? 'yes' : 'no'}
        data-asking={asking ? 'yes' : 'no'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale600,
          borderRadius: theme.borders.radius400,
          /* §196.3: the SAME outline recipe the river's row, the customer's card and the albarán's
             line draw. It was typed here first (§127.3) and it is read from the one file now, so a
             brand change or a width change moves every flagged thing in the product at once. */
          outline: red ? flagOutline(theme) : 'none',
          outlineOffset: theme.sizing.scale300,
          minWidth: 0,
        }}
      >
        {/* ── THE HEAD IS THE MESSAGE, IN ROCOTO'S OWN VOICE (his line, verbatim) ───────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h2 data-testid="anxiety-head" style={{ margin: 0, ...theme.typography.HeadingXSmall, color: red ? flagInk(theme) : theme.colors.contentPrimary }}>
            {HELD_WORD}
          </h2>
          <span data-testid="anxiety-release" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {releaseOf(owed)}
          </span>
        </div>

        {asking ? (
          <WhyAsk onSave={answer} onBack={() => setAsking(false)} />
        ) : (
          <>
            {/* ── HIS ORDER, LITERALLY: message → reasoning → the full order ───────────────── */}
            {message && (
              <Part label="The message" testid="anxiety-message">
                <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary }}>{message}</span>
              </Part>
            )}
            <Part label="Why this stands" testid="anxiety-why-block">
              <Reasoning sale={sale} />
            </Part>
            <Part label="The order" testid="anxiety-order-block">
              <OrderPart sale={sale} />
            </Part>

            {/* ── TWO ANSWERS: TAKE THE ACTION, OR DISMISS IT (§127.1) ─────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                shape={SHAPE.pill}
                data-testid="anxiety-act"
                data-act={owed}
                onClick={() => onAct(owed)}
              >
                {OWED_WORD[owed]}
              </Button>
              <Button
                kind={KIND.tertiary}
                size={SIZE.compact}
                shape={SHAPE.pill}
                data-testid="anxiety-dismiss"
                onClick={() => setAsking(true)}
              >
                Dismiss
              </Button>
            </div>
          </>
        )}
      </div>
    </OverlayCard>
  );
}

/* ══ WHERE THE CONCERN LIVES — THE PLACEMENT LAW (FEED-IA §128) ══════════════════════════════
 *
 * Peter, verbatim: «They can dismiss the understanding of why you did that thing. They can always
 * dismiss it as a little thing, not to interrupt their process. The fact that they can dismiss our
 * concern is a very, really, really nice thing. // The way that the concern shows up is that it
 * will either be a concern for a specific product item or multiple, where groups are going to get
 * a comment from them. It will be saying, "I need you to reply to this customer," and that will
 * appear below the Albaranes. It will be on the communications bit… Make sure this is exactly how
 * it is.»
 *
 *   AN EDIT-CONCERN   attaches to its PRODUCT LINE — one line, or a GROUP of lines carrying one
 *                     comment together — on the albarán itself.
 *   A REPLY-CONCERN   «I need you to reply to this customer», BELOW the albaranes, in comms.
 *
 * ═══ AND DISMISS IS A LITTLE THING (§128.1) ═════════════════════════════════════════════════
 * «They can ALWAYS dismiss it as a little thing, NOT TO INTERRUPT THEIR PROCESS.» So the dismissal
 * happens WHERE THE CONCERN STANDS: the note swaps in place for the question, the offered words
 * and a field, and swaps back. No modal, no confirm, no step that has to be finished — a person
 * halfway through dismissing may simply keep working, and the concern is exactly as it was.
 *
 * IT IS THE SAME WHY THE CARD ASKS, WRITTEN TO THE SAME RECORD. One question, one store, one
 * exit: whichever surface a person answers on, the tick settles and the claim clears everywhere,
 * because they all read `waitingOnAPerson` and it reads the dismissals (§127.2's second exit).
 */

/** THE CONCERN, AND ITS LITTLE DISMISSAL — one note, in place, wherever a concern belongs. */
export function ConcernNote({
  sale,
  says,
  testid,
  mark = 'Double-check',
  concern = 'anxiety',
  now,
  tab = false,
}: {
  sale: Sale;
  /** the concern in the app's own words, with source links where the context offers them */
  says: React.ReactNode;
  testid: string;
  mark?: string;
  concern?: string;
  now: string;
  /** §192.4: drawn as the flagged card's own TAB — the sentence at the left, Dismiss pinned at
   *  the RIGHT edge; the host strip carries the tint and the top radius. */
  tab?: boolean;
}) {
  const [, theme] = useStyletron();
  useDismissals();
  const [asking, setAsking] = React.useState(false);
  const [typed, setTyped] = React.useState('');
  const answer = (why: string, offered: boolean) => {
    const p = policyOf(sale);
    dismiss({ sale: sale.id, concern, policy: p.id, withheld: typeof says === 'string' ? says : p.withheld ?? p.says, why, offered: false, at: now });
    setAsking(false);
  };
  if (dismissedNow(sale.id, concern)) return null;
  /* WHICH FLAG THIS NOTE IS ABOUT — its own `mark`, which until §196.3 was a prop nobody drew.
     A note that could name itself and did not is exactly the «alert with no red identifier» the
     directive is about, so the name is now said, in the red, at the head of the note. */
  const kind = mark === FLAG_WORD.check ? 'check' : 'response';
  return (
    <div
      data-testid={testid}
      data-concern={asking ? 'asking' : 'standing'}
      data-concern-id={concern}
      data-concern-mark={kind}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200,
        padding: tab ? `${theme.sizing.scale300} ${theme.sizing.scale400}` : theme.sizing.scale300, minWidth: 0,
        /* ── THE NOTE STANDING ALONE CARRIES ITS OWN BOUNDARY (FEED-IA §196.3) ──────────────
           Inside a line's tab the red is already around it (§192.4's outline wraps note and row
           as one flagged object), so a second edge there would be two boundaries for one fact.
           Everywhere else — above a source block, in the composer's reply tray, over the grouped
           lines — the note stood in plain grey with a Dismiss beside it, which is an alert about
           a flagged order wearing no identifier at all. It takes the rule and the wash. */
        ...(tab ? {} : {
          borderLeft: `${FLAG_EDGE} solid ${flagInk(theme)}`,
          background: `color-mix(in srgb, ${theme.colors.accent} 4%, transparent)`,
          borderTopRightRadius: theme.borders.radius200,
          borderBottomRightRadius: theme.borders.radius200,
        }) }}
    >
      {asking ? (
        /* THE QUESTION, IN PLACE — the note's own seat, never a layer over the document. */
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{WHY_ASK}</span>

          {/* ── AND IT TAKES THEIR OWN WORDS, AND IT IS IGNORABLE (FEED-IA §134.1) ────────────
              «The dismissal's "Is there any reason why?" takes TYPED FREE TEXT and is IGNORABLE —
              no forced answer.» So the field is here beside the offered lines, Enter answers with
              whatever is in it, and «No reason» is a real answer rather than a way out: a person
              who has nothing to say has said something, and the record keeps that honestly. */}
          <span style={{ flex: '1 1 160px', minWidth: 120 }}>
            <Input
              size={INPUT_SIZE.mini}
              value={typed}
              onChange={(e) => setTyped(e.currentTarget.value)}
              placeholder="Your reason (optional)"
              aria-label={WHY_ASK}
              onKeyDown={(e) => {
                if (e.key === 'Enter') answer(typed.trim(), false);
              }}
              overrides={{ Input: { props: { 'data-testid': `${testid}-why-field` } } }}
            />
          </span>
          <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.pill} data-testid={`${testid}-why-none`} onClick={() => answer(typed.trim(), false)}>
            {typed.trim() ? 'Save reason & dismiss' : 'Dismiss'}
          </Button>
          <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.pill} data-testid={`${testid}-why-back`} onClick={() => setAsking(false)}>
            Leave it
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: tab ? 'nowrap' : 'wrap', minWidth: 0 }}>
          {/* ── THE FLAG NAMES ITSELF, IN THE RED (FEED-IA §196.3) ──────────────────────────
              `mark` has been a prop since §128 and no branch ever rendered it — «Double-check»,
              «Rocoto held its reply» — so every concern note in the product was a grey sentence
              a reader had to classify for themselves. It leads the note now, in the vocabulary's
              own word + line-mark, and it is what makes the note READ as a flag at a glance. */}
          <FlagWord kind={kind} word={mark} testid={`${testid}-mark`} />
          {/* on the tab the SENTENCE gives ground (wraps inside its own box) so Dismiss keeps the
              right edge of the same line at every width — §192.4's «always at the right» */}
          <span
            data-testid={`${testid}-says`}
            style={{ display: 'inline-flex', alignItems: 'center', ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0,
              /* the SENTENCE is what gives ground at every width — it wraps inside its own box so
                 the mark keeps the left and Dismiss keeps the right on the same line (§192.4) */
              flex: '1 1 auto', flexWrap: 'wrap' }}
          >
            {says}
          </span>
          {/* «THEY CAN ALWAYS DISMISS IT AS A LITTLE THING» (§128.1) — a mini tertiary, at the
              weight a thing that interrupts nothing deserves. §192.4 pins it to the RIGHT edge of
              the tab: «the dismiss button should always be at the right». */}
          {/* ── AND «ALWAYS AT THE RIGHT» IS NOW EVERY NOTE'S LAW, NOT ONLY THE TAB'S ──────
              §192.4 pinned Dismiss to the right edge of the line's tab; §195 holds every one of
              these «extra fields and editability» to one anatomy — «shopify/stripe checkout level
              of consistent». A note whose Dismiss is right on the albarán's line and left in the
              composer's tray is the same control in two places. It is right in both. */}
          <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.pill} data-testid={`${testid}-dismiss`} onClick={() => setAsking(true)}
            overrides={{ BaseButton: { style: { marginLeft: 'auto' } } }}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * EVERY EDIT-CONCERN ON THIS DOCUMENT, BY THE LINE IT IS ABOUT (§128.2).
 *
 * `flagsOf` already answers which line each worry is about, so this is a grouping rather than a
 * second opinion — and a flag the whole ORDER carries (the house's own ceiling) is exactly the
 * «group of lines wearing one comment together» he names: it is returned under the group key.
 */
export const GROUP_CONCERN = '__group__';

export function editConcernsOf(sale: Sale): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of flagsOf(sale)) {
    const key = f.kind === 'big' ? GROUP_CONCERN : f.line.id;
    const says =
      f.kind === 'unreadable'
        ? `${f.line.product.name} came as a name only — say how much and it goes.`
        : f.kind === 'unusual'
          ? `${f.line.product.name} is ${f.times}× what they usually take.`
          : f.kind === 'big'
            ? 'This order is above the automatic-send limit.'
            : `${f.line.product.name} needs review.`;
    out[key] = [...(out[key] ?? []), says];
  }
  return out;
}

/** THE REPLY-CONCERN'S OWN SENTENCE, and it is HIS, verbatim (§128.2). */
export const REPLY_CONCERN = 'I need you to reply to this customer';
