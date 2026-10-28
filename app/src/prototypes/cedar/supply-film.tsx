/* THE SUPPLY-ISSUE FILM — a supplier phones, and four beats later one customer has been told.
 *
 * FEED-IA §132.7, Peter's own beats: «reporting the supply issue… it's a feature similar to the
 * Artichoke one, with a waveform at the bottom and a transcript saying "Supplier just called me to
 * say that strawberries are delayed." The AI then morphs into a question asking, "How long are they
 * going to be delayed?" … two options: this afternoon or tomorrow. It could also show a custom
 * field where they write 2:00 p.m. today… It then morphs into showing the customer that the order
 * is affected… a button saying "Message customer" and then a message bubble popping up, chromeless,
 * saying, "Sorry, we've got an issue. Is it okay if we deliver it tomorrow? Or do you want me to
 * take it off your order altogether?" It shows the WhatsApp-style buttons for answering that, with
 * a little bent arrow reply icon on each of the buttons. It shows it like a little film of what's
 * going on when there are issues.»
 *
 * ═══ THE FOUR BEATS, AND THE ONE BOX THEY PLAY IN ═══════════════════════════════════════════
 *   1 REPORT    the transcript fills, the waveform runs under it, the round control at the foot
 *   2 QUESTION  the one question, two offered answers, and their own words if neither fits
 *   3 ORDER     the customer this lands on, with the concern ON THE ORDER'S LINE (§128.2)
 *   4 MESSAGE   the chromeless bubble the customer will get, wearing its two answer buttons
 * They MORPH IN PLACE. One box, one beat on screen at a time, each arriving on §102's own timing
 * pair (`timing400` · `easeOutCurve`) — no spinner, no second modal opened over the first, and no
 * step a person has to scroll back to. `prefers-reduced-motion` lands each beat as a still.
 *
 * ═══ WHAT IS STAGED, AND WHAT IS READ (say which, or the film is a lie) ══════════════════════
 * THE VOICE IS THEATRE. Beat 1 is a staged capture in §113's grammar — a kit with no microphone
 * cannot record a supplier's phone call, so the take is simulated from a seed (the same field, the
 * same words, every run) and the sentence is Peter's, with the goods slotted from the issue this
 * film was entered on. It says the name of goods the house is REALLY short of.
 * EVERYTHING UNDER IT IS READ. Beat 3's customer, day, quantities and gap are `affectedOf`'s own
 * rows — the sale ledger folded against the arrivals ledger, day-scoped, and claimed only about a
 * floor somebody has spoken for (`issueOf`'s guard). Beat 3 shows the first row the shortage
 * actually REACHES: FIFO serves the earliest requests whole, so the person who is short is the
 * first row with something owed, and the film opens on them rather than on whoever is at the top.
 *
 * ═══ THE FILM COMPOSES; THE SEND OBEYS THE REVIEW GRAMMAR (§76 · §101.3) ════════════════════
 * The one act sits low and large, it names the person it will write to, and what it will put on
 * the wire is READ ABOVE IT in full — that is §76's «strong review state», which is being able to
 * read what is about to happen rather than being asked whether you are sure. It writes through
 * `sendToThread`, the chat store's own shipped writer, into ONE conversation. And §101.3's
 * follow-through — the answer to «so when will it be available?» — is an OFFER: it is off until
 * somebody presses it, and the words on the wire prove it.
 *
 * ═══ AND IT IS THE BROADCAST'S ENTRY ════════════════════════════════════════════════════════
 * One customer is where the film ends; the rest of the book is what §101.2's broadcast is for. So
 * the landing hands the other conversations to `SupplyBroadcast` with the one already told named,
 * so nobody gets the same shortage twice.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Microphone } from '../../rocoto/voice-button-kit';
import { Waveform, createSimulatedAmplitude } from '../../rocoto/waveform';
import { Message } from '../../rocoto/message';
import Name from '../../scenarios/shell/Name';
import type { Cast } from '../../scenarios/data/cast';
import { productOf } from '../../scenarios/data/cast';
import { nowOf } from './day';
import { Glyph, STEP } from './glyphs';
import type { SupplyIssue } from './incoming';
import { dayLabelFromId } from './sale';
import { replyHour, sendToThread, useThreads } from './shell/threads';
import type { Affected } from './supply-broadcast';

const LOCALE = 'es-ES';

/** A QUANTITY, SHARING ITS NUMBER'S LINE WITH ITS UNIT — the price-unit law, which is a law about
 *  every figure a person reads at a glance and not only about money. A maximum and no minimum, so
 *  «6 kg» stays whole and «2,5 kg» keeps its half.
 *
 *  IT LIVES HERE AND `supply-broadcast.tsx` READS IT FROM HERE, one implementation, one direction
 *  of import — the film may not import the broadcast at runtime or the two files would form a
 *  cycle, and two copies of a formatting law is how two surfaces start printing one figure two
 *  ways. */
