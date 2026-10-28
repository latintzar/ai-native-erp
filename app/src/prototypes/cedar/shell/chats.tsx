/* CHATS — the comms, as a widget that overlays the work. THE ONLY DOOR THERE IS.
 *
 * ═══ THE COLUMN DIED HERE (FEED-IA §15, §22.1) ═════════════════════════════════════════════
 * «Maybe chats should be an overlay with a widget. Nothing more, nothing less. With very good
 * hiding.» And then, when the column was still on screen: «I thought we'd say the chat would be an
 * intercom type thing? Overlaid?»
 *
 * So on the desk the chats are no longer a third column squeezing the work. They are a LAUNCHER —
 * one round mark at the bottom right — and a PANEL that pops over the content when it is pressed.
 * The frame reserves nothing for them, which is what gives the desk back its room: a list and its
 * detail, both at full width.
 *
 * THE HIDING IS THE DESIGN. Dismissed means GONE: Escape, a click anywhere outside it, or the
 * launcher again, and the panel leaves the screen completely — no rail, no slim edge, no residue.
 * What stays is the launcher, which is the door and nothing else. Dismissing also lets go of the
 * conversation that was open, so the next press lands on the list and the next «Open the chat» from
 * an albarán lands on ITS customer.
 *
 * ═══ AND THE TAB DIED TOO — THIS IS THE WHOLE OF CHATS NOW (FEED-IA §42, decided) ═══════════
 * «Chats should only live in the widget… a button to Expand… search and filtering in that widget…
 * we shouldn't really have a chat ping — let's commit to that.» Four commitments, and every one of
 * them lands in this file:
 *
 *   ONE DOOR      The Chats area is parked and its seat is off both navigations. The PHONE gets
 *                 this same widget: the launcher floats above the bottom row, and the panel fills
 *                 the screen when it opens. One composition, two housings, no second copy.
 *   THE EXPAND    A mark in the header grows the panel to the whole viewport and gives it back.
 *                 FULLSCREEN IS ASKED FOR, NEVER REMEMBERED.
 *   THE NARROWS   The search seat (§35.1) keeps its place in the list header, and a quiet filter
 *                 row under it carries the two narrows a conversation list actually has: what is
 *                 waiting on a person, and whose accounts these are (§12).
 *   ONE COUNTER   §42 said «no chat ping» while the band's «Messages · N» row existed, because two
 *                 places counting one thing is the app asking to be looked at twice. §75.2 removes
 *                 that row — «it should just be a number on the widget» — so the count MOVED here
 *                 rather than multiplied: the launcher wears it, and it is the only place in the
 *                 app that says how many conversations are waiting.
 *
 * ═══ AND THE WIDGET BREATHES (FEED-IA §77.4, §77.5) ═════════════════════════════════════════
 * «When it's in "all chats" it should be the bigger modal thing, and when it's a single chat it's
 * just the compact chat sized one» — two sizes, deliberate, the corner held. And the order a
 * conversation is forming stands PINNED above the composer rather than inline in the stream, with
 * the tool calls that moved it said in the stream beside the messages that caused them. See the
 * two blocks that build them, below.
 *
 * ═══ THREE PIECES, AND THEY ARE THE SHIPPED ONES ═══════════════════════════════════════════
 * Message for a turn, Composer for the bar, the Voice Button in the composer's voice slot. This
 * file decides where they live and what the conversation is about; it reimplements none of them.
 *
 * ═══ THE PAPER ═════════════════════════════════════════════════════════════════════════════
 * A thread stands on the dotted paper — the chat's own ground, and the texture §5.2 lifts into
 * the albarán when a customer's message is embedded there. The list stands on plain stock,
 * because a list is a list.
 *
 * ═══ COMPACT TOOL TRAILS (FEED-IA §142) ═══════════════════════════════════════════════════
 * Messages keep their channel grammar. Tool results are short, linked lines on the talk's own
 * paper; the order alone keeps its card. A concern is a dismissible sentence ABOVE that card,
 * so the person can understand the pause without opening another object first.
 *
 * ═══ THE DESIGN PASS (FEED-IA §40, reference: Intercom via tSpoonLab) ═══════════════════════
 * «The chat can be better designed in terms of spacing, size etc.» What the reference actually
 * supplies, and what this file took from it:
 *
 *   THE PANEL      a wider box on a generous corner, so it reads as a surface rather than a
 *                  tooltip that grew. 400px on `radius500`, one scrollport inside it (§38).
 *   THE HEADER     a real one, at both altitudes: the list says «Chats» at LabelLarge with its
 *                  unread said quietly beside it; a thread says the customer's NAME with one
 *                  sub-line — the channel and the person who holds the account (§12). Back and
 *                  close are marks on real 36px targets, never words.
 *   THE BUBBLES    padding a finger's width rather than a hairline's, and THE STAMPS COME OFF
 *                  THEM. An hour printed on every bubble in a run is the same fact four times;
 *                  the run carries ONE whisper above it and the bubbles say only what was said.
 *   THE EMBEDS     a register of air above and below, and a left edge shared with the bubble
 *                  column, so a document in the talk reads as a document and not as clutter.
 *   THE COMPOSER   a soft pill on Base's top radius, the mic seated with room beside it, and a
 *                  dock whose height NEVER MOVES — see `ComposerDock` for the take's geometry.
 *   THE LAUNCHER   one control, two states: the conversation mark while the panel is away, a
 *                  chevron down while it is open — the reference's own swap, and the reason the
 *                  panel needs no second close anywhere near it.
 *
 * ONE MARK, TWO DIRECTIONS. Back and close are the same chevron (§30: one icon, one meaning) —
 * pointing left it says «the list is that way», pointing down it says «put this away», and both
 * are the one thing the reference does with it.
 *
 * ═══ SUPER-INTERCOM (FEED-IA §46.2) ════════════════════════════════════════════════════════
 * «The chat is super-Intercom: studied against Intercom's own design assets, not a vibe of them —
 * and then past them where we are stronger.» Studied, and answered move by move:
 *
 *   TAKEN — THE FACE.        Their Messages list carries an avatar on every row and their own
 *                            stated principle for it is «it's personal: see the name and face».
 *                            Ours had a name and no face, at both altitudes. Base's own Avatar,
 *                            initials on `backgroundInversePrimary`, so no colour was invented.
 *   TAKEN — THE ENTRANCE.    «Staggered entrance animations and transitions, to maximise
 *                            perceived speed» is their own account of how the Messenger opens.
 *                            Ours simply appeared. It now grows out of the launcher's corner on
 *                            Base's own step and Base's own decelerating curve.
 *   TAKEN — DELIVERY.        Their bubbles report the journey. Ours now do, on the one side this
 *                            app owns the journey for: the person's own sent messages.
 *   HELD — THE PREVIEW ORDER. They put the MESSAGE on line one and «who · when» under it, which
 *                            is notification grammar and right for an end user with four
 *                            conversations. A comercial has 30–50 accounts (§12) and finds a
 *                            conversation BY CUSTOMER, so ours keeps the name on line one.
 *   DECLINED — THE COLOURED HEADER. Their newest Messenger leads with a brand-painted band. §40
 *                            scopes the borrowing precisely — «takes that bar for SPACING, SIZE
 *                            AND FINISH» — and paint is none of those. Ink stays the ink.
 *   DECLINED — THE HOME SPACE. Their Home exists upstream of conversations to deflect end users
 *                            into self-serve. This is a staff console: the list IS the work.
 *   DECLINED — RELATIVE TIME. «2h ago» reads better and cannot be checked. The list sorts on the
 *                            hour it prints, which is what lets a person verify the order.
 *   DECLINED — A TYPING INDICATOR. Nobody is typing on the other end: the customer is on
 *                            WhatsApp and Rocoto reads rather than types. The one machine state
 *                            we CAN observe is a recording being transcribed, and that is said.
 *   PAST THEM — VOICE AND TRANSCRIPT. Intercom's Messenger has no voice note; this house gets
 *                            them all morning. `media.tsx` holds that work, and `threads.ts`
 *                            folds the spoken words into the search index.
 *
 * ═══ AND THE WHATSAPP BEHAVIOURS (FEED-IA §47) ═════════════════════════════════════════════
 * «Customers get in on WhatsApp, so all of that behaviour has to still be there»: a reply aimed
 * at a message and carrying it, a reaction on a bubble, a photograph that opens. Each is a small
 * component in this file — `QuoteCard`, `ReactionChips`, `ReactionPicker`, `TurnActions` — and
 * each hangs on a field the turn already carries, so none of them is a second store.
 */
import { addressOf, openCustomer, openOrderLine, openProduct, useHistoryLayer, useRouteTransition } from '../anchors';
import { EmailConversation, EmailTurnCard } from '../email-thread';
/* §137.2 · the essentials a pointer at rest asks for, on the conversation's own head */
import { CustomerHoverCard } from '../customer-hovercard';
import * as React from 'react';
const ConnectedInbox = React.lazy(() => import('../connected-inbox').then(module => ({ default: module.ConnectedInbox })));
import { closeSupport, registerSupportCloser, supportSnapshot, supportSubscribe } from '../support';
import { ThemeProvider, useStyletron } from 'baseui';
import { Avatar } from 'baseui/avatar';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { ButtonGroup, MODE } from 'baseui/button-group';
import { Layer } from 'baseui/layer';
import { StatefulMenu } from 'baseui/menu';
import { StatefulPopover, PLACEMENT, TRIGGER_TYPE } from 'baseui/popover';
import { Figure } from '../figure';
import { OverlayCard } from '../../../rocoto/overlay-card';
import { Count } from '../glyphs';
import { adoptLine, amountWords, chooseLineSku, ghostOf, isSourceMessage, nearWordOf, NON_SKU_LABEL, policyOf, RANK, rejectLineSkuChoices, removeLine, standingConcernsOf, todayId, type Sale } from '../sale';
import { ProductCode } from '../product-code';
import { channelTheme, dots, whatsappTheme } from '../../../rocoto-theme';
/* §196.7 · §246 · which channel each TURN travelled on, which channel this conversation answers
   on, and what the mic does there */
import {
  CONNECTIONS_WHATSAPP_HASH,
  accountChannelOf, channelOfTurn, channelWord, conversationEmailDoor, conversationSeatOf,
  isCallTurn, mailDoor, mailSubjectsShown,
  replyChannelOf, useDictation, whatsappDoor, dictationLine,
  type ChannelStanding, type ReplyChannel,
} from '../reply-channel';
/* §246 · §247.2 · the provider's own answer about this workspace, as one posture */
import { useWhatsAppCapability } from '../whatsapp-connection';
import { whatsappActs, whatsappStatusWord, WHATSAPP_OTHER_WORKSPACE, type WhatsAppPosture } from '../whatsapp-capability';
/* §246 · a telephone turn is a call record with its transcript, never a WhatsApp bubble */
import { CallDock, CallRecord, ChannelNote } from '../call-record';
/* §196.8 · the drafted reply — prefilled, selectable, deletable; nothing here sends */
import { deleteDraft, standingDraftOf, useDeletedDrafts, type ReplyDraft } from '../reply-draft';
import { FlagPill, flagOutline, flagStandingOf } from '../red-flag';
import { Message, AUTHOR } from '../../../rocoto/message';
import { Composer } from '../../../rocoto/composer';
import { StatefulVoiceButton } from '../../../rocoto/voice-button-kit';
import whatsAppLogo from '../../../assets/whatsapp-logo-green.png';
import Name from '../../../scenarios/shell/Name';
import { CIRCLE_MARK, Glyph, STEP } from '../glyphs';
import { Mark, matches, termsOf, wordsOf } from '../search';
import { comercialOf, type Cast, type Customer } from '../../../scenarios/data/cast';
import type { SectorId } from '../../../scenarios/meta';
import { nowOf } from '../day';
import { capabilityAvailable } from '../release-profile';
import { useWorkspaceCapabilities } from '../workspace-capabilities';
import { BOTTOM_NAV_HEIGHT } from './bottom-nav';
import { SearchSummon, useSearchSeat } from './search-modal';
import { embedLine, openSale, RING, RING_LOUD, type Embed, type OrderAct } from './embeds';
import { PictureLightbox, PictureReading, VoiceNoteBody } from './media';
import { TheatreControls, useTheatrePlayer } from './theatre-controls';
import { ProductFace } from '../product-face';
import { amendmentProduct, amendmentsOf, graduatedBase, graduatedProducts, useCatalogue } from '../catalogue';
import { useConfig } from '../config';
import {
  CHAT_PHOTOS,
  landTestVoice,
  lengthOf,
  markTestReading,
  openCount,
  pictureOf,
  pushTestDeskTurn,
  pushTestTurn,
  pushTestVoice,
  REACTIONS,
  spokenWords,
  startTestChat,
  toggleReaction,
  TRANSCRIBING_MS,
  turnWords,
  unreadCount,
  utterancesOf,
  openChat,
  openEmail,
  setChatIsScreen,
  type Picture,
  type Quote,
  type Thread,
  type ThreadOpening,
  type ThreadTest,
  type ThreadTurn,
  useThreadDraft,
  useThreads,
} from './threads';
import {
  announce, asWords, readTestMessage, subjectCustomer, Suggestions,
  suggestionsFor, TEST_DO, TEST_EVENTS, TestSelector, testHour, testLabel, TestViewTabs,
  useTestWorld,
  WhatsappPane,
  type TestMark, type TestReading, type TestSubject, type TestView,
} from '../test-chat';
import { TestPanel } from '../test-panel';
import { beatMs, planOf, useBeat, useTrace, type TraceRow } from '../thread-trace';
import { ConfidenceTick, actionOwed, useOwed } from '../tick';
import { AnxietyCard, ConcernNote } from '../anxiety';
import { activeAttentionConcernsOf } from '../attention-labels';
import { AttentionDot, waitingOnAPerson } from '../attention-dot';
import { dismissedNow, rememberAnxiety, useDismissals } from '../dismissals';
import { usePhone, usePhoneFloorHeight, useStacked } from './viewport';
import { PhoneKeypadMark } from '../phone-controller';
/* §246 · ONE DIAL DOOR. `openPhoneDial` decides between the route and the overlay host and reads
   the one phone capability on the way; a surface that writes the hash itself bypasses that. */
import { openPhoneDial } from '../phone-session';
import { accountNumber } from '../customer-profile';
import { CONNECTIONS_EMAIL_HASH, mailboxStanding, useEmailCapability, type EmailConnectionStatus, type EmailProvider } from '../email-provider';
import { ScopedConversationNoteLine, scopedConversationNoteStanding, useScopedConversationNotes } from '../scoped-conversation-note';

/* ── THE TWO MARKS THE PANEL NAVIGATES BY ─────────────────────────────────────────────────────
 * One chevron, turned. `caret` is the app's only chevron and it means «this way» everywhere it is
 * drawn (§30); a header needs exactly two directions and this is both of them, so no second mark
 * enters the vocabulary for a job the first one already does.
 */
function Chevron({ towards }: { towards: 'left' | 'down' }) {
  return (
    <span style={{ display: 'inline-flex', transform: towards === 'left' ? 'rotate(90deg)' : undefined }}>
      <Glyph id="caret" size={18} />
    </span>
  );
}

/** Header controls are icon-only 48px targets; their accessible name lives in aria/title. */
function HeaderButton({
  onClick,
  label,
  testid,
  children,
}: {
  onClick: () => void;
  label: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <span style={{ display: 'inline-flex', flex: '0 0 auto' }} title={label}>
      <Button
        kind={KIND.tertiary}
        size={SIZE.default}
        shape={SHAPE.circle}
        overrides={{ BaseButton: { style: { width: '48px', height: '48px' } } }}
        onClick={onClick}
        aria-label={label}
        data-testid={testid}
      >
        {children}
      </Button>
    </span>
  );
}

/** A real customer thread is read here and answered in its native channel. The only creation
 *  affordance Messages owns in this trial is the isolated test conversation. */
function NewTestChatAction({ onOpen }: { onOpen: () => void }) {
  return <HeaderButton onClick={onOpen} label="New test chat" testid="new-test-chat"><Glyph id="draft" size={STEP.small} /></HeaderButton>;
}

/** The supplied WhatsApp mark is a local product asset, never a generic chat glyph pretending
 *  to be the customer's actual channel. */
function WhatsAppMark({ size = 18, testid }: { size?: number; testid?: string }) {
  return <img data-testid={testid} src={whatsAppLogo} width={size} height={size}
    alt="WhatsApp" style={{ display: 'block', flex: '0 0 auto', objectFit: 'contain' }} />;
}

/* ⚠ `NativeChatHandoff` STOOD HERE, AND §196.7 TOOK ITS SEAT RATHER THAN ITS JOB.
 * It was the whole of E185's customer dock — «Messages is a review surface in the narrow trial…
 * it neither invents nor stores a reply» — a strip saying «Reply in WhatsApp» above a composer
 * that did not exist. §196.7 gives the person the composer, so the strip would have been a second
 * row naming the channel the send button now states in colour. The DOOR is not repealed: it lives
 * on `ChannelLine`, below, with the same `native-chat-handoff` identity, the same icon-free
 * «Open chat», and the same real web.whatsapp.com destination. Nothing here invents a reply or
 * claims a delivery; that clause of E185 stands untouched.
 */

/** The order pager uses a comfortable 48px target for rapid delivery-note review. */
function OrderPagerButton({ onClick, label, testid, children }: {
  onClick: () => void; label: string; testid: string; children: React.ReactNode;
}) {
  return <Button kind={KIND.tertiary} size={SIZE.default} shape={SHAPE.circle}
    overrides={{ BaseButton: { style: { width: '48px', height: '48px' } } }}
    onClick={onClick} aria-label={label} data-testid={testid}>{children}</Button>;
}

/* ══ THE RESERVATION — A NOTIFICATION IN THE CHATS MEANS EXACTLY ONE THING (FEED-IA §128.2) ══
 *
 * «There will be a notification that will appear in the chats, because ANY NOTIFICATION IN THE
 * CHATS MEANS THAT THEY NEED TO REPLY TO SOMETHING, which is only in this situation that we've
 * deferred. That's very, very, very elegant. // Make sure this is exactly how it is.»
 *
 * ⚠ WHAT THIS REPLACED, AND WHY IT HAD TO GO. The badge counted UNREAD — «the last message came
 * from the customer and nobody has opened the thread» — which is a fact about reading rather than
 * about owing, and it put a number on the launcher for conversations that wanted nothing at all.
 * §128.2 reserves the channel: the badge is the count of conversations where ROCOTO DEFERRED A
 * REPLY, and nothing else may light it. The elegance is that the badge's meaning never needs
 * reading — a number there is always the same sentence.
 *
 * IT IS `tick.tsx`'S ONE FOLD, so the badge, the row's own dot, the pinned order's tick and the
 * anxiety card cannot disagree — and a dismissal-with-why clears all four in the same frame,
 * because `actionOwed` consults the same record `waitingOnAPerson` does (§127.2's second exit).
 *
 * A TEST CONVERSATION NEVER COUNTS, which is `unreadCount`'s own law kept exactly (§10.7).
 */
const owesAReply = (thread: Thread): boolean =>
  !thread.test && [...thread.forming, ...thread.messageOnly].some((sale) => activeAttentionConcernsOf(sale).some((concern) => concern.kind === 'response'));

const replyOwedCount = (threads: Thread[]): number => threads.filter(owesAReply).length;

/* ── THE LIST ─────────────────────────────────────────────────────────────────────────────── */

/** THE APP'S OWN SEPARATOR, DRAWN RATHER THAN TYPED (AUDIT-2 C35). Facts standing in slots need a
 *  mark between them, and this app's mark is the middle dot it writes everywhere else. It is a
 *  span so the slots either side keep their own overflow rules, and `aria-hidden` because a
 *  screen reader is given three facts in order and a dot read aloud is furniture. */
function Between() {
  const [, theme] = useStyletron();
  return (
    <span aria-hidden="true" style={{ flex: '0 0 auto', color: theme.colors.contentTertiary }}>
      ·
    </span>
  );
}

/** One conversation: who it is with, the last thing said, when — and the mark that says it is
 *  their turn to read it. The mark is ink, because an unread message is nobody's act but the
 *  customer's; saffron stays reserved for what Rocoto did.
 *
 *  THE ROW AT DELIBERATE STEPS (FEED-IA §40.6, §33). Three sizes and nothing between them: the
 *  name at 16, what was said at 14, the hour and the flag at 12 — so the eye lands on the name,
 *  reads the sentence and takes the rest at a glance. The steps are Base's own, not a ramp
 *  invented here.
 *
 *  AND UNREAD IS WEIGHT, WHICH IN THIS APP MEANS INK (§40.6). Base has no bolder label at 16px
 *  and colour is not a status system, so the weight is the STRENGTH of the ink: a sentence
 *  nobody has read stands at full contentPrimary, a sentence already read recedes to secondary.
 *  The dot in the gutter says the same thing a second way, for the scan down the column.
 */
function ThreadRowButton({
  thread,
  current,
  terms = [],
  onOpen,
}: {
  thread: Thread;
  current: boolean;
  /** the words a person is searching customers by, so the ones that landed stand out (§35.1) */
  terms?: string[];
  onOpen: () => void;
}) {
  const [, theme] = useStyletron();
  /* ── WHETHER THIS CONVERSATION IS WAITING ON A PERSON (§128.2 · §127.3) ────────────────────
     `waitingOnAPerson` is the ONE fold that decides the claim, and a dismissal-with-why is an
     exit inside it — so `useAnxieties`/`useDismissals` under `useOwed` re-render this row the
     moment somebody answers, and the badge counting these rows agrees by construction. */
  /* THE RECORD IS A DEPENDENCY, not merely a subscription — a memo keyed on the thread alone
     would keep claiming a reply is owed for one render after somebody answered with a why. */
  const answered = useDismissals();
  /* ONE PREDICATE DECIDES WHETHER THIS CONVERSATION NOTIFIES, and it is the same one the launcher's
     badge counts — `owesAReply`. `waitingOnAPerson` then supplies the CLAIM: the sentence saying
     who is waiting and for what, which is the only thing a dot is allowed to be. Deciding the
     reservation here and counting it there would be two answers to one question, which is exactly
     the drift §128.2's elegance depends on not having. */
  const waiting = React.useMemo(
    () => {
      if (!owesAReply(thread)) return null;
      return [...thread.forming, ...thread.messageOnly].map((sale) => {
        const concern = activeAttentionConcernsOf(sale).find((item) => item.kind === 'response');
        return concern ? waitingOnAPerson(sale) ?? { kind: 'restraint' as const, why: concern.says } : null;
      }).find(Boolean) ?? null;
    },
    [thread, answered],
  );
  const [over, setOver] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  /* ── THE READING IS THREE FACTS, SO IT GETS THREE SLOTS (AUDIT-2 C35 · §77.2 · canon §4) ──────
     Fifteen rows of this list read «Read from WhatsApp as 5 lines for Thursday 21.08.» / «Read
     from email as 2 lines for Friday 22.08.» / «Read from portal as 4 lines for Friday 22.08.» —
     one sentence carrying three facts, stacked fifteen deep, and at 390 every one of them ran out
     of line and ellipsed. Prose in a scan column is the wall §75.8 names: the eye cannot compare
     row to row, because the fact it is comparing sits at a different character on every line.

     SO THE SENTENCE BECOMES ITS FACTS, IN COLUMN ORDER: the channel it came down, how many lines
     Rocoto read, and the day it is for. Nothing is invented and nothing is lost — the three come
     off the sale the readback embed already carries, and the sentence itself still stands whole in
     the conversation, on the readback card, which is where a sentence belongs.

     IT IS THE READING AND NOTHING ELSE. A customer's own words, a recording, a photograph — those
     are CONTENT and the row quotes them exactly as it always has. This slot changes only for the
     one preview that was a machine's sentence about three facts.

     THE OVERFLOW, DECLARED (§77.2): the line never wraps and the row never changes height. The
     channel and the count are bounded words and never yield; the DAY is the slot that gives, with
     an end ellipsis, because it is the one the whisper inside the conversation says again. */
  /* §143: the book previews the last actual message, never a tool/readback summary or its icon. */
  const previewRow = thread.last;
  const preview = previewRow ? turnWords(previewRow) : '';
  const mine = !!previewRow && previewRow.author !== 'received';

  return (
    <button
      type="button"
      data-thread={thread.id}
      data-unread={thread.unread ? 'yes' : 'no'}
      data-waiting={thread.waiting ? 'yes' : 'no'}
      /* THE ROW SAYS WHAT IT IS, so a drive — and any later surface — can ask which conversations
         are tests without reaching into a component's state (§10.7) */
      data-test={thread.test ? 'yes' : 'no'}
      /* what this conversation is carrying besides sentences (§46.2, §47.3) — the row states it,
         so «which of these has a recording in it» is answerable without opening all of them */
      data-carries={[
        thread.rows.some((r) => r.voice) ? 'voice' : '',
        thread.rows.some((r) => r.picture) ? 'picture' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-current={current ? 'yes' : 'no'}
      data-list-card="inset"
      data-focused={focused ? 'yes' : 'no'}
      /* THE RESERVATION, STATED (§128.2) — a drive reads what the row claims without reading a
         pixel, and the claim is the same one the launcher's badge is counting. */
      data-owes-reply={waiting ? 'yes' : 'no'}
      data-testid={`thread-${thread.id}`}
      onClick={onOpen}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.sizing.scale400,
        width: `calc(100% - ${theme.sizing.scale400})`,
        margin: `${theme.sizing.scale100} ${theme.sizing.scale200}`,
        boxSizing: 'border-box',
        textAlign: 'left',
        padding: `${theme.sizing.scale550} ${theme.sizing.scale400}`,
        border: `1px solid ${current || over || focused ? theme.colors.borderOpaque : 'transparent'}`,
        borderRadius: theme.borders.radius400,
        /* This is the list's inset hit card. Rest leaves the book transparent; current, hover and
           keyboard focus occupy this same rounded rectangle, so none of those states moves a row
           or turns the whole list into a selected table. */
        background: current || over || focused ? theme.colors.backgroundSecondary : 'transparent',
        color: theme.colors.contentPrimary,
        cursor: 'default',
        fontFamily: 'inherit',
        minWidth: 0,
        outline: focused ? `2px solid ${theme.colors.contentPrimary}` : 'none',
        outlineOffset: '-2px',
        boxShadow: current || focused
          ? `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 6%, transparent)`
          : 'none',
        transition: `background-color ${theme.animation.timing400} ${theme.animation.easeOutCurve}, border-color ${theme.animation.timing400} ${theme.animation.easeOutCurve}, box-shadow ${theme.animation.timing400} ${theme.animation.easeOutCurve}`,
      }}
    >
      {/* ── THE ROW'S ONE CLAIM (§128.2 · §127.3) ─────────────────────────────────────────────
          It used to be an UNREAD dot in ink — a fact about reading, on a conversation that may
          want nothing at all. §128.2 reserves this channel: a mark in the chats says «a reply is
          owed», and only Rocoto's own deferral may put one there. It is `attention-dot.tsx`'s
          primitive, so this row cannot invent a second red — and the seat stands whether or not
          the dot is in it, so a conversation that starts owing one does not move (§37.3). */}
      <span style={{ display: 'inline-flex', width: 8, marginTop: 14, flex: '0 0 auto', justifyContent: 'center' }}>
        <AttentionDot waiting={waiting} testid="thread-reply-dot" size={8} />
      </span>
      {/* ── THE FACE (the reference's own row) ────────────────────────────────────────────────
          Intercom's Messages list carries an avatar on every row, and the reason it works is not
          decoration: at a glance the column is people rather than text, and a conversation is
          found by WHO before it is found by what. Base's own Avatar with no `src` draws initials
          on `backgroundInversePrimary` — ink, out of the theme, so `?theme=proof` moves it and no
          colour has been invented for identity. */}
      <span aria-hidden="true" style={{ flex: '0 0 auto', display: 'inline-flex', marginTop: 2 }}>
        <Avatar name={thread.customer.name} size="scale900" />
      </span>
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale200,
          flex: 1,
          minWidth: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}>
          {/* the name is named, so a reader of this row — a person, a screen reader or a drive —
              can take the customer out of it without guessing which line of text is the name.
              The face beside it carries initials, and initials are a drawing, not a word. */}
          <span
            data-testid="thread-name"
            style={{ ...theme.typography.LabelMedium, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {/* ── A TEST WEARS ITS LABEL WHERE THE NAME GOES (THE CHECKPOINT §10.6) ────────────
                «Clearly label the thread: TEST · Emulating Restaurante X.» The label REPLACES the
                name rather than riding beside it, because a row that led with the customer would
                read as that customer's conversation for exactly as long as it takes to read the
                first word — and «visually unmistakable» has to survive a glance, not a study. */}
            {thread.test
              ? thread.test.label
              : terms.length > 0
                ? <Mark text={thread.customer.name} terms={terms} />
                : <Name of={thread.customer} />}
          </span>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto' }}>
            {thread.at}
          </span>
        </span>
        {/* ── WHAT WAS LAST SAID, WHATEVER CARRIED IT (FEED-IA §46.2, §47.3) ──────────────────
            A recording and a photograph are things said, so the preview quotes what they SAY —
            the transcript's first line, the words read off the label — with a mark in front to
            state which of the three it was. Quoting a voice note as «Voice note» would hide the
            one fact the row exists to carry, and leave a person opening the conversation to find
            out what it was about. */}
        <span
          data-testid="thread-preview"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale200,
            ...theme.typography.ParagraphSmall,
            color: thread.unread ? theme.colors.contentPrimary : theme.colors.contentSecondary,
            minWidth: 0,
          }}
        >
          {mine && (
            <span data-testid="thread-preview-ticks" aria-label="Sent and delivered" style={{ display: 'inline-flex', flex: '0 0 auto', letterSpacing: '-3px', paddingRight: 3 }}>
              <Glyph id="check" size={13} /><Glyph id="check" size={13} />
            </span>
          )}
          <span data-testid="thread-preview-words" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {preview}
          </span>
        </span>
        {/* §143: preview is only the last message; notification stays in its dot. */}
      </span>
    </button>
  );
}

