import * as React from 'react';
import {useStyletron} from 'baseui';
import {useMoney} from './money-store';
import {PAYMENT_TIMING_WORDS,paymentPolicyWords} from './payment-lifecycle';
import type {PaymentTiming} from './money-model';

export function PaymentSettings({scope}:{scope:string}) {
  const [,theme]=useStyletron(),money=useMoney(scope),timing=money.state.setup.paymentTiming??'delivery';
  const [message,setMessage]=React.useState('');
  return <section data-testid="payment-settings" style={{display:'grid',gap:theme.sizing.scale400,padding:theme.sizing.scale600,border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius400}}>
    <h3 style={{...theme.typography.LabelLarge,margin:0}}>Payment timing</h3>
    <label style={{...theme.typography.ParagraphSmall,display:'flex',alignItems:'center',flexWrap:'wrap',gap:theme.sizing.scale400}}>Send payment links
      <select aria-label="Send payment links" data-testid="payment-timing" value={timing} onChange={event=>{const result=money.updateSetup({paymentTiming:event.target.value as PaymentTiming});setMessage(result.ok?'':result.error);}}
        style={{...theme.typography.LabelSmall,minHeight:44,maxWidth:'100%',padding:theme.sizing.scale400,color:theme.colors.contentPrimary,background:theme.colors.backgroundPrimary,border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius200}}>
        {(Object.keys(PAYMENT_TIMING_WORDS) as PaymentTiming[]).map(key=><option key={key} value={key}>{PAYMENT_TIMING_WORDS[key]}</option>)}
      </select>
    </label>
    {message&&<p role="status" style={{...theme.typography.ParagraphSmall,margin:0}}>{message}</p>}
    <p data-testid="payment-policy" style={{...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0}}>{paymentPolicyWords(timing)}</p>
    <p style={{...theme.typography.ParagraphSmall,color:theme.colors.contentSecondary,margin:0}}>Held orders show their reason and a send action.</p>
  </section>;
}
