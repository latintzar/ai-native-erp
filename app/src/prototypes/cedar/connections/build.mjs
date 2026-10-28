/** Isolated private connection review. The ordinary Cedar and kit entries keep their build graph. */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync } from 'node:fs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '../../../..');
const out = resolve(root, 'dist-cedar-connections');
await build({
  root,
  configFile: false,
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: out,
    emptyOutDir: true,
    reportCompressedSize: false,
    rollupOptions: { input: resolve(here, 'index.html') },
  },
});
copyFileSync(resolve(out, 'src/prototypes/cedar/connections/index.html'), resolve(out, 'index.html'));
mkdirSync(resolve(out, 'brand'), { recursive: true });
copyFileSync(resolve(root, 'public/brand/rocoto-mark.svg'), resolve(out, 'brand/rocoto-mark.svg'));
