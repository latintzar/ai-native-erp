import assert from 'node:assert/strict';
import {test,beforeEach,afterEach,mock} from 'node:test';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {compileTypeScript} from './ts-module.mjs';

const records=new Map();
globalThis.localStorage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
globalThis.location=new URL('https://demo.soyrocoto.com/cedar/');
globalThis.window=Object.assign(new EventTarget(),{location,localStorage,setTimeout,clearTimeout});
const require=createRequire(import.meta.url),path=compileTypeScript('src/prototypes/cedar/money-store.ts','money-store-fiscal-test');
const store=require(path),api=require(join(dirname(path),'money-api.js'));
const model=require(join(dirname(path),'money-model.js'));
const collectionOrigin=api.collectionOrigin;
const sale={id:'s1',number:'DN1',customer:{id:'c1',name:'Customer'},figure:100,lines:[{id:'l1',product:{name:'Tomatoes'},given:10,price:10,unit:'kg'}]};
const options={customerRuc:'20123456789',customerAddress:'Av. Peru 123, Lima',fxRate:3.9,taxRate:18,dueAt:'2026-10-10'};
const awaiting={phase:'awaiting-authorization',mode:null,payment_requirement:'confirmed',can_issue:false,can_query:false};
const base={id:'remote-one',buyer_url:'https://copper-demo.soyrocoto.com/collect/remote-one/capability',amount_minor:10000,currency:'PEN',status:'pending',balance_minor:10000,confirmed_minor:0,manual_minor:0,sample_minor:0,receipts:[],fiscal:awaiting};
const paid={...base,status:'paid',amount_minor:0,balance_minor:0,confirmed_minor:10000,receipts:[{id:'bank-one',amount_minor:10000,currency:'PEN',reference:'prometeo-one',method:'transfer',source:'prometeo',status:'matched',created_at:'2026-09-10T12:00:00Z'}],
  fiscal:{...awaiting,phase:'authorized',mode:'live',record_id:'fiscal-one',series:'F001',number:45,can_issue:true}};
const actions=()=>store.moneyActions('fish');
const ok=result=>{assert.equal(result.ok,true,result.error);return result.value;};
beforeEach(()=>{
  mock.timers.enable({apis:['Date'],now:new Date('2026-09-10T12:00:00Z')});
  api.collectionOrigin=collectionOrigin;
  api.resetCollectionWorkspace('fish');records.clear();const event=new Event('storage');Object.defineProperty(event,'key',{value:store.moneyStorageKey('fish')});window.dispatchEvent(event);
  actions().updateSetup({sellerName:'Seller',ruc:'20123456789',payments:'demo-connected'});
  api.createCollection=async()=>base;api.readCollection=async()=>paid;
});
afterEach(()=>mock.timers.reset());

test('bank-confirmed payment preserves draft status; single fiscal submission recovers by query into accepted provider identity',async()=>{
  const draft=ok(actions().createBillingDraft(sale,options));
  ok(await actions().createRequest(draft.id));ok(await actions().refreshRequest(draft.id));
  assert.equal(store.moneyStateNow('fish').invoices[0].status,'draft');
  assert.equal(store.moneyStateNow('fish').receipts[0].source,'prometeo');
  let resolve,count=0;api.submitCollectionInvoice=()=>{count++;return new Promise(done=>{resolve=done;});};
  const first=actions().submitInvoice(draft.id),second=actions().submitInvoice(draft.id);assert.equal(first,second);assert.equal(count,1);
  resolve({...paid,fiscal:{...paid.fiscal,phase:'query-required',can_issue:false,can_query:true}});ok(await first);
  assert.equal(store.moneyStateNow('fish').invoices[0].fiscal.phase,'query-required');
  api.submitCollectionInvoice=async(_scope,_id,query)=>{assert.equal(query,true);return {...paid,fiscal:{...paid.fiscal,phase:'accepted',can_issue:false,can_query:false,accepted_by_sunat:true,issue_date:'2026-09-10'}};};
  ok(await actions().submitInvoice(draft.id,true));
  const invoice=store.moneyStateNow('fish').invoices[0];assert.equal(invoice.fiscal.phase,'accepted');assert.equal(invoice.amountMinor,10000);assert.equal(invoice.status,'draft');
});

test('reset during a private refresh prevents old receipts and fiscal state from being imported',async()=>{
  const draft=ok(actions().createBillingDraft(sale,options));ok(await actions().createRequest(draft.id));
  let finish;api.readCollection=()=>new Promise(resolve=>{finish=resolve;});
  const pending=actions().refreshRequest(draft.id);
  api.resetCollectionWorkspace('fish');finish(paid);
  const result=await pending;assert.equal(result.ok,false);
  const state=store.moneyStateNow('fish');assert.equal(state.receipts.length,0);assert.equal(state.invoices[0].fiscal,undefined);assert.equal(state.requests[0].remoteId,undefined);
});

