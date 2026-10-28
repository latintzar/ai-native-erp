/* ONE ANSWER TO «IS THE MONEY CONNECTED», FOR EACH OF THE THREE ACCOUNTS (FEED-IA §247.2).
 *
 * «same for emailabout the connection state. always we havbe to be super consistent and not fget
 *  people igo confusing menus when they shouldnt see them»                    — Peter, 2026-09-11
 *
 * Money had the phone's old disease in triplicate. Settings → Connections answered «is the bank
 * connected» from the LOCAL flag `setup.payments === 'demo-connected'`; the Money balance answered
 * it from Prometeo; the Yape & Plin card answered it by reading the bank's flag, so connecting an
 * account made a wallet collector claim to be live; and the Electronic-invoices card read
 * `setup.invoicing` while the invoice it issues read NubeFact's own fiscal phase and said
 * «Invoicing activation pending» on the same workspace. Four surfaces, four witnesses, one lie.
 *
 * This module is the single derivation for all three, and it is PURE: a provider snapshot in, a
 * posture out. It imports nothing at runtime, so a tool test runs the real thing rather than a
 * copy of it. Live provider evidence is the only input — a seeded or drafted local flag has no
 * vote here, exactly as `phone-capability.ts` holds for the phone.
 */
import type { BankSnapshot, ProviderMode, WorkspaceReadiness } from './money-api';

/** The whole register a money entrance may find itself in. Every posture that is not `ready`
 *  presents the same picture and the same single act — one state, one picture (§246). */
export type MoneyPosture = 'checking' | 'unavailable' | 'setup' | 'ready';

/** What is still pending, in the order a person meets it. */
export type MoneyNeed = 'connection' | 'account' | 'wallet' | 'invoicing' | 'reauthorization';

/** The shape the money provider runtime publishes; declared here so the selectors stay free of
 *  React and of the transport. `checkedAt` is 0 until the first read answers. `staleSince` is the
 *  first failed read since the last good one: evidence SURVIVES a read that could not confirm it,
 *  because a failed read is a fact about the network rather than about the account. */
export type MoneyProviderState = {
  status: 'checking' | 'ready' | 'unavailable';
  /** `GET /api/cedar/bank` — the authorized receiving account, or `ready:false`. */
  bank: BankSnapshot | null;
  /** `GET /api/cedar/setup` → `readiness` — the same provider record the fiscal engine writes. */
  readiness: WorkspaceReadiness | null;
  error: string;
  checkedAt: number;
  staleSince: number;
};

/* ── WHAT A READ LEAVES STANDING (the phone's `declinePhoneSetup`, per money workspace) ───────
 * The two reducers below are the whole state machine of the money connection, and they live here
 * rather than in the runtime so a tool test runs the real thing.
 *
 * A FAILED READ IS A FACT ABOUT THE NETWORK, NOT ABOUT THE ACCOUNT: a 503 sixty seconds into a
 * session keeps the account connected and marks the evidence stale. THE PROVIDER'S OWN ANSWER
 * ABOUT THIS WORKSPACE IS A FACT ABOUT THE ACCOUNT: a 401, 403 or 404 — the copper service's own
 * `workspace_access_required` — clears the evidence, so a workspace whose token was rotated,
 * redeployed or invalidated stops printing «✓ Connected» over a balance nobody can read.
 *
 * AND A CLEARED POSTURE IS SETTLED, so it carries `staleSince: 0`. `stale` means «this evidence
 * stands and the last read failed to confirm it»; a branch that clears the evidence has nothing
 * left to be unsure about, and a definitive answer is a fact rather than a pending check. */
export const DEFINITIVE = [401, 403, 404];

/** The read failed. `status` is the service's own HTTP answer, or `null` when the failure carried
 *  none. Evidence survives everything except the provider's answer about this workspace. */
export function declinedMoneyProvider(current: MoneyProviderState, status: number | null,
  message: string, now: number): MoneyProviderState {
  const definitive = status !== null && DEFINITIVE.includes(status);
  if (definitive || (!current.bank && !current.readiness)) {
    return { status: 'unavailable', bank: null, readiness: null, error: message, checkedAt: now, staleSince: 0 };
  }
  return { ...current, error: message, checkedAt: now, staleSince: current.staleSince || now };
}

/** The service answered. `null` in both records means this browser holds no connected Cedar
 *  preview at all — a settled answer, so it carries `staleSince: 0` like every other settled
 *  posture. `confirmed` is false when one of the two reads rejected and its record is being
 *  carried forward: that evidence is exactly what `stale` was written for. */
export function acceptedMoneyProvider(current: MoneyProviderState, bank: BankSnapshot | null,
  readiness: WorkspaceReadiness | null, now: number, confirmed = true): MoneyProviderState {
  if (!bank && !readiness) {
    return { status: 'unavailable', bank: null, readiness: null, error: '', checkedAt: now, staleSince: 0 };
  }
  return { status: 'ready', bank, readiness, error: '', checkedAt: now,
    staleSince: confirmed ? 0 : (current.staleSince || now) };
}

type Common = {
  posture: MoneyPosture;
  needs: MoneyNeed[];
  error: string;
  checkedAt: number;
  /** The evidence stands and the last read failed to confirm it. Surfaces keep what they draw. */
  stale: boolean;
  staleSince: number;
};

