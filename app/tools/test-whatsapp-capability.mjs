/* ONE ANSWER TO «CAN THIS WORKSPACE MESSAGE SOMEBODY ON WHATSAPP», measured against the provider's
 * own words — and one answer to «is communication set up», measured against all three providers.
 *
 * Five surfaces used to answer the first question five different ways: Connections asked
 * `Boolean(state.connection)` and said Connected about ANOTHER workspace's connection; onboarding
 * asked `connection.workspace === cast.sector` and said the opposite on the very next tile; the
 * connected inbox asked a third; setup-progress counted a local onboarding draft row; and the
 * composer let an append-only activation ledger outvote the live provider. This suite pins the two
 * selectors they now share, derived from nothing but provider snapshots.
 *
 * It is the WhatsApp half of `test-phone-capability.mjs`, deliberately in the same shape.
 */
import assert from 'node:assert/strict';
import { loadTypeScript } from './ts-module.mjs';

const { whatsappCapabilityOf, whatsappStatusWord, whatsappWordFor, whatsappActs, WHATSAPP_OTHER_WORKSPACE } =
  loadTypeScript('src/prototypes/cedar/whatsapp-capability.ts', 'cedar-whatsapp-capability');
const { communicationReady, connectedChannelsOf, connectedChannelCount, ONBOARDING_CHANNELS } =
  loadTypeScript('src/prototypes/cedar/onboarding-model.ts', 'cedar-onboarding-model');

const connection = (patch = {}) => ({
  wabaId: 'waba-1', phoneId: 'phone-1', number: '+51987654321', name: 'Pescados del Puerto',
  coexistence: true, workspace: 'fish', ...patch,
});
const proof = (patch = {}) => ({
  ready: true, blockers: [], meta: { appId: '1', configId: '2', graphVersion: 'v23.0' },
  connection: null, history: { status: 'complete', progress: 100, messages: 0, conversations: 0, oldestAt: null, newestAt: null },
  ...patch,
});
const snapshot = (patch = {}) => ({ state: proof(), error: '', checkedAt: 1_700_000_000_000, visited: false, ...patch });

/* ── 1 · CHECKING — the first paint, before the provider has answered ────────────────────────
   It is a posture of its own. The Connections card used to assert `Connect WhatsApp` in this gap,
   about an account that may well be connected, and a person who looked twice got two answers. */
const checking = whatsappCapabilityOf({ state: null, error: '', checkedAt: 0, visited: false }, 'fish');
assert.equal(checking.posture, 'checking');
assert.deepEqual(checking.needs, ['connection']);
assert.equal(checking.bound, false);
assert.equal(checking.connection, null);
assert.equal(checking.number, '');
assert.equal(whatsappStatusWord(checking.posture), 'Connect WhatsApp');

/* ── 2 · UNAVAILABLE — the read failed with nothing behind it ────────────────────────────────
   The sentence travels with the capability so one quiet line can state it beside the same act. */
const offline = whatsappCapabilityOf({ state: null, error: 'Your setup session needs a fresh connection.', checkedAt: 5, visited: false }, 'fish');
assert.equal(offline.posture, 'unavailable');
assert.equal(offline.error, 'Your setup session needs a fresh connection.');
assert.equal(offline.bound, false);
assert.equal(offline.stale, false, 'with no snapshot behind it there is nothing to keep standing');

/* ── 3 · SETUP — the provider answered, and this workspace holds no account ──────────────────── */
const setup = whatsappCapabilityOf(snapshot(), 'fish');
assert.equal(setup.posture, 'setup');
assert.deepEqual(setup.needs, ['connection']);
assert.equal(setup.bound, false);
assert.equal(setup.number, '', 'an unconnected card displays no number at all');
assert.equal(whatsappStatusWord(setup.posture), 'Connect WhatsApp');

/* ── 4 · READY — this workspace's own connection, and the number is the provider's ───────────── */
const ready = whatsappCapabilityOf(snapshot({ state: proof({ connection: connection() }) }), 'fish');
assert.equal(ready.posture, 'ready');
assert.deepEqual(ready.needs, []);
assert.equal(ready.bound, true);
assert.equal(ready.number, '+51987654321');
assert.equal(ready.name, 'Pescados del Puerto');
assert.equal(ready.historyStatus, 'complete');
assert.equal(whatsappStatusWord(ready.posture), 'Connected');

/* ── 5 · THE WORKSPACE MATCH IS STRICT, WHICH IS THE WHOLE POINT ─────────────────────────────
   `Connection.workspace` is written only once `bind_workspace()` has run, so a completed Embedded
   Signup sits in the store with the field missing — and a permissive read made that one connection
   bind the fish house, the meat house and every other one at the same time. A house switch left
   the Connections card printing ✓Connected while the onboarding tile beside it read unconnected. */
