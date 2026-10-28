/* ONE WAY TO LOAD A TYPESCRIPT MODULE FROM A TOOL, and only one.
 *
 * A tool that wants to run a real `src/` module has to get TypeScript past Node. Transpiling the
 * file in memory and importing it as a `data:` URL works only while the module imports nothing of
 * its own: Node cannot resolve `./paper-manifest` relative to a `data:` URL and throws
 * ERR_UNSUPPORTED_RESOLVE_REQUEST before a single assertion runs. That is what quarantined
 * `test-packing-output.mjs`.
 *
 * So the module is compiled TO DISK, with its imports beside it, and required by file path — the
 * mechanism `test-chip-parse.mjs` already proved and this file now holds for every caller.
 *
 * IT LANDS INSIDE `node_modules/.cache/` for two reasons: a bare `require('react')` or
 * `require('@babel/parser')` in the compiled graph resolves by the ordinary walk up to
 * `app/node_modules`, and the working tree keeps nothing afterwards.
 *
 * `--rootDir src` is what makes the emitted path predictable: `src/prototypes/cedar/chip-parse.ts` becomes
 * `<cache>/prototypes/cedar/chip-parse.js`, whatever else the compile pulled in. A type error fails the compile
 * and therefore the caller, so every user of this loader is a typecheck as well.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Compile `source` (a path under `app/src`, relative to `app/`) and everything it imports into
 *  `node_modules/.cache/<cacheName>/`, and return the compiled entry's absolute path. */
export function compileTypeScript(source, cacheName) {
  const out = join(APP_ROOT, 'node_modules', '.cache', cacheName);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  execFileSync(join(APP_ROOT, 'node_modules', '.bin', 'tsc'), [
    source,
    'src/build-constants.d.ts',
    '--outDir', out,
    '--rootDir', 'src',
    '--module', 'commonjs',
    '--target', 'ES2020',
    '--strict',
    '--skipLibCheck',
    '--esModuleInterop',
    '--allowSyntheticDefaultImports',
    '--resolveJsonModule',
    // `tsconfig.app.json`'s own types: vite/client is what declares `*.png` and friends as modules,
    // and a compile that reaches one of those imports fails without it.
    '--types', 'vite/client',
    '--jsx', 'react-jsx',
  ], { cwd: APP_ROOT, stdio: 'inherit' });
  return join(out, relative('src', source).replace(/\.tsx?$/, '.js'));
}

/** Compile `source` and hand back its exports. */
export function loadTypeScript(source, cacheName) {
  return createRequire(import.meta.url)(compileTypeScript(source, cacheName));
}
