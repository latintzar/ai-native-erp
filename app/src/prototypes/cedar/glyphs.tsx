/* THE MARKS — one pack, one weight, one meaning per mark (FEED-IA §30, §31.2).
 *
 * ═══ WHAT THIS FILE IS ══════════════════════════════════════════════════════════════════════
 * A MAPPING MODULE. `GlyphId` is the app's vocabulary of MEANINGS; `MAP` says which mark draws
 * each one. That separation is the whole point: a surface asks for `print`, never for a path, so
 * the artwork is one file's business and swapping it changes no screen.
 *
 * It also holds the SMALL SEATS that ride a control's label — `Count` (§31.2) and `Keycap` (§32).
 * They are not marks; they are the two boxes every surface was typing out by hand and getting
 * wrong the same way, so they are solved here, once, beside the marks they sit next to.
 *
 * ═══ THE PACK IS LUCIDE (the founder, 2026-08-24) ═══════════════════════════════════════════
 * `lucide-react`, pinned. Lucide is drawn exactly the way this app was already trying to draw:
 * line art on a 24 grid, 2px stroke, round caps and joins, `currentColor`. So a mark takes the
 * ink of the seat it sits on and re-themes with everything else, and nothing here holds a colour.
 *
 * ONE VOICE MEANS ONE PACK. Base ships icons of its own, and they were the previous answer here;
 * they are gone from this map because Lucide covers the same meanings and two packs in one screen
 * is exactly the mixed alphabet §30 forbids. Base's icons still draw INSIDE Base's own components
 * (the Combobox's caret, the Select's clear) — that is the kit being itself, not our vocabulary.
 *
 * ═══ WHAT LUCIDE DOES NOT HAVE ══════════════════════════════════════════════════════════════
 * Two meanings in this app are the trade's own and no general pack carries them. They stay
 * bespoke, drawn on Lucide's own grid at Lucide's own weight so they are indistinguishable in a
 * row beside it — same 24 box, same 2 stroke, same round joins, same live area:
 *
 *   · `upTo`      — «how far past their usual an order may go» (a staircase, not a trend line)
 *   · `ceiling`   — «the amount it may not pass» (a lid with what rises to it)
 *
 * Both are listed in the report. Everything else on this map is Lucide's.
 *
 * ═══ THE CLIPPING, FIXED AT THE SOURCE (§31.2) ══════════════════════════════════════════════
 * «Icons are cut off in many places» — his shot was the print mark inside a circular button. Two
 * of the three causes died with the pack and the third is enforced here:
 *
 *   1 · THE MARK WAS DRAWN BROKEN. The old printer was three open paths — a lid, a right-hand
 *       bracket and a tray — so the machine had no left wall and READ as a mark whose left half
 *       had been cut off. Nothing cropped it. It was drawn that way. Lucide's `Printer` is whole.
 *   2 · THE VIEWBOX HAD NO ROOM. Marks were drawn edge to edge on a 20 box, so half a stroke sat
 *       ON the boundary and any rounding took a slice off it. Lucide draws inside 2 → 22 of a 24
 *       box, and the two bespoke marks below hold to the same live area.
 *   3 · THE SVG WAS A FLEX ITEM WITH NO FLOOR. An `<svg>` in a tight row shrinks like any other
 *       item, and an inline `<svg>` sits on the text baseline with a descender's worth of air
 *       under it — which is what pushed the mark off-centre inside every circle. `Glyph` pins
 *       `display: block` and `flex: 0 0 auto` on every mark, Lucide's and ours alike.
 *
 * What remains after the pack is CONTAINER work, and it is done at each site: a seat fits its
 * mark plus its padding, and nothing relies on `overflow` to shape what is inside it.
 *
 * ═══ DETERMINATION MEANS A VOCABULARY (§30) ═════════════════════════════════════════════════
 * «One icon, one meaning, everywhere — the same mark never varies by surface.» A meaning gets ONE
 * id and one row in this map. Three duplicates died on the way in: the navigation's
 * message-with-lines and the panel's speech bubble were one meaning drawn twice (now `chat`); the
 * navigation's torn-foot albarán and the panel's folded-corner page were one meaning drawn twice
 * (now `doc`); Settings' `printer` and the panel's `print` were the same path typed twice (now
 * `print`). THE PENCIL IS GONE ENTIRELY — §31.3 killed the edit button, so the vocabulary has no
 * word for one and nothing can put it back.
 *
 * The produce marks are a DIFFERENT SYSTEM (`src/rocoto/produce-icons/`, THE-INTELLIGENCE §7) —
 * they say what the goods ARE, not what a control does, and no pack replaces them.
 *
 * ═══ THE SEMANTICS AUDIT (FEED-IA §51.19) ═══════════════════════════════════════════════════
 * «Wrong icons: the export ⇥ reads as LOG OUT; the mail-log icon reads as COPY. Icon semantics
 * audited against what people think they mean.»
 *
 * He is right twice, and both faults are the same fault: a mark was chosen for what it DEPICTS
 * («a document with an arrow off it», «a stack of paperwork») instead of for what a person who has
 * used Gmail and an iPhone already reads it as. The test this map is now held to is his sentence —
 * WHAT WOULD A NORMAL APP USER THINK THIS MEANS — and a mark that fails it is wrong however well
 * it illustrates the noun. Six changed, and every one of them for a reading rather than a drawing:
 *
 *   · `export`   FileOutput → Share. A door with an arrow going out of it IS the log-out mark, in
 *                every app anyone has ever used, and `FileOutput` is that shape with a page around
 *                it. The iOS share tray — a box with the arrow rising out of the top — is the most
 *                widely read «this goes out of here» mark on earth, and it says exactly what the
 *                door holds: the ways an albarán leaves the house. It cannot be confused with
 *                `send`: the tray is THE WAYS OUT, the paper plane is ONE albarán to ONE customer.
 *   · `log`      Files → Inbox. Two stacked pages is the DUPLICATE mark — Finder, VS Code, every
 *                editor on the desk — so the incoming log's door was offering to copy something.
 *                The tray with goods dropping into it is what «everything that arrived» looks like
 *                to anyone with an email client, which is everyone.
 *   · `archive`  a NEW id, because `history` was one mark doing two jobs — the incoming log AND
 *                «bring your history» — which is the one thing §30 forbids. A year of the house's
 *                own past records is the records box; what landed this morning is the tray.
 *   · `brand`    Tag → Store. A price tag beside the row that holds THE HOUSE'S NAME says «product
 *                label» in every commerce tool there is. A shopfront says «your business».
 *   · `sign`     PenLine → Signature. The pen is the EDIT affordance §31.3 killed, and it was
 *                standing next to «Albarán sign-off» and next to «Address» — two meanings, and the
 *                wrong reading on both. The handwritten line is a signature and nothing else.
 *   · `at`       a NEW id for an email ADDRESS, which is what the second `sign` row really was.
 *                Nobody has to be taught what @ means.
 *
 * And one addition that is not a correction but a meaning the app had been drawing around:
 *   · `connect`  the plug. FEED-IA §51.20 — «make them feel they're handling a plug into our
 *                product» — so the act of hooking a house's inbox or ERP into Rocoto has its own
 *                mark, used on every connect affordance and on nothing else.
 *   · `camera`   the bay's photograph, which the incoming log now names as a SOURCE (§51.22).
 *
 * WHAT SURVIVED THE AUDIT, and why, is written on each row below. The two near-pairs were the
 * hardest looks: `check`/`confirm` (a bare tick is «done», a tick in a ring is «given as a word»)
 * and `crate`/`catalogue` (the box is THE GOODS, the list is THE ASSORTMENT RULE about them).
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import {
  createLucideIcon,
  Ruler,
  StickyNote,
  Ellipsis,
  Info,
  ArrowLeft,
  ArrowUpRight,
  ArrowRightLeft,
  AtSign,
  Calendar,
  ChartNoAxesCombined,
  Camera,
  Check,
  ChevronDown,
  Circle,
  CircleCheck,
  ClipboardCheck,
  Clock,
  CreditCard,
  Database,
  Eye,
  FileText,
  Flag,
  Heart,
  Inbox,
  List,
  ListChecks,
  LogOut,
  Mail,
  Map,
  BadgeEuro,
  Maximize2,
  MessageCircle,
  MessageCircleQuestion,
  Minimize2,
  Minus,
  Package,
  PenLine,
  Plug,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Scale,
  Search,
  Send,
  Share,
  Signature,
  SquarePen,
  SlidersHorizontal,
  Grid3X3,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Store,
  Trash2,
  Truck,
  Undo2,
  User,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react';

/** §138.8: the installed pack has ArchiveRestore only; keep its box and point the action into it. */
const ArchiveArrowDown = createLucideIcon('ArchiveArrowDown', [
  ['rect', { x: '3', y: '3', width: '18', height: '4', rx: '1', key: 'lid' }],
  ['path', { d: 'M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7', key: 'box' }],
  ['path', { d: 'M12 10v7m-3-3 3 3 3-3', key: 'down' }],
]);

