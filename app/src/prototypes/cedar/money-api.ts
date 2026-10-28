import { guestPrefix } from './guest-preview';
import target from './money-runtime.json';
import { decimalText, paymentReference, moneyStorageKey, peruDate, validFiscal, validPaymentQuote, receiptPrincipal, type PaymentQuote, type FiscalState, type Invoice, type MoneySetupState, type PaymentRequest, type Receipt, type ReceiptInput } from './money-model';
import { moneyWorkspace } from './money-seed';

type Workspace = { id: string; token: string; mode: 'sample'; origin: string };
export type CollectionReceipt = {
  id: string; amount_minor: number; currency: 'PEN' | 'EUR' | 'USD'; reference: string;
  method: 'yape' | 'plin' | 'transfer' | 'cash'; source: 'sample' | 'manual' | 'prometeo';
  status: 'matched' | 'review'; reason?: string; created_at: string; received_at?: string;
  rounding_minor?: number;
};
export type CollectionRequest = {
  id: string; buyer_url: string; amount_minor: number; currency: 'PEN';
  status: 'pending' | 'partial' | 'paid'; balance_minor: number;
  confirmed_minor: number; manual_minor: number; sample_minor: number;
  receipts: CollectionReceipt[];
  fiscal?: FiscalState;
  quote_id?: string | null; rounding_minor?: number; quote_status?: PaymentQuote['status']; rounding_received_minor?: number;
  commercial_fingerprint?: string | null;
  destination?: { mode: 'live'; method: 'yape' | 'plin'; phone: string; account_mask: string } | null;
};
export function collectionQuote(value: CollectionRequest): PaymentQuote | undefined {
  if (value.quote_status === undefined && value.quote_id === undefined && value.rounding_minor === undefined) return undefined;
  const quote = { id: value.quote_id, amountMinor: value.amount_minor, principalMinor: value.balance_minor,
    roundingMinor: value.rounding_minor, status: value.quote_status };
  if (!validPaymentQuote(quote)) throw new Error('Refresh this payment link to read its exact amount.');
  return quote;
}
/** THE SERVICE'S ANSWER TRAVELS WITH ITS STATUS (the phone's `ChannelApiError`, FEED-IA §246).
 *  A 401, 403 or 404 is the provider's own statement about THIS workspace, so the money runtime
 *  clears the evidence on it; every other failure — a 500, a 503, a timeout, a dropped socket —
 *  carries a status the runtime keeps the evidence through, because a failed read is a fact about
 *  the network rather than about the account. Transport failures carry `0`. */
export class CollectionApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const workspaceKey = (scope: string) => `rocoto-cedar-money-api-v1:${scope}`;
const sessions = new Map<string, Promise<Workspace>>();
type Binding = { generation: number; stored: string | null; controllers: Set<AbortController> };
const bindings = new Map<string, Binding>();
const changedWorkspace = () => new Error('Continue from the selected collection workspace.');
const storedBinding = (scope: string): string | null => { try { return localStorage.getItem(workspaceKey(scope)); } catch { return null; } };
function binding(scope: string): Binding {
  const stored = storedBinding(scope);
  let value = bindings.get(scope);
  if (!value) { value = { generation: 0, stored, controllers: new Set() }; bindings.set(scope, value); }
  else if (value.stored !== stored) { invalidate(scope); value.stored = stored; }
  return value;
}
function invalidate(scope: string): void {
  const value = bindings.get(scope);
  if (value) {
    value.generation++;
    for (const controller of value.controllers) controller.abort();
    value.controllers.clear(); value.stored = storedBinding(scope);
  }
  for (const key of sessions.keys()) if (key.endsWith(`:${scope}`)) sessions.delete(key);
  const event = new Event('rocoto:money-workspace-reset');
  Object.defineProperty(event, 'detail', { value: { scope } });
  window.dispatchEvent(event);
}
/** Capture before awaiting transport; check again immediately before importing private evidence. */
export function collectionGuard(scope: string): () => void {
  const expected = binding(scope).generation, origin = collectionOrigin();
  return () => { if (binding(scope).generation !== expected || collectionOrigin() !== origin) throw changedWorkspace(); };
}
export function resetCollectionWorkspace(scope: string): void {
  try { localStorage.removeItem(workspaceKey(scope)); } catch { /* Pending requests still lose their authority. */ }
  if (!bindings.has(scope)) bindings.set(scope, { generation: 0, stored: null, controllers: new Set() });
  invalidate(scope);
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === null || event.key === 'rocoto-cedar-collections-base') { for (const scope of bindings.keys()) invalidate(scope); }
  else if (event.key.startsWith('rocoto-cedar-money-api-v1:')) invalidate(event.key.slice('rocoto-cedar-money-api-v1:'.length));
});