/* ── THE NARROWS (FEED-IA §42: «search and filtering in that widget») ─────────────────────────
 * A search says «this one»; a narrow says «this kind». At 295 conversations they are different
 * acts, and the widget owes a person both.
 *
 * TWO NARROWS, AND THEY ARE THE TWO THE LIST ALREADY DRAWS. Every row carries a waiting flag and
 * every conversation belongs to whoever holds the account, so filtering by either one narrows the
 * list by a fact the person can already see on it — which is the test a filter set has to pass
 * before it earns a row of chrome. They COMPOSE, like the river's own date and «mine» (§32):
 * whose accounts, and what state those conversations are in, are different questions.
 *
 *   WAITING ON YOU   §9.3's own flag: a sale in the conversation is standing on a person's own
 *                    sentence. It is what the band's «Messages · N» row counts, so this is the
 *                    same work reached from the other side.
 *   WHOSE            §12: «the resolve work is per comercial… 30–50 customers each». The register
 *                    is CLOSED and READ OUT OF THE HOUSE'S OWN BOOK — only comerciales who hold a
 *                    conversation on this list, each one already counted, so nobody does the sum.
 *
 * A THIRD WAS LEFT OUT ON PURPOSE. «Unread» is a state the list already sorts the eye by — the dot
 * in the gutter and the full-strength ink — and §42 killed the chat ping for exactly the reason a
 * third narrow would bring it back: the app must not grow a second place that counts what is owed.
 *
 * THE GRAMMAR IS THE APP'S OWN. Base's `ButtonGroup` in radio mode at `mini` is what this app
 * already uses for a switch between postures of one thing (`detail.tsx`), and the whose-door is the
 * river's own scope door — a `who` mark, the name, the count beside it, a menu under it.
 */
type Narrow = 'all' | 'waiting';

const NARROWS: Array<{ id: Narrow; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'waiting', label: 'Waiting on you' },
];

type Holder = { id: string; name: string; count: number };

