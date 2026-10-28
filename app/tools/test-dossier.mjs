/* THE LENDER DOSSIER — EVERY FIGURE IS A READING OF THE WORKSPACE'S OWN RECORDS (FEED-IA §249).
 *
 * «a dossier is a dossier. it's underlated to an action/loan.»              — Peter, 14 September
 *
 * Two books, because one proves the arithmetic and the other proves it agrees with the ledger.
 *
 *   SYNTHETIC   a hand-built ledger and book whose every answer is written out here: the window,
 *               the balance series, the success rate, the weeks, the customer shares, the weekday
 *               seasonality and the price ranges. Each expected number is derivable by hand from
 *               the rows above it, so a change to the derivation is a change this file names.
 *
 *   SEEDED      the real Cedar book of all three casts, where nothing is hard-coded and every
 *               total is RECONCILED against `money-model` and `money-projections` themselves:
 *               the closing balance against `projectMoney`, the invoiced total and the overdue
 *               figures against `invoiceBalance` / `invoiceOverdueDays`, the order book against
 *               the sales the Money area passes.
 *
 * The share log and the words a figure takes are held here too, because a log that parses a
 * damaged record as half a record, or a window that reads «12 – 14 Sep» across two months, is the
 * document lying about itself.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript, loadTypeScript } from './ts-module.mjs';

const dossier = loadTypeScript('src/prototypes/cedar/dossier.ts', 'dossier-test');
const model = loadTypeScript('src/prototypes/cedar/money-model.ts', 'dossier-model-test');
const seed = loadTypeScript('src/prototypes/cedar/money-seed.ts', 'dossier-seed-test');
const projections = loadTypeScript('src/prototypes/cedar/money-projections.ts', 'dossier-projections-test');
const require = createRequire(import.meta.url);
const salePath = compileTypeScript('src/prototypes/cedar/sale.ts', 'dossier-sale-test');
const castPath = compileTypeScript('src/prototypes/cedar/cedar-cast.ts', 'dossier-cast-test');
const { buildSales } = require(salePath);
const { cedarCast } = require(castPath);
const { dayForSector } = require(join(dirname(salePath), 'day.js'));
const { CASTS } = require(join(dirname(salePath), '../../scenarios/data/cast.js'));

const {
  DOSSIER_ACCOUNT_PENDING, DOSSIER_SHARE_LIMIT, dayWords, dossierFileName, dossierKey, dossierOf,
  dossierWindowWords, emptyDossierLog, isoWeekOf, lastShareAt, parseDossierLog, preparedWords,
  recordShare, shareWords, sharedWords, sharesOf, spanDays,
} = dossier;

/* ── 1 · THE SYNTHETIC BOOK, WRITTEN OUT ──────────────────────────────────────────────────── */

const invoice = (id, customerId, name, issuedAt, dueAt, amountMinor) => ({
  id, number: id, saleId: `s-${id}`, saleNumber: `s-${id}`, customerName: name, customerId,
  customerRuc: '20123456789', sellerName: 'Casa Prueba', sellerRuc: '20123456789',
  sourceTotal: amountMinor / 100, sourceCurrency: 'PEN', fxRate: 1, currency: 'PEN', amountMinor,
  taxRate: 18, taxMinor: 0, netMinor: amountMinor, issuedAt, dueAt,
  status: 'accepted', origin: 'demo', lines: [],
});

const receipt = (id, invoiceId, amountMinor, at) => ({
  id, invoiceId, amountMinor, currency: 'PEN', method: 'yape', source: 'demo-bank',
  reference: `REF-${id}`, at, status: 'matched',
});

const sale = (id, day, figure, customerId, name, lines, state = 'delivered', extra = {}) => ({
  id, day, figure, customer: { id: customerId, name }, state,
  lines: lines.map((line, index) => ({ id: `${id}-${index}`, product: { name: line[0] }, given: line[1], unit: 'kg', price: line[2] })),
  ...extra,
});