/** The declared preview uses its owned API. A local run may select its own loopback service. */
export function collectionOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const guest = guestPrefix(); if (guest) return window.location.origin + guest;
  if (target.uiOrigins.includes(window.location.origin)) return target.apiOrigin;
  if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) return null;
  try {
    const local = localStorage.getItem('rocoto-cedar-collections-base');
    if (!local) return null;
    const url = new URL(local);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
      && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url.origin;
  } catch { /* Local fixture mode remains available. */ }
  return null;
}

async function request(scope: string, origin: string, path: string, token?: string, body?: unknown): Promise<unknown> {
  const check = collectionGuard(scope);
  const controller = new AbortController();
  const pending = binding(scope).controllers;
  pending.add(controller);
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    check();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new CollectionApiError(response.status, 'Open this request from its original workspace.');
      if (response.status === 409) throw new CollectionApiError(409, 'Review the saved request before trying this change again.');
      if (response.status === 429) throw new CollectionApiError(429, 'Give the collection service a moment, then try again.');
      throw new CollectionApiError(response.status, 'Try saving this change again.');
    }
    const value = await response.json(); check(); return value;
  } catch (error) {
    check();
    if (error instanceof Error && !['AbortError', 'TypeError'].includes(error.name)) throw error;
    throw new CollectionApiError(0, 'Reconnect to the collection service, then try again.');
  } finally { pending.delete(controller); window.clearTimeout(timer); }
}

async function workspace(scope: string, origin: string): Promise<Workspace> {
  const key = workspaceKey(scope);
  const check = collectionGuard(scope);
  // Read on every call: a scenario reset also releases its API binding.
  let held: string | null;
  try { held = localStorage.getItem(key); } catch { throw new Error('Allow browser storage, then open the collection workspace.'); }
  if (held) {
    let value: Partial<Workspace> | null;
    try { value = JSON.parse(held); } catch { throw changedWorkspace(); }
    if (value?.origin === origin && value.mode === 'sample' && typeof value.id === 'string'
      && typeof value.token === 'string' && value.token.length >= 32) return value as Workspace;
    throw changedWorkspace();
  }
  const pendingKey = `${origin}:${scope}`;
  if (!sessions.has(pendingKey)) {
    const pending = (async () => {
    /* THE WORKSPACE NAMES ITS HOUSE (FEED-IA §251). The collection service in sample mode serves
       the seeded bank of the house this workspace belongs to, and this is where it learns which. */
    const raw = await request(scope, origin, '/api/cedar/workspaces', undefined, { scope }) as Partial<Workspace>;
    check();
    if (typeof raw.id !== 'string' || typeof raw.token !== 'string' || raw.token.length < 32 || raw.mode !== 'sample') {
      throw new Error('The collection service returned an incomplete workspace. Try again.');
    }
    const saved: Workspace = { id: raw.id, token: raw.token, mode: 'sample', origin };
    try { const encoded = JSON.stringify(saved); localStorage.setItem(key, encoded); bindings.get(scope)!.stored = encoded; }
    catch { throw new Error('Allow browser storage, then reconnect your collection workspace.'); }
    return saved;
    })().finally(() => { if (sessions.get(pendingKey) === pending) sessions.delete(pendingKey); });
    sessions.set(pendingKey, pending);
  }
  return sessions.get(pendingKey)!;
}

