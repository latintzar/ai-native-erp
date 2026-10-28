/** THE LENDER DOSSIER — ONE DOCUMENT, BUILT FROM THE WORKSPACE'S OWN DATA (FEED-IA §249).
 *
 * «And the leneer sharing isnt simulating approval. a dossier is a dossier. it's underlated to an
 *  action/loan. the loan is offered and is granted, jut like in monzo»      — Peter, 14 September
 *
 * ═══ WHAT THIS MODULE IS ══════════════════════════════════════════════════════════════════════
 * `dossierOf` reads the ledger, the book and the consent record this workspace already holds and
 * answers six sections of figures: identity, movements, collections, order book, risk signals and
 * consents. Every number is DERIVED from those inputs. Nothing here approves, prices, scores or
 * offers anything, and no figure is invented: a dossier is a reading, and the act beside it is a
 * share.
 *
 * ═══ ONE CLOCK, AND IT IS THE LEDGER'S ════════════════════════════════════════════════════════
 * The whole document stands on the Money sample instant — `moneyNow(state)`, the fixture's
 * `referenceAt` advanced by the events the workspace recorded. That is what makes «3 days
 * overdue», the movements window and the share line all read the same day, and what makes a
 * reload show the document it showed before. The device's wall clock drives nothing on this page.
 *
 * ═══ THE LEDGER IS READ THROUGH THE LEDGER'S OWN SELECTORS ════════════════════════════════════
 * `invoiceBalance`, `invoiceOverdueDays`, `isCollectible` and `peruDate` come from `money-model`,
 * so an invoice that reads Overdue on the Money dashboard reads overdue here. The sales are typed
 * STRUCTURALLY — `MoneySourceSale` satisfies `DossierSale` — so this module keeps no dependency on
 * Sales, and `app/tools/test-dossier.mjs` runs the real thing on the seeded fish book and on a
 * synthetic one.
 */
import { invoiceBalance, invoiceOverdueDays, isCollectible, peruDate, receiptEffectiveAt, receiptPrincipal, type MoneyState } from './money-model';

export const DOSSIER_KEY_PREFIX = 'rocoto-cedar-dossier-v1:';
export const dossierKey = (scope: string): string => `${DOSSIER_KEY_PREFIX}${scope}`;

/** The most shares one workspace's log keeps. Older shares fall off the head. */
export const DOSSIER_SHARE_LIMIT = 50;

/** The words the receiving-account line takes while the bank connection is still ahead. */
export const DOSSIER_ACCOUNT_PENDING = 'Added at bank connection';

/* ── THE SHARE LOG · ONE SCOPED KEY, PARSED DEFENSIVELY ──────────────────────────────────────
 * `rocoto-cedar-dossier-v1:<scope>` holds completed PDF preparations in the legacy `shares` field. New records use the
 * actual completion clock; retained records keep their original instant. It is inventoried in
 * `workspace-reset.ts`, so both Reset acts return it to an empty log. */

export type DossierShare = { at: string };
export type DossierLog = { version: 1; scope: string; shares: DossierShare[]; requestedAdvanceMinor?: number };

/** The document records the amount being compared; the advance keeps its own authorization. */
export function requestDossierAdvance(log: DossierLog, amountMinor: number): DossierLog {
  return Number.isSafeInteger(amountMinor) && amountMinor >= 0 && amountMinor <= 1_000_000_000_000
    ? { ...log, requestedAdvanceMinor: amountMinor } : log;
}

export const emptyDossierLog = (scope: string): DossierLog => ({ version: 1, scope, shares: [] });

const instant = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));

/** A damaged log reads as EMPTY rather than as a half record: the page then states the share act,
 *  which is the honest state. */
