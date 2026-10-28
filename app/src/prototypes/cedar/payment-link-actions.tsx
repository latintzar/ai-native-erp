import * as React from 'react';
import {useStyletron} from 'baseui';
import {Button,KIND,SIZE} from 'baseui/button';
import {ArrowUpRight,Copy} from 'lucide-react';
import {useMoney} from './money-store';
import {invoiceBalance,requestForInvoice,type PaymentHold} from './money-model';
import {paymentHoldOf,paymentSentWords,PAYMENT_HOLD_WORDS} from './payment-lifecycle';
import {sendOrderPayment} from './payment-dispatch';
import {useConfig} from './config';
import type {Sale} from './sale';
import type {SectorId} from '../../scenarios/meta';

/** Every document shares these same three acts; registration runs in the workspace coordinator. */
export function PaymentLinkActions({invoiceId,scope,sale}:{invoiceId:string;scope:string;sale?:Sale}) {
  const [,theme]=useStyletron(),money=useMoney(scope),{derived}=useConfig();
  const invoice=money.state.invoices.find(row=>row.id===invoiceId),link=requestForInvoice(money.state,invoiceId);
  const [message,setMessage]=React.useState(''),[busy,setBusy]=React.useState(false);
  const node=React.useRef<HTMLElement>(null);
  React.useEffect(()=>{
    if (!node.current || link?.remoteId) return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)) window.dispatchEvent(new CustomEvent('rocoto:payment-priority',{detail:{scope,invoiceId}}));
    },{rootMargin:'160px'});
    observer.observe(node.current);return ()=>observer.disconnect();
  },[scope,invoiceId,link?.remoteId]);
  if(!invoice)return null;
  const held=paymentHoldOf(money.state,invoice,sale),balance=invoiceBalance(money.state,invoiceId);
  const ready=Boolean(link?.remoteId&&!link.remotePending);
  const lastDispatch=link?.dispatches?.slice(-1)[0];
  const touch={BaseButton:{style:{minHeight:'44px',minWidth:'44px'}}};
  const channel=sale?.customer.channel??derived.cast.customers.find(row=>row.id===invoice.customerId)?.channel;
  const secondary={...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary};
  const send=async()=>{if(busy)return;setBusy(true);try{const result=await sendOrderPayment(scope as SectorId,invoiceId,sale,'manual',channel);setMessage(result.ok?'Payment link sent.':result.error??'Reconnect to send this payment link.');}finally{setBusy(false);}};
  return <section ref={node} data-testid="order-payment-actions" aria-label="Payment link" style={{display:'grid',gap:theme.sizing.scale400,minWidth:0}}>
    <h3 style={{...theme.typography.LabelMedium,margin:0}}>Payment link</h3>
    {link?.sentAt&&<p data-testid="payment-dispatch-status" style={{...secondary,margin:0}}>{paymentSentWords(lastDispatch?.at??link.sentAt,lastDispatch?.reason??link.dispatch?.reason)}</p>}
    {held&&balance>0&&<p data-testid="payment-hold-reason" style={{...theme.typography.LabelSmall,margin:0}}>Held · {PAYMENT_HOLD_WORDS[held]}</p>}
    {ready&&link?<div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:theme.sizing.scale300}}>
      <a href={link.url} target="_blank" rel="noopener noreferrer" data-testid="money-request-preview" style={{...theme.typography.LabelSmall,color:theme.colors.contentPrimary,
        display:'inline-flex',alignItems:'center',gap:theme.sizing.scale200,minHeight:44,paddingInline:theme.sizing.scale400,border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius200}}>Open Yape link<ArrowUpRight size={16} aria-hidden/></a>
      <Button size={SIZE.compact} kind={KIND.secondary} overrides={touch} data-testid="money-copy-request" onClick={async()=>{
        try{await navigator.clipboard.writeText(link.url);const result=money.recordRequestAction(link.id,'copied');setMessage(result.ok?'Payment link copied.':result.error);}
        catch{setMessage('Open the payment link to copy its address.');}
      }}><Copy size={16} aria-hidden/>&nbsp;Copy link</Button>
      {balance>0&&<Button size={SIZE.compact} kind={KIND.secondary} overrides={touch} isLoading={busy} onClick={()=>void send()} data-testid="payment-send-link">{channel==='email'?'Send by email':'Send on WhatsApp'}</Button>}
    </div>:<p data-testid="payment-link-preparing" role="status" style={{...secondary,margin:0}}>Preparing Yape link…</p>}
    {balance>0&&<label style={{...secondary,display:'flex',flexWrap:'wrap',alignItems:'center',gap:theme.sizing.scale300}}>Payment handling
      <select aria-label="Payment handling" data-testid="payment-hold" value={invoice.collectionHold??''} onChange={event=>{const result=money.holdPayment(invoiceId,(event.target.value||undefined) as PaymentHold|undefined);setMessage(result.ok?'':result.error);}} style={{...theme.typography.LabelSmall,minHeight:44,maxWidth:'100%',padding:theme.sizing.scale300,color:theme.colors.contentPrimary,background:theme.colors.backgroundPrimary,border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius200}}>
        <option value="">Automatic sending</option><option value="manual">Hold for review</option><option value="partial-return">Part returned</option><option value="monthly-billing">Monthly billing</option>
      </select></label>}
    {message&&<p role="status" data-testid="money-action-message" style={{...secondary,margin:0}}>{message}</p>}
  </section>;
}
