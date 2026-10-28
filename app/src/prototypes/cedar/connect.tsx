/* THE CONNECT ZONE — the one place in Rocoto that is allowed to feel like plugging something in.
 *
 * ═══ HIS LICENCE, VERBATIM (FEED-IA §51.20) ═════════════════════════════════════════════════
 * «THE CONNECT IS A FLAGSHIP FEELING — the inbox/ERP hookup should feel exciting: a main icon,
 * maybe drops of colour or a gradient — a sanctioned delight zone for integrations (make them feel
 * they're handling a plug into our product).»
 *
 * ═══ WHY IT IS ONE FILE AND NOT THREE COPIES ════════════════════════════════════════════════
 * The offer stands in three places — Stock's door onto the supplier mail (`inbox.tsx`), the export
 * centre's unconnected rails (`shell/printing.tsx`), and the rows that plug something in — and a
 * feeling that is written three times is three feelings inside a month. So the treatment is a
 * component, the licence is the recipe in `rocoto-theme.ts`, and grep over `connectWash` is the
 * audit that nothing else in the product drew it.
 *
 * ═══ SURFACE THREE MOVED, AND THE CAP HELD (FEED-IA §53 · THE-ADMIN-CANON §8.7) ═════════════
 * Surface three used to be `areas/settings.tsx`. §53 turned that page into a WORLD, and the rows
 * that plug something in re-seated onto `areas/admin/connections.tsx` — so THE LICENCE TRAVELLED
 * WITH THE ROWS. It did not multiply: the Conexiones seat inherits the third surface rather than
 * being granted a fourth, and the two integration rows on it are still the only rows in the whole
 * administration that wear the plug on the wash.
 *
 * THE AUDIT IS UNCHANGED AND STILL TRUE: `grep -rn connectWash src/` finds the recipe defined once
 * (`rocoto-theme.ts`) and applied once (this file). Every consumer asks for the treatment BY
 * COMPONENT — `ConnectCard`, `ConnectAct`, `ConnectTile` — which is what keeps the count honest as
 * surfaces come and go.
 *
 * ═══ AND THE AUDIT LEARNED TO COUNT CARDS, NOT SURFACES (FEED-IA §109.1 · THE ACCEPTANCE WALK
 *     P1-4) ═════════════════════════════════════════════════════════════════════════════════
 * The grep proved the recipe was written once and said nothing about how many times a seat ASKED
 * for it. `#/admin/connections` was asking four times at once — «Connect your ERP» · «Connect your
 * inbox» · «Connect Gmail» · «Connect Microsoft 365» — with a fifth on Stock's incoming log. Four
 * washes on one page is the delight spent until it is wallpaper, and two of those four were the
 * same act offered twice.
 *
 * PETER'S RULING, VERBATIM (§109.1): «Connect your email is its own thing. And then WITHIN that,
 * you're able to select HOW to do the connection.» So EMAIL IS ONE OFFER, and the method — Gmail ·
 * Microsoft 365 · the house's own minted address — is chosen inside the door it opens.
 *
 * THE COUNT THE APP NOW HOLDS, and the one a reviewer should check:
 *   · `areas/admin/connections.tsx` — TWO cards, one per unplugged rail («Connect your email» ·
 *     «Connect your ERP»), each at the FOOT of the region that owns the rail (§98.3)
 *   · `inbox.tsx` — ONE card, Stock's own door onto the supplier mail
 *   · `shell/printing.tsx` — asks for `ConnectAct`, which is ink and wears no wash at all
 * Three washed cards in the whole product, and never more than two standing on one seat.
 *
 * ═══ THE GRAMMAR (FEED-IA §51.24 — the wireframe law applies HERE TOO) ══════════════════════
 * A connect surface is REGIONS, like everything else:
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  [PLUG]   NAME OF THE THING              (the act)   ›     │   ← the identity row
 *   │           what the house GETS once it is plugged in        │   ← one line, a fact
 *   └───────────────────────────────────────────────────────────┘
 *
 * The line under the name is the only sentence allowed on this surface, and it exists because it
 * is the whole proposition — «suppliers who send albaranes by email land here with the file» is
 * what a person is deciding about, not a description of the card. Everything else is a region.
 *
 * ═══ WHAT IT SAYS, AND WHAT IT NEVER SAYS ═══════════════════════════════════════════════════
 * It leads with what the house GETS. There is no negative anywhere on it: an unconnected rail is
 * never «not connected», it is «connect your ERP and every albarán lands in it on its own». The
 * visible state IS the card standing there; a connected rail simply has no card.
 *
 * ONE CARD PER ACT, NEVER PER METHOD (§109.1). A card names the thing the house is plugging in —
 * «your email», «your ERP» — and a way of doing it is never a card of its own. Where an act has
 * several methods they are the CONTENT of the door the card opens, in the app's ordinary row
 * grammar, because a method offered as a card is the same offer counted twice.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { connectEdge, connectTile, connectWash } from '../../rocoto-theme';
import { Glyph, STEP } from './glyphs';

/** the plug's seat: a stated square, the mark centred with room around it. Two steps — the card's
 *  own big one, and the small one a settings row's tile takes. */
