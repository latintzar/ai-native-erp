import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadTypeScript} from './ts-module.mjs';
const {startLivePoll}=loadTypeScript('src/prototypes/cedar/live-sync.ts',`live-sync-${process.pid}`);
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function clock(){
 let now=0,next=0,hidden=false;const timers=new Map(),listeners=new Set();
 const env={now:()=>now,hidden:()=>hidden,setTimer:(fn,delay)=>{const id=++next;timers.set(id,{fn,at:now+delay});return id;},clearTimer:id=>timers.delete(id),listen:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
 return {env,timers,listeners,setHidden:value=>{hidden=value;},wake:()=>{for(const fn of listeners)fn();},advance:async ms=>{now+=ms;for(const [id,timer]of[...timers])if(timer.at<=now){timers.delete(id);timer.fn();}await flush();}};
}
test('one active read, bounded failure backoff, recovery and disconnect cancellation',async()=>{
 const c=clock();let calls=0,finish,signal;
 const poll=startLivePoll(s=>{calls++;signal=s;return new Promise(resolve=>{finish=resolve;});},{env:c.env,interval:5000,maxDelay:30000});
 await flush();assert.equal(calls,1);c.wake();c.wake();assert.equal(calls,1);
 finish(false);await flush();assert.equal([...c.timers.values()][0].at,10000);
 await c.advance(9999);assert.equal(calls,1);c.wake();assert.equal(calls,1,'focus preserves failure backoff');
 await c.advance(1);assert.equal(calls,2);finish(false);await flush();assert.equal([...c.timers.values()][0].at,30000);
 await c.advance(20000);finish(false);await flush();assert.equal([...c.timers.values()][0].at,60000);
 await c.advance(30000);finish(true);await flush();assert.equal([...c.timers.values()][0].at,65000);
 await c.advance(5000);poll.stop();assert.equal(signal.aborted,true);finish(true);await flush();
 assert.equal(c.timers.size,0);assert.equal(c.listeners.size,0);await c.advance(60000);assert.equal(calls,5);
});
test('a hidden tab pauses reads and becoming visible resumes once',async()=>{
 const c=clock();c.setHidden(true);let calls=0;
 const poll=startLivePoll(async()=>{calls++;},{env:c.env});await flush();assert.equal(calls,0);
 c.setHidden(false);c.wake();await flush();assert.equal(calls,1);
 c.setHidden(true);await c.advance(5000);assert.equal(calls,1);assert.equal(c.timers.size,0);
 c.setHidden(false);c.wake();await flush();assert.equal(calls,2);poll.stop();
});
test('a rejected read follows the same bounded retry schedule',async()=>{
 const c=clock();let calls=0;const poll=startLivePoll(async()=>{calls++;throw new Error('offline');},{env:c.env,interval:1000,maxDelay:4000});
 await flush();assert.equal([...c.timers.values()][0].at,2000);
 await c.advance(2000);assert.equal([...c.timers.values()][0].at,6000);
 await c.advance(4000);assert.equal([...c.timers.values()][0].at,10000);assert.equal(calls,3);poll.stop();
});
