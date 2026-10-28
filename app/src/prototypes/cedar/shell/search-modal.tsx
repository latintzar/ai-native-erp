/* THE ONE SEARCH MODAL — every search in the app, in one shape (FEED-IA §91.2).
 *
 * «i think all search should be like this in fact. makes search VERY simple, or rather very
 * consistent» — Peter, 2026-08-29, looking at the onboarding modal §91.1 describes: centred, a
 * search field leading, the list beneath, closing on Esc or on a press outside, and «closing FAR
 * FASTER than it opens». And beside it, in the same breath: «see how well claude uses icons?»
 *
 * ═══ WHAT IS ONE, AND WHAT VARIES ═══════════════════════════════════════════════════════════
 * ONE ORGAN. There is a single search surface in this app and this file is it. A surface no longer
 * grows a field of its own; it declares an INTENT and hands over the word it is standing on, and
 * the same box opens over it every time.
 *
 *   THE SHAPE NEVER VARIES — a centred dialog, the field at its head, the list under it, one
 *   grammar of row (a mark · the word · what is true about it, trailing), ↑↓ to walk, ↵ to open,
 *   Esc or a press outside to close.
 *   THE LIST VARIES — products in Stock, accounts in the book, conversations in the chats, the
 *   administration's seats, the founder's houses, and all of them at once from the keyboard.
 *   THE DOORS VARY WITH IT — §43's law is what a row IS: «every appearance of an object anywhere
 *   is a door to that object». There is no row here that only reads.
 *
 * Cedar's current interaction contract uses 400 ms for both arrival and dismissal
 * (FEED-IA §243; OPERATIONS-HUB-SPEC). The earlier asymmetric search animation remains
 * recorded in §91.1; the current candidate follows its shared 400 ms cadence.
 *
 * ═══ THE KEY (§32.A's grammar, audited) ═════════════════════════════════════════════════════
 * §32 decided this app's shortcut register: «single letters, no modifiers. P = print + advance.
 * ← → = walk.» The audit of what is actually bound: `P` on the river's sweep, ←/→ walking a list,
 * ↑/↓ walking the catalogue and the menus, Home/End in the catalogue, Enter committing a field,
 * Escape releasing the innermost thing. No letter is free enough to take, and none of them should
 * be — a letter that summons a modal from the middle of a sweep is a letter that will do it by
 * accident.
 *
 *   «/» IS THE KEY, and it is the honest one: it is not a letter, so it collides with nothing §32
 *   decided; it carries no modifier, so it stays inside §32's own register; and it is what every
 *   app a person already uses binds search to. It is drawn on the rail's own find row as a keycap,
 *   which is the only place in this app a shortcut is ever advertised (§32's «a little square with
 *   the letter in it»).
 *
 *   ⌘K / Ctrl+K IS THE SAME DOOR, and it exists for one reason rather than for completeness: «/»
 *   is a CHARACTER, so it cannot be taken from somebody who is typing. A person mid-sentence in
 *   the composer still has to be able to reach the search, and the command-palette chord is the
 *   one every desk already knows. Two keys, one door, and the second one earns its place.
 *
 * ═══ AND §35.1's NARROW SURVIVES, WHICH IS WHY A SEAT EXISTS ════════════════════════════════
 * «Filter-as-you-type in Sales, in customers, and in products» is built law and people work in it:
 * the word thins the book and the misses vanish. Killing it to make room for a palette would be
 * trading a working habit for a shape.
 *
 * So a surface REGISTERS ITS SEAT — its intent, the word it holds, and the setter that takes a new
 * one — and while the modal stands over that surface, what a person types goes to BOTH: the
 * surface narrows behind, and the modal's own list offers the doors. Closing leaves the narrow
 * standing, because a narrow that vanished with the box that set it would make the seat a place
 * where work is lost. The summon control says so: it is a mark while the seat is empty and a
 * NARROW CHIP carrying the word while it holds one, with its own release (§51.25 — «an active
 * narrow must stay visible, and pressing it puts the book back»).
 *
 * A SURFACE WHOSE FIELD IS ITS OWN ORGAN HANDS THE ORGAN OVER. Stock's word is §62's chip entry —
 * the trade's sentence, parsed as it is typed — and that is not a second search, it is THIS search
 * in the trade's own words. It rides the identical seat at the head of the identical box, so the
 * shape is unchanged and the surface keeps its organ.
 */
import * as React from 'react';
import { useWorkspaceCapabilities } from '../workspace-capabilities';
import { useStyletron } from 'baseui';
import { Modal, ROLE, SIZE as MODAL_SIZE } from 'baseui/modal';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { useConfig } from '../config';
import { openCustomer, openProduct } from '../anchors';
import { Glyph, Keycap, STEP, type GlyphId } from '../glyphs';
import { Mark, matches, termsOf, wordsOf } from '../search';
import {
  ADMIN_FOOT, ADMIN_ORDER, ADMIN_RAIL_WORD, ADMIN_TITLE, AREA_TITLE, RAIL_ORDER,
  type AdminSeatId, type AreaId,
} from './area';
import AreaGlyph, { AdminSeatMark } from './glyphs';
import { useHardwareKeys, usePhone, usePhoneFloor } from './viewport';
import type { Thread } from './threads';
import { CASTS, SECTORS, comercialOf, familyOf, type Cast } from '../../../scenarios/data/cast';

