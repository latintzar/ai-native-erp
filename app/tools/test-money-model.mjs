import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const m = loadTypeScript('src/prototypes/cedar/money-model.ts', 'money-model-test');
const at = '2026-09-09T12:00:00.000Z';
const sale = { id: 'sale-1', number: 'DN-001', customer: { id: 'customer-1', name: 'Sample customer' }, figure: 100,
  lines: [{ id: 'line-1', product: { name: 'Tomatoes' }, given: 10, price: 10, unit: 'kg' }] };
const options = { customerRuc: '20123456789', sourceCurrency: 'EUR', fxRate: 3.9, taxRate: 18, dueAt: '2026-09-30' };
const ready = scope => ({ ...m.emptyMoney(scope), setup: { ...m.emptyMoney(scope).setup,
  sellerName: 'Sample distributor', ruc: '20123456789', payments: 'demo-connected', invoicing: 'demo-connected' } });
const ok = result => { assert.equal(result.ok, true, result.error); return result; };

assert.equal(m.issueInvoice(m.emptyMoney('fish'), sale, options, at).ok, false, 'pending setup leaves the sale unissued');
const native = ok(m.issueInvoice(ready('fish'), sale, { customerRuc: options.customerRuc, taxRate: 18, dueAt: options.dueAt }, at));
assert.equal(native.value.sourceCurrency, 'PEN');
assert.equal(native.value.fxRate, 1);
assert.equal(native.value.sourceTotal, 100);
assert.equal(native.value.amountMinor, 10000, 'new invoices retain the native PEN Delivery Note total');
const first = ok(m.issueInvoice(ready('fish'), sale, options, at));
assert.equal(first.value.amountMinor, 39000);
assert.equal(first.value.sourceTotal, 100, 'EUR source value is preserved');
assert.equal(first.value.sourceCurrency, 'EUR');
assert.equal(first.value.currency, 'PEN');
assert.equal(first.value.netMinor + first.value.taxMinor, first.value.amountMinor);
assert.equal(first.value.lines.reduce((sum, line) => sum + line.amountMinor, 0), 39000);
const changed = { ...sale, figure: 200, lines: [{ ...sale.lines[0], price: 20 }] };
const retried = ok(m.issueInvoice(first.state, changed, { ...options, fxRate: 4.5 }, at));
assert.equal(retried.state.invoices.length, 1, 'repeated issuance keeps one invoice');
assert.equal(retried.value.amountMinor, 39000, 'later source edits preserve the issued snapshot and rate');

const tiny = { ...sale, figure: 0.01, lines: Array.from({ length: 6 }, (_, index) => ({ id: `tiny-${index}`, product: { name: 'Small line' }, given: 1, price: 0.002, unit: 'unit' })) };
const rounded = ok(m.issueInvoice(ready('fish'), tiny, options, at));
assert.equal(rounded.value.lines.reduce((sum, line) => sum + line.amountMinor, 0), 4);
assert.ok(rounded.value.lines.every(line => line.amountMinor >= 0), 'rounding keeps zero-value and tiny lines nonnegative');

const created = ok(m.createRequest(first.state, first.value.id, at, 'https://example.test/app.html'));
assert.equal(created.value.status, 'created');
/* ONE DERIVATION, ONE VOCABULARY (FEED-IA §247.8). These four assertions read `invoicePaymentStatus`
   and its private words — due / sent / partial / paid — while every Money surface read
   `invoiceStatusOf` and the table in MONEY-SPEC «Money states». Two derivations of one invoice's
   state is how a row and a list disagree, so the old one is retired and these read the table. */
