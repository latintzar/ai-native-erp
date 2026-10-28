#!/usr/bin/env node
/* Executable E182 print-recovery domain tests. It evaluates selected real TypeScript declarations
 * with in-memory seams; no browser, build, timer, or physical-print assertion is involved. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'rolldown/experimental';
import { parse } from '@babel/parser';

const app = new URL('../src/prototypes/cedar/', import.meta.url);
const source = (name) => readFileSync(new URL(name, app), 'utf8');
const declaration = (text, names) => {
  const ast = parse(text, { sourceType: 'module', plugins: ['typescript'] });
  const found = new Map();
  for (const statement of ast.program.body) {
    const item = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (!item) continue;
    if ((item.type === 'FunctionDeclaration' || item.type === 'VariableDeclaration')) {
      const entries = item.type === 'FunctionDeclaration' ? [item.id?.name] : item.declarations.map((d) => d.id.type === 'Identifier' ? d.id.name : undefined);
      for (const name of entries) if (name && names.includes(name)) found.set(name, text.slice(item.start, item.end));
    }
  }
  for (const name of names) assert.ok(found.has(name), `missing source declaration ${name}`);
  return names.map((name) => found.get(name)).join('\n');
};
const compile = async (label, ts, exports, args = []) => {
  const { code, errors } = await transform(label, ts);
  assert.equal(errors?.length ?? 0, 0, String(errors));
  const javascript = code.replace(/^export\s+/gm, '');
  return new Function(...args, `${javascript}\nreturn { ${exports.join(', ')} };`);
};
const pass = []; const fail = [];
const test = (label, fn) => { try { fn(); pass.push(label); console.log(`PASS ${label}`); } catch (error) { fail.push(label); console.log(`FAIL ${label}: ${error.message}`); } };

const dayText = source('day.ts');
const dayDeclarations = declaration(dayText, ['recordOf', 'stringsOf', 'stringMapOf', 'clockAt', 'utcAt', 'theatreOriginOf', 'EVENT_STRINGS', 'savedEvent']);
const dayFactory = await compile('day-print-persistence-e182.ts', `${dayDeclarations}\n`, ['savedEvent'], ['approvedCustomerOption']);
const day = dayFactory(() => true);
test('serialized UTC print and print-day evidence survive the saved-event parser while legacy clocks remain valid', () => {
  const print = {
    kind: 'print', sale: 's1', at: '2026-08-31T09:00:00.000Z', prices: { l1: 12 }, revision: 'r1', materialCursor: 0,
    requestedAt: '2026-08-31T08:55:00.000Z', requestedBy: 'Mina', confirmedAt: '2026-08-31T09:00:00.000Z', confirmedBy: 'Mina', attemptId: 'print-1',
  };
  const dayPrint = { kind: 'print-day', day: '2026-08-31', at: '2026-08-31T09:00:00.000Z' };
  assert.equal(day.savedEvent(JSON.parse(JSON.stringify(print))), true);
  assert.equal(day.savedEvent(JSON.parse(JSON.stringify(dayPrint))), true);
  assert.equal(day.savedEvent({ kind: 'print', sale: 's1', at: '09:00' }), true);
});
test('saved-event parser rejects malformed UTC print evidence without widening legacy event times', () => {
  const valid = {
    kind: 'print', sale: 's1', at: '2026-08-31T09:00:00.000Z', prices: { l1: 12 }, revision: 'r1', materialCursor: 0,
    requestedAt: '2026-08-31T08:55:00.000Z', requestedBy: 'Mina', confirmedAt: '2026-08-31T09:00:00.000Z', confirmedBy: 'Mina', attemptId: 'print-1',
  };
  assert.equal(day.savedEvent({ ...valid, requestedAt: '09:00' }), false);
  assert.equal(day.savedEvent({ ...valid, materialCursor: -1 }), false);
  assert.equal(day.savedEvent({ ...valid, attemptId: '' }), false);
  assert.equal(day.savedEvent({ kind: 'print-day', day: '2026-08-31', at: '2026-08-31T09:00:00Z' }), false);
  assert.equal(day.savedEvent({ kind: 'line', sale: 's1', at: '2026-08-31T09:00:00.000Z', line: 'l1' }), false);
});

const saleText = source('sale.ts');
const saleDeclarations = declaration(saleText, ['TOUCHES_GOODS', 'materialCursorForSale', 'foldFacets', 'foldMoney', 'priceLines', 'printCapturedSale']);
const events = [];
/* `priceLines` reads the account's standing agreement before it prices a line (`discountOn`, from
   `tiers.ts`), so the seam list names it too. These tests are about print recovery, so the seam
   answers what a customer with no agreement answers — none — and the prices below are the line's
   own numbers, undiscounted. */
