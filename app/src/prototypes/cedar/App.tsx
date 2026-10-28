/* THE APP — the puzzle assembled.
 *
 * Third entry on the SAME Vite build as the kit and the scenarios, so it shares the theme, the
 * providers and every component: an edit to the BRAND block or to a Rocoto component changes the
 * app in the same breath. That linkage is structural, not a convention.
 *
 * AREAS REGISTER BY EXISTING, exactly as scenario screens do — `src/prototypes/cedar/areas/<id>.tsx` exporting
 * `meta` and a default component, discovered by glob. V2-SALES and V2-STOCK therefore land their
 * surfaces without editing this file or the shell. The glob reads `./areas/*.tsx` and a `*` does
 * not cross a slash, so `areas/_parked/` is out of its reach by construction.
 *
 * THE FILE NAME IS THE ROUTE — `areas/sales.tsx` is `#/sales`, read off the path rather than off
 * the meta. A package renaming a surface moves one file and the navigation follows it in the same
 * commit; a stale `meta.id` inside a file can no longer route the app at a screen that is not
 * there. The meta still carries the words the surface says about itself.
 *
 * ═══ TWO GLOBS, TWO WORLDS (FEED-IA §53 · THE-ADMIN-CANON §7) ══════════════════════════════
 * «Administration is its own world — they would change the sidebar, and they would have a back
 * button at the top.»
 *
 * The second registry is the first one's twin, one directory down:
 *
 *   ./areas/*.tsx         →  #/<area>            THE DESK    Sales · Stock · Customers
 *   ./areas/admin/*.tsx   →  #/admin/<seat>      THE WORLD   ten seats
 *
 * A `*` does not cross a slash, so the two globs cannot see each other's files and a seat can
 * never accidentally land on the desk's rail. The HEAD SEGMENT selects the world and everything
 * after the seat belongs to the seat — the identical «the tail belongs to the area» rule, one level
 * deeper, which is what lets `#/admin/team/nuria` open a person and `#/admin/operations/delivery`
 * open an answer without this file learning either word.
 *
 * ═══ THE OLD ADDRESSES STILL RESOLVE, AND THAT IS DELIBERATE ═══════════════════════════════
 * `#/settings` is written into surfaces this package does not own — the albarán detail, the export
 * centre, the incoming log — and retiring a route out from under a live link is how an app starts
 * showing people a «this is not a place» screen for a door that used to work. So the router
 * FORWARDS: `#/settings` lands on the world, and `#/settings/<question>` lands on the seat that
 * answer moved to, through the same `anchorFor` map the migration table is written in. One
 * redirect, stated once, and no file outside this package had to be edited to keep its door.
 *
 * FEED-IA §241 opens the prepared Sales workspace by default. The explicit /welcome
 * route reopens setup; deep links retain their selected task.
 */
import { rememberCallParent } from './call-navigation';
import * as React from 'react';
import { useStyletron } from 'baseui';
import Frame from './shell/frame';
import { AdminIndex } from './shell/rail';
import {
  ADMIN, ADMIN_HOME, HOME, RAIL_ORDER,
  deskBack, deskBackTitle, isAdminSeat, rememberDesk,
  type AreaId, type AreaMeta,
} from './shell/area';
import { anchorFor } from './anchors';
import { PHONE } from './shell/viewport';
import { useConfig, type QuestionId } from './config';
import { useWorkspaceCapabilities } from './workspace-capabilities';
import { ADMIN_ROUTE_META, DESK_ROUTE_META, type RouteMeta } from './route-meta';

/* ── the two registries, loaded only when opened ───────────────────────────────────────────── */

type AreaLoader = () => Promise<{ default: React.ComponentType }>;

/* This glob deliberately stays lazy. `route-meta.ts` is the synchronous rail contract; the
 * selected route is the only area module React asks Vite to fetch and evaluate. The narrow globs
 * preserve the old collision boundary: `areas/_parked/` and admin seats never leak into desk
 * discovery, and a nested helper cannot become a route by existing. */
const MODULES = import.meta.glob('./areas/*.tsx') as Record<string, AreaLoader>;
const ADMIN_MODULES = import.meta.glob('./areas/admin/*.tsx') as Record<string, AreaLoader>;

type Registered = { id: string; meta: AreaMeta; component: React.LazyExoticComponent<React.ComponentType> };

/** Pair startup-safe route data with a lazy route module. A stale path is a programmer error: it
 * must fail loudly during development instead of quietly removing a place from the navigation. */
function register(routes: RouteMeta[], modules: Record<string, AreaLoader>): Registered[] {
  return routes.map(({ path, ...meta }) => {
    const load = modules[path];
    if (!load) throw new Error(`Route module is missing: ${path}`);
    return { id: meta.id, meta, component: React.lazy(load) };
  });
}