const SYNTHETIC_STATE = {
  version: 1, scope: 'test', examplesLoaded: true,
  setup: { sellerName: 'Casa Prueba', ruc: '20123456789', invoiceSeries: 'F001', bank: 'bbva', bankAccountLabel: '', payments: 'pending', invoicing: 'pending' },
  invoices: [
    invoice('INV-1', 'c1', 'Uno', '2026-03-01T15:00:00Z', '2026-03-05', 100_000),
    invoice('INV-2', 'c2', 'Dos', '2026-03-05T15:00:00Z', '2026-03-08', 200_000),
    invoice('INV-3', 'c1', 'Uno', '2026-03-06T15:00:00Z', '2026-03-20', 50_000),
  ],
  requests: [
    { id: 'r1', invoiceId: 'INV-1', amountMinor: 100_000, currency: 'PEN', url: '', status: 'sent', createdAt: '2026-03-01T15:00:00Z', sentAt: '2026-03-01T15:00:00Z' },
    { id: 'r2', invoiceId: 'INV-2', amountMinor: 200_000, currency: 'PEN', url: '', status: 'sent', createdAt: '2026-03-05T15:00:00Z', sentAt: '2026-03-05T15:00:00Z' },
    { id: 'r3', invoiceId: 'INV-3', amountMinor: 50_000, currency: 'PEN', url: '', status: 'created', createdAt: '2026-03-06T15:00:00Z' },
  ],
  receipts: [
    receipt('p1', 'INV-1', 100_000, '2026-03-03T15:00:00Z'),
    receipt('p2', 'INV-3', 20_000, '2026-03-09T15:00:00Z'),
    /* Cash settles an invoice in its own ledger and changes no bank account, exactly as
       `projectMoney` already holds — so it stands outside Money in and the balance series. */
    { ...receipt('p3', 'INV-3', 1_000, '2026-03-09T16:00:00Z'), method: 'cash', source: 'manual' },
  ],
  events: [],
};

const SYNTHETIC_SALES = [
  sale('s1', '2026-03-02', 100, 'c1', 'Uno', [['Alpha', 2, 10], ['Beta', 1, 80]]),
  sale('s2', '2026-03-03', 400, 'c2', 'Dos', [['Alpha', 10, 12], ['Beta', 2, 140]]),
  sale('s3', '2026-03-09', 200, 'c1', 'Uno', [['Alpha', 5, 10], ['Gamma', 3, 50]]),
  sale('s4', '2026-03-09', 50, 'c3', 'Tres', [['Gamma', 1, 50]], 'disputed'),
  sale('s5', '2026-03-09', 900, 'c4', 'Cuatro', [['Alpha', 1, 900]], 'delivered', { messageOnly: true }),
  sale('s6', '2026-03-09', 900, 'c5', 'Cinco', [['Alpha', 1, 900]], 'delivered', { archived: true }),
  { id: 's7', day: '2026-03-09', figure: 900, customer: { id: 'c6', name: 'Seis' }, state: 'made', lines: [] },
];

const SYNTHETIC = () => dossierOf({
  scope: 'test',
  preparedAt: '2026-03-10T12:00:00Z',
  openingBalanceMinor: 500_000,
  state: SYNTHETIC_STATE,
  sales: SYNTHETIC_SALES,
  identity: { legalName: 'Casa Prueba', ruc: '20123456789', address: 'Av. Prueba 1, Lima', owner: 'Peter', receivingAccount: '' },
  consents: [
    { kind: 'share', at: '2026-03-10T14:00:00Z' },
    { kind: 'bank-access', at: '2026-02-20T09:00:00Z' },
    { kind: 'auto-repayment', at: '2026-03-04T11:30:00Z' },
    { kind: 'share', at: 'the day before yesterday' },
  ],
});

test('synthetic · the head names the workspace and the day the ledger stands on', () => {
  const answer = SYNTHETIC();
  assert.equal(answer.scope, 'test');
  assert.equal(answer.preparedDay, '2026-03-10');
  assert.equal(answer.identity.legalName, 'Casa Prueba');
  /* A workspace whose bank is still ahead of it states the act rather than an empty line. */
  assert.equal(answer.identity.receivingAccount, DOSSIER_ACCOUNT_PENDING);
});

test('synthetic · movements read the window that exists, and the balance the days that do', () => {
  const { movements } = SYNTHETIC();
  // The earliest record in the ledger is INV-1, issued on 1 March in Lima; the day is the prepared one.
  assert.deepEqual(movements.window, { from: '2025-12-11', to: '2026-03-10', days: 90 });
  // Two bank receipts; the cash receipt settles its invoice and changes no account.
  assert.equal(movements.inflowMinor, 120_000);
  assert.equal(movements.inflowCount, 2);
  assert.equal(movements.issuedMinor, 350_000);
  assert.equal(movements.issuedCount, 3);
  // The balance series starts at the first bank movement: 3 → 10 March, eight days.
  assert.deepEqual(movements.balanceWindow, { from: '2025-12-11', to: '2026-03-10', days: 90 });
  // 600 000 on 3–8 March, 620 000 on 9–10 March → 4 840 000 ÷ 8.
  assert.equal(movements.averageDailyBalanceMinor, Math.round((82 * 500_000 + 6 * 600_000 + 2 * 620_000) / 90));
  assert.equal(movements.closingBalanceMinor, 620_000);
});