/** Who holds the accounts on this list, each with how many conversations they hold. */
function holdersOf(cast: Cast, threads: Thread[]): Holder[] {
  const seen = new Map<string, Holder>();
  for (const thread of threads) {
    const held = comercialOf(cast, thread.customer);
    if (!held) continue;
    const seat = seen.get(held.id) ?? { id: held.id, name: held.name, count: 0 };
    seat.count += 1;
    seen.set(held.id, seat);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function FilterRow({
  narrow,
  onNarrow,
  holders,
  holder,
  onHolder,
}: {
  narrow: Narrow;
  onNarrow: (next: Narrow) => void;
  holders: Holder[];
  holder: string | null;
  onHolder: (id: string | null) => void;
}) {
  const [, theme] = useStyletron();
  const held = holders.find((h) => h.id === holder) ?? null;

  return (
    <div
      data-testid="chats-filters"
      data-narrow={narrow}
      data-holder={holder ?? 'everyone'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale400} ${theme.sizing.scale600}`,
        minWidth: 0,
      }}
    >
      <ButtonGroup
        mode={MODE.radio}
        size={SIZE.mini}
        kind={KIND.secondary}
        selected={NARROWS.findIndex((n) => n.id === narrow)}
        onClick={(_e, i) => onNarrow(NARROWS[i].id)}
        aria-label="Which conversations"
      >
        {NARROWS.map((n) => (
          <Button key={n.id} data-testid={`chats-narrow-${n.id}`} overrides={{ BaseButton: { style: { whiteSpace: 'nowrap' } } }}>
            {n.label}
          </Button>
        ))}
      </ButtonGroup>

      <span style={{ flex: 1, minWidth: 0 }} />

      {holders.length > 1 && (
        <StatefulPopover
          placement={PLACEMENT.bottomRight}
          triggerType={TRIGGER_TYPE.click}
          /* the panel stands at 9 and Base mounts a layer with no rung of its own, so a menu opened
             from inside it would paint underneath the conversations it is filtering */
          overrides={{ Body: { style: { zIndex: 12 } } }}
          content={({ close }) => (
            <div
              data-testid="chats-holder-menu"
              onKeyDown={(e) => {
                if (e.key !== 'Escape' || e.defaultPrevented) return;
                e.preventDefault();
                close();
              }}
            >
              <StatefulMenu
                overrides={{ List: { style: { minWidth: '240px', maxHeight: '50vh' } } }}
                items={[
                  { id: '', label: 'Everyone' },
                  ...holders.map((h) => ({ id: h.id, label: `${h.name} · ${h.count}` })),
                ]}
                onItemSelect={({ item }) => {
                  onHolder((item as { id: string }).id || null);
                  close();
                }}
              />
            </div>
          )}
        >
          <Button
            kind={KIND.tertiary}
            size={SIZE.mini}
            data-testid="chats-holder-pick"
            aria-label={held ? `Owner — ${held.name}` : 'Owner'}
            startEnhancer={<Glyph id="who" size={STEP.small} />}
            endEnhancer={<Glyph id="caret" size={STEP.small} />}
            overrides={{ BaseButton: { style: { minWidth: 0, maxWidth: 170 } } }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {held ? held.name : 'Owner'}
            </span>
          </Button>
        </StatefulPopover>
      )}
    </div>
  );
}

/* ── THE CUSTOMERS ARE FOUND HERE (FEED-IA §35.1) ─────────────────────────────────────────────
 * «Filter-as-you-type in Sales, in customers, and in products.» The customers of this house have
 * one list they all appear on, and it is this one — every conversation the day is carrying — so the
 * customer search lives INSIDE the list rather than in the two surfaces that draw it. That is why
 * it is here and not in `areas/chats.tsx`: the tab and the floating widget render the identical
 * component, so one seat serves both doors and neither can drift from the other.
 *
 * IT SEARCHES THE NAME AND WHAT WAS SAID. A person looking for a customer types the customer; a
 * person looking for a conversation types the thing they remember out of it. Both are one field,
 * because both are the same act.
 *
 * ═══ AND THE SEAT RIDES THE HEADER (FEED-IA §40.2) ══════════════════════════════════════════
 * It used to have a band of its own: a 48px strip holding one magnifier in the far corner, under
 * a header holding a word and another word. Two shelves, one of them empty. The list owns ONE
 * header now — its label, its count said quietly, the seat, and whatever the housing wants at the
 * end — so the panel opens on conversations rather than on furniture.
 *
 * ═══ THE NARROWS SIT UNDER IT, IN THE SAME STICKY BLOCK (FEED-IA §42) ═══════════════════════
 * Search and filter are one apparatus and they hold still together: the header and the filter row
 * are one sticky block at the top of the list's own scrollport, so on row 200 of 295 the way to
 * find one conversation and the way to narrow to a kind are both still under the hand.
 */
export function ThreadList({
  cast,
  threads,
  currentId,
  onOpen,
  title,
  meta,
  actions,
  theatre,
  pinnedRows,
}: {
  /** the house, for the register of who holds which accounts (§12) */
  cast: Cast;
  threads: Thread[];
  currentId: string | null;
  onOpen: (id: string) => void;
  /** the label this list stands under, where the housing has not already said it */
  title?: string;
  /** the count, said quietly beside the label */
  meta?: React.ReactNode;
  /** what the housing puts at the header's end — the widget's own way out */
  actions?: React.ReactNode;
  /** explicit demo controls, held above the real conversation rows */
  theatre?: React.ReactNode;
  /** channel-owned work that stays above the chronological conversation rows */
  pinnedRows?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const [query, setQuery] = React.useState('');
  const terms = React.useMemo(() => termsOf(query), [query]);
  const [narrow, setNarrow] = React.useState<Narrow>('all');
  const [holder, setHolder] = React.useState<string | null>(null);

  /* THE COUNT YIELDS TO THE WORD (§91.2 simplified it). It used to yield to the FIELD as well —
     the seat opened into a real input that wanted most of a 400px header, and a count left beside
     it came out as «1…», which is a number truncated into a lie. The field opens in the middle of
     the screen now, so the header never has to make room for one, and what the count yields to is
     the only thing left in the row that can crowd it: the standing word itself. */
  const searching = query.length > 0;

  /* ── THE SEAT (FEED-IA §91.2) ────────────────────────────────────────────────────────────
   * The book of conversations searches the way everything else does. Its index is the thread's
   * own folded `words` — the name, every sentence, every transcribed word (§46.2) — so what the
   * modal finds and what this list narrows to are one answer computed twice from one word. */
  useSearchSeat({
    intent: 'threads',
    query,
    onQuery: setQuery,
    fieldTestid: 'chats-search-field',
    /* IT NAMES WHAT IT FINDS. The book's own seat says «Find a customer» and finds accounts; this
       one finds CONVERSATIONS, and two seats saying one word about two registers is the drift the
       heading law is for. */
    label: 'Find a conversation',
  });

  const holders = React.useMemo(() => holdersOf(cast, threads), [cast, threads]);

  /* the narrows first, the words after: a person narrows to a kind and then searches inside it,
     which is also the cheap order — the fold runs on the rows that survived the flags */
  /* ── AND A TEST ANSWERS NEITHER NARROW (THE CHECKPOINT §10.7) ────────────────────────────────
     Both narrows are questions about the HOUSE'S WORK — what is waiting on a person, and whose
     accounts these are — and a test conversation is an answer to neither: nobody is waiting on it
     and no comercial holds it. So it stands only on the unnarrowed list, which is also the only
     place it can honestly stand: a test row inside «Waiting on you» would be the app telling a
     person they owe somebody a sentence they do not owe.
     ONE FILTER, NOT TWO. It is the same `filter` the narrows already run, so a test cannot slip
     into a narrow by a path this line does not see. */
  const narrowed = React.useMemo(
    () =>
      threads.filter((t) =>
        t.test
          ? narrow === 'all' && holder === null
          : (narrow === 'all' || t.waiting) && (holder === null || t.customer.comercial === holder)),
    [threads, narrow, holder],
  );

  /* ── AND IT SEARCHES WHAT WAS SPOKEN (FEED-IA §46.2) ─────────────────────────────────────────
     «The message's words searchable like any text.» The index is folded ONCE per conversation in
     `threads.ts` — the customer, every sentence, every transcribed word, every word read off a
     photograph — so a person typing «pulpo» finds the voice note that said it, and the fold does
     not run 295 times on every keystroke. */
  const shown = React.useMemo(
    () => (terms.length === 0 ? narrowed : narrowed.filter((t) => matches(terms, t.words))),
    [narrowed, terms],
  );

  /* WHAT AN EMPTY LIST SAYS IS WHAT IS TRUE OF IT. Three narrows can empty this list and each one
     empties it for a different reason, so the sentence names the reason rather than announcing a
     blank. Every one of them says what IS: a list with nothing waiting is a morning that is
     answered, and that is the good news the row was asked for. */
  const held = holders.find((h) => h.id === holder) ?? null;
  const emptyLine =
    terms.length > 0
      ? `0 conversations match “${query.trim()}”. Try the customer’s own name.`
      : narrow === 'waiting'
        ? held
          ? `${held.name}’s conversations are all answered.`
          : 'Every conversation is answered.'
        : held
          ? `${held.name} holds 0 conversations today.`
          : 'The day’s conversations start here.';

  return (
    <div data-testid="thread-list" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* IT RIDES THE PANE'S OWN SCROLL (§38). One scrollport per pane is the law, so the header
          is not a second box above the list — it is the first thing IN it, held at the top by
          `sticky`, which is what §38 allows a folded summary to do. At 295 conversations the way
          out and the way to find one must still be there on row 200. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          borderBottom: `1px solid ${theme.colors.borderOpaque}`,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
      <header
        data-testid="chats-list-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale200,
          padding: `${theme.sizing.scale300} ${theme.sizing.scale200}`,
          minWidth: 0,
        }}
      >
        {title && (
          <h2 style={{ margin: 0, ...theme.typography.LabelLarge, flex: '0 0 auto' }}>{title}</h2>
        )}
        {/* THE COUNT IS SAID, NOT BADGED. On the launcher it is a number in a ring because there
            is nothing else there to read; in a header there are words, so it takes words. */}
        {!searching && (
          <span
            data-testid="chats-list-count"
            style={{
              ...theme.typography.ParagraphSmall,
              color: theme.colors.contentTertiary,
              flex: '0 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {meta}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }} />
        <SearchSummon
          intent="threads"
          label="Find a conversation"
          testid="chats-search"
          query={query}
          onRelease={() => setQuery('')}
        />
        {actions}
      </header>
      <FilterRow
        narrow={narrow}
        onNarrow={setNarrow}
        holders={holders}
        holder={holder}
        onHolder={setHolder}
      />
      </div>
      {theatre}
      {pinnedRows}
      {shown.map((t) => (
        <ThreadRowButton
          key={t.id}
          thread={t}
          current={t.id === currentId}
          terms={terms}
          onOpen={() => onOpen(t.id)}
        />
      ))}
      {shown.length === 0 && (
        <p
          data-testid="chats-search-empty"
          style={{
            margin: 0,
            padding: theme.sizing.scale600,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
          }}
        >
          {emptyLine}
        </p>
      )}
    </div>
  );
}

/* ── THE THREAD ───────────────────────────────────────────────────────────────────────────── */

/* ── THE WHISPER BETWEEN GROUPS (FEED-IA §40.3) ───────────────────────────────────────────────
 * «Date whispers between groups rather than stamps crowding every bubble.» A run of turns used to
 * print its hour on every bubble in it — «13:20» four times down one exchange — which is the same
 * fact said four times and the noise the reference does not have. So the hour comes OFF the
 * bubbles and rides one quiet line above the run it belongs to.
 *
 * WHAT IT MAY HONESTLY SAY. The ledger stamps hours; the only date it carries is the day the
 * ORDER a run is about is for, which `threads.ts` folds onto the turn. So the whisper says the day
 * when the day turns and the hour when only the hour moves — and it never invents a date for a
 * row that has none.
 */
function whisperOf(row: ThreadTurn, prev?: ThreadTurn): string | null {
  if (!row.time) return null;
  if (prev && prev.day === row.day && prev.time === row.time) return null;
  const turned = !prev || prev.day !== row.day;
  return turned && row.day ? `${row.day} · ${row.time}` : row.time;
}

function Whisper({ says }: { says: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid="thread-whisper"
      style={{
        display: 'flex',
        justifyContent: 'center',
        /* the air is the whole point: a marker jammed between two bubbles is another bubble */
        padding: `${theme.sizing.scale650} 0 ${theme.sizing.scale500}`,
        minWidth: 0,
      }}
    >
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          /* it stands ON the dotted ground, so it takes a pad of the ground's own paper — enough
             to keep 12px type off the grain, and no border, because it is not a thing */
          background: theme.colors.mono100,
          padding: `0 ${theme.sizing.scale300}`,
          whiteSpace: 'nowrap',
        }}
      >
        {says}
      </span>
    </div>
  );
}

/* ── THE DOCK, WHOSE HEIGHT NEVER MOVES (FEED-IA §37.3, §13) ──────────────────────────────────
 * «Hover must never change geometry.» A take does the same thing one level up: the Voice Button
 * grows a lock chip ABOVE its row while a finger is down, so the composer's dock grew with it and
 * shoved the whole conversation upward the instant recording began — and dropped it back on
 * release. The reference's recorder floats over the conversation; it never pushes it.
 *
 * So the dock MEASURES ITSELF AT REST and holds that height while the take runs, and the composer
 * inside it is anchored to the dock's foot. The chip then grows upward, over the dotted ground,
 * exactly where the reference puts it. Measured rather than stated, because the resting height is
 * Base's control ladder plus this dock's own padding, and neither is a number this file owns.
 */
function ComposerDock({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  const dock = React.useRef<HTMLDivElement>(null);
  const [rest, setRest] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    if (busy) return;
    const h = dock.current?.getBoundingClientRect().height;
    if (h && h !== rest) setRest(h);
  }, [busy, rest]);

  return (
    <div
      ref={dock}
      data-testid="composer-dock"
      data-busy={busy ? 'yes' : 'no'}
      style={{
        position: 'relative',
        /* the held height is the dock's OWN measured box, so the box it is applied to has to be
           the same one — a content box would add the padding back and grow by 25px anyway */
        boxSizing: 'border-box',
        padding: theme.sizing.scale500,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        flex: '0 0 auto',
        ...(busy && rest ? { height: rest } : null),
      }}
    >
      <div
        style={
          busy && rest
            ? {
                position: 'absolute',
                left: theme.sizing.scale500,
                right: theme.sizing.scale500,
                bottom: theme.sizing.scale500,
                minWidth: 0,
              }
            : { minWidth: 0 }
        }
      >
        {children}
      </div>
    </div>
  );
}

/* ── CO-PRESENCE, PART ONE: THE GHOST IN THE COMPOSER (FEED-IA §110 · §9.11 · §83.2) ──────────
 * «They need to answer a message themselves — which Rocoto will then monitor to learn, like a
 * co-present thing.»
 *
 * WHAT ROCOTO PREPARED AND DID NOT SEND. §9.11 called the abstention the main differentiator and
 * then kept it where nobody could see it: `withheld` was composed on every held document and read
 * by nothing. This is the one place it surfaces, and it surfaces to the ONE PERSON it is for —
 * the one writing the sentence Rocoto held back.
 *
 * OFFERED, NEVER IMPOSED (§83.2, and the heart's own doctrine). It is a control, not a value: the
 * field stays theirs until a press writes the words into it, and from that moment they are words
 * a person is editing rather than words a machine put out. Ignoring it costs one glance — it
 * stands only while the field is empty, and it goes the moment anybody types.
 *
 * IT IS QUIET BY CONSTRUCTION. Tertiary ink, one line, mini pill, the same seat and the same
 * geometry the test chat's own suggestions take — one grammar for «Rocoto has something for you,
 * take it or leave it», wherever it appears.
 */
function GhostPrefill({ words, onTake }: { words: string; onTake: () => void }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid="chat-ghost"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale300}`,
        minWidth: 0,
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto' }}>
        Rocoto read it as
      </span>
      <Button
        kind={KIND.secondary}
        size={SIZE.mini}
        shape={SHAPE.pill}
        data-testid="chat-ghost-take"
        /* the pill clips at 400px, so the whole reading is one hover away and the press puts every
           word of it in the field either way — the field is the place it is read at full length */
        title={words}
        onClick={onTake}
        overrides={{
          BaseButton: {
            style: { minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' },
          },
        }}
      >
        {words}
      </Button>
    </div>
  );
}

/* ── CO-PRESENCE, PART TWO: WHAT LANDS WHEN THEY SEND (FEED-IA §110) ─────────────────────────
 * «Rocoto will then monitor to learn, like a co-present thing… the learning loop as companionship,
 * not delegation.»
 *
 * So the person's own send is an EVENT ROCOTO WAS PRESENT FOR, and the app says so — once, in one
 * line, as a fact about what just happened. It is the same register the river's own readings take
 * («Answered — it has settled into Friday»): what IS, stated, then gone.
 */
const LEARNED_WORDS = 'Reply recorded for future review.';
/** long enough to be read, short enough that it is over before the next message (§10.2's four) */
const LEARNED_MS = 4000;

function LearnedReading() {
  const [, theme] = useStyletron();
  return (
    <p
      data-testid="chat-learned"
      style={{
        margin: 0,
        padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale300}`,
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        minWidth: 0,
        overflowWrap: 'anywhere',
      }}
    >
      {LEARNED_WORDS}
    </p>
  );
}

/* ═══ THE HYBRID COMPOSER, AND THE REPLY THAT IS ALREADY WRITTEN (FEED-IA §196.7 · §196.8) ═════
 *
 * Peter, 2026-09-04, both halves of one thought:
 *
 *   «chats are per customer with chips. emails can be answered in the chip or by hitting reply and
 *    answering in the composer otherwise it's whatsapp. if whatsapp isnt hooked up, it's email.
 *    maybe it should denote that by putting the icon inthe composer or making the composer's
 *    outline green, or actually better: the send/record button. and if it's email, it can be blue
 *    button. in email's case, add a transcribe mic button like with copilot as that would indicate
 *    it transcribes to tex in composer.»
 *
 *   «if we tell them to reply to a message, we should draft the reply just like you can draft
 *    emails for me in my gmail. it's a draft inside the composer itself, and the composer in the
 *    chip embedded in the albaran. they can select and delete that draft if they want to, we just
 *    prefill thats all… this is a KILLER feature»
 *
 * ═══ ⚠ WHAT THIS REPEALS, STATED RATHER THAN DELETED ════════════════════════════════════════
 * E185.08 / MSG-25 wrote «no customer composer» and made the customer thread's dock «a native
 * handoff, not an editor». §196.7 lifts exactly that clause and nothing around it. What survives
 * untouched, because it was never the same claim:
 *   · THE SOURCE STAYS READ-ONLY. An email card is still provider-custodied; this composer stands
 *     BESIDE the record, never inside it, so `[data-testid=email-thread]` still carries no field.
 *   · THE NATIVE DOOR STAYS. «Open chat» still opens the real WhatsApp; it moved onto the
 *     composer's own channel line rather than standing as a second strip saying the same thing.
 *   · NOTHING CLAIMS DELIVERY. The app never sends: it hands the words to the channel's own door,
 *     and it says which door opened. A receipt is a provider's word or it does not exist.
 *
 * ═══ THE ANATOMY, TOP TO BOTTOM ═════════════════════════════════════════════════════════════
 *     Draft   Rocoto wrote this reply.                                    Delete      ← §196.8
 *   ┌───────────────────────────────────────────────────┐   ( ● )                     ← §196.7
 *   │ Hi Bar Manolo. Thanks for asking about the Gamba… │   green on WhatsApp,
 *   └───────────────────────────────────────────────────┘   blue on email
 *     WhatsApp · Nuria                                       Open chat
 *
 * The disc is ONE control in two jobs, and the channel decides which: on WhatsApp the mic records
 * a voice note (the message that channel actually carries); on email it DICTATES through the kit
 * runtime, «like with copilot», because mail carries no note. Both are the shipped components —
 * the kit Composer and the Voice Button — inside a scoped theme that repoints four button roles.
 * Nothing is redrawn and no component learns what a channel is.
 */

/** the draft the person has yet to touch is SELECTED when the box takes focus, so one keystroke
 *  replaces the lot (§196.8: «they can select and delete that draft»). On the frame's own tick, so
 *  the pointer's own mouseup cannot collapse the selection it just made. */
function selectAll(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  window.requestAnimationFrame(() => {
    try { el.setSelectionRange(0, el.value.length); } catch { /* a detached field is not an error */ }
  });
}

/** THE MARK ON A REPLY NOBODY HAS WRITTEN YET. It says whose words those are and offers the one
 *  act §196.8 names — take them away — and the deletion is remembered, so nothing re-drafts. */
function DraftMark({ draft, onDelete }: { draft: ReplyDraft; onDelete: () => void }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid="chat-draft"
      data-draft-sale={draft.sale}
      data-draft-concern={draft.concern}
      data-draft-kind={draft.kind}
      style={{
        display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0,
        padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale200}`,
      }}
    >
      <span
        data-testid="chat-draft-mark"
        style={{
          ...theme.typography.LabelXSmall, flex: '0 0 auto', color: theme.colors.contentPrimary,
          border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius100,
          padding: `2px ${theme.sizing.scale200}`, background: theme.colors.backgroundSecondary,
        }}
      >
        Draft
      </span>
      {/* ⚠ THE ROW SPENDS ONE LINE, AND IT SPENDS IT ON THE DIFFERENTIATOR (§9.11 · §193.2's own
          instinct, applied to a dock). What Rocoto READ and did not send is the fact worth a
          person's glance; «Rocoto wrote this reply» is what the «Draft» chip already says, and it
          only stands where there is no withheld reading to state instead. Internal by
          construction, and a field is not a channel. */}
      <span
        data-testid="chat-draft-reading"
        title={draft.withheld ?? undefined}
        style={{
          ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {draft.withheld ?? 'Rocoto wrote this reply.'}
      </span>
      <Button
        kind={KIND.tertiary}
        size={SIZE.mini}
        data-testid="chat-draft-delete"
        onClick={onDelete}
        overrides={{ BaseButton: { style: { flex: '0 0 auto', minHeight: '44px' } } }}
      >
        Delete
      </Button>
    </div>
  );
}

/**
 * THE LINE UNDER THE BOX — the channel, the number the words leave from, and the door.
 *
 * ⚠ IT CARRIES THE HANDOFF'S OWN IDENTITY. E185's `native-chat-handoff` strip said «Reply in
 * WhatsApp / Open chat» directly above a composer that did not exist. The door survives §196.7
 * unchanged — it is how a person reaches the real conversation — so it moved ONTO this line
 * rather than standing as a second row repeating the channel the button already states.
 *
 * ═══ AND THE DOOR NOW OPENS INSIDE THE APP (FEED-IA §202.3 · OUT-05.2 · OUT-05.3) ════════════
 * «"open chat" for whatsapp should be opening the chat popup, and open email as well. we become
 * their chat and email client.» So the press calls `openChat` / `openEmail` and the panel answers;
 * `web.whatsapp.com` and `mail.google.com` leave this file. The composer stands in three housings
 * (Messages, the mail workspace, the chip inside the albarán) and the door is worth pressing in
 * the chip, which is why it stays a door rather than being dropped: in the panel it re-focuses the
 * conversation it is already showing, and from the albarán it is the one that opens the popup.
 *
 * ═══ THE NUMBER IS PART OF THE SENTENCE (OUT-05.5) ═══════════════════════════════════════════
 * WhatsApp sends through the HOUSE's own number, so the line says which one. It stands second,
 * ahead of the customer's name, because the panel's header and the albarán's head both already
 * say who — this line's own subject is where the words go out from.
 */
function ChannelLine({ sector, standing, customer, said, houseNumber, whatsappPosture, whatsappActs: acts = true, emailSourceRef, testid }: {
  sector: SectorId; standing: ChannelStanding; customer: Customer; said?: string;
  /** the house's own WhatsApp number, as the PROVIDER issued it — «WhatsApp · from +34 …» */
  houseNumber?: string;
  /** the WhatsApp capability's own posture, so the act beside the line says the same word the
   *  Connections card, the connected inbox and the setup state say about this account */
  whatsappPosture?: WhatsAppPosture;
  /** whether this workspace's own acts can move that posture (`whatsappActs`). False when the
   *  provider's account is bound to ANOTHER workspace (§247.2): then the sentence names that and
   *  the one act opens Connections, where the operator repair is named — never Meta's walk, which
   *  answers with the same binding (`Store.bind_workspace` keeps an existing one). */
  whatsappActs?: boolean;
  /** the authorized reference this conversation's mail was drawn from */
  emailSourceRef?: string;
  /** the composer's own testid, so its two doors are named the same way */
  testid: string;
}) {
  const [, theme] = useStyletron();
  const whatsapp = standing.channel === 'whatsapp';
  const open = () => {
    if (whatsapp) openChat(sector, customer.id);
    else openEmail(sector, customer.id, emailSourceRef ?? '');
  };
  /* ── THE SEND STATE GETS A LINE THAT CAN BE READ (§246 acceptance 5) ────────────────────────
     «WhatsApp sends once Meta confirms your number» used to ride the one-line channel strip,
     which is `nowrap` + ellipsis so that a long customer name never resizes the bar — and in the
     400px panel it came out as «WhatsApp · WhatsApp sends once Meta …», the sentence cut exactly
     where the fact was. Seen at 1600, in the panel. So the STRIP keeps the identity (channel ·
     number · who) and the SENTENCE stands under it, wrapping, at full length. */
  /* THE LAST ENTRANCE STATING «Finish setup» ON ANOTHER HOUSE'S ACCOUNT (13 September, folds
     review). The Connections card, Team numbers and the connected inbox all state the binding
     and carry one act that leads to Connections; the composer offered Meta's walk. Same sentence,
     same act, here. */
  const bound = whatsapp && !said && acts === false;
  const says = bound ? WHATSAPP_OTHER_WORKSPACE : (said ?? standing.note);
  /* ── AND THE STATE CARRIES ITS OWN DOOR (§246 acceptance 5) ────────────────────────────────
     The mailbox line has had this since OUT-05.4: where the answer to a stated send state is a
     setting, the setting is ONE PRESS away rather than a path to follow. The WhatsApp line shipped
     without it, so «Rocoto sends from your own number once Meta confirms it.» stood on every
     WhatsApp conversation in the house with no way to act on it — a blocker stated and then
     abandoned. It stands only while the sentence is the STANDING one: after a handoff the line
     says which door opened, and a Connections button beside that would be answering a different
     question. */
  /* The act stands while ROCOTO sending from the house's own number is what is pending — the same
     fact the sentence above it states, so the line and the press are about one thing. The send
     disc is a different question: it hands the words to WhatsApp's own door, and that door opens
     in every posture. */
  const bindNumber = !said && whatsapp && !standing.canSend;
  return (
    <div data-testid="native-chat-handoff-group" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    {says && (
      <span
        style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', minWidth: 0,
          gap: theme.sizing.scale200,
          padding: `${theme.sizing.scale200} ${theme.sizing.scale500} 0`,
        }}
      >
        {/* ⚠ THE SENTENCE KEEPS ITS OWN ELEMENT. A drive reads this testid's text, and folding the
            button's label into it would make the sentence read «…confirms it.Connections». */}
        <span
          data-testid="composer-channel-state"
          style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
        >
          {says}
        </span>
        {bindNumber && (
          <Button
            kind={KIND.tertiary}
            size={SIZE.mini}
            data-testid={`${testid}-connect-whatsapp`}
            data-whatsapp-posture={whatsappPosture}
            data-acts={bound ? 'no' : 'yes'}
            onClick={() => { window.location.hash = bound ? '#/admin/connections' : CONNECTIONS_WHATSAPP_HASH; }}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
          >
            {bound ? 'Open Connections' : whatsappStatusWord(whatsappPosture ?? 'setup')}
          </Button>
        )}
      </span>
    )}
    <div
      data-testid="native-chat-handoff"
      data-channel={standing.channel}
      data-because={standing.because}
      style={{
        display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0,
        padding: `${theme.sizing.scale100} ${theme.sizing.scale500} 0`,
      }}
    >
      {whatsapp
        ? <WhatsAppMark size={15} testid="native-chat-handoff-logo" />
        : <span data-testid="native-chat-handoff-logo" style={{ flex: '0 0 auto', display: 'inline-flex' }}><Glyph id="email" size={15} /></span>}
      <span
        data-testid="composer-channel"
        style={{
          ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {[standing.word, whatsapp && houseNumber ? `from ${houseNumber}` : null, customer.name].filter(Boolean).join(' · ')}
      </span>
      <Button
        kind={KIND.tertiary}
        size={SIZE.mini}
        data-testid="native-chat-handoff-open"
        onClick={open}
        overrides={{ BaseButton: { style: { flex: '0 0 auto', minHeight: '44px' } } }}
      >
        {/* one pair of words across the app (OUT-05.6): «Open chat» is WhatsApp's, «Open the
            email» is mail's, and both open inside Rocoto */}
        {whatsapp ? 'Open chat' : 'Open the email'}
      </Button>
    </div>
    </div>
  );
}

/**
 * IS THE HOUSE'S NUMBER BOUND RIGHT NOW — the two halves, read in one place (§246 acceptance 5).
 *
 * The ledger's `whatsapp-connect` is a fact the app wrote down; the provider's own connection is
 * the fact the provider is reporting this minute. Both are subscribed, so binding a number
 * repaints every composer on screen at once, and losing one does the same. Every surface and
 * every drive asks this and nothing else.
 */
/** ONE LIVE READ, AND NO LOCAL HALF (§246 · §247.2). This used to be `ledger || provider`, and an
 *  `||` lets the weaker half win — an append-only activation row with no revocation path outvoted
 *  a provider reporting nothing. The capability is the whole of it now, workspace-matched, and it
 *  is the same posture the Connections card, the connected inbox, setup-progress and onboarding
 *  read, so binding or losing the number repaints every one of them at once. */
function useWhatsappBoundNow(cast: Cast): { bound: boolean; number: string; posture: WhatsAppPosture; acts: boolean } {
  const whatsapp = useWhatsAppCapability(cast.sector);
  /* `acts` is false when the provider's account is bound to another workspace (§247.2). */
  return { bound: whatsapp.bound, number: whatsapp.number, posture: whatsapp.posture, acts: whatsappActs(whatsapp) };
}

/**
 * THE COMPOSER ITSELF — one component, three housings: the Messages workspace, the email
 * workspace, and the chip embedded in the albarán (§196.8's «the composer in the chip»).
 *
 * ⚠ THE PREFILL IS NEVER WRITTEN INTO THE DRAFT STORE. The words are DERIVED while the person has
 * typed nothing — «we just prefill thats all» — so a reload re-derives them, a deletion is the
 * only thing remembered, and the store still holds exactly what a person wrote and nothing else.
 */
export function ReplyComposer({
  cast, customer, sales, draftKey, mail = false, aimedAtEmail, onClearAim, emailTo, emailSubject,
  emailProvider, emailSourceRef, testid = 'reply-composer', onBusyChange, emailStanding = false,
}: {
  cast: Cast;
  customer: Customer;
  /** the orders this conversation is carrying — the material a draft is composed from */
  sales: Sale[];
  /** where the person's own words are kept between visits */
  draftKey: string;
  /** the conversation carries mail */
  mail?: boolean;
  /** Reply was pressed on this email in the thread (§196.7 clause 1) */
  aimedAtEmail?: { id: string; subject?: string; from?: string } | null;
  onClearAim?: () => void;
  emailTo?: string;
  emailSubject?: string;
  emailProvider?: 'gmail' | 'm365' | 'forwarded';
  /** the authorized source reference this conversation's mail was drawn from (§202.3) — the door
   *  «Open the email» carries, and never a provider URL */
  emailSourceRef?: string;
  testid?: string;
  /** the housing's dock holds its height while a take runs (§13) — it has to be told */
  onBusyChange?: (busy: boolean) => void;
  /** this conversation has an email door — a stored address, or a mail turn standing in it. It is
   *  what makes «Reply by email instead» an honest offer rather than a button into nowhere. */
  emailStanding?: boolean;
}) {
  const [, theme] = useStyletron();
  const whatsapp = useWhatsappBoundNow(cast);
  const bound = whatsapp.bound;
  /* ── §202.3 · WHATSAPP LEAVES ON THE HOUSE'S OWN NUMBER, AND IT IS WHATSAPP'S OWN (§246) ─────
     ⚠ IT USED TO BE THE TELEPHONE'S. `usePhoneConnectionConfig(...).sourceNumber` is a
     localStorage draft written during PHONE setup, and `phone-connection-config.ts` says in its
     own note that `sourceNumber` is outside the provider-owned fields it protects. So the composer
     printed «WhatsApp · from +34 …» off a browser draft for another channel, directly above a
     line saying WhatsApp was still being confirmed — two channels' facts in one sentence, one of
     them presented as the sending identity. The number is the WhatsApp connection's own evidence
     now, and it is printed only while the channel is bound. */
  const { config: appConfig } = useConfig();
  /* §247.2 — the mailbox line reads the ONE live email capability. It used to fold the runtime's
     send word together with the house's own `config.mailbox` switches, so a workspace that had
     armed a switch and authorized nothing read «Sending starts when Gmail finishes connecting»
     under a composer with no mailbox behind it at all. */
  const emailMailbox = useEmailCapability();
  const connection: EmailConnectionStatus = emailMailbox.posture === 'ready'
    ? { kind: 'connected', providers: emailMailbox.providers, canSend: emailMailbox.canSend }
    : { kind: 'unverified', reason: 'Connect a mailbox to send from here.' };
  useDismissals();
  useDeletedDrafts();
  const [typed, setTyped] = useThreadDraft(cast, draftKey);
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  const [said, setSaid] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  /* the writing surface re-measures itself on a width change — the kit Composer's own job since
     §196.7 found it cut a four-line draft in half at 1600 (`rocoto/composer/composer.tsx`). */

  /* ── THE PERSON'S OWN CHOICE, PER CONVERSATION (§246 acceptance 5: «Channel changes must be
     explicit») ─────────────────────────────────────────────────────────────────────────────
     It is held on the DRAFT KEY, so it is the same scope the words in the box have: choosing
     email for this albarán's chip is a choice about this albarán, and it is forgotten the moment
     the composer moves to another conversation — which is what keeps a destination from
     following a person around behind their back. */
  const [chose, setChose] = React.useState<ReplyChannel | null>(null);
  React.useEffect(() => { setChose(null); }, [draftKey]);
  const standing = replyChannelOf({
    customer, mail, aimedAtEmail: Boolean(aimedAtEmail), whatsappBound: bound, emailStanding, chose,
    /* An offer to switch is a promise the other channel works, so it reads the mailbox's own live
       posture — the email worker's fold — rather than an address on a customer record. */
    emailConnected: emailMailbox.posture === 'ready',
  });
  const mailbox = mailboxStanding({
    connection,
    provider: emailProvider ?? 'forwarded',
    /* «Arming» is a mailbox the provider is still authorizing — the capability's own `partial`. */
    armed: emailMailbox.posture === 'partial',
  });

  /* WHAT JUST HAPPENED IS ABOUT THIS CONVERSATION, so it leaves with it. A sentence saying a door
     opened, still standing under the next customer's name, would be a fact about the wrong thing. */
  React.useEffect(() => { setSaid(null); }, [draftKey]);
  const draft = standingDraftOf(sales);

  /* THE DRAFT STANDS ONLY WHILE THE BOX IS THEIRS TO TAKE. The moment anything is typed the words
     in the field are the person's, and the mark comes off — which is the whole of «it's a draft
     inside the composer itself… they can select and delete». */
  const untouched = typed === '';
  const showDraft = Boolean(draft) && untouched;
  const value = showDraft && draft ? draft.words : typed;

  const { dictation, take } = useDictation(value, setTyped);
  const line = dictationLine(dictation);

  /* WHERE THE WORDS GO. Stated as an attribute as well as followed on a press, so what this
     control does is checkable without anything being sent anywhere. */
  const door = standing.channel === 'whatsapp'
    ? whatsappDoor(value, customer.phone)
    : mailDoor({
      provider: emailProvider,
      to: emailTo ?? customer.email,
      subject: aimedAtEmail?.subject ?? emailSubject,
      text: value,
    });
  const carried = 'carried' in door ? door.carried : true;
  const where = 'where' in door ? door.where : undefined;

  /* THE SEND CONTROL IS ADDRESSABLE (§196.7 · E193.17). With the mic in a seat of its own the bar
     holds TWO labelled buttons, and `button[aria-label]` no longer names one thing — a reader that
     took the first one was measuring the mic and calling it the send. */
  const composerOverrides = React.useMemo(
    () => ({ ...COMPOSER_ON_GROUND, Send: { props: { 'data-testid': `${testid}-send` } } }),
    [testid],
  );

  const hand = () => {
    if (!value.trim()) return;
    window.open(door.href, '_blank', 'noopener,noreferrer');
    /* ⚠ THE WORDS STAY IN THE BOX. A handoff is not a receipt (MSG-24's own rule, kept): nothing
       here has evidence that anything was delivered, so nothing here clears the person's intent. */
    setSaid(standing.channel === 'whatsapp'
      ? (carried ? 'WhatsApp opened with your message.' : 'WhatsApp opened. Your message is here.')
      : `${where === 'gmail' ? 'Gmail' : where === 'outlook' ? 'Outlook' : 'Your mailbox'} opened with your message.`);
    onClearAim?.();
  };

  return (
    <div
      data-testid={testid}
      data-channel={standing.channel}
      data-because={standing.because}
      /* §246 · the two facts a reader needs to tell a promise from a state: is the house's number
         bound right now, and did a PERSON move this reply or did the app. */
      data-bound={bound ? 'yes' : 'no'}
      data-whatsapp-posture={whatsapp.posture}
      data-email-posture={emailMailbox.posture}
      data-can-send={standing.canSend ? 'yes' : 'no'}
      data-chose={chose ?? 'none'}
      data-draft={draft ? (showDraft ? 'standing' : 'taken') : 'none'}
      data-channel-door={door.href}
      data-dictation={dictation.state}
      style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
    >
      {showDraft && draft && (
        <DraftMark
          draft={draft}
          onDelete={() => { deleteDraft(draft.sale, draft.concern); setTyped(''); inputRef.current?.focus(); }}
        />
      )}
      {/* THE SEND/RECORD BUTTON WEARS THE CHANNEL (§196.7). One scoped theme, four button roles —
          the Composer's send disc and the Voice Button's record disc move together, and every
          other token in here stays the kit's own. */}
      <ThemeProvider theme={channelTheme(theme, standing.channel === 'whatsapp' ? 'whatsapp' : 'email')}>
        <Composer
          value={value}
          onChange={setTyped}
          /* ── THE SEND DISC OPENS THE CHANNEL'S OWN DOOR, AND THAT DOOR OPENS FOR ANYONE ────
             `hand` is `window.open(door.href)` and nothing else: `wa.me` in the person's own
             WhatsApp, `mailto:`/the provider's compose window in their own mail client. Rocoto
             delivers neither. So the two halves of this composer state ONE case — the disc is
             live on both channels, and what waits on the house's binding is ROCOTO sending from
             the house's own number, which `standing.canSend` is the fact for and which the line
             under the box says in words beside the one Connect act.
             Withholding `onSend` here was measured and rejected: the kit renders the disc
             `disabled` (`rocoto/composer/composer.tsx`), which takes it out of the tab order and
             leaves a keyboard reader with a dead Enter — and it says the person cannot reach
             their own WhatsApp, which is untrue. `CHANNEL-SEMANTICS.md` §3 holds the rule. */
          onSend={hand}
          inputRef={inputRef}
          sendLabel={standing.sendLabel}
          /* SEVEN LINES, THE PORT'S OWN CEILING (§196.2's editor · E193.17). The kit bar's five is
             right for a line you type; a DRAFTED reply is a paragraph the app wrote and the person
             has to read before they trust it. Measured at 360 the moment the mic took its own seat:
             the narrower field wrapped the same draft to six lines and the fifth-line ceiling put
             the last one behind a scroll — the app hiding the end of a sentence it wrote itself. */
          maxLines={7}
          placeholder={aimedAtEmail ? `Reply to ${aimedAtEmail.from ?? customer.name}` : `Write to ${customer.name}`}
          /* THE BAR CARRIES NO GROUND OF ITS OWN. In the dock it stood on the same white the dock
             already paints; in the albarán's chip it laid a white slab across a grey card, with a
             ragged edge where the trailing seat ended — seen at 1600, not reasoned about. The
             housing owns the ground, and the bar is the field and its controls. */
          overrides={composerOverrides}
          /* ── THE MIC KEEPS ITS OWN SEAT HERE (§196.7 · §196.8 · E193.17) ──────────────────
             «in email's case, add a transcribe mic button like with copilot» — and «we should
             draft the reply… it's a draft inside the composer itself». Read together those two
             cancel: a prefilled draft is `typing` from the first render, so the shared seat held
             SEND and the transcribe mic was unreachable on exactly the messages that carry a
             draft. THE SEAT FOLLOWS WHAT THE MIC IS FOR: this one DICTATES — the take becomes
             words in the box, on top of whatever is already there — so it is a second control,
             not an alternative to sending, and it stands beside send at every width, with a
             draft standing, with the person's own words typed over it, and on an empty box.
             `standing.dictates` is the fact, so the day a bound number can carry a real voice
             note the seat goes back to being shared without this line changing (reply-channel.ts). */
          voiceSeat={standing.dictates ? 'own' : 'shared'}
          voiceActive={voiceBusy}
          onFocus={() => { if (showDraft) selectAll(inputRef.current); }}
          voice={
            <StatefulVoiceButton
              seed={`${cast.sector}-${draftKey}`}
              onBusyChange={(busy) => { setVoiceBusy(busy); onBusyChange?.(busy); }}
              labels={{ record: standing.micLabel, send: 'Turn the note into words' }}
              onRecord={(recorded) => { void take(recorded); }}
              overrides={{
                Mic: {
                  props: { 'data-testid': `${testid}-mic`, 'data-mic': standing.dictates ? 'dictates' : 'records' },
                  /* ── AND IT IS THE COPILOT'S GHOST, NOT A SECOND COLOURED DISC (§196.7) ────
                     «add a transcribe mic button LIKE WITH COPILOT» — and the Copilot's is
                     «a backgroundless mic beside it». Seen at 1600 with a draft standing, the
                     filled version was two identical green circles side by side and no way to
                     tell which one sent. So the CHANNEL stays on the control that carries it —
                     the send disc §196.7 names, with the line under the box and its logo saying
                     it in words — and the mic is a ring: it dictates INTO the box, which is the
                     same act on WhatsApp and on email, so wearing a channel would be a colour
                     making a promise about a destination it never touches.
                     ⚠ RESTING ONLY. A take in flight is the recorder's own instrument, and its
                     colours are the kit's — this hands the phase straight back. */
                  style: ({ $theme, $phase, $disabled }) => ($phase !== 'idle' || $disabled ? {} : {
                    backgroundColor: 'transparent',
                    color: $theme.colors.contentPrimary,
                    boxShadow: `inset 0 0 0 1px ${$theme.colors.borderOpaque}`,
                    ':hover': { backgroundColor: $theme.colors.backgroundSecondary },
                    ':active': { backgroundColor: $theme.colors.backgroundTertiary },
                  }),
                },
              }}
            />
          }
        />
      </ThemeProvider>

      <ChannelLine sector={cast.sector} standing={standing} customer={customer} said={said ?? undefined}
        houseNumber={standing.canSend ? whatsapp.number || undefined : undefined}
        whatsappPosture={whatsapp.posture} whatsappActs={whatsapp.acts} emailSourceRef={emailSourceRef} testid={testid} />

      {/* ── THE CHANNEL CHANGES BECAUSE A PERSON CHANGED IT (§246 acceptance 5) ─────────────────
          The app used to move a WhatsApp reply into a mailbox on its own the moment the house's
          number was still being confirmed — a destination change nobody asked for, on a
          conversation the customer reads on their phone. So the conversation KEEPS its channel,
          the line above says the send state, and this is the press. It stands only where an email
          door actually exists for this customer, and pressing it again puts the reply back. */}
      {standing.offer && (
        <span
          data-testid={`${testid}-switch`}
          data-to={standing.offer.to}
          style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', minWidth: 0,
            padding: `${theme.sizing.scale100} ${theme.sizing.scale500} 0`,
          }}
        >
          <Button
            kind={KIND.tertiary}
            size={SIZE.mini}
            data-testid={`${testid}-switch-act`}
            onClick={() => setChose(standing.offer?.to ?? null)}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
          >
            {standing.offer.label}
          </Button>
        </span>
      )}

      {/* WHAT THE MAILBOX CAN DO, STATED POSITIVELY (OUT-05.4). The thread opens in every posture
          — Rocoto draws the mail it was authorized to receive — and this line is only ever about
          the SEND. Where the answer is a setting, the setting is one press away rather than a
          path to follow (`better-writing` · *Link straight to a referenced setting*). */}
      {standing.channel === 'email' && (
        <span
          data-testid={`${testid}-mailbox`}
          data-posture={mailbox.posture}
          style={{
            ...theme.typography.LabelXSmall, minWidth: 0, color: theme.colors.contentTertiary,
            padding: `${theme.sizing.scale100} ${theme.sizing.scale500} 0`,
            display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap',
          }}
        >
          {mailbox.says}
          {mailbox.door === 'connections' && (
            <Button
              kind={KIND.tertiary}
              size={SIZE.mini}
              data-testid={`${testid}-connect-mailbox`}
              onClick={() => { window.location.hash = CONNECTIONS_EMAIL_HASH; }}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
            >
              {/* ONE LABEL FOR THE ONE ACT (§247.2). «Connections» named the seat it walked to;
                  every other email entrance says what the press does, so this one does too. */}
              Connect email
            </Button>
          )}
        </span>
      )}

      {line && (
        <span
          data-testid={`${testid}-state`}
          role="status"
          style={{
            ...theme.typography.LabelXSmall, minWidth: 0,
            padding: `${theme.sizing.scale100} ${theme.sizing.scale500} 0`,
            color: line.loud ? theme.colors.negative : theme.colors.contentSecondary,
          }}
        >
          {line.text}
        </span>
      )}
    </div>
  );
}

/* ── THE QUOTE (FEED-IA §47.1) ────────────────────────────────────────────────────────────────
 * «Customers get in on WhatsApp, so all of that behaviour has to still be there.» Replying TO a
 * message is the first of those, and the reason it matters in this house is not politeness: a
 * comercial answering «yes, 12 kg» into a thread carrying four days of orders has said nothing
 * until it is clear which line they mean.
 *
 * IT HOLDS THE ID, NEVER A COPY. The card prints one line of the original and TAPS THROUGH TO IT
 * — the same law the band keeps with the river (§25.2: «the band item IS the feed item»). A quote
 * that only pasted the text would be a second copy of a message, going stale the moment the
 * original is understood differently.
 *
 * THE RULE ON THE LEFT IS INK, ALWAYS. Saffron marks Rocoto's own acts; a quote is the person's
 * act of pointing, whoever they are pointing at.
 */
function QuoteCard({ quote, onJump }: { quote: Quote; onJump?: () => void }) {
  const [, theme] = useStyletron();
  return (
    <button
      type="button"
      data-testid="turn-quote"
      data-quote-of={quote.id}
      onClick={onJump}
      disabled={!onJump}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        width: '100%',
        textAlign: 'left',
        marginBottom: theme.sizing.scale300,
        padding: `${theme.sizing.scale200} ${theme.sizing.scale400}`,
        border: 'none',
        borderLeft: `2px solid ${theme.colors.contentPrimary}`,
        borderRadius: theme.borders.radius200,
        background: theme.colors.backgroundSecondary,
        color: 'inherit',
        cursor: onJump ? 'pointer' : 'default',
        font: 'inherit',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentPrimary }}>{quote.who}</span>
      <span
        style={{
          ...theme.typography.ParagraphXSmall,
          color: theme.colors.contentSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        {quote.line}
      </span>
    </button>
  );
}

/* ── THE REACTIONS (FEED-IA §47.2) ────────────────────────────────────────────────────────────
 * One chip per emoji with its count, riding the bubble's lower edge the way every messenger draws
 * them. A chip a person put there themselves carries a ring, so «did mine go on» is answered by
 * looking rather than by counting.
 *
 * IT IS A BUTTON, so pressing it again takes it back — the same control both ways, never a second
 * one for undoing.
 */
function ReactionChips({ turn, onPress }: { turn: ThreadTurn; onPress: (emoji: string) => void }) {
  const [, theme] = useStyletron();
  if (!turn.reactions || turn.reactions.length === 0) return null;
  return (
    <span
      data-testid="turn-reactions"
      style={{ display: 'inline-flex', gap: theme.sizing.scale200, flexWrap: 'wrap', minWidth: 0 }}
    >
      {turn.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          data-testid="turn-reaction"
          data-emoji={r.emoji}
          data-mine={r.mine ? 'yes' : 'no'}
          onClick={() => onPress(r.emoji)}
          aria-pressed={r.mine}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: `1px ${theme.sizing.scale200}`,
            borderRadius: theme.borders.radius400,
            border: `1px solid ${r.mine ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
            background: theme.colors.backgroundPrimary,
            color: theme.colors.contentSecondary,
            ...theme.typography.LabelXSmall,
            lineHeight: '16px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span aria-hidden="true">{r.emoji}</span>
          {r.count > 1 && <span>{r.count}</span>}
        </button>
      ))}
    </span>
  );
}

/** The set, offered. It opens off the bubble's own affordance and off the long press, which is
 *  the kit's shipped `onHold` — the gesture is the component's, the menu is the surface's. */
function ReactionPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid="reaction-picker"
      style={{
        display: 'inline-flex',
        gap: theme.sizing.scale200,
        padding: theme.sizing.scale300,
        borderRadius: theme.borders.radius500,
        border: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        boxShadow: theme.lighting.shadow500,
      }}
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          data-testid="reaction-pick"
          data-emoji={emoji}
          aria-label={`React ${emoji}`}
          onClick={() => {
            onPick(emoji);
            onClose();
          }}
          style={{
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            fontSize: 17,
            lineHeight: '17px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
    </div>
  );
}

/* ── WHAT A TURN OFFERS (§47.1, §47.2) ────────────────────────────────────────────────────────
 * Two acts, in the Message kit's own `action` slot — which the kit reveals on hover AND on
 * keyboard focus, so the affordance is reachable without a pointer and invisible until it is
 * wanted. The long press opens the same picker on a phone, through the kit's `onHold`.
 */
function TurnActions({ onReply, onReact }: { onReply: () => void; onReact: () => void }) {
  const [, theme] = useStyletron();
  return (
    <span style={{ display: 'inline-flex', gap: theme.sizing.scale100 }}>
      <Button
        kind={KIND.tertiary}
        size={SIZE.mini}
        shape={SHAPE.circle}
        data-testid="turn-reply"
        aria-label="Reply to this"
        onClick={onReply}
      >
        <Glyph id="undo" size={STEP.small} />
      </Button>
      <Button
        kind={KIND.tertiary}
        size={SIZE.mini}
        shape={SHAPE.circle}
        data-testid="turn-react"
        aria-label="React to this"
        onClick={onReact}
      >
        <Glyph id="plus" size={STEP.small} />
      </Button>
    </span>
  );
}

/** The strip above the composer while a reply is aimed. It is the quote card again, with the way
 *  out beside it — one drawing for one idea, at both ends of the act. */
function ReplyStrip({ quote, onClear }: { quote: Quote; onClear: () => void }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid="reply-strip"
      data-quote-of={quote.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        marginBottom: theme.sizing.scale400,
        minWidth: 0,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <QuoteCard quote={quote} />
      </span>
      <Button
        kind={KIND.tertiary}
        size={SIZE.mini}
        shape={SHAPE.circle}
        data-testid="reply-clear"
        aria-label="Write to the conversation instead"
        onClick={onClear}
      >
        <Glyph id="minus" size={STEP.small} />
      </Button>
    </div>
  );
}

/* ═══ THE ORDER OVERLAY (FEED-IA §77.5) ═════════════════════════════════════════════════════
 *
 * «The actual content overlay should always be above the composer bro, with a red outline or
 * something that makes it stick out, and also allow collapsing. It should handle multiple
 * scheduled orders etc. Not be in-line as that's hard to trace.»
 *
 * ── THE WIREFRAME (§51.24) ──────────────────────────────────────────────────────────────────
 *
 *   ┌ EXPANDED ─────────────────────────────────────────────┐
 *   │ ● Orders in this conversation                    ⌃    │  HEAD   mark · label · the fold
 *   ├───────────────────────────────────────────────────────┤
 *   │ Albarán 1418 · Friday 22.08          214,60 €     ›   │  BODY   one row per order,
 *   │ Order · Monday 25.08                  91,00 €     ›   │         each one a door (§43)
 *   └───────────────────────────────────────────────────────┘
 *   ┌ COLLAPSED ────────────────────────────────────────────┐
 *   │ ● 2 orders · today, Friday           305,60 €    ⌄    │  ONE SLIM LINE, the figure kept
 *   └───────────────────────────────────────────────────────┘
 *
 *   REGIONS    head (what this is, and the fold) · body (the orders). Collapsed the two become
 *              one line, and the FIGURE survives the fold — a collapsed overlay that dropped the
 *              money would be a summary of nothing.
 *   TYPE STEPS the label and each order's name at `LabelSmall`; the day and the count at
 *              `ParagraphXSmall`; the figure in the app's own `Figure`, so the unit rides the
 *              number's own line at every width (the price law).
 *   STATES     collapsed by default · hovered on a row (the
 *              row's own ground; GEOMETRY UNTOUCHED — §37.3).
 *   OVERFLOW   every name is ONE line with an end ellipsis; the figure is `nowrap` and never
 *              yields; rows are `ROW` tall, stated, so an order with a long customer word cannot
 *              make its row taller than the one under it. Past three orders the BODY scrolls in
 *              its own bounded port rather than eating the conversation (§77.2).
 *
 * ── IT IS PINNED, WHICH IS A STRUCTURAL FACT AND NOT A z-index ──────────────────────────────
 * It is a flex sibling between the turns' scrollport and the composer's dock, at `flex: 0 0 auto`.
 * So it cannot scroll away with the stream, it cannot be scrolled past, and the stream above it
 * keeps its own single scrollport (§38). «Not in-line as that's hard to trace» is answered by the
 * position rather than by a style.
 *
 * ═══ THE TREATMENT, ARGUED FROM THE LAWS (his «a red outline or something») ══════════════════
 * The choice was between the ACCENT and an ink-plus-elevation treatment, and the accent wins on
 * three tests, at §17.3's strength rather than at full:
 *
 *   1 · WHOSE ACT IS IT? The order in a conversation is what ROCOTO built out of what the
 *       customer said — the same act the readback embed already wears the saffron `ActDot` for
 *       («reading the message is Rocoto's own act», embeds.tsx). Marking it in ink would say the
 *       desk assembled it. The accent law is «Rocoto's own acts ONLY», and this is one.
 *   2 · IS IT A STATUS? No, and that is the test that would have killed it. The overlay is there
 *       whenever the conversation carries an order, whatever state that order is in; the states
 *       inside it are said in WORDS and in the figure, never in a hue. Nothing here is present-
 *       when-bad and absent-when-good, so no traffic light is created (§51, §72.3).
 *   3 · AT WHAT STRENGTH? §17.3 settled that exact question for the embedded chat inside the
 *       albarán — «a FAINT RED LINE around it… the accent at low strength, mixed from theme
 *       tokens (the dotInk recipe), never a hard-coded hue.» This is the same object seen from
 *       the other side, so it takes the same ring: `RING` out of `embeds.tsx`, one recipe.
 *
 * AND STRUCTURE CARRIES THE REST OF THE «STICK OUT». A hairline is a whisper; what makes this
 * unmistakable is that it is ELEVATED off the talk (Base's own `shadow500`), stands on paper while
 * the stream behind it stands on dots, and carries the one full-strength accent mark the app has.
 * Three devices, one meaning, no colour doing a job words could do.
 */

/** What an order is CALLED in this overlay. From `made` on there is a document with a number on
 *  it; before that there is an order being formed and its day is its whole identity. */
function orderName(sale: Sale): string {
  return RANK[sale.state] >= RANK.made ? `Delivery Note ${sale.number}` : 'Order';
}

/** The day, the way a person would say it: «today» where it is today, and the trade's own weekday
 *  otherwise. `deliveryDay` is «Friday 22.08», and a collapsed line holding three of those in full
 *  is a line nobody reads. */
function orderDay(sale: Sale, today: string, short = false): string {
  const near = nearWordOf(sale.day, today);
  if (near) return near;
  return short ? sale.deliveryDay.split(' ')[0] : sale.deliveryDay;
}

type PreferredOrder = { id: string; token: number };

function OrderOverlay({
  orders,
  cast,
  onOpen,
  preferredOrder,
}: {
  orders: Sale[];
  cast: Cast;
  /** One order card has one door: the complete albarán. */
  onOpen?: (sale: Sale) => void;
  preferredOrder?: PreferredOrder;
}) {
  const [, theme] = useStyletron();
  useDismissals();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);
  const appliedPreference = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!preferredOrder || appliedPreference.current === preferredOrder.token || !orders.some((sale) => sale.id === preferredOrder.id)) return;
    setSelectedId(preferredOrder.id);
    appliedPreference.current = preferredOrder.token;
  }, [orders, preferredOrder]);
  const today = todayId(cast);
  if (orders.length === 0) return null;

  const selected = orders.find((sale) => sale.id === selectedId) ?? orders[0];
  const selectedIndex = orders.findIndex((sale) => sale.id === selected.id);
  const move = (delta: number) => setSelectedId(orders[(selectedIndex + delta + orders.length) % orders.length].id);
  const open = () => { if (onOpen) onOpen(selected); else openSale(selected); };
  /* §196.3 · THE PINNED DOCUMENT IS AN OBJECT ABOUT A FLAGGED ORDER, so it wears the red too —
     the outline around the card and the flag's own WORD in the header. `red-flag.tsx` decides
     both; this surface chooses neither the condition nor the colour. */
  const flag = flagStandingOf(selected);
  const flagKind = flag.response ? 'response' as const : flag.check ? 'check' as const : 'marked' as const;
  return <div data-testid="order-overlay" data-order={selected.id} data-orders={orders.length} data-collapsed="yes" data-hover={over ? 'yes' : 'no'}
    onMouseEnter={() => setOver(true)} onMouseLeave={() => setOver(false)}
    data-list-card="inset"
    data-flagged={flag.any ? 'yes' : 'no'}
    style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0,
      margin: `0 ${theme.sizing.scale400} ${theme.sizing.scale400}`,
      outline: flag.any ? flagOutline(theme) : undefined, outlineOffset: '-1px',
      border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400,
      background: over ? theme.colors.backgroundTertiary : theme.colors.backgroundPrimary,
      boxShadow: theme.lighting.shadow500, minWidth: 0, overflow: 'hidden',
      transition: `background-color ${theme.animation.timing400} ${theme.animation.easeOutCurve}` }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200,
      padding: `${theme.sizing.scale300} ${theme.sizing.scale400}` }}>
      <span data-testid="order-overlay-line" style={{ ...theme.typography.LabelSmall, flex: 1,
        minWidth: 0, overflowWrap: 'anywhere' }}>{orderDay(selected, today)} · {selected.number}</span>
      {flag.any && <FlagPill kind={flagKind} testid="order-overlay-flag" />}
      {orders.length > 1 && <div data-testid="order-overlay-pager" style={{ display: 'flex', alignItems: 'center' }}>
        <OrderPagerButton onClick={() => move(-1)} label="Previous planned order" testid="order-overlay-prev"><Chevron towards="left" /></OrderPagerButton>
        <OrderPagerButton onClick={() => move(1)} label="Next planned order" testid="order-overlay-next"><span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Glyph id="caret" size={18} /></span></OrderPagerButton>
      </div>}
      <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="order-overlay-open" onClick={open}
        overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px' } } }}>Open</Button>
    </header>
  </div>;
}

/** The condensed document keeps product and quantity readable while exposing the one-off
 *  resolution actions that change this order. Its single navigation action lives
 *  in the card's upper-right corner, so neither a price nor a second door competes with it. */
function OrderRow({ sale, cast }: { sale: Sale; cast: Cast }) {
  const [css, theme] = useStyletron();
  const { config } = useConfig();
  const catalogue = useCatalogue();
  const phone = usePhone();
  const { inventory } = useWorkspaceCapabilities();
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  useDismissals();
  const now = nowOf(cast);
  const groupConcerns = standingConcernsOf(sale).filter((concern) => concern.kind === 'check' && concern.group && !dismissedNow(sale.id, concern.id));
  const candidatesFor = (line: Sale['lines'][number]) => {
    const baseId = graduatedBase(line.product.id) ?? line.product.id;
    const amendments = amendmentsOf(config.cast, catalogue.state)
      .filter((amendment) => amendment.base === baseId && Boolean(amendment.hand || amendment.sellable))
      .map((amendment) => amendmentProduct(cast, amendment));
    const graduated = graduatedProducts(cast, catalogue.state).filter((product) => graduatedBase(product.id) === baseId);
    return [line.product, ...amendments, ...graduated]
      .filter((product, index, all) => all.findIndex((candidate) => candidate.id === product.id) === index);
  };
  return <div data-testid="order-overlay-items" style={{ display: 'flex', flexDirection: 'column',
    maxHeight: 'min(32vh, 260px)', overflowY: 'auto', padding: `0 ${theme.sizing.scale400} ${theme.sizing.scale300}` }}>
    {groupConcerns.map((concern, index) => <ConcernNote key={concern.id} sale={sale} concern={concern.id}
      says={concern.says} now={now} testid={`order-group-concern${index ? `-${index}` : ''}`} />)}
    <div data-testid="order-overlay-lines-target" data-concern-boundary={groupConcerns.length ? 'standing' : undefined}
      style={{ outline: groupConcerns.length ? `2px solid ${theme.colors.accent}` : 'none', outlineOffset: 2, borderRadius: theme.borders.radius200 }}>
      {sale.lines.map((line) => {
        const concerns = standingConcernsOf(sale).filter((concern) => concern.kind === 'check' && concern.line?.id === line.id && !dismissedNow(sale.id, concern.id));
        const quantityConcern = concerns.find((concern) => concern.id === `flag:unreadable-${line.id}` || concern.id === `flag:unusual-${line.id}`);
        const lineConcerns = concerns.filter((concern) => concern !== quantityConcern);
        const choices = candidatesFor(line);
        const needsSkuChoice = Boolean(line.asked && line.filledBy === 'model' && !line.corrected && !line.skuChosen && !line.nonSku && choices.length > 1);
        return <div key={line.id} data-testid={`order-line-card-${line.id}`} data-list-card="inset"
          data-concern-boundary={lineConcerns.length ? 'standing' : undefined}
          className={css({
            display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0,
            boxSizing: 'border-box', width: '100%', margin: `${theme.sizing.scale100} 0`,
            padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`,
            borderWidth: '1px', borderStyle: 'solid',
            borderColor: lineConcerns.length ? theme.colors.accent : 'transparent',
            borderRadius: theme.borders.radius400, backgroundColor: 'transparent',
            transitionProperty: 'background-color, border-color, box-shadow',
            transitionDuration: theme.animation.timing400, transitionTimingFunction: theme.animation.easeOutCurve,
            ':hover': { backgroundColor: theme.colors.backgroundSecondary, borderColor: lineConcerns.length ? theme.colors.accent : theme.colors.borderOpaque },
            ':focus-within': { backgroundColor: theme.colors.backgroundSecondary, borderColor: lineConcerns.length ? theme.colors.accent : theme.colors.borderSelected,
              boxShadow: `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 6%, transparent)` },
          })}>
          {lineConcerns.map((concern, index) => <ConcernNote key={concern.id} sale={sale} concern={concern.id}
            says={concern.says} now={now} testid={`order-line-concern-${line.id}${index ? `-${index}` : ''}`} />)}
          {quantityConcern && <ConcernNote sale={sale} concern={quantityConcern.id} says={quantityConcern.says} now={now}
            testid={`order-quantity-concern-${line.id}`} />}
          <div data-testid={`order-item-${line.id}`} data-order-item-row="yes"
            style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) minmax(88px, auto)', alignItems: 'center',
              columnGap: theme.sizing.scale400, minHeight: 64, padding: `${theme.sizing.scale200} 0`, flexShrink: 0,
              color: line.nonSku && !line.adopted ? theme.colors.contentSecondary : undefined, fontStyle: line.nonSku && !line.adopted ? 'italic' : undefined }}>
            <ProductFace of={line.product} size={48} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
              <span data-testid={`order-item-title-${line.id}`} data-order-title="yes" style={{ minWidth: 0, overflowWrap: 'anywhere', ...theme.typography.LabelMedium }}>
                {line.product.name}{line.nonSku && <span data-testid={`order-off-sku-${line.id}`}> · {NON_SKU_LABEL}</span>}
              </span>
              {/* ⚠ THE CLASS LED THIS SUB-LINE UNTIL FEED-IA §197.2 «Remove class everywhere»
                  (§193.4): the lot says when the goods came in, the prep note says what the
                  bench was told, and the SKU in the title says the rest. */}
              {((inventoryAvailable && line.lot) || line.prepNote) && (
                <span data-testid={`order-item-note-${line.id}`} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {[inventoryAvailable ? line.lot : undefined, line.prepNote].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            <span style={{ minWidth: 0, whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.sizing.scale100 }}>
              <span data-testid={`order-quantity-${line.id}`} data-order-terminal="yes" data-concern-boundary={quantityConcern ? 'standing' : undefined}
                style={{ border: quantityConcern ? `2px solid ${theme.colors.accent}` : 'none', borderRadius: theme.borders.radius100, padding: quantityConcern ? `${theme.sizing.scale100} ${theme.sizing.scale200}` : 0 }}>
                {line.unreadable ? <span style={theme.typography.ParagraphXSmall}>To confirm</span>
                  : <Figure value={line.given} unit={line.unit} size="default" decimals={Number.isInteger(line.given) ? 0 : 2} />}
              </span>
            </span>
          </div>
          {line.nonSku && !line.adopted && <div data-testid={`order-one-off-actions-${line.id}`} style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap', padding: `${theme.sizing.scale100} 0`, minWidth: 0 }}>
            <Button kind={KIND.secondary} size={SIZE.mini} data-testid={`order-accept-one-off-${line.id}`}
              onClick={() => adoptLine(sale, now, line.id, 'one-off')}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Accept as one-off</Button>
            <Button kind={KIND.tertiary} size={SIZE.mini} data-testid={`order-edit-off-sku-${line.id}`}
              onClick={() => openOrderLine(sale.id, line.id)}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Edit</Button>
            <Button kind={KIND.tertiary} size={SIZE.mini} data-testid={`order-reject-off-sku-${line.id}`}
              onClick={() => removeLine(sale, now, line.id)}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Reject</Button>
          </div>}
          {needsSkuChoice && <div data-testid={`order-sku-choice-${line.id}`} role="group" aria-label="Which product did they mean?"
            style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, padding: `${theme.sizing.scale200} 0 ${theme.sizing.scale300}`, minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.accent }}>Which product did they mean?</span>
            <span style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.sizing.scale200, minWidth: 0 }}>
              {choices.map((product) => <Button key={product.id} kind={KIND.secondary} size={SIZE.compact}
                data-testid={`order-sku-choice-${line.id}-${product.id}`} onClick={() => chooseLineSku(sale, now, line, product)}
                startEnhancer={<ProductFace of={product} size={32} />}
                overrides={{ BaseButton: { style: { justifyContent: 'flex-start', textAlign: 'left', minWidth: 0, minHeight: '44px', height: 'auto' } } }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{product.name}</span>
                  <span data-testid={`order-sku-choice-${line.id}-${product.id}-meta`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, whiteSpace: 'normal' }}>
                    {product.code ? <><ProductCode code={product.code} /> · </> : ''}{product.unit}
                  </span>
                </span>
              </Button>)}
            </span>
            <Button kind={KIND.tertiary} size={SIZE.mini} data-testid={`order-sku-choice-${line.id}-none`}
              onClick={() => rejectLineSkuChoices(sale, now, line)}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Something else</Button>
          </div>}
        </div>;
      })}
    </div>
  </div>;
}
/* ── THE ACT A MESSAGE CAUSED (FEED-IA §77.5b) ────────────────────────────────────────────────
 * «Maybe yeah show tool calls, so we know when a message caused the order to update, for
 * transparency. Part of the transparent data contract we should have.»
 *
 * IT IS A READING, NOT A MESSAGE. Rocoto's readback («Read from WhatsApp as 4 lines for Friday»)
 * is a SENTENCE that left the house on WhatsApp; this line never leaves the app. It says what the
 * tool DID to the order — opened it, raised a line — and what the order stands at afterwards. Two
 * different audiences, so it is not §25.5's same-fact-twice; it is the fourth-register move the
 * reasoning embed already makes with the flag.
 *
 * AND IT IS NOT A COLOUR EVENT. Ink carries every word and every figure. The one accent on the row
 * is the `ActDot`, which is this app's single device for «Rocoto did this» and is the same 6px
 * mark the readback wears an inch above it. No band, no ground, no hue with a meaning.
 *
 * IT RIDES ITS OWN MESSAGE. The line is drawn immediately under the turn that caused it, on that
 * turn's own side of the column, so «which message moved the order» is answered by looking rather
 * than by reasoning about hours.
 */
