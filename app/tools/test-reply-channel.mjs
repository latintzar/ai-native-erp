/* THE CHANNEL LAW, AS ARITHMETIC (FEED-IA §196.7 · §246 acceptance 5).
 *
 * Two questions this file answers without a browser:
 *   1 · WHAT CHANNEL DID THIS TURN TRAVEL ON — provider provenance, then mail metadata, then the
 *       account's own door. A telephone order is a call, a mail turn is mail, and a seeded row on
 *       a WhatsApp account is WhatsApp.
 *   2 · WHERE DOES THE REPLY GO — and, since §246, whether the person was the one who moved it.
 *       «Channel changes must be explicit»: an unbound WhatsApp conversation keeps its WhatsApp
 *       composer and states the send state, and email is a press.
 */
import assert from 'node:assert/strict';
import { loadTypeScript } from './ts-module.mjs';

const {
  accountChannelOf, channelOfTurn, channelWord, conversationEmailDoor, conversationSeatOf,
  isCallTurn, mailSubjectsShown, replyChannelOf, whatsappBoundNow,
} = loadTypeScript('src/prototypes/cedar/reply-channel.ts', 'cedar-reply-channel');

const whatsappAccount = { channel: 'WhatsApp' };
const phoneAccount = { channel: 'phone' };
const mailAccount = { channel: 'email' };
const portalAccount = { channel: 'portal' };

/* ── 1 · THE ACCOUNT'S OWN DOOR ────────────────────────────────────────────────────────────── */
assert.equal(accountChannelOf('WhatsApp'), 'whatsapp');
assert.equal(accountChannelOf('phone'), 'phone');
assert.equal(accountChannelOf('email'), 'email');
assert.equal(accountChannelOf('portal'), 'note', 'a portal account has no message door');
assert.equal(accountChannelOf('in person'), 'note', 'an in-person account has no message door');

/* ── 1b · AND THE WORD FOR IT, WRITTEN ONCE (§246 acceptance 5) ─────────────────────────────
   The cast stores `portal` and `in person` in lower case because they are DATA. Two surfaces
   printed that data straight — the Delivery Note chip said «Phone» and the Messages header said
   «phone» about the same account — so the label is folded here and both read it. */
assert.equal(channelWord('WhatsApp'), 'WhatsApp');
assert.equal(channelWord('phone'), 'Phone', 'a label is written the way a name is written');
assert.equal(channelWord('email'), 'Email');
assert.equal(channelWord('portal'), 'Portal');
assert.equal(channelWord('in person'), 'In person');

/* ── 2 · THE PER-TURN READ ─────────────────────────────────────────────────────────────────── */
assert.equal(
  channelOfTurn({ source: { channel: 'phone' }, voice: { durationMs: 8200 } }, whatsappAccount),
  'phone',
  'provider provenance outranks the account: a call on a WhatsApp account is still a call',
);
assert.equal(
  channelOfTurn({ source: { channel: 'whatsapp' } }, mailAccount),
  'whatsapp',
  'and it outranks a mail account too',
);
assert.equal(
  channelOfTurn({ email: { subject: 'Order for Friday', from: 'Hotel Rec', to: ['Peix Nou'] } }, whatsappAccount),
  'email',
  'one email inside a WhatsApp conversation is an email turn',
);
assert.equal(channelOfTurn({ text: 'Morning. 12 kg merluza.' }, whatsappAccount), 'whatsapp');
assert.equal(channelOfTurn({ voice: { durationMs: 7000 } }, phoneAccount), 'phone');
assert.equal(channelOfTurn({ text: 'Order for tomorrow' }, mailAccount), 'email');
assert.equal(channelOfTurn({ text: 'Left at the counter' }, portalAccount), 'note');

assert.equal(isCallTurn({ voice: { durationMs: 7000 }, author: 'received' }, phoneAccount), true);
assert.equal(
  isCallTurn({ voice: { durationMs: 7000 }, author: 'received' }, whatsappAccount), false,
  'a WhatsApp voice note is a voice note, never a call record',
);
/* ⚠ THE DEFECT §246 NAMES, AND WHAT MEASURING IT ACTUALLY FOUND. `spoken()` (shell/threads.ts)
   turns the FIRST received row of each sale into a recording and `withQuestion` can append a
   SECOND one, so a recording-only predicate would draw that follow-up as a WhatsApp bubble inside
   a conversation that has no chat channel. A sweep of the seeded fish day found 80 telephone
   conversations and ZERO such bubbles: the path was LATENT rather than firing. It is closed
   either way, and `CallRecord`'s words-only branch is reachable — a customer turn on a telephone
   account is a call, recorded or written down. */
