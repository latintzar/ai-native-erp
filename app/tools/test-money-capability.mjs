/* ONE PROVIDER ANSWER PER MONEY ACCOUNT, measured against the module that derives it.
 *
 * «same for emailabout the connection state. always we havbe to be super consistent and not fget
 *  people igo confusing menus when they shouldnt see them»       — Peter, FEED-IA §247.2
 *
 * What he had: Settings → Connections answered «is the bank connected» from the local flag
 * `setup.payments === 'demo-connected'`, the Money balance answered it from Prometeo, the
 * Yape & Plin card answered it by reading the BANK's flag, and the Electronic-invoices card read
 * `setup.invoicing` while the invoice it issues read NubeFact's own fiscal phase. Four witnesses.
 *
 * This suite pins the single derivation — `bankCapabilityOf`, `walletCapabilityOf`,
 * `invoicingCapabilityOf` and the three status words — across every posture a workspace can be
 * in, and pins the Money state vocabulary those surfaces print. Both modules are pure, so the real
 * ones run here rather than a copy of them.
 */
import assert from 'node:assert/strict';
import { loadTypeScript } from './ts-module.mjs';

const {
  bankCapabilityOf, walletCapabilityOf, invoicingCapabilityOf,
  bankStatusWord, walletStatusWord, invoicingStatusWord,
  DEFINITIVE, declinedMoneyProvider, acceptedMoneyProvider,
} = loadTypeScript('src/prototypes/cedar/money-bank-capability.ts', 'cedar-money-capability');

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`GREEN ${name}`); };

const READINESS = {
  prometeo: { configured: true, bank_authorized: true, last_read: '2026-09-11T12:00:00Z', mode: 'sandbox' },
  nubefact: { configured: true, mode: 'sandbox', documents: 3 },
};
const ACCOUNT = {
  ready: true, bank: 'bbva', account_label: 'Main receiving account', account_mask: '•••• 1234',
  balance_minor: 987654, currency: 'PEN', as_of: '2026-09-11T12:00:00Z', mode: 'sandbox', source: 'prometeo',
};
const state = (patch = {}) => ({ status: 'ready', bank: null, readiness: null, error: '', checkedAt: 1, staleSince: 0, ...patch });

/* 1 · THE FOUR POSTURES. Everything that is not `ready` wears the same picture and the same act. */
check('a first read in flight is Checking, and it asks for the connection', () => {
  const checking = state({ status: 'checking', checkedAt: 0 });
  for (const capability of [bankCapabilityOf(checking), walletCapabilityOf(checking), invoicingCapabilityOf(checking)]) {
    assert.equal(capability.posture, 'checking');
    assert.deepEqual(capability.needs, ['connection']);
  }
});

check('a workspace the service answers nothing about is Unavailable', () => {
  const silent = state({ status: 'unavailable', error: 'Open this request in its connected Cedar preview.' });
  for (const capability of [bankCapabilityOf(silent), walletCapabilityOf(silent), invoicingCapabilityOf(silent)]) {
    assert.equal(capability.posture, 'unavailable');
    assert.deepEqual(capability.needs, ['connection']);
    assert.equal(capability.error, 'Open this request in its connected Cedar preview.');
  }
});

check('a service that answers with no authorized account is Setup, and prints no balance', () => {
  const bank = bankCapabilityOf(state({ bank: { ready: false, mode: 'sample' }, readiness: READINESS }));
  assert.equal(bank.posture, 'setup');
  assert.deepEqual(bank.needs, ['account']);
  assert.equal(bank.balanceMinor, null);
  assert.equal(bank.accountLabel, '');
});

check('an authorized account is Ready and carries the provider’s own figures', () => {
  const bank = bankCapabilityOf(state({ bank: ACCOUNT, readiness: READINESS }));
  assert.equal(bank.posture, 'ready');
  assert.deepEqual(bank.needs, []);
  assert.equal(bank.bank, 'bbva');
  assert.equal(bank.accountLabel, 'Main receiving account');
  assert.equal(bank.accountMask, '•••• 1234');
  assert.equal(bank.balanceMinor, 987654);
  assert.equal(bank.currency, 'PEN');
  assert.equal(bank.mode, 'sandbox');
});

/* 1b · THE HYBRID DEMO (FEED-IA §251). «it should be with mock data cos we still dont have rela
   prometeo but people dont need to know that.» The collection service in sample mode serves this
   workspace's bank from Cedar's own seed, in the shape a commissioned account answers. A seeded
   account is an account: the posture is `ready`, the word is «Connected», the mode says `sample`,
   and every Money door opens. The day the key is commissioned the same doors read the real one. */
const SEEDED = { ...ACCOUNT, account_label: 'Peix Vilalta', mode: 'sample', source: 'sample',
  wallets: { yape: true, plin: true }, monitor: { status: 'off' } };
