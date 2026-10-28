import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const m = loadTypeScript('src/prototypes/cedar/onboarding-model.ts', 'onboarding-model-test');
const initial = m.newOnboarding('fish', { businessName:'Cedar fish house', address:'Avenida Principal' });

test('fresh setup begins with the required communication milestone', () => {
  assert.equal(initial.step, 'channel');
  assert.equal(m.parseOnboarding({ ...initial, step:'bank' }, initial).step, 'channel');
  assert.equal(m.parseOnboarding({ ...initial, step:'channel-setup' }, initial).step, 'channel');
  assert.equal(m.communicationReady(m.connectedChannelsOf({ whatsappBound:false, emailConnected:false, phoneReady:false })), false);
});

/* ── §246 · ONE DEFINITION OF «COMMUNICATION IS SET UP», AND IT IS THE PROVIDERS' ────────────
   `communicationReady` used to read `state.channels.length > 0` — ANY row of ANY status — so the
   Meta test-data walk's `sample` row and a half-finished phone walk's `prepared` row each painted
   a ✓ on a workspace whose providers had answered nothing. The onboarding rows are notes about a
   walk; the three booleans below are the providers' own answers, and they decide this alone. */
test('the communication milestone reads the three providers and nothing else', () => {
  assert.deepEqual(m.ONBOARDING_CHANNELS, ['whatsapp', 'email', 'phone']);
  const sample = m.saveChannel(initial, { channel:'whatsapp', status:'sample' });
  const prepared = m.saveChannel(initial, { channel:'phone', status:'prepared' });
  for (const walked of [sample, prepared]) {
    assert.equal(walked.channels.length, 1, 'the walk is still recorded as the note it is');
    assert.equal(
      m.communicationReady(m.connectedChannelsOf({ whatsappBound:false, emailConnected:false, phoneReady:false })),
      false,
      'and a sample or prepared row completes no milestone',
    );
  }
  assert.equal(m.communicationReady(m.connectedChannelsOf({ whatsappBound:false, emailConnected:false, phoneReady:true })), true,
    'a commissioned phone IS a communication channel — the card used to read 0 of 2 on one');
  assert.equal(m.communicationReady(m.connectedChannelsOf({ whatsappBound:true, emailConnected:false, phoneReady:false })), true);
  assert.equal(m.communicationReady(m.connectedChannelsOf({ whatsappBound:false, emailConnected:true, phoneReady:false })), true);
  assert.equal(m.connectedChannelCount(m.connectedChannelsOf({ whatsappBound:true, emailConnected:true, phoneReady:true })), 3,
    'the count describes the SET the person then picks from');
});
test('one saved channel advances directly to bank and updates once', () => {
  const prepared = m.saveChannel(initial, { channel:'email', status:'prepared' });
  assert.equal(prepared.step, 'bank');
  const connected = m.saveChannel(prepared, { channel:'email', status:'connected' });
  assert.deepEqual(connected.channels, [{ channel:'email', status:'connected' }]);
  assert.equal(initial.channels.length, 0);
  assert.deepEqual(m.parseOnboarding(JSON.parse(JSON.stringify(connected)), initial), connected);
});

test('completion and optional routes require a prepared workspace', () => {
  const channel = m.saveChannel(initial, { channel:'whatsapp', status:'connected' });
  assert.equal(m.parseOnboarding({ ...channel, step:'catalogue' }, initial).step, 'bank');
  assert.equal(m.parseOnboarding({ ...channel, step:'history' }, initial).step, 'bank');
  const complete = { ...channel, step:'complete', workspacePrepared:true };
  assert.equal(m.parseOnboarding(complete, initial).step, 'complete');
  assert.equal(m.parseOnboarding({ ...complete, step:'catalogue' }, initial).step, 'catalogue');
  assert.equal(m.parseOnboarding({ ...complete, step:'history' }, initial).step, 'history');
});

test('legacy progress resumes at one of the current screens', () => {
  const channel = m.saveChannel(initial, { channel:'phone', status:'sample' });
  assert.equal(m.parseOnboarding({ ...channel, step:'name' }, initial).step, 'channel');
  assert.equal(m.parseOnboarding({ ...channel, step:'more-channels' }, initial).step, 'bank');
  assert.equal(m.parseOnboarding({ ...channel, step:'invoicing' }, initial).step, 'bank');
  const prepared = { ...channel, workspacePrepared:true };
  assert.equal(m.parseOnboarding({ ...prepared, step:'gmail-permission' }, initial).step, 'history');
  assert.equal(m.parseOnboarding({ ...prepared, step:'invoice-results' }, initial).step, 'history');
});

