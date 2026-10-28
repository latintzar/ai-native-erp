/* THE ONE ANSWER TO «CAN THIS WORKSPACE READ AND SEND MAIL», measured against the provider's own
 * words (FEED-IA §247.2).
 *
 * Every email entrance used to ask its own question — `emailStatus.kind === 'connected'` in
 * Connections, the same predicate again in onboarding and a third time on the setup card, a list
 * the connected inbox fetched for itself, a release flag plus a customer's channel on the customer
 * sheet — so one account could read Connected on one surface and unconnected on the next. This
 * suite pins the single selector they now share: one posture, one selected mailbox, one list of
 * what is still pending, derived from nothing but the provider snapshot and the runtime's own send
 * authority.
 */
import assert from 'node:assert/strict';
import { loadTypeScript } from './ts-module.mjs';

const { emailCapabilityOf, emailStatusWord, emailCardWords, mailboxConnected, mailboxHistoryReady,
  acceptEmailStatus, declineEmailStatus, emailProviderNow } =
  loadTypeScript('src/prototypes/cedar/email-provider.ts', 'cedar-email-capability');

const account = (patch = {}) => ({
  account_ref: 'mail_fixture', provider: 'google', mode: 'connected', status: 'connected',
  label: 'seller@example.invalid', revision: 1, history_complete: true,
  synced_at: '2026-09-11T09:00:00Z', invoice_consent_at: null, forwarding_address: null, ...patch,
});
const evidence = (patch = {}) => ({ provider: 'unipile', configured: true, accounts: [account()], ...patch });
const state = (patch = {}) => ({ status: 'ready', evidence: evidence(), error: '', checkedAt: 1_700_000_000_000, staleSince: 0, ...patch });
const sending = { kind: 'connected', providers: ['gmail'], canSend: true };
const reading = { kind: 'connected', providers: ['gmail'], canSend: false };
const unverified = { kind: 'unverified', reason: 'Connect a mailbox to send from here.' };

/* 1 · CHECKING — the first paint, before the provider has answered. It is a posture of its own and
   it is NOT ready, so no surface may mount an inbox, a refresh or a send on it. */
const checking = emailCapabilityOf({ status: 'checking', evidence: null, error: '', checkedAt: 0, staleSince: 0 });
assert.equal(checking.posture, 'checking');
assert.deepEqual(checking.needs, ['connection']);
assert.equal(checking.account, null);
assert.equal(checking.address, '');
assert.equal(checking.canSend, false);
assert.equal(checking.stale, false);
assert.equal(emailStatusWord(checking.posture), 'Connect email');

/* 2 · UNAVAILABLE — the read failed with nothing behind it, or the provider answered about this
   workspace. The error travels with the capability so one quiet line can state it beside the same
   image, and the posture is SETTLED: `declineEmailStatus` clears the evidence with `staleSince: 0`
   on both of its clearing branches, exactly as `declinePhoneSetup` does. Marking it stale printed
   «Connect email … Checking…» beside the artwork on every mail customer's sheet of a workspace
   whose mailbox cannot be read, renewed by every failing read: a definitive answer is a fact, and
   a fact is never a pending check. */
const offline = emailCapabilityOf({ status: 'unavailable', evidence: null, error: 'Reconnect your mailbox, then try again.', checkedAt: 5, staleSince: 0 }, sending);
assert.equal(offline.posture, 'unavailable');
assert.equal(offline.error, 'Reconnect your mailbox, then try again.');
assert.deepEqual(offline.needs, ['connection']);
assert.equal(offline.checkedAt, 5);
assert.equal(offline.stale, false, 'a settled posture is never «Checking…»');
assert.equal(offline.staleSince, 0);
assert.equal(offline.canSend, false, 'a runtime that claims it can send never outranks an absent account');

/* 3 · SETUP — the provider answered and this workspace holds no mailbox at all. This is the state
   a fresh account is in, and the one `company.email` used to overrule. */
const empty = emailCapabilityOf(state({ evidence: evidence({ accounts: [] }) }), unverified);
assert.equal(empty.posture, 'setup');
assert.deepEqual(empty.needs, ['mailbox']);
assert.equal(empty.account, null);
assert.equal(empty.providers.length, 0);
assert.equal(empty.configured, true, 'the provider application is commissioned even with no mailbox on it');
assert.equal(emailCardWords(empty), 'Gmail, Microsoft or forwarding');

/* 3b · AND THE APPLICATION ITSELF MAY BE PENDING — the same posture, with the fact stated. */
const pending = emailCapabilityOf(state({ evidence: evidence({ configured: false, accounts: [] }) }));
assert.equal(pending.posture, 'setup');
assert.equal(pending.configured, false);

/* 4 · READY — one authorized mailbox whose history has been imported. */
const ready = emailCapabilityOf(state(), sending);
assert.equal(ready.posture, 'ready');
assert.deepEqual(ready.needs, []);
assert.deepEqual(ready.providers, ['gmail']);
assert.equal(ready.address, 'seller@example.invalid');
assert.equal(ready.historyReady, true);
assert.equal(ready.canSend, true);
assert.equal(emailStatusWord(ready.posture), 'Connected');
assert.equal(emailCardWords(ready), 'seller@example.invalid', 'the card prints the provider’s own mailbox address');

