#!/usr/bin/env node
/* test-painting-map.mjs — THE RESOLUTION TABLE (FEED-IA §200.2, E197.24).
 *
 * `painting-map.ts` answers one question — «which painting does this WORD wear?» — for two callers
 * with two different bars, and a change to either one is a change to what hundreds of rows draw:
 *
 *   exactPaintingFor   the SKU's own face. `ProductFace` (the Products row, the tarifa, the
 *                      albarán line) and `SKUArtwork` (the Product Sheet) call it. Exact evidence:
 *                      a related family painting is not this SKU's approved artwork.
 *   paintingFor        the LIBRARY's answer for a word. The writing line's resolving `Face` and the
 *                      catalogue export's `illustration` call it. It walks rungs — the name, the
 *                      look-distinct sort, the kind — and a wrong rung dresses a tin of chickpeas
 *                      as a cow.
 *
 * SO THE TEST IS A TABLE, NOT A HANDFUL OF CASES. It resolves a corpus of ten thousand real trade
 * surfaces — every binding in `reference-lexicon.ts`, every name in the painted library, every row
 * of every house's catalogue — and holds the whole reading against a recorded one. That is what
 * makes «no resolution regressed» a measurement rather than a hope: a rung that widens by one word
 * shows up here as the exact list of surfaces that changed their mind, and each one is read before
 * it is accepted.
 *
 * FOUR PINNED READINGS ON TOP OF THE TABLE, because a snapshot alone only says «the same as
 * yesterday» and some of these are laws:
 *   ROUND TRIP    every painted library row resolves BY ITS OWN NAME to ITS OWN tile
 *   THE EXAM      the thirteen readings `library/paintings/exam_map.py` has already gone red on
 *   THE SEATS     the named catalogue rows whose face E197 is about
 *   NO COMMISSION a commissioned combination is reachable by slug and never by a word
 *
 * RUN, from baseweb/:
 *   node tools/test-painting-map.mjs                     the pinned readings + the corpus invariants
 *   node tools/test-painting-map.mjs --snapshot out.json record the whole table (10k+ rows)
 *   node tools/test-painting-map.mjs --diff base.json    read every surface that changed its mind
 *   node tools/test-painting-map.mjs --verbose           print each pinned reading as it passes
 *
 * PROVE IT RED BEFORE TRUSTING IT (the gates-fail-closed law): change one expectation below to a
 * painting that is not the answer, run, watch it name that surface and exit 1, put it back. The
 * `--diff` half is proven the same way — snapshot, edit a rung, diff, read the list.
 *
 * HOW IT LOADS TYPESCRIPT (the house road, from tools/test-chip-parse.mjs): `tsc` transpiles the
 * modules and their imports to CommonJS into `node_modules/.cache/`, and this tool requires that.
 * It lands inside node_modules so the emitted `require('react')` in `catalogue.ts` resolves by the
 * ordinary walk up, and so the build leaves nothing in the working tree. A type error fails the
 * compile and therefore the test, which makes this a tsc gate as well as an assertion run.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'node_modules', '.cache', 'painting-map-test');
const VERBOSE = process.argv.includes('--verbose');
const flag = (name) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? null : process.argv[at + 1];
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execFileSync(join(ROOT, 'node_modules', '.bin', 'tsc'), [
  'src/prototypes/cedar/painting-map.ts',
  'src/prototypes/cedar/reference-lexicon.ts',
  'src/prototypes/cedar/catalogue.ts',
  'src/scenarios/data/cast.ts',
  '--outDir', OUT,
  '--module', 'commonjs',
  '--target', 'ES2020',
  '--strict',
  '--skipLibCheck',
  '--esModuleInterop',
  '--allowSyntheticDefaultImports',
  '--jsx', 'react-jsx',
], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });

const CANDIDATE_OUT = join(OUT, 'prototypes', 'cedar');
const require = createRequire(join(CANDIDATE_OUT, 'anchor.cjs'));
const { PAINTINGS, paintingFor, exactPaintingFor, suppressedPaintingFor } = require(join(CANDIDATE_OUT, 'painting-map.js'));
const { REF_WORDS } = require(join(CANDIDATE_OUT, 'reference-lexicon.js'));
const { AMENDMENTS, SORTS, amendmentProduct, sortProduct } = require(join(CANDIDATE_OUT, 'catalogue.js'));
const { CASTS } = require(join(OUT, 'scenarios', 'data', 'cast.js'));

const tile = (slug) => (slug === null ? null : `/paintings/${slug}.webp`);

/* ── THE CORPUS ───────────────────────────────────────────────────────────────────────────────
 * Every surface anyone has actually written for a node (the lexicon), every name the library
 * calls its own subjects, and every row the three houses hold. Deduplicated, sorted, so the
 * recorded table is stable across runs and a diff is a diff. */
