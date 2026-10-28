import { soles, solesRate, MONEY_LOCALE } from './currency';
import moneyFixture from './fixtures/money-v1.json';
/* THE SALE — the app's ONE central object, and the statechart it renders.
 *
 * ═══ THE EPIPHANY, AS A DATA STRUCTURE (THE-FEED §0–§1) ═════════════════════════════════════
 * «Albaranes are the main object — which in a way are actually SALES. And orders are suggestions
 * for what could become an albarán.» So there is no Order object with an Albarán object beside
 * it: there is ONE object, la venta, whose document is the albarán, and everything the product
 * shows is a state of it.
 *
 *   REQUEST ──commit──▶ COMMITTED ──make──▶ MADE ──schedule──▶ SCHEDULED ──send──▶ SENT
 *      │                                     ▲                     │                 │
 *      └──────────── make (commit and make in one act) ────────────┘   cancel ──┘    ├─ deliver ─▶ DELIVERED
 *                                                                                    ├─ decline ─▶ DISPUTED ──resolve──▶ SETTLED
 *                                                                                    └─ settle ──▶ SETTLED
 *
 * ═══ EVENTS, NOT FLAGS ═════════════════════════════════════════════════════════════════════
 * Every arrow above is an EVENT appended to the day's one store. Nothing here holds a state
 * field: `stateOf` folds the ledger, so a screen can never disagree with the ledger and an
 * illegal move is simply one the fold ignores. That is the statechart made mechanical rather
 * than promised.
 *
 * ═══ ONE STORE, ONE DAY, NO PARALLEL TRUTH ═════════════════════════════════════════════════
 * `DayEdits` already carried two half-objects: `confirmed` (an order that went through the gate)
 * and `released` (an albarán number Dispatch let go). Those are STATES OF THIS OBJECT, so they
 * fold in rather than living beside it:
 *   · `confirmed.includes(sale.orderId)` reads as a commit — hold-to-confirm on Orders moves the
 *     row in the feed, because it is the same transition seen from another surface.
 *   · `makeSale` writes the albarán number into `released`, so the strip at the top of the page
 *     moves when the document is made. One store heard by every surface.
 *
 * ═══ WHERE THE DAY'S SALES COME FROM ═══════════════════════════════════════════════════════
 * `dayOrders(cast)` for today, the same cast for yesterday, and a seed ledger that puts the base
 * rows where a real morning would have them. The seed is EVENTS TOO — so «what the day already
 * did» and «what this person just did» are the same kind of fact, and a screenshot of the feed
 * is the same screenshot every time.
 */
import type { SectorId } from '../../scenarios/meta';
/* THE DIMENSIONS ARE THE CATALOGUE'S (FEED-IA §41.1). A closed register belongs beside the tree it
   is a fact about, so this file carries the VALUES on the line and never the words themselves. */
import type { DimensionId } from './catalogue';
/* AND TWO ANSWERS ONLY THE REGISTER CAN GIVE (THE-OBJECT-MAP C5 · C7). A line can stand on a member
   the house GRADUATED — a product the static cast cannot hold — and a graduated sort's name divides
   in a place only the register knows. Both are read here rather than threaded through the dozen
   surfaces that hold a line and no catalogue; `catalogue.ts` imports nothing from this file, so the
   two modules still read in one direction only. */
import { AMENDMENTS as CATALOGUE_AMENDMENTS, amendmentProduct, graduatedProduct, sortMember } from './catalogue';
import type { Batch, Cast, Customer, Product, TraceProfile } from '../../scenarios/data/cast';
import { CASTS, familyOf, productOf, scatter, scatterId } from '../../scenarios/data/cast';
import {
  clockAfter, dayLineCount, dayNow, dayOrders, nowOf, productsFor, qtyFor, setDay, withId,
  type DayEdits, type DayOrder,
} from './day';
/* WHAT THE HOUSE LETS ROCOTO DO ALONE (THE-INTELLIGENCE §11). The grants are read here rather than
 * threaded in, because every predicate in this file is called from a dozen surfaces and one missed
 * thread would be a screen quietly disagreeing with the settings screen. `grants.ts` is a module
 * store, so the value this file reads is the value Settings just wrote. */
import { grantsNow, type Cadence } from './grants';
/* WHICH RAILS THE HOUSE HAS OPENED (FEED-IA §35.3). The ERP target and the mail connection are the
 * config's own answers, and this file needs them for the same reason it needs the grants: the seed
 * may only stamp a send onto a rail that actually exists. `config.ts` imports nothing from here. */
import { loadConfig } from './config';
import { confirmationPreview } from './confirmation-policy';
import { approvedCustomerOption, type CustomerOption } from './customer-option';
export { customerOptionText, type CustomerOption } from './customer-option';
import { unitFactor as declaredUnitFactor } from './units';
/* WHICH ACCOUNTS THE HOUSE WROTE ITSELF (FEED-IA §86.5). The cold start (THE CHECKPOINT §8) is the
 * account with no record behind it, and `customers-made.ts` is where that fact lives. It imports
 * React and the cast and nothing from here, so the edge stays one-way. */
import { isMadeCustomer } from './customers-made';
/* WHERE A HANDOVER GOES, AS A TOPIC (THE CHECKPOINT §9 · §5.11) — and, since §110, the NAME at the
 * end of it. `policyOf` still names the topic and nothing else; `jobOf` resolves the topic to a
 * person, because «Answer them» is a job somebody holds. `company.ts` imports React, the cast, the
 * config and the zone map, and nothing from here, so the edge stays one-way and no cycle forms.
 * IT COMES IN RENAMED: `memberOf` is taken in this file by the LINE's own reader (§62), so the
 * house's roster reader wears the name it is asked by — who takes this. */
import { memberOf as houseMemberOf, type Company, type EscalationTopic } from './company';
/* THE MONEY CLOCK'S OTHER HALF (FEED-IA §32). «Quantity is promised at confirm; money is final at
 * print.» The sheet those prices come off is `tiers.ts`, read here for the same reason the grants
 * are: this file prices the document, and a tarifa threaded through `buildSales` would be a screen
 * quietly disagreeing with the tarifa the house just wrote. `tiers.ts` imports nothing from here. */
import { bandOf, customerKey, discountOn, priceOn, tierNameOf, tierRatio, tiersNow, writtenOn } from './tiers';
/* one price list, so the money on a horizon row and the €/unit on today's agree */
import { priceOf } from '../../scenarios/canonical/resolution';
import { cedarCast, cedarSourceCast } from './cedar-cast';
import { cedarDayFromId, cedarTodayId } from './scenario-clock';

/* ── THE STATES ───────────────────────────────────────────────────────────────────────────── */

export const SALE_STATES = [
  'request', 'committed', 'made', 'scheduled', 'sent', 'delivered', 'disputed', 'settled',
] as const;

export type SaleState = (typeof SALE_STATES)[number];

/** How far along the object is, for the one question a screen actually asks of the order:
 *  «is this thing still editable». A word cannot be compared; a rank can. */
export const RANK: Record<SaleState, number> = {
  request: 0, committed: 1, made: 2, scheduled: 3, sent: 4, delivered: 5, disputed: 5, settled: 6,
};

/** A sale before its document exists is a suggestion — Monzo's pending row. From MADE on, the
 *  albarán is a fact and the row is solid. This one predicate carries the whole feed grammar. */
export const isPending = (state: SaleState): boolean => RANK[state] < RANK.made;

/** What a row says it is. Nouns and short clauses — the state carried by words, never colour. */
export const STATE_TEXT: Record<SaleState, string> = {
  request: 'Request',
  committed: 'Committed',
  made: 'Made',
  scheduled: 'Scheduled',
  sent: 'Sent',
  delivered: 'Delivered',
  disputed: 'Disputed',
  settled: 'Settled',
};

/* ── THE EVENTS ───────────────────────────────────────────────────────────────────────────── */

/* ── HOW THE MONEY CAME IN (Musing 4) ─────────────────────────────────────────────────────────
 * The three ways a Spanish distributor is actually paid. The list is closed — a person picks from
 * it, never types into it — and the customer's own `settles` fact pre-fills which one is offered
 * first, so the commonest case is one tap on a phone.
 */

export type PayMethod = 'cash' | 'card' | 'transfer';

export const PAY_METHODS: PayMethod[] = ['cash', 'card', 'transfer'];

export const PAY_METHOD_WORDS: Record<PayMethod, string> = {
  cash: 'cash',
  card: 'card',
  transfer: 'transfer',
};

/** Explicit design-fixture provenance. It is data, not an inference from an id prefix. */
export type TheatreOrigin = { id: string; scenario: 'order' | 'question'; tainted: true; source: 'kit-demo' };

/** A reviewed line proposal produced from one provider message. The provider envelope remains in
 * its encrypted account store; the day ledger retains only what Cedar needs to show and review. */
export type SourceArrivalLine = {
  product?: string;
  word: string;
  qty?: number;
  unit: string;
  confidence?: 'low' | 'medium' | 'high';
  evidence?: string;
};

export type SaleEvent =
  /* the transitions */
  /* `over` is the guard modal's whole record: what the app said would be missing, and the fact
     that a person read it and went ahead anyway (THE-APP-V2 §1.3). It rides on the transition
     itself, so «confirmed over the warning» can never drift from the confirmation.
     `auto` is THE COMMIT INVERSION (FEED-IA §6.2): the machine committed this one on arrival
     because nothing about it needed judging. It is the AI's own act, so the row says so. */
  | { kind: 'commit'; sale: string; at: string; over?: string[]; auto?: boolean }
  | { kind: 'make'; sale: string; at: string; over?: string[] }
  | { kind: 'schedule'; sale: string; at: string; window: string }
  | { kind: 'cancel'; sale: string; at: string }
  | { kind: 'send'; sale: string; at: string }
  | { kind: 'deliver'; sale: string; at: string; recordedAt?: string }
  | { kind: 'decline'; sale: string; at: string; because: string }
  | { kind: 'settle'; sale: string; at: string }
  /* ── READ, LIKE GMAIL (FEED-IA §66.1) ──────────────────────────────────────────────────────
   * «I don't want the things to need locking. Simply to be READ. Like Gmail. Once read, if they
   * don't edit, that's down to them. They can mark unread though.»
   *
   * So attention is a fact about a PERSON having looked, not a blessing the document waits for.
   * Opening the sheet writes `read` — it is not an act anybody performs, which is exactly what
   * makes it Gmail's grammar — and «Mark unread» writes the other one, sending the thing back to
   * needs-attention. Both are events for the same reason every other facet is: «Núria read it at
   * 07:12» is a claim about something that happened, and the ledger is the only honest place for
   * a claim like that. Nothing is stored on the sale; the fold answers. */
  | { kind: 'read'; sale: string; at: string; by?: string }
  | { kind: 'unread'; sale: string; at: string }
  /* Flag is an operator-owned follow-up marker. It never rewrites Viewed/read state. */
  | { kind: 'flag'; sale: string; at: string; by: string }
  | { kind: 'unflag'; sale: string; at: string; by: string }
  | { kind: 'resolve'; sale: string; at: string; outcome: string }
  /* ── THE MONEY IS FINAL AT PRINT (FEED-IA §32) ─────────────────────────────────────────────
   * «Quantity is promised at confirm; money is final at print/close — the albarán prices when the
   * paper comes out.» So the print event CARRIES the money it printed: the sheet may move at
   * 05:30 tomorrow and the paper in the customer's hand never re-prices. `printSale` reads the
   * lines it was handed and stamps them here, which is what makes the freeze a fact in the ledger
   * rather than a promise in a render. */
  | { kind: 'print'; sale: string; at: string; prices?: Record<string, number>; revision?: string; materialCursor?: number; requestedAt?: string; requestedBy?: string; confirmedAt?: string; confirmedBy?: string; attemptId?: string }
  /* ── THE OTHER TWO ROADS OUT (FEED-IA §35.3) ───────────────────────────────────────────────
   * «Albaranes FINISHING is one of the main jobs of Rocoto. Three rails, print the main one:
   * PRINT · ERP · EMAIL. The system always knows: printed or not · edited since last printed ·
   * sent to the ERP · edited since sent · scheduled to email.»
   *
   * They are events for the same reason print is one: a facet that says «went to the ERP at
   * 07:41» is a claim about something that happened, and the only honest place for it is the
   * ledger. And because they land IN HOUR ORDER beside the line edits, «edited since it went» is
   * a consequence of order rather than a flag anybody sets — the identical mechanism that already
   * makes a printed sheet go stale (§29.2). One pattern, three rails.
   *
   * THE ERP SEND CARRIES ITS TARGET, because a house that moves from a file to Sage 50 has a
   * morning of albaranes that went to the old one, and a rail that re-labelled its own history
   * would be the ledger lying about where paper went.
   */
  | { kind: 'erp-send'; sale: string; at: string; target?: string }
  /* THE EMAIL IS SCHEDULED, THEN IT GOES (§35.4: «scheduled by default at the requested delivery
     time»). Two events because they are two facts a person asks about separately: when it is due
     to leave, and that it left. `sendAt` is the hour on the clock; `at` is when the schedule was
     made — so a schedule written at 07:12 for 10:30 says both, and neither has to be inferred. */
  | { kind: 'email-schedule'; sale: string; at: string; sendAt: string }
  | { kind: 'email-sent'; sale: string; at: string }
  /* ── THE TARIFA, SWITCHED FOR THIS DOCUMENT ALONE (§A.11) ───────────────────────────────────
   * «The albarán can switch tier on the fly.» It re-prices THIS albarán and leaves the customer's
   * standing band exactly where it was — so the event names the band the document prices from,
   * and the profile is untouched. A line a hand priced holds its own number through it. */
  | { kind: 'tier'; sale: string; at: string; tier: string }
  /* ── MONEY COLLECTED (Musing 4) ────────────────────────────────────────────────────────────
   * «Payment must be TRACKABLE: a Mark paid act on mobile AND desktop.» Paid is a FACET, not a
   * state: the statechart is untouched and this folds beside `printed` and `prep`, which is why a
   * sale can be paid-and-disputed or settled-and-owed. It is a person's act, so it is ink. */
  | { kind: 'pay'; sale: string; at: string; how: PayMethod; by?: string }
  /* THE ALLOCATION (THE-APP-V2 §5.7, LOT-LAW §2). A line points at BATCHES, one or several, and
     the lote on the albarán is what those batches are called. It rides as its own event because
     attaching is the person's act on the object and belongs in the object's history. */
  | { kind: 'lot'; sale: string; at: string; line: string; allocations: Allocation[]; overrideReason?: string; stockRevision?: string }
  /* ── THE LINE'S OWN FACTS, ONE EVENT (FEED-IA §41) ─────────────────────────────────────────
   * The dimensions and the final weight ride THIS event rather than growing kinds of their own.
   * That is the §41.4 instruction taken literally — «every correction fires the existing events» —
   * and it is also the honest reading: putting «congelado» on a line and putting 21,4 kg on it are
   * both the same act, a person stating a fact about what is going out, and the trace layer that
   * already reads `line` picks them up with nothing added to it.
   *
   * `dimensions` is a PATCH, not a replacement: an event that says `{ state: 'congelado' }` leaves
   * the preparation exactly where it was, so two dimensions set in two moments are two events and
   * neither one erases the other. An empty string takes a dimension off. */
  | {
      kind: 'line'; sale: string; at: string; line: string;
      /** ⚠ `klass` is READ-ONLY HISTORY (FEED-IA §197.2): an event stored before «Remove class
       *  everywhere» still folds; `saveLineEdit`'s patch cannot write a new one. */
      given?: number; unit?: string; klass?: string; price?: number;
      /** Exact base-unit conversion at the edit; null means a rate still needs an answer. */
      unitFactor?: number | null;
      dimensions?: LineDimensions;
      /* WHAT THE SCALE SAID, BESIDE WHAT THE COUNT SAYS (§41.3). «FINAL WEIGHT is always addable on
         any line» — on a counted line it is a second fact (four boxes AND 21,4 kg), and on a kilo
         line the amount IS the weight, so `putFinalWeight` writes `given` there instead of putting
         the same number on the row twice. */
      finalWeight?: number;
    }
  /* ── A LINE PUT ON BY HAND, WITH OR WITHOUT A CATALOGUE ROW BEHIND IT ───────────────────────
   * `product` is a catalogue id and `word` is the customer's own name for a thing the list has no
   * row for. Exactly one of them is ever set, and which one is set is the HOUSE'S POSTURE showing
   * in the ledger (grants `assortment`, THE-DENSE-BRIEF-DESIGN §10): a catalogue house may only
   * add things it sells, and a one-offs house sells whatever the market had this morning.
   *
   * A WORD MINTS THE OFF-CATALOGUE SHAPE — `nonSku`, no trace, no lote — which is the same object
   * an off-catalogue line arrives as, so the adoption flow that already exists works on it
   * unchanged and nothing new had to be invented to make a hand-written one adoptable later. */
  /* `asked` is THE WORD THAT WAS SAID, and it is written only where the house sells more than
     one form of it (FEED-IA §80). A plain product carries nothing — silence is the resting
     state — so a line that wears a fill reading wears it because there really was a choice. */
  | { kind: 'add'; sale: string; at: string; line: string; product?: string; word?: string; qty: number; unit: string; price: number; asked?: string }
  /* A LINE COMES OFF, AND COMES BACK (FEED-IA §8, line editing). Removing is append-only like
     everything else, so the undo is its own event rather than a rubbed-out one — the albarán can
     always say what was taken off it and when. */
  | { kind: 'remove'; sale: string; at: string; line: string }
  | { kind: 'restore'; sale: string; at: string; line: string }
  /* THE TRADE'S OWN WORD, PUT ON THE LINE BY HAND (THE-INTELLIGENCE §2). An empty word takes the
     chip off again; both are the same act on the same line. */
  | { kind: 'amend'; sale: string; at: string; line: string; word: string }
  /* ── PREPARING IS TICKING OFF (FEED-IA §7.2) ───────────────────────────────────────────────
   * «The day view's minimal action is the tick — a satisfying check per order (and per line
   * inside). But ticked ≠ finished: the FULL status stays visible as facets.» So the tick is an
   * event like every other, a line-level tick exists for the person walking the bay, and a change
   * that lands AFTER a tick leaves the tick standing with a note beside it rather than silently
   * clearing it. Going backwards is visible. */
  /* ── HOW THIS LINE LEAVES THE HOUSE (THE-DENSE-BRIEF-DESIGN §6, musing 7) ──────────────────
   * «A quick comment for how something is packed/prepped, drawn as a small indented non-bold line
   * under the item's title.» It is DOCUMENT CONTENT addressed to the bench — it prints under the
   * line and the packer acts on it — which is exactly why it is not an amendment: an amendment
   * changes what the thing IS and can graduate into a product; a prep note never can.
   *
   * IT USED TO BE A STORE IN `knows.ts`, and that store said so in its own comment: «when sale.ts
   * grows the field, `prepOf` becomes `line.prepNote`, `setPrep` becomes the event, and this whole
   * block is deleted». This is that event, and the block is gone. An empty note takes the line back
   * to silence, append-only like every other line edit — the albarán can always say what the bench
   * was told and when it was told it. */
  | { kind: 'prep-note'; sale: string; at: string; line: string; note: string; by?: string; product?: string; customer?: string; recordedAt?: string }
  /* An explicit customer-facing snapshot. `clear` remains a retained act rather than an erasure. */
  | { kind: 'customer-option'; evidenceId?: string; sale: string; at: string; line: string; action: 'approve'; option: CustomerOption; by: string }
  | { kind: 'customer-option'; sale: string; at: string; line: string; action: 'clear'; by: string }
  | { kind: 'prepare'; sale: string; at: string }
  | { kind: 'unprepare'; sale: string; at: string }
  | { kind: 'prepare-line'; sale: string; at: string; line: string }
  | { kind: 'unprepare-line'; sale: string; at: string; line: string }
  /* THE DAY'S SHEET WENT TO THE PRINTER. It is the round's manifest and belongs to no single
     sale, so it carries the day rather than a sale — and the fold, which reads events by sale,
     passes over it. */
  | { kind: 'print-day'; sale?: undefined; at: string; day: string }
  /* ── AN ORDER LANDED WHILE THEY WERE WORKING (FEED-IA §26.6) ───────────────────────────────
   * «Many times orders get processed with an overlap with the ordering period. The UX lets them
   * do that, not that it's a mode at all.» An arrival is therefore an ordinary event in the same
   * ledger every other fact lives in — it is not a mode, not a refresh, not a second store. The
   * fold dresses it off the same catalogue every seeded sale is dressed from, so a row that lands
   * at 07:41 is the same kind of object as one that was there at 06:00, and the river gains it
   * live under whatever the person happens to have open. */
  | { kind: 'arrive'; sale: string; at: string; customer: string; offset: number; take: number }
  | {
      kind: 'source-arrive'; sale: string; at: string; customer: string; offset: number;
      customerName: string; customerPhone: string; text: string;
      channel: 'whatsapp' | 'phone' | 'email'; sourceEvent: string; conversation: string;
      occurredAt: string; historical: false;
      lines: SourceArrivalLine[];
      deliveryDay?: string; needsReply?: 'order' | 'ask';
      intelligence?: { mode: 'model' | 'heuristic'; model?: string };
      phoneSource?: {
        workspaceId: string;
        callSid: string;
        eventIds: string[];
        sourceIds: string[];
        utterances: Array<{
          id: string;
          speaker: number;
          track: 'inbound' | 'outbound';
          start: number;
          end: number;
          text: string;
          final: boolean;
        }>;
      };
    }
  /* KIT-ONLY THEATRE (§165). Every beat is a real, explicitly tainted day-ledger event.
     Receipt and processing have no Sale yet; arrival folds the same Sale Sales/Chats already read.
     These kinds are never emitted by an inbox or a provider. */
  | { kind: 'theatre-receive'; sale: string; at: string; customer: string; scenario: 'order' | 'question'; text: string; theatre: TheatreOrigin }
  | { kind: 'theatre-process'; sale: string; at: string; scenario: 'order' | 'question'; text: string; theatre: TheatreOrigin }
  | { kind: 'theatre-arrive'; sale: string; at: string; customer: string; offset: number; take: number; scenario: 'order' | 'question'; product: string; text: string; theatre: TheatreOrigin }
  | { kind: 'theatre-message'; sale: string; at: string; author: 'received' | 'ai'; text: string; theatre: TheatreOrigin }
  /** An incoming customer amendment changes the requested and current quantity together.
     It is deliberately distinct from `line`, which records a bench/scale adjustment. */
  | { kind: 'theatre-amend'; sale: string; at: string; line: string; qty: number; theatre: TheatreOrigin }
  /* ── THE HOUSE WRITES ONE ITSELF (FEED-IA §66.3) ───────────────────────────────────────────
   * «When they first land on orders I want the default to be for them to make a NEW albarán. That
   * fits their freedom to do custom ones too.»
   *
   * It is an EVENT like everything else, and that is the whole of why the composer is not a
   * separate mode: the moment it is appended the fold grows an ordinary Sale, the river gains an
   * ordinary row, and every act in this file — adding a line, printing, sending — works on it
   * without knowing it was written by hand rather than read off a message.
   *
   * IT LANDS `committed`, NOT `request`. A request is «the net caught something», and nothing was
   * caught: the house typed this one. Asking a person to confirm a document they just wrote is
   * the blessing §66 killed, wearing a different hat. */
  | { kind: 'new'; sale: string; at: string; customer?: string; offset: number }
  /* ── THE DRAFT IS EDITED IN PLACE, LIKE EVERYTHING ELSE (FEED-IA §74.4) ────────────────────
   * «Maybe the first step thing is silly — I think once they type it should start a draft.» So
   * the `new` event above is written on the FIRST KEYSTROKE, before anybody knows whose document
   * it is, and these two carry the answers as they arrive. Both are ordinary appends: a draft is
   * not a different kind of object with a different kind of history. */
  | { kind: 'draft-name'; sale: string; at: string; customer?: string; said: string }
  | { kind: 'draft-day'; sale: string; at: string; offset: number }
  /* ── THE ACCOUNT'S USUAL HOUR, TAKEN (FEED-IA §86.4b) ──────────────────────────────────────
   * «It should suggest the typical delivery time of the customer» — and §86.4 immediately before
   * it: a document may never draw a habit as though it were its own fact. So the HOUR is the
   * account's (`usualHourOf`, off `Customer.slot`) and this event holds the only thing the
   * document owns about it: that somebody pressed the offer. Before it the sheet says «they
   * usually take 07:30»; after it the document states 07:30, because a person said so.
   * It is an event rather than a module set because it is a fact about THIS document, and every
   * other fact about a document lives in its own stream. */
  | { kind: 'slot-taken'; sale: string; at: string }
  /* a non-SKU line resolved: the word becomes a product, or it stays this one sale's own */
  | { kind: 'adopt'; sale: string; at: string; line: string; how: NonSkuResolution }
  /* ── THE THREE THINGS THE MODEL LEARNS FROM (THE-INTELLIGENCE §1, §2, §3) ──────────────────
   * «Accepting is nothing. Correcting the line IS the training signal — every such edit is an
   * event the model learns from. No thumbs, no ratings, no feedback UI.» So the three acts a
   * person takes ON Rocoto's own work are their own events, and they land in the sale's history
   * beside the transitions rather than in a telemetry pipe nobody can read. */
  | { kind: 'correct'; sale: string; at: string; line: string; asked: string; filled: string }
  /* A multiple-choice resolution changes THIS order line only. `asked` preserves the source
   * wording; `product` points at an already sellable SKU and creates neither a SKU nor a catalogue
   * record. */
  | { kind: 'choose-sku'; sale: string; at: string; line: string; product: string; asked: string; from: string }
  /* None of the offered SKUs is an equally deliberate resolution. The literal source phrase
   * remains on this order as a provisional off-SKU line; this event creates no catalogue row. */
  | { kind: 'choose-sku-none'; sale: string; at: string; line: string; asked: string; from: string }
  | {
      kind: 'unit-flip'; sale: string; at: string; line: string; from: string; to: string;
      /** Conversion facts observed by the person; absent only on older browser events. */
      fromFactor?: number | null; toFactor?: number | null;
    }
  | { kind: 'graduate'; sale: string; at: string; line: string; base: string; amendment: string }
  | { kind: 'reply'; sale: string; at: string; text: string }
  /* ROCOTO WRITES IT (FEED-IA §10, corrected). The person supplied the one thing it lacked and
     chose to let the software do the talking, so the sentence that goes out is Rocoto's own act
     and carries its own mark in the thread. The other half of the choice is `reply`, which is the
     person writing it themselves — and both close the same loop. */
  | { kind: 'answer'; sale: string; at: string; text: string }
  /* §138.8 supersedes deletion. Old browser events remain readable; new actions archive. */
  | { kind: 'delete'; sale: string; at: string }
  | { kind: 'archive'; sale: string; at: string; by: string };

/** The statechart, as the only function that may move a sale. An event that does not fit the
 *  state it lands on is IGNORED — a sale cannot be sent twice by pressing twice. */
export function advance(state: SaleState, event: SaleEvent): SaleState {
  switch (event.kind) {
    case 'commit': return state === 'request' ? 'committed' : state;
    /* a request may jump STRAIGHT to made — commit and make in one act (THE-FEED §1) */
    case 'make': return state === 'request' || state === 'committed' ? 'made' : state;
    case 'schedule': return state === 'made' ? 'scheduled' : state;
    case 'cancel': return state === 'scheduled' ? 'made' : state;
    case 'send': return state === 'made' || state === 'scheduled' ? 'sent' : state;
    case 'deliver': return state === 'sent' ? 'delivered' : state;
    case 'decline': return state === 'sent' || state === 'delivered' ? 'disputed' : state;
    case 'settle': return state === 'sent' || state === 'delivered' ? 'settled' : state;
    case 'resolve': return state === 'disputed' ? 'settled' : state;
    default: return state;
  }
}

/* ── THE LINES ────────────────────────────────────────────────────────────────────────────── */

/* ── THE NUMBERS ──────────────────────────────────────────────────────────────────────────────
 * Money is rounded the way money is, and an amount is written the way Spain writes it. Both stand
 * up here because the conversions below them are arithmetic before they are anything else.
 */

const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/* The whole book uses this grammar; constructing Intl for each amount blocked every ledger read. */
const amountFormatter = new Intl.NumberFormat(MONEY_LOCALE, { maximumFractionDigits: 3 });
export const amountWords = (n: number): string => amountFormatter.format(n);

/** AN AMOUNT AND ITS UNIT, ON ONE LINE, IN ONE LANGUAGE. A flip can put a fraction on a row —
 *  «0,5 pieza» — and a row that writes it «0.5» beside a note that writes it «0,5» is the app
 *  speaking two languages about one number. Every surface that says an amount says it through
 *  here, and the unit is never separable from the figure it denominates. */
export const qtyWords = (n: number, unit: string): string => `${amountWords(n)} ${unit}`;

/* ── THE CLASS REGISTERS ARE GONE (FEED-IA §197.2 «Remove class everywhere», §193.4) ──────────
 * `CLASS_REGISTER`, `classesOf` and `classOf` stood here: a closed grade register per family, and
 * the roll that put one on every seeded line. THE-ALBARAN-THESIS §3 layer 4 and §41.2 are repealed
 * by §197.2, and §193.4 says what replaced them, top-down: «the SKU (the thing in the title) would
 * probably have it», and what stays OURS to know is WHEN the goods came in — the lot. Commercial
 * identity lives in the SKU; temporal identity lives in the lot; there is no third taxonomy
 * between them, so no register, no roll, and no seat that would need one. */

/* ── THE UNITS TRIPLE (THE-INTELLIGENCE §3) ───────────────────────────────────────────────────
 * «Every quantity is a triple: asked (their words: "una caja") · suggested (our resolution: 5,0 kg,
 * from the product's own conversion facts) · final (what the scale or the hand said). The UI lands
 * on the suggestion, with `asked` as the quiet provenance beneath. The alternates are ONE TAP
 * sideways: unit chips flip the editor; the conversion is shown doing its arithmetic, never hidden
 * (1 caja = 5 kg).»
 *
 * A UNIT WITH NO CONVERSION BEHIND IT IS NOT OFFERED. The old chip row let a person turn «12 kg»
 * into «12 caja» by pressing a word — the number stood still while its meaning moved, which is the
 * same mis-sale the price law bans on a marketing page. A chip now carries arithmetic or it does
 * not exist.
 */

/** The kilo is the unit the trade counts a container in, wherever a container has one. */
const WEIGHT = 'kg';

export type Conversion = {
  /** the container the market buys in — caja, pieza */
  big: string;
  /** what one container holds `factor` of */
  small: string;
  factor: number;
  /** the ratio is the market's rule of thumb until the scale speaks: a caja de merluza is 6–7 kg */
  about: boolean;
};

/** THE PAIR, ORIENTED. The catalogue writes a pack either way round — merluza is sold in kg and
 *  packed in cajas, chorizo has Product Unit caja while retained pack evidence states a possible weight — so the
 *  kilo is taken as the counted side wherever one is in the pair, and both read the same way:
 *  «1 caja = 5 kg». Where neither side is a weight, the pack is the container by definition. */
export function conversionOf(product: Product): Conversion | null {
  const pack = product.pack;
  if (!pack || !pack.factor || pack.unit === product.unit) return null;
  const small = pack.unit === WEIGHT || product.unit === WEIGHT ? WEIGHT : product.unit;
  const big = product.unit === small ? pack.unit : product.unit;
  return { big, small, factor: pack.factor, about: pack.nominal === true };
}

/** The units this line can be given in, in one stable order. Empty where the product has no
 *  conversion, and an empty chip row is simply no chip row. */
export const flipUnitsOf = (product: Product): string[] => {
  const c = conversionOf(product);
  return c ? [c.small, c.big] : [];
};

/** How many `to` one `from` makes. */
function ratioOf(product: Product, from: string, to: string): number | null {
  if (from === to) return 1;
  const c = conversionOf(product);
  if (!c) return null;
  if (from === c.big && to === c.small) return c.factor;
  if (from === c.small && to === c.big) return 1 / c.factor;
  return null;
}

/** The same amount, said in the other unit. */
export function convertQty(product: Product, qty: number, from: string, to: string): number | null {
  const r = ratioOf(product, from, to);
  return r === null ? null : round(qty * r, 3);
}

/** THE SCALE READS A WEIGHT (THE-INTELLIGENCE §0: «the scale is the only ground truth we can never
 *  guess»). So a weighed line opens the scale while it is being given in the unit a scale can
 *  read, and the counter opens when the same line is being given in the container: you WEIGH
 *  kilos and you COUNT cajas. Handing a caja line a gram ladder was the field saying it could
 *  measure something it cannot. */
export function weighsOnScale(line: SaleLine): boolean {
  if (!line.weighed) return false;
  const c = conversionOf(line.product);
  return !c || line.unit === c.small;
}

/** THE ARITHMETIC, SHOWN — «1 caja = 5 kg», and «1 caja is about 6,5 kg» where the ratio is the
 *  market's rule of thumb until the scale speaks. A conversion a person cannot check is a
 *  conversion they have to take on faith, and this product exists to end that. */
export function conversionWords(product: Product): string | null {
  const c = conversionOf(product);
  if (!c) return null;
  return c.about
    ? `1 ${c.big} is about ${amountWords(c.factor)} ${c.small}`
    : `1 ${c.big} = ${amountWords(c.factor)} ${c.small}`;
}

/** THE WHOLE LINE, SAID IN THE OTHER UNIT. The amount moves, what was asked moves with it, and
 *  the unit price follows so the LINE'S MONEY DOES NOT MOVE: 12 kg at 15,80 € and 1,846 cajas at
 *  102,70 € are the same goods for the same money, and a figure that jumped when a person pressed
 *  a word would be the app arguing with itself. */
function flipTo(line: SaleLine, event: Extract<SaleEvent, { kind: 'unit-flip' }>): SaleLine {
  const { to } = event;
  const captured = event.fromFactor !== undefined || event.toFactor !== undefined;
  /* A recorded null stays unknown. Later settings must never turn an old attempted flip into
     a conversion; only legacy events lacking both snapshot fields use today's catalogue. */
  const fromFactor = captured ? event.fromFactor ?? null
    : line.unitFactor !== undefined ? line.unitFactor
    : declaredUnitFactor(loadConfig().cast, line.product, line.unit);
  const toFactor = captured ? event.toFactor ?? null
    : declaredUnitFactor(loadConfig().cast, line.product, to);
  if (fromFactor === null || toFactor === null || !Number.isFinite(fromFactor)
      || !Number.isFinite(toFactor) || fromFactor <= 0 || toFactor <= 0) return line;
  const r = fromFactor / toFactor;
  const given = round(line.given * r, 3);
  const total = round(line.given * line.price);
  return {
    ...line,
    unit: to,
    unitFactor: toFactor,
    given,
    ordered: round(line.ordered * r, 3),
    price: given > 0 ? round(total / given, 4) : round(line.price / r, 4),
  };
}

/** What a person decided about a word the catalogue has no row for. Both answers are legitimate
 *  and both are one tap: the trade sells one-offs constantly, and it also grows its catalogue. */
export type NonSkuResolution = 'catalogue' | 'one-off';

/** ONE BATCH, AND HOW MUCH OF THE LINE CAME OFF IT. LOT-LAW §2: «a 40 kg line served from two lots
 *  is ordinary and must NEVER force a commercial line split — one price, one line total, lots as
 *  sub-rows». So allocation is a LIST on the line, and `lot` is what that list is called. */
export type Allocation = { batch: string; qty: number; code?: string };

/** A currently recorded physical lot, handed to the sale fold by the stock ledger adapter. */
export type AllocationCandidate = {
  batch: string;
  code: string;
  available: number;
  receivedAt: number;
  day?: string;
};

export type AllocationPick = {
  line: string;
  allocations: Allocation[];
  overrideReason?: string;
  stockRevision?: string;
};

/** WHICH BRAIN FILLED THE LINE (THE-INTELLIGENCE §0). The order brain answers «what did they
 *  mean»; the fulfilment brain answers «what will they actually put on the albarán». A note that
 *  says which one spoke is a note a person can argue with. */
export type FilledBy = 'model' | 'memory';

/** What they said the amount was, in the words they said it in — «una caja». */
export type AskedQty = { qty: number; unit: string };

/** THE DIMENSIONS A LINE CARRIES (FEED-IA §41.1). Every value is one of `catalogue.ts`'s own
 *  register words for the product's family — never free text, which is what the amendment is for.
 *  A dimension nobody set is ABSENT rather than empty, so a house that never preps has lines with
 *  no dimensions on them at all. */
export type LineDimensions = Partial<Record<DimensionId, string>>;