test('the server quote and receipt rounding survive import, repeat refresh and browser reload',async()=>{
  api.createCollection=async()=>({...base,amount_minor:10003,rounding_minor:3,quote_id:'quote-one',quote_status:'ready',rounding_received_minor:0});
  const draft=ok(actions().createBillingDraft(sale,options));
  const linked=ok(await actions().createRequest(draft.id));
  assert.deepEqual(linked.paymentQuote,{id:'quote-one',amountMinor:10003,principalMinor:10000,roundingMinor:3,status:'ready'});
  api.readCollection=async()=>({...paid,quote_id:null,quote_status:'paid',rounding_minor:0,rounding_received_minor:3,
    receipts:[{...paid.receipts[0],amount_minor:10003,rounding_minor:3}]});
  ok(await actions().refreshRequest(draft.id));
  ok(await actions().refreshRequest(draft.id));
  let state=store.moneyStateNow('fish');
  assert.equal(state.invoices[0].amountMinor,10000);
  assert.equal(state.receipts.length,1);
  assert.deepEqual([state.receipts[0].amountMinor,state.receipts[0].roundingMinor],[10003,3]);
  const event=new Event('storage');Object.defineProperty(event,'key',{value:store.moneyStorageKey('fish')});window.dispatchEvent(event);
  state=store.moneyStateNow('fish');
  assert.equal(state.receipts[0].roundingMinor,3);
  assert.equal(state.requests[0].paymentQuote.status,'paid');
});

const reloadMoney=()=>{
  const event=new Event('storage');Object.defineProperty(event,'key',{value:store.moneyStorageKey('fish')});window.dispatchEvent(event);
};

test('sample import keeps actual arrival for a preceding reminder across reload and repeated polls',async()=>{
  actions().updateSetup({invoicing:'demo-connected'});
  const invoice=ok(actions().issueInvoice(sale,options));
  const ledgerAt='2026-09-15T14:45:01.000Z',chasedAt='2026-09-15T19:00:00.000Z',receivedAt='2026-09-15T19:01:00.000Z';
  const remote={...base,status:'paid',balance_minor:0,sample_minor:10000,receipts:[{id:'sample-one',amount_minor:10000,
    currency:'PEN',reference:'sample-one',method:'yape',source:'sample',status:'matched',created_at:ledgerAt,received_at:receivedAt}]};
  api.readCollection=async()=>remote;
  ok(await actions().createRequest(invoice.id));ok(await actions().refreshRequest(invoice.id));
  let receipt=store.moneyStateNow('fish').receipts[0];
  assert.equal(receipt.at,ledgerAt);
  assert.equal(receipt.receivedAt,receivedAt,'arrival comes from the service receipt');
  assert.ok(Date.parse(receipt.at)<Date.parse(chasedAt));
  assert.ok(Date.parse(model.receiptEffectiveAt(receipt))>Date.parse(chasedAt),'the actual preceding reminder remains eligible');
  const events=store.moneyStateNow('fish').events.length;
  reloadMoney();
  receipt=store.moneyStateNow('fish').receipts[0];
  assert.equal(receipt.receivedAt,receivedAt,'arrival survives persisted-state validation');
  api.readCollection=async()=>({...remote,receipts:[{...remote.receipts[0],received_at:'2026-09-16T20:00:00.000Z'}]});
  ok(await actions().refreshRequest(invoice.id));
  assert.equal(store.moneyStateNow('fish').receipts.length,1);
  assert.equal(store.moneyStateNow('fish').events.length,events);
  assert.equal(store.moneyStateNow('fish').receipts[0].receivedAt,receivedAt,'repeated imports preserve the original arrival');
});

test('opening and legacy receipts keep their original evidence when the service echoes them',async()=>{
  const invoice=ok(actions().createBillingDraft(sale,options));
  const saved=model.recordReceipt(store.moneyStateNow('fish'),{invoiceId:invoice.id,amountMinor:1000,currency:'PEN',
    reference:'opening-one',method:'yape',source:'demo-bank'},'2026-09-14T14:45:00.000Z');
  ok(saved);localStorage.setItem(store.moneyStorageKey('fish'),JSON.stringify(saved.state));reloadMoney();
  const echoed={...base,status:'partial',balance_minor:8000,sample_minor:2000,receipts:[
    {id:'opening-one',amount_minor:1000,currency:'PEN',reference:'opening-one',method:'yape',source:'sample',status:'matched',
      created_at:'2026-09-14T14:45:00.000Z',received_at:'2026-09-15T19:01:00.000Z'},
    {id:'legacy-one',amount_minor:1000,currency:'PEN',reference:'legacy-one',method:'yape',source:'sample',status:'matched',
      created_at:'2026-09-14T15:45:00.000Z'},
  ]};
  api.createCollection=async()=>echoed;
  ok(await actions().createRequest(invoice.id));
  const receipts=store.moneyStateNow('fish').receipts;
  assert.equal(receipts[0].receivedAt,undefined,'upload time adds no new arrival to an opening receipt');
  assert.equal(receipts[1].receivedAt,undefined,'legacy responses retain their own recorded time');
  assert.equal(model.receiptEffectiveAt(receipts[0]),saved.value.at);
});

