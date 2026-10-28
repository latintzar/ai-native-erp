/* CAMPAIGNS — the reading, the record and the seed (FEED-IA §249, brief B).
 *
 * Two books, because a model that only works on the fixture is a fixture: a SYNTHETIC one whose
 * every number is written here, and the FISH house's own book folded by `buildSales` with the
 * Money ledger `money-seed.ts` writes. The synthetic half pins the arithmetic; the fish half
 * proves the seeded price signal matches a line that house really sells, that every seeded quiet
 * account is a real customer the river leaves alone, and that the early-pay share is the ledger's.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript, loadTypeScript } from './ts-module.mjs';

const campaigns = loadTypeScript('src/prototypes/cedar/campaigns.ts', 'campaigns-test');
const require = createRequire(import.meta.url);
const salePath = compileTypeScript('src/prototypes/cedar/sale.ts', 'campaigns-source-test');
const { buildSales } = require(salePath);
const { cedarCast } = require(join(dirname(salePath), 'cedar-cast.js'));
const { dayForSector } = require(join(dirname(salePath), 'day.js'));
const { CASTS } = require(join(dirname(salePath), '../../scenarios/data/cast.js'));
const { cedarTodayId, shiftCalendarId } = require(join(dirname(salePath), 'scenario-clock.js'));
const seed = loadTypeScript('src/prototypes/cedar/money-seed.ts', 'campaigns-money-seed-test');
const model = loadTypeScript('src/prototypes/cedar/money-model.ts', 'campaigns-money-model-test');

const money = (minor) => `S/ ${(minor / 100).toFixed(2)}`;
const TODAY = cedarTodayId();
const day = (offset) => shiftCalendarId(TODAY, offset);

/** A tiny book written by hand: two products, three accounts, one of them long gone. */
const line = (name, given, price) => ({ product: { name }, given, price });
const order = (id, dayId, lines) => ({ day: dayId, customer: { id }, lines });
const SYNTHETIC = [
  order('vera', day(0), [line('Merluza', 10, 20), line('Pulpo', 4, 10)]),
  order('vera', day(-3), [line('Merluza', 5, 20)]),
  order('nou', day(-6), [line('Merluza', 5, 20), line('Pulpo', 10, 10)]),
  /* outside the week, so it counts for the account's silence and never for the week's value */
  order('nou', day(-30), [line('Merluza', 100, 20)]),
  { ...order('manolo', day(0), [line('Merluza', 1, 20)]), messageOnly: true },
];
const ACCOUNTS = [
  { id: 'vera', name: 'Distribuciones Vera' },
  { id: 'nou', name: 'Restaurant Nou' },
  { id: 'manolo', name: 'Bar Manolo' },
  { id: 'cansole', name: 'Can Solé' },
];

test('the week of orders is the last seven days of real lines, by product', () => {
  const weekly = campaigns.weeklyValueOf(SYNTHETIC, TODAY);
  /* 10×20 + 5×20 + 5×20 = 400, and the thirty-day-old order stays outside it. */
  assert.equal(weekly.get('Merluza'), 40_000);
  assert.equal(weekly.get('Pulpo'), 14_000);
  /* A question is not an order, so a message-only row adds nothing to any line. */
  assert.equal(campaigns.weeklyValueOf(SYNTHETIC.filter(row => row.messageOnly), TODAY).size, 0);
});

test('the pre-buy card names the line the rise costs most, and two weeks of it', () => {
  const signals = [
    { market: 'peru', product: 'Merluza', risePercent: 5, risesInDays: 7 },
    { market: 'peru', product: 'Pulpo', risePercent: 40, risesInDays: 7 },
    { market: 'peru', product: 'Corvina', risePercent: 90, risesInDays: 7 },
  ];
  const reading = campaigns.preBuyReadingOf({ sales: SYNTHETIC, products: [{ name: 'Merluza' }, { name: 'Pulpo' }], signals, today: TODAY });
  /* Pulpo: 140,00 × 40 = 5.600 against Merluza's 400,00 × 5 = 2.000, and Corvina is a published
     line this house does not sell, so it is matched by nobody however far it rises. */
  assert.equal(reading.product, 'Pulpo');
  assert.equal(reading.weeklyMinor, 14_000);
  assert.equal(reading.risePercent, 40);
  assert.equal(reading.preBuyMinor, 28_000);
  assert.equal(reading.risesOn, day(7));
  /* A house that sells none of the published lines gets no card rather than an invented one. */
  assert.equal(campaigns.preBuyReadingOf({ sales: SYNTHETIC, products: [], signals: signals.slice(2), today: TODAY }), null);
});

