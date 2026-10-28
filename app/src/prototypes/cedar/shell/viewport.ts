/* THE VIEWPORT — the responsive continuum, read from one place (FEED-IA §103).
 *
 * ═══ THE LAW, VERBATIM ══════════════════════════════════════════════════════════════════════
 * «The whole wide square phone is dumb. They should just resize with my browser.» (Peter,
 * 2026-08-29, live review.) So: THE LAYOUT IS A CONTINUUM, NOT A BINARY. The desk persists
 * downward with graceful compression — the panes narrow honestly, then stack — and the PHONE
 * SHAPE exists only at true phone widths. No intermediate browser width may render a stretched
 * phone, and resizing the browser reflows at every width.
 *
 * ═══ WHAT THIS REPLACES ═════════════════════════════════════════════════════════════════════
 * ONE BREAKPOINT at 720px stood here, with a paragraph arguing that one number was enough because
 * «the feed is a single column of cards on every width». It was enough for the FEED and wrong for
 * the APP: everything between 560 and 720 got the phone's housing — bottom row, one column, push
 * model — stretched across a window nearly twice a handset's width. That is the wide square phone,
 * and it is what dies here. The `minWidth: 880` doctrine that died before it is still dead: nothing
 * scrolls sideways at any width, at any rung of this ladder.
 *
 * ═══ THE LADDER — FOUR POSTURES, AND WHERE EACH NUMBER COMES FROM ═══════════════════════════
 *
 *   desk        ≥ 1440   two panes, both at full anatomy: the sheet takes its wide 720 and the
 *                        river still has a card it can read. This is `sales.tsx`'s own `ROOMY`,
 *                        moved here so the ladder is in one file.
 *   compressed  1096..1439   two panes, narrowed HONESTLY: the sheet steps back to its snug 640
 *                        (a document's measure is a property of the document, §38) and the river's
 *                        header takes its snug form. Nothing is stretched; things get closer.
 *   stacked     560..1095    the desk STILL — its rail, its day bar, its open-items strip, its
 *                        full-height box that never scrolls — but ONE PANE AT A TIME. The sheet
 *                        takes the box and the list is one press behind it, the push model the
 *                        phone already uses, in the desk's own chrome.
 *   phone       ≤ 559    the phone housing: bottom row, one column, phone furniture.
 *
 * ─── WHY 1096, EXACTLY ──────────────────────────────────────────────────────────────────────
 * It is the sum of what two panes cannot go under, and every term is measured rather than chosen:
 *
 *     64    the rail, collapsed (`RAIL_COLLAPSED`) — the desk's resting state
 *   + 392   the river pane's floor: 327px of snug header, MEASURED on the served bundle
 *           (`sales.tsx`, C30 — the scope door, the date field, the search seat, the «+», the
 *           gaps), plus the pane's own two 32px gutters, on the theme's own 8-grid
 *   + 640   the sheet's snug measure — «a line's fields on ONE row before any of them wrap»
 *   ────
 *     1096  and the hairline seam is absorbed by that rounding
 *
 * Below it, one of the two panes would have to lie about what it can hold, so they stack instead.
 * THE SHEET IS WHAT YIELDS above it (customers.tsx's own lesson: «a name you cannot read is a book
 * you cannot use»), which is what «narrow honestly» means between 1096 and 1440.
 *
 * ─── WHY 560, EXACTLY ───────────────────────────────────────────────────────────────────────
 * Two floors and one ceiling, and 560 clears all three:
 *
 *   · THE DESK'S OWN FLOOR is 472 — the rail's 64 plus the WIDEST of its two fixed lines: the
 *     river pane's 392 plus the 8px overlay scrollbar, and the day bar's own 408. The desk stands
 *     honestly down to there, so a threshold at 560 means no width ever paints a desk at its
 *     breaking point: there are 88px of slack under the last desk rendered.
 *     ⚠ IT READ 464 HERE — the river's line alone — until E195.30 gave the number a reader
 *     (`DESK_FLOOR`, below) and found the bar was the wider of the two. The four pixels are the
 *     difference between a desk that states its day and one that ellipsises it.
 *   · THE LARGEST PHONE IN PORTRAIT is 440 CSS px. 560 is above every handset, so a phone always
 *     gets the phone.
 *   · THE SMALLEST TABLET IN PORTRAIT is 744. 560 is far below it, so a tablet gets the DESK —
 *     which is the whole of §103: the shape follows the room, never the device.
 *
 * ═══ AND THE POSTURE IS DECLARED, NEVER CLAIMED AFTER A PAINT (§38 · §45.3) ═════════════════
 * The mode-flip flicker §45.3 caught was a posture claimed from an EFFECT — one painted frame in
 * the wrong layout on every move. So every rung here is read SYNCHRONOUSLY at first render from
 * `matchMedia`, and the subscription only carries LATER changes. A resize therefore reflows on the
 * frame it happens on, and a first paint is never in the wrong posture. There is no reload-only
 * breakpoint anywhere in this file, and no surface computes a posture of its own: they ask here.
 */
