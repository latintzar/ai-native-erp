/** Cedar's Peru workflow fixtures. Amounts and evidence retain their currency and origin. */
import { LEGACY_EUR_TO_PEN, workspaceCurrency } from './currency';
export const moneyStorageKey = (scope: string) => `rocoto-cedar-money-v1:${scope}`;
export type InvoiceSale = {
  id: string; number: string; customer: { id: string; name: string }; figure: number;
  messageOnly?: boolean; archived?: unknown;
  lines: { id: string; product: { name: string }; given: number; unit: string; price: number }[];
};

/* ── WHAT THE PERSON DID, NEVER WHAT THE PROVIDER SAYS (FEED-IA §247.2) ───────────────────────
 * `payments` and `invoicing` record the seller's own progress through the setup walk and nothing
 * more: `pending` before it, `deferred` when they left it for later, `authorizing` once they
 * named the account and authorized the connection. The provider's own answer — `bankCapabilityOf`
 * and `invoicingCapabilityOf` over the polled snapshot — is the only thing that ever prints
 * «Connected». The legacy value `demo-connected` stays readable and means the same thing, so a
 * workspace stored before this repair keeps its place in the walk. */
export type MoneySetupStep = 'pending' | 'deferred' | 'authorizing' | 'demo-connected';
export type PaymentTiming = 'delivery' | 'evening' | 'next-morning';
export type PaymentHold = 'disputed' | 'changed-after-loading' | 'partial-return' | 'monthly-billing' | 'manual';
export type PaymentDispatch = { by: 'auto' | 'manual'; reason: PaymentTiming | 'early' | 'held'; channel: 'whatsapp' | 'email'; text: string };
export type MoneySetupState = {
  paymentTiming?: PaymentTiming; monthlyCustomerIds?: string[];
  sellerName: string; ruc: string; invoiceSeries: string;
  bank: 'bbva' | 'interbank' | 'scotiabank'; bankAccountLabel: string;
  payments: MoneySetupStep;
  invoicing: MoneySetupStep; consentAt?: string;
};
/** The seller finished the bank walk and authorized the connection. It says what THEY did. A
 *  workspace stored before this repair carries the legacy `demo-connected`, which meant exactly
 *  the same thing — a local step, finished — so both read as authorized here and neither reaches
 *  any surface that prints «Connected». */
const setupDone = (value: MoneySetupStep): boolean => value === 'authorizing' || value === 'demo-connected';
export const paymentSetupAuthorized = (setup: MoneySetupState): boolean => setupDone(setup.payments);
/** The seller authorized invoicing for this business. NubeFact activation follows separately. */
export const invoicingSetupAuthorized = (setup: MoneySetupState): boolean => setupDone(setup.invoicing);
export type Invoice = {
  id: string; number: string; saleId: string; saleNumber: string; customerName: string; customerId: string;
  customerRuc: string; sellerName: string; sellerRuc: string; sourceTotal: number;
  sourceCurrency: 'EUR' | 'PEN'; fxRate: number; currency: 'PEN'; amountMinor: number;
  taxRate: number; taxMinor: number; netMinor: number; issuedAt: string; dueAt: string;
  status: 'draft' | 'accepted' | 'rejected'; origin: 'demo' | 'cedar';
  disputed?: boolean;
  /** The order's commercial collection record; fiscal details are prepared separately. */
  collectionOnly?: boolean;
  fixtureOwned?: boolean;
  collectionHold?: PaymentHold;
  collectionRelease?: {reason:PaymentHold;revision:string};
  invoiceSeries?: string; customerAddress?: string; fiscal?: FiscalState;
  lines: { id: string; name: string; quantity: number; unit: string; amountMinor: number }[];
};
export type FiscalState = {
  phase: 'unprepared' | 'awaiting-authorization' | 'authorized' | 'submitting' | 'query-required' | 'pending' | 'accepted' | 'rejected' | 'voided';
  mode: 'sandbox' | 'live' | null; payment_requirement: 'confirmed'; can_issue: boolean; can_query: boolean;
  record_id?: string; series?: string; number?: number; draft_fingerprint?: string;
  authorized_at?: string; checked_at?: string; error?: string;
  accepted_by_sunat?: boolean; voided?: boolean;
  issue_date?: string | null; issue_date_policy?: 'server-on-first-submission';
};
export function validFiscal(value: unknown): value is FiscalState {
  if (!value || typeof value !== 'object') return false;
  const row = value as FiscalState;
  return ['unprepared', 'awaiting-authorization', 'authorized', 'submitting', 'query-required', 'pending', 'accepted', 'rejected', 'voided'].includes(row.phase)
    && [null, 'sandbox', 'live'].includes(row.mode) && row.payment_requirement === 'confirmed'
    && typeof row.can_issue === 'boolean' && typeof row.can_query === 'boolean'
    && [row.accepted_by_sunat,row.voided].every(value=>value===undefined||typeof value==='boolean')
    && ['record_id', 'draft_fingerprint', 'error'].every(key => row[key as keyof FiscalState] === undefined || typeof row[key as keyof FiscalState] === 'string')
    && (row.series === undefined || /^F[A-Z0-9]{3}$/.test(row.series))
    && (row.number === undefined || (Number.isSafeInteger(row.number) && row.number > 0 && row.number <= 99999999))
    && (!['accepted','voided'].includes(row.phase) || (Boolean(row.record_id) && Boolean(row.series) && row.number !== undefined && row.mode !== null))
    && (row.issue_date == null || (typeof row.issue_date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(row.issue_date) && Number.isFinite(Date.parse(row.issue_date))))
    && (row.issue_date_policy===undefined || row.issue_date_policy==='server-on-first-submission')
    && [row.authorized_at, row.checked_at].every(at => at === undefined || (typeof at === 'string' && Number.isFinite(Date.parse(at))));
}
/** Collection authority belongs to the commercial document; fiscal acceptance is separate. */
export const isCollectible = (invoice: Invoice): boolean => invoice.status === 'accepted' || (invoice.origin === 'cedar' && invoice.status === 'draft');
export const invoiceClock = (invoice: Invoice, sampleAt: string, now = new Date().toISOString()): string => invoice.origin === 'cedar' ? now : sampleAt;
/** Commercial dates follow the seller's Peru calendar, independently of fiscal issuance. */
export function peruDate(at: string): string {
  if (!Number.isFinite(Date.parse(at))) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at));
  const field = (name: string) => parts.find(part => part.type === name)?.value;
  return `${field('year')}-${field('month')}-${field('day')}`;
}
export const documentNumber = (invoice: Invoice): string => invoice.fiscal && ['accepted','voided'].includes(invoice.fiscal.phase) && invoice.fiscal.series && invoice.fiscal.number
  ? `${invoice.fiscal.series}-${String(invoice.fiscal.number).padStart(8, '0')}` : invoice.number;

