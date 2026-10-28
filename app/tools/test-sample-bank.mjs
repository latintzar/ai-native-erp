/* The sample bank is generated from the browser's actual sales and Money seed. Sales vary by
 * calendar weekday, so seven isolated boot clocks produce seven relative ledgers. The Python
 * provider selects the current Peru weekday; every generated amount remains an integer centavo.
 * Run with --write to regenerate the checked-in artifact, or without arguments to check drift. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileTypeScript, APP_ROOT } from './ts-module.mjs';

const DATA = join(APP_ROOT, 'src/prototypes/copper/runtime/sample_bank_v1.json');
const BANKS = { fish: 'bbva', meat: 'interbank', fruit: 'scotiabank' };
const WEEK = Array.from({ length: 7 }, (_, index) => `2025-08-${18 + index}`);
// Authored books from this predecessor retain their original methods, amounts and receipt clocks.
// Regenerate their frozen compatibility fixture with --legacy-source <clean repository checkout>.
const LEGACY_SOURCE = '598b5357154993c8e2d629d4158b772a2a266374';
const LEGACY_TREE = '3618c38677bd1934bbee7c64a26cadf0d22a0533';
const LEGACY_DIGEST = '8dc0776f7a7da4f726f74825cc189aa08536cfa12d3eb564f9b2dcca8d8290f1';
const accountNumber = scope => String(BigInt('0x' + createHash('sha256')
  .update(`cedar-sample-bank:${scope}`).digest('hex').slice(0, 12)) % 1000000000n).padStart(9, '0');
const daysBetween = (earlier, later) =>
  Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86400000);

function worker(directory, day) {
  // Each process installs its clock before loading any module with a boot snapshot or cache.
  const NativeDate = globalThis.Date;
  const instant = `${day}T18:00:00.000Z`;
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return NativeDate.parse(instant); }
  };
  const require = createRequire(import.meta.url);
  const seed = require(join(directory, 'money-seed.js'));
  const model = require(join(directory, 'money-model.js'));
  const projections = require(join(directory, 'money-projections.js'));
  const { buildSales } = require(join(directory, 'sale.js'));
  const { cedarCast } = require(join(directory, 'cedar-cast.js'));
  const { dayForSector } = require(join(directory, 'day.js'));
  const { CASTS } = require(join(directory, '../../scenarios/data/cast.js'));
  const ledgers = Object.entries(CASTS).map(([scope, cast]) => {
    const sales = buildSales(cedarCast(cast), dayForSector(scope));
    const workspace = seed.moneyWorkspace(scope);
    const result = seed.seedMoney(model.emptyMoney(scope), sales, 'https://sample.invalid/cedar');
    assert.equal(result.ok, true, result.error);
    const state = result.state;
    const referenceDay = model.peruDate(workspace.referenceAt);
    assert.equal(referenceDay, day, 'the worker boot day is the Money reference day');
    const invoices = new Map(state.invoices.map(row => [row.id, row]));
    const requests = new Map(state.requests.map(row => [row.invoiceId, row]));
    const bank = state.receipts.filter(row => row.source === 'demo-bank' && row.method !== 'cash'
      && row.status === 'matched' && row.currency === 'PEN');
    const receipts = bank.map(receipt => {
      const invoice = invoices.get(receipt.invoiceId), request = requests.get(receipt.invoiceId);
      assert.ok(invoice && request, `${scope}: a receipt identifies its invoice and request`);
      return { scope, reference: receipt.reference, amountMinor: receipt.amountMinor,
        dayOffset: daysBetween(referenceDay, model.peruDate(receipt.at)), time: receipt.at.slice(11),
        method: receipt.method, customerId: invoice.customerId, invoiceId: invoice.id,
        documentId: invoice.saleId, requestId: request.id };
    });
    const account = { scope, houseName: workspace.houseName, bank: BANKS[scope], accountNumber: accountNumber(scope),
      currency: workspace.currency, openingBalanceMinor: workspace.openingBalanceMinor,
      referenceTime: workspace.referenceAt.slice(11), wallets: { yape: true, plin: true } };
    const cashMinor = state.receipts.filter(row => row.method === 'cash' && row.status === 'matched')
      .reduce((sum, row) => sum + row.amountMinor, 0);
    // The synthetic arithmetic check guards cash even when a fixture customer's method changes.
    const synthetic = { ...model.emptyMoney(scope), receipts: [
      { invoiceId: 'i', id: 'a', reference: 'a', amountMinor: 1234, currency: 'PEN', method: 'yape', source: 'demo-bank', at: workspace.referenceAt, status: 'matched' },
      { invoiceId: 'i', id: 'b', reference: 'b', amountMinor: 8766, currency: 'PEN', method: 'transfer', source: 'demo-bank', at: workspace.referenceAt, status: 'matched' },
      { invoiceId: 'i', id: 'c', reference: 'c', amountMinor: 5000, currency: 'PEN', method: 'cash', source: 'demo-bank', at: workspace.referenceAt, status: 'matched' },
    ] };
    assert.equal(projections.projectMoney(synthetic, []).bankBalanceMinor, workspace.openingBalanceMinor + 10000);
    return { scope, account, receipts, cashMinor, balanceMinor: projections.projectMoney(state, sales).bankBalanceMinor,
      invoiceDays: state.invoices.map(row => model.peruDate(row.issuedAt)) };
  });
  writeFileSync(1, JSON.stringify(ledgers));
}

const workerAt = process.argv.indexOf('--worker');
if (workerAt >= 0) {
  worker(process.argv[workerAt + 1], process.argv[workerAt + 2]);
  process.exit(0);
}

const stored = JSON.parse(readFileSync(DATA, 'utf8'));
if (!process.argv.includes('--write')) {
  assert.equal(stored.fixture.schema, 2, 'the bank stores one browser-derived variant for each Peru weekday');
  assert.deepEqual(Object.keys(stored.fixture.collections.receiptsByWeekday), ['0', '1', '2', '3', '4', '5', '6']);
}

// One compile contains the actual modules used by this Money surface. Workers load only models.
const directory = dirname(compileTypeScript('src/prototypes/cedar/money-overview.tsx', `sample-bank-week-${process.pid}`));
const readDay = (day, sourceDirectory = directory) => JSON.parse(execFileSync(process.execPath,
  [fileURLToPath(import.meta.url), '--worker', sourceDirectory, day], {
    encoding: 'utf8', env: { ...process.env, TZ: 'UTC' }, maxBuffer: 32 * 1024 * 1024,
  }));
const weeks = WEEK.map(day => readDay(day));
let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`GREEN ${name}`); };

let legacy = stored.fixture.legacy;
const legacyAt = process.argv.indexOf('--legacy-source');
if (legacyAt >= 0) {
  assert.ok(process.argv[legacyAt + 1], '--legacy-source requires a clean predecessor checkout');
  const source = resolve(process.argv[legacyAt + 1]);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD:app/src'], { cwd: source, encoding: 'utf8' }).trim(), LEGACY_TREE);
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'app/src', 'app/tools/ts-module.mjs'], { cwd: source });
  const loader = await import(pathToFileURL(join(source, 'app/tools/ts-module.mjs')).href);
  const legacyDirectory = dirname(loader.compileTypeScript('src/prototypes/cedar/money-overview.tsx', `sample-bank-legacy-week-${process.pid}`));
  const legacyWeeks = WEEK.map(day => readDay(day, legacyDirectory));
  const collections = { accounts: legacyWeeks[0].map(row => row.account),
    receiptsByWeekday: Object.fromEntries(legacyWeeks.map((ledgers, weekday) => [weekday, ledgers.flatMap(row => row.receipts)])) };
  legacy = { sourceCommit: LEGACY_SOURCE, sourceTree: LEGACY_TREE, collections };
  check('the predecessor modules reproduce all seven original ledgers across calendar weeks', () => {
    for (let weekday = 0; weekday < 7; weekday++) {
      const relative = ({ invoiceDays, ...ledger }) => ledger;
      assert.deepEqual(readDay(`2026-09-${14 + weekday}`, legacyDirectory).map(relative), legacyWeeks[weekday].map(relative));
      for (const row of legacyWeeks[weekday]) {
        assert.equal(row.invoiceDays.length, 24);
        assert.equal(row.receipts.length, 18);
        assert.equal(row.balanceMinor, row.account.openingBalanceMinor + row.receipts.reduce((sum, receipt) => sum + receipt.amountMinor, 0));
      }
    }
  });
}

check('the frozen predecessor fixture retains its proven source and every original centavo', () => {
  assert.ok(legacy, 'Generate the predecessor fixture with --write --legacy-source <checkout>');
  assert.equal(legacy.sourceCommit, LEGACY_SOURCE);
  assert.equal(legacy.sourceTree, LEGACY_TREE);
  assert.equal(createHash('sha256').update(JSON.stringify(legacy.collections)).digest('hex'), LEGACY_DIGEST);
});

check('seven browser boot dates retain one account per house', () => {
  assert.equal(weeks.length, 7);
  for (const ledgers of weeks) {
    assert.deepEqual(ledgers.map(row => row.scope).sort(), ['fish', 'fruit', 'meat']);
    assert.deepEqual(ledgers.map(row => row.account), weeks[0].map(row => row.account));
    for (const row of ledgers) {
      assert.match(row.account.accountNumber, /^\d{9}$/);
      assert.equal(row.account.accountNumber, accountNumber(row.scope));
      assert.equal(row.account.currency, 'PEN');
      assert.deepEqual(row.account.wallets, { yape: true, plin: true });
    }
  }
  assert.equal(new Set(weeks[0].map(row => row.account.bank)).size, 3);
  assert.equal(new Set(weeks[0].map(row => row.account.accountNumber)).size, 3);
});

check('every weekday has ninety days of receipts derived from the historical sales book', () => {
  for (const ledgers of weeks) for (const row of ledgers) {
    const offsets = [...new Set(row.receipts.map(receipt => receipt.dayOffset))].sort((a, b) => a - b);
    assert.ok(offsets.length > 70, `${row.scope}: ${offsets.length} receipt dates`);
    assert.ok(offsets.at(-1) - offsets[0] >= 89, `${row.scope}: the receipt ledger spans ninety days`);
    const invoiceDays = row.invoiceDays.slice().sort();
    assert.ok(daysBetween(invoiceDays[0], invoiceDays.at(-1)) >= 90);
    const daily = offsets.slice(-14).map(offset => row.receipts.filter(receipt => receipt.dayOffset === offset)
      .reduce((sum, receipt) => sum + receipt.amountMinor, 0));
    assert.ok(new Set(daily).size >= 10, `${row.scope}: the last fortnight retains varying takings`);
    assert.ok(row.cashMinor > 0, `${row.scope}: cash receipts remain in Money`);
  }
});

check('the account balance equals opening plus bank receipts, with cash kept in Money', () => {
  for (const ledgers of weeks) for (const row of ledgers) {
    assert.equal(row.balanceMinor, row.account.openingBalanceMinor
      + row.receipts.reduce((sum, receipt) => sum + receipt.amountMinor, 0));
    assert.ok(row.receipts.every(receipt => Number.isSafeInteger(receipt.amountMinor) && receipt.amountMinor > 0));
    assert.ok(row.receipts.every(receipt => ['yape', 'plin', 'transfer'].includes(receipt.method)));
  }
});

check('every receipt keeps a relative day and lands through the sample clock', () => {
  for (const ledgers of weeks) for (const row of ledgers) for (const receipt of row.receipts) {
    assert.ok(Number.isInteger(receipt.dayOffset) && receipt.dayOffset <= 0);
    assert.match(receipt.time, /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
    if (receipt.dayOffset === 0) {
      assert.ok(Date.parse(`2025-08-22T${receipt.time}`) <= Date.parse(`2025-08-22T${row.account.referenceTime}`));
    }
  }
});

check('each bank receipt retains its customer, invoice, request and document identity', () => {
  for (const ledgers of weeks) for (const row of ledgers) {
    for (const field of ['reference', 'invoiceId', 'requestId', 'documentId']) {
      assert.equal(new Set(row.receipts.map(receipt => receipt[field])).size, row.receipts.length, `${row.scope}: ${field}`);
    }
    assert.ok(row.receipts.every(receipt => /^[A-Z]\d{3}-\d{8}$/.test(receipt.reference)));
    assert.ok(row.receipts.every(receipt => receipt.customerId && receipt.documentId));
  }
});

check('weekday variation is retained in the generated amounts and source documents', () => {
  for (const scope of Object.keys(BANKS)) {
    const signatures = weeks.map(ledgers => JSON.stringify(ledgers.find(row => row.scope === scope).receipts));
    assert.equal(new Set(signatures).size, 7, `${scope}: all calendar weekday variants are distinct`);
  }
});

check('a later calendar week reproduces the same seven relative bank ledgers', () => {
  for (let weekday = 0; weekday < 7; weekday++) {
    const later = readDay(`2026-09-${14 + weekday}`);
    const relativeLedger = ({ invoiceDays, ...ledger }) => ledger;
    assert.deepEqual(later.map(relativeLedger), weeks[weekday].map(relativeLedger), `weekday ${weekday}`);
  }
});

const built = { fixture: {
  schema: 2, source: 'app/src/prototypes/cedar/fixtures/money-v1.json · money-seed.ts · sale.ts',
  generator: 'app/tools/test-sample-bank.mjs --write', referenceWeek: WEEK[0], weekdayIndex: 'Monday=0',
  collections: { accounts: weeks[0].map(row => row.account),
    receiptsByWeekday: Object.fromEntries(weeks.map((ledgers, weekday) => [weekday, ledgers.flatMap(row => row.receipts)])) },
  legacy,
} };
// Keep each flat receipt on one line so a changed amount or identity is a reviewable data row.
const rendered = JSON.stringify(built, null, 2).replace(
  /\{\n +"scope": [^{}]*?\n +\}/g, receipt => JSON.stringify(JSON.parse(receipt)),
) + '\n';
if (process.argv.includes('--write')) {
  writeFileSync(DATA, rendered);
  console.log(`WROTE ${DATA}`);
} else check('the checked-in sample bank agrees with every browser weekday to the centavo', () => {
  assert.equal(readFileSync(DATA, 'utf8'), rendered, 'Regenerate with: node app/tools/test-sample-bank.mjs --write');
});
console.log(`${checks} checks GREEN`);
