#!/usr/bin/env node
/* snapshot-coverage.mjs — THE SPANISH TABLE, MEASURED AGAINST THE TREE IT TRANSLATES.
 *
 * The Spanish build (`npm run build:app-es`) is a SOURCE TRANSFORM, not a runtime locale: the
 * `rocoto-spanish-snapshot-source-transform` plugin in `vite.config.ts` parses every module under
 * `src/prototypes/cedar`, `src/scenarios` and `src/rocoto`, and rewrites the display strings it can find in the
 * fifteen `src/prototypes/cedar/snapshot/es-*.json` tables. A table entry that no longer matches anything in
 * the tree is silently inert, and an English string with no entry is silently shipped in English.
 * Neither shows up in a green build, so this gate says both out loud.
 *
 * TWO LISTS, ONE OF THEM FATAL:
 *
 *   DEAD          an entry whose English is no longer in its source — the file left the tree, or
 *                 the string did. It translates nothing and can never translate anything again, so
 *                 it is a defect in the table and this gate EXITS 1 on it. `--prune` drops them.
 *
 *   UNTRANSLATED  a string the Spanish build would put on a Spanish screen in English. It is a
 *                 COUNT and a WARNING, never a failure: writing Spanish is Peter's, and an English
 *                 string with no Spanish entry is REPORTED, never invented (the copy law — the
 *                 Spanish build is frozen at publish and no session writes into it).
 *
 * HOW IT RESOLVES, EXACTLY THE WAY THE BUILD DOES. It does not re-implement the matching rule: it
 * calls the build's own `translateSpanishSnapshotSource` with the build's own lookup from
 * `lookupFromEntries`, wrapped so every question the transform asks is recorded. An entry is alive
 * if the transform asks for it; a site is untranslated if the transform's answer is nothing. The
 * one thing that is restated here is `find`'s seed-dictionary gate, because the recorder sees the
 * context string rather than the AST node — and a guard below fails the gate if that expression
 * moves in the transform, so the copy cannot drift silently.
 *
 * RUN:  node tools/snapshot-coverage.mjs            (the gate)
 *       node tools/snapshot-coverage.mjs --verbose  (every dead entry, every untranslated string)
 *       node tools/snapshot-coverage.mjs --prune    (drop the dead entries from the tables)
 *
 * PROVE IT RED: add an entry naming a string no source holds — or change one live entry's
 * `english` by a character — and run. It names the entry and exits 1. Put it back and it is green.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { compileTypeScript, APP_ROOT } from './ts-module.mjs';
import { frozenRetirementKeys, retirementKey } from './frozen-english-retirements.mjs';

const VERBOSE = process.argv.includes('--verbose');
const PRUNE = process.argv.includes('--prune');
const SNAPSHOT_DIR = 'src/prototypes/cedar/snapshot';
/* The transform's own file filter, and the walk `snapshot/extract-i18n.mjs` used to write the
   tables: the three source roots, and never a parked surface — nothing imports `_parked/`, the
   typecheck includes it and the build never loads it. */
const SOURCE_ROOTS = ['src/prototypes/cedar', 'src/scenarios', 'src/rocoto'];
const PARKED = '/_parked/';

const die = (said) => { console.error(`snapshot coverage: ${said}`); process.exit(1); };
const at = (path) => join(APP_ROOT, path);

/* ── THE TABLES THE BUILD LOADS ───────────────────────────────────────────────────────────────
 * `vite.config.ts` names them one by one, so the config is the authority on which files are in
 * force. A table sitting in the directory that the config leaves out is loaded by nobody, and the
 * gate says so rather than quietly counting it. */
const configText = readFileSync(at('vite.config.ts'), 'utf8');
const configured = [...configText.matchAll(/'(es-[\w.-]+\.json)'/g)].map((m) => m[1]);
if (!configured.length) die('vite.config.ts names no es-*.json table — the spanish-snapshot mode moved.');
const onDisk = readdirSync(at(SNAPSHOT_DIR)).filter((name) => /^es-.*\.json$/.test(name)).sort();
const unloaded = onDisk.filter((name) => !configured.includes(name));
const missing = configured.filter((name) => !onDisk.includes(name));

const tables = configured.map((file) => {
  const path = join(SNAPSHOT_DIR, file);
  if (!existsSync(at(path))) return { file, path, table: null, entries: [] };
  const table = JSON.parse(readFileSync(at(path), 'utf8'));
  return { file, path, table, entries: table.entries ?? [] };
});
const entries = tables.flatMap(({ file, entries: rows }) => rows.map((entry, index) => ({ ...entry, file, index })));
if (!entries.length) die('the tables hold no entries.');

