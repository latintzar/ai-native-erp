/* THE MEASURES PREPARATION STANDS ON — the map's viewport and the paper's own counts.
 *
 * «the logic of printing etc. the numbers dont add up. make sure its actually calculating
 * everything» and «Make sure that for all the addresses you actually come up with, they all show
 * up on the map» (Peter, 2026-09-10). Both asks are arithmetic, so both live in one module with
 * no React in it: a number a screen prints can be proved by a tool test rather than by a
 * screenshot, and two surfaces that read the same function can never disagree.
 *
 * ═══ THE MAP HAS TWO MODES AND THEY ANSWER TWO QUESTIONS ════════════════════════════════════
 * ONE PLACE — «where is this customer?» — is answered by a fixed sharp ground around one
 * coordinate. That is the thumbnail and the Delivery Note's own map, and it needs no measurement.
 *
 * A SET OF PLACES — «where does this batch go?» — is answered by a box that holds every pin. The
 * delivery world spans roughly 35 km, which is about 3,700 px at zoom 14, so a fixed sharp ground
 * around the first customer drops every other pin off the picture. `mapFitOf` measures the box it
 * has been given, takes the sharpest checked-in zoom at which the marker bounds still fit inside
 * it, centres on the bounds and names the tiles that box needs.
 *
 * ═══ THE PAPER'S COUNTS ARE FOUR DIFFERENT NUMBERS ══════════════════════════════════════════
 * A delivery is a customer's order. A document is a page-set the printer is handed, and a truck
 * divider is a document that belongs to no delivery. Copies multiply documents, so sheets are
 * documents × copies. One run of five deliveries across two trucks at two copies is 5 deliveries,
 * 7 documents, 2 dividers and 14 sheets — four numbers, each true, and the screen used to draw
 * two of them under one noun.
 */

export type LatLng = { lat: number; lng: number };

/** An order on the map. The id stays on the control so a pin opens the same Delivery Note its
 *  list row opens. */
export type MapMarker = { id: string; at: LatLng; label?: string; batch?: boolean };

/** a slippy tile is 256 points (the files are drawn at twice that and shown at this) */
export const MAP_TILE = 256;
/** the sharpest ground the repository carries — `tools/build-map-tiles.py` */
export const MAP_ZOOM_SHARPEST = 14;
/** the widest ground it carries: the whole delivery world inside one phone-sized box, with one
 *  step of headroom under it so a house whose book spreads further still holds every pin */
export const MAP_ZOOM_WIDEST = 8;
/** the ceiling on pictures in one viewport, so a bad box can never ask for a thousand files */
export const MAP_TILE_CEILING = 96;

const RADIANS = Math.PI / 180;

export const worldX = (lng: number, zoom: number): number =>
  ((lng + 180) / 360) * MAP_TILE * 2 ** zoom;

export const worldY = (lat: number, zoom: number): number => {
  const r = lat * RADIANS;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * MAP_TILE * 2 ** zoom;
};

export const lngAt = (x: number, zoom: number): number => (x / (MAP_TILE * 2 ** zoom)) * 360 - 180;

export const latAt = (y: number, zoom: number): number => {
  const n = Math.PI - (2 * Math.PI * y) / (MAP_TILE * 2 ** zoom);
  return Math.atan(Math.sinh(n)) / RADIANS;
};

export type MapBounds = { north: number; south: number; east: number; west: number };

/** The smallest box that holds every marker. One marker gives a box of zero size, which is the
 *  right answer: a single place needs no span, only a centre. */
export function boundsOf(markers: readonly MapMarker[]): MapBounds | null {
  if (markers.length === 0) return null;
  let north = markers[0].at.lat;
  let south = markers[0].at.lat;
  let east = markers[0].at.lng;
  let west = markers[0].at.lng;
  for (const marker of markers) {
    north = Math.max(north, marker.at.lat);
    south = Math.min(south, marker.at.lat);
    east = Math.max(east, marker.at.lng);
    west = Math.min(west, marker.at.lng);
  }
  return { north, south, east, west };
}

/** One picture in the ground, placed by its offset from the box's own centre. */
export type MapTile = { x: number; y: number; left: number; top: number };

