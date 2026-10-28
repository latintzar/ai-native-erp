/* THE HOVER CARD — THE ESSENTIALS, BEFORE THE DOOR (FEED-IA §137.2).
 *
 * Peter, 2026-08-30, verbatim: «if they wanna see more info about the customer, like i'd say there
 * should be a hover version that has essentials, and then if they click on go to profile it goes
 * there. feels like top apps do it like this no?»
 *
 * ═══ WHAT A HOVER CARD IS FOR, AND WHAT IT IS NOT ═══════════════════════════════════════════
 * It answers the question a person asks WITHOUT LEAVING THE PAGE THEY ARE ON: who are these
 * people, what is their number, what do they buy on, when do they order, how much have they taken
 * this month, and is anybody waiting on me about them. Six facts and a door. It is not a small
 * profile: the profile is one press away and it is named on the card («Go to profile»), which is
 * exactly the grammar the top apps use and the reason a hover card never has to grow.
 *
 * ═══ IT MINTS NOTHING (§0 — one record, one arithmetic) ═════════════════════════════════════
 * Every fact on it is read off a fold that already decides that fact somewhere else, and the folds
 * are named at the line that reads them:
 *
 *   THE NUMBER      `accountNumber` — the customer sheet's own reader, so the card and the sheet
 *                   print the same number for the same account, on every reload.
 *   THE TARIFA      `bandOf` + `tarifaName` — the band the next albarán will actually price on.
 *                   Absent where the house has one band, exactly as `TheirTarifa` is absent.
 *   THEIR DAYS      `dayPatternOf` (§42.1) — the weekdays that RECUR, or the cadence where none
 *                   does. The same sentence the Customers sheet's head leads with.
 *   THIS MONTH      `monthOf` — the record behind them blended with today's feed, which is the
 *                   figure the book prints beside their name and the profile prints on its own
 *                   «This month» row.
 *   ANYTHING OWED   `waitingOnAPerson` (§127.3) — the ONE fold that may raise the red claim, and
 *                   the card prints ITS OWN SENTENCE rather than a sentence about it. A card that
 *                   invented its own «they are waiting» condition would be the second place red
 *                   means something, which is how one believable claim becomes a decoration.
 *
 * ═══ NEVER ON GLASS (§137.2's last clause) ══════════════════════════════════════════════════
 * «Tap-and-hold territory on phone is the door directly (no hover on glass).» A touch device has
 * no hover: a tap that opened a card would eat the press that was meant to open the customer, and
 * the person would have to tap twice to do the thing one tap already did. So on a phone — and on
 * any pointer that cannot hover — this component renders its children and nothing else. It is a
 * DESK affordance, and the name stays the door everywhere.
 *
 * ═══ THE MECHANICS, AND THE TRAP THIS FILE WAS WRITTEN AROUND ═══════════════════════════════
 * Base CLONES the anchor child and overwrites the handlers it needs on the clone (`chip-entry.tsx`
 * carries the scar: an `onClick` written on the child never ran). So every handler this card needs
 * is passed to the POPOVER and never to the child — `onMouseEnter` / `onMouseLeave` with Base's own
 * delays. With `triggerType: hover` Base attaches no `onClick` at all, which is what leaves the
 * name underneath still pressable: hovering shows the essentials, pressing opens the customer, and
 * neither gesture is spent on the other.
 *
 * THE DELAY IS 350ms IN AND SHORT OUT. A card that appears on the first pixel of travel fires on
 * every name a pointer crosses on its way somewhere else; a card that lingers is a card in the way.
 * The out-delay is what lets the pointer travel from the name ONTO the card without it closing
 * underneath — Base keeps it open while the body itself is hovered.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Popover, PLACEMENT, TRIGGER_TYPE } from 'baseui/popover';
import { Figure } from './figure';
import type { Customer } from '../../scenarios/data/cast';
import { openCustomer } from './anchors';
import { AttentionDot, waitingOnAPerson } from './attention-dot';
/* §196.3 · the red-flag vocabulary — the card's owed block is an alert about a flagged order, so
   it is bounded in the red rather than divided from the rest by a grey hairline. */
