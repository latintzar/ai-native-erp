/* THE RAIL — the mark, the tabs, and the person. The desk's navigation; below 720px the bottom row
 * does the tab half of this job with the same links and the same marks.
 *
 * ═══ IT SLIMS (THE-APP-V2 §5.1) ════════════════════════════════════════════════════════════
 * A mark and a word, and the reading column and its detail get the rest. The word is DRAWN rather
 * than hovered for, because a navigation you have to hover to read is one you have to learn — and
 * §77.3 turned that into a state a person chooses: the words are there until they take them away.
 *
 * The rail is a function of what is BUILT, not of what was planned: it draws the areas the glob
 * found, in RAIL_ORDER. An area package landing `src/prototypes/cedar/areas/stock.tsx` puts Stock on the rail
 * with no edit here.
 *
 * ═══ THREE STOREYS (FEED-IA §44) ═══════════════════════════════════════════════════════════
 * «The real Rocoto logo top-left. Settings leaves the tab row — the rail's foot gains the profile
 * seat, and Settings and Subscription live in its little menu.»
 *
 *   THE MARK      Rocoto's own face, at the head, and the way home.
 *   THE TABS      the places: Sales · Stock · Customers. Where the work is.
 *   THE PERSON    the foot: WHO THIS IS, and the small menu of things that are about the ACCOUNT
 *                 rather than about the day.
 *
 * ═══ AND §53 CORRECTED THE FOOT TWICE, AND THEN MOVED WHAT IT OPENS ═════════════════════════
 *
 * 1 · IT IS THE PERSON, NOT THE PRODUCT. «It shouldn't be your Rocoto name, but it should be the
 *     person, like their account.» The seat used to say `config.brand.name` — the HOUSE — in the
 *     one place on the screen that is about who is signed in, and then said the same word at the
 *     head of every document it printed. It says `config.owner.name` now, with her own initial in
 *     the avatar, and the house's name lives where a house's name belongs.
 *
 * 2 · THE MENU OPENS VERTICALLY. «Rather than horizontally, the way you've done it.» The built
 *     shape was `PLACEMENT.rightBottom` — a panel flying out SIDEWAYS from the rail into the work,
 *     which reads as a second column arriving rather than as a menu belonging to the seat under it.
 *     It stacks UPWARD from the foot now (`PLACEMENT.top`), which is where every account menu at
 *     the bottom of every sidebar on earth opens, and the seat it belongs to stays visible under it.
 *
 * 3 · WHAT IT OPENS IS A WORLD. «Administration is its own world — they would change the sidebar,
 *     and they would have a back button at the top.» So the menu's first item is the door into it,
 *     the second is a DEEP LINK into one of its seats (§44.5's idea, kept: Plan is a place inside
 *     the world rather than a second world), and the way out stays drawn and disabled until there
 *     is a session to end.
 *
 * ADMINISTRATION IS REACHED FROM HERE AND NOWHERE ELSE ON THE DESK. One door per place is the rule
 * the tab row already keeps; a second door on the row would be the drift §30 forbids about marks
 * and §42 forbids about chats. The PHONE's own door is its bottom row's fourth seat, because a
 * phone has no foot to put a profile on — that row IS the foot.
 *
 * ═══ AND THE RAIL HAS TWO STATES NOW (FEED-IA §77.3) ═══════════════════════════════════════
 * «Collapsed = just those icons; expanded = like the screenshot: generous icon+word rows, roomy
 * row height, the word beside the icon at full reading size.»
 *
 * ── THE WIREFRAME (§51.24: regions · contents · type steps · states, before any JSX) ─────────
 *
 *   ┌ COLLAPSED · 64px ─────┐        ┌ EXPANDED · 208px ────────────────────────┐
 *   │        ▣              │  HEAD  │  ▣                                  ‹    │
 *   │        ›              │        │                                          │
 *   ├───────────────────────┤        ├──────────────────────────────────────────┤
 *   │        ▤              │  SEATS │  ▤   Sales                               │
 *   │        ▥              │        │  ▥   Stock                               │
 *   │        ▦              │        │  ▦   Customers                           │
 *   ├───────────────────────┤        ├──────────────────────────────────────────┤
 *   │        ⬤              │  FOOT  │  ⬤   Marta                               │
 *   └───────────────────────┘        └──────────────────────────────────────────┘
 *
 *   REGIONS      head (the mark, and the control that opens and shuts the rail) · seats (the
 *                registry — the desk's areas, or the world's) · foot (the person).
 *   CONTENTS     a seat is a MARK and a WORD, and nothing else. Collapsed drops the word from the
 *                paint and keeps it on the accessible name, so a rail of bare marks is still a
 *                rail that says what it is to a screen reader and to a hovering pointer.
 *   TYPE STEPS   the word is `LabelMedium` — 16px, which is the app's own BODY size (Base's
 *                `ParagraphMedium` is 16 too) — where the old centred rail had to put it at
 *                `LabelXSmall`, 12px. That is the reference's «the word beside the icon at full
 *                reading size» taken literally, and it is what buys the extra width.
 *   STATES       standing-here (paper a step down, ink at full strength) · elsewhere (transparent,
 *                ink at secondary) · hovered (the seat's own ground, GEOMETRY UNTOUCHED — §37.3).
 *   OVERFLOW     the word is one line, clipped with an ellipsis (§77.2). ROW_HEIGHT is fixed and
 *                identical in both states, so no word anywhere — a house's own name at the foot,
 *                a fourth area with a long title — can make one row taller than its neighbours.
 *
 * ── WHERE THE CONTROL LIVES, AND WHY IT IS NOT A HOVER ──────────────────────────────────────
 * It rides the HEAD, under (collapsed) or beside (expanded) the mark. Three reasons, in order:
 *   1 · The head is the one region of the rail that is about THE RAIL rather than about a place.
 *       A control at the foot would sit inside the person's own scope, which §53 spent two
 *       corrections separating from the house's.
 *   2 · It is in the same region in both states, so the way back is where the way out was.
 *   3 · IT IS A PRESS, NEVER A HOVER. A rail that widened under a passing pointer would move the
 *       whole app's geometry on a mouse crossing it — the exact thing §37.3 forbids one control
 *       from doing, at the scale of the entire desk. The reference has a deliberate control; so
 *       does this.
 *
 * ── WHAT THE REFERENCE HAS THAT WE DO NOT ───────────────────────────────────────────────────
 * The screenshot's head carries SEGMENTED TABS (Home · Code) over its rows. The counterpart here
 * would be a Desk | Administration switch — and it is deliberately NOT built: §53 settled that
 * «Administration is reached from the foot menu and NOWHERE ELSE on the desk», so a switch at the
 * head would be a second door to one place. The reference's «⌄ More» row has no counterpart
 * either: it folds a LIST tail, and this registry is three seats long. Both are recorded here
 * rather than half-built.
 */
