import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript, loadTypeScript } from './ts-module.mjs';

const model = loadTypeScript('src/prototypes/cedar/email-model.ts', 'email-model-test');
const provider = loadTypeScript('src/prototypes/cedar/email-provider.ts', 'email-provider-standing-test');
const require = createRequire(import.meta.url);
const path = compileTypeScript('src/prototypes/cedar/sale.ts', 'email-source-test');
const { buildSales, baseDate, dayIdOf } = require(path);
const { dayForSector, nowOf } = require(join(dirname(path), 'day.js'));
const { CASTS } = require(join(dirname(path), '../../scenarios/data/cast.js'));

test('verified mailbox reads do not claim permission to send', () => {
  const standing = provider.mailboxStanding({ provider: 'gmail',
    connection: { kind: 'connected', providers: ['gmail'], canSend: false } });
  assert.equal(standing.posture, 'connected');
  assert.equal(standing.says, 'Mailbox connected. Open it to reply.');
  assert.equal(standing.door, 'mailbox');
});

for (const [scope, cast] of Object.entries(CASTS)) test(`${scope}: email examples reuse canonical commerce identities`, () => {
  const sales = buildSales(cast, dayForSector(scope));
  const examples = model.cedarEmailExamples(scope, sales);
  assert.ok(examples.length > 0);
  assert.deepEqual(examples, model.cedarEmailExamples(scope, sales));
  for (const example of examples) {
    const sale = sales.find(row => row.id === example.saleId);
    assert.equal(example.synthetic, true);
    assert.equal(example.mode, 'sample');
    assert.equal(example.customerId, sale.customer.id);
    assert.deepEqual(example.productIds, sale.lines.map(line => line.product.id));
    assert.ok(example.rows.every(row => sale.thread.includes(row)));
    assert.equal(example.at, `${dayIdOf(baseDate(cast))}T${nowOf(cast)}:00-05:00`);
  }
});

test('older thread pages and current refresh preserve chronological history without duplicates', () => {
  const message = index => ({source_ref:`src_${index}`,at:new Date(Date.UTC(2025,7,22,10,index)).toISOString(),
    body:`Message ${index}`,attachments:index===0?[{attachment_ref:'att_oldest'}]:[]});
  const first=Array.from({length:50},(_,index)=>message(59-index));
  const older=Array.from({length:11},(_,index)=>message(10-index)); // Includes the boundary twice.
  const opened=model.mergeMailboxMessages(first,older);
  assert.equal(opened.length,60);
  assert.deepEqual(opened.map(row=>row.source_ref),Array.from({length:60},(_,index)=>`src_${index}`));
  const refreshed=model.mergeMailboxMessages(opened,[message(60),{...message(59),body:'Updated current message'}]);
  assert.equal(refreshed.length,61);
  assert.equal(refreshed[0].attachments[0].attachment_ref,'att_oldest');
  assert.equal(refreshed[59].body,'Updated current message');
  assert.equal(refreshed[60].source_ref,'src_60');
});