/* ── THE LADDER ───────────────────────────────────────────────────────────────────────────────
 * Three steps and no others, so marks across the app line up instead of each row inventing its
 * own. 16 sits inside a LabelXSmall line box exactly; 20 is the reading size; 24 is the size a
 * mark takes when it IS the control. `Glyph` snaps whatever it is handed onto the nearest step,
 * which is what keeps the ladder true as call sites come and go.
 */
export const STEP = { small: 16, medium: 20, large: 24 } as const;

const STEPS = [STEP.small, STEP.medium, STEP.large];

const snap = (n: number): number =>
  STEPS.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), STEP.medium);

/** LUCIDE'S OWN WEIGHT, on every mark, at every step. One number, stated once. */
const STROKE = 2;

/** the drawn size a circular seat of `diameter` gives its mark, so every circle reads alike and
 *  no mark ever reaches its ring: a 56px launcher draws a 24px mark with 16px of ring around it */
export const CIRCLE_MARK = (diameter: number): number => snap(diameter * 0.45);

export type GlyphId =
  /* the four the navigation says */
  | 'doc' | 'crate' | 'chat' | 'sliders'
  /* the repeated mechanical acts (§30) */
  | 'print' | 'eye' | 'van' | 'clock' | 'who' | 'check' | 'send' | 'flag' | 'pick' | 'search'
  /* the human phone rail — one family for entry, live controls and ending */
  | 'call' | 'callEnd' | 'mic' | 'micOff' | 'speaker' | 'keypad'
  /* ── A STEP THAT WENT BACKWARDS (FEED-IA §7.2 · §51.19 · THE-CUMULATIVE-AUDIT-2 C39) ────────
   * The review row draws TWO marks one line apart — the reason's own bullet, and the rubric
   * chip's class mark — and on a pick that changed both were `pick`, the bay's empty circle. One
   * glyph doing two jobs on one row is what §51.19's «one meaning each» forbids, so the two jobs
   * were split rather than the mark reused: `pick` stays THE BAY'S TICK, STANDING EMPTY, which is
   * a fact about the crate and belongs to the sentence that says it emptied; `reset` is THE STEP
   * THAT WENT BACKWARDS, which is what the CLASS is called. It is deliberately not `undo`: undo
   * is an act a person may take, and this is a thing that already happened to the document. */
  | 'reset'
  /* the acts on a line */
  | 'plus' | 'minus' | 'bin' | 'undo' | 'caret' | 'edit'
  /* how much room a surface is taking (FEED-IA §42) */
  | 'expand' | 'collapse'
  /* THE THREE ROADS OUT OF THE HOUSE (FEED-IA §35.3) — and the door that holds them */
  | 'export' | 'erp'
  /* THE PAPER THAT STAYS IN THE BUILDING (THE-EXPORT-CANON §15.3, §7.2) */
  | 'packing'
  | 'draft' | 'desk'
  /* THE PLUG (FEED-IA §51.20) — the act of hooking a house's own systems into Rocoto */
  | 'connect'
  /* what the house sets up */
  | 'chart' | 'units' | 'note' | 'more' | 'info' | 'log' | 'archive' | 'email' | 'at' | 'brand' | 'sign' | 'file' | 'camera'
  /* what Rocoto is allowed to do on its own */
  | 'confirm' | 'upTo' | 'ceiling' | 'price' | 'ask' | 'catalogue' | 'days'
  /* ── WHAT THIS CUSTOMER KEEPS TAKING (FEED-IA §83.2) ────────────────────────────────────────
   * «I see like a little heart icon inside the field on the left, unfilled, superseamless.»
   * ONE MEANING, and it is narrow: THE CUSTOMER'S FAVOURITES — the goods this account has taken
   * most often. It is never a like, never a rating, never a saved-for-later and never anything
   * the person did; it is what the account's own record says it keeps buying. §30's rule holds —
   * one id, one mark, and no surface may borrow it for a second sense. UNFILLED is the whole of
   * its state: there is nothing to fill, because nobody toggles it. */
  | 'heart'
  /* what the scale said (FEED-IA §41.3) */
  | 'weigh'
  /* ── THE ADMINISTRATION'S OWN SEATS (FEED-IA §53 · THE-ADMIN-CANON §2.1) ────────────────────
   * Five new meanings and one new act, and every one of them earned its own id under §30's rule
   * rather than borrowing a mark that already meant something else:
   *
   *   · `team`  the HOUSE'S OWN PEOPLE. It is deliberately not `who`: `who` is the door to a
   *             CUSTOMER's record everywhere in this app — on an albarán, on a band card, on the
   *             customers rail — and the seat that holds the people who WORK here is the other
   *             side of that relationship. One figure is the customer; the group is the house.
   *   · `map`   the GROUND the house covers. Not the pin (`pin-map.tsx` draws that, and a pin is
   *             one place); this is the territory, which is what a zone band is about.
   *   · `ops`   the WORKING STYLE — a list with its items ticked, which is what «the way the
   *             business works» looks like when it is written down. It is not `catalogue`'s plain
   *             list: that one is the assortment RULE about goods, this is the house's own routine.
   *   · `plan`  the CARD THAT PAYS US. Every subscription surface a person has ever seen draws
   *             one, and it is deliberately not `price` (BadgeEuro), which is money moving between
   *             the house and ITS customers. Two different money facts, two marks.
   *   · `data`  the STORE. What went in, what comes out, and how long it is kept.
   *   · `back`  THE WAY OUT OF A WORLD (§53: «a back button at the top»). A left arrow, and the
   *             only left arrow in the vocabulary — the chevron means «this way» inside a surface
   *             and `undo` means «put that back», so neither could carry «leave here». */
  | 'team' | 'map' | 'ops' | 'plan' | 'data' | 'back'
  /* ── ENDING THE SESSION (FEED-IA §85 — the foot menu's last row) ────────────────────────────
   * `signout` is the SESSION ending, and it is a fourth kind of leaving that none of the three
   * above can carry: `back` walks out of a WORLD and stays signed in, `undo` reverses an ACT, and
   * the chevron steps around INSIDE a surface. This one closes the door behind the person. One id,
   * one meaning, one row — the foot menu's last, and nothing else in the app may borrow it. */
  | 'signout'
  /* ── LEAVING THE APP FOR SOMEBODY ELSE'S (FEED-IA §85's «external-link marks… where true») ──
   * `outward` is THE FIFTH KIND OF LEAVING and the only one that ends up outside this product:
   * `back` walks out of a world and stays here, `signout` closes the door behind the person and
   * stays here, `undo` reverses an act, and the CHEVRON steps around inside a surface. This one
   * says the press hands you to another company's screen — the Stripe customer portal is the
   * first and, today, the only true instance. §85 licenses the mark «where true», which is also
   * the ban: a row that stays in the app may not wear it, and `rail.tsx` says exactly that about
   * its own menu, which is why the foot menu has none. It takes the CHEVRON'S SEAT rather than
   * standing beside it, because a row cannot both drill in and leave. */
  | 'outward';

