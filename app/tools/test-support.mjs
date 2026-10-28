#!/usr/bin/env node
// Support lifecycle only: no network, messages, credentials or customer records.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transform } from 'rolldown/experimental';
const source = new URL('../src/prototypes/cedar/support.ts', import.meta.url);
const { code, errors } = await transform(fileURLToPath(source), readFileSync(source, 'utf8'));
assert.equal(errors?.length ?? 0, 0);
const scripts = [], calls = [], opened = [], timers = new Map(), frames = [], events = new Map();
let timer = 0, customerCloses = 0, checks = 0;
globalThis.window = { open: (...args) => opened.push(args), requestAnimationFrame: callback => { frames.push(callback); return frames.length; } };
globalThis.document = { createElement: () => ({ remove() { this.removed = true; } }), head: { appendChild: script => scripts.push(script) } };
const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = callback => { timers.set(++timer, callback); return timer; };
globalThis.clearTimeout = id => timers.delete(id);
// Missing, malformed and foreign widget configuration keep all SDK/account calls off.
const encoded = Buffer.from(code).toString('base64');
for (const value of [undefined, '', 'https://unrelated.example.invalid/script.js', 'https://static.zdassets.com/ekr/snippet.js?key=sk-private-fixture']) {
  if (value === undefined) delete globalThis.__SUPPORT_WIDGET_URL__;
  else globalThis.__SUPPORT_WIDGET_URL__ = value;
  const inactive = await import('data:text/javascript;base64,' + encoded + '#inactive-' + opened.length);
  window.zE = (...args) => calls.push(args);
  inactive.openSupport();
  inactive.closeSupport();
  assert.deepEqual(opened.at(-1), ['https://github.com/latintzar/ai-native-erp/issues', '_blank', 'noopener,noreferrer']);
  assert.equal(scripts.length, 0); assert.equal(calls.length, 0); assert.equal(timers.size, 0);
  assert.equal(inactive.supportSnapshot().phase, 'idle');
}
delete window.zE;
globalThis.__SUPPORT_WIDGET_URL__ = 'https://static.zdassets.com/ekr/snippet.js?key=00112233-4455-6677-8899-aabbccddeeff';
console.log('PASS Unconfigured/invalid support uses GitHub and never borrows an ambient widget');
checks++;
const support = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const settle = async () => { for (let i=0; i<5; i++) await Promise.resolve(); };
const flushFrame = () => { frames.splice(0).forEach(callback => callback()); };
const sdk = (...args) => { calls.push(args); if(args[0] === 'messenger:on') events.set(args[1], args[2]); };
const test = async (label, action) => { await action(); console.log(`PASS ${label}`); checks++; };
support.registerSupportCloser(() => customerCloses++);
await test('No support network or SDK commands before an explicit open', () => {
  assert.equal(scripts.length, 0); assert.equal(calls.length, 0); assert.equal(support.supportSnapshot().phase, 'idle');
});
await test('First open closes customer chat immediately and uses one authorized lazy snippet', () => {
  support.openSupport(); support.openSupport();
  assert.equal(customerCloses, 1); assert.equal(scripts.length, 1);
  assert.equal(scripts[0].id, 'ze-snippet'); assert.equal(scripts[0].src, globalThis.__SUPPORT_WIDGET_URL__);
  assert.equal(support.supportSnapshot().phase, 'loading');
});
await test('Script failure offers retry and does not claim an open conversation', async () => {
  scripts[0].onerror(); await settle();
  assert.equal(scripts[0].removed, true); assert.equal(support.supportSnapshot().phase, 'error'); assert.equal(timers.size, 0);
});
await test('Retry reloads a failed snippet, restricts cookies and defers open until focus release', async () => {
  support.openSupport(); assert.equal(scripts.length, 2); window.zE = sdk; scripts[1].onload(); await settle();
  assert.ok(calls.some(call => call.join('|') === 'messenger:set|cookies|functional'));
  assert.ok(!calls.some(call => call.join('|') === 'messenger|open'));
  flushFrame(); assert.deepEqual(calls.slice(-2), [['messenger','show'],['messenger','open']]);
  assert.equal(support.supportSnapshot().phase, 'loading');
});
await test('Only SDK open confirmation changes status to open', () => {
  events.get('open')(); assert.equal(support.supportSnapshot().phase, 'open'); assert.equal(timers.size, 0);
});
await test('Closing in the actual widget hides its launcher and returns the app to idle', () => {
  events.get('close')(); assert.equal(support.supportSnapshot().phase, 'idle'); assert.deepEqual(calls.at(-1), ['messenger','hide']);
  assert.equal(support.supportSnapshot().closing, true);
  [...timers.values()][0](); timers.clear(); assert.equal(support.supportSnapshot().closing, false);
});
await test('Cancel before animation frame cannot reopen the widget', async () => {
  support.openSupport(); await settle(); support.closeSupport(); const count = calls.filter(call => call.join('|') === 'messenger|open').length;
  flushFrame(); assert.equal(calls.filter(call => call.join('|') === 'messenger|open').length, count); assert.equal(support.supportSnapshot().phase, 'idle');
});
await test('A late SDK open after cancellation is immediately closed and hidden', () => {
  events.get('open')(); assert.deepEqual(calls.slice(-2), [['messenger','close'],['messenger','hide']]); assert.equal(support.supportSnapshot().phase, 'idle');
});
await test('Downstream SDK timeout is an error; a late close does not erase it', async () => {
  support.openSupport(); await settle(); flushFrame(); [...timers.values()][0]();
  assert.equal(support.supportSnapshot().phase, 'error'); events.get('close')(); assert.equal(support.supportSnapshot().phase, 'error');
});
await test('Background unread/proactive/show events never restore the hidden launcher', () => {
  for (const event of ['show','unreadMessages','proactiveMessageDisplayed']) {
    events.get(event)(); assert.deepEqual(calls.at(-1), ['messenger','hide']);
  }
  const count = calls.length; flushFrame(); assert.ok(calls.length > count);
  assert.deepEqual(calls.at(-1), ['messenger','hide']);
});
await test('Retry after SDK timeout reuses the existing widget and current SDK function', async () => {
  const replacement = []; window.zE = (...args) => replacement.push(args);
  support.openSupport(); await settle(); flushFrame(); assert.equal(scripts.length, 2);
  assert.deepEqual(replacement.slice(-2), [['messenger','show'],['messenger','open']]);
  support.closeSupport();
});
await test('No automatic identification, conversation field, tracking or send commands', () => {
  assert.ok(calls.every(call => ['messenger','messenger:on','messenger:set'].includes(call[0])));
  assert.ok(calls.filter(call => call[0] === 'messenger:set').every(call => call[1] === 'cookies' && call[2] === 'functional'));
});
globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout;
console.log(`${checks} support lifecycle checks passed`);
