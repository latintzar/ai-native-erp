/* ONE VOCABULARY FOR MONEY'S STATES, measured against the model that produces them.
 *
 * «that working capital interest thing shows a weird "scheduled" thing and stuff ‚ ik what the
 *  fuck it is nbut ensure all the states etc are super consistent» — Peter, FEED-IA §247.6.
 *
 * What he saw: the repayment timeline wrote «Scheduled» on every unpaid row, INCLUDING the rows
 * inside the offer dialog, where the person has chosen no plan and no date — so a word that names
 * a commitment was printed over an offer. The same word is also Sales' own delivery state
 * (`sale.state === 'scheduled'`, money-projections), so one word named two different things in one
 * product. Beside it the plan carried two words for one state («Paid in full» on the card,
 * «Repayments complete» in the expanded panel), and the customer-credit card borrowed the
 * advance's word for money coming the other way («Upcoming repayments»).
 *
 * This suite pins the single table every Money surface now reads: `statusWordsOf`, with the
 * derivations `planStatusOf`, `installmentStatusOf`, `amountStatusOf`, `invoiceStatusOf` and
 * `mostUrgentStatus`. It is pure, so the real module runs here rather than a copy of it.
 */
import assert from 'node:assert/strict';
import { loadTypeScript } from './ts-module.mjs';

const storage = new Map();
globalThis.window = {
  addEventListener() {},
  location: { hostname: 'demo.soyrocoto.com' },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
};
globalThis.localStorage = globalThis.window.localStorage;

const {
  MONEY_STATUS_WORDS, statusWordsOf, planStatusOf, installmentStatusOf,
  amountStatusOf, invoiceStatusOf, mostUrgentStatus,
} = loadTypeScript('src/prototypes/cedar/money-model.ts', 'cedar-money-states');

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`GREEN ${name}`); };

/* 1 · THE TABLE. Nine states, nine words, and «Scheduled» is absent from all of them. */
check('the vocabulary is exactly the nine states the model supports', () => {
  assert.deepEqual(Object.keys(MONEY_STATUS_WORDS).sort(), [
    'due', 'offered', 'overdue', 'paid', 'part-paid', 'repaid', 'repaying', 'requested', 'upcoming',
  ]);
  assert.deepEqual(MONEY_STATUS_WORDS, {
    offered: 'Offered', upcoming: 'Upcoming', due: 'Due', requested: 'Payment link sent',
    overdue: 'Overdue', 'part-paid': 'Part paid', paid: 'Paid',
    repaying: 'Repaying', repaid: 'Repaid',
  });
});

check('no state in the table is called Scheduled', () => {
  assert.equal(Object.values(MONEY_STATUS_WORDS).includes('Scheduled'), false);
  assert.equal(Object.keys(MONEY_STATUS_WORDS).includes('scheduled'), false);
});

check('statusWordsOf reads the table and every state has a word', () => {
  for (const [state, word] of Object.entries(MONEY_STATUS_WORDS)) {
    assert.equal(statusWordsOf(state), word);
    assert.ok(word.length > 0);
  }
});

/* 2 · THE PLAN. Three states, and the settled one has ONE word (it used to have two). */
const plan = (count, paidCount, days) => ({
  count, paidCount,
  installments: days.map((dueAt, index) => ({ dueAt, amountMinor: 16817 - (index === 0 ? 0 : 0) })),
});
const SIX = ['2026-10-11', '2026-11-11', '2026-12-11', '2027-01-11', '2027-02-11', '2027-03-11'];

check('a workspace with no plan is Offered', () => {
  assert.equal(planStatusOf(null), 'offered');
  assert.equal(statusWordsOf(planStatusOf(null)), 'Offered');
});

check('a plan with payments left is Repaying', () => {
  assert.equal(planStatusOf(plan(6, 0, SIX)), 'repaying');
  assert.equal(planStatusOf(plan(6, 5, SIX)), 'repaying');
  assert.equal(statusWordsOf(planStatusOf(plan(6, 1, SIX))), 'Repaying');
});

check('a plan whose payments are all made is Repaid, with one word and not two', () => {
  assert.equal(planStatusOf(plan(6, 6, SIX)), 'repaid');
  assert.equal(statusWordsOf('repaid'), 'Repaid');
  assert.equal(Object.values(MONEY_STATUS_WORDS).filter((word) => word === 'Repaid').length, 1);
  assert.equal(Object.values(MONEY_STATUS_WORDS).includes('Paid in full'), false);
  assert.equal(Object.values(MONEY_STATUS_WORDS).includes('Repayments complete'), false);
});