/* ── THE BESPOKE TWO ──────────────────────────────────────────────────────────────────────────
 * Drawn to be indistinguishable from the pack: 24 box, live area 2 → 22, stroke 2, round joins.
 * A mark that missed any of those would announce itself as the odd one in a row of Lucide.
 */
const bespoke =
  (paths: React.ReactNode): LucideIcon =>
  // eslint-disable-next-line react/display-name
  (({ size = 24, ...rest }: { size?: number | string }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths}
    </svg>
  )) as unknown as LucideIcon;

/** the step up: how far past their usual an order may go. A staircase, because the fact is a set
 *  of steps a house allows and not a curve — Lucide's `TrendingUp` says a trend, which is a
 *  different claim about the same number. */
const UpTo = bespoke(<path d="M3 19v-4.5h6V10h6V5.5h6" />);

/** the ceiling, and what comes up to it. Lucide's `ArrowUpToLine` is the nearest and points the
 *  wrong way about the meaning: this is a limit being approached, not a thing being sent to the
 *  top. Kept bespoke, at the pack's own weight. */
const Ceiling = bespoke(<><path d="M3.5 5h17" /><path d="M12 20.5V9.5" /><path d="M7.5 14 12 9.5l4.5 4.5" /></>);

/* ── THE MAP ──────────────────────────────────────────────────────────────────────────────────
 * THE ONE PLACE ARTWORK IS CHOSEN. A pack change is a change to this object and nothing else.
 */