export const CONNECT_TILE = { small: 36, large: 48 } as const;

/**
 * THE MAIN ICON (§51.20's «a main icon»). The plug, on the brand's own wash, in the brand's own
 * ink. It is the object the person is about to handle, so it is drawn at the size of a thing you
 * pick up rather than at the size of a bullet.
 */
export function ConnectTile({ size = CONNECT_TILE.large }: { size?: number }) {
  const [, theme] = useStyletron();
  return (
    <span
      data-connect-tile="yes"
      aria-hidden="true"
      style={{
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        width: size,
        height: size,
        flex: '0 0 auto',
        borderRadius: theme.borders.radius300,
        background: connectTile(theme.colors.accent, theme.colors.backgroundPrimary),
        color: theme.colors.accent,
      }}
    >
      <Glyph id="connect" size={size >= CONNECT_TILE.large ? STEP.large : STEP.medium} />
    </span>
  );
}

/**
 * THE CARD — the full offer, where a surface has the room for it.
 *
 * `what` names the thing being plugged in and `gets` is the one line about what arrives once it
 * is. `act` is the words on the button; `onOpen` is where it goes. `href` exists because two of
 * the three homes are reached as a link to `#/settings` and a link that a keyboard can follow is
 * better than a button that assigns to `location.hash`.
 */
export function ConnectCard({
  what,
  gets,
  act,
  testid,
  href,
  onOpen,
  compact = false,
}: {
  what: string;
  gets: string;
  /** the words on the control. Absent, the card is the control and carries a chevron. */
  act?: string;
  testid: string;
  href?: string;
  onOpen?: () => void;
  /** a rail inside a modal has less room than a section on a page */
  compact?: boolean;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);

  const ground: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: compact ? theme.sizing.scale500 : theme.sizing.scale600,
    padding: compact ? theme.sizing.scale500 : theme.sizing.scale600,
    borderRadius: theme.borders.radius300,
    border: `1px solid ${connectEdge(theme.colors.accent, theme.colors.borderOpaque)}`,
    background: connectWash(theme.colors.accent, theme.colors.backgroundPrimary),
    color: theme.colors.contentPrimary,
    textDecoration: 'none',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
    minWidth: 0,
    /* the lift is Base's own elevation, taken on hover — the card behaves like every other door in
       the app and simply stands on a livelier ground than they do */
    boxShadow: over ? theme.lighting.shadow400 : 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const body = (
    <>
      <ConnectTile size={compact ? CONNECT_TILE.small : CONNECT_TILE.large} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
        <span style={compact ? theme.typography.LabelSmall : theme.typography.LabelMedium}>{what}</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{gets}</span>
      </span>
      {act ? (
        <span style={{ flex: '0 0 auto' }}>
          <span
            data-connect-act={testid}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.sizing.scale200,
              padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
              borderRadius: theme.borders.radius200,
              background: theme.colors.accent,
              color: theme.colors.backgroundPrimary,
              ...theme.typography.LabelSmall,
              whiteSpace: 'nowrap',
            }}
          >
            {act}
          </span>
        </span>
      ) : (
        <span aria-hidden="true" style={{ display: 'inline-flex', color: theme.colors.accent, flex: '0 0 auto', transform: 'rotate(-90deg)' }}>
          <Glyph id="caret" size={STEP.small} />
        </span>
      )}
    </>
  );

  const hover = { onMouseEnter: () => setOver(true), onMouseLeave: () => setOver(false) };

  if (href) {
    return (
      <a href={href} data-testid={testid} data-connect="offer" style={ground} {...hover} onClick={onOpen}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" data-testid={testid} data-connect="offer" style={{ ...ground, border: ground.border }} {...hover} onClick={onOpen}>
      {body}
    </button>
  );
}

