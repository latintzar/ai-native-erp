#!/usr/bin/env node
// E200.01 · the template model, held to THE-OUTPUTS-SPEC OUT-01. Two pure TS modules transpiled in
// memory and stitched — no app build, no browser. What this file proves:
//
//   · the two that ship reproduce TODAY'S layouts exactly, so a fresh house prints the same paper;
//   · the migration is idempotent and a legacy store opens with its templates intact;
//   · a saved edit raises the revision;
//   · the printer reads the TEMPLATE, and nothing reads the retired house-wide key.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transform } from 'rolldown/experimental';

const load = async (relative, rewrites = {}) => {
  const source = new URL(relative, import.meta.url);
  const { code, errors } = await transform(fileURLToPath(source), readFileSync(source, 'utf8'));
  assert.equal(errors?.length ?? 0, 0, `transpile ${relative}`);
  let stitched = code;
  for (const [specifier, url] of Object.entries(rewrites)) {
    stitched = stitched.split(`'${specifier}'`).join(`'${url}'`).split(`"${specifier}"`).join(`"${url}"`);
  }
  return `data:text/javascript;base64,${Buffer.from(stitched).toString('base64')}`;
};

const memory = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
};
let storage = memory();
globalThis.window = { get localStorage() { return storage; } };

const layoutUrl = await load('../src/prototypes/cedar/print-layout.ts');
const T = await import(await load('../src/prototypes/cedar/output-templates.ts', { './print-layout': layoutUrl }));
const L = await import(layoutUrl);

let checks = 0;
const test = (label, action) => { action(); console.log(`PASS ${label}`); checks++; };
const fresh = () => { storage = memory(); };
const SECTOR = 'fish';
const TEMPLATES = `rocoto:outputs:templates:${SECTOR}`;
const SAVED = `rocoto:export:saved-outputs:${SECTOR}`;
const PROFILE = `rocoto-print-layout-v1:${SECTOR}`;

// ── 1 · THE TWO THAT SHIP REPRODUCE TODAY'S LAYOUT EXACTLY ────────────────────────────────────
// The claim E200.01 stands or falls on: a fresh house's paper is byte-for-byte the paper it drew
// before, because the profile the renderer receives is the same object it received before.
test('The shipped albarán template hands the renderer PRINT_LAYOUT_DEFAULTS unchanged', () => {
  const albaran = T.shippedTemplates().find((one) => one.id === 'albaran-default');
  assert.deepEqual(T.printProfileOf(albaran), L.PRINT_LAYOUT_DEFAULTS);
  assert.equal(albaran.paper, 'A4');
  assert.equal(albaran.copies, 1);
  assert.equal(albaran.dayButton, 0);
});
test('The shipped packing template hands the renderer PRINT_LAYOUT_DEFAULTS unchanged', () => {
  const packing = T.shippedTemplates().find((one) => one.id === 'packing-default');
  assert.deepEqual(T.printProfileOf(packing), L.PRINT_LAYOUT_DEFAULTS);
  assert.equal(packing.paper, 'A4');
  assert.equal(packing.copies, 1);
  assert.equal(packing.dayButton, 1);
});
test('Every shipped template hands the renderer a profile identical to the shipped defaults', () => {
  for (const template of T.shippedTemplates()) assert.deepEqual(T.printProfileOf(template), L.PRINT_LAYOUT_DEFAULTS);
});
test('Every packing template carries the capture mark, and the shipped albarán carries none', () => {
  const [albaran, packing] = T.shippedTemplates();
  assert.deepEqual(packing.marks, { qr: true, corners: true });
  assert.deepEqual(albaran.marks, { qr: false, corners: false });
  const forced = T.parseTemplate({ ...packing, marks: { qr: false, corners: false } });
  assert.deepEqual(forced.marks, { qr: true, corners: true });
});

