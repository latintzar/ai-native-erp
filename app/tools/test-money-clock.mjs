import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {compileTypeScript} from './ts-module.mjs';
const require=createRequire(import.meta.url);
const entry=compileTypeScript('src/prototypes/cedar/money-projections.ts',`money-retained-clock-${process.pid}`);
const projections=require(entry),seed=require(join(dirname(entry),'money-seed.js')),model=require(join(dirname(entry),'money-model.js'));
test('a retained book keeps its calendar in the projection and the dossier clock',()=>{
 const state={...model.emptyMoney('fish'),fixtureDay:'2026-09-07',fixtureRevision:2,events:[{}]};
 const time=seed.moneyWorkspace('fish').referenceAt.slice(10);
 assert.equal(seed.moneyNow(state),new Date(Date.parse(`2026-09-07${time}`)+1000).toISOString());
 const projected=projections.projectMoney(state,[]);
 assert.equal(projected.dailyHistory.at(-1).at,'2026-09-07');
 assert.equal(projected.forecast[0].at,'2026-09-08');
});

test('actual receipt arrivals advance a retained book and land on their bank day',()=>{
 const receipt={id:'arrival',invoiceId:'i1',amountMinor:12000,currency:'PEN',method:'yape',source:'demo-bank',
  status:'matched',reference:'ARRIVAL-1',at:'2026-09-01T12:00:00Z',receivedAt:'2026-09-15T18:00:00Z'};
 const state={...model.emptyMoney('fish'),fixtureDay:'2026-09-07',fixtureRevision:2,receipts:[receipt],events:[{}]};
 assert.ok(Date.parse(seed.moneyNow(state))>=Date.parse(receipt.receivedAt),'the ledger includes the recorded arrival');
 const projected=projections.projectMoney(state,[]);
 assert.equal(projected.dailyHistory.at(-1).at,'2026-09-15');
 assert.equal(projected.dailyHistory.at(-1).amountMinor,12000,'the later receipt belongs to its actual day');
 assert.equal(projected.dailyHistory.find(row=>row.at==='2026-09-01').amountMinor,0,'its original request clock remains provenance');
 assert.equal(projected.bankBalanceMinor,projected.openingBalanceMinor+12000);
});

test('bank booking dates stay authoritative and later arrivals keep early-pay evidence honest',()=>{
 const {earlyPayShareOf}=require(compileTypeScript('src/prototypes/cedar/campaigns.ts',`money-campaign-clock-${process.pid}`));
 const at='2026-09-01T12:00:00Z',receivedAt='2026-09-15T18:00:00Z';
 const input={invoices:[{id:'i1',issuedAt:at,amountMinor:12000}],requests:[{invoiceId:'i1',sentAt:at}],asOf:receivedAt,
  receipts:[{invoiceId:'i1',amountMinor:12000,status:'matched',source:'demo-bank',at,receivedAt}]};
 assert.equal(earlyPayShareOf(input).settled,0,'a two-week collection does not count as an early payment');
 assert.equal(earlyPayShareOf({...input,receipts:[{...input.receipts[0],source:'prometeo'}]}).settled,1,
  'verified booking time remains authoritative even when the service retrieves it later');
});
