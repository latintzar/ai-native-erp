/* THE FRAME — the app, assembled: the navigation · day bar · the strips · the area · the chats.
 *
 * The frame is what an area package mounts INTO. It owns the four things that are true on every
 * surface — where you are, what day it is, which documents are open, and that the conversation is
 * one press away — and it owns nothing an area owns.
 *
 * ═══ A CONTINUUM, NOT TWO HOUSINGS (FEED-IA §103 · THE-APP-V2 §1.4) ════════════════════════
 * «The whole wide square phone is dumb. They should just resize with my browser.» So the frame
 * stands on FOUR RUNGS and states which one it is drawing (`data-width`):
 *
 *   desk        ≥1440   rail · two panes at full anatomy
 *   compressed  1096+   rail · two panes, narrowed honestly (the sheet yields first)
 *   stacked     560+    rail · the same full-height box, ONE PANE AT A TIME
 *   phone       ≤559    the bottom row of four, one column, a thread full screen
 *
 * The numbers, and the measurements every one of them comes off, are in `shell/viewport.ts`; this
 * file reads the rung and never computes one. Everything between 560 and 720 used to get the phone
 * housing stretched across a window twice a handset's width — that is the wide square phone, and
 * the rung above it is where it went. The `minWidth: 880` that used to sit on this element stays
 * gone, and nothing here scrolls sideways at any width, on any rung.
 *
 * ═══ THE DESK IS TWO COLUMNS AGAIN (FEED-IA §15, §22.1) ════════════════════════════════════
 * The frame used to reserve a THIRD column for the chats, and the founder's verdict on that was
 * flat: chats are an Intercom-type overlay, not a sidebar. So the frame reserves nothing for them:
 *
 *   1 · [rail | feed]     — the default.
 *   2 · [rail | detail]   — an albarán is open in full: the LIST YIELDS, and the open-items strip
 *                           takes the line so flipping between open documents is one click.
 *
 * The conversation floats OVER either of them, summoned from the launcher in the corner and gone
 * completely when dismissed (`ChatsOverlay` owns that behaviour). `data-layout` on the root still
 * states which of the two is drawn, and whether a thread is up.
 *
 * ═══ AND THE AGENT IS THE THIRD TRACK (FEED-IA §196.2, Peter 2026-09-04) ═══════════════════
 * «i told u to port from the fucking app.soyrocoto.com which has the exact UX i wanted for the
 * actual chat and composer in full even down to the grid.»
 *
 * THE CHATS ARE AN OVERLAY AND THE COPILOT IS NOT, and that is the whole distinction. The live
 * app draws it as a track — `.desk.has-copilot { grid-template-columns: 216px minmax(0,1fr)
 * 336px }` — so the work REFLOWS beside it. E193.02 shipped it docked over the work instead,
 * because the frame was not its territory, and the audit photographed the cost: the day bar's
 * «Sales» half covered, the right pane gone behind the column, the launcher it was opened from
 * underneath it.
 *
 *   3 · [rail | work | agent]  — while the Copilot stands. `data-copilot-track` is the reserved
 *                               width, and it is the column's OWN width: one number, read from
 *                               `viewport.ts`, so the track and the thing standing in it can
 *                               never disagree.
 *
 * THE ROOM THEN DECIDES THE RUNG. `usePosture` reads the width MINUS this track (see
 * `viewport.ts`), so a 1366px desk with the agent open stands its two panes one at a time rather
 * than squeezing a 640px document into 494. And below the rung where two things fit at all, the
 * agent reserves nothing and stands in FRONT of the work as a destination — the stacked desk's
 * own push model, not an overlay over half a screen.
 *
 * ═══ AND THE PHONE IS THE SAME WIDGET NOW (FEED-IA §42, decided) ═══════════════════════════
 * «Chats live ONLY in the widget. The Chats tab/area dies, desk and phone.» The frame used to draw
 * the phone's conversation itself — a fixed full-screen thread with a segmented Albarán | Chat flip
 * over it — because the phone's chats were a TAB and the widget was the desk's answer. With the tab
 * gone that machinery would be a second rendering of one store, so it is gone with it: the frame
 * mounts `ChatsOverlay` on both housings and the widget draws its own phone posture (full screen
 * down to the bottom row, launcher above it). The way back to an open albarán is the panel's own
 * chevron — putting the conversation away leaves the document exactly where it was.
 *
 * ═══ THE COLUMN'S ONE DOOR ═════════════════════════════════════════════════════════════════
 * A surface that opens a detail BESIDE its list needs more than a reading column for as long as
 * the detail is open. So the frame publishes `useWideColumn(open)`: call it with `true` and the
 * clamp widens for that surface, call it with `false` — or unmount — and it comes back. An open
 * albarán widens it on its own, because that state is the frame's own business.
 *
 * ═══ AND THE AREA'S NAME IS THE FRAME'S, NOT THE PAGE'S (FEED-IA §35.2) ════════════════════
 * «THE ACTIVE AREA'S NAME MOVES TO THE HEADER, centred above the content — never inside the
 * content area.» It used to be an `h1` drawn by every area's own `Page`, which put the one word
 * that never changes inside the one column that always does: it took the first eighty pixels of
 * every surface, it scrolled away with the work, and four surfaces each drew it separately.
 *
 * It is one line of chrome now, and three decisions make it work:
 *
 *   1 · IT IS CENTRED IN `main`, and so is the reading column — the same box, the same middle —
 *       so the name stands over the content at every width and at both column clamps, including
 *       the wide one an open albarán asks for. Nothing measures anything.
 *   2 · IT STAYS. A header that leaves on scroll is a heading, so it is sticky, and it parks
 *       directly under the day bar rather than behind it. `AREA_TITLE_BAR` is its height, stated
 *       once and published, because the two areas that stick things of their own under the chrome
 *       have to be able to agree with it.
 *   3 · IT HOLDS NO GROUND OF ITS OWN. The bar is painted in the page's own paper and carries no
 *       rule, so the chrome over the work stays ONE object — the day bar and its hairline — with
 *       the area's name standing in the air below it rather than a second storey of toolbar.
 *
 * IT IS THE PAGE'S `h1`, MOVED. One heading per screen, and this is it; `Page` keeps the same
 * word as its section's accessible name, so a surface is still announced as itself.
 *
 * ═══ AND THE DESK IS PANES, NOT BOXES (FEED-IA §38) ════════════════════════════════════════
 * «I hate that there's scrolling within this, and that the albarán panel is a box within, where it
 * should just be full height. The scrolling behavior is horrible.»
 *
 * So the frame grows the other half of the mail-app grammar: a surface may ask to be laid out as
 * FULL-HEIGHT PANES, and while it does, THE PAGE ITSELF DOES NOT SCROLL. The root is exactly one
 * viewport tall, the chrome takes the top of it, and everything under the chrome is the surface's
 * own — edge to edge, its panes each one scrollport, with nothing scrolling behind them.
 *
 *   `usePanes(true)`   the frame stops clamping and padding: it hands the surface one box that is
 *                      the remaining height and the remaining width, and the surface draws its
 *                      panes inside it.
 *   `usePanes(false)`  the reading column, as it always was — the areas that are one column of
 *                      work still scroll the page under the chrome, which is right for them.
 *
 * IT IS THE DESK'S LAW AND NOT THE PHONE'S (§38, last line). A phone is one screen with one scroll
 * and a push model on top of it; asking a 390px column to hold two panes would be the desk's
 * answer to a question the phone does not have. So the ask is ignored below the breakpoint.
 *
 * ═══ AND THE FRAME HOLDS TWO WORLDS NOW (FEED-IA §53) ══════════════════════════════════════
 * «Administration is its own world — they would change the sidebar, and they would have a back
 * button at the top.»
 *
 * THE SEAM IS ONE PROP AND ONE TERNARY, and that is the point of putting it here. Everything the
 * frame owns is true in both worlds — where you are, what day it is, what is open, that the
 * conversation is one press away — so a second world costs a second RAIL and nothing else:
 *
 *   world = 'desk'    Rail: the mark · the three areas · the person's menu at the foot
 *   world = 'admin'   AdminRail: the way BACK · the nine seats · the person's own seat at the foot
 *
 * The panes posture, the day bar, the open-items strip, the chats overlay and
 * the phone's bottom row are all identical, because a seat in Administration is a surface like any
 * other and the app it lives in has not changed. `data-world` states which is drawn, so a drive can
 * hold the frame to it rather than inferring it from what the rail happens to contain.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { useConfig } from '../config';
import type { AreaMeta } from './area';
import Rail, { AdminRail, railWidth, useRailOpen } from './rail';
import BottomNav, { BOTTOM_NAV_HEIGHT } from './bottom-nav';
import DayBar from './day-bar';
import OpenItemsStrip, { OpenItemsProvider, useOpenItems } from './open-items';
import { ChatsOverlay, LAUNCHER_LANE } from './chats';
import SearchModal from './search-modal';
import { AssistantHost } from '../assistant';
import { BrowserPrintHost } from '../browser-print';
import { Glyph, STEP } from '../glyphs';
/* THE GUIDED WALK IS FRAME CHROME (THE-JOURNEY-CANON §3.4). It spotlights controls that belong to
   four different surfaces — the launcher, the chats panel, a river row — so its host is mounted
   once, above all of them, and no area has to know it exists. The JOURNEY'S OWN CARD is not here:
   §91.1 puts it in the sidebar's foot, and `shell/rail.tsx` mounts it there. */
