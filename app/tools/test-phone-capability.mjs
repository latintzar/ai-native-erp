/* THE ONE ANSWER TO «CAN THIS WORKSPACE CALL SOMEBODY», measured against the provider's own words.
 *
 * Every call entrance used to ask its own question — `evidence.mode==='commissioned'` in the dial
 * dialog, a browser draft's `prepared` flag in Connections, a fourth predicate in onboarding — so
 * one account could be Connected on one surface and uncommissioned on the next. This suite pins
 * the single selector they now share: one posture, one selected line, one list of what is still
 * pending, derived from nothing but the provider snapshot.
 */
import strict from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript, loadTypeScript } from './ts-module.mjs';

/* The count this file prints is COUNTED, so it stays true when an assertion is added. It was a
   literal, and a literal somebody has to remember to bump is a number that quietly goes wrong. */
let checks = 0;
const assert = new Proxy(strict, {
  get(target, key) {
    const value = Reflect.get(target, key);
    if (typeof value !== 'function') return value;
    return (...args) => { checks += 1; return value.apply(target, args); };
  },
});

const { phoneCapabilityOf, phoneSetupResumeStep, phoneStatusWord, phoneRecordingOn, phoneRecordingWire, PHONE_RECORDING_WIRE } =
  loadTypeScript('src/prototypes/cedar/phone-capability.ts', 'cedar-phone-capability');

const choices = (source, fallback) => ({ source_number: source, fallback_number: fallback, recording: 'off', live_transcription: false });
const readiness = (patch = {}) => ({
  configured: true, account_verified: true, inbound_number: '+51987000111', caller_id: '+51987654321',
  caller_id_verified: true, browser_ready: true, forwarding_state: 'verified', transcription_ready: true, ...patch,
});
const line = (id, patch = {}) => ({
  line_id: id, mode: 'commissioned', setup: choices('+51987654321', '+51911111111'), readiness: readiness(), checks: {}, ...patch,
});
const evidence = (patch = {}) => ({
  workspace_id: 'w'.repeat(32), mode: 'commissioned', setup: choices('+51987654321', '+51911111111'),
  readiness: readiness(), checks: {}, default_line_id: null, lines: [], ...patch,
});
const state = (patch = {}) => ({ status: 'ready', evidence: evidence(), error: '', checkedAt: 1_700_000_000_000, staleSince: 0, ...patch });

/* 1 · CHECKING — the first paint, before the provider has answered. It is a posture of its own and
   it is NOT ready, so no surface may mount a dial control on it. */
const checking = phoneCapabilityOf({ status: 'checking', evidence: null, error: '', checkedAt: 0, staleSince: 0 });
assert.equal(checking.posture, 'checking');
assert.deepEqual(checking.needs, ['connection']);
assert.equal(checking.line, null);
assert.equal(checking.callerId, '');
assert.equal(checking.accountReady, false);

/* 2 · UNAVAILABLE — the read failed. The error travels with the capability so one quiet line can
   state it beside the same image, and the posture is SETTLED: `declinePhoneSetup` clears the
   evidence with `staleSince: 0` on both of its clearing branches — the provider's own answer about
   this workspace, and a first read with nothing behind it. Marking that stale put «Connect phone to
   call from Rocoto. Checking…» on every telephone customer's sheet, permanently, because the sheet
   appends ` Checking…` to its own sentence whenever `stale` is true. */
const offline = phoneCapabilityOf({ status: 'unavailable', evidence: null, error: 'Reconnect the phone service, then try again.', checkedAt: 5, staleSince: 0 });
assert.equal(offline.posture, 'unavailable');
assert.equal(offline.error, 'Reconnect the phone service, then try again.');
assert.deepEqual(offline.needs, ['connection']);
assert.equal(offline.checkedAt, 5);
assert.equal(offline.stale, false, 'a settled posture is never «Checking…»');
assert.equal(offline.staleSince, 0);

/* 3 · SAMPLE — an account with no line at all. This is the state the demo runtime answers with,
   and the one a hard-coded `prepared` flag in localStorage used to overrule. */
const sample = phoneCapabilityOf(state({
  evidence: evidence({
    mode: 'sample', setup: choices('', ''),
    readiness: readiness({ configured: false, account_verified: false, inbound_number: '', caller_id: '', caller_id_verified: false, browser_ready: false, forwarding_state: 'not-run', transcription_ready: false }),
  }),
}));
assert.equal(sample.posture, 'setup');
assert.deepEqual(sample.needs, ['line']);
assert.equal(sample.line, null);
assert.equal(sample.mobileReady, false);
assert.equal(sample.accountReady, false);