test('synthetic · collections count what was asked for and what arrived', () => {
  const { collections } = SYNTHETIC();
  assert.equal(collections.requestsSent, 2);
  assert.equal(collections.paid, 1);
  assert.equal(collections.paidMinor, 100_000);
  assert.equal(collections.successBasisPoints, 5_000);
  // INV-1 issued 1 March, settled 3 March.
  assert.equal(collections.averageDaysToPay, 2);
});

test('synthetic · the order book counts orders, and a message or an archived draft is neither', () => {
  const { orderBook } = SYNTHETIC();
  assert.equal(orderBook.orders, 4);
  assert.equal(orderBook.valueMinor, 75_000);
  assert.deepEqual(orderBook.window, { from: '2026-03-02', to: '2026-03-09', days: 8 });
  assert.equal(orderBook.averageTicketMinor, 18_750);
  // Four orders across eight days is three and a half a week, and the figure states the whole one.
  assert.equal(orderBook.ordersPerWeek, 4);
  // Three delivery days in eight: 2.6 a week.
  assert.equal(orderBook.deliveryDaysPerWeek, 2.6);
  assert.deepEqual(orderBook.weeks, [
    { week: '2026-W10', orders: 2, delivered: 2, valueMinor: 50_000, days: 2 },
    { week: '2026-W11', orders: 2, delivered: 1, valueMinor: 25_000, days: 1 },
  ]);
  assert.deepEqual(orderBook.topCustomers, [
    { customerId: 'c2', name: 'Dos', orders: 1, valueMinor: 40_000, shareBasisPoints: 5_333 },
    { customerId: 'c1', name: 'Uno', orders: 2, valueMinor: 30_000, shareBasisPoints: 4_000 },
    { customerId: 'c3', name: 'Tres', orders: 1, valueMinor: 5_000, shareBasisPoints: 667 },
  ]);
});

test('synthetic · risk signals read lateness, disputes, seasonality and the price range', () => {
  const { risk } = SYNTHETIC();
  // INV-2 was due 8 March and the document stands on the 10th; INV-3 is due on the 20th.
  assert.deepEqual(risk.overdue, { count: 1, amountMinor: 200_000, averageDaysLate: 2 });
  assert.deepEqual(risk.disputed, { count: 1, shareBasisPoints: 2_500 });
  assert.deepEqual(risk.weekdays.map(row => row.orders), [3, 1, 0, 0, 0, 0, 0]);
  assert.deepEqual(risk.weekdays.map(row => row.shareBasisPoints), [7_500, 2_500, 0, 0, 0, 0, 0]);
  assert.equal(risk.weekdays[0].name, 'Monday');
  assert.equal(risk.weekdays[6].name, 'Sunday');
  // The three products the book turns the most value on, each with the prices its lines carried.
  assert.deepEqual(risk.prices, [
    { product: 'Beta', lines: 2, minMinor: 8_000, maxMinor: 14_000, averageMinor: 12_000, steady: false },
    { product: 'Gamma', lines: 2, minMinor: 5_000, maxMinor: 5_000, averageMinor: 5_000, steady: true },
    { product: 'Alpha', lines: 3, minMinor: 1_000, maxMinor: 1_200, averageMinor: 1_118, steady: false },
  ]);
});

test('synthetic · the consent log is ordered, and a damaged instant stands outside it', () => {
  const { consents } = SYNTHETIC();
  assert.deepEqual(consents, [
    { kind: 'bank-access', at: '2026-02-20T09:00:00.000Z' },
    { kind: 'auto-repayment', at: '2026-03-04T11:30:00.000Z' },
    { kind: 'share', at: '2026-03-10T14:00:00.000Z' },
  ]);
});

test('synthetic · an empty workspace answers with its own day and nothing invented', () => {
  const empty = dossierOf({
    scope: 'test', preparedAt: '2026-03-10T12:00:00Z', openingBalanceMinor: 500_000,
    state: { ...SYNTHETIC_STATE, invoices: [], requests: [], receipts: [] },
    sales: [], consents: [],
    identity: { legalName: 'Casa Prueba', ruc: '20123456789', address: 'Av. Prueba 1, Lima', owner: 'Peter', receivingAccount: 'Ahorros · •••• 1234' },
  });
  assert.deepEqual(empty.movements.window, { from: '2025-12-11', to: '2026-03-10', days: 90 });
  assert.equal(empty.movements.closingBalanceMinor, 500_000);
  assert.equal(empty.movements.averageDailyBalanceMinor, 500_000);
  assert.equal(empty.collections.successBasisPoints, 0);
  assert.equal(empty.orderBook.orders, 0);
  assert.equal(empty.orderBook.ordersPerWeek, 0);
  assert.deepEqual(empty.orderBook.topCustomers, []);
  assert.deepEqual(empty.risk.prices, []);
  assert.equal(empty.risk.weekdays.reduce((sum, row) => sum + row.shareBasisPoints, 0), 0);
  assert.equal(empty.identity.receivingAccount, 'Ahorros · •••• 1234');
});

