import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadTypeScript} from './ts-module.mjs';

const route=loadTypeScript('src/prototypes/cedar/phone-route.ts','phone-route-test');

test('phone dial routes preserve an exact customer and number',()=>{
  const hash=route.phoneDialRoute({number:'+34 600 00 00 00',customerId:'customer-1'});
  assert.equal(hash,'#/phone/new?number=%2B34+600+00+00+00&customer=customer-1');
  assert.deepEqual(route.parsePhoneRoute(hash),{kind:'dial',number:'+34 600 00 00 00',customerId:'customer-1'});
});

test('saved call routes accept opaque service references and reject path injection',()=>{
  const sid='CAopaque_reference_1';
  assert.equal(route.phoneCallRoute(sid),'#/phone/calls/'+sid);
  assert.deepEqual(route.parsePhoneRoute('#/phone/calls/'+sid),{kind:'call',sid});
  assert.equal(route.parsePhoneRoute('#/phone/calls/../../admin'),null);
  assert.throws(()=>route.phoneCallRoute('call/another'));
});

test('other workspace hashes stay outside the phone router',()=>{
  assert.equal(route.parsePhoneRoute('#/sales'),null);
  assert.equal(route.parsePhoneRoute('#/phone'),null);
});