import * as React from 'react';
/* THE CONTINUUM'S ONE RUNG THIS FILE CARES ABOUT (FEED-IA §103) */
import { RAIL_COLLAPSED, RAIL_EXPANDED, useStacked } from './viewport';
import { useStyletron } from 'baseui';
import { StatefulPopover, ACCESSIBILITY_TYPE, PLACEMENT, TRIGGER_TYPE } from 'baseui/popover';
import { StatefulMenu } from 'baseui/menu';
import {
  ADMIN, ADMIN_FOOT, ADMIN_ORDER, ADMIN_TITLE, HOME,
  type AdminSeatId, type AreaMeta,
} from './area';
import AreaGlyph, { AdminSeatMark, hasGlyph } from './glyphs';
import { useCompany } from '../company';
import { useConfig } from '../config';
import { Glyph, Keycap, STEP, type GlyphId } from '../glyphs';
import { openSearch, type SearchIntent } from './search-modal';
/* THE ONBOARDING CARD LIVES HERE (FEED-IA §91.1, §91.3): «the onboarding/steps live in a CARD
   ABOVE the account chip at the sidebar's foot… sidebar collapsed → the card becomes a SQUARE with
   just a circular progress ring». The card is the activation package's; the SEAT is the rail's,
   which is why the mount is two lines in this file and the whole object is in that one. */
import { OnboardingCard } from '../setup-progress';

/** ═══ THE TWO WIDTHS (FEED-IA §77.3) ═══════════════════════════════════════════════════════
 *
 * COLLAPSED · 64. The rail is a column of marks: 8px of its own padding a side leaves 48, which is
 * exactly the target Base's own density ladder gives a pointer, so a mark stands in the middle of a
 * real button rather than in a stripe.
 *
 * EXPANDED · 208. Measured rather than guessed, the same way 92 was: 8px of rail padding a side
 * leaves 192, a seat spends 14 a side of its own, so the row's contents get 164 — a 20px mark, a
 * 12px gap, and a 132px box for the word. VERIFIED IN THE BROWSER rather than estimated: at
 * `LabelMedium` NOT ONE seat in either registry is cut, including the world's «Connections» and
 * «Operations», which is the drive's own assertion (`0 cut`). Both rails are comfortable by ONE
 * measure now.
 *
 * ═══ AND THE WORLD'S SECOND NUMBER COLLAPSED INTO THIS ONE ══════════════════════════════════
 * `ADMIN_RAIL_WIDTH` was 104 against the desk's 92 for one reason: the word sat UNDER the mark in a
 * centred column, so the rail had to be as wide as its own longest word. Beside the mark, one width
 * holds both registries — so the world keeps the desk's pair and the two guesses become one
 * measurement. `area.ts` keeps the constant as the world's own name for that same number, because
 * the frame reads its grid off it.
 *
 * ⚠ A NEW AREA WITH A LONGER TITLE NO LONGER RE-OPENS THIS. `Proveedores` is 92px at LabelMedium
 * and the box is 132; the ellipsis rule below is the last resort it will never reach.
 *
 * ═══ AND THE SHORT WORD IS REPEALED WITH IT (AUDIT-2 C32 · content canon §4 Substance) ═══════
 * «ONE STRING, ONE HOME.» The world's rail said «Business · Agent · Settings» while the phone's
 * index and every page header said «Your business · Your agent · App settings» — so a merchant
 * told «go to Settings» went looking for a door his phone does not have. Three seats, two names,
 * and the rail was the liar.
 *
 * WHY THE SPLIT EXISTED, AND WHY IT IS GONE. `ADMIN_RAIL_WORD` was minted when the word sat UNDER
 * the mark in a 104px centred column and six of nine seats came back as ellipses — a real defect
 * with a real fix at the time. §77.3 put the word BESIDE the mark and handed every seat a 132px
 * box, which is where «Your business» (94px) and «App settings» (86px) both fit with room to
 * spare. The geometry that forced two names is the geometry that was replaced; the second name
 * outlived its reason by one round.
 *
 * SO THIS FILE READS `ADMIN_TITLE` AND NOTHING ELSE, at every altitude the world has: the desk
 * rail's word, its `aria-label`, its collapsed tooltip, and the phone index's row all say the one
 * name. `ADMIN_RAIL_WORD` in `area.ts` has no reader left; whoever next opens that file deletes
 * it. The heading-versus-label argument it carried was honest and is simply moot — a label that
 * fits says the whole name. */
/* THE TWO WIDTHS ARE THE LADDER'S NOW (E199). They are terms in `DESK_FLOOR` and in the priced
 * document's own floor, and a number two files each declare is a number two files can drift on.
 * `shell/viewport.ts` states them; this file keeps the names every reader already imports. */
export { RAIL_COLLAPSED, RAIL_EXPANDED } from './viewport';

/** The desk's rail at rest. Kept under its old name because `shell/index.ts` publishes it and the
 *  frame lays its grid out with it — the number it names is now the OPEN state's. */
export const RAIL_WIDTH = RAIL_EXPANDED;

/** How wide the rail is standing right now. One function, both worlds, so the frame's grid column
 *  and the rail's own box can never disagree about a width that is animating. */
export const railWidth = (open: boolean): number => (open ? RAIL_EXPANDED : RAIL_COLLAPSED);

/** THE ROW, IN BOTH STATES. Roomy — the reference's own proportion, and above the 44px a pointer
 *  and a thumb both want — and IDENTICAL COLLAPSED AND EXPANDED, so opening the rail changes its
 *  width and nothing else. A rail whose rhythm also moved would read as two different navigations
 *  rather than as one in two states. */
const ROW_HEIGHT = 44;

/* ═══ THE STATE IS REMEMBERED (FEED-IA §77.3: «the state persisted») ═════════════════════════
 * A module singleton over `useSyncExternalStore`, mirrored to localStorage — the same shape
 * `rules.ts`, `grants.ts` and `print-queue.ts` already keep, so the rail joins the app's one
 * pattern for «a fact the person set, that outlives a reload» rather than inventing a second.
 *
 * IT OPENS BY DEFAULT, and that is a decision rather than a fallback: «a navigation you have to
 * hover to read is one you have to learn» is this file's own oldest law. Collapsing is the
 * deliberate act of somebody who has learned it and wants the pixels back.
 *
 * NOTHING READS STORAGE DURING RENDER. The value is taken once at module load inside a try/catch —
 * a private window throws on `localStorage` rather than returning null — and every later read is
 * the singleton.
 */
const RAIL_STORAGE_KEY = 'rocoto-rail-open';

function storedRail(): boolean {
  try {
    return window.localStorage.getItem(RAIL_STORAGE_KEY) !== 'no';
  } catch {
    return true;
  }
}

let railOpen = typeof window === 'undefined' ? true : storedRail();

const railListeners = new Set<() => void>();

const subscribeRail = (fn: () => void): (() => void) => {
  railListeners.add(fn);
  return () => {
    railListeners.delete(fn);
  };
};

const railSnapshot = (): boolean => railOpen;

/** Open the rail, or shut it. Exported so a drive can put the app in either state without hunting
 *  for the control, and so the frame's own seam has one call to make. */
export function setRailOpen(next: boolean): void {
  if (next === railOpen) return;
  railOpen = next;
  try {
    window.localStorage.setItem(RAIL_STORAGE_KEY, next ? 'yes' : 'no');
  } catch {
    /* a browser that refuses storage still gets the state for this session */
  }
  for (const fn of railListeners) fn();
}