/* ── 2 · THE SEEDED BOOK, RECONCILED AGAINST THE LEDGER ITSELF ────────────────────────────── */

for (const scope of Object.keys(CASTS)) test(`${scope}: the dossier reconciles with the seeded ledger and book`, () => {
  const sales = buildSales(cedarCast(CASTS[scope]), dayForSector(scope));
  const result = seed.seedMoney(model.emptyMoney(scope), sales, 'https://example.invalid/cedar');
  assert.equal(result.ok, true, result.error);
  const state = result.state;
  const workspace = seed.moneyWorkspace(scope);
  const preparedAt = seed.moneyNow(state);
  const answer = dossierOf({
    scope, preparedAt, openingBalanceMinor: workspace.openingBalanceMinor, state, sales,
    identity: { legalName: state.setup.sellerName, ruc: state.setup.ruc, address: 'Av. Los Pescadores 385, Chorrillos, Lima, Perú', owner: 'Peter', receivingAccount: '' },
    consents: [{ kind: 'share', at: preparedAt }, { kind: 'bank-access', at: state.invoices[0].issuedAt }],
  });

  // ── movements
  assert.equal(answer.preparedDay, model.peruDate(preparedAt));
  assert.equal(answer.movements.window.to, answer.preparedDay);
  const ledger = state.invoices.filter(row => model.isCollectible(row) && row.currency === 'PEN' && model.peruDate(row.issuedAt) >= answer.movements.window.from && model.peruDate(row.issuedAt) <= answer.movements.window.to);
  assert.equal(answer.movements.issuedCount, ledger.length);
  assert.equal(answer.movements.issuedMinor, ledger.reduce((sum, row) => sum + row.amountMinor, 0));
  const bank = state.receipts.filter(row => row.status === 'matched' && row.source !== 'manual' && row.method !== 'cash' && row.currency === 'PEN' && model.peruDate(row.at) >= answer.movements.window.from && model.peruDate(row.at) <= answer.movements.window.to);
  assert.equal(answer.movements.inflowCount, bank.length);
  assert.equal(answer.movements.inflowMinor, bank.reduce((sum, row) => sum + row.amountMinor, 0));
  /* THE ONE RECONCILIATION THAT MATTERS: the balance the document closes on is the balance the
     Money dashboard shows, derived by `projectMoney` from the same receipts. */
  assert.equal(answer.movements.closingBalanceMinor, projections.projectMoney(state, sales).bankBalanceMinor);
  assert.ok(answer.movements.averageDailyBalanceMinor >= workspace.openingBalanceMinor);
  assert.ok(answer.movements.averageDailyBalanceMinor <= answer.movements.closingBalanceMinor);
  assert.equal(answer.movements.balanceWindow.to, answer.preparedDay);
  assert.ok(answer.movements.balanceWindow.days <= answer.movements.window.days);

  // ── collections
  const settled = state.invoices.filter(row => model.isCollectible(row) && row.currency === 'PEN' && model.invoiceBalance(state, row.id) <= 0);
  assert.equal(answer.collections.paid, settled.length);
  assert.equal(answer.collections.requestsSent, new Set(state.requests.filter(row => row.sentAt).map(row => row.invoiceId)).size);
  assert.equal(answer.collections.successBasisPoints, Math.round(settled.length * 10_000 / answer.collections.requestsSent));
  assert.ok(answer.collections.averageDaysToPay >= 0);

  // ── order book
  const historicalFrom = new Date(Date.parse(answer.preparedDay + 'T12:00:00Z') - 89 * 86400000).toISOString().slice(0, 10);
  const counted = sales.filter(row => !row.messageOnly && !row.archived && row.customer?.id && row.lines.length
    && row.day >= historicalFrom && row.day <= answer.preparedDay);
  assert.ok(counted.length < sales.filter(row => !row.messageOnly && !row.archived && row.customer?.id && row.lines.length).length, 'upcoming orders remain outside the historic dossier');
  assert.equal(answer.orderBook.orders, counted.length);
  const byCustomer = new Map();
  for (const order of counted) byCustomer.set(order.customer.id, (byCustomer.get(order.customer.id) ?? 0) + 1);
  assert.equal(answer.operating.customers, byCustomer.size);
  assert.equal(answer.operating.repeatCustomers, [...byCustomer.values()].filter(count => count > 1).length);
  assert.equal(answer.operating.orderLines, counted.reduce((sum, order) => sum + order.lines.length, 0));
  assert.equal(answer.operating.deliveredOrders, counted.filter(order => order.state === 'delivered' || order.state === 'settled').length);
  assert.equal(answer.operating.deliveryDays, new Set(counted.filter(order => order.state === 'delivered' || order.state === 'settled').map(order => order.day)).size);

  assert.equal(answer.orderBook.valueMinor, counted.reduce((sum, row) => sum + Math.round(row.figure * 100), 0));
  assert.equal(answer.orderBook.averageTicketMinor, Math.round(answer.orderBook.valueMinor / counted.length));
  assert.equal(answer.orderBook.topCustomers.length, 5);
  for (let index = 1; index < answer.orderBook.topCustomers.length; index += 1) {
    assert.ok(answer.orderBook.topCustomers[index - 1].valueMinor >= answer.orderBook.topCustomers[index].valueMinor,
      'the top customers stand in order of what they buy');
  }
  const topShare = answer.orderBook.topCustomers.reduce((sum, row) => sum + row.shareBasisPoints, 0);
  assert.ok(topShare > 0 && topShare <= 10_000, `five customers hold a share of the book · ${topShare}`);
  assert.ok(answer.orderBook.deliveryDaysPerWeek > 0 && answer.orderBook.deliveryDaysPerWeek <= 7);
  assert.equal(answer.orderBook.weeks.reduce((sum, row) => sum + row.orders, 0), counted.length);
  assert.ok(answer.orderBook.weeks.every(row => row.week === isoWeekOf(`${row.week.slice(0, 4)}-01-04`) || /^\d{4}-W\d{2}$/.test(row.week)));

  // ── risk
  const late = ledger.filter(row => model.invoiceOverdueDays(state, row.id, preparedAt) > 0);
  assert.equal(answer.risk.overdue.count, late.length);
  assert.equal(answer.risk.overdue.amountMinor, late.reduce((sum, row) => sum + model.invoiceBalance(state, row.id), 0));
  assert.equal(answer.risk.disputed.count, counted.filter(row => row.state === 'disputed').length);
  assert.equal(answer.risk.weekdays.length, 7);
  assert.equal(answer.risk.weekdays.reduce((sum, row) => sum + row.orders, 0), counted.length);
  assert.equal(answer.risk.weekdays.reduce((sum, row) => sum + row.shareBasisPoints, 0), 10_000,
    'the seasonality table adds up to one hundred per cent');
  assert.equal(answer.risk.prices.length, 3);
  for (const row of answer.risk.prices) {
    assert.ok(row.minMinor <= row.averageMinor && row.averageMinor <= row.maxMinor, `${row.product} · the average stands inside its range`);
    assert.equal(row.steady, row.minMinor === row.maxMinor);
    assert.ok(row.lines > 0);
  }

  // ── consents, in the order they happened
  assert.deepEqual(answer.consents.map(row => row.kind), ['bank-access', 'share']);
});

