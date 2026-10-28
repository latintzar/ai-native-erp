#!/usr/bin/env node
/* fork.mjs — duplicate a Base Web component's SOURCE into Rocoto's tree, then edit it there.
 *
 * THE METHOD (Peter, 2026-08-21): use Base 1:1 wherever Base already has the component. Where
 * Rocoto needs something Base does not ship, do not invent it from outside — duplicate the
 * nearest Base component's source, edit the copy, and slot it in. The fork then inherits Base's
 * rules on composition and assembly: the overrides contract, `getOverrides`, the shared-props
 * shape, theme-driven styling, focus and keyboard handling, the transition tokens. That is what
 * keeps the system tight instead of diluting into hand-rolled one-offs.
 *
 * Base Web is MIT (Copyright (c) Uber Technologies, Inc.). The licence permits derivative work
 * provided the notice travels with the copy, so every forked file keeps its notice and gains a
 * header recording what it came from. The upstream LICENSE travels with each new fork.
 *
 *   node tools/fork.mjs --source-root /path/to/baseweb <base-component> <rocoto-name> "<why>"
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { appRoot, baseSource } from './base-source.mjs';

const { values, positionals } = parseArgs({
  options: { 'source-root': { type: 'string' } }, allowPositionals: true,
});
const [src, name, why = ''] = positionals;
if (!src || !name) {
  console.error('usage: node tools/fork.mjs --source-root /path/to/baseweb <base-component> <rocoto-name> "<why>"');
  process.exit(1);
}

if (positionals.length > 3 || ![src, name].every((part) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part))) {
  throw new Error('Component names must be simple lowercase directory names');
}
const upstream = baseSource(values['source-root']);
const from = join(upstream.root, 'src', src);
const to = join(appRoot, 'src/rocoto', name);
if (!existsSync(from) || !statSync(from).isDirectory()) {
  throw new Error(`Base Web source: missing component ${from}`);
}
if (existsSync(to)) throw new Error(`Fork destination already exists: ${to}`);

// the implementation and its types only — tests and snapshots stay upstream
const files = readdirSync(from).filter(
  (f) => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('.test.')
);

const header = (file) => `/* FORKED from Base Web \`src/${src}/${file}\` (v${upstream.version}) on ${new Date().toISOString().slice(0, 10)}.
 *
 * Why this fork exists: ${why}
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. — the upstream notice below
 * travels with this copy as the licence requires, and the full licence is vendored at
 * LICENSE.baseweb.txt beside this file. This file is a DERIVATIVE WORK.
 *
 * Everything about how this component is assembled is deliberately left as Base built it: the
 * \`overrides\` contract, \`getOverrides\`, the shared-props shape, theme-driven styling, focus
 * and keyboard handling, and the animation tokens. Rocoto's edits are marked \`ROCOTO:\` inline
 * and listed in CHANGES.md, so the delta from upstream is always readable.
 */
`;

if (!files.length) throw new Error(`Base Web source: no TypeScript implementation in ${from}`);
mkdirSync(to, { recursive: true });
writeFileSync(join(to, 'LICENSE.baseweb.txt'), upstream.license);

for (const f of files) {
  writeFileSync(join(to, f), header(f) + readFileSync(join(from, f), 'utf8'));
}

writeFileSync(
  join(to, 'CHANGES.md'),
  `# ${name}\n\n` +
    `Forked from Base Web \`src/${src}/\` (v${upstream.version}). MIT, Copyright (c) Uber Technologies, Inc.\n\n` +
    `**Why.** ${why}\n\n` +
    `## Inherited untouched\n\n` +
    `The overrides contract · getOverrides · shared-props shape · theme-driven styling · focus\n` +
    `ring and keyboard handling · disabled and loading states · animation tokens.\n\n` +
    `## Rocoto's edits\n\n` +
    `- (one line per edit; every one also marked \`ROCOTO:\` at the site)\n`
);

console.log(`forked src/${src} -> ${to}`);
console.log(`  ${files.join(', ')}`);
console.log('next: edit the fork, mark each edit ROCOTO:, and record it in CHANGES.md');