/* ── WHAT A SEARCH IS ABOUT ───────────────────────────────────────────────────────────────── */

/** The six lists this one box draws. `everything` is what the keyboard opens: no surface asked,
 *  so the whole app answers. Four of the others are a surface saying what it is standing in.
 *
 *  `houses` CARRIES NO MARK OF ITS OWN, and that is deliberate rather than unfinished. The three
 *  houses are a founder's control (§89.2) living at the foot of one seat — a region of three cards
 *  is not a list anybody searches — so nothing draws a magnifier for it. It is a REGISTER before it
 *  is a seat: the houses stand in `everything`, so typing «Carns» from any surface finds the meat
 *  house and doors to the card that switches to it, and the standalone intent is here for whatever
 *  surface earns a mark for it later. */
export type SearchIntent =
  | 'everything'
  | 'products'
  | 'customers'
  | 'threads'
  | 'admin'
  | 'houses';

/** THE WORD A SURFACE IS STANDING ON, and the way back to it. A surface with no narrow of its own
 *  registers nothing and the modal keeps its own word for the duration. */
export type SearchSeatDecl = {
  intent: SearchIntent;
  /** what the surface is filtered by right now */
  query: string;
  /** the surface takes a new word — §35.1's narrow, driven from the modal's field */
  onQuery: (next: string) => void;
  /** the testid the surface's own field already answered to, so the seat keeps its name when it
   *  moves into the box (`customers-search-field`, `chats-search-field`) */
  fieldTestid?: string;
  /** a surface whose search field is its own organ draws it here. `commit` is what ↵ does when the
   *  organ has consumed the key itself: it opens the row the walk is standing on. */
  field?: (opts: { commit: () => void }) => React.ReactNode;
  /** the word the summon control says about what it searches — the placeholder and the label */
  label: string;
};

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────────
 * A module singleton with `useSyncExternalStore` over it, which is the pattern the rail's own
 * state and the print queue already keep. It is not React state on purpose: the seat is written
 * during a surface's render cycle and read during the modal's, and a context threaded from the
 * frame down through every area would make one shared fact into a prop on four packages.
 */

type SeatReader = { read: () => SearchSeatDecl };

const SEATS = new Map<SearchIntent, SeatReader>();

/** the intent standing open, or nothing */
let standing: SearchIntent | null = null;

/** bumped on every change either side cares about — the box opening or closing, and the seat's
 *  word moving under it, because the modal's own list is computed from that word */
let version = 0;

const listeners = new Set<() => void>();

const bump = (): void => {
  version += 1;
  for (const fn of listeners) fn();
};

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const readVersion = (): number => version;

/** Open the one search, on the list this place is about. Exported so any control anywhere can be
 *  the summon, and so a drive can put the app in the state without hunting for a mark. */
export function openSearch(intent: SearchIntent = 'everything'): void {
  if (standing === intent) return;
  standing = intent;
  bump();
}

/** Put it away. */
export function closeSearch(): void {
  if (standing === null) return;
  standing = null;
  bump();
}

/** Which list is standing open, if any. */
export function useSearchOpen(): SearchIntent | null {
  React.useSyncExternalStore(subscribe, readVersion, readVersion);
  return standing;
}

/** The seat a surface has registered for this intent, live. */
const seatOf = (intent: SearchIntent): SearchSeatDecl | null => SEATS.get(intent)?.read() ?? null;

/**
 * A SURFACE DECLARES ITS SEAT.
 *
 * The declaration is read through a ref rather than copied into the map, so the modal always sees
 * the surface's CURRENT word and its current field without the surface having to re-register on
 * every keystroke. Only two things wake the modal: the seat arriving or leaving, and the word
 * changing — which is exactly what the modal's own list depends on.
 */
export function useSearchSeat(seat: SearchSeatDecl): void {
  const latest = React.useRef(seat);
  latest.current = seat;

  const { intent, query } = seat;

  React.useEffect(() => {
    const reader: SeatReader = { read: () => latest.current };
    SEATS.set(intent, reader);
    bump();
    return () => {
      if (SEATS.get(intent) === reader) SEATS.delete(intent);
      bump();
    };
  }, [intent]);

  React.useEffect(() => {
    bump();
  }, [query]);
}

/* ── THE ROWS ─────────────────────────────────────────────────────────────────────────────── */

/** ONE ROW, and there is one kind (§85's grammar): a mark, the word, and what is true about it
 *  trailing. `words` is the folded index the filter runs on — built once per row, never per
 *  keystroke — and `open` is the door, because there is no row here that only reads (§43). */
