/** Validate an explicitly supplied upstream checkout before a maintenance tool writes anything. */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = fileURLToPath(new URL('../', import.meta.url));

export function baseSource(sourceRoot) {
  if (!sourceRoot) throw new Error('Base Web source: supply --source-root /path/to/baseweb checkout');
  const root = resolve(sourceRoot);
  for (const name of ['package.json', 'LICENSE']) {
    if (!existsSync(resolve(root, name)) || !statSync(resolve(root, name)).isFile()) {
      throw new Error(`Base Web source: missing ${resolve(root, name)}`);
    }
  }
  if (!existsSync(resolve(root, 'src')) || !statSync(resolve(root, 'src')).isDirectory()) {
    throw new Error(`Base Web source: missing ${resolve(root, 'src')}`);
  }
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(appRoot, 'package-lock.json'), 'utf8'));
  const version = lock.packages['node_modules/baseui'].version;
  if (pkg.name !== 'baseui' || pkg.version !== version) {
    throw new Error(`Base Web source: expected baseui ${version}; received ${pkg.name} ${pkg.version}`);
  }
  return { root, version, license: readFileSync(resolve(root, 'LICENSE'), 'utf8') };
}