export function parseDossierLog(raw: unknown, scope: string): DossierLog {
  if (!raw || typeof raw !== 'object') return emptyDossierLog(scope);
  const value = raw as Partial<DossierLog>;
  if (value.version !== 1 || value.scope !== scope || !Array.isArray(value.shares)) return emptyDossierLog(scope);
  if (value.shares.length > DOSSIER_SHARE_LIMIT) return emptyDossierLog(scope);
  const shares: DossierShare[] = [];
  for (const row of value.shares) {
    const share = row as Partial<DossierShare> | null;
    if (!share || typeof share !== 'object' || !instant(share.at)) return emptyDossierLog(scope);
    shares.push({ at: new Date(share.at).toISOString() });
  }
  shares.sort((a, b) => a.at.localeCompare(b.at));
  const amount = value.requestedAdvanceMinor;
  return { version: 1, scope, shares,
    ...(Number.isSafeInteger(amount) && amount! >= 0 && amount! <= 1_000_000_000_000 ? { requestedAdvanceMinor: amount } : {}) };
}

export function readDossierLog(scope: string): DossierLog {
  try { return parseDossierLog(JSON.parse(localStorage.getItem(dossierKey(scope)) || 'null'), scope); }
  catch { return emptyDossierLog(scope); }
}

export function writeDossierLog(log: DossierLog): boolean {
  try { localStorage.setItem(dossierKey(log.scope), JSON.stringify(log)); return true; }
  catch { return false; }
}

/** One share joins the log, in order, and the log keeps its last fifty. */
export function recordShare(log: DossierLog, at: string): DossierLog {
  if (!instant(at)) return log;
  const shares = [...log.shares, { at: new Date(at).toISOString() }]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-DOSSIER_SHARE_LIMIT);
  return { ...log, shares };
}

export const lastShareAt = (log: DossierLog): string | null => log.shares[log.shares.length - 1]?.at ?? null;

/* ── WHAT THE DOCUMENT IS BUILT FROM ─────────────────────────────────────────────────────────*/

export type DossierIdentity = {
  /** the razón social every Cedar invoice already carries */
  legalName: string;
  ruc: string;
  address: string;
  /** the person who holds the workspace */
  owner: string;
  /** the authorized receiving account, masked; `DOSSIER_ACCOUNT_PENDING` until one answers */
  receivingAccount: string;
};

/** One order in the seller's own book, typed structurally so this module keeps no dependency on
 *  Sales. `figure` is the order's value in the workspace's own soles. */
export type DossierSaleLine = { given?: number; unit?: string; price?: number; product?: { name?: string } };
export type DossierSale = {
  day: string; figure: number; state?: string;
  messageOnly?: boolean; archived?: unknown;
  customer?: { id?: string; name?: string };
  lines?: readonly DossierSaleLine[];
};

export type DossierConsentKind = 'bank-access' | 'auto-repayment' | 'share';
export type DossierConsent = { kind: DossierConsentKind; at: string };

/** What each consent is called on the page. */
export const DOSSIER_CONSENT_WORDS: Record<DossierConsentKind, string> = {
  'bank-access': 'Bank account access',
  'auto-repayment': 'Repayment from incoming payments',
  share: 'PDF prepared',
};

export type DossierInput = {
  scope: string;
  /** the ledger's own instant — `moneyNow(state)` */
  preparedAt: string;
  identity: DossierIdentity;
  /** the retained opening balance of the workspace's receiving account */
  openingBalanceMinor: number;
  state: MoneyState;
  sales: readonly DossierSale[];
  /** bank access, repayment authorization and every share, in any order */
  consents: readonly DossierConsent[];
  requestedAdvanceMinor?: number;
  reminders?: readonly { invoiceId: string; at: string }[];
};

/* ── WHAT IT ANSWERS ─────────────────────────────────────────────────────────────────────────*/

/** A span of calendar days, both ends included. */
export type DossierWindow = { from: string; to: string; days: number };

