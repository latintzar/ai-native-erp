import * as React from 'react';
import { ChannelApiError, channelApi } from './cedar-channel-api';
import { parsePhoneCall, type PhoneCall } from './phone-call-model';
import { PHONE_RECORDING_WIRE, phoneCapabilityOf, type PhoneCapability, type PhoneRecordingChoice } from './phone-capability';

export type PhoneSetupChoices = {source_number:string;fallback_number:string;recording:PhoneRecordingChoice;live_transcription:boolean};
export type PhoneReadiness = {configured:boolean;account_verified:boolean;inbound_number:string;caller_id:string;caller_id_verified:boolean;
  browser_ready:boolean;forwarding_state:'not-run'|'waiting'|'received'|'verified';transcription_ready:boolean};
export type PhoneLineEvidence = {line_id:string;mode:'prepared'|'commissioned';setup:PhoneSetupChoices;readiness:PhoneReadiness;checks:Record<string,unknown>};
export type PhoneSetupEvidence = {
  workspace_id:string;mode:'sample'|'commissioned';setup:PhoneSetupChoices;
  readiness:PhoneReadiness;checks:Record<string,unknown>;default_line_id:string|null;lines:PhoneLineEvidence[];
};
export type PhoneToken = {token:string;identity:string;workspaceId:string;expiresAt:number};
export type PhoneIntent = {intentId:string;sid?:string;params:{Intent:string;Workspace:string}};
const invalid = () => new Error('Refresh the phone connection to read its latest status.');
function line(raw:unknown):PhoneLineEvidence {
  if (!raw || typeof raw !== 'object') throw invalid();
  const value=raw as PhoneLineEvidence,ready=value.readiness,choices=value.setup;
  if (!/^line_[A-Za-z0-9_-]{16,64}$/.test(value.line_id) || !['prepared','commissioned'].includes(value.mode)
    || !choices || !ready || typeof choices.source_number !== 'string' || typeof choices.fallback_number !== 'string'
    || !PHONE_RECORDING_WIRE.includes(choices.recording) || typeof choices.live_transcription !== 'boolean'
    || !['configured','account_verified','caller_id_verified','browser_ready','transcription_ready'].every(key=>typeof ready[key as keyof typeof ready]==='boolean')
    || !['inbound_number','caller_id'].every(key=>typeof ready[key as keyof typeof ready]==='string')
    || !['not-run','waiting','received','verified'].includes(ready.forwarding_state)) throw invalid();
  return value;
}
function setup(raw:unknown):PhoneSetupEvidence {
  if (!raw || typeof raw !== 'object') throw invalid();
  const value=raw as PhoneSetupEvidence, ready=value.readiness, choices=value.setup;
  if (!value.workspace_id || !['sample','commissioned'].includes(value.mode) || !choices || !ready
    || typeof choices.source_number !== 'string' || typeof choices.fallback_number !== 'string'
    || !PHONE_RECORDING_WIRE.includes(choices.recording) || typeof choices.live_transcription !== 'boolean'
    || !['configured','account_verified','caller_id_verified','browser_ready','transcription_ready'].every(key=>typeof ready[key as keyof typeof ready]==='boolean')
    || !['inbound_number','caller_id'].every(key=>typeof ready[key as keyof typeof ready]==='string')
    || !['not-run','waiting','received','verified'].includes(ready.forwarding_state)) throw invalid();
  value.lines=Array.isArray(value.lines)?value.lines.map(line):[];
  value.default_line_id=typeof value.default_line_id==='string'?value.default_line_id:null;
  if(value.default_line_id && !value.lines.some(row=>row.line_id===value.default_line_id))throw invalid();
  return value;
}
/* ── A READ THAT BEGAN BEFORE A WRITE IS OLDER THAN THE TRUTH ────────────────────────────────
 * `POST /phone/lines` and every other write changes what `/phone/setup` answers. A read already in
 * flight when one landed carries the state BEFORE it, so publishing that response walks the
 * snapshot backwards — and a snapshot that walks backwards is read as a REVOCATION: the line the
 * walk had just created stopped being reported, and phone setup threw the first `Connect phone` on
 * a sample account back to step 0 under «This line was disconnected».
 * `writes` is the write generation, in the same shape as `revision`: every write stamps it, a read
 * records it when it starts, and `refreshPhoneSetup` discards a response whose stamp has moved.
 * AND A WRITE DROPS THE DOOMED READ WITH IT. `refreshPhoneSetup` hands a second caller the read
 * already in flight, so `await provider.refresh()` straight after a write — which is how phone
 * setup's last two steps are written — could be handed a task the stamp has already condemned:
 * the awaited refresh resolved having published nothing, and the caller ID the provider had just
 * verified stayed missing from the capability until the next poll. Clearing `pending` here means
 * the next reader starts a fresh read instead. The settling task's own `.finally` is guarded by
 * `if(pending===task)`, so a read that is still legitimate is never clobbered. */