// ── 2 · A FRESH HOUSE ─────────────────────────────────────────────────────────────────────────
test('A fresh house opens on the templates that ship, and the store is written once', () => {
  fresh();
  const templates = T.readTemplates(SECTOR);
  assert.deepEqual(templates.map((one) => one.id), ['albaran-default', 'packing-default', 'order-file']);
  assert.equal(JSON.parse(storage.getItem(TEMPLATES)).version, 1);
});

// ── 3 · THE MIGRATION IS IDEMPOTENT ───────────────────────────────────────────────────────────
test('Running the migration twice over one legacy store lands the same bytes', () => {
  fresh();
  storage.setItem(SAVED, JSON.stringify({ version: 1, outputs: [
    { id: 'delivery-notes', templateId: 'delivery-notes', kind: 'print', title: 'Albaranes de casa', scope: 'Current selection', chips: ['All products'], paper: 'A5', copies: 2, layout: 'Standard' },
    { id: 'packing-sheets', templateId: 'packing-sheets', kind: 'print', title: 'Packing sheets', scope: 'All salespeople', chips: ['All products'], paper: 'A4', copies: 1, layout: 'By truck' },
  ] }));
  storage.setItem(PROFILE, JSON.stringify({ version: 1, albaran: { finalWeight: true, unitPrice: false, lineTotal: false }, packing: { columns: 2, groupByTruck: true, sort: 'customer' } }));
  const once = T.migrateTemplates(SECTOR);
  const first = storage.getItem(TEMPLATES);
  const twice = T.migrateTemplates(SECTOR);
  assert.equal(storage.getItem(TEMPLATES), first);
  assert.deepEqual(twice, once);
  // And a plain read after the migration returns the same list rather than migrating again.
  assert.deepEqual(T.readTemplates(SECTOR), once);
  assert.equal(storage.getItem(TEMPLATES), first);
});
test('The migration puts both retiring keys away in the same pass', () => {
  assert.equal(storage.getItem(SAVED), null);
  assert.equal(storage.getItem(PROFILE), null);
});