/* 5 · CONNECTED, READ ONLY — the mailbox is authorized and the runtime grants reading alone. The
   posture stays `ready` because Rocoto draws every mail it was authorized to receive; what the
   state removes is the SEND. */
const readOnly = emailCapabilityOf(state(), reading);
assert.equal(readOnly.posture, 'ready');
assert.equal(readOnly.canSend, false);
assert.equal(readOnly.address, 'seller@example.invalid');

/* 5b · AND WITH NO RUNTIME AT ALL. The default is deliberately unable to send. */
const noRuntime = emailCapabilityOf(state());
assert.equal(noRuntime.posture, 'ready');
assert.equal(noRuntime.canSend, false);

/* 6 · AUTHORIZATION PENDING — the account row exists and the provider says it needs attention.
   This is the exact state `emailStatus.kind === 'connected'` read as a connected mailbox, which
   is what put Refresh email, Read earlier email and an invoice search in front of a dead account. */
const attention = emailCapabilityOf(state({ evidence: evidence({ accounts: [account({ status: 'attention' })] }) }), sending);
assert.equal(attention.posture, 'partial');
assert.deepEqual(attention.needs, ['authorization']);
assert.equal(attention.canSend, false);
assert.equal(attention.providers.length, 0, 'an account needing attention names no send provider');
assert.equal(attention.account.account_ref, 'mail_fixture', 'the pending account is still the one the screens speak about');
assert.equal(emailStatusWord(attention.posture), 'Finish setup');

const unreachable = emailCapabilityOf(state({ evidence: evidence({ accounts: [account({ status: 'unavailable' })] }) }), sending);
assert.equal(unreachable.posture, 'partial');
assert.deepEqual(unreachable.needs, ['authorization']);

/* 7 · HISTORY PENDING — authorized, and the customer history has yet to be imported. */
const noHistory = emailCapabilityOf(state({ evidence: evidence({ accounts: [account({ history_complete: false, synced_at: null })] }) }), sending);
assert.equal(noHistory.posture, 'partial');
assert.deepEqual(noHistory.needs, ['history']);
assert.equal(noHistory.historyReady, false);
assert.equal(noHistory.canSend, false, 'a mailbox whose history is pending sends nothing yet');
assert.equal(noHistory.address, 'seller@example.invalid', 'and it still names the mailbox it authorized');

/* 7b · A MAILBOX WITH MORE THAN ONE PAGE OF CUSTOMER MAIL IS STILL IMPORTED. `history_complete`
   is the server's word for «there was no next page»; a big mailbox keeps it false for ever, so a
   `synced_at` is the second witness and the workspace leaves `Finish setup`. */
const pagedHistory = emailCapabilityOf(state({ evidence: evidence({ accounts: [account({ history_complete: false })] }) }), sending);
assert.equal(pagedHistory.posture, 'ready');
assert.equal(pagedHistory.historyReady, true);

/* 8 · FORWARDING ONLY — an address was commissioned and no mailbox was authorized. Mail arrives
   and stays readable; every send and mailbox control belongs to a mailbox this workspace lacks. */
const forwardingOnly = emailCapabilityOf(state({
  evidence: evidence({ accounts: [account({ account_ref: 'mail_forward', mode: 'forwarded', status: 'connected', label: 'Forwarding', forwarding_address: 'orders@rocoto.invalid' })] }),
}), sending);
assert.equal(forwardingOnly.posture, 'partial');
assert.deepEqual(forwardingOnly.needs, ['mailbox']);
assert.equal(forwardingOnly.forwarding, 'orders@rocoto.invalid');
assert.equal(forwardingOnly.address, '', 'a forwarding address is never a mailbox address');
assert.equal(forwardingOnly.canSend, false);
assert.equal(emailCardWords(forwardingOnly), 'orders@rocoto.invalid');

/* 8b · A FORWARDING ADDRESS BESIDE AN AUTHORIZED MAILBOX takes nothing away from it. */
const both = emailCapabilityOf(state({
  evidence: evidence({ accounts: [account(), account({ account_ref: 'mail_forward', mode: 'forwarded', label: 'Forwarding', forwarding_address: 'orders@rocoto.invalid' })] }),
}), sending);
assert.equal(both.posture, 'ready');
assert.equal(both.address, 'seller@example.invalid');
assert.equal(both.forwarding, 'orders@rocoto.invalid');
assert.equal(both.canSend, true);

/* 9 · TWO MAILBOXES, ONE OF THEM STILL AUTHORIZING. The workspace can read and send through the
   one that is live, so the posture follows the live one and both rows stay on the accounts screen. */
const mixed = emailCapabilityOf(state({
  evidence: evidence({ accounts: [account({ account_ref: 'mail_pending', provider: 'outlook', status: 'attention', label: 'second@example.invalid' }), account()] }),
}), sending);
assert.equal(mixed.posture, 'ready');
assert.deepEqual(mixed.providers, ['gmail']);
assert.equal(mixed.account.account_ref, 'mail_fixture', 'the selected mailbox is the connected one, whatever the order');
assert.equal(mixed.accounts.length, 2, 'both rows survive for the accounts screen');