const copied = ok(m.recordRequestAction(created.state, created.value.id, 'copied', at));
assert.equal(m.invoiceStatusOf(copied.state, first.value.id, at), 'due', 'copying establishes neither delivery nor payment');
const sent = ok(m.recordRequestAction(copied.state, created.value.id, 'sent', at));
assert.equal(m.invoiceStatusOf(sent.state, first.value.id, at), 'requested', 'a recorded send is the payment link sent');
assert.equal(m.invoiceBalance(sent.state, first.value.id), 39000, 'sending keeps the full balance');
const input = { invoiceId: first.value.id, amountMinor: 10000, currency: 'PEN', method: 'plin', source: 'demo-bank', reference: 'BANK-1' };
const partial = ok(m.recordReceipt(sent.state, input, at));
assert.equal(m.invoiceBalance(partial.state, first.value.id), 29000);
assert.equal(m.invoiceStatusOf(partial.state, first.value.id, at), 'part-paid');
assert.equal(partial.state.invoices[0].status, 'accepted', 'tax acceptance is independent of collection');
const duplicate = ok(m.recordReceipt(partial.state, input, at));
assert.equal(duplicate.state.receipts.length, 1, 'duplicate receipt has one effect');
const crossSource = ok(m.recordReceipt(partial.state, { ...input, source: 'manual' }, at));
assert.equal(crossSource.state.receipts.length, 1, 'the same transaction entered manually and from the bank has one effect');
assert.equal(m.invoiceBalance(crossSource.state, first.value.id), 29000);
assert.equal(m.recordReceipt(partial.state, { ...input, amountMinor: 11000 }, at).ok, false, 'conflicting receipt reference stays unresolved');
assert.equal(m.recordReceipt(partial.state, { ...input, reference: 'BAD', currency: 'BOGUS' }, at).ok, false, 'invalid currency returns a failure');
assert.equal(m.recordRequestAction(partial.state, created.value.id, 'sent', at).ok, false, 'stale requested amount requires refresh');
const refreshed = ok(m.createRequest(partial.state, first.value.id, at, 'https://example.test/app.html'));
assert.equal(refreshed.value.amountMinor, 29000);
assert.equal(refreshed.value.id, created.value.id, 'a partial payment retains the canonical order link');
assert.equal(refreshed.value.url, created.value.url);
const wrongCurrency = ok(m.recordReceipt(refreshed.state, { ...input, reference: 'FX-1', currency: 'EUR' }, at));
assert.equal(wrongCurrency.value.status, 'review');
assert.equal(m.invoiceBalance(wrongCurrency.state, first.value.id), 29000);
const tooMuch = ok(m.recordReceipt(wrongCurrency.state, { ...input, reference: 'OVER-1', amountMinor: 40000 }, at));
assert.equal(tooMuch.value.status, 'review');
const paid = ok(m.recordReceipt(tooMuch.state, { ...input, source: 'manual', method: 'cash', reference: 'CASH-1', amountMinor: 29000 }, at));
assert.equal(m.invoiceBalance(paid.state, first.value.id), 0);
assert.equal(m.invoiceStatusOf(paid.state, first.value.id, at), 'paid');
assert.equal(m.createRequest(paid.state, first.value.id, at, '').ok, false);

const other = ok(m.issueInvoice(ready('meat'), sale, options, at));
const otherRequest = ok(m.createRequest(other.state, other.value.id, at, 'https://example.test/app.html'));
assert.notEqual(other.value.id, first.value.id, 'document IDs retain the scenario scope');
assert.notEqual(otherRequest.value.id, created.value.id, 'a copied link cannot resolve another scenario request with the same counter');
assert.deepEqual(m.parseMoney(JSON.parse(JSON.stringify(paid.state)), 'fish'), paid.state, 'reload retains invoices, requests, receipts and events');
const restoredNative = m.parseMoney(JSON.parse(JSON.stringify(native.state)), 'fish').invoices[0];
assert.equal(restoredNative.sourceCurrency, 'PEN');
assert.equal(restoredNative.fxRate, 1);
assert.equal(m.parseMoney({ ...native.state, invoices: [{ ...native.value, fxRate: 3.9 }] }, 'fish').invoices.length, 0, 'stored PEN invoices require their native rate');
assert.equal(m.parseMoney({ ...native.state, invoices: [{ ...native.value, sourceTotal: 99 }] }, 'fish').invoices.length, 0, 'stored PEN invoices conserve their source total');
assert.equal(m.parseMoney(paid.state, 'meat').invoices.length, 0, 'storage scope is checked');
assert.equal(m.parseMoney({ ...paid.state, requests: [null] }, 'fish').invoices.length, 0);
assert.equal(m.parseMoney({ ...paid.state, invoices: [...paid.state.invoices, paid.state.invoices[0]] }, 'fish').invoices.length, 0);
assert.equal(m.parseMoney({ ...paid.state, receipts: paid.state.receipts.map(row => ({ ...row, status: 'matched' })) }, 'fish').invoices.length, 0, 'restored mismatches cannot silently become allocations');
const verified = ok(m.recordReceipt(first.state, { ...input, source: 'prometeo', reference: 'PROVIDER-VERIFIED' }, at));
assert.equal(verified.value.source, 'prometeo');
assert.equal(m.parseMoney(JSON.parse(JSON.stringify(verified.state)), 'fish').receipts[0]?.source, 'prometeo', 'verified provider provenance survives reload');
const pendingState = { ...created.state, requests: [{ ...created.value, remotePending: true }] };
assert.equal(m.recordRequestAction(pendingState, created.value.id, 'copied', at).ok, false, 'unacknowledged service requests remain share-blocked');