import { FLAG_EDGE, flagInk } from './red-flag';
import { useConfig } from './config';
import { accountNumber } from './customer-profile';
import { useDay } from './day';
import { useGrants } from './grants';
import { dayPatternOf, monthKeyOf, monthOf } from './knows';
import { Atom } from './rows';
import { buildSales, todayId } from './sale';
import { PHONE } from './shell';
import { bandOf, tarifaName, tiersOfHouse, useTiers } from './tiers';

/** How long a pointer has to REST on a name before the card is what it wanted. */
const REST_MS = 350;
/** …and how long it may leave before the card goes, so the travel onto the card survives it. */
const LEAVE_MS = 140;

/* ── IS HOVERING A GESTURE HERE AT ALL ────────────────────────────────────────────────────────
 * TWO QUESTIONS, ASKED AT RENDER TIME AND SUBSCRIBED TO BY NOBODY. This component is mounted on
 * every customer name in the house, which on the river and in the book is three hundred of them at
 * once — and `usePhone` is a `matchMedia` LISTENER, so asking it here would put three hundred
 * subscriptions on one page for an answer that changes on a resize the frame is already
 * re-rendering the whole tree for. The `MediaQueryList` objects are made once and read; a render
 * is the only moment the answer is needed and every render already has the current one.
 *
 *   CAN THE POINTER HOVER   `(hover: hover) and (pointer: fine)` — «can this input rest on
 *                           something without pressing it». False on every touch screen, which is
 *                           the whole of §137.2's «no hover on glass».
 *   IS THIS THE PHONE       the shell's own `PHONE` query, so a narrow window on a desk answers
 *                           the same way the handset does. §137.2: «tap-and-hold territory on
 *                           phone is the door directly».
 */
let HOVER_MQ: MediaQueryList | null = null;
let PHONE_MQ: MediaQueryList | null = null;
const asks = (held: MediaQueryList | null, query: string): [MediaQueryList | null, boolean] => {
  if (typeof window === 'undefined' || !window.matchMedia) return [null, false];
  const mq = held ?? window.matchMedia(query);
  return [mq, mq.matches];
};
export function hoverIsAGesture(): boolean {
  const [hover, canHover] = asks(HOVER_MQ, '(hover: hover) and (pointer: fine)');
  HOVER_MQ = hover;
  const [glass, onGlass] = asks(PHONE_MQ, PHONE);
  PHONE_MQ = glass;
  return canHover && !onGlass;
}

/* ── ONE LINE OF THE CARD ─────────────────────────────────────────────────────────────────────
 * A label and its fact, on one row, the fact ending at the card's right edge. The label is the
 * smallest step and the fact is read at reading size — the sheet's own ramp, two steps of it.
 */
function Line({ label, children, testid }: { label: string; children: React.ReactNode; testid: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        alignItems: 'baseline',
        gap: theme.sizing.scale500,
        minWidth: 0,
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ ...theme.typography.LabelSmall, textAlign: 'right', minWidth: 0 }}>{children}</span>
    </div>
  );
}

/* ── THE ESSENTIALS ───────────────────────────────────────────────────────────────────────────
 * A COMPONENT OF ITS OWN, and that is load-bearing rather than tidy: Base calls `content` only
 * while the card is open, so nothing below is read — and no fold is walked — for the three hundred
 * names a river paints. The card costs exactly nothing until somebody rests on a name.
 */