export type MapFit = {
  zoom: number;
  /** the centre of the marker bounds, which is what the box is pinned to */
  centre: LatLng;
  /** that centre in world pixels at `zoom` */
  centreX: number;
  centreY: number;
  /** the marker bounds in pixels at `zoom` */
  spanX: number;
  spanY: number;
  /** the room the box offers those pixels once the pin allowance is taken off */
  roomX: number;
  roomY: number;
  /** the part of the box the marks were fitted into — the whole of it, or one arm of the L a
   *  corner card leaves */
  frame: MapFrame;
  /** true when the bounds sit inside that room at this zoom */
  fitted: boolean;
  tiles: MapTile[];
};

/** THE FAN, COMPUTED ONCE AND READ TWICE. Orders at one coordinate — a market hall, three bars on
 *  one address — are pushed onto a small ring so each keeps a separate control and its own exact
 *  sale id. The offsets are PIXELS and therefore the same at every zoom, which is why the fit can
 *  take them into account without re-deriving them: a marker fanned to the edge of the ring is
 *  still a marker the box has to hold. */
export type FanOffset = { dx: number; dy: number };

export const FAN_RADIUS_CEILING = 18;

export function fanOffsetsOf(markers: readonly MapMarker[]): Map<string, FanOffset> {
  const groups = new Map<string, MapMarker[]>();
  for (const marker of markers) {
    const key = `${marker.at.lat},${marker.at.lng}`;
    const held = groups.get(key);
    if (held) held.push(marker); else groups.set(key, [marker]);
  }
  const offsets = new Map<string, FanOffset>();
  for (const group of groups.values()) {
    const radius = group.length > 1 ? Math.min(FAN_RADIUS_CEILING, 6 + group.length * 2) : 0;
    group.forEach((marker, index) => {
      const angle = group.length > 1 ? (index / group.length) * Math.PI * 2 : 0;
      offsets.set(marker.id, { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius });
    });
  }
  return offsets;
}

/** THE CARD THE PICTURE CARRIES, AS A RECTANGLE THE PINS KEEP OUT OF (FEED-IA §246).
 *
 * Prep draws a clock card over the top-left of its map. The fit used to measure the whole box, so
 * a majority of the marks were painted underneath that card and could be seen by nobody: 142 of
 * 142 at 320, 45 of 142 at 390, measured. The card is an opaque rectangle in the corner, so what
 * is left is an L — everything under it, and the strip beside it — and the fit takes whichever
 * arm of that L holds the marker bounds at the sharpest zoom. Stated in box pixels from the box's
 * own top-left corner, which is where a `getBoundingClientRect` difference already gives it. */
export type MapInset = { right: number; bottom: number };

export type MapFitInput = {
  markers: readonly MapMarker[];
  /** the box, in CSS pixels */
  width: number;
  height: number;
  /** room kept for a pin's own body: it hangs by its tip, so the allowance is asymmetric */
  padX?: number;
  padTop?: number;
  padBottom?: number;
  /** a card drawn over the box's top-left corner that no mark may land under */
  avoid?: MapInset;
  minZoom?: number;
  maxZoom?: number;
  maxTiles?: number;
};

/** The part of the box a marker POINT may stand in. The pin allowance is already taken off, so a
 *  point inside this rectangle draws a control that is inside the picture and clear of the card. */
export type MapFrame = { left: number; right: number; top: number; bottom: number };

const frameRoom = (frame: MapFrame) => ({
  roomX: Math.max(32, frame.right - frame.left),
  roomY: Math.max(32, frame.bottom - frame.top),
});

/** The arms of the L, widest first. With no card there is one rectangle and it is the whole box. */
export function mapFramesOf(input: { width: number; height: number; padX: number; padTop: number; padBottom: number; avoid?: MapInset }): MapFrame[] {
  const whole: MapFrame = {
    left: input.padX, right: input.width - input.padX,
    top: input.padTop, bottom: input.height - input.padBottom,
  };
  if (!input.avoid) return [whole];
  const under: MapFrame = { ...whole, top: input.avoid.bottom + input.padTop };
  const beside: MapFrame = { ...whole, left: input.avoid.right + input.padX };
  const area = (frame: MapFrame) => {
    const room = frameRoom(frame);
    return room.roomX * room.roomY;
  };
  return [under, beside].sort((a, b) => area(b) - area(a));
}