const SEEDED_READINESS = {
  prometeo: { configured: true, bank_authorized: true, last_read: null, mode: 'sample' },
  nubefact: { configured: true, mode: 'sample', documents: 0 },
};

check('a seeded account is Ready, states its mode as sample and prints Connected', () => {
  const bank = bankCapabilityOf(state({ bank: SEEDED, readiness: SEEDED_READINESS }));
  assert.equal(bank.posture, 'ready');
  assert.deepEqual(bank.needs, []);
  assert.equal(bank.mode, 'sample');
  assert.equal(bank.accountLabel, 'Peix Vilalta');
  assert.equal(bank.balanceMinor, 987654);
  assert.equal(bankStatusWord(bank.posture), 'Connected');
});

check('the seeded account states Yape and Plin, so the wallets card is Connected too', () => {
  const wallets = walletCapabilityOf(state({ bank: SEEDED, readiness: SEEDED_READINESS }));
  assert.equal(wallets.posture, 'ready');
  assert.equal(wallets.yape, true);
  assert.equal(wallets.plin, true);
  assert.equal(walletStatusWord(wallets.posture), 'Connected');
});

check('seeded invoicing is Ready and states sample', () => {
  const invoicing = invoicingCapabilityOf(state({ bank: SEEDED, readiness: SEEDED_READINESS }));
  assert.equal(invoicing.posture, 'ready');
  assert.equal(invoicing.mode, 'sample');
  assert.equal(invoicingStatusWord(invoicing.posture), 'Connected');
});

check('a workspace the seeded bank answers nothing about still reads Connect bank', () => {
  const unseeded = bankCapabilityOf(state({ bank: { ready: false, mode: 'sample' }, readiness: SEEDED_READINESS }));
  assert.equal(unseeded.posture, 'setup');
  assert.equal(unseeded.mode, null);
  assert.equal(bankStatusWord(unseeded.posture), 'Connect bank');
});

/* 2 · THE LOCAL FLAG HAS NO VOTE. The selector takes provider evidence and nothing else — the
   module cannot even see `setup.payments`, which is the whole point of keeping it pure. */
check('the derivation reads provider evidence alone', () => {
  const flagged = state({ status: 'unavailable', bank: null, readiness: null, setup: { payments: 'demo-connected', invoicing: 'demo-connected' } });
  assert.equal(bankCapabilityOf(flagged).posture, 'unavailable');
  assert.equal(walletCapabilityOf(flagged).posture, 'unavailable');
  assert.equal(invoicingCapabilityOf(flagged).posture, 'unavailable');
});

/* 3 · A FAILED READ IS A FACT ABOUT THE NETWORK. Evidence stands, and the posture stands with it. */
check('a read that failed to confirm a connected account keeps it connected and marks it stale', () => {
  const stale = state({ bank: ACCOUNT, readiness: READINESS, error: 'Reconnect the money service, then try again.', staleSince: 42 });
  const bank = bankCapabilityOf(stale);
  assert.equal(bank.posture, 'ready');
  assert.equal(bank.stale, true);
  assert.equal(bank.staleSince, 42);
  assert.equal(invoicingCapabilityOf(stale).stale, true);
});

/* 4 · A MONITOR ASKING FOR RE-AUTHORIZATION KEEPS THE ACCOUNT CONNECTED and states its one step. */
check('a reauthorization-required monitor stays Ready with one pending need', () => {
  const bank = bankCapabilityOf(state({ bank: { ...ACCOUNT, monitor: { status: 'reauthorization-required' } }, readiness: READINESS }));
  assert.equal(bank.posture, 'ready');
  assert.deepEqual(bank.needs, ['reauthorization']);
  assert.equal(bank.monitor, 'reauthorization-required');
});

/* 5 · WALLETS NEVER INHERIT THE BANK'S ANSWER. This is the repair Peter's «not fget people igo
   confusing menus» names: one flag was answering two connections. */
check('an authorized bank leaves Yape and Plin at their own posture', () => {
  const wallets = walletCapabilityOf(state({ bank: ACCOUNT, readiness: READINESS }));
  assert.equal(wallets.posture, 'setup');
  assert.deepEqual(wallets.needs, ['wallet']);
  assert.equal(wallets.yape, false);
  assert.equal(wallets.plin, false);
  assert.equal(walletStatusWord(wallets.posture), 'Set up payments');
});

check('a wallet the service states as collecting is the only thing that makes it Ready', () => {
  const wallets = walletCapabilityOf(state({ bank: { ...ACCOUNT, wallets: { yape: true, plin: false } }, readiness: READINESS }));
  assert.equal(wallets.posture, 'ready');
  assert.equal(wallets.yape, true);
  assert.equal(wallets.plin, false);
  assert.equal(walletStatusWord(wallets.posture), 'Connected');
});

