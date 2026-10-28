/* WHERE IT GOES — A PIN, ON A REAL MAP (FEED-IA §25)
 *
 * «The location has to be a PIN. Real map. Not some custom made map.»
 *
 * The drawn choropleth this replaces was real geometry — the official Catalan administrative
 * shapes, merged into the house's six runs — and it was still the wrong answer, because a
 * hand-coloured region tells a person which ZONE a drop belongs to and they already know that: it
 * is written on the row, on the chip, in the caption. What nobody can read off a coloured patch is
 * WHERE THE PLACE IS. That is a pin on the map everyone on earth already knows how to read.
 *
 * ═══ TWO QUESTIONS, TWO MODES ═══════════════════════════════════════════════════════════════════
 * ONE PLACE — «where is this customer?» — is a fixed sharp ground around one coordinate. It needs
 * no measurement, so a thumbnail and a Delivery Note's map draw it with no layout pass at all.
 *
 * A SET OF PLACES — «where does this batch go?» — is a box that holds every pin. «Make sure that
 * for all the addresses you actually come up with, they all show up on the map» (Peter,
 * 2026-09-10), and the delivery world is about 35 km across: at zoom 14 that is roughly 3,700 px,
 * so a sharp ground around the first customer dropped every other pin off the picture. The box is
 * measured (`ResizeObserver`), `mapFitOf` takes the sharpest checked-in zoom the marker bounds
 * still fit inside, and the ground is drawn for that box. Where the host draws a card over the
 * picture's corner it hands the fit that rectangle, and the marks are fitted into the room the
 * card leaves — a pin painted under an opaque card shows up for nobody. The arithmetic lives in
 * `print-measures.ts`, where a tool test can prove it without a screenshot.
 *
 * ═══ DENSE MARKS ARE ONE CONTROL WITH A COUNT ON IT (FEED-IA §247.8) ════════════════════════════
 * A hundred deliveries inside one city, drawn at a phone-sized zoom, is a smear of touching
 * glyphs: the fan answers orders at ONE coordinate and stops there, and past a handful the picture
 * says «somewhere around here» about everybody. Marks closer together than one finger (44px) are
 * grouped into a disc carrying their count. A cluster is a way of SHOWING all of them, never a way
 * of hiding some: the grouping is total, `data-markers` is every delivery the picture is about and
 * never moves for a group, and `data-drawn` and `data-clusters` let a drive add the controls back
 * up to it. Pressing a group narrows the picture to its members — `mapFitOf` again, on those marks
 * alone, which earns a sharper ground — and «Show all» puts the window back, as does browser Back.
 * A single mark is exactly what it always was: same testid, same press, same Delivery Note. The
 * room the picture has is what ends the narrowing: a group holding every mark this picture can
 * group states its count and hands the press on to the surface around the map, which on Prep is
 * the control that opens the delivery map screen — the picture with the height to open it.
 *
 * ═══ THE GROUND IS PICTURES OF THE WORLD, AND THE APP NEVER ASKS FOR ONE (§86.7) ════════════════
 * «the map, can we not use mapbox or some shit? and ensure we have the quota, don't want a bill
 * because of some accidental operation.»
 *
 * THE DEFAULT RUNTIME NEVER CALLS A METERED API, by construction rather than by care: this is a
 * grid of <img> pointing at `public/map/`, files that are in the repo. A document opened ten
 * thousand times costs nothing. `tools/build-map-tiles.py` draws the files, once, hard-capped, and
 * says what it spent.
 *
 * THE SECOND GROUND IS GOOGLE, and only where a key was configured for the build («can the maps
 * all be google maps?», Peter, 2026-09-11) AND the picture is one a person opened to look at: the
 * fitted map and a full-size captioned place map. A captionless thumbnail draws the files, always
 * — Prep mounts one per upcoming delivery, so the ground a thumbnail takes is multiplied by the
 * whole book, and one screen open asked Google for 129 pictures before that rule existed.
 * `google-ground.ts` owns the loader and the quota posture; every failure — a missing key, a
 * timeout, an over-quota answer — lands back on the files. Drives, CI and an offline review run
 * with no key, so they run on files.
 *
 * OUR OWN CONTROLS STAND ON BOTH GROUNDS. Google's markers carry Google's identity, which no drive
 * can read and no keyboard order can be stated about, so the marks are DOM controls in an
 * `OverlayView` pane: same testid, same `data-order-id`, same press, either ground.
 *
 * The cartography of the checked-in ground is POSITRON — the open light basemap — drawn from
 * OpenStreetMap data served by OpenFreeMap, which has no keys and no limits. Every hosted tile
 * service forbids keeping tiles (OSM's own policy bans prefetching; CARTO §9.c bans bulk download
 * and server-side caching; Mapbox §1.9 bans exporting, downloading, caching or storing map content
 * at all), so the ground is rendered from open parts instead of taken from a service. The tool's
 * header carries the reasoning in full; `docs/kit/LICENSES-AND-ATTRIBUTION.md` carries the licences.
 *
 * The credit is drawn under the picture, because that is what the licences ask and it is the
 * reader who has to see it. It is the FILES' credit, and it is drawn where the files are the
 * ground: Google renders its own attribution inside its own map, in its own words. A CAPTIONLESS
 * THUMBNAIL (§39.1) is 72px square and has no line to put it on, so the credit rides the control
 * that opens it — the square's own hover label — and that thumbnail is always the files, which is
 * what keeps the hover label true.
 *
 * ═══ IT STAYS IN THE INK DISCIPLINE ════════════════════════════════════════════════════════════
 * A street map inside a document panel is the loudest thing on the surface by a wide margin, and
 * it is the least important. Positron is already a quiet ground, so the wash is a single
 * `grayscale`: it takes the last hue off the water and the parks and leaves the values alone. The
 * only thing with weight on the picture is the pin, in ink. Nothing here carries the accent:
 * where a customer is, is a fact about the world, never something Rocoto did.
 *
 * No colour is hard-coded — the pin, its ring and the caption are theme tokens, and the wash is a
 * filter, which has no hue of its own. The tiles are the one thing on this surface that does not
 * re-theme, and they cannot: they are pictures.
 *
 * ═══ TWO PIXELS FOR ONE ════════════════════════════════════════════════════════════════════════
 * Each file is 512px square and is drawn at 256, so the map is as crisp on a retina screen as the
 * type beside it. The LAYOUT is untouched by that — the grid, the arithmetic and every box on the
 * page are still counted in 256pt tiles (§77.2: nothing may shift).
 *
 * A TILE THAT WAS NEVER DRAWN IS QUIET GROUND. The world the tool draws is bounded, so a map
 * pushed past its edge asks for a file that does not exist; the picture answers with the panel's
 * own ground rather than with a browser's broken-image mark.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { useStyletron } from 'baseui';
import {
  MAP_TILE, MAP_ZOOM_SHARPEST, MAP_ZOOM_WIDEST, PIN_CONTROL, clusterClearOf, clusterPlacementsOf,
  mapFitOf, markHitBox, markerPlacementsOf, placeFitOf,
  type LatLng, type MapCluster, type MapFit, type MapInset, type MapMarker, type MapPlacement,
} from './print-measures';
import {
  isGoogleGroundConfigured, loadGoogleMaps,
  type GoogleMap, type GoogleOverlayView,
} from './google-ground';
import { useHistoryLayer } from './navigation';

/** the zoom the checked-in tiles are sharpest at (`tools/build-map-tiles.py`) */
export const MAP_ZOOM = MAP_ZOOM_SHARPEST;

