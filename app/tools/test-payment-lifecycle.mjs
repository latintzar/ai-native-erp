import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadTypeScript} from './ts-module.mjs';
const p=loadTypeScript('src/prototypes/cedar/payment-lifecycle.ts','payment-lifecycle');
const invoice={id:'i',customerId:'c',amountMinor:10000,collectionOnly:true};
const state={setup:{},requests:[],receipts:[],invoices:[invoice]};
const sale={state:'delivered',day:'2026-09-15',figure:100,stamps:{deliver:'12:40'}};

test('delivery timing uses the Peru calendar and starts only on actual delivery',()=>{
  assert.equal(p.paymentDispatchAt({...sale,state:'sent',stamps:{}},'delivery'),null);
  assert.equal(p.paymentDispatchAt(sale,'delivery'),'2026-09-15T17:40:00.000Z');
  assert.equal(p.paymentDispatchAt(sale,'evening'),'2026-09-15T23:00:00.000Z');
  assert.equal(p.paymentDispatchAt(sale,'next-morning'),'2026-09-16T13:00:00.000Z');
  assert.equal(p.paymentDispatchAt({...sale,stamps:{deliver:'20:00'}},'evening'),'2026-09-16T01:00:00.000Z');
});

test('each exception holds automatic sending and names its reason',()=>{
  assert.equal(p.paymentHoldOf(state,invoice,sale),null);
  assert.equal(p.paymentHoldOf(state,invoice,{...sale,state:'disputed'}),'disputed');
  assert.equal(p.paymentHoldOf(state,invoice,{...sale,prep:{stale:true}}),'changed-after-loading');
  assert.equal(p.paymentHoldOf(state,{...invoice,collectionHold:'partial-return'},sale),'partial-return');
  assert.equal(p.paymentHoldOf({...state,setup:{monthlyCustomerIds:['c']}},invoice,sale),'monthly-billing');
  assert.equal(p.paymentHoldOf(state,{...invoice,collectionHold:'manual'},sale),'manual');
});

test('initial contact owns the 24, 48 and 72 hour reminder ladder',()=>{
  const sent='2026-09-15T17:40:00.000Z';
  assert.equal(p.paymentReminderAt(undefined,0),null);
  assert.equal(p.paymentReminderAt(sent,0),'2026-09-16T17:40:00.000Z');
  assert.equal(p.paymentReminderAt(sent,1),'2026-09-17T17:40:00.000Z');
  assert.equal(p.paymentReminderAt(sent,2),'2026-09-18T17:40:00.000Z');
  assert.equal(p.paymentReminderAt(sent,3),null);
});

test('reviewed sending releases this exact held order and a later goods change holds it again',()=>{
  const held={...invoice,collectionHold:'partial-return'};
  const reviewed={...held,collectionRelease:{reason:'partial-return',revision:p.paymentRevisionOf(sale,held)}};
  assert.equal(p.paymentHoldOf(state,reviewed,sale),null);
  assert.equal(p.paymentHoldOf(state,reviewed,{...sale,figure:90}),'partial-return');
});

test('an authored delivery uses its recorded wall clock for the contact policy',()=>{
  const actual={...sale,day:'2026-09-14',stamps:{deliver:'12:40',deliveredAt:'2026-09-15T03:15:00.000Z'}};
  assert.equal(p.paymentDispatchAt(actual,'delivery'),'2026-09-15T03:15:00.000Z');
  assert.equal(p.paymentDispatchAt(actual,'next-morning'),'2026-09-15T13:00:00.000Z');
});
