/* CUSTOMERS — THE BOOK, AND ONE CUSTOMER'S MAIN SHEET BESIDE IT (FEED-IA §37.6).
 *
 * «CUSTOMERS get the same: their own surface, master-detail, the customer's main sheet as the
 * preview — standard card structure, the right Base/kit components, best of the best.»
 *
 * ═══ WHAT THIS SURFACE IS FOR ═══════════════════════════════════════════════════════════════
 * Sales is the day. Stock is the shelf. This is the BOOK: three hundred accounts, and everything
 * the house and Rocoto between them know about any one of them, reachable by name in one press.
 * It answers the question a comercial asks twenty times a morning — «who are they, whose are they,
 * what do they take, what did we send them, and what is open with them right now» — without
 * anybody having to find one of their albaranes first.
 *
 * IT DOES NOT REPLACE THE OVERLAY. `customer-profile.tsx` still opens over an albarán, because a
 * card you leave mid-morning is a different act from a book you stand in. What it does is READ THE
 * SAME BLOCKS: `WhatRocotoKnows` is one component with two callers, so a customer cannot look like
 * two customers depending on which door was used.
 *
 * ═══ PANES, NOT BOXES (FEED-IA §38) ═════════════════════════════════════════════════════════
 * «The albarán panel and customer panel — same — is a box within, where it should just be full
 * height. The scrolling behavior is horrible.» So on the desk this surface is TWO FULL-HEIGHT
 * PANES and the page itself does not scroll:
 *
 *   · the LIST pane — one scrollport, edge to edge, its search seat and its letter heads sticky
 *     WITHIN it. No inner scrollport anywhere in it.
 *   · the SHEET pane — one scrollport, no card framing of its own, the content running under a
 *     sticky action bar at its foot.
 *
 * The frame owns that geometry: `usePanes(true)` hands this surface the whole box under the chrome
 * and stops the page scrolling, and the two panes stretch to it. Nothing here measures a viewport.
 *
 * ═══ THE SHEET GRAMMAR (FEED-IA §39) ════════════════════════════════════════════════════════
 * «Detailed info with embedded shit; and below that we have action sticky.» One grammar, three
 * surfaces — the albarán, the product, the customer:
 *
 *   1 · THE HEAD names them and states the facts an account is: channel · zone and truck ·
 *       comercial · tarifa · the hour they asked for · their own system where they have one. The
 *       MAP IS A 72px SQUARE TOP-RIGHT and pressing it opens the big one — the albarán's own
 *       control, to the pixel, reading the same `PinMap` with the same `caption={false}`.
 *   2 · THE EMBEDS, IN §42's OWN ORDER — standard-first, «make the actually-important thing the
 *       important thing»: THEIR ORDERS (the river's own cards, because the order is ONE object
 *       everywhere) · their mail where the mailbox is the channel · the numbers · THEIR MENU, a
 *       top-level object of which a menu change is an event · what Rocoto has noticed, under it.
 *   3 · THE STICKY BAR IS «CONTACT THEM», and Open the chat is the primary act. WHEN SOMETHING OF
 *       THEIRS IS STANDING, THE BAR SAYS IT — the standing sentence and its own verb ride the bar
 *       («They ask the gamba price — Rocoto needs it to reply» · Answer them). The bar is sticky
 *       INSIDE the pane's one scrollport, so the sheet flows under it rather than being cut short
 *       by a footer.
 *
 * ═══ THE SPINE IS THE ALPHABET, AND THE COMERCIAL IS A FACT ═════════════════════════════════
 * A book of accounts is a thing you look somebody up in, so it is sorted by name and cut into
 * letters — the same shape the river's day whispers have, one register up. Whose account it is
 * rides the row as a fact, and it is also a SEARCH TERM: typing «Toni Gomis» thins the book to his
 * thirty-eight without this surface growing a second narrowing mechanism beside the one §35.1
 * already gave all three homes. One grammar, and the comercial narrow costs nothing to learn.
 *
 * ═══ EVERY NUMBER ON IT IS COUNTED ══════════════════════════════════════════════════════════
 * The month's figure, the usual basket, the typical order and the order days are `monthOf`,
 * `basketOf`, `typicalOrderWords` and `dayPatternOf` in `knows.ts`, folded off one record. Nothing
 * on this surface is a claim about a customer that the customer's own albaranes cannot be checked
 * against — and where the record carries no rhythm, the head says the cadence rather than inventing
 * a pattern for the top of somebody's sheet.
 *
 * ═══ NO DEAD NAMES (FEED-IA §43 — THE OBJECT LAW) ═══════════════════════════════════════════
 * «Every PRODUCT name is a DOOR to the product's sheet in Stock; every ORDER card lands in Sales;
 * the COMERCIAL's name is a door to their narrow.» This surface is made almost entirely of names,
 * so every one of them is a control: a good in «what carries the account» opens the catalogue at
 * that product, an order card opens Sales at that albarán, and the comercial narrows the book to
 * their own accounts — which is this surface's own narrow, and therefore instant.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { WorkflowDialog } from '../workflow-dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  emailProviderName,
  emailReplyIdempotencyKey,
  nativeMailboxDestination,
  nativeMailboxDestinationFor,
  publishEmailSourceChange,
  sendConnectedEmailReply,
  useEmailCapability,
  useEmailConnectionStatus,
  useEmailReplyAvailability,
  type EmailSource,
} from '../email-provider';
import { EmailSetupState } from '../email-setup-state';
import { StatefulTooltip, PLACEMENT as TOOLTIP_PLACEMENT } from 'baseui/tooltip';
import { Figure } from '../figure';
import { OverlayCard, SCRIM } from '../../../rocoto/overlay-card';
import Name from '../../../scenarios/shell/Name';
import { comercialOf, type Cast, type Customer } from '../../../scenarios/data/cast';
import type { SectorId } from '../../../scenarios/meta';
import { useConfig } from '../config';
import { useGrants } from '../grants';
import {
  BOTTOM_NAV_HEIGHT, openChat as openChatPanel, openEmail, Page, SearchSummon, usePanes, usePhone,
  useSearchSeat, useStacked,
} from '../shell';
import type { AreaMeta } from '../shell/area';
import { LAUNCHER_LANE } from '../shell/chats';
import { Mark, matches, termsOf, wordsOf } from '../search';
import { nowOf, plural, useDay } from '../day';
import { TruckChip } from '../truck-chip';
import PinMap, { MAP_CREDIT } from '../pin-map';
import { zoneNameOf } from '../round-map';
import { isMultiTier, tierNameOf } from '../tiers';
import { Composer } from '../../../rocoto/composer';
import { capabilityAvailable } from '../release-profile';
import { useWorkspaceCapabilities } from '../workspace-capabilities';
/* THE SHEET IS THE REFERENCE SHEET (FEED-IA §137.1 · §132.6 · §134.2). It was «this surface reads
   two of the other one's organs»; it is now «this surface mounts the other one's whole body».
   `CustomerRecord` is the record — one drawing, every door — and `accountNumber` is the identity
   fact the book's own head carries above it. A customer cannot look like two customers depending
   on which door was used, and after §137 they cannot even be laid out differently. */
import {
  accountNumber, Block, CustomerRecord, NoticedMark,
} from '../customer-profile';
import { Atom } from '../rows';
/* §137.2 · the essentials a pointer at rest asks for, on the book's own rows. It takes the card's
   own placement — below the name, left-aligned to it — because `right` was measured flipping into
   the pane it was trying to avoid, and a card that lands somewhere different at every width is a
   card a reader has to look for. */
import { CustomerHoverCard } from '../customer-hovercard';
/* ── §196.6 · THE PHONE IS A RAIL ON THIS SHEET (E193.07 — THE HERMES PORT) ─────────────────
 * «Phone calls become communication objects beside WhatsApp and Email.» So the account's own
 * number carries two things the sheet never had: the CALLS the runtime holds on it — direction,
 * duration, recording custody, the diarised Spanish transcript — and the IDENTITY Google Places
 * answers with when a person asks who a number belongs to. Both objects are drawn once, in
 * `voice-objects.tsx`, and the same drawings stand in Messages' unmatched queue. */
import { useIdentity } from '../voice';
import { IdentityCard } from '../voice-objects';
import { PhoneHistory } from '../phone-history';
import { usePhoneCapability } from '../phone-runtime';
import { openPhoneDial } from '../phone-session';
import {
  amount, basketOf, dayPatternOf, monthKeyOf, monthOf, typicalOrderWords, units,
  type Basket, type MonthSpend,
} from '../knows';
/* THE PROJECTION'S OWN FOLD (FEED-IA §60.3). One module computes every reading; the seat draws
   them whole and this surface draws one per row — so a claim on a row and the same claim in «Tus
   datos» can never be two different readings of one morning. */
import {
  NARROW_KINDS, attentionReadings, type AttentionReading, type ReadingKind,
} from '../insights';
import {
  buildSales, isMessageOnly, isSticky, todayId,
  type Round, type Sale,
} from '../sale';
/* THE OBJECT DOORS (§43). This surface publishes the CUSTOMER's landing and presses the ORDER's
   and the PRODUCT's — one scheme, in `anchors.tsx`, so no area package imports another. */
import { Door, anchorFor, openCustomer, openOrder, openUser, useLanding } from '../anchors';
/* ── §122 · EDITABLE FROM THE GET-GO ──────────────────────────────────────────────────────────
   «EVERYTHING SHOULD ALWAYS BE EDITABLE FROM THE GET-GO. You shouldn't need to confirm anything.»
   The account's four authored facts — its name, the channel its orders arrive on, the hour it
   asked for, how it settles — are written HERE, where they are read, through the one fold every
   surface reads them back out of. `LiveValue`/`LiveField` are the grammar: one press, one edit,
   no Save. Everything else on this sheet is COUNTED, and a counted fact stays a fact. */
import { accountOf, channelsOfTrade, setAccount, settlementsOfTrade, useCustomerEdits, type CustomerEdit } from '../customer-edits';
import { LiveValue } from '../live-value';
/* ── E200.07 · §196.1 CARRIED OFF THE PRODUCT SHEET («same for like other shit») ──────────────
 * Every pick-from-a-list account fact is the SAME organ the product sheet uses: one filtering
 * combobox, the house's own values, the typed word where the register allows it. The attached
 * menu these three facts used to open (`LiveChoice`) showed nothing until it was pressed and
 * filtered nothing once it was, which is the «doesnt look like live dropdowns» Peter named. */
import { LiveField } from '../live-field';

export const meta: AreaMeta = {
  id: 'customers',
  title: 'Customers',
  owner: 'V2-CUSTOMERS',
  /* MASTER-DETAIL (§37.6, §38): the book and the customer's sheet. */
  panes: true,
};

/* ── THE MEASURES, STATED ONCE (FEED-IA §33 — the air pass) ────────────────────────────────────
 * «People expect generous room.» The book takes the river's own gutter so a name in Customers and
 * a name in Sales stand on the same left edge, and the sheet takes a step more because a document
 * is read rather than scanned. Four values, and nothing on this surface types a fifth.
 */
const GUTTER = 'scale600';
const SHEET_GUTTER = 'scale700';
/** a letter opens like a section, exactly as a day does in the river */
const LETTER_AIR = 'scale1000';
/** the sheet's own rhythm between one embed and the next */
const BLOCK_AIR = 'scale700';

/** THE SHEET PANE'S OWN WIDTH — Sales' panel measure, so the two surfaces read as one layout, and
 *  the number the frame is told to keep its floating conversation clear of (§39.3). */
