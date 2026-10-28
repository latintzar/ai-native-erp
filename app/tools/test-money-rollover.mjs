import assert from 'node:assert/strict';
import {test,beforeEach} from 'node:test';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {compileTypeScript} from './ts-module.mjs';
const records=new Map();
globalThis.localStorage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
globalThis.location=new URL('https://demo.soyrocoto.com/cedar/');
globalThis.window=Object.assign(new EventTarget(),{location,localStorage,setTimeout,clearTimeout});
const require=createRequire(import.meta.url),path=compileTypeScript('src/prototypes/cedar/money-store.ts','money-rollover-test');
const store=require(path),api=require(join(dirname(path),'money-api.js')),seed=require(join(dirname(path),'money-seed.js'));
const model=require(join(dirname(path),'money-model.js')),clock=require(join(dirname(path),'scenario-clock.js'));
const event=(name,detail)=>{const e=new Event(name);Object.defineProperty(e,'detail',{value:detail});window.dispatchEvent(e);};
const actions=()=>store.moneyActions('fish');
beforeEach(()=>{
  records.clear();event('rocoto:cedar-workspace-reset',{scope:'fish'});
  const made=model.createOrderPaymentDocument({...model.emptyMoney('fish'),setup:{...model.emptyMoney('fish').setup,sellerName:'Seller'}},{id:'s1',number:'DN1',day:'2026-01-01',state:'made',customer:{id:'c1',name:'Customer'},figure:100,lines:[{id:'l1',product:{name:'Fish'},given:10,price:10,unit:'kg'}]},'2026-01-01T12:00:00Z',location.origin);
  assert.equal(made.ok,true,made.error);
  const state={...made.state,examplesLoaded:true,fixtureDay:'2026-01-01',fixtureRevision:2};
  state.fixtureSignature=seed.moneyFixtureSignature(state);
  localStorage.setItem(store.moneyStorageKey('fish'),JSON.stringify(state));
  event('rocoto:cedar-workspace-reset',{scope:'fish'});
  api.hasCollectionWorkspace=()=>true;
  seed.seedMoney=state=>({ok:true,value:undefined,state:{...state,fixtureDay:clock.cedarTodayId()}});
});

test('one calendar handshake fences a concurrent hold and releases the next edit after success',async()=>{
  let finish,calls=0;api.rolloverCollectionFixture=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const invoice=store.moneyStateNow('fish').invoices[0];
  const first=actions().prepareExamples([]),second=actions().prepareExamples([]);
  assert.equal(calls,1,'duplicate preparations share the same native handshake');
  assert.equal(actions().holdPayment(invoice.id,'manual').ok,false,'the retained ledger remains pristine during native rotation');
  finish();assert.equal((await first).ok,true);assert.equal((await second).ok,true);
  assert.equal(store.moneyStateNow('fish').fixtureDay,clock.cedarTodayId());
  assert.equal(actions().holdPayment(invoice.id,'manual').ok,true);
});

test('a rejected calendar handshake releases edits and preserves an authored hold',async()=>{
  api.rolloverCollectionFixture=async()=>{throw new Error('Retain the existing workspace.');};
  assert.equal((await actions().prepareExamples([])).ok,false);
  const invoice=store.moneyStateNow('fish').invoices[0];
  assert.equal(actions().holdPayment(invoice.id,'manual').ok,true);
  let calls=0;api.rolloverCollectionFixture=async()=>{calls++;};
  assert.equal((await actions().prepareExamples([])).ok,true);
  assert.equal(calls,0);assert.equal(store.moneyStateNow('fish').invoices[0].collectionHold,'manual');
});

test('reset cancels the prior calendar preparation and releases its lock',async()=>{
  let finish;api.rolloverCollectionFixture=()=>new Promise(resolve=>{finish=resolve;});
  const pending=actions().prepareExamples([]);
  localStorage.removeItem(store.moneyStorageKey('fish'));event('rocoto:cedar-workspace-reset',{scope:'fish'});
  finish();assert.equal((await pending).ok,false);
  assert.equal(store.moneyStateNow('fish').invoices.length,0);
  assert.equal(actions().updateSetup({sellerName:'New seller'}).ok,true);
});
