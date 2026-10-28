/** Describe a portable source export without borrowing an ancestor repository's HEAD. */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function sourceProvenance(appRoot = fileURLToPath(new URL('../', import.meta.url))) {
  const root = realpathSync(resolve(appRoot, '..'));
  const source = JSON.parse(readFileSync(resolve(root, 'SOURCE.json'), 'utf8'));
  let releaseCommit = null;
  try {
    const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (realpathSync(gitRoot) === root) releaseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { /* A downloaded source archive has provenance without a Git database. */ }
  return { sourceCommit: releaseCommit ?? 'source-export', upstreamCommit: source.upstreamCommit, releaseCommit };
}

export function copyNotices(outDir) {
  const root=fileURLToPath(new URL('../../', import.meta.url));
  for(const name of ['LICENSE','NOTICE.md','THIRD-PARTY-NOTICES.txt']){
    const source=resolve(root,name);
    if(existsSync(source))copyFileSync(source,resolve(outDir,name));
  }
}