test('an account is quiet at fourteen days, and the book always wins when it is newer', () => {
  const history = [
    { customerId: 'cansole', lastOrderDay: day(-21) },
    { customerId: 'nou', lastOrderDay: day(-40) },
  ];
  const quiet = campaigns.quietAccountsOf({ sales: SYNTHETIC, accounts: ACCOUNTS, history, today: TODAY });
  /* `nou` ordered six days ago in the book, so the seeded forty days is overruled; `vera` ordered
     today; `manolo`'s only row is a question and this workspace holds no history for them. */
  assert.deepEqual(quiet.map(row => row.customerId), ['cansole']);
  assert.equal(quiet[0].days, 21);
  assert.equal(quiet[0].name, 'Can Solé');
  assert.equal(quiet[0].lastOrderDay, day(-21));
  /* The threshold is the whole rule: at thirteen days nobody is quiet, at six days `nou` joins. */
  assert.equal(campaigns.quietAccountsOf({ sales: SYNTHETIC, accounts: ACCOUNTS, history, today: TODAY, quietDays: 22 }).length, 0);
  assert.deepEqual(
    campaigns.quietAccountsOf({ sales: SYNTHETIC, accounts: ACCOUNTS, history, today: TODAY, quietDays: 6 }).map(row => row.customerId),
    ['cansole', 'nou'],
  );
});

test('the early-pay share counts the requests covered in full inside the week', () => {
  const invoices = [
    { id: 'a', amountMinor: 10_000, issuedAt: `${day(-10)}T09:00:00-05:00` },
    { id: 'b', amountMinor: 10_000, issuedAt: `${day(-10)}T09:00:00-05:00` },
    { id: 'c', amountMinor: 10_000, issuedAt: `${day(-10)}T09:00:00-05:00` },
    { id: 'd', amountMinor: 10_000, issuedAt: `${day(-10)}T09:00:00-05:00` },
  ];
  const requests = invoices.map(invoice=>({invoiceId:invoice.id,sentAt:invoice.issuedAt}));
  const receipts = [
    { invoiceId: 'a', amountMinor: 10_000, at: `${day(-9)}T09:00:00-05:00`, status: 'matched' },
    { invoiceId: 'b', amountMinor: 5_000, at: `${day(-9)}T09:00:00-05:00`, status: 'matched' },
    { invoiceId: 'c', amountMinor: 10_000, at: `${day(-1)}T09:00:00-05:00`, status: 'matched' },
    { invoiceId: 'd', amountMinor: 10_000, at: `${day(-9)}T09:00:00-05:00`, status: 'review' },
  ];
  const reading = campaigns.earlyPayShareOf({ invoices, requests, receipts,asOf:`${day(0)}T23:59:59-05:00` });
  /* `a` settled the next day; `b` is half paid; `c` took nine days; `d`'s receipt is in review. */
  assert.deepEqual(reading, { requested: 4, settled: 1, sharePercent: 25, days: 7 });
  /* An invoice nobody asked for a payment on stands outside the share entirely. */
  assert.equal(campaigns.earlyPayShareOf({ invoices, requests: [], receipts,asOf:`${day(0)}T23:59:59-05:00` }).sharePercent, 0);
});

test('the message merges the account, the offer and the code', () => {
  const account = { name: 'Bar Manolo' };
  assert.equal(
    campaigns.messageOf(campaigns.WIN_BACK_TEMPLATE, account, { type: 'percent', value: 10 }, money),
    'Hi Bar Manolo, we miss your orders. 10 % off your next one with VUELVE10, this week.',
  );
  assert.equal(
    campaigns.messageOf('Hi {name}, {offer} your next order.', account, { type: 'fixed', value: 2_000 }, money),
    'Hi Bar Manolo, S/ 20.00 off your next order.',
  );
  assert.equal(
    campaigns.messageOf('Hi {name}, {offer} your next order.', account, { type: 'free-delivery', value: 0 }, money),
    'Hi Bar Manolo, free delivery on your next order.',
  );
  assert.equal(campaigns.offerLabel({ type: 'percent', value: 5 }, money), '5 % off');
  assert.equal(campaigns.offerLabel({ type: 'free-delivery', value: 0 }, money), 'Free delivery');
});

