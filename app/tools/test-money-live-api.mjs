import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';
const records=new Map();
globalThis.localStorage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
globalThis.location=new URL('https://demo.soyrocoto.com/cedar/');
globalThis.window=Object.assign(new EventTarget(),{location,localStorage,setTimeout,clearTimeout});
const api=loadTypeScript('src/prototypes/cedar/money-live-api.ts','money-live-api-test');
const key='rocoto-cedar-money-api-v1:fish',origin='https://copper-demo.soyrocoto.com';
const cursor='a'.repeat(64),remote={id:'remote-one',buyer_url:`${origin}/collect/remote-one/capability`,amount_minor:10000,currency:'PEN',status:'pending',balance_minor:10000,confirmed_minor:0,manual_minor:0,sample_minor:0,receipts:[]};
const respond=value=>{globalThis.fetch=async()=>Response.json(value);};
beforeEach(()=>{records.clear();localStorage.setItem(key,JSON.stringify({id:'owner-one',token:'a'.repeat(64),mode:'sample',origin}));});
test('one owner snapshot decodes complete requests and acknowledges an unchanged cursor',async()=>{
 respond({cursor,changed:true,requests:[remote]});assert.equal((await api.readCollectionUpdates('fish')).requests[0].id,remote.id);
 globalThis.fetch=async(url,options)=>{assert.match(String(url),new RegExp(`/request-updates\\?cursor=${cursor}$`));assert.equal(options.headers.Authorization,'Bearer '+'a'.repeat(64));return Response.json({cursor,changed:false,requests:[]});};
 assert.deepEqual(await api.readCollectionUpdates('fish',cursor),{cursor,changed:false,requests:[]});
});
test('malformed cursor pages and duplicated identities cannot replace a ledger',async()=>{
 for(const patch of [{cursor:'invalid'},{changed:'yes'},{requests:[remote,remote]},{requests:[{...remote,amount_minor:-1}]},{changed:false,requests:[remote]},{changed:false,cursor:'b'.repeat(64),requests:[]}]){
  respond({cursor,changed:true,requests:[remote],...patch});await assert.rejects(api.readCollectionUpdates('fish',cursor));
 }
});
test('a scope replacement during cursor delivery discards old private rows',async()=>{
 let finish;globalThis.fetch=async()=>({ok:true,json:()=>new Promise(resolve=>{finish=resolve;})});
 const pending=api.readCollectionUpdates('fish');const rejected=assert.rejects(pending,/workspace/);
 while(!finish)await new Promise(resolve=>setTimeout(resolve,0));
 localStorage.setItem(key,JSON.stringify({id:'replacement',token:'b'.repeat(64),mode:'sample',origin}));
 finish({cursor,changed:true,requests:[remote]});await rejected;
});