export const hasCollectionWorkspace = (scope:string):boolean => Boolean(storedBinding(scope));
/** Rollover is an explicit successful native action, never a response to an ordinary conflict. */
export async function rolloverCollectionFixture(scope:string,fromDay:string,toDay:string):Promise<void> {
  const origin=collectionOrigin();
  if(!origin||!hasCollectionWorkspace(scope))return;
  const check=collectionGuard(scope);
  const raw=await collectionOwnerRequest<Partial<Workspace>>(scope,'/workspace/fixture-rollover',{from_day:fromDay,to_day:toDay});check();
  if(typeof raw.id!=='string'||typeof raw.token!=='string'||raw.token.length<32||raw.mode!=='sample')throw new Error('Restore the collection workspace response.');
  const saved:Workspace={id:raw.id,token:raw.token,mode:'sample',origin};
  localStorage.setItem(workspaceKey(scope),JSON.stringify(saved));
  invalidate(scope);
}

export async function collectionOwnerRequest<T>(scope: string, path: string, body?: unknown): Promise<T> {
  if (!/^\/[a-z][a-z0-9_/-]*(?:\?[^#]*)?$/i.test(path) || path.includes('..')) throw new Error('Choose a collection workspace action.');
  const origin = collectionOrigin();
  if (!origin) throw new Error('Open this request in its connected workspace.');
  const check = collectionGuard(scope), owner = await workspace(scope, origin);
  check();
  const result = await request(scope, origin, '/api/cedar' + path, owner.token, body);
  check(); return result as T;
}

export function parseRequest(raw: unknown, origin: string): CollectionRequest {
  if (!raw || typeof raw !== 'object') throw new Error('The collection service returned an incomplete request.');
  const value = raw as CollectionRequest;
  const minor = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  let url: URL;
  try { url = new URL(value.buyer_url); } catch { throw new Error('The collection service returned an invalid buyer link.'); }
  if (typeof value.id !== 'string' || !value.id || url.origin !== origin || !url.pathname.startsWith('/collect/')
    || url.username || url.password || value.currency !== 'PEN' || !['pending', 'partial', 'paid'].includes(value.status)
    || ![value.amount_minor, value.balance_minor, value.confirmed_minor, value.manual_minor, value.sample_minor].every(minor)
    || (value.rounding_received_minor !== undefined && !minor(value.rounding_received_minor))
    || (value.commercial_fingerprint != null && (typeof value.commercial_fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.commercial_fingerprint)))
    || (value.fiscal !== undefined && !validFiscal(value.fiscal))
    || !Array.isArray(value.receipts) || value.receipts.length > 2000
    || value.receipts.some(row => !row || typeof row.id !== 'string' || typeof row.reference !== 'string' || !row.reference
      || !minor(row.amount_minor) || row.amount_minor <= 0 || !['PEN', 'EUR', 'USD'].includes(row.currency)
      || (row.rounding_minor !== undefined && (!minor(row.rounding_minor) || row.rounding_minor > 99 || row.rounding_minor >= row.amount_minor))
      || !['yape', 'plin', 'transfer', 'cash'].includes(row.method) || !['sample', 'manual', 'prometeo'].includes(row.source)
      || (row.received_at !== undefined && (typeof row.received_at !== 'string' || !Number.isFinite(Date.parse(row.received_at))))
      || (row.reason !== undefined && typeof row.reason !== 'string') || !['matched', 'review'].includes(row.status) || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at)))) {
    throw new Error('Review the collection service response before continuing.');
  }
  collectionQuote(value);
  return value;
}