export function CustomerEssentials({ customer }: { customer: Customer }) {
  const [, theme] = useStyletron();
  /* THE HOUSE IS READ HERE AND NOT PASSED IN, because `content` is called only while the card is
     open: one context read per open card, and none at all for the three hundred names a river
     paints. The wrapper takes no props it would only be forwarding. */
  const { derived } = useConfig();
  const cast = derived.cast;
  const edits = useDay(cast.sector);
  const grants = useGrants();
  /* the store subscription, so a band changed on the sheet behind this card is the band it says */
  useTiers();

  /* THEIR MORNING, off the fold every other surface reads. `buildSales` holds its own last answer,
     so opening a card is a filter over a list that is already folded (§0). */
  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants]);
  const theirs = React.useMemo(
    () => sales.filter((s) => s.customer.id === customer.id),
    [sales, customer.id],
  );

  const month = React.useMemo(
    () => monthOf(cast, customer, monthKeyOf(todayId(cast)), theirs.map((s) => ({ day: s.day, figure: s.figure }))),
    [cast, customer, theirs],
  );
  const pattern = React.useMemo(
    () => dayPatternOf(cast, customer, theirs.map((s) => ({ day: s.day }))),
    [cast, customer, theirs],
  );

  /* THE HOUSE'S BANDS, and the word only where there is more than one of them — progressive
     disclosure by data, the same clause `TheirTarifa` keeps. */
  const bands = tiersOfHouse(cast);
  const band = bandOf(cast, customer);

  /* ── ANYTHING OWED (§127.3) ───────────────────────────────────────────────────────────────
     The FIRST document of theirs that is standing on a person, and the sentence is that fold's
     own. Nothing here decides what «waiting» means; it asks the one function that does. */
  const owed = React.useMemo(() => {
    for (const sale of theirs) {
      const waiting = waitingOnAPerson(sale);
      if (waiting) return waiting;
    }
    return null;
  }, [theirs]);

  return (
    <div
      data-testid="hovercard"
      data-customer={customer.id}
      data-owed={owed ? 'yes' : 'no'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale300,
        padding: theme.sizing.scale600,
        width: 288,
        minWidth: 0,
      }}
    >
      {/* WHO THEY ARE, AND HOW TO RING THEM — identity, so the two stand together, and the number
          is an `Atom`: one fact, never broken across two lines (§132.2). */}
      <span data-testid="hovercard-name" style={{ ...theme.typography.LabelLarge, minWidth: 0 }}>
        {customer.name}
      </span>
      <span
        data-testid="hovercard-number"
        style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
      >
        <Atom>{accountNumber(customer)}</Atom>
      </span>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale300,
          paddingTop: theme.sizing.scale400,
          borderTop: `1px solid ${theme.colors.borderOpaque}`,
          minWidth: 0,
        }}
      >
        {bands.length >= 2 && (
          <Line label="Tarifa" testid="hovercard-tarifa">{tarifaName(band)}</Line>
        )}
        {/* §42.1's OWN PATTERN: the weekdays that recur, or the cadence where none does. */}
        <Line label="Order days" testid="hovercard-days">
          {pattern.days.length > 0 ? pattern.days.join(' · ') : pattern.cadence}
        </Line>
        <Line label="This month" testid="hovercard-month">
          <Figure value={month.figure} unit="S/" size="compact" />
        </Line>
      </div>

      {/* ── WHAT IS STANDING ON A PERSON, IF ANYTHING (§127.3) ─────────────────────────────
          The dot makes the claim and the sentence says it, and both come out of the same fold as
          the row in the river does — so a name whose card says somebody is waiting is a name whose
          row is already carrying the dot. Where nothing stands, nothing is drawn: a card that said
          «nothing owed» would be spending a line on the absence of news. */}
      {owed && (
        <span
          data-testid="hovercard-owed"
          data-kind={owed.kind}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: theme.sizing.scale300,
            marginTop: theme.sizing.scale400,
            padding: `${theme.sizing.scale300} ${theme.sizing.scale300}`,
            /* ── THE ALERT IS BOUNDED IN THE RED (FEED-IA §196.3) ──────────────────────────
                A grey hairline over a grey sentence is a divider, not an identifier: the card
                said «somebody is waiting on you» in exactly the tone it says everything else.
                The block takes the rule and the wash, and the mark beside it is the flag. */
            borderLeft: `${FLAG_EDGE} solid ${flagInk(theme)}`,
            background: `color-mix(in srgb, ${theme.colors.accent} 4%, transparent)`,
            borderTopRightRadius: theme.borders.radius200,
            borderBottomRightRadius: theme.borders.radius200,
            ...theme.typography.ParagraphSmall,
            minWidth: 0,
          }}
        >
          <span style={{ display: 'inline-flex', paddingTop: '0.1em' }}>
            <AttentionDot waiting={owed} testid="hovercard-dot" />
          </span>
          {owed.why}
        </span>
      )}

      {/* ── THE DOOR (§137.2) ─────────────────────────────────────────────────────────────
          «If they click on go to profile it goes there.» His words, and his words are the label. */}
      <div style={{ paddingTop: theme.sizing.scale400 }}>
        <Button
          kind={KIND.secondary}
          size={SIZE.compact}
          data-testid="hovercard-go"
          onClick={() => openCustomer(customer.id)}
          overrides={{ BaseButton: { style: { width: '100%' } } }}
        >
          Go to profile
        </Button>
      </div>
    </div>
  );
}

