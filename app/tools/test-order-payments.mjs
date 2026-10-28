import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const m=loadTypeScript('src/prototypes/cedar/money-model.ts','order-payments-model');
const at='2026-09-15T15:40:00.000Z';
const sale={id:'order-one',number:'1509-001',customer:{id:'restaurant-one',name:'Restaurant One'},figure:100,
  day:'2026-09-15',state:'made',lines:[{id:'line-one',product:{name:'Fish'},given:10,price:10,unit:'kg'}]};
const ready=()=>({...m.emptyMoney('fish'),setup:{...m.emptyMoney('fish').setup,sellerName:'Fish house'}});
const ok=result=>{assert.equal(result.ok,true,result.error);return result;};

test('a priced order owns a collection document and canonical link before fiscal details exist',()=>{
  const made=ok(m.createOrderPaymentDocument(ready(),sale,at,'https://app.example/'));
  const invoice=made.value,link=m.requestForInvoice(made.state,invoice.id);
  assert.equal(invoice.collectionOnly,true);
  assert.equal(invoice.number,sale.number);
  assert.equal(invoice.customerRuc,'');
  assert.equal(invoice.sellerRuc,'');
  assert.equal(invoice.customerAddress,undefined);
  assert.equal(invoice.invoiceSeries,undefined);
  assert.equal(invoice.amountMinor,10000);
  assert.ok(link);
  assert.equal(m.paymentReference(invoice),'1509-001');
  assert.equal(m.parseMoney(JSON.parse(JSON.stringify(made.state)),'fish').invoices.length,1);
  const repeated=ok(m.createOrderPaymentDocument(made.state,sale,at,'https://app.example/'));
  assert.equal(repeated.state.invoices.length,1);
  assert.equal(repeated.state.requests.length,1);
  assert.equal(m.requestForInvoice(repeated.state,invoice.id).id,link.id);
});

test('collection begins at a priced document and keeps incomplete quantities actionable',()=>{
  for(const patch of [{state:'request'},{figure:0},{messageOnly:true},{lines:[]},{lines:[{...sale.lines[0],given:0}]}]) {
    assert.equal(m.createOrderPaymentDocument(ready(),{...sale,...patch},at,'https://app.example/').ok,false);
  }
});

test('a partial receipt keeps the order link identity and sent history',()=>{
  const made=ok(m.createOrderPaymentDocument(ready(),sale,at,'https://app.example/'));
  const link=m.requestForInvoice(made.state,made.value.id);
  const sent=ok(m.recordRequestAction(made.state,link.id,'sent',at));
  const paid=ok(m.recordReceipt(sent.state,{invoiceId:made.value.id,amountMinor:2500,currency:'PEN',method:'yape',source:'manual',reference:'partial'},at));
  const updated=ok(m.createRequest(paid.state,made.value.id,at,'https://app.example/'));
  assert.equal(updated.value.id,link.id);
  assert.equal(updated.value.amountMinor,7500);
  assert.equal(updated.value.sentAt,at);
  assert.equal(updated.state.requests.length,1);
});

test('fiscal preparation keeps the commercial total and canonical payment reference',()=>{
  const made=ok(m.createOrderPaymentDocument(ready(),sale,at,'https://app.example/'));
  const options={customerRuc:'20987654321',customerAddress:'Av Peru 123',taxRate:18,dueAt:'2026-09-20'};
  assert.equal(m.prepareOrderFiscal(made.state,made.value.id,options,at).ok,false);
  const prepared=ok(m.prepareOrderFiscal({...made.state,setup:{...made.state.setup,ruc:'20123456789'}},made.value.id,options,at));
  assert.equal(prepared.value.collectionOnly,false);
  assert.equal(prepared.value.amountMinor,10000);
  assert.equal(prepared.value.netMinor+prepared.value.taxMinor,10000);
  assert.equal(m.paymentReference(prepared.value),'1509-001');
  assert.equal(m.parseMoney(JSON.parse(JSON.stringify(prepared.state)),'fish').invoices.length,1);
});

test('explicit order revision preserves money already received and fiscal snapshots stay frozen',()=>{
  const made=ok(m.createOrderPaymentDocument(ready(),sale,at,'https://app.example/'));
  const partial=ok(m.recordReceipt(made.state,{invoiceId:made.value.id,amountMinor:5000,currency:'PEN',method:'yape',source:'manual',reference:'revision-partial'},at));
  const changed={...sale,figure:80,lines:[{...sale.lines[0],given:8}]};
  const revised=ok(m.reviseOrderPaymentDocument(partial.state,changed,at));
  assert.equal(revised.value.id,made.value.id);
  assert.equal(revised.value.amountMinor,8000);
  assert.equal(m.invoiceBalance(revised.state,revised.value.id),3000);
  assert.equal(revised.state.receipts.length,1);
  assert.equal(m.reviseOrderPaymentDocument(partial.state,{...sale,figure:40,lines:[{...sale.lines[0],given:4}]},at).ok,false);
  const frozen={...partial.state,invoices:[{...made.value,collectionOnly:false,invoiceSeries:'F001',customerAddress:'Av Peru'}]};
  assert.equal(m.reviseOrderPaymentDocument(frozen,changed,at).ok,false);
});

test('a deliberate resend records another message while the first contact anchors reminders',()=>{
  const made=ok(m.createOrderPaymentDocument(ready(),sale,at,'https://app.example/'));
  const link=m.requestForInvoice(made.state,made.value.id);
  const first=ok(m.recordRequestAction(made.state,link.id,'sent',at,{by:'auto',reason:'delivery',channel:'whatsapp',text:'First link'}));
  const later='2026-09-16T15:40:00.000Z';
  const resent=ok(m.recordRequestAction(first.state,link.id,'sent',later,{by:'manual',reason:'delivery',channel:'whatsapp',text:'Same link again'}));
  assert.equal(resent.value.sentAt,at);
  assert.equal(resent.value.dispatches.length,2);
  assert.equal(resent.value.dispatches[1].at,later);
  assert.notEqual(resent.value.dispatches[0].id,resent.value.dispatches[1].id);
});