/**
 * IS THE RAIL STANDING OPEN? The frame reads this for its grid; the rail reads it for its seats.
 *
 * ═══ AND THE CONTINUUM CAN OVERRULE THE PREFERENCE (FEED-IA §103) ═══════════════════════════
 * 208px of navigation is a third of a 560px window, and the river pane's own floor is 392 — so an
 * expanded rail at the stacked rung takes the width out of the one thing §51.4 pins, which is the
 * failure C30 already recorded once. THE RAIL THEREFORE DRAWS COLLAPSED THERE, and the person's
 * own choice is UNTOUCHED in the store: widen the window and it comes back open. That is the whole
 * shape of «graceful compression» — the app gives up furniture before it gives up work, and it
 * gives nothing up permanently.
 */
export function useRailOpen(): boolean {
  const stored = React.useSyncExternalStore(subscribeRail, railSnapshot, railSnapshot);
  const stacked = useStacked();
  return stored && !stacked;
}

/** A reader who asked for less motion gets the resting state directly. Read at render rather than
 *  baked into a stylesheet, so the setting is honoured live — `chats.tsx`'s own rule. */
export function useCalm(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** THE WIDTH MOVES ON BASE'S OWN STEP AND BASE'S OWN CURVE. `timing400` with `easeInOutCurve` is
 *  what the kit gives a box that both leaves and arrives — the rail is not entering the screen, it
 *  is changing size, so the symmetric curve is the honest one. */
export function railMotion(theme: ReturnType<typeof useStyletron>[1], calm: boolean): string | undefined {
  return calm ? undefined : `width ${theme.animation.timing400} ${theme.animation.easeInOutCurve}`;
}

/** THE MARK, LIFTED AND NOT REDRAWN. `public/brand/rocoto-mark.svg` is the product's own shipping
 *  face — the same file the landing's app desk draws — copied in rather than traced.
 *
 *  IT IS A MASK, SO IT TAKES THE RAIL'S INK. The asset is black paths on nothing; drawn as an
 *  `<img>` it would be the one element on the screen that cannot re-theme, and `?theme=proof` is
 *  the system's own proof that everything moves. Masking paints the artwork's own alpha in a theme
 *  colour, so the mark is Rocoto's drawing in the app's ink at every brand. */
const MARK = 40;

export function RocotoMark({ size = MARK, testId = 'rail-logo' }: { size?: number; testId?: string } = {}) {
  const [, theme] = useStyletron();
  return (
    <span
      data-testid={testId}
      aria-hidden="true"
      style={{
        display: 'block',
        width: size,
        height: size,
        backgroundColor: theme.colors.contentPrimary,
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

/* ── A SEAT IN EITHER RAIL ─────────────────────────────────────────────────────────────────────
 * A mark over a word, lit where you are standing. It is one component because the desk's three
 * areas and the world's nine seats are the same object in two registries — and because a seat drawn
 * twice would be the place two rails could quietly stop agreeing about what «here» looks like.
 */
/** A SEAT IS A ROW IN BOTH STATES, and the only thing that changes is whether the word is painted.
 *  Collapsed it centres one mark in a 48px target; expanded the mark keeps the same seat and the
 *  word stands beside it. The HEIGHT is `ROW_HEIGHT` either way — stated, never derived from the
 *  contents, which is what makes the two states one navigation (§77.2: rows keep their height). */
function seatStyle(on: boolean, open: boolean, theme: ReturnType<typeof useStyletron>[1]): React.CSSProperties {
  return {
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: open ? 'flex-start' : 'center',
    gap: open ? theme.sizing.scale400 : 0,
    height: ROW_HEIGHT,
    textDecoration: 'none',
    color: on ? theme.colors.contentPrimary : theme.colors.contentSecondary,
    background: on ? theme.colors.backgroundSecondary : 'transparent',
    borderRadius: theme.borders.radius200,
    /* THE PADDING IS THE ONE THING THAT MOVES WITH THE STATE, and it is what keeps a collapsed mark
       exactly centred in its 48px box while an expanded row starts its contents where the head's
       mark starts. Vertical padding stays out of it: the height is stated above, so a seat can
       never grow by gaining a longer word. */
    padding: open ? `0 ${theme.sizing.scale550}` : 0,
    minWidth: 0,
  };
}

/** THE WORD BESIDE THE MARK (§77.3: «at full reading size»). `LabelMedium` — 14px — where the old
 *  centred rail had to put it at `LabelXSmall`.
 *
 *  IT IS CUT, NEVER WRAPPED (§77.2, and this rail's own older rule). A two-line label would push
 *  every seat under it off its own row and make the rail a different height per house; the row's
 *  stated height would then clip it mid-letter, which is worse than an ellipsis that says «there
 *  is more here». The cut is the LAST RESORT and not the plan: 132px holds every word either
 *  registry has, so what this catches is a house's own name at the foot. */
function seatWord(theme: ReturnType<typeof useStyletron>[1]): React.CSSProperties {
  return {
    ...theme.typography.LabelMedium,
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
}

/** THE WORD, NAMED. A seat holds a mark and a word and both are spans; a reader from outside — a
 *  drive, a stylesheet audit — has to be able to ask for the WORD without counting children. It is
 *  one component rather than a repeated attribute so the six seats in this file cannot disagree
 *  about the type step or the overflow they declare. */
function SeatWord({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <span data-rail-word="yes" style={seatWord(theme)}>
      {children}
    </span>
  );
}

/* ── THE CONTROL THAT OPENS AND SHUTS IT (FEED-IA §77.3) ──────────────────────────────────────
 * One chevron, turned — the app's only chevron, and it means «this way» everywhere it is drawn
 * (§30). Pointing right it says «the rail opens that way»; pointing left, «it shuts that way».
 * Never two controls for one decision, and never a word: a rail 64px wide has no room for one and
 * a rail 208px wide would spend a whole row on furniture.
 *
 * ITS NAME SAYS WHAT PRESSING IT DOES, so a screen reader and a hovering pointer both get the act
 * rather than the state: «Open the rail» / «Shut the rail».
 */
function RailToggle({ open }: { open: boolean }) {
  const [, theme] = useStyletron();
  return (
    <button
      type="button"
      data-testid="rail-toggle"
      data-rail-open={open ? 'yes' : 'no'}
      aria-label={open ? 'Shut the rail' : 'Open the rail'}
      aria-expanded={open}
      title={open ? 'Shut the rail' : 'Open the rail'}
      onClick={() => setRailOpen(!open)}
      style={{
        boxSizing: 'border-box',
        width: open ? 32 : '100%',
        height: 32,
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        border: 'none',
        borderRadius: theme.borders.radius200,
        background: 'transparent',
        color: theme.colors.contentSecondary,
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        data-mark={open ? 'shut' : 'open'}
        style={{ display: 'inline-flex', transform: `rotate(${open ? 90 : -90}deg)` }}
      >
        <Glyph id="caret" size={STEP.small} />
      </span>
    </button>
  );
}

/* ── THE FIND SEAT (FEED-IA §91.2, and §77.3's reference) ─────────────────────────────────────
 * «All search should be like this» needs somewhere to be pressed that is true on every surface,
 * and the rail is the one navigation both worlds carry. §77.3's own reference — Claude's sidebar,
 * which Peter put on the screen beside ours — opens with exactly this row, so the grammar is
 * already the one this rail is written in: the mark, the word beside it, the seat's stated height.
 *
 * IT IS A BUTTON AND NOT A LINK, and the difference is the point: every other seat in this rail is
 * an ADDRESS and this one is not. Search is not a place you can be standing in, so it carries no
 * `href`, takes no `aria-current`, and never lights.
 *
 * THE KEYCAP RIDES IT, and it is the only place in the app that advertises this shortcut. §32's
 * rule for a cap is that the keyboard must keep the promise — «/» does, from every surface — and
 * its own grammar is «a little square with the letter in it», which is what `Keycap` draws.
 */
function FindSeat({ open, intent }: { open: boolean; intent: SearchIntent }) {
  const [, theme] = useStyletron();
  return (
    <button
      type="button"
      data-testid="rail-find"
      aria-label="Find anything"
      aria-haspopup="dialog"
      title={open ? undefined : 'Find anything'}
      onClick={() => openSearch(intent)}
      style={{
        ...seatStyle(false, open, theme),
        width: '100%',
        border: 'none',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      <Glyph id="search" size={STEP.medium} />
      {open && <SeatWord>Find</SeatWord>}
      {open && (
        <span style={{ display: 'inline-flex', flex: '0 0 auto', color: theme.colors.contentTertiary }}>
          <Keycap>/</Keycap>
        </span>
      )}
    </button>
  );
}

/** THE HEAD'S OWN BOX. A row while the rail is open — the mark, the air, the control — and a
 *  column while it is shut, because 64px cannot hold both side by side and the mark is the one
 *  that must stay centred. Same two members, same order, one region either way. */
function headStyle(open: boolean, theme: ReturnType<typeof useStyletron>[1]): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: open ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: open ? 'space-between' : 'center',
    gap: theme.sizing.scale300,
    width: '100%',
    flex: '0 0 auto',
    minWidth: 0,
  };
}

/* ── THE PERSON AT THE FOOT (FEED-IA §44, corrected by §53, REBUILT BY §85) ───────────────────
 *
 * «Also this shit is so bad, i want it like claude.» What stood here: an avatar with a name loose
 * beside it, opening a bare white list of three unmarked text rows. What §85 asks for is the
 * REGISTER of Claude's own account menu — identity first, grouped rows with dividers, a mark on
 * every row, the way out alone at the foot — with OUR items inside it. «The LOOK is the law here;
 * items stay ours.»
 *
 * ── THE WIREFRAME (§51.24: regions · contents · type steps · states, before any JSX) ──────────
 *
 *   ┌ THE CHIP · collapsed ─┐   ┌ THE CHIP · expanded ─────────────────────┐
 *   │        ⬤              │   │  ⬤   Roser                          ⌃    │
 *   └───────────────────────┘   └──────────────────────────────────────────┘
 *
 *   ┌ THE MENU · 256 wide, stacked upward off the chip's own left edge ──────────┐
 *   │ IDENTITY   Roser Vilalta                                                    │  muted,
 *   │            Peix Vilalta, S.L.                                               │  unpressable
 *   ├─────────────────────────────────────────────────────────────────────────────┤
 *   │ THE       ▤   Administration                                                │  44
 *   │ ACCOUNT   ▥   Plan                                                          │  44
 *   ├─────────────────────────────────────────────────────────────────────────────┤
 *   │ THE WAY   ▧   Sign out                                                      │  56
 *   │ OUT           Sign-in arrives with accounts.                                │
 *   └─────────────────────────────────────────────────────────────────────────────┘
 *
 *   REGIONS    the identity header (who, and whose house) · the account group · the way out,
 *              alone under its own rule. The rules between groups are Base's own
 *              `{ divider: true }` item and its `MenuDivider` override — the kit's grouping
 *              rather than three hairlines drawn by hand.
 *   CONTENTS   a row is A MARK AND A WORD, and a SUBLABEL only where the row would otherwise
 *              leave a question standing. Exactly one does — see THE THREE CHOICES below.
 *   TYPE STEPS the row's word is `LabelMedium` (14 — the app's reading size, and the rail's own
 *              seat word); the person is `LabelSmall`; the house and the sublabel are
 *              `ParagraphXSmall`. The header is quieter than the rows by a step and by its ink,
 *              which is what «muted» means here.
 *   STATES     resting · hovered (Base's `menuFillHover`, full bleed, GEOMETRY UNTOUCHED — §37.3)
 *              · disabled (Base's `menuFontDisabled`, and the MARK takes it too, because a Lucide
 *              glyph is drawn in `currentColor`) · open (the chip wears its hover ground for as
 *              long as the menu stands over it, so the two read as one control).
 *   OVERFLOW   every text slot is ONE LINE, clipped with an ellipsis (§77.2). The row heights are
 *              STATED — 44, or 56 where a sublabel is declared — never derived from contents, so
 *              a longer word can never make one row taller than its neighbour.
 *
 * ── THE THREE CHOICES, RECORDED (§85 asks for a register, not for furniture we do not own) ────
 *
 * 1 · NO KEYBOARD HINT, AND THAT IS A FINDING. The reference puts «⌘,» beside Settings and §85
 *     keeps the hint «right where one is real». This app's ENTIRE shortcut vocabulary is single
 *     letters with no modifier — `P` prints on an albarán, ←/→ walk a list — and not one of them
 *     opens Administration, opens Plan, or ends a session. `Keycap`'s own rule in `glyphs.tsx`
 *     says why that settles it: «a keycap on a surface with no shortcut behind it is a promise the
 *     keyboard does not keep.» So no hint is drawn. The row's trailing slot is built and standing
 *     empty for the day a real one exists.
 * 2 · NO TRAILING MARKS. The reference's are an external-link arrow and a «New» badge. Nothing in
 *     this menu leaves the app and nothing in it is new, so either one would be decoration wearing
 *     the costume of information.
 * 3 · ONE SUBLABEL, ON THE ONE ROW THAT OWES AN ANSWER. Sign out is drawn and DISABLED — there is
 *     no accounts layer yet — and a disabled control that will not say what it is waiting for is
 *     the thing this build refuses everywhere else. The words are the app's OWN:
 *     `areas/admin/account.tsx` already says «Sign-in arrives with accounts.» under the same
 *     control, so the two surfaces say one sentence rather than two.
 *
 * ── AND THE CHIP CARRIES NO PLAN WORD (FEED-IA §85.1) ────────────────────────────────────────
 * The reference puts «Max» beside «Peter», and the first reading of §85 put the house's BAND
 * there the same way. Peter killed it within the hour: «Med? what is med? don't mention it
 * there.» PEQ/MED/GRA are pricing shorthand; «Max» works because it is a plan NAME and ours is
 * not one. So the chip is avatar · name · chevron and nothing else, the Plan ROW carries no
 * trailing band either, and the plan stays where it is explained — the Plan seat.
 */

/** THE MENU'S OWN MEASUREMENTS, stated once. 256 is the rail's 208 plus the room the identity
 *  header's two facts want; the two row heights are the reference's rhythm — 44 for a word, 56
 *  where a sublabel is declared under it. */
const MENU_WIDTH = 256;
const MENU_ROW = 44;
const MENU_ROW_SUB = 56;

/** A ROW IN THE FOOT MENU. `divider` is Base's own key (`menu.js` reads `item.divider === true`
 *  and draws its `MenuDivider`), so a group break costs an item rather than a fork. */
type FootItem = {
  id?: string;
  label?: string;
  glyph?: GlyphId;
  /** the second line, drawn only where the row genuinely owes one (choice 3 above) */
  sub?: string;
  disabled?: boolean;
  divider?: boolean;
};

/** THE ITEMS — ours, in the reference's grammar (§85: «items stay ours»).
 *
 *  Administration wears `sliders`, which is the mark the app ALREADY gives that door: the phone's
 *  bottom row draws it on the fourth seat, and that seat and this row open the same world. One
 *  door, one mark, both housings (§30).
 *
 *  Plan wears `plan` — the card that pays Rocoto, the same mark its seat carries in the admin
 *  rail. Sign out wears `signout`, the one new meaning this section needed. */
const FOOT_ITEMS: FootItem[] = [
  { id: 'admin', label: 'Administration', glyph: 'sliders' },
  /* §44.5's deep-link idea, kept: a link INTO the world rather than a second world. */
  { id: 'plan', label: 'Plan', glyph: 'plan' },
  { divider: true, disabled: true },
  {
    id: 'out',
    label: 'Sign out',
    glyph: 'signout',
    disabled: true,
    sub: 'Sign out opens once a session is signed in.',
  },
];

/** ONE LINE, CLIPPED (§77.2). Declared once so the four text slots in this menu cannot disagree
 *  about what happens when a name, a house or a sentence outgrows its box. */
const oneLine: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

/** A ROW'S CONTENTS. It is a component rather than three inline spans because the row is the unit
 *  §85 is about, and because the two heights have to be declared in ONE place to stay stated. */
function FootRow({ item }: { item: FootItem }) {
  const [, theme] = useStyletron();
  return (
    <span
      data-menu-row={item.id}
      data-menu-height={item.sub ? MENU_ROW_SUB : MENU_ROW}
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.sizing.scale500,
        height: item.sub ? MENU_ROW_SUB : MENU_ROW,
        padding: `0 ${theme.sizing.scale600}`,
        minWidth: 0,
      }}
    >
      {item.glyph && (
        <span
          aria-hidden="true"
          data-menu-mark={item.glyph}
          style={{ display: 'inline-flex', flex: '0 0 auto' }}
        >
          <Glyph id={item.glyph} size={STEP.medium} />
        </span>
      )}
      <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: theme.sizing.scale100 }}>
        <span data-menu-word="yes" style={{ ...theme.typography.LabelMedium, ...oneLine }}>
          {item.label}
        </span>
        {item.sub && (
          <span
            data-menu-sub="yes"
            style={{
              ...theme.typography.ParagraphXSmall,
              /* A HELD ROW'S SECOND LINE IS HELD TOO. `inherit` takes Base's own
                 `menuFontDisabled` off the list item, so the reason never reads louder than the
                 word it explains; a live row's sublabel would take the quiet ink instead. */
              color: item.disabled ? 'inherit' : theme.colors.contentTertiary,
              ...oneLine,
            }}
          >
            {item.sub}
          </span>
        )}
      </span>
      {/* THE TRAILING SLOT — built, and standing empty (choices 1 and 2 above). */}
    </span>
  );
}

/** THE MENU'S TWO CORRECTIONS TO BASE'S OWN WALK. `stateReducer` is the kit's hook for exactly
 *  this, so both are the kit steered rather than the kit forked.
 *
 *  1 · IT OPENS RESTING. Base lights the first item the moment the panel takes focus, so the menu
 *      opened with Administration on a hover ground — the row grammar saying «you are here» about
 *      a place you are not, and the reference's own menu lights nothing until you move. The FOCUS
 *      change keeps its `isFocused` (the list is genuinely focused, and must be, for the arrows to
 *      reach it) and gives up its highlight. The first ↓ still lands on the first row.
 *  2 · IT WALKS PAST THE RULE. A divider is a real item in Base's list, so ↑/↓ would stop on it
 *      once with nothing lit — a dead press. The walk steps over it in whichever direction it was
 *      already going. */
type MenuState = { highlightedIndex: number; isFocused: boolean; activedescendantId?: string | null };

const footMenuWalk = (
  type: string | undefined | null,
  changes: Partial<MenuState>,
  current: MenuState,
): MenuState => {
  const merged = { ...current, ...changes };
  if (type === 'focus') return { ...merged, highlightedIndex: current.highlightedIndex };
  const next = changes.highlightedIndex;
  if (typeof next !== 'number' || !FOOT_ITEMS[next]?.divider) return merged;
  const step = next >= current.highlightedIndex ? 1 : -1;
  let i = next + step;
  while (FOOT_ITEMS[i]?.divider) i += step;
  return i >= 0 && i < FOOT_ITEMS.length ? { ...merged, highlightedIndex: i } : current;
};

export type ProfileSeatProps = {
  /** the person whose account this is — `config.owner.name`. THE PERSON, NOT THE HOUSE (§53). */
  owner: string;
  /** true while the person is standing inside the administration world, so the seat lights */
  inWorld: boolean;
  /** the rail's state, so the foot wears the same grammar as the seats above it (§77.3) */
  open?: boolean;
};

export function ProfileSeat({ owner, inWorld, open = true }: ProfileSeatProps) {
  const [css, theme] = useStyletron();
  /** THE HOUSE, FOR THE IDENTITY HEADER ONLY. The person is the chip (§53); the house is the
   *  second line of the header, which is the one place the two facts belong together — «whose
   *  account, in whose house». It is the LEGAL name, because that is the house's own name for
   *  itself and the one every paper it prints carries. */
  const house = useCompany().legalName;
  const initial = owner.trim().slice(0, 1).toUpperCase();
  /** the word the chip says. A rail row holds one word and a full name is two, so the chip carries
   *  the name people answer to and the whole of it rides the accessible label and the header. */
  const first = owner.trim().split(/\s+/)[0];
  /** IS THE MENU STANDING? The chip keeps its hover ground while it is, so a person can see which
   *  control the panel belongs to — the reference's own behaviour, and Base hands it over in two
   *  callbacks rather than needing the popover to be controlled. */
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <StatefulPopover
      /* ── IT STACKS UPWARD, AND OFF THE CHIP'S LEFT EDGE (§53, and §85's geometry) ──────────
       * «The little menu opens VERTICALLY, rather than horizontally, the way you've done it.»
       * `PLACEMENT.rightBottom` put a panel out to the RIGHT of the rail, over the work.
       *
       * `topLeft` rather than `top` is what makes the COLLAPSED rail safe: centred over a 52px
       * chip in a 64px rail, a 256px panel would hang 92px off the left of the screen, and
       * `ignoreBoundary` below means popper will not pull it back. Aligned to the chip's own left
       * edge it starts where the rail starts in BOTH states, and overhangs into the work on the
       * side where there is room — which is exactly what the reference does. */
      placement={PLACEMENT.topLeft}
      triggerType={TRIGGER_TYPE.click}
      /* IT IS A MENU, AND IT SAYS SO. `ACCESSIBILITY_TYPE.menu` is what puts `aria-haspopup`,
         `aria-expanded` and `aria-controls` on the chip and the id on the panel — Base's own
         wiring, so the chip announces itself as a menu button rather than being hand-labelled. */
      accessibilityType={ACCESSIBILITY_TYPE.menu}
      onOpen={() => setMenuOpen(true)}
      onClose={() => setMenuOpen(false)}
      /* ─── THE RAIL IS A CLIPPING BOX, AND POPPER OBEYS IT ─────────────────────────────────
       * Base's popover keeps `preventOverflow` on by default, and popper's boundary is every
       * CLIPPING ancestor of the anchor — which here is the rail itself: 64 or 208px wide,
       * `overflow-x: clip`, `overflow-y: auto`. So a panel asked to stand anywhere near it is
       * clamped into that column and comes out painting over the very chip that opened it.
       * `ignoreBoundary` is Base's own prop for exactly this — the kit's escape hatch, not a
       * fork — and `topLeft` above is what keeps the freed panel on the screen. */
      ignoreBoundary
      /* ─── ONE PANEL, NOT THREE ────────────────────────────────────────────────────────────
       * Base draws Body → Inner → content, and the menu's own List draws a fourth: four boxes,
       * each with its own fill, radius and shadow, nested. That is what made the old menu read
       * as «a bare white list» — it was a panel inside a panel. The popover's Body IS the panel
       * now: it keeps its radius and its shadow, takes the MENU's fill so header and rows stand
       * on one ground, and Inner clips the rows' full-bleed hover to the corner radius. */
      overrides={{
        Body: { style: { zIndex: 12, backgroundColor: theme.colors.menuFill } },
        Inner: { style: { backgroundColor: theme.colors.menuFill, overflow: 'hidden' } },
      }}
      content={({ close }) => (
        <div
          data-testid="profile-menu"
          style={{ width: MENU_WIDTH, minWidth: 0 }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            e.preventDefault();
            close();
          }}
        >
          {/* ── THE IDENTITY HEADER (§85: «the menu OPENS WITH IDENTITY») ──────────────────
              Who is signed in, and whose house it is. It is not a row: nothing happens when it
              is pressed, so it is not drawn as something that could be. */}
          <div
            data-menu-identity="yes"
            style={{
              boxSizing: 'border-box',
              padding: `${theme.sizing.scale500} ${theme.sizing.scale600}`,
              minWidth: 0,
            }}
          >
            <div
              data-identity="person"
              style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, ...oneLine }}
            >
              {owner}
            </div>
            <div
              data-identity="house"
              style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, ...oneLine }}
            >
              {house}
            </div>
          </div>
          <span
            aria-hidden="true"
            data-menu-rule="identity"
            style={{ display: 'block', height: 1, background: theme.colors.borderOpaque }}
          />

          <StatefulMenu
            items={FOOT_ITEMS}
            /* NOTHING IS LIT UNTIL SOMETHING IS CHOSEN — see `footMenuWalk` above, which is the
               other half of this: `-1` is where the menu rests, and the reducer is what keeps it
               there when Base's own focus handler tries to light the first row. */
            initialState={{ highlightedIndex: -1, isFocused: false }}
            stateReducer={footMenuWalk}
            overrides={{
              /* the List stops being a panel — see ONE PANEL above — and keeps only the job of
                 being the list: no fill, no shadow, no radius, no padding of its own */
              List: {
                style: {
                  width: '100%',
                  minWidth: 0,
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  paddingTop: theme.sizing.scale200,
                  paddingBottom: theme.sizing.scale200,
                  overflow: 'visible',
                },
              },
              /* THE ROW'S BOX IS THE HOVER GROUND AND NOTHING ELSE. Its padding goes to zero and
                 `FootRow` above owns the geometry, because the row's HEIGHT varies with whether a
                 sublabel is declared and a styled list item never sees the item to know. */
              ListItem: {
                style: {
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: 0,
                  paddingRight: 0,
                },
              },
              Option: { props: { getItemLabel: (item: FootItem) => <FootRow item={item} /> } },
              /* THE RULE BETWEEN GROUPS — full bleed, and the app's own hairline rather than
                 Base's heavier `border300`, so it is the same line the rail draws. */
              MenuDivider: {
                style: {
                  marginTop: theme.sizing.scale200,
                  marginBottom: theme.sizing.scale200,
                  marginLeft: 0,
                  marginRight: 0,
                  borderBottomWidth: '1px',
                  borderBottomStyle: 'solid',
                  borderBottomColor: theme.colors.borderOpaque,
                },
              },
            }}
            onItemSelect={({ item }) => {
              const id = (item as FootItem).id;
              if (id === 'admin') window.location.hash = `#/${ADMIN}`;
              if (id === 'plan') window.location.hash = `#/${ADMIN}/plan`;
              close();
            }}
          />
        </div>
      )}
    >
      <button
        type="button"
        data-testid="profile-seat"
        data-owner={owner}
        data-current={inWorld ? 'yes' : 'no'}
        data-menu-open={menuOpen ? 'yes' : 'no'}
        aria-label={`${owner} — your account`}
        aria-current={inWorld ? 'page' : undefined}
        title={open ? undefined : owner}
        /* ── THE CHIP IS A REAL CONTROL (§85: «never a floating avatar with a name beside it») ─
         * A class rather than an inline style, because the one thing the old chip could not do
         * was HOVER: an inline `background` wins over any stylesheet, so a hover ground had to
         * become a class for the whole box. The geometry is the rail's own seat geometry — same
         * 44px row, same radius, same padding — so the foot reads as the last row of the rail
         * rather than as an ornament under it. */
        className={css({
          position: 'relative',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: open ? 'flex-start' : 'center',
          gap: open ? theme.sizing.scale400 : '0',
          width: '100%',
          height: `${ROW_HEIGHT}px`,
          minWidth: 0,
          paddingTop: '0',
          paddingBottom: '0',
          paddingLeft: open ? theme.sizing.scale550 : '0',
          paddingRight: open ? theme.sizing.scale400 : '0',
          borderStyle: 'none',
          borderRadius: theme.borders.radius200,
          textAlign: 'left',
          fontFamily: 'inherit',
          cursor: 'pointer',
          color: inWorld || menuOpen ? theme.colors.contentPrimary : theme.colors.contentSecondary,
          backgroundColor:
            inWorld || menuOpen ? theme.colors.backgroundSecondary : 'transparent',
          transitionProperty: 'background-color, color',
          transitionDuration: theme.animation.timing400,
          transitionTimingFunction: theme.animation.easeOutCurve,
          ':hover': {
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.contentPrimary,
          },
        })}
      >
        {/* ── ONE AVATAR GRAMMAR, HOUSE-WIDE (THE-CHECKPOINT-AUDIT finding 6 · FEED-IA §127.3) ──
            «Same identity, two different marks with no stated reason.» Roser was an initial on a
            solid red disc here and in Account, and an initial on the neutral ground in the Team
            list — one person drawn two ways, one screen apart. The TEAM's treatment is the one
            that survives, for two reasons that agree: it is what the list of people already uses,
            so it is the house's grammar rather than a third invention; and a red-filled circle is
            a red MARK, which §127.3 reserves for «a human being is waiting on you» — a person's
            own avatar is never that claim. Initials on `backgroundSecondary`, everywhere a person
            appears. */}
        <span
          data-testid="profile-avatar"
          data-avatar="person"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: theme.colors.backgroundSecondary,
            color: theme.colors.contentPrimary,
            display: 'grid',
            placeItems: 'center',
            ...theme.typography.LabelSmall,
            flex: '0 0 auto',
          }}
        >
          {initial}
        </span>
        {/* THE WORD LEAVES THE PAINT, NEVER THE RECORD (§77.3). The accessible name above carries
            the whole of it in both states, so a collapsed rail is still a rail that says who is
            signed in — to a screen reader, and to a pointer that rests on the chip. The chevron
            goes with it: 64px has no room for one, and the chip still opens the menu. */}
        {open && <SeatWord>{first}</SeatWord>}
        {open && (
          <span
            aria-hidden="true"
            data-chip-caret={menuOpen ? 'shut' : 'open'}
            style={{
              display: 'inline-flex',
              flex: '0 0 auto',
              color: theme.colors.contentTertiary,
              /* THE APP'S ONE CHEVRON, AND IT MEANS «THIS WAY» (§30). The menu stands ABOVE the
                 chip, so the mark points up while it is shut and back down while it is standing —
                 the same rule `RailToggle` keeps a few lines up this file. */
              transform: `rotate(${menuOpen ? 0 : 180}deg)`,
              transition: `transform ${theme.animation.timing400} ${theme.animation.easeOutCurve}`,
            }}
          >
            <Glyph id="caret" size={STEP.small} />
          </span>
        )}
      </button>
    </StatefulPopover>
  );
}