let writes=0;
/** The read holding the refresh slot, declared here because a write drops it (see above). */
let pending:Promise<void>|null=null;
const wrote=async<T>(request:Promise<T>):Promise<T>=>{try{return await request;}finally{writes++;pending=null;}};
export const phoneApi = {
  setup:async()=>setup(await channelApi('/phone/setup')),
  saveSetup:async(body:PhoneSetupChoices)=>setup(await wrote(channelApi('/phone/setup',{body}))),
  addLine:async(body:PhoneSetupChoices)=>line(await wrote(channelApi('/phone/lines',{body}))),
  saveLineSetup:async(lineId:string,body:PhoneSetupChoices)=>line(await wrote(channelApi(`/phone/lines/${lineId}/setup`,{body}))),
  disconnectLine:async(lineId:string)=>setup(await wrote(channelApi(`/phone/lines/${lineId}`,{method:'DELETE'}))),
  setDefaultLine:async(lineId:string)=>setup(await wrote(channelApi(`/phone/lines/${lineId}/default`,{body:{}}))),
  startCallerId:async(number:string)=>wrote(channelApi<{validation_code:string;status:string}>('/phone/caller-id/start',{body:{number}})),
  startLineCallerId:async(lineId:string,number:string)=>wrote(channelApi<{validation_code:string;status:string}>(`/phone/lines/${lineId}/caller-id/start`,{body:{number}})),
  checkCallerId:async(number:string)=>setup(await wrote(channelApi('/phone/caller-id/check',{body:{number}}))),
  checkLineCallerId:async(lineId:string,number:string)=>line(await wrote(channelApi(`/phone/lines/${lineId}/caller-id/check`,{body:{number}}))),
  testForwarding:async(expected_from:string)=>setup(await wrote(channelApi('/phone/forwarding-test',{body:{expected_from}}))),
  testLineForwarding:async(lineId:string,expected_from:string)=>line(await wrote(channelApi(`/phone/lines/${lineId}/forwarding-test`,{body:{expected_from}}))),
  token:async():Promise<PhoneToken>=>{
    let deviceId=sessionStorage.getItem('rocoto-cedar-phone-device-v1');
    if (!deviceId || !/^[a-zA-Z0-9-]{1,80}$/.test(deviceId)) {deviceId=crypto.randomUUID();sessionStorage.setItem('rocoto-cedar-phone-device-v1',deviceId);}
    const value=await channelApi<PhoneToken>('/phone/token',{body:{device_id:deviceId}});
    if (!value || typeof value.token!=='string' || value.token.length<32 || !/^[A-Za-z0-9_]{1,121}$/.test(value.identity)
      || typeof value.workspaceId!=='string' || !Number.isFinite(value.expiresAt) || value.expiresAt*1000<=Date.now()) throw invalid();
    return value;
  },
  intent:async(to:string,mode:'browser'|'phone',idempotency_key:string):Promise<PhoneIntent>=>{
    const value=await channelApi<PhoneIntent>('/phone/calls',{body:{to,mode,idempotency_key}});
    if (!value || typeof value.intentId!=='string' || !value.params || typeof value.params.Intent!=='string'
      || !value.params.Intent || typeof value.params.Workspace!=='string'
      || Object.keys(value.params).some(key=>!['Intent','Workspace'].includes(key)) || (value.sid!==undefined && typeof value.sid!=='string')) throw invalid();
    return value;
  },
  active:async():Promise<PhoneCall[]>=>{
    const rows=await channelApi<unknown>('/phone/calls/active');
    if (!Array.isArray(rows) || rows.length>100) throw invalid();
    return rows.map(parsePhoneCall);
  },
  history:async(number:string):Promise<PhoneCall[]>=>{
    const rows=await channelApi<unknown>(`/phone/calls?number=${encodeURIComponent(number)}`);
    if (!Array.isArray(rows) || rows.length>2000) throw invalid();
    return rows.map(parsePhoneCall);
  },
  call:async(sid:string)=>parsePhoneCall(await channelApi(`/phone/calls/${encodeURIComponent(sid)}`)),
  hangup:async(sid:string)=>parsePhoneCall(await channelApi(`/phone/calls/${encodeURIComponent(sid)}/hangup`,{body:{}})),
};

