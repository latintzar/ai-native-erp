import * as React from 'react';
import type { Customer } from '../../scenarios/data/cast';
import { dayForSector,setDayForSector } from './day';
import { readEmailIntake,readEmailStatus,type EmailIntakeMessage } from './email-api';
import { useEmailSourceEpoch } from './email-source-session';
import { readSourceOrder } from './order-intake';
import type { SaleEvent } from './sale';
import { useTestWorld } from './test-chat';

const POLL_MS=5000;
const CURSOR_KEY='rocoto-cedar-email-intake-cursor-v1';

function clock(value:string):string {
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleTimeString('en-GB',{
    hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Lima',
  }):'00:00';
}

function saved(sourceEvent:string,sector:ReturnType<typeof useTestWorld>['cast']['sector']):boolean {
  return dayForSector(sector).events.some(event=>event.kind==='source-arrive'
    &&event.channel==='email'&&event.sourceEvent===sourceEvent);
}

export async function applyEmailMessage(
  message:EmailIntakeMessage,world:ReturnType<typeof useTestWorld>,guard:{
    signal?:AbortSignal;current?:()=>boolean;read?:typeof readSourceOrder;
  }={},
):Promise<boolean> {
  if(message.historical!==false||!message.text.trim()||!message.customerId)return false;
  const sourceEvent=`${message.sourceRef}:${message.sourceRevision}`;
  if(saved(sourceEvent,world.cast.sector))return true;
  const customer:Customer|undefined=world.cast.customers.find(row=>row.id===message.customerId);
  if(!customer)return false;
  const current=()=>!guard.signal?.aborted&&(guard.current?.()??true);
  if(!current())return false;
  const at=clock(message.timestamp);
  const reading=await (guard.read??readSourceOrder)({
    text:message.text,sourceEvent,at,occurredAt:message.timestamp,customer,world,signal:guard.signal,
  });
  if(!current())return false;
  const event:SaleEvent={
    kind:'source-arrive',sale:`email:${sourceEvent}`,at,customer:customer.id,
    customerName:customer.name,customerPhone:customer.phone||'',offset:0,text:message.text,
    channel:'email',sourceEvent,conversation:message.conversationId,occurredAt:message.timestamp,
    historical:false,lines:reading.lines,
    ...(reading.deliveryDay?{deliveryDay:reading.deliveryDay}:{}),
    ...(reading.needsReply?{needsReply:reading.isOrder?'order' as const:'ask' as const}:{}),
    intelligence:reading.intelligence,
  };
  if(!current())return false;
  const result=setDayForSector(world.cast.sector,previous=>{
    if(!current()||previous.events.some(row=>row.kind==='source-arrive'
      &&row.channel==='email'&&row.sourceEvent===sourceEvent))return {};
    return {events:[...previous.events,event]};
  });
  return result.events.some(row=>row.kind==='source-arrive'
    &&row.channel==='email'&&row.sourceEvent===sourceEvent);
}

/** Account-scoped live email bridge. Signed new inbound events enter the day ledger only after
 * their provider source is read and their exact private customer binding resolves server-side. */
export function EmailIntake():null {
  const world=useTestWorld();
  const epoch=useEmailSourceEpoch();
  React.useEffect(()=>{
    let alive=true,paused=false,generation=0,timer:number|undefined,active:AbortController|undefined;
    const schedule=(delay=POLL_MS)=>{if(alive&&!paused)timer=window.setTimeout(()=>void poll(),delay);};
    const poll=async()=>{
      if(!alive||paused)return;
      if(document.hidden){schedule();return;}
      const currentGeneration=++generation;
      active?.abort();
      active=new AbortController();const {signal}=active;
      const current=()=>alive&&!paused&&!signal.aborted&&generation===currentGeneration;
      try {
        const status=await readEmailStatus(signal);
        if(!current())return;
        const identity=status.accounts.filter(row=>row.mode==='connected'&&row.status==='connected')
          .map(row=>row.account_ref).sort().join(':');
        if(!identity){schedule();return;}
        const key=`${CURSOR_KEY}:${identity}`;
        let cursor='';
        try{cursor=window.localStorage.getItem(key)||'';}catch{/* Durable ledger dedupe handles replay. */}
        const page=await readEmailIntake(cursor,signal);
        if(!current())return;
        for(const message of page.messages){
          if(!await applyEmailMessage(message,world,{signal,current}))throw new Error('Email intake awaits its exact customer binding.');
          if(!current())return;
        }
        if(page.nextCursor){
          try{window.localStorage.setItem(key,page.nextCursor);}catch{/* Durable ledger dedupe handles replay. */}
        }
        schedule(page.hasMore?0:POLL_MS);
      }catch{
        if(current())schedule();
      }
    };
    const disconnect=(event:Event)=>{
      const phase=(event as CustomEvent<{phase?:string}>).detail?.phase;
      if(phase==='start'){
        paused=true;generation+=1;if(timer)window.clearTimeout(timer);active?.abort();
      }else{
        paused=false;if(timer)window.clearTimeout(timer);schedule(0);
      }
    };
    const visible=()=>{if(!document.hidden&&!paused){if(timer)window.clearTimeout(timer);void poll();}};
    window.addEventListener('rocoto:email-disconnect',disconnect);
    document.addEventListener('visibilitychange',visible);
    void poll();
    return()=>{alive=false;if(timer)window.clearTimeout(timer);active?.abort();
      window.removeEventListener('rocoto:email-disconnect',disconnect);
      document.removeEventListener('visibilitychange',visible);};
  },[epoch,world]);
  return null;
}