function corpus() {
  const seen = new Map();
  const add = (text, origin) => {
    if (typeof text !== 'string' || !text.trim()) return;
    if (!seen.has(text)) seen.set(text, origin);
  };
  for (const painting of PAINTINGS) { add(painting.es, 'library'); add(painting.slug, 'library'); }
  for (const word of REF_WORDS) add(word.w, 'lexicon');
  for (const [sector, cast] of Object.entries(CASTS)) {
    for (const product of cast.products) add(product.name, `cast:${sector}`);
    for (const family of cast.families ?? []) add(family.name, `family:${sector}`);
  }
  for (const amendment of AMENDMENTS) add(amendmentProduct(CASTS[amendment.sector], amendment).name, 'amendment');
  for (const sort of SORTS) add(sortProduct(CASTS[sort.sector], sort).name, 'sort');
  return [...seen.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, origin]) => ({ name, origin, library: paintingFor(name), exact: exactPaintingFor(name) }));
}

/* ── THE PINNED READINGS ─────────────────────────────────────────────────────────────────────── */

/* The thirteen `library/paintings/exam_map.py` has already gone red on, kept here so the exam runs
 * against the COMPILED module as well as against its own mechanical type-strip. `null` is a real
 * answer and is examined too: a resolver that always finds something is a resolver that will dress
 * a tin of chickpeas as a cow. */
const EXAM = [
  ['Merluza', 'merluza'],
  ['MERLUZA DE PINCHO FRESCA', 'merluza'],
  ['Pechuga de pavo asada', 'pechuga-de-pavo'],
  ['Carne picada de ternera', 'carne-picada-de-ternera'],
  ['Tomate raf', 'tomate-raf'],
  ['Pescado y marisco', 'pescado-y-marisco'],
  ['Pescado blanco', 'pescado-blanco'],
  ['Cefalópodos', 'cefalopodos'],
  ['Pescado de crianza', 'pescado-de-crianza'],
  ['Vacuno', 'vacuno'],
  ['Aves', 'aves'],
  ['Queso manchego curado', 'queso-manchego'],
  ['Zzzz producto que no existe', null],
];

/* The rungs E197.24 opened, each with the reason it is a reading and not a coincidence. A word-level
 * rung is the one that can widen by accident, so the readings that would go wrong if it widened too
 * far are pinned beside the ones it was opened for. */