console.log('Money invariants passed: immutable amounts, currencies, rounding, scoped links, partial/duplicate/mismatched receipts and reload.');

assert.equal(m.invoiceOverdueDays(first.state, first.value.id, '2026-10-01T04:59:59Z'), 0, 'invoice is due through the end of its Peru calendar date');
assert.equal(m.invoiceOverdueDays(first.state, first.value.id, '2026-10-01T05:00:00Z'), 1, 'Peru midnight marks the first overdue day');
assert.equal(m.invoiceOverdueDays(partial.state, first.value.id, '2026-10-03T12:00:00Z'), 3, 'partial balances stay overdue');
assert.equal(m.invoiceOverdueDays(paid.state, first.value.id, '2026-10-03T12:00:00Z'), 0, 'settlement removes the overdue condition');
console.log('Overdue payment calendar and settlement passed.');

/* THE PAYMENT REFERENCE IS THE ORDER'S OWN NUMBER (FEED-IA §252).
 *
 * «WHy is the immudable reference CEDAR0named??? it's a payment for an order. lol.»
 *                                                              — Peter, 14 September 2026
 *
 * One builder, three documents: an issued invoice answers with its own number, a billing draft
 * answers with the Delivery Note's number while `invoice.number` still holds the internal `PAY-`
 * placeholder, and the same draft answers with the fiscal number the moment SUNAT accepts it. */
assert.equal(m.paymentReference(first.value), first.value.number, 'an issued invoice pays under its own number');
assert.match(m.paymentReference(first.value), /^F001-\d{8}$/, 'the issued number is the series and its counter');
const draftState = { ...ready('fish'), setup: { ...ready('fish').setup, invoiceSeries: 'F001' } };
const draft = ok(m.createBillingDraft(draftState, sale, { customerRuc: options.customerRuc, customerAddress: 'Av. Peru 123, Lima', taxRate: 18, dueAt: '2027-09-30' }, at));
assert.match(draft.value.number, /^PAY-\d{8}$/, 'a billing draft carries an internal placeholder number');
assert.equal(m.paymentReference(draft.value), sale.number, 'a billing draft pays under its Delivery Note number');
assert.equal(m.paymentReference(draft.value), 'DN-001');
const accepted = { ...draft.value, fiscal: { phase: 'accepted', mode: 'sandbox', record_id: 'r-1', series: 'F001', number: 123 } };
assert.equal(m.paymentReference(accepted), 'F001-00000123', 'an accepted document pays under its fiscal number');
assert.equal(m.documentNumber(accepted), m.paymentReference(accepted), 'the reference is the number a person reads');
for (const invoice of [first.value, native.value, draft.value, accepted]) {
  assert.ok(!m.paymentReference(invoice).startsWith('PAY-'), 'no reference is an internal placeholder');
  assert.ok(!m.paymentReference(invoice).startsWith('CEDAR-'), 'no reference is a codename');
  assert.ok(m.paymentReference(invoice).length > 0 && m.paymentReference(invoice).length <= 120);
}
console.log('Payment reference passed: the issued number, the Delivery Note number, the fiscal number.');

const quotedReceipt = ok(m.recordReceipt(native.state, { invoiceId: native.value.id, amountMinor: 10003,
  roundingMinor: 3, currency: 'PEN', method: 'yape', source: 'prometeo', reference: 'ROUNDED-QUOTE' }, at));
assert.equal(quotedReceipt.value.status, 'matched', 'exact quoted cash settles only the invoice principal');
assert.equal(quotedReceipt.value.amountMinor, 10003);
assert.equal(m.receiptPrincipal(quotedReceipt.value), 10000);
assert.equal(m.invoiceBalance(quotedReceipt.state, native.value.id), 0);
assert.equal(m.parseMoney(JSON.parse(JSON.stringify(quotedReceipt.state)), 'fish').receipts[0].roundingMinor, 3);
for (const roundingMinor of [-1, 1.5, 100, 10003]) {
  assert.equal(m.recordReceipt(native.state, { ...quotedReceipt.value, reference: 'BAD-ROUNDING', roundingMinor }, at).ok, false);
  assert.equal(m.parseMoney({ ...quotedReceipt.state, receipts: [{ ...quotedReceipt.value, roundingMinor }] }, 'fish').invoices.length, 0);
}
assert.equal(m.recordReceipt(quotedReceipt.state, { ...quotedReceipt.value, roundingMinor: 2 }, at).ok, false, 'duplicate references preserve their principal allocation');
console.log('Unique amount passed: actual receipt, separate rounding, conserved principal and validated reload.');
const sampleAt = '2026-09-15T14:45:00.000Z';
const currentAt = '2026-12-10T14:00:00.000Z';
const order = (id, extra = {}) => ({ ...native.value, id, customerId: `customer-${id}`, customerName: id,
  dueAt: '2026-09-15', ...extra });