// ── 4 · A LEGACY STORE OPENS WITH ITS TEMPLATES INTACT ────────────────────────────────────────
test('A legacy store keeps every saved copy: its id, its name, its paper, its copies, its scope', () => {
  fresh();
  storage.setItem(SAVED, JSON.stringify({ version: 1, outputs: [
    { id: 'delivery-notes', templateId: 'delivery-notes', kind: 'print', title: 'Albaranes de casa', scope: 'Current selection', chips: ['Category · Pescado'], paper: 'A5', copies: 2, layout: 'Standard' },
    { id: 'nightly', templateId: 'daily-accounting', kind: 'email', title: 'Nightly to accounting', scope: 'All salespeople', chips: ['All products'], recipients: 'books@example.test', timing: 'Daily at 16:00', timezone: 'Europe/Madrid', attachments: 'Both', reviewRule: 'Review every send' },
    { id: 'order-file', templateId: 'csv-file', kind: 'file', title: 'Order file', scope: 'Current selection', chips: ['All products'], fileFormat: 'CSV', fileColumns: ['Customer', 'Product'], fileName: 'orders', archivedAt: '2026-08-01T00:00:00.000Z', archivedBy: 'Marta' },
  ] }));
  const templates = T.readTemplates(SECTOR);
  assert.deepEqual(templates.map((one) => one.id), ['delivery-notes', 'nightly', 'order-file']);
  const [albaran, email, file] = templates;
  assert.equal(albaran.name, 'Albaranes de casa');
  assert.equal(albaran.category, 'albaran');
  assert.equal(albaran.paper, 'A5');
  assert.equal(albaran.copies, 2);
  assert.deepEqual(albaran.selection, { scope: 'Current selection', chips: ['Category · Pescado'] });
  assert.equal(email.category, 'email');
  assert.equal(email.layout.recipients, 'books@example.test');
  assert.equal(email.layout.timezone, 'Europe/Madrid');
  assert.equal(email.layout.reviewRule, 'Review every send');
  assert.equal(file.category, 'file');
  assert.deepEqual(file.layout.columns, ['Customer', 'Product']);
  assert.equal(file.archivedAt, '2026-08-01T00:00:00.000Z');
  // The day's two seats are the pair `DayPaper` hard-codes today; an archived template holds none.
  assert.deepEqual(T.templateSeats(templates).map((one) => one && one.id), ['delivery-notes', undefined]);
});
test('A house that had set the layout profile keeps its paper exactly', () => {
  fresh();
  storage.setItem(PROFILE, JSON.stringify({ version: 1, albaran: { finalWeight: true, unitPrice: false, lineTotal: false }, packing: { columns: 2, groupByTruck: true, sort: 'lifetime-value' } }));
  const templates = T.readTemplates(SECTOR);
  const albaran = templates.find((one) => one.category === 'albaran');
  const packing = templates.find((one) => one.category === 'packing');
  assert.deepEqual(T.printProfileOf(albaran).albaran, { finalWeight: true, unitPrice: false, lineTotal: false });
  assert.deepEqual(T.printProfileOf(packing).packing, { columns: 2, groupByTruck: true, sort: 'lifetime-value' });
});
test('A store this build cannot read migrates rather than standing empty', () => {
  fresh();
  storage.setItem(TEMPLATES, '{ this is not json');
  assert.deepEqual(T.readTemplates(SECTOR).map((one) => one.id), ['albaran-default', 'packing-default', 'order-file']);
});
test('A store carrying one unreadable row keeps every row that still parses', () => {
  fresh();
  const [albaran] = T.shippedTemplates();
  storage.setItem(TEMPLATES, JSON.stringify({ version: 1, templates: [albaran, { id: '', category: 'nowhere' }] }));
  assert.deepEqual(T.readTemplates(SECTOR).map((one) => one.id), ['albaran-default']);
});
test('A write that stalls leaves the legacy keys where they are, so the next read migrates again', () => {
  fresh();
  storage.setItem(SAVED, JSON.stringify({ version: 1, outputs: [
    { id: 'delivery-notes', templateId: 'delivery-notes', kind: 'print', title: 'Delivery notes', scope: 'Current selection', chips: ['All products'], paper: 'A4', copies: 1 },
  ] }));
  const refuse = { ...storage, setItem: () => { throw new Error('quota'); } };
  const kept = storage;
  storage = refuse;
  const templates = T.migrateTemplates(SECTOR);
  assert.equal(templates.length, 1);
  storage = kept;
  assert.notEqual(storage.getItem(SAVED), null);
  assert.equal(storage.getItem(TEMPLATES), null);
});
test('writeTemplates says false when the store refuses, and true when it takes the write', () => {
  fresh();
  const kept = storage;
  storage = { ...storage, setItem: () => { throw new Error('quota'); } };
  assert.equal(T.writeTemplates(SECTOR, T.shippedTemplates()), false);
  storage = kept;
  assert.equal(T.writeTemplates(SECTOR, T.shippedTemplates()), true);
});

