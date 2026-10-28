import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frozenRetirementKeys, retirementKey } from './frozen-english-retirements.mjs';

const old = { file: 'es-core.json', source: 'src/prototypes/cedar/example.tsx', context: 'review', kind: 'literal', english: 'Old heading' };
const second = { ...old, english: 'Another heading' };
const retired = { ...old, sourceRevision: 'a'.repeat(40), reason: 'Founder retired this English heading; Spanish snapshot remains frozen.' };
const manifest = (entries) => ({ version: 1, entries });

test('an exact reviewed retirement leaves unrelated dead keys visible', () => {
  const keys = frozenRetirementKeys(manifest([retired]), [old, second], () => false);
  assert.deepEqual([old, second].filter(entry => !keys.has(retirementKey(entry))), [second]);
});
test('active English keys cannot be hidden by a retirement', () => {
  assert.throws(() => frozenRetirementKeys(manifest([retired]), [old], () => true), /Active English key/);
});
test('arbitrary, partial and duplicate exceptions fail', () => {
  for (const patch of [{ english: '*' }, { file: 'es-other.json' }, { source: '*' }, { context: 'another node' }, { kind: 'template' }]) {
    assert.throws(() => frozenRetirementKeys(manifest([{ ...retired, ...patch }]), [old], () => false), /Unknown frozen English key/);
  }
  assert.throws(() => frozenRetirementKeys(manifest([retired, retired]), [old], () => false), /Duplicate retirement/);
});
test('reason, full source revision and English-only schema are required', () => {
  for (const patch of [{ reason: '' }, { sourceRevision: 'main' }, { spanish: 'new words' }, { source: undefined }]) {
    assert.throws(() => frozenRetirementKeys(manifest([{ ...retired, ...patch }]), [old], () => false), /exact English key/);
  }
});