export type PickRow = {
  key: string;
  kind: string;
  mark: React.ReactNode;
  word: string;
  context?: string;
  words: string[];
  open: () => void;
  /** ── THE EYE BESIDE A ROW (FEED-IA §129.2) ──────────────────────────────────────────────
   *  «You select the type of print then the thing on the list, with each thing on the list having
   *  the eye sub button.» A row whose door PRINTS is a row somebody may want to LOOK at first, so
   *  it takes the app's own dual-flush relationship one level out: the row is the act, the eye
   *  beside it is the preview. It is the same pair `PrintFlush` draws on a document — same order,
   *  same mark, same meaning — and a row that has nothing to preview simply carries none. */
  peek?: { label: string; onPeek: () => void };
};

export type PickGroup = { title: string; rows: PickRow[] };

type Found = PickRow;
type Group = PickGroup;

/** A GLYPH ROW'S MARK, at the step §85's own menu draws — the foot menu and this list are the same
 *  kind of object and must not disagree about how big a mark is. */
const mark = (id: GlyphId): React.ReactNode => <Glyph id={id} size={STEP.medium} />;

/** HOW MANY OF ONE KIND A GROUP SHOWS. A palette that printed three hundred accounts would be a
 *  list nobody reads to the end; the word is how you get past the cap, and it always works. */
const CAP_ONE = 40;
const CAP_MANY = 5;

/** THE PLACES — the workspace's own areas (Money only where it is on), drawn with the navigation's own marks so a place looks the same
 *  in the search as it does in the rail (§43's one visual identity per object). */
const places = (money: boolean): Found[] =>
  RAIL_ORDER.filter((id) => id !== 'money' || money).map((id: AreaId) => ({
    key: `area-${id}`,
    kind: 'area',
    mark: <AreaGlyph id={id} size={STEP.medium} />,
    word: AREA_TITLE[id],
    context: 'Where you work',
    words: wordsOf([AREA_TITLE[id]]),
    open: () => {
      window.location.hash = `#/${id}`;
    },
  }));

/** THE ADMINISTRATION'S SEATS. The nine, and the personal seat at the foot — the same order and
 *  the same words its own rail draws, read from the one registry rather than restated.
 *
 *  THE FOOT SEAT WEARS `who`, WHICH IS WHAT ITS OWN RAIL DRAWS. `AdminSeatMark` answers `null`
 *  there — the rail puts the person's face on the desk's chip and the mark on the world's seat —
 *  so this row takes the seat's mark, from the one place it is already decided (`admin-account` in
 *  `rail.tsx`). One object, one identity, wherever it appears (§43). */
const seats = (): Found[] =>
  [...ADMIN_ORDER, ADMIN_FOOT].map((seat: AdminSeatId) => ({
    key: `seat-${seat}`,
    kind: 'seat',
    mark: seat === ADMIN_FOOT ? mark('who') : <AdminSeatMark id={seat} size={STEP.medium} />,
    word: ADMIN_TITLE[seat],
    context: 'Administration',
    words: wordsOf([ADMIN_TITLE[seat], ADMIN_RAIL_WORD[seat], 'administration']),
    open: () => {
      window.location.hash = `#/admin/${seat}`;
    },
  }));

/** THE FOUNDER'S HOUSES (§89.2). The row is a door to the control rather than the control itself:
 *  picking a house re-seeds the whole app — catalogue, book, prices, zones — and an act that
 *  large belongs on the card that states what it does, under its own confirmation, not on a row
 *  a walk can land on by accident. So this opens the seat the houses live at the foot of. */
const houses = (here: string): Found[] =>
  SECTORS.map((s) => {
    const cast = CASTS[s];
    return {
      key: `house-${s}`,
      kind: 'house',
      mark: mark('brand'),
      word: cast.house.name,
      context: s === here ? `${cast.trade} · standing` : cast.trade,
      words: wordsOf([cast.house.name, cast.trade, cast.label]),
      open: () => {
        window.location.hash = '#/admin/account';
      },
    };
  });

const products = (cast: Cast): Found[] =>
  cast.products.map((p) => {
    const family = familyOf(cast, p);
    return {
      key: `product-${p.id}`,
      kind: 'product',
      mark: mark('crate'),
      word: p.name,
      context: family.name,
      words: wordsOf([p.name, p.code, family.name, p.unit]),
      open: () => openProduct(p.id),
    };
  });

const customers = (cast: Cast): Found[] =>
  cast.customers.map((c) => {
    const holder = comercialOf(cast, c);
    return {
      key: `customer-${c.id}`,
      kind: 'customer',
      mark: mark('who'),
      word: c.name,
      context: holder?.name ?? c.zone,
      words: wordsOf([c.name, c.zone, holder?.name, c.tier]),
      open: () => openCustomer(c.id),
    };
  });

/** THE CONVERSATIONS. The index is the thread's own `words` — the customer's name, every sentence,
 *  every transcribed word and everything read off a photograph, folded once per conversation
 *  (§46.2) — so a search here finds what was SAID in a voice note, which is the whole point of
 *  that field existing. */
const conversations = (threads: Thread[], onThread: (id: string) => void): Found[] =>
  threads.map((t) => ({
    key: `thread-${t.id}`,
    kind: 'thread',
    mark: mark('chat'),
    word: t.customer.name,
    context: t.at,
    words: t.words,
    open: () => onThread(t.id),
  }));