/** THE ROOM A PIN'S OWN BODY NEEDS. The control is 44px and it hangs by its tip, so it reaches
 *  22px either side of the point and its full height ABOVE it — which is why the allowance is
 *  asymmetric, and why the fit shifts its centre rather than simply centring the bounds: centring
 *  splits an asymmetric allowance down the middle and the topmost pin loses its head off the
 *  picture (measured: 12px of it, at 1600). */
export const PIN_CONTROL = 44;
export const PIN_PAD_X = 28;
export const PIN_PAD_TOP = 52;
/** a place mark stands ON its point rather than above it, so its control reaches below the point */
export const PIN_PAD_BOTTOM = 24;

/**
 * The sharpest checked-in zoom at which every marker still stands inside the box, the centre that
 * box is pinned to, and the tiles it needs. A box too small for the widest ground still returns
 * that widest ground: showing every pin slightly tight is the ask, and a picture that silently
 * dropped a customer is the defect this function exists to close.
 */
export function mapFitOf(input: MapFitInput): MapFit | null {
  if (input.markers.length === 0) return null;
  const maxZoom = input.maxZoom ?? MAP_ZOOM_SHARPEST;
  const minZoom = Math.min(input.minZoom ?? MAP_ZOOM_WIDEST, maxZoom);
  const padX = input.padX ?? PIN_PAD_X;
  const padTop = input.padTop ?? PIN_PAD_TOP;
  const padBottom = input.padBottom ?? PIN_PAD_BOTTOM;
  const width = Math.max(64, input.width);
  const height = Math.max(64, input.height);
  const frames = mapFramesOf({ width, height, padX, padTop, padBottom, avoid: input.avoid });

  /* THE EXTREMES ARE THE CONTROLS' OWN, FAN INCLUDED. Bounds taken off the coordinates alone put
     a fanned marker up to 18px outside the picture the fit just promised to hold — measured, at
     1600, as one delivery of four hundred hanging over the bottom edge. */
  const fan = fanOffsetsOf(input.markers);
  const reach = (zoom: number) => {
    let west = Infinity; let east = -Infinity; let north = Infinity; let south = -Infinity;
    for (const marker of input.markers) {
      const offset = fan.get(marker.id) ?? { dx: 0, dy: 0 };
      const x = worldX(marker.at.lng, zoom) + offset.dx;
      const y = worldY(marker.at.lat, zoom) + offset.dy;
      west = Math.min(west, x); east = Math.max(east, x);
      north = Math.min(north, y); south = Math.max(south, y);
    }
    return { west, east, north, south, spanX: east - west, spanY: south - north };
  };

  const whole = mapFramesOf({ width, height, padX, padTop, padBottom })[0];
  let zoom = minZoom;
  /* THE FALLBACK IS THE WHOLE BOX. A picture whose free arm is smaller than the widest ground can
     hold has to choose which promise to break, and «every pin is on the picture» outranks «every
     pin is clear of the card»: a mark under a card is behind something a finger can still reach
     past, a mark outside the box is gone. `fitted` says which answer this is. */
  let frame = whole;
  let fitted = false;
  for (let candidate = maxZoom; candidate >= minZoom && !fitted; candidate -= 1) {
    const span = reach(candidate);
    for (const candidateFrame of frames) {
      const room = frameRoom(candidateFrame);
      if (span.spanX <= room.roomX && span.spanY <= room.roomY) {
        zoom = candidate; frame = candidateFrame; fitted = true; break;
      }
    }
  }

  /* THE DRAWN CENTRE, NOT THE BOUNDS' CENTRE. The picture places a world point at its own middle
     plus the point's offset, so putting the bounds' centre in the middle would leave `padTop` and
     `padBottom` each half honoured — and, where a card stands over the corner, would put the marks
     under it. The bounds are centred in the FRAME instead, and the drawn centre is shifted by the
     distance between that frame's middle and the box's own. With no card and an asymmetric pin
     allowance this is exactly the old half-the-difference shift, which is the whole of «every pin
     inside the box». */
  const span = reach(zoom);
  const room = frameRoom(frame);
  const centreX = (span.west + span.east) / 2 - ((frame.left + frame.right) / 2 - width / 2);
  const centreY = (span.north + span.south) / 2 - ((frame.top + frame.bottom) / 2 - height / 2);
  return {
    zoom,
    centre: { lat: latAt(centreY, zoom), lng: lngAt(centreX, zoom) },
    centreX,
    centreY,
    spanX: span.spanX,
    spanY: span.spanY,
    roomX: room.roomX,
    roomY: room.roomY,
    frame,
    fitted,
    tiles: tilesAround(centreX, centreY, width, height, input.maxTiles ?? MAP_TILE_CEILING),
  };
}

