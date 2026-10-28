#!/usr/bin/env node
/* build-round-map.mjs — THE ROUND, FROM REAL GROUND (FEED-IA §21.1, §22.3).
 *
 * «The map gotta be an actual map bro. I don't want any half-assed things.» So the delivery map is
 * not drawn: it is BUILT, once, from the official Catalan administrative geometry, and checked in
 * as a small asset the panel renders. This tool is that build, and it is here so the asset can be
 * re-cut — a different house, a different round, a different frame — without anybody inventing a
 * coastline by hand.
 *
 * ═══ THE SOURCES ═══════════════════════════════════════════════════════════════════════════════
 * Two TopoJSON topologies from the same 2025 ICGC-derived set (github.com/ArnauInes/
 * geometries_cat_bcn_2024), so the districts of Barcelona and the municipalities around it share
 * one base and one precision (~0.4 m quantum):
 *
 *   dts_municipis_cat_2025.json    947 municipalities of Catalunya — the coast, and the round's
 *                                  two out-of-town runs
 *   dts_districtes_bcn_2025.json   the 10 districts of Barcelona — the round's four city runs
 *
 * ═══ WHY TOPOJSON, AND NOT GEOJSON ═════════════════════════════════════════════════════════════
 * A zone is a GROUP of real areas, and a group drawn as its members shows every internal border —
 * a delivery zone with the town lines still in it reads as a table of towns, not as one round. A
 * topology stores each shared border ONCE, as an arc, so the union is exact and cheap: an arc used
 * by two members of the same zone is interior and drops out; an arc used once is the zone's own
 * edge. No geometry library, no floating-point union, no cracks.
 *
 * ═══ THE OUTPUT ════════════════════════════════════════════════════════════════════════════════
 * `src/prototypes/cedar/round-map-geo.ts` — a viewBox, the land, the sea's own edge, and one path per zone,
 * projected (spherical Mercator), simplified to the tolerance the panel actually renders at, and
 * rounded to one decimal. No colour is emitted: paint is the theme's business, always.
 *
 * Run:  node tools/build-round-map.mjs           (uses the cache if it is there)
 *       node tools/build-round-map.mjs --fetch   (re-downloads the sources)
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = join(ROOT, '.geo-cache');
const OUT = join(ROOT, 'src/prototypes/cedar/round-map-geo.ts');

const SOURCES = {
  municipis: 'https://raw.githubusercontent.com/ArnauInes/geometries_cat_bcn_2024/main/dts_municipis_cat_2025.json',
  districtes: 'https://raw.githubusercontent.com/ArnauInes/geometries_cat_bcn_2024/main/dts_districtes_bcn_2025.json',
};

/* ═══ THE HOUSE'S ROUND ═════════════════════════════════════════════════════════════════════════
 * Six runs, each a real group of real places, the way a Barcelona fish house's own delivery book
 * is actually written: four city runs on the districts, two out-of-town runs on the municipalities.
 * The ids are the ones the customers already carry; the names are what the house calls the run.
 */
const ROUND = [
  { id: 'litoral', name: 'Litoral', from: 'districtes', parts: ['Ciutat Vella', 'Sant Martí'] },
  { id: 'eixample', name: 'Eixample', from: 'districtes', parts: ['Eixample', 'Sants-Montjuïc', 'Les Corts'] },
  { id: 'centre', name: 'Gràcia', from: 'districtes', parts: ['Gràcia', 'Sarrià-Sant Gervasi'] },
  { id: 'nord', name: 'Nord', from: 'districtes', parts: ['Horta-Guinardó', 'Nou Barris', 'Sant Andreu'] },
  {
    id: 'valles', name: 'Vallès', from: 'municipis',
    parts: ['Montcada i Reixac', 'Cerdanyola del Vallès', 'Ripollet', 'Barberà del Vallès',
            'Badia del Vallès', 'Sant Cugat del Vallès', 'Sant Quirze del Vallès', 'Sabadell'],
  },
  {
    id: 'costa', name: 'Costa', from: 'municipis',
    parts: ['Sant Adrià de Besòs', 'Santa Coloma de Gramenet', 'Badalona', 'Montgat', 'Tiana',
            'Alella', 'El Masnou', 'Teià', 'Premià de Dalt', 'Premià de Mar', 'Vilassar de Dalt',
            'Cabrils', 'Òrrius', 'Vilassar de Mar', 'Cabrera de Mar', 'Argentona', 'Mataró'],
  },
];

