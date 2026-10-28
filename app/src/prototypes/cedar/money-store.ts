import { hasAuthoredChase, readChase, seedChaseBook, writeChase } from './chase';
import * as React from 'react';
import type { Sale } from './sale';
import {
  createOrderPaymentDocument, prepareOrderFiscal, reviseOrderPaymentDocument, emptyMoney, parseMoney, moneyStorageKey, issueInvoice as issue, createBillingDraft as draft, createRequest as request,
  recordRequestAction as requestAction, recordReceipt as receipt, invoiceBalance, invoiceClock, invoiceForSale,
  requestForInvoice, type MoneyState, type MoneySetupState, type InvoiceOptions, type ReceiptInput, type Result, type PaymentRequest, type PaymentDispatch, type PaymentHold,
} from './money-model';
import { moneyNow, seedMoney, isUntouchedMoneyFixture } from './money-seed';
import { hasCollectionWorkspace, rolloverCollectionFixture, createCollectionBatch, prepareCollectionFiscal, reviseCollectionOrder, addCollectionReceipt, collectionOrigin, collectionGuard, collectionQuote, createCollection, readCollection, submitCollectionInvoice, type CollectionRequest } from './money-api';
import { cedarTodayId } from './scenario-clock';
import { peruFinancialActionsEnabled } from './workspace-capabilities';

const cache = new Map<string, MoneyState>();
const listeners = new Set<() => void>();
const connections = new Map<string, Promise<Result<PaymentRequest>>>();
const fiscalActions = new Map<string, Promise<Result<unknown>>>();
const refreshes = new Map<string, Promise<Result<unknown>>>();
const calendarPreparations=new Map<string,{cancelled:boolean;promise?:Promise<Result<undefined>>}>();
export { moneyStorageKey } from './money-model';
function read(scope: string): MoneyState {
  if (!cache.has(scope)) {
    let state = emptyMoney(scope);
    try { state = parseMoney(JSON.parse(localStorage.getItem(moneyStorageKey(scope)) || 'null'), scope); } catch { /* A fresh fixture remains usable. */ }
    cache.set(scope, state);
  }
  return cache.get(scope)!;
}
function commit<T>(scope: string, result: Result<T>, calendarReset = false): Result<T> {
  if (!result.ok || read(scope) === result.state) return result;
  if(calendarPreparations.has(scope)&&!calendarReset)return {ok:false,error:"Preparing today's order book. Try again in a moment."};
  try { localStorage.setItem(moneyStorageKey(scope), JSON.stringify(result.state)); }
  catch { return { ok: false, error: 'Allow browser storage, then try saving again.' }; }
  cache.set(scope, result.state);
  listeners.forEach(listener => listener());
  return result;
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === null || event.key.startsWith('rocoto-cedar-money-v1:')) {
    cache.clear(); listeners.forEach(listener => listener());
  }
});
if (typeof window !== 'undefined') window.addEventListener('rocoto:money-workspace-reset', event => {
  const scope = (event as CustomEvent<{scope:string}>).detail?.scope;
  if (!scope) return;
  for (const pending of [connections, fiscalActions, refreshes]) for (const key of pending.keys()) if (key.startsWith(`${scope}:`)) pending.delete(key);
  const current = read(scope);
  const invoices = current.invoices.map(({fiscal: _fiscal, ...invoice}) => invoice);
  const requests = current.requests.map(({remoteId: _remoteId, remotePending: _remotePending, ...link}) => ({...link,url:`${previewOrigin()}#/money/request/${link.id}`}));
  const receipts = current.receipts.filter(row => row.source !== 'prometeo');
  commit(scope, {ok:true,value:undefined,state:{...current,invoices,requests,receipts,events:current.events.filter(row=>row.kind!=='fiscal')}},true);
});
/* THE SHARED RESET CONTRACT (PRODUCT-SPEC «Reset»). `rocoto:cedar-workspace-reset` fires AFTER
   the inventoried keys are cleared and, for the disconnecting act, after every provider call has
   returned — so this cache drops what it holds and the next read re-seeds from the fixture. */
if (typeof window !== 'undefined') window.addEventListener('rocoto:cedar-workspace-reset', event => {
  const scope = (event as CustomEvent<{ scope?: string }>).detail?.scope;
  for (const pending of [connections, fiscalActions, refreshes]) {
    for (const key of [...pending.keys()]) if (!scope || key.startsWith(`${scope}:`)) pending.delete(key);
  }
  for(const [key,pending] of calendarPreparations)if(!scope||key===scope){pending.cancelled=true;calendarPreparations.delete(key);}
  if (scope) cache.delete(scope); else cache.clear();
  listeners.forEach(listener => listener());
});
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const previewOrigin = () => `${window.location.origin}${window.location.pathname}${window.location.search}`;