import * as React from 'react';

/* ── THE LADDER'S OWN NUMBERS (see the header for where each one comes from) ───────────────── */

/** at and below this width the app is the phone: one column, bottom row, push model */
export const PHONE_MAX = 559;

/** at and below this width the desk's two panes stand ONE AT A TIME */
export const STACK_MAX = 1095;

/** at and above this width both panes hold their full anatomy (the sheet takes its wide measure) */
export const WIDE_MIN = 1440;

/** the river pane's floor — 327px of snug header plus its own two gutters, on the 8-grid. Exported
 *  because the pane that must never go under it is the one that has to state it. */
export const LIST_FLOOR = 392;

/** the overlay scrollbar the river's own pane carries — counted wherever the river's floor is */
const LIST_SCROLLBAR = 8;

/** THE DOCUMENT'S OWN TWO MEASURES (§38: a document's measure is a property of the document).
 *  `areas/sales.tsx` drew them and named them; they live HERE because every floor built on them
 *  — §103's own 1096, and E199's priced floor below — is arithmetic about the ladder, and the
 *  ladder is stated in one file. The pane reads them back from here so a rung and the thing
 *  standing on it can never hold two numbers for one measure. */
export const SHEET_SNUG = 640;
export const SHEET_WIDE = 720;

/** THE RAIL'S TWO WIDTHS, for the same reason. `shell/rail.tsx` re-exports them under its own
 *  names (`RAIL_COLLAPSED` · `RAIL_EXPANDED` · `RAIL_WIDTH`), so every existing reader is
 *  unchanged and `DESK_FLOOR` below stops carrying a literal 64 with a comment naming the file
 *  it came from. EXPANDED is the desk's RESTING state (`railOpen` boots true), which is what
 *  makes it the term every floor about a desk has to be built on. */
export const RAIL_COLLAPSED = 64;
export const RAIL_EXPANDED = 208;

/* ── THE DAY BAR'S OWN LINE (E195.30) ────────────────────────────────────────────────────────
 * The bar spans the work track above every area, so it is a floor on the desk exactly as the
 * river pane is. Its parts are MEASURED on the built bundle (`shell/day-bar.tsx` states each one
 * and where it comes from) and each one is a named number here, so the ladder and the bar read
 * the same arithmetic: 2 × 24 of padding + 109 for the day at its longest + 12 + 238 for a way
 * out with its mark alone = 407, taken to 408 on the theme's own 8-grid.
 *
 * The two rungs above it are the same line with more on it: + the area's name (12 + 124), and
 * then a way out that says «Assistant» in full rather than standing on its mark (308 against
 * 238). `day-bar.tsx` reads them and states what the line can hold.
 *
 * ⚠ AND THE NAME IN THAT SUM IS THE WIDEST ONE, NOT THE SHORTEST (the E195.30 repair). Both rungs
 * were derived from «Sales» (48), which is the narrowest name the app has — so between 468 and
 * 544 the bar put «Your business» (124) on a line with room for a third of it, and the item that
 * yielded was THE DAY: measured on `#/admin` at 560, 600 and 640, the day came out 62, 102 and
 * 72px wide against its own 109, ellipsised on all three. Two things are wrong with a rung read
 * off the shortest name. It is not a floor at all — a floor has to hold the worst case, and the
 * worst case is the widest name the register can put there. And it makes the bar behave
 * DIFFERENTLY IN DIFFERENT AREAS at one width, which is the seam §195 asks this kit to close.
 *
 * So the rung is derived from `AREA_NAME_WIDEST`, and the whole closed register is measured:
 * Plan 38 · Sales 48 · Team 48 · Units 45 · Account 72 · Products 78 · Your data 82 · Your agent
 * 94 · Customers 95 · Geography 95 · Operations 96 · App settings 110 · Connections 110 · YOUR
 * BUSINESS 124 (`route-meta.ts` is the register; the widths are LabelLarge on the built bundle).
 * Every name the bar states is now stated WHOLE, and it sheds at the same width in every area. */
/** the bar's own side padding on a desk (`scale800`, twice) and the gap between its parts
 *  (`scale500`) — the theme's numbers, named here so the rungs are a sum and not a claim */