test('a redemption is an order on or after the day the message reached that account', () => {
  const at = (offset) => `${day(offset)}T12:00:00.000Z`;
  const campaign = campaigns.createCampaign({
    id: 'c1', name: 'Win back quiet customers', kind: 'recommended', customers: ['vera', 'nou', 'cansole'],
    offer: { type: 'percent', value: 10 }, message: campaigns.WIN_BACK_TEMPLATE,
    scheduledFor: null, budgetMinor: null, createdAt: at(-4),
  });
  const sent = campaigns.recordSends(campaign, [
    { customerId: 'vera', at: at(-4) }, { customerId: 'nou', at: at(-4) }, { customerId: 'cansole', at: at(-4) },
  ]);
  /* `vera` ordered today, `nou`'s last order was six days ago — before the message — and
     `cansole` has never ordered in this book at all. */
  assert.deepEqual(campaigns.redemptionsOf(sent, SYNTHETIC), ['vera']);
  assert.equal(sent.scheduledFor, null);
  assert.deepEqual(campaigns.redemptionsOf(campaign, SYNTHETIC), []);
});

test('a scheduled campaign is due when its instant has passed, and once only', () => {
  const at = new Date(Date.now()).toISOString();
  const later = new Date(Date.now() + 3_600_000).toISOString();
  const scheduled = campaigns.createCampaign({
    id: 'c2', name: 'Spring offer', kind: 'custom', customers: ['vera'], offer: { type: 'percent', value: 5 },
    message: campaigns.CUSTOM_TEMPLATE, scheduledFor: later, budgetMinor: 50_000, createdAt: at,
  });
  assert.deepEqual(campaigns.dueCampaigns([scheduled], at), []);
  assert.deepEqual(campaigns.dueCampaigns([scheduled], later).map(row => row.id), ['c2']);
  const sent = campaigns.recordSends(scheduled, [{ customerId: 'vera', at: later }]);
  assert.equal(sent.scheduledFor, null);
  assert.deepEqual(campaigns.dueCampaigns([sent], later), []);
});

test('the stored book is validated field by field, and a damaged campaign reads as absent', () => {
  const at = new Date().toISOString();
  const good = campaigns.createCampaign({
    id: 'c3', name: 'Spring offer', kind: 'custom', customers: ['vera'], offer: { type: 'percent', value: 5 },
    message: campaigns.CUSTOM_TEMPLATE, scheduledFor: null, budgetMinor: null, createdAt: at,
  });
  const book = campaigns.putCampaign(campaigns.emptyCampaignBook('fish'), good);
  assert.equal(campaigns.campaignsKey('fish'), 'rocoto-cedar-campaigns-v1:fish');
  assert.deepEqual(campaigns.parseCampaigns(JSON.parse(JSON.stringify(book)), 'fish'), book);
  /* Another workspace's book, a future version and a damaged row each read as an empty book. */
  assert.deepEqual(campaigns.parseCampaigns(book, 'meat'), campaigns.emptyCampaignBook('meat'));
  assert.deepEqual(campaigns.parseCampaigns({ ...book, version: 2 }, 'fish'), campaigns.emptyCampaignBook('fish'));
  for (const damage of [{ offer: { type: 'gift', value: 1 } }, { kind: 'other' }, { createdAt: 'soon' },
    { customers: [42] }, { sends: [{ customerId: 'vera', at: 'never' }] }, { name: '' }]) {
    assert.deepEqual(campaigns.parseCampaigns({ ...book, campaigns: [{ ...good, ...damage }] }, 'fish').campaigns, [],
      `a campaign carrying ${JSON.stringify(damage)} reads as absent`);
  }
  /* One id per launch, ordered by the book's own length. */
  assert.equal(campaigns.newCampaignId('2026-09-14T09:41:00.000Z', 0), 'campaign-20260914094100-1');
  assert.notEqual(campaigns.newCampaignId(at, 0), campaigns.newCampaignId(at, 1));
});