/* ── THE BUILD'S OWN TRANSFORM, WITH EVERY QUESTION RECORDED ──────────────────────────────── */
const transformSource = readFileSync(at(`${SNAPSHOT_DIR}/spanish-source-transform.ts`), 'utf8');
/* `find`'s seed-dictionary gate, restated from the transform because the recorder is handed the
   context string rather than the node. The last clause of the real expression — an object KEY —
   never reaches `find`, because `visit` returns on it first. If this expression moves, the copy
   below is wrong, so the gate refuses to run rather than report a number it cannot stand behind. */
const GATE = "!['BinaryExpression', 'TSLiteralType', 'SwitchCase'].includes(parent?.type)";
if (!transformSource.includes(GATE) || !transformSource.includes("node.type === 'JSXText' || parent?.type === 'JSXAttribute'")) {
  die(`the seed-dictionary gate moved in ${SNAPSHOT_DIR}/spanish-source-transform.ts — re-derive dictionaryEligible() here.`);
}
/* ── WHAT READS AS COPY ───────────────────────────────────────────────────────────────────────
 * The transform asks about every literal it walks past, and most of them are machine values: an
 * enum (`whatsapp`), a camelCase key (`supplierIntake`), a locale (`es-ES`), a mime type
 * (`image/*`), a CSS value (`16px`, `rotate(90deg)`), a media query, an SVG path. None of those is
 * a string a person reads, so counting them as untranslated Spanish would report a number nobody
 * can act on. Each test below rejects one shape, and a string survives only by having WORDS.
 * `--verbose` prints what survived, so the rule can be read against its own output. */
const LETTERS = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g;
const readsAsCopy = (text) => {
  const said = text.replace(/\$\{[^}]*\}/g, ' ').replace(/^[-_\s]+|[-_\s]+$/g, '');  // a placeholder is not a word
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/.test(said)) return false;     // «·» «0 0 10 10» «/»
  if ((said.match(LETTERS)?.length ?? 0) / said.length < 0.4) return false;  // SVG path geometry
  if (said.includes('/')) return false;                            // a path, a mime type, a URL
  if (/^\(.*\)$/.test(said)) return false;                         // «(prefers-reduced-motion: reduce)»
  if (/^[a-z-]+\([^)]*\)$/.test(said)) return false;               // «rotate(90deg)» «calc(…)»
  if (/^\d+(?:\.\d+)?(?:px|rem|em|vh|vw|ms|s|%|deg|fr)$/.test(said)) return false;
  if (/^[a-z][A-Za-z0-9]*$/.test(said)) return false;              // «chat» «supplierIntake»
  if (/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)+$/.test(said)) return false;  // «es-ES» «V2-ADMIN» «phone-value»
  return true;
};

const dictionaryEligible = (context) => {
  const [parentType, rest = ''] = context.split(' > ');
  const nodeType = rest.split(':')[0];
  return nodeType === 'JSXText' || parentType === 'JSXAttribute'
    || (nodeType === 'StringLiteral' && !['BinaryExpression', 'TSLiteralType', 'SwitchCase'].includes(parentType));
};

const compiled = compileTypeScript(`${SNAPSHOT_DIR}/spanish-source-transform.ts`, 'snapshot-coverage');
const require = createRequire(import.meta.url);
const { translateSpanishSnapshotSource, lookupFromEntries } = require(compiled);
const { SPANISH_SNAPSHOT_DICTIONARY } = require(join(dirname(compiled), 'spanish-dictionary.js'));
const lookup = lookupFromEntries(entries);

/* `vite.config.ts` hands `day.ts` one prepared edit before the transform sees it: the plural
   helper gains a lookup, so a plural reads a Spanish word. The same edit is made here with an
   EMPTY map — the shape the transform walks is identical, and the Spanish words the build injects
   stay out of a count that is about English. Fail-closed: if the line it rewrites is gone, the
   preparation is a lie and the gate says so. */
const DAY_PLURAL = '=> (n === 1 ? one : many);';
const prepareForTransform = (code, source) => {
  if (source !== 'src/prototypes/cedar/day.ts') return code;
  if (!code.includes(DAY_PLURAL)) die(`src/prototypes/cedar/day.ts no longer holds «${DAY_PLURAL}» — re-read the plugin in vite.config.ts.`);
  return code.replace(DAY_PLURAL, `=> (({} as Record<string,string>)[n === 1 ? one : many] ?? (n === 1 ? one : many));`);
};

const KEY = '\u0000';
const askedLoose = new Set();     // source · kind · english — the map the lookup reads first
const askedExact = new Set();     // source · context · kind · english — its fallback
const askedText = new Set();      // source · english, whatever kind — for reading a dead entry
const sites = new Map();          // one row per distinct display site the transform asked about

