/** The focused channels check page, served under /check/ on the preview origin. */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync } from 'node:fs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '../../../..');
const out = resolve(root, 'dist-cedar-check');
await build({
  root,
  configFile: false,
  base: '/check/',
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: out,
    emptyOutDir: true,
    reportCompressedSize: false,
    rollupOptions: { input: resolve(here, 'index.html') },
  },
});
mkdirSync(out, { recursive: true });
copyFileSync(resolve(out, 'src/prototypes/cedar/channels-check/index.html'), resolve(out, 'index.html'));