/* ── THE CONNECTION'S STATE IS POLLED, NOT REMEMBERED ONCE (FEED-IA §246) ────────────────────
 * «it's not fully stateless … You hard-coded the state, which should always just sort of poll, or
 *  whatever you want to call it, for the state of the connection.»
 *
 * The snapshot used to be read ONCE per page life, so a line commissioned in another tab, a
 * caller ID verified on a phone, or a line revoked by an operator stayed invisible until reload.
 * It is now refreshed on every boundary a person can feel — returning to the tab, focusing the
 * window, and a minute passing with a subscriber mounted — with a floor of ten seconds so a
 * flurry of focus events is one read. `revision` keeps its generation guard: a response from a
 * previous workspace can never overwrite the current one. */
/* A FAILED READ IS A FACT ABOUT THE NETWORK, NOT ABOUT THE LINE. The error branch used to publish
 * `{status:'unavailable', evidence:null}`, so one 503 sixty seconds into a live call revoked a
 * commissioned line: the dial swapped its keypad for the artwork, Connections read `Connect phone`
 * and the controller's own mount dropped the 1.5 s active-call poll. The evidence now SURVIVES a
 * read that could not confirm it — the snapshot keeps its posture and records `staleSince`, the
 * surfaces add one quiet `Checking…` line — and only the provider's own answer about this
 * workspace (401, 403, 404) clears the line.
 * THAT CLEARING IS A SETTLED POSTURE, so it carries `staleSince: 0`. `stale` means «this evidence
 * stands and the last read failed to confirm it», and a branch that clears the evidence has nothing
 * left to be unsure about. Marking it stale printed «Connect phone to call from Rocoto. Checking…»
 * on every telephone customer's sheet of a workspace whose connection cannot be read, renewed by
 * every sixty-second failure: a definitive answer is a fact, and a fact is never a pending check. */
type ProviderState = {status:'checking'|'ready'|'unavailable';evidence:PhoneSetupEvidence|null;error:string;checkedAt:number;staleSince:number};
const REFRESH_FLOOR_MS=10000, REFRESH_PERIOD_MS=60000;
/** The statuses that mean «this workspace holds no phone connection», in the provider's own words. */
const DEFINITIVE=[401,403,404];
let snapshot:ProviderState={status:'checking',evidence:null,error:'',checkedAt:0,staleSince:0};
const listeners=new Set<()=>void>();
let revision=0,period=0;
function publish(next:ProviderState) {snapshot=next;listeners.forEach(listener=>listener());}
export function phoneProviderNow():ProviderState {return snapshot;}
/** Publish evidence a caller holds directly. It is newer than any read already in flight, so it
 *  stamps the write generation too, drops the read holding the slot, and those reads are discarded
 *  when they land. */
export function acceptPhoneSetup(evidence:PhoneSetupEvidence) {writes++;pending=null;publish({status:'ready',evidence,error:'',checkedAt:Date.now(),staleSince:0});}
/** What a failed read leaves standing. A posture the provider settled — its own answer about this
 *  workspace, or a first read with nothing behind it — is `unavailable` and `staleSince: 0`: a
 *  settled fact is never «Checking…». Everything else keeps the last evidence and marks it stale. */
