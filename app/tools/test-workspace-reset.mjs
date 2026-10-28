/* RESET CEDAR — THE INVENTORY IS COMPLETE, AND THE TWO ACTS DO WHAT THEY SAY.
 *
 * «give me a "reset cedar state" which lets all the data reset to default and removes all
 *  connections of whatsapp, phone and email. but genuinely removes them.»   — Peter, §247.6
 *
 * THE DEFECT THIS SUITE PINS. Settings' reset reached seven stores; the day ledger, Money, the
 * onboarding progress, the reply drafts, the print journal, the dismissals, the activation
 * ledger, the Meta preview draft, the advance plan and every provider connection stood exactly as
 * they were. A reset that leaves the connections standing is a reset a person cannot walk a
 * connection flow after, which is the whole request.
 *
 * SO THE FIRST BLOCK IS A DIFF, AND IT RUNS EVERY TIME. It reads every storage call and every
 * key constant in `app/src` — the same grep a reviewer would run — and fails when the tree holds
 * a key the inventory never names, or when the inventory names a key the tree stopped writing.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { APP_ROOT, loadTypeScript } from './ts-module.mjs';

const {
  CEDAR_STORES, WORKSPACE_RESET_EVENT, clearedFates, disconnectProviders, inventoried,
  providerWord, releaseProviderStores, releasedProviders, resetWorkspaceAndProviders,
  resetWorkspaceStores, stillWritten, storeMatches, storedKeys, workspaceResetPlan,
} = loadTypeScript('src/prototypes/cedar/workspace-reset.ts', 'cedar-workspace-reset');

/* ── 1 · THE GREP, IN CODE ────────────────────────────────────────────────────────────────────
 * Three ways a key reaches a browser: a `localStorage`/`sessionStorage` call, a constant whose
 * name says it is a key, and an IndexedDB database. All three are read, and every one of them
 * resolves through the file's own constants so a key builder counts as the key it builds. */
const SRC = join(APP_ROOT, 'src');
const INVENTORY_FILE = 'prototypes/cedar/workspace-reset.ts';

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [full] : [];
  });
}

const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

/** Read the literal that starts at `index`, and hand back its static head. */
function literalAt(text, index) {
  const quote = text[index];
  if (quote !== "'" && quote !== '"' && quote !== '`') return null;
  let out = '';
  for (let i = index + 1; i < text.length; i += 1) {
    const char = text[i];
    if (char === '\\') { out += text[i + 1] ?? ''; i += 1; continue; }
    if (char === quote) return { value: out, template: quote === '`' };
    if (quote === '`' && char === '$' && text[i + 1] === '{') return { value: out, template: true, open: text.slice(i) };
    if (quote !== '`' && char === '\n') return null;
    out += char;
  }
  return null;
}

