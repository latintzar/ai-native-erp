/// <reference path="../../build-constants.d.ts" />
/* THE SECOND GROUND — Google's map, when a key is configured for this build.
 *
 * «can the maps all be google maps?» (Peter, 2026-09-11). Yes, and with the quota answer that
 * §86.7 has always demanded attached to it: «ensure we have the quota, don't want a bill because
 * of some accidental operation».
 *
 * ═══ TWO GROUNDS, ONE PICTURE ═══════════════════════════════════════════════════════════════
 * · GOOGLE, when `VITE_GOOGLE_MAPS_KEY` reached the build, and ONLY for a map a person opened to
 *   look at: the fitted preparation picture and a full-size captioned place map. One Maps
 *   JavaScript instance each, while it is open.
 * · THE CHECKED-IN TILES otherwise, and whenever Google fails, times out or answers over quota.
 *   They are files in `public/map/`, so they cost nothing and cannot be made to.
 *
 * ═══ THE STATIC MAPS API IS USED NOWHERE, BY CONSTRUCTION ═══════════════════════════════════
 * It was, for one build, and the meter said what that costs: a Prep screen mounts one thumbnail
 * per upcoming delivery, so a single open asked Google for 129 still pictures before anybody
 * scrolled — measured, at 390. A picture that a person did not ask for may never cost money, so
 * every thumbnail and every captionless small map draws the checked-in files and this module has
 * no still-picture road left in it to take.
 *
 * THE TILE GROUND STAYS THE TRUTH FOR EVERY PROOF. Drives, CI and an offline review run without a
 * key, so they run on files: a browser proof is never at the mercy of a provider's uptime, and a
 * screenshot taken today and one taken in a year are the same picture.
 *
 * ═══ THE QUOTA POSTURE ══════════════════════════════════════════════════════════════════════
 * A Maps browser key is PUBLIC BY DESIGN — it travels in the page and Google's own guidance is to
 * fence it rather than hide it. The fence is three things, and they belong to the account rather
 * than to this file: an HTTP-referrer restriction to the published host, an API restriction to
 * Maps JavaScript alone, and a daily quota cap. This file adds the fourth and the page adds the
 * fifth: the API is loaded ONCE per page, on demand, with a timeout, every failure lands on the
 * free ground, and the only pictures that may reach for it are the ones a person opened.
 *
 * WHAT THAT COSTS, EXACTLY: ONE MAPS JAVASCRIPT LOAD PER PICTURE A PERSON OPENS; AT MOST THREE
 * PICTURES STAND OPEN AT ONCE (Prep, a row's map screen, a Delivery Note). The `<script>` itself is
 * fetched once per page — the singleton below — but each open picture builds its own
 * `new api.Map`, and that is the metered unit. So a person walking N delivery rows opens N map
 * screens and spends N loads, one at a time, three standing at the most; the whole upcoming book
 * on one screen still spends ONE, because a thumbnail draws the files.
 * `drives/drive-cedar-print-workflow.py` counts `new api.Map` against a stubbed API and asserts
 * both numbers: three open, then two once the note is closed.
 *
 * ═══ WHY THE KEY IS A BUILD CONSTANT ════════════════════════════════════════════════════════
 * `src/` never reads `import.meta.env`, because the tool tests compile app modules for Node where
 * `import.meta` is a compile error (`tools/build-constants.mjs` holds the whole reasoning). So the
 * key arrives the way the PostHog key arrives, and a build without one leaves this module inert.
 */

/** A browser proof may name a key here to exercise this path; a published page uses the constant
 *  its build was given. Stated as one seam rather than discovered as a surprise. */
type MapsWindow = Window & {
  __ROCOTO_MAPS_KEY__?: string;
  google?: { maps?: GoogleMapsLoader };
  gm_authFailure?: () => void;
  /** Google's own ready signal for `loading=async`: named in the script URL as `callback` */
  __rocotoMapsReady?: () => void;
};

/** WHAT THE SCRIPT TAG PUTS ON THE PAGE, WHICH IS NOT YET A MAP (FEED-IA §247). Under
 *  `loading=async` Google's own guidance is that `google.maps` arrives as a LOADER: the
 *  constructors are attached by `importLibrary`, and a caller that reads `Map` at `script.onload`
 *  may read `undefined`. Typing that moment honestly is what makes the compiler refuse the
 *  assumption. */
type GoogleMapsLoader = Partial<GoogleMapsApi> & {
  importLibrary?: (name: string) => Promise<unknown>;
};

/** Only the surface this app uses. The full typings are a dependency the prototype has yet to
 *  earn, and a hand-written slice keeps the compile honest about what is actually called. */
