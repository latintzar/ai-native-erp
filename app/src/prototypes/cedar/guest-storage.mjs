/** Per-app browser storage facade. It never changes window.localStorage or window.fetch. */
const namespace = `atelier-guest:${import.meta.env.VITE_ATELIER_GUEST_PREFIX}:`;
const cache = new Map();
function scoped(which){
  if(cache.has(which))return cache.get(which);
  const native=()=>window[which];
  const keys=()=>{const s=native(),out=[];for(let i=0;i<s.length;i++){const k=s.key(i);if(k?.startsWith(namespace))out.push(k.slice(namespace.length));}return out;};
  const methods={getItem:k=>native().getItem(namespace+String(k)),setItem:(k,v)=>native().setItem(namespace+String(k),String(v)),removeItem:k=>native().removeItem(namespace+String(k)),clear:()=>keys().forEach(k=>native().removeItem(namespace+k)),key:i=>keys()[i]??null};
  const facade=new Proxy({}, {get(_t,k){if(k==='length')return keys().length;if(k in methods)return methods[k];if(typeof k==='string')return methods.getItem(k);},set(_t,k,v){if(typeof k==='string')methods.setItem(k,v);return true;},deleteProperty(_t,k){if(typeof k==='string')methods.removeItem(k);return true;},ownKeys:keys,getOwnPropertyDescriptor(_t,k){return typeof k==='string'&&keys().includes(k)?{configurable:true,enumerable:true,value:methods.getItem(k),writable:true}:undefined;}});
  cache.set(which,facade);return facade;
}
export const guestLocalStorage=scoped('localStorage');
export const guestSessionStorage=scoped('sessionStorage');
const listeners=new WeakMap();
export function guestAddStorageListener(type,listener,options){
  if(type!=='storage')return window.addEventListener(type,listener,options);
  let wrapped=listeners.get(listener);
  if(!wrapped){wrapped=event=>{if(event.key!==null&&!event.key.startsWith(namespace))return;const e=new StorageEvent('storage',{key:event.key===null?null:event.key.slice(namespace.length),oldValue:event.oldValue,newValue:event.newValue,url:event.url});if(typeof listener==='function')listener(e);else listener.handleEvent(e);};listeners.set(listener,wrapped);}
  return window.addEventListener(type,wrapped,options);
}
export function guestRemoveStorageListener(type,listener,options){return window.removeEventListener(type,type==='storage'?(listeners.get(listener)||listener):listener,options);}
export const guestIndexedDB = typeof window==='undefined'||!window.indexedDB ? undefined : new Proxy(window.indexedDB,{
 get(target,key){
  if(key==='open'||key==='deleteDatabase')return (name,...args)=>target[key](namespace+String(name),...args);
  if(key==='databases')return async()=> (await target.databases()).filter(row=>row.name?.startsWith(namespace)).map(row=>({...row,name:row.name.slice(namespace.length)}));
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }
});