/* THE PAYMENT REFERENCE IS THE ORDER'S OWN NUMBER (FEED-IA §252).
 *
 * «WHy is the immudable reference CEDAR0named??? it's a payment for an order. lol.»
 *                                                              — Peter, 14 September 2026
 *
 * A buyer types this string into a wallet and a bank statement carries it back, so it is the
 * number printed on the document that buyer holds: the invoice's own number where an invoice was
 * issued (`F001-00000123`), and the Delivery Note's number while a billing draft still waits for
 * one (`1409-114`). `invoice.number` carries `PAY-…` on a draft — an internal placeholder — which
 * is why the draft reads its sale's number instead. Both halves are frozen with the document, so
 * the reference a request is created with is the reference it keeps (PAYMENTS-SPEC «The
 * reference»). A second payment on the same document takes the number plus a two-digit suffix. */
export function paymentReference(invoice: Invoice): string {
  const document = documentNumber(invoice);
  return invoice.origin === 'cedar' && document === invoice.number ? invoice.saleNumber : document;
}

export type PaymentRequest = {
  id: string; invoiceId: string; amountMinor: number; currency: 'PEN'; url: string;
  status: 'created' | 'copied' | 'sent'; createdAt: string; copiedAt?: string; sentAt?: string; sentAtSource?: 'sample' | 'actual';
  remoteId?: string; remotePending?: boolean; commercialFingerprint?: string;
  dispatch?: PaymentDispatch;
  dispatches?: (PaymentDispatch & {id:string;at:string})[];
  paymentQuote?: PaymentQuote;
};
export type PaymentQuote = { id: string | null; amountMinor: number; principalMinor: number;
  roundingMinor: number; status: 'ready' | 'paid' | 'reference-required' };
export function validPaymentQuote(value: unknown): value is PaymentQuote {
  if (!value || typeof value !== 'object') return false;
  const row = value as PaymentQuote;
  return [row.amountMinor, row.principalMinor, row.roundingMinor].every(n => Number.isSafeInteger(n) && n >= 0)
    && row.roundingMinor <= 99 && row.amountMinor === row.principalMinor + row.roundingMinor
    && (row.status === 'paid' ? row.id === null && row.principalMinor === 0 && row.roundingMinor === 0
      : ['ready', 'reference-required'].includes(row.status) && typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 64 && row.principalMinor > 0);
}
export type Receipt = {
  id: string; invoiceId: string; amountMinor: number; currency: string;
  method: 'yape' | 'plin' | 'transfer' | 'cash'; source: 'manual' | 'demo-bank' | 'prometeo';
  reference: string; at: string; status: 'matched' | 'review'; reason?: string;
  /** Extra cents identify the payment; the invoice retains its original principal. */
  roundingMinor?: number;
  /** Actual arrival recorded by the service or local save action. */
  receivedAt?: string;
};
export const receiptPrincipal = (receipt: Pick<Receipt, 'amountMinor' | 'roundingMinor'>): number => receipt.amountMinor - (receipt.roundingMinor ?? 0);
/** Bank booking is actual evidence; sample/manual receipt arrival follows its recorded action. */
export const receiptEffectiveAt = (receipt: Pick<Receipt, 'at'> & Partial<Pick<Receipt, 'source' | 'receivedAt'>>): string =>
  receipt.source === 'prometeo' ? receipt.at : receipt.receivedAt ?? receipt.at;
export type MoneyEvent = { id: string; invoiceId: string; kind: string; label: string; at: string };
export type MoneyState = {
  version: 1; scope: string; setup: MoneySetupState; examplesLoaded: boolean;
  /** Peru day on which an untouched synthetic fixture was generated. */
  fixtureDay?: string;
  fixtureRevision?: number;
  fixtureSignature?: string;
  invoices: Invoice[]; requests: PaymentRequest[]; receipts: Receipt[]; events: MoneyEvent[];
};
export type Result<T = undefined> = { ok: true; value: T; state: MoneyState } | { ok: false; error: string };
export type InvoiceOptions = { customerRuc: string; customerAddress?: string; sourceCurrency?: 'EUR' | 'PEN'; fxRate?: number; taxRate: number; dueAt: string };
export type ReceiptInput = Omit<Receipt, 'id' | 'at' | 'status' | 'reason'>;

export function emptyMoney(scope: string): MoneyState {
  return { version: 1, scope, examplesLoaded: false,
    setup: { sellerName: '', ruc: '', invoiceSeries: 'F001', bank: 'bbva', bankAccountLabel: '', payments: 'pending', invoicing: 'pending' },
    invoices: [], requests: [], receipts: [], events: [] };
}
export const invoiceForSale = (state: MoneyState, saleId: string) => state.invoices.find(invoice => invoice.saleId === saleId);
export const requestForInvoice = (state: MoneyState, invoiceId: string) => state.requests.filter(request => request.invoiceId === invoiceId).slice(-1)[0];
export const invoiceBalance = (state: MoneyState, invoiceId: string): number => {
  const invoice = state.invoices.find(item => item.id === invoiceId);
  return invoice ? Math.max(0, invoice.amountMinor - state.receipts.filter(receipt => receipt.invoiceId === invoiceId && receipt.status === 'matched')
    .reduce((sum, receipt) => sum + receiptPrincipal(receipt), 0)) : 0;
};
/** Due dates include their entire Peru calendar day; payment timing is separate from evidence. */
export function invoiceOverdueDays(state: MoneyState, invoiceId: string, at: string): number {
  const invoice = state.invoices.find(item => item.id === invoiceId);
  if (!invoice || !isCollectible(invoice) || invoiceBalance(state, invoiceId) <= 0 || !Number.isFinite(Date.parse(at))) return 0;
  const today = peruDate(at);
  return Math.max(0, Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(invoice.dueAt + 'T12:00:00Z')) / 86400000)) || 0;
}
/* ── THE MONEY VOCABULARY · ONE TABLE, READ BY EVERY MONEY SURFACE (FEED-IA §247.6) ──────────
 *
 * «that working capital interest thing shows a weird "scheduled" thing and stuff ‚ ik what the
 *  fuck it is nbut ensure all the states etc are super consistent»               — Peter, 11 Sept
 *
 * What he read was a word that named a commitment nobody had made. The repayment timeline wrote
 * «Scheduled» on every unpaid row, and the SAME timeline is drawn inside the offer dialog, where
 * the person has chosen neither a plan nor a date — so an offer was presented as a schedule. The
 * word is also Sales' own delivery state (`sale.state === 'scheduled'`, money-projections), so one
 * word named two different things in one product. It is gone: a state is named here only when the
 * model actually holds it, and a date only when the person chose the plan that produced it.
 *
 * Beside it the same lifecycle carried two words for one state («Paid in full» on the card,
 * «Repayments complete» in the panel below it) and the customer-credit card borrowed the advance's
 * word for money travelling the other way («Upcoming repayments»). One table ends all three.
 *
 * A PLAN has three states; a DATED AMOUNT — one repayment instalment, one invoice — has six, and
 * both sides of the ledger use the same six, because a person reads one product. The state table
 * and the surface that prints each word are in MONEY-SPEC.md «Money states».
 *
 * It was the one table before the word «Future» left Cedar (§247.8) and it is the one table now:
 * working capital and customer credit are features, and these words are their states. */