function scan(source, inBuild) {
  const code = prepareForTransform(readFileSync(at(source), 'utf8'), source);
  const recorder = (askedSource, context, kind, english) => {
    const answer = lookup(askedSource, context, kind, english);
    askedLoose.add([askedSource, kind, english].join(KEY));
    askedExact.add([askedSource, context, kind, english].join(KEY));
    askedText.add([askedSource, english].join(KEY));
    if (inBuild) {
      const id = [askedSource, kind, english].join(KEY);
      const fromDictionary = dictionaryEligible(context) ? SPANISH_SNAPSHOT_DICTIONARY[english] : undefined;
      const spanish = (answer && answer !== english) ? answer : (fromDictionary && fromDictionary !== english ? fromDictionary : undefined);
      const seen = sites.get(id);
      if (seen) { if (spanish) seen.spanish = spanish; }
      else sites.set(id, { source: askedSource, kind, english, spanish });
    }
    return answer;
  };
  try { translateSpanishSnapshotSource(code, source, recorder); }
  catch (error) { die(`${source} could not be read the way the build reads it: ${error.message}`); }
}

const walk = (dir, out = []) => {
  for (const item of readdirSync(at(dir), { withFileTypes: true })) {
    const path = `${dir}/${item.name}`;
    if (item.isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path) && !path.includes(PARKED)) out.push(path);
  }
  return out;
};
const buildFiles = SOURCE_ROOTS.flatMap((root) => walk(root));
const inBuild = new Set(buildFiles);
const entrySources = [...new Set(entries.map((entry) => entry.source))];
const alsoNamed = entrySources.filter((source) => !inBuild.has(source) && existsSync(at(source)) && statSync(at(source)).isFile());

for (const source of buildFiles) scan(source, true);
for (const source of alsoNamed) scan(source, false);

/* ── DEAD ─────────────────────────────────────────────────────────────────────────────────────
 * An entry is alive if the transform asked for it. `lookupFromEntries` resolves an early review's
 * semantic kind into the syntax kinds it can match, so the same widening decides aliveness. */
const kindsOf = (entry) => ['literal', 'template', 'jsx-text'].includes(entry.kind)
  ? [entry.kind] : (entry.english.includes('${') ? ['template'] : ['literal', 'jsx-text']);
const alive = (entry) => kindsOf(entry).some((kind) =>
  askedLoose.has([entry.source, kind, entry.english].join(KEY))
  || askedExact.has([entry.source, entry.context, kind, entry.english].join(KEY)));

const gone = new Set(entrySources.filter((source) => !existsSync(at(source))));
let retired;
try {
  retired = frozenRetirementKeys(JSON.parse(readFileSync(at('tools/frozen-english-retirements.json'), 'utf8')), entries, alive);
} catch (error) { die(error.message); }
const dead = entries.filter((entry) => !retired.has(retirementKey(entry)) && (gone.has(entry.source) || !alive(entry)));

/* WHAT DROPPING A DEAD ENTRY COSTS. Most are the unused half of a widened pair: an early review
   wrote one row per syntax kind, the transform asks under one of them, and the other translates
   nothing and never will. Those cost nothing. The rest are worth naming: the transform DOES ask
   for that English at that source, under a kind this entry does not carry, so the Spanish exists
   and the build cannot reach it. Correcting a `kind` is a repair rather than a translation, and it
   is the maintainer's call — this gate names them and leaves the tables' keys alone. */
const deadRows = new Set(dead);
const liveText = new Set(entries.filter((entry) => !deadRows.has(entry)).map((entry) => [entry.source, entry.english].join(KEY)));
const duplicated = dead.filter((entry) => liveText.has([entry.source, entry.english].join(KEY)));
const stranded = dead.filter((entry) => !liveText.has([entry.source, entry.english].join(KEY))
  && askedText.has([entry.source, entry.english].join(KEY)));
const deadBySource = new Map();
for (const entry of dead) {
  const row = deadBySource.get(entry.source) ?? { count: 0, why: gone.has(entry.source) ? 'file gone' : 'string gone', examples: [] };
  row.count += 1;
  if (row.examples.length < 3) row.examples.push(entry.english);
  deadBySource.set(entry.source, row);
}

/* ── UNTRANSLATED ─────────────────────────────────────────────────────────────────────────── */
const copySites = [...sites.values()].filter((site) => readsAsCopy(site.english));
const untranslated = copySites.filter((site) => !site.spanish);
const untranslatedBySource = new Map();
for (const site of untranslated) {
  const row = untranslatedBySource.get(site.source) ?? { count: 0, examples: [] };
  row.count += 1;
  if (row.examples.length < 3) row.examples.push(site.english);
  untranslatedBySource.set(site.source, row);
}

