#!/usr/bin/env node
/* Focused output-history regressions against the real module; no app build.
 *
 * IT IS COMPILED TO DISK, NOT TO A `data:` URL. `packing-output.ts` imports `./paper-manifest`,
 * and Node cannot resolve a relative specifier from a `data:` URL — the import threw
 * ERR_UNSUPPORTED_RESOLVE_REQUEST before a single assertion ran, which is what quarantined this
 * file. `tools/ts-module.mjs` compiles the module WITH its imports beside it and requires it by
 * path, so every assertion below now runs against the same code the app runs. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'rolldown/experimental';
import { parse } from '@babel/parser';
import { loadTypeScript } from './ts-module.mjs';

const { createPackingOutputStore, capturePackingOutputs, remainingPackingSales, unqueuedPackingSales,
  packingRevisionOf, packingOutputKey, PACKING_OUTPUT_KEY, PACKING_OUTPUT_VERSION, parsePackingHistory } = loadTypeScript('src/prototypes/cedar/packing-output.ts', 'packing-output-test');
let checks = 0;
const test = (label, action) => { action(); console.log(`PASS ${label}`); checks++; };
/* WHAT COMPLETES A PACKING COPY IS AN OPERATOR, NOT A CLOCK. `complete` takes who asked, who
   confirmed, when each happened and which attempt it was — the evidence itself — so every call
   below hands over one of these rather than a bare time. */
const confirmation = (at, attemptId) => ({
  requestedAt: `2025-08-22T${at}:00.000Z`, requestedBy: 'You',
  confirmedAt: `2025-08-22T${at}:00.000Z`, confirmedBy: 'Mina', attemptId,
});
const memory = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const storage = memory();
const store = createPackingOutputStore(() => storage);
const order = {
  id: 'same-order', day: '2025-08-22', deliveryDay: 'Friday 22.08', number: 'A-42', at: '08:00', window: '09:00',
  customer: { id: 'c1', name: 'Restaurant', truck: 2, zone: 'Coast' },
  state: 'committed', prep: { at: '08:01', lines: ['l1'], stale: false },
  lines: [{ id: 'l1', product: { id: 'pulpo', name: 'Pulpo', unit: 'kg', family: 'fish', trace: {} },
    ordered: 10, given: 10, unit: 'kg', price: 20, weighed: true, klass: 'A',
    allocations: [{ batch: 'LOT-A', qty: 7 }, { batch: 'LOT-B', qty: 3 }], prepNote: 'Keep cold' }],
};
const original = structuredClone(order);
const remains = (sale = order, sector = 'fish', which = store) => remainingPackingSales([sale], sector, which.getSnapshot()).length;
const captured = capturePackingOutputs([order], 'fish');