export type SaleLine = {
  id: string;
  product: Product;
  /** what the customer asked for */
  ordered: number;
  /** what is on the albarán — the scale's number, or the amount actually given */
  given: number;
  unit: string;
  price: number;
  /** Base units per selected unit, captured when the unit changes. */
  unitFactor?: number | null;
  /** the scale decides this line's number */
  weighed: boolean;
  /** ⚠ HISTORICAL ONLY (FEED-IA §197.2). The grade a `line` event recorded before «Remove class
   *  everywhere». The fold still reads it off an old ledger so a stored event stays readable, and
   *  no surface in this app draws it and no act writes it. */
  klass?: string;
  /** what the lote reads on the albarán — the names of the batches this line came off */
  lot?: string;
  /** which batches, and how much off each. Written by attaching, never by arriving. */
  allocations?: Allocation[];
  /** A person's concise reason for replacing the FIFO proposal. */
  allocationOverrideReason?: string;
  /** Browser evidence only; production replaces it with the inventory stream revision. */
  allocationStockRevision?: string;
  /** a line added at the desk, at no charge */
  freebie?: boolean;
  /** taken off the albarán. The fold moves it to `sale.removed`, so no surface sees it as a line. */
  off?: boolean;

  /* ── THE THREE FACTS V2 PUTS ON A LINE (THE-APP-V2 §2) ─────────────────────────────────────
   * All three are facts about what ARRIVED, so they are set where the day is built and cleared by
   * a person's own act. None of them is a status a screen may set for itself. */

  /** the message named something the catalogue has no row for; `adopted` is the person's answer */
  nonSku?: boolean;
  adopted?: NonSkuResolution;
  /** what this line's message did not carry legibly — an amount edit is what clears it */
  unreadable?: string;
  /** what this customer usually takes of this product, where the request is far off it */
  usual?: number;

  /* ── WHAT THE INTELLIGENCE PUT HERE (THE-INTELLIGENCE §1, §2, §3) ──────────────────────────
   * «A suggestion looks right, and shows its work underneath.» The three facts below are the
   * work: the words that arrived, the brain that answered them, and the trade's own qualifier
   * riding the name. A line where the model pulled no weight carries NONE of them, and that
   * silence is the law — provenance appears only where there is provenance to show. */

  /** the customer's own words for this thing, where what went on the line reads differently */
  asked?: string;
  /** which brain answered: the fulfilment model's guess, or this customer's own memory */
  filledBy?: FilledBy;
  /** they put their word back on the line — the training signal, recorded (§1) */
  corrected?: boolean;
  /** The source word named several real SKUs; a person selected this exact SKU on this sale.
   *  It retains the source wording and never changes the company catalogue. */
  skuChosen?: boolean;
  /** the trade's own word, riding the name: «Media canal de cerdo · frozen» (§2) */
  amendment?: string;
  /** HOW IT LEAVES THE HOUSE — the bench's own instruction, written by the `prep-note` event and
   *  printed under the line. Never a word the amendment registry claims (the no-word-twice law). */
  prepNote?: string;
  /** Explicit approved wording for customer confirmation/delivery output. It is independent of
   * the packing note and does not change SKU, quantity, unit, price, stock or artwork. */
  customerOption?: CustomerOption;
  /** the amendment has been sent to Stock to become a product of its own (§2) */
  graduated?: boolean;
  /** their words for the AMOUNT, where Rocoto resolved them into the priceable form (§3) */
  askedQty?: AskedQty;

  /* ── WHAT THE GOODS ARE, ON THE AXES THEIR FAMILY HAS (FEED-IA §41.1) ──────────────────────
   * «Fruit/veg get MATURITY; fish/meat get PREPARATION, STATE and AGING where it applies.» Closed
   * registers, so these are FIELDS on the line rather than words riding the name: «maduro» set on
   * two lines is one fact twice, countable and printable as one thing, where the same word carried
   * as an amendment is two strings that happen to match. */
  dimensions?: LineDimensions;
  /** WHAT THE SCALE SAID, where the line is counted in something other than kilos (§41.3). A kilo
   *  line has no second number: there `given` is the final weight. */
  finalWeight?: number;

  /* ── WHERE THIS LINE'S MONEY CAME FROM (FEED-IA §32, §A.11) ────────────────────────────────
   * Two facts, both about the PRICE rather than about the goods, and both written by the fold:
   * a line re-priced by an on-the-fly tarifa switch says so, and a line a hand priced HOLDS its
   * number through every switch. The second is the pin, and it is the same meaning the Ramp's
   * pin carries — one glyph, one meaning, on the line and on the tier table alike. */

  /** the document's tarifa moved and this line's price moved with it */
  tierPriced?: boolean;
  /** a hand typed this price, so it stands through a tarifa switch */
  pinnedPrice?: boolean;
};

export const figureOf = (lines: SaleLine[]): number =>
  round(lines.reduce((sum, l) => sum + l.given * l.price, 0));

/* ── THE SALE ─────────────────────────────────────────────────────────────────────────────── */

/** One turn in the sale's own thread — the customer's words, and the desk's answers. */
export type ThreadRow = {
  id: string;
  author: 'received' | 'sent' | 'ai';
  /** §143: delivery messages and internal activity are different records. AI may send either. */
  kind?: 'message' | 'activity';
  /** Conversation writes can belong to one order without copying them into a second store. */
  orderId?: string;
  text: string;
  email?: {
    subject: string; from: string; to: string[];
    /**
     * Arrival provenance is immutable; connecting another inbox never enables a forwarded message.
     * `accountId` and `canReply` remain only for old kit fixtures. Production resolution uses the
     * tenant-scoped opaque `sourceRef`; neither legacy field can authorize a read or a send.
     * `nativeUrl` is an ephemeral view value returned after authorization, never an event field.
     */
    source?: {
      provider: 'gmail' | 'm365' | 'forwarded';
      /** Legacy kit-only fields. A production DTO uses only the opaque source ref. */
      accountId?: string;
      canReply?: boolean;
      sourceRef?: string;
      nativeUrl?: string;
    };
    messageId?: string;
    inReplyTo?: string;
  };
  /** Provider files are referenced and streamed on demand. Raw fixture text is synthetic only. */
  attachments?: Array<
    | { id: string; name: string; source: 'provider'; sourceRef: string; openPath?: string }
    | { id: string; name: string; source: 'fixture'; text: string }
  >;
  time?: string;
  grouped?: boolean;
  /** A concise operator/AI note tied to this exact source message or email card. */
  scopedNote?: { id: string; says: string };
  /** Immutable source identity for a real provider turn. The raw provider envelope remains in its
   * encrypted account store and history provenance can never be promoted into a new order. */
  source?: {
    channel: 'whatsapp' | 'phone' | 'email';
    messageId: string;
    conversationId: string;
    occurredAt: string;
    historical: false;
  };
};

/** Legacy fixture readings predate `kind`; actual automatic replies remain messages. */
export function isSourceMessage(row: ThreadRow): boolean {
  if (row.kind) return row.kind === 'message';
  return !(row.author === 'ai' && (/^Read from .+ as /i.test(row.text) || /^Confirmed with .+ for /i.test(row.text)));
}

export type Sale = {
  id: string;
  /** the DayOrder this sale is, where it is one of today's — the id `confirmed` speaks */
  orderId?: string;
  customer: Customer;
  /** the hour the request reached the desk */
  at: string;
  /** the day the goods are for, as the river's own key — `2025-08-22` */
  day: string;
  /** the same day, said the way the trade says it — «Friday 22.08» */
  deliveryDay: string;
  /** the hour a scheduled albarán goes out — the requested delivery window */
  window: string;
  /** the hour the decline window closes on a sent albarán */
  declineUntil: string;
  /** the albarán's number. It exists from the moment the document is made. */
  number: string;
  lines: SaleLine[];
  figure: number;
  state: SaleState;
  /** the customer's words and the desk's answers, in order */
  thread: ThreadRow[];
  /** what Rocoto read the message as — the ONE saffron fact on the row */
  reading: string;
  /** the complaint, once the customer has declined */
  dispute?: { at: string; because: string; outcome?: string };
  /** the hours the object collected on its way */
  stamps: Partial<Record<SaleEvent['kind'], string>> & { deliveredAt?: string };
  /** what the guard modal said was missing when a person went ahead regardless (§1.3) */
  confirmedOver?: string[];
  /** what this sale taught Rocoto — the corrections, the flips and the graduations, in the words
   *  they happened in (THE-INTELLIGENCE §1: the correction IS the feedback, and it is legible) */
  learned?: string[];
  /** the customer changed it after it was recorded (U11 rides on the sale it belongs to) */
  changed?: DayOrder['changed'];
  /** it stands on the capture surface, not yet in the feed */
  arriving?: boolean;
  /** A deterministic kit-only §165 scene, never inbox/provider data. */
  theatre?: TheatreOrigin;
  /** A question has conversation identity but never an albarán, printable goods, or export value. */
  messageOnly?: boolean;
  /** ── WHAT THEY HAVE TYPED INTO THE NAME SO FAR (FEED-IA §74.2, §74.4) ─────────────────────
   *  A draft is born on the first keystroke, before anybody has picked a customer, so the field
   *  in the composer's head holds a half-word for as long as they leave it there. It is kept
   *  VERBATIM — resuming a draft shows the letters they walked away from, not an empty seat
   *  (§65.3: their words stay theirs). Only a draft ever carries it. */
  draftSaid?: string;
  /** ── THE HOUSE WROTE THIS ONE ITSELF (FEED-IA §74, §54.3) ─────────────────────────────────
   *  THE FACT THE `new` EVENT CARRIES BY CARRYING NOTHING. Every other document in this book
   *  reached the desk down a channel — a message, a mail, a call — and the customer's profile
   *  says which one their orders come on. A document the composer wrote came down no channel at
   *  all: `{ kind: 'new' }` has no channel field, because there was no arrival to name.
   *
   *  So the arrival is READ HERE, off the event, and the sheet asks this rather than asking the
   *  customer what channel they usually use — which is how a desk-written albarán came to say
   *  «HOW IT ARRIVED · WhatsApp» about a document nobody sent. A profile's habit is not this
   *  document's history, and the surface may only state the second one. */
  writtenHere?: boolean;

  /** SOMETHING HERE WANTS THE PERSON'S OWN VOICE (FEED-IA §9.2). Cleared by answering. */
  needsReply?: NeedsReply;
  /** it arrived with something Rocoto could not answer alone — so a customer is owed a sentence,
   *  and supplying the missing thing is what puts Rocoto back in a position to write it */
  stoodOnArrival?: boolean;
  /** WHAT ROCOTO ASKED THE CUSTOMER ITSELF (THE-INTELLIGENCE §11). It exists only where the house
   *  granted the fluid check, and it is what the card says instead of asking the desk for the same
   *  thing: the answer is on its way, and the person puts it on when it lands. */
  rocotoAsked?: string;

  /* ── WHAT THE COMMIT INVERSION AND THE PREP LIST PUT HERE (FEED-IA §6.2, §7.2) ─────────────
   * Three facets and one mark, all folded from the ledger, none of them a field a screen may set
   * for itself. Together they answer the question the day view asks of every row: has a person
   * judged it, has the bay picked it, has the printer had it, and can it still move. */

  /** SOMEBODY HAS LOOKED AT IT (FEED-IA §66.1). Gmail's own state, and the only «attention» state
   *  this app has now that locking is dead: read but unedited is theirs, on them; «Mark unread»
   *  sends it back to needing attention. Folded from the ledger, never stored. */
  read?: { at: string; by?: string };
  /** Operator follow-up marker, independent of whether the document has been viewed. */
  flagged?: { at: string; by: string };
  /** Archive retains the document and the person who put it away. */
  archived?: { at: string; by?: string };
  /** the machine committed it on arrival — nothing about it needed judging (§6.2) */
  autoCommitted?: boolean;
  /** the bay ticked it off, and which of its lines were ticked on the way */
  prep?: { at: string; lines: string[]; /** it changed after the tick — re-check it (§7.2) */ stale: boolean; /** exact current lines changed after picking, where the ledger names one */ staleLines?: string[] };
  /** how many times it has gone to the printer, when it last did, and whether the goods have
   *  MOVED SINCE (FEED-IA §29.2: «new = arrived OR changed since paper last came out»). A stale
   *  sheet is paper that no longer describes the crate, so the albarán is owed again.
   *  `staleAt` is the hour it stopped describing it, which is what lets the export centre say
   *  «3 new SINCE THE LAST PRINT» about the house's paper rather than about this one sheet. */
  printed?: { count: number; at: string; stale: boolean; staleAt?: string };

  /* ── THE OTHER TWO RAILS, FOLDED THE SAME WAY (FEED-IA §35.3) ──────────────────────────────
   * Facets, not states: an albarán can be printed and not sent, sent and not printed, or all
   * three at once, and none of it moves the statechart. Both carry the same order-derived
   * staleness the paper does, because «edited since sent» is the same question as «edited since
   * printed» asked of another road.
   */

  /** it went to the house's own system: the hour, where it went, and whether the goods have moved
   *  since it did (§35.3: «sent to the ERP · edited since sent») */
  sentToErp?: { at: string; target?: string; stale: boolean; staleAt?: string };
  /** the customer's copy: the hour it is due to leave, the hour the schedule was made, and the
   *  hour it went, once it has (§35.4) */
  emailScheduled?: { at: string; sendAt: string; sent?: string };
  /** lines taken off the albarán, kept so the undo has something to put back */
  removed?: SaleLine[];

  /* ── THE MONEY (FEED-IA §32, Musings 3+4) ──────────────────────────────────────────────────
   * Three facts, folded from the ledger like every other: which tarifa this document priced from,
   * the hour its money stopped moving, and whether it has been collected. None of them is a state
   * — the statechart is untouched — and none of them is a field a screen may set for itself.
   */

  /** the band this document's prices came from. The customer's own, unless a hand switched it. */
  tier: string;
  /** a hand switched the tarifa for THIS albarán; the customer's standing band is untouched */
  tierSwitched?: boolean;
  /** the hour the money stopped moving — the print. Until then the document prices from the sheet
   *  every time it is read, which is what «money is final at print» means mechanically. */
  moneyAt?: string;
  /** it has been collected: the hour, how, and whose hand said so */
  paid?: { at: string; how: PayMethod; by?: string };
};

/* ── THE REPLY THAT IS THEIRS (FEED-IA §9.2, §9.3) ────────────────────────────────────────────
 * «Rocoto's value: it handles the comms on the spot so they stay present — and when something
 * NEEDS the person's own reply, the UI says so in BOTH places: on the sale's card in Sales, and in
 * Chats. Resolution happens through the embedded chat in the sale's own screen.»
 *
 * So this is a second KIND of standing card, and it is not a flag about the lines: nothing here is
 * edited, and the act that clears it is a sentence sent to a customer. §9.3 names the two:
 *
 *   ORDER-RELATED  Rocoto needs help understanding the order · the order is big enough to want
 *                  confirming · the order is understood but may not be gettable.
 *   NON-ORDER      the customer asked something — a price, whether there is any — that has to be
 *                  attended to.
 *
 * ONE TRUTH, TWO DOORS. The question is a MESSAGE, so it is a row in the sale's own thread — which
 * is what puts it in Chats as the conversation's last word, unread, with no second store and no
 * second flag to keep in step. Answering writes a `reply` event; the fold sees it and the card
 * sits down in both places at once.
 */

export type ReplyKind = 'order' | 'ask';

export type NeedsReply = {
  kind: ReplyKind;
  /** what the person is being asked to do, as the card says it: «asks about the gamba price» */
  about: string;
  /** A provider order awaiting its first reply, rather than a later request for more goods. */
  initial?: boolean;
};

/* ── THE DAYS THE RIVER SPANS (FEED-IA §5.2, §5.3) ────────────────────────────────────────────
 * «Ours anchors at TODAY: down = the record (Monzo exactly), UP = the horizon (tomorrow, +2…
 * realistically ≤3 days out, designed for ≤7).» So the feed is not today-and-yesterday: it is a
 * dated river, and the day is a real date rather than a caption — which is what lets the day
 * view's mini calendar dot the days that hold orders instead of miming one.
 *
 * THE YEAR IS READ OFF THE CAST'S OWN WORD. The catalogue says «Friday 22.08», and 22.08.2025 is
 * a Friday — so the weekday the cast wrote and the weekday the calendar computes are the same
 * weekday, and no screen has to choose between them.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** The synthetic world stands on Cedar's boot-time Peru calendar day. */
export function baseDate(_cast: Cast): Date { return cedarDayFromId(cedarTodayId()); }

/** THE DAY A BOOK OFFSET LANDS ON (14 September 2026). A past offset that lands on a Sunday steps
 *  back to the Saturday: Sunday is a handful of hotels (§31.1), so «the record day» of a Monday
 *  boot is Saturday, the trade's big day, and the retained Money ledger (24 invoices for the last
 *  delivery day's customers) has the sales it names on every weekday. Days ahead keep their own
 *  rule — the first delivery day ahead skips a Sunday, and a Sunday that stays in the horizon is
 *  drawn at six percent of its load. */
export const dayOfOffset = (base: Date, offset: number): Date => {
  const day = shiftDay(base, offset);
  return offset < 0 && day.getDay() === 0 ? shiftDay(base, offset - 1) : day;
};