const LIBRARY = [
  /* THE DEFECT E197.24 CLOSED: a key of more than one word is carried hyphenated — `pez-espada`,
     `ancas-de-rana` — and a hyphen is a character nobody writing a delivery note ever types, so the
     sort rung and the kind rung could not see their own rows. Reading the key as its words finds
     them. Each of these answered `null` before the change. */
  ['Pez espada en rodajas', 'pez-espada-rodajas'],
  ['Ancas de rana congeladas', 'ancas-de-rana'],
  /* the kind rung reaches the same rows now, and stands in with the plainest form the library has
     — swordfish where the house wrote swordfish, in the form the library happens to hold */
  ['Pez espada fresco', 'pez-espada-tacos'],
  /* EVERY WORD OF THE KEY, CONNECTORS INCLUDED. `ancas-de-rana` is said by «Ancas de rana
     congeladas» and not by «Rana ancas», which drops the «de». Skipping connectors would widen
     every multi-word key at once, and a rung is widened one measurement at a time. */
  ['Rana ancas', null],
  /* the reviewed kind binding, so the writing line and the SKU's face agree on one painting */
  ['Jamón al corte', 'jamon-serrano'],
  /* and it is keyed exactly, so a SKU that names its variety still wears its own */
  ['Jamón ibérico al corte', 'jamon-iberico'],
  /* THE REPAINT LANDED (E197.25). `patata-monalisa.webp` was a Mona-Lisa portrait wearing a
     potato's colours and was held out of every seat by slug; it is a potato now, so the writing
     line and the `illustration` column of the catalogue export carry it again. */
  ['Patata monalisa', 'patata-monalisa'],
  ['PATATA MONALISA 25KG', 'patata-monalisa'],
  ['Patata agria', 'patata-agria'],
  ['Patata roja', 'patata-roja'],
  /* THE FROZEN PRAWN, BY THE LIBRARY'S OWN NAME (E197.25) — a state the matrix never carried as a
     form until this tile was painted. */
  ['Gamba roja · congelado', 'gamba-roja-congelado'],
  /* AND THE TWO BARS AGAIN, on the same subject. This is the LIBRARY's answer for a word somebody
     is writing on a delivery note, and «congelada» is not «congelado», so the kind rung answers
     with the kind: the plain red prawn. The SKU's own face is held to exact evidence and reaches
     the frozen tile through one reviewed line — the SEATS table below. */
  ['Gamba roja de Palamós · congelada', 'gamba-roja'],
  /* THE TWO BARS, on purpose. This is the LIBRARY's answer for a word somebody is typing, so where
     a kind exists only as its varieties the plainest of them stands in — «Manzana pinova» has no
     painting and the apple that answers is the shortest-named one. The SKU's own face is held to
     the other bar and answers nothing at all (`exactPaintingFor`, the SEATS table below). */
  ['Manzana starking argentina', 'manzana-starking'],
  ['Manzana pinova argentina', 'manzana-fuji'],
  /* a product always outranks a shelf: a tray of mince is not a cow in a pasture */
  ['Carne picada de cerdo', 'carne-picada-de-cerdo'],
  /* and a word the library has nothing for keeps its family's drawn mark */
  ['Detergente lavavajillas', null],
];

/* The seats E197 is about — what the SKU's own face resolves to, which is the gate's reading. */
const SEATS = [
  ['Jamón al corte', 'jamon-serrano'],
  ['Gamba roja de Palamós', 'gamba-roja'],
  ['Lubina de estero', 'lubina'],
  ['PIMIENTO ROJO 1ª', 'pimiento-rojo'],
  ['CEBOLLA SACO 25KG', 'cebolla-blanca'],
  /* THE TWO SEATS E197 OWED, BOTH PAINTED (E197.25). The potato's tile was the Mona-Lisa portrait,
     suppressed at review; it is a potato now. The frozen prawn had no tile at all and has one. */
  ['Patata monalisa', 'patata-monalisa'],
  ['Gamba roja de Palamós · congelada', 'gamba-roja-congelado'],
  /* and the fresh prawn keeps its own, so the reviewed line reaches the state and nothing else */
  ['Gamba roja', 'gamba-roja'],
];

const GREEN = [];
const RED = [];
const check = (ok, label, detail = '') => {
  (ok ? GREEN : RED).push(label + (detail ? ` · ${detail}` : ''));
  if (!ok || VERBOSE) console.log(`${ok ? 'GREEN' : 'RED  '} ${label}${detail ? ` · ${detail}` : ''}`);
};

