#!/usr/bin/env node
/* theme-gate.mjs — the re-theme law, enforced (Peter, 2026-08-21, SUPER KEY).
 *
 * Changing the brand must be a change to the BRAND block in src/rocoto-theme.ts and nothing
 * else. So no file outside the theme may own a colour, a font family, or a corner radius.
 * This gate scans src/ and FAILS (exit 1) on hard-coded brand:
 *
 *   · hex colours  (#abc, #aabbcc, #aabbccdd)
 *   · rgb()/rgba()/hsl() literals
 *   · fontFamily: '...' string literals
 *   · borderRadius with a px literal
 *
 * Allowed, by design:
 *   · src/rocoto-theme.ts — the brand's one home
 *   · rgba(255,255,255,…) / rgba(0,0,0,…) — white/black alphas are geometry (scrims,
 *     elevation), not brand; they read identically under any brand
 *   · 'transparent', 'currentColor', 'inherit', 'none'
 *   · data:image/svg+xml URIs that interpolate ${...} (theme-driven art); STATIC data-URIs
 *     with baked colours are violations — an image that cannot re-theme is hard-coded paint
 *   · generated files (props.json) and *.test.*
 *   · src/prototypes/orders/widget — a script for other companies' sites; see SKIP_DIRS below
 *
 * Run:  node tools/theme-gate.mjs         (all of src/)
 *       node tools/theme-gate.mjs --changed  (git-changed files only)
 *
 * Prove the gate can go red before trusting it: add `color: '#ff0000'` to any section, run,
 * watch it fail, remove it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

const SKIP_FILES = new Set(['rocoto-theme.ts']);
const SKIP_RE = /\.test\.|props\.json$/;
// One folder is outside the law, by name: the order widget (src/prototypes/orders/widget). It is
// a script that runs on another company's website inside a shadow root, where rocoto-theme.ts
// does not exist; its one brand colour arrives from that company's config as `accent`, and its
// paper and ink are its own. Its README lists deriving those from the kit theme as an open point.
const SKIP_DIRS = [join(SRC, 'prototypes', 'orders', 'widget')];

// neutral alphas and keywords that are geometry, not brand
const NEUTRAL = /rgba?\(\s*(?:255\s*,\s*255\s*,\s*255|0\s*,\s*0\s*,\s*0)\s*[,)]/;

const RULES = [
  { name: 'hex colour', re: /#[0-9a-fA-F]{3,8}\b/g,
    ok: (line) => /data:image\/svg\+xml/.test(line) && /\$\{/.test(line) },
  { name: 'rgb/hsl literal', re: /\b(?:rgba?|hsla?)\(/g,
    ok: (line) => NEUTRAL.test(line) },
  { name: 'hard-coded fontFamily', re: /fontFamily:\s*['"`](?!inherit)/g,
    ok: () => false },
  { name: 'px borderRadius', re: /borderRadius:\s*['"`]?\d+px/g,
    ok: (line) => /borderRadius:\s*['"`]?50%/.test(line) },
];

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (SKIP_DIRS.includes(p)) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css)$/.test(f) && !SKIP_FILES.has(f) && !SKIP_RE.test(p)) yield p;
  }
}

let files = [...walk(SRC)];
if (process.argv.includes('--changed')) {
  const changed = new Set(
    execSync('git diff --name-only HEAD', { cwd: ROOT }).toString().split('\n').filter(Boolean)
      .map((f) => join(ROOT, f))
  );
  files = files.filter((f) => changed.has(f));
}

const violations = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/theme-gate-allow/.test(line)) return; // explicit, visible escape hatch
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      if (rule.re.test(line) && !rule.ok(line)) {
        violations.push({ file: relative(ROOT, file), line: i + 1, rule: rule.name, text: line.trim().slice(0, 110) });
      }
    }
  });
}

if (violations.length) {
  console.error(`THEME GATE: ${violations.length} hard-coded brand value(s) outside the theme.\n`);
  for (const v of violations) console.error(`  ${v.file}:${v.line}  [${v.rule}]\n    ${v.text}\n`);
  console.error('Fix: read the value from $theme / useStyletron. If a line is genuinely brand-independent,');
  console.error('mark it `// theme-gate-allow: <why>` — the comment is the audit trail.');
  process.exit(1);
}
console.log(`theme gate: clean (${files.length} files)`);
