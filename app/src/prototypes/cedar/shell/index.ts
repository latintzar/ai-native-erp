/* THE SHELL'S PUBLIC FACE — what an area package imports.
 *
 * V2-SALES and V2-STOCK import from here and from `../config`; nothing else in V2-CORE is theirs
 * to reach into. Adding an area is: a file in `src/prototypes/cedar/areas/`, a `meta`, a default export, and
 * `Page` around the surface. The FILE NAME is the route.
 *
 * TWO THINGS WORTH KNOWING BEYOND THAT:
 *
 * 1 · THE COLUMN. The frame centres an area in a readable column (840px). A surface that opens a
 *     detail BESIDE its list calls `useWideColumn(open)` while the detail is open and the clamp
 *     widens to hold both; it narrows again on close and on leaving the area. An open albarán
 *     widens it on its own.
 *
 * 1b · THE PANES (FEED-IA §38). A master-detail surface calls `usePanes(true)` and the frame stops
 *     scrolling the page: it hands the surface the whole box under the chrome, unpadded and
 *     unclamped, and the surface draws two full-height panes in it, each one scrollport. It is the
 *     desk's law — the phone keeps its push model and the ask is ignored there.
 *
 * 2 · THE OPEN ALBARANES. `useOpenItems()` is the open set and the flip between them
 *     (THE-APP-V2 §5.3). Sales opens a document with `open({ id })`, reads `currentId` for the one
 *     to draw, and closing is `close(id)` — the strip of chips across the top of the detail is the
 *     frame's, so no area draws it. `useThreads` / `useThreadFocus` are the same deal for the
 *     conversation: `focus.show(customerId)` pops the chats widget open on that thread on the desk
 *     and fills the phone's screen with it, which is what «open the chat» from inside an albarán
 *     does.
 *
 * 3 · THE PRINTER. `PrintQueueControl` is the day bar's own; an area never mounts it. What an area
 *     reaches for is `enqueue()` from `../print-queue`, with a job built by `albaranOrder(sale, now,
 *     config.emailFeed)` or `daySheetOrder(day, sheetSales, now)` — the header's count and the
 *     ledger's «printed» facet both follow from that one call.
 */
export { default as Frame, useWideColumn, usePanes, AREA_TITLE_BAR } from './frame';
/* THE RAIL, AND ITS TWO STATES (FEED-IA §77.3). `useRailOpen` is the fact, `railWidth` turns it
   into the number the frame's grid track uses, and `setRailOpen` is the one write. */
export {
  default as Rail,
  RAIL_WIDTH,
  RAIL_COLLAPSED,
  RAIL_EXPANDED,
  railWidth,
  useRailOpen,
  setRailOpen,
} from './rail';
/* THE ONE SEARCH (FEED-IA §91.2). A surface carries `SearchSummon` where its magnifier used to
   stand and declares `useSearchSeat` beside it; the box itself is the frame's and no area mounts
   one. `openSearch` is the door for anything that is not a magnifier. */
export {
  default as SearchModal,
  SearchSummon,
  useSearchSeat,
  openSearch,
  closeSearch,
} from './search-modal';
export type { SearchIntent, SearchSeatDecl } from './search-modal';
export { default as BottomNav, BOTTOM_NAV_HEIGHT } from './bottom-nav';
export { default as AreaGlyph, hasGlyph } from './glyphs';
export { default as DayBar } from './day-bar';
export { default as Page } from './page';
export {
  default as OpenItemsStrip,
  OpenItemsProvider,
  useOpenItems,
  openItem,
  flipTo,
  closeItem,
  closeAllItems,
  openItemsSnapshot,
} from './open-items';
export type { OpenItem, OpenItemsState } from './open-items';
export { ThreadList, ThreadView, ChatsOverlay } from './chats';
export { default as PrintQueueControl, PrintSetupCard } from './printing';
export { useThreads, useThreadFocus, focusThread, openChat, openEmail, markThreadRead, sendToThread, threadOf, unreadCount, setChatIsScreen, useChatIsScreen } from './threads';
export type { Thread, ThreadFocus, ThreadOpening } from './threads';
/* THE RESPONSIVE CONTINUUM (FEED-IA §103). `usePosture` is the rung the browser is standing on and
   the frame states it as `data-width`; `usePhone` / `useStacked` / `usePushed` are the three
   questions a surface actually asks. The numbers and the arithmetic behind them live in
   `viewport.ts` and nowhere else. */
export {
  COLUMN, PHONE, STACKED, WIDE, PHONE_MAX, STACK_MAX, WIDE_MIN, LIST_FLOOR,
  usePhone, usePosture, useStacked, usePushed, useHardwareKeys,
  /* INTX-12's 44px touch floor, applied where the hand is (E193.14) */
  TOUCH_FLOOR, TOUCH_FLOOR_TALL, usePhoneFloor, usePhoneFloorHeight,
  /* §196.2's third track: the agent column's measures, its posture and the room it leaves */
  COPILOT_COLUMN, COPILOT_RAIL, COPILOT_RAIL_BESIDE, COPILOT_PHONE_MAX, COPILOT_SHEET_MIN,
  COPILOT_DESK_MIN,
  /* §200.3's yield: the two rungs the agent may dock at while a document shows money (E199) */
  SHEET_SNUG, SHEET_WIDE, PRICED_WORK_FLOOR, COPILOT_PRICED_DESK_MIN, COPILOT_PRICED_RAIL_BESIDE,
  usePricedDocumentDeclared, usePricedDocument,
  DESK_FLOOR, DAY_BAR_FLOOR, DAY_BAR_NAMED, DAY_BAR_WORDED, AREA_NAME_WIDEST,
  copilotPostureAt, copilotTrackOf, copilotWidthOf, stateCopilotOpen,
  useRoom, useWindowWidth, useCopilotTrack,
} from './viewport';
export type { Posture, CopilotPosture } from './viewport';
export { RAIL_ORDER, HOME, AREA_TITLE, isAreaId } from './area';
export type { AreaId, AreaMeta, AreaModule } from './area';
