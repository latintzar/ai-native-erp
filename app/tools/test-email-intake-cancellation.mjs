#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { transform } from 'rolldown/experimental';
import { parse } from '@babel/parser';

const text=readFileSync(new URL('../src/prototypes/cedar/email-intake.tsx',import.meta.url),'utf8');
const wanted=['clock','saved','applyEmailMessage'];
const ast=parse(text,{sourceType:'module',plugins:['typescript','jsx']});
const declarations=[];
for(const statement of ast.program.body){
  const row=statement.type==='ExportNamedDeclaration'?statement.declaration:statement;
  if(!row)continue;
  if(row.type==='FunctionDeclaration'&&wanted.includes(row.id?.name))declarations.push(text.slice(row.start,row.end));
  if(row.type==='VariableDeclaration'){
    const names=row.declarations.map(item=>item.id.type==='Identifier'?item.id.name:'');
    if(names.some(name=>wanted.includes(name)))declarations.push(text.slice(row.start,row.end));
  }
}
const {code,errors}=await transform('email-intake-cancellation.ts',declarations.join('\n'));
assert.equal(errors?.length??0,0,String(errors));

let stored={events:[]};
let writes=0;
const dayForSector=()=>stored;
const setDayForSector=(_sector,patch)=>{writes+=1;stored={...stored,...patch(stored)};return stored;};
const readSourceOrder=()=>{throw new Error('test must inject a reader');};
const factory=new Function('dayForSector','setDayForSector','readSourceOrder',
  `${code.replace(/^export\s+/gm,'')}\nreturn { applyEmailMessage };`);
const {applyEmailMessage}=factory(dayForSector,setDayForSector,readSourceOrder);
const message={id:'src_fixture:1',sourceRef:'src_fixture',sourceRevision:1,accountRef:'mail_fixture',
  conversationId:'email_fixture',timestamp:'2026-09-10T12:00:00Z',text:'12 kg merluza',
  historical:false,customerId:'customer'};
const world={cast:{sector:'fish',customers:[{id:'customer',name:'Customer',phone:'+15550000002'}]}};
const reading={isOrder:true,needsReply:true,deliveryDay:null,
  lines:[{product:'merluza',word:'merluza',qty:12,unit:'kg'}],
  intelligence:{mode:'model',model:'synthetic-model'}};

test('email disconnect during a slow model read cannot write a source event',async()=>{
  stored={events:[]};writes=0;
  const controller=new AbortController();let finish;
  const pending=applyEmailMessage(message,world,{signal:controller.signal,
    current:()=>!controller.signal.aborted,read:()=>new Promise(resolve=>{finish=resolve;})});
  controller.abort();finish(reading);
  assert.equal(await pending,false);assert.equal(writes,0);assert.deepEqual(stored.events,[]);
});

test('an already durable email source skips the billed reader',async()=>{
  stored={events:[{kind:'source-arrive',channel:'email',sourceEvent:'src_fixture:1'}]};writes=0;
  let reads=0;
  assert.equal(await applyEmailMessage(message,world,{read:async()=>{reads+=1;return reading;}}),true);
  assert.equal(reads,0);assert.equal(writes,0);
});

test('a bound signed source becomes one evidence-backed email event',async()=>{
  stored={events:[]};writes=0;
  assert.equal(await applyEmailMessage(message,world,{read:async()=>reading}),true);
  assert.equal(writes,1);assert.equal(stored.events.length,1);
  const [event]=stored.events;
  assert.equal(event.channel,'email');assert.equal(event.sourceEvent,'src_fixture:1');
  assert.equal(event.conversation,'email_fixture');assert.equal(event.occurredAt,message.timestamp);
  assert.equal(event.customer,'customer');assert.deepEqual(event.lines,reading.lines);
});
