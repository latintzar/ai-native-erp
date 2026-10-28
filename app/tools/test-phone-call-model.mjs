import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const model = loadTypeScript('src/prototypes/cedar/phone-call-model.ts', 'phone-call-model-test');
const call = { sid:'CA123', direction:'inbound', from:'+51912345678', to:'+51987654321', startedAt:'2026-09-09T12:00:00Z', answeredAt:'2026-09-09T12:00:10Z', status:'in-progress', recordingCustody:'none' };

test('call time counts answered seconds and freezes at the provider end', () => {
  assert.equal(model.callSeconds(call, Date.parse('2026-09-09T12:00:25Z')), 15);
  assert.equal(model.callSeconds({...call,status:'ringing',answeredAt:undefined}, Date.parse('2026-09-09T12:00:25Z')), 0);
  assert.equal(model.callSeconds({...call,status:'completed',endedAt:'2026-09-09T12:00:30Z'}, Date.parse('2026-09-09T13:00:00Z')), 20);
});
test('late ringing snapshots preserve an already completed call and enrich its transcript', () => {
  const completed={...call,status:'completed',endedAt:'2026-09-09T12:01:00Z'};
  const merged=model.mergePhoneCall(completed,{...call,status:'ringing',answeredAt:undefined});
  assert.equal(merged.status,'completed');
  assert.equal(merged.endedAt,completed.endedAt);
  assert.equal(model.mergePhoneCall(completed,{...completed,transcript:{transcript:'Hola',utterances:[{speaker:0,start:0,end:1,text:'Hola'}],language:'es',provider:'deepgram nova-3'}}).transcript.transcript,'Hola');
});
test('phone identity requires one exact international number match', () => {
  const customers=[{id:'peru',name:'Peru',phone:'+51 912 345 678'},{id:'spain',name:'Spain',phone:'+34 912 345 678'}];
  assert.equal(model.customerForPhone(customers,'+51912345678')?.id,'peru');
  assert.equal(model.customerForPhone(customers,'912345678'),undefined);
  assert.equal(model.customerForPhone([...customers,{...customers[0],id:'duplicate'}],'+51912345678'),undefined);
});
test('provider projections reject invalid dates, durations and executable content shapes', () => {
  assert.equal(model.parsePhoneCall(call).sid,call.sid);
  for (const patch of [{status:'connected'}, {durationSeconds:-1}, {startedAt:'today'}, {liveTranscript:{utterances:[{id:'a',track:'outbound',start:0,end:1,text:42,final:true}],language:'es',provider:'deepgram'}}])
    assert.throws(()=>model.parsePhoneCall({...call,...patch}));
  const raw='<img src=x onerror=alert(1)>';
  assert.equal(model.parsePhoneCall({...call,transcript:{transcript:raw,utterances:[{speaker:0,start:0,end:1,text:raw}],language:'es',provider:'deepgram nova-3'}}).transcript.transcript,raw);
});