export type MoneyStatus =
  | 'offered' | 'upcoming' | 'due' | 'requested' | 'overdue' | 'part-paid' | 'paid'
  | 'repaying' | 'repaid';

export const MONEY_STATUS_WORDS: Record<MoneyStatus, string> = {
  offered: 'Offered', upcoming: 'Upcoming', due: 'Due', requested: 'Payment link sent',
  overdue: 'Overdue', 'part-paid': 'Part paid', paid: 'Paid',
  repaying: 'Repaying', repaid: 'Repaid',
};

/** The one place a Money surface turns a state into the word a person reads. */
export const statusWordsOf = (status: MoneyStatus): string => MONEY_STATUS_WORDS[status];

/* THE COLLECTION READING OF THE SAME TABLE (FEED-IA §249: «state Unpaid / Part paid / Paid»). An
   order that is due and an order that is late are both UNPAID to the merchant chasing it — the
   lateness is a fact printed beside the word («5 days overdue»), the word is the state a chase acts
   on. Every other state keeps its one word above. This alias lives here, next to the table, so the
   one-vocabulary law (MONEY-SPEC «Money states») still holds: a state becomes a word in one file. */
export const COLLECTION_WORDS: Readonly<Partial<Record<MoneyStatus, string>>> = Object.freeze({ due: 'Unpaid', overdue: 'Unpaid' });
export const collectionWordOf = (status: MoneyStatus): string => COLLECTION_WORDS[status] ?? statusWordsOf(status);

/** Most urgent first. A customer account with several invoices takes the first word that fits. */
const STATUS_URGENCY: MoneyStatus[] = ['overdue', 'due', 'part-paid', 'requested', 'upcoming', 'offered', 'paid'];
export function mostUrgentStatus(statuses: MoneyStatus[]): MoneyStatus {
  for (const status of STATUS_URGENCY) if (statuses.includes(status)) return status;
  return 'due';
}

/** One dated amount: how much it is, how much of it arrived, and the day it is owed. `next` says
 *  this is the earliest amount still owed on its plan or account, so everything behind it is
 *  Upcoming rather than Due. Its whole calendar day counts as on time, exactly as
 *  `invoiceOverdueDays` already treats an invoice. */
export type DatedAmount = { amountMinor: number; paidMinor: number; dueAt: string; requested?: boolean };
/** «Due» belongs to an amount ON or after its date; an amount still ahead of its date reads
 *  «Upcoming», whether or not it is the next one owed, and a late one reads «Overdue» (lead
 *  vocabulary decision, 11 September). So the working-capital card leads with the word the date
 *  earns — «Upcoming · S/ 168.17 on 11 Nov» — rather than calling a payment ahead of its date Due. */
export function amountStatusOf(amount: DatedAmount, today: string, next = true): MoneyStatus {
  if (amount.paidMinor >= amount.amountMinor) return 'paid';
  if (today && amount.dueAt && today > amount.dueAt) return 'overdue';
  if (amount.paidMinor > 0) return 'part-paid';
  if (amount.requested) return 'requested';
  if (today && amount.dueAt && today < amount.dueAt) return 'upcoming';
  return next ? 'due' : 'upcoming';
}

/** A working-capital plan, structurally typed so the model keeps no dependency on money-finance. */
export type RepaymentPlanShape = { count: number; paidCount: number; installments: { dueAt: string; amountMinor: number }[] };

/** Offered until the person confirms a plan, Repaying while payments remain, Repaid after that. */
export const planStatusOf = (plan: RepaymentPlanShape | null | undefined): MoneyStatus =>
  !plan ? 'offered' : plan.paidCount >= plan.count ? 'repaid' : 'repaying';

/** One row of a repayment timeline. With no accepted plan the row belongs to an OFFER, so it says
 *  so — the fix for the word Peter read. */
export function installmentStatusOf(plan: RepaymentPlanShape | null | undefined, index: number, today: string): MoneyStatus {
  const row = plan?.installments[index];
  if (!plan || !row) return 'offered';
  return amountStatusOf({ amountMinor: row.amountMinor, paidMinor: index < plan.paidCount ? row.amountMinor : 0, dueAt: row.dueAt },
    today, index === plan.paidCount);
}

/** An invoice through the same derivation, so a customer-credit row and an invoice row agree.
 *
 *  AND THE ONE EXCEPTION TO «DUE» (MONEY-SPEC «A dated amount», lead decision 11 September): an
 *  invoice reads Due from the moment it exists, while Upcoming belongs to a repayment instalment.
 *  A merchant issues an invoice to be paid now — its date is the deadline it becomes late on
 *  rather than the day collection opens — so the invoice filters offer outstanding, overdue,
 *  part paid, paid and the payment link, and hold no `upcoming` at all. Passing `invoice.dueAt`
 *  as today's date is what says that: the amount stands ON its own date, so the six-state table
 *  lands on `due`, and an instalment passes the real clock and can still read `upcoming`. */
export function invoiceStatusOf(state: MoneyState, invoiceId: string, at: string): MoneyStatus {
  const invoice = state.invoices.find(item => item.id === invoiceId);
  if (!invoice) return 'due';
  const balance = invoiceBalance(state, invoiceId);
  if (balance <= 0) return 'paid';
  // Lateness stays `invoiceOverdueDays`' own judgement — its Peru calendar day, its collectible
  // guard — so one invoice cannot read Overdue here and on time on the invoice row beside it.
  if (invoiceOverdueDays(state, invoiceId, at) > 0) return 'overdue';
  return amountStatusOf({
    amountMinor: invoice.amountMinor,
    paidMinor: invoice.amountMinor - balance,
    dueAt: invoice.dueAt,
    requested: Boolean(requestForInvoice(state, invoiceId)?.sentAt),
  }, invoice.dueAt, true);
}