export const units = (n: number, unit: string): string =>
  `${n.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} ${unit}`;

/* ── THE BEATS ────────────────────────────────────────────────────────────────────────────── */

export const BEAT = {
  report: 'report',
  question: 'question',
  order: 'order',
  message: 'message',
} as const;

export type Beat = (typeof BEAT)[keyof typeof BEAT];

/** THE ANSWER TO THE ONE QUESTION. Two offered, and their own words where neither fits (§132.7).
 *  `word` is what the control says; `said` is the fragment that goes into a sentence, which is why
 *  they are two fields — «Tomorrow» on a button and «tomorrow» mid-sentence are the same answer
 *  wearing the two capitalisations English actually uses. */
export type Delay = { id: string; word: string; said: string };

export const DELAYS: Delay[] = [
  { id: 'afternoon', word: 'This afternoon', said: 'this afternoon' },
  { id: 'tomorrow', word: 'Tomorrow', said: 'tomorrow' },
];

/** PETER'S SENTENCE, VERBATIM, with one slot (§132.7). The moment is the person's own answer from
 *  beat 2 — «tomorrow» where they said tomorrow, «this afternoon» where they said that, and their
 *  own words where they wrote them — because a message that asks about tomorrow after the supplier
 *  said this afternoon is the app contradicting the person who just told it. */
export const apologyFor = (moment: string): string =>
  `Sorry, we've got an issue. Is it okay if we deliver it ${moment}? `
  + 'Or do you want me to take it off your order altogether?';

/** THE TWO ANSWERS THE CUSTOMER IS OFFERED, taken out of the two questions the message asks. */
export const answersFor = (moment: string): string[] => [`Deliver it ${moment}`, 'Take it off'];

/** §101.3's FOLLOW-THROUGH, answered off what the person just said rather than guessed off a rule:
 *  they have been told when it lands, so Rocoto can say when it lands. */
export const landsLine = (goods: string, moment: string): string => `${goods} lands ${moment}.`;

/** WHY THEY MIGHT DROP IT (§127.2). Dismissing asks «Is there any reason why?» and the reasons are
 *  offered in the trade's own words — the human's why is learning material, not a form field. */
const REASONS = ['They can wait', "I'll call them myself"];

/* ── THE TWO MARKS THIS FILM NEEDS AND THE VOCABULARY DOES NOT CARRY ──────────────────────────
 * Drawn here, the way `waveform/icons.tsx` and `stock-announcement/glyphs.tsx` draw theirs: on
 * Lucide's own 24 grid, at the vocabulary's own weight, in `currentColor`, so whatever they ride
 * owns the ink and a re-theme reaches them without touching this file.
 */

/** THE BENT ARROW ON EVERY ANSWER BUTTON (§132.7, his words). It is WhatsApp's reply mark — an
 *  arrow turning back on itself — and it says who the button belongs to: the customer, answering. */
export function ReplyMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m9 14-5-5 5-5" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

/** THE RETURN MARK — «literally Anthropic Claude as it is» (§116.2): the ↵ glyph in the field's
 *  own right edge, so Enter is a thing you can see as well as a key you can press. */
function ReturnMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 5v6a3 3 0 0 1-3 3H5" />
      <path d="m9 10-4 4 4 4" />
    </svg>
  );
}

/* ── THE TAKE ─────────────────────────────────────────────────────────────────────────────────
 * A word every other poll, which at the field's own 60ms cadence is roughly the pace of somebody
 * talking. It is a count, not a timer per word, so a slow frame delays the sentence rather than
 * dropping half of it.
 */
const WORD_MS = 200;

/** THE METER IS NARROWER THAN THE WORDS. A recorder is a hand-held instrument, and a bar field run
 *  out to a reading column's full width is a hairline with the voice bunched in one corner of it —
 *  at this width the take fills most of the field in the time the sentence takes to say. */
const METER = 'min(320px, 100%)';

export function SupplyFilm({
  cast,
  issue,
  rows,
  onTellTheRest,
  onClose,
}: {
  cast: Cast;
  issue: SupplyIssue;
  /** `affectedOf`'s own rows, folded by the door that opened this — read, never re-derived here */
  rows: Affected[];
  /** the other conversations on these goods, and the one this film already told */
  onTellTheRest: (told: string[]) => void;
  onClose: () => void;
}) {
  const [css, theme] = useStyletron();
  const threads = useThreads(cast);
  const product = productOf(cast, issue.product);

  const [beat, setBeat] = React.useState<Beat>(BEAT.report);
  /* the take: nothing said yet · running · said. The waveform and the words both read it. */
  const [take, setTake] = React.useState<'idle' | 'live' | 'said'>('idle');
  const [landed, setLanded] = React.useState(0);
  const [answer, setAnswer] = React.useState<Delay | null>(null);
  const [own, setOwn] = React.useState('');
  /* §101.3 IS OFF UNTIL SOMEBODY PRESSES IT. This one boolean is the whole of «never auto-sent». */
  const [reflex, setReflex] = React.useState(false);
  const [dismiss, setDismiss] = React.useState<'no' | 'asking'>('no');
  const [sent, setSent] = React.useState<{ at: string; to: string } | null>(null);

  /* WHAT WAS SAID. Peter's sentence with the goods slotted — the goods this film was entered on,
     so a transcript about rape opens a film about rape. */
  const said = `Supplier just called me to say that the ${product.name} is delayed.`;
  const words = React.useMemo(() => said.split(' '), [said]);

  /* THE FIELD, DETERMINISTIC. Seeded on the goods, so the same shortage draws the same take on
     every run and a screenshot taken today is the picture taken tomorrow. */
  const amplitude = React.useMemo(() => createSimulatedAmplitude(issue.product), [issue.product]);

  React.useEffect(() => {
    if (take !== 'live') return;
    const id = window.setInterval(() => {
      setLanded((n) => {
        if (n >= words.length) return n;
        return n + 1;
      });
    }, WORD_MS);
    return () => window.clearInterval(id);
  }, [take, words.length]);

  /* THE ROW THE SHORTAGE ACTUALLY REACHES. First asked is first served, so the earliest orders are
     whole and the gap lands on whoever comes after them: the affected customer is the first row
     with something owed. Where the fold owes nobody the film opens on the leading row, which is
     the row the broadcast leads with too. */
  const hit = React.useMemo(() => rows.find((r) => r.owed > 0) ?? rows[0], [rows]);
  const rest = Math.max(0, rows.length - 1);

  const moment = answer ? answer.said : '';
  const lands = landsLine(product.name, moment);
  const wire = reflex ? `${apologyFor(moment)} ${lands}` : apologyFor(moment);

  /* ── THE SEND ────────────────────────────────────────────────────────────────────────────
     One conversation, through the chat store's own writer, at an hour that makes it the newest
     thing anybody has said. There is no other write in this file.

     THE HOUR IS DECIDED ONCE, BEFORE THE PREVIEW IS DRAWN. The first build stamped the preview
     with the house's clock and then sent at `replyHour`'s — a bubble that read 09:45 landing in
     the thread at 17:25, which is the review showing something other than what it is about to do.
     One hour, read at the top of the beat, printed on the preview and put on the wire. */
  const [at] = React.useState(() => replyHour(threads, nowOf(cast)));

  const send = (): void => {
    if (!hit) return;
    sendToThread(cast.sector, hit.customer.id, wire, at);
    setSent({ at, to: hit.customer.name });
  };

  /* ── THE MORPH (§102) ────────────────────────────────────────────────────────────────────
     One box, and the beat inside it arrives on the canon's own opening pair. Reduced motion lands
     it as a still — the beat is the information, the rise is only how it got there. */
  const morph = css({
    animationName: {
      from: { opacity: 0, transform: 'translateY(6px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    animationDuration: theme.animation.timing400,
    animationTimingFunction: theme.animation.easeOutCurve,
    animationFillMode: 'both',
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0ms' },
  });

  /* ── THE COLUMN THE FILM PLAYS IN (§119.5: «why full width?» — fit-to-content is the law) ──
     The first shot of this took the whole 1600px pane: a hairline of waveform stretched a metre
     wide, an order line with «19 kg for them» flung to the far right of the room, and a free-text
     field the width of a desk for the words «2:00 p.m. today». A scene has a frame. So the beats
     stand in ONE centred column at a reading width, and the card around them keeps the row's own
     width — which is also why the same film needs nothing done to it at 390. */
  const stage: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.sizing.scale600,
    width: 'min(520px, 100%)',
    marginLeft: 'auto',
    marginRight: 'auto',
    minWidth: 0,
  };

  /* what the words landed on, said back — a CAPTURED fact, in §113's grammar, and never an offer */
  const echo = (
    <span
      data-testid="film-said"
      style={{
        ...theme.typography.ParagraphXSmall,
        color: theme.colors.contentTertiary,
        minWidth: 0,
      }}
    >
      &laquo;{said}&raquo;
    </span>
  );

  return (
    <div
      data-testid="supply-film"
      data-beat={beat}
      data-product={issue.product}
      /* THE FOLD'S OWN NUMBERS, ON THE FILM ITSELF — how many conversations this shortage reaches
         and how many are left after the one this film writes to. A drive reads them here rather
         than counting rows, and they are the same numbers the broadcast counts. */
      data-affected={rows.length}
      data-rest={rest}
      data-sent={sent ? 'yes' : 'no'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale500,
        padding: theme.sizing.scale600,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        /* IT PAINTS ITS OWN GROUND, like every other card in the app — a film with no floor under
           it reads as loose text on whatever row it happens to be standing in. */
        background: theme.colors.backgroundPrimary,
        /* THE BOX DOES NOT COLLAPSE BETWEEN BEATS. A stage that shrinks to the shortest beat and
           grows again for the longest is a jump, not a morph. */
        minHeight: theme.sizing.scale3200,
        minWidth: 0,
      }}
    >
      {/* ══ BEAT 1 · THE REPORT (§132.7 · §113's capture beat) ═══════════════════════════════
          «A waveform at the bottom and a transcript saying "Supplier just called me…"» — so the
          transcript leads (it is the thing being made), the field runs under it, and the round
          control sits at the foot where the thumb is. While the take runs that same control IS
          the submit: one control in one place changing meaning, rather than a second button
          appearing somewhere new mid-gesture.

          ┌──────────────────────────────────────────────┐
          │  Supplier just called me to say that the     │
          │  Rape is delayed.▌                           │
          │                                              │
          │  ▁▂▅█▆▃▁▂▅█▇▄▂▁▃▅▇█▆▃▁                       │
          │                   ( ● )                      │
          └──────────────────────────────────────────────┘ */}
      {beat === BEAT.report && (
        <div key="report" className={morph} style={stage} data-testid="film-report">
          <p
            data-testid="film-transcript"
            data-words={landed}
            style={{
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              ...theme.typography.ParagraphLarge,
              color: take === 'idle' ? theme.colors.contentTertiary : theme.colors.contentPrimary,
              /* THE WORDS ARRIVE INTO A BOX THAT IS ALREADY THERE (§77.2's spirit): a transcript
                 that grows line by line drags the field and the button down the screen under a
                 hand that is holding one of them. The reservation is the whole sentence at PHONE
                 width — three lines — because that is where it is tallest and where the button it
                 would push is under a thumb. */
              minHeight: theme.sizing.scale2400,
              minWidth: 0,
            }}
          >
            {take === 'idle' ? 'Say what the supplier told you' : words.slice(0, landed).join(' ')}
            {take === 'live' && landed < words.length && (
              <span
                aria-hidden="true"
                className={css({
                  animationName: { '0%,45%': { opacity: 1 }, '50%,100%': { opacity: 0 } },
                  animationDuration: theme.animation.timing1000,
                  animationIterationCount: 'infinite',
                  '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
                })}
                style={{
                  display: 'inline-block',
                  width: theme.sizing.scale0,
                  height: theme.sizing.scale650,
                  marginLeft: theme.sizing.scale100,
                  verticalAlign: 'text-bottom',
                  background: theme.colors.contentPrimary,
                }}
              />
            )}
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: theme.sizing.scale500,
              minWidth: 0,
            }}
          >
            <span data-testid="film-wave" style={{ width: METER, minWidth: 0 }}>
              <Waveform
                mode="live"
                amplitude={amplitude}
                paused={take !== 'live'}
                label={take === 'live' ? 'Recording' : 'The take'}
              />
            </span>
            <Button
              kind={take === 'live' ? KIND.primary : KIND.secondary}
              shape={SHAPE.circle}
              size={SIZE.large}
              overrides={{
                BaseButton: {
                  props: {
                    'data-testid': 'film-mic',
                    'data-take': take,
                    'aria-label': take === 'live' ? 'Send what you said' : 'Say what happened',
                  },
                },
              }}
              onClick={() => {
                if (take === 'live') {
                  /* the sentence lands whole before the beat turns — a half-written transcript
                     morphing into a question is the app reading your mind badly */
                  setLanded(words.length);
                  setTake('said');
                  setBeat(BEAT.question);
                  return;
                }
                setTake('live');
              }}
            >
              {take === 'live' ? <Glyph id="send" size={STEP.medium} /> : <Microphone size={20} />}
            </Button>
          </div>
        </div>
      )}

      {/* ══ BEAT 2 · THE ONE QUESTION (§132.7 · §119.1's typeform discipline) ════════════════
          «The AI then morphs into a question asking, "How long are they going to be delayed?"…
          two options: this afternoon or tomorrow. It could also show a custom field where they
          write 2:00 p.m. today.» ONE question on screen, drawn in type, with its answers under
          it — and their own words are an answer, not a fallback.

          ┌──────────────────────────────────────────────┐
          │  «Supplier just called me to say…»           │
          │  How long are they going to be delayed?      │
          │  [ This afternoon ]  [ Tomorrow ]            │
          │  ┌────────────────────────────────────┐      │
          │  │ 2:00 p.m. today                [↵] │      │
          │  └────────────────────────────────────┘      │
          └──────────────────────────────────────────────┘ */}
      {beat === BEAT.question && (
        <div key="question" className={morph} style={stage} data-testid="film-question">
          {echo}
          <h3
            data-testid="film-ask"
            style={{ margin: 0, ...theme.typography.HeadingXSmall, minWidth: 0 }}
          >
            How long are they going to be delayed?
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300, minWidth: 0 }}>
            {DELAYS.map((d) => (
              <Button
                key={d.id}
                kind={KIND.secondary}
                size={SIZE.compact}
                shape={SHAPE.pill}
                overrides={{ BaseButton: { props: { 'data-testid': `film-delay-${d.id}` } } }}
                onClick={() => {
                  setAnswer(d);
                  setBeat(BEAT.order);
                }}
              >
                {d.word}
              </Button>
            ))}
          </div>
          {/* THEIR OWN WORDS. The placeholder is the answer Peter wrote, so the field says what
              kind of thing it takes by showing one (§116.4). ENTER ACTS. */}
          <Input
            value={own}
            placeholder="2:00 p.m. today"
            size="compact"
            onChange={(e) => setOwn((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !own.trim()) return;
              setAnswer({ id: 'own', word: own.trim(), said: own.trim() });
              setBeat(BEAT.order);
            }}
            endEnhancer={
              <button
                type="button"
                data-testid="film-delay-own"
                aria-label="Use what you wrote"
                disabled={!own.trim()}
                onClick={() => {
                  if (!own.trim()) return;
                  setAnswer({ id: 'own', word: own.trim(), said: own.trim() });
                  setBeat(BEAT.order);
                }}
                style={{
                  display: 'inline-grid',
                  placeItems: 'center',
                  width: theme.sizing.scale800,
                  height: theme.sizing.scale800,
                  padding: 0,
                  border: 'none',
                  borderRadius: theme.borders.radius200,
                  background: 'transparent',
                  color: own.trim() ? theme.colors.contentPrimary : theme.colors.contentTertiary,
                  cursor: own.trim() ? 'pointer' : 'default',
                }}
              >
                <ReturnMark />
              </button>
            }
            overrides={{ Input: { props: { 'data-testid': 'film-own-field' } } }}
          />
        </div>
      )}

      {/* ══ BEAT 3 · THE AFFECTED ORDER (§132.7 · §127 · §128.2) ═════════════════════════════
          «It then morphs into showing the customer that the order is affected and asks, "Do you
          want?" It shows a button saying "Message customer".»

          AND THE CONCERN RIDES THE ORDER'S OWN LINE (§128.2): an edit-concern attaches to its
          PRODUCT LINE, on the albarán itself — never a banner over the order, never a modal. Under
          it, one quiet line of §63's method: WHY we think there is an issue, so a stranger can
          check the claim. The two acts are §120's two, and DISMISS IS A LITTLE THING (§128.1) —
          in place, without interrupting anything, and it asks the why on the way out (§127.2).

          ┌──────────────────────────────────────────────┐
          │  Rape lands this afternoon.                  │
          │  Can Solé · {dayLabelFromId(hit.day)}        │
          │  ┌────────────────────────────────────────┐  │
          │  │ Rape · asked 12 kg      7 kg for them  │  │
          │  │ 5 kg of theirs lands this afternoon    │  │
          │  └────────────────────────────────────────┘  │
          │  What the house counted for these goods…     │
          │  [ Message customer ]           [ Dismiss ]  │
          └──────────────────────────────────────────────┘ */}
      {beat === BEAT.order && hit && (
        <div key="order" className={morph} style={stage} data-testid="film-order">
          <span
            data-testid="film-lands"
            style={{ ...theme.typography.LabelMedium, minWidth: 0 }}
          >
            {lands}
          </span>
          <div
            data-testid="film-affected"
            data-customer={hit.customer.id}
            data-day={hit.day}
            data-asked={hit.asked}
            data-served={hit.served}
            data-owed={hit.owed}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale200,
              padding: theme.sizing.scale500,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius200,
              minWidth: 0,
            }}
          >
            <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>
              <Name of={hit.customer} />
              {' · '}
              <span style={{ color: theme.colors.contentSecondary }}>{dayLabelFromId(hit.day)}</span>
            </span>
            {/* THE ORDER'S LINE — the goods, what they asked, what the floor can do for them.
                The two figures sit on one row with the second hard right, the way a line on the
                albarán states its own numbers. */}
            <span
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: theme.sizing.scale400,
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentSecondary,
                minWidth: 0,
              }}
            >
              {/* THE MIDDOT IS THE HOUSE'S OWN SEPARATOR — the broadcast row, the day bar and the
                  albarán all join two facts with it, and a gap alone reads as a typo. */}
              <span style={{ whiteSpace: 'nowrap' }}>
                <Name of={product} /> · asked {units(hit.asked, hit.unit)}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ whiteSpace: 'nowrap' }}>{units(hit.served, hit.unit)} for them</span>
            </span>
            {/* THE CONCERN, INLINE ON THE LINE IT IS ABOUT (§128.2). The accent is Rocoto's own
                act and nothing else on this card wears it: the house did not flag this, the fold
                found it. */}
            {hit.owed > 0 && (
              <span
                data-testid="film-concern"
                style={{
                  ...theme.typography.LabelXSmall,
                  color: theme.colors.accent,
                  minWidth: 0,
                }}
              >
                {units(hit.owed, hit.unit)} of theirs lands {moment}
              </span>
            )}
          </div>
          {/* §63's METHOD LINE — how the fold knows, under the thing it is claiming. */}
          <span
            data-testid="film-method"
            style={{
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentTertiary,
              minWidth: 0,
            }}
          >
            {issue.method}
          </span>
          {rest > 0 && (
            <span
              data-testid="film-rest"
              style={{
                ...theme.typography.ParagraphXSmall,
                color: theme.colors.contentTertiary,
                minWidth: 0,
              }}
            >
              {rest} more {rest === 1 ? 'conversation is' : 'conversations are'} on these goods
            </span>
          )}
          {dismiss === 'asking' ? (
            /* §127.2 · DISMISSAL IS LEARNING. It asks the why, in the trade's own words, and the
               answer is what Rocoto keeps. Offered, never imposed: picking one closes the film. */
            <div
              data-testid="film-why"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.sizing.scale300,
                minWidth: 0,
              }}
            >
              <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>
                Is there any reason why?
              </span>
              {REASONS.map((r) => (
                <Button
                  key={r}
                  kind={KIND.secondary}
                  size={SIZE.mini}
                  shape={SHAPE.pill}
                  overrides={{ BaseButton: { props: { 'data-testid': 'film-reason' } } }}
                  onClick={onClose}
                >
                  {r}
                </Button>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.sizing.scale400,
                flexWrap: 'wrap',
                minWidth: 0,
              }}
            >
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                startEnhancer={<Glyph id="chat" size={STEP.small} />}
                overrides={{ BaseButton: { props: { 'data-testid': 'film-message' } } }}
                onClick={() => setBeat(BEAT.message)}
              >
                Message customer
              </Button>
              <span style={{ flex: 1 }} />
              <Button
                kind={KIND.tertiary}
                size={SIZE.compact}
                overrides={{ BaseButton: { props: { 'data-testid': 'film-dismiss' } } }}
                onClick={() => setDismiss('asking')}
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ══ BEAT 4 · THE MESSAGE (§132.7 · §76's review · §101.3's offer) ════════════════════
          «A message bubble popping up, chromeless, saying "Sorry, we've got an issue…" It shows
          the WhatsApp-style buttons for answering that, with a little bent arrow reply icon on
          each of the buttons.»

          CHROMELESS means the bubble and nothing around it — no thread head, no composer, no
          wallpaper. What is on screen is exactly what the person on the other end will see: the
          words, and the two things they can press. Reading them IS the review (§76): the act
          underneath names who it writes to, and it writes to that one conversation.

          ┌──────────────────────────────────────────────┐
          │                    ┌──────────────────────┐  │
          │                    │ Sorry, we've got an  │  │
          │                    │ issue. Is it okay…   │  │
          │                    └──────────────────────┘  │
          │                    ┌──────────────────────┐  │
          │                    │  ↩ Deliver it tomor… │  │
          │                    ├──────────────────────┤  │
          │                    │  ↩ Take it off       │  │
          │                    └──────────────────────┘  │
          │  [ When it lands ]                           │
          │  ┌────────────────────────────────────────┐  │
          │  │            Send to Can Solé            │  │
          │  └────────────────────────────────────────┘  │
          └──────────────────────────────────────────────┘ */}
      {beat === BEAT.message && hit && (
        <div key="message" className={morph} style={stage} data-testid="film-message-beat">
          <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>
            <Name of={hit.customer} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* NO DELIVERY MARK UNTIL SOMETHING HAS BEEN DELIVERED. A preview wearing the
                «sending» clock claims a journey that has not started. */}
            <Message author="sent" time={at} status={sent ? 'sent' : undefined}>
              <span data-testid="film-bubble">{wire}</span>
            </Message>
            {/* THE ANSWER BUTTONS ARE A PICTURE, NOT A CONTROL. They belong to the person on the
                other end, so they are drawn and not wired — and they carry no accent, because the
                accent in this app marks Rocoto's own acts and these are the customer's. */}
            <div
              data-testid="film-answers"
              role="img"
              aria-label={`What they can answer: ${answersFor(moment).join(', ')}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.sizing.scale200,
                width: '78%',
                marginLeft: 'auto',
                marginRight: theme.sizing.scale300,
                marginTop: theme.sizing.scale200,
                minWidth: 0,
              }}
            >
              {answersFor(moment).map((a) => (
                <span
                  key={a}
                  data-testid="film-answer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: theme.sizing.scale300,
                    padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`,
                    border: `1px solid ${theme.colors.borderOpaque}`,
                    borderRadius: theme.borders.radius300,
                    background: theme.colors.backgroundPrimary,
                    ...theme.typography.LabelSmall,
                    color: theme.colors.contentPrimary,
                    minWidth: 0,
                  }}
                >
                  <ReplyMark />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {a}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* §101.3, AS AN OFFER. The person has already been told when it lands; whether Rocoto
              SAYS so on the wire is still theirs to press. */}
          <span style={{ display: 'flex', minWidth: 0 }}>
            <Button
              /* IT IS SECONDARY WHEN IT IS OFF, not tertiary. On the broadcast this control sits
                 at the end of a row and reads as an affordance from its company; here it stands
                 alone under a message, and a borderless label alone on a card reads as a caption
                 nobody presses. Same offer, drawn so it can be seen to be one. */
              kind={reflex ? KIND.primary : KIND.secondary}
              size={SIZE.mini}
              shape={SHAPE.pill}
              disabled={Boolean(sent)}
              overrides={{
                BaseButton: {
                  props: {
                    'data-testid': 'film-reflex',
                    'data-taken': reflex ? 'yes' : 'no',
                  },
                },
              }}
              onClick={() => setReflex((held) => !held)}
            >
              When it lands
            </Button>
          </span>

          {/* THE ONE ACT, LOW AND LARGE (§76's thumb rule) — and the feedback lands in its place,
              so what a person looks at after pressing is where they pressed. */}
          {sent ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: theme.sizing.scale400,
                minWidth: 0,
              }}
            >
              <span
                data-testid="film-sent"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.sizing.scale300,
                  ...theme.typography.LabelSmall,
                  color: theme.colors.accent,
                  minWidth: 0,
                }}
              >
                <Glyph id="check" size={STEP.small} />
                Sent to {sent.to} at {sent.at}
              </span>
              <span style={{ flex: 1 }} />
              {/* THE FILM IS THE BROADCAST'S ENTRY (§101.2). The rest of the book is one act away,
                  and the one already told is named so nobody hears it twice. */}
              {rest > 0 && (
                <Button
                  kind={KIND.secondary}
                  size={SIZE.compact}
                  overrides={{ BaseButton: { props: { 'data-testid': 'film-tell-rest' } } }}
                  onClick={() => onTellTheRest([hit.customer.id])}
                >
                  Tell the other {rest}
                </Button>
              )}
              <Button
                kind={KIND.tertiary}
                size={SIZE.compact}
                overrides={{ BaseButton: { props: { 'data-testid': 'film-done' } } }}
                onClick={onClose}
              >
                Continue
              </Button>
            </div>
          ) : (
            <Button
              kind={KIND.primary}
              size={SIZE.large}
              startEnhancer={<Glyph id="send" size={STEP.small} />}
              overrides={{
                BaseButton: { props: { 'data-testid': 'film-send' }, style: { width: '100%' } },
              }}
              onClick={send}
            >
              Send to {hit.customer.name}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