/** The one-place ground: a centre, a zoom and a fixed square of tiles around it. Three across is
 *  wider than any panel that asks for this mode, so it needs no measurement and no layout pass —
 *  which is the whole reason a thumbnail can draw itself in one render. */
export function placeFitOf(at: LatLng, zoom: number, span = 1): MapFit {
  const centreX = worldX(at.lng, zoom);
  const centreY = worldY(at.lat, zoom);
  const tx = Math.floor(centreX / MAP_TILE);
  const ty = Math.floor(centreY / MAP_TILE);
  const tiles: MapTile[] = [];
  for (let dy = -span; dy <= span; dy += 1) {
    for (let dx = -span; dx <= span; dx += 1) {
      tiles.push({ x: tx + dx, y: ty + dy, left: (tx + dx) * MAP_TILE - centreX, top: (ty + dy) * MAP_TILE - centreY });
    }
  }
  return {
    zoom,
    centre: at,
    centreX,
    centreY,
    spanX: 0,
    spanY: 0,
    roomX: MAP_TILE * (span * 2 + 1),
    roomY: MAP_TILE * (span * 2 + 1),
    frame: { left: 0, right: MAP_TILE * (span * 2 + 1), top: 0, bottom: MAP_TILE * (span * 2 + 1) },
    fitted: true,
    tiles,
  };
}

/** Every tile the box covers, plus one ring of margin, capped so a wrong box stays a picture
 *  rather than a thousand requests. Offsets are measured from the box's own centre. */
export function tilesAround(centreX: number, centreY: number, width: number, height: number, maxTiles = MAP_TILE_CEILING): MapTile[] {
  const halfW = Math.max(MAP_TILE, width) / 2;
  const halfH = Math.max(MAP_TILE, height) / 2;
  let x0 = Math.floor((centreX - halfW) / MAP_TILE) - 1;
  let x1 = Math.floor((centreX + halfW) / MAP_TILE) + 1;
  let y0 = Math.floor((centreY - halfH) / MAP_TILE) - 1;
  let y1 = Math.floor((centreY + halfH) / MAP_TILE) + 1;
  const midX = Math.floor(centreX / MAP_TILE);
  const midY = Math.floor(centreY / MAP_TILE);
  while ((x1 - x0 + 1) * (y1 - y0 + 1) > maxTiles) {
    if (x1 - x0 >= y1 - y0) {
      if (x1 - midX >= midX - x0) x1 -= 1; else x0 += 1;
    } else if (y1 - midY >= midY - y0) y1 -= 1; else y0 += 1;
  }
  const tiles: MapTile[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      tiles.push({ x, y, left: x * MAP_TILE - centreX, top: y * MAP_TILE - centreY });
    }
  }
  return tiles;
}

/** Where a marker's control stands, in pixels from the box's centre. `fanX`/`fanY` are the part of
 *  that offset the FAN contributed — orders at one coordinate are pushed onto a small ring — so a
 *  ground that projects its own points (Google's) can add the same ring to them. */
export type MapPlacement = { id: string; label?: string; batch: boolean; x: number; y: number; fanX: number; fanY: number; index: number };

/** Where every marker's control stands, fan included, in pixels from the picture's own centre. */
export function markerPlacementsOf(markers: readonly MapMarker[], fit: Pick<MapFit, 'zoom' | 'centreX' | 'centreY'>): MapPlacement[] {
  const fan = fanOffsetsOf(markers);
  return markers.map((marker, index) => {
    const offset = fan.get(marker.id) ?? { dx: 0, dy: 0 };
    return {
      id: marker.id,
      label: marker.label,
      batch: marker.batch === true,
      x: worldX(marker.at.lng, fit.zoom) - fit.centreX + offset.dx,
      y: worldY(marker.at.lat, fit.zoom) - fit.centreY + offset.dy,
      fanX: offset.dx,
      fanY: offset.dy,
      index,
    };
  });
}