export const commercialDocumentOf = (invoice: Invoice) => ({
  version: 1, origin: 'cedar-order', customer_id: invoice.customerId, customer_name: invoice.customerName,
  seller_name: invoice.sellerName, document_number: invoice.saleNumber, currency: 'PEN', total_minor: invoice.amountMinor,
  lines: invoice.lines.map(line => ({id:line.id,description:line.name,quantity:decimalText(line.quantity),unit:line.unit,total_minor:line.amountMinor})),
});
export const billingDraftOf = (invoice: Invoice) => ({
  version: invoice.sourceCurrency === 'PEN' ? 2 : 1, origin: 'cedar-draft', customer_id: invoice.customerId, customer_name: invoice.customerName,
  customer_ruc: invoice.customerRuc, customer_address: invoice.customerAddress || '', seller_name: invoice.sellerName,
  seller_ruc: invoice.sellerRuc, series: invoice.invoiceSeries, issued_date: peruDate(invoice.issuedAt), due_date: invoice.dueAt,
  currency: 'PEN', source_currency: invoice.sourceCurrency, source_total_minor: Math.round(invoice.sourceTotal * 100), fx_rate: decimalText(invoice.fxRate),
  tax_rate: invoice.taxRate, net_minor: invoice.netMinor, tax_minor: invoice.taxMinor, total_minor: invoice.amountMinor,
  lines: invoice.lines.map(line => ({id:line.id,description:line.name,quantity:decimalText(line.quantity),unit:line.unit,total_minor:line.amountMinor})),
});
export async function prepareCollectionFiscal(scope: string, id: string, invoice: Invoice): Promise<CollectionRequest> {
  const origin = collectionOrigin();
  if (!origin) throw new Error('Open this request in its connected workspace.');
  return parseRequest(await collectionOwnerRequest(scope, `/requests/${encodeURIComponent(id)}/billing-draft`, {billing_draft:billingDraftOf(invoice)}),origin);
}
export async function reviseCollectionOrder(scope: string, id: string, invoice: Invoice, expected: string): Promise<CollectionRequest> {
  const origin = collectionOrigin();
  if (!origin) throw new Error('Open this request in its connected workspace.');
  return parseRequest(await collectionOwnerRequest(scope, `/requests/${encodeURIComponent(id)}/commercial-document`, {
    expected_fingerprint:expected,commercial_document:commercialDocumentOf(invoice),
  }),origin);
}

export function collectionPayload(scope: string, invoice: Invoice, link: PaymentRequest, setup: MoneySetupState, receipts: Receipt[]) {
  return {
    invoice_id: invoice.id, document_id: invoice.saleId, seller_name: invoice.sellerName, seller_ruc: invoice.sellerRuc,
    customer_name: invoice.customerName, description: invoice.origin==='cedar' ? `Delivery Note ${invoice.saleNumber}` : `Invoice ${invoice.number}`, amount_minor: Math.max(0,invoice.amountMinor-receipts.filter(row=>row.invoiceId===invoice.id&&row.status==='matched').reduce((sum,row)=>sum+receiptPrincipal(row),0)),
    ...(invoice.fixtureOwned?{fixture_owned:true,fixture_day: (()=>{try{return JSON.parse(localStorage.getItem(moneyStorageKey(scope))||'null')?.fixtureDay??peruDate(invoice.issuedAt);}catch{return peruDate(invoice.issuedAt);}})()}:{}),
    invoice_amount_minor: invoice.amountMinor, currency: 'PEN', receiving_bank: setup.bank,
    sample_clock: invoice.origin==='cedar' ? invoice.issuedAt : moneyWorkspace(scope).referenceAt,
    account_label: setup.bankAccountLabel || 'Receiving account', reference: paymentReference(invoice), idempotency_key: link.id,
    ...(invoice.collectionOnly ? {commercial_document: commercialDocumentOf(invoice)} : invoice.origin === 'cedar' ? {billing_draft: billingDraftOf(invoice)} : {}),
    initial_receipts: receipts.filter(row => row.invoiceId === invoice.id && row.status === 'matched').map(row => ({
      amount_minor: row.amountMinor, currency: row.currency, reference: row.reference, method: row.method,
      source: row.source === 'manual' ? 'manual' : 'sample', created_at: row.at,
      ...(row.roundingMinor !== undefined ? { rounding_minor: row.roundingMinor } : {}),
    })),
  };
}
export async function createCollectionBatch(scope: string, entries: {invoice:Invoice;link:PaymentRequest}[], setup:MoneySetupState, receipts:Receipt[]): Promise<CollectionRequest[]> {
  const origin=collectionOrigin();
  if (!origin) return [];
  if (entries.length < 1 || entries.length > 25) throw new Error('Choose up to 25 order links in one group.');
  if (entries.some(({invoice})=>receipts.some(row=>row.invoiceId===invoice.id&&row.source==='prometeo'))) throw new Error('Reconnect the original collection workspace to recover its verified receipts.');
  const check=collectionGuard(scope);
  await collectionOwnerRequest(scope,'/setup',{seller_name:setup.sellerName,ruc:setup.ruc,invoice_series:setup.invoiceSeries,receiving_bank:setup.bank,account_label:setup.bankAccountLabel});check();
  const raw=await collectionOwnerRequest<unknown[]>(scope,'/requests/batch',{requests:entries.map(({invoice,link})=>collectionPayload(scope,invoice,link,setup,receipts))});check();
  if (!Array.isArray(raw) || raw.length!==entries.length || raw.some((row,index)=>(row as {invoice_id?:string})?.invoice_id!==entries[index].invoice.id)) throw new Error('Refresh this group of order links.');
  return raw.map(row=>parseRequest(row,origin));
}

