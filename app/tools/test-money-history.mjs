import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript } from './ts-module.mjs';

const require = createRequire(import.meta.url);
const entry = compileTypeScript('src/prototypes/cedar/sale.ts', 'money-history-test');
const root = dirname(entry);
const { buildSales } = require(entry);
const { cedarCast } = require(join(root, 'cedar-cast.js'));
const { dayForSector } = require(join(root, 'day.js'));
const { CASTS } = require(join(root, '../../scenarios/data/cast.js'));
const model = require(join(root, 'money-model.js'));
const seed = require(join(root, 'money-seed.js'));
const projections = require(compileTypeScript('src/prototypes/cedar/money-projections.ts', 'money-history-projections'));

for (const [scope, cast] of Object.entries(CASTS)) test(`${scope}: ninety days reconcile with the sales book`, () => {
  const sales = buildSales(cedarCast(cast), dayForSector(scope));
  const result = seed.seedMoney(model.emptyMoney(scope), sales, 'https://sample.invalid');
  assert.equal(result.ok, true, result.error);
  const state = result.state;
  const dates = [...new Set(state.receipts.map(row => model.peruDate(row.at)))].sort();
  const today = seed.moneyWorkspace(scope).referenceAt.slice(0, 10);
  assert.ok((Date.parse(today)-Date.parse(dates[0])) / 86400000 >= 89, 'receipts span at least ninety calendar days');
  assert.ok(dates.length > 70, 'takings stand on their own delivery and payment dates');
  const partial = state.invoices.filter(row => model.invoiceBalance(state, row.id) > 0 && model.invoiceBalance(state, row.id) < row.amountMinor);
  const late = state.invoices.filter(row => model.invoiceOverdueDays(state, row.id, seed.moneyNow(state)) >= 5);
  assert.ok(partial.length / state.invoices.length >= .07 && partial.length / state.invoices.length <= .13, 'about a tenth are part paid');
  assert.ok(late.length / state.invoices.length >= .07 && late.length / state.invoices.length <= .13, 'about a tenth hold aged unpaid balances');
  for (const days of [5, 15, 30]) assert.ok(state.invoices.filter(row => model.invoiceBalance(state,row.id)>0
    && seed.calendarDaysBetween(row.dueAt,today)===days).length>=2, `several orders stand ${days} days overdue`);
  assert.ok(state.invoices.filter(row=>model.invoiceBalance(state,row.id)>0 && row.dueAt===today).length>=2);
  assert.ok(state.invoices.filter(row => row.disputed).length >= 1 && state.invoices.filter(row => row.disputed).length <= 2, 'one or two disputes remain owed');
  assert.equal(new Set(state.receipts.map(row => row.method)).size, 4);
  const view = projections.projectMoney(state, sales);
  const bank = state.receipts.filter(row => row.source === 'demo-bank' && row.method !== 'cash' && row.status === 'matched');
  assert.equal(view.bankBalanceMinor, seed.moneyWorkspace(scope).openingBalanceMinor + bank.reduce((sum,row)=>sum+row.amountMinor,0));
  assert.equal(view.dailyHistory.length, 90);
  assert.ok(new Set(view.dailyHistory.slice(-14).map(row=>row.amountMinor)).size >= 8, 'the fortnight has a varied shape');
  for (const invoice of state.invoices) {
    const sale = sales.find(row=>row.id===invoice.saleId);
    assert.ok(sale, invoice.saleId);
    assert.equal(invoice.amountMinor, Math.round(sale.figure*100));
  }
  assert.equal(model.parseMoney(JSON.parse(JSON.stringify(state)),scope).invoices.length,state.invoices.length);
  assert.ok(JSON.stringify(state).length < 4500000, 'the retained ledger fits browser storage');
});

test('a hand-written ninety-day book conserves each sale, receipt and daily closing balance', () => {
  const today=seed.moneyWorkspace('fish').referenceAt.slice(0,10);
  const day=offset=>new Date(Date.parse(`${today}T12:00:00Z`)+offset*86400000).toISOString().slice(0,10);
  const source=(id,customerId,date,minor,state='committed')=>({id,number:id,day:date,state,
    customer:{id:customerId,name:`Customer ${customerId}`},figure:minor/100,
    lines:[{id:`${id}-line`,product:{name:'Synthetic fish'},given:1,unit:'kg',price:minor/100}]});
  const retained=seed.moneySeeds('fish').map((row,index)=>source(row.saleId,row.customerId,row.sourceDay,10000+index*37));
  const historical=Array.from({length:95},(_,index)=>{
    const age=index+2;
    return source(`d-${age}-written`,'written',day(-age),20000+age*139,[17,31].includes(age)?'disputed':'committed');
  });
  const sales=[...retained,...historical];
  const result=seed.seedMoney(model.emptyMoney('fish'),sales,'https://sample.invalid');
  assert.equal(result.ok,true,result.error);
  assert.equal(result.state.invoices.length,sales.length);
  for(const invoice of result.state.invoices){
    const sale=sales.find(row=>row.id===invoice.saleId);
    assert.equal(invoice.amountMinor,Math.round(sale.figure*100));
    const paid=result.state.receipts.filter(row=>row.invoiceId===invoice.id).reduce((sum,row)=>sum+row.amountMinor,0);
    assert.equal(model.invoiceBalance(result.state,invoice.id)+paid,invoice.amountMinor);
  }
  const projected=projections.projectMoney(result.state,sales);
  const bank=result.state.receipts.filter(row=>row.method!=='cash');
  for(const point of projected.dailyHistory){
    assert.equal(point.amountMinor,bank.filter(row=>model.peruDate(row.at)===point.at).reduce((sum,row)=>sum+row.amountMinor,0));
  }
  assert.equal(projected.bankBalanceMinor,500000+bank.reduce((sum,row)=>sum+row.amountMinor,0));
  assert.equal(result.state.invoices.filter(row=>row.disputed && model.invoiceBalance(result.state,row.id)===row.amountMinor).length,2);
});