/** ONE CONTROL FOR THE MARKS THAT SHARE A SPOT (FEED-IA §247.8).
 *
 * A group of deliveries drawn as one mark with its own count. `id` is the earliest of its members
 * in the order the markers were given — the soonest delivery, since that is how Prep sorts them —
 * so the same set of marks produces the same group on every render. `x`/`y` are the members' mean,
 * in pixels from the picture's own centre, which is the point the count stands on. `batch` is true
 * where any member belongs to the batch about to leave, so the ring that tells the two scopes
 * apart survives the grouping. */
export type MapCluster = { id: string; members: string[]; x: number; y: number; batch: boolean };

/** Every mark, exactly once: the ones that stand alone and the groups that hold the rest. */
export type MapGrouping = { singles: MapPlacement[]; clusters: MapCluster[] };

/** DENSE MARKS COLLAPSE INTO COUNTED GROUPS, AND EVERY DELIVERY IS STILL ON THE PICTURE.
 *
 * «Make sure that for all the addresses you actually come up with, they all show up on the map»
 * (Peter, 2026-09-10). The fan answers the small version of this — orders at ONE coordinate are
 * pushed onto a ring — and it stops working past a handful: a hundred deliveries inside one city
 * at a phone-sized zoom is a smear of touching glyphs, where pressing the mark a finger is over
 * opens whichever delivery happens to own those pixels. A cluster is how all of them show up, so
 * the partition below is TOTAL: `singles` plus every cluster's `members` is the marker set,
 * counted once, and the figure states the marker count beside the cluster count so a drive can
 * hold this function to it.
 *
 * THE GROUPING IS A GRID AND A GREEDY SEED, which is what makes it deterministic. Marks are
 * bucketed into cells the size of the radius, so any two marks within the radius of each other sit
 * in cells that differ by at most one step; a seed then claims every unclaimed mark inside its own
 * radius from its own nine cells. Seeds are taken in the order the markers were given — the
 * soonest delivery first — so the same input gives the same groups.
 *
 * THE RADIUS IS THE TOUCH TARGET (44 px). Two marks closer than one finger are two marks a finger
 * cannot tell apart, which is exactly the thing a group answers.
 *
 * AND THE ANSWER IS ABOUT THE CONTROLS, NOT ABOUT THE SEEDS. A seed says where a group STARTED;
 * what a finger meets is the control drawn at its members' mean, pushed off the mark the picture
 * is titled after, so the settle loop below holds THAT point to the same rule the marks are held
 * to: a mark inside a group's control joins it, and two group controls inside one finger of each
 * other are one group. All three were measured red before they were written — a mark left under a
 * count took no press, a fuzz over 4,000 placement sets put two group controls 20 px apart in 571
 * of them, and a drop landing on a group pushed it 44 px straight at its neighbour, leaving two
 * counts 2.7 px apart.
 */