/* ── 3 · THE SHARE LOG ────────────────────────────────────────────────────────────────────── */

test('the share log parses defensively and keeps its shares in order', () => {
  assert.equal(dossierKey('fish'), 'rocoto-cedar-dossier-v1:fish');
  assert.deepEqual(parseDossierLog(null, 'fish'), emptyDossierLog('fish'));
  assert.deepEqual(parseDossierLog({ version: 2, scope: 'fish', shares: [] }, 'fish'), emptyDossierLog('fish'));
  assert.deepEqual(parseDossierLog({ version: 1, scope: 'meat', shares: [] }, 'fish'), emptyDossierLog('fish'));
  // A damaged row makes the whole log unreadable rather than half a record.
  assert.deepEqual(parseDossierLog({ version: 1, scope: 'fish', shares: [{ at: 'soon' }] }, 'fish'), emptyDossierLog('fish'));
  const stored = parseDossierLog({ version: 1, scope: 'fish', shares: [{ at: '2026-09-14T14:45:00Z' }, { at: '2026-09-12T10:00:00Z' }] }, 'fish');
  assert.deepEqual(stored.shares.map(row => row.at), ['2026-09-12T10:00:00.000Z', '2026-09-14T14:45:00.000Z']);
  assert.equal(lastShareAt(stored), '2026-09-14T14:45:00.000Z');
  assert.equal(lastShareAt(emptyDossierLog('fish')), null);
});