export const shiftDay = (d: Date, days: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

export const dayIdOf = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const dayFromId = (id: string): Date => {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** «Friday 22.08» — the trade's own way of saying a day, computed rather than captioned. */
export const dayLabelOf = (d: Date): string =>
  `${WEEKDAYS[d.getDay()]} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;

/** «22.08» — for the places a weekday does not fit. */
export const dayShortOf = (d: Date): string => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;

/** THE RIVER'S ORDER, TOP TO BOTTOM: the horizon first, today in the middle, the record below.
 *  Scrolling down walks backwards through the record, exactly as Monzo does; scrolling up walks
 *  forward into what the house has promised. */
export const DAY_OFFSETS = [3, 2, 1, 0, -1];

export type FeedDay = {
  id: string;
  date: Date;
  /** «Friday 22.08» */
  label: string;
  /** «22.08» */
  short: string;
  /** days from today; 0 is today */
  offset: number;
};

export function feedDays(cast: Cast): FeedDay[] {
  const base = baseDate(cast);
  return DAY_OFFSETS.map((offset) => feedDayOf(cast, dayIdOf(dayOfOffset(base, offset))));
}

/** ANY DAY, AS THE RIVER SAYS IT (§27). The narrow's chevrons and its calendar reach days the
 *  river does not draw, and a day the person stands on has to be the same object whether or not
 *  it happens to hold anything. */
export function feedDayOf(cast: Cast, id: string): FeedDay {
  const base = baseDate(cast);
  const date = dayFromId(id);
  const offset = Math.round((date.getTime() - base.getTime()) / 86400000);
  return { id, date, label: dayLabelOf(date), short: dayShortOf(date), offset };
}

/** The day the app is standing in. */
export const todayId = (cast: Cast): string => dayIdOf(baseDate(cast));

/** What a day is called, wherever a day id has to become words. */
export const dayLabelFromId = (id: string): string => dayLabelOf(dayFromId(id));

/** DAYS SPEAK THEIR NEARNESS FIRST (FEED-IA §18): «do TODAY as the main thing of the today one,
 *  TOMORROW as the main thing and yesterday as the main thing, and beyond that starting with the
 *  name of the day.» Null past those three, where the weekday leads instead. Both jobs read the
 *  nearness through here, so the river's whisper and the prep list's header say one word. */
export const nearWordOf = (day: string, today: string): string | null => {
  if (day === today) return 'Today';
  const t = dayFromId(today);
  if (day === dayIdOf(shiftDay(t, 1))) return 'Tomorrow';
  if (day === dayIdOf(shiftDay(t, -1))) return 'Yesterday';
  return null;
};

/* ── THE PAYMENT CLOCK ────────────────────────────────────────────────────────────────────────
 * The delivery date starts it, and thirty days is what the trade runs on. It prints on the
 * albarán because the albarán is the document that starts it — the invoice only repeats it.
 */

export const PAYMENT_DAYS = 30;

export const payByOf = (sale: Sale): string =>
  dayLabelOf(shiftDay(dayFromId(sale.day), PAYMENT_DAYS));

/* ── THE MONEY, SAID (FEED-IA §32, Musings 3+4) ───────────────────────────────────────────────
 * Every sentence in this block states what IS. A price nobody has written yet is not «pending»,
 * «missing» or «unset» — it is priced by today's tarifa when the paper comes out, which is a
 * promise the software keeps. An uncollected albarán does not say «unpaid»: a cash drop says the
 * instruction, a credit drop says its date, and a collected one says the hour it came in.
 *
 * The money mark rides the FIGURE'S own line box, small and dimmer — the price-unit law applied to
 * a state — and it is ink, because collecting is a person's act and the accent is the AI's alone.
 */

/** WHICH BAND THIS DOCUMENT PRICED FROM. The chip on the document card reads this. */
export const tierOf = (sale: Sale): string => sale.tier;

/** …said the way the house says it. «Tarifa 2». */
export const tierWordsOf = (cast: Cast, sale: Sale): string => tierNameOf(cast, sale.tier);

/** THE ANNOTATION A SWITCH STAMPS. It names the band and the document, so a reader knows the
 *  customer's own band was left alone. */
export const tierSwitchWords = (cast: Cast, sale: Sale): string =>
  `Priced on ${tierNameOf(cast, sale.tier)} for this delivery note`;

/** THE PROMISE AN OPEN ROW MAKES. Said as what happens, never as what is missing. */
export const PRICE_AT_PRINT_WORDS = 'Priced with today’s tarifa when it prints';

/** the money stopped moving when the paper came out */
export const moneyIsFinal = (sale: Sale): boolean => Boolean(sale.moneyAt);

/** What the document says about its own money: the promise while it is open, the stamp once the
 *  paper exists. One sentence, and it changes at exactly one moment. */
export const moneyWords = (sale: Sale): string =>
  sale.moneyAt ? `Money stamped at print · ${sale.moneyAt}` : PRICE_AT_PRINT_WORDS;

/** A LINE WHOSE PRICE IS STILL TO COME — the odd non-SKU thing the sheet has no row for. It is a
 *  real state and it says what is coming, not what is absent. */
export const priceIsPending = (line: SaleLine): boolean => !(line.price > 0) && !line.freebie;

/** «Paid 12:40 · cash · Nuria» — the hour, the method, and the person. Never a bare checkbox. */
export const paidWords = (sale: Sale): string | null =>
  sale.paid
    ? `Paid ${sale.paid.at} · ${PAY_METHOD_WORDS[sale.paid.how]}${sale.paid.by ? ` · ${sale.paid.by}` : ''}`
    : null;

/** What a row that has yet to be collected says, in the customer's own terms. A credit customer
 *  inside their thirty days says nothing at all — silence is the default, and a sentence there
 *  would be the software fretting out loud. */
export function collectWords(sale: Sale, today?: string): string | null {
  if (sale.paid) return null;
  if (RANK[sale.state] < RANK.made) return null;
  if (sale.customer.settles === 'cash on delivery') {
    return `Collect on delivery · ${soles(sale.figure)}`;
  }
  const due = dayIdOf(shiftDay(dayFromId(sale.day), PAYMENT_DAYS));
  return today && today >= due ? `Due ${payByOf(sale)}` : null;
}

/** THE ONE LINE THE FIGURE CARRIES UNDER IT, whichever of the two facts is true. */
export const moneyMarkOf = (sale: Sale, today?: string): string | null =>
  paidWords(sale) ?? collectWords(sale, today);

/** WHAT THE DAY COLLECTED. The whisper carries it beside the print count, so a driver or a desk
 *  knows the day's money without opening anything. */
export function collectedOf(sales: Sale[]): { count: number; amount: number } {
  const paid = sales.filter((s) => s.paid);
  return { count: paid.length, amount: round(paid.reduce((sum, s) => sum + s.figure, 0)) };
}

export const collectedWords = (c: { count: number; amount: number }): string =>
  `${c.count} collected · ${soles(c.amount)}`;

/* ── THE DAY'S SHAPE ──────────────────────────────────────────────────────────────────────────
 * The hours a house works to, derived from the cast's own morning so the fish day and the meat
 * day are different days: the van leaves four hours after the market opens, and the customer has
 * five hours with the goods before the decline window closes.
 */

/** THE VAN'S OWN HOUR. The ordering period runs to 09:30 on the fish cast (`day.ts`'s `ORDERING`),
 *  so the round leaves an hour after it closes and the customer has the rest of the day with the
 *  goods. A window inside the ordering period would be a house promising a drop before half its
 *  morning had even arrived. */
export const windowOf = (cast: Cast): string => clockAfter(cast.hour, 330);
export const declineUntilOf = (cast: Cast): string => clockAfter(cast.hour, 540);

/** THE HOUR THIS DROP WAS ASKED FOR (FEED-IA §21). «Most deliveries are for the MORNING OF —
 *  effectively one time. Some carry preferred slots.» So a sale answers with the customer's own
 *  hour where they asked for one and with the house's own window where they did not.
 *
 *  AND THE SORT THAT USES IT LIVES ON PAPER. «Processing beats chronology… the PRINTED OUTPUTS are
 *  where slots matter: the delivery list prints SORTED BY REQUESTED DELIVERY TIME.» The working
 *  list is about cleanly processing, so neither the river nor the prep list ever orders by this. */
export const slotOf = (sale: Sale): string => sale.customer.slot ?? sale.window;

/** THE CUSTOMER ASKED FOR AN HOUR (§35.5: «the requested delivery time shows on the order as a
 *  SLOT chip»). Most did not, and the chip exists for exactly the ones who did — a chip on every
 *  row would be the house pretending its whole book has a timetable. */
export const askedSlotOf = (sale: Sale): string | null => sale.customer.slot ?? null;

/* ── THE THREE ROADS OUT, AND WHICH OF THEM THE HOUSE HAS OPENED (FEED-IA §35.3, §35.6, §26.5) ──
 * «EXPORT IS ONE OF ROCOTO'S MAIN JOBS. Three rails, print the main one: PRINT · ERP · EMAIL.»
 *
 * Paper is always there — every house prints. The other two are CONNECTIONS, and the two kinds of
 * connection are read in two different places:
 *
 *   THE ERP     `config.erp.target`, a SETTINGS value. «Today's file» is the honest state of a
 *               house that has not connected one: the data ends up in a file they carry across
 *               themselves. Anything else is a system Rocoto reaches, and the cadence grant says
 *               WHEN it reaches it — «as each order accepts» (the stream) or «with today's file»
 *               (§26.5). A pure fold can know this, so `RailWorld` carries it.
 *   THE EMAIL   a POLLED PROVIDER CONNECTION, so the surface that draws it reads
 *               `useEmailCapability()` and this model carries nothing about it (§247.2).
 *
 * ⚠ 14 September 2026 · THE MAIL RAIL LEFT THIS TYPE. It held three fields — `configured`,
 * `connected` and `label` — and after `config.mailbox` was retired on 13 September every one of
 * them was the constant `false`/`''`. A rail that can only say one thing is a model pretending to
 * answer a question it cannot reach, and its readers all took the disconnected branch: Prep's
 * scheduled-email plan said «Connect email to activate» under a destination reading
 * «seller@example.invalid · Connected», and the Delivery Note's rails could never name the mail.
 * PRODUCT-SPEC's own rule — «a connection entry reads a live selector and never a local draft» —
 * says where it belongs, so `shell/printing.tsx` and `detail.tsx` read the capability directly and
 * `emailWordsOf` below states the sentence for a document on a rail that is already there.
 *
 * THE CONFIG IS READ HERE RATHER THAN THREADED IN, for the reason the grants already are: every
 * predicate in this file is called from a dozen surfaces, and one missed thread would be a screen
 * quietly disagreeing with the Settings row that set it. `loadConfig` reads the same storage the
 * provider writes on every change, so the value this file sees is the value Settings just wrote.
 * The mailbox is the counter-example that proves the rule: it is not in storage, it is polled, so
 * threading it would be exactly the missed thread — `areas/sales.tsx` builds a rail world purely
 * to ask `exportStance` whether the paper may go, with no mailbox anywhere in sight.
 */

/** THE HOUR THE DAY'S FILE GOES. Eleven hours after the market opens — the end of the working day
 *  on the cast's own clock, so the fish house's file leaves at 16:00 and the meat house's at
 *  19:00. It is the hour the file cadence means by «end of day». */
export const fileHourOf = (cast: Cast): string => clockAfter(cast.hour, 660);

export type RailWorld = {
  erp: {
    /** an ERP target was selected in Settings */
    configured: boolean;
    /** server-authoritative automation activation; false in the browser-only Kit */
    connected: boolean;
    /** what the house calls it — «Sage 50». Absent while the data ends up in a file. */
    name: string;
    cadence: Cadence;
    /** the hour today's file goes, where the cadence is the file */
    fileAt: string;
  };
};

const ERP_NAMES: Record<string, string> = {
  sage50: 'Sage 50', holded: 'Holded', a3: 'A3', file: 'Today’s file',
};

export function railWorld(cast: Cast): RailWorld {
  const config = loadConfig();
  const grants = grantsNow();
  return {
    erp: {
      configured: config.erp.target !== 'file',
      connected: false,
      name: ERP_NAMES[config.erp.target] ?? config.erp.target,
      cadence: grants.cadence,
      fileAt: fileHourOf(cast),
    },
  };
}

/** WHO CAN BE EMAILED. The seed's one piece of evidence that a customer has an address is the
 *  channel their own orders arrive on, so that is what this reads — and a house whose book is
 *  mostly WhatsApp gets exactly the handful of email customers it really has (§35.4). */
export const takesEmail = (sale: Sale): boolean => sale.customer.channel === 'email';

/** What the scale said, line by line — deterministic, so a made albarán is the same albarán on
 *  every reload. Reality is recorded at MAKE; before that a line carries what was asked. */
const SCALE_DELTA = [0.4, -0.2, 0.9, 0.15, -0.35, 0.6];

export const scaleReading = (line: SaleLine, i: number): number =>
  round(line.ordered + SCALE_DELTA[i % SCALE_DELTA.length], 2);

/* ── BUILDING THE DAY'S SALES ─────────────────────────────────────────────────────────────────
 * Today's five come from `dayOrders` — the same five Today and Orders always drew. Yesterday's
 * three are the same customers a day earlier, so the feed has a second group and the states that
 * only exist AFTER a van has been out are on screen at rest.
 */

/** A REQUEST ARRIVES WITHOUT A LOTE, and that is the point (THE-APP-V2 §5.7). The customer asks
 *  for 12 kg of merluza; WHICH boxes those 12 kg come off is the house's own decision, made at the
 *  moment it commits to making it. Seeding the catalogue's lote onto an incoming line pre-decided
 *  that allocation, which left the guard with nothing to check and the proposal with nothing to
 *  propose. The allocation is now an EVENT, so the albarán records who attached what and when. */
const lineOf = (cast: Cast, raw: DayOrder['order']['lines'][number], seed = 0): SaleLine => {
  const product = productOf(cast, raw.product);
  const c = conversionOf(product);
  return {
    id: raw.id,
    product,
    ordered: raw.qty,
    given: raw.qty,
    unit: raw.unit,
    price: raw.price,
    weighed: product.variableWeight,
    /* THE TRIPLE'S FIRST TERM IS ALREADY IN THE CATALOGUE (THE-INTELLIGENCE §3). `wasQty` is what
       the order line was BEFORE Rocoto resolved it — «a caja of pulpo» standing behind 10 kg — so
       the words the customer used are read off the cast rather than written here. */
    askedQty: raw.wasQty !== undefined && c ? { qty: raw.wasQty, unit: c.big } : undefined,
  };
};

/* ── WHAT ROCOTO MADE OF THE MESSAGE (THE-APP-V2 §1.5, §2) ────────────────────────────────────
 * Two of the day's five messages are the hard ones every desk actually gets: one where the
 * customer's number is off by a factor, and one where a line arrived unreadable and named
 * something the catalogue has no row for. They are seeded exactly the way the base LEDGER is
 * seeded — as facts about what ARRIVED, in the same file, so «what the morning already contains»
 * and «what this person just did» stay one kind of fact.
 *
 * The words on the chip are then COMPUTED from these facts (10× is `given / usual`), never
 * written: a flag that states a number nobody can check is the thing this product replaces.
 */

type MessageReading = {
  /** the line the customer got wrong by a factor — the classic 12 that arrives as 120 */
  times?: { line: number; by: number };
  /** the index of the line whose amount the message did not carry legibly */
  unreadable?: number;
  /** the message named something the catalogue has no row for */
  offCatalogue?: boolean;
  /** the whole order is a banquet — every line multiplied, so the ORDER trips the house's ceiling
   *  while no single line is odd. It is the one exception that is about money rather than words. */
  scale?: number;
};

/* ── THE EXCEPTIONS ARE FEW, AND THAT IS THE POINT (FEED-IA §26.3, §31.1) ─────────────────────
 * «The many auto-confirm; the few weird ones are the review. Spend time only on the weird ones.»
 * At three hundred orders that sentence stops being a preference and becomes the thing the surface
 * has to PROVE: a morning where five per cent of the book needed judging would be a morning nobody
 * could work. So the readings below are a handful — two on the founder's own named customers and
 * three deep in the house's book — and every one of the other two hundred and eighty rows lands
 * committed without a person touching it.
 *
 * THE THREE ARE PICKED BY POSITION IN THE DAY, never by name: the book is generated, so an id
 * typed here would be a fact about a row that may not exist. A cast too small to have that many
 * orders simply keeps the two it was written with.
 */

const READINGS = new WeakMap<Cast, Record<string, MessageReading>>();

function readingsOf(cast: Cast): Record<string, MessageReading> {
  const held = READINGS.get(cast);
  if (held) return held;
  const day = dayOrders(cast);
  const out: Record<string, MessageReading> = {
    nou: { times: { line: 0, by: 10 } },
    vera: { unreadable: 1, offCatalogue: true },
  };
  const put = (n: number, reading: MessageReading) => {
    const id = day[n]?.id;
    if (id && !out[id]) out[id] = reading;
  };
  put(46, { times: { line: 0, by: 6 } });
  put(133, { unreadable: 0 });
  put(207, { scale: 5 });
  READINGS.set(cast, out);
  return out;
}

/** THE WORD THAT IS NOT IN THE CATALOGUE. A non-SKU line's product cannot come from the cast —
 *  being absent from the cast is the entire definition of it. So this is the CUSTOMER'S OWN WORD,
 *  transcript content of the same kind this file already composes for a thread, and the
 *  catalogue's law that no product name is typed into a screen stands: this is not a product yet.
 *  Adopting it is what makes it one. It belongs to the house's own family, so the law that governs
 *  the shelf governs it — which is why an off-catalogue line has no lote and the gate catches it. */
const OFF_CATALOGUE: Record<SectorId, { name: string; unit: string; price: number }> = {
  fish: { name: 'Sepia', unit: 'kg', price: 9.4 },
  meat: { name: 'Panceta adobada', unit: 'kg', price: 7.2 },
  fruit: { name: 'Perejil', unit: 'manojo', price: 0.9 },
};

const offCatalogueLine = (cast: Cast, id: string): SaleLine => {
  const heard = OFF_CATALOGUE[cast.sector];
  return {
    id,
    product: {
      id: `off-${cast.sector}`,
      name: heard.name,
      family: cast.families[0].id,
      unit: heard.unit,
      variableWeight: false,
      /* no trace at all: there is no batch behind a word, which is the whole point of the gate */
      trace: {},
    },
    ordered: 2,
    given: 2,
    unit: heard.unit,
    price: heard.price,
    weighed: false,
    nonSku: true,
  };
};

/* ── WHAT THE INTELLIGENCE DID TO THE MESSAGE (THE-INTELLIGENCE §1, §2, §3) ───────────────────
 * Three seeds, one per doctrine section, each of them a fact about what ARRIVED — so they sit in
 * this file beside the reading and the off-catalogue word, and «what the morning already contains»
 * stays one kind of fact.
 *
 * They carry the CUSTOMER'S OWN WORDS, which is why they are written here and not in the
 * catalogue: «tomates pera» is not a product, it is what somebody said down a phone. Adopting it
 * is what would make it one. Law 10 holds — no PRODUCT name is typed into a screen, and every one
 * of these points at a product the cast already holds.
 */

/** §1 — the line the fulfilment brain filled with something other than the word that arrived. One
 *  per sector, on one customer, so the day shows the law's other half too: every other line on
 *  every other card carries nothing at all. */
type Fill = { customer: string; product: string; asked: string; by: FilledBy };

const FILLS: Record<SectorId, Fill> = {
  /* they asked for the wild one; the estuary one is what was on the floor this morning */
  fish: { customer: 'hotelrec', product: 'lubina', asked: 'lubina salvaje', by: 'model' },
  /* they said the family word; the sort is the one this house always sends them */
  meat: { customer: 'hotelrec', product: 'chorizo', asked: 'chorizo', by: 'memory' },
  /* THE SORT CASE, verbatim from the doctrine: a plum tomato asked for, the sort you had given */
  fruit: { customer: 'hotelrec', product: 'tomate', asked: 'tomates pera', by: 'model' },
};

/** §2 — the amendment: the trade's own qualifier on a product the catalogue holds. It rides EVERY
 *  line of that product across the day, which is what makes it a habit rather than a one-off, and
 *  a habit is what the graduation offer is for. Two of them are the cast's own transcript («the
 *  merluza for the plancha», «el aguacate bien maduro»); the meat one is the doctrine's own case —
 *  a fresh SKU asked for frozen. */
type Amendment = { product: string; word: string };

const AMENDMENTS: Record<SectorId, Amendment> = {
  fish: { product: 'merluza', word: 'for the plancha' },
  meat: { product: 'mediacanal', word: 'frozen' },
  fruit: { product: 'aguacate', word: 'ripe' },
};

/** §3 — the amount in the words it was said in, where the catalogue's own line does not carry it.
 *  Fish and fruit put `wasQty` on the order line, so those come off the cast; the meat house says
 *  «half a media canal» in its words and its line lands on 21 kg, so that pair is written here. */
const ASKED_QTY: Partial<Record<SectorId, { customer: string; line: string; qty: number }>> = {
  meat: { customer: 'cansole', line: 'l1', qty: 0.5 },
};

/** The three seeds, put on the lines they belong to. A sale that touches none of them comes back
 *  exactly as it went in. */
/** WHOSE HABIT IT IS (§2). An amendment is a word one customer says on every order — «the merluza
 *  for the plancha» — so it belongs to the pair of customer and product, not to the product alone.
 *  With five customers on the book that distinction did not show; with three hundred, riding every
 *  merluza line in the house would put one word on a hundred and fifty rows and turn a habit into
 *  wallpaper. So the cast's own customer keeps it, and about one account in thirty has it too —
 *  enough for the graduation offer to be counting something real. */
const amends = (cast: Cast, customer: string): boolean =>
  customer === cast.order.customer || scatterId(customer, 101) > 0.965;

function dress(cast: Cast, customer: string, lines: SaleLine[]): SaleLine[] {
  const fill = FILLS[cast.sector];
  const amend = AMENDMENTS[cast.sector];
  const said = ASKED_QTY[cast.sector];
  const habit = amends(cast, customer);
  return lines.map((l) => {
    let out = l;
    if (fill.customer === customer && fill.product === l.product.id) {
      out = { ...out, asked: fill.asked, filledBy: fill.by };
    }
    if (habit && amend.product === l.product.id) out = { ...out, amendment: amend.word };
    if (said && said.customer === customer && said.line === l.id) {
      const c = conversionOf(l.product);
      if (c) out = { ...out, askedQty: { qty: said.qty, unit: c.big } };
    }
    return out;
  });
}

/** THE MESSAGE SAYS THEIR WORDS, because the message is theirs. Where a line was filled with
 *  something finer than what arrived, the bubble carries the word they used — so the quoted
 *  message and the provenance note under the line can never describe different orders. */
const inTheirWords = (text: string, lines: SaleLine[]): string =>
  lines.reduce((t, l) => {
    if (l.asked) return t.replace(l.product.name, l.asked);
    /* AND THE AMENDMENT IS THEIR WORD TOO (§2: «in the trade's own word, exactly as said»), so it
       stands in the message the chip claims it came from. */
    return l.amendment ? t.replace(l.product.name, `${l.product.name} ${l.amendment}`) : t;
  }, text);

/** The seeded reading, applied to a request's lines. Every number it writes stays a real number:
 *  the raised line keeps what the customer usually takes beside it, and the unreadable line has no
 *  amount at all rather than a plausible one. */
function readMessage(cast: Cast, id: string, lines: SaleLine[]): SaleLine[] {
  const reading = readingsOf(cast)[id];
  if (!reading) return lines;

  let out = lines.map((l, i) => {
    if (reading.times && reading.times.line === i) {
      const asked = l.ordered * reading.times.by;
      return { ...l, ordered: asked, given: asked, usual: l.ordered };
    }
    if (reading.unreadable === i) {
      return { ...l, ordered: 0, given: 0, unreadable: 'the amount' };
    }
    /* THE BANQUET (§26.3's «weird ones»). Nothing about any one line is odd, so no line carries a
       flag — the ORDER is what the house's ceiling has an opinion about, and `flagsOf` reads that
       off the figure. It is the one exception a person judges by looking at the money. */
    if (reading.scale) {
      const asked = round(l.ordered * reading.scale, 2);
      return { ...l, ordered: asked, given: asked };
    }
    return l;
  });

  if (reading.offCatalogue) out = [...out, offCatalogueLine(cast, `n${out.length + 1}`)];
  return out;
}

/** The albarán's number: the day it is for, then a sequence on that day. Derived, so the document
 *  the feed names is the document the strip and the release screen name — today's sales keep the
 *  `2208-11x` run those two already draw. */
const numberFor = (date: Date, i: number, base: number): string =>
  `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}-${base + i}`;

/* ── THE COMMIT INVERSION (FEED-IA §6.2) ──────────────────────────────────────────────────────
 * «An order is basically an albarán that just hasn't been committed yet… you go from uncommitted
 * to committed, and things that are exceptions. Uncommitted is the EXCEPTION state — the machine
 * commits the rest on arrival. The person's job is judging the few, never blessing the many.»
 *
 * So this is the only question asked of an arriving sale, and «request» is what it answers NO to.
 * Everything the flag machinery already computes is what makes an exception an exception, which is
 * why nothing new is stored: an edit that clears a flag is an edit that clears the exception.
 */
function landsCommitted(sale: Sale): boolean {
  /* THE HOUSE'S OWN GRANT COMES FIRST (THE-INTELLIGENCE §11). A house that has not handed Rocoto
     the confirmation keeps every order: nothing lands committed, each one stands with its verb on
     it, and the customer waits for a person — which is precisely what that answer asked for. */
  if (!grantsNow().confirm) return false;
  /* A LATE CHANGE IS NOT AN EXCEPTION. §6.2's three are «unclear, off-catalogue, threshold», and a
     customer who raised a line after the order was recorded has told the house something plainly —
     the sale still commits, the change rides it as a tag, and its blast radius is one tap away
     inside the document (§10.6: «commit fast and true-up at made»). Holding it back would put a
     third of a normal morning in a band whose whole point is that it stays short. */
  return flagsOf(sale).length === 0 && openNonSku(sale).length === 0;
}

/** How far the morning had already walked each sale when the person sat down. A sale the machine
 *  committed and nobody has touched since rests at `committed`; the ones the bay has been at rest
 *  further along. Written as the state the seed ledger walks the sale TO. */
type Seed = { target: SaleState; prepared?: boolean; printed?: number; touched?: boolean };

/** THE BASE LEDGER. Where the days already stood when the person sat down — written as the events
 *  that would have put them there, so there is exactly one kind of fact in this system. */
function seedEvents(cast: Cast, sales: Sale[], seeds: Record<string, Seed>): SaleEvent[] {
  const out: SaleEvent[] = [];
  /* the batch book, consumed as the seeded sales take off it — so a lote the morning already spent
     is not offered again to the sale the person is standing in front of */
  const taken = new Map<string, number>();
  /* ── NOTHING THE MORNING DID HAS HAPPENED YET (§31.1) ──────────────────────────────────────
   * The seed walks a sale forward by a fixed number of minutes from the hour it arrived, and at
   * three hundred orders the last of them land at 09:30 — so an albarán that arrived at 09:25 was
   * being stamped «printed 10:25» while the app's own clock said 09:45, and a whole column of the
   * river carried paper from the future. A stamp may not outrun the hour the app is standing in.
   *
   * IT COMPRESSES RATHER THAN CLAMPS. Pinning every late step to the clock stacked a dozen rows on
   * «printed 09:45», which is a column of identical hours and reads exactly as machine-made as the
   * future ones did. An order that landed at 09:13 and has been printed was printed somewhere in
   * the half hour since, so the whole walk is scaled into the room that is actually left and the
   * steps keep their order. A sale whose DAY is already past is exempt: yesterday really did have
   * an afternoon. */
  const now = nowOf(cast);
  const today = todayId(cast);
  /* which roads out of the house are open this morning (§35.3), read once for the whole walk */
  const rails = railWorld(cast);
  /* THE HOURS PAPER CAME OUT IN. Two runs on the cast's own clock — one when the first wave has
     landed and one as the ordering period closes — so «since the last print» means something. */
  const PRESSES = [clockAfter(cast.hour, 150), clockAfter(cast.hour, 255)];
  const HHMM = /^(\d{1,2}):(\d{2})$/;
  const minutesOf = (t: string): number => {
    const m = HHMM.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  };
  /** the longest step a sale still in play takes — printing, and the change that follows a pick */
  const WALK = 100;
  const nowMinutes = minutesOf(now);
  sales.forEach((s) => {
    const seed = seeds[s.id];
    if (!seed) return;
    const want = seed.target;
    const at = s.at;
    const room = Math.max(0, nowMinutes - minutesOf(at));
    const squeeze = s.day < today ? 1 : Math.min(1, room / WALK);
    const by = (minutes: number): string => clockAfter(at, Math.round(minutes * squeeze));
    /* THE ALBARÁN IS WHERE THE LOTE LANDS, so only a sale the morning already MADE has spent the
       book (LOT-LAW §4: gate at albarán close). A merely committed sale is a promise to make it;
       its lotes are still to attach, which is exactly the moment §5.7's proposal is for. */
    if (RANK[want] >= RANK.made) {
      allocate(cast, s, taken).forEach((p) =>
        out.push({ kind: 'lot', sale: s.id, at: by(25), line: p.line.id, allocations: p.allocations }));
    }
    /* THE MACHINE'S OWN COMMIT. It carries `auto`, so the row can say who committed it — the
       inversion is only honest if the person can see which ones they never touched. */
    if (RANK[want] >= RANK.committed) out.push({ kind: 'commit', sale: s.id, at, auto: true });
    if (RANK[want] >= RANK.made) out.push({ kind: 'make', sale: s.id, at: by(25) });
    if (RANK[want] >= RANK.scheduled) {
      out.push({ kind: 'schedule', sale: s.id, at: by(32), window: windowOf(cast) });
    }
    if (RANK[want] >= RANK.sent) out.push({ kind: 'send', sale: s.id, at: by(44) });
    if (RANK[want] >= RANK.delivered && want !== 'disputed') {
      out.push({ kind: 'deliver', sale: s.id, at: by(95) });
    }
    if (want === 'disputed') {
      out.push({ kind: 'deliver', sale: s.id, at: by(95) });
      out.push({
        kind: 'decline',
        sale: s.id,
        at: by(140),
        because: `The ${s.lines[0].product.name} came in short of what the delivery note says. Please look at it.`,
      });
    }
    if (want === 'settled') out.push({ kind: 'settle', sale: s.id, at: by(210) });
    /* the bay's own two acts, seeded the same way — a morning where nothing has been picked yet is
       a morning nobody has worked, and the day view would be a screen of empty circles */
    if (seed.prepared) out.push({ kind: 'prepare', sale: s.id, at: by(55) });
    /* ── THE MORNING PRINTS IN PRESSES (FEED-IA §29.1, §32.B, §35.3) ────────────────────────
     * Paper comes out in RUNS, not one albarán at a time: «they press ⎙ Print 200 new once and
     * live in the 40». The seed used to stamp every sheet an hour after its own order arrived,
     * which is a house where somebody walks to the printer three hundred times — and it made
     * «how many came in since the last print» unanswerable, because the last print was always
     * the last order. So the day has PRESSES, and a printed albarán carries the hour of the
     * press that caught it. What arrived after the last press is exactly what is new.
     *
     * A DAY THAT IS OVER HAS ONE MORE PRESS: the van's own hour, because yesterday's paper all
     * went out with yesterday's van. Today's last press is behind us and the run since it is
     * the work the export centre is counting. */
    const madeAt = by(25);
    const presses = s.day < today ? [...PRESSES, windowOf(cast)] : PRESSES;
    const caught = presses.filter((p) => p > madeAt);
    const paper: string[] = [];
    for (let n = 0; n < (seed.printed ?? 0); n += 1) {
      const at = caught[n] ?? (s.day < today ? clockAfter(madeAt, 15 + n * 10) : null);
      if (at) paper.push(at);
    }
    paper.forEach((at) => out.push({ kind: 'print', sale: s.id, at }));

    /* THE CHANGE THAT LANDS AFTER THE PICK — AND AFTER THE PAPER (§7.2, §29.2, §35.3). It is an
       ordinary line event; what makes it the case the whole product turns on is WHEN it lands. It
       has to fall after the press that caught this albarán, or the sheet in the tray still
       describes the crate and neither «look at it again» nor «print it again» is true. So the
       hour is the paper's own plus a few minutes where paper exists, and the pick's otherwise. */
    if (seed.touched && s.lines[0]) {
      const after = paper.length > 0 ? clockAfter(paper[paper.length - 1], 12) : by(70);
      out.push({ kind: 'line', sale: s.id, at: after, line: s.lines[0].id, given: round(s.lines[0].given + 2, 2) });
    }

    /* ── THE MORNING'S OTHER TWO RAILS (FEED-IA §35.3, §35.6, §26.5) ────────────────────────
     * The seed only stamps a rail the house has actually opened. A house whose data ends up in a
     * file has no ERP sends in its ledger and no ERP counts on its header — which is what makes
     * the CONNECT line on that rail an honest sentence rather than an advert with numbers behind
     * it (§35.3: «it's not an upsell because you can SEE it in the client»).
     *
     * THE CADENCE DECIDES THE HOUR, exactly as the grant says it does:
     *   STREAM  «accepted orders go to your ERP's queue as they land» — so the send is stamped at
     *           the moment the order was accepted, and a change made afterwards leaves the rail
     *           saying «edited since it went», which is the whole of §35.3's fourth fact.
     *   FILE    one file at the end of the day. Yesterday's went; today's has not, because the
     *           hour has not come — and a day whose file is still to go is a day whose rail says
     *           what is going to happen rather than what did.
     */
    if (rails.erp.connected && RANK[want] >= RANK.committed) {
      const wentAt = rails.erp.cadence === 'stream' ? by(4) : s.day < today ? rails.erp.fileAt : null;
      if (wentAt) out.push({ kind: 'erp-send', sale: s.id, at: wentAt, target: rails.erp.name });
    }

    /* ⚠ 14 September 2026 · THE MORNING SCHEDULES NO MAIL OF ITS OWN. A branch stood here that
       seeded `email-schedule` — and, for a slot the hour had passed, `email-sent` — on every mail
       customer's albarán, behind `rails.email.connected`. That flag has been the constant `false`
       since `config.mailbox` was retired, so the branch has produced nothing for a while; folding
       it onto the live mailbox instead would have been worse than dead, because the seed runs
       inside `buildSales` and a connected Gmail would have made the fold stamp «Sent to Hotel Rec
       at 07:30» on yesterday's book — a success the house's own mailbox never made, which is the
       one thing `readEmailProviderReceipts` refuses to print without a `Demo` mark beside it.
       A mail stamp now has exactly two roads, both of them acts: `scheduleEmail` from the Delivery
       Note's mail rail, and `markEmailSent` from the send's own receipt. `app/tools/test-rail-world.mjs`
       holds the morning to it on all three casts. */
  });
  return out;
}

/* ── THE OTHER DAYS ───────────────────────────────────────────────────────────────────────────
 * The record below today and the horizon above it. Both are built the way today is built — the
 * cast's own customers, the cast's own catalogue — because a day the person scrolls into has to be
 * the same kind of object as the day they are standing in, or the river is a trick.
 */

type OtherDay = {
  customer: string;
  /** minutes after the morning opened */
  at: number;
  /** which day, in offsets from today */
  offset: number;
  calendarDay?: boolean;
  /** how many of the catalogue's products it takes */
  take: number;
  target: SaleState;
  prepared?: boolean;
  printed?: number;
  /* a line moved AFTER the pick, so the tick resets and the bay is asked to walk it again (§7.2) */
  touched?: boolean;
  /** the line the customer's number is far off their usual on — the exception a horizon day holds */
  unusual?: { line: number; usual: number };
  /** the customer asked something on this sale that wants the person's own voice (§9.2) */
  question?: { kind: ReplyKind; minutes: number };
};

/** YESTERDAY, and the day before it as far as the record goes: the states that only exist once a
 *  van has been out, including the one that outlines — a complaint standing on the albarán it is
 *  about, which is the one thing on the feed that draws an accent ring. */
const RECORD_LEADS: OtherDay[] = [
  { customer: 'vera', at: 700, offset: -1, take: 2, target: 'sent', prepared: true, printed: 1 },
  { customer: 'hotelrec', at: 605, offset: -1, take: 3, target: 'delivered', prepared: true, printed: 1 },
  { customer: 'nou', at: 545, offset: -1, take: 2, target: 'disputed', prepared: true, printed: 1 },
  { customer: 'manolo', at: 500, offset: -1, take: 2, target: 'settled', prepared: true, printed: 2 },
];

/** THE HORIZON — what the house has already promised for the days ahead. Most of it is committed
 *  and untouched, which is the inversion at rest: the far days are exactly where a person should
 *  have nothing to do. One of them is not, so the exceptions band is never a today-only thing. */
const HORIZON_LEADS: OtherDay[] = [
  /* L2 (§10): the customer loop is closed — Rocoto said it would look — but the sale cannot be
     locked until somebody says whether the goods can be got. Its day is still ahead, so it stands
     in that day rather than on the top band. */
  { customer: 'hotelrec', at: 242, offset: 1, take: 3, target: 'committed', question: { kind: 'order', minutes: 250 } },
  /* L2, the other flavour: picked, then changed. The bay has to walk it again. */
  { customer: 'cansole', at: 218, offset: 1, take: 3, target: 'made', prepared: true, touched: true },
  { customer: 'vera', at: 196, offset: 1, take: 2, target: 'committed' },
  /* NON-ORDER (§9.3): they asked what something is at today. Nothing on the albarán is wrong; the
     sentence back is the whole of the work, and it is the person's to write. */
  { customer: 'manolo', at: 175, offset: 1, take: 2, target: 'committed', question: { kind: 'ask', minutes: 214 } },
  { customer: 'cansole', at: 165, offset: 3, take: 2, target: 'committed' },
  { customer: 'nou', at: 152, offset: 3, take: 3, target: 'committed' },
  { customer: 'manolo', at: 148, offset: 3, take: 2, target: 'committed' },
];

/* ── THE RECORD AND THE HORIZON, AT THE HOUSE'S REAL SIZE (FEED-IA §31.1, §12) ────────────────
 * A day the person scrolls into has to be the same kind of day they are standing in, and at three
 * hundred orders that means yesterday holds hundreds of closed albaranes and the days ahead hold
 * what the house has already promised — a lot for tomorrow, less for the day after, a handful for
 * the day after that. Orders do not arrive evenly across a week; they bunch on the morning of.
 *
 * THE RECORD IS QUIET BY CONSTRUCTION, which is the contrast §21 is asking to be judged: every one
 * of yesterday's rows has been printed and most have been sent or settled, so a scroll into the
 * past is a column of flat grey with one accent ring on the single complaint. The horizon is
 * committed and untouched — the inversion at rest, where a person should have nothing to do.
 */

/** How many sales each day beyond today holds. Tomorrow is the promised day; +3 is the trickle. */
const OTHER_LOAD: Array<{ offset: number; count: number }> = [
  { offset: -1, count: 186 },
  { offset: 1, count: 108 },
  { offset: 2, count: 44 },
  { offset: 3, count: 34 },
];

/** THE STATES THE RECORD RESTS IN. A day that has been out is settled, delivered or still on its
 *  way to being paid — never «committed», because the van went. */
const RECORD_STATES: SaleState[] = ['settled', 'delivered', 'delivered', 'sent', 'settled', 'delivered'];

/** One day's set, off the book. `seat` walks the customers by a stride so a day is not the first
 *  N rows of the book twice, and no customer takes two sales on one day (C-19). */
function otherDaysFor(cast: Cast, offset: number, count: number, already: Set<string>): OtherDay[] {
  const book = cast.customers;
  const out: OtherDay[] = [];
  const stride = offset === -1 ? 7 : offset === 1 ? 11 : offset === 2 ? 13 : 17;
  const start = offset === -1 ? 3 : offset * 29;
  for (let k = 0; out.length < count && k < book.length; k += 1) {
    const customer = book[(((start + k * stride) % book.length) + book.length) % book.length];
    if (already.has(customer.id)) continue;
    already.add(customer.id);
    const seed = k * 3 + offset * 101;
    const past = offset < 0;
    out.push({
      customer: customer.id,
      /* yesterday's hours run through its own morning; the horizon's arrived during THIS one */
      at: past ? 20 + Math.round(scatter(seed + 1) * 250) : 8 + Math.round(scatter(seed + 2) * 262),
      offset,
      take: dayLineCount(seed + 3),
      target: past
        ? RECORD_STATES[Math.floor(scatter(seed + 4) * RECORD_STATES.length) % RECORD_STATES.length]
        : scatter(seed + 5) > 0.82
          ? 'made'
          : 'committed',
      prepared: past || scatter(seed + 6) > 0.86,
      printed: past ? 1 : scatter(seed + 7) > 0.88 ? 1 : 0,
    });
  }
  return out;
}

/** Both sets, built once per cast. The named cases stand at the head of each, so every behaviour
 *  the smaller seed proved is still on the surface and the mass is drawn around them. */
const OTHERS = new WeakMap<Cast, { record: OtherDay[]; horizon: OtherDay[] }>();

function otherDaysOf(cast: Cast): { record: OtherDay[]; horizon: OtherDay[] } {
  const held = OTHERS.get(cast);
  if (held) return held;
  /* a cast small enough to have no book keeps exactly the days it was written with */
  if (cast.customers.length < 20) {
    const small = { record: RECORD_LEADS, horizon: HORIZON_LEADS };
    OTHERS.set(cast, small);
    return small;
  }
  const record = [...RECORD_LEADS];
  const horizon = [...HORIZON_LEADS];
  const base = baseDate(cast);
  OTHER_LOAD.forEach(({ offset, count }) => {
    const taken = new Set(
      (offset < 0 ? record : horizon).filter((p) => p.offset === offset).map((p) => p.customer),
    );
    /* A SUNDAY IS NOT A DELIVERY DAY. The house's week is the trade's week — Saturday is the big
       one because restaurants stock for the weekend, Monday picks back up, and Sunday is a handful
       of hotels and nothing else. A horizon that put forty-four albaranes on a Sunday would be the
       seed telling a fish house something it knows to be false (§31.1). */
    /* Both roads to the same morning, kept: `dayOfOffset` walks a Sunday offset back to the
       Saturday a delivery could stand on, and main's own repair keeps a Sunday's few grown
       accounts whole on top of the named cases, so a Monday resolves like any other day. */
    const sunday = dayOfOffset(base, offset).getDay() === 0;
    const load = sunday ? Math.round(count * 0.06) : count;
    const grown = otherDaysFor(cast, offset, sunday ? load : load - taken.size, taken);
    if (offset < 0) record.push(...grown);
    else horizon.push(...grown);
  });
  // Historical deliveries use the same customers, products and pricing as today's book.
  // Their real weekday keeps Sunday small and Monday/Friday the two busiest mornings.
  for (let offset = -moneyFixture.history.days; offset <= -2; offset += 1) {
    const weekday = shiftDay(base, offset).getDay();
    const count = moneyFixture.history.weekdayOrders[weekday];
    const rows = otherDaysFor(cast, offset, Math.min(count, cast.customers.length), new Set());
    rows.forEach((row, index) => record.push({ ...row, calendarDay: true, prepared: true, printed: 1,
      target: index === 0 && moneyFixture.history.disputedOffsets.includes(offset) ? 'disputed' : 'delivered' }));
  }
  /* A TYPED ADDRESS RIDES THE FIRST DELIVERY DAY AHEAD (FEED-IA §246). The account whose door is
     text exists so Prep's arithmetic is proven on a delivery the picture cannot hold, every day —
     and the seat the stride hands it moves with the size of the book (one more account and it
     slid off the horizon). So the promise is kept here, by construction: it takes over the last
     grown seat of the first delivery day ahead, which keeps every day's count exactly where the
     load table put it and leaves the named cases at the head of each day untouched. */
  const ahead = OTHER_LOAD.map((l) => l.offset).filter((o) => o > 0).sort((a, b) => a - b);
  const firstAhead = ahead.find((o) => shiftDay(base, o).getDay() !== 0) ?? ahead[0];
  for (const typed of cast.customers.filter((c) => !c.at && c.address)) {
    if (horizon.some((p) => p.customer === typed.id)) continue;
    const seat = [...horizon].reverse().find((p) => {
      if (p.offset !== firstAhead || HORIZON_LEADS.includes(p)) return false;
      const holder = cast.customers.find((c) => c.id === p.customer);
      return Boolean(holder && holder.at);
    });
    if (seat) seat.customer = typed.id;
  }
  const both = { record, horizon };
  OTHERS.set(cast, both);
  return both;
}

/** THE QUESTION, PUT ON THE SALE IT IS ABOUT (§9.2). It arrives as a MESSAGE — a row in the sale's
 *  own thread, later than the order it follows — so Chats carries it as that conversation's last
 *  word without a second store, and the sale's card carries it as a standing card. The words name
 *  a product the sale already holds, so nothing here is typed into a screen (law 10). */
function withQuestion(cast: Cast, sale: Sale, kind: ReplyKind, minutes: number): Sale {
  const line = kind === 'ask' ? sale.lines[0] : sale.lines[sale.lines.length - 1];
  if (!line) return sale;
  const name = line.product.name;
  /* THE CARD LEADS WITH WHAT THEY ASKED, and ends with the one thing Rocoto needs to answer them
     (FEED-IA §10, corrected). Never «pending review», and never a holding phrase — Rocoto said
     nothing, which is exactly why this is standing here. */
  const about =
    kind === 'ask'
      ? `They ask the ${name} price — add it before replying`
      : `They ask for more ${name} — confirm availability before replying`;
  const words =
    kind === 'ask'
      ? `And what is the ${name} at today? If it is over the usual I will take half.`
      : `If you can get another 10 ${line.unit} of ${name} for ${sale.deliveryDay}, put it on. Only if you have it.`;
  return {
    ...sale,
    needsReply: { kind, about },
    thread: [
      ...sale.thread,
      { id: `${sale.id}-q`, author: 'received', text: words, time: clockAfter(cast.hour, minutes) },
    ],
  };
}

/* ── WHEN ROCOTO IS ALLOWED TO ASK (FEED-IA §10, refined; THE-INTELLIGENCE §11) ───────────────
 * The silence rule has one exception, and it is a CAPABILITY THE HOUSE GRANTS: where they have set
 * Rocoto to check with the customer, it engages them itself — fluidly, the way a person at the
 * counter would. A genuine clarifying question is conversation, not filler, and an item settled
 * that way never reaches review at all.
 *
 * What stays banned everywhere is the rigid holding script. «One moment, I am confirming» is a bot
 * announcing its own latency; «Quick one on the merluza — same as last week?» is a fishmonger
 * typing. The first buys nothing and the second closes the order.
 *
 * This is the seed that proves the distinction on screen: one thread where Rocoto asked, the
 * customer answered, and Rocoto confirmed — and the sale flowed straight past the standing band.
 */
function withClarification(cast: Cast, sale: Sale, minutes: number): Sale {
  const line = sale.lines[0];
  if (!line) return sale;
  const at = clockAfter(cast.hour, minutes);
  return {
    ...sale,
    thread: [
      ...sale.thread,
      { id: `${sale.id}-q1`, author: 'ai', text: `Quick one on the ${line.product.name} — same as last week?`, time: at },
      { id: `${sale.id}-a1`, author: 'received', text: 'Yes, same as last week.', time: clockAfter(cast.hour, minutes + 6) },
      { id: `${sale.id}-c1`, author: 'ai', text: `Perfect — it goes on for ${sale.deliveryDay}.`, time: clockAfter(cast.hour, minutes + 7) },
    ],
  };
}

/** One day's worth of sales off the catalogue. The words the customer used are composed from the
 *  lines, so the message and the reading can never describe different orders. */
function otherSales(cast: Cast, set: OtherDay[], seq: number): Sale[] {
  const base = baseDate(cast);
  return set.map((p, i) => {
    const customer = cast.customers.find((c) => c.id === p.customer) ?? cast.customers[i];
    const date = p.calendarDay ? shiftDay(base, p.offset) : dayOfOffset(base, p.offset);
    const day = dayLabelOf(date);
    const at = clockAfter(cast.hour, p.at);
    /* THE AMENDMENTS RIDE EVERY DAY, and that is the whole of §2's graduation: a word that rides
       the same product on Thursday and again on Friday is a habit, and a habit is what the
       catalogue should grow a row for. */
    /* THE LINES ARE BUILT THE WAY TODAY'S ARE — the same catalogue, the same money-sizing, the same
       class register — because a day the person scrolls into has to be the same kind of object as
       the day they are standing in, or the river is a trick. The seed is the sale's own place in
       its set, so yesterday's book and tomorrow's are different books off one rule. */
    const seed = i * 7 + p.offset * 313;
    const lines: SaleLine[] = dress(
      cast,
      customer.id,
      productsFor(cast, seed, p.take).map((product, k) => {
        const price = priceOf(cast, product);
        const qty = qtyFor(price, seed, k, priceOf(cedarSourceCast(cast), product));
        const raised = p.unusual && p.unusual.line === k;
        return {
          id: `l${k + 1}`,
          product,
          ordered: raised ? qty * 4 : qty,
          given: raised ? qty * 4 : qty,
          unit: product.unit,
          price,
          weighed: product.variableWeight,
          usual: raised ? qty : undefined,
        };
      }),
    );
    const id = `d${p.offset}-${customer.id}`;
    const words = `For ${day}: ${lines.map((l) => `${l.ordered} ${l.unit} ${l.product.name}`).join(', ')}.`;
    const reading = readingOf(customer, lines.length, day);
    const built: Sale = {
      id,
      customer,
      at,
      day: dayIdOf(date),
      deliveryDay: day,
      window: windowOf(cast),
      declineUntil: declineUntilOf(cast),
      number: numberFor(date, i, seq),
      lines,
      figure: figureOf(lines),
      state: 'request' as SaleState,
      thread: [
        { id: `${id}-w0`, author: 'received', text: inTheirWords(words, lines), time: at },
        { id: `${id}-ai`, author: 'ai', kind: 'activity', text: reading, time: at },
      ],
      reading,
      stamps: {},
      /* the band the house sells this customer at — the document's own starting sheet */
      tier: bandOf(cast, customer),
    };
    return p.question ? withQuestion(cast, built, p.question.kind, p.question.minutes) : built;
  });
}

/* ── AN ORDER LANDS WHILE THEY ARE WORKING (FEED-IA §26.6) ────────────────────────────────────
 * «Many times orders get processed with an overlap with the ordering period. The UX lets them do
 * that, not that it's a mode at all.» An arrival is therefore built exactly like every other sale —
 * the cast's own customer, the cast's own catalogue, the same dressing — off an event in the same
 * ledger. Nothing about the surface switches when one lands: the river gains a row, the day's
 * aggregate moves, the band re-counts, and whatever document is open stays open on its own sale.
 */
function arrivalSales(cast: Cast, events: SaleEvent[]): Sale[] {
  const base = baseDate(cast);
  return events
    .filter((e): e is Extract<SaleEvent, { kind: 'arrive' | 'source-arrive' | 'theatre-arrive' }> =>
      e.kind === 'arrive' || e.kind === 'source-arrive' || e.kind === 'theatre-arrive')
    .map((e, i) => {
      const normalizePhone = (value: string | undefined): string => (value ?? '').replace(/\D/g, '');
      const sourcePhone = e.kind === 'source-arrive' ? normalizePhone(e.customerPhone) : '';
      const known = e.kind === 'source-arrive'
        ? sourcePhone
          ? cast.customers.find((candidate) => normalizePhone(candidate.phone) === sourcePhone)
          : undefined
        : undefined;
      const customer = known ?? cast.customers.find((c) => c.id === e.customer) ?? (e.kind === 'source-arrive'
        ? {
            id: e.customer,
            name: e.customerName,
            phone: e.customerPhone,
            channel: e.channel === 'phone' ? 'phone' as const
              : e.channel === 'email' ? 'email' as const : 'WhatsApp' as const,
            tier: '',
            settles: 'cash on delivery' as const,
          }
        : cast.customers[i % cast.customers.length]);
      const date = e.kind === 'source-arrive' && e.deliveryDay
        ? dayFromId(e.deliveryDay)
        : dayOfOffset(base, e.offset);
      const day = dayLabelOf(date);
      const messageOnly = (e.kind === 'theatre-arrive' && e.scenario === 'question')
        || (e.kind === 'source-arrive' && e.lines.length === 0);
      const arrivedProducts = messageOnly || e.kind === 'source-arrive'
        ? []
        : e.kind === 'theatre-arrive'
          ? [cast.products.find((product) => product.id === e.product) ?? cast.products[0]]
          : cast.products.slice(0, Math.max(1, e.take));
      const lines: SaleLine[] = e.kind === 'source-arrive'
        ? e.lines.map((line, k) => {
            const product = cast.products.find((candidate) => candidate.id === line.product) ?? {
              id: `source-${e.conversation.slice(0, 16)}-${k + 1}`,
              name: line.word,
              family: cast.families[0]?.id ?? '',
              unit: line.unit,
              variableWeight: false,
              trace: {},
            };
            const qty = line.qty ?? 0;
            return {
              id: `l${k + 1}`,
              product,
              ordered: qty,
              given: qty,
              unit: line.unit,
              price: line.product ? priceOn(cast, product, bandOf(cast, customer), dayIdOf(date)) : 0,
              weighed: product.variableWeight,
              unreadable: line.qty === undefined ? line.word : undefined,
              nonSku: line.product ? undefined : true,
            };
          })
        : dress(
            cast,
            customer.id,
            arrivedProducts.map((product, k) => ({
              id: `l${k + 1}`,
              product,
              ordered: 4 + k * 3,
              given: 4 + k * 3,
              unit: product.unit,
              price: cast.order.lines[k % cast.order.lines.length].price,
              weighed: product.variableWeight,
            })),
          );
      const words = e.kind === 'source-arrive' ? e.text
        : e.kind === 'theatre-arrive' ? e.text
          : `For ${day}: ${lines.map((l) => `${l.ordered} ${l.unit} ${l.product.name}`).join(', ')}.`;
      const reading = readingOf(customer, lines.length, day);
      /* A theatre's processing/defer trail is operational provenance, not a message Rocoto sent.
         Only the customer's amendment joins the native conversation. */
      const theatre = events.filter((x): x is Extract<SaleEvent, { kind: 'theatre-message' }> =>
        x.kind === 'theatre-message' && x.sale === e.sale && x.author === 'received');
      return {
        id: e.sale,
        customer,
        at: e.at,
        day: dayIdOf(date),
        deliveryDay: day,
        window: windowOf(cast),
        declineUntil: declineUntilOf(cast),
        number: numberFor(date, i, 9000),
        lines,
        figure: figureOf(lines),
        state: messageOnly ? 'committed' as SaleState : 'request' as SaleState,
        thread: [
          {
            id: `${e.sale}-w0`, author: 'received' as const, text: inTheirWords(words, lines), time: e.at,
            ...(e.kind === 'source-arrive' ? { source: {
              channel: e.channel,
              messageId: e.sourceEvent,
              conversationId: e.conversation,
              occurredAt: e.occurredAt,
              historical: false as const,
            } } : {}),
          },
          ...(messageOnly ? [] : [{ id: `${e.sale}-ai`, author: 'ai' as const, text: reading, time: e.at }]),
          ...theatre.map((x, n) => ({ id: `${e.sale}-theatre-${n}`, author: x.author, text: x.text, time: x.at })),
        ],
        reading: messageOnly ? 'Availability question deferred to the desk.' : reading,
        stamps: {},
        needsReply: e.kind === 'source-arrive'
          ? e.needsReply ? {
              kind: e.needsReply,
              about: e.needsReply === 'order'
                ? 'Review this order and reply to the customer'
                : e.text,
              ...(e.needsReply === 'order' ? { initial: true } : {}),
            } : undefined
          : messageOnly ? { kind: 'ask' as const, about: e.text } : undefined,
        theatre: e.kind === 'theatre-arrive' ? e.theatre : undefined,
        messageOnly,
        /* the band the house sells this customer at — the document's own starting sheet */
        tier: bandOf(cast, customer),
      };
    });
}

/* ── THE ALBARANES THE HOUSE WROTE (FEED-IA §66.3) ────────────────────────────────────────────
 * The composer's own output, folded exactly as an arrival is: same shape, same dressing, same
 * ledger. It lands EMPTY — no lines — because the lines go on through the sheet's own add-a-line,
 * which is the chip organ (§62), and a composer that invented its own line-writing would be the
 * second grammar §62.4 forbids.
 *
 * ITS THREAD SAYS WHO WROTE IT, and it says it as a FACT rather than as a status: «Written at the
 * desk» is what happened, and the provenance block reads it the way it reads an email or a voice
 * note. A document with no provenance at all would be the one kind of albarán in this app whose
 * origin the surface cannot answer.
 */
function composedSales(cast: Cast, events: SaleEvent[]): Sale[] {
  const base = baseDate(cast);
  return events
    .filter((e): e is Extract<SaleEvent, { kind: 'new' }> => e.kind === 'new')
    .map((e, i) => {
      /* THE LATER EVENTS WIN, because a draft is edited in place and the ledger is the record of
         that editing (§74.4). Both are folded here rather than in the per-sale pass below, because
         they decide the document's own IDENTITY — whose it is and which day — and everything after
         them (its number, its tier, its window) is derived from that. */
      const named = [...events].reverse().find(
        (x): x is Extract<SaleEvent, { kind: 'draft-name' }> => x.kind === 'draft-name' && x.sale === e.sale);
      const dayed = [...events].reverse().find(
        (x): x is Extract<SaleEvent, { kind: 'draft-day' }> => x.kind === 'draft-day' && x.sale === e.sale);
      const who = named ? named.customer : e.customer;
      const found = who ? cast.customers.find((c) => c.id === who) : undefined;
      /* ── A DOCUMENT NOBODY HAS NAMED YET (§74.4) ──────────────────────────────────────────
       * A draft born on a keystroke has no customer, and the honest drawing of that is an EMPTY
       * NAME rather than somebody else's. The composer's own head is a FIELD standing in this
       * seat, so the blank is exactly where a person types — and `draftsOf` keeps every document
       * in this state out of the river, because a row with no name is a row nobody can read.
       * It is shaped from a real customer so every reader of `Sale` keeps working; what is
       * emptied is the IDENTITY, which is the only part a nameless document has no answer for. */
      const customer = found ?? { ...cast.customers[0], id: '', name: '', zone: '', truck: undefined };
      const date = dayOfOffset(base, dayed ? dayed.offset : e.offset);
      const day = dayLabelOf(date);
      const reading = `Written at the desk for ${day}.`;
      return {
        id: e.sale,
        customer,
        at: e.at,
        day: dayIdOf(date),
        deliveryDay: day,
        window: windowOf(cast),
        declineUntil: declineUntilOf(cast),
        number: numberFor(date, i, 7000),
        lines: [],
        figure: 0,
        state: 'committed' as SaleState,
        thread: [{ id: `${e.sale}-ai`, author: 'ai' as const, text: reading, time: e.at }],
        reading,
        stamps: {},
        tier: bandOf(cast, customer),
        /* what they have typed into the name so far, kept verbatim so resuming a draft shows the
           half-word they left rather than an empty field (§65.3: their words stay theirs) */
        draftSaid: named?.said ?? '',
        /* AND THE ONE FACT THE `new` EVENT STATES BY OMISSION: it came down no channel. The
           reading two lines up already says so in words; this says it to the sheet, which draws
           the arrival block and may never dress a desk document in a channel it never used. */
        writtenHere: true,
      };
    });
}

/* ── A DRAFT IS A DOCUMENT NOBODY CAN READ YET (FEED-IA §74.4, §74.5) ─────────────────────────
 * «Once they type it should start a draft» — so the ledger grows a document on the first
 * keystroke, and for as long as that document has no customer it is a DRAFT: real, persisted,
 * resumable, and NOT in the river. A row whose name is blank is a row a person cannot read, and
 * three hundred readable rows with one blank among them is worse than no row at all.
 *
 * WHAT DECIDES IT IS THE NAME AND NOTHING ELSE. Not a flag anybody sets, not a state, not a step
 * a person completes — «the first step thing is silly» (§74.4). The moment a customer is picked,
 * the document has an identity, it is an albarán, and it takes its row. Nothing is converted and
 * nothing is announced: it becomes real by BEING real, which is §59.5 exactly.
 */
export const isDraft = (sale: Sale): boolean => sale.customer.id === '';

/** THE DRAFTS STANDING, newest first — what the composer's own dropdown lists (§74.5). */
export const draftsOf = (sales: Sale[]): Sale[] =>
  sales.filter(isDraft).sort((a, b) => b.at.localeCompare(a.at));

/** WHAT ROCOTO READ, and nothing that goes stale. The reading is a fact about the MESSAGE — how
 *  many lines, for which day, through which door — so it stays true after a person has weighed a
 *  line or added one. Money belongs to the Figure two inches above it, which is always current. */
const readingOf = (customer: Customer, lines: number, day: string): string =>
  `Read from ${customer.channel} as ${lines} ${lines === 1 ? 'line' : 'lines'} for ${day}.`;

/** Today's five, as sales. The cast's own order is the one ARRIVING — it stands on the capture
 *  pulse at the head of the feed until a person puts it in. */
/** THE NON-ORDER ASKS OF THE MORNING (§9.3, §26.4). «The customer asked something — a price,
 *  whether there is any — that has to be attended to.» A handful, on orders that are otherwise
 *  clean, so they collapse into the one Messages row rather than taking cards on the band. Picked
 *  by position in the day for the same reason the readings are (the book is generated). */
const ASK_POSITIONS = [61, 118, 173];

/** Stable kit arrival fixtures, independent of Settings. Real account/message ids are A3.27. */
function fixtureEmailSource(customerId: string): NonNullable<NonNullable<ThreadRow['email']>['source']> {
  const bucket = [...customerId].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;
  const provider = customerId === 'hotelrec' ? 'gmail' : (['forwarded', 'gmail', 'm365'] as const)[bucket];
  return { provider, accountId: `kit-${provider}`, canReply: provider !== 'forwarded' };
}

function todaySales(cast: Cast): Sale[] {
  const date = baseDate(cast);
  const day = dayOrders(cast);
  const asks = new Set(
    day.length > 200 ? ASK_POSITIONS.map((n) => day[n]?.id).filter(Boolean) : [],
  );
  let seededChangedMessageNote = false;
  return day.map((o, i) => {
    const lines = dress(cast, o.customer.id, readMessage(cast, o.id, o.order.lines.map((l, k) => lineOf(cast, l, i * 11 + k))));
    /* THE CHANGE IS ONE SENTENCE, SAID ONCE, AT THE HOUR IT WAS SAID. The day builds it into the
       order's words AND the sale hangs it under the change's own timestamp, so the thread was
       quoting it twice — the same words at 09:08 and again at 10:14, which reads as a customer who
       repeated themselves rather than one who changed their mind. It belongs at the later hour. */
    const changed = o.changed
      ? `Make the ${productOf(cast, o.changed.raised.product).name} ${o.changed.raised.qty + o.changed.more} ${o.changed.raised.unit}, and leave the ${productOf(cast, o.changed.dropped.product).name}.`
      : null;
    const said = o.order.words.filter((w) => w !== changed);
    const thread: ThreadRow[] = [
      ...said.map((w, k) => ({
        id: `${o.id}-w${k}`,
        author: 'received' as const,
        text: inTheirWords(w, lines),
        time: k === said.length - 1 ? o.at : undefined,
        grouped: k > 0,
        ...(o.customer.channel === 'email' ? {
          email: { subject: `Order for ${o.order.deliveryDay}`, from: o.customer.name, to: [cast.house.name],
            source: fixtureEmailSource(o.customer.id), messageId: `${o.id}-email-${k}` },
          ...(k === 0 ? { attachments: [{ id: `${o.id}-request`, name: 'Order.txt', source: 'fixture' as const, text: said.join('\n\n') }] } : {}),
          ...(k === 0 && o.customer.id === 'hotelrec' ? { scopedNote: { id: `${o.id}:email-source`, says: 'The order details are in the attached file.' } } : {}),
        } : {}),
      })),
    ];
    /* THE READING SITS WHERE IT HAPPENED — right after the words it read, before anything the
       customer said later. A thread whose rows are out of order is a thread nobody trusts. */
    const reading = readingOf(o.customer, lines.length, o.order.deliveryDay);
    thread.push({ id: `${o.id}-ai`, author: 'ai', kind: 'activity', text: reading, time: o.at });
    if (changed) {
      const scopedNote = !seededChangedMessageNote && o.customer.channel === 'WhatsApp'
        ? { id: `${o.id}:changed-message`, says: 'This message changes the earlier order.' }
        : undefined;
      if (scopedNote) seededChangedMessageNote = true;
      thread.push({
        id: `${o.id}-wc`,
        author: 'received',
        text: inTheirWords(changed, lines),
        time: o.changed?.at,
        scopedNote,
      });
    }
    const built: Sale = {
      id: o.id,
      orderId: o.id,
      customer: o.customer,
      at: o.at,
      day: dayIdOf(date),
      deliveryDay: o.order.deliveryDay,
      window: windowOf(cast),
      declineUntil: declineUntilOf(cast),
      number: numberFor(date, i, 110),
      lines,
      figure: figureOf(lines),
      state: 'request' as SaleState,
      thread,
      reading,
      stamps: {},
      changed: o.changed,
      arriving: o.arriving,
      /* the band the house sells this customer at — the document's own starting sheet */
      tier: bandOf(cast, o.customer),
    };
    /* SOMEBODY ASKED A QUESTION ON AN ORDER THAT IS OTHERWISE FINE (§26.4). The order committed
       itself; the sentence back is the whole of the work, and it rides the Messages counter. */
    if (asks.has(o.id)) return withQuestion(cast, built, 'ask', 150 + (i % 90));
    /* THE ONE ROCOTO SETTLED BY ASKING (§10, refined). It is the house's own grant that lets it
       talk, so this sale never stands anywhere: it was clarified, confirmed and committed while
       the desk was doing something else. Take the grant away and the exchange is not there —
       Rocoto said nothing, which is the other half of the doctrine and has to be visible too. */
    return o.id === 'manolo' && grantsNow().checkIn ? withClarification(cast, built, 108) : built;
  });
}

/* ── THE FOLD ─────────────────────────────────────────────────────────────────────────────────
 * Cast + ledger → the day's sales. This is the ONE place a state is decided, so the feed, the
 * detail, the strip and the rail can only ever agree.
 */

/** A dimensions patch, applied. An empty word takes its dimension off entirely, so «set it» and
 *  «take it back off» are the same act on the same field and the object never carries a blank. */
function mergeDimensions(held: LineDimensions | undefined, patch: LineDimensions): LineDimensions | undefined {
  const next: LineDimensions = { ...held };
  for (const [id, word] of Object.entries(patch) as Array<[DimensionId, string]>) {
    if (word.trim()) next[id] = word.trim();
    else delete next[id];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** THE GOODS A LINE STANDS ON (THE-OBJECT-MAP C5 · C7). The house's own SKUs first — that is every
 *  line in an ordinary morning — and then the members it has GRADUATED, which are products of the
 *  house too (§75.6) and cannot be in the static cast. Without this second reach `productOf` fell
 *  back to the cast's first row, so a document written on «Merluza de pincho» quietly became one
 *  written on «Merluza»: the goods renamed by a lookup, on paper, with nothing to see. */
const lineProduct = (cast: Cast, id: string): Product =>
  cast.products.find((p) => p.id === id)
    ?? (() => {
      const member = CATALOGUE_AMENDMENTS.find((a) => a.id === id && Boolean(a.hand || a.sellable));
      return member ? amendmentProduct(cast, member) : undefined;
    })()
    ?? graduatedProduct(cast, id)
    ?? productOf(cast, id);

function applyLines(sale: Sale, cast: Cast, events: SaleEvent[]): SaleLine[] {
  let lines = sale.lines;
  events.forEach((e) => {
    if (e.kind === 'add') {
      /* THE BARE LINE (§10's house posture, and the `add` event's own note above). A word with no
         catalogue row behind it mints the OFF-CATALOGUE SHAPE — the same object an off-catalogue
         line arrives as — so it carries the family the shelf's law is read from, no trace, no
         lote, and `nonSku` so the existing adoption offer finds it. Nothing here is a second kind
         of line: it is the one kind, minted from a word instead of from an id. */
      const product: Product = e.word
        ? {
            id: `bare-${e.line}`,
            name: e.word,
            family: cast.families[0].id,
            unit: e.unit,
            variableWeight: false,
            trace: {},
          }
        : lineProduct(cast, e.product ?? '');
      lines = [
        ...lines,
        {
          id: e.line,
          product,
          ordered: e.qty,
          given: e.qty,
          unit: e.unit,
          price: e.price,
          weighed: product.variableWeight,
          freebie: e.price === 0,
          nonSku: e.word ? true : undefined,
          /* §80 — a word with more than one form behind it carries what was said and what it was
             filled with, which is the reading `fillWords` already draws. */
          asked: e.asked,
          filledBy: e.asked ? 'model' : undefined,
        },
      ];
    }
    /* THE BENCH'S OWN INSTRUCTION. An empty note takes the line back to silence — nothing at rest
       — which is the same act as writing one and therefore the same event. */
    if (e.kind === 'prep-note') {
      lines = lines.map((l) =>
        l.id === e.line ? { ...l, prepNote: e.note.trim() || undefined } : l,
      );
    }
    if (e.kind === 'customer-option') {
      lines = lines.map((l) => {
        if (l.id !== e.line) return l;
        return e.action === 'approve' ? { ...l, customerOption: customerOptionSnapshot(e.option) } : { ...l, customerOption: undefined };
      });
    }
    if (e.kind === 'theatre-amend') {
      lines = lines.map((line) => line.id === e.line ? { ...line, ordered: e.qty, given: e.qty, unreadable: undefined } : line);
    }
    if (e.kind === 'line') {
      lines = lines.map((line) => {
        if (line.id !== e.line) return line;
        const unitChanged = e.unit !== undefined && (e.unit !== line.unit || (e.unitFactor !== undefined && e.unitFactor !== line.unitFactor));
        const from = line.unitFactor !== undefined ? line.unitFactor
          : declaredUnitFactor(cast.sector, line.product, line.unit);
        const to = e.unitFactor !== undefined ? e.unitFactor
          : e.unit !== undefined ? declaredUnitFactor(cast.sector, line.product, e.unit) : from;
        const price = e.price ?? (unitChanged
          ? from !== null && to !== null ? round(line.price * to / from, 4) : 0
          : line.price);
        return {
          ...line,
          given: e.given ?? line.given,
          unit: e.unit ?? line.unit,
          ...(e.unit !== undefined ? { unitFactor: to } : {}),
          price,
          freebie: e.price !== undefined ? e.price === 0 : unitChanged && price === 0 ? undefined : line.freebie,
          klass: e.klass ?? line.klass,
          dimensions: e.dimensions ? mergeDimensions(line.dimensions, e.dimensions) : line.dimensions,
          finalWeight: e.finalWeight ?? line.finalWeight,
          unreadable: e.given !== undefined ? undefined : line.unreadable,
        };
      });
    }
    if (e.kind === 'adopt') {
      lines = lines.map((l) => (l.id === e.line ? { ...l, adopted: e.how } : l));
    }
    if (e.kind === 'choose-sku') {
      lines = lines.map((l) => {
        if (l.id !== e.line) return l;
        const product = lineProduct(cast, e.product);
        return {
          ...l,
          product,
          weighed: product.variableWeight,
          nonSku: undefined,
          adopted: undefined,
          corrected: undefined,
          skuChosen: true,
          asked: e.asked || l.asked,
          filledBy: undefined,
          amendment: undefined,
        };
      });
    }
    if (e.kind === 'choose-sku-none') {
      lines = lines.map((l) => {
        if (l.id !== e.line) return l;
        const literal: Product = {
          id: `bare-${l.id}`,
          name: e.asked,
          family: l.product.family,
          unit: l.unit,
          variableWeight: false,
          trace: {},
        };
        return {
          ...l,
          product: literal,
          price: 0,
          weighed: false,
          nonSku: true,
          adopted: undefined,
          corrected: undefined,
          skuChosen: undefined,
          asked: e.asked,
          filledBy: undefined,
          amendment: undefined,
        };
      });
    }
    /* THE CORRECTION IS THE FEEDBACK (THE-INTELLIGENCE §1). The person put the customer's own
       word back on the line; the line now reads as they said it, and the event is what the model
       learns from. Nothing is dismissed and nothing is rated. */
    if (e.kind === 'correct') {
      lines = lines.map((l) => (l.id === e.line ? { ...l, corrected: true } : l));
    }
    /* THE FLIP CARRIES THE WHOLE LINE ACROSS (§3) — amount, price and what was asked, all in the
       new unit, so the money on the row is the same money it was a tap earlier. */
    if (e.kind === 'unit-flip') {
      lines = lines.map((l) => (l.id === e.line ? flipTo(l, e) : l));
    }
    if (e.kind === 'lot') {
      lines = lines.map((l) => (l.id === e.line ? withAllocations(l, e.allocations, e.overrideReason, e.stockRevision) : l));
    }
    /* THE WORD ON THE LINE, PUT THERE BY HAND (THE-INTELLIGENCE §2). An empty word takes the chip
       off, because taking a word back is the same act as putting one on. */
    if (e.kind === 'amend') {
      lines = lines.map((l) => (l.id === e.line ? { ...l, amendment: e.word.trim() || undefined } : l));
    }
    /* OFF THE ALBARÁN, AND BACK ONTO IT. The line keeps its place in the order rather than being
       spliced out and appended, so an undo puts it back where it was. */
    if (e.kind === 'remove') {
      lines = lines.map((l) => (l.id === e.line ? { ...l, off: true } : l));
    }
    if (e.kind === 'restore') {
      lines = lines.map((l) => (l.id === e.line ? { ...l, off: undefined } : l));
    }
  });
  return lines;
}

/* ── THE FACETS (FEED-IA §7.2) ────────────────────────────────────────────────────────────────
 * «Ticked ≠ finished: the FULL status stays visible as facets — prepared ✓ · printed ⎙ · locked —
 * because you may have prepared without printing, and a last-minute change can reopen a prepared
 * order.» So the fold walks the ledger in order and answers all four at once: what the bay did,
 * what the printer did, whether the document is locked, and whether anything moved AFTER the tick.
 *
 * The staleness is a consequence of ORDER, not of a flag: a line event that lands after a prepare
 * event is a change after prep, and one that lands before it is just how the sale was picked.
 *
 * ═══ AND THE PAPER GOES STALE THE SAME WAY (FEED-IA §29.2) ══════════════════════════════════
 * «New = arrived OR changed since paper last came out — one number absorbs the changed-after-print
 * cases too.» So the printer's facet carries the same order-derived staleness the pick's does: a
 * goods event landing after a print means the sheet in the tray describes a crate that has moved,
 * and the albarán is owed again. THE ORDER IS READ OFF THE HOURS, not off the array: the ledger is
 * assembled from several seeds and a person's own acts, so «after» has to mean later in the
 * morning rather than later in a list somebody happened to concatenate.
 */

/* ═══ AND THE TWO OTHER ROADS GO STALE BY THE SAME CLOCK (FEED-IA §35.3) ══════════════════════
 * «The system always knows: printed or not · edited since last printed · sent to the ERP · edited
 * since sent.» One walk answers all of it: the same TOUCHES_GOODS set, the same hour order, three
 * rails. What differs is only what a stale rail OWES — paper owes another press, the ERP owes
 * another send, and an email that has not gone yet owes nothing at all because it will carry the
 * change when it leaves.
 */

type Facets = {
  prep: Sale['prep'];
  printed: Sale['printed'];
  sentToErp: Sale['sentToErp'];
  emailScheduled: Sale['emailScheduled'];
};

/** the events that change what the bay would have to pick */
/* A PREP NOTE IS IN HERE ON PURPOSE. The paper carries the bench's instruction under the line, so
   a note written after the sheet came out is a sheet that no longer says what to do — and the pick
   that was walked to the old instruction is a pick worth walking again. «Going backwards is
   visible, not silent» (§7.2), and the change check (net.ts) is what makes it come back. */
const TOUCHES_GOODS = new Set<SaleEvent['kind']>(['line', 'theatre-amend', 'add', 'remove', 'restore', 'unit-flip', 'choose-sku', 'choose-sku-none', 'amend', 'prep-note', 'customer-option', 'tier']);

/** Number of material edits already in this sale's ledger when paper was requested. */
export function materialCursorForSale(saleId: string): number {
  return dayNow().events.filter((event) => 'sale' in event && event.sale === saleId && TOUCHES_GOODS.has(event.kind)).length;
}

function foldFacets(unsorted: SaleEvent[]): Facets {
  let prep: Sale['prep'];
  let printed: Sale['printed'];
  let sentToErp: Sale['sentToErp'];
  let emailScheduled: Sale['emailScheduled'];
  let materialCursor = 0;
  const own = [...unsorted].sort((a, b) => a.at.localeCompare(b.at));
  own.forEach((e) => {
    if (e.kind === 'prepare') prep = { at: e.at, lines: prep?.lines ?? [], stale: false };
    if (e.kind === 'unprepare') prep = undefined;
    if (e.kind === 'prepare-line') {
      const lines = prep?.lines ?? [];
      prep = {
        at: prep?.at ?? e.at,
        lines: lines.includes(e.line) ? lines : [...lines, e.line],
        stale: prep?.stale ?? false,
      };
      /* a line ticked before the whole order is ticked is progress, never a prepared order */
      if (!own.some((x) => x.kind === 'prepare')) prep = { ...prep, at: '' };
    }
    if (e.kind === 'unprepare-line' && prep) {
      prep = { ...prep, lines: prep.lines.filter((id) => id !== e.line) };
    }
    if (e.kind === 'print') {
      const applies = materialCursor <= (e.materialCursor ?? materialCursor);
      printed = { count: (printed?.count ?? 0) + 1, at: e.at, stale: !applies, ...(applies ? {} : { staleAt: e.confirmedAt ?? e.at }) };
    }
    /* ── THE TWO OTHER RAILS (§35.3) ──────────────────────────────────────────────────────── */
    if (e.kind === 'erp-send') sentToErp = { at: e.at, target: e.target, stale: false };
    if (e.kind === 'email-schedule') emailScheduled = { at: e.at, sendAt: e.sendAt };
    /* the schedule is what it is sent AGAINST, so a send with no schedule behind it still says
       when it went — the fold never invents the schedule it never saw */
    if (e.kind === 'email-sent') {
      emailScheduled = { at: emailScheduled?.at ?? e.at, sendAt: emailScheduled?.sendAt ?? e.at, sent: e.at };
    }
    if (TOUCHES_GOODS.has(e.kind)) materialCursor += 1;
    if (prep && prep.at && TOUCHES_GOODS.has(e.kind)) {
      const changedLine = 'line' in e ? e.line : undefined;
      prep = { ...prep, stale: true,
        staleLines: changedLine && !prep.staleLines?.includes(changedLine)
          ? [...(prep.staleLines ?? []), changedLine]
          : prep.staleLines };
    }
    /* THE HOUR THE CRATE MOVED rides the facet, because «3 new since the last print» is a question
       about the HOUSE'S last paper and not about this document's own (§35.3). Without the hour a
       sheet that went stale at 07:10 and a press that ran at 09:12 cannot be put in order. */
    if (printed && TOUCHES_GOODS.has(e.kind)) printed = { ...printed, stale: true, staleAt: e.at };
    if (sentToErp && TOUCHES_GOODS.has(e.kind)) sentToErp = { ...sentToErp, stale: true, staleAt: e.at };
  });
  return { prep, printed, sentToErp, emailScheduled };
}

/* ── THE MONEY, FOLDED (FEED-IA §32, Musings 3+4) ─────────────────────────────────────────────
 * «QUANTITY IS PROMISED AT CONFIRM; MONEY IS FINAL AT PRINT.» Three facts come out of the same
 * walk, and all three are consequences of ORDER rather than flags anybody set:
 *
 *   · THE TARIFA — the band this document prices from. The customer's own until a hand switches
 *     it for this albarán, and the switch never touches the customer's standing band.
 *   · THE FREEZE — the prices the paper carried. A 05:30 sheet change moves an OPEN albarán and
 *     never moves one that has already been printed, which is the whole of the law.
 *   · THE COLLECTION — paid folds beside printed and prep, orthogonal to fulfilment: a disputed
 *     sale can be paid and a settled one can still be owed.
 */

type Money = {
  tier: string;
  tierSwitched: boolean;
  /** the hour the money stopped moving */
  moneyAt?: string;
  paid?: Sale['paid'];
  /** what the paper printed, line by line */
  frozen?: Record<string, number>;
};

function foldMoney(unsorted: SaleEvent[], standing: string): Money {
  const own = [...unsorted].sort((a, b) => a.at.localeCompare(b.at));
  let tier = standing;
  let tierSwitched = false;
  let moneyAt: string | undefined;
  let paid: Sale['paid'];
  let frozen: Record<string, number> | undefined;
  let materialCursor = 0;
  own.forEach((e) => {
    if (e.kind === 'tier') {
      tier = e.tier;
      tierSwitched = e.tier !== standing;
    }
    if (e.kind === 'print') {
      const applies = materialCursor <= (e.materialCursor ?? materialCursor);
      if (applies) { moneyAt = e.at; if (e.prices) frozen = e.prices; }
    }
    /* A CHANGE AFTER THE PAPER RE-OPENS THE MONEY TOO (§29.2). The crate moved, so the sheet in
       the tray no longer describes it — and a document that is owed paper again is a document
       whose money is live again. The two facts are one fact. */
    if (TOUCHES_GOODS.has(e.kind)) materialCursor += 1;
    if (moneyAt && TOUCHES_GOODS.has(e.kind)) {
      moneyAt = undefined;
      frozen = undefined;
    }
    if (e.kind === 'pay') paid = { at: e.at, how: e.how, by: e.by };
  });
  return { tier, tierSwitched, moneyAt, paid, frozen };
}

/** THE LINES, PRICED. An open document reads the sheet every time it is read; a printed one reads
 *  the paper. A line a hand priced holds its own number through a tarifa switch — the pin — and a
 *  switch that lands on the band the customer was already on moves nothing at all. */
function priceLines(
  cast: Cast,
  customer: Customer,
  day: string,
  lines: SaleLine[],
  events: SaleEvent[],
  standing: string,
  money: Money,
): SaleLine[] {
  const byHand = new Set(events.flatMap((event) =>
    event.kind === 'add' || (event.kind === 'line' && event.price !== undefined) ? [event.line] : []));
  const agreement = discountOn(customer, day);
  const agreed = (price: number): number => agreement
    ? round(price * (1 - agreement.percent / 100), 4)
    : price;
  const lastChoice = new Map<string, number>();
  const lastManualPrice = new Map<string, number>();
  events.forEach((event, index) => {
    if (event.kind === 'choose-sku') lastChoice.set(event.line, index);
    if (event.kind === 'add' || (event.kind === 'line' && event.price !== undefined)) lastManualPrice.set(event.line, index);
  });
  return lines.map((line) => {
    const choiceWins = (lastChoice.get(line.id) ?? -1) > (lastManualPrice.get(line.id) ?? -1);
    const pinned = byHand.has(line.id) && !choiceWins;
    const frozen = money.frozen?.[line.id];
    if (frozen !== undefined) {
      return { ...line, price: frozen, pinnedPrice: pinned || undefined };
    }
    /* THE PAPER EXISTS, SO THE MONEY IS DONE. A sheet that came out before this build stamped its
       own prices carries none, and the answer is the same one: what it printed is what it printed,
       and nothing written afterwards reaches it. */
    if (money.moneyAt) return pinned ? { ...line, pinnedPrice: true } : line;
    if (pinned) return { ...line, pinnedPrice: true };
    if (choiceWins) {
      const factor = line.unitFactor !== undefined ? line.unitFactor
        : declaredUnitFactor(cast.sector, line.product, line.unit);
      return { ...line, price: factor === null ? 0 : agreed(round(priceOn(cast, line.product, money.tier, day) * factor, 4)),
        tierPriced: money.tierSwitched || undefined };
    }
    /* The line's explicit pin wins. Next comes this customer's exact-SKU price, then the
       document tariff. Printed paper returned above is frozen, so a later override never rewrites it. */
    const customerWritten = writtenOn(line.product, customerKey(customer), day);
    const written = customerWritten ?? writtenOn(line.product, money.tier, day);
    if (written !== null) {
      const factor = line.unitFactor !== undefined ? line.unitFactor
        : declaredUnitFactor(cast.sector, line.product, line.unit);
      return { ...line, price: factor === null ? 0 : agreed(round(written * factor, 4)),
        tierPriced: money.tierSwitched || undefined };
    }
    if (!money.tierSwitched) return agreement ? { ...line, price: agreed(line.price) } : line;
    const ratio = tierRatio(cast, line.product, standing, money.tier, day);
    const repriced = ratio === 1 ? line.price : round(line.price * ratio);
    return { ...line, price: agreed(repriced), tierPriced: ratio !== 1 || undefined };
  });
}

/** THE DAY'S SALES, folded. Newest first inside each group, groups newest first. */
/* ── ONE FOLD PER MORNING, SHARED BY EVERY SURFACE (FEED-IA §31.1, §35.3) ─────────────────────
 * Three surfaces ask this file for the day's sales — the river, the open-items strip and the
 * header's export centre — and at seven hundred sales with four thousand events each ask is a full
 * traversal of the ledger. Three of them per render pass is three copies of the morning in memory
 * and three times the work for one answer that cannot differ.
 *
 * So the fold memoises on ITS OWN INPUTS, which are exactly five and all of them identities:
 * the cast, the day's edits, the grants in force, the tarifa sheet, and which rails the house has
 * opened. Every one of those changes by publishing a NEW object, so a stale answer is impossible
 * rather than unlikely — and the memo is one entry deep, because there is one morning.
 *
 * IT ALSO CLOSED A SEAM THE SURFACES HAD. A React memo keyed on `[cast, edits, grants]` did not
 * re-fold when the house wrote a price this morning, so a screen could go on showing yesterday's
 * money on an open albarán until something else moved. The sheet is one of the five here.
 */
let FOLDED: {
  cast: Cast;
  edits: DayEdits;
  grants: ReturnType<typeof grantsNow>;
  tiers: ReturnType<typeof tiersNow>;
  rails: string;
  sales: Sale[];
  active: Sale[];
} | null = null;

/** the rail world as one comparable word, so «the ERP moved to Sage 50» re-folds the morning.
 *  ⚠ 14 September 2026 · the mailbox left this key with the rail: the fold is built outside React
 *  and cannot subscribe to a polled connection, so a term for it here would have been a constant
 *  in a cache key at best and a stale answer at worst — every caller of `buildSales` holds its
 *  result in a memo of its own and would never have asked again. The mail is read where it is
 *  drawn. */
const railsKey = (cast: Cast): string => {
  const w = railWorld(cast);
  return `${w.erp.connected ? w.erp.name : 'file'}·${w.erp.cadence}`;
};

export function buildSales(cast: Cast, edits: DayEdits, options: { includeArchived?: boolean } = {}): Sale[] {
  const grants = grantsNow();
  const tiers = tiersNow();
  const rails = railsKey(cast);
  if (FOLDED && FOLDED.cast === cast && FOLDED.edits === edits && FOLDED.grants === grants
      && FOLDED.tiers === tiers && FOLDED.rails === rails) {
    return options.includeArchived ? FOLDED.sales : FOLDED.active;
  }
  const sales = foldDay(cast, edits).map(sale => {
    if (sale.writtenHere || sale.customer.channel !== 'email') return sale;
    // Complete the generated fixture envelope on horizon/record days too. These are kit source
    // records, never a fallback that production ingestion may invent for an actual email.
    return { ...sale, thread: sale.thread.map(row => !isSourceMessage(row) || row.email ? row : ({
      ...row, email: { subject: `Order for ${sale.deliveryDay}`,
        from: row.author === 'received' ? sale.customer.name : cast.house.name,
        to: [row.author === 'received' ? cast.house.name : sale.customer.name],
        source: fixtureEmailSource(sale.customer.id), messageId: `${sale.id}:${row.id}` },
    })) };
  });
  const active = sales.filter((sale) => !sale.archived);
  FOLDED = { cast, edits, grants, tiers, rails, sales, active };
  return options.includeArchived ? sales : active;
}

function foldDay(cast: Cast, edits: DayEdits): Sale[] {
  const today = dayOrders(cast);
  const seeded = todaySales(cast);
  const sets = otherDaysOf(cast);
  const record = otherSales(cast, sets.record, 500);
  const horizon = otherSales(cast, sets.horizon, 2000);
  /* what landed since the person sat down (§26.6) — the same kind of object, built the same way */
  const arrived = arrivalSales(cast, edits.events);
  /* the ones the house wrote itself (§66.3) — the same object, built the same way */
  const written = composedSales(cast, edits.events);
  const all = [...horizon, ...seeded, ...record, ...arrived, ...written];

  /* ── WHERE EACH SALE STOOD WHEN THE PERSON SAT DOWN ────────────────────────────────────────
   * THE INVERSION IS APPLIED HERE AND NOWHERE ELSE (§6.2): a sale the machine could commit is
   * committed by the seed; a sale with anything to judge is left standing as a request. So the
   * feed's exceptions are not a curated list — they are what the flag machinery could not clear.
   *
   * AND AT THREE HUNDRED ORDERS THE MASS HAS ALREADY MOVED (§31.1, §26.6). By the time the desk is
   * standing at 09:45 most of the morning is made and printed — a closed row that lies flat as
   * record — a slice is made but still owed paper, and the late arrivals are merely committed. That
   * spread is what the river's calm is made of: it is not that nothing happened, it is that the
   * software did it. Derived from the sale's own id, so the same morning comes back every time. */
  const seeds: Record<string, Seed> = {};
  const BEYOND: Partial<Record<string, SaleState>> = { hotelrec: 'made', manolo: 'scheduled' };
  seeded.forEach((s) => {
    if (!landsCommitted(s)) return;
    const named = BEYOND[s.id];
    if (named) {
      seeds[s.id] = {
        target: named,
        prepared: s.id === 'hotelrec',
        printed: s.id === 'hotelrec' ? 1 : 0,
        touched: s.id === 'hotelrec',
      };
      return;
    }
    const walked = scatterId(s.id, 211);
    seeds[s.id] =
      walked > 0.42
        ? { target: 'made', prepared: walked > 0.86, printed: 1 }
        : walked > 0.24
          ? { target: 'made', prepared: walked > 0.34, printed: 0 }
          : { target: 'committed' };
  });
  /* THE RECORD IS WHAT HAPPENED, AND A GRANT WRITTEN THIS MORNING CANNOT UNDO IT. The inversion
     decides what an ARRIVING order does, so it governs today and the days ahead; yesterday's
     albaranes were sent and delivered under whatever was true then. Without this the settings
     screen could un-deliver a week of documents, which is the one thing a ledger may never do. */
  const seedOther = (set: OtherDay[], built: Sale[], past = false) =>
    built.forEach((sale, i) => {
      const p = set[i];
      /* `touched` rides across too. It was being dropped here, which quietly took §7.2's whole
         changed-after-the-pick case off the horizon: the seed asked for a picked sale that then
         moved, and the fold never saw the line event that makes the tick go stale. */
      seeds[sale.id] = past || landsCommitted(sale)
        ? { target: p.target, prepared: p.prepared, printed: p.printed, touched: p.touched }
        : { target: 'request' };
    });
  seedOther(sets.record, record, true);
  seedOther(sets.horizon, horizon);
  /* AN ARRIVAL OBEYS THE INVERSION LIKE EVERY OTHER ORDER (§6.2, §26.3): the machine commits it on
     landing unless it carries something to judge, in which case it lands standing for review. */
  arrived.forEach((s) => {
    seeds[s.id] = landsCommitted(s) ? { target: 'committed' } : { target: 'request' };
  });

  /* THE EXISTING GATE FOLDS IN. An order held through on another surface is a commit, expressed on
     the older store: one transition, two surfaces, no second truth.
     …AND ONLY WHERE THE SALE DID NOT RECORD ITS OWN. `commitSale` writes both the event and the
     older store's flag, so an unfiltered stand-in arrived FIRST, moved request → committed, and
     left the real event landing on a state it could no longer change — which silently threw away
     the `over` the guard had just recorded. A duplicate transition is not a harmless one. */
  const fromConfirmed: SaleEvent[] = edits.confirmed
    .filter((id) => !edits.events.some((e) => e.kind === 'commit' && e.sale === id))
    .map((id) => ({
      kind: 'commit' as const,
      sale: id,
      at: today.find((o) => o.id === id)?.at ?? '',
    }));

  const ledger = [...seedEvents(cast, all, seeds), ...fromConfirmed, ...edits.events];

  /* THE LEDGER, INDEXED BY SALE (§31.1). The fold used to ask the whole ledger «which of you are
     mine?» once per sale, which is a scan of every event for every row: at five sales and twenty
     events nobody could feel it, and at seven hundred sales and four thousand events it is two and
     a half million comparisons on every act a person takes. One pass builds the index; the fold
     then reads its own events directly. Same events, same order, one traversal. */
  const bySale = new Map<string, SaleEvent[]>();
  ledger.forEach((e) => {
    if (!e.sale) return;
    const own = bySale.get(e.sale);
    if (own) own.push(e);
    else bySale.set(e.sale, [e]);
  });

  /* A GRADUATION IS A FACT ABOUT THE PAIR, NOT ABOUT ONE SALE (THE-INTELLIGENCE §2). Once «frozen»
     on media canal has been sent to Stock, every other line carrying that same word already has
     its answer — so the offer is read off the whole day's ledger and stops everywhere at once. */
  const graduated = new Set(
    ledger.filter((e) => e.kind === 'graduate').map((e) => `${e.base}·${e.amendment}`),
  );

  const grants = grantsNow();

  /* §138.8 supersedes deletion: the same fold keeps archived documents for their day list.
     Old browser delete events are retained as archive facts without inventing an actor. */
  const archived = new Map<string, Sale['archived']>();
  ledger.forEach((event) => {
    if (event.kind === 'archive' || event.kind === 'delete') {
      archived.set(event.sale, { at: event.at, by: event.kind === 'archive' ? event.by : undefined });
    }
  });

  return all.map((sale) => {
    /* ROCOTO ANSWERS THE PRICE ITSELF, WHERE THE HOUSE GRANTED IT (THE-INTELLIGENCE §11). The price
       sheet is a thing Rocoto can read, so a house that says so never sees the question: it is
       answered in the thread, in one sentence, and the sale never stands anywhere. */
    const answersPrice = grants.prices && sale.needsReply?.kind === 'ask';
    /* WHAT IT LACKED WHEN IT LANDED, read off the sale before a single edit is applied. It is the
       only way «the choice appeared because your correction re-armed Rocoto» can be true rather
       than asserted: the software has to remember that it could not answer. */
    const stoodOnArrival = !answersPrice && (standsInDay(sale) || nativelySticky(sale));
    const own = bySale.get(sale.id) ?? [];
    let state = sale.state;
    const stamps: Sale['stamps'] = {};
    let dispute: Sale['dispute'];
    let confirmedOver: string[] | undefined;
    let read: Sale['read'];
    let flagged: Sale['flagged'];
    let autoCommitted = false;
    let answered = false;
    const thread = [...sale.thread];

    /* ── ROCOTO ASKS, WHERE THE HOUSE GRANTED IT (THE-INTELLIGENCE §11, amended) ───────────────
     * «Where Rocoto is not confident it stays SILENT — no holding messages, no filler — UNLESS the
     * house set Rocoto to check with the customer, in which case it asks fluidly, the way a person
     * would.» So the grant buys exactly ONE line, written like a fishmonger and marked as Rocoto's
     * own act; the customer's answer is what the desk is now waiting for, and the card says so.
     * Without the grant there is no line at all — silence, and the sale stands here instead. */
    const unclear = flagsOf(sale).find((f) => f.kind === 'unreadable');
    const rocotoAsked = grants.checkIn && unclear ? askWords(unclear.line) : undefined;
    if (rocotoAsked) {
      thread.push({ id: `${sale.id}-check`, author: 'ai', text: rocotoAsked, time: clockAfter(sale.at, 2) });
    }

    own.forEach((e) => {
      const next = advance(state, e);
      /* ── THE FACTS THAT CHANGE NO STATE AND ARE STILL FACTS (FEED-IA §86.4 · §86.4b) ────────
       * `stamps` began as «the hour each transition happened», so an event that moved nothing left
       * no trace and two surfaces had to keep module sets of their own to remember what a person
       * had said: which drafts had been GIVEN a day, and which documents had TAKEN the account's
       * usual hour. Both are claims about something that happened to a document, and the ledger is
       * the only honest place for a claim like that (§66.1's own argument for `read`). They stamp
       * here, beside `print` and `reply`, which were already in this shape for the same reason. */
      if (next !== state || e.kind === 'print' || e.kind === 'reply'
          || e.kind === 'draft-day' || e.kind === 'slot-taken') stamps[e.kind] = e.at;
      /* WHO COMMITTED IT (§6.2). The machine's own commit says so on the row, so a person can
         always see which of the day's albaranes they never had to touch. */
      if (e.kind === 'commit' && next !== state) {
        autoCommitted = e.auto === true;
        /* ── AND ROCOTO DOES THE TALKING (THE-INTELLIGENCE §11) ───────────────────────────────
         * «Review exists so Rocoto can confirm.» So the moment a person gives it the one answer
         * it was standing there for, the loop closes IN FRONT OF THEM: the confirmation goes to
         * the customer as Rocoto's own message, in Rocoto's own thread, with Rocoto's own mark.
         * They answered one thing; the conversation was had by the software. */
        if (!e.auto) {
          thread.push({
            id: `c-${thread.length}`,
            author: 'ai',
            kind: 'activity',
            text: `Confirmed with ${sale.customer.name} for ${sale.deliveryDay}.`,
            time: e.at,
          });
        }
      }
      /* THE RECORD REMEMBERS. A person stayed sovereign over the check, so the object carries
         what the check said at the moment they moved it on. */
      if ((e.kind === 'commit' || e.kind === 'make') && next !== state && e.over?.length) {
        confirmedOver = e.over;
      }
      /* READ IS THE LAST WORD ON THE MATTER (§66.1) — a later `unread` takes it back, exactly as
         it does in a mail client, and the pair fold to whichever spoke last. */
      if (e.kind === 'read') read = { at: e.at, by: e.by };
      if (e.kind === 'unread') read = undefined;
      if (e.kind === 'flag') flagged = { at: e.at, by: e.by };
      if (e.kind === 'unflag') flagged = undefined;
      if (e.kind === 'deliver' && next === 'delivered' && e.recordedAt && Number.isFinite(Date.parse(e.recordedAt))) stamps.deliveredAt=e.recordedAt;
      if (e.kind === 'decline' && next === 'disputed') dispute = { at: e.at, because: e.because };
      if (e.kind === 'resolve' && dispute) dispute = { ...dispute, outcome: e.outcome };
      /* THE ANSWER IS WHAT CLEARS IT (§9.2). Nothing is dismissed here either: the card sits down
         because a sentence went to the customer, in Sales and in Chats at the same moment. */
      if (e.kind === 'answer') {
        thread.push({ id: `a-${thread.length}`, author: 'ai', text: e.text, time: e.at });
        stamps.answer = e.at;
        answered = true;
      }
      if (e.kind === 'reply') {
        thread.push({ id: `r-${thread.length}`, author: 'sent', text: e.text, time: e.at });
        /* the same doctrine one door along: their sentence goes, and Rocoto closes the order off
           the back of it — which is the value of the product made visible in the thread itself */
        if (sale.needsReply && !answered) {
          thread.push({
            id: `c-${thread.length}`,
            author: 'ai',
            text: `Confirmed for ${sale.deliveryDay}. It goes on the van as agreed.`,
            time: e.at,
          });
        }
        answered = true;
      }
      if (e.kind === 'schedule' && next === 'scheduled') stamps.schedule = e.window;
      state = next;
    });

    /* the complaint is a message in the same thread, because that is where the customer put it */
    if (dispute) {
      thread.push({ id: 'dispute', author: 'received', text: dispute.because, time: dispute.at });
    }

    const walked = applyLines(sale, cast, own).map((l) => {
      const key = amendmentKey(l);
      return key && graduated.has(key) ? { ...l, graduated: true } : l;
    });
    /* A LINE TAKEN OFF IS OFF THE DOCUMENT AND STILL IN THE HISTORY. So the albarán's own `lines`
       never carry it — the figure, the guard and the printed sheet are correct without knowing
       anything about removal — and the undo has the row it needs to put back. */
    /* THE MONEY CLOCK, APPLIED (§32). The tarifa this document prices from, and the prices that
       follow from it — read off the sheet while the albarán is open, read off the paper once it
       has been printed. A document nobody has switched and nobody has printed comes back exactly
       as the catalogue priced it, which is why this costs the untouched morning nothing. */
    const money = foldMoney(own, sale.tier);
    const priced = priceLines(cast, sale.customer, sale.day, walked, own, sale.tier, money);
    const lines = priced.filter((l) => !l.off);
    const removed = priced.filter((l) => l.off);
    const { prep, printed, sentToErp, emailScheduled } = foldFacets(own);
    const learned = own
      .map((e) => learnedWords(e, lines))
      .filter((t): t is string => t !== null);

    /* THE PRICE, READ OFF THE SHEET AND SENT (§11). The question was put on the sale's first line,
       so that is the line the answer states, and the sentence goes out at the hour it was asked —
       which is the whole of «Rocoto answers on the spot wherever it is confident». */
    let needsReply = answered ? undefined : sale.needsReply;
    if (answersPrice && !answered && lines[0]) {
      thread.push({
        id: `${sale.id}-price`,
        author: 'ai',
        text: priceAnswer(lines[0], lines[0].price),
        time: thread[thread.length - 1]?.time ?? sale.at,
      });
      needsReply = undefined;
    }

    /* ── ROCOTO SAYS NOTHING RATHER THAN SOMETHING EMPTY (FEED-IA §10, corrected) ────────────
     * There is no «un momento, lo confirmo» in this product and there must never be one. Where
     * Rocoto is confident it answers directly and the sale never stands at all; where it is not, it
     * says NOTHING and routes the sale to review. So a standing card's thread ends on the
     * CUSTOMER'S own words, unanswered — that is the whole point of it standing — and the desk can
     * see at a glance exactly who has been left without a reply.
     *
     * What review buys is not politeness. It is that the one missing thing is EASIER TO SUPPLY
     * here than anywhere else, and supplying it is what re-arms Rocoto to write the reply itself. */
    const settled: Sale = {
      ...sale,
      stoodOnArrival,
      state,
      stamps,
      dispute,
      confirmedOver,
      read,
      flagged,
      archived: archived.get(sale.id),
      autoCommitted,
      needsReply,
      rocotoAsked,
      thread,
      lines,
      removed: removed.length > 0 ? removed : undefined,
      prep,
      printed,
      /* the two other roads out, folded from the same ledger as the paper (§35.3) */
      sentToErp,
      emailScheduled,
      learned,
      figure: figureOf(lines),
      tier: money.tier,
      tierSwitched: money.tierSwitched || undefined,
      moneyAt: money.moneyAt,
      paid: money.paid,
    };
    return {
      ...settled,
      thread,
      lines,
      removed: removed.length > 0 ? removed : undefined,
      prep,
      printed,
      learned,
      figure: figureOf(lines),
    };
  });
}

/* ── THE RIVER'S DAYS (FEED-IA §4.2) ──────────────────────────────────────────────────────────
 * «CONTINUITY is the main thing. Monzo's feed is one unbroken river — day separators are whispers,
 * not boxes. One stream, infinite back through time.» So a group is not a section: it is a day's
 * worth of rows with a whisper above it, and the whisper carries the aggregate so a day scrolled
 * past is still legible (§1: the strip's job moves INTO the headers).
 */

export type DayGroup = {
  day: FeedDay;
  /** EVERY row this day holds, the ones the band indexes included (§25.2) */
  sales: Sale[];
  /** what the whole day comes to */
  total: number;
  /** how many of them are waiting on a person — the day's own owed work */
  waiting: number;
  /** printed or gone: how much of the day is already record (§21) */
  closed: number;
};

/** THE DAY KEEPS ITS OWN (FEED-IA §25.2). «The band item IS the feed item. Tapping the sticky thing
 *  taps the thing in the feed» — so nothing is lifted OUT of a day any more. A sale a person is
 *  waiting on is drawn here, in its day, in its standing treatment, AND indexed by the band above:
 *  one entity, seen twice, and the tap through is what proves they are the same thing.
 *
 *  WHAT IS OWED COMES FIRST INSIDE A DAY (§1: «pending needs gravity»). Everything else runs
 *  newest first, which is how the record reads. */
export function groupByDay(cast: Cast, sales: Sale[]): DayGroup[] {
  const byHour = (a: Sale, b: Sale) => b.at.localeCompare(a.at);
  const today = todayId(cast);
  return feedDays(cast)
    .map((day) => {
      /* THE RIVER DRAWS DOCUMENTS A PERSON CAN READ (§74.4). A draft has no customer yet, so it
         has no name, and a nameless row among three hundred named ones is noise rather than work.
         It is excluded HERE — the one function that decides what the river draws — so it stays in
         `buildSales` where the composer and the drafts dropdown can still find it by its id. */
      const own = sales.filter((s) => s.day === day.id && !isDraft(s));
      const owed = own.filter((s) => !s.archived && isStanding(s, today)).sort(byHour);
      const rest = own.filter((s) => s.archived || !isStanding(s, today)).sort(byHour);
      return {
        day,
        sales: [...owed, ...rest],
        total: round(own.reduce((sum, s) => sum + s.figure, 0)),
        waiting: owed.length,
        /* the day's own count of documents that want nothing (canon §15.1) — the field keeps its
           name because the surfaces read it as «lies flat», which is exactly what it counts */
        closed: own.filter(nothingOwed).length,
      };
    })
    .filter((g) => g.sales.length > 0);
}

/** A DAY THAT HOLDS NOTHING YET IS STILL A DAY (§27). The narrow can stand on any date the
 *  chevrons or the calendar reach, so the surface needs the empty one as a group of its own. */
export const emptyGroup = (day: FeedDay): DayGroup => ({
  day,
  sales: [],
  total: 0,
  waiting: 0,
  closed: 0,
});

/** One day, whichever day the day view is standing in. */
export const salesOfDay = (sales: Sale[], day: string): Sale[] =>
  sales.filter((s) => s.day === day).sort((a, b) => a.at.localeCompare(b.at));

/** Which days hold anything at all — the dots the mini calendar draws. */
export const daysWithSales = (sales: Sale[]): Set<string> => new Set(sales.map((s) => s.day));

/* ── WHAT STANDS, AND WHERE (FEED-IA §6.2, §9, §10) ───────────────────────────────────────────
 * «Cards live IN THEIR DAY by default — standing but in place. Only the top level escapes the
 * day.» And the top level has one definition, and it is not a severity: **is a person waiting?**
 *
 *   STICKY          somebody is on the other end of a conversation Rocoto cannot close alone: the
 *                   order cannot be understood · it is bigger than usual and wants a yes or a no ·
 *                   a price question is holding their own decision. Minutes matter, so the card
 *                   leaves its day and rides the top of the surface until it is answered.
 *   IN ITS DAY      the customer is not waiting — Rocoto already answered them — but the sale
 *                   cannot be prepared or locked until somebody says something: a line with no
 *                   amount · goods that may not be gettable · a pick that changed after the tick.
 *                   Hours matter. It stands, elevated, exactly where its day is.
 *   QUIET           nothing is waiting on anybody right now. It is a row like every other row,
 *                   with the one mark its state earns.
 *
 * ESCALATION IS A CONSEQUENCE, NOT A SETTING: a card standing in its day becomes sticky the moment
 * that day arrives with the answer still missing, because the prep wall has become a customer wall.
 *
 * THERE ARE NO LEVELS IN THIS FILE. The states carry it: what a card is waiting for decides where
 * it stands, and a number in between would be a second vocabulary to keep in step with the first.
 */

/** THE FLAGS A CUSTOMER IS WAITING ON. Both of them are the same question — «this one is bigger
 *  than what you let me confirm alone, do I promise it?» — asked of the line and of the order. */
const wantsAYes = (f: Flag): boolean => f.kind === 'unusual' || f.kind === 'big';

/* ── MESSAGES ARE A CHUNK, NOT CARDS (FEED-IA §26.4) ──────────────────────────────────────────
 * «Non-order asks that need a response collapse into ONE row at the bottom of the for-review list
 * — Messages · 3 with a counter. They are not orders; they still need taking care of; they get one
 * door, not a card each.»
 *
 * So the band holds ORDERS, and a sale whose only outstanding thing is a question the customer
 * asked is not one of them: it keeps its ordinary row in its day, carries the mark that says a
 * question is open on it (§9.2: the fact shows in BOTH places), and its counter rides the one
 * Messages row. A sale that is ALSO unconfirmed, unreadable, off-catalogue or over the house's
 * threshold is an order with a problem, and it stays a card.
 */
export function isMessageOnly(sale: Sale): boolean {
  /* §165 availability theatre has no goods document at all. The explicit mark keeps it out of
     Sales, picking, paper and exports while Chats can still fold its one unresolved question. */
  if (sale.messageOnly) return true;
  if (sale.needsReply?.kind !== 'ask') return false;
  if (flagsOf(sale).some(wantsAYes)) return false;
  if (openNonSku(sale).length > 0) return false;
  /* `request`, an unreadable line, a stale pick — anything that makes it an ORDER for review */
  return !standsInDay(sale);
}

/* ── READ, AND UNREAD (FEED-IA §66.1) ─────────────────────────────────────────────────────────
 * Opening the sheet writes the first one. It is deliberately NOT a control: «once read, if they
 * don't edit, that's down to them» only holds if reading happens by reading, the way it does in a
 * mail client. The second one IS a control, and it is the only attention act the app has.
 */
export function readSale(sale: Sale, at: string, by = loadConfig().owner.name): void {
  /* WRITE ONCE. A sweep walks three hundred documents and every write refolds the morning, so a
     sale already read costs the ledger nothing when a person walks back past it. */
  if (sale.read) return;
  setDay((prev) => ({ ...prev, events: [...prev.events, { kind: 'read', sale: sale.id, at, by }] }));
}

export function markUnread(sale: Sale, at: string): void {
  if (!sale.read) return;
  setDay((prev) => ({ ...prev, events: [...prev.events, { kind: 'unread', sale: sale.id, at }] }));
}

/** Flag is a separate auditable follow-up marker; viewing never clears it. */
export function flagSale(sale: Sale, at: string, by = loadConfig().owner.name): void {
  if (sale.flagged) return;
  setDay((prev) => ({ ...prev, events: [...prev.events, { kind: 'flag', sale: sale.id, at, by }] }));
}

export function unflagSale(sale: Sale, at: string, by = loadConfig().owner.name): void {
  if (!sale.flagged) return;
  setDay((prev) => ({ ...prev, events: [...prev.events, { kind: 'unflag', sale: sale.id, at, by }] }));
}

/** The counter's own set: every sale whose one open thing is a question in the conversation. */
export const messagesOf = (sales: Sale[]): Sale[] => sales.filter(isMessageOnly);

/** somebody is on the other end, waiting for words */
export function isSticky(sale: Sale, today: string): boolean {
  /* §26.4: it rides the Messages counter, so it never takes a card of its own */
  if (isMessageOnly(sale)) return false;
  if (sale.needsReply?.kind === 'ask') return true;
  const flags = flagsOf(sale);
  if (flags.some(wantsAYes)) return true;
  if (openNonSku(sale).length > 0) return true;
  /* the prep wall becomes a customer wall the day the goods are due */
  return standsInDay(sale) && sale.day <= today;
}

/* ── THE FLOW'S LIST — AND IT HAS NO SURFACE OF ITS OWN (FEED-IA §51.25, §67.6) ───────────────
 * «The main actions should be quick and at the bottom of the main screen. Flipping through them
 * could be better» — read as: REVIEW IS A FLOW. Settling one arrives at the next without hunting
 * the list again.
 *
 * ═══ AND THE BAND THAT USED TO DRAW IT IS DEAD (FEED-IA §67.6) ══════════════════════════════
 * «Urgent shit that the Rocoto deferred appears as a CHAT NOTIF; otherwise it shows up as a LABEL
 * on orders, and simply having no sticky for-review thing might be best!!! but system led!!»
 *
 * So this list is now an ORDER, not a place. It decides three things and draws nothing:
 *   · WHERE THE FLOW GOES NEXT when a document settles (the river advances the selection)
 *   · WHERE THE SHEET SAYS IT STANDS («2 of 7»), which is a position and never a control
 *   · WHICH DOCUMENTS THE SYSTEM DEFERRED, for the chat notice below
 * The ORDER is the wait: the oldest thing somebody is held by goes first, which is the order a
 * person has already learnt to read. Nothing sticky, nothing folded, no pile to manage.
 *
 * THE QUESTIONS ARE NOT IN IT (§26.4): a sale whose one open thing is a customer's question rides
 * the Messages row, so it is not an order for review and the flow never lands on one.
 */
export const reviewOf = (sales: Sale[], today: string): Sale[] =>
  sales.filter((s) => isSticky(s, today)).sort((a, b) => a.at.localeCompare(b.at));

/* ── THE ONE THING THAT INTERRUPTS: THE CHAT NOTICE (FEED-IA §67.6, canon §16.4) ──────────────
 * «Urgent shit that the Rocoto deferred appears as a CHAT NOTIF.»
 *
 * THE ROUTING, WHICH IS THE WHOLE ATTENTION ARCHITECTURE (canon §16.4):
 *
 *   Rocoto deferred something genuinely urgent   THE CHAT WIDGET NOTIFIES — the conversation is
 *   (a customer is held, and the day has come)   where a held person lives
 *   a document is worth a look                   a quiet LABEL on its own row, in its own day
 *   an answer is owed (§2.4)                     the row's own reason and its one act
 *   everything else                              NOTHING. Silence is the correct interface for an
 *                                                ordinary order
 *
 * THE SYSTEM DECIDES WHAT INTERRUPTS; THE PERSON NEVER MANAGES A PILE. That sentence is the test
 * for every future addition to this area.
 *
 * ═══ THE SEAM (deliberate, and documented because the WIDGET IS NOT IN THIS PACKAGE) ═════════
 * The chat widget lives in `shell/` and owns its own drawing. This file owns the MODEL — WHICH
 * conversations are being interrupted and WHY — so the two meet at exactly one function and no
 * state is duplicated:
 *
 *   THE PRODUCER   `chatNotices(sales, today)` — pure, derived, recomputed on every event. It
 *                  returns one row per HELD CONVERSATION, keyed by the CUSTOMER (the thread's own
 *                  identity), carrying the sale it is about, the reason in the reason's own two or
 *                  three words, and the hour it became urgent.
 *   THE CONSUMER   the shell's chat widget imports this and reads it against its own thread list;
 *                  `focusThread(sector, customer)` is the door it already has, so a notice becomes
 *                  a thread to open with no new navigation. Nothing here knows the widget exists.
 *   THE SURFACE    Sales states the same set on the river's own root as `data-notices` (the count)
 *                  and `data-notice` per customer, so a drive — and any later surface — can read
 *                  what the system deferred without reaching into a component's state.
 *
 * WHAT THE SEAM DELIBERATELY DOES NOT CARRY: a read/unread flag of its own (attention is the
 * document's, §66.1), a dismiss act (dismissing an interruption is managing a pile), or a count
 * anywhere on the river (§67.6 — the number of deferred things is never displayed as a queue).
 */
export type ChatNotice = {
  /** the document it is about */
  sale: string;
  /** the CONVERSATION it belongs to — the thread's own identity, and the widget's key */
  customer: string;
  /** why, in the reason's own two or three words — never a category (canon §16.3 clause 3) */
  label: string;
  /** the hour the order landed, which is the hour the person started waiting */
  at: string;
};

/** WHAT ROCOTO DEFERRED AND CANNOT SIT ON: a person is on the other end, and the day has come, so
 *  waiting is no longer free. Everything else stays quiet on its own row. */
export function chatNotices(sales: Sale[], today: string): ChatNotice[] {
  /* Conversation-only questions stay out of the order review walk, but their native home is the
     chat notification. This also makes a §165 deferred question visible through the same seam. */
  return sales
    .filter((sale) => sale.needsReply?.kind === 'ask' || (sale.day <= today && isSticky(sale, today)))
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((s) => ({ sale: s.id, customer: s.customer.id, label: reasonLabelOf(s) ?? 'Your yes', at: s.at }));
}

/** the sale cannot be prepared or locked until somebody answers, and its day is still ahead */
export function standsInDay(sale: Sale): boolean {
  if (sale.needsReply?.kind === 'order') return true;
  if (Boolean(sale.prep?.stale)) return true;
  if (flagsOf(sale).some((f) => f.kind === 'unreadable')) return true;
  return sale.state === 'request';
}

/** it was standing in its day, and the day came */
export const isEscalated = (sale: Sale, today: string): boolean =>
  standsInDay(sale) && sale.day <= today && !nativelySticky(sale);

function nativelySticky(sale: Sale): boolean {
  return (
    sale.needsReply?.kind === 'ask' ||
    flagsOf(sale).some(wantsAYes) ||
    openNonSku(sale).length > 0
  );
}

/** anything waiting on a person at all — sticky, or standing in its day */
export const isStanding = (sale: Sale, today: string): boolean =>
  isSticky(sale, today) || standsInDay(sale) || sale.state === 'disputed';

/* ── WHY IT STANDS, IN THE WORDS THAT CLOSE IT ────────────────────────────────────────────────
 * THE-INTELLIGENCE §11: «Review exists so Rocoto can confirm. A standing card is Rocoto saying:
 * give me this one answer and I can close the loop with the customer.» And FEED-IA §10, on the
 * sticky ones: ROCOTO HAS ALREADY ANSWERED. The customer is HELD, not ignored — so the sticky
 * card's own words say who is being held and what releases them. Never «pending review»; never a
 * customer standing in silence.
 */

export type ReasonAct = 'edit' | 'reply' | 'settle';

/* ── ONE REASON, ONE AXIS (FEED-IA §69.3 · §70.3 · §72.3 · THE-CUMULATIVE-AUDIT-2 C27) ────────
 * «The class's label IS the row's reason», and the chip is that reason compressed. So a reason
 * carries the AXIS it speaks on, and `rubricOf` reads it back rather than re-deriving it down a
 * second ladder that can land somewhere else. `axis` is the only field here that both altitudes
 * share, which is exactly why it belongs on the object rather than in two functions.
 */
export type ExceptionReason = { text: string; rocoto: boolean; act: ReasonAct; axis: RubricClass };

/* ── A HOUSE THAT HAS NEVER ORDERED (THE CHECKPOINT §8 · §9.16 · MAP 8.10, 7.14, 11.5·3) ──────
 * «New customers do not have this history and therefore require different behavior.» The parse
 * is customer-independent and always was — capture works cold, which is 7.14 — and what was
 * missing is the BRANCH: nothing anywhere read an empty history and behaved differently.
 *
 * WHAT «EMPTY» HONESTLY MEANS IN THIS WORLD. `knows.ts historyOf` mints a fulfilment fingerprint
 * for every account in the book, because the book is three hundred seeded restaurants and the
 * ledger is five days — so «length === 0» is answerable there only for an account that is not in
 * the book at all. The account that really has no record behind it is the one the HOUSE WROTE
 * ITSELF (§86.5, `customers-made.ts`): typed into the composer this morning, or emulated as
 * «TEST · New customer». That is the cold start, and it is a fact this file can read without
 * reaching across the `knows` seam it may not import.
 *
 * WHAT IT CHANGES. The document says so — the class below — and it routes on the escalation topic
 * that already exists, «A house ordering for the first time». THE PATTERN CLASSES CANNOT FIRE ON IT
 * and nothing suppresses them, because nothing has to: `usual` is written by the day's own plan
 * and a hand-written account has no plan, so `flagsOf`'s quantity arm has nothing to divide by.
 * The house's own CEILING still applies — that is a limit on the money, not a reading of a
 * pattern, and it is exactly as true for a stranger as for a regular.
 */
export const coldStart = (sale: Sale): boolean => isMadeCustomer(sale.customer.id);

/** THE PREDICTION AND ITS GROUND, CARRIED UP TO THE ROW (FEED-IA §70.3 · §80.3, C27). «The row's
 *  reason quotes the prediction and its ground.» Both were already computed and both stopped at
 *  the LINE — the sheet drew «they asked for “lubina salvaje” · filled with Lubina de estero —
 *  what you had» and the row above it said nothing about any of it. This is the same fold, read at
 *  document scale: one filled line quotes itself whole, several say how many and off what. */
export function fillReason(sale: Sale): string | null {
  const filled = sale.lines.filter((l) => l.asked && !l.corrected);
  if (filled.length === 0) return null;
  return filled.length === 1 ? fillWords(sale, filled[0]) : fillSummary(sale);
}

export function exceptionReasons(sale: Sale, sticky = false): ExceptionReason[] {
  const who = sale.customer.name;
  const out: ExceptionReason[] = [];

  if (sale.needsReply) {
    out.push({ text: sale.needsReply.about, rocoto: false, act: 'reply', axis: 'question' });
  }

  /* THE FIRST ORDER LEADS ITS OWN DOCUMENT (§69.C3 — «no history, everything patternless. Act: a
     look at the whole»). It is pushed before the flags so that among the reasons of one rank the
     stable sort keeps it first: on a stranger's order the whole document wants the look, and a
     clause about one line would send the eye to the wrong place. */
  if (coldStart(sale)) {
    out.push({
      text: 'First order — review the full order',
      rocoto: true,
      act: 'edit',
      axis: 'newAccount',
    });
  }

  flagsOf(sale).forEach((f) => {
    /* WHERE ROCOTO ALREADY ASKED THEM, THE CARD SAYS THAT (§11, amended). Asking the desk for a
       thing the customer is already answering is the app talking over its own message. */
    const asked = f.kind === 'unreadable' && sale.rocotoAsked;
    out.push({
      text: asked ? askedWords(sale, f) : sticky ? stickyWords(sale, f) : confirmWords(f),
      rocoto: true,
      act: 'edit',
      /* THE AXIS IS THE FLAG'S OWN (§69): the amount that did not read is A2, the multiple is C1,
         and the money over the house's limit is C2. The sentence above is written FROM the same
         flag, so the chip and the sentence cannot end up on different axes. */
      axis: f.kind === 'unreadable' ? 'unreadable' : f.kind === 'big' ? 'ceiling' : 'quantity',
    });
  });

  const off = openNonSku(sale);
  if (off.length > 0) {
    const named = off.map((l) => l.product.name).join(' and ');
    out.push({
      text: sticky
        ? `They asked for ${named} — identify it before replying`
        : `Confirm once you identify ${named}`,
      rocoto: true,
      act: 'edit',
      axis: 'newword',
    });
  }

  if (sale.prep?.stale) {
    /* where a person is waiting it has to say the URGENCY — a sentence about the bay, on a band
       whose whole subject is people being held, reads as if it wandered in from another screen */
    out.push({
      /* the rail beside it already says the day has come («Open · out today»), so the urgent
         phrasing states the CHANGE and nothing else — two clauses about today on one card is the
         same fact printed twice (§25.5) */
      text: sticky
        ? 'The pick changed after it was walked — look before it goes'
        : STALE_WORDS,
      rocoto: false,
      act: 'edit',
      axis: 'pick',
    });
  }

  if (sale.state === 'disputed') {
    out.push({ text: sale.dispute?.because ?? 'They declined it', rocoto: false, act: 'settle', axis: 'complaint' });
  }

  /* THE REASON LINE IS NEVER EMPTY (§22.6: «review vs urgent is still unclear»). A house that has
     kept the confirmation for itself (THE-INTELLIGENCE §11) sends every order here with no flag on
     it at all, and a card that stands with a verb and no sentence is exactly the card whose
     standing a person cannot read. So the plainest case says the plainest thing.
     AND WHERE ROCOTO PREDICTED SOMETHING, THE PLAINEST THING IS THAT PREDICTION (§70.3, C27). A
     row whose only sentence restated its own verb — «It is waiting for your yes» over the button
     that was then reading «Resolve it» (§110 has since replaced it with «Check it») — spent the
     card's whole sentence budget on what the button already said.
     Where the document carries a fill, the sentence quotes it and its ground instead, and the
     glance judges the prediction rather than the parse. The AXIS is unchanged either way: what
     makes this row stand is the yes the house kept for itself. */
  /* AND WHERE THE SHELF ANSWERED THE ASK, THE AXIS SAYS SO (§9.16 · §14.3·iv: «Stock conflict —
     usual SKU currently unavailable»). The sentence is unchanged and so is the behaviour — §80.3
     stands, the fill RESOLVES and quotes its ground — but the chip over it used to read «Your
     yes», which names the house's own rule and says nothing about the substitution the sentence
     underneath is entirely about. A compression that drops the subject is not a compression.
     The class is the FLOOR's: a fill whose ground is «what you had». A fill whose ground is what
     they always take is §69.B2, solved by analogy, and that one is still the plain yes. */
  if (out.length === 0 && sale.state === 'request') {
    const fill = fillReason(sale);
    const offTheFloor = sale.lines.some((l) => l.asked && !l.corrected && l.filledBy === 'model');
    out.push({
      text: fill ?? 'Review before confirming.',
      rocoto: true,
      act: 'edit',
      axis: fill && offTheFloor ? 'stock' : 'yes',
    });
  }

  return out;
}

/* ── THE ONE SENTENCE A CARD CARRIES (FEED-IA §51.1) ──────────────────────────────────────────
 * «The review cards are EXTREMELY BUSY — redesign against text limits; a card must read.» A card
 * that printed every reason it had printed three sentences and a fourth about how many were left,
 * and the reader had to sort them. So a card takes ONE reason, and which one is a DECISION rather
 * than the order the reasons happened to be constructed in.
 *
 * THE ORDER IS WHO IS HELD HARDEST, which is the same question the band itself answers:
 *
 *   settle  A COMPLAINT. Somebody has already been let down; nothing on a card outranks that.
 *   reply   A PERSON ASKED. They are on the other end of a conversation with the answer missing.
 *   edit    THE DOCUMENT IS SHORT OF A FACT. Real work, and nobody is holding a phone over it.
 *
 * Within one rank the construction order stands, because `Array.prototype.sort` is stable and the
 * order reasons are built in is already the order they were noticed in. THE REST ARE NOT LOST —
 * they are in the document, one press away, which is where a person deals with them anyway.
 */
const REASON_RANK: Record<ReasonAct, number> = { settle: 0, reply: 1, edit: 2 };

export const topReason = (sale: Sale, sticky = false): ExceptionReason | null =>
  exceptionReasons(sale, sticky)
    .slice()
    .sort((a, b) => REASON_RANK[a.act] - REASON_RANK[b.act])[0] ?? null;

/** WHO IS WAITING, SAID (FEED-IA §10, §22.6) — AS A CLASS, ONCE (§25.5). The two standings differ
 *  by exactly one thing and the copy has to carry it: a PERSON is held, or the WORK is. The
 *  customer's name used to ride this line too, and on a row that already leads with the name two
 *  inches above it that is a label repeating what position says — which is exactly the confusion
 *  §25.5 sends this pass after. The line names the class; the name is the row's own first line. */
export const waitWords = (sale: Sale, sticky: boolean): string =>
  sticky ? 'A person is waiting on you' : 'The work is waiting';

/* ── THE ANSWER CHOICE (FEED-IA §10, corrected) ───────────────────────────────────────────────
 * «The moment the person corrects/supplies the thing in the UI, a button becomes visible: Rocoto
 * answers — beside the option to write to the customer themselves. Their call, every time.»
 *
 * The choice EXISTS BECAUSE OF THE CORRECTION, and this predicate is where that is true rather
 * than claimed: the sale arrived with something Rocoto could not answer, it is no longer standing
 * because a person supplied it, and nobody has yet said anything to the customer. That is exactly
 * the moment the software is armed again — and the value of review in a good UI, which is that the
 * one missing thing was easier to supply here than in a message.
 */
export const canAnswer = (sale: Sale, today: string): boolean =>
  Boolean(sale.stoodOnArrival) &&
  !isSticky(sale, today) &&
  /* §26.4 took the message-only ones off the band; they are still waiting on a sentence, so the
     choice may not appear until the question itself has been dealt with */
  !isMessageOnly(sale) &&
  !standsInDay(sale) &&
  !sale.stamps.reply &&
  !sale.stamps.answer;

/** What Rocoto writes once it has what it lacked. Composed from the sale, never typed. */
export const answerWords = (sale: Sale): string => {
  const config = loadConfig();
  const cast = cedarCast(CASTS[config.cast]);
  return confirmationPreview(sale, cast, config, grantsNow(), todayId(cast));
};

/** …and the two sentences the two questions can be answered with, once the fact is in hand. */
export const priceAnswer = (line: SaleLine, price: number): string =>
  `The ${line.product.name} is at ${solesRate(price, line.unit)} today.`;

export const supplyAnswer = (sale: Sale, line: SaleLine, can: boolean): string =>
  can
    ? `Yes — the extra ${line.product.name} goes on for ${sale.deliveryDay}.`
    : `The ${sale.deliveryDay} delivery note goes as it stands; I will let you know the moment there is more ${line.product.name}.`;

/* THE ESCALATION IS A STATE, NOT A SENTENCE (FEED-IA §51.1). «Became urgent — delivery is today»
 * used to be printed on the card under its reason — beside a rail already saying «Open · out
 * today», which is the identical fact at a second step (§25.5) and one of the three sentences that
 * made the card busy. `isEscalated` survives as the LAW; the surface states it with `data-escalated`
 * and says it in the state word the row and the card already share. */

/* ── PREPARING (FEED-IA §7.2) ─────────────────────────────────────────────────────────────────
 * A sale can be picked once the house has committed to it, and stops being pickable once it has
 * gone out. A request is not pickable — there is nothing to pick until somebody has judged it.
 */

export const canPrepare = (sale: Sale): boolean =>
  !sale.messageOnly && RANK[sale.state] >= RANK.committed && RANK[sale.state] < RANK.sent;

/* ── THE DAY'S PAPER, AND WHAT IS NEW ON IT (FEED-IA §20, §25.1, §29) ─────────────────────────
 * A day prints two different products and they must never be confused: ONE SHEET — the delivery
 * list the van walks — and N ALBARANES, one per crate. Both are about the same set of stops, so
 * the set is computed once here: what the house has committed to for that day, plus what has
 * already gone out on it.
 */
export const sheetSalesOf = (sales: Sale[]): Sale[] =>
  sales.filter((s) => !isMessageOnly(s) && (canPrepare(s) || s.state === 'sent'));

/** «NEW» IS ONE NUMBER AND IT ABSORBS BOTH CASES (§29.1, §29.2): «arrived OR changed since paper
 *  last came out». No paper yet, or paper that no longer describes the crate. */
export const wantsPaper = (sale: Sale): boolean => !sale.printed || sale.printed.stale;

/* ── THE ONE ANSWER TO «WHAT WOULD THIS PRESS PRINT» (THE-EXPORT-CANON §8.3 · AUDIT-2 C22) ────
 * Two surfaces asked this question and got two answers a pixel apart in the same morning: the
 * river's day whisper drew ⎙ 127 and the export centre's paper rail drew To print 126. One number
 * of the two counted a document that is standing for a person.
 *
 * THE RIVER WAS THE LIAR, and not only in its count. §8.3 rule 1 — «AN OWED ANSWER IS OUTSIDE
 * EVERY COUNT» — and rule 2 — «a count counts only what its press would act on» — are one law read
 * twice, and the river broke both at once: the ⎙ said 127 and its press enqueued 127, so pressing
 * it put a crate on the van the house had not agreed to. This file already knew that, one altitude
 * down: `exportStance` answers a standing document with «Print after resolving».
 *
 * SO THE EXCLUSION MOVES INTO THIS FUNCTION, which is the one both readers call. `today` is the
 * reference `isStanding` needs and every caller has; a day ahead is filtered against it exactly as
 * today is, because a document of tomorrow that is waiting on a person is not owed paper either.
 */
export const newPaperOf = (sales: Sale[], today: string): Sale[] =>
  sheetSalesOf(sales).filter((s) => wantsPaper(s) && !isStanding(s, today));

/* ══ THE EXPORT STATE — WHAT HAS LEFT THE HOUSE, AND WHAT HAS NOT (FEED-IA §35.3) ═════════════
 * «The system ALWAYS KNOWS: printed or not · edited since last printed · sent to the ERP · edited
 * since sent · scheduled to email · how many came in or were confirmed-after-review since the last
 * print · how many of today are yet to be printed. Review items are OUTSIDE those counts and get
 * their own ticker beside them.»
 *
 * Every one of those is a QUESTION ABOUT A SET, so they are answered once, here, off the same
 * ledger the rows are drawn from — and the header's counters, the modal's sentences and the block
 * at the foot of an albarán are three readings of one answer rather than three sums.
 *
 * WHY REVIEW STANDS OUTSIDE. An albarán waiting on a person is not owed paper: printing it would
 * put a crate on the van the house has not agreed to. Counting it as «yet to print» would make the
 * number a person is working down un-finishable, which is the one thing a counter must never be.
 * It gets its own quiet ticker instead, because it is still work — just a different job.
 */

/** THE TWO FACTS EVERY RAIL HAS: what it has done, and what it owes. */
export type ExportState = {
  /** the hour paper last came out anywhere in the day, where any has */
  lastPrintAt?: string;
  /** today's albaranes still owed paper, review outside */
  toPrint: Sale[];
  /** the ones that came in — or were confirmed out of review — since that last paper */
  newSincePrint: Sale[];
  /** already on paper */
  printed: Sale[];
  /** waiting on a person, and therefore in none of the counts above */
  review: Sale[];
  /** committed work the house's own system has yet to receive */
  toErp: Sale[];
  /** what has already reached it */
  sentErp: Sale[];
  /** standing scheduled, each for the hour its customer asked for */
  scheduled: Sale[];
  /** already gone to the customer */
  emailed: Sale[];
};

/** THE HOUR A SALE BECAME PAPER'S BUSINESS: the moment the house committed to it, which is the
 *  moment §35.3 means by «came in or was confirmed after review». */
const readyAt = (sale: Sale): string => sale.stamps.commit ?? sale.stamps.make ?? sale.at;

/** WHAT IS OWED TO THE HOUSE'S OWN SYSTEM: everything committed that has not gone, plus everything
 *  that MOVED after it went — the ERP's own version of «changed since the paper came out». */
export const wantsErp = (sale: Sale): boolean =>
  RANK[sale.state] >= RANK.committed && (!sale.sentToErp || sale.sentToErp.stale);

/** «edited since last printed» and «edited since sent», said as the two predicates §35.3 names. */
export const editedSincePrint = (sale: Sale): boolean => Boolean(sale.printed?.stale);
export const editedSinceErp = (sale: Sale): boolean => Boolean(sale.sentToErp?.stale);

export function exportState(sales: Sale[], scopeDay: string, world: RailWorld, referenceDay = scopeDay): ExportState {
  const day = sales.filter((s) => s.day === scopeDay);
  const review = day.filter((s) => isStanding(s, referenceDay));
  const held = new Set(review.map((s) => s.id));
  const mine = day.filter((s) => !held.has(s.id));

  const printedAll = day.filter((s) => s.printed);
  const lastPrintAt = printedAll.reduce<string | undefined>(
    (top, s) => (!top || (s.printed && s.printed.at > top) ? s.printed?.at : top), undefined);

  /* ONE ANSWER, READ HERE TOO (§8.3 rules 1 and 2, C22). This used to re-derive the set off `mine`
     with the same two filters spelled out again — the same answer by coincidence rather than by
     construction, which is how it and the river drifted a document apart. */
  const toPrint = newPaperOf(day, referenceDay);
  /* A SALE IS «NEW» WHEN ITS OWED-NESS BEGAN AFTER THE LAST PAPER — it landed since, it was
     confirmed since, or the crate moved since. With no paper yet, everything owed is new: the
     first press of a morning prints the morning. */
  const newSincePrint = toPrint.filter((s) =>
    !lastPrintAt || (s.printed?.stale ? (s.printed.staleAt ?? s.printed.at) > lastPrintAt : readyAt(s) > lastPrintAt));

  return {
    lastPrintAt,
    toPrint,
    newSincePrint,
    printed: printedAll,
    review,
    toErp: world.erp.connected ? mine.filter(wantsErp) : [],
    sentErp: day.filter((s) => s.sentToErp),
    scheduled: day.filter((s) => s.emailScheduled && !s.emailScheduled.sent),
    emailed: day.filter((s) => s.emailScheduled?.sent),
  };
}

/* ── WHAT EACH RAIL SAYS ABOUT ONE ALBARÁN (§35.3) ────────────────────────────────────────────
 * One sentence per rail, composed here so the block at the foot of the document, the modal's rows
 * and any surface that grows one later all say the identical thing. Every sentence states what IS:
 * a rail nobody has connected says what connecting it does, and one that has not sent yet says
 * when it will — never what is missing.
 */

/** «Printed 09:12» · «Printed 3× · it changed since» · «It has yet to print». */
export function printedWordsOf(sale: Sale): string {
  if (!sale.printed) return 'It has yet to print';
  const times = sale.printed.count > 1 ? `Printed ${sale.printed.count}× · last at ${sale.printed.at}` : `Printed ${sale.printed.at}`;
  return sale.printed.stale ? `${times} · it changed since` : times;
}

/** «Sage 50 · went 07:41» · «Goes with today's file at 16:00» · what connecting one does. */
export function erpWordsOf(sale: Sale, world: RailWorld): string {
  if (!world.erp.connected) return world.erp.configured
    ? `${world.erp.name} configured · provider activation required`
    : 'Choose an ERP to prepare its mapping. Files remain active.';
  const name = sale.sentToErp?.target ?? world.erp.name;
  if (sale.sentToErp) {
    return sale.sentToErp.stale
      ? `${name} · went ${sale.sentToErp.at} · it changed since, so it goes again`
      : `${name} · went ${sale.sentToErp.at}`;
  }
  if (RANK[sale.state] < RANK.committed) return `${name} · it goes once the order is confirmed`;
  return world.erp.cadence === 'stream'
    ? `${name} · it goes as soon as it is confirmed`
    : `${name} · it goes with today’s file at ${world.erp.fileAt}`;
}

/** «Sent to Hotel Rec at 07:30» · «Goes to Hotel Rec at 10:30» · when this one is due.
 *
 *  THE SENTENCE IS ABOUT THE DOCUMENT, and the mail rail is drawn only where a mailbox is already
 *  connected (`useEmailCapability().posture === 'ready'`, §2.5's «absent, not held»), so this
 *  reads the sale alone. ⚠ 14 September 2026 · it used to open on `world.email.connected` with
 *  «Connect your mail and the delivery note reaches them the moment it is due» — a sentence that
 *  could only ever be reached by a rail nobody had connected, on a row that such a house never
 *  sees. It went with the rail. */
export function emailWordsOf(sale: Sale): string {
  if (sale.emailScheduled?.sent) return `Sent to ${sale.customer.name} at ${sale.emailScheduled.sent}`;
  if (sale.emailScheduled) return `Goes to ${sale.customer.name} at ${sale.emailScheduled.sendAt}`;
  /* A CUSTOMER WHO WORKS ON ANOTHER CHANNEL STILL GETS THEIR COPY — it rides the crate, which is
     what the paper is for. The rail says where theirs comes from rather than that no mail goes. */
  if (!takesEmail(sale)) {
    return `${sale.customer.name} works on ${sale.customer.channel}, so their copy goes with the goods`;
  }
  return `It goes to ${sale.customer.name} at ${slotOf(sale)} once the delivery note is made`;
}

/** IS THE TICK STANDING? A change that landed after the pick RESETS it (§7.2: «the change resets
 *  the tick with a note; going backwards is visible, not silent»), so a stale prep is an unticked
 *  circle with a sentence beside it rather than a filled circle nobody can trust. */
export const isPrepared = (sale: Sale): boolean => Boolean(sale.prep?.at) && !sale.prep?.stale;

/** The facets, said in the order §7.2 names them. Words, never colour. */
export function facetWords(sale: Sale): string[] {
  const out: string[] = [];
  /* a reset tick has no hour to state — the note under it is what the row owes the bay instead */
  if (isPrepared(sale)) out.push(`prepared ${sale.prep!.at}`);
  if (sale.printed) {
    out.push(sale.printed.count > 1 ? `printed ${sale.printed.count}×` : `printed ${sale.printed.at}`);
  }
  if (RANK[sale.state] >= RANK.made) out.push('locked');
  return out;
}

/** THE ONE SENTENCE A REOPENED TICK OWES THE BAY (§7.2). Going backwards is visible. */
export const STALE_WORDS = 'It changed after it was picked. Look at it again.';

/* ── NOTHING CLOSES — THE RECORD IS A STREAM OF ACTS (THE-EXPORT-CANON §15.1, FEED-IA §67.4) ──
 * «NOTHING CLOSES, basically — get it? I just don't want them to have to make closed to quickly
 * print everything once they trust us, then print again as new shit comes in.»
 *
 * WHAT DIED. `closed` as a value, as a wall, and as a word on any surface. §21's reading — printed
 * means processed — stays true as A SENTENCE ABOUT THE PAST (paper came out) and stops being a
 * door that shuts the document.
 *
 * WHAT REPLACED IT — two things, and the ledger already held both:
 *   THE STREAM        every act that happened, in hours: printed 09:12 · printed again 10:40 ·
 *                     went to Sage 50 07:41 · sent 11:20. It only ever grows.
 *   THE LIVE READING  what this document is owed RIGHT NOW, recomputed on every event — and it
 *                     goes BACKWARDS constantly, which is the whole point: goods move, and the
 *                     document is owed again.
 *
 * SO THE PREDICATE IS `owedOf`, AND THE OLD NAME WAS TEACHING THE WALL. `isClosed` answered «has
 * it ever printed, unchanged» — a fact about history dressed as a state. `nothingOwed` answers the
 * only question the surface actually asks, and the elevation law of §21 survives by being restated
 * on it:
 *
 *   A DOCUMENT WITH NOTHING OWED LIES FLAT. A DOCUMENT THAT OWES SOMETHING STANDS.
 *   Elevation follows what is owed, never a flag anybody set.
 *
 * «CHANGED SINCE» IS PROMOTED FROM A MODIFIER TO THE AXIS'S MAIN EVENT. With no terminal state,
 * the loudest ordinary reading there is is the crate moving after the paper came out: the document
 * stands again, and it says the hour it happened.
 *
 * TIME STILL PRESSES IMPLICITLY (§21, unchanged). The pressure is the DAY's rather than an hour's,
 * so a document owed paper whose day has arrived says «Out today» in ink, in place, borrowing no
 * colour and leaving no day.
 *
 * PROCESSED AND UNPROCESSED LIVE TOGETHER. There is no archive screen and no queue screen — one
 * river, and what is owed stands in it.
 */

/** WHAT ONE DOCUMENT WANTS RIGHT NOW. Every field is a RAIL or the one hold, and each of them is
 *  read off the ledger rather than off a flag anybody set (canon §15.1, §2.4). */
export type Owed = {
  /** §2.4's ONE HOLD: the crate is undetermined, or the house's own limit is waiting for a yes */
  answer: boolean;
  /** the crate moved after the paper came out — the loudest reading there is (overlay B) */
  changed: boolean;
  /** the house's own system took it and the crate moved since (overlay C) */
  system: boolean;
  /** no paper has come out yet, and the goods are still in the house */
  paper: boolean;
  /** the pick was walked and the crate changed after it (§7.2) */
  pick: boolean;
  /** a complaint is open — the loudest OPEN state there is (§2.2) */
  resolution: boolean;
};

/** THE ONE HOLD, EXACTLY AS THE CANON WRITES IT (§2.4). Nothing else may hold an export act, and
 *  every clause here is a MISSING FACT rather than a blessing: unread does not hold, unedited does
 *  not hold, a complaint does not hold, a stale pick does not hold, a customer's chat question does
 *  not hold. */
export const answerOwed = (sale: Sale): boolean =>
  sale.state === 'request' ||
  sale.needsReply?.kind === 'order' ||
  openNonSku(sale).length > 0 ||
  flagsOf(sale).some((f) => f.kind === 'unreadable' || wantsAYes(f));

/** THE LIVE READING, COMPUTED ONCE. The river's row word, the state row's first cell and the
 *  elevation are three readings of THIS, so they can never disagree about what a document wants. */
export function owedOf(sale: Sale): Owed {
  return {
    answer: answerOwed(sale),
    changed: Boolean(sale.printed?.stale),
    system: Boolean(sale.sentToErp?.stale),
    /* PAPER IS OWED ONLY WHILE THE CRATE IS IN THE HOUSE. Once the goods have gone, paper is not
       a thing this document wants — it is a thing that either happened or did not, and the record
       says which. A `request` is not pickable either, so what it owes is the answer above. */
    paper: canPrepare(sale) && !sale.printed,
    pick: Boolean(sale.prep?.stale),
    resolution: sale.state === 'disputed',
  };
}

/** NOTHING IS OWED — so the document lies flat, as record (canon §15.1). It is a READING and never
 *  a state: it goes false again the moment the crate moves. */
export const nothingOwed = (sale: Sale): boolean => {
  const owed = owedOf(sale);
  return !owed.answer && !owed.changed && !owed.system && !owed.paper && !owed.pick && !owed.resolution;
};

/* ── THE RUBRIC, AND ITS CHIP (FEED-IA §67.6, §72; THE-EXPORT-CANON §17.2, §17.3) ─────────────
 * «And that would show a little nice chip so they can scroll through hundreds of these and know
 * what to stop on, as they press the left and right arrows.»
 *
 * ONE FUNCTION ANSWERS BOTH FORMS, because they are one fact at two compressions: the CLASS a
 * document falls in (canon §17.2's rubric) and the two-or-three WORDS that name it. The surface
 * turns the class into a mark; this file never knows what a mark is.
 *
 * THE ORDER IS THE TRIAGE ORDER (§17.2): «worst understanding first — a person always meets the
 * documents furthest from right before the ones that are nearly right.» So the branches below run
 * A (did we read it?) → B (did we match it?) → C (is it normal for them?) → the person owed words,
 * and a document that trips two of them wears the worse one.
 *
 * THE COPY BAR IS BASE'S TAG GRAMMAR (§17.3 rule 2): «where a reason compresses into a chip it
 * takes Base's tag rules — 1–2 words, a noun or an adjective, NEVER a verb.» So the chip says what
 * the document IS, not what to do about it: «Above usual», never «Confirm it». And there is no
 * generic one — «for review», «pending» and «needs check» name a pile, and there is no pile.
 *
 * ═══ TWO WORDS IS A CEILING, NOT A TARGET (§72.2 · THE-CUMULATIVE-AUDIT-2 C28) ════════════════
 * Three of these ran to three words on the served bundle — «Bigger than usual», «Over your
 * ceiling», «Off the catalogue» — and a chip built FOR the ← → sweep pays for every extra word in
 * footprint that changes with the class it names. They are cut here, at the one place the
 * vocabulary is written, and the whole register now reads in two words or one.
 *
 * ═══ THE CHIP IS THE REASON'S OWN COMPRESSION, SO IT IS DERIVED FROM IT (§72.3 · C27) ════════
 * «The full prediction+ground label stays on the row's own line — the chip is its compression, not
 * its replacement.» This file used to answer that with TWO independent ladders over one set of
 * facts: `rubricOf` walked the flags in the triage order, `topReason` walked them in the order of
 * who is held hardest, and the two disagreed on any document that tripped both — a row printing
 * «Rocoto asked them…» over the chip «Amount unreadable», or a customer's question under the chip
 * for a flag nobody had mentioned. A compression that can contradict what it compresses is not a
 * compression.
 *
 * SO THERE IS ONE LADDER NOW, and it is the REASON's: every `ExceptionReason` carries the AXIS it
 * speaks on, `topReason` picks the sentence, and the chip is that sentence's axis wearing the
 * vocabulary below. The two cannot disagree, by construction rather than by care.
 *
 * ═══ WHERE §69'S B FAMILY IS, SAID OUT LOUD ═════════════════════════════════════════════════
 * The rubric's B family — ambiguous · solved-by-analogy · first-time — has no chip and that is
 * §80.3's own answer rather than a gap: an ambiguity Rocoto RESOLVES fills the line and says so on
 * the line («they asked for “lubina salvaje” · filled with Lubina de estero — what you had»), and
 * a resolved document is a SURE document, which wears no chip at all (§72.3). An ambiguity Rocoto
 * holds is `needsReply`, which is the D axis and does wear one. What B owed the ROW is §70.3's
 * prediction and its ground, and `fillReason` below carries it up there.
 *
 * A SURE DOCUMENT RETURNS null, AND THAT IS THE POINT (§72.3, §61.2). The absence is the calm: 285
 * of 300 rows wear nothing at all, so the fifteen that do are found by the ink appearing rather
 * than by reading a column of labels.
 */
/* ═══ THE FIVE THE CHECKPOINT NAMES AND THE RUBRIC LACKED (§9.16 · §14.3·ii, ·iv) ═════════════
 * «Review should progressively contain things an experienced salesperson would also pause on:
 * unusual quantity; NEW PRODUCT FOR THIS CUSTOMER; ambiguous variants; STOCK CONFLICT;
 * TARIFF/PRICE UNCERTAINTY; NEW CUSTOMER; off-catalogue request; SEASONAL/BEHAVIOURAL CHANGE…»
 * Five of those eleven had no class, so the app could stop on them and had no word for it.
 *
 * TWO OF THE FIVE FIRE TODAY AND THREE WAIT, AND WHICH IS WHICH IS STATED RATHER THAN HIDDEN —
 * a class with no predicate is vocabulary the surfaces can already speak, and the alternative is
 * five words invented later in five places:
 *
 *   newAccount  FIRES · `coldStart` below. The account the house wrote itself.
 *   stock       FIRES · a line the shelf answered with something else — §70.2's substitution
 *               axis, whose ground the row already quotes («filled with Lubina de estero —
 *               what you had»). The chip finally names the axis that sentence is on.
 *   firstTime   WAITS on `buyersOf`, which lives across the `knows.ts` seam this file may not
 *               import (knows reads sale; the edge is one-way). On a COLD START it is subsumed:
 *               a house that has never ordered has never taken anything, so `newAccount` is the
 *               truer class and the stronger one (§69.C3 — «everything patternless»).
 *   price       WAITS on the tarifa as a SERIES — «previous price, and the day it moved» — which
 *               is `tiers.ts`'s own build. Every line in this ledger prices, so the demo world
 *               cannot make this claim honestly today.
 *   season      WAITS on the pilot month. `insights.ts seasons()` already returns empty and says
 *               so over a five-day ledger; a season class firing on five days would be the same
 *               dishonesty wearing a chip.
 */
export type RubricClass =
  | 'complaint'   /* a person has already been let down — outside the rubric, above all of it */
  | 'unreadable'  /* A2 · the order read; one line's amount did not */
  | 'newword'     /* A3 · a product word the reference has no row for */
  | 'ceiling'     /* C2 · over the house's own limit — the one that escalates to a required yes */
  | 'quantity'    /* C1 · out of this customer's own pattern */
  | 'question'    /* D · a person is owed words. It never enters the flip loop (§17.2) */
  | 'yes'         /* the house kept the confirmation for itself and this one is waiting on it */
  | 'pick'        /* the crate moved after the bay walked it (§7.2) */
  | 'newAccount'  /* C3 · a house that has never ordered — every amount stands on its own */
  | 'firstTime'   /* B3 · this customer has never taken this product */
  | 'stock'       /* the shelf answered the ask with something else (§70.2's substitution) */
  | 'price'       /* C4 · the price this line prices from is not settled */
  | 'season';     /* the sort that answers «the usual» has moved with the season */

/** THE WHOLE VOCABULARY, IN ONE OBJECT (§72.2's two-word ceiling, C28). One line per class, so a
 *  word that runs long is visible as a word rather than as a chip nobody measured. */
export const RUBRIC_WORD: Record<RubricClass, string> = {
  complaint: 'Complaint',
  unreadable: 'Amount unreadable',
  newword: 'Off catalogue',
  ceiling: 'Over ceiling',
  quantity: 'Above usual',
  question: 'Their question',
  yes: 'Your yes',
  pick: 'Pick changed',
  newAccount: 'First order',
  firstTime: 'First time',
  stock: 'Stock conflict',
  price: 'Price unset',
  season: 'Season moved',
};

export type Rubric = { klass: RubricClass; word: string };

export function rubricOf(sale: Sale): Rubric | null {
  const axis = topReason(sale)?.axis;
  return axis ? { klass: axis, word: RUBRIC_WORD[axis] } : null;
}

/** The chip's words alone, for the surfaces that have no room for a mark (the state row's first
 *  cell, the chat notice). One vocabulary, one place it is decided. */
export const reasonLabelOf = (sale: Sale): string | null => rubricOf(sale)?.word ?? null;

/* ═══ THE ACTION POLICY — ACT · CLARIFY · HOLD · HANDOFF (THE CHECKPOINT §9) ═══════════════════
 *
 * «Every meaningful decision should map to an action policy:
 *    ACT      — Safe to process / reply automatically.
 *    CLARIFY  — Ask the customer the smallest useful question.
 *    HOLD     — Do not reply yet. Put it into the operator queue.
 *    HANDOFF  — Assign it to the relevant person.
 *  HOLD and HANDOFF are successful outcomes when acting automatically would be unsafe.»
 *
 * ═══ ALL FOUR WERE ALREADY BUILT, AS FOUR SEPARATE PREDICATES WITH NO SHARED WORD ════════════
 * `autoCommitted`/`passesNet` acted, `rocotoAsked` clarified, `answerOwed`/`standsInDay` held,
 * `ESCALATION_TOPICS` handed over — four behaviours, four vocabularies, and no function anybody
 * could ask «what did Rocoto decide about this one?». So this INVENTS NOTHING and folds what is
 * there. It is the vocabulary that was missing, not the mechanism.
 *
 * ═══ THERE IS NO SCORE HERE, AND THERE CANNOT BE (§9.13 · `data.tsx:373`) ════════════════════
 * «Do not show a fake universal probability just because a model can emit one.» A policy is a
 * VERDICT read off named predicates — every one of them a fact somebody can go and check on the
 * document — and there is no number in this type, no threshold in this function, and nothing on
 * the `Sale` that could hold one. §28 owns the day a real scoring implementation lands; when it
 * does it lands UNDER these four words rather than beside them.
 *
 * ═══ THE ORDER IS WHO IS OWED HARDEST, AND IT IS `REASON_RANK`'S ═════════════════════════════
 *   HANDOFF  a named person is owed this: a complaint, a stranger's first order, a question the
 *            house has kept for itself. Nothing outranks a human being waiting.
 *   CLARIFY  Rocoto has already asked the CUSTOMER — it acted, and the answer is on its way. It
 *            outranks HOLD deliberately: a document whose question is out is not sitting in a
 *            queue, and calling it held would be the app asking the desk for the thing the
 *            customer is answering (the same defect `askedWords` exists to fix).
 *   HOLD     the desk is owed something — `answerOwed` is canon §2.4's one hold, `standsInDay`
 *            is the day's own version of it.
 *   ACT      everything else. A SURE document, and its policy wears no mark anywhere (§72.3).
 *
 * ═══ THE PREPARED INTERPRETATION IS THE DIFFERENTIATOR, SO IT RIDES THE VERDICT (§9.11) ══════
 * «Rocoto can prepare an internal suggested interpretation/reply while still withholding it from
 * the customer. This abstention behavior is one of the main product differentiators.» That is
 * what a `request` has always been — the albarán fully predicted, nothing sent — and it has never
 * been SAYABLE. `withheld` is that prediction in words, and it is INTERNAL by construction: it is
 * composed here, from the reading and the figure, and it is never written into `sale.thread`,
 * which is the only stream a customer sees.
 */

export type PolicyId = 'act' | 'clarify' | 'hold' | 'handoff';

/** THE CHECKPOINT'S OWN FOUR WORDS, for the internal surfaces that name a verdict. They are
 *  upper-case because they are the policy's names and not the app's copy — no customer and no
 *  review row ever reads one (§10.10, §72.3). */
export const POLICY_WORD: Record<PolicyId, string> = {
  act: 'ACT',
  clarify: 'CLARIFY',
  hold: 'HOLD',
  handoff: 'HANDOFF',
};

export type Policy = {
  id: PolicyId;
  /** the checkpoint's own word for it */
  word: string;
  /** what happened, in the grammar the app already speaks — never a second sentence written here */
  says: string;
  /** the rubric class that put it here, where a class did */
  axis: RubricClass | null;
  /** where a handoff goes — the TOPIC, never a person: `company.escalation` owns the name */
  topic?: EscalationTopic;
  /** the interpretation Rocoto prepared and did not send (§9.11) */
  withheld?: string;
};

/**
 * WHICH TOPIC NAMES THIS DOCUMENT, if one does (§5.11's routing, read as a policy).
 *
 * Three of the four `ESCALATION_TOPICS` are answerable off a document. `credit` is the fourth and
 * it is absent on purpose: nothing on a sale says a customer is asking about their terms, and a
 * topic guessed from a document is a handover to the wrong desk.
 */
export function escalationTopicOf(sale: Sale): EscalationTopic | null {
  /* somebody has already been let down (§14.3's own top rank) */
  if (sale.state === 'disputed') return 'claim';
  /* «A house that has never ordered» — the topic exists and now something routes on it (8.10) */
  if (coldStart(sale)) return 'newAccount';
  /* THE REQUEST EXCEEDS WHAT THE HOUSE GRANTED (§9.12: «requested action exceeds agent
     permissions»). A customer's own question with the prices grant withheld is precisely that:
     Rocoto may not answer it, so a person does, and the topic says which one. */
  if (sale.needsReply?.kind === 'ask' && !grantsNow().prices) return 'price';
  return null;
}

/** THE INTERPRETATION ROCOTO HAS READY. The reading it made of the message and what that comes
 *  to — the two facts a person judges an abstention by. It is composed for INTERNAL surfaces
 *  only; nothing here is ever appended to a thread.
 *
 *  A DOCUMENT THE HOUSE WROTE ITSELF HAS NONE, and that is the honest half of this: `writtenHere`
 *  came down no channel, so Rocoto read nothing and prepared nothing. Its `reading` is «Written at
 *  the desk for Friday 22.08» — a sentence about where the document came from — and calling that a
 *  withheld interpretation would be the app claiming an abstention it never made. */
export const preparedWords = (sale: Sale): string | undefined =>
  (sale.writtenHere ? undefined : `${sale.reading} · ${soles(sale.figure)}`);

/* WHY IT IS THE WHOLE READING AND NOT A COMPRESSION OF IT — a drive settled this, from both sides.
 * Shortened to «3 lines · 892,82 €» it reads beautifully on a phone AND IT STOPS BEING WITHHELD:
 * those are the two facts the customer's own readback embed already carries, so the string turned
 * up in the conversation and the abstention assertion went red. What makes this sentence internal
 * is precisely the part a compression drops — that it is a READING somebody made of a message,
 * with its door and its day, rather than the confirmation that went out. */

/**
 * WHAT ROCOTO DECIDED ABOUT THIS DOCUMENT. One function, four verdicts, and every one of them a
 * fold of predicates that were already deciding it.
 */
export function policyOf(sale: Sale): Policy {
  const reason = topReason(sale);
  const axis = reason?.axis ?? null;
  const topic = escalationTopicOf(sale);
  const withheld = preparedWords(sale);

  if (topic) {
    return { id: 'handoff', word: POLICY_WORD.handoff, says: reason?.text ?? sale.reading, axis, topic, withheld };
  }
  if (sale.rocotoAsked) {
    return { id: 'clarify', word: POLICY_WORD.clarify, says: sale.rocotoAsked, axis, withheld };
  }
  if (answerOwed(sale) || standsInDay(sale)) {
    return { id: 'hold', word: POLICY_WORD.hold, says: reason?.text ?? waitWords(sale, false), axis, withheld };
  }
  /* A SURE DOCUMENT CARRIES NO WITHHELD INTERPRETATION, because nothing was withheld: the reading
     went out with the confirmation. The absence is the same calm the missing chip is (§72.3). */
  return { id: 'act', word: POLICY_WORD.act, says: sale.reading, axis: null };
}

/** How many documents fell to each verdict. A verdict nobody reached is absent rather than zero —
 *  the same rule `netCounts` keeps, for the same reason. */
export function policyCounts(sales: Sale[]): Partial<Record<PolicyId, number>> {
  const out: Partial<Record<PolicyId, number>> = {};
  for (const sale of sales) {
    const id = policyOf(sale).id;
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

/* ═══ THE PERSON'S TWO JOBS — ONE FOLD OVER THE FOUR VERDICTS (FEED-IA §110 · §110.1) ═════════
 *
 * «What is ACT/CLARIFY/HOLD/HANDOFF? All of those mean they either need to double-check and edit
 * the albarán, or they need to answer a message themselves — which Rocoto will then monitor to
 * learn, like a co-present thing.» And his final form: «It's really just two things: either they
 * need to EDIT, or they need to REPLY. The edit reasons and the reply reasons are various.»
 *
 * ═══ THE FOUR VERDICTS ARE UNTOUCHED, AND THIS SITS ON TOP OF THEM ═══════════════════════════
 * `policyOf` still decides; the inspector still names the verdict; the traces still carry it. What
 * this adds is the fold the REVIEW SURFACE reads, and it asks exactly one question:
 *
 *                        COULD ROCOTO FORM THE ALBARÁN?
 *
 *   FORMED, AND HELD   a draft exists and the authority to send it is what is missing — the
 *   → CHECK IT         house's own ceiling, a quantity out of the customer's pattern, the shelf's
 *                      answer to the ask, the yes the house kept for itself — or Rocoto put its
 *                      question and the answer has come back. The machine's HOLD lands here, and
 *                      so does CLARIFY once it is answered.
 *
 *   NO HONEST DRAFT    the capture or the reading failed, the matter is between people (a
 *   → ANSWER THEM      complaint, a stranger's first order, a question the house keeps for
 *                      itself), or the house's own routing gives it to a named person. There is
 *                      nothing to hand anybody to check. The machine's HANDOFF lands here, and so
 *                      does a CLARIFY the policy sends to a person instead.
 *
 *   ACT                nothing is asked of anybody, so there is no job and this returns null. A
 *                      settled document is quiet, and quiet is what it draws.
 *
 * ═══ THE GUARANTEE IS CODE, NOT A PROMISE ════════════════════════════════════════════════════
 * `check` opens a sheet, so `check` is returned ONLY where lines exist. A document with nothing
 * formed on it falls to `answer` however the machine decided it — the person is never sent to a
 * draft that is not there. That is the whole of «a draft must always exist behind this verb».
 *
 * ═══ AND IT WRITES NO SENTENCES ══════════════════════════════════════════════════════════════
 * `says` is the policy's own one-line reason, carried through unchanged — the reasons are already
 * written and this is not the place a new one gets invented. `who` is read off `company.escalation`,
 * which is where §5.11 put the routing: the topic is on the verdict, the name is the house's.
 */

export type JobId = 'check' | 'answer';

/** THE TWO VERBS THE PERSON EVER READS. One line, one place, so a third can never be written into
 *  a card by hand — and «Resolve it», which named neither job, is gone with it (§110). */
export const JOB_VERB: Record<JobId, string> = {
  check: 'Check it',
  answer: 'Answer them',
};

/** The handle each verb takes on a row, so a count of either is a thing anything can take. */
export const JOB_TESTID: Record<JobId, string> = {
  check: 'row-check',
  answer: 'row-answer',
};

export type Job = {
  id: JobId;
  /** exactly one of the two words above */
  verb: string;
  testid: string;
  /** the one-line reason, as the policy already writes it — never a second sentence */
  says: string;
  /** who the house routes it to, where the house routes it (§5.11) — an answer's own fact */
  who?: string;
  /** THE MACHINE'S VERDICT THIS JOB FOLDS. It rides the job for the inspector and the traces, and
   *  no surface a person reads may print it (§110's law, §72.3's calm). */
  policy: PolicyId;
};

/** THE READING FAILED, so nothing honest was formed: an amount that did not read, or a word the
 *  reference has no row for. Both are capture, and both are settled by asking the customer. */
const readingFailed = (sale: Sale): boolean =>
  flagsOf(sale).some((f) => f.kind === 'unreadable') || openNonSku(sale).length > 0;

/** ROCOTO'S QUESTION HAS COME BACK — it asked, and the thing it asked about is no longer open. The
 *  draft stands whole again, so what is left is a person reading it (§110's CLARIFY-already-
 *  answered). While the question is still out, the unreadable line is what `readingFailed` sees. */
const clarifyAnswered = (sale: Sale): boolean =>
  Boolean(sale.rocotoAsked) && !flagsOf(sale).some((f) => f.kind === 'unreadable');

/** §149: a question and a document concern can coexist. Neither bit masks the other. */
export function attentionOf(sale: Sale): { response: boolean; check: boolean } {
  const concerns = standingConcernsOf(sale);
  return { response: concerns.some((concern) => concern.kind === 'response'), check: concerns.some((concern) => concern.kind === 'check') };
}

/** One current attention claim, with a stable scope for dismissal and its exact seat. */
export type StandingConcern = {
  id: string;
  kind: 'response' | 'check';
  says: string;
  line?: SaleLine;
  group?: boolean;
};

/**
 * The one concern projection used by labels and inline notes. It deliberately does not treat a
 * changed amount as an answer: a stale pick is evidence that the picked goods changed.
 */
export function standingConcernsOf(sale: Sale): StandingConcern[] {
  if (sale.archived) return [];
  const concerns: StandingConcern[] = [];
  if (sale.needsReply) concerns.push({ id: `reply:${sale.needsReply.kind}:${sale.needsReply.about}`, kind: "response", says: sale.needsReply.about });
  if (sale.state === "disputed") concerns.push({ id: `dispute:${sale.dispute?.because ?? "They declined it"}`, kind: "response", says: sale.dispute?.because ?? "They declined it" });

  const flags = flagsOf(sale);
  for (const flag of flags) {
    concerns.push({
      id: `flag:${flag.id}`,
      kind: 'check',
      says: flagText(flag),
      line: flag.kind === 'big' ? undefined : flag.line,
      group: flag.kind === 'big',
    });
  }

  if (sale.prep?.stale) {
    const staleLines = sale.prep.staleLines?.length
      ? sale.prep.staleLines
      : sale.lines.filter((line) => line.given !== line.ordered).map((line) => line.id);
    const lines = staleLines.map((id) => sale.lines.find((line) => line.id === id)).filter((line): line is SaleLine => Boolean(line));
    if (lines.length) {
      for (const line of lines) concerns.push({
        id: `prep:stale:${line.id}`,
        kind: 'check',
        line,
        says: `${line.product.name} changed after it was picked. Look at it again.`,
      });
    } else {
      concerns.push({ id: 'prep:stale', kind: 'check', group: true, says: STALE_WORDS });
    }
  }

  const job = jobOf(sale);
  if (job?.id === 'answer' && !concerns.some((concern) => concern.kind === 'response')) {
    concerns.push({ id: `job:${job.policy}:answer:${job.says}`, kind: "response", says: job.says });
  }
  if (job?.id === 'check' && !concerns.some((concern) => concern.kind === 'check')) {
    concerns.push({ id: `job:${job.policy}:check:${job.says}`, kind: "check", group: true, says: job.says });
  }
  return concerns;
}

export function jobOf(sale: Sale, company?: Company): Job | null {
  /* NOTHING IS OWED, SO NOTHING IS ASKED. Canon §15.1's own reading, taken as a job: a document
     that has been dealt with draws no verb, and a card that has just settled off the pile says the
     settle and stops there — «every closed row shows zero verbs» (DENSE-BRIEF-DESIGN §1). It
     stands FIRST because a verdict outlives the work: `policyOf` still calls a settled stranger's
     order a HANDOFF, which is true of the document and says nothing about what is left to do. */
  if (nothingOwed(sale)) return null;
  const policy = policyOf(sale);
  /* AND NOTHING WAS HELD. §72.3's calm, read as a job: no verb, no card, no work. */
  if (policy.id === 'act') return null;

  /* COULD ROCOTO FORM IT? Every clause here is a fact on the document, and the first two are the
     guarantee: a draft with lines, and a reading that did not fail. `needsReply` and a complaint
     are the relational cases — words are owed, and a sheet is not where words are written. */
  const formed =
    sale.lines.length > 0 &&
    !readingFailed(sale) &&
    !sale.needsReply &&
    sale.state !== 'disputed' &&
    (policy.id === 'hold' || (policy.id === 'clarify' && clarifyAnswered(sale)));

  const id: JobId = formed ? 'check' : 'answer';
  /* WHO TAKES IT, BY NAME (§5.11). The topic is the verdict's; the person is the house's own
     routing; and a house whose named member has left falls to the first one on the roster, which
     is the same answer every other escalation reader gives. */
  const takes = !formed && policy.topic && company
    ? houseMemberOf(company, company.escalation[policy.topic]) ?? company.members[0]
    : undefined;

  return { id, verb: JOB_VERB[id], testid: JOB_TESTID[id], says: policy.says, who: takes?.name, policy: policy.id };
}

/* ── CO-PRESENCE: THE WITHHELD INTERPRETATION, OFFERED TO THE PERSON WRITING (§110 · §9.11) ────
 * «They need to answer a message themselves — which Rocoto will then monitor to learn, like a
 * co-present thing.»
 *
 * §9.11 built the abstention: Rocoto prepares an interpretation and does not send it. Until now
 * that sentence existed and no person could ever see it, which made the differentiator a fact
 * about the codebase rather than about the product. This is the ONE door it comes through, and it
 * opens onto the composer — the only place in the app where the person is writing the very
 * sentence Rocoto abstained from writing.
 *
 * IT IS OFFERED, NEVER IMPOSED (§83.2). This returns WORDS; the surface puts them on a control,
 * and only a press writes them into the field. Nothing here sends anything, and `withheld` is
 * still never appended to a thread — the composer is a field, and a field is not a channel.
 *
 * WHICH ONE, WHEN A CONVERSATION IS CARRYING SEVERAL. The job the composer is for comes first —
 * an ANSWER is the one being written — and a CHECK's withheld reading stands behind it, because
 * Rocoto abstained there too. A document Rocoto acted on carries no withheld anything, so it is
 * absent rather than empty (`preparedWords`' own rule, and the same calm §72.3 keeps).
 */
export type Ghost = {
  /** the document the interpretation is of */
  sale: string;
  /** the interpretation itself, exactly as §9.11 composed it */
  words: string;
};

export function ghostOf(sales: Sale[]): Ghost | null {
  const held = sales
    .map((sale) => ({ sale, words: policyOf(sale).withheld, job: jobOf(sale) }))
    .filter((r): r is { sale: Sale; words: string; job: Job } => Boolean(r.words && r.job));
  const one = held.find((r) => r.job.id === 'answer') ?? held[0];
  return one ? { sale: one.sale.id, words: one.words } : null;
}

/** THE FIRST CELL OF THE STATE ROW, AND THE RIVER'S ROW WORD (canon §15.1's seven-case table).
 *  The shortest true answer to «what does this want» — and where nothing wants anything, the last
 *  act that happened. Owed work stands in primary ink; the record steps back to tertiary. */
/* ── WHOSE HAND (§66.1, canon §6.1 cell 2) ───────────────────────────────────────────────────
 * «Once read, if they don't edit, that's down to them.» The transfer of responsibility is a
 * SENTENCE ABOUT AN EVENT — a human hand touched the goods on this document — so it is read off
 * the ledger like every other facet, and it is SILENT until one has: a row announcing «Rocoto's
 * numbers, unread» would be the software fretting out loud on a sheet the person is looking at.
 *
 * The kinds below are the ones a HAND produces. `commit`, `print`, `erp-send` and the rest are
 * acts UPON the document; these are acts that changed what is in the crate, which is the only
 * thing «edited» can honestly mean here.
 */
const HAND_KINDS: Array<SaleEvent['kind']> = [
  'line', 'add', 'remove', 'restore', 'amend', 'correct', 'unit-flip', 'adopt', 'lot', 'graduate',
];

/** the last hour a hand changed the goods on this document, where one has */
export const handAt = (sale: Sale): string | undefined =>
  HAND_KINDS.map((k) => sale.stamps[k]).filter(Boolean).sort().pop();

export type LiveReading = {
  /** the words themselves — never a category, never «Closed» */
  word: string;
  /** something is owed, so the document stands and the word takes primary ink */
  owed: boolean;
};

export function liveReadingOf(sale: Sale, today: string): LiveReading {
  const owed = owedOf(sale);
  /* THE ORDER IS THE ORDER OF CONSEQUENCE, and it never re-sorts: the eye returns to a place. */
  if (owed.resolution) return { word: 'Complaint', owed: true };
  if (owed.answer) return { word: reasonLabelOf(sale) ?? 'Your yes', owed: true };
  /* «CHANGED SINCE» IS THE LOUDEST READING THERE IS (§15.1) — the paper in the tray no longer
     describes the crate, and the hour is what tells a person how long that has been true. */
  if (owed.changed) return { word: `Changed ${sale.printed?.staleAt ?? sale.printed?.at ?? ''}`.trim(), owed: true };
  if (owed.system) return { word: `${sale.sentToErp?.target ?? 'Your system'} again`, owed: true };
  if (owed.paper) return { word: sale.day <= today ? 'Out today' : 'To print', owed: true };
  if (owed.pick) return { word: 'Pick changed', owed: true };
  /* NOTHING IS OWED, so the cell says the last act that happened. The goods leaving outranks the
     paper: once a crate is with the customer, where it got to is the record and the print is a
     hour in the stream (§6.1's «each says its record word and NOTHING ELSE competes»). */
  const gone = RECORD_WORD[sale.state];
  if (gone) return { word: gone, owed: false };
  const paper = sale.printed;
  if (paper) {
    return { word: paper.count > 1 ? `Printed ${paper.count}× · ${paper.at}` : `Printed ${paper.at}`, owed: false };
  }
  /* the goods went without paper ever coming out — true, and said as the stream's own last act */
  return { word: 'All settled', owed: false };
}

/* ── THE EXPORT STATES, ARCHITECTURALLY (FEED-IA §58.1, §58.4) ────────────────────────────────
 * «Print live on every state is not true. It shouldn't be always live lol. You gotta think about
 * these states architecturally, come on.»
 *
 * THE ARCHITECTURE WAS ALREADY IN THIS FILE, and only the sheet's dock was ignoring it. The
 * HOUSE-level press has obeyed it from the day it was written: `sheetSalesOf` puts paper only
 * behind what the house has COMMITTED to (`canPrepare`: «a request is not pickable — there is
 * nothing to pick until somebody has judged it»), and `exportState` holds the orders standing for
 * REVIEW out of every count (§35.3: «review items are OUTSIDE those counts»). The document's own
 * dock printed anything, at any hour, in any state — one law, two answers. That is the
 * inconsistency the founder read as an unarchitected button.
 *
 * SO ONE PREDICATE ANSWERS BOTH, and the dock is now the same law seen at document scale:
 *
 *   UNCONFIRMED (`request`)   HELD. Nobody has promised these goods; paper would state a promise
 *                             the house has not made. The act that opens it is the confirm.
 *   FOR REVIEW (standing)     HELD. Something on it is still owed an answer — an unreadable line,
 *                             a word off the catalogue, a complaint. Paper here is a wrong crate,
 *                             and it is exactly what the day's press already refuses to print.
 *   EVERYTHING ELSE           LIVE — «Print it», or «Print it again» once paper exists.
 *
 * THE PREVIEW IS NEVER HELD. Looking at the paper is not exporting it, so the eye stands on every
 * state — nothing on this surface is ever unreachable, which is what keeps a held act from reading
 * as a locked door.
 *
 * AND WHAT LEADS IS WHAT THE STATE OWES NEXT (§58.4: «minimal time until they simply trust
 * Rocoto»). The loudest control on the dock is not fixed to the statechart's verb: on an OPEN
 * albarán the work is locking it, so the verb leads; on a LOCKED one the work is getting it out of
 * the house, so THE HOUSE'S OWN RAIL leads — the ERP where the house has connected one («some
 * companies wanna just print, others wanna just send to ERP»), the paper otherwise. A dock whose
 * loudest button is always the next thing to do cannot read as one act gating another (§54.2),
 * because on the state where the paper is the work, the paper IS the main button.
 */

/** What the export rails may do to ONE document, and which of them the house leads with. */
export type ExportStance = {
  /** the paper: live, or held with the one act that opens it */
  paper: { live: boolean; again: boolean; because?: string };
  /** the house's own system, present only where it is connected and this document is owed to it */
  erp: { name: string } | null;
  /** the loudest control: the statechart's own verb, or the rail the house leads with */
  lead: 'verb' | 'paper' | 'erp';
};

/** THE WINDOW IN WHICH A DOCUMENT IS THE BAY'S AND THE PAPER'S BUSINESS (§21, widened by §66.1).
 *  It used to open at `made`, because paper followed the lock. Locking is dead — «nothing waits
 *  for a blessing» — so it opens the moment the house has committed to the goods. */
const inTheHouse = (sale: Sale): boolean =>
  RANK[sale.state] >= RANK.committed && RANK[sale.state] < RANK.sent;

export function exportStance(sale: Sale, today: string, world: RailWorld): ExportStance {
  /* THE HELD STATE IS SAID ON THE CONTROL, NOT UNDER IT (§59.1, §59.2). A sentence stacked
     beneath the dock explaining a grey button is the long text §59 bans and the second storey
     §61 calls stress; three words IN the control's own seat say the same thing, cost no row, and
     name the very act standing loud beside them. */
  const because =
    sale.state === 'request' ? 'Print after confirming'
      : isStanding(sale, today) ? 'Print after resolving'
        : undefined;
  const paper = { live: !because, again: Boolean(sale.printed), because };
  const erp = !because && world.erp.connected && wantsErp(sale) ? { name: world.erp.name } : null;
  /* the rails lead only while the document is IN THE HOUSE and one of them is actually owed
     something — a locked albarán with its paper out and its ERP fed is asking for the send, and
     that is the statechart's own verb again */
  const rails = paper.live && inTheHouse(sale) && (wantsPaper(sale) || erp !== null);
  return { paper, erp, lead: !rails ? 'verb' : erp ? 'erp' : 'paper' };
}

/** The record's own nouns, for the sales that have already left the house. A document with nothing
 *  owed that has gone out says where it got to; one still in the bay says the paper it has. */
const RECORD_WORD: Partial<Record<SaleState, string>> = {
  sent: 'Sent',
  delivered: 'Delivered',
  settled: 'Settled',
};

/** How a row stands, as the three facts a row draws with: the word it says, whether it lies flat,
 *  and whether its day has come. Computed in one place so the river and the prep list can never
 *  disagree about which of their rows are still owed.
 *
 *  THE WORD IS THE LIVE READING NOW (canon §15.1). «Open» and «Closed» are gone from it: a row
 *  says what it WANTS — «Out today», «Changed 10:40», «Sage 50 again» — or, wanting nothing, the
 *  last act that happened. The field is still called `closed` because three surfaces outside this
 *  package read it as «lies flat»; what it MEANS is `nothingOwed`, and the name goes with them. */
export type RowStanding = {
  /** the small word under the figure — the live reading, in the reading's own words */
  word: string;
  /** nothing is owed: it lies flat as record */
  closed: boolean;
  /** something is owed and its day has come — the day presses (§21) */
  presses: boolean;
  /** the paper exists, so the ⎙ mark rides beside the word */
  printed: boolean;
};

/* ── THE RIVER'S OWN READING — THE RAILS, NEVER THE REASON (§67.6, §25.5) ─────────────────────
 * THE SHEET and THE RIVER divide one reading between two seats, and the division is the whole of
 * why neither of them says a fact twice:
 *
 *   THE SHEET'S STATE ROW   has ONE cell for the whole reading, so cell 1 carries the reason in
 *                           the reason's own words when a reason is what the document owes
 *                           (canon §6.1, §15.1's table). `liveReadingOf`.
 *   THE RIVER'S ROW         has TWO seats — the LABEL on the fact line and the WORD under the
 *                           figure — so the reason goes to the label (§67.6) and the word is left
 *                           to say what the RAILS want. `rowReadingOf`.
 *
 * A row that printed «Bigger than usual» in both seats, an inch apart, is exactly the label
 * repeating what position already says (§25.5) — and it was the first thing wrong with the river
 * once the band's card and the standing row became one object.
 *
 * WHERE NO RAIL WANTS ANYTHING AND A REASON STILL DOES, the word says what the DAY says and
 * nothing more: «Out today» while the day presses, and silence while it does not. The label is
 * already carrying the message, and a second word for it would be the preamble §51.24 bans.
 */
export function rowReadingOf(sale: Sale, today: string): LiveReading {
  const owed = owedOf(sale);
  if (owed.changed) return { word: `Changed ${sale.printed?.staleAt ?? sale.printed?.at ?? ''}`.trim(), owed: true };
  if (owed.system) return { word: `${sale.sentToErp?.target ?? 'Your system'} again`, owed: true };
  if (owed.paper) return { word: sale.day <= today ? 'Out today' : 'To print', owed: true };
  if (owed.answer || owed.pick || owed.resolution) {
    return { word: sale.day <= today ? 'Out today' : '', owed: true };
  }
  const gone = RECORD_WORD[sale.state];
  if (gone) return { word: gone, owed: false };
  const paper = sale.printed;
  if (paper) {
    return { word: paper.count > 1 ? `Printed ${paper.count}× · ${paper.at}` : `Printed ${paper.at}`, owed: false };
  }
  return { word: 'All settled', owed: false };
}

export function rowStanding(sale: Sale, today: string): RowStanding {
  const reading = rowReadingOf(sale, today);
  return {
    word: reading.word,
    closed: !reading.owed,
    presses: reading.owed && sale.day <= today,
    printed: Boolean(sale.printed),
  };
}

/* ── THE TRUCK RIDES THE CARD (FEED-IA §21) ───────────────────────────────────────────────────
 * «Houses run trucks per area: the main cards carry a little truck icon + its number (1… 12) /
 * region name.» The pair is read off the customer, where the round is already seeded for the
 * detail's map, so the feed row, the prep row and the map all name ONE round.
 */

export type Round = { truck: number; zone: string };

export const roundOf = (sale: Sale): Round | null => {
  const { truck, zone } = sale.customer;
  return truck === undefined || !zone ? null : { truck, zone };
};

/** «Truck 2 runs litoral» — what the chip means, said in full for a screen reader. */
export const roundWords = (round: Round): string => `Truck ${round.truck} runs ${round.zone}`;

/* ── THE VERBS ────────────────────────────────────────────────────────────────────────────────
 * Every one of them is an append to the ledger, and the two that reach the older store write it
 * in the same breath — so a commit here is a confirm there, and a made albarán moves the strip.
 */

/** Most legacy acts remain fire-and-forget UI events. The two customer-output actions below use
 * `appendPersisted` so their copy never reports an approval that failed to save. */
const append = (e: SaleEvent): void => { setDay((prev) => ({ events: [...prev.events, e] })); };
const appendPersisted = (e: SaleEvent): boolean => setDay((prev) => ({ events: [...prev.events, e] }));

/** AN ORDER ARRIVES (FEED-IA §26.6). The one act in this file whose subject comes from OUTSIDE the
 *  house: a customer sent something and it landed. It is here because the prototype has no outside
 *  — nothing can reach it over a wire — and «processing overlaps ordering» is a claim that can only
 *  be judged with a row actually landing under an open document. The river reads it like any other
 *  sale, which is the whole of the point: an arrival is not a mode, a refresh, or a notification. */
/* ── THE COMPOSER'S ONE ACT (FEED-IA §66.3) ───────────────────────────────────────────────────
 * «When they first land on orders I want the default to be for them to make a NEW albarán… it
 * cleanly gives us a landing spot when they first click on it.»
 *
 * ONE WRITE, AND THE SHEET TAKES OVER. This mints the document; everything after it — the goods,
 * the amounts, the words that ride them — is the sheet's own add-a-line, which is the chip organ.
 * The composer therefore owns exactly two decisions (WHOSE and WHICH DAY) and hands the rest to
 * the instrument the whole app already uses.
 *
 * It returns the id so the surface that pressed it can open what it just made — the same move the
 * arrival's tap-through makes, and the reason the landing spot is never a placeholder. */
export const newSaleId = (): string => `new${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function newSale(customer: string | undefined, offset: number, at: string, reservedId?: string): string {
  const id = reservedId || newSaleId();
  setDay((prev) => ({ events: [...prev.events, { kind: 'new', sale: id, at, customer, offset }] }));
  return id;
}

/** WHOSE IT IS, TYPED AND THEN PICKED (§74.2). `said` is what is in the field at this moment and
 *  `customer` is the row it landed on, where it has landed on one — so a draft remembers the
 *  half-word as faithfully as it remembers the choice. */
export const nameDraft = (sale: string, at: string, said: string, customer?: string): void =>
  append({ kind: 'draft-name', sale, at, said, customer });

/** WHICH DAY, EDITED IN THE HEAD'S OWN FOR-LINE (§74.3) — never a form row. */
export const dayDraft = (sale: string, at: string, offset: number): void =>
  append({ kind: 'draft-day', sale, at, offset });

/** HAS ANYBODY GIVEN THIS DOCUMENT A DAY? (§86.4.) The document always HAS one — it opens on
 *  today, because goods go out on some day — and a default is not a statement. The stamp is the
 *  difference, and it is read here so no surface has to keep the answer itself. */
export const dayGiven = (sale: Sale | null | undefined): boolean => Boolean(sale?.stamps['draft-day']);

/** THE PRESS (§86.4b: «one press to accept»). Idempotent — taking an offer twice is taking it,
 *  and the fold reads the first stamp either way. */
export const takeSlot = (sale: string, at: string): void =>
  append({ kind: 'slot-taken', sale, at });

/** …and whether this document has taken it. Before the press the surface offers the account's
 *  hour; after it, the document states it as its own. */
export const slotTaken = (sale: Sale): boolean => Boolean(sale.stamps['slot-taken']);

export function arriveSale(cast: Cast, offset: number, at: string): void {
  setDay((prev) => {
    const n = prev.events.filter((e) => e.kind === 'arrive').length;
    const customer = cast.customers[n % cast.customers.length];
    return {
      events: [
        ...prev.events,
        { kind: 'arrive', sale: `arr${n + 1}`, at, customer: customer.id, offset, take: 2 },
      ],
    };
  });
}

export function commitSale(sale: Sale, at: string, over?: string[]): void {
  setDay((prev) => ({
    events: [...prev.events, { kind: 'commit', sale: sale.id, at, over }],
    confirmed: sale.orderId ? withId(prev.confirmed, sale.orderId) : prev.confirmed,
    surfaced: sale.orderId ? withId(prev.surfaced, sale.orderId) : prev.surfaced,
  }));
}

/** MAKE RECORDS REALITY. The weighed lines the person has left alone take the scale's own number
 *  in the same act, because that is what «the albarán has the actual weight of what was given»
 *  means — the document starts at done and the person edits what reality changed. */
export function makeSale(sale: Sale, at: string, over?: string[]): void {
  const weights: SaleEvent[] = sale.lines
    .map((l, i) => ({ l, i }))
    /* a line the message never carried an amount for gets no scale reading either: the app has
       nothing to weigh against, and inventing one is exactly the guess the guard warned about */
    .filter(({ l }) => l.weighed && !l.unreadable && l.given === l.ordered)
    .map(({ l, i }) => ({ kind: 'line' as const, sale: sale.id, at, line: l.id, given: scaleReading(l, i) }));

  setDay((prev) => ({
    events: [...prev.events, { kind: 'make', sale: sale.id, at, over }, ...weights],
    confirmed: sale.orderId ? withId(prev.confirmed, sale.orderId) : prev.confirmed,
    surfaced: sale.orderId ? withId(prev.surfaced, sale.orderId) : prev.surfaced,
    /* the document exists, so the strip at the top of the page carries it as released */
    released: withId(prev.released, sale.number),
  }));
}

export const scheduleSale = (sale: Sale, at: string): void =>
  append({ kind: 'schedule', sale: sale.id, at, window: sale.window });

export const cancelSend = (sale: Sale, at: string): void =>
  append({ kind: 'cancel', sale: sale.id, at });

/** Archive preserves the document; the existing reversible event action provides Undo. */
export const archiveSale = (sale: Sale, at: string, by = loadConfig().owner.name): void =>
  append({ kind: 'archive', sale: sale.id, at, by });

/** Compatibility for older call sites; new actions always record an archive. */
export const deleteSale = archiveSale;

export const sendSale = (sale: Sale, at: string): void =>
  append({ kind: 'send', sale: sale.id, at });

export const deliverSale = (sale: Sale, at: string): void =>
  append({ kind: 'deliver', sale: sale.id, at, recordedAt: new Date().toISOString() });

export const declineSale = (sale: Sale, at: string, because: string): void =>
  append({ kind: 'decline', sale: sale.id, at, because });

export const settleSale = (sale: Sale, at: string): void =>
  append({ kind: 'settle', sale: sale.id, at });

export const resolveSale = (sale: Sale, at: string, outcome: string): void =>
  append({ kind: 'resolve', sale: sale.id, at, outcome });

/** THE PAPER COMES OUT, AND THE MONEY STOPS MOVING (FEED-IA §32). The print carries the prices it
 *  printed, so tomorrow's sheet can move every open albarán in the house and never touch this one.
 *  Quantity was promised at confirm; this is the other half of the same law. */
export type PrintSaleEvidence = { revision: string; materialCursor: number; requestedAt: string; requestedBy: string; confirmedAt: string; confirmedBy: string; attemptId?: string };
export type CapturedPrintSale = PrintSaleEvidence & { sale: string; at: string; prices: Record<string, number> };

/** Persist the generated paper facts captured at request time. This is deliberately enough to
 * recover an albarán confirmation after a reload without re-reading an edited live sale. */
export const printCapturedSale = (captured: CapturedPrintSale): boolean => {
  /* The queue may have saved the ledger before its own browser journal write failed. A retry
   * acknowledges that same durable attempt instead of appending a second physical-print claim. */
  if (captured.attemptId && dayNow().events.some((event) => event.kind === 'print' && event.attemptId === captured.attemptId)) return true;
  return appendPersisted({ kind: 'print', ...captured });
};

/** Persist exactly the already-rendered sale snapshot. A later edit remains stale; it never rewrites this paper's prices. */
export const printSale = (sale: Sale, at: string, evidence: PrintSaleEvidence): boolean =>
  printCapturedSale({
    sale: sale.id,
    at,
    prices: Object.fromEntries(sale.lines.map((l) => [l.id, l.price])),
    ...evidence,
  });

/* ── THE OTHER TWO ROADS, TAKEN (FEED-IA §35.3) ───────────────────────────────────────────────
 * Both are appends like every other act on the object. The ERP send is a PERSON'S press only where
 * a person presses it — the seeded morning's sends are the connection doing its own job — and the
 * schedule is written the moment the document is finished, which is why the print queue writes it
 * in the same breath as the paper (§20: «the send rails ride the same act»).
 */

export const sendToErp = (sale: Sale, at: string, target: string): void =>
  append({ kind: 'erp-send', sale: sale.id, at, target });

/** THE WHOLE FILE, IN ONE WRITE. A day's send is one act, so it is one append and one render —
 *  the same lesson `enqueueAll` learned on the printer at three hundred albaranes. */
export function sendAllToErp(sales: Sale[], at: string, target: string): void {
  if (sales.length === 0) return;
  setDay((prev) => ({
    events: [
      ...prev.events,
      ...sales.map((s) => ({ kind: 'erp-send' as const, sale: s.id, at, target })),
    ],
  }));
}

export const scheduleEmail = (sale: Sale, at: string, sendAt: string): void =>
  append({ kind: 'email-schedule', sale: sale.id, at, sendAt });

export const markEmailSent = (sale: Sale, at: string): void =>
  append({ kind: 'email-sent', sale: sale.id, at });

/* ── THE TARIFA, ON THIS DOCUMENT (§A.11) ─────────────────────────────────────────────────────
 * «The albarán can switch tier on the fly.» One event, one document: the customer's standing band
 * stays exactly where it is, the lines that a hand priced hold their numbers, and the rest re-price
 * off the band's own sheet. Switching back is the same act with the other band.
 */

export const setSaleTier = (sale: Sale, at: string, tier: string): void =>
  append({ kind: 'tier', sale: sale.id, at, tier });

/* ── MARK PAID (Musing 4) ─────────────────────────────────────────────────────────────────────
 * «Payment must be TRACKABLE: a Mark paid act on mobile AND desktop — a whole thing.» It is one
 * event like every other act on the object, so the money lands in the sale's own history rather
 * than in a ledger beside it, and the method arrives pre-filled from how this customer settles.
 */

/** How this customer usually pays, so the commonest case is one tap. */
export const payMethodOf = (sale: Sale): PayMethod =>
  sale.customer.settles === 'cash on delivery' ? 'cash' : 'transfer';

export const markPaid = (sale: Sale, at: string, how?: PayMethod, by?: string): void =>
  append({ kind: 'pay', sale: sale.id, at, how: how ?? payMethodOf(sale), by });

/** THE DAY'S SHEET WENT TO THE PRINTER. It belongs to the round rather than to any one albarán,
 *  so it rides the day and the per-sale fold passes over it. */
export const printDay = (day: string, at: string): boolean =>
  appendPersisted({ kind: 'print-day', at, day });

/** How many times the day's own sheet has gone out. */
export const dayPrints = (events: SaleEvent[], day: string): SaleEvent[] =>
  events.filter((e) => e.kind === 'print-day' && e.day === day);

/* ── THE TICK (FEED-IA §7.2) ──────────────────────────────────────────────────────────────────
 * «Preparing IS ticking off. The day view's minimal action is the tick — a satisfying check per
 * order (and per line inside).» Four verbs, because both directions have to be as easy as each
 * other: a tick nobody can take back is a tick people stop trusting.
 */

export const prepareSale = (sale: Sale, at: string): void =>
  append({ kind: 'prepare', sale: sale.id, at });

export const unprepareSale = (sale: Sale, at: string): void =>
  append({ kind: 'unprepare', sale: sale.id, at });

export const prepareLine = (sale: Sale, at: string, line: string): void =>
  append({ kind: 'prepare-line', sale: sale.id, at, line });

export const unprepareLine = (sale: Sale, at: string, line: string): void =>
  append({ kind: 'unprepare-line', sale: sale.id, at, line });

/* ── A LINE COMES OFF, AND COMES BACK ─────────────────────────────────────────────────────────
 * Removal is append-only like every other act, so the albarán can say what came off it and when —
 * and the undo is an event of its own rather than a rubbed-out one.
 */

export const removeLine = (sale: Sale, at: string, line: string): void =>
  append({ kind: 'remove', sale: sale.id, at, line });

export const restoreLine = (sale: Sale, at: string, line: string): void =>
  append({ kind: 'restore', sale: sale.id, at, line });

/** The trade's own word, put on the line by hand (THE-INTELLIGENCE §2). An empty word removes it. */
export const amendLine = (sale: Sale, at: string, line: string, word: string): void =>
  append({ kind: 'amend', sale: sale.id, at, line, word });

/** THE HOUR A REPLY CARRIES — the chat door's clock rule, said for the sale door too. A reply is
 *  the newest thing anybody has said in THIS sale's thread, so stamping it with `nowOf` (07:20 on
 *  the fish cast) under a 16:25 message would file the answer BEFORE its question. It takes the
 *  app's hour when that is already latest, and otherwise a minute past the thread's latest turn. */
export const saleReplyHour = (sale: Sale, now: string): string => {
  const minutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const latest = sale.thread.reduce((top, row) => Math.max(top, minutes(row.time ?? '00:00')), -1);
  const here = minutes(now);
  return here > latest ? now : clockAfter(now, latest + 1 - here);
};

export const replySale = (sale: Sale, at: string, text: string): void =>
  append({ kind: 'reply', sale: sale.id, at, text });

/** THEY CHOSE TO LET ROCOTO SAY IT. The sentence is composed from what they just supplied, and it
 *  goes out under Rocoto's own mark — the correction is what re-armed it. */
export const answerSale = (sale: Sale, at: string, text: string): void =>
  append({ kind: 'answer', sale: sale.id, at, text });

export const saveLineEdit = (
  sale: Sale,
  at: string,
  line: string,
  /* ⚠ NO `klass` (FEED-IA §197.2): the write path for a grade is closed. The EVENT type still
     carries the field so an old stored ledger folds, and nothing can put a new one on a line. */
  patch: { given?: number; unit?: string; unitFactor?: number | null; dimensions?: LineDimensions; finalWeight?: number; price?: number },
): boolean => {
  const current = sale.lines.find((candidate) => candidate.id === line);
  if (!current) return false;
  if (patch.unitFactor !== undefined && patch.unitFactor !== null && (!Number.isFinite(patch.unitFactor) || patch.unitFactor <= 0)) return false;
  const unitFactor = patch.unitFactor !== undefined ? patch.unitFactor : patch.unit !== undefined
    ? patch.unit === current.unit && current.unitFactor !== undefined ? current.unitFactor
      : declaredUnitFactor(loadConfig().cast, current.product, patch.unit)
    : undefined;
  return appendPersisted({ kind: 'line', sale: sale.id, at, line, ...patch,
    ...(patch.unit !== undefined ? { unitFactor } : {}) });
};

export const editLine = (...args: Parameters<typeof saveLineEdit>): void => { saveLineEdit(...args); };

/** ONE DIMENSION, PUT ON THE LINE (§41.1). It is `editLine` with one field in the patch — stated as
 *  its own verb because it is its own act, and named so a surface never assembles the patch by hand. */
export const setDimension = (sale: Sale, at: string, line: string, id: DimensionId, word: string): void =>
  editLine(sale, at, line, { dimensions: { [id]: word } });

/**
 * THE FINAL WEIGHT, PUT ON THE LINE (§41.3).
 *
 * «Some houses weigh everything, some accept losses/gains, some machine-weigh.» On a KILO line the
 * amount IS the weight, so the number lands on `given` and the row keeps one number; on a counted
 * line — four boxes — the weight is a SECOND fact and lands beside the count. One verb, because to
 * the person it is one act, and the difference is arithmetic rather than intent.
 */
export const putFinalWeight = (sale: Sale, at: string, line: SaleLine, kilos: number): void =>
  editLine(sale, at, line.id, line.unit === WEIGHT ? { given: kilos } : { finalWeight: kilos });

/** The line-level answer to a word the catalogue has no row for. It is the same act either way —
 *  one event on the sale — and the difference is only where the word ends up living. */
export const adoptLine = (sale: Sale, at: string, line: string, how: NonSkuResolution): void =>
  append({ kind: 'adopt', sale: sale.id, at, line, how });

/* ── THE THREE ACTS ON ROCOTO'S OWN WORK (THE-INTELLIGENCE §1, §2, §3) ────────────────────────
 * «Accepting is nothing — confirm the albarán. Correcting the line IS the training signal.» So
 * these three are the only feedback the product has, and each of them is a thing a person was
 * going to do anyway: put the right word on a line, give an amount in the unit they actually use,
 * and let a habit become a product. There is no thumb anywhere in this file.
 */

/** They put the customer's own word back on the line. */
export const correctFill = (sale: Sale, at: string, line: SaleLine): void =>
  append({
    kind: 'correct',
    sale: sale.id,
    at,
    line: line.id,
    asked: line.asked ?? '',
    filled: line.product.name,
  });

/** A person resolves a plural reading by choosing one existing SKU. This changes this line only;
 * the source wording stays on the event and no catalogue record is created or modified. */
export const chooseLineSku = (sale: Sale, at: string, line: SaleLine, product: Product): void => {
  if (!line.asked || line.corrected || line.skuChosen) return;
  append({ kind: 'choose-sku', sale: sale.id, at, line: line.id, product: product.id,
    asked: line.asked, from: line.product.id });
};

/** A person says that none of the real SKU candidates fits. The source wording becomes a
 * provisional one-off on this order only; it does not mint, rename or relate a catalogue SKU. */
export const rejectLineSkuChoices = (sale: Sale, at: string, line: SaleLine): void => {
  if (!line.asked || line.corrected || line.skuChosen || line.nonSku) return;
  append({ kind: 'choose-sku-none', sale: sale.id, at, line: line.id, asked: line.asked,
    from: line.product.id });
};

/** Capture the conversion now so future settings cannot rewrite this order's quantities. */
export const flipUnit = (sale: Sale, at: string, line: SaleLine, to: string): void => {
  const sector = loadConfig().cast;
  const fromFactor = line.unitFactor !== undefined ? line.unitFactor
    : declaredUnitFactor(sector, line.product, line.unit);
  const toFactor = declaredUnitFactor(sector, line.product, to);
  append({ kind: 'unit-flip', sale: sale.id, at, line: line.id, from: line.unit, to,
    fromFactor, toFactor });
};

/** The habit becomes a product. RECORDING IT IS THIS FILE'S WHOLE JOB — the catalogue row itself
 *  is Stock's to grow, and an albarán that pretended to write one would be lying about a shelf. */
export const graduateAmendment = (sale: Sale, at: string, line: SaleLine): void =>
  append({
    kind: 'graduate',
    sale: sale.id,
    at,
    line: line.id,
    base: line.product.id,
    amendment: line.amendment ?? '',
  });

/** ATTACHING IS THE PERSON'S ACT (THE-APP-V2 §5.7). Rocoto proposes in saffron; this is the ink.
 *  Every line goes in one write, so one tap on «Attach all» is one moment in the history. */
export function attachLots(sale: Sale, at: string, picks: AllocationPick[]): boolean {
  if (picks.length === 0) return true;
  return setDay((prev) => ({
    events: [
      ...prev.events,
      ...picks.map((p) => ({
        kind: 'lot' as const, sale: sale.id, at, line: p.line, allocations: p.allocations,
        overrideReason: p.overrideReason?.trim() || undefined, stockRevision: p.stockRevision,
      })),
    ],
  }));
}

export const addLine = (
  sale: Sale,
  at: string,
  product: Product,
  qty: number,
  unit: string,
  price: number,
  /** §80 — the word that was said, where the house sells several forms of it. It makes the line
   *  wear the fill reading it already has a grammar for; a plain resolution passes nothing. */
  asked?: string,
): void =>
  append({
    kind: 'add',
    sale: sale.id,
    at,
    line: `x${sale.lines.length + 1}`,
    product: product.id,
    qty,
    unit,
    price,
    ...(asked ? { asked } : null),
  });

/** THE SAME ACT, FROM A WORD (THE-DENSE-BRIEF-DESIGN §10, the house posture). A house that sells
 *  one-offs puts the market's own word on the albarán and gives it its price; the line that comes
 *  out is the off-catalogue shape, so it can be adopted into the catalogue later exactly as an
 *  arriving off-catalogue line can. Only the `assortment` grant opens this door — a catalogue
 *  house's albarán may only carry things the house sells. */
export const addBareLine = (
  sale: Sale,
  at: string,
  word: string,
  qty: number,
  unit: string,
  price: number,
): void =>
  append({
    kind: 'add',
    sale: sale.id,
    at,
    line: `x${sale.lines.length + 1}`,
    word: word.trim(),
    qty,
    unit,
    price,
  });

/** HOW THIS LINE LEAVES THE HOUSE — the bench's instruction, written on the line. An empty note is
 *  the same act, and takes it back to silence. */
export const noteLine = (sale: Sale, at: string, line: string, note: string, by?: string): boolean => {
  const text = note.trim();
  const product = sale.lines.find((candidate) => candidate.id === line)?.product.id;
  return appendPersisted({ kind: 'prep-note', sale: sale.id, at, line, note: text, by, product, customer: sale.customer.id, recordedAt: new Date().toISOString() });
};

/** Normalization is centralised in `customer-option.ts` so every outward-facing caller gets
 * the same strict no-fallback rule without importing this sale module. */
const customerOptionSnapshot = (value: CustomerOption | undefined): CustomerOption | undefined => approvedCustomerOption(value);

/** Records an explicit customer-visible line option. A false result means nothing was appended. */
export function approveCustomerOption(sale: Sale, at: string, line: string, option: CustomerOption): boolean {
  const accepted = customerOptionSnapshot(option);
  if (!accepted || !sale.lines.some((candidate) => candidate.id === line)) return false;
  return appendPersisted({ kind: 'customer-option', sale: sale.id, at, line, action: 'approve', option: accepted, by: accepted.approvedBy });
}

/** An operator-authored delivery-note instruction is its own reviewed evidence, not a team comment. */
export function saveCustomerLineNote(sale: Sale, at: string, line: string, text: string, by: string): boolean {
  const wording = text.trim();
  if (!wording) return clearCustomerOption(sale, at, line, by);
  const evidenceId = `line-note:${crypto.randomUUID()}`;
  const option = approvedCustomerOption({ text: wording, audience: 'customer', status: 'approved',
    reviewId: evidenceId, sourceEventIds: [evidenceId], approvedBy: by, approvedAt: new Date().toISOString() });
  if (!option || !sale.lines.some(candidate => candidate.id === line)) return false;
  return appendPersisted({ kind: 'customer-option', evidenceId, sale: sale.id, at, line, action: 'approve', option, by });
}

/** Removing customer wording is explicit and preserves the prior approval in the event ledger. */
export function clearCustomerOption(sale: Sale, at: string, line: string, by: string): boolean {
  if (!by.trim() || !sale.lines.some((candidate) => candidate.id === line)) return false;
  return appendPersisted({ kind: 'customer-option', sale: sale.id, at, line, action: 'clear', by: by.trim() });
}

/* ── WHAT ROCOTO FLAGGED (THE-APP-V2 §1.5) ────────────────────────────────────────────────────
 * THE LAW RECONCILIATION, mechanically. The standing colour law says colour is never a status
 * system, and saffron marks the AI's OWN ACT. A «needs a look» flag IS the AI's act — it read the
 * message and said so — so the chip carries the saffron identity mark and WORDS, and every other
 * mark on the card stays ink. No red, no amber, no green: the flag is a sentence, not a colour.
 *
 * A flag is DERIVED, never stored. Edit the raised line down and the flag goes; put an amount on
 * the unreadable line and it goes. Nothing here can be dismissed, because a flag a person can wave
 * away is a flag that stops meaning anything by Thursday.
 */

export type FlagKind = 'unusual' | 'unreadable' | 'big';

export type Flag = {
  id: string;
  kind: FlagKind;
  line: SaleLine;
  /** how many times this customer's usual amount the line asks for */
  times?: number;
  /** what the whole order comes to, where the flag is about the order and not about a line */
  amount?: number;
};

/**
 * THE TWO SIZES A PERSON HANDS ROCOTO (THE-INTELLIGENCE §11).
 *
 * «The settings teach Rocoto WHAT THE COMPANY HANDLES — typical and maximum order sizes — so
 * auto-confirmation is confident from day one.» Both live in `grants.ts` as editable facts, and
 * both are read here:
 *
 *   · `upTo`    how far past a customer's OWN usual a line may go. The finger slip this catches is
 *               the 12 that arrives as 120, and the words state the real multiple either way.
 *   · `ceiling` how much one order may come to. It is a fact about the ORDER rather than a line,
 *               so it is stated once and names the biggest line, which is where the money is.
 *
 * Neither of them is a severity and neither of them stores anything: raise the grant and the flag
 * is gone on the next read, exactly as editing the line down clears it.
 */
/* ── THE JUDGING HAPPENS AT THE CONFIRM NOW, BECAUSE LOCKING DIED (§66.1, §67.6) ──────────────
 * THE DEFECT THIS FIXES, caught by driving the flow rather than by reading it. This function
 * always said what it meant — «a flag is a reading of an order STILL BEING JUDGED; once the
 * albarán exists, the judging happened» — and it tested that with `isPending`, which is «not yet
 * MADE». That was true while a person pressed «Lock it»: confirming moved a request to
 * `committed`, and the lock a screen later moved it to `made` and cleared the flags.
 *
 * §66.1 KILLED THE LOCK AND NOTHING TOOK OVER THE CLEARING. `primaryOf` returns null on a
 * committed document — «a committed albarán asks for NOTHING» — so `made` is no longer an act any
 * hand performs, so `isPending` never goes false, so a flagged order stood in the flow FOREVER.
 * Confirming it changed its state and changed nothing a person could see: the row kept its label,
 * kept its raised altitude, and the pane never advanced. That is §67.6's whole promise failing —
 * «the pile empties honestly» — and §61.2's «piles visibly shrink» with it.
 *
 * SO THE TEST BECOMES THE ONE §66 LEFT STANDING: a `request` is «the net caught something» and a
 * `committed` document is «the ordinary living document» (canon §2.2). Committing IS the judging.
 *
 * AND THE TWO KINDS OF FLAG PART COMPANY HERE, which is the precise half of this:
 *   A JUDGMENT — «bigger than usual», «over your ceiling» — asks a QUESTION, and the confirm is
 *     the answer. It clears, because it has been answered.
 *   A MISSING FACT — an unreadable amount — asks for a NUMBER, and a confirm does not supply one.
 *     It survives every state until the amount is on the line, which is exactly canon §2.4's one
 *     hold: «the crate is undetermined».
 * A ceiling lowered this afternoon therefore still asks its question of the orders still on the
 * table, and still says nothing about the ones already judged.
 */
export function flagsOf(sale: Sale): Flag[] {
  /* once the goods have left the desk the document is record, and record is not re-judged */
  if (RANK[sale.state] >= RANK.made) return [];
  /* a hand confirmed it, or the machine did (§6.2's inversion) — either way it has been judged */
  const judged = sale.state !== 'request';
  const g = grantsNow();
  const out: Flag[] = [];
  sale.lines.forEach((l) => {
    if (!judged && l.usual && l.usual > 0 && l.given / l.usual > g.upTo) {
      out.push({ id: `unusual-${l.id}`, kind: 'unusual', line: l, times: Math.round(l.given / l.usual) });
    }
    /* THE MISSING NUMBER OUTLIVES THE CONFIRM. Nothing about saying yes to an order puts a weight
       on a line that arrived without one, so this flag is not a judgment and does not clear. */
    if (l.unreadable) out.push({ id: `unreadable-${l.id}`, kind: 'unreadable', line: l });
  });
  if (!judged && sale.figure > g.ceiling && sale.lines.length > 0) {
    const biggest = [...sale.lines].sort((a, b) => b.given * b.price - a.given * a.price)[0];
    out.push({ id: `big-${sale.id}`, kind: 'big', line: biggest, amount: sale.figure });
  }
  return out;
}

/** THE FLAG'S WORDS — SUBTLE (THE-APP-V2 §5.5). «The fishy order label is just a subtle thing —
 *  maybe the text is coloured, or shows an icon to make sure they double-check it.» So a flag is a
 *  short ink clause with a small saffron mark beside it, and never a chip that shouts. The multiple
 *  is COMPUTED from the line, so the words state a number the person can go and check.
 *
 *  AND IT SAYS WHAT IS, NEVER WHAT IS MISSING. «One line unreadable» spends its whole clause on
 *  the software's difficulty; «Pulpo needs its amount» names the product and the one thing to do
 *  about it, which is what the person is actually being asked for. */
export const flagText = (flag: Flag): string =>
  flag.kind === 'unusual'
    ? `check the quantity · ${flag.times}× their usual`
    : flag.kind === 'big'
      ? `${soles(flag.amount ?? 0)} · over the ceiling you set`
      : `${flag.line.product.name} needs its amount`;

/** THE SAME FLAG, SAID AS A CONFIRMATION (THE-INTELLIGENCE §11). On the LINE the flag states the
 *  fact, because that is what a person standing over the line needs. On the standing CARD it says
 *  what Rocoto needs in order to close the loop with the customer — «review exists so Rocoto can
 *  confirm» — and never «pending», which is bureaucracy describing itself. */
/* ── THE USUAL AND THE ASK, BOTH STATED (THE CHECKPOINT §14.3·i · MAP 14.3·i) ─────────────────
 * Peter's own sentence: «Unusual quantity — usually 3–5 boxes; order says 40.» The axis was built
 * and it stated the MULTIPLE — «12× their usual» — which is the ratio without either of the two
 * numbers a person actually checks. Both are on the line already: `usual` is what the day's plan
 * says this customer takes, `given` is what this one asks for, and `unit` is the word they are in.
 *
 * IT IS TWO NUMBERS AND NOT A RANGE, because a range is not on the line. `knows.ts`'s rhythm
 * carries «between 2 and 7 kg each time» and this file may not import it, so the honest clause is
 * the pair the document itself holds. A range invented from the multiple would be the app making
 * up the one figure a person came here to check.
 */
export const usualWords = (flag: Flag): string =>
  flag.line.usual
    ? `usually ${amountWords(flag.line.usual)} ${flag.line.unit}, this one says ${amountWords(flag.line.given)}`
    : `${flag.times}× their usual`;

export const confirmWords = (flag: Flag): string =>
  flag.kind === 'unusual'
    ? `Too big to confirm alone — your call · ${usualWords(flag)}`
    : flag.kind === 'big'
      ? `Too big to confirm alone — your call · ${soles(flag.amount ?? 0)}`
      : `Confirm once ${flag.line.product.name} has an amount`;

/** THE SAME FLAG, SAID WHERE SOMEBODY IS WAITING FOR WORDS (FEED-IA §10, corrected). The sentence
 *  leads with WHAT THE CUSTOMER ASKED and ends with the one thing Rocoto needs in order to reply.
 *  Never a holding phrase, because no holding phrase was ever sent.
 *
 *  AND IT SAYS «THEY», NOT THE NAME (§25.5). Every surface that draws this sentence — the band's
 *  card, the standing row in its day, the document — leads with the customer's name one line above
 *  it, so «Restaurant Nou ordered 10× their usual» printed under a row titled «Restaurant Nou» is
 *  the label repeating what position already says. The pronoun keeps the sentence whole and gives
 *  the width back to the fact. */
export const stickyWords = (sale: Sale, flag: Flag): string =>
  flag.kind === 'unusual'
    ? `They ordered ${flag.times}× their usual — confirm before replying`
    : flag.kind === 'big'
      ? `They ordered ${soles(flag.amount ?? 0)} — confirm before replying`
      : `They asked for ${flag.line.product.name} — add the amount before replying`;

/** THE FLUID CHECK, SAID ON THE CARD (THE-INTELLIGENCE §11, amended). Where the house granted it,
 *  Rocoto has already asked the customer, so the card says that rather than asking the desk for the
 *  same thing: the answer is coming, and the person's job is to put it on when it does.
 *
 *  AND IT NAMES THE AXIS ITS OWN FLAG NAMES (§69 · §70.3 · THE-CUMULATIVE-AUDIT-2 C27). It used to
 *  read «Rocoto asked them what the Rape IS», which is §69.A3 — a word the reference has no row
 *  for — while the flag under it is A2, an amount that did not read, and the chip beside it said
 *  «Amount unreadable». Two axes, one row, one of them invented. The question Rocoto actually sent
 *  is `askWords` — «Quick one on the Rape — how much do you want?» — so this is that question
 *  reported, in the same words, about the same thing. */
export const askedWords = (sale: Sale, flag: Flag): string =>
  `Asked the customer for the ${flag.line.product.name} quantity — add it when they reply`;

/** THE FLUID CHECK ITSELF — one line, the way a person at the counter writes it. What is banned is
 *  the holding script, never a real question (FEED-IA §10, corrected). */
export const askWords = (line: SaleLine): string =>
  `Quick one on the ${line.product.name} — how much do you want?`;

/** The lines the catalogue has no row for and nobody has answered for yet.
 *
 *  A HOUSE THAT SELLS ONE-OFFS HAS NO OPEN QUESTION HERE (the `assortment` grant). «We sell
 *  whatever the market had» means an unfamiliar word is an ordinary line Rocoto puts on the
 *  albarán, so the sale does not stand for it — while the line itself still says what it is and
 *  can still be adopted into the catalogue in one tap, on every answer. */
export const openNonSku = (sale: Sale): SaleLine[] =>
  grantsNow().assortment === 'one-offs' ? [] : sale.lines.filter((l) => l.nonSku && !l.adopted);

/** What a non-SKU line says about itself, on the card and on the line. Ink, because it is a fact
 *  about the message and not an act of Rocoto's. */
export const NON_SKU_LABEL = 'off the catalogue';

export const NON_SKU_ANSWER: Record<NonSkuResolution, string> = {
  catalogue: 'Added to the catalogue',
  'one-off': 'Kept as a one-off',
};

/* ── THE SUGGESTION GRAMMAR, IN WORDS (THE-INTELLIGENCE §1) ───────────────────────────────────
 * «A line the model FILLED differently from the customer's literal words renders as the filled
 * thing — normal, confident, first-class — with an indented provenance note below it:
 *   ⌐ they asked: "plum tomatoes" · filled with Greek plum tomatoes — what you had»
 *
 * The note is COMPOSED from the line's own facts, never written: their words, the thing that went
 * on the albarán, and which brain answered. It says what IS — the fill and the reason for it —
 * and it never spends a clause on what the model failed to find.
 */

/** Which brain spoke, said as a reason a person can agree or disagree with. */
const BECAUSE: Record<FilledBy, string> = {
  model: 'what you had',
  memory: 'what they always take',
};

export function fillWords(sale: Sale, line: SaleLine): string | null {
  if (!line.asked) return null;
  if (line.corrected) {
    return `Their correction is on the line · update the suggestion for ${sale.customer.name}`;
  }
  return `they asked for “${line.asked}” · filled with ${line.product.name} — ${BECAUSE[line.filledBy ?? 'model']}`;
}

/** THE AMOUNT'S OWN PROVENANCE (§3), the same grammar one field along: what they said, and the
 *  arithmetic that turned it into the priceable form. */
export function askedQtyWords(line: SaleLine): string | null {
  const said = line.askedQty;
  if (!said) return null;
  const arithmetic = conversionWords(line.product);
  return `they asked for ${amountWords(said.qty)} ${said.unit}${arithmetic ? ` · ${arithmetic}` : ''}`;
}

/** THE CARD'S SUMMARY OF THE SAME FACT (§1: «the subtle flag is this note's summary»). */
export function fillSummary(sale: Sale): string | null {
  const filled = sale.lines.filter((l) => l.asked && !l.corrected);
  if (filled.length === 0) return null;
  if (filled.length === 1) return `filled ${filled[0].product.name} for “${filled[0].asked}”`;
  return `filled ${filled.length} lines from what you had`;
}

/* ── AMENDMENTS (THE-INTELLIGENCE §2) ─────────────────────────────────────────────────────────
 * «An amendment renders as a small chip riding the line's name: Chicken wings · frozen — in the
 * trade's own word, exactly as said. It is NOT a new SKU and NOT free text lost in a note: it is a
 * first-class amendment on the line, so it prints on the albarán, persists to the customer's
 * memory, and feeds the fulfilment brain. Recurring amendments graduate.»
 */

/* ── THE RESOLUTION LAW (FEED-IA §80 · §79 · §78) ─────────────────────────────────────────────
 * «When customers say "mangoes" and we have a few kinds — no: EVEN IF one of those is a direct
 * match for just "mangoes", we still know there's ambiguity at the detail level.»
 *
 * WHAT THIS BANS, EXACTLY. `productForNode` answers a word with the FIRST house product that
 * grounds onto its node. Where the house sells one form of a thing that is the whole answer. Where
 * it sells three — «merluza» with «sin cabeza» and «de pincho» beside it — the first one wins by
 * arriving first, and the line is written as though nobody had a choice to make. The surface-exact
 * match is the worst case of it, not the safe one: a house whose plain SKU is literally called
 * «Merluza» is exactly the house where a silent pick looks most correct and is least examined.
 *
 * SO AMBIGUITY IS COMPUTED, NEVER SNIFFED. It is a fact about the FAMILY (§78's own structure):
 * more than one member under the word means the word did not finish the sentence, whatever any
 * string says. `resolveWord` takes the pick and how many forms the house sells and answers both
 * halves; nothing here reads a name.
 *
 * AND THE INFORMED BEHAVIOUR IS THE ONE THE APP ALREADY SPEAKS (§80.3). There is no new grammar:
 * an ambiguous resolution FILLS and SAYS SO — `asked` + `filledBy` on the line, which `fillWords`
 * already draws as «they asked for “merluza” · filled with Merluza — what you had», and which the
 * card already summarises and the customer's memory already learns from. The other sanctioned
 * behaviour, ask and hold, is `needsReply`, which arrives the same way. What §80 changes is WHICH
 * behaviour fires, and it is never «pick one quietly».
 *
 * THE HARNESS SPEAKS ONLY UNTIL THE HOUSE SPEAKS (§79). The pick is the harness's default; the
 * reading is what makes it a default rather than an answer, and a person putting their own word
 * back on the line is `corrected`, which the fill reading already knows about.
 */

/** WHAT A WORD CAME TO. `forms` is how many members the house sells of the thing the word names —
 *  one is plain, more than one is ambiguous BY CONSTRUCTION (§80.2). */
export type WordResolution = { pick?: Product; forms: number; ambiguous: boolean };

/** THE LAW, as a function so nothing can implement it twice: a pick is ambiguous when the family
 *  behind it holds more than one member, and an exact name match does not change that. */
export const resolveWord = (pick: Product | undefined, forms: number): WordResolution =>
  ({ pick, forms, ambiguous: Boolean(pick) && forms > 1 });

/* ── THE FAMILY GRAMMAR, MIRRORED ON THE LINE (THE-OBJECT-MAP C5 · FEED-IA §75.6) ─────────────
 * «If there are variations of a product, the main one should become a variation, get it?»
 *
 * Stock says it that way now: a family HEAD carries the face and the name, and every MEMBER
 * carries a price and states ONLY the word it adds — «sin cabeza» under «Merluza», never the
 * compound twice. An albarán line is the same object seen from the other side, so it has to speak
 * the same two parts: A BASE, AND THE WORD RIDING IT.
 *
 * IT ALREADY DID, FOR ONE OF THE TWO WAYS A LINE GETS ITS WORD. `SaleLine.amendment` is the
 * customer's own qualifier on a product the catalogue holds (§2) — base + word, drawn as a chip on
 * screen and printed bold after a raya on the paper, through one `LineName`. What it did NOT cover
 * is the OTHER way: a word that has GRADUATED. Once «sin cabeza» becomes a product of its own, a
 * line pointing at it carried the whole compound as a plain name — «Merluza · sin cabeza», one
 * string — while Stock two screens away was drawing the same goods as a family and a member. Same
 * thing, two grammars, which is the defect §75.6 named on the catalogue and this is its twin.
 *
 * SO THE SPLIT IS A FOLD, NOT A FIELD. Nothing is written to the ledger and no line is rewritten:
 * `memberOf` answers «what is the base, and what is the word» for ANY line, from either source,
 * and every surface that draws a line's name asks it. The compound form is the one `catalogue.ts`
 * mints (`amendmentProduct`: `${base} · ${word}`), so the split is exact rather than a guess about
 * punctuation — the two files share one construction, read in opposite directions.
 *
 * AND THE THIRD WAY IS A SORT (THE-OBJECT-MAP C7, landed here). A graduated SORT keeps a name of
 * its own on the ladder — «Merluza de pincho», one string, no raya — so the string split above
 * cannot find where it divides: that answer needs the BASE PRODUCT, and only the register holds it.
 * So this function asks `catalogue.ts` for it (`sortMember`), which computes it with the very
 * `sortWord` the shelf draws its member rows with. One register, one break, both sides.
 *
 * WHICH MEANS THE JOIN IS PART OF THE ANSWER. An amendment's compound is «Merluza · sin cabeza»
 * and a sort's is «Merluza de pincho» — the catalogue mints them differently because they ARE
 * differently-named goods, and a line that printed one with the other's punctuation would be
 * renaming what the crate carries. The fold therefore hands back the join the catalogue wrote, and
 * every surface uses it: base, join, word, drawn as one lockup wherever a line's name is drawn.
 */

/** WHAT A LINE IS A MEMBER OF, AND WHAT IT ADDS. `word` is `null` on a plain line, which is most
 *  of them: a product with nothing riding it is not a member of anything. `join` is what stands
 *  between the two in the catalogue's own minted name. */
export type LineMember = { base: string; word: string | null; join: string };

/** The form `catalogue.ts` mints a graduated AMENDMENT's name in (`amendmentProduct`), and the one
 *  a customer's own live word rides its base with. */
const MEMBER_JOIN = ' · ';

export function memberOf(line: SaleLine): LineMember {
  /* THE CUSTOMER'S OWN WORD COMES FIRST. It is the live one — said this morning, on this line —
     and a graduated product carrying a habit on top of it is still that habit's line. */
  if (line.amendment) return { base: line.product.name, word: line.amendment, join: MEMBER_JOIN };
  /* THEN THE REGISTER'S OWN ANSWER (C7): a sort divides where the register says it divides, and it
     is asked BEFORE the string is read, because an id is a fact and punctuation is a reading. */
  const sort = sortMember(line.product);
  if (sort) return sort;
  const at = line.product.name.lastIndexOf(MEMBER_JOIN);
  if (at <= 0) return { base: line.product.name, word: null, join: MEMBER_JOIN };
  return {
    base: line.product.name.slice(0, at),
    word: line.product.name.slice(at + MEMBER_JOIN.length),
    join: MEMBER_JOIN,
  };
}

/** THE WHOLE PHRASE, FOR ANYTHING THAT NEEDS IT AS TEXT — an export row, a message, a log line.
 *  It is the compound the catalogue writes, so what a customer reads on paper, what Stock draws on
 *  the shelf and what an ERP receives are one string built once. */
export const linePhrase = (line: SaleLine): string => {
  const m = memberOf(line);
  return m.word ? `${m.base}${m.join}${m.word}` : m.base;
};

/** The pair a graduation is about: this word, on this product. */
export const amendmentKey = (line: SaleLine): string | null =>
  line.amendment ? `${line.product.id}·${line.amendment}` : null;

/** How many of the day's lines carry the same word on the same product. */
export function amendmentRepeats(sales: Sale[], line: SaleLine): number {
  const key = amendmentKey(line);
  if (!key) return 0;
  return sales.reduce(
    (n, s) => n + s.lines.filter((l) => amendmentKey(l) === key).length,
    0,
  );
}

/** TWICE IS A HABIT. Once is how a customer talks on a Tuesday; the same word on the same product
 *  a second time is the business telling the catalogue what it is missing. */
export const GRADUATE_AT = 2;

export type Graduation = { word: string; product: string; times: number };

/** What Rocoto has noticed about this line's word, where it has noticed anything. Rocoto's own
 *  observation, so it is drawn with the saffron mark; taking it is the person's act, in ink. */
export function graduationOf(sales: Sale[], line: SaleLine): Graduation | null {
  if (!line.amendment || line.graduated) return null;
  const times = amendmentRepeats(sales, line);
  return times >= GRADUATE_AT
    ? { word: line.amendment, product: line.product.name, times }
    : null;
}

export const graduationWords = (g: Graduation): string =>
  `${g.word} rides ${g.product} on ${g.times} of the day’s lines`;

export const GRADUATED_WORDS = (line: SaleLine): string =>
  `${line.product.name} · ${line.amendment} went to Stock as a product of its own.`;

/* ── WHAT THE SALE TAUGHT ROCOTO ──────────────────────────────────────────────────────────────
 * The three acts, read back as sentences. This is «the event record» the doctrine asks the
 * correction to be visible in: the object carries its own history, and the history is legible on
 * the object rather than in a console somewhere.
 */
function learnedWords(e: SaleEvent, lines: SaleLine[]): string | null {
  const named = (id: string): string => lines.find((l) => l.id === id)?.product.name ?? '';
  if (e.kind === 'correct') return `You put “${e.asked}” on the line in place of ${e.filled}.`;
  if (e.kind === 'choose-sku') return `You chose ${named(e.line)} for “${e.asked}”.`;
  if (e.kind === 'choose-sku-none') return `You kept “${e.asked}” as a one-off.`;
  if (e.kind === 'unit-flip') return `You set ${named(e.line)} to ${e.to}; the suggestion was ${e.from}.`;
  if (e.kind === 'graduate') return `${e.amendment} on ${named(e.line)} goes to Stock as a product of its own.`;
  /* THE AMENDMENT IS A CORRECTION TOO (THE-INTELLIGENCE §2) — the trade's own word, put on the
     line by a hand, is exactly the kind of thing the fulfilment brain should stop needing told. */
  if (e.kind === 'amend' && e.word.trim()) return `You put “${e.word.trim()}” on ${named(e.line)}.`;
  return null;
}

/* ── THE GUARD (THE-APP-V2 §1.3, LOT-LAW §"What this means" §4) ────────────────────────────────
 * «It just knows the law — we don't need to give them a questionnaire. Before letting them
 * confirm, it checks and shows a modal if they haven't put lot numbers: "Are you sure?"»
 *
 * So this is not a validator and there is no disabled button anywhere near it. It is a reading of
 * the day's lines against what the SHELF's own law wants, and it produces one plain sentence of
 * consequence per finding. The person stays sovereign; the sentence makes the law legible; the
 * record remembers what they were told. That is the softening LOT-LAW's hard block needed.
 *
 * The sector is never asked for: a line's family comes from the catalogue it was sold out of.
 */

export type Guard = {
  id: string;
  /** what is missing, short enough to survive into the record: «lote on 1 line» */
  label: string;
  /** ONE plain sentence of consequence. Not a lecture, not an article number. */
  consequence: string;
  lines: SaleLine[];
};

/** What the law wants on a line, by the family it belongs to. Fish and meat: the lot reference has
 *  to reach the buyer. Produce: origen and categoría, which bind the invoice too.
 *
 *  ⚠ THIS `categoría` IS NOT THE CLASS §197.2 REMOVED, AND THE DIFFERENCE IS THE WHOLE RULING.
 *  §197.2 kills the HOUSE's own internal marking — a field an operator typed onto a line between
 *  the SKU and the lot. What is read here is the produce trade's own marketing category, which
 *  ARRIVES with the goods on the batch's record and which §193.4 puts exactly where it belongs:
 *  «the SKU (the thing in the title) would probably have it» — a named grade THE MARKET SELLS BY,
 *  and a fact the buyer's invoice is legally bound to. It is read off `product.trace`, never
 *  offered as a seat, never written here, and it travels with the lot. */
function missingOn(cast: Cast, line: SaleLine): string[] {
  const profile = familyOf(cast, line.product).traceability;
  if (profile === 'lot+fisheries' || profile === 'lot+animal') return line.lot ? [] : ['lote'];
  if (profile === 'lot') return ['origen', 'categoría'].filter((f) => !line.product.trace[f]);
  return [];
}

const LAW_SENTENCE: Record<TraceProfile, string> = {
  'lot+fisheries': 'The buyer legally needs the lot data, and this delivery note is what carries it to them.',
  'lot+animal': 'The lot reference has to reach the buyer, and this delivery note is what carries it.',
  lot: 'Origen and categoría bind the invoice as well as the delivery note.',
  none: '',
};

export function guardsOf(cast: Cast, sale: Sale): Guard[] {
  const out: Guard[] = [];

  /* THE LABEL IS A CLAUSE, NOT A FRAGMENT (THE-APP-V2 §6.7). «lote on 4 lines» opened on a
     lowercase Spanish noun and read as a caption for something that was not there; and the same
     string is what the record keeps («Confirmed over the check · …»), so it has to stand on its
     own in both places. Both guards now say the same shape of thing: how many lines, and what
     they need. */
  const lawless = sale.lines.filter((l) => missingOn(cast, l).length > 0);
  if (lawless.length > 0) {
    const profile = familyOf(cast, lawless[0].product).traceability;
    const wants = missingOn(cast, lawless[0]).join(' and ');
    const many = lawless.length !== 1;
    out.push({
      id: 'law',
      label: `${lawless.length} ${many ? 'lines' : 'line'} ${many ? 'need' : 'needs'} ${wants === 'lote' ? 'a lote' : wants}`,
      consequence: LAW_SENTENCE[profile],
      lines: lawless,
    });
  }

  const unread = sale.lines.filter((l) => l.unreadable);
  if (unread.length > 0) {
    const many = unread.length !== 1;
    out.push({
      id: 'unreadable',
      label: `${unread.length} ${many ? 'lines' : 'line'} ${many ? 'need' : 'needs'} an amount`,
      consequence: 'The delivery note would go out with a guess in place of what they asked for.',
      lines: unread,
    });
  }

  return out;
}

/* ── THE PROPOSAL (THE-APP-V2 §5.7) ───────────────────────────────────────────────────────────
 * «Figure out the lot shit — it should be SUGGESTED in the albarán confirmation thing.»
 *
 * So the guard does not merely warn. It reads the batch book, allocates FIFO — oldest lote first,
 * which is what a cold room actually does — and says what it found in one sentence per line:
 * «L-2208 covers all 12 kg». Attaching is one tap for the whole sale or one tap for one line, and
 * a line may take a different batch than the one FIFO picked. The proposal is Rocoto's act and
 * carries the saffron mark; the attachment is the person's and is ink.
 *
 * Only once the proposal has been dismissed does «Are you sure?» come out — the consequence
 * sentence is for the lines the book cannot answer for, and there is no point stating it while the
 * app is still holding the answer in its hand.
 */

/** «21.08» → a sortable number. The book spans days, and FIFO is a question about days. */
const dayKey = (d: string): number => {
  const [dd, mm] = d.split('.').map(Number);
  return (mm || 0) * 100 + (dd || 0);
};

/** The batches this product can be served off, oldest first. */
export const batchesFor = (cast: Cast, product: string): Batch[] =>
  cast.batches.filter((b) => b.product === product).sort((a, b) => dayKey(a.day) - dayKey(b.day));

export type LotProposal = {
  line: SaleLine;
  /** FIFO, oldest recorded lot first. More than one is an ordinary allocation, never a line split. */
  allocations: Allocation[];
  /** how much of the line the available book can answer for */
  covered: number;
  /** how much the line is */
  need: number;
  /** every recorded lot, including exhausted rows so the manual chooser can say unavailable. */
  candidates: AllocationCandidate[];
};

export type AllocationCandidatesFor = (product: string) => AllocationCandidate[];

const wants = (cast: Cast, line: SaleLine): boolean =>
  !line.lot && familyOf(cast, line.product).traceability !== 'none';

const fallbackCandidates = (cast: Cast, product: string): AllocationCandidate[] =>
  batchesFor(cast, product).map((batch) => ({
    batch: batch.id,
    code: batch.id,
    available: batch.qty,
    receivedAt: dayKey(batch.day),
    day: batch.day,
  }));

/** FIFO across a sale, against a book that is already partly spent. `taken` is MUTATED, so a walk
 *  of the day's sales spends the book once rather than promising the same stock twice. */
function allocate(cast: Cast, sale: Sale, taken: Map<string, number>, candidatesFor?: AllocationCandidatesFor): LotProposal[] {
  const out: LotProposal[] = [];
  sale.lines.forEach((line) => {
    if (!wants(cast, line)) return;
    const recorded = [...(candidatesFor?.(line.product.id) ?? fallbackCandidates(cast, line.product.id))]
      .sort((left, right) => left.receivedAt - right.receivedAt || left.code.localeCompare(right.code));
    if (recorded.length === 0) return;
    const candidates = recorded.map((candidate) => ({
      ...candidate,
      available: round(Math.max(0, candidate.available - (taken.get(candidate.batch) ?? 0)), 2),
    }));
    let left = line.given;
    const allocations: Allocation[] = [];
    candidates.forEach((candidate) => {
      if (left <= 0 || candidate.available <= 0) return;
      const qty = round(Math.min(candidate.available, left), 2);
      allocations.push({ batch: candidate.batch, code: candidate.code, qty });
      taken.set(candidate.batch, (taken.get(candidate.batch) ?? 0) + qty);
      left = round(left - qty, 2);
    });
    if (allocations.length === 0) return;
    out.push({
      line,
      allocations,
      covered: round(line.given - Math.max(0, left), 2),
      need: line.given,
      candidates,
    });
  });
  return out;
}

/** What Rocoto proposes for this sale, with the rest of the day's allocations already spent. */
export function proposeLots(
  cast: Cast,
  sale: Sale,
  day: Sale[] = [],
  candidatesFor?: AllocationCandidatesFor,
): LotProposal[] {
  const taken = new Map<string, number>();
  // Every active Albaran commitment spends availability across the inventory horizon. The stock
  // adapter carries physical receipts/adjustments; the open sale is excluded to avoid double spend.
  day
    .filter((s) => s.id !== sale.id && !s.archived)
    .forEach((s) => s.lines.filter((l) => !l.off).forEach((l) => (l.allocations ?? []).forEach((a) => {
      taken.set(a.batch, (taken.get(a.batch) ?? 0) + a.qty);
    })));
  return allocate(cast, sale, taken, candidatesFor);
}

/** THE SENTENCE ON THE PROPOSAL'S ROW. The number and its unit share one line. */
export function proposalWords(p: LotProposal): string {
  const names = p.allocations.map((allocation) => allocation.code ?? allocation.batch).join(' and ');
  const verb = p.allocations.length > 1 ? 'cover' : 'covers';
  return p.covered >= p.need
    ? `${names} ${verb} all ${amountWords(p.need)} ${p.line.unit}`
    : `${names} ${verb} ${amountWords(p.covered)} of ${amountWords(p.need)} ${p.line.unit}`;
}

/** What the line reads once a batch is attached to it. */
export const lotWords = (allocations: Allocation[]): string =>
  allocations.map((allocation) => allocation.code ?? allocation.batch).join(' + ');

function withAllocations(
  line: SaleLine,
  allocations: Allocation[],
  overrideReason?: string,
  stockRevision?: string,
): SaleLine {
  return {
    ...line,
    allocations,
    lot: lotWords(allocations),
    allocationOverrideReason: overrideReason?.trim() || undefined,
    allocationStockRevision: stockRevision,
  };
}

/** The sale as it WILL be once these picks are attached. */
export const withPicks = (sale: Sale, picks: AllocationPick[]): Sale => ({
  ...sale,
  lines: sale.lines.map((line) => {
    const pick = picks.find((candidate) => candidate.line === line.id);
    return pick
      ? withAllocations(line, pick.allocations, pick.overrideReason, pick.stockRevision)
      : line;
  }),
});

/* ── WHAT A KEY MAY DO TO A ROW (THE-FEED §2, read again after §110) ──────────────────────────
 * THE CARD'S VERB IS NO LONGER THIS. §110 gave the review surface two words and only two —
 * `jobOf` above decides which — so «Confirm» and «Resolve it» have left the row a person reads.
 * What survives here is the ACCEPT KEY'S GATE (checkpoint §14.2e: A · C · H are the machine's own
 * verbs, on the machine's own grammar, and they are neither drawn nor named on a card): «no verb,
 * no key» is answered from this function, so pressing A on a document the statechart would ignore
 * does nothing rather than appending an event and announcing it.
 */

export type RowCall = { verb: string; testid: string };

export const callOf = (sale: Sale): RowCall | null => {
  /* A QUESTION OUTRANKS THE STATECHART (§9.2). The albarán may be perfectly committed and still be
     standing, because what is waiting is a sentence to a customer — so the key opens the document
     where the composer already is rather than moving the statechart under it. */
  if (sale.needsReply) return { verb: JOB_VERB.answer, testid: JOB_TESTID.answer };
  if (sale.state === 'request') return { verb: 'Confirm', testid: 'key-confirm' };
  /* ── «LOCK IT» IS GONE FROM THIS ROW (FEED-IA §66.1) ──────────────────────────────────────
     «I don't want the things to need locking. Simply to be READ. Like Gmail.» A committed sale was
     offering a BLESSING as its quick act — the one act §66 killed — so a committed document takes
     no accept key at all, and what it is owed is read on the card as a job. */
  return null;
};

/* ── HOW MUCH A CARD WEIGHS (THE-APP-V2 §6.6) ─────────────────────────────────────────────────
 * «Confirm and make the albarán — unclear what's main. The ones that NEED actions feel like
 * they're more main than the others.» So presence is a function of whether the card is waiting on
 * a person, and the feed reads as a gradient rather than as a list of equals:
 *
 *   CALL   a request, a committed sale, a complaint — it wants a hand. Grey ground, the strongest
 *          elevation on the surface, ink at full strength.
 *   LIVE   made, scheduled, sent, delivered — the document exists and is on its way. Solid ground,
 *          a hairline of lift, ink at full strength.
 *   DONE   settled. Flat on the paper, ink stepped back. A done thing is quiet.
 *
 * Nothing here is a colour: the whole gradient is elevation, ground and ink weight.
 */

export type Elevation = 'call' | 'live' | 'done';

export const elevationOf = (sale: Sale): Elevation => {
  if (callOf(sale) !== null || sale.state === 'disputed') return 'call';
  return sale.state === 'settled' ? 'done' : 'live';
};

/* ── THE TRANSACTION, SAID FIRST (THE-APP-V2 §6.4) ────────────────────────────────────────────
 * «The main part of the order at the top, the other embedded part below. You want a transaction:
 * WHAT it is and WHO it was to. What the albarán carries is domain-object info.»
 *
 * So the detail opens on the DOCUMENT, not on the conversation: what this is, who it is to, the
 * figure. Before the document exists there is no number to name it by, so it says what it is made
 * of and which day it is for — which is the same fact one step earlier.
 */
/** THE PANEL'S OWN HEAD names the document: its number once it has one, and the stage it is at
 *  before that. It never repeats a word the hero under it is about to say. */
export const whatOf = (sale: Sale): string =>
  RANK[sale.state] >= RANK.made ? `Delivery Note ${sale.number}` : STATE_TEXT[sale.state];

/** The hero's own sub-line: WHICH DAY it is for, and the hour that put it where it is. Every fact
 *  on this line appears exactly once on the panel — the head above carries the document's name and
 *  the block below carries the lines, so neither the state word nor the line count belongs here. */
export function heroSubOf(sale: Sale): string {
  const day = `for ${sale.deliveryDay}`;
  switch (sale.state) {
    /* THE ARRIVAL IS THE ARRIVAL BLOCK'S (FEED-IA §54.3, §25.5). «came 06:12 by WhatsApp» was the
       same two facts the sheet now states as objects one section down — a channel chip and an
       hour — so the head keeps the one thing only it can say: which day the goods are for. */
    case 'request': return day;
    case 'committed': return `${day} · at ${sale.stamps.commit ?? sale.at}`;
    case 'made': return `${day} · at ${sale.stamps.make ?? sale.at}`;
    case 'scheduled': return `${day} · goes at ${sale.window}`;
    case 'sent': return `${day} · at ${sale.stamps.send ?? sale.at} · they can decline until ${sale.declineUntil}`;
    case 'delivered': return `${day} · at ${sale.stamps.deliver ?? sale.at}`;
    case 'disputed': return `${day} · complaint at ${sale.dispute?.at ?? sale.at}`;
    case 'settled': return `${day} · at ${sale.stamps.settle ?? sale.stamps.resolve ?? sale.at}`;
  }
}

/* ── THE ONE LOUD VERB (THE-APP-V2 §6.6) ──────────────────────────────────────────────────────
 * Every state has exactly ONE thing the person is being asked to do, and it gets a block of its
 * own under the lines rather than a place in a list of six rows that all look alike. Everything
 * else the state allows stays a secondary row further down, where a list is the right shape.
 *
 * A DISPUTED sale is the one exception, and it is not a hole: its loud verb needs the outcome
 * chosen first, so the complaint's own resolution block IS the primary act and this returns null.
 * A SETTLED sale is asking for nothing, so it returns null too.
 */

export type PrimaryAct = 'commit' | 'make' | 'schedule' | 'cancel' | 'deliver' | 'settle';

export type Primary = {
  act: PrimaryAct;
  verb: string;
  /** one line of consequence, so the verb is never a word with nothing attached to it */
  sub: string;
  testid: string;
};

export function primaryOf(sale: Sale): Primary | null {
  switch (sale.state) {
    case 'request':
      return { act: 'commit', verb: 'Confirm', sub: 'Confirm this order.', testid: 'do-confirm' };
    /* ── LOCK IT, NOT «MAKE THE ALBARÁN» (FEED-IA §51.9, decided in `detail.tsx`) ─────────────
       «Make the albarán vs Print it is unclear — why would printing be impossible before it is
       made?» A button that says MAKE claims the albarán does not exist yet, and §6.2 says the
       opposite: an order IS an albarán that has not been committed. The act freezes the goods and
       the money, so it is named for that — and the LEDGER carries the word, so the dock and the
       row can never be two vocabularies.
       AND THE SUB IS THE CONSEQUENCE, NEVER AN EXPLANATION (§51.24). «Record what actually goes
       out.» told the reader what the software does; this says what happens to their document. */
    /* ── THE BLESSING IS DEAD (FEED-IA §66.1, superseding §51.9 and §6.3 — his own lines) ────
       «I don't want the things to need locking. Simply to be READ. Like Gmail. Once read, if they
       don't edit, that's down to them.» So a committed albarán asks for NOTHING: it is a document
       a person has looked at, and what happens next is an EXPORT — the paper, the house's own
       system — which `exportStance` leads with because nothing waits for a blessing any more.
       The `make` event survives in the ledger for the sales that already carry one and for the
       states above; no surface asks a person to write a new one. */
    case 'committed':
      return null;
    case 'made':
      return { act: 'schedule', verb: 'Send', sub: `It goes at ${sale.window}, and you can cancel until it does.`, testid: 'do-send' };
    case 'scheduled':
      return { act: 'cancel', verb: 'Cancel the send', sub: `It is queued for ${sale.window}; cancelling brings it back to you.`, testid: 'do-cancel' };
    case 'sent':
      return { act: 'deliver', verb: 'Mark it delivered', sub: 'The goods are with them and the round moves on.', testid: 'do-deliver' };
    case 'delivered':
      return { act: 'settle', verb: 'Settle it', sub: 'They hold it and it is right — this one is done.', testid: 'do-settle' };
    default:
      return null;
  }
}

/** The one line under the customer's name. The row already carries the state as its own word, so
 *  nothing here repeats it: «Made · Albarán 2208-112 · 3 lines · 06:33» says four facts, and
 *  «Albarán made · Albarán 2208-112 · 3 lines · made 06:33» says two of them twice. */
export function subOf(sale: Sale): string {
  const lines = `${sale.lines.length} ${sale.lines.length === 1 ? 'line' : 'lines'}`;
  const doc = `Delivery Note ${sale.number}`;
  switch (sale.state) {
    case 'request': return `${lines} · ${sale.at} · ${sale.customer.channel}`;
    case 'committed': return `${lines} · ${sale.stamps.commit ?? sale.at} · for ${sale.deliveryDay}`;
    case 'made': return `${doc} · ${lines} · ${sale.stamps.make ?? sale.at}`;
    case 'scheduled': return `${doc} · Sends at ${sale.window}`;
    case 'sent': return `${doc} · ${sale.stamps.send ?? sale.at} · Can decline until ${sale.declineUntil}`;
    case 'delivered': return `${doc} · ${sale.stamps.deliver ?? sale.at}`;
    case 'disputed': return `${doc} · complaint at ${sale.dispute?.at ?? sale.at}`;
    case 'settled': return `${doc} · ${sale.stamps.settle ?? sale.stamps.resolve ?? sale.at}`;
  }
}

/* ── THE STRIP, TOLD ──────────────────────────────────────────────────────────────────────────
 * The band above the page draws today's documents in three stages. It is the SAME documents, so
 * it takes its stage from the sale rather than from a walk of its own — one store, one day.
 */

export type DocStage = 'forming' | 'released' | 'delivered';

export const stageOf = (state: SaleState): DocStage =>
  RANK[state] < RANK.made ? 'forming' : RANK[state] < RANK.sent ? 'released' : 'delivered';

/** The hour that stage happened, so a tile states when rather than merely what: a document still
 *  forming is as old as the request that started it, a released one as old as the act that made
 *  it, and a delivered one as old as the moment it left. */
export const stageAt = (sale: Sale): string | undefined => {
  const stage = stageOf(sale.state);
  if (stage === 'forming') return sale.at;
  if (stage === 'released') return sale.stamps.make;
  return sale.stamps.send ?? sale.stamps.make;
};