export function clusterPlacementsOf(
  placements: readonly MapPlacement[],
  radiusPx: number = PIN_CONTROL,
  /** the drawn point of the mark the picture is titled after, which is held out of the grouping
   *  and which every group is pushed off — see `clusterClearOf` and the settle loop below */
  clear: { x: number; y: number } | null = null,
  /** the picture's box, handed on to `clusterClearOf` so a cleared group stays inside it */
  box: { width: number; height: number } | null = null,
): MapGrouping {
  const radius = Math.max(1, radiusPx);
  const cells = new Map<string, number[]>();
  placements.forEach((placement, at) => {
    const key = `${Math.floor(placement.x / radius)}:${Math.floor(placement.y / radius)}`;
    const held = cells.get(key);
    if (held) held.push(at); else cells.set(key, [at]);
  });
  const claimed = placements.map(() => false);
  const lone: number[] = [];
  const groups: number[][] = [];
  placements.forEach((seed, at) => {
    if (claimed[at]) return;
    claimed[at] = true;
    const group = [at];
    const cellX = Math.floor(seed.x / radius);
    const cellY = Math.floor(seed.y / radius);
    for (let stepY = -1; stepY <= 1; stepY += 1) {
      for (let stepX = -1; stepX <= 1; stepX += 1) {
        for (const other of cells.get(`${cellX + stepX}:${cellY + stepY}`) ?? []) {
          if (claimed[other]) continue;
          const near = placements[other];
          if (Math.hypot(near.x - seed.x, near.y - seed.y) > radius) continue;
          claimed[other] = true;
          group.push(other);
        }
      }
    }
    if (group.length === 1) lone.push(at); else groups.push(group);
  });

  /* ⚠ A MARK UNDER THE GROUP'S CONTROL IS A MARK NOBODY CAN PRESS, so it belongs to the group.
     The seed promises only that an unclaimed mark is further than the radius from the SEED, and
     the control is drawn at the members' MEAN — which is a different point, and can land right on
     top of a mark that stayed out. Photographed on 2026-09-13: a 44 px group drawn over a mark
     swallowed every press aimed at it. A second pass claims any mark the control would cover and
     takes the mean again with it inside; each pass removes at least one mark, so it settles.

     ⚠ AND TWO GROUPS DRAWN INSIDE ONE FINGER OF EACH OTHER ARE ONE GROUP, for exactly the same
     reason: two means can be near each other even where no seed was. Measured on 2026-09-14 by a
     fuzz over 4,000 placement sets — 571 of them drew two group controls closer than the touch
     target, the nearest 20.4 px apart, and both carry the same z-index, so DOM order decided which
     one took the press and the other group's whole membership went with it. Merging takes the mean
     again over both memberships; each merge removes one group, so this settles too.

     ⚠ AND THE CLEARING IS PART OF THE LOOP, BECAUSE IT MOVES THE CONTROL. Pushing a group off the
     mark the picture is titled after happens before anything is drawn, so the point the loop has
     to hold apart is the CLEARED one. Measured on 2026-09-14 over 400,000 random pairs of group
     centres a finger apart: a drop landing on one of them pushed that group 44 px straight at its
     neighbour and left the two controls 2.7 px apart, which is the same lost press one level on.
     Taking the mean, clearing it, and only then asking «does this control cover a mark? is it
     inside a finger of another control?» settles all three rules at once. */
  const centreOf = (group: readonly number[]) => {
    const mean = {
      x: group.reduce((sum, one) => sum + placements[one].x, 0) / group.length,
      y: group.reduce((sum, one) => sum + placements[one].y, 0) / group.length,
    };
    if (!clear) return mean;
    const moved = clusterClearOf({ id: '', members: [], batch: false, ...mean }, clear, radius, box);
    return { x: moved.x, y: moved.y };
  };
  const centres = groups.map(centreOf);
  for (let moved = true; moved;) {
    moved = false;
    for (let at = 0; at < lone.length; at += 1) {
      const placement = placements[lone[at]];
      const under = centres.findIndex((centre) => Math.hypot(placement.x - centre.x, placement.y - centre.y) <= radius);
      if (under < 0) continue;
      groups[under].push(lone[at]);
      lone.splice(at, 1);
      at -= 1;
      centres[under] = centreOf(groups[under]);
      moved = true;
    }
    /* the earlier group keeps the pair, which is what keeps the output in seed order */
    for (let one = 0; one < centres.length && !moved; one += 1) {
      for (let two = one + 1; two < centres.length; two += 1) {
        if (Math.hypot(centres[one].x - centres[two].x, centres[one].y - centres[two].y) > radius) continue;
        groups[one] = groups[one].concat(groups[two]);
        groups.splice(two, 1);
        centres.splice(two, 1);
        centres[one] = centreOf(groups[one]);
        moved = true;
        break;
      }
    }
  }

  return {
    singles: lone.map((at) => placements[at]),
    clusters: groups.map((group, at) => {
      group.sort((one, two) => one - two);
      const members = group.map((one) => placements[one]);
      return {
        id: members[0].id,
        members: members.map((member) => member.id),
        x: centres[at].x,
        y: centres[at].y,
        batch: members.some((member) => member.batch),
      };
    }),
  };
}

/** ONE MORE MARK THE GROUPING CANNOT CLAIM: THE ONE THE PICTURE IS TITLED AFTER.
 *
 * The delivery a map screen is opened for wears the drop and stands alone whatever else is around
 * it, so it is held out of the grouping — and a group's control, drawn at its members' mean, can
 * therefore land on top of it. Photographed on 2026-09-13: the nested map's own subject sat under
 * an eight-delivery count and took no press. The group is pushed straight out from that mark until
 * a whole control stands between the two points, along the line that already separates them, so
 * the group stays as near its members as it can be while both take a press. A group exactly on the
 * mark goes below it, which is the half of a drop's own control that is free: a drop hangs by its
 * tip, so its body is above its point. */