const saleFactory = await compile('sale-print-e182.ts', `${saleDeclarations}\n`, ['materialCursorForSale', 'foldFacets', 'foldMoney', 'priceLines', 'printCapturedSale'], ['dayNow', 'appendPersisted', 'writtenOn', 'declaredUnitFactor', 'round', 'tierRatio', 'customerKey', 'discountOn']);
const sale = saleFactory(() => ({ events }), (event) => { events.push(event); return true; }, () => null, () => null, (value) => Math.round(value * 10000) / 10000, () => 1, (customer) => `customer:${customer.id}`, () => null);

test('late old-copy confirmation after quantity and tariff edits stays stale and leaves current price B live', () => {
  const late = [
    { kind: 'line', sale: 's1', at: '09:05', line: 'line', given: 2, price: 22 },
    { kind: 'tier', sale: 's1', at: '09:06', tier: 'B' },
    { kind: 'print', sale: 's1', at: '09:10', prices: { line: 11 }, materialCursor: 0, attemptId: 'p-old' },
  ];
  const facets = sale.foldFacets(late);
  assert.equal(facets.printed?.stale, true);
  const money = sale.foldMoney(late, 'A');
  assert.equal(money.frozen, undefined);
  assert.equal(money.moneyAt, undefined);
  const priced = sale.priceLines({ sector: 'fish' }, { id: 'c-test' }, '2026-08-31', [{ id: 'line', product: {}, unit: 'kg', price: 22 }], late, 'A', money);
  assert.equal(priced[0].price, 22);
});
test('tier-only edit before a late old-copy confirmation also cannot freeze old price', () => {
  const late = [{ kind: 'tier', sale: 's1', at: '09:05', tier: 'B' }, { kind: 'print', sale: 's1', at: '09:10', prices: { line: 11 }, materialCursor: 0, attemptId: 'p-tier' }];
  const money = sale.foldMoney(late, 'A');
  assert.equal(money.frozen, undefined);
  assert.equal(money.tier, 'B');
});
test('same captured attempt id appends one actual sale event across retry', () => {
  events.length = 0;
  const captured = { sale: 's1', at: '09:00', prices: { line: 11 }, revision: 'r1', materialCursor: 0, requestedAt: '08:59', requestedBy: 'A', confirmedAt: '09:10', confirmedBy: 'A', attemptId: 'p1' };
  assert.equal(sale.printCapturedSale(captured), true);
  assert.equal(sale.printCapturedSale(captured), true);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].prices, { line: 11 });
});

const queueText = source('print-queue.ts');
const queueDeclarations = declaration(queueText, ['validSubject', 'validStoredJob', 'markPrintDialogRequested', 'markPrintRunRequested', 'confirmPrintAttempt']);
let jobs = [];
let writes = true;
let writeBudget = Infinity;
const canWrite = () => writes && writeBudget-- > 0;
const patch = (id, change) => {
  if (!canWrite()) return false;
  jobs = jobs.map((job) => job.id === id ? change(job) : job); return true;
};
const replaceJobs = (next) => { if (!canWrite()) return false; jobs = next; return true; };
let ledger = 0;
let packingCalls = [];
const packingOutputs = { complete: (captured, confirmation) => { packingCalls.push({ captured, confirmation }); return true; } };
const isPackingCapture = (value) => Boolean(value && ['fish', 'meat', 'fruit'].includes(value.sector)
  && /^\d{4}-\d{2}-\d{2}$/.test(value.day) && value.sale && value.revision);
