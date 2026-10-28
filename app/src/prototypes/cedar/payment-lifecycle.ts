import { invoiceBalance, peruDate, type Invoice, type MoneyState, type PaymentHold, type PaymentTiming } from './money-model';

/** Delivery is evidence in the order ledger; each payment rule uses the house's Peru calendar. */
export type PaymentSale = {
  state: string; day: string; figure: number; stamps: { deliver?: string; deliveredAt?: string };
  prep?: { stale?: boolean;at?:string }; printed?: { stale?: boolean;staleAt?:string }; dispute?: { outcome?: string;at?:string };
  lines?: {id:string;given:number;price:number;unit:string;product:{name:string}}[];
};
export const PAYMENT_TIMING_WORDS: Record<PaymentTiming,string> = {
  delivery: 'On delivery', evening: 'Delivery evening', 'next-morning': 'Next morning',
};
export const PAYMENT_HOLD_WORDS: Record<PaymentHold,string> = {
  disputed:'Customer dispute', 'changed-after-loading':'Order changed after loading',
  'partial-return':'Part returned', 'monthly-billing':'Monthly billing', manual:'Held by you',
};
export const paymentPolicyWords = (timing: PaymentTiming): string => timing === 'delivery'
  ? 'Payment links go to customers when their order is delivered.'
  : timing === 'evening' ? 'Payment links go to customers at 18:00 on delivery day.'
    : 'Payment links go to customers at 08:00 the morning after delivery.';
export function paymentDispatchAt(sale: PaymentSale, timing: PaymentTiming): string | null {
  if (!sale.stamps.deliver || !/^\d{2}:\d{2}$/.test(sale.stamps.deliver)) return null;
  const delivered = Date.parse(sale.stamps.deliveredAt??`${sale.day}T${sale.stamps.deliver}:00-05:00`);
  if (!Number.isFinite(delivered)) return null;
  const day=peruDate(new Date(delivered).toISOString());
  const intended = timing === 'delivery' ? delivered : timing === 'evening'
    ? Date.parse(`${day}T18:00:00-05:00`) : Date.parse(`${day}T08:00:00-05:00`) + 86400000;
  return new Date(Math.max(delivered,intended)).toISOString();
}
export function paymentRevisionOf(sale:PaymentSale|undefined,invoice:Invoice):string {
  return JSON.stringify(sale?{state:sale.state,day:sale.day,figure:sale.figure,prep:sale.prep,printed:sale.printed,dispute:sale.dispute,
    lines:sale.lines?.map(line=>[line.id,line.given,line.price,line.unit,line.product.name])}:{amount:invoice.amountMinor,lines:invoice.lines});
}
export function paymentHoldOf(state: MoneyState, invoice: Invoice, sale?: PaymentSale): PaymentHold | null {
  let reason:PaymentHold|null=invoice.collectionHold??null;
  if(!reason&&(sale?sale.state==='disputed':invoice.disputed))reason='disputed';
  if(!reason&&state.setup.monthlyCustomerIds?.includes(invoice.customerId))reason='monthly-billing';
  if(!reason&&sale&&['sent','delivered','settled'].includes(sale.state)&&(sale.prep?.stale||sale.printed?.stale))reason='changed-after-loading';
  if(!reason&&sale&&['sent','delivered','settled'].includes(sale.state)&&Math.round(sale.figure*100)!==invoice.amountMinor&&invoice.collectionOnly)reason='changed-after-loading';
  if(reason&&invoice.collectionRelease?.reason===reason&&invoice.collectionRelease.revision===paymentRevisionOf(sale,invoice))return null;
  return reason;
}
export function paymentReminderAt(sentAt: string | undefined, sends: number): string | null {
  if (!sentAt || !Number.isFinite(Date.parse(sentAt)) || sends >= 3 || sends < 0) return null;
  return new Date(Date.parse(sentAt) + (sends + 1) * 24 * 3600000).toISOString();
}
export function paymentReadyToSend(state: MoneyState, invoice: Invoice, sale: PaymentSale, at: string): boolean {
  const due = paymentDispatchAt(sale,state.setup.paymentTiming ?? 'delivery');
  return invoiceBalance(state,invoice.id) > 0 && !paymentHoldOf(state,invoice,sale) && Boolean(due && due <= at);
}
export function paymentSentWords(at: string, reason?: string): string {
  const hour = new Date(at).toLocaleTimeString('en-GB',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit'});
  const suffix = reason === 'delivery' ? ', on delivery' : reason === 'evening' ? ', delivery evening' : reason === 'next-morning' ? ', next morning' : reason === 'early' ? ', early payment' : '';
  return `Payment link sent ${hour}${suffix}`;
}
export const paymentDayOf = (at: string): string => peruDate(at);
