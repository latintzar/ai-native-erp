/* THE CHIP ENTRY — one field, and the words become chips as they are typed (FEED-IA §62).
 *
 * «Product wise we also need them to be able to enter their own names etc and still get the right
 * icons show up etc, even in the title to put the class, the packaging, the prep style — and see
 * the suggestion below that appear with the things as chips… even I'd say just making the shit
 * chips AS THEY TYPE, even better, so that they don't need to click at all, so it feels as clear
 * as prompting, which means "live" "realtime" AI.»
 *
 * ═══ THE ONE IDEA ═══════════════════════════════════════════════════════════════════════════
 * THE CHIP IS DRAWN AROUND THEIR OWN WORDS. Nothing is rewritten, nothing is moved, nothing is
 * lifted out into a second field: `chip-parse.ts` reads the stream on every keystroke and returns
 * SPANS, and this surface paints a skin over the spans that resolved. A word that becomes a
 * «name» does not change position, size, or a single character — it grows a ground and a hairline
 * where there was none, in place, in one frame.
 *
 * That is what makes it feel like prompting: you write a sentence, and the sentence gets
 * understood in front of you. It is also the whole answer to §59.1 («acting must not make the
 * surface jump») and §37.3 — see THE CALM GEOMETRY below, which is a mechanic and not a promise.
 *
 * ═══ FREE TEXT WEARS NO SKIN, AND THAT IS THE HONEST DRAWING (§41.5, §65.3) ═════════════════
 * A word the reference does not know stays exactly as they typed it — no box, no underline, no
 * warning, no correction. It is still a chip in every way that matters (it walks with the arrows,
 * it re-opens under the caret, it goes onto the line), it simply is not wearing recognition,
 * because we have not recognised it. «Their names, their structure, their order stay THEIRS on the
 * surface.» The skin IS the recognition, so the absence of a skin is the truth being told.
 *
 * ═══ THE CALM GEOMETRY, MECHANICALLY (§37.3, §59.1, §61.4) ══════════════════════════════════
 * «Jagged growth after an act breaks the flow and adds stress to a day that is already stress.»
 * Four constants, and between them the field cannot jump:
 *   1 · EVERY WORD CARRIES ITS OWN PADDING, always — `WORD_PAD` on each side, whether it resolved
 *       or not. The gap between two words IS that padding, so a chip forming adds no width and
 *       fusing two words into one chip moves neither of them.
 *   2 · THE SKIN TAKES NO SPACE — a background and an INSET hairline (`box-shadow: inset`), never
 *       a border, which would push every character to its right by a pixel as it appeared.
 *   3 · THE FACE HAS A FIXED SEAT — 40px on a desk, 32 on a phone, or the seat a hosting ROW
 *       states (`row.seat`, §109.6) — always drawn, whatever is in it. The painting resolving is a
 *       change of PICTURE, never a change of layout (the seat is `product-face.tsx`'s own `Face`,
 *       whose contract is exactly this).
 *   4 · WHAT IS OFFERED TAKES NO SPACE AT ALL (§113 · §115.1). The suggestion shelf is dead; the
 *       offers hang in a dropdown OVER the surface, so six offers, two offers and none are the
 *       same geometry and nothing under the field can be moved by what we happen to know.
 *   5 · THE RAIL'S SEATS ARE RESERVED AND ONLY THEIR MARKS ARE PAINTED (§109.7). Focusing the
 *       field reveals the door in space the row already held; a caret arriving moves no character.
 *   6 · EVERY WORD'S LINE BOX IS THE SAME DECLARED HEIGHT (§119.2 — «the height keeps changing»).
 *       `WORD_LINE` is worn by the written words AND by the input under the caret, so the two
 *       cannot disagree about their own height and the band cannot change when the caret steps
 *       from one word into the next. The field's own floor is stated from the same number, so a
 *       field standing alone measures the same empty, mid-sentence and finished.
 *
 * ═══ CHIPS ARE CAPTURED · DROPDOWNS ARE OFFERED (FEED-IA §113, THE FIRST GENERAL) ═══════════
 * «A chip may only show a FACT the parse already landed. Anything OFFERED — history, suggestions,
 * alternatives — lives in a dropdown behind its small in-field control. Finite suggestion-chips
 * die everywhere — 400 SKUs never fit in five chips.»
 *
 * And Peter's own words on the composer, twice (V34, then V4 with heat): «the little tabs at the
 * top are bad… everything has like 400 skus so these suggestions look silly» · «it shouldn't have
 * the recommendations at the bottom… maybe it can have a dropdown appearing.»
 *
 * So the SHELF — the reserved row of suggestion chips that used to hang under this field — is
 * gone, and every offer it carried is behind THE DOOR: one in-field control on the right, one
 * dropdown under it, holding the completions while words are being written and the account's own
 * history while the field is empty. One seat, one thing at a time. The keys are untouched — ↓
 * opens and walks, Tab takes the top one, Enter takes the walked one — because the shelf's whole
 * value was the keyboard and none of it was the chips.
 *
 * ═══ KEYBOARD FIRST, BECAUSE THE HANDS ARE ALREADY THERE (§45.1) ════════════════════════════
 *   SPACE       seals the word and opens the next one — the only «commit» this field has
 *   ← →         at a word's edge, step into the word beside it; the chip re-opens as text
 *   BACKSPACE   at a word's start, step BACK into the previous word — the chip dissolves into
 *               text under the caret rather than vanishing. Nothing is ever deleted by arriving.
 *   ↑ ↓         open the door, and walk what it offers
 *   TAB         take the top offer, the way a shell completes
 *   ENTER       take the walked offer, or — with the door shut — write the line
 *   ESC         shut the door
 *
 * ═══ COPY, AGAINST BASE'S OWN GUIDELINES (§58.2) ════════════════════════════════════════════
 * Base's tag guidance: «keep them short, 1–2 words ideally · one line only · nouns or noun
 * phrases · avoid verbs». Every chip on this surface is a noun out of the reference or out of a
 * closed register, one line, never wrapped. The register label a suggestion carries («Preparation»,
 * «State», «Packaging») is the register's OWN label, which is a noun and never a sentence.
 * And there is no helper line anywhere on this organ (§51.7 — helper slop is banned app-wide).
 * THE PLACEHOLDER IS THE ONE SENTENCE, and §116.4 gives it its job: «free-form means type ANYTHING
 * — we recognize it — and the filler text says so in the canon register.» So it states the licence
 * AND carries a real example of the trade's own line inside itself, which teaches the grammar by
 * being it (§59.5, evidence by design rather than explanation).
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Popover, PLACEMENT } from 'baseui/popover';
import { Glyph, STEP } from './glyphs';
import { TOUCH_FLOOR, usePhone } from './shell/viewport';
import { Face, familyMarkOf, type IconFamily } from './product-face';
import {
  applyChip, parseChips, suggestChips,
  type Chip, type ChipLine, type ChipRegisters, type ChipSuggestion,
} from './chip-parse';

/* ═══ THE AI DOOR — OFFERED, NEVER IMPOSED (§83.2 → §109.7 → §113 → §116.1, ONE AFFORDANCE) ═══
 * ⚠ ITS FINAL FORM IS §116.1's: «Any spot with AI suggestions gets a little button INSIDE the
 * field, RIGHT side — THE ROCOTO ICON, the logo with the face, tiny. Press → the recommended list
 * opens, topical for that point. That's the classic AI ordering behavior.» The heart (§83.2) and
 * the clock (§109.7) are both superseded by ONE mark — the product's own face — everywhere the
 * layer offers anything. What changes with the moment is the LIST behind it, never the mark.
 * The clause below is kept because its DOCTRINE is untouched, and the doctrine is the point.
 *
 * «Perhaps you can put a little button in the fields of products that opens a little drop down
 * showing the customer's frequent purchases in most popular order. That's the level of AI native
 * — you get it? We make available but don't impose AI.»
 *
 * ── THE CORRECTION, AND IT IS THE WHOLE OF §109.7's THIRD POINT ─────────────────────────────
 * §83.2 put an unfilled HEART on the LEFT of the field. That is superseded: «when ACTIVE on the
 * field, a little HISTORY button sits INSIDE the field ON THE RIGHT, opening a dropdown of the
 * customer's history BELOW.» Three things follow, and every one of them is mechanical here:
 *   · THE SEAT IS ON THE RIGHT, INSIDE THE FIELD — the words run up to it, never around it.
 *   · IT SHOWS WHILE THE FIELD IS ACTIVE. The seat is RESERVED whether or not it is painted, so
 *     the caret arriving and leaving cannot move a single character (§37.3, and §51.14's own
 *     «hover may never move geometry», which a focus ring must keep too).
 *   · THE LIST IS PLAIN HISTORY. «It shouldn't display the full algorithm; it's not focused on
 *     the right thing» — so the rows are what they order, most-first, and NOTHING else: no count,
 *     no score, no source caption, no method mark. The honest sourcing stays in the code and in
 *     §63's own seats, and never on the picker's face.
 *
 * THE DOCTRINE, KEPT IN THE CODE THAT OBEYS IT: **we make AI available, we never impose it.** So
 * the offer is a DOOR and never a default — nothing is pre-filled, nothing is suggested into the
 * words, nothing changes if it is never pressed, and the whole organ behaves exactly as it did
 * before when no account is named. It joins §51.25's flow and §80's informed resolution as the
 * third leg: offer · resolve · never force.
 *
 * ═══ THE ORGAN STILL DOES NOT KNOW WHAT A SALE IS ══════════════════════════════════════════
 * That is this file's own contract (see the header), and the door does not break it: the SURFACE
 * that knows whose document is open OFFERS a list, through the context below, and the organ draws
 * the door when one is offered and nothing when none is. It never asks who the customer is, never
 * reads a ledger, and never computes a ranking — `insights.frequentOf` does that, where every other
 * fold in this app lives.
 *
 * ═══ AND THE PICK IS THE TYPING PATH, EXACTLY ══════════════════════════════════════════════
 * A favourite taken runs `take()` — the same function the suggestion shelf runs, which runs
 * `applyChip`, which is the same edit the keys would have made. There is no second way into this
 * field, so a line born of the history door and a line born of ten keystrokes are the same line by
 * construction (§62.4: ONE shared organ).
 */