/** The shared outstanding ledger behind the dashboard and the collection page. */
export type UnpaidOrder = { invoice: Invoice; amountMinor: number; status: MoneyStatus; overdueDays: number };

export function unpaidOrders(state: MoneyState, sampleAt: string, now = new Date().toISOString()): UnpaidOrder[] {
  const rows: UnpaidOrder[] = [];
  for (const invoice of state.invoices) {
    if (!isCollectible(invoice) || invoice.currency !== 'PEN' || !invoice.customerId) continue;
    const amountMinor = invoiceBalance(state, invoice.id);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) continue;
    const at = invoiceClock(invoice, sampleAt, now);
    rows.push({ invoice, amountMinor, status: invoiceStatusOf(state, invoice.id, at),
      overdueDays: invoiceOverdueDays(state, invoice.id, at) });
  }
  return rows;
}

/** Earlier deadlines lead; customer and document identity keep equal dates stable. */
export function urgentUnpaidOrders(state: MoneyState, sampleAt: string, now = new Date().toISOString(), limit = 3): UnpaidOrder[] {
  return unpaidOrders(state, sampleAt, now).sort((a, b) => a.invoice.dueAt.localeCompare(b.invoice.dueAt)
    || a.invoice.customerName.localeCompare(b.invoice.customerName) || a.invoice.id.localeCompare(b.invoice.id))
    .slice(0, Math.max(0, limit));
}

export type PaidReceipt = { invoice: Invoice; receipt: Receipt };

/** Thirty Peru calendar days. Actual arrivals and bank bookings use the wall clock; pure sample
 * and legacy receipts keep the invoice clock. Each partial payment is a receipt while its
 * remaining balance stays in unpaid orders. The original ledger instant remains intact. */