const received = (id, invoiceId, at, extra = {}) => ({ id, invoiceId, amountMinor: 1000, currency: 'PEN',
  method: 'yape', source: 'demo-bank', reference: `BANK-${id}`, at, status: 'matched', ...extra });

test('unpaid orders share collectible balances and the clock of each invoice', () => {
  const state = { ...ready('fish'), invoices: [
    order('part'), order('paid'), order('due'), order('live', { origin: 'cedar', status: 'draft' }),
    order('rejected', { status: 'rejected' }), order('foreign', { currency: 'EUR' }), order('anonymous', { customerId: '' }),
  ], receipts: [received('part', 'part', sampleAt, { amountMinor: 2500 }),
    received('paid', 'paid', sampleAt, { amountMinor: 10000 }),
    received('review', 'due', sampleAt, { status: 'review' })] };
  const rows = m.unpaidOrders(state, sampleAt, currentAt);
  assert.deepEqual(rows.map(row => row.invoice.id), ['part', 'due', 'live']);
  assert.equal(rows[0].amountMinor, 7500, 'a matched partial receipt reduces the shared balance');
  assert.equal(rows[0].status, 'part-paid');
  assert.equal(rows[1].amountMinor, 10000, 'review evidence leaves the balance standing');
  assert.equal(rows[1].status, 'due', 'demo invoices use the sample day');
  assert.equal(rows[1].overdueDays, 0);
  assert.equal(rows[2].status, 'overdue', 'prepared documents use the actual day');
  assert.equal(rows[2].overdueDays, 86);
});

test('the three urgent orders follow earliest deadline with stable customer and invoice ties', () => {
  const invoices = [order('later', { dueAt: '2026-09-18', amountMinor: 99999 }),
    order('bravo', { dueAt: '2026-09-10', customerName: 'Bravo' }),
    order('alpha-2', { dueAt: '2026-09-10', customerName: 'Alpha' }),
    order('alpha-1', { dueAt: '2026-09-10', customerName: 'Alpha' }),
    order('settled', { dueAt: '2026-09-01' })];
  const state = { ...ready('fish'), invoices,
    receipts: [received('settled', 'settled', sampleAt, { amountMinor: 10000 })] };
  assert.deepEqual(m.urgentUnpaidOrders(state, sampleAt, currentAt).map(row => row.invoice.id), ['alpha-1', 'alpha-2', 'bravo']);
  assert.deepEqual(m.urgentUnpaidOrders({ ...state, invoices: [...invoices].reverse() }, sampleAt, currentAt).map(row => row.invoice.id), ['alpha-1', 'alpha-2', 'bravo']);
  assert.equal(m.urgentUnpaidOrders(state, sampleAt, currentAt, 1).length, 1);
  assert.deepEqual(m.urgentUnpaidOrders(state, sampleAt, currentAt, 0), []);
  assert.equal(invoices[0].id, 'later', 'sorting preserves ledger order');
});