const printDay = (day, at) => { events.push({ kind: 'print-day', day, at }); return true; };
const queueFactory = await compile('queue-print-e182.ts', `${queueDeclarations}\n`, ['validStoredJob', 'markPrintDialogRequested', 'markPrintRunRequested', 'confirmPrintAttempt'], ['JOBS', 'patch', 'replaceJobs', 'dayNow', 'printCapturedSale', 'printDay', 'packingOutputs', 'isPackingCapture', 'SECTORS']);
const queueApi = () => queueFactory(jobs, patch, replaceJobs, () => ({ sector: 'fish', events }), (captured) => {
  if (!events.some((event) => event.kind === 'print' && event.attemptId === captured.attemptId)) { events.push({ kind: 'print', ...captured }); ledger += 1; }
  return true;
}, printDay, packingOutputs, isPackingCapture, ['fish', 'meat', 'fruit']);
const job = (state = 'waiting', extra = {}) => ({ id: 'p9', subject: { kind: 'albaran', sale: 's1' }, what: 'A', sheets: 1, paper: 'A4', copies: 1, printer: 'Browser print dialog', revision: 'r1', sector: 'fish', requestedAt: '2026-08-31T08:00:00.000Z', requestedBy: 'You', materialCursor: 0, saleSnapshot: { sale: 's1', prices: { l1: 12 } }, pages: 1, left: 1, state, at: '08:00', rails: [], ...extra });