export const DAY_BAR_PAD = 24;
export const DAY_BAR_GAP = 12;
/** the workspace mark at its widest — the 28 px mark, a scale200 gap and «Rocoto» at LabelLarge,
 *  painted 95 px (measured 13 September 2026 at 390: 12→107; on every desk width 88→183, and
 *  232→327 with the rail open) — plus 14 px of slack. The day left this bar («Dates belong to
 *  Sales and Prep», day-bar.tsx), so the mark is the one string on the line the app cannot
 *  shorten, and the term every floor here is built on. The value is unchanged from the day the
 *  rungs were derived, so every rung below still holds. */
export const BRAND_MEASURE = 109;
/** THE WAY OUT, A FIXTURE MEASUREMENT — the same kind of number as `BRAND_MEASURE` above, and it
 *  is written down the same way so a reader can take it again.
 *
 *  WHAT: the bounding box of `[data-testid="day-bar-actions"]` — the launcher's mark, Export with
 *  its word, the support mark, and the two `DAY_BAR_GAP`s between the three. WHERE: the built
 *  English app (`baseweb/dist-export-review/app.html`) on `#/admin`, at a desk width where the line
 *  holds everything, in the shipped theme at LabelLarge. It is a MEASUREMENT rather than a sum,
 *  because the parts are Base buttons whose padding is the theme's and not this file's.
 *
 *  TWO STATES, because the line sheds the launcher's word before it sheds anything else: 238 with
 *  the launcher as a mark alone, 308 with «Assistant» said in full — a 70px word, which is exactly
 *  what `DAY_BAR_WORDED − DAY_BAR_NAMED` (616 − 544) pays for.
 *
 *  A number this file cannot check is a claim, so the rungs it derives are the ones a drive walks:
 *  `drive-204-copilot-midwidth.py`'s day-bar walk drives 408, 544 and 616 in three areas at the six
 *  widths those two rungs turn on, and reads the bar's own parts at each one. If a theme change
 *  moves the box, that walk goes red before the rung does. */
export const DAY_BAR_WAY_OUT = 238;
export const DAY_BAR_WAY_OUT_WORDED = 308;
/** «Your business» — the widest name `route-meta.ts` can put on this line */
export const AREA_NAME_WIDEST = 124;

/** every rung of this bar is the same sum taken up to the theme's own 8-grid, which is what §103
 *  does with the river pane's measurement too — the rounding is an operation here rather than a
 *  sentence in a comment, so nobody has to trust it */
const grid8 = (px: number): number => Math.ceil(px / 8) * 8;
/** the line with nothing on it but the day and the way out — 407 measured, 408 on the grid */
export const DAY_BAR_FLOOR = grid8(2 * DAY_BAR_PAD + BRAND_MEASURE + DAY_BAR_GAP + DAY_BAR_WAY_OUT);
/** the same line with room for the WIDEST name — 543 measured, 544 on the grid */
export const DAY_BAR_NAMED = grid8(
  2 * DAY_BAR_PAD + BRAND_MEASURE + DAY_BAR_GAP + AREA_NAME_WIDEST + DAY_BAR_GAP + DAY_BAR_WAY_OUT,
);
/** and with the launcher's word as well — 613 measured, 616 on the grid */
export const DAY_BAR_WORDED = grid8(
  2 * DAY_BAR_PAD + BRAND_MEASURE + DAY_BAR_GAP + AREA_NAME_WIDEST + DAY_BAR_GAP + DAY_BAR_WAY_OUT_WORDED,
);

/** THE DESK'S OWN FLOOR — the width under which the desk stops being a desk. The header's «WHY
 *  560» block had the arithmetic and no reader; E195.30 made it a number the ladder computes with
 *  — and corrected it while doing so (it read 464 up there): the floor is the WIDEST of the
 *  desk's fixed lines, not the river's alone. 64 (`RAIL_COLLAPSED`, `shell/rail.tsx` — the rail's
 *  resting state) + the greater of 392 + 8 (the river pane and the overlay scrollbar) and 408
 *  (the day bar's own line) = 472. The bar is the wider of the two by four pixels, and those four
 *  pixels are the difference between a desk that states its day and one that ellipsises it. */
export const DESK_FLOOR = RAIL_COLLAPSED + Math.max(LIST_FLOOR + LIST_SCROLLBAR, DAY_BAR_FLOOR);

/** At and below this width the app is one column with a bottom navigation. */
export const PHONE = `(max-width: ${PHONE_MAX}px)`;

/** At and below this width the desk stacks its panes. */
export const STACKED = `(max-width: ${STACK_MAX}px)`;

/** At and above this width both panes keep their full anatomy. */
export const WIDE = `(min-width: ${WIDE_MIN}px)`;

/** The readable column the frame centres an area in. The feed is one column everywhere now, so
 *  the desk's job is to stop that column growing into a line of text nobody can track. */