/* ── THE DESK'S RAIL ──────────────────────────────────────────────────────────────────────── */

/* ── THE FOOT'S JOURNEY CARD, MOUNTED ONCE FOR BOTH WORLDS (FEED-IA §91.1) ────────────────────
 * Both rails are the same column with a different registry, so the card is drawn by one helper
 * rather than twice — «two rails that remembered separately» is the thing §77.3 already refused for
 * the rail's own width, and it is the same argument for what stands in its foot.
 */
function FootJourney({ open }: { open: boolean }) {
  const { derived } = useConfig();
  return <OnboardingCard cast={derived.cast} open={open} />;
}

export default function Rail({
  areas,
  current,
  owner,
}: {
  areas: AreaMeta[];
  current: string;
  /** the person whose account this is, out of the config */
  owner: string;
}) {
  const [, theme] = useStyletron();
  const open = useRailOpen();
  /* THE CHOICE IS OFFERED WHERE THERE IS A CHOICE (§43: never a control that does nothing). At the
     stacked rung the rail is collapsed by the room rather than by the person, so the chevron would
     be a control whose press changed nothing on the screen. */
  const roomToChoose = !useStacked();
  const calm = useCalm();

  return (
    <aside
      data-testid="rail"
      data-world="desk"
      /* THE STATE, STATED. A drive that had to infer «collapsed» from a measured width would be
         testing arithmetic; this is the fact itself, and the width beside it is checkable. */
      data-rail={open ? 'expanded' : 'collapsed'}
      style={{
        width: railWidth(open),
        transition: railMotion(theme, calm),
        borderRight: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        padding: `${theme.sizing.scale600} ${theme.sizing.scale200}`,
        position: 'sticky',
        top: 0,
        /* THE RAIL IS EXACTLY ONE SCREEN TALL, PADDING INCLUDED (THE-APP-V2 §6.1). Without
           `border-box` the vertical padding lands OUTSIDE the 100vh, so the rail stood 32px
           taller than the viewport: its last item sat below the fold and its sticky drifted by
           those same 32px at the bottom of a long page. */
        boxSizing: 'border-box',
        height: '100vh',
        /* one axis, stated: `overflow-y: auto` alone computes `overflow-x: auto`, which would make
           a 64px column a sideways scrollport over a stray pixel of a label */
        overflowY: 'auto',
        overflowX: 'clip',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.sizing.scale600,
      }}
    >
      {/* ── THE HEAD: the mark, and the control that opens and shuts the rail (§77.3) ────────── */}
      <div style={headStyle(open, theme)}>
        <a
          href={`#/${HOME}`}
          title="Rocoto"
          aria-label="Rocoto"
          style={{ display: 'grid', placeItems: 'center', textDecoration: 'none', color: 'inherit', flex: '0 0 auto' }}
        >
          <RocotoMark />
        </a>
        {roomToChoose && <RailToggle open={open} />}
      </div>

      {/* SEARCH, WHERE IT CAN BE PRESSED FROM EVERY SURFACE (§91.2). It sits above the places
          because it is not one of them — it reaches all three and the world beside them. */}
      <FindSeat open={open} intent="everything" />

      <nav
        aria-label="Areas"
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, width: '100%' }}
      >
        {areas.map((a) => {
          const on = a.id === current;
          return (
            <a
              key={a.id}
              href={`#/${a.id}`}
              data-area={a.id}
              aria-current={on ? 'page' : undefined}
              /* the word leaves the paint and stays on the record: the label a pointer rests on
                 and the one a screen reader announces are the same word in both states */
              aria-label={a.title}
              title={open ? undefined : a.title}
              style={seatStyle(on, open, theme)}
            >
              {hasGlyph(a.id) && <AreaGlyph id={a.id} />}
              {open && <SeatWord>{a.title}</SeatWord>}
            </a>
          );
        })}
      </nav>

      {/* THE FOOT IS THE PERSON. The spacer is what puts it there and keeps it there — a margin
          would leave it wherever the tab row happened to end. */}
      <span style={{ flex: 1, minHeight: theme.sizing.scale600 }} />
      {/* ABOVE THE ACCOUNT CHIP, in both rail states (§91.1). It draws nothing at all once there is
          nothing left to do — the card is «what am I supposed to do now», and a card answering that
          with «nothing» is furniture. */}
      <FootJourney open={open} />
      <ProfileSeat owner={owner} inWorld={false} open={open} />
    </aside>
  );
}