/* 6 · INVOICING READS THE SAME NUBEFACT RECORD THE DOCUMENT TRUSTS. */
check('NubeFact with no configuration is Setup, whatever the bank says', () => {
  const unconfigured = { ...READINESS, nubefact: { configured: false, mode: null, documents: 0 } };
  const invoicing = invoicingCapabilityOf(state({ bank: ACCOUNT, readiness: unconfigured }));
  assert.equal(invoicing.posture, 'setup');
  assert.deepEqual(invoicing.needs, ['invoicing']);
  assert.equal(invoicingStatusWord(invoicing.posture), 'Set up invoicing');
});

check('a configured NubeFact account with a mode is Ready and states it', () => {
  const invoicing = invoicingCapabilityOf(state({ bank: ACCOUNT, readiness: READINESS }));
  assert.equal(invoicing.posture, 'ready');
  assert.equal(invoicing.mode, 'sandbox');
  assert.equal(invoicing.documents, 3);
  assert.equal(invoicingStatusWord(invoicing.posture), 'Connected');
});

check('a configured account the service gives no mode for stays at Setup', () => {
  const pending = { ...READINESS, nubefact: { configured: true, mode: null, documents: 0 } };
  assert.equal(invoicingCapabilityOf(state({ readiness: pending })).posture, 'setup');
});

/* 7 · THE WORD EACH CARD PRINTS. «Connected» belongs to `ready` and to nothing else. */
check('every card keeps «Connected» for a provider answer and states its act otherwise', () => {
  for (const posture of ['checking', 'unavailable', 'setup']) {
    assert.equal(bankStatusWord(posture), 'Connect bank');
    assert.equal(walletStatusWord(posture), 'Set up payments');
    assert.equal(invoicingStatusWord(posture), 'Set up invoicing');
  }
  assert.equal(bankStatusWord('ready'), 'Connected');
  assert.equal(walletStatusWord('ready'), 'Connected');
  assert.equal(invoicingStatusWord('ready'), 'Connected');
});

/* 8 · THE MONEY STATE VOCABULARY the connected surfaces print, from the one table. */
const { MONEY_STATUS_WORDS, statusWordsOf, amountStatusOf, installmentStatusOf, planStatusOf } =
  loadTypeScript('src/prototypes/cedar/money-model.ts', 'cedar-money-capability-words');

check('the Money vocabulary is one table and holds no Scheduled', () => {
  assert.deepEqual(Object.keys(MONEY_STATUS_WORDS).sort(), [
    'due', 'offered', 'overdue', 'paid', 'part-paid', 'repaid', 'repaying', 'requested', 'upcoming',
  ]);
  assert.equal(Object.values(MONEY_STATUS_WORDS).includes('Scheduled'), false);
  assert.equal(statusWordsOf('repaid'), 'Repaid');
  assert.equal(statusWordsOf('offered'), 'Offered');
});

check('«Due» belongs to an amount on its date, and an earlier one reads Upcoming', () => {
  const amount = (patch = {}) => ({ amountMinor: 16817, paidMinor: 0, dueAt: '2026-11-11', ...patch });
  assert.equal(amountStatusOf(amount(), '2026-10-20', true), 'upcoming');
  assert.equal(amountStatusOf(amount(), '2026-11-11', true), 'due');
  assert.equal(amountStatusOf(amount(), '2026-11-12', true), 'overdue');
  assert.equal(statusWordsOf(amountStatusOf(amount(), '2026-10-20', true)), 'Upcoming');
});

check('the next instalment of a live plan takes the word its own date earns', () => {
  const plan = { count: 3, paidCount: 1, installments: [
    { dueAt: '2026-10-11', amountMinor: 33500 }, { dueAt: '2026-11-11', amountMinor: 33500 }, { dueAt: '2026-12-11', amountMinor: 33500 }] };
  assert.equal(installmentStatusOf(plan, 0, '2026-10-20'), 'paid');
  assert.equal(installmentStatusOf(plan, 1, '2026-10-20'), 'upcoming');
  assert.equal(installmentStatusOf(plan, 1, '2026-11-11'), 'due');
  assert.equal(installmentStatusOf(plan, 1, '2026-12-01'), 'overdue');
  assert.equal(planStatusOf(plan), 'repaying');
  assert.equal(planStatusOf({ ...plan, paidCount: 3 }), 'repaid');
  assert.equal(planStatusOf(null), 'offered');
});

/* 9 · WHAT A READ LEAVES STANDING (§246 review, findings 2 and 3). The runtime publishes through
 * these two reducers, so the whole rule is measured here rather than through a browser.
 *
 * The defect: `decline` had no definitive branch at all. A workspace whose token was rotated or
 * invalidated answers 401 `workspace_access_required` on every route; both reads rejected, the
 * standing bank record was republished, and Settings → Connections kept printing «✓ Connected»
 * over a balance nobody could read, with every money act mounted and every press failing. */
