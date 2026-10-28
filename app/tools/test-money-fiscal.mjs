import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const m = loadTypeScript('src/prototypes/cedar/money-model.ts', 'money-fiscal-test');
const at = '2026-09-09T12:00:00Z';
const sale = { id:'sale-1',number:'DN-1',customer:{id:'c1',name:'Customer'},figure:100,
  lines:[{id:'l1',product:{name:'Tomatoes'},given:10,price:10,unit:'kg'}] };
const options = {customerRuc:'20123456789',customerAddress:'Av. Peru 123, Lima',fxRate:3.9,taxRate:18,dueAt:'2026-09-30'};
const state = () => ({...m.emptyMoney('fish'),setup:{...m.emptyMoney('fish').setup,sellerName:'Seller',ruc:'20123456789',payments:'demo-connected'}});
const ok = result => {assert.equal(result.ok,true,result.error);return result;};

test('a reviewed PEN billing draft collects before fiscal acceptance and freezes its sale', () => {
  const draft = ok(m.createBillingDraft(state(),sale,options,at));
  assert.equal(draft.value.origin,'cedar');assert.equal(draft.value.status,'draft');
  assert.equal(draft.value.sourceCurrency,'PEN');assert.equal(draft.value.fxRate,1);assert.equal(draft.value.amountMinor,10000);
  assert.equal(draft.value.fiscal,undefined);assert.match(draft.value.number,/^PAY-/);
  const request = ok(m.createRequest(draft.state,draft.value.id,at,'https://example.test/cedar/'));
  const paid = ok(m.recordReceipt(request.state,{invoiceId:draft.value.id,amountMinor:10000,currency:'PEN',source:'prometeo',reference:'bank-1',method:'transfer'},at));
  assert.equal(m.invoiceBalance(paid.state,draft.value.id),0);
  assert.equal(paid.state.invoices[0].status,'draft');
  assert.equal(paid.state.invoices[0].fiscal,undefined);
  const again = ok(m.createBillingDraft(paid.state,{...sale,figure:200},options,at));
  assert.equal(again.value.amountMinor,10000);
  assert.deepEqual(m.parseMoney(JSON.parse(JSON.stringify(paid.state)),'fish'),paid.state);
});

test('fiscal evidence remains separate and provider identity replaces the displayed reference only after acceptance', () => {
  const draft = ok(m.createBillingDraft(state(),sale,options,at)).value;
  const pending = {phase:'query-required',mode:'live',record_id:'record-1',series:'F001',number:45,payment_requirement:'confirmed',can_issue:false,can_query:true};
  assert.equal(m.documentNumber({...draft,fiscal:pending}),draft.number);
  assert.equal(m.documentNumber({...draft,fiscal:{...pending,phase:'accepted',can_query:false}}),'F001-00000045');
  assert.equal(m.isCollectible({...draft,fiscal:{...pending,phase:'pending'}}),true);
});

test('persisted fiscal projections validate mode, identity and permissions', () => {
  const draft = ok(m.createBillingDraft(state(),sale,options,at));
  const fiscal = {phase:'accepted',mode:'live',record_id:'record-1',series:'F001',number:45,payment_requirement:'confirmed',can_issue:false,can_query:false};
  const withFiscal = {...draft.state,invoices:[{...draft.value,fiscal}]};
  assert.equal(m.parseMoney(withFiscal,'fish').invoices[0]?.fiscal.phase,'accepted');
  for (const changed of [{...fiscal,mode:'fake'},{...fiscal,number:-1},{...fiscal,can_issue:'yes'}]) {
    assert.equal(m.parseMoney({...withFiscal,invoices:[{...draft.value,fiscal:changed}]},'fish').invoices.length,0);
  }
});

test('a new draft freezes canonical PEN source minor units',()=>{
  const precise={...sale,figure:1.234,lines:[{...sale.lines[0],given:1,price:1.234}]};
  const draft=ok(m.createBillingDraft(state(),precise,options,at)).value;
  assert.equal(draft.sourceTotal,1.23);assert.equal(draft.amountMinor,123);
  const half={...sale,figure:0.05,lines:[{...sale.lines[0],given:1,price:0.05}]};
  assert.equal(ok(m.createBillingDraft(state(),half,{...options,fxRate:2.3},at)).value.amountMinor,5);
});