export type { MapInset };

/** THE CREDIT, in the words the licences ask for. OpenFreeMap's own wording is «OpenFreeMap ©
 *  OpenMapTiles Data from OpenStreetMap», of which the OpenFreeMap part is explicitly optional;
 *  what must be on the picture is the schema and the data. The full chain — ODbL, the Positron
 *  style, the host — is written out in `docs/kit/LICENSES-AND-ATTRIBUTION.md`. */
export const MAP_CREDIT = '© OpenStreetMap contributors · OpenMapTiles';

export type { LatLng };

const TILE = MAP_TILE;
/** tiles either side of the pin's own — three across is wider than the panel ever is */
const SPAN = 1;

type Ground = 'tiles' | 'google';

/* THE PIN. A drop with a hole in it — linework, one stroke, `currentColor`, so it takes the ink of
 * the figure it stands on and re-themes with everything else. The paper-coloured ring under it is
 * what keeps it legible over a dark block of buildings; it is the map's only halo and it is a
 * token, never a white.
 *
 * A PIN ON THE NEXT BATCH WEARS ONE EXTRA RING, in ink. Prep's picture carries two scopes at once
 * — the batch about to leave and everything upcoming behind it — and the ring is what tells them
 * apart without a second colour: where a customer is, is a fact about the world, so the accent
 * stays off this picture entirely. */
function Pin({ size = 30, batch = false }: { size?: number; batch?: boolean }) {
  const [, theme] = useStyletron();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {batch && (
        <circle
          cx="12"
          cy="9.3"
          r="7.4"
          fill="none"
          stroke={theme.colors.contentPrimary}
          strokeWidth="1.2"
          strokeDasharray="2.4 2"
        />
      )}
      <path
        d="M12 22.5c0 0-7.2-8-7.2-13A7.2 7.2 0 0 1 19.2 9.5c0 5-7.2 13-7.2 13z"
        fill={theme.colors.contentPrimary}
        stroke={theme.colors.backgroundPrimary}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.3" r="2.5" fill={theme.colors.backgroundPrimary} />
    </svg>
  );
}

/** A PLACE MARK — the quiet half of the vocabulary. It stands ON its point, in the same ink, with
 *  the same paper halo, and it is what an upcoming delivery gets so the batch's drops still read
 *  when four hundred of them share one city. */
function PlaceMark({ size = 10 }: { size?: number }) {
  const [, theme] = useStyletron();
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="6" cy="6" r="4.4" fill={theme.colors.contentPrimary} stroke={theme.colors.backgroundPrimary} strokeWidth="1.6" />
    </svg>
  );
}