// ── 5 · AN EDIT PRODUCES A NEW VERSION ────────────────────────────────────────────────────────
test('A saved edit raises the revision and stamps who touched it, and the id and category hold', () => {
  const [albaran] = T.shippedTemplates();
  const edited = T.savedTemplate(albaran, { layout: { kind: 'albaran', fields: { finalWeight: true, unitPrice: false, lineTotal: false } } }, '2026-09-06T08:00:00.000Z', 'Marta');
  assert.equal(edited.revision, albaran.revision + 1);
  assert.equal(edited.updatedAt, '2026-09-06T08:00:00.000Z');
  assert.equal(edited.updatedBy, 'Marta');
  assert.equal(edited.id, albaran.id);
  assert.equal(edited.category, 'albaran');
  assert.equal(albaran.revision, 1);
});
test('A saved edit reaches the renderer: the profile changes and the shipped defaults stand', () => {
  const [albaran] = T.shippedTemplates();
  const edited = T.savedTemplate(albaran, { layout: { kind: 'albaran', fields: { finalWeight: true, unitPrice: false, lineTotal: false } } }, '2026-09-06T08:00:00.000Z', 'Marta');
  assert.deepEqual(T.printProfileOf(edited).albaran, { finalWeight: true, unitPrice: false, lineTotal: false });
  assert.deepEqual(L.PRINT_LAYOUT_DEFAULTS.albaran, { finalWeight: false, unitPrice: false, lineTotal: true });
  assert.deepEqual(T.printProfileOf(albaran), L.PRINT_LAYOUT_DEFAULTS);
});
test('A duplicate is an independent template with an empty seat and revision one', () => {
  const [albaran] = T.shippedTemplates();
  const copy = T.duplicateTemplate(albaran, '2026-09-06T08:00:00.000Z', 'Marta');
  assert.notEqual(copy.id, albaran.id);
  assert.equal(copy.name, 'Delivery notes copy');
  assert.equal(copy.revision, 1);
  assert.equal(copy.dayButton, undefined);
  assert.equal(copy.lastUsedAt, undefined);
});

// ── 6 · THE PRINTER READS THE TEMPLATE ────────────────────────────────────────────────────────
test('printProfileOf reads the template and touches no storage at all', () => {
  fresh();
  storage.setItem(PROFILE, JSON.stringify({ version: 1, albaran: { finalWeight: true, unitPrice: true, lineTotal: true }, packing: { columns: 2, groupByTruck: true, sort: 'customer' } }));
  const [albaran, packing] = T.shippedTemplates();
  assert.deepEqual(T.printProfileOf(albaran), L.PRINT_LAYOUT_DEFAULTS);
  assert.deepEqual(T.printProfileOf(packing), L.PRINT_LAYOUT_DEFAULTS);
  assert.notEqual(storage.getItem(PROFILE), null);
});
test('A template with no opinion about the other paper takes the shipped values for it', () => {
  const packing = T.shippedTemplates().find((one) => one.category === 'packing');
  const edited = T.savedTemplate(packing, { layout: { kind: 'packing', columns: 2, groupByTruck: true, sort: 'order-value' } }, '2026-09-06T08:00:00.000Z', 'Marta');
  assert.deepEqual(T.printProfileOf(edited).packing, { columns: 2, groupByTruck: true, sort: 'order-value' });
  assert.deepEqual(T.printProfileOf(edited).albaran, L.PRINT_LAYOUT_DEFAULTS.albaran);
});
test('The chip states what the printer sees: the words are read off the same record', () => {
  const [albaran, packing] = T.shippedTemplates();
  assert.deepEqual(T.layoutWords(albaran.layout), ['Line total']);
  assert.deepEqual(T.layoutWords(packing.layout), ['1 column', 'By truck', 'Route order']);
  const edited = T.savedTemplate(packing, { layout: { kind: 'packing', columns: 2, groupByTruck: true, sort: 'customer' } }, '2026-09-06T08:00:00.000Z', 'Marta');
  assert.deepEqual(T.layoutWords(edited.layout), ['2 columns', 'By truck', 'Customer A–Z']);
  assert.equal(T.printProfileOf(edited).packing.sort, 'customer');
  const quiet = T.savedTemplate(albaran, { layout: { kind: 'albaran', fields: { finalWeight: false, unitPrice: false, lineTotal: false } } }, '2026-09-06T08:00:00.000Z', 'Marta');
  assert.deepEqual(T.layoutWords(quiet.layout), ['Quantities']);
});
// E200.02 · THE ADAPTER IS GONE. `savedOutputOfTemplate` and `templateOfSavedOutput` existed so the
// old export centre could keep speaking «saved copy» while the store already held templates; the
// library reads `Template` directly, so what survives is the migration's ONE-WAY read, and this is
// its contract: a house's stored copy opens as an editable template carrying its own name, paper
// and category, and the retired key is put away in the same pass.
test('A stored saved copy opens as an editable template, and no surface speaks that shape', () => {
  fresh();
  assert.equal(typeof T.savedOutputOfTemplate, 'undefined');
  assert.equal(typeof T.templateOfSavedOutput, 'undefined');
  storage.setItem(SAVED, JSON.stringify({ version: 1, outputs: [
    { id: 'bay-list', templateId: 'packing-sheets', kind: 'print', title: 'Bay list', scope: 'Current selection', chips: ['All products'], paper: 'A5', copies: 2 },
  ] }));
  storage.setItem(PROFILE, JSON.stringify({ version: 1, albaran: { finalWeight: false, unitPrice: false, lineTotal: true }, packing: { columns: 2, groupByTruck: true, sort: 'order-value' } }));
  const [template, ...rest] = T.readTemplates(SECTOR);
  assert.equal(rest.length, 0);
  assert.equal(template.id, 'bay-list');
  assert.equal(template.name, 'Bay list');
  assert.equal(template.category, 'packing');
  assert.equal(template.paper, 'A5');
  assert.equal(template.copies, 2);
  assert.deepEqual(T.layoutWords(template.layout), ['2 columns', 'By truck', 'Order value']);
  assert.equal(storage.getItem(SAVED), null);
});

