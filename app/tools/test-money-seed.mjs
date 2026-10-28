import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript, loadTypeScript } from './ts-module.mjs';

const seed = loadTypeScript('src/prototypes/cedar/money-seed.ts', 'money-seed-test');
const projections = loadTypeScript('src/prototypes/cedar/money-projections.ts', 'money-projections-test');
const require = createRequire(import.meta.url);
const salePath = compileTypeScript('src/prototypes/cedar/sale.ts', 'money-seed-source-test');
const castPath = compileTypeScript('src/prototypes/cedar/cedar-cast.ts', 'money-seed-cast-test');
const { buildSales, baseDate, dayIdOf } = require(salePath);
const { cedarCast } = require(castPath);
const { dayForSector, nowOf } = require(join(dirname(salePath), 'day.js'));
const { CASTS } = require(join(dirname(salePath), '../../scenarios/data/cast.js'));
const model = loadTypeScript('src/prototypes/cedar/money-model.ts', 'money-seed-model-test');
const clock = loadTypeScript('src/prototypes/cedar/scenario-clock.ts', 'money-seed-clock-test');

for (const [scope, cast] of Object.entries(CASTS)) test(`${scope}: retained seed resolves actual Cedar sales and clock`, () => {
  const sales = buildSales(cedarCast(cast), dayForSector(scope));
  const config = seed.moneyWorkspace(scope);
  assert.equal(config.currency, 'PEN');
  assert.equal(config.fxRate, 1);
  assert.equal(config.referenceAt, `${dayIdOf(baseDate(cast))}T${nowOf(cast)}:00-05:00`);
  assert.equal(config.houseName, cast.house.name);
  const current = model.emptyMoney(scope);
  const result = seed.seedMoney(current, sales, 'https://example.invalid/cedar');
  assert.equal(result.ok, true, result.error);
  const state = result.state;
  assert.ok(state.invoices.length >= seed.moneySeeds(scope, undefined, sales).length);
  assert.equal(state.receipts.length, seed.moneySeeds(scope, undefined, sales).filter(row=>row.paidBps>0).length);
  /* Seeding writes the seller's IDENTITY where the person has entered none (the house name, the
     tax number and the invoice series the demo invoices carry) and never a connection posture:
     payments and invoicing stay exactly as the person left them (§247.2, the money pass). */
  assert.deepEqual(state.setup, { ...current.setup, sellerName: config.houseName, ruc: '20123456789', invoiceSeries: 'F001' });
  assert.equal(state.setup.payments, current.setup.payments);
  assert.equal(state.setup.invoicing, current.setup.invoicing);
  assert.equal(seed.seedMoney(state, sales, '').state, state);
  for (const invoice of state.invoices) {
    const sale = sales.find(row => row.id === invoice.saleId);
    assert.ok(sale);
    assert.equal(invoice.customerId, sale.customer.id);
    assert.equal(invoice.sourceTotal, sale.figure);
    assert.equal(invoice.sourceCurrency, 'PEN');
    assert.equal(invoice.fxRate, 1);
    assert.equal(invoice.amountMinor, Math.round(sale.figure * config.fxRate * 100));
    if(invoice.collectionOnly)assert.ok(invoice.issuedAt.slice(0,10)<=sale.day);else assert.equal(invoice.issuedAt.slice(0,10), sale.day);
    assert.ok(Date.parse(invoice.issuedAt) <= Date.parse(config.referenceAt));
    assert.ok(invoice.lines.every(line => sale.lines.some(source => source.id === line.id)));
  }
  assert.equal(model.parseMoney(JSON.parse(JSON.stringify(state)), scope).invoices.length, state.invoices.length);
  const view = projections.projectMoney(state, sales);
  const bankReceipts = state.receipts.filter(row=>row.method !== 'cash').reduce((sum, receipt) => sum + receipt.amountMinor, 0);
  assert.equal(view.bankBalanceMinor, config.openingBalanceMinor + bankReceipts);
  const receivedIn = points => state.receipts.filter(row=>row.method !== 'cash' && points.some(point=>point.at===model.peruDate(row.at))).reduce((sum,row)=>sum+row.amountMinor,0);
  assert.equal(view.history.reduce((sum,point)=>sum+point.amountMinor,0), receivedIn(view.history));
  assert.equal(view.dailyHistory.reduce((sum,point)=>sum+point.amountMinor,0), receivedIn(view.dailyHistory));
  assert.equal(view.dailyHistory.length,90);
  assert.equal(view.dailyHistory[0].at,seed.moneyDateAfter(scope,-89));
  assert.equal(view.dailyHistory.at(-1).at,seed.moneyDateAfter(scope,0));
  assert.ok(view.history.filter(point=>point.amountMinor>0).length>=10);
  assert.ok(view.forecast.some(point => point.amountMinor > 0));
  assert.equal(view.forecast.reduce((sum, point) => sum + point.amountMinor, 0), view.forecastSources.reduce((sum, source) => sum + source.amountMinor, 0));
  assert.ok(view.forecastSources.every(source => sales.some(sale => sale.id === source.saleId)));
  assert.equal(new Set(view.forecastSources.map(source => source.saleId)).size, view.forecastSources.length);
});