export type DossierMovements = {
  window: DossierWindow;
  inflowMinor: number; inflowCount: number;
  issuedMinor: number; issuedCount: number;
  /** the days the balance series actually covers — thinner than the window when it is */
  balanceWindow: DossierWindow;
  averageDailyBalanceMinor: number;
  closingBalanceMinor: number;
};

export type DossierCollections = {
  requestsSent: number; paid: number; paidMinor: number;
  successBasisPoints: number;
  /** calendar days from a document's issue to the receipt that settled it, to one decimal */
  averageDaysToPay: number;
};

export type DossierCustomerShare = {
  customerId: string; name: string; orders: number; valueMinor: number; shareBasisPoints: number;
};
export type DossierWeek = { week: string; orders: number; delivered: number; valueMinor: number; days: number };

export type DossierOrderBook = {
  window: DossierWindow;
  orders: number; valueMinor: number;
  averageTicketMinor: number;
  ordersPerWeek: number;
  /** distinct delivery days per week, to one decimal */
  deliveryDaysPerWeek: number;
  weeks: DossierWeek[];
  topCustomers: DossierCustomerShare[];
};

export type DossierWeekday = { weekday: number; name: string; orders: number; shareBasisPoints: number };
export type DossierPriceRange = {
  product: string; lines: number;
  minMinor: number; maxMinor: number; averageMinor: number;
  /** one price across the whole book */
  steady: boolean;
};

export type DossierRisk = {
  overdue: { count: number; amountMinor: number; averageDaysLate: number };
  disputed: { count: number; shareBasisPoints: number };
  /** seven rows, Monday first, whose shares sum to 10 000 basis points */
  weekdays: DossierWeekday[];
  /** the three products the book turns the most value on */
  prices: DossierPriceRange[];
};

export type DossierSectionId = 'identity' | 'movements' | 'collections' | 'order-book' | 'risk' | 'consents';
export type DossierEvidence = { source: string; window: DossierWindow };
export type DossierCapacity = {
  requestedMinor: number;
  takingsMinor: number;
  /** Requested amount divided by the previous calendar month's matched receipts. */
  ratioBasisPoints: number | null;
  window: DossierWindow;
};

export type DossierOperating = {
  customers: number; repeatCustomers: number; repeatOrders: number; repeatOrderBasisPoints: number;
  orderLines: number; deliveredOrders: number; deliveryDays: number; products: number;
  matchedReceipts: number; splitPaymentInvoices: number; partPaidInvoices: number; partPaidOutstandingMinor: number;
  reminders: number; remindedInvoices: number; paidAfterReminder: number; paidAfterReminderMinor: number;
};

export type Dossier = {
  scope: string;
  preparedAt: string;
  /** the Peru calendar day the document was prepared on */
  preparedDay: string;
  identity: DossierIdentity;
  movements: DossierMovements;
  collections: DossierCollections;
  orderBook: DossierOrderBook;
  risk: DossierRisk;
  consents: DossierConsent[];
  evidence: Record<DossierSectionId, DossierEvidence>;
  capacity: DossierCapacity;
  operating: DossierOperating;
};

/* ── THE ARITHMETIC ──────────────────────────────────────────────────────────────────────────*/

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const noon = (day: string): number => Date.parse(`${day}T12:00:00Z`);
const shift = (day: string, days: number): string => new Date(noon(day) + days * 86_400_000).toISOString().slice(0, 10);

/** How many calendar days a span holds, both ends included. */
export const spanDays = (from: string, to: string): number =>
  DAY.test(from) && DAY.test(to) && to >= from ? Math.round((noon(to) - noon(from)) / 86_400_000) + 1 : 0;

const windowOf = (from: string, to: string): DossierWindow => ({ from, to, days: spanDays(from, to) });