test('a share joins the log, and the log keeps its last fifty', () => {
  let log = emptyDossierLog('fish');
  log = recordShare(log, '2026-09-14T14:45:00Z');
  log = recordShare(log, '2026-09-14T15:45:00Z');
  assert.deepEqual(log.shares.map(row => row.at), ['2026-09-14T14:45:00.000Z', '2026-09-14T15:45:00.000Z']);
  assert.equal(recordShare(log, 'later').shares.length, 2, 'a damaged instant leaves the log as it was');
  let long = emptyDossierLog('fish');
  for (let index = 0; index < DOSSIER_SHARE_LIMIT + 10; index += 1) {
    long = recordShare(long, new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString());
  }
  assert.equal(long.shares.length, DOSSIER_SHARE_LIMIT);
  assert.equal(long.shares[0].at, new Date(Date.UTC(2026, 0, 1, 0, 10)).toISOString());
  // The stored shape survives a round trip through the browser's own JSON.
  assert.deepEqual(parseDossierLog(JSON.parse(JSON.stringify(long)), 'fish'), long);
});

/* ── 4 · THE WORDS A FIGURE TAKES ─────────────────────────────────────────────────────────── */

test('a window says both of its ends, and only the parts that differ', () => {
  assert.equal(dossierWindowWords('2026-03-02', '2026-03-09'), '2 – 9 Mar');
  assert.equal(dossierWindowWords('2026-06-12', '2026-09-14'), '12 Jun – 14 Sept');
  assert.equal(dossierWindowWords('2025-12-30', '2026-01-02'), '30 Dec 2025 – 2 Jan 2026');
  assert.equal(dossierWindowWords('2026-03-10', '2026-03-10'), '10 Mar');
  assert.equal(dossierWindowWords('', '2026-03-10'), '');
  assert.equal(spanDays('2026-03-01', '2026-03-10'), 10);
  assert.equal(spanDays('2026-03-10', '2026-03-01'), 0);
});

test('the document says when it was prepared and when it was shared, in the workspace zone', () => {
  assert.equal(preparedWords('2026-09-14'), 'Prepared 14 Sept 2026');
  assert.equal(sharedWords('2026-09-14T14:45:00Z', 'America/Lima'), 'PDF prepared 14 Sept 09:45');
  assert.equal(sharedWords('2026-09-14T14:45:00Z', 'Europe/Madrid'), 'PDF prepared 14 Sept 16:45');
  assert.equal(sharedWords(null), '');
});

test('a share is a percentage and a count of days carries its unit', () => {
  assert.equal(shareWords(5_000), '50\u00a0%');
  assert.equal(shareWords(17), '0.2\u00a0%');
  assert.equal(shareWords(0), '0\u00a0%');
  assert.equal(shareWords(10_000), '100\u00a0%');
  assert.equal(dayWords(1), '1\u00a0day');
  assert.equal(dayWords(0), '0\u00a0days');
  assert.equal(dayWords(2.5), '2.5\u00a0days');
});

test('the printed file carries the workspace and the day', () => {
  assert.equal(dossierFileName('Peix Vilalta, S.L.', '2026-09-14'), 'dossier-peix-vilalta-s-l-2026-09-14.pdf');
  assert.equal(dossierFileName('Fruités Amat', '2026-09-14'), 'dossier-fruites-amat-2026-09-14.pdf');
  assert.equal(dossierFileName('', ''), 'dossier-workspace.pdf');
});

test('shares are allocated so a table adds up to one hundred per cent', () => {
  assert.deepEqual(sharesOf([1, 1, 1]), [3_334, 3_333, 3_333]);
  assert.deepEqual(sharesOf([3, 1, 0, 0, 0, 0, 0]), [7_500, 2_500, 0, 0, 0, 0, 0]);
  assert.deepEqual(sharesOf([0, 0]), [0, 0]);
  for (const values of [[7, 11, 13, 17], [1, 2, 3, 4, 5, 6, 7], [999, 1, 1]]) {
    assert.equal(sharesOf(values).reduce((sum, value) => sum + value, 0), 10_000);
  }
});

test('gap 4 · each section carries its source and measured period', () => {
  const report = SYNTHETIC();
  assert.deepEqual(Object.keys(report.evidence), ['identity', 'movements', 'collections', 'order-book', 'risk', 'consents']);
  assert.match(report.evidence.identity.source, /business details/);
  assert.equal(report.evidence.identity.window.from, '2026-03-10');
  assert.equal(report.evidence.identity.window.to, '2026-03-10');
  assert.match(report.evidence.movements.source, /bank/);
  assert.deepEqual(report.evidence.movements.window, report.movements.window);
  assert.match(report.evidence['order-book'].source, /orders/);
  assert.deepEqual(report.evidence['order-book'].window, report.orderBook.window);
  assert.equal(report.evidence.consents.window.from, '2026-02-20');
  for (const evidence of Object.values(report.evidence)) {
    assert.ok(evidence.source.startsWith('From '));
    assert.ok(evidence.window.days >= 1);
    assert.ok(dossier.dossierSourceWords(evidence).includes(dossierWindowWords(evidence.window.from, evidence.window.to)));
  }
});