function ActLine({ act, mine }: { act: OrderAct; mine: boolean }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid="turn-act"
      data-act-order={act.sale.id}
      style={{
        display: 'flex',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        padding: `${theme.sizing.scale100} ${theme.sizing.scale550} ${theme.sizing.scale200}`,
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.sizing.scale200,
          maxWidth: '100%',
          minWidth: 0,
          ...theme.typography.ParagraphXSmall,
          color: theme.colors.contentSecondary,
        }}
      >

        {/* ONE LINE, END ELLIPSIS (§77.2). The act yields its width; the figure never does. */}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {act.did}
        </span>
        <span data-testid="turn-act-now" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
          {act.now}
        </span>
      </span>
    </div>
  );
}

/** §142: the result of a tool call is a short source link, not another card in the exchange. */
function ToolTrail({ embed }: { embed: Embed }) {
  const [, theme] = useStyletron();
  const trailFloor = usePhoneFloorHeight();
  /* A live concern has one home, above the order; repeating it here makes two things to dismiss. */
  if (embed.kind === 'reasoning') return null;
  const product = embed.kind === 'price' ? embed.line.product : null;
  const kind = product ? 'product' : 'order';
  const id = product?.id ?? embed.sale.id;
  return (
    <div
      data-testid="chat-tool-trail"
      data-tool={embed.kind}
      data-order={embed.sale.id}
      style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale200, padding: `${theme.sizing.scale100} ${theme.sizing.scale550} ${theme.sizing.scale200}`, minWidth: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}
    >

      {/* E193.14 · INTX-12: the trail is a LINE, and the whole line is the door into the thing it
          names — so on a phone the line takes the 44px floor rather than the type's own 20. */}
      <a
        href={addressOf(kind, id)}
        onClick={(event) => { event.preventDefault(); if (product) openProduct(product.id); else openSale(embed.sale); }}
        style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', overflowWrap: 'anywhere', minWidth: 0,
          display: 'inline-flex', alignItems: 'center', ...trailFloor }}
      >
        {embedLine(embed)}
      </a>
    </div>
  );
}

/** Controller progress is operational evidence, never a sentence sent to the customer. */
function TheatreTrail({ status }: { status: string }) {
  const [, theme] = useStyletron();
  return (
    <div data-testid="theatre-tool-trail" style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, padding: theme.sizing.scale100 + ' ' + theme.sizing.scale550 + ' ' + theme.sizing.scale200, minWidth: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>

      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status}</span>
    </div>
  );
}