/* 4 · A PREPARED LINE — Cedar holds the numbers, Rocoto has yet to commission the account. Three
   things are pending and the capability names all three. */
const prepared = phoneCapabilityOf(state({
  evidence: evidence({
    default_line_id: 'line_prepared',
    lines: [line('line_prepared', {
      mode: 'prepared',
      readiness: readiness({ account_verified: false, inbound_number: '', caller_id_verified: false, browser_ready: false, forwarding_state: 'not-run', transcription_ready: false }),
    })],
  }),
}));
assert.equal(prepared.posture, 'partial');
assert.deepEqual(prepared.needs, ['account', 'caller-id', 'forwarding']);
assert.equal(prepared.callerId, '+51987654321', 'a prepared line still names the number it was prepared for');
assert.equal(prepared.mobileReady, true);
assert.equal(prepared.browserReady, false);
assert.equal(prepared.accountReady, false, 'a prepared line has no live provider account yet');

/* 5 · COMMISSIONED WITH CALLER ID PENDING — the exact state `evidence.mode==='commissioned'` read
   as a connected line, which is what put a keypad and a Call button in front of a dead line. */
const callerPending = phoneCapabilityOf(state({
  evidence: evidence({ default_line_id: 'line_caller', lines: [line('line_caller', { readiness: readiness({ caller_id_verified: false }) })] }),
}));
assert.equal(callerPending.posture, 'partial');
assert.deepEqual(callerPending.needs, ['caller-id']);
assert.equal(callerPending.forwardingState, 'verified');
/* Incoming calls and hang-up follow the ACCOUNT, so a caller-ID-pending line still mounts the
   session; only placing a call waits for `ready`. */
assert.equal(callerPending.accountReady, true);

/* 6 · FORWARDING WAITING — the carrier test is armed and the expected call has yet to arrive. */
const waiting = phoneCapabilityOf(state({
  evidence: evidence({ default_line_id: 'line_wait', lines: [line('line_wait', { readiness: readiness({ forwarding_state: 'waiting' }) })] }),
}));
assert.equal(waiting.posture, 'partial');
assert.deepEqual(waiting.needs, ['forwarding']);
assert.equal(waiting.forwardingState, 'waiting');
assert.equal(waiting.accountReady, true, 'a commissioned account can take incoming calls while its forwarding test runs');
const received = phoneCapabilityOf(state({
  evidence: evidence({ default_line_id: 'line_recv', lines: [line('line_recv', { readiness: readiness({ forwarding_state: 'received' }) })] }),
}));
assert.equal(received.posture, 'partial', 'a received test call is an observation, and verified is the line');

/* 7 · BROWSER OFF — the line is commissioned and verified; this browser simply has no microphone
   grant yet. That is a ROUTE fact, so the line stays ready and the browser leg reports itself. */
const mobileOnly = phoneCapabilityOf(state({
  evidence: evidence({ default_line_id: 'line_mobile', lines: [line('line_mobile', { readiness: readiness({ browser_ready: false }) })] }),
}));
assert.equal(mobileOnly.posture, 'ready');
assert.deepEqual(mobileOnly.needs, []);
assert.equal(mobileOnly.browserReady, false);
assert.equal(mobileOnly.mobileReady, true);

/* 8 · READY — every provider fact verified. */
const ready = phoneCapabilityOf(state({ evidence: evidence({ default_line_id: 'line_ready', lines: [line('line_ready')] }) }));
assert.equal(ready.posture, 'ready');
assert.deepEqual(ready.needs, []);
assert.equal(ready.callerId, '+51987654321');
assert.equal(ready.inboundNumber, '+51987000111');
assert.equal(ready.transcriptionReady, true);
assert.equal(ready.line?.line_id, 'line_ready');
assert.equal(ready.accountReady, true);

/* 9 · DEFAULT LINE RESOLUTION WITH TWO LINES — the named outgoing line wins; with none named the
   first commissioned line answers; with none commissioned the first line is still the subject. */