test('gap 4 · requested advance is measured against the previous calendar month', () => {
  const state = structuredClone(SYNTHETIC_STATE);
  state.receipts = [
    receipt('jan', 'INV-1', 900_000, '2026-02-01T04:59:59Z'),
    receipt('feb-first', 'INV-1', 100_000, '2026-02-01T05:00:00Z'),
    {...receipt('feb-cash', 'INV-2', 50_000, '2026-02-15T12:00:00Z'), method:'cash', source:'manual'},
    receipt('feb-last', 'INV-2', 250_000, '2026-03-01T04:59:59Z'),
    receipt('march', 'INV-3', 700_000, '2026-03-01T05:00:00Z'),
    {...receipt('review', 'INV-2', 600_000, '2026-02-15T12:00:00Z'), status:'review'},
  ];
  const report = dossierOf({scope:'test', preparedAt:'2026-03-10T12:00:00Z',
    identity:SYNTHETIC().identity, openingBalanceMinor:500_000, state, sales:SYNTHETIC_SALES,
    consents:[], requestedAdvanceMinor:100_000});
  assert.deepEqual(report.capacity, {requestedMinor:100_000, takingsMinor:400_000, ratioBasisPoints:2500,
    window:{from:'2026-02-01', to:'2026-02-28', days:28}});
});

test('gap 4 · an empty previous month keeps repayment capacity explicit', () => {
  const report = SYNTHETIC();
  assert.equal(report.capacity.takingsMinor, 0);
  assert.equal(report.capacity.ratioBasisPoints, null);
  assert.equal(dossierFileName('Peix Vilalta', '2026-09-15'), 'dossier-peix-vilalta-2026-09-15.pdf');
});


test('gap 4 · the requested amount shares the dossier log lifecycle', () => {
  const log = dossier.requestDossierAdvance(emptyDossierLog('fish'), 123456);
  assert.equal(parseDossierLog(log, 'fish').requestedAdvanceMinor, 123456);
  assert.equal(recordShare(log, '2026-09-15T12:00:00Z').requestedAdvanceMinor, 123456);
  for (const amount of [-1, 0.5, Infinity, 1_000_000_000_001])
    assert.deepEqual(dossier.requestDossierAdvance(log, amount), log);
  assert.equal(parseDossierLog({...log, requestedAdvanceMinor:-1}, 'fish').requestedAdvanceMinor, undefined);
  assert.equal(emptyDossierLog('fish').requestedAdvanceMinor, undefined);
});

test('operating evidence · recurring customers, real lines, delivery and part-payment depth', () => {
  const answer = SYNTHETIC();
  assert.deepEqual(answer.operating, {
    customers: 3, repeatCustomers: 1, repeatOrders: 2, repeatOrderBasisPoints: 5000,
    orderLines: 7, deliveredOrders: 3, deliveryDays: 3, products: 3,
    matchedReceipts: 3, splitPaymentInvoices: 1, partPaidInvoices: 1, partPaidOutstandingMinor: 29000,
    reminders: 0, remindedInvoices: 0, paidAfterReminder: 0, paidAfterReminderMinor: 0,
  });
});

test('operating evidence · reminder outcomes require a later settlement on that invoice', () => {
  const input = {scope:'test',preparedAt:'2026-03-10T12:00:00Z', openingBalanceMinor:0,
    state:SYNTHETIC_STATE,sales:SYNTHETIC_SALES,consents:[],identity:SYNTHETIC().identity,
    reminders:[{invoiceId:'INV-1',at:'2026-03-02T12:00:00Z'},
      {invoiceId:'INV-1',at:'2026-03-04T12:00:00Z'}, {invoiceId:'INV-3',at:'2026-03-08T12:00:00Z'},
      {invoiceId:'absent',at:'2026-03-02T12:00:00Z'}]};
  const evidence=dossierOf(input).operating;
  assert.equal(evidence.reminders,3);
  assert.equal(evidence.remindedInvoices,2);
  assert.equal(evidence.paidAfterReminder,1);
  assert.equal(evidence.paidAfterReminderMinor,100000);
});

test('operating evidence · settled orders retain their completed delivery', () => {
  const input={scope:'test',preparedAt:'2026-03-10T12:00:00Z',openingBalanceMinor:0,
    state:SYNTHETIC_STATE,consents:[],identity:SYNTHETIC().identity,
    sales:[sale('delivered','2026-03-02',100,'c1','One',[['A',1,100]],'delivered'),
      sale('settled','2026-03-03',100,'c1','One',[['A',1,100]],'settled'),
      sale('pending','2026-03-03',100,'c1','One',[['A',1,100]],'made')]};
  const report=dossierOf(input);
  assert.equal(report.operating.deliveredOrders,2);
  assert.equal(report.orderBook.weeks[0].delivered,2);
  assert.equal(report.orderBook.weeks[0].orders,3);
});