test('bank projection excludes cash, manual evidence, review, foreign currency and future receipts', () => {
  const state = model.emptyMoney('fish');
  const base = { id: 'r', invoiceId: 'i', currency: 'PEN', method: 'yape', source: 'demo-bank', reference: 'r', at: seed.moneyWorkspace('fish').referenceAt, status: 'matched', amountMinor: 1250 };
  state.receipts = [base, { ...base, id:'cash', method:'cash' }, { ...base, id:'manual', source:'manual' }, { ...base, id:'review', status:'review' }, { ...base, id:'usd', currency:'USD' }, { ...base, id:'future', at:`${seed.moneyDateAfter('fish', 1)}T12:00:00-05:00` }];
  assert.equal(projections.projectMoney(state, []).bankBalanceMinor, seed.moneyWorkspace('fish').openingBalanceMinor + 1250);
});

test('future invoices use remaining amount once; represented sales are excluded from separate projection', () => {
  const config = seed.moneyWorkspace('fish');
  const state = model.emptyMoney('fish');
  state.invoices = [{ id:'i', saleId:'s', status:'accepted', currency:'PEN', amountMinor:10000, dueAt:seed.moneyDateAfter('fish', 1) }];
  state.receipts = [{ invoiceId:'i', status:'matched', amountMinor:2500 }];
  const sale = { id:'s', figure:100, day:seed.moneyDateAfter('fish', 1), state:'committed', lines:[{}], customer:{ id:'c' } };
  const view = projections.projectMoney(state, [sale, { ...sale, id:'t' }, { ...sale, id:'request', state:'request' }, { ...sale, id:'past', day:seed.moneyDateAfter('fish', -1) }, { ...sale, id:'archived', archived:true }, { ...sale, id:'empty', lines:[] }]);
  assert.deepEqual(view.forecastSources.map(source => [source.saleId,source.amountMinor]), [['s',7500],['t',10000]]);
});

test('missing retained source refuses a partial seed and keeps the original state', () => {
  const state = model.emptyMoney('fish');
  const result = seed.seedMoney(state, [], 'https://example.invalid');
  assert.equal(result.ok, false);
  assert.equal(state.invoices.length, 0);
});

test('an untouched persisted Money fixture advances together on the next Peru boot day', () => {
  const scope = 'fish';
  const cast = cedarCast(CASTS[scope]);
  const sales = buildSales(cast, dayForSector(scope));
  const firstNow = new Date(`${clock.cedarTodayId()}T12:00:00Z`);
  const first = seed.seedMoney(model.emptyMoney(scope), sales, 'https://example.invalid', firstNow);
  assert.equal(first.ok, true, first.error);
  const nextNow = new Date(firstNow);
  nextNow.setUTCDate(nextNow.getUTCDate() + 1);
  const nextDay = clock.cedarTodayId(nextNow);
  const shiftedSales = sales.map(sale => ({
    ...sale,
    day: clock.shiftCalendarId(sale.day, 1),
    at: sale.at,
  }));
  const shifted = seed.seedMoney(first.state, shiftedSales, 'https://example.invalid', nextNow);
  assert.equal(shifted.ok, true, shifted.error);
  assert.equal(shifted.state.fixtureDay, nextDay);
  assert.equal(shifted.state.invoices.length,first.state.invoices.length);
  for (const invoice of shifted.state.invoices) {
    const before=first.state.invoices.find(row=>row.saleId===invoice.saleId);
    assert.ok(before);
    assert.equal(invoice.amountMinor,before.amountMinor);
    assert.equal(invoice.issuedAt.slice(0,10),clock.shiftCalendarId(before.issuedAt.slice(0,10),1));
  }
  assert.deepEqual(shifted.state.setup, first.state.setup);

  const providerAt = '2026-07-03T18:22:01Z';
  const retained = { ...first.state, events: [
    ...first.state.events,
    { id: 'provider-event', invoiceId: first.state.invoices[0].id, kind: 'provider', label: 'Imported', at: providerAt },
  ] };
  assert.strictEqual(
    seed.seedMoney(retained, shiftedSales, 'https://example.invalid', nextNow).state,
    retained,
    'provider or operator additions make the persisted record immutable',
  );
  assert.equal(retained.events.at(-1).at, providerAt);
});

