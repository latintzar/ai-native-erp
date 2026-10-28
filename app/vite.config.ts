import { guestAssets } from './tools/guest-assets.mjs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { prepareSpanishDisplaySource } from './src/prototypes/cedar/snapshot/spanish-display-source';
import { lookupFromEntries, translateSpanishSnapshotSource, type SnapshotEntry } from './src/prototypes/cedar/snapshot/spanish-source-transform';
import { buildConstants } from './tools/build-constants.mjs';
import { sourceProvenance } from './tools/source-provenance.mjs';

/* The kit (index.html), scenarios (scenarios.html), the Cedar candidate (app.html) and the bodega
 * candidate (bodega-pay-later.html) are separate entries. Scenarios and Cedar import the shared kit components and theme;
 * Cedar's own UI and model stay under src/prototypes/cedar/. Shared changes reach their
 * importers, while candidate changes belong to that candidate. */
export default defineConfig(({ mode, command }) => {
  const spanishSnapshot = mode === 'spanish-snapshot';
  /* WHOSE BROWSER STATE THE SPANISH ENTRY WRITES INTO (`snapshot/spanish-display-source.ts`).
   * `npm run build:app-es` publishes the standalone disposable snapshot and keeps its own
   * `rocoto-spanish-app-` namespace. `tools/build-english-app.mjs` sets ROCOTO_SPANISH_STATE=shared
   * for the copy it embeds at `/cedar/es/`, where the two entries are one workspace in two languages. */
  const sharedState = process.env.ROCOTO_SPANISH_STATE === 'shared';
  const appOnly = process.env.ROCOTO_BUILD_APP_ONLY === '1';
  const provenance = sourceProvenance(__dirname);
  const sourceCommit = spanishSnapshot ? provenance.sourceCommit : '';
  const entries: SnapshotEntry[] = spanishSnapshot
    ? ['es-core.json', 'es-core-luna.json', 'es-settings-export.json', 'es-catalogue-scenarios.json', 'es-quality-dossier.json', 'es-quality-data.json', 'es-quality-product.json', 'es-quality-settings-data.json', 'es-quality-activation.json', 'es-quality-chat.json', 'es-quality-final.json', 'es-quality-secondary.json', 'es-quality-demo-data.json', 'es-quality-workflows.json', 'es-quality-chrome.json'].flatMap((file) => {
      const at = resolve(__dirname, 'src/prototypes/cedar/snapshot', file);
      return existsSync(at) ? (JSON.parse(readFileSync(at, 'utf8')).entries ?? []) : [];
    }) : [];
  const lookup = lookupFromEntries(entries);
  /* The runtime `make dev` started, read the same way `buildConstants` reads it. */
  const devRuntime = command === 'serve'
    ? (loadEnv(mode, __dirname, 'VITE_').VITE_ROCOTO_RUNTIME_BASE ?? '').trim().replace(/\/$/, '')
    : '';
  return {
  plugins: [
    guestAssets(),
    spanishSnapshot && {
      name: 'rocoto-spanish-snapshot-source-transform', enforce: 'pre' as const,
      transform(code: string, id: string) {
        if (!/\/src\/(?:prototypes\/cedar|scenarios|rocoto)\/.*\.(?:ts|tsx)$/.test(id)) return null;
        const source = id.slice(id.indexOf('/src/')).replace(/^\//, '');
        let prepared = code;
        if (source === 'src/prototypes/cedar/day.ts') prepared = prepared.replace('=> (n === 1 ? one : many);', `=> ({band:'tarifa',bands:'tarifas',tier:'tarifa',tiers:'tarifas',line:'línea',lines:'líneas',order:'pedido',orders:'pedidos',product:'producto',products:'productos',variation:'variante',variations:'variantes',customer:'cliente',customers:'clientes',account:'cliente',accounts:'clientes',page:'página',pages:'páginas',truck:'camión',trucks:'camiones',divider:'separador',dividers:'separadores',copy:'copia',copies:'copias',stop:'parada',stops:'paradas',month:'mes',months:'meses',day:'día',days:'días',pattern:'patrón',patterns:'patrones',price:'precio',prices:'precios'} as Record<string,string>)[n === 1 ? one : many] ?? (n === 1 ? one : many);`);
        const transformed = translateSpanishSnapshotSource(prepared, source, lookup);
        const localized = prepareSpanishDisplaySource(transformed ?? prepared, source, { sharedState });
        return localized !== code ? { code: localized, map: null } : null;
      },
      transformIndexHtml(html: string) { return html.replace('__ROCO_SOURCE_COMMIT__', sourceCommit); },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'spanish-snapshot-provenance.json', source: JSON.stringify({ locale: 'es-ES', ...provenance, generator: 'babel-ast-vite-spanish-source-transform', translatedEntries: entries.length, policy: 'english-primary-frozen-spanish' }, null, 2) });
      },
    }, react(),
  ].filter(Boolean),
  define: buildConstants({ mode, command }),
  /* ── THE PROTOTYPE API, ON THE PAGE'S OWN ORIGIN, IN DEVELOPMENT ─────────────────────────────
   * The bodega walk signs in with a `__Host-bodega_session` cookie, and `mock-api` answers CORS
   * with `allow_credentials=False` on purpose (`main.py`) — so a cross-origin call from the dev
   * server could never carry that cookie, and the walk would read every answer as `awaiting`.
   * A published build is same-origin already; this puts development on the same footing.
   * `make dev` starts the runtime and names it in `VITE_ROCOTO_RUNTIME_BASE`, so the proxy exists
   * only when a runtime does, and only while `vite` is serving — `vite build` emits no server. */
  server: {
    port: 5290,
    ...(devRuntime ? { proxy: { '/api': { target: devRuntime, changeOrigin: false } } } : {}),
  },
  build: {
    // Compress-size reporting is unnecessary for publishing and spikes memory on this host.
    reportCompressedSize: false,
    // Isolated verification may reuse the existing public files without a second RAM-backed copy.
    copyPublicDir: process.env.ROCOTO_BUILD_PUBLIC_FILES !== '0',
    rollupOptions: {
      // Keep the shared UI runtime in one cacheable request. The former fine-grained graph
      // exhausted Chromium's outstanding resource budget on repeated sheet reloads.
      ...(!spanishSnapshot ? { output: { codeSplitting: { minSize: 20000, groups: [{ name: 'ui-vendor', test: /node_modules/ }] } } } : {}),
      input: spanishSnapshot ? { appEs: resolve(__dirname, 'app-spanish.html') } : appOnly ? { app: resolve(__dirname, 'app.html') } : {
        main: resolve(__dirname, 'index.html'), scenarios: resolve(__dirname, 'scenarios.html'), app: resolve(__dirname, 'app.html'),
      },
    },
  },
  };
});