const connected = () => state({ bank: ACCOUNT, readiness: READINESS, checkedAt: 10 });

check('the provider’s own answer about this workspace clears the evidence', () => {
  assert.deepEqual(DEFINITIVE, [401, 403, 404]);
  for (const status of DEFINITIVE) {
    const next = declinedMoneyProvider(connected(), status, 'Open this request from its original Cedar workspace.', 20);
    assert.equal(next.status, 'unavailable', `${status} settles the posture`);
    assert.equal(next.bank, null);
    assert.equal(next.readiness, null);
    assert.equal(next.staleSince, 0, 'a settled posture is never «Checking…»');
    assert.equal(bankCapabilityOf(next).posture, 'unavailable');
    assert.equal(bankStatusWord(bankCapabilityOf(next).posture), 'Connect bank');
    assert.equal(bankCapabilityOf(next).stale, false);
  }
});

check('a transport failure keeps the account connected and marks the evidence stale', () => {
  for (const status of [0, 429, 500, 502, 503, null]) {
    const next = declinedMoneyProvider(connected(), status, 'Reconnect to the collection service, then try again.', 20);
    assert.equal(next.status, 'ready', `${status} is a fact about the network`);
    assert.equal(next.bank, ACCOUNT);
    assert.equal(next.staleSince, 20);
    assert.equal(bankCapabilityOf(next).posture, 'ready');
    assert.equal(bankStatusWord(bankCapabilityOf(next).posture), 'Connected');
    assert.equal(bankCapabilityOf(next).stale, true);
  }
  const held = declinedMoneyProvider(state({ bank: ACCOUNT, staleSince: 12 }), 503, 'Reconnect.', 40);
  assert.equal(held.staleSince, 12, 'the first failed read since the last good one keeps the hour');
});

check('a first read with nothing behind it settles at Unavailable', () => {
  const next = declinedMoneyProvider(state({ status: 'checking', checkedAt: 0 }), 503, 'Reconnect.', 20);
  assert.equal(next.status, 'unavailable');
  assert.equal(next.staleSince, 0);
  assert.equal(bankCapabilityOf(next).stale, false);
});

/* The other half of the same sentence: the branch that SETTLES a posture carries `staleSince: 0`,
 * and the branch that carries an unconfirmed record forward carries the mark. Both were inverted:
 * every demo workspace with no collection origin read `stale`, and a `/bank` read that had failed
 * for ten minutes beside an answering `/setup` left its balance on screen marked fresh. */
check('the empty settled answer is a fact rather than a pending check', () => {
  const next = acceptedMoneyProvider(state({ status: 'checking', checkedAt: 0 }), null, null, 30);
  assert.equal(next.status, 'unavailable');
  assert.equal(next.staleSince, 0);
  for (const capability of [bankCapabilityOf(next), walletCapabilityOf(next), invoicingCapabilityOf(next)]) {
    assert.equal(capability.posture, 'unavailable');
    assert.equal(capability.stale, false);
  }
});

check('a record carried forward from a read that rejected is marked stale', () => {
  const carried = acceptedMoneyProvider(connected(), ACCOUNT, null, 30, false);
  assert.equal(carried.status, 'ready');
  assert.equal(carried.staleSince, 30);
  assert.equal(bankCapabilityOf(carried).stale, true);
  assert.equal(bankCapabilityOf(carried).posture, 'ready');
  const longer = acceptedMoneyProvider(state({ bank: ACCOUNT, staleSince: 12 }), ACCOUNT, null, 40, false);
  assert.equal(longer.staleSince, 12);
  const confirmed = acceptedMoneyProvider(state({ bank: ACCOUNT, staleSince: 12 }), ACCOUNT, READINESS, 50);
  assert.equal(confirmed.staleSince, 0, 'a read that answered both records clears the mark');
  assert.equal(bankCapabilityOf(confirmed).stale, false);
});

/* 10 · THE ONE EXCEPTION TO «DUE» (MONEY-SPEC «A dated amount»): an invoice reads Due from the
 * moment it exists, because `invoiceStatusOf` hands its own date in as today's date; Upcoming
 * belongs to a repayment instalment, whose clock is the real one. */
check('an invoice stands on its own date, so the table lands on Due', () => {
  const invoice = { amountMinor: 16817, paidMinor: 0, dueAt: '2026-11-11' };
  assert.equal(amountStatusOf(invoice, invoice.dueAt, true), 'due');
  assert.equal(statusWordsOf(amountStatusOf(invoice, invoice.dueAt, true)), 'Due');
});

console.log(`${checks} Cedar money connection-capability checks passed`);