const failed = (error: unknown): Result<never> => ({ ok: false, error: error instanceof Error ? error.message : 'Reconnect to the collection service, then try again.' });
const peruAction = (): Result<never> => failed(new Error('Choose Peru to use collection and fiscal actions.'));
const documentTime = (state: MoneyState, invoiceId: string): string => {
  const invoice=state.invoices.find(row=>row.id===invoiceId);
  return invoice ? invoiceClock(invoice,moneyNow(state)) : moneyNow(state);
};

/** Preserve the service's receipt provenance; operator-verified bank evidence retains its source. */
export function importCollection(scope: string, invoiceId: string, remote: CollectionRequest, base = read(scope), persist = true): Result<CollectionRequest> {
  let next = base;
  if (!next.invoices.some(item => item.id === invoiceId)) return failed(new Error('Open the billing document from its current workspace.'));
  for (const row of remote.receipts) {
    const imported = receipt(next, { invoiceId, amountMinor: row.amount_minor, currency: row.currency,
      reference: row.reference, method: row.method, source: row.source === 'sample' ? 'demo-bank' : row.source,
      ...(row.rounding_minor !== undefined ? { roundingMinor: row.rounding_minor } : {}),
      ...(row.received_at !== undefined ? { receivedAt: row.received_at } : {}) }, row.created_at);
    if (!imported.ok) return imported;
    next = imported.state;
    if (row.status === 'review' && imported.value.status !== 'review') next = { ...next,
      receipts: next.receipts.map(item => item.id === imported.value.id ? { ...item, status: 'review', reason: row.reason || 'Review this collection receipt.' } : item) };
  }
  const quote = collectionQuote(remote), currentRequest = requestForInvoice(next, invoiceId);
  if (quote && currentRequest) next = { ...next, requests: next.requests.map(item => item.id === currentRequest.id
    ? { ...item, paymentQuote: quote, ...(remote.balance_minor > 0 ? { amountMinor: remote.balance_minor } : {}) } : item) };
  if (remote.fiscal) {
    const invoice = next.invoices.find(item => item.id === invoiceId)!;
    if (JSON.stringify(invoice.fiscal) !== JSON.stringify(remote.fiscal)) next = { ...next,
      invoices: next.invoices.map(item => item.id === invoiceId ? {...item,fiscal:remote.fiscal} : item) };
  }
  next = {...next, requests:next.requests.map(link=>link.invoiceId===invoiceId ? {...link,
    amountMinor:remote.balance_minor > 0 ? remote.balance_minor : link.amountMinor,
    ...(remote.commercial_fingerprint ? {commercialFingerprint:remote.commercial_fingerprint} : {}),
  } : link)};
  const imported: Result<CollectionRequest> = {ok:true,value:remote,state:next};
  return persist ? commit(scope,imported) : imported;
}

export const commitMoneyImport = (scope: string, state: MoneyState): Result<undefined> =>
  commit(scope, { ok: true, value: undefined, state });

async function connectRequestInner(scope: string, invoiceId: string): Promise<Result<PaymentRequest>> {
  const check = collectionGuard(scope);
  const current = read(scope);
  const created = request(current, invoiceId, documentTime(current,invoiceId), previewOrigin());
  if (!created.ok || !collectionOrigin()) return commit(scope, created);
  const invoice = current.invoices.find(item => item.id === invoiceId)!;
  const pending: PaymentRequest = { ...created.value, remotePending: true };
  const reserved = commit(scope, { ok: true, value: pending, state: { ...created.state,
    requests: created.state.requests.map(item => item.id === pending.id ? pending : item) } });
  if (!reserved.ok) return reserved;
  try {
    const existing = current.requests.find(item => item.invoiceId === invoiceId && item.remoteId);
    const remote = existing?.remoteId ? await readCollection(scope, existing.remoteId)
      : await createCollection(scope, invoice, pending, current.setup, current.receipts);
    check();
    if (!remote) return failed(new Error('Open this request in its connected workspace.'));
    const imported = importCollection(scope, invoiceId, remote);
    if (!imported.ok) return imported;
    const saved = { ...pending, amountMinor: remote.balance_minor > 0 ? remote.balance_minor : pending.amountMinor,
      ...(collectionQuote(remote) ? { paymentQuote: collectionQuote(remote) } : {}),
      url: remote.buyer_url, remoteId: remote.id, remotePending: false,
      ...(remote.commercial_fingerprint ? {commercialFingerprint:remote.commercial_fingerprint} : {}) };
    const latest = read(scope);
    return commit(scope, { ok: true, value: saved, state: { ...latest,
      requests: latest.requests.map(item => item.id === saved.id ? saved : item) } });
  } catch (error) { return failed(error); }
}
function connectRequest(scope: string, invoiceId: string): Promise<Result<PaymentRequest>> {
  const key = `${scope}:${invoiceId}`;
  if (!connections.has(key)) {
    const pending = connectRequestInner(scope,invoiceId).finally(()=>{if(connections.get(key)===pending)connections.delete(key);});
    connections.set(key,pending);
  }
  return connections.get(key)!;
}

