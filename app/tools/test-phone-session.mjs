import assert from 'node:assert/strict';
import {test,afterEach} from 'node:test';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {compileTypeScript} from './ts-module.mjs';

const require=createRequire(import.meta.url);
const records=new Map();
globalThis.localStorage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
globalThis.sessionStorage=globalThis.localStorage;
globalThis.window=Object.assign(new EventTarget(),{setInterval,clearInterval,setTimeout,clearTimeout,localStorage});
globalThis.document={hidden:false};
class FakeCall extends EventTarget {
  rejected=false;
  digits=[];
  customParameters=new Map();
  parameters={CallSid:'CA'+'1'.repeat(32),From:'+51912345678',To:'+51987654321'};
  on(event,handler){this.addEventListener(event,handler);}
  disconnect(){} reject(){this.rejected=true;} accept(){} mute(){} sendDigits(value){this.digits.push(value);}
}
let currentDevice,currentCall,connects=0;
class FakeDevice {
  listeners=new Map();constructor(){currentDevice=this;}
  on(event,handler){this.listeners.set(event,handler);}
  async register(){this.listeners.get('registered')?.();}
  destroy(){} updateToken(){}
  async connect(){connects++;currentCall=new FakeCall();return currentCall;}
}
const sdkPath=require.resolve('@twilio/voice-sdk');
require.cache[sdkPath]={id:sdkPath,filename:sdkPath,loaded:true,exports:{Device:FakeDevice}};
const path=compileTypeScript('src/prototypes/cedar/phone-session.ts','phone-session-test');
const session=require(path),{phoneApi}=require(join(dirname(path),'phone-runtime.js'));
const call={sid:'CA'+'1'.repeat(32),direction:'outbound',from:'+51987654321',to:'+51912345678',startedAt:'2026-09-09T12:00:00Z',answeredAt:'2026-09-09T12:00:10Z',status:'in-progress',recordingCustody:'none'};
const intent={intentId:'intent-one',sid:call.sid,params:{Intent:'opaque-single-use-token',Workspace:'workspace-one'}};
phoneApi.token=async()=>({token:'test-token',identity:'cedar_test',workspaceId:'workspace-one',expiresAt:Date.now()/1000+600});
phoneApi.call=async()=>call;
phoneApi.active=async()=>[];
afterEach(()=>{window.dispatchEvent(new Event('rocoto:channel-workspace-reset'));connects=0;
  phoneApi.token=async()=>({token:'test-token',identity:'cedar_test',workspaceId:'workspace-one',expiresAt:Date.now()/1000+600});
  phoneApi.active=async()=>[];phoneApi.call=async()=>call;
});
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));

