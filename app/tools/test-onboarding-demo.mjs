import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const { prepareCompletedDemo } = loadTypeScript('src/prototypes/cedar/demo-welcome.tsx', 'onboarding-demo-test');
const { newOnboarding } = loadTypeScript('src/prototypes/cedar/onboarding-model.ts', 'onboarding-demo-model-test');
const records = new Map();
globalThis.localStorage = { getItem:key => records.get(key) ?? null, setItem:(key,value) => records.set(key,value), removeItem:key => records.delete(key) };
globalThis.window = Object.assign(new EventTarget(), { localStorage:globalThis.localStorage, location:{ hostname:'localhost' } });

test('completed demo prepares the same sample workspace and preserves its existing ledger', () => {
  const changed=[];
  records.set('rocoto-workspace-capabilities:fish', JSON.stringify({version:1,pricing:false,inventory:true}));
  window.addEventListener('rocoto:cedar-onboarding-changed',event=>changed.push(event.detail),{once:true});
  const onboarding = newOnboarding('fish', { businessName:'Existing business',address:'Saved Peru address',ruc:'20123456789' });
  const invoices = [{ id:'existing-invoice' }], receipts = [{ id:'existing-receipt' }];
  const state = { setup:{ sellerName:'Saved seller',ruc:'20123456789',bank:'interbank',bankAccountLabel:'Saved account' }, invoices,receipts };
  let configuration;
  const money = { state,ensureExamples:() => ({ok:true,state}),updateSetup:patch => { state.setup = {...state.setup,...patch}; return {ok:true,state}; } };
  const result = prepareCompletedDemo({scope:'fish',sales:[],money,onboarding,setConfig:patch => {configuration=patch;return true;} });
  assert.equal(result.ok,true);
  assert.equal(configuration.stock.mode,'none');
  assert.equal(configuration.albaran.values,'valued');
  assert.deepEqual(JSON.parse(records.get('rocoto-workspace-capabilities:fish')), {
    version:1,pricing:true,inventory:false,money:true,country:'peru',moneyByCountry:{peru:true,spain:false},
  });
  assert.equal(state.setup.bank,'interbank');
  assert.equal(state.setup.bankAccountLabel,'Saved account');
  assert.equal(state.setup.sellerName,'Saved seller');
  assert.equal('payments' in state.setup, false, 'Open workspace prepares data, never a connection posture');
  assert.equal(state.invoices,invoices);assert.equal(state.receipts,receipts);
  const completed=JSON.parse(records.get('rocoto-cedar-onboarding-v1:fish'));
  assert.equal(completed.workspacePrepared,true);assert.equal(completed.step,'complete');
  assert.deepEqual(changed,[{scope:'fish'}]);
  const again=prepareCompletedDemo({scope:'fish',sales:[],money:{...money,updateSetup:() => {throw new Error('Already completed');}},onboarding:completed,setConfig:() => {throw new Error('Preserve existing choices');} });
  assert.equal(again.ok,true);
  const replay=prepareCompletedDemo({scope:'fish',sales:[],money:{...money,updateSetup:() => {throw new Error('Preserve existing provider choices');}},
    onboarding:{...completed,step:'name',channels:[],catalogue:'pending'},setConfig:() => {throw new Error('Preserve settings during replay');} });
  assert.equal(replay.ok,true);
  assert.equal(JSON.parse(records.get('rocoto-cedar-onboarding-v1:fish')).step,'complete');
});

test('a failed seed or setting write keeps completion pending', () => {
  const onboarding = newOnboarding('meat',{businessName:'Meat',address:'Peru'});
  const money={state:{setup:{}},ensureExamples:()=>({ok:false,error:'Restore sample sales.'}),updateSetup:()=>{throw new Error('Seed must succeed first');}};
  assert.equal(prepareCompletedDemo({scope:'meat',sales:[],money,onboarding,setConfig:()=>{throw new Error('Seed must succeed first');}}).ok,false);
  assert.equal(prepareCompletedDemo({scope:'meat',sales:[],money:{...money,ensureExamples:()=>({ok:true})},onboarding,setConfig:()=>false}).ok,false);
  assert.equal(records.has('rocoto-cedar-onboarding-v1:meat'),false);
});