export type BankCapability = Common & {
  bank: 'bbva' | 'interbank' | 'scotiabank' | null;
  accountLabel: string;
  accountMask: string;
  balanceMinor: number | null;
  currency: 'PEN' | 'USD' | null;
  asOf: string;
  /** Which account answered: the provider's own sandbox or live environment, or Cedar's own seed
   *  (FEED-IA §251, the hybrid demo). A seeded account is `ready` — it is an account this
   *  workspace can collect into — and the word a merchant reads is the same in every mode. */
  mode: ProviderMode;
  monitor: 'off' | 'scheduled' | 'running' | 'retrying' | 'reauthorization-required' | null;
};

export type WalletCapability = Common & { yape: boolean; plin: boolean };

export type InvoicingCapability = Common & {
  mode: ProviderMode;
  documents: number;
};

const base = (state: MoneyProviderState): Common => ({
  posture: 'unavailable',
  needs: [],
  error: state.error,
  checkedAt: state.checkedAt,
  stale: state.staleSince > 0,
  staleSince: state.staleSince,
});

/** `checking` while the first read is in flight, `unavailable` when the service answered nothing.
 *  Both wear the same picture and the same act, so a person who looks twice reads one screen. */
function unresolved(state: MoneyProviderState): MoneyPosture | null {
  if (state.status === 'checking') return 'checking';
  if (state.status === 'unavailable') return 'unavailable';
  return null;
}

/** THE BANK. Prometeo's own answer about an authorized receiving account, and nothing else. */
export function bankCapabilityOf(state: MoneyProviderState): BankCapability {
  const empty: BankCapability = { ...base(state), bank: null, accountLabel: '', accountMask: '',
    balanceMinor: null, currency: null, asOf: '', mode: null, monitor: null };
  const waiting = unresolved(state);
  if (waiting) return { ...empty, posture: waiting, needs: ['connection'] };
  if (!state.bank) return { ...empty, posture: 'unavailable', needs: ['connection'] };
  if (!state.bank.ready) return { ...empty, posture: 'setup', needs: ['account'] };
  const account = state.bank;
  const monitor = account.monitor?.status ?? null;
  return {
    ...empty,
    posture: 'ready',
    /* A monitor asking for a fresh authorization keeps the account connected — the balance it
       already read is real — and states that one pending step beside it. */
    needs: monitor === 'reauthorization-required' ? ['reauthorization'] : [],
    bank: account.bank,
    accountLabel: account.account_label,
    accountMask: account.account_mask,
    balanceMinor: account.balance_minor,
    currency: account.currency,
    asOf: account.as_of,
    mode: account.mode,
    monitor,
  };
}

/** THE WALLETS. Yape and Plin collect into the receiving account, and they are their own
 *  commissioning: an authorized bank says how money ARRIVES, never that a wallet collector is
 *  live. Until the service states a wallet of its own, this posture stands at `setup` and the
 *  card carries one act — which is the whole repair. The day the service answers, the gate is
 *  this one expression and every surface moves together. */
export function walletCapabilityOf(state: MoneyProviderState): WalletCapability {
  const empty: WalletCapability = { ...base(state), yape: false, plin: false };
  const waiting = unresolved(state);
  if (waiting) return { ...empty, posture: waiting, needs: ['connection'] };
  if (!state.bank) return { ...empty, posture: 'unavailable', needs: ['connection'] };
  const wallets = state.bank.ready ? state.bank.wallets : undefined;
  const yape = Boolean(wallets?.yape), plin = Boolean(wallets?.plin);
  if (!yape && !plin) return { ...empty, posture: 'setup', needs: ['wallet'] };
  return { ...empty, posture: 'ready', needs: [], yape, plin };
}

/** INVOICING. The same NubeFact record the fiscal engine writes on every document, read at the
 *  workspace, so the Connections card and the invoice say one thing about one provider. */
export function invoicingCapabilityOf(state: MoneyProviderState): InvoicingCapability {
  const empty: InvoicingCapability = { ...base(state), mode: null, documents: 0 };
  const waiting = unresolved(state);
  if (waiting) return { ...empty, posture: waiting, needs: ['connection'] };
  if (!state.readiness) return { ...empty, posture: 'unavailable', needs: ['connection'] };
  const nubefact = state.readiness.nubefact;
  if (!nubefact.configured || !nubefact.mode) return { ...empty, posture: 'setup', needs: ['invoicing'] };
  return { ...empty, posture: 'ready', needs: [], mode: nubefact.mode, documents: nubefact.documents };
}

/* ── THE WORD EACH CARD PRINTS ────────────────────────────────────────────────────────────────
 * One helper per account, each the analogue of `phoneStatusWord`. «Connected» belongs to a
 * provider answer; every other posture states the act that follows. */
export const bankStatusWord = (posture: MoneyPosture): string => posture === 'ready' ? 'Connected' : 'Connect bank';
export const walletStatusWord = (posture: MoneyPosture): string => posture === 'ready' ? 'Connected' : 'Set up payments';
export const invoicingStatusWord = (posture: MoneyPosture): string => posture === 'ready' ? 'Connected' : 'Set up invoicing';