test('Prepared but never printed remains; creating the queued snapshot is not completion', () => {
  assert.equal(remains(), 1); assert.equal(storage.getItem(PACKING_OUTPUT_KEY), null);
});
test('Pending suppresses duplicate Remaining presses without becoming completed', () => {
  assert.equal(unqueuedPackingSales([order], 'fish', captured).length, 0); assert.equal(remains(), 1);
});
test('Completion removes the exact current revision and does not prepare or print the delivery note', () => {
  assert.equal(store.complete(captured, confirmation('09:45', 'p-first')), true); assert.equal(remains(), 0); assert.deepEqual(order, original);
});
test('Completion survives reload and records the operator\u2019s own confirmation', () => {
  const reloaded = createPackingOutputStore(() => storage); assert.equal(remains(order, 'fish', reloaded), 0);
  const record = reloaded.getSnapshot().records[packingOutputKey(captured[0])]; assert.equal(record.evidence, 'operator-confirmed');
  assert.equal(record.confirmedBy, 'Mina'); assert.equal(record.attemptId, 'p-first');
});
test('Changed quantity returns to remaining', () => {
  const revised = structuredClone(order); revised.lines[0].given = 11; assert.equal(remains(revised), 1);
});
test('Captured output is immutable when the source changes before completion', () => {
  const edited = structuredClone(order); const snapshot = capturePackingOutputs([edited], 'fish'); edited.lines[0].given = 99;
  assert.equal(store.complete(snapshot, confirmation('09:46', 'p-immutable')), true); assert.equal(remains(edited), 1);
});
test('Lots, allocation quantities, units, notes, customer names and trucks invalidate the output', () => {
  const changes = [s => s.lines[0].allocations[0].qty++, s => s.lines[0].allocations[0].batch = 'LOT-C',
    s => s.lines[0].unit = 'caja', s => s.lines[0].prepNote = 'Skin off', s => s.customer.name = 'New name', s => s.customer.truck = 3];
  for (const change of changes) { const edited = structuredClone(order); change(edited); assert.equal(remains(edited), 1); }
});
test('Warehouse ticks, read state, delivery-note print and tariff-only changes do not reprint packing', () => {
  const changed = structuredClone(order); changed.prep = undefined; changed.read = { at: '09:47' };
  changed.printed = { count: 1, at: '09:48', stale: false }; changed.lines[0].price = 900; changed.lines[0].tierPriced = true;
  assert.equal(remains(changed), 0);
});
test('Same order ID in another sector or day has independent evidence', () => {
  assert.equal(remains(order, 'meat'), 1); assert.equal(remains({ ...order, day: '2025-08-23' }), 1);
});
test('Print all may deliberately capture and complete an already completed order again', () => {
  assert.equal(capturePackingOutputs([order], 'fish').length, 1); assert.equal(store.complete(captured, confirmation('09:49', 'p-again')), true);
  assert.equal(Object.keys(store.getSnapshot().records).length, 1); assert.equal(remains(), 0);
});
test('Pending matches the exact revision even when another version is queued later', () => {
  const changed = structuredClone(order); changed.lines[0].given++;
  assert.equal(unqueuedPackingSales([order], 'fish', [...captured, ...capturePackingOutputs([changed], 'fish')]).length, 0);
  assert.equal(unqueuedPackingSales([changed], 'fish', captured).length, 1);
});
test('A failed storage write never creates completion or hides remaining work', () => {
  const failed = createPackingOutputStore(() => ({ ...memory(), setItem: () => { throw new Error('quota'); } }));
  assert.equal(failed.complete(captured, confirmation('09:50', 'p-quota')), false); assert.equal(remains(order, 'fish', failed), 1); assert.equal(failed.getSnapshot().persistenceError, true);
});
test('Malformed or unsupported evidence is ignored', () => {
  const unsupported = JSON.stringify({ version: PACKING_OUTPUT_VERSION, outputs: [{ ...captured[0], ...confirmation('09:45', 'p-evidence'), evidence: 'physical-success' }] });
  const superseded = JSON.stringify({ version: PACKING_OUTPUT_VERSION - 1, outputs: [{ ...captured[0], ...confirmation('09:45', 'p-old-version'), evidence: 'operator-confirmed' }] });
  assert.equal(Object.keys(parsePackingHistory(unsupported).records).length, 0);
  assert.equal(Object.keys(parsePackingHistory(superseded).records).length, 0);
  assert.equal(Object.keys(parsePackingHistory('{bad').records).length, 0);
});
test('Object property insertion order does not change the same content revision', () => {
  const reordered = structuredClone(order); reordered.customer = Object.fromEntries(Object.entries(reordered.customer).reverse());
  assert.equal(packingRevisionOf(order), packingRevisionOf(reordered));
});

// Execute the real packingOrder builder with minimal page-layout dependencies. The callback is
// the boundary under test; no copied implementation and no simulated sale/preparation events.
const queueSource = readFileSync(new URL('../src/prototypes/cedar/print-queue.ts', import.meta.url), 'utf8');
const ast = parse(queueSource, { sourceType: 'module', plugins: ['typescript'] });
const node = ast.program.body.find(n => n.type === 'ExportNamedDeclaration' && n.declaration?.id?.name === 'packingOrder');
assert.ok(node);
const built = await transform('packing-order-test.ts', queueSource.slice(node.declaration.start, node.declaration.end));
const completionStorage = memory(); const callbackStore = createPackingOutputStore(() => completionStorage);
const factory = new Function('capturePackingOutputs', 'packingOutputs', 'truckRuns', 'paginate', 'paperFormat', 'truckRunWords', 'printRunWords', 'dayLabelFromId', 'saleRevisionOf', `${built.code};return packingOrder;`);
const packingOrder = factory(capturePackingOutputs, callbackStore, sales => [{ truck: 2, sales }], () => [{}], () => 'a4', () => 'Truck 2', (_kind, n) => `${n} packing lists`, day => day, sales => `sale-revision-${sales.length}`);
const queued = packingOrder(order.day, [order], '09:51', 'A4', 'fish');
test('Actual packing builder leaves history untouched before its completion callback', () => {
  assert.equal(remainingPackingSales([order], 'fish', callbackStore.getSnapshot()).length, 1); assert.equal(completionStorage.getItem(PACKING_OUTPUT_KEY), null);
  assert.deepEqual(queued.packingOutput, captured);
});
test('Actual packing completion callback records its captured revision without touching the sale', () => {
  queued.record({ requestedAt: '2025-08-22T09:51:00.000Z', requestedBy: 'You', at: '2025-08-22T09:52:00.000Z', by: 'Mina', attemptId: 'p-queued' });
  assert.equal(remainingPackingSales([order], 'fish', callbackStore.getSnapshot()).length, 0); assert.deepEqual(order, original);
  const recorded = Object.values(callbackStore.getSnapshot().records)[0];
  assert.equal(recorded.confirmedAt, '2025-08-22T09:52:00.000Z'); assert.equal(recorded.confirmedBy, 'Mina'); assert.equal(recorded.attemptId, 'p-queued');
});
test('Reset removes persisted packing output history', () => {
  store.reset(); assert.equal(remains(), 1); assert.equal(storage.getItem(PACKING_OUTPUT_KEY), null);
});
console.log(`${checks} packing-output regression checks passed`);