/* ═══ THE ADMINISTRATION'S RAIL (FEED-IA §53 · THE-ADMIN-CANON §7) ════════════════════════════
 *
 * «They would change the sidebar, and they would have a back button at the top.»
 *
 * ┌─ THE ADMIN WORLD ────────────────────────────────────────────────────────┐
 * │ HEAD   the back door — ArrowLeft, and the WORD of where it returns to     │
 * │ SEATS  the nine, in canon order, same grammar as the desk's rail          │
 * │ FOOT   Account — the person, over a hairline: the scope break, drawn      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * IT IS THE SAME RAIL WITH A DIFFERENT REGISTRY, and that is the whole architecture of a world:
 * the same 76px column, the same seat anatomy, the same lit state, the same sticky full-height box.
 * What swaps is the head (a way home becomes a way BACK), the list (areas become seats) and the
 * foot (the person's MENU becomes the person's SEAT, because inside the world the account is a
 * place rather than a shortcut).
 *
 * THE BACK DOOR NAMES ITS DESTINATION. A bare arrow says «somewhere behind you», and a person who
 * arrived by deep link has no idea where that is — so the head carries the word of the desk area it
 * returns to («Sales»), read off the router's own memory of where they were standing.
 */

export function AdminRail({ current, back, backTitle }: { current: string; back: string; backTitle: string }) {
  const [, theme] = useStyletron();
  /* THE WORLD FOLLOWS THE SAME STATE (§77.3). One fact, one store: a person who shut the rail on
     the desk finds it shut inside Administration, because it is the same rail with a different
     registry and «two rails that remembered separately» is two things to keep in step. */
  const open = useRailOpen();
  /* THE CHOICE IS OFFERED WHERE THERE IS A CHOICE (§43: never a control that does nothing). At the
     stacked rung the rail is collapsed by the room rather than by the person, so the chevron would
     be a control whose press changed nothing on the screen. */
  const roomToChoose = !useStacked();
  const calm = useCalm();

  return (
    <aside
      data-testid="rail"
      data-world="admin"
      data-rail={open ? 'expanded' : 'collapsed'}
      style={{
        /* THE WORLD'S OWN WIDTH (§53: «they would change the sidebar») IS NOW THE DESK'S. With the
           word beside the mark instead of under it, one measurement holds both registries — see
           the widths block at the head of this file. `ADMIN_RAIL_WIDTH` still names it, because
           the frame lays its grid out with that name. */
        width: railWidth(open),
        transition: railMotion(theme, calm),
        borderRight: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        padding: `${theme.sizing.scale600} ${theme.sizing.scale200}`,
        position: 'sticky',
        top: 0,
        boxSizing: 'border-box',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'clip',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.sizing.scale600,
      }}
    >
      {/* ── THE HEAD: the way BACK, and the same control the desk's rail carries (§77.3) ─────
          The world's head is a DOOR rather than a mark, so the two members are the back seat and
          the toggle — laid out by the same rule, in the same region, in the same order. */}
      <div style={headStyle(open, theme)}>
        <a
          href={back}
          data-testid="admin-back"
          data-back-to={back}
          title={`Back to ${backTitle}`}
          aria-label={`Back to ${backTitle}`}
          style={{
            ...seatStyle(false, open, theme),
            width: open ? undefined : '100%',
            flex: open ? 1 : '0 0 auto',
          }}
        >
          <Glyph id="back" size={STEP.medium} />
          {open && <SeatWord>{backTitle}</SeatWord>}
        </a>
        {roomToChoose && <RailToggle open={open} />}
      </div>

      {/* THE SAME SEAT, ON THE SAME SHELF, ANSWERING WITH THE SEATS (§91.2). The world's search
          leads with what the world is made of — «the list beneath varying by intent» is exactly
          this, and it is the only thing about the control that changes between the two rails. */}
      <FindSeat open={open} intent="admin" />

      <nav
        aria-label="Administration"
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, width: '100%' }}
      >
        {ADMIN_ORDER.map((seat) => {
          const on = seat === current;
          return (
            <a
              key={seat}
              href={`#/${ADMIN}/${seat}`}
              data-seat={seat}
              aria-current={on ? 'page' : undefined}
              aria-label={ADMIN_TITLE[seat]}
              title={open ? undefined : ADMIN_TITLE[seat]}
              style={seatStyle(on, open, theme)}
            >
              <AdminSeatMark id={seat} />
              {open && <SeatWord>{ADMIN_TITLE[seat]}</SeatWord>}
            </a>
          );
        })}
      </nav>

      {/* THE SCOPE BREAK, DRAWN (THE-ADMIN-CANON §2). Cuenta is the PERSONAL scope and the nine
          above it are the BUSINESS's — the separation is the foot placement itself, so the spacer
          pushes it down and a hairline states it. Two scopes, one rail, and no label needed to say
          which is which. */}
      <span style={{ flex: 1, minHeight: theme.sizing.scale600 }} />
      {/* THE SAME CARD, IN THE SAME SEAT (§91.1). A journey that vanished inside Administration
          would be the app forgetting what a person is in the middle of because they went to look at
          a setting. It stands ABOVE the scope break, because it is the house's business. */}
      <FootJourney open={open} />
      <span
        aria-hidden="true"
        style={{ width: '100%', height: 1, background: theme.colors.borderOpaque, flex: '0 0 auto' }}
      />
      <a
        href={`#/${ADMIN}/${ADMIN_FOOT}`}
        data-seat={ADMIN_FOOT}
        data-testid="admin-account"
        aria-current={current === ADMIN_FOOT ? 'page' : undefined}
        aria-label={ADMIN_TITLE[ADMIN_FOOT]}
        title={open ? undefined : ADMIN_TITLE[ADMIN_FOOT]}
        style={{ ...seatStyle(current === ADMIN_FOOT, open, theme), width: '100%' }}
      >
        <Glyph id="who" size={STEP.medium} />
        {open && <SeatWord>{ADMIN_TITLE[ADMIN_FOOT]}</SeatWord>}
      </a>
    </aside>
  );
}