function pinned() {
  for (const [name, slug] of EXAM) {
    check(paintingFor(name) === tile(slug), `the exam · «${name}» wears ${slug ?? 'its drawn mark'}`,
      paintingFor(name) === tile(slug) ? '' : `answered ${paintingFor(name)}`);
  }
  for (const [name, slug] of LIBRARY) {
    check(paintingFor(name) === tile(slug), `the library · «${name}» wears ${slug ?? 'its drawn mark'}`,
      paintingFor(name) === tile(slug) ? '' : `answered ${paintingFor(name)}`);
  }
  for (const [name, slug] of SEATS) {
    check(exactPaintingFor(name) === tile(slug), `the SKU's face · «${name}» wears ${slug ?? 'its drawn mark'}`,
      exactPaintingFor(name) === tile(slug) ? '' : `answered ${exactPaintingFor(name)}`);
  }

  /* ROUND TRIP — the law that keeps the library honest with itself. Every painted subject is
   * reachable by the name the library gives it, and lands on its OWN tile. A rung that widens too
   * far breaks this on the row it stole; a rung that narrows breaks it on the row it dropped.
   * TWO DELIBERATE EXCEPTIONS, each asserted on its own instead: the commissioned combination,
   * which answers to no word, and a tile held out at review, which answers with the drawn mark. */
  const reachable = PAINTINGS.filter((painting) => !painting.combo && !suppressedPaintingFor(painting.es));
  const strays = reachable
    .map((painting) => ({ painting, got: paintingFor(painting.es) }))
    .filter(({ painting, got }) => got !== tile(painting.slug));
  check(strays.length === 0, `round trip · every painted subject wears its own tile by its own name`,
    strays.length ? strays.slice(0, 8).map(({ painting, got }) => `${painting.es}→${got}`).join(', ')
      : `${reachable.length} subjects`);

  /* A TILE REFUSED AT REVIEW is held out of both callers, and NAMED, so the debt reads as «painted
   * and refused» rather than «nothing painted». The gate says the same sentence off the same
   * reading. E197.25 repainted the monalisa potato and `SUPPRESSED_PAINTINGS` is empty today, so
   * this is the PROPERTY over whatever the set holds — none, one, or ten — rather than a census of
   * a standing refusal. Put `patata-monalisa` back in that set and this is the leg that must stay
   * GREEN while the seats go red, which is how the machinery is proven with nothing owed. */
  const held = PAINTINGS.filter((painting) => suppressedPaintingFor(painting.es));
  check(held.every((painting) => paintingFor(painting.es) === null
    && exactPaintingFor(painting.es) === null),
    `suppressed · a tile refused at review answers no seat, and says which tile it is`,
    held.map((painting) => `${painting.es}→${suppressedPaintingFor(painting.es)}`).join(', ')
    || 'no tile stands refused');

  /* NO COMMISSION — a combination is painted for one partner card and addressed by slug. A word
   * must never reach it: «Marisco» is the shelf's own gamba, never the two-shelf commission. */
  const commissions = PAINTINGS.filter((painting) => painting.combo);
  const reached = commissions.filter((painting) => corpusTable.some((row) => row.library === tile(painting.slug)
    || row.exact === tile(painting.slug)));
  check(reached.length === 0, `no commission · a commissioned combination answers to no word`,
    reached.map((painting) => painting.slug).join(', ') || `${commissions.length} held out of the search`);

  /* THE SHIPPED TILE — every painting either caller can hand a seat is a file the app serves. A
   * resolution to a tile that is not on disk draws a broken image, which is worse than the mark. */
  const drawn = new Set(corpusTable.flatMap((row) => [row.library, row.exact]).filter(Boolean));
  const slugs = new Set(PAINTINGS.map((painting) => tile(painting.slug)));
  const unknown = [...drawn].filter((painting) => !slugs.has(painting));
  check(unknown.length === 0, `every resolution names a row of the library`, unknown.slice(0, 6).join(', ')
    || `${drawn.size} distinct tiles reached`);
}

const corpusTable = corpus();

const snapshot = flag('--snapshot');
if (snapshot) {
  writeFileSync(snapshot, JSON.stringify({ rows: corpusTable }, null, 1) + '\n');
  console.log(`recorded ${corpusTable.length} surfaces → ${snapshot}`);
  process.exit(0);
}

const baseline = flag('--diff');
if (baseline) {
  const before = new Map(JSON.parse(readFileSync(baseline, 'utf8')).rows.map((row) => [row.name, row]));
  const changed = corpusTable.filter((row) => {
    const was = before.get(row.name);
    return !was || was.library !== row.library || was.exact !== row.exact;
  });
  const gone = [...before.keys()].filter((name) => !corpusTable.some((row) => row.name === name));
  console.log(`${corpusTable.length} surfaces · ${changed.length} changed · ${gone.length} no longer asked`);
  for (const row of changed) {
    const was = before.get(row.name);
    console.log(`  «${row.name}» (${row.origin})`);
    if (!was) { console.log('    NEW surface'); continue; }
    if (was.library !== row.library) console.log(`    library  ${was.library} → ${row.library}`);
    if (was.exact !== row.exact) console.log(`    exact    ${was.exact} → ${row.exact}`);
  }
  for (const name of gone) console.log(`  «${name}» is no longer in the corpus`);
  process.exit(0);
}

pinned();
console.log(`\npainting-map · GREEN ${GREEN.length} · RED ${RED.length} · corpus ${corpusTable.length} surfaces`);
for (const label of RED) console.log(`  RED ${label}`);
process.exit(RED.length ? 1 : 0);
