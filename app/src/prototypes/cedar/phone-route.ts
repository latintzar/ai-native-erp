export type PhoneRoute =
  | {kind:'dial';number?:string;customerId?:string}
  | {kind:'call';sid:string};

const PHONE_ROOT='/phone';
const safeSid=(value:string)=>/^[A-Za-z0-9_-]{1,160}$/.test(value);

/** Canonical hash for a dial surface that can be opened, shared and restored. */
export function phoneDialRoute(options:{number?:string;customerId?:string}={}):string {
  const query=new URLSearchParams();
  if(options.number)query.set('number',options.number);
  if(options.customerId)query.set('customer',options.customerId);
  const suffix=query.toString();
  return '#'+PHONE_ROOT+'/new'+(suffix?'?'+suffix:'');
}

/** Canonical hash for the active or saved call surface. */
export function phoneCallRoute(sid:string):string {
  if(!safeSid(sid))throw new Error('Use the call reference returned by the phone service.');
  return '#'+PHONE_ROOT+'/calls/'+encodeURIComponent(sid);
}

export function parsePhoneRoute(hash:string):PhoneRoute|null {
  const raw=hash.startsWith('#')?hash.slice(1):hash;
  const [pathname,query='']=raw.split('?',2);
  if(pathname===PHONE_ROOT+'/new'){
    const params=new URLSearchParams(query),number=params.get('number')?.trim()||undefined,customerId=params.get('customer')?.trim()||undefined;
    return {kind:'dial',...(number?{number}:{}),...(customerId?{customerId}:{})};
  }
  const prefix=PHONE_ROOT+'/calls/';
  if(pathname.startsWith(prefix)){
    let sid='';
    try{sid=decodeURIComponent(pathname.slice(prefix.length));}catch{return null;}
    return safeSid(sid)?{kind:'call',sid}:null;
  }
  return null;
}