import { GuideHost } from '../activation-guide';
/* ── THE CHAPTER AND THE FRONT DOOR ARE MOUNTED ABOVE THE APP, NOT IN IT (§102.1 · §105) ──────
 * They used to stand here, and it was WRONG in a way only the drive could see: a stage change
 * moves between the two WORLDS (§53), the router swaps which `Frame` it is drawing, and the frame's
 * subtree is torn down with it — so the veil vanished the instant the app changed under it, which
 * is the one thing a chapter divider exists to prevent. They are siblings of `<App/>` in
 * `main.tsx` now: above the router, under the same providers, immune to every navigation. */

import { useThreads, useThreadFocus } from './threads';
import { COLUMN, PHONE, TOUCH_FLOOR, TOUCH_FLOOR_TALL, useCopilotTrack, usePosture } from './viewport';

/** the column an area gets when it asks for room: the reading column, a detail panel and the gap
 *  between them, so a feed beside its own detail is still a feed and not a gutter */
const COLUMN_WIDE = 1320;

/** THE SEAT THE AREA'S NAME HOLDS UNDER THE DAY BAR (§35.2), stated once and published because
 *  Sales and Stock both park sticky things of their own under the whole of the chrome. One number
 *  on both housings: the name is the same size on a phone as on a desk, because it is the same
 *  fact, and a phone that shrinks the one word saying where you are has saved nothing worth having. */
/* §36.1: the name lives INSIDE the day bar now; the separate bar is gone and its height is zero. */
export const AREA_TITLE_BAR = 0;