/** THE LISTS, PER INTENT. An empty word on `everything` answers with the app's own map — the
 *  places and the seats — because a palette with nothing typed in it should be navigation, and
 *  three hundred accounts under a blank field is not an answer to anything. */
function groupsFor(
  intent: SearchIntent,
  terms: string[],
  ctx: { cast: Cast; threads: Thread[]; onThread: (id: string) => void; money: boolean },
): Group[] {
  const { cast, threads, onThread, money } = ctx;
  /* ── A STRING ON EVERY ROW IS WALLPAPER, NOT A HELPER ─────────────────────────────────────
   * THE-CONTENT-CANON's own finding, from the sweep that killed «agent's four routing rows
   * carried ONE sentence four times»: a fact printed identically on every row of a list has
   * stopped being a fact about any of them. It happens here by arithmetic rather than by
   * carelessness — every place says «Where you work», every seat says «Administration», and a
   * house with one family says the family twelve times — so it is answered by arithmetic: where
   * a group's rows would all carry the SAME trailing word, the group's own heading has already
   * said it and the slot is dropped. Where they differ, every one of them is a fact and they
   * all stay. */
  const level = (rows: Found[]): Found[] =>
    new Set(rows.map((r) => r.context ?? '')).size > 1
      ? rows
      : rows.map((r) => ({ ...r, context: undefined }));

  const keep = (rows: Found[], cap: number): Found[] =>
    level((terms.length === 0 ? rows : rows.filter((r) => matches(terms, r.words))).slice(0, cap));

  if (intent === 'products') return [{ title: 'Goods', rows: keep(products(cast), CAP_ONE) }];
  if (intent === 'customers') return [{ title: 'Accounts', rows: keep(customers(cast), CAP_ONE) }];
  if (intent === 'threads') {
    return [{ title: 'Conversations', rows: keep(conversations(threads, onThread), CAP_ONE) }];
  }
  if (intent === 'admin') return [{ title: 'Administration', rows: keep(seats(), CAP_ONE) }];
  if (intent === 'houses') return [{ title: 'Houses', rows: keep(houses(cast.sector), CAP_ONE) }];

  if (terms.length === 0) {
    return [
      { title: 'Places', rows: level(places(money)) },
      { title: 'Administration', rows: level(seats()) },
    ];
  }
  return [
    { title: 'Places', rows: keep(places(money), CAP_MANY) },
    { title: 'Accounts', rows: keep(customers(cast), CAP_MANY) },
    { title: 'Goods', rows: keep(products(cast), CAP_MANY) },
    { title: 'Conversations', rows: keep(conversations(threads, onThread), CAP_MANY) },
    { title: 'Administration', rows: keep(seats(), CAP_MANY) },
    { title: 'Houses', rows: keep(houses(cast.sector), CAP_MANY) },
  ];
}

/* ── THE SMALL PARTS ──────────────────────────────────────────────────────────────────────── */

/** ONE LINE, CLIPPED (§77.2's register). Both text slots on a row declare the same thing, once, so
 *  a forty-character account name can never make one row taller than the one under it. */
const oneLine: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

/** THE LAYER THE ONE SEARCH STANDS ON.
 *
 *  IT HAS TO BE STATED, AND A DRIVE FOUND OUT WHY. Base's `Layer` carries no z-index at all
 *  (`layers-manager` leaves it undefined), so a modal is a positioned element at `auto` — which
 *  paints UNDER every positioned element in this app that names a number, and this app names
 *  several: the day bar sits at 2, the conversation's panel at 8 and its launcher at 9, every
 *  popover Body at 12, the picture lightbox at 13. A search that can be summoned from all of them
 *  has to stand over all of them, so it takes the number above the highest one there is.
 *
 *  On the phone the symptom was literal: the box opened, and the day bar painted straight through
 *  the top of it and went on taking presses. */
const SEARCH_LAYER = 16;

/** THE ROW HEIGHTS ARE §85's OWN. 44px is what the foot menu gives a word, and this list is the
 *  same object one level up; stating it rather than deriving it is what keeps a long name from
 *  making a taller row than a short one. */
const ROW = 44;

