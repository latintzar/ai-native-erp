import * as React from 'react';
import { CollectionApiError, bankReadPath, collectionOrigin, collectionOwnerRequest, readBankSnapshot, readWorkspaceReadiness, type BankSnapshot, type WorkspaceReadiness } from './money-api';
import { DEFINITIVE, acceptedMoneyProvider, bankCapabilityOf, declinedMoneyProvider, invoicingCapabilityOf, walletCapabilityOf,
  type BankCapability, type InvoicingCapability, type MoneyProviderState, type WalletCapability } from './money-bank-capability';

/** A movement the account returned. In the hybrid demo (§251) the seeded receipts arrive here as
 *  `source: 'sample'`, matched to the requests the seed allocated them to. */
export type BankMovement = {
  id: string; source: 'prometeo' | 'sample'; mode: 'live' | 'sandbox' | 'sample'; date: string; detail: string; reference: string;
  currency: 'PEN' | 'USD'; account_mask: string; debit_minor: number; credit_minor: number;
  allocated_minor: number; unallocated_minor: number; status: 'matched' | 'review'; reason: string;
  request_id: string | null; invoice_id: string | null; document_id: string | null;
  payer_name?: string | null; match_key?: 'reference' | 'amount' | null;
};
export type BankActivity = { ready: boolean; mode: 'live' | 'sandbox' | 'sample' | null; as_of: string | null; movements: BankMovement[] };
const minor = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const bounded = (value: unknown, length: number): value is string => typeof value === 'string' && value.length <= length;
const day = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Owner projection: every amount is conserved; account identifiers remain masked. */
export function parseBankActivity(raw: unknown): BankActivity {
  const value = raw as BankActivity | null;
  if (!value || typeof value.ready !== 'boolean' || ![null, 'live', 'sandbox', 'sample'].includes(value.mode)
    || (value.ready && value.mode === null) || (value.as_of !== null && (!bounded(value.as_of, 40) || !Number.isFinite(Date.parse(value.as_of))))
    || !Array.isArray(value.movements) || value.movements.length > 10000) throw new Error('Refresh your bank transactions.');
  const ids = new Set<string>();
  for (const row of value.movements) {
    if (!row || !bounded(row.id, 64) || !/^[a-f0-9]{64}$/.test(row.id) || ids.has(row.id)
      || !['prometeo', 'sample'].includes(row.source) || !['live', 'sandbox', 'sample'].includes(row.mode)
      || (row.mode === 'sample') !== (row.source === 'sample') || !day(row.date)
      || !bounded(row.detail, 500) || !bounded(row.reference, 120) || !['PEN', 'USD'].includes(row.currency)
      || (row.payer_name != null && !bounded(row.payer_name, 160))
      || (row.match_key != null && !['reference', 'amount'].includes(row.match_key))
      || !bounded(row.account_mask, 12) || !/^•••• [a-zA-Z0-9]{1,4}$/.test(row.account_mask)
      || ![row.debit_minor, row.credit_minor, row.allocated_minor, row.unallocated_minor].every(minor)
      || row.allocated_minor + row.unallocated_minor !== row.credit_minor || !['matched', 'review'].includes(row.status)
      || !bounded(row.reason, 120) || [row.request_id, row.invoice_id, row.document_id].some(id => id !== null && (!bounded(id, 120) || !id))
      || (row.status === 'matched' && (!row.request_id || !row.invoice_id || !row.document_id || row.allocated_minor <= 0 || row.debit_minor > 0))
      || (row.status === 'review' && (row.allocated_minor !== 0 || row.request_id !== null || row.invoice_id !== null || row.document_id !== null))) {
      throw new Error('Refresh your bank transactions.');
    }
    ids.add(row.id);
  }
  return value;
}

export async function readBankActivity(scope: string): Promise<BankActivity | null> {
  if (!collectionOrigin()) return null;
  return parseBankActivity(await collectionOwnerRequest<unknown>(scope, bankReadPath(scope, '/bank/movements')));
}

export async function matchBankMovement(scope: string, movementId: string, requestId: string): Promise<void> {
  await collectionOwnerRequest<unknown>(scope, '/bank/match', { movement_id: movementId, request_id: requestId });
}