test('operating evidence · a later overpayment preserves the original settlement time', () => {
  const state=structuredClone(SYNTHETIC_STATE);
  state.receipts.push(receipt('extra','INV-1',100,'2026-03-08T15:00:00Z'));
  const answer=dossierOf({scope:'test',preparedAt:'2026-03-10T12:00:00Z',openingBalanceMinor:0,
    state,sales:SYNTHETIC_SALES,consents:[],identity:SYNTHETIC().identity,
    reminders:[{invoiceId:'INV-1',at:'2026-03-04T12:00:00Z'}]});
  assert.equal(answer.operating.paidAfterReminder,0);
  assert.equal(answer.collections.averageDaysToPay,2);
});

test('operating evidence · cash part payments settle at their actual recorded arrival', () => {
  const state=structuredClone(SYNTHETIC_STATE);
  state.receipts=state.receipts.filter(row=>row.invoiceId!=='INV-1');
  state.receipts.push(receipt('first','INV-1',40000,'2026-03-03T15:00:00Z'),
    {...receipt('last','INV-1',60000,'2026-03-01T15:00:00Z'),source:'manual',method:'cash',receivedAt:'2026-03-06T15:00:00Z'});
  const answer=dossierOf({scope:'test',preparedAt:'2026-03-10T12:00:00Z',openingBalanceMinor:0,
    state,sales:SYNTHETIC_SALES,consents:[],identity:SYNTHETIC().identity,
    reminders:[{invoiceId:'INV-1',at:'2026-03-04T12:00:00Z'}]});
  assert.equal(answer.operating.paidAfterReminder,1);
  assert.equal(answer.operating.paidAfterReminderMinor,100000);
  assert.equal(answer.collections.averageDaysToPay,5);
});

test('collections evidence · direct settlements stay outside the sent-request success rate', () => {
  const state=structuredClone(SYNTHETIC_STATE);
  state.receipts.push(receipt('direct','INV-3',29000,'2026-03-09T18:00:00Z'));
  const answer=dossierOf({scope:'test',preparedAt:'2026-03-10T12:00:00Z',openingBalanceMinor:0,
    state,sales:SYNTHETIC_SALES,consents:[],identity:SYNTHETIC().identity});
  assert.equal(answer.collections.requestsSent,2);
  assert.equal(answer.collections.paid,1);
  assert.equal(answer.collections.successBasisPoints,5000);
  assert.equal(answer.collections.paidMinor,100000);
});

test('collections evidence · rounding stays in takings while principal decides settlement time', () => {
  const state=structuredClone(SYNTHETIC_STATE);
  state.receipts=state.receipts.filter(row=>row.invoiceId!=='INV-1');
  state.receipts.push(
    {...receipt('part-one','INV-1',50050,'2026-03-03T15:00:00Z'),roundingMinor:50},
    {...receipt('part-two','INV-1',50000,'2026-03-04T15:00:00Z'),roundingMinor:50},
    receipt('final-principal','INV-1',50,'2026-03-06T15:00:00Z'));
  assert.equal(model.invoiceBalance(state,'INV-1'),0);
  const answer=dossierOf({scope:'test',preparedAt:'2026-03-10T12:00:00Z',openingBalanceMinor:0,
    state,sales:SYNTHETIC_SALES,consents:[],identity:SYNTHETIC().identity,
    reminders:[{invoiceId:'INV-1',at:'2026-03-05T12:00:00Z'}]});
  assert.equal(answer.collections.averageDaysToPay,5);
  assert.equal(answer.operating.paidAfterReminder,1);
  assert.equal(answer.operating.paidAfterReminderMinor,100000);
  assert.equal(answer.movements.inflowMinor,120100);
});


test('legacy share records remain preparation history with the saved instant and requested amount', () => {
  const legacy = { version: 1, scope: 'fish', shares: [{ at: '2026-09-14T14:45:00Z' }], requestedAdvanceMinor: 250000 };
  const parsed = parseDossierLog(legacy, 'fish');
  assert.equal(parsed.shares[0].at, '2026-09-14T14:45:00.000Z');
  assert.equal(parsed.requestedAdvanceMinor, 250000);
  assert.equal(dossier.DOSSIER_CONSENT_WORDS.share, 'PDF prepared');
  assert.deepEqual(parseDossierLog(JSON.parse(JSON.stringify(parsed)), 'fish'), parsed);
});
