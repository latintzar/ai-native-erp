/* THE NAVIGATION'S MARKS — the seats of both worlds, drawn from the app's one vocabulary.
 *
 * The slim rail and the phone's bottom row are the SAME navigation in two housings, so they draw
 * the same marks. They used to be drawn HERE, which is how the app ended up with two conversation
 * marks and two document marks — one set for the navigation and one for the panel (FEED-IA §30:
 * «one icon, one meaning, everywhere — the same mark never varies by surface»).
 *
 * So this file no longer draws anything. It is the MAP from a seat to its mark, and the drawing
 * lives once, in `src/prototypes/cedar/glyphs.tsx`, on that file's grid.
 *
 * ═══ TWO MAPS NOW, BECAUSE THERE ARE TWO WORLDS (FEED-IA §53) ═══════════════════════════════
 * The desk's three areas and Administration's ten seats are the same KIND of thing — a mark and a
 * word in a rail — so they are mapped the same way, in one file, and the rail draws either without
 * knowing which world it is in.
 *
 * ONE SEAT IS NOT A GLYPH AT ALL, and that is the interesting one. THE-ADMIN-CANON §2.1 gives «Tu
 * agente» the RocotoMark, and the RocotoMark as `capability.tsx` draws it is SAFFRON — which the
 * accent law reserves for Rocoto's own ACTS. A navigation seat is not an act, so a saffron ring in
 * the rail would be the one place in the app where the accent means «a place» instead of «Rocoto
 * did this».
 *
 * The resolution keeps both laws: the agent's seat wears ROCOTO'S OWN FACE — the same
 * `public/brand/rocoto-mark.svg` the desk rail's head draws — masked in the seat's own ink like
 * every other mark in the rail. It is literally the canon's «RocotoMark», it re-themes, and no
 * accent enters the navigation. Inside the seat, the grant rows keep the saffron ring for the acts
 * that really are Rocoto's. The desk's head and this seat never stand in the same rail — the admin
 * world's head is the way back — so the mark still appears exactly once per screen.
 */
import * as React from 'react';
import { Glyph, type GlyphId } from '../glyphs';
import type { AdminSeatId, AreaId } from './area';

const SEAT: Record<AreaId, GlyphId> = {
  sales: 'doc',
  money: 'price',
  stock: 'crate',
  /* THE BOOK OF ACCOUNTS (FEED-IA §37.6). `who` already means «the door to the customer's own
     record» everywhere in this app — it is the mark on the albarán's own door to the profile — so
     the area that IS that record takes the same mark rather than a second one. One icon, one
     meaning, everywhere (§30). */
  customers: 'who',
};

/** THE ADMINISTRATION'S SEATS (THE-ADMIN-CANON §2.1). `agent` is absent on purpose: it is the one
 *  seat whose mark is Rocoto's own face rather than a glyph, and `AdminSeatMark` draws it. */
const ADMIN_SEAT: Record<Exclude<AdminSeatId, 'agent' | 'account'>, GlyphId> = {
  business: 'brand',
  team: 'team',
  geography: 'map',
  operations: 'ops',
  connections: 'connect',
  units: 'units',
  'app-settings': 'sliders',
  plan: 'plan',
  data: 'data',
};

/** True where this id has a mark. An area outside the three is drawn by its word alone. */
export const hasGlyph = (id: string): id is AreaId => id in SEAT;

export default function AreaGlyph({ id, size = 20 }: { id: AreaId; size?: number }) {
  return <Glyph id={SEAT[id]} size={size} />;
}

/** ROCOTO'S OWN FACE, MASKED — the asset, taking the ink of the seat it stands on. It is the rail
 *  head's construction to the pixel (`rail.tsx`'s `RocotoMark`), at a mark's size instead of a
 *  logo's, so «your agent» is drawn as the product itself and still re-themes.
 *
 *  IT PAINTS IN `currentColor` AND NAMES NO COLOUR OF ITS OWN. The seat around it already sets the
 *  ink for standing-here versus standing-elsewhere; a mark that fixed its own would be the one item
 *  in the rail that stayed dark when its neighbours went quiet. */
function RocotoFace({ size }: { size: number }) {
  return (
    <span
      data-rocoto-face="yes"
      aria-hidden="true"
      style={{
        display: 'block',
        width: size,
        height: size,
        flex: '0 0 auto',
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

/** THE MARK ON AN ADMINISTRATION SEAT. Nine of them are glyphs; `agent` is Rocoto's own face and
 *  `account` is the person, which the rail draws as their initial rather than as any mark at all —
 *  a face is not an icon, and the foot seat is about somebody in particular. */
export function AdminSeatMark({ id, size = 20 }: { id: AdminSeatId; size?: number }) {
  if (id === 'agent') return <RocotoFace size={size} />;
  if (id === 'account') return null;
  return <Glyph id={ADMIN_SEAT[id]} size={size} />;
}