export function clusterClearOf(
  cluster: MapCluster,
  from: { x: number; y: number } | null,
  gap: number = PIN_CONTROL,
  /** the picture's own box, so the push stays inside it (re-review, 14 September 2026): a group
   *  whose members sit beside a titled mark at the fit's inset edge used to be pushed straight
   *  off the picture, breaking `placementsInside`. With the box given, the push turns along the
   *  edge in 15° steps until a whole control fits a full gap away; when the box is too small for
   *  that, the straight push is clamped into it, which is the one case where the group and the
   *  titled mark share a finger, and it is deterministic. */
  box: { width: number; height: number } | null = null,
): MapCluster {
  if (!from) return cluster;
  const dx = cluster.x - from.x;
  const dy = cluster.y - from.y;
  const apart = Math.hypot(dx, dy);
  if (apart >= gap) return cluster;
  const angle = apart === 0 ? Math.PI / 2 : Math.atan2(dy, dx);
  const at = (theta: number): MapCluster => ({ ...cluster, x: from.x + Math.cos(theta) * gap, y: from.y + Math.sin(theta) * gap });
  if (!box) return at(angle);
  const half = PIN_CONTROL / 2;
  const inside = (point: { x: number; y: number }) =>
    point.x - half >= 0 && point.x + half <= box.width && point.y - half >= 0 && point.y + half <= box.height;
  for (let step = 0; step <= 12; step += 1) {
    for (const sign of step === 0 ? [1] : [1, -1]) {
      const turned = at(angle + sign * step * (Math.PI / 12));
      if (inside(turned)) return turned;
    }
  }
  const straight = at(angle);
  const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);
  return { ...straight, x: clamp(straight.x, half, Math.max(half, box.width - half)), y: clamp(straight.y, half, Math.max(half, box.height - half)) };
}

/** Proof helper: every control the grouping draws stands its own finger away from every other one
 *  — mark to mark, mark to group, group to group. This is «every control takes its own press»
 *  stated in arithmetic, where a fuzz can hold it over thousands of placement sets rather than
 *  over the five pictures a drive walks. */
export function groupingStandsApart(grouping: MapGrouping, radiusPx: number = PIN_CONTROL): boolean {
  const points: Array<{ x: number; y: number }> = [
    ...grouping.singles.map((single) => ({ x: single.x, y: single.y })),
    ...grouping.clusters.map((cluster) => ({ x: cluster.x, y: cluster.y })),
  ];
  for (let one = 0; one < points.length; one += 1) {
    for (let two = one + 1; two < points.length; two += 1) {
      if (Math.hypot(points[one].x - points[two].x, points[one].y - points[two].y) <= radiusPx) return false;
    }
  }
  return true;
}

/** Proof helper: the grouping holds every mark exactly once — the whole of «a cluster is a way of
 *  showing all of them, never a way of hiding some». */
export function groupingHolds(grouping: MapGrouping, placements: readonly MapPlacement[]): boolean {
  const held = [...grouping.singles.map((single) => single.id), ...grouping.clusters.flatMap((cluster) => cluster.members)];
  const once = new Set(held);
  return held.length === placements.length
    && once.size === placements.length
    && placements.every((placement) => once.has(placement.id));
}

/** Proof helper: every placement's 44px CONTROL stands inside the box the fit was measured
 *  against — the point alone proves nothing, because the thing a finger presses hangs above it. */
export function placementsInside(placements: readonly MapPlacement[], width: number, height: number): boolean {
  const half = PIN_CONTROL / 2;
  return placements.every((placement) =>
    placement.x - half >= -width / 2 && placement.x + half <= width / 2
    && placement.y - PIN_CONTROL >= -height / 2 && placement.y + half <= height / 2);
}

/** WHAT THE PICTURE HOLDS OF WHAT THE LIST COUNTS (FEED-IA §246).
 *
 * A customer whose address was typed rather than picked has a printable door and no coordinate, so
 * the heading can count a delivery the map has no mark for. The heading keeps counting deliveries,
 * because the deliveries are the work; this is the other two numbers, derived once, so the line
 * under the picture and the `data-pins` a drive reads can never disagree. `onMap + typed` is the
 * delivery count by construction. */
export type MapCoverage = { deliveries: number; onMap: number; typed: number };

