import * as React from 'react';
import {useConfig} from './config';
import {useDay} from './day';
import {useGrants} from './grants';
import {buildSales,type Sale} from './sale';
import {moneyActions,moneyStateNow,useMoney} from './money-store';
import {collectionGuard,collectionOrigin} from './money-api';
import {invoiceBalance,invoiceForSale,reviseOrderPaymentDocument,requestForInvoice,formatInvoiceMoney,paymentReference} from './money-model';
import {useWorkspaceCapabilities} from './workspace-capabilities';
import {hydratePaymentMessage,sendOrderPayment} from './payment-dispatch';
import {paymentReadyToSend,paymentHoldOf,paymentReminderAt} from './payment-lifecycle';
import {hasAuthoredChase,readChase,chaseRecordOf,chaseStepOf,chaseMessageOf,chaseFeeMinor,chaseFeeDate,putChase,writeChase} from './chase';
import {sendChase,chaseChannelOf,hydrateChaseMessage} from './chase-dialog';

/** One root coordinator owns registration and delivery; receipt polling has its own shared host. */
export default function OrderPaymentSync() {
  const {derived}=useConfig(),cast=derived.cast,scope=cast.sector,edits=useDay(scope),grants=useGrants();
  const sales=React.useMemo(()=>buildSales(cast,edits),[cast,edits,grants]);
  const money=useMoney(scope),capabilities=useWorkspaceCapabilities(scope);
  const latest=React.useRef({scope,sales,edits});latest.current={scope,sales,edits};
  const priorities=React.useRef(new Set<string>());
  const ready=React.useRef(false);
  const [generation,setGeneration]=React.useState(0);
  React.useEffect(()=>{
    const reset=(event:Event)=>{if((event as CustomEvent<{scope:string}>).detail?.scope===scope){ready.current=false;priorities.current.clear();setGeneration(value=>value+1);}};
    window.addEventListener('rocoto:money-workspace-reset',reset);
    return()=>window.removeEventListener('rocoto:money-workspace-reset',reset);
  },[scope]);
  React.useEffect(()=>{
    ready.current=false;
    if(!capabilities.money)return;
    let active=true;
    void money.prepareExamples(sales).then(()=>{if(active)ready.current=true;});
    return()=>{active=false;};
  },[scope,capabilities.money,generation]);
  React.useEffect(()=>{
    if(!capabilities.money)return;
    const authored=new Set(edits.events.filter(event=>['commit','make','schedule','send','deliver','decline','settle','line','add','remove','restore','amend','unit-flip','choose-sku','theatre-amend'].includes(event.kind)).map(event=>event.sale));
    for(const sale of sales)if(authored.has(sale.id)){
      const state=moneyStateNow(scope),invoice=invoiceForSale(state,sale.id);
      if(!invoice)money.ensureOrderDocument(sale);
      else if(invoice.collectionOnly&&['made','scheduled'].includes(sale.state)){
        const revision=reviseOrderPaymentDocument(state,sale,new Date().toISOString());
        if(revision.ok&&revision.state!==state)void money.reviseOrderPayment(sale);
      }
    }
  },[scope,capabilities.money,sales,edits.events,money.ensureOrderDocument]);
  React.useEffect(()=>{
    if(!capabilities.money||!collectionOrigin())return;
    let active=true,running=false,backoff=1000,nextTry=0;
    const run=async()=>{
      if(!active||running||document.hidden||!ready.current||Date.now()<nextTry)return;
      running=true;
      const guard=collectionGuard(scope),check=()=>{guard();if(!active||latest.current.scope!==scope)throw new Error('Payment coordinator changed.');};
      try {
        check();
        let state=moneyStateNow(scope);
        const map=new Map(latest.current.sales.map(sale=>[sale.id,sale]));
        const invoices=new Map(state.invoices.map(invoice=>[invoice.id,invoice]));
        const candidates=state.requests.filter(link=>!link.remoteId).sort((a,b)=>
          Number(priorities.current.has(b.invoiceId))-Number(priorities.current.has(a.invoiceId))
          ||Number(invoiceBalance(state,b.invoiceId)>0)-Number(invoiceBalance(state,a.invoiceId)>0)
          ||b.createdAt.localeCompare(a.createdAt)).slice(0,25);
        if(candidates.length){
          const result=await moneyActions(scope).hydrateOrderPayments(candidates.map(row=>row.invoiceId));check();
          if(!result.ok){nextTry=Date.now()+backoff;backoff=Math.min(60000,backoff*2);return;}
          backoff=1000;state=moneyStateNow(scope);
        }
        const at=new Date().toISOString();
        for(const link of state.requests) {
          check();
          if(!link.remoteId)continue;
          const invoice=invoices.get(link.invoiceId);if(!invoice)continue;
          const sale=map.get(invoice.saleId);
          if(link.sentAt&&link.dispatch){
            for(const record of link.dispatches?.length?link.dispatches:[{...link.dispatch,id:link.id,at:link.sentAt}]) {
            const dispatch={...record,text:record.text||`Hi ${invoice.customerName}, payment for order ${paymentReference(invoice)} is ${formatInvoiceMoney(invoice)}. Pay here: ${link.url}`};
            check();hydratePaymentMessage(scope,invoice,`${link.remoteId}:${record.id}`,record.at,dispatch);
            }
          }
          if(!link.sentAt&&sale&&paymentReadyToSend(state,invoice,sale,at)){await sendOrderPayment(scope,invoice.id,sale,'auto',undefined,check);check();}
        }
        // Each due invoice advances one rung on a wake. The first dispatch remains the anchor.
        let book=readChase(scope);
        for(const record of Object.values(book.records)){
          check();
          state=moneyStateNow(scope);
          const invoice=state.invoices.find(row=>row.id===record.invoiceId),link=requestForInvoice(state,record.invoiceId);
          if(invoice&&link?.remoteId)for(const send of record.sends)hydrateChaseMessage(scope,invoice,{...send,text:send.text.includes('http')?send.text:`${send.text} Pay here: ${link.url}`});
          if(!invoice||!link?.remoteId||!link.sentAt||!record.auto.on||record.sends.length>=3||invoiceBalance(state,invoice.id)<=0||paymentHoldOf(state,invoice,map.get(invoice.saleId)))continue;
          const due=paymentReminderAt(link.sentAt,record.sends.length);
          if(!due||due>at||record.auto.nextAt&&record.auto.nextAt>at)continue;
          const held=chaseRecordOf(book,invoice.id),step=chaseStepOf(held),sale=map.get(invoice.saleId);
          const text=chaseMessageOf({step,customerName:invoice.customerName,documentNumber:paymentReference(invoice),amountText:formatInvoiceMoney(invoice,invoiceBalance(state,invoice.id)),
            dueText:invoice.dueAt,link:link.url,feeText:formatInvoiceMoney(invoice,chaseFeeMinor(invoiceBalance(state,invoice.id))),feeDateText:chaseFeeDate(at)});
          const sent=sendChase({scope,sector:scope,invoice,customerId:invoice.customerId,text,channel:chaseChannelOf(sale?.customer.channel??'WhatsApp'),step,
            hour:new Date(at).toLocaleTimeString('en-GB',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit'}),now:at,record:held,everyHours:24,requestId:link.id});
          const fixture=!hasAuthoredChase(book);
          book=putChase(book,sent);if(fixture&&book.fixture)book={...book,fixture:{...book.fixture,records:JSON.stringify(book.records)}};writeChase(book);
        }
      } catch {nextTry=Date.now()+backoff;backoff=Math.min(60000,backoff*2);} finally {running=false;}
    };
    const tick=()=>{void run();};
    const priority=(event:Event)=>{const detail=(event as CustomEvent<{scope:string;invoiceId:string}>).detail;if(detail.scope===scope){priorities.current.add(detail.invoiceId);tick();}};
    const timer=window.setInterval(tick,1000);tick();
    window.addEventListener('rocoto:payment-priority',priority);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('rocoto:payment-priority',priority);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};
  },[scope,capabilities.money,generation]);
  return null;
}