const DemoWelcome = React.lazy(() => import('./demo-welcome').then(module => ({ default: module.DemoWelcome })));
const CallRoute = React.lazy(() => import('./call-route'));
const CedarOnboarding = React.lazy(() => import('./cedar-onboarding').then(module => ({ default: module.CedarOnboarding })));

const REGISTERED = register(DESK_ROUTE_META, MODULES);
const ADMIN_REGISTERED = register(ADMIN_ROUTE_META, ADMIN_MODULES);

/** RAIL_ORDER first, then anything that registered outside it — a built surface is never dropped
 *  from the navigation just because the order list has not caught up with it. */
const AREAS: AreaMeta[] = [
  ...RAIL_ORDER.map((id) => REGISTERED.find((m) => m.id === id)?.meta).filter(Boolean) as AreaMeta[],
  ...REGISTERED.filter((m) => !RAIL_ORDER.includes(m.id as AreaId)).map((m) => m.meta),
];

const COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = Object.fromEntries(
  REGISTERED.map((m) => [m.id, m.component]),
);

/** The admin metas, keyed — the world's rail draws its seats from `ADMIN_ORDER` (a canon, not a
 *  discovery), so what the frame needs from here is the POSTURE each seat declares. */
const ADMIN_METAS: Record<string, AreaMeta> = Object.fromEntries(
  ADMIN_REGISTERED.map((m) => [m.id, m.meta]),
);

const ADMIN_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = Object.fromEntries(
  ADMIN_REGISTERED.map((m) => [m.id, m.component]),
);

/* ── routing ──────────────────────────────────────────────────────────────────────────────── */

export type Route =
  | { world: 'desk'; area: string }
  | { world: 'admin'; seat: string | null };

/**
 * READ THE HASH.
 *
 * `#/stock` → the desk at Stock. `#/settings/rules` → the desk at… nothing, so it forwards.
 * `#/admin` → the world, with no seat chosen. `#/admin/team/nuria` → the world at Team, and the
 * tail is Team's own business (`anchors.tsx` reads it).
 *
 * A SEAT THE WORLD DOES NOT HAVE IS NOT A SEAT. `#/admin/nonsense` falls back to «no seat chosen»
 * rather than to a blank pane, which on a desk is the world's home and on a phone is the index —
 * both of which are somewhere real.
 */
export function readRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === ADMIN) {
    const seat = parts[1] && isAdminSeat(parts[1]) ? parts[1] : null;
    return { world: 'admin', seat };
  }
  return { world: 'desk', area: parts[0] ?? '' };
}

/** THE ONE FORWARD (see the header). Returns the hash to go to, or nothing where the address is
 *  already a place. It is a pure function so a drive can hold the migration table to it. */
export function forwardOf(hash: string): string | null {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] !== 'settings') return null;
  const q = parts[1];
  if (q && ADMIN_QUESTIONS.includes(q as QuestionId)) return anchorFor(q as QuestionId);
  return `#/${ADMIN}`;
}

/** the ten answers `anchorFor` knows how to place. Kept here rather than imported from `config` so
 *  the forward cannot be handed a word the map has no seat for. */
const ADMIN_QUESTIONS: QuestionId[] = [
  'sector', 'capture', 'gate', 'pricing', 'weighing', 'goodsIn', 'stock', 'delivery', 'lots', 'erp',
];

/** WHICH PLACE A ROUTE IS — the seat or the area, without its tail. `#/admin/team/nuria` and
 *  `#/admin/team` are the same place; `#/admin/team` and `#/admin/plan` are two. */
const placeOf = (r: Route): string => (r.world === 'admin' ? `admin/${r.seat ?? ''}` : `desk/${r.area}`);

const useRoute = (): Route => {
  const read = () => {
    const forward = forwardOf(window.location.hash);
    if (forward) {
      window.location.replace(forward);
      return readRoute(forward);
    }
    rememberCallParent(window.location.hash);
    return readRoute(window.location.hash);
  };
  const [route, setRoute] = React.useState<Route>(read);
  React.useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  /* ── ARRIVING SOMEWHERE STARTS AT ITS TOP (§98.3, the acceptance walk's P1-5) ────────────────
   * Scrolling «Your data» to 1200 and pressing Plan in the rail opened Plan at 408 — the standing
   * plan and the month's own figures off-screen above, the page starting on whatever happened to
   * sit at the old surface's offset. That is clause 3 of the acceptance bar failing in its general
   * form: a seat's most important region is the one a person is meant to read first, and arriving
   * from a scrolled surface skipped it every time.
   *
   * IT IS THE PLACE THAT MATTERS AND NOT THE ADDRESS. A tail — `#/admin/team/nuria`, an order id —
   * is the same surface saying something about itself, and re-reading a document must never yank
   * the page to the top. So the reset fires on the SEAT or the AREA changing and on nothing else.
   *
   * THE PAGE IS THE SCROLLPORT ONLY IN THE COLUMN POSTURE (§38/§87): a panes surface mounts its own
   * ports fresh, at their own tops, so this is exactly the settings-seat case it was written for.
   */
  const place = placeOf(route);
  React.useLayoutEffect(() => {
    const port = document.scrollingElement ?? document.documentElement;
    if (port) port.scrollTop = 0;
  }, [place]);

  return route;
};