export function mapCoverageOf(deliveries: number, onMap: number): MapCoverage {
  const held = Math.max(0, Math.min(Math.round(onMap), Math.round(deliveries)));
  return { deliveries: Math.max(0, Math.round(deliveries)), onMap: held, typed: Math.max(0, Math.round(deliveries)) - held };
}

/** Proof helper: every placement's control stands clear of the card over the box's top-left
 *  corner. Measured with the widest allowance a mark can take — 44px across, and a drop's whole
 *  body above its point — so a green answer holds for the drop as well as for the place mark. */
export function placementsClear(placements: readonly MapPlacement[], width: number, height: number, avoid: MapInset): boolean {
  const right = avoid.right - width / 2;
  const bottom = avoid.bottom - height / 2;
  const half = PIN_CONTROL / 2;
  return placements.every((placement) =>
    placement.x - half >= right || placement.y - PIN_CONTROL >= bottom);
}

/** WHAT A FINGER PRESSES, AND WHY IT IS THE GLYPH RATHER THAN A FIXED SQUARE (FEED-IA §246).
 *  A 44px control over an 8px dot covers its neighbours: pressing a mark that is plainly on the
 *  screen opened a different delivery, because the higher control of an earlier-sorted delivery
 *  owned the pixels. A mark's box is its own glyph now, floored so there is something to press,
 *  and the floor rises to the touch target where the pointer is coarse. */
export const MARK_HIT_FLOOR = 32;
export const markHitBox = (glyph: number, coarse = false): number =>
  Math.max(glyph, coarse ? PIN_CONTROL : MARK_HIT_FLOOR);

/* ── THE PAPER'S FOUR COUNTS ─────────────────────────────────────────────────────────────── */

export type PrintMeasures = {
  /** customers' orders on the run */
  deliveries: number;
  /** page-sets the printer is handed, truck dividers included */
  documents: number;
  /** of those documents, the ones that separate one truck from the next */
  dividers: number;
  copies: number;
  /** what comes out of the tray */
  sheets: number;
};

/** A document on the run, read structurally so `PrintOrder[]` satisfies it without this module
 *  importing the print queue. A truck divider carries the run kind it separates. */
export type MeasuredOrder = { subject: { kind: string; divider?: unknown } };

export const dividersIn = (orders: readonly MeasuredOrder[]): number =>
  orders.filter((order) => order.subject.kind === 'day' && Boolean(order.subject.divider)).length;

export function printMeasuresOf(input: { deliveries: number; documents: number; dividers: number; copies: number }): PrintMeasures {
  const copies = Math.max(1, Math.round(input.copies || 1));
  const documents = Math.max(0, Math.round(input.documents));
  const dividers = Math.max(0, Math.min(documents, Math.round(input.dividers)));
  return {
    deliveries: Math.max(0, Math.round(input.deliveries)),
    documents,
    dividers,
    copies,
    sheets: documents * copies,
  };
}

const countWords = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/** The head states each measure once, beside its own noun, and a measure speaks only where it
 *  differs from the one before it: a single-truck run at one copy is «5 deliveries» and nothing
 *  else, because its documents and its sheets are the same five things said twice. */
export function printMeasureWords(measures: PrintMeasures): string[] {
  return [
    countWords(measures.deliveries, 'delivery', 'deliveries'),
    measures.documents === measures.deliveries ? null : countWords(measures.documents, 'document'),
    measures.dividers > 0 ? countWords(measures.dividers, 'truck divider') : null,
    measures.copies > 1 ? countWords(measures.copies, 'copy', 'copies') : null,
    measures.sheets === measures.documents ? null : countWords(measures.sheets, 'sheet'),
  ].filter((word): word is string => word !== null);
}

/* ── WHAT A FILE WEIGHS ──────────────────────────────────────────────────────────────────── */

const byteFormatter = new Intl.NumberFormat('en-GB');

/** The size a person can check against their own downloads folder. Exact bytes are the truth, so
 *  they are always written; a kilobyte reading joins them once the exact number stops being
 *  readable at a glance. */
export function byteWords(bytes: number): string {
  const exact = byteFormatter.format(Math.max(0, Math.round(bytes)));
  if (bytes < 10_000) return `${exact} bytes`;
  return `${(bytes / 1000).toFixed(1)} kB · ${exact} bytes`;
}