/** the towns whose names a person reads a map of this coast BY. Anchors only — whether any of them
 *  is drawn is the panel's decision, not this file's. */
const LANDMARKS = ['Barcelona', 'Mataró', 'Sabadell', 'Badalona'];

/* the frame, in degrees, chosen so the round fills it and the real coast runs corner to corner */
const FRAME = { west: 1.9, east: 2.6, south: 41.3, north: 41.61 };
/** the viewBox is 1000 wide; the height follows the projection, so nothing is stretched */
const WIDTH = 1000;
/** how much detail survives, in viewBox units. The panel draws this ~560px wide, so one unit is
 *  about half a pixel and 0.35 of one is a quarter of that: past the eye, short of the file. */
const TOLERANCE = 0.35;
/** an island smaller than this many square units is a speck, and a speck is dirt on the screen.
 *  One unit is about 58 m of real ground here, so 8 of them square is roughly two hectares. */
const MIN_AREA = 8;

/* ── FETCH ──────────────────────────────────────────────────────────────────────────────────── */

function source(name) {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `${name}.json`);
  if (!existsSync(path) || process.argv.includes('--fetch')) {
    process.stderr.write(`fetching ${name}…\n`);
    execFileSync('curl', ['-sL', '--max-time', '180', '-o', path, SOURCES[name]]);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

/* ── TOPOLOGY ───────────────────────────────────────────────────────────────────────────────── */

/** every arc, decoded from its deltas into absolute quantized integers. The integers are kept as
 *  integers on purpose: they are the exact keys two neighbouring areas share, and rounding them
 *  into degrees first is what turns an exact union into a seam. */
function arcsOf(topo) {
  return topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x, y]; });
  });
}

/** EVERY AREA EXACTLY ONCE. The municipality file ships each place twice, and a duplicate is fatal
 *  to the union rather than merely wasteful: an arc that should be counted once is counted twice,
 *  reads as an interior border, and drops — which deletes the entire outline, silently. */
function geometriesOf(topo) {
  const seen = new Set();
  return topo.objects[Object.keys(topo.objects)[0]].geometries.filter((g) => {
    const k = JSON.stringify(g.arcs);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** the rings of a geometry, as lists of signed arc indices */
function ringsOf(geom) {
  if (geom.type === 'Polygon') return geom.arcs;
  if (geom.type === 'MultiPolygon') return geom.arcs.flat();
  return [];
}

/** THE UNION. An arc used twice inside the group is a border between two of its own members and
 *  drops; an arc used once is the group's own edge. What is left is stitched end to end into
 *  rings, which is the merged outline — exactly, with no arithmetic on any coordinate. */
function merge(topo, arcs, geoms) {
  const uses = new Map();
  for (const g of geoms) {
    for (const ring of ringsOf(g)) {
      for (const a of ring) {
        const i = a < 0 ? ~a : a;
        uses.set(i, (uses.get(i) ?? 0) + 1);
      }
    }
  }

  /** the boundary arcs, in the direction their own ring walked them */
  const walk = [];
  for (const g of geoms) {
    for (const ring of ringsOf(g)) {
      for (const a of ring) {
        const i = a < 0 ? ~a : a;
        if (uses.get(i) === 1) walk.push(a);
      }
    }
  }

  const points = (a) => (a < 0 ? arcs[~a].slice().reverse() : arcs[a]);
  const key = (p) => `${p[0]},${p[1]}`;

  const starts = new Map();
  for (const a of walk) {
    const k = key(points(a)[0]);
    if (!starts.has(k)) starts.set(k, []);
    starts.get(k).push(a);
  }

  const used = new Set();
  const rings = [];
  for (const first of walk) {
    if (used.has(first)) continue;
    const ring = [];
    let a = first;
    for (let guard = 0; guard < walk.length + 1; guard += 1) {
      used.add(a);
      const pts = points(a);
      for (let i = ring.length ? 1 : 0; i < pts.length; i += 1) ring.push(pts[i]);
      const next = (starts.get(key(pts[pts.length - 1])) ?? []).find((c) => !used.has(c));
      if (next === undefined) break;
      a = next;
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}

/* ── PROJECTION ─────────────────────────────────────────────────────────────────────────────── */

const RAD = Math.PI / 180;
/** spherical Mercator's y, IN DEGREES so it shares the x axis's unit — a degree of longitude and a
 *  degree of latitude then keep their real ratio at this latitude, and the coast is the shape it is
 *  on the water rather than a stretched copy of it. (Leaving this in radians while x stayed in
 *  degrees squashed the whole map into a 12-unit strip — the projection has to agree with itself.) */
const mercator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;

function projector(topo) {
  const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;
  const x0 = FRAME.west, x1 = FRAME.east;
  /* north is the TOP of the picture, so the projected y runs downward from it */
  const y0 = mercator(FRAME.north);
  const k = WIDTH / (x1 - x0);
  const height = (y0 - mercator(FRAME.south)) * k;
  return {
    height,
    point: ([qx, qy]) => {
      const lon = qx * sx + tx;
      const lat = qy * sy + ty;
      return [(lon - x0) * k, (y0 - mercator(lat)) * k];
    },
  };
}

/* ── SIMPLIFY ───────────────────────────────────────────────────────────────────────────────── */

/** Douglas–Peucker, in the units the screen actually uses, so the tolerance is a statement about
 *  what an eye can see rather than about degrees nobody can picture. */
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    let far = -1, best = -1;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i];
      let d;
      if (len === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        let u = ((px - ax) * dx + (py - ay) * dy) / len;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        d = (px - ax - u * dx) ** 2 + (py - ay - u * dy) ** 2;
      }
      if (d > far) { far = d; best = i; }
    }
    if (far > t2) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const area = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a) / 2;
};

/** the ring's own centre of area — where a mark for the zone belongs when it takes one */
function centre(rings) {
  let best = null, most = -1;
  for (const r of rings) {
    const a = area(r);
    if (a > most) { most = a; best = r; }
  }
  if (!best) return [0, 0];
  let cx = 0, cy = 0, a2 = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i, i += 1) {
    const f = best[j][0] * best[i][1] - best[i][0] * best[j][1];
    a2 += f;
    cx += (best[j][0] + best[i][0]) * f;
    cy += (best[j][1] + best[i][1]) * f;
  }
  if (a2 === 0) return best[0].map((n) => round(n));
  return [round(cx / (3 * a2)), round(cy / (3 * a2))];
}