/* 10 · A STALE READ KEEPS THE MAILBOX. A 503 sixty seconds into a session used to revoke a
   connected account: the inbox swapped itself for the artwork and Connections read «Connect
   email». The evidence stands, the surfaces add one quiet line and only the provider's own answer
   about this workspace moves the posture. */
const stale = emailCapabilityOf(state({ error: 'The connection is taking longer than expected. Try again.', staleSince: 1_700_000_060_000 }), sending);
assert.equal(stale.posture, 'ready');
assert.equal(stale.stale, true);
assert.equal(stale.staleSince, 1_700_000_060_000);
assert.equal(stale.canSend, true, 'a read about the network changes nothing about the mailbox');
assert.equal(stale.error, 'The connection is taking longer than expected. Try again.');

/* 11 · STALE LOCAL STATE HAS NO VOTE. The selector takes the provider snapshot and the runtime's
   send authority and nothing else — there is no argument through which `company.email`, a
   `config.mailbox` switch or a sample walk's flag could reach it. An empty provider answer stays
   `setup` however loudly the browser remembers a mailbox. */
const drafted = emailCapabilityOf(state({ evidence: evidence({ accounts: [] }) }), { kind: 'connected', providers: ['gmail', 'm365'], canSend: true });
assert.equal(drafted.posture, 'setup');
assert.deepEqual(drafted.needs, ['mailbox']);
assert.equal(drafted.canSend, false);
assert.deepEqual(drafted.providers, []);

/* 12 · THE TWO SENTENCES EVERY SCREEN SHARES. */
assert.equal(emailStatusWord('checking'), 'Connect email');
assert.equal(emailStatusWord('unavailable'), 'Connect email');
assert.equal(emailStatusWord('setup'), 'Connect email');
assert.equal(emailStatusWord('partial'), 'Finish setup');
assert.equal(emailStatusWord('ready'), 'Connected');

/* 13 · THE TWO PREDICATES THE ACCOUNT ROWS READ, stated once and shared with the screens. */
assert.equal(mailboxConnected(account()), true);
assert.equal(mailboxConnected(account({ status: 'attention' })), false);
assert.equal(mailboxConnected(account({ mode: 'forwarded' })), false);
assert.equal(mailboxConnected(null), false);
assert.equal(mailboxHistoryReady(account()), true);
assert.equal(mailboxHistoryReady(account({ history_complete: false, synced_at: null })), false);
assert.equal(mailboxHistoryReady(account({ history_complete: false })), true);
assert.equal(mailboxHistoryReady(undefined), false);

/* 14 · WHAT A FAILED READ LEAVES STANDING, measured on the snapshot itself rather than on a state
   object a test wrote. Three branches, and they are the phone's own three. */

/* 14a · THE PROVIDER'S OWN ANSWER ABOUT THIS WORKSPACE IS SETTLED. 401, 403 and 404 clear the
   mailboxes, and a settled posture carries `staleSince: 0`. */
acceptEmailStatus(evidence());
assert.equal(emailProviderNow().status, 'ready');
declineEmailStatus(Object.assign(new Error('Reconnect your mailbox, then try again.'), { status: 401 }));
const revoked = emailProviderNow();
assert.equal(revoked.status, 'unavailable');
assert.equal(revoked.evidence, null);
assert.equal(revoked.staleSince, 0, 'the provider answered, so nothing is left to be unsure about');
assert.equal(emailCapabilityOf(revoked, sending).posture, 'unavailable');
assert.equal(emailCapabilityOf(revoked, sending).stale, false, 'a revoked mailbox never reads «Checking…»');

/* 14b · A FIRST READ WITH NOTHING BEHIND IT IS SETTLED TOO. */
declineEmailStatus(new Error('The mailbox service is taking longer than expected. Try again.'));
const firstRead = emailProviderNow();
assert.equal(firstRead.status, 'unavailable');
assert.equal(firstRead.staleSince, 0);
assert.equal(emailCapabilityOf(firstRead).stale, false);

/* 14c · AND A TRANSIENT FAILURE KEEPS THE EVIDENCE. A 503 sixty seconds into a session is a fact
   about the network: the mailbox stands, the posture stands, and `stale` is what says the last
   read failed to confirm it. */
acceptEmailStatus(evidence());
declineEmailStatus(new Error('The mailbox service is taking longer than expected. Try again.'));
const kept = emailProviderNow();
assert.equal(kept.status, 'ready');
assert.notEqual(kept.evidence, null);
assert.ok(kept.staleSince > 0, 'the evidence stands and the last read failed to confirm it');
const keptCapability = emailCapabilityOf(kept, sending);
assert.equal(keptCapability.posture, 'ready');
assert.equal(keptCapability.stale, true);
assert.equal(keptCapability.canSend, true, 'a read about the network changes nothing about the mailbox');
assert.equal(keptCapability.error, 'The mailbox service is taking longer than expected. Try again.');

console.log('email capability: every posture derives from the provider snapshot alone');