/** A GROUP OF MARKS THAT SHARE A SPOT, AS ONE CONTROL WITH ITS OWN COUNT (FEED-IA §247.8).
 *
 * A disc in the same ink as the pin and the place mark, on the same paper halo, with the number of
 * deliveries standing on it. It is the size of the touch target, because the thing it answers is
 * marks a finger cannot tell apart. A group that holds a delivery from the batch about to leave
 * wears the batch's own dashed ring, so the picture keeps its two scopes after the grouping. */
function ClusterMark({ count, batch, size = PIN_CONTROL }: { count: number; batch: boolean; size?: number }) {
  const [, theme] = useStyletron();
  return (
    <span style={{ position: 'relative', display: 'grid', placeItems: 'center', width: `${size}px`, height: `${size}px` }}>
      <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
        {batch && (
          <circle cx="22" cy="22" r="20.4" fill="none" stroke={theme.colors.contentPrimary} strokeWidth="1.2" strokeDasharray="2.4 2" />
        )}
        <circle cx="22" cy="22" r="17" fill={theme.colors.contentPrimary} stroke={theme.colors.backgroundPrimary} strokeWidth="1.6" />
      </svg>
      <span style={{ position: 'relative', ...theme.typography.LabelSmall, color: theme.colors.backgroundPrimary, fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </span>
    </span>
  );
}

/** BROWSER BACK UNDOES THE NARROWING, THE WAY EVERY OTHER READ LAYER IN CEDAR IS UNDONE.
 *
 * Opening a group is a place a person went, so it earns one Back step — and it is the INNERMOST
 * layer, so on the map screen Back shows all the marks again and the Back after it closes the
 * screen, which is the screen's own rule (`export:prep-map` in `shell/printing.tsx`). The layer is
 * named after the picture it belongs to, so Prep's own map and the map screen opened over it hold
 * two separate steps rather than one shared one. Mounted only for a picture that has marks, which
 * keeps a row's thumbnail at one render and no listener. */
function MapFocusLayer({ id, focus, onRestore }: {
  id: string;
  focus: readonly string[] | null;
  onRestore: (members: string[] | null) => void;
}) {
  useHistoryLayer({
    id,
    active: focus !== null,
    snapshot: { members: focus ? focus.join(',') : null },
    onRestore: (snapshot) => {
      const held = snapshot && typeof snapshot.members === 'string'
        ? snapshot.members.split(',').filter(Boolean)
        : null;
      onRestore(held && held.length > 1 ? held : null);
    },
  });
  return null;
}

/** One picture of the world. A file that was never drawn leaves the panel's own ground showing. */
function Tile({ zoom, x, y, left, top }: { zoom: number; x: number; y: number; left: number; top: number }) {
  const [gone, setGone] = React.useState(false);
  if (gone) return null;
  return (
    <img
      src={`/map/${zoom}/${x}/${y}.png`}
      alt=""
      width={TILE}
      height={TILE}
      loading="lazy"
      onError={() => setGone(true)}
      style={{ position: 'absolute', left: `calc(50% + ${left}px)`, top: `calc(50% + ${top}px)`, width: TILE, height: TILE, display: 'block' }}
    />
  );
}

/** THE BOX, MEASURED. Only the fitting mode needs it, so the single-place ground keeps its
 *  no-layout-pass promise and a thumbnail costs one render. */
function useBoxSize(active: boolean): [React.RefObject<HTMLDivElement>, { width: number; height: number }] {
  const box = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    const node = box.current;
    if (!active || !node || typeof ResizeObserver === 'undefined') return undefined;
    const read = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);
  return [box, size];
}

/** GOOGLE'S GROUND, AND OUR OWN CONTROLS ON IT (FEED-IA §246 · §247).
 *
 * It mounts only for a picture a person opened — the fitted preparation map and a full-size
 * captioned place map — so a screen open costs at most one map load, and it hands the picture back
 * to the files the moment anything about it fails.
 *
 * THE MARKS ARE OURS ON BOTH GROUNDS. `google.maps.Marker` draws Google's object: no testid, no
 * `data-order-id`, nothing a drive can read and nothing a keyboard order can be stated about — so
 * the ground a key switches on would have quietly dropped the contract «a pin opens the same
 * Delivery Note as its list row». An `OverlayView` gives back a pane and a projection instead, the
 * app portals the SAME controls into that pane, and the two grounds are one behaviour.
 *
 * THE VIEWPORT IS OURS TOO. `mapFitOf` already measures a 256-pixel Mercator ground, which is what
 * Google draws, so the centre and the zoom are handed over rather than recomputed with
 * `fitBounds` — the same picture, the same pins, on either ground. */
function GoogleGround({ fit, markers, marks, onFail }: {
  fit: MapFit;
  markers: readonly MapMarker[];
  /** the controls, placed at the points the projection gives back */
  marks: (points: Record<string, { x: number; y: number }>) => React.ReactNode;
  onFail: () => void;
}) {
  const host = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<GoogleMap | null>(null);
  const overlay = React.useRef<GoogleOverlayView | null>(null);
  const [pane, setPane] = React.useState<HTMLDivElement | null>(null);
  const [points, setPoints] = React.useState<Record<string, { x: number; y: number }>>({});
  const held = React.useRef(markers);
  held.current = markers;
  const start = React.useRef(fit);
  start.current = fit;

  /* ONE MAP INSTANCE FOR AS LONG AS THIS PICTURE IS OPEN. A resize re-measures the fit, and a map
     rebuilt on every measurement would be a second load for a box that grew by a pixel. */
  React.useEffect(() => {
    let live = true;
    const layer = document.createElement('div');
    layer.style.position = 'absolute';
    layer.style.left = '0';
    layer.style.top = '0';
    void loadGoogleMaps().then((api) => {
      if (!live) return;
      if (!api || !host.current) { onFail(); return; }
      try {
        map.current = new api.Map(host.current, {
          center: start.current.centre,
          zoom: start.current.zoom,
          /* The picture answers one question and takes no gesture: there is no engine to hijack a
             scroll, exactly as the checked-in ground promises. */
          gestureHandling: 'none',
          keyboardShortcuts: false,
          disableDefaultUI: true,
          clickableIcons: false,
          styles: [{ featureType: 'all', elementType: 'all', stylers: [{ saturation: -100 }] }],
        });
        const drawn = new api.OverlayView();
        drawn.onAdd = () => { drawn.getPanes()?.overlayMouseTarget.appendChild(layer); setPane(layer); };
        drawn.draw = () => {
          const projection = drawn.getProjection();
          if (!projection) return;
          const next: Record<string, { x: number; y: number }> = {};
          for (const marker of held.current) {
            const at = projection.fromLatLngToDivPixel(marker.at);
            if (at) next[marker.id] = { x: at.x, y: at.y };
          }
          setPoints(next);
        };
        drawn.onRemove = () => { layer.remove(); setPane(null); };
        drawn.setMap(map.current);
        overlay.current = drawn;
      } catch { onFail(); }
    });
    return () => {
      live = false;
      overlay.current?.setMap(null);
      overlay.current = null;
      map.current = null;
      layer.remove();
    };
  }, [onFail]);

  /* A re-measured box moves the picture rather than rebuilding it. */
  React.useEffect(() => {
    map.current?.setCenter(fit.centre);
    map.current?.setZoom(fit.zoom);
  }, [fit.centre.lat, fit.centre.lng, fit.zoom]);

  return <>
    <div ref={host} data-testid="map-google-ground" style={{ position: 'absolute', inset: 0, filter: 'grayscale(1)' }} />
    {pane && createPortal(marks(points), pane)}
  </>;
}

export default function PinMap({
  at,
  /** what the house calls the run this place sits on */
  zone,
  truck,
  /** the one line of context under the map: who, and which day */
  note,
  height = 168,
  /** THE THUMBNAIL HAS NO CAPTION (FEED-IA §39.1). At 72px square in a document's head the words
   *  ride the hover and the aria instead: a picture that small with a line of type under it is a
   *  figure, and a figure in a header is one object too many. */
  caption = true,
  /** the pin scales with the picture — a 30px drop on a 72px square is half the square */
  pin = 30,
  markers,
  drop,
  avoid,
  describedBy,
  onMarkerClick,
}: {
  at?: LatLng;
  zone?: string;
  truck?: number;
  note?: React.ReactNode;
  height?: number;
  caption?: boolean;
  pin?: number;
  /** Every order on this picture. Their ids stay on the controls so a map press opens the same
   * order as its list row. Equal coordinates receive stable offsets and remain separately
   * selectable, and the picture is fitted to hold all of them. */
  markers?: Array<{ id: string; at: LatLng; label: string; batch?: boolean }>;
  /** THE ORDER THIS PICTURE IS ABOUT. A map opened from one delivery's row is titled after that
   *  customer, so that customer wears the drop, stands on top of everything and is what the eye
   *  lands on — the title and the picture answer the same question. */
  drop?: string;
  /** a card the host draws over the picture's top-left corner; the fit keeps every mark clear of it */
  avoid?: MapInset;
  /** THE LIST IS THE KEYBOARD PATH (FEED-IA §246). The marks are pointer targets and stand outside
   *  the tab order, so the group points at the list that carries the same deliveries. */
  describedBy?: string;
  onMarkerClick?: (id: string) => void;
}) {
  const [css, theme] = useStyletron();
  const fitting = (markers?.length ?? 0) > 0;
  const [box, size] = useBoxSize(fitting);
  const [googleFailed, setGoogleFailed] = React.useState(false);
  const onFail = React.useCallback(() => setGoogleFailed(true), []);
  const all = React.useMemo(() => markers ?? [], [markers]);

  /* THE GROUP A PERSON OPENED (FEED-IA §247.8). Pressing a cluster narrows the picture to that
     group's members: the fit is measured again for those marks alone, which earns a sharper
     ground, and «Show all» puts the whole window back. The narrowing is the picture's own state
     rather than the host's, so every surface that draws a fitted map gets it for free.

     A NARROWING THAT NAMES NOTHING IS NO NARROWING. A window that moved on — a batch that left,
     a delivery whose day rolled past — can leave a held group with one member or none, and a
     picture of one mark with a «Show all» over it answers no question. Fewer than two members
     standing puts the whole window back, in the render and in the state. */
  const [focus, setFocus] = React.useState<string[] | null>(null);
  /* AND THE DELIVERY THE PICTURE IS TITLED AFTER STAYS ON IT. The narrowed set is the group's
     members plus that one mark, so a screen headed «Distribucions Llorens» still has Llorens
     standing while a group beside it is open: a picture that dropped its own subject would answer
     a different question from its heading, which is the same rule that keeps that mark out of
     every group. It is one more point for the fit to hold, which is what it costs. */
  const shown = React.useMemo(() => {
    if (!focus) return all;
    const wanted = new Set(focus);
    if (drop) wanted.add(drop);
    const narrowed = all.filter((marker) => wanted.has(marker.id));
    return narrowed.length > 1 ? narrowed : all;
  }, [all, focus, drop]);
  React.useEffect(() => {
    if (!focus) return;
    const held = new Set(all.map((marker) => marker.id));
    if (focus.filter((id) => held.has(id)).length < 2) setFocus(null);
  }, [all, focus]);

  /* THE BOX, BEFORE IT HAS BEEN MEASURED. A first render with a zero-width box would pick the
     widest ground and then jump; the panel's own stated height and a sensible column width give
     the first frame a picture that is already close, and the observer settles it. */
  const width = size.width || (fitting ? 360 : TILE * (SPAN * 2 + 1));
  const boxHeight = size.height || height;

  const fit = React.useMemo(() => (fitting
    ? mapFitOf({ markers: shown, width, height: boxHeight, avoid, minZoom: MAP_ZOOM_WIDEST, maxZoom: MAP_ZOOM_SHARPEST })
    : at ? placeFitOf(at, MAP_ZOOM_SHARPEST, SPAN) : null),
  [fitting, shown, width, boxHeight, avoid, at]);

  if (!fit) return null;

  /* WHERE GOOGLE EARNS ITS LOAD (FEED-IA §247). A picture a person opened to look at — the fitted
     map, or a full-size captioned place map — may ask Google for its ground. A captionless
     thumbnail may never: Prep mounts one per upcoming delivery, and that is how one screen open
     came to ask Google for 129 pictures. Those draw the checked-in files, always. */
  const ground: Ground = isGoogleGroundConfigured() && !googleFailed && (fitting || caption) ? 'google' : 'tiles';
  const placements = markerPlacementsOf(shown, fit);
  const where = [zone, truck !== undefined ? `truck ${truck}` : null].filter(Boolean).join(' · ');

  /* DENSE MARKS COLLAPSE INTO COUNTED GROUPS (FEED-IA §247.8). «Make sure that for all the
     addresses you actually come up with, they all show up on the map» — a cluster is a way of
     showing all of them, so the grouping is total and the figure states both counts.

     THE ORDER THE PICTURE IS TITLED AFTER NEVER JOINS A GROUP. The map screen is titled after one
     customer and that customer wears the drop, so it stands alone whatever else is around it: a
     picture whose own subject had been swallowed into a count would answer a different question
     from its heading.

     ⚠ THE SHARPEST GROUND IS WHERE THE LAST OVERLAP LIVED. The first cut drew no group at zoom 14
     — the ground the files stop at — on the reasoning that marks still sharing a spot there are
     the fan's work. Measured on 2026-09-14 at 1600: the end of that narrowing was 19 marks at
     zoom 14 with EIGHT of them under a neighbour's control, and they were different customers
     100 to 200 m apart, which at zoom 14 is 20 to 30 px — a distance the fan never answers, since
     the fan is about orders at ONE coordinate. So the grouping runs at every ground. What changes
     at the sharpest one is the press rather than the drawing: no refit can sharpen zoom 14, so a
     group there is one to read rather than one to open.

     ⚠ AND A GROUP IS NEVER TAKEN APART INTO MARKS THE PICTURE CANNOT DRAW. The first cut also
     ended the narrowing by drawing a group's members as marks once the refit made one group of
     them; measured the same day, two presses on Prep's own picture at 390 ended at 270 marks at
     zoom 9, 265 of which had another mark over their centre — the smear this whole section exists
     to close, one press further in. The room a picture has is what bounds the narrowing: a group
     that holds every mark the picture can group is a group THIS picture cannot open, so it states
     its count and hands the press on. Prep draws its map inside a control that opens the delivery
     map screen, which has more than twice the height and no card over it, so that is where the
     press lands and that is where those deliveries come apart. */
  const byId = new Map(placements.map((placement) => [placement.id, placement]));
  const dropAt = drop ? byId.get(drop) ?? null : null;
  const groupable = placements.filter((placement) => placement.id !== drop);
  /* AND THE GROUPS STAND CLEAR OF THAT MARK, so the picture's own subject and the count beside it
     each take a press. The clearing is handed to the grouping rather than applied after it, so the
     point the settle loop holds apart from the marks and from the other groups is the one that
     ends up drawn: pushing a group off the drop AFTERWARDS moved it 44 px in whatever direction
     the drop happened to lie, and over 400,000 random pairs that landed two counts 2.7 px apart. */
  const grouping = fitting
    ? clusterPlacementsOf(groupable, PIN_CONTROL, dropAt, size)
    : { singles: groupable, clusters: [] as MapCluster[] };
  const closed = fit.zoom >= MAP_ZOOM_SHARPEST
    || (grouping.clusters.length === 1 && grouping.singles.length === 0);
  const clusters = grouping.clusters;
  const alone = new Set(grouping.singles.map((single) => single.id));
  const singles = clusters.length === 0
    ? placements
    : placements.filter((placement) => placement.id === drop || alone.has(placement.id));

  /* WHAT A FINGER PRESSES IS THE MARK ITSELF (FEED-IA §246). Every mark used to carry a 44px
     control over an 8px dot, so the higher control of an earlier-sorted delivery covered its
     neighbours' visible marks and a press opened a different customer. A control's box is its own
     glyph now, floored at 32px so there is something to press, and at the touch target where the
     pointer is coarse. */
  const placeGlyph = Math.max(7, Math.round(pin * 0.36));
  const markClass = (placement: MapPlacement) => {
    const glyph = placement.batch || placement.id === drop ? pin : placeGlyph;
    const fine = `${markHitBox(glyph)}px`;
    const coarse = `${markHitBox(glyph, true)}px`;
    return css({
      position: 'absolute', padding: 0, borderWidth: 0, borderStyle: 'none',
      background: 'transparent', color: theme.colors.contentPrimary, cursor: 'pointer',
      display: 'grid', width: fine, height: fine,
      '@media (pointer: coarse)': { width: coarse, height: coarse },
    });
  };

  /* TWO WEIGHTS, ONE INK (FEED-IA §246). The picture carries two scopes at once — the batch about
     to leave and the window behind it — and a hundred identical drops is a smear rather than a
     map. The batch wears the drop; everything upcoming is a place mark, which is what a map has
     always used for «a thing is here». One ink, two weights, no second colour.
     THE SOONEST DELIVERY IS ON TOP, and the order this picture is about is above even that. */
  const mark = (placement: MapPlacement, left: string, top: string) => {
    const opened = placement.id === drop;
    const drawn = placement.batch || opened;
    return <button
      key={placement.id}
      type="button"
      data-testid={`map-order-${placement.id}`}
      data-order-id={placement.id}
      data-batch={placement.batch ? 'true' : 'false'}
      data-drop={opened ? 'true' : 'false'}
      /* POINTER TARGET, OUTSIDE THE TAB ORDER (FEED-IA §246). Four hundred marks ahead of Print
         and Download is four hundred presses of Tab to reach the act; the rows carry the same
         deliveries and open the same Delivery Note, so they are the keyboard path and the group
         above says so. */
      tabIndex={-1}
      aria-label={`Open ${placement.label ?? placement.id}`}
      onClick={(event) => { event.stopPropagation(); onMarkerClick?.(placement.id); }}
      className={markClass(placement)}
      style={{
        left, top,
        /* THE PICTURE'S OWN SUBJECT STANDS ABOVE EVERY GROUP (FEED-IA §247.8), so the mark the
           heading names is the one a finger reaches where a count is drawn beside it. */
        zIndex: opened ? placements.length + 2 : placements.length - placement.index,
        transform: drawn ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)',
        placeItems: drawn ? 'end center' : 'center',
      }}
    >{drawn ? <Pin size={pin} batch={placement.batch || opened} /> : <PlaceMark size={placeGlyph} />}</button>;
  };

  /* A GROUP IS ONE CONTROL, AND IT IS A POINTER TARGET LIKE THE MARKS IT HOLDS. The rows are still
     the keyboard path — the list carries every delivery a group holds — so a group takes a press
     and stays out of the tab order, and it says in words what the count says in a numeral.
     THE STACK, TOP DOWN: the mark the picture is titled after, then the groups, then the marks
     that stand alone, soonest first. A group is above those marks because it is drawn where they
     are — and no mark is ever UNDER one, because `clusterPlacementsOf` claims a mark the control
     would cover and `clusterClearOf` pushes a group off the picture's own subject. */
  const clusterClass = css({
    position: 'absolute', padding: 0, borderWidth: 0, borderStyle: 'none',
    background: 'transparent', color: theme.colors.contentPrimary, cursor: 'pointer',
    display: 'grid', placeItems: 'center',
    width: `${PIN_CONTROL}px`, height: `${PIN_CONTROL}px`,
  });
  const clusterMark = (cluster: MapCluster, place: number, left: string, top: string) => (
    <button
      key={`cluster:${cluster.id}`}
      type="button"
      data-testid={`map-cluster-${place}`}
      data-members={cluster.members.join(',')}
      /* WHETHER THIS PICTURE HAS ROOM TO OPEN IT. A group holding every mark the picture can group
         — and every group at the sharpest ground, which no refit can sharpen — is the end of the
         narrowing here, so its press goes on to the surface around the map: Prep's picture is
         inside the control that opens the delivery map screen, which is the picture with the room.
         Published, so a drive can walk the narrowing to its end. */
      data-opens={closed ? 'false' : 'true'}
      tabIndex={-1}
      aria-label={`${cluster.members.length} deliveries here`}
      onClick={closed ? undefined : (event) => { event.stopPropagation(); setFocus(cluster.members); }}
      className={clusterClass}
      style={{ left, top, zIndex: placements.length + 1, transform: 'translate(-50%, -50%)' }}
    >
      <ClusterMark count={cluster.members.length} batch={cluster.batch} />
    </button>
  );

  /* THE WAY BACK OUT OF A GROUP. One control, the touch target's own height, drawn only while the
     picture is narrowed.
     ⚠ IT STANDS IN THE TOP BAND, AND THE OTHER TWO EDGES ARE TAKEN. The bottom of Prep's picture
     is where the delivery card rides — a bottom-anchored control was photographed half underneath
     it at 390 — and the band under the clock card is where the fit puts the MARKS, because the
     card's rectangle is the one thing the fit is told to keep them out of. What is left is the
     strip beside that card, at the top of the picture, which holds no mark at any width.
     ⚠ AND IT IS AS WIDE AS THAT STRIP, NEVER WIDER. At 320 the card is 188 px of a 288 px box, so
     a control sized to its own words reached back under it and the card, drawn above, clipped it
     (photographed). `avoid.right` is the card's own edge, so the control is capped at the room the
     card leaves and its two words wrap inside it; with no card it is one line at its own width. */
  const showAll = focus !== null && <button
    type="button"
    data-testid="map-cluster-back"
    onClick={(event) => { event.stopPropagation(); setFocus(null); }}
    className={css({
      position: 'absolute',
      right: theme.sizing.scale400,
      top: theme.sizing.scale400,
      zIndex: placements.length + 3,
      display: 'grid',
      placeItems: 'center',
      minWidth: '44px',
      minHeight: '44px',
      maxWidth: avoid ? `calc(100% - ${avoid.right + 24}px)` : undefined,
      paddingTop: theme.sizing.scale200,
      paddingBottom: theme.sizing.scale200,
      paddingLeft: theme.sizing.scale300,
      paddingRight: theme.sizing.scale300,
      borderWidth: 0,
      borderStyle: 'none',
      borderRadius: theme.borders.radius300,
      backgroundColor: theme.colors.backgroundPrimary,
      color: theme.colors.contentPrimary,
      boxShadow: theme.lighting.shadow500,
      cursor: 'pointer',
      textAlign: 'center',
      ...theme.typography.LabelSmall,
    })}
  >Show all</button>;

  return (
    <figure
      data-testid="pin-map"
      data-at={fitting ? `${fit.centre.lat.toFixed(4)},${fit.centre.lng.toFixed(4)}` : `${fit.centre.lat},${fit.centre.lng}`}
      data-zoom={fit.zoom}
      data-fit={fitting ? 'bounds' : 'place'}
      /* THE ONE FIT FACT THE PICTURE USED TO KEEP TO ITSELF (FEED-IA §246). `fitted` is false when
         no arm of the L the card leaves could hold the marker bounds even at the widest ground, so
         the fit falls back to the whole box and paints marks under the card again — the defect this
         package closed, returning silently. A copy change that adds one line to that card is enough
         to flip it, and nothing outside the English drive could see it. It is published, so every
         width and every language can be asked. */
      data-fitted={fit.fitted ? 'true' : 'false'}
      data-ground={ground}
      /* WHAT THE PICTURE IS ABOUT, AND WHAT IT IS DRAWING (FEED-IA §247.8). `data-markers` is every
         delivery the picture holds and it never moves for a group — a cluster is a way of showing
         all of them. `data-drawn` is the set on the picture right now, which is the same number
         until a group is opened and the deliveries of that group after it. `data-clusters` is how
         many of the controls are groups, so `data-drawn` = singles + every group's members is a
         sum a drive can take. */
      data-markers={all.length}
      data-drawn={shown.length}
      data-clusters={clusters.length}
      style={{
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        borderRadius: caption ? theme.borders.radius300 : 0,
        border: caption ? `1px solid ${theme.colors.borderOpaque}` : 'none',
        background: theme.colors.backgroundPrimary,
        overflow: 'hidden',
        height: caption ? undefined : '100%',
      }}
    >
      <div
        ref={box}
        role={placements.length ? 'group' : 'img'}
        aria-label={placements.length ? `Delivery orders on the map · ${placements.length}` : where ? `The drop, on ${where}` : 'The drop, on the map'}
        aria-describedby={placements.length ? describedBy : undefined}
        style={{
          position: 'relative',
          height,
          overflow: 'hidden',
          background: theme.colors.backgroundSecondary,
        }}
      >
        {/* THE GROUND. Pinned to the box's centre and pulled back by the fit's own offsets, so the
            box's middle is the fit's middle whatever width the panel is. Nothing here takes a
            pointer: there is no map engine to hijack a scroll on the checked-in ground, and
            Google's own is mounted with its gestures switched off. */}
        {ground === 'google' ? (
          <GoogleGround
            fit={fit}
            markers={shown}
            /* THE SAME CONTROLS ON THE SAME POINTS. Google projects the markers, and a group stands
               at the mean of its own members' projected points — the same rule the checked-in
               ground takes, so the two grounds draw one picture with one set of testids.
               ⚠ AND IT IS PUSHED OFF THE TITLED MARK ON THIS GROUND TOO. The mean was taken here
               and the clearing was left behind with the tile placements, so on 2026-09-14 a count
               on Google's pane stood 9 px from the drop it was drawn beside and took no press at
               320 — on the ground the published build actually uses. `clusterClearOf` runs on the
               projected point, which is the point this pane draws. Google projects the same
               Mercator at the same zoom, so its points are the tile placements moved by one
               constant: the same mean, the same push, the same answer the settle loop already
               held a finger away from every other control. */
            marks={(points) => {
              const droppedAt = drop && dropAt && points[drop]
                ? { x: points[drop].x + dropAt.fanX, y: points[drop].y + dropAt.fanY }
                : null;
              return <>
                {clusters.map((cluster, place) => {
                  const held = cluster.members
                    .map((id) => ({ point: points[id], placement: byId.get(id) }))
                    .filter((one): one is { point: { x: number; y: number }; placement: MapPlacement } => Boolean(one.point && one.placement));
                  if (held.length === 0) return null;
                  const x = held.reduce((sum, one) => sum + one.point.x + one.placement.fanX, 0) / held.length;
                  const y = held.reduce((sum, one) => sum + one.point.y + one.placement.fanY, 0) / held.length;
                  const clear = clusterClearOf({ ...cluster, x, y }, droppedAt, PIN_CONTROL, size);
                  return clusterMark(cluster, place, `${clear.x}px`, `${clear.y}px`);
                })}
                {singles.map((placement) => {
                  const at = points[placement.id];
                  return at ? mark(placement, `${at.x + placement.fanX}px`, `${at.y + placement.fanY}px`) : null;
                })}
              </>;
            }}
            onFail={onFail}
          />
        ) : (
          <div
            aria-hidden="true"
            data-testid="map-tile-ground"
            style={{
              position: 'absolute',
              inset: 0,
              /* A STREET MAP IS THE LOUDEST THING ON A PAGE AND THE LEAST IMPORTANT THING ON THIS
                 ONE. Positron arrives as a ground already; this takes the last hue off it, so the
                 pin is the only weight on the picture. */
              filter: 'grayscale(1)',
              pointerEvents: 'none',
            }}
          >
            {fit.tiles.map((tile) => (
              <Tile key={`${tile.x}:${tile.y}`} zoom={fit.zoom} x={tile.x} y={tile.y} left={tile.left} top={tile.top} />
            ))}
          </div>
        )}

        {/* THE PIN, DEAD CENTRE. Its point is what marks the spot, so it hangs by its tip. */}
        {placements.length === 0 && <span
          data-testid="pin"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
          }}
        >
          <Pin size={pin} />
        </span>}
        {ground !== 'google' && clusters.map((cluster, place) =>
          clusterMark(cluster, place, `calc(50% + ${cluster.x}px)`, `calc(50% + ${cluster.y}px)`))}
        {ground !== 'google' && singles.map((placement) =>
          mark(placement, `calc(50% + ${placement.x}px)`, `calc(50% + ${placement.y}px)`))}
        {showAll}
        {fitting && <MapFocusLayer id={`map:cluster:${drop ?? 'window'}`} focus={focus} onRestore={setFocus} />}

      </div>

      {/* THE CAPTION, AND THE CREDIT AT THE END OF IT. The credit rode the picture at first, in a
          paper chip over the tiles, and a white block in the corner of a washed-back map is the
          second-loudest thing on it — a licence notice competing with the pin. It belongs on the
          line under the map, which is where a caption's provenance has always gone: visible,
          adjacent, honest, and quiet enough that the picture keeps exactly one thing on it. */}
      {caption && (
      <figcaption
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.sizing.scale300,
          flexWrap: 'wrap',
          padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`,
          borderTop: `1px solid ${theme.colors.borderOpaque}`,
          minWidth: 0,
        }}
      >
        {where && <span style={theme.typography.LabelSmall}>{where}</span>}
        {note && (
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
            {note}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }} />
        {/* THE CREDIT NAMES THE GROUND IT IS ABOUT, so it is drawn for the files alone: Google's
            map renders Google's own attribution inside the picture, in Google's own words, and a
            second credit under it would be one licence notice written twice. */}
        {ground === 'tiles' && <span
          data-testid="map-credit"
          style={{
            ...theme.typography.LabelXSmall,
            color: theme.colors.contentTertiary,
            whiteSpace: 'nowrap',
          }}
        >
          {MAP_CREDIT}
        </span>}
      </figcaption>
      )}
    </figure>
  );
}