const round = (n) => Math.round(n * 10) / 10;

function pathOf(rings) {
  return rings
    .map((r) => `M${r.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`)
    .join('');
}

/* ── OFF THE EDGE ───────────────────────────────────────────────────────────────────────────
 * The land runs a long way past the frame — inland to Osona, down the coast to the Garraf — and
 * every one of those vertices costs bytes to draw something nobody can see. So a point outside the
 * frame is pinned to a box a little way past it: the excursion collapses into a short run along an
 * edge that is off screen, the visible outline is untouched to the vertex, and the file halves.
 *
 * It is a PIN, never a clip. Clipping would cut the ring against the frame and give it new edges
 * ALONG the frame — and those edges get stroked like a coast, which draws a shoreline down the side
 * of the picture where there is only the edge of the paper.
 */
const OFF = 40;

function pin(points, height) {
  const out = [];
  for (const [x, y] of points) {
    const px = x < -OFF ? -OFF : x > MAP_W + OFF ? MAP_W + OFF : x;
    const py = y < -OFF ? -OFF : y > height + OFF ? height + OFF : y;
    const last = out[out.length - 1];
    if (last && last[0] === px && last[1] === py) continue;
    out.push([px, py]);
  }
  return out;
}

const MAP_W = WIDTH;

/** rings, merged → projected → pinned → simplified → cleaned of specks */
function shape(topo, arcs, geoms) {
  const { point, height } = projector(topo);
  return merge(topo, arcs, geoms)
    .map((ring) => simplify(pin(ring.map(point), height), TOLERANCE))
    .filter((ring) => ring.length > 3 && area(ring) > MIN_AREA);
}

/* ── THE BUILD ──────────────────────────────────────────────────────────────────────────────── */

const topos = { municipis: source('municipis'), districtes: source('districtes') };
const arcs = { municipis: arcsOf(topos.municipis), districtes: arcsOf(topos.districtes) };
const geoms = { municipis: geometriesOf(topos.municipis), districtes: geometriesOf(topos.districtes) };

const NAME = { municipis: 'nom_municipi', districtes: 'nom_districte' };