async function saveReceipt(scope: string, input: ReceiptInput): Promise<Result<unknown>> {
  const check = collectionGuard(scope);
  if (input.source === 'prometeo') return failed(new Error('Refresh the bank connection to retrieve verified receipts.'));
  const current = read(scope);
  // Validate before issuing a request so incomplete manual inputs have no network effects.
  const validated = receipt(current, { ...input, receivedAt: new Date().toISOString() }, documentTime(current,input.invoiceId));
  let link = requestForInvoice(current, input.invoiceId);
  // The provider selector at the surface decides which controls exist; the store records evidence.
  if (!validated.ok || !collectionOrigin()) return commit(scope, validated);
  try {
    if (!link?.remoteId || link.remotePending) {
      const connected = await connectRequest(scope, input.invoiceId);
      check();
      if (!connected.ok) return connected;
      link = connected.value;
    }
    if (!link.remoteId) return failed(new Error('Connect the payment request, then record its receipt.'));
    const result = await addCollectionReceipt(scope, link.remoteId, input); check();
    return importCollection(scope, input.invoiceId, result);
  } catch (error) { return failed(error); }
}

const orderMutations = new Map<string,Promise<Result<unknown>>>();
function mutateOrder(scope:string,invoiceId:string,run:()=>Promise<Result<unknown>>):Promise<Result<unknown>> {
  const key=`${scope}:${invoiceId}`,check=collectionGuard(scope);
  const pending=(orderMutations.get(key)??Promise.resolve()).then(()=>{check();return run();}).catch(failed)
    .finally(()=>{if(orderMutations.get(key)===pending)orderMutations.delete(key);});
  orderMutations.set(key,pending);return pending;
}