export async function createCollection(scope: string, invoice: Invoice, link: PaymentRequest, setup: MoneySetupState, receipts: Receipt[]): Promise<CollectionRequest | null> {
  const origin = collectionOrigin();
  if (!origin) return null;
  if (receipts.some(row => row.invoiceId === invoice.id && row.source === 'prometeo')) {
    throw new Error('Reconnect the original collection workspace to recover its verified receipts.');
  }
  const check = collectionGuard(scope);
  await collectionOwnerRequest(scope, '/setup', {
    seller_name: setup.sellerName, ruc: setup.ruc, invoice_series: setup.invoiceSeries,
    receiving_bank: setup.bank, account_label: setup.bankAccountLabel,
  });
  check();
  const raw = await collectionOwnerRequest(scope, '/requests', collectionPayload(scope,invoice,link,setup,receipts));
  check(); return parseRequest(raw, origin);
}

export async function readCollection(scope: string, id: string): Promise<CollectionRequest> {
  const origin = collectionOrigin();
  if (!origin) throw new Error('Open this request in its connected workspace.');
  return parseRequest(await collectionOwnerRequest(scope, `/requests/${encodeURIComponent(id)}`), origin);
}

export async function addCollectionReceipt(scope: string, id: string, input: ReceiptInput): Promise<CollectionRequest> {
  const origin = collectionOrigin();
  if (!origin) throw new Error('Open this request in its connected workspace.');
  return parseRequest(await collectionOwnerRequest(scope, `/requests/${encodeURIComponent(id)}/receipts`, {
    amount_minor: input.amountMinor, currency: input.currency, reference: input.reference, method: input.method,
    source: input.source === 'manual' ? 'manual' : 'sample',
  }), origin);
}

export async function submitCollectionInvoice(scope: string, id: string, query = false): Promise<CollectionRequest> {
  const origin = collectionOrigin();
  if (!origin) throw new Error('Open this request in its connected workspace.');
  return parseRequest(await collectionOwnerRequest(scope, `/requests/${encodeURIComponent(id)}/invoice${query ? '/query' : ''}`, {}), origin);
}

/** THE HYBRID DEMO'S OWN ANSWER (FEED-IA §251). `mode: 'sample'` with `source: 'sample'` is the
 *  collection service serving this workspace's bank from Cedar's own seed, in exactly the shape a
 *  commissioned Prometeo account answers — so every Money door reads one snapshot, and the day the
 *  key is commissioned the same doors read the real account. Provenance lives here, in the data. */
export type BankSnapshot = { ready: false; mode: 'sample' } | {
  ready: true; bank: 'bbva' | 'interbank' | 'scotiabank'; account_label: string; account_mask: string;
  balance_minor: number; currency: 'PEN' | 'USD'; as_of: string; mode: 'sandbox' | 'live' | 'sample'; source: 'prometeo' | 'sample';
  monitor?: { status: 'off' | 'scheduled' | 'running' | 'retrying' | 'reauthorization-required'; last_success?: string; next_due?: number | null };
  /** THE WALLETS ARE THEIR OWN COMMISSIONING (FEED-IA §247.2). An authorized account says how
   *  money arrives; it never says that a Yape or Plin collector is live. The service states each
   *  collector here when it holds one, and `walletCapabilityOf` is the only reader. */
  wallets?: { yape: boolean; plin: boolean };
};
/** Which account answered: the provider's own sandbox or live environment, or Cedar's seed. */
export type ProviderMode = 'sandbox' | 'live' | 'sample' | null;
/** The workspace's own provider record, as `GET /api/cedar/setup` reports it — the same readiness
 *  the fiscal engine writes on every document, so the Connections card and the invoice agree. */