/** §142: one sentence, the existing inline dismissal, and a source door where a real sheet exists. */
function ComposerAttention({ sales, cast }: { sales: Sale[]; cast: Cast }) {
  const [, theme] = useStyletron();
  useDismissals();
  const sale = sales.find((item) => activeAttentionConcernsOf(item).some((concern) => concern.kind === 'response'));
  const concern = sale && activeAttentionConcernsOf(sale).find((item) => item.kind === 'response');
  if (!sale || !concern) return null;
  return <div data-testid="composer-attention" data-order={sale.id} data-reasoned="true" style={{ position: 'relative',
    margin: `-${theme.sizing.scale500} 0 ${theme.sizing.scale300}`, zIndex: 1, minWidth: 0 }}>
    <div data-testid="composer-attention-tray" style={{ display: 'flex', flexDirection: 'column', minWidth: 0,
      border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400,
      background: theme.colors.backgroundPrimary,
      boxShadow: `0 12px 28px color-mix(in srgb, ${theme.colors.contentPrimary} 12%, transparent)` }}>
      <span style={{ padding: `${theme.sizing.scale300} ${theme.sizing.scale300} 0`, ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Reply needed</span>
      <ConcernNote sale={sale} says={concern.says} concern={concern.id} now={nowOf(cast)} testid={`composer-attention-${sale.id}`} />
    </div>
  </div>;
}

/** THE EMULATED PHONE'S PAINT, AS A SCOPE. Off, it renders its children untouched — so a real
 *  conversation pays nothing for a capability it does not have. */
function WhatsappScope({ on, children }: { on: boolean; children: React.ReactNode }) {
  const [, base] = useStyletron();
  const theme = React.useMemo(() => whatsappTheme(base as never), [base]);
  if (!on) return <>{children}</>;
  return <ThemeProvider theme={theme as never}>{children}</ThemeProvider>;
}

/* ── THE ATTACHMENT SLOT (THE CHECKPOINT §10.8) ───────────────────────────────────────────────
 * «The operator can: type; attach images; attach / record voice notes where supported.»
 *
 * IT RIDES INSIDE THE FIELD, which is the Composer's own attachment contract and where people
 * already reach for it. What it offers is the HOUSE'S OWN PHOTOGRAPHS — the written order on a
 * notepad page and the lot label on a box, the two assets this repo actually holds — and each one
 * carries the words drawn IN it, verbatim, so a photograph attached in a test gives the brain
 * something true to read rather than a picture with nothing behind it.
 *
 * A FILE PICKER IS THE PRODUCT'S; THIS IS THE DESIGN BUILD'S. Stated rather than mimed: the slot,
 * the staging row, the removal and the reading are all real and shipped, and what the product adds
 * at this seam is the operating system's own chooser.
 */
function PhotoSlot({ onPick, speaker }: { onPick: (picture: Picture) => void; speaker: string }) {
  const [, theme] = useStyletron();
  return (
    <StatefulPopover
      placement={PLACEMENT.topRight}
      triggerType={TRIGGER_TYPE.click}
      overrides={{ Body: { style: { zIndex: 12 } } }}
      content={({ close }) => (
        <div data-testid="test-photo-menu">
          <StatefulMenu
            overrides={{ List: { style: { minWidth: '240px' } } }}
            items={CHAT_PHOTOS.map((p) => ({ id: p.src, label: p.alt }))}
            onItemSelect={({ item }) => {
              const asset = CHAT_PHOTOS.find((p) => p.src === (item as { id: string }).id);
              if (asset) onPick(pictureOf(asset, speaker));
              close();
            }}
          />
        </div>
      )}
    >
      <Button
        kind={KIND.tertiary}
        size={SIZE.mini}
        shape={SHAPE.circle}
        data-testid="test-attach"
        aria-label="Attach a photo"
        overrides={{ BaseButton: { style: { color: theme.colors.contentTertiary } } }}
      >
        <Glyph id="camera" size={STEP.small} />
      </Button>
    </StatefulPopover>
  );
}

export function ThreadView({
  cast,
  thread,
  threads,
  onBack,
  backLabel,
  /** what the housing puts at the header's end, before the way out — the widget's expand mark */
  actions,
  /** put the whole widget away from inside a conversation — the overlay's own door out */
  onHide,
  onCollapse,
  embedded = false,
  orderId,
  preferredOrder,
  onAimMail,
  aimedMailAt,
}: {
  cast: Cast;
  thread: Thread;
  /** every conversation on the surface — a reply has to land after the latest thing ANY of them
   *  holds, or the list sorts the conversation just written to below the ones left alone */
  threads: Thread[];
  /** THE WAY BACK IS OPTIONAL, AND ITS ABSENCE IS A REAL STATE (FEED-IA §42). At fullscreen the
   *  list stands beside the conversation, so «the list is that way» would point at something
   *  already on screen — a control that navigates to where you are is furniture. */
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  onHide?: () => void;
  /** Collapse for a full albarán while retaining the focused thread in the chat store. */
  onCollapse?: () => void;
  /** Inline albarán keeps the same renderer but removes workspace-only furniture. */
  embedded?: boolean;
  orderId?: string;
  preferredOrder?: PreferredOrder;
  /* ── EMBEDDED, THE AIM BELONGS TO THE HOUSING (§196.7 clause 1 · §246 acceptance 5) ────────
     Inside the albarán's chip this renderer draws the turns and the CHIP draws the composer, so
     Reply on a mail turn has to reach the surface that owns the writing. It used to aim this
     component's own state at a composer `!embedded` had switched off — the button flipped to
     «Replying» and the chip's composer stayed exactly where it was. Where the housing hands
     these in, the aim is theirs; where it does not, no inert Reply is painted at all. */
  onAimMail?: (row: ThreadTurn) => void;
  aimedMailAt?: string;
}) {
  const [, theme] = useStyletron();
  /* INTX-12's 44px floor for the head's own name door (E193.14) */
  const touchFloor = usePhoneFloorHeight();
  useScopedConversationNotes(cast.sector);
  const [text, setText] = useThreadDraft(cast, thread.id);
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  /** §196.7 · the reply composer's own take, so the dock holds its height for it too (§13) */
  const [replyBusy, setReplyBusy] = React.useState(false);
  /* ── WHAT THIS CONVERSATION'S OWN CHANNEL IS (§246 acceptance 5) ──────────────────────────
     The account's door decides which seat stands under the stream, and an email door standing in
     the conversation is what makes «Reply by email instead» an honest offer. Both are pure reads
     of facts already here, so the seat and the composer's own standing agree by construction. */
  const conversationAccount = accountChannelOf(thread.customer.channel);
  const conversationEmailStanding = conversationEmailDoor(thread.customer, thread.rows);
  /* ONE SEAT LAW, READ RATHER THAN RESTATED. This housing and the albarán's chip each computed it
     out of the same three facts, in two files, and `ChannelStanding.writes` stated it a third
     time; `conversationSeatOf` is the one derivation both housings call now. */
  const conversationSeat = conversationSeatOf(thread.customer, thread.rows);
  const conversationWrites = conversationSeat === 'composer';
  /** §196.7 clause 1, inside a MIXED timeline: Reply on one mail turn aims this conversation's
   *  own composer at that message, whatever channel the account usually answers on. */
  const [aimedMail, setAimedMail] = React.useState<{ id: string; subject?: string; from?: string; provider?: EmailProvider } | null>(null);
  React.useEffect(() => { setAimedMail(null); }, [thread.id]);
  /* WHO TAKES THE AIM, AND WHETHER REPLY IS PAINTED AT ALL. Embedded: the housing's own composer.
     In Messages: this component's, and only where a composer actually stands — a telephone
     account answers by calling, so a Reply button over its mail turn would be a control that
     changes nothing. */
  /* ⚠ THE AIM CARRIES THE MAIL, RATHER THAN THE WHOLE TURN. `setAimedMail` was handed straight to
     the card as its `onReply`, so React's setter stored the entire `ThreadTurn` — and `emailTo`
     and `emailSubject` came off `aimedMail.from` / `.subject`, which a ThreadTurn has no such
     fields for. The composer then opened a BLANK mailto under «Answering the email above.» The aim
     is built here, from the row's own mail metadata, and it carries the provider with it so the
     door is the mailbox the message actually arrived in. */
  const aimMail = embedded
    ? onAimMail
    : (conversationWrites
      ? (row: ThreadTurn) => setAimedMail({
        id: row.id,
        subject: row.email?.subject,
        from: row.email?.from,
        provider: row.email?.source?.provider,
      })
      : undefined);
  const aimedMailId = embedded ? aimedMailAt : aimedMail?.id;
  /** what this reply is aimed at (§47.1) */
  const [replyTo, setReplyTo] = React.useState<Quote | null>(null);
  /** the turn whose reaction set is open */
  const [picking, setPicking] = React.useState<string | null>(null);
  /** the turn a quote has just walked to, held long enough to be seen */
  const [landed, setLanded] = React.useState<string | null>(null);
  /** One message owns the order and clues it produced. The rest of the conversation stays calm. */
  const [expandedTurn, setExpandedTurn] = React.useState<string | null>(null);
  const [detailObscured, setDetailObscured] = React.useState(false);
  const [newTurns, setNewTurns] = React.useState(0);
  /** THE READING THAT LANDS ON THEIR OWN SEND (§110's co-presence) — a fact, held four seconds */
  const [learned, setLearned] = React.useState(false);
  /** the picture on the overlay (§47.3) */
  const [photo, setPhoto] = React.useState<Picture | null>(null);
  /** ── THE ANXIETY A PERSON HAS OPENED (FEED-IA §127.1) ──────────────────────────────────────
   *  «If there's something that clearly needs attention, they click on it.» It is the DOCUMENT
   *  that is held here rather than a boolean, because the card is about one order and a
   *  conversation can be carrying three. */
  const [anxious, setAnxious] = React.useState<Sale | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const turns = React.useRef<HTMLDivElement>(null);
  const atBottom = React.useRef(true);
  const previousRows = React.useRef<{ thread: string; count: number }>({ thread: '', count: 0 });
  const calm = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ══ THE TEST CHAT'S WIRING (THE CHECKPOINT §10) ═══════════════════════════════════════════
   * A test conversation is a `Thread`, so everything else in this component draws it unchanged:
   * the same bubbles, the same voice and photo organs, the same whispers, the same pinned order
   * overlay. THREE THINGS DIFFER, and they are all in this block and the four handlers under it:
   *
   *   WHO IS WRITING   the operator types AS THE CUSTOMER — «the chat then behaves as if messages
   *                    are arriving from that customer» (§10.3) — so a typed turn lands as
   *                    `received` and Rocoto answers it.
   *   WHAT LANDS       `readTestMessage` runs the demo world's own brain on the words and the
   *                    reading is kept beside the message that caused it.
   *   WHAT OPENS       the inspector, under the message it is about (§10.9).
   *
   * The world is read unconditionally — hooks may not be called behind a branch — and costs
   * nothing on a real conversation, which never looks at it.
   */
  const world = useTestWorld();
  const test = thread.test;
  /* ── WHICH ORDERS IN THIS CONVERSATION ARE FLAGGED (§196.3) ────────────────────────────────
     `red-flag.tsx`'s own fold, read once per conversation. A turn belongs to a document by the
     `orderId` the theatre writes or by the `sale.id:` prefix `threads.ts` keys every source row
     with — so the claim reaches the actual message the flagged order arrived on. */
  const dismissedNow_ = useDismissals();
  const flaggedOrders = React.useMemo(() => {
    const marked = new Set<string>();
    for (const sale of [...thread.forming, ...thread.messageOnly]) if (flagStandingOf(sale).any) marked.add(sale.id);
    return marked;
  }, [thread.forming, thread.messageOnly, dismissedNow_]);
  const flaggedTurn = React.useCallback((row: ThreadTurn): boolean => {
    if (row.orderId) return flaggedOrders.has(row.orderId);
    const prefix = row.id.slice(0, row.id.indexOf(':'));
    return prefix.length > 0 && flaggedOrders.has(prefix);
  }, [flaggedOrders]);
  /** the photograph staged in the composer, before it is sent (§10.8's «attach images») */
  const [staged, setStaged] = React.useState<Picture | null>(null);
  /* ── AND WHICH SIDE OF THE GLASS (FEED-IA §91.4.8) ──────────────────────────────────────────
     «They START as the WhatsApp side.» It is state on the conversation rather than a preference:
     every roleplay opens where a roleplay begins, on the customer's own phone. */
  const [view, setView] = React.useState<TestView>('customer');

  /* a different conversation starts with an empty bar, with nothing aimed, and — where it is a
     test — on the customer's side, which is where a roleplay starts */
  React.useEffect(() => {
    setReplyTo(null);
    setPicking(null);
    setPhoto(null);
    setStaged(null);
    setView('customer');
    setLearned(false);
    setAnxious(null);
    setExpandedTurn(null);
    setDetailObscured(false);
    setNewTurns(0);
    atBottom.current = true;
  }, [thread.id]);

  /* THE READING CLEARS ITSELF (§110). It is a fact about a moment, so it lasts a moment — and it
     is cancelled on the way out, because a timer that fires into an unmounted conversation is the
     app talking about a screen nobody is on. */
  React.useEffect(() => {
    if (!learned) return undefined;
    const t = window.setTimeout(() => setLearned(false), LEARNED_MS);
    return () => window.clearTimeout(t);
  }, [learned]);

  /* ── WHAT ROCOTO PREPARED AND HELD, FOR THE PERSON WRITING (§110 · §9.11 · §83.2) ───────────
     One fold, in `sale.ts`, over the orders this conversation is carrying: the withheld reading of
     the one the person is being held by. A TEST conversation has none — its readings are the
     inspector's own, drawn under the message that caused them (§10.9), and a second offer in the
     bar would be the same claim twice on one screen. */
  const ghost = React.useMemo(() => {
    if (test) return null;
    const held = ghostOf(thread.forming);
    /* §142: a readback already drawn as a tool trail needs no second prefill above the field.
     * Keep §110's genuinely withheld suggestion when the conversation carries no such trail. */
    const alreadyRead = held && thread.rows.some((row) => row.embed?.kind === 'readback'
      && !row.act && row.embed.sale.id === held.sale);
    return alreadyRead ? null : held;
  }, [test, thread.forming, thread.rows]);

  /* ── A QUOTE WALKS TO WHAT IT QUOTES (§47.1, §25.2) ─────────────────────────────────────────
     The scrollport is told where to stand — `scrollIntoView` would drag every scroller between
     here and the window, which on the desk means the page behind a 400px panel moves too. And the
     arrival is MARKED: a message you were walked to in a thread of forty is a message you have to
     be able to find with your eye once you get there. The mark is a ring of ink, held for a
     moment, on Base's own timing. */
  const jumpTo = React.useCallback((id: string) => {
    const port = turns.current;
    const target = port?.querySelector<HTMLElement>(`[data-turn="${CSS.escape(id)}"]`);
    if (!port || !target) return;
    port.scrollTop = target.offsetTop - port.clientHeight / 3;
    setLanded(id);
    window.setTimeout(() => setLanded((was) => (was === id ? null : was)), 1400);
  }, []);

  const react = React.useCallback(
    (turnId: string, emoji: string) => toggleReaction(cast.sector, turnId, emoji),
    [cast.sector],
  );

  /* THE ORDER THE DOOR NAMED, AND THE EYE MOVED TO IT (§202.3 · OUT-05.2). «Open the chat» on an
     albarán carries that albarán, so the panel lands on that order's own first turn instead of at
     the foot of a year of talk. The whole conversation stays — an act on ONE document has no
     business hiding the customer's other messages — so this MOVES the eye, exactly as a quote's
     own walk does. The token makes a second press on the same order land again. */
  const landedOrder = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!preferredOrder || landedOrder.current === preferredOrder.token) return;
    landedOrder.current = preferredOrder.token;
    const first = thread.rows.find((row) => row.orderId === preferredOrder.id
      || row.id.startsWith(`${preferredOrder.id}:`));
    if (first) window.setTimeout(() => jumpTo(first.id), 0);
  }, [jumpTo, preferredOrder, thread.rows]);

  /** aiming a reply puts the caret in the bar, because aiming is the first half of writing */
  const aim = React.useCallback((turn: ThreadTurn, who: string) => {
    setReplyTo({ id: turn.id, who, line: turnWords(turn) });
    inputRef.current?.focus();
  }, []);

  /* THE NEWEST TURN IS THE ONE YOU ARE LOOKING AT — and the surface that moves to show it is THIS
     ONE. `scrollIntoView` on the last turn scrolls every scrollport between here and the window,
     so on the desk a reply sent in a 340px column also dragged the page behind it. The scrollport
     owns its own scroll: the column is told where to stand, and nothing outside it moves. */
  /* AND THE NEWEST TURN CAN GROW AFTER IT ARRIVES (§46.2). A take lands saying «transcribing…»
     and is a line taller a moment later, when the words replace it — so a scroll keyed only on
     how many rows there are left the message a person had just recorded half under the composer.
     The key therefore includes whether the last turn's words have landed. */
  const lastHeard = thread.rows[thread.rows.length - 1]?.voice?.transcript ? 'heard' : 'waiting';
  React.useEffect(() => {
    const el = turns.current;
    if (!el) return;
    const previous = previousRows.current;
    const changedThread = previous.thread !== thread.id;
    const added = changedThread ? 0 : Math.max(0, thread.rows.length - previous.count);
    previousRows.current = { thread: thread.id, count: thread.rows.length };
    if (changedThread || atBottom.current) {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
      setNewTurns(0);
    } else if (added > 0) setNewTurns((count) => count + added);
  }, [thread.rows.length, thread.id, lastHeard]);

  React.useEffect(() => {
    if (!expandedTurn) return undefined;
    const timer = window.setTimeout(() => {
      const port = turns.current;
      const target = port?.querySelector<HTMLElement>(`[data-message-detail="${CSS.escape(expandedTurn)}"]`);
      if (!port || !target) return;
      const portRect = port.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (target.offsetHeight > port.clientHeight) {
        port.scrollTop = Math.max(0, port.scrollTop + targetRect.top - portRect.top - 8);
        setDetailObscured(true);
      } else if (targetRect.top < portRect.top) port.scrollTop = Math.max(0, port.scrollTop + targetRect.top - portRect.top - 8);
      else if (targetRect.bottom > portRect.bottom) port.scrollTop += targetRect.bottom - portRect.bottom + 8;
    }, calm ? 0 : 400);
    const closeAway = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`[data-message-detail="${CSS.escape(expandedTurn)}"]`)) return;
      setExpandedTurn(null);
      setDetailObscured(false);
    };
    document.addEventListener('pointerdown', closeAway);
    return () => { window.clearTimeout(timer); document.removeEventListener('pointerdown', closeAway); };
  }, [expandedTurn, calm]);

  /* ═══ THE ORDER IS NEVER IN THE STREAM (FEED-IA §77.5 · AUDIT-2 C9) ═════════════════════════
   * «Not be in-line as that's hard to trace… NEVER INLINE IN THE STREAM.»
   *
   * The overlay above the composer was built and the inline card was left standing, so Bar Manolo's
   * conversation drew the order TWICE — «Albarán 2208-110 / Out today / 1213,77 €» as a card in the
   * talk and «Albarán 2208-110 · Today 1213,77 € ›» in the pinned overlay a few pixels below it.
   * Two loci for one object is the exact thing «hard to trace» names, and §43's object law says
   * which one survives: the ONE that is always in front of the person writing.
   *
   * SO THE DOCUMENT CARD LEAVES THE STREAM, AND ONLY IT. A conversation still carries every other
   * embed the fold makes, because none of them is the order:
   *   readback   what Rocoto READ the message as — a sentence that went out on WhatsApp, drawn
   *   price      the answer that went out, stamped with the hour it was set
   *   reasoning  §142 moves the concern above the order card, with its inline dismissal
   * and the act lines (§77.5b) still say, message by message, what moved the order. What the talk
   * loses is a second drawing of the document; what it keeps is the whole trace of how it came to
   * be. The albarán's own doors are the overlay's row and the river.
   *
   * IT IS A FILTER RATHER THAN A DELETION IN THE FOLD because `embedsOf` feeds the LIST's one-line
   * preview too (§12: at 300 orders a day an embed must also exist as one line), and that line is
   * a row in a list — never a card in the stream. One fold, two readers, and this is the reader
   * that §77.5 speaks to.
   *
   * A ROW THAT CARRIED NOTHING ELSE GOES WITH IT. The document arrives as a turn of its own — no
   * sentence, no recording — so stripping its embed would leave an empty turn drawing a day
   * whisper over nothing. The filter keeps every row that still says something.
   */
  const stream = React.useMemo(
    () =>
      thread.rows
        .map((r) => (r.embed?.kind === 'albaran' || r.embed?.kind === 'reasoning' ? { ...r, embed: undefined } : r))
        .filter((r) => r.text || r.voice || r.picture || r.embed || r.act),
    [thread.rows],
  );

  /* ── THE SUBJECT IS PRINTED WHERE IT CHANGES (§40.3 · §25.5) ───────────────────────────────
     `EmailConversation` has always done this: three mails on «Order for Monday» print the subject
     once, because the same fact three times in one column is the crowding this file is explicit
     about avoiding everywhere else. The chat stream mounted the SAME card with
     `showSubject={Boolean(row.email?.subject)}`, so a mixed conversation printed the heading on
     every consecutive mail turn. The rule is folded here, over the MAIL turns only: a WhatsApp
     bubble standing between two mails on one subject is still one subject. */
  const mailSubjectShown = React.useMemo(
    () => (test ? new Map<string, boolean>() : mailSubjectsShown(stream, thread.customer)),
    [stream, test, thread.customer],
  );

  /* ── THE FOUR TEST HANDLERS ─────────────────────────────────────────────────────────────────
     Each one runs the SAME brain on whatever arrived — typed words, the words drawn in a
     photograph, the words a take carried — because on the product all three arrive as a message
     and none of them is a different kind of order. */

  /** the reading a message produced, for the panel that opens under it */
  const readingOfRow = React.useCallback(
    (row: string): TestReading | undefined => test?.readings.find((r) => r.row === row),
    [test],
  );

  /* ── WHERE THE PANEL STANDS (THE CHECKPOINT §10.9, read as a person reads) ──────────────────
     «Beneath the message or order.» Mounted on the message itself it landed BETWEEN the customer's
     words and Rocoto's answer to them — the panel explaining a reply the reader had not seen yet,
     and the exchange cut in half. So it stands after the LAST row that belongs to the turn: the
     message, what Rocoto said back, and then what Rocoto decided.
     THE GROUPING IS THE ROW IDS' OWN. A turn writes `q3` and `q3-ai0`, `q3-ai1`, so the base of an
     id is its turn — no second structure, and the panel cannot drift from the rows it is about. */
  const turnOf = (id: string): string => id.split('-')[0];
  const panelAfter = React.useCallback(
    (rows: ThreadTurn[], i: number): string | null => {
      const here = turnOf(rows[i].id);
      if (!readingOfRow(here)) return null;
      const next = rows[i + 1];
      return !next || turnOf(next.id) !== here ? here : null;
    },
    [readingOfRow],
  );

  /* ══ THE TRACE — OPENING A CONVERSATION PLAYS ITS STORY (FEED-IA §120.1) ═══════════════════
   * «Maybe each time we open a new chat or we go to any of the historical chats, it shows the
   * animation of them. It's a bit like in a demo, where we can trace what's going on: the theatre,
   * the order, and then something gets clarified, and then the order updates and the confidence
   * level updates.»
   *
   * THE BEATS ARE `thread-trace.ts`'S, and this component only MOUNTS them: each turn's words,
   * the act line that says what moved the order, the inspector that says what Rocoto decided, the
   * pinned order face, and — last, always — the tick. Everything is in the DOM from the first
   * frame and every beat is PAINT, so a trace can move no layout and hide no fact.
   *
   * IT PLAYS ONCE PER CONVERSATION. A person re-opening a thread to READ it is not made to sit
   * through the performance again; the record stands, and the header's own mark plays it back.
   */
  const plan = React.useMemo(
    () => planOf(stream.map((r, i): TraceRow => ({
      author: r.author,
      spoken: Boolean(r.text || r.voice || r.picture),
      moved: Boolean(r.act || r.embed),
      read: Boolean(test && panelAfter(stream, i)),
    }))),
    [stream, test, panelAfter],
  );
  const cadence = React.useMemo(() => beatMs(theme.animation.timing400), [theme]);
  const trace = useTrace(thread.id, plan.beats, cadence);
  const theatrePlay = preferredOrder?.token;
  React.useEffect(() => {
    // Explicit demo events already have their own clock; the opening trace must not hide them.
    if (theatrePlay !== undefined) trace.land();
  }, [theatrePlay, trace.land]);
  const beat = useBeat();
  /* ANY INPUT LANDS IT (§4.5). A press, a key or a wheel puts the whole conversation on screen —
     nobody is ever made to wait out a piece of theatre to reach the thing they came for. */
  const landTrace = trace.playing ? trace.land : undefined;

  /* ── THE ANXIETY AGES, IT NEVER EVAPORATES (§127.3's second tense) ─────────────────────────
     `policyOf` recomputes from the document's CURRENT state, so the instant a hold is acted on
     the reasoning would EVAPORATE and the aged door would open onto nothing. So the birth is
     written down the moment a person meets it: the verdict, the sentence it was held on, and the
     action it asked for, stamped with the hour. `rememberAnxiety` writes ONCE — a second write
     would re-date the reading against a document somebody has since edited. */
  React.useEffect(() => {
    for (const sale of thread.forming) {
      const owed = actionOwed(sale);
      if (!owed) continue;
      const p = policyOf(sale);
      rememberAnxiety({ sale: sale.id, policy: p.id, withheld: p.withheld ?? p.says, owed, at: nowOf(cast) });
    }
  }, [thread.forming, cast]);

  /* ── WHAT THE ANXIETY CARD IS ABOUT, WHERE ONE IS OPEN (§127.1) ────────────────────────────
     The ACTION is `tick.tsx`'s fold, subscribed — so a dismissal taken on the card closes it by
     settling the very document it was about. The MESSAGE is the last thing the customer actually
     said in this conversation: «we show the message, then the reasoning… and then the full
     order». A conversation where nothing arrived quotes nothing, which is the honest shape. */
  const anxiousOwed = useOwed(anxious, test?.subject.kind === 'new');
  const anxiousMessage = React.useMemo(() => {
    const said = [...thread.rows].reverse().find((r) => r.author === 'received' && (r.text || r.voice?.transcript));
    return said ? (said.text || spokenWords(said.voice?.transcript) || undefined) : undefined;
  }, [thread.rows]);

  /* ── AND WHILE THE TRACE IS PLAYING, THE GLASS FOLLOWS IT (§120.1) ─────────────────────────
     A beat that has not landed still holds its box — that is what makes the trace move no layout
     — so a port anchored at `scrollHeight` would put the story that IS on screen above the fold
     and show a person a page of empty ground. While it plays, the port stands at the foot of the
     NEWEST LANDED beat, so the conversation builds itself at the bottom of the glass the way a
     live one does. On landing it hands the port straight back to the effect above. */
  React.useEffect(() => {
    const el = turns.current;
    if (!el) return;
    if (!trace.playing) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    const on = el.querySelectorAll<HTMLElement>('[data-beat-on="yes"]');
    const last = on[on.length - 1];
    if (last) el.scrollTop = Math.max(0, last.offsetTop + last.offsetHeight - el.clientHeight);
  }, [trace.shown, trace.playing]);

  /** the order the conversation has built so far — what the next message adds to */
  const priorSale = test && test.readings.length > 0 ? test.readings[test.readings.length - 1].sale : undefined;

  /** the suggestions this situation offers, and which of them the operator has taken (§91.4.8) */
  const suggestions = React.useMemo(
    () => (test ? suggestionsFor(cast, test.subject) : []),
    [cast, test],
  );

  const sendTest = (t: ThreadTest, override?: string) => {
    const said = (override ?? text).trim();
    if (!said && !staged) return;
    const turn = thread.rows.length;
    const at = testHour(cast, turn + 1);
    const row = `q${turn}`;
    /* WHAT ROCOTO READS IS WHAT ARRIVED. A photograph of a written order IS an order (§47.3), so
       where nothing was typed the words drawn in the picture are the message. */
    const words = said || spokenWords(staged?.reading);
    const reading = readTestMessage(world, t.subject, words, row, at, priorSale);
    pushTestTurn(
      cast.sector,
      thread.id,
      { id: row, author: 'received', text: said, time: at, picture: staged ?? undefined },
      reading.replies.map((w, i) => ({ id: `${row}-ai${i}`, author: 'ai' as const, text: w, time: at, grouped: i > 0 })),
      reading,
    );
    /* THE SEAM THE GUIDE LISTENS ON (§91.4.7). Facts about what happened, never a step number. */
    const suggested = suggestions.some((s) => s.words === said);
    announce(TEST_EVENTS.sent, { thread: thread.id, suggested });
    announce(TEST_EVENTS.replied, { thread: thread.id, policy: reading.policy.id, owed: reading.policy.owed ?? 'none' });
    if (!suggested) announce(TEST_EVENTS.free, { thread: thread.id });
    setStaged(null);
    setText('');
    inputRef.current?.focus();
  };

  /** THE HOUSE'S OWN VOICE (the demo's `deskComposer`, rebuilt). On the house side the person at
   *  the desk is the HOUSE, so what they write goes out as the house's own message and never
   *  through the order brain — which is the whole difference the two tabs are for. */
  const sendAsHouse = () => {
    const said = text.trim();
    if (!said) return;
    const turn = thread.rows.length;
    const at = testHour(cast, turn + 1);
    setText('');
    pushTestDeskTurn(cast.sector, thread.id, { id: `d${turn}`, author: 'sent', text: said, time: at });
    inputRef.current?.focus();
  };

  const recordTest = (t: ThreadTest, durationMs: number) => {
    const turn = thread.rows.length;
    const at = testHour(cast, turn + 1);
    const row = `q${turn}`;
    /* THE WORDS ARE THE HOUSE'S OWN RECORDED ORDER (`cast.order.words`) — a real customer's real
       sentences, already in the cast. A take this surface cannot hear is never given words that
       are not somewhere in the repo (the seeding law, `threads.ts`). */
    const words = cast.order.words.join(' ');
    const heard = utterancesOf(words, thread.customer.name);
    pushTestVoice(cast.sector, thread.id, {
      id: row,
      author: 'received',
      text: '',
      time: at,
      voice: { durationMs, seed: `${cast.sector}-${thread.id}-${row}`, transcript: null },
    });
    const prior = priorSale;
    window.setTimeout(() => {
      const reading = readTestMessage(world, t.subject, words, row, at, prior);
      landTestVoice(
        cast.sector, thread.id, row, heard,
        reading.replies.map((w, i) => ({ id: `${row}-ai${i}`, author: 'ai' as const, text: w, time: at, grouped: i > 0 })),
        reading,
      );
      announce(TEST_EVENTS.sent, { thread: thread.id, suggested: false });
      announce(TEST_EVENTS.replied, { thread: thread.id, policy: reading.policy.id, owed: reading.policy.owed ?? 'none' });
    }, TRANSCRIBING_MS);
  };

  /* ── THE GUIDE'S OWN HAND (THE-JOURNEY-CANON §4.5: «Next PERFORMS the act») ─────────────────
     One listener, live only while a test conversation is open. Every act it can ask for is an act
     a person can perform on this screen, and performing it publishes exactly the same facts — so
     the guided path and the real path are one path. */
  React.useEffect(() => {
    if (!test) return undefined;
    const run = (e: Event) => {
      const detail = (e as CustomEvent).detail as { act?: string; view?: TestView } | undefined;
      if (!detail) return;
      if (detail.act === 'flip' && (detail.view === 'customer' || detail.view === 'house')) {
        setView(detail.view);
        announce(TEST_EVENTS.view, { thread: thread.id, view: detail.view });
        return;
      }
      if (detail.act === 'send-suggested') {
        const first = suggestions[0];
        /* IT SENDS, it does not merely fill: a beat that left the words in the box would leave a
           person who pressed Next on a screen that had not moved (§4.5). The words are handed to
           the sender directly, because the field's own state lands a frame later. */
        if (first) sendTest(test, first.words);
        return;
      }
      if (detail.act === 'open-panel') {
        setView('house');
        window.setTimeout(() => {
          const port = turns.current;
          const panel = port?.querySelectorAll<HTMLElement>('[data-testid="test-panel"]');
          const last = panel && panel[panel.length - 1];
          if (port && last) {
            if (last.dataset.open !== 'yes') last.querySelector<HTMLButtonElement>('[data-testid="test-panel-toggle"]')?.click();
            port.scrollTop = last.offsetTop - port.clientHeight / 3;
          }
        }, 60);
      }
    };
    window.addEventListener(TEST_DO, run);
    return () => window.removeEventListener(TEST_DO, run);
  }, [test, thread.id, suggestions]);

  const markCorrect = (row: string) => {
    markTestReading(cast.sector, thread.id, row, { kind: 'correct', at: nowOf(cast), test: true });
  };

  /** THE CORRECTED FIELD, RECORDED (§10.11). Only what actually moved is written — a mark that
   *  restates the reading would be a training example teaching nothing. */
  const applyCorrection = (
    reading: TestReading,
    fix: { line: string; word: string; qty: string; unit: string },
  ) => {
    const line = reading.sale.lines.find((l) => l.id === fix.line);
    if (!line) return;
    const wasQty = line.unreadable ? '' : amountWords(line.given);
    const mark: TestMark = {
      kind: 'corrected',
      at: nowOf(cast),
      test: true,
      line: fix.line,
      word: fix.word.trim() && fix.word.trim() !== line.product.name
        ? { was: line.product.name, now: fix.word.trim() } : undefined,
      unit: fix.unit.trim() && fix.unit.trim() !== line.unit
        ? { was: line.unit, now: fix.unit.trim() } : undefined,
      qty: fix.qty.trim() !== wasQty ? { was: wasQty, now: fix.qty.trim() } : undefined,
    };
    markTestReading(cast.sector, thread.id, reading.row, mark);
  };

  const send = () => {
    if (!test) return;
    if (view === 'house') sendAsHouse();
    else sendTest(test);
  };

  return (
    <div
      data-testid="thread-view"
      data-thread-open={thread.id}
      /* §202.3 · OUT-05.2 — WHICH ALBARÁN'S EXCHANGE THE PANEL IS STANDING ON. `openChat` carries
         the order the caller was in, and the panel lands on that order's own first turn instead of
         at the foot of a year of talk. The whole conversation stays: an act on ONE document has no
         business hiding the customer's other messages, so this MOVES the eye rather than filtering
         the rows — the same thing `jumpTo` does for a quote. */
      data-standing-order={preferredOrder?.id}
      data-test={test ? 'yes' : 'no'}
      data-test-label={test?.label}
      /* ── THE TRACE, STATED (§120.1 · §61.2) ────────────────────────────────────────────────
         The performance is a fact about this screen, so it is on the element rather than only in
         a component's head: how many beats the conversation planned, how many have landed, and
         the beat vocabulary itself — so the story is checkable from outside without reading a
         pixel. `data-trace` is `playing` while it runs and `played` once it has settled. */
      data-trace={trace.playing ? 'playing' : 'played'}
      data-beats={plan.beats}
      data-shown={trace.shown}
      data-beat-kinds={plan.kinds.join(' ')}
      onPointerDownCapture={landTrace}
      onKeyDownCapture={landTrace}
      onWheelCapture={landTrace}
      /* WHICH DOCUMENT ROCOTO IS BEING CO-PRESENT ABOUT (§110). The offer is a control on screen;
         this is the fact behind it, stated where anything can read it without pressing anything. */
      data-ghost={ghost?.sale}
      /* THE STORE'S OWN MARKS, STATED (§10.11's «clearly identified as test data»). One entry per
         marked reading — the row, what was said about it, and the flag the mark carries — so the
         claim «what reaches the learning seam is flagged» is checkable from outside the component
         rather than trusted. */
      data-test-marks={
        test
          ? Object.entries(test.marks)
              .map(([row, m]) => `${row}:${m.kind}:${m.test ? 'test' : 'live'}`)
              .join(' ') || undefined
          : undefined
      }
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}
    >
      {/* THE HEADER SAYS WHOSE CONVERSATION THIS IS (FEED-IA §40.2). The name at LabelLarge, and
          ONE quiet sub-line under it: the channel their orders arrive on, and the person who holds
          the account (§12 — the resolving is per comercial, so the comercial is the fact worth
          carrying here). Back and close are marks on 36px targets; a 400px header cannot spend two
          words on furniture and still give the name its line.
          The flip takes a line of its own, which is also the prominence §5.3 asks of it. */}
      {!embedded && <header
        data-testid="thread-header"
        style={{
          display: 'grid',
          gridTemplateColumns: '48px minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: theme.sizing.scale200,
          /* Controls meet their header edges. The conversation itself keeps its readable centre
             measure below; only navigation gets the generous edge targets. */
          padding: `${theme.sizing.scale100} 0`,
          borderBottom: `1px solid ${theme.colors.borderOpaque}`,
          background: theme.colors.backgroundPrimary,
          flex: '0 0 auto',
          minWidth: 0,
        }}
      >
        <span data-testid="thread-header-left" style={{ display: 'inline-flex', width: 48, minWidth: 0 }}>
          {onBack && <HeaderButton onClick={onBack} label="Back" testid="thread-back"><Chevron towards="left" /></HeaderButton>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
          <span aria-hidden="true" style={{ flex: '0 0 auto', display: 'inline-flex' }}><Avatar name={thread.customer.name} size="scale900" /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            {test ? <>
              <span data-testid="thread-test-label" style={{ ...theme.typography.LabelMedium, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.label}</span>
              <span data-testid="thread-test-sub" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Test chat</span>
            </> : <>
              <CustomerHoverCard customer={thread.customer}>
                {/* E193.14 · INTX-12: the name is the door to the account and a thumb gets 44px
                    on it; the words stay LabelMedium and stand in the middle of the taller box. */}
                <button type="button" data-testid="thread-customer-door" onClick={() => openCustomer(thread.customer.id)}
                  style={{ ...theme.typography.LabelMedium, display: 'flex', alignItems: 'center', ...touchFloor, maxWidth: '100%', minWidth: 0, overflow: 'hidden', background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {/* ⚠ THE ELLIPSIS NEEDS A BLOCK. `text-overflow` is inert on a flex container, so
                      the name was cut mid-letter at 400px with nothing saying it had been. */}
                  <span style={{ display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Name of={thread.customer} /></span>
                </button>
              </CustomerHoverCard>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale100, maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
                {thread.customer.channel === 'WhatsApp' && <WhatsAppMark size={15} testid="thread-whatsapp-logo" />}
                {/* ONE CHANNEL, ONE WORD, EVERYWHERE (§246 acceptance 5). This joined the cast's
                    own value straight into the sentence, so the Delivery Note chip said «Phone»
                    and this header said «phone · Marc» about the same account — and a portal
                    account read «portal». `channelWord` is the label, written once
                    (`reply-channel.ts`), and the chip's header reads the same function. */}
                <span style={{ display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[channelWord(thread.customer.channel), comercialOf(cast, thread.customer)?.name].filter(Boolean).join(' · ')}
                </span>
              </span>
            </>}
          </span>
        </span>
        <span data-testid="thread-header-actions" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 }}>
          {plan.beats > 2 && <HeaderButton onClick={trace.replay} label="Replay" testid="trace-replay"><Glyph id="reset" size={STEP.small} /></HeaderButton>}
          {actions}
          {onHide && <HeaderButton onClick={onHide} label="Close chat" testid="hide-chats-thread"><Chevron towards="down" /></HeaderButton>}
        </span>
      </header>}

      {/* ── THE ROLEPLAY'S TWO VIEWS (FEED-IA §91.4.8) ────────────────────────────────────────
          Two renderers over one log: the tabs sit between the header and whichever side is
          showing, and flipping them re-renders the same `stream` — it never re-fetches, never
          restarts and never drops a message, because there is only one array. */}
      {test && <TestViewTabs view={view} onView={(next) => {
        setView(next);
        announce(TEST_EVENTS.view, { thread: thread.id, view: next });
      }} />}

      {test && view === 'customer' ? (
        <WhatsappPane
          house={cast.house.name}
          rows={stream}
          bubble={BUBBLE}
          onOpenPhoto={setPhoto}
        >
          {/* THE COMPOSER IS MOUNTED ONCE, BELOW BOTH VIEWS — see the dock further down. The
              phone's own composer band is that dock, re-themed by the pane around it. */}
        </WhatsappPane>
      ) : (
      <div
        ref={turns}
        data-testid="thread-turns"
        onScroll={(event) => {
          const port = event.currentTarget;
          const standing = port.scrollHeight - port.scrollTop - port.clientHeight < 24;
          atBottom.current = standing;
          if (standing && newTurns > 0) setNewTurns(0);
          if (expandedTurn && detailObscured) {
            const target = port.querySelector<HTMLElement>(`[data-message-detail="${CSS.escape(expandedTurn)}"]`);
            if (target && target.getBoundingClientRect().bottom <= port.getBoundingClientRect().bottom + 4) setDetailObscured(false);
          }
        }}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'clip',
          minHeight: 0,
          minWidth: 0,
          /* §33: the conversation's own gutters. The bubbles carry another 8 of their own, so the
             talk stands 18 off the panel's edge and the cards align with the bubble column. */
          padding: `${theme.sizing.scale400} ${theme.sizing.scale400} ${theme.sizing.scale600}`,
          /* The conversation owns the whole dotted field. Its dots are brand-red, but pale enough
             to stay texture rather than become another status colour. */
          backgroundImage: dots(`color-mix(in srgb, ${theme.colors.accent} 18%, transparent)`),
          backgroundSize: (theme as unknown as { brand?: { dotTile: string } }).brand?.dotTile ?? '14px 14px',
          backgroundColor: theme.colors.backgroundPrimary,
        }}
      >
        {/* §142: messages and short tool trails share the stream; the order and its concern
            stand together above the composer. An empty turn paints no bubble. */}
        {stream.map((r, i) => {
          const says = whisperOf(r, stream[i - 1]);
          const who = r.author === 'ai' ? 'Rocoto' : r.author === 'sent' ? 'You' : thread.customer.name;
          /* §142: the kit's generated reading already has its tool trail below. It is not a
           * second chat bubble. Keep every actual sent/customer reply and every media payload. */
          const toolReadback = r.author === 'ai' && r.embed?.kind === 'readback'
            && r.text === r.embed.sale.reading;
          const spoken = Boolean((r.text && !toolReadback && !r.internal) || r.voice || r.picture);
          /* ── THE TURN'S OWN CHANNEL (§246 acceptance 5) ───────────────────────────────────
             «Some chats are WhatsApp-based or email-based… think about what people are going to
             expect to see.» So the stream asks each turn where it stood rather than painting the
             account's idiom over all of them: a telephone turn is a CALL RECORD with its
             transcript, a mail turn keeps its sender, subject, attachments and Reply, and
             everything else is the bubble it always was.
             ⚠ A ROLEPLAY IS EXEMPT. `test` is the operator emulating a customer through one
             emulated channel (§10.3); dressing its turns as calls would be the harness telling a
             story about a conversation that never left the browser. */
          const turnChannel = test ? 'whatsapp' : channelOfTurn(r, thread.customer);
          const callTurn = !test && isCallTurn(r, thread.customer);
          const mailTurn = !test && turnChannel === 'email';
          const scopedNoteStanding = spoken && scopedConversationNoteStanding(cast.sector, r.scopedNote);
          const relatedSale = [...thread.forming, ...thread.messageOnly].find((sale) =>
            r.orderId === sale.id || r.id.startsWith(`${sale.id}:`));
          const firstCustomerTurn = relatedSale && stream.find((candidate) =>
            candidate.author === 'received'
            && (candidate.orderId === relatedSale.id || candidate.id.startsWith(`${relatedSale.id}:`)));
          const attachedSale = relatedSale && firstCustomerTurn?.id === r.id ? relatedSale : undefined;
          const panelRow = test ? panelAfter(stream, i) : null;
          const hasDetails = spoken && Boolean(r.internal || r.act || r.embed || attachedSale || panelRow);
          const detailOpen = hasDetails && expandedTurn === r.id;
          return (
            <React.Fragment key={r.id}>
              {says && <Whisper says={says} />}
              {spoken && (
                /* ── THE TURN'S OWN ANCHOR (§47.1) ────────────────────────────────────────────
                   A quote walks here, so the turn needs a name in the document — and the ring the
                   walk leaves is drawn on this box rather than on the bubble, so the bubble's own
                   geometry is untouched by having been arrived at (§37.3). */
                <div
                  data-turn={r.id}
                  /* ⚠ WHOSE TURN IT IS, STATED ON THE ROW (§246 acceptance 5). The kit's bubble
                     carries its author as a STYLE prop and nothing else, so «is this customer turn
                     drawn as a call record or as a chat bubble» was unmeasurable from outside —
                     a drive counting `[data-author]` was reading the mail card's attribute and
                     calling every telephone conversation clean. The row says who spoke; the
                     renderer inside it says how it was drawn. */
                  data-turn-author={r.author}
                  data-turn-drawn={callTurn ? 'call' : mailTurn ? 'mail' : 'bubble'}
                  data-message-detail={hasDetails ? r.id : undefined}
                  data-detail-open={detailOpen ? 'yes' : 'no'}
                  aria-expanded={hasDetails ? detailOpen : undefined}
                  tabIndex={hasDetails ? 0 : undefined}
                  onClick={hasDetails ? (event) => {
                    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, [role="button"]')) return;
                    setExpandedTurn((open) => open === r.id ? null : r.id);
                  } : undefined}
                  onKeyDown={hasDetails ? (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setExpandedTurn((open) => open === r.id ? null : r.id);
                  } : undefined}
                  data-landed={landed === r.id ? 'yes' : 'no'}
                  /* §196.3 · the fact, stated, so the red is checkable rather than inferred */
                  data-flagged={!test && flaggedTurn(r) ? 'yes' : 'no'}
                  /* THE BEAT THIS TURN LANDS ON (§120.1). The row is here from the first frame;
                     what the beat moves is paint, so nothing under it can be shoved. */
                  data-beat={plan.said[i]}
                  data-beat-on={trace.on(plan.said[i]) ? 'yes' : 'no'}
                  style={{
                    ...beat(trace.on(plan.said[i])),
                    position: 'relative',
                    borderRadius: theme.borders.radius400,
                    outline: landed === r.id ? `2px solid ${theme.colors.contentPrimary}` : '2px solid transparent',
                    outlineOffset: 2,
                    /* ONE SHORTHAND FOR BOTH TRANSITIONS ON THIS BOX — the walk's arrival ring and
                       the trace's own beat. A second `transition` declaration would silently drop
                       whichever of them was written first. */
                    transition: [
                      `outline-color ${theme.animation.timing400} ${theme.animation.easeOutCurve}`,
                      `opacity ${beat(true).transitionDuration} ${theme.animation.easeOutCurve}`,
                      `transform ${beat(true).transitionDuration} ${theme.animation.easeOutCurve}`,
                    ].join(', '),
                    /* the chips ride the bubble's lower edge, so the row keeps room for them
                       rather than letting them land on the message underneath */
                    paddingBottom: r.reactions && r.reactions.length > 0 ? theme.sizing.scale600 : undefined,
                    minWidth: 0,
                  }}
                >
                  {hasDetails && <span aria-hidden="true" data-testid="message-clue-marker" style={{
                    position: 'absolute', left: -7, top: theme.sizing.scale500, width: 4, height: 18,
                    borderRadius: 999, background: theme.colors.accent,
                    opacity: detailOpen ? 1 : 0.55,
                    transition: calm ? 'none' : `opacity ${theme.animation.timing400} ${theme.animation.easeOutCurve}`,
                  }} />}
                  {scopedNoteStanding && r.scopedNote && <ScopedConversationNoteLine scope={cast.sector} note={r.scopedNote}
                    side={r.author === 'sent' ? 'sent' : 'received'} testid="message-scoped-note" />}
                  {callTurn ? (
                    <CallRecord turn={r} who={thread.customer.name} testid={`call-${r.id}`} />
                  ) : mailTurn ? (
                    <EmailTurnCard scope={cast.sector} row={r} them={thread.customer.name} house={cast.house.name}
                      showSubject={mailSubjectShown.get(r.id) ?? false}
                      onReply={aimMail}
                      aimedAt={aimedMailId} />
                  ) : (
                  <Message
                    author={r.author === 'ai' ? AUTHOR.ai : r.author === 'sent' ? AUTHOR.sent : AUTHOR.received}
                    /* THE STAMP IS OFF THE BUBBLE (§40.3). The hour is said once, above the run, by
                       the whisper — printing it again inside every bubble is the crowding the
                       reference does not have, and the same fact twice besides (§25.5).
                       WHAT DID STAY IS DELIVERY, and only where this side owns the journey: a
                       message the person wrote left this app, and the tick says so. A received
                       message has no journey we can honestly report on. */
                    status={r.author === 'sent' ? 'sent' : undefined}
                    grouped={r.grouped}
                    /* the photograph opens on the overlay; the voice note plays where it stands */
                    photo={
                      r.picture
                        ? { src: r.picture.src, alt: r.picture.alt, aspectRatio: r.picture.aspectRatio }
                        : undefined
                    }
                    onOpenPhoto={r.picture ? () => setPhoto(r.picture ?? null) : undefined}
                    slot={
                      r.voice ? (
                        <VoiceNoteBody note={r.voice} testid={`voice-${r.id}`} />
                      ) : r.picture ? (
                        <PictureReading picture={r.picture} testid={`picture-${r.id}`} />
                      ) : undefined
                    }
                    action={test ? <TurnActions
                      onReply={() => aim(r, who)}
                      onReact={() => setPicking((was) => (was === r.id ? null : r.id))}
                    /> : undefined}
                    onHold={test ? () => setPicking(r.id) : undefined}
                    overrides={scopedNoteStanding ? SCOPED_BUBBLE : (!test && flaggedTurn(r) ? FLAGGED_BUBBLE : BUBBLE)}
                  >
                    {r.text ? (
                      <>
                        {r.quote && <QuoteCard quote={r.quote} onJump={() => jumpTo(r.quote!.id)} />}
                        {r.text}
                      </>
                    ) : undefined}
                  </Message>
                  )}

                  {/* a quote on a turn that carries no words rides ABOVE the payload, where the
                      caption slot cannot put it */}
                  {!r.text && r.quote && (
                    <div style={{ padding: `0 ${theme.sizing.scale300}`, minWidth: 0 }}>
                      <QuoteCard quote={r.quote} onJump={() => jumpTo(r.quote!.id)} />
                    </div>
                  )}

                  {r.reactions && r.reactions.length > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        [r.author === 'sent' ? 'right' : 'left']: theme.sizing.scale600,
                        minWidth: 0,
                      }}
                    >
                      <ReactionChips turn={r} onPress={(emoji) => react(r.id, emoji)} />
                    </span>
                  )}

                  {picking === r.id && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: r.author === 'sent' ? 'flex-end' : 'flex-start',
                        padding: `${theme.sizing.scale200} ${theme.sizing.scale300} 0`,
                      }}
                    >
                      <ReactionPicker onPick={(emoji) => react(r.id, emoji)} onClose={() => setPicking(null)} />
                    </div>
                  )}

                  {hasDetails && <div data-testid="message-details" aria-hidden={!detailOpen} style={{
                    display: 'grid', gridTemplateRows: detailOpen ? '1fr' : '0fr',
                    opacity: detailOpen ? 1 : 0,
                    transition: calm ? 'none' : [
                      `grid-template-rows ${theme.animation.timing400} ${theme.animation.easeOutCurve}`,
                      `opacity ${theme.animation.timing400} ${theme.animation.easeOutCurve}`,
                    ].join(', '),
                    minWidth: 0,
                  }}><div style={{ overflow: 'hidden', minWidth: 0 }}>
                    {(r.internal || r.act || r.embed) && <div
                      data-beat={plan.moves[i]}
                      data-beat-on={trace.on(plan.moves[i]) ? 'yes' : 'no'}
                      style={{ ...beat(trace.on(plan.moves[i])), minWidth: 0 }}
                    >
                      {r.internal && <TheatreTrail status={r.internal} />}
                      {r.act && <ActLine act={r.act} mine={r.author === 'sent'} />}
                      {r.embed && !r.act && <ToolTrail embed={r.embed} />}
                    </div>}
                    {panelRow && test && <div
                      data-beat={plan.reads[i]}
                      data-beat-on={trace.on(plan.reads[i]) ? 'yes' : 'no'}
                      style={{ ...beat(trace.on(plan.reads[i])), minWidth: 0 }}
                    >
                      <TestPanel
                        reading={readingOfRow(panelRow)!}
                        mark={test.marks[panelRow]}
                        onAnxious={setAnxious}
                        onCorrect={() => markCorrect(panelRow)}
                        onCorrection={(fix) => applyCorrection(readingOfRow(panelRow)!, fix)}
                      />
                    </div>}
                    {attachedSale && <div style={{ paddingTop: theme.sizing.scale300 }}>
                      <OrderRow sale={attachedSale} cast={cast} />
                    </div>}
                  </div></div>}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      )}

      {(newTurns > 0 || detailObscured) && <div data-testid="thread-new-content" data-message-detail={detailObscured && expandedTurn ? expandedTurn : undefined} role="status" style={{
        display: 'flex', justifyContent: 'center', flex: '0 0 auto',
        padding: `${theme.sizing.scale200} ${theme.sizing.scale400} 0`,
      }}>
        <Button kind={KIND.secondary} size={SIZE.compact} onClick={() => {
          const port = turns.current;
          if (port && detailObscured && expandedTurn) {
            const target = port.querySelector<HTMLElement>(`[data-message-detail="${CSS.escape(expandedTurn)}"]`);
            if (target) port.scrollTop += target.getBoundingClientRect().bottom - port.getBoundingClientRect().bottom + 8;
            setDetailObscured(false);
          } else if (port) {
            port.scrollTop = port.scrollHeight;
            atBottom.current = true;
            setNewTurns(0);
          }
        }}>{detailObscured ? 'Continue message details' : newTurns === 1 ? '1 new message' : `${newTurns} new messages`}</Button>
      </div>}

      {/* ── THE ORDER, PINNED ABOVE THE COMPOSER (§77.5) ──────────────────────────────────────
          Between the stream's scrollport and the composer's dock, at `flex: 0 0 auto` — so it is
          always in front of the person writing, and never a card they have to scroll back to
          find. */}
      {/* THE CUSTOMER'S PHONE CARRIES NO ORDER CARD (§91.4.8, and the .com demo's own law): what
          they get is Rocoto's message. The pinned order is the HOUSE's view of the same order. */}
      {/* ── AND THE ORDER APPEARS ON ITS OWN BEAT (§120.1's «the theatre, the order») ─────────
          The face stands from the beat the conversation first moved an order; a conversation that
          arrived carrying one already has it from the record, because claiming it arrived during
          the arc would be the trace telling a story that did not happen. */}
      {/* ⚠ THE PINNED CARD GIVES WAY BEFORE THE WRITING SURFACE DOES (§196.7's own geometry).
          With the composer in the dock, three unshrinkable boxes wanted 765px of a 722px panel and
          the send button went off the bottom edge — measured at 1600, not guessed. The dock holds
          the act, so the REFERENCE gives: the card takes the room that is left and scrolls its own
          lines inside itself, which keeps every line reachable rather than clipping one away. */}
      <div
        data-beat={plan.orderBeat}
        data-beat-on={trace.on(plan.orderBeat) ? 'yes' : 'no'}
        style={{ ...beat(trace.on(plan.orderBeat)), flex: '0 1 auto', minWidth: 0, minHeight: 0, display: 'flex' }}
      >

      {!embedded && <OrderOverlay
        orders={test && view === 'customer' ? [] : thread.forming}
        cast={cast}
        preferredOrder={preferredOrder}
        /* THE CONFIDENCE ORGAN LANDS LAST (§120.1 · §120.2) — the tick settles on the trace's
           final beat, which is where he ends the sentence. */
        /* A TEST ORDER'S DOOR IS THE MESSAGE THAT BUILT IT — never `openSale`, which would put a
           document nobody can open into the frame's own work strip (§10.7). */
        onOpen={(sale) => {
          if (sale.theatre?.tainted) {
            const source = [...thread.rows].reverse().find((row) => row.orderId === sale.id);
            if (source) jumpTo(source.id);
            return;
          }
          if (test) {
            const row = test.readings.find((r) => r.sale.id === sale.id)?.row;
            if (row) jumpTo(row);
            return;
          }
          onCollapse?.();
          openSale(sale);
        }}
      />}
      </div>

      {/* ── THE COMPOSER BAND IS PART OF THE PHONE WHILE THE PHONE IS SHOWING (§91.4.8) ───────
          One composer, mounted once, under both views — and on the customer's side it takes the
          emulated pane's own theme, so the send disc, the mic and the suggestion chips are
          WhatsApp's green rather than the app's ink. The scope is a provider, never a second
          component: it is the same bar, repainted. */}
      {/* ── THE HYBRID COMPOSER (§196.7) AND THE DRAFTED REPLY (§196.8) ─────────────────────
          ⚠ THIS SEAT WAS `NativeChatHandoff` ALONE, and E185.08's «no customer composer» is the
          clause §196.7 lifts. The door itself survives inside `ChannelLine` — same testids, same
          web.whatsapp.com destination, one row instead of a strip repeating the channel the send
          button now states in colour. A PHONE account keeps its call card and no composer: there
          is no honest channel to state on a button for an order that arrived by telephone. */}
      {/* ── AND THE SEAT BELONGS TO THE CONVERSATION'S OWN CHANNEL (§246 acceptance 5) ────────
          A WhatsApp conversation writes on WhatsApp, bound or being confirmed, and the line under
          the box says which. A TELEPHONE conversation is answered by calling it — the act walks
          the app's own dial route, so every call entrance reads one connection state. A portal
          account says where its orders come from rather than borrowing a channel it has never
          used. The seat is `conversationSeatOf(customer, rows)` — one law, read by this housing
          and by the albarán's chip, rather than restated in each. */}
      {!embedded && !test && conversationWrites && <ComposerDock busy={replyBusy}>
        {/* ── THE REPLY TRAY, IMMEDIATELY ABOVE THE DOCK ─────────────────────────────────────
            docs/THE-INTERACTION-SPEC.md:762 (INTX-11 · «Reply attention and bottom dock»): «A
            ReplyAttention renders as a tray immediately above the bottom dock, nearly the dock's
            full width. It states the reason, for example Reply needed · The customer asked which
            size is available.» FEED-IA §191 clause 8 (docs/FEED-IA.md:5089) keeps it: «Messages
            keeps scoped concerns, the reply tray, outbound-window review and native channel
            doors.» It went out of the render tree with the connected-conversations refactor
            (PR #90) while the component, both specs and `drive-191-scoped-conversation-notes` all
            stayed — so the concern that says WHY a reply is owed stood in the list row's dot
            alone. It is back in all three docks: the reason belongs where the person is writing. */}
        {!replyBusy && <ComposerAttention sales={[...thread.messageOnly, ...thread.forming]} cast={cast} />}
        <ReplyComposer
          cast={cast}
          customer={thread.customer}
          sales={[...thread.messageOnly, ...thread.forming]}
          draftKey={thread.id}
          emailStanding={conversationEmailStanding}
          aimedAtEmail={aimedMail}
          onClearAim={() => setAimedMail(null)}
          emailTo={aimedMail?.from}
          emailSubject={aimedMail?.subject}
          emailProvider={aimedMail?.provider}
          onBusyChange={setReplyBusy}
        />
      </ComposerDock>}
      {!embedded && !test && conversationAccount === 'phone'
        && <CallDock customer={thread.customer} says="This conversation happens by telephone." />}
      {!embedded && !test && conversationAccount === 'note' && !conversationEmailStanding
        && <ChannelNote customer={thread.customer} />}
      {test && <>
      <WhatsappScope on={view === 'customer'}>
      <ComposerDock busy={voiceBusy}>
        {!embedded && !voiceBusy && <ComposerAttention sales={[...thread.messageOnly, ...thread.forming]} cast={cast} />}
        {replyTo && !voiceBusy && <ReplyStrip quote={replyTo} onClear={() => setReplyTo(null)} />}
        {/* THE SUGGESTED MESSAGE, OFFERED (§91.4.8 in §83.2's grammar). It stands while the field
            is empty and the operator is on the customer's side, so it is there for the first
            message and there again for the fiftieth — «offered in every test-chat situation» —
            and it writes into the field rather than sending, because the words are theirs. */}
        {test && view === 'customer' && !voiceBusy && text === '' && (
          <Suggestions
            rows={suggestions}
            onPick={(w) => {
              setText(w);
              inputRef.current?.focus();
            }}
          />
        )}
        {/* ── CO-PRESENCE, IN THE COMPOSER (§110 · §9.11 · §83.2) ─────────────────────────────
            Rocoto's withheld reading of the order this conversation is carrying, standing where
            the person is about to write. It takes the same seat as the suggestions above and
            obeys the same three rules: only while the field is empty, only a press writes it in,
            and nothing sends. THE READING THAT LANDED ON THE LAST SEND takes the seat first —
            the two are the same moment seen from either side, and they are never both true. */}
        {learned && !voiceBusy ? (
          <LearnedReading />
        ) : ghost && !voiceBusy && text === '' ? (
          <GhostPrefill
            words={ghost.words}
            onTake={() => {
              setText(ghost.words);
              inputRef.current?.focus();
            }}
          />
        ) : null}
        <Composer
          value={text}
          onChange={setText}
          onSend={send}
          inputRef={inputRef}
          /* IN A TEST THE OPERATOR IS THE CUSTOMER (§10.3), and the bar says whose voice they are
             writing in — which is the one thing that could otherwise be got wrong silently. */
          placeholder={
            test
              ? view === 'house'
                ? `Write as ${cast.house.name}`
                : asWords(test.subject)
              : replyTo
                ? `Reply to ${replyTo.who}`
                : `Write to ${thread.customer.name}`
          }
          /* ── THE ATTACHMENT (§10.8's «attach images») ────────────────────────────────────────
             The composer's own attachment contract, wired: the house's own photographs stage in
             the preview row above the field, each removable, and a staged one makes the message
             sendable with no words at all — which is exactly how a photo of a written order
             arrives on WhatsApp. */
          attachments={
            test && staged ? [{ id: 'staged', src: staged.src, label: staged.alt }] : undefined
          }
          onRemoveAttachment={test ? () => setStaged(null) : undefined}
          attachment={test ? <PhotoSlot onPick={setStaged} speaker={thread.customer.name} /> : undefined}
          overrides={COMPOSER}
          /* THE TAKE GETS THE BAR (FEED-IA §13). The voice control rests as one button and records
             as a full instrument, so the composer is told the moment it stops being the former —
             in a 340px column, a take drawn in a 48px seat paints over the surface around it. */
          voiceActive={voiceBusy}
          voice={
            <StatefulVoiceButton
              simulate
              seed={`${cast.sector}-${thread.id}`}
              onBusyChange={setVoiceBusy}
              /* ── AND THE TAKE LANDS AS A VOICE NOTE (FEED-IA §46.2) ───────────────────────
                 It used to land as the SENTENCE «Voice note · 7s», which is a message describing
                 a message. A take is a recording: it lands as one, with the length it really ran
                 for, the field the bubble scrubs, and the machine's own brief interval before the
                 words are set down.
                 WHAT THE WORDS ARE. On the product, Deepgram's. Here the take is `simulate`d —
                 the Voice Button's own shipped prop — so the transcript is composed from this
                 conversation's own facts, the way `readingOf` composes Rocoto's reading from the
                 sale's. Nothing is pasted in from outside the day. */
              onRecord={(take) => recordTest(test!, take.durationMs)}
            />
          }
        />
      </ComposerDock>
      </WhatsappScope>
      </>}

      {/* ── THE ANXIETY (FEED-IA §127) ─────────────────────────────────────────────────────────
          Rocoto's worry about this order, as a thing a person can answer: the message, the
          reasoning, the full order with its albarán below — and two answers, TAKE THE ACTION or
          DISMISS IT WITH A REASON. `anxiousOwed` is `tick.tsx`'s one fold, so the card can never
          ask for work the organ that opened it did not name. */}
      {anxious && anxiousOwed && (
        <AnxietyCard
          isOpen
          sale={anxious}
          owed={anxiousOwed}
          message={anxiousMessage}
          now={nowOf(cast)}
          onClose={() => setAnxious(null)}
          /* WHERE EACH ACTION LEADS, and both are doors this conversation already has. An EDIT
             opens the albarán — the housing's own door, so a test order still never reaches the
             real work strip (§10.7). A REPLY closes the card onto the composer, which is where
             the person writes and where Rocoto reads what they wrote (§120.4). */
          onAct={(act) => {
            const sale = anxious;
            setAnxious(null);
            if (act === 'edit') {
              const row = test?.readings.find((r) => r.sale.id === sale.id)?.row;
              if (test) {
                if (row) jumpTo(row);
              } else {
                onCollapse?.();
                openSale(sale);
              }
              return;
            }
            if (test) setView('house');
            inputRef.current?.focus();
          }}
        />
      )}

      <PictureLightbox picture={photo} onClose={() => setPhoto(null)} />
    </div>
  );
}

/* ── WHAT THE CONSUMER ASKS OF THE KIT (FEED-IA §40.3, §40.4) ─────────────────────────────────
 * The Message and the Composer are shipped kit components and they are not edited here. What a
 * conversation surface is entitled to say is HOW MUCH ROOM the same component takes in ITS
 * housing, and Base's overrides contract is the sentence for saying it. Every value below is a
 * step on Base's own scale, so `?theme=proof` moves all of it.
 *
 *   THE BUBBLE   the reference's comfort: a finger's padding rather than a hairline's, and a
 *                full step of air where a new speaker starts. The bottom stays shorter than the
 *                top — that asymmetry is the messenger idiom, and the stamp used to live there.
 *   THE COMPOSER the soft pill: Base's top radius on the field, and the mic seated with a real
 *                gap beside it rather than pressed against the writing surface.
 */
const BUBBLE = {
  Root: {
    style: ({ $grouped, $theme }: { $grouped: boolean; $theme: { sizing: Record<string, string> } }) => ({
      paddingTop: $grouped ? $theme.sizing.scale100 : $theme.sizing.scale500,
    }),
  },
  Content: {
    style: ({ $theme }: { $theme: { sizing: Record<string, string> } }) => ({
      paddingTop: $theme.sizing.scale500,
      paddingRight: $theme.sizing.scale550,
      paddingBottom: $theme.sizing.scale500,
      paddingLeft: $theme.sizing.scale550,
    }),
  },
};

/* ═══ THE FLAGGED ORDER'S MESSAGE WEARS THE RED (FEED-IA §196.3) ══════════════════════════════
 * «any fuciking alert or message for "flagged" orders have to have red identifiers and not dots,
 *  like red outline ont he message etc like come on be top down!!!»
 *
 * The bubble is the object, so the bubble takes the outline — the same 2px of the brand red
 * `red-flag.tsx` draws on the row in the river and the line on the albarán, read out of that one
 * file rather than re-chosen here. It rides the same `Bubble` override slot the scoped note uses,
 * which is the pattern this file already had for «this exact message is spoken about».
 */
const FLAGGED_BUBBLE = {
  ...BUBBLE,
  Bubble: {
    props: { 'data-flagged': 'yes' },
    style: ({ $theme }: { $theme: { colors: Record<string, string> } }) => ({
      outline: flagOutline($theme as unknown as { colors: { accent: string } }),
      outlineOffset: '2px',
    }),
  },
};

/** The note explains one exact message; only that bubble receives the accent boundary. */
const SCOPED_BUBBLE = {
  ...BUBBLE,
  Bubble: {
    props: { 'data-scoped-note-boundary': 'standing' },
    style: ({ $theme }: { $theme: { colors: Record<string, string> } }) => ({
      outline: `2px solid ${$theme.colors.accent}`,
      outlineOffset: '2px',
    }),
  },
};

const COMPOSER = {
  /* THE TAKE FLOATS; IT DOES NOT PAINT A SLAB. The lock chip grows upward out of the dock, and the
     Composer's own paper grew with it — 144px of white laid over the conversation, cutting a card
     in half. The chip carries its own paper and its own shadow, which is what makes it read as a
     thing hovering over the talk, so while a take is running the bar behind it steps aside. */
  Root: {
    style: ({ $voiceActive, $theme }: { $voiceActive: boolean; $theme: { colors: Record<string, string> } }) => ({
      backgroundColor: $voiceActive ? 'transparent' : $theme.colors.backgroundPrimary,
    }),
  },
  Bar: { style: ({ $theme }: { $theme: { sizing: Record<string, string> } }) => ({ gap: $theme.sizing.scale500 }) },
  Field: {
    style: ({ $theme }: { $theme: { borders: Record<string, string> } }) => ({
      borderRadius: $theme.borders.radius500,
    }),
  },
};

/** the same bar, standing on whatever ground its housing paints (§196.7). In the dock that is the
 *  dock's own white; in the albarán's chip it is the card, which is where a white slab of its own
 *  read as a mistake. */
const COMPOSER_ON_GROUND = {
  ...COMPOSER,
  Root: { style: () => ({ backgroundColor: 'transparent' }) },
};

/* ── THE OVERLAY WIDGET (FEED-IA §15, §22.1, §42) ─────────────────────────────────────────────
 * A launcher that is always there and a panel that is there only while it is wanted.
 *
 * THE GEOMETRY IS THE GRAMMAR every desk already knows for this: a round mark in the bottom-right
 * corner, and the panel standing directly on top of it, corner aligned, so the thing that opened it
 * is the thing it grows out of.
 *
 * ═══ FOUR POSTURES, ONE PANEL (FEED-IA §42, and §77.4's two sizes) ══════════════════════════
 * The widget is the whole of Chats now, so it has to answer for the phone as well as for the desk,
 * for a person looking THROUGH the conversations, and for one who wants the conversation to be the
 * screen for a minute:
 *
 *   BOOK      «all chats» — the bigger modal (§77.4). 640px on the corner it grew out of. The
 *             list is a place a person went to look through 295 conversations, and it gets a
 *             surface the size of that job.
 *   COMPACT   one conversation — «that gives it an ambient feel» (§77.4). 400px, shorter, on the
 *             same corner: the talk stands beside the work rather than over it.
 *   FULL      the desk, expanded: the whole viewport, the list beside the conversation the way a
 *             mail app stands them. Same content, more room — and the conversation keeps its
 *             MEASURE, because a bubble stretched across 1200px is not a bubble that reads better.
 *             It is ASKED FOR and never remembered; the two sizes above are what the widget does
 *             on its own as a person navigates.
 *   PHONE     390px has no two sizes: a widget that hovered over a phone screen would be a panel
 *             with nowhere to stand. The panel fills the screen down to the bottom row, which is
 *             where the phone's conversation has always lived — and the launcher steps off while
 *             it is open, because the panel is standing where the launcher was.
 */

/** the round mark in the corner, and the room the panel leaves around itself */
const LAUNCHER = 56;
const EDGE = 24;
const GAP = 12;

/* ═══ THE LAUNCHER OWNS THE VIEWPORT'S CORNER (FEED-IA §83.3) ═════════════════════════════════
 * «Also why is the chat thing not bottom corner of the viewport» — with a screenshot of the bubble
 * half-cut at a pane's edge.
 *
 * WHAT IT WAS DOING, AND WHY IT WAS WRONG. The widget used to STEP LEFT of whichever pane had
 * claimed the right-hand lane: a surface told the frame how wide its sheet pane was (`AreaMeta.lane`
 * + `useReservedLane`), the frame handed that number here, and the circle parked in the seam
 * between the two panes — 708px in from the right on Sales. Every part of that machinery was built
 * to keep the bubble off a sticky action bar, and it bought that at the cost of the one property a
 * floating launcher has: BEING IN THE CORNER. Standing mid-screen it reads as a control that
 * belongs to the pane it is standing on, which is exactly what he saw and exactly what it isn't.
 *
 * SO THE LANE LAW INVERTS, AND IT IS SIMPLER IN THIS DIRECTION. The launcher is fixed to the
 * VIEWPORT's bottom-right corner at every width and on every surface — one position, never
 * computed, never clipped, above the panes — and whatever stands at the foot of a pane RESERVES
 * the corner for it in its own padding. Stock's price bar already did exactly this at both widths
 * («One lane, both widths», stock.tsx), so the inversion adopts a rule this app had already found
 * rather than inventing one: whoever draws a bottom bar leaves the launcher's lane at its end.
 *
 * WHY `position: fixed` IS NOT ENOUGH ON ITS OWN, and what is checked in the drive: a fixed element
 * resolves against the nearest ancestor carrying a `transform`, `filter`, `contain` or
 * `backdrop-filter` — any of those turns «fixed to the viewport» into «fixed to a box that a
 * scrollport can clip». The launcher is mounted by the FRAME, outside every pane and every
 * transformed layer, and `drive-chats` asserts the consequence rather than the cause: its rect
 * touches the viewport's own corner at 1600 and at 390, and nothing paints over it there.
 *
 * ⚠ THE LANE A BOTTOM BAR MUST LEAVE is this constant plus the bar's own gutter. It is stated here
 * because this is where the two numbers that make it live.
 *
 * ═══ AND THE COLUMN LEAVES IT AT ITS FOOT (AUDIT-2 C16) ═════════════════════════════════════
 * §83.3 gave the launcher the corner and named the other half of the bargain — «whatever stands at
 * the foot of a pane reserves the corner for it». The bars kept it; the frame's own COLUMN posture
 * did not, so on every scrolling surface the last rows finished under the circle: 16px on the desk
 * against an 80px lane, 32px on the phone. `frame.tsx` now floors its foot padding at this number,
 * which is why the constant is exported rather than private — one number, read by the thing that
 * stands in the lane and by the thing that leaves it. */
export const LAUNCHER_LANE = LAUNCHER + EDGE;

/** THE PANEL'S WIDTH (FEED-IA §40.1). It was 380 and it read as a column that had escaped rather
 *  than a surface: at 380 the header spent its width on furniture and a bubble's measure came out
 *  at 265px. 400 is the reference's own roominess — the name gets its line beside two 36px marks,
 *  and the measure lands around fifty characters, which is where a conversation reads easiest.
 *
 *  IT IS NOW THE COMPACT SIZE'S WIDTH AND THE FULLSCREEN LIST PANE'S (§77.4, below): a row is laid
 *  out identically wherever it is drawn, which is what stops it re-tuning its truncation. */
const PANEL_WIDTH = 400;

/* ═══ THE TWO SIZES (FEED-IA §77.4) ══════════════════════════════════════════════════════════
 * «When it's in "all chats" it should be the bigger modal thing, and when it's a single chat it's
 * just the compact chat sized one. That gives it an ambient feel.»
 *
 * SO THE SIZE FOLLOWS THE NAVIGATION, and it is not a control. The book of chats is a place a
 * person went to look through 295 conversations; one conversation is a thing standing quietly
 * beside the work while they carry on with it. Those are different jobs and they get different
 * boxes — TWO of them, stated, never a box that grows with its contents.
 *
 *   BOOK      640 × min(78vh, 720px)   the list, and the list only. The bigger modal.
 *   COMPACT   400 × min(64vh, 600px)   one conversation. The ambient one.
 *
 * ── THE CORNER NEVER MOVES ──────────────────────────────────────────────────────────────────
 * Both sizes are anchored to the same bottom-right corner the launcher stands in, so the morph
 * moves the panel's top-left edge and nothing else. «Position stable» means the thing you are
 * looking at stays where you are looking; a panel that re-centred on every navigation would make
 * every step feel like a new screen.
 *
 * ── AND THE BOOK IS A STATED HEIGHT, WHICH REVERSES AN OLDER RULE ────────────────────────────
 * The list used to HUG its rows, because a five-row list drawn at 700px inside the 400px compact
 * box was «360px of empty white with a heading on it». As the BOOK it is a modal, and a modal has
 * a size: at the load this is designed for (§12: 30–50 accounts a comercial, 295 conversations in
 * the house) the list overflows this ceiling several times over, and a box that changed size with
 * the number of unanswered conversations would be the app fidgeting.
 *
 * ── FULLSCREEN SURVIVES, AND IT IS A THIRD THING ────────────────────────────────────────────
 * §42's expand mark is untouched: it is ASKED FOR, never remembered, and it is the mail-app
 * posture. The two sizes here are what the widget does on its OWN as a person navigates; the
 * expand is what it does when they tell it to.
 */
const BOOK_WIDTH = 640;
const BOOK_HEIGHT = 'min(84vh, 760px)';
const COMPACT_HEIGHT = 'min(78vh, 720px)';

/** The panel's tallest, for the phone's own ceiling arithmetic and for anything that needs one
 *  number: the taller of the two sizes. */
const PANEL_HEIGHT = BOOK_HEIGHT;

/** THE CONVERSATION'S MEASURE AT FULLSCREEN (FEED-IA §42: «bubbles keep their measure»). A bubble
 *  is 78% of the column it stands in, so a thread handed 1100px of desk would print sentences 850px
 *  long — more room spent making the talk harder to read. The extra width goes to the LIST standing
 *  beside it, mail-app fashion, and the conversation keeps a column a person can track. */
const THREAD_MEASURE = 860;

export function EmbeddedConversation({ cast, sale, onOpenFull, onAimMail, aimedMailAt }: {
  cast: Cast; sale: Sale; onOpenFull?: () => void;
  /* §196.7 clause 1, inside the albarán's chip: the chip owns the composer, so it owns the aim. */
  onAimMail?: (row: ThreadTurn) => void;
  aimedMailAt?: string;
}) {
  const thread = useThreads(cast).find((candidate) => candidate.customer.id === sale.customer.id);
  if (!thread) return null;
  const sourceIds = new Set(sale.thread.filter(isSourceMessage).map((row) => sale.id + ":" + row.id));
  const rows = thread.rows.filter((row) => sourceIds.has(row.id) || row.orderId === sale.id);
  const scoped = { ...thread, rows, last: rows[rows.length - 1], forming: [] };
  return <ThreadView cast={cast} thread={scoped} threads={[scoped]} embedded orderId={sale.id}
    onCollapse={onOpenFull} onAimMail={onAimMail} aimedMailAt={aimedMailAt} />;
}

/** The full Chats workspace names an email as email and shares its renderer with the order excerpt. */
function WorkspaceConversation({ cast, thread, threads, onBack, backLabel, actions, onHide, onCollapse, preferredOrder, asEmail }: {
  cast: Cast; thread: Thread; threads: Thread[]; onBack?: () => void; backLabel?: string;
  actions?: React.ReactNode; onHide?: () => void; onCollapse?: () => void; preferredOrder?: PreferredOrder;
  /** «Open the email» opened this panel (§202.3), so the conversation reads as mail even where the
   *  customer's own saved channel says otherwise — the door knows what it opened. */
  asEmail?: boolean;
}) {
  const [, theme] = useStyletron();
  /* §196.7 clause 1 · «emails can be answered in the chip or by hitting reply and answering in the
     composer» — Reply on one card aims the composer at THAT message. */
  const [aimed, setAimed] = React.useState<{ id: string; subject?: string; from?: string } | null>(null);
  const [emailBusy, setEmailBusy] = React.useState(false);
  React.useEffect(() => { setAimed(null); }, [thread.id]);
  /* A door may ASK for mail; the rows decide whether there is mail to read. Opening a WhatsApp
     conversation as email would draw an empty mail card, so the ask holds only where a mail turn
     stands in the thread. */
  if (thread.customer.channel === 'email' || (asEmail && thread.rows.some((row) => !!row.email))) {
    const origin = [...thread.rows].reverse().find((row) => row.author === 'received' && row.email);
    return <div data-testid="thread-view" data-thread-open={thread.id} data-standing-order={preferredOrder?.id}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>
      <header data-testid="thread-header" style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale200, padding: theme.sizing.scale200, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
        <span style={{ display: 'inline-flex', width: 48 }}>{onBack && <HeaderButton onClick={onBack} label="Back" testid="thread-back"><Chevron towards="left" /></HeaderButton>}</span>
        {/* THE CONVERSATION SAYS WHOSE IT IS. This cell stood empty, so a thread opened as mail
            carried no name at either width — and «Open the email» now lands here from three new
            doors, which makes it the first thing a person reads. Same anatomy as the chat
            header: the avatar, the name, the channel under it. */}
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
          <span aria-hidden="true" style={{ flex: '0 0 auto', display: 'inline-flex' }}><Avatar name={thread.customer.name} size="scale900" /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span data-testid="thread-mail-name" style={{ ...theme.typography.LabelMedium, display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Name of={thread.customer} />
            </span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Email</span>
          </span>
        </span>
        <span style={{ display: 'inline-flex', justifyContent: 'flex-end' }}>{actions}{onHide && <HeaderButton onClick={onHide} label="Close chat" testid="hide-chats"><Chevron towards="down" /></HeaderButton>}</span>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20 }}>
        <EmailConversation cast={cast} thread={thread} rows={thread.rows}
          onReply={(row) => setAimed({ id: row.id, subject: row.email?.subject, from: row.email?.from })}
          aimedAt={aimed?.id} />
      </div>
      {/* THE COMPOSER STANDS BESIDE THE RECORD, NEVER INSIDE IT (§196.7). The source stays
          provider-custodied and read-only; this is the app's own writing surface. */}
      <ComposerDock busy={emailBusy}>
        {!emailBusy && <ComposerAttention sales={[...thread.messageOnly, ...thread.forming]} cast={cast} />}
        <ReplyComposer
          cast={cast}
          customer={thread.customer}
          sales={[...thread.messageOnly, ...thread.forming]}
          draftKey={thread.id}
          mail
          aimedAtEmail={aimed}
          onClearAim={() => setAimed(null)}
          emailTo={origin?.email?.from}
          emailSubject={origin?.email?.subject}
          emailProvider={origin?.email?.source?.provider}
          emailSourceRef={origin?.email?.source?.sourceRef}
          onBusyChange={setEmailBusy}
        />
      </ComposerDock>
    </div>;
  }
  return <ThreadView key={thread.id} cast={cast} thread={thread} threads={threads} onBack={onBack} backLabel={backLabel} actions={actions} onHide={onHide} onCollapse={onCollapse} preferredOrder={preferredOrder} />;
}

export function ChatsOverlay({
  cast,
  threads,
  currentId,
  onOpen,
}: {
  cast: Cast;
  threads: Thread[];
  currentId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  /* ── THE WIDGET READS THE CONTINUUM TOO (FEED-IA §103) ──────────────────────────────────────
   * The panel's own sizes are already clamped to the room (`maxWidth: calc(100vw - 48px)`), so the
   * BOOK simply narrows as the window does. What cannot narrow is the FULLSCREEN posture's
   * mail-app grammar: a 400px list beside a conversation needs a desk wide enough for both, and
   * under the stacked rung there is not one — so at those widths fullscreen stands the list and
   * the thread one at a time, exactly as the compact posture already does. */
  const stacked = useStacked();
  const [open, setOpen] = React.useState(false);
  const [connectedSource, setConnectedSource] = React.useState(false);
  const [connectedNumber, setConnectedNumber] = React.useState<string | undefined>();
  React.useEffect(() => {
    const focus = (event: Event) => {
      closeSupport(); setConnectedSource(true); setOpen(true);
      setConnectedNumber((event as CustomEvent<{number?: string}>).detail?.number);
    };
    window.addEventListener('rocoto:open-connected-inbox', focus);
    return () => window.removeEventListener('rocoto:open-connected-inbox', focus);
  }, []);
  const [assistantVisible, setAssistantVisible] = React.useState(false);
  const assistantCover = React.useRef(false);
  React.useEffect(() => {
    const cover = () => { assistantCover.current = true; setAssistantVisible(true); };
    const visibility = (event: Event) => {
      const visible = (event as CustomEvent<{ open: boolean }>).detail?.open === true;
      assistantCover.current = visible;
      setAssistantVisible(visible);
    };
    window.addEventListener('rocoto:open-assistant', cover);
    window.addEventListener('rocoto:assistant-visibility', visibility);
    return () => {
      window.removeEventListener('rocoto:open-assistant', cover);
      window.removeEventListener('rocoto:assistant-visibility', visibility);
    };
  }, []);
  const support = React.useSyncExternalStore(supportSubscribe, supportSnapshot, supportSnapshot);
  const supportActive = support.phase === 'loading' || support.phase === 'open' || support.closing;
  /* COMPACT IS THE DEFAULT, ALWAYS (§42). It is state on the widget rather than a preference in a
     store on purpose: fullscreen is a thing a person asks the panel for while they are in it, and
     a widget that opened over the work at full screen because of a press last Tuesday would be the
     app deciding how much of the desk it is entitled to. */
  const [full, setFull] = React.useState(false);
  const [preferredTheatreOrder, setPreferredTheatreOrder] = React.useState<(PreferredOrder & { threadId: string }) | null>(null);
  /** what the door that opened this panel asked to read (§202.3) — mail, and the reference it was
   *  drawn from. A door that named no channel leaves it null and the conversation reads as itself. */
  const [openedAs, setOpenedAs] = React.useState<{ threadId: string; channel: 'email'; sourceRef?: string } | null>(null);
  /* An albarán is a destination, but opening one from Messages must not make the conversation
     disappear. The route transition first parks this snapshot; returning restores exactly this
     thread and the workspace posture rather than reopening a generic inbox. */
  const resumeAfterSale = React.useRef<{ thread: string | null; full: boolean; leaving: boolean; sourceHash: string; destinationHash?: string } | null>(null);
  const minimizedWorkspace = React.useRef<{ thread: string | null; full: boolean } | null>(null);
  const preferTheatreOrder = React.useCallback((threadId: string, id: string) => {
    setPreferredTheatreOrder((was) => ({ threadId, id, token: (was?.token ?? 0) + 1 }));
  }, []);
  const theatrePlayer = useTheatrePlayer(cast, onOpen, open && !assistantVisible, preferTheatreOrder);

  /* A customer, product, or order is a destination, not a second surface under the workspace.
     The hash is already the browser's new entry; close the transient reader so it cannot cover
     or intercept the document that arrived. `useHistoryLayer` discards its inherited layer
     metadata on this destination entry, so reopening Chats earns a new Back step. */
  useRouteTransition(() => {
    const resume = resumeAfterSale.current;
    if (resume?.leaving) {
      resumeAfterSale.current = { ...resume, leaving: false, destinationHash: window.location.hash };
      return;
    }
    if (resume && window.location.hash === resume.sourceHash) {
      resumeAfterSale.current = null;
      closeSupport();
      setFull(resume.full);
      setOpen(true);
      onOpen(resume.thread);
      return;
    }
    if (resume) resumeAfterSale.current = null;
    minimizedWorkspace.current = null;
    setOpen(false);
    setFull(false);
    onOpen(null);
  });

  /* ── THE PANEL ARRIVES (the reference's own technique) ────────────────────────────────────────
   * «We arrived at a solution which took advantage of motion design principles — progressive
   * loading, staggered entrance animations and transitions — to maximise perceived speed.» That is
   * Intercom's stated method for the Messenger opening, and it is the one thing in their bar our
   * panel had none of: it simply appeared.
   *
   * WHAT IT DOES HERE. The panel grows from the corner it belongs to, over one Base step, on
   * Base's own decelerating curve — the entrance easing Base names for exactly this. It is a
   * TRANSITION rather than a keyframe so it costs nothing when the browser is busy, and the
   * origin is the launcher's corner, which is what makes the panel read as coming OUT of the
   * control that was pressed.
   *
   * AND A PERSON WHO ASKED FOR LESS MOTION GETS NONE. `prefers-reduced-motion` is read once at the
   * moment the panel opens, not baked into a stylesheet, so the setting is honoured live.
   */
  const [arrived, setArrived] = React.useState(false);
  React.useEffect(() => {
    if (!open) {
      setArrived(false);
      return undefined;
    }
    const id = window.requestAnimationFrame(() => setArrived(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);
  const calm =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const launcher = React.useRef<HTMLSpanElement>(null);
  const panel = React.useRef<HTMLDivElement>(null) as React.MutableRefObject<HTMLDivElement | null>;
  /* Focus enters the dialog once when it opens, including on a phone. Thread switches keep focus
     where the operator put it (for example, the reply composer) instead of pulling it to the top. */
  React.useEffect(() => {
    if (!open) return undefined;
    const id = window.requestAnimationFrame(() => panel.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  /** THE EDGE BOTH OF THEM ALIGN TO, stated once — and it is the VIEWPORT'S now (§83.3). The panel
   *  grows out of the launcher's corner, so the two share one number and no surface may move it. */
  const corner = EDGE;
  const thread = threads.find((t) => t.id === currentId) ?? null;

  /* the phone has one posture and it is the screen, so the expand mark has nothing to offer there */
  const expanded = full && !phone;
  /* AND THE TWO PANES INSIDE FULLSCREEN NEED A DESK TO STAND ON (§103) */
  const twoPane = expanded && !stacked;

  /* Opening the workspace and opening a conversation are separate, reversible places. A resize
     or panel resize deliberately stays out of this stack. */
  useHistoryLayer({
    id: 'chats:workspace',
    active: open,
    snapshot: { full },
    onRestore: (snapshot) => {
      if (!snapshot) { setOpen(false); setFull(false); onOpen(null); return; }
      closeSupport();
      setOpen(true);
      setFull(snapshot.full === true);
      onOpen(null);
    },
  });
  useHistoryLayer({
    id: 'chats:thread',
    active: Boolean(open && currentId),
    snapshot: { thread: currentId ?? null },
    onRestore: (snapshot) => onOpen(typeof snapshot?.thread === 'string' ? snapshot.thread : null),
  });
  const previousThread = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!open || !currentId) { previousThread.current = null; return; }
    if (previousThread.current && previousThread.current !== currentId) {
      const history = window.history.state as { rocotoLayers?: Array<{ v: 1; id: string; snapshot: Record<string, string | number | boolean | null> }> } | null;
      const layers = history?.rocotoLayers ?? [];
      const top = layers[layers.length - 1];
      if (top?.id === 'chats:thread') {
        window.history.replaceState({ ...(history ?? {}), rocotoLayers: [...layers.slice(0, -1), { ...top, snapshot: { thread: currentId } }] }, '', window.location.href);
      }
    }
    previousThread.current = currentId;
  }, [open, currentId]);

  /* THE DOOR FROM AN ALBARÁN (§22.4). «Open the chat» in a sale's detail focuses that customer's
     conversation; this widget is what that focus lands in, so a focus arriving while the panel is
     away opens the panel on it. It is the phone's door too now that the tab is gone (§42). */
  React.useEffect(() => {
    if (currentId) { closeSupport(); setOpen(true); }
  }, [currentId]);
  /* ── AND THE PANEL SAYS WHEN IT IS THE SCREEN (§202.3 · `threads.ts`'s `chatIsScreen`) ───────
   * Only on a phone, where this panel takes the whole viewport and the work behind it is another
   * whole viewport. The albarán's pane reads this and steps back, so «Open the chat» shows the
   * conversation rather than opening it underneath — and closing the conversation gives the
   * albarán back exactly as it was left. The last word is said on unmount, because a panel that
   * goes away without withdrawing its claim would hide the work for good. */
  const standing = phone && open && !supportActive && !assistantVisible;
  React.useEffect(() => {
    setChatIsScreen(standing);
    return () => setChatIsScreen(false);
  }, [standing]);
  // Minimize preserves the selected thread so draft, scroll and reply context survive. A sales
  // source can therefore focus the same id again; this request event reopens the visual workspace
  // even though the external currentId prop has not changed.
  /* ── AND IT ANSWERS WHAT THE DOOR ASKED FOR (FEED-IA §202.3 · OUT-05.2 · OUT-05.3) ──────────
   * `openChat(sector, customer, order)` and `openEmail(sector, customer, sourceRef, order)` are the
   * two doors; both arrive here. The ORDER lands on the selection the workspace already knows how
   * to make — `preferredOrder`, the theatre's own mechanism — so a press on an albarán's act opens
   * this panel already standing on that albarán's exchange rather than on the customer's whole
   * year. The CHANNEL lands on `asEmail`, which is how a conversation that carries mail is opened
   * AS mail from a door that knows it is mail. */
  React.useEffect(() => {
    const reopen = (event: Event) => {
      const detail = (event as CustomEvent<ThreadOpening>).detail;
      if (detail?.sector !== cast.sector || !detail.id) return;
      closeSupport();
      setOpen(true);
      if (detail.order) preferTheatreOrder(detail.id, detail.order);
      setOpenedAs(detail.channel === 'email'
        ? { threadId: detail.id, channel: 'email', sourceRef: detail.sourceRef }
        : null);
    };
    window.addEventListener('rocoto:focus-thread', reopen);
    return () => window.removeEventListener('rocoto:focus-thread', reopen);
  }, [cast.sector, preferTheatreOrder]);

  /* GONE MEANS GONE. Putting the widget away also lets the conversation go, so the launcher always
     reopens on the list and the next «Open the chat» is a real change of focus the effect above can
     see — a panel that remembered its thread would stay shut when the same customer's door was
     pressed twice. And it comes back COMPACT, which is what «compact by default» means. */
  const collapseForSale = React.useCallback(() => {
    resumeAfterSale.current = { thread: currentId, full, leaving: true, sourceHash: window.location.hash };
    setOpen(false);
  }, [currentId, full]);

  const hide = React.useCallback(() => {
    /* Minimise is not a destination. Preserve the active conversation/draft/posture in memory,
       neutralise transient chat layers in-place, then close only the visual workspace. */
    minimizedWorkspace.current = { thread: currentId, full };
    const state = (window.history.state ?? {}) as { rocotoLayers?: Array<{ id?: string }> };
    const layers = state.rocotoLayers ?? [];
    if (layers.some((layer) => layer.id === 'chats:workspace' || layer.id === 'chats:thread')) {
      window.history.replaceState({ ...state, rocotoLayers: layers.filter((layer) => layer.id !== 'chats:workspace' && layer.id !== 'chats:thread') }, '', window.location.href);
    }
    setOpen(false);
  }, [currentId, full]);

  /* ── ESCAPE RELEASES THE INNERMOST THING FIRST ───────────────────────────────────────────────
   * The app's own chain, one rung longer: a query in the seat is the seat's (it swallows that
   * press itself), then the size the panel is standing at, then the panel. So a person who
   * expanded to read something gets the desk back before they lose the conversation. */
  /* ── NEW MESSAGE (THE OUTBOUND DOOR) ─────────────────────────────────────────────────────────
     One header action opens a deliberate choice: a real customer's existing WhatsApp conversation
     or the isolated test-chat path. The chooser owns creation; it never invents a second customer
     or conversation store. */
  const [picking, setPicking] = React.useState(false);
  const requestCall = React.useCallback((target: Customer | null) => {
    /* A SEEDED TELEPHONE ACCOUNT STORES NO `phone`; its number is derived, the way the sheet's own
       entrance and CallDock derive it — so the dial opens carrying it rather than empty. */
    openPhoneDial(target ? { number: target.phone?.trim() || accountNumber(target), customerId: target.id } : {});
  }, []);
  React.useEffect(() => registerSupportCloser(() => {
    setOpen(false);
    setFull(false);
    setPicking(false);
    onOpen(null);
  }), [onOpen]);

  const escape = React.useCallback(() => {
    if (!open) return;
    /* AND THE SELECTOR IS INNERMOST OF ALL while it is up — it owns its own Escape, so this rung
       stands aside rather than closing the panel out from under it (§10.4) */
    if (picking || assistantCover.current) return;
    if (expanded) setFull(false);
    else hide();
  }, [open, picking, expanded, hide]);

  /* ── ONE FOLD, ONE COUNT — AND §128.2 CHANGED WHICH FOLD ───────────────────────────────────
     «Any notification in the chats means that they need to reply to something, which is only in
     this situation that we've deferred.» So the badge is `replyOwedCount`, not `unreadCount`: the
     conversations Rocoto DEFERRED A REPLY on, and nothing else. `unreadCount` still stands in
     `threads.ts` and still answers what it always answered — how many conversations nobody has
     opened — and the header's own meta reads it, because that is a fact about the LIST rather
     than a notification. What §128.2 reserves is the channel that INTERRUPTS. */
  useDismissals();
  const unread = replyOwedCount(threads);
  const unopened = unreadCount(threads);
  /* THE BOOK'S OWN SIZE, WITH THE TESTS OUT OF IT (THE CHECKPOINT §10.7). Both numbers this header
     can print come from `threads.ts`, and both of them exclude tests there — so the counts a
     person reads are the house's work and never something they were trying out. */
  const open_ = openCount(threads);

  /** the accounts the morning is already talking to, newest conversation first — the «recent»
   *  half of §10.3's shortlist, read off the list rather than counted again */
  const recent = React.useMemo(
    () => threads.filter((t) => !t.test).map((t) => t.customer.id),
    [threads],
  );
  const startTest = React.useCallback(
    (subject: TestSubject) => {
      setPicking(false);
      setOpen(true);
      /* ── A ROLEPLAY ASKS FOR THE SCREEN (FEED-IA §91.4.7, and it is an ASK not a memory) ──────
         The guided path is «bubble → the chat → FULL SCREEN → New test chat»: the roleplay is a
         two-view surface carrying a conversation, an order and an inspector, and the compact box
         cannot hold it — the panel came out with the inspector cut off under the pinned order.
         §42's law is untouched: fullscreen is still ASKED FOR and never remembered, and starting
         a test IS the ask. Putting the widget away gives the desk back, as it always did. */
      setFull(true);
      /* THE LABEL AND THE ACCOUNT ARE RESOLVED HERE, not in the store — see `threads.ts`'s import
         note for why that file takes nothing from the capability at runtime. */
      const id = startTestChat(
        cast.sector, subject, subjectCustomer(subject), testLabel(subject), nowOf(cast),
      );
      announce(TEST_EVENTS.started, { thread: id, cold: subject.kind === 'new' });
    },
    [cast],
  );

  /** THE SIZE CONTROL, ONE SEAT, TWO MINDS (§42, §30). Expand while it is compact, collapse while
   *  it is full — the same seat, the opposed pair of marks, never two buttons for one decision. */
  const sizer = phone ? null : (
    <HeaderButton
      onClick={() => setFull((was) => !was)}
      label={expanded ? 'Collapse workspace' : 'Expand workspace'}
      testid="chats-expand"
    >
      <span data-mark={expanded ? 'collapse' : 'expand'} style={{ display: 'inline-flex' }}>
        <Glyph id={expanded ? 'collapse' : 'expand'} size={STEP.small} />
      </span>
    </HeaderButton>
  );

  const workspaceActions = (
    <>
      {thread && !thread.test && (
        <HeaderButton onClick={() => requestCall(thread.customer)} label={`Call ${thread.customer.name}`} testid="thread-call">
          <PhoneKeypadMark size={STEP.small} />
        </HeaderButton>
      )}
      {sizer}
    </>
  );

  // Scenario playback is an explicit internal harness. Normal customer URLs never render it.
  const showTheatre = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('theatre') === '1';

  const list = (
    <ThreadList
      cast={cast}
      threads={threads}
      currentId={currentId}
      onOpen={onOpen}
      title={undefined}
      /* THE HEADER STATES WHAT THE LIST IS CARRYING, in the word that is true of it: these are
         conversations whose last word is the customer's and which nobody has opened. «Waiting on
         you» is the narrower flag a ROW carries — a sale that needs the person's own sentence — and
         the two must not borrow each other's word.
         IT IS SAID, NOT BADGED, and that is the whole of §42's «no chat ping»: a number in a header
         a person is reading is the list's own weight; a number in a ring on a closed door is a
         second counter competing with the band's «Messages · N». */
      meta={unopened > 0 ? String(unopened) + " unread" : String(open_) + " open"}
      theatre={showTheatre ? <TheatreControls player={theatrePlayer} /> : undefined}
      pinnedRows={<>
        <div style={{ padding: theme.sizing.scale400 }}><Button kind={KIND.secondary} size={SIZE.compact} data-testid="chats-connected-accounts" onClick={() => { setConnectedSource(true); setConnectedNumber(undefined); }}>Connected accounts</Button></div>
      </>}
      /* ── WHAT THE LIST'S HEADER CARRIES, AND WHAT IT YIELDS AT FULL WIDTH ──────────────────
         §10.2's explicit action lives here, always. The PANEL's own two controls — the sizer and
         the way out — belong to whichever surface the person is looking at: in the compact and
         book postures that is this list, and at fullscreen the conversation stands beside it and
         takes them. Left in both places the 400px list header ran out of room and the count came
         out as «11 un…», which is §35.1's own rule broken — a number truncated is a number that
         lies. */
      actions={
        <>
          <HeaderButton onClick={() => requestCall(null)} label="Call someone" testid="new-call">
            <PhoneKeypadMark size={STEP.small} />
          </HeaderButton>
          <NewTestChatAction onOpen={() => { setPicking(true); announce(TEST_EVENTS.selector); }} />
          {!(expanded && thread) && sizer}
          {!(expanded && thread) && (
            <HeaderButton onClick={hide} label="Close chat" testid="hide-chats">
              <Chevron towards="down" />
            </HeaderButton>
          )}
        </>
      }
    />
  );

  return (
    <>
      {/* THE SELECTOR STANDS ON ITS OWN LAYER, over the panel it was opened from (§10.4) */}
      <TestSelector
        cast={cast}
        recent={recent}
        isOpen={picking && !supportActive && !assistantVisible}
        onClose={() => setPicking(false)}
        onStart={startTest}
      />
      <Layer
          onEscape={escape}
          onDocumentClick={(e) => {
            if (!open || supportActive || assistantCover.current) return;
            const target = e.target as Node;
            /* the panel's own presses are its own business, and the launcher press toggles */
            if (panel.current?.contains(target) || launcher.current?.contains(target)) return;
            /* AND THE SELECTOR'S ARE ITS OWN TOO — a press inside the card it opened must not
               dismiss the panel underneath it (§10.4) */
            if (picking) return;
            hide();
          }}
        >
          {open && !supportActive && expanded && !phone && !assistantVisible && <div aria-hidden="true" data-testid="chats-backdrop" style={{
            position: 'fixed', inset: 0, zIndex: 8, background: theme.colors.backgroundOverlay,
            backdropFilter: calm ? undefined : 'blur(7px)',
          }} />}
          <div
            ref={(node) => {
              panel.current = node;
              node?.toggleAttribute('inert', !open || supportActive || assistantVisible);
            }}
            data-testid="chats-overlay"
            /* FOUR POSTURES, STATED (§42 + §77.4). `book` and `compact` are the two sizes the
               widget takes on its own as a person navigates; `full` is the one they ask for; the
               phone has one and it is the screen. */
            data-posture={expanded ? 'expanded' : 'collapsed'}
            /* THE PANEL SAYS WHETHER IT IS STANDING — the same fact `inert` above is toggled on — so an
               in-place surface (the phone dial, phone-session.ts) can read it as a stated contract
               rather than infer it from an absent aria-hidden. */
            data-open={open && !supportActive && !assistantVisible ? 'yes' : 'no'}
            data-phone={phone ? 'yes' : 'no'}
            role="dialog"
            aria-label="Chats"
            aria-modal={open && !supportActive && (expanded || phone) || undefined}
            aria-hidden={assistantVisible || supportActive || !open || undefined}
            tabIndex={-1}
            style={{
              position: 'fixed',
              /* AN OVERLAY MUST OUTRANK THE WORK, AND THIS ONE DID NOT. The panel stood on `Layer`
                 alone with `z-index: auto`, so the first surface to raise a positioned section
                 above it won: the river's sticky band (`z-index: 4`) painted its tap-through
                 targets over the panel, and every press meant for a conversation opened a sale
                 instead. It takes a rung of its own — over the launcher it grows from (8) and
                 everything the page stacks, under the popovers Base opens from inside it (12).

                 ⚠ AND A RUNG IS NOT HOW THE PHONE IS SETTLED (§202.3 · E200.04). An albarán's own
                 pane stands at `LAYER + 1` = 13 on a phone (`detail.tsx`), so raising this to 10
                 changes nothing and raising it past 13 would put the panel over the very menus it
                 opens. Two full screens cannot both be the screen: the pane STEPS BACK instead,
                 which `chatIsScreen` below says and `detail.tsx` answers. */
              zIndex: 9,
              display: assistantVisible || supportActive || !open ? 'none' : 'flex',
              flexDirection: 'column',
              minWidth: 0,
              background: theme.colors.backgroundPrimary,
              overflow: 'hidden',
              /* the entrance: out of the corner the launcher stands in, on Base's own step and
                 Base's own decelerating curve. A calm reader gets the resting state directly. */
              ...(calm
                ? null
                : {
                    transformOrigin: phone ? 'center bottom' : '100% 100%',
                    opacity: arrived ? 1 : 0,
                    transform: arrived ? 'scale(1)' : 'scale(0.96)',
                    /* ── THE ENTRANCE, AND THE MORPH (§42 + §77.4) ───────────────────────────
                       The entrance is the reference's own: out of the launcher's corner, one Base
                       step, Base's decelerating curve. The MORPH between the two sizes is the
                       symmetric curve at a longer step, because the panel is not arriving — it is
                       changing size, and a box that both leaves a width and arrives at one wants
                       the same easing at both ends. «The transition calm» is that curve and the
                       fact that nothing else moves with it. */
                    transition:
                      `opacity ${theme.animation.timing400} ${theme.animation.easeOutCurve},`
                      + ` transform ${theme.animation.timing400} ${theme.animation.easeDecelerate},`
                      + ` width ${theme.animation.timing400} ${theme.animation.easeInOutCurve},`
                      + ` height ${theme.animation.timing400} ${theme.animation.easeInOutCurve}`,
                  }),
              ...(phone
                ? {
                    /* THE PHONE'S PANEL IS THE SCREEN (§42). It covers the footer navigation while
                       open, so the conversation keeps its full vertical working space and its close
                       chevron remains the single way back to the app. Square corners, because a
                       sheet that meets three edges of the glass has no corners to round. */
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderTop: 'none',
                  }
                : expanded
                  ? {
                      /* The expanded workspace nearly fills the desk while its softened edge makes
                         the underlying work visibly inactive. Escape/back retain the existing collapse path. */
                      inset: EDGE,
                      border: `1px solid ${theme.colors.borderOpaque}`,
                      borderRadius: theme.borders.radius500,
                      boxShadow: `${theme.lighting.shadow700}, 0 28px 72px color-mix(in srgb, ${theme.colors.contentPrimary} 18%, transparent)`,
                    }
                  : {
                      /* ── THE TWO SIZES, AND THE CORNER THEY SHARE (§77.4) ─────────────────
                         The book while the list is showing, the compact box while a conversation
                         is. `right` and `bottom` are the same numbers in both, so the morph moves
                         one corner and holds the other. */
                      right: corner,
                      bottom: EDGE + LAUNCHER + GAP,
                      width: thread ? PANEL_WIDTH : BOOK_WIDTH,
                      maxWidth: `calc(100vw - ${EDGE + corner}px)`,
                      height: thread ? COMPACT_HEIGHT : BOOK_HEIGHT,
                      maxHeight: PANEL_HEIGHT,
                      border: `1px solid ${theme.colors.borderOpaque}`,
                      /* §40.1: the top of Base's radius ladder. A widget this size on a 12px corner
                         reads as a tooltip that grew; 16 is the reference's own geometry. */
                      borderRadius: theme.borders.radius500,
                      boxShadow: theme.lighting.shadow700,
                    }),
            }}
          >
            {!connectedSource && twoPane && thread && (
              <div data-testid="chats-edge-actions" style={{ position: 'absolute', top: theme.sizing.scale100,
                right: theme.sizing.scale100, zIndex: 2, display: 'inline-flex', alignItems: 'center' }}>
                {sizer}
                <HeaderButton onClick={hide} label="Close chat" testid="hide-chats-edge"><Chevron towards="down" /></HeaderButton>
              </div>
            )}
            {connectedSource ? <React.Suspense fallback={<p role="status" style={{ padding: theme.sizing.scale500 }}>Opening connected conversations…</p>}>
              <ConnectedInbox onBack={() => setConnectedSource(false)} onClose={hide} number={connectedNumber} />
            </React.Suspense> : twoPane ? (
              /* ── THE MAIL-APP GRAMMAR, AT FULL WIDTH (§42, §38) ─────────────────────────────
                 «The list may sit beside the thread at fullscreen width like a mail app.» Two
                 panes, each one scrollport, the same law every master-detail surface in this app
                 keeps. The list holds its 400 so a row is laid out identically in all three
                 postures and never has to re-tune its truncation (§40.7). */
              <div
                data-testid="chats-panes"
                style={{
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: `${PANEL_WIDTH}px minmax(0, 1fr)`,
                }}
              >
                <div
                  data-testid="chats-list-pane"
                  style={{
                    minHeight: 0,
                    minWidth: 0,
                    overflowY: 'auto',
                    overflowX: 'clip',
                    borderRight: `1px solid ${theme.colors.borderOpaque}`,
                  }}
                >
                  {list}
                </div>
                <div style={{ minHeight: 0, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                  {thread ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        maxWidth: THREAD_MEASURE,
                        minHeight: 0,
                        minWidth: 0,
                      }}
                    >
                      <WorkspaceConversation cast={cast} thread={thread} threads={threads} onCollapse={collapseForSale} preferredOrder={preferredTheatreOrder?.threadId === thread.id ? preferredTheatreOrder : undefined} asEmail={openedAs?.threadId === thread.id} />
                    </div>
                  ) : (
                    <p
                      data-testid="chats-pick-one"
                      style={{
                        margin: 'auto',
                        ...theme.typography.ParagraphSmall,
                        color: theme.colors.contentTertiary,
                      }}
                    >
                      Pick a conversation.
                    </p>
                  )}
                </div>
              </div>
            ) : thread ? (
              <WorkspaceConversation
                cast={cast}
                thread={thread}
                threads={threads}
                onBack={() => onOpen(null)}
                backLabel={undefined}
                actions={workspaceActions}
                onHide={hide}
                onCollapse={collapseForSale}
                preferredOrder={preferredTheatreOrder?.threadId === thread.id ? preferredTheatreOrder : undefined}
                asEmail={openedAs?.threadId === thread.id}
              />
            ) : (
              /* ONE AXIS, ON PURPOSE. `overflow-y: auto` on its own computes `overflow-x: auto`,
                 so a column that only ever scrolls downward quietly becomes a sideways scrollport
                 too, and one stray pixel of a row turns into a scrollbar. `clip` states the other
                 axis without making this element a scroll container on it.
                 AND IT IS THE PANEL'S ONLY ONE (§38): the list's header rides inside it rather
                 than above it, so the widget has one scroll and the header scrolls with the
                 conversations it counts. */
              <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'clip' }}>
                {list}
              </div>
            )}
          </div>
        </Layer>

      {/* THE DOOR, AND NOTHING BUT THE DOOR (FEED-IA §42).

          ═══ AND IT WEARS THE ACCENT (FEED-IA §83.4) ═════════════════════════════════════════
          «I think the chat bubble can be red btw.» It stood in INK on the argument that «a
          conversation is the customer's act and the person's answer, and saffron is reserved for
          what Rocoto did on its own» — a good reading of §51's colour law, and the wrong one about
          this object. THE BUBBLE IS NOT A CONVERSATION; IT IS ROCOTO'S OWN PRESENCE ON THE SCREEN,
          the one mark standing over every surface saying the system is here and listening. That is
          precisely what the accent is licensed for, and he has now said so in words.
          THE PAINT COMES FROM THE TOKEN AND NOWHERE ELSE — `theme.colors.accent`, so the brand
          sweep re-hues it with everything else and `?theme=proof` moves it. No literal in this
          file, which the theme gate enforces.
          THE BADGE STAYS LEGIBLE ON IT. `Count` inverted is PAPER with an ink hairline and ink
          figures, so it reads at maximum contrast against its own ground and separates cleanly
          from the accent ring it rides — the same drawing it had on ink, unchanged.

          ONE CONTROL, TWO STATES (FEED-IA §40.5). Closed it is the conversation mark; open it is a
          chevron down — «put this away» — which is the reference's own move and the reason the
          panel needs no second close anywhere near it.

          ═══ AND IT CARRIES THE COUNT AGAIN (FEED-IA §75.2) ══════════════════════════════════
          «The Messages card at the river's top goes — it should just be a number on the widget.»
          §42 killed the badge because the band's «Messages · N» row was already saying the same
          fact in the place a person decides what to do next. §75.2 removes that row, so the fact
          has ONE home again and this is it: the count is not duplicated, it has moved. The rule
          §42 was really protecting — one place says what is owed — is kept exactly.

          WHAT IT COUNTS IS THE FOLD, and nothing this file adds up on its own: `Thread.unread` is
          «the customer spoke last and nobody has opened it» (threads.ts), summed once, read here
          and by anything else that ever needs it.
          IT IS THE KIT'S OWN `Count`, inverted, because the launcher is an ink circle and a badge
          on ink is paper with an ink hairline. Nothing here is a colour with a meaning.
          A QUIET MORNING WEARS NO BADGE — zero draws nothing, which is §61's «the win felt».

          IT STEPS OFF THE PHONE WHILE THE PANEL IS UP, because the panel is standing exactly where
          it stands — the header's own chevron is the way out there. */}
      {!open && !supportActive && !assistantVisible && (
      <span
        ref={launcher}
        style={{
          position: 'fixed',
          right: corner,
          /* the phone's bottom row owns the foot of the screen, so the launcher rests above it */
          bottom: phone ? `calc(${EDGE + BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))` : EDGE,
          zIndex: 8,
          display: 'inline-flex',
        }}
      >
        <button
          type="button"
          data-testid="chats-launcher"
          data-open={open ? 'yes' : 'no'}
          data-mark={open ? 'caret' : 'chat'}
          aria-label={
            open
              ? 'Put the chats away'
              : unread > 0
                ? `Chats — ${unread} ${unread === 1 ? 'reply' : 'replies'} owed`
                : 'Chats'
          }
          aria-expanded={open}
          onClick={() => { if (open) { hide(); return; } const snapshot = minimizedWorkspace.current; closeSupport(); if (snapshot) { setFull(snapshot.full); onOpen(snapshot.thread); } else setFull(false); setOpen(true); }}
          style={{
            position: 'relative',
            width: LAUNCHER,
            height: LAUNCHER,
            display: 'grid',
            placeItems: 'center',
            border: 'none',
            borderRadius: '50%',
            /* §83.4 — the accent, off the token. The mark on it is paper, which is the ratio the
               brand's own accent was chosen against. */
            background: theme.colors.accent,
            color: theme.colors.backgroundPrimary,
            boxShadow: theme.lighting.shadow600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {/* THE MARK TAKES 45% OF THE RING AND IS CENTRED IN IT (§31.2). It used to be handed a
              flat 24 inside 56 and drawn by an inline svg sitting on a text baseline, so it came
              out small, low and left of the circle it was supposed to be the middle of. */}
          <Glyph id={open ? 'caret' : 'chat'} size={CIRCLE_MARK(LAUNCHER)} />
          {/* THE COUNT RIDES THE RING'S SHOULDER (§75.2, §31.2's container rule). It is drawn only
              while the panel is AWAY: with the conversations on screen the badge would be counting
              what the person is already reading. */}
          {!open && unread > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                display: 'inline-flex',
              }}
            >
              <Count value={unread} invert testid="chats-launcher-count" />
            </span>
          )}
        </button>
      </span>
      )}
    </>
  );
}