function Row({
  row,
  terms,
  high,
  onPick,
  onEnter,
}: {
  row: Found;
  terms: string[];
  high: boolean;
  onPick: () => void;
  onEnter: () => void;
}) {
  const [, theme] = useStyletron();
  return (
    /* ── THE ROW IS A SEAT, AND THE ACT IS THE BUTTON IN IT (§129.2) ────────────────────────
       The ground moved out of the button and onto the seat around it, because a row that carries
       an eye carries TWO targets and a highlight that stopped at the first of them would draw a
       line down the middle of one row. The seat is 44px at every state — with an eye and without
       one — so a list where some rows preview and some do not stays one list (§77.2). */
    <div
      data-row-seat={row.key}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        height: ROW,
        background: high ? theme.colors.backgroundSecondary : 'transparent',
        minWidth: 0,
      }}
    >
    <button
      type="button"
      data-testid="search-row"
      data-row-kind={row.kind}
      data-row-key={row.key}
      data-row-high={high ? 'yes' : 'no'}
      onMouseEnter={onEnter}
      onClick={onPick}
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale500,
        flex: '1 1 auto',
        height: '100%',
        padding: `0 ${theme.sizing.scale600}`,
        border: 'none',
        background: 'transparent',
        color: theme.colors.contentPrimary,
        fontFamily: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        minWidth: 0,
      }}
    >
      <span style={{ display: 'inline-flex', flex: '0 0 auto', color: theme.colors.contentSecondary }}>
        {row.mark}
      </span>
      <span data-row-word="yes" style={{ ...theme.typography.LabelMedium, ...oneLine, flex: '1 1 auto' }}>
        <Mark text={row.word} terms={terms} />
      </span>
      {row.context && (
        <span
          data-row-context="yes"
          style={{
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentTertiary,
            ...oneLine,
            flex: '0 1 auto',
            maxWidth: '45%',
            textAlign: 'right',
          }}
        >
          <Mark text={row.context} terms={terms} />
        </span>
      )}
    </button>
      {/* THE EYE, WHERE THE ROW HAS SOMETHING TO LOOK AT (§129.2). It is the row's SECOND target
          and never its first: pressing the row does the act, pressing this opens the paper. The
          press is stopped from reaching the seat, because a preview that also printed would be
          the eye doing the big flush's job. */}
      {row.peek && (
        <button
          type="button"
          data-testid="pick-eye"
          data-row-key={row.key}
          aria-label={row.peek.label}
          title={row.peek.label}
          onMouseEnter={onEnter}
          onClick={(e) => {
            e.stopPropagation();
            row.peek?.onPeek();
          }}
          style={{
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            width: ROW,
            height: '100%',
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: theme.colors.contentTertiary,
            cursor: 'pointer',
          }}
        >
          <Glyph id="eye" size={STEP.medium} />
        </button>
      )}
    </div>
  );
}

/* ── THE ORGAN, LIFTED OUT OF THE BOX (FEED-IA §129.2) ────────────────────────────────────────
 * «The print options would be in the export thing except if you go to the export thing you'd be
 * asked to select the date from a list JUST LIKE CLAUDE'S SEARCH THING.» — Peter, 2026-08-29.
 *
 * So a SECOND surface now asks a question in this box's grammar, and there was exactly one way to
 * do that without minting a second modal anatomy: the ANATOMY comes out of `SearchModal` and both
 * callers mount it. The field at the head, the sectioned rows under it, ↑↓ to walk, ↵ to take, the
 * keycaps in the foot — one drawing, one set of heights, one set of testids, two questions.
 *
 * WHAT STAYED BEHIND IN `SearchModal`: the Modal itself, its layer, its asymmetric motion, the
 * keyboard summon and the SEAT REGISTRY. Those are about being THE app's one palette. The export
 * centre is already a dialog, so it takes the list and nothing else — a modal inside a modal is
 * the second anatomy this refactor exists to prevent.
 *
 * THE TESTIDS FOLLOW THE CALLER, so `search-modal-seat` / `-list` / `-foot` / `-field` / `-empty`
 * are exactly what they were and `drive-search.py` never learns that this moved.
 */
