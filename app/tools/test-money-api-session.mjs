import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const records = new Map();
globalThis.localStorage = {getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
globalThis.location = new URL('https://demo.soyrocoto.com/cedar/');
globalThis.window = Object.assign(new EventTarget(),{location,localStorage,setTimeout,clearTimeout});
const api = loadTypeScript('src/prototypes/cedar/money-api.ts','money-api-session-test');
const key = 'rocoto-cedar-money-api-v1:fish';
const origin = 'https://copper-demo.soyrocoto.com';
const owner = {id:'owner-one',token:'a'.repeat(64),mode:'sample',origin};
const turn = () => new Promise(resolve=>setTimeout(resolve,0));
beforeEach(()=>{api.resetCollectionWorkspace('fish');records.clear();localStorage.setItem(key,JSON.stringify(owner));});

test('a reset during first allocation prevents the old owner binding from being saved', async()=>{
  api.resetCollectionWorkspace('fish');
  let finish;globalThis.fetch=async()=>({ok:true,json:()=>new Promise(resolve=>{finish=resolve;})});
  const pending=api.collectionOwnerRequest('fish','/bank');
  const rejected=assert.rejects(pending,/workspace/);
  while(!finish)await turn();
  api.resetCollectionWorkspace('fish');finish(owner);await rejected;
  assert.equal(localStorage.getItem(key),null);
});

test('late private JSON is discarded when another tab resets the workspace',async()=>{
  let finish,signal;globalThis.fetch=async(_,options)=>{signal=options.signal;return {ok:true,json:()=>new Promise(resolve=>{finish=resolve;})};};
  const pending=api.collectionOwnerRequest('fish','/bank');const rejected=assert.rejects(pending,/workspace/);
  while(!finish)await turn();
  localStorage.removeItem(key);const event=new Event('storage');Object.defineProperty(event,'key',{value:key});window.dispatchEvent(event);
  assert.equal(signal.aborted,true);finish({balance_minor:10000});await rejected;
});

test('an expired owner response preserves its binding and never silently creates another workspace',async()=>{
  let count=0;globalThis.fetch=async url=>{count++;assert.match(url,/\/bank$/);return new Response('{}',{status:401});};
  await assert.rejects(api.collectionOwnerRequest('fish','/bank'),/workspace/);
  assert.equal(count,1);assert.equal(JSON.parse(localStorage.getItem(key)).id,owner.id);
});

test('replacing a scope binding rejects its previous import guard but leaves another scope usable',async()=>{
  const check=api.collectionGuard('fish');
  localStorage.setItem(key,JSON.stringify({...owner,id:'owner-two',token:'b'.repeat(64)}));
  assert.throws(check,/workspace/);
  globalThis.fetch=async(_,options)=>{assert.equal(options.headers.Authorization,'Bearer '+'b'.repeat(64));return new Response('{}');};
  assert.deepEqual(await api.collectionOwnerRequest('fish','/bank'),{});
});

test('blocked browser storage preserves fixture effects and fails owner actions before network access',async()=>{
  const get=localStorage.getItem, remove=localStorage.removeItem;
  let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}');};
  localStorage.getItem=()=>{throw new DOMException('Blocked','SecurityError');};
  localStorage.removeItem=localStorage.getItem;
  try {
    const check=api.collectionGuard('fish');assert.doesNotThrow(check);
    assert.doesNotThrow(()=>api.resetCollectionWorkspace('fish'));
    await assert.rejects(api.collectionOwnerRequest('fish','/bank'),/Allow browser storage/);
    assert.equal(calls,0);
  } finally {localStorage.getItem=get;localStorage.removeItem=remove;}
});

