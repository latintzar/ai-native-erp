/** Build the shared gallery; candidate publication belongs to its development target. */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { sourceProvenance, copyNotices } from './source-provenance.mjs';
import { buildConstants } from './build-constants.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
await build({ root, configFile: false, publicDir: false, plugins: [react()],
  define: buildConstants({ mode: 'production', command: 'build' }),
  build: { outDir: 'dist-kit', emptyOutDir: true, reportCompressedSize: false,
    rollupOptions: { input: { main: resolve(root, 'index.html') } } },
});
const out = resolve(root, 'dist-kit');
// The gallery owns these public resources. Candidate documents, maps and generated plans
// remain with their candidate build. Existing published resources are preserved by the receiver.
for (const name of ['inter.woff2', 'inter-OFL.txt', 'brand', 'paintings', 'fonts']) {
  cpSync(resolve(root, 'public', name), resolve(out, name), { recursive: true });
}
const provenance = sourceProvenance(root);
writeFileSync(resolve(out, 'kit-version.json'), JSON.stringify({ surface: 'rocoto-kit', ...provenance,
  version: JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version,
  entry: 'index.html', candidate: '/cedar/' }, null, 2) + '\n');
// A compatibility document with an ordinary link also works with scripting disabled.
// Preserve old browser storage at the old origin; release backup retains the old HTML/assets.
writeFileSync(resolve(out, 'app.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Cedar prototype</title><meta http-equiv="refresh" content="0;url=/cedar/">
<link rel="canonical" href="/cedar/"></head>
<body><a href="/cedar/">Open Cedar prototype</a></body></html>
`);

copyNotices(out);