test('the three recommendations are built from one reading', () => {
  const rows = campaigns.recommendationsOf({
    sales: SYNTHETIC, products: [{ name: 'Merluza' }, { name: 'Pulpo' }], accounts: ACCOUNTS,
    invoices: [], requests: [], receipts: [], history: [{ customerId: 'cansole', lastOrderDay: day(-21) }],
    today: TODAY, market: 'peru', money,
  });
  assert.deepEqual(rows.map(row => row.key), ['pre-buy', 'win-back', 'early-pay']);
  assert.deepEqual(rows.map(row => row.act), ['Get advance', 'Send campaign', 'Create campaign']);
  assert.deepEqual(rows[1].customers, ['cansole']);
  assert.equal(rows[1].facts.quiet, 1);
  assert.ok(rows[1].fact.includes('Can Solé') && rows[1].fact.includes('VUELVE10'));
  /* An empty ledger states what will appear rather than a share of nothing. */
  assert.equal(rows[2].facts.requested, 0);
  assert.ok(rows[2].fact.startsWith('The share of invoices paid within 7 days appears here'));
  assert.equal(rows[0].advanceMinor, rows[0].facts.preBuyMinor);
});

/* ── THE SEED, ON THE HOUSE'S OWN BOOK ────────────────────────────────────────────────────── */

