import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/prototypes/cedar/export-period.ts', import.meta.url), 'utf8');
const javascript = source
  .replace(/^import type .*;\n/m, '')
  .replace(/^type KeyedSheet = .*;\n/m, '')
  .replace(/const isAligned = \(sheet: KeyedSheet\): sheet is KeyedSheet & \{ recordKeys: string\[\] \} =>/, 'const isAligned = (sheet) =>')
  .replace(/\(sheetName: string, recordKey: string\): string =>/, '(sheetName, recordKey) =>')
  .replace(/export function prepareExport\(\n  doc: ManualDocument,\n  previous: Record<string, string>,\n  remaining: boolean,\n\): \{ document: ManualDocument; coverage: Record<string, string>; updated: number \} \{/, 'export function prepareExport(doc, previous, remaining) {')
  .replace(/const coverage: Record<string, string> =/, 'const coverage =')
  .replace(/new Map<KeyedSheet, Map<string, \{ indexes: number\[\]; signature: string \}>>\(\)/g, 'new Map()')
  .replace(/new Map<string, \{ indexes: number\[\]; signature: string \}>\(\)/g, 'new Map()')
  .replace(/new Map<string, number\[\]>\(\)/g, 'new Map()')
  .replace(/new Set<number>\(\)/g, 'new Set()')
  .replace(/ as KeyedSheet/g, '')
  .replace(/ as ManualSheet/g, '')
  .replace(/\)!/g, ')');
const { prepareExport, recordCoverageKey } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

const doc = (sheets) => ({ sheets, warnings: [], rows: sheets.reduce((total, sheet) => total + sheet.rows.length, 0) });
const sales = (rows, recordKeys, groups = []) => ({ name: 'Ventas por cliente', head: ['Customer', 'Order', 'Quantity'], rows, recordKeys, groups });
const coverageFor = (document) => prepareExport(document, {}, false).coverage;

{
  const source = doc([sales([['Ada', 'A-1', 2], ['Ada', 'A-1', 3]], ['2026-08-31:A-1', '2026-08-31:A-1'], [{ start: 0, end: 1 }])]);
  const coverage = coverageFor(source);
  const result = prepareExport(source, coverage, true);
  assert.equal(result.document.sheets[0].rows.length, 0, 'an unchanged record is absent from remaining');
  assert.equal(result.document.rows, 0, 'the projected document reports its filtered row total');
  assert.equal(result.updated, 0);
  assert.deepEqual(result.coverage, coverage, 'coverage remains complete after an empty remaining export');
}

{
  const first = doc([sales([['Ada', 'A-1', 2], ['Ada', 'A-1', 3]], ['A-1', 'A-1'], [{ start: 0, end: 1 }])]);
  const changed = doc([sales([['Ada', 'A-1', 2], ['Ada', 'A-1', 4]], ['A-1', 'A-1'], [{ start: 0, end: 1 }])]);
  const result = prepareExport(changed, coverageFor(first), true);
  assert.deepEqual(result.document.sheets[0].rows, changed.sheets[0].rows, 'a changed order retains every one of its lines');
  assert.equal(result.updated, 1, 'a changed prior record is counted once');
}

{
  const first = doc([sales([['Ada', 'A-1', 2]], ['A-1'], [{ start: 0, end: 0 }])]);
  const later = doc([sales([['Ada', 'A-1', 2], ['Bea', 'B-1', 1]], ['A-1', 'B-1'], [{ start: 0, end: 0 }, { start: 1, end: 1 }])]);
  const result = prepareExport(later, coverageFor(first), true);
  assert.deepEqual(result.document.sheets[0].rows, [['Bea', 'B-1', 1]], 'a new record remains');
  assert.equal(result.updated, 0, 'a new record is not an update');
  assert.equal(result.coverage[recordCoverageKey('Ventas por cliente', 'A-1')], coverageFor(first)[recordCoverageKey('Ventas por cliente', 'A-1')], 'overlap uses the same coverage key');
}

{
  const first = doc([sales([['Ada', 'A-1', 2]], ['A-1'], [{ start: 0, end: 0 }])]);
  const overlap = doc([sales([['Ada', 'A-1', 2], ['Bea', 'B-1', 1]], ['A-1', 'B-1'], [{ start: 0, end: 0 }, { start: 1, end: 1 }])]);
  const result = prepareExport(overlap, coverageFor(first), true);
  assert.equal(result.document.sheets[0].recordKeys[0], 'B-1', 'range overlap remembers an exported source key');
}

{
  const original = doc([sales([
    ['Ada', 'A-1', 2], ['Ada', 'A-2', 1], ['Bea', 'B-1', 5],
  ], ['A-1', 'A-2', 'B-1'], [{ start: 0, end: 1 }, { start: 2, end: 2 }])]);
  const prior = coverageFor(doc([sales([['Ada', 'A-1', 2], ['Bea', 'B-1', 5]], ['A-1', 'B-1'], [{ start: 0, end: 0 }, { start: 1, end: 1 }])]));
  const result = prepareExport(original, prior, true);
  assert.deepEqual(result.document.sheets[0].rows, [['Ada', 'A-2', 1]], 'only the new record remains');
  assert.deepEqual(result.document.sheets[0].groups, [{ start: 0, end: 0 }], 'groups rebuild from original membership, not customer names');
}

console.log('export-period: all tests passed');