export type GoogleMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  /** THE SEAM OUR OWN MARKS STAND ON. `google.maps.Marker` draws Google's object with Google's
   *  identity, which a drive cannot read and a keyboard cannot reach. An `OverlayView` hands back
   *  a pane and a projection instead, so the controls on Google's ground are the same DOM controls
   *  the checked-in ground draws — same testid, same `data-order-id`, same press. */
  OverlayView: new () => GoogleOverlayView;
};
export type GoogleMap = {
  setCenter: (position: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};
/** The panes an overlay may draw into. `overlayMouseTarget` is the one that takes a press. */
export type GooglePanes = { overlayMouseTarget: HTMLElement };
export type GoogleProjection = {
  fromLatLngToDivPixel: (position: { lat: number; lng: number }) => { x: number; y: number } | null;
};
export type GoogleOverlayView = {
  setMap: (map: GoogleMap | null) => void;
  getPanes: () => GooglePanes | null;
  getProjection: () => GoogleProjection | null;
  /** Google calls these on the instance, so the app assigns them there. */
  onAdd?: () => void;
  draw?: () => void;
  onRemove?: () => void;
};

const buildKey = typeof __GOOGLE_MAPS_KEY__ === 'string' ? __GOOGLE_MAPS_KEY__ : '';

/** The key this page will use, build constant first. */
export function googleMapsKey(): string {
  if (buildKey) return buildKey;
  if (typeof window === 'undefined') return '';
  const named = (window as MapsWindow).__ROCOTO_MAPS_KEY__;
  return typeof named === 'string' ? named : '';
}

export const isGoogleGroundConfigured = (): boolean => googleMapsKey().length > 0;

/** ONE LOADER PER PAGE. A second `<script>` for the Maps API is a console warning and a second
 *  bill; every caller waits on the same promise, and a page that already carries the API uses it. */
let loading: Promise<GoogleMapsApi | null> | null = null;

export const GOOGLE_LOAD_TIMEOUT = 8_000;

export function loadGoogleMaps(timeout = GOOGLE_LOAD_TIMEOUT): Promise<GoogleMapsApi | null> {
  if (loading) return loading;
  const key = googleMapsKey();
  if (!key || typeof window === 'undefined' || typeof document === 'undefined') {
    loading = Promise.resolve(null);
    return loading;
  }
  loading = new Promise<GoogleMapsApi | null>((resolve) => {
    const host = window as MapsWindow;
    let settled = false;
    const finish = (api: GoogleMapsApi | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(api);
    };
    /* THE API IS WHAT CAN DRAW, NOT WHAT HAS LOADED. Both constructors have to be there before the
       page builds a map, because `new api.Map` on an undefined constructor is caught, falls back
       to the files, and looks EXACTLY like a page that was never given a key. */
    const drawable = (): GoogleMapsApi | null => {
      const maps = host.google?.maps;
      return maps && typeof maps.Map === 'function' && typeof maps.OverlayView === 'function'
        ? (maps as GoogleMapsApi)
        : null;
    };
    /* THE WAY GOOGLE DOCUMENTS `loading=async`: ask for the library, and the constructors exist
       from the moment its promise returns. The old shape resolved on `script.onload` and read the
       constructors straight away, which the provider explicitly does not promise — a real key that
       attached them one tick later would have produced a page byte-identical to the free ground,
       with no console error and no red drive. */
    /* ⚠ AND THE BOOTSTRAP'S `onload` IS NOT THAT MOMENT (measured on the published page,
       11 September). The script tag's own `load` fires when the small bootstrap has run, and at
       that instant `google.maps` exists WITHOUT `importLibrary` — Google's `main.js` attaches it a
       moment later. Settling there read «no library, no picture» and drew the files under a
       valid key. So a missing `importLibrary` is not an answer: the promise waits for Google's own
       `callback` (named in the script URL), which fires once the API can be asked, or for the
       timeout, or for `gm_authFailure`. */
    const settleWhenDrawable = () => {
      const maps = host.google?.maps;
      if (!maps || typeof maps.importLibrary !== 'function') return;
      void maps.importLibrary('maps').then(() => finish(drawable()), () => finish(null));
    };
    const timer = window.setTimeout(() => finish(null), timeout);
    /* Google calls this on an invalid key, a referrer mismatch or an exhausted quota. It is the
       provider's own way of saying «use the other ground», so it is treated as exactly that. */
    host.gm_authFailure = () => finish(null);
    /* A page that already carries the API still asks for the library — the answer is cached by
       Google's own loader, so it costs nothing and it is the one road that states the contract. */
    if (host.google?.maps) { settleWhenDrawable(); return; }
    host.__rocotoMapsReady = settleWhenDrawable;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&callback=__rocotoMapsReady`;
    script.async = true;
    script.onload = settleWhenDrawable;
    script.onerror = () => finish(null);
    document.head.appendChild(script);
  });
  return loading;
}

/** Proof seam: a drive that changes the key between assertions asks for a fresh attempt. */
export const forgetGoogleMaps = (): void => { loading = null; };