/* ── THE COLUMN ───────────────────────────────────────────────────────────────────────────── */

const ColumnContext = React.createContext<(wide: boolean) => void>(() => {});

/** Ask the frame for room while `wide` is true, and give it back when it is false or when the
 *  surface unmounts. Areas call this; nothing else does. */
export function useWideColumn(wide: boolean): void {
  const ask = React.useContext(ColumnContext);
  React.useEffect(() => {
    ask(wide);
    return () => ask(false);
  }, [ask, wide]);
}

/* ── THE PANES (FEED-IA §38) ──────────────────────────────────────────────────────────────── */

const PanesContext = React.createContext<(on: boolean) => void>(() => {});

/* ── THE RESERVED LANE IS REPEALED (FEED-IA §83.3) ────────────────────────────────────────────
 * A `ReserveContext` stood here, with a `useReservedLane` hook and an `AreaMeta.lane` beside it.
 * Its whole job was to tell the floating conversation how wide the right-hand pane was so the
 * bubble could step LEFT of it — and §83.3 puts the bubble on the viewport's own corner at every
 * width («why is the chat thing not bottom corner of the viewport»), so there is nothing left for
 * the number to do. The law it protected survives INVERTED and closer to the thing it protects:
 * whatever draws a bar at the foot of a pane leaves the launcher's lane at the end of that bar,
 * in its own padding, at both widths. Stock's price bar already worked this way.
 *
 * It is retired here rather than left standing and unread: a surface declaring a lane nothing
 * consumes is a claim the app no longer honours, and those are what make a file lie.
 */

/** Ask the frame to stop being a scrolling page and become a full-height box while `on` is true.
 *  The surface then owns every pixel under the chrome and draws its own panes in it. Same shape as
 *  `useWideColumn`: ask on mount, give it back on unmount, so a surface can never leave the frame
 *  in a posture the next surface did not ask for. */
export function usePanes(on: boolean): void {
  const ask = React.useContext(PanesContext);
  React.useEffect(() => {
    ask(on);
    return () => ask(false);
  }, [ask, on]);
}

/* ── THE SCROLLBARS (FEED-IA §38, off the founder's own screenshot) ───────────────────────────
 * A fat default thumb was standing inside the albarán panel, and it is half of what «the scrolling
 * behavior is horrible» was pointing at: the browser's own 15px bar with a grey block in it says
 * «this is a web page with a box in it», and the apps this frame is set against — Linear, Gmail —
 * say nothing at all until you are actually scrolling something.
 *
 * SO IT IS STATED ONCE, FOR EVERY SCROLLPORT IN THE APP. It is a global rule rather than a style on
 * each pane on purpose: the sheets the other packages are building inherit it without knowing it
 * exists, and no surface can ship the fat bar by forgetting.
 *
 *   · 8px, not 15 — a bar you can still grab, at the width a modern app uses.
 *   · THE TRACK IS NOTHING. A painted track is a permanent gutter down the side of the work.
 *   · THE THUMB IS THE QUIETEST STEP ON THE RAMP, inset by two pixels of its own transparent
 *     border, and it darkens under the hand that is about to drag it. It is not hidden until
 *     hover: the rule that did that was `*:hover`, and a universal hover selector makes the
 *     browser re-match every element in a six-hundred-row river on every pointer move. A
 *     scrollbar is not worth a frame budget.
 *
 * EVERY COLOUR IS A TOKEN, so it re-themes with everything else — the mono ramp, which is where
 * this app keeps its quiet greys, and never a literal.
 */
function Scrollbars() {
  const [, theme] = useStyletron();
  const css = `
*{scrollbar-width:thin;scrollbar-color:${theme.colors.mono400} transparent}
*::-webkit-scrollbar{width:8px;height:8px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-corner{background:transparent}
*::-webkit-scrollbar-thumb{background-color:${theme.colors.mono400};border-radius:8px;border:2px solid transparent;background-clip:content-box}
*::-webkit-scrollbar-thumb:hover{background-color:${theme.colors.mono600}}
`;
  return <style data-testid="thin-scrollbars" dangerouslySetInnerHTML={{ __html: css }} />;
}

