import { canonicalSyntheticAmount, solesRate, syntheticAmountForCountry, workspaceCurrency } from './currency';
import { workspaceCapabilitiesNow } from './workspace-capabilities';
/* THE SALE, OPEN — Monzo's transaction detail, for the object that IS our transaction.
 *
 * ═══ IT IS WITHIN, NEVER ON TOP (FEED-IA §7.1) ══════════════════════════════════════════════
 * «Master-detail inline: on desk the panel sits beside the list (both alive, list scrollable,
 * selection lit); on phone it fills the screen BUT carries ‹ › chevrons to FLIP to the previous/
 * next order without exiting. "People want to flip through stuff and act without leaving full
 * orders" — direct user feedback, super key.»
 *
 * So this panel has no scrim, no layer and no dismissal gesture. It draws in the column Sales gives
 * it. The close is its own affordance, at the panel's head, where a close belongs; the FLIP moved
 * down to the controls (§17.2) because flipping is a control and controls live under the card.
 *
 * ═══ THREE REGISTERS, AND NOTHING MAY BLUR THEM (FEED-IA §14) ═══════════════════════════════
 * «Very busy, hard to pick up what's the albarán wrapped, and what's the extra info for it, and
 * what's the action. The send and add-line thing is confusing. Think about how stuff fits when
 * everything is expanded.» The panel was one stack of hairline-separated bands, so the document,
 * the notes about it and the acts upon it all had the same weight and the same edge. Now:
 *
 *   1 · THE DOCUMENT   a POPPED-OUT CARD (§17.2) — paper on the ground, elevated, one continuous
 *                      wrapped object the way the print view renders paper. It holds WHO it is to,
 *                      WHAT it carries, and THE FIGURE at its foot where a total belongs. «Add a
 *                      line» is inside its body, at the foot, quiet — it GROWS the document.
 *   2 · THE CONTROLS   ONE DOCK, directly under the card (§17.2): the state's one verb, the ‹ ›
 *                      flip, the paper, the door to the customer. Nothing on the card is a control
 *                      and nothing in the dock is the document — that separation IS the fix.
 *   3 · THE ANNOTATION everything ABOUT the document — what Rocoto saw, what it read, what it
 *                      learned, the change, and the conversation on its dotted paper inside a
 *                      faint accent ring (§17.3). It sits flat on the ground at a smaller step, so
 *                      it can never be mistaken for the document standing above it.
 *
 * THE EXPANDED STATE IS THE ONE THAT WAS DESIGNED FOR. Open every line editor, the thread and the
 * flags at once and the three registers still read, because the distinction is STRUCTURAL — a
 * raised card, a docked bar, flat marginalia — rather than a matter of how much is on screen.
 *
 * ═══ LINE EDITING, THE WHOLE OF IT (FEED-IA §8, §16) ════════════════════════════════════════
 * The named shortfall, closed. A line is a row you tap, and it opens where it stands — never a
 * second surface, because the person is comparing it with the four lines around it and a layer
 * takes those away. Every state is drawn:
 *   RESTING   the line as the albarán carries it
 *   EDITING   the editor beneath it, on the line's own ground
 *   EDITED    the Figure strikes what it replaced, so the change is legible without a diff
 *   EMPTY     a line the message never carried an amount for says so and prices nothing — a fake
 *             zero is a confident number where there is no number
 *
 * ═══ WHAT SAFFRON MARKS ════════════════════════════════════════════════════════════════════
 * Rocoto's own acts, and nothing else: what it read the message as, what it filled a line with,
 * what it resolved an amount into, and what it has noticed about a word. Every commit, make,
 * print, tick and send on this panel is a PERSON's act and is drawn in ink.
 */
import { skuDetails, useSKURecords } from './sku-record';
import { ProductCode } from './product-code';
import * as React from 'react';
import { AttentionLabels } from './attention-labels';
/* §196.3 · the one red-flag vocabulary — the head reads the ink from it rather than typing the
   accent itself, so the document's flag and the river's row wear the same red. */
import { flagInk } from './red-flag';
/* §194.2 · the type's own widths, shared with every surface that plans a column of figures */
import { LINE_FIGURE_PX, LINE_PLAN_MARGIN, LINE_UNIT_PX } from './row-plan';
import { LineNoteContext } from './line-notes';
import { customerOptionText } from './customer-option';
import { AlbaranPaperReviewCard, beginAlbaranCorrection } from './albaran-paper-review';
/* E196 · OUR PAPER, READ BACK. The paper review holds the photograph; this reads it against the
   layout the sheet was printed from and puts the final weights back on their own lines. It draws
   nothing at all without a runtime, so the card below keeps its behaviour unchanged. */
import { PaperReadBackDock } from './paper-read-back';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { ButtonGroup, MODE } from 'baseui/button-group';
import { Checkbox } from 'baseui/checkbox';
/* THE SUGGESTION FIELD (§31.3). A name opens WITH its candidates, so the control is Base's own
   Combobox — a text field that carries a ranked list rather than a select that refuses one. */
import { Combobox } from 'baseui/combobox';
import { Select } from 'baseui/select';
import { Input } from 'baseui/input';
import { StatefulMenu } from 'baseui/menu';
/* THE FIELD ROW'S OVERLAY (FEED-IA §41.5). `Popover` is the stateless one — the row drives which
   field is open, so the layer, the placement engine and the escape handling are Base's and the
   keyboard contract is the row's. */
import { StatefulPopover, Popover, ACCESSIBILITY_TYPE, PLACEMENT, TRIGGER_TYPE } from 'baseui/popover';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { StatefulTooltip, PLACEMENT as TOOLTIP_PLACEMENT } from 'baseui/tooltip';
import { Figure } from './figure';
import { Message, AUTHOR } from '../../rocoto/message';
import { SourceThread } from './source-thread';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import { ProduceIcon, type Family as IconFamily } from '../../rocoto/produce-icons';
import { WeightEntry } from '../../rocoto/weight-entry';
import { dots, DOT_TILE } from '../../rocoto-theme';
import { embedsOf, ChatEmbed } from './shell/embeds';
/* THE OBJECT DOORS (§43). Only the two acts are taken — this file draws its own `Door` for the
   dock's glyph row, which is a labelled ACT rather than an object's name. */
import { Door as ObjectDoor, anchorFor, openCustomer, openProduct, useHistoryLayer } from './anchors';
/* §137.2 · the essentials a pointer at rest asks for, on the head's own name */
import { CustomerHoverCard } from './customer-hovercard';
import { ANSWER_TAG, priceOf } from '../../scenarios/canonical/resolution';
import ChangeNotice, { type NoticeRow, type Outcome } from '../../scenarios/canonical/change-notice';
import { productOf, supplierOf, type Cast, type Customer, type Product } from '../../scenarios/data/cast';
/* THE SUGGESTION SOURCES, READ-ONLY (THE-INTELLIGENCE §10). The ontology and what the house's own
   documents have already proved about it — the ranking the name's dropdown lands on.
   AND THE PARSE (THE-DENSE-BRIEF-DESIGN §10): the writing line decomposes a written string into the
   ladder's own parts against these same registers, so the picker and the order-reading brain are
   one machine seen from a keyboard. */
import {
  SORTS, ancestorsOf, childrenOf as childrenOfNode, claims, claimsPhrase, foldWord,
  ground, productForNode,
  /* THE RESOLUTION LAW'S OTHER HALF (FEED-IA §80): how many forms of a thing the house sells.
     The members are the family's — the words the traffic keeps saying and the ones a hand wrote,
     minus the ones that already became products of their own — read off the catalogue's own
     store, never counted a second way here. */
  amendmentProduct, amendmentsOf, sortsOf, useCatalogue,
  /* AND THE MEMBERS THIS HOUSE HAS GRADUATED (C7) — products of its own, so the composer can put
     one on a document by the name the house itself taught the catalogue. `graduatedNode` is the
     node each of them answers to, and `graduatedBase` the row its price comes off. */
  graduatedBase, graduatedNode, graduatedProducts,
  /* THE DIMENSIONS (FEED-IA §41.1) — the closed registers a family's goods take. The organ reads
     them off the same fold, so a word this file draws and a chip the organ paints are one answer. */
  dimensionsFor,
  type DimensionId,
} from './catalogue';
/* THE PAINTED LIBRARY (THE-DENSE-BRIEF §B/§C). The face a product wears — on the line, on the
   candidate row, and on the writing line as the parse resolves. */
import { paintingFor } from './painting-map';
/* THE MAILBOX THIS WORKSPACE HOLDS (FEED-IA §247.2) — one selector, read where it is drawn, the
   same one Connections, the connected inbox, the composer and Prep read. */
import { useEmailCapability } from './email-provider';
/* WHAT THE HOUSE ANSWERED ABOUT WORDS OFF ITS CATALOGUE (§10, the two postures) */
import { useGrants } from './grants';
/* THE NET IS WHAT «SAFE» MEANS (checkpoint §9, FEED-IA §32.B) — the same predicate the band's own
   proof reads, so the action policy and the net can never disagree about what got through. */
import { passesNet } from './net';
/* WHO TAKES IT FROM HERE (checkpoint §5's routing). `memberOf` is aliased because `sale.ts` owns a
   different one — a family's member — and one name for two objects is how a wrong lookup ships. */
import {
  memberOf as personOf, useCompany,
  type Company, type EscalationTopic, type Member,
} from './company';
/* THE PREP NOTE'S STORE AND ITS MEMORY (§6). The store is a STUB SEAM — see knows.ts. */
import { productsOf } from './knows';
import ProductCard from './product-card';
import type { SectorId } from '../../scenarios/meta';
import Name from '../../scenarios/shell/Name';
import { dayNow, nowOf, plural, setDay, useDay } from './day';
import { useConfig, type Derived } from './config';
import { DeliveryNoteMoney } from './money-document';
import { useWorkspaceCapabilities } from './workspace-capabilities';
import { LotSplitEditor, lotNumber, splitState, type LotShare, type RecordedLot } from './lot-split-editor';
import { lotsForAllocation, useAllocationBook } from './lot-allocation-book';
import { capabilityAvailable } from './release-profile';
import { accountChannelOf } from './reply-channel';
import { unitChoices, conversion, describeUnit, useUnits } from './units';
import { saveLineEdit } from './sale';
/* PRINTING IS AN ACT, AND THE ACT IS ENQUEUEING (FEED-IA §20, §22.7). The dock's print control puts
   the albarán on the printer there and then; the sheet is what the eye beside it opens. */
import { albaranOrder, jobFor, useQueue } from './print-queue';
import { printSourceRun, newPrintAttemptKey } from './browser-print';
import { openPrintActivity } from './print-activity';
import { BOTTOM_NAV_HEIGHT, TOUCH_FLOOR, openChat, openEmail, threadOf, useChatIsScreen, usePhone, usePricedDocumentDeclared, usePushed, useThreads } from './shell';
/* THE LAUNCHER'S OWN NUMBER (FEED-IA §83.3). The dock stands in the corner the chat bubble owns,
   so it reserves that corner by READING the bubble's constant rather than restating it — the
   inversion's other half, stated at the constant in `shell/chats.tsx`. */
import { LAUNCHER_LANE } from './shell/chats';
/* THE RECORDING, MOUNTED RATHER THAN REDRAWN (§46.2, §54.3). The voice note an order arrived as is
   the SAME object the chat widget draws — one player, one waveform, one transcript — so the sheet
   asks the shell's own media package for it instead of growing a second one. */
import { VoiceNoteBody } from './shell/media';
import type { ThreadTurn } from './shell/threads';
/* ONE VOCABULARY OF MARKS (§30): the app's meanings, mapped onto the Lucide pack in one file */
import { Glyph, Shortcut, STEP, type GlyphId, ActDot } from './glyphs';
/* §86.4b — the account's usual hour is OFFERED on a document the desk wrote, never asserted */
import { takeSlot, useSlotsTaken } from './slot-offer';
/* §83.1 — a document with nothing on it states no total; it shows the shape of one */
import { GhostBlock, GhostFigure } from '../../rocoto/ghost';
/* THE EDITABLE AFFORDANCE HAS ONE HOME (THE-ADMIN-BUILD §2.3 — the collapse this file owed).
   The doctrine that decided it is stated below, where the private copy used to stand. */
import { Editable } from './rows';
/* THE MAP, AND THE CREDIT THAT TRAVELS WITH IT (LICENSES-AND-ATTRIBUTION.md's open note). The
   72px square's hover label used to repeat the literal «© OpenStreetMap contributors» while the picture it
   opens rendered «© OpenStreetMap contributors · OpenMapTiles» off the exported constant — one attribution
   written in two places, which is how a licence line goes stale in the half nobody looks at. */
import PinMap, { MAP_CREDIT } from './pin-map';
/* the choropleth is parked (§25); what survives it is the house's own word for a run, which the
   truck chips and this panel's caption both say */
import { zoneNameOf } from './round-map';
/* THE RUN, SAID IN THE HOUSE'S OWN CHIP (FEED-IA §86.1 · §21). Its own file's rule: «the flat river
   rows and THE SHEETS keep the full chip» — this head is the sheet that had not got it yet. */
import { TruckChip } from './truck-chip';
/* THE MONEY PACKAGE'S OWN SEAMS (THE-DENSE-BRIEF-DESIGN §2 and §9). The band a document priced
   from, and whether it has been collected — both owned by sale.ts and tiers.ts, both READ here. */
import { isMultiTier, lastSetOf, priceOn, sourceWords, tiersOfHouse } from './tiers';
import { ConfidenceTick, OWED_WORD, TICK_SEAT, useOwed } from './tick';
import { ConcernNote } from './anxiety';
import { cancelEmail, emailCancelledNow, useEmailCancelled, dismissedNow, useDismissals } from './dismissals';
import {
  addBareLine, addLine, adoptLine, amendLine, chooseLineSku, rejectLineSkuChoices, amountWords, answerSale, answerWords, askedQtyWords, askWords, batchesFor, canAnswer, attachLots, cancelSend, noteLine,
  /* THE FOUR ACTION POLICIES read these and nothing else (checkpoint §9) — the adapter below */
  answerOwed, isStanding, openNonSku, rubricOf, standsInDay, standingConcernsOf,
  commitSale, conversionWords, correctFill, declineSale, archiveSale, deliverSale, editLine,
  fillWords, flagsOf, flagText, flipUnit, flipUnitsOf, graduateAmendment, graduationOf,
  graduationWords, guardsOf, heroSubOf, makeSale, prepareLine, primaryOf,
  priceAnswer, proposalWords, proposeLots, qtyWords, removeLine, replySale, resolveSale,
  flagSale, unflagSale, readSale, restoreLine, saleReplyHour, scaleReading, supplyAnswer, todayId, STATE_TEXT,
  scheduleSale, sendSale, settleSale, unprepareLine, weighsOnScale, whatOf, withPicks,
  markPaid, moneyMarkOf, payMethodOf, setSaleTier, tierSwitchWords, tierWordsOf,
  /* THE THREE ROADS OUT (FEED-IA §35.3, §35.5): the rails' own sentences, their two predicates,
     the acts that answer them, and the hour the customer asked for. */
  askedSlotOf, editedSincePrint, editedSinceErp, emailWordsOf, erpWordsOf, exportStance, handAt,
  liveReadingOf, printedWordsOf,
  /* WHAT THE LIVE READING WAS READING (AUDIT-2 C25). The state row asks which rail answered, so
     the first cell can stand down where the paper cell is already saying that fact. */
  canPrepare, owedOf,
  railWorld, scheduleEmail, sendToErp, slotOf, takesEmail, wantsErp,
  /* THE LINE'S OWN FACTS (FEED-IA §41.1, §41.3) — both write the `line` event that already exists */
  setDimension, putFinalWeight,
  /* THE FAMILY GRAMMAR, MIRRORED ON THE LINE (THE-OBJECT-MAP C5) — a base and the word riding it */
  memberOf,
  /* THE RESOLUTION LAW (FEED-IA §80) — a word that names a family with more than one member is
     ambiguous by construction, and the law lives in the model rather than at this call site */
  resolveWord,
  /* WHERE THE GOODS GO (FEED-IA §86.1 · §21) — the run this customer is on, read off the customer
     and never typed, so the head, the river's rows and the map all name one round */
  roundOf,
  GRADUATED_WORDS, NON_SKU_ANSWER, NON_SKU_LABEL, PAY_METHODS, PAY_METHOD_WORDS, RANK,
  type Allocation, type AllocationCandidate, type AllocationCandidatesFor, type AllocationPick, type LineDimensions, type LotProposal, type PayMethod,
  type Sale, type SaleLine,
} from './sale';

/* ── THE VIEWPORT ─────────────────────────────────────────────────────────────────────────────
 * A sidebar needs a desk to stand beside. Below that the same panel takes the whole screen,
 * because a 420px column on a 390px phone is a column with no page left over.
 */
/** THE MAP'S THUMBNAIL (FEED-IA §39.1). Two rows of the head's own type tall, so the square reads
 *  as a fact standing beside the customer's name rather than as a picture the head is wrapped
 *  around. The big one opens in the app's own dialog vocabulary. */
const MAP_SQUARE = 72;

/* ── THE ONE FLOOR EVERY PRODUCT-LEVEL ROW STANDS ON (FEED-IA §84.1 · §78.4) ──────────────────
 * «One grammar for product-level rows, EVERYWHERE — word · facts · PRICE RIGHT on the number's
 * line, one height. Put the catalogue row, the sheet line, and the composer line side by side —
 * a stranger must read them as ONE system.»
 *
 * 48 is the number the catalogue already holds (`areas/stock.tsx`: a member row and the door that
 * adds one to a family both state it, off the Uber extract's touch-target rule), and it is the
 * TOUCH FLOOR of the family: no product-level row anywhere may stand shorter than a thumb.
 *
 * ⚠ IT NEVER BOUND ON A SHEET LINE, and that mattered the moment §109.6 asked the row a person
 * types into to BE the row the line becomes. A sheet line carries three storeys, so its band is
 * always taller than 48 — declaring 48 on it said nothing about its real height, which is why the
 * add-a-line row could stand on «the same floor» and still be a different size. `LINE_BAND` below
 * states the real number, and this one stays as what it always was: the minimum, kept here so the
 * family's rule has a name.
 */
const LINE_ROW = 48;

/* ── THE BAND AN EDITABLE LINE ACTUALLY STANDS ON, MEASURED (FEED-IA §109.6 · §77.2 · §84.3) ──
 * «The hosted field is A SINGLE ROW, FULL WIDTH; as the text is captured it BECOMES COLUMNS in
 * place — the structure materializes under the words.» For that to be a MORPH and not a jump-cut,
 * the band a person types into has to be the band the line will stand on, to the pixel.
 *
 * SO IT IS MEASURED HERE RATHER THAN GUESSED. An editable line's name column stands on three
 * storeys, each at its own step out of Base's own scale, and every value on it wears §51.14's
 * ring — a 1px border, transparent at rest — which is 2px of line box on each storey:
 *
 *     the name           LabelSmall       16 line box  + 2 ring   = 18…20
 *     + the column's gap                   4
 *     the packing-note ghost  ParagraphXSmall 20 + 2 ring         = 22   (at rest on every
 *     + the column's gap                   4                              editable line)
 *     the facts          ParagraphXSmall  20 + 2 ring             = 22
 *     ─────────────────────────────────────────────────────────────────
 *                                                                   72
 *
 * 72 IS THEREFORE THE FLOOR EVERY ROW IN THIS LIST DECLARES — a line, the add-a-line row closed,
 * and the field it opens into — so pressing «Add a line», typing into it and finishing it moves
 * NOTHING (§77.2: «the WORST is when we have lines changing height and the whole content
 * jaggeding»). It is a FLOOR and never a cap: a name that wraps grows its own row, which is the
 * designed wrap, and the field's own sentence wraps with it.
 *
 * IT IS ALSO ≥ `LINE_ROW` BY CONSTRUCTION, so the family's touch floor is kept and not replaced.
 * Declaring the real number is what makes the morph measurable — both bands carry `data-rowband`,
 * so a drive reads two `getBoundingClientRect().height` values and they are one number.
 *
 * The defect this replaces, recorded: the say-moment stood ~40px taller than the row it became,
 * because the organ's reserved suggestion shelf was inside the field's own column. The shelf is
 * still reserved and still one row — it hangs BELOW the band now (chip-entry's `row` prop), in the
 * row's margin where a line keeps its notes, so it cannot lift the row it belongs to.
 */
const LINE_BAND = Math.max(LINE_ROW, 76);

/* ── THE ROW'S TAIL — WHERE DELETION LIVES, RESERVED (FEED-IA §109.7) ─────────────────────────
 * «Hover a row → the trash icon appears on its RIGHT.» And §51.14's law holds absolutely: hover
 * may never move geometry. So the seat is part of every row in the lines list — the lines, the
 * add-a-line row closed, and the field it opens into — and only its INK arrives under a pointer.
 * Reserving it on every row is what keeps the money column flush across all of them: they share one
 * right edge, which is the whole of §84.4's side-by-side test.
 */
const ROW_TAIL = 44;
const ROW_ACTION_TAIL = ROW_TAIL * 2 + 4;

/* ── AND THE TAIL HOLDS TWO SEATS NOW (FEED-IA §131.2) ────────────────────────────────────────
 * «"How it's packed" — that would be a note shown as an INDENT below something, and maybe that's a
 * little button you can put ABOVE THE TRASH ICON or something.» His own word is ABOVE, so the tail
 * is a COLUMN of two 20px seats — the packing-note door over the trash — and the lane keeps the
 * exact width it already had. That is the point: the money columns are flush to this edge, so a
 * tail that grew sideways would move the price column §84.4 measures across three surfaces.
 */

/* ── THE COMMERCIAL LINE HAS TWO COLUMNS, AT EVERY WIDTH ────────────────────────────────────
 * Identity owns the product name, its unit price, its derived line total and its metadata. The
 * terminal owns only quantity + unit. This is the same commerce-row hierarchy on desktop and on
 * phone: the name is never squeezed by a miniature four-column table, while the amount still forms
 * one quiet, right-aligned column down the document. Exceptionally long names or figures take a
 * deliberate second row; they never force either value into a one-character column. */
const LINE_IDENTITY_MIN = 160;
const LINE_TERMINAL_MIN = 88;

/* ── A LAYER MUST CLEAR THE CHROME (FEED-IA §54.1) ────────────────────────────────────────────
 * «There are some labels that appear behind the actual thing.»
 *
 * Base mounts every popover, menu and TOOLTIP in a layer at the end of the body with no z-index of
 * its own, so it paints in tree order — under every positioned thing this app raises above it: the
 * band (4), the header block (12), this sheet's own sticky dock (2) and its head (3). The menus in
 * this file already carried the step; the hover LABELS carried none, which is precisely the defect
 * the founder read: the label was drawn, and the thing it labelled was drawn on top of it.
 *
 * Twelve is the app's one step for a layer that must clear everything, and it is spelled ONCE here
 * so a new control cannot quietly ship without it.
 */
export const LAYER = 12;

/** the override every hover label on this surface carries, so none of them can paint underneath */
const OVER_THE_CHROME = { Body: { style: { zIndex: LAYER } } } as const;

/* ══ THE REVIEW KEYBOARD'S TWO SEAMS (checkpoint §14.2 — «Excel speed + Linear-style triage») ══
 *
 * The review keyboard lives on the RIVER (`areas/sales.tsx` owns the one listener, FEED-IA §32.A)
 * and the thing it drives lives HERE (the sheet, its lines, its fields). Two module stores join
 * them, both written the way `day.ts` and `tiers.ts` write theirs — a value, a set of listeners
 * and `useSyncExternalStore` — so neither surface has to reach into the other's tree.
 *
 *   1 · THE ARRIVAL. Enter on the pile opens the focused document's first line and lands the caret
 *       on the first thing that can be written. `enterDocument(id)` is that press; the sheet's
 *       first line reads it and opens itself.
 *   2 · THE UNDO. Every act the keyboard takes hands back the way to reverse it, with the sentence
 *       that names it — §76's grammar: «immediate feedback after saving, ideally with Undo». One
 *       slot, not a stack: Undo takes back the LAST thing, which is the only thing a person means
 *       by it at flip speed, and the toast that offers it stands for three seconds.
 */

type EnterSignal = { sale: string; n: number };
let ENTERED: EnterSignal = { sale: '', n: 0 };
const enterListeners = new Set<() => void>();

/** Put the keyboard inside this document's first line (checkpoint §14.2b). */
export function enterDocument(sale: string): void {
  ENTERED = { sale, n: ENTERED.n + 1 };
  enterListeners.forEach((fn) => fn());
}

/** ── AND THE PRESS IS SPENT ONCE IT HAS LANDED ────────────────────────────────────────────────
 *  Found by the keyboard drive, and it was a real one: the signal was a VALUE rather than an
 *  EVENT, so it went on standing after the caret had arrived. Walking away down the river and
 *  coming back re-mounted the document, the line read the old press as a new one, and the editor
 *  opened again under a person who had not asked for it — on every pass, forever. The field that
 *  takes the caret is what spends the press, so the press exists exactly as long as it takes to be
 *  obeyed. */
function clearEnter(): void {
  if (ENTERED.sale === '') return;
  ENTERED = { sale: '', n: ENTERED.n };
  enterListeners.forEach((fn) => fn());
}

function useEnterSignal(sale: string): number {
  const held = React.useSyncExternalStore(
    (fn) => { enterListeners.add(fn); return () => { enterListeners.delete(fn); }; },
    () => ENTERED,
  );
  return held.sale === sale ? held.n : 0;
}

/** ONE ACT, AND THE WAY BACK OUT OF IT. `says` is what the toast reads — the act named, never a
 *  sentence about it (§51.24) — and `take` is the reversal itself. */
export type ReviewAct = { says: string; take: () => void };

let LAST_ACT: ReviewAct | null = null;
const actListeners = new Set<() => void>();

/** Record something a person just did to a document under review, with its Undo. */
export function pushReviewAct(act: ReviewAct): void {
  LAST_ACT = act;
  actListeners.forEach((fn) => fn());
}

/** THE REVERSAL (checkpoint §14.2f: «Undo»). It clears the slot on the way, so one press takes
 *  back one act and a second press takes back nothing — an Undo that could fire twice on one act
 *  is an Undo a person cannot count on. */
export function undoReviewAct(): ReviewAct | null {
  const act = LAST_ACT;
  if (!act) return null;
  LAST_ACT = null;
  actListeners.forEach((fn) => fn());
  act.take();
  return act;
}

export const useReviewAct = (): ReviewAct | null =>
  React.useSyncExternalStore(
    (fn) => { actListeners.add(fn); return () => { actListeners.delete(fn); }; },
    () => LAST_ACT,
  );

/** THE ACT'S OWN EVENTS, TAKEN BACK OUT — and nothing else touched. `tiers.ts`'s Undo settled the
 *  reasoning for removing rather than writing a second entry on top: «a person who presses Undo is
 *  saying it never happened — the slip was caught in the seconds the toast stands». This is that,
 *  on the day's ledger.
 *
 *  IT REMOVES BY IDENTITY, NOT BY POSITION. A first version snapshotted the whole edits object and
 *  restored it, refusing whenever anything had landed since — and the review flow lands something
 *  constantly, because OPENING a document writes that somebody looked at it (§66.1). So walking
 *  three rows after a handoff made Undo a no-op that still announced success. The act's events are
 *  held by reference and filtered out wherever they now sit, so everything that happened afterwards
 *  survives and only the act itself is undone.
 *
 *  THE THREE ID LISTS GO BACK THE SAME WAY: only the ids THIS act added come off, so an undo can
 *  never drop something a later act put on.
 *
 *  AND IT SAYS WHETHER ANYTHING HAPPENED. Some acts stop to ask first — the lot guard, the «are you
 *  sure» — and a toast announcing a confirmation that is still standing in a dialog is the surface
 *  claiming an act it did not take. An unmoved ledger means nothing landed, and the caller stays
 *  quiet. */
export function reversible(says: string, act: () => void): boolean {
  const before = dayNow();
  const was = before.events.length;
  act();
  const landed = dayNow();
  if (landed.events.length === was) return false;
  const mine = new Set(landed.events.slice(was));
  const added = (key: 'confirmed' | 'surfaced' | 'released'): string[] =>
    landed[key].filter((id) => !before[key].includes(id));
  const put = { confirmed: added('confirmed'), surfaced: added('surfaced'), released: added('released') };
  pushReviewAct({
    says,
    take: () => setDay((prev) => ({
      events: prev.events.filter((e) => !mine.has(e)),
      confirmed: prev.confirmed.filter((id) => !put.confirmed.includes(id)),
      surfaced: prev.surfaced.filter((id) => !put.surfaced.includes(id)),
      released: prev.released.filter((id) => !put.released.includes(id)),
    })),
  });
  return true;
}

/* ── THE SIDE PANEL'S OWN THRESHOLD ───────────────────────────────────────────────────────────
 * It is NOT the continuum's rung (FEED-IA §103, `shell/viewport.ts`) and it must not be confused
 * with one: this asks «is there a desk left to stand a side panel BESIDE», which is a question
 * about one component's neighbours. The continuum asks which app is being drawn. Two questions,
 * two numbers, both stated where they are answered. */
export const NARROW = '(max-width: 900px)';

export function useNarrow(): boolean {
  const [narrow, setNarrow] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW).matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

/* ── LINEWORK (FEED-IA §30, §31.2) ────────────────────────────────────────────────────────────
 * The marks used to be drawn here, and the app grew a second set in the navigation and a third in
 * Settings — three vocabularies for one language, and the clipping his shot caught (§31.2). They
 * now live in ONE module, on one grid, with breathing room in the viewBox: `src/prototypes/cedar/glyphs.tsx`.
 *
 * This panel keeps the re-export because it is where the rest of the app already reaches for a
 * mark. Reaching for `./glyphs` directly is the better import and both arrive at the same drawing.
 *
 * THE PENCIL IS GONE (§31.3). «People should be able to edit without clicking an edit button.» A
 * pencil is an edit button drawn small, so there is no `pencil` in the vocabulary any more and
 * nothing can put one back.
 */
export { Glyph } from './glyphs';
export type { GlyphId } from './glyphs';

/* ── THE FACE OF THE GOODS — LIFTED, AND THE DUPLICATE WALK IS DEAD (FEED-IA §33.2) ──────────
 * This file used to own the produce walk and say, in its own comment, that Stock wrote the same
 * walk a second time because the two belonged to different packages. One package owns both now, so
 * the walk, the seat, the painting and the family mark live in `product-face.tsx` and every surface
 * — the document, the river, Stock's cards, the tarifas, the chat embeds — reads the one of them.
 * The names are re-exported because the whole app already imports them from here, and a rename
 * would have been churn rather than work.
 */
export {
  Face,
  familyMarkOf,
  Produce,
  ProduceTile,
  ProductFace,
  produceMarkOf,
} from './product-face';
import { Face, familyMarkOf, Produce, ProductFace } from './product-face';
/* ── THE CHIP ORGAN (FEED-IA §62) ─────────────────────────────────────────────────────────────
 * ONE shared organ across every product-entry surface, designed once and reused (§62.4). This file
 * CONSUMES it and never parses on its own account: the reading comes back as a `ChipLine` and what
 * a sale does with it is decided here, which is the whole of the contract in `chip-entry.tsx`. */
import ChipEntry from './chip-entry';
import type { ChipLine, ChipRegisters } from './chip-parse';

/* ── THE MARK (THE-APP-V2 §5.5) ───────────────────────────────────────────────────────────────
 * The AI's act, at its smallest. «The fishy order label is just a subtle thing — maybe the text is
 * coloured, or shows an icon to make sure they double-check it.» So the flag is INK WORDS with one
 * saffron ring beside them: the standing colour law holds (colour is never a status system), the
 * accent still marks only Rocoto's own act, and nothing on the card shouts.
 */
export function FlagMark({ label }: { label?: string }) {
  /* ONE DEVICE PER MEANING (DENSE-BRIEF §1): the AI's act is the filled ActDot everywhere —
     the accent RING belongs to the complaint alone. This used to draw a ring of its own. */
  return <ActDot label={label} />;
}

/** A flag, as it reads: the mark, then ink. One component, so the card and the line say it the
 *  same way and cannot drift apart — and so does the READING, which is the same shape of fact
 *  (Rocoto acted, here is what it did) and must not grow a second look of its own. */
export function FlagLine({
  text,
  mark = 'Rocoto flagged it',
  testid = 'flag',
}: {
  text: string;
  /** what the saffron ring is announcing, for a screen reader */
  mark?: string;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <span
      data-testid={testid}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale200,
        ...theme.typography.ParagraphXSmall,
        color: theme.colors.contentSecondary,
        minWidth: 0,
      }}
    >
      <FlagMark label={mark} />
      {text}
    </span>
  );
}

/* ── THE PROVENANCE NOTE (THE-INTELLIGENCE §1) ────────────────────────────────────────────────
 * «A line the model FILLED differently from the customer's literal words renders as the filled
 * thing — normal, confident, first-class — with an INDENTED provenance note below it: quiet,
 * smaller, saffron-marked. A line that is exactly what was asked carries no note. Silence is the
 * default; provenance appears only where the model pulled weight.»
 *
 * So this is one indent and one FlagLine, and it draws NOTHING when handed nothing — which is what
 * makes the law mechanical rather than a promise about how carefully somebody seeds a screen.
 */
export function Provenance({
  text,
  mark,
  testid,
  children,
}: {
  text: string | null;
  mark: string;
  testid: string;
  /** the one act the note offers, where it offers one */
  children?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  if (!text) return null;
  return (
    <div
      data-testid={testid}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        flexWrap: 'wrap',
        paddingLeft: theme.sizing.scale600,
        minWidth: 0,
      }}
    >
      <FlagLine text={text} mark={mark} testid={`${testid}-text`} />
      {children}
    </div>
  );
}

/* ── THE LINE'S NAME (THE-INTELLIGENCE §2) ────────────────────────────────────────────────────
 * «An amendment renders as a small chip riding the line's name: Chicken wings · frozen — the
 * amendment bold-chipped in ink, in the trade's own word, exactly as said.» It is part of the
 * NAME and not a column, so every surface that says what a line is says it through here: the
 * detail's own row and the albarán that prints. A chip that existed on screen and vanished on
 * paper would be an amendment nobody could hold the house to.
 *
 * A CORRECTED LINE READS AS THE CUSTOMER SAID IT (§1). They put their word back, so their word is
 * the name — and it carries no provisional underline, because it is not a catalogue row yet.
 */
export function LineName({
  line,
  paper = false,
  prep,
  customerOption,
}: {
  line: SaleLine;
  paper?: boolean;
  /* ── THE PREP NOTE, ON THE PAPER (THE-DENSE-BRIEF-DESIGN §6) ─────────────────────────────
   * «The prep note prints on the individual albarán AND the day's sheet, in the same position —
   * small indented line under the item name.» The paper is where the note's real reader is, so it
   * travels through the same component the screen's name goes through and cannot be on one and
   * missing from the other.
   *
   * ON SCREEN THE NOTE IS DRAWN BY THE LINE, NOT HERE, and deliberately: the screen's name is
   * wrapped in the Editable that opens the WORD, and a note inside that button would make the
   * note part of the name's tap target. The note has its own target, one row down. */
  prep?: string;
  /** Explicitly approved outward-facing wording; never inferred from a team note. */
  customerOption?: string;
}) {
  const [, theme] = useStyletron();
  /* ── A LINE IS A BASE AND THE WORD RIDING IT (THE-OBJECT-MAP C5 · FEED-IA §75.6) ──────────
   * Stock draws a family head and its members, each member saying only what it ADDS. A line is
   * that object from the other side, so it draws the same two parts — and it asks `memberOf` for
   * them rather than reading `line.amendment`, because a word can reach a line two ways: the
   * customer's own qualifier this morning, or a word that has already GRADUATED into a product.
   * Before this, the second one printed as one long compound while Stock two screens away drew it
   * as a family and a member: the same goods in two grammars. One fold, one drawing, both. */
  const member = memberOf(line);
  const name = line.corrected && line.asked
    ? <>{line.asked}</>
    : member.word && !line.amendment
      /* a graduated member: the BASE is the name, and the word rides it below like any other */
      ? <>{member.base}</>
      : <Name of={line.product} />;
  /* ── THE DIMENSIONS TRAVEL WITH THE GOODS (FEED-IA §41.1) ────────────────────────────────
   * This component's own law, one paragraph up: «a chip that existed on screen and vanished on
   * paper would be an amendment nobody could hold the house to». A dimension is exactly that kind
   * of fact — «congelado» is what the customer is receiving — so it prints beside the name on the
   * paper the crate travels with, in the same lockup the amendment already uses.
   *
   * ON SCREEN IT DRAWS ELSEWHERE, deliberately: the resting row carries it in the sub-line beside
   * the lote, where it is a tap from its own register (§31.3). Paper has no sub-line, so on paper
   * it rides the name. One fact, two honest positions, never printed twice.
   *
   * ⚠ AND NOTHING ELSE COMES WITH IT (FEED-IA §197.2 «Remove class everywhere»). §41.2's class —
   * the fact the house's own papers appended and the customer's albarán never carried — is gone
   * from all three: the day sheet, the packing list and the albarán state the goods. */
  const dims = paper ? dimensionWords(line).map((d) => d.word) : [];
  const note = paper && prep ? (
    <span
      data-testid={`paper-prep-${line.id}`}
      style={{
        display: 'block',
        paddingLeft: theme.sizing.scale300,
        paddingTop: theme.sizing.scale100,
        ...theme.typography.ParagraphXSmall,
        color: theme.colors.contentPrimary,
        fontWeight: 400,
      }}
    >
      {prep}
    </span>
  ) : null;
  const option = paper && customerOption ? (
    <span
      data-testid={`paper-customer-option-${line.id}`}
      style={{
        display: 'block',
        paddingLeft: theme.sizing.scale300,
        paddingTop: theme.sizing.scale100,
        ...theme.typography.ParagraphXSmall,
        color: theme.colors.contentPrimary,
        fontWeight: 400,
      }}
    >
      Option: {customerOption}
    </span>
  ) : null;
  /** the dimensions, in the amendment's own paper lockup, so one line reads as one sentence */
  const marks = dims.length > 0 ? (
    <span data-testid={`paper-dimensions-${line.id}`} style={{ fontWeight: 700 }}>
      {dims.map((w) => ` · ${w}`).join('')}
    </span>
  ) : null;

  if (!member.word) {
    return marks || note || option ? <>{name}{marks}{note}{option}</> : name;
  }
  return (
    <>
      {name}
      {/* THE JOIN THE CATALOGUE WROTE, NEVER ONE THIS FILE PICKS (C7). «Merluza · sin cabeza» and
          «Merluza de pincho» are two names the register minted differently, and the paper prints
          the goods by the house's own name for them — so the raya comes off the fold. */}
      {paper ? member.join : null}
      <span
        data-testid={`amendment-${line.id}`}
        style={
          paper
            ? { fontWeight: 700 }
            : {
                display: 'inline-block',
                marginLeft: theme.sizing.scale200,
                padding: `0 ${theme.sizing.scale200}`,
                borderRadius: theme.borders.radius100,
                background: theme.colors.backgroundTertiary,
                color: theme.colors.contentPrimary,
                fontWeight: 700,
                /* ── THE LONG SORT IS THE TEST (FEED-IA §109.3) ─────────────────────────────
                   «Long names, long sorts: the wrap is designed.» This lockup used to be
                   `nowrap`, which is right for a two-word grade and wrong for what actually
                   rides a line: `ridesOf` joins the sort, the packaging and every word the
                   parser left to them — «sin cabeza congelada caja 6 kg» — and at 390 that
                   painted straight out of the name's column. It WRAPS instead, at its own
                   spaces, breaking a single monstrous word rather than overflowing. Nothing
                   else moves when it does: the price keeps its column and the lot
                   keeps the end of the facts line, which is what «without moving the
                   constants» means. */
                maxWidth: '100%',
                whiteSpace: 'normal',
                overflowWrap: 'break-word',
              }
        }
      >
        {member.word}
      </span>
      {marks}
      {note}
      {option}
    </>
  );
}

/* ── THE PANEL'S CHROME (FEED-IA §7.1, and §22.5 which put the flip back in it) ────────────────
 * «Why is Send and 1 of 16 below it? Why is a group thinking at all WITHIN the single thing?»
 *
 * Because the flip had been moved onto the dock, where it did not belong. ‹ 3 of 16 › is about THE
 * LIST — it is the reader's place in a morning's worth of documents — and the dock under the card
 * holds only acts upon THIS document. A document that counts its siblings has stopped being one.
 *
 * So the flip comes back up here, and the bar it comes back to is drawn deliberately as THE FRAME
 * AROUND THE THING rather than as part of it: it sits on the panel's own grey ground, it is
 * separated by a hairline, it carries no elevation, and everything in it is at the smallest step.
 * The document below is white, raised and full-sized. Frame and thing, two registers, never one.
 *
 * The chevrons walk THE LIST THE PERSON IS LOOKING AT — the feed's own order in the feed, the day's
 * own order in the day — so flipping is reading on, never a jump into some ordering the panel
 * invented. It is one line, the same line on a desk and on a phone, and it never scrolls away.
 */
/* ── THE TWO POSTURES (FEED-IA §23, and Peter's correction of 2026-08-24) ─────────────────────
 * «Rocoto will be used by the SAME PEOPLE.» So the posture follows THE TASK AT HAND, never a role
 * and never a place: one human answers a customer at 06:40 and packs the crate at 07:20, and the
 * document is the same document in both. The posture is therefore ONE FLIP, on the panel itself —
 * from packing, Send and the chat door are a press away rather than walled off; from answering, so
 * are the ticks.
 *
 *   ANSWER   the document that answers. Send, the chat door, the corrections, the annotation.
 *   PACK     the same card as a picking list. The packed/printed facets lead, the quantities are
 *            large enough to read at arm's length, every line takes a tick, and the amount editor
 *            is one tap from the row — packing is when weights are entered.
 *
 * It opens in the posture of the surface it was opened from (the feed answers, a day packs) and
 * then obeys the person. Same entity, same wrap, two postures.
 *
 * ═══ PARKED, 2026-08-24 ════════════════════════════════════════════════════════════════════
 * The workflow moved under this while it was being built: THE PEOPLE WHO PACK WORK FROM PAPER —
 * a comercial prints the prep sheet and hands it to the bay, and the owner revises on screen. An
 * on-screen packing posture may therefore be answering a question nobody asks, and Peter is
 * deciding the model. So the posture machinery stands here COMPILING AND UNMOUNTED: `SaleDetail`
 * pins `register` to 'answer' at its only call site, `PanelHead`'s posture seats draw only when a
 * caller hands it both props, and no caller does. Nothing is deleted, because none of it is known
 * to be wrong yet — it is waiting on his call. What DID ship out of §23 is `PrintFlush` below,
 * which survives every outcome.
 */
export type Register = 'answer' | 'pack';

const POSTURES: Array<{ id: Register; label: string; glyph: GlyphId }> = [
  { id: 'answer', label: 'Answer', glyph: 'doc' },
  { id: 'pack', label: 'Pack', glyph: 'check' },
];

export function PanelHead({
  title,
  position,
  count,
  posture,
  onPosture,
  onPrev,
  onNext,
  onClose,
  closeLabel = 'Close',
}: {
  /** a panel that IS a place — the paper, say — names itself here; a panel that frames a document
   *  says nothing, because the document says it */
  title?: React.ReactNode;
  /** 1-based place in the current list */
  position?: number;
  count?: number;
  /** the posture the document is being read in, where the panel offers both */
  posture?: Register;
  onPosture?: (next: Register) => void;
  onPrev?: () => void;
  onNext?: () => void;
  /* ── NO X ON THE ALWAYS-THERE PANEL (FEED-IA §37.9) ──────────────────────────────────────
   * «No X on the always-there albarán — the panel is always there; closing is walking.»
   *
   * On the desk the sheet pane is never empty: close one albarán and the next one is standing in
   * it, so the ✕ was a control whose whole promise — «this goes away» — the surface could not
   * keep. Walking IS the close: the flip, a row in the river, a card in the band.
   *
   * So the way out is OPTIONAL, and a panel that has one is a panel you can actually leave: the
   * PHONE, where the albarán took the screen and back is a real destination, and THE PAPER, which
   * is a place you opened over the work and close again. A panel that hands no `onClose` draws no
   * chrome for one. */
  onClose?: () => void;
  closeLabel?: string;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const flips = position !== undefined && count !== undefined && count > 1;
  /* THE HOVER LABEL IS A DESK THING (§32). A phone has no pointer to hover with, and a keycap on a
     screen with no keyboard is a promise nothing can keep — so the chevrons wear their words on
     the desk and their aria everywhere. */
  const tipped = (node: React.ReactNode, content: React.ReactNode) =>
    phone ? (
      node
    ) : (
      <StatefulTooltip content={content} placement={TOOLTIP_PLACEMENT.top} showArrow overrides={OVER_THE_CHROME}>
        {node}
      </StatefulTooltip>
    );
  return (
    <div
      data-testid="panel-head"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        padding: `${theme.sizing.scale200} ${theme.sizing.scale400}`,
        /* a mono step, not `borderOpaque` — the frame stands on the panel's own grey and Base's
           hairline colour IS that grey, so the edge that separates frame from thing would have
           been drawn in the colour of the thing it separates */
        borderBottom: `1px solid ${theme.colors.mono400}`,
        background: theme.colors.backgroundSecondary,
        minWidth: 0,
      }}
    >
      {flips && (
        <span
          data-testid="panel-flip"
          style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale100, flex: '0 0 auto' }}
        >
          {/* THE FLIP IS THE WALK, AND THE WALK HAS KEYS (§32.A). The chevrons and ← → are one
              act on one list, so the label says both: the sentence, then the key that does it. */}
          {tipped(
            <Button kind={KIND.tertiary} size={SIZE.compact} overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', fontSize: '28px' } } }} data-testid="flip-prev" aria-label="Previous delivery note" onClick={onPrev}>
              <span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Glyph id="caret" size={20} /></span>
            </Button>,
            <Shortcut label="Previous delivery note" keys={['←']} />,
          )}
          {tipped(
            <Button kind={KIND.tertiary} size={SIZE.compact} overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', fontSize: '28px' } } }} data-testid="flip-next" aria-label="Next delivery note" onClick={onNext}>
              <span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Glyph id="caret" size={20} /></span>
            </Button>,
            <Shortcut label="Next delivery note" keys={['→']} />,
          )}
        </span>
      )}
      {/* THE POSTURE, ONE FLIP AWAY (§23). It stands in the panel's CHROME rather than on the dock,
          because the dock holds only acts upon the document (§22.5) and this is not one: it is how
          the reader is looking at it, which is the same class of thing as where they are in the
          list and the way out. */}
      {posture && onPosture && (
        <span data-testid="posture-switch" data-posture={posture} style={{ flex: '0 0 auto', minWidth: 0 }}>
          <ButtonGroup
            mode={MODE.radio}
            size={SIZE.mini}
            kind={KIND.secondary}
            selected={POSTURES.findIndex((p) => p.id === posture)}
            onClick={(_e, i) => onPosture(POSTURES[i].id)}
            aria-label="How this delivery note is being read"
          >
            {POSTURES.map((p) => (
              <Button key={p.id} data-testid={`posture-${p.id}`} startEnhancer={<Glyph id={p.glyph} size={STEP.small} />}>
                {p.label}
              </Button>
            ))}
          </ButtonGroup>
        </span>
      )}
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentSecondary,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: flips ? 'right' : 'left',
        }}
      >
        {title ?? ''}
      </span>
      {onClose && (
        <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.circle} data-testid="close-detail" aria-label={closeLabel} onClick={onClose}>
          ✕
        </Button>
      )}
    </div>
  );
}

/* ── THE DOOR ─────────────────────────────────────────────────────────────────────────────────
 * One quiet control on the dock. A door is not a verb: it OPENS something (the paper, the
 * customer's record) or records a plain event, and it says so in three words. The list of six
 * lookalike action rows with a consequence sentence each is gone — six sentences of the same shape
 * beside one another are six things a person has to read to find the one they wanted, and the loud
 * verb above already carries the only consequence on this panel that matters.
 */

function Door({
  glyph,
  label,
  count,
  testid,
  onClick,
}: {
  glyph: GlyphId;
  label: string;
  /** the one number the door carries, where it has one: 3 messages, 2 copies */
  count?: React.ReactNode;
  testid: string;
  onClick: () => void;
}) {
  return (
    <Button
      kind={KIND.tertiary}
      size={SIZE.compact}
      data-testid={testid}
      data-action={testid}
      startEnhancer={<Glyph id={glyph} size={16} />}
      onClick={onClick}
    >
      {label}
      {count !== undefined && <span style={{ opacity: 0.62 }}>&nbsp;· {count}</span>}
    </Button>
  );
}

/* ═══ THE COUNTERS SAY THEMSELVES OUT LOUD (the a11y register's own find, §H11) ══════════════
 * ACCESSIBILITY.md, written off this code: «zero aria-live in src/prototypes/cedar — the counted press changes
 * silently for a screen reader.» It is one defect with one shape. A person presses «⎙ 12 new»;
 * the number becomes «All printed», the control stands down, and focus leaves a disabled button
 * for the body. A sighted person watched the pile empty — which is the whole of §61.2, the win
 * FELT rather than said — and a person on a screen reader got nothing at all. The feeling this
 * design is built on was reaching exactly one of them.
 *
 * ═══ WHY IT IS THIS ORGAN AND NOT AN ATTRIBUTE SPRAYED ON EVERY NUMBER ══════════════════════
 * A live region announces CHANGE, so a region that speaks whenever it mounts turns a scroll into
 * a monologue. This one is EMPTY on its first paint and fills only when its sentence has actually
 * changed since — so a number that arrives on screen is silent, a number a person's own act moved
 * says itself once, and there is nothing to announce on a walk to another document.
 *
 *   `about`  WHOSE NUMBER IT IS. When the subject changes underneath the region — a different
 *            albarán in the pane — the sentence is not a change, it is a different fact about a
 *            different thing, so the region goes quiet and starts again. Without it, flipping
 *            through a morning would read every document's state row aloud on arrival.
 *
 * IT IS VISUALLY HIDDEN AND NOT `display: none`, because a hidden region is a region no reader is
 * given. The clip rectangle is the standard one: in the layout, off the paint.
 *
 * WHERE IT IS USED, AND THAT LIST IS THE DESIGN (one region per counter that a hand moves):
 *   1 · the day's counted press          `areas/sales.tsx` — «Print 12 new» → «All printed»
 *   2 · the Messages count               `areas/sales.tsx` — «Messages · 3» → «Messages · 2»
 *   3 · the document's state row         this file — canon §15.1's live reading and its cells
 * And where it is deliberately NOT: the export centre's badge, which restates the same acts one
 * bar up (one act must announce once); the day aggregates and the totals, which are readings
 * rather than work; the drafts count and the typeahead's hits, which change under the person's
 * own typing and are already on the screen they are looking at.
 */
export function Aloud({ said, about, testid }: { said: string; about?: string; testid?: string }) {
  const [aloud, setAloud] = React.useState('');
  const was = React.useRef({ about, said });
  React.useEffect(() => {
    /* A DIFFERENT SUBJECT IS NOT A CHANGE. Take the new sentence as the resting one and say
       nothing — the surface under the reader changed, and it will be read as a surface. */
    if (was.current.about !== about) { was.current = { about, said }; setAloud(''); return; }
    if (was.current.said === said) return;
    was.current = { about, said };
    setAloud(said);
  }, [said, about]);
  return (
    <span
      data-testid={testid}
      aria-live="polite"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        margin: -1,
        padding: 0,
        border: 0,
        overflow: 'hidden',
        clip: 'rect(0 0 0 0)',
        clipPath: 'inset(50%)',
        whiteSpace: 'nowrap',
      }}
    >
      {aloud}
    </span>
  );
}

/* ── THE PRINT CONTROL IS DUAL-FLUSH (Peter, 2026-08-24) ──────────────────────────────────────
 * «A toilet's full flush with the small half-flush inset.» PRINTING NEVER ROUTES THROUGH A
 * PREVIEW: the big press puts the paper on the printer there and then (§20's queue), and the small
 * inset eye opens the sheet for the person who wants to look. One composed object, two targets, and
 * the sizes say which is the act — a print button that opened a preview instead was the act asking
 * permission to be the act.
 *
 * It is ONE component and it is exported, so every print in the app — the document's dock, the
 * bay's verb row, the day's sheet, a row's own mark — is the same object at a different size.
 * Icon-only where a row has no width for words; labelled where the dock has.
 */

/** THE SCOPE MENU THE BIG COLUMN CARRIES, where a print has a scope (§28, §29). One line per
 *  answer, each one already counted — «Print all 5 again» — so the person never does the sum. */
export type PrintMenu = {
  /** what the ▾ column announces to anybody who cannot see it */
  ariaLabel: string;
  items: Array<{ label: string; onSelect: () => void }>;
};

export function PrintFlush({
  label,
  ariaLabel,
  paperLabel = 'Look at the paper',
  glyph = 'print',
  kind = KIND.secondary,
  size = SIZE.compact,
  count,
  countSuffix,
  disabled = false,
  menu,
  note,
  tile = false,
  shortcut,
  testid,
  onPrint,
  onPaper,
}: {
  /** the words on the full flush; absent draws the mark alone */
  label?: string;
  /** what the mark alone announces, where there are no words */
  ariaLabel?: string;
  paperLabel?: string;
  /** ── THE MARK IS THE DESTINATION, NEVER THE ACT (§54.4, canon §15.3 rule 3) ────────────────
   *  «It is still absolutely unclear what is about packing and what is not. Really bad.» A day
   *  prints THREE different papers — the albaranes, the van's own sheet, the bay's packing lists
   *  — and all three controls wore this component's default ⎙, which is the mark of the ACT. So
   *  the mark says WHERE THE PAPER GOES and the caller names it: `van` for the run's sheet,
   *  `PACKING_MARK` for the bay, and the printer for the albaranes themselves, which are the one
   *  press whose destination really is the printer. */
  glyph?: GlyphId;
  kind?: (typeof KIND)[keyof typeof KIND];
  size?: (typeof SIZE)[keyof typeof SIZE];
  /** the pages the printer still owes for this document, where it owes any */
  count?: number;
  countSuffix?: string;
  /** nothing to print. The control stands down rather than offering an act with no object. */
  disabled?: boolean;
  /** THE SEAM §28 NAMED, CLOSED (§31.4). A day's print has a scope and a single albarán's has
   *  none, so the middle column exists only where a caller hands it one. */
  menu?: PrintMenu;
  /** WHAT THE TILE'S SECOND LINE SAYS WHEN THE ACT STANDS DOWN (§199). A tile always has two
   *  lines: the paper's NAME on top and the work under it. Where there is a count the second line
   *  is the mark and the number; where the control is standing down there is no act to mark, so
   *  the caller hands the STATE in these words and the mark stands down with the press. */
  note?: string;
  /** ── AND ON A PHONE THE PAIR STANDS AS TILES (FEED-IA §199, Peter) ────────────────────────
   *  «On mobile, the print buttons on each day look way too long now that I looked at that …
   *  They should be a double row, with the icon and the quantity left to print below, so that
   *  they're thick but next to each other rather than stacked and thin.»
   *
   *  So a caller that puts TWO of these on one phone row says `tile`, and the control changes
   *  posture rather than shape: the same three columns, the same seam, the same testids — the
   *  words on two lines, the two slim seats folded into a rail at the tile's right edge, one
   *  above the other so both keep the hand's own 44px, and the whole object 88px thick. It is
   *  the phone's answer only: a desk has the room the single row was drawn for, and `usePhone`
   *  is what decides, so no docked column can put phone furniture on a desk (§103). */
  tile?: boolean;
  /** THE KEYS THAT DO THIS PRESS (§32.A). Only where a key really reaches this control: the
   *  document's own dock takes P, and a day's paper takes none — a cap on a control no key can
   *  press is the software claiming a shortcut it does not have. */
  shortcut?: string[];
  testid: string;
  onPrint: () => void;
  /** ── A CONTROL WITH NO PAPER CARRIES NO EYE (OUT-02.3's own rule, on the day's seats) ──────
   *  Every caller until E200 printed a sheet, so the eye was this object's third column by
   *  definition. A day seat may now hold a `file` or an `email` template, and there is no paper
   *  to look at: the seat states its act and stops, rather than drawing a door onto the thing it
   *  has just done. The body takes the whole radius where no rail stands beside it. */
  onPaper?: () => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const filled = kind === KIND.primary;
  /* THE SEAM BETWEEN THE FLUSHES. On ink it is drawn in the inverse ink; on anything else it is a
     mono step, because Base's `borderOpaque` IS `backgroundSecondary` in the light theme and a
     hairline drawn in the colour of the fill beside it is a hairline nobody sees. */
  const seam = filled ? theme.colors.contentInverseTertiary : theme.colors.mono400;
  /** whether anything stands on the trailing side of the body — the scope menu, the eye, or both */
  const railed = Boolean(menu || onPaper);
  const square = railed ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : {};
  const joined = {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftColor: seam,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid' as const,
  };
  const middle = { ...joined, borderTopRightRadius: 0, borderBottomRightRadius: 0 };
  const mark = size === SIZE.large ? STEP.medium : STEP.small;

  /* ── THE TILE'S OWN GEOMETRY (§199) ────────────────────────────────────────────────────────
     Two seats, one above the other, each at the hand's own number — so the rail is 44 wide and
     the tile is 88 thick, and both numbers come from `TOUCH_FLOOR` rather than being typed.

     AND WHY THE MARK RIDES THE SECOND LINE, MEASURED. A day's own content is 296px at 360; two
     tiles a step apart are 144 each; the rail takes 44, the body's padding 16, so the words have
     84px. «Packing lists» is 71 at this step, so the name fits and «⎙ Packing lists» — 91 —
     does not. The mark therefore stands where the work is, beside the number it prints: «⎙ 34
     left», which is the act, under the paper's name, which is the label. Peter's own sentence
     asks for exactly that pair — «the icon and the quantity left to print below». */
  const tiled = tile && phone;
  const RAIL = TOUCH_FLOOR;
  const THICK = TOUCH_FLOOR * 2;
  const radius = theme.borders.buttonBorderRadius;
  const bodyTile = {
    flex: '1 1 auto',
    minWidth: 0,
    minHeight: `${THICK}px`,
    justifyContent: 'flex-start',
    textAlign: 'left' as const,
    paddingTop: theme.sizing.scale300,
    paddingBottom: theme.sizing.scale300,
    /* ── 6px, AND IT IS A MEASUREMENT (E200.06) ────────────────────────────────────────────
       At 8px the body's words had 84px at 360 and «Packing sheets» — the name the packing
       template ships under once the seats are TEMPLATES rather than fixed papers — measures 86.
       Two pixels, and the tile's own law breaks: «the name and the mark cannot share line one at
       360 without truncating the name» (OUT-03.3) exists so the NAME survives. 6px gives the words
       88 and keeps a real gutter against the rail's seam. Read off the built bundle at 360 and
       390, both shipped names, by `drive-200-day-seats.py`. */
    paddingLeft: theme.sizing.scale200,
    paddingRight: theme.sizing.scale200,
    borderTopLeftRadius: radius,
    borderBottomLeftRadius: radius,
    borderTopRightRadius: railed ? 0 : radius,
    borderBottomRightRadius: railed ? 0 : radius,
  };
  /** a seat on the rail: square, at the floor in both axes, its radii its own (§31.2) */
  const seatTile = {
    flex: '0 0 auto',
    width: `${RAIL}px`,
    minWidth: `${RAIL}px`,
    maxWidth: `${RAIL}px`,
    height: `${RAIL}px`,
    minHeight: `${RAIL}px`,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftColor: seam,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid' as const,
  };
  const scopeSeat = { ...seatTile, borderTopRightRadius: radius, borderBottomRightRadius: 0 };
  /** A MENU STANDING ALONE TAKES THE WHOLE RAIL, so a tile keeps one silhouette however many seats
   *  it has: 88px of rail, both trailing corners its own. */
  const soleScopeSeat = { ...scopeSeat, borderBottomRightRadius: radius, minHeight: `${THICK}px`, height: `${THICK}px` };
  const paperSeat = {
    ...seatTile,
    borderTopRightRadius: menu ? 0 : radius,
    borderBottomRightRadius: radius,
    ...(menu
      ? { borderTopColor: seam, borderTopWidth: '1px', borderTopStyle: 'solid' as const }
      : { minHeight: `${THICK}px`, height: `${THICK}px` }),
  };
  /** WHAT THE SECOND LINE SAYS: the number the press moves, or the state that stood the press
   *  down. The mark goes with the act, so a standing-down tile carries words alone.
   *
   *  ⚠ A DISABLED PRESS MAY NOT SHOW A NUMBER FOR THE ACT IT IS REFUSING. `count` is still handed
   *  in when the day holds paper for review — the desk wants it, because the desk's own LABEL
   *  already carries the state («Review to print · 32 left») and the number is the size of the
   *  review. A tile has no such label: its first line is the paper's name, so the same number
   *  under it reads «⎙ 32 left to print» beside a press that will not print. So the tile takes
   *  the NOTE whenever the press is standing down, and the desk is left exactly as it was.
   *  Found by the E196.4 verifier on a rendered build; `drive-196-day-tiles.py`'s `held` leg
   *  is the assertion that keeps it. */
  const counted = count !== undefined && count > 0;
  const tileCounted = counted && !disabled;
  const under = tileCounted ? `${count}${countSuffix ? ` ${countSuffix}` : ''}` : note;

  const printFace = tiled ? (
    <span data-tile-face style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: 0, maxWidth: '100%' }}>
      {/* TRUNCATE WITHOUT LOSING CONTENT (`better-typography`). The two names that ship stand whole
          at 360; a house that calls its paper «Cold store delivery sheets» keeps every character
          of it on the node's own title and in the sentence the seat announces. */}
      <span
        data-tile-name
        title={label}
        style={{ ...theme.typography.LabelXSmall, minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {label}
      </span>
      {under && (
        <span data-tile-count style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale100, minWidth: 0, maxWidth: '100%', opacity: 0.72 }}>
          {tileCounted && <Glyph id={glyph} size={mark} />}
          <span style={{ ...theme.typography.ParagraphXSmall, minWidth: 0 }}>{under}</span>
        </span>
      )}
    </span>
  ) : (
    <>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ opacity: 0.72 }}>{label ? <>&nbsp;· {count}</> : <>&nbsp;{count}</>}{countSuffix ? ` ${countSuffix}` : ''}</span>
      )}
    </>
  );

  const seats = (
    <>
      {menu && (
        <StatefulPopover
          placement={PLACEMENT.bottomLeft}
          triggerType={TRIGGER_TYPE.click}
          /* A LAYER MUST CLEAR THE CHROME (found while building §32). Base mounts a layer at the
             end of the body with no z-index, so it paints under anything positioned above it — and
             a day's re-print menu opens from a whisper that the sticky band sits on the moment the
             river is scrolled. 12 is the step this app gives a layer that must clear everything. */
          overrides={{ Body: { style: { zIndex: LAYER } } }}
          content={({ close }) => (
            <div data-testid={`${testid}-menu`}>
              <StatefulMenu
                /* Base's own list, at the width a compact attached menu reads at (§28: «a small
                   attached menu, not a dialog»). */
                overrides={{ List: { style: { minWidth: '200px' } } }}
                items={menu.items.map((i) => ({ label: i.label }))}
                onItemSelect={({ item }) => {
                  menu.items.find((i) => i.label === item.label)?.onSelect();
                  close();
                }}
              />
            </div>
          )}
        >
          <Button
            kind={kind}
            size={size}
            data-testid={`${testid}-scope`}
            aria-label={menu.ariaLabel}
            overrides={{ BaseButton: { style: tiled ? (onPaper ? scopeSeat : soleScopeSeat) : (onPaper ? middle : joined) } }}
          >
            <Glyph id="caret" size={mark} />
          </Button>
        </StatefulPopover>
      )}

      {onPaper && (
        <StatefulTooltip content={paperLabel} placement={TOOLTIP_PLACEMENT.top} showArrow overrides={OVER_THE_CHROME}>
          <Button
            kind={kind}
            size={size}
            data-testid={`${testid}-paper`}
            aria-label={paperLabel}
            onClick={onPaper}
            overrides={{ BaseButton: { style: tiled ? paperSeat : joined } }}
          >
            <Glyph id="eye" size={mark} />
          </Button>
        </StatefulTooltip>
      )}
    </>
  );

  return (
    <span
      data-testid={testid}
      data-tile={tiled ? 'yes' : undefined}
      style={{
        display: tiled ? 'flex' : 'inline-flex',
        alignItems: 'stretch',
        /* THE CORNERS ARE DRAWN, NOT CROPPED (§31.2). This used to square its inner corners with
           `overflow: hidden` on the wrapper, which is a container shaping its children by cutting
           them — the habit the icon audit is here to end. Every column states its own radii. */
        minWidth: 0,
        maxWidth: '100%',
        /* TWO TILES SHARE THE ROW AND MEASURE THE SAME (§199): a zero basis with an equal pull, so
           the pair never splits by whichever name is longer. */
        ...(tiled ? { flex: '1 1 0', minHeight: `${THICK}px` } : null),
      }}
    >
      {/* AND A TILE SAYS ITS OWN SENTENCE, SO NOTHING HOVERS OVER IT (§199). The tooltip exists
          because a mark alone cannot say which paper it prints (§30); a tile already carries the
          name and the number in type, and a label repeating itself over the thumb that just
          pressed it is furniture. The seats keep theirs — they are marks. */}
      {tiled ? (
        <Button
          kind={kind}
          size={size}
          disabled={disabled}
          data-testid={`${testid}-print`}
          data-queued={count && count > 0 ? count : undefined}
          /* A TILE WITH NO WORDS STILL HAS TO SAY WHICH PAPER IT PRINTS. `label` is optional, and
             the flush arm below has always fallen back to `ariaLabel` where a caller draws the
             mark alone; the tile arm did not, so a `tile` caller without words announced its
             count and nothing else — «32 left», of what. Both postures now answer the same. */
          aria-label={label ? undefined : ariaLabel}
          onClick={onPrint}
          overrides={{ BaseButton: { style: bodyTile } }}
        >
          {printFace}
        </Button>
      ) : (
        <StatefulTooltip
          /* THE LABEL SAYS THE KEY (§32). The sentence is the control's own; the cap after it is the
             fact that a hand sweeping a morning never has to reach for the mouse. */
          content={
            shortcut && !phone ? <Shortcut label={label ?? ariaLabel} keys={shortcut} /> : label ?? ariaLabel
          }
          placement={TOOLTIP_PLACEMENT.top}
          showArrow
          overrides={OVER_THE_CHROME}
        >
          <Button
            kind={kind}
            size={size}
            disabled={disabled}
            data-testid={`${testid}-print`}
            data-queued={count && count > 0 ? count : undefined}
            aria-label={label ? undefined : ariaLabel}
            startEnhancer={<Glyph id={glyph} size={mark} />}
            onClick={onPrint}
            overrides={{ BaseButton: { style: square } }}
          >
            {printFace}
          </Button>
        </StatefulTooltip>
      )}

      {/* THE RAIL (§199). On a phone the two slim seats stand one above the other at the tile's
          right edge, each keeping the hand's own 44px; on a desk they stay the row they were. */}
      {!railed ? null : tiled ? (
        <span data-tile-rail style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', alignItems: 'stretch' }}>{seats}</span>
      ) : (
        seats
      )}
    </span>
  );
}

/* ── AN ACT TRANSFORMS ITS OWN CONTROL (FEED-IA §59.1 — the jaggedy Send) ─────────────────────
 * «When I click Send, it puts a text below that says "Cancel the send", and then it puts a "Send it
 * now" button below that. Have you not thought about how jaggedy things like this are?»
 *
 * He is right, and the shape was the fault rather than the words. Pressing Send moved the sale to
 * `scheduled`, and the dock answered by GROWING: the primary re-labelled itself «Cancel the send»,
 * a sentence appeared under it explaining the cancel, and a second row opened below THAT holding
 * «Send it now». One press, three new pieces of surface, and the bar under a person's hand jumped.
 *
 * THE LAW: THE CONTROL BECOMES ITS NEXT STATE, IN PLACE. Send is one seat in the dock, and after
 * the press it is still one seat: the label swaps to the STATE and the hour it happens at (§59.2 —
 * the words that earn space are the state and the count, never a verb sentence), and both acts the
 * new state allows live INSIDE the same box, in the two-column grammar every other flush on this
 * surface already speaks (§28):
 *
 *   AT REST      [ Send ]                    the state's one verb, filled where the state owes it
 *   AFTER        [ ⏱ Sending 09:00 | ↺ ]     the state, the hour, and its two acts in one box
 *                 ^ press: it goes now        ^ press: it comes back to you
 *
 * Nothing is stacked, nothing explains itself, and the bar's height is identical on both sides of
 * the press (§37.3, generalized by §59.1 from hover to every state change). The mark on the cancel
 * column is the app's own `undo` — the same mark that puts a line back on an albarán — because
 * cancelling a queued send is exactly that act on a bigger object (§30: one icon, one meaning).
 */
export function SendFlush({
  at,
  kind = KIND.secondary,
  size = SIZE.compact,
  testid,
  onNow,
  onCancel,
}: {
  /** the hour it is queued for — the state's own fact, and the only words this control spends */
  at: string;
  kind?: (typeof KIND)[keyof typeof KIND];
  size?: (typeof SIZE)[keyof typeof SIZE];
  testid: string;
  onNow: () => void;
  onCancel: () => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const filled = kind === KIND.primary;
  const seam = filled ? theme.colors.contentInverseTertiary : theme.colors.mono400;
  const square = { borderTopRightRadius: 0, borderBottomRightRadius: 0 };
  const joined = {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftColor: seam,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid' as const,
  };
  const mark = size === SIZE.large ? STEP.medium : STEP.small;
  /* the acts ride the hover on a desk and the aria everywhere, because a control whose words are
     its STATE has to say its ACT somewhere (§30's bargain, §59.2's ban on verb sentences) */
  const tipped = (node: React.ReactNode, words: string) =>
    phone ? node : (
      <StatefulTooltip content={words} placement={TOOLTIP_PLACEMENT.top} showArrow overrides={OVER_THE_CHROME}>
        {node}
      </StatefulTooltip>
    );
  return (
    <span data-testid={testid} data-at={at} style={{ display: 'inline-flex', alignItems: 'stretch', minWidth: 0, maxWidth: '100%' }}>
      {tipped(
        <Button
          kind={kind}
          size={size}
          data-testid={`${testid}-now`}
          aria-label={`Send it now, instead of at ${at}`}
          startEnhancer={<Glyph id="clock" size={mark} />}
          onClick={onNow}
          overrides={{ BaseButton: { style: square } }}
        >
          Sending {at}
        </Button>,
        'Send it now',
      )}
      {tipped(
        <Button
          kind={kind}
          size={size}
          data-testid={`${testid}-cancel`}
          aria-label="Cancel the send"
          onClick={onCancel}
          overrides={{ BaseButton: { style: joined } }}
        >
          <Glyph id="undo" size={mark} />
        </Button>,
        'Cancel the send',
      )}
    </span>
  );
}

/* ── B15 · THE STATE ROW'S ONE CELL (FEED-IA §59.4, canon §6.1, §6.4) ─────────────────────────
 * A mark, a word, and whether the rail is OWED. It is drawn identically wherever it stands, so a
 * person learns one shape and reads it in six places — which is the whole point of a snapshot.
 *
 * THE DOOR IS THE CELL ITSELF where the cell has a rail behind it. Pressing it walks the pane to
 * the export block, where the same fact is a full sentence with its own act beside it — one tap
 * from the drunk register into the sober one (§61.3). A cell with no rail (the scale) is a FACT
 * and draws as a span: a door that leads nowhere is worse than no door.
 */
type StateCell = {
  id: 'paper' | 'system' | 'copy' | 'scale';
  mark?: GlyphId;
  text: string;
  /** the rail wants something — so it stands in ink rather than stepping back as record */
  owed: boolean;
};

function StateCellView({ cell, onOpen }: { cell: StateCell; onOpen?: () => void }) {
  const [, theme] = useStyletron();
  const inner = (
    <>
      {cell.mark ? <Glyph id={cell.mark} size={STEP.small} /> : <span aria-hidden="true">·</span>}
      {/* THE ONE PLACE AN ELLIPSIS IS THE RIGHT ANSWER: a single cell wider than the whole row,
          which is the degenerate case the state row's own wrapping cannot reach. `minWidth: 0` is
          what lets the browser draw the «…» at all — without it the span refuses to shrink and the
          text runs out of its box, which is the bare cut §129.5 forbids. */}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell.text}</span>
    </>
  );
  /* OWED VERSUS DONE IS INK WEIGHT, NEVER COLOUR (canon §6.1). */
  const skin: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.sizing.scale100,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: cell.owed ? theme.colors.contentPrimary : theme.colors.contentTertiary,
  };
  if (!onOpen) return <span data-cell={cell.id} data-owed={cell.owed ? 'yes' : 'no'} style={skin}>{inner}</span>;
  return (
    <button
      type="button"
      data-cell={cell.id}
      data-owed={cell.owed ? 'yes' : 'no'}
      data-testid={`state-cell-${cell.id}`}
      aria-label={`${cell.id} · ${cell.text}`}
      onClick={onOpen}
      style={{
        ...skin,
        padding: 0,
        border: 'none',
        background: 'transparent',
        font: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {inner}
    </button>
  );
}

/* ── THE TWO RULES: WHO IS SPEAKING, AND WHOSE JOB IT IS (FEED-IA §22.6) ──────────────────────
 * «Review vs urgent is still unclear. Colour is not used well.» It cannot be answered with colour —
 * ink does the work here and the accent marks only Rocoto's own act, so a red «urgent» is not
 * available and would be wrong if it were. It is answered STRUCTURALLY, with two marks that a
 * person learns once and then reads at a glance from across a desk:
 *
 *   A SAFFRON RULE   Rocoto is talking. What it read, what it filled, what it noticed.
 *   AN INK RULE      Something is waiting on YOU. Heavier step, primary ink, the sentence says
 *                    what is wanted. Nothing else on the annotation carries this weight.
 *
 * Two rules, two voices, one ink. The difference is legible with the colour taken away entirely,
 * which is the test that colour was never doing the work in the first place.
 *
 * THE SAFFRON RULE'S ONE READER WENT WITH §54.3. It drew «Read from WhatsApp as 4 lines for Friday
 * 22.08.» — a sentence narrating the software — and the arrival block says every fact in it as an
 * object instead, with Rocoto's own act marked by the `ActDot` the rest of the app already uses.
 * The voice did not die; it stopped needing a rule of its own to speak in.
 */
/** what is waiting on the person, and nothing else. */
export function Waiting({
  children,
  testid,
}: {
  children: React.ReactNode;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        borderLeft: `2px solid ${theme.colors.contentPrimary}`,
        paddingLeft: theme.sizing.scale400,
        ...theme.typography.LabelSmall,
        color: theme.colors.contentPrimary,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ── THE FIELD LABEL ─────────────────────────────────────────────────────────────────────────
 * One step, uppercase, tertiary — the editor's own quiet scaffolding, said the same way in every
 * block so the eye can skip it once it knows the shape.
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

/* ── THE MEASURE (FEED-IA §22.6) ──────────────────────────────────────────────────────────────
 * «Spacing isn't good.» It was not a scale, it was a habit: scale300 here, scale600 there, the gap
 * between two registers the same as the gap between a line and its own note. When every distance is
 * plausible and none is decided, the eye gets no grouping out of any of them.
 *
 * So the panel spends FOUR of Base's steps and each one means exactly one thing. A distance on this
 * surface is a statement about how related two things are, and there are only four such statements:
 *
 *   tight    8   a thing and its own note — the two belong to each other
 *   row     12   controls standing along one row
 *   block   20   blocks inside ONE register
 *   register 32  between the document, the dock and the annotation — the three registers of §14
 *
 * The document's interior stays DENSER than the annotation on purpose (§22.6): a document is read
 * as a body of lines, and marginalia is read as separate remarks.
 */
type Theme = ReturnType<typeof useStyletron>[1];

const measure = (theme: Theme) => ({
  tight: theme.sizing.scale300,
  row: theme.sizing.scale400,
  block: theme.sizing.scale600,
  register: theme.sizing.scale800,
});

/* ── THE SECTION RULE ────────────────────────────────────────────────────────────────────────
 * The annotation needs a beginning a person can see without reading it. A label alone did not do
 * that — it looked like the labels inside the document, one step away, and so the marginalia read
 * as more document. A label with a rule running off it does: it is the oldest mark in print for
 * «a new part starts here», it costs one hairline, and it works at arm's length.
 */
function SectionRule({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
      <FieldLabel>{children}</FieldLabel>
      {/* `borderOpaque` IS `backgroundSecondary` in Base's light theme — a rule drawn in it on the
          panel's own grey ground is a rule nobody can see (the kit's own gotcha, paid for again
          here). The annotation stands on grey, so its rule is a mono step darker than grey. */}
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: theme.colors.mono400 }} />
    </div>
  );
}

/* ── THE CONVERSATION'S OWN RING (FEED-IA §17.3) ─────────────────────────────────────────────
 * «The embedded chat gets a FAINT RED LINE around it, on top of its dotted paper — the accent at
 * low strength.» Mixed the way the theme mixes its own dot ink: ONE accent, thinned into a
 * neutral, never a second hue. So it re-themes with the brand (`?theme=proof` moves it), it stays
 * a whisper rather than a status colour, and together with the dots it is what makes a patch of
 * this app say «this is the talk» from across the room (§11).
 */
const RING_TINT = 42;

const chatRing = (accent: string, neutral: string): string =>
  `color-mix(in srgb, ${accent} ${RING_TINT}%, ${neutral})`;

/** the chat's paper: the dot grid, the ring, and nothing else. One component, so every place the
 *  conversation is embedded — the quoted message, the reply block, the whole thread — is
 *  unmistakably the same surface. */
function ChatPaper({
  children,
  testid = 'dotted-paper',
  scroll,
}: {
  children: React.ReactNode;
  testid?: string;
  /** the whole thread runs long; the quoted message never does */
  scroll?: boolean;
}) {
  const [, theme] = useStyletron();
  const tile = (theme as unknown as { brand?: { dotTile: string } }).brand?.dotTile ?? DOT_TILE;
  return (
    <div
      data-testid={testid}
      style={{
        backgroundImage: dots(theme.colors.mono400),
        backgroundSize: tile,
        backgroundColor: theme.colors.mono100,
        border: `1px solid ${chatRing(theme.colors.accent, theme.colors.mono300)}`,
        borderRadius: theme.borders.radius300,
        padding: theme.sizing.scale500,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        /* `overflowY: auto` silently computes `overflow-x: auto` too, which is a sideways
           scrollport nobody asked for and nobody can see until a long word lands in it (§13). */
        ...(scroll ? { maxHeight: 320, overflowY: 'auto' as const, overflowX: 'clip' as const } : null),
      }}
    >
      {children}
    </div>
  );
}

/* ── THE MARGINALIA (FEED-IA §14) ────────────────────────────────────────────────────────────
 * «THE ANNOTATION — provenance notes, flags, amendments, the thread. ABOUT the document, visually
 * subordinate to it, never interleaved so tightly the document's own lines drown.»
 *
 * A note about a line still has to sit under that line — §1 of THE-INTELLIGENCE is explicit that
 * provenance is INDENTED BELOW the thing it is about. What was wrong was that it looked like more
 * document: same ink, same measure, four of them under a three-line albarán. So the notes hang in
 * a MARGIN — indented past the produce mark, against a hairline, at the smallest step — which is
 * how a printed page has always told a reader that something is a hand's note and not the text.
 */
function Marginal({
  children,
  testid,
}: {
  children: React.ReactNode;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale200,
        marginLeft: theme.sizing.scale1000,
        paddingLeft: theme.sizing.scale400,
        borderLeft: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ── THE TICK (FEED-IA §7.2) ──────────────────────────────────────────────────────────────────
 * «The day view's minimal action is the tick — a satisfying check per order (and per line
 * inside).» The satisfaction is the fill: the ink disc grows from nothing on an overshooting
 * curve, so the circle answers the finger rather than merely recording it. Nothing here is a
 * colour with a meaning — a ticked circle is ink, and an unticked one is a hairline.
 */

/** the one motion in the app that overshoots. A tick that eases politely into place reads as a
 *  checkbox; a tick that arrives feels like clearing a table, which is what §3 asks preparation
 *  to feel like. Base has no overshoot curve, so this is the app's own — motion, never paint. */
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export function Tick({
  on,
  size = 28,
  label,
  testid,
  onClick,
  disabled = false,
}: {
  on: boolean;
  size?: number;
  label: string;
  testid: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [, theme] = useStyletron();
  return (
    <button
      type="button"
      data-testid={testid}
      data-ticked={on ? 'yes' : 'no'}
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        flex: '0 0 auto',
        padding: 0,
        borderRadius: '50%',
        border: `1px solid ${on ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
        background: 'transparent',
        color: on ? theme.colors.backgroundPrimary : theme.colors.contentTertiary,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: theme.colors.contentPrimary,
          transform: on ? 'scale(1)' : 'scale(0)',
          transitionProperty: 'transform',
          transitionDuration: theme.animation.timing400,
          transitionTimingFunction: SPRING,
        }}
      />
      {/* AN UNTICKED CIRCLE IS EMPTY. A faint grey ✓ sitting inside every circle under a header
          that reads «0 of 3 picked» says the opposite of what the header says — the mark is the
          RESULT of the act, so it does not exist before the act. Off is a hairline ring and
          nothing else; the check arrives with the ink. */}
      <span
        style={{
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          opacity: on ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: theme.animation.timing400,
          transitionTimingFunction: SPRING,
        }}
      >
        <Glyph id="check" size={Math.round(size * 0.62)} />
      </span>
    </button>
  );
}

/* ── THE STEPPER ──────────────────────────────────────────────────────────────────────────────
 * A counted line is stepped, not typed: cajas and units move one at a time and a keyboard is the
 * wrong instrument for two of something. Base ships a Stepper, and it is not used here for one
 * reason: its readout is a 36px numeric input, which cannot carry the unit on the number's own
 * line — and that is a standing law in this house, not a preference. So the readout is the Figure
 * and the two buttons are Base's own circular buttons, which is the same component set arranged to
 * obey the law.
 */

function Stepper({
  value,
  unit,
  onChange,
  testid,
}: {
  value: number;
  unit: string;
  onChange: (next: number) => void;
  testid: string;
}) {
  const [, theme] = useStyletron();
  const step = (by: number) => onChange(Math.max(0, Math.round((value + by) * 1000) / 1000));
  return (
    <div
      data-testid={testid}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        padding: `${theme.sizing.scale200} ${theme.sizing.scale300}`,
        borderRadius: theme.borders.radius200,
        border: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
      }}
    >
      <Button
        kind={KIND.secondary}
        size={SIZE.mini}
        shape={SHAPE.circle}
        data-testid={`${testid}-down`}
        aria-label="One less"
        disabled={value <= 0}
        onClick={() => step(-1)}
      >
        <Glyph id="minus" size={STEP.small} />
      </Button>
      <span style={{ minWidth: 84, textAlign: 'center' }}>
        <Figure value={value} unit={unit} decimals={Number.isInteger(value) ? 0 : 3} size="compact" />
      </span>
      <Button
        kind={KIND.secondary}
        size={SIZE.mini}
        shape={SHAPE.circle}
        data-testid={`${testid}-up`}
        aria-label="One more"
        onClick={() => step(1)}
      >
        <Glyph id="plus" size={STEP.small} />
      </Button>
    </div>
  );
}

/* ── THE UNIT, AND THE OTHER WORD FOR IT (THE-INTELLIGENCE §3) ───────────────────────────────
 * «The alternates are ONE TAP sideways: unit chips flip the editor; the conversion is shown doing
 * its arithmetic, never hidden.» The amount, the price and what was asked all cross together, so
 * THE LINE'S MONEY DOES NOT MOVE when the word does — and the sentence beside the chips says so,
 * because a number that changed while a person pressed a word would be the app arguing with itself.
 *
 * It draws beside the number's own unit, never in a labelled block of its own further up the
 * editor: the chips ARE the unit, one tap from the one that is on the line.
 */

function UnitChips({
  line,
  units,
  arithmetic,
  onFlip,
}: {
  line: SaleLine;
  units: string[];
  arithmetic: string | null;
  onFlip: (unit: string) => void;
}) {
  const [, theme] = useStyletron();
  if (units.length < 2) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0, maxWidth: '100%' }}>
      <div style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
        {units.map((u) => (
          <Button
            key={u}
            kind={u === line.unit ? KIND.primary : KIND.secondary}
            shape={SHAPE.pill}
            size={SIZE.mini}
            data-testid={`unit-${line.id}-${u}`}
            onClick={() => { if (u !== line.unit) onFlip(u); }}
          >
            {u}
          </Button>
        ))}
      </div>
      {arithmetic && (
        <span
          data-testid={`arithmetic-${line.id}`}
          style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
        >
          {arithmetic} · the money on the line stays where it is
        </span>
      )}
    </div>
  );
}

/* ── IMMERSION: EVERY VALUE EDITS IN PLACE (FEED-IA §31.3) ────────────────────────────────────
 * «People should be able to edit without clicking an edit button. The edit state sort of appears
 * as you hover. You tap the thing that needs to be done. Name/text fields get a dropdown with the
 * best suggestion. That's what native AI is.»
 *
 * THE ROW IS NO LONGER A BUTTON AND THERE IS NO PENCIL. A row that was one big target could only
 * open one editor — everything at once, 500px of it — so the person tapped a quantity and got a
 * form. Now each VALUE on the line is its own target and opens its own instrument:
 *
 *   THE NAME (and the word riding it) →  a Combobox of ranked candidates (below)
 *   THE AMOUNT (and the money it makes) →  the odometer on a weighed line, the stepper on a
 *                                          counted one, with the unit chips beside it
 *   THE CLASS →  the closed register of classes, where «class A» was written
 *
 * The affordance IS THE UNDERLINE, AND IT STANDS AT REST (§51.14, the decision stated in full on
 * `Editable`): one hairline under every value a hand can write over, on every surface and every
 * device. A pointer paints its ground and closes the ring; opening it draws the box.
 *
 * ═══ EVERY CONTROL SITS ON THE THING IT CHANGES (FEED-IA §16) ═══════════════════════════════
 * «A person who has never seen it edits a line correctly on the first try.» That test is what
 * decides which instrument opens: the fact you touched chooses it, so there is never a control on
 * screen that belongs to a fact you were not looking at.
 */

/** which value on the line is open. `null` is the resting document.
 *  `prep` is the note under the title (§6) — it opens IN PLACE, under the name, rather than in the
 *  editor card below, because a note about packing is read where it will be printed.
 *
 *  `rate` IS NEW, AND IT CLOSES THE ONE HOLE §109.6 FOUND. «Any row is ALWAYS ready to edit — no
 *  edit button, no edit mode; click into any value and type.» The rate was the last value on a line
 *  a person could read and not touch: it moved into the money column (§109.5) as a plain figure,
 *  and the only road to it was the labelled Price box inside the name's editor — a form beside the
 *  row, which §109.5 asserts dead. It is a value like every other one now. */
/* ⚠ `class` LEFT THIS UNION (FEED-IA §197.2 «Remove class everywhere», §193.4). */
type LineField = 'name' | 'amount' | 'unit' | 'prep' | 'comment' | 'lot' | 'weight' | 'rate';

/* ═══ THE EDITABLE AFFORDANCE, DECIDED ONCE (FEED-IA §51.14) ══════════════════════════════════
 * «If things are constantly editable — little borders around editable items, or not? Decide ONE
 * grammar and apply it.»
 *
 * THE DECISION: A VALUE A HAND CAN WRITE OVER WEARS A QUIET UNDERLINE, AT REST, ALWAYS.
 *
 *   REST     one hairline under the value, `mono400` — the lightest mark that survives a glance
 *            across a desk. Nothing else: no box, no fill, no tint, no icon.
 *   HOVER    the ground paints and the hairline closes into a full ring. It PAINTS and never
 *            MOVES (§37.3): the ring is a transparent border at rest, so the box is already the
 *            size it will be.
 *   OPEN     the full box, in ink — the field the value became.
 *
 * WHY UNDERLINE AND NOT A BOX. §31.3 asks for immersion — «people should be able to edit without
 * clicking an edit button» — and a sheet of boxed values is a FORM, which is the opposite claim:
 * a form says «fill me in», a document says «this is what it says, and you may write over it».
 * The underline is the only mark that says the second thing at the weight of a document.
 *
 * WHY IT STANDS AT REST AND NOT ON HOVER. A mark that appears under a pointer is a mark a person
 * has to hunt for, and on a phone it can never appear at all — so «which of these numbers can I
 * change» was answerable only by a mouse. It costs one hairline to answer it for everybody.
 *
 * AND THE FIELDS INSIDE AN OPEN EDITOR KEEP THEIR BOX, because that IS the open state of this same
 * object — the row of fields is a value that has been written over, drawn at its own step.
 *
 * WHERE IT IS APPLIED: `Editable` (every value on a line), and `PriceCell` and `TierName` in
 * `stock-tiers.tsx` (every price and every band name on the product sheet and the registry).
 *
 * ═══ AND THE COMPONENT LIVES IN `rows.tsx` (THE-ADMIN-BUILD §2.3, §9 — the owed collapse) ═════
 * THE COLLAPSE IS DONE. This file grew `Editable` first, for the albarán's own values, and kept it
 * private; the administration then needed the same grammar on ten seats of editable values and
 * drew it again in `rows.tsx` — same steps, same negative margin, same ring, same underline — with
 * the collapse NAMED as owed, because this file was under another session's hand at the time.
 * So: `rows.tsx` is the one home and this file imports it. One import, one deletion, no pixels.
 * THE ONE DELTA, RECORDED: the shared copy stops the click at its own boundary
 * (`e.stopPropagation()`), which the private copy did not. Nothing wrapping a line here listens
 * for a click — the line's own acts sit on their own buttons — so the behaviour on this surface is
 * unchanged, and a value that never fires its container's handler is the correct rule for a
 * grammar that is used inside `Row`, which does drill in on a press.
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * One component, so every editable value in the document reveals itself the same way and a person
 * learns the affordance once. It is drawn on the value's own box with a negative margin, so
 * turning a value editable moves NOTHING on the resting line — the underlay grows into the air
 * already around the type instead of pushing the line apart.
 *
 * ═══ HOVER MAY NEVER MOVE GEOMETRY (FEED-IA §37.3) ══════════════════════════════════════════
 * «The albarán's line cards jump height on hover — very bad. The editable reveal reserves its
 * space; nothing jags.»
 *
 * This component was already honest about it — the border is a 1px SOLID TRANSPARENT ring at rest
 * that is only PAINTED under a pointer, and the padding it takes back with a negative margin never
 * changes — so a value gaining its underlay costs nothing and never has. What jagged was one level
 * up, on the row: the prep note's ghost line was MOUNTED by the pointer, so hovering a line with
 * no packing note grew it by a whole row of type and the rest of the document shuffled down.
 *
 * THE RULE THIS FILE NOW KEEPS: a hover may paint, tint and reveal, and it may never mount,
 * unmount, pad, or resize. Anything a pointer shows has its space reserved at rest.
 */
/* ── THE WORDS A NAME CAN TAKE (THE-INTELLIGENCE §10.4, §1, §2) ───────────────────────────────
 * «Name/text fields get a dropdown with the best suggestion» (§31.3), and the suggestions are the
 * router's, ranked: `words ──(customer routing)──▶ NODE ──(house prior)──▶ the SKU`. So the list
 * is not the catalogue — it is what THIS line could honestly say, in the order the intelligence
 * ranks it:
 *
 *   1 · THE CUSTOMER'S OWN WORD, where Rocoto filled the line with something else. Putting it
 *       back is the training signal itself (§1: «the correction IS the feedback»), so it leads.
 *   2 · THE SORTS THE HOUSE'S OWN ALBARANES ALREADY CARRY under this line's node — «de pincho»,
 *       «de roca» — ranked by how many documents prove them (§10.3, the house prior).
 *   3 · THE WORDS THIS HOUSE ALREADY PUTS ON THESE GOODS — «sin cabeza», «cocido» — ranked by how
 *       often this month (§2, the amendment registry).
 *
 * EVERY OPTION FIRES AN EVENT THE APP ALREADY HAS. The customer's word is a `correct`; every
 * other word, typed or picked, is an `amend`. Nothing here invents a way to change a line.
 */

type WordAct = 'correct' | 'amend' | 'add';

type WordOption = {
  id: string;
  /** the word that will ride the name */
  word: string;
  /** why it is on the list, in one clause */
  why: string;
  act: WordAct;
  /** the catalogue row this candidate puts on the albarán, where it puts one on */
  product?: Product;
  /** Rocoto's own reading, so the top candidate carries the accent and the rest do not */
  rocoto?: boolean;
};

/** THE OTHER TWO WAYS TO PAY, said as the act rather than as a noun: «Mark paid · in cash · by
 *  card» is one sentence with three endings, where «cash» alone reads as a fact about the sale. */
const PAID_HOW: Record<PayMethod, string> = {
  cash: 'in cash',
  card: 'by card',
  transfer: 'by transfer',
};

/** THE LANDING IS SIX ROWS (§10, the criteria): «with a 300-SKU cast the screen shows the field
 *  plus at most six ranked candidate rows, each carrying its why-clause». That is the RESTING
 *  list — what stands there before anybody has typed — and it is a ranking, so six is right. */
const LANDING = 6;

/** AND A SEARCH IS NOT A LANDING (FEED-IA §45.1). «The add-a-line product picker must work at
 *  HUNDREDS of SKUs — this is the normal customer for us: search-first, instant, keyboard-walkable,
 *  category-grouped, the photos carrying recognition; never a short flat list.»
 *
 *  Six is the number of things Rocoto is willing to GUESS. It is the wrong number for a person who
 *  has typed «mer» into a shelf of three hundred and wants to see what is on it: a ranked six that
 *  silently drops the seventh match is a list that hides the goods, and the house then believes the
 *  product is missing from their own catalogue. So a deep field's answer is as long as the shelf's
 *  own answer, grouped, inside a scrollport — and it stops at a ceiling only so an accidental empty
 *  query cannot mount a thousand rows at once. */
const SEARCH_ROWS = 60;

/** «Pulpo de roca» under «Pulpo» is the word «de roca». The house says the difference; the base is
 *  already on the line, so repeating it in the chip would print the product's name twice. */
function residueOf(full: string, base: string): string {
  const f = full.toLowerCase();
  const b = base.toLowerCase();
  if (f.startsWith(b) && full.length > base.length) return full.slice(base.length).trim();
  return full;
}

/* ── THE RANKED LANDING MOVED INTO THE ORGAN (§10, §45.1, §62.4) ──────────────────────────────
 * What stood here built a ranked shelf of every product the house sells — this customer's own
 * goods first, then the house's prior at today's date, then the rest — and handed it to the name
 * field as its register. §45.1 made that shelf load-bearing («the picker must work at HUNDREDS of
 * SKUs»), and §62 moved the whole job into `chip-parse.ts`, which searches the REFERENCE rather
 * than one house's list and therefore answers a word this house has never sold.
 *
 * The ranking is not lost, it is relocated: `suggestChips` leads with the reference's own names for
 * what they are typing and, on an empty word, with what Rocoto reads their LINE as missing — which
 * is the same «Rocoto's own reading first, in the accent» rule this list was written for.
 */

/* ═══ THE FIELDS — THE LINE'S EDITOR IS A ROW OF THEM (FEED-IA §41.5) ════════════════════════
 * «THE FIELDS QUESTION, answered by UX: MULTIPLE fields, never the old-SaaS pain — ARROW KEYS
 * navigate between them; smart suggestions pop as a dropdown below WITH THE LITTLE PHOTOS (the
 * paintings) for the main name and the sort; suggestions are LLM-backed and typo-tolerant; sorts
 * mix our predefined set with things we have never heard — THEY CAN ALWAYS TYPE ANYTHING
 * (suggestions never restrict); a picked suggestion renders as the token look — slightly bold,
 * slightly toned against the rest of the text.»
 *
 * ═══ THIS IS THE PART CHIPS, GROWN UP ══════════════════════════════════════════════════════
 * The previous answer was ONE box with the parse's findings drawn ABOVE it as labelled chips. The
 * decomposition was right and the surface was wrong: a chip is a read-out, so every correction was
 * a round trip — read the chip, go back to the box, retype the part, watch the chips re-settle.
 * The chips ARE the fields now. Each part keeps its label, its own register and its own typo
 * scoping, and it gains the thing a chip could never have: a caret. The parse survives inside the
 * NAME field, where a person still writes «merlusa pincho b sin cabeza» in one breath and the
 * words WALK OUT into the fields they belong to.
 *
 * ═══ WHY NOT BASE'S OWN COMBOBOX ═══════════════════════════════════════════════════════════
 * Base's `Combobox` is one input that owns its own focus and keyboard, and it is still what the
 * prep note uses, because a prep note is one field. A ROW of seven fields needs two things it
 * cannot give: a field that hands focus sideways at the caret's edge, and a value that WRAPS
 * (§41.6 — «rabo de toro» is long, and the goods are never truncated; an `<input>` cannot wrap).
 * So the row is built on Base's `Popover` — the same overlay, the same layer, the same placement
 * engine — with the ARIA combobox contract kept by hand: `role="combobox"`, `aria-expanded`,
 * `aria-controls`, `aria-activedescendant`, and a `role="listbox"` of `role="option"` rows.
 *
 * ═══ TYPING IS ALWAYS LEGAL ════════════════════════════════════════════════════════════════
 * «They can always type anything — suggestions never restrict.» A `write` field takes whatever a
 * person writes and lands it as their own word. A `pick` field is a CLOSED register (the grade, a
 * dimension, the unit) and has no free-text path, which is the older law §41.2 and §41.1 both
 * keep. The two are told apart by their behaviour, never by a lock.
 */

/** One row under an open field. */
export type Suggestion = {
  /** what goes in the field when it is taken */
  word: string;
  /** why it is on the list, in one clause. A closed register's words explain themselves. */
  why?: string;
  /** THE LITTLE PHOTO (§41.5). The goods this row is a picture of, by the name the painted library
   *  is keyed on — so the name and the sort carry a face and the grade does not. */
  face?: string;
  /** Rocoto's own reading, so the top row carries the accent and the rest do not (§1) */
  rocoto?: boolean;
  /** THE SHELF THIS ROW HANGS UNDER (§45.1). A deep register — the whole catalogue — is grouped by
   *  the house's own shelf word, so three hundred SKUs read as a catalogue and never as a dump. A
   *  shallow register (a grade, a unit, the sorts under one kind) leaves it empty, because eight
   *  words in one closed set have nothing to be grouped into. */
  group?: string;
};

export type FieldSpec = {
  id: string;
  /** the label over the field — English, the review surface's language */
  label: string;
  /** `write` takes any words · `pick` takes only its register's · `number` takes digits ·
   *  `fact` states something no act on this surface writes */
  kind: 'write' | 'pick' | 'number' | 'fact';
  /** the value the document currently carries */
  value: string;
  suggest?: Suggestion[];
  /** the unit that shares the number's own line, never a line of its own */
  unit?: string;
  placeholder?: string;
  /** one clause under the field, where the field itself needs one. A clause is a FACT about this
   *  value — «Off today's sheet» — never an instruction about how to use the row (§51.24). */
  note?: string;
  /** THE FIELD'S OWN ALTERNATIVE (FEED-IA §51.6). «At no charge floating beside negative space
   *  means nothing — place it deliberately.» A control that REPLACES this value belongs under the
   *  value it replaces, in the field's own column, so it reads as the other answer to the same
   *  question rather than as a stray switch in the white below the row. */
  alt?: React.ReactNode;
  /** THE VALUE IS ALREADY A WORD THE APP KNOWS, even where the field offers no list to prove it.
   *  A standing line's kind is landed — it IS a catalogue row — so it wears the token look while
   *  its register stays empty, because «changing what a line IS» is not a thing this field does. */
  landed?: boolean;
  /** THIS FIELD'S REGISTER IS THE WHOLE CATALOGUE (FEED-IA §45.1) — «they all have hundreds of
   *  SKUs; this is the normal customer». A deep field is SEARCH-FIRST: the typing filters the whole
   *  shelf rather than six pre-ranked rows, the answers come back under their own shelf headers,
   *  and the list is as long as it needs to be inside its own scrollport. Everything else about the
   *  field is unchanged — same caret, same arrows, same «they can always type anything». */
  deep?: boolean;
  /** the act. It fires an event the app already has — no field invents one. */
  put?: (word: string) => void;
};

/** THE COLUMN'S OWN WIDTH (§41.6) — «columns size to the largest typical value». Measured off the
 *  words the column actually holds rather than guessed, with a ceiling: a value past the ceiling is
 *  the atypical one, and it WRAPS onto a second line rather than losing its tail. */
const fitOf = (words: Array<string | undefined>, floor = 7, ceiling = 17): number => {
  const lens = words.filter((w): w is string => Boolean(w)).map((w) => w.length + 2);
  return Math.max(floor, Math.min(ceiling, lens.length > 0 ? Math.max(...lens) : floor));
};

/** THE SUGGESTION ROW. The painting leads at 28px — the seat every other surface uses, one step
 *  down — then the word, then the clause that says why it is on the list. */
function SuggestRow({ option, on }: { option: Suggestion; on: boolean }) {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
        background: on ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      {option.face && <ProductFace of={{ name: option.face }} size={28} />}
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, ...theme.typography.LabelSmall }}>
          {option.rocoto && <FlagMark />}
          {option.word}
        </span>
        {option.why && (
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            {option.why}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * THE ROW OF FIELDS, WALKED WITH THE ARROWS.
 *
 * ←  at the caret's left edge  →  the field before
 * →  at the caret's right edge →  the field after
 * Tab · Shift+Tab              →  the field after · the field before, from anywhere in the value
 * ↑ ↓                          →  through the suggestions
 * Enter                        →  take the highlighted one, else keep what is written, and step on
 * Esc                          →  put the list away (a second Esc closes the editor — the line owns
 *                                 that one, and the innermost thing always releases first)
 *
 * A caret in the MIDDLE of a word still walks the word, which is why the edges are the trigger: a
 * person correcting the third letter of «merlusa» has to be able to reach it. A field STEPPED INTO
 * stands selected, so the next thing typed replaces it (checkpoint §14.2d).
 */
export type FieldsProps = {
  /** the parts this line is written in, left to right — the columns a person walks with the arrows */
  fields: FieldSpec[];
  /** the row's own handle; every cell, list and option hangs its id off it */
  testid: string;
  /** THE KEYBOARD ARRIVED (checkpoint §14.2b). A counter rather than a flag: Enter pressed twice on
   *  the same line has to put the caret back in the ring both times. */
  enter?: number;
};

export function Fields({ fields, testid, enter }: FieldsProps) {
  const [css, theme] = useStyletron();
  /* THE FIT READS THE SURFACE (§41.6). On a desk a column is as wide as its own widest typical
     value and no wider — that is what makes the row read as columns. On a phone the editor is
     240px and a column sized to its words leaves half a row of white beside it, so a field GIVES
     and TAKES there: two short ones share a line instead of each spending a whole one. */
  const phone = usePhone();
  const [at, setAt] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const [high, setHigh] = React.useState(0);
  /* ── WHAT IS IN HAND, AND WHY IT IS A REF (§41.5) ──────────────────────────────────────────
   * What is being typed, per field, until it is committed. The document's own value stands the
   * moment there is nothing in hand, so a fold that moves a line moves the field with it.
   *
   * IT IS A REF WITH A REDRAW BESIDE IT, AND THAT IS A BUG THIS COST. As state, clearing it was a
   * queued update — and taking a suggestion with Enter steps to the next field, which BLURS this
   * one synchronously, inside the same handler, before React had flushed the clear. The blur then
   * read the half-typed word still sitting in the draft and committed it OVER the word just picked:
   * «de pincho» chosen off the list, «pinsho» on the albarán. A ref clears in the same tick the
   * pick happens, so the blur that follows finds nothing in hand and stands down.
   */
  const held = React.useRef<Record<string, string>>({});
  const [, redraw] = React.useReducer((n: number) => n + 1, 0);
  const cells = React.useRef<Array<HTMLTextAreaElement | HTMLInputElement | null>>([]);
  /** the row itself — the boundary an «outside» press is measured against */
  const row = React.useRef<HTMLDivElement>(null);

  const textOf = (f: FieldSpec): string => held.current[f.id] ?? f.value;

  /** THE ROWS AN OPEN FIELD SHOWS. Typo-tolerant against the field's OWN register and no wider set
   *  — which is what makes «de pinsho» move the sort and never the kind (§41.5, and the parse's own
   *  reason for scoping every part).
   *
   *  `hit` IS WHAT KEEPS A FALLBACK LIST FROM STEALING THE WORD. When the writing claims nothing,
   *  the register still stands open — the list never shuts a person out of what they could pick —
   *  but nothing in it is highlighted, so Enter keeps what they wrote. A list that answered «de
   *  pinsho» with «de roca» because de roca happened to be first would be the app putting words in
   *  their mouth, which is the exact opposite of «they can always type anything». */
  const takes = (s: Suggestion, typed: string): boolean =>
    foldWord(s.word).includes(foldWord(typed)) || claims(typed, s.word) || claimsPhrase(typed, s.word)
    /* A DEEP REGISTER IS SEARCHED BY THE SHELF TOO (§45.1). «Marisco» is a thing a person types
       when they want to see what is on that shelf, and a catalogue that answered it with nothing
       would be a catalogue whose own headers are unsearchable. A shallow register carries no
       group, so this clause costs it nothing. */
    || (s.group !== undefined && foldWord(s.group).includes(foldWord(typed)));

  const hasHit = (f: FieldSpec, text: string): boolean => {
    const typed = text.trim();
    return typed.length === 0 || (f.suggest ?? []).some((s) => takes(s, typed));
  };

  /** WHAT AN OPEN FIELD SHOWS, AND HOW MUCH OF IT (§41.5, §45.1). A shallow register lands its six
   *  ranked rows; a DEEP one — the whole catalogue — answers the search at the shelf's own length
   *  and keeps its ranking for the resting list. Both keep the fallback rule: when the writing
   *  claims nothing the register still stands open and nothing in it is highlighted, so Enter keeps
   *  the person's own word. */
  const rowsOf = (f: FieldSpec): { rows: Suggestion[]; hit: boolean } => {
    const all = f.suggest ?? [];
    const typed = textOf(f).trim();
    const cap = f.deep ? SEARCH_ROWS : LANDING;
    /* ── A CLOSED REGISTER IS NEVER FILTERED BY ITSELF (found in a drive, §51.5) ─────────────
     * A `pick` has no typing, so its «typed» text is simply the value it is already holding — and
     * filtering the list by that means the register opens showing THE ONE WORD ALREADY ON THE
     * FIELD and nothing else. The Unit field on a kilo line offered «kg» and only «kg»: the flip
     * to cajas, which is what makes a counted kind counted, could not be reached at all. A closed
     * register always shows the whole set; searching is what `write` fields do. */
    if (f.kind === 'pick') return { rows: all.slice(0, cap), hit: true };
    if (!typed) return { rows: all.slice(0, f.deep ? SEARCH_ROWS : LANDING), hit: true };
    const hit = all.filter((s) => takes(s, typed));
    return hit.length > 0
      ? { rows: hit.slice(0, cap), hit: true }
      : { rows: all.slice(0, f.deep ? SEARCH_ROWS : LANDING), hit: false };
  };

  /** THE HEADERS, COMPUTED OFF THE ANSWER ITSELF. A row opens a shelf exactly when its group is not
   *  the group of the row before it, so the headers describe the list a person is actually looking
   *  at rather than the catalogue's own table of contents. The option INDICES never move — the
   *  keyboard walks options and a header is not one — which is what keeps ↑↓, `aria-activedescendant`
   *  and Enter reading the same list they always did. */
  const shelfAt = (rows: Suggestion[], k: number): string | null => {
    const here = rows[k]?.group;
    if (!here) return null;
    return k === 0 || rows[k - 1]?.group !== here ? here : null;
  };

  /** THE TOKEN LOOK (§41.5). A value the field's own register holds reads as a token — slightly
   *  bold, slightly toned — and anything else reads as plain typed text. It is the same lockup the
   *  amendment chip already wears on the line, so a picked word looks the same wherever it stands. */
  const isPicked = (f: FieldSpec): boolean => {
    const v = foldWord(textOf(f));
    if (v.length === 0) return false;
    return (f.landed && v === foldWord(f.value)) || (f.suggest ?? []).some((s) => foldWord(s.word) === v);
  };

  /** WHERE THE WALK STARTS. A closed register opens ON the word it is holding, so ↑↓ steps away
   *  from where the person actually is; a written field starts at the top of what it found. */
  const startAt = (f: FieldSpec): number => {
    if (f.kind !== 'pick') return hasHit(f, textOf(f)) ? 0 : -1;
    const v = foldWord(textOf(f));
    const at = rowsOf(f).rows.findIndex((s) => foldWord(s.word) === v);
    return at >= 0 ? at : 0;
  };

  const editable = (i: number): boolean => Boolean(fields[i]) && fields[i].kind !== 'fact';

  /** WHERE THE CARET LANDS. `all` is the spreadsheet's own answer and it is what a STEP uses
   *  (checkpoint §14.2d: «type to replace»). */
  const focusAt = (i: number, caret: 'start' | 'end' | 'all') => {
    const el = cells.current[i];
    if (!el) return;
    el.focus();
    const end = el.value.length;
    /* ── TYPE TO REPLACE (checkpoint §14.2d) ────────────────────────────────────────────────
     * «Arrow keys to move; Enter to open/edit; Tab between editable fields; TYPE TO REPLACE.»
     * The cell is a textarea holding the value the line already carries, so a person who steps
     * onto «12» and types «40» used to get «1240» — the number the document ends up with is the
     * two numbers stuck together, which at 300 orders a morning is a wrong albarán rather than a
     * clumsy keystroke. A field stepped INTO stands selected, exactly as a spreadsheet's does:
     * typing replaces, and the caret keys still reach into the word for whoever wants to correct
     * the third letter — the first ← or → collapses the selection natively, and the second one
     * steps, which is the same two presses Excel takes. */
    if (caret === 'all') {
      try { el.setSelectionRange(0, end); } catch { /* a readonly cell has no range to set */ }
      return;
    }
    const to = caret === 'end' ? end : 0;
    try { el.setSelectionRange(to, to); } catch { /* a readonly cell has no range to set */ }
  };

  /** THE ONE WALK. ← → at the caret's edge, Tab and Shift+Tab all come through here, so «the next
   *  editable field» is decided once (§27.5). It says whether it found one, which is what lets Tab
   *  hand the key back to the browser at the end of the ring rather than trapping the keyboard. */
  const step = (from: number, by: number): boolean => {
    for (let i = from + by; i >= 0 && i < fields.length; i += by) {
      if (editable(i)) { setOpen(false); focusAt(i, 'all'); return true; }
    }
    return false;
  };

  const write = (f: FieldSpec, next: string) => {
    held.current[f.id] = next;
    redraw();
  };

  /** THE COMMIT. It empties the hand FIRST — in this same tick — so the document's own value stands
   *  again and the blur that follows a step finds nothing to re-commit. That ordering is the whole
   *  of the fix above, and it is also why a field and the ledger can never disagree. */
  const commit = (f: FieldSpec, word: string) => {
    delete held.current[f.id];
    redraw();
    if (word.trim() !== f.value.trim()) f.put?.(word);
  };

  const onKey = (e: React.KeyboardEvent<HTMLElement>, i: number) => {
    const f = fields[i];
    const el = cells.current[i];
    const { rows, hit } = rowsOf(f);
    const listOpen = open && at === i && rows.length > 0;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (rows.length === 0) return;
      e.preventDefault();
      /* an arrow into a fallback list IS a choice, so it takes the highlight the list refused to
         claim on its own */
      if (!listOpen || high < 0) {
        setOpen(true);
        setHigh(e.key === 'ArrowDown' ? 0 : rows.length - 1);
        return;
      }
      setHigh((h) => (e.key === 'ArrowDown' ? (h + 1) % rows.length : (h - 1 + rows.length) % rows.length));
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const back = e.key === 'ArrowLeft';
      const caret = el && f.kind !== 'pick' ? el.selectionStart ?? 0 : 0;
      const tail = el && f.kind !== 'pick' ? el.selectionEnd ?? 0 : 0;
      const edge = f.kind === 'pick'
        ? true
        : back ? caret === 0 && tail === 0 : caret === (el?.value.length ?? 0) && tail === caret;
      if (!edge) return;
      e.preventDefault();
      if (f.kind !== 'pick') commit(f, textOf(f));
      step(i, back ? -1 : 1);
      return;
    }
    /* ── TAB STEPS THE RING (checkpoint §14.2c) ──────────────────────────────────────────────
     * «Tab between editable fields.» It is the SAME step ← and → already take at the caret's
     * edge — one behaviour, three keys, one `step()` — rather than a second walk that could land
     * somewhere else (§27.5). The order is the document's own: quantity, unit, price, left to
     * right, which is the order the row is read in.
     * IT NEVER TRAPS THE KEYBOARD. Past the last editable there is nothing in the ring to step to,
     * so the key is left to the browser and Tab goes on doing what Tab does. */
    if (e.key === 'Tab') {
      const back = e.shiftKey;
      if (f.kind !== 'pick') commit(f, textOf(f));
      setOpen(false);
      if (step(i, back ? -1 : 1)) e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const take = listOpen && high >= 0 && (hit || textOf(f).trim().length === 0);
      commit(f, take ? rows[high]?.word ?? textOf(f) : textOf(f));
      setOpen(false);
      step(i, 1);
      return;
    }
    if (e.key === 'Escape' && listOpen) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  /* THE FIELD GROWS IN HEIGHT, IT NEVER TRUNCATES (§41.6). A textarea that is measured after every
     change is the whole mechanism: «rabo de toro» wraps onto a second line and the cell — and the
     row with it — takes the height the words need. */
  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    /* THE BORDER COUNTS. The cell is `border-box`, so a height of exactly `scrollHeight` leaves the
       content box two pixels short and the last line's descenders sit under the edge — «never
       truncate the goods» loses by 2px if the border is forgotten. */
    const cs = window.getComputedStyle(el);
    const edge = parseFloat(cs.borderTopWidth || '0') + parseFloat(cs.borderBottomWidth || '0');
    el.style.height = `${el.scrollHeight + edge}px`;
  };

  React.useLayoutEffect(() => {
    cells.current.forEach((el) => { if (el instanceof HTMLTextAreaElement) grow(el); });
  });

  /* ── THE KEYBOARD ENTERS THE RING (checkpoint §14.2b: «Enter to open/edit») ─────────────────
   * Enter on the review surface opens the focused document's first line and lands the caret HERE,
   * on the first thing that can be written, selected. That is the whole of «arrive, open, type»:
   * from the pile a person reaches the number they came to change without touching the pointer.
   * It steps in through `focusAt` like every other arrival, so the selection rule is stated once. */
  React.useLayoutEffect(() => {
    if (!enter) return;
    const first = fields.findIndex((_, i) => editable(i));
    if (first >= 0) focusAt(first, 'all');
    /* THE PRESS IS SPENT HERE, where it was obeyed — see `clearEnter` for why that matters. */
    clearEnter();
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- the signal is the trigger */
  }, [enter]);

  /* ── THE WALK KEEPS THE HIGHLIGHT IN SIGHT (§45.1, «keyboard-walkable») ─────────────────────
   * Six rows all fit, so the highlight was always visible and nothing had to move. A search over
   * three hundred does not fit, and a ↓ that lights a row below the fold is a keyboard that has
   * gone somewhere the person cannot see — they press Enter on a word they never read. The layer
   * is the only thing that scrolls, and it scrolls the least it can («nearest»), so walking down
   * a shelf does not jump the list under the eye. */
  React.useLayoutEffect(() => {
    if (!open || at === null || high < 0) return;
    const f = fields[at];
    if (!f) return;
    const el = window.document.getElementById(`${testid}-list-${f.id}-${high}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, at, high, testid, fields]);

  const cell = (f: FieldSpec, i: number) => {
    const picked = isPicked(f);
    const { rows } = rowsOf(f);
    const listOpen = open && at === i && rows.length > 0;
    const listId = `${testid}-list-${f.id}`;

    const shared = {
      'data-testid': `${testid}-input-${f.id}`,
      'aria-label': f.label,
      'aria-expanded': listOpen,
      'aria-controls': listOpen ? listId : undefined,
      'aria-activedescendant': listOpen ? `${listId}-${high}` : undefined,
      'aria-autocomplete': 'list' as const,
      role: 'combobox' as const,
      onFocus: () => { setAt(i); setHigh(startAt(f)); },
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => onKey(e, i),
      onClick: () => { setAt(i); setOpen(true); setHigh(startAt(f)); },
      onBlur: () => { if (f.kind !== 'pick') commit(f, textOf(f)); setOpen(false); },
    };

    const box = css({
      width: '100%',
      boxSizing: 'border-box',
      display: 'block',
      resize: 'none',
      overflow: 'hidden',
      paddingTop: theme.sizing.scale300,
      paddingBottom: theme.sizing.scale300,
      paddingLeft: theme.sizing.scale400,
      paddingRight: theme.sizing.scale400,
      borderRadius: theme.borders.radius200,
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: theme.colors.borderOpaque,
      /* THE TOKEN LOOK: a theme grey and half a step of weight. No colour — saffron is Rocoto's own
         act and a word a person picked is a person's act (§1). */
      backgroundColor: picked ? theme.colors.backgroundTertiary : theme.colors.backgroundPrimary,
      color: theme.colors.contentPrimary,
      fontFamily: theme.typography.LabelSmall.fontFamily,
      fontSize: theme.typography.LabelSmall.fontSize,
      lineHeight: theme.typography.LabelSmall.lineHeight,
      fontWeight: picked ? 600 : 400,
      /* HOVER MAY PAINT AND MAY NEVER MOVE (§37.3). The border is here at rest and only changes
         colour, and the weight never moves the box because the box is sized by its column. */
      transitionProperty: 'background-color, border-color',
      transitionDuration: theme.animation.timing400,
      transitionTimingFunction: theme.animation.easeOutCurve,
      ':hover': { borderColor: theme.colors.contentTertiary },
      ':focus': {
        outlineWidth: '2px',
        outlineStyle: 'solid',
        outlineColor: theme.colors.borderSelected,
        outlineOffset: '1px',
        borderColor: theme.colors.contentPrimary,
      },
    });

    const control =
      f.kind === 'fact' ? (
        <span
          data-testid={`${testid}-fact-${f.id}`}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: theme.sizing.scale200,
            paddingTop: theme.sizing.scale300,
            paddingBottom: theme.sizing.scale300,
            ...theme.typography.LabelSmall,
            minWidth: 0,
          }}
        >
          {/* THE UNIT SHARES THE NUMBER'S OWN LINE, ALWAYS. */}
          {f.unit ? <Figure value={Number(f.value) || 0} unit={f.unit} size="compact" /> : f.value}
        </span>
      ) : f.kind === 'write' ? (
        <textarea
          {...shared}
          ref={(el) => { cells.current[i] = el; }}
          className={box}
          rows={1}
          value={textOf(f)}
          placeholder={f.placeholder}
          onChange={(e) => {
            const next = e.currentTarget.value;
            write(f, next);
            setOpen(true);
            /* nothing is highlighted while the writing claims nothing, so Enter keeps their word */
            setHigh(hasHit(f, next) ? 0 : -1);
            grow(e.currentTarget);
          }}
        />
      ) : (
        <input
          {...shared}
          ref={(el) => { cells.current[i] = el; }}
          className={box}
          /* A CLOSED REGISTER HAS NO FREE-TEXT PATH (§41.1, §41.2) — the words are the whole set, so
             the cell shows one and opens the rest. A number is written; a register is chosen. */
          readOnly={f.kind === 'pick'}
          inputMode={f.kind === 'number' ? 'decimal' : undefined}
          value={textOf(f)}
          placeholder={f.placeholder}
          onChange={(e) => { if (f.kind === 'number') { write(f, e.currentTarget.value); setOpen(true); } }}
        />
      );

    return (
      <div
        key={f.id}
        data-field={f.id}
        data-picked={picked ? 'yes' : 'no'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale100,
          /* THE FIT (§41.6): the column is as wide as its own widest typical value, and it may give
             ground under pressure. On the phone it may also take it. */
          /* A DEEP REGISTER DOES NOT GET TO SET THE COLUMN'S WIDTH. «Columns size to the largest
             TYPICAL value» (§41.6) — and the longest of three hundred SKUs is by definition the
             atypical one, so a deep field measures the rows that actually stand there at rest and
             lets the rest wrap, exactly as a long value always has. */
          flex: `${phone ? 1 : 0} 1 ${fitOf([
            ...(f.suggest ?? []).slice(0, f.deep ? LANDING : undefined).map((s) => s.word),
            /* THE UNIT IS PART OF THE VALUE'S WIDTH, because it is part of the value's LINE. A
               column measured on «15,80» alone squeezes «€/kg» off the end of it. */
            f.unit ? `${f.value} ${f.unit}` : f.value,
            f.placeholder,
          ])}ch`,
          minWidth: '5.5rem',
        }}
      >
        <FieldLabel>{f.label}</FieldLabel>
        <Popover
          isOpen={listOpen}
          placement={PLACEMENT.bottomLeft}
          accessibilityType={ACCESSIBILITY_TYPE.none}
          autoFocus={false}
          returnFocus={false}
          focusLock={false}
          ignoreBoundary
          onEsc={() => setOpen(false)}
          /* A PRESS ON THE NEXT FIELD IS NOT «OUTSIDE» (§41.5). Base's outside-click closes the
             layer on any press beyond it — including the sibling field the person just reached for
             — and it lands in the same commit as that field's own open, so the list would shut the
             instant it was asked for. The row is the boundary, not the cell. */
          onClickOutside={(e) => {
            const target = (e as unknown as { target: Node | null }).target;
            if (!target || !row.current || !row.current.contains(target)) setOpen(false);
          }}
          content={() => (
            <div
              id={listId}
              role="listbox"
              aria-label={f.label}
              data-testid={`${testid}-suggest-${f.id}`}
              data-deep={f.deep ? 'yes' : 'no'}
              data-rows={rows.length}
              /* THE DEEP LIST IS A CATALOGUE AND IT SCROLLS INSIDE ITSELF. That is not the §38
                 scrollport-in-a-scrollport this app threw out: a popover is a LAYER over the work,
                 not a pane of it, and a layer that grew to the height of the shelf would cover the
                 document the person is adding a line to. */
              style={{ minWidth: f.deep ? '19rem' : '15rem', maxHeight: '19rem', overflowY: 'auto' }}
            >
              {rows.map((s, k) => {
                const shelf = shelfAt(rows, k);
                return (
                  <React.Fragment key={`${s.group ?? ''}-${s.word}`}>
                    {/* THE SHELF'S OWN HEADER (§45.1, «category-grouped»). It is `presentation` and
                        not an option, so nothing about the keyboard, the highlight or the ARIA
                        active descendant changes: the walk is over goods, and a header is a label
                        on the goods. It rides the list's own ground and sticks, because a shelf
                        word that scrolled away would leave forty rows with no shelf. */}
                    {shelf && (
                      <div
                        data-shelf={shelf}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          padding: `${theme.sizing.scale300} ${theme.sizing.scale500} ${theme.sizing.scale100}`,
                          background: theme.colors.backgroundPrimary,
                          ...theme.typography.LabelXSmall,
                          color: theme.colors.contentTertiary,
                        }}
                      >
                        {shelf}
                      </div>
                    )}
                    <div
                      id={`${listId}-${k}`}
                      role="option"
                      aria-selected={k === high}
                      data-testid={`${testid}-option-${f.id}-${k}`}
                      /* THE FOCUS NEVER LEAVES THE FIELD. Taking a row is a press, and a press that
                         blurred the caret would commit the half-typed word on its way out. */
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHigh(k)}
                      onClick={() => { commit(f, s.word); setOpen(false); focusAt(i, 'end'); }}
                      style={{ cursor: 'pointer' }}
                    >
                      <SuggestRow option={s} on={k === high} />
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
          overrides={{ Body: { style: { zIndex: LAYER } }, Inner: { style: { padding: 0 } } }}
        >
          {/* ── A RATE'S UNIT SHARES THE RATE'S OWN LINE, EDITABLE OR NOT (the price-unit law) ──
              The `fact` branch above has always drawn «15,80 €/kg» as one figure. The moment the
              price became a value a hand may write (checkpoint §16.4) that stopped happening: the
              cell was a bare box reading «15,8», and a rate with its unit taken off is a number a
              person reads as a total. So the unit stands beside the input, in the same line box,
              set small and dim like the figure's own — one grammar, two postures. It never wraps:
              a unit that shares the line at 1600 and drops below it at 390 is the same mis-sale on
              the screen most people read on. */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.sizing.scale200,
              flexWrap: 'nowrap',
              minWidth: 0,
            }}
          >
            <span style={{ display: 'block', flex: '1 1 auto', minWidth: 0 }}>{control}</span>
            {f.unit && f.kind !== 'fact' && (
              <span
                data-unit={f.id}
                style={{
                  ...theme.typography.LabelXSmall,
                  color: theme.colors.contentTertiary,
                  whiteSpace: 'nowrap',
                  flex: '0 0 auto',
                }}
              >
                {f.unit}
              </span>
            )}
          </span>
        </Popover>
        {f.note && (
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            {f.note}
          </span>
        )}
        {/* THE OTHER ANSWER TO THE SAME QUESTION (§51.6), in the field's own column and under its
            own value — never floating in the space beside the row. */}
        {f.alt && <span data-alt={f.id}>{f.alt}</span>}
      </div>
    );
  };

  return (
    <div
      ref={row}
      data-testid={testid}
      data-fields={fields.length}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.sizing.scale400,
        /* THE ROW WRAPS RATHER THAN SCROLLING SIDEWAYS. On a 390px screen seven fields are three
           rows of type, and a horizontal scrollbar inside a document is the thing §38 threw out. */
        flexWrap: 'wrap',
        minWidth: 0,
      }}
    >
      {fields.map(cell)}
    </div>
  );
}

/** The sorts this kind actually has — the tree's own children plus the ones the house's albaranes
 *  have already proved. The SORT field opens exactly this and nothing wider (§10) — and takes
 *  anything typed besides, because «sorts mix our predefined set with things we have never heard»
 *  (§41.5). */
/** THE DIMENSIONS A LINE ACTUALLY CARRIES, each with the label it answers to (§41.1). A line that
 *  was never asked returns none — which is the whole of «the option's presence costs them nothing»,
 *  made mechanical rather than promised. */
function dimensionWords(line: SaleLine): Array<{ id: DimensionId; label: string; word: string }> {
  const held = line.dimensions;
  if (!held) return [];
  return dimensionsFor(line.product.family, ground(line.product.name, line.product.family))
    .filter((d) => Boolean(held[d.id]))
    .map((d) => ({ id: d.id, label: d.label, word: held[d.id] as string }));
}

/* ── THE LINE'S OWN EDITOR IS THE ONE FIELD (FEED-IA §109.5, §41.5, §31.3) ────────────────────
 * «Adding OR EDITING a product in the albarán: ONE empty text field first → they write → BOOM, it
 * populates THE ACTUAL ROW STRUCTURE — the finished row's own format… The editor is never a form
 * beside the row — it IS the row, populated.»
 *
 * SO THIS IS ONE FIELD AND NOTHING ELSE. What stood here until §109.5 was the sentence AND a row of
 * labelled boxes under it — Quantity · Unit · Price — which is exactly the form beside the row that
 * clause kills: two ways to change one line, one of them a database form, on a surface whose whole
 * point (§62) is that nothing here is a database field. Every one of those values is a seat on the
 * row itself, wearing §51.14's underline, one press from anywhere (§109.6: «any row is ALWAYS ready
 * to edit — no edit button, no edit mode»):
 *
 *     the amount   → the row's own `line-qty` seat → the scale or the stepper
 *     the unit     → the unit chips, inside the amount's instrument, beside the number they move
 *     the rate     → the row's own `row-rate` seat → the rate's own field (§109.6, added with it)
 *     the lote     → the row's own `line-lot` seat → the batch book
 *
 * ⚠ AND THE CLASS SEAT IS GONE ALTOGETHER (FEED-IA §197.2, §193.4). It stood here between the rate
 * and the lote, on the family's closed register. «Remove class everywhere»: the SKU in the title
 * carries what the market sells by, the lot carries when the goods came in.
 *
 * WHAT THE SENTENCE ITSELF WRITES, AND NOT ONE NEW EVENT KIND (§41.4):
 *   name        `correct` — the customer's own word, put back. The training signal itself (§1).
 *   sort        `amend`   — the word that rides the name and prints on the albarán (§2).
 *   dimensions  `line`    — the closed registers the family carries (§41.1).
 *   qty         `line`    — what goes on the line.
 *   unit        `unit-flip` — the amount, the price and what was asked all cross together (§3).
 */
function LineFields({
  cast,
  sale,
  line,
  now,
  sector,
  onOpenCard,
}: {
  cast: Cast;
  sale: Sale;
  line: SaleLine;
  now: string;
  sector: SectorId;
  onOpenCard: (product: Product) => void;
}) {
  const [, theme] = useStyletron();
  const node = React.useMemo(
    () => ground(line.product.name, line.product.family),
    [line.product],
  );

  /* ── WHAT LEFT THIS EDITOR, AND WHY (§62) ───────────────────────────────────────────────
   * THE NAME'S OWN SUGGESTION LIST, THE SORT'S, and the `spread` that walked a written phrase out
   * into six fields on commit. All three were the chip organ, hand-built, one surface at a time —
   * and §62.4 is explicit that this is ONE SHARED ORGAN, «designed once, reused everywhere». A
   * second grammar living beside it is a second grammar to keep in step, which is the exact shape
   * of every drift this build has had to repair.
   *
   * Nothing was lost: the customer's own word still leads (the organ's `within` register offers
   * it, and `land` below still writes `correct` for it), the house's sorts still stand in the
   * shelf with their paintings, and the residue still rides the name as the amendment.
   */

  /* ── THE SENTENCE, WITHIN THE KIND (FEED-IA §62, chip-parse's `registers.within`) ──────────
   * On a line that already stands, THE KIND IS DECIDED — «changing what a line IS is taking it off
   * and putting another on» — so the organ is handed `within`, and the parser judges every word
   * INSIDE that kind. «A typo in de pincho edits the sort, never the kind», by construction rather
   * than by a guard this file would have to keep in step.
   *
   * IT COMMITS, IT DOES NOT STREAM. The reading changes on every keystroke, but a line on a real
   * albarán may not: writing an `amend` per character would fill the ledger with a person thinking
   * out loud. So the ledger is written on COMMIT — Enter, or the field losing the caret — and the
   * chips in between are the reading, drawn live, costing nothing. */
  const withinRegisters = useChipRegisters({ sector, within: { node, name: line.product.name } });

  /** THE SENTENCE THE LINE ALREADY IS, so the field opens holding what the line says rather than
   *  empty (§59.1: opening an editor may not blank the thing it edits). */
  /* ⚠ WITHOUT THE GRADE (FEED-IA §197.2): the line's own sentence is its name and what rides it. */
  const said = [line.product.name, line.amendment].filter(Boolean).join(' ');

  /** WHAT A COMMITTED SENTENCE WRITES — and not one new event kind (§41.4). */
  const land = (read: ChipLine) => {
    /* THE CUSTOMER'S OWN WORD, PUT BACK. It is the training signal itself (§1), so it is checked
       first and it is its own event. */
    const asked = line.asked ?? '';
    if (asked && !line.corrected && read.name && foldWord(read.name.said) === foldWord(asked)) {
      correctFill(sale, now, line);
      return;
    }
    /* ⚠ NO GRADE IS WRITTEN (FEED-IA §197.2): a grade word claims nothing in the parser now, so
       it arrives as one of THEIR words and rides the name through `ridesOf` below (§41.5). */
    for (const [id, word] of Object.entries(read.dimensions)) {
      if (word && word !== line.dimensions?.[id as DimensionId]) {
        setDimension(sale, now, line.id, id as DimensionId, word);
      }
    }
    if (read.quantity !== undefined && read.quantity !== line.given) {
      beginAlbaranCorrection(sector, sale);
      editLine(sale, now, line.id, { given: read.quantity });
    }
    if (read.unit && read.unit !== line.unit && flipUnitsOf(line.product).includes(read.unit)) {
      beginAlbaranCorrection(sector, sale);
      flipUnit(sale, now, line, read.unit);
    }
    /* THEIR WORDS THAT NOTHING CLAIMED RIDE THE NAME (§41.5), in THEIR order. */
    const rides = ridesOf(read);
    if (rides !== (line.amendment ?? '')) amendLine(sale, now, line.id, rides);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      {/* ── THE SENTENCE (§62), IN `within:` MODE — AND IT IS THE WHOLE EDITOR (§109.5) ──────
          The organ carries its own face, so nothing here draws a second one beside it: what used
          to be a 44px `ProductFace` outside the row is the organ's own fixed seat, and the
          painting resolving is a change of PICTURE rather than of layout (§59.1).

          ⚠ THE LABELLED ROW THAT STOOD UNDER THIS IS GONE (§109.5). Quantity · Unit · Price, three
          boxes with three captions, on the row's own ground: «the editor is never a form beside the
          row». Every one of those values is a seat on the row itself now, one press away, wearing
          the same underline as the rest — and the rate, which had no other road in, got its own
          instrument on the row with them (§109.6). */}
      <div data-testid={`word-field-${line.id}`} style={{ minWidth: 0 }}>
        <ChipEntry
          registers={withinRegisters}
          initial={said}
          autoFocus
          placeholder={line.product.name}
          data-testid={`line-chips-${line.id}`}
          onCommit={land}
        />
      </div>

      {/* THE FOOT OF THE EDITOR: DOORS, AND NOTHING ELSE (§51.7, §51.24). «Arrows walk the fields.
          The sort rides the name and prints on the albarán» taught a keyboard trick and restated a
          rule, on every line a person opens. Both are instructions about the row rather than facts
          about the goods, which is the orphan shape this method kills. */}
      <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ flex: '1 1 auto', minWidth: 0 }} />
        {/* THE DOOR TO THE GOODS THEMSELVES (§2's product card, §43's object law). The resting
            name opens this editor, so the card's door stands here, beside the words it is about. */}
        <Button
          kind={KIND.tertiary}
          size={SIZE.mini}
          data-testid={`open-card-${line.id}`}
          onClick={() => onOpenCard(line.product)}
        >
          Open {line.product.name}
        </Button>
        {line.amendment && (
          <Button
            kind={KIND.tertiary}
            size={SIZE.mini}
            data-testid={`unamend-${line.id}`}
            onClick={() => amendLine(sale, now, line.id, '')}
          >
            Take the word off
          </Button>
        )}
      </div>
    </div>
  );
}

/** HOW MANY DECIMALS AN AMOUNT ACTUALLY HAS, capped at the gram. The Figure takes a fixed count,
 *  and a quantity drawn as «12,000 kg» at the pack posture's size is three digits of noise in the
 *  slot the bay reads first. */
const LINE_QUANTITY_DECIMALS = 3;
const LINE_QUANTITY_MIN = 0.001;
const LINE_QUANTITY_MAX = 999999.999;

const qtyDecimals = (n: number): number => {
  const s = Math.round(n * (10 ** LINE_QUANTITY_DECIMALS)) / (10 ** LINE_QUANTITY_DECIMALS);
  if (Number.isInteger(s)) return 0;
  if (Number.isInteger(s * 10)) return 1;
  if (Number.isInteger(s * 100)) return 2;
  return 3;
};

/** Every anchored line editor ends the same way. Save is the deliberate write; Cancel closes the
 *  instrument without letting a blur turn a half-written value into document history. */
function LineEditorActions({ onSave, onCancel, saveTestid, disabled = false, saveLabel = 'Save' }: {
  onSave: () => void;
  onCancel: () => void;
  saveTestid: string;
  disabled?: boolean;
  saveLabel?: string;
}) {
  const [, theme] = useStyletron();
  const target = { minHeight: '44px', minWidth: '72px' };
  return (
    <div data-line-editor-actions="yes" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
      <Button kind={KIND.tertiary} size={SIZE.compact} data-testid={`${saveTestid}-cancel`} onClick={onCancel}
        overrides={{ BaseButton: { style: target } }}>Cancel</Button>
      <Button kind={KIND.primary} size={SIZE.compact} data-testid={saveTestid} disabled={disabled} onClick={onSave}
        overrides={{ BaseButton: { style: target } }}>{saveLabel}</Button>
    </div>
  );
}

/** §138 / §142: the lote is the batch reference written on the box. Free text, kept on this line. */
function LotField({ cast, sale, line, sales, now, onDone }: {
  cast: Cast; sale: Sale; line: SaleLine; sales: Sale[]; now: string; onDone: () => void;
}) {
  const [, theme] = useStyletron();
  const liveBook = useAllocationBook(cast, sales);
  const [reviewBook, setReviewBook] = React.useState(liveBook);
  const candidatesFor = React.useCallback((product: string) => lotsForAllocation(reviewBook, product), [reviewBook]);
  const proposalSale = React.useMemo(() => ({
    ...sale,
    lines: sale.lines.map((candidate) => candidate.id === line.id
      ? { ...candidate, lot: undefined, allocations: undefined }
      : candidate),
  }), [sale, line.id]);
  const proposed = proposeLots(cast, proposalSale, sales, candidatesFor).find((candidate) => candidate.line.id === line.id);
  const candidateRows = React.useMemo(() => {
    const live = candidatesFor(line.product.id);
    const missing = (line.allocations ?? []).filter((allocation) => !live.some((candidate) => candidate.batch === allocation.batch));
    return [...live, ...missing.map((allocation) => ({ batch: allocation.batch, code: allocation.code ?? allocation.batch, available: 0, receivedAt: Number.MAX_SAFE_INTEGER }))];
  }, [candidatesFor, line.allocations, line.product.id]);
  const baseline = line.allocations ?? proposed?.allocations ?? [];
  const [shares, setShares] = React.useState<LotShare[]>(() => baseline.map((allocation) => ({
    key: allocation.batch,
    lotId: allocation.batch,
    code: allocation.code ?? candidateRows.find((candidate) => candidate.batch === allocation.batch)?.code ?? allocation.batch,
    quantity: String(allocation.qty),
    existing: true,
  })));
  const [reason, setReason] = React.useState(line.allocationOverrideReason ?? '');
  const [error, setError] = React.useState('');
  const lots: RecordedLot[] = candidateRows.map((candidate) => ({ id: candidate.batch, code: candidate.code, left: candidate.available }));
  const split = splitState(shares, line.given, lots, true);
  const allocations = shares.filter((share) => lotNumber(share.quantity) > 0).map((share) => ({
    batch: share.lotId,
    code: candidateRows.find((candidate) => candidate.batch === share.lotId)?.code ?? share.code,
    qty: Math.round(lotNumber(share.quantity) * 100) / 100,
  }));
  const changed = !sameAllocation(baseline, allocations);
  const stale = liveBook.revision !== reviewBook.revision;
  const valid = split.valid && Math.abs(split.unassigned) < 0.000001 && (!changed || !!reason.trim()) && !stale;
  const put = () => {
    if (!valid) return;
    const saved = attachLots(sale, now, [{
      line: line.id,
      allocations,
      overrideReason: changed ? reason.trim() : line.allocationOverrideReason,
      stockRevision: reviewBook.revision,
    }]);
    if (!saved) {
      setError('Saving this allocation stalled. Your choices are still here.');
      return;
    }
    onDone();
  };
  return (
    <div data-testid={`lot-field-${line.id}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
      <div>
        <span style={theme.typography.LabelSmall}>Allocate lots</span>
        <p style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, margin: `${theme.sizing.scale100} 0 0` }}>Choose from recorded stock. One line can use several lots.</p>
      </div>
      {stale && <div role="alert" data-testid={`line-lot-stale-${line.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300, flexWrap: 'wrap', padding: theme.sizing.scale300, border: `1px solid ${theme.colors.negative400}`, borderRadius: theme.borders.radius300 }}>
        <span style={theme.typography.ParagraphSmall}>Stock changed. Your split is still here.</span>
        <Button kind={KIND.secondary} size={SIZE.compact} onClick={() => { setReviewBook(liveBook); setError(''); }}>Review latest stock</Button>
      </div>}
      <LotSplitEditor total={line.given} unit={line.unit} lots={lots} shares={shares} onChange={setShares} context="allocate" />
      {changed && <label style={theme.typography.LabelSmall}>Why use a different split?
        <Input value={reason} placeholder="For example: opened crate first" onChange={(event) => setReason(event.currentTarget.value)} overrides={{ Input: { props: { 'data-testid': `line-lot-reason-${line.id}`, 'aria-label': `Reason for changing FIFO on ${line.product.name}` } } }} />
      </label>}
      {split.unassigned > 0 && <span role="status" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{amountWords(split.unassigned)} {line.unit} still needs a recorded lot.</span>}
      {error && <span role="alert" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{error}</span>}
      <LineEditorActions onSave={() => { if (stale) setError('Review the latest stock before saving.'); else put(); }} onCancel={onDone} saveTestid={`lot-put-${line.id}`} disabled={!valid} />
    </div>
  );
}

/* ── THE CLASS FIELD IS GONE (FEED-IA §197.2 «Remove class everywhere», §193.4) ───────────────
 * A `ClassField` stood here — a Combobox over the family's closed grade register plus this
 * product's own past, with an «Internal class» input and a tooltip explaining that the customer
 * never sees it. §193.4 read the whole thing top-down and found it had no subject: any named grade
 * the market sells by is in the SKU, and what is ours to know is WHEN the goods came in, which is
 * the lot. So the register, the field, the popover branch and the `line-class` seat all left
 * together; the lot's own field below is what the seat beside it became.
 */

/** §168: quantity and the line Unit are independent facts, each edited at its own value.
 * A quantity edit never rewrites the unit. The existing line fold reprices a changed unit only
 * from a declared equivalence; an unknown custom unit deliberately requires its own price. */
/** ONE reading of a typed quantity (§192.2 shares it between the seat's inline input and the
 *  packing scale's field) — the words are the field's own and they never fork. */
function parseLineQuantity(raw: string): { number: number; error: string } {
  const compact = raw.trim().replace(/\s/g, '');
  if (!compact) return { number: Number.NaN, error: 'Enter a quantity.' };
  if (/[eE]/.test(compact)) return { number: Number.NaN, error: 'Use a plain number.' };
  if (!/^-?\d+(?:[.,]\d+)?$/.test(compact)) return { number: Number.NaN, error: 'Use a number, for example 12 or 12,5.' };
  const number = Number(compact.replace(',', '.'));
  if (!Number.isFinite(number)) return { number, error: 'Use a number, for example 12 or 12,5.' };
  if (number <= 0) return { number, error: 'Quantity must be greater than zero.' };
  if (number < LINE_QUANTITY_MIN) return { number, error: `The smallest quantity is ${LINE_QUANTITY_MIN}.` };
  if ((compact.split(/[.,]/)[1]?.length ?? 0) > LINE_QUANTITY_DECIMALS) return { number, error: `Use up to ${LINE_QUANTITY_DECIMALS} decimal places.` };
  if (number > LINE_QUANTITY_MAX) return { number, error: `The largest quantity is ${LINE_QUANTITY_MAX.toLocaleString('en-US')}.` };
  return { number, error: '' };
}
function QuantityField({ sale, line, scope, now, onDone }: {
  sale: Sale; line: SaleLine; scope: string; now: string; onDone: () => void;
}) {
  const [, theme] = useStyletron();
  const [amount, setAmount] = React.useState(line.unreadable ? '' : amountWords(line.given));
  const quantity = parseLineQuantity(amount);
  const valid = !quantity.error;
  const put = () => {
    if (!valid) return;
    if (quantity.number !== line.given) beginAlbaranCorrection(scope, sale);
    editLine(sale, now, line.id, { given: quantity.number });
    onDone();
  };
  const errorId = `quantity-error-${line.id}`;
  return (
    <div data-testid={`quantity-field-${line.id}`} data-min={LINE_QUANTITY_MIN} data-max={LINE_QUANTITY_MAX}
      data-decimals={LINE_QUANTITY_DECIMALS} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
      <label htmlFor={`quantity-input-${line.id}`} style={theme.typography.LabelXSmall}>{sale.printed ? 'Actual quantity' : 'Quantity'}</label>
      <Input id={`quantity-input-${line.id}`} value={amount} size={SIZE.compact} autoFocus aria-label={sale.printed ? 'Actual quantity' : 'Quantity'}
        error={Boolean(quantity.error)}
        onChange={(e) => setAmount((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); put(); } }}
        overrides={{ Input: { props: { 'data-testid': `quantity-write-${line.id}`, inputMode: 'decimal', 'aria-invalid': Boolean(quantity.error), 'aria-describedby': quantity.error ? errorId : undefined } } }} />
      {quantity.error && <span id={errorId} data-testid={errorId} role="alert"
        style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{quantity.error}</span>}
      <LineEditorActions onSave={put} onCancel={onDone} saveTestid={`amount-put-${line.id}`} disabled={!valid} />
    </div>
  );
}

function UnitField({ sale, line, sector, scope, now, onDone }: {
  sale: Sale; line: SaleLine; sector: SectorId; scope: string; now: string; onDone: () => void;
}) {
  const [, theme] = useStyletron();
  useUnits();
  const [unit, setUnit] = React.useState(line.unit);
  const [equivalence, setEquivalence] = React.useState('');
  const customFactor = equivalence.trim() ? Number(equivalence.replace(',', '.')) : undefined;
  const validFactor = customFactor === undefined || (Number.isFinite(customFactor) && customFactor > 0);
  const choices = [...new Set([line.unit, ...unitChoices(sector, line.product)])];
  const known = conversion(sector, line.product, unit.trim());
  const description = describeUnit(sector, line.product, unit.trim());
  const factor = known.factor;
  const [error, setError] = React.useState('');
  const put = () => {
    if (!unit.trim() || !validFactor) return;
    if (unit.trim() !== line.unit || (customFactor !== undefined && customFactor !== line.unitFactor)) beginAlbaranCorrection(scope, sale);
    if (!saveLineEdit(sale, now, line.id, { unit: unit.trim(), ...(customFactor !== undefined ? { unitFactor: customFactor } : {}) })) {
      setError('Saving this unit stalled. Your draft is still here. Try again.'); return;
    }
    onDone();
  };
  return (
    <div data-testid={`unit-field-${line.id}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
      <span style={theme.typography.LabelXSmall}>Unit</span>
      <Combobox value={unit} options={choices.filter((v) => unit === line.unit || v.toLowerCase().includes(unit.toLowerCase()))}
        mapOptionToString={(v: string) => v} listBoxLabel="Product and company units" size={SIZE.compact}
        onChange={(next: string) => { setUnit(next); setEquivalence(''); setError(''); }}
        onSubmit={({ closeListbox }: { closeListbox: () => void }) => { closeListbox(); put(); }}
        overrides={{ Input: { props: { autoFocus: true, placeholder: 'Unit', overrides: { Input: { props: { 'data-testid': `unit-write-${line.id}`, 'aria-label': 'Unit, recommended or custom' } } } } } }} />
      <span data-testid={`unit-equivalence-${line.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
        {unit.trim() && unit.trim() !== line.product.unit
          ? known.state === 'nominal' ? 'Approximate contents. Enter the measured weight for this delivery.'
            : known.state === 'catch-weight' ? 'Weight varies. Enter the measured weight for this delivery.'
            : factor === null ? 'This unit keeps its own quantity; add a conversion to relate it.' : `1 ${unit.trim()} = ${amountWords(factor)} ${line.product.unit}`
          : `Measured in ${line.product.unit}`}
      </span>
      {unit.trim() !== line.product.unit && <label style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, ...theme.typography.LabelXSmall }}>
        1 {unit.trim() || 'unit'} equals ({line.product.unit})
        <Input value={equivalence} onChange={(e) => setEquivalence(e.currentTarget.value)} placeholder={factor === null ? 'Optional exact equivalence' : String(factor)} aria-label="Exact unit equivalence" inputMode="decimal" />
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Exact contents for this line only. Quantity stays unchanged.</span>
      </label>}
      <LineEditorActions onSave={put} onCancel={onDone} saveTestid={`unit-put-${line.id}`} disabled={!unit.trim() || !validFactor} />
      {description.state === 'unknown' && unit.trim() && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Custom unit for this line. Its package contents are yours to state.</span>}
      {error && <span role="alert" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{error}</span>}
    </div>
  );
}

/* ── THE COLUMN PLAN (FEED-IA §194.2) ─────────────────────────────────────────────────────────
 * «we have like 6 digits in some stuff, and units that use like 6 letters like manojo … and skus
 * that are like 40 characters. it STILL has to look and fit good and well planned like when its
 * short so think strategically where to put everything.»
 * The terminal's columns are sized ONCE PER DOCUMENT from the longest value on the sheet — so a
 * «4 kg» line and a «12.500,5 unidades» line on the same albarán put their figures in the same
 * columns and the sheet reads down like an invoice. The name is the only thing that wraps. On a
 * phone the plan also decides the figure's step (a six-digit total keeps its one line by taking
 * the compact step, the way a banking app shrinks a long balance) and whether the row's tail can
 * share the values' line or must take its own. The plan is a pure function of the document, so
 * every line on the sheet computes the same one. */
type ColumnPlan = { qtyCh: number; unitCh: number; totalCh: number; figure: 'default' | 'compact'; tailShares: boolean; gapPx: 20 | 12; wraps: boolean };
/* THE TYPE'S OWN WIDTHS — one tabular digit at the figure's step and one letter of the unit at the
 * step's sub, calibrated against the rendered «12.500,5 unidades» at 390 (80px + 82px measured).
 * They moved to `row-plan.ts` when the read-back review began planning the same kind of column
 * over the same faces (E196.30): a second copy of a calibration drifts at the first type change.
 * The arithmetic below is unchanged — only where the three numbers are written has moved. */
type ColumnPlanFull = ColumnPlan & { valuesPx: number; stacks: boolean };
/** `room` is what the card gives the values' line: its inner width less the face and its gap.
 *  Measured where a card exists; a phone that has not measured yet falls back to its viewport. */
function columnPlanOf(lines: SaleLine[], pricesVisible: boolean, phone: boolean, room: number, tailPx: number): ColumnPlanFull {
  const priced = lines.filter((l) => pricesVisible && !l.freebie && !l.unreadable && l.price > 0);
  const qtyCh = Math.max(2, ...lines.map((l) => (l.unreadable ? 0 : amountWords(l.given).length)));
  const unitCh = Math.max(2, ...lines.map((l) => l.unit.length));
  const totalCh = priced.length ? Math.max(...priced.map((l) => amountWords(l.given * l.price).length)) + 2 : 0;
  const widthAt = (figure: ColumnPlan['figure'], gap: number) =>
    qtyCh * LINE_FIGURE_PX[figure] + 8 + 4 + unitCh * LINE_UNIT_PX[figure] + 8
    + (totalCh ? gap + totalCh * LINE_FIGURE_PX[figure] : 0);
  /* a phone may take the compact step to keep one line; a desk keeps the step and stacks instead.
     §195: a tight plan closes its column gap (20 → 12) BEFORE it ever wraps — the gap is air, the
     figures are the fact. */
  const figure: ColumnPlan['figure'] = phone && widthAt('default', 20) > room ? 'compact' : 'default';
  const gapPx: ColumnPlan['gapPx'] = widthAt(figure, 20) > room ? 12 : 20;
  const valuesPx = widthAt(figure, gapPx);
  /* §195: when even the compact step with the closed gap cannot hold one line, the WHOLE document
     takes the wrapped posture — the money under the quantity on every priced line — so a sheet
     never mixes one-line and two-line rows. A width the plan never saw still wraps by CSS. */
  /* CALIBRATION MARGIN: the rendered «12.500,5 unidades · 123.379,93 €» measured 300px against an
     estimate of 287 at 390 — separators, fraction digits and button padding round up. The plan
     decides against reality with that margin, so one line on a sheet never wraps alone. */
  const wraps = phone && totalCh > 0 && valuesPx + LINE_PLAN_MARGIN > room;
  /* A DESK STACKS WHEN THE ONE-LINE ROW CANNOT HOLD name + values + tail (§194.2): the name's
     floor, the values, the tail and the gaps between them must fit the room, else the line
     takes the phone's own posture — identity full width, values beneath at the right. */
  const stacks = !phone && valuesPx + LINE_PLAN_MARGIN + LINE_IDENTITY_MIN + tailPx + 24 > room;
  /* on a stacked line the tail may share the values' line when both fit */
  /* E193.22: a phone's tail stands at the card's top-right (§109.7's right, checkout-grade), so it
     never shares the values' line; only a stacked desk line may seat it beside the values */
  const tailShares = stacks ? valuesPx + tailPx + 12 <= room : false;
  return { qtyCh, unitCh, totalCh, figure, tailShares, valuesPx, stacks, gapPx, wraps };
}
/** the card's own width, live (ResizeObserver) — the plan asks the room it really has */
function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const read = () => setWidth(Math.round(node.getBoundingClientRect().width));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
/** the viewport's width, live — the plan is a phone question and a phone turns */
function useViewportWidth(): number {
  const [width, setWidth] = React.useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth));
  React.useEffect(() => {
    const read = () => setWidth(window.innerWidth);
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return width;
}

function Line({
  cast,
  sale,
  sales,
  line,
  index,
  editable,
  register,
  picking,
  ticked,
  now,
  enter,
  onOpenCard,
}: {
  cast: Cast;
  sale: Sale;
  /** the day, so «this word rides that product four times today» is a fact and not a guess */
  sales: Sale[];
  line: SaleLine;
  index: number;
  editable: boolean;
  /** which posture the document is being read in (§23) */
  register: Register;
  /** the bay is walking this order, so every line takes a tick of its own (§7.2) */
  picking: boolean;
  ticked: boolean;
  now: string;
  /** THE KEYBOARD WALKED IN FROM THE PILE (checkpoint §14.2b). Only the line the document opens on
   *  is ever handed it, so Enter lands in one place and a person always knows where they are. */
  enter?: number;
  /** the door to what the line is ABOUT — the goods themselves (§2's product card) */
  onOpenCard: (product: Product) => void;
}) {
  const [css, theme] = useStyletron();
  const phone = usePhone();
  const { config } = useConfig();
  const grants = useGrants();
  const { pricing: pricingAvailable, inventory } = useWorkspaceCapabilities();
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  const pricesVisible = pricingAvailable;
  const viewport = useViewportWidth();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const cardWidth = useElementWidth(cardRef);
  /* the card's inner width less the face and its gap; before the first measure, the viewport's own */
  const room = (cardWidth > 0 ? cardWidth - 24 : viewport - 40) - 60;
  /* §197.3: on a desk the tail is ONE column — the note above the bin — so the row gives the
     identity 48px back; a phone keeps the two side by side on the values' line. */
  /* E193.22: on a phone the tail is ONE 44px «more» seat at the card's top-right that opens the
     line's two acts (note, remove); a desk stacks the pen above the bin in its own column */
  const tailPx = ROW_TAIL;
  const plan = React.useMemo(() => columnPlanOf(sale.lines, pricesVisible, phone, room, tailPx), [sale.lines, pricesVisible, phone, room, tailPx]);
  const figureType = plan.figure === 'default' ? theme.typography.LabelLarge : theme.typography.LabelMedium;
  const unitType = plan.figure === 'default' ? theme.typography.LabelSmall : theme.typography.LabelXSmall;
  /* A phone always reads identity before figures. On a desk, ordinary product names keep the
     compact tabular row; unusually long source or product text takes the same stacked posture so
     fixed numeric columns never squeeze words into a vertical ribbon. */
  const quantityWord = line.unreadable ? 'To confirm' : `${amountWords(line.given)} ${line.unit}`;
  /* stackedLine moved below — §192.1's two money columns are part of what decides the posture,
     so the question is asked after the money facts are known. */
  const catalogue = useCatalogue();
  /* WHICH VALUE IS OPEN (§31.3) — never «the line is in edit mode», because the line never is. */
  const [field, setField] = React.useState<LineField | null>(null);
  const [fieldTarget, setFieldTarget] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<number | null>(null);
  /* THE GHOST NOTE TARGET IS REVEALED BY THE POINTER (§6, §31.3). A desk has one; a thumb has
     none, so on touch the whisper stands at rest — the same rule every editable value keeps. */
  const [over, setOver] = React.useState(false);
  /* THE NOTE ITSELF, off the line the ledger folded (§6, the seam closed) */
  const prep = line.prepNote ?? '';
  const customerNote = customerOptionText(line);
  /* §197.3 «the "comment" thing is a note. not note and comment» — ONE note per line: the packing
     note the line carries, or, where an approved customer option already stands, its words. */
  const noteText = prep || customerNote || '';
  const [noteDraft, setNoteDraft] = React.useState('');
  const putNote = (word: string) => { noteLine(sale, now, line.id, word.trim().slice(0, 100)); };
  useDismissals();
  const lineConcerns = standingConcernsOf(sale).filter((concern) => concern.kind === 'check' && concern.line?.id === line.id && !dismissedNow(sale.id, concern.id));
  const quantityConcern = lineConcerns.find((concern) => concern.id === `flag:unreadable-${line.id}` || concern.id === `flag:unusual-${line.id}`);
  const supportingConcerns = lineConcerns.filter((concern) => concern !== quantityConcern);
  const skuChoices = React.useMemo(() => {
    const baseId = graduatedBase(line.product.id) ?? line.product.id;
    const amendmentChoices = amendmentsOf(config.cast, catalogue.state)
      .filter((amendment) => amendment.base === baseId && Boolean(amendment.hand || amendment.sellable))
      .map((amendment) => amendmentProduct(cast, amendment));
    const grownChoices = graduatedProducts(cast, catalogue.state)
      .filter((product) => graduatedBase(product.id) === baseId);
    return [line.product, ...amendmentChoices, ...grownChoices]
      .filter((product, index, all) => all.findIndex((candidate) => candidate.id === product.id) === index);
  }, [cast, catalogue.state, config.cast, line.product]);
  const skuChoiceNeeded = Boolean(line.asked && line.filledBy === 'model' && !line.corrected && !line.skuChosen && !line.nonSku && skuChoices.length > 1);
  // Acknowledgement follows an actual resolved concern, never an unrelated click or dismissal.
  /* ⚠ THE GRADE LEFT THIS EVIDENCE (FEED-IA §197.2): nothing can change a fact the app does not hold. */
  const evidence = JSON.stringify([line.product.id, line.given, line.unit, line.price, line.lot, line.prepNote, sale.prep?.at, sale.prep?.staleLines]);
  const previousConcerns = React.useRef({ evidence, ids: lineConcerns.map((c) => c.id) });
  const [acknowledged, setAcknowledged] = React.useState(false);
  React.useEffect(() => {
    const before = previousConcerns.current;
    if (before.evidence !== evidence && before.ids.some((id) => !lineConcerns.some((c) => c.id === id) && !dismissedNow(sale.id, id))) setAcknowledged(true);
    previousConcerns.current = { evidence, ids: lineConcerns.map((c) => c.id) };
  }, [evidence, lineConcerns.map((c) => c.id).join('|'), sale.id]);


  React.useEffect(() => { if (!editable) setField(null); }, [editable]);
  React.useEffect(() => { if (!inventoryAvailable && field === 'lot') setField(null); }, [field, inventoryAvailable]);

  /* ── ENTER OPENS THE LINE (checkpoint §14.2b) ─────────────────────────────────────────────
   * The press came from the river's own listener, two panes away, and it lands here: the value row
   * opens on `name` — the field ring — and `Fields` puts the caret on the first thing that can be
   * written. A document that takes no changes takes no keyboard either; there is nothing to type
   * into and opening an editor that refuses every key is a promise the surface cannot keep. */
  React.useEffect(() => {
    if (!enter || !editable) return;
    setField('name');
  }, [enter, editable]);

  /* ESC RELEASES THE INNERMOST THING FIRST (FEED-IA §32.A) ─────────────────────────────────
   * The sweep's own Esc walks outward — an open editor, then the narrow, then nothing — and this
   * is the innermost step, owned by the thing it closes. The surface's handler stands down while
   * any value is open (it reads `[data-editing]` off the document), so the two never both fire and
   * a person mid-edit can never release a filter by accident. */
  React.useEffect(() => {
    if (field === null) return;
    const out = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      setField(null);
    };
    window.addEventListener('keydown', out);
    return () => window.removeEventListener('keydown', out);
  }, [field]);

  /* THE UNITS TRIPLE (THE-INTELLIGENCE §3). The chips exist where the product has a conversion,
     and the arithmetic stands beside them — never hidden behind the word. */
  const graduation = graduationOf(sales, line);
  /* THE LINE STATES THE DATUM; THE ANNOTATION STATES THE FLAG. «check the quantity · 10× their
     usual» printed at both altitudes is the same six words twice inside a thumb's width on a
     phone. So the alert lives once, in the notes under the card, and the line carries the number
     the alert is ABOUT — what this customer usually takes — right beside the number in question,
     which is where a person actually decides. */
  const usual = line.usual && line.usual > 0 ? ` · they usually take ${qtyWords(line.usual, line.unit)}` : '';
  /* EDITED: the Figure strikes what it replaced. `ordered` is what the customer asked for, so a
     line the scale or a hand has moved states both numbers and the direction between them. */
  const moved = !line.unreadable && line.given !== line.ordered;
  const weighed = weighsOnScale(line);
  /* ── THE PACK POSTURE, ON THE LINE (§23) ────────────────────────────────────────────────────
   * «The lines are a CHECKLIST: per-line tick first-class, quantities BIG (readable at arm's
   * length with wet hands), the class and lot visible, and tapping a weighed line opens Weight
   * Entry directly.» So the SLOT does not move and the CONTENT does: where the answering document
   * puts what the line comes to in soles, the picking one puts what the person has to put in the
   * crate — at two steps up the ramp, because that is the number a wet hand is reading from a
   * metre away. The money is still on the document, at its foot, where a total belongs. */
  const packing = register === 'pack';

  /** THE AMOUNT, ON THE LINE. Both routes end here, so the number lands the same way whether the
   *  scale said it or a thumb counted it. */

  /** THE RATE'S FIELD HOLDS CHARACTERS, NOT A NUMBER — the same scar the amount's seat carries:
   *  bound straight to the price, «16,7» was read at «16,» and the separator was eaten under the
   *  caret. The seat keeps what was typed; the line keeps what it parses to. */
  const [rateText, setRateText] = React.useState('');
  React.useEffect(() => {
    if (field === 'rate') setRateText(line.price > 0 ? amountWords(syntheticAmountForCountry(line.price, workspaceCapabilitiesNow().country)) : '');
  }, [field, line.price]);

  /** Editing a document changes this line alone; tariff-wide writes belong to product pricing. */
  const rateChosen = React.useRef(false);
  const putPrice = (word: string, canonical = false) => {
    const typed = Number(word.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(typed) || typed <= 0) return;
    const stored = canonical ? typed : canonicalSyntheticAmount(typed);
    if (Math.round(stored * 100) === Math.round(line.price * 100)) return;
    beginAlbaranCorrection(config.cast, sale);
    editLine(sale, now, line.id, { price: stored });
  };

  /* §192.2: the quantity's own seat is the editor — the same words the popover field kept, held
   * here so the caret can land the moment the value is pressed. The seat keeps what was typed;
   * the line keeps what it parses to (the same law the rate's seat settled). */
  const [qtyText, setQtyText] = React.useState('');
  React.useEffect(() => {
    if (field === 'amount') setQtyText(line.unreadable ? '' : amountWords(line.given));
  }, [field, line.given, line.unreadable]);
  const putQuantity = (word: string): boolean => {
    const read = parseLineQuantity(word);
    if (read.error) return false;
    if (read.number !== line.given) beginAlbaranCorrection(config.cast, sale);
    editLine(sale, now, line.id, { given: read.number });
    return true;
  };

  const putWeight = (kilos: number) => {
    const before = line.unit === 'kg' ? line.given : line.finalWeight;
    if (before !== kilos) beginAlbaranCorrection(config.cast, sale);
    putFinalWeight(sale, now, line, kilos);
  };

  /* THE NOTES THIS LINE CARRIES. Gathered once, so the margin draws only when there is something
     in it — an empty rule under every line would be the drowning §14 names, in hairlines. */
  const filled = fillWords(sale, line);
  const askedQty = askedQtyWords(line);
  const lots = inventoryAvailable && Boolean(line.allocations && line.allocations.length > 1);
  /* AND IN THE PACK POSTURE THE MARGIN CARRIES ONLY WHAT THE CRATE NEEDS (§23: «comms and
     annotation step far back»): what the amount replaced, and which batches it came off. What
     Rocoto read a word as, what it would like to promote, and what the catalogue makes of it are
     the desk's questions, and they are one flip away. */
  /* A scoped check is an annotation, not marginalia. It sits immediately before the red target:
     the quantity's own field, or the complete row when it is about the line. */
  const worried = supportingConcerns.length > 0;
  const notes = packing
    ? moved || lots
    : worried ||
      moved ||
      filled ||
      askedQty ||
      (graduation && editable) ||
      line.graduated ||
      (line.nonSku && !line.adopted && editable) ||
      lots;

  /** the marks that a pointer alone used to reveal — the underline is at rest for everybody now
   *  (§51.14), and this is what is left: the row's own quiet acts, which are not values */
  const whisper = phone;
  /* ── THE FACTS LINE'S ORDER IS LAW (FEED-IA §109.3) ─────────────────────────────────────────
   * «A good designer would say price should always appear on this certain side, quantity on a
   * certain side» — and below the name, «class first, then lot, class·lot always LAST».
   *
   * So the line under the name reads: THE AMOUNT in its own constant seat, then whatever this
   * particular line happens to carry (its dimensions, what the scale said, what this account
   * usually takes, the rate), and it ENDS on the pair. The rate stepped back one place to make
   * room: §84.1 put it last so it stood beside the money it multiplies into, and §109.3 gives the
   * end of the line to the pair in every register the app draws a product-level row in.
   * ⚠ THE PAIR IS ONE FACT NOW (FEED-IA §197.2, §193.4): the class left, the lot stayed. */
  const rated = !packing && !line.freebie && !line.unreadable && line.price > 0;
  const correctingPrintedPaper = Boolean(sale.printed);
  /** A LINE NOBODY HAS PRICED YET — `sale.ts`'s own `priceIsPending`, drawn at last. «A line whose
   *  price is still to come… it is a real state and it says what is coming, not what is absent.»
   *  The row states the gap — an empty rate seat in the money column, ready to be written, one
   *  press like every other value (§109.6) — rather than a confident «0,00 €». */
  const priceless = !packing && !line.freebie && !line.unreadable && line.price <= 0;
  /** whether anything stands before the lot, which is what decides its own separator (§197.2:
   *  the pair is one fact now — the class left, so what remains is the lot) */
  /* ⚠ AND `!packing` WAS A STALE TERM (FEED-IA §111.10, caught by looking). It stood for «the
     answering document draws the AMOUNT before the pair», and the amount left this line for the
     money column two §s ago — so every line on every albarán opened its facts on «· class A»: a
     separator with nothing on its left, which is the same defect the trailing dot was. The
     question is only ever «does anything actually stand before the pair», so that is what it
     asks. */
  const hasPriceFacts = pricesVisible && !packing && !line.freebie && !line.unreadable
    && (line.price > 0 || editable);
  /* A phone always reads identity before figures; a desk stacks only when words would squeeze.
     §192.1's SECOND money column claims real width, so a priced phone line takes the below
     posture too — the identity keeps the full line and the two value columns stand under it,
     right-aligned, exactly where the strike note and the tail already live. */
  const stackedLine = line.product.name.length > 48
    || (line.asked?.length ?? 0) > 48
    || (phone && quantityWord.length > 15)
    || (phone && hasPriceFacts)
    || plan.stacks;
  /* ⚠ AND `hasPriceFacts` LEFT THIS QUESTION WITH THE MONEY (§192.1): the facts line carries no
     rate or total any more, so only the facts that actually stand on it can precede the pair. */
  const precedes = dimensionWords(line).length > 0
    || line.finalWeight !== undefined
    || Boolean(usual);
  /** §142: the instrument opens at its underlined value, without a form below the line. */
  const value = (id: LineField, label: string, testid: string, children: React.ReactNode): React.ReactNode => {
    if (!editable) return children;
    const target = <Editable label={label} testid={testid} minimumTarget={44} fluid={id === 'name'}
      terminal={id === 'amount'}
      open={field === id && (!['amount', 'unit', 'lot'].includes(id) || fieldTarget === testid)}
      onOpen={() => {
        /* §192.2: the seat's text is seeded HERE, in the same tick the press opens it — an effect
           that filled it a render later left the autofocused input empty at the moment it
           selected, so the caret landed after the value and typing APPENDED (caught by the
           drive: «3» on «25» made 253). Seeded before the field opens, select-on-focus selects
           the whole figure and typing replaces it. */
        if (id === 'amount') setQtyText(line.unreadable ? '' : amountWords(line.given));
        if (id === 'rate') setRateText(line.price > 0 ? amountWords(line.price) : '');
        setFieldTarget(testid); setField((v) => v === id && fieldTarget === testid ? null : id);
      }}>{children}</Editable>;
    if (id !== 'amount' && id !== 'unit' && id !== 'lot') return target;
    /* §192.2: on a working line the quantity's editor is the seat itself — the press swaps the
       figure for a focused input, so no instrument opens. The packing posture keeps its scale. */
    if (id === 'amount' && !packing) return target;
    return (
      <Popover isOpen={field === id && fieldTarget === testid} placement={PLACEMENT.auto} autoFocus={false}
        onClickOutside={() => setField(null)} onEsc={() => setField(null)}
        overrides={{ Body: { style: { zIndex: LAYER + 4, maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto' } } }}
        content={() => (
          <div data-testid={`line-editor-${line.id}`} data-field={id}
            style={{ width: phone ? 'calc(100vw - 24px)' : 320, maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box',
              marginLeft: phone ? 28 : 0, padding: theme.sizing.scale500 }}>
            {id === 'amount' ? <QuantityField sale={sale} line={line} scope={config.cast} now={now} onDone={() => setField(null)} />
              : id === 'unit' ? <UnitField sale={sale} line={line} sector={config.cast} scope={config.cast} now={now} onDone={() => setField(null)} />
              : <LotField cast={cast} sale={sale} line={line} sales={sales} now={now} onDone={() => setField(null)} />}
          </div>
        )}>{target}</Popover>
    );
  };

  return (
    <div
      ref={cardRef}
      data-line={line.id}
      data-line-index={index}
      data-concern-boundary={supportingConcerns.length || quantityConcern ? 'standing' : undefined}
      data-line-state={skuChoiceNeeded ? 'choose-sku' : line.nonSku && !line.adopted ? 'one-off' : undefined}
      data-testid={`line-card-${line.id}`}
      data-list-card="inset"
      data-editing={field ?? 'no'}
      data-moved={moved ? 'yes' : 'no'}
      data-prep={prep ? 'yes' : 'no'}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale300,
        boxSizing: 'border-box',
        width: `calc(100% - ${theme.sizing.scale400})`,
        margin: `${theme.sizing.scale100} ${theme.sizing.scale200}`,
        padding: `${packing ? theme.sizing.scale500 : theme.sizing.scale400} ${theme.sizing.scale400}`,
        border: `1px solid ${field || over ? theme.colors.borderOpaque : 'transparent'}`,
        /* §192.4: THE BOUNDARY WRAPS THE WHOLE FLAGGED THING — the concern tab and the row are one
           outlined object, so the outline lives on the card and the note stands INSIDE it. It dies
           with the dismissal, together with the tab (lineConcerns already reads the dismissals). */
        outline: supportingConcerns.length || quantityConcern ? `2px solid ${theme.colors.accent}` : 'none',
        borderRadius: theme.borders.radius400,
        backgroundColor: field || over ? theme.colors.backgroundSecondary : 'transparent',
        boxShadow: field ? `0 8px 22px color-mix(in srgb, ${theme.colors.contentPrimary} 7%, transparent)` : 'none',
        opacity: line.nonSku && !line.adopted && !field && !over ? 0.68 : 1,
        color: line.nonSku && !line.adopted ? theme.colors.contentSecondary : undefined,
        fontStyle: line.nonSku && !line.adopted ? 'italic' : undefined,
        minWidth: 0,
        transitionProperty: 'background-color, border-color, box-shadow, opacity',
        transitionDuration: theme.animation.timing400,
        transitionTimingFunction: theme.animation.easeOutCurve,
        ':hover': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque, opacity: 1 },
        ':focus-within': {
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: theme.colors.borderSelected,
          boxShadow: `0 8px 22px color-mix(in srgb, ${theme.colors.contentPrimary} 7%, transparent)`,
          opacity: 1,
        },
      })}
    >
      {/* ── THE ROW BAND — THE ONE GRAMMAR, ON THE ONE FLOOR (FEED-IA §84.1, §78.4) ──────────
          «The product level shit doesn't follow conventions across the entire product… ONE
          GRAMMAR FOR PRODUCT-LEVEL ROWS, EVERYWHERE — word · facts · PRICE RIGHT on the number's
          line, one height.» The catalogue's member row stands on a 48px floor (`stock.tsx`'s own
          §78.4 comment: «it is 48 and not less»), the door that adds one to a family stands on the
          same 48, and so does this — the albarán's line is the same object at a third altitude and
          a stranger has to read the three as one system (§84.4). The band is MARKED so a drive can
          measure the claim rather than take it on trust: every line on a sheet reports one height,
          and the add-a-line row that joins them reports the same floor. */}
      {/* ── THE CONCERN IS A TAB (FEED-IA §192.4, Peter verbatim: «i want it to be inside the red
          outline, at the top, like a "tab"… not outside the thing we're wrapping, and the dismiss
          button should always be at the right, and should make the red disappear too») ──────────
          The strip bleeds to the card's own edges and takes its top radius, so the outline wraps
          note and row as ONE flagged object with the note as its tab. Completing the dismissal
          clears note, tab and boundary together — the row returns to its plain state and the
          document's own record (the struck previous value) is all that remains. */}
      {(supportingConcerns.length > 0 || quantityConcern) && (
        <span
          data-testid={`line-concern-tab-${line.id}`}
          style={{
            display: 'block',
            margin: `-${packing ? theme.sizing.scale500 : theme.sizing.scale400} -${theme.sizing.scale400} 0`,
            borderTopLeftRadius: theme.borders.radius400,
            borderTopRightRadius: theme.borders.radius400,
            overflow: 'hidden',
            background: `color-mix(in srgb, ${theme.colors.accent} 6%, transparent)`,
            borderBottom: `1px solid color-mix(in srgb, ${theme.colors.accent} 25%, transparent)`,
          }}
        >
          {supportingConcerns.map((concern, i) => (
            <ConcernNote
              key={concern.id}
              sale={sale}
              concern={concern.id}
              says={concern.says}
              now={now}
              tab
              testid={`line-concern-${line.id}${i > 0 ? `-${i}` : ''}`}
            />
          ))}
          {quantityConcern && (
            <ConcernNote sale={sale} concern={quantityConcern.id} says={quantityConcern.says} now={now}
              tab testid={`quantity-concern-${line.id}`} />
          )}
        </span>
      )}
      <div
        data-rowband="line"
        style={{
          display: 'flex',
          /* a stacked line reads top-down, so the face stands with the NAME (§194.2), not adrift
             at the block's middle the way a one-line desk row centres it */
          alignItems: phone || stackedLine ? 'flex-start' : 'center',
          gap: theme.sizing.scale400,
          /* THE LIST'S ONE FLOOR (§109.6 · §77.2 · §84.3). It was `LINE_ROW` — the catalogue's 48,
             which is the family's touch floor and never bound here, because a sheet line carries
             three storeys. Stating the real number is what lets the row a person TYPES into stand
             on exactly the row the line will be, and what makes «the height does not jump» a
             measurement rather than a hope. `LINE_ROW` still governs the 48 the catalogue's own
             rows keep; see `LINE_BAND`'s note for the arithmetic. */
          minHeight: LINE_BAND,
          boxSizing: 'border-box',
          minWidth: 0,
          /* §192.4: the boundary left this band for the CARD, so the concern tab stands inside
             the same outline as the row it is about. */
          borderRadius: theme.borders.radius200,
        }}
      >
        {/* THE LINE-LEVEL TICK, for the person walking the bay with the phone in one hand. It is
            FIRST-CLASS in the pack posture (§23) — the size of a thumb and the first thing on the
            row, because the tick is what the person is there to do. */}
        {picking && (
          <Tick
            on={ticked}
            size={packing ? 32 : 24}
            label={`${line.product.name} picked`}
            testid={`tick-line-${line.id}`}
            onClick={() => (ticked ? unprepareLine(sale, now, line.id) : prepareLine(sale, now, line.id))}
          />
        )}
        {/* THE FACE IS A DOOR (§2's product card, §43's object law). The painting is what the goods
            look like, and what a person means when they want to know about the thing rather than
            about the line — so it opens the product's own card on every line, editable or not, and
            never competes with the name's own editor.
            ONE VISUAL IDENTITY (§43): it is `ProductFace`, the same seat the river, the catalogue,
            the tarifa and the suggestion rows draw. The resolving `Face` stays where ambiguity is
            real — the add path, while the words are still landing on a kind. */}
        {skuChoiceNeeded ? (
          <span data-testid={`sku-choice-face-${line.id}`} aria-hidden="true"
            style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', border: `1px solid ${theme.colors.accent}`, borderRadius: theme.borders.radius200, color: theme.colors.accent }}>
            <Glyph id="catalogue" size={18} />
          </span>
        ) : editable ? (
          <span data-testid={`face-${line.id}`} data-navigation="no" aria-hidden="true"
            style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 48px' }}>
            <ProductFace of={{ ...line.product, sector: cast.sector }} size={48} />
          </span>
        ) : (
          <button
            type="button"
            data-testid={`face-${line.id}`}
            aria-label={`Open ${line.product.name}`}
            onClick={() => onOpenCard(line.product)}
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, flex: '0 0 48px',
            }}
          >
            <ProductFace of={{ ...line.product, sector: cast.sector }} size={48} />
          </button>
        )}
        {/* ── THE VALUES, EACH ITS OWN TARGET (§31.3) ─────────────────────────────────────────
            The row is a row of type. Every fact on it that a person may change is wrapped in the
            editable look and opens ITS OWN instrument — so a tap on the quantity is a scale and a
            tap on the name is the word's dropdown, and neither one summons the other. */}
        <div
          data-testid={`line-${line.id}`}
          style={{
            display: 'grid',
            /* THE NAME GIVES GROUND · THE MONEY KEEPS ITS COLUMN · THE TAIL IS ALWAYS THERE. The
               third track is the row's own quiet lane — the packing-note door over the trash
               (§109.7 + §131.2 + §51.14) — stated in the template so it is layout and not a hover
               surprise. */
            /* Long identities and phone rows stack; ordinary desk rows keep their dense table.
               Either way the numeric terminal remains a bounded grid and the name owns a real
               column rather than collapsing between fixed tracks. */
            gridTemplateColumns: stackedLine
              ? 'minmax(0, 1fr)'
              : phone
                ? `minmax(0, 1fr) minmax(${LINE_TERMINAL_MIN}px, max-content)`
                : `minmax(${LINE_IDENTITY_MIN}px, 1fr) minmax(${LINE_TERMINAL_MIN}px, max-content) ${tailPx}px`,
            alignItems: 'center',
            gap: theme.sizing.scale300,
            flex: 1,
            minWidth: 0,
            borderRadius: theme.borders.radius200,
          }}
        >
          {/* the column STRETCHES (Base's default). Shrink-to-fit here made the name wrap at its
              own content box — «Lubina de / estero» on a row with room to spare. */}
          <span data-line-identity="yes" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0,
            gridColumn: '1',
            /* E193.22: on a phone the tail stands in this cell's top-right corner, so the identity keeps clear of it */
            paddingRight: phone ? `${ROW_TAIL + 4}px` : undefined,
            gridRow: '1', alignSelf: 'start' }}>
            <span data-testid={`line-title-${line.id}`} style={{ ...theme.typography.LabelMedium, minWidth: 0, display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap', overflowWrap: 'anywhere' }}>
              {/* THE NAME CARRIES THE WORD RIDING IT (§2), so they are ONE target: a person who
                  taps either lands on the field that decides both. */}
              {/* A CLOSED DOCUMENT HAS NO EDITOR, SO ITS NAME IS THE CARD'S DOOR. On an open one the
                  name opens the word's own field (§31.3) and the card's door stands inside it. */}
              {skuChoiceNeeded ? (
                <span data-testid={`sku-choice-source-${line.id}`}
                  style={{ display: 'inline-flex', alignItems: 'center', padding: `0 ${theme.sizing.scale200}`, border: `1px solid ${theme.colors.accent}`, borderRadius: theme.borders.radius100, color: theme.colors.accent, fontStyle: 'italic' }}>
                  {line.asked}
                </span>
              ) : editable ? (
                value('name', 'The name on this line', `line-name-${line.id}`, <LineName line={line} />)
              ) : (
                <button
                  type="button"
                  data-testid={`line-name-${line.id}`}
                  aria-label={`Open ${line.product.name}`}
                  onClick={() => onOpenCard(line.product)}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    minWidth: 0,
                  }}
                >
                  <LineName line={line} />
                </button>
              )}
            {/* §197.3: the note's one door is the pen in the tail; no second word beside the title */}
              {pricesVisible && line.freebie && (
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}> · free of charge</span>
              )}
              {/* THE NON-SKU LABEL — ink, quiet, and on the line itself as well as on the card. */}
              {line.nonSku && (
                <span
                  data-testid={`non-sku-${line.id}`}
                  style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, fontStyle: 'italic' }}
                >
                  {' '}· {line.adopted ? NON_SKU_ANSWER[line.adopted] : NON_SKU_LABEL}
                </span>
              )}
            </span>

            {/* §143: note door beside the title; written note stays indented below. */}

            <span
              data-testid={`line-facts-${line.id}`}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: theme.sizing.scale200,
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentSecondary,
                minWidth: 0,
              }}
            >
              {/* the amount and its unit share one line, always — and in the pack posture that line
                  IS the big figure in the trailing slot, so the sub-line keeps what a picker still
                  has to read off it: the class in the crate and the batch it came off */}
              {/* THE SEPARATOR BELONGS TO WHAT FOLLOWS, NEVER TO THE AMOUNT. Every block on this
                  line draws its own leading «·», so the amount leads and nothing on the line can
                  end on a dot with nothing after it — which is what a trailing one here did the
                  moment the class moved to the end (§109.3). */}
              {/* ⚠ THE AMOUNT LEFT THIS LINE FOR THE MONEY COLUMN (FEED-IA §111.10, off Peter's own
                  reading of the albarán: «the weight should be by price and next to unit»). It is
                  the first half of the arithmetic the money states — «12 kg × 16,74 €/kg = 200,88 €»
                  — and a person checking a document reads that product across ONE column, the way
                  an albarán has always been read. Under the name stand the things that say WHAT the
                  goods are; against the price stand the numbers that say how much (§109.3's own
                  division, one step further). */}
              {/* THE CLASS AND THE LOTE ARE THE LINE'S LAST TWO WORDS (§109.3) — they stand
                  together at the end of this line, and the group that holds them is below. */}
              {/* ── THE DIMENSIONS, WHERE THERE ARE ANY (FEED-IA §41.1) ──────────────────────
                  «Houses that never prep simply never touch the dropdown — the option's presence
                  costs them nothing.» So a dimension draws ONLY where a value stands: no slot, no
                  placeholder, no empty label. Every one of them opens the same fields row the name
                  opens, because that is where its register lives (§16: the control sits on the
                  value, and these values ARE fields). */}
              {/* ⚠ THE MONEY LEFT THIS LINE FOR THE TERMINAL (FEED-IA §192.1, Peter verbatim:
                  «price should defo be rightmost big... just unit price and unit under... quantity
                  and total price big on the right»). E191 sat the rate and the quiet total here
                  under the name; §192 ends the line in TWO big right values instead — quantity
                  with its unit beneath, the total with its rate beneath — so this line keeps only
                  what says WHAT the goods are. */}
              {dimensionWords(line).map((d) => (
                <span key={d.id} style={{ display: 'inline-flex', alignItems: 'baseline', gap: theme.sizing.scale200 }}>
                  <span aria-hidden="true">·</span>
                  {value('name', `${d.label} · ${d.word}`, `line-dim-${line.id}-${d.id}`, <>{d.word}</>)}
                </span>
              ))}
              {/* ── WHAT THE SCALE SAID BESIDE WHAT THE COUNT SAYS (FEED-IA §41.3) ───────────
                  A kilo line's amount already IS its final weight, so this stands only where the
                  line is counted in something else — four boxes that weighed 21,4 kg. */}
              {line.finalWeight !== undefined && (
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: theme.sizing.scale200 }}>
                  <span aria-hidden="true">·</span>
                  <span data-testid={`final-weight-${line.id}`} style={{ display: 'inline-flex', alignItems: 'baseline', gap: theme.sizing.scale200 }}>
                    final weight
                    <Figure value={line.finalWeight} unit="kg" decimals={qtyDecimals(line.finalWeight)} size="mini" />
                  </span>
                </span>
              )}
              {usual && <span>{usual.replace(/^ · /, '· ')}</span>}
              {/* ⚠ THE CLASS LEFT THE LINE (FEED-IA §193.4, superseding §109.3's «class first,
                  then lot» for this row). Peter verbatim: «class i feel like tbf it can be removed
                  altgoether given that the sku (the thing int he title) wiuld probabyl have it and
                  class might be an internal thing of some kind that's actually not even named…
                  related to when that lot or stock came in qhich is what we ONLY will know.» The
                  top-down reading: COMMERCIAL identity — any grade the market actually sells by —
                  lives in the SKU the title states; TEMPORAL identity — when the goods came in —
                  lives in the lot. The row states no third taxonomy between them.

                  ── THE LOTE IS A LIVING FACT (FEED-IA §37.4) ────────────────────────────────
                  «The lot is a living fact, never hardcoded: editable by hand on the line, with a
                  sub-button showing the batches that have COME IN.» It is a value on the row like
                  every other one, so it opens the same way the name does.

                  AND A CLOSED DOCUMENT'S LOTE IS A DOOR, NOT A STRING (§43). «A lot reference opens
                  the lot book.» An open line reaches its book through the editor's own sub-button
                  («The batches that came in»); a closed one goes to the goods' own record, where
                  the batches that came in live. */}
              <span
                data-testid={`line-grade-${line.id}`}
                data-grade-pair="line"
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: theme.sizing.scale200,
                  flexWrap: 'nowrap',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {inventoryAvailable && line.lot && (
                  <>
                    {precedes && <span aria-hidden="true">·</span>}
                    {editable
                      ? value(
                          'lot',
                          line.lot ? `The lote on this line · ${line.lot}` : 'Put a lote on this line',
                          `line-lot-${line.id}`,
                          <>Lot {line.lot}</>,
                        )
                      : (
                        <ObjectDoor
                          testid={`line-lot-${line.id}`}
                          label={`The batches that came in · lote ${line.lot}`}
                          onOpen={() => openProduct(line.product.id)}
                        >
                          lote {line.lot}
                        </ObjectDoor>
                      )}
                  </>
                )}
              </span>
            </span>
            {/* ── THE NOTE'S SEAT (FEED-IA §197.3) ─────────────────────────────────────────────
                «figure out a real nice place for the note to go and well fitting even if it's 100
                characters and keep the nice tightness and alignment and visual balance of the
                product row on all screen sizes». It lives in the identity column under the facts —
                the column that already wraps — one or two lines at the small step, the pen before
                it, NOTHING AT REST (§37.3): a line without a note draws no slot. On a desk the seat
                itself becomes the editor; on a phone the sheet slides up («as per usual»). */}
            {(noteText || field === 'prep') && (
              <span data-testid={`line-note-${line.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: theme.sizing.scale200, minWidth: 0, maxWidth: '100%' }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', color: theme.colors.contentTertiary, marginTop: '3px', flex: '0 0 auto' }}><Glyph id="draft" size={14} /></span>
                {field === 'prep' && editable && !phone ? (
                  <input
                    data-testid={`note-write-${line.id}`}
                    value={noteDraft}
                    autoFocus
                    maxLength={100}
                    aria-label={`The note on ${line.product.name}`}
                    placeholder="A note for the packer and the customer"
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setNoteDraft(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); putNote(noteDraft); setField(null); }
                      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setField(null); }
                    }}
                    onBlur={() => { putNote(noteDraft); setField(null); }}
                    className={css({
                      flex: '1 1 auto', minWidth: 0, padding: '0', margin: '0', border: 'none',
                      borderBottom: `1px solid ${theme.colors.contentPrimary}`, borderRadius: '0', background: 'transparent',
                      color: theme.colors.contentPrimary, ...theme.typography.ParagraphSmall, ':focus': { outline: 'none' },
                    })}
                  />
                ) : (
                  editable
                    ? <Editable label={`The note on ${line.product.name}`} testid={`note-edit-${line.id}`} minimumTarget={44} fluid open={false}
                        onOpen={() => { setNoteDraft(noteText); setField('prep'); }}>
                        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{noteText}</span>
                      </Editable>
                    : <span data-testid={`note-text-${line.id}`} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere', whiteSpace: 'normal', minWidth: 0 }}>{noteText}</span>
                )}
              </span>
            )}
          </span>
          {/* ── THE TWO BIG RIGHT VALUES, ON ONE LINE (FEED-IA §192.1 · §193.1-2) ──────────────
              Peter verbatim: «quantity and total price big on the right., and if price is turned
              off quantity becomes the main» — and then, on the stacked build: «kg CANNOT be below
              the fucking unit. that's dumb». So the line ends in ONE line of two big values:
              «21 kg» — the unit RIDES the number, the same law the pricing pages keep — then the
              LINE TOTAL at the extreme right. The unit price stands in the small step beneath the
              total (§193.3 holds it as an open fork: it is the hand's editable seat). ⚠ SUPERSEDES
              §109.5/§111.10's identity-side money, E191.03's single-terminal sentence, and
              §192.1's two-row stacks. An unpriced posture — Pricing off, packing, a freebie, an
              unreadable line — draws «21 kg» alone, the primary rightmost value. */}
          <span
            data-price-cell={pricesVisible ? "line" : "measure"}
            data-money-cols={hasPriceFacts ? "2" : "1"}
            data-column-plan={`${plan.qtyCh}/${plan.unitCh}/${plan.totalCh}/${plan.figure}/${plan.stacks ? 'stacked' : 'inline'}/${plan.wraps ? 'wrapped' : 'one-line'}`}
            data-mobile-layout={phone ? (stackedLine ? 'terminal-below' : 'identity-and-terminal') : undefined}
            style={{ display: 'flex', flexDirection: plan.wraps ? 'column' : 'row', gridColumn: stackedLine ? '1' : '2',
              gridRow: stackedLine ? 2 : 1,
              justifySelf: 'end', alignSelf: stackedLine ? 'start' : 'center',
              /* the two big values share ONE line: the qty pair's 44 and the total's 44 row both
                 hug the top, so «21 kg» and «283,50 €» sit level and only the rate hangs below */
              justifyContent: 'flex-end', alignItems: plan.wraps ? 'flex-end' : 'start',
              /* the plan keeps this to one line; if a width the plan never saw still cannot hold
                 it, the money wraps under the quantity rather than a single figure ever clipping */
              flexWrap: 'wrap', rowGap: '0',
              columnGap: plan.gapPx === 12 ? theme.sizing.scale400 : theme.sizing.scale700, minWidth: 0, maxWidth: '100%' }}
          >
            <span data-money="amount" data-testid={`line-quantity-unit-${line.id}`}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end',
                gap: theme.sizing.scale100, minHeight: 44, minWidth: 0, maxWidth: '100%', whiteSpace: 'nowrap' }}>
              <span data-testid={`line-quantity-${line.id}`} data-field-ambiguity={quantityConcern ? 'quantity' : undefined}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative',
                  /* the column plan's width, in the figure's own ch so «4» and «12.500,5» share a column */
                  fontSize: figureType.fontSize, lineHeight: figureType.lineHeight,
                  minWidth: packing ? 0 : `${plan.qtyCh}ch`,
                  padding: quantityConcern ? `${theme.sizing.scale100} ${theme.sizing.scale200}` : 0,
                  border: quantityConcern ? `2px solid ${theme.colors.accent}` : 'none',
                  borderRadius: quantityConcern ? theme.borders.radius100 : 0 }}>
                {/* §192.2: a press on the number IS the editor — the value swaps for a focused,
                    selected input in its own seat. The packing scale keeps its instrument. */}
                {field === 'amount' && editable && !packing ? (
                  <input
                    data-testid={`quantity-write-${line.id}`}
                    value={qtyText}
                    autoFocus
                    inputMode="decimal"
                    aria-label={sale.printed ? 'Actual quantity' : 'Quantity'}
                    aria-invalid={Boolean(parseLineQuantity(qtyText).error)}
                    placeholder={line.unreadable ? '0' : undefined}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setQtyText(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (putQuantity(qtyText)) setField(null); }
                      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setField(null); }
                    }}
                    onBlur={() => { putQuantity(qtyText); setField(null); }}
                    className={css({
                      width: `${Math.max(qtyText.length, 2) + 1}ch`, maxWidth: '9ch', minWidth: 0,
                      textAlign: 'right', padding: '0', margin: '0', border: 'none',
                      /* the app's red is `accent` (§128's outline red) — `colors.negative` paints as ink in this theme */
                      borderBottom: `2px solid ${parseLineQuantity(qtyText).error ? theme.colors.accent : theme.colors.contentPrimary}`,
                      borderRadius: '0', background: 'transparent', color: theme.colors.contentPrimary,
                      ...figureType, fontVariantNumeric: 'tabular-nums',
                      ':focus': { outline: 'none' },
                    })}
                  />
                ) : value('amount', 'Edit quantity', line.unreadable ? `no-amount-${line.id}` : packing ? `pick-qty-${line.id}` : `line-qty-${line.id}`,
                  line.unreadable
                    ? <span style={{ ...theme.typography.LabelSmall, color: theme.colors.accent }}>To confirm</span>
                    : <Figure value={line.given} decimals={qtyDecimals(line.given)} size={packing ? 'large' : plan.figure} />)}
                {/* §192.2: the seat's own sentence when the typed word is not a quantity — the popover's
                    `quantity-error` alert, kept, drawn under the value at the app's red */}
                {field === 'amount' && editable && !packing && qtyText.trim() !== '' && parseLineQuantity(qtyText).error && (
                  <span id={`quantity-error-${line.id}`} data-testid={`quantity-error-${line.id}`} role="alert"
                    style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.accent, position: 'absolute', right: 0, top: '100%', whiteSpace: 'nowrap' }}>
                    {parseLineQuantity(qtyText).error}
                  </span>
                )}
              </span>
              {value('unit', 'Edit unit', `line-unit-${line.id}`,
                <span style={{ ...unitType, color: theme.colors.contentSecondary, whiteSpace: 'nowrap',
                  /* the unit column is as wide as the longest unit on the sheet, so «kg» and «manojo» start at one x */
                  display: 'inline-block', minWidth: packing ? 0 : `${plan.unitCh}ch`, textAlign: 'left' }}>{line.unit}</span>)}
            </span>
            {hasPriceFacts && (
              <span data-testid={`line-money-stack-${line.id}`}
                style={{ display: 'grid', gridTemplateRows: 'minmax(44px, auto) auto', justifyItems: 'end',
                  alignItems: 'center', alignContent: 'start', rowGap: '0', minWidth: 0, maxWidth: '100%' }}>
                {/* the total is DERIVED — it has no editor; the rate beneath it is the hand's seat */}
                {!priceless ? (
                  <output data-money="total" data-testid={`line-money-${line.id}`} data-derived="quantity-times-unit-price"
                    data-value={line.given * line.price} aria-label="Line total"
                    style={{ whiteSpace: 'nowrap', display: 'inline-flex', justifyContent: 'flex-end',
                      fontSize: figureType.fontSize, lineHeight: figureType.lineHeight, minWidth: `${plan.totalCh}ch` }}>
                    <Figure value={line.given * line.price} unit="S/" size={plan.figure} />
                  </output>
                ) : <span aria-hidden="true" />}
                <span data-money="rate" style={{ display: 'inline-flex', alignItems: 'baseline', justifyContent: 'flex-end', minWidth: 0, whiteSpace: 'nowrap' }}>
                  {field === 'rate' && editable && !phone ? (
                    /* §197.1 — «on desktop it's a dropdown of tariffs but they can type whatever, no
                       modal tho»: a live field over the house's tariffs, each with its price for
                       this product; a typed number is a price of its own. */
                    <span data-testid={`rate-menu-${line.id}`} style={{ display: 'inline-flex', minWidth: 0 }}>
                      <Select
                        creatable startOpen autoFocus searchable clearable={false}
                        size={SIZE.compact}
                        options={tiersOfHouse(cast).map((t) => { const at = priceOn(cast, line.product, t.id, todayId(cast)); return { id: t.id, price: at, label: `${t.name} · ${solesRate(at, line.unit)}` }; })}
                        value={[]}
                        placeholder={line.price > 0 ? `${solesRate(line.price, line.unit)}` : `S/ per ${line.unit}`}
                        /* Base's own filter: an empty field lists every tariff; a typed number matches
                           none, so the list holds only the typed entry and Enter commits IT */
                        onInputChange={(e) => setRateText(e.currentTarget.value)}
                        onChange={({ value, option }) => {
                          const chosen = (value[0] ?? option) as { isCreatable?: boolean; label?: string; price?: number } | null;
                          if (!chosen) return;
                          rateChosen.current = true;
                          putPrice(chosen.isCreatable ? String(chosen.label ?? '') : String(chosen.price ?? ''), !chosen.isCreatable);
                          setField(null);
                        }}
                        onClose={() => {
                          /* the list closed without a choice (Escape, click away): a typed number
                             still commits, an untouched field just leaves the seat as it was */
                          if (!rateChosen.current && rateText.trim() && rateText !== amountWords(line.price)) putPrice(rateText);
                          rateChosen.current = false;
                          setField(null);
                        }}
                        overrides={{
                          Root: { style: { width: '212px', maxWidth: '100%' } },
                          Input: { props: { 'data-testid': `rate-inline-${line.id}`, inputMode: 'decimal', 'aria-label': `${correctingPrintedPaper ? 'Actual unit price' : 'What this line goes on at'}, in S/ per ${line.unit}` } },
                          Popover: { props: { overrides: { Body: { style: { zIndex: LAYER + 4 } } } } },
                        }}
                      />
                    </span>
                  ) : (rated || (priceless && editable)) ? (
                    value(
                      'rate',
                      priceless ? 'Say what this line goes on at' : `What this line goes on at · ${solesRate(line.price, line.unit)}`,
                      `row-rate-${line.id}`,
                      <span data-rate={line.price} style={{ color: theme.colors.contentSecondary }}>
                        {priceless
                          ? <span style={{ ...theme.typography.ParagraphXSmall }}>{`S/ per ${line.unit}`}</span>
                          : <Figure value={line.price} unit={`S/ per ${line.unit}`} size="mini" />}
                      </span>,
                    )
                  ) : null}
                </span>
              </span>
            )}
          </span>
          {/* §143: the line tail holds removal; the note door is beside the name. */}
          <span
            data-testid={`line-tail-${line.id}`}
            data-tail-seat={stackedLine ? (plan.tailShares ? 'values' : 'own') : undefined}
            /* §192.2 + §195: a seat growing leftwards while a number is typed must never sit under
               the bin — on a shared row the tail stands down (kept in layout, not a target) until
               the edit closes, so nothing jumps and no tap lands on Delete-line by accident */
            data-standing-down={!phone && stackedLine && plan.tailShares && (field === 'amount' || field === 'rate') ? 'yes' : undefined}
            style={{
              visibility: !phone && stackedLine && plan.tailShares && (field === 'amount' || field === 'rate') ? 'hidden' : undefined,
              pointerEvents: !phone && stackedLine && plan.tailShares && (field === 'amount' || field === 'rate') ? 'none' : undefined,
              /* §193.2: on a stacked phone line the tail RIDES the values' own row — same grid
                 cell, opposite edge — instead of spending a third 44px storey of its own. */
              /* E193.22 · PHONE: the tail rides the TITLE row's right edge — the values' line is
                 figures only, and a destructive control never stands beside the number a thumb is
                 about to press (§109.7: «the trash appears on its RIGHT»; §195). The identity
                 leaves it the room (paddingRight below). DESK: its own column, or a stacked line's
                 values row when the plan says it fits. */
              gridColumn: phone ? '1' : stackedLine ? '1 / -1' : '3',
              gridRow: phone ? 1 : stackedLine ? (plan.tailShares ? 2 : 3) : 1,
              width: tailPx,
              justifySelf: phone ? 'end' : stackedLine ? (plan.tailShares ? 'start' : 'end') : undefined,
              alignSelf: phone || stackedLine ? 'start' : undefined,
              flex: '0 0 auto',
              display: 'flex',
              /* §197.3 «an icon of a pen on sheet of paper above the trash» — a desk stacks the two;
                 a phone, whose tail rides the values' line, keeps them side by side */
              flexDirection: phone ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: phone ? 'flex-end' : 'center',
              gap: '4px',
            }}
          >
            {phone ? (
              /* E193.22 · PHONE: one seat, the line's acts behind a press — the destructive door is
                 never at rest beside a figure (§109.7 · §195, the way a checkout's line item keeps
                 its overflow) */
              <StatefulPopover
                placement={PLACEMENT.bottomRight}
                triggerType={TRIGGER_TYPE.click}
                overrides={{ Body: { style: { zIndex: LAYER + 4 } } }}
                content={({ close }) => (
                  <StatefulMenu
                    items={[
                      { id: 'note', label: noteText ? 'Edit note' : 'Add note' },
                      ...(editable ? [{ id: 'remove', label: 'Remove from this delivery note' }] : []),
                    ]}
                    onItemSelect={({ item }) => {
                      close();
                      if (item.id === 'note') { setNoteDraft(noteText); setField('prep'); }
                      if (item.id === 'remove') { removeLine(sale, now, line.id); setField(null); }
                    }}
                    overrides={{
                      List: { style: { minWidth: '220px' } },
                      Option: { props: { overrides: { ListItem: { props: { 'data-testid': `line-act-${line.id}` } } } } },
                    }}
                  />
                )}
              >
                <button type="button" data-testid={`line-more-${line.id}`} aria-label={`Acts on ${line.product.name}`} title="More"
                  onClick={(e) => e.stopPropagation()}
                  className={css({ display: 'grid', placeItems: 'center', width: `${ROW_TAIL}px`, height: `${ROW_TAIL}px`, padding: '0', border: 'none', background: 'transparent', color: theme.colors.contentTertiary, cursor: 'pointer', fontFamily: 'inherit', ':hover': { color: theme.colors.contentPrimary }, ':focus-visible': { outline: `2px solid ${theme.colors.borderSelected}` } })}>
                  <Glyph id="more" size={18} />
                </button>
              </StatefulPopover>
            ) : (<>
            <button type="button" data-testid={`note-open-${line.id}`} aria-label={noteText ? `Edit the note on ${line.product.name}` : `Add a note to ${line.product.name}`} title={noteText ? 'Edit note' : 'Add note'}
              onClick={(e) => { e.stopPropagation(); setNoteDraft(noteText); setField((v) => (v === 'prep' ? null : 'prep')); }}
              className={css({ display: 'grid', placeItems: 'center', width: `${ROW_TAIL}px`, height: `${ROW_TAIL}px`, padding: '0', border: 'none', background: 'transparent', color: theme.colors.contentTertiary, cursor: 'pointer', fontFamily: 'inherit', opacity: phone || over || whisper || prep ? 1 : 0, transitionProperty: 'opacity, color', transitionDuration: theme.animation.timing400, transitionTimingFunction: theme.animation.easeOutCurve, ':hover': { color: theme.colors.contentPrimary }, ':focus-visible': { opacity: 1 } })}>
              <Glyph id="draft" size={18} />
            </button>
            {editable && (
              <button
                type="button"
                data-testid={`remove-${line.id}`}
                aria-label={`Take ${line.product.name} off this delivery note`}
                onClick={(e) => { e.stopPropagation(); removeLine(sale, now, line.id); setField(null); }}
                className={css({
                  display: 'grid',
                  placeItems: 'center',
                  width: `${ROW_TAIL}px`,
                  height: `${ROW_TAIL}px`,
                  padding: '0',
                  border: 'none',
                  background: 'transparent',
                  color: theme.colors.contentTertiary,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  /* Touch has no hover. Keep the two neighbouring actions visible on a phone,
                     where comments and removal need the same discoverability as on a hovered row. */
                  opacity: phone || over || whisper ? 1 : 0,
                  transitionProperty: 'opacity, color',
                  transitionDuration: theme.animation.timing400,
                  transitionTimingFunction: theme.animation.easeOutCurve,
                  ':hover': { color: theme.colors.contentPrimary },
                  ':focus-visible': { opacity: 1 },
                })}
              >
                <Glyph id="bin" size={18} />
              </button>
            )}
            </>)}
          </span>
        </div>
      </div>

      {skuChoiceNeeded && (
        <div data-testid={`sku-choice-${line.id}`} role="group" aria-label="Which product did they mean?"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, marginLeft: phone ? theme.sizing.scale600 : theme.sizing.scale1000,
            padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`, borderLeft: `2px solid ${theme.colors.accent}`, minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.accent }}>Which product did they mean?</span>
          <span style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.sizing.scale200, minWidth: 0 }}>
            {skuChoices.map((product) => (
              <Button key={product.id} kind={KIND.secondary} size={SIZE.compact}
                data-testid={`sku-choice-${line.id}-${product.id}`}
                onClick={() => chooseLineSku(sale, now, line, product)}
                startEnhancer={<ProductFace of={{ ...product, sector: cast.sector }} size={32} />}
                overrides={{ BaseButton: { style: { justifyContent: 'flex-start', textAlign: 'left', minWidth: 0, minHeight: '44px', height: 'auto' } } }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{product.name}</span>
                  <span data-testid={`sku-choice-${line.id}-${product.id}-meta`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, whiteSpace: 'normal' }}>
                    {product.code ? <><ProductCode code={product.code} /> · </> : ''}{product.unit}
                  </span>
                </span>
              </Button>
            ))}
          </span>
          <Button kind={KIND.tertiary} size={SIZE.mini} data-testid={`sku-choice-${line.id}-none`}
            onClick={() => rejectLineSkuChoices(sale, now, line)}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
            Something else
          </Button>
        </div>
      )}

      {/* ── HOW IT'S PACKED, AS AN INDENT UNDER THE LINE (FEED-IA §131.2, his own shape) ────
          «That would be a note shown as an INDENT BELOW something, and maybe that's a little
          button you can put above the trash icon.» So this is the note's seat: under the whole
          band, indented past the produce mark, at the smallest step and in INK — it is document
          content, not annotation (§14): it prints and the packer acts on it, which is why it
          stands above the saffron margin rather than inside it.
          NOTHING AT REST. A line nobody has written a note on draws no slot, no placeholder and no
          hairline — the affordance is the tail's button and it costs the row no height (§37.3). */}
      {/* ── THE PHONE'S TWO SHEETS (FEED-IA §197.1 · §197.3, «on mobile a modal should slide up»)
          The rate: the house's tariffs to choose, each with its price for this product, or a
          manual override. The note: one field, a hundred characters. Same card, docked at the
          bottom edge — the phone's editing pattern from now on («as per usual»). */}
      {phone && editable && field === 'rate' && (
        <OverlayCard isOpen onClose={() => setField(null)} placement={PLACEMENT.bottom} size="full" ariaLabel={`Unit price · ${line.product.name}`}
          /* the sheet must stand ABOVE the phone's fixed act-bar (LAYER + 2), or the bar swallows its Save */
          overrides={{ Root: { style: { zIndex: LAYER + 3 } }, Card: { style: { maxHeight: 'min(78dvh, 640px)', overflowY: 'auto', padding: theme.sizing.scale500 } } }}>
          <div data-testid={`rate-sheet-${line.id}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelMedium }}>Unit price · {line.product.name}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
              {tiersOfHouse(cast).map((t) => {
                const at = priceOn(cast, line.product, t.id, todayId(cast));
                return (
                  <Button key={t.id} kind={KIND.secondary} size={SIZE.compact} data-testid={`rate-tier-${line.id}-${t.id}`}
                    onClick={() => { putPrice(String(at), true); setField(null); }}
                    overrides={{ BaseButton: { style: { justifyContent: 'space-between', minHeight: '48px' } } }}>
                    <span>{t.name}</span>
                    <Figure value={at} unit={`S/ per ${line.unit}`} size="mini" />
                  </Button>
                );
              })}
            </div>
            <label htmlFor={`rate-write-${line.id}`} style={theme.typography.LabelXSmall}>Or a price of its own</label>
            <Input id={`rate-write-${line.id}`} value={rateText} size={SIZE.compact} placeholder="0,00"
              endEnhancer={<span style={{ ...theme.typography.LabelXSmall, whiteSpace: 'nowrap' }}>{`${workspaceCurrency() === 'EUR' ? '€' : 'S/'} per ${line.unit}`}</span>}
              onChange={(e) => setRateText((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); putPrice(rateText); setField(null); } }}
              overrides={{ Input: { props: { 'data-testid': `rate-write-${line.id}`, inputMode: 'decimal' } } }} />
            <LineEditorActions onSave={() => { putPrice(rateText); setField(null); }} onCancel={() => setField(null)} saveTestid={`rate-put-${line.id}`} />
          </div>
        </OverlayCard>
      )}
      {phone && editable && field === 'prep' && (
        <OverlayCard isOpen onClose={() => setField(null)} placement={PLACEMENT.bottom} size="full" ariaLabel={`Note · ${line.product.name}`}
          overrides={{ Root: { style: { zIndex: LAYER + 3 } }, Card: { style: { maxHeight: 'min(78dvh, 640px)', overflowY: 'auto', padding: theme.sizing.scale500 } } }}>
          <div data-testid={`note-sheet-${line.id}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelMedium }}>Note · {line.product.name}</span>
            <Input value={noteDraft} size={SIZE.compact} autoFocus placeholder="A note for the packer and the customer"
              onChange={(e) => setNoteDraft((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); putNote(noteDraft); setField(null); } }}
              overrides={{ Input: { props: { 'data-testid': `note-write-${line.id}`, maxLength: 100, 'aria-label': `The note on ${line.product.name}` } } }} />
            <LineEditorActions onSave={() => { putNote(noteDraft); setField(null); }} onCancel={() => setField(null)} saveTestid={`note-put-${line.id}`} />
          </div>
        </OverlayCard>
      )}

      {/* ── THE LINE'S OWN MARGIN (§14, THE-INTELLIGENCE §1) ────────────────────────────────
          Everything that is ABOUT this line and is not this line: what it replaced, what Rocoto
          filled it with, what the amount was resolved from, what the word has earned, what the
          catalogue makes of it, and which batches it came off. Indented past the produce mark,
          against a hairline, at the smallest step. */}
      {notes && (
        <Marginal testid={`line-notes-${line.id}`}>
          {/* THE PREDECESSOR, STRUCK. A line the scale or a hand has moved says what it was, in
              the Figure's own supersede lockup, so the change needs no diff to read. */}
          {moved && (
            <span data-testid={`line-was-${line.id}`}>
              <Figure
                value={line.given}
                was={line.ordered}
                unit={line.unit}
                decimals={Number.isInteger(line.given) && Number.isInteger(line.ordered) ? 0 : 1}
                size="mini"
              />
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}> given</span>
            </span>
          )}

          {/* CORRECTING IS THE FEEDBACK (§1), AND THE CORRECTION LIVES ON THE NAME (§31.3). The
              note keeps saying what Rocoto did; the act of undoing it moved onto the name itself,
              where the customer's own word leads the dropdown. A margin that carried both the
              observation and a button to answer it was the pencil in another costume. */}
          <Provenance text={filled} mark="Rocoto filled it" testid={`filled-${line.id}`} />

          <Provenance text={askedQty} mark="Rocoto resolved it" testid={`asked-qty-${line.id}`} />

          {/* ── THE GRADUATION (§2) ─────────────────────────────────────────────────────────── */}
          {graduation && editable && (
            <Provenance
              text={graduationWords(graduation)}
              mark="Rocoto noticed it"
              testid={`graduate-offer-${line.id}`}
            >
              <Button
                kind={KIND.secondary}
                size={SIZE.compact}
                data-testid={`graduate-${line.id}`}
                onClick={() => graduateAmendment(sale, now, line)}
              >
                Make it its own product
              </Button>
            </Provenance>
          )}
          {line.graduated && (
            <span
              data-testid={`graduated-${line.id}`}
              style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}
            >
              {GRADUATED_WORDS(line)}
            </span>
          )}

          {line.nonSku && !line.adopted && editable && (
            <div data-testid={`one-off-actions-${line.id}`} style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                kind={KIND.secondary}
                size={SIZE.mini}
                data-testid={`accept-one-off-${line.id}`}
                onClick={() => adoptLine(sale, now, line.id, 'one-off')}
                startEnhancer={<span aria-hidden="true">✓</span>}
                overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
              >
                Accept as one-off
              </Button>
              <Button
                kind={KIND.tertiary}
                size={SIZE.mini}
                data-testid={`edit-off-sku-${line.id}`}
                onClick={() => setField('name')}
                overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
              >
                Edit
              </Button>
              <Button
                kind={KIND.tertiary}
                size={SIZE.mini}
                data-testid={`reject-off-sku-${line.id}`}
                onClick={() => removeLine(sale, now, line.id)}
                startEnhancer={<span aria-hidden="true">×</span>}
                overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
              >
                Reject
              </Button>
            </div>
          )}

          {/* THE LOTE, IN FULL, where the line came off more than one batch (LOT-LAW §2). */}
          {inventoryAvailable && line.allocations && line.allocations.length > 1 && (
            <span
              data-testid={`allocations-${line.id}`}
              style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}
            >
              {line.allocations.map((a) => `${a.batch} · ${qtyWords(a.qty, line.unit)}`).join(' · ')}
            </span>
          )}
        </Marginal>
      )}

      {acknowledged && <div data-testid={`concern-resolved-${line.id}`} role="status"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300,
          padding: theme.sizing.scale300, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
        <span>Great, thanks for editing.</span>
        <Button kind={KIND.tertiary} size={SIZE.mini} aria-label="Dismiss acknowledgement" onClick={() => setAcknowledged(false)}>Dismiss</Button>
      </div>}

      {/* ── THE INSTRUMENT THE VALUE OPENED (§31.3, §16) ────────────────────────────────────
          One field at a time, on the line's own ground, indented past the produce mark. The whole
          form is gone: a person who tapped a quantity gets a scale and nothing else, which is
          what made the open line four hundred pixels shorter than the form it replaced. */}
      {/* the note opens IN PLACE as an indent under the line, so it never summons this card (§6) */}
      {/* ── AND NEITHER DOES THE PRICE, ON A DESK (FEED-IA §131.2) ─────────────────────────
          «The whole edit thing of prices and stuff OPENS UP A WHOLE MENU BELOW, which is a bit
          silly. It should just be tappable and recognizable.» The rate is written in its own track
          on the row now; this card is what a thumb still gets, because a bare 14px input inside a
          92px column is not a touch target. */}
      {editable && field && !['prep', 'comment', 'amount', 'unit', 'lot'].includes(field) && !(field === 'rate' && !phone) && (
        <div
          data-testid={`line-editor-${line.id}`}
          data-field={field}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale400,
            /* THE INDENT ALIGNS THE EDITOR PAST THE PRODUCE MARK, and on a desk that is what makes
               it read as belonging to the row above it. On a phone it is 48 of the 240 pixels the
               editor has to hold seven fields in, so there it steps back to a hairline's worth —
               the belonging is carried by the card's own edge instead. */
            marginLeft: phone ? theme.sizing.scale300 : theme.sizing.scale1000,
            padding: theme.sizing.scale500,
            borderRadius: theme.borders.radius200,
            border: `1px solid ${theme.colors.borderOpaque}`,
            background: theme.colors.backgroundPrimary,
            minWidth: 0,
          }}
        >
          {/* ── THE ONE FIELD, CARRYING WHAT THE LINE ALREADY SAYS (FEED-IA §109.5) ──────────
              «Adding OR EDITING a product in the albarán: ONE empty text field first → they write
              → BOOM, it populates THE ACTUAL ROW STRUCTURE.» On a line that already stands, the
              structure IS the row above this card, so pressing the name brings the ONE FIELD back
              with the line's own phrase in it — nothing else. One road in for a new line and for an
              existing one. */}
          {field === 'name' && (
            <LineFields
              cast={cast}
              sale={sale}
              line={line}
              now={now}
              sector={config.cast}
              onOpenCard={onOpenCard}
            />
          )}

          {/* ⚠ THE RATE'S FOLD CLOSED (§192.2). §109.6's own words — «Any row is ALWAYS ready to
              edit — click into any value and type» — are honoured literally now: the press swaps
              the rate's seat in the money column for a focused, selected input, on desk and on
              phone alike, so the row spends no fold on it. The pin still writes the existing
              line-price event; other documents and the product's tariff keep their own prices. */}

          {field === 'weight' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
              <WeightEntry
                key={`${line.id}-final`}
                size="compact"
                camera={phone}
                marks={phone ? 'on' : 'auto'}
                unit="kg"
                defaultValue={line.finalWeight ?? (line.unit === 'kg' ? line.given : 0)}
                onChange={(v) => setDraft(v.kilos)}
                onCommit={(v) => putWeight(v.kilos)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
                <LineEditorActions
                  saveLabel="Put it on the line"
                  saveTestid={`final-weight-put-${line.id}`}
                  onCancel={() => setField(null)}
                  onSave={() => {
                    if (draft !== null) putWeight(draft);
                    setField(null);
                  }}
                />
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  {line.unit === 'kg'
                    ? 'The weight is the amount on this line.'
                    : `It stands beside the ${qtyWords(line.given, line.unit)}.`}
                </span>
              </div>
            </div>
          )}

          {/* ── OFF THE ALBARÁN ─────────────────────────────────────────────────────────────
              One tap takes the line off; the undo stands at the document's foot for as long as the
              sale is open, so a removal is never a thing a person has to be careful about. */}
          {field === 'name' && <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* ── «ADD MORE» (§41.3) ────────────────────────────────────────────────────────
                «UI: an add-more whose main option is weight, the rest under other.» It stands in
                the editor's foot rather than on the resting row, and the reason is §37.3: the
                document at rest is a document, and an affordance that mounted under a pointer
                would move every line below it. Every value on every line opens this editor in one
                tap, so the control is one tap from anywhere — and the geometry never jags.
                It is the dual-flush shape the print control already uses: the main act on the
                button, the rest behind the caret beside it. */}
            <div style={{ display: 'inline-flex', alignItems: 'stretch' }}>
              <Button
                kind={KIND.secondary}
                size={SIZE.mini}
                data-testid={`add-more-${line.id}`}
                startEnhancer={<Glyph id="weigh" size={16} />}
                onClick={() => setField('weight')}
                overrides={{ BaseButton: { style: { borderTopRightRadius: 0, borderBottomRightRadius: 0, minHeight: '44px' } } }}
              >
                Final weight
              </Button>
              <StatefulPopover
                placement={PLACEMENT.bottomLeft}
                triggerType={TRIGGER_TYPE.click}
                /* §54.1: it opens from a line the sticky dock is standing over */
                overrides={{ Body: { style: { zIndex: LAYER } } }}
                content={({ close }) => (
                  <StatefulMenu
                    items={[
                      { label: 'Final packed', field: 'amount' as LineField },
                      ...(inventoryAvailable ? [{ label: 'A lote', field: 'lot' as LineField }] : []),
                      { label: 'Delivery note text', field: 'prep' as LineField },
                    ]}
                    onItemSelect={({ item }) => {
                      setFieldTarget(item.field === 'amount' ? `line-qty-${line.id}` : item.field === 'lot' ? `line-lot-${line.id}` : null);
                      setField(item.field as LineField);
                      close();
                    }}
                    overrides={{ List: { style: { minWidth: '11rem' } } }}
                  />
                )}
              >
                <Button
                  kind={KIND.secondary}
                  size={SIZE.compact}
                  data-testid={`add-more-other-${line.id}`}
                  aria-label="The rest of what goes on this line"
                  overrides={{ BaseButton: { style: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingLeft: '12px', paddingRight: '12px', minWidth: '44px', minHeight: '44px' } } }}
                >
                  <Glyph id="caret" size={16} />
                </Button>
              </StatefulPopover>
            </div>
            {/* ⚠ «TAKE THE LINE OFF» LEFT THIS FOOT FOR THE ROW'S OWN TAIL (FEED-IA §109.7).
                «Hover a row → the trash icon appears on its RIGHT.» Deletion is a property of the
                ROW now, reachable in one press from anywhere on the list, so a verb for it inside
                an editor a person had to open first is furniture for an act that no longer lives
                here. It kept the same testid on the way — one act, one name, one place. */}
            <Button kind={KIND.tertiary} size={SIZE.compact} data-testid={`done-${line.id}`} onClick={() => setField(null)}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
              Done
            </Button>
          </div>}
        </div>
      )}
    </div>
  );
}

/* ── ADD A LINE — THE LIST'S LAST ROW, AND THE ROW BECOMING REAL (FEED-IA §14 · §84.2 · §84.3)
 * «Adding a new line — why is the button for that above, and why is the new line so tall. Idk,
 * just so unconventionally shit.»
 *
 * TWO THINGS WERE WRONG AND THEY ARE ONE THING. The control was not a row: it was a mini button
 * inside a padded block, and pressing it grew a GREY CARD holding a chip organ, a labelled 260px
 * «Price» field on a storey of its own, and a foot — about five line-heights of furniture to write
 * one line. Convention, everywhere else in this app and everywhere else in software, is that the
 * place a list grows is its last ROW, and that the row you are writing looks like the rows you
 * have written (§76: «the editor is the row becoming real»).
 *
 * SO: closed, it is the list's last row — the plus in the lines' own face seat, the words on the
 * names' x, the 48px floor the catalogue's «add one more» door already stands on. Open, it IS that
 * row — and everything ABOUT the line (where the price came from, «at no charge», the ambiguity)
 * in the row's own margin underneath, which is exactly how a standing line carries its notes. One
 * grammar, three altitudes (§84.4).
 *
 * ── AND OPEN IS ONE MOMENT (FEED-IA §109.6 · §109.7, superseding §109.4's two) ─────────────────
 * «The hosted field is A SINGLE ROW, FULL WIDTH; as the text is captured it BECOMES COLUMNS in
 * place — the structure materializes under the words — and stays ready to edit.» And, the same
 * day: «NO "put it on the albarán" act: Enter alone makes the row. Boom.»
 *
 *   THE ROW    ONE free-text field, hosted AS the list's own row: the face in the lines' own seat,
 *              the trade's whole sentence parsing into chips as it is typed (§62), the history
 *              door at the words' right edge (§109.7), the money column right of the midline
 *              (§109.5), the trash seat at the tail. Every seat is the seat the line will give it.
 *   ENTER      writes the line — at this row's own y, at this row's own band height, with every
 *              value already live (§109.6: any row is always ready to edit). «Continue» is the
 *              same act reached by a hand; nothing stands between the words and the row.
 *
 * ⚠ THE DRAFT STAGE §109.4 BUILT IS GONE, AND SO IS «Put it on». A populated draft that a person
 * had to confirm and a written line that they could edit are the same object drawn twice; §109.7
 * kills the confirm, and §109.6 had already made the second drawing unnecessary. The structure
 * that materializes under the words is the albarán's own row, not a rehearsal of it.
 *
 * THE HEIGHT IS HELD BY A CONSTANT (§84.3 · §77.2): `LINE_BAND` is the measured band of an
 * editable line, and this row declares it CLOSED, OPEN and WRITTEN. The organ's reserved
 * suggestion shelf — which stood inside the field's own column and made the say-moment ~40px
 * taller than the row it became — hangs below the band now, in the row's margin.
 *
 * ── AND IT IS INSIDE THE DOCUMENT, AT ITS FOOT (FEED-IA §14) ──────────────────────────────────
 * «"Add a line" is part of the document's own body — it GROWS the document; "Send" is an act upon
 * the finished document. They are different registers and must stop sitting side by side as
 * siblings.» So this lives inside the card's wrap, under the last line, and it is drawn QUIET: a
 * tertiary control at the measure of the lines, which is what a document's own «and one more
 * thing» looks like. The loud verb is elsewhere entirely — on the dock, under the card.
 *
 * The picker is the catalogue with its own faces on it, an amount, and one switch: at no charge or
 * at the price the product carries. A freebie is a line like any other — the trade adds one
 * constantly — so it takes the same row and states its own zero rather than hiding in a menu.
 */

/* ⚠ `TRADE_UNITS` LEFT WITH THE DRAFT STAGE (FEED-IA §109.7). It was the handful of words a person
 * could pick from beside the amount on the DRAFT row — «kg · ud · caja · l» as pill buttons — and
 * that row is gone: Enter makes the line, and the line's own amount seat opens `UnitChips`, which
 * is the product's real conversion register (§3: a chip that would move a number carries the
 * arithmetic or does not exist). The parser reads the unit out of the sentence in the meantime
 * («6kg», «3 cajas»), which is where a unit belongs on a surface whose whole point is the sentence.
 */

/* ── THE ORGAN'S TWO SEAMS, HELD STABLE (FEED-IA §62, and a real loop this caught) ─────────────
 * `ChipEntry` re-reads its sentence whenever `registers` changes IDENTITY, and it hands the reading
 * back through `onChange`. Every consumer used to build its registers out of a `classesOf(...)`
 * that returned a fresh array on every call — so a consumer that stored the reading rebuilt the
 * registers, which re-parsed, which handed back a new reading, forever. (⚠ THAT REGISTER IS GONE
 * WITH THE CLASS, FEED-IA §197.2; the containers list is still built the same way, so the loop is
 * still reachable and this memo still holds it shut.) The page stayed painted
 * and the main thread never came back; a drive's click sat waiting for a surface that had stopped
 * settling.
 *
 * THE FIX IS TO MEMOISE BY VALUE, NOT BY REFERENCE. The registers are a handful of word lists, so
 * their contents ARE their identity, and a key made of the words is the honest comparison. Both
 * consumers in this file and the composer in Sales go through here, so the loop cannot be
 * reintroduced one surface at a time.
 *
 * ⚠ THE GRADE REGISTER LEFT THE KEY WITH THE FIELD (FEED-IA §197.2): `classesOf` was the fresh
 * array this memo exists for. The containers still are one, so the memo stays exactly as it is.
 */
export function useChipRegisters(spec: ChipRegisters): ChipRegisters {
  const key = [
    spec.sector,
    (spec.containers ?? []).join('|'),
    spec.within?.node ?? '',
    spec.within?.name ?? '',
  ].join('\u00a7');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the key IS the dependency, by value
  return React.useMemo(() => spec, [key]);
}

/* ── WHAT RIDES THE NAME, IN THEIR OWN ORDER (§41.5, §65.3) ───────────────────────────────────
 * «Their names, their structure, THEIR ORDER stay theirs on the surface.» So the amendment is not
 * assembled out of the reading's named parts — sort, then packaging, then residue — because that
 * is OUR order, and it turned «sin cabeza» into «cabeza sin» the moment the parser claimed one of
 * the two words. It is read off the CHIPS, which cover every token exactly once, in writing order.
 *
 * `sortIsTheGoods` is the one exception, and it is C7's (THE-OBJECT-MAP): where the house has
 * GRADUATED the sort the words named, the line stands on that member and the sort is already in
 * the product's own name — so it leaves the amendment rather than being written twice.
 */
export function ridesOf(read: ChipLine | null, sortIsTheGoods = false): string {
  if (!read) return '';
  return read.chips
    .filter((c) => (c.part === 'sort' && !sortIsTheGoods) || c.part === 'text' || c.part === 'packaging')
    .map((c) => c.said)
    .join(' ')
    .trim();
}

/* ═══ THE LINE SPEAKS PROMPT — THE ORGAN, WIRED (FEED-IA §62) ════════════════════════════════
 * «Making the shit chips AS THEY TYPE, so that they don't need to click at all, so it feels as
 * clear as prompting, which means "live" "realtime" AI.»
 *
 * WHAT THIS SEAM WAS ALWAYS FOR. The row of six fields that stood here was already the ladder's
 * parts — name · sort · class · dimensions · amount · unit — and the NAME field already took the
 * trade's whole sentence and walked the words out into the others on commit. §62 collapses the
 * ladder into the sentence itself: ONE field, parsed live, the parts drawn as chips over their own
 * characters. Nothing is walked anywhere, because nothing has anywhere to go.
 *
 * ═══ THE MAPPING, WHICH IS THE WHOLE OF THE CONSUMER'S JOB (chip-entry's own contract) ═══════
 * The organ reads a sentence and hands back a reading; this file decides what a sale does with it.
 *
 *   line.name.node   → `productForNode` → THE GOODS. Where the reference answered, the line is a
 *                      catalogue line and prices itself off the sheet.
 *   line.quantity    → the amount. Absent means one, because «merluza» with no number is one of
 *                      whatever it is sold in, which is what a person writing one word meant.
 *   line.unit        → the unit, falling back to the product's own.
 *   line.sort + free → the AMENDMENT — the word that rides the name and prints on the albarán
 *                      (§41.5: their words stay theirs). Sort first, then whatever nothing claimed.
 *   line.dimensions  → the family's other closed registers, straight across (§41.1).
 *                      ⚠ AND NOT A GRADE (FEED-IA §197.2): `line.klass` was read here out of the
 *                      family's closed register. There is no such register any more — a grade word
 *                      rides the name with everything else nothing claimed.
 *   line.packaging   → rides the amendment, because the container the goods leave in is a fact
 *                      about THIS crate and the model has no field for it yet. Stated here rather
 *                      than dropped silently.
 *
 * ═══ WHAT STAYS A FIELD, AND WHY (§51.5, §51.6) ═════════════════════════════════════════════
 * THE PRICE, on a word the house has never sold. A catalogue line prices itself; a one-off has no
 * sheet to price from, so a person says what it goes on at — and «at no charge» rides that field's
 * own column, under the number it replaces, because that is the question it answers.
 *
 * Everything else the six fields used to hold is now in the sentence. The geometry is the organ's
 * (§59.1, §37.3): every word carries its own padding, the skin is inset, the face has a fixed
 * seat, and the suggestion shelf is one row high at every width — so a chip resolving moves
 * nothing and the row cannot jump while somebody is typing into it.
 */
export function AddLine({
  cast,
  sale,
  now,
  carryOn = false,
  onOpenCard,
}: {
  cast: Cast;
  sale: Sale;
  now: string;
  /* ── THE CIRCLE'S FAR SIDE (FEED-IA §116.3) ─────────────────────────────────────────────────
   * «At the dropdown's bottom, Edit tariffs → opens THE SAME modal the catalog uses. Everything
   * is nice and circular.» This app's catalogue edits a product's bands on the PRODUCT'S OWN
   * SHEET (`ProductTarifas`, inside `product-card.tsx`), and the panel already knows how to open
   * one — so the door is handed in rather than a second editor being grown here. */
  onOpenCard?: (product: Product) => void;
  /* ── THE TYPING CARRIES ON (FEED-IA §74, §61.3 — the zoom that must not drop a keystroke) ───
   * «Naming hands the pane to the real sheet.» It did — and the caret stayed behind. A person
   * typed a customer, pressed Enter, kept typing the first line, and the letters landed on the
   * document body: the composer's field had unmounted and nothing downstream had taken the caret.
   * Observed live; it is the drunk register (§61.3) breaking on the one hand-off it has.
   *
   * So the sheet that takes the pane opens THIS instrument on its first paint and the chip field
   * takes focus with it — the picker is `open` from the first frame rather than a frame later, so
   * there is no window at all in which a keystroke can fall on the floor. It is a hand-off and
   * not a preference: only the naming path passes it, and pressing «Add a line» is untouched. */
  carryOn?: boolean;
}) {
  const [css, theme] = useStyletron();
  const phone = usePhone();
  const { config } = useConfig();
  const grants = useGrants();
  const { pricing: pricingAvailable, inventory } = useWorkspaceCapabilities();
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  const [open, setOpen] = React.useState(carryOn);
  /** the row's own hover ink — the same one every row of every list in this app takes */
  const [over, setOver] = React.useState(false);
  /* AND IF THE SHEET WAS ALREADY STANDING when the hand-off arrives — the pane holds this same
     component across the change — the instrument opens on the change instead of on the mount. */
  React.useEffect(() => { if (carryOn) setOpen(true); }, [carryOn]);
  /** THE READING, HELD AS THE ORGAN HANDS IT OVER. One piece of state instead of six, because the
   *  sentence is the state now and everything else is derived from it on every keystroke. */
  const [read, setRead] = React.useState<ChipLine | null>(null);
  const [free, setFree] = React.useState(false);
  /** what a one-off goes on at — the one number no catalogue can supply (§10, the bare line) */
  const [money, setMoney] = React.useState(0);
  /* ── THE FIELD IS EMPTIED BY BEING REPLACED (FEED-IA §109.7) ────────────────────────────────
   * Enter makes the row, and the field stays standing for the next sentence — which is how a
   * person actually writes an albarán, one line after another, without going back for a control
   * between them. The organ holds its own words, so a fresh sentence is a fresh organ: the seed
   * changes and React mounts a new one with the caret already in it. */
  const [seed, setSeed] = React.useState(0);

  /* ── THE BEATS, AND THEY ARE THE WHOLE SHAPE (FEED-IA §115.1 · §115.6) ─────────────────────
   * «You didn't change anything. It's still really bad, and I don't think you understand.»
   * His four sentences, which are the film:
   *   BEAT 1 · THE FIELD   an empty field. NO price on it. NO recommendations under it. A
   *                        dropdown may appear — behind the field's own control (§113).
   *   BEAT 2 · THE REVEAL  «Once they press Enter, it should show the name, the thing, the type,
   *                        the unit, the quantity, and the price IN COLUMNS. Below that, class
   *                        and lots.» Centered, no fold. The caret lands in the quantity.
   *                        ⚠ «class and» is REPEALED by FEED-IA §197.2: the lote alone stands
   *                        below the name.
   *   BEAT 3 · IT LANDS    Enter again and the line joins the albarán; the field stands empty
   *                        underneath for the next one.
   * The reveal IS the review §76 asks for — the captured facts, in their own seats, before the
   * press that lands them. There is no are-you-sure anywhere on this road (§115.3). */
  const [stage, setStage] = React.useState<'say' | 'seen'>('say');
  /** the words as they were said, held so the reveal can hand them back to the field intact */
  const [words, setWords] = React.useState('');
  /** the seats the reveal opens: the four the sentence usually fills and the two that ride BELOW
   *  the columns. Empty means «the sentence's own reading stands», so a person who typed «6 kg
   *  gamba roja» sees six, kilos and gamba roja in their seats and changes only what is wrong. */
  const [lotSaid, setLotSaid] = React.useState('');
  const [unitSaid, setUnitSaid] = React.useState('');
  const [qtySaid, setQtySaid] = React.useState('');
  const [typeSaid, setTypeSaid] = React.useState('');
  const [skuPick, setSkuPick] = React.useState<string | null>(null);
  /* ⚠ THE PHOTOGRAPHED DOCUMENT LEFT THIS COMPOSER (FEED-IA §131.4). «The camera icon I said is
     for the stock shit, not the albarán field» — so the state it held went with the control. */
  /* ── THE PRICE IS CIRCULAR (FEED-IA §116.3) ────────────────────────────────────────────────
   * «Tap price → it IMMEDIATELY shows the dropdown of their tariffs; free-form override also
   * possible; at the bottom, Edit tariffs → opens THE SAME modal the catalog uses.» The band
   * this line prices on is the DOCUMENT's until somebody says otherwise on the line itself. */
  const [priceDoor, setPriceDoor] = React.useState(false);
  const [tierPick, setTierPick] = React.useState<string | null>(null);
  /** the quantity seat takes the caret the moment the columns reveal — §115.1's «one thing at a
   *  time» inside the revealed row: the name is answered, so the next question is how much */
  const amountRef = React.useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setRead(null); setFree(false); setMoney(0);
    setStage('say'); setWords('');
    setLotSaid(''); setUnitSaid(''); setQtySaid(''); setTypeSaid(''); setSkuPick(null);
    setPriceDoor(false); setTierPick(null);
  };

  /* ── ONE THING AT A TIME, INSIDE THE REVEAL (FEED-IA §115.1 · §76) ─────────────────────────
   * The name is the question that was just answered, so the amount is the next one and the caret
   * goes to it without anybody reaching for a pointer. It runs on the CHANGE of beat rather than
   * on every paint, so a person who then walks to the price is never dragged back. */
  React.useLayoutEffect(() => {
    if (stage !== 'seen') return;
    amountRef.current?.focus();
    amountRef.current?.select();
  }, [stage]);

  React.useEffect(() => {
    if (open) return;
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the closing is the only trigger
  }, [open]);

  /* THE REGISTERS THE PARSER NEEDS AND CANNOT KNOW (chip-parse's `ChipRegisters`): the house's own
     grade register, its sector, and the containers off its own catalogue. The grade register is
     the FAMILY's, and no family is known until the words claim a kind — so it opens on the house's
     first register and is re-read the moment a base is claimed, which is the same two-step the
     six-field row did and for the same reason.

     THIS IS ALSO WHY «merluza 6kg 2ª» LANDS AS A WHOLE (FEED-IA §109.6: «one parse, new or
     known»). The words go in together; `chip-parse` claims the kind off the reference, the fused
     «6kg» as the amount and its unit, and the grade out of whichever register the claimed family
     carries — one pass, one reading, and the qualifiers take their own seats on the row rather
     than riding the name as residue. Where a word claims nothing, it stays theirs and the line is
     born new (§109.2) — the same road either way. */
  /* ⚠ THE HOUSE'S GRADE REGISTER STOOD HERE (FEED-IA §197.2). It was re-read the moment a base
     was claimed, so the composer could offer a family's own grades. There is no register to
     re-read: the SKU carries what the market sells by (§193.4). */
  /* ── §80 · THE WORD RESOLVES AGAINST THE DETAIL SPACE, NEVER THE STRING ────────────────────
   * «Even if one of those is a direct match for just "mangoes", we still know there's ambiguity at
   * the detail level.» `productForNode` answers with the first product that grounds onto the word's
   * node, which is the whole answer where the house sells one form of a thing and a silent pick
   * where it sells three. So the pick is asked for AND the family is counted: base + every member
   * (§78's own structure), and `resolveWord` in `sale.ts` decides what that means. */
  const catalogue = useCatalogue();
  /* ── AND A SORT THE HOUSE HAS GRADUATED IS THE GOODS ITSELF (THE-OBJECT-MAP C7) ─────────────
   * The reading names two levels — «merluza» the kind and «de pincho» the sort — and until the
   * house graduates that sort there is only one thing to stand a line on: the base, with the word
   * riding it as the amendment, which is C5's grammar and stays exactly as it was.
   *
   * ONCE IT HAS GRADUATED, THE MEMBER IS A PRODUCT WITH ITS OWN PRICE (§75.6: «every MEMBER carries
   * a price»). A line still written on «Merluza» would then be priced at the base's row while Stock
   * two screens away shows the sort's own — the house taught the catalogue a name and the document
   * could not use it. So the sort's own node is asked of the GRADUATED members first, and only of
   * them: a house that has graduated nothing reads exactly as it did.
   *
   * AND THE WORD DOES NOT RIDE TWICE. Where the sort IS the goods, it is in the product's name, so
   * `ridesOf` is told to leave it out rather than writing «Merluza de pincho · de pincho». */
  const grown = React.useMemo(() => graduatedProducts(cast, catalogue.state), [cast, catalogue.state]);
  const member = React.useMemo(() => {
    const node = read?.sort?.node;
    return node ? grown.find((p) => graduatedNode(p.id) === node) : undefined;
  }, [grown, read?.sort?.node]);
  useSKURecords();
  const resolvedBase = member ?? (read?.name ? productForNode(cast, read.name.node) : undefined);
  const base = resolvedBase && !skuDetails(cast.sector, resolvedBase).archived ? resolvedBase : undefined;
  const forms = React.useMemo(() => {
    if (!base) return 0;
    const words = amendmentsOf(config.cast, catalogue.state).filter((a) => a.base === base.id).length;
    const sorts = sortsOf(config.cast, catalogue.state).filter((x) => x.under === base.id).length;
    /* THE BASE IS A MEMBER TOO (§75.6: «the main one should become a variation»), so a plain
       product counts ONE and is never ambiguous, and a family of two counts two. */
    return 1 + words + sorts;
  }, [base, config.cast, catalogue.state]);
  const said = React.useMemo(() => resolveWord(base, forms), [base, forms]);
  const skuChoices = React.useMemo(() => {
    if (!base) return [];
    const baseId = graduatedBase(base.id) ?? base.id;
    const amendmentChoices = amendmentsOf(config.cast, catalogue.state)
      .filter((amendment) => amendment.base === baseId && Boolean(amendment.hand || amendment.sellable))
      .map((amendment) => amendmentProduct(cast, amendment));
    const grownChoices = grown.filter((product) => graduatedBase(product.id) === baseId);
    return [base, ...amendmentChoices, ...grownChoices]
      .filter((product, index, all) => all.findIndex((candidate) => candidate.id === product.id) === index);
  }, [base, cast, catalogue.state, config.cast, grown]);
  const skuChoiceNeeded = Boolean(said.ambiguous && skuChoices.length > 1);
  const noneOfThese = skuPick === '__none__';
  const selectedSku = skuChoices.find((product) => product.id === skuPick);
  const chosenProduct = skuChoiceNeeded ? selectedSku : base;
  const choiceLiteral = noneOfThese ? ((read?.name?.said ?? read?.said ?? words).trim()) : '';
  /** THE HOUSE'S OWN CONTAINERS, off its own catalogue — it EXTENDS the trade's list, never
   *  replaces it (§65.3: their structure stays theirs). */
  const containers = React.useMemo(
    () => [...new Set(cast.products.map((p) => p.pack?.unit).filter((u): u is string => Boolean(u)))],
    [cast],
  );
  const registers = useChipRegisters({ sector: config.cast, containers });

  /* ── THE HOUSE'S OWN POSTURE, READ OFF THE GRANT (§10, and grants.ts `assortment`) ──────────
   * «Whether an unmatched string may stand alone or must ride a base is a HOUSE setting, never a
   * per-line question.» A one-offs house sells whatever the market had, so the word itself becomes
   * the line; a catalogue house cannot put a baseless string on an albarán. */
  const oneOffs = grants.assortment === 'one-offs';
  /* the words claimed no catalogue row, so what is written IS the goods */
  const bareWord = base ? '' : (read?.said ?? '').trim();
  const bare = oneOffs && !base && bareWord.length > 0;
  /** THE SENTENCE SUPPORTS A LINE — which is the whole of what Enter asks (§109.7): no confirm, no
   *  second press, no button on the way. A CATALOGUE WORD IS ENOUGH on its own, because the sheet
   *  prices it.
   *
   *  A ONE-OFF STILL NEEDS ITS NUMBER, and that is a fact about the ledger rather than a gate this
   *  surface invented: `sale.ts` reads a line added at zero as «at no charge» (`freebie: price ===
   *  0`), so a one-off written before anybody priced it would print AS A GIFT on a customer's
   *  albarán. Its rate seat stands in the money column beside the words — right of the midline,
   *  where §109.5 puts every price — and Enter in that seat is the same one press. */
  const captured = Boolean(chosenProduct) || Boolean(noneOfThese && choiceLiteral) || (bare && (!pricingAvailable || free || money > 0));

  /* ── WHAT THE READING COMES TO ──────────────────────────────────────────────────────────────
   * The amount, the unit and the words that ride the name are asked for in one place, so the money
   * column beside the sentence and the line the sentence writes can never describe two different
   * things. There is no second copy of these values anywhere: §109.7 took the draft stage out, so
   * the reading is the truth until Enter, and the ROW is the truth after it. */
  /* ── AND THE REVEALED SEAT WINS WHERE A HAND HAS TOUCHED IT (§109.6: always ready to edit) ──
   * The sentence's reading is the standing truth; a seat somebody typed into is theirs. So every
   * value below reads «what they wrote in the column, or what the words said» — one expression,
   * and no path where the columns and the line describe two different things. */
  const qty = qtySaid.trim() !== '' ? Number(qtySaid.replace(',', '.')) || 0 : read?.quantity ?? 1;
  const unit = (unitSaid.trim() || read?.unit || base?.unit || 'kg').trim();
  /* ── AND A GRADUATED MEMBER TAKES ITS BASE'S PRICE UNTIL THE HOUSE PRICES IT (C7) ───────────
   * «The same goods more precisely named» is `catalogue.ts`'s own sentence about what a graduation
   * makes, and it already carries the base's family, unit, weighing and traceability across. The
   * money has to cross with them: a member the house has not priced yet has no row in the price
   * list, so it fell to the price list's MEAN — a wrong number, on paper, at arm's length on a bay.
   * The one place a member's own price can come from is the shelf, and until it does the base's
   * price is the true one, because they are the same goods. */
  const priced = member
    ? cast.products.find((p) => p.id === graduatedBase(member.id)) ?? base
    : base;
  /** THEIR WORDS THAT NOTHING CLAIMED, PLUS THE SORT — the amendment, in THEIR writing order. The
   *  sort drops out of it where the house has graduated it and the line stands on it (C7). */
  const ridden = ridesOf(read, Boolean(member));
  const rides = typeSaid.trim() !== '' ? typeSaid.trim() : ridden;
  /** what the line goes on at: the sheet's number where the catalogue has one, the written one
   *  where nothing does, and nothing at all where nobody has said yet (§109.7) */
  /* ── AUTO-POPULATED FROM THE PERSON AND THEIR TARIFF (§116.2), UNTIL A HAND SAYS OTHERWISE ──
   * The catalogue prices its own goods off the band THIS DOCUMENT stands on, which is this
   * customer's own — so the price arrives already answered and nobody types a number that was
   * already known. A band picked in the price's dropdown re-prices this line off that band; a
   * number written in the same dropdown is an override and beats both (§116.3). */
  const rate = !pricingAvailable ? 0 : free
    ? 0
    : money > 0
      ? money
      : base
        ? (tierPick ? priceOn(cast, priced ?? base, tierPick, todayId(cast)) : priceOf(cast, priced ?? base))
        : money;

  /* ── ENTER MAKES THE ROW (FEED-IA §109.7: «NO "put it on the albarán" act. Boom.») ───────────
   * ⚠ THE SECOND ACT IS DEAD, AND SO IS THE DRAFT STAGE IT SERVED. What stood here was two
   * presses — «Continue» populated a draft row, «Put it on» wrote it — and §109.7 removes the
   * button that finishes a line outright. The resolution is not to hide the second press but to
   * see that §109.6 had already made it unnecessary: «any row is ALWAYS ready to edit — no edit
   * button, no edit mode». A populated draft and a written line are then the SAME OBJECT, and the
   * honest one is the written line. So the structure that materializes under the words IS the
   * albarán's own row — it lands at the y the field was standing on, at the same band height, with
   * every seat live — and the field stays open underneath it for the next sentence.
   *
   * ONE PRESS, ONE ROAD. Enter runs this; «Continue» runs this; they are the same act reached by a
   * hand or by a caret, and nothing stands between the words and the row.
   */
  const put = () => {
    if (noneOfThese && choiceLiteral) {
      addBareLine(sale, now, choiceLiteral, qty, unit, 0);
      if (inventoryAvailable && lotSaid.trim()) {
        attachLots(sale, now, [{ line: `x${sale.lines.length + 1}`, allocations: [{ batch: lotSaid.trim(), qty }] }]);
      }
    } else if (chosenProduct && base) {
      /* §80.3 — THE INFORMED APPROACH, in the grammar the app already speaks. An ambiguous word
         is FILLED and SAID: the line carries what was asked and what it was filled with, which
         `fillWords` draws as «they asked for “merluza” · filled with Merluza — what you had» and
         the card summarises. A plain resolution passes nothing and the line stays silent. */
      addLine(sale, now, base, qty, unit, rate,
        /* THE WORD THEY SAID FOR THE GOODS, not the sentence they typed. `read.name.said` is the
           part the reference answered on — «merluza» out of «12 kg merluza» — so the reading
           quotes what was ambiguous rather than the amount beside it. */
        said.ambiguous ? (read?.name?.said ?? '').trim() || undefined : undefined);
      if (skuChoiceNeeded && selectedSku) {
        const id = `x${sale.lines.length + 1}`;
        chooseLineSku(sale, now, { id, product: base, asked: (read?.name?.said ?? '').trim() } as SaleLine, selectedSku);
      }
      /* THE PARTS RIDE THE LINE THE FOLD JUST GREW. It is the last one on the sale, so every part
         goes on it by the same id the add event minted — the amendment as an `amend`, the grade
         and the dimensions as one `line`. No path here invents an event either (§41.4).
         THE QUALIFIERS LAND IN THEIR OWN COLUMNS, which is §109.6's own sentence about «merluza
         6kg 2ª»: the amount and unit rode the add itself, every closed register the family answered
         on comes across here, and only what nothing claimed rides the name.
         ⚠ THE GRADE IS NOT ONE OF THEM ANY MORE (FEED-IA §197.2): «2ª» claims nothing, so it is one
         of THEIR words and rides the name with the rest (§41.5). */
      const id = `x${sale.lines.length + 1}`;
      if (rides) amendLine(sale, now, id, rides);
      const set = Object.fromEntries(Object.entries(read?.dimensions ?? {}).filter(([, w]) => Boolean(w)));
      if (Object.keys(set).length > 0) editLine(sale, now, id, { dimensions: set as LineDimensions });
      /* ── AND THE LOTE, WHICH THE REVEAL NOW ASKS FOR (FEED-IA §115.1) ────────────────────
         «Below that, it should show the class and the lots.» So the lote is answered on the row
         being written rather than found later on the row that exists — and it lands as the SAME
         allocation `LotField` writes, because a lote written here and a lote written there are
         one fact about where these goods came off (§41.4: no path invents an event). */
      if (inventoryAvailable && lotSaid.trim()) {
        attachLots(sale, now, [{ line: id, allocations: [{ batch: lotSaid.trim(), qty }] }]);
      }
    } else {
      if (!bare) return;
      addBareLine(sale, now, bareWord, qty, unit, rate);
      if (inventoryAvailable && lotSaid.trim()) {
        /* the same id the add event minted, read the way the catalogue branch above reads it */
        attachLots(sale, now, [{ line: `x${sale.lines.length + 1}`, allocations: [{ batch: lotSaid.trim(), qty }] }]);
      }
    }
    /* AND THE FIELD IS READY AGAIN, EMPTY, WITH THE CARET IN IT — which is how an albarán is
       actually written: one line after another, with nothing to press between them. The seed
       changes, so React mounts a fresh organ with the caret already in it, and the beats start
       over at BEAT 1: an empty field, nothing under it (§115.1). */
    reset();
    setSeed((n) => n + 1);
  };

  /* THE SWITCH THAT ANSWERS THE PRICE (§51.6). It rides the price column's own side of the row,
     under the value it replaces, because that is the question it answers — never floating in the
     white on the left. */
  const freeSwitch = (
    <Checkbox
      checked={free}
      onChange={() => setFree((v) => !v)}
      overrides={{ Root: { props: { 'data-testid': 'add-freebie' } }, Label: { style: { paddingLeft: theme.sizing.scale200 } } }}
    >
      <span style={{ ...theme.typography.LabelXSmall, whiteSpace: 'nowrap' }}>Free of charge</span>
    </Checkbox>
  );
  /* ── THE COLUMN (FEED-IA §115.1 · §116.2) ───────────────────────────────────────────────────
   * «It should show the … in COLUMNS», so a column is a LABEL over a VALUE in a fixed seat, and
   * the label is what makes the set self-comprehensible at a glance (§51.24: a heading names the
   * thing, blatantly). The caption is the smallest step in tertiary ink; the value carries weight.
   *
   * ⚠ IT IS A FUNCTION AND NOT A COMPONENT, AND THAT IS LOAD-BEARING. Declared inside this body,
   * a component gets a NEW TYPE IDENTITY on every render — React then unmounts its subtree and
   * mounts a fresh one on every keystroke, and the caret in the quantity would be destroyed by
   * the character that was just typed. It is the same law `chip-entry.tsx` learned the hard way:
   * a live surface may re-PAINT anything and may re-PARENT nothing that can hold a caret. Called
   * as a function, the elements it returns are plain spans with stable types, so nothing moves.
   */
  const column = (
    name: string,
    testid: string,
    grow: number,
    lead: boolean,
    body: React.ReactNode,
  ) => (
    <span
      data-testid={testid}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: lead ? 'flex-start' : 'center',
        justifyContent: 'flex-start',
        gap: theme.sizing.scale100,
        flex: `${grow} 1 0`,
        minWidth: 0,
      }}
    >
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}
      >
        {name}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: lead ? 'flex-start' : 'center', minWidth: 0 }}>
        {body}
      </span>
    </span>
  );

  /** the seats the reveal opens are all the same small field, so the five columns read as one row
   *  of one kind of thing rather than five controls somebody assembled (§51.24) */
  const seatInput = (
    testid: string,
    label: string,
    value: string,
    onValue: (next: string) => void,
    extra?: { end?: React.ReactNode; ref?: React.MutableRefObject<HTMLInputElement | null>; mode?: 'decimal' | 'text'; hint?: string },
  ) => (
    <Input
      size={SIZE.compact}
      value={value}
      placeholder={extra?.hint}
      aria-label={label}
      endEnhancer={extra?.end}
      inputRef={extra?.ref}
      onChange={(e) => onValue((e.target as HTMLInputElement).value)}
      /* ENTER IS THE SAME ONE PRESS IN EVERY SEAT (§109.7). A person who corrected the quantity
         and pressed Enter has finished the line; the caret never has to travel back to a button. */
      onKeyDown={(e) => { if (e.key === 'Enter' && captured) { e.preventDefault(); put(); } }}
      overrides={{
        Input: { props: { 'data-testid': testid, inputMode: extra?.mode ?? 'text' } },
        Root: { style: { width: '100%' } },
        EndEnhancer: {
          style: {
            ...theme.typography.LabelXSmall,
            whiteSpace: 'nowrap',
            backgroundColor: 'transparent',
            paddingLeft: theme.sizing.scale100,
            paddingRight: theme.sizing.scale300,
          },
        },
      }}
    />
  );

  /** THE LOT IS SMALL, AND IT BELONGS TO THE NAME (§116.2). A caption in front of a short seat,
   *  at the smallest step — so the fact sits under the goods without becoming another column of
   *  the form. ⚠ CLASS STOOD BESIDE IT UNTIL §197.2 («Remove class everywhere»); the seat is now
   *  the lot alone, which is the one temporal fact that is ours to know (§193.4). */
  const smallSeat = (
    testid: string,
    caption: string,
    label: string,
    value: string,
    onValue: (next: string) => void,
  ) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}>
        {caption}
      </span>
      <span style={{ width: phone ? 72 : 92 }}>
        <Input
          size={SIZE.mini}
          value={value}
          placeholder="—"
          aria-label={label}
          onChange={(e) => onValue((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && captured) { e.preventDefault(); put(); } }}
          overrides={{ Input: { props: { 'data-testid': testid } } }}
        />
      </span>
    </span>
  );

  /* ── THE REVEAL'S MOTION (FEED-IA §59.1 · §115.1) ────────────────────────────────────────────
   * The columns arrive; they do not JUMP in. One transition, on the theme's own timing and the
   * theme's own easing, on opacity and a 6px rise — paint only, so not one pixel of layout is
   * being animated and nothing under this row can be shoved by the reveal. A reader who has asked
   * for less motion gets the same columns with no travel at all, which is the whole of what that
   * setting means. */
  const revealed = css({
    animationName: {
      from: { opacity: 0, transform: 'translateY(6px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    } as unknown as string,
    animationDuration: theme.animation.timing400,
    animationTimingFunction: theme.animation.easeOutCurve,
    animationFillMode: 'both',
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0ms' },
  });

  return (
    <div
      data-testid="add-line-seat"
      /* ── THE ADD ROW IS CENTRED, AND IT BREATHES ABOVE ITS RULE (round 5, V4) ────────────────
         «Add item should be CENTRED and INCREASE THE PADDING ABOVE the divider line.» The rule is
         the divider; the space above it is the LIST's last breath before the growth point, so it
         is `marginTop` on this seat rather than padding inside the button — a padding inside would
         have moved the row's own floor and broken the one-height law the band below states. */
      style={{ display: 'flex', flexDirection: 'column', marginTop: theme.sizing.scale300, minWidth: 0 }}
    >
      {/* ── CLOSED: A ROW OF THE LIST, AT THE ROWS' OWN HEIGHT (FEED-IA §84.2 · §84.3) ────────
          «Why is the button for that above, and why is the new line so tall.» It was a mini
          BUTTON floating in a padded block — a control that had nothing to do with the rows it
          adds to. It is a ROW now, the last one of the list: the plus in the seat the lines give
          their painting, the words on the x every line's name starts at, on the same floor every
          line in the list stands on. Nothing announces it (§51.7, §51.24) — the row names the act. */}
      {!open ? (
        <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="add-line" aria-expanded={false}
          onClick={() => setOpen(true)} startEnhancer={<Glyph id="plus" size={16} />}
          overrides={{ BaseButton: { style: { minHeight: phone ? '44px' : undefined, alignSelf: 'flex-start', marginLeft: theme.sizing.scale500,
            marginTop: theme.sizing.scale300, marginBottom: theme.sizing.scale300 } } }}>
          Add line
        </Button>
      ) : (
        /* ══ OPEN: THE FILM, BEAT BY BEAT (FEED-IA §115.1 · §115.6, superseding §109.6's shape) ══
           «You didn't change anything. It's still really bad, and I don't think you understand.»
           Four sentences, and they are the whole surface:

             BEAT 1 · THE FIELD    An EMPTY field, full width, the face in the lines' own seat.
                                   NO PRICE ON IT — «when you add a new line item, it shouldn't
                                   have the price on it at all». NOTHING UNDER IT — «it shouldn't
                                   have the recommendations at the bottom». What is offered lives
                                   in a dropdown behind the field's own control (§113), wearing the
                                   REWIND mark, because what it opens is this account's own past
                                   orders (§131.4). No camera: that control is Stock's.

             BEAT 2 · THE REVEAL   «Once they press Enter, it should show the name, the thing, the
                                   type, the unit, the quantity, and the price in columns. Below
                                   that, class and lots.» CENTERED. NO FOLD — the set wraps at 390
                                   and never scrolls sideways. The caret lands in the QUANTITY,
                                   because the name is the question that was just answered and the
                                   amount is the next one (§76: one clear task at a time).

             BEAT 3 · IT LANDS     Enter again — from any seat — and the line joins the albarán at
                                   this row's own y; the field stands empty underneath for the next
                                   sentence. The reveal WAS the review §76 asks for, so there is no
                                   are-you-sure between the columns and the row (§115.3).

           ⚠ WHAT LEFT, AND WHY. The money column that used to ride inside the band while the
           sentence was still being said is GONE from BEAT 1: it put a price on a fresh line, which
           is the first thing he struck out. It comes back in BEAT 2 as the last COLUMN, right of
           the quantity, which is also the side §109.5 fixed for a price. The reserved tail seat
           went with it — a row with nothing to delete needs no trash column, and the width it held
           is what lets five columns stand at 390 without a fold. */
        <div
          data-testid="line-picker"
          data-add-stage={stage}
          /* ESC RELEASES THE INNERMOST THING FIRST (§32.A). The reveal is inside the row, so the
             first press walks back to the field and the second closes the row — and neither one
             reaches the sweep's narrow while there is something here to release. */
          onKeyDown={(e) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            e.preventDefault();
            e.stopPropagation();
            if (stage === 'seen') { setStage('say'); return; }
            setOpen(false);
          }}
          style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
        >
          {stage === 'say' ? (
            /* ── BEAT 1 · THE FIELD, AND NOTHING ELSE ────────────────────────────────────────
               One row, full width, at the floor every line stands on. The organ hands the parse
               back on every keystroke; Enter reveals the columns. */
            <div style={{ padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`, minWidth: 0 }}>
              <ChipEntry
                key={seed}
                registers={registers}
                family={familyMarkOf(config.cast)}
                autoFocus
                /* THE PLACEHOLDER IS THE ORGAN'S OWN (§116.4). «Free-form means type ANYTHING —
                   we recognize it — and the filler text says so.» One sentence, one canon, every
                   surface that mounts this field; a per-surface override would be three of them. */
                data-testid="add-chips"
                initial={words}
                row={{ mark: 'add', floor: LINE_BAND, padX: 0, padY: 0, seat: 36 }}
                onChange={(next) => { setRead(next); setWords(next.said ?? ''); }}
                /* ⚠ THE CAMERA LEFT THIS FIELD (FEED-IA §131.4, his correction) ─────────────
                   «Also the camera icon I said is for the STOCK shit, not the albarán field.»
                   §111.2 put it here on the reading that «when they type the name is when they'd
                   have the option of photographing a document» — and the document a hand reaches
                   for at that moment is a SUPPLIER's, which is Stock's intake and not this. The
                   organ draws no camera when no handler is given, so the correction is the two
                   props not being passed; `capture.tsx` and Stock's own field keep theirs.

                   ── AND THE MARK IN THE FIELD IS THE REWIND (§131.4) ──────────────────────
                   «The rocoto logo icon should actually be in this case a products icon as it's
                   their common products, or actually be a rewind kinda icon like the one I
                   showed.» The door opens what THIS ACCOUNT KEEPS ORDERING — their own past — so
                   it wears the rewind and not Rocoto's face (§116.1's default, topically
                   overridden exactly where he asked for it). */
                offerMark="rewind"
                /* ENTER REVEALS THE COLUMNS (§115.1). It is the first of the two presses that
                   write a line, and the only one this beat has. */
                onCommit={(next) => {
                  const words_ = (next.said ?? '').trim();
                  if (words_ === '') return;
                  setRead(next);
                  setWords(words_);
                  setStage('seen');
                }}
              />
            </div>
          ) : (
            /* ── BEAT 2 · THE REVEAL, COLUMNIZED (FEED-IA §116.2 — THE FINISHED FORM) ────────
               «Enter → the structure populates, columnized: Column 1 (bigger) TYPE + SORT in
               one · Column 2 QUANTITY with the UNIT editable, two subcolumns · Column 3 PRICE,
               auto-populated from the person and their tariff. CLASS and LOT small below the
               name column. That is the finished form of any product line in the delivery note.»

               ⚠ IT SUPERSEDES §115.1's FIVE. That reading had name · type · unit · quantity ·
               price as five equal seats and the small pair on their own row underneath the set;
               §116.2 folds type and sort into ONE bigger column, pairs quantity with its unit as
               subcolumns of a single question, and puts the small facts UNDER THE NAME, where
               they belong to the goods rather than to the row. Three columns read as three
               questions; five read as a form.

               ⚠ AND THE PAIR IS NOW ONE (FEED-IA §197.2 «Remove class everywhere»): the lote
               stands under the name alone.

               EVERY SEAT IS LIVE FROM THE FIRST FRAME (§109.6: no edit button, no edit mode),
               and the name walks back to BEAT 1 with the words intact — because the words ARE
               the name's editor and there is only ever one of them. */
            <div
              className={revealed}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: theme.sizing.scale400,
                padding: `${theme.sizing.scale500} ${theme.sizing.scale500} ${theme.sizing.scale400}`,
                minWidth: 0,
              }}
            >
              {/* THE THREE COLUMNS. `flexWrap` and nothing else is what «no fold» means at 390:
                  the set folds onto a second line rather than running off the edge, and this row
                  is the only place in the composer that may wrap (§77.2's overflow law). */}
              <div
                data-testid="add-columns"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  gap: phone ? theme.sizing.scale400 : theme.sizing.scale700,
                  flexWrap: 'wrap',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                {/* ── COLUMN 1 · THE GOODS — TYPE AND SORT IN ONE, AND IT IS THE BIGGER ONE ──
                    «Column 1 (bigger): TYPE + SORT in one.» The kind and the word that rides it
                    are ONE thing to a person reading a line — «Merluza · de pincho» — so they
                    share a seat and a target: pressing either walks back to the words, which is
                    the one editor both of them have (§109.6).
                    CLASS AND LOT SIT SMALL UNDER IT, because they are facts about these goods
                    and not measurements of this row (§109.3: class first, then lot). */}
                {column('Type', 'add-col-name', 3, true, (
                  <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, width: '100%', minWidth: 0 }}>
                    <button
                      type="button"
                      data-testid="add-name"
                      data-sort={rides || undefined}
                      aria-label="The words on this line"
                      onClick={() => setStage('say')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.sizing.scale300,
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        font: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                        minWidth: 0,
                        maxWidth: '100%',
                      }}
                    >
                      <Face
                        name={read?.node ? read.face : null}
                        family={familyMarkOf(config.cast)}
                        size={32}
                      />
                      <span data-testid={skuChoiceNeeded ? 'add-sku-source' : undefined}
                        style={{
                          ...theme.typography.LabelMedium,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0,
                          color: skuChoiceNeeded ? theme.colors.accent : undefined,
                          fontStyle: skuChoiceNeeded ? 'italic' : undefined,
                        }}
                      >
                        {skuChoiceNeeded ? (read?.name?.said ?? words) : base ? base.name : bareWord}
                        {rides && (
                          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                            {' · '}{rides}
                          </span>
                        )}
                      </span>
                    </button>
                    {skuChoiceNeeded && (
                      <span data-testid="add-sku-choice" role="group" aria-label="Choose the product"
                        style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200, minWidth: 0 }}>
                        {skuChoices.map((product) => (
                          <Button key={product.id} kind={skuPick === product.id ? KIND.primary : KIND.secondary} size={SIZE.compact}
                            data-testid={`add-sku-choice-${product.id}`}
                            onClick={() => setSkuPick(product.id)}
                            startEnhancer={<ProductFace of={{ ...product, sector: cast.sector }} size={28} />}
                            overrides={{ BaseButton: { style: { justifyContent: 'flex-start', textAlign: 'left', height: 'auto', minWidth: 0 } } }}
                          >
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                              <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'normal' }}>{product.name}</span>
                              <span data-testid={`add-sku-choice-${product.id}-meta`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, whiteSpace: 'normal' }}>
                                {product.code ? <><ProductCode code={product.code} /> · </> : ''}{product.unit}
                              </span>
                            </span>
                          </Button>
                        ))}
                        <Button kind={noneOfThese ? KIND.primary : KIND.tertiary} size={SIZE.compact}
                          data-testid="add-sku-choice-none" onClick={() => setSkuPick('__none__')}>
                          Something else
                        </Button>
                      </span>
                    )}

                    {/* THE LOTE — SMALL, BELOW THE NAME (§116.2). One quiet seat at the smallest
                        step. ⚠ CLASS SAT IN FRONT OF IT UNTIL FEED-IA §197.2 «Remove class
                        everywhere»; §193.4's top-down reading leaves the lot alone here. */}
                    {inventoryAvailable && (
                      <span
                        data-testid="add-below"
                        style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}
                      >
                        {smallSeat('add-lote', 'Lote', 'The lote on the box', lotSaid, setLotSaid)}
                      </span>
                    )}
                  </span>
                ))}

                {/* ── COLUMN 2 · THE QUANTITY, WITH ITS UNIT EDITABLE — TWO SUBCOLUMNS (§116.2)
                    They are one question asked in two halves, so they share a column and stand
                    side by side inside it. The unit is a SEAT and not a label: «Column 2:
                    QUANTITY with the UNIT editable.» */}
                {column('Quantity', 'add-col-quantity', 2, false, (
                  <span
                    data-testid="add-quantity-pair"
                    style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, width: '100%', minWidth: 0 }}
                  >
                    <span data-testid="add-sub-amount" style={{ flex: '2 1 0', minWidth: 0 }}>
                      {seatInput(
                        'add-quantity',
                        'How much',
                        qtySaid !== '' ? qtySaid : String(read?.quantity ?? ''),
                        setQtySaid,
                        { ref: amountRef, mode: 'decimal', hint: '1' },
                      )}
                    </span>
                    <span data-testid="add-sub-unit" style={{ flex: '1 1 0', minWidth: 0 }}>
                      {seatInput('add-unit', 'Unit', unitSaid || unit, setUnitSaid)}
                    </span>
                  </span>
                ))}

                {/* ── COLUMN 3 · THE PRICE, AND IT IS CIRCULAR (FEED-IA §116.2 · §116.3) ──────
                    «Column 3: PRICE — auto-populated from the person and their tariff.» It
                    arrives already answered, off the band this document prices on, which is the
                    person's own. And «tap price → it IMMEDIATELY shows the dropdown of their
                    tariffs; free-form override also possible; at the bottom, Edit tariffs →
                    opens THE SAME modal the catalog uses. Everything is nice and circular.» */}
                {pricingAvailable && column('Price', 'add-col-price', 2, false, (
                  free ? (
                    <span data-testid="add-price" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
                      Free of charge
                    </span>
                  ) : base ? (
                    <Popover
                      isOpen={priceDoor}
                      placement={PLACEMENT.bottom}
                      autoFocus={false}
                      onClickOutside={() => setPriceDoor(false)}
                      onEsc={() => setPriceDoor(false)}
                      overrides={{ Body: { style: { zIndex: LAYER } } }}
                      content={() => (
                        <div
                          data-testid="add-price-tariffs"
                          style={{ minWidth: 240, padding: theme.sizing.scale200, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}
                        >
                          {/* THEIR TARIFAS, EACH CARRYING WHAT IT WOULD PRICE THESE GOODS AT —
                              the answer beside the name, so the choice is legible before the
                              press (§80.3) and never a word a person has to translate. */}
                          {tiersOfHouse(cast).map((t) => {
                            const on = (tierPick ?? sale.tier) === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                role="option"
                                aria-selected={on}
                                data-testid={`add-tariff-${t.id}`}
                                data-on={on ? 'yes' : 'no'}
                                onClick={() => { setTierPick(t.id); setMoney(0); setPriceDoor(false); }}
                                className={css({
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: theme.sizing.scale300,
                                  width: '100%',
                                  padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`,
                                  border: 'none',
                                  borderRadius: theme.borders.radius100,
                                  background: on ? theme.colors.backgroundSecondary : 'transparent',
                                  color: theme.colors.contentPrimary,
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                  textAlign: 'left',
                                  ':hover': { background: theme.colors.backgroundSecondary },
                                })}
                              >
                                <span style={{ ...theme.typography.LabelSmall, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {t.name}
                                </span>
                                <Figure value={priceOn(cast, priced ?? base, t.id, todayId(cast))} unit={`S/ per ${unit}`} size="mini" />
                              </button>
                            );
                          })}

                          {/* THE FREE-FORM OVERRIDE, IN THE SAME DROPDOWN (§116.3). A price
                              somebody writes here is theirs and the band stops governing this
                              line — which is what an override is. */}
                          <span style={{ padding: `0 ${theme.sizing.scale200}` }}>
                            <Input
                              size={SIZE.compact}
                              value={money === 0 ? '' : String(syntheticAmountForCountry(money, workspaceCapabilitiesNow().country))}
                              placeholder="0,00"
                              aria-label="Write the price yourself"
                              endEnhancer={<span style={{ ...theme.typography.LabelXSmall, whiteSpace: 'nowrap' }}>{`${workspaceCurrency() === 'EUR' ? '€' : 'S/'} per ${unit}`}</span>}
                              onChange={(e) => { setTierPick(null); setMoney(canonicalSyntheticAmount(Number((e.target as HTMLInputElement).value.replace(',', '.')) || 0)); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setPriceDoor(false); } }}
                              overrides={{
                                Input: { props: { 'data-testid': 'add-price-field', inputMode: 'decimal' } },
                                EndEnhancer: { style: { ...theme.typography.LabelXSmall, whiteSpace: 'nowrap', backgroundColor: 'transparent', paddingLeft: theme.sizing.scale100 } },
                              }}
                            />
                          </span>

                          {/* THE FOOT, AND IT CLOSES THE CIRCLE (§116.3). «Edit tariffs → opens
                              THE SAME modal the catalog uses» — this app's catalogue edits a
                              product's bands on the product's own sheet (`ProductTarifas`), so
                              the door opens THAT sheet and nothing is built twice. */}
                          {onOpenCard && (
                            <button
                              type="button"
                              data-testid="add-edit-tariffs"
                              onClick={() => { setPriceDoor(false); onOpenCard(priced ?? base); }}
                              className={css({
                                display: 'flex',
                                alignItems: 'center',
                                gap: theme.sizing.scale200,
                                width: '100%',
                                padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`,
                                border: 'none',
                                borderTop: `1px solid ${theme.colors.borderOpaque}`,
                                background: 'transparent',
                                ...theme.typography.LabelSmall,
                                color: theme.colors.contentSecondary,
                                cursor: 'pointer',
                                textAlign: 'left',
                                ':hover': { color: theme.colors.contentPrimary },
                              })}
                            >
                              Edit tariffs
                            </button>
                          )}
                        </div>
                      )}
                    >
                      {/* THE FIGURE IS THE CONTROL (§31.3 · §76: the number IS the thing). The
                          unit shares the number's own line box, at every width — a unit that
                          drops below its figure at 390 is the price-unit mis-sale. */}
                      <button
                        type="button"
                        data-testid="add-price"
                        data-rate={rate}
                        data-tier={tierPick ?? sale.tier}
                        aria-haspopup="listbox"
                        aria-expanded={priceDoor}
                        aria-label="What this line goes on at"
                        onClick={() => setPriceDoor((v) => !v)}
                        className={css({
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: theme.sizing.scale200,
                          padding: `${theme.sizing.scale100} ${theme.sizing.scale200}`,
                          border: 'none',
                          borderRadius: theme.borders.radius100,
                          background: 'transparent',
                          color: theme.colors.contentPrimary,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          whiteSpace: 'nowrap',
                          ':hover': { background: theme.colors.backgroundSecondary },
                        })}
                      >
                        <Figure value={rate} unit={`S/ per ${unit}`} size="compact" />
                      </button>
                    </Popover>
                  ) : (
                    /* A WORD NOTHING ANSWERED HAS NO BAND TO PRICE FROM, so its seat is the
                       field itself — the same free-form the dropdown carries, standing alone. */
                    <span data-testid="add-price" style={{ width: '100%' }}>
                      <Input
                        size={SIZE.compact}
                        value={money === 0 ? '' : String(syntheticAmountForCountry(money, workspaceCapabilitiesNow().country))}
                        placeholder="0,00"
                        aria-label="What it goes on at"
                        endEnhancer={<span style={{ ...theme.typography.LabelXSmall, whiteSpace: 'nowrap' }}>{`${workspaceCurrency() === 'EUR' ? '€' : 'S/'} per ${unit}`}</span>}
                        onChange={(e) => setMoney(canonicalSyntheticAmount(Number((e.target as HTMLInputElement).value.replace(',', '.')) || 0))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && captured) { e.preventDefault(); put(); } }}
                        overrides={{
                          Input: { props: { 'data-testid': 'add-price-field', inputMode: 'decimal' } },
                          EndEnhancer: { style: { ...theme.typography.LabelXSmall, whiteSpace: 'nowrap', backgroundColor: 'transparent', paddingLeft: theme.sizing.scale100 } },
                        }}
                      />
                    </span>
                  )
                ))}
              </div>

              {/* ── THE ROW'S OWN MARGIN (§14) — what is ABOUT this line and is not this line ──
                  What an ambiguous word was filled with, where the price came from, the answer to
                  the price question, and the act. It is the LAST thing on the beat, under the
                  facts it is about, and every one of these dies the moment the row lands. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.sizing.scale400,
                  flexWrap: 'wrap',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                {/* §80.3 — THE CHOICE IS LEGIBLE BEFORE THE PRESS, not only after it. The word
                    named a family the house sells several forms of, so the reveal says which form
                    it took and how many there were, while the person can still change it. */}
                {skuChoiceNeeded && (
                  <span data-testid="add-ambiguity" data-forms={skuChoices.length}
                    style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.accent, minWidth: 0 }}>
                    {selectedSku ? `Selected: ${selectedSku.name}` : noneOfThese ? `One-off: ${choiceLiteral}` : 'Choose the product before adding this line.'}
                  </span>
                )}
                {/* WHERE THIS PRICE CAME FROM — the fact the price column carries as its note. */}
                {pricingAvailable && base && !free && sourceWords(lastSetOf(base, sale.tier)) && (
                  <span
                    data-testid="add-price-source"
                    style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}
                  >
                    {sourceWords(lastSetOf(base, sale.tier))}
                  </span>
                )}
                {pricingAvailable && freeSwitch}
                {/* THE ACT, AND IT IS THE SAME ACT ENTER RUNS (§109.7 · §115.1's third beat).
                    «Continue» is his word and never «Next» (§108.1) — one press from the columns
                    to the row, for a hand that would rather press than type. Nothing stands after
                    it, and nothing asks whether they are sure (§115.3). */}
                <Button
                  kind={KIND.primary}
                  size={SIZE.mini}
                  disabled={!captured}
                  data-testid="add-continue"
                  onClick={() => put()}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* §143 supersedes §51.10 and §131.3: this is a read-only source record.
 * Replying and resolving conversation concerns live in the actual chat. */
const Conversation = SourceThread;

const OUTCOMES: Outcome[] = [
  {
    id: 'credit',
    label: 'Credit the line',
    detail: 'The line comes off what they owe, and the delivery note keeps the record of what went out.',
  },
  {
    id: 'replace',
    label: 'Send a replacement',
    detail: 'A replacement goes on tomorrow’s round, on this delivery note’s own reference.',
  },
  {
    id: 'stands',
    label: 'The delivery note stands',
    detail: 'The document is right as it is, and the answer to them says why.',
  },
];

function Complaint({ sale, cast }: { sale: Sale; cast: Cast }) {
  const [, theme] = useStyletron();
  const [outcome, setOutcome] = React.useState(sale.dispute?.outcome ?? OUTCOMES[0].id);
  const now = nowOf(cast);
  const chosen = OUTCOMES.find((o) => o.id === outcome) ?? OUTCOMES[0];

  return (
    <div
      data-testid="complaint"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale400,
        padding: theme.sizing.scale500,
        borderRadius: theme.borders.radius300,
        border: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      <div style={{ ...theme.typography.LabelSmall }}>
        They declined delivery note {sale.number} at {sale.dispute?.at}
      </div>
      <p style={{ margin: 0, ...theme.typography.ParagraphSmall }}>{sale.dispute?.because}</p>
      <ButtonGroup
        mode={MODE.radio}
        size={SIZE.mini}
        kind={KIND.secondary}
        selected={OUTCOMES.findIndex((o) => o.id === outcome)}
        onClick={(_e, i) => setOutcome(OUTCOMES[i].id)}
      >
        {OUTCOMES.map((o) => (
          <Button key={o.id} data-testid={`outcome-${o.id}`}>{o.label}</Button>
        ))}
      </ButtonGroup>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
        {chosen.detail}
      </span>
      <div>
        <Button
          kind={KIND.primary}
          size={SIZE.compact}
          data-testid="resolve"
          onClick={() => resolveSale(sale, now, outcome)}
        >
          Settle it
        </Button>
      </div>
    </div>
  );
}

/* ── THE CHANGE, AND WHAT IT REACHES ──────────────────────────────────────────────────────────
 * U11 re-housed. Under the sale model the change is a fact about THIS object, so its blast radius
 * belongs on the sale's own screen and it opens IN PLACE rather than as a layer over a layer.
 */

function Notice({
  sale,
  cast,
  derived,
  onBack,
}: {
  sale: Sale;
  cast: Cast;
  derived: Derived;
  onBack: () => void;
}) {
  const [, theme] = useStyletron();
  const edits = useDay(cast.sector);
  const change = sale.changed!;
  const raised = productOf(cast, change.raised.product);
  const dropped = productOf(cast, change.dropped.product);
  const travelled = RANK[sale.state] >= RANK.made;
  const outcome = edits.notice[sale.id] ?? 'leave';

  const rows: NoticeRow[] = [
    {
      id: 'lines',
      what: <>The sale’s lines</>,
      ref: 'today',
      when: `recorded ${sale.at}`,
      figure: { value: change.raised.qty + change.more, was: change.raised.qty, unit: change.raised.unit },
      state: 'reopens',
      consequence: <>The line for <Name of={raised} /> is drawn again at the new quantity.</>,
    },
    ...(change.raised.lot
      ? [{
          id: 'lot',
          what: <>Reserved on {change.raised.lot}</>,
          ref: 'goods',
          state: 'reopens' as const,
          consequence: 'The reservation is drawn again at the new quantity.',
        }]
      : []),
    ...(travelled
      ? [
          {
            id: 'albaran',
            what: <>Delivery Note {sale.number}</>,
            ref: 'dispatch',
            when: `made ${sale.stamps.make ?? sale.at}`,
            state: 'reopens' as const,
            consequence: 'The document is drawn again with the line at the new quantity.',
          },
          {
            id: 'file',
            what: <>Today’s file</>,
            ref: 'today',
            state: 'reopens' as const,
            consequence: `The line reaches ${derived.erp.label} with the next file.`,
          },
        ]
      : []),
  ];

  const reopens = rows.filter((r) => r.state === 'reopens').length;

  const outcomes: Outcome[] = [
    {
      id: 'apply',
      label: 'Apply to the lines',
      detail: (
        <>
          The sale carries {change.raised.qty + change.more} {change.raised.unit} of{' '}
          <Name of={raised} />, and <Name of={dropped} /> comes off it.
        </>
      ),
    },
    ...(reopens > 0
      ? [{
          id: 'reopen',
          label: 'Reopen what it reaches',
          detail: `The ${reopens} ${reopens === 1 ? 'record' : 'records'} marked Reopens come back for a second pass; the rest stand.`,
        }]
      : []),
  ];

  return (
    <div data-testid="sale-notice" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, padding: theme.sizing.scale600, minWidth: 0 }}>
      <div>
        <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onBack} data-testid="notice-back">
          Back to the sale
        </Button>
      </div>
      <ChangeNotice
        what={
          <>
            <Name of={sale.customer} /> raised <Name of={raised} /> to{' '}
            {change.raised.qty + change.more} {change.raised.unit} and took <Name of={dropped} /> off
          </>
        }
        anchor={sale.deliveryDay}
        when={`recorded ${sale.at}, changed ${change.at}`}
        rows={rows}
        empty={<>The change lands on the sale’s lines and stops there.</>}
        outcomes={outcomes}
        outcome={outcome}
        onOutcome={(id) => setDay((prev) => ({ notice: { ...prev.notice, [sale.id]: id } }))}
      />
    </div>
  );
}

/* ── THE GUARD (THE-APP-V2 §1.3 and §5.7, LOT-LAW §4) ─────────────────────────────────────────
 * Two sentences, ONE control with two phases, and the order matters:
 *   1 · THE PROPOSAL. Rocoto has read the batch book and knows the answer, so it offers it — one
 *       sentence per line, FIFO, attach-all in a tap, a chip per line for the batch the person
 *       would rather use. Saffron marks the proposal; attaching is ink.
 *   2 · «ARE YOU SURE?» — and only once the proposal has been dismissed or exhausted, because
 *       stating a legal consequence while still holding the answer in your hand is a lecture.
 */

export type GateAct = 'commit' | 'make';

export const gateNeeded = (cast: Cast, sale: Sale, sales: Sale[], inventoryEnabled = true, candidatesFor?: AllocationCandidatesFor): boolean =>
  (inventoryEnabled && proposeLots(cast, sale, sales, candidatesFor).length > 0) ||
  (inventoryEnabled ? guardsOf(cast, sale) : guardsOf(cast, sale).filter((guard) => guard.id !== 'law')).length > 0;

/* ══ THE FOUR OPERATIONAL ACTIONS (checkpoint §9) — READ HERE, OWNED BY P3 ═══════════════════
 * «Every meaningful decision should map to an action policy: ACT · CLARIFY · HOLD · HANDOFF. HOLD
 * and HANDOFF are successful outcomes when acting automatically would be unsafe.»
 *
 * ═══ THIS IS AN ADAPTER, AND IT SAYS SO ══════════════════════════════════════════════════════
 * `policyOf(sale)` belongs in `sale.ts` beside the predicates it reads, and the package that lands
 * it there is in flight. This surface needed the answer before that landed, so it asks the SAME
 * predicates in the same order rather than inventing a second opinion — `passesNet` and
 * `autoCommitted` for the safe ones, the escalation topics for the ones that belong to a person,
 * `answerOwed`/`standsInDay` for the rest. When the real fold lands, the body of this function
 * becomes one line — `policyOf(sale)` — and every caller is unchanged.
 *
 * NOTHING HERE IS A NUMBER (§9.13). There is no score, no percentage and no stored confidence: the
 * policy is a reading of facts the ledger already holds.
 */
export type ActionPolicy = 'ACT' | 'CLARIFY' | 'HOLD' | 'HANDOFF';

/** WHICH TOPIC ON THE HOUSE'S OWN ROUTING THIS DOCUMENT BELONGS TO, where it belongs to one. It is
 *  the axis the row already wears, read through the four topics the house has named. */
export function escalationOf(sale: Sale): EscalationTopic | null {
  if (sale.state === 'disputed') return 'claim';
  const axis = rubricOf(sale)?.klass;
  if (axis === 'complaint') return 'claim';
  /* over the house's own ceiling is the money question, which is what «price» routes (§5) */
  if (axis === 'ceiling') return 'price';
  /* `ask` IS the price question in this model — it is the one `AskControl` answers with «Today's
     price», and `sale.ts` writes it as «They ask the X price». `order` is the supply question and
     it routes NOWHERE: the house named four topics and asking for more gamba is none of them, so
     that one falls through to the desk rather than being posted to somebody it is not about. */
  if (sale.needsReply?.kind === 'ask') return 'price';
  return null;
}

export function reviewPolicy(sale: Sale, today: string): ActionPolicy {
  /* NOTHING TO DECIDE. It went through the net and nobody is holding it. */
  if (!isStanding(sale, today) && passesNet(sale)) return 'ACT';
  /* IT BELONGS TO A PERSON. A complaint, a price nobody has set, a house that has never ordered —
     the house named who takes each of those, so the document is theirs rather than the desk's. */
  if (escalationOf(sale)) return 'HANDOFF';
  /* THE SMALLEST USEFUL QUESTION IS AVAILABLE, so asking it is the act. */
  if (clarifyAsk(sale)) return 'CLARIFY';
  /* IT STANDS. «Do not reply yet — put it into the operator queue», which is where it already is. */
  if (answerOwed(sale) || standsInDay(sale)) return 'HOLD';
  return sale.autoCommitted ? 'ACT' : 'HOLD';
}

/** THE SMALLEST USEFUL QUESTION (checkpoint §9's CLARIFY), COMPOSED FROM THE DOCUMENT — never
 *  typed, and never an essay. One line, the way a person at the counter writes it, about the one
 *  line that is actually short of a fact. Where the document names no such line, there is no
 *  question to ask and this says so rather than inventing one. */
export function clarifyAsk(sale: Sale): { line: SaleLine; text: string } | null {
  /* THEY ASKED US. A document waiting on OUR sentence is not one to put a question back to. */
  if (sale.needsReply) return null;
  const unreadable = flagsOf(sale).find((f) => f.kind === 'unreadable');
  if (unreadable) return { line: unreadable.line, text: askWords(unreadable.line) };
  const off = openNonSku(sale)[0];
  if (off) return { line: off, text: `Quick one on the ${off.product.name} — what do you need there?` };
  const amount = flagsOf(sale).find((f) => f.kind === 'unusual' || f.kind === 'big');
  if (amount) {
    return {
      line: amount.line,
      text: `Confirming the ${amount.line.product.name} — ${qtyWords(amount.line.given, amount.line.unit)} for ${sale.deliveryDay}?`,
    };
  }
  return null;
}

/** ROCOTO PUTS THE QUESTION (checkpoint §9: «ask the customer the smallest useful question»). It
 *  goes out under Rocoto's own mark, in the thread the order already lives in (§90.1: comms IS the
 *  order's face), and the document keeps standing — a question is not an answer, and what it is
 *  waiting for has not arrived yet. */
export function clarifySale(sale: Sale, now: string): string | null {
  const ask = clarifyAsk(sale);
  if (!ask) return null;
  const says = `Asked ${sale.customer.name} about the ${ask.line.product.name}`;
  return reversible(says, () => { answerSale(sale, saleReplyHour(sale, now), ask.text); }) ? says : null;
}

/** WHO TAKES IT FROM HERE — the house's own routing, resolved to a person. */
export function handoffTo(sale: Sale, company: Company): Member | null {
  const topic = escalationOf(sale);
  if (!topic) return null;
  return personOf(company, company.escalation[topic]) ?? company.members[0] ?? null;
}

/** THE CONVERSATION MOVES TO A PERSON (checkpoint §9: «HANDOFF — assign it to the relevant
 *  person»; §5's routing decides who). Rocoto says the one holding line the agent seat already
 *  performs — «so a customer is never left holding silence» — and the document comes off the
 *  desk's own queue, which is what a successful handoff IS. */
export const HANDOVER_WORDS = 'One moment — I will check this one and come straight back to you.';

export function handoffSale(sale: Sale, company: Company, now: string): string | null {
  const who = handoffTo(sale, company);
  if (!who) return null;
  const says = `Handed to ${who.name}`;
  return reversible(says, () => { answerSale(sale, saleReplyHour(sale, now), HANDOVER_WORDS); }) ? says : null;
}

/** Do it, or ask first. */
export function askOrAct(
  cast: Cast,
  sale: Sale,
  sales: Sale[],
  act: GateAct,
  now: string,
  ask: () => void,
  inventoryEnabled = true,
  candidatesFor?: AllocationCandidatesFor,
): void {
  if (gateNeeded(cast, sale, sales, inventoryEnabled, candidatesFor)) {
    ask();
    return;
  }
  if (act === 'make') makeSale(sale, now);
  else commitSale(sale, now);
}

/* ── THE TWO VERBS, DECIDED (FEED-IA §51.9) ───────────────────────────────────────────────────
 * «Make the albarán vs Print it is unclear — why would printing be impossible before it is made?»
 *
 * THE QUESTION IS FAIR AND THE OLD WORD CAUSED IT. Printing was never gated — the press has stood
 * on every state of this dock since §24 — but a button that says MAKE claims the albarán does not
 * exist yet, and you cannot print a thing that does not exist. That is the whole confusion, and it
 * is in the word rather than in the machinery: §6.2 already says an order IS an albarán that has
 * not been committed, so the document exists from the moment it arrives.
 *
 * SO THE ACT IS RENAMED TO WHAT IT DOES. §6.3, in his own words: «Finalize = LOCK. Made means
 * locked in as the albarán.» The act freezes the goods and the money as what actually goes out:
 *
 *   LOCK IT     the lines are settled — what is on it now is what goes out. Reversible, and
 *               deliberately harder (§6.3), which is why it keeps a loud verb of its own.
 *   PRINT IT    always live, on every state, because printing is what CLOSES an albarán (§21) and
 *               a morning prints down a list (§20). It is never a consequence of locking.
 *
 * THEY ARE NOT FOLDED INTO ONE PRESS. Print-and-lock as a single act would take the decision away
 * from a person who prints a picking sheet before the scale has spoken — which the trade does every
 * morning — and it would make «print again» mean «lock again». Two acts, two words, one dock.
 *
 * AND THE LEDGER CARRIES THE WORD NOW. `primaryOf` and `callOf` in `sale.ts` both say «Lock it», so
 * the dock's own override of the ledger's verb has been taken out: one string, one file, and the
 * row and the sheet cannot become two vocabularies because there is only one place to read.
 */
const LOCK_VERB = 'Lock it';

const ACT_VERB: Record<GateAct, string> = { commit: 'Confirm', make: LOCK_VERB };

type AllocationDraft = { shares: LotShare[]; reason: string };

const allocationShares = (proposal: LotProposal): LotShare[] => proposal.allocations.map((allocation) => ({
  key: allocation.batch,
  lotId: allocation.batch,
  code: allocation.code ?? proposal.candidates.find((candidate) => candidate.batch === allocation.batch)?.code ?? allocation.batch,
  quantity: String(allocation.qty),
  existing: true,
}));

const recordedLots = (proposal: LotProposal): RecordedLot[] => proposal.candidates.map((candidate) => ({
  id: candidate.batch,
  code: candidate.code,
  left: candidate.available,
}));

const allocationsFrom = (proposal: LotProposal, shares: LotShare[]): Allocation[] => shares
  .filter((share) => Number.isFinite(lotNumber(share.quantity)) && lotNumber(share.quantity) > 0)
  .map((share) => ({
    batch: share.lotId,
    code: proposal.candidates.find((candidate) => candidate.batch === share.lotId)?.code ?? share.code,
    qty: Math.round(lotNumber(share.quantity) * 100) / 100,
  }));

const sameAllocation = (left: Allocation[], right: Allocation[]): boolean => {
  const normalized = (rows: Allocation[]) => [...rows]
    .map((row) => `${row.batch}:${Math.round(row.qty * 100)}`)
    .sort()
    .join('|');
  return normalized(left) === normalized(right);
};

export function ConfirmGate({
  cast,
  sale,
  sales,
  act,
  now,
  onClose,
  onEdit,
  inventoryEnabled = true,
}: {
  cast: Cast;
  sale: Sale;
  sales: Sale[];
  act: GateAct;
  now: string;
  onClose: () => void;
  onEdit?: () => void;
  inventoryEnabled?: boolean;
}) {
  const [, theme] = useStyletron();
  const liveBook = useAllocationBook(cast, sales);
  const [reviewBook, setReviewBook] = React.useState(liveBook);
  const [dismissed, setDismissed] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, AllocationDraft>>({});
  const [allocationError, setAllocationError] = React.useState('');

  React.useEffect(() => {
    setReviewBook(liveBook);
    setDismissed(false);
    setEditing(null);
    setDrafts({});
    setAllocationError('');
    // The review snapshot belongs to this one document/action. Live stock changes afterwards are
    // surfaced as a revision conflict rather than silently rewriting an open allocation draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale.id, act, cast.sector]);

  const candidatesFor = React.useCallback(
    (product: string): AllocationCandidate[] => lotsForAllocation(reviewBook, product),
    [reviewBook],
  );
  const proposals = inventoryEnabled ? proposeLots(cast, sale, sales, candidatesFor) : [];
  const guards = inventoryEnabled ? guardsOf(cast, sale) : guardsOf(cast, sale).filter((guard) => guard.id !== 'law');
  const proposing = proposals.length > 0 && !dismissed;
  const stale = inventoryEnabled && liveBook.revision !== reviewBook.revision;

  const perform = (next: Sale, over?: string[]) => {
    if (act === 'make') makeSale(next, now, over);
    else commitSale(next, now, over);
  };

  const stateFor = (proposal: LotProposal) => {
    const draft = drafts[proposal.line.id];
    const shares = draft?.shares ?? allocationShares(proposal);
    const split = splitState(shares, proposal.need, recordedLots(proposal), true);
    const allocations = allocationsFrom(proposal, shares);
    const override = !sameAllocation(proposal.allocations, allocations);
    return {
      shares,
      split,
      allocations,
      override,
      reason: draft?.reason ?? '',
      complete: split.valid && Math.abs(split.unassigned) < 0.000001,
    };
  };

  const apply = (picks: AllocationPick[]) => {
    if (stale) {
      setAllocationError('Stock changed while this allocation was open. Your choices are still here; review the latest stock before saving.');
      return;
    }
    if (!attachLots(sale, now, picks)) {
      setAllocationError('Saving this allocation stalled. Your choices are still here.');
      return;
    }
    const next = withPicks(sale, picks);
    if (inventoryEnabled && proposeLots(cast, next, sales, candidatesFor).length > 0) return;
    const left = inventoryEnabled ? guardsOf(cast, next) : guardsOf(cast, next).filter((guard) => guard.id !== 'law');
    if (left.length > 0) {
      setDismissed(true);
      return;
    }
    perform(next);
    onClose();
  };

  const pickFor = (proposal: LotProposal): AllocationPick | null => {
    const state = stateFor(proposal);
    if (!state.complete || (state.override && !state.reason.trim())) return null;
    return {
      line: proposal.line.id,
      allocations: state.allocations,
      overrideReason: state.override ? state.reason.trim() : undefined,
      stockRevision: reviewBook.revision,
    };
  };
  const allPicks = proposals.map(pickFor).filter((pick): pick is AllocationPick => !!pick);
  const canAttachAll = allPicks.length === proposals.length && proposals.length > 0 && !stale;

  return (
    <OverlayCard
      isOpen
      onClose={onClose}
      scrim={SCRIM.dim}
      size="default"
      overrides={{ Root: { style: { zIndex: LAYER + 4 } } }}
      ariaLabel={proposing ? 'Allocate lots' : 'Are you sure?'}
      role="alertdialog"
    >
      <div
        data-testid={proposing ? 'lot-proposal' : 'guard-sure'}
        data-sale={sale.id}
        data-act={act}
        data-stock-revision={reviewBook.revision}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale500,
          minWidth: 0,
          maxHeight: '76vh',
          overflowY: 'auto',
          overflowX: 'clip',
        }}
      >
        {proposing ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300 }}>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Allocate lots</h2>
              <FlagMark label="FIFO suggestion" />
            </div>
            <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              Oldest available lot first. Review a line only when the crates differ.
            </p>

            {stale && <div role="alert" data-testid="lot-allocation-stale" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300, flexWrap: 'wrap', padding: theme.sizing.scale400, border: `1px solid ${theme.colors.negative400}`, borderRadius: theme.borders.radius300 }}>
              <span style={theme.typography.ParagraphSmall}>Stock changed. Your choices are still waiting to save.</span>
              <Button kind={KIND.secondary} size={SIZE.compact} data-testid="lot-review-latest" onClick={() => { setReviewBook(liveBook); setAllocationError(''); }}>Review latest stock</Button>
            </div>}
            {allocationError && <p role="alert" data-testid="lot-allocation-error" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative, margin: 0 }}>{allocationError}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
              {proposals.map((proposal) => {
                const state = stateFor(proposal);
                const short = Math.max(0, Math.round((proposal.need - proposal.covered) * 100) / 100);
                return <div
                  key={proposal.line.id}
                  data-proposal={proposal.line.id}
                  style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, padding: theme.sizing.scale400, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, background: theme.colors.backgroundPrimary, minWidth: 0 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.sizing.scale300 }}>
                    <span style={{ ...theme.typography.LabelSmall, display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
                      <Produce of={proposal.line.product} size="mini" />
                      <Name of={proposal.line.product} />
                    </span>
                    <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap' }}>{amountWords(proposal.need)} {proposal.line.unit}</span>
                  </div>
                  <FlagLine text={proposalWords(proposal)} />
                  <div data-testid={`lot-candidates-${proposal.line.id}`} style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
                    {proposal.candidates.map((candidate) => <span key={candidate.batch} data-testid={`lot-candidate-${proposal.line.id}-${candidate.batch}`} data-lot-id={candidate.batch} data-free={candidate.available} data-lot-state={candidate.available > 0 ? 'free' : 'unavailable'} style={{ display: 'inline-flex', gap: theme.sizing.scale200, alignItems: 'baseline', padding: `${theme.sizing.scale200} ${theme.sizing.scale300}`, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, color: candidate.available > 0 ? theme.colors.contentPrimary : theme.colors.contentTertiary }}>
                      <span style={theme.typography.LabelXSmall}>{candidate.code}</span>
                      <span style={theme.typography.ParagraphXSmall}>{candidate.available > 0 ? `${amountWords(candidate.available)} ${proposal.line.unit} free` : 'Unavailable'}</span>
                    </span>)}
                  </div>
                  {short > 0 && <span role="status" data-testid={`lot-unavailable-${proposal.line.id}`} style={{ ...theme.typography.LabelSmall, color: theme.colors.negative }}>{amountWords(short)} {proposal.line.unit} unavailable</span>}

                  {editing === proposal.line.id ? <div data-testid={`lot-allocation-editor-${proposal.line.id}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, paddingTop: theme.sizing.scale200 }}>
                    <LotSplitEditor total={proposal.need} unit={proposal.line.unit} lots={recordedLots(proposal)} shares={state.shares} context="allocate" onChange={(shares) => setDrafts((previous) => ({ ...previous, [proposal.line.id]: { shares, reason: previous[proposal.line.id]?.reason ?? '' } }))} />
                    {state.override && <label style={theme.typography.LabelSmall}>Why use a different split?
                      <Input value={state.reason} placeholder="For example: opened crate first" onChange={(event) => setDrafts((previous) => ({ ...previous, [proposal.line.id]: { shares: state.shares, reason: event.currentTarget.value } }))} overrides={{ Input: { props: { 'data-testid': `lot-override-reason-${proposal.line.id}`, 'aria-label': `Reason for changing FIFO on ${proposal.line.product.name}` } } }} />
                    </label>}
                    {state.split.unassigned > 0 && <span role="status" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{amountWords(state.split.unassigned)} {proposal.line.unit} still needs a recorded lot.</span>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
                      <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setEditing(null)}>Cancel</Button>
                      <Button kind={KIND.primary} size={SIZE.compact} data-testid={`attach-${proposal.line.id}`} disabled={!pickFor(proposal) || stale} onClick={() => { const pick = pickFor(proposal); if (pick) apply([pick]); }}>Apply to line</Button>
                    </div>
                  </div> : <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
                    <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`lot-review-${proposal.line.id}`} onClick={() => { setDrafts((previous) => previous[proposal.line.id] ? previous : ({ ...previous, [proposal.line.id]: { shares: allocationShares(proposal), reason: '' } })); setEditing(proposal.line.id); }}>Review lots</Button>
                    <Button kind={KIND.primary} size={SIZE.compact} data-testid={`attach-${proposal.line.id}`} disabled={!pickFor(proposal) || stale} onClick={() => { const pick = pickFor(proposal); if (pick) apply([pick]); }}>Attach</Button>
                  </div>}
                </div>;
              })}
            </div>

            <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button kind={KIND.primary} size={SIZE.compact} data-testid="attach-all" disabled={!canAttachAll} onClick={() => apply(allPicks)}>
                Attach all
              </Button>
              <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="dismiss-proposal" onClick={() => setDismissed(true)}>
                {ACT_VERB[act]} as it stands
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Are you sure?</h2>
            {guards.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
                {guards.map((guard) => (
                  <div key={guard.id} data-guard={guard.id} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>
                    <span style={theme.typography.LabelSmall}>{guard.label}</span>
                    <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{guard.consequence}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Everything the check asks for is on the lines.</p>
            )}
            <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
              <Button kind={KIND.primary} size={SIZE.compact} data-testid="guard-back" onClick={() => { onEdit?.(); onClose(); }}>Back to edit</Button>
              <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="guard-anyway" onClick={() => { perform(sale, guards.map((guard) => guard.label)); onClose(); }}>{ACT_VERB[act]} anyway</Button>
            </div>
          </>
        )}
      </div>
    </OverlayCard>
  );
}

/* ── THE PANEL ────────────────────────────────────────────────────────────────────────────── */

/* ── THE TICK CEREMONY IS PARKED (FEED-IA §26.1, Peter 2026-08-24) ────────────────────────────
 * «Nobody marks off, they just DO it.» A per-line tick asks a person to tell the software they did
 * a thing they have already done, with both hands full — the definition of ceremony. And the loop
 * this document is actually for is smaller and harder than that: «they edit and print. That's it.
 * One loop.» The final tweak, the weights, and then the paper.
 *
 * So the `Tick` component, `prepareLine`/`unprepareLine` and the `picking` branch on the line all
 * still compile and are all unmounted HERE, behind this one flag. Nothing is deleted: `day-view`
 * still ticks, and whether that surface survives is Peter's call, not this file's.
 */
const PICKING = false;
/* FEED-IA §34: payment tracking is billing's job, parked whole. */
const PAYMENTS = false;

/* ── THE EXPORT BLOCK — ON THE DOCK (FEED-IA §35.3, RE-SEATED BY §86.6) ───────────────────────
 * «Export is one of Rocoto's main jobs — albaranes FINISHING is one of the main jobs.» So the job
 * ends by answering the question it ends on: where has this one gone?
 *
 * IT IS NOT IN THE ALBARÁN ANY MORE. §35.3 asked for this block «IN each albarán» and §86.6
 * repeals that clause — «the print, erp and email thing shouldn't be IN the albarán bro wtf???».
 * The component is unchanged; its HOST moved, from the foot of the annotation to the dock, where
 * every other act upon this document already lives (§58's architecture). It is disclosed by the
 * state-row cell that names it, so the fact and its sentence are one press and no travel apart.
 *
 * THREE ROWS, ONE PER RAIL, and each of them is a SENTENCE and not a badge — «Sage 50 · went
 * 07:41 · it changed since, so it goes again» reads correctly to somebody who has never seen this
 * panel, which is the bar §19 set for the whole state vocabulary. The sentences are composed in
 * `sale.ts`, so this block, the header's centre and anything built later say one thing.
 *
 * THE ACTS ARE QUIET, AND THERE ARE ONLY THREE OF THEM: print it again (when the paper no longer
 * describes the crate), send it now (when the house's system is owed it), schedule it (when the
 * mail has yet to be promised an hour). Everything else is a fact. The dock above is where acts
 * live — «never a second dock» — and the test is that not one of these three appears on an
 * albarán where nothing has changed.
 *
 * ═══ A RAIL THE HOUSE HAS NOT CONNECTED IS NOT ON THE DOCUMENT (AUDIT-2 C23 · §86.6) ═════════
 * «The print, erp and email thing shouldn't be IN the albarán bro wtf???»
 *
 * WHAT STOOD HERE. Every opened sheet in a house without an ERP carried a row reading «Connect
 * your ERP and every albarán lands in it on its own» with a CONNECT button beside it, and the
 * same again for the mail. Two setup offers, on all three hundred documents, repeated on every
 * open — and in the export centre the same pair rendered in the attention dot's own red, the only
 * coloured controls in a modal of ink, so the one act a person would be glad to take read as an
 * error (the accent law: the accent is for readings ROCOTO MADE).
 *
 * IT IS THE STATE ROW'S OWN LAW, ONE BLOCK DOWN. «A cell about a rail nobody has connected is a
 * fact about our software rather than about their document (§2.5: absent, not held).» The block
 * now keeps that law too: it draws the rails THIS HOUSE HAS, and the setting-up of a new one is
 * the export centre's and `#/admin/connections`'s business, where a person goes to set things up.
 *
 * PAPER IS NEVER ABSENT, because paper is the rail every house already has — a printer is not
 * something anybody connects to Rocoto. So the block always says at least where the paper is.
 *
 * AND THE LABEL NAMES WHAT IS UNDER IT (§51.24's heading law). «Print, ERP and email» over one
 * print row names two things that are not there, which is the orphan writing that law bans.
 */

/* ── THE THREE RAILS SIT ON ONE GRID (FEED-IA §51.11) ─────────────────────────────────────────
 * «Print/ERP/email block: bad alignment.» Correct, and the cause was that each row laid itself out
 * with `flex` + `flexWrap`: the mark, the sentence and the act found their own places per row, so
 * three rows of the same shape had three different columns — and the row whose act was absent let
 * its sentence run under where the other two put their buttons. The customer's-own-ERP line under
 * them faked its indent with a padding value that matched nothing.
 *
 * ONE GRID, THREE COLUMNS, DECLARED ONCE on the block: the MARK's column is the glyph's own 16px
 * plus its gap; the SENTENCE takes what is left; the ACT sits at the right edge and every row's act
 * starts at the same x whether or not the row above it has one. The sub-line starts in the sentence
 * column because it is a sentence, not a rail.
 */
const RAIL_GRID = { mark: '16px', gap: 'scale300' } as const;

function ExportRow({
  mark,
  says,
  act,
  testid,
}: {
  mark: GlyphId;
  says: string;
  act?: React.ReactNode;
  testid: string;
}) {
  const [, theme] = useStyletron();
  return (
    <>
      <span data-testid={testid} style={{ display: 'grid', placeItems: 'center', width: RAIL_GRID.mark, minHeight: 24 }}>
        <Glyph id={mark} size={16} />
      </span>
      <span
        style={{
          ...theme.typography.ParagraphSmall,
          color: theme.colors.contentSecondary,
          alignSelf: 'center',
          minWidth: 0,
        }}
      >
        {says}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifySelf: 'end', alignSelf: 'center' }}>
        {act}
      </span>
    </>
  );
}

function ExportBlock({ sale, cast, now }: { sale: Sale; cast: Cast; now: string }) {
  const [, theme] = useStyletron();
  const { config, derived } = useConfig();
  const grants = useGrants();
  const pendingPaper = jobFor(useQueue(cast.sector), { kind: 'albaran', sale: sale.id });
  const world = React.useMemo(() => railWorld(cast), [cast, config, grants]);
  /* ── THE MAIL RAIL IS THE LIVE MAILBOX (FEED-IA §247.2) ────────────────────────────────────
     «always we havbe to be super consistent and not fget people igo confusing menus when they
      shouldnt see them» — Peter, 11 Sept 2026.
     These three reads took `railWorld`'s `email` rail, whose three fields had been constants since
     `config.mailbox` was retired: the heading could never name the mail, the row could never be
     drawn and the customer's-own-system line could never stand, on a workspace holding a live
     authorized Gmail that Connections, the connected inbox, the composer and Prep all read as
     Connected. They read the one capability every other email entrance reads. */
  const mailbox = useEmailCapability();
  const mailReady = mailbox.posture === 'ready';

  /* THE RAILS THIS HOUSE HAS, IN THE HOUSE'S ORDER (§58.4): its paper, its own system where it has
     one, the customer's copy where the mail is theirs to send. The label is built off the same
     list, so the heading and the rows can never name different things. */
  const railNames = ['Print', world.erp.connected ? world.erp.name : null, mailReady ? 'email' : null]
    .filter((n): n is string => n !== null);
  const label = railNames.length === 1
    ? railNames[0]
    : `${railNames.slice(0, -1).join(', ')} and ${railNames[railNames.length - 1]}`;

  return (
    <div
      data-testid="export-block"
      data-printed={sale.printed ? 'yes' : 'no'}
      data-stale-print={editedSincePrint(sale) ? 'yes' : 'no'}
      data-stale-erp={editedSinceErp(sale) ? 'yes' : 'no'}
      /* WHICH RAILS THE DOCUMENT IS STANDING ON, stated so the absence is assertable (AUDIT-2 C23) */
      data-rails={railNames.length}
      /* AND WHICH MAILBOX ANSWERED FOR THE THIRD OF THEM — the same attribute every other email
         entrance carries, so one read says whether the rail is absent or the mailbox is. */
      data-email-posture={mailbox.posture}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      <FieldLabel>{label}</FieldLabel>

      <div
        data-testid="export-rails"
        style={{
          display: 'grid',
          gridTemplateColumns: `${RAIL_GRID.mark} minmax(0, 1fr) auto`,
          columnGap: theme.sizing[RAIL_GRID.gap],
          rowGap: theme.sizing.scale400,
          alignItems: 'center',
          minWidth: 0,
        }}
      >
      <ExportRow
        testid="export-row-print"
        mark="print"
        says={pendingPaper?.state === 'printing' ? 'Print awaiting confirmation' : pendingPaper?.state === 'waiting' ? 'Print queued' : printedWordsOf(sale)}
        act={
          editedSincePrint(sale) ? (
            <Button
              kind={KIND.tertiary}
              size={SIZE.mini}
              data-testid="export-reprint"
              startEnhancer={<Glyph id="print" size={16} />}
              onClick={() => void printSourceRun({ idempotencyKey: newPrintAttemptKey(`albaran:${cast.sector}:${sale.id}`), title: `Delivery Note ${sale.number}`, cast, derived, sales: [sale], makeOrders: (snapshot) => [albaranOrder(snapshot[0], now, config.emailFeed)] })}
            >
              Print it again
            </Button>
          ) : undefined
        }
      />

      {/* THE HOUSE'S OWN SYSTEM — drawn where the house HAS one (AUDIT-2 C23, §86.6, §2.5). */}
      {world.erp.connected && (
        <ExportRow
          testid="export-row-erp"
          mark="erp"
          says={erpWordsOf(sale, world)}
          act={
            wantsErp(sale) && RANK[sale.state] >= RANK.committed ? (
              <Button
                kind={KIND.tertiary}
                size={SIZE.mini}
                data-testid="export-send-erp"
                onClick={() => sendToErp(sale, now, world.erp.name)}
              >
                {sale.sentToErp ? 'Send it again' : 'Send it now'}
              </Button>
            ) : undefined
          }
        />
      )}

      {/* THE CUSTOMER'S COPY — the same law, the same reason, on the mailbox this workspace holds. */}
      {mailReady && (
        <ExportRow
          testid="export-row-email"
          mark="email"
          says={emailWordsOf(sale)}
          act={
            takesEmail(sale) && !sale.emailScheduled && RANK[sale.state] >= RANK.made ? (
              <Button
                kind={KIND.tertiary}
                size={SIZE.mini}
                data-testid="export-schedule-email"
                onClick={() => scheduleEmail(sale, now, slotOf(sale))}
              >
                Schedule it for {slotOf(sale)}
              </Button>
            ) : undefined
          }
        />
      )}

      {/* THE CUSTOMER'S OWN SYSTEM (§20, §35.4). It was arranged with them, so it STATES itself —
          it is the one rail on this block nobody in this house has to do anything about. It starts
          in the SENTENCE column rather than at a padding value that happened to look about right
          (§51.11), because it is a sentence about the rail above it.
          AND IT GOES WHERE THAT RAIL GOES (AUDIT-2 C23). «…takes it straight in, with the mail» is
          a sentence about the mail row: with no mail connected there is no mail for it to ride, so
          the line would be describing a rail that is not on the document. */}
      {sale.customer.erp && mailReady && (
        <>
          <span />
          <span
            data-testid="export-their-erp"
            style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}
          >
            Their {sale.customer.erp.name} takes it straight in, with the mail.
          </span>
          <span />
        </>
      )}
      </div>
    </div>
  );
}

/* ── HOW IT ARRIVED (FEED-IA §54.3 — the section that had to justify itself) ───────────────────
 * «What does that section even need to say? This isn't Deliveroo. Show me the voice recording
 * thing and the basic setting button.»
 *
 * WHAT DIED. «About this albarán» was a label for everything-else, and under it stood a sentence
 * ABOUT the software — «Read from WhatsApp as 4 lines for Friday 22.08.» — plus a payment clock
 * §34.1 had already killed («we don't track payments lol»). A heading that names no thing, over
 * prose that narrates the app, is exactly the orphan writing §51.24 bans.
 *
 * WHAT STANDS INSTEAD: THE ARRIVAL, AS OBJECTS AND FACTS.
 *
 *   ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 *   │ [💬 WhatsApp]  06:12  ● read as 4 lines            [⚙ How orders arrive]                 │
 *   │ ▸ ═══════ waveform ═══════ 0:07                                                          │
 *   │   «Buenos días. Para mañana: 12 kg de merluza…»          the diarized transcript, seekable│
 *   └─────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   THE CHANNEL   a chip with its own mark — the thing the order came in on, said once and here
 *   THE HOUR      when it landed
 *   WHAT ROCOTO   the saffron dot and the count it read — its own act, marked as its own (§1)
 *   THE SETTING   the door to how orders reach this house (`capture`), because a fact a person
 *                 disagrees with is a fact they want the dial for
 *   THE RECORDING the voice note itself, PLAYABLE, where the order was spoken — the shell's own
 *                 player, so the sheet and the chat widget can never hold two versions of it
 *
 * ONE FACT, ONE PLACE (§25.5). The hour and the channel used to be said three times — in the
 * head's identity line, on the COMMS label, and inside Rocoto's own sentence. They are said HERE,
 * and `heroSubOf` and the COMMS head gave them up on the same pass.
 *
 * ═══ AND A DOCUMENT THE HOUSE WROTE SAYS SO (FEED-IA §74, the composer's own truth) ══════════
 * THE DEFECT THIS CLOSES. This block read `sale.customer.channel` — the channel that customer's
 * orders usually come on — for every document alike. A desk-written albarán therefore stood under
 * «How it arrived» wearing «WhatsApp», about a message nobody ever sent. A profile's habit is not
 * a document's history, and a channel is the one fact here that cannot be guessed from a default.
 *
 * SO IT IS READ OFF THE LEDGER (`sale.writtenHere`, minted by the `new` event, which carries no
 * channel because there was no arrival to name). The region does not move, does not shrink and
 * does not grow a second grammar (§59.1) — the SAME row, the SAME chip seat, the SAME hour:
 *
 *   ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 *   │ [✎ Written at the desk]  07:20                                                          │
 *   └─────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   THE MARK      `desk` — the pen laid on the line it just wrote. It was `draft` for one build,
 *                 and that was one mark carrying two meanings: the drafts door means «half-written,
 *                 come back to it» and this chip means «a hand wrote this one, and it is finished».
 *                 §30's rule is one icon one meaning, so the second meaning took its own id
 *                 (`glyphs.tsx`: SquarePen composes, PenLine wrote, Signature signs off).
 *   THE WORDS     «Written at the desk» — what happened, in four words, the whole of it. It is a
 *                 chip and not a sentence, so it reads as the channel chip's peer rather than as
 *                 prose the region had banned (§51.7, §51.24).
 *   THE HOUR      when it was written, in the seat the arrival hour takes
 *
 * WHAT IS ABSENT, AND WHY IT IS ABSENT RATHER THAN HELD (§2.5): Rocoto read nothing, so the
 * saffron count is not drawn; nothing was spoken, so no recording stands; and «How orders reach
 * the house» is the dial for a rail this document never used, so the door stays where it governs
 * something. Three silences, each one a fact that does not exist.
 */

/** THE MARK EACH CHANNEL WEARS (§30 — one icon, one meaning). Silence where the trade's own word
 *  is already the whole fact: «in person» is a person, «portal» is an address. */
const CHANNEL_MARK: Record<Customer['channel'], GlyphId> = {
  WhatsApp: 'chat',
  phone: 'chat',
  email: 'email',
  'in person': 'who',
  portal: 'at',
};

function Arrival({ sale, turn }: { sale: Sale; turn: ThreadTurn | null }) {
  const [, theme] = useStyletron();
  const chip: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.sizing.scale100,
    padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`,
    borderRadius: theme.borders.radius400,
    border: `1px solid ${theme.colors.borderOpaque}`,
    background: theme.colors.backgroundPrimary,
    color: theme.colors.contentPrimary,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
    ...theme.typography.LabelXSmall,
  };
  /* THE ONE QUESTION THIS BLOCK ASKS OF THE LEDGER (§74). A `new` event carries no channel, so a
     document born at the desk has none to state — and everything below either says the desk truth
     or says the arrival's, never a mixture of the two. */
  const here = sale.writtenHere === true;
  return (
    <div
      data-testid="arrival"
      data-channel={here ? 'desk' : accountChannelOf(sale.customer.channel)}
      data-voice={turn?.voice ? 'yes' : 'no'}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
        {/* THE CHIP SAYS WHERE IT CAME FROM, and for a desk document that is a hand rather than a
            rail. One seat, one type step, two truths — never a channel it did not come through. */}
        <span data-testid="arrival-channel" style={chip}>
          <Glyph id={here ? 'desk' : CHANNEL_MARK[sale.customer.channel]} size={STEP.small} />
          {here ? 'Written at the desk' : sale.customer.channel}
        </span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
          {sale.at}
        </span>
        {/* ROCOTO'S OWN ACT WEARS ROCOTO'S OWN MARK, and says the number rather than a sentence
            about having read something. The saffron is the accent's one licence here (§1).
            IT IS DRAWN ONLY WHERE IT HAPPENED: Rocoto read no message on a document a person
            typed, so on that one there is no count and no dot — silence, not a zero (§2.5). */}
        {!here && (
          <span
            data-testid="arrival-read"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.sizing.scale200,
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentSecondary,
              whiteSpace: 'nowrap',
            }}
          >
            <ActDot label="Rocoto read it" />
            read as {sale.lines.length} {plural(sale.lines.length, 'line')}
          </span>
        )}
        <span style={{ flex: 1, minWidth: theme.sizing.scale400 }} />
        {/* THE BASIC SETTING BUTTON (§54.3, his words). A fact about how the work arrives, with the
            dial that sets it one press away — the same door «from your setup» opens everywhere
            else, drawn as a control because this one sits at the head of a section.
            AND IT STANDS WHERE IT GOVERNS SOMETHING. The dial is «how orders REACH this house»; a
            document the house wrote reached it down no rail, so the door is absent there rather
            than offering a setting that changes nothing about what is on the screen. */}
        {!here && (
          <Button
            kind={KIND.tertiary}
            size={SIZE.mini}
            data-testid="arrival-setup"
            aria-label="Order arrival settings"
            startEnhancer={<Glyph id="sliders" size={STEP.small} />}
            onClick={() => { window.location.hash = anchorFor('capture'); }}
          >
            Open settings
          </Button>
        )}
      </div>

      {/* THE RECORDING, WHERE THEY SPOKE IT. Silence where they did not: provenance appears only
          where there is provenance to show, which is the same law the line's own note keeps. */}
      {turn?.voice && <VoiceNoteBody note={turn.voice} testid="arrival-voice" />}
    </div>
  );
}

/* ═══ THE SHEET, WIREFRAMED BEFORE IT IS DRAWN (FEED-IA §51.24 — THE WIREFRAME LAW) ═══════════
 * «You didn't mentally think about the wireframes and how they map to each other, what category
 * sections… you have literally ORPHAN SENTENCES that don't need to exist.» So the regions, their
 * contents, their type steps and their states are stated HERE, once, and the JSX below is a
 * transcription of this block. One section grammar, top to bottom, and every sentence on the
 * surface is either the CUSTOMER'S OWN WORDS or the REASON a control exists. Nothing explains.
 *
 * ┌─ HEAD ─ STICKY ON A DESK (§131.1) — the products and the trail scroll under it ─ states ────┐
 * │  Hostal Gavarres                                    ‹ 3 of 12 ›   flip: absent at list of 1  │
 * │  HeadingMedium (desk) · HeadingSmall (phone) · a door to the customer                        │
 * │  Friday 22.08 · 07:30                                                   ┌──────┐            │
 * │  THE DELIVERY MOMENT, AT THE HEAD'S SECOND STEP (§131.1: «the time of   │ 72px │            │
 * │  delivery is way too small»). The hour rides the day's own line box     │ map  │            │
 * │  where the account has one, and is an OFFER below where the house       └──────┘            │
 * │  wrote the document itself (§86.4b).                                                         │
 * │  Albarán 2208-112 · at 07:14 · 🚚 2 · Gràcia                            LabelXSmall/tertiary │
 * │  WHICH document, quiet · what the state adds to the day · WHERE it goes, in words and as a  │
 * │  door (§86.1). What is NOT here, and why: the flow's position (§61.2 — the goal is never    │
 * │  said out loud) · the figure (the document's own foot) · the state's full reading (the dock │
 * │  says it once, §59.4) · the day, said once, above (§25.5).                                  │
 * │  «It changed after it was printed. Print it again.» — the one line that shouts, and only    │
 * │  while the paper is out of date.                                                             │
 * │  [ Tarifa 2 ⌄ ]                              [ ⎙ Print it | 👁 ]   [ 🗑 Delete it ]           │
 * │  THE ACTS THAT LIVE ON THE DOCUMENT (§131.1 · §134.2 · §136.5c): the band it prices on as a │
 * │  CONTROL, the PRESS moved up from the dock so a person forty lines down still has it under  │
 * │  their eye, and the one destructive door — reversible, no are-you-sure (§76). The band is   │
 * │  drawn only where the house holds more than one; the delete only while the goods are the    │
 * │  desk's.                                                                                     │
 * ├─ LINES ─ one row per goods, the editor opening on the row it belongs to ────────────────────┤
 * │  ┌────┐ Merluza de pincho · sin cabeza          12 kg   200,88 €  16,74 €/kg          🗒  │
 * │  │face│ class A · lote L-2211                                                           🗑  │
 * │  └────┘   al vacío por separado                    ← the packing note, an INDENT (§131.2)  │
 * │         THE POSITIONS ARE LAW (§109.3 · §131.2). The NAME where the name lives, its sort   │
 * │         riding it · CLASS first, then LOTE, always last and never split across two lines · │
 * │         and THREE MONEY COLUMNS at fixed tracks — the amount, what it comes to, the rate — │
 * │         so every euro on the sheet is read straight down the page and an empty seat keeps  │
 * │         its track. 390 keeps ONE stacked column: «mobile is completely different».         │
 * │         THE TAIL IS A COLUMN OF TWO 20px SEATS: the packing-note door ABOVE the trash, both│
 * │         reserved, both inked under the pointer (§109.7 · §131.2 — his own placement).      │
 * │         EVERY VALUE ON THE ROW IS READY TO EDIT, first click, no mode (§109.6) — the name, │
 * │         the amount, the RATE (a field IN its own track on a desk, never a card below) and │
 * │         the lote (§197.2 took the class out of this list). `data-grade-pair` marks that    │
 * │         seat still, by its old name; `data-price-cell` the money and                       │
 * │         `data-money` each track, so the geography is measured rather than asserted.        │
 * ├─ ADD A LINE ─ AT THE LIST'S TRUE END (§84.2), contiguous with the last line, one row high ──┤
 * │  THE FIELD IS THE ROW (§109.6). «Six kilos red shrimp» goes into ONE full-width row — face  │
 * │  seat, words, the ↺ REWIND door onto their own past orders (§131.4 — never Rocoto's face    │
 * │  here, and never the camera: «that's for the stock shit»), money column, tail — and ENTER   │
 * │  MAKES THE LINE (§109.7), at that row's own y and that row's own band height, every seat    │
 * │  live. No draft, no confirm.                                                                 │
 * ├─ TAKEN OFF ─ only while something is off, with the way back — BELOW the growth point ───────┤
 * ├─ TOTAL ─ the figure, where a document's total belongs ──────────────────────────────────────┤
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═ THE ORDER ═ ONE section under the products, and it is the COMM TRAIL (§131.1 · §131.3). «The
 *   whole "How it arrives" thing is silly. Why is there a separate thing?» So the arrival is the
 *   trail's own first line — the channel it came on, the hour, what Rocoto read it as, the
 *   recording itself where they spoke it, and the door to the setting that governs how orders
 *   reach the house; a document the HOUSE wrote says «Written at the desk» in the same seat (§74).
 *   Then what Rocoto saw: the flags, the change and its door, and the one door to an unanswered
 *   ask. Then THE MESSAGES on their dotted paper, this order's own and no other (§134.1), with
 *   the chat's door beside the toggle. Then the REPLY-CONCERN, inline in the trail («I need you to
 *   reply to this customer», dismissible in place, §128.2 · §131.1), the answer control where
 *   there is an ask, and a composer that STANDS ON A DESK whether or not anything is owed —
 *   «people have a keyboard persistently on desktop». No second «Comms» label: the rule above
 *   names this section once.
 * ─ What it left behind ─ the tarifa switch, what a hand went ahead over, what this sale taught.
 * ═ THE DOCK ═ sticky at the pane's foot on a desk AND at the screen's foot on a phone (§51.25),
 *   one step down from the body's own large (§51.9). Its first row is B15, THE STATE ROW:
 *     Changed 10:40 · Edited 07:14 · ⎙ 09:12 · ⇄ 07:41 · ✉ 10:30 · 4 of 6 weighed
 *     └ the live reading (canon §15.1 — never «Closed») · whose hand · the three rails, each a
 *       door that OPENS ITS OWN FULL SENTENCE ON THIS DOCK (§86.6 — the rails left the
 *       document's body; the acts on a document live outside it) · the scale, first to give way.
 *     [ the rails, disclosed ] mark · sentence · act on one grid (§51.11), closed at rest
 *       LabelXSmall, ONE line, truncating from the right; owed stands in ink, done steps back.
 *     [ Confirm it ] [ ⇄ Sage 50 ]                       [ Open the chat ]   one filled act
 *     ⚠ THE PAPER LEFT THIS ROW FOR THE STICKY HEAD (§131.1) — the ERP is what remains of §58.4's
 *       rail order here, and the press is on the document, where he put it.
 *     the verb's one reason, and the one fact it turns on      ParagraphXSmall
 *
 * THE HEAD IS THE ONLY CHROME (§51.8). «A bar within the sidebar looks dumb» — so on a desk the
 * panel frame is GONE: the walk (‹ ›) rides the document's own head, at the edge, and the way out
 * is walking. A phone keeps one back row, because behind it there is a real destination.
 */
export type SaleDetailProps = {
  cast: Cast;
  derived: Derived;
  sale: Sale;
  /** the whole river, so the guard's proposal spends the batch book once across every sale on it */
  sales: Sale[];
  /** THE LIST THE CHEVRONS WALK — the feed's order in the feed, the day's order in the day */
  list: Sale[];
  /** WHERE THIS DOCUMENT STANDS IN THE REVIEW FLOW (FEED-IA §51.25), or nothing at all where
   *  nobody is being held by it. It is a POSITION and never a control: the surface that OWNS the
   *  flow is the river (it holds the list and it advances the selection when one settles), and a
   *  navigator down here would be the dock thinking at group level, which §22.5 forbids. */
  review?: { at: number; total: number };
  onPick: (id: string) => void;
  onClose: () => void;
  /** the paper, opened as a view rather than fired as an action (§7.4) */
  onPrint: () => void;
  /** the bay is walking this order, so its lines take ticks of their own */
  preparing?: boolean;
  /** ── THE PANE WAS JUST HANDED THIS DOCUMENT MID-SENTENCE (FEED-IA §74, §61.3) ──────────────
   *  The composer names a customer, the draft becomes an albarán, and this sheet takes the pane
   *  under a person who is still typing. Where that is what happened, the sheet opens its
   *  add-a-line and the chip field takes the caret, so the next letter lands on the next line
   *  instead of on the floor. Only the naming path passes it; every other way into this sheet
   *  arrives at rest. */
  carryOn?: boolean;
};

type SheetViewport = { height: number; offsetTop: number };

/** Keep the full-screen phone sheet and its thumb dock inside the visual viewport while the
 * on-screen keyboard is present. The browser owns the keyboard; this hook only follows the visible
 * rectangle and keeps the field being edited in the same scroll container. */
/** WHETHER THE HEAD HAS BEEN SCROLLED PAST (FEED-IA §193.5). It watches THE THING THAT ACTUALLY
 *  SCROLLS (§38 — the lesson «Jump to today» learned): the sheet itself on a phone, the pane on a
 *  desk. HYSTERESIS, because a head that collapses shortens the very scroll it is reading, and a
 *  single threshold oscillates on the clamp. A document that barely scrolls never compacts. */
const COMPACT_FLOOR = 240;
/** WHETHER THE HEAD HAS BEEN SCROLLED PAST (FEED-IA §193.5). It watches THE THING THAT ACTUALLY
 *  SCROLLS (§38): the sheet itself on a phone, the pane on a desk. The thresholds are MEASURED off
 *  the head: compact once the WHOLE full head has scrolled away (scrollTop > full), back to full
 *  once it is 48px inside again — no oscillation, because the swap changes no scroll position:
 *  THE DOCUMENT KEEPS ITS HEIGHT. The compact head reserves the full head's height in flow (a
 *  bottom margin of full − compact, set before paint), so the paper never jumps on the swap and
 *  a programmatic scroll (a line brought into view, a focused seat) lands where the browser put
 *  it (§195: nothing jumps). A document that barely scrolls never compacts. */
function useScrolledPast(ref: React.RefObject<HTMLElement | null>, headRef: React.RefObject<HTMLElement | null>, phone: boolean, key: string): { past: boolean; sticky: boolean } {
  const [past, setPast] = React.useState(false);
  /* A HEAD PINS ONLY WHERE THE PORT CAN AFFORD IT: with the keyboard up a phone sheet may be 500px
     tall — a pinned 239px head would cover the very value being typed (caught by drive-190). So
     the head is sticky only when a pinned FULL head still leaves 320px of paper under it (every
     real desk and phone height; no keyboard-reduced port); otherwise it scrolls away with the
     paper, as E191's phone head did. */
  const [sticky, setSticky] = React.useState(true);
  const full = React.useRef(0);
  React.useEffect(() => {
    const el = ref.current;
    const port = phone ? el : el?.closest<HTMLElement>('[data-testid="detail-open"]') ?? null;
    if (!port) return;
    const read = () => {
      const fullH = full.current || headRef.current?.getBoundingClientRect().height || 240;
      const affords = port.clientHeight >= fullH + 320;
      setSticky(affords);
      if (!affords || port.scrollHeight - port.clientHeight < COMPACT_FLOOR) { setPast(false); return; }
      setPast((was) => (was ? port.scrollTop > Math.max(48, fullH - 48) : port.scrollTop > fullH));
    };
    read();
    port.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => { port.removeEventListener('scroll', read); window.removeEventListener('resize', read); };
  }, [ref, headRef, phone, key]);
  /* the reserve: measured and applied before paint, so no frame ever shows the jump */
  React.useLayoutEffect(() => {
    const head = headRef.current;
    if (!head) return;
    const h = head.getBoundingClientRect().height;
    if (!past) { full.current = h; head.style.marginBottom = '0px'; return; }
    head.style.marginBottom = `${Math.max(0, (full.current || h) - h)}px`;
  }, [past, headRef, key]);
  return { past, sticky };
}

function usePhoneSheetViewport(active: boolean): SheetViewport | null {
  const [viewport, setViewport] = React.useState<SheetViewport | null>(null);
  React.useEffect(() => {
    if (!active || typeof window === 'undefined') { setViewport(null); return; }
    const visual = window.visualViewport;
    const read = () => {
      const next = visual
        ? { height: Math.round(visual.height), offsetTop: Math.round(visual.offsetTop) }
        : { height: window.innerHeight, offsetTop: 0 };
      setViewport(next);
      window.requestAnimationFrame(() => {
        const focused = document.activeElement as HTMLElement | null;
        const sheet = focused?.closest<HTMLElement>('[data-testid="sale-detail"]');
        if (focused && sheet) focused.scrollIntoView({ block: 'center', inline: 'nearest' });
      });
    };
    read();
    visual?.addEventListener('resize', read);
    visual?.addEventListener('scroll', read);
    window.addEventListener('resize', read);
    return () => {
      visual?.removeEventListener('resize', read);
      visual?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, [active]);
  return viewport;
}

export default function SaleDetail({
  cast,
  derived,
  sale,
  sales,
  list,
  review,
  onPick,
  onClose,
  onPrint,
  preparing = false,
  carryOn = false,
}: SaleDetailProps) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const phoneViewport = usePhoneSheetViewport(phone);
  /* ONE PANE AT A TIME, AND THEREFORE A WAY BACK (FEED-IA §103) — the phone, and the stacked desk */
  const pushed = usePushed();
  /* AND ONE PANE AT A TIME INCLUDES THE CONVERSATION (§202.3 · `shell/threads.ts`). This pane is
     the phone's whole screen; so is the chat panel «Open the chat» opens from inside it. The pane
     steps back while that conversation stands, keeping its state and its scroll, and it is here
     again the moment the conversation is closed. */
  const chatIsScreen = useChatIsScreen();
  /* §193.5: the document's head holds a compact sticky state once the paper has scrolled under it */
  const sheet = React.useRef<HTMLDivElement | null>(null);
  const headRef = React.useRef<HTMLElement | null>(null);
  const { past: compact, sticky: headSticky } = useScrolledPast(sheet, headRef, phone, sale.id);
  const now = nowOf(cast);
  const gap = measure(theme);
  /* WHAT THE PRINTER STILL OWES FOR THIS DOCUMENT. The count rides the dock's print control so a
     person who pressed it sees the paper coming rather than wondering whether the press landed —
     the same number the header bar's queue is counting down (§20). */
  const { config } = useConfig();
  /* §86.4b — which documents have TAKEN the account's usual hour, so the chip below is an offer
     until somebody presses it and a stated fact after (`slot-offer.ts` carries the reasoning). */
  const slotsTaken = useSlotsTaken();
  /* THE RAILS ARE READ FROM THE HOUSE, so this panel subscribes to the two stores that decide them
     — otherwise a connection made in the administration would leave the dock on the old stance. */
  const grants = useGrants();
  const { pricing: pricingAvailable, inventory } = useWorkspaceCapabilities();
  /* ── THE DOCUMENT SAYS IT SHOWS MONEY (FEED-IA §200.3 · E199) ─────────────────────────────
   * The row law's two money columns exist exactly where `pricing` does, and where they exist the
   * document needs its own snug 640 — so the Copilot's rung reads this rather than guessing from
   * the address bar. A LAYOUT effect, so the frame has the right track before the first paint,
   * and the fact stands down with the document (`shell/viewport.ts` carries the arithmetic). */
  usePricedDocumentDeclared(pricingAvailable);
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  const allocationBook = useAllocationBook(cast, sales);
  const allocationCandidates = React.useCallback((product: string) => lotsForAllocation(allocationBook, product), [allocationBook]);
  /* WHO TAKES A HANDOVER (checkpoint §5's routing). The house's own book, so the dock names a real
     person rather than a role — and renaming somebody in Team renames them here. */
  const company = useCompany();
  const jobs = useQueue(cast.sector);
  const paperJob = jobFor(jobs, { kind: 'albaran', sale: sale.id });
  const owed = paperJob && paperJob.state !== 'printed' ? paperJob.left : 0;

  const [notice, setNotice] = React.useState(false);
  const [gate, setGate] = React.useState<GateAct | null>(null);
  /* THE BIG MAP (§39.1). The square in the head is the fact; this is the look. */
  const [map, setMap] = React.useState(false);
  /* WHERE THE ASK LIVES (§51.10). The annotation's one line is a door, and this is what it opens. */
  const comms = React.useRef<HTMLDivElement | null>(null);
  /* ── WHERE A STATE-ROW CELL LANDS (canon §6.4, RE-SEATED BY §86.6 · §86.2) ─────────────────
   * Every rail's cell on the dock is a door into that rail's own full sentence. It used to be a
   * SCROLL: the cell walked the pane down to a block at the foot of the annotation, a screen and
   * a half away, and the person read about the document from a different place on the surface.
   *
   * The sentences live on the dock now, so the door is a DISCLOSURE and the eye never travels —
   * one locus, which is what §86.1's proprioception asks for at the scale of a single press. It
   * opens closed and closes on a flip, because a rail's detail is about the document in hand. */
  /* HOW TALL THE PANE'S BAR IS STANDING, so the last line of the annotation can scroll clear of it
     instead of finishing underneath it (§39.3). It is MEASURED because the bar's own height is a
     function of the state — a disputed sale carries its outcome row, a request carries a second
     door — and a guessed number would be wrong on exactly the states that need the room. */
  /* ── THE TURN THIS ORDER ARRIVED ON (FEED-IA §54.3, §46.2) ────────────────────────────────
   * «Show me the voice recording thing.» A voice note is a property of the CONVERSATION, not of
   * the ledger — the shell's threads own the media, the fold keys every turn `<sale>:<row>`, and
   * that key is the whole join. So the sheet READS the conversation the widget draws rather than
   * seeding a second recording of its own: one truth, two doors, and a recording that could ever
   * differ between them is a bug that cannot be written.
   *
   * IT ASKS FOR THIS SALE'S OWN TURNS and takes the first thing the customer SENT — the arrival.
   * Most orders arrived as typed words and this finds nothing, which is the resting state: the
   * block says the channel and the hour, and stays quiet about a recording that does not exist.
   *
   * AND A PHONE ORDER NOW REACHES IT (AUDIT-2 C8). This memo was correct and found nothing on
   * every phone-channel document in the house, because the fold seeded recordings as DISCRETIONARY
   * dressing — two conversations out of three hundred, chosen by sort order. `threads.ts`'s
   * `spoken` makes it the channel's own fact instead: a phone order arrived as a call, on every
   * one of that customer's orders, which is what makes `turn.voice` land on the sheet a person
   * actually opens. The join is unchanged — one recording, read by both doors. */
  const threads = useThreads(cast);
  const arrival = React.useMemo<ThreadTurn | null>(() => {
    const thread = threadOf(threads, sale.customer.id);
    if (!thread) return null;
    const mine = thread.rows.filter((r) => r.id.startsWith(`${sale.id}:`) && r.author === 'received');
    return mine.find((r) => r.voice) ?? null;
  }, [threads, sale.id, sale.customer.id]);

  /** what the square says on hover and to a screen reader: the run, and the truck that walks it */
  const whereWords = [
    zoneNameOf(sale.customer.zone) ?? sale.customer.zone,
    sale.customer.truck !== undefined ? `truck ${sale.customer.truck}` : null,
  ].filter(Boolean).join(' · ');
  /* ── WHERE IT GOES, IN WORDS (FEED-IA §86.1 · §21 · §43) ───────────────────────────────────
   * «What the top of the albarán should have as core info… people don't think in two sidebars at
   * a time. It's like proprioception. We need to make the cognitive load low.»
   *
   * THE HEAD ANSWERED WHO, WHICH, AND WHEN — AND LEFT WHERE TO A HOVER. A 72px picture with its
   * caption in a tooltip means a person who wants to know which van this rides has to point at a
   * thing and wait for a layer to open over the document they are reading: the second surface §86.1
   * bans, in miniature. The run is a fact about this delivery at the same altitude as the day and
   * the hour, and every OTHER surface in the app already says it in words — `truck-chip.tsx`'s own
   * rule is «the flat river rows and THE SHEETS keep the full chip», and the object map records the
   * river row carrying it. This head was the one place the app said it as a picture only.
   *
   * IT IS THE SAME OBJECT AS THE SQUARE. The chip opens the identical `PinMap` on the identical
   * card, so the words and the picture are one door said twice, never two destinations. */
  const round = roundOf(sale);
  /** THE RESIDUE OF THE STATE'S OWN SENTENCE (§131.1 · §25.5). The delivery day leads the head at
   *  its own step now, so the quiet line below it says whatever `heroSubOf` had to add — and
   *  nothing at all where the day WAS the whole sentence. */
  const stateWords = ((): string => {
    const said = heroSubOf(sale);
    const day = `for ${sale.deliveryDay}`;
    return said.startsWith(day) ? said.slice(day.length).replace(/^\s*·\s*/, '').trim() : said;
  })();
  /* The direct status control must name a state, never leave a bare timestamp in the header.
     Opening an Albarán is the durable Viewed act, so that is the compact status people can verify
     in Activity. Before the fold records Viewed, the document's workflow state remains explicit. */
  const headerStatusWords = sale.read
    ? phone ? `Viewed ${sale.read.at}` : `Viewed at ${sale.read.at}`
    : [STATE_TEXT[sale.state], phone ? stateWords.replace(/^(?:at|goes at|complaint at)\s+/, '') : stateWords]
        .filter(Boolean).join(phone ? ' ' : ' · ');
  /* ── THE PRODUCT'S OWN CARD (THE-DENSE-BRIEF-DESIGN §2, musing 11) ────────────────────────
   * «Every product gets a CARD like the albarán's.» It REPLACES the panel's content and carries
   * one back door — the same move the change notice makes — so on a desk the albarán stands where
   * it was and comes straight back, and on a phone, where the panel is the screen, that same move
   * is the fullscreen push. One component, one behaviour, two shapes of screen. */
  const skuCatalogue = useCatalogue();
  const [card, setCard] = React.useState<Product | null>(null);
  useHistoryLayer({
    id: `order-product:${sale.id}`,
    active: card !== null,
    snapshot: { product: card?.id ?? null },
    onRestore: (snapshot) => setCard(snapshot ? [...sale.lines.map((line) => line.product), ...cast.products, ...graduatedProducts(cast, skuCatalogue.state)].find((product) => product.id === snapshot.product) ?? null : null),
  });

  React.useEffect(() => {
    setNotice(false);
    setGate(null);
    setCard(null);
    setMap(false);
  }, [sale.id, sale.state]);

  /* ── OPENING IT READS IT (FEED-IA §66.1) ──────────────────────────────────────────────────
   * «I don't want the things to need locking. Simply to be READ. Like Gmail.» So reading is not
   * a control and there is no verb for it: standing the document in the sheet IS the act, and the
   * ledger records that somebody looked. `readSale` writes at most once per sale, so a sweep that
   * walks back and forth over the same forty orders writes forty events rather than four hundred.
   *
   * IT RUNS ON THE ID, NOT ON THE FOLD. Keying it on the sale object would write, refold, receive
   * a new object and consider writing again — the loop a facet-writing effect always risks. */
  React.useEffect(() => {
    if (!sale.archived) readSale(sale, now);
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- the id is the identity; `now` is a clock */
  }, [sale.id]);

  /** THE PRESS THAT CAME FROM THE RIVER (checkpoint §14.2b). Enter on the pile names a document;
   *  this sheet answers it only while it is the one being named. */
  const entered = useEnterSignal(sale.id);

  /* ── THE FLIP (§7.1, docked by §17.2) ─────────────────────────────────────────────────────
   * The position is the position IN THE LIST ON SCREEN, and the walk wraps, so a person flipping
   * through a morning never hits a wall they have to reason about. */
  const at = list.findIndex((s) => s.id === sale.id);
  const flips = list.length > 1;
  const step = (by: number) => {
    if (list.length < 2) return;
    const from = at < 0 ? 0 : at;
    onPick(list[(from + by + list.length) % list.length].id);
  };
  /* §193.5: the walk keeps its FUNCTION and loses its buttons — a horizontal swipe on the sheet
     steps the list (the desk keeps ← / →). Nothing on the sheet scrolls sideways, so no collision. */
  React.useEffect(() => {
    const el = sheet.current;
    if (!el || !phone || !flips) return;
    let x0 = 0, y0 = 0, t0 = 0, live = false;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      live = !(e.target as HTMLElement | null)?.closest('input,textarea,[role="slider"],[data-no-swipe]');
      x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
    };
    const up = (e: TouchEvent) => {
      if (!live) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0, dy = t.clientY - y0;
      if (Date.now() - t0 < 600 && Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 2) step(dx < 0 ? 1 : -1);
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchend', up, { passive: true });
    return () => { el.removeEventListener('touchstart', down); el.removeEventListener('touchend', up); };
  }, [phone, flips, list, sale.id]);
  /** THE HOVER LABEL IS A DESK THING (§32). A keycap on a screen with no keyboard is a promise
   *  nothing can keep, so the chevrons wear their words on the desk and their aria everywhere. */
  const tipped = (node: React.ReactNode, content: React.ReactNode) =>
    phone ? (
      node
    ) : (
      <StatefulTooltip content={content} placement={TOOLTIP_PLACEMENT.top} showArrow overrides={OVER_THE_CHROME}>
        {node}
      </StatefulTooltip>
    );

  /* THE LINES ARE EDITABLE UNTIL THE DOCUMENT IS QUEUED TO THE CUSTOMER. Cancel the send and they
     open again — which is exactly what the cancel-until-sent window is for. */
  const editable = !sale.archived && (sale.state === 'request' || sale.state === 'committed' || sale.state === 'made');
  const primary = primaryOf(sale);
  const flags = flagsOf(sale);
  /* PAYMENTS ARE BILLING, AND BILLING IS NOT OURS (FEED-IA §34, Peter: «we don't track
     payments — that's billing»). The machinery stays parked for a billing-someday. */
  const money = PAYMENTS ? moneyMarkOf(sale, todayId(cast)) : null;

  const takePrimary = () => {
    if (!primary) return;
    switch (primary.act) {
      case 'commit': return askOrAct(cast, sale, sales, 'commit', now, () => setGate('commit'), inventoryAvailable, allocationCandidates);
      case 'make': return askOrAct(cast, sale, sales, 'make', now, () => setGate('make'), inventoryAvailable, allocationCandidates);
      case 'schedule': return scheduleSale(sale, now);
      case 'cancel': return cancelSend(sale, now);
      case 'deliver': return deliverSale(sale, now);
      case 'settle': return settleSale(sale, now);
    }
  };

  /** THE DOCK SAYS THE LEDGER'S WORDS (§51.9). The rename lives in `primaryOf` and nowhere else, so
   *  the row's call and the sheet's loudest control read the same string out of the same file. */
  const verb = primary ? primary.verb : '';
  const verbSub = primary ? primary.sub : '';

  /** THE FACT THE LOUD VERB TURNS ON — and only where the sentence beside it does not already
   *  carry that fact. «It goes at 09:00, and you can cancel until it does» with «09:00» printed
   *  underneath is the same hour twice, an inch apart, on the app's loudest control.
   *  THE NUMBER CAME OFF THE LOCK. It stands in the head now (§51.8), a screen above, and the same
   *  reference in two sizes on one sheet is the repetition this rule already refuses. */
  const primaryValue: React.ReactNode =
    pricingAvailable && (primary?.act === 'commit' || primary?.act === 'settle')
      ? <Figure value={sale.figure} unit="S/" size="compact" />
      : primary?.act === 'deliver'
        ? now
        : undefined;

  /* ── THE DOORS ON THE DOCK (§17.2, cut back by §51.8) ────────────────────────────────────
   * «Think each control through and earn it.» What is left is whichever SECOND act this one state
   * genuinely allows, and nothing else. The customer's own door left this row when the customer's
   * name took the top of the sheet — a name in 24px type at the head and the same name on a small
   * button at the foot is one object with two doors, a screen apart. The conversation's own toggle
   * went onto the conversation (§16) and the change's «see what it affects» went onto the change. */
  const doors: React.ReactNode[] = [];

  /* ── TWO DOORS LOST THEIR SEATS TO §59.1 ─────────────────────────────────────────────────
   * «Send it now» is not a second row under the Send control any more — it is the LEFT COLUMN of
   * the control the press produced (`SendFlush` above), which is what «an act transforms its own
   * control» means when it is taken literally.
   *
   * «Lock it now» on an unconfirmed order went with it, and for the same reason read at rest: a
   * request already carries the loud Confirm, the held paper and its one reason, and a fourth row
   * offering to skip the confirm is the stacked surface the founder is cutting. Locking follows
   * confirming — the state after this one has the verb, one press away. */

  /* ── THE ONE ATTENTION ACT (FEED-IA §66.1) ───────────────────────────────────────────────
     «Once read, if they don't edit, that's down to them. They can mark unread though.» It is the
     only thing left of what locking used to be, and it is the opposite shape: quiet, reversible,
     about the PERSON's attention rather than about the document's fate. It stands among the doors
     because it is not an act upon the albarán at all.

     ── AND IT TRANSFORMS ITSELF (AUDIT-2 C7 · §59.1) ────────────────────────────────────────
     «An act TRANSFORMS ITS OWN CONTROL, in place.» It did not: pressing «Mark unread» wrote the
     event, the condition below went false, and the door VANISHED — the person's own act erased
     the only thing on the pane that knew about it, with nothing saying it had happened and no way
     back. Gmail's grammar is a pair, and a pair needs both halves standing in one seat.

     SO THE DOOR IS ALWAYS THERE WHILE THE SHEET IS, and it says which way it goes: read, and it
     offers «Mark unread»; unread, and the same seat offers «Mark read» — the label, the glyph and
     the act swapping in place, the row's geometry never moving (§59.1, §37.3). The label is also
     the state's only expression on this pane, which is §59.2 taken literally: the control says
     what IS, so nothing else has to say it in prose.

     `readSale` IS THE OTHER HALF, AND IT IS NOT A SECOND MECHANISM. Opening writes it, this button
     writes it, and the ledger cannot tell the two apart — which is exactly right, because both are
     «somebody looked at this». */

  /* ── THE DOOR THIS SHEET DREW AND NEVER BUILT (FEED-IA §202.3 · OUT-05.2) ──────────────────
   * The wireframe above has carried «[ Open the chat ]» on the dock's act row since §131.1, and
   * `focusThread` has been imported at the head of this file and called nowhere. Peter, 2026-09-05:
   * «"open chat" for whatsapp should be opening the chat popup». So it is built, and it carries
   * the ORDER — the panel opens standing on THIS albarán's exchange rather than on the customer's
   * whole year, which is the one thing an act on a document can add over the customer's own door.
   *
   * It stands only where there is a conversation to open. A house that types its orders at the
   * desk has no thread, and a door onto an empty room is worse than no door. */
  if (!sale.archived && threadOf(threads, sale.customer.id)) {
    /* ⚠ AND THE DOOR IS NAMED BY THE CHANNEL BEHIND IT (OUT-05.6's one pair of words). A mail
       customer's exchange opens as the mail card, so a door that said «Open the chat» over it
       named the wrong room — the same pair `copilot/flows.tsx` and `areas/customers.tsx` already
       print is printed here, off the customer's own channel. */
    const byMail = sale.customer.channel === 'email';
    doors.push(
      <Door key="chat" glyph="chat" label={byMail ? 'Open the email' : 'Open the chat'} testid="open-chat"
        onClick={() => (byMail
          ? openEmail(cast.sector, sale.customer.id, '', sale.id)
          : openChat(cast.sector, sale.customer.id, sale.id))} />,
    );
  }

  if (sale.state === 'sent') {
    doors.push(
      <Door key="settle" glyph="check" label="Settle it" testid="do-settle" onClick={() => settleSale(sale, now)} />,
    );
  }

  if (sale.state === 'sent' || sale.state === 'delivered') {
    doors.push(
      <Door
        key="decline"
        glyph="flag"
        label="They declined it"
        count={`until ${sale.declineUntil}`}
        testid="do-decline"
        onClick={() =>
          declineSale(
            sale,
            now,
            /* THE CONTENT CANON'S SWEEP, ITEM 30. «Por favor» is rare and this is not one of the
               rare ones; and «short of what the albarán says» is the long way round «short of the
               albarán» (THE-CONTENT-CANON §3, §9). */
            `The ${sale.lines[0].product.name} came in short of the delivery note. Look at it.`,
          )
        }
      />,
    );
  }

  /* ── PRINT IS THE ACT, AND THE PAPER IS THE HALF-FLUSH (Peter, 2026-08-24) ────────────────
     It used to be a door: pressing «Print it» opened a preview, and somebody pressed print again
     inside it. That is the act asking permission to be the act — and it is wrong twice over,
     because «printed» is what CLOSES an albarán (§21.2) and because at 300 orders a day a person
     hits print down a list and walks to the bay (§20). So the big flush enqueues, the small inset
     eye opens the sheet for whoever wants to look, and this is the one control on every state. */
  /* IT RIDES THE BAR'S OWN ROW, BESIDE THE VERB (§39.3): «the print/export acts become the pane's
     sticky bottom bar». Finishing is the job this whole surface is for, so its control stands at
     the weight the STATE gives it rather than among the quiet doors.

     AND IT IS NOT ALWAYS LIVE (FEED-IA §58.1, which kills the old clause here). «That's not true.
     It shouldn't be always live lol. You gotta think about these states architecturally.» The
     stance comes out of `sale.ts` — the same predicates the DAY's press has always obeyed — so the
     document's dock and the house's ⎙ button can never disagree about what may go on paper. Held,
     the flush greys and the reason stands under the row in words; the EYE beside it never greys,
     because looking at the paper is not exporting it. */
  const world = React.useMemo(() => railWorld(cast), [cast, config, grants]);
  const stance = exportStance(sale, todayId(cast), world);

  /* One direct, native print action. Preview is intentionally not attached as an eye:
     captured copies live in Activity and the Export centre instead. */
  const printLabel = stance.paper.again || paperJob?.state === 'printing' ? 'Print again' : 'Print';
  const printAriaLabel = `${printLabel} delivery note`;
  const printControl = (
    <Button
      key="print"
      kind={stance.lead === 'paper' ? KIND.primary : KIND.secondary}
      size={SIZE.compact}
      disabled={!stance.paper.live}
      data-testid="do-print"
      data-queued={owed && owed > 0 ? owed : undefined}
      aria-label={printAriaLabel}
      startEnhancer={<Glyph id="print" size={STEP.small} />}
      onClick={() => void printSourceRun({ idempotencyKey: newPrintAttemptKey(`albaran:${cast.sector}:${sale.id}`), title: `Delivery Note ${sale.number}`, cast, derived, sales: [sale], makeOrders: (snapshot) => [albaranOrder(snapshot[0], now, config.emailFeed)] })}
      overrides={{ BaseButton: { style: { minHeight: '48px', minWidth: phone ? undefined : '84px', width: phone ? '100%' : undefined } } }}
    >
      {printLabel}{owed !== undefined && owed > 0 ? ` · ${owed}` : ''}
    </Button>
  );
  /* §193.5: on a phone the paper act lives in the bottom bar and nowhere else (§43: one locus).
     The bar states its own height so the sheet's floor and scroll padding are measured, not hoped. */
  const phoneBar = phone ? (!stance.paper.live && stance.paper.because ? 84 : 64) : 0;

  /* ── THE HOUSE'S OWN RAIL, ON THE DOCK (FEED-IA §58.4) ────────────────────────────────────
     «Some companies wanna just print, others wanna just send to ERP, but all wanna make sure it's
     super reliable and do that in MINIMAL time.» So a house that has connected its own system gets
     that system's act on the dock, named — one press, on the document, at the weight the state
     gives it — rather than a scroll to the block at the foot. A house with no ERP has no such act
     and no empty seat where one would be: the rail exists because the connection does. */
  /* ══ THE TWO TRIAGE VERBS (checkpoint §14.2e · §9) ═══════════════════════════════════════════
   * «Quick accept / clarify / handoff.» Accept was already here twice over — the row's own call and
   * the dock's loud verb — and the other two had no control anywhere in the app, which is why the
   * keyboard could not reach them.
   *
   * WHERE THEY STAND, AND WHY IT IS THE DOCK. §51.25: «the main actions should be quick and at the
   * bottom of the main screen». The dock is that place, it is the one thing on this pane that never
   * scrolls away, and both of these are acts UPON this document. They deliberately do not go on the
   * river's card: a standing row shows exactly one verb (DENSE-BRIEF-DESIGN §1), and three would
   * make a person choose before they have read anything.
   *
   * THEY APPEAR WHERE THERE IS SOMETHING TO DECIDE, and the POLICY decides which one is
   * recommended — expressed as weight, never as a colour: the policy's own verb takes the
   * secondary fill and the other stays a tertiary door. A person overriding that is normal (§26.3).
   *
   * THE KEYS ARE THE SAME PRESS. `areas/sales.tsx` binds C and H to these exact acts, so a
   * shortcut can never do something its control refuses — the rule the P key already keeps. */
  const policy = reviewPolicy(sale, todayId(cast));
  const ask = clarifyAsk(sale);
  const takes = handoffTo(sale, company);
  const triage = policy !== 'ACT';

  const clarifyControl = triage && ask ? tipped(
    <Button
      key="clarify"
      kind={policy === 'CLARIFY' ? KIND.secondary : KIND.tertiary}
      size={SIZE.compact}
      data-testid="do-clarify"
      /* THE ID IS UNPAINTED, AND IT IS LOWER CASE (FEED-IA §120.3). «The whole "act clarify hold
         the handoff" is wrong… those are the two actions.» The four words survive only as internal
         ids, and the house's own convention for one is the lower-case form every other surface
         already spends (`tick.tsx`, the test panel, `drive-policy`'s `row-walk-<id>`). These two
         dock controls were the last places spending them in capitals. */
      data-policy={policy.toLowerCase()}
      startEnhancer={<Glyph id="chat" size={16} />}
      onClick={() => clarifySale(sale, now)}
    >
      Ask them
    </Button>,
    <Shortcut label={ask.text} keys={['C']} />,
  ) : null;

  const handoffControl = triage && takes ? tipped(
    <Button
      key="handoff"
      kind={policy === 'HANDOFF' ? KIND.secondary : KIND.tertiary}
      size={SIZE.compact}
      data-testid="do-handoff"
      /* the same lower-case id, for the same reason (§120.3) */
      data-policy={policy.toLowerCase()}
      data-takes={takes.id}
      startEnhancer={<Glyph id="send" size={16} />}
      onClick={() => handoffSale(sale, company, now)}
    >
      Hand to {takes.name}
    </Button>,
    <Shortcut label={`Hand to ${takes.name}`} keys={['H']} />,
  ) : null;

  const erpControl = stance.erp ? (
    <Button
      key="erp"
      kind={stance.lead === 'erp' ? KIND.primary : KIND.secondary}
      size={SIZE.compact}
      data-testid="dock-erp"
      startEnhancer={<Glyph id="erp" size={16} />}
      onClick={() => sendToErp(sale, now, stance.erp?.name ?? world.erp.name)}
    >
      {sale.sentToErp ? 'Send it again' : `Send to ${stance.erp.name}`}
    </Button>
  ) : null;

  /* State-specific work lives below the document snapshot on every viewport; the header order
     therefore never moves when an order changes state. */
  const headerWorkflowControl = !sale.archived
    ? sale.state === 'scheduled'
      ? <SendFlush testid="do-send" at={sale.window} onNow={() => sendSale(sale, now)} onCancel={() => cancelSend(sale, now)} />
      : primary && <Button kind={stance.lead === 'verb' ? KIND.primary : KIND.secondary}
        size={SIZE.compact} data-testid={primary.testid} onClick={takePrimary}>{verb}</Button>
    : null;

  /* ═══ B15 · THE INLINE STATE ROW (FEED-IA §59.4, THE-EXPORT-CANON §6, §15.1) ═══════════════
   * «On top of an icon, maybe it can be an inline row that has some of those things to give you a
   * quick snapshot to see if you've completed or need to complete.»
   *
   * ONE ORGAN, SIX CELLS, AND THE ORDER NEVER RE-SORTS — the eye returns to a PLACE, not to a
   * word. It rides the dock, which is the one thing on this pane that never scrolls away, so the
   * facts §35.3 asked for at the top are on screen at every scroll position and are said ONCE.
   *
   *   ┌─ THE STATE ROW ────────────────────────────────────────────────────────────────────────┐
   *   │  Changed 10:40   Edited 07:14   ⎙ 09:12   ⇄ 07:41   ✉ 10:30   4 of 6 weighed           │
   *   │  └ THE READING   └ WHOSE HAND   └ PAPER   └ SYSTEM  └ COPY     └ THE SCALE              │
   *   └────────────────────────────────────────────────────────────────────────────────────────┘
   *
   *   1 · THE READING   canon §15.1's live reading, in the reading's own words. NEVER «Closed» —
   *                     nothing closes (§67.4). First wherever it is drawn, never a colour — and
   *                     SILENT where the paper cell is already saying it (see the block below).
   *   2 · WHOSE HAND    «Edited 07:14» once a human line event exists, and NOTHING AT ALL before
   *                     that (§66.1: silence is the default; the sheet is open in front of them).
   *   3 · PAPER         ⎙ + the hour, or the owed word — and the owed word is the READING'S word,
   *                     so «Out today» keeps its day. Drawn on every document.
   *   4 · SYSTEM        ⇄ + the hour. Drawn only where the rail exists.
   *   5 · COPY          ✉ + the hour. Drawn only where the rail exists.
   *   6 · THE SCALE     «4 of 6 weighed» (Base: «4 of 6», never «4/6»). Last: the first thing a
   *                     narrow screen can afford to lose.
   *
   * OWED VERSUS DONE IS INK WEIGHT, NEVER COLOUR (canon §6.1). Colour is not a status system here
   * (§51), the accent marks Rocoto's own acts alone, and a red rail would claim an emergency the
   * trade does not have. Work stands in contentPrimary; the record steps back to tertiary. It is
   * the same grammar the river uses for whole rows, applied inside one line.
   *
   * IT NEVER WRAPS. A second storey pushes the goods off a 390px screen, so it truncates from the
   * right — towards the export block in flow above, where every hour is a full sentence. That is
   * §35.3's «the line between visible and obscure is the design», answered.
   *
   * AND EVERY CELL IS A DOOR INTO ITS OWN RAIL (canon §6.4). Pressing the paper cell walks the
   * pane to the export block; the system and copy cells do the same. The tap NEVER MUTATES — it
   * moves the eye, which is the one thing a snapshot is allowed to do. */
  const weighable = sale.lines.filter(weighsOnScale);
  const weighed = weighable.filter((l) => l.given !== l.ordered && !l.unreadable);
  const reading = liveReadingOf(sale, todayId(cast));
  const hand = handAt(sale);
  const cells: StateCell[] = [];
  /* ── THE ROW SAYS ITS STATE ONCE (AUDIT-2 C25 · §59.4 · §59.2) ─────────────────────────────
   * «To print · To print · 0 of 5 weighed» stood on every unprinted sheet in the house. The first
   * cell and the paper cell are TWO READINGS OF ONE RAIL: `liveReadingOf`'s ladder falls through
   * to the paper branch whenever no attention state outranks it, and the paper cell was already
   * saying that same fact an inch to the right. §59.4 asks for ONE row and A SNAPSHOT, and §59.2
   * says the words that earn space are the STATE and the COUNT — a state printed twice earns the
   * space once.
   *
   * SO THE PAPER CELL SPEAKS AND THE READING STANDS DOWN, rather than the other way round: the
   * cell carries the rail's own ⎙ mark, which is what makes «⎙ Out today» legible without the verb
   * (§59.2's «an act carried by its icon does not spell its verb»). The cell takes the READING'S
   * word so nothing is lost in the trade — «Out today» keeps the day it was telling you about.
   *
   * WHICH BRANCH IS THE PAPER'S IS ASKED OF `owedOf`, NOT OF THE STRING. Two of the ladder's
   * branches speak about paper — the owed one («Out today» / «To print») and the record one
   * («Printed 3× · 10:40» over a cell reading «3× · 10:40») — and both are reached only when
   * nothing above them answered. Everything else stays: «Complaint · ⎙ To print» is two rails and
   * two facts, and «Changed 10:40 · ⎙ 09:12» is the paper's hour beside the reason it is stale. */
  const wants = owedOf(sale);
  const outranksPaper = wants.resolution || wants.answer || wants.changed || wants.system;
  const paperSpeaks = !outranksPaper && (wants.paper || (!wants.pick && canPrepare(sale) && Boolean(sale.printed)));
  /* 3 · PAPER — on every document, because paper is the rail every house has. Owed says the owed
     word in ink; done says the hour, and its copies where there are several. */
  cells.push(
    sale.printed
      ? {
          id: 'paper',
          mark: 'print',
          text: sale.printed.count > 1 ? `${sale.printed.count}× · ${sale.printed.at}` : sale.printed.at,
          owed: sale.printed.stale,
        }
      : { id: 'paper', mark: 'print', text: paperSpeaks ? reading.word : 'To print', owed: true },
  );
  /* 4 · THE HOUSE'S OWN SYSTEM, and 5 · THE CUSTOMER'S COPY — drawn only where the rail exists,
     because a cell about a rail nobody has connected is a fact about our software rather than
     about their document (§2.5: absent, not held). */
  if (sale.sentToErp) {
    cells.push({ id: 'system', mark: 'erp', text: sale.sentToErp.at, owed: sale.sentToErp.stale });
  }
  if (sale.emailScheduled) {
    cells.push({
      id: 'copy',
      mark: 'email',
      text: sale.emailScheduled.sent ?? sale.emailScheduled.sendAt,
      owed: !sale.emailScheduled.sent,
    });
  }
  /* 6 · THE SCALE. «4 of 6 weighed» — Base's own count grammar, never «4/6». It is owed while the
     scale still has something to say, because a document printed before it does prints the wrong
     numbers. */
  if (weighable.length > 0) {
    cells.push({
      id: 'scale',
      text: `${weighed.length} of ${weighable.length} weighed`,
      owed: weighed.length < weighable.length,
    });
  }
  /* THE PAPER IN THE TRAY IS OUT OF DATE. The ledger answers it directly now — any goods event
     after the press makes the sheet stale (§29.2) — so a customer's own change and a hand's edit
     reach the same sentence instead of only the first one doing. */
  const reprint = editedSincePrint(sale);
  /* THE CONFIDENCE ORGAN'S OWN FACT (§120.2 · §120.3). Which of the two actions this document asks
     of a person, or nothing at all where it asks nothing — read off `tick.tsx`'s one fold, which
     is `jobOf` renamed into §120's grammar rather than a second opinion about the same sale.
     SUBSCRIBED (§127.2): a person who dismissed this document's anxiety WITH A REASON told Rocoto
     something, and the row settles in the same frame they said it. */
  const owedAction = useOwed(sale);
  /* AND WHAT IS SPOKEN ALOUD IS WHAT IS ON SCREEN (§H11). `Aloud` reads this array, so a reading
     the row no longer draws is a reading the row no longer says — one snapshot, one voice. The
     tick LEADS the row and says a word whenever something is owed, so that word leads the voice
     too: a row saying «Edit the albarán» in ink while the voice stayed silent about it would be
     two different documents. */
  const status: string[] = [

    ...(paperSpeaks ? [] : [reading.word]),
    ...(hand ? [`Edited ${hand}`] : []),
    ...cells.map((c) => c.text),
  ];

  // Keep every document hook mounted while its product replaces the visible content.
  if (notice && sale.changed) {
    return <Notice sale={sale} cast={cast} derived={derived} onBack={() => setNotice(false)} />;
  }

  if (card) {
    return <ProductCard cast={cast} product={card} onBack={() => setCard(null)} />;
  }

  return (
    <div
      ref={sheet}
      data-testid="sale-detail"
      data-sale={sale.id}
      data-state={sale.state}
      /* WHETHER SOMEBODY HAS LOOKED AT IT (AUDIT-2 C7 · §66.1). The sheet carried `data-state`,
         `data-review` and no read attribute at all, so the one attention state the app has was
         invisible to everything — a person, a screen reader and a harness alike. It is STATED
         rather than printed (§61.2): the dock's own control is where a person reads it. */
      data-read={sale.read ? 'yes' : 'no'}
      /* WHERE THIS ONE STANDS IN THE REVIEW FLOW (§51.25) — stated, never printed (§61.2) */
      data-review={review ? `${review.at}/${review.total}` : undefined}
      style={{
        /* THE PANE STEPS BACK FOR A FULL-SCREEN CONVERSATION (§202.3). Hidden, never unmounted:
           the scroll, the drafts and the open sections are all still here when it returns. */
        display: phone && chatIsScreen ? 'none' : 'flex',
        flexDirection: 'column',
        minWidth: 0,
        /* THE PAPER GROUND REACHES EVERY EDGE OF THE PANE (§38). A short albarán used to end
           halfway up its column with the frame's own ground showing under it, which is what makes
           a full-height pane read as a floating box again. */
        minHeight: phone ? (phoneViewport ? `${phoneViewport.height}px` : '100dvh') : '100%',
        height: phone ? (phoneViewport ? `${phoneViewport.height}px` : '100dvh') : undefined,
        overflowY: phone ? 'auto' : undefined,
        overflowX: phone ? 'hidden' : undefined,
        WebkitOverflowScrolling: phone ? 'touch' : undefined,
        scrollPaddingTop: phone ? '64px' : undefined,
        scrollPaddingBottom: phone ? `calc(${phoneBar + 80}px + env(safe-area-inset-bottom, 0px))` : undefined,
        position: phone ? 'fixed' : undefined,
        left: phone ? 0 : undefined,
        right: phone ? 0 : undefined,
        top: phone ? `${phoneViewport?.offsetTop ?? 0}px` : undefined,
        zIndex: phone ? LAYER + 1 : undefined,
        paddingTop: phone ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: phone ? 'env(safe-area-inset-bottom)' : undefined,
        background: phone ? theme.colors.backgroundPrimary : theme.colors.backgroundSecondary,
      }}
    >
      {/* ── THE CHROME, SHRUNK TO NEARLY NOTHING (FEED-IA §51.8) ────────────────────────────
          «The top currently spends itself on number + prev/next. A bar within the sidebar looks
          dumb.» So on a desk there is no bar at all: the walk went into the document's own head
          beside the customer's name, and the way out is walking (§37.9). What is left here is the
          PHONE'S back — one row, because behind a phone's panel there is a real destination.

          AND A STACKED DESK HAS THE SAME DESTINATION BEHIND IT (FEED-IA §103). Under 1096 the two
          panes stand one at a time, so the river is somewhere the person came FROM rather than
          something standing beside them — the same fact the phone has always had, at the same
          widths the app now calls stacked. `usePushed()` is that one question, asked once. */}
      {pushed && !phone && (
        <div
          data-testid="panel-head"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`,
            borderBottom: `1px solid ${theme.colors.mono400}`,
            background: theme.colors.backgroundSecondary,
            minWidth: 0,
          }}
        >
          <Button
            kind={KIND.tertiary}
            size={SIZE.compact}
            data-testid="close-detail"
            aria-label="Back to delivery notes"
            overrides={{ BaseButton: { style: { minHeight: '48px', minWidth: '48px', paddingLeft: 0, paddingRight: 0, fontSize: '28px' } } }}
            onClick={onClose}
          >
            <Glyph id="back" size={20} />
          </Button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          /* THE ONE DISTANCE THAT SEPARATES REGISTERS. Document, dock, annotation stand this far
             apart and nothing inside any of them ever does (§22.6). */
          gap: phone ? theme.sizing.scale500 : gap.register,
          /* §193.5: no top padding on a desk — a scrollport's own top padding is where a sticky
             child pins, and the lines' ring bled through that 16px gap above the pinned head */
          padding: phone ? 0 : `0 ${theme.sizing.scale600}`,
          /* the bar rides the pane's floor on a desk, so the annotation's last line keeps the
             bar's own measured height of room under it rather than finishing beneath it (§39.3) */
          paddingBottom: phone ? `calc(${theme.sizing.scale900} + ${phoneBar + 8}px + env(safe-area-inset-bottom))` : theme.sizing.scale700,
          minWidth: 0,
        }}
      >
        {/* ═══ 1 · THE DOCUMENT ═══════════════════════════════════════════════════════════════
            A POPPED-OUT CARD (§17.2): paper on the ground, elevated, one continuous wrapped
            object. Nothing on it is a control except the acts that GROW it — editing a line and
            adding one — because everything else a person can do is an act UPON it, and those live
            on the dock below. */}
        {/* ⚠ THE CARD NO LONGER CLIPS ITS OWN CHILDREN (FEED-IA §131.1) ────────────────────
            `overflow: hidden` was here to round the head's and the total's corners for free — and
            an ancestor with a clipped overflow is the one thing that makes `position: sticky`
            do nothing at all, because the sticky child then resolves against a box that cannot
            scroll. The head is sticky now, so the clip goes and the two ends of the card carry
            their OWN radii, which is the same drawing by the honest route. */}
        <article
          data-testid="document"
          data-sale-id={sale.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            borderRadius: phone ? 0 : theme.borders.radius400,
            border: phone ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
            background: theme.colors.backgroundPrimary,
            boxShadow: phone ? 'none' : theme.lighting.shadow500,
          }}
        >
          {/* ── THE DOCUMENT'S HEAD HAS TWO STATES AND ONE ELEMENT (FEED-IA §193.5) ─────────
              Peter: «why isnt the albaran header sticky or something or have a compact sticky
              state? think about this well. same with desktop.» So the head is sticky on EVERY
              posture, and once the paper has scrolled under it, it compacts to what a person forty
              lines down must still have: WHO, WHEN (with their place in the morning's walk), the
              alarm, the way back — and on a desk the paper act. Never two headers cross-fading:
              one element, hard swap on the frame the threshold crosses. */}
          <header ref={headRef} data-testid="document-head" data-doc="albaran" data-sticky={headSticky ? 'yes' : 'no'} data-compact={compact ? 'yes' : 'no'}
            style={{ display: 'flex', flexDirection: 'column', gap: compact ? 0 : theme.sizing.scale400,
              padding: compact ? `0 ${theme.sizing.scale400}` : phone ? theme.sizing.scale300 : theme.sizing.scale500, minWidth: 0,
              borderBottom: `1px solid ${theme.colors.borderOpaque}`,
              borderTopLeftRadius: theme.borders.radius400, borderTopRightRadius: theme.borders.radius400,
              background: theme.colors.backgroundPrimary,
              boxShadow: compact ? theme.lighting.shadow400 : undefined,
              position: headSticky ? 'sticky' : 'relative', top: 0, zIndex: 2 }}>
            {compact ? (
              <>
                <div data-testid="document-head-compact"
                  style={{ display: 'grid', gridTemplateColumns: `${phone || pushed ? '48px ' : ''}minmax(0, 1fr) auto`,
                    alignItems: 'center', gap: theme.sizing.scale300, minHeight: '56px', minWidth: 0 }}>
                  {(phone || pushed) && <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="close-detail" aria-label="Back to delivery notes"
                    overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', paddingLeft: 0, paddingRight: 0 } } }} onClick={onClose}><Glyph id="back" size={20} /></Button>}
                  <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <CustomerHoverCard customer={sale.customer}>
                      <button type="button" data-testid="document-who" aria-label={`Open ${sale.customer.name}`}
                        onClick={() => openCustomer(sale.customer.id)}
                        style={{ ...theme.typography.LabelLarge, minWidth: 0, minHeight: 28, padding: 0, border: 0, background: 'transparent',
                          color: 'inherit', textAlign: 'left', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Name of={sale.customer} />
                      </button>
                    </CustomerHoverCard>
                    {/* the walk's position is STATED here, not controlled — §22.5's «‹ 3 of 16 ›» fact */}
                    <span data-testid="document-when-compact" data-day={sale.deliveryDay}
                      style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[sale.deliveryDay, askedSlotOf(sale), flips && at >= 0 ? `${at + 1} of ${list.length}` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200, flex: '0 0 auto', minWidth: 0 }}>
                    <AttentionLabels sale={sale} testid="document-attention" />
                    {!phone && !pushed && round && <TruckChip round={round} where={{ at: sale.customer.at, name: sale.customer.name }} order={sale.archived ? undefined : sale} />}
                    {!phone && <span data-testid="head-print">{printControl}</span>}
                  </span>
                </div>
                {reprint && <span data-testid="reprint" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentPrimary, paddingBottom: theme.sizing.scale200 }}>
                  {stance.paper.live ? 'Working paper changed · print a final copy' : 'Working paper changed'}</span>}
              </>
            ) : (<>
            {/* §142: Back and document actions share one edge row. §193.5: the walk's buttons are
                gone — a phone swipes, a desk uses ← / →, and the compact head states the place. */}
            <div data-testid="head-acts" style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: phone ? theme.sizing.scale100 : theme.sizing.scale200, minWidth: 0 }}>
              {phone && <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="close-detail" aria-label="Back to delivery notes"
                overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', paddingLeft: 0, paddingRight: 0 } } }} onClick={onClose}><Glyph id="back" size={20} /></Button>}
              {!phone && <span style={{ flex: 1 }} />}
              {/* Fixed header order: Status, Print, Activity, Flag, Archive. */}
              <span data-testid="head-direct-actions" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: phone ? '1px' : theme.sizing.scale100, flex: phone ? '0 1 auto' : '0 0 auto', maxWidth: phone ? 'calc(100% - 56px)' : undefined, minWidth: 0 }}>
                <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="head-status"
                  aria-label={`Delivery status · ${headerStatusWords}`}
                  onClick={() => openPrintActivity(sale.id, 'status')}
                  startEnhancer={phone ? undefined : <Glyph id="clock" size={16} />}
                  overrides={{ BaseButton: { style: { minHeight: '48px', minWidth: phone ? '48px' : undefined, maxWidth: '168px', flex: phone ? '1 1 auto' : undefined, paddingLeft: phone ? 0 : undefined, paddingRight: phone ? 0 : undefined, fontSize: phone ? '13px' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } } }}>
                  {headerStatusWords}
                </Button>
                {!phone && <StatefulTooltip content={stance.paper.because ?? 'Print this delivery note'} placement={TOOLTIP_PLACEMENT.bottom} overrides={OVER_THE_CHROME}>
                  <span data-testid="head-print">{printControl}</span>
                </StatefulTooltip>}
                {tipped(<Button kind={KIND.tertiary} size={SIZE.compact} data-testid="albaran-print-activity" aria-label="Open delivery note activity" onClick={() => openPrintActivity(sale.id, 'activity')} overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', paddingLeft: 0, paddingRight: 0 } } }}><Glyph id="log" size={18} /></Button>, 'Activity')}
                {/* ── THE RED ICON AT REST (FEED-IA §196.3) ─────────────────────────────────────────
                    «red identifiers and not dots… like come on be top down!!!» A flagged document
                    said so in a secondary button KIND — a grey box, which is what every other
                    pressed control in the head looks like. The mark itself carries the red now, at
                    rest, so the head states the flag in the same vocabulary the river's row and the
                    albarán's line do. `aria-pressed` still carries it for a reader who hears. */}
                {tipped(<Button kind={sale.flagged ? KIND.secondary : KIND.tertiary} size={SIZE.compact} data-testid={sale.flagged ? 'do-unflag' : 'do-flag'} data-flagged={sale.flagged ? 'yes' : 'no'} aria-pressed={Boolean(sale.flagged)} aria-label={sale.flagged ? 'Remove flag from delivery note' : 'Flag delivery note'} onClick={() => sale.flagged ? unflagSale(sale, now) : flagSale(sale, now)} overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', paddingLeft: 0, paddingRight: 0, color: sale.flagged ? flagInk(theme) : undefined } } }}><Glyph id="flag" size={18} /></Button>, sale.flagged ? 'Remove flag' : 'Flag')}
                {!sale.archived && tipped(<Button kind={KIND.tertiary} size={SIZE.compact} data-testid="do-archive" aria-label="Archive delivery note" onClick={() => { reversible(`Delivery Note archived · ${sale.customer.name}`, () => archiveSale(sale, now, config.owner.name)); onClose(); }} overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', paddingLeft: 0, paddingRight: 0 } } }}><Glyph id="archive" size={18} /></Button>, 'Archive')}
              </span>
            </div>
            <div data-testid="document-identity" style={{ display: 'flex', alignItems: 'flex-start', gap: theme.sizing.scale400, minWidth: 0 }}>
              {sale.customer.at && <StatefulTooltip content={`${whereWords} · ${MAP_CREDIT}`} placement={TOOLTIP_PLACEMENT.bottom} overrides={OVER_THE_CHROME}>
                {/* E193.14 · INTX-12: the map square IS the door to the map, so a thumb gets the
                    44px floor on it. The square grows by four pixels and the pin inside it grows
                    with it — the head's own geometry, one step wider, never a hole beside it. */}
                <button type="button" data-testid="map-square" aria-label={`${whereWords} · open the map`} onClick={() => setMap(true)}
                  style={{ flex: '0 0 auto', width: phone ? TOUCH_FLOOR : 56, height: phone ? TOUCH_FLOOR : 56, padding: 0,
                    border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300,
                    background: theme.colors.backgroundSecondary, overflow: 'hidden', cursor: 'pointer' }}>
                  <PinMap at={sale.customer.at} height={phone ? TOUCH_FLOOR : 56} caption={false} pin={16} />
                </button>
              </StatefulTooltip>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, flex: 1, minWidth: 0 }}>
                <CustomerHoverCard customer={sale.customer}>
                  <button type="button" data-testid="document-who" aria-label={`Open ${sale.customer.name}`}
                    onClick={() => openCustomer(sale.customer.id)}
                    style={{ ...(phone ? theme.typography.HeadingXSmall : theme.typography.HeadingSmall), minWidth: 0,
                      /* E193.14 · INTX-12: a phone's thumb gets its 44px on the name too */
                      minHeight: phone ? 44 : undefined, display: 'inline-flex', alignItems: 'center',
                      padding: 0, border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                    <Name of={sale.customer} />
                  </button>
                </CustomerHoverCard>
                <div data-testid="document-when" data-day={sale.deliveryDay} data-slot={askedSlotOf(sale) ?? undefined}
                  style={{ ...(phone ? theme.typography.LabelMedium : theme.typography.HeadingXSmall),
                    fontFamily: (theme as unknown as { brand?: { dateFont?: string } }).brand?.dateFont ?? theme.typography.HeadingXSmall.fontFamily,
                    fontWeight: 400, display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale200, flexWrap: 'wrap', minWidth: 0 }}>
                  <span>{sale.deliveryDay}</span>
                  {askedSlotOf(sale) && !(sale.writtenHere && !slotsTaken.includes(sale.id)) &&
                    <span data-testid="slot-chip" data-slot={askedSlotOf(sale)} style={{ whiteSpace: 'nowrap', color: theme.colors.contentSecondary }}>· {askedSlotOf(sale)}</span>}
                </div>
              </div>
              <AttentionLabels sale={sale} testid="document-attention" />
            </div>
            <div data-testid="state-row" data-facet={status.join(' · ')} data-reading={reading.word} data-owed={reading.owed ? 'yes' : 'no'}
              style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap',
                ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}>
              <Aloud said={status.join(' · ')} about={sale.id} testid="state-row-aloud" />
              <span data-testid="document-number">{sale.number}</span>
              {sale.archived && <span data-testid="detail-archived-by">Archived{sale.archived.by ? ` by ${sale.archived.by}` : ''} · {sale.archived.at}</span>}
              {sale.read && <span data-testid="detail-viewed-by">Viewed{sale.read.by ? ` by ${sale.read.by}` : ''} · {sale.read.at}</span>}
              {/* §196.3: the one line in the state row that is about a FLAG says so in the red;
                  Archived and Viewed stay the record's own quiet ink, because neither is a flag. */}
              {sale.flagged && <span data-testid="detail-flagged-by" data-flag-word="marked"
                style={{ color: flagInk(theme) }}>Flagged by {sale.flagged.by} · {sale.flagged.at}</span>}
              {reprint && <span data-testid="reprint" style={{ color: theme.colors.contentPrimary }}>{stance.paper.live ? 'Working paper changed · print a final copy' : 'Working paper changed'}</span>}
            </div>
            {!phone && !sale.archived && (headerWorkflowControl || clarifyControl || handoffControl || erpControl || doors.length > 0 || sale.state === 'disputed') && (
              <div data-testid="head-workflow-actions" data-lead={stance.lead}
                style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap', minWidth: 0 }}>
                {headerWorkflowControl}
                {clarifyControl}{handoffControl}{erpControl}{doors}
                {sale.state === 'disputed' && <Complaint sale={sale} cast={cast} />}
              </div>
            )}
            {phone && !sale.archived && (clarifyControl || handoffControl || erpControl || doors.length > 0 || sale.state === 'disputed') && (
              <div data-testid="head-workflow-actions" data-lead={stance.lead}
                style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap', minWidth: 0 }}>
                {clarifyControl}{handoffControl}{erpControl}{doors}
                {sale.state === 'disputed' && <Complaint sale={sale} cast={cast} />}
              </div>
            )}
            <div data-testid="head-settings" style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
              {round && <TruckChip round={round} where={{ at: sale.customer.at, name: sale.customer.name }} order={sale.archived ? undefined : sale} />}
              {!sale.archived && askedSlotOf(sale) && sale.writtenHere && !slotsTaken.includes(sale.id) &&
                <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="slot-offer" data-slot={askedSlotOf(sale)} onClick={() => takeSlot(sale.id)}>
                  usually {askedSlotOf(sale)}</Button>}
              {pricingAvailable && isMultiTier(cast) && (
                <StatefulPopover
                  placement={PLACEMENT.bottomLeft}
                  triggerType={TRIGGER_TYPE.click}
                  /* §54.1: every layer clears the chrome, this one included */
                  overrides={{ Body: { style: { zIndex: LAYER } } }}
                  content={({ close }) => (
                    <StatefulMenu
                      items={tiersOfHouse(cast).map((t) => ({ label: t.name, id: t.id }))}
                      onItemSelect={({ item }) => {
                        setSaleTier(sale, now, String(item.id));
                        close();
                      }}
                      overrides={{ List: { style: { minWidth: '180px' } } }}
                    />
                  )}
                >
                  <Button
                    kind={KIND.secondary}
                    size={SIZE.mini}
                    data-testid="document-tier"
                    data-tier={sale.tier}
                    aria-label={`Priced on ${tierWordsOf(cast, sale)} — choose the band`}
                    aria-haspopup="menu"
                    disabled={!editable}
                    endEnhancer={<Glyph id="caret" size={16} />}
                  >
                    {tierWordsOf(cast, sale)}
                  </Button>
                </StatefulPopover>
              )}
            </div>
            </>)}
          </header>

          {/* ── THE BODY: WHAT IT CARRIES ────────────────────────────────────────────────────
              AND NO LABEL OVER IT. «WHAT THE ALBARÁN CARRIES» sat in tracked uppercase between the
              customer's name and the goods, at the same step as the annotation's own labels a
              screen below — so it both crowded the document and blurred the register that was
              supposed to separate the two. Under a customer's name, a list of goods with a total
              at its foot needs no announcement. The one line that earns a place here is the bay's
              own count, and only while somebody is actually picking. */}
          {/* THE COUNTER THAT STOOD HERE — «0 of 3 picked» — WENT WITH THE TICKS (§26.1). A number
              that only moves when somebody performs a marking-off is a number about the ceremony,
              not about the goods. What the head says instead is what the loop turns on: how much
              of this has been weighed, and whether the paper is current. */}
          <PaperReadBackDock scope={config.cast} sale={sale} editable={editable} phone={phone} onPrint={onPrint} />
          <AlbaranPaperReviewCard scope={config.cast} sale={sale} editable={editable} phone={phone} />
          {standingConcernsOf(sale).filter((concern) => concern.kind === 'check' && concern.group && !dismissedNow(sale.id, concern.id)).map((concern, i) => (
            <div key={concern.id} style={{ padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`, borderTop: `1px solid ${theme.colors.borderOpaque}`, minWidth: 0 }}>
              <ConcernNote sale={sale} concern={concern.id} says={concern.says} now={now} testid={`group-concern${i > 0 ? `-${i}` : ''}`} />
            </div>
          ))}
          <div data-testid="document-lines" style={standingConcernsOf(sale).some((concern) => concern.kind === 'check' && concern.group && !dismissedNow(sale.id, concern.id)) ? { border: `2px solid ${theme.colors.accent}`, borderRadius: theme.borders.radius300 } : undefined}>
            {sale.lines.map((l, i) => (
              <Line
                key={l.id}
                cast={cast}
                sale={sale}
                sales={sales}
                line={l}
                index={i}
                editable={editable}
                /* THE POSTURE IS PINNED WHILE §23 WAITS ON PETER (see `Register` above), and the
                   TICK IS PARKED BY §26.1 (see `PICKING` above). Both branches still compile. */
                register="answer"
                picking={PICKING && preparing}
                ticked={(sale.prep?.lines ?? []).includes(l.id)}
                now={now}
                /* THE KEYBOARD LANDS ON THE FIRST LINE AND NOWHERE ELSE (checkpoint §14.2b). One
                   arrival point is what makes Enter a muscle: the eye already reads a document
                   top-down, so the caret starts where the reading does and Tab carries it on. */
                enter={i === 0 ? entered : undefined}
                onOpenCard={setCard}
              />
            ))}

          </div>

          {/* ── ADD A LINE, AT THE POINT OF GROWTH (FEED-IA §84.2) ────────────────────────────
              «Adding a new line — why is the button for that ABOVE?» It never was above the lines,
              and that is exactly what made the complaint worth answering rather than dismissing:
              the TAKEN-OFF block stood between the last line and the add-a-line row, so what a
              person saw under the goods was a struck-through list with a «Put it back» beside it,
              and the control that grows the document was pushed one section down — reading, at a
              glance, as a control belonging to the removals rather than to the lines.

              THE LIST'S TRUE END IS THE LAST LINE. So the add-a-line row is contiguous with it,
              the way a member's «add one» row is contiguous with its family in the catalogue, and
              the removals fall BELOW the growth point — they are a way back, not a way forward. */}
          {/* THE CIRCLE CLOSES HERE (§116.3): the composer's «Edit tariffs» opens the product's
              own sheet, which is the surface the catalogue edits bands on — the same door the
              lines above already use for their paintings and their names (§43). */}
          {editable && <AddLine cast={cast} sale={sale} now={now} carryOn={carryOn} onOpenCard={setCard} />}

          {/* WHAT CAME OFF, AND THE WAY BACK. It sits in the document's own body rather than in a
              toast, because a toast is gone by the time a person notices what they did — and
              because putting it back GROWS the document, which is this body's whole business.
              IT STANDS UNDER THE GROWTH POINT (§84.2), never between the goods and the row that
              adds to them. */}
          {sale.removed && sale.removed.length > 0 && (
            <div
              data-testid="removed-lines"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.sizing.scale300,
                padding: theme.sizing.scale500,
                borderTop: `1px solid ${theme.colors.borderOpaque}`,
                minWidth: 0,
              }}
            >
              <FieldLabel>Taken off</FieldLabel>
              {sale.removed.map((l) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, textDecoration: 'line-through', flex: 1, minWidth: 0 }}>
                    <LineName line={l} /> · {qtyWords(l.given, l.unit)}
                  </span>
                  {editable && (
                    <Button
                      kind={KIND.secondary}
                      size={SIZE.mini}
                      data-testid={`restore-${l.id}`}
                      startEnhancer={<Glyph id="undo" size={16} />}
                      onClick={() => restoreLine(sale, now, l.id)}
                    >
                      Put it back
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {pricingAvailable ? <>
          {/* ── THE FOOT: THE FIGURE, WHERE A DOCUMENT'S TOTAL BELONGS ─────────────────────── */}
          <div
            data-testid="document-total"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: theme.sizing.scale500,
              padding: theme.sizing.scale600,
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              background: theme.colors.backgroundSecondary,
              minWidth: 0,
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
              {/* ── A DOCUMENT WITH NOTHING ON IT STATES NO TOTAL (FEED-IA §83.1) ────────────
                  «Looks so shit like this empty bro.» The composer's card was the screen he was
                  looking at, and this is the same card ONE KEYSTROKE LATER: naming a draft hands
                  the pane to this sheet (§74.3), so a total that said «Total · 0 lines · 0,00 €»
                  here would put the banned sentence straight back on screen the moment a customer
                  was picked. The count and the figure are shapes until there is something to
                  count — the add-a-line organ standing open above them is what the body carries
                  meanwhile, which is where the caret already is. */}
              {sale.lines.length === 0 ? (
                <span style={{ display: 'flex', alignItems: 'center', height: theme.typography.LabelSmall.lineHeight }}>
                  <GhostBlock shape="line" tone="faint" width={64} height={8} />
                </span>
              ) : (
                <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                  Total · {sale.lines.length} {plural(sale.lines.length, 'line')}
                </span>
              )}
              {/* MARK PAID IS ONE TAP, AND THE METHOD RIDES IT (§9, musing 4). The verb pays the
                  way this customer usually pays, so the commonest case takes no choosing at all,
                  and the other two ways stand beside it as the same act said differently — «Mark
                  paid · in cash · by card» reads as one sentence with three endings. */}
              {PAYMENTS && RANK[sale.state] >= RANK.made && !sale.paid && (
                <span style={{ display: 'inline-flex', gap: theme.sizing.scale300, alignItems: 'center', flexWrap: 'wrap', paddingTop: theme.sizing.scale200 }}>
                  <Button
                    kind={KIND.secondary}
                    size={SIZE.mini}
                    data-testid="mark-paid"
                    onClick={() => markPaid(sale, now, payMethodOf(sale))}
                  >
                    Mark paid
                  </Button>
                  {PAY_METHODS.filter((m) => m !== payMethodOf(sale)).map((m) => (
                    <Button
                      key={m}
                      kind={KIND.tertiary}
                      size={SIZE.mini}
                      data-testid={`mark-paid-${m}`}
                      onClick={() => markPaid(sale, now, m)}
                    >
                      {PAID_HOW[m]}
                    </Button>
                  ))}
                </span>
              )}
            </span>
            {/* ── WHAT THE MONEY HAS DONE (§9, musing 4) ────────────────────────────────────
                One quiet line ON THE FIGURE'S OWN LINE BOX — the hour it was collected and how, or
                what this customer's own terms say is coming. It rides the figure because it is a
                fact about that number, the same way a price's unit rides its price. A document
                nobody has collected yet, inside its own credit days, says nothing: silence is the
                default, and a sentence there would be the software fretting out loud. */}
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.sizing.scale100, minWidth: 0 }}>
              {/* §83.1 — the figure is a SHAPE while there is nothing to add up, in the figure's
                  own line box, so the number arriving on the first line moves nothing (§77.2) */}
              {sale.lines.length === 0 ? (
                <span style={{ display: 'flex', alignItems: 'center', height: theme.typography.HeadingSmall.lineHeight }}>
                  <GhostFigure digits={5} unit size="large" tone="faint" />
                </span>
              ) : (
                <Figure value={sale.figure} unit="S/" size="large" />
              )}
              {money && (
                <span
                  data-testid="money-mark"
                  data-paid={sale.paid ? 'yes' : 'no'}
                  style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, textAlign: 'right' }}
                >
                  {money}
                </span>
              )}
            </span>
          </div>

          </> : (
            <div data-testid="document-line-count"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale500,
                padding: theme.sizing.scale600, borderTop: `1px solid ${theme.colors.borderOpaque}`, background: theme.colors.backgroundSecondary, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                {sale.lines.length} {plural(sale.lines.length, 'line')}
              </span>
            </div>
          )}

                  </article>

        {pricingAvailable && sale.customer.id && sale.lines.length > 0 && !sale.messageOnly && (
          <DeliveryNoteMoney sale={sale} scope={cast.sector} />
        )}


        {/* ═══ 3 · THE ORDER — THE COMM TRAIL, UNDER THE PRODUCTS (FEED-IA §131.1 · §131.3) ═══
            His structure, in his words: «Name / time / location / truck // PRODUCTS // ORDER (comm
            trail) // anxieties are inline of the above.» And, of what stood here before: «The whole
            "How it arrives" thing is silly. WHY IS THERE A SEPARATE THING? You can see all this in
            the comments IF I SEE THE ORIGINAL ORDER… the order has a product list and the original
            order below.»

            SO THERE IS ONE SECTION AND IT IS NAMED FOR THE THING IT HOLDS. «How it arrived» was a
            heading about a MECHANISM, over a block of chips saying the same three facts the trail
            below says as messages — a separate thing, exactly as he read it. The rule says «The
            order» now (the heading law: a heading NAMES the thing under it), and what was the
            arrival block is the trail's own first line: the channel, the hour and the voice note
            belong to the message, so they stand at the head of the messages.

            IT IS STILL THE ANNOTATION'S REGISTER (§14): flat on the ground, no card, at the
            smallest steps, under the raised white document. That difference is what keeps «what
            the document IS» and «what is said about it» apart, and it survives the re-seating.

            AND IT HOLDS THIS ORDER ONLY (FEED-IA §134.1): «the albarán wouldn't have the other
            orders below it lol.» `Conversation` draws `sale.thread`, which is this document's own
            turns — nothing on this surface reads the day's other sales, and nothing may. */}
        <section
          data-testid="detail-annotation"
          style={{ display: 'flex', flexDirection: 'column', gap: gap.block, minWidth: 0 }}
        >
          <SectionRule>The order</SectionRule>
          {/* §143: only messages for this order and recorded replies; one door opens its chat. */}
          <Conversation sale={sale} cast={cast} anchor={comms} />

          {/* ── WHAT IT LEFT BEHIND ──────────────────────────────────────────────────────────
              WHAT ROCOTO READ IT AS MOVED UP (§54.3). «Read from WhatsApp as 4 lines for Friday
              22.08.» was a sentence narrating the software, and every fact in it — the channel,
              the hour, the count, the day — is now either an object in the arrival block above or
              a fact in the document's own head. A sentence whose every word is said elsewhere is
              the orphan §51.24 bans.

              THE PAYMENT CLOCK WENT WITH IT (§34.1). «We don't track payments lol. That's
              billing.» The terms still PRINT on the paper, where they are the document's own
              small print and the customer's business; this panel stopped saying them. */}
          <div data-testid="detail-meta" style={{ display: 'flex', flexDirection: 'column', gap: gap.row, minWidth: 0 }}>
            {/* THE SWITCH STAMPS ITS OWN LINE (§2). It names the band and says it was for THIS
                albarán, so a reader knows the customer's standing band was left alone. */}
            {pricingAvailable && sale.tierSwitched && (
              <span
                data-testid="tier-switched"
                style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}
              >
                {tierSwitchWords(cast, sale)}
              </span>
            )}
            {sale.confirmedOver && sale.confirmedOver.length > 0 && (
              <span
                data-testid="confirmed-over"
                style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}
              >
                Confirmed over the check · {sale.confirmedOver.join(' · ')}
              </span>
            )}
            {/* ── WHAT THIS SALE TAUGHT ROCOTO (THE-INTELLIGENCE §1) ──────────────────────── */}
            {sale.learned && sale.learned.length > 0 && (
              <div data-testid="learned" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
                <FieldLabel>Patterns from this sale</FieldLabel>
                {sale.learned.map((t, i) => (
                  <FlagLine key={`${i}-${t}`} mark="Recorded pattern" text={t} testid={`learned-${i}`} />
                ))}
              </div>
            )}
            {sale.dispute?.outcome && sale.state === 'settled' && (
              <div>
                <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary} overrides={ANSWER_TAG}>
                  Complaint settled · {OUTCOMES.find((o) => o.id === sale.dispute?.outcome)?.label}
                </Tag>
              </div>
            )}
          </div>

          {/* WHERE IT GOES WENT TO THE HEAD (§39.1). The pin map is a 72px square at the top right
              of the document now, and the big one opens in a modal from it — «the location becomes
              a small square top-right». A full-width picture at the foot of the panel was the
              largest thing on the surface and the least read. */}

          {/* ═══ THE RAILS LEFT THE DOCUMENT (FEED-IA §86.6 · §86.3 · §58) ══════════════════
              «The print, ERP and email thing shouldn't be IN the albarán bro wtf???»

              WHAT STOOD HERE. A block titled «Print, Sage 50 and email», at the foot of every
              opened sheet, carrying three sentences and up to three acts. §35.3 had asked for it
              «IN each albarán», and that clause is the one §86.6 repeals: the document is the
              document, and the ACTS on it live outside its body. It read as a second dock at the
              bottom of the scroll — the very thing its own comment promised it was not — and it
              made the state row's cells into a SCROLL: press ⎙ on the dock, the pane travels a
              screen and a half, and the person's eye is now in a second place reading about the
              document they were just looking at. That is the two-surfaces cost §86.1 names.

              WHERE IT WENT. Onto the dock, as the dock's OWN detail, opened in place by the very
              cell that names it (§86.3: «the document's dock stays about THIS document»). One
              locus: the fact and its full sentence are 20px apart and the eye never leaves. The
              bulk acts — print N, the day's sheet — were never here and stay where §86.3 puts
              them, in the top header's export centre (`shell/printing.tsx`). */}
        </section>
      </div>

      {/* ── THE BAR THAT REPLACED THE CHEVRONS (FEED-IA §193.5) ──────────────────────────────
          Peter: «also the chevrons wtf? they look shit. maybe the print button should be there».
          Two mute glyphs held 65px of the only persistent phone chrome and said nothing. The bar
          now holds the document's two ACTS — the paper and the verb — which one leads following
          `stance.lead`, the machinery that already decides it. A held paper prints its reason as a
          line, because a phone has no hover (§32). The walk lost its buttons, kept its function:
          swipe the sheet; the compact head states «3 of 16». The launcher sits under this sheet
          (z-order), so the bar owes it no lane and runs full width. */}
      {phone && (
        <div data-testid="phone-detail-bar" role="group" aria-label="Acts on this delivery note" data-lead={stance.lead}
          style={{ position: 'fixed', left: 0, right: 0,
            top: phoneViewport ? `calc(${phoneViewport.offsetTop + phoneViewport.height}px - ${phoneBar}px - env(safe-area-inset-bottom, 0px))` : undefined,
            bottom: phoneViewport ? undefined : 0, zIndex: LAYER + 2,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: theme.sizing.scale100,
            height: `calc(${phoneBar}px + env(safe-area-inset-bottom, 0px))`, boxSizing: 'border-box',
            padding: `${theme.sizing.scale200} ${theme.sizing.scale400} calc(${theme.sizing.scale200} + env(safe-area-inset-bottom, 0px))`,
            borderTop: `1px solid ${theme.colors.borderOpaque}`, background: theme.colors.backgroundPrimary,
            boxShadow: theme.lighting.shadow500 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
            <span data-testid="bar-print" style={{ flex: '1 1 auto', minWidth: 0 }}>{printControl}</span>
            {headerWorkflowControl && <span data-testid="bar-verb" style={{ flex: '0 0 auto' }}>{headerWorkflowControl}</span>}
          </div>
          {!stance.paper.live && stance.paper.because && (
            <span data-testid="bar-because" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stance.paper.because}</span>)}
        </div>
      )}
      {/* THE BIG MAP, OPENED FROM THE SQUARE IN THE HEAD (§39.1). The app's own dialog vocabulary
          — the same card the lot proposal and the customer's record use — so «open the map» reads
          as the same kind of move everywhere on this surface. */}
      <OverlayCard
        isOpen={map}
        onClose={() => setMap(false)}
        scrim={SCRIM.dim}
        size={560}
        ariaLabel={`Where ${sale.customer.name} is`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Where it goes</h2>
          <PinMap
            at={sale.customer.at}
            zone={zoneNameOf(sale.customer.zone) ?? sale.customer.zone}
            truck={sale.customer.truck}
            note={`${sale.customer.name} · ${sale.deliveryDay}`}
            height={320}
          />
        </div>
      </OverlayCard>

      {gate && (
        <ConfirmGate
          cast={cast}
          sale={sale}
          sales={sales}
          act={gate}
          now={now}
          onClose={() => setGate(null)}
          inventoryEnabled={inventoryAvailable}
        />
      )}

      {/* THE CUSTOMER'S OWN RECORD IS THE CUSTOMERS AREA'S SHEET (§43, §51.8). The name at the head
          walks there, which is where every other appearance of that name in the app walks — so this
          panel no longer keeps an overlay copy of a record that has its own home. */}
    </div>
  );
}