assert.equal(
  isCallTurn({ text: 'And what is the Pulpo at today?', author: 'received' }, phoneAccount), true,
  'a telephone turn with the words written down is still a call',
);
assert.equal(
  isCallTurn({ text: 'Read from phone as 4 lines.', author: 'ai' }, phoneAccount), false,
  'Rocoto’s own reading stays a reading — the trail renders it',
);
assert.equal(
  isCallTurn({ text: 'Confirmed for Friday.', author: 'sent' }, phoneAccount), false,
  'and the house’s own note keeps the existing trail rendering',
);

/* ── 2b · THE SUBJECT IS PRINTED WHERE IT CHANGES (§40.3 · §25.5) ───────────────────────────
   Three mails in a row on «Order for Monday» print that heading once. `EmailConversation` has
   always done this; the chat stream mounted the same card with `showSubject={Boolean(subject)}`
   and printed the same fact three times in one column. One rule, read by both housings. */
const monday = { subject: 'Order for Monday' };
const friday = { subject: 'Order for Friday' };
const run = mailSubjectsShown([
  { id: 'm1', author: 'received', email: monday },
  { id: 'm2', author: 'received', email: monday },
  { id: 'w1', author: 'received', text: 'And two crates of gamba.' },
  { id: 'm3', author: 'received', email: monday },
  { id: 'm4', author: 'received', email: friday },
  { id: 'm5', author: 'received', email: { } },
], whatsappAccount);
assert.equal(run.get('m1'), true, 'the first mail prints its subject');
assert.equal(run.get('m2'), false, 'the second on the same subject says it once');
assert.equal(run.get('w1'), undefined, 'a WhatsApp bubble has no subject to print');
assert.equal(run.get('m3'), false, 'and a bubble standing between two mails changes no subject');
assert.equal(run.get('m4'), true, 'a new subject is a new heading');
assert.equal(run.get('m5'), false, 'a mail carrying no subject prints no heading');

/* ── 3 · IS THE HOUSE'S NUMBER BOUND RIGHT NOW ─────────────────────────────────────────────── */
assert.equal(
  whatsappBoundNow({ sector: 'fish', connection: { workspace: 'fish', number: '+34600111222' } }),
  true,
  'a live provider connection for this workspace binds it',
);
assert.equal(
  whatsappBoundNow({ sector: 'fish', connection: { workspace: 'meat', number: '+34600111222' } }),
  false,
  'another workspace’s connection binds nothing here',
);
assert.equal(whatsappBoundNow({ sector: 'fish', connection: null }), false);
assert.equal(whatsappBoundNow({ sector: 'fish' }), false, 'with no provider answer, nothing is bound');
/* ⚠ AND A CONNECTION THAT NAMES NO WORKSPACE BINDS NO WORKSPACE. `Connection.workspace` is written
   only once `bind_workspace()` has run, so a completed Embedded Signup sits in the store with the
   field missing — and a permissive read made that one connection bind the meat house, the
   vegetable house and every other. `whatsapp-capability.ts` requires the strict match at every
   other entrance; this is the same rule, folded here, so one question has one answer. */
assert.equal(
  whatsappBoundNow({ sector: 'fish', connection: { number: '+34600111222' } }),
  false,
  'a connection bound to no workspace binds nothing in this one',
);
/* ⚠ AND THE LOCAL LEDGER HAS NO VOTE AT ALL (§247.2). It used to sit behind an `||`, where the
   weaker half wins: `activation.ts`'s `whatsapp-connect` row is append-only, has no revocation
   path and is seeded on the demo path, so one row outvoted a live provider reporting nothing for
   the rest of that browser's life. The argument no longer exists, and passing it changes nothing. */
assert.equal(
  whatsappBoundNow({ sector: 'fish', events: [{ kind: 'whatsapp-connect', sector: 'fish' }], connection: null }),
  false,
  'an append-only activation row is a local draft, and a local draft has no vote',
);

/* ── 3b · THE SEAT UNDER THE CONVERSATION, DERIVED ONCE ─────────────────────────────────────
   Two housings restated this rule out of the same three facts, in two files. One derivation now. */