const elsewhere = whatsappCapabilityOf(snapshot({ state: proof({ connection: connection({ workspace: 'meat' }) }) }), 'fish');
assert.equal(elsewhere.posture, 'partial', 'another workspace’s connection is one step short here');
assert.deepEqual(elsewhere.needs, ['workspace']);
assert.equal(elsewhere.bound, false);
assert.equal(elsewhere.number, '', 'and it lends this workspace no number');

/* ── 5b · AND `partial` HAS TWO CAUSES, WHICH THE CARD MUST TELL APART ────────────────────────
   Both of them read `partial`, and only ONE of them is this house's to finish. The workspace field
   is written solely from the operator's `CEDAR_PROOF_WORKSPACE_BINDINGS` map, and
   `Store.bind_workspace` keeps an existing binding where it is — so walking Meta's signup again
   returns the same answer, and «Finish setup» beside a door promised a repair nobody here can
   make. It states what is instead, and carries no act. */
assert.equal(whatsappWordFor(elsewhere), WHATSAPP_OTHER_WORKSPACE);
assert.equal(WHATSAPP_OTHER_WORKSPACE, 'This WhatsApp account is set up for another workspace.');
assert.equal(whatsappActs(elsewhere), false, 'an operator owns that binding, so this house has nothing to press');

const unbound = whatsappCapabilityOf(snapshot({ state: proof({ connection: connection({ workspace: undefined }) }) }), 'fish');
assert.equal(unbound.posture, 'partial');
assert.equal(unbound.bound, false, 'a connection bound to no workspace binds nothing in this one');
assert.deepEqual(unbound.needs, ['workspace']);
assert.equal(whatsappWordFor(unbound), WHATSAPP_OTHER_WORKSPACE);
assert.equal(whatsappActs(unbound), false);

/* ── 6 · PARTIAL — a Meta walk left half way through ─────────────────────────────────────────
   The phone has five postures and three words; WhatsApp had two, so a half-finished walk got the
   same word as an account that was never started. */
const halfway = whatsappCapabilityOf(snapshot({
  state: proof({ setup: { status: 'interrupted', step: 'business', error: 'Continue with WhatsApp Business.' } }),
}), 'fish');
assert.equal(halfway.posture, 'partial');
assert.deepEqual(halfway.needs, ['account']);
assert.equal(halfway.error, 'Continue with WhatsApp Business.');
assert.equal(whatsappStatusWord(halfway.posture), 'Finish setup');
/* THE OTHER HALF OF THE SPLIT: this one IS the person's to finish, so it keeps the word and the
   door that resumes Meta's walk. */
assert.equal(whatsappWordFor(halfway), 'Finish setup');
assert.equal(whatsappActs(halfway), true);

assert.equal(
  whatsappCapabilityOf(snapshot({ state: proof({ setup: { status: 'ready', step: 'done', error: null } }) }), 'fish').posture,
  'setup',
  'a finished walk that bound nothing is an account waiting to be connected',
);

/* ── 7 · THE DOOR ITSELF IS SHUT — the provider answered, with blockers ──────────────────────── */
const blocked = whatsappCapabilityOf(snapshot({ state: proof({ ready: false, blockers: ['Meta app configuration is pending.'] }) }), 'fish');
assert.equal(blocked.posture, 'unavailable');
assert.equal(blocked.error, 'Meta app configuration is pending.');
/* A blocker never revokes a connection this workspace actually holds. */
assert.equal(
  whatsappCapabilityOf(snapshot({ state: proof({ ready: false, blockers: ['x'], connection: connection() }) }), 'fish').posture,
  'ready',
  'the provider’s own connection outranks a blocker about future setup',
);

/* ── 8 · THE VISIT FLAG HAS NO VOTE (§246 · §247.2) ──────────────────────────────────────────
   `rocoto-cedar-whatsapp-selected-v1` was written by the mere act of OPENING the setup dialog —
   from Connections, from Money setup, from onboarding, and from merely looking at the connected
   inbox — before Meta had been asked anything, and nothing anywhere cleared it. It travels as a
   fact about this browser and it moves no posture. */
for (const state of [
  { state: null, error: '', checkedAt: 0, visited: true },
  snapshot({ visited: true }),
  snapshot({ visited: true, state: proof({ connection: connection({ workspace: 'meat' }) }) }),
]) {
  const seen = whatsappCapabilityOf(state, 'fish');
  assert.equal(seen.visited, true, 'the visit is carried');
  assert.equal(seen.bound, false, 'and it binds nothing');
  assert.notEqual(seen.posture, 'ready', 'opening a door is never a connection');
}