export type WorkspaceReadiness = {
  prometeo: { configured: boolean; bank_authorized: boolean; last_read: string | null; mode: ProviderMode };
  nubefact: { configured: boolean; mode: ProviderMode; documents: number };
};
const providerRow = (raw: unknown): Record<string, unknown> => (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
export async function readWorkspaceReadiness(scope: string): Promise<WorkspaceReadiness | null> {
  const origin = collectionOrigin();
  if (!origin) return null;
  const raw = await collectionOwnerRequest<{ readiness?: unknown }>(scope, '/setup');
  const readiness = providerRow(raw?.readiness);
  const prometeo = providerRow(readiness.prometeo), nubefact = providerRow(readiness.nubefact);
  const mode = (value: unknown): ProviderMode => value === 'sandbox' || value === 'live' || value === 'sample' ? value : null;
  if (typeof prometeo.configured !== 'boolean' || typeof nubefact.configured !== 'boolean') {
    throw new Error('Refresh the connection to read its provider status.');
  }
  return {
    prometeo: { configured: prometeo.configured, bank_authorized: prometeo.bank_authorized === true,
      last_read: typeof prometeo.last_read === 'string' ? prometeo.last_read : null, mode: mode(prometeo.mode) },
    nubefact: { configured: nubefact.configured, mode: mode(nubefact.mode),
      documents: Number.isSafeInteger(nubefact.documents) ? Number(nubefact.documents) : 0 },
  };
}
/** A retained book keeps its sample calendar after authored payments. Both bank views use the
 * same saved anchor; commissioned provider reads retain their actual account timestamps. */
export function bankReadPath(scope: string, path: '/bank' | '/bank/movements'): string {
  try {
    const saved = JSON.parse(localStorage.getItem(moneyStorageKey(scope)) || 'null');
    const day = saved?.fixtureDay;
    if (saved?.version === 1 && saved.scope === scope && (saved.fixtureRevision === undefined || [1, 2].includes(saved.fixtureRevision))
      && typeof day === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(day)
      && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day) {
      return `${path}?fixture_day=${day}&fixture_revision=${saved.fixtureRevision ?? 1}`;
    }
  } catch { /* A fresh workspace uses the service's current calendar. */ }
  return path;
}
export async function readBankSnapshot(scope: string): Promise<BankSnapshot | null> {
  const origin = collectionOrigin();
  if (!origin) return null;
  const raw = await collectionOwnerRequest<BankSnapshot>(scope, bankReadPath(scope, '/bank'));
  if (raw?.ready === false) return { ready: false, mode: 'sample' };
  if (raw?.ready !== true || !['bbva', 'interbank', 'scotiabank'].includes(raw.bank)
    || !Number.isSafeInteger(raw.balance_minor) || !['PEN', 'USD'].includes(raw.currency)
    || typeof raw.account_label !== 'string' || typeof raw.account_mask !== 'string'
    || !['sandbox', 'live', 'sample'].includes(raw.mode) || !['prometeo', 'sample'].includes(raw.source)
    || (raw.mode === 'sample') !== (raw.source === 'sample') || !Number.isFinite(Date.parse(raw.as_of))) {
    throw new Error('Refresh the bank connection to retrieve its balance.');
  }
  if (raw.monitor && (!['off', 'scheduled', 'running', 'retrying', 'reauthorization-required'].includes(raw.monitor.status)
    || (raw.monitor.last_success !== undefined && !Number.isFinite(Date.parse(raw.monitor.last_success)))
    || (raw.monitor.next_due != null && !Number.isFinite(raw.monitor.next_due)))) {
    throw new Error('Refresh the bank connection to check its update status.');
  }
  if (raw.wallets && [raw.wallets.yape, raw.wallets.plin].some(value => typeof value !== 'boolean')) {
    throw new Error('Refresh the bank connection to check its payment collectors.');
  }
  return raw;
}