test('unfulfilled lines are omitted and rejected source quantities stay editable before freezing',()=>{
  const unfilled={...sale.lines[0],id:'unfilled',given:0};
  const draft=ok(m.createBillingDraft(state(),{...sale,lines:[...sale.lines,unfilled]},options,at));
  assert.deepEqual(draft.value.lines.map(row=>row.id),['l1']);
  const current=state();
  assert.equal(m.createBillingDraft(current,{...sale,lines:[{...sale.lines[0],given:-1}]},options,at).ok,false);
  assert.equal(current.invoices.length,0);
  assert.equal(ok(m.createBillingDraft(current,sale,options,at)).state.invoices.length,1);
});

test('delivered goods with zero value require price review before the ordinary fiscal draft freezes',()=>{
  const current=state();
  const free={...sale.lines[0],id:'delivered-free',given:1,price:0};
  const result=m.createBillingDraft(current,{...sale,lines:[...sale.lines,free]},options,at);
  assert.equal(result.ok,false);assert.match(result.error,/prices/);
  assert.equal(current.invoices.length,0);
  const corrected={...sale,figure:101,lines:[...sale.lines,{...free,price:1}]};
  assert.equal(ok(m.createBillingDraft(current,corrected,options,at)).value.lines.length,2);
});

test('draft dates use the Peru preparation day and reject invalid or earlier dates before freezing',()=>{
  const current=state();
  for(const dueAt of ['2026-09-08','2026-02-30','2026-13-01']) {
    assert.equal(m.createBillingDraft(current,sale,{...options,dueAt},at).ok,false,dueAt);
    assert.equal(current.invoices.length,0);
  }
  assert.equal(ok(m.createBillingDraft(current,sale,{...options,dueAt:'2026-09-09'},at)).value.dueAt,'2026-09-09');
  assert.equal(m.peruDate('2026-09-09T02:00:00Z'),'2026-09-08');
  assert.equal(ok(m.createBillingDraft(state(),sale,{...options,dueAt:'2026-09-08'},'2026-09-09T02:00:00Z')).value.dueAt,'2026-09-08');
});

test('native fiscal structural bounds are enforced before any draft becomes immutable',()=>{
  const changed=[
    {sale:{...sale,customer:{...sale.customer,id:'x'.repeat(121)}}},
    {sale:{...sale,customer:{...sale.customer,name:'x'.repeat(101)}}},
    {sale:{...sale,id:'x'.repeat(121)}},
    {sale:{...sale,number:'x'.repeat(200)}},
    {setup:{sellerName:'x'.repeat(161)}},
    {options:{customerAddress:'x'.repeat(101)}},
    {sale:{...sale,figure:10_000_000_001,lines:[{...sale.lines[0],given:1,price:10_000_000_001}]}},
    ...[
      {id:'x'.repeat(121)},{id:' '},{product:{name:'x'.repeat(251)}},{product:{name:' '}},
      {unit:'x'.repeat(31)},{unit:' '},{given:1_000_000_000,price:1e-7},
      {given:0.00000000001,price:1e13},{given:0.0000000001,price:1e12},
    ].map(line=>({sale:{...sale,lines:[{...sale.lines[0],...line}]}})),
    {sale:{...sale,lines:[{...sale.lines[0],given:5},{...sale.lines[0],given:5}]}},
    {sale:{...sale,figure:101,lines:Array.from({length:101},(_,i)=>({...sale.lines[0],id:`l${i}`,given:1,price:1}))}},
  ];
  for(const change of changed){
    const current=state();current.setup={...current.setup,...change.setup};
    const result=m.createBillingDraft(current,change.sale??sale,{...options,...change.options},at);
    assert.equal(result.ok,false,JSON.stringify(change));assert.equal(current.invoices.length,0);
    current.setup=state().setup;
    assert.equal(ok(m.createBillingDraft(current,sale,options,at)).state.invoices.length,1);
  }
});

test('legacy conversion helper remains exact while every new draft uses native PEN',()=>{
  for(const [figure,fxRate,expected] of [[0.95,3.9,371],[0.25,2.3,58],[1.234,3.9,480]]){
    const note={...sale,figure,lines:[{...sale.lines[0],given:1,price:figure}]};
    assert.equal(m.billingAmountMinor(figure,fxRate),expected);
    const draft=ok(m.createBillingDraft(state(),note,{...options,fxRate},at)).value;
    assert.equal(draft.amountMinor,Math.round(figure*100));
    assert.equal(draft.sourceCurrency,'PEN');assert.equal(draft.fxRate,1);
  }
  assert.equal(m.decimalText(1e-7),'0.0000001');
  const small={...sale,lines:[{...sale.lines[0],given:1e-7,price:1e9}]};
  assert.equal(ok(m.createBillingDraft(state(),small,options,at)).value.lines[0].quantity,1e-7);
});
