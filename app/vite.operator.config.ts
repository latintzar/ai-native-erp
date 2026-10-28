import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Maintained support UI: its artifact has an independent publication target.
export default defineConfig({
  base: '/operator/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5291, strictPort: true },
  build: {
    outDir: 'dist-operator',
    copyPublicDir: false,
    reportCompressedSize: false,
    rollupOptions: { input: resolve(__dirname, 'operator.html') },
  },
});