/**
 * THE ACT ALONE — for a seat that already names the thing beside it, so a whole card would say the
 * name twice. The export centre's rails are that seat: the rail's own identity column says «Your
 * ERP», and this is the plug and the words in the act cell of the same row.
 *
 * ═══ AND IT IS INK (the accent law · §51.20, AUDIT-2 C23) ════════════════════════════════════
 * It used to draw its words and its border in `theme.colors.accent` — the saffron red — which is the one
 * colour this app reserves for A READING ROCOTO MADE, and the same value the attention dot wears.
 * So in a modal where every other control is ink-on-white or white-on-ink, the TWO red things were
 * «Connect your ERP» and «Connect your mail»: a merchant's own setup act, painted as the app's
 * error mark, and the only colour on the surface spent on something Rocoto did not do.
 *
 * THE DELIGHT §51.20 LICENSES BELONGS TO THE CARD, NOT TO THE ACT. `ConnectCard` and `ConnectTile`
 * keep the wash and the plug on `#/admin/connections`, which is the place a house goes to look at
 * its integrations. An act standing in a row of acts wears what the row's other acts wear.
 */
export function ConnectAct({
  what,
  testid,
  onOpen,
}: {
  what: string;
  testid: string;
  onOpen: () => void;
}) {
  const [, theme] = useStyletron();
  return (
    <Button
      kind={KIND.secondary}
      size={SIZE.compact}
      data-testid={testid}
      data-connect="act"
      onClick={onOpen}
      startEnhancer={<Glyph id="connect" size={STEP.small} />}
      overrides={{
        BaseButton: {
          style: {
            background: theme.colors.backgroundPrimary,
            borderTopColor: theme.colors.borderOpaque,
            borderRightColor: theme.colors.borderOpaque,
            borderBottomColor: theme.colors.borderOpaque,
            borderLeftColor: theme.colors.borderOpaque,
            borderTopWidth: '1px',
            borderRightWidth: '1px',
            borderBottomWidth: '1px',
            borderLeftWidth: '1px',
            borderTopStyle: 'solid',
            borderRightStyle: 'solid',
            borderBottomStyle: 'solid',
            borderLeftStyle: 'solid',
            color: theme.colors.contentPrimary,
            whiteSpace: 'nowrap',
          },
        },
      }}
    >
      {what}
    </Button>
  );
}

/* THE ROW'S TILE is `ConnectTile` itself, at `CONNECT_TILE.small`. A row in the administration is a
 * fixed anatomy — a mark in a tile · the label · one line · the value — and the two integration
 * rows keep every part of it except the tile, which becomes the plug's own seat. That is the whole
 * of the licence as it applies to a list: the anatomy does not move, the words do not move, and the
 * two rows a person came looking for stand out of a page of thirty. `app/rows.tsx`'s `Tile` reaches
 * for `ConnectTile` directly when a row declares `connect`, so there is no second name for one
 * component and no seat can draw the wash by hand.
 */