export const COLUMN = 840;

/** THE FOUR RUNGS, NAMED. `data-width` on the frame's root states which one is drawn, so a drive
 *  holds the app to the law rather than inferring a layout from a computed width. */
export type Posture = 'desk' | 'compressed' | 'stacked' | 'phone';

function useMedia(query: string): boolean {
  const [on, setOn] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const read = () => setOn(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, [query]);
  return on;
}

/* ── THE THIRD TRACK, AND THEREFORE THE ROOM (FEED-IA §196.2, Peter 2026-09-04) ──────────────
 * «i told u to port from the fucking app.soyrocoto.com which has the exact UX i wanted for the
 * actual chat and composer in full even down to the grid.»
 *
 * The live app's copilot IS a grid track — `.desk.has-copilot { grid-template-columns: 216px
 * minmax(0,1fr) 336px }` (`webapp/src/shell/topbar.css`). The work reflows BESIDE it; it never
 * covers the head or the right pane. So the kit's frame reserves a third track too, and the
 * moment it does, THE LADDER ABOVE IS ASKING THE WRONG QUESTION.
 *
 * ═══ THE ROOM IS WHAT DECIDES, NOT THE WINDOW ════════════════════════════════════════════════
 * Every number in this file is an arithmetic about TWO PANES AND A RAIL — «the sum of what two
 * panes cannot go under». A 1366px window with a 416px agent column standing in it has 886px of
 * work in it, which is the stacked rung's room and not the compressed rung's. Read off the window
 * the app would keep drawing two panes and take the difference out of the document: measured, the
 * sheet came out at 494 against its own snug 640, which is the dishonest narrowing §103 bans.
 *
 * So the rungs read THE ROOM — the width minus whatever the app has docked beside the work — and
 * `§103`'s own sentence is what licenses it: «the shape follows the room, never the device».
 *
 *   · THE HOUSING STAYS THE WINDOW'S. `usePhone` and `useHardwareKeys` keep their media queries:
 *     a bottom row and a keycap are facts about the DEVICE, and an agent column may never conjure
 *     the phone's furniture onto a desk.
 *   · THE RESERVE IS READ OFF THE WINDOW TOO (`copilotTrack`), never off the room — a reserve
 *     that shrank the room that decided the reserve would oscillate forever.
 *   · `clientWidth`, NEVER `innerWidth`: it is the width a media query resolves against (a classic
 *     scrollbar sits outside it), so with nothing reserved this reads exactly what `matchMedia`
 *     reads and the ladder cannot disagree with itself.
 */

/** the agent column's own measures — the kit's conversation measure (§40.1) and its sessions rail.
 *  They live HERE, with the rest of the ladder's arithmetic, because the frame's grid and the
 *  column itself must never hold two different numbers for one track. */
export const COPILOT_COLUMN = 416;
export const COPILOT_RAIL = 216;
/**
 * AT AND ABOVE THIS WIDTH THE SESSIONS RAIL STANDS BESIDE THE CONVERSATION instead of over it —
 * and the number is DERIVED, because the moment the column became a reserved track its width
 * started coming out of the work:
 *
 *     216   the sessions rail
 *   + 416   the conversation
 *   + 1096  what the work needs to keep two honest panes (`STACK_MAX + 1`, above)
 *   ────
 *     1728
 *
 * ⚠ IT WAS 1440 while the column was an overlay (E193.02), where it cost the work nothing. As a
 * track, 632px of a 1600px desk is forty per cent of the screen, and the desk lost BOTH its panes
 * to a list of past sessions — which is the agent taking the work's room to hold its own history.
 * So the rail opens beside the conversation only where the river and the document still stand
 * beside each other too; under that it opens over the thread, which is the posture it already had.
 */
export const COPILOT_RAIL_BESIDE = COPILOT_RAIL + COPILOT_COLUMN + STACK_MAX + 1;
/**
 * UNDER THIS WIDTH THE AGENT IS THE SCREEN, and the number is derived from what the strip beside
 * a sheet has to be able to say (the E195.30 repair):
 *
 *      64   the rail at rest (`RAIL_COLLAPSED` — the rung under a sheet is always the stacked
 *             one, so the rail is always collapsed there)
 *   +  24   the day bar's own left padding (`DAY_BAR_PAD`)
 *   + 109   the day (`BRAND_MEASURE`) — the one fact the bar exists for (§37.1)
 *   + 416   the conversation (`COPILOT_COLUMN`)
 *   ────
 *     613
 *
 * A SHEET IS A LAYER OVER THE WORK, so the bar underneath keeps the line it had and the sheet
 * covers its right-hand end — the area's name, the launcher's word. That is the modal contract
 * every layer in this kit keeps, and reflowing the bar into the strip instead is not available at
 * ANY sheet width: the strip is the window less the conversation, which by this rung's own
 * definition is under `DESK_FLOOR` (471px at the widest sheet, against a bar that needs 408 plus
 * the rail's 64). What the strip must still hold is the DAY — so the rung stops where the day
 * would go behind the agent, and under it the agent takes the screen, which is the phone's own
 * posture and states no half of anything.
 *
 * ⚠ IT READ 600, chosen rather than derived, and 601–612 drew a sheet whose left edge landed at
 * 185–196 — through the day's own 197. Twelve pixels of «Friday 22.08» stood behind the agent.
 */
