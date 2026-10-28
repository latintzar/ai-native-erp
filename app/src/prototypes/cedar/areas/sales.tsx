/* SALES — THE RIVER. The whole app's information architecture in one list, and the only place the
 * day's work happens.
 *
 * ═══ ONE RIVER. PREPARE IS DEAD (FEED-IA §25.1) ═════════════════════════════════════════════
 * «The day zoom we literally have in the feed itself.» So there is no second seat, no second list
 * and no job switch: THE FEED'S DAY SECTIONS ARE THE DAYS. The day's paper rides the day's own
 * whisper, and the per-line ticks live inside the sale's document where the person editing it is.
 * `day-view.tsx` is parked; nothing mounts it.
 *
 * ═══ CONTINUITY IS THE MAIN THING (§4.2) ════════════════════════════════════════════════════
 * «Monzo's feed is one unbroken river — day separators are whispers, not boxes.» So there are no
 * cards down this list and no boxes around any day: there are ROWS, and between them a small line
 * of type saying which day the rows below it are for and what that day comes to.
 *
 * ═══ THE BAND IS DEAD — ATTENTION IS SYSTEM-LED (§67.6) ═════════════════════════════════════
 * «Urgent shit that the Rocoto deferred appears as a CHAT NOTIF; otherwise it shows up as a LABEL
 * on orders, and simply having no sticky for-review thing might be best!!! but system led!! do
 * that!!!»
 *
 * §25.2 had already made the band an INDEX rather than a second home — the card and the row were
 * one entity seen twice. §67.6 finishes the argument: if the card and the row are one thing, the
 * card is the copy, and the copy is what a person has to manage. So the copy goes.
 *
 * WHAT REPLACED IT — THREE RUNGS, AND NOTHING ELSE ON THE SURFACE:
 *   SILENCE       an ordinary order says nothing at all. It is the correct interface for 285 of
 *                 300 orders, and the calm is the product (§67.6, canon §16.4).
 *   A LABEL       two or three words naming the SPECIFIC thing that is off — «Bigger than usual»,
 *                 «Off the catalogue», «Amount unreadable» — riding the row, in its own day, in
 *                 one fixed seat. Never «for review», never «needs check», never a count.
 *   THE ROW STANDS  a document that owes an ANSWER (§2.4) is raised where it already is, wearing
 *                 its reason and its ONE act (§66.2: the extra info belongs on these and nowhere
 *                 else, because on the fine ones it is pollution).
 *
 * AND THE ONE THING THAT INTERRUPTS IS THE CHAT. What Rocoto deferred and cannot sit on — a person
 * held, on a day that has come — is a CHAT NOTICE: `chatNotices` in `sale.ts` derives the set, this
 * surface states it on the river's own root, and the widget in `shell/` draws it. The seam is
 * documented where the model is; nothing here draws a notification.
 *
 * THE TEST FOR EVERY FUTURE ADDITION: the system decides what interrupts; the person never manages
 * a pile. A standing queue surface may not be rebuilt under any name.
 *
 * ═══ MESSAGES ARE A NUMBER ON THE WIDGET (§26.4 → §67.6 → §75.2, the last word) ═════════════
 * «It should just be a number on the widget.» The questions have ONE door and it is the chat
 * launcher, which wears the count as a badge off `unreadCount` in `shell/threads.ts`. The row that
 * used to stand at the head of the river is gone: two places saying «somebody is waiting» is a
 * pile in two halves, which is the thing §67.6 spent the band to kill. Their sales keep an
 * ordinary row, marked, because a message-only sale is still an object of this river (§9.2).
 *
 * ═══ THE RIVER NARROWS, AND A CONTROL OWNS THE NARROW (§27, §75.1) ══════════════════════════
 * A day narrows the SAME river to that day — a filter state, never a mode and never a place. WHAT
 * SETS IT IS `DayPicker`, Base's own `Datepicker` standing in the header block at the river's
 * head: it takes a typed date, opens a calendar marked with the days that hold orders, flips day
 * to day on ‹ ›, and releases with «All days». THE DIVIDERS ARE DIVIDERS — «not by tapping the
 * actual date dividers bro lol» — so a day's name names its rows and nothing more. One component
 * tree, one selection, one scroll container.
 *
 * ═══ AND IT NARROWS BY WHOSE, TOO (§32 — the second narrow) ═════════════════════════════════
 * «Comerciales prep their own — mine is a NARROW (like the date narrow, they compose): band,
 * counts and ⎙ buttons all scope to the narrow.» So this surface carries TWO filters over ONE
 * river and they multiply: a comercial's Friday is «mine» and «that day» at once, each released
 * on its own. `ScopeLine` below is the whose; the whisper is the when.
 *
 * ═══ THE SWEEP IS A KEYBOARD LOOP (§32.A) ═══════════════════════════════════════════════════
 * «They check the fine ones too. The design owes them SPEED.» P prints the open albarán and
 * ADVANCES to the next; ← → walk without printing; Esc releases the innermost thing. The eyes
 * never move, because the panel stands still and the next order slides into it. Three to five
 * seconds an order makes a comercial's thirty-five a three-minute job — which is what turns «I
 * have to check all of them» from a reason to distrust the software into an afternoon's work.
 *
 * ═══ AND THE RIVER'S OWN AXIS TRAVELS (§111.1 — THE ROULETTE) ═══════════════════════════════
 * «Things would by default be resolved… it shouldn't give the impression they'd confirm every
 * single thing — that's like five percent. I envision them scrolling a lot — scrolling with MOTION
 * BLUR — and landing on something like a ROULETTE or SLOTS interface: it lands on the item that
 * needs checking, boom, they do it. They'd be erratically pressing the down button.»
 *
 * THREE THINGS CAME OUT OF THAT VERDICT AND THEY ARE ALL ON THIS SURFACE:
 *   THE IMPRESSION   the day reads as HANDLED. Every whisper says what Rocoto settled on its own
 *                    («Rocoto handled 34 of 38», the six checks one press behind it), the stopped
 *                    few stand on their own ground so the difference is seen rather than found,
 *                    and the verb on a stopped row is a WORD at rest — a river of filled buttons
 *                    is a to-do list whatever the rows under them say.
 *   THE TRAVEL       ↓ ↑ step one row; a RUN of presses faster than a person can read travels —
 *                    the river smears, scrolls and DECELERATES onto the next document that
 *                    stopped. `TRAVEL_PRESSES` / `TRAVEL_WINDOW_MS` carry the reasoning.
 *   THE QUICK CHECK  the one verb opens a card that MORPHS out of the row and folds back into it.
 *                    «They can't just confirm to understand it» — so the A key raises this card
 *                    instead of answering blind, and the confirmation is seen before it happens.
 * The motion is licensed by §111.1 and still obeys the doctrine: the theme's own timings and
 * curves, nothing moving at rest, and `prefers-reduced-motion` lands every one of them still.
 *
 * ═══ AND THE CARD'S INSIDE IS A FILM (§115.3 · §115.6) ══════════════════════════════════════
 * «Being checked is that they tap it. It shows the message. It shows what they wanted to confirm.
 * The order shows a change happening, and then it gets saved.» Four beats, NAMED BEFORE THE
 * LAYOUT (§115.6's build order), and three of them are one continuous shot of the order — the
 * person watches the doubt come off their own document rather than reading a description of a
 * change and pressing yes. No progress bar and no are-you-sure, both said with heat. The beats
 * and their holds are at `QuickCheck`.
 *
 * ═══ OVERLAP IS NOT A MODE (§26.6) ══════════════════════════════════════════════════════════
 * «Many times orders get processed with an overlap with the ordering period. The UX lets them do
 * that, not that it's a mode at all.» An arrival is an ordinary event in the ordinary ledger: the
 * river gains a row under whatever is open, the day's aggregate moves, and the document a person is
 * editing loses nothing and keeps the scroll it was read at.
 *
 * ═══ NOTHING CLOSES — WHAT IS OWED STANDS (§67.4, canon §15.1) ══════════════════════════════
 * «NOTHING CLOSES, basically — get it?» So the row's word is THE LIVE READING, in the reading's own
 * words: «Out today» · «Changed 10:40» · «Sage 50 again» · «Printed 09:31» · «Sent». A row that
 * wants something keeps full ink and stands; a row that wants nothing steps back and lies flat; the
 * reading goes BACKWARDS the moment the crate moves, which is the whole point of a stream. Record
 * and work live together in one list, and «Open»/«Closed» are gone from every surface.
 *
 * ═══ THE COMMIT INVERSION (§6.2, §26.3) ═════════════════════════════════════════════════════
 * «Arrivals land COMMITTED BY DEFAULT. Uncommitted is the EXCEPTION state.» The river is almost
 * entirely settled work flowing past, and the few things a person still has to judge are the
 * exception rather than the subject.
 *
 * ═══ THE HIERARCHY, DELIBERATELY (§25.5) ════════════════════════════════════════════════════
 * «The whole text being the labels is confusing.» It was: a day, a band header, a customer and a
 * release sentence all sat at one step, so nothing on the surface outranked anything. Every line
 * here now answers WHAT AM I · WHOSE AM I · HOW LOUD SHOULD I BE, on four steps and no more — the
 * band's own head went with the band (§67.6), which is one whole step off the surface:
 *
 *   1 · THE DAY        HeadingXSmall 20/700  the ONLY section head on the surface, over a full rule
 *   2 · A NAME         LabelMedium   16/500  whose row this is, at every altitude
 *   3 · A SENTENCE     ParagraphSmall 14/400 what is owed, in words, at full ink
 *   4 · A FACT         ParagraphXSmall 12/400 tertiary — lines, hour, round, aggregates
 *       …and riding the fact line, THE LABEL: LabelXSmall in primary ink on its own quiet ground,
 *       two or three words, the one thing the system has to say about this order (§67.6)
 *
 * with ONE weight that is not a size: LabelSmall 14/500 for the CLASS of a standing row, so «a
 * person is waiting» and «the work is waiting» read as labels rather than as more sentence. And
 * THE FIGURE OUTRANKS THE NAME on every row — Figure `default` (18) against a 16 name — because
 * §4.3 asks for one line of text and a BIG figure. The day's own total is `compact`: a summary may
 * never outshout the rows it sums. Nothing on this surface is uppercase or tracked.
 *
 * ═══ THE CARD STATES (THE-DENSE-BRIEF-DESIGN §1) ════════════════════════════════════════════
 * «At 300 a day roughly 285 rows must be actively silent so the ~15 that carry an open reason are
 * unmissable, and the sorting must be done by STRUCTURE — position, elevation, flatness — with
 * words explaining and colour reserved for the AI's own acts.» That is one law with five parts,
 * and this surface owes every one of them at every altitude:
 *
 *   1 · THREE ALTITUDES, and the row says which it is at. `data-altitude` is what was drawn and
 *       `data-owed` is what `isStanding` answered; the two disagreeing is a defect anything can
 *       see. Nothing floats without an open reason and no open reason lies flat.
 *   2 · ONE STATE WORD, said by `RowWord` on the standing row and the flat row alike — and it is
 *       the LIVE READING out of `sale.ts`: «Out today», «Changed 10:40», «Printed 09:31», «Sent»,
 *       «Complaint». One vocabulary at both altitudes, so a row that rises and one that lies flat
 *       are legibly the same object in two situations rather than two objects.
 *   3 · MARKS THAT CARRY THEIR WORD: ⎙ only where the paper is still the crate's own fact, the
 *       bay's tick only ever EMPTY and only beside the sentence that emptied it, the saffron dot
 *       only on Rocoto's own acts. The record's word stands alone with nothing competing.
 *   4 · SAFFRON IS THE AI's, AND THE ONE ACCENT EDGE IS THE COMPLAINT'S. Nothing on this surface
 *       spends the accent on urgency, warning or progress — urgency is position and a sentence.
 *   5 · ONE VERB WHERE SOMETHING IS OWED, none anywhere else, and each one says `data-verb` so
 *       «zero on a closed row, exactly one on an open one» is a count rather than an opinion.
 *
 * ═══ AN ORDER WEARS THE CUSTOMER'S FACE, NEVER A PRODUCT'S (FEED-IA §51.2, §43) ═════════════
 * «How is it possible that an order has an image of a product?» — the object law catching our own
 * violation. Every row and every card on this surface is a picture of an ORDER, and an order's
 * identity is WHO it is for, the figure, and the state. The painting is the PRODUCT's face: a
 * crate of six lines wearing the biggest one's picture told the reader it was a merluza.
 *
 * So the paintings came off the order objects — the band's cards, the river's rows, the standing
 * rows, and a customer's own history, which draws these same rows. They stay exactly where a
 * product is the subject: the lines inside the document, the catalogue, the suggestions, the
 * product sheet.
 *
 * AND THE SCAN-TEXTURE COMES BACK ON THE CUSTOMER'S SIDE. A column of three hundred names with no
 * face is a wall of text, which is what the pictures were really buying. The identity that belongs
 * here is the CUSTOMER's — Base's own Avatar initials, the very drawing the chat list uses for the
 * same object (§43: one visual identity per object, everywhere it appears) — sized small, so the
 * river reads as people at a glance and the seat costs a row nothing.
 *
 * ═══ THE WIREFRAME LAW (FEED-IA §51.24) ═════════════════════════════════════════════════════
 * «You didn't mentally think about the wireframes and how they map to each other… you have
 * literally ORPHAN SENTENCES that don't need to exist.» So the two cards this file draws are
 * WIREFRAMED above their components — labeled zones, what each zone holds, its type step, its
 * state changes — and the grammar is ONE grammar reused at both altitudes: a face, a name, ONE
 * reason, one facts line, one rail, one verb. Nothing on this surface is a sentence unless it is
 * the customer's own words or the reason a thing is standing.
 *
 * ═══ AIR IS A DELIVERABLE (FEED-IA §33) ════════════════════════════════════════════════════
 * «Think about what people expect in terms of space, breathing space.» So the river is spaced the
 * way a consumer money app is spaced: one gutter for the whole surface (the day's name and three
 * hundred customers' names on one left edge), a full step of air inside every row, a day opening
 * like a section rather than arriving like a list item, and the raised rows given more room than
 * the flat ones — because air is the other half of altitude.
 *
 * ═══ THE DETAIL IS WITHIN (§7.1) ════════════════════════════════════════════════════════════
 * On a desk the panel stands beside the list: the list stays live and scrollable, the selected row
 * is lit, and there is no scrim over anything. On a phone the panel takes the screen. Either way
 * its header carries ‹ 3 of 12 › — the chevrons walk THIS list, so flipping is reading on.
 *
 * WHY THIS SURFACE OWNS THE SELECTION. §7.1 supersedes the shell's open-items strip: the flip is
 * list navigation now and the panel's own «3 of 12» is the affordance, so a strip of accumulated
 * chips would be a second place for the same card. The selection lives here, and the frame is told
 * what it needs through its own public seam, `useWideColumn`.
 */
import * as React from 'react';
import { AttentionLabels } from '../attention-labels';
import { useStyletron } from 'baseui';
import { Avatar } from 'baseui/avatar';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Datepicker, DENSITY } from 'baseui/datepicker';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { StatefulPopover, PLACEMENT, TRIGGER_TYPE } from 'baseui/popover';
import { StatefulMenu } from 'baseui/menu';
import { StatefulTooltip, PLACEMENT as TOOLTIP_PLACEMENT } from 'baseui/tooltip';
import { Figure } from '../figure';
import Name from '../../../scenarios/shell/Name';
import { comercialOf, type Cast, type Customer } from '../../../scenarios/data/cast';
import { useConfig } from '../config';
import { useWorkspaceCapabilities } from '../workspace-capabilities';
import { capabilityAvailable } from '../release-profile';
import { lotsForAllocation, useAllocationBook } from '../lot-allocation-book';
import { useGrants } from '../grants';
import {
  AREA_TITLE_BAR, BOTTOM_NAV_HEIGHT, LIST_FLOOR, Page, SearchSummon, SHEET_SNUG, SHEET_WIDE,
  WIDE_MIN, focusThread, openSearch,
  useRoom,
  usePanes, usePhone, usePhoneFloorHeight, useSearchSeat, useStacked, useWideColumn,
} from '../shell';
import { Mark, SearchSeat, matches, termsOf, wordsOf } from '../search';
/* THE OBJECT DOORS (§43). The scheme is in `anchors.tsx` so no area package imports another one:
   this surface publishes the ORDER's landing and presses the CUSTOMER's and the PRODUCT's. */
import { Door, openCustomer, openOrder, openProduct, useHistoryLayer, useLanding } from '../anchors';
/* §137.2 · the essentials a pointer at rest asks for, on every seat that says a customer's name */
import { CustomerHoverCard } from '../customer-hovercard';
/* §122 — the check's own two authored values edit inside the film, in the `flush` shape that
   occupies the words' line box rather than a control's (§115.3's stage is measured). */
import { LiveValue } from '../live-value';
import type { AreaMeta } from '../shell/area';
import { dayForSector, nowOf, plural, useDay } from '../day';
import { TruckChip } from '../truck-chip';
import { type PaperSubject } from '../print-view';
/* THE ONE PRINT SCREEN (THE-OUTPUTS-SPEC OUT-04). Both of a day's paper seats and the document
   dock's own «look at it» land here, so «Preview» and «Edit» are two doors on one surface. */
import { PrintScreenCard, type PrintScreenRequest } from '../print-screen';
import { ActDot, Glyph, STEP, type GlyphId } from '../glyphs';
import { DeliveryNotePaymentBadge } from '../money-document';
import SaleDetail, {
  AddLine, Aloud, ConfirmGate, ProductFace, askOrAct, familyMarkOf, ridesOf, useChipRegisters,
  /* ── THE REVIEW KEYBOARD'S OTHER HALF (checkpoint §14.2) ──────────────────────────────────
   * The listener lives here, on the river; the acts and the document live in `detail.tsx`. Every
   * one of these is the SAME function the sheet's own control calls, so a key can never do
   * something its control refuses — the rule P already keeps (§58.1). */
  clarifySale, enterDocument, handoffSale, reversible, undoReviewAct, useReviewAct,
  type GateAct, type ReviewAct,
} from '../detail';
import { useCompany } from '../company';
import { useTiers } from '../tiers';
import { SnackbarProvider, useSnackbar, DURATION as SNACK_DURATION, PLACEMENT as SNACK_PLACEMENT } from 'baseui/snackbar';
/* ── THE CHIP ORGAN, IN THE COMPOSER TOO (FEED-IA §62.4) ──────────────────────────────────────
   «ONE shared organ, designed once, reused everywhere.» The composer's first line and the sheet's
   add-a-line are the same instrument, so a person learns the grammar once. */
import ChipEntry, { OfferFavourites } from '../chip-entry';
import type { ChipLine } from '../chip-parse';
/* ── THE GHOST VOCABULARY (FEED-IA §83.1) ─────────────────────────────────────────────────────
   `src/rocoto/ghost` exists for exactly this: Base ships a skeleton that means LOADING and this
   product needs one that means UNDECIDED. Nothing here draws a grey of its own. */
import { GhostBlock } from '../../../rocoto/ghost';
/* WHAT THIS ACCOUNT KEEPS TAKING (§83.2) — the fold lives with every other fold, in `insights`. */
import { frequentOf } from '../insights';
/* ── THE RED-FLAG VOCABULARY (FEED-IA §196.3) ────────────────────────────────────────────────
   «any fucking alert or message for "flagged" orders have to have red identifiers and not dots,
   like red outline on the message etc like come on be top down!!!» The river is the top of that
   «top down»: it is the surface a person reads forty rows of at a glance, so a flagged order wears
   the OUTLINE here, the pills say the words in the same red, and the tally that counts them is
   written in it too. One file decides all three (`red-flag.tsx`); this one only uses them. */
import { flagBox, flagInk, isFlagged, useFlagStanding } from '../red-flag';
import { useDismissals } from '../dismissals';
/* §86.5 — the accounts a person writes in the composer, in the house's own book */
import NewCustomerModal from '../new-customer-modal';
import { productForNode } from '../catalogue';
import { priceOf } from '../../../scenarios/canonical/resolution';
import { EXIT_DELAY_MS, OverlayCard, PLACEMENT as CARD_PLACEMENT, SCRIM } from '../../../rocoto/overlay-card';
import {
  albaranOrder, usePrintSetup, useQueue,
  type PrintSetup,
} from '../print-queue';
import { downloadConfiguredFile, downloadWords, openExportCentre, useTemplates } from '../shell/printing';
import {
  PAPER_KIND_OF, templateSeats, usedTemplate, type Template,
} from '../output-templates';
import { printSourceRun, newPrintAttemptKey } from '../browser-print';
import { packingOutputs, remainingPackingSales, unqueuedPackingSales } from '../packing-output';
import { AlbaranIntakePicker, AlbaranIntakeSourceCard } from '../albaran-intake';
/* CAMPAIGNS, IN THE SALES HEADER (FEED-IA §249, brief B). The act, its dialog and the clock that
   sends a scheduled campaign are all inside this one component, so the river's own file carries
   the seat and nothing else. */
import { CampaignsAct } from '../campaigns-dialog';
import {
  addLine, amendLine, archiveSale, arriveSale, attachLots, buildSales, callOf, chatNotices, dayFromId, dayIdOf,
  dayDraft, dayGiven, daysWithSales, draftsOf, editLine, emptyGroup, feedDayOf, feedDays, figureOf,
  flagsOf, groupByDay, guardsOf, jobOf, nameDraft, newSale, qtyWords, isEscalated, isMessageOnly,
  isStanding, isSticky, nearWordOf,
  exportStance, newPaperOf, proposeLots, railWorld, roundOf, rowStanding, rubricOf,
  shiftDay, sheetSalesOf, todayId, topReason, usualWords, waitWords, withPicks,
  RANK, STALE_WORDS, STATE_TEXT,
  type ChatNotice, type DayGroup, type ExceptionReason, type FlagKind, type Job, type RowStanding,
  type Rubric, type RubricClass, type Sale,
} from '../sale';

export const meta: AreaMeta = {
  id: 'sales',
  title: 'Sales',
  /* NO LEAD. THE-CONTENT-CANON §9's item 14 asked for a shorter one; the sweep then found that
     `AreaMeta.lead` renders on no surface at all, so the honest fix is the slot rather than the
     prose — «the fix is structural (kill the slot), never just shorter prose in the same slot»
     (canon §4). The field itself goes with its last usage, in the shell's own package. */
  owner: 'V2-SALES',
  /* MASTER-DETAIL (§38): the river and the document, two full-height panes. Declared, so the
     frame is in this posture on the first paint after a move rather than one frame later. */
  panes: true,
};

/* ── THE SHEET PANE'S WIDTH (FEED-IA §38, widened by §66.4) ───────────────────────────────────
 * «You can DEFO have a little bit more space for the albarán column so the details aren't so
 * cramped.» So the sheet takes 720 — what an albarán's own anatomy needs: the customer's name
 * beside its map square, a line's fields on ONE row before any of them wrap, and the dock's acts
 * without the row breaking.
 *
 * AND IT STEPS BACK ON A NARROW DESK, because the width has to come from somewhere and at 1280 it
 * came out of the REVIEW CARDS: «Hotel Re…» over «The pic…» — the band's own cards clipped to
 * eight characters, which is §51.1's «a card must read» failing on the very cards the surface
 * exists for. Two widths, both fixed (a document's measure is a property of the document, §38),
 * and the wide one applies where there is room for both panes to keep their own anatomy.
 */
/* ⚠ THE TWO MEASURES ARE THE LADDER'S NOW (E199). `shell/viewport.ts` declares them, because
   E199's priced-document floor is built on `SHEET_SNUG` and a measure two files each state is a
   measure two files can drift on. The reasoning above is unchanged and still lives here. */
/** the desk where 720 still leaves the river a card it can read. IT IS THE CONTINUUM'S OWN TOP
 *  RUNG (FEED-IA §103): `WIDE_MIN` in `shell/viewport.ts` is this number, and the ladder is stated
 *  in one file so «desk» and «compressed desk» mean the same width everywhere. */
const ROOMY = WIDE_MIN;

/* ⚠ IT IS THE ROOM, NOT THE WINDOW (FEED-IA §196.2 · E193.16). The agent column is a reserved
 * grid track now, so a 1920px window with it standing has 1288px of room — and a document that
 * took its WIDE measure off the window there would be taking the difference out of the river
 * beside it, which is the exact failure §66.4 fixed in the other direction. `useRoom()` is the
 * width minus whatever the frame has docked; with nothing docked it is the window, so this reads
 * exactly as it always did. */
function useSheetPane(): number {
  return useRoom() >= ROOMY ? SHEET_WIDE : SHEET_SNUG;
}

/* ── AND THE RIVER PANE HAS A WIDTH BELOW WHICH ITS HEADER RUNS OUT OF ROW (C30) ──────────────
 * The header pins one line and never wraps it (§51.4), and every control on that line is a fixed
 * width. MEASURED on the served bundle, the full form asks 501px: the scope door at 171, the date
 * field at 146, the search seat at 36, the New albarán at 112, four gaps and the river's own
 * gutter. Below that the row used to take the difference out of the one thing §51.4 pins — at 1280
 * «Whose accounts» rendered 22px wide and a person glyph was the whole of the scope.
 *
 * SO THE ROW HAS A SNUG FORM, AND THE HOUSING IS THE ROOM RATHER THAN THE DEVICE. Three controls
 * change and none of them loses a fact: the New albarán becomes its «+» (its own phone form), the
 * date field takes the narrow width (its own phone form), and the resting scope door drops the
 * person glyph that was repeating its label. 501 → 327, against 336 of usable row at 1280.
 *
 * ⚠ THE RIVER'S WIDTH IS NOT MONOTONIC IN THE VIEWPORT'S, and the number below is chosen knowing
 * it. Measured: 268 at a 1180 viewport · 368 at 1280 · 454 at 1366 · **448 at 1440** · 508 at 1500
 * · 608 at 1600 — the river gets NARROWER from 1366 to 1440 because `ROOMY` widens the sheet to
 * 720 there. A breakpoint set at the width where the river first passes 501 would therefore hand
 * the full form to a 1439 desk and the snug one to a 1440, which is §77.2's «nothing random» in
 * reverse. 1520 is above both steps, so the form changes once, in one direction.
 */
const RIVER_TIGHT = 1520;

/* ⚠ AND SO IS THIS ONE (§196.2 · E193.16). C30's whole finding is that the header's full form
 * needs 501px of row: read off the WINDOW, a 1728px desk with the agent open would hand the full
 * form to a 392px river — «Whose accounts» at 22 pixels, C30's own photograph, back again. The
 * room is what the row actually has. */
function useTightRiver(): boolean {
  return useRoom() < RIVER_TIGHT;
}

/** How long a row stays lit after the band has walked the reader to it. Long enough to find with
 *  the eye, short enough that it is gone before it becomes a second selection. */
const LANDED_MS = 1400;

/* ── THE TRAVEL: WHY A THRESHOLD AND NOT A MODE (FEED-IA §111.1) ──────────────────────────────
 * «Things would by default be resolved… it shouldn't give the impression they'd confirm every
 * single thing — that's like five percent. I envision them scrolling a lot — scrolling with MOTION
 * BLUR — and landing on something like a ROULETTE or SLOTS interface: it lands on the item that
 * needs checking, boom, they do it. They'd be erratically pressing the down button.»
 *
 * ONE KEY, TWO GESTURES, AND THE HAND DECIDES WHICH. A single press is a STEP: the next row, no
 * scroll, the same walk ← → already make. Presses arriving faster than a person could have READ
 * the row they landed on are not walking — they are a hand saying «not this, not this, not this»,
 * and the honest answer is to take them where they were going. So the river TRAVELS: it smears,
 * it decelerates, and it settles on the next document that stopped.
 *
 * THE THRESHOLD IS THREE PRESSES INSIDE 320ms OF EACH OTHER, and both halves are argued:
 *   · THREE, because TWO fires on an ordinary double-step — somebody nudging past one row they
 *     have already dealt with — and a gesture that fires on an accident is a surface moving under
 *     a hand.
 *   · 320ms, because that is under the time it takes to read a row. §32.A budgets three to five
 *     seconds for JUDGING a document; RECOGNISING one at flip speed is a fraction of that, and a
 *     press landing before recognition finishes was never about the row it landed on.
 * The run resets the moment a press arrives outside the window, so a steady walk never
 * accumulates into a journey.
 */
const TRAVEL_PRESSES = 3;
const TRAVEL_WINDOW_MS = 320;

/** HOW LONG THE SMEAR HOLDS. It is the smooth scroll's own length, near enough: the river is still
 *  moving under the eye for about this long, and a blur that lifts before the motion stops reads as
 *  a glitch rather than as speed. The lift itself is `timing400` on `easeOutCurve` — the
 *  deceleration IS the settle. */
const TRAVEL_MS = 360;

/** HOW FAR THE RIVER SMEARS. Three pixels is legible-as-motion and illegible-as-text, which is the
 *  whole of what a motion blur is for; more reads as a fault in the screen. */
const TRAVEL_BLUR = 3;

/** WHOEVER ASKED FOR LESS MOTION GETS NONE OF IT. §111.1 licenses the smear and the morph; it does
 *  not exempt them from the app's own motion doctrine, and this is the doctrine's first clause. It
 *  is read LIVE, because the setting can move while the app is open. */
function useStillness(): boolean {
  const [still, setStill] = React.useState(
    () => typeof window !== 'undefined'
      && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  );
  React.useEffect(() => {
    const q = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!q) return;
    const read = () => setStill(q.matches);
    q.addEventListener('change', read);
    return () => q.removeEventListener('change', read);
  }, []);
  return still;
}

/** The frame's own sticky day bar, which every scroll on this surface has to clear. */
const BAR = 'scale1600';

type Th = ReturnType<typeof useStyletron>[1];

/* ── WHAT THE FRAME KEEPS PINNED ABOVE THIS SURFACE (FEED-IA §35.2) ───────────────────────────
 * The day bar, and under it the area's own name. Everything this file sticks parks below BOTH of
 * them, so the one thing on the surface that follows a reader down six hundred rows never ends up
 * behind the one line that says where they are. Stated as a pair of helpers rather than as a number
 * typed four times, because the four sites — the header block, the band, the day a jump lands on and
 * the walk's own scroll — are exactly the four that have to agree. */

/** the top a sticky thing on this surface takes, in CSS, plus whatever it is parking under */
const chromeTop = (theme: Th, extra = 0): string =>
  `calc(${theme.sizing[BAR]} + ${AREA_TITLE_BAR + extra}px)`;

/** the same height in pixels, for the scroll arithmetic */
const chromePx = (theme: Th): number =>
  (Number.parseInt(theme.sizing[BAR], 10) || 64) + AREA_TITLE_BAR;

/** WHERE A STICKY THING PARKS, ONCE THE DESK IS PANES (FEED-IA §38). Inside the list pane the
 *  chrome is already above the scrollport, so the top is zero and anything a surface is parking
 *  under is the only offset left. On the phone the page itself is still the scrollport, so the
 *  frame's own bar has to be cleared exactly as before. */
function useStickyTop(theme: Th, extra = 0): string {
  const phone = usePhone();
  return phone ? chromeTop(theme, extra) : `${extra}px`;
}

/* ── THE RIVER'S ONE GUTTER (FEED-IA §33 — the air pass) ──────────────────────────────────────
 * «Think about what people expect in terms of space, breathing space.» A surface reads as calm when
 * everything on it stands on ONE left edge, and it reads as assembled when four things stand on
 * four edges a few pixels apart. So the day's name, three hundred customers' names, the scope line
 * and the standing rows all take this one value, and the only way for them to disagree is for
 * somebody to write a number instead of using it.
 *
 * IT IS 16 AND NOT 12 because 12 is the smallest gutter that works and the bar here is the calm of
 * the best consumer money apps, which is the largest that still reads as one column. */
const GUTTER = 'scale600';

/** THE ROW'S OWN BREATH. A full step above and below the tile, so 288 rows read as a river rather
 *  than as a spreadsheet — it costs about half a row of a screen and buys the whole surface. */
const ROW_AIR = 'scale500';

/** A DAY OPENS LIKE A SECTION. The air above the day's name is what makes the rule under it read
 *  as the start of something rather than as another line in a list. */
const DAY_AIR = 'scale1000';
/** WHAT A PHONE SPENDS ON THE SAME OPENING (FEED-IA §200.5). 16px: the step the whole surface
 *  groups by, and the smallest one that still parts a day from the day above it. */
const PHONE_DAY_AIR = 'scale600';

/** THE LAYER EVERY MENU AND EVERY PIECE OF CHROME ON THIS SURFACE OPENS AT. Base mounts its layers
 *  at the end of the body with no z-index of their own, so they need a step that clears the one
 *  sticky thing left on the river — the header block (§51.4). The band that used to sit at 4 is
 *  gone (§67.6); the step stays where it is, because every menu on the surface is measured against
 *  it and a number that moves for no reason is a number somebody has to re-check. */
const OVER_THE_CHROME_LAYER = 12;

/* ── AND THE STICKY CHROME ITSELF SITS UNDER THE MODALS (§54.1, in reverse) ───────────────────
 * «There are some labels that appear behind the actual thing» was a LAYER opening under a surface;
 * this is the same defect walking the other way. The header block sticks on a phone, and it was
 * pinned at the MENU's step (12) — above `OverlayCard`'s 8 — so the river's own chrome painted
 * over the top ~56px of every modal on a 390px screen. A probe at a modal title's second line
 * came back holding `scope-line`: the words were drawn, and the thing they belonged to was drawn
 * on top of them.
 *
 * THE CORRECT ORDER IS chrome < modal < menu, and the fix is taken on the chrome because
 * `OverlayCard` is a package this surface only consumes. 4 is the step the band used to hold —
 * above the river, under everything a person opens on purpose.
 */
const STICKY_CHROME_LAYER = 4;

/* ── AND A TOOLTIP IS A LAYER TOO (FEED-IA §54.1) ─────────────────────────────────────────────
 * «There are some labels that appear behind the actual thing.» Every MENU on this surface already
 * carried the step above; every TOOLTIP carried none — so a hover label opened at the end of the
 * body with z-index auto and painted UNDER the band (4), under the header block (12) and under the
 * sheet's own dock (2). The label was drawn, and the thing it labelled was drawn on top of it.
 * One override, spelled once, on every hover label this surface raises.
 */
const OVER_THE_CHROME = { Body: { style: { zIndex: OVER_THE_CHROME_LAYER } } } as const;

/** SOMETHING IS ON TOP AND THE KEYS BELONG TO IT (§32.A). Every layer this app puts over the work
 *  — Base's popovers and menus, the lot proposal and the customer's record on `OverlayCard`, the
 *  chats widget. A tooltip is deliberately absent: it appears under a pointer that is only
 *  hovering, and a hover may not take a person's keyboard away. */
const OVERLAY =
  '[data-baseweb="popover"],[data-baseweb="modal"],[data-baseweb="overlay-card"],[data-testid="chats-overlay"]';

/** BaseUI keeps a closed popover mounted for its exit animation. A DOM-presence check therefore
 * treated the invisible composer shelf as a modal forever, which gave the review keyboard away
 * after Escape. Keys yield only to a layer that is actually painted and can receive a press. */
function overlayOwnsKeys(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>(OVERLAY)).some((overlay) => {
    const style = window.getComputedStyle(overlay);
    const rect = overlay.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.pointerEvents !== 'none'
      && rect.width > 0
      && rect.height > 0;
  });
}

/** A VALUE ON A LINE IS OPEN (§31.3). `detail.tsx` stamps it on the line and on the value, and the
 *  resting document says `no` — so one selector answers «is anybody mid-edit» for the whole panel. */
const EDITOR = '[data-editing]:not([data-editing="no"])';

/* ── THE RIVER'S ONE PUBLIC DOOR (FEED-IA §25.2) ──────────────────────────────────────────────
 * «Tapping the sticky thing TAPS THE THING IN THE FEED» — it selects the sale, walks the river to
 * its row, lights it, and opens the same document. The band has always done that from inside this
 * file; an embed in a conversation wants the identical act from outside it, because a card in the
 * chat and a card on the band are two doors onto ONE row and a door that only opened the document
 * would leave the reader wondering where in the day the thing lives.
 *
 * IT IS A REGISTRATION, NOT A GLOBAL. The surface publishes its own walk while it is standing and
 * takes it back when it unmounts, so a call that lands with Sales off screen does nothing at all
 * rather than reaching into a component that is not there. Nothing else in this file uses it: the
 * band calls the handler directly, because the band IS this surface.
 *
 * ═══ AND IT IS ONE OF THREE NOW (FEED-IA §43) ═══════════════════════════════════════════════
 * The order was the first object to publish a walk; the customer and the product have one each in
 * `anchors.tsx`, under one scheme, so «every appearance of an object is a door» is a mechanism
 * rather than a habit. `landOn` stays as this file's own word for it — embeds and the customers'
 * book already speak it — and it is now a thin call onto that one registry rather than a second.
 */

/** Walk the river to a sale and open it, exactly as pressing its band card does (§25.2). A no-op
 *  while the Sales surface is not mounted. */
export function landOn(id: string): void {
  openOrder(id);
}

/* ── THE THREE ALTITUDES, SAID OUT LOUD (DENSE-BRIEF-DESIGN §1) ───────────────────────────────
 * «A stranger can sort the feed into needs-me-now / needs-me-today / record from STRUCTURE alone —
 * top band vs raised-in-day vs flat — before reading a single label.» Three altitudes and no
 * fourth, and the surface states which one every row is at, so the criterion «the number of raised
 * elements equals the number of sales isStanding() returns, exactly» is a thing a screenshot can
 * be checked against rather than a thing a reader has to believe.
 *
 * Two attributes carry it, and they are deliberately two: `data-altitude` is what the surface DREW
 * (band · standing · flat) and `data-owed` is what `isStanding` ANSWERED for that same sale. A row
 * that stands with no open reason, or an open reason lying flat, is the two disagreeing — which is
 * a mismatch anything looking at the DOM can catch, on any screen, at any scale. Altitude answers
 * «do I owe anything»; the words answer «what».
 */

/* ── THE FACE OF AN ORDER IS THE CUSTOMER (FEED-IA §51.2, §43) ────────────────────────────────
 * «How is it possible that an order has an image of a product?» It is not, any more. This seat used
 * to hold `ProductFace` resolved off the crate's biggest line — a picture of one merluza standing
 * for a six-line albarán, which is the product's identity worn by the order.
 *
 * WHAT STANDS HERE INSTEAD IS THE SAME DRAWING THE CONVERSATION LIST USES for the same object:
 * Base's own Avatar with no source, which paints the customer's initials on `backgroundInversePrimary`
 * — ink out of the theme, so `?theme=proof` moves it and identity owns no colour of its own. One
 * object, one visual identity, on a band card, on a river row, on a chat row, everywhere (§43).
 *
 * IT IS DECORATIVE, and deliberately so: the name is right beside it in words, and a face that made
 * a screen reader say «Can Solé» twice per row would be three hundred repetitions of the same word.
 *
 * THE SEAT DOES NOT GROW. The text column is taller than the face at every altitude, so the face's
 * size costs a row nothing at all — which is why it may be small enough to read as texture rather
 * than as three hundred badges wanting attention.
 *
 * THE RECORD STEPS BACK, IN THE FACE AS IN THE INK. A closed row's initials fade with its word and
 * its name, so a day's record reads as texture and the open work keeps the contrast.
 */
const FACE: Record<'row' | 'card', number> = { row: 28, card: 32 };

function CustomerFace({ of, size, muted = false }: { of: { name: string }; size: number; muted?: boolean }) {
  const [, theme] = useStyletron();
  return (
    <span
      aria-hidden="true"
      data-object-face="customer"
      style={{ display: 'inline-flex', flex: '0 0 auto', opacity: muted ? 0.55 : 1 }}
    >
      <Avatar
        name={of.name}
        size={`${size}px`}
        overrides={{
          /* THE INITIALS TAKE THE SEAT'S OWN STEP. Base's default is `font300`, which is the body's
             size — in a 28px circle that is a letter pressed against the edge. */
          Initials: { style: { ...theme.typography.LabelXSmall, letterSpacing: 0 } },
        }}
      />
    </span>
  );
}

/* ── WHOSE ROW IT IS, AND WHY IT SURVIVED THE WORD (FEED-IA §35.1) ────────────────────────────
 * «Matches highlight, misses vanish.» The vanishing is the filter; this is the other half — the
 * letters a person typed, standing out of the name they typed them for, so a thinned river reads
 * as an ANSWER rather than as a river that got shorter for reasons of its own.
 *
 * IT ONLY MARKS UNDER A SEARCH. With no word on, the name is the name — drawn by `Name`, which
 * carries C-9's own hairline under anything the founder has not christened yet — and the search
 * never takes that away for the rows it did not match on.
 *
 * ═══ AND IT IS THE CUSTOMER'S OWN DOOR (FEED-IA §43) ════════════════════════════════════════
 * «A customer's name — on a band card, a row, a whisper, a chat header, a product's buyer list —
 * opens the customer. No dead names.» Every row on this surface is a picture of an ORDER, and the
 * customer's name is the CUSTOMER appearing inside it. So the row opens the order and the name
 * opens the customer, on all three altitudes, drawn by the app's one `Door` — which is what makes
 * «one visual identity per object» a mechanism instead of a resolution.
 */
/* ── AND RESTING ON IT SHOWS THE ESSENTIALS (FEED-IA §137.2) ──────────────────────────────────
 * «There should be a hover version that has essentials, and then if they click on go to profile it
 * goes there.» The name keeps every job it had — it is still the app's one `Door`, it still marks
 * what a search matched, it still opens the customer on a press. The card is what a POINTER AT
 * REST adds on the desk, and on glass the component hands the name straight back (§137.2). */
/** The order card is one destination. Customer navigation belongs inside its sheet. */
const CustomerName = ({ sale, terms }: { sale: Sale; terms?: string[] }) => (
  <span data-testid={`customer-label-${sale.id}`}>
    {terms?.length ? <Mark text={sale.customer.name} terms={terms} /> : sale.customer.name}
  </span>
);

/* ── AND WHY THE ROW SURVIVED A WORD ITS NAME DOES NOT ANSWER (FEED-IA §35.1) ─────────────────
 * A river filtered on «merluza» is three hundred and seventy-seven rows of customers' names with
 * nothing on any of them saying merluza — the reader is left to take the software's word for it,
 * which is exactly the decoding the design forbids. The goods are on the LINES, so the row says
 * which line answered: one noun, at the facts' own step, with the letters marked.
 *
 * IT ONLY SPEAKS FOR THE WORDS THE NAME DID NOT. Search «toni» and the name carries its own marks
 * and this says nothing; search «merluza» and it names the line; search «merluza toni» and it names
 * the line for the half of the query the name could not answer. And with no search on it costs
 * nothing at all — the first line of the function is the whole of its price on a resting river.
 */
const matchedProductOf = (sale: Sale, terms?: string[]): string | null => {
  if (!terms || terms.length === 0) return null;
  const unanswered = terms.filter((t) => !matches([t], wordsOf([sale.customer.name])));
  if (unanswered.length === 0) return null;
  const line = sale.lines.find((l) => unanswered.some((t) => matches([t], wordsOf([l.product.name]))));
  return line ? line.product.name : null;
};

/* IT TAKES THE LINE COUNT'S OWN BOX RATHER THAN A BOX OF ITS OWN. At 390px the facts line already
 * holds all it can — «3 lines · 09:25 · 4 Nord» — and a fourth token turned both of the first two
 * into «P… 3 …», which is two facts destroyed to add one. So under a search the row swaps the
 * WEAKEST fact for the strongest: the count of lines steps aside for the line that answered. The
 * hour, the round and the figure never move, and the row keeps its exact width. */
const Answered = ({ name, terms }: { name: string; terms: string[] }) => (
  <span data-matched-product={name}>
    <Mark text={name} terms={terms} />
  </span>
);

/* ── THE WORD UNDER THE FIGURE IS THE STATE (DENSE-BRIEF-DESIGN §1) ───────────────────────────
 * «RowStanding.word is the single state carrier — Open · Open · out today · Sent · Printed 09:31 ·
 * Complaint. The eight statechart states never render as a ladder of glyphs.» So ONE component
 * says it, and all three altitudes call it: the card on the band and the row in its day are one
 * entity seen twice (§25.2), and two spellings of its own state would be the fastest way to make
 * a reader believe they are two things.
 *
 * THE ⎙ RIDES THE WORD ONLY WHILE THE PAPER IS THE ROW'S OWN FACT — that is, while the crate is
 * still in the house. Once a sale has gone out, «Sent», «Delivered» and «Settled» are the record
 * and the criterion is explicit: «each says its record word and NOTHING ELSE competes on the row —
 * no facet marks, no verbs, no elevation». A printer mark beside «Delivered» is exactly the second
 * thing competing. And a REOPENED row (paper that no longer describes the crate, §29.2) says
 * «Open» with no mark at all, because the paper in the tray is not a fact about this crate any
 * more — it is the reason the row came back.
 */
/* ── THE RUBRIC CHIP — THE STOP SIGNAL AT FLIP SPEED (FEED-IA §67.6, §72; canon §17.2, §17.3) ──
 * «And that would show a little nice chip so they can scroll through hundreds of these and know
 * what to stop on, as they press the left and right arrows.»
 *
 * ═══ IT IS BUILT FOR THE ARROWS, WHICH DECIDES EVERY DIMENSION OF IT (§72.2) ═════════════════
 * The context is the ← → sweep (§32.A's keyboard loop, §51.25's flip), and at that speed nothing
 * is READ — it is recognised. Four constants, and between them the chip cannot jiggle:
 *   1 · ONE POSITION, on every card, at every altitude: the head of the fact line. The eye returns
 *       to a PLACE, so the place may never depend on what the chip says.
 *   2 · ONE GEOMETRY BETWEEN CLASSES. Fixed height, fixed mark size, fixed padding, one type step —
 *       so flipping from «Over your ceiling» to «Pick changed» moves nothing at all (§37.3, §59.1).
 *       The WORD's width varies because words do; nothing else about the chip does, and the word
 *       is last so what varies is only where the chip ENDS.
 *   3 · ONE GLYPH REGISTER. Every mark comes out of `glyphs.tsx`, one per class, and each one
 *       stands beside its own word — which is the second half of the first-reader bar: a mark
 *       answers correctly without a legend, or it has its word beside it. All of these do.
 *   4 · TWO WORDS. Base's tag grammar (§17.3 rule 2): a noun or an adjective, one line, never a
 *       verb, never wrapped. It read «three at the outside» here and three of the eight took the
 *       licence — «Bigger than usual», «Over your ceiling», «Off the catalogue» — which is the
 *       footprint changing with the class it names, on the one control built to be recognised
 *       rather than read (§72.2, C28). The vocabulary is in `sale.ts`'s `RUBRIC_WORD`, and the
 *       ceiling is the ceiling.
 *
 * ═══ COLOUR IS NOT THE CARRIER (§72.3, §51) ════════════════════════════════════════════════
 * The class speaks through MARK + WORD + WEIGHT. There is no rainbow: a red chip would claim an
 * emergency the trade does not have, the accent is spent on Rocoto's own acts alone, and flags are
 * readings rather than a status system. The skin is a small hairlined tile of the ground its host
 * is NOT on — the paper on a stopped row, the tint on the quick check's paper card — which is the
 * chip organ's own grammar (§62) held to the thing that actually matters at flip speed: the stop
 * signal may never match what it is standing on (§111.1's own consequence; see `RowLabel`).
 *
 * ═══ IT COMPRESSES THE REASON, IT NEVER REPLACES IT (§72.3) ════════════════════════════════
 * The full prediction-and-its-ground label (canon §17.3) stays on the card's own reason line, at
 * full ink, where the SOBER register reads it (§61.3). The chip is that same fact at flip speed.
 * One fact, two compressions, and the drunk pass never has to read the sentence.
 *
 * ═══ AND A SURE ROW WEARS NOTHING (§72.3, §61.2) ═══════════════════════════════════════════
 * «The absence is the calm.» 285 of 300 rows carry no chip at all, so the seat is NOT reserved —
 * a reserved empty seat on 285 rows is a column of nothing to scan past, and the few that speak
 * are found by ink appearing rather than by a slot filling.
 */

/** ONE MARK PER CLASS, out of the app's own register (§30's determination: a mark a person learns
 *  once is recognised everywhere). Each stands beside its own word, always.
 *
 *  AND NONE OF THEM IS THE REASON LINE'S (§51.19 «one meaning each», C39). The card draws two marks
 *  one line apart — the reason's own bullet and this — and on a pick that changed both were the
 *  bay's empty circle: one glyph doing two jobs on one row, which is the ambiguity §51.19 forbids
 *  rather than the economy §30 asks for. The two jobs are now two marks: `pick` stays the TICK,
 *  which is a fact about the crate and belongs to the sentence that says it emptied, and `reset` is
 *  the CLASS — the step that went backwards. */
const RUBRIC_MARK: Record<RubricClass, GlyphId> = {
  complaint: 'flag',      /* somebody has already been let down — the loudest thing on the surface */
  unreadable: 'weigh',    /* the amount is what did not read, and the scale is the amount's own mark */
  newword: 'catalogue',   /* the list has no row for the word */
  ceiling: 'ceiling',     /* the house's own limit */
  quantity: 'crate',      /* what is in the crate, against what usually is */
  question: 'ask',        /* a person is on the other end */
  yes: 'confirm',         /* the house kept the confirmation and this one is waiting on it */
  pick: 'reset',          /* the walk, undone — never the circle the reason line's bullet draws */
  /* THE FIVE THE CHECKPOINT'S §9.16 ADDED, each taking the mark its own subject already wears —
     the ACCOUNT, the RECORD, the goods that came in, the money, and the calendar. */
  newAccount: 'who',      /* the account itself is the fact: nobody has ever ordered here before */
  firstTime: 'archive',   /* the record, and this product is not in this account's part of it */
  stock: 'log',           /* what came in decided the line — the goods-in log's own subject */
  price: 'price',         /* money between the house and its customers, which is what is unsettled */
  season: 'clock',        /* the calendar moved what «the usual» means */
};

/* ── AND THE CHIP IS THE VISIBLE CONFIDENCE (FEED-IA §111.1, resolved against §9's ban) ───────
 * «The items that need review would show a list, INCLUDING CONFIDENCE LEVELS, right?»
 *
 * IT ALREADY IS ONE, AND THAT IS THE ANSWER RATHER THAN A DODGE. §69 made confidence a RUBRIC OF
 * FAILURE CLASSES ordered by how badly the order was understood, §71 made the order brain grade it,
 * and §72 gave the grade this chip. So the confidence a person reads is the CLASS — «Above usual»,
 * «Over ceiling», «Amount unreadable» — and no percentage is minted anywhere, which is §9's ban
 * kept whole: «a bare percent is the thing this product replaces» (`net.ts`'s own law).
 *
 * WHAT WAS MISSING WAS THE ORDER, STATED. §69's four families ARE the scale — the words, the match,
 * the pattern, and a person owed words — so the chip carries which family it is on, as an
 * ATTRIBUTE. Nothing new is said on the screen: the vocabulary a person reads stays `RUBRIC_WORD`'s
 * and no second register is invented (§72.2's two-word ceiling, §72.3's «colour is not the
 * carrier»). What the attribute buys is a machine-checkable «is the list ordered by confidence».
 */
const RUBRIC_FAMILY: Record<RubricClass, 'words' | 'match' | 'pattern' | 'owed'> = {
  /* §69.D — outside the scale on purpose: a person is owed words, which is urgency, not doubt */
  complaint: 'owed',
  question: 'owed',
  yes: 'owed',
  /* §69.A — did we even read it? The floor of the rubric. */
  unreadable: 'words',
  newword: 'words',
  /* §69.B — did we pick the right thing? */
  pick: 'match',
  firstTime: 'match',
  stock: 'match',
  /* §69.C — is this normal for THEM? */
  ceiling: 'pattern',
  quantity: 'pattern',
  newAccount: 'pattern',
  price: 'pattern',
  season: 'pattern',
};

/** THE CHIP'S OWN HEIGHT. Stated rather than inherited, because a chip whose height came from its
 *  line-height would be one pixel different per glyph and the row would breathe as it flipped. */
const CHIP_H = 18;
const CHIP_MARK = 12;

/** THE CHIP IS DRAWN IN TWO PLACES NOW — the row, and the quick check that morphs out of it — so
 *  the handle is the caller's. One drawing, one vocabulary, two seats (§25.2's own logic).
 *
 *  AND ITS SKIN IS THE GROUND IT IS NOT STANDING ON. The chip is THE STOP SIGNAL at flip speed
 *  (§72.1), so the one thing it may never do is match the row under it — and a stopped row now
 *  rests on `backgroundSecondary`, which is the skin the chip used to take. The rule that survives
 *  is the one that mattered: the chip is a small, quiet, hairlined tile of a DIFFERENT ground from
 *  its host, which on a stopped row is the paper and on the quick check's paper card is the tint.
 *  Colour is still not the carrier (§72.3) — both are the theme's own neutrals, and the class
 *  speaks through the mark and the word exactly as before. */
function RowLabel({
  sale,
  owed,
  testid,
  ground,
  held,
}: {
  sale: Sale;
  owed: boolean;
  testid?: string;
  /** the tile's own ground, defaulting to the paper — which is what reads on a stopped row */
  ground?: string;
  /** ── A GRADE THE CARD IS HOLDING (FEED-IA §115.3's third beat) ──────────────────────────
   *  The quick check's film SHOWS the mark coming off the document, and a chip that read the
   *  live document would simply stop existing the instant the act landed — a disappearance
   *  where the beat is a lift. So the film hands the grade it opened on, and the chip draws
   *  that. It is the SAME grade `rubricOf` gave, snapshotted a second earlier; nothing here
   *  invents one. */
  held?: Rubric | null;
}) {
  const [, theme] = useStyletron();
  /* ── A ROW THAT OWES NOTHING HAS NO REASON, BY CONSTRUCTION (and it costs nothing to say so) ──
   * Every clause of `rubricOf` — a complaint, an unreadable amount, a word off the catalogue, the
   * ceiling, the customer's own usual, an owed answer, a reset pick — is also a clause that makes
   * `isStanding` true. So a FLAT row can never carry a chip, and asking is not merely useless:
   * `rubricOf` folds `flagsOf` and `openNonSku`, which walk every line of the sale. A drive caught
   * what that costs at real scale — 610 flat rows paying for an answer that is always null, on
   * every render (§31.1: the surface holds three hundred orders and stays quick).
   *
   * THE GUARD IS THE MODEL'S OWN SENTENCE, not a cache: what owes nothing has nothing to say. */
  const rubric = held ?? (owed ? rubricOf(sale) : null);
  if (!rubric) return null;
  return (
    <span
      data-label={rubric.word}
      data-rubric={rubric.klass}
      /* THE FAMILY IS THE CONFIDENCE, AND IT IS AN ATTRIBUTE RATHER THAN A WORD (§111.1, §69) */
      data-rubric-family={RUBRIC_FAMILY[rubric.klass]}
      data-testid={testid ?? `label-${sale.id}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale100,
        /* THE GEOMETRY IS THE CLASS-INDEPENDENT PART (§72.2, constant 2) */
        height: CHIP_H,
        boxSizing: 'border-box',
        ...theme.typography.LabelXSmall,
        lineHeight: `${CHIP_H}px`,
        color: theme.colors.contentPrimary,
        background: ground ?? theme.colors.backgroundPrimary,
        boxShadow: `inset 0 0 0 1px ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius200,
        padding: `0 ${theme.sizing.scale200}`,
        flex: '0 0 auto',
        whiteSpace: 'nowrap',
      }}
    >
      {/* THE MARK, AT A FIXED SIZE — a glyph that sized itself to its word would be the jiggle. */}
      <span aria-hidden="true" style={{ display: 'inline-flex', flex: '0 0 auto' }}>
        <Glyph id={RUBRIC_MARK[rubric.klass]} size={CHIP_MARK} />
      </span>
      {rubric.word}
    </span>
  );
}

function RowWord({ sale, standing }: { sale: Sale; standing: RowStanding }) {
  const [, theme] = useStyletron();
  const inHouse = RANK[sale.state] < RANK.sent;
  const paper = standing.closed && standing.printed && inHouse;
  return (
    <span
      data-row-word={standing.word}
      style={{
        ...(standing.presses ? theme.typography.LabelSmall : theme.typography.LabelXSmall),
        color: standing.presses ? theme.colors.contentPrimary : theme.colors.contentTertiary,
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale100,
        whiteSpace: 'nowrap',
      }}
    >
      {paper && <Glyph id="print" size={STEP.small} />}
      {standing.word}
    </span>
  );
}

/** §138.8 — these facts name the person recorded on the document. */
function RowHistory({ sale }: { sale: Sale }) {
  const [, theme] = useStyletron();
  const fact = sale.archived ?? sale.read;
  if (!fact) return null;
  return <span data-testid={`${sale.archived ? 'archived' : 'viewed'}-${sale.id}`} data-actor={fact.by}
    title={`${sale.archived ? 'Archived' : 'Viewed'}${fact.by ? ` by ${fact.by}` : ''} · ${fact.at}`}
    style={{ ...theme.typography.LabelXSmall, display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
      gap: theme.sizing.scale100, padding: `0 ${theme.sizing.scale200}`, borderRadius: theme.borders.radius200,
      background: theme.colors.backgroundSecondary, color: theme.colors.contentSecondary, maxWidth: '100%', minWidth: 0 }}>
    <Glyph id={sale.archived ? 'archive' : 'eye'} size={STEP.small} />
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {sale.archived ? 'Archived' : 'Viewed'}{fact.by ? ` · ${fact.by}` : ''}
    </span>
  </span>;
}

/** Hover, keyboard focus and touch expose the same archive action. */
function ArchiveRow({ sale, onArchive, active, children }: { sale: Sale; onArchive?: () => void; active: boolean; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const [near, setNear] = React.useState(false);
  return <div data-archive-row={sale.id} onMouseEnter={() => setNear(true)} onMouseLeave={() => setNear(false)}
    onFocus={() => setNear(true)} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setNear(false);
    }} style={{ display: 'flex', alignItems: 'stretch', minWidth: 0,
      contentVisibility: active ? 'visible' : 'auto', containIntrinsicSize: `auto ${phone ? 112 : 96}px`,
      background: near ? theme.colors.backgroundSecondary : undefined }}>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    {onArchive && <span style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto',
      paddingRight: theme.sizing.scale200, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
      <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.circle} data-testid={`archive-${sale.id}`}
        aria-label={`Archive ${sale.customer.name}`} title="Archive delivery note" onClick={onArchive}
        overrides={{ BaseButton: { style: { opacity: near || phone ? 1 : 0, ':focus-visible': { opacity: 1 } } } }}>
        <Glyph id="archive" size={STEP.small} />
      </Button>
    </span>}
  </div>;
}

/* ── ONE ROW OF THE RIVER ─────────────────────────────────────────────────────────────────────
 * Flat on the paper, because the record lies flat (§5.1, §21). One line of text, a big figure, and
 * everything else a smaller, quieter step — the standing is a word rather than a colour.
 */

/* AND IT IS EXPORTED, BECAUSE THE ORDER IS ONE OBJECT EVERYWHERE (FEED-IA §42.2). «ORDER HISTORY
 * as the SAME order cards Sales uses.» The Customers sheet draws a customer's albaranes with THIS
 * component rather than with a table of its own, so a row a person reads in the book and a row they
 * read in the river are one drawing seen twice. Nothing else about the river is public. */
export function RiverRow({
  sale,
  standing,
  owed,
  selected,
  landed,
  terms,
  within,
  guideMarker,
  onOpen,
}: {
  sale: Sale;
  standing: RowStanding;
  /** the words a person is searching by, so the ones that landed here stand out (§35.1) */
  terms?: string[];
  /** the SELECTOR'S answer for this sale — `isStanding`, carried onto the row it drew so the
   *  altitude and the reason can be checked against each other (DENSE-BRIEF-DESIGN §1) */
  owed: boolean;
  selected: boolean;
  /** the band has just walked the reader here — the row lights so the eye lands (§25.2) */
  landed: boolean;
  /** ── WHOSE PAGE THIS ROW IS STANDING ON (FEED-IA §43, the object law's other half) ────────
   *  «The order is ONE object everywhere; their history is those cards» (§42.2) — so a customer's
   *  sheet mounts THIS component and not a summary table of its own. The one thing that changes is
   *  what the card has to SAY: on the river the name answers «whose order is this», and on Can
   *  Solé's own sheet it answers a question nobody asked, twelve times down a column, under a
   *  heading that already said Can Solé.
   *
   *  IT IS SUPPRESSION, NOT A VARIANT. Same component, same face, same altitude, same door — minus
   *  one line that the context is already saying. A second row component would be a second identity
   *  for one object, which is the exact thing §43 forbids; a prop that names the CONTEXT is the app
   *  knowing where it is. Pass the customer's id when the surface is that customer's. */
  within?: string;
  /** Stable target for the guide's independently scrolling pane regression. */
  guideMarker?: 'pane-spike';
  onOpen: () => void;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const round = roundOf(sale);
  /** IS THIS ROW STANDING ON ITS OWN CUSTOMER'S PAGE? (§43, `within`.) One boolean, read once, so
   *  the two altitudes below cannot answer it differently. */
  const mine = within !== undefined && within === sale.customer.id;
  /* THE RECORD LIES FLAT AND QUIET (§21). A closed row's ink steps back, so a column of three
     hundred rows sorts itself by darkness before a word of it is read. The FIGURE stays at full
     ink at every standing, because money is the one thing that is never quiet.
     THE COMPLAINT IS NOT DRAWN HERE ANY MORE (DENSE-BRIEF-DESIGN §1): «disputed draws the only
     accent outline, the word Complaint, the customer's own sentence and the settle verb» — a row
     that carries a sentence and a verb is a row that stands, so the river hands it to the standing
     altitude and this component has one rule about the accent instead of two. */
  const quiet = standing.closed;
  /* §9.2: a question on a sale shows in BOTH places. Its card left the band with §26.4, so the mark
     on the row is now the whole of what Sales says about it — and it says it in words. */
  const asked = isMessageOnly(sale);
  // §158 keeps this row's metadata quiet; authorship remains in the document history.
  const matched = matchedProductOf(sale, terms);
  /* ── IS THIS ROW A FLAGGED ORDER? (FEED-IA §196.3) ───────────────────────────────────────
     One fold, subscribed, so the outline, the pills at the row's right and the river's own «To
     review» tally answer the same question and clear together on a dismissal. */
  const flag = useFlagStanding(sale);

  return (
    <button
      type="button"
      data-feed-row={sale.id}
      data-river-row={sale.id}
      data-guide-target={guideMarker}
      data-state={sale.state}
      data-altitude="flat"
      data-owed={owed ? 'yes' : 'no'}
      data-closed={standing.closed ? 'yes' : 'no'}
      data-presses={standing.presses ? 'yes' : 'no'}
      data-selected={selected ? 'yes' : 'no'}
      data-list-card="inset"
      data-focused={focused ? 'yes' : 'no'}
      data-landed={landed ? 'yes' : 'no'}
      data-testid={`open-${sale.id}`}
      /* ── THE FLAG IS A FACT ABOUT THE ROW, SAID ON THE ROW (§196.3) ────────────────────
         Stated as an attribute as well as drawn, so the audit drive can hold the river to
         «every flagged order wears the red, and no unflagged one does» rather than counting
         pixels. `response`/`check` are Rocoto's readings; `marked` is the operator's own Flag. */
      data-flagged={flag.any ? 'yes' : 'no'}
      data-flag-response={flag.response ? 'yes' : 'no'}
      data-flag-check={flag.check ? 'yes' : 'no'}
      data-flag-marked={flag.marked ? 'yes' : 'no'}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={onOpen}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale500,
        width: 'calc(100% - 16px)',
        margin: `${theme.sizing.scale100} ${theme.sizing.scale300}`,
        padding: `${theme.sizing[ROW_AIR]} ${theme.sizing[GUTTER]}`,
        border: `1px solid ${selected || focused || over || landed ? theme.colors.borderOpaque : 'transparent'}`,
        /* THE OUTLINE TAKES NO LAYOUT (§37.3 · §77.2). A row that starts being flagged must not
           move the rows around it, and an outline is drawn outside the border box — so the
           river's rhythm is identical flagged and plain, which is the whole reason this mark is
           an outline rather than a border or a left rule. */
        ...flagBox(theme, flag.any),
        borderRadius: theme.borders.radius300,
        background: selected || over || focused || landed ? theme.colors.backgroundSecondary : 'transparent',
        boxShadow: landed ? `inset 0 0 0 2px ${theme.colors.contentPrimary}` : 'none',
        transitionProperty: 'box-shadow, background-color, border-color',
        transitionDuration: theme.animation.timing400,
        transitionTimingFunction: theme.animation.easeOutCurve,
        color: quiet ? theme.colors.contentSecondary : theme.colors.contentPrimary,
        textAlign: 'left',
        cursor: 'default',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <CustomerFace of={sale.customer} size={FACE.row} muted={standing.closed} />

      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
        {/* WHOSE ROW THIS IS — step 3, the same step in every list on this surface. */}
        {/* THE NAME IS NAMED (§25.5). One attribute, on every list on this surface, so «whose row
            is this» is a fact the page states rather than a position a reader has to infer.
            AND IT SAYS NOTHING ON THE PERSON'S OWN PAGE (`within`): the same object, minus the one
            line the context has already said. */}
        <span
          data-customer={mine ? undefined : sale.customer.name}
          data-within={mine ? within : undefined}
          style={{
            ...theme.typography.LabelMedium,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {/* AND THE SEAT DOES NOT GO EMPTY. Dropping the name is dropping the answer to «whose
              order is this», which the page already gave; the question that is still open on their
              own page is WHICH order — and an order is identified by the day it goes out. So the
              day takes the lead line there, at the same step, and the row keeps a head to read
              rather than opening on «3 lines · 09:12». */}
          {mine ? sale.deliveryDay : <CustomerName sale={sale} terms={terms} />}
        </span>
        {/* THE FACTS — step 5, and nothing on this line is ever the point of the row. */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale300,
            // Keep the count, timestamp and truck legible when two concern chips share the row.
            flexWrap: 'wrap',
            rowGap: theme.sizing.scale100,
            minWidth: 0,
            ...theme.typography.ParagraphXSmall,
            color: theme.colors.contentTertiary,
          }}
        >
          {/* THE SYSTEM'S OWN JUDGMENT, IN ITS FIXED SEAT (§67.6). It stands at the head of the
              line, immediately after the accent dot's column, so what the system has to say is the
              first thing on the row after who and how much — and everything behind it gives way
              at 390 rather than the label doing.
              ON THIS ALTITUDE IT IS ALWAYS SILENT, and that is the point: the river hands a sale
              to this component only when `isStanding` said no, and every reason there is makes
              `isStanding` say yes. Silence is the correct interface for an ordinary order
              (canon §16.4), and here it is silence the surface cannot accidentally break. */}

          {/* THE HOUR HAS ITS OWN FLOOR (§33.2, item 8). These facts used to share one ellipsising
              span, so a row carrying a question mark and a truck chip squeezed the pair and the
              browser cut the END of it — which is the HOUR, the one fact on the line a person
              actually navigates the morning by. The count is what may shorten; the hour is given
              its own box and never shrinks, so what disappears under pressure is always the
              least-load-bearing thing on the row. */}
          <span
            style={
              matched
                ? { flex: '0 0 auto', whiteSpace: 'nowrap' }
                : { flex: '0 0 auto', whiteSpace: 'nowrap' }
            }
          >
            {matched ? (
              <Answered name={matched} terms={terms ?? []} />
            ) : (
              <>
                {sale.lines.length} {plural(sale.lines.length, 'line')}
              </>
            )}
          </span>
          <span data-hour={sale.at} style={{ flex: '0 0 auto', whiteSpace: 'nowrap', marginLeft: `-${theme.sizing.scale200}` }}>
            · {sale.at}
          </span>
          {/* ── AND THE SENTENCE IS WHAT YIELDS, NEVER THE RUN (FEED-IA §129.5, caught by the gate)
              This chip stood at `flex: 0 0 auto` beside an hour and a truck that also refuse to
              shrink, so at 1096 and at 390 the sum ran past the row and the browser cut the LAST
              thing on the line — the run chip, printed destroyed as «🚚 1 · Gr…», which is this
              file's own named defect and the exact shape of the clipped control §129 opens with.
              The order this line already argued for says which fact gives way: an ellipsis is
              honest on a SENTENCE and a lie on a two-word fact, and «They asked a question» is the
              only sentence here. So it takes the pressure and the run keeps its place whole. */}
          {/* A card has one destination. Truck changes belong on the opened order. */}
          {round && <TruckChip round={round} />}
        </span>
        <RowHistory sale={sale} />
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.sizing.scale100, whiteSpace: 'nowrap', maxWidth: '50%', flexShrink: 0 }}>
        <AttentionLabels sale={sale} />
        {/* TIME PRESSES IMPLICITLY (§21). An open row whose day has come says so in full ink at the
            step above; everything else states itself quietly. Weight is doing the sorting, and no
            colour is involved in any of it. */}
        <RowWord sale={sale} standing={standing} />
        <DeliveryNotePaymentBadge saleId={sale.id} />
      </span>
    </button>
  );
}

/* ── WHAT A REASON'S MARK MEANS, IN ONE PLACE (DENSE-BRIEF-DESIGN §1 — the first-reader bar) ──
 * «Point at any mark and ask a first-time reader what it means: they answer correctly without a
 * legend, or the mark has its word beside it.» Every mark here is standing beside its own
 * sentence, which is the second half of that bar — and there are exactly three of them:
 *
 *   the bubble      a person is owed words, and the reason says which words
 *   the empty tick  the bay's tick, RESET — «going backwards is visible, not silent» (§7.2). A
 *                   filled tick over a pick that changed is the lie the criterion hunts for, so
 *                   the feed only ever draws this circle empty and never draws the ticked one.
 *   the saffron dot Rocoto's own act — its reading, its question, its commit. Nothing else on this
 *                   surface is allowed the accent, and the accent is never spent on urgency.
 *
 * THE BAND AND THE ROW CALL THE SAME FUNCTION. §25.2 makes them one entity seen twice; a card that
 * marked Rocoto's reading and a row that did not would be two entities to any reader.
 */
const isPickReset = (w: ExceptionReason, sale: Sale): boolean =>
  Boolean(sale.prep?.stale) && !w.rocoto && w.act === 'edit';

function ReasonMark({ why, sale }: { why: ExceptionReason; sale: Sale }) {
  if (why.act === 'reply') return <Glyph id="chat" size={STEP.small} />;
  if (isPickReset(why, sale)) return <Glyph id="pick" size={STEP.small} title={STALE_WORDS} />;
  if (why.rocoto) return <ActDot label="Handled automatically" />;
  return null;
}

/* ── THE REVIEW CARD'S ONE ANATOMY (FEED-IA §51.1, §51.24) ────────────────────────────────────
 * «The review cards are EXTREMELY BUSY» — and the reason they were is that the band's card and the
 * row standing in its day had grown into two different drawings of one thing, each accumulating its
 * own sentences. §25.2 says they are ONE ENTITY SEEN TWICE. So they are now one WIREFRAME, drawn
 * once, here, and the two callers differ only in their skin and in the one fact the context changes:
 * on the band, whose account it is; in the river, the hour it landed.
 *
 *   ZONE      HOLDS                       TYPE STEP              CHANGES WITH
 *   A face    the CUSTOMER's initials     28/32px                closed → faded
 *   B who     the customer's name         LabelMedium 16/500     a search marks the letters
 *   C reason  ONE sentence, or the settle ParagraphSmall 14/400  clamped to two lines, always
 *   D facts   three tokens, no more       ParagraphXSmall 12/400 a search swaps the count for the
 *                                                                line that answered it
 *   E rail    the figure over the state   Figure `default` + LabelSmall/XSmall
 *   F verb    exactly one                 Button compact         primary where a person is held
 *
 * THE RAIL AND THE VERB ARE COLUMNS, NOT THINGS THAT FOLLOW THE TEXT (§36.2: «a fixed right rail —
 * figure · state · verb aligned as columns»). Verbs are different lengths, so a figure that simply
 * follows the sentence lands at a different x on every card and four money figures stop being a
 * column anybody can scan. Both trailing slots are FIXED, both are right-aligned, and both start
 * at the card's own first line — so the eye reads three columns down a band rather than a pile.
 * Fixed rather than floored, because a floor that different verbs push out by different amounts is
 * a wrap point that moves per row, and §72.2's whole claim is that flipping moves nothing.
 *
 * TWO LINES IS THE REASON'S CEILING, AND IT IS A DELIBERATE ONE. Clipped to one, «Hotel Rec goes
 * out today — the …» is a card whose whole subject is people needing telling saying nothing;
 * unbounded, one long reason ran to three lines and the band stopped being a band (§10). It is
 * also the reason's FLOOR (§77.2: rows keep their height): a slot that is two lines on one card
 * and one on the next makes the river breathe as a person flips through it, and «clamped to two
 * lines, always» is what the wireframe above has said since it was written.
 *
 * ═══ THE FACTS ARE THEIR OWN BAND, WHICH IS HOW THE WIREFRAME ALWAYS DREW THEM (C3) ══════════
 * Zone F runs the card's whole width, under the rail and under the verb. Read the ASCII wireframe
 * in `StandingRow` below: [F] has always been drawn crossing beneath [D] and [E], and the build
 * had it INSIDE the text column instead — so a fact line needing 354px was given 269 while 236px
 * of rail and verb sat empty at its own height, and the row printed «⚖ Amount unreadable  3 ·
 * 07:25  M.  🚚 4» where the DOM held «3 lines · 07:25 · Marc Danés». Three facts mangled at flip
 * speed with a quarter of the row unused beside them. The band takes the width that was already
 * there; nothing else about the card moves.
 *
 * ═══ AND THE CARD'S COLUMNS WRAP RATHER THAN STARVE (C30) ═══════════════════════════════════
 * At 1280 the river pane is 432px and the three fixed columns — face, rail, verb — left the text
 * 29px: «Hote», «Can», a reason reading one letter per line, and a customer's name painting over
 * its own figure. The head band therefore WRAPS: the text column declares the width below which
 * it stops being readable, and where the row cannot seat the rail and the verb beside it they take
 * a line of their own, right-aligned, keeping their column relationship exactly. Every slot on the
 * band is fixed except the text, so the wrap point is identical on every row in the river — which
 * is the difference between responsive and random (§77.2).
 */

const RAIL_SLOT = 112;
const VERB_SLOT = 124;

/** THE WIDTH BELOW WHICH THE TEXT COLUMN STOPS READING (§51.1, C30). A customer's name at
 *  LabelMedium runs to ~140px and a reason wants two lines of about forty characters; under 240
 *  the card is the one the audit photographed. Where the head band cannot give it this beside the
 *  rail and the verb, those two go to a line of their own rather than take it out of the words. */
const BODY_FLOOR = 240;

function CardBody({
  sale,
  standing,
  terms,
  face,
  why,
  said,
  facts,
  verb,
}: {
  sale: Sale;
  standing: RowStanding;
  terms?: string[];
  /** the seat the customer's initials take at this altitude */
  face: number;
  /** THE one reason, already chosen (§51.1) — `null` where something else is being said */
  why: ExceptionReason | null;
  /** what stands in the reason's place for a moment: the settle's own sentence */
  said?: React.ReactNode;
  /** zone D, the caller's, because the context decides its middle token */
  facts: React.ReactNode;
  verb: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();

  const rail = (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: phone ? 'flex-start' : 'flex-end',
        gap: theme.sizing.scale100,
        /* FIXED, NOT FLOORED (§36.2, §72.2). The column's x is the same on every card, and — the
           reason it matters here — so is the width at which the head band runs out of room, so
           every row in the river wraps at the same place instead of each one deciding for itself. */
        width: phone ? undefined : RAIL_SLOT,
        flex: '0 0 auto',
        whiteSpace: 'nowrap',
      }}
    >
      <RowWord sale={sale} standing={standing} />
    </span>
  );

  const said_ = (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale100,
        /* IT DECLARES THE WIDTH IT NEEDS (C30). Under `BODY_FLOOR` the head band wraps rather than
           taking the difference out of the name and the reason — and the basis is what makes that
           decision the band's rather than the browser's. */
        flex: `1 1 ${BODY_FLOOR}px`,
        minWidth: 0,
      }}
    >
      {/* B · WHO. The card is the ORDER and the name is the CUSTOMER appearing inside it, so the
          card opens the order and the name opens the customer (§43). */}
      <span
        data-customer={sale.customer.name}
        style={{ ...theme.typography.LabelMedium, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        <CustomerName sale={sale} terms={terms} />
      </span>
      {/* C · THE ONE REASON. Rocoto's own reading carries the saffron mark; the customer's words
          and the plain fact that a word has no catalogue row are ink, because the accent marks the
          software's act and nothing else. */}
      {(why || said) && (
        <span
          data-why={why?.text}
          style={{
            display: 'flex',
            /* THE MARK BELONGS TO THE FIRST LINE. Centred, it drifted to the middle of a reason
               that wrapped — a flag floating beside the second half of a sentence. */
            alignItems: 'flex-start',
            gap: theme.sizing.scale200,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentPrimary,
            minWidth: 0,
            /* TWO LINES IS THE FLOOR AS WELL AS THE CEILING (§77.2). The clamp caps it; this keeps
               a one-line reason from making its whole card shorter than the card above, which is
               the river breathing under a person flipping through it. */
            minHeight: `calc(${theme.typography.ParagraphSmall.lineHeight} * 2)`,
          }}
        >
          {why && (
            <span
              data-testid={isPickReset(why, sale) ? `pick-reset-${sale.id}` : undefined}
              style={{ display: 'flex', alignItems: 'center', height: '1.4em', flex: '0 0 auto' }}
            >
              <ReasonMark why={why} sale={sale} />
            </span>
          )}
          <span
            style={{
              minWidth: 0,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {said ?? why?.text}
          </span>
        </span>
      )}
    </span>
  );

  /* ── F · THE FACTS, THEIR OWN BAND, THE CARD'S WHOLE WIDTH (§51.1's wireframe, C3, §77.2) ────
   * It runs under the rail and the verb, where nothing is drawn at its own height, and it is
   * indented to the text column so the card reads as one block rather than two.
   *
   * ITS OVERFLOW IS DECLARED, AND THE DECLARATION IS «WHOLE OR NOT AT ALL». Every token is
   * intrinsically sized and never shrinks; the band is one line tall and hides what wraps past it.
   * So a fact is printed complete or it is not printed — never «3 …» for «3 lines», never «M.» for
   * «Marc Danés». An ellipsis is honest on a sentence and a lie on a two-word fact: it looks like
   * a long thing cut short when it is a short thing destroyed.
   *
   * WHICH MAKES THE ORDER THE PRIORITY ORDER, and it is the one this file already argued for: the
   * system's judgment, the count, the hour, the run — «never the run, never the hour» — and the
   * comercial's name last, because it is the one the phone already drops.
   */
  const factBand = (
    <span
      data-facts={sale.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        alignContent: 'flex-start',
        gap: theme.sizing.scale300,
        flexWrap: 'wrap',
        height: CHIP_H,
        overflow: 'hidden',
        paddingLeft: face + Number.parseInt(theme.sizing.scale500, 10),
        minWidth: 0,
        position: 'relative',
        pointerEvents: 'none',
        ...theme.typography.ParagraphXSmall,
        color: theme.colors.contentTertiary,
      }}
    >
      {facts}
    </span>
  );

  const content = (
    <span
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        /* THE HEAD BAND WRAPS ITS COLUMNS RATHER THAN STARVING ITS WORDS (C30) — and because every
           slot on it but the text is fixed, it wraps at one width for the whole river. What lands
           on the second line is the rail and the verb TOGETHER, still aligned to the right edge,
           so §36.2's column relationship survives the fold. */
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: theme.sizing.scale500,
        width: '100%',
        minWidth: 0,
        color: theme.colors.contentPrimary,
        textAlign: 'left',
        /* THE CONTENT IS READ, NEVER PRESSED. The door underneath takes every press that lands on
           the card; the name and the verb put their own pointer events back. */
        pointerEvents: 'none',
        position: 'relative',
      }}
    >
      <CustomerFace of={sale.customer} size={face} muted={standing.closed} />
      {said_}
      {!phone && rail}

    </span>
  );

  return (
    <>
      {content}
      {phone ? factBand : (
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0,
          position: 'relative', pointerEvents: 'none' }}>
          <span style={{ flex: 1, minWidth: 0 }}>{factBand}</span>
          <span style={{ flex: '0 0 auto', pointerEvents: 'auto' }}>{verb}</span>
        </span>
      )}
      {phone && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale400,
            /* the card's own bands sit tight together; the acts get a step of their own (§33) */
            marginTop: theme.sizing.scale300,
            paddingLeft: face + Number.parseInt(theme.sizing.scale500, 10),
            position: 'relative',
            pointerEvents: 'none',
            minWidth: 0,
          }}
        >
          {rail}
          <span style={{ flex: 1, minWidth: 0 }} />
          <span style={{ pointerEvents: 'auto', flex: '0 0 auto' }}>{verb}</span>
        </span>
      )}
    </>
  );
}

/* ── A ROW THAT STANDS, IN ITS DAY (§10, §22.6, §25.2) ────────────────────────────────────────
 * Everything a person owes something is drawn here, in its own day, in the hour it arrived — the
 * ones the band indexes included, because the band is an index and not a home.
 *
 * IT IS INSET, NOT FLOATED. The band floats; a box floating inside the river would break the one
 * unbroken stream §4.2 asks for. So this stands by INK and STRUCTURE: a bar down its edge,
 * hairlines above and below, no radius and no shadow.
 *
 * ═══ THE WIREFRAME (FEED-IA §51.1, §51.24 — the review card, at its river altitude) ══════════
 * The band's card and this row are ONE ENTITY SEEN TWICE (§25.2), so they are ONE WIREFRAME with
 * one zone removed: this one stands inside its own day and inside its own hour, so it says the hour
 * where the card says whose account it is.
 *
 *   ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 *   │ [A]  [B] Can Solé                              [D] 914,30 €          [E] ┌───────────┐  │
 *   │ face [C] It changed after it was picked…           Open · out today      │  Check it │  │
 *   │      [F] ○ Pick changed · 3 lines · 08:38 · 🚐2 · Jordi Bertran                          │
 *   └─────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   A · THE FACE      the CUSTOMER's initials, 32px (§51.2) — never a product's painting
 *   B · WHO           LabelMedium 16/500, one line, ellipsis · a door onto the customer (§43)
 *   C · THE REASON    ParagraphSmall 14/400 at full ink, ONE sentence, two lines always
 *   D · THE RAIL      Figure `default` over the state word, right-aligned in a fixed slot
 *   E · THE VERB      exactly one, and it is ONE OF TWO WORDS (FEED-IA §110 · §110.1). «Check it»
 *                     opens the QUICK CHECK — the four-beat film that morphs out of this row
 *                     (§111.1, §115.3); «Answer them»
 *                     opens the conversation with Rocoto's withheld reading offered in the
 *                     composer. AT REST IT IS A WORD (tertiary) and it takes its weight — primary
 *                     where a person is held, secondary where the work is — the moment the pointer
 *                     or the caret is on the card. Fifteen filled buttons down a river is a to-do
 *                     list whatever the rows say, and «resolved by default» is the impression the
 *                     river owes (§111.1).
 *   F · THE FACTS     ParagraphXSmall 12/400 tertiary, ONE line, THE CARD'S WHOLE WIDTH: the chip ·
 *                     lines · hour · the run's mark · whose account. It crosses under D and E
 *                     because at its own height they hold nothing (C3).
 *
 *   STATE CHANGES: hover/selected/landed → `backgroundSecondary` · a complaint → the accent down
 *   the left edge · settling → the lift, and C is replaced by the settle's own sentence for four
 *   seconds · escalated → `data-escalated` and the rail's «out today»; never a fourth sentence.
 *   NARROW → the head band folds D and E onto a line of their own, right-aligned, and B and C keep
 *   the width (C30). The fact band is unchanged by the fold; it was already the full width.
 *
 * ═══ WHAT LEFT THE ROW, AND WHY (§51.1) ═════════════════════════════════════════════════════
 * · THE CLASS SENTENCE. «A person is waiting on you» stood above «They ask for more gamba — Rocoto
 *   needs to know if you can get it», which already says a person is asking. It was a preamble to
 *   its own reason, which is exactly the orphan sentence §51.24 bans. The class survives where it
 *   is load-bearing and free: the VERB's weight (primary where a person is held), and `data-standing`
 *   on the row, which was carrying the very same class all along.
 * · THE ESCALATION SENTENCE. «Became urgent — delivery is today» beside a rail saying «Open · out
 *   today» is the same fact at two steps (§25.5).
 * · THE OTHER REASONS. One card, one reason (`topReason`); the rest are in the document.
 */

/** §149 replaces the raised concern card with the ordinary document row. */
type FeedRowActions = { open: (id: string) => void; archive: (sale: Sale) => void };
type FeedRowProps = {
  sale: Sale;
  today: string;
  selected: boolean;
  landed: boolean;
  terms: string[];
  policy: unknown;
  actions: React.MutableRefObject<FeedRowActions>;
  guideMarker?: 'pane-spike';
};

/* The kit fold returns new objects for untouched orders after a single read/edit event. Compare
 * the complete immutable record at this boundary, so opening one order does not rebuild hundreds
 * of other rows. Comparing every field keeps source/history/concern changes visible; grants and
 * pricing also invalidate explicitly. Actions dereference the latest handlers only on a press. */
const FeedRow = React.memo(function FeedRow({ sale, today, selected, landed, terms, actions, guideMarker }: FeedRowProps) {
  const standing = rowStanding(sale, today);
  return <ArchiveRow sale={sale} active={selected || landed}
    onArchive={sale.archived ? undefined : () => actions.current.archive(sale)}>
    <RiverRow sale={sale} standing={sale.archived ? { ...standing, word: 'Archived', closed: true, presses: false } : standing}
      owed={sale.archived ? false : isStanding(sale, today)} selected={selected} landed={landed}
      terms={terms} guideMarker={guideMarker} onOpen={() => actions.current.open(sale.id)} />
  </ArchiveRow>;
}, (before, after) => before.today === after.today && before.selected === after.selected
  && before.landed === after.landed && before.policy === after.policy && before.actions === after.actions
  && before.terms.join('\0') === after.terms.join('\0')
  && before.guideMarker === after.guideMarker
  && (before.sale === after.sale || JSON.stringify(before.sale) === JSON.stringify(after.sale)));

/* ═══ THE QUICK CHECK IS A FILM (FEED-IA §115.3 · §115.6, correcting §111.1's first cut) ══════
 * «Being checked is that they tap it. It shows the message. It shows what they wanted to confirm.
 * The order shows a change happening, and then it gets saved.» And the general law under it
 * (§115.6): he describes surfaces as FILMS, and the beats are NAMED BEFORE THE LAYOUT.
 *
 * ═══ THE BEATS, NAMED FIRST — THE LAYOUT BELOW IS THESE FOUR AND NOTHING ELSE ═══════════════
 *
 *   1 · THE MESSAGE       what the customer actually wrote, in their words, at reading size and
 *                         with the hour it came. The film opens on THEM, not on the software's
 *                         reading of them. It holds `timing700` and cuts on its own.
 *   2 · WHAT TO CONFIRM   the grade's chip, the ONE line the check is about, and the two numbers
 *                         that decide it — «usually 3 kg, this one says 40». This beat WAITS:
 *                         the person is the projectionist, and the one act is theirs.
 *   3 · THE ORDER CHANGES the SAME line, still on screen, with the mark LIFTING OFF IT and the
 *                         doubt going with it. The change happens on the document, watched.
 *                         It holds `timing1000`, which is long enough to see a thing move.
 *   4 · SAVED             one word in the seat the doubt was in. It holds `timing700` and the
 *                         card folds back into the row it came out of.
 *
 * ═══ THREE OF THE FOUR ARE ONE CONTINUOUS SHOT, AND THAT IS THE WHOLE IDEA ══════════════════
 * Beats 2, 3 and 4 never change frame: the ORDER's line stands in the middle of the card the
 * entire time and what changes is what is riding it. A person watches the doubt come off their
 * own document rather than reading a description of a change and pressing yes — which is exactly
 * the difference between this and a confirmation dialog.
 *
 * ═══ NO PROGRESS BAR AND NO ARE-YOU-SURE (§115.3, both said with heat) ══════════════════════
 * A progress bar is a description of a wait and a confirmation dialog is a description of a
 * change; the film shows the change instead, on the thing it is happening to. Nothing here counts
 * anything down, and nothing asks a second time. The hard guard that still exists — the lot
 * proposal and the traceability warning — is `detail.tsx`'s `ConfirmGate`, and it is a MISSING
 * FACT rather than a second yes: where it fires, this card stands down and lets it speak.
 *
 * ═══ AND IT IS NARROW, AND IT IS SHORT (§115.3: «why are they so wide? so much text inside») ═
 * The first cut of this card was 520px carrying a heading, a chip, a reason paragraph, EVERY line
 * of the albarán, a figure, a consequence line and two buttons — a panel wearing a modal's
 * clothes. A film does not need any of that: one frame at a time, and each frame is one thing.
 *
 * ═══ IT STILL MORPHS OUT OF THE ROW, AND BACK (§111.1, §59.1) ═══════════════════════════════
 * The card is born at the row's own box and unfolds into place, and it folds back into the same
 * box when it goes — so the eye is never handed a new object, only the one that was pressed,
 * opened. A phone takes the app's bottom-sheet posture instead (§76, §77.1), which has its own
 * arrival. `prefers-reduced-motion` gets every beat and none of the movement: the beats are
 * CONTENT and the person is owed them; the travel between them is motion and it goes.
 */

/** THE FILM'S FOUR BEATS, in the order they play. The card says which one it is on. */
type Beat = 'message' | 'confirm' | 'change' | 'saved';

/** THE CARD'S OWN WIDTH (§115.3: «why are they so wide?»). One line and two short clauses need
 *  440, and 440 is what a phone gives up to gracefully at 390 with the card's own gutters. */
const QUICK_W = 440;

/** THE STAGE'S DECLARED HEIGHT (§77.2: «nothing jags»). Both frames are measured rather than
 *  guessed, and the taller of the two is the stage:
 *    THE MESSAGE  3 lines of ParagraphMedium (3 × 24) + scale200 + the hour's 16 = 96
 *    THE ORDER    the chip seat 18 + scale300 + the line's 40 at its tallest (a name over a lot —
 *                 §197.2 took the class out of that sub-line) + scale300 + the clause's 18 = 100
 *  So 104 holds either with air to spare, and cutting from beat to beat moves nothing at all. A
 *  card that is 96px on one shot and 148px on the next is the jag, one altitude up. */
const STAGE_H = 104;

/** THE ACTS' OWN SEAT. It is reserved from the first frame and it survives the beats that hold no
 *  control, because a row of buttons appearing under a film is the surface jumping (§59.1). */
const ACTS_H = 36;

/** MILLISECONDS OUT OF A THEME TOKEN. Every hold in this film is one of Base's own durations, read
 *  rather than typed, so the app's motion doctrine governs a licensed effect too (§111.1). */
const msOf = (token: string): number => Number.parseInt(token, 10) || 0;

/* ── BEAT 2/3/4's ONE FRAME: THE LINE THE CHECK IS ABOUT ──────────────────────────────────────
 * The albarán's own row grammar, compressed: the product's face, its name with class and lot
 * BELOW it, the quantity next to the unit, and THE PRICE ON THE RIGHT (§109.5, §111.10 — price on
 * the left is a violation, asserted dead). It is the same object the sheet draws, at the size a
 * card can hold, and it does not move for three of the four beats.
 */
function QuickLine({ cast, sale, line, now }: { cast: Cast; sale: Sale; line: Sale['lines'][number]; now: string }) {
  const [, theme] = useStyletron();
  const { inventory } = useWorkspaceCapabilities();
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  /* ── §122 INSIDE THE FILM ──────────────────────────────────────────────────────────────────
     The check's whole job is «is this right», and the fact a person disagrees with is the AMOUNT.
     It stood as text, so the only way to change it was to leave the card, open the albarán and
     find the line again — the review flow Peter says «can't just confirm to understand it».
     ⚠ THE GRADE WAS THE SECOND OF THEM UNTIL FEED-IA §197.2 «Remove class everywhere» (§193.4).
     They are live now, in `flush` shape: the field IS the words, inheriting their type and their
     line box, because §115.3's stage is 104px of MEASURED height with every frame laid on top of
     every other. Base's `Input` would have grown this row sixteen pixels the moment somebody
     pressed a quantity — the film jumping under the hand at the exact moment they are deciding.
     WHAT IS NOT LIVE: the LOTE, which is allocated off the floor rather than authored (`editLine`
     has no field for it — a lote is chosen by the lot book), and the LINE TOTAL, which is
     quantity × price and therefore an arithmetic. */
  return (
    <span
      data-testid="quick-check-line"
      data-quick-line={line.id}
      style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}
    >
      {/* THE PAINTING IS THE PRODUCT'S FACE, and here the subject IS the product (§51.2) */}
      <ProductFace of={line.product} size={28} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
        {/* AND THE GOODS ARE A DOOR ON THE REVIEW SURFACE TOO (§122 · §43: «no dead names
            anywhere»). The one card a person meets most — the check that lands on them — was the
            one place a product's name did nothing. A door costs the frame no pixels, which is what
            lets it stand inside a stage of measured height. */}
        <span
          style={{ ...theme.typography.LabelMedium, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <Door
            testid={`quick-line-open-${line.id}`}
            label={`Open ${line.product.name}`}
            onOpen={() => openProduct(line.product.id)}
          >
            {line.product.name}
          </Door>
        </span>
        {/* THE LOT, BELOW THE NAME. ⚠ §109.3's «class first, then lot» is REPEALED by FEED-IA
            §197.2 «Remove class everywhere»: the SKU in the title carries what the market sells
            by, and what stands under the name is when the goods came in (§193.4). */}
        {inventoryAvailable && line.lot && (
          <span
            style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {line.lot}
          </span>
        )}
      </span>
      <span
        style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, flex: '0 0 auto', whiteSpace: 'nowrap' }}
      >
        {qtyWords(line.given, line.unit)}
      </span>
    </span>
  );
}

function QuickCheck({
  cast,
  now,
  sale,
  job,
  from,
  isOpen,
  still,
  onClose,
  onRight,
  onOpen,
}: {
  /* §122 — the check edits the line it is about, so it needs the book the grade register comes
     off and the hour the edit is stamped with. Both are the surface's own, handed down rather
     than re-read, so a check and the albarán behind it can never disagree about the morning. */
  cast: Cast;
  now: string;
  sale: Sale;
  job: Job;
  /** the box the row was standing in when it was pressed — the morph's origin, `null` when the
   *  check was raised from the keyboard on a row that is not on screen */
  from: DOMRect | null;
  /** THE FOLD BACK IS THE POINT (§111.1: «out of the row it came from AND BACK»). The card has to
   *  OUTLIVE the decision to close it or there is no exit to paint — unmounting on the press is how
   *  a morph becomes a disappearance. So the surface lowers this flag, the card plays its own
   *  closing phase, and the subject is cleared one `EXIT_DELAY_MS` later. */
  isOpen: boolean;
  still: boolean;
  onClose: () => void;
  /** THE CHECK'S OWN ANSWER, and the machine act underneath it (`askOrAct`, the A key's own). It
   *  reports whether the act LANDED: where the hard guard took it instead, nothing happened to the
   *  document and the film may not pretend otherwise — beats 3 and 4 are a claim about the ledger. */
  onRight: (() => boolean) | null;
  onOpen: () => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const head = `quick-check-head-${sale.id}`;

  /* ── WHAT THE FILM OPENS ON, HELD FOR ITS WHOLE LENGTH ───────────────────────────────────────
   * Every value the beats draw is snapshotted at the tap, and it has to be: the act in beat 3
   * REFOLDS the document, so a card reading the live one would watch its own subject evaporate —
   * the grade returns null, the flag returns nothing, and the lift would be a disappearance.
   * These are the same values `rubricOf` and `flagsOf` were giving a second earlier; nothing here
   * is computed differently, only held.
   */
  const [film] = React.useState(() => {
    const grade = rubricOf(sale);
    /* THE FLAG THE GRADE IS ON, matched by kind so the chip and the line can never be about two
       different things (§72.3's own «one fact, two compressions», read across the card). */
    const wants: Partial<Record<RubricClass, FlagKind>> =
      { quantity: 'unusual', ceiling: 'big', unreadable: 'unreadable' };
    const kind = grade ? wants[grade.klass] : undefined;
    const flag = kind ? flagsOf(sale).find((f) => f.kind === kind) ?? null : null;
    return {
      grade,
      /* THEIR OWN WORDS — the arrival, not Rocoto's reading of it. A document nobody sent (the
         composer's own, §74) has no message at all, and the film simply opens one beat later. */
      said: sale.thread.find((r) => r.author === 'received') ?? null,
      /* THE LINE IS HELD BY ID, NOT BY VALUE (FEED-IA §115.3's third beat). Beat 3 is «the order
         shows a change happening», so the line it draws has to be the LIVE one — the lote Rocoto
         proposed lands under the product's name and the person watches it arrive. A snapshotted
         line would have been a photograph of the document taken before the change, which is the
         one thing this beat may not be. The value is kept only as the fallback for a line that
         leaves the document altogether. */
      lineId: flag?.line.id ?? null,
      line: flag?.line ?? null,
      /* THE TWO NUMBERS THAT DECIDE IT (§69's own `usualWords`) — «usually 3 kg, this one says 40».
         The chip already says the CLASS, so the clause spends itself on the ground and nothing
         else; the long form stays on the row, where the sober register reads it (§72.3). */
      ground: flag ? usualWords(flag) : null,
      lines: sale.lines.length,
      figure: sale.figure,
    };
  });

  /** THE FIRST FRAME. A document with no message of its own opens on the order (§74's own case). */
  const [beat, setBeat] = React.useState<Beat>(film.said ? 'message' : 'confirm');

  /** THE LINE THE FILM IS ABOUT, READ LIVE. This is what makes beat 3 a beat: the act attaches
   *  Rocoto's proposed lotes, the document refolds, and the lote appears under the name while the
   *  person is looking at it. The snapshot stands in only if the line has left the document. */
  const line = (film.lineId ? sale.lines.find((l) => l.id === film.lineId) : null) ?? film.line;

  /* ── THE HOLDS, IN THE THEME'S OWN DURATIONS ────────────────────────────────────────────────
   * `timing700` opens and lands; `timing1000` is the change, because a change nobody had time to
   * see is a cut. A calm reader keeps all four beats — they are CONTENT — and loses the travel
   * between them, which is what `prefers-reduced-motion` is actually about. */
  const holds: Record<'message' | 'change' | 'saved', number> = {
    message: msOf(theme.animation.timing700),
    change: msOf(theme.animation.timing1000),
    saved: msOf(theme.animation.timing700),
  };

  React.useEffect(() => {
    if (beat === 'confirm') return;
    const next = beat === 'message' ? () => setBeat('confirm')
      : beat === 'change' ? () => setBeat('saved')
        : onClose;
    const t = window.setTimeout(next, holds[beat]);
    return () => window.clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- the beat is the event */
  }, [beat]);

  /** THE ONE ACT, AND IT ROLLS THE FILM ON. Where the act did not land — the hard guard took it —
   *  the card leaves and the guard speaks; a film about a change that did not happen would be the
   *  worst kind of lie this surface could tell. */
  const play = () => {
    if (!onRight) return;
    if (onRight()) setBeat('change');
    else onClose();
  };

  /** WHERE THE CARD IS BORN. The row's centre against the viewport's, plus a vertical fold — so it
   *  unfolds out of the strip it came from rather than arriving from nowhere. */
  const origin = !from || phone || still
    ? null
    : `translate(${Math.round(from.left + from.width / 2 - window.innerWidth / 2)}px, ${
      Math.round(from.top + from.height / 2 - window.innerHeight / 2)}px) scaleX(0.94) scaleY(0.28)`;

  /** THE CUT BETWEEN BEATS. One pair for the whole film, and it is the card's own (§111.1). */
  const cut = still
    ? undefined
    : {
      transitionProperty: 'opacity, transform',
      transitionDuration: theme.animation.timing400,
      transitionTimingFunction: theme.animation.easeOutCurve,
    };

  const onOrder = beat !== 'message';
  const done = beat === 'change' || beat === 'saved';

  return (
    <OverlayCard
      isOpen={isOpen}
      onClose={onClose}
      scrim={SCRIM.dim}
      placement={phone ? CARD_PLACEMENT.bottom : CARD_PLACEMENT.center}
      size={phone ? 'full' : QUICK_W}
      animate={!still}
      ariaLabelledBy={head}
      overrides={{
        Card: {
          style: ({ $phase }: { $phase: string }) => (origin === null ? {} : {
            /* THE CARD IS AT THE ROW EXCEPT WHILE IT IS OPEN, so it unfolds on the way in and folds
               back on the way out. Base's own asymmetry — «fades off where it stands» — is right for
               a card that arrived from nowhere and wrong for one that came out of a row. */
            transform: $phase === 'open' ? 'none' : origin,
            transformOrigin: 'center center',
            willChange: 'transform, opacity',
          }),
        },
      }}
    >
      {() => (
        <div
          data-testid="quick-check"
          data-sale={sale.id}
          data-job={job.id}
          data-beat={beat}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
        >
          {/* ── THE TITLE CARD: WHO, AND HOW MUCH ─────────────────────────────────────────────
              It does not change with the beat, because the film's subject does not change. The
              name NAMES the thing by being it (the heading rule), and the figure outranks it
              (§4.3) — those are the two facts, and there is no third. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
            <CustomerFace of={sale.customer} size={FACE.card} />
            {/* THE PERSON THE CHECK IS ABOUT IS AN OBJECT (§122 · §43). Their sheet answers the
                question a person actually has at this moment — «is this what they always take» —
                and it stood as a heading nothing could reach. */}
            <h2
              id={head}
              style={{ margin: 0, ...theme.typography.HeadingXSmall, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              <CustomerHoverCard customer={sale.customer}>
                <Door
                  testid="quick-check-customer"
                  label={`Open ${sale.customer.name}`}
                  onOpen={() => openCustomer(sale.customer.id)}
                >
                  {sale.customer.name}
                </Door>
              </CustomerHoverCard>
            </h2>
          {/* ── THE STAGE. Fixed height, one frame at a time, and both frames are laid on top of
              each other so a cut is a cross-fade rather than a reflow (§77.2, §59.1).
              THE RULE AND THE AIR ARE THE WRAPPER'S AND THE HEIGHT IS THE INNER BOX'S, so
              `STAGE_H` is the frame and nothing else — an absolutely positioned child resolves
              against the PADDING box, so a stage that carried its own padding would have been a
              height every reader had to do arithmetic on. */}
          </div>
          <div
            style={{
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              paddingTop: theme.sizing.scale400,
              minWidth: 0,
            }}
          >
          <div
            data-testid="quick-check-stage"
            style={{
              position: 'relative',
              height: STAGE_H,
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {/* ══ BEAT 1 · THE MESSAGE ══════════════════════════════════════════════════════
                Their words, big — «the transcript can be bigger text» (§115's V44, the same
                instinct) — and the hour under them. Three lines is the clamp, and the clamp is
                what lets the stage state its height. */}
            {film.said && (
              <div
                data-testid="quick-check-message"
                aria-hidden={onOrder ? 'true' : undefined}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.sizing.scale200,
                  opacity: onOrder ? 0 : 1,
                  transform: onOrder ? 'translateY(-6px)' : 'translateY(0)',
                  pointerEvents: onOrder ? 'none' : 'auto',
                  minWidth: 0,
                  ...cut,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    ...theme.typography.ParagraphMedium,
                    color: theme.colors.contentPrimary,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 3,
                    overflow: 'hidden',
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {film.said.text}
                </p>
                {film.said.time && (
                  <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                    {film.said.time}
                  </span>
                )}
              </div>
            )}

            {/* ══ BEATS 2 · 3 · 4 — ONE CONTINUOUS SHOT OF THE ORDER ════════════════════════
                The line stands still for all three; the SEAT ABOVE it and the CLAUSE UNDER it are
                what change. That is «the order shows a change happening»: the document is on
                screen the whole time and the doubt comes off it. */}
            <div
              data-testid="quick-check-order"
              aria-hidden={onOrder ? undefined : 'true'}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: theme.sizing.scale300,
                opacity: onOrder ? 1 : 0,
                transform: onOrder ? 'translateY(0)' : 'translateY(6px)',
                pointerEvents: onOrder ? 'auto' : 'none',
                minWidth: 0,
                ...cut,
              }}
            >
              {/* THE SEAT — one fixed box, two occupants, and they cross-fade in place. The chip
                  is the app's own drawing (§72), held from the tap so it can be seen LEAVING; the
                  tick is what lands where it was. Nothing about this box changes size. */}
              <div
                style={{
                  position: 'relative',
                  height: CHIP_H,
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 0,
                }}
              >
                <span
                  data-testid="quick-check-mark"
                  data-lifted={done ? 'yes' : 'no'}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    display: 'inline-flex',
                    opacity: done ? 0 : 1,
                    transform: done ? 'translateY(-8px)' : 'translateY(0)',
                    ...cut,
                  }}
                >
                  <RowLabel
                    sale={sale}
                    owed
                    testid="quick-check-rubric"
                    held={film.grade}
                    /* the card is paper, so here the chip takes the tint — the same rule the row
                       keeps, read from the other side */
                    ground={theme.colors.backgroundSecondary}
                  />
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: CHIP_H,
                    display: 'inline-flex',
                    alignItems: 'center',
                    opacity: done ? 1 : 0,
                    transform: done ? 'translateY(0)' : 'translateY(8px)',
                    color: theme.colors.contentPrimary,
                    ...cut,
                  }}
                >
                  <Glyph id="confirm" size={CHIP_MARK} />
                </span>
              </div>

              {/* THE LINE — or, where the grade is about the document rather than one of its
                  lines, the document itself said in the same shape. It never moves. */}
              {line ? (
                <QuickLine cast={cast} sale={sale} line={line} now={now} />
              ) : (
                <span
                  data-testid="quick-check-line"
                  style={{ ...theme.typography.LabelMedium, color: theme.colors.contentPrimary, minWidth: 0 }}
                >
                  {film.lines} {plural(film.lines, 'line')}
                </span>
              )}

              {/* THE CLAUSE — the ground at beat 2, and the landing at beat 4. One seat, one line
                  of type, and it never wraps into a second (§77.2). */}
              <span
                style={{ position: 'relative', display: 'block', height: 18, minWidth: 0 }}
              >
                <span
                  data-testid="quick-check-ground"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    ...theme.typography.ParagraphSmall,
                    lineHeight: '18px',
                    color: theme.colors.contentSecondary,
                    opacity: done ? 0 : 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    ...cut,
                  }}
                >
                  {film.ground ?? job.says}
                </span>
                {/* ══ BEAT 4 · SAVED. One word, in the seat the doubt was in. */}
                <span
                  data-testid="quick-check-saved"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    ...theme.typography.LabelSmall,
                    lineHeight: '18px',
                    color: theme.colors.contentPrimary,
                    opacity: beat === 'saved' ? 1 : 0,
                    whiteSpace: 'nowrap',
                    ...cut,
                  }}
                >
                  Saved
                </span>
              </span>
            </div>
          </div>
          </div>

          {/* ── THE ACTS. One primary and a door, in a seat that is reserved from the first frame
              and stands empty while the film is playing itself out (§59.1: acting never makes the
              surface jump, in either direction). */}
          <div
            data-testid="quick-check-acts"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: theme.sizing.scale400,
              height: ACTS_H,
              minWidth: 0,
            }}
          >
            {beat === 'confirm' && (
              <>
                <Button
                  kind={onRight ? KIND.tertiary : KIND.primary}
                  size={SIZE.compact}
                  data-testid="quick-check-open"
                  onClick={onOpen}
                >
                  Open the delivery note
                </Button>
                {onRight && (
                  <Button
                    kind={KIND.primary}
                    size={SIZE.compact}
                    data-testid="quick-check-right"
                    onClick={play}
                  >
                    It’s right
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </OverlayCard>
  );
}

/* ── MESSAGES DIED AS A CARD; THE COUNT LIVES ON THE WIDGET (FEED-IA §75.2) ───────────────────
 * «It should just be a number on the widget.»
 *
 * WHAT STOOD HERE. `MessagesRow` — the chat glyph in a face's seat, «Messages · 3», the newest ask
 * quoted in one line, the customers named underneath, a chevron. §26.4 gave the questions ONE door
 * rather than a card each, and §67.6 reseated that door at the head of the river when the band
 * died. §75.2 finishes the argument the same way §67.6 finished the band's: the door was already
 * standing in the corner of every screen, so a row at the top of the river was the SECOND place
 * saying the same fact, and a person who has two places to look has a pile again.
 *
 * WHERE THE FACT WENT. `unreadCount` in `shell/threads.ts` — the one fold of `Thread.unread`
 * («the customer spoke last and nobody has opened it»), read by the chat launcher, which wears it
 * as a badge. The river draws nothing about messages at all, and this file no longer folds the
 * message-only sales, quotes an embed, or owns a door onto the conversation.
 */

/* ── «MINE»: THE SECOND NARROW (FEED-IA §32) ──────────────────────────────────────────────────
 * «Comerciales prep their own — mine is a NARROW (like the date narrow, they compose): band,
 * counts and ⎙ buttons all scope to the narrow. Cognitively 30–40 each instead of 300 for one.»
 *
 * THE TWO ORG MODELS ARE ONE UI, and this line is the whole difference between them. Model (a) —
 * one order-desk person running all three hundred — never presses it. Model (b) — eight
 * comerciales prepping their own — presses it once and reads a morning the size of their own book.
 * Neither is a mode, a seat or a screen: it is a filter over the same river, and it composes with
 * the date narrow because whose and when are different questions.
 *
 * WHAT «MINE» SCOPES, AND WHY IT SCOPES MORE THAN THE DATE DOES. §27 leaves the band GLOBAL inside
 * a date narrow on purpose: urgency ignores the calendar. Ownership is not the calendar — a
 * comercial narrowed to their own accounts is looking at their whole job — so this one scopes
 * everything a person reads: the river, the band, the Messages count, every whisper's aggregate,
 * every ⎙ count, the day sheet, and the list the panel and the sweep walk.
 *
 * IT IS THE PRE-AUTH FORM OF «MINE» (THE-INTELLIGENCE §12, parked). Nothing here is a permission:
 * every account stays on the surface and one press away, because nobody has signed in. When the
 * authed-comercial layer lands, signing in DEFAULTS this narrow to the person who signed in and
 * nothing else about it changes — which is why «mine» is built as a filter now rather than waited
 * on. A narrow that is later defaulted is the same object; a permission bolted on later is not.
 *
 * WHERE IT STANDS. At the head of the river, above the band, because it scopes the band too — and
 * quiet when released, loud when on, which is §22.6's own rule about a state that matters. It
 * takes the day whisper's grammar exactly: the loud word is the thing itself, the quiet step
 * beside it is the fact about it, and the word is the door that changes it.
 */

/** ── A HOLDER IS A PERSON, NOT A NAME (FEED-IA §67.1) ───────────────────────────────────────
 *  «The ownership dropdown shows the person whole: name · their PHONE · their email where it
 *  exists — as another column in the drop-down etc etc — you see where I'm going.» So the row
 *  carries what a person carries. `phone` is on every comercial in the book; `email` is on some,
 *  and the column simply says what is there. */
type Holder = { id: string; name: string; customers: number; phone: string; email?: string };

/* ── THE PICKER SEARCHES TOO (FEED-IA §35.1 — the customers' home) ────────────────────────────
 * «Filter-as-you-type in Sales, in customers, and in products.» The customers of this house live in
 * two lists today: the conversations, and this register of who holds which accounts. So the same
 * seat rides the head of this menu with the same grammar under it, and the same rule applies —
 * matches highlight, misses vanish.
 *
 * IT APPEARS WHEN A LIST IS LONG ENOUGH TO NEED IT. Eight names is a glance and a field over them
 * would be chrome for its own sake; a house with forty comerciales is a scroll, and then the seat
 * is the fastest thing on the screen. The threshold is the only number here, and it is the number
 * of rows a person reads without scrolling.
 */
const PICKER_SEARCH_FROM = 8;

/* ═══ THE ROWS ARE PEOPLE (FEED-IA §67.1 — «you see where I'm going») ════════════════════════
 * «Whose read: house wide unless they filter for the ones attributed to them or other comerciales
 * (they can cover for each other after all, which is how it should be). The ownership dropdown
 * shows the person whole: name · their PHONE · their email where it exists — as another column in
 * the drop-down etc etc.»
 *
 * WHAT WAS WRONG. The rows were `${name} · ${count}` — a STRING, in an app whose first law is that
 * every named thing is an object (§43). Eight comerciales drawn as eight strings is the one place
 * in Sales where a person appears and is not a person.
 *
 * ═══ THE WIREFRAME (§51.24 — regions, contents, type steps, states) ═════════════════════════
 * +- THE MENU -----------------------------------------------------------------------+
 * | [ Find a comercial                                  ]  at eight rows and up       |
 * +-----------------------------------------------------------------------------------+
 * | (N)  Núria Aymerich    +34 631 10 23 16   nuria@peixvilalta.cat   four columns, one x|
 * |      37 accounts                                                                     |
 * | (J)  Jordi Bertran     +34 632 11 26 21                          no address: silence |
 * |      40 accounts                                                                     |
 * +-----------------------------------------------------------------------------------+
 *   A · THE TILE      28px, the initial — the same round seat a person wears in Administration's
 *                     own PersonChip, so one person has one drawing in both places (§43)
 *   B · THE NAME      LabelMedium, the identity; «37 accounts» ParagraphXSmall tertiary under it,
 *                     which is the fact ABOUT them and steps back from the name accordingly
 *   C · THE PHONE     ParagraphXSmall secondary — the thing wanted at 07:00 when a crate is wrong
 *   D · THE EMAIL     ParagraphXSmall tertiary, truncating. Where a person has none the cell is
 *                     EMPTY: the column says what is there and never draws a dash for what is not
 *   STATES: Base's own highlight walks the rows (↑↓ and Enter, and the menu owns that, which is
 *   why the rows stay `items` rather than becoming hand-rolled buttons) · a search term marks its
 *   hits in every column it hit · a comercial holding NO accounts is still a row, because covering
 *   is normal and a roster that hid them would hide the new hire.
 *
 * THE COLUMNS ALIGN BECAUSE THEY ARE ONE TRACK LIST, stated in fractions and repeated per row —
 * so the eye reads DOWN the phones and DOWN the addresses, which is the whole of «as another
 * column». On a phone there is no room for four, so the reach folds under the name and the two
 * columns become two: the seat and the person. Nothing is dropped at either width.
 */
const HOLDER_TILE = 28;
/** ── A PHONE NUMBER IS NEVER CUT (measured, and then fixed) ──────────────────────────────────
 *  The first cut of this drew all three text columns in fractions, and the measure caught six of
 *  the eight numbers ending in an ellipsis — «+34 633 12 29 …». A number cut mid-digit is a number
 *  the app got wrong, not one it drew small, and it is the one fact in this row a person copies
 *  by eye. So the phone takes a FIXED track wide enough for the Spanish mobile shape with air, the
 *  address takes what is left and is the cell allowed to ellipsise (an address is long, variable,
 *  and still recognisable from its head), and the fixed track is what keeps the column at one x
 *  down the whole list — per-row grids cannot share an `auto`. */
const HOLDER_PHONE = 112;

function HolderRow({ holder, terms, phone }: { holder: Holder; terms: string[]; phone: boolean }) {
  const [, theme] = useStyletron();
  const cell: React.CSSProperties = {
    ...theme.typography.ParagraphXSmall,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
  return (
    <span
      data-holder={holder.id}
      style={{
        display: 'grid',
        gridTemplateColumns: phone
          ? `${HOLDER_TILE}px minmax(0, 1fr)`
          : `${HOLDER_TILE}px minmax(0, 1.15fr) ${HOLDER_PHONE}px minmax(0, 1fr)`,
        /* the tile centres against a two-storey identity on a desk, and TOPS a three-storey one on
           a phone — a round seat that floats beside the middle line of a person is a seat that has
           stopped pointing at the name it belongs to */
        alignItems: phone ? 'start' : 'center',
        gap: theme.sizing.scale400,
        width: '100%',
        minWidth: 0,
      }}
    >
      {/* A · THE SEAT A PERSON TAKES, the same round tile Administration draws them in */}
      <span
        aria-hidden="true"
        style={{
          width: HOLDER_TILE,
          height: HOLDER_TILE,
          borderRadius: '50%',
          background: theme.colors.backgroundSecondary,
          color: theme.colors.contentPrimary,
          display: 'grid',
          placeItems: 'center',
          ...theme.typography.LabelXSmall,
        }}
      >
        {holder.name.trim().slice(0, 1).toUpperCase()}
      </span>

      {/* B · THE NAME, AND THE SIZE OF THEIR BOOK UNDER IT */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelMedium, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Mark text={holder.name} terms={terms} />
        </span>
        <span style={{ ...cell, color: theme.colors.contentTertiary }}>
          {holder.customers} {plural(holder.customers, 'account')}
        </span>
        {/* AND ON A PHONE THE REACH FOLDS UNDER THE NAME rather than leaving the screen (§38) */}
        {phone && (
          <span style={{ ...cell, color: theme.colors.contentSecondary }}>
            <Mark text={[holder.phone, holder.email].filter(Boolean).join(' · ')} terms={terms} />
          </span>
        )}
      </span>

      {/* C · THE PHONE, and D · THE EMAIL WHERE IT EXISTS — their own columns, at one x */}
      {!phone && (
        <span style={{ ...cell, color: theme.colors.contentSecondary }}>
          <Mark text={holder.phone} terms={terms} />
        </span>
      )}
      {!phone && (
        <span style={{ ...cell, color: theme.colors.contentTertiary }}>
          {holder.email ? <Mark text={holder.email} terms={terms} /> : null}
        </span>
      )}
    </span>
  );
}

function ScopeMenu({
  holders,
  onPick,
  close,
}: {
  holders: Holder[];
  onPick: (id: string) => void;
  close: () => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const [query, setQuery] = React.useState('');
  const terms = React.useMemo(() => termsOf(query), [query]);
  /* IT SEARCHES EVERYTHING THE ROW SAYS OUT LOUD (§35.1's own rule: nothing hidden is indexed, and
     nothing said is left out). Now that the row carries a phone and an address, typing either one
     finds the person — «600» is how somebody looks up a number they half-remember. */
  const shown = React.useMemo(
    () =>
      terms.length === 0
        ? holders
        : holders.filter((h) => matches(terms, wordsOf([h.name, h.customers, h.phone, h.email]))),
    [holders, terms],
  );

  /** WHAT THE ROW ANNOUNCES TO A SCREEN READER — the same facts, as one sentence (§30). */
  const saidOf = (h: Holder) =>
    [h.name, `${h.customers} ${plural(h.customers, 'account')}`, h.phone, h.email].filter(Boolean).join(' · ');

  /* ── AND THE ROWS ARE WALKABLE FROM THE MOMENT IT OPENS (§67.1, D10's own walk) ─────────────
   * Base's list owns the walk — it is the `role="listbox"`, it carries `tabIndex`, and it holds
   * the highlight — but a popover leaves focus on the TRIGGER, so a person who opened this with a
   * key pressed ↓ into nothing. Two seams, both closed here rather than in the rows:
   *
   *   ON OPEN    the list takes focus, so ↑↓ Home End and Enter work on the first press.
   *   FROM THE SEARCH SEAT   ↑↓ typed into the field hands the walk down to the list AND replays
   *              the same press on it, so the key a person pressed is the key that moves them —
   *              a handover that swallowed one arrow would be the surface eating a keystroke,
   *              which is the defect the composer's own hand-off just closed (§74).
   */
  const shelf = React.useRef<HTMLDivElement | null>(null);
  const list = (): HTMLElement | null =>
    (shelf.current?.querySelector('[role="listbox"]') as HTMLElement | null) ?? null;
  React.useEffect(() => { list()?.focus({ preventScroll: true }); }, []);

  return (
    <div
      ref={shelf}
      data-testid="scope-menu"
      data-search={query}
      /* ─── THE MENU CLOSES ITSELF ON ESCAPE, AND DOES NOT WAIT TO BE TOLD ────────────────────
       * Base closes a layer from a document-level `keyup` that reaches it by BUBBLING out of
       * whatever is focused inside the layer — which makes «did Escape close the menu» a question
       * about where the focus happened to be, and a menu that opens, closes and re-opens is exactly
       * the sequence that moves it. Two things moved it here: a hover label is a layer of its own
       * and took the top of Base's escape stack the moment this seat was focused (it is a plain
       * `title` now, see `search.tsx`), and an empty search field used to swallow the press before
       * anything above it saw one.
       *
       * Both are fixed at their source, and this is the belt: a keydown on the menu's own wrapper
       * closes the menu. The seat below still takes the FIRST Escape while it is holding a query —
       * so the order is the app's own everywhere — and anything it lets through lands here, from
       * whatever had focus, on the press rather than on the release. */
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault();
          close();
          return;
        }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const el = list();
        if (!el || el.contains(document.activeElement)) return;
        e.preventDefault();
        el.focus({ preventScroll: true });
        el.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true }));
      }}
      /* the menu is as wide as its widest fact needs (§67.1's columns) and never wider than the
         screen it opens on — 500 desk, the phone's own 260, both clamped to the viewport */
      style={{ minWidth: phone ? 260 : 500, maxWidth: '92vw' }}
    >
      {holders.length >= PICKER_SEARCH_FROM && (
        <div
          style={{
            display: 'flex',
            padding: theme.sizing.scale300,
            borderBottom: `1px solid ${theme.colors.borderOpaque}`,
            background: theme.colors.backgroundPrimary,
          }}
        >
          {/* ── THE PICKER'S FIELD STAYS A SEAT, DELIBERATELY (FEED-IA §91.2's own second seam) ──
              «A field inside an open menu is not the app's search, it is that menu's own narrow.»
              This one is inside a Base menu that already owns ↑↓, Home, End, Enter and its own
              `aria-activedescendant`, and it narrows EIGHT rows that exist only while the menu is
              open. Summoning a full-screen box from inside a popover would close the popover the
              box is filtering, and «Holders» as an app-wide intent would put eight of the house's
              own people into a list a stranger searches for goods. So the seat stands, which is
              why §91.2 kept this housing rather than deleting it. */}
          <SearchSeat
            value={query}
            onChange={setQuery}
            label="Find a comercial"
            testid="scope-search"
            fill
          />
        </div>
      )}
      {shown.length > 0 ? (
        /* BASE'S OWN LIST KEEPS THE WALK. The rows are rich now, and they are still `items` for
           exactly that reason: ↑↓ Home End and Enter are the menu's, `aria-activedescendant` is
           the menu's, and a hand-rolled column of buttons would have had to re-earn all of it
           (§51.24, and D10's walk in the catalogue). The row is what changed; the organ did not. */
        <StatefulMenu
          overrides={{
            List: { style: { minWidth: phone ? '260px' : '500px', maxWidth: '92vw', maxHeight: '60vh' } },
            /* the tile is 28px and the row is two storeys, so the list item gives back the air it
               reserves for one line of type — the rows stay the height a person scans (§33) */
            Option: { props: { overrides: { ListItem: { style: { paddingLeft: theme.sizing.scale500, paddingRight: theme.sizing.scale500 } } } } },
          }}
          items={shown.map((h) => ({
            label: <HolderRow holder={h} terms={terms} phone={phone} />,
            id: h.id,
            'aria-label': saidOf(h),
          }))}
          onItemSelect={({ item }) => {
            const picked = shown.find((h) => h.id === (item as { id: string }).id);
            if (picked) onPick(picked.id);
            close();
          }}
        />
      ) : (
        <p
          data-testid="scope-search-empty"
          style={{
            margin: 0,
            padding: theme.sizing.scale500,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
          }}
        >
          Try another name.
        </p>
      )}
    </div>
  );
}

/* ── AND IT NEVER SCROLLS AWAY (FEED-IA §51.4) ────────────────────────────────────────────────
 * «Search is search, and WHOSE ACCOUNTS is visible AT ALL TIMES — never scrolls away.»
 *
 * It used to ride the head of the river and leave with it, which is why a slim NARROWS BAR existed
 * at all: something had to re-say the narrows once the line that said them had gone. Pinned, that
 * whole apparatus is answered at the source — the fact is never un-said, so nothing has to say it
 * twice. So the narrows bar is gone, the band's own repeat of the comercial's name is gone, and the
 * two observers that watched for the moment either of them left the screen are gone with them.
 *
 * ONE HEADER BLOCK, AND AT MOST TWO SLIM ROWS (§51.4). This is row one, and it is ABOVE THE SCROLL
 * rather than sticky within it on the desk: the list pane is a column of [header][scrollport], so
 * §38's one-scrollport-per-pane law holds literally and the header cannot be scrolled under. On the
 * phone the page is the scrollport, so it sticks under the frame's own bar instead. Row two is the
 * band's folded summary, which appears only once the band has been scrolled past (§51.3).
 *
 * IT CARRIES BOTH NARROWS, in the order they scope: whose, then when. Each releases on its own,
 * because they compose (§32) — «my Friday» is two filters and one row.
 */

/* ═══ THE DATE PICKER IS ITS OWN CONTROL (FEED-IA §75.1) ══════════════════════════════════════
 * «Not by tapping the actual date dividers bro lol.» — «A real control owns picking the day; the
 * dividers are dividers.»
 *
 * WHAT WAS WRONG. The day's name in the river WAS the control: tapping the divider narrowed, and
 * inside the narrow the same divider opened a calendar, flanked by two chevrons and a release. So
 * a section header — the loudest, most-repeated piece of type on the surface, printed once per day
 * — was carrying four different acts, and a person who wanted a particular Tuesday had to first
 * find a day, any day, and press it. A divider divides. It says which rows are underneath it.
 *
 * WHAT THIS IS. Base's own `Datepicker` — the kit's Time section demonstrates it (`in-popover`) —
 * standing in the header block at the river's head, where the other narrows are (§51.4: the row
 * that never scrolls away). It is the ONE thing that changes the day:
 *
 *   +- THE HEAD ROW ---------------------------------------------------------------------------+
 *   | [who] Whose accounts v   ‹ [📅 22/08/2026 ] › ×          ...spacer...      🔍  + New      |
 *   +------------------------------------------------------------------------------------------+
 *   A · THE FIELD    Base `Datepicker`, mini, ghost-styled like the search seat. It TAKES TYPING
 *                    («22/08/2026») and it opens the calendar on focus — a comercial who knows
 *                    which day they want reaches it without hunting the river for it.
 *   B · THE MARKS    the calendar's numbers wear a dot where the day holds orders, so a jump into
 *                    an empty day is a choice rather than an accident (kept from the whisper).
 *   C · ‹ › THE FLIP the day-to-day walk, on the desk, beside the control that owns the day
 *                    (§27's ‹ DATE › grammar, reseated). A phone has the calendar and the room for
 *                    nothing else, so the chevrons stand down there.
 *   D · × ALL DAYS   the release, in the chip row's own vocabulary, exactly where the day chip's
 *                    release already was.
 *   STATES: resting → the field reads «All days» and carries no chip mark, because a chip states an
 *   ACTIVE narrow · picked → the field carries the date, `data-narrow-chip="day"` goes on, the flip
 *   and the release appear.
 *
 * OVERFLOW (§77.2). The field is a FIXED width at each housing and the row is `nowrap`, so nothing
 * here reflows the river or the row: the two chips shorten their own words instead.
 */

/** the day, typed and read the way Spain writes one. It is deliberately NOT Base's default
 *  `yyyy/MM/dd` — which is also what makes Base drop its input mask, so the field takes a plain
 *  «22/08/2026» from a keyboard and from a drive alike. */
const DAY_FORMAT = 'dd/MM/yyyy';

/** what the field measures at each housing. Fixed, because §77.2 says a control in permanent
 *  chrome may not change the geometry of the row it stands in — and the HOUSING is how much room
 *  the row has, of which a phone is only the narrowest case (C30). A 432px river gets the same
 *  field a phone gets; it holds «All days» and «22/08/2026» at either width. */
const PICKER_W = { snug: 96, desk: 146 };

/* IT IS MEMOISED, AND THAT IS A SPEED CLAIM (§32.A). The sweep re-renders this surface on every
 * press of P — thirty-five times in a comercial's three minutes — and a Base `Datepicker` is a far
 * heavier subtree than the chip it replaced: an input, a masked-input wrapper, a popover layer and
 * a calendar's worth of props. None of it depends on which order is open, so it is drawn once per
 * NARROW rather than once per keystroke, and the sweep's budget is unchanged by the control that
 * set it up. (Measured: drive-32's own «186ms a press» is what un-memoised cost.) */
const DayPicker = React.memo(function DayPicker({
  day,
  days,
  today,
  onPick,
  onShift,
}: {
  /** the day the river is narrowed to, or nothing — the river is showing all of them */
  day: string | null;
  /** the days that hold anything — the marks under the calendar's numbers */
  days: Set<string>;
  /** THE MORNING'S OWN TODAY (§18). Base opens its calendar on the machine's month, and this
   *  app's morning is a seeded one — so with nothing picked the calendar landed on a month with
   *  no work in it and no marks under any number. The house's today is what puts it in view. */
  today: string;
  onPick: (day: string | null) => void;
  onShift: (by: number) => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  /* the snug field follows the ROOM, not the device (C30) — read unconditionally, both of them */
  const tight = useTightRiver();
  const snug = phone || tight;

  /** WAIT FOR THE LAYER TO ACTUALLY GO, THEN LET GO OF THE KEYS. Base's popover unmounts on a
   *  transition, so one frame after the day is taken the calendar is still in the DOM and «has it
   *  closed?» cannot be answered yet. This asks on every frame until it can, and gives up after
   *  half a second — which is the honest shape of «when the control is finished», with a ceiling
   *  so a calendar left standing (the typed path) never blurs anything. */
  const letGo = React.useCallback(() => {
    let frames = 0;
    const step = () => {
      if (window.document.querySelector('[data-testid="day-calendar"]')) {
        if (frames++ < 30) window.requestAnimationFrame(step);
        return;
      }
      (window.document.activeElement as HTMLElement | null)?.blur();
    };
    window.requestAnimationFrame(step);
  }, []);

  const flip = (by: number, testid: string, label: string, mark: React.ReactNode) => (
    <StatefulTooltip content={label} placement={TOOLTIP_PLACEMENT.top} showArrow overrides={OVER_THE_CHROME}>
      <Button
        kind={KIND.tertiary}
        size={SIZE.mini}
        shape={SHAPE.circle}
        data-testid={testid}
        aria-label={label}
        overrides={{ BaseButton: { style: { flex: '0 0 auto' } } }}
        onClick={() => onShift(by)}
      >
        {mark}
      </Button>
    </StatefulTooltip>
  );

  return (
    <span
      data-testid="day-picker"
      data-day={day ?? 'all'}
      /* A CHIP MARKS AN ACTIVE NARROW. The control is on the row at all times; it becomes one of
         the row's chips only while it is actually narrowing something (§51.4, §51.25). */
      {...(day ? { 'data-narrow-chip': 'day' } : null)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale200,
        flex: '0 0 auto',
        minWidth: 0,
      }}
    >
      {/* AND THE WALK IS A ROOMY-DESK LUXURY TOO. «A phone has the calendar and the room for
          nothing else» is an argument about ROOM, and a 432px river has no more of it than a
          phone: two 24px chevrons there would push the row past its own edge (C30). */}
      {day && !snug && flip(-1, 'narrow-prev', 'The day before', <span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Glyph id="caret" size={STEP.small} /></span>)}

      <span style={{ display: 'inline-flex', width: snug ? PICKER_W.snug : PICKER_W.desk, flex: '0 0 auto' }}>
        <Datepicker
          value={day ? dayFromId(day) : null}
          highlightedDate={dayFromId(day ?? today)}
          onChange={({ date }) => {
            const one = Array.isArray(date) ? date[0] : date;
            onPick(one ? dayIdOf(one) : null);
            /* ── AND A CONTROL THAT IS FINISHED HANDS THE KEYBOARD BACK (§32.A) ─────────────
               THE FIND, off drive-32's own sweep: the P / ← → loop stands down while anything is
               focused or any layer is open — correctly, because typing «pescado» into a field may
               not print four albaranes. Base's calendar puts the caret BACK in the field as it
               closes, so a comercial who narrowed to their Friday and pressed P got nothing at
               all: the control that set up the sweep had disarmed it.
               IT LETS GO ONLY WHERE IT IS ACTUALLY DONE. On the next frame, if this picker's own
               calendar has gone, the day was taken and the keys are the river's. A calendar still
               standing is the control still being used — typing a date leaves it open on the
               month — and it keeps them. */
            letGo();
          }}
          formatString={DAY_FORMAT}
          mask={null}
          size={INPUT_SIZE.mini}
          placeholder="All days"
          aria-label="The day the river shows"
          /* Base's calendar draws its week at 416px, which is wider than a 390 screen — the same
             finding the whisper's calendar made, carried across with the control (§51.4). */
          density={phone ? DENSITY.high : DENSITY.default}
          /* THE MARKS ARE THE DAYS THAT HOLD ORDERS. A jump into an empty day is a jump nobody
             meant to make, so the calendar says where the work is before the finger lands — and an
             empty day stays reachable, because a day with nothing on it is a real day. */
          dateLabel={(d: Date) =>
            days.has(dayIdOf(d)) ? (
              <span
                aria-label="has orders"
                style={{
                  display: 'block',
                  width: 4,
                  height: 4,
                  margin: '0 auto',
                  borderRadius: '50%',
                  background: 'currentColor',
                }}
              />
            ) : null
          }
          overrides={{
            /* THE SAME LAYER STEP EVERY MENU ON THIS SURFACE TAKES — a calendar opening downward
               out of the header block would otherwise paint under the frame's own bar. */
            Popover: { props: { overrides: { Body: { style: { zIndex: OVER_THE_CHROME_LAYER } } } } },
            CalendarContainer: {
              props: { 'data-testid': 'day-calendar' },
              style: { maxWidth: '100vw', boxSizing: 'border-box' },
            },
            Input: {
              props: {
                /* THE MARK IS A ROOMY-DESK LUXURY (§77.2, measured at 390 and again at 1280).
                   The row is `nowrap` and holds four things; the calendar glyph costs about
                   twenty-eight pixels, and where the row is short those pixels are the difference
                   between «All days» and «All day» — a control's own label cut in half, which
                   reads as broken rather than as tight. It was keyed to the DEVICE and came back
                   on a 1280 desk, where the field is the phone's and the mark was the desk's; it
                   is keyed to the ROOM now, like everything else on this row (C30). */
                startEnhancer: snug ? undefined : <Glyph id="days" size={STEP.small} />,
                /* A GHOST FIELD, THE SEARCH SEAT'S OWN (§35.1). Base's Input rests on
                   `backgroundSecondary`, which is a box; a control in permanent chrome over three
                   hundred rows is barely there until it holds something. */
                overrides: {
                  Root: {
                    style: {
                      backgroundColor: theme.colors.backgroundPrimary,
                      borderTopWidth: '1px',
                      borderRightWidth: '1px',
                      borderBottomWidth: '1px',
                      borderLeftWidth: '1px',
                      minWidth: 0,
                    },
                  },
                  Input: {
                    /* the field itself carries the name, because a testid on the wrapper is not
                       the thing a person types into */
                    props: { 'data-testid': 'narrow-date' },
                    style: {
                      backgroundColor: 'transparent',
                      paddingLeft: theme.sizing.scale200,
                      paddingRight: theme.sizing.scale200,
                    },
                  },
                  StartEnhancer: {
                    style: {
                      backgroundColor: 'transparent',
                      paddingLeft: theme.sizing.scale300,
                      paddingRight: theme.sizing.scale200,
                      color: theme.colors.contentTertiary,
                    },
                  },
                },
              },
            },
          }}
        />
      </span>

      {day && !snug && flip(1, 'narrow-next', 'The day after', <span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Glyph id="caret" size={STEP.small} /></span>)}

      {day && (
        <Button
          kind={KIND.tertiary}
          size={SIZE.mini}
          shape={SHAPE.circle}
          data-testid="narrows-release-day"
          aria-label="All days"
          overrides={{ BaseButton: { style: { flex: '0 0 auto' } } }}
          onClick={() => onPick(null)}
        >
          ×
        </Button>
      )}
    </span>
  );
});

function ScopeLine({
  holders,
  mine,
  day,
  days,
  today,
  onPick,
  onRelease,
  onPickDay,
  onShiftDay,
  onNew,
  search,
  campaigns,
}: {
  holders: Holder[];
  mine: string | null;
  /** the day the river is narrowed to, or nothing (§27) — the picker's own value */
  day: string | null;
  /** the days that hold anything, for the calendar's marks */
  days: Set<string>;
  /** the morning's own today, so the calendar opens on the month the work is in */
  today: string;
  onPick: (id: string) => void;
  onRelease: () => void;
  onPickDay: (day: string | null) => void;
  onShiftDay: (by: number) => void;
  /** §66.3 — the door back to the composer, at every scroll position */
  onNew?: () => void;
  /** the river's own search seat, which rides this line because this is where the river's scope is
   *  set (§35.1) — one row that says what you are looking at and what you are looking for */
  search: React.ReactNode;
  /** §249's Campaigns act. It is a FUNCTION of the room rather than a node, because this line is
   *  the one authority on whether the row has space for a word (`compact`), exactly as the New
   *  delivery note below it already asks. */
  campaigns?: (compact: boolean) => React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  /* the mark-only form is a matter of ROOM, and a phone is only the narrowest case of it (C30).
     Both are read unconditionally — a hook behind a `||` is a hook that stops being called. */
  const tight = useTightRiver();
  const compact = phone || tight;
  const held = holders.find((h) => h.id === mine);
  /* W8 measured this at 80×24 at 390 — the one control on the river's head that says WHOSE
     accounts are showing, and the smallest thing on the row it stands in (INTX-12 · E193.14). */
  const scopeFloor = usePhoneFloorHeight();

  const doorStyle: React.CSSProperties = {
    display: 'flex',
    /* E193.14 · INTX-12: on a phone this door takes the 44px floor, and a floor with a baseline
       in it pins the words to the ceiling — so the phone centres them and the desk keeps the
       baseline it shares with the rest of the scope line. */
    alignItems: scopeFloor.minHeight ? 'center' : 'baseline',
    ...scopeFloor,
    gap: theme.sizing.scale300,
    minWidth: 0,
    /* it shortens rather than pushing the row wider — the chips share one line (see the row below).
       THE RESTING DOOR OVERRIDES THIS AND IS PINNED; `door`'s own comment carries the reason. */
    flex: '0 1 auto',
    overflow: 'hidden',
    padding: `${theme.sizing.scale100} ${theme.sizing.scale200}`,
    margin: `0 -${theme.sizing.scale200}`,
    border: 'none',
    borderRadius: theme.borders.radius200,
    background: 'transparent',
    color: theme.colors.contentPrimary,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  };

  /* ONE MENU, WHICHEVER STATE THE LINE IS IN — the register of the eight, each one already counted
     so the person never does the sum. It is a closed register read out of the house's own book
     (§12); nothing on this screen types a name. */
  /* ── AND THE RESTING DOOR IS PINNED, WHICH IS §51.4 ITSELF (C30) ───────────────────────────
   * «Search is search, and WHOSE ACCOUNTS is visible AT ALL TIMES.» On a `nowrap` row where every
   * other control is fixed, this door was the only thing that could shrink — so it absorbed every
   * pixel the row was short, and at 1280 it rendered 22px wide against a 60px label: the words
   * gone, a person glyph left, and no way to read what the river is scoped to. `pinned` is that
   * law expressed as a flex value. A HELD scope is not pinned and that is a different fact: it
   * carries a customer's NAME, which ellipsises the way every name in this app does, and a count
   * that goes first. What yields instead is the one control on this row that can lose its word
   * without losing its meaning — the New albarán, at the end of the line. */
  const door = (inner: React.ReactNode, pinned = false) => (
    <StatefulPopover
      placement={PLACEMENT.bottomLeft}
      triggerType={TRIGGER_TYPE.click}
      /* IT HAS TO CLEAR THE CHROME. Base mounts a layer at the end of the body with no z-index of
         its own, so it paints UNDER anything positioned above it — and this surface's band sits at
         4 with the frame's bar at 7. A menu opening downward from the head of the river lands
         squarely on the band, where it is visible and unpressable, which is the worst of both.
         12 is the step this app already gives a layer that must clear everything (the Combobox's
         own list, the printer's menu). */
      overrides={{ Body: { style: { zIndex: OVER_THE_CHROME_LAYER } } }}
      content={({ close }) => (
        <ScopeMenu holders={holders} onPick={onPick} close={close} />
      )}
    >
      <button
        type="button"
        data-testid="scope-pick"
        aria-label={held ? `Owner — ${held.name}` : 'Owner'}
        style={pinned ? { ...doorStyle, flex: '0 0 auto' } : doorStyle}
      >
        {inner}
      </button>
    </StatefulPopover>
  );

  return (
    <div
      data-testid="scope-line"
      data-scope={mine ?? 'all'}
      data-narrow={day ?? 'none'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        /* ONE ROW, AT EVERY WIDTH (§51.4: «two slim sticky rows max»). Wrapping, a 390px phone with
           both narrows on grew this to ninety-two pixels of permanent chrome over the river — which
           is a header block deciding for itself how much of the screen it takes. Nothing wraps: the
           two chips share what there is and shorten their words, and the controls never move,
           because a release that walks off the edge is worse than a name that ellipsises. */
        flexWrap: 'nowrap',
        /* on the river's own gutter, so the who-door stands on the same left edge as the day's name
           and three hundred customers' names (§33) — and SLIM, because a row that is on the screen
           at every scroll position is chrome and chrome does not get a section's air. */
        padding: `${theme.sizing.scale400} ${theme.sizing[GUTTER]}`,
        minWidth: 0,
      }}
    >
      {holders.length > 0 &&
        (held ? (
          <span data-narrow-chip="who" style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0, flex: '0 1 auto' }}>
            {door(
              <>
                <span style={{ display: 'inline-flex', alignSelf: 'center' }}>
                  <Glyph id="who" size={STEP.small} />
                </span>
                {/* THE NAME IS THE THING, AND THE BOOK'S SIZE IS THE FACT ABOUT IT — the whisper's
                    own two steps, so a person who has read one day header can read this line.
                    IT IS A LABEL, NOT A HEADING (§51.4). At `LabelLarge` this was a panel's name
                    riding a strip of chrome that now never leaves the screen — the loudest thing on
                    the surface after the day itself, said about a filter. */}
                <span style={{ ...theme.typography.LabelMedium, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {held.name}
                </span>
                {/* THE BOOK'S SIZE IS THE FIRST THING TO GO when the row is tight: it is the fact
                    about the narrow, and the narrow's own NAME is the identity (§51.4). */}
                <span
                  style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden' }}
                >
                  · {held.customers} {plural(held.customers, 'customer')}
                </span>
              </>,
            )}
            <Button
              kind={KIND.tertiary}
              size={SIZE.mini}
              shape={SHAPE.circle}
              data-testid="scope-release"
              aria-label={`Release ${held.name}`}
              overrides={{ BaseButton: { style: { flex: '0 0 auto' } } }}
              onClick={onRelease}
            >
              ×
            </Button>
          </span>
        ) : (
          door(
            <>
              {/* THE MARK GOES BEFORE THE WORDS DO (§25.5, C30). At rest this door says the same
                  thing twice — a person glyph and «Whose accounts» — and on a row that has to
                  give something up, the half that repeats the other half is what goes. The caret
                  stays because it is the only part that says this OPENS, and the label stays
                  because §51.4 says it is visible at all times. A held scope keeps its mark: there
                  the glyph is standing in front of a customer's NAME, which it does not repeat. */}
              {!compact && (
                <span style={{ display: 'inline-flex', alignSelf: 'center' }}>
                  <Glyph id="who" size={STEP.small} />
                </span>
              )}
              <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Owner
              </span>
              <span style={{ display: 'inline-flex', alignSelf: 'center', color: theme.colors.contentTertiary }}>
                <Glyph id="caret" size={STEP.small} />
              </span>
            </>,
            true,
          )
        ))}

      {/* AND THE DAY IS PICKED HERE, BY A CONTROL (§75.1, §27, §51.4). The whisper that used to set
          it scrolls away with the river; this line does not — so the one thing that owns the day
          stands where the other narrows are, at every scroll position, with its own release. */}
      <DayPicker day={day} days={days} today={today} onPick={onPickDay} onShift={onShiftDay} />

      {/* THE SEARCH TAKES THE END OF THE LINE THAT SETS THE SCOPE (§35.1). Whose accounts, and then
          what you are looking for inside them: two narrows, one row, and the second reads as an
          extension of the first rather than as a toolbar over the river. The spacer is what keeps
          the seat on the right edge at every width, and it collapses to nothing on a phone where
          the row has already wrapped. */}
      <span style={{ flex: 1, minWidth: 0 }} />
      {search}
      {/* ── AND CAMPAIGNS STANDS BESIDE IT (FEED-IA §249, brief B) ───────────────────────────
          «Button: "Campaigns" (top nav, next to "Orders" and "Money").» Cedar has no top nav of
          doors — the rail is the navigation — so the act stands where the river's own acts stand:
          the one row this surface pins to the top of the pane, beside the search seat and before
          the New delivery note. It takes the same two forms as its neighbour: the word on a desk,
          the mark alone where the row is short, with the label kept on the control. */}
      {campaigns?.(compact)}
      {/* ── THE NEW ALBARÁN, ON THE HEADER (FEED-IA §66.3) ───────────────────────────────────
          «That new albarán button would be too next to the export shit I guess.» The export
          centre is the SHELL's — it rides the frame's own top bar, which no area package may
          reach — so the control stands at the end of the one row this surface pins to the top of
          the pane (§51.4). It is beside the search rather than beside the export mark, and that
          is the only clause of §66.3 this package cannot satisfy literally: FLAGGED, and the move
          is one line in the shell's frame whenever that side is opened.
          IT IS SECONDARY, NOT PRIMARY. The loud thing on this surface is always the work in front
          of the person; making a new document is a thing they choose to do, and a filled button in
          permanent chrome would outshout three hundred rows all morning (§25.5). */}
      {/* AND WHERE THE ROW IS SHORT IT IS THE MARK ALONE (§51.4, §77.2, C30). The row is `nowrap`
          and it carries a real date control as well as the two narrows — so the widest thing on it
          that can lose its word without losing its meaning does. «+» is the established vocabulary
          for making one, the search seat beside it already reads as a mark, and «Whose accounts»
          keeps the word it is not allowed to lose. The label stays on the control for a screen
          reader and for a pointer.
          IT WAS 390 ONLY, AND THAT WAS THE DEFECT. A 1280 desk gives this row 336px of usable
          width against 418px of controls, so the pixels came out of the one thing pinned by law;
          the compact form now follows the ROOM rather than the device. */}
      {onNew && (
        <span style={{ flex: '0 0 auto' }} title={compact ? 'New delivery note' : undefined}>
          <Button
            kind={KIND.secondary}
            size={SIZE.mini}
            shape={compact ? SHAPE.circle : SHAPE.default}
            data-testid="new-albaran"
            aria-label="New delivery note"
            startEnhancer={compact ? undefined : <Glyph id="plus" size={STEP.small} />}
            onClick={onNew}
            overrides={{ BaseButton: { style: { whiteSpace: 'nowrap' } } }}
          >
            {compact ? <Glyph id="plus" size={STEP.small} /> : 'New delivery note'}
          </Button>
        </span>
      )}
    </div>
  );
}

/* ── THE NARROWS BAR IS GONE, AND §51.4 IS WHY ───────────────────────────────────────────────
 * It existed for one reason: the scope line and the narrowed day's whisper both scrolled away, so
 * something had to re-say the narrows once the things that said them had left. «Search is search,
 * and WHOSE ACCOUNTS is visible AT ALL TIMES» (§51.4) answers that at the source — the header block
 * never leaves the screen and carries both chips itself, so a second bar re-saying them would be
 * exactly the stacked chrome the founder is asking us to stop building. With it went the two
 * IntersectionObservers that watched for either line going off the top, and the band's own repeat
 * of the comercial's name («band-scope»), which had the same and only reason to exist.
 */

/* ── THE DAY'S PAPER (FEED-IA §20, §25.1, §28, §29) ───────────────────────────────────────────
 * A day prints two different products and the surface may never blur them: ONE SHEET — the
 * delivery list the van walks — and N ALBARANES, one per crate. Both controls are the dual flush
 * (Peter, 2026-08-24): the big column IS the act and never routes through a preview, the slim eye
 * beside it opens the paper for whoever wants to look first.
 *
 * ═══ THE BIG COLUMN CARRIES ITS OWN NUMBER (§29.1) ══════════════════════════════════════════
 * «Print all 5 is DEAD — it makes the person do the math. The least mental tracking wins.» So the
 * albaranes control says «Print 3 new» and pressing it enqueues exactly those three. NEW means
 * arrived OR changed since paper last came out (§29.2), which is one number absorbing both cases —
 * a sale whose lines moved after it printed is owed paper again and re-enters the count on its own.
 * With nothing owed the control stands quiet and says «All printed».
 *
 * ═══ AND THE RE-PRINT LIVES ONE LEVEL DOWN (§29.4) ══════════════════════════════════════════
 * Re-printing a whole day is rare and it is not the work, so it is a small attached menu worded as
 * what it is — «Print all 5 again» — where it cannot be mistaken for the day's job.
 *
 * ═══ AND THE REPEATED ACT IS AN ICON (§30) ══════════════════════════════════════════════════
 * «The more icons used with determination, the better. Base already has good hover labels. People
 * get used to icons.» Printing the day's new albaranes happens on every day of the river, so it is
 * exactly the repeating mechanical act that earns a mark instead of a label: ⎙ carrying its live
 * number, with Base's own tooltip saying the whole sentence on hover and the same sentence on the
 * aria for everybody else. DETERMINATION: ⎙ is always print, the eye is always look, and the words
 * survive only where they are the distinguishing content — «Print the day's sheet» keeps its words
 * because two ⎙ marks side by side would otherwise be one mark with two meanings, and «All printed»
 * keeps its words because it is a state rather than an act.
 *
 * ═══ AND BOTH CONTROLS ARE THE SAME OBJECT (§31.4 — the seam, closed) ══════════════════════
 * This file used to hand-roll the albaranes lockup because `PrintFlush` had two columns and no room
 * for §28's scope menu. That was a second print control with its own radii, its own seam colour and
 * a literal «▾» where the app has a glyph — two objects doing one job, which is how a vocabulary
 * stops being one. `PrintFlush` now carries the `menu` slot, so BOTH controls on this row are the
 * app's one print object and the re-print lives in its middle column.
 */

/* ═══ AND THE RAIL BECAME TWO SHORTCUTS (FEED-IA §130, superseding §129.1's shape) ═══════════
 * «Actually those prints i think should be shortcuts in each day's thing in the scrolling list of
 * orders. Where it's "print remaining albaranes" and "print remaining packing list" and with an eye
 * icon AS WELL AS a down facing chevron next to it which opens a single option dropdown that says
 * "Print all today's orders" and "print all today's packing sheet".»
 *
 * ── WHAT DIED HERE ────────────────────────────────────────────────────────────────────────────
 * THE THREE-GROUP RAIL. A day's head carried three dual flushes with two hairlines between them —
 * albaranes · the van's sheet · the bay's lists — and at 390 the last of them was cut off at the
 * right edge, which is the screenshot §129 opens with. Three groups was one group too many for the
 * width the work is actually done at, and the day's SHEET is not a shortcut: it is a browsing act,
 * so it lives in the export centre with the date list (§129.2) where there is room to choose.
 *
 * ── AND REMAINING IS THE PRIMARY FACE (§130.1) ────────────────────────────────────────────────
 * «Just the ones I haven't already printed» was the third option of §129.1's dropdown; here it
 * graduates to THE ACT. What is left to do is the morning's own question, so it is the face, with
 * its true count read off the fold — `wantsPaper` for the crates, the bench's own tick for the bay
 * — and never a number this component computes for itself. What has ALREADY printed is a fold fact
 * too, and it is the reason the count falls: nothing on this row states it a second time.
 *
 * ── THE ALL VARIANT IS ONE LINE DOWN (§129.1, §29.4) ──────────────────────────────────────────
 * Printing a whole day again is rare and it is not the work, so it is the chevron's single option,
 * worded as what it is. One option in a menu is not a menu that failed: it is the SECOND act of a
 * two-act control, and it keeps the first act's face free of a choice nobody makes at 06:40.
 *
 * ── AND BOTH WEAR THE PRINTER (§130.2) ────────────────────────────────────────────────────────
 * «Actually have it with the print icon, not other icon, so people get it and the text is what
 * tells them.» The van and the bay's marks die on this row. §54.4's rule — the mark says the
 * destination — was answering a question nobody at a day's head is asking: both of these presses
 * go to the printer, and what a person has to tell apart is WHICH PAPER, which is what the words
 * are for. The marks stand where the destinations differ: inside the export centre's rails.
 *
 * ── AND WHY BOTH DOORS EXIST (§130.3, his words) ──────────────────────────────────────────────
 * «This gives speed in the zoomed in variant but then nice usability in the export centre.» Two
 * doors, one act, each tuned to its distance: the river's head is the FAST path taken a hundred
 * times a morning without reading, and the export centre is the deliberate one where the day is
 * chosen off a list. Neither is a copy of the other — they are the same act at two speeds.
 */
/* ── AND EACH SEAT IS A TEMPLATE THE HOUSE CHOSE (FEED-IA §202.5 · THE-OUTPUTS-SPEC OUT-03) ──
 * «Also, the ones in the daily list should be also configurable. they can have up to two buttons,
 * and they can i guess toggle which two via the export. we ship with the albaran and packing by
 * default. if they hit preview that takes them literally to the same place where they can edit the
 * template.»
 *
 * WHAT WAS HARD-CODED HERE: two controls and both of their documents, named in this file — the
 * albaranes at one call site and the packing lists at the next. A house could not change either.
 *
 * WHAT STANDS HERE NOW: `templateSeats(templates)` — seat 0 and seat 1 off the one store the
 * library writes (OUT-01.8). A fresh house holds «Delivery notes» in seat 0 and «Packing sheets»
 * in seat 1, which is the pair that shipped, so the first morning is unchanged. A seat taken in
 * the export centre changes this row on the same frame, because the store publishes its writes.
 *
 * AND THE TILE NAMES ITS TEMPLATE. Line one was the paper's fixed word — «Albaranes» — and it is
 * the TEMPLATE's name now, because a seat a house chose is a seat a house has to be able to read
 * back. Line two is the work, in E196.40's own measured anatomy: the mark and the count where
 * paper is owed, the state in its own words where the press has stood down.
 */
type DaySeat = {
  /** the template standing in this seat */
  template: Template;
  /** what it still owes paper for on this day, `0` where the press stands down */
  count: number;
  /** the words line two takes when there is no count — the state, never an absence */
  state: string;
  /** Opens the intended output with its editable batch boundary. */
  onPrint?: () => void;
  /** `day-albaranes-<day>` · `day-packing-<day>` · `day-sheet-<day>` · `day-output-<day>` */
  testid: string;
  /** WHAT THE SPOKEN LINE IS ABOUT — the day, its round's size and this template. The COUNT is
   *  deliberately outside it: a live region that treats every number as a new subject says nothing
   *  when the number moves, which is the one moment it exists for (§H11). */
  about: string;
};

function DayPaper({ day, seats, onExportCentre }: {
  day: string;
  /** up to two, in seat order; a house may hold one or none */
  seats: DaySeat[];
  /** where the day's papers are chosen, for a day that holds none */
  onExportCentre: () => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();

  /* ── A DAY WITH NO SEATS SAYS WHERE ITS PAPERS ARE CHOSEN (OUT-03.2) ──────────────────────
     «A day may run with one button or with none», and a row that simply disappears leaves a
     person who took both templates off the day with nowhere to put them back from. So the seat
     states the next act and offers it (`better-writing` · EMPTY STATES POINT FORWARD), in the
     export centre's own words, at the hand's own 44px. */
  if (seats.length === 0) {
    return (
      /* AND IT STANDS WHERE THE TILES STAND. On a phone the seat takes the day's whole width and
         the control sits on the LEADING edge, on the same left edge as the day's name and three
         hundred customers' names (`better-layout` · ALIGN TO SHARED EDGES) — read off the 360
         frame, where a lone control in the trailing seat drifted to the right edge under the day's
         name and read as an orphan. The desk keeps the seat its two lockups stand in. */
      <span data-day-paper={day} data-seats="0" style={phone
        ? { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flex: '1 1 100%', width: '100%', minWidth: 0, maxWidth: '100%' }
        : { display: 'inline-flex', alignItems: 'center', flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}>
        <Button
          kind={KIND.tertiary}
          size={SIZE.mini}
          data-testid={`day-papers-${day}`}
          onClick={onExportCentre}
          overrides={{ BaseButton: { style: { minHeight: '44px', minWidth: '44px' } } }}
          startEnhancer={<Glyph id="print" size={STEP.small} />}
        >
          Choose this day's papers
        </Button>
      </span>
    );
  }

  return (
    /* ── AND THE SEATS WRAP RATHER THAN CLIP (FEED-IA §129.5) ────────────────────────────────
       The rail this replaced was `flex: 0 0 auto`, so at 390 it kept its content width inside a
       header that could not hold it and the last control was cut off at the right edge — which is
       the screenshot §129 opens with. A seat that may not shrink can never wrap: `0 1 auto` with
       `minWidth: 0` lets the seats take a line each on a desk that runs out of room.
       ── AND ON A PHONE THEY SHARE ONE ROW (FEED-IA §199) ─────────────────────────────────────
       «They should be a double row, with the icon and the quantity left to print below, so that
       they're thick but next to each other rather than stacked and thin.» So on a phone this seat
       takes the day's whole width and hands each tile an equal share of it — `1 1 0` on both, a
       step between them, no wrap. A day holding ONE seat gives that tile the whole row, which is
       the same rule arriving at a different answer rather than a second rule. */
    <span
      data-day-paper={day}
      data-seats={seats.length}
      style={phone
        ? { display: 'flex', alignItems: 'stretch', gap: theme.sizing.scale300, flexWrap: 'nowrap', flex: '1 1 100%', width: '100%', minWidth: 0, maxWidth: '100%' }
        : { display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, flexWrap: 'wrap', flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}
    >
      {seats.map((seat) => {
        const owed = seat.count > 0;
        /* ONE SENTENCE, TWO POSTURES. The tile splits it — the template's name on line one, the
           work on line two — and the desk keeps it whole on the single line it was drawn with.
           The aria and the spoken line take the joined form on both, so what a screen reader
           hears is what the eye reads (§199's own rule, carried onto the seats). */
        const said = owed ? `${seat.template.name} · ${seat.count} left` : `${seat.template.name} · ${seat.state}`;
        return (
          <React.Fragment key={seat.template.id}>
            {/* ── AND THE COUNT SAYS ITSELF WHEN THE PRESS MOVES IT (the a11y register's find, §H11) ──
                «Print 12 new» → «All printed», and the control stands down in the same frame, so
                focus leaves a disabled button for the body. A sighted person watched the pile
                empty — §61.2's win, felt rather than said — and a person on a screen reader was
                told nothing at all. ONE region per seat, empty until that seat's own number moves,
                so a scroll through a week is silent and a press says one sentence.

                AND THE SUBJECT IS THE DAY *AND ITS ROUND'S SIZE* (caught by the witness at 1600:
                picking a comercial re-counted every day at once and four regions spoke for one
                press). Narrowing the river changes what a person is LOOKING at, so every day
                becomes a new subject and all of them go quiet; a print press leaves the round
                exactly the size it was and moves only the number owed. */}
            <Aloud said={said} about={seat.about} testid={`${seat.testid}-aloud`} />
            <Button
              kind={KIND.secondary}
              size={SIZE.compact}
              data-testid={seat.testid}
              aria-label={owed ? `Prepare ${seat.count} · ${seat.template.name}` : `Open ${seat.template.name} · ${seat.state}`}
              disabled={!seat.onPrint}
              onClick={() => seat.onPrint?.()}
              startEnhancer={<Glyph id={PAPER_KIND_OF[seat.template.category] ? 'print' : seat.template.category === 'file' ? 'file' : 'email'} size={STEP.small} />}
              overrides={{ BaseButton: { style: {
                minHeight: phone ? '64px' : '44px', minWidth: '44px',
                flex: phone ? '1 1 0' : undefined, justifyContent: 'flex-start',
                paddingLeft: theme.sizing.scale400, paddingRight: theme.sizing.scale400,
              } } }}
            >
              <span style={{ display: 'grid', gap: theme.sizing.scale100, textAlign: 'left', minWidth: 0 }}>
                {/* LINE ONE IS THE TEMPLATE'S NAME, ON BOTH SEATS (THE-OUTPUTS-SPEC OUT-03.3).
                    The packing seat drew the literal «Packing list» for its category whatever the
                    house had called its own template, so a house that seated «Bay list» read its
                    own name in the seat's `aria-label` and the spoken line above and the category's
                    word in the seat itself. One record, one name, three places. */}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seat.template.name}</span>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{owed ? `${seat.count} remaining` : seat.state}</span>
              </span>
            </Button>
          </React.Fragment>
        );
      })}
    </span>
  );
}

/* ── THE WHISPER, AND THE NARROW (§4.2, §18, §25.1, §27) ──────────────────────────────────────
 * A day separator is a line of type and a hairline, and it carries the aggregate the horizontal
 * strip used to carry: how many, how many still want a hand, how much is already record, and what
 * the day comes to (§1 — the strip's job moved INTO the headers).
 *
 * IT IS ALSO THE ZOOM (§27). Tapping the DATE narrows the river to that day; the narrowed header is
 * the same whisper with the old day view's ‹ DATE › grammar on it — chevrons either side, the date
 * opening the mini calendar to jump anywhere, and one obvious release back to every day. The taps
 * are unambiguous by construction: the date is the only button in the day's own line, the rows are
 * not part of it, and the paper controls print.
 *
 * THE TICKS ARE GONE FROM HERE (§26.1). «Nobody marks off. They just DO it.» So no picked-count and
 * no tick affordance rides a whisper: the day's progress is stated in the river's own binary —
 * closed or open — which is a fact the printer writes rather than a ceremony a person performs.
 */

/* ── AND THE DIVIDER IS A DIVIDER (FEED-IA §75.1) ─────────────────────────────────────────────
 * «Not by tapping the actual date dividers bro lol.» Every act this header used to carry — narrow
 * to this day, open a calendar, walk a day back or forward, release — has moved to `DayPicker` at
 * the river's head, which is a control and looks like one. What is left here is what a divider is
 * for: the day's name, at the surface's loudest step, and what the day comes to. NOTHING IN THIS
 * COMPONENT IS PRESSABLE except the day's own paper control, which is about paper and not about
 * which day the river is showing.
 */
function DayWhisper({
  group,
  today,
  narrowed,
  cleared,
  paper,
  net,
  under,
  archived = false,
}: {
  group: DayGroup;
  archived?: boolean;
  today: string;
  narrowed: boolean;
  /** the day's last owed thing has just gone quiet — the table cleared while they watched (§33.2) */
  cleared: boolean;
  paper: React.ReactNode;
  /** WHAT ROCOTO DID TO THIS DAY ON ITS OWN, and the six checks one press behind it (§32.B,
   *  §111.1) — the seat the band's own proof line moved into when the band died (§67.6). Every
   *  day carries its own now, because «resolved by default» is an impression the whole river owes. */
  net?: React.ReactNode;
  /** what stands pinned over this scrollport — the header block on a phone — so a day jumped to
   *  lands BELOW the chrome (§51.4) */
  under: number;
}) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const { pricing } = useWorkspaceCapabilities();
  const pricingAvailable = capabilityAvailable('pricing') && pricing;
  const phone = usePhone();
  const still = useStillness();
  const whisperTop = useStickyTop(theme, under);
  const { day, sales, total, closed } = group;
  /** every document of the day owes nothing — the table is clear (§33.2 item 4, canon §15.1) */
  const allClosed = !archived && sales.length > 0 && closed === sales.length;
  /* DAYS SPEAK THEIR NEARNESS FIRST (§18): Today, Tomorrow and Yesterday LEAD their headers — the
     relative word is the main thing and the date stands subordinate beside it. Beyond those three
     the weekday name leads, because that is how the trade says a day. */
  const near = nearWordOf(day.id, today);

  /* THE DAY'S NAME, AT THE SURFACE'S LOUDEST STEP (§25.5) — AND IT IS TYPE, NOT A CONTROL (§75.1).
     It names the rows underneath it and does nothing else. */
  const name = (
    <span
      data-day-name={day.id}
      style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, minWidth: 0 }}
    >
      <span style={{ ...theme.typography.HeadingXSmall, whiteSpace: 'nowrap' }}>{near ?? day.label}</span>
      {near && (
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}>
          {day.label}
        </span>
      )}
    </span>
  );

  return (
    <div
      data-day-whisper={day.id}
      data-narrowed={narrowed ? 'yes' : 'no'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale300,
        /* A DAY OPENS LIKE A SECTION, NOT LIKE A LIST ITEM (FEED-IA §33). The air above the day's
           name is what makes the rule under it read as the start of something; and the side gutter
           is the ROW'S gutter, so the day's name and three hundred customers' names stand on one
           left edge instead of four pixels apart.

           ── AND THE PHONE HOLDS A THIRD OF IT (FEED-IA §200.5, Peter, on the river at 390) ────
           «Why is there all of this space above the Monday?» 40px of air, on a screen 844px tall,
           above every day of a scrolling week — the section rule written for a desk and paid for
           in the one place where the surface has no room to give. The GROUPING is what the air was
           for and the grouping survives: 16px above the name against 12px under the rule below it
           still reads as a start (`better-layout` · GROUP WITH SPACE — the gap between groups
           stays larger than the gap inside one), and the desk keeps the section it was drawn as. */
        padding: `${theme.sizing[phone ? PHONE_DAY_AIR : DAY_AIR]} ${theme.sizing[GUTTER]} ${theme.sizing.scale500}`,
        borderBottom: `1px solid ${theme.colors.contentPrimary}`,
        /* THE SETTLE, EXACTLY AS THE BAND'S CARDS SETTLE (§10.2). It lifts for a moment on the
           press that finished the day and lies back down into the stream — one grammar for «that
           just resolved», wherever it happens. */
        boxShadow: cleared ? theme.lighting.shadow500 : 'inset 0 0 0 0 transparent',
        background: cleared ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
        transitionProperty: 'box-shadow, background-color',
        transitionDuration: still ? '0ms' : theme.animation.timing400,
        transitionTimingFunction: theme.animation.easeOutCurve,
        /* A DAY THE BROWSER SCROLLS TO MUST LAND BELOW THE CHROME, not under it. Jumping to a day,
           or tabbing to its date, aligns this whisper with the top of its own scrollport — the
           list pane on the desk (§38), where there is nothing above it, and the page on the phone,
           where the frame's own sticky day bar is sitting. */
        scrollMarginTop: whisperTop,
        minWidth: 0,
      }}
    >
      {/* ONE LINE: THE DAY, AND WHAT IT COMES TO (§75.1). It wraps rather than squeezes, because
          a long weekday beside a five-figure total at 390 has to go somewhere, and the money holds
          the right edge of whichever line it lands on. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
        {name}
        <span data-testid={`day-order-count-${day.id}`} data-order-count={sales.length}
          style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
          {sales.length} {plural(sales.length, 'order')}
        </span>
        <span style={{ flex: 1, minWidth: 0 }} />

        {pricingAvailable && derived.albaran.valued && !allClosed && (
          <span style={{ marginLeft: 'auto', flex: '0 0 auto' }}>
            <Figure value={total} unit="S/" size="compact" />
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale400,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        {allClosed ? (
          <span
            data-testid={`day-cleared-${day.id}`}
            data-cleared="yes"
            style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, flex: '1 1 16ch', minWidth: 0 }}
          >
            {near ?? day.label} is clear · {sales.length} {plural(sales.length, 'delivery note', 'delivery notes')}
            {pricingAvailable && derived.albaran.valued && <> · <Figure value={total} unit="S/" size="compact" /></>}
          </span>
        ) : null}
        {net}
        <span style={{ flex: 1, minWidth: 0 }} />
        {paper}
      </div>
    </div>
  );
}

/* ═══ THE COMPOSER IS THE ALBARÁN — A NASCENT ONE (FEED-IA §74, superseding §66.3's first cut) ══
 * «The new albarán thing is also shit!!!»
 *
 * WHAT WAS WRONG, IN HIS FOUR SENTENCES. It was A FORM: section labels («Whose» · «Which day» ·
 * «The first line»), every customer in the house listed in the pane, ONE line, and a «Start it»
 * button standing between a person and their own document. Four failures, one cause — it was
 * built as a thing that MAKES an albarán instead of being one.
 *
 * ═══ SO IT WEARS THE SHEET'S EXACT IDENTITY (§74.3, §43, §17, §14) ══════════════════════════
 * «It should have the look of a TOP ALBARÁN CARD!!!» One object, one visual identity, everywhere
 * it appears — so this is the SAME popped-out card the sheet draws (radius 400, one hairline,
 * `backgroundPrimary`, `shadow500`, clipped), with the SAME head (the customer at the sheet's
 * largest step, the quiet fact line under it), the SAME lines, the SAME add-a-line organ — it
 * mounts `AddLine` itself, not a copy of it — and the SAME total at the foot, forming as lines go
 * on. NOT ONE SECTION LABEL SURVIVES: a document does not label its own head «Whose».
 *
 * AND THE MOMENT IT HAS A NAME IT IS THE SHEET. `isDraft` is «no customer yet», so naming one
 * hands the pane to `SaleDetail` for that same id. Nothing converts and nothing is announced,
 * because the two drawings are one drawing: the person sees the head they were typing in stay
 * exactly where it was (§59.5, evidence by design).
 *
 * ═══ THE CUSTOMER IS A FIELD (§74.2, §45.1) ═════════════════════════════════════════════════
 * «Why do I see all the customers instead of a normal field where I type the customer» — so the
 * name seat IS the field, at the document's own largest step, and customers appear ONLY as
 * suggestions UNDER the typing, never as a list filling the pane. It searches the whole book and
 * cuts after, which is §45.1's own lesson; ↑↓ walk, Enter takes, Esc puts them away.
 *
 * ═══ TYPING BIRTHS THE DRAFT (§74.4, §31.3, §59) ════════════════════════════════════════════
 * «Maybe the first step thing is silly — I think once they type it should start a draft.» There
 * is no button and no step: the FIRST KEYSTROKE writes `new` to the ledger and the document
 * exists from that character on. Walking away mid-word leaves an honest draft carrying the
 * half-word (`draftSaid`); the dropdown brings it back.
 *
 * ═══ AND THE EMPTY ONE IS GHOSTED, NOT BLANK (FEED-IA §83.1) ════════════════════════════════
 * «This has to have the structure below ghosted. Looks so shit like this empty bro. Just require
 * name first. Come on, how would Notion do it…»
 *
 * WHAT WAS WRONG, EXACTLY. The card rendered as a REAL DOCUMENT THAT WAS EMPTY: a head with a
 * placeholder, no rows at all, and a foot stating «0 lines · 0,00 €» in the document's largest
 * figure step. Every one of those is a true statement about nothing, and together they read as a
 * broken screen rather than a new one. «0,00 €» at 24px is the loudest thing on a card whose whole
 * subject has not been named yet.
 *
 * WHAT NOTION DOES, AND WHAT THIS DID. It draws the SHAPE of the page before the page exists: the
 * ask that leads, and under it the structure to come. So the name field leads and takes the caret,
 * and beneath it stands what is coming.
 *
 * ═══ ⚠ AND THE GREY STACK IS REPEALED (FEED-IA §200.4, Peter, 2026-09-04) ═══════════════════
 * «With the Copilot open the new albarán's frame («Whose albarán») filled the column with skeleton
 * rows and grey buttons; compact it to the doors and one sentence until lines exist.»
 *
 * §83.1's answer was right for the card it was written against — a head with a placeholder and
 * NOTHING under it. That card is gone. The four intake doors stand between the name and the lines
 * now (§196.5, «Take photo · Upload file · Paste · Scan code»), so the structure a person is
 * looking for is already on the screen, in controls they can press. Three grey rows, a grey total
 * and a grey dock UNDER those doors stopped reading as «a document comes here» and started reading
 * as «this document is loading» — which is the one meaning `src/rocoto/ghost` exists to avoid —
 * and beside a 416px Copilot they filled the column with a picture of nothing.
 *
 * SO WHAT IS COMING IS SAID IN WORDS, ONCE: «Lines appear here once the paper is read.» The foot
 * states the count it always stated, at the same quiet step, and no money stands over an unnamed
 * card — «0,00 €» in the document's largest step is §83.1's own objection and it still stands. The
 * frame grows when there is something to grow for.
 *
 * THE PHONE'S ENTRY SHEET STAYS BARE, AND THAT IS A DECISION (§75.7, §76). «You first just say for
 * who»: the sheet asks ONE thing at the document's largest step, with the river standing behind it.
 * There is no empty document on that screen to ghost — the document arrives after the name, and it
 * arrives as the sheet. Ghosting the coming lines under a bottom sheet would put the structure of a
 * document into a surface whose whole point is that it is not one yet.
 *
 * IT YIELDS ROW BY ROW (§77.2). `DocumentRow` states the geometry of a line on this card once, so
 * every row of the sheet is one drawing; the sentence leaves on the keystroke that puts the first
 * line on, and nothing above it moves. The FIGURE beside the count is the `albaranValues`
 * capability's — «planned» in the shipped profile, so a house that does not print values sees the
 * count alone at every count, which is the honest reading of a foot the ghost used to fake. The
 * DOCK is the sheet's: naming the document hands the pane over and the sheet brings the real one,
 * so nothing here ever stood in for it.
 *
 * ═══ THE WIREFRAME (§51.24 — regions, contents, type steps, states) ═════════════════════════
 * +- THE CARD - the sheet's own, and the head is where the sheet's head is ------- states ------+
 * | +- HEAD ------------------------------------------------------------------------------+   |
 * | |  [ Casa No|                    ]                                 [file v] drafts     |   |
 * | |  HeadingMedium desk / HeadingSmall phone — THE FIELD, in the name's seat             |   |
 * | |   +-------------------------------------+   suggestions UNDER the typing, never a    |   |
 * | |   | [CN] Casa Nou     litoral · truck 2 |   list in the pane; arrows walk, Enter     |   |
 * | |   | [CS] Can Solé     costa · truck 8   |   takes, Esc closes                        |   |
 * | |   +-------------------------------------+                                            |   |
 * | |  Nuevo · for Friday 22.08 · at 07:20      LabelXSmall tertiary — the DAY is a door,  |   |
 * | |                                            edited in place, where the sheet says it  |   |
 * | +- DOORS - Take photo · Upload file · Paste · Scan code, one row (§196.5) ------------+   |
 * | +- LINES - one row per goods, the sheet's own row ------------------------------------+   |
 * | |  [face] Merluza · sin cabeza          12 kg              148,80 EUR                  |   |
 * | |  Lines appear here once the paper is read       ParagraphSmall tertiary, while empty |   |
 * | +- ADD A LINE - `AddLine`, the sheet's own organ, chips as they type (§62) -----------+   |
 * | +- TOTAL - «0 lines»; the figure joins it where the house prints values ------------+   |
 * +---------------------------------------------------------------------------------------+
 *  STATES: nothing typed -> the name is asked, the four doors stand, one sentence says what comes
 *  (§200.4) · first keystroke -> the draft exists and the fact line says its hour · a line put on
 *  -> the sentence leaves and the row arrives, nothing above it moving · a customer taken -> the pane becomes
 *  the sheet, same card, same seat, and the sheet brings the dock.
 */

/** THE LINE ROW ON THIS CARD (FEED-IA §83.1 · §77.2 · §200.4).
 *
 * The geometry of a line on this card is stated HERE and nowhere else — the padding, the hairline,
 * the gap, the middle that grows — so every row of the sheet is one drawing.
 *
 * ⚠ THE GHOST ROWS IT USED TO ALSO DRAW ARE GONE (§200.4, and the reasoning is at the composer's
 * own `composer-lines-empty`). With them went the three width cycles they needed and the `ghost`
 * flag on this row: nothing on this card is drawn twice any more, so there is no second geometry
 * to keep in step.
 */
function DocumentRow({
  children,
  testid,
  line,
}: {
  children: React.ReactNode;
  testid: string;
  /** the line's own id, where this row is drawing a real one */
  line?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      data-composer-line={line}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale500,
        padding: `${theme.sizing.scale500} ${theme.sizing.scale600}`,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/** how many customers the typeahead OFFERS. It searches the whole book; this is what a dropdown
 *  under a field can hold without becoming the list §74.2 just killed. */
const TYPEAHEAD_ROWS = 7;

/** THE DRAFT MARK. `glyphs.tsx` has no dedicated draft/history glyph, and this package may not
 *  edit it — so the closest existing member of the file/pencil family stands in, and the want is
 *  reported rather than smuggled in: a proper draft mark belongs in the register (§30). */
const DRAFT_MARK: GlyphId = 'draft';

function Composer({
  cast,
  draft,
  drafts,
  ask = false,
  onBirth,
  onResume,
  onClose,
}: {
  cast: Cast;
  /** the draft this composer is holding, once one has been born */
  draft: Sale | null;
  /** every standing draft, newest first — the dropdown's own list (§74.5) */
  drafts: Sale[];
  /** THE ENTRY, AND ONLY THE ENTRY (FEED-IA §75.7, §76, §77.1). «You first just say for who, that
   *  makes a draft and then you add all the shit.» On a phone this is what the composer is: the
   *  head alone, in a bottom sheet over the river. The lines, the add-a-line and the total belong
   *  to the DOCUMENT, and the document opens the moment it has a name. */
  ask?: boolean;
  /** the first keystroke: mint the document and hold it */
  onBirth: (said: string, reservedId?: string) => string;
  onResume: (id: string) => void;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { derived } = useConfig();
  const { pricing } = useWorkspaceCapabilities();
  const pricingAvailable = capabilityAvailable('pricing') && pricing;
  /* ── AND THIS CARD DELIBERATELY DOES NOT DECLARE PRICES (FEED-IA §200.3 · E199) ────────────
   * ⚠ IT DID FOR ONE ROUND, AND THE MEASUREMENT KILLED IT. The nascent card is the albarán one
   * moment earlier, so declaring `pricing` here looked right — until the drives photographed what
   * it cost: this card is the sales pane's RESTING content, so the agent yielded to a sheet at
   * every width under 1664 on `#/sales` with nothing open at all. Peter's own ruling is the other
   * way round — «maybe that's fine for it to be compact when you don't have prices» — and a card
   * nobody has written on has none.
   *
   * AND THE FEAR IT WAS ANSWERING WAS UNFOUNDED. The worry was that a docked column at 1366 drops
   * the room to the stacked rung and takes the half-written albarán off the screen. Measured at
   * 950 and 1024 (`e199/stacked.py`): pressing «New albarán» there opens the ASK SHEET
   * (`data-ask=yes`) over the river — §75.7's own posture, which the stacked desk already uses.
   * Nothing is pushed out of anything. `detail.tsx` declares the fact for the document that
   * actually carries the row law. */
  const now = nowOf(cast);
  const today = todayId(cast);
  /** what is in the name field right now. It is seeded from the draft so resuming shows the
   *  half-word they left (§65.3), and it is the ONLY local state this surface keeps — everything
   *  else is the ledger's (§31.3: the document is the state). */
  const [said, setSaid] = React.useState(draft?.draftSaid ?? '');
  /** ── HAS ANYBODY ACTUALLY GIVEN THIS DRAFT A DAY? (FEED-IA §86.4) ────────────────────────
   *  The document always HAS a day — it opens on today, because goods go out on some day — but a
   *  default is not a statement, and §86.4 bans the surface from drawing one as though it were.
   *  IT IS THE LEDGER'S ANSWER NOW. `foldDay` stamps `draft-day` beside `print` and `reply` — the
   *  other two events that state something without moving the statechart — so the fact lives in
   *  the document's own history like every other fact about it. What stood here was a module set
   *  and a pair of `useState`/`useEffect` lines keeping the answer in the surface, written as a
   *  stand-in while `sale.ts` belonged to another package; the stand-in is gone and the surface
   *  READS. Walking away from a draft and coming back still does not un-say what a person said,
   *  and now it is the fold rather than a set that guarantees it. */
  const given = dayGiven(draft);
  const [walk, setWalk] = React.useState(0);
  const [shelf, setShelf] = React.useState(false);
  const field = React.useRef<HTMLInputElement | null>(null);
  /** how far the sheet has been pulled down by a finger, and where that finger started (§76) */
  const [pulled, setPulled] = React.useState(0);
  const pull = React.useRef<number | null>(null);

  React.useEffect(() => { setSaid(draft?.draftSaid ?? ''); }, [draft?.id, draft?.draftSaid]);

  const days = React.useMemo(() => [...feedDays(cast)].sort((a, b) => a.offset - b.offset), [cast]);

  /* IT SEARCHES THE WHOLE BOOK AND CUTS AFTER (§45.1). A house with four hundred accounts typing
     «nou» must find Casa Nou; cutting before the filter is the lottery §45.1 named. */
  const terms = React.useMemo(() => termsOf(said), [said]);
  const hits = React.useMemo(() => {
    if (terms.length === 0) return [];
    return cast.customers
      .filter((c) => matches(terms, wordsOf([c.name, c.zone, c.truck === undefined ? undefined : `truck ${c.truck}`])))
      .slice(0, TYPEAHEAD_ROWS);
  }, [cast.customers, terms]);

  /** THE KEYSTROKE IS THE BIRTH (§74.4). Nothing else on this surface creates anything. */
  const type = (next: string) => {
    setSaid(next);
    setShelf(true);
    setWalk(0);
    if (!draft) { onBirth(next); return; }
    nameDraft(draft.id, now, next);
  };

  /* ── AND THE MISS IS A DOOR, NOT A WALL (FEED-IA §86.5) ────────────────────────────────────
   * «It should let them enter a new customer bro… the whole customer experience thing should be
   * super solid.» A word the book does not hold used to end the flow: nothing came back and there
   * was nowhere to go. So the shelf's LAST row is the account itself, waiting to be written.
   *
   * IT IS OFFERED WHENEVER THE TYPED NAME IS NOT ALREADY ONE OF THEIRS, hits or no hits — «Casa
   * Nova» has to be creatable in a house that already holds «Casa Nou», and a row that only
   * appeared on a total miss would hide behind the near-match every time. What suppresses it is an
   * EXACT name, folded for case and spacing: a house cannot end up with two accounts wearing one
   * word, and the person who typed the name they already have is offered nothing to press. */
  const exact = React.useMemo(() => {
    const fold = (w: string) => w.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-ES');
    const w = fold(said);
    return w.length > 0 && cast.customers.some((c) => fold(c.name) === w);
  }, [cast.customers, said]);
  const offerBirth = said.trim().length > 0 && !exact;
  /** every row the shelf holds, in walking order — the accounts, then the one that is not one yet */
  const rows = React.useMemo(
    () => [...hits.map((c) => ({ kind: 'hit' as const, customer: c })), ...(offerBirth ? [{ kind: 'birth' as const }] : [])],
    [hits, offerBirth],
  );

  /** TAKING A CUSTOMER IS THE LAST THING A DRAFT IS MISSING — the document has an identity, so it
   *  stops being a draft and the pane holds the sheet (§74.3: nothing converts, it just IS one). */
  const take = (c: Customer) => {
    if (!draft) return;
    nameDraft(draft.id, now, c.name, c.id);
    setShelf(false);
  };

  /** WRITE THE ACCOUNT AND CARRY ON (§86.5). The customer is born in the house's own book — the
   *  cast is extended, so it is a customer everywhere from this instant — and then it is TAKEN
   *  down the same path a seeded one is: one function, one handover, one caret. The draft does not
   *  pause, ask anything else, or open a form; the name was the question. */
  /* ── AND THE BIRTH ASKS THE FOUR THINGS THE ROUND NEEDS (FEED-IA §135, iterating §86.5) ────
     «The new customer path opens a MODAL asking the core details — name · number · address with
     working localisation · lorry selection.»
     §86.5's one-press birth wrote a name and nothing else, which kept the composer moving and left
     an account the van cannot reach: no number to reply to, no door to print, no run to put it on.
     So the press opens `NewCustomerModal`, the modal writes through the SAME `makeCustomer`, and
     what comes back is taken down the same path a seeded customer is — one handover, unchanged. */
  const [birthing, setBirthing] = React.useState(false);
  const birth = () => {
    if (!draft) return;
    setBirthing(true);
  };

  const keys = (e: React.KeyboardEvent) => {
    /* ── AN EMPTY FIELD YIELDS «/» TO THE ONE SEARCH (§91.2, and the walk's P1-8) ─────────────
     * The composer takes the caret the moment Sales opens (§66.3), so arriving here through the
     * rail put the summon's own key into this field as a character: «/» typed a slash and the one
     * search — the app's way to everything — was unreachable on the surface people arrive at most.
     *
     * THE RULE IS THE FIELD'S EMPTINESS, because that is the only honest line. An EMPTY field has
     * nothing to protect, so the slash belongs to the summon and the caret leaves with it. A field
     * with a word in it is being written in, and there the slash is a character in somebody's
     * account name and stays one. The window's own listener stands down for both — it reads
     * `defaultPrevented` — so the box opens exactly once. */
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && said.trim() === '') {
      e.preventDefault();
      field.current?.blur();
      openSearch('everything');
      return;
    }
    /* ── ESCAPE RELEASES THE INNERMOST THING FIRST, AND THE FIELD IS ONE OF THEM (§32.A) ──────
     * The composer takes focus the moment Sales opens (§66.3's landing), and this field used to
     * keep it: the shelf closed, the caret stayed, and the sweep's own keys — ← → P and the review
     * verbs — stood down forever, because they stand down while anything is being typed into. A
     * person who landed here could not reach the morning beside them without a pointer, which is
     * the one thing a keyboard-first review flow may not ask (checkpoint §14.2).
     * So Escape walks the same ladder it walks everywhere: the shelf, then the COMPOSER — which is
     * the innermost thing left once the shelf has gone — and the pane goes back to the morning,
     * where §17.1's always-there panel picks the oldest thing somebody is waiting on. Two presses
     * from the landing to the head of the review pile, no pointer. §66.3 still stands: the composer
     * is what a person lands ON; this is them declining it. */
    if (e.key === 'Escape') {
      if (shelf) { setShelf(false); return; }
      field.current?.blur();
      onClose();
      return;
    }
    if (rows.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setShelf(true); setWalk((w) => (w + 1) % rows.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setShelf(true); setWalk((w) => (w - 1 + rows.length) % rows.length); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[walk];
      if (!row) return;
      if (row.kind === 'birth') { birth(); return; }
      take(row.customer);
    }
  };

  const lines = draft?.lines ?? [];
  const figure = draft ? figureOf(lines) : 0;
  const near = draft ? nearWordOf(draft.day, today) : null;

  /* ── THE HEAD, ONE DRAWING, TWO HOUSINGS (FEED-IA §74.3, §76, §77.1) ────────────────────
   * The desk mounts it as the nascent card's own header; the phone mounts it ALONE in a bottom
   * sheet, because on a phone the first act is «for whom» and nothing else (§75.7) and Monzo's
   * grammar is a sheet that slides up over the list rather than a page you are sent into (§76).
   * One element, so the two housings can never drift into two designs. */
  const head = (
      <header
        data-testid="document-head"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: theme.sizing.scale500,
          /* IN THE SHEET THE CARD IS ALREADY THE CARD (§76): the OverlayCard carries the gutter and
             the edge, so the head takes neither and the field starts where the sheet starts. */
          padding: ask ? '0' : theme.sizing.scale600,
          borderBottom: ask ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, flex: 1, minWidth: 0, position: 'relative' }}>
          {/* ── THE CUSTOMER, AS A FIELD IN THE NAME'S OWN SEAT (§74.2, §51.8) ───────────
              The sheet's head leads with the customer at the document's largest step; so does
              this, and the only difference is that here it takes a caret. It is borderless
              because a document's head is not a form: the affordance is the caret and the
              placeholder, which is §51.14's «rest / ring on hover / box when open» at the one
              step where the box would be a form field. */}
          <input
            ref={field}
            value={said}
            onChange={(e) => type(e.target.value)}
            onFocus={() => setShelf(true)}
            /* THE SHELF IS THE FIELD'S, so it leaves with the field (§59.1: nothing a person
               is not using may stand over the document). Selection is taken on `mousedown`,
               which fires before blur, so a suggestion is still pressable on its way out. */
            onBlur={() => setShelf(false)}
            onKeyDown={keys}
            placeholder="Whose delivery note"
            aria-label="Whose delivery note"
            data-testid="composer-name"
            autoFocus
            style={{
              /* THE NAME IS THE PRIMARY VALUE OF THIS MOMENT, so it takes the document's largest
                 step everywhere — and in the sheet, where it is the ONLY thing being asked, it
                 keeps that step at 390 too (§76: one task, the value leads). */
              ...(phone && !ask ? theme.typography.HeadingSmall : theme.typography.HeadingMedium),
              width: '100%',
              padding: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: theme.colors.contentPrimary,
              minWidth: 0,
            }}
          />

          {/* THE SUGGESTIONS STAND UNDER THE TYPING (§74.2) — a layer, so the head's own
              geometry never moves as they arrive or leave (§59.1, the calm). */}
          {shelf && rows.length > 0 && (
            <div
              data-testid="composer-hits"
              style={{
                position: 'absolute',
                top: '100%',
                left: `-${theme.sizing.scale300}`,
                right: 0,
                zIndex: 3,
                marginTop: theme.sizing.scale200,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: theme.borders.radius300,
                border: `1px solid ${theme.colors.borderOpaque}`,
                background: theme.colors.backgroundPrimary,
                boxShadow: theme.lighting.shadow600,
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              {hits.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`composer-hit-${c.id}`}
                  data-walked={i === walk ? 'yes' : 'no'}
                  onMouseDown={(e) => { e.preventDefault(); take(c); }}
                  onMouseEnter={() => setWalk(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.sizing.scale400,
                    width: '100%',
                    padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`,
                    border: 'none',
                    background: i === walk ? theme.colors.backgroundSecondary : 'transparent',
                    color: theme.colors.contentPrimary,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    minWidth: 0,
                  }}
                >
                  {/* THE SAME FACE THE RIVER DRAWS (§43): one visual identity per object. */}
                  <CustomerFace of={c} size={FACE.row} />
                  <span style={{ ...theme.typography.LabelMedium, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Mark text={c.name} terms={terms} />
                  </span>
                  <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto', whiteSpace: 'nowrap' }}>
                    {[c.zone, c.truck === undefined ? null : `truck ${c.truck}`].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}

              {/* ── THE ACCOUNT THAT IS NOT ONE YET (§86.5) ─────────────────────────────────
                  The last row of the same shelf, walked by the same arrows and taken by the same
                  Enter — because «create them» is not a different kind of act from «pick them»,
                  it is the same act on a name the book has not met. It carries THE NAME AS THEY
                  TYPED IT so a person can see exactly what they are about to write (§65.3), and
                  the row above it is the seeded book, so a near match is never hidden behind it. */}
              {offerBirth && (
                <button
                  type="button"
                  data-testid="composer-create"
                  data-walked={walk === rows.length - 1 ? 'yes' : 'no'}
                  data-name={said.trim()}
                  onMouseDown={(e) => { e.preventDefault(); birth(); }}
                  onMouseEnter={() => setWalk(rows.length - 1)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.sizing.scale400,
                    width: '100%',
                    padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`,
                    border: 'none',
                    /* it stands apart from the book above it by a hairline and nothing louder —
                       it is one more row of the same shelf, not a second surface (§59.1) */
                    borderTop: hits.length > 0 ? `1px solid ${theme.colors.borderOpaque}` : 'none',
                    background: walk === rows.length - 1 ? theme.colors.backgroundSecondary : 'transparent',
                    color: theme.colors.contentPrimary,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    minWidth: 0,
                  }}
                >
                  {/* THE SEAT THE FACES STAND IN, holding the mark for an account being written —
                      so the row lines up with the book above it instead of starting further left */}
                  <span style={{ display: 'grid', placeItems: 'center', width: FACE.row, height: FACE.row, flex: '0 0 auto', color: theme.colors.contentTertiary }}>
                    <Glyph id="plus" size={STEP.small} />
                  </span>
                  <span style={{ ...theme.typography.LabelMedium, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Add {said.trim()}
                  </span>
                  <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto', whiteSpace: 'nowrap' }}>
                    new customer
                  </span>
                </button>
              )}
            </div>
          )}

          {/* ── THE QUIET FACT LINE, WHERE THE SHEET PUTS IT (§51.8) ─────────────────────
              The sheet says «Albarán 2208-112 · for Friday 22.08 · at 05:59». A nascent one has
              no number yet, so it says what it IS — and the DAY is a door, edited in place,
              in the very seat the sheet states it (§74.3: never a «Which day» form row).

              ═══ AND IT STATES ONLY WHAT WAS GIVEN (FEED-IA §86.4) ═══════════════════════════
              «Right now the new albarán ALREADY tells me a delivery time before I fucking even
              entered it… wtf.» Two invented facts stood on this line:

                · «at 07:20» — the hour the DRAFT WAS BORN, drawn beside the day where the sheet
                  draws the hour the order arrived. On a document nobody has written yet it reads
                  as the delivery time, which is what he read it as. It is gone: the birth hour is
                  bookkeeping, not a fact about the goods, and the drafts dropdown already says it
                  where it means something («whose · what it comes to · when»).
                · «for Today» — the default day, asserted as a choice. The model still opens on
                  today, because a document has to be for some day; the SURFACE no longer claims
                  the person picked it. The slot stands EMPTY in §83.1's own grammar — a ghost bar
                  where the day will go — and fills the moment they take one off the door.

              THE LAW, GENERALLY: a draft may show what it was given and the shape of what it was
              not. It may never show a value nobody supplied as though somebody had. */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.sizing.scale300,
              flexWrap: 'wrap',
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentTertiary,
              minWidth: 0,
            }}
          >
            <span data-testid="composer-kind">{draft ? 'Draft' : 'New delivery note'}</span>
            <span aria-hidden="true">·</span>
            <StatefulPopover
              placement={PLACEMENT.bottomLeft}
              triggerType={TRIGGER_TYPE.click}
              overrides={{ Body: { style: { zIndex: OVER_THE_CHROME_LAYER } } }}
              content={({ close }) => (
                <StatefulMenu
                  items={days.map((d) => ({ label: `for ${nearWordOf(d.id, today) ?? d.label}`, id: d.id, offset: d.offset }))}
                  onItemSelect={({ item }) => {
                    /* NOW it is a fact somebody gave (§86.4), and the append IS the record of
                       that: the fold stamps `draft-day` and the button below reads the stamp. */
                    if (draft) dayDraft(draft.id, now, item.offset);
                    close();
                  }}
                  overrides={{ List: { style: { minWidth: '200px' } } }}
                />
              )}
            >
              <button
                type="button"
                data-testid="composer-day"
                /* the day is only a FACT once it was given (§86.4) — until then this attribute is
                   absent, so a drive reads the same emptiness the person sees */
                data-day={given ? draft?.day : undefined}
                data-given={given ? 'yes' : 'no'}
                disabled={!draft}
                aria-label="Which day it goes out"
                style={{
                  /* A THUMB HAS TO BE ABLE TO HIT IT (§76: «big tappable controls»; the Base
                     extract's own 48px floor). At 12px type with no padding this door was fourteen
                     pixels tall — readable and unpressable. The padding is taken back with a
                     negative margin, so the target grows and the fact line's own geometry is
                     unchanged (§77.2: nothing here reflows). */
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: theme.sizing.scale100,
                  padding: phone ? `${theme.sizing.scale400} ${theme.sizing.scale300}` : 0,
                  margin: phone ? `-${theme.sizing.scale400} -${theme.sizing.scale300}` : 0,
                  minHeight: phone ? 44 : undefined,
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  cursor: draft ? 'pointer' : 'default',
                  textDecoration: draft && given ? 'underline' : 'none',
                  textDecorationStyle: 'dotted',
                  textUnderlineOffset: '3px',
                }}
              >
                for{' '}
                {given && draft ? (
                  near ?? draft.deliveryDay
                ) : (
                  /* THE SLOT, EMPTY (§86.4 · §83.1). A ghost bar is the honest drawing of a fact
                     nobody has given: it says a day goes here and says nothing about which. */
                  <GhostBlock shape="line" tone="faint" width={54} height={8} />
                )}
              </button>
            </StatefulPopover>
          </span>
        </div>

        {/* ── THE DRAFTS, TOP-RIGHT (§74.5) ──────────────────────────────────────────────
            «Top right there should be a little button to see the drafts, with the typical
            history button… typical draft icon!!!! and shows them in a dropdown.» It stands in
            the seat the sheet's own walk takes, at the same weight, so the head has one shape
            at both moments of a document's life. */}
        <span style={{ flex: '0 0 auto' }}>
          <StatefulPopover
            placement={PLACEMENT.bottomRight}
            triggerType={TRIGGER_TYPE.click}
            overrides={{ Body: { style: { zIndex: OVER_THE_CHROME_LAYER } } }}
            content={({ close }) => (
              <div data-testid="drafts-list" style={{ display: 'flex', flexDirection: 'column', minWidth: 260, maxWidth: 340 }}>
                {/* THERE IS NO EMPTY STATE HERE, AND THAT IS DELIBERATE (§51.7, §59.5). A door
                    with nothing behind it does not open — the control says so by standing down
                    (see `disabled` below), which costs no sentence at all. Every wording that
                    fits this space is either an orphan sentence explaining the UI («Drafts land
                    here») or a negative («nothing half-written»), and both are banned. */}
                {drafts.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      data-testid={`draft-${d.id}`}
                      onClick={() => { onResume(d.id); close(); }}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: theme.sizing.scale300,
                        width: '100%',
                        padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                        border: 'none',
                        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
                        background: d.id === draft?.id ? theme.colors.backgroundSecondary : 'transparent',
                        color: theme.colors.contentPrimary,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        minWidth: 0,
                      }}
                    >
                      {/* WHOSE · WHAT IT COMES TO · WHEN — the three facts §74.5 names, and a
                          draft with no name yet says the words they left in the field. */}
                      <span style={{ ...theme.typography.LabelSmall, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.draftSaid?.trim() || 'Your words go here'}
                      </span>
                      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto' }}>{d.at}</span>
                    </button>
                ))}
              </div>
            )}
          >
            {/* IT STANDS IN THE SEAT THE SHEET'S WALK TAKES, at the same weight, so a document's
                head has one shape at both moments of its life (§74.5, §51.8). With nothing
                behind it, it stands DOWN rather than opening on a sentence about itself. */}
            <Button
              kind={KIND.tertiary}
              /* the same §76 target rule as the day door: a thumb, not a pointer */
              size={phone ? SIZE.compact : SIZE.mini}
              disabled={drafts.length === 0}
              data-testid="drafts-door"
              data-drafts={drafts.length}
              aria-label="The drafts standing"
              startEnhancer={<Glyph id={DRAFT_MARK} size={STEP.small} />}
              endEnhancer={drafts.length > 0 ? <Glyph id="caret" size={STEP.small} /> : undefined}
            >
              {drafts.length > 0 ? String(drafts.length) : ''}
            </Button>
          </StatefulPopover>
        </span>
      </header>
  );

  /* ═══ THE PHONE'S HOUSING IS A SHEET (FEED-IA §76 · §77.1 «the monzo thing is a feeling. its the
   * same for the albaran creation» · §75.7 «you first just say for who») ══════════════════════
   *
   * WHAT WAS WRONG. On a phone «New albarán» pushed a whole SCREEN over the river with a «Back to
   * the list» control at its top — «sending users into deep edit pages», which is the exact move
   * §76 names, and it broke the thing that makes the pattern work: «it keeps the user anchored in
   * the list instead of feeling like they've entered a separate admin form».
   *
   * WHAT IT IS NOW. The house's own `OverlayCard`, docked (`placement="bottom"`): the sheet rises
   * from the foot of the screen over the river, carries ONE task — whose albarán — at the
   * document's largest type step, and goes back down the way it came. The river stays behind it,
   * so a person can see what they are adding to. The DOCUMENT is what opens after: the moment the
   * draft has a name it is an albarán, and an albarán gets the screen (§74.3).
   *
   * IT IS DISMISSED THE WAY A SHEET IS. «Dismissible by dragging down» — so the grabber is a real
   * handle: a pointer that pulls it down moves the card with the finger and lets go of it past a
   * third of its own height. The ground and Escape close it too, because a sheet that can only be
   * dragged is a sheet a keyboard cannot leave.
   *
   * NOTHING BELOW THIS COMMENT IS A SECOND DESIGN. `head` is the same element the desk's card
   * mounts, at the same step, with the same typeahead and the same drafts door (§43: one object,
   * one identity, wherever it is drawn).
   */
  /* ── ONE MOUNT, BOTH HOUSINGS (§74.3's own rule for this component) ────────────────────────
     The composer returns twice — the phone's bottom sheet and the desk's pane — so a modal written
     into one of them would exist on one housing only. It is built once and drawn in both, which is
     the same discipline `head` above is built with. */
  const birthModal = (
    <NewCustomerModal
      isOpen={birthing}
      cast={cast}
      said={said}
      onClose={() => setBirthing(false)}
      onMade={(born) => {
        setBirthing(false);
        take(born);
      }}
    />
  );

  if (ask) {
    return (
      <OverlayCard
        isOpen
        onClose={onClose}
        placement={CARD_PLACEMENT.bottom}
        scrim={SCRIM.dim}
        size="100%"
        ariaLabel="New delivery note"
        overrides={pulled > 0
          ? { Card: { style: { transform: `translateY(${pulled}px)`, transitionProperty: 'none' } } }
          : undefined}
      >
        <div
          data-testid="composer"
          data-draft={draft?.id ?? 'unborn'}
          data-ask="yes"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
        >
          {/* THE HANDLE. It is the sheet's own affordance and its own target: 44px of grabbable
              height around a 36×4 bar, which is what a thumb needs and what the mark reads as. */}
          <span
            data-testid="composer-grab"
            aria-hidden="true"
            onPointerDown={(e) => {
              pull.current = e.clientY;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (pull.current === null) return;
              setPulled(Math.max(0, e.clientY - pull.current));
            }}
            onPointerUp={(e) => {
              const by = pulled;
              pull.current = null;
              setPulled(0);
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              if (by > 96) onClose();
            }}
            onPointerCancel={() => { pull.current = null; setPulled(0); }}
            style={{
              display: 'grid',
              placeItems: 'center',
              height: 44,
              marginTop: `-${theme.sizing.scale400}`,
              touchAction: 'none',
              cursor: 'grab',
            }}
          >
            <span style={{ width: 36, height: 4, borderRadius: 2, background: theme.colors.mono400 }} />
          </span>
          {head}
          <AlbaranIntakePicker
            scope={cast.sector}
            sale={draft?.id}
            phone={phone}
            ensureSale={(reservedId) => draft?.id || onBirth('', reservedId)}
          />
          {birthModal}
        </div>
      </OverlayCard>
    );
  }

  return (
    <div
      data-testid="composer"
      data-draft={draft?.id ?? 'unborn'}
      data-birthing={birthing ? 'yes' : 'no'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale700,
        minHeight: '100%',
        padding: phone ? theme.sizing.scale500 : theme.sizing.scale600,
        /* THE SHEET'S OWN GROUND, reaching every edge of the pane (§38) */
        background: theme.colors.backgroundSecondary,
        minWidth: 0,
      }}
    >
      {/* ═══ THE DOCUMENT — the sheet's own card, one moment earlier (§74.3, §17.2) ═════════ */}
      <article
        data-testid="document"
        data-nascent="yes"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          borderRadius: theme.borders.radius400,
          border: `1px solid ${theme.colors.borderOpaque}`,
          background: theme.colors.backgroundPrimary,
          boxShadow: theme.lighting.shadow500,
          /* THE CARD CLIPS ITS OWN CORNERS, AS THE SHEET'S DOES — except while the typeahead is
             open, because the suggestions hang off the head and a clipped shelf loses its last
             row to the card's edge (a drive caught «Can Sabaté» cut in half). Nothing else on
             this card ever overflows, so letting it through costs no other geometry (§59.1). */
          overflow: shelf && hits.length > 0 ? 'visible' : 'hidden',
        }}
      >
        {head}
        <div style={{ display: 'grid', gap: theme.sizing.scale300, padding: theme.sizing.scale500, borderBottom: '1px solid ' + theme.colors.borderOpaque }}>
          <AlbaranIntakePicker
            scope={cast.sector}
            sale={draft?.id}
            phone={phone}
            ensureSale={(reservedId) => draft?.id || onBirth('', reservedId)}
          />
          {/* ── AND WHAT HAPPENS AFTER A DOOR IS PRESSED, IN ONE SENTENCE (FEED-IA §200.4) ───
              ⚠ THIS REPEALS §83.1's GREY STACK, and the repeal is Peter's own: «With the Copilot
              open the new albarán's frame filled the column with skeleton rows and grey buttons;
              compact it to the doors and one sentence until lines exist.»

              §83.1 was right about the card it was written for — a head with a placeholder and
              NOTHING under it, which read as a broken screen. That card is gone: the four intake
              doors stand between the name and the lines now (§196.5), so the structure the ghost
              was drawing is already here, in controls a person can press. Three grey rows plus a
              grey dock under those doors stopped reading as «a document comes here» and started
              reading as «this document is loading» — the one meaning `src/rocoto/ghost` exists to
              avoid — and beside a 416px Copilot they filled the column with a picture of nothing.

              AND IT RIDES THIS BAND rather than standing in one of its own, because the doors and
              this line are ONE idea: here is how the paper gets in, and here is where it lands.
              One band, one hairline. A band of its own put a third rule across a card that has
              said nothing yet, and cost 32px of padding to say a sentence twenty pixels tall. */}
          {lines.length === 0 && (
            <p data-testid="composer-lines-empty" style={{
              margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary,
            }}>
              Lines appear here once the paper is read
            </p>
          )}
        </div>

        {/* ── THE LINES, WHERE THE SHEET PUTS LINES (§74.1) ─────────────────────────────────
            «Why can't I add more lines» — it takes as many as the document grows to, and each one
            is drawn in the sheet's own line shape: the goods' face, their name, the words that
            ride it, what was given, what it comes to. */}
        {lines.map((l) => (
          <DocumentRow key={l.id} testid={`composer-row-${l.id}`} line={l.id}>
            <ProductFace of={l.product} size={32} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
              {/* THE GOODS ARE A DOOR ON THE DRAFT TOO (§122 · §43). «What is this exactly» is a
                  question a person has WHILE composing, not only afterwards. */}
              <span style={{ ...theme.typography.LabelMedium, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Door
                  testid={`composer-open-${l.id}`}
                  label={`Open ${l.product.name}`}
                  onOpen={() => openProduct(l.product.id)}
                >
                  {l.product.name}
                </Door>
              </span>
              {/* AND THE AMOUNT IS WRITTEN ON THE LINE (§122). «Six kilos, no — eight» is the
                  ordinary correction and it had to be made somewhere else. `flush`, because
                  `DocumentRow`'s geometry is stated once so a ghost and a real row cannot drift
                  by a pixel (§83.1 · §77.2) — a control's own 36px step here would make every
                  line jump the moment one was touched. The AMENDMENT beside it is the record of
                  what changed and stays read-only; the LINE TOTAL is quantity × price. */}
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.amendment ? `${l.amendment} · ` : ''}
                {draft && (
                  <LiveValue
                    flush
                    value={String(l.given)}
                    label={`How much ${l.product.name} goes on this delivery note`}
                    placeholder={l.unit}
                    testid={`composer-qty-${l.id}`}
                    width={40}
                    onWrite={(said) => {
                      const n = Number(said.replace(',', '.').replace(/[^\d.]/g, ''));
                      if (Number.isFinite(n) && n > 0) editLine(draft, now, l.id, { given: n });
                    }}
                  />
                )}
                {' '}{l.unit}
              </span>
            </span>
          </DocumentRow>
        ))}

        {/* THE SHEET'S OWN ADD-A-LINE, MOUNTED — not a copy of it (§62.4: ONE shared organ). It
            needs a document to write onto, so it appears with the draft: the first keystroke buys
            the whole instrument. */}
        {draft && <AddLine cast={cast} sale={draft} now={now} />}

        {/* ── THE TOTAL, FORMING (§74.3) — AND GHOSTED UNTIL IT HAS SOMETHING TO SAY (§83.1) ─
            «0 lines · 0,00 €» is a true sentence about nothing, set in the loudest step on the
            card. So the foot carries the SHAPE of a total until the first line lands and the real
            one takes the same seat at the same height. */}
        <div
          data-testid="document-total"
          data-ghost={lines.length === 0 ? 'yes' : 'no'}
          style={{
            display: 'flex',
            alignItems: lines.length === 0 ? 'center' : 'baseline',
            justifyContent: 'space-between',
            gap: theme.sizing.scale500,
            padding: theme.sizing.scale600,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
            background: theme.colors.backgroundSecondary,
            minWidth: 0,
          }}
        >
          {/* §200.4 — THE FOOT IS A REAL LINE AT EVERY COUNT. It states what the card holds, at
              the quiet step it always held that count in; the FIGURE is what waits, because a
              «0,00 €» in the document's largest step is §83.1's own objection and still stands. */}
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary }}>
            {lines.length} {plural(lines.length, 'line')}
          </span>
          {pricingAvailable && derived.albaran.valued && lines.length > 0 && (
            <Figure value={figure} unit="S/" size="large" />
          )}
        </div>
      </article>
      {birthModal}
    </div>
  );
}

/* ── THE SURFACE ─────────────────────────────────────────────────────────────────────────── */

/** ── THE TOAST THE REVIEW KEYBOARD SPEAKS THROUGH (checkpoint §14.2f · FEED-IA §76) ──────────
 *  «Immediate feedback after saving, ideally with Undo.» Every act the keyboard takes says what it
 *  did and offers the way back, for the three seconds a slip takes to notice. The provider stands
 *  OUTSIDE the surface for the same reason `PriceEntry`'s does: `useSnackbar` reads a context, and
 *  a toast has to outlive the thing that raised it.
 *
 *  WHERE IT STANDS. The desk's dock — the loud verb, the rails, «Open the chat» — lives at the
 *  bottom of the RIGHT pane, so a toast centred on the bottom edge would cover the controls the
 *  rhythm keeps pressing. It takes the bottom-LEFT there, over the river's own foot, and the top
 *  on a phone, where the sheet is docked to the bottom edge (the same reasoning `stock-tiers.tsx`
 *  worked out, applied to this surface's own geometry). */
export default function Sales() {
  const phone = usePhone();
  return (
    <SnackbarProvider
      placement={phone ? SNACK_PLACEMENT.top : SNACK_PLACEMENT.bottomLeft}
      overrides={{
        /* ABOVE THE SHEET IT IS THE FEEDBACK FOR. Base mounts the toast in a `Layer` with no
           z-index of its own; this app's overlays stand at 8 (`overlay-card`'s own rule). */
        PlacementContainer: { style: { zIndex: 9 } },
      }}
    >
      <SalesSurface />
    </SnackbarProvider>
  );
}

function SalesSurface() {
  const [, theme] = useStyletron();
  const phone = usePhone();
  /* ── THE SPLIT PANE (FEED-IA §38) ────────────────────────────────────────────────────────
   * «I hate that there's scrolling within this, and that the albarán panel is a box within, where
   * it should just be full height. The scrolling behavior is horrible.»
   *
   * So on the desk this surface is two FULL-HEIGHT PANES and the page under them does not scroll
   * at all: the list pane on the left holds the band and the river and is ONE scrollport; the
   * sheet pane on the right holds the albarán and is another. Everything that used to stick to the
   * window sticks inside the list pane now, and the arithmetic that used to read `window.scrollY`
   * reads the pane's own `scrollTop`.
   *
   * THE PHONE IS UNTOUCHED. One screen, one scroll, push-and-back — `usePanes` ignores the ask
   * below the breakpoint, and every branch below asks `panes` rather than `!phone`, so the two
   * models can never half-apply to one another.
   *
   * ═══ AND BETWEEN THEM THE DESK STACKS (FEED-IA §103) ══════════════════════════════════════
   * «They should just resize with my browser.» Under 1096 the two panes cannot both keep their
   * anatomy — the arithmetic is in `shell/viewport.ts` — so the desk keeps everything else it is
   * (its rail, its day bar, its box that never scrolls) and stands the panes ONE AT A TIME: the
   * sheet takes the whole box and the river is one press behind it. Nothing is stretched and no
   * phone furniture arrives; what changes is the number of panes, which is the only thing the
   * width actually decided. */
  const panes = !phone;
  const stacked = useStacked();
  /* ── ONE PANE AT A TIME (FEED-IA §103) ──────────────────────────────────────────────────────
     The phone AND the stacked desk. Everything in this surface that used to ask «is this a phone»
     about the master-detail RELATIONSHIP asks this instead: is the river beside the sheet, or
     behind it. The housing question (`phone`) and the geometry question (`pushed`) are different
     questions and the file keeps them apart. */
  const pushed = phone || stacked;
  /* ── AND THE ASK SAYS WHAT THIS SURFACE ACTUALLY DRAWS (§38 · §83.3's foot) ────────────────
     It asked for panes at every width while drawing them at none below the breakpoint — `panes`
     two lines up is already `!phone`, and the phone branch is the push model. The frame ignored
     the ask for the POSTURE and believed it for the FOOT, which is how the launcher ended up
     standing over the river's last row at 390. One expression, both questions, one answer. */
  usePanes(!phone);
  /** the list pane's own scrollport, so «jump to today», the walk and the anchor watch measure and
   *  move the thing that actually scrolls */
  const listPane = React.useRef<HTMLDivElement | null>(null);
  /** what the document's own column is worth on this desk (§66.4) */
  const sheetPane = useSheetPane();
  const { config, derived } = useConfig();
  const cast = derived.cast;
  const { inventory, pricing } = useWorkspaceCapabilities();
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  const edits = useDay(cast.sector);
  const now = nowOf(cast);
  /* THE GRANTS ARE AN INPUT TO THE FOLD (THE-INTELLIGENCE §11). `buildSales` reads them from their
     own store, so this surface has to be a READER of that store too — otherwise a grant written in
     Settings would change what the fold produces without anything asking the fold again. */
  const grants = useGrants();
  /* Keeps the route’s count, filter and review walk in step with dismissed visible concerns. */
  const dismissals = useDismissals();
  /* ── AND SO IS THE TARIFA SHEET (checkpoint §16.4, the price override's own seam) ──────────
   * `buildSales` already re-folds on the sheet's identity — `sale.ts` lists it as one of the five
   * inputs, «so a screen could not go on showing yesterday's money on an open albarán» — but a
   * fold that re-runs is no use to a surface that never asks it again. This river never subscribed
   * to the sheet, because until now nothing on it could WRITE a price: the line's rate was a fact.
   * It is a value a hand may write now, so the surface reads the store that holds it. */
  const tiers = useTiers();
  /* WHO A HANDOVER GOES TO (checkpoint §5's routing), read off the house's own book. */
  const company = useCompany();
  /* WHAT AN ACT SAYS ONCE IT IS DONE (§76) — and the way back out of it. */
  const { enqueue: toast } = useSnackbar();
  const setup = usePrintSetup();
  // Packing output uses the same completion history and pending revisions as the export centre.
  const packingJobs = useQueue(cast.sector);
  const packingHistory = React.useSyncExternalStore(packingOutputs.subscribe, packingOutputs.getSnapshot, packingOutputs.getSnapshot);
  /* THE DAY'S TWO SEATS ARE TEMPLATES (OUT-03.2), read from the one store the library writes. It
     publishes, so a seat taken in the export centre reaches this row on the same frame. */
  const [templates, writeTemplates] = useTemplates(cast.sector);
  /* WHETHER A FILE THIS HOUSE WRITES CARRIES MONEY — the same two facts the export centre folds
     before it hands a file its columns, so the day's own door writes the identical file. */
  /* ONE DEFINITION OF «PRICED», the same the Prep download and the library flow read, so the same
     template writes the same columns whichever door saved it (print review, 11 September). */
  const priced = pricing && derived.albaran.valued;
  const pendingPacking = React.useMemo(() => packingJobs.filter(job => job.state !== 'printed')
    .flatMap(job => job.packingOutput ?? []), [packingJobs]);

  /** THE WHOLE BOOK. Every domain question — what lot is left, what this customer usually takes —
   *  is asked of the house, never of a filtered view, so `sales` stays the whole day and the
   *  narrows below decide only what is DRAWN (§32). */
  /* THE FIVE INPUTS ARE THE FIVE INPUTS (`sale.ts`'s own memo, and this one has to agree with it):
     the cast, the day, the grants — and the tarifa sheet, which is where a price a hand writes on
     a line lands (checkpoint §16.4). */
  const allSales = React.useMemo(() => buildSales(cast, edits, { includeArchived: true }), [cast, edits, grants, tiers]);
  const allocationBook = useAllocationBook(cast, allSales);
  const allocationCandidates = React.useCallback((product: string) => lotsForAllocation(allocationBook, product), [allocationBook]);
  /* Availability questions are conversation records, never goods documents. Chats owns them; this
     operational surface must not make an albarán, a print count, or an export out of one. */
  const operationalSales = React.useMemo(() => allSales.filter((sale) => !isMessageOnly(sale)), [allSales]);
  const sourceOrders = React.useMemo(
    () => operationalSales.filter((sale) => sale.thread.some((row) => row.source?.historical === false)),
    [operationalSales],
  );
  /* Existing receipts are the account's record, so mounting or changing houses announces
     nothing. Only an ID that joins this already-mounted house is a live arrival. */
  const knownSourceOrders = React.useRef<{ sector: string; ids: Set<string> } | null>(null);
  if (!knownSourceOrders.current) {
    /* `useDay` can publish retained storage after the first render. The ledger is the mount
       baseline, so that hydration remains quiet even when a transport cursor is replayed. */
    knownSourceOrders.current = {
      sector: cast.sector,
      ids: new Set(dayForSector(cast.sector).events.flatMap((event) =>
        event.kind === 'source-arrive' ? [event.sale] : [])),
    };
  }
  const sales = React.useMemo(() => operationalSales.filter((sale) => !sale.archived), [operationalSales]);
  const [view, setView] = React.useState<'all' | 'review' | 'archived'>('all');
  React.useLayoutEffect(() => {
    if (phone) window.scrollTo({ top: 0, behavior: 'auto' });
    else listPane.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [view, phone]);


  /** THE NARROW (§27). A day id thins the SAME river to that day. It is a filter state and nothing
   *  else: no second component tree, no second selection, no second scroll container. */
  const [narrow, setNarrow] = React.useState<string | null>(null);
  /** THE SECOND NARROW (§32): whose accounts. It composes with the day — both on at once is the
   *  model-b morning, «my Friday» — and each releases on its own. */
  const [mine, setMine] = React.useState<string | null>(null);
  /** THE THIRD NARROW (§35.1): the word. «Filter-as-you-type in Sales — it filters the river.» It
   *  is built as a narrow rather than as a feature because that is what makes it compose: search
   *  inside «mine» searches the thirty-five, search inside a day searches the day, and each of the
   *  three lets go on its own. */
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<string | null>(null);
  /** ── THE SHEET PANE'S LANDING (FEED-IA §66.3) ──────────────────────────────────────────────
   *  «When they first land on orders I want the default to be for them to make a NEW albarán.»
   *  So the pane opens on the composer rather than on a document the app picked, and the control
   *  in the header brings it back at any moment. It is a PANE STATE and not a mode: the river
   *  underneath is untouched, and opening any row simply takes the pane back. */
  /* AND THE PHONE LANDS ON THE RIVER (§76, the delta §66.3 could not have known about). «It
     cleanly gives us a landing spot when they first click on it» is a claim about the DESK'S
     SECOND PANE — a pane that would otherwise stand empty. A phone has no second pane, so the
     same default meant a sheet standing over the morning before anybody asked for one, which is
     the opposite of §76's «keeps the user anchored in the list». The control in the header opens
     it in one press, at every scroll position. */
  /* ── AND A STACKED DESK LANDS ON THE RIVER TOO (FEED-IA §103, caught by §129.5's gate) ───
     `!phone` was the wrong question by exactly one width band. Between the phone and the two-pane
     desk the layout is PUSHED — one pane at a time — so `composerSheet` turned this default into a
     full-screen OverlayCard standing over the morning before anybody asked for one. At 560 the
     measurement was unambiguous: a fixed 560×900 dialog at layer 8 over the whole app, and every
     control underneath it — the export centre included — unclickable on arrival.
     The right question is the one the pane model already asks: is the list BESIDE this, or behind
     it. Beside it, the composer is the second pane's landing (§66.3); behind it, it is a sheet a
     person opens from the header. */
  const [composing, setComposing] = React.useState(() => !pushed);
  /** WHO OPENED THE COMPOSER — the person, or the pane landing on its resting content (E199, owed
   *  and closed at RELEASE-195). The two look identical in `composing` and they must not be
   *  treated alike when the room changes under them: a landing composer is what a wide desk shows
   *  when nothing is open, so it yields; a composer somebody PRESSED «New albarán» for is a task
   *  they started, and it CONVERTS to the ask sheet the same press would have opened at 950. */
  const [askedFor, setAskedFor] = React.useState(false);
  /** WHICH DRAFT THE COMPOSER IS HOLDING (§74.4, §74.5), or nothing while none has been born.
   *  It is an ID rather than the object, because the document lives in the ledger and is refolded
   *  on every event — holding the object would be holding a stale copy of it. */
  const [heldDraft, setHeldDraft] = React.useState<string | null>(null);
  /* ── WHAT THE PRINT SCREEN OPENS ON (OUT-03.5 · OUT-04) ────────────────────────────────────
     The subject alone was enough while the day's two papers were fixed: the screen read the paper
     kind off the subject and found the template standing on the day for it. A seat may now hold
     any template in its category — a house with three albarán templates has three — so the day's
     own door names the TEMPLATE it is a seat for, and «Preview» lands on the one being edited
     rather than on whichever the resolver would have chosen. A door that knows only its subject
     (a single albarán's own Print) hands the subject over and the screen resolves the rest. */
  const [printing, setPrinting] = React.useState<PrintScreenRequest | null>(null);
  useHistoryLayer({
    id: 'sales:print-screen',
    active: printing !== null,
    snapshot: { request: printing ? JSON.stringify(printing) : null },
    onRestore: (snapshot) => {
      if (typeof snapshot?.request !== 'string') { setPrinting(null); return; }
      try { setPrinting(JSON.parse(snapshot.request) as PrintScreenRequest); }
      catch { setPrinting(null); }
    },
  });
  const [gate, setGate] = React.useState<{ id: string; act: GateAct } | null>(null);
  /** the row the band has just walked the reader to, and a counter so the same card can be pressed
   *  twice and light the row twice */
  const [landed, setLanded] = React.useState<{ id: string; n: number } | null>(null);
  /** THE SWEEP RAN OUT OF LIST (§32.A). It stops honestly rather than wrapping: a loop that comes
   *  back to the top is a person printing the same morning twice. */
  const [swept, setSwept] = React.useState(false);
  /** MOTION IS ROCOTO'S TO SWITCH OFF (§111.1's licence, read against the doctrine). */
  const still = useStillness();
  /** THE RIVER IS TRAVELLING, and this is where it is going — held for `TRAVEL_MS`, which is the
   *  smear plus its own deceleration. `null` at rest, which is almost always. */
  const [travelling, setTravelling] = React.useState<string | null>(null);
  /** THE HAND'S OWN CADENCE (§111.1). The last press's hour and how many arrived in a run, so the
   *  keyboard can tell a walk from an erratic hand without asking the person which they meant. */
  const run = React.useRef<{ at: number; n: number }>({ at: 0, n: 0 });
  /** WHICH DOCUMENT THE QUICK CHECK IS ABOUT, the box it morphs out of, the job it was raised on,
   *  and whether it is still open (§111.1, §59.1). The JOB is a snapshot: the card is a picture of
   *  one moment and it lives for seconds, and holding it here is what lets the card finish folding
   *  back after the act has already taken the job away. */
  const [checking, setChecking] =
    React.useState<{ id: string; from: DOMRect | null; job: Job; open: boolean } | null>(null);

  /** the day picker's flip, held stable so the memo above it holds (§32.A) */
  const shiftNarrow = React.useCallback(
    (by: number) => setNarrow((d) => (d ? dayIdOf(shiftDay(dayFromId(d), by)) : d)), []);

  /* A WIDTH CHANGE IS A HOUSING CHANGE. Carrying a desk's standing composer into the phone would
     raise a sheet over the river that nobody asked for (§76).

     ⚠ AND IT IS THE PUSH MODEL THAT DECIDES, NOT THE HOUSING (E195.30). The initial state two
     paragraphs up was corrected to `!pushed` when §129.5's gate caught the stacked desk; this
     effect was left asking `phone`, so the same wrong question survived in the only place that
     could still act on it — a desk that BECOMES pushed while a composer stands. Nothing reached
     it while the only way to become pushed was to drag the window, and the agent's column made it
     a one-press road: at 1366 the room drops from 1366 to 950 when the Copilot opens, the desk
     stacks, and `composerSheet` raised «Whose albarán» over the morning — a task nobody started,
     because a person pressed the agent. Photographed at 1366 and 1366×900; measured as a third
     `[role=dialog]` on the page. The list is what a stacked desk lands on, exactly as a phone
     does, and «New albarán» stands in the header at every width. */
  React.useEffect(() => {
    /* ⚠ AND A COMPOSER THE PERSON OPENED CONVERTS RATHER THAN CLOSING (E199's own OWED, closed at
       RELEASE-195; THE-COPILOT-SPEC §11.2). Pressing «New albarán» at 1366 and then opening the
       agent drops the room to 950 and stacks the desk — and this effect used to close the card,
       putting the person back on the river without asking, for pressing a second control. What a
       stacked desk gives a fresh «New albarán» is the ASK SHEET (`composerSheet = pushed &&
       composing`, §75.7), so a composer that was ASKED FOR simply becomes that sheet: the same
       surface the same press opens at 950, mounted by the state that is already standing. Only
       the pane's own landing composer yields, which is what this effect was written for. */
    if (pushed && !askedFor) setComposing(false);
  }, [pushed, askedFor]);

  /* a different cast is a different morning, so nothing a person opened in the last one survives */
  React.useEffect(() => {
    setSelected(null);
    setPrinting(null);
    setNarrow(null);
    setMine(null);
    setQuery('');
  }, [cast]);

  const todayKey = todayId(cast);

  /** THE EIGHT WHO HOLD THE ACCOUNTS, WITH THE SIZE OF EACH BOOK (§12, §32). Read out of the
   *  house's own register — the surface adds nothing to the data and types no name.
   *
   *  EVERY COMERCIAL IS IN IT, AND THAT IS §67.1's OWN POINT: «they can cover for each other after
   *  all, which is how it should be.» So the register is the whole roster and not the subset who
   *  happen to hold a book this morning — a person covering for somebody is looking for a name
   *  that is not theirs, and a filter that hid the empty books would hide the new hire on their
   *  first week. The count says how large each book is; nobody is kept out for holding none.
   *
   *  AND THE REACH RIDES ALONG (§67.1): the phone and, where it exists, the address — the fact
   *  actually wanted at 07:00 when a crate is wrong and somebody has to be called. */
  const holders = React.useMemo<Holder[]>(
    () =>
      (cast.comerciales ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        customers: cast.customers.filter((x) => x.comercial === c.id).length,
        phone: c.phone,
        email: c.email,
      })),
    [cast],
  );

  /** WHAT THE SURFACE READS (§32). «Mine» scopes everything: the river, the band, the counts, the
   *  paper and the list the sweep walks. The date narrow is applied further down, on the groups,
   *  because a day is a slice of this and never the other way round. */
  const accountSales = React.useMemo(
    () => mine ? operationalSales.filter((sale) => sale.customer.comercial === mine) : operationalSales, [operationalSales, mine]);
  const scoped = React.useMemo(
    () => accountSales.filter((sale) => view === 'archived' ? Boolean(sale.archived) : !sale.archived), [accountSales, view]);
  /* "To review" is the same projection as the visible red labels, and §196.3 widened BOTH by the
     same clause: an order the operator pressed Flag on is a flagged order, so it wears the red on
     its row and it is counted here. Before that, the one flag a PERSON sets was the only one the
     review list could not see. Picking, printability and older standing predicates remain
     operational facts elsewhere; a dismissed concern must not leave a ghost in this person-facing
     review list. */
  const reviewSales = React.useMemo(
    () => scoped.filter(isFlagged),
    [scoped, dismissals],
  );
  const reviewCount = React.useMemo(
    () => accountSales.filter((sale) => sale.customer.id !== '' && !sale.archived && (!narrow || sale.day === narrow)
      && isFlagged(sale)).length,
    [accountSales, narrow, dismissals],
  );
  const archivedCount = accountSales.filter((sale) => sale.archived && (!narrow || sale.day === narrow)).length;

  /* ── THE REVIEW WALK'S ORDER, WHICH IS NOT A PLACE ───────────────────────────────────────
   * The same undismissed response/check concerns that the row labels state, oldest first. It draws
   * nothing; it only tells an opened document where it stands in that visible review set. Print,
   * pick and reply routing keep their own operational projections. */
  const flow = React.useMemo(() => view === 'archived' ? [] : [...reviewSales].sort((a, b) => a.at.localeCompare(b.at)), [reviewSales, view]);

  /* ── WHAT THE SYSTEM DEFERRED, HANDED TO THE CHAT (§67.6, canon §16.4, seam in `sale.ts`) ───
     «Urgent shit that the Rocoto deferred appears as a CHAT NOTIF.» This surface neither draws a
     notification nor owns one: it derives the set and STATES it on the river's own root, so the
     widget in `shell/` — which imports `chatNotices` directly — and any drive reading the DOM see
     the identical answer. Nothing here is a second copy of the widget's state. */
  /* The river excludes message-only questions, while the chat-notice projection deliberately
     includes them: a question belongs in its customer's conversation, not as a sales document. */
  const noticeSales = React.useMemo(
    () => mine ? allSales.filter((sale) => sale.customer.comercial === mine) : allSales,
    [allSales, mine],
  );
  const notices = React.useMemo(
    () => view === 'archived' ? [] : chatNotices(noticeSales.filter((sale) => !sale.archived), todayKey),
    [noticeSales, todayKey, view],
  );

  /* ── THE DRAFTS (FEED-IA §74.4, §74.5) ─────────────────────────────────────────────────────
     Documents born on a keystroke and not yet named. They are read off the WHOLE book rather than
     the scope, because a draft belongs to the person writing it and no narrow of somebody else's
     accounts should hide the thing they were half-way through. The composer holds one by id; the
     dropdown lists them all, newest first. */
  const drafts = React.useMemo(() => draftsOf(sales), [sales]);
  const draftHeld = React.useMemo(
    () => (heldDraft ? drafts.find((d) => d.id === heldDraft) ?? null : null),
    [heldDraft, drafts],
  );

  /* ── AND A NAMED DRAFT IS SIMPLY THE DOCUMENT (§74.3) ──────────────────────────────────────
     The instant a customer is taken, `isDraft` goes false, the draft leaves `drafts`, and the row
     joins the river — so the pane has to follow it into the sheet. Selecting it here is the whole
     of the handover, and because the composer wears the sheet's identity the person sees the head
     they were typing in stay exactly where it was. */
  /* ── AND THE TYPING CARRIES ON INTO IT (FEED-IA §74, §61.3) ────────────────────────────────
     THE FIND, OFF THE LIVE SCREEN: a person typed «Casa Nou», pressed Enter, and kept typing the
     first line — and the letters went nowhere. The handover below is instant and silent, which is
     the design; what it lacked was the CARET. The composer's field unmounts with the composer, and
     the sheet that replaces it opens at rest, so between one keystroke and the next there was a
     surface with nothing focused on it. In the drunk register (§61.3) that is the worst possible
     place to drop a hand: they are not looking, they are typing.

     SO THE HANDOVER CARRIES THE CARET WITH IT. The sheet is told this document arrived mid-
     sentence, opens its add-a-line on the same paint, and the chip organ takes focus — «merluza
     sin cabeza» typed straight after Enter forms chips on the real sheet.

     IT LASTS EXACTLY ONE DOCUMENT. Walking to another sale clears it, so coming back to this one
     later opens it at rest like every other — a sheet that reopened its add-a-line every visit
     would be the surface deciding what they meant. */
  const [carrying, setCarrying] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!heldDraft) return;
    if (drafts.some((d) => d.id === heldDraft)) return;
    const born = sales.find((s) => s.id === heldDraft);
    setHeldDraft(null);
    if (born) { setComposing(false); setAskedFor(false); setSelected(born.id); setCarrying(born.id); }
  }, [heldDraft, drafts, sales]);

  React.useEffect(() => {
    if (carrying && selected !== carrying) setCarrying(null);
  }, [carrying, selected]);

  /* ── THE WORD (FEED-IA §35.1) ────────────────────────────────────────────────────────────
   * THE ROWS ARE INDEXED ONCE, NOT ONCE PER KEYSTROKE. Folding three hundred sales and every line
   * on them is real work at real scale (§31.1), and a person typing «merluza» does it seven times.
   * So the words of a sale are built when the SCOPE changes and read on every letter.
   *
   * WHAT A SALE ANSWERS TO is everything the row already says about itself out loud: whose it is,
   * what is on it, what it comes to, what state it is in, which run it goes out on and which day it
   * is for. A person searching a river types the thing they can remember, and the thing they can
   * remember is one of the words they read. Nothing hidden is indexed — a hit a person cannot see
   * the reason for is worse than a miss. */
  const index = React.useMemo(
    () =>
      new Map(
        scoped.map((s) => [
          s.id,
          wordsOf([
            s.customer.name,
            s.number,
            s.deliveryDay,
            nearWordOf(s.day, todayKey),
            rowStanding(s, todayKey).word,
            STATE_TEXT[s.state],
            s.customer.zone,
            s.customer.truck === undefined ? undefined : `truck ${s.customer.truck}`,
            s.figure,
            s.figure.toFixed(2),
            ...s.lines.map((l) => l.product.name),
          ]),
        ]),
      ),
    [scoped, todayKey],
  );

  const terms = React.useMemo(() => termsOf(query), [query]);
  const searching = terms.length > 0;

  /** THE RIVER, THINNED. It runs before the grouping on purpose: every aggregate a whisper says —
   *  the count, the total, the ⎙ button's own number — is then a fact about what is DRAWN rather
   *  than a fact about a day the reader cannot see. That is the same path «mine» already takes,
   *  which is why the two compose without either of them knowing about the other. */
  const searched = React.useMemo(
    () => scoped.filter((sale) => (!searching || matches(terms, index.get(sale.id) ?? []))
      && (view !== 'review' || isFlagged(sale))),
    [searching, scoped, terms, index, view, dismissals],
  );

  const groups = React.useMemo(() => groupByDay(cast, searched), [cast, searched]);
  /* THE CALENDAR KEEPS THE WHOLE MORNING. Its dots say which days hold work, and a search is a
     question about rows rather than about the shape of the week — a person flipping days inside a
     search still needs to know where the days are. */
  const days = React.useMemo(() => daysWithSales(scoped), [scoped]);

  /* ── THE CLEARED TABLE (§3, §33.2 item 4) ────────────────────────────────────────────────
   * A day is cleared the moment its last open sale closes, and the moment is what is worth
   * marking — a day that was already finished when the person arrived has nothing to celebrate.
   * So this watches the TRANSITION: the set of days that were not clear on the previous render and
   * are now, held for the length of the settle and then gone. */
  const wasClear = React.useRef<Set<string>>(new Set());
  const [cleared, setCleared] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    const now = new Set(groups.filter((g) => g.sales.length > 0 && g.closed === g.sales.length).map((g) => g.day.id));
    const first = wasClear.current.size === 0 && cleared.size === 0;
    const fresh = [...now].filter((id) => !wasClear.current.has(id));
    wasClear.current = now;
    /* the first fold of the morning is not an event: everything already closed was closed before
       the person sat down, and settling forty days at once would be confetti by another name */
    if (fresh.length === 0 || first) return;
    setCleared((prev) => new Set([...prev, ...fresh]));
    const t = window.setTimeout(
      () => setCleared((prev) => new Set([...prev].filter((id) => !fresh.includes(id)))),
      4000,
    );
    return () => window.clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- `cleared` is written here, never read as an input */
  }, [groups]);

  /** WHAT THE RIVER DRAWS. Narrowed, it is one day — and a day the narrow reached that holds
   *  nothing is still drawn, because a person standing on an empty Saturday has to see that it is
   *  empty rather than see nothing at all (§27). */
  const shown = React.useMemo<DayGroup[]>(() => {
    if (!narrow) return groups;
    return [groups.find((g) => g.day.id === narrow) ?? emptyGroup(feedDayOf(cast, narrow))];
  }, [narrow, groups, cast]);

  /* ── THE SETTLE, AND THE FLOW IT CARRIES YOU ALONG (§10.2, §51.25, §66, §67.6) ───────────
   * «The settle is SHOWN, not merely done»: a row that stops owing an answer settles in place —
   * lit and lifted for a moment, with one sentence saying what just happened — and lies back down
   * into the stream. It never travels, because there is nowhere to travel from any more: the band
   * that used to hold a second copy of it is gone (§67.6), so the settle happens exactly where the
   * person was already looking.
   *
   * AND SETTLING ONE ARRIVES AT THE NEXT (§51.25). «Flipping through them could be better» — so
   * review is a FLOW rather than a list a person returns to between acts: the moment the open
   * document stops owing anything, the pane holds the next one. Nobody hunts a list for where
   * they were, and there is no list to hunt.
   *
   * ═══ IT ADVANCES ON THE ACT, BECAUSE THE ACT IS WHAT DISPOSES OF ATTENTION (§66) ══════════
   * «Once read, if they don't edit, that's down to them.» So the pile empties HONESTLY: every path
   * out of the flow is a real act on the document — confirming it, resolving it, answering in the
   * comms, the guard's own «go ahead», a quick verb on its row, a customer's message landing that
   * clears the flag, or simply READING it where reading is what it was owed. This watches the
   * LIST rather than any one button, which is why it can never disagree with what the surface is
   * drawing: both read `reviewOf`. A handler on one act would advance on one act.
   *
   * WHERE IT LANDS: the one that FOLLOWED it while both were standing — the flow's own order, so
   * a person walks the morning in the order it arrived rather than being thrown to the top. If
   * that one has gone too, the first still standing; if none is left, the document stays exactly
   * where it is and the river is simply quiet — which is the whole of how a cleared morning is
   * said (§61.2: the win is felt, never announced).
   */
  const wasInFlow = React.useRef<string[]>([]);
  const [settling, setSettling] = React.useState<string[]>([]);
  React.useEffect(() => {
    const ids = flow.map((s) => s.id);
    const was = wasInFlow.current;
    const left = was.filter((id) => !ids.includes(id));
    wasInFlow.current = ids;
    if (left.length === 0) return;
    /* THE ADVANCE IS PART OF THE SETTLE, so it reads the SAME departure rather than watching for
       one of its own: two effects asking «did it leave?» is two answers waiting to differ. */
    // Only an explicitly chosen review queue advances. Inline dismissal while reading an
    // ordinary albarán keeps that document in place so the person can continue working.
    if (view === 'review' && selected !== null && left.includes(selected)) {
      const after = was.slice(was.indexOf(selected) + 1).find((id) => ids.includes(id));
      const next = after ?? ids[0];
      if (next) setSelected(next);
    }
    setSettling((prev) => [...prev, ...left]);
    const t = window.setTimeout(
      () => setSettling((prev) => prev.filter((id) => !left.includes(id))),
      4000,
    );
    return () => window.clearTimeout(t);
  }, [flow, selected, view]);

  /** THE LIST THE CHEVRONS WALK — the river as it is drawn, and nothing else. */
  const list = React.useMemo<Sale[]>(() => shown.flatMap((g) => g.sales), [shown]);

  /* THE PANEL IS ALWAYS THERE ON A DESK (§17.1): something is always selected — the oldest thing
     somebody is waiting on, else the first thing wanting attention in the walked list, else today's
     first sale, else the head of the list — and closing picks a neighbour rather than leaving a
     gutter. The phone keeps push-and-back. */
  React.useEffect(() => {
    /* §66.3 TOOK THE FIRST PICK AWAY. «When they first land on orders I want the default to be for
       them to make a NEW albarán» — so on arrival the pane holds the COMPOSER, and this effect
       stops choosing for them while it does. Once they have opened anything, the pane is never
       empty again: closing one walks to a neighbour, exactly as §17.1 promises. */
    /* AND A PANE STANDING ALONE MAY BE EMPTY (FEED-IA §103). «Always there» is a promise about a
       pane BESIDE a list: it stops the desk showing a gutter. Where the sheet stands INSTEAD of
       the river, an empty selection is not a gutter — it is the river, which is where a person who
       just pressed «Back to the list» asked to be. Keeping this effect on `phone` re-opened a
       neighbour the instant the back was pressed, and the list never came back. */
    if (composing || pushed || printing !== null || selected !== null || list.length === 0) return;
    const inList = (s: Sale | undefined) => (s && list.some((x) => x.id === s.id) ? s : undefined);
    const wanting = inList(flow[0]) ?? list.find((s) => isStanding(s, todayKey));
    const fallback = list.find((s) => s.day === todayKey) ?? list[0];
    setSelected((wanting ?? fallback).id);
  }, [composing, pushed, printing, selected, list, flow, todayKey]);

  /** THE PANEL PICKS WITHIN THE NARROW (§32). Changing whose accounts these are drops the selection
   *  so the effect above picks again inside the new scope — otherwise a comercial who narrowed to
   *  their own book would be reading somebody else's albarán in the panel beside it. The DATE narrow
   *  deliberately does not do this (§27: a day is a filter over a river a person is already reading,
   *  and the document they had open is still theirs).
   *
   *  IT IS ONE ACT, NOT AN EFFECT WATCHING ONE. Clearing the selection from an effect keyed on
   *  `mine` deadlocked the surface: the always-selected effect had already picked in the same
   *  commit, the clear landed after it, and on the next render its own dependencies were unchanged
   *  — so nothing picked again and the desk's panel, which §17.1 promises is always there, was
   *  gone. Both writes belong to the press that caused them. */
  const scopeTo = (id: string | null) => {
    setMine(id);
    setSelected(null);
    setSwept(false);
  };

  /** AND TYPING IS THE SAME ACT (§35.1). A letter thins the river, so the document beside it has to
   *  be a document that is still in the river — otherwise the panel's «3 of 34» counts a list the
   *  open albarán is no longer in. Same shape as `scopeTo`, and for the same reason: both writes
   *  belong to the press that caused them rather than to an effect watching one. */
  const search = (next: string) => {
    setQuery(next);
    setSelected(null);
    setSwept(false);
  };

  /* ── THE SEAT THE ONE SEARCH SITS IN (FEED-IA §91.2) ──────────────────────────────────────
   * The river keeps §35.1's narrow whole — the word thins the days, the misses vanish, what
   * matched is marked — and gives up only the FIELD, which now opens in the middle of the screen
   * with every other search in the app. What is declared here is the word this surface stands on
   * and the way to set a new one; the box reads both live, so typing in it narrows the river
   * behind it exactly as typing in the old seat did.
   * IT TAKES THE WHOLE APP'S LIST. A person at the river is looking for a customer, a product or a
   * figure at once — that IS `everything`, so the intent is the box's own default rather than a
   * register minted for one surface. */
  useSearchSeat({
    intent: 'everything',
    query,
    onQuery: search,
    fieldTestid: 'sales-search-field',
    label: 'Find a customer, a product, a figure',
  });

  /* a sweep is a pass over ONE list, so narrowing the days ends the pass rather than continuing it */
  React.useEffect(() => {
    setSwept(false);
  }, [narrow]);

  /* ── A PHONE LANDS ON THE RIVER (FEED-IA §66.3, read against §38's two models) ─────────────
   * «When they first land on orders I want the default to be for them to make a NEW albarán» is
   * about the SHEET PANE — the always-there column §17.1 promised, which exists on a desk and
   * nowhere else. A phone has one screen and the push model, so landing straight in the composer
   * would put the morning's work one back-tap away from the person who opened Sales to read it.
   * The control on the header pushes the composer whenever they want it, at both widths. */
  React.useEffect(() => {
    /* A HOUSING CHANGE ENDS THE TASK, where a room change converts it. Carrying a desk's composer
       onto a phone would raise a sheet over the river on a screen the person came to READ, so the
       mark goes with the card (§76). */
    if (phone) { setComposing(false); setAskedFor(false); }
  }, [phone]);

  /* ── THE HEADER BLOCK'S OWN HEIGHT (FEED-IA §51.4) ───────────────────────────────────────
   * «Two slim sticky rows max, designed as one header block.» Row two — the band's folded summary —
   * has to park exactly under row one, and row one wraps on a phone, so its height is a measurement
   * rather than a constant. It is also what a day jumped to has to clear, and what the walk to a
   * row subtracts, so the three of them read one number. */
  const header = React.useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = React.useState(0);
  const dayHeaderTop = useStickyTop(theme, phone ? headerH : 0);
  React.useLayoutEffect(() => {
    const el = header.current;
    if (!el) return;
    const read = () => setHeaderH(el.getBoundingClientRect().height);
    read();
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, [phone, panes]);

  /* ── THE BAND'S SCROLL MACHINERY, DELETED (§67.6) ────────────────────────────────────────
   * What stood here was the compression: a sentinel line under the band, a reserved seat exactly
   * the height the fold gave up, an IntersectionObserver asking whether the reader had gone past
   * it, and a walk-back that scrolled the pane to the top. Every line of it existed to make a
   * panel that follows a person down six hundred rows bearable.
   *
   * «Simply having no sticky for-review thing might be best!!!» — so none of it is needed, and
   * none of it is kept «just in case»: a compression with nothing to compress is the second home
   * §25.2 was already arguing against, waiting to be switched back on. The only sticky thing left
   * on this surface is the header block (§51.4), which carries the two narrows and the search and
   * is measured just above.
   */

  const open = (id: string) => {
    setPrinting(null);
    setComposing(false);
    setAskedFor(false);
    setSelected(id);
    setSwept(false);
  };

  /* ══ THE DAY'S TWO SEATS, BUILT FROM THE TEMPLATES THE HOUSE CHOSE (FEED-IA §202.5) ═══════
     THE-OUTPUTS-SPEC OUT-03. Every day in the river asks this for its own row, and it answers
     with up to two `DaySeat`s in seat order — the template, what it still owes THIS day, the run
     its press sends, and the print screen its eye opens on.

     WHAT EACH SEAT COUNTS is the template's category, and each count is the one the surface
     already folded rather than a second reading of the same ledger (OUT-03.3): an albarán
     template counts the day's unprinted or changed albaranes, a packing template the crates whose
     list the bay is still owed, a day sheet the one sheet a day has. A `file` or an `email`
     template produces no paper, so its seat carries no count and no eye — it opens the export
     centre on its own screen, where its act stands (OUT-02.3's own rule about a row with no
     paper, arriving on the day).

     AND THE PRESS PRINTS THE TEMPLATE. Until E200 this row printed `PRINT_LAYOUT_DEFAULTS` on the
     house's paper whatever a person had saved (OUT-01.1's first defect). It freezes the template
     now — its paper, its copies, its own layout profile and its revision — which is exactly what
     the library's own act freezes, so the two doors onto one template can never print two
     different sheets. */
  const daySeats = React.useCallback((
    day: string, _label: string, scope: Sale[], fresh: Sale[], pending: number, bay: Sale[], packingQueued: number,
  ): DaySeat[] => templateSeats(templates).flatMap<DaySeat>((template) => {
    if (!template) return [];
    const kind = PAPER_KIND_OF[template.category];
    const owed = template.category === 'albaran' ? fresh
      : template.category === 'packing' ? bay
        : template.category === 'day-sheet' ? (scope.length ? scope : []) : [];
    /* THE STATE THE PRESS STANDS DOWN INTO, in the surface's own positive words: what IS true of
       this template on this day, never what is absent (§198-A). */
    const state = scope.length === 0 && template.category !== 'email'
      /* A DAY THE ROUND HAS YET TO REACH (OUT-03.3's own state table). This row used to draw
         nothing at all on such a day, so a house looking at tomorrow saw its papers vanish; the
         seat states what is true instead — the templates stand, and they are waiting. */
      ? 'Ready when orders arrive'
      : template.category === 'albaran'
        ? (pending > 0 ? 'To review' : 'All printed')
        : template.category === 'packing'
          ? (packingQueued > 0 ? 'Queued' : 'All printed')
          : template.category === 'day-sheet' ? 'All printed'
            : template.category === 'file' ? `${scope.length} ${plural(scope.length, 'order')}` : 'Sends on a schedule';
    /* ── A SEAT THAT PRODUCES NO PAPER (OUT-03.3) ────────────────────────────────────────────
       A `file` template's press SAVES THE FILE — the same call the library's own «Download file»
       makes, on the same record, so one template can never write two different files — and the
       act says so afterwards in the surface's own snackbar. An `email` template schedules rather
       than acts on a day, so its press opens the plan where the schedule stands. Neither carries
       an eye: there is no paper to look at, which is OUT-02.3's rule arriving on the day. */
    if (!kind) {
      const saves = template.category === 'file';
      return [{
        template,
        count: 0,
        state,
        testid: `day-output-${day}`,
        about: `${day}·${scope.length}·${template.id}`,
        /* ⚠ NO OBJECT, NO ACT — the rule every paper seat already keeps. A `file` seat on a day
           the round has yet to reach states «Ready when orders arrive» and used to keep a live
           press beside it, which saved an empty file and said «Order file saved · 0 orders». */
        onPrint: !saves
          ? () => openExportCentre(template.id)
          : scope.length === 0
            ? undefined
            : () => {
            const result = downloadConfiguredFile(cast.sector, template, scope, day, priced, config.owner.name);
            writeTemplates(templates.map((held) => (held.id === template.id ? usedTemplate(held, new Date().toISOString()) : held)));
            /* THE SAME FILE, DESCRIBED IN THE SAME WORDS, AT EVERY DOOR (FEED-IA §246). Prep, the
               export centre and the recent-files row all name the artifact and what it weighs;
               this door said «N orders» and could state no size at all, so one file was three
               different things depending on where it was pressed. */
            const said = `${downloadWords(result.fileName, result.bytes)} · ${result.measures.deliveries} ${plural(result.measures.deliveries, 'delivery', 'deliveries')}`;
            toast({
              message: result.activitySaved
                ? `Saved ${said}.`
                : `Saved ${said}. Saving the activity stalled.`,
              actionMessage: 'Open the export centre',
              actionOnClick: () => openExportCentre(template.id),
            }, SNACK_DURATION.medium);
          },
      }];
    }
    /* A DAY SHEET IS ONE PAPER FOR THE WHOLE DAY, so its count is the sheet rather than the round:
       «1 left» is the number of documents this template still owes paper for, which is what every
       other seat's count means (OUT-03.3). */
    const count = template.category === 'day-sheet' ? (scope.length ? 1 : 0) : owed.length;
    const subject: PaperSubject = template.category === 'packing'
      ? { kind: 'packing', day, salesIds: (bay.length ? bay : scope).map((sale) => sale.id) }
      : template.category === 'day-sheet'
        ? { kind: 'day', day, salesIds: scope.map((sale) => sale.id) }
        : { kind: 'day', day, run: 'albaranes', salesIds: (fresh.length ? fresh : scope).map((sale) => sale.id) };
    return [{
      template,
      count,
      state,
      testid: kind === 'albaranes' ? `day-albaranes-${day}` : kind === 'packing' ? `day-packing-${day}` : `day-sheet-${day}`,
      about: `${day}·${scope.length}·${template.id}`,
      onPrint: scope.length > 0 ? () => setPrinting({
        subject,
        templateId: template.id,
        scope: {
          coverage: 'remaining', period: 'day', day,
          selectedIds: scope.map((sale) => sale.id),
        },
      }) : undefined,
    }];
  }), [templates, cast.sector, config.owner.name, priced, toast, writeTemplates]);

  /** THE TAP-THROUGH (§25.2). «Tapping the sticky thing taps the thing in the feed.» It selects the
   *  sale, opens its document exactly as the row would, and walks the river to the row so the
   *  person can see the thing they just acted on sitting in its own day. A target outside the
   *  narrow RELEASES the narrow on the way (§27) — urgency ignores the filter. */
  const tapThrough = (id: string) => {
    const sale = operationalSales.find((s) => s.id === id);
    setView(sale?.archived ? 'archived' : 'all');
    if (narrow && sale && sale.day !== narrow) setNarrow(null);
    open(id);
    setLanded((prev) => ({ id, n: (prev?.n ?? 0) + 1 }));
  };

  /* A live provider order can land several future-day groups below the current viewport or behind
     any of the river's composable narrows. Its quiet notice uses the existing Sales snackbar; only
     an explicit Open clears those narrows and takes the established row landing path. */
  React.useEffect(() => {
    const current = new Set(sourceOrders.map((sale) => sale.id));
    const known = knownSourceOrders.current;
    if (!known || known.sector !== cast.sector) {
      knownSourceOrders.current = { sector: cast.sector, ids: current };
      return;
    }
    const fresh = sourceOrders.filter((sale) => !known.ids.has(sale.id));
    knownSourceOrders.current = { sector: cast.sector, ids: current };
    const newest = fresh[fresh.length - 1];
    if (!newest) return;
    toast({
      message: fresh.length === 1
        ? `New order from ${newest.customer.name}`
        : `${fresh.length} new orders`,
      focus: false,
      actionMessage: 'Open',
      actionOnClick: () => {
        setView('all');
        setNarrow(null);
        setMine(null);
        setQuery('');
        open(newest.id);
        /* A filtered river can retain a large scroll offset while React reveals all rows. Position
           the exact row on the first committed frame, then let the ordinary 400ms landing light
           identify it. Native long-distance smooth scrolling can otherwise outlive that cue. */
        window.requestAnimationFrame(() => {
          const row = document.querySelector<HTMLElement>(`[data-river-row="${newest.id}"]`);
          const port = panes ? listPane.current : null;
          if (row && port) {
            const top = row.getBoundingClientRect().top - port.getBoundingClientRect().top
              + port.scrollTop - 16;
            port.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
          }
          setLanded((previous) => ({ id: newest.id, n: (previous?.n ?? 0) + 1 }));
        });
      },
    }, SNACK_DURATION.medium);
  }, [sourceOrders, cast.sector, toast]);

  /* AND THE SAME WALK IS PUBLISHED (see `landOn` at the head of this file, and `anchors.tsx` for
     the scheme). The hook holds the latest closure — `tapThrough` reads the narrow and the ledger,
     both of which change under it — while the registration happens once for the surface's life,
     and it reads `#/sales/<id>` on arrival so an order's own address opens the order. */
  useLanding('order', tapThrough, () => { setSelected(null); setPrinting(null); });

  /* THE WALK, AND THE LIGHT. The scroll waits a frame for the row to exist — a released narrow has
     to re-draw the day before anything can be scrolled to — and it clears the frame's own sticky
     bar and the band standing under it, so the row it walked to is a row a person can actually see.
     On a phone the panel takes the screen and there is no river to walk; the light is still set, so
     the row is lit when they come back to it. */
  /* AND IT IS THE TRAVEL'S OWN LANDING TOO (§111.1). The journey ends where every other walk on
     this surface ends — the row scrolled into the pane and lit for a moment — so there is ONE
     grammar for «you are here» rather than a second one minted for the roulette. Anyone who asked
     for less motion is put there without the ride. */
  React.useEffect(() => {
    if (!landed) return;
    const ride: ScrollBehavior = still ? 'auto' : 'smooth';
    const walk = window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-river-row="${landed.id}"]`);
      if (!row) return;
      /* THE PANE IS WHAT MOVES (§38). Inside it the chrome is already above the scrollport, so
         there is nothing at all to clear on a desk — the band that used to stick here is gone
         (§67.6), and the query that measured it went with it rather than being left to return
         null forever on a testid nothing renders. */
      const port = panes ? listPane.current : null;
      if (port) {
        const top = row.getBoundingClientRect().top - port.getBoundingClientRect().top
          + port.scrollTop - 16;
        port.scrollTo({ top: Math.max(0, top), behavior: ride });
        return;
      }
      /* on a phone the header block sticks INSIDE the page's scroll, so it is chrome the walk has
         to clear exactly as the frame's own bar is (§51.4) */
      const top = row.getBoundingClientRect().top + window.scrollY - chromePx(theme) - headerH - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: ride });
    });
    const out = window.setTimeout(() => setLanded(null), LANDED_MS);
    return () => {
      window.cancelAnimationFrame(walk);
      window.clearTimeout(out);
    };
  }, [landed, theme.sizing, panes, headerH, still]);

  /* ══ THE THREE QUICK VERBS AND THE ONE WAY BACK (checkpoint §14.2e/f · §9) ═══════════════════
   * «Quick accept / clarify / handoff; Undo.» Each is one press, each says what it did, and each
   * offers the way back for the seconds a slip takes to notice (FEED-IA §76). The ACTS themselves
   * live in `detail.tsx` beside the document they act on — this is the river calling them, and the
   * dock's own controls call the same ones (§27.5).
   */

  /** THE REVERSAL (§14.2f). One press takes back one act — the last one — and says so. */
  /* ── THE TOAST MAY NOT TAKE THE CARET (checkpoint §14.2) ──────────────────────────────────
   * Base's snackbar focuses its own action button and hands focus back when it goes. For a hand on
   * a mouse that is right; for a hand on the home row it is a trap: for the four seconds the toast
   * stands, ENTER presses «Undo» instead of entering the next document, so accepting an order and
   * carrying straight on would quietly take the acceptance back. The two modes are kept apart
   * instead — the keyboard's undo is U, and the button on the toast is the pointer's — so the
   * toast never moves the caret at all. */
  const said = (message: string, action?: { actionMessage: string; actionOnClick: () => void }) => {
    toast({ message, focus: false, ...(action ?? {}) }, SNACK_DURATION.short);
  };

  const undo = () => {
    const act = undoReviewAct();
    if (act) said(`Taken back · ${act.says}`);
  };

  /* ── ONE PLACE ANNOUNCES, WHATEVER RAISED THE ACT (§76 · §27.5) ────────────────────────────
   * A review act can come from three doors — a key on the pile, a control on the dock, a value
   * written on a line two panes away — and every one of them owes the same feedback: what it did,
   * and the way back. So the ACTS record themselves and this watches the record, rather than each
   * door remembering to speak. A door that forgot would be an act with no Undo on screen, which is
   * exactly the silence §76 is about. */
  const act = useReviewAct();
  const announced = React.useRef<ReviewAct | null>(null);
  React.useEffect(() => {
    if (!act || act === announced.current) return;
    announced.current = act;
    said(act.says, { actionMessage: 'Undo', actionOnClick: () => undo() });
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- the act is the event */
  }, [act]);

  /* ── THE TRAVEL LIFTS ON ITS OWN (FEED-IA §111.1) ──────────────────────────────────────────
   * The smear is held for `TRAVEL_MS`, which is about as long as the pane's own smooth scroll runs,
   * and then it lifts on `timing400`/`easeOutCurve` — the deceleration IS the settle, and it is the
   * curve every other arrival on this surface already uses. A second travel inside the first
   * replaces the timer rather than stacking one, so an erratic hand cannot leave the river blurred.
   */
  React.useEffect(() => {
    if (!travelling) return;
    const t = window.setTimeout(() => setTravelling(null), TRAVEL_MS);
    return () => window.clearTimeout(t);
  }, [travelling]);

  /** WHERE THE FLOW GOES AFTER THIS ONE (§51.25: «settle one, arrive at the next»). The flow's own
   *  order first — the one that FOLLOWED it while both were standing — then the river's, so a verb
   *  on a document that stays standing still carries the person onward rather than leaving them on
   *  the thing they have just dealt with. */
  const after = (id: string): string | null => {
    const ids = flow.map((s) => s.id);
    const at = ids.indexOf(id);
    if (at >= 0 && ids[at + 1]) return ids[at + 1];
    const here = list.findIndex((s) => s.id === id);
    return here >= 0 && list[here + 1] ? list[here + 1].id : null;
  };

  const arrive = (id: string) => {
    const next = after(id);
    if (!next) return;
    setSelected(next);
    setSwept(false);
  };

  /** ── WHERE A TRAVEL COMES TO REST (FEED-IA §111.1) ─────────────────────────────────────────
   *  The next document down the DRAWN list that stopped — the standing altitude's own predicate,
   *  asked exactly as the river asks it below, so the thing the travel lands on is by construction
   *  a thing the river drew as standing. It NEVER WRAPS: a river with nothing left to check has
   *  nowhere to travel to, and a journey that loops back to the top is the same morning twice
   *  (the sweep's own reasoning, §32.A). `null` means «there is nothing ahead» and the press falls
   *  back to a plain step. */
  const stopAfter = (from: number, by: number): Sale | null => {
    for (let i = from + by; i >= 0 && i < list.length; i += by) {
      const s = list[i];
      if (isStanding(s, todayKey) || s.state === 'disputed') return s;
    }
    return null;
  };

  /* ── «ANSWER THEM» OPENS THE CONVERSATION (FEED-IA §110) ────────────────────────────────────
   * «They need to answer a message themselves — which Rocoto will then monitor to learn, like a
   * co-present thing.» So this job's door is the CHAT, not the sheet: the thread is the place the
   * sentence gets written, and it is where Rocoto's withheld reading is standing offered above the
   * composer (§9.11, §83.2). The thread's identity IS the customer's, which is the door `chatNotices`
   * has always handed the widget — so the pile and the notice open the same conversation.
   * THE DOCUMENT COMES WITH THEM: the selection moves to it, so the sheet beside the chat is the
   * order they are answering about rather than whatever was last open. */
  const answerIn = (s: Sale) => {
    setSelected(s.id);
    focusThread(cast.sector, s.customer.id);
  };

  /** IT REPORTS WHETHER THE ACT LANDED (FEED-IA §115.3). The quick check's film plays beats 3 and
   *  4 — «the order shows a change happening, and then it gets saved» — and those beats are a
   *  CLAIM ABOUT THE LEDGER. Where the hard guard took the press instead, nothing happened to the
   *  document, so the card leaves and lets the guard speak rather than filming a change that is
   *  not there. */
  const quick = (s: Sale): boolean => {
    /* NO VERB, NO KEY. `callOf` is what decides whether the ACCEPT key has anything to do — «a made
       albarán carries none, because a done thing is quiet». Without this, A on a settled document
       would append an event the statechart ignores and the toast would announce something that did
       not happen. It is the key's own gate; the card's verb is `jobOf`'s (§110). */
    if (!callOf(s)) return false;
    /* THE ANSWER IS NOT A QUICK ACT (§9.2). There is no shorter door to a sentence somebody has to
       write, so the key opens the document where the composer already is. */
    if (s.needsReply) {
      open(s.id);
      return false;
    }
    const act: GateAct = s.state === 'committed' ? 'make' : 'commit';

    /* ══ THE LOT PROPOSAL IS A BEAT, NOT A DIALOG (FEED-IA §115.3) ═══════════════════════════
     * MEASURED DEFECT, and it is the one that made the film unplayable: `wants()` is
     * «no lote yet, and this family needs one», which is TRUE OF EVERY LINE OF EVERY ARRIVING
     * ORDER in a house that sells fish. So `gateNeeded` was true on essentially every document
     * the quick check could open, `askOrAct` handed every press to the guard, nothing reached the
     * ledger, and the card closed on beat 2 having filmed nothing. A probe on the built bundle
     * read `confirm` at +80ms, `confirm` at +380ms and an unmounted card at +680ms.
     *
     * AND THE FIX IS THE LAW ITSELF, NOT A WORKAROUND. «The order shows a change happening, and
     * then it gets saved. No progress bars, no are-you-sure.» The guard's FIRST phase was never a
     * question: Rocoto has read the batch book, it knows the answer, and the dialog existed to
     * offer it. That offer IS the change §115.3 wants watched — the lotes landing on the lines —
     * so it is performed here and shown in beat 3 rather than described in a modal.
     *
     * WHAT IS STILL THE GUARD'S. Anything the proposal could not answer — a line with no stock
     * behind it, an amount that never read — is a MISSING FACT rather than a second yes, and it
     * keeps its own surface. The card stands down and lets it speak.
     *
     * IT IS THE CONTROL'S OWN SEQUENCE, LIFTED. `ConfirmGate.apply` does exactly this — attach,
     * re-propose, re-guard, perform — with the same writers, so the card and the dialog can never
     * act differently on one document. And the whole of it rides inside ONE `reversible`, so the
     * lotes and the commit take back together on a single Undo.
     *
     * ══ AND THE BOOK IS SPENT BY THE DAY, NOT BY THE LEDGER ═══════════════════════════════════
     * THE SECOND MEASURED DEFECT, and it is the one that was actually blocking every press.
     * `proposeLots(cast, sale, day)` names its third parameter `day` and its own line says «with
     * the rest of THE DAY'S allocations already spent». It was being handed `sales` — the WHOLE
     * ledger, five days and six hundred documents of it — so the batch book was spent against
     * albaranes that left the building on Monday. A headless run of the fold reads it exactly:
     * over the whole ledger `taken` is L-2208=3200 of qty 3200, L-2219=950 of 950, every batch to
     * the pixel, so `spare <= 0` everywhere and Rocoto could propose NOTHING. Scoped to the day it
     * proposes for every line and the act lands.
     *
     * SO IT WAS NEVER A GUARD ABOUT A REAL MISSING FACT. The lotes were on the shelf the whole
     * time; the arithmetic was being done over the wrong shelf. That is also the «what's the ARE
     * YOU SURE thing?» a person was meeting on a document that needed nothing of the kind — the
     * dialog was opening on its second phase because its first had been starved.
     *
     * THE SAME SCOPE DECIDES EVERY STEP OF THE ACT, which is why `askOrAct` is handed it too:
     * `gateNeeded` re-asks `proposeLots` inside, and one act judged on two different books is how
     * a control comes to disagree with itself. */
    const book = sales;
    const picks = inventoryAvailable ? proposeLots(cast, s, book, allocationCandidates).map((p) => ({ line: p.line.id, allocations: p.allocations, stockRevision: allocationBook.revision })) : [];
    const next = picks.length > 0 ? withPicks(s, picks) : s;
    if ((inventoryAvailable && proposeLots(cast, next, book, allocationCandidates).length > 0) || (inventoryAvailable ? guardsOf(cast, next) : guardsOf(cast, next).filter((guard) => guard.id !== 'law')).length > 0) {
      setGate({ id: s.id, act });
      return false;
    }

    /* IT IS REVERSIBLE NOW, AND THE GUARD STILL GATES IT. `askOrAct` either acts or asks; where it
       asks, nothing lands on the ledger and nothing is announced — the dialog is the feedback. */
    /* AND THE TOAST SPEAKS THE RIVER'S OWN WORD (FEED-IA §110 · §111.1). The card said «Check it»
       and the act said «It's right», so a toast saying «Confirmed» would be the third word for one
       act — which is exactly the «why is there Confirm AND Resolve» this pass is answering. The
       river's vocabulary is the check's, end to end; the sheet's dock keeps its own, because a
       dock is not the review surface. */
    const words = act === 'make' ? `Delivery Note made · ${s.customer.name}` : `Checked · ${s.customer.name}`;
    if (reversible(words, () => {
      /* THE PROPOSAL LANDS FIRST, so the document `askOrAct` judges is the one the person is about
         to be shown — `gateNeeded` reads the sale it is handed, and handing it the stale one is
         what sent every press to the guard. */
      if (!attachLots(s, now, picks)) {
        toast({ message: 'Saving this allocation stalled. Open the Delivery Note to review your choices.' });
        setGate({ id: s.id, act });
        return;
      }
      askOrAct(cast, next, book, act, now, () => setGate({ id: s.id, act }), inventoryAvailable, allocationCandidates);
    })) {
      arrive(s.id);
      return true;
    }
    return false;
  };

  const clarify = (s: Sale) => {
    if (clarifySale(s, now)) arrive(s.id);
  };

  const hand = (s: Sale) => {
    if (handoffSale(s, company, now)) arrive(s.id);
  };

  /* ── THE CHECK IS SEEN BEFORE IT IS ANSWERED (FEED-IA §111.1) ──────────────────────────────
   * «They can't just confirm to understand it.» The accept key used to be a blind yes: one press
   * on a document a person had not necessarily looked at, and the toast afterwards was the whole
   * of what they saw. That is exactly the impression V3 sends this pass after.
   * So the key OPENS THE CHECK instead of answering it, and the answer is one more press inside a
   * card that is showing the thing being answered. The mnemonic is unchanged (A for the accept),
   * the machine act underneath is unchanged (`quick`, which is `askOrAct`), and what changed is
   * that the confirmation is now visible before it happens.
   * A DOCUMENT WITH NOTHING TO SEE FALLS STRAIGHT THROUGH: no job, no card, and the key does what
   * it always did — which on a settled document is nothing at all. */
  const checkIn = (s: Sale, from: DOMRect | null) => {
    const job = jobOf(s, company);
    /* NO JOB, NO CARD. The same gate `jobOf` already puts on the row's verb, so a key can never
       raise a card the row would not have drawn. */
    if (!job) return;
    /* THE SHEET COMES WITH IT (§17.1). The card is a compression of the document, so the pane
       behind it holds the document — a person who presses «Open the albarán» is then reading the
       thing that was already standing there rather than watching the surface change under them. */
    setSelected(s.id);
    setChecking({ id: s.id, from, job, open: true });
  };

  /** THE CARD LEAVES THE WAY IT CAME (§111.1). Lowering the flag starts the fold back into the row;
   *  the subject is cleared once the exit has finished painting. */
  const closeCheck = () => setChecking((c) => (c ? { ...c, open: false } : null));

  React.useEffect(() => {
    if (!checking || checking.open) return;
    const t = window.setTimeout(() => setChecking(null), EXIT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [checking]);

  /* ── THE CARET FOLLOWS THE WALK (checkpoint §14.2b, and the walk's own P1-9) ────────────────
   * «Click a row, then ← →: the sheet walks 1 → 2 → 3 of 619 while focus stays on the clicked
   * row's button, so Enter belongs to that button and re-opens document 1.»
   *
   * TWO CURSORS FOR ONE POSITION IS THE WHOLE DEFECT. The pile has a selection (what the sheet is
   * showing) and the page has a focus (what the keyboard is standing on), and every key in §32.A's
   * circuit reads one of them. So they are made the same thing: a walk moves the selection AND the
   * caret, and after that Enter, Tab and the three verbs all speak about the document on screen.
   *
   * IT DOES NOT SCROLL. `preventScroll` is the whole of §32.A's «the eyes do not move»: the panel
   * stands still and the next order slides into it, and dragging the river a thousand pixels under
   * a walking hand is the thing that rule exists to forbid. The ROW is what takes the caret — the
   * flat row is itself a button, the standing card's door is the stretched layer inside it — so a
   * walk lands on the same control a pointer would have pressed. */
  const walkedTo = React.useRef<string | null>(null);
  React.useEffect(() => {
    const id = walkedTo.current;
    if (!id) return;
    walkedTo.current = null;
    const row = window.document.querySelector<HTMLElement>(`[data-river-row="${id}"]`);
    if (!row) return;
    const door = row instanceof HTMLButtonElement
      ? row
      : row.querySelector<HTMLElement>(`[data-testid="open-${id}"]`);
    door?.focus({ preventScroll: true });
  }, [selected]);

  /* ── THE SWEEP LOOP (FEED-IA §32.A) ──────────────────────────────────────────────────────
   * «They check the fine ones too. The design owes them SPEED: the detail open, eyes scan a fixed
   * anatomy, P prints and ADVANCES to the next, arrows walk without printing, Esc out.»
   *
   * THE WHOLE POINT IS THAT THE EYES DO NOT MOVE. The panel is sticky against the viewport and the
   * document inside it is replaced in place, so pressing P puts paper on the printer and slides the
   * next order into the same spot at the same size in the same anatomy. Nothing here scrolls the
   * river: walking the reader to the row is what the BAND's tap-through is for (§25.2), and doing
   * it on every press would drag the reader's eye a thousand pixels between orders.
   *
   * IT STOPS AT THE END. The flip WRAPS, because flipping is reading on and a reader who reaches
   * the end wants to keep reading. A sweep does not: it is a finite pass over a finite list, and a
   * loop that silently starts again is a morning printed twice. So the last P says so and stands
   * still.
   *
   * ═══ FOCUS DISCIPLINE IS THE WHOLE GAME ═════════════════════════════════════════════════════
   * A single letter with no modifier is the fastest shortcut there is and the easiest to fire by
   * accident, so ONE listener owns all of it and it stands down whenever a person is doing anything
   * else. It never acts while:
   *
   *   · a field has focus — an input, a textarea, a select, a combobox, anything editable. Typing
   *     «pescado» into a name field may not print four albaranes.
   *   · an overlay is open — the lot proposal, the customer's record, the chats widget, a popover
   *     or a menu. Something is on top; the keys belong to it.
   *   · a value on a line is open (`[data-editing]`). The person is mid-edit on the very document
   *     P would print, and the editor owns its own Esc (`detail.tsx`).
   *   · a modifier is down, or another handler already took the key.
   *
   * AND THE PHONE HAS NO KEYBOARD, so it has none of this: the effect leaves before it registers.
   */
  React.useEffect(() => {
    if (phone) return;
    const ours = (taken: boolean): boolean => {
      const el = window.document.activeElement as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return false;
        if (el.closest('[role="combobox"],[role="listbox"],[role="dialog"],[role="alertdialog"]')) return false;
        /* ── AND ENTER BELONGS TO WHATEVER IS FOCUSED (checkpoint §14.2b) ──────────────────────
         * A letter is safe on a focused button — nothing consumes «p» — but Enter and Space are
         * that button's OWN press. So the one key another control already claims stands down for
         * it: tabbing to «Print it» and pressing Enter prints, rather than opening the document
         * under the button somebody was aiming at.
         *
         * EXCEPT THE ROW THE WALK IS STANDING ON (the walk's P1-9). Clicking a row is the only way
         * into the pile with a pointer, and it leaves the caret on that row's own door: the walk
         * then moved the selection while the door stayed where it was, so Enter re-opened the row
         * a person had left three presses ago. Focus follows the walk now (below), and the row
         * under the caret IS the selected one — so its Enter is exactly §14.2b's press, and the
         * keyboard takes it rather than standing down for a door onto the document already open. */
        if (taken && el.closest('button,a[href],summary,[role="button"],[role="link"]')) {
          const row = el.closest('[data-river-row]');
          if (!row || row.getAttribute('data-river-row') !== selected) return false;
        }
      }
      return !overlayOwnsKeys();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const walk = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      /* ── THE RIVER'S OWN AXIS, AND THE ONE THAT TRAVELS (FEED-IA §111.1) ────────────────────
       * «They'd be erratically pressing the down button.» The horizontal pair walks the SHEET —
       * that is §32.A's flip, one document at a time, the eyes not moving — and the vertical pair
       * walks the RIVER, which is the axis the river actually runs on and the button he names. Both
       * step one row on a single press; only the vertical one accumulates into a journey, because
       * the journey is a scroll and the sheet's flip deliberately never scrolls anything. */
      const rides = e.key === 'ArrowDown' || e.key === 'ArrowUp';
      const prints = e.key === 'p' || e.key === 'P';
      /* ── THE THREE VERBS AND THE UNDO, AS SINGLE LETTERS (checkpoint §14.2e/f) ──────────────
       * §32.A decided the grammar — «single letters, no modifiers» — and had spent exactly one of
       * them: P. A · C · H · U were audited free across the whole app before they were taken, and
       * they are the words' own initials, which is the only mnemonic a hand keeps at flip speed:
       * Accept · Clarify · Hand off · Undo. Nothing here takes a modifier, so Ctrl+Z is still the
       * browser's and the page never fights the platform for it. */
      const letter = e.key.length === 1 ? e.key.toLowerCase() : '';
      const verb = letter === 'a' || letter === 'c' || letter === 'h';
      const undoes = letter === 'u';
      const enters = e.key === 'Enter';
      if (!walk && !rides && !prints && !verb && !undoes && !enters && e.key !== 'Escape') return;
      if (!ours(enters)) return;

      /* ESC RELEASES THE INNERMOST THING FIRST. An open editor owns it (detail.tsx); then the word
         somebody typed; then the day; then whose accounts these are; then nothing — the desk's
         panel is always there (§17.1) and a key may not take away the thing the surface promises is
         always on screen.
         THE FIELD ITSELF TAKES THE FIRST ESCAPE while it has focus (`search.tsx`), and this handler
         never runs while an input is focused. So the two are the same rule seen from either side:
         Escape always releases the word before it releases the day. */
      if (e.key === 'Escape') {
        if (window.document.querySelector(EDITOR)) return;
        if (query) {
          e.preventDefault();
          search('');
        } else if (view !== 'all') {
          e.preventDefault();
          setView('all');
          setSelected(null);
        } else if (narrow) {
          e.preventDefault();
          setNarrow(null);
        } else if (mine) {
          e.preventDefault();
          scopeTo(null);
        }
        return;
      }

      /* mid-edit, the document is not ready to be printed or left */
      if (window.document.querySelector(EDITOR)) return;

      /* ── UNDO IS ABOUT THE LAST ACT, NOT ABOUT THE SELECTION (checkpoint §14.2f) ────────────
       * It stands before every other branch and asks nothing of the river: a person who has just
       * confirmed the wrong document and walked on still means «take that back». It is a no-op
       * with nothing in the slot, which is why it can be unconditional. */
      if (undoes) {
        e.preventDefault();
        undo();
        return;
      }

      if (list.length === 0) return;
      const at = list.findIndex((s) => s.id === selected);
      e.preventDefault();

      /* ── ENTER OPENS THE FOCUSED DOCUMENT (checkpoint §14.2b) ───────────────────────────────
       * On the desk the sheet is already standing beside the list — §17.1 promises it always is —
       * so «open» here means putting the KEYBOARD inside it: the first line opens and the caret
       * lands on the first value that can be written, selected. Tab carries it along the ring from
       * there, and Escape walks back out the way it came. */
      if (enters) {
        if (at >= 0 && !list[at].archived) enterDocument(list[at].id);
        return;
      }

      /* ── THE THREE VERBS, ON THE FOCUSED DOCUMENT (checkpoint §14.2e) ───────────────────────
       * Each one is the press its own control on the dock makes, so nothing a key does is
       * unreachable with a pointer and nothing a control refuses is reachable with a key. Settling
       * one arrives at the next (§51.25) — including where the act leaves the document standing,
       * because a question put to a customer is a disposal of the desk's attention even though the
       * document is still waiting on them. */
      if (verb) {
        const here = at < 0 ? null : list[at];
        if (!here || here.archived) return;
        /* A IS THE CHECK, SEEN (§111.1). Where the document has a job to check, the key raises the
           quick check instead of answering blind; everywhere else it is the act it always was. */
        if (letter === 'a') {
          const job = jobOf(here, company);
          if (job?.id === 'check') {
            const row = window.document.querySelector<HTMLElement>(`[data-river-row="${here.id}"]`);
            checkIn(here, row?.getBoundingClientRect() ?? null);
          } else {
            quick(here);
          }
        } else if (letter === 'c') clarify(here);
        else hand(here);
        return;
      }

      if (walk) {
        const by = e.key === 'ArrowRight' ? 1 : -1;
        const from = at < 0 ? 0 : at;
        const to = list[(from + by + list.length) % list.length];
        setSelected(to.id);
        setSwept(false);
        /* AND THE CARET GOES WITH IT (P1-9). The walk moves what the eye is on; leaving DOM focus
           behind on the row a hand last clicked is how Enter came to belong to one document while
           the sheet showed another. The row it landed on takes the focus after the paint. */
        walkedTo.current = to.id;
        return;
      }

      /* ══ ↓ ↑ · THE STEP, AND THE TRAVEL (FEED-IA §111.1) ═══════════════════════════════════
       * One press steps one row, exactly as ← → do. A RUN of presses — `TRAVEL_PRESSES` of them
       * inside `TRAVEL_WINDOW_MS` of each other, which is a hand moving faster than a person can
       * read — stops being a walk and becomes a journey: the river smears, scrolls, decelerates and
       * SETTLES on the next document that stopped. That is the roulette; the deceleration is the
       * whole of what makes it one.
       *
       * IT LANDS ON SOMETHING REAL OR IT DOES NOT LAND. `stopAfter` walks the drawn list for a
       * document at the standing altitude, in the direction the hand is going, WITHOUT WRAPPING —
       * so a river with nothing left to check simply steps, and the surface never invents a
       * destination to make the gesture feel good.
       *
       * THE SETTLE IS THE WALK'S OWN LIGHT (§25.2). `setLanded` is the same landing the band's
       * tap-through has always used — the row scrolls into view and wears the ring for a moment —
       * so a travel arrives the way every other walk on this surface arrives, and there is one
       * grammar for «you are here» rather than two.
       */
      if (rides) {
        const by = e.key === 'ArrowDown' ? 1 : -1;
        const from = at < 0 ? 0 : at;
        const beat = performance.now();
        /* A HELD KEY IS ONE LONG WALK, NEVER A JOURNEY. The OS repeats a held arrow every ~30ms,
           which would clear the threshold instantly and then clear it again the moment the run was
           spent — a river strobing under a finger nobody had lifted. `e.repeat` is the difference
           between a hand PRESSING and a hand LEANING, and only the first one is the gesture §111.1
           describes; a held key walks row by row, which is what a held arrow does in every list. */
        run.current = e.repeat
          ? { at: beat, n: 0 }
          : beat - run.current.at <= TRAVEL_WINDOW_MS
            ? { at: beat, n: run.current.n + 1 }
            : { at: beat, n: 1 };
        const stop = run.current.n >= TRAVEL_PRESSES ? stopAfter(from, by) : null;
        const to = stop ?? list[(from + by + list.length) % list.length];
        setSelected(to.id);
        setSwept(false);
        walkedTo.current = to.id;
        if (stop) {
          /* THE RUN IS SPENT ON ARRIVAL. Without this the next press would travel again from a row
             the person has not looked at yet, which is a surface that runs away from a hand. */
          run.current = { at: beat, n: 0 };
          setTravelling(to.id);
          setLanded((prev) => ({ id: to.id, n: (prev?.n ?? 0) + 1 }));
        }
        return;
      }

      /* P = PRINT + ADVANCE. The press is exactly the dock's press — the same job, on the same
         queue, counted by the same badge — so the sweep is the loop a person already knows with
         the mouse taken out of it. ON A CLOSED, UNCHANGED DOCUMENT IT ONLY ADVANCES (§29: the
         button counts «new = arrived or changed since paper last came out» — a sweep that prints
         duplicates of finished work would make the person track what the button exists to count).
         Printing a closed one again stays a deliberate CLICK on the dock's «Print it again». */
      if (at < 0) return;
      const here = list[at];
      if (here.archived) return;
      const closedAndSettled = Boolean(here.printed) && !here.printed?.stale;
      /* AND THE KEY OBEYS THE SAME STANCE THE BUTTON DOES (FEED-IA §58.1). P is the dock's press
         with the mouse taken out of it, so a document whose paper is HELD — unconfirmed, or still
         standing for review — is walked past rather than printed. A shortcut that could do what
         the control it stands for refuses is the worst kind of hidden act. */
      const held = !exportStance(here, todayKey, railWorld(cast)).paper.live;
      const unconfirmed = packingJobs.some((job) => job.subject.kind === 'albaran' && job.subject.sale === here.id && job.state !== 'printed');
      if (!closedAndSettled && !held && !unconfirmed) void printSourceRun({ idempotencyKey: newPrintAttemptKey(`albaran:${cast.sector}:${here.id}`), title: `Delivery Note ${here.number}`, cast, derived, sales: [here], makeOrders: (snapshot) => [albaranOrder(snapshot[0], now, config.emailFeed)] });
      const next = list[at + 1];
      if (next) {
        setSelected(next.id);
        setSwept(false);
      } else {
        setSwept(true);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    /* THE VERBS READ THE MORNING, so the listener is re-hung when the morning moves: `sales` is
       what an act is taken against, `flow` is where the flip goes next, and `company` is who a
       handover names. A closure over a stale one of those is a key acting on yesterday. */
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- the acts are re-made every render */
  }, [phone, list, flow, sales, selected, narrow, mine, query, view, now, config.emailFeed, cast, company, todayKey, packingJobs, derived]);

  /* ── THE ARRIVAL SEAM (§26.6), BEHIND ITS OWN FLAG (§31.4) ───────────────────────────────
   * «Processing overlaps ordering — and it is not a mode.» The prototype has no outside: nothing
   * can reach it over a wire, so the only way to JUDGE that claim — rather than assert it — is to
   * be able to land a real order while a document sits open mid-edit and watch what the surface
   * does. This is that handle and it is deliberately not a control: an arrival is not something a
   * person in this trade does, and a button for it would be a lie about who sends orders.
   *
   * AND A BARE HANDLE ON THE WINDOW IS A SEAM. «Make sure that everything is done» — a global that
   * writes to the day's ledger, hanging off every page a person opens, is a door left in the wall
   * because it was convenient for a test. It is asked for by name now: `app.html?test` arms it and
   * nothing else does, so the drive keeps its handle and the app has no handle at all. */
  React.useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('test')) return;
    const w = window as unknown as { rocotoArrive?: (offset?: number) => void };
    w.rocotoArrive = (offset = 0) => arriveSale(cast, offset, now);
    return () => {
      delete w.rocotoArrive;
    };
  }, [cast, now]);

  /* ── THE ANCHOR (§5.2, §6.4) ─────────────────────────────────────────────────────────────
   * The band stands at the head of the surface, because «exceptions standing on top» is the first
   * sentence §6.4 writes about the feed. Below it the river runs horizon-first: scrolling DOWN
   * walks through today into the record, exactly as Monzo does, and scrolling UP walks back into
   * what the house has promised. Today is therefore not where the page opens — which is precisely
   * why §6.4 asks for «Jump to today», and why nothing here scrolls the page for the person. */
  const anchor = React.useRef<HTMLDivElement | null>(null);
  const [awayFrom, setAwayFrom] = React.useState<'up' | 'down' | null>(null);

  React.useEffect(() => {
    /* IT WATCHES THE THING THAT ACTUALLY SCROLLS (§38): the list pane on the desk, the page on the
       phone. Watching the window while the pane scrolled was the bug this refactor would have
       shipped — «Jump to today» frozen on whatever it read at first paint. */
    const port = panes ? listPane.current : null;
    const read = () => {
      const el = anchor.current;
      if (!el) return;
      const box = port ? port.getBoundingClientRect() : null;
      const top = el.getBoundingClientRect().top - (box ? box.top : 0);
      const height = box ? box.height : window.innerHeight;
      setAwayFrom(top > height - 80 ? 'down' : top < 0 ? 'up' : null);
    };
    read();
    const on: EventTarget = port ?? window;
    on.addEventListener('scroll', read, { passive: true } as AddEventListenerOptions);
    window.addEventListener('resize', read);
    return () => {
      on.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, [shown.length, narrow, panes]);

  /** «JUMP TO TODAY» — and from inside a narrow standing on another day it is a release as well,
   *  because today is the thing being asked for and a filter is never the answer to it (§27). */
  /* AND THERE IS NOWHERE TO JUMP TO WHEN THE WORD FOUND NOTHING (§35.1). A river drawing zero rows
     has no today on it, so a control offering to walk the reader to one is a button about a place
     that is not on the page. It comes back with the rows. */
  const elsewhere =
    (narrow ? narrow !== todayKey : awayFrom !== null) && !(searching && searched.length === 0);
  const jump = () => {
    if (narrow && narrow !== todayKey) {
      setNarrow(null);
      window.requestAnimationFrame(() =>
        anchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    const el = anchor.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ── THE HEADER BLOCK (FEED-IA §51.4) ─────────────────────────────────────────────────────
   * «Search is search, and WHOSE ACCOUNTS is visible AT ALL TIMES — never scrolls away.» One row,
   * carrying whose accounts these are, whichever day the river is narrowed to, and the seat you
   * type into. On the desk it is rendered ABOVE the list pane's scrollport — the literal reading of
   * «pane-sticky above the scroll», and the one that cannot be scrolled under; on the phone the page
   * is the scrollport, so it sticks under the frame's own bar and bleeds to the screen's edges.
   */
  const rowPolicy = React.useMemo(() => ({ grants, tiers, company }), [grants, tiers, company]);
  const rowActions = React.useRef<FeedRowActions>({ open, archive: () => {} });
  rowActions.current = {
    open,
    archive: (sale) => {
      reversible(`Delivery Note archived · ${sale.customer.name}`, () => archiveSale(sale, now, config.owner.name));
      if (selected === sale.id) setSelected(null);
    },
  };

  const headerBlock = (
    <div
      ref={header}
      data-testid="river-header"
      style={{
        ...(phone
          ? {
              position: 'sticky' as const,
              top: chromeTop(theme),
              /* under the modals, over the river (see STICKY_CHROME_LAYER) */
              zIndex: STICKY_CHROME_LAYER,
              /* THE PAGE'S OWN GUTTER IS THE FRAME'S, so a header that stopped at the content edge
                 would let the river show through on either side of it as it scrolled under. */
              margin: `0 -${theme.sizing.scale600}`,
              padding: `0 ${theme.sizing.scale600}`,
            }
          : {
              /* on the desk it is the pane's own first row, and it takes the pane's gutters so its
                 content stands on the same left edge as everything in the scroll below it */
              padding: `0 ${theme.sizing.scale900}`,
              flex: '0 0 auto',
            }),
        background: theme.colors.backgroundPrimary,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      <ScopeLine
        holders={holders}
        mine={mine}
        day={narrow}
        days={days}
        today={todayKey}
        onPick={scopeTo}
        onRelease={() => scopeTo(null)}
        /* §75.1 — the ONE seat that changes the day. The dividers below say which day their rows
           belong to and do nothing at all. */
        onPickDay={setNarrow}
        onShiftDay={shiftNarrow}
        /* «NEW ALBARÁN» MEANS A NEW ONE (§74.4, §74.5). It clears the held draft so the composer
           opens unborn — the one a person walked away from is not lost, it is standing in the
           drafts dropdown where they can pick it up. Resuming is the dropdown's job; this control
           is the blank sheet, and a control that quietly reopened yesterday's half-word would be
           the surface deciding what they meant. */
        onNew={() => { setView('all'); setSelected(null); setHeldDraft(null); setAskedFor(true); setComposing(true); }}
        /* ── THE RIVER'S SEARCH IS THE APP'S SEARCH (FEED-IA §91.2) ────────────────────────
           «All search should be like this in fact. Makes search VERY simple, or rather very
           consistent.» The field that used to expand in this row opens in the one modal now, and
           this control is what summons it — a mark while the river runs whole, and the STANDING
           WORD with its release while it does not. That second state is §51.25's own clause: an
           active narrow stays visible, so a river that has been thinned always says so. The
           filter itself is untouched: `search()` still sets the word and `matches` still runs. */
        search={
          <SearchSummon
            intent="everything"
            label="Find a customer, a product, a figure"
            testid="sales-search"
            query={query}
            onRelease={() => search('')}
          />
        }
        /* §249 — the whole book is the campaigns' input: the lines the price signal is matched
           against, the accounts that have gone quiet, and the orders a redemption is read from. */
        campaigns={(compact) => (
          <CampaignsAct scope={cast.sector} cast={cast} sales={sales} compact={compact} />
        )}
      />
      <div data-testid="sales-status-filters" aria-label="Orders to show"
        style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200,
          padding: `0 ${theme.sizing[GUTTER]} ${theme.sizing.scale300}`, minWidth: 0 }}>
        {([
          { id: 'all', label: 'All orders', count: undefined },
          { id: 'review', label: 'To review', count: reviewCount },
          { id: 'archived', label: 'Archived', count: archivedCount },
        ] as const).map((filter) => (
          <Button key={filter.id} kind={view === filter.id ? KIND.secondary : KIND.tertiary}
            size={SIZE.mini} data-testid={`sales-filter-${filter.id}`} aria-pressed={view === filter.id}
            onClick={() => { setView(filter.id); setSelected(null); setSwept(false); }}
            overrides={{ BaseButton: { style: { whiteSpace: 'nowrap', paddingLeft: theme.sizing.scale300,
              paddingRight: theme.sizing.scale300 } } }}>
            {/* ── THE COUNT THAT COUNTS FLAGGED THINGS IS WRITTEN IN THE RED (§196.3) ────
                A tally and the rows it counts are one claim; a grey «4» over four red-outlined
                rows is the same fact said in two vocabularies. Zero stays neutral — there is
                nothing red about nothing standing. */}
            {filter.label}{filter.count !== undefined && <span data-filter-count={filter.id}
              data-flag-count={filter.id === 'review' && filter.count > 0 ? 'yes' : 'no'}
              style={{ marginLeft: theme.sizing.scale200,
              color: filter.id === 'review' && filter.count > 0 ? flagInk(theme) : theme.colors.contentSecondary }}>{filter.count}</span>}
          </Button>
        ))}
      </div>
    </div>
  );

  /* The guide targets a named row rather than a structural `nth-of-type`: archive wrappers mean
     every actual row button is its wrapper's first button. The twenty-fourth rendered row still
     forces Joyride through the list pane's own scrollport. */
  let guideRiverRow = 0;

  /* ── THE RIVER ───────────────────────────────────────────────────────────────────────────── */

  const river = (
    <div
      data-testid="river"
      data-view={view}
      data-narrow={narrow ?? 'none'}
      data-scope={mine ?? 'all'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        /* the air at the head of the river, carried by the river rather than by the scrollport it
           lives in — a scrollport's top padding is where its sticky children pin */
        paddingTop: panes ? theme.sizing.scale700 : 0,
      }}
      /* ── WHAT THE SYSTEM DEFERRED, STATED ON THE SURFACE (§67.6 — the chat-notice seam) ─────
          The river does not DRAW a notification: the widget in `shell/` does, off `chatNotices`.
          What it does is say what the model answered, so the two can be checked against each
          other from outside and neither becomes the other's source of truth. */
      data-notices={notices.length}
      data-notice={notices.map((n: ChatNotice) => `${n.customer}:${n.label}`).join(' · ') || undefined}
    >
      {/* THE HEADER RIDES INSIDE THE SCROLL ON A PHONE, where there is only one scrollport, and
          stands above it on the desk (see the pane below) — one component, two housings. */}
      {phone && headerBlock}

      {/* ── AND THE QUESTIONS ARE A NUMBER ON THE WIDGET (FEED-IA §75.2) ─────────────────────
          «The Messages card at the river's top goes — it should just be a number on the widget.»
          So the river begins with the river. What was here — a row counting the asks and quoting
          the newest one — is now the count the chat launcher wears, off `unreadCount` in
          `shell/threads.ts`: ONE fold, one home for the fact, and the door to it is the door that
          was already standing in the corner of every screen. Nothing is drawn here in its place. */}

      {/* THE WORD FOUND NOTHING, AND THE SURFACE SAYS SO IN NUMBERS (§35.1). A count is a fact and
          the sentence under it is the next move, which is the whole of what this moment owes a
          person. */}
      {searching && searched.length === 0 && (
        <div
          data-testid="search-empty"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale200,
            padding: `${theme.sizing.scale900} ${theme.sizing[GUTTER]}`,
            minWidth: 0,
          }}
        >
          <span style={theme.typography.LabelLarge}>0 matches for “{query.trim()}”</span>
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            Try a customer, a product, a figure or a day.
          </span>
        </div>
      )}

      {/* ══ THE TRAVELLING LAYER — WHERE THE SMEAR LIVES (FEED-IA §111.1) ═══════════════════════
          «Scrolling with MOTION BLUR… landing on something like a ROULETTE or SLOTS interface.»

          IT IS A LAYER OF ITS OWN AND NOT THE RIVER ITSELF, for two reasons that are both
          mechanical. A `filter` opens a containing block and a stacking context, and the phone's
          header block STICKS inside the river — so blurring the river would be blurring the one
          piece of chrome §51.4 promises never leaves the screen. And the search's empty state is
          not part of the journey either. What travels is the days and their rows, which is exactly
          what this holds.

          THE SMEAR IS A DECELERATION. It arrives instantly and lifts on the surface's own
          `timing400`/`easeOutCurve` — the same pair every arrival here uses — so the landing reads
          as a wheel coming to rest rather than as an effect being switched off. `prefers-reduced-
          motion` gets none of it and lands on the same row at the same moment. */}
      {!searching && !narrow && searched.length === 0 && view !== 'all' && (
        <p data-testid="sales-filter-empty" style={{ ...theme.typography.ParagraphSmall,
          color: theme.colors.contentSecondary, padding: theme.sizing[GUTTER] }}>
          {view === 'review' ? 'Reviews are up to date.' : 'Archived delivery notes appear here, grouped by day.'}
        </p>
      )}

      <div
        data-testid="river-travel"
        data-travelling={travelling ? 'yes' : 'no'}
        data-landing={travelling ?? undefined}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          filter: travelling && !still ? `blur(${TRAVEL_BLUR}px)` : 'blur(0px)',
          willChange: travelling && !still ? 'filter' : undefined,
          transitionProperty: 'filter',
          transitionDuration: still ? '0ms' : theme.animation.timing400,
          transitionTimingFunction: theme.animation.easeOutCurve,
        }}
      >
      {(!searching || searched.length > 0) && shown.map((g) => {
        /* THE DAY'S ROUND: what its paper is about, and what of it is owed paper right now. */
        const scope = sheetSalesOf(g.sales);
        /* AND WHAT IS OWED PAPER EXCLUDES WHAT IS OWED A PERSON (§8.3 rules 1–2, AUDIT-2 C22). The
           exclusion lives inside `newPaperOf` now, so this ⎙ and the export centre's «To print»
           can no longer disagree, and this press can no longer put a standing crate on the van. */
        const fresh = newPaperOf(g.sales, todayKey);
        // Warehouse ticks never stand in for printed packing output. Keep this day's existing
        // scope, and omit only completed or already queued copies of the exact current revision.
        const unprintedPacking = remainingPackingSales(scope, cast.sector, packingHistory);
        const bay = unqueuedPackingSales(unprintedPacking, cast.sector, pendingPacking);
        const pendingReview = scope.filter((sale) => !sale.printed || sale.printed.stale).length;
        const packingQueued = unprintedPacking.length - bay.length;
        return (
          <React.Fragment key={g.day.id}>
            <div
              ref={g.day.id === todayKey ? anchor : undefined}
              data-testid={g.day.id === todayKey ? 'today-anchor' : undefined}
              /* THE ANCHOR IS WHAT «Jump to today» SCROLLS TO, so the chrome it has to clear is
                 ITS OWN margin and not the whisper's — a scroll margin on a child does nothing for
                 a `scrollIntoView` called on its parent, which is why the day's name used to land
                 under the header block on a phone. On the desk the header stands outside this
                 scrollport altogether (§51.4), so there is nothing to clear. */
              style={{
                minWidth: 0,
                scrollMarginTop: phone ? `calc(${chromeTop(theme)} + ${headerH}px)` : 0,
                position: 'sticky', top: dayHeaderTop, zIndex: STICKY_CHROME_LAYER - 1,
              }}
            >
              <DayWhisper
                group={g}
                today={todayKey}
                narrowed={narrow === g.day.id}
                cleared={view !== 'archived' && cleared.has(g.day.id)}
                archived={view === 'archived'}
                /* the only chrome a day jumped to has to clear is the header block, and only on a
                   phone — on the desk it stands outside this scrollport entirely (§51.4) */
                under={phone ? headerH : 0}
                paper={view !== 'archived' && (
                  <DayPaper
                    day={g.day.id}
                    seats={daySeats(g.day.id, g.day.label, scope, fresh, pendingReview, bay, packingQueued)}
                    onExportCentre={() => openExportCentre()}
                  />
                )}
              />
            </div>

            {/* A DAY DRAWS BOTH KINDS, AND KEEPS ALL OF ITS OWN (§25.2). What a person owes
                something stands where its day is; everything else is a quiet row. The ones the band
                indexes are here too — that is the whole mechanic. */}
            {/* THE ALTITUDE IS THE SELECTOR'S, NOT THE ROW'S (DENSE-BRIEF-DESIGN §1). One call to
                `isStanding` decides which of the two altitudes draws the sale AND rides the row as
                `data-owed`, so «no row floats without an open reason, no open reason lies flat» is
                a thing the DOM states about itself rather than a thing this branch promises. */}
            {g.sales.map((sale) => {
              const guideMarker = guideRiverRow++ === 23 ? 'pane-spike' as const : undefined;
              return <FeedRow key={sale.id} sale={sale} today={todayKey}
                selected={sale.id === selected} landed={sale.id === landed?.id} terms={terms}
                policy={rowPolicy} actions={rowActions} guideMarker={guideMarker} />;
            })}

            {/* A NARROW CAN STAND ON A DAY THAT HOLDS NOTHING YET, and it says so in the trade's
                own terms rather than showing a person an empty screen (§27, lifted from the day
                view's own empty state). UNDER A SEARCH IT SAYS SOMETHING ELSE, because the day is
                not empty — the word is somewhere else in the week, and that is the useful fact. */}
            {g.sales.length === 0 && (
              <p
                data-testid="day-empty"
                style={{
                  margin: `${theme.sizing.scale700} ${theme.sizing.scale400}`,
                  ...theme.typography.ParagraphSmall,
                  color: theme.colors.contentSecondary,
                }}
              >
                {searching
                  ? `Matches for “${query.trim()}” stand in other days.`
                  : view === 'archived' ? 'Archived delivery notes for this day appear here.'
                  : view === 'review' ? 'Reviews for this day are up to date.'
                  : 'This day is open. Anything that arrives for it lands here.'}
              </p>
            )}
          </React.Fragment>
        );
      })}
      </div>
    </div>
  );

  const feed = (
    /* THE RIVER IS THE SURFACE, so its column is at least a screen tall and the floating control
       is pushed to the END of it (§27). Narrowed onto a day holding three rows the column ended
       halfway up the screen — and `sticky` never pushes anything DOWN, it only holds it — so «Jump
       to today» sat in the middle of nothing, reading as a button somebody dropped there. A screen
       of runway plus `margin-top: auto` puts it on the screen's own bottom edge at every length of
       day, and sticky keeps it there once the river is longer than the screen. */
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: panes ? '100%' : '100vh', minWidth: 0 }}>
      {river}
      {/* «JUMP TO TODAY», pointing whichever way today has gone. IT PARKS ABOVE THE PHONE'S OWN ROW
          OF FOUR, never behind it — the bottom bar is fixed over the page, so a control resting on
          the screen's bottom edge is a control the navigation is sitting on top of. */}
      {elsewhere && (
        <div
          style={{
            position: 'sticky',
            bottom: phone
              ? `calc(${BOTTOM_NAV_HEIGHT}px + ${theme.sizing.scale600})`
              : theme.sizing.scale600,
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* it floats OVER the river, so it takes the lift that says so — otherwise it reads as a
              button somebody dropped into the middle of a row */}
          <span style={{ pointerEvents: 'auto', borderRadius: theme.borders.radius400, boxShadow: theme.lighting.shadow600 }}>
            <Button kind={KIND.secondary} size={SIZE.compact} data-testid="jump-today" onClick={jump}>
              {narrow ? '' : awayFrom === 'down' ? '↓ ' : '↑ '}
              Jump to today
            </Button>
          </span>
        </div>
      )}
    </div>
  );

  /* ── THE PANEL ───────────────────────────────────────────────────────────────────────────── */

  const document_ = selected ? operationalSales.find((s) => s.id === selected) ?? null : null;
  const gated = gate ? sales.find((s) => s.id === gate.id) ?? null : null;
  /* THE QUICK CHECK'S SUBJECT, RESOLVED OUT OF THE LEDGER (§111.1). The state holds an id, so a
     document that settles while the card is open takes the card with it rather than leaving a
     stale copy of itself on a layer — the same reason the composer holds a draft by id (§74.4). */
  const checked = checking ? sales.find((s) => s.id === checking.id) ?? null : null;
  /* THE PANE IS OPEN WHILE IT HOLDS EITHER THING (§17.1, §66.3): a document, or the composer that
     makes one. The composer IS the landing, so the two-column desk stands from first paint.
     ON A PHONE THE COMPOSER IS NOT IN THE PANE AT ALL (§76, §77.1): it is a bottom sheet over the
     river, so the pane there opens for a DOCUMENT and nothing else. */
  /* ── AND «THE PHONE» HERE MEANS «ONE PANE AT A TIME» (FEED-IA §103) ─────────────────────
     The composer is the DESK'S landing because the desk has a second column to stand it in. A
     stacked desk has one, so the composer takes the same posture it takes on a phone — a sheet
     over the river — rather than standing where the river is. Written as `pushed` because that is
     the actual question: is the list beside this, or behind it. */
  const composerSheet = pushed && composing;
  const panel = document_ !== null || (composing && !pushed);

  /* the frame widens its column while a panel stands beside the list, and narrows again on close.
     In panes the frame clamps nothing at all, so this is the phone-and-fallback path (§38). */
  useWideColumn(panel && !phone);
  /* ── THE CORNER IS NOT THIS SURFACE'S TO CLAIM ANY MORE (FEED-IA §83.3) ────────────────────
     A `useReservedLane(sheetPane)` stood here, telling the frame how wide the sheet pane was so the
     floating conversation would step left of it. «Why is the chat thing not bottom corner of the
     viewport» retires the whole mechanism: the bubble is fixed to the viewport's corner at every
     width, and the bar it used to stand on reserves the lane at its own end instead (the sheet's
     dock, in `detail.tsx`). The flicker this call was tuned against (§45.3 — a launcher that flew
     to the corner and back on every walk into Sales) cannot happen at all now: nothing computes
     where the bubble goes. */

  /* THE PHONE PUSHES, so it starts at the top of what it pushed. Without this the panel opens
     under whatever scroll position the list was left at and its own header is off screen. */
  React.useEffect(() => {
    if (phone && panel) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [phone, panel, selected]);

  /* WHERE THIS DOCUMENT STANDS IN THE REVIEW FLOW (§51.25). It is a POSITION, not a control: the
     sheet says «2 of 7 for review» so a person pressing the verb knows there are five more coming
     and that the pane is about to hold one of them. A document nobody is being held by carries
     nothing at all — silence is the resting state, and most of three hundred are silent. */
  const reviewAt = document_ ? flow.findIndex((s) => s.id === document_.id) : -1;

  /* ── WHAT THIS ACCOUNT KEEPS TAKING, OFFERED TO THE PANE (FEED-IA §83.2) ───────────────────
     «We make available but don't impose AI.» The heart lives inside the product field, and the
     product field is an organ that does not know what a sale is (chip-entry's own contract). So
     the SURFACE — which knows exactly whose document is open — computes the fold once and offers
     it; every chip field standing inside the pane draws the same heart off the same list.
     A DRAFT HAS NO ACCOUNT, so it gets no offer: `isDraft` is «customer.id is empty», and an
     account nobody has named has nothing it keeps taking. That is «present when a customer is
     named», spent as a memo rather than as a condition on a control. */
  const whose = document_ && document_.customer.id !== '' ? document_.customer : null;
  const favourites = React.useMemo(
    () => (whose ? frequentOf(cast, whose).rows : []),
    [cast, whose],
  );

  /* §142: the document owns its one dismissible inline concern. The route adds no banner. */
  const panelBody = document_ ? (
    <>
      <AlbaranIntakeSourceCard scope={cast.sector} sale={document_.id} inset />
      <SaleDetail
        cast={cast}
        derived={derived}
        sale={document_}
        sales={sales}
        list={list}
        review={reviewAt >= 0 ? { at: reviewAt + 1, total: flow.length } : undefined}
        /* THE CARET COMES WITH THE DOCUMENT (§74, §61.3) — only on the paint that took it off the
           composer, so the add-a-line opens with the chip field focused and the sentence continues. */
        carryOn={carrying === document_.id}
        onPick={(id) => setSelected(id)}
        onClose={() =>
          setSelected((cur) => {
            /* §17.1: a desk close walks to a neighbour; a pane that stands ALONE goes back to the
               list, because that is what its control says and where the person came from — the
               phone, and the stacked desk (FEED-IA §103). */
            if (pushed) return null;
            const i = list.findIndex((s) => s.id === cur);
            return (list[i + 1] ?? list[i - 1])?.id ?? null;
          })
        }
        onPrint={() => setPrinting({ subject: { kind: 'albaran', sale: document_.id } })}
      />
    </>
  ) : composing && !phone ? (
    /* ── THE LANDING SPOT IS THE COMPOSER (§66.3, rebuilt by §74) ────────────────────────────
       «It cleanly gives us a landing spot when they first click on it.» Nothing is selected, so
       the pane is not empty and it is not holding an albarán the app chose — it is holding the
       job a person came here to do, as a NASCENT ALBARÁN wearing the sheet's own identity.
       IT HANDS OVER SILENTLY. `document_` above resolves the moment a draft gains a customer, so
       naming one puts the SHEET in the pane on the same id, with the head the person was typing
       in standing exactly where it was (§74.3). Nothing converts and nothing is announced. */
    <Composer
      cast={cast}
      draft={draftHeld}
      drafts={drafts}
      onBirth={(said, reservedId) => {
        const id = newSale(undefined, 0, now, reservedId);
        nameDraft(id, now, said);
        setHeldDraft(id);
        return id;
      }}
      onResume={(id) => setHeldDraft(id)}
      onClose={() => { setComposing(false); setAskedFor(false); setHeldDraft(null); }}
    />
  ) : null;

  /** THE PANE, WITH THE ACCOUNT'S FAVOURITES STANDING BEHIND EVERY FIELD IN IT (§83.2) */
  const panelOffered = panelBody === null ? null : (
    <OfferFavourites of={favourites}>{panelBody}</OfferFavourites>
  );

  /* THE SWEEP RAN OUT (§32.A). The last P prints and there is nothing after it, so the panel says
     so in one sentence and stands still. It is a fact about the pass, not a warning about it: the
     paper for that order is on the printer like every other press, and the person is simply at the
     end of the list they were walking. Any next press, walk or pick takes the line away. */
  const sweptOut = swept && !printing && document_ !== null && (
    <p
      data-testid="sweep-end"
      style={{
        margin: 0,
        padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`,
        borderBottom: `1px solid ${theme.colors.mono400}`,
        background: theme.colors.backgroundSecondary,
        ...theme.typography.LabelSmall,
        color: theme.colors.contentPrimary,
      }}
    >
      That was the last one.
    </p>
  );

  /* §36.1: the name rides the header and the river says what it is — a lead sentence here
     spent a row of the screen saying what the surface already shows. */
  return (
    <Page title={meta.title} fill={panes}>
      {/* ═══ THE TWO PANES (FEED-IA §38) ══════════════════════════════════════════════════════
          «The desk is two full-height PANES side by side — the list pane and the sheet pane —
          each pane one scrollport, edge to edge of its available space, its content scrolling
          invisibly inside. No card-in-column framing, no floating box, no third scrollbar.»

          THE GEOMETRY, STATED ONCE:
            · the grid is the whole box the frame handed over — `height: 100%` of the space under
              the day bar — and it has exactly two columns while a sheet is open and one when it
              is not, so the list simply takes the width back rather than sliding under a panel.
            · THE SHEET IS A FIXED 640, because that is what an A4 sheet needs to be legible and
              the paper is what this pane is ultimately for; the list takes everything else.
            · EACH PANE IS ITS OWN SCROLLPORT AND NOTHING ELSE IS. The page cannot scroll (the
              frame is one viewport tall), the band no longer scrolls inside itself, and the
              document panel is no longer a box with a bar of its own — three scrollbars became
              one per pane, which is the whole of «the scrolling behavior is horrible».
            · THE SEAM IS A HAIRLINE, NOT A GUTTER. Two panes that meet on a rule read as one
              surface split; two panes with 24px of ground between them read as two cards on a
              page, which is the thing being cut.
            · THE LIST PANE CARRIES ITS OWN GUTTERS INSIDE ITS OWN SCROLL, so the river's left
              edge is where §33 put it and the scrollbar rides the pane's outer edge.

          THE PHONE IS THE PUSH MODEL, UNTOUCHED: the panel takes the screen and the list is one
          back-tap away. */}
      {phone && panel ? (
        <div
          data-testid="detail-open"
          style={{
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            background: theme.colors.backgroundPrimary,
            /* ── THE ONE AXIS, CLIPPED (FEED-IA §51.25, §38) ────────────────────────────────
               «The main actions should be quick and at the BOTTOM of the main screen.» On a phone
               the page is the scrollport, so the sheet's dock reaches the bottom of the SCREEN by
               sticking — and `overflow: hidden` here made this box a scroll container, which is
               what a sticky child resolves against: the dock pinned to the bottom of a box as tall
               as the albarán, which is exactly where it was sitting before. `clip` on X alone
               leaves Y visible, so nothing becomes a scrollport (§38 is untouched — the drive
               counts them) and the dock pins to the screen. */
            overflowX: 'clip',
            minWidth: 0,
          }}
        >
          {panelOffered}
        </div>
      ) : panes ? (
        <div
          data-testid="panes"
          data-open={panel ? 'yes' : 'no'}
          style={{
            display: 'grid',
            /* ── TWO COLUMNS, OR ONE (FEED-IA §38 · §103) ──────────────────────────────────
               THE SHEET IS WHAT YIELDS when the room runs short, never the river: a floor on the
               list means the document's column narrows first, which is the right way round
               (`customers.tsx` found it — «a name you cannot read is a book you cannot use»).
               Below `STACK_MAX` there is no room for two honest panes at all, so the grid is one
               column and the sheet stands in it alone. */
            gridTemplateColumns: panel && !stacked
              ? `minmax(${LIST_FLOOR}px, 1fr) minmax(0, ${sheetPane}px)`
              : 'minmax(0, 1fr)',
            height: '100%',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {/* ── THE LIST PANE: A HEADER, THEN ONE SCROLLPORT (FEED-IA §38, §51.4) ─────────────
              «Whose accounts is visible AT ALL TIMES — never scrolls away» is answered by geometry
              rather than by stickiness: the pane is a column whose first row is the header block and
              whose second row is the ONLY thing that scrolls. Nothing can slide under the header,
              because the header is not in the scroll at all — and §38's one-scrollport-per-pane law
              is unchanged, since the header does not scroll and therefore is not a port.

              AND ON A STACKED DESK IT STEPS ASIDE WHILE THE SHEET IS UP (§103). It is unmounted
              rather than hidden: a second full-height scrollport standing behind the document with
              no width to be in is exactly the «box within» §38 cut, and the way back is the sheet's
              own head. */}
          {(!stacked || !panel) && (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            {headerBlock}
            <div
              ref={listPane}
              data-testid="list-pane"
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'clip',  // one-axis scrollport: overflow-y:auto computes overflow-x:auto (§13)
                /* THE PAGE'S OWN GUTTERS, MOVED INSIDE THE THING THAT SCROLLS (§33, §38) — and the
                   TOP one moved one level further in, onto the river itself (§51.3). A scrollport's
                   own top padding is where a sticky child pins, so the compressed band parked 24px
                   below the header and a sliced river row showed through the gap between two pieces
                   of chrome. On the river the same air reads identically and the pin is flush. */
                padding: `0 ${theme.sizing.scale900} ${theme.sizing.scale1600}`,
                boxSizing: 'border-box',
              }}
            >
              {feed}
            </div>
          </div>
          )}
          {panel && (
            <div
              data-testid="detail-open"
              style={{
                minWidth: 0,
                minHeight: 0,
                overflowY: 'auto',
              /* §193.5: a line brought into view lands under the pane's sticky head, so the port keeps a head's worth of scroll padding */
              scrollPaddingTop: '64px',
                overflowX: 'clip',
                /* THE SEAM. One hairline between the two panes and no ground at all — the sheet
                   is a pane of the same surface, not a card standing on it. A stacked desk has
                   nothing on its left to be divided from, so the seam goes with the second pane. */
                borderLeft: stacked ? undefined : `1px solid ${theme.colors.mono400}`,
                /* the paper ground reaches every edge, including the bottom of a short albarán */
                background: theme.colors.backgroundSecondary,
              }}
            >
              {sweptOut}
              {panelOffered}
            </div>
          )}
        </div>
      ) : (
        /* THE FALLBACK the frame still supports: one reading column, the page scrolling. Nothing
           reaches it today — `panes` is on for every desk — and it is what a narrow desk window
           between the two models would land in. */
        <div style={{ minWidth: 0 }}>
          {/* on a phone the river already carries the header inside its own scroll — this branch is
              the narrow-desk fallback, where nothing else has drawn it */}
          {!phone && headerBlock}
          {feed}
        </div>
      )}

      {/* ═══ AND ON A PHONE THE COMPOSER IS A SHEET (FEED-IA §76, §77.1, §75.7) ═══════════════
          «Bottom sheets instead of sending users into deep edit pages… it keeps the user anchored
          in the list.» So the first act — whose albarán — rises over the river rather than
          replacing it, and the DOCUMENT is what takes the screen once it has a name. It stands
          outside the panes for the same reason the paper's modal does: it is a layer over the
          surface, not a region of it. */}
      {composerSheet && (
        <Composer
          cast={cast}
          draft={draftHeld}
          drafts={drafts}
          ask
          onBirth={(said, reservedId) => {
            const id = newSale(undefined, 0, now, reservedId);
            nameDraft(id, now, said);
            setHeldDraft(id);
        return id;
          }}
          onResume={(id) => setHeldDraft(id)}
          onClose={() => { setComposing(false); setAskedFor(false); setHeldDraft(null); }}
        />
      )}

      {/* ═══ THE PAPER OPENS ON THE PRINT SCREEN (FEED-IA §202.4 · §202.5) ══════════════════════
          «if they hit preview that takes them literally to the same place where they can edit the
          template. get it? all part of the same architecture» — and «the print screen should be
          full screen mobile».

          §37.10's modal is kept and answered: a preview still opens over the list, the sheet stays
          standing underneath and Escape closes the paper innermost-first. What changed is WHAT
          opens. It used to be a bare `OverlayCard size={720}` holding a framed `PrintView` — a
          centred card on a 360px phone, with the pager above the paper and no way from here to the
          settings that decide what the paper looks like. It is the print screen now: the template's
          own paper, a pager under it, Edit one press away, and the whole visual viewport on a
          phone (THE-OUTPUTS-SPEC OUT-03.5 · OUT-04). */}
      <PrintScreenCard
        request={printing}
        cast={cast}
        derived={derived}
        sales={sales}
        onClose={() => setPrinting(null)}
      />

      {/* ═══ THE QUICK CHECK (FEED-IA §111.1) ═════════════════════════════════════════════════
          It morphs out of the row it was pressed on and folds back into it, so nothing about
          checking a document takes a person off the river they are reading (§59.1). The act inside
          it is the A key's own — `quick` — so the card and the key can never disagree, and where
          the statechart has nothing to answer the card offers the door alone. */}
      {checking && checked && (
        <QuickCheck
          cast={cast}
          now={now}
          sale={checked}
          job={checking.job}
          from={checking.from}
          isOpen={checking.open}
          still={still}
          onClose={closeCheck}
          /* THE ACT ONLY ACTS. The film decides when the card leaves — beat 4 does the closing, and
             a press that never landed closes on the spot (§115.3). A call site that closed the card
             itself would cut the change and the landing out of the film. */
          onRight={callOf(checked) ? () => quick(checked) : null}
          onOpen={() => { closeCheck(); open(checked.id); }}
        />
      )}

      {/* THE QUICK CONFIRM'S GUARD. The shorter door is the same door: it proposes the lotes, then
          states the consequence, and «Back to edit» opens the document it is about. */}
      {gated && gate && (
        <ConfirmGate
          cast={cast}
          sale={gated}
          sales={sales}
          act={gate.act}
          now={now}
          onClose={() => setGate(null)}
          onEdit={() => open(gated.id)}
          inventoryEnabled={inventoryAvailable}
        />
      )}
    </Page>
  );
}