const SHEET_PANE = 640;
/** The phone sheet ends below BOTH fixed pieces of chrome: navigation and the conversation lane.
 * The sticky contact bar can sit in either, so the final record row must be able to scroll clear
 * of both rather than ending behind an action a person cannot move. */
const PHONE_SHEET_END_CLEARANCE = BOTTOM_NAV_HEIGHT + LAUNCHER_LANE;

/* ── THE FIELD LABEL (the albarán's own) ──────────────────────────────────────────────────────
 * The sheet has to read as the same document the albarán is, and the albarán's facts are named by
 * a small tracked label above the value they name. `detail.tsx` draws that label privately; the
 * day it publishes one, this reads it. Until then the two agree on the same four declarations, and
 * this comment is the note that says so.
 */
function FieldLabel({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {children}
    </span>
  );
}

/** One named fact of the account. The label above, the value under it — never a colon-and-run.
 *
 *  IT HAS TWO REGISTERS, AND THE REGISTER IS THE HIERARCHY (§51.18). `daily` is what a person
 *  opens this sheet to know — when they order, what they take — and it is set a full step above
 *  the account's standing facts. Both keep the same label, the same `data-fact`, the same
 *  label-over-value anatomy: what differs is size, which is the one thing an eye reads before it
 *  reads any words. */
function Fact({
  label,
  span = 1,
  daily,
  field,
  children,
}: {
  label: string;
  /** how many of the grid's columns the value needs. A sentence is not a cell. */
  span?: number;
  /** the §42.1 head facts — what matters daily — at the sheet's big step */
  daily?: boolean;
  /** the child IS a live field (E200.07): it stands as its own block and wears the cell's noun
   *  through `hideLabel`, so the seat prints one label and the inline value span is spent. */
  field?: boolean;
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-fact={label}
      data-register={daily ? 'daily' : 'account'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale100,
        gridColumn: span > 1 ? `span ${span}` : undefined,
        minWidth: 0,
      }}
    >
      <FieldLabel>{label}</FieldLabel>
      {field ? children : (
      <span
        style={{
          ...(daily ? theme.typography.LabelMedium : theme.typography.LabelSmall),
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale200,
          flexWrap: 'wrap',
        }}
      >
        {children}
      </span>
      )}
    </div>
  );
}

/* ── THE BOOK'S OWN LETTERS ───────────────────────────────────────────────────────────────────
 * «Ávila» stands under A. The fold is the same one the search does — decompose, drop the marks —
 * so a person typing «a» and a person reading the A section are looking at the same set.
 */
const letterOf = (name: string): string => {
  const c = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};

type Letter = { letter: string; customers: Customer[] };

const byLetter = (book: Customer[]): Letter[] => {
  const out: Letter[] = [];
  for (const c of book) {
    const letter = letterOf(c.name);
    const at = out[out.length - 1];
    if (at && at.letter === letter) at.customers.push(c);
    else out.push({ letter, customers: [c] });
  }
  return out;
};

/** The round a customer sits on, said the way the river says it. A customer with no van has no
 *  chip rather than a chip saying nothing. */
const roundOfCustomer = (c: Customer): Round | null =>
  c.truck === undefined || !c.zone ? null : { truck: c.truck, zone: c.zone };

/* ── ONE ROW OF THE BOOK ──────────────────────────────────────────────────────────────────────
 * WHAT THE ROW SAYS, in the river's own five steps: the NAME at step 3, the FACTS at step 5 —
 * whose account it is, which van runs them, which tarifa they sit on where the house keeps more
 * than one — and the money at the end, quiet, with the word that says which money it is.
 *
 * THE FIGURE IS COMPACT AND THE NAME IS NOT. On the river the figure outranks the name because a
 * row there is about a delivery; here the row is about a PERSON, and a month's total shouted over
 * three hundred names would turn a directory into a leaderboard.
 *
 * ═══ AND IT IS COMPOSED, NOT OVERRIDDEN (the row-primitive unification) ═════════════════════
 * This row used to be Base's `ListItem` + `ListItemLabel` with five `overrides` on it, while the
 * catalogue's rows and the river's rows were composed from the theme's own tokens. Two primitives
 * for one idea — «a selectable row in a master-detail list» — across three surfaces that §38 and
 * §39 had just declared to be ONE grammar («list pane left · detailed info right · the pane's own
 * sticky bar below… one grammar, three surfaces»). The seam showed in the pixels: this row's seat,
 * its hairline's indent and its minimum height came from Base's list contract, and the catalogue's
 * came from ours, so the two panes agreed about everything except how a row looks.
 *
 * The catalogue's grammar won on merit rather than on seniority: it is the one that can carry a
 * 44px painting, a name that wraps rather than truncating (§41.6) and a hard-right figure, and it
 * is the one the river already speaks. So the book takes it, to the token.
 *
 * BASE CONFORMANCE IS KEPT, AND IT WAS NEVER THE COMPONENT. What Base's list contract actually
 * gives is a real `<button>` with the button reset, a `scale1600` minimum height, one hairline per
 * row, the theme's own type ramp and `aria-current` on the selected one — every one of which is a
 * property this row still has, stated where a reader can see it. An override stack that reaches
 * five deep into somebody else's component is not conformance; it is a fight with it.
 */