/** Read-time window and currency come from the account, never from the sample forecast. */
export function bankHistory(activity: BankActivity, currency: string, through: string) {
  const today = new Date(Date.parse(through) - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const points = Array.from({ length: 14 }, (_, index) => ({
    at: new Date(Date.parse(`${today}T12:00:00Z`) - (13 - index) * 86400000).toISOString().slice(0, 10), amountMinor: 0,
  }));
  for (const row of activity.movements) {
    const point = points.find(item => item.at === row.date);
    if (point && row.currency === currency && row.mode === activity.mode) point.amountMinor += row.credit_minor;
  }
  return points;
}

/* ── THE MONEY CONNECTION IS POLLED, NOT REMEMBERED ONCE (FEED-IA §246, §247.2) ───────────────
 * «the connection related stuff should be state led … You hard-coded the state, which should
 *  always just sort of poll … for the state of the connection.»                — Peter, 2026-09-10
 *
 * The phone's runtime, per Money workspace. One read of the two provider records — the authorized
 * receiving account (`/bank`) and the workspace's provider readiness (`/setup`) — refreshed on
 * every boundary a person can feel: returning to the tab, focusing the window, and a minute
 * passing with a subscriber mounted, with a floor of ten seconds so a flurry of focus events is
 * one read. `revision` is the generation guard: a response from a previous workspace can never
 * overwrite the current one.
 *
 * A FAILED READ IS A FACT ABOUT THE NETWORK, NOT ABOUT THE ACCOUNT. Evidence survives a read that
 * could not confirm it — the snapshot keeps its posture and records `staleSince` — so one 503 can
 * never revoke a connected bank mid-session. Only the service's own answer about this workspace
 * (401, 403, 404) clears it, and `money-bank-capability`'s two reducers hold that whole rule.
 *
 * Every surface reads the SELECTORS below and no surface reads a local flag; `money-model`'s
 * `setup.payments` and `setup.invoicing` say what the PERSON did in the walk, and nothing else. */
const REFRESH_FLOOR_MS = 10000, REFRESH_PERIOD_MS = 60000;
const EMPTY: MoneyProviderState = { status: 'checking', bank: null, readiness: null, error: '', checkedAt: 0, staleSince: 0 };
const snapshots = new Map<string, MoneyProviderState>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<void>>();
const revisions = new Map<string, number>();
let watchers = 0, period = 0;

export const moneyProviderNow = (scope: string): MoneyProviderState => snapshots.get(scope) ?? EMPTY;
function publish(scope: string, next: MoneyProviderState): void {
  snapshots.set(scope, next);
  listeners.get(scope)?.forEach(listener => listener());
}
/** The read failed. `money-bank-capability` holds the rule; this carries the provider's own status
 *  to it, so a 401, 403 or 404 about this workspace clears the line and a 503 keeps it. */
function decline(scope: string, error: unknown): void {
  const message = error instanceof Error && error.message.trim() ? error.message.trim() : 'Reconnect the money service, then try again.';
  const status = error instanceof CollectionApiError ? error.status : null;
  publish(scope, declinedMoneyProvider(moneyProviderNow(scope), status, message, Date.now()));
}
export function refreshMoneyProvider(scope: string): Promise<void> {
  const pending = inflight.get(scope);
  if (pending) return pending;
  const owner = revisions.get(scope) ?? 0;
  /* TWO RECORDS, READ TOGETHER, JUDGED SEPARATELY. One provider's silence never revokes the
     other: a NubeFact read that fails leaves a connected bank exactly where it stands, and a
     carried record is marked stale. A read where BOTH rejected goes to `decline`, which clears
     the line on the provider's own answer about this workspace and keeps it on anything else. */
  const task = (async () => {
    const current = moneyProviderNow(scope);
    const [bank, readiness] = await Promise.allSettled([readBankSnapshot(scope), readWorkspaceReadiness(scope)]);
    if ((revisions.get(scope) ?? 0) !== owner) return;
    if (bank.status === 'rejected' && readiness.status === 'rejected') {
      /* Either read can carry the provider's own answer about this workspace, and that answer
         speaks for both: a rotated token answers 401 on whichever route is asked first. */
      const answers = [bank.reason, readiness.reason];
      decline(scope, answers.find(reason => reason instanceof CollectionApiError && DEFINITIVE.includes(reason.status)) ?? bank.reason);
      return;
    }
    acceptMoneyProvider(scope,
      bank.status === 'fulfilled' ? bank.value : current.bank,
      readiness.status === 'fulfilled' ? readiness.value : current.readiness,
      bank.status === 'fulfilled' && readiness.status === 'fulfilled');
  })().finally(() => { if (inflight.get(scope) === task) inflight.delete(scope); });
  inflight.set(scope, task);
  return task;
}
/** The service answered. `null` in both records means this browser holds no connected Cedar preview
 *  at all; `confirmed` is false when one record is carried forward from a read that rejected. */
export function acceptMoneyProvider(scope: string, bank: BankSnapshot | null, readiness: WorkspaceReadiness | null, confirmed = true): void {
  publish(scope, acceptedMoneyProvider(moneyProviderNow(scope), bank, readiness, Date.now(), confirmed));
}
/** The workspace changed under us: drop the evidence and read again from the first posture. */
export function resetMoneyProvider(scope?: string): void {
  const scopes = scope ? [scope] : [...snapshots.keys()];
  for (const key of scopes) {
    revisions.set(key, (revisions.get(key) ?? 0) + 1);
    inflight.delete(key);
    publish(key, EMPTY);
    if (listeners.get(key)?.size) void refreshMoneyProvider(key);
  }
}
function wake(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  for (const scope of listeners.keys()) {
    if (Date.now() - moneyProviderNow(scope).checkedAt < REFRESH_FLOOR_MS) continue;
    void refreshMoneyProvider(scope);
  }
}
function watch(): void {
  if (period || typeof window === 'undefined') return;
  window.addEventListener('focus', wake);
  document.addEventListener('visibilitychange', wake);
  period = window.setInterval(() => { if (!document.hidden) for (const scope of listeners.keys()) void refreshMoneyProvider(scope); }, REFRESH_PERIOD_MS);
}
function unwatch(): void {
  if (!period || typeof window === 'undefined') return;
  window.removeEventListener('focus', wake);
  document.removeEventListener('visibilitychange', wake);
  window.clearInterval(period); period = 0;
}
export function useMoneyProvider(scope: string): MoneyProviderState & { refresh: () => Promise<void> } {
  const subscribe = React.useCallback((listener: () => void) => {
    const set = listeners.get(scope) ?? new Set<() => void>();
    listeners.set(scope, set);
    set.add(listener); watchers += 1; watch();
    return () => { set.delete(listener); if (!set.size) listeners.delete(scope); watchers -= 1; if (!watchers) unwatch(); };
  }, [scope]);
  const read = React.useCallback(() => moneyProviderNow(scope), [scope]);
  const state = React.useSyncExternalStore(subscribe, read, read);
  React.useEffect(() => { if (!moneyProviderNow(scope).checkedAt && !inflight.has(scope)) void refreshMoneyProvider(scope); }, [scope, state.checkedAt]);
  return { ...state, refresh: React.useCallback(() => refreshMoneyProvider(scope), [scope]) };
}
/** The three selectors every Money entrance reads. One posture each, one witness under all three. */
export function useBankCapability(scope: string): BankCapability & { refresh: () => Promise<void> } {
  const state = useMoneyProvider(scope);
  const capability = React.useMemo(() => bankCapabilityOf(state), [state.status, state.bank, state.readiness, state.error, state.checkedAt, state.staleSince]);
  return { ...capability, refresh: state.refresh };
}
export function useWalletCapability(scope: string): WalletCapability {
  const state = useMoneyProvider(scope);
  return React.useMemo(() => walletCapabilityOf(state), [state.status, state.bank, state.readiness, state.error, state.checkedAt, state.staleSince]);
}
export function useInvoicingCapability(scope: string): InvoicingCapability {
  const state = useMoneyProvider(scope);
  return React.useMemo(() => invoicingCapabilityOf(state), [state.status, state.bank, state.readiness, state.error, state.checkedAt, state.staleSince]);
}
if (typeof window !== 'undefined') {
  /* The shared reset contract (PRODUCT-SPEC «Reset»): the keys are already cleared and every
     provider disconnect has returned, so the provider snapshot returns to its first posture. */
  window.addEventListener('rocoto:cedar-workspace-reset', event => {
    resetMoneyProvider((event as CustomEvent<{ scope?: string }>).detail?.scope);
  });
  /* money-api's own binding invalidation, and another tab replacing this workspace. */
  window.addEventListener('rocoto:money-workspace-reset', event => {
    resetMoneyProvider((event as CustomEvent<{ scope?: string }>).detail?.scope);
  });
  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith('rocoto-cedar-money-api-v1:') || event.key === 'rocoto-cedar-collections-base') resetMoneyProvider();
  });
}