const MAP: Record<GlyphId, LucideIcon> = {
  /* ── THE NAVIGATION'S FOUR ──────────────────────────────────────────────────────────────── */

  /** the albarán: a receipt with a torn foot and lines on it. `Receipt` proper carries a currency
   *  squiggle, which says «a bill was paid» — the wrong claim about a delivery note, and a dollar
   *  sign in a Spanish app besides. */
  doc: ReceiptText,
  /** the crate: a catalogue is goods on a shelf. A box is what every inventory tool on the desk
   *  draws for stock, so nobody has to learn this one either. It is not the same meaning as
   *  `catalogue` below: this is THE GOODS, that is THE RULE about which goods a customer may ask
   *  for — and they never appear in the same seat. */
  crate: Package,
  /** the conversation. ONE bubble for the whole app — the tab, the launcher, the door, the row */
  chat: MessageCircle,
  /** sliders: the setup is a set of positions, not a machine */
  sliders: SlidersHorizontal,

  /* ── THE REPEATED ACTS (§30) ────────────────────────────────────────────────────────────── */

  print: Printer,
  eye: Eye,
  /** the truck that runs the round */
  van: Truck,
  /** a time, and a rule that runs at one */
  clock: Clock,
  /** the door to the customer's own record */
  who: User,
  /** A BARE TICK IS «DONE». It marks a thing that has happened, and it is deliberately not
   *  `confirm`'s ringed tick, which is a WORD GIVEN — the difference between «this is finished»
   *  and «Rocoto answered for you». Two meanings, two marks, and neither of them ever draws the
   *  other's job. */
  check: Check,
  /** THE BAY'S TICK, STANDING EMPTY (DENSE-BRIEF-DESIGN §1, FEED-IA §7.2). «A change after the
   *  pick RESETS the tick with a sentence; going backwards is visible.» So the feed draws the
   *  circle with nothing in it, beside the sentence that says why it emptied — a filled tick over
   *  a stale pick is a lie a screenshot catches. The ticked state is the document's, never a row's
   *  (§26.1: «nobody marks off — they just DO it»), which is why one mark covers this meaning. */
  pick: Circle,
  /** THE STEP THAT WENT BACKWARDS (§7.2, C39). The rubric chip's mark for a document whose pick
   *  was reset — the arrow that turns back on itself, which is the class rather than the tick. It
   *  never draws beside a sentence: the sentence has `pick`'s empty circle, and this has the word. */
  reset: RotateCcw,
  /** the albarán goes to the customer */
  send: Send,
  /** what the customer raised against a document already with them */
  flag: Flag,
  /** FIND IT (FEED-IA §35.1). One mark for all three homes — the river, the catalogue and the
   *  customers — because «filter as you type» is one act done in three places, and a surface that
   *  drew its own would make it read as three. The lens is the mark every trade already knows,
   *  which is exactly what §30 means by an icon being language rather than decoration. */
  search: Search,

  /* ── THE HUMAN PHONE RAIL (THE-VOICE-CONNECTION-SPEC §VOICE-08) ────────────────────────── */
  call: Phone,
  callEnd: PhoneOff,
  mic: Mic,
  micOff: MicOff,
  speaker: Volume2,
  keypad: Grid3X3,

  /* ── THE ACTS ON A LINE ─────────────────────────────────────────────────────────────────── */

  plus: Plus,
  minus: Minus,
  bin: Trash2,
  undo: Undo2,
  caret: ChevronDown,
  edit: PenLine,

  /* ── HOW MUCH ROOM (FEED-IA §42) ────────────────────────────────────────────────────────────
   * «The widget gets an EXPAND icon — fullscreen when asked, compact by default.» That is TWO
   * meanings and it takes two marks: `expand` asks for the whole screen, `collapse` gives it back.
   * They are the pack's own opposed pair — four corner arrows out, four corner arrows in — so the
   * control reads as one seat changing its mind rather than as two different buttons.
   *
   * AND THE CARET STAYS THE CARET. §30's rule is one icon one meaning: the chevron already means
   * «this way» in this panel — left to the list, down to put it away — and re-using it for size
   * would make the same mark say a third thing. A size is not a direction.
   */
  expand: Maximize2,
  collapse: Minimize2,

  /* ── THE ALBARÁN LEAVING THE HOUSE (FEED-IA §35.3) ──────────────────────────────────────────
   * «Albaranes finishing is one of the main jobs of Rocoto… the header's print icon IS an export
   * icon. Three rails, print the main one: PRINT · ERP · EMAIL.»
   *
   * SO EXPORT TAKES A MARK OF ITS OWN, and ⎙ keeps meaning paper. Determination (§30) is one icon
   * one meaning: the header's door opens three roads, only one of which is a printer, and a ⎙ on
   * it would be the same mark saying «paper» in one place and «all the ways this leaves» in
   * another. ⎙ stands inside the centre, on the rail that really is the printer's.
   *
   * AND THE MARK IS THE SHARE TRAY, NOT A DOCUMENT LEAVING A BOX (FEED-IA §51.19). `FileOutput`
   * was the drawing of the sentence «the albarán goes out» — a page with an arrow crossing its
   * right edge — and an arrow crossing a right edge is THE LOG-OUT MARK. Every app draws the way
   * out of an account like that, so the one control in the header that finishes the morning's work
   * was offering to end the session. The iOS tray with the arrow rising out of it says «this goes
   * somewhere else» to anybody who owns a phone, and it says it about the CONTENTS of the tray,
   * which is what three rails are.
   */
  export: Share,

  /** THE BAY'S OWN PAPER (THE-EXPORT-CANON §15.3, §7.2 · FEED-IA §54.4). The picking list stays in
   *  the building — «Para el almacén» — so it is a DESTINATION beside Sage 50, the customer's copy
   *  and the van, and §15.3's rule is one mark per destination on all four surfaces: the send
   *  control, the state row's cell, the export centre's rail identity, the print queue's row.
   *
   *  IT IS NOT ⎙, AND THAT WAS §54.4's WHOLE COMPLAINT. Three papers wore one printer mark, so the
   *  albarán, the day's sheet and the packing list were three rows a person could not tell apart —
   *  and «the mark is the DESTINATION, never the act» (§15.3.3) is the rule that fixes it: the
   *  printer is how all three come out, the clipboard is who the third one is FOR. A clipboard with
   *  a tick is what a bay's paper looks like in every warehouse on earth — a list carried to the
   *  crates and ticked against them — and `pick`'s empty circle stays the STATE of that tick, which
   *  is a different meaning and keeps its own mark under §30. */
  packing: ClipboardCheck,

  /** THE DRAFT (FEED-IA §74.5). «The typical draft icon» — the compose mark every mail client
   *  taught: a pen over the square. One mark for a document half-written, wherever drafts stand. */
  draft: SquarePen,

  /** WRITTEN BY A HAND, HERE (FEED-IA §74 · §51.19). A hand wrote this document at the desk rather
   *  than it arriving down a rail, which is a different fact from «half-written» — so it takes its
   *  own id under §30 instead of borrowing `draft`'s compose square. Three pens, three meanings,
   *  and they are told apart by what each drawing is of: SquarePen is a pen over A SQUARE (compose
   *  a new one), `Signature` is a written NAME (a sign-off), and this is the pen laid on the LINE
   *  it just wrote. It never stands on a control — §31.3's ban is on the pen as an EDIT
   *  AFFORDANCE, and this one rides a chip that states a fact and does nothing when pressed. */
  desk: PenLine,

  /** THE CUSTOMER'S FAVOURITES (FEED-IA §83.2). Lucide's `Heart` is the outline, drawn on the same
   *  24 grid at the same 2px weight as every other mark here — so «unfilled» costs no special case:
   *  it is what the pack draws, and the filled variant is a different component this map never
   *  reaches for. The mark is READ by everybody as «the ones you love», which is exactly the claim
   *  — these are the goods this account keeps taking — and the reason no other mark works: a star
   *  is a rating, a clock is recency, a list is the catalogue. */
  heart: Heart,

  /** THE PLUG (FEED-IA §51.20). «Make them feel they're handling a plug into our product.» One
   *  mark for the ACT of connecting — the inbox, the ERP — wherever it stands: the offer in Stock,
   *  the unconnected rail in the export centre, the rows in Settings. It is the only mark in this
   *  vocabulary allowed to stand on the connect zone's own ground (`connectWash`), and it never
   *  appears anywhere a person is not being offered a connection. */
  connect: Plug,
  /** THE HOUSE'S OWN SYSTEM, BOTH WAYS (§35.6: «two-way where the ERP allows — our changes land
   *  there, theirs land here»). The two arrows ARE that claim; a single outbound arrow would be
   *  the mark promising less than the rail does. It SURVIVED the §51.19 audit: opposed arrows are
   *  read as «these two exchange» in every sync setting a person has ever seen, and the rail is
   *  named in words beside it. The PLUG says «hook it up»; this says «it is running both ways». */
  erp: ArrowRightLeft,

  /* ── WHAT THE HOUSE SETS UP ─────────────────────────────────────────────────────────────── */

  /** WHAT LANDED (FEED-IA §51.19). The incoming log — the supplier mail, the bay's photographs,
   *  what a rule announced, what a hand declared — is the tray everything arrives in, and a tray
   *  is what an inbox looks like to every person alive. It used to be `Files`, two stacked pages,
   *  which is the DUPLICATE mark in Finder and in every editor: the log's door was offering to
   *  copy something. */
  log: Inbox,
  /** THE RECORDS BOX. A year of the house's own past orders and albaranes, read once — a
   *  different thing from what landed this morning, so a different mark. One id was doing both
   *  jobs, which is the drift §30 exists to stop. */
  archive: ArchiveArrowDown,
  /** §143: a tariff’s price history, distinct from archiving an object. */
  chart: ChartNoAxesCombined,
  note: StickyNote,
  more: Ellipsis,
  info: Info,
  units: Ruler,
  /** the envelope: a MESSAGE, and the rail that carries one. It is not `log`'s tray — the tray is
   *  the place things land, the envelope is the thing itself. */
  email: Mail,
  /** THE ADDRESS (§51.19). @ is read as «an email address» by everybody, which is exactly what the
   *  row it stands on holds. It used to wear the pen, which said «edit me» — the affordance §31.3
   *  killed — beside a fact that is not edited by a pencil. */
  at: AtSign,
  /** THE HOUSE ITSELF (§51.19). The shopfront, on the row that holds the house's own name. A price
   *  tag stood here, and in every commerce tool a price tag means «a label on a product». */
  brand: Store,
  /** THE SIGNATURE — the handwritten line a house signs its albarán off with. Not a pen: §31.3
   *  killed the edit button and nothing in this vocabulary may draw one. */
  sign: Signature,
  /** a file that arrived — an export the house handed us, not a document the house issued */
  file: FileText,
  /** THE BAY'S OWN CAMERA. A photograph taken at the door is one of the ways stock arrives, and
   *  the incoming log names its source on every row (§51.22). */
  camera: Camera,

  /* ── WHAT ROCOTO MAY DO ON ITS OWN ──────────────────────────────────────────────────────── */

  /** the word given */
  confirm: CircleCheck,
  upTo: UpTo,
  ceiling: Ceiling,
  /** the money side of a grant */
  price: BadgeEuro,
  /** the question asked out loud */
  ask: MessageCircleQuestion,
  /** THE ASSORTMENT RULE — the list of what a customer may ask for, and what falls outside it. A
   *  bulleted list is «a set of allowed things» to a normal reader, and it is deliberately not the
   *  `crate`: the box is the goods themselves, this is the rule about which of them may be
   *  ordered. The two never share a seat. */
  catalogue: List,
  /** the week */
  days: Calendar,

  /* ── WHAT THE SCALE SAID (FEED-IA §41.3) ────────────────────────────────────────────────────
   * «FINAL WEIGHT is always addable on any line — some houses weigh everything, some accept
   * losses/gains, some machine-weigh.» Weighing is a repeated mechanical act, so §30 gives it a
   * mark: the balance, which is the one object in a food house that means exactly this and nothing
   * else. It stands on the «add more» menu's main row and on the field the weight lands in — one
   * mark, one meaning, both places. */
  weigh: Scale,

  /* ── THE ADMINISTRATION'S SEATS (FEED-IA §53 · THE-ADMIN-CANON §2.1) ────────────────────────
   * The canon names each of these against a Lucide mark, and the reasons are written on the ids
   * above. What is worth restating here is what did NOT happen: `who` was not reused for the team,
   * `crate` was not reused for the plan, and the chevron was not reused for the way back. Three
   * near-misses, three new ids, because §30's «one icon, one meaning» is only true if the cheap
   * reuse is the thing you refuse. */

  /** THE HOUSE'S OWN PEOPLE — the group, against `who`'s single figure. */
  team: Users,
  /** THE GROUND COVERED — the territory a zone band promises, not one place on it. */
  map: Map,
  /** THE WORKING STYLE — the routine, written down and ticked. */
  ops: ListChecks,
  /** WHAT PAYS FOR ROCOTO. Deliberately not `price`: that is the house's money with its own
   *  customers, this is the house's money with us. */
  plan: CreditCard,
  /** WHAT THE HOUSE HAS GIVEN US AND CAN TAKE BACK — the store, in and out. */
  data: Database,
  /** THE WAY OUT OF A WORLD (§53). One left arrow, one meaning, one seat: the head of the admin
   *  rail. It never marks a step inside a surface — that is the chevron's job — and it never
   *  reverses an act, which is `undo`'s. */
  back: ArrowLeft,

  /** ENDING THE SESSION (FEED-IA §85). Lucide's `LogOut` — a door with an arrow leaving it — and
   *  it points RIGHT while `back` points left, which is the whole distinction drawn: one goes back
   *  into the app, the other goes out of it. Drawn once, in the foot menu's last row. */
  signout: LogOut,

  /** LEAVING FOR SOMEBODY ELSE'S PRODUCT (§85). Lucide's `ArrowUpRight` — the mark every interface
   *  on the web has agreed means «this opens away from here». Deliberately not `send` (a paper
   *  aeroplane is something YOU dispatch) and not `export` (goods leaving the house), because both
   *  of those are about a thing moving and this is about the READER moving. */
  outward: ArrowUpRight,
};