test('collection snapshots send native PEN v2 while preserved EUR records retain v1 conversion evidence',async()=>{
  const bodies=[];
  globalThis.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);bodies.push(body);
    if(String(url).endsWith('/setup'))return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
    const total=body.invoice_amount_minor;
    return new Response(JSON.stringify({id:'remote-one',buyer_url:`${origin}/collect/remote-one/capability`,amount_minor:total,
      currency:'PEN',status:'pending',balance_minor:total,confirmed_minor:0,manual_minor:0,sample_minor:0,receipts:[]}),
      {status:201,headers:{'Content-Type':'application/json'}});
  };
  const invoice={id:'invoice-one',number:'PAY-1',saleId:'sale-one',saleNumber:'DN-1',customerName:'Buyer',customerId:'buyer',
    customerRuc:'20987654321',customerAddress:'Lima 123',sellerName:'Seller',sellerRuc:'20123456789',invoiceSeries:'F001',
    sourceTotal:100,sourceCurrency:'PEN',fxRate:1,currency:'PEN',amountMinor:10000,taxRate:18,taxMinor:1525,netMinor:8475,
    issuedAt:'2026-09-10T12:00:00Z',dueAt:'2026-09-20',status:'draft',origin:'cedar',
    lines:[{id:'line-one',name:'Goods',quantity:1,unit:'kg',amountMinor:10000}]};
  const setup={sellerName:'Seller',ruc:'20123456789',invoiceSeries:'F001',bank:'bbva',bankAccountLabel:'Receiving'};
  const link={id:'link-one',invoiceId:invoice.id,amountMinor:invoice.amountMinor,currency:'PEN'};
  await api.createCollection('fish',invoice,link,setup,[]);
  assert.deepEqual([bodies[1].billing_draft.version,bodies[1].billing_draft.source_currency,bodies[1].billing_draft.fx_rate],[2,'PEN','1']);
  bodies.length=0;
  const legacy={...invoice,id:'invoice-legacy',sourceCurrency:'EUR',fxRate:3.9,amountMinor:39000,netMinor:33051,taxMinor:5949,
    lines:[{...invoice.lines[0],amountMinor:39000}]};
  await api.createCollection('fish',legacy,{...link,id:'link-legacy',invoiceId:legacy.id,amountMinor:39000},setup,[]);
  assert.deepEqual([bodies[1].billing_draft.version,bodies[1].billing_draft.source_currency,bodies[1].billing_draft.fx_rate],[1,'EUR','3.9']);
});

test('the collection response validates exact quote arithmetic and receipt rounding',async()=>{
  const snapshot={id:'remote-one',buyer_url:`${origin}/collect/remote-one/capability`,amount_minor:10003,
    currency:'PEN',status:'pending',balance_minor:10000,confirmed_minor:0,manual_minor:0,sample_minor:0,
    quote_id:'quote-one',rounding_minor:3,quote_status:'ready',rounding_received_minor:0,receipts:[]};
  const read=async value=>{globalThis.fetch=async()=>new Response(JSON.stringify(value));return api.readCollection('fish','remote-one');};
  assert.equal((await read(snapshot)).amount_minor,10003);
  for(const patch of [{rounding_minor:2},{quote_id:null},{amount_minor:10004},{quote_status:'paid'},{rounding_minor:100},{rounding_received_minor:-1}]) {
    await assert.rejects(read({...snapshot,...patch}));
  }
  await assert.rejects(read({...snapshot,receipts:[{id:'r',amount_minor:10003,rounding_minor:100,currency:'PEN',reference:'r',
    method:'yape',source:'sample',status:'matched',created_at:'2026-09-15T12:00:00Z'}]}));
});

