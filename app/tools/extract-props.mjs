#!/usr/bin/env node
/* Extract each component's public props from Base's own TypeScript source into props.json.
 *
 * The spec on a component page must never be hand-written: hand-written specs drift the moment
 * the library moves, and a drifted spec is worse than none. These are read from
 * the supplied upstream checkout’s src/<name>/types.ts, so the reference states what the code actually accepts.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { appRoot, baseSource } from './base-source.mjs';

const { values } = parseArgs({ options: {
  'source-root': { type: 'string' }, output: { type: 'string' },
} });
const upstream = baseSource(values['source-root']);
const SRC = join(upstream.root, 'src');
const output = values.output ? resolve(values.output) : join(appRoot, 'src/kit/props.json');

/** the props type a component page should document, in priority order */
const pick = (names, comp) => {
  const pascal = comp.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('');
  const want = [`${pascal}Props`, 'Props', `${pascal}PropsT`];
  for (const w of want) if (names.includes(w)) return w;
  return names.find((n) => n.endsWith('Props') && !n.startsWith('Stateful') && !n.startsWith('Shared')) || null;
};

/** pull `export type X = { ... }` bodies out of a types file, brace-balanced.
 *  A type written as `X = Base & { ... }` keeps the names it intersects, because those props are
 *  props the component accepts — dropping them printed a spec that was quietly half a spec. */
function typeBlocks(src) {
  const out = {};
  const re = /export type (\w+)\s*=\s*([\w.<>\[\]'" |&]*?\s*&\s*)?\{/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex - 1, depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (!depth) break; }
    }
    const parents = (m[2] || '')
      .split('&')
      .map((s) => s.trim())
      .filter((s) => /^\w+$/.test(s));
    out[m[1]] = { body: src.slice(re.lastIndex, i), parents };
  }
  return out;
}

/** every prop a type accepts: the ones it intersects first, then its own, which win on a clash */
function rowsFor(blocks, name, seen = new Set()) {
  const block = blocks[name];
  if (!block || seen.has(name)) return [];
  seen.add(name);
  const merged = [];
  const put = (row) => {
    const at = merged.findIndex((r) => r.name === row.name);
    if (at === -1) merged.push(row);
    else merged[at] = row;
  };
  for (const parent of block.parents) for (const row of rowsFor(blocks, parent, seen)) put(row);
  for (const row of fields(block.body)) put(row);
  return merged.filter((r) => r.name !== 'overrides');
}

/** `LineChartProps` -> `line-chart`, so a props type finds the component file it documents */
const fileOf = (typeName) =>
  typeName
    .replace(/Props$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

/** fields of a type body, with their leading JSDoc/line comment as the description */
function fields(body) {
  const out = [];
  const re = /(?:\/\*\*([\s\S]*?)\*\/\s*|\/\/([^\n]*)\n\s*)?(\w+)(\?)?:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(body))) {
    const doc = (m[1] || m[2] || '')
      .split('\n').map((l) => l.replace(/^\s*\*?\s?/, '').trim()).filter(Boolean).join(' ');
    let type = m[5].replace(/\s+/g, ' ').trim();
    if (type.length > 120) type = type.slice(0, 117) + '…';
    out.push({ name: m[3], optional: !!m[4], type, doc });
  }
  return out;
}

const result = {};
// Rocoto's own components document themselves the same way — same extractor, same canon
for (const comp of readdirSync(join(appRoot, 'src/rocoto'))) {
  const dir = join(appRoot, 'src/rocoto', comp);
  const f = join(dir, 'types.ts');
  if (!existsSync(f)) continue;
  const src = readFileSync(f, 'utf8');
  const blocks = typeBlocks(src);
  const name = pick(Object.keys(blocks), comp);
  if (!name) continue;
  const rows = rowsFor(blocks, name);
  if (rows.length) result[comp] = { type: name, props: rows };

  /* A DIRECTORY MAY HOLD A FAMILY. `charts/` grows three components on one frame, and one entry
   * keyed by the folder would document one of them and leave the other two pages specless. So
   * every props type that names a component file beside it gets its own entry — keyed by that
   * file, which is what the page routes on. A folder with a single component is untouched. */
  const family = Object.keys(blocks).filter(
    (t) => t.endsWith('Props') && existsSync(join(dir, `${fileOf(t)}.tsx`))
  );
  if (family.length > 1) {
    for (const t of family) {
      const own = rowsFor(blocks, t);
      if (own.length) result[fileOf(t)] = { type: t, props: own };
    }
  }
}
/* ── THE APP'S OWN PRIMITIVES (FEED-IA §33.2 item 7, §45's cumulative law) ────────────────────
 * Eight things the app grew that now have reference pages, and therefore owe a spec like everything
 * else on this site. They do not live in a `<name>/types.ts` folder — they are app modules — so the
 * registry names the FILE, the exported props type inside it, and the key the page routes on. That
 * is three facts per row and no guessing; a primitive that renames its props type fails loudly here
 * rather than quietly printing a page with no spec. The doc text still comes from the type's own
 * JSDoc, so the spec is the source exactly as it is for every Base component. */
const APP_PRIMITIVES = [
  ['src/prototypes/cedar/product-card.tsx', 'ProductCardProps', 'product-card'],
  ['src/prototypes/cedar/product-face.tsx', 'ProductFaceProps', 'painted-tile'],
  ['src/prototypes/cedar/stock-tiers.tsx', 'ProductTarifasProps', 'tiers-editor'],
  ['src/prototypes/cedar/shell/embeds.tsx', 'ChatEmbedProps', 'chat-embeds'],
  ['src/prototypes/cedar/glyphs.tsx', 'KeycapProps', 'keycap'],
  /* THE PANES ROUND'S THREE (§41.5, §43, §44.5): the line's field row, the object door every name
     in the app wears, and the profile seat at the rail's foot. */
  ['src/prototypes/cedar/detail.tsx', 'FieldsProps', 'fields'],
  ['src/prototypes/cedar/anchors.tsx', 'DoorProps', 'object-door'],
  ['src/prototypes/cedar/shell/rail.tsx', 'ProfileSeatProps', 'profile-seat'],
];

for (const [file, typeName, key] of APP_PRIMITIVES) {
  if (!existsSync(join(appRoot, file))) throw new Error(`extract-props: ${file} is gone — the kit page it documents is orphaned`);
  const blocks = typeBlocks(readFileSync(join(appRoot, file), 'utf8'));
  if (!blocks[typeName]) throw new Error(`extract-props: ${file} no longer exports \`${typeName}\``);
  const rows = rowsFor(blocks, typeName);
  if (rows.length) result[key] = { type: typeName, props: rows };
}

for (const comp of readdirSync(SRC)) {
  const f = join(SRC, comp, 'types.ts');
  if (!existsSync(f)) continue;
  const src = readFileSync(f, 'utf8');
  const blocks = typeBlocks(src);
  const name = pick(Object.keys(blocks), comp);
  if (!name) continue;
  const rows = rowsFor(blocks, name);
  if (rows.length) result[comp] = { type: name, props: rows };
}

writeFileSync(output, JSON.stringify(result, null, 0));
const n = Object.values(result).reduce((a, c) => a + c.props.length, 0);
console.log(`${Object.keys(result).length} components, ${n} props -> ${output}`);