export const hasGlyph = (id: string): id is GlyphId => id in MAP;

/**
 * One mark, drawn.
 *
 * A mark is decorative by default — the control around it carries the word (§30: Base's own hover
 * labels do the talking). Pass `title` where the mark stands alone with nothing else to say it.
 *
 * The wrapper is what makes a mark uncroppable in any seat: `inline-flex` with `lineHeight: 0`
 * takes the svg off the text baseline (no descender gap under it) and `flex: 0 0 auto` stops a
 * tight row squashing it. Both used to be missing, and both were causes of his shot.
 */
export function Glyph({ id, size = STEP.medium, title }: { id: GlyphId; size?: number; title?: string }) {
  const Mark = MAP[id];
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: 'inline-flex', flex: '0 0 auto', lineHeight: 0 }}
    >
      <Mark size={snap(size)} strokeWidth={STROKE} absoluteStrokeWidth aria-hidden="true" />
    </span>
  );
}

/* ── THE AI'S OWN ACT, AT ITS SMALLEST (DENSE-BRIEF-DESIGN §1 — the saffron audit) ────────────
 * «The small saffron DOT = the AI acted (auto-committed, the reading, rocotoAsked).» And beside
 * it, in the same criteria: «Scan for accent rings — at most one kind of element on the whole feed
 * draws one, the complaint on its albarán, and any second ring anywhere is a defect.»
 *
 * Those two sentences decide the artwork. An unfilled 10px circle is a RING, however small, so a
 * feed marking every one of Rocoto's acts with one was drawing the complaint's own device two
 * hundred times over. A FILLED disc is the same fact with no outline in it: it reads as a dot at
 * 5px, at a glance, at any density.
 *
 * IT IS A SEAT, NOT A MARK, so it lives beside `Count` and `Keycap` rather than in the MAP: there
 * is no line art here, only a disc at the smallest size the eye still resolves. And it carries
 * a WORD (§19's bar: every mark passes a first reader or says what it is) — as its own label where
 * it stands alone, and as the sentence beside it where a card has room for one.
 *
 * ═══ ⚠ AND THE DISC IS NOT RED ANY MORE (FEED-IA §127.3, THE-CHECKPOINT-AUDIT finding 1) ═════
 * IT WAS, AND THAT IS WHAT DISPROVED THE PRODUCT'S ONE CLAIM ON SIGHT. §127.3 reserves red for a
 * single sentence — «a human being is waiting on you» — and the audit found this disc standing in
 * front of «3 lines · 09:25» on EVERY row of the Sales river, in front of an already-sent supplier
 * mail, and beside a reading on «Your data». Rocoto acting is the most ordinary event in this
 * product; a colour spent on the ordinary cannot also mean «somebody is blocked on you», and the
 * audit's own words are the proof: «having it right in one place and wrong in five proves it isn't
 * a style choice.»
 *
 * SO THE FACT SURVIVES AND THE COLOUR GOES. The disc still stands in the same seat, still carries
 * the same sentence, and still says the same thing — Rocoto did this — in the app's neutral ink,
 * which is where every other status in this product already lives («colour is not a status
 * system… there is no traffic light in this product», `rocoto-theme.ts`). The accent's own
 * reservation is not widened here: after this pass a red MARK is `attention-dot.tsx` and the
 * reply-owed register of `tick.tsx`, and nothing else in the house draws one.
 */