export const moneyStateNow = (scope: string): MoneyState => read(scope);
export function moneyActions(scope: string) { return {
    updateSetup(patch: Partial<MoneySetupState>) {
      const current = read(scope);
      const setup = { ...current.setup, ...patch };
      return commit(scope, { ok: true, value: setup, state: { ...current, setup } });
    },
    issueInvoice(sale: Sale, options: InvoiceOptions) { return peruFinancialActionsEnabled(scope) ? commit(scope, issue(read(scope), sale, options, moneyNow(read(scope)))) : peruAction(); },
    createBillingDraft(sale: Sale, options: InvoiceOptions) { return peruFinancialActionsEnabled(scope) ? commit(scope, draft(read(scope), sale, options, new Date().toISOString())) : peruAction(); },
    async hydrateOrderPayments(invoiceIds: string[]): Promise<Result<unknown>> {
      if (!peruFinancialActionsEnabled(scope)) return peruAction();
      const current=read(scope),check=collectionGuard(scope);
      const entries=invoiceIds.slice(0,25).flatMap(id=>{
        const invoice=current.invoices.find(row=>row.id===id),link=requestForInvoice(current,id);
        return invoice&&link&&!link.remoteId ? [{invoice,link}] : [];
      });
      if (!entries.length || !collectionOrigin()) return {ok:true,value:undefined,state:current};
      try {
        const remote=await createCollectionBatch(scope,entries,current.setup,current.receipts);check();
        let next=read(scope);
        for (const [index,row] of remote.entries()) {
          const invoiceId=entries[index].invoice.id;
          const imported=importCollection(scope,invoiceId,row,next,false);
          if (!imported.ok) return imported;
          next=imported.state;
          next={...next,requests:next.requests.map(link=>link.invoiceId===invoiceId?{...link,url:row.buyer_url,remoteId:row.id,remotePending:false}:link)};
        }
        return commit(scope,{ok:true,value:undefined,state:next});
      } catch(error) {return failed(error);}
    },
    ensureOrderDocument(sale: Sale) {
      return peruFinancialActionsEnabled(scope)?commit(scope,createOrderPaymentDocument(read(scope),sale,new Date().toISOString(),previewOrigin())):peruAction();
    },
    async ensureOrderPayment(sale: Sale): Promise<Result<PaymentRequest>> {
      if (!peruFinancialActionsEnabled(scope)) return peruAction();
      const made = commit(scope,createOrderPaymentDocument(read(scope),sale,new Date().toISOString(),previewOrigin()));
      if (!made.ok) return made;
      const link = requestForInvoice(read(scope),made.value.id);
      if (link?.remoteId && !link.remotePending) return {ok:true,value:link,state:read(scope)};
      return connectRequest(scope,made.value.id);
    },
    prepareOrderFiscal(invoiceId: string, options: InvoiceOptions): Promise<Result<unknown>> {
      return mutateOrder(scope,invoiceId,async()=>{
      if (!peruFinancialActionsEnabled(scope)) return peruAction();
      const check=collectionGuard(scope),prepared=prepareOrderFiscal(read(scope),invoiceId,options,new Date().toISOString());
      if (!prepared.ok) return prepared;
      try {
        const connected=await connectRequest(scope,invoiceId);check();
        if (!connected.ok) return connected;
        if (connected.value.remoteId && collectionOrigin()) {
          const remote=await prepareCollectionFiscal(scope,connected.value.remoteId,prepared.value);check();
          const latest=read(scope);
          const committed=commit(scope,{...prepared,state:{...latest,invoices:latest.invoices.map(row=>row.id===invoiceId?prepared.value:row),
            events:[...latest.events,...prepared.state.events.filter(row=>!latest.events.some(held=>held.id===row.id))]}});
          return committed.ok?importCollection(scope,invoiceId,remote):committed;
        }
        return commit(scope,prepared);
      } catch(error) {return failed(error);}
      });
    },
    reviseOrderPayment(sale: Sale): Promise<Result<unknown>> {
      return mutateOrder(scope,invoiceForSale(read(scope),sale.id)?.id??sale.id,async()=>{
      if (!peruFinancialActionsEnabled(scope)) return peruAction();
      const check=collectionGuard(scope), revised=reviseOrderPaymentDocument(read(scope),sale,new Date().toISOString());
      if (!revised.ok || revised.state===read(scope)) return revised;
      try {
        const link=requestForInvoice(read(scope),revised.value.id);
        if (link?.remoteId && collectionOrigin()) {
          if (!link.commercialFingerprint) return failed(new Error('Refresh the order payment before reviewing this change.'));
          const remote=await reviseCollectionOrder(scope,link.remoteId,revised.value,link.commercialFingerprint);check();
          const latest=read(scope);
          const committed=commit(scope,{...revised,state:{...latest,invoices:latest.invoices.map(row=>row.id===revised.value.id?revised.value:row),
            events:[...latest.events,...revised.state.events.filter(row=>!latest.events.some(held=>held.id===row.id))]}});
          return committed.ok?importCollection(scope,revised.value.id,remote):committed;
        }
        return commit(scope,revised);
      } catch(error) {return failed(error);}
      });
    },
    holdPayment(invoiceId: string, reason?: PaymentHold) {
      const current=read(scope);
      return commit(scope,{ok:true,value:undefined,state:{...current,invoices:current.invoices.map(row=>row.id===invoiceId?{...row,collectionHold:reason,collectionRelease:undefined}:row)}});
    },
    createRequest(invoiceId: string) { return peruFinancialActionsEnabled(scope) ? connectRequest(scope, invoiceId) : Promise.resolve(peruAction()); },
    recordRequestAction(requestId: string, action: 'copied' | 'sent', dispatch?: PaymentDispatch, release?: {reason:PaymentHold;revision:string}) {
      const current=read(scope),link=current.requests.find(row=>row.id===requestId);
      const result=requestAction(current,requestId,action,new Date().toISOString(),dispatch);
      if(result.ok&&release&&link)return commit(scope,{...result,state:{...result.state,invoices:result.state.invoices.map(row=>row.id===link.invoiceId?{...row,collectionRelease:release}:row)}});
      return commit(scope,result);
    },
    recordReceipt(input: ReceiptInput) { return peruFinancialActionsEnabled(scope) ? saveReceipt(scope, input) : Promise.resolve(peruAction()); },
    async simulateReceipt(invoiceId: string, amountMinor?: number) {
      if (!peruFinancialActionsEnabled(scope)) return peruAction();
      const current = read(scope);
      /* The control exists only where `bankCapabilityOf` says the account can honour it (§246), so
         this action no longer answers a press with a refusal a person could have been spared. */
      return saveReceipt(scope, { invoiceId, amountMinor: amountMinor ?? invoiceBalance(current, invoiceId), currency: 'PEN', method: 'yape',
        source: 'demo-bank', reference: `PREVIEW-${crypto.randomUUID()}` });
    },
    refreshRequest(invoiceId: string): Promise<Result<unknown>> {
      if (!peruFinancialActionsEnabled(scope)) return Promise.resolve(peruAction());
      const key = `${scope}:${invoiceId}`;
      if (refreshes.has(key)) return refreshes.get(key)!;
      const check = collectionGuard(scope);
      const link = requestForInvoice(read(scope), invoiceId);
      if (!link?.remoteId || !collectionOrigin()) return Promise.resolve({ ok: true, value: undefined, state: read(scope) });
      const pending = (async()=>{
        try { const remote = await readCollection(scope, link.remoteId!); check(); return importCollection(scope, invoiceId, remote); }
        catch (error) { return failed(error); }
      })().finally(()=>{if(refreshes.get(key)===pending)refreshes.delete(key);});
      refreshes.set(key,pending);return pending;
    },
    submitInvoice(invoiceId: string, query = false): Promise<Result<unknown>> {
      if (!peruFinancialActionsEnabled(scope)) return Promise.resolve(peruAction());
      const key = `${scope}:${invoiceId}`;
      if (fiscalActions.has(key)) return fiscalActions.get(key)!;
      const check = collectionGuard(scope);
      const current = read(scope), invoice = current.invoices.find(row=>row.id===invoiceId);
      const link = requestForInvoice(current, invoiceId);
      if (invoice?.origin !== 'cedar' || !link?.remoteId) return Promise.resolve(failed(new Error('Create a payment request for this billing draft first.')));
      const pending = (async()=>{
        try { const remote = await submitCollectionInvoice(scope,link.remoteId!,query); check(); return importCollection(scope,invoiceId,remote); }
        catch(error) { return failed(error); }
      })().finally(()=>{if(fiscalActions.get(key)===pending)fiscalActions.delete(key);});
      fiscalActions.set(key,pending);return pending;
    },
    prepareExamples(sales: Sale[]):Promise<Result<undefined>> {
      const pending=calendarPreparations.get(scope);if(pending?.promise)return pending.promise;
      const current=read(scope), today=cedarTodayId();
      if(current.examplesLoaded&&current.fixtureDay&&current.fixtureDay<today&&isUntouchedMoneyFixture(current)&&!hasAuthoredChase(readChase(scope))&&hasCollectionWorkspace(scope)) {
        const entry:{cancelled:boolean;promise?:Promise<Result<undefined>>}={cancelled:false};
        calendarPreparations.set(scope,entry);
        entry.promise=(async()=>{
          try {
            await rolloverCollectionFixture(scope,current.fixtureDay!,today);
            if(entry.cancelled)return failed(new Error('Open the current order book.'));
            if(calendarPreparations.get(scope)===entry)calendarPreparations.delete(scope);
            return moneyActions(scope).ensureExamples(sales,true);
          } catch(error) {return failed(error);}
          finally {if(calendarPreparations.get(scope)===entry)calendarPreparations.delete(scope);}
        })();
        return entry.promise;
      }
      return Promise.resolve(moneyActions(scope).ensureExamples(sales,true));
    },
    ensureExamples(sales: Sale[], calendarReady=false) {
      if (!peruFinancialActionsEnabled(scope)) return { ok: true as const, state: read(scope), value: undefined };
      const current = read(scope), chase = readChase(scope);
      if(!calendarReady&&current.examplesLoaded&&current.fixtureDay&&current.fixtureDay<cedarTodayId()&&hasCollectionWorkspace(scope)) return {ok:true as const,state:current,value:undefined};
      const retain = current.examplesLoaded && hasAuthoredChase(chase);
      const result = retain ? { ok: true as const, state: current, value: undefined }
        : commit(scope, seedMoney(current, sales, previewOrigin()));
      if (result.ok) {
        try {
          if (Object.keys(chase.records).length === 0 || (result.state !== current && !hasAuthoredChase(chase))) {
            writeChase(seedChaseBook(result.state, new Date().toISOString(), sales));
          }
        } catch { /* The ledger remains available when browser storage is full. */ }
      }
      return result;
    },
  }; }

export function useMoney(scope: string) {
  const snapshot = React.useCallback(() => read(scope), [scope]);
  const state = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  const actions = React.useMemo(() => moneyActions(scope), [scope]);
  return { state, ...actions };
}
