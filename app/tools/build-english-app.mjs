import { guestAssets } from './guest-assets.mjs';
/** Build the Cedar development candidate, independently of the kit gallery.
 *
 * TWO ENTRIES, ONE ARTIFACT. Cedar's English build is the design source; the Spanish snapshot is
 * generated from that same source by `vite.config.ts`'s `spanish-snapshot` mode. Until now the
 * Spanish entry was only ever published on its own, so the development artifact a person opens at
 * `/cedar/` had no Spanish to switch to and `Settings → Language` was an inactive promise.
 *
 * So this script runs BOTH builds, sequentially, in one process — the English artifact, then the
 * Spanish snapshot into `cedar/es/` with its own base. Sequentially is not a style choice: two
 * Vite builds at once exhaust this host's memory and the artifact the publish chain reads is the
 * casualty.
 *
 * `cedar/prototype.json` carries both entries and both hashes, so a publication receipt names
 * exactly what was served in each language.
 */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sourceProvenance, copyNotices } from './source-provenance.mjs';
import { buildConstants } from './build-constants.mjs';
const guestPrefix = (process.env.VITE_ATELIER_GUEST_PREFIX || '').trim();
const root = fileURLToPath(new URL('../', import.meta.url));
/* One publishable output by default. A worker or a drive may build into its own ignored
 * `dist-*` directory so concurrent verification never empties the artifact the publish chain reads. */
const outDirName = /^dist-[a-z0-9-]+$/.test(process.env.ROCOTO_BUILD_OUT_DIR ?? '') ? process.env.ROCOTO_BUILD_OUT_DIR : 'dist-export-review';
await build({
  root,
  configFile: false,
  plugins: [guestAssets(), react()],
  base: guestPrefix ? `${guestPrefix}/` : '/',
  define: buildConstants({ mode: 'production', command: 'build' }),
  build: {
    outDir: outDirName,
    emptyOutDir: true,
    rollupOptions: { input: { app: resolve(root, 'app.html') } },
  },
});

// One build, named development entry and compatibility aliases. Absolute Vite asset URLs
// preserve the same Cedar/browser-state origin at each entry; sibling previews own their origin.
const out = resolve(root, outDirName);

/* ── THE MARKER THAT MAKES THE LANGUAGE ROW A FACT (`../src/prototypes/cedar/display-language.ts`)
 * Settings → Language used to relocate to a constant, so `make dev` — which publishes no
 * `cedar/es/` — sent a person from Cedar to whatever its SPA fallback answers with, and the stored
 * preference sent them back there on every later load. THIS script is the only thing that writes a
 * Spanish entry, so THIS script is what says one exists. Every entry document it publishes carries
 * the meta; a document without it publishes no Castellano, and the boot stays where it is. */
const SPANISH_ENTRY = 'cedar/es';
const SPANISH_ENTRY_PATH = `${guestPrefix}/${SPANISH_ENTRY}/`;
const marker = `<meta name="rocoto-spanish-entry" content="${SPANISH_ENTRY_PATH}">`;
const markEntry = (file) => {
  const at = resolve(out, file);
  const html = readFileSync(at, 'utf8');
  if (html.includes('name="rocoto-spanish-entry"')) return;
  writeFileSync(at, html.replace('</head>', `${marker}</head>`));
};
markEntry('app.html');

mkdirSync(resolve(out, 'cedar'), { recursive: true });
copyFileSync(resolve(out, 'app.html'), resolve(out, 'cedar/index.html'));
copyFileSync(resolve(out, 'app.html'), resolve(out, 'index.html'));
console.log('Cedar: /cedar/; compatibility entries: /app.html and /');

/* ── THE SPANISH ENTRY, INSIDE THE SAME ARTIFACT (`../Spanish-snapshot.md`) ───────────────────
 * It reuses `vite.config.ts` so the source transform and the reviewed `es-*.json` tables apply
 * exactly as `npm run build:app-es` applies them. Two things differ, and both are deliberate:
 *
 *   base `/cedar/es/`      its own hashed assets sit beside its own entry, and the English build's
 *                          assets are left untouched.
 *   ROCOTO_SPANISH_STATE   `shared` — this copy is the same workspace in the other language, so it
 *                          keeps the English entry's `rocoto-app-` browser state. The standalone
 *                          command still publishes a disposable demo with its own namespace.
 *
 * Public files are already at the artifact root from the English build, so this build skips them
 * (ROCOTO_BUILD_PUBLIC_FILES=0) and the entry's own absolute `/inter.woff2` is restored below. */
const esOut = resolve(out, SPANISH_ENTRY);
rmSync(esOut, { recursive: true, force: true });
process.env.ROCOTO_SPANISH_STATE = 'shared';
process.env.ROCOTO_BUILD_PUBLIC_FILES = '0';
await build({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  mode: 'spanish-snapshot',
  base: SPANISH_ENTRY_PATH,
  build: { outDir: esOut, emptyOutDir: true },
});
renameSync(resolve(esOut, 'app-spanish.html'), resolve(esOut, 'index.html'));
/* The shared public files live at the artifact root; the base must not follow them there. */
const esEntry = resolve(esOut, 'index.html');
writeFileSync(esEntry, readFileSync(esEntry, 'utf8').split(`${SPANISH_ENTRY_PATH}inter.woff2`).join(`${guestPrefix}/inter.woff2`));
/* The Spanish entry carries the same marker, so Settings offers both languages from either side. */
markEntry(`${SPANISH_ENTRY}/index.html`);
console.log(`Cedar Castellano: ${SPANISH_ENTRY_PATH}`);

const provenance = sourceProvenance(root);

writeFileSync(resolve(out, 'cedar/prototype.json'), JSON.stringify({
  surface: 'cedar', environment: 'development',
  ...provenance,
  entrySha256: createHash('sha256').update(readFileSync(resolve(out, 'cedar/index.html'))).digest('hex'),
  spanishEntry: SPANISH_ENTRY_PATH,
  spanishEntrySha256: createHash('sha256').update(readFileSync(esEntry)).digest('hex'),
}, null, 2) + '\n');


copyNotices(out);