const CustomerRow = React.memo(function CustomerRow({
  customer,
  cast,
  month,
  terms,
  selected,
  pricesVisible,
  multiTier,
  reading,
  onPick,
}: {
  customer: Customer;
  cast: Cast;
  month: MonthSpend;
  terms: string[];
  selected: boolean;
  pricesVisible: boolean;
  multiTier: boolean;
  /** ── THE PROJECTION (FEED-IA §60.3) ────────────────────────────────────────────────────────
   * «Therefore the customer list will obviously go into our customers thing based on updates.»
   * The analysis in «Your data» is not trapped in the seat: the ONE reading that matters most for
   * this account rides its row, here, where the work is.
   *
   * CAP: ONE PER ROW (THE-DATA-CANON §2.0.e). `readingFor` asks all four questions and keeps the
   * highest-priority answer — dropped > changed > different > incidencia — which is the
   * one-health-tag law extended to insight. A row is ONE customer; a row wearing four readings is
   * a row nobody reads. */
  reading?: AttentionReading | null;
  onPick: () => void;
}) {
  const [, theme] = useStyletron();
  const holder = comercialOf(cast, customer);
  const round = roundOfCustomer(customer);

  /* the end of the row is one component per Base's contract, so it is held still across renders —
     a list of three hundred that rebuilt a component type on every keystroke would remount three
     hundred subtrees for one letter typed */
  const End = React.useCallback(
    () => (
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: theme.sizing.scale100,
          whiteSpace: 'nowrap',
        }}
      >
        <Figure value={month.figure} unit="S/" size="compact" />
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
          this month
        </span>
      </span>
    ),
    [month.figure, theme],
  );

  const [over, setOver] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  return (
    <button
      type="button"
      data-customer-row={customer.id}
      data-list-card="inset"
      data-selected={selected ? 'yes' : 'no'}
      data-testid={`customer-${customer.id}`}
      aria-current={selected ? 'true' : undefined}
      onClick={onPick}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale500,
        /* THE HIT AREA IS A CARD INSIDE THE LIST (FEED-IA §188). The outer book remains the
           column; hover, keyboard focus and the current account all occupy this exact rounded
           rectangle. A small gutter between rectangles keeps adjacent customers from reading as
           one giant control and gives a pointer a real boundary to cross. */
        width: `calc(100% - ${theme.sizing.scale400})`,
        margin: `${theme.sizing.scale100} ${theme.sizing.scale200}`,
        boxSizing: 'border-box',
        /* BASE'S OWN LIST MINIMUM, stated rather than inherited — `scale1600` is the height a row
           of a list takes in this design system, and 296 of them breathe because of it. */
        minHeight: 64,
        padding: `${theme.sizing.scale400} ${theme.sizing[GUTTER]}`,
        border: `1px solid ${selected || focused ? theme.colors.borderOpaque : 'transparent'}`,
        borderRadius: theme.borders.radius400,
        background: selected || over || focused ? theme.colors.backgroundSecondary : 'transparent',
        boxShadow: selected || focused
          ? `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 6%, transparent)`
          : 'none',
        transition: `background-color ${theme.animation.timing400} ${theme.animation.easeOutCurve}, border-color ${theme.animation.timing400} ${theme.animation.easeOutCurve}, box-shadow ${theme.animation.timing400} ${theme.animation.easeOutCurve}`,
        color: theme.colors.contentPrimary,
        textAlign: 'left',
        cursor: 'default',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
        {/* ── AND RESTING ON IT SHOWS THE ESSENTIALS (FEED-IA §137.2) ────────────────────────
            The row IS the door — the whole 64px of it — and that does not change: the card is what
            a pointer AT REST adds, and Base attaches no click handler at all in `hover` mode, so
            the press still reaches the row underneath. On glass the component hands the name
            straight back and the tap opens the sheet, as it always did. */}
        <CustomerHoverCard customer={customer}>
          <span
            data-customer={customer.name}
            style={{
              ...theme.typography.LabelMedium,
              display: 'block',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {terms.length > 0 ? <Mark text={customer.name} terms={terms} /> : <Name of={customer} />}
          </span>
        </CustomerHoverCard>
        <span
          data-facts={customer.id}
          style={{
            ...theme.typography.ParagraphXSmall,
            color: theme.colors.contentTertiary,
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale300,
            rowGap: theme.sizing.scale100,
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          {holder && (
            <span
              data-holder={holder.id}
              style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {terms.length > 0 ? <Mark text={holder.name} terms={terms} /> : holder.name}
            </span>
          )}
          {/* A MARK HERE, NOT A DOOR (§43's affordance). This whole row is the customer's own door
              and it is the size of a thumb; a second control inside it competes for the same press,
              which on a phone is a mis-tap rather than a choice. The chip opens the map where the
              ROUND is the subject — on the sheet — and states itself where the row is. */}
          {round && <TruckChip round={round} />}
          {/* The row is the customer's only door. Its tariff remains a quiet summary here;
              its registry is reached from the customer sheet, where it can be a separate valid act. */}
          {multiTier && <span style={{ flex: '0 0 auto' }}>{tierNameOf(cast, customer.tier)}</span>}
        </span>

        {/* ── THE READING, AS ONE QUIET LINE (THE-DATA-CANON §2.0.e) ────────────────────────────
            The saffron dot says WHO said it — this is Rocoto's own reading of the record, not a
            fact off the row — and the sentence is short enough to be taken in at a glance down a
            book of three hundred. The EVIDENCE lives on the sheet and in the seat; the row carries
            the claim, because a row is a place you scan and not a place you study. */}
        {reading && (
          <span
            data-reading={reading.kind}
            data-reading-for={customer.id}
            style={{
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: theme.sizing.scale200,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <NoticedMark label="Rocoto lo ha leido en el registro" />
            {/* THE ELLIPSIS HAS TO LAND ON THE TEXT, NOT ON THE BOX (§77.2 — «nothing jags»). This
                slot declares `text-overflow: ellipsis`, and a bare text node inside a FLEX box is
                an anonymous flex item that the declaration cannot reach — so at 390 the line was
                sliced mid-glyph («…after it was recorde») instead of ending in an ellipsis. The
                sentence gets its own box, and the declared overflow is the one that renders. */}
            <span
              data-reading-line=""
              style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {reading.line}
            </span>
          </span>
        )}
      </span>

      {/* THE MONEY NEVER SHRINKS AND THE NAME ALWAYS CAN. One side gives, and it is the one that
          can say less and still be read. */}
      {pricesVisible && <End />}
    </button>
  );
});

/* ── THE LETTER (the book's own section head) ────────────────────────────────────────────────── */

function LetterHead({ letter, held, under }: { letter: string; held: number; under: number }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-letter={letter}
      style={{
        /* IT PARKS UNDER THE PANE'S OWN HEAD, never behind it. The head's height is MEASURED
           because the search seat changes it — the seat is a mark at rest and a field once it is
           used — and a letter sliding under a field is a letter nobody can read. */
        position: 'sticky',
        top: under,
        zIndex: 1,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: theme.sizing.scale400,
        padding: `${theme.sizing[LETTER_AIR]} ${theme.sizing[GUTTER]} ${theme.sizing.scale300}`,
        /* ONE LEFT EDGE (§33). A row carries a 3px selection bar and then Base's own content
           margin, so the letter takes the same 3px of transparent bar and lands its A on the same
           pixel as the names under it. Two edges eleven pixels apart is what makes a column read
           as assembled rather than as one thing. */
        borderLeft: '3px solid transparent',
        borderBottom: `1px solid ${theme.colors.contentPrimary}`,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{letter}</h2>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
        {held} {plural(held, 'customer')}
      </span>
    </div>
  );
}

/* ── WHERE THEY ARE, AS A SMALL SQUARE (FEED-IA §39.1) ───────────────────────────────────────
 * «The LOCATION becomes a small square top-right — clicking it opens the big map in a modal.»
 *
 * IT IS THE ALBARÁN'S OWN SQUARE, TO THE PIXEL. `detail.tsx` settled this control while this file
 * was being written — 72px, captionless, a hover label carrying the run and OpenStreetMap's credit,
 * and the full map on the app's own Overlay Card — so the customer's sheet takes the same
 * construction rather than a second one that merely looks similar. «One grammar, three surfaces»
 * is a claim about the code as much as about the pixels.
 *
 * WHERE THE CREDIT GOES. A 72px square has no line to put ODbL's attribution on, so the credit
 * rides the control's own hover label and the full-size map carries it in the ordinary way — which
 * is `pin-map.tsx`'s own stated answer, not a decision taken again here.
 *
 * AND IT IS `MAP_CREDIT`, NOT A COPY OF IT (LICENSES-AND-ATTRIBUTION.md's open note). The label
 * used to repeat the literal «© OpenStreetMap contributors» while the map it opens rendered «© OpenStreetMap contributors ·
 * OpenMapTiles» from the exported constant — one attribution written in two places, which is how a
 * licence line goes stale in the half nobody is looking at. The square now says exactly what the
 * picture behind it says, off the same export.
 */
const MAP_SQUARE = 72;

function WhereSquare({ customer }: { customer: Customer }) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  if (!customer.at) return null;
  const zone = zoneNameOf(customer.zone) ?? customer.zone;
  const where = [zone, customer.truck !== undefined ? `truck ${customer.truck}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <StatefulTooltip content={`${where} · ${MAP_CREDIT}`} placement={TOOLTIP_PLACEMENT.left} showArrow>
        <Button
          kind={KIND.tertiary}
          size={SIZE.compact}
          data-testid="map-square"
          aria-label={`${where} · open the map`}
          onClick={() => setOpen(true)}
          /* ⚠ THE UNITS ARE THE STYLE'S, NOT REACT'S (found by the E193.14 sweep, which measured
             this square at 2×74 at 390 — two border pixels and nothing between them). Styletron
             writes a style object into a real stylesheet, so a bare `72` is not a length and the
             declaration is dropped: `width`, `height` and `minWidth` all fell away and only the
             1px border survived, which is why the map behind it never painted on a phone. React's
             inline `style` would have appended the unit; a CSS engine does not. */
          overrides={{ BaseButton: { style: {
            flex: '0 0 auto',
            width: `${MAP_SQUARE}px`,
            height: `${MAP_SQUARE}px`,
            minWidth: `${MAP_SQUARE}px`,
            padding: 0,
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            background: theme.colors.backgroundSecondary,
            overflow: 'hidden',
            display: 'block',
          } } }}
        >
          <PinMap at={customer.at} height={MAP_SQUARE} caption={false} pin={20} />
        </Button>
      </StatefulTooltip>

      <OverlayCard
        isOpen={open}
        onClose={() => setOpen(false)}
        scrim={SCRIM.dim}
        size={560}
        ariaLabel={`Delivery location for ${customer.name}`}
      >
        <div
          data-testid="where-modal"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
        >
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Delivery location</h2>
          <PinMap at={customer.at} zone={zone} truck={customer.truck} note={customer.name} height={320} />
        </div>
      </OverlayCard>
    </>
  );
}

/* ── THE OBJECT LAW, AND WHERE THE DOORS THEMSELVES NOW LIVE (FEED-IA §43) ───────────────────
 * «Every PRODUCT name is a DOOR to the product's sheet in Stock; every ORDER card lands in Sales;
 * the COMERCIAL's name is a door to their narrow. No dead names anywhere.»
 *
 * `Door` was born on this surface because this surface is made almost entirely of names. «ANYWHERE»
 * is the word in §43 that made keeping it here wrong: a door drawn one way on the customers' sheet
 * and another way on a band card is two vocabularies for one law. It lives in `anchors.tsx` with
 * the doors it opens, and this file is one of its callers now.
 *
 * ── AND `SheetRow` WENT WITH THE BLOCKS IT DREW (FEED-IA §137.1) ─────────────────────────────
 * It was this file's own copy of the profile's row — a label, a quiet sub-line, a value hard right
 * — invented so «the numbers and the record read as the same document the overlay does». §137 made
 * that literal: the sheet MOUNTS the overlay's body, so the rows are the overlay's own `Row` and
 * the product doors on them are `usual-open-<id>` on the leaderboard rather than a second
 * `product-door-<id>` drawn here. One shape, one place, and this note is where the second one was.
 */

/* ── THE DOOR BACK INTO THE RIVER (FEED-IA §25.2, now §43's scheme) ───────────────────────────
 * Sales' walk selects the sale, opens its document and scrolls the river to the row, and it is a
 * REGISTRATION — it does nothing at all while Sales is not on screen. Coming from here the surface
 * is by definition not mounted yet, so the door writes the order's own address and then knocks
 * until the river stands up to answer.
 *
 * THAT KNOCKING USED TO BE TYPED OUT HERE, once, for one of the three objects. It is `openObject`
 * in `anchors.tsx` now, because a customer's name pressed on a band card and an order pressed in a
 * customer's history are the same act in two directions, and a mechanism that existed on only one
 * of them is how «no dead names» quietly becomes «no dead names on this screen».
 */
/* ── CONTACT BY CHANNEL: THEIR EMAIL HISTORY (FEED-IA §42) ────────────────────────────────────
 * «An «Open chat» button — and for email customers (normal, plenty of them) THEIR EMAIL HISTORY
 * stands in that place instead.»
 *
 * A house's book is not all WhatsApp: hotels and trade accounts order by mail, and for them the
 * conversation IS the mailbox. So the sheet carries their thread of mail where a chat customer's
 * sheet carries nothing, and the bar's act becomes writing to them.
 *
 * THE ROWS ARE THE INBOX'S OWN ANATOMY (`inbox.tsx`), read rather than re-invented: unread is
 * WEIGHT and never a dot or a colour, the subject is the row, the snippet is one quiet line under
 * it, and the hour stands hard right and never shrinks. What is NOT borrowed is the component —
 * `MailRow` is bound to `IncomingMail`, which is a supplier's albarán arriving at the house, and a
 * customer's order arriving is a different object. The anatomy is the shared thing; the object is
 * not.
 */

export type CustomerMail = {
  id: string;
  subject: string;
  /** the hour it landed */
  at: string;
  /** the first line of it */
  snippet: string;
  /** theirs, or ours */
  from: 'them' | 'us';
  /** Opaque, authorized provider source only; never raw mail content or a recipient store. */
  source?: EmailSource;
  /** the order it is about, where it is about one */
  sale?: string;
};

/** THEIR MAIL, folded from each actual order source. No browser-side email body, recipient or send queue is kept. */
const mailOfSales = (theirs: Sale[]): CustomerMail[] =>
  theirs.map((sale) => {
    const said = sale.thread.find((turn) => turn.author === 'received');
    const source = [...sale.thread].reverse().find((turn) => turn.email?.source)?.email?.source;
    return {
      id: `mail-${sale.id}`,
      subject: `Order for ${sale.deliveryDay}`,
      at: sale.at,
      snippet: said?.text ?? sale.lines.map((line) => `${amount(line.ordered)} ${units(line.ordered, line.unit)} ${line.product.name}`).join(' · '),
      from: 'them' as const,
      ...(source ? { source } : {}),
      sale: sale.id,
    };
  });

function MailRow({ mail, onOpen }: { mail: CustomerMail; onOpen?: () => void }) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  const clip = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } as const;
  const body = <>
    <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelSmall, ...clip }}>{mail.subject}</span>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, ...clip }}>{mail.snippet}</span>
    </span>
    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto', whiteSpace: 'nowrap' }}>{mail.at}</span>
  </>;
  const frame: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'baseline',
    gap: theme.sizing.scale400,
    width: `calc(100% - ${theme.sizing.scale400})`,
    boxSizing: 'border-box',
    margin: `${theme.sizing.scale100} ${theme.sizing.scale200}`,
    padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
    border: `1px solid ${over ? theme.colors.borderOpaque : 'transparent'}`,
    borderRadius: theme.borders.radius400,
    background: over ? theme.colors.backgroundSecondary : 'transparent',
    boxShadow: over ? `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 6%, transparent)` : 'none',
    textAlign: 'left',
    minWidth: 0,
  };
  if (!onOpen) return <div data-testid="customer-mail" data-list-card="inset" data-mail={mail.id} style={frame}>{body}</div>;
  return <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="customer-mail" data-list-card="inset" data-mail={mail.id} aria-label={`Open conversation: ${mail.subject}`} onClick={onOpen} onMouseEnter={() => setOver(true)} onMouseLeave={() => setOver(false)} onFocus={() => setOver(true)} onBlur={() => setOver(false)} overrides={{ BaseButton: { style: { ...frame, font: 'inherit', color: 'inherit', cursor: 'default' } } }}>{body}</Button>;
}

/* ── THE CUSTOMER SHEET'S EMAIL DOOR (FEED-IA §247.2) ─────────────────────────────────────────
 * «always we havbe to be super consistent and not fget people igo confusing menus when they
 *  shouldnt see them»                                                      — Peter, 11 Sept 2026
 *
 * One door, two faces, decided by the ONE capability rather than by a release flag and a customer's
 * channel. A mailbox that can send draws the composer; every other posture draws exactly what the
 * Connections card, the connected inbox and onboarding draw — the envelope, one line and one
 * `Connect email`. A disabled composer over «Rocoto replies once this customer has a verified email
 * thread» was a send control the connection never justified.
 *
 * THE RECORD IS NEVER WHAT THIS REPLACES: the mail already in the sheet's own Emails block stays
 * readable in every posture, and a stored source still opens inside the app.
 */
/** The reply editor owns only its in-memory draft. A provider receipt is the sole success state. */
function Compose({
  customer,
  recipient,
  source,
  subject,
  outbound,
  isOpen,
  onClose,
}: {
  customer: Customer;
  recipient: string;
  source: EmailSource | undefined;
  subject: string;
  /** this release sends customer mail from Rocoto at all */
  outbound: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const mailbox = useEmailCapability();
  const [text, setText] = React.useState('');
  const [state, setState] = React.useState<'idle' | 'sending' | 'accepted' | 'failed'>('idle');
  const [message, setMessage] = React.useState('');
  const reply = useEmailReplyAvailability(source);
  const connection = useEmailConnectionStatus();
  const native = nativeMailboxDestinationFor(source);
  const fallbackProvider = connection.kind === 'connected' ? connection.providers[0] : undefined;
  const fallbackNative = fallbackProvider ? nativeMailboxDestination(fallbackProvider) : undefined;
  const ready = reply.kind === 'ready';
  const unavailable = reply.kind === 'read_only'
    ? reply.reason
    : connection.kind === 'unverified'
      ? 'Connect email to send from Rocoto.'
      : 'Rocoto replies once this customer has a verified email thread.';
  const send = async () => {
    if (!ready || !text.trim()) return;
    setState('sending'); setMessage('');
    const result = await sendConnectedEmailReply({ sourceRef: reply.sourceRef, provider: reply.provider, plainText: text.trim(), idempotencyKey: emailReplyIdempotencyKey() });
    if (result.kind === 'accepted') {
      setText(''); setState('accepted'); setMessage(`Accepted by ${emailProviderName(reply.provider)}.`);
      publishEmailSourceChange(reply.sourceRef);
      return;
    }
    setState('failed'); setMessage(result.reason || 'Sending stalled. Your draft is still here.');
  };
  const openNative = native ?? fallbackNative;
  if (!outbound || !mailbox.canSend) return <WorkflowDialog isOpen={isOpen} onClose={onClose} title="Email" step={recipient}
    ariaLabel={`Email ${recipient}`} testId="customer-email-compose"
    actions={<Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose}>Close</Button>}>
    <EmailSetupState />
  </WorkflowDialog>;
  return <WorkflowDialog isOpen={isOpen} onClose={onClose} title="Send email" step={recipient} ariaLabel={`Email ${recipient}`} testId="customer-email-compose" actions={<Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose}>Close</Button>}>
    <div data-testid="compose" data-recipient={recipient} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      <span data-testid="compose-recipient" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>To: {recipient}</span>
      <span data-testid="compose-subject" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Subject: {subject}</span>
      <Composer value={text} onChange={(next) => { setText(next); setState('idle'); setMessage(''); }} onSend={ready ? () => void send() : undefined} sending={state === 'sending'} placeholder={`Email to ${customer.name}`} sendLabel={ready ? 'Send email' : 'Email connection required'} overrides={{ Send: { props: { 'data-testid': 'customer-email-send' } } }} />
      {ready ? <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Sent only after {emailProviderName(reply.provider)} accepts it.</p> : <>
        <p data-testid="customer-email-connection-required" role="status" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{unavailable}</p>
        <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
          {connection.kind === 'unverified' && <Button kind={KIND.secondary} size={SIZE.compact} onClick={() => { window.location.hash = '#/admin/connections/email'; }}>Connect email</Button>}
          {openNative && <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => window.open(openNative.href, '_blank', 'noopener,noreferrer')}>{openNative.label}</Button>}
        </div>
        {text.trim() && <span data-testid="customer-email-draft" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Draft stays in this editor.</span>}
      </>}
      {message && <p data-testid="customer-email-status" role={state === 'failed' ? 'alert' : 'status'} style={{ margin: 0, ...theme.typography.ParagraphSmall, color: state === 'failed' ? theme.colors.negative : theme.colors.contentSecondary }}>{message}</p>}
    </div>
  </WorkflowDialog>;
}

/* ── THE SHEET, AS A WIREFRAME (FEED-IA §51.18, §51.24, §42, §54.3) ───────────────────────────
 * «Hierarchy for sales AND customers: high-level → low-level, the content within each, the states
 * — thought in detail» (§51.18). «What does that section even need to say? This isn't Deliveroo»
 * (§54.3). So the sheet is stated as regions, with its type steps and its states, BEFORE pixels.
 *
 * THE DEFECT THIS PASS FIXES, seen in a 1600 shot: the head drew NINE facts in one uniform grid —
 * ORDER DAYS · THEIR USUAL ORDER · THEIR SYSTEM · ORDERS ON · GOES OUT ON · THEIR COMERCIAL ·
 * TARIFA · ASKED FOR — every label the same size, every value the same size, in one flat field of
 * uppercase. Nine things shouting at one volume is not a hierarchy; it is a form. A comercial who
 * opens this sheet mid-morning wants two things — when these people order and what they take — and
 * had to find them among seven others of identical weight.
 *
 *   REGION 1 · WHO THEY ARE
 *     the NAME (HeadingSmall) — the largest thing on the sheet, at the very top (§51.8)
 *     the flip, quiet, on the name's own row · the MAP, a 72px square, top-right (§39.1)
 *   REGION 2 · HOW THEY TRADE — «what matters daily» (§42.1), at the BIG step
 *     ORDER DAYS · THEIR USUAL ORDER · ASKED FOR · THEIR SYSTEM        values at LabelMedium
 *   REGION 3 · THE ACCOUNT — the standing facts, one dense band under a rule
 *     ORDERS ON · GOES OUT ON · THEIR COMERCIAL · TARIFA               values at LabelSmall
 *   REGION 4 · THE EMBEDS, in §42's own order — their orders (the river's cards) · their mail
 *     where the mailbox is the channel · the numbers · their menu · what Rocoto has noticed
 *   REGION 5 · THE STICKY BAR — «Contact them», carrying the standing thing's own verb (§39)
 *
 * THE TYPE STEPS, so the eye lands in the right order: 24 (name) → 16 (the daily values) →
 * 14 (the account's values) → 12 (every label, and the account band's own). Four steps, and the
 * two registers are told apart by size and by a rule, never by colour.
 *
 * THE STATES, each one drawn rather than assumed:
 *   · no van        → no «Goes out on» fact at all, rather than a fact saying nothing
 *   · no ERP        → «Their system» says what Rocoto connects; the absence is never the sentence
 *   · one tarifa    → the word does not appear (the house has no bands to speak of)
 *   · no orders yet → the record's own empty state, headline and body, in Base's grammar (§58.2)
 *   · mail account  → their mail stands where a chat customer has nothing, and the bar writes
 *   · something standing → the bar says it, in the RIVER'S own sentence, and takes its verb
 *
 * ═══ SENTENCES ARE CONTENT OR THEY DIE (§51.7, §51.24) ═══════════════════════════════════════
 * «You have literally ORPHAN SENTENCES that don't need to exist.» Three of them lived on this
 * sheet as block leads — «Every albarán of theirs on the book, newest first. Press one to open it
 * in Sales.», «Their orders arrive on mail, so the thread is the mailbox — newest first.»,
 * «Counted off their last 5 albaranes and everything on the feed for them today.» Every one is the
 * app describing itself. What each carried that was real is a FACT — a count, a window — so each
 * became the heading's own aside, and the prose went. The only sentences left on this sheet are
 * the customer's own words, Rocoto's readings, and one empty state.
 *
 * ═══ THE EDITABLE GRAMMAR (§51.14) ═══════════════════════════════════════════════════════════
 * ONE grammar app-wide — UNDERLINE at rest · RING on hover · BOX when open — stated in full on
 * `PriceCell`. Nothing on this sheet is written in place: an account's facts are read here and
 * changed where they are kept. So no mark appears, and the app's OTHER quiet underline — `Door`'s,
 * which means «this word opens something» — is the only line under a word on this surface. Two
 * underlines with two meanings on one screen is how a grammar stops being one, which is why the
 * editable mark is absent here rather than decorative.
 *
 * ── AND IT IS A PANE, NOT A CARD IN A COLUMN (§38). It carries its own gutter, its own hairline
 * against the book, and exactly one scrollport — the bar at its foot is sticky inside that
 * scrollport, so the last block runs under it instead of being fenced off by a footer.
 */
export type CustomerSheetProps = {
  cast: Cast;
  customer: Customer;
  /** Every albarán of theirs the ledger holds — the order cards, one object everywhere (§42.2). */
  theirs: Sale[];
  basket: Basket;
  today: string;
  /** Optional book navigation. A standalone overlay intentionally omits it rather than drawing no-op arrows. */
  canWalk?: boolean;
  onWalk?: (by: number) => void;
  /** The caller owns where this returns: the book uses its back label; an overlay uses Close. */
  onBack?: () => void;
  onBackLabel?: string;
  /** A real chat action supplied by the owning surface. */
  onChat: () => void;
  /** The book may narrow to an account owner; a standalone overlay leaves that navigation absent. */
  onHolder?: (name: string) => void;
  now: string;
};

/** The canonical editable customer surface. It is data-driven so the book and an overlay share
 * exactly the same fields, actions, current account state, and historical document reads. */
/* ── THE CALLS, AND WHO THE NUMBER IS (FEED-IA §196.6 · §246) ────────────────────────────────
 * One block on the sheet, beside Emails, carrying the account's phone rail:
 *
 *   · THE STANDING — the ONE shared capability (`phone-capability.ts`), the same answer the dial
 *     route, Connections and onboarding read. This block used to ask the legacy runtime posture
 *     its own question, so a sheet could offer to place a call the connection could never make.
 *   · THE CALLS the workspace holds on this number, drawn by `PhoneHistory` — the same component
 *     the conversation and the call route use, with each transcript one level deeper.
 *   · WHO THE NUMBER IS — the Places lookup, on a PRESS. This number already belongs to somebody,
 *     so the house's own book is the authority (VOICE-07C step 2) and Google is asked only when a
 *     person wants to check the door, the line type or the name against what Google publishes.
 *   · THE CALL — ONE act with ONE destination, whatever the connection is doing. It opens the
 *     canonical dial route carrying this customer and this number, and that route shows either the
 *     dial or the phone image and `Connect phone`. The device-dialler `tel:` escape is gone: two
 *     different outcomes from one control is exactly the state Peter named.
 */
function CallsBlock({
  customer,
  number,
}: {
  customer: Customer;
  number: string;
}) {
  const [, theme] = useStyletron();
  const phone = usePhoneCapability();
  const identity = useIdentity(number, false);
  /* ONE SENTENCE FOR THE CONNECTION, and a read that could not confirm the line adds one word
     rather than changing the sentence: the evidence stands until the provider itself moves it. */
  const standing = phone.posture === 'ready' ? `Calls go out from ${phone.callerId}.`
    : phone.posture === 'partial' ? 'Finish phone setup to call from Rocoto.'
      : phone.posture === 'checking' ? 'Reading the phone connection.'
        : 'Connect phone to call from Rocoto.';

  /* ONE HEADING NAMES THE LIST. The lead read «Calls on <number>, and who Google answers with
     for it» above a block whose own rows say both, and above PhoneHistory's own heading. */
  return (
    <Block
      testid="sheet-calls"
      title="Calls"
      aside={(
        <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="sheet-calls-refresh"
          onClick={() => { void phone.refresh(); window.dispatchEvent(new CustomEvent('rocoto:phone-calls-changed')); }}
          overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
          Read again
        </Button>
      )}
    >
      <p data-testid="sheet-calls-standing" data-phone-posture={phone.posture} data-voice-ready={phone.posture === 'ready' ? 'yes' : 'no'}
        style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0, overflowWrap: 'anywhere' }}>
        {standing}{phone.stale ? ' Checking…' : ''}
      </p>

      {/* THE BLOCK ALREADY NAMES THE LIST («Calls»), so the history draws no second heading. */}
      <PhoneHistory number={number} displayName={customer.name} heading={false} />

      <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          kind={KIND.secondary}
          size={SIZE.compact}
          data-testid="sheet-call-out"
          onClick={() => openPhoneDial({ number, customerId: customer.id })}
          overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
        >
          {`Call ${customer.name}`}
        </Button>
      </div>

      <IdentityCard read={identity.read} number={number} onLook={identity.look} testid="sheet-caller-identity" />
    </Block>
  );
}

export function CustomerSheet({
  cast,
  customer,
  theirs,
  basket,
  canWalk = false,
  onWalk,
  onBack,
  onBackLabel = 'Back to the book',
  onChat,
  onHolder,
  now,
}: CustomerSheetProps) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const holder = comercialOf(cast, customer);
  const round = roundOfCustomer(customer);
  /* §42.1: the two facts that lead the head, counted off the same record as everything else */
  const pattern = dayPatternOf(cast, customer, theirs);
  const usual = typicalOrderWords(basket);
  const email = customer.email?.trim() ?? '';
  /* Email is a real channel only when this account has an actual saved recipient. */
  const byMail = customer.channel === 'email' && email.length > 0;
  const needsEmail = customer.channel === 'email' && !byMail;
  const [editingEmail, setEditingEmail] = React.useState(false);
  const [emailDraft, setEmailDraft] = React.useState(email);
  const mail = React.useMemo(() => mailOfSales(theirs), [theirs]);
  const replyMail = React.useMemo(() => mail.find((message) => message.source), [mail]);
  const replySource = replyMail?.source;
  const outboundAvailable = capabilityAvailable('customerOutbound');
  /* §247.2 — the sheet's email act reads the same live capability every other email entrance
     reads. Sending needs a mailbox that can send; opening the record needs a stored source or a
     live mailbox; and when the state justifies neither, the act lands on the one picture and the
     one `Connect email`, exactly as pressing Call lands on the phone artwork. */
  const mailbox = useEmailCapability();
  const [writing, setWriting] = React.useState(false);
  const [accountSaveError, setAccountSaveError] = React.useState<string | null>(null);
  React.useEffect(() => { setAccountSaveError(null); setEditingEmail(false); setEmailDraft(email); }, [customer.id, email]);
  const saveAccount = React.useCallback((patch: CustomerEdit): boolean => {
    const saved = setAccount(customer.id, patch);
    setAccountSaveError(saved ? null : 'We couldn’t save this customer. Your changes are still here.');
    return saved;
  }, [customer.id]);
  const saveEmail = React.useCallback((value: string): boolean => {
    const next = value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
      setAccountSaveError('Enter a complete email address.');
      return false;
    }
    const saved = saveAccount({ email: next });
    if (saved) setEditingEmail(false);
    return saved;
  }, [saveAccount]);
  /* A communication row opens the customer's exact source thread. It does not make an
     intermediate albarán visit or fabricate a new local conversation. */
  const openMailHistory = React.useCallback(() => {
    onChat();
  }, [onChat]);
  /* The saved channel is the only primary act. Order review hands mail back to its native
     provider; it never turns a customer sheet into a sending surface. */
  /* §196.6 — a PHONE account always has a number to reach: its own, the one this sheet prints
     above. An account whose orders arrive by telephone can never read «no number». */
  const phoneNumber = customer.channel === 'phone' ? (customer.phone?.trim() || accountNumber(customer)) : '';
  /* §196.6 — the ONE number this account's calls and identity are read under. A stored number is
     the house's own record; a telephone account is reached on the number this sheet prints above,
     which `accountNumber` derives. Every other account has no number to call, so the rail stays
     off its sheet rather than deriving one for it. */
  const voiceNumber = customer.phone?.trim() || (customer.channel === 'phone' ? accountNumber(customer) : '');
  const contact = React.useCallback(() => {
    if (needsEmail) { setEditingEmail(true); return; }
    if (byMail) {
      if (outboundAvailable && mailbox.canSend) { setWriting(true); return; }
      /* §202.3 · OUT-05.3 — «open email … we become their chat and email client». The thread opens
         INSIDE the app, drawn from the reference the house is authorized to hold — and a stored
         source stays readable whatever the mailbox is doing (§247.2). */
      if (replySource || mailbox.posture === 'ready') {
        openEmail(cast.sector, customer.id, replySource?.sourceRef ?? '');
        return;
      }
      setWriting(true);
      return;
    }
    /* §246 · ONE DESTINATION. The head's act opens the canonical dial route carrying this customer
       and this number; that route decides between the dial and the phone image from the SHARED
       connection state, so pressing Call always lands in the same place. */
    if (phoneNumber) {
      openPhoneDial({ number: phoneNumber, customerId: customer.id });
      return;
    }
    onChat();
  }, [byMail, cast.sector, customer.id, mailbox.canSend, mailbox.posture, needsEmail, onChat, outboundAvailable, phoneNumber, replySource]);
  const contactWords = needsEmail
    ? 'Add email'
    : byMail
      /* ONE PAIR OF WORDS ACROSS THE APP (OUT-05.6) — «Open chat» and «Open the email» */
      ? outboundAvailable && mailbox.canSend ? 'Send email' : 'Open the email'
      : phoneNumber
        ? 'Call'
        : customer.channel === 'WhatsApp'
          ? 'Open chat'
          : customer.channel === 'phone'
            ? 'Open phone history'
            : 'Open chat';

  const detailsCard: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.sizing.scale500,
    padding: theme.sizing.scale600,
    border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300,
    background: theme.colors.backgroundPrimary,
    boxShadow: theme.lighting.shadow400,
    minWidth: 0,
  };

  const accountDetails = (
    <div data-testid="customer-account-details">
      <div
        data-testid="sheet-facts"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: theme.sizing.scale600, minWidth: 0 }}
      >
        <section data-testid="sheet-delivery" style={detailsCard}>
                <FieldLabel>Delivery</FieldLabel>
              <div
                data-testid="sheet-facts-daily"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
                  gap: theme.sizing.scale500,
                  minWidth: 0,
                }}
              >
                <Fact label="Order days" daily>
                  {pattern.days.length > 0 ? pattern.days.join(' · ') : pattern.cadence}
                </Fact>
                {/* THE USUAL ORDER IS A SENTENCE, so it takes a sentence's room (§42.1). Cut into
                    a 150px cell it would be three lines of two words, which is a fact made
                    unreadable to keep a grid tidy. */}
                <Fact label="Usual order" span={2} daily>
                  <span style={{ minWidth: 0 }}>{usual}</span>
                </Fact>
                {/* THE HOUR THEY ASKED FOR IS A FACT SOMEBODY WAS TOLD (§122). It arrives on the
                    phone — «from now on, eight» — and it stood here as text. It is the field now;
                    clearing it puts them back on the house's own run, which is what §21 says an
                    account that asked for nothing takes. */}
                <Fact label="Requested delivery time" daily field>
                  {/* THE HOURS THE HOUSE ALREADY DELIVERS IN ARE THE LIST (E200.07 · §196.1.2).
                      An hour is the house's own material, so the field offers the windows other
                      accounts already asked for and takes a new one the moment it is typed. */}
                  <LiveField
                    id="slot"
                    label="Requested delivery time"
                    hideLabel
                    value={customer.slot ?? ''}
                    suggestions={cast.customers.map((account) => account.slot ?? '')}
                    placeholder="Use the standard delivery run"
                    optional
                    size="compact"
                    inputTestid="slot-value"
                    listLabel="Delivery times the house already keeps"
                    onCommit={({ value }) => { if (!saveAccount({ slot: value })) return 'Saving this delivery time stalled. Keep this customer open and try again.'; }}
                  />
                </Fact>
              </div>
              </section>

        <section data-testid="sheet-commercial" style={detailsCard}>
                <FieldLabel>Account</FieldLabel>
              <div
                data-testid="sheet-facts-account"
                style={{
                  display: 'grid',
                  /* THE BAND IS ONE ROW IN THE PANE IT WAS DESIGNED FOR. At 130 the four standing
                     facts took three tracks in a 640 pane and orphaned «Tarifa» onto a line of its
                     own, which turns a dense band back into a form. Four tracks and three gaps fit
                     the pane at 110, and the grid still folds honestly on a handset. */
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: theme.sizing.scale500,
                  minWidth: 0,
                }}
              >
              {/* THE CHANNEL IS A CLOSED REGISTER, AND NOW IT FILTERS (E200.07 · §196.1). §122's
                  «tap it → it IMMEDIATELY shows the dropdown» is kept and made live: the field
                  stands where the value is read, offers the five answers the type allows the
                  moment it is touched, narrows them as the person types, and declines a word the
                  register does not hold. */}
              <Fact label="Order channel" field>
                <LiveField
                  id="channel"
                  declineSays="Choose a channel from the list."
                  label="Order channel"
                  hideLabel
                  value={customer.channel}
                  suggestions={[...channelsOfTrade()]}
                  placeholder="Choose where their orders arrive"
                  allowNew={false}
                  size="compact"
                  inputTestid="channel-value"
                  listLabel="Channels this trade uses"
                  onCommit={({ value }) => { if (!saveAccount({ channel: value as Customer['channel'] })) return 'Saving this channel stalled. Keep this customer open and try again.'; }}
                />
              </Fact>
              {(customer.channel === 'email' || email) && <Fact label="Email">
                <LiveValue value={email} label="Customer email" placeholder="Add an email address" testid="customer-email" width={260} onWrite={saveEmail} />
              </Fact>}
              {/* ⚠ THE VALUE NEEDS ITS OWN ROOM. «cash on delivery» wants 125px and a 110px track
                  gave it 91 at 1600, so the band printed «cash on deli» — a value cut inside a
                  register whose whole job is to say which of five terms stands. Two tracks. */}
              <Fact label="Payment terms" field span={2}>
                <LiveField id="settles" label="Payment terms" declineSays="Choose one of the trade’s payment terms." hideLabel value={customer.settles} suggestions={[...settlementsOfTrade()]} placeholder="Choose how they settle" allowNew={false} size="compact" inputTestid="settles-value" listLabel="Payment terms this trade uses" onCommit={({ value }) => { if (!saveAccount({ settles: value as Customer['settles'] })) return 'Saving these terms stalled. Keep this customer open and try again.'; }} />
              </Fact>
              {/* The connected system is the next operational fact after channel and payment.
                  Putting it before route ownership keeps its value clear of the phone dock on the
                  first view while leaving route and comercial doors intact below. */}
              {capabilityAvailable('erpAutomation') && <Fact label="Connected system" span={2}>
                <Door testid="erp-door" label={customer.erp ? `${customer.erp.name} · open the connection` : 'Connect a customer’s system'} onOpen={() => { window.location.hash = anchorFor('erp'); }}>
                  {customer.erp ? `${customer.erp.name} · Linked system` : 'Ready to connect'}
                </Door>
              </Fact>}
              {round && (
                <Fact label="Delivery run">
                  <TruckChip round={round} where={{ at: customer.at, name: customer.name }} />
                </Fact>
              )}
              {/* ── §43: NO DEAD NAMES, AND NOW THE NAME HAS TWO DOORS ────────────────────────
                  A comercial is TWO things a reader might want: the narrow (their thirty-eight
                  accounts, right here, instantly) and the PERSON (their card in Team — their role,
                  their run, whether they may edit the business). §53 made the second one an object,
                  so the fact carries both: the NAME narrows the book, because that is what a person
                  standing in the book almost always means, and «their card» walks to the object.
                  Two doors on one fact, and each one says which it is. */}
              {holder && (
                <Fact label="Account owner">
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                    {onHolder ? (
                      <Door
                        testid="holder-door"
                        label={`Show ${holder.name}'s customers`}
                        onOpen={() => onHolder(holder.name)}
                      >
                        {holder.name}
                      </Door>
                    ) : (
                      <span>{holder.name}</span>
                    )}
                    <Door
                      testid="holder-card-door"
                      label={`Open ${holder.name}'s card in Team`}
                      onOpen={() => openUser(holder.id)}
                    >
                      {/* AND IT STANDS AS A LABEL, NOT AS THE END OF A SENTENCE (AUDIT-2 C31 ·
                          §5 mechanics). «their card» was the only lowercase fragment on the sheet,
                          hanging under «Núria Aymerich» as though the name and it were one clause;
                          the two are two doors, and a door wears a label. */}
                      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
                        View team member
                      </span>
                    </Door>
                  </span>
                </Fact>
              )}
              {/* ⚠ THE TARIFA IS NOT A FACT ABOUT THEM, AND IT HAS LEFT THIS BAND (FEED-IA
                  §134.2). «The tarifa sits around the TOP as a control thing — better not around
                  states as it's a control thing.» Everything left in this run — the channel, the
                  van, whose account it is — is something that is TRUE of the account. A band is a
                  DECISION somebody takes here and changes here, and a control standing in a run of
                  states reads as a fourth thing that is merely true. It stands above the readings
                  now, on the sheet's own control ground, drawn by the same `TheirTarifa` the
                  reference sheet mounts — one object, one drawing, whichever door was used. */}
              </div>
              </section>
            </div>
    </div>
  );

  return (
    <>
      {/* ── THE HEAD ───────────────────────────────────────────────────────────────────────
          Who they are, then what an account is. The map rides the top-right corner as a small
          square, exactly as it does on the albarán (§39). */}
      <header
        data-testid="sheet-head"
        data-customer={customer.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale600,
          paddingBottom: theme.sizing.scale600,
          borderBottom: `1px solid ${theme.colors.borderOpaque}`,
          minWidth: 0,
        }}
      >
        {/* THE WAY BACK IS NAVIGATION, so it stands above the document rather than inside its
            head. On a desk the book never left, so nothing draws here at all. */}
        {onBack && (
          <div>
            <Button
              kind={KIND.tertiary}
              size={SIZE.compact}
              shape={SHAPE.circle}
              data-testid="sheet-back"
              aria-label={onBackLabel}
              onClick={onBack}
              overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', padding: 0 } } }}
            >
              <ChevronLeft size={24} aria-hidden />
            </Button>
          </div>
        )}
        {accountSaveError && (
          <p data-testid="customer-save-error" role="alert" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>
            {accountSaveError}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.sizing.scale600, minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700 }}>
            {/* ── REGION 1 · WHO THEY ARE ────────────────────────────────────────────────────
                THE NAME IS THE FIRST THING ON THE SHEET (§51.8: «the customer's NAME AND IDENTITY
                lead the sheet — at the TOP; the top currently spends itself on number and
                prev/next»). That complaint was recorded against the albarán's sheet and it is the
                same defect one surface over, so it takes the same answer (§45: the anecdote IS the
                spec): the flip stops being a full line above the identity and rides the name's own
                row, quiet, at the end of it. */}
            <div data-testid="sheet-identity" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}>
              {/* AND THE NAME IS LIVE (§122). It is the most authored fact on the sheet — a house
                  writes it, a house corrects it — and it stood as a heading nothing could touch.
                  One press puts the cursor in it; Enter or leaving the field writes it into the
                  fold the book itself is read through, so the row behind re-letters as it lands.
                  There is no Save: «you shouldn't need to confirm anything.» */}
              <h2
                data-testid="sheet-name"
                style={{ margin: 0, ...theme.typography.HeadingSmall, flex: 1, minWidth: 0 }}
              >
                <LiveValue
                  value={customer.name}
                  label="Customer name"
                  placeholder="Customer name"
                  testid="sheet-name-value"
                  size="default"
                  width={320}
                  onWrite={(name) => saveAccount({ name })}
                />
              </h2>
              {/* The flip walks the filtered book as drawn. Its two large chevrons are the whole
                  control: position counts add noise without helping the next or previous decision. */}
              {canWalk && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.sizing.scale100,
                    flex: '0 0 auto',
                    ...theme.typography.LabelXSmall,
                    color: theme.colors.contentTertiary,
                  }}
                >
                  <Button
                    kind={KIND.tertiary}
                    size={SIZE.compact}
                    shape={SHAPE.circle}
                    data-testid="sheet-prev"
                    aria-label="The customer before this one"
                    onClick={() => onWalk?.(-1)}
                    overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', padding: 0 } } }}
                  >
                    <ChevronLeft size={22} aria-hidden />
                  </Button>
                  <Button
                    kind={KIND.tertiary}
                    size={SIZE.compact}
                    shape={SHAPE.circle}
                    data-testid="sheet-next"
                    aria-label="The customer after this one"
                    onClick={() => onWalk?.(1)}
                    overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', padding: 0 } } }}
                  >
                    <ChevronRight size={22} aria-hidden />
                  </Button>
                </span>
              )}
            </div>

            {/* ── THE ACCOUNT'S OWN NUMBER (FEED-IA §134.2) ──────────────────────────────────
                «The account's PHONE NUMBER goes on the sheet.» It is the first thing anybody
                reaches for on a customer — a house rings them about a short delivery before it
                reads anything else — and this sheet, which is the customer's home, was the one
                that did not carry it. It stands with the NAME because it is identity, it is read
                by the same `accountNumber` the reference sheet reads, and it is an `Atom`: one
                fact, never broken across two lines (§132.2). */}
            <span
              data-testid="sheet-number"
              style={{ ...theme.typography.LabelMedium, color: theme.colors.contentPrimary, minWidth: 0 }}
            >
              <Atom>{accountNumber(customer)}</Atom>
            </span>
            </div>

            {/* ── REGIONS 2 AND 3 · TWO REGISTERS, NOT NINE EQUAL CELLS (§51.18, §42.1) ───────
                What matters DAILY leads, at the sheet's big step: the days they order on, what
                they typically take, the hour they asked for, and whether they run a system of
                their own. The account's STANDING facts — channel, van, comercial, band — follow
                under a rule, denser and a step down, because they are what the account IS rather
                than what this morning needs. «Make the actually-important thing the important
                thing»: nine cells at one size made a form out of two questions.
                EVERY VALUE IS STILL NAMED ABOVE ITSELF, so a stranger can say what every word on
                the sheet is without decoding a run-on line. */}
          </div>

          <WhereSquare customer={customer} />
        </div>
        <div
          data-testid="sheet-bar"
          style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0 }}
        >
          <span data-testid="sheet-bar-channel" style={{ flex: 1, minWidth: 0, ...theme.typography.LabelSmall, color: theme.colors.contentPrimary }}>
            Orders by {customer.channel}
          </span>
          {editingEmail && <Input
            autoFocus
            type="email"
            value={emailDraft}
            aria-label="Customer email"
            placeholder="name@example.com"
            onChange={(event) => setEmailDraft(event.currentTarget.value)}
            onBlur={() => { saveEmail(emailDraft); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); saveEmail(emailDraft); }
              if (event.key === 'Escape') { event.preventDefault(); setEditingEmail(false); setEmailDraft(email); setAccountSaveError(null); }
            }}
            overrides={{ Input: { props: { 'data-testid': 'customer-email-input', autoComplete: 'email' } }, Root: { style: { flex: '1 1 220px', minWidth: 0 } } }}
          />}
          {/* §202.3 — the act always has somewhere to go: with sending unverified it opens the
              email inside the app, so this control is live in every posture. */}
          <Button kind={KIND.primary} size={SIZE.compact} data-testid="sheet-bar-act" onClick={contact}>
            {contactWords}
          </Button>
        </div>
      </header>

      {/* ══ THE SHEET IS ONE (FEED-IA §137.1) ═══════════════════════════════════════════════
          «Oh right, the customer sheet is ONE.» — Peter, 2026-08-30.

          WHAT USED TO STAND BETWEEN THIS COMMENT AND THE MAIL BLOCK, and why none of it does now:
          a `sheet-controls` card holding the tarifa, a `sheet-record` block drawing §42.2's river
          cards, and a `sheet-numbers` block folding the account's arithmetic a second time. Every
          one of those was a SECOND DRAWING of something `customer-profile.tsx` already drew, so an
          account opened from the product sheet's buyer list and the same account opened from this
          book answered the same questions in two grammars — measured on the bundle and standing as
          an OWED finding in `drive-122.py` («TWO CUSTOMER SURFACES») until §137 ruled on it.

          THE BODY IS `CustomerRecord` NOW, and the overlay mounts the identical component: the
          tarifa as the sheet's one control, the twelve-month shape, the leaderboard, §127.3's
          TWO-TENSE history with its dots and its «Why?» doors, the numbers, the fingerprint, the
          complaints, the menu and the readings. What stays this surface's own is the BOOK'S
          CHROME — the name and the flip above, the mailbox and the sticky bar below — because
          those are facts about standing in the book, not facts about the customer.

          §42.2'S RIVER CARDS ARE REPEALED HERE, and the repeal is stated in full at
          `CustomerRecord`: the two-tense list carries every fact the cards carried on this surface
          (the day, the state, the money, the door onto the same albarán) plus the year behind
          them, the one red claim and the reasoning door. Mounting both would have printed one
          account's albaranes twice. The river still draws its own rows with `RiverRow`; nothing
          about the order being ONE OBJECT everywhere has moved. */}
      <CustomerRecord cast={cast} customer={customer} accountDetails={accountDetails} />

      {/* ── THEIR MAIL, WHERE THE MAILBOX IS THE CONVERSATION (§42) ────────────────────────
          The lead said «their orders arrive on mail, so the thread is the mailbox» — which the
          heading, the rows and the button underneath it all say better (§51.7). The act stays; the
          sentence goes. Base's own rule for a secondary button beside the thing it acts on: no
          noun repeated back at the reader — «Write to them» is the verb and its object, and the
          object here is a person rather than the block. */}
      {byMail && (
        <Block testid="sheet-mail" title="Emails">
          {mail.map((message) => (
            <MailRow key={message.id} mail={message} onOpen={message.sale ? () => openMailHistory() : undefined} />
          ))}
        </Block>
      )}

      {/* ── §196.6 · §246 · THE PHONE RAIL, BESIDE THE MAILBOX ──────────────────────────
          It stands for every account that HAS a number to reach — a saved one, or the number a
          telephone account is reached on (§196.6). The rail's own standing is what states the
          connection, so it survives a service that is out of reach; what it may never do is stand
          on a WhatsApp- or email-only account, where it drew a Calls rail, an identity card and a
          `/phone/calls` read about a number the house never held. */}
      {voiceNumber && (
        <CallsBlock customer={customer} number={voiceNumber} />
      )}

      {byMail && <Compose
        customer={customer}
        recipient={email}
        source={replySource}
        subject={replyMail?.subject ?? 'Original subject unavailable'}
        outbound={outboundAvailable}
        isOpen={writing}
        onClose={() => setWriting(false)}
      />}

    </>
  );
}