/** ONE OFFER, as the surface hands it over. It is structurally `insights.Frequent`, restated here
 *  so this file imports nothing that knows about customers, albaranes or history.
 *
 *  ── AND IT IS A PRODUCT, NEVER A DOCUMENT (FEED-IA §109.8) ──────────────────────────────────
 *  «It shouldn't display the full ALBARÁN because it's not focused on the right thing.» The field
 *  this door stands in picks a PRODUCT, so every row in the list is line-level: a thing the account
 *  orders, with the house's own words for it. Nothing document-shaped can reach the list — no
 *  albarán id, no day, no document total — and the shape of this type is what makes that true
 *  rather than a rule somebody has to remember: there is nowhere here to put one. */
export type Favourite = {
  /** THE PRODUCT'S OWN ID (`insights.frequentOf` hands `l.product.id`). Line-level, by type. */
  id: string;
  /** THE WORDS THE COMPOSER WOULD WRITE — the house's own name for the goods, verbatim (§41.5) */
  phrase: string;
  /** how many of the account's albaranes in the window carried it — THE ORDER, never the caption.
   *  §109.7 takes «4 of 5» off the row: the list ranks BY this and never SAYS it. */
  count: number;
  /** how many albaranes the window holds. Kept on the offer, drawn nowhere (§109.7). */
  of: number;
  /** the name the painted library resolves a face from */
  face: string;
};

/** WHAT THIS ACCOUNT KEEPS TAKING, offered to every entry field standing inside the document.
 *  Empty is the resting state and the honest one: no account named, no history, no door. */
const Favourites = React.createContext<Favourite[]>([]);

/** THE SURFACE OFFERS; THE FIELD DRAWS. Mount this around a document and every chip field inside
 *  it — the add-a-line, a line being re-opened, the composer's own first line — carries the same
 *  offer, from one fold, computed once. */
export function OfferFavourites({
  of,
  children,
}: {
  of: Favourite[];
  children: React.ReactNode;
}) {
  return <Favourites.Provider value={of}>{children}</Favourites.Provider>;
}

/* ── THE TWO MARKS THIS FIELD'S RIGHT EDGE CARRIES (FEED-IA §116.1 · §116.2) ─────────────────
 * ROCOTO'S OWN FACE, MASKED — the shipping asset taking the ink of the seat it stands on. It is
 * `rail.tsx`'s own `RocotoMark` construction to the pixel, at a mark's size instead of a logo's,
 * so «the layer is offering something here» is drawn as the product itself and still re-themes.
 * ⚠ SEAM: the identical component is private inside `shell/glyphs.tsx` (`RocotoFace`). When that
 * file is free, export it there and delete this — one mark, one implementation (§30).
 */
