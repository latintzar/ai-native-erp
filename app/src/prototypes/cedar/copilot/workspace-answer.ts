import type { Sale } from '../sale';
import { soles } from '../currency';
import type { Activity, CopilotProposal } from './types';

type Answer = { text: string; activity: Activity[]; proposals?: CopilotProposal[] };
const fold = (text:string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

/** Bounded record queries for the development assistant. Results propose; the operator acts. */
export function workspaceAnswer(text:string, sales:Sale[], today:string):Answer|undefined {
  const query=fold(text);
  if (!/\b(order|orders|sales|delivery|deliveries|print|packing|reply|replies|pending|tomorrow|yesterday|summary|overview|pedido|pedidos|ventas|entregas|manana|ayer|responder|resumen)\b/.test(query)) return undefined;
  const delta=/\b(tomorrow|manana)\b/.test(query)?1:/\b(yesterday|ayer)\b/.test(query)?-1:0;
  const day=new Date(Date.parse(`${today}T12:00:00Z`)+delta*86400000).toISOString().slice(0,10);
  const when=delta===1?'tomorrow':delta===-1?'yesterday':'today';
  const customer=sales.map(sale=>sale.customer).filter(customer=>query.includes(fold(customer.name)))
    .sort((a,b)=>b.name.length-a.name.length)[0];
  const replies=/\b(reply|replies|responder)\b/.test(query);
  const rows=sales.filter(sale=>!sale.archived&&(replies?Boolean(sale.needsReply):!sale.messageOnly&&sale.lines.length>0&&sale.day===day)
    &&(!customer||sale.customer.id===customer.id));
  const count=rows.length;
  const value=rows.reduce((total,sale)=>total+sale.figure,0);
  const paper=/\b(print|packing)\b/.test(query);
  const summary=replies ? `${count} ${count===1?'conversation needs':'conversations need'} a reply.`
    : `${customer?`${customer.name} has `:''}${count} ${count===1?'order':'orders'} for ${when}, worth ${soles(value)}.`;
  return {text:`${summary}${paper?' Open Print on that day to choose the batch and document.':replies&&count?' Open a conversation to review its prepared reply.':''}`,
    activity:[{id:'workspace-orders',label:replies?'Conversations':'Orders',summary:String(count),status:'complete',
      detail:rows.slice(0,12).map(sale=>`${sale.number} · ${sale.customer.name} · ${replies? 'Reply needed':soles(sale.figure)}`)}],
    ...(count>0&&count<=3?{proposals:rows.map(sale=>replies?{kind:'open-chat' as const,customerId:sale.customer.id}:{kind:'open-order' as const,orderId:sale.id})}:{})};
}