const pick = (from, names) => {
  const wanted = new Set(names);
  const found = geoms[from].filter((g) => wanted.has(g.properties[NAME[from]]));
  const got = new Set(found.map((g) => g.properties[NAME[from]]));
  for (const n of names) if (!got.has(n)) throw new Error(`${from}: no such place «${n}»`);
  return found;
};

/* THE LAND. Every municipality that touches the frame, merged into one silhouette — which is what
 * draws the real coast, because the coast is simply where the land stops. It sits UNDER the zones,
 * so any sub-pixel disagreement between two topologies shows ground rather than water. */
function inFrame(g) {
  const { scale: [sx, sy], translate: [tx, ty] } = topos.municipis.transform;
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const ring of ringsOf(g)) {
    for (const a of ring) {
      for (const [qx, qy] of arcs.municipis[a < 0 ? ~a : a]) {
        const lon = qx * sx + tx, lat = qy * sy + ty;
        if (lon < west) west = lon;
        if (lon > east) east = lon;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
      }
    }
  }
  const pad = 0.06;
  return east > FRAME.west - pad && west < FRAME.east + pad
    && north > FRAME.south - pad && south < FRAME.north + pad;
}

const land = shape(topos.municipis, arcs.municipis, geoms.municipis.filter(inFrame));

const zones = ROUND.map((z) => {
  const rings = shape(topos[z.from], arcs[z.from], pick(z.from, z.parts));
  return { id: z.id, name: z.name, d: pathOf(rings), at: centre(rings), parts: z.parts };
});

const marks = LANDMARKS.map((name) => {
  const rings = shape(topos.municipis, arcs.municipis, pick('municipis', [name]));
  return { name, at: centre(rings) };
});

const { height } = projector(topos.municipis);

const file = `/* GENERATED by tools/build-round-map.mjs — do not edit by hand.
 *
 * THE ROUND, ON REAL GROUND (FEED-IA §21.1, §22.3). The coastline, the districts of Barcelona and
 * the municipalities around it are the official 2025 Catalan administrative geometry, merged into
 * the house's own six delivery runs, projected (spherical Mercator) into this viewBox and
 * simplified to ${TOLERANCE} of a unit — about a quarter of a pixel at the size the panel draws it.
 *
 * Frame: ${FRAME.west}°–${FRAME.east}°E, ${FRAME.south}°–${FRAME.north}°N. Source: ICGC 2025 via
 * github.com/ArnauInes/geometries_cat_bcn_2024. Rebuild with \`node tools/build-round-map.mjs\`.
 *
 * NO COLOUR LIVES HERE. Paint is the theme's business on every surface, this one included.
 */

export type ZoneShape = {
  /** the id the customers carry */
  id: string;
  /** what the house calls the run */
  name: string;
  /** the merged outline, ready for an SVG path */
  d: string;
  /** the run's own centre of area, for a mark that belongs to it */
  at: readonly [number, number];
  /** the real places the run is made of — the map's own receipt */
  parts: readonly string[];
};

export const VIEW_BOX = '0 0 ${WIDTH} ${Math.round(height)}';
export const MAP_WIDTH = ${WIDTH};
export const MAP_HEIGHT = ${Math.round(height)};

/** every municipality touching the frame, merged: the land, and therefore the coast */
export const LAND = '${pathOf(land)}';

/** the house's six runs, each a merged group of real places */
export const ZONES: readonly ZoneShape[] = [
${zones.map((z) => `  { id: '${z.id}', name: '${z.name}', at: [${z.at[0]}, ${z.at[1]}], parts: [${z.parts.map((p) => `'${p.replace(/'/g, "\\'")}'`).join(', ')}], d: '${z.d}' },`).join('\n')}
];

/** the towns a person reads this coast by */
export const MARKS: readonly { name: string; at: readonly [number, number] }[] = [
${marks.map((m) => `  { name: '${m.name}', at: [${m.at[0]}, ${m.at[1]}] },`).join('\n')}
];
`;

writeFileSync(OUT, file);
process.stderr.write(
  `round map: ${zones.length} zones · land ${(pathOf(land).length / 1024).toFixed(1)}kB · ` +
  `viewBox 0 0 ${WIDTH} ${Math.round(height)} · ${(file.length / 1024).toFixed(1)}kB total\n`,
);
for (const z of zones) process.stderr.write(`  ${z.id.padEnd(9)} ${(z.d.length / 1024).toFixed(1)}kB  at ${z.at}\n`);