/* ── THE SEAT A NAME TAKES ────────────────────────────────────────────────────────────────────
 * Wrap the name that is already a door. The children are handed back untouched wherever hovering
 * is not a gesture — the component is then a pass-through with no wrapper of its own, because a
 * span around every name on a river of three hundred rows is three hundred boxes bought for
 * nothing.
 */
export function CustomerHoverCard({
  customer,
  children,
  placement = PLACEMENT.bottomLeft,
}: {
  customer: Customer;
  children: React.ReactNode;
  placement?: React.ComponentProps<typeof Popover>['placement'];
}) {
  /* ONE STATE AND NO SUBSCRIPTIONS. The hooks above the early return are the same on every render
     because `hoverIsAGesture` is read from the same two `MediaQueryList`s every time — the order
     is stable, which is what the rule of hooks actually asks for. */
  const [open, setOpen] = React.useState(false);

  /* NEVER ON GLASS. The name is simply the door, which is what it already was. */
  if (!hoverIsAGesture()) return <>{children}</>;

  return (
    <Popover
      isOpen={open}
      triggerType={TRIGGER_TYPE.hover}
      /* THE HANDLERS LIVE ON THE POPOVER, NEVER ON THE CHILD — Base clones the anchor and writes
         its own over anything the child declared (`chip-entry.tsx`'s scar). */
      onMouseEnterDelay={REST_MS}
      onMouseLeaveDelay={LEAVE_MS}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onEsc={() => setOpen(false)}
      placement={placement}
      showArrow
      /* THE CARD NEVER TAKES THE KEYS. A person is reading a river or writing an albarán; a card
         that stole focus on a pointer resting would take the keyboard off the work. */
      autoFocus={false}
      focusLock={false}
      returnFocus={false}
      content={() => <CustomerEssentials customer={customer} />}
      overrides={{
        Body: {
          style: ({ $theme }) => ({
            zIndex: 30,
            borderTopLeftRadius: $theme.borders.radius300,
            borderTopRightRadius: $theme.borders.radius300,
            borderBottomLeftRadius: $theme.borders.radius300,
            borderBottomRightRadius: $theme.borders.radius300,
          }),
        },
      }}
    >
      {/* THE ANCHOR IS A BOX WITH NO OPINIONS: it takes the name's own width and lays it out
          inline, so wrapping a name in a card changes no geometry anywhere (§37.3). */}
      <span data-hovercard={customer.id} style={{ display: 'inline-flex', minWidth: 0, maxWidth: '100%' }}>
        {children}
      </span>
    </Popover>
  );
}
