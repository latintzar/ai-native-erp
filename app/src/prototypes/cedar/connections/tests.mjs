/** Synthetic protocol tests: mocked browser/Meta/API responses, never provider acceptance evidence. */
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));
async function moduleFrom(source) {
  const result = await build({ root: resolve(here, '../../../..'), configFile: false, logLevel: 'silent',
    build: { ssr: resolve(here, source), write: false, minify: false, rollupOptions: { output: { format: 'es' } } } });
  const entry = result.output.find((file) => file.type === 'chunk' && file.isEntry);
  return import(`data:text/javascript;base64,${Buffer.from(entry.code).toString('base64')}`);
}
const { readSignupEvent, beginSignup } = await moduleFrom('meta.ts');
const { mergeMessages } = await moduleFrom('types.ts');
const finish = { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', data: { waba_id: '1234567' } };
const realWindow = globalThis.window;
const realFetch = globalThis.fetch;

function harness() {
  const target = new EventTarget();
  const timers = new Map();
  let nextTimer = 1;
  target.setTimeout = (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; };
  target.clearTimeout = (id) => timers.delete(id);
  globalThis.window = target;
  const calls = [];
  const callbacks = [];
  const options = [];
  const completed = [];
  const errors = [];
  const statuses = [];
  const diagnostics = [];
  let codeResponse;
  let holdCode = false;
  globalThis.fetch = (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), signal: init.signal });
    const json = (value) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/whatsapp/code')) {
      if (holdCode) return new Promise((resolve) => { codeResponse = () => resolve(json({ authorizationId: 'synthetic-authorization' })); });
      return Promise.resolve(json({ authorizationId: 'synthetic-authorization' }));
    }
    if (url.endsWith('/whatsapp/diagnostics')) return Promise.resolve(json({ receiptId: 'a'.repeat(64) }));
    return Promise.resolve(json({ ready: true, connection: { phoneId: '987' } }));
  };
  return {
    calls, callbacks, completed, errors, statuses, diagnostics, options, timers,
    holdCode() { holdCode = true; },
    releaseCode() { codeResponse(); },
    start() { return beginSignup({ sdk: { init() {}, login(callback, opts) { callbacks.push(callback); options.push(opts); } },
      configId: 'synthetic-config', historyRequested: true, onStatus: (value) => statuses.push(value),
      onDiagnostic: (value) => diagnostics.push(value), onConnected: (value) => completed.push(value), onError: (error) => errors.push(error) }); },
    event(value = finish, origin = 'https://www.facebook.com') {
      target.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value), origin }));
    },
    async settle() { await setImmediate(); await setImmediate(); },
  };
}