test('sample action timestamps and due dates stay on the Cedar source clock', () => {
  const state = model.emptyMoney('fish');
  state.events = [{}, {}, {}];
  assert.equal(seed.moneyNow(state), new Date(Date.parse(seed.moneyWorkspace('fish').referenceAt) + 3000).toISOString());
  assert.equal(seed.moneyDateAfter('fish', 30), new Date(Date.parse(`${seed.moneyDateAfter('fish', 0)}T12:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10));
});

test('a bank receipt changes balance and outstanding projection by the same exact amount', () => {
  const state = model.emptyMoney('fish');
  state.invoices = [{ id:'i', saleId:'s', status:'accepted', currency:'PEN', amountMinor:10000, dueAt:seed.moneyDateAfter('fish', 1) }];
  const before = projections.projectMoney(state, []);
  state.receipts = [{ id:'r', invoiceId:'i', status:'matched', amountMinor:3333, currency:'PEN', source:'demo-bank', method:'plin', at:seed.moneyWorkspace('fish').referenceAt }];
  const after = projections.projectMoney(state, []);
  assert.equal(after.bankBalanceMinor - before.bankBalanceMinor, 3333);
  assert.equal(before.forecast[0].amountMinor - after.forecast[0].amountMinor, 3333);
  assert.equal(after.dailyHistory.at(-1).amountMinor, 3333);
});

/* THE SEED FOLLOWS THE CAST'S CALENDAR (14 September 2026): on a Monday the fixture's «yesterday» is a
   Sunday, which the cast draws at six percent of its load, so the customers the seed names have no
   sale that day. `sourceSaleFor` takes the customer's last delivery on or before the wanted day; the
   exact day wins when it exists. Pinned with synthetic sales so it holds on every weekday. */
test('a seed whose fixture day is a Sunday stands on the customer\'s last delivery before it', () => {
  const day = (d) => ({ id: `d-${d}-vera`, day: d, customer: { id: 'vera' }, figure: 10, lines: [{}], state: 'committed' });
  const sales = [day('2026-09-12'), day('2026-09-10'), { ...day('2026-09-13'), customer: { id: 'hotel' } }];
  assert.equal(seed.sourceSaleFor(sales, 'vera', '2026-09-13').day, '2026-09-12', 'Sunday wanted → Saturday taken');
  assert.equal(seed.sourceSaleFor(sales, 'vera', '2026-09-12').day, '2026-09-12', 'the exact day wins');
  assert.equal(seed.sourceSaleFor(sales, 'vera', '2026-09-09'), undefined, 'nothing earlier → no sale');
  assert.equal(seed.calendarDaysBetween('2026-09-12', '2026-09-13'), 1);
  assert.equal(seed.calendarDaysBetween('2026-09-13', '2026-09-13'), 0);
});

/* THE SEEDED REFERENCE IS THE ORDER'S OWN NUMBER (FEED-IA §252).
 *
 * «WHy is the immudable reference CEDAR0named??? it's a payment for an order. lol.»
 *                                                              — Peter, 14 September 2026
 *
 * `money-v1.json` states each seed's reference as data, the way every Cedar fixture states its
 * records. These checks hold that data to `paymentReference` — the one builder the browser, the
 * collection service and the buyer's checkout all read — so the file and the builder can never
 * drift, and hold the uniqueness the allocator depends on inside each workspace. */
const referenceCheck = (scope, state) => {
  const invoiceOf = id => state.invoices.find(row => row.id === id);
  for (const receipt of state.receipts) {
    const invoice = invoiceOf(receipt.invoiceId);
    assert.ok(invoice, `${scope}: every seeded receipt belongs to an invoice`);
    assert.equal(receipt.reference, model.paymentReference(invoice), `${scope}: the seeded reference is its document's number`);
    assert.match(receipt.reference, /^F001-\d{8}$/, `${scope}: a seeded invoice pays under its own series and counter`);
  }
  const references = state.receipts.map(receipt => receipt.reference);
  assert.equal(new Set(references).size, references.length, `${scope}: one reference allocates once inside a workspace`);
  assert.ok(state.invoices.every(invoice => !model.paymentReference(invoice).startsWith('CEDAR-')), `${scope}: no reference is a codename`);
  assert.equal(new Set(state.invoices.map(model.paymentReference)).size, state.invoices.length, `${scope}: each document has its own number`);
};

for (const [scope, cast] of Object.entries(CASTS)) test(`${scope}: every seeded reference is its own document's number`, () => {
  const sales = buildSales(cedarCast(cast), dayForSector(scope));
  const result = seed.seedMoney(model.emptyMoney(scope), sales, 'https://example.invalid/cedar');
  assert.equal(result.ok, true, result.error);
  referenceCheck(scope, result.state);
});

test('a synthetic book seeds the same references as the fish book states', () => {
  const scope = 'fish';
  const seeds = seed.moneySeeds(scope);
  const sales = seeds.map((row, index) => ({
    id: row.saleId, number: `1409-${String(index + 1).padStart(3, '0')}`, day: row.sourceDay, state: 'committed',
    customer: { id: row.customerId, name: `Synthetic customer ${index + 1}` }, figure: 10 + index,
    lines: [{ id: `${row.saleId}-line`, product: { name: 'Synthetic line' }, given: 1, price: 10 + index, unit: 'kg' }],
  }));
  const result = seed.seedMoney(model.emptyMoney(scope), sales, 'https://example.invalid/cedar');
  assert.equal(result.ok, true, result.error);
  referenceCheck('synthetic', result.state);
  assert.deepEqual(result.state.invoices.map(model.paymentReference), seeds.map(row => row.reference),
    'the synthetic book produces exactly the numbers the fixture states');
});

test('an untouched twenty-four-order ledger migrates once; authored evidence stays retained', () => {
  const scope='fish', sales=buildSales(cedarCast(CASTS.fish),dayForSector(scope));
  const full=seed.seedMoney(model.emptyMoney(scope),sales,'https://sample.invalid').state;
  const invoices=full.invoices.slice(0,24), ids=new Set(invoices.map(row=>row.id));
  const {fixtureRevision: _revision,fixtureSignature: _signature,...old}=full;
  Object.assign(old,{invoices,requests:full.requests.filter(row=>ids.has(row.invoiceId)),
    receipts:full.receipts.filter(row=>ids.has(row.invoiceId)),events:full.events.filter(row=>ids.has(row.invoiceId))});
  const migrated=seed.seedMoney(old,sales,'https://sample.invalid');
  assert.equal(migrated.ok,true,migrated.error);
  assert.equal(migrated.state.fixtureRevision,2);
  assert.equal(migrated.state.invoices.length,full.invoices.length);
  assert.equal(seed.seedMoney(migrated.state,sales,'https://sample.invalid').state,migrated.state);
  const authored={...old,requests:old.requests.map((row,index)=>index===0?{...row,copiedAt:'2026-09-14T12:00:00Z'}:row)};
  assert.equal(seed.seedMoney(authored,sales,'https://sample.invalid').state,authored);
});

test('each collectible priced order owns a fixture link while hydration preserves pristine identity',()=>{
  const sales=buildSales(cedarCast(CASTS.fish),dayForSector('fish'));
  const made=seed.seedMoney(model.emptyMoney('fish'),sales,'https://example.invalid');
  assert.equal(made.ok,true,made.error);
  for(const sale of sales.filter(row=>['made','scheduled','sent','delivered','disputed','settled'].includes(row.state)&&!row.archived&&!row.messageOnly&&row.figure>0)) {
    const invoice=model.invoiceForSale(made.state,sale.id);
    assert.ok(invoice,`order ${sale.id} has its payment document`);
    assert.ok(model.requestForInvoice(made.state,invoice.id));
  }
  assert.equal(seed.isUntouchedMoneyFixture(made.state),true);
  const hydrated={...made.state,requests:made.state.requests.map(row=>({...row,url:'https://collections.example/collect/real/token',remoteId:'native',commercialFingerprint:'a'.repeat(64),paymentQuote:{id:'quote-one',amountMinor:row.amountMinor+1,principalMinor:row.amountMinor,roundingMinor:1,status:'ready'}}))};
  assert.equal(seed.isUntouchedMoneyFixture(hydrated),true,'native registration is fixture activity');
  const authored={...hydrated,requests:hydrated.requests.map((row,index)=>index===0?{...row,copiedAt:new Date().toISOString()}:row)};
  assert.equal(seed.isUntouchedMoneyFixture(authored),false,'a merchant copy retains its own calendar');
});