test('collection receipt arrival timestamps are validated while legacy snapshots remain readable', async()=>{
  const receipt={id:'sample-one',amount_minor:10000,currency:'PEN',reference:'sample-one',method:'yape',source:'sample',
    status:'matched',created_at:'2026-09-15T14:45:01Z',received_at:'2026-09-15T19:01:00Z'};
  const remote={id:'remote-one',buyer_url:`${origin}/collect/remote-one/capability`,amount_minor:10000,currency:'PEN',
    status:'paid',balance_minor:0,confirmed_minor:0,manual_minor:0,sample_minor:10000,receipts:[receipt]};
  const respond=value=>{globalThis.fetch=async()=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});};
  respond(remote);
  assert.equal((await api.readCollection('fish','remote-one')).receipts[0].received_at,receipt.received_at);
  for(const received_at of ['invalid',null,42]) {
    respond({...remote,receipts:[{...receipt,received_at}]});
    await assert.rejects(api.readCollection('fish','remote-one'),/Review the collection service response/);
  }
  const {received_at,...legacy}=receipt;
  respond({...remote,receipts:[legacy]});
  assert.equal((await api.readCollection('fish','remote-one')).receipts[0].received_at,undefined);
});

test('bank reads carry the persisted fixture calendar across a later boot day', async()=>{
  const urls=[];
  globalThis.fetch=async url=>{urls.push(String(url));return new Response(JSON.stringify({ready:false}));};
  const saved={version:1,scope:'fish',fixtureDay:'2026-09-11',fixtureRevision:2};
  localStorage.setItem('rocoto-cedar-money-v1:fish',JSON.stringify(saved));
  await api.readBankSnapshot('fish');
  assert.match(urls.at(-1),/\/bank\?fixture_day=2026-09-11&fixture_revision=2$/);
  assert.equal(api.bankReadPath('fish','/bank/movements'),'/bank/movements?fixture_day=2026-09-11&fixture_revision=2');
  localStorage.setItem('rocoto-cedar-money-v1:fish',JSON.stringify({...saved,fixtureRevision:undefined}));
  assert.equal(api.bankReadPath('fish','/bank'),'/bank?fixture_day=2026-09-11&fixture_revision=1');
  for(const patch of [{scope:'meat'},{fixtureDay:'2026-02-30'},{fixtureRevision:3},{fixtureDay:'2100-01-01'}]){
    localStorage.setItem('rocoto-cedar-money-v1:fish',JSON.stringify({...saved,...patch}));
    assert.equal(api.bankReadPath('fish','/bank'),'/bank');
  }
});

test('an order link sends its commercial document number and defers fiscal details',async()=>{
  let captured;
  globalThis.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);
    if(String(url).endsWith('/setup'))return new Response('{}');
    captured=body;
    return new Response(JSON.stringify({id:'remote-one',buyer_url:`${origin}/collect/remote-one/capability`,amount_minor:10000,
      currency:'PEN',status:'pending',balance_minor:10000,confirmed_minor:0,manual_minor:0,sample_minor:0,receipts:[]}));
  };
  const invoice={id:'invoice-one',number:'1509-001',saleId:'sale-one',saleNumber:'1509-001',customerName:'Buyer',customerId:'buyer',
    customerRuc:'',sellerName:'Seller',sellerRuc:'',sourceTotal:100,sourceCurrency:'PEN',fxRate:1,currency:'PEN',amountMinor:10000,
    taxRate:0,taxMinor:0,netMinor:10000,issuedAt:'2026-09-15T12:00:00Z',dueAt:'2026-09-15',status:'draft',origin:'cedar',collectionOnly:true,
    lines:[{id:'line-one',name:'Goods',quantity:1,unit:'kg',amountMinor:10000}]};
  await api.createCollection('fish',invoice,{id:'link-one',invoiceId:invoice.id,amountMinor:10000,currency:'PEN'},
    {sellerName:'Seller',ruc:'',invoiceSeries:'F001',bank:'bbva',bankAccountLabel:'Receiving'},[]);
  assert.equal(captured.reference,'1509-001');
  assert.equal(captured.billing_draft,undefined);
  assert.equal(captured.commercial_document.document_number,'1509-001');
  assert.equal(captured.commercial_document.customer_ruc,undefined);
  assert.equal(captured.commercial_document.total_minor,10000);
});