try {
  for (const origin of ['https://www.facebook.com', 'https://web.facebook.com']) assert.equal(readSignupEvent(origin, finish).session.wabaId, '1234567');
  for (const origin of ['https://www.facebook.com.attacker.example', 'https://evilfacebook.com', 'http://www.facebook.com', 'https://facebook.com', 'null', '']) {
    assert.equal(readSignupEvent(origin, finish), null);
  }
  assert.equal(readSignupEvent('https://www.facebook.com', '{broken'), null);
  assert.equal(readSignupEvent('https://www.facebook.com', { ...finish, type: 'OTHER' }), null);
  assert.equal(readSignupEvent('https://www.facebook.com', { ...finish, data: { waba_id: '<script>' } }), null);
  assert.equal(readSignupEvent('https://www.facebook.com', { ...finish, data: { waba_id: '123', phone_number_id: 'bad' } }), null);

  const reportedFailure = { type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL', data: {
    error_code: 2494064, current_step: 'PHONE_NUMBER_SETUP', session_id: 'f34b51dab5e0498',
    timestamp: '1746041036', error_message: 'private account details', access_token: 'private-token',
    waba_id: 'private-asset', code: 'private-code',
  } };
  const diagnostic = { event: 'CANCEL', errorCode: '2494064', currentStep: 'PHONE_NUMBER_SETUP',
    sessionId: 'f34b51dab5e0498', reportedAt: '1746041036' };
  assert.deepEqual(readSignupEvent('https://www.facebook.com', reportedFailure).diagnostic, diagnostic,
    'Meta user-reported failures must preserve only the bounded support fields');
  assert.deepEqual(readSignupEvent('https://www.facebook.com', { ...reportedFailure, data: {
    error_code: '<script>', current_step: 'private account text', session_id: 'https://private.example/token',
    timestamp: 'private-text', error_message: 'private account details',
  } }).diagnostic, { event: 'CANCEL' }, 'raw provider payloads and invalid metadata must never enter diagnostics');
  assert.equal(readSignupEvent('https://www.facebook.com.attacker.example', reportedFailure), null);

  // A late support report remains useful after signup has already stopped authorizing.
  for (const trigger of ['callback', 'cancel', 'expiry']) {
    const h = harness(); const stop = h.start();
    if (trigger === 'callback') h.callbacks[0]({ status: 'unknown' });
    if (trigger === 'cancel') h.event({ type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL' });
    if (trigger === 'expiry') [...h.timers.values()].find((timer) => timer.ms === 300000).fn();
    // Reproduce the old callback's 1s cutoff before delivering the real report.
    [...h.timers.values()].find((timer) => timer.ms === 1000)?.fn();
    h.callbacks[0]({ authResponse: { code: 'synthetic-late-code' } }); h.event();
    h.event(reportedFailure); await h.settle();
    assert.ok(h.calls.some((call) => call.body.errorCode === '2494064'),
      `a detailed report after ${trigger} must reach the receiver`);
    assert.ok(h.calls.every((call) => call.url.endsWith('/whatsapp/diagnostics')),
      'late support metadata cannot resume authorization');
    assert.equal(h.errors.length, 1);
    assert.equal(h.diagnostics.at(-1).state, 'saved');
    stop(); assert.equal(h.timers.size, 0);
    const count = h.calls.length; h.event(reportedFailure); await h.settle();
    assert.equal(h.calls.length, count, 'explicit cleanup stops report capture');
  }

  {
    const h = harness(); const stop = h.start();
    h.event(reportedFailure); h.event(reportedFailure); await h.settle();
    assert.equal(h.calls.length, 1, 'a reported failure must submit one private diagnostic');
    assert.equal(h.calls[0].url, '/api/proof/whatsapp/diagnostics');
    const { attemptId, ...payload } = h.calls[0].body;
    assert.match(attemptId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.deepEqual(payload, diagnostic);
    assert.equal(h.calls[0].signal.aborted, false, 'signup cleanup must allow the diagnostic to finish');
    assert.equal(h.errors.length, 1); assert.equal(h.completed.length, 0);
    stop(); assert.equal(h.timers.size, 0);
  }
  {
    const h = harness(); const stop = h.start();
    globalThis.fetch = () => Promise.reject(new Error('diagnostic transport unavailable'));
    h.event({ ...reportedFailure, event: 'ERROR' }); await h.settle();
    assert.equal(h.errors.length, 1, 'diagnostic delivery failure must preserve the original signup error');
    assert.equal(h.completed.length, 0); stop(); assert.equal(h.timers.size, 0);
  }
  {
    const h = harness(); const stop = h.start();
    h.callbacks[0]({ status: 'unknown' });
    h.event(reportedFailure); await h.settle();
    assert.equal(h.calls.length, 1, 'a generic SDK callback may precede the detailed provider error event');
    assert.equal(h.calls[0].body.errorCode, '2494064');
    assert.equal(h.errors.length, 1); stop(); assert.equal(h.timers.size, 0);
  }
  {
    const h = harness(); const stop = h.start();
    h.callbacks[0]({ status: 'unknown' });
    assert.equal(h.errors.length, 1, 'SDK cancellation ends authorization immediately');
    h.callbacks[0]({ authResponse: { code: 'synthetic-late-code' } }); h.event();
    assert.equal(h.calls.length, 0, 'the diagnostic wait cannot revive a cancelled authorization');
    await h.settle();
    assert.equal(h.errors.length, 1); stop(); assert.equal(h.timers.size, 0);
  }

  {
    const h = harness(); const stop = h.start();
    const request = globalThis.fetch;
    let tried = 0;
    globalThis.fetch = (url, init) => {
      if (tried++ === 0) { h.calls.push({ url, body: JSON.parse(init.body) }); return Promise.resolve(new Response('{}', { status: 503 })); }
      return request(url, init);
    };
    h.event(reportedFailure); await h.settle();
    assert.equal(h.diagnostics.at(-1).state, 'sending');
    [...h.timers.values()].find((timer) => timer.ms === 1000).fn(); await h.settle();
    assert.equal(h.calls.length, 2); assert.equal(h.calls[0].body.attemptId, h.calls[1].body.attemptId);
    assert.equal(h.diagnostics.at(-1).state, 'saved'); stop();
  }
  for (const status of [401, 403, 422, 429]) {
    const h = harness(); const stop = h.start();
    globalThis.fetch = () => Promise.resolve(new Response('{}', { status }));
    h.event(reportedFailure); await h.settle();
    assert.equal(h.diagnostics.at(-1).state, 'failed', `HTTP ${status} must have an observable delivery outcome`);
    assert.ok(![...h.timers.values()].some((timer) => [1000, 3000].includes(timer.ms)));
    stop();
  }
  {
    const h = harness(); const stop = h.start();
    h.event({ type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL' });
    h.event(reportedFailure); h.event(reportedFailure); await h.settle();
    assert.equal(h.calls.length, 2, 'a later detailed report must survive an earlier bare cancellation');
    assert.notEqual(h.calls[0].body.attemptId, h.calls[1].body.attemptId);
    assert.equal(h.diagnostics.at(-1).errorCode, '2494064'); stop();
  }
  {
    const h = harness(); const stop = h.start();
    h.event(reportedFailure); await h.settle();
    h.event({ type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL' }); await h.settle();
    assert.equal(h.calls.length, 2);
    assert.equal(h.diagnostics.at(-1).errorCode, '2494064', 'a bare event cannot erase the detailed report acknowledgment');
    for (let i = 0; i < 15; i++) h.event({ ...reportedFailure, data: { error_code: i } });
    await h.settle();
    assert.equal(h.calls.length, 10, 'each attempt has a bounded number of distinct reports'); stop();
  }
  {
    const h = harness(); const stop = h.start();
    h.callbacks[0]({ status: 'unknown' });
    [...h.timers.values()].find((timer) => timer.ms === 1800000).fn();
    h.event(reportedFailure); await h.settle();
    assert.equal(h.calls.length, 0, 'diagnostic capture ends at its own bounded expiry');
    assert.equal(h.timers.size, 0); stop();
  }
  {
    const h = harness(); const stop = h.start();
    let resolveReport;
    globalThis.fetch = () => new Promise((resolve) => { resolveReport = resolve; });
    h.event(reportedFailure); stop(); const count = h.diagnostics.length;
    resolveReport(new Response(JSON.stringify({ receiptId: 'a'.repeat(64) }))); await h.settle();
    assert.equal(h.diagnostics.length, count, 'a disposed attempt cannot paint its late acknowledgment');
  }

  {
    const h = harness(); h.holdCode(); const stop = h.start();
    h.callbacks[0]({ authResponse: { code: 'synthetic-code' } });
    assert.equal(h.calls.length, 1, 'code exchange must start synchronously, before any asset event');
    assert.equal(h.calls[0].url, '/api/proof/whatsapp/code');
    h.event(); h.event();
    assert.equal(h.calls.length, 1, 'assets must wait for the authorization handle');
    h.releaseCode(); await h.settle();
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[1].url, '/api/proof/whatsapp/connect');
    assert.equal(h.calls[1].body.authorizationId, 'synthetic-authorization');
    assert.equal(h.calls[1].body.wabaId, '1234567');
    assert.equal(h.calls[1].body.historyRequested, true);
    assert.equal(h.completed.length, 1);
    h.event(); h.callbacks[0]({ authResponse: { code: 'synthetic-duplicate' } }); await h.settle();
    assert.equal(h.calls.length, 2, 'duplicate events/callbacks must never resubmit');
    assert.equal(h.options[0].extras.sessionInfoVersion, '3');
    assert.equal(h.options[0].extras.featureType, 'whatsapp_business_app_onboarding');
    assert.equal(h.options[0].version, undefined, 'signup v4 is configured in Meta, not an invented option');
    stop();
  }
  {
    const h = harness(); const stop = h.start();
    h.event(); assert.equal(h.calls.length, 0);
    h.callbacks[0]({ authResponse: { code: 'synthetic-code' } }); await h.settle();
    assert.equal(h.calls.length, 2, 'event-first ordering must complete once');
    assert.equal(h.completed.length, 1); stop();
  }
  {
    const h = harness(); const stop = h.start();
    h.callbacks[0]({ authResponse: { code: 'synthetic-code' } }); await h.settle();
    assert.equal(h.calls.length, 1);
    assert.equal(h.statuses.at(-1), 'awaiting_details');
    h.event(finish, 'https://www.facebook.com.attacker.example'); await h.settle();
    assert.equal(h.calls.length, 1);
    h.event(); await h.settle(); assert.equal(h.calls.length, 2); stop();
  }
  {
    const h = harness(); const stop = h.start();
    h.event({ type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL' });
    h.callbacks[0]({ authResponse: { code: 'synthetic-stale-code' } }); h.event(); await h.settle();
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].body.event, 'CANCEL');
    assert.equal(h.errors.length, 1); stop(); assert.equal(h.timers.size, 0);
    const stopRetry = h.start();
    h.callbacks[0]({ authResponse: { code: 'synthetic-stale-code' } });
    assert.equal(h.calls.length, 1, 'previous attempt callback must stay inert during retry');
    h.callbacks[1]({ authResponse: { code: 'synthetic-fresh-code' } }); h.event(); await h.settle();
    assert.equal(h.calls.length, 3); assert.equal(h.completed.length, 1); stopRetry();
  }
  {
    const h = harness(); h.holdCode(); const stop = h.start();
    h.callbacks[0]({ authResponse: { code: 'synthetic-code' } });
    stop(); assert.equal(h.calls[0].signal.aborted, true);
    h.releaseCode(); h.event(); await h.settle();
    assert.equal(h.calls.length, 1); assert.equal(h.completed.length, 0); assert.equal(h.errors.length, 0);
  }
  {
    const h = harness(); const stop = h.start();
    const expiry = [...h.timers.values()].find((timer) => timer.ms === 300000);
    expiry.fn(); h.event(); h.callbacks[0]({ authResponse: { code: 'synthetic-code' } }); await h.settle();
    assert.equal(h.calls.length, 0); assert.equal(h.errors.length, 1); stop(); assert.equal(h.timers.size, 0);
  }
  {
    const older = { id: 'b', timestamp: '2026-09-09T08:00:00Z', mediaAvailable: false };
    const newer = { ...older, mediaAvailable: true };
    const rows = mergeMessages([older], [{ id: 'a', timestamp: '2026-09-08T08:00:00Z' }, newer], [newer]);
    assert.deepEqual(rows.map((row) => row.id), ['a', 'b']);
    assert.equal(rows[1].mediaAvailable, true, 'new server media enrichment must replace earlier placeholders');
  }
  console.log('Cedar synthetic protocol checks passed: callback ordering, immediate exchange, exact origins, duplicate suppression, cleanup/retry, expiry, chronology and media enrichment.');
} finally {
  globalThis.window = realWindow;
  globalThis.fetch = realFetch;
}
