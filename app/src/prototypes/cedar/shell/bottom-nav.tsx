/* THE BOTTOM NAVIGATION — the phone's rail, and Base's own.
 *
 * THE SEATS ARE THE PLACES: Sales · Stock · Customers · Settings.
 *
 * ═══ CHATS LEFT THE ROW (FEED-IA §42, decided) ═════════════════════════════════════════════
 * «Chats live ONLY in the widget. The Chats tab/area dies, desk and phone.» It held a seat here
 * from §5.1 — «Chats, obviously, that's gonna be a tab» — and the phone's conversation is the
 * floating widget now, full screen when it opens, with its launcher resting above this row. The
 * remaining four re-balance across Base's own grid, which is what a grid is for.
 *
 * AND NO SEAT CARRIES A NUMBER. The badge machinery went with the chats: it existed for one
 * counter, §42 killed that counter — «we shouldn't really have a chat ping» — and a badge system
 * with nothing to count is plumbing waiting to be misused. What needs a person is said once, by
 * the band's «Messages · N» row, on the surface where the person is deciding what to do next.
 *
 * ═══ THE FOURTH SEAT IS THE DOOR INTO THE WORLD (FEED-IA §53) ══════════════════════════════
 * Settings held this seat while the desk moved it into the rail's profile menu (§44): a phone has
 * no foot to put a profile on, because this row IS the foot. §53 then turned Settings into
 * Administration — its own world, with its own sidebar and a back button at the top — so the seat
 * survives and its destination changes: it opens the world's INDEX, and a seat is pushed over that.
 *
 * IT IS NOT ONE OF THE GLOBBED AREAS, so it is drawn here rather than routed through the registry:
 * `#/admin` is a world and not a file in `areas/`, and a synthetic entry in the areas list would be
 * a lie the rail would have to filter back out. One seat, stated once, in the row that draws it.
 *
 * ⚠ AND THE SHAPE IS PETER'S CALL (THE-ADMIN-CANON §9, recorded). §53 says the phone «pushes the
 * world full-screen with the back at top», which is what this builds; whether the door belongs on
 * the bottom row at all — rather than behind a profile the phone does not have — is his. The
 * default is taken and written down.
 *
 * ═══ WHY THIS IS BASE'S PARTS AND NOT BASE'S COMPONENT ═════════════════════════════════════
 * `baseui/bottom-navigation` is a TAB CONTAINER: it takes `NavItem` children, renders every one
 * of their panels and shows the active one. This app routes on the hash and discovers its areas
 * by glob, so handing Base the panels would mean mounting every area at once and hiding three of
 * them. So the SELECTOR ROW is Base's — `StyledSelectorList`, `StyledSelector`, `StyledTitle`,
 * with Base's own 64px height, its grid, its hairline and its two navigation colours — and the
 * thing each selector does is what it does everywhere else in this app: it is a link to a hash. A
 * door that is a real link is a door you can middle-click, and the rail above 720px is made of
 * the same links and the same marks.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { StyledSelectorList, StyledSelector, StyledTitle } from 'baseui/bottom-navigation';
import { ADMIN, type AreaMeta } from './area';
import AreaGlyph, { hasGlyph } from './glyphs';
import { Glyph } from '../glyphs';

export default function BottomNav({
  areas,
  current,
  inWorld = false,
}: {
  areas: AreaMeta[];
  current: string;
  /** true while the person is standing anywhere inside Administration, so the fourth seat lights */
  inWorld?: boolean;
}) {
  const [, theme] = useStyletron();

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Areas"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 6,
        background: theme.colors.backgroundPrimary,
        /* the phone's own chin, when it has one */
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* ── THE SEAT IS THE WHOLE ROW'S HEIGHT (INTX-12 · §188.2 · E193.14) ──────────────────
          Base draws this list 64px tall and then insets its seats by `scale500` top and bottom,
          which leaves each seat 40px — under INTX-12's 44px floor on the one row of this app that
          exists ONLY for thumbs. W8 measured them at 87.5×40 at 390.

          THE INK DOES NOT MOVE. Every selector already centres its glyph and its word
          (`justifyContent: center`), so giving the seats the row's full 64px changes where the
          FINGER lands and nothing about where the mark is drawn — the same repair the house makes
          everywhere else: grow the target around the ink rather than grow the ink. */}
      <StyledSelectorList role="tablist" $style={{ paddingTop: 0, paddingBottom: 0 }}>
        {areas.map((a) => {
          const on = a.id === current;
          return (
            <StyledSelector
              key={a.id}
              $as="a"
              href={`#/${a.id}`}
              data-area={a.id}
              role="tab"
              aria-selected={on}
              aria-current={on ? 'page' : undefined}
              $style={{
                position: 'relative',
                textDecoration: 'none',
                color: on ? theme.colors.bottomNavigationSelectedText : theme.colors.bottomNavigationText,
              }}
            >
              {hasGlyph(a.id) && <AreaGlyph id={a.id} />}
              <StyledTitle $isActive={on}>{a.title}</StyledTitle>
            </StyledSelector>
          );
        })}

        <StyledSelector
          $as="a"
          href={`#/${ADMIN}`}
          data-area={ADMIN}
          role="tab"
          aria-selected={inWorld}
          aria-current={inWorld ? 'page' : undefined}
          $style={{
            position: 'relative',
            textDecoration: 'none',
            color: inWorld ? theme.colors.bottomNavigationSelectedText : theme.colors.bottomNavigationText,
          }}
        >
          <Glyph id="sliders" />
          <StyledTitle $isActive={inWorld}>Admin</StyledTitle>
        </StyledSelector>
      </StyledSelectorList>
    </nav>
  );
}

/** How much room the row takes out of the bottom of the page, so a scrolled feed ends above it
 *  rather than under it. Base's own selector-list height, stated once. */
export const BOTTOM_NAV_HEIGHT = 64;