/* ── THE WORLD ON A PHONE (THE-ADMIN-CANON §7's last paragraph, §9's open call) ────────────────
 * «The phone… pushes the world full-screen with the back at top.»
 *
 * A 390px column has no room for a rail beside the work, so the world's navigation becomes its own
 * SCREEN — the index — and a seat is pushed over it. That is the push model the phone already uses
 * for a customer's sheet and an albarán, applied one level up, and the way back out of a seat is
 * the same gesture as the way back out of the world.
 *
 * ⚠ THE DEFAULT TAKEN, RECORDED (THE-ADMIN-CANON §9): the bottom row keeps a fourth seat and it
 * opens THIS index. Peter's own call is whether the phone's door belongs on the row at all or only
 * behind a profile — the shape §53 implies is built, and the decision stays his.
 */

export function AdminIndex({ back, backTitle }: { back: string; backTitle: string }) {
  const [, theme] = useStyletron();

  const row = (seat: AdminSeatId, foot = false) => (
    <a
      key={seat}
      href={`#/${ADMIN}/${seat}`}
      data-seat={seat}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale500,
        padding: theme.sizing.scale600,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        textDecoration: 'none',
        color: theme.colors.contentPrimary,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          boxSizing: 'border-box',
          width: 36,
          height: 36,
          flex: '0 0 auto',
          borderRadius: theme.borders.radius200,
          background: theme.colors.backgroundSecondary,
        }}
      >
        {foot ? <Glyph id="who" size={STEP.medium} /> : <AdminSeatMark id={seat} />}
      </span>
      <span style={{ ...theme.typography.LabelMedium, flex: 1, minWidth: 0 }}>{ADMIN_TITLE[seat]}</span>
      <span data-chevron="drill" aria-hidden="true" style={{ display: 'inline-flex', color: theme.colors.contentTertiary, transform: 'rotate(-90deg)' }}><Glyph id="caret" size={STEP.small} /></span>
    </a>
  );

  return (
    <div data-testid="admin-index" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      <a
        href={back}
        data-testid="admin-back"
        data-back-to={back}
        aria-label={'Back to ' + backTitle}
        title={'Back to ' + backTitle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          textDecoration: 'none',
          color: theme.colors.contentSecondary,
          alignSelf: 'flex-start',
        }}
      >
        <Glyph id="back" size={STEP.medium} />
      </a>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {ADMIN_ORDER.map((seat) => row(seat))}
      </div>

      {/* the scope break, on the phone as on the desk: the person stands apart from the house */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {row(ADMIN_FOOT, true)}
      </div>
    </div>
  );
}