const CONST = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]*?)?=\s*(?:\([^)]*\)\s*(?::[^=;]*?)?=>\s*)?(['"`])/g;

function constants(text) {
  const found = new Map();
  for (const match of text.matchAll(CONST)) {
    const start = match.index + match[0].length - 1;
    const literal = literalAt(text, start);
    if (!literal) continue;
    found.set(match[1], literal);
  }
  /* A template that opens with `${OTHER}` is the other constant plus this one's own head. */
  for (let pass = 0; pass < 3; pass += 1) {
    for (const [name, literal] of found) {
      if (!literal.template || literal.value !== '' || !literal.open) continue;
      const inner = /^\$\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(literal.open);
      const source = inner && found.get(inner[1]);
      if (!source) continue;
      const tail = literalAt(`\`${literal.open.slice(inner[0].length)}`, 0);
      found.set(name, { value: `${source.value}${tail ? tail.value : ''}`, template: true });
    }
  }
  return found;
}

/** The argument text of a call whose `(` sits at `open`. */
function argument(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if ('([{'.includes(text[i])) depth += 1;
    else if (')]}'.includes(text[i])) { depth -= 1; if (depth === 0) return text.slice(open + 1, i); }
    else if (text[i] === ',' && depth === 1) return text.slice(open + 1, i);
  }
  return '';
}

function resolve(arg, found) {
  const trimmed = arg.trim();
  if (!trimmed) return null;
  const literal = literalAt(trimmed, 0);
  if (literal) return literal.value;
  const name = /^[A-Za-z_$][\w$]*/.exec(trimmed);
  const held = name && found.get(name[0]);
  return held ? held.value : null;
}

const CALL = /(?:window\s*\.\s*)?(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)\s*\(/g;
const DATABASE = /indexedDB\s*\.\s*(?:deleteDatabase|open)\s*\(/g;
const KEY_NAME = /(?:KEY|Key|key|PREFIX|Prefix|DATABASE|DB_NAME)$/;

const candidates = new Map();
const note = (key, where) => {
  if (typeof key !== 'string' || !key.startsWith('rocoto')) return;
  if (!candidates.has(key)) candidates.set(key, where);
};

/* A SIBLING CANDIDATE KEEPS ITS OWN NAMESPACE AND ITS OWN RESET. `CEDAR_STORES` is what Cedar's
   workspace reset clears, so the scan reads Cedar and the shared code; another folder under
   `prototypes/` (bodega-pay-later writes `rocoto-bodega-*` and proves its own `Reset state` in
   `drives/drive-268-bodega-onboarding.py`) answers for its keys itself. */
const SIBLING = /^prototypes\/(?!cedar\/)[^/]+\//;

for (const file of files(SRC)) {
  const where = relative(SRC, file);
  if (where === INVENTORY_FILE) continue;
  if (SIBLING.test(where)) continue;
  const text = stripComments(readFileSync(file, 'utf8'));
  const found = constants(text);
  for (const pattern of [CALL, DATABASE]) {
    for (const match of text.matchAll(pattern)) {
      note(resolve(argument(text, match.index + match[0].length - 1), found), where);
    }
  }
  for (const [name, literal] of found) if (KEY_NAME.test(name)) note(literal.value, where);
}

assert.ok(candidates.size > 50, `the scan reads the tree's storage keys · found ${candidates.size}`);

const uncovered = [...candidates].filter(([key]) => !inventoried(key));
assert.deepEqual(uncovered, [], 'every storage key in app/src is named by CEDAR_STORES');

const written = [...candidates.keys()];
const stale = CEDAR_STORES.filter((row) => !row.retired && !stillWritten(row, written));
assert.deepEqual(stale.map((row) => row.key), [], 'every inventoried key is still written by the tree');
/* A RETIRED ROW IS THE INVERSE (14 September 2026). It stays in the inventory so Reset Cedar still
 * sweeps what an earlier build wrote, and it names the change that retired its writer; the tree
 * must write it NOWHERE, or the row is lying about the retirement. */
const haunting = CEDAR_STORES.filter((row) => row.retired && stillWritten(row, written));
assert.deepEqual(haunting.map((row) => row.key), [], 'a retired key is written by nothing in the tree');
assert.ok(CEDAR_STORES.some((row) => row.retired), 'the inventory carries at least one retired row, so this branch is exercised');
for (const row of CEDAR_STORES.filter((item) => item.retired)) {
  assert.equal(row.fate, 'workspace', `${row.key} · a retired key is swept as workspace data`);
  assert.ok(/PR #\d+|[0-9a-f]{7,}/.test(row.retired), `${row.key} · the retirement note names the change`);
}

/* ── 1b · THE GATE IS FAIL-CLOSED IN BOTH DIRECTIONS ──────────────────────────────────────────
 * Both checks above used to answer on the head of the key alone — `key.startsWith(row.key)`,
 * whatever the row's `shape` said — and that is fail-OPEN each way for a key that begins with an
 * existing row. These two blocks were RED on the code of 10 September and they stay here so the
 * hole cannot reopen; the pairs are real family names a next store would plausibly take.
 *
 *   forward  `rocoto-app-print-preview-v2` was reported COVERED by `rocoto-app-print`, an EXACT
 *            row, so it passed the gate green — and `workspaceResetPlan` removes only the literal
 *            key of an exact row, so it survived both acts with nothing red anywhere.
 *   mirror   `rocoto-app-print` was never reported stale while `rocoto-app-print-journal` was
 *            written, so a row whose store had left the tree stayed on the inventory for ever. */
const FAMILY = [
  ['rocoto-app-print', 'rocoto-app-print-preview-v2'],
  ['rocoto-app-day', 'rocoto-app-day-plan'],
  ['rocoto-app-config', 'rocoto-app-config-v2'],
  ['rocoto-app-rules', 'rocoto-app-rules-draft-v1'],
  ['rocoto-app-catalogue', 'rocoto-app-catalogue-v2'],
];
for (const [head, next] of FAMILY) {
  const row = CEDAR_STORES.find((entry) => entry.key === head);
  assert.equal(row.shape, 'exact', `${head} is the exact row this pair is built on`);
  assert.equal(inventoried(next), null,
    `${next} is uncovered · an exact row answers for its own key alone`);
  assert.equal(stillWritten(row, [next]), false,
    `${head} is reported stale when the tree writes only ${next}`);
  const escaped = workspaceResetPlan({ scope: 'fish', disconnect: true, local: [head, next], session: [] });
  assert.deepEqual(escaped.local, [head],
    `the sweep of ${head} leaves ${next} standing, which is why the gate has to name it`);
}
/* And the shapes that DO answer for a family still answer for it. */
assert.ok(inventoried('rocoto-app-briefing:fish'), 'a prefix row heads its family');
assert.ok(inventoried('rocoto-cedar-money-v1:fish'), 'a scoped row answers for one scope segment');
assert.equal(storeMatches('rocoto-cedar-money-v1:fish:draft', { key: 'rocoto-cedar-money-v1:', shape: 'scoped' }), false,
  'a scoped row stops at its own scope');

/* ── 1c · EVERY RESET FUNCTION THE INVENTORY NAMES IS ACTUALLY CALLED ─────────────────────────
 * `clearMadeCustomers`, `clearAccountEdits`, `resetPartners` and `resetCollectionWorkspace` were
 * declared on their rows and absent from `storeResets()`. The keys were still swept, so the defect
 * was invisible — but each of those functions does more than delete a key, and the inventory was
 * claiming a wiring that did not exist. The two lists are now held to each other. */
const SETTINGS = join(SRC, 'prototypes/cedar/areas/admin/app-settings.tsx');
const settings = readFileSync(SETTINGS, 'utf8');
const block = /const storeResets\s*=[\s\S]*?\n  \];/.exec(settings);
assert.ok(block, 'app-settings.tsx declares storeResets()');
const wired = [...block[0].matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1]).sort();
const declared = [...new Set(CEDAR_STORES.filter((row) => row.reset).map((row) => row.reset))].sort();
assert.deepEqual(wired, declared, 'every reset function CEDAR_STORES names is wired into storeResets()');

/* ── 1d · THE ANNOUNCEMENT HAS SUBSCRIBERS ────────────────────────────────────────────────────
 * `rocoto:cedar-workspace-reset` is a shared contract, and on 10 September it had none: the whole
 * tree held the constant and the spec sentence and nothing else, so a store keeping its pre-reset
 * book in module memory wrote it straight back over the sweep. These are the stores that hold a
 * connection flag or a provider snapshot, and each one returns to its initial posture on the
 * event. A rename goes red here rather than silently on a person's screen. */
const listeners = new Set();
for (const file of files(SRC)) {
  const where = relative(SRC, file);
  if (where === INVENTORY_FILE) continue;
  if (/addEventListener\(\s*'rocoto:cedar-workspace-reset'/.test(readFileSync(file, 'utf8'))) listeners.add(where);
}
for (const owner of ['prototypes/cedar/money-store.ts', 'prototypes/cedar/whatsapp-connection.tsx',
  'prototypes/cedar/email-provider.ts'])
  assert.ok(listeners.has(owner), `${owner} returns to its initial posture on ${WORKSPACE_RESET_EVENT}`);

/* Every connection row names the account it mirrors, so the sweep can ask that provider. */
for (const row of CEDAR_STORES) {
  if (row.fate === 'connection') assert.ok(['whatsapp', 'phone', 'email'].includes(row.provider),
    `${row.key} names the provider it mirrors`);
  else assert.equal(row.provider, undefined, `${row.key} mirrors no provider`);
}

/* THE STORES THE OLD SETTINGS RESET LEFT STANDING. Each of these is the reason a person could not
   walk a connection flow again, and each of them is now on the list. */
for (const key of [
  'rocoto-app-day', 'rocoto-cedar-money-v1:', 'rocoto-cedar-onboarding-v1:', 'rocoto-app-reply-drafts',
  'rocoto-app-print-journal', 'rocoto-app-dismissals', 'rocoto-app-activation', 'rocoto-cedar-finance-v1:',
  'rocoto-cedar-meta-preview-v1:', 'rocoto-cedar-whatsapp-selected-v1', 'rocoto-cedar-phone-browser-v1',
  'rocoto-cedar-email-intake-cursor-v1', 'rocoto-print-artifacts',
]) assert.ok(inventoried(key), `${key} is inventoried · the Settings reset used to leave it standing`);

/* Every row states an owner a reviewer can open, and every fate is one of the three. */
for (const row of CEDAR_STORES) {
  assert.match(row.owner, /\.tsx?$/, `${row.key} names the module that writes it`);
  assert.ok(['workspace', 'connection', 'kept'].includes(row.fate), `${row.key} has a stated fate`);
  assert.ok(['exact', 'scoped', 'prefix'].includes(row.shape), `${row.key} has a stated shape`);
  if (row.shape === 'scoped') assert.ok(row.key.endsWith(':'), `${row.key} is scoped, so its key ends at the separator`);
}
assert.deepEqual(clearedFates(false), ['workspace']);
assert.deepEqual(clearedFates(true), ['workspace', 'connection']);

/* ── 2 · THE PLAN ─────────────────────────────────────────────────────────────────────────────
 * A world with one of everything in it: a workspace key, a scoped key from two houses, a
 * connection flag, and the three kept records. */
const HELD_LOCAL = [
  'rocoto-app-config', 'rocoto-app-day', 'rocoto-app-print-journal', 'rocoto-app-dismissals',
  'rocoto-app-tiers:fish', 'rocoto-workspace-capabilities:fish', 'rocoto-display-language', 'rocoto-spanish-entry',
  'rocoto-cedar-money-v1:fish', 'rocoto-cedar-money-v1:meat', 'rocoto-cedar-onboarding-v1:fish',
  'rocoto-cedar-finance-v1:fish', 'rocoto-cedar-meta-preview-v1:fish', 'rocoto-phone-connection-v1:fish',
  'rocoto:export:output-schedules:fish', 'rocoto-app-export-files-v1:fish',
  'rocoto-cedar-whatsapp-selected-v1', 'rocoto-cedar-email-intake-cursor-v1', 'rocoto-cedar-phone-browser-v1',
  'rocoto-rail-open', 'rocoto-runtime-base', 'rocoto-cedar-collections-base',
  'rocoto-cedar-channel-access-v1:http://127.0.0.1:8790',
];
const HELD_SESSION = ['rocoto-cedar-phone-device-v1', 'rocoto-product-creation-draft:fish:new', 'unrelated-key'];

const data = workspaceResetPlan({ scope: 'fish', disconnect: false, local: HELD_LOCAL, session: HELD_SESSION });
assert.ok(data.local.includes('rocoto-app-day') && data.local.includes('rocoto-cedar-money-v1:fish'));
assert.ok(data.local.includes('rocoto-cedar-onboarding-v1:fish') && data.local.includes('rocoto-cedar-finance-v1:fish'));
assert.ok(data.local.includes('rocoto-display-language') && data.local.includes('rocoto-spanish-entry'),
  'the display language returns to its default with the data (§247.6)');
assert.ok(data.local.includes('rocoto:export:output-schedules:fish') && data.local.includes('rocoto-app-export-files-v1:fish'));
assert.equal(data.local.includes('rocoto-cedar-money-v1:meat'), false, 'another house keeps its own scope');
for (const kept of ['rocoto-rail-open', 'rocoto-runtime-base', 'rocoto-cedar-collections-base', 'rocoto-cedar-channel-access-v1:http://127.0.0.1:8790'])
  assert.equal(data.local.includes(kept), false, `${kept} survives both acts`);
for (const connection of ['rocoto-cedar-whatsapp-selected-v1', 'rocoto-cedar-email-intake-cursor-v1', 'rocoto-cedar-phone-browser-v1'])
  assert.equal(data.local.includes(connection), false, `${connection} stands while the connections stand`);
assert.deepEqual(data.session, ['rocoto-product-creation-draft:fish:new']);
assert.deepEqual(data.databases, ['rocoto-catalogue-imports', 'rocoto-print-artifacts']);

const ALL_THREE = ['whatsapp', 'phone', 'email'];
const both = workspaceResetPlan({ scope: 'fish', disconnect: true, released: ALL_THREE, local: HELD_LOCAL, session: HELD_SESSION });
for (const connection of ['rocoto-cedar-whatsapp-selected-v1', 'rocoto-cedar-email-intake-cursor-v1', 'rocoto-cedar-phone-browser-v1'])
  assert.ok(both.local.includes(connection), `${connection} goes with the disconnect`);
assert.ok(both.session.includes('rocoto-cedar-phone-device-v1'), 'the phone device registration goes with the disconnect');
assert.ok(both.local.includes('rocoto-cedar-channel-access-v1:http://127.0.0.1:8790') === false,
  'the channel access record is the road the disconnects travel, so it stays');

/* ── 2b · A MIRROR GOES ONLY WHEN ITS OWN PROVIDER SAID SO ────────────────────────────────────
 * RED on the code of 10 September: `resetWorkspaceAndProviders` always swept with `disconnect`
 * true, so every connection row went whatever the walk returned. A mailbox that refused its DELETE
 * kept its Unipile connection while `rocoto-cedar-email-intake-cursor-v1` was dropped, and its
 * intake then restarted at the beginning of that mailbox's history; in the no-channel branch the
 * row's own sub says «Phone and email stay» while both mirrors were wiped anyway. */
const refused = workspaceResetPlan({ scope: 'fish', disconnect: true, released: ['whatsapp'], local: HELD_LOCAL, session: HELD_SESSION });
assert.ok(refused.local.includes('rocoto-cedar-whatsapp-selected-v1'), 'the account that answered hands over its mirror');
assert.equal(refused.local.includes('rocoto-cedar-email-intake-cursor-v1'), false,
  'a mailbox that is still connected keeps the cursor its intake reads from');
assert.equal(refused.local.includes('rocoto-cedar-phone-browser-v1'), false, 'a line that is still connected keeps its browser registration');
assert.equal(refused.session.includes('rocoto-cedar-phone-device-v1'), false, 'and its device registration');
assert.ok(refused.local.includes('rocoto-app-day'), 'the workspace rows land whatever the providers answered');
/* The word each outcome hands the sweep. */
assert.deepEqual(releasedProviders([
  { provider: 'whatsapp', outcome: 'disconnected', calls: 1, error: '' },
  { provider: 'phone', outcome: 'connected', calls: 0, error: 'Reconnect the phone service, then try again.' },
  { provider: 'email', outcome: 'held', calls: 0, error: '' },
]), ['whatsapp']);
assert.deepEqual(releasedProviders([{ provider: 'email', outcome: 'absent', calls: 0, error: '' }]), ['email'],
  'an account that was already free hands over its stale mirror too');

/* THE RETRY'S OWN SWEEP reaches that provider's mirrors and nothing else. */
const retryPlan = workspaceResetPlan({
  scope: 'fish', disconnect: true, fates: ['connection'], released: ['phone'],
  local: HELD_LOCAL, session: HELD_SESSION,
});
assert.deepEqual(retryPlan.local, ['rocoto-cedar-phone-browser-v1']);
assert.deepEqual(retryPlan.session, ['rocoto-cedar-phone-device-v1']);
assert.deepEqual(retryPlan.databases, [], 'a retry deletes no database');

/* ── 2c · A STOPPED WALK ASKS NOTHING MORE, AND SWEEPS NOTHING ────────────────────────────────
 * RED on the code of 11 September: `disconnectProviders` took a list and nothing else, so the
 * walk ran to the end whatever happened on the page. Cedar is a hash router, so browser Back
 * unmounted the held card while `resetWorkspaceAndProviders` carried on as a detached promise —
 * the providers were disconnected and localStorage was swept under a live app that never
 * reloaded, which is the exact half-reset state the held card exists to prevent. The walk now
 * carries an `AbortController`: «Stop» and a route change both abort it, an aborted walk asks no
 * further account and NEVER reaches the store sweep, and the accounts that already answered for
 * themselves are settled facts, so their mirrors go with them and everything else stands. */
const stopped = new AbortController();
stopped.abort();
const askedNothing = [];
const nothing = await disconnectProviders([
  { provider: 'whatsapp', run: async () => { askedNothing.push('whatsapp'); return { calls: 1, outcome: 'disconnected' }; } },
], { signal: stopped.signal });
assert.deepEqual(askedNothing, [], 'a walk that was stopped before it started asks no provider');
assert.deepEqual(nothing, [], 'and it returns no outcome');

/* THE LINE THE HELD CARD READS, one name per account, in the order the walk asks them. */
const asked = [];
const midWalk = new AbortController();
const midLocal = fakeStore(HELD_LOCAL);
const midSession = fakeStore(HELD_SESSION);
const midAnnounced = [];
const halfway = await resetWorkspaceAndProviders({
  scope: 'fish', disconnect: true, local: midLocal, session: midSession,
  signal: midWalk.signal,
  onAsking: (provider) => asked.push(provider),
  providers: [
    { provider: 'whatsapp', run: async () => ({ calls: 1, outcome: 'disconnected' }) },
    { provider: 'phone', run: async () => { midWalk.abort(); return { calls: 0, outcome: 'disconnected' }; } },
    { provider: 'email', run: async () => { throw new Error('the walk reached an account it was stopped before'); } },
  ],
  stores: [{ name: 'resetCompany', run: () => { throw new Error('a stopped walk runs no store reset'); } }],
  announce: (event, detail) => midAnnounced.push(detail),
});
assert.deepEqual(asked, ['whatsapp', 'phone', null], 'the card names each account as it is asked, and clears when the walk ends');
assert.equal(halfway.stopped, true, 'the walk reports that it was stopped');
assert.equal(halfway.report, null, 'a stopped walk produces no sweep report');
assert.deepEqual(halfway.providers.map((row) => row.provider), ['whatsapp'],
  'the answer that arrived after the stop is discarded, so the card states that account as standing');
assert.equal(midLocal.map.has('rocoto-app-day'), true, 'a stopped walk leaves every workspace record exactly as it was');
assert.equal(midLocal.map.has('rocoto-cedar-whatsapp-selected-v1'), false,
  'the account that answered before the stop is a settled fact, so its mirror goes with it');
assert.equal(midLocal.map.has('rocoto-cedar-phone-browser-v1'), true, 'the line the walk never released keeps its mirror');
assert.equal(midSession.map.has('rocoto-cedar-phone-device-v1'), true, 'and its device registration');
assert.equal(midLocal.map.has('rocoto-cedar-email-intake-cursor-v1'), true,
  'the mailbox the walk never reached keeps the cursor its intake reads from');
assert.deepEqual(midAnnounced, [{ scope: 'fish', disconnect: true }],
  'the one released account announces itself, so the stores holding its snapshot drop it');

/* ── 3 · THE SWEEP ───────────────────────────────────────────────────────────────────────────
 * A fake browser store, the real act, and the order it happens in. */
function fakeStore(keys) {
  const map = new Map(keys.map((key) => [key, 'held']));
  return {
    map,
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    removeItem: (key) => { map.delete(key); },
  };
}

const order = [];
const local = fakeStore(HELD_LOCAL);
const session = fakeStore(HELD_SESSION);
const databases = { deleteDatabase: (name) => order.push(`database:${name}`) };
let announced = null;
const report = resetWorkspaceStores({
  scope: 'fish', disconnect: false, local, session, databases,
  stores: [
    { name: 'resetCompany', run: () => { order.push('resetCompany'); assert.equal(local.map.has('rocoto-app-day'), false, 'the sweep ran first'); return true; } },
    { name: 'resetDay', run: () => { order.push('resetDay'); return true; } },
    { name: 'resetPrinting', run: () => { order.push('resetPrinting'); return false; } },
    { name: 'resetTiers', run: () => { throw new Error('storage is full'); } },
  ],
  announce: (event, detail) => { announced = { event, detail, at: order.length }; order.push('announce'); },
});
assert.deepEqual(report.stalled, ['resetPrinting', 'resetTiers'], 'a store that answers false or throws is named');
assert.equal(local.map.has('rocoto-app-config'), false);
assert.equal(local.map.has('rocoto-rail-open'), true);
assert.equal(local.map.has('rocoto-cedar-whatsapp-selected-v1'), true);
assert.equal(session.map.has('unrelated-key'), true, 'a key Cedar never wrote is left alone');
assert.equal(announced.event, WORKSPACE_RESET_EVENT);
assert.deepEqual(announced.detail, { scope: 'fish', disconnect: false });
assert.equal(order[order.length - 1], 'announce', 'the announcement is last');
assert.ok(order.indexOf('database:rocoto-print-artifacts') < order.indexOf('resetCompany'));
assert.ok(report.removed.local.includes('rocoto-cedar-money-v1:fish'));
assert.deepEqual(report.removed.databases, ['rocoto-catalogue-imports', 'rocoto-print-artifacts']);

/* A store that refuses every read still lets the act reach its stores and its announcement. */
const blocked = { get length() { throw new Error('site data is blocked'); }, getItem: () => null, removeItem: () => { throw new Error('site data is blocked'); } };
const blockedReport = resetWorkspaceStores({ scope: 'fish', disconnect: true, local: blocked, session: null, stores: [{ name: 'resetCompany', run: () => true }] });
assert.deepEqual(blockedReport.removed.local, []);
assert.deepEqual(blockedReport.stalled, []);
assert.deepEqual(storedKeys(null), []);

/* ── 4 · THE PROVIDERS ───────────────────────────────────────────────────────────────────────
 * One call per WhatsApp session, per phone line and per email account; each one reports itself. */
const calls = [];
const providers = [
  { provider: 'whatsapp', run: async () => { calls.push('whatsapp/disconnect'); return { calls: 1, outcome: 'disconnected' }; } },
  { provider: 'phone', run: async () => { calls.push('phone/lines/line_a', 'phone/lines/line_b'); return { calls: 2, outcome: 'disconnected' }; } },
  { provider: 'email', run: async () => { calls.push('email/accounts/one'); return { calls: 1, outcome: 'disconnected' }; } },
];
const walked = await disconnectProviders(providers);
assert.deepEqual(calls, ['whatsapp/disconnect', 'phone/lines/line_a', 'phone/lines/line_b', 'email/accounts/one']);
assert.deepEqual(walked.map((row) => [row.provider, row.outcome, row.calls]),
  [['whatsapp', 'disconnected', 1], ['phone', 'disconnected', 2], ['email', 'disconnected', 1]]);

const mixed = await disconnectProviders([
  { provider: 'whatsapp', run: async () => ({ calls: 1, outcome: 'disconnected' }) },
  { provider: 'phone', run: async () => { throw new Error('The phone service needs another check.'); } },
  { provider: 'email', run: async () => ({ calls: 0, outcome: 'absent' }) },
]);
assert.deepEqual(mixed.map((row) => row.outcome), ['disconnected', 'connected', 'absent'],
  'one provider failing leaves the other two results standing');
assert.equal(mixed[1].error, 'The phone service needs another check.');
assert.equal(providerWord(mixed[0].outcome), 'Disconnected');
assert.equal(providerWord(mixed[1].outcome), 'Still connected');
assert.equal(providerWord(mixed[2].outcome), 'Ready to connect');
assert.equal(providerWord('held'), 'Stays as it is');

/* ── 5 · THE SECOND ACT WHOLE ────────────────────────────────────────────────────────────────
 * The providers answer BEFORE the sweep, because the channel access record is what carries the
 * phone and email calls; the local reset lands whatever the providers answered. */
const sequence = [];
const liveLocal = fakeStore(HELD_LOCAL);
let liveAnnounced = null;
const combined = await resetWorkspaceAndProviders({
  scope: 'fish', disconnect: true, local: liveLocal, session: fakeStore(HELD_SESSION),
  providers: [
    { provider: 'whatsapp', run: async () => { sequence.push('whatsapp'); return { calls: 1, outcome: 'disconnected' }; } },
    { provider: 'phone', run: async () => {
      sequence.push('phone');
      assert.ok(liveLocal.map.has('rocoto-cedar-channel-access-v1:http://127.0.0.1:8790'), 'the channel access is still held while the call runs');
      throw new Error('Reconnect the phone service, then try again.');
    } },
    { provider: 'email', run: async () => { sequence.push('email'); return { calls: 0, outcome: 'held' }; } },
  ],
  stores: [{ name: 'resetCompany', run: () => { sequence.push('stores'); return true; } }],
  announce: (event, detail) => { liveAnnounced = detail; sequence.push('announce'); },
});
assert.deepEqual(sequence, ['whatsapp', 'phone', 'email', 'stores', 'announce']);
assert.deepEqual(combined.providers.map((row) => row.outcome), ['disconnected', 'connected', 'held']);
assert.deepEqual(liveAnnounced, { scope: 'fish', disconnect: true });
assert.equal(liveLocal.map.has('rocoto-app-day'), false, 'the local reset lands even when a provider refuses');
assert.equal(liveLocal.map.has('rocoto-cedar-whatsapp-selected-v1'), false);
assert.equal(liveLocal.map.has('rocoto-cedar-channel-access-v1:http://127.0.0.1:8790'), true);
assert.equal(combined.report.disconnect, true);
/* The two accounts that are still standing keep their own mirrors, and the retry releases the
   phone's the moment its second ask answers. */
assert.equal(liveLocal.map.has('rocoto-cedar-phone-browser-v1'), true, 'the refused line keeps its browser registration');
assert.equal(liveLocal.map.has('rocoto-cedar-email-intake-cursor-v1'), true, 'the held mailbox keeps its intake cursor');
let retryAnnounced = null;
const released = releaseProviderStores({
  scope: 'fish', provider: 'phone', local: liveLocal, session: fakeStore(HELD_SESSION),
  announce: (event, detail) => { retryAnnounced = { event, detail }; },
});
assert.deepEqual(released.removed.local, ['rocoto-cedar-phone-browser-v1']);
assert.equal(liveLocal.map.has('rocoto-cedar-email-intake-cursor-v1'), true, 'the retry reaches the phone alone');
assert.deepEqual(released.stalled, [], 'a retry runs no store reset');
assert.deepEqual(retryAnnounced, { event: WORKSPACE_RESET_EVENT, detail: { scope: 'fish', disconnect: true } });

console.log(`Reset Cedar: ${CEDAR_STORES.length} inventoried stores, ${candidates.size} storage keys read from app/src, plan/sweep/provider checks passed`);
