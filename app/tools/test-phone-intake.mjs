import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { transform } from 'rolldown/experimental';
import { parse } from '@babel/parser';
const source=readFileSync(new URL('../src/prototypes/cedar/phone-intake-model.ts',import.meta.url),'utf8');
const transformed=await transform('phone-intake-model.ts',source);
const {parsePhoneSources,phoneSourceChunks,phoneChunkId,phoneCallWindow,readPhoneCursor,writePhoneCursor,processPhoneCallWindow}=await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`);
const at='2026-09-10T12:00:00Z', sid='CAfixture';
const utterance=(id,start,text='12 kg merluza',speaker=1)=>({id,start,end:start+1,text,speaker,track:'inbound',final:true});
const event=(sequence,row,kind='final_delta')=>({id:`event_${sequence}`,sequence,call_sid:sid,kind,mode:kind==='final_delta'?'incremental':'historical',created_at:at,evidence:[row]});
const page=events=>({call_sid:sid,events,next_cursor:events.length?events[events.length-1].sequence:0,has_more:false});

test('history and house speech are acknowledged without an order chunk',()=>{
  const result=phoneSourceChunks(parsePhoneSources(page([event(1,utterance('h',0), 'full_transcript'),event(2,utterance('house',2,'Confirmed',0))]),sid,0),new Set(),Date.parse(at)+3000,true);
  assert.equal(result.chunks.length,0);assert.equal(result.acknowledgedThrough,2);
});
test('live customer speech waits for silence, groups adjacent finals and preserves quotes',()=>{
  const input=page([event(1,utterance('a',0)),event(2,utterance('b',1.2,'5 kg salmon'))]);
  assert.equal(phoneSourceChunks(input,new Set(),Date.parse(at)+500,false).chunks.length,0);
  const result=phoneSourceChunks(input,new Set(),Date.parse(at)+1800,false);
  assert.equal(result.chunks.length,1);assert.deepEqual(result.chunks[0].utterances.map(row=>row.text),['12 kg merluza','5 kg salmon']);assert.equal(result.acknowledgedThrough,2);
});
test('an aged customer final flushes before a full source page can hold the cursor',()=>{
  const events=[event(1,utterance('customer',0))];
  for(let sequence=2;sequence<=100;sequence++)events.push(event(sequence,utterance(`house-${sequence}`,sequence,'Confirmed',0)));
  const result=phoneSourceChunks({...page(events),has_more:true},new Set(),Date.parse(at)+60000,false);
  assert.equal(result.chunks.length,1);assert.equal(result.chunks[0].utterances[0].id,'customer');assert.equal(result.acknowledgedThrough,100);
});
test('size bounds flush while the next pending event retains its cursor',()=>{
  const input=page([event(1,utterance('a',0,'a'.repeat(500))),event(2,utterance('b',1.2,'b'.repeat(500)))]);
  const result=phoneSourceChunks(input,new Set(),Date.parse(at)+200,false);
  assert.equal(result.chunks.length,1);assert.equal(result.chunks[0].boundary,'size');assert.equal(result.acknowledgedThrough,1);
  assert.equal(phoneSourceChunks(input,new Set(),Date.parse(at)+200,true).chunks.length,2);
});
test('regrouped replay skips utterances already applied and preserves workspace identity',async()=>{
  const input=page([event(1,utterance('a',0)),event(2,utterance('b',3.5))]);
  const result=phoneSourceChunks(input,new Set(['a']),Date.parse(at)+3000,true);
  assert.deepEqual(result.chunks[0].utterances.map(row=>row.id),['b']);
  assert.notEqual(await phoneChunkId('workspaceA',sid,result.chunks[0]),await phoneChunkId('workspaceB',sid,result.chunks[0]));
});
test('a foreign call, corrupt cursor or interim role shape cannot acknowledge a page',()=>{
  const input=page([event(1,utterance('a',0))]);
  assert.throws(()=>parsePhoneSources(input,'another',0));
  assert.throws(()=>parsePhoneSources({...input,next_cursor:5},sid,0));
  assert.throws(()=>parsePhoneSources(page([event(1,{...utterance('a',0),speaker:99})]),sid,0));
});
test('the bounded call window keeps all 200 runtime calls, including an overnight active call',()=>{
  const calls=Array.from({length:200},(_,index)=>({sid:`CA${index}`,startedAt:index===199?'2026-09-09T23:59:00-05:00':'2026-09-10T07:00:00-05:00'}));
  const selected=phoneCallWindow(calls);
  assert.equal(selected.length,200);assert.equal(selected[50].sid,'CA50');assert.equal(selected[199].sid,'CA199');
});
test('a malformed call and unavailable cursor storage leave the next call available',async()=>{
  const memory=new Map(),storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  const visited=[];
  await processPhoneCallWindow(['malformed','storage','valid'],()=>true,async call=>{
    visited.push(call);
    if(call==='malformed')parsePhoneSources({...page([]),call_sid:'another'},sid,0);
    if(call==='storage'){
      assert.equal(readPhoneCursor('cursor',memory,storage),0);
      writePhoneCursor('cursor',7,memory,storage);
      assert.equal(readPhoneCursor('cursor',memory,storage),7);
    }
  });
  assert.deepEqual(visited,['malformed','storage','valid']);
});

const client=readFileSync(new URL('../src/prototypes/cedar/phone-intake.tsx',import.meta.url),'utf8');
const ast=parse(client,{sourceType:'module',plugins:['typescript','jsx']});
const declarations=ast.program.body.map(row=>row.type==='ExportNamedDeclaration'?row.declaration:row).filter(row=>row?.type==='FunctionDeclaration'&&row.id.name==='applyPhoneSourceChunk').map(row=>client.slice(row.start,row.end)).join('\n');
const {code}=await transform('phone-intake-client.ts',declarations);
let stored={events:[]},writable=true;
const apply=new Function('phoneChunkId','dayForSector','customerFor','sourceClock','readSourceOrder','setDayForSector',`${code.replace(/^export\s+/gm,'')}\nreturn applyPhoneSourceChunk;`)(
  phoneChunkId,()=>stored,()=>({id:'customer',name:'Customer',phone:'+15550000002'}),()=> '07:00',()=>{throw Error('Inject reader');},
  (_scope,patch)=>{if(writable)stored={...stored,...patch(stored)};return stored;});
const chunk=phoneSourceChunks(page([event(1,utterance('a',0))]),new Set(),Date.parse(at)+3000,true).chunks[0];
const reading={isOrder:true,needsReply:true,deliveryDay:null,lines:[{product:'merluza',word:'merluza',qty:12,unit:'kg'}],intelligence:{mode:'model'}};
const world={cast:{sector:'fish'}};
test('failed durable save retains the cursor; retry saves evidence and later replay avoids another billed read',async()=>{
  stored={events:[]};writable=false;let reads=0;
  const read=async()=>{reads++;return reading;};
  assert.equal(await apply({sid},chunk,world,'private',{read}),false);
  writable=true;
  assert.equal(await apply({sid},chunk,world,'private',{read}),true);
  assert.equal(stored.events[0].phoneSource.sourceIds[0],`phone:private:${sid}:a`);
  assert.equal(await apply({sid},chunk,world,'private',{read}),true);assert.equal(reads,2);assert.equal(stored.events.length,1);
});
test('disconnect during a pending reading prevents an order arrival',async()=>{
  stored={events:[]};const controller=new AbortController();let release;
  const pending=apply({sid},chunk,world,'private',{signal:controller.signal,read:()=>new Promise(resolve=>{release=resolve;})});
  while(!release)await new Promise(resolve=>setTimeout(resolve,0));
  controller.abort();release(reading);
  assert.equal(await pending,false);assert.equal(stored.events.length,0);
});