export function PickList({
  testid = 'search-modal',
  intent,
  groups,
  terms = [],
  query,
  onQuery,
  label,
  field,
  fieldTestid,
  onTake,
  head,
}: {
  /** the testid stem every part of the list answers to — the caller's own name for this question */
  testid?: string;
  /** what the box is asking about, stated on the body for a drive to read */
  intent?: string;
  /** the rows, already filtered by the caller — this organ draws and walks, it never decides */
  groups: PickGroup[];
  /** the words the caller filtered by, so the row can mark them inside its own text */
  terms?: string[];
  query: string;
  onQuery: (next: string) => void;
  /** the placeholder and the accessible name of the field — said as a sentence a stranger can act on */
  label: string;
  /** a surface whose search field is its own organ draws it here (Stock's chip entry) */
  field?: (opts: { commit: () => void }) => React.ReactNode;
  fieldTestid?: string;
  onTake: (row: PickRow) => void;
  /** what stands ABOVE the field, where the question has a first half (§129.2: the TYPE of print) */
  head?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const flat = React.useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const [high, setHigh] = React.useState(0);
  const fieldRef = React.useRef<HTMLInputElement | null>(null);
  const listBox = React.useRef<HTMLDivElement | null>(null);
  /* WHETHER THE KEYS THIS BOX PROMISES ARE REALLY THERE (THE-CHECKPOINT-AUDIT finding 5). The walk
     itself is untouched — a keyboard that appears still works — and only the PROMISE is withheld
     where nothing can keep it. */
  const keys = useHardwareKeys();

  /* THE FIELD TAKES THE CARET ON ARRIVAL (§91.1: the field leads). Base's own `autoFocus` puts it
     on the dialog, which is right for a dialog and wrong for a box whose first act is typing. */
  React.useEffect(() => {
    setHigh(0);
    const id = window.setTimeout(() => fieldRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [intent]);

  /* THE WALK NEVER POINTS PAST THE ANSWER. A word that shortens the list has to bring the
     highlight back with it, or ↵ opens a row that is no longer drawn. */
  React.useEffect(() => {
    setHigh((h) => (h < flat.length ? h : 0));
  }, [flat.length]);

  /* THE HIGHLIGHTED ROW STAYS ON SCREEN. The list is a scrollport, so a walk that runs past its
     foot has to carry the view with it — the same behaviour the catalogue's own ↑↓ walk keeps. */
  React.useEffect(() => {
    const el = listBox.current?.querySelector(`[data-row-high="yes"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' });
  }, [high]);

  const take = React.useCallback(
    (row: PickRow | undefined) => {
      if (!row) return;
      onTake(row);
    },
    [onTake],
  );

  return (
    <div
      data-testid={`${testid}-body`}
      data-intent={intent ?? 'none'}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}
      onKeyDown={(e) => {
        /* THE ORGAN IN THE SEAT HAS THE FIRST CLAIM ON A KEY. Stock's word walks its own
           suggestions with ↑↓ and seals a chip with ↵, and it says so by preventing the default
           — so a key it has already answered is never answered twice (§35.1's own finding about
           Escape, one organ further in). */
        if (e.defaultPrevented) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHigh((h) => (flat.length === 0 ? 0 : (h + 1) % flat.length));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHigh((h) => (flat.length === 0 ? 0 : (h - 1 + flat.length) % flat.length));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          take(flat[high]);
        }
      }}
    >
      {head}

      {/* ── THE FIELD LEADS (§91.2) ─────────────────────────────────────────────────────────
          One seat at the head of the box, and what sits in it is either the plain field or the
          surface's own organ. Either way it is the same seat, the same height and the same rule
          below it, so the box a person learns is one box. */}
      <div
        data-testid={`${testid}-seat`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale400,
          padding: `${theme.sizing.scale300} ${theme.sizing.scale600}`,
          borderBottom: `1px solid ${theme.colors.borderOpaque}`,
          minWidth: 0,
        }}
      >
        {field ? (
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>{field({ commit: () => take(flat[high]) })}</div>
        ) : (
          <Input
            inputRef={fieldRef}
            value={query}
            onChange={(e) => onQuery((e.target as HTMLInputElement).value)}
            size={INPUT_SIZE.large}
            placeholder={label}
            aria-label={label}
            clearable
            clearOnEscape={false}
            startEnhancer={<Glyph id="search" size={STEP.medium} />}
            overrides={{
              Root: {
                style: {
                  /* THE FIELD HOLDS NO GROUND OF ITS OWN. The box around it is already the
                     surface; a filled input inside a dialog would be a control inside a control. */
                  backgroundColor: 'transparent',
                  borderTopWidth: '0',
                  borderRightWidth: '0',
                  borderBottomWidth: '0',
                  borderLeftWidth: '0',
                  minWidth: 0,
                },
              },
              Input: {
                props: { 'data-testid': fieldTestid ?? `${testid}-field` },
                style: {
                  backgroundColor: 'transparent',
                  paddingLeft: '0',
                  /* §77.2 — THE SLOT DECLARES ITS OVERFLOW: one line, end ellipsis, for a word
                     longer than the field. It governs the VALUE only. A PLACEHOLDER cannot be
                     ellipsised — the property was set on the element and on `::placeholder`
                     and Chrome clips it mid-word either way, which was measured at 390 rather
                     than assumed — so the placeholder is kept SHORT ENOUGH TO STAND, at each
                     seat, and the register's own rule for a heading applies to it: a slot long
                     enough to clip is rewritten. */
                  textOverflow: 'ellipsis',
                },
              },
              StartEnhancer: {
                style: {
                  backgroundColor: 'transparent',
                  paddingLeft: '0',
                  color: theme.colors.contentTertiary,
                },
              },
            }}
          />
        )}
      </div>

      {/* ── THE LIST BENEATH, VARYING BY QUESTION (§91.2) ─────────────────────────────────── */}
      <div
        ref={listBox}
        data-testid={`${testid}-list`}
        data-rows={flat.length}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          paddingTop: theme.sizing.scale300,
          paddingBottom: theme.sizing.scale300,
        }}
      >
        {groups.map((group) => (
          <div key={group.title} data-search-group={group.title}>
            {/* THE GROUP NAMES WHAT IS UNDER IT, blatantly (the heading law). One noun, and the
                rows say the rest. */}
            <div
              style={{
                ...theme.typography.LabelXSmall,
                color: theme.colors.contentTertiary,
                padding: `${theme.sizing.scale300} ${theme.sizing.scale600} ${theme.sizing.scale100}`,
              }}
            >
              {group.title}
            </div>
            {group.rows.map((row) => {
              const at = flat.indexOf(row);
              return (
                <Row
                  key={row.key}
                  row={row}
                  terms={terms}
                  high={at === high}
                  onEnter={() => setHigh(at)}
                  onPick={() => take(row)}
                />
              );
            })}
          </div>
        ))}

        {flat.length === 0 && (
          /* THE SAME SENTENCE THE CATALOGUE ALREADY SAYS when a word finds nothing (§4's
             substance lens: one string, one home). It states the way forward rather than the
             absence, which is the house's own copy law. */
          <p
            data-testid={`${testid}-empty`}
            style={{
              ...theme.typography.LabelLarge,
              color: theme.colors.contentSecondary,
              margin: 0,
              padding: `${theme.sizing.scale600} ${theme.sizing.scale600}`,
            }}
          >
            {`Try another word for “${query.trim()}”`}
          </p>
        )}
      </div>

      {/* ── THE KEYS, SAID WHERE THEY ARE REAL (§32's own rule for a keycap) ────────────────
          AND «WHERE THEY ARE REAL» IS NOW ASKED RATHER THAN ASSUMED (THE-CHECKPOINT-AUDIT finding
          5). This row printed «↑↓ walk · ↵ open · esc close» on a 390px phone, where there is no
          ↑, no ↵ and no esc — a full storey of a small screen spent telling a thumb about keys it
          does not have. The list already walks by tap, the row already opens by tap, and the box
          already closes by tapping outside it, so nothing is lost with the row: the affordance was
          never the keycap, it was the key. */}
      {keys && (
      <div
        data-testid={`${testid}-foot`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale600,
          padding: `${theme.sizing.scale300} ${theme.sizing.scale600}`,
          borderTop: `1px solid ${theme.colors.borderOpaque}`,
          color: theme.colors.contentTertiary,
          ...theme.typography.LabelXSmall,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200 }}>
          <Keycap>↑</Keycap>
          <Keycap>↓</Keycap>
          walk
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200 }}>
          <Keycap>↵</Keycap>
          open
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200 }}>
          <Keycap>esc</Keycap>
          close
        </span>
      </div>
      )}
    </div>
  );
}

/* ── THE SUMMON ───────────────────────────────────────────────────────────────────────────── */

/** THE CONTROL EVERY SEARCH SURFACE NOW CARRIES.
 *
 *  It has two states and they are one control, not two: the MARK while the surface holds no word,
 *  and the NARROW CHIP while it does — the word, and the release beside it. §51.25's own clause is
 *  what makes the second state compulsory: «an active narrow must stay visible», and a book that
 *  is quietly filtered is a book that has lied about how many customers you have. The seat itself
 *  now lives inside the modal, so without this the standing word would have nowhere on the surface
 *  to say that it is standing.
 */
export function SearchSummon({
  intent,
  label,
  testid,
  query = '',
  onRelease,
}: {
  intent: SearchIntent;
  /** what this searches, said as a sentence a stranger can act on — the hover label and the
   *  accessible name, and (through the seat) the field's own placeholder */
  label: string;
  testid: string;
  /** the word the surface is standing on, so the control can say so */
  query?: string;
  /** put the book back. Given wherever a word can stand. */
  onRelease?: () => void;
}) {
  const [, theme] = useStyletron();
  /* ── THE MARK IS 36, THE TARGET IS 44 (INTX-12 · §188.2 · E193.14) ────────────────────────
     W8 measured this summon at 36×36 at 390 on all three surfaces that carry it — the river, the
     catalogue and the book. The MARK stays the 20px line-icon the family is drawn at; the box
     around it takes the floor, on the phone only, so a desk row keeps its 36px density. */
  const floor = usePhoneFloor();
  const held = query.trim();

  if (held.length === 0) {
    return (
      <span style={{ display: 'inline-flex', flex: '0 0 auto' }} title={label}>
        <button
          type="button"
          data-testid={testid}
          aria-label={label}
          aria-haspopup="dialog"
          onClick={() => openSearch(intent)}
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: theme.sizing.scale950,
            height: theme.sizing.scale950,
            ...floor,
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            color: theme.colors.contentPrimary,
            cursor: 'pointer',
            flex: '0 0 auto',
          }}
        >
          <Glyph id="search" size={STEP.small} />
        </button>
      </span>
    );
  }

  return (
    <span
      data-testid={`${testid}-open`}
      data-search={query}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale100,
        flex: '0 1 auto',
        minWidth: 0,
        maxWidth: '100%',
        height: theme.sizing.scale950,
        minHeight: floor.minHeight,
        paddingLeft: theme.sizing.scale400,
        paddingRight: theme.sizing.scale200,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        background: theme.colors.backgroundSecondary,
      }}
    >
      <button
        type="button"
        data-testid={testid}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => openSearch(intent)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.sizing.scale200,
          border: 'none',
          background: 'transparent',
          color: theme.colors.contentPrimary,
          fontFamily: 'inherit',
          padding: 0,
          cursor: 'pointer',
          minWidth: 0,
          alignSelf: 'stretch',
        }}
      >
        <Glyph id="search" size={STEP.small} />
        <span style={{ ...theme.typography.LabelSmall, ...oneLine }}>{held}</span>
      </button>
      {onRelease && (
        <button
          type="button"
          data-testid={`${testid}-release`}
          aria-label={`Put the whole list back`}
          onClick={onRelease}
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: theme.sizing.scale650,
            height: theme.sizing.scale650,
            ...floor,
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            color: theme.colors.contentTertiary,
            cursor: 'pointer',
            flex: '0 0 auto',
          }}
        >
          <Glyph id="undo" size={STEP.small} />
        </button>
      )}
    </span>
  );
}

/* ── THE KEYBOARD ─────────────────────────────────────────────────────────────────────────── */

/** Is the person typing into something? «/» is a character, so it may never be taken out of a
 *  field, a text area or anything a person is writing in. */
const writing = (): boolean => {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/* ── THE MODAL ────────────────────────────────────────────────────────────────────────────── */

export type SearchModalProps = {
  /** the conversations, folded once by the frame — this box reads them, it does not re-fold them */
  threads: Thread[];
  /** open a conversation, which is the frame's own act */
  onThread: (id: string) => void;
};

export default function SearchModal({ threads, onThread }: SearchModalProps) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { derived } = useConfig();
  const cast = derived.cast;
  /* THE PALETTE LISTS THIS WORKSPACE'S OWN PLACES (FEED-IA §247.9): a Money-off workspace has no
     Money seat on its rail, so Find offers none either. */
  const { money } = useWorkspaceCapabilities(cast.sector);
  const intent = useSearchOpen();
  const open = intent !== null;

  /* THE SEAT, READ LIVE. It is read on every render rather than held in state, because the surface
     behind may have moved the word since the last one — that is the whole point of the registry. */
  const seat = intent ? seatOf(intent) : null;

  /** the modal's OWN word, for the intents no surface seats (the keyboard's `everything`, the
   *  administration, the houses). Where a seat exists the word is the surface's and this is unused. */
  const [own, setOwn] = React.useState('');
  const query = seat ? seat.query : own;
  const setQuery = React.useCallback(
    (next: string) => {
      if (seat) seat.onQuery(next);
      else setOwn(next);
    },
    [seat],
  );

  const terms = React.useMemo(() => termsOf(query), [query]);

  const groups = React.useMemo(
    () => (open
      ? groupsFor(intent as SearchIntent, terms, { cast, threads, onThread, money })
        .filter((g) => g.rows.length > 0)
      : []),
    [open, intent, terms, cast, threads, onThread, money],
  );

  const take = React.useCallback(
    (row: PickRow) => {
      closeSearch();
      row.open();
    },
    [],
  );

  /* ── THE SUMMON, FROM ANYWHERE (see THE KEY above) ─────────────────────────────────────── */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const chord = (e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K');
      const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !writing();
      if (!chord && !slash) return;
      e.preventDefault();
      if (standing === null) openSearch('everything');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Cedar interaction timing; reduced motion keeps the same navigation without travel. */
  const calm =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const OPEN_MS = theme.animation.timing400;
  const SHUT_MS = theme.animation.timing400;

  const label = seat?.label ?? 'Find anything';

  return (
    <Modal
      isOpen={open}
      onClose={closeSearch}
      animate={!calm}
      autoFocus={false}
      /* ── THE TWO WAYS OUT, AND WHY `closeable` STAYS TRUE (§91.1) ──────────────────────────
         «The modal collapses by clicking outside or Esc.» Both of those gestures are Base's, and
         both of them are gated on ONE prop: `onEscape` and `onBackdropClick` each open with
         `if (!this.props.closeable) return`. So `closeable={false}` — which reads like «draw no
         cross» — is really «this box cannot be dismissed», and it silently took away the only two
         exits the law names. It cost a drive run to find, and it is written down here because the
         prop's name says the opposite of what it does.
         WHAT IS NOT WANTED IS THE CROSS, so the cross is what is removed: Base's own `Close` slot,
         replaced with nothing through the overrides it already publishes. A palette is dismissed
         the way every palette is, and the foot says so in keycaps. */
      size={MODAL_SIZE.auto}
      role={ROLE.dialog}
      overrides={{
        Root: {
          props: { 'data-testid': 'search-modal-root' },
          style: { zIndex: SEARCH_LAYER },
        },
        Close: { component: () => null },
        DialogContainer: {
          style: ({ $isOpen }: { $isOpen: boolean }) => ({
            /* IT OPENS IN THE MIDDLE (§91.1: «a modal IN THE MIDDLE»), AT EVERY WIDTH. A first
               version put it at the top of a phone, reasoning about the on-screen keyboard; the
               law says the middle, the middle is what Base already does, and the top is where the
               day bar stands. One posture, both housings. */
            alignItems: 'center',
            transitionDuration: $isOpen ? OPEN_MS : SHUT_MS,
          }),
        },
        Dialog: {
          props: { 'data-testid': 'search-modal', 'data-open-ms': OPEN_MS, 'data-shut-ms': SHUT_MS },
          style: ({ $isOpen }: { $isOpen: boolean }) => ({
            width: phone ? '100%' : '640px',
            maxWidth: '100%',
            maxHeight: phone ? '70vh' : '64vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transitionDuration: $isOpen ? OPEN_MS : SHUT_MS,
          }),
        },
      }}
    >
      <PickList
        intent={intent ?? 'none'}
        groups={groups}
        terms={terms}
        query={query}
        onQuery={setQuery}
        label={label}
        field={seat?.field}
        fieldTestid={seat?.fieldTestid}
        onTake={take}
      />
    </Modal>
  );
}
