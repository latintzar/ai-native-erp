import { collectionGuard, collectionOrigin, collectionOwnerRequest } from './money-api';
import { moneyActions, moneyStateNow } from './money-store';
import { formatInvoiceMoney, invoiceBalance, paymentReference, requestForInvoice, type Invoice, type PaymentDispatch } from './money-model';
import { paymentHoldOf, paymentReminderAt, paymentRevisionOf } from './payment-lifecycle';
import { chaseRecordOf, putChase, readChase, writeChase } from './chase';
import { sendToThread } from './shell/threads';
import type { SectorId } from '../../scenarios/meta';
import type { Sale } from './sale';

const restoredMessages=new Set<string>();
const sends = new Map<string,Promise<{ok:boolean;error?:string}>>();
if(typeof window!=='undefined')window.addEventListener('rocoto:money-workspace-reset',event=>{
  const scope=(event as CustomEvent<{scope:string}>).detail?.scope;
  for(const key of restoredMessages)if(key.startsWith(`${scope}:`))restoredMessages.delete(key);
  for(const key of sends.keys())if(key.startsWith(`${scope}:`))sends.delete(key);
});
/** The dispatch record is durable; replaying it into the existing conversation seam is idempotent. */
export function hydratePaymentMessage(scope: SectorId, invoice: Invoice, requestId: string, at: string, dispatch: PaymentDispatch): void {
  const identity=`${scope}:${requestId}:${at}`;
  if(restoredMessages.has(identity))return;
  const hour=new Date(at).toLocaleTimeString('en-GB',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit'});
  sendToThread(scope,invoice.customerId,dispatch.text,hour,undefined,{orderId:invoice.saleId,
    id:`payment:${requestId}:${at}:initial`});
  restoredMessages.add(identity);
}
export function sendOrderPayment(scope: SectorId, invoiceId: string, sale: Sale | undefined, by: 'auto'|'manual', accountChannel?: string, assertActive?:()=>void): Promise<{ok:boolean;error?:string}> {
  const key=`${scope}:${invoiceId}`;
  if (sends.has(key)) return sends.get(key)!;
  const guard=collectionGuard(scope),check=()=>{guard();assertActive?.();};
  const run=(async()=>{
    check();
    const actions=moneyActions(scope);
    let state=moneyStateNow(scope),invoice=state.invoices.find(row=>row.id===invoiceId);
    if (!invoice || invoiceBalance(state,invoiceId)<=0) return {ok:false,error:'Open an order with a payment balance.'};
    if (by==='auto' && paymentHoldOf(state,invoice,sale)) return {ok:false,error:'Review the payment hold before sending.'};
    if(sale&&!invoice.collectionOnly&&Math.round(sale.figure*100)!==invoice.amountMinor)return {ok:false,error:'Review the fiscal document before sharing its updated order.'};
    const originalHold=paymentHoldOf(state,invoice,sale);
    if (sale && invoice.collectionOnly) {
      const revised=await actions.reviseOrderPayment(sale);check();
      if (!revised.ok) return revised;
    }
    let link=requestForInvoice(moneyStateNow(scope),invoiceId);
    if (!link || collectionOrigin() && !link.remoteId || link.remotePending) {
      const connected=await actions.createRequest(invoiceId);check();
      if (!connected.ok) return connected;
      link=connected.value;
    }
    state=moneyStateNow(scope);invoice=state.invoices.find(row=>row.id===invoiceId)!;
    if (by==='auto' && link.sentAt) return {ok:true};
    const channel=(sale?.customer.channel??accountChannel)==='email'?'email':'whatsapp';
    const text=`Hi ${invoice.customerName}, payment for order ${paymentReference(invoice)} is ${formatInvoiceMoney(invoice,invoiceBalance(state,invoiceId))}. Pay here: ${link.url}`;
    const reason=by==='auto'?(state.setup.paymentTiming??'delivery'):paymentHoldOf(state,invoice,sale)?'held':sale?.stamps.deliver?'delivery':'early';
    const dispatch:PaymentDispatch={by,reason,channel,text};
    try {
      if (link.remoteId && collectionOrigin()) await collectionOwnerRequest(scope,`/requests/${encodeURIComponent(link.remoteId)}/dispatch`,{by});
      check();
      const recorded=actions.recordRequestAction(link.id,'sent',dispatch,by==='manual'&&originalHold?{reason:originalHold,revision:paymentRevisionOf(sale,invoice)}:undefined);
      if (!recorded.ok) return recorded;
      const first=recorded.value;
      const delivered=first.dispatches?.slice(-1)[0];
      check();
      hydratePaymentMessage(scope,invoice,`${link.remoteId}:${delivered?.id??first.id}`,delivered?.at??first.sentAt!,delivered??first.dispatch??dispatch);
      const book=readChase(scope),record=chaseRecordOf(book,invoiceId);
      if (!record.sends.length && !record.auto.on) writeChase(putChase(book,{...record,auto:{on:true,everyHours:24,nextAt:paymentReminderAt(first.sentAt,0)}}));
      return {ok:true};
    } catch(error) {return {ok:false,error:error instanceof Error?error.message:'Reconnect to send this payment link.'};}
  })().catch(error=>({ok:false,error:error instanceof Error?error.message:'Reconnect to send this payment link.'})).finally(()=>{if(sends.get(key)===run)sends.delete(key);});
  sends.set(key,run);return run;
}