export function ActDot({ label, size = 6 }: { label?: string; size?: number }) {
  const [, theme] = useStyletron();
  return (
    <span
      data-act-dot="yes"
      role={label ? 'img' : undefined}
      aria-label={label}
      title={label}
      aria-hidden={label ? undefined : true}
      style={{
        display: 'inline-block',
        flex: '0 0 auto',
        width: size,
        height: size,
        borderRadius: '50%',
        background: theme.colors.contentTertiary,
      }}
    />
  );
}

/* ── THE COUNT THAT RIDES A MARK (§31.2, the container rule) ──────────────────────────────────
 * Four seats carried their own badge — the rail, the phone's row, the printer, the chats launcher
 * — and all four had the same two faults, because all four were typed out separately:
 *
 *   · `minWidth: 16` with `padding: 0 4px` on a CONTENT box is 24px wide and 16px tall, and
 *     `borderRadius: 50%` turns that into an ELLIPSE. Every badge in the app was an egg.
 *   · nothing capped the number, so the real-scale seed put «295» in a 16px seat and the badge
 *     grew into a pill that covered the mark it was counting.
 *
 * So it is one component: a border box, a pill radius that is right at any width, and a cap. The
 * SEAT still decides where it sits, because a rail, a tab and a circle anchor it differently.
 *
 * ═══ AND THREE OF THE FOUR ARE GONE (FEED-IA §42) ═══════════════════════════════════════════
 * «We shouldn't really have a chat ping — let's commit to that.» The chats launcher's badge went
 * first, and the two navigation badges went with the Chats seat, because the only thing either of
 * them ever counted was that. ONE SEAT IS LEFT and it is the printer's: it counts paper a person
 * asked for and is waiting on, which is a job in progress rather than a thing demanding attention.
 * What needs a person is counted ONCE, as the badge on the chat launcher (§75.2) — the
 * unread fold from shell/threads, worn by the bubble, opening the book.
 */
