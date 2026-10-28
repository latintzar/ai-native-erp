/** Explicit preview-build road for Cedar's existing customer-today starter. */
import {PreviewAI} from './gateway-client.mjs';
import {customerTodayInput,askCustomerToday,PreviewInputUnsupported} from './customer-today-adapter.mjs';
export const transportName='OpenAI preview';
class CedarPreviewAI extends PreviewAI {
  offer(data){
    const result=super.offer(data);
    // Escape dismisses this key/allowance choice while keeping the native Copilot open.
    document.querySelector('dialog.atelier-ai-fallback')?.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
    return result;
  }
}
let client;
let selectedOrigin;
function configuredClient(origin){
  if(!client || selectedOrigin!==origin){client=new CedarPreviewAI({gatewayOrigin:origin,project:'ai-native-erp'});selectedOrigin=origin;}
  return client;
}
export async function askPreviewTurn({gatewayOrigin,nativeAsk,orders,localTurn,turnOf,previewAI=configuredClient(gatewayOrigin)}){
  if(typeof document!=="undefined")installPreviewFallbackStyle();
  try { customerTodayInput(nativeAsk); }
  catch(error){
    if(error instanceof PreviewInputUnsupported)return {turn:localTurn(),posture:'offline'};
    throw error;
  }
  try{
    const result=await askCustomerToday(previewAI,nativeAsk);
    return {turn:turnOf(result,orders),posture:'preview'};
  }catch(error){
    // A failed provider request stays a named failure; the local reading never impersonates it.
    const code=typeof error?.code==='string'?error.code:'preview_unavailable';
    const text=typeof error?.message==='string'&&error.message.trim()?error.message:'Open the preview again to use this reading.';
    return {turn:{id:crypto.randomUUID(),at:new Date().toISOString(),role:'copilot',text,
      proposals:[],previewFailure:{code}},posture:'preview'};
  }
}
export function installPreviewFallbackStyle(){
  if(document.getElementById('atelier-preview-fallback-style'))return;
  const style=document.createElement('style');style.id='atelier-preview-fallback-style';
  style.textContent=`.atelier-ai-fallback{box-sizing:border-box;max-width:min(440px,calc(100vw - 32px));padding:24px;border:1px solid #e7e2d9;border-radius:12px;background:#faf7f3;color:#1a1413;font:16px Inter,Arial,sans-serif;box-shadow:0 16px 60px #1a14132a}.atelier-ai-fallback::backdrop{background:#1a141340}.atelier-ai-fallback p{margin:0 0 20px;line-height:1.5}.atelier-ai-fallback button,.atelier-ai-fallback a{display:inline-flex;align-items:center;min-height:44px;margin:0 10px 4px 0;padding:8px 14px;border-radius:6px;border:1px solid #e7e2d9;font:inherit;text-decoration:none;color:#1a1413;background:#faf7f3}.atelier-ai-fallback button{background:#c01b2c;color:white;border-color:#c01b2c;cursor:pointer}.atelier-ai-fallback :focus-visible{outline:3px solid #c01b2c;outline-offset:3px}`;
  document.head.appendChild(style);
}