/* ── THE SURFACE ──────────────────────────────────────────────────────────────────────────── */

export default function Customers() {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { derived } = useConfig();
  const cast = derived.cast;
  const edits = useDay(cast.sector);
  const grants = useGrants();
  const { pricing: pricingAvailable } = useWorkspaceCapabilities();

  const today = todayId(cast);
  /** the house's own clock, so a mail sent from this sheet is stamped the morning's hour and never
   *  the machine's — the same reading Sales takes (§26.6) */
  const now = nowOf(cast);
  /* ── THE WINDOW THE BOOK COUNTS IN (FEED-IA §60.3 · §73.3 · THE-CUMULATIVE-AUDIT-2 C2) ────────
   * The month key is `monthKeyOf`'s, and it is `monthKeyOf`'s because the app writes a day in TWO
   * forms and this line is where the book meets both. `todayId` hands World A's «2026-08-22»;
   * splitting that on «.» yielded '' — a window that no albarán in either form can match — so
   * `monthOf` folded nothing and all 296 rows of the book read «0,00 € this month» beside a sheet
   * listing four albaranes of the very same account, and beside a seat ranking that account at
   * «6 albaranes · 10.222 €». A first login met three hundred customers each apparently worth
   * nothing, which is the opposite of §73.3's «has to feel smart from the onset».
   *
   * ONE READING, THREE SURFACES. `customer-profile.tsx` and `insights.ts` already take the window
   * this way, so taking it here makes the row, the sheet and «Tus datos» one opinion about one
   * record rather than three (§60.3 — the projection is the SAME analysis landed on the object). */
  const month = monthKeyOf(today);
  const multiTier = isMultiTier(cast);

  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants]);

  /** THE BOOK, IN THE ORDER A BOOK IS IN. Spanish collation, because the names are Catalan and
   *  «Ñ» has a place of its own in it.
   *
   *  AND IT IS THE BOOK AS A HAND HAS WRITTEN IT (§122). `accountOf` folds what was typed on the
   *  sheet over what the cast was seeded with — the `bandOf` pattern exactly — so a renamed
   *  account re-letters, re-sorts and re-searches in the same breath, and the sheet a name opens
   *  is the edited object rather than the record behind it. Untouched accounts come back as the
   *  SAME OBJECT, so nothing downstream that memoises on identity pays for this. */
  const accounts = useCustomerEdits();
  const book = React.useMemo(
    () => cast.customers.map(accountOf).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [cast, accounts],
  );

  /** Their live sales, folded once — the sheet reads its customer's out of this rather than
   *  filtering three hundred rows every time somebody presses a name. */
  const liveByCustomer = React.useMemo(() => {
    const by = new Map<string, Sale[]>();
    for (const s of sales) {
      const at = by.get(s.customer.id);
      if (at) at.push(s);
      else by.set(s.customer.id, [s]);
    }
    return by;
  }, [sales]);

  /** THE MONEY FACT ON EVERY ROW, counted once per fold. `monthOf` reads the record; the live rows
   *  are what today has added to it, and the two are the same kind of fact (§37.6). */
  const months = React.useMemo(() => {
    const out = new Map<string, MonthSpend>();
    for (const c of book) {
      out.set(c.id, monthOf(cast, c, month, liveByCustomer.get(c.id) ?? []));
    }
    return out;
  }, [cast, book, month, liveByCustomer]);

  /* ── THE WORD (FEED-IA §35.1) ────────────────────────────────────────────────────────────
   * «Filter-as-you-type in Sales, in customers, and in products. Three homes, one grammar.» The
   * words a customer answers to are the words the row already says out loud — their name, whose
   * account it is, the run, the tarifa, the channel — plus the two a person actually remembers
   * when they cannot remember any of those: the town the van goes to, and the van's number. */
  const [query, setQuery] = React.useState('');
  const terms = React.useMemo(() => termsOf(query), [query]);
  const searching = terms.length > 0;

  /* ── THE READINGS, FOLDED ONCE (FEED-IA §60.3 · THE-DATA-CANON §2.0.e) ────────────────────
   * Every reading in the book, computed in one pass off the same `sales` this surface already
   * folded, and indexed by customer. Three hundred rows may not each run their own analysis: that
   * is the linear scan §31.1 is about, and it would also make the row and the seat two separate
   * opinions about one record. */
  const readings = React.useMemo(() => {
    const out = new Map<string, AttentionReading>();
    for (const r of attentionReadings(cast, sales)) out.set(r.customer, r);
    return out;
  }, [cast, sales]);

  /* ── THE NARROWS (§35.1's chip grammar, carrying insight) ─────────────────────────────────
   * «Para atender» is the calls to make; «Con cambios» is what moved. Choosing one thins the book
   * to the accounts carrying that reading — insight landing as a FILTER on working objects rather
   * than as a dashboard, which is the §61 law honoured: glance, act, next. The seat deep-links
   * here with a narrow already on. */
  const [narrow, setNarrow] = React.useState<'attend' | 'changes' | null>(null);

  /** how many accounts each narrow would hold — the chip carries the count, so a person knows what
   *  pressing it costs before they press it (and a narrow that would hold nothing draws nothing) */
  const attend = React.useMemo(
    () => [...readings.values()].filter((r) => NARROW_KINDS.attend.includes(r.kind)).length,
    [readings],
  );
  const changes = React.useMemo(
    () => [...readings.values()].filter((r) => NARROW_KINDS.changes.includes(r.kind)).length,
    [readings],
  );

  React.useEffect(() => {
    const read = () => {
      const parts = window.location.hash.replace(/^#\/?/, '').split('/');
      if (parts[0] !== 'customers' || parts[1] !== 'narrow') return;
      const want = parts[2];
      if (want === 'attend' || want === 'changes') setNarrow(want);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const index = React.useMemo(() => {
    const out = new Map<string, string[]>();
    for (const c of book) {
      const holder = comercialOf(cast, c);
      out.set(
        c.id,
        wordsOf([
          c.name,
          holder?.name,
          c.channel,
          c.zone,
          zoneNameOf(c.zone),
          c.truck === undefined ? undefined : `truck ${c.truck}`,
          multiTier ? tierNameOf(cast, c.tier) : undefined,
          c.slot,
          c.erp?.name,
        ]),
      );
    }
    return out;
  }, [cast, book, multiTier]);

  const shown = React.useMemo(() => {
    const kinds: ReadingKind[] | null = narrow ? NARROW_KINDS[narrow] : null;
    return book.filter((c) => {
      if (searching && !matches(terms, index.get(c.id) ?? [])) return false;
      if (!kinds) return true;
      const r = readings.get(c.id);
      return Boolean(r && kinds.includes(r.kind));
    });
  }, [searching, book, terms, index, narrow, readings]);
  const letters = React.useMemo(() => byLetter(shown), [shown]);

  /* ── THE SELECTION ───────────────────────────────────────────────────────────────────────
   * THE SHEET IS ALWAYS THERE ON A DESK (§17.1, and §38's panes make it structural — a pane with
   * nothing in it is a hole in the layout). It opens on somebody who needs the person: the first
   * account in the book with a sale standing on it, else the head of the book. The phone keeps
   * push-and-back, so nothing is picked for it. */
  const [picked, setPicked] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPicked(null);
    setQuery('');
  }, [cast]);

  React.useEffect(() => {
    if (phone || picked !== null || shown.length === 0) return;
    const waiting = shown.find((c) => {
      const theirs = liveByCustomer.get(c.id) ?? [];
      return theirs.some((s) => isSticky(s, today) || isMessageOnly(s));
    });
    setPicked((waiting ?? shown[0]).id);
  }, [phone, picked, shown, liveByCustomer, today]);

  /** A word that thins the book has to thin the sheet's own list with it, so «3 of 12» is a number
   *  about what is on screen. Both writes belong to the press that caused them. */
  const search = (next: string) => {
    setQuery(next);
    setPicked(null);
  };

  /* ── THE SEAT THE ONE SEARCH SITS IN (FEED-IA §91.2) ──────────────────────────────────────
   * The book keeps §35.1's narrow — the word thins the book, the misses vanish, what matched is
   * marked — and gives up only the FIELD, which now opens in the middle of the screen with every
   * other search in the app. What is declared here is the word this surface is standing on and
   * the way to set a new one; the box reads both live, so typing in it narrows the book behind it
   * exactly as typing in the old seat did. */
  useSearchSeat({
    intent: 'customers',
    query,
    onQuery: search,
    fieldTestid: 'customers-search-field',
    /* ── THE LABEL IS THE PLACEHOLDER NOW, SO IT IS WRITTEN TO THE FIELD (§77.2) ─────────────
     * «Find a customer, a comercial, a run» was written for a seat that expanded to 240px on a
     * desk and was read as a hover label everywhere else. In the one box it is the string
     * standing in the field, and at 390 it came out cut mid-word — «…a comercial, a». Chrome
     * will not ellipsize a placeholder (the property is set, the browser clips anyway), so the
     * register's own answer applies: a slot long enough to clip is REWRITTEN, the way a heading
     * long enough to clamp is. It also reads better — a field naming its three indexes was the
     * enumerating habit the heading law bans. The comercial and the run are still searched. */
    label: 'Find a customer',
  });

  /* ── THE BOOK'S OWN PUBLIC WALK (FEED-IA §43, the scheme in `anchors.tsx`) ────────────────
   * «A customer's name — on a band card, a row, a whisper, a chat header, a product's buyer list —
   * opens the customer.» This is what those doors land on, and it is the SAME act as pressing the
   * name in the book: the account is picked, the sheet is theirs, and the book walks to their row
   * so a person arriving from another surface can see where in the alphabet they are.
   *
   * A WORD ON SCREEN MAY NOT HIDE THE PERSON A DOOR JUST ASKED FOR. Somebody filtering the book to
   * «Toni» and pressing a Can Solé name on a band card means Can Solé, so the search is released
   * on the way — the same law §27 gives the river's narrow, for the same reason: a door is urgent
   * and a filter is a convenience. */
  /** the row a door just walked to, so the scroll happens after it has been drawn */
  const [landed, setLanded] = React.useState<string | null>(null);

  const landOnCustomer = (id: string) => {
    if (!cast.customers.some((c) => c.id === id)) return;
    setQuery('');
    setPicked(id);
    setLanded(id);
  };
  useLanding('customer', landOnCustomer, () => setPicked(null));

  React.useEffect(() => {
    if (!landed) return;
    const walk = window.requestAnimationFrame(() => {
      const row = window.document.querySelector<HTMLElement>(`[data-customer-row="${landed}"]`);
      /* THE PANE IS WHAT MOVES ON A DESK and the page is what moves on a phone — the same two
         answers §38 gives everywhere. `nearest` keeps a row that is already in sight where it is,
         so arriving at somebody visible does not throw the book under the eye. */
      row?.scrollIntoView({ block: 'nearest' });
      setLanded(null);
    });
    return () => window.cancelAnimationFrame(walk);
  }, [landed, shown]);

  const at = shown.findIndex((c) => c.id === picked);
  const customer = at >= 0 ? shown[at] : null;

  const walk = (by: number) => {
    if (shown.length === 0) return;
    const from = at < 0 ? 0 : at;
    setPicked(shown[(from + by + shown.length) % shown.length].id);
  };

  /** THE CHAT DOOR (§39 — the bar's primary act). «Chats live ONLY in the widget. The Chats
   *  tab/area dies, desk and phone» (§42's commitments), so this focuses the thread and the widget
   *  is what answers, on both housings. There is nowhere else to send anybody. */
  const openChat = (id: string) => {
    openChatPanel(cast.sector, id);
  };

  /* ── THE ROOM FOR TWO PANES (FEED-IA §38) ─────────────────────────────────────────────────
   * `usePanes(true)` and the frame stops clamping and padding: it hands this surface the whole box
   * under the chrome — the remaining height, the remaining width — and the page itself stops
   * scrolling. The panes below are drawn inside that box and each one is its own scrollport.
   *
   * IT IS ASKED PLAINLY, ON THE FIRST PAINT. This file used to flip a one-tick state to get past
   * the frame's own per-area reset, because a parent's effect ran after its children's and an ask
   * that never changed was answered and then cancelled in the same mount. The frame answers at
   * render time now, so the workaround is gone and the ask is the sentence it should always have
   * been — and the measured pane height went with it, because the box is the frame's to give. */
  usePanes(!phone);

  /* ── ONE PANE AT A TIME UNDER THE STACKED RUNG (FEED-IA §103) ─────────────────────────────── */
  const stacked = useStacked();

  /* ── THE CORNER BELONGS TO THE VIEWPORT NOW (FEED-IA §83.3) ────────────────────────────────
     `useReservedLane(SHEET_PANE)` stood here so the frame would step the floating conversation
     left of this surface's sheet pane. The bubble is fixed to the viewport's own corner at every
     width now, so the room is made where it was always made on a phone: at the END OF THE BAR, in
     its own padding, at both widths (see the sheet bar below). */

  /** How tall the pane's own head is standing right now, so the letters park under it rather than
   *  behind it. Measured, because the search seat grows when it is used. */
  const headRef = React.useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = headRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => setHeadH(el.getBoundingClientRect().height));
    watch.observe(el);
    setHeadH(el.getBoundingClientRect().height);
    return () => watch.disconnect();
  }, [phone]);

  /* THE PHONE PUSHES, so it starts at the top of what it pushed. */
  React.useEffect(() => {
    if (phone && customer) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [phone, customer]);

  /* ── THE BOOK PANE ───────────────────────────────────────────────────────────────────────── */

  const list = (
    <div
      data-testid="book"
      data-count={shown.length}
      style={{
        /* ONE SCROLLPORT, FULL HEIGHT (§38). The grid below stretches its children, so the pane is
           exactly the box the frame gave the surface and never a pixel more; `minHeight: 0` is
           what lets a grid child holding a scrollport actually shrink to it. On a phone the page
           is the scrollport and this pane is simply the page — a pane inside a pane is exactly the
           horrible.
           ONE AXIS, AND ONLY WHERE THERE IS A PANE: `overflow-x: clip` beside a `visible` other
           axis computes THAT axis to clip as well, so a phone declaring it would cut its own list
           off at the fold. */
        boxSizing: 'border-box',
        minHeight: 0,
        overflowY: phone ? 'visible' : 'auto',
        overflowX: phone ? 'visible' : 'clip',
        minWidth: 0,
        /* BLOCK FLOW, DELIBERATELY. A flex column with a fixed height SHRINKS its items to fit:
           the pane held all 296 rows and squeezed every one of them, so a scrollport with three
           thousand pixels of book in it reported fifty-six pixels of scroll. Rows stack; the
           sticky head and the sticky letters work in normal flow exactly as well. */
      }}
    >
      {/* THE SEAT IS QUIET UNTIL IT IS USED (§35.1), and it stands at the head of the pane's own
          scroll rather than above it — the pane has one scrollport and this is inside it. */}
      <div
        ref={headRef}
        data-testid="book-head"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale400,
          padding: `${theme.sizing.scale200} ${theme.sizing[GUTTER]} ${theme.sizing.scale400}`,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
        <span
          data-testid="book-count"
          style={{
            ...theme.typography.LabelSmall,
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {shown.length} {plural(shown.length, 'customer')}
          {searching ? ` for “${query.trim()}”` : ''}
        </span>
        {/* THE BOOK'S SEARCH IS THE APP'S SEARCH (FEED-IA §91.2). The field that used to expand
            in this row now opens in the one modal, and this control is what summons it — a mark
            while the book stands whole, the standing word with its release while it does not. */}
        <SearchSummon
          intent="customers"
          label="Find a customer"
          testid="customers-search"
          query={query}
          onRelease={() => search('')}
        />
      </div>

      {/* ── THE INSIGHT NARROWS (FEED-IA §60.3 · §35.1's chip grammar) ──────────────────────────
          An ACTIVE NARROW MUST STAY VISIBLE (§51.25's own clause): a book that is quietly filtered
          is a book that has lied about how many customers you have. The chips ride the pane's own
          sticky head, so whatever is narrowing the book is on screen while you scroll it — and
          pressing a lit chip puts the whole book back.

          They are the projection's daily face: «Your data» computes the readings, the seat
          deep-links here with one of these on, and the person works the shortened book. Insight as
          a filter on working objects, which is fast where a dashboard is a detour. */}
      {(attend > 0 || changes > 0) && (
        <div
          data-testid="insight-narrows"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale300,
            flexWrap: 'wrap',
            padding: `0 ${theme.sizing[GUTTER]} ${theme.sizing.scale400}`,
            minWidth: 0,
          }}
        >
          {attend > 0 && (
            <span data-narrow="attend" data-on={narrow === 'attend' ? 'yes' : 'no'}>
              <Button
                kind={narrow === 'attend' ? KIND.primary : KIND.secondary}
                shape={SHAPE.pill}
                size={SIZE.mini}
                data-testid="narrow-attend"
                onClick={() => { setNarrow(narrow === 'attend' ? null : 'attend'); setPicked(null); }}
              >
                Need attention · {attend}
              </Button>
            </span>
          )}
          {changes > 0 && (
            <span data-narrow="changes" data-on={narrow === 'changes' ? 'yes' : 'no'}>
              <Button
                kind={narrow === 'changes' ? KIND.primary : KIND.secondary}
                shape={SHAPE.pill}
                size={SIZE.mini}
                data-testid="narrow-changes"
                onClick={() => { setNarrow(narrow === 'changes' ? null : 'changes'); setPicked(null); }}
              >
                Changed · {changes}
              </Button>
            </span>
          )}
        </div>
      )}

      {searching && shown.length === 0 && (
        <div
          data-testid="book-empty"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale200,
            padding: `${theme.sizing.scale900} ${theme.sizing[GUTTER]}`,
            minWidth: 0,
          }}
        >
          {/* BASE'S EMPTY-STATE GRAMMAR (§58.2), and the house rule that a line never spends
              itself on a negative: Base offers a headline that says WHY the screen is empty or
              one that says WHAT TO DO, and only the second can be written without a negative —
              so the act is the headline, the body says what answers, and the count above has
              already said nought. «0 matches for “x”» was the robotic label the guidance names.
              The catalogue's own empty state is these same two lines. */}
          <span style={theme.typography.LabelLarge}>Try another word for “{query.trim()}”</span>
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            A name, a comercial, a run or a truck number all find them.
          </span>
        </div>
      )}

      {letters.map((group) => (
        <React.Fragment key={group.letter}>
          <LetterHead letter={group.letter} held={group.customers.length} under={phone ? 0 : headH} />
          {group.customers.map((c) => (
            <CustomerRow
              key={c.id}
              customer={c}
              cast={cast}
              month={months.get(c.id) ?? { month, figure: 0, albaranes: 0 }}
              terms={terms}
              selected={c.id === picked}
              pricesVisible={pricingAvailable}
              multiTier={multiTier}
              reading={readings.get(c.id) ?? null}
              onPick={() => setPicked(c.id)}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );

  /* ── THE SHEET PANE ──────────────────────────────────────────────────────────────────────── */

  const sheet = customer && (
    <div
      data-testid="customer-sheet"
      data-sheet-customer={customer.id}
      style={{
        /* ONE SCROLLPORT, EDGE TO EDGE, NO FRAME OF ITS OWN (§38). The hairline against the book
           is the only edge it has, and on the phone it has none because the book is not beside it. */
        boxSizing: 'border-box',
        minHeight: 0,
        overflowY: phone ? 'visible' : 'auto',
        overflowX: phone ? 'visible' : 'clip',
        borderLeft: phone || stacked ? undefined : `1px solid ${theme.colors.borderOpaque}`,
        paddingLeft: phone ? 0 : theme.sizing[SHEET_GUTTER],
        paddingRight: phone ? 0 : theme.sizing[SHEET_GUTTER],
        paddingTop: theme.sizing.scale300,
        /* The page scrolls on a phone. This is end clearance, not a second scrollport: it lets
           the last pricing, order or product relationship rise above the sticky contact bar and
           the fixed navigation/launcher chrome. */
        paddingBottom: phone ? `calc(${PHONE_SHEET_END_CLEARANCE}px + env(safe-area-inset-bottom, 0px))` : undefined,
        minWidth: 0,
      }}
    >
      {/* THE COLUMN INSIDE THE SCROLLPORT, and it is a column for exactly one reason: the bar
          takes `margin-top: auto` so a short sheet still rests it on the pane's own foot. It is
          NOT the scrollport — a flex box that is also the scrollport shrinks every block in it to
          fit the viewport, which is how a document becomes a squeezed diagram. `min-height: 100%`
          gives the auto-margin something to push against and lets the content grow past it. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing[BLOCK_AIR],
          minHeight: phone ? undefined : '100%',
          minWidth: 0,
        }}
      >
        <CustomerSheet
          cast={cast}
          customer={customer}
          theirs={liveByCustomer.get(customer.id) ?? []}
          basket={basketOf(cast, customer)}
          today={today}
          now={now}
          canWalk={shown.length > 1}
          onWalk={walk}
          /* THE WAY BACK STANDS WHEREVER THE BOOK IS BEHIND THE SHEET (FEED-IA §103) */
          onBack={phone || stacked ? () => setPicked(null) : undefined}
          onChat={() => openChat(customer.id)}
          onHolder={search}
        />
      </div>
    </div>
  );

  return (
    <Page title={meta.title} fill={!phone}>
      {phone ? (
        customer ? sheet : list
      ) : (
        <div
          data-testid="customers-panes"
          style={{
            /* THE SURFACE IS THE BOX (§38): the grid fills what the frame handed it, and its two
               children stretch to that height — which is what makes each of them a pane rather
               than a card sitting in a column. */
            flex: '1 1 auto',
            minHeight: 0,
            display: 'grid',
            /* THE SALES GRAMMAR EXACTLY (§37.6): the list holds the reading column and the sheet
               takes the panel's own 640, so a person moving between the two surfaces moves between
               two readings of one layout rather than between two layouts. */
            /* THE BOOK HAS A FLOOR. `1fr` beside a 640 panel is «whatever is left», and whatever
               is left was 110px — a column of names ellipsised to two letters. A minimum on the
               list means the SHEET is what yields when the room runs out, which is the right way
               round: a name you cannot read is a book you cannot use. */
            /* ── AND UNDER 1096 THERE IS ROOM FOR ONE (FEED-IA §103) ──────────────────────
               «They should just resize with my browser.» The floor above is what two panes cost;
               below the continuum's stacked rung the book steps aside while a customer is open and
               the sheet takes the box, in the desk's own chrome. */
            gridTemplateColumns: stacked
              ? 'minmax(0, 1fr)'
              : `minmax(340px, 1fr) minmax(0, ${SHEET_PANE}px)`,
            minWidth: 0,
          }}
        >
          {(!stacked || !customer) && list}
          {(!stacked || customer) && sheet}
        </div>
      )}
    </Page>
  );
}