/* ── THE READING ──────────────────────────────────────────────────────────────────────────── */
const pad = (value, width) => String(value).padEnd(width);
console.log('snapshot coverage — the Spanish table against the tree it translates\n');
console.log(`  tables        ${tables.length} loaded by vite.config.ts · ${entries.length} entries · ${entrySources.length} sources`);
console.log(`  scanned       ${buildFiles.length} files the Spanish build transforms${alsoNamed.length ? ` · ${alsoNamed.length} more the table names` : ''}`);
console.log(`  display sites ${sites.size} the transform asked about · ${copySites.length} of them read as copy`);
for (const name of unloaded) console.log(`  WARNING       ${SNAPSHOT_DIR}/${name} sits in the tree and vite.config.ts loads nothing from it`);
for (const name of missing) console.log(`  WARNING       vite.config.ts names ${name} and the tree has no such file`);
for (const source of alsoNamed) if (source.includes(PARKED)) console.log(`  WARNING       ${source} is parked, so its entries reach no screen`);

console.log('\nDEAD — the English is no longer in its source, so the entry translates nothing');
if (!dead.length) console.log('  none');
for (const [source, row] of [...deadBySource].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  ${pad(source, 52)} ${String(row.count).padStart(5)}  ${row.why}`);
  for (const example of VERBOSE ? [] : row.examples) console.log(`      «${example.replace(/\s+/g, ' ').slice(0, 90)}»`);
}
if (VERBOSE) for (const entry of dead) console.log(`      ${pad(entry.source, 46)} ${pad(entry.file, 30)} ${pad(entry.kind, 10)} «${entry.english.replace(/\s+/g, ' ').slice(0, 90)}»`);
console.log(`  ${dead.length} dead ${dead.length === 1 ? 'entry' : 'entries'} in ${deadBySource.size} ${deadBySource.size === 1 ? 'source' : 'sources'}`);
console.log(`  ${duplicated.length} repeat English a live entry at the same source already carries — dropping those costs nothing.`);
console.log(`  ${stranded.length} carry Spanish the transform asks for under another kind — a wrong \`kind\`, not a lost translation:`);
for (const entry of stranded.slice(0, VERBOSE ? Infinity : 12)) {
  console.log(`      ${pad(entry.source, 42)} ${pad(entry.kind, 9)} «${entry.english.replace(/\s+/g, ' ').slice(0, 60)}» → «${entry.spanish.replace(/\s+/g, ' ').slice(0, 34)}»`);
}

console.log(`\nFROZEN — ${retired.size} exact English keys retired by their recorded source change; Spanish tables preserved.`);
console.log('\nUNTRANSLATED — the Spanish build shows these in English. Writing Spanish is Peter\'s.');
if (!untranslated.length) console.log('  none');
for (const [source, row] of [...untranslatedBySource].sort((a, b) => b[1].count - a[1].count).slice(0, VERBOSE ? Infinity : 15)) {
  console.log(`  ${pad(source, 52)} ${String(row.count).padStart(5)}`);
  for (const example of VERBOSE ? [] : row.examples) console.log(`      «${example.replace(/\s+/g, ' ').slice(0, 90)}»`);
}
if (VERBOSE) for (const site of untranslated) console.log(`      ${pad(site.source, 46)} ${pad(site.kind, 10)} «${site.english.replace(/\s+/g, ' ').slice(0, 90)}»`);
const coverage = copySites.length ? Math.round(((copySites.length - untranslated.length) / copySites.length) * 100) : 100;
console.log(`  WARNING: ${untranslated.length} ${untranslated.length === 1 ? 'string' : 'strings'} in ${untranslatedBySource.size} files — ${coverage}% of the ${copySites.length} copy sites read Spanish.`);
console.log('  Writing the Spanish for them is Peter\'s; this gate reports them and stays green.');

if (PRUNE) {
  const drop = new Set(dead.map((entry) => `${entry.file}${KEY}${entry.index}`));
  let removed = 0;
  for (const { file, path, table, entries: rows } of tables) {
    if (!table) continue;
    const kept = rows.filter((_row, index) => !drop.has(`${file}${KEY}${index}`));
    if (kept.length === rows.length) continue;
    removed += rows.length - kept.length;
    writeFileSync(at(path), `${JSON.stringify({ ...table, entries: kept }, null, 2)}\n`);
    console.log(`\n  pruned ${rows.length - kept.length} from ${relative('', path)} — ${kept.length} left`);
  }
  console.log(`\n  ${removed} dead entries pruned. Run the gate again: it reads the tables it just wrote.`);
  process.exit(0);
}

if (dead.length) {
  console.log(`\n  RED — ${dead.length} dead ${dead.length === 1 ? 'entry' : 'entries'}. A dead entry translates nothing:`);
  console.log('  drop them with `node tools/snapshot-coverage.mjs --prune`, then read the diff.\n');
  process.exit(1);
}
console.log('\n  GREEN — every entry is active or explicitly retired in the frozen-English manifest.\n');
