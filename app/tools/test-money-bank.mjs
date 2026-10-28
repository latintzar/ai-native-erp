import assert from 'node:assert/strict';
import { loadTypeScript } from './ts-module.mjs';

const bank = loadTypeScript('src/prototypes/cedar/money-bank-api.ts', 'money-bank-test');
const movement = {
  id: 'a'.repeat(64), source: 'prometeo', mode: 'live', date: '2026-09-09', detail: 'Customer payment', reference: 'PAY-001',
  currency: 'PEN', account_mask: '•••• 1234', debit_minor: 0, credit_minor: 3000, allocated_minor: 3000,
  unallocated_minor: 0, status: 'matched', reason: '', request_id: 'request-1', invoice_id: 'bill-1', document_id: 'sale-1',
};
const feed = { ready: true, mode: 'live', as_of: '2026-09-10T02:00:00Z', movements: [movement] };
assert.deepEqual(bank.parseBankActivity(feed), feed);
assert.deepEqual(bank.parseBankActivity({ ready: false, mode: null, as_of: null, movements: [] }).movements, []);
for (const patch of [
  { account_mask: '001122331234' }, { date: '2026-02-30' }, { allocated_minor: 1000 },
  { credit_minor: -1 }, { credit_minor: 0.1 }, { status: 'review' }, { invoice_id: null },
  { source: 'manual' }, { debit_minor: 500 }, { mode: 'sample' }, { reference: 'x'.repeat(121) },
]) assert.throws(() => bank.parseBankActivity({ ...feed, movements: [{ ...movement, ...patch }] }));
assert.throws(() => bank.parseBankActivity({ ...feed, movements: [movement, movement] }));

const rows = [movement,
  { ...movement, id: 'b'.repeat(64), date: '2026-08-26', credit_minor: 123456 },
  { ...movement, id: 'c'.repeat(64), date: '2026-09-10', credit_minor: 123456 },
  { ...movement, id: 'd'.repeat(64), currency: 'USD', credit_minor: 123456 },
  { ...movement, id: 'e'.repeat(64), mode: 'sandbox', credit_minor: 123456 },
  { ...movement, id: 'f'.repeat(64), credit_minor: 4500, allocated_minor: 0, unallocated_minor: 4500, status: 'review', request_id: null, invoice_id: null, document_id: null },
];
const history = bank.bankHistory({ ...feed, movements: rows }, 'PEN', feed.as_of);
assert.equal(history.length, 14);
assert.equal(history[0].at, '2026-08-27');
assert.equal(history.at(-1).at, '2026-09-09', 'bank read is bucketed in Peru time');
assert.equal(history.reduce((sum, point) => sum + point.amountMinor, 0), 7500, 'actual chart includes all incoming credits, with account currency, mode and date boundaries');

/* `sampleBankActivity` is gone (§247.2): a bank card with no provider draws the setup state, never a
   synthesized statement, so there is no sample to assert. */
console.log('Money bank proofs passed: strict owner DTO, conservation, masked accounts, actual date/currency/mode history.');