export const COPILOT_SHEET_MIN = 64 + DAY_BAR_PAD + BRAND_MEASURE + COPILOT_COLUMN;
/** at and below this width the agent column draws the visual viewport's height (the phone's own) */
export const COPILOT_PHONE_MAX = COPILOT_SHEET_MIN - 1;
/**
 * AT AND ABOVE THIS WIDTH THE AGENT STANDS BESIDE THE WORK (E195.30), and the number is DERIVED
 * the same way every other rung of this ladder is — the sum of what the two things on the screen
 * cannot go under:
 *
 *     472   the desk's own floor (`DESK_FLOOR`: the rail, and the widest of the river pane and
 *             the day bar's own line)
 *   + 416   the conversation's measure (`COPILOT_COLUMN`)
 *   ────
 *     888
 *
 * ⚠ WHAT IT REPLACES. E193.16 gave everything between 601 and 1095 to a TAKEOVER, and its reason
 * was «the desk is already standing its own two panes one at a time here, so there is no room to
 * put a third thing beside them». That reasoned about the wrong pair. The desk's two panes stack
 * BECAUSE they cannot both stand; the question the agent asks is whether ONE honest pane and the
 * conversation can, and above 888 they can — 900 leaves 484, a laptop's half screen leaves more.
 * The cost of getting it wrong was measured: at 1095 the agent was a 1095px-wide surface and at
 * 1096 a 416px column, so one pixel of browser width swapped the product for a different one,
 * which is the opposite of what §195 asks of every surface in this kit.
 */
export const COPILOT_DESK_MIN = DESK_FLOOR + COPILOT_COLUMN;

/* ══ AND WHEN THE WORK IS A DOCUMENT WITH PRICES, THE AGENT YIELDS (FEED-IA §200.3 · E199) ═════
 *
 * Peter, 2026-09-04: «the copilot: it's not meant to be a sidebar unless it's okay to load as a
 * sidebar. Maybe that's fine for it to be compact when you don't have prices, but when you do
 * have prices, I'm not sure … I don't know if you have tested what the albarán delivery note
 * would actually look like when the copilot is open and actually has data.»
 *
 * IT WAS NOT TESTED, AND IT WAS WRONG. Measured on the E198 bundle, with the long-value albarán
 * open (six-digit quantities, «unidades», a 40-character name) and the agent docked:
 *
 *      window   room   the document's pane   the row
 *      1512     1096   511  ← under its 640   stacked
 *      1536     1120   535  ← under its 640   stacked
 *      1600     1184   599  ← under its 640   stacked
 *      1728     1096   511  ← under its 640   stacked   ⚠ NARROWER THAN AT 1600
 *      1920     1288   648                    stacked
 *
 * Three separate failures in one table. The document goes UNDER ITS OWN SNUG MEASURE at every
 * width from 1512 to 1879 — the dishonest narrowing §103 exists to ban, on the one surface whose
 * measure §192–§195 spent four releases pinning. It is NOT MONOTONIC: 1728 hands the document
 * less room than 1600 does, because `desk-wide` reserves 632 there — the same «one pixel of
 * browser width swapped the product» defect E195.30 killed at 1095. And the sessions rail buys
 * that 216px with the document's width while standing empty.
 *
 * ─── THE FLOOR, DERIVED ─────────────────────────────────────────────────────────────────────
 * §103's own 1096 is the sum of what two panes cannot go under WITH THE RAIL COLLAPSED. A desk
 * rests with the rail OPEN, so the honest floor for a priced document is that same sum with the
 * rail as it actually stands:
 *
 *     208   the rail at rest on a desk (`RAIL_EXPANDED`)
 *   + 392   the river pane's floor (`LIST_FLOOR`)
 *   +   8   its overlay scrollbar, counted here exactly as `DESK_FLOOR` counts it
 *   + 640   the document's snug measure (`SHEET_SNUG`) — the width at which a line's fields stand
 *             on one row before any of them wrap
 *   ────
 *    1248   of ROOM, and therefore 1664 of window with the conversation beside it
 *
 * ─── AND IT IS ONE THRESHOLD, NOT A HOLE ────────────────────────────────────────────────────
 * A rule that docked below 1512 (where the room falls to `stacked` and the document takes the
 * whole box) and again above 1664 would leave a 152px band of sheet between two bands of column,
 * so a person dragging a window edge would watch the product change twice. §195 asks the
 * opposite. So the threshold is single and monotone: with prices open the agent stands IN FRONT
 * of the work until the work can hold both its panes honestly beside it.
 *
 * WHAT THAT BUYS, and it is the half of §200.3 the numbers above cannot state: below 1664 the
 * work keeps the line it had — the river with its rows, its flags and its acts, and the document
 * at its own measure — because a sheet reserves no track. The docked column at 1366 was costing
 * the person the river outright (the room fell to 950, and the desk shows one pane there), which
 * is «especially in the list of orders and stuff».
 */
