#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { transform } from 'rolldown/experimental';
import { parse } from '@babel/parser';

const text = readFileSync(new URL('../src/prototypes/cedar/whatsapp-intake.tsx', import.meta.url), 'utf8');
const wanted = ['clock', 'digits', 'customerFor', 'alreadyApplied', 'applyWhatsAppMessage'];
const ast = parse(text, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const declarations = [];
for (const statement of ast.program.body) {
  const row = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
  if (!row) continue;
  if (row.type === 'FunctionDeclaration' && wanted.includes(row.id?.name)) {
    declarations.push(text.slice(row.start, row.end));
  }
  if (row.type === 'VariableDeclaration') {
    const names = row.declarations.map(item => item.id.type === 'Identifier' ? item.id.name : '');
    if (names.some(name => wanted.includes(name))) declarations.push(text.slice(row.start, row.end));
  }
}
const { code, errors } = await transform('whatsapp-intake-cancellation.ts', declarations.join('\n'));
assert.equal(errors?.length ?? 0, 0, String(errors));

let stored = { events: [] };
let writes = 0;
const dayForSector = () => stored;
const setDayForSector = (_sector, patch) => {
  writes += 1;
  stored = { ...stored, ...patch(stored) };
  return stored;
};
const readSourceOrder = () => { throw new Error('test must inject a reader'); };
const factory = new Function(
  'dayForSector', 'setDayForSector', 'readSourceOrder',
  `${code.replace(/^export\s+/gm, '')}\nreturn { applyWhatsAppMessage };`,
);
const { applyWhatsAppMessage } = factory(dayForSector, setDayForSector, readSourceOrder);

const message = {
  id: 'wamid.slow', conversationId: 'conversation', name: 'Customer', number: '+15550000002',
  timestamp: '2026-09-10T12:00:00Z', text: '12 kg merluza', historical: false,
};
const world = { cast: {
  sector: 'fish', customers: [{ id: 'customer', name: 'Customer', phone: '+15550000002' }],
} };

test('a disconnect during a slow model read cannot write a source event', async () => {
  const controller = new AbortController();
  let finish;
  const read = () => new Promise(resolve => { finish = resolve; });
  const pending = applyWhatsAppMessage(message, world, {
    signal: controller.signal, current: () => !controller.signal.aborted, read,
  });
  controller.abort();
  finish({
    isOrder: true, needsReply: true, deliveryDay: null,
    lines: [{ product: 'merluza', word: 'merluza', qty: 12, unit: 'kg' }],
    intelligence: { mode: 'model', model: 'synthetic-model' },
  });
  assert.equal(await pending, false);
  assert.equal(writes, 0);
  assert.deepEqual(stored.events, []);
});

test('an already durable provider event skips the billed reader', async () => {
  stored = { events: [{ kind: 'source-arrive', channel: 'whatsapp', sourceEvent: message.id }] };
  let reads = 0;
  assert.equal(await applyWhatsAppMessage(message, world, { read: async () => { reads += 1; } }), true);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test('a live non-order is retained once as a conversation receipt without forcing a reply', async () => {
  stored = { events: [] };
  writes = 0;
  let reads = 0;
  const read = async () => {
    reads += 1;
    return { isOrder: false, needsReply: false, deliveryDay: null, lines: [],
      intelligence: { mode: 'heuristic' } };
  };
  assert.equal(await applyWhatsAppMessage(message, world, { read }), true);
  assert.equal(stored.events.length, 1);
  assert.equal(stored.events[0].occurredAt, message.timestamp);
  assert.equal(stored.events[0].needsReply, undefined);
  assert.equal(await applyWhatsAppMessage(message, world, { read }), true);
  assert.equal(reads, 1);
  assert.equal(writes, 1);
});