assert.equal(conversationSeatOf(whatsappAccount, []), 'composer');
assert.equal(conversationSeatOf(mailAccount, []), 'composer');
assert.equal(conversationSeatOf(phoneAccount, []), 'call', 'a telephone conversation is answered by calling it');
assert.equal(conversationSeatOf(portalAccount, []), 'note', 'a portal account names its own door');
assert.equal(
  conversationSeatOf({ channel: 'portal', email: 'pedidos@hotelrec.example' }, []), 'composer',
  'and it writes by email the moment it has an address to write to',
);
assert.equal(
  conversationSeatOf(portalAccount, [{ id: 'm1', author: 'received', email: { subject: 'Order' } }]), 'composer',
  'a mail turn standing in the conversation is an email door too',
);
assert.equal(conversationEmailDoor(whatsappAccount, []), false);
assert.equal(conversationEmailDoor(mailAccount, []), true);

/* ── 4 · WHERE THE REPLY GOES ──────────────────────────────────────────────────────────────── */
const aimed = replyChannelOf({ customer: mailAccount, mail: true, aimedAtEmail: true, whatsappBound: false, emailConnected: true });
assert.equal(aimed.channel, 'email');
assert.equal(aimed.because, 'reply-aimed');
assert.equal(aimed.writes, true);
assert.equal(aimed.canSend, true);

const account = replyChannelOf({ customer: mailAccount, mail: true, whatsappBound: false, emailConnected: true });
assert.equal(account.channel, 'email');
assert.equal(account.because, 'account');
assert.equal(account.sendLabel, 'Send by email');
assert.equal(account.canSend, true);
/* ⚠ EMAIL'S DOOR IS THE PERSON'S OWN MAIL CLIENT. `mailto:` and the provider compose windows open
   for anyone, so the send stands; what a mailbox connection changes is whether ROCOTO sends, and
   the mailbox line under the composer states that in its own words. WhatsApp is the channel whose
   send is the house's binding, and that is the one this fact gates. */
assert.equal(
  replyChannelOf({ customer: mailAccount, mail: true, whatsappBound: false }).canSend, true,
  'the mail door is the person’s own client, and it opens',
);

const live = replyChannelOf({
  customer: whatsappAccount,
  whatsappBound: whatsappBoundNow({ sector: 'fish', connection: { workspace: 'fish' } }),
});
assert.equal(live.channel, 'whatsapp');
assert.equal(live.because, 'connected');
assert.equal(live.sendLabel, 'Send on WhatsApp');
assert.equal(live.note, undefined, 'a bound number needs no sentence about itself');
assert.equal(live.canSend, true, 'a bound number carries the words');

/* THE DEFECT §246 NAMES. An old incoming message used to make this read `connected`; the
   conversation stays on WhatsApp, and the line under the box states the send state. */
const pending = replyChannelOf({ customer: whatsappAccount, whatsappBound: false });
assert.equal(pending.channel, 'whatsapp', 'a WhatsApp conversation keeps its WhatsApp composer');
assert.equal(pending.because, 'whatsapp-pending');
/* ⚠ AND THE SENTENCE NAMES THE HOUSE'S OWN NUMBER. «WhatsApp sends once Meta confirms your
   number.» read as a condition on the send control one press above it — and that control hands the
   words to WhatsApp's own door whatever Meta has confirmed, so the reader was told a press would
   wait and it did not. What is actually pending is ROCOTO sending from the house's own number. */
assert.equal(pending.note, 'Rocoto sends from your own number once Meta confirms it.');
assert.equal(pending.writes, true);
assert.equal(pending.offer, undefined, 'with no email door there is one honest channel and no switch');
/* ⚠ AND `canSend` IS ABOUT ROCOTO, NEVER ABOUT THE DISC (§246 acceptance 5). `whatsappBound` used
   to be consumed exactly once, to pick a `because` string, so a composer marked `data-bound="no"`
   said one thing in words and another in every control it drew. The repair that DIMMED the send
   was built and removed: `wa.me` is the person's own WhatsApp and it opens for anyone, exactly as
   `mailto:` opens their own mail client, and a withheld `onSend` renders the kit's disc `disabled`
   — out of the tab order, with `Enter` doing nothing. What waits is ROCOTO sending from the house's
   own number, and this is the fact the pending line, the one Connect act and the house number on
   the strip read (`shell/chats.tsx` · CHANNEL-SEMANTICS.md §3). */