/** the room a document WITH PRICES needs beside the river, with the rail as a desk rests it */
export const PRICED_WORK_FLOOR = RAIL_EXPANDED + LIST_FLOOR + LIST_SCROLLBAR + SHEET_SNUG;
/** 1664 — at and above this width the agent may stand BESIDE a document that shows money */
export const COPILOT_PRICED_DESK_MIN = PRICED_WORK_FLOOR + COPILOT_COLUMN;
/**
 * 2072 — AND ONLY HERE MAY IT ALSO OPEN ITS SESSIONS RAIL BESIDE ONE, and this rung is derived
 * from the work's TOP measure rather than from its floor:
 *
 *    1440   what the desk needs to keep BOTH panes at their full anatomy (`WIDE_MIN`) — with a
 *             priced document that is the sheet's wide 720, the measure §38 gives a document a
 *             desk actually has room for
 *  +  216   the sessions rail
 *  +  416   the conversation
 *  ────
 *    2072
 *
 * WHY THE TOP RUNG AND NOT THE FLOOR. The rail is a LIST OF PAST SESSIONS — the least load-bearing
 * thing on the screen, and E195.30 already refused to buy it with the work's panes («632px of a
 * 1600px desk is forty per cent of the screen and the desk lost BOTH its panes to a list of past
 * sessions»). A luxury is paid for out of SLACK, never out of the work's own anatomy. Read off the
 * floor instead (1880) the rail stood at 1920 and took the document from its wide 720 to its snug
 * 640 — measured, 687px of card against 607 — so a 1920 screen showed a NARROWER document than a
 * 1664 one. The floor is the right term for whether the agent may dock at all; the top rung is the
 * right term for whether it may also bring its history.
 */
export const COPILOT_PRICED_RAIL_BESIDE = WIDE_MIN + COPILOT_RAIL + COPILOT_COLUMN;

/** THE AGENT'S FOUR POSTURES. `sheet` is the rung between the screen and a desk with room for
 *  both (613–887): there the agent keeps its own measure and stands IN FRONT of the work with a
 *  scrim, rather than taking the whole window — one object, two places. */
export type CopilotPosture = 'phone' | 'sheet' | 'desk' | 'desk-wide';

/** Which posture the agent column draws at a given WINDOW width. Pure, so the frame, the column
 *  and a drive can each ask it and get the same answer.
 *
 *  `priced` is the WORK's own fact, never the room's: a document that shows money is standing in
 *  the work, so the two rungs the agent may dock at are the priced ones (§200.3 · E199). It can
 *  be read at any width without oscillating, because nothing about it depends on the width. */
export function copilotPostureAt(width: number, priced = false): CopilotPosture {
  if (width < COPILOT_SHEET_MIN) return 'phone';
  if (width < (priced ? COPILOT_PRICED_DESK_MIN : COPILOT_DESK_MIN)) return 'sheet';
  return width >= (priced ? COPILOT_PRICED_RAIL_BESIDE : COPILOT_RAIL_BESIDE) ? 'desk-wide' : 'desk';
}

/** How many pixels of grid track that posture asks the frame to reserve. A sheet reserves
 *  nothing — it is standing IN FRONT of the work, not beside it. */
export function copilotTrackOf(posture: CopilotPosture): number {
  if (posture === 'desk-wide') return COPILOT_RAIL + COPILOT_COLUMN;
  return posture === 'desk' ? COPILOT_COLUMN : 0;
}

/**
 * HOW WIDE THE AGENT'S OWN BOX IS — the measure a person actually sees, at every posture, from
 * ONE function so a sheet and a column can never come out different sizes.
 *
 * This is the whole of E195.30 in three lines: above the phone the agent is 416px WHEREVER it
 * stands, and the only thing the width of the window decides is whether the work reflows beside
 * it or is scrimmed behind it. The phone is the one place the agent is the screen, because a
 * 416px panel on a 390px handset is not a panel.
 */
