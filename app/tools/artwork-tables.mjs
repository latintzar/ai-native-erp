#!/usr/bin/env node
/* artwork-tables.mjs — the catalogue's rows and the painting each one resolves to, as JSON.
 *
 * §200.2: «Every product carries artwork, and the house makes it.» A gate can only say that if it
 * reads the SAME tables the app reads and resolves them the SAME way the app resolves them. So this
 * tool imports the real modules — `cast.ts` (the houses' products), `catalogue.ts` (the amendment
 * registry and `amendmentProduct`) and `painting-map.ts` (`exactPaintingFor`, which is what
 * `ProductFace` and `SKUArtwork` call) — and prints one row per catalogue subject.
 *
 * Nothing here re-implements the resolution. A row's `exact` field is literally what the app would
 * draw in that seat, which is the only reading a gate is allowed to fail on.
 *
 * HOW IT LOADS TYPESCRIPT (the house road, from tools/test-chip-parse.mjs): `tsc` transpiles the
 * three modules and their imports to CommonJS into `node_modules/.cache/`, and this tool requires
 * that. It lands inside node_modules so the emitted `require('react')` in `catalogue.ts` resolves by
 * the ordinary walk up, and so the build leaves nothing in the working tree.
 *
 * RUN:  node tools/artwork-tables.mjs            (from baseweb/ — prints JSON on stdout)
 *       node tools/artwork-tables.mjs --pretty
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'node_modules', '.cache', 'artwork-tables');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execFileSync(join(ROOT, 'node_modules', '.bin', 'tsc'), [
  'src/prototypes/cedar/painting-map.ts',
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
const { exactPaintingFor, paintingFor, suppressedPaintingFor } = require(join(CANDIDATE_OUT, 'painting-map.js'));
const { AMENDMENTS, SORTS, amendmentProduct, sortProduct } = require(join(CANDIDATE_OUT, 'catalogue.js'));
const { CASTS } = require(join(OUT, 'scenarios', 'data', 'cast.js'));

const rows = [];
const add = (sector, kind, id, name, extra = {}) => rows.push({
  sector, kind, id, name,
  exact: exactPaintingFor(name),
  library: paintingFor(name),
  /* THE TILE THAT WAS PAINTED AND REFUSED. A row with no painting has two very different debts —
     nothing has been painted for this subject yet, or something was and a reviewer held it out —
     and a gate that says «no painting resolves for this name» for both sends the next session to
     read the resolver when the fault is in the picture. */
  suppressed: suppressedPaintingFor(name),
  ...extra,
});

for (const [sector, cast] of Object.entries(CASTS)) {
  for (const product of cast.products) add(sector, 'product', product.id, product.name, { code: product.code ?? null });
}
for (const amendment of AMENDMENTS) {
  const cast = CASTS[amendment.sector];
  const product = amendmentProduct(cast, amendment);
  /* A REVIEWED SELLABLE MEMBER IS A PRODUCT; AN UNREVIEWED WORD IS STILL THE CUSTOMER'S.
     `stock.tsx` draws the first as a catalogue row with its own sheet and its own price, and the
     second as customer wording waiting to be adopted — so the gate holds them to different bars and
     says which is which rather than counting them together. */
  add(amendment.sector, amendment.sellable || amendment.hand ? 'variant' : 'wording',
      amendment.id, product.name, { base: amendment.base, word: amendment.word, facet: amendment.facet });
}
for (const sort of SORTS) {
  const cast = CASTS[sort.sector];
  add(sort.sector, 'wording', sort.id, sortProduct(cast, sort).name, { base: sort.under });
}

process.stdout.write(JSON.stringify({ rows }, null, process.argv.includes('--pretty') ? 2 : 0) + '\n');