/* ── THE PHONE'S TOUCH FLOOR, STATED ONCE (INTX-12 · FEED-IA §188.2 · E193.14) ────────────────
 * INTX-12 closes on what fails it, and one of the items is «**sub-44 px touch actions**»; §188.2
 * gives the band — «Established 20 px line-icon family in 44–48 px optical-centred targets». W8's
 * audit then measured the app at 390 and found the floor broken almost everywhere a mini button
 * stands: the Sales filters at 28, `sku-receive` at 28, the day's print flush at 28, the catalogue's
 * whole door row at 36.
 *
 * SO IT IS A RULE AND NOT SIXTY EDITS, for the same reason the scrollbars above are: a floor
 * applied button by button is a floor the next button forgets. Base states its own contract —
 * every `<Button>` renders `data-baseweb="button"` (baseui/button/button.js) — so one selector
 * reaches every Base button in the app, in every package, including the ones not written yet.
 * «Never redraw — lift the real thing»: this lifts Base's own attribute rather than inventing a
 * class of our own to remember to add.
 *
 * IT IS THE PHONE'S, AND ONLY THE PHONE'S. A pointer lands on a pixel and a thumb lands on a pad
 * about ten millimetres across, so 28px beside a dense desk row is right for a mouse and wrong for
 * a finger. The media query is the ladder's own `PHONE` (`viewport.ts`), so the desk keeps every
 * bit of its density and no desk geometry moves at all.
 *
 * AND IT IS A FLOOR, NOT A SIZE. `min-height`/`min-width` grow a control that is under it and
 * leave one that is already over it exactly where it stood: a full-width Save stays full width, a
 * 20px mark becomes a 44px target around the same 20px mark. `min-width` is stated as `44px` for
 * the icon-only marks and is a no-op for everything with words in it.
 *
 * AND A TAB IS A PRESS TOO. Base states `data-baseweb="tab"` on every tab it draws
 * (baseui/tabs-motion/tabs.js), and the export centre's three destinations were 36px tall at 390.
 * Height only: a tab's width is its row's, and `FILL.fixed` divides that row itself.
 *
 * AND THE DOCUMENT'S OWN BAR STANDS AT 48. INTX-12's Albarán phone act-bar row is explicit —
 * «`Print` (label always spoken, `flex: 1`) then the workflow verb; both ≥ 48 px» — so the one
 * place the house already stands taller than the floor keeps standing taller, said here rather
 * than inside two controls that are assembled somewhere else.
 *
 * THE SELECTOR IS DOUBLED ON PURPOSE. Styletron's own class is one class of specificity and so is
 * one attribute; a tie is decided by source order, and source order between an injected stylesheet
 * and a `<style>` in the tree is not a thing a floor should depend on. `[data-baseweb][data-baseweb]`
 * is the same selector said twice — no new concept, one step of specificity — so the floor wins
 * wherever it is mounted.
 *
 * ⚠ WHAT IT CANNOT REACH is the app's own hand-rolled `<button>`s — the net's door, the search
 * summon, the run's chip, a line's tail, an inline door in a fact line. Those are raised where
 * they are written, because each one is a judgement about whether it is a control or a word.
 * `drives/drive-202-phone-targets.py` measures BOTH kinds and is the thing that keeps them honest.
 */
function TouchFloor() {
  const css = `
@media ${PHONE}{
[data-baseweb="button"][data-baseweb="button"]{min-height:${TOUCH_FLOOR}px;min-width:${TOUCH_FLOOR}px}
[data-baseweb="tab"][data-baseweb="tab"]{min-height:${TOUCH_FLOOR}px}
[data-testid="phone-detail-bar"] [data-baseweb="button"][data-baseweb="button"]{min-height:${TOUCH_FLOOR_TALL}px}
[data-day-paper] [data-baseweb="button"][data-baseweb="button"]{min-height:64px}
}
`;
  return <style data-testid="touch-floor" dangerouslySetInnerHTML={{ __html: css }} />;
}

/* ── THE FLIP ─────────────────────────────────────────────────────────────────────────────── */

/* THE DESK'S FLIP LEFT THIS FILE WITH THE CHATS COLUMN (FEED-IA §22.5). «List navigation (the ‹ ›
 * flip) is about the LIST» — it belongs to the panel head over the document, which draws it, and a
 * second copy riding a floating chat widget would be a group thinking inside a single thing.
 *
 * AND THE PHONE'S FLIP LEFT WITH THE PHONE'S THREAD (FEED-IA §42). A segmented Albarán | Chat bar
 * existed because two fixed full-screen surfaces were live at once and neither could be reached
 * from the other. The conversation is a widget on the phone now: it stands OVER the albarán and the
 * albarán is still there when it is put away, so the way between them is the panel's own chevron
 * and the launcher — one gesture each way, and no third control naming the two sides. */

/* ── THE AREA'S NAME (FEED-IA §35.2) ──────────────────────────────────────────────────────── */

/** How tall the day bar is standing right now, so the name parks exactly under it rather than
 *  eight pixels below it with the work sliding through the gap. It is MEASURED and not assumed
 *  because the bar is one height on a phone and another on a desk, and both change again when the
 *  web face lands after the first paint. */


/* ── THE FRAME ────────────────────────────────────────────────────────────────────────────── */

export type World = 'desk' | 'admin';

export type FrameProps = {
  /** the registry of the world being drawn: the desk's areas, or the administration's seats. It is
   *  what the frame reads a surface's POSTURE off, and what the desk's rail draws. */
  areas: AreaMeta[];
  current: string;
  children: React.ReactNode;
  /** WHICH WORLD (§53). It decides the rail, and the phone's way back out of a seat. */
  world?: World;
  /** THE PHONE'S BOTTOM ROW, which is the DESK's places in both worlds — a person inside
   *  Administration on a phone can still walk straight back to Sales, and a row that shrank to
   *  whatever registry was current would take that away from them. Defaults to `areas`, which is
   *  the desk's own case. */
  tabs?: AreaMeta[];
  /** where the admin rail's back door goes, and the word it says — the desk area the person left */
  back?: string;
  backTitle?: string;
};