export function last30DaysReceipts(state: MoneyState, sampleAt: string, now = new Date().toISOString()): PaidReceipt[] {
  const invoices = new Map(state.invoices.map(invoice => [invoice.id, invoice]));
  const rows: PaidReceipt[] = [];
  for (const receipt of state.receipts) {
    const invoice = invoices.get(receipt.invoiceId);
    if (!invoice || !isCollectible(invoice) || !invoice.customerId || invoice.currency !== 'PEN'
      || receipt.status !== 'matched' || receipt.currency !== invoice.currency
      || !Number.isSafeInteger(receipt.amountMinor) || receipt.amountMinor <= 0
      || !Number.isFinite(Date.parse(receiptEffectiveAt(receipt)))) continue;
    const today = peruDate(receipt.receivedAt !== undefined || receipt.source === 'prometeo'
      ? now : invoiceClock(invoice, sampleAt, now));
    if (!today) continue;
    const from = new Date(Date.parse(`${today}T12:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
    const day = peruDate(receiptEffectiveAt(receipt));
    if (day >= from && day <= today) rows.push({ invoice, receipt });
  }
  return rows.sort((a, b) => Date.parse(receiptEffectiveAt(b.receipt)) - Date.parse(receiptEffectiveAt(a.receipt))
    || a.receipt.id.localeCompare(b.receipt.id));
}

const formatters = new Map<string, Intl.NumberFormat>();
/** A currency is written in its own market's grammar wherever it appears (FEED-IA §246 review):
 * soles as «S/ 1,234.50» (en-PE), euros as «1.234,50 €» (es-ES), so Money and Sales agree. */
const MONEY_GRAMMAR: Record<string, string> = { PEN: 'en-PE', EUR: 'es-ES' };
export function formatMoney(minor: number, currency = 'PEN'): string {
  if (!formatters.has(currency)) formatters.set(currency, new Intl.NumberFormat(MONEY_GRAMMAR[currency] ?? 'en-PE', { style: 'currency', currency, currencyDisplay: 'symbol' }));
  return formatters.get(currency)!.formatToParts(minor / 100).map(part => part.type === 'currency' && currency === 'PEN' ? 'S/' : part.value).join('');
}

/** Synthetic Money projections follow the selected demo country. Evidence uses formatMoney with
 * its recorded currency, so provider and fiscal amounts are never relabelled. */
export function formatSyntheticMoney(minor: number): string {
  const currency = workspaceCurrency();
  return currency === 'EUR' ? formatMoney(Math.round(minor / LEGACY_EUR_TO_PEN), 'EUR') : formatMoney(minor, 'PEN');
}

export const formatInvoiceMoney = (invoice: Invoice, minor: number = invoice.amountMinor): string =>
  invoice.origin === 'demo' ? formatSyntheticMoney(minor) : formatMoney(minor, invoice.currency);
export const invoiceDisplayCurrency = (invoice: Invoice): string =>
  invoice.origin === 'demo' ? workspaceCurrency() : invoice.currency;

export const formatLedgerMoney = (state: MoneyState, minor: number): string =>
  state.invoices.every(invoice => invoice.origin === 'demo') ? formatSyntheticMoney(minor) : formatMoney(minor, 'PEN');
const fail = (error: string): Result<never> => ({ ok: false, error });
/** Plain decimal strings preserve supported small quantities at the native JSON boundary. */
export function decimalText(value: number): string {
  const text = String(value);
  if (!text.includes('e')) return text;
  const [coefficient, power] = text.split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const digits = whole + fraction, point = whole.length + Number(power);
  return point <= 0 ? `0.${'0'.repeat(-point)}${digits}`
    : point >= digits.length ? digits + '0'.repeat(point - digits.length)
      : `${digits.slice(0, point)}.${digits.slice(point)}`;
}
/** Decimal half-up conversion matches the server's frozen source-minor contract. */
function convertSourceMinor(sourceMinor: number, rate: number): number {
  const [coefficient, power='0']=String(rate).toLowerCase().split('e');
  const [whole,fraction='']=coefficient.split('.');
  const exponent=Number(power)-fraction.length;
  const product=BigInt(sourceMinor)*BigInt(whole+fraction);
  if(exponent>=0)return Number(product*10n**BigInt(exponent));
  const divisor=10n**BigInt(-exponent);
  return Number((product+divisor/2n)/divisor);
}
export function billingAmountMinor(sourceTotal: number, rate: number): number {
  const sourceMinor = Math.round(sourceTotal * 100);
  if (!Number.isSafeInteger(sourceMinor) || sourceMinor <= 0 || !Number.isFinite(rate) || rate <= 0 || rate > 100) return NaN;
  return convertSourceMinor(sourceMinor, rate);
}
const boundedText = (value: string, max: number): boolean => value.trim().length > 0 && Array.from(value.trim()).length <= max;
const calendarDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
/** Validate the native billing snapshot before it becomes immutable; retained demo invoices keep their original contract. */
function draftInputError(state: MoneyState, sale: InvoiceSale, options: InvoiceOptions, at: string): string | null {
  if (!boundedText(state.setup.sellerName, 160)) return 'Enter the seller name, up to 160 characters.';
  if (!boundedText(sale.customer.name, 100) || !boundedText(sale.customer.id, 120)) return 'Review the customer name and identifier before preparing payment.';
  if (!boundedText(sale.id, 120) || !boundedText(sale.number, 186)) return 'Review the Delivery Note number and identifier before preparing payment.';
  if (Array.from(options.customerAddress?.trim() || '').length > 100) return 'Enter the customer fiscal address, up to 100 characters.';
  const issuedDate = peruDate(at);
  if (!calendarDate(issuedDate) || !calendarDate(options.dueAt) || options.dueAt < issuedDate) return `Choose a due date on or after ${issuedDate || 'the preparation date'}.`;
  if (sale.lines.length < 1 || sale.lines.length > 100) return 'Use between 1 and 100 delivered lines in this billing draft.';
  if (sale.lines.some(line => !Number.isFinite(line.given) || line.given <= 0 || !/^\d{1,9}(?:\.\d{1,10})?$/.test(decimalText(line.given)))) return 'Use positive delivered quantities with up to 9 integer and 10 decimal digits.';
  if (sale.lines.some(line => !boundedText(line.id, 120) || !boundedText(line.product.name, 250) || !boundedText(line.unit, 30))) return 'Review line identifiers, product names and units before preparing payment.';
  if (new Set(sale.lines.map(line => line.id.trim())).size !== sale.lines.length) return 'Give each delivered line its own identifier.';
  return null;
}
function event(state: MoneyState, invoiceId: string, kind: string, label: string, at: string): MoneyEvent[] {
  return [...state.events, { id: `event-${state.events.length + 1}`, invoiceId, kind, label, at }];
}

function freezeDocument(state: MoneyState, sale: InvoiceSale, options: InvoiceOptions, at: string, draft: boolean, collectionOnly = false): Result<Invoice> {
  const existing = invoiceForSale(state, sale.id);
  if (existing) return { ok: true, value: existing, state };
  if (draft) {
    // An unfulfilled line contributes neither quantity nor money to the delivered bill.
    sale = { ...sale, lines: sale.lines.filter(line => !(line.given === 0 && Number.isFinite(line.price) && line.price >= 0)) };
    const error = draftInputError(state, sale, options, at);
    if (error) return fail(error);
  }
  /* A CONNECTION GATE BELONGS TO THE PROVIDER SELECTOR AT THE SURFACE (FEED-IA §247.2), so the
     model asks only for the identity a document needs. `bankCapabilityOf` decides which controls
     a person ever meets; a local flag decides nothing. */
  if (!state.setup.sellerName.trim()) return fail('Save the seller name before preparing a payment request.');
  if (!collectionOnly && (!/^\d{11}$/.test(state.setup.ruc) || !/^\d{11}$/.test(options.customerRuc))) return fail('Enter the seller and customer RUC as 11 digits.');
  if (!collectionOnly && !/^F[A-Z0-9]{3}$/.test(state.setup.invoiceSeries)) return fail('Use a four-character invoice series beginning with F.');
  if (!draft && options.sourceCurrency !== undefined && !['EUR', 'PEN'].includes(options.sourceCurrency)) return fail('Choose the recorded source currency.');
  const sourceCurrency = draft ? 'PEN' : options.sourceCurrency ?? 'PEN';
  const fxRate = sourceCurrency === 'PEN' ? 1 : options.fxRate;
  if (sourceCurrency === 'EUR' && (!Number.isFinite(fxRate) || Number(fxRate) <= 0 || Number(fxRate) > 100
    || !/^\d{1,3}(?:\.\d{1,10})?$/.test(decimalText(Number(fxRate))))) return fail('Enter the recorded EUR to PEN exchange rate.');
  if (![0, 18].includes(options.taxRate)) return fail('Choose the sample tax rate: 0% or 18%.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dueAt) || !Number.isFinite(Date.parse(options.dueAt))) return fail('Choose a valid due date.');
  if (!sale.customer.id || sale.messageOnly || sale.archived || !Number.isFinite(sale.figure) || sale.figure <= 0 || sale.lines.length === 0) return fail('Choose a priced Delivery Note with a customer.');
  const sourceMinor=Math.round(sale.figure*100);
  if(draft&&(!Number.isSafeInteger(sourceMinor)||sourceMinor<=0||sourceMinor>1_000_000_000_000))return fail('Review the Delivery Note amount in its source currency.');
  const amountMinor = billingAmountMinor(sale.figure, Number(fxRate));
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return fail('Review the invoice amount.');
  if (draft && amountMinor > 1_000_000_000_000) return fail('Use a billing total of up to 10 billion soles.');
  const netMinor = Math.round(amountMinor / (1 + options.taxRate / 100));
  const sequence = state.invoices.length + 1;
  const number = collectionOnly ? sale.number : `${draft ? 'PAY' : state.setup.invoiceSeries}-${String(sequence).padStart(8, '0')}`;
  const weights = sale.lines.map(line => line.given * line.price);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (weights.some(weight => !Number.isFinite(weight) || weight < 0) || !Number.isFinite(weightTotal) || weightTotal <= 0
    || sale.lines.some(line => !Number.isFinite(line.given) || line.given < 0)) return fail('Review the Delivery Note quantities and prices.');
  // Largest-remainder allocation keeps every line nonnegative while preserving the converted total.
  if (Math.round(weightTotal * 100) !== Math.round(sale.figure * 100)) return fail('Refresh the Delivery Note to use its current line total.');
  const shares = weights.map(weight => amountMinor * (weight / weightTotal));
  const amounts = shares.map(Math.floor);
  const remainder = amountMinor - amounts.reduce((sum, amount) => sum + amount, 0);
  const ranking = shares.map((share, index) => ({ index, fraction: share - amounts[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index++) amounts[ranking[index].index] += 1;
  const lines = sale.lines.map((line, index) => ({ id: line.id, name: line.product.name, quantity: line.given, unit: line.unit, amountMinor: amounts[index] }));
  if (draft && lines.some(line => line.amountMinor === 0)) return fail('Review prices so each delivered line has a positive billed amount.');
  if (draft && lines.some(line => line.amountMinor / 100 / line.quantity >= 1e12)) return fail('Review the unit prices before preparing payment.');
  const invoice: Invoice = { id: `invoice-${encodeURIComponent(state.scope)}-${sequence}`, number, saleId: sale.id, saleNumber: sale.number,
    customerName: sale.customer.name, customerId: sale.customer.id, customerRuc: options.customerRuc, sellerName: state.setup.sellerName,
    sellerRuc: state.setup.ruc, sourceTotal: draft ? sourceMinor/100 : sale.figure, sourceCurrency, fxRate: Number(fxRate),
    currency: 'PEN', amountMinor, taxRate: options.taxRate, taxMinor: amountMinor - netMinor, netMinor,
    issuedAt: at, dueAt: options.dueAt, status: draft ? 'draft' : 'accepted', origin: draft ? 'cedar' : 'demo', lines,
    ...(collectionOnly ? { collectionOnly: true } : draft ? { invoiceSeries: state.setup.invoiceSeries, customerAddress: options.customerAddress?.trim() || '' } : {}) };
  if (draft && (!boundedText(invoice.id, 120) || !boundedText(`request-${encodeURIComponent(state.scope)}-${state.requests.length + 1}`, 120))) return fail('Use the selected workspace to prepare this payment request.');
  return { ok: true, value: invoice, state: { ...state, invoices: [...state.invoices, invoice],
    events: event(state, invoice.id, collectionOnly ? 'collection-document' : draft ? 'billing-draft' : 'invoice',
      collectionOnly ? 'Order payment linked' : draft ? 'Billing draft prepared from Delivery Note' : 'Order recorded', at) } };
}

export const issueInvoice = (state: MoneyState, sale: InvoiceSale, options: InvoiceOptions, at: string): Result<Invoice> => freezeDocument(state, sale, options, at, false);
export const createBillingDraft = (state: MoneyState, sale: InvoiceSale, options: InvoiceOptions, at: string): Result<Invoice> => freezeDocument(state, sale, options, at, true);

/** Commercial collection starts with the priced order. Its request is part of the same commit. */
export function createOrderPaymentDocument(state: MoneyState, sale: InvoiceSale & { state: string; day: string }, at: string, origin: string): Result<Invoice> {
  if (!['made', 'scheduled', 'sent', 'delivered', 'disputed', 'settled'].includes(sale.state)) return fail('Complete the priced order to open its payment link.');
  const day = peruDate(at);
  const dueAt = calendarDate(sale.day) && sale.day > day ? sale.day : day;
  const made = freezeDocument(state, sale, { customerRuc: '', taxRate: 0, dueAt }, at, true, true);
  if (!made.ok || invoiceBalance(made.state, made.value.id) === 0) return made;
  const linked = createRequest(made.state, made.value.id, at, origin);
  return linked.ok ? { ok: true, value: made.value, state: linked.state } : linked;
}

/** Fiscal preparation enriches the reviewed commercial snapshot; its collection identity stays. */
export function prepareOrderFiscal(state: MoneyState, invoiceId: string, options: InvoiceOptions, at: string): Result<Invoice> {
  const invoice = state.invoices.find(row => row.id === invoiceId);
  if (!invoice?.collectionOnly) return fail('Open the order payment to prepare its fiscal details.');
  if (!/^\d{11}$/.test(state.setup.ruc) || !/^\d{11}$/.test(options.customerRuc)) return fail('Enter the seller and customer RUC as 11 digits.');
  if (!/^F[A-Z0-9]{3}$/.test(state.setup.invoiceSeries)) return fail('Use a four-character invoice series beginning with F.');
  if (!boundedText(options.customerAddress || '', 100)) return fail('Enter the customer fiscal address, up to 100 characters.');
  if (![0,18].includes(options.taxRate) || !calendarDate(options.dueAt) || options.dueAt < peruDate(at)) return fail('Review the tax rate and fiscal due date.');
  const netMinor = Math.round(invoice.amountMinor / (1 + options.taxRate / 100));
  const updated: Invoice = { ...invoice, collectionOnly: false, customerRuc: options.customerRuc, customerAddress: options.customerAddress!.trim(),
    sellerRuc: state.setup.ruc, invoiceSeries: state.setup.invoiceSeries, taxRate: options.taxRate,
    taxMinor: invoice.amountMinor - netMinor, netMinor, dueAt: options.dueAt };
  return { ok: true, value: updated, state: { ...state, invoices: state.invoices.map(row => row.id === invoiceId ? updated : row),
    events: event(state, invoiceId, 'fiscal-preparation', 'Fiscal details prepared', at) } };
}

/** An explicit review can revise commercial goods until fiscal preparation freezes them. */
export function reviseOrderPaymentDocument(state: MoneyState, sale: InvoiceSale, at: string): Result<Invoice> {
  const prior = invoiceForSale(state, sale.id);
  if (!prior?.collectionOnly || prior.fiscal && prior.fiscal.phase !== 'unprepared') return fail('Review the issued document before changing its billed goods.');
  if (prior.customerId !== sale.customer.id || prior.customerName !== sale.customer.name || prior.saleNumber !== sale.number) return fail('Keep this payment with its original order and customer.');
  const base = { ...state, invoices: state.invoices.filter(row => row.id !== prior.id) };
  const made = freezeDocument(base, sale, {customerRuc:'',taxRate:0,dueAt:prior.dueAt}, prior.issuedAt, true, true);
  if (!made.ok) return made;
  const paid = prior.amountMinor - invoiceBalance(state, prior.id);
  if (made.value.amountMinor < paid) return fail('Review the received payments before reducing this order total.');
  const updated = { ...prior, sourceTotal: made.value.sourceTotal, amountMinor: made.value.amountMinor,
    netMinor: made.value.netMinor, taxMinor: 0, lines: made.value.lines };
  if (JSON.stringify(updated) === JSON.stringify(prior)) return {ok:true,value:prior,state};
  return {ok:true,value:updated,state:{...state,invoices:state.invoices.map(row=>row.id===prior.id?updated:row),
    requests:state.requests.map(row=>row.invoiceId===prior.id?{...row,amountMinor:Math.max(1,updated.amountMinor-paid)}:row),
    events:event(state,prior.id,'order-revision','Order payment updated',at)}};
}

export function createRequest(state: MoneyState, invoiceId: string, at: string, origin: string): Result<PaymentRequest> {
  const invoice = state.invoices.find(item => item.id === invoiceId);
  if (!invoice || !isCollectible(invoice)) return fail('Choose a reviewed billing document.');
  const balance = invoiceBalance(state, invoiceId);
  if (balance === 0) return fail('This invoice is paid.');
  const prior = requestForInvoice(state, invoiceId);
  if (prior && prior.amountMinor === balance) return { ok: true, value: prior, state };
  if (prior) {
    const updated = { ...prior, amountMinor: balance };
    return { ok: true, value: updated, state: { ...state,
      requests: state.requests.map(item => item.id === prior.id ? updated : item) } };
  }
  const id = `request-${encodeURIComponent(state.scope)}-${state.requests.length + 1}`;
  const request: PaymentRequest = { id, invoiceId, amountMinor: balance, currency: invoice.currency,
    url: `${origin}#/money/request/${id}`, status: 'created', createdAt: at };
  return { ok: true, value: request, state: { ...state, requests: [...state.requests, request],
    events: event(state, invoiceId, 'request', 'Payment link created', at) } };
}
export function recordRequestAction(state: MoneyState, requestId: string, action: 'copied' | 'sent', at: string, dispatch?: PaymentDispatch, sentAtSource: 'sample' | 'actual' = 'actual'): Result<PaymentRequest> {
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return fail('Open an existing payment request.');
  if (request.remotePending) return fail('Finish connecting this payment request before sharing it.');
  if (request.amountMinor !== invoiceBalance(state, request.invoiceId)) return fail('Refresh this request to use the current balance.');
  const already = action === 'sent' ? request.sentAt : request.copiedAt;
  if (already && (!dispatch || dispatch.by==='auto')) return { ok: true, value: request, state };
  if (dispatch && (request.dispatches?.length??0)>=100) return fail('Open the customer conversation to continue sharing this order.');
  const next: PaymentRequest = action === 'sent' ? { ...request, status: 'sent', sentAt: request.sentAt??at, sentAtSource: request.sentAt ? request.sentAtSource : sentAtSource, ...(dispatch ? {dispatch:request.dispatch??dispatch,
    dispatches:[...(request.dispatches??[]),{...dispatch,id:`${request.id}:send:${state.events.length+1}`,at}]} : {}) }
    : { ...request, status: request.sentAt ? 'sent' : 'copied', copiedAt: at };
  return { ok: true, value: next, state: { ...state, requests: state.requests.map(item => item.id === requestId ? next : item),
    events: event(state, request.invoiceId, action, action === 'sent' ? dispatch?.by==='auto'?'Payment link sent automatically':'Payment link sent by you' : 'Payment link copied', at) } };
}
export function recordReceipt(state: MoneyState, input: ReceiptInput, at: string): Result<Receipt> {
  const invoice = state.invoices.find(item => item.id === input.invoiceId);
  if (!invoice) return fail('Choose an invoice for this payment.');
  if (!['PEN', 'EUR', 'USD'].includes(input.currency)) return fail('Use a supported payment currency: PEN, EUR or USD.');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) return fail('Enter a positive payment amount with up to two decimals.');
  if (input.roundingMinor !== undefined && (!Number.isSafeInteger(input.roundingMinor) || input.roundingMinor < 0
    || input.roundingMinor > 99 || input.roundingMinor >= input.amountMinor)) return fail('Use the rounding recorded with this payment.');
  if (input.receivedAt !== undefined && (typeof input.receivedAt !== 'string' || !Number.isFinite(Date.parse(input.receivedAt)))) return fail('Use the recorded payment arrival time.');
  const reference = input.reference.trim();
  if (!reference || reference.length > 120) return fail('Enter a payment reference of up to 120 characters.');
  const previous = state.receipts.find(receipt => receipt.reference === reference);
  if (previous) {
    if (previous.invoiceId !== input.invoiceId || previous.amountMinor !== input.amountMinor || previous.currency !== input.currency || previous.method !== input.method
      || (previous.roundingMinor ?? 0) !== (input.roundingMinor ?? 0)) return fail('This reference belongs to another payment. Review the recorded transaction.');
    return { ok: true, value: previous, state };
  }
  const reason = input.currency !== invoice.currency ? 'Payment currency differs from the invoice.'
    : receiptPrincipal(input) > invoiceBalance(state, invoice.id) ? 'Payment exceeds the remaining balance.'
      : !isCollectible(invoice) ? 'Billing document needs review.' : undefined;
  const receipt: Receipt = { ...input, reference, id: `receipt-${state.receipts.length + 1}`, at, status: reason ? 'review' : 'matched', ...(reason ? { reason } : {}) };
  const source = input.source === 'manual' ? 'Payment recorded by you' : input.source === 'prometeo' ? 'Bank receipt verified · Prometeo' : 'Bank receipt';
  return { ok: true, value: receipt, state: { ...state, receipts: [...state.receipts, receipt],
    events: event(state, invoice.id, 'receipt', `${source} · ${formatMoney(input.amountMinor, input.currency)} · ${reason ? 'Review required' : input.method}`, at) } };
}

/** Validate persisted shape before restoring; a damaged fixture starts a fresh, explicit preview. */
export function parseMoney(raw: unknown, scope: string): MoneyState {
  if (!raw || typeof raw !== 'object') return emptyMoney(scope);
  const value = raw as MoneyState;
  if (value.version !== 1 || value.scope !== scope || !value.setup || !Array.isArray(value.invoices) || !Array.isArray(value.requests) || !Array.isArray(value.receipts) || !Array.isArray(value.events)) return emptyMoney(scope);
  const text = (input: unknown): input is string => typeof input === 'string';
  const minor = (input: unknown): input is number => Number.isSafeInteger(input) && (input as number) >= 0;
  const unique = (items: { id: string }[]) => new Set(items.map(item => item.id)).size === items.length;
  if (value.invoices.some(invoice => !invoice || !Array.isArray(invoice.lines) || !minor(invoice.amountMinor) || invoice.amountMinor === 0
    || ![invoice.id, invoice.number, invoice.saleId, invoice.saleNumber, invoice.customerId, invoice.customerName, invoice.customerRuc,
      invoice.sellerName, invoice.sellerRuc, invoice.issuedAt, invoice.dueAt].every(text)
    || invoice.currency !== 'PEN' || !['EUR', 'PEN'].includes(invoice.sourceCurrency) || !['demo', 'cedar'].includes(invoice.origin)
    || !['draft', 'accepted', 'rejected'].includes(invoice.status) || (invoice.status === 'draft' && invoice.origin !== 'cedar')
    || (invoice.fixtureOwned !== undefined && typeof invoice.fixtureOwned !== 'boolean')
    || (invoice.collectionRelease !== undefined && (!invoice.collectionRelease || !text(invoice.collectionRelease.revision) || !['disputed','changed-after-loading','partial-return','monthly-billing','manual'].includes(invoice.collectionRelease.reason)))
    || (invoice.collectionHold !== undefined && !['disputed','changed-after-loading','partial-return','monthly-billing','manual'].includes(invoice.collectionHold))
    || (invoice.collectionOnly !== undefined && typeof invoice.collectionOnly !== 'boolean')
    || (invoice.collectionOnly && (invoice.origin !== 'cedar' || invoice.status !== 'draft'))
    || (invoice.origin === 'cedar' && !invoice.collectionOnly && (!invoice.invoiceSeries || !/^F[A-Z0-9]{3}$/.test(invoice.invoiceSeries) || typeof invoice.customerAddress !== 'string'))
    || (invoice.fiscal !== undefined && !validFiscal(invoice.fiscal)) || !Number.isFinite(invoice.fxRate) || invoice.fxRate <= 0
    || (invoice.sourceCurrency === 'PEN' && (invoice.fxRate !== 1 || Math.round(invoice.sourceTotal * 100) !== invoice.amountMinor))
    || (invoice.disputed !== undefined && typeof invoice.disputed !== 'boolean')
    || !Number.isFinite(invoice.sourceTotal) || invoice.sourceTotal <= 0 || !minor(invoice.netMinor) || !minor(invoice.taxMinor)
    || invoice.netMinor + invoice.taxMinor !== invoice.amountMinor
    || invoice.lines.some(line => !line || ![line.id, line.name, line.unit].every(text) || !minor(line.amountMinor) || !Number.isFinite(line.quantity))
    || invoice.lines.reduce((sum, line) => sum + line.amountMinor, 0) !== invoice.amountMinor)) return emptyMoney(scope);
  if (value.requests.some(request => !request || ![request.id, request.invoiceId, request.url, request.createdAt].every(text)
    || !minor(request.amountMinor) || request.amountMinor === 0 || request.currency !== 'PEN'
    || (request.remoteId !== undefined && !text(request.remoteId)) || (request.remotePending !== undefined && typeof request.remotePending !== 'boolean')
    || (request.paymentQuote !== undefined && !validPaymentQuote(request.paymentQuote))
    || (request.sentAtSource !== undefined && (!request.sentAt || !['sample','actual'].includes(request.sentAtSource)))
    || (request.commercialFingerprint !== undefined && !/^[a-f0-9]{64}$/.test(request.commercialFingerprint))
    || (request.dispatches !== undefined && (!Array.isArray(request.dispatches) || request.dispatches.length>100 || request.dispatches.some(row=>!row||!text(row.id)||!text(row.at)||!Number.isFinite(Date.parse(row.at))||!['auto','manual'].includes(row.by)||!['delivery','evening','next-morning','early','held'].includes(row.reason)||!['whatsapp','email'].includes(row.channel)||!text(row.text))))
    || (request.dispatch !== undefined && (!request.sentAt || !['auto','manual'].includes(request.dispatch.by) || !['delivery','evening','next-morning','early','held'].includes(request.dispatch.reason) || !['whatsapp','email'].includes(request.dispatch.channel) || !text(request.dispatch.text)))
    || !['created', 'copied', 'sent'].includes(request.status) || !value.invoices.some(invoice => invoice.id === request.invoiceId))) return emptyMoney(scope);
  if (value.receipts.some(receipt => !receipt || ![receipt.id, receipt.invoiceId, receipt.reference, receipt.at].every(text)
    || (receipt.receivedAt !== undefined && (!text(receipt.receivedAt) || !Number.isFinite(Date.parse(receipt.receivedAt))))
    || !minor(receipt.amountMinor) || receipt.amountMinor === 0 || !['PEN', 'EUR', 'USD'].includes(receipt.currency)
    || (receipt.roundingMinor !== undefined && (!minor(receipt.roundingMinor) || receipt.roundingMinor > 99 || receipt.roundingMinor >= receipt.amountMinor))
    || !['manual', 'demo-bank', 'prometeo'].includes(receipt.source) || !['cash', 'transfer', 'yape', 'plin'].includes(receipt.method)
    || !['matched', 'review'].includes(receipt.status) || !value.invoices.some(invoice => invoice.id === receipt.invoiceId
      && (receipt.status === 'review' || (receipt.currency === invoice.currency && isCollectible(invoice)))))) return emptyMoney(scope);
  if (value.events.some(item => !item || ![item.id, item.invoiceId, item.kind, item.label, item.at].every(text)
    || !value.invoices.some(invoice => invoice.id === item.invoiceId))) return emptyMoney(scope);
  if (![value.invoices, value.requests, value.receipts, value.events].every(unique)
    || new Set(value.invoices.map(invoice => invoice.saleId)).size !== value.invoices.length
    || new Set(value.receipts.map(receipt => receipt.reference)).size !== value.receipts.length
    || value.invoices.some(invoice => value.receipts.filter(receipt => receipt.invoiceId === invoice.id && receipt.status === 'matched')
      .reduce((sum, receipt) => sum + receiptPrincipal(receipt), 0) > invoice.amountMinor)) return emptyMoney(scope);
  if ((value.setup.paymentTiming !== undefined && !['delivery','evening','next-morning'].includes(value.setup.paymentTiming))
    || (value.setup.monthlyCustomerIds !== undefined && (!Array.isArray(value.setup.monthlyCustomerIds) || !value.setup.monthlyCustomerIds.every(text)))
    || ![value.setup.sellerName, value.setup.ruc, value.setup.invoiceSeries, value.setup.bankAccountLabel].every(text)
    || (value.fixtureSignature !== undefined && (typeof value.fixtureSignature !== 'string' || !/^[a-f0-9]{8}$/.test(value.fixtureSignature)))
    || (value.fixtureRevision !== undefined && (!Number.isSafeInteger(value.fixtureRevision) || value.fixtureRevision < 1))
    || (value.fixtureDay !== undefined && (!text(value.fixtureDay) || !/^\d{4}-\d{2}-\d{2}$/.test(value.fixtureDay)))
    || !['bbva', 'interbank', 'scotiabank'].includes(value.setup.bank)
    || !['pending', 'deferred', 'authorizing', 'demo-connected'].includes(value.setup.payments)
    || !['pending', 'deferred', 'authorizing', 'demo-connected'].includes(value.setup.invoicing)) return emptyMoney(scope);
  return { ...emptyMoney(scope), ...value, setup: { ...emptyMoney(scope).setup, ...value.setup } };
}