assert.equal(pending.canSend, false, 'Rocoto’s own sending waits on the binding, and says so');

const withMail = replyChannelOf({ customer: whatsappAccount, whatsappBound: false, emailStanding: true, emailConnected: true });
assert.equal(withMail.channel, 'whatsapp');
assert.deepEqual(withMail.offer, { to: 'email', label: 'Reply by email instead' });
/* ⚠ AN OFFER TO SWITCH IS A PROMISE THE OTHER CHANNEL WORKS. `emailStanding` is an address on the
   customer record or a mail turn in the history — RECORD PROVENANCE, never a mailbox connection —
   so the offer used to move a person's reply onto a mailbox nobody had connected. */
assert.equal(
  replyChannelOf({ customer: whatsappAccount, whatsappBound: false, emailStanding: true }).offer, undefined,
  'an address on a record is provenance; the offer needs a mailbox that is actually connected',
);

const chosen = replyChannelOf({
  customer: whatsappAccount, whatsappBound: true, emailStanding: true, emailConnected: true, chose: 'email',
});
assert.equal(chosen.channel, 'email');
assert.equal(chosen.because, 'chosen-email');
assert.equal(chosen.note, 'This reply goes by email.');
assert.deepEqual(chosen.offer, { to: 'whatsapp', label: 'Reply on WhatsApp instead' },
  'the choice is reversible from the composer that took it');
/* ⚠ AND THE WAY BACK IS AN UNDO, WHICH IS A DIFFERENT OBJECT FROM AN OFFER. The audit asked for
   this direction to require a bound number too; requiring it would strand a person on a
   destination THEY chose, with the press that made the choice gone from under them — and clause 4
   is explicit that a WhatsApp conversation keeps its WhatsApp composer whether or not the number
   is bound. The harm named for this direction was «put the reply back on an unbound WhatsApp with
   a live Send»; it is answered in words rather than by a dead control — the composer they come
   back to states what Rocoto's own sending is waiting on and carries one act that lifts it. */
const undone = replyChannelOf({ customer: whatsappAccount, whatsappBound: false, emailStanding: true, emailConnected: true, chose: 'email' });
assert.deepEqual(undone.offer, { to: 'whatsapp', label: 'Reply on WhatsApp instead' },
  'a person can always undo their own choice');
assert.equal(
  replyChannelOf({ customer: whatsappAccount, whatsappBound: false, emailStanding: true, emailConnected: true }).canSend, false,
  'and what they come back to is a composer that states what Rocoto’s own sending waits on',
);

assert.equal(
  replyChannelOf({ customer: whatsappAccount, whatsappBound: false, chose: 'email' }).channel,
  'whatsapp',
  'a switch that was never offered can never be taken',
);

const call = replyChannelOf({ customer: phoneAccount, whatsappBound: true });
assert.equal(call.channel, 'phone');
assert.equal(call.because, 'call');
assert.equal(call.writes, false, 'a telephone conversation carries a Call action, never a composer');
assert.equal(call.canSend, false);
assert.equal(call.note, 'This conversation happens by telephone.');

const portal = replyChannelOf({ customer: portalAccount, whatsappBound: true });
assert.equal(portal.because, 'note');
assert.equal(portal.writes, false, 'a portal account keeps its own door rather than borrowing WhatsApp’s');
assert.equal(
  replyChannelOf({ customer: portalAccount, whatsappBound: false, emailStanding: true, emailConnected: true }).writes, true,
  'and it writes by email the moment it has an address to write to',
);

/* ── 5 · THE COPY LAW OVER EVERY SENTENCE THIS FILE PRODUCES (§198-A) ──────────────────────── */
const NEGATIVE = /\b(no|not|nothing|never|nobody|none|cannot|can't|don't|doesn't|won't|isn't|aren't|wasn't|hasn't|haven't|didn't|without|unless)\b/i;
for (const standing of [aimed, account, live, pending, withMail, chosen, call, portal]) {
  for (const said of [standing.word, standing.sendLabel, standing.micLabel, standing.note, standing.offer?.label]) {
    if (!said) continue;
    assert.equal(NEGATIVE.test(said), false, `the channel says what IS: ${said}`);
  }
}

console.log('Cedar channel-law checks passed (per-turn channel, one seat law, provider-only bound evidence, stated send state, explicit reply target)');