/* ── §247.9 · MONEY OFF RETIRES THE BANK STEP ────────────────────────────────────────────────
   «also ensure you have the good spain / peru toggle which in spains case hides the money shit»
                                                                      — Peter, 13 September 2026
   The bank step mounts `MoneySetup`, so on a workspace with Money off it is a Money door. The walk
   is the channel and then the finished workspace, and every stored route that used to end at the
   bank — `bank` itself and the two legacy names — ends somewhere this workspace has. */
test('a workspace with Money off walks channel to complete', () => {
  assert.deepEqual(m.onboardingWalk(true), ['channel', 'channel-setup', 'bank', 'complete']);
  assert.deepEqual(m.onboardingWalk(false), ['channel', 'channel-setup', 'complete']);
  const saved = m.saveChannel(initial, { channel:'whatsapp', status:'connected' }, false);
  assert.equal(saved.step, 'complete', 'the channel is the last step of the walk');
  assert.equal(m.saveChannel(initial, { channel:'whatsapp', status:'connected' }, true).step, 'bank');
  assert.equal(m.saveChannel(initial, { channel:'whatsapp', status:'connected' }).step, 'bank', 'Peru is the default');
});

test('a stored walk standing on the bank step moves on when Money is off', () => {
  const channel = m.saveChannel(initial, { channel:'whatsapp', status:'connected' }, true);
  assert.equal(channel.step, 'bank');
  for (const step of ['bank', 'more-channels', 'invoicing']) {
    assert.equal(m.parseOnboarding({ ...channel, step }, initial, false).step, 'channel',
      `an unprepared ${step} resumes at the step that prepares this workspace`);
    assert.equal(m.parseOnboarding({ ...channel, step }, initial, true).step, 'bank', 'and Peru keeps its bank step');
  }
  const prepared = { ...channel, step:'complete', workspacePrepared:true };
  assert.equal(m.parseOnboarding(prepared, initial, false).step, 'complete');
  assert.equal(m.parseOnboarding({ ...prepared, step:'history' }, initial, false).step, 'history');
  assert.equal(m.parseOnboarding({ ...prepared, step:'catalogue' }, initial, false).step, 'catalogue');
});

/* THE WALK IS THE SEQUENCE, RATHER THAN A DESCRIPTION OF ONE. `onboardingWalk` was exported and
   read by this file alone, while `saveChannel` and `parseOnboarding` each spelled `money ? 'bank' :
   'complete'` out again — so editing the walk would have moved the spec and the test and left the
   product walking its old sequence. Both functions read it now, and this pins that: the step the
   channel's Continue lands on IS the walk's entry after `channel-setup`, and a legacy route resumes
   at a step the walk contains. */
test('the walk decides where the channel leads and where a legacy step resumes', () => {
  for (const money of [true, false]) {
    const walk = m.onboardingWalk(money);
    const connected = { channel:'whatsapp', status:'connected' };
    const landed = m.saveChannel(initial, connected, money).step;
    assert.equal(landed, walk[walk.indexOf('channel-setup') + 1], 'Continue lands on the next entry of the walk');
    assert.ok(walk.includes(landed), `and ${landed} is a step of this walk`);
    const banked = m.saveChannel(initial, connected, true);
    for (const step of ['bank', 'more-channels', 'invoicing']) {
      const resumed = m.parseOnboarding({ ...banked, step }, initial, money).step;
      assert.ok(walk.includes(resumed), `a stored ${step} resumes at ${resumed}, a step of this walk`);
    }
  }
});

/* THE CORRECTION IS A FIXED POINT OF BOTH READINGS. `onboarding-store` parses with the model's own
   default, and `cedar-onboarding.tsx` persists what it normalised; a step that normalised one way
   here and another way there would be written and re-corrected on every storage event, for ever. */
test('a step normalised with Money off survives the default reading unchanged', () => {
  const channel = m.saveChannel(initial, { channel:'whatsapp', status:'connected' }, true);
  for (const step of ['bank', 'more-channels', 'invoicing', 'channel-setup', 'complete']) {
    const corrected = m.parseOnboarding({ ...channel, step }, initial, false);
    assert.equal(m.parseOnboarding(corrected, initial).step, corrected.step,
      `${step} corrects to a step both readings agree on`);
  }
});

test('corrupt, oversized or other-workspace progress returns to the selected workspace', () => {
  for (const raw of [
    null,
    { ...initial, scope:'meat' },
    { ...initial, businessName:'a'.repeat(161) },
    { ...initial, invoiceHistory:[{ name:'x', size:20000001, type:'pdf' }] },
    { ...initial, channels:[{ channel:'email', status:'connected' },{ channel:'email', status:'prepared' }] },
  ]) assert.equal(m.parseOnboarding(raw, initial), initial);
});