const two = evidence({ default_line_id: 'line_second', lines: [line('line_first'), line('line_second', { setup: choices('+51999000111', '+51911222333') })] });
assert.equal(phoneCapabilityOf(state({ evidence: two })).line?.line_id, 'line_second');
assert.equal(phoneCapabilityOf(state({ evidence: { ...two, default_line_id: null } })).line?.line_id, 'line_first');
const draftFirst = evidence({
  default_line_id: null,
  lines: [line('line_draft', { mode: 'prepared', readiness: readiness({ account_verified: false }) }), line('line_live')],
});
assert.equal(phoneCapabilityOf(state({ evidence: draftFirst })).line?.line_id, 'line_live', 'a commissioned line answers before a draft');
assert.equal(phoneCapabilityOf(state({ evidence: draftFirst })).posture, 'ready');
const draftsOnly = evidence({ default_line_id: null, lines: [line('line_a', { mode: 'prepared' }), line('line_b', { mode: 'prepared' })] });
assert.equal(phoneCapabilityOf(state({ evidence: draftsOnly })).line?.line_id, 'line_a');
assert.equal(phoneCapabilityOf(state({ evidence: draftsOnly })).posture, 'partial');

/* 10 · A COMMISSIONED ACCOUNT WITH NO LINES ROW still has its compatibility fields, and they carry
   one default line rather than reading as an account that never started. */
const legacy = phoneCapabilityOf(state({ evidence: evidence({ lines: [], default_line_id: null }) }));
assert.equal(legacy.posture, 'ready');
assert.equal(legacy.callerId, '+51987654321');

/* 11 · WHERE A PERSON RETURNS TO. Setup resumes at the first step that line has yet to meet. */
assert.equal(phoneSetupResumeStep(null), 0);
assert.equal(phoneSetupResumeStep(line('line_new', { setup: choices('', '') })), 0);
assert.equal(phoneSetupResumeStep(line('line_source', { setup: choices('+51987654321', '') })), 1);
assert.equal(phoneSetupResumeStep(line('line_fwd', { readiness: readiness({ forwarding_state: 'waiting' }) })), 2);
assert.equal(phoneSetupResumeStep(line('line_caller', { readiness: readiness({ caller_id_verified: false }) })), 3);
assert.equal(phoneSetupResumeStep(line('line_done')), 4);

/* 12 · ONE WORD PER POSTURE on the Connections card. */
assert.equal(phoneStatusWord('ready'), 'Connected');
assert.equal(phoneStatusWord('partial'), 'Finish setup');
assert.equal(phoneStatusWord('setup'), 'Connect phone');
assert.equal(phoneStatusWord('checking'), 'Connect phone');
assert.equal(phoneStatusWord('unavailable'), 'Connect phone');

/* 13 · A READ THAT FAILED IS A FACT ABOUT THE NETWORK, NOT ABOUT THE LINE. The snapshot keeps its
   evidence and marks the moment it stopped being confirmed, so a verified line stays ready — the
   surfaces say `Checking…` and nothing else moves. One 503 used to revoke a live commissioned line
   mid-call, taking the dial's controls and the controller's own active-call poll with it. */
const stale = phoneCapabilityOf(state({
  evidence: evidence({ default_line_id: 'line_ready', lines: [line('line_ready')] }),
  error: 'The connection is taking longer than expected. Try again.',
  staleSince: 1_700_000_060_000,
}));
assert.equal(stale.posture, 'ready', 'a transient read leaves a verified line ready');
assert.equal(stale.stale, true);
assert.equal(stale.staleSince, 1_700_000_060_000);
assert.equal(stale.accountReady, true, 'and the call session stays mounted through it');
assert.equal(stale.line?.line_id, 'line_ready');
/* The provider's own answer about this workspace is what clears the line: that arrives as
   `{status:'unavailable', evidence:null}` and reads exactly as it always did. */
const revoked = phoneCapabilityOf({ status: 'unavailable', evidence: null, error: 'Reopen your saved connection workspace to continue.', checkedAt: 9, staleSince: 0 });
assert.equal(revoked.posture, 'unavailable');
assert.equal(revoked.accountReady, false);
assert.equal(revoked.stale, false, 'a definitive answer is a settled fact, never a pending check');
/* A confirmed read carries no stale mark at all. */
assert.equal(phoneCapabilityOf(state({ evidence: evidence({ default_line_id: 'line_ready', lines: [line('line_ready')] }) })).stale, false);

/* 14 · THE RECORDING VOCABULARY, READ BOTH WAYS AND WRITTEN ONE WAY. A line's setup has always
   travelled as `off` | `notice`; the commissioning runtime adds the operator's notice mode
   (`none` | `spoken` | `audio`). Reads accept either, so the browser keeps working across that
   merge in whichever order it lands; writes stay on the pair the running server accepts. */