/** `2026-W38` — the ISO week a delivery day falls in. */
export function isoWeekOf(day: string): string {
  const target = new Date(noon(day));
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const week = Math.ceil(((target.getTime() - Date.UTC(target.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const WEEKDAY_WORDS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
/** Monday first, the way a trading week reads. */
const weekdayIndex = (day: string): number => (new Date(noon(day)).getUTCDay() + 6) % 7;

/** SHARES THAT SUM TO EXACTLY 100 %. Each value takes its floor in basis points and the remainder
 *  goes to the largest fractions first, so a seasonality table adds up on the page rather than to
 *  9 999 basis points. */
export function sharesOf(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map(value => Math.max(0, value) * 10_000 / total);
  const shares = exact.map(Math.floor);
  let left = 10_000 - shares.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ fraction: value - Math.floor(value), index }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const row of order) { if (left <= 0) break; shares[row.index] += 1; left -= 1; }
  return shares;
}

const rounded = (value: number, places = 1): number => {
  const factor = 10 ** places;
  return Number.isFinite(value) ? Math.round(value * factor) / factor : 0;
};

/** An order is an order: it names a customer, it holds lines, it stands in the book. The advance's
 *  own predicate, so the dossier's order book and the limit read one set (`money-finance.ts`). */
const counts = (sale: DossierSale): boolean =>
  Boolean(sale) && DAY.test(sale.day ?? '') && !sale.messageOnly && !sale.archived
  && Boolean(sale.customer?.id) && Boolean(sale.lines?.length)
  && Number.isSafeInteger(Math.round(sale.figure * 100)) && Math.round(sale.figure * 100) > 0;

/** Bank evidence: money that reached the receiving account. Manual notes and cash settle an
 *  invoice in their own ledger and change no account, exactly as `projectMoney` already holds. */
const delivered = (sale: DossierSale): boolean => sale.state === 'delivered' || sale.state === 'settled';

const bankReceipt = (receipt: MoneyState['receipts'][number]): boolean =>
  receipt.status === 'matched' && receipt.source !== 'manual' && receipt.method !== 'cash' && receipt.currency === 'PEN';

/** THE WHOLE DOCUMENT, from the workspace's own records. */
export function dossierOf(input: DossierInput): Dossier {
  const { state, sales } = input;
  const preparedDay = peruDate(input.preparedAt) || '';
  const identity: DossierIdentity = {
    ...input.identity,
    receivingAccount: input.identity.receivingAccount.trim() || DOSSIER_ACCOUNT_PENDING,
  };

  /* ── MOVEMENTS ─────────────────────────────────────────────────────────────────────────── */
  const ledger = state.invoices.filter(invoice => isCollectible(invoice) && invoice.currency === 'PEN');
  const receipts = state.receipts.filter(bankReceipt)
    .map(receipt => ({ day: peruDate(receiptEffectiveAt(receipt)), amountMinor: receipt.amountMinor, invoiceId: receipt.invoiceId }))
    .filter(row => DAY.test(row.day))
    .sort((a, b) => a.day.localeCompare(b.day));
  const issuedDays = ledger.map(invoice => peruDate(invoice.issuedAt)).filter(day => DAY.test(day));
  const earliest = [...issuedDays, ...receipts.map(row => row.day)].sort()[0];
  const to = preparedDay || earliest || '';
  const from = to ? shift(to, -89) : to;
  const window = windowOf(from, to);

  const inWindow = (day: string): boolean => Boolean(day) && day >= from && day <= to;
  const inflows = receipts.filter(row => inWindow(row.day));
  const issued = ledger.filter(invoice => inWindow(peruDate(invoice.issuedAt)));

  /* Ninety daily closing balances share the movements period. Receipts before that period
     contribute to its opening balance; each in-period receipt advances its own calendar day. */
  const balanceFrom = from;
  const balanceWindow = windowOf(balanceFrom, to);
  let running = input.openingBalanceMinor + receipts.filter(row => row.day < from).reduce((sum, row) => sum + row.amountMinor, 0);
  let balanceTotal = 0;
  for (let day = balanceFrom; day <= to; day = shift(day, 1)) {
    for (const row of receipts) if (row.day === day) running += row.amountMinor;
    balanceTotal += running;
  }
  const movements: DossierMovements = {
    window,
    inflowMinor: inflows.reduce((sum, row) => sum + row.amountMinor, 0),
    inflowCount: inflows.length,
    issuedMinor: issued.reduce((sum, invoice) => sum + invoice.amountMinor, 0),
    issuedCount: issued.length,
    balanceWindow,
    averageDailyBalanceMinor: balanceWindow.days > 0 ? Math.round(balanceTotal / balanceWindow.days) : input.openingBalanceMinor,
    closingBalanceMinor: running,
  };

  /* ── COLLECTIONS ───────────────────────────────────────────────────────────────────────── */
  const ledgerIds = new Set(ledger.map(invoice => invoice.id));
  const requestedIds = new Set(state.requests.filter(request => request.sentAt && ledgerIds.has(request.invoiceId))
    .map(request => request.invoiceId));
  const requestsSent = requestedIds.size;
  const settled = ledger.filter(invoice => invoiceBalance(state, invoice.id) <= 0);
  const requestedSettled = settled.filter(invoice => requestedIds.has(invoice.id));
  // The first cumulative receipt covering the invoice establishes payment time, including cash.
  const settlementAt = new Map<string, string>();
  for (const invoice of settled) {
    let received = 0;
    const payments = state.receipts.filter(receipt => receipt.invoiceId === invoice.id
      && receipt.status === 'matched' && receipt.currency === 'PEN'
      && receipt.amountMinor > 0 && instant(receiptEffectiveAt(receipt)))
      .sort((a, b) => Date.parse(receiptEffectiveAt(a)) - Date.parse(receiptEffectiveAt(b)) || a.id.localeCompare(b.id));
    for (const payment of payments) {
      received += receiptPrincipal(payment);
      if (received >= invoice.amountMinor) { settlementAt.set(invoice.id, receiptEffectiveAt(payment)); break; }
    }
  }
  const days: number[] = [];
  for (const invoice of requestedSettled) {
    const paidAt = settlementAt.get(invoice.id);
    const opened = peruDate(invoice.issuedAt);
    if (paidAt && DAY.test(opened)) days.push(Math.max(0, spanDays(opened, peruDate(paidAt)) - 1));
  }
  const collections: DossierCollections = {
    requestsSent,
    paid: requestedSettled.length,
    paidMinor: requestedSettled.reduce((sum, invoice) => sum + invoice.amountMinor, 0),
    successBasisPoints: requestsSent > 0 ? Math.round(requestedSettled.length * 10_000 / requestsSent) : 0,
    averageDaysToPay: days.length ? rounded(days.reduce((sum, value) => sum + value, 0) / days.length) : 0,
  };

  /* ── ORDER BOOK ────────────────────────────────────────────────────────────────────────── */
  const book = sales.filter(sale => counts(sale) && sale.day >= shift(to, -89) && sale.day <= to);
  const bookDays = [...new Set(book.map(sale => sale.day))].sort();
  const bookWindow = windowOf(bookDays[0] ?? to, bookDays[bookDays.length - 1] ?? to);
  const valueOf = (sale: DossierSale): number => Math.round(sale.figure * 100);
  const valueMinor = book.reduce((sum, sale) => sum + valueOf(sale), 0);
  const weeks = new Map<string, DossierWeek & { dayIds: Set<string> }>();
  const customers = new Map<string, DossierCustomerShare>();
  for (const sale of book) {
    const key = isoWeekOf(sale.day);
    const week = weeks.get(key) ?? { week: key, orders: 0, delivered: 0, valueMinor: 0, days: 0, dayIds: new Set<string>() };
    week.orders += 1; if (delivered(sale)) week.delivered += 1; week.valueMinor += valueOf(sale); week.dayIds.add(sale.day);
    weeks.set(key, week);
    const id = sale.customer?.id ?? '';
    const held = customers.get(id) ?? { customerId: id, name: sale.customer?.name ?? id, orders: 0, valueMinor: 0, shareBasisPoints: 0 };
    held.orders += 1; held.valueMinor += valueOf(sale);
    customers.set(id, held);
  }
  const ranked = [...customers.values()]
    .sort((a, b) => b.valueMinor - a.valueMinor || a.customerId.localeCompare(b.customerId))
    .slice(0, 5)
    .map(row => ({ ...row, shareBasisPoints: valueMinor > 0 ? Math.round(row.valueMinor * 10_000 / valueMinor) : 0 }));
  const orderBook: DossierOrderBook = {
    window: bookWindow,
    orders: book.length,
    valueMinor,
    averageTicketMinor: book.length ? Math.round(valueMinor / book.length) : 0,
    ordersPerWeek: bookWindow.days > 0 ? Math.round(book.length * 7 / bookWindow.days) : 0,
    deliveryDaysPerWeek: bookWindow.days > 0 ? rounded(Math.min(bookDays.length * 7 / bookWindow.days, 7)) : 0,
    weeks: [...weeks.values()]
      .map(({ dayIds, ...week }) => ({ ...week, days: dayIds.size }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    topCustomers: ranked,
  };

  /* ── RISK SIGNALS ──────────────────────────────────────────────────────────────────────── */
  const late = ledger
    .map(invoice => ({ invoice, days: invoiceOverdueDays(state, invoice.id, input.preparedAt) }))
    .filter(row => row.days > 0);
  const disputed = book.filter(sale => sale.state === 'disputed').length;
  const perWeekday = WEEKDAY_WORDS.map(() => 0);
  for (const sale of book) perWeekday[weekdayIndex(sale.day)] += 1;
  const weekdayShares = sharesOf(perWeekday);
  const products = new Map<string, { lines: number; quantity: number; value: number; min: number; max: number }>();
  for (const sale of book) for (const line of sale.lines ?? []) {
    const name = line.product?.name?.trim();
    const price = Math.round((line.price ?? 0) * 100);
    const given = line.given ?? 0;
    if (!name || !Number.isSafeInteger(price) || price <= 0 || !Number.isFinite(given) || given <= 0) continue;
    const held = products.get(name) ?? { lines: 0, quantity: 0, value: 0, min: price, max: price };
    held.lines += 1; held.quantity += given; held.value += price * given;
    held.min = Math.min(held.min, price); held.max = Math.max(held.max, price);
    products.set(name, held);
  }
  const prices: DossierPriceRange[] = [...products.entries()]
    .sort((a, b) => b[1].value - a[1].value || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([product, row]) => ({
      product, lines: row.lines, minMinor: row.min, maxMinor: row.max,
      averageMinor: Math.round(row.value / row.quantity), steady: row.min === row.max,
    }));
  const risk: DossierRisk = {
    overdue: {
      count: late.length,
      amountMinor: late.reduce((sum, row) => sum + invoiceBalance(state, row.invoice.id), 0),
      averageDaysLate: late.length ? rounded(late.reduce((sum, row) => sum + row.days, 0) / late.length) : 0,
    },
    disputed: { count: disputed, shareBasisPoints: book.length ? Math.round(disputed * 10_000 / book.length) : 0 },
    weekdays: WEEKDAY_WORDS.map((name, index) => ({
      weekday: index, name, orders: perWeekday[index], shareBasisPoints: weekdayShares[index],
    })),
    prices,
  };

  // Operational evidence follows the historical book and joins actual receipt/reminder ids.
  const repeat = [...customers.values()].filter(customer => customer.orders > 1);
  const repeatOrders = repeat.reduce((sum, customer) => sum + customer.orders, 0);
  const matched = state.receipts.filter(receipt => receipt.status === 'matched' && receipt.currency === 'PEN'
    && Number.isSafeInteger(receipt.amountMinor) && receipt.amountMinor > 0
    && peruDate(receiptEffectiveAt(receipt)) >= from && peruDate(receiptEffectiveAt(receipt)) <= to);
  const recorded = matched.filter(receipt => ledgerIds.has(receipt.invoiceId));
  const partial = ledger.filter(invoice => invoiceBalance(state, invoice.id) > 0
    && recorded.some(receipt => receipt.invoiceId === invoice.id));
  const reminders = (input.reminders ?? []).filter(reminder => ledgerIds.has(reminder.invoiceId)
    && instant(reminder.at) && peruDate(reminder.at) >= from && peruDate(reminder.at) <= to);
  const reminded = new Set(reminders.map(reminder => reminder.invoiceId));
  const resolved = settled.filter(invoice => {
    const first = reminders.filter(reminder => reminder.invoiceId === invoice.id)
      .map(reminder => Date.parse(reminder.at)).sort((a, b) => a - b)[0];
    const paidAt = settlementAt.get(invoice.id);
    return Number.isFinite(first) && Boolean(paidAt && Date.parse(paidAt) >= first
      && peruDate(paidAt) >= from && peruDate(paidAt) <= to);
  });
  const operating: DossierOperating = {
    customers: customers.size, repeatCustomers: repeat.length, repeatOrders,
    repeatOrderBasisPoints: book.length ? Math.round(repeatOrders * 10000 / book.length) : 0,
    orderLines: book.reduce((sum, sale) => sum + (sale.lines?.length ?? 0), 0),
    deliveredOrders: book.filter(delivered).length,
    deliveryDays: new Set(book.filter(delivered).map(sale => sale.day)).size,
    products: products.size, matchedReceipts: recorded.length,
    splitPaymentInvoices: ledger.filter(invoice => recorded.filter(receipt => receipt.invoiceId === invoice.id).length > 1).length,
    partPaidInvoices: partial.length,
    partPaidOutstandingMinor: partial.reduce((sum, invoice) => sum + invoiceBalance(state, invoice.id), 0),
    reminders: reminders.length, remindedInvoices: reminded.size,
    paidAfterReminder: resolved.length,
    paidAfterReminderMinor: resolved.reduce((sum, invoice) => sum + invoice.amountMinor, 0),
  };

  const consents = input.consents
    .filter(consent => instant(consent.at) && consent.kind in DOSSIER_CONSENT_WORDS)
    .map(consent => ({ kind: consent.kind, at: new Date(consent.at).toISOString() }))
    .sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind));
  const recordDays = [...issuedDays, ...state.requests.map(row => peruDate(row.createdAt)),
    ...state.receipts.map(row => peruDate(receiptEffectiveAt(row)))].filter(day => DAY.test(day)).sort();
  const consentDays = consents.map(row => peruDate(row.at)).filter(day => DAY.test(day));
  const evidence: Record<DossierSectionId, DossierEvidence> = {
    identity: { source: "From this workspace's business details", window: windowOf(to, to) },
    movements: { source: "From bank receipts and this workspace's invoices", window: movements.window },
    collections: { source: "From this workspace's payment requests and receipts", window: windowOf(recordDays[0] ?? to, to) },
    'order-book': { source: "From this workspace's orders", window: orderBook.window },
    risk: { source: "From this workspace's invoices and orders", window: windowOf(
      [window.from, orderBook.window.from].sort()[0], [to, orderBook.window.to].sort().slice(-1)[0] ?? to) },
    consents: { source: "From this workspace's authorization and document preparation records", window: windowOf(
      consentDays[0] ?? to, [...consentDays, to].sort().slice(-1)[0] ?? to) },
  };
  const currentMonth = DAY.test(to) ? `${to.slice(0, 7)}-01` : '';
  const monthTo = currentMonth ? shift(currentMonth, -1) : '';
  const monthFrom = monthTo ? `${monthTo.slice(0, 7)}-01` : '';
  const takingsMinor = state.receipts.filter(receipt => receipt.status === 'matched'
    && receipt.currency === 'PEN' && Number.isSafeInteger(receipt.amountMinor) && receipt.amountMinor > 0
    && peruDate(receiptEffectiveAt(receipt)) >= monthFrom && peruDate(receiptEffectiveAt(receipt)) <= monthTo)
    .reduce((sum, receipt) => sum + receipt.amountMinor, 0);
  const requestedMinor = Number.isSafeInteger(input.requestedAdvanceMinor) && input.requestedAdvanceMinor! > 0
    && input.requestedAdvanceMinor! <= 1_000_000_000_000 ? input.requestedAdvanceMinor! : 0;
  const capacity: DossierCapacity = { requestedMinor, takingsMinor,
    ratioBasisPoints: takingsMinor > 0 ? Math.round(requestedMinor * 10_000 / takingsMinor) : null,
    window: windowOf(monthFrom, monthTo) };

  return {
    scope: input.scope,
    preparedAt: input.preparedAt,
    preparedDay,
    identity,
    movements,
    collections,
    orderBook,
    risk,
    consents,
    evidence,
    capacity,
    operating,
  };
}

/* ── THE WORDS A FIGURE TAKES ────────────────────────────────────────────────────────────────*/

const MONTH = { day: 'numeric', month: 'short', timeZone: 'UTC' } as const;
const MONTH_YEAR = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } as const;

/** «12 – 14 Sep» inside one month, «12 Jun – 14 Sep» across months, and both years where they
 *  differ. One window, said once, on the line it belongs to. */
export function dossierWindowWords(from: string, to: string): string {
  if (!DAY.test(from) || !DAY.test(to)) return '';
  const start = new Date(noon(from)), end = new Date(noon(to));
  const endWords = new Intl.DateTimeFormat('en-GB', from.slice(0, 4) === to.slice(0, 4) ? MONTH : MONTH_YEAR).format(end);
  if (from === to) return endWords;
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${new Intl.DateTimeFormat('en-GB', MONTH_YEAR).format(start)} – ${endWords}`;
  if (from.slice(5, 7) === to.slice(5, 7)) return `${start.getUTCDate()} – ${endWords}`;
  return `${new Intl.DateTimeFormat('en-GB', MONTH).format(start)} – ${endWords}`;
}

/** The source and its exact measured period, shared by screen and PDF. */
export const dossierSourceWords = (evidence: DossierEvidence): string =>
  `${evidence.source}, ${dossierWindowWords(evidence.window.from, evidence.window.to)}`;

/** «Prepared 14 Sep 2026» — the day the document states about itself. */
export const preparedWords = (day: string): string =>
  DAY.test(day) ? `Prepared ${new Intl.DateTimeFormat('en-GB', MONTH_YEAR).format(new Date(noon(day)))}` : '';

/** The legacy share log records completed PDF preparation, read in the workspace's own zone. */
export function sharedWords(at: string | null, timeZone = 'America/Lima'): string {
  if (!instant(at)) return '';
  const when = new Date(at);
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone }).format(when);
  const hour = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(when);
  return `PDF prepared ${day} ${hour}`;
}

/** «50 %» · «0.2 %», the unit on the number's own line. */
export const shareWords = (basisPoints: number): string => {
  const value = Number.isFinite(basisPoints) ? basisPoints / 100 : 0;
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)} %`;
};

/** «3 days» · «1 day» · «0 days» — a count of days with its unit beside it. */
export const dayWords = (value: number): string => `${value} ${value === 1 ? 'day' : 'days'}`;

/** `dossier-peix-vilalta-2026-09-14` — the name the printed file carries. */
export function dossierFileName(name: string, day: string): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return ['dossier', slug || 'workspace', DAY.test(day) ? day : ''].filter(Boolean).join('-') + '.pdf';
}