test('waiting attempt cannot confirm until durable dialog request transition', () => {
  jobs = [job()]; writes = true; writeBudget = Infinity; events.length = 0; ledger = 0;
  assert.equal(queueApi().confirmPrintAttempt('p9', '09:00'), false);
  assert.equal(ledger, 0);
  assert.equal(queueApi().markPrintDialogRequested('p9'), true);
  assert.equal(jobs[0].state, 'printing');
});
test('journal write failure prevents requested transition and controller print', () => {
  jobs = [job()]; writes = false; writeBudget = Infinity;
  assert.equal(queueApi().markPrintDialogRequested('p9'), false);
  assert.equal(jobs[0].state, 'waiting'); writes = true;
});
test('ledger success plus final journal failure retries without duplicate history', () => {
  jobs = [job('printing')]; events.length = 0; ledger = 0; writes = true; writeBudget = 1;
  assert.equal(queueApi().confirmPrintAttempt('p9', '2026-08-31T09:00:00.000Z'), false);
  assert.equal(ledger, 1); assert.equal(jobs[0].state, 'printing');
  assert.equal(jobs[0].confirmationPending.at, '2026-08-31T09:00:00.000Z');
  writeBudget = Infinity;
  assert.equal(queueApi().confirmPrintAttempt('p9', '2026-08-31T09:01:00.000Z'), true);
  assert.equal(ledger, 1); assert.equal(jobs[0].state, 'printed');
  assert.equal(jobs[0].done, '2026-08-31T09:00:00.000Z');
});
test('divider acknowledgement persists without writing a sale print', () => {
  jobs = [job('printing', { saleSnapshot: undefined, subject: { kind: 'day', day: '2026-08-31', salesIds: ['s1'], divider: 'albaranes' } })];
  writes = true; writeBudget = Infinity; events.length = 0;
  assert.equal(queueApi().confirmPrintAttempt('p9', '2026-08-31T09:00:00.000Z', 'Mina'), true);
  assert.equal(jobs[0].state, 'printed'); assert.equal(jobs[0].confirmedBy, 'Mina');
  assert.equal(events.length, 0);
});
test('recovered day sheet uses its captured IDs and first confirmation UTC without duplicate day history', () => {
  jobs = [job('printing', { saleSnapshot: undefined, subject: { kind: 'day', day: '2026-08-31', salesIds: ['s1'] } })];
  writes = true; writeBudget = 1; events.length = 0;
  assert.equal(queueApi().confirmPrintAttempt('p9', '2026-08-31T09:00:00.000Z', 'Mina'), false);
  assert.deepEqual(events, [{ kind: 'print-day', day: '2026-08-31', at: '2026-08-31T09:00:00.000Z' }]);
  writeBudget = Infinity;
  assert.equal(queueApi().confirmPrintAttempt('p9', '2026-08-31T09:02:00.000Z', 'Other'), true);
  assert.equal(events.length, 1); assert.equal(jobs[0].done, '2026-08-31T09:00:00.000Z');
});
test('recovered packing confirmation uses persisted generated capture and actor/time provenance', () => {
  const capture = { sector: 'fish', day: '2026-08-31', sale: 's1', revision: 'packing-r1' };
  jobs = [job('printing', { saleSnapshot: undefined, subject: { kind: 'packing', day: '2026-08-31', salesIds: ['s1'] }, packingOutput: [capture] })];
  writes = true; writeBudget = Infinity; packingCalls = [];
  assert.equal(queueApi().confirmPrintAttempt('p9', '2026-08-31T09:00:00.000Z', 'Mina'), true);
  assert.deepEqual(packingCalls, [{ captured: [capture], confirmation: { requestedAt: '2026-08-31T08:00:00.000Z', requestedBy: 'You', confirmedAt: '2026-08-31T09:00:00.000Z', confirmedBy: 'Mina', attemptId: 'p9' } }]);
  assert.equal(jobs[0].state, 'printed');
});
test('malformed price/snapshot and foreign sector journal records are rejected', () => {
  const api = queueApi();
  assert.equal(api.validStoredJob({ ...job(), sector: 'wrong' }), false);
  assert.equal(api.validStoredJob({ ...job(), saleSnapshot: { sale: 'other', prices: { l1: 12 } } }), false);
  assert.equal(api.validStoredJob({ ...job(), saleSnapshot: { sale: 's1', prices: { l1: '12' } } }), false);
  assert.equal(api.validStoredJob(job()), true);
});

const packingText = source('packing-output.ts');
const packingDeclarations = declaration(packingText, ['PACKING_OUTPUT_KEY', 'PACKING_OUTPUT_VERSION', 'packingOutputKey', 'isPackingCapture', 'isConfirmation', 'parsePackingHistory', 'createPackingOutputStore']);
const packingFactory = await compile('packing-output-e182.ts', `${packingDeclarations}\n`, ['createPackingOutputStore'], ['browserStorage']);
const packingApi = packingFactory(() => null);
test('older packing confirmation cannot replace a newer confirmed revision', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const store = packingApi.createPackingOutputStore(() => storage);
  const newer = { sector: 'fish', day: '2026-08-31', sale: 's1', revision: 'packing-new' };
  const older = { ...newer, revision: 'packing-old' };
  assert.equal(store.complete([newer], { requestedAt: '2026-08-31T08:30:00.000Z', requestedBy: 'Mina', confirmedAt: '2026-08-31T09:00:00.000Z', confirmedBy: 'Mina', attemptId: 'p-new' }), true);
  assert.equal(store.complete([older], { requestedAt: '2026-08-31T08:00:00.000Z', requestedBy: 'Jo', confirmedAt: '2026-08-31T09:05:00.000Z', confirmedBy: 'Jo', attemptId: 'p-old' }), true);
  const record = Object.values(store.getSnapshot().records)[0];
  assert.equal(record.revision, 'packing-new'); assert.equal(record.attemptId, 'p-new');
});
if (fail.length) process.exitCode = 1;
console.log(`PRINT HISTORY DOMAIN: ${pass.length} PASS, ${fail.length} FAIL`);