function AiFace({ size, dim = false }: { size: number; dim?: boolean }) {
  return (
    <span
      data-rocoto-face="yes"
      aria-hidden="true"
      style={{
        display: 'block',
        width: size,
        height: size,
        flex: '0 0 auto',
        opacity: dim ? 0.35 : 1,
        backgroundColor: 'currentColor',
        WebkitMaskImage: 'url(/brand/rocoto-mark.svg)',
        maskImage: 'url(/brand/rocoto-mark.svg)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}

/** THE RETURN MARK — «literally Anthropic Claude as it is» (§116.2, his screenshot): the ↵ glyph,
 *  drawn on the vocabulary's own grid, in `currentColor`, so the button around it owns the ink. */
function ReturnMark({ size }: { size: number }) {
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

/* ── THE DIMENSIONS THE CALM DEPENDS ON ───────────────────────────────────────────────────── */

/** each side of every word, resolved or not — this is the space between words (see 1 above) */
const WORD_PAD = 3;
/** how far a chip's rule stops short of its own ends, so two chips beside each other read as two */
const RULE_INSET = 2;
const RULE_WEIGHT = 2;
/** the face's seat, per width. It never changes for what lands in it. */
const FACE_DESK = 40;
const FACE_PHONE = 32;
/* ── THE BAND HOLDS STILL (FEED-IA §119.2 — «the jitteryness can improve, the height keeps
 *    changing») ────────────────────────────────────────────────────────────────────────────────
 * Constant 6, joining the five above. Every word — the finished ones, and the one under the caret
 * — is set in a line box of exactly this height, DECLARED rather than inherited. An `<input>` and
 * a `<span>` holding the same characters do not agree about their own height on their own: the
 * input is a replaced-ish box the browser sizes from `line-height: normal` plus its own furniture,
 * the span sizes from the type ramp. One pixel of disagreement between them is a band that
 * changes height every time the caret steps from a written word into an empty one, which is
 * exactly the flicker being complained about. So the number is stated once, here, and both wear
 * it — and the band's floor is stated with it, so a field standing alone is the same height empty,
 * mid-sentence and finished. */
const WORD_LINE = 24;
/** the boxed field's own gutter — Base's `scale400`, stated as a number so the floor above can be
 *  computed from the same value the padding is drawn with (§119.2: one source, one height) */
const BOX_PAD = 8;

/** «Gamba» and «gamba» and «GAMBA» are one word, and so are «Palamós» and «palamos». The trade
 *  writes accents when it feels like it, so the door's narrowing reads folded (`search.tsx` folds
 *  the identical way for the catalogue — one behaviour, two implementations, and this one has no
 *  business importing a surface module). */
const fold = (word: string): string =>
  word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** how many completions the door offers. It is a dropdown over the surface now (§113), so the
 *  number is about what a person can read at a glance and never about what fits in a row. */
const OFFERS_DESK = 8;
const OFFERS_PHONE = 6;
/** one row of the dropdown, so the list's height is arithmetic rather than luck (§77.2) */
const OFFER_ROW = 36;

export type ChipEntryProps = {
  /** what the parser needs and this surface cannot know: the house's grade register, its sector,
   *  its own containers, and — on the edit path — the kind the line already stands on */
  registers: ChipRegisters;
  /** the family's mark, standing while the words support no kind yet. Defaults to the sector's. */
  family?: IconFamily;
  /** the words already on the line, where a consumer is re-opening one */
  initial?: string;
  /** every keystroke, with the reading beside the text — the consumer stores whichever it needs */
  onChange?: (line: ChipLine) => void;
  /** the line is written: Enter with no suggestion walked */
  onCommit?: (line: ChipLine) => void;
  /** an EXAMPLE of the trade's own sentence, never an instruction (§51.7) */
  placeholder?: string;
  /* ── WHAT THIS FIELD IS FOR, SAID ONCE (§30, and AUDIT-2 C6/C26) ─────────────────────────
   * The organ went onto its third and fourth surfaces — the New Product door and the catalogue's
   * own word — and on both of them it REPLACED a labelled control. A field whose whole content is
   * an example sentence has no name at all to a screen reader, so the surface hands one over and
   * it rides the box and the caret together. On the composer, where the surrounding card already
   * says whose line is being written, it stays unset and nothing changes. */
  label?: string;
  /** the field is the subject of the surface it is on, so it usually takes the caret on arrival */
  autoFocus?: boolean;
  /* ── THE FIELD IS A ROW OF THE SURFACE'S OWN LIST (FEED-IA §109.6) ───────────────────────────
   * «The hosted field is A SINGLE ROW, FULL WIDTH; as the text is captured it BECOMES COLUMNS in
   * place — the structure materializes under the words.»
   *
   * A surface that hosts this organ AS one row of its list hands the field the row's own geometry,
   * and the organ draws itself INTO it rather than sitting inside it as a boxed control. That is
   * what makes the morph possible at all: the field's box and the finished line's band are then
   * the SAME BOX — same floor, same gutter, same face seat — so the columns can materialize under
   * the words without one pixel of the row moving (§77.2 · §84.3).
   *
   * THE SHELF STAYS OUTSIDE THE BAND, and that is the second half of the same law. It is the
   * organ's own reserved row (see its note below) and it hangs UNDER the field — in the row's
   * margin, where a line keeps its notes (§14) — so the band's height is the field's alone and
   * cannot change when the shelf arrives, leaves, or holds six offers instead of two. */
  row?: {
    /** the mark a drive measures the band by, spent as `data-rowband` */
    mark?: string;
    /** the floor the band stands on, in px — the row's own height, held through the morph */
    floor?: number;
    /** the list's own gutter, so the face lands on the x every row's face lands on */
    padX?: number;
    padY?: number;
    /** the face seat the list gives its rows, so the painting never changes size across the morph */
    seat?: number;
  };
  /** THE ROW'S OWN COLUMNS, RIGHT OF THE WORDS — the money column and the row's tail seat, drawn
   *  INSIDE the field's band so the price stands in its constant place while the sentence is still
   *  being said (§109.3 · §109.5: the price is right of the midline on every product-level row,
   *  and a row being written is a product-level row). */
  trailing?: React.ReactNode;
  /* ── THE PHOTOGRAPH-A-DOCUMENT CONTROL, AT THE NAME MOMENT (FEED-IA §111.2 · §113 · §115.5) ──
   * «When they type the name is when they'd have the option of photographing a document» — and
   * §115.5 says the same thing about stock: «the field where they choose the product OR take a
   * photo». So the camera stands INSIDE this field, on the name moment, because that is the
   * moment a person's hand reaches for the paper in front of them.
   *
   * IT IS A REAL CONTROL AND IT POPULATES IN PLACE. The organ opens the picker (`capture` puts a
   * phone straight on the rear camera), hands the picture over, and if a SENTENCE comes back it
   * is written into this field exactly as if it had been typed — one parse, one road, the same
   * chips (§62.4). A reader that says nothing leaves the picture as evidence and the words as
   * theirs; the organ never invents a reading. */
  onPhotograph?: (file: File) => Promise<string | void> | string | void;
  /** the document already standing against these words — a CAPTURED fact, so the control wears it
   *  (§113: a chip may only show what landed) */
  document?: string | null;
  /* ── WHICH MARK THE OFFER DOOR WEARS (FEED-IA §131.4) ────────────────────────────────────────
   * «The rocoto logo icon should actually be in this case a PRODUCTS icon as it's their common
   * products. Or actually be a REWIND kinda icon like the one I showed… and then the other icons
   * of a similar kind should be topical but would usually be that kind.»
   *
   * §116.1 put Rocoto's own face on every field where the layer offers something, and that stands
   * as the DEFAULT — this prop is the topical exception §131.4 asks for, not a repeal of it. On
   * the albarán the door opens WHAT THIS ACCOUNT KEEPS ORDERING, which is their own past and not
   * Rocoto's suggestion, so the mark is the rewind: the same door, honestly named. */
  offerMark?: 'face' | 'rewind';
  'data-testid'?: string;
};

/* ═══ THE ORGAN, WIREFRAMED BEFORE IT IS DRAWN (FEED-IA §51.24 — THE WIREFRAME LAW) ═══════════
 * Regions, their contents, their type steps and their states, stated once; the JSX below is a
 * transcription of this block. Two regions, and there is no third — no header, no hint line, no
 * counter, no orphan sentence anywhere on this surface.
 *
 * ┌─ THE LINE ─ one field, and the whole trade sentence goes in it (§62.2) ────── states ──────┐
 * │    ┌────┐                                                             ⟲                     │
 * │    │FACE│  [merluza] [sin cabeza] [congelada] [caja 6 kg] ▎          16px  resting·focused  │
 * │    │40px│   name       prep        state       packaging  caret            resolving·theirs │
 * │    └────┘  ParagraphMedium throughout — ONE step, so nothing re-flows as a part resolves     │
 * │  THE HISTORY DOOR (§109.7, superseding §83.2's heart-on-the-left) — contentTertiary line     │
 * │  art INSIDE the field ON THE RIGHT, painted while the field is active, its seat always      │
 * │  reserved. Pressed, a dropdown BELOW it: what they order, most-first, and nothing else.     │
 * │  the    · name   600 weight, contentPrimary   — it is what the line is about                │
 * │  goods  · sort   500 weight, contentPrimary   — which one of them                           │
 * │  resolve· rest   400 weight, contentSecondary — the facts about it, one register each       │
 * │  live   · theirs 400 weight, contentPrimary, NO SKIN — unclaimed and unblocked (§41.5)      │
 * │         skin: backgroundSecondary + inset hairline · hover ring · active word underlined    │
 * │         (§51.14's one editable grammar: rest / ring hover / box open)                       │
 * │  THE RAIL, INSIDE THE FIELD ON THE RIGHT — two reserved seats, marks painted on focus:      │
 * │    📷  photograph a document (the name moment, §111.2) · attached, it wears the capture      │
 * │    ⌄   THE DOOR — one dropdown, over the surface, holding whichever offer the moment has     │
 * ├─ THE DROPDOWN ─ OFFERED, never imposed · never a chip (§113, §115.1) ───────────────────────┤
 * │  🐟 de pincho          words being written  →  the completions, ranked, most useful first    │
 * │  🦐 gamba roja         the field still empty →  what this account keeps ordering, most-first │
 * │  THE WORD, AND ONLY THE WORD (§109.7). No register caption, no score, no source, no method   │
 * │  face — those live in the trace and in §63's seats, never on the picker's face. It takes NO  │
 * │  layout at all: nothing under this organ can be moved by what we happen to know.             │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * WHAT THIS ORGAN DOES NOT DO, DELIBERATELY: it does not price, it does not commit, it does not
 * know what a sale is. It reads a sentence and hands back a reading. Every consumer — the sheet's
 * add-a-line, the New Product modal, the catalogue's search (§62.4) — owns what to do with it.
 */
export default function ChipEntry({
  registers,
  family,
  initial = '',
  onChange,
  onCommit,
  /* ── THE PLACEHOLDER IMPLIES THE POWER (FEED-IA §116.4) ────────────────────────────────────
   * «Free-form means type ANYTHING — we recognize it — and the filler text says so in the canon
   * register.» So the filler is a SENTENCE ABOUT WHAT THIS FIELD TAKES, carrying a real example
   * of the trade's own line inside it: it teaches the grammar by being it (§59.5) and states the
   * licence at the same time. It addresses the person directly, and it says what IS. */
  placeholder = 'Write it how you say it — 6 kg gamba roja 2ª',
  label,
  autoFocus = false,
  row,
  trailing,
  onPhotograph,
  document: attached = null,
  offerMark = 'face',
  'data-testid': testid = 'chip-entry',
}: ChipEntryProps) {
  const [css, theme] = useStyletron();
  const phone = usePhone();

  /* THE WORDS THEY HAVE WRITTEN, one per token, and which one holds the caret. It is a list of
     strings rather than one string because the caret lives INSIDE one of them: an organ that kept
     a single string would have to re-derive the caret's word on every render, and a re-derivation
     that ever disagreed with the DOM is a caret that jumps. */
  const [tokens, setTokens] = React.useState<string[]>(() => {
    const words = initial.trim().split(/\s+/).filter(Boolean);
    return words.length > 0 ? [...words, ''] : [''];
  });
  const [active, setActive] = React.useState(() => Math.max(0, initial.trim().split(/\s+/).filter(Boolean).length));
  /** which offer the arrows have walked to; -1 is «none, and Enter writes the line» */
  const [walk, setWalk] = React.useState(-1);
  const [focused, setFocused] = React.useState(false);
  /** THE DOOR IS SHUT UNTIL IT IS ASKED FOR (§83.2: offered, never imposed). ↓ opens it, the
   *  control opens it, Escape shuts it, and a field nobody opened behaves as it always did. */
  const [door, setDoor] = React.useState(false);
  /** the picture is being read; the control holds its place while it is (§77.2) */
  const [reading, setReading] = React.useState(false);

  /** where the caret must land after the next paint, when a key moved it between words */
  const caret = React.useRef<'start' | 'end' | null>(null);
  const input = React.useRef<HTMLInputElement | null>(null);
  /** the input node the last paint left standing, so a replaced one can be told from a moved one */
  const held = React.useRef<HTMLInputElement | null>(null);
  /** how far into the active word the caret was, kept so a replaced node can put it back */
  const offset = React.useRef(0);

  /* THE READING, ONCE PER KEYSTROKE. Empty tokens are not words — they are the caret's own seat —
     so the text handed to the parser is the words alone, and `lineIndex` maps this surface's token
     positions onto the parser's. Everything downstream reads ONE reading. */
  const words = React.useMemo(() => tokens.filter((t) => t !== ''), [tokens]);
  const text = React.useMemo(() => words.join(' '), [words]);
  const line = React.useMemo(() => parseChips(text, registers), [text, registers]);

  const lineIndex = React.useMemo(() => {
    const out: number[] = [];
    let n = 0;
    for (const t of tokens) out.push(t === '' ? -1 : n++);
    return out;
  }, [tokens]);

  /** where the active word sits in the parser's own token list — or, for the caret's empty seat,
   *  the position it would take if a word were typed there */
  const activeAt = React.useMemo(() => {
    if (lineIndex[active] >= 0) return lineIndex[active];
    let n = 0;
    for (let i = 0; i < active; i += 1) if (tokens[i] !== '') n += 1;
    return n;
  }, [active, lineIndex, tokens]);

  const shelf = React.useMemo(
    () => suggestChips(line, activeAt, registers, phone ? OFFERS_PHONE : OFFERS_DESK),
    [line, activeAt, registers, phone],
  );

  React.useEffect(() => { onChange?.(line); }, [line, onChange]);
  /* an offer the arrows had walked to is gone the moment the list changes under them */
  React.useEffect(() => { setWalk(-1); }, [text, active]);

  /* THE CARET SURVIVES THE PAINT. Two jobs, and the second one is a scar: where a key MOVED the
     caret between words, it lands where that key said; and where React replaced the input's own
     DOM node under a caret that had not moved, the caret is put back at the offset it held. The
     replacement is guarded on the OLD node having actually left the document, so this can never
     steal focus back from something a person deliberately pressed. */
  React.useLayoutEffect(() => {
    const el = input.current;
    const gone = held.current;
    held.current = el;
    if (!el) return;
    if (caret.current !== null) {
      const at = caret.current === 'start' ? 0 : el.value.length;
      el.focus();
      el.setSelectionRange(at, at);
      caret.current = null;
      return;
    }
    if (gone && gone !== el && !gone.isConnected && document.activeElement !== el) {
      const at = Math.min(offset.current, el.value.length);
      el.focus();
      el.setSelectionRange(at, at);
    }
  });

  React.useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  /* ── THE EDITS ─────────────────────────────────────────────────────────────────────────────
   * Every one of them is a pure move on `tokens` + `active`. NOTHING here parses, and nothing
   * here decides what a word means — that is `chip-parse.ts`'s single job, and keeping the two
   * apart is what lets the parser be tested by a node script with no DOM at all.
   */

  const write = (next: string[], at: number, where: 'start' | 'end' = 'end'): void => {
    setTokens(next.length > 0 ? next : ['']);
    setActive(Math.max(0, Math.min(at, Math.max(0, next.length - 1))));
    caret.current = where;
  };

  /** SPACE seals the word. Mid-word it splits, because a person who put a space in the middle of
   *  «merluzacongelada» has said where the two words divide. */
  const seal = (): void => {
    const el = input.current;
    const cut = el ? el.selectionStart ?? el.value.length : tokens[active].length;
    const said = tokens[active];
    const head = said.slice(0, cut);
    const tail = said.slice(cut);
    if (head === '' && tail === '') return;
    const next = [...tokens.slice(0, active), head, tail, ...tokens.slice(active + 1)];
    write(next, active + 1, 'start');
  };

  /** WHAT THIS ACCOUNT KEEPS TAKING, if a surface has offered it (§83.2 · §109.7). Read, never
   *  asked for: an organ with no offer draws no door and behaves exactly as it did before. */
  const favourites = React.useContext(Favourites);

  /** AN OFFER, TAKEN — the same edit typing it would have made, one press earlier.
   *
   *  ⚠ A GOODS ROW ANSWERS THE WHOLE QUESTION (§119.1). A completion finishes ONE word, so it
   *  replaces the word under the caret. A product out of the account's own list is the answer to
   *  «which goods», so it replaces THE SENTENCE — «merlu» picked from the list becomes «Merluza
   *  sin cabeza», never «merlu Merluza sin cabeza». One take, two spans, decided by what the row
   *  is rather than by where the caret happens to be. */
  const take = (s: ChipSuggestion, whole = false): void => {
    const span: ChipSuggestion = whole
      ? { ...s, from: 0, to: tokens.filter((t) => t !== '').length }
      : { ...s, from: active, to: tokens[active] === '' ? active : active + 1 };
    const next = applyChip(whole ? words : tokens, span);
    write(next.tokens, next.active, 'end');
    setDoor(false);
  };

  /* ── WHAT THE DOOR HOLDS, AND IT IS ONE THING AT A TIME (FEED-IA §113 · §115.1) ────────────
   * The completions while there are words being written; what the account keeps ordering while
   * the field is still empty. Both are OFFERS and both are rows — never chips, never a shelf —
   * and both go down the SAME road into the field (`take` → `applyChip`), so a line born of the
   * dropdown and a line born of ten keystrokes are one object by construction (§62.4). */
  const empty = words.length === 0;
  const offers = React.useMemo<Array<{ of: ChipSuggestion; product?: string }>>(() => {
    /* AND EVERY HISTORY ROW IS A PRODUCT, NEVER A DOCUMENT (§109.8). «It shouldn't display the
       full ALBARÁN because it's not focused on the right thing.» The row carries the product's
       own id so a drive can hold us to it; nothing document-shaped can reach this list, because
       the offer's own type has nowhere to put one. */
    const goods = [...favourites]
      .sort((a, b) => b.count - a.count)
      .map((f) => ({
        of: { word: f.phrase, part: 'name' as const, face: f.face, from: 0, to: 0 },
        product: f.id,
      }));
    if (empty) return goods;
    /* ── AND THE LIST NARROWS AS THE WORDS ARE WRITTEN (FEED-IA §116.1 · §119.1) ────────────
       «Free form entry to select product with SMART DROPDOWN.» The door was history-when-empty
       and completions-once-typing, which meant the moment a person wrote «merlu» the one list
       that holds their actual goods left the screen — and §113's whole reason for the dropdown
       is that the four hundred goods live in it. So the account's own products STAY, narrowed
       by every word so far, and they lead: a row that IS the thing being looked for outranks a
       completion of one word of its name. The completions follow, unchanged.
       THE MATCH IS ON THE WORDS THEMSELVES, all of them, in any order — the trade writes
       «gamba roja» and «roja gamba» for one thing, and a person who has typed two words has
       narrowed by two. */
    /* AND IT NARROWS THE WAY THE CATALOGUE NARROWS (§78.5's own rule, applied here): word by
       word, in writing order, and A WORD THAT WOULD LEAVE NOTHING IS HELD. «merluza sin cabeza»
       in a house whose row is «Merluza» keeps standing on the merluza instead of answering
       nought against three real words — the person is describing their goods, not failing a
       search. */
    const room = phone ? OFFERS_PHONE : OFFERS_DESK;
    let hits = goods;
    for (const w of words) {
      const term = fold(w);
      if (term === '') continue;
      const next = hits.filter((g) => fold(g.of.word).includes(term));
      if (next.length > 0) hits = next;
    }
    return [...(hits === goods ? [] : hits).slice(0, room), ...shelf.map((of) => ({ of }))].slice(0, room);
  }, [empty, words, shelf, favourites, phone]);
  /** the door only exists where there is something behind it — an empty dropdown is a promise
   *  broken, so the seat stays and the mark leaves (§37.3: the seat is layout, the mark is ink) */
  const offered = offers.length > 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const el = e.currentTarget;
    const at = el.selectionStart ?? 0;
    const whole = at === el.selectionEnd;

    if (e.key === ' ') { e.preventDefault(); seal(); return; }

    /* ── THE KEYS THE SHELF USED TO ANSWER, ANSWERED BY THE DOOR (§113) ─────────────────────
       The chips are gone and not one keystroke went with them. ↓ on a shut door OPENS it — which
       is the whole reason a person reaches for that key — and walks it from there; ↑ walks back;
       Tab completes the way a shell does; Escape shuts it. Nothing here opens itself. */
    if (e.key === 'ArrowDown' && offered) {
      e.preventDefault();
      if (!door) { setDoor(true); setWalk(0); return; }
      setWalk((w) => (w + 1) % offers.length);
      return;
    }
    if (e.key === 'ArrowUp' && offered) {
      e.preventDefault();
      if (!door) { setDoor(true); setWalk(offers.length - 1); return; }
      setWalk((w) => (w <= 0 ? offers.length - 1 : w - 1));
      return;
    }
    if (e.key === 'Tab' && shelf.length > 0 && tokens[active] !== '') {
      e.preventDefault();
      take(shelf[walk >= 0 && walk < shelf.length ? walk : 0]);
      return;
    }
    /* ── ENTER IS THE WHOLE ACT (FEED-IA §109.7: «Enter alone makes the row. Boom.») ─────────
       A suggestion the arrows have walked to takes the press, because a walked row is a thing a
       person is pointing at. With none walked, the sentence is finished and the consumer is told
       so — and on the albarán's add-a-line that hand-off WRITES THE LINE. There is no second press
       on the way and no button between the words and the row. */
    if (e.key === 'Enter') {
      e.preventDefault();
      if (door && walk >= 0 && offers[walk]) { take(offers[walk].of, Boolean(offers[walk].product)); return; }
      onCommit?.(line);
      return;
    }
    /* ESCAPE RELEASES THE INNERMOST THING FIRST (§32.A): the open door, and only then whatever
       stands outside this organ. A shut door lets the press through untouched. */
    if (e.key === 'Escape') {
      if (door) { e.preventDefault(); e.stopPropagation(); }
      setDoor(false);
      setWalk(-1);
      return;
    }

    /* BACKSPACE DISSOLVES, IT DOES NOT DELETE (§62.3, «a chip stays editable text»). At a word's
       start the caret steps BACK into the word before it, which re-opens that chip as text under
       the caret; the next press eats a character of it, and the skin comes off by itself the
       moment the word stops resolving. The only thing a backspace removes is the caret's own
       empty seat. */
    if (e.key === 'Backspace' && whole && at === 0) {
      if (tokens[active] === '') {
        if (tokens.length <= 1) return;
        e.preventDefault();
        write([...tokens.slice(0, active), ...tokens.slice(active + 1)], active - 1, 'end');
        return;
      }
      if (active > 0) {
        e.preventDefault();
        setActive(active - 1);
        caret.current = 'end';
      }
      return;
    }

    if (e.key === 'ArrowLeft' && whole && at === 0 && active > 0) {
      e.preventDefault();
      setActive(active - 1);
      caret.current = 'end';
      return;
    }
    if (e.key === 'ArrowRight' && whole && at === el.value.length && active < tokens.length - 1) {
      e.preventDefault();
      setActive(active + 1);
      caret.current = 'start';
    }
  };

  /* ── THE RENDER PLAN, AND THE ONE THING IT MUST NOT DO ─────────────────────────────────────
   * THE ROW OF WORDS IS FLAT. The obvious shape — a wrapper element per chip, with its words
   * inside — was written first and the drive caught it in the act: the moment «sin» and «cabeza»
   * fused into one prep chip, the word holding the CARET changed parent, React unmounted its
   * input and mounted a new one, and the rest of the sentence went to the document. A person
   * typing «merluza sin cabeza congelada caja 6 kg» got as far as «cabez» and then typed into
   * nothing. That is the §62 mechanic breaking on the very phrase §62 is written about.
   *
   * So a WORD IS NEVER RE-PARENTED. Every word is a direct child of the row for its whole life,
   * and a multi-token chip is drawn by SPLITTING ITS SKIN across the words it covers: the ground
   * runs under all of them, the corners round on the outer edges only, and the hairline is drawn
   * as top and bottom on every word plus a left on the first and a right on the last. Adjacent
   * words carry no gap between their boxes (the padding IS the gap, constant 1), so the split
   * skin reads as one continuous chip and the DOM never moves a node.
   *
   * The lesson generalises past this file: a live surface may re-PAINT anything on any keystroke
   * and may re-PARENT nothing that can hold a caret.
   */
  type Slot = {
    /** the token this run starts at — its key, and stable for as long as the run is */
    key: number;
    /** the tokens it draws, in order */
    tokens: number[];
    chip?: Chip;
    /** which chip index it belongs to, so hover lights the whole chip and not one run */
    at: number;
    /** does the run start / end its chip — the rule's insets and the ground's corners read these */
    first: boolean;
    last: boolean;
    active: boolean;
  };
  const slots = React.useMemo(() => {
    const out: Slot[] = [];
    let chipAt = -1;
    let held: Chip | undefined;
    for (let i = 0; i < tokens.length; i += 1) {
      const li = lineIndex[i];
      const chip = li < 0 ? undefined : line.chips.find((c) => li >= c.from && li < c.to);
      if (chip !== held) { chipAt += 1; held = chip; }
      const on = i === active;
      const before = out[out.length - 1];
      /* THE FINISHED WORDS OF ONE CHIP TRAVEL AS ONE RUN, and the word under the caret never
         joins them. One flex item cannot wrap inside itself, so «caja 6 kg» stays whole at 390
         — Base's own tag rule, «one line only» — while the caret's own word stays an element of
         its own for its whole life, which is the flat-DOM law that keeps it from being replaced
         mid-sentence. */
      if (!on && before && !before.active && before.chip === chip && chip) {
        before.tokens.push(i);
        before.last = true;
      } else {
        out.push({ key: i, tokens: [i], chip, at: chipAt, first: !before || before.chip !== chip, last: true, active: on });
      }
      const prior = out[out.length - 2];
      if (prior && prior.chip === chip && chip) prior.last = false;
    }
    return out;
  }, [tokens, lineIndex, line, active]);
  const [over, setOver] = React.useState(-1);

  const step = theme.typography.ParagraphMedium;
  const face = row?.seat ?? (phone ? FACE_PHONE : FACE_DESK);

  /* ── THE CAMERA'S MECHANICS, AND THEY ARE THE STOCK PANEL'S OWN (§113: one grammar) ────────
   * A hidden `input[type=file]` and a real control in front of it. `capture="environment"` opens
   * the rear camera on a phone straight at the document, and on a desk the same control opens the
   * picker — the identical mechanic `stock-announcement` uses, so a person who has photographed a
   * document on one surface has photographed it on both. */
  const file = React.useRef<HTMLInputElement | null>(null);
  const photograph = async (picture: File): Promise<void> => {
    setReading(true);
    let said: string | void;
    try {
      said = await onPhotograph?.(picture);
    } finally {
      setReading(false);
    }
    /* IT POPULATES IN PLACE (§113's beat, second station). The sentence the document said is
       written into these words as if a hand had typed it — one parse, the same chips, the caret
       waiting at the end of it. A reader with nothing to say leaves the words exactly as they
       are, because a picture nobody could read is evidence and never a correction. */
    if (typeof said !== 'string' || said.trim() === '') return;
    const next = said.trim().split(/\s+/).filter(Boolean);
    write([...next, ''], next.length, 'end');
  };

  /** the rail's seat — reserved whether or not a mark is painted in it (§37.3).
   *
   *  ⚠ ON A PHONE THE SEAT IS THE TARGET (INTX-12 · §188.2 · E193.14). §116.1 asks for the mark
   *  to be «tiny» and INTX-12 asks for «20 px line-icon family in 44–48 px optical-centred
   *  targets» — the same sentence read twice: the INK is 20 and the SEAT it is centred in is 44.
   *  It is RESERVED rather than overlapped on purpose: two 44px boxes with negative margins would
   *  overlap each other and the words being typed, and a press landing on whichever mark happens
   *  to be on top is worse than a field twenty pixels narrower. */
  const seat = phone ? TOUCH_FLOOR : STEP.medium;

  /* THE MARK CHANGES, THE SEAT NEVER DOES. One control's ink at a time, cross-faded on the
     theme's own timing, and instant for a reader who has asked for less motion (§59.1). */
  /* ── THE MARK IS TINY AND THE TARGET IS NOT (§116.1 · INTX-12 · E193.14) ──────────────────
     «THE ROCOTO ICON, the logo with the face, TINY» is the MARK, and it stays 20px on every
     housing. What a thumb has to land on is the BOX: on a phone it takes INTX-12's 44px floor
     around the same 20px ink, which the field can hold without moving because the field's own
     floor is the face's seat plus its two gutters and that is already taller than 44. */
  const doorMark = css({
    display: 'grid',
    placeItems: 'center',
    width: `${seat}px`,
    height: `${seat}px`,
    padding: '0',
    border: 'none',
    background: 'transparent',
    color: theme.colors.contentTertiary,
    cursor: 'pointer',
    fontFamily: 'inherit',
    opacity: focused || door ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: theme.animation.timing400,
    transitionTimingFunction: theme.animation.easeOutCurve,
    ':focus-visible': { opacity: 1 },
    '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
  });

  return (
    <div data-testid={testid} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>

      {/* ── THE LINE ─────────────────────────────────────────────────────────────────────── */}
      <div
        data-testid={`${testid}-field`}
        /* WHERE THE FIELD IS A ROW, IT WEARS THE ROW'S OWN MARK (§109.6) — so a drive measures the
           band a person types into with the same query it measures the band the line will stand
           on, and «the row's height must not jump» is a number rather than a claim. */
        data-rowband={row?.mark}
        role={label ? 'group' : undefined}
        aria-label={label}
        onMouseDown={(e) => {
          /* pressing the field's own ground puts the caret at the end, the way a text field does;
             pressing a WORD is that word's own business and must not be stolen from it */
          if ((e.target as HTMLElement).closest('[data-word]')) return;
          if ((e.target as HTMLElement).closest('button')) return;
          e.preventDefault();
          setActive(tokens.length - 1);
          caret.current = 'end';
          input.current?.focus();
        }}
        style={{
          display: 'flex',
          /* A BOXED FIELD GROWS DOWNWARD FROM ITS FIRST LINE; A ROW HOLDS ITS CONTENTS ON ITS OWN
             MIDLINE, the way every other row in the list does. */
          alignItems: row ? 'center' : 'flex-start',
          gap: theme.sizing.scale400,
          boxSizing: 'border-box',
          /* THE BAND'S FLOOR IS DECLARED, NOT INHERITED (§119.2). A hosting row states its own;
             a field standing on its own takes the face's seat plus its two gutters, which is the
             height it already had with nothing in it — so «empty», «being typed» and «finished»
             are one number instead of three that happen to agree. */
          minHeight: row ? row.floor : face + 2 * BOX_PAD,
          padding: row ? `${row.padY ?? 0}px ${row.padX ?? 0}px` : `${BOX_PAD}px`,
          borderRadius: theme.borders.radius200,
          background: theme.colors.backgroundPrimary,
          boxShadow: `inset 0 0 0 1px ${focused ? theme.colors.borderSelected : theme.colors.borderOpaque}`,
          cursor: 'text',
        }}
      >
        {/* THE FACE — the resolving seat (§41.5, `product-face.tsx`'s own contract): the family's
            mark while the words support no kind, the painting the moment one resolves, and never
            a wrong specific painting standing in for an ambiguous one.
            A HOSTING ROW STATES THE SEAT (§109.6) so the painting is the same size and on the same
            x before and after the morph — the picture changes, the layout never does (§59.1). */}
        <div style={{ paddingTop: row ? 0 : WORD_PAD, flex: '0 0 auto' }}>
          <Face
            name={line.node ? line.face : null}
            family={family ?? familyMarkOf(registers.sector)}
            size={face}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            /* the words carry their own gaps, so the row must add none — see constant 1 */
            gap: 0,
            minHeight: row ? undefined : face,
            flex: '1 1 auto',
            minWidth: 0,
            /* THE WORDS STAY IN THEIR OWN SLOT (§77.2: a slot declares its overflow). A run
               cannot wrap inside itself — «caja 6 kg» is one flex item on purpose — so a single
               long unbroken run (a placeholder written for a desk, read on a 390 phone) painted
               straight through the rail and under the camera, the face and the ↵. The slot
               clips instead, and the rail keeps its seats. */
            overflow: 'hidden',
          }}
        >
          {slots.map((slot) => (
            <Run
              key={slot.key}
              words={slot.tokens.map((i) => tokens[i])}
              chip={slot.chip}
              first={slot.first}
              last={slot.last}
              hovered={over === slot.at}
              active={slot.active}
              placeholder={tokens.length === 1 && tokens[0] === '' ? placeholder : undefined}
              label={label}
              inputRef={slot.active ? input : undefined}
              onPress={() => { setActive(slot.tokens[slot.tokens.length - 1]); caret.current = 'end'; }}
              onOver={() => setOver(slot.at)}
              onOut={() => setOver(-1)}
              onChange={(said) => setTokens(tokens.map((t, k) => (k === active ? said : t)))}
              onCaret={(n) => { offset.current = n; }}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              step={step}
            />
          ))}
        </div>

        {/* ── THE RAIL, INSIDE THE FIELD, ON THE RIGHT (FEED-IA §109.7 · §111.2 · §113) ────
            Two seats, both reserved, both painted only while the field is live — so the caret
            arriving and leaving cannot move a single character (§37.3, and §51.14's «hover may
            never move geometry», which a focus ring must keep too).

            SEAT 1 · THE CAMERA — «when they type the name is when they'd have the option of
            photographing a document» (§111.2). It stands at the NAME MOMENT and it is a real
            control: the picture goes to the surface's own reader and whatever sentence comes back
            is written into these words in place. A document already standing is a CAPTURED fact,
            so the mark wears it and stays painted (§113: chips show what landed).

            SEAT 2 · THE DOOR — §109.7's own affordance, generalised by §113. «A little button
            sits INSIDE the field ON THE RIGHT, opening a dropdown BELOW.» It is the one place
            anything OFFERED may live: the completions while words are being written, and what
            this account keeps ordering while the field is still empty. The mark says which of the
            two the moment holds — the clock for their history, the caret for the matches — and
            the seat under it never moves. */}
        <span
          data-testid={`${testid}-rail`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale100,
            /* the rail is as tall as whichever is bigger — the face's seat, or a phone's touch
               seat — so a 44px target is never taller than the rail it stands in (E193.14) */
            height: Math.max(face, seat), flex: '0 0 auto' }}
          /* the field's ground puts the caret at the end when it is pressed; this is not the
             ground, and the press belongs to the control. AND THE CARET NEVER LEAVES: the press
             is defaulted away, so opening a door does not blur the field — which is what keeps
             the mark painted under the hand that is pressing it. */
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        >
          {onPhotograph && (
            <React.Fragment>
              <input
                ref={file}
                type="file"
                accept="image/*"
                capture="environment"
                tabIndex={-1}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const picture = e.target.files && e.target.files[0];
                  if (picture) void photograph(picture);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                data-testid={`${testid}-photograph`}
                data-document={attached ?? undefined}
                data-reading={reading ? 'yes' : 'no'}
                aria-label={attached ? `The document on this line: ${attached}` : 'Photograph a document'}
                disabled={reading}
                onClick={() => file.current?.click()}
                className={css({
                  display: 'grid',
                  placeItems: 'center',
                  width: `${seat}px`,
                  height: `${seat}px`,
                  padding: '0',
                  border: 'none',
                  background: 'transparent',
                  /* A DOCUMENT THAT LANDED IS INK; AN OFFER IS QUIET (§113 · §51). The capture
                     stands at full strength whether or not anybody is looking at the field,
                     because it is a fact about this line and not an affordance. */
                  color: attached ? theme.colors.contentPrimary : theme.colors.contentTertiary,
                  cursor: reading ? 'progress' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: attached || focused ? 1 : 0,
                  transitionProperty: 'opacity',
                  transitionDuration: theme.animation.timing400,
                  transitionTimingFunction: theme.animation.easeOutCurve,
                  ':focus-visible': { opacity: 1 },
                  '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
                })}
              >
                <Glyph id={attached ? 'file' : 'camera'} size={STEP.small} />
              </button>
            </React.Fragment>
          )}

          {/* THE DOOR'S SEAT STANDS WHETHER OR NOT THERE IS ANYTHING BEHIND IT, and only the mark
              comes and goes — an offer arriving mid-sentence must not shove the words it is about
              (§59.1). Pressed with nothing behind it, it does nothing and says nothing. */}
          <Popover
            isOpen={door && offered}
            /* Base clones the anchor child and OVERWRITES its onClick with a forward to THIS
               prop — a handler on the button below never runs (measured: the door opened only
               by keyboard). The press lives here or nowhere. */
            onClick={() => { if (offered) { setDoor((v) => !v); setWalk(-1); } }}
            placement={PLACEMENT.bottomRight}
            /* THE CARET STAYS IN THE WORDS. A dropdown that seized focus would take the keys off
               the sentence a person is in the middle of writing, and the whole grammar above (↓ ↑
               Tab Enter) is written on the assumption that it never does. */
            autoFocus={false}
            focusLock={false}
            returnFocus={false}
            onClickOutside={() => setDoor(false)}
            onEsc={() => { setDoor(false); setWalk(-1); }}
            content={() => (
              <div
                data-testid={`${testid}-offers`}
                data-offering={empty ? 'history' : 'matches'}
                /* how many of the rows are THE ACCOUNT'S OWN GOODS rather than word completions
                   (§119.1's smart dropdown) — a number a drive can hold us to */
                data-goods={offers.filter((o) => o.product).length}
                role="listbox"
                aria-label={empty ? 'What they usually order' : 'Matches'}
                style={{
                  minWidth: phone ? 200 : 260,
                  maxWidth: 340,
                  maxHeight: OFFER_ROW * 6,
                  overflowY: 'auto',
                  padding: theme.sizing.scale100,
                }}
              >
                {offers.map((o, i) => (
                  <Offer
                    key={`${o.of.part}-${o.of.word}`}
                    of={o.of}
                    product={o.product}
                    walked={i === walk}
                    index={i}
                    family={family ?? familyMarkOf(registers.sector)}
                    testid={testid}
                    onPress={() => take(o.of, Boolean(o.product))}
                  />
                ))}
              </div>
            )}
          >
            <button
              type="button"
              data-testid={`${testid}-ai`}
              data-favourites={favourites.length}
              data-offers={offers.length}
              data-open={door && offered ? 'yes' : 'no'}
              data-active={focused ? 'yes' : 'no'}
              data-mark={offerMark}
              aria-label={empty ? 'What they usually order' : 'Matches'}
              aria-haspopup="listbox"
              aria-expanded={door && offered}
              onClick={() => { if (offered) { setDoor((v) => !v); setWalk(-1); } }}
              className={doorMark}
            >
              {/* ── THE UNIVERSAL AI BUTTON (FEED-IA §116.1) ─────────────────────────────
                  «Any spot with AI suggestions gets a little button INSIDE the field, RIGHT
                  side — THE ROCOTO ICON, the logo with the face, tiny. Press → the recommended
                  list opens, topical for that point. That's the classic AI ordering behavior.»

                  ⚠ IT REPLACES THE HEART AND THE CLOCK. §83.2 put an unfilled heart on the
                  left; §109.7 moved it right and made it a clock. §116.1 generalises both into
                  ONE affordance — the product's own face — everywhere the layer offers
                  anything. So the mark no longer changes with what is behind it; what changes
                  is the LIST, which is what «topical for that point» means.

                  ── AND ONE SURFACE ASKS FOR ITS OWN MARK (FEED-IA §131.4) ────────────────
                  «The rocoto logo icon should actually be in this case a products icon… or
                  actually be a rewind kinda icon like the one I showed.» On the albarán this
                  door opens THEIR OWN past orders, so the face — which claims Rocoto is
                  offering something of its own — is the wrong claim. The consumer says which
                  mark its point deserves; §116.1's face stays the default everywhere else. */}
              {offerMark === 'rewind' ? (
                <span style={{ display: 'flex', opacity: offered ? 1 : 0.35 }}>
                  <Glyph id="reset" size={STEP.small} />
                </span>
              ) : (
                <AiFace size={STEP.small} dim={!offered} />
              )}
            </button>
          </Popover>

          {/* ── THE ENTER BUTTON, INSIDE THE FIELD'S RIGHT EDGE (FEED-IA §116.2) ───────────
              «An ENTER BUTTON ICON on its right — literally Anthropic Claude as it is»: the ↵
              glyph in a small rounded button, at the field's right edge, doing exactly what the
              return key does. It is the hand's version of the keystroke and never a second act
              — one road in, whether a caret or a thumb takes it (§62.4).

              IT IS DRAWN, NOT BORROWED. Base has no return mark, so the glyph is the kit's own
              — and every value in it is the theme's: the seat, the radius, the hairline, the
              ink. It stands quiet until the words support a line, which is the only state this
              control has. */}
          {onCommit && (
            <button
              type="button"
              data-testid={`${testid}-enter`}
              data-ready={words.length > 0 ? 'yes' : 'no'}
              aria-label="Continue"
              disabled={words.length === 0}
              onClick={() => onCommit(line)}
              className={css({
                display: 'grid',
                placeItems: 'center',
                width: `${seat}px`,
                height: `${seat}px`,
                padding: '0',
                border: 'none',
                borderRadius: theme.borders.radius100,
                boxShadow: `inset 0 0 0 1px ${theme.colors.borderOpaque}`,
                background: theme.colors.backgroundSecondary,
                color: words.length > 0 ? theme.colors.contentPrimary : theme.colors.contentTertiary,
                cursor: words.length > 0 ? 'pointer' : 'default',
                fontFamily: 'inherit',
                opacity: focused || words.length > 0 ? 1 : 0,
                transitionProperty: 'opacity',
                transitionDuration: theme.animation.timing400,
                transitionTimingFunction: theme.animation.easeOutCurve,
                ':focus-visible': { opacity: 1 },
                '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
              })}
            >
              <ReturnMark size={STEP.small} />
            </button>
          )}
        </span>

        {/* THE ROW'S OWN COLUMNS, RIGHT OF THE WORDS (§109.3 · §109.5) — the money column and the
            row's tail seat, where the surface hosting this organ as a row hands them over. They
            stand INSIDE the band, so the price is already in its constant place while the sentence
            is still being said, and the morph moves nothing. */}
        {trailing}
      </div>
    </div>
  );
}

/* ── ONE RUN OF WORDS, AND ITS SHARE OF A CHIP'S SKIN ────────────────────────────────────────
 * A RUN is the finished words of one chip, drawn as one element — so a chip cannot break across
 * two lines at 390 (Base's tag rule: «one line only»), and «caja 6 kg» stays one thing where the
 * field wraps. The word under the caret is never part of a run: it is an element of its own for
 * its whole life, which is the flat-DOM law that stopped React replacing an input mid-sentence.
 *
 * THE WORDS INSIDE A RUN KEEP THEIR OWN PADDING and there is no space character between them, so
 * a run of two words is exactly as wide as those two words were as two elements. Merging is a
 * change of element, never of geometry — which is what lets a chip close up behind the caret
 * without the rest of the line shifting (§37.3, §59.1).
 *
 * THE SUBJECT TAKES A GROUND; EVERY OTHER FACT TAKES A RULE (§41.5, «slightly bold, slightly toned
 * against the rest of the text»). The first drive shot showed why: with a ground under every chip,
 * «merluza sin cabeza congelada caja 6 kg» painted as ONE grey slab — four chips reading as one,
 * the opposite of what §62 is for. A rule can be inset at its chip's own ends, so four facts read
 * as four; a ground cannot be, without moving the words.
 *
 * §51.14 ASKED FOR ONE EDITABLE GRAMMAR, AND THIS IS IT: one family — the rule under the words — at
 * three strengths. Quiet at rest; ink on hover, which is «this is a thing you can press»; ink at
 * full weight under the caret, which is «you are in this one». Every one of them is painted as a
 * background image, so none takes a pixel of layout.
 *
 * THE INPUT SIZES ITSELF WITH NO MEASURING. A hidden sizer and the input share ONE grid cell, so
 * the sizer's natural width IS the input's width — no ref, no `getBoundingClientRect`, no effect,
 * and therefore no frame in which the field is the wrong width. `size={1}` is load-bearing: an
 * input's default intrinsic width is twenty characters, and in a grid track that leaks — the first
 * drive shot had a 180px rule trailing every line.
 */
const WEIGHT: Partial<Record<Chip['part'], number>> = { name: 600, sort: 500 };

function Run({
  words,
  chip,
  first,
  last,
  hovered,
  active,
  placeholder,
  label,
  inputRef,
  onPress,
  onOver,
  onOut,
  onChange,
  onCaret,
  onKeyDown,
  onFocus,
  onBlur,
  step,
}: {
  words: string[];
  chip?: Chip;
  first: boolean;
  last: boolean;
  hovered: boolean;
  active: boolean;
  placeholder?: string;
  /** the organ's own name, where the surface it stands on gave it one (§30) */
  label?: string;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
  onPress: () => void;
  onOver: () => void;
  onOut: () => void;
  onChange: (said: string) => void;
  onCaret: (at: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  step: React.CSSProperties;
}) {
  const [, theme] = useStyletron();
  const part = chip?.part ?? 'text';
  const skinned = part !== 'text';
  const grounded = part === 'name';
  const quiet = skinned && part !== 'name' && part !== 'sort';
  const corner = theme.borders.radius100;
  const ends = { l: first ? RULE_INSET : 0, r: last ? RULE_INSET : 0 };

  const ink = active || hovered ? theme.colors.contentPrimary : theme.colors.contentTertiary;
  const rule = (active || (skinned && !grounded))
    ? {
      backgroundImage: `linear-gradient(${ink}, ${ink})`,
      backgroundRepeat: 'no-repeat' as const,
      backgroundSize: `calc(100% - ${active ? 0 : ends.l + ends.r}px) ${RULE_WEIGHT}px`,
      backgroundPosition: `${active ? 0 : ends.l}px 100%`,
    }
    : {};

  /** the type the words are set in — carried by the inner spans, so the run's own box is paint */
  const face: React.CSSProperties = {
    ...step,
    fontWeight: WEIGHT[part] ?? 400,
    color: quiet ? theme.colors.contentSecondary : theme.colors.contentPrimary,
    padding: `0 ${WORD_PAD}px`,
    whiteSpace: 'pre',
    /* CONSTANT 6 (§119.2). The written word and the input under the caret wear ONE declared line
       box, so stepping between them cannot move the band by the pixel the two would otherwise
       disagree by. It is set on the type, not on the box, so nothing here depends on which
       element the browser happens to be sizing. */
    lineHeight: `${WORD_LINE}px`,
    height: `${WORD_LINE}px`,
    boxSizing: 'border-box',
  };

  const skin: React.CSSProperties = {
    ...step,
    /* the run's own box wears constant 6 as well, so a run of three finished words and a run
       holding the caret are the same height by declaration and not by coincidence (§119.2) */
    lineHeight: `${WORD_LINE}px`,
    whiteSpace: 'nowrap',
    backgroundColor: grounded
      ? (hovered ? theme.colors.backgroundTertiary : theme.colors.backgroundSecondary)
      : undefined,
    borderTopLeftRadius: first ? corner : 0,
    borderBottomLeftRadius: first ? corner : 0,
    borderTopRightRadius: last ? corner : 0,
    borderBottomRightRadius: last ? corner : 0,
    ...rule,
  };

  const marks = {
    'data-word': part,
    'data-chip': skinned ? part : undefined,
    'data-chip-said': skinned ? chip!.said : undefined,
    'data-chip-first': skinned && first ? 'yes' : undefined,
    onMouseEnter: onOver,
    onMouseLeave: onOut,
  };

  if (!active) {
    return (
      <span {...marks} onMouseDown={(e) => { e.preventDefault(); onPress(); }} style={skin}>
        {words.map((w, k) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={k} style={{ ...face, display: 'inline-block' }}>{w}</span>
        ))}
      </span>
    );
  }

  const said = words[0] ?? '';
  return (
    <span {...marks} data-active="yes" style={{ ...skin, display: 'inline-grid', maxWidth: '100%' }}>
      <span aria-hidden="true" style={{ ...face, gridArea: '1 / 1', visibility: 'hidden' }}>
        {said || placeholder || ' '}
      </span>
      <input
        ref={inputRef}
        value={said}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onSelect={(e) => onCaret((e.currentTarget as HTMLInputElement).selectionStart ?? 0)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-label={label}
        size={1}
        autoComplete="off"
        spellCheck={false}
        data-testid="chip-caret"
        style={{
          ...face,
          gridArea: '1 / 1',
          width: '100%',
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
        }}
      />
    </span>
  );
}

/* ── ONE OFFER, AS A ROW OF THE DROPDOWN (FEED-IA §113 · §115.1) ─────────────────────────────
 * ⚠ THIS WAS A CHIP ON A SHELF, AND THE SHELF IS DEAD. «The little tabs at the top are bad…
 * everything has like 400 skus so these suggestions look silly» (V34), and again with heat: «it
 * shouldn't have the recommendations at the bottom… maybe it can have a dropdown appearing» (V4).
 * §113 made it general: A CHIP MAY ONLY SHOW A FACT THE PARSE LANDED; anything OFFERED lives in
 * a dropdown behind an in-field control. Five chips can never stand in for four hundred goods, and
 * a row of them under a live field is the surface guessing out loud.
 *
 * SO AN OFFER IS A ROW. It is the same object the field would have drawn — one press before it is
 * written — and it takes the SAME road in (`take` → `applyChip`), so nothing enters this field
 * down a second path (§62.4).
 *
 * THE WORD, AND ONLY THE WORD (§109.7). The register captions («Preparation · », «State · ») and
 * the accent dot that marked Rocoto's own reading are OFF this face — «no sources, no scores, no
 * method faces in the list» — and both are still true and still recorded, in the chip's `part`, in
 * the trace, and in §63's own seats. The painting stays, because a painting is what the goods LOOK
 * like and not how we found them.
 *
 * A MISS FALLS BACK TO THE FAMILY, NEVER TO A GUESS. `Face` draws the painting the library holds
 * for that name and the FAMILY's own silhouette where it holds none — so a rare fish the painted
 * library has not reached yet is drawn as a fish, never as a pantry jar. A wrong picture is worse
 * than a general one (§41.5).
 */
function Offer({
  of,
  product,
  walked,
  onPress,
  index,
  family,
  testid,
}: {
  of: ChipSuggestion;
  /** the product's own id, where this row came out of the account's history (§109.8) */
  product?: string;
  walked: boolean;
  onPress: () => void;
  index: number;
  family: IconFamily;
  testid: string;
}) {
  const [css, theme] = useStyletron();
  return (
    <button
      type="button"
      role="option"
      aria-selected={walked}
      data-testid={`${testid}-offer-${index}`}
      data-suggestion={of.part}
      /* THE SOURCING STAYS IN THE CODE (§109.7). Which register answered, and whether this offer
         is Rocoto reading their line rather than searching their word, are still HERE — readable
         by a drive, carried into the trace — and simply not drawn on the row. */
      data-register={of.register}
      data-rocoto={of.rocoto ? 'yes' : 'no'}
      data-product={product}
      data-level={product ? 'line' : undefined}
      onMouseDown={(e) => { e.preventDefault(); onPress(); }}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        width: '100%',
        height: `${OFFER_ROW}px`,
        padding: `0 ${theme.sizing.scale300}`,
        borderRadius: theme.borders.radius100,
        border: 'none',
        background: walked ? theme.colors.backgroundSecondary : 'transparent',
        color: theme.colors.contentPrimary,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        minWidth: 0,
        ':hover': { background: theme.colors.backgroundSecondary },
      })}
    >
      {of.face ? <Face name={of.face} family={family} size={20} /> : null}
      <span
        style={{
          ...theme.typography.LabelSmall,
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {of.word}
      </span>
    </button>
  );
}
