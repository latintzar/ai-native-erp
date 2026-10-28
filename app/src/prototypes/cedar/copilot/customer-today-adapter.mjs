/** Narrow adapter for Cedar's existing customer-today starter. No ERP/store mutations. */
export const taskId='erp.copilot.customer-today';
export const gatewayOrigin='https://ai.atelierneyra.com';
export const previewProject='ai-native-erp';
export class PreviewInputUnsupported extends Error {}
const unsupported=()=>{throw new PreviewInputUnsupported('Use a new session and one customer’s current-day orders within the preview limits.');};
export function customerTodayInput(nativeAsk){
 const {ask,session,context}=nativeAsk||{};
 if(typeof ask!=='string'||!session||!Array.isArray(session.messages)||session.messages.length||!context||!Array.isArray(context.orders))unsupported();
 const match=/^What did (.+) order today\?$/.exec(ask);if(!match)unsupported();
 const selected=context.orders.filter(o=>o.customer===match[1]);
 if(!selected.length||selected.length>3||selected.some(o=>!Array.isArray(o.lines)||!o.lines.length||o.lines.length>5||o.customerId!==selected[0].customerId))unsupported();
 return {session:{id:session.id,messages:[]},ask,context:{day:context.day,area:context.area,document:null,orders:selected.map(o=>({id:o.id,number:o.number,customer:o.customer,customerId:o.customerId,state:o.state,flags:o.flags,lines:o.lines.map(l=>({product:l.product,qty:l.qty,unit:l.unit}))})),stock:[],customer:null}};
}
export async function askCustomerToday(previewAI,nativeAsk,mode){
 const result=await previewAI.run({taskId,input:customerTodayInput(nativeAsk),mode});
 if(!result||typeof result.reply?.text!=='string'||!result.reply.text.trim()||!Array.isArray(result.proposals)||result.proposals.length||result.preview?.provider!=='openai'||typeof result.preview.model!=='string'||result.preview.operation!=='customer-today-reading')throw Error('The preview answered outside its reading contract.');
 // This is PreviewCopilotAnswer, not a fabricated native evidence object.
 return result;
}