/* ── 9 · A FAILED READ IS A FACT ABOUT THE NETWORK, NOT ABOUT THE ACCOUNT ────────────────────
   The polled snapshot stands, the surfaces keep what they draw, and one quiet line says so. */
const stale = whatsappCapabilityOf(snapshot({ state: proof({ connection: connection() }), error: 'Reading the connection again.' }), 'fish');
assert.equal(stale.posture, 'ready', 'a transient read leaves a bound account bound');
assert.equal(stale.stale, true);

/* ── 10 · «COMMUNICATION IS SET UP» — ONE PREDICATE, THREE PROVIDERS ──────────────────────────
   There were four definitions. `communicationReady` read `state.channels.length > 0` — ANY row of
   ANY status — so a `sample` row written by the Meta test-data walk and a `prepared` row left by a
   half-finished phone walk each painted a ✓ on a workspace with nothing connected. The onboarding
   rows are notes about a walk; these three booleans are the providers' own answers. */
assert.deepEqual(ONBOARDING_CHANNELS, ['whatsapp', 'email', 'phone']);

const none = connectedChannelsOf({ whatsappBound: false, emailConnected: false, phoneReady: false });
assert.deepEqual(none, { whatsapp: false, email: false, phone: false });
assert.equal(communicationReady(none), false);
assert.equal(connectedChannelCount(none), 0);

/* THE DEFECT, NAMED: a commissioned, caller-ID-verified, forwarding-tested line and nothing else
   read «0 of 2» on the Business setup card while the onboarding tile on the next screen read that
   same line as connected. Two surfaces, one account, two answers. */
const phoneOnly = connectedChannelsOf({ whatsappBound: false, emailConnected: false, phoneReady: true });
assert.equal(communicationReady(phoneOnly), true, 'a commissioned phone IS a communication channel');
assert.equal(connectedChannelCount(phoneOnly), 1);

const whatsappOnly = connectedChannelsOf({ whatsappBound: ready.bound, emailConnected: false, phoneReady: false });
assert.equal(communicationReady(whatsappOnly), true);

const elsewhereOnly = connectedChannelsOf({ whatsappBound: elsewhere.bound, emailConnected: false, phoneReady: false });
assert.equal(communicationReady(elsewhereOnly), false, 'another workspace’s WhatsApp completes no milestone here');

const all = connectedChannelsOf({ whatsappBound: true, emailConnected: true, phoneReady: true });
assert.equal(connectedChannelCount(all), 3, 'the count describes the SET, and the person picks from it');

/* ── 11 · THE COPY LAW OVER EVERY WORD THIS FILE PRODUCES (§198-A) ───────────────────────────── */
const NEGATIVE = /\b(no|not|nothing|never|nobody|none|cannot|can't|don't|doesn't|won't|isn't|aren't|wasn't|hasn't|haven't|didn't|without|unless)\b/i;
for (const posture of ['checking', 'unavailable', 'setup', 'partial', 'ready']) {
  const word = whatsappStatusWord(posture);
  assert.equal(NEGATIVE.test(word), false, `the card says what IS: ${word}`);
}
assert.equal(NEGATIVE.test(WHATSAPP_OTHER_WORKSPACE), false,
  'the other-workspace sentence states where the account IS set up');
assert.equal(whatsappStatusWord('checking'), whatsappStatusWord('unavailable'),
  'every posture that is short of a connection offers the same one act');

/* ── 12 · `checking` KEEPS THE PHONE'S SHAPE, AND THE REASON IS RECORDED HERE ─────────────────
   `phoneStatusWord` answers `Connect phone` for `checking` too (`phone-capability.ts:164-167`):
   between the first paint and the first provider answer the two channels say the same thing, so a
   person meeting a call entrance and a chat entrance in that same second reads one design. What
   the audit objected to — a composer whose send was dead while that read was in flight — is gone
   for a different reason: the WhatsApp send disc hands the words to `wa.me`, the person's own
   WhatsApp, and that door opens in every posture (`reply-channel.ts`, `shell/chats.tsx`). */
assert.equal(whatsappStatusWord('checking'), 'Connect WhatsApp');
assert.equal(whatsappWordFor(checking), 'Connect WhatsApp');
assert.equal(whatsappActs(checking), true, 'the one act stands while the read is in flight');

console.log('Cedar WhatsApp capability checks passed (five postures, strict workspace match, visit flag with no vote, one communication predicate)');