export const COUNT_CAP = 99;

export function Count({
  value,
  /** on an ink ground, the badge is paper with an ink hairline */
  invert = false,
  testid,
  size = 18,
}: {
  value: number;
  invert?: boolean;
  testid?: string;
  size?: number;
}) {
  const [, theme] = useStyletron();
  return (
    <span
      data-testid={testid}
      data-count={value}
      aria-hidden="true"
      style={{
        boxSizing: 'border-box',
        display: 'inline-grid',
        placeItems: 'center',
        minWidth: size,
        height: size,
        paddingLeft: theme.sizing.scale100,
        paddingRight: theme.sizing.scale100,
        borderRadius: size / 2,
        border: invert ? `1px solid ${theme.colors.contentPrimary}` : undefined,
        background: invert ? theme.colors.backgroundPrimary : theme.colors.contentPrimary,
        color: invert ? theme.colors.contentPrimary : theme.colors.backgroundPrimary,
        ...theme.typography.LabelXSmall,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {value > COUNT_CAP ? `${COUNT_CAP}+` : value}
    </span>
  );
}

/* ── THE KEYCAP (FEED-IA §32) ─────────────────────────────────────────────────────────────────
 * «Hover labels carry the keycap the classic way — a little square with the letter in it.»
 *
 * IT IS NOT A MARK, AND IT LIVES HERE ANYWAY. `Count` set the precedent: this module owns the
 * SMALL SEATS that ride a control's label. A badge and a cap share one failure mode — a content
 * box with padding is not a square — and one answer: a border box with a floor on both axes,
 * solved once rather than at every site. The MAP above is a vocabulary of MEANINGS; a keycap is a
 * picture of a key, which is a different kind of object and takes a different kind of seat.
 *
 * THE LEGEND IS THE KEY'S OWN. A cap prints what is printed on the key the hand is about to press
 * — «P», «←», «→». So the arrows are the arrow keys' own characters rather than the app's
 * chevrons: a mark out of the vocabulary would say «the one before it», and the key says «left».
 *
 * IT TAKES THE INK OF WHATEVER IT RIDES. Base's tooltip stands on an inverse ground and the dock
 * stands on paper, so a cap drawn in either one's colour is invisible on the other. The border and
 * the legend are both `currentColor` and the seat is transparent, which is also why it survives a
 * re-theme without owning a single colour of its own.
 */
export type KeycapProps = {
  /** the key itself — one letter, or an arrow. A keycap never holds a word. */
  children: React.ReactNode;
};

export function Keycap({ children }: KeycapProps) {
  const [, theme] = useStyletron();
  return (
    <kbd
      data-keycap={typeof children === 'string' ? children : undefined}
      style={{
        boxSizing: 'border-box',
        display: 'inline-grid',
        placeItems: 'center',
        minWidth: theme.sizing.scale650,
        height: theme.sizing.scale650,
        paddingLeft: theme.sizing.scale100,
        paddingRight: theme.sizing.scale100,
        border: '1px solid currentColor',
        borderRadius: theme.borders.radius100,
        background: 'transparent',
        color: 'inherit',
        ...theme.typography.LabelXSmall,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
      }}
    >
      {children}
    </kbd>
  );
}

/** A HOVER LABEL THAT CARRIES ITS KEY (§32). «Print it · [P]» — the sentence first, because the
 *  sentence is what the control does, and the cap after it as the fact that there is a shorter
 *  way. It rides INSIDE Base's own tooltip content, so nothing about the tooltip changes. */
export function Shortcut({ label, keys }: { label: React.ReactNode; keys: string[] }) {
  const [, theme] = useStyletron();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200, minWidth: 0 }}>
      <span style={{ minWidth: 0 }}>{label}</span>
      <span aria-hidden="true" style={{ opacity: 0.62 }}>·</span>
      {keys.map((k) => (
        <Keycap key={k}>{k}</Keycap>
      ))}
    </span>
  );
}

export default Glyph;