function Missing({ what }: { what: string }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ maxWidth: '60ch' }}>
      <h1 style={{ margin: 0, ...theme.typography.HeadingMedium }}>{what}</h1>
      <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary }}>
        <a href="#/sales" style={{ color: theme.colors.contentPrimary }}>Open Sales</a>
      </p>
    </div>
  );
}

/** Keep the frame and its rail in place while a route chunk arrives. The spoken status is enough
 * for assistive technology; the neutral themed surface does not pretend the destination has loaded. */
function RouteLoading() {
  const [, theme] = useStyletron();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ minHeight: '100%', color: theme.colors.contentSecondary, ...theme.typography.ParagraphSmall }}
    >
      Loading…
    </div>
  );
}

function RouteContent({ component: Component }: { component: React.LazyExoticComponent<React.ComponentType> }) {
  return <React.Suspense fallback={<RouteLoading />}><Component /></React.Suspense>;
}

export default function App() {
  const requestedRoute = useRoute();
  const { config } = useConfig();
  const { money } = useWorkspaceCapabilities(config.cast);
  const areas = AREAS.filter(area => area.id !== 'money' || money);
  const moneyDisabled = requestedRoute.world === 'desk' && requestedRoute.area === 'money' && !money;
  const route: Route = moneyDisabled ? { world: 'desk', area: HOME } : requestedRoute;
  React.useEffect(() => {
    if (moneyDisabled) window.location.replace(`#/${HOME}`);
  }, [moneyDisabled]);
  /* the frame owns the continuum; the router needs one rung of it for exactly one decision —
     whether «the world with no seat chosen» is the world's home (a desk has a rail) or the index
     (a phone has to be given the list before it can be given a seat).
     IT ASKS `viewport.ts` FOR THE QUERY (FEED-IA §103). The number used to be written out here as
     a second copy of the breakpoint, so moving the phone's threshold would have left the router
     answering for a housing the frame had stopped drawing. */
  const phone = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(PHONE).matches
    : false;

  if (route.world === 'desk' && (!route.area || route.area === 'welcome' || route.area === 'onboarding')) {
    const sales = () => { window.location.hash = '#/sales'; };
    const welcome = () => { window.location.hash = '#/welcome'; };
    return <React.Suspense fallback={<RouteLoading />}>{route.area === 'onboarding'
      ? <CedarOnboarding onComplete={sales} onExit={welcome} />
      : <DemoWelcome autoStart={!route.area} onOnboarding={() => { window.location.hash = '#/onboarding'; }} onStartSelling={sales} />}</React.Suspense>;
  }

  if (route.world === 'admin') {
    /* THE DESK THE PERSON LEFT, remembered for the back door. Read here, before the seat renders,
       because the seat is the thing that would otherwise overwrite it. */
    const back = deskBack();
    const backTitle = deskBackTitle();
    const seat = route.seat ?? (phone ? null : ADMIN_HOME);
    const Seat = seat ? ADMIN_COMPONENTS[seat] : undefined;
    const metas = seat && ADMIN_METAS[seat] ? [ADMIN_METAS[seat]] : [];

    return (
      <Frame
        areas={metas}
        tabs={areas}
        current={seat ?? ''}
        world="admin"
        back={back}
        backTitle={backTitle}
      >
        {Seat ? <RouteContent component={Seat} /> : <AdminIndex back={back} backTitle={backTitle} />}
      </Frame>
    );
  }

  if (route.area === 'phone') return <Frame areas={areas} current="sales" world="desk"><RouteContent component={COMPONENTS.sales} /><React.Suspense fallback={<RouteLoading />}><CallRoute /></React.Suspense></Frame>;

  const current = route.area || HOME;
  rememberDesk(current);
  const Current = COMPONENTS[current];

  // Setup uses the same focused page body as the settings dialog, outside workspace navigation.
  if (current === 'money' && /^#\/money\/setup(?:\/|$)/.test(window.location.hash) && Current) {
    return <RouteContent component={Current} />;
  }

  return (
    <Frame areas={areas} current={current} world="desk">
      {Current ? <RouteContent component={Current} /> : <Missing what={current} />}
    </Frame>
  );
}