assert.deepEqual([...PHONE_RECORDING_WIRE], ['off', 'notice', 'none', 'spoken', 'audio']);
assert.equal(phoneRecordingOn('off'), false);
assert.equal(phoneRecordingOn('none'), false);
assert.equal(phoneRecordingOn('notice'), true);
assert.equal(phoneRecordingOn('spoken'), true);
assert.equal(phoneRecordingOn('audio'), true);
assert.equal(phoneRecordingOn(''), false, 'an unknown word records nothing');
assert.equal(phoneRecordingWire(true), 'notice');
assert.equal(phoneRecordingWire(false), 'off');
/* Both vocabularies resolve to a line the capability can answer about. */
for (const wire of PHONE_RECORDING_WIRE) {
  const answered = phoneCapabilityOf(state({
    evidence: evidence({ default_line_id: 'line_wire', lines: [line('line_wire', { setup: { ...choices('+51987654321', '+51911111111'), recording: wire } })] }),
  }));
  assert.equal(answered.posture, 'ready', `a line recorded as ${wire} still reads ready`);
  assert.equal(phoneRecordingOn(answered.line.setup.recording), wire !== 'off' && wire !== 'none');
}

/* 15 · A WRITE DROPS THE READ IT CONDEMNS, so `await provider.refresh()` after a write publishes.
 *
 * `refreshPhoneSetup` hands a second caller the read already in flight, and `writes` discards any
 * response whose read began before a write. Phone setup's last two steps are exactly `write, then
 * refresh`, so the awaited refresh could be handed a task the stamp had already condemned: it
 * resolved having published nothing and raising nothing, and the caller ID the provider had just
 * verified — or the transcript choice just saved — was missing from the capability every surface
 * reads until the next poll.
 *
 * This runs the REAL module. `phone-runtime.ts` is pure TypeScript whose window work is guarded, so
 * it loads under Node; the reader (`phoneApi.setup`) and the transport (`channelApi`) are the two
 * seams the test holds, so the ordering is driven rather than simulated. */
const runtimeEntry = compileTypeScript('src/prototypes/cedar/phone-runtime.ts', 'cedar-phone-runtime');
const load = createRequire(import.meta.url);
const runtime = load(runtimeEntry);
const channel = load(join(dirname(runtimeEntry), 'cedar-channel-api.js'));

const LINE_ID = `line_${'a'.repeat(24)}`;
const wireLine = (recording) => ({
  line_id: LINE_ID, mode: 'commissioned',
  setup: { source_number: '+51987654321', fallback_number: '+51911111111', recording, live_transcription: recording !== 'off' },
  readiness: readiness(), checks: {},
});
const wireEvidence = (recording) => ({
  workspace_id: 'a'.repeat(32), mode: 'commissioned', setup: wireLine(recording).setup,
  readiness: readiness(), checks: {}, default_line_id: LINE_ID, lines: [wireLine(recording)],
});

let releaseOlderRead = () => {};
const olderRead = new Promise((resolve) => { releaseOlderRead = () => resolve(wireEvidence('off')); });
let reads = 0;
runtime.phoneApi.setup = async () => { reads += 1; return reads === 1 ? olderRead : wireEvidence('notice'); };
channel.channelApi = async () => wireLine('notice');

const olderTask = runtime.refreshPhoneSetup();
assert.equal(reads, 1, 'the poll read is in flight');
await runtime.phoneApi.saveLineSetup(LINE_ID, { source_number: '+51987654321', fallback_number: '+51911111111', recording: 'notice', live_transcription: true });
const afterWrite = runtime.refreshPhoneSetup();
assert.notEqual(afterWrite, olderTask, 'a write drops the read its own stamp has already condemned');
assert.equal(reads, 2, 'so the refresh that follows a write issues a fresh read');
await afterWrite;
assert.equal(runtime.phoneProviderNow().evidence?.lines[0].setup.recording, 'notice',
  'and the choice the write saved reaches the capability every surface reads');
assert.equal(phoneCapabilityOf(runtime.phoneProviderNow()).posture, 'ready');
/* The condemned read still lands, and it is still discarded: the snapshot never walks backwards. */
releaseOlderRead();
await olderTask;
assert.equal(runtime.phoneProviderNow().evidence?.lines[0].setup.recording, 'notice',
  'a read that began before the write is discarded when it lands');

console.log(`${checks} Cedar phone capability checks passed`);