function Assembled({
  areas,
  current,
  children,
  world = 'desk',
  tabs,
  back = '#/sales',
  backTitle = 'Sales',
}: FrameProps) {
  const [, theme] = useStyletron();
  /* ── WHICH RUNG OF THE CONTINUUM (FEED-IA §103) ─────────────────────────────────────────────
   * The frame reads the posture ONCE and states it, and every other surface asks `viewport.ts` the
   * question it actually has. `phone` is still the phone — the housing — and it is now a genuinely
   * narrow window rather than everything under 720. */
  const posture = usePosture();
  const phone = posture === 'phone';
  const { config, derived } = useConfig();
  const cast = derived.cast;

  /* THE RAIL'S STATE, READ HERE FOR THE GRID (§77.3). It is the rail's own store — the frame owns
     no rail state — and the only reason the frame subscribes is that the TRACK the rail stands in
     belongs to this grid. One fact, two readers. */
  const railOpen = useRailOpen();
  /* THE AGENT'S TRACK (§196.2). The column states whether it is standing and how wide it is; the
     frame's only job is to leave the room. Zero whenever it is away or standing in front of the
     work, so the grid is the two columns §15 settled on and nothing here changes. */
  const copilotTrack = useCopilotTrack();
  const railTransition =
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function' ||
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const threads = useThreads(cast);
  const focus = useThreadFocus(cast, threads);
  const open = useOpenItems();

  const [wide, setWide] = React.useState(false);

  /* ── THE ARRIVING SURFACE'S POSTURE, KNOWN BEFORE IT RENDERS (§38, and §45.3's flicker) ────
   * The area declares `panes` in its own meta, so the frame is in the right posture on the FIRST
   * paint of a move rather than one paint later. That is the whole of the fix; the paragraph below
   * is why it had to be structural.
   *
   * ═══ WHAT THE FOUNDER SAW ═══════════════════════════════════════════════════════════════
   * «A random footer, flickering/flipping modes» (§45.3). Hunted by rAF-sampling the chrome's own
   * bounding boxes across every area switch, every posture change and every narrow toggle: a box
   * that LEAVES a value and comes BACK to it is a transient nobody settled on, where a one-way
   * move is simply the layout changing. Two boxes did it, on every single area switch:
   *
   *     main      [.. 1100] → [.. 47100] → [.. 1100]
   *     launcher  [1020, 880] → [1020, 1520] → [1020, 880]
   *
   * For one painted frame the desk stood in the COLUMN posture with a pane surface inside it — the
   * page grew to forty-seven thousand pixels — and the floating conversation, having lost the lane
   * the sheet reserves, flew to the far corner and back. A thing at the bottom of the screen that
   * jumps on every move is exactly «a random footer, flipping modes».
   *
   * ═══ WHY THE RENDER-TIME RESET DID NOT KILL IT ═════════════════════════════════════════════
   * The reset below is correct and it is not the bug. It drops the leaving area's claims during
   * render, which is right — but the ARRIVING area re-made its claim from an EFFECT, and an effect
   * runs after the paint. So there was always exactly one painted frame between «the old area's
   * posture is gone» and «the new area has said what it needs». No amount of tuning the reset
   * closes a gap that exists because the frame is learning at runtime what the app knew statically.
   *
   * `usePanes` survives for the case it is actually for: a surface changing posture WITHIN itself.
   * A phone is one screen and one scroll, so the ask is recorded and ignored below the breakpoint,
   * and the surface draws its push model instead.
   */
  const here = areas.find((a) => a.id === current);
  const [asked, setAsked] = React.useState<boolean | null>(null);
  /* ── AND A SURFACE THAT SAYS «no panes» IS OBEYING A LAW (FEED-IA §87, ruled 2026-08-28) ────
   * «THE DESK WORKS IN PANES; ADMINISTRATION SEATS are settings surfaces and MAY SCROLL AS ONE
   * COLUMN.» Eight seats answer `false` here and the page under them scrolls — 1.238px on App
   * settings, 3.313px on Your data — and that is now the recorded behaviour rather than eight
   * departures from §38 waiting to be repaired. The frame needs no branch for it: a seat that
   * wants panes declares them (team, geography do), a settings seat does not, and this one
   * expression has always read both correctly. What changed is what the `false` MEANS.
   *
   * §38 STILL BINDS EVERYWHERE ELSE, and this is the line that enforces it: the river, the sheet,
   * the catalogue and the customers' book are the work, they say `true`, and the page they stand
   * on is exactly one viewport tall with one scrollport inside it. */
  const panes = (asked ?? here?.panes ?? false) && !phone;
  /* ── LEAVING AN AREA DROPS ITS CLAIMS, AND IT HAPPENS DURING RENDER ──────────────────────
   * A surface claims three things from the frame — the wide column, the panes, the right-hand lane
   * — and every one of them has to be gone the moment you are standing somewhere else.
   *
   * IT IS A RENDER-TIME RESET AND NOT AN EFFECT, and the bug that taught it is worth keeping: an
   * effect here runs AFTER the arriving surface's own effect, so it cancelled the panes the new
   * surface had just asked for. The desk then stood in the column posture with a pane surface
   * inside it and the page scrolled forty thousand pixels — and guarding it against the first
   * paint fixed the first visit while leaving every RETURN broken, which is the shape of a fix
   * treating a symptom.
   *
   * Adjusting state while rendering is React's own answer to «a prop changed, so this state is
   * stale»: it happens before the children render, therefore before any child effect runs, so the
   * arriving surface always has the last word about what it needs. The hooks' own cleanups are the
   * second half — they cover a surface that stops asking without the area changing.
   *
   * AND THE POSTURE SURVIVING A MOVE IS NOT A BUG. §38 makes every master-detail surface panes, so
   * walking from Sales to the catalogue keeps them: the frame is answering two surfaces that both
   * asked. What has to come back is the posture for a surface that is one column of work. */
  const [lastArea, setLastArea] = React.useState(current);
  if (lastArea !== current) {
    setLastArea(current);
    setWide(false);
    /* THE POSTURE FALLS BACK TO WHAT THE ARRIVING AREA DECLARES, never to `false`. `null` means
       «nobody has overridden it», so this same render already knows the answer — which is the
       difference between a reset and a flicker (§45.3). */
    setAsked(null);
  }

  const detailOpen = open.count > 0;
  const threadOpen = focus.id !== null;

  const layout = detailOpen
    ? threadOpen ? 'detail+thread' : 'detail'
    : threadOpen ? 'feed+thread' : 'feed';

  /* THE NAME COMES OFF THE REGISTRY, never off a string in here (§35.2). `App.tsx` already stamps
     the shell's own four words onto every registered area, so the header says exactly what the
     rail and the bottom row say. A route that is not an area draws no bar at all — the `Missing`
     screen carries its own heading, and a chrome title over a screen saying «this is not a place»
     would be the app naming somewhere it has not got. */
  const areaTitle = areas.find((a) => a.id === current)?.title ?? null;

  /* ── THE FOOT LEAVES THE LAUNCHER'S LANE (FEED-IA §83.3 · AUDIT-2 C16) ──────────────────────
   * «Whatever stands at the foot of a pane RESERVES the corner for it in its own padding» — the
   * inversion §83.3 minted when the launcher stopped stepping around the panes and took the
   * viewport's corner for good. The launcher held up its half; the column never reserved anything,
   * so the last rows of every scrolling surface finished UNDER the circle: 16px of them on the
   * desk (a 64px runway against an 80px lane) and 32px on the phone, where the launcher rides
   * above the bottom row and the column's runway was 48.
   *
   * SO THE RUNWAY IS THE LANE, NEVER LESS, and it is one rule for every surface the frame lays out
   * in the column posture — read from `LAUNCHER_LANE`, which is the launcher's own number, so the
   * two can never drift apart. Where a surface already asks for more air than the lane, it keeps
   * it: this is a floor and not a setting.
   *
   * THE PHONE MEASURES FROM ABOVE THE BOTTOM ROW, which `main`'s own padding has already stepped
   * over — so both housings state the same 80 and the arithmetic underneath them differs by the
   * row, exactly as the launcher's own `bottom` does.
   *
   * PANES RESERVE THEIRS THEMSELVES (§38). In panes the frame pads nothing and clamps nothing, so
   * the surface's own bottom bar leaves the lane at its end — the rule Stock's price bar already
   * follows at both widths, and the reason §83.3 could invert the lane law at all. */
  const runway = Math.max(
    parseInt(phone ? theme.sizing.scale1200 : theme.sizing.scale1600, 10),
    LAUNCHER_LANE,
  );

  /* ── AND A SURFACE THAT OWNS ITS FOOT DOES NOT PAY THE LANE TWICE (AUDIT-2 C38) ────────────
   * A DECLARED-PANES SURFACE MOUNTS ITS OWN SCROLLPORT AND ITS OWN BOTTOM BAR at every width —
   * that is the whole of §38 and it is what `panes: true` in an area's meta says. On the desk the
   * frame already stands back («in panes the frame pads nothing»), which is where C38's claim was
   * really made: a surface that reserves its own foot and is reserved FOR takes the same lane
   * twice, and Stock's register lost eighty pixels to it.
   *
   * ⚠ AND THE FLAG NO LONGER DECIDES THE PHONE'S FOOT (§137's round). C38 answered the double
   * charge by dropping the phone's runway for every panes-declaring surface — Sales, Customers,
   * Stock and two admin seats, which is every surface made of a long list — and the launcher then
   * stood over the last rows of all of them (measured: the river's last row thirty pixels inside
   * the circle at 390). BOTH claims are true and they are about different things: the DESK's
   * question is «how tall is this box», the PHONE's is «where does the scroll end». The phone's
   * answer is the spacer at the end of this column and never a padding on it, so nothing above it
   * is shortened.
   *
   * AND THE LIVE ASK IS THE TRUTH, THE META ONLY THE DEFAULT. `meta.panes` is a DESK declaration —
   * it says «this is a master-detail surface», which is a fact about 1600 and says nothing about
   * what gets drawn at 390. `usePanes(…)` is the surface saying what it is drawing NOW, so it wins
   * where it has been called, and the meta answers only for the frame before the arriving area's
   * effect has run. That one change is what tells Sales and the Customers book (which stand their
   * panes DOWN on a phone and let the page scroll) apart from Stock (which draws `stock-panes` and
   * its own price bar at every width, and therefore reserves its own corner, C38's measure intact).
   */
  const ownsItsFoot = asked ?? Boolean(here?.panes);

  return (
    <ColumnContext.Provider value={setWide}>
     <PanesContext.Provider value={setAsked}>
      <div
        data-testid="frame"
        data-phone={phone ? 'yes' : 'no'}
        /* ── THE RUNG, STATED (FEED-IA §103) ────────────────────────────────────────────────
           `desk · compressed · stacked · phone`. It is published for the same reason `data-panes`
           and `data-world` are: a posture that can only be inferred from a computed width is a
           posture no drive can hold the frame to, and the whole of §103 is a law about which
           layout stands at which width. */
        data-width={posture}
        data-layout={layout}
        data-panes={panes ? 'yes' : 'no'}
        /* WHICH WORLD IS DRAWN (§53), stated rather than inferred. A drive that had to read the
           rail's contents to know where it was would be testing the rail, not the seam. */
        data-world={world}
        /* THE CLAIMS A SURFACE MAKES ON THE FRAME, READABLE FROM OUTSIDE. A posture that can only
           be inferred from a computed max-width is a posture no drive can hold the frame to — and
           the wide column is exactly what went wrong unseen for two areas. Stated, it is checkable. */
        data-wide={wide ? 'yes' : 'no'}
        /* THE TRACK THE AGENT IS STANDING IN (§196.2), stated in pixels so a drive holds the
           frame to «the work's right edge is the column's left edge» rather than eyeballing it. */
        data-copilot-track={copilotTrack}
        style={{
          /* PLAIN PAPER (FEED-IA §11, Peter 2026-08-24). The dotted ground made the work hard to
             see; the dot grid is the CHAT'S signature now and paints conversation surfaces only. */
          backgroundColor: theme.colors.mono100,
          /* THE PAGE IS EXACTLY ONE VIEWPORT AND NEVER SCROLLS while a surface is in panes (§38).
             It is stated here rather than on `html`, because a root that is its own height needs no
             global override — and a global override is the kind of thing an overlay's own scroll
             lock then fights with.
             AND `minHeight` IS THE ADMIN WING'S OWN POSTURE (§87), not the fallback that is left
             when §38 fails: a settings surface grows to its content and the page carries it. */
          ...(panes ? { height: '100vh', overflowY: 'hidden' } : { minHeight: '100vh' }),
          fontFamily: theme.typography.ParagraphMedium.fontFamily,
          display: 'grid',
          /* TWO COLUMNS ON THE DESK, AND THAT IS ALL (§15). The chats take none of this grid —
             they float over it — so the reading column and its detail have the whole width. */
          /* ── THE RAIL'S COLUMN IS THE RAIL'S OWN WIDTH, AND IT MOVES (FEED-IA §77.3) ────────
             The rail has two states now, and the grid track it stands in is the seam between them
             and the work. Both worlds read ONE function (`railWidth`), so the aside and the column
             it lives in can never disagree about a width that is animating — and the track carries
             the same Base step and curve the rail carries, so the whole desk widens as one object
             rather than as a rail that arrives before the work moves.
             GRID TRACKS ARE ANIMATABLE, and this is the one place the app relies on that; a calm
             reader gets neither transition, because `railMotion` returns nothing for them and this
             track's own transition is dropped with it. */
          /* THREE WHILE THE AGENT STANDS (§196.2): rail · work · agent. The third track is added
             rather than the work being covered, and it animates on the same curve the rail's does
             — so the desk widens and narrows as ONE object either way. */
          gridTemplateColumns: phone
            ? 'minmax(0, 1fr)'
            : `${railWidth(railOpen)}px minmax(0, 1fr)${copilotTrack ? ` ${copilotTrack}px` : ''}`,
          transition: phone || !railTransition
            ? undefined
            : `grid-template-columns ${theme.animation.timing400} ${theme.animation.easeInOutCurve}`,
          /* THE APP IS THE VIEWPORT'S WIDTH AND NEVER A PIXEL MORE, AT ANY WIDTH — but `clip`,
             never `hidden` (THE-APP-V2 §6.1). `overflow-x: hidden` computes `overflow-y: auto`,
             which makes THIS element the scrollport every sticky descendant resolves against; it
             never scrolls, so the rail and the chats sidebar had `position: sticky` on them and
             slid away with the page anyway. «The sidebar must be sticky» was a live bug hiding
             behind a correct-looking declaration. `clip` cuts the overflow without becoming a
             scroll container, so the sticky rails resolve against the viewport again. */
          maxWidth: '100%',
          overflowX: 'clip',
        }}
      >
        <Scrollbars />
        <TouchFloor />
        <GuideHost cast={cast} />


        {/* THE ONE SEAM (§53). Same column, same width, same sticky full-height box — a different
            registry and a different head. Everything under this line is world-blind. */}
        {!phone && (world === 'admin'
          ? <AdminRail current={current} back={back} backTitle={backTitle} />
          : <Rail areas={areas} current={current} owner={config.owner.name} />)}

        <main
          style={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            /* the chrome takes the top of the viewport and the surface takes the rest of it: the
               column has to be able to shrink for that, which is what `minHeight: 0` says to a
               flex child holding a scrollport (§38) */
            ...(panes ? { height: '100vh', minHeight: 0, overflow: 'hidden' } : null),
            /* the bottom row stands over the page, so the page ends above it */
            paddingBottom: phone ? `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))` : 0,
          }}
        >
          <DayBar phone={phone} title={areaTitle} />

          {/* ── THE PHONE'S WAY BACK OUT OF A SEAT (§53: «a back button at the top») ──────────
              A desk has a rail, and the rail's head IS the way back. A phone has neither, so the
              world's push model needs its own control: standing on a seat, this is the step back to
              the index; the index's own control is the step back to the desk. It is FRAME chrome
              rather than a seat's, for the reason every world-level control is — ten seats each
              drawing their own back is ten places it can drift. */}
          {phone && world === 'admin' && current && (
            /* IT IS A NAV BAR AND NOT A LINK, and the reason is a screenshot: on the phone the day
               bar carries no title (the bottom row names the tab) and the bottom row inside the
               world says «Admin» — so a person standing on the Plan seat was told the DAY and
               nothing about WHERE THEY WERE. The seat's name is the heading here, centred, with the
               way back beside it: the ordinary push-navigation bar, which is what §53's «a back
               button at the top» describes. */
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                borderBottom: `1px solid ${theme.colors.borderOpaque}`,
                background: theme.colors.backgroundPrimary,
                minWidth: 0,
              }}
            >
              <a
                href="#/admin"
                data-testid="admin-back-phone"
                aria-label="Back to Administration"
                title="Back to Administration"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  color: theme.colors.contentSecondary,
                  textDecoration: 'none',
                  flex: '0 0 auto',
                  zIndex: 1,
                }}
              >
                <Glyph id="back" size={STEP.medium} />
              </a>
              <h1
                data-testid="seat-title-phone"
                data-area-title={areaTitle}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  margin: 0,
                  ...theme.typography.LabelLarge,
                  color: theme.colors.contentPrimary,
                  maxWidth: '46%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {areaTitle}
              </h1>
            </div>
          )}

          {/* WHERE YOU ARE, over the middle of the work (§35.2). It stands between the day and the
              documents on purpose: the day is the app's, the name is the surface's, and what is
              open is the person's. */}

          {/* WHAT YOU HAVE OPEN, and only when something is. The day band that used to sit here
              died with FEED-IA §0.1 — the feed's own day headers carry the aggregate now. */}
          <OpenItemsStrip phone={phone} />

          {/* IN PANES THE FRAME PADS NOTHING AND CLAMPS NOTHING (§38). A gutter out here would be
              a margin the panes could not scroll under, and a clamp would put the mail-app grammar
              in a box — which is the thing the founder is looking at when he says «a box within».
              The surface takes the remaining height and the whole width, and its own panes carry
              their own gutters INSIDE their own scrollports. */}
          <div
            style={panes ? {
              flex: '1 1 auto',
              minHeight: 0,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
            } : {
              /* THE PAGE'S OWN GUTTERS (FEED-IA §33). A phone stood on a 12px margin, which is the
                 smallest that works rather than the one people expect: the money apps this bar is
                 set against give a thumb 16, and the extra four pixels are what stop a river of
                 names from reading as if it were pressed against the glass. The desk's own gutter
                 grows with it, and the foot is `runway` — the launcher's lane, never less, worked
                 out above (§83.3 · AUDIT-2 C16). */
              /* THE PHONE'S FOOT IS THE SPACER BELOW AND NOTHING ELSE (§83.3 · §137's round).
                 It was `ownsItsFoot ? 0 : runway` — a padding that a surface with its own
                 scrollport paid twice (C38) and that a surface without one lost entirely, which
                 is how the river's last row ended up inside the circle. ONE reserve now, stated
                 once, as content at the end of the scroll. */
              padding: phone
                ? `${theme.sizing.scale600} ${theme.sizing.scale600} 0`
                : `${theme.sizing.scale900} ${theme.sizing.scale900} ${runway}px`,
              minWidth: 0,
              width: '100%',
              maxWidth: phone ? '100%' : wide || detailOpen ? COLUMN_WIDE : COLUMN,
              marginLeft: 'auto',
              marginRight: 'auto',
              boxSizing: 'border-box',
            }}
          >
            {children}

            {/* ── THE SCROLL'S OWN TAIL ON A PHONE (FEED-IA §83.3 · §137's round) ────────────
                THE FINDING, MEASURED AT 390: the river's LAST ROW ended thirty pixels inside the
                launcher's 80px circle. The audit fix gave three BOTTOM BARS a padding-RIGHT
                reserve, which is the right answer for anything standing at a pane's foot — and on
                a phone the launcher does not sit beside a bar, it sits over the TAIL OF THE
                SCROLL, where no surface had reserved anything at all. C38 had made it worse by
                design: it dropped the frame's phone runway for every surface that declares panes,
                which is Sales, Customers, Stock and the two admin seats — exactly the surfaces
                made of long lists.

                SO THE RESERVE IS A SPACER AND NOT PADDING, and that is the whole of why C38's
                finding and this one can both be answered at once. Padding on this column is part
                of the box every child resolves its own height against, so a surface that mounts
                its own full-height scrollport pays it twice (C38's «572 of 844»). A spacer is
                CONTENT: it adds eighty pixels to the END of the scroll, where the circle is, and
                takes nothing from anything above it.

                ONE PLACE, EVERY CALLER INHERITS. It is the frame's, so any river, book, catalogue
                or seat laid out in the column posture gets it without knowing the launcher exists
                — which is the ownership §83.3 assigned when the launcher stopped stepping around
                the panes and took the viewport's corner for good. The desk keeps the padding it
                already had; there the launcher rides above nothing that scrolls. */}
            {phone && !ownsItsFoot && (
              <div
                data-testid="launcher-runway"
                aria-hidden="true"
                style={{ height: `${LAUNCHER_LANE}px`, flex: '0 0 auto' }}
              />
            )}
          </div>
        </main>

        {/* THE CHATS FLOAT OVER THE APP, ON BOTH HOUSINGS (§15, §22.1, §42). A launcher in the
            corner and a panel that pops over the work and leaves without a trace. It reserves
            nothing in the grid above, which is the whole point of the change — and it is mounted
            unconditionally now that no area IS the chats, so the conversation is one press away
            from every surface at every width. The widget owns its own postures. */}
        <ChatsOverlay
          cast={cast}
          threads={threads}
          currentId={focus.id}
          onOpen={focus.show}
        />

        {/* ── THE ONE SEARCH (FEED-IA §91.2) ──────────────────────────────────────────────────
            «All search should be like this.» So it is mounted ONCE, here, beside the other thing
            that is true on every surface: a box that opens over the work from any of them, in
            either world, and the keyboard that summons it. The frame has already folded the
            conversations for the widget, so the search reads that fold rather than repeating it. */}
        <SearchModal threads={threads} onThread={focus.show} />
        <AssistantHost cast={cast} />
        <BrowserPrintHost />

        {phone && <BottomNav areas={tabs ?? areas} current={current} inWorld={world === 'admin'} />}
      </div>
     </PanesContext.Provider>
    </ColumnContext.Provider>
  );
}

export default function Frame(props: FrameProps) {
  return (
    <OpenItemsProvider>
      <Assembled {...props} />
    </OpenItemsProvider>
  );
}