test('a local manual receipt records its wall-clock arrival alongside the sample ledger instant',async()=>{
  api.collectionOrigin=()=>null;
  actions().updateSetup({invoicing:'demo-connected'});
  const invoice=ok(actions().issueInvoice(sale,options));
  const before=Date.now();
  ok(await actions().recordReceipt({invoiceId:invoice.id,amountMinor:1000,currency:'PEN',reference:'local-one',method:'cash',source:'manual'}));
  const after=Date.now(),receipt=store.moneyStateNow('fish').receipts[0];
  assert.ok(Date.parse(receipt.receivedAt)>=before&&Date.parse(receipt.receivedAt)<=after,'local arrival comes from the save action');
  assert.equal(receipt.at.slice(0,10),invoice.issuedAt.slice(0,10),'the ledger keeps its sample calendar');
});

test('automatic order links reserve once and fiscal attachment commits only after native review',async()=>{
  api.readCollection=async()=>base;
  let created=0;api.createCollection=async()=>{created++;return {...base,commercial_fingerprint:'a'.repeat(64),fiscal:{...awaiting,phase:'unprepared'}};};
  const order={...sale,state:'made',day:'2026-09-15'};
  const [a,b]=await Promise.all([actions().ensureOrderPayment(order),actions().ensureOrderPayment(order)]);
  ok(a);ok(b);assert.equal(created,1);
  const invoice=store.moneyStateNow('fish').invoices[0];
  assert.equal(invoice.collectionOnly,true);
  assert.equal(store.moneyStateNow('fish').requests[0].commercialFingerprint,'a'.repeat(64));
  api.prepareCollectionFiscal=async()=>{throw new Error('Review failed');};
  assert.equal((await actions().prepareOrderFiscal(invoice.id,options)).ok,false);
  assert.equal(store.moneyStateNow('fish').invoices[0].collectionOnly,true);
  api.prepareCollectionFiscal=async()=>base;
  ok(await actions().prepareOrderFiscal(invoice.id,options));
  assert.equal(store.moneyStateNow('fish').invoices[0].collectionOnly,false);
  assert.equal(store.moneyStateNow('fish').requests.length,1);
});

test('a partial collection poll updates the canonical link amount automatically',async()=>{
  const draft=ok(actions().createBillingDraft(sale,options));
  ok(await actions().createRequest(draft.id));
  const partial={...base,status:'partial',balance_minor:6000,amount_minor:6000,sample_minor:4000,receipts:[{
    id:'payment-partial',amount_minor:4000,currency:'PEN',reference:'payment-partial',method:'yape',source:'sample',status:'matched',created_at:'2026-09-15T12:00:00Z'}]};
  api.readCollection=async()=>partial;
  const id=store.moneyStateNow('fish').requests[0].id;
  ok(await actions().refreshRequest(draft.id));
  assert.equal(store.moneyStateNow('fish').requests[0].amountMinor,6000);
  assert.equal(store.moneyStateNow('fish').requests[0].id,id);
});

test('commercial revisions finish before fiscal attachment reads its final snapshot',async()=>{
  const remote={...base,commercial_fingerprint:'a'.repeat(64),fiscal:{...awaiting,phase:'unprepared'}};
  api.createCollection=async()=>remote;api.readCollection=async()=>remote;
  const order={...sale,state:'made',day:'2026-09-15'};
  ok(await actions().ensureOrderPayment(order));
  const invoice=store.moneyStateNow('fish').invoices[0];
  let release,attached=false;
  api.reviseCollectionOrder=()=>new Promise(done=>{release=()=>done({...remote,balance_minor:12000,commercial_fingerprint:'b'.repeat(64)});});
  api.prepareCollectionFiscal=async(_scope,_id,prepared)=>{attached=true;assert.equal(prepared.amountMinor,12000);return {...base,balance_minor:12000};};
  const revision=actions().reviseOrderPayment({...order,figure:120,lines:[{...order.lines[0],price:12}]});
  await new Promise(done=>setTimeout(done,0));
  const fiscal=actions().prepareOrderFiscal(invoice.id,options);
  await new Promise(done=>setTimeout(done,0));
  assert.equal(attached,false,'fiscal snapshot waits for the pending commercial revision');
  release();ok(await revision);ok(await fiscal);
  assert.equal(store.moneyStateNow('fish').invoices[0].collectionOnly,false);
  assert.equal(store.moneyStateNow('fish').invoices[0].amountMinor,12000);
});
