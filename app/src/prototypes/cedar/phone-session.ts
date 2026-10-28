import * as React from 'react';
import type { Device, Call } from '@twilio/voice-sdk';
import { phoneApi, phoneError, type PhoneIntent } from './phone-runtime';
import { phoneDialRoute } from './phone-route';
import { callEnded, mergePhoneCall, type PhoneCall } from './phone-call-model';

type PhoneSession = {
  browser:'off'|'connecting'|'ready'|'unavailable';active:PhoneCall|null;incoming:boolean;
  expanded:boolean;muted:boolean;placing:boolean;error:string;name:string;customerId?:string;
  route:'browser'|'mobile';
};
const INITIAL:PhoneSession={browser:'off',active:null,incoming:false,expanded:true,muted:false,placing:false,error:'',name:'',route:'browser'};
let state:PhoneSession=INITIAL, device:Device|null=null, leg:Call|null=null;
let registration:Promise<void>|null=null, placing:Promise<void>|null=null, refreshing:Promise<void>|null=null;
const listeners=new Set<()=>void>();
let references=0, timer:number|undefined, generation=0;
let recentSid='', retryIntent:{to:string;mode:'browser'|'phone';key:string;intent?:PhoneIntent}|null=null;
const enabledKey='rocoto-cedar-phone-browser-v1';
const publish=(patch:Partial<PhoneSession>)=>{state={...state,...patch};listeners.forEach(listener=>listener());};
export function usePhoneSession() {
  return React.useSyncExternalStore(React.useCallback((listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);},[]),()=>state,()=>state);
}
export const phoneSessionNow=()=>state;
export function openPhoneCall() {publish({expanded:true});}
export function minimisePhoneCall() {publish({expanded:false});}
export function dismissPhoneCall() {if(!state.active || callEnded(state.active))publish({active:null,incoming:false,error:''});else minimisePhoneCall();}
function acceptCall(next:PhoneCall,requestedSid?:string) {
  const previous=state.active;
  const same=previous && (previous.sid===next.sid || previous.sid===requestedSid || (previous.sessionId && previous.sessionId===next.sessionId));
  if (previous && !same && !callEnded(previous)) return;
  publish({active:mergePhoneCall(same ? {...previous,sid:next.sid} : undefined,next),incoming:state.incoming && next.status==='ringing'});
  if(callEnded(next)){recentSid=next.sid;retryIntent=null;publish({placing:false,incoming:false});
    if(!previous || !callEnded(previous) || previous.transcript?.transcript!==next.transcript?.transcript)window.dispatchEvent(new CustomEvent('rocoto:phone-calls-changed'));
  }
}
function bindCall(call:Call,seed?:PhoneCall) {
  leg=call;
  const owner=generation,current=()=>owner===generation && leg===call;
  const from=call.parameters.From || seed?.from || '',to=call.parameters.To || seed?.to || '';
  const sid=call.customParameters?.get('ParentCallSid') || call.parameters.CallSid || seed?.sid || '';
  if(seed)acceptCall({...seed,...(sid?{sid}:{})});
  else if(sid)acceptCall({sid,direction:'inbound',from,to,startedAt:new Date().toISOString(),status:'ringing',recordingCustody:'none'});
  const update=()=>{const knownSid=call.customParameters?.get('ParentCallSid') || call.parameters.CallSid;if(knownSid && state.active && state.active.sid!==knownSid)publish({active:{...state.active,sid:knownSid}});void refreshPhoneCalls();};
  call.on('accept',()=>{if(!current())return;publish({incoming:false});update();});
  call.on('ringing',()=>{if(current())update();});
  call.on('cancel',()=>{if(!current())return;leg=null;publish({incoming:false});update();});
  call.on('disconnect',()=>{if(!current())return;leg=null;publish({incoming:false,muted:false});update();});
  call.on('reject',()=>{if(!current())return;leg=null;publish({incoming:false});update();});
  call.on('error',()=>{if(!current())return;publish({error:'Reconnect the call, then check its saved status.'});update();});
}
export function enablePhoneBrowser():Promise<void> {
  if(device && state.browser==='ready')return Promise.resolve();
  if(registration)return registration;
  const owner=generation;
  publish({browser:'connecting',error:''});
  registration=(async()=>{
    const [sdk,token]=await Promise.all([import('@twilio/voice-sdk'),phoneApi.token()]);
    if(owner!==generation)return;
    device?.destroy();
    const current=new sdk.Device(token.token,{logLevel:'error',tokenRefreshMs:60000,allowIncomingWhileBusy:false});
    device=current;
    current.on('registered',()=>{if(current===device)publish({browser:'ready',error:''});});
    current.on('unregistered',()=>{if(current===device)publish({browser:'off'});});
    current.on('error',()=>{if(current===device)publish({browser:'unavailable',error:'Reconnect this browser to receive calls.'});});
    current.on('incoming',async(call:Call)=>{
      if(current!==device || leg){call.reject();return;}
      let canonical:PhoneCall|undefined;
      const active=state.active;
      if(active && !callEnded(active)){
        if(active.direction!=='inbound' || active.status!=='ringing'){call.reject();return;}
        if(call.customParameters?.get('ParentCallSid')===active.sid)canonical=active;
        else try{canonical=await phoneApi.call(call.parameters.CallSid);}catch{call.reject();return;}
        if(owner!==generation || current!==device || leg || callEnded(canonical) || state.active?.sid!==canonical.sid){call.reject();return;}
      }
      retryIntent=null;publish({name:'',customerId:undefined,incoming:true,expanded:true,error:'',route:'browser'});bindCall(call);
      if(canonical)acceptCall(canonical,call.parameters.CallSid);
    });
    current.on('tokenWillExpire',()=>{void phoneApi.token().then(next=>{if(current===device)current.updateToken(next.token);},()=>{if(current===device)publish({error:'Reconnect this browser to renew its phone access.'});});});
    await current.register();
    if(owner!==generation || current!==device)return;
    try {localStorage.setItem(enabledKey,'enabled');}catch{/* Registration is usable for this page life. */}
  })().catch(error=>{if(owner===generation)publish({browser:'unavailable',error:phoneError(error)});throw error;}).finally(()=>{registration=null;});
  return registration;
}
export function startPhoneCall(to:string,mode:'browser'|'phone',name='',customerId?:string):Promise<void> {
  if(placing)return placing;
  if(state.active && !callEnded(state.active))return Promise.reject(new Error('Finish the current call before starting another.'));
  if(!/^\+[1-9]\d{6,14}$/.test(to.replace(/[\s()-]/g,'')))return Promise.reject(new Error('Enter the full phone number with its country code.'));
  const number=to.replace(/[\s()-]/g,'');
  if(!retryIntent || retryIntent.to!==number || retryIntent.mode!==mode)retryIntent={to:number,mode,key:crypto.randomUUID()};
  const attempt=retryIntent;
  const owner=generation;
  publish({placing:true,error:'',name,customerId,expanded:true,muted:false,incoming:false,route:mode==='browser'?'browser':'mobile'});
  placing=(async()=>{
    if(mode==='browser')await enablePhoneBrowser();
    if(owner!==generation)throw new Error('Open your current phone workspace to continue.');
    const intent=attempt.intent ?? await phoneApi.intent(number,mode,attempt.key);attempt.intent=intent;
    if(owner!==generation)return;
    if(mode==='browser') {
      if(!device)throw new Error('Connect this browser before placing the call.');
      const call=await device.connect({params:intent.params});
      if(owner!==generation){call.disconnect();return;}
      bindCall(call,{sid:intent.sid || intent.intentId,sessionId:intent.intentId,direction:'outbound',from:'',to:number,startedAt:new Date().toISOString(),status:'queued',recordingCustody:'none'});
    } else if(intent.sid){const call=await phoneApi.call(intent.sid);if(owner!==generation)return;acceptCall(call);}
    else throw new Error('Refresh the phone service to recover this call.');
    await refreshPhoneCalls();
  })().catch(error=>{if(owner===generation)publish({error:phoneError(error)});throw error;}).finally(()=>{if(owner===generation)publish({placing:false});placing=null;});
  return placing;
}
export async function answerPhoneCall() {
  if(!leg || !state.incoming)return;
  try {leg.accept();publish({incoming:false,error:''});}catch(error){publish({error:phoneError(error)});}
}
export async function endPhoneCall() {
  const owner=generation;
  const active=state.active;if(!active)return;
  if(state.incoming && leg){leg.reject();publish({incoming:false});return;}
  leg?.disconnect();
  try{const call=await phoneApi.hangup(active.sid);if(owner!==generation)return;acceptCall(call);publish({error:''});}catch(error){if(owner===generation)publish({error:phoneError(error)});}
}
export function mutePhoneCall() {if(!leg)return;const muted=!state.muted;leg.mute(muted);publish({muted});}
export function sendPhoneDigits(digits:string) {if(leg && /^[0-9*#w]{1,30}$/.test(digits))leg.sendDigits(digits);}
export function refreshPhoneCalls():Promise<void> {
  if(refreshing)return refreshing;
  const owner=generation;
  refreshing=(async()=>{
    const active=state.active;
    const rows=await phoneApi.active();if(owner!==generation)return;
    const ongoing=active && !callEnded(active);
    const next=ongoing ? rows.find(row=>row.sid===active.sid || row.parentSid===active.sid || (active.sessionId && row.sessionId===active.sessionId)) : rows[0];
    if(next){if(!ongoing && next.sid!==active?.sid)publish({name:'',customerId:undefined,expanded:true,route:'mobile'});acceptCall(next,ongoing?active.sid:undefined);}
    else if(active && active.sid!==active.sessionId) {
      try{const saved=await phoneApi.call(active.sid);if(owner===generation)acceptCall(saved,active.sid);}catch(error){if(owner===generation)publish({error:phoneError(error)});}
    } else if(!active && recentSid){const saved=await phoneApi.call(recentSid);if(owner===generation && state.active?.sid===recentSid)acceptCall(saved);}
  })().catch(error=>{if(owner===generation && state.active)publish({error:phoneError(error)});}).finally(()=>{refreshing=null;});
  return refreshing;
}
/* ── ONE DOOR ONTO THE DIAL, AND IT NEVER DESTROYS THE SURFACE IT WAS PRESSED ON ─────────────
 * «any action that has to do with calling someone should always result in the same thing, with the
 *  image»  — Peter, FEED-IA §246. Every entrance therefore ends at `PhoneDialDialog`, which draws
 * the dial or the phone artwork from the ONE capability.
 *
 * HOW it gets there depends on what would die. A customer sheet opened over a product card or a
 * knows-web card, and the chat panel's connected inbox, are COMPONENT STATE rather than history
 * layers: `location.hash='#/phone/new…'` unmounts their host, and `closeCallRoute`'s `history.back()`
 * restores the address without restoring them, so the person lands back in the list with the sheet
 * gone. Those entrances open the dial ABOVE the surface. A sheet reached by its own route loses
 * nothing, so it keeps the URL-addressable hash. */
export type PhoneDialRequest={number?:string;customerId?:string};
/* THE MESSAGES PANEL IS ONE OF THEM, and `CallDock` — the primary act of every telephone
 * conversation — stands inside it. A hash write reaches `useRouteTransition` in `shell/chats.tsx`,
 * which nulls `minimizedWorkspace` and closes the panel and the thread; `closeCallRoute`'s
 * `history.back()` then returns the address and leaves the conversation shut. So the panel joins
 * the list, and the dial mounts above the thread it was pressed in.
 * IT COUNTS ONLY WHILE IT IS STANDING. The panel's root stays in the document with `display:none`
 * once it is put away, so the test carries the panel's own «I am open» fact — `aria-hidden` is
 * absent exactly while the panel is showing — and the thread it is standing on, which is the
 * surface with something to lose. A route dial is still the canonical dial everywhere else. */
/** The surfaces a route change would take away. Each one states itself in the DOM already. */
const OVERLAY_SURFACES='[data-testid="customer-sheet-overlay"],[data-testid="connected-inbox"],'
  +'[data-testid="chats-overlay"][data-open="yes"] [data-testid="thread-view"]';
let dialHost:((request:PhoneDialRequest|null)=>void)|null=null;
/** The mounted dial host registers here; it lives inside `PhoneCallController` at the app root. */
export function registerPhoneDialHost(open:(request:PhoneDialRequest|null)=>void):()=>void {
  dialHost=open;
  return()=>{if(dialHost===open)dialHost=null;};
}
export function phoneDialOverlayStanding():boolean {
  return typeof document!=='undefined' && Boolean(document.querySelector(OVERLAY_SURFACES));
}
/** Open the dial for this number and customer, in place when a route change would cost a surface. */
export function openPhoneDial(request:PhoneDialRequest={}):void {
  if(dialHost && phoneDialOverlayStanding()){dialHost(request);return;}
  window.location.hash=phoneDialRoute(request);
}

/** The mounted controller owns polling and the audio device across every route. */
export function mountPhoneSession() {
  references++;
  if(references===1){
    void refreshPhoneCalls();timer=window.setInterval(()=>{if(!document.hidden || state.active)void refreshPhoneCalls();},1500);
    try{if(localStorage.getItem(enabledKey)==='enabled')void enablePhoneBrowser().catch(()=>{});}catch{/* The user can connect this browser from Phone setup. */}
  }
  return()=>{references=Math.max(0,references-1);if(!references){window.clearInterval(timer);timer=undefined;}};
}

/** Account access changes dispose the prior device and every private call projection. */
function resetPhoneSession() {
  generation++;device?.destroy();device=null;leg=null;recentSid='';retryIntent=null;
  try{localStorage.removeItem(enabledKey);}catch{/* The current device has already been disposed. */}
  state=INITIAL;listeners.forEach(listener=>listener());
}
if(typeof window!=='undefined'){
  window.addEventListener('rocoto:channel-workspace-reset',resetPhoneSession);
  window.addEventListener('storage',event=>{if(event.key===null || event.key.startsWith('rocoto-cedar-channel-access-v1:'))resetPhoneSession();});
}