// ── 7 · THE DAY'S TWO SEATS ───────────────────────────────────────────────────────────────────
test('Two seats, and taking one returns whoever held it to the library', () => {
  const templates = T.shippedTemplates();
  const seated = T.withSeat(templates, 'order-file', 0);
  assert.deepEqual(T.templateSeats(seated).map((one) => one && one.id), ['order-file', 'packing-default']);
  assert.equal(seated.find((one) => one.id === 'albaran-default').dayButton, undefined);
  assert.deepEqual(T.templateSeats(T.withoutSeat(templates, 'albaran-default')).map((one) => one && one.id), [undefined, 'packing-default']);
});
test('Archiving a seated template clears its seat in the same write', () => {
  const [albaran] = T.shippedTemplates();
  const away = T.archivedTemplate(albaran, '2026-09-06T08:00:00.000Z', 'Marta');
  assert.equal(away.dayButton, undefined);
  assert.equal(away.archivedAt, '2026-09-06T08:00:00.000Z');
  assert.equal(T.restoredTemplate(away, '2026-09-06T09:00:00.000Z', 'Marta').archivedAt, undefined);
});
test('A store that somehow seats two templates in one place keeps the first', () => {
  const doubled = T.shippedTemplates().map((one) => ({ ...one, dayButton: 0 }));
  const seated = T.withOneTemplatePerSeat(doubled);
  assert.deepEqual(seated.map((one) => one.dayButton), [0, undefined, undefined]);
});
test('A paper preview reads the template standing on the day for that paper', () => {
  const templates = T.shippedTemplates();
  assert.equal(T.templateForPaper(templates, 'albaranes').id, 'albaran-default');
  assert.equal(T.templateForPaper(templates, 'packing').id, 'packing-default');
  // A house holding two albarán templates draws the one that stands on the day.
  const second = { ...T.newTemplate('albaran', 'No prices', '2026-09-06T08:00:00.000Z', 'Marta'), id: 'albaran-two' };
  assert.equal(T.templateForPaper([second, ...templates], 'albaranes').id, 'albaran-default');
  assert.equal(T.templateForPaper([second, ...T.withoutSeat(templates, 'albaran-default')], 'albaranes').id, 'albaran-two');
  // A category the house owns nothing in still answers with the shipped template.
  assert.equal(T.templateForPaper([], 'sheet').category, 'day-sheet');
});

console.log(`${checks} output-template checks passed`);