export function copilotWidthOf(posture: CopilotPosture, window: number): number {
  if (posture === 'phone') return window;
  return posture === 'desk-wide' ? COPILOT_RAIL + COPILOT_COLUMN : COPILOT_COLUMN;
}

let copilotOpen = false;
let pricedDocuments = 0;
const roomWatchers = new Set<() => void>();
const notifyRoom = () => { roomWatchers.forEach((watch) => watch()); };

/**
 * A DOCUMENT THAT SHOWS MONEY SAYS SO (§200.3 · E199), and the agent's rung reads it.
 *
 * It is stated by the document rather than inferred from the address bar or counted off the DOM,
 * for the reason `stateCopilotOpen` is: the surface that knows the fact is the one that declares
 * it, from a LAYOUT effect, so the frame has the right track before the browser paints.
 *
 * ⚠ IT IS THE CAPABILITY, NOT THE CONTENT. `pricing` is what puts the two money columns on the
 * row (`detail.tsx`'s `pricesVisible`), so it is the fact the floor is about. Reading «has at
 * least one priced line» instead would reflow the whole layout the moment somebody typed a price
 * into a line — a document changing shape under the hand that is editing it.
 *
 * ⚠ AND IT COUNTS RATHER THAN FLIPS. Two surfaces declare it — the open albarán and the nascent
 * card — and React runs a leaving effect's cleanup AFTER the arriving one's effect. A boolean
 * would therefore be switched off by the surface that was going away, and the agent would dock
 * over a document that is still standing. A count cannot be turned off by somebody else's exit.
 */
export function usePricedDocumentDeclared(priced: boolean): void {
  React.useLayoutEffect(() => {
    if (!priced) return undefined;
    pricedDocuments += 1;
    if (pricedDocuments === 1) notifyRoom();
    return () => {
      pricedDocuments -= 1;
      if (pricedDocuments === 0) notifyRoom();
    };
  }, [priced]);
}

/** Whether a document with money in it is standing in the work right now. */
export const usePricedDocument = (): boolean =>
  React.useSyncExternalStore(subscribeRoom, () => pricedDocuments > 0, () => false);

/** The agent column says whether it is standing. It is called from a LAYOUT effect, so the frame
 *  has its third track before the browser paints the column into it — the §45.3 lesson, kept: a
 *  posture claimed after a paint is one painted frame in the wrong layout. */
export function stateCopilotOpen(open: boolean): void {
  if (open === copilotOpen) return;
  copilotOpen = open;
  notifyRoom();
}

function subscribeRoom(watch: () => void): () => void {
  roomWatchers.add(watch);
  window.addEventListener('resize', watch);
  return () => { roomWatchers.delete(watch); window.removeEventListener('resize', watch); };
}

const windowSnapshot = (): number => document.documentElement.clientWidth;
const reservedNow = (): number =>
  (copilotOpen ? copilotTrackOf(copilotPostureAt(windowSnapshot(), pricedDocuments > 0)) : 0);
const roomSnapshot = (): number => Math.max(0, windowSnapshot() - reservedNow());
/** a server has no window; the ladder's top rung is the honest default for one */
const offBrowser = (): number => WIDE_MIN;

/** THE WINDOW, raw — what the reserve itself is decided off. */
export const useWindowWidth = (): number =>
  React.useSyncExternalStore(subscribeRoom, windowSnapshot, offBrowser);

/** THE ROOM THE WORK HAS: the window, minus the agent column while it is docked beside it. */
export const useRoom = (): number =>
  React.useSyncExternalStore(subscribeRoom, roomSnapshot, offBrowser);

/** THE TRACK THE FRAME RESERVES right now — 0 whenever the agent is away or standing in front of
 *  the work rather than beside it. The frame's grid reads this and nothing else. */
export const useCopilotTrack = (): number =>
  React.useSyncExternalStore(subscribeRoom, reservedNow, () => 0);

/**
 * WHICH RUNG THE APP IS STANDING ON.
 *
 * One answer, asked in the ladder's own order so the rungs cannot overlap. Every surface that has
 * to know asks THIS — the rail, the bottom row, the day bar, the panes, the chat widget — so they
 * can never disagree about which app is being drawn. The HOUSING question is still the window's
 * (`phone`); the two-pane question is the room's (§196.2's third track, above).
 */
export function usePosture(): Posture {
  const phone = useMedia(PHONE);
  const room = useRoom();
  if (phone) return 'phone';
  if (room <= STACK_MAX) return 'stacked';
  return room >= WIDE_MIN ? 'desk' : 'compressed';
}