test('two presses share one intent and reject a second call while the first is active',async()=>{
  let attempts=0,resolveIntent;
  phoneApi.intent=()=>{attempts++;return new Promise(resolve=>{resolveIntent=resolve;});};
  const first=session.startPhoneCall(call.to,'phone','Customer');
  const second=session.startPhoneCall(call.to,'phone','Customer');
  assert.equal(first,second);assert.equal(attempts,1);
  resolveIntent(intent);await first;
  assert.equal(session.phoneSessionNow().active.sid,call.sid);
  await assert.rejects(()=>session.startPhoneCall('+51999999999','phone'),/current call/);
  assert.equal(attempts,1);
});
test('browser calls expose keypad digits while mobile calls retain web hangup control',async()=>{
  phoneApi.intent=async()=>intent;
  await session.startPhoneCall(call.to,'browser','Customer');
  assert.equal(session.phoneSessionNow().route,'browser');
  session.sendPhoneDigits('12#');
  assert.deepEqual(currentCall.digits,['12#']);
  phoneApi.hangup=async()=>({...call,status:'completed',endedAt:'2026-09-09T12:01:00Z'});
  await session.endPhoneCall();
  const mobile={...intent,sid:'CA'+'8'.repeat(32)};
  phoneApi.intent=async()=>mobile;phoneApi.call=async()=>({...call,sid:mobile.sid});
  await session.startPhoneCall(call.to,'phone','Customer');
  assert.equal(session.phoneSessionNow().route,'mobile');
});
test('account reset during an intent response prevents connecting the previous workspace',async()=>{
  let resolveIntent;
  phoneApi.intent=()=>new Promise(resolve=>{resolveIntent=resolve;});
  const pending=session.startPhoneCall(call.to,'browser');
  while(!resolveIntent)await turn();
  window.dispatchEvent(new Event('rocoto:channel-workspace-reset'));
  resolveIntent(intent);await pending;
  assert.equal(connects,0);assert.equal(session.phoneSessionNow().active,null);
});
test('incoming browser child leg resolves to its canonical saved call',async()=>{
  await session.enablePhoneBrowser();
  const incoming=new FakeCall();incoming.parameters.CallSid='CA'+'2'.repeat(32);
  await currentDevice.listeners.get('incoming')(incoming);
  assert.equal(session.phoneSessionNow().incoming,true);
  assert.equal(session.phoneSessionNow().active.sid,incoming.parameters.CallSid);
  await session.refreshPhoneCalls();
  assert.equal(session.phoneSessionNow().active.sid,call.sid);
  assert.equal(session.phoneSessionNow().active.status,'in-progress');
});
test('a failed token from a cleared workspace cannot replace the current browser status',async()=>{
  let rejectToken;
  phoneApi.token=()=>new Promise((_,reject)=>{rejectToken=reject;});
  const pending=session.enablePhoneBrowser();
  window.dispatchEvent(new Event('rocoto:channel-workspace-reset'));
  rejectToken(new Error('Previous account token failed'));
  await assert.rejects(()=>pending);
  assert.equal(session.phoneSessionNow().browser,'off');
  assert.equal(session.phoneSessionNow().error,'');
});
test('a new mobile call replaces an ended panel and clears the previous customer label',async()=>{
  phoneApi.intent=async()=>intent;
  phoneApi.hangup=async()=>({...call,status:'completed',endedAt:'2026-09-09T12:01:00Z'});
  await session.startPhoneCall(call.to,'phone','Previous customer');
  await session.endPhoneCall();
  const incoming={...call,sid:'CA'+'3'.repeat(32),direction:'inbound',from:'+51955555555',status:'ringing',answeredAt:undefined};
  phoneApi.active=async()=>[incoming];
  await session.refreshPhoneCalls();
  assert.equal(session.phoneSessionNow().active.sid,incoming.sid);
  assert.equal(session.phoneSessionNow().name,'');
});
test('the browser can answer an inbound call already discovered by the owner API',async()=>{
  const inbound={...call,direction:'inbound',status:'ringing',answeredAt:undefined};
  phoneApi.active=async()=>[inbound];phoneApi.call=async()=>inbound;
  await session.enablePhoneBrowser();await session.refreshPhoneCalls();
  const incoming=new FakeCall();incoming.parameters.CallSid='CA'+'2'.repeat(32);
  await currentDevice.listeners.get('incoming')(incoming);
  assert.equal(incoming.rejected,false);
  assert.equal(session.phoneSessionNow().incoming,true);
  assert.equal(session.phoneSessionNow().active.sid,inbound.sid);
});
test('the provider parent parameter binds ringing before its child status callback arrives',async()=>{
  const inbound={...call,direction:'inbound',status:'ringing',answeredAt:undefined};
  phoneApi.active=async()=>[inbound];
  phoneApi.call=async()=>{throw new Error('Child callback pending');};
  await session.enablePhoneBrowser();await session.refreshPhoneCalls();
  const incoming=new FakeCall();incoming.parameters.CallSid='CA'+'2'.repeat(32);
  incoming.customParameters.set('ParentCallSid',inbound.sid);
  await currentDevice.listeners.get('incoming')(incoming);
  assert.equal(incoming.rejected,false);
  assert.equal(session.phoneSessionNow().incoming,true);
  assert.equal(session.phoneSessionNow().active.sid,inbound.sid);
});
test('disposed SDK events cannot relabel a call in the new workspace',async()=>{
  phoneApi.intent=async()=>intent;
  await session.startPhoneCall(call.to,'browser');const previousLeg=currentCall;
  window.dispatchEvent(new Event('rocoto:channel-workspace-reset'));
  const next={...call,sid:'CA'+'4'.repeat(32)};
  phoneApi.intent=async()=>({...intent,sid:next.sid});phoneApi.call=async()=>next;
  await session.startPhoneCall(call.to,'phone');
  previousLeg.dispatchEvent(new Event('ringing'));
  assert.equal(session.phoneSessionNow().active.sid,next.sid);
});