/* 3 · THE INSTALMENT ROW — the exact row Peter read. An offer preview carries the offer's word,
   because the person has chosen neither the plan nor the date yet. */
check('every row of an offer preview reads Offered', () => {
  for (let index = 0; index < 6; index += 1) {
    assert.equal(installmentStatusOf(null, index, '2026-09-11'), 'offered');
    assert.equal(statusWordsOf(installmentStatusOf(null, index, '2026-09-11')), 'Offered');
  }
});

/* «Due» is reserved for an amount ON or after its date; a payment still ahead of its date reads
   «Upcoming», whether or not it is the next one owed (lead vocabulary decision, 11 September). */
check('an accepted plan reads Paid and Upcoming while every date is still ahead', () => {
  const accepted = plan(6, 2, SIX);
  const words = SIX.map((_, index) => installmentStatusOf(accepted, index, '2026-09-11'));
  assert.deepEqual(words, ['paid', 'paid', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  assert.deepEqual(words.map(statusWordsOf), ['Paid', 'Paid', 'Upcoming', 'Upcoming', 'Upcoming', 'Upcoming']);
});

check('the next payment turns Due on its own date, and the rows behind it stay Upcoming', () => {
  const accepted = plan(6, 2, SIX);
  const words = SIX.map((_, index) => installmentStatusOf(accepted, index, '2026-12-11'));
  assert.deepEqual(words, ['paid', 'paid', 'due', 'upcoming', 'upcoming', 'upcoming']);
});

check('the next payment goes Overdue once its own date has passed', () => {
  const accepted = plan(6, 2, SIX);
  assert.equal(installmentStatusOf(accepted, 2, '2026-12-25'), 'overdue');
  assert.equal(installmentStatusOf(accepted, 2, '2026-12-11'), 'due');
  assert.equal(installmentStatusOf(accepted, 5, '2026-12-25'), 'upcoming');
  assert.equal(installmentStatusOf(accepted, 1, '2026-12-25'), 'paid');
});

check('a row beyond the plan falls back to the offer word rather than inventing one', () => {
  assert.equal(installmentStatusOf(plan(6, 0, SIX), 9, '2026-09-11'), 'offered');
});

/* 4 · ONE DATED AMOUNT — the derivation both an instalment and an invoice run through. */
check('a dated amount reads Paid, Overdue, Part paid, Payment link sent, Due and Upcoming', () => {
  const at = (patch) => ({ amountMinor: 10000, paidMinor: 0, dueAt: '2026-10-11', ...patch });
  assert.equal(amountStatusOf(at({ paidMinor: 10000 }), '2026-09-11', true), 'paid');
  assert.equal(amountStatusOf(at({ paidMinor: 12000 }), '2026-09-11', true), 'paid');
  assert.equal(amountStatusOf(at({}), '2026-12-01', true), 'overdue');
  assert.equal(amountStatusOf(at({ paidMinor: 4000 }), '2026-12-01', true), 'overdue');
  assert.equal(amountStatusOf(at({ paidMinor: 4000 }), '2026-09-11', true), 'part-paid');
  assert.equal(amountStatusOf(at({ requested: true }), '2026-09-11', true), 'requested');
  assert.equal(amountStatusOf(at({}), '2026-10-11', true), 'due');
  assert.equal(amountStatusOf(at({}), '2026-09-11', true), 'upcoming');
  assert.equal(amountStatusOf(at({}), '2026-09-11', false), 'upcoming');
});

check('the due date includes its whole calendar day', () => {
  assert.equal(amountStatusOf({ amountMinor: 10000, paidMinor: 0, dueAt: '2026-10-11' }, '2026-10-11', true), 'due');
  assert.equal(amountStatusOf({ amountMinor: 10000, paidMinor: 0, dueAt: '2026-10-11' }, '2026-10-12', true), 'overdue');
});

/* 5 · AN INVOICE, through the same table. The words a customer-credit row prints are the words
   the invoice surfaces print, because there is one derivation under both. */
const invoice = (patch = {}) => ({
  id: 'invoice-fish-1', number: 'F001-00000001', saleId: 'sale-1', saleNumber: 'A-1',
  customerName: 'Manolo', customerId: 'customer-1', customerRuc: '20123456789',
  sellerName: 'Drive', sellerRuc: '20123456789', sourceTotal: 100, sourceCurrency: 'PEN',
  fxRate: 1, currency: 'PEN', amountMinor: 10000, taxRate: 0, taxMinor: 0, netMinor: 10000,
  issuedAt: '2026-09-01T12:00:00.000Z', dueAt: '2026-10-11', status: 'accepted', origin: 'demo',
  lines: [{ id: 'line-1', name: 'Merluza', quantity: 1, unit: 'kg', amountMinor: 10000 }], ...patch,
});
const moneyState = (patch = {}) => ({
  version: 1, scope: 'fish', examplesLoaded: true,
  setup: { sellerName: 'Drive', ruc: '20123456789', invoiceSeries: 'F001', bank: 'bbva', bankAccountLabel: 'Account', payments: 'demo-connected', invoicing: 'demo-connected' },
  invoices: [invoice()], requests: [], receipts: [], events: [], ...patch,
});
const receipt = (amountMinor, status = 'matched') => ({
  id: 'receipt-1', invoiceId: 'invoice-fish-1', amountMinor, currency: 'PEN',
  method: 'transfer', source: 'demo-bank', reference: 'REF-1', at: '2026-09-05T12:00:00.000Z', status,
});

check('an outstanding invoice before its date is Due', () => {
  assert.equal(invoiceStatusOf(moneyState(), 'invoice-fish-1', '2026-09-11T12:00:00.000Z'), 'due');
});

check('a sent payment link reads Payment link sent rather than a second word for Due', () => {
  const state = moneyState({ requests: [{ id: 'request-1', invoiceId: 'invoice-fish-1', amountMinor: 10000, currency: 'PEN', url: 'x#/money/request/request-1', status: 'sent', createdAt: '2026-09-02T12:00:00.000Z', sentAt: '2026-09-02T12:00:00.000Z' }] });
  assert.equal(invoiceStatusOf(state, 'invoice-fish-1', '2026-09-11T12:00:00.000Z'), 'requested');
  assert.equal(statusWordsOf('requested'), 'Payment link sent');
});

check('a part-paid invoice is Part paid and a settled one is Paid', () => {
  assert.equal(invoiceStatusOf(moneyState({ receipts: [receipt(4000)] }), 'invoice-fish-1', '2026-09-11T12:00:00.000Z'), 'part-paid');
  assert.equal(invoiceStatusOf(moneyState({ receipts: [receipt(10000)] }), 'invoice-fish-1', '2026-09-11T12:00:00.000Z'), 'paid');
});

check('a receipt still under review leaves the invoice outstanding', () => {
  assert.equal(invoiceStatusOf(moneyState({ receipts: [receipt(10000, 'review')] }), 'invoice-fish-1', '2026-09-11T12:00:00.000Z'), 'due');
});

check('Overdue outranks every other word on one invoice', () => {
  assert.equal(invoiceStatusOf(moneyState(), 'invoice-fish-1', '2026-12-01T12:00:00.000Z'), 'overdue');
  assert.equal(invoiceStatusOf(moneyState({ receipts: [receipt(4000)] }), 'invoice-fish-1', '2026-12-01T12:00:00.000Z'), 'overdue');
});

check('a settled invoice stays Paid after its date', () => {
  assert.equal(invoiceStatusOf(moneyState({ receipts: [receipt(10000)] }), 'invoice-fish-1', '2026-12-01T12:00:00.000Z'), 'paid');
});

check('an unknown invoice answers with the table rather than an empty string', () => {
  assert.equal(statusWordsOf(invoiceStatusOf(moneyState(), 'invoice-missing', '2026-09-11T12:00:00.000Z')), 'Due');
});

/* 6 · A CUSTOMER ACCOUNT — many invoices, one word, the most urgent of them. */
check('a customer account takes the most urgent word of its invoices', () => {
  assert.equal(mostUrgentStatus(['due', 'overdue', 'upcoming']), 'overdue');
  assert.equal(mostUrgentStatus(['upcoming', 'due']), 'due');
  assert.equal(mostUrgentStatus(['paid', 'part-paid']), 'part-paid');
  assert.equal(mostUrgentStatus(['requested', 'upcoming']), 'requested');
  assert.equal(mostUrgentStatus([]), 'due');
});

console.log(`${checks} Cedar Money state vocabulary checks passed`);