/** True on the phone: one column, bottom navigation, chat as a takeover. THE DEVICE'S OWN
 *  question, so it stays a media query — no docked column may put phone furniture on a desk. */
export const usePhone = (): boolean => useMedia(PHONE);

/** True where the desk's two panes stand one at a time. It is the DESK still — rail, day bar, the
 *  box that never scrolls — and only the master-detail geometry changes. */
export const useStacked = (): boolean => {
  const room = useRoom();
  const phone = useMedia(PHONE);
  return !phone && room <= STACK_MAX;
};

/** True wherever a master-detail surface shows ONE pane at a time and «back» is therefore a real
 *  destination — the phone, and the stacked desk. The push model's own question, asked once. */
export const usePushed = (): boolean => {
  const phone = useMedia(PHONE);
  const room = useRoom();
  return phone || room <= STACK_MAX;
};

/**
 * WHETHER THE KEYS ARE REAL (THE-CHECKPOINT-AUDIT finding 5 · §32's own rule for a keycap).
 *
 * «"Which day to print" at 390px still prints the footer row "↑↓ walk · ↵ open · esc close" —
 * keyboard-only affordances with no keyboard present, eating a full row of a small screen for a
 * stranger swiping with a thumb.» A keycap is a PROMISE about a key, and a promise made to a thumb
 * is furniture. §131.3's other half is the same fact from the other side — «desktop always has the
 * keyboard» — so the app says the shortcut exactly where the shortcut exists.
 *
 * TWO QUESTIONS, ONE ANSWER, AND THE WIDTH IS THE ONE THAT DECIDES. A hardware keyboard is what
 * `(hover: hover) and (pointer: fine)` describes, and that is the honest test — but a headless
 * browser at 390 reports a fine pointer, so a check made only of pointer facts would pass a gate
 * on a phone-shaped screen and ship the row anyway. The RUNG is therefore part of the answer: the
 * keys are said on the continuum's DESK frames, where the app is a desk and the keys are bound.
 */
export const useHardwareKeys = (): boolean => {
  const phone = useMedia(PHONE);
  const fine = useMedia('(hover: hover) and (pointer: fine)');
  return !phone && fine;
};

/* ── THE PHONE'S TOUCH FLOOR (INTX-12 · FEED-IA §188.2 · E193.14) ─────────────────────────────
 *
 * INTX-12 closes on the list of things that fail it, and one of them is «**sub-44 px touch
 * actions**». §188.2 states the band the marks stand in: «Established 20 px line-icon family in
 * 44–48 px optical-centred targets.» So 44 is the floor and 48 is where the house already stands
 * (the albarán's phone act-bar, §193.5).
 *
 * IT IS THE HAND'S NUMBER, SO IT IS THE PHONE'S. A pointer lands on a pixel; a thumb lands on a
 * pad about ten millimetres across. A 28px mini button beside a dense desk row is RIGHT for a
 * mouse and wrong for a finger — so the floor is applied where the finger is, and the desk keeps
 * every bit of its density. That is why this reads `usePhone()` rather than being baked into the
 * theme's button sizes.
 *
 * AND IT IS A FLOOR, NOT A SIZE. `minWidth`/`minHeight` grow a control that is under it and leave
 * one that is already over it exactly where it stood: a full-width Save stays full width, a 20px
 * mark becomes a 44px target around the same 20px mark, and no desk geometry moves at all.
 */
export const TOUCH_FLOOR = 44;

/** where the house already stands taller than the floor — the albarán's phone act-bar (§193.5) */
export const TOUCH_FLOOR_TALL = 48;

/* one frozen object, so a desk render never hands its children a new style identity */
const NO_FLOOR: Readonly<Record<string, never>> = Object.freeze({});

/**
 * The floor as a style fragment: `{ minWidth, minHeight }` on a phone, nothing on a desk.
 * Spread it into a Base `overrides.BaseButton.style` or straight onto a `style` prop.
 */
export const usePhoneFloor = (minimum: number = TOUCH_FLOOR): { minWidth?: string; minHeight?: string } => {
  const phone = useMedia(PHONE);
  return phone ? { minWidth: `${minimum}px`, minHeight: `${minimum}px` } : NO_FLOOR;
};

/**
 * The floor for a control whose WIDTH is already decided by its row — a seat in a grid, a
 * full-width act, a chip that must keep its measure. Height only; the width is the layout's.
 */
export const usePhoneFloorHeight = (minimum: number = TOUCH_FLOOR): { minHeight?: string } => {
  const phone = useMedia(PHONE);
  return phone ? { minHeight: `${minimum}px` } : NO_FLOOR;
};