test('Paid lists matched receipts across 30 Peru days and keeps partial payments with their documents', () => {
  const invoice = order('sample');
  const live = order('live', { origin: 'cedar', status: 'draft' });
  const state = { ...ready('fish'), invoices: [invoice, live], receipts: [
    received('first-day', invoice.id, '2026-08-17T05:00:00.000Z', { method: 'plin' }),
    received('old', invoice.id, '2026-08-17T04:59:59.999Z'),
    received('today-b', invoice.id, '2026-09-15T23:00:00.000Z', { method: 'cash', source: 'manual' }),
    received('today-a', invoice.id, '2026-09-15T23:00:00.000Z', { method: 'transfer' }),
    received('tomorrow', invoice.id, '2026-09-16T05:00:00.000Z'),
    received('review', invoice.id, sampleAt, { status: 'review' }),
    received('foreign', invoice.id, sampleAt, { currency: 'EUR' }),
    received('orphan', 'missing', sampleAt),
    received('invalid', invoice.id, 'invalid'),
    received('zero', invoice.id, sampleAt, { amountMinor: 0 }),
    received('fraction', invoice.id, sampleAt, { amountMinor: 0.5 }),
    received('live', live.id, currentAt),
    received('live-old', live.id, sampleAt),
  ] };
  const rows = m.last30DaysReceipts(state, sampleAt, currentAt);
  assert.deepEqual(rows.map(row => row.receipt.id), ['live', 'today-a', 'today-b', 'first-day']);
  assert.equal(rows[1].invoice, invoice, 'each receipt retains its invoice and customer identity');
  assert.equal(rows[1].receipt, state.receipts[3], 'method, reference, provenance and exact timestamp remain intact');
  assert.ok(m.invoiceBalance({ ...state, receipts: rows.map(row => row.receipt) }, invoice.id) > 0,
    'actual partial payments appear while their remaining balance stays in unpaid orders');
  assert.equal(rows[2].receipt.at, '2026-09-15T23:00:00.000Z', 'a receipt later today than the sample hour remains visible');
  assert.deepEqual(m.last30DaysReceipts({ ...state, invoices: [invoice] }, 'invalid', currentAt), []);
  assert.deepEqual(m.last30DaysReceipts({ ...state, invoices: [live] }, sampleAt, 'invalid'), []);
});

test('receipt chase time preserves arrival evidence separately from the sample ledger and bank booking', () => {
  const arrivedAt = '2026-09-15T19:00:00.000Z';
  const saved = ok(m.recordReceipt(first.state, { ...input, receivedAt: arrivedAt }, at));
  assert.equal(m.receiptEffectiveAt(saved.value), arrivedAt, 'a sample receipt links reminders using its actual arrival');
  assert.equal(saved.value.at, at, 'the sample ledger retains its recorded instant');
  assert.equal(m.receiptEffectiveAt({ ...saved.value, source: 'manual' }), arrivedAt);
  assert.equal(m.receiptEffectiveAt({ ...saved.value, source: 'prometeo' }), at, 'verified bank evidence uses its actual bank booking');
  assert.equal(m.receiptEffectiveAt(partial.value), at, 'legacy and seeded receipts keep their original time');
  assert.deepEqual(m.parseMoney(JSON.parse(JSON.stringify(saved.state)), 'fish'), saved.state);
  const replayed = ok(m.recordReceipt(saved.state, { ...input, receivedAt: '2026-09-16T19:00:00.000Z' }, at));
  assert.equal(replayed.value.receivedAt, arrivedAt, 'a retry retains the first receipt arrival');
  const legacyReplay = ok(m.recordReceipt(partial.state, { ...input, receivedAt: arrivedAt }, at));
  assert.equal(legacyReplay.value.receivedAt, undefined, 'opening receipts retain their legacy evidence');
  for (const receivedAt of ['invalid', null, 42]) {
    assert.equal(m.recordReceipt(first.state, { ...input, receivedAt }, at).ok, false);
    const broken = { ...saved.state, receipts: [{ ...saved.value, receivedAt }] };
    assert.equal(m.parseMoney(broken, 'fish').receipts.length, 0, 'stored arrival evidence requires a valid timestamp');
  }
});

test('a retained sample request paid today enters Paid on its actual receipt day', () => {
  const invoice=order('retained');
  const arrival=received('arrived',invoice.id,'2026-08-01T14:45:01.000Z',{receivedAt:currentAt});
  const bank=received('bank',invoice.id,'2026-12-09T18:00:00.000Z',{source:'prometeo',receivedAt:'2026-12-10T19:00:00.000Z'});
  const state={...ready('fish'),invoices:[invoice],receipts:[bank,arrival]};
  assert.deepEqual(m.last30DaysReceipts(state,sampleAt,currentAt).map(row=>row.receipt.id),['arrived','bank'],
    'receipt arrival and bank booking both stand on the actual clock');
  assert.deepEqual(m.last30DaysReceipts(state,sampleAt,'2026-12-11T14:00:00.000Z').map(row=>row.receipt.id),['arrived','bank']);
  assert.deepEqual(m.last30DaysReceipts(state,sampleAt,'2027-01-08T14:00:00.000Z').map(row=>row.receipt.id),['arrived'],
    'the thirtieth Peru day keeps the arrival');
  assert.deepEqual(m.last30DaysReceipts(state,sampleAt,'2027-01-09T14:00:00.000Z'),[],
    'the next day moves the arrival outside the receipt window');
  assert.equal(arrival.at,'2026-08-01T14:45:01.000Z','the sample ledger instant remains immutable');
});