for (const [scope, cast] of Object.entries(CASTS)) test(`${scope}: the seed stands on this house's own book`, () => {
  const book = cedarCast(cast);
  const sales = buildSales(book, dayForSector(scope));
  const accounts = book.customers.map(person => ({ id: person.id, name: person.name }));
  const history = campaigns.accountHistoryOf(scope);
  assert.ok(history.length >= 2, 'the workspace holds order history from before the river');

  /* EVERY SEEDED ACCOUNT IS A REAL CUSTOMER, and its day is a calendar day this workspace's own
     clock produced, older than the quiet threshold. */
  for (const row of history) {
    assert.ok(accounts.some(account => account.id === row.customerId), `${row.customerId} is in the book`);
    assert.match(row.lastOrderDay, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(campaigns.daysBetween(row.lastOrderDay, TODAY) >= campaigns.QUIET_DAYS);
  }

  /* The ninety-day book supplies each customer's last order. Quiet accounts have earlier orders;
     an order inside the quiet threshold takes the customer out of the recommendation. */
  const quiet = campaigns.quietAccountsOf({ sales, accounts, history, today: TODAY });
  const ordered = new Set(sales.filter(sale => !sale.messageOnly && !sale.archived
    && campaigns.daysBetween(sale.day, TODAY) < campaigns.QUIET_DAYS).map(sale => sale.customer.id));
  for (const row of quiet) {
    assert.equal(ordered.has(row.customerId), false, `${row.customerId} has an order inside the quiet threshold`);
    assert.ok(row.days >= campaigns.QUIET_DAYS);
  }
  for (const row of history) {
    if (ordered.has(row.customerId)) assert.equal(quiet.some(item => item.customerId === row.customerId), false);
  }

  /* THE PRICE SIGNAL MATCHES A LINE THIS HOUSE ACTUALLY SELLS, and its figure is the book's. */
  const reading = campaigns.preBuyReadingOf({ sales, products: book.products, signals: campaigns.priceSignalsOf('peru'), today: TODAY });
  assert.ok(reading, 'a published line matches this catalogue');
  const weekly = campaigns.weeklyValueOf(sales, TODAY);
  assert.equal(reading.weeklyMinor, weekly.get(reading.product));
  assert.ok(reading.weeklyMinor > 0 && reading.risePercent > 0);
  assert.equal(reading.preBuyMinor, reading.weeklyMinor * campaigns.PRE_BUY_WEEKS);
  /* Both markets publish a line this house sells, so a Spanish workspace reads the same card. */
  assert.ok(campaigns.preBuyReadingOf({ sales, products: book.products, signals: campaigns.priceSignalsOf('spain'), today: TODAY }));

  /* Most of the ninety-day book settles within the week. Exact counts come from the recorded
     invoice balances and receipt dates, including retained partial payments. */
  const seeded = seed.seedMoney(model.emptyMoney(scope), sales, 'https://example.invalid/cedar');
  assert.equal(seeded.ok, true, seeded.error);
  const asOf=seed.moneyNow(seeded.state);
  const early = campaigns.earlyPayShareOf({...seeded.state,asOf,sampleAsOf:asOf});
  const firstByInvoice=new Map(seeded.state.requests.filter(row=>row.sentAt).map(row=>[row.invoiceId,Date.parse(row.sentAt)]));
  const cohort=seeded.state.invoices.filter(invoice=>{
    const first=firstByInvoice.get(invoice.id);if(first===undefined||first>Date.parse(asOf))return false;
    const paid=seeded.state.receipts.filter(row=>row.invoiceId===invoice.id&&row.status==='matched');
    if(paid.filter(row=>Date.parse(row.at)<first).reduce((sum,row)=>sum+row.amountMinor,0)>=invoice.amountMinor)return false;
    return first+7*86400000<=Date.parse(asOf)||paid.filter(row=>Date.parse(row.at)<=first+7*86400000).reduce((sum,row)=>sum+row.amountMinor,0)>=invoice.amountMinor;
  });
  const paidWithinWeek=cohort.filter(invoice=>seeded.state.receipts.filter(row=>row.invoiceId===invoice.id&&row.status==='matched'
    &&Date.parse(row.at)<=firstByInvoice.get(invoice.id)+7*86400000).reduce((sum,row)=>sum+row.amountMinor,0)>=invoice.amountMinor);
  assert.equal(early.requested,cohort.length);
  assert.equal(early.settled,paidWithinWeek.length);
  assert.equal(early.sharePercent,Math.round(paidWithinWeek.length/cohort.length*100));
  assert.ok(early.sharePercent>=70&&early.sharePercent<=90,`contact cohort share ${early.sharePercent}`);
});

test('early payment reads the mature first-contact cohort and ignores automatic unsent links',()=>{
  const asOf='2026-09-15T12:00:00Z',sentAt='2026-09-01T12:00:00Z';
  const invoices=[{id:'paid',amountMinor:10000,issuedAt:'2026-08-20T12:00:00Z'},{id:'late',amountMinor:10000,issuedAt:sentAt},
    {id:'new',amountMinor:10000,issuedAt:asOf},{id:'already-paid',amountMinor:10000,issuedAt:sentAt}];
  const requests=invoices.map(row=>({invoiceId:row.id,sentAt:row.id==='new'?asOf:sentAt}));
  requests.push({invoiceId:'paid',sentAt:'2026-09-02T12:00:00Z'},{invoiceId:'late',sentAt:'tomorrow'});
  const receipts=[{invoiceId:'paid',amountMinor:4000,status:'matched',at:'2026-08-31T12:00:00Z'},
    {invoiceId:'paid',amountMinor:6000,status:'matched',at:'2026-09-07T12:00:00Z'},
    {invoiceId:'already-paid',amountMinor:10000,status:'matched',at:'2026-08-31T12:00:00Z'}];
  const read=()=>campaigns.earlyPayShareOf({invoices,requests,receipts,asOf});
  assert.deepEqual(read(),{requested:2,settled:1,sharePercent:50,days:7});
  for(let i=0;i<1000;i++){invoices.push({id:`unsent-${i}`,amountMinor:10000,issuedAt:sentAt});requests.push({invoiceId:`unsent-${i}`});}
  assert.deepEqual(read(),{requested:2,settled:1,sharePercent:50,days:7});
});

test('a real first contact uses the actual observation clock before a receipt exists',()=>{
  const invoice={id:'actual-contact',origin:'demo',amountMinor:10000,issuedAt:'2026-08-01T12:00:00Z'};
  const input={invoices:[invoice],requests:[{invoiceId:invoice.id,sentAt:'2026-09-01T12:00:00Z',sentAtSource:'actual'}],receipts:[],
    asOf:'2026-09-15T12:00:00Z',sampleAsOf:'2026-08-15T12:00:00Z'};
  assert.deepEqual(campaigns.earlyPayShareOf(input),{requested:1,settled:0,sharePercent:0,days:7});
  assert.equal(campaigns.earlyPayShareOf({...input,requests:[{...input.requests[0],sentAt:'2026-09-16T12:00:00Z'}]}).requested,0);
});


test('early settlement counts invoice principal separately from payment rounding',()=>{
  const invoice={id:'rounded',amountMinor:10000,issuedAt:'2026-09-01T12:00:00Z'};
  const input={invoices:[invoice],requests:[{invoiceId:invoice.id,sentAt:'2026-09-01T12:00:00Z'}],
    receipts:[{invoiceId:invoice.id,amountMinor:10000,roundingMinor:1,status:'matched',at:'2026-09-02T12:00:00Z'}],asOf:'2026-09-15T12:00:00Z'};
  assert.deepEqual(campaigns.earlyPayShareOf(input),{requested:1,settled:0,sharePercent:0,days:7});
  input.receipts.push({invoiceId:invoice.id,amountMinor:1,roundingMinor:0,status:'matched',at:'2026-09-03T12:00:00Z'});
  assert.equal(campaigns.earlyPayShareOf(input).settled,1);
});