export function declinePhoneSetup(error:unknown) {
  const now=Date.now(), message=phoneError(error);
  const definitive=error instanceof ChannelApiError && DEFINITIVE.includes(error.status);
  if(definitive || !snapshot.evidence){publish({status:'unavailable',evidence:null,error:message,checkedAt:now,staleSince:0});return;}
  publish({status:snapshot.status,evidence:snapshot.evidence,error:message,checkedAt:now,staleSince:snapshot.staleSince || now});
}
export function refreshPhoneSetup():Promise<void> {
  if(pending)return pending;
  const owner=revision,began=writes;
  const fresh=()=>owner===revision && began===writes;
  const task=phoneApi.setup().then(evidence=>{if(fresh())acceptPhoneSetup(evidence);},error=>{if(fresh())declinePhoneSetup(error);}).finally(()=>{if(pending===task)pending=null;});
  pending=task;
  return pending;
}
/** A bounded wake-up: the tab came back, so read the connection again unless one just landed. */
function wakePhoneSetup() {
  if(typeof document!=='undefined' && document.visibilityState==='hidden')return;
  if(Date.now()-snapshot.checkedAt<REFRESH_FLOOR_MS)return;
  void refreshPhoneSetup();
}
function watchPhoneSetup() {
  if(period || typeof window==='undefined')return;
  window.addEventListener('focus',wakePhoneSetup);
  document.addEventListener('visibilitychange',wakePhoneSetup);
  period=window.setInterval(()=>{if(!document.hidden)void refreshPhoneSetup();},REFRESH_PERIOD_MS);
}
function unwatchPhoneSetup() {
  if(!period || typeof window==='undefined')return;
  window.removeEventListener('focus',wakePhoneSetup);
  document.removeEventListener('visibilitychange',wakePhoneSetup);
  window.clearInterval(period);period=0;
}
/** One sentence for every failure, including the ones that arrive with nothing in them. A refusal
 *  whose body carried no detail reached the surfaces as an empty message, and an empty message
 *  renders as an empty alert — the person read a dead button and no reason at all. */
export function phoneError(error:unknown):string {
  const said=error instanceof Error ? error.message.trim() : '';
  return said || 'Reconnect the phone service, then try again.';
}
export function usePhoneProvider() {
  const state=React.useSyncExternalStore(React.useCallback((listener:()=>void)=>{
    listeners.add(listener);
    if(listeners.size===1)watchPhoneSetup();
    return()=>{listeners.delete(listener);if(!listeners.size)unwatchPhoneSetup();};
  },[]),()=>snapshot,()=>snapshot);
  React.useEffect(()=>{if(!snapshot.checkedAt && !pending)void refreshPhoneSetup();},[state.checkedAt]);
  return {...state,refresh:refreshPhoneSetup};
}
/** The capability every call entrance reads: one posture, one selected line, one pending list. */
export function usePhoneCapability():PhoneCapability & {refresh:()=>Promise<void>} {
  const state=usePhoneProvider();
  const capability=React.useMemo(()=>phoneCapabilityOf(state),[state.status,state.evidence,state.error,state.checkedAt,state.staleSince]);
  return {...capability,refresh:state.refresh};
}
function resetPhoneProvider(){revision++;pending=null;publish({status:'checking',evidence:null,error:'',checkedAt:0,staleSince:0});if(listeners.size)void refreshPhoneSetup();}
if(typeof window!=='undefined'){
  window.addEventListener('rocoto:channel-workspace-reset',resetPhoneProvider);
  /* Reset Cedar's own announcement (workspace-reset.ts): a released line drops its snapshot on a
     document that keeps running, the same rule money, WhatsApp and email follow. */
  window.addEventListener('rocoto:cedar-workspace-reset',resetPhoneProvider);
  window.addEventListener('storage',event=>{if(event.key===null || event.key.startsWith('rocoto-cedar-channel-access-v1:'))resetPhoneProvider();});
}
