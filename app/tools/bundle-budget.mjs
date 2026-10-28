#!/usr/bin/env node
/* bundle-budget.mjs — WHAT THE BROWSER MUST PARSE BEFORE THE APP RUNS, HELD TO A NUMBER.
 *
 * The English build is what ships (`npm run build:app-en` → `dist-export-review/`), and the weight
 * of its own code is the one thing about it nobody was watching: a build that quietly doubles is
 * green in every gate this repository had. So the ceiling lives in `tools/bundle-budget.json`
 * beside the number it was measured from and the day it was measured, and this gate reads both.
 *
 * WHAT IT COUNTS: `app.html`, and every `.js` and `.css` asset the build emits. Fonts, the painted
 * library, the map tiles and the export templates are fetched when a surface needs them; this
 * number is what the browser must parse before anything is on screen.
 *
 * WHAT IT LEAVES OUT: `cedar/es/`. The Spanish entry the same build now emits beside the English
 * one is a SECOND application document, generated from this same source by the snapshot transform
 * (`../Spanish-snapshot.md`). A browser loads one of the two, never both, so adding its bytes to
 * this total would answer a question nobody asked — «what must the browser parse» — with the size
 * of two builds. It moves when this one moves; the ceiling below is still the English artifact's.
 *
 * IT MEASURES THE BUILD, IT DOES NOT RUN ONE. `npm run build:app-en` comes first — in CI the step
 * before it, locally `make build` — so the gate reads the same bytes the publish chain would take.
 * A missing or empty `dist-export-review/` is a failure with the command to run, never a pass.
 *
 * WHEN IT GOES RED: re-measure, and either take the weight back out or raise the ceiling in the
 * same pull request that adds it, with the new number, the new date and the reason in the JSON.
 *
 * RUN:  npm run build:app-en && node tools/bundle-budget.mjs
 * PROVE IT RED: lower `ceilingBytes` under the measured total and run — it names both numbers and
 * exits 1. Put it back and it is green.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET = 'tools/bundle-budget.json';
const at = (path) => join(APP_ROOT, path);
const die = (said) => { console.error(`bundle budget: ${said}`); process.exit(1); };

const budget = JSON.parse(readFileSync(at(BUDGET), 'utf8'));
/* The committed default is the artifact the publish chain reads. A worker verifying its own
   `dist-<key>` build names it the same way `tools/build-english-app.mjs` names its output. */
const override = /^dist-[a-z0-9-]+$/.test(process.env.ROCOTO_BUNDLE_DIST ?? '') ? process.env.ROCOTO_BUNDLE_DIST : '';
const dist = override || budget.dist || 'dist-export-review';
const SPANISH_ENTRY = `${dist}/cedar/es`;
if (!Number.isInteger(budget.ceilingBytes) || budget.ceilingBytes <= 0) die(`${BUDGET} carries no whole-number ceilingBytes.`);
if (!existsSync(at(dist)) || !statSync(at(dist)).isDirectory()) die(`${dist}/ is not there. Run \`npm run build:app-en\` first.`);

const walk = (dir, out = []) => {
  for (const item of readdirSync(at(dir), { withFileTypes: true })) {
    const path = `${dir}/${item.name}`;
    if (path === SPANISH_ENTRY) continue;
    if (item.isDirectory()) walk(path, out);
    else if (/\.(?:js|css)$/.test(item.name)) out.push(path);
  }
  return out;
};
const entry = `${dist}/app.html`;
if (!existsSync(at(entry))) die(`${entry} is not there. Run \`npm run build:app-en\` first.`);
const counted = [entry, ...walk(dist)].map((path) => ({ path, bytes: statSync(at(path)).size }));
if (counted.length < 2) die(`${dist}/ holds app.html and no JS at all — that build did not finish.`);

const total = counted.reduce((sum, file) => sum + file.bytes, 0);
const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const name = (path) => path.slice(dist.length + 1);

console.log(`bundle budget — ${dist}/app.html and every JS and CSS asset of the English build\n`);
for (const file of [...counted].sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
  console.log(`  ${name(file.path).padEnd(46)} ${String(file.bytes).padStart(9)} B  ${kib(file.bytes).padStart(11)}`);
}
if (counted.length > 8) {
  const rest = [...counted].sort((a, b) => b.bytes - a.bytes).slice(8);
  console.log(`  ${`and ${rest.length} smaller files`.padEnd(46)} ${String(rest.reduce((s, f) => s + f.bytes, 0)).padStart(9)} B`);
}
console.log(`\n  files         ${counted.length} · app.html and ${counted.length - 1} JS/CSS assets`);
console.log(`  measured      ${total} B  (${kib(total)})`);
console.log(`  ceiling       ${budget.ceilingBytes} B  (${kib(budget.ceilingBytes)}), set from ${budget.measuredBytes} B on ${budget.measuredOn}`);

if (total > budget.ceilingBytes) {
  console.log(`\n  RED — ${total} B is over the ${budget.ceilingBytes} B ceiling by ${total - budget.ceilingBytes} B (${kib(total - budget.ceilingBytes)}).`);
  console.log(`  Take the weight back out, or raise the ceiling in ${BUDGET} with the new number, the date and the reason.\n`);
  process.exit(1);
}
const headroom = budget.ceilingBytes - total;
console.log(`  headroom      ${headroom} B  (${kib(headroom)}, ${Math.round((headroom / budget.ceilingBytes) * 100)}% of the ceiling)`);
console.log('\n  GREEN\n');
