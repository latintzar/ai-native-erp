/** CAMPAIGNS IN SALES: WHAT THE BOOK RECOMMENDS, AND THE CAMPAIGNS A PERSON LAUNCHES (§249).
 *
 * «the campaings modal in sales» — Peter, 14 September. The wholesaler's own campaigns, sent to
 * their restaurant customers.
 *
 * ═══ WHAT THIS MODULE IS ═══════════════════════════════════════════════════════════════════
 * Two halves and no React in either of them beyond the one store hook at the foot:
 *
 *   THE READING   three recommendations computed from this workspace's own book — the line whose
 *                 price is about to rise, the accounts that have gone quiet, and the share of
 *                 invoices that settle inside a week. Every number on a card comes out of
 *                 `recommendationsOf`, so a figure and the sentence beside it have one author.
 *   THE RECORD    one campaign per launch, under `rocoto-cedar-campaigns-v1:<scope>`, holding who
 *                 it went to, what it offered, what it said, when it was sent or is due, and the
 *                 budget it stands inside. `redemptionsOf` reads the orders back out of the book.
 *
 * ═══ THE SEED IS A FIXTURE, AND IT IS THE HALF A FEED REPLACES ═════════════════════════════
 * `fixtures/campaigns-v1.json` carries two seeded collections and nothing else:
 *
 *   `priceSignals`     the market's published lines for the coming week — one row per product,
 *                      per market, with the rise it expects. A wholesale price feed publishes
 *                      exactly this shape, so connecting one is a change of SOURCE and no change
 *                      of model: the workspace still matches the feed's lines against the goods
 *                      it actually sells and ranks them by what the rise costs this book.
 *   `accountHistory`   the last order each named account placed BEFORE the river's own window.
 *                      Cedar's synthetic river holds five days (`insights.ts`: «World A holds five
 *                      days»), so a fourteen-day silence can only be stated by history older than
 *                      it. The river always wins when it is newer — an account that orders today
 *                      leaves the quiet card by itself — so the seed can never contradict the book.
 *
 * Both are read through `scenario-clock.ts`, so every seeded day follows the workspace's calendar
 * the way `money-seed.ts`'s invoices do; days, not instants, because an order is a calendar fact.
 *
 * ═══ TWO CLOCKS, EACH ANSWERING ITS OWN QUESTION ═══════════════════════════════════════════
 * The BOOK's clock is the workspace day (`cedarTodayId`): it decides what «a week in your orders»
 * covers, how many days an account has been quiet, and which orders count as a redemption. The
 * SCHEDULE's clock is the device's wall clock, because a campaign a person set for Thursday has
 * to go out when Thursday actually arrives — exactly the split `chase.ts` holds for its timer.
 */
import { receiptEffectiveAt, receiptPrincipal, type Receipt } from './money-model';
import * as React from 'react';
import fixture from './fixtures/campaigns-v1.json';
import { cedarTodayId, relativeFixtureDay, shiftCalendarId } from './scenario-clock';

export const CAMPAIGNS_KEY_PREFIX = 'rocoto-cedar-campaigns-v1:';

/* ── THE THRESHOLDS, EACH ONE NAMED ONCE ──────────────────────────────────────────────────── */

/** An account is quiet at fourteen days. Peter's own number: «3 customers haven't ordered in 14 days». */
export const QUIET_DAYS = 14;
/** How many quiet accounts a card names before it counts the rest. */
export const QUIET_NAMED = 5;
/** What the win-back campaign offers, and the code it carries. */
export const WIN_BACK_PERCENT = 10;
export const WIN_BACK_CODE = 'VUELVE10';
/** The early-pay offer: five per cent for settling inside a week. */
export const EARLY_PAY_PERCENT = 5;
export const EARLY_PAY_DAYS = 7;
/** «A week in your orders» — the window the pre-buy card reads its lines over. */
export const BOOK_WEEK_DAYS = 7;
/** What a pre-buy covers: two weeks of that line at today's prices. */
export const PRE_BUY_WEEKS = 2;

/* ── THE SEEDED SIGNAL AND THE SEEDED HISTORY ─────────────────────────────────────────────── */

export type Market = 'peru' | 'spain';

export type PriceSignal = {
  market: Market;
  /** the catalogue line the feed published */
  product: string;
  /** how much more it expects to cost */
  risePercent: number;
  /** how many days out the rise lands */
  risesInDays: number;
};

/** The market's published lines. A connected price feed replaces this reader and nothing else. */
export function priceSignalsOf(market: Market): PriceSignal[] {
  return fixture.fixture.collections.priceSignals
    .filter((row): row is PriceSignal => row.market === market)
    .map(row => ({ ...row }));
}

export type AccountHistory = { customerId: string; lastOrderDay: string };

/** The last order each named account placed before the river's window, on the workspace's own
 *  calendar. `now` exists so a tool test can hold the reader to a day of its choosing. */
export function accountHistoryOf(scope: string, now?: Date): AccountHistory[] {
  return fixture.fixture.collections.accountHistory
    .filter(row => row.scope === scope)
    .map(row => ({ customerId: row.customerId, lastOrderDay: relativeFixtureDay(row.lastOrderDay, now) }));
}

/* ── WHAT THE READINGS ARE COMPUTED FROM ──────────────────────────────────────────────────── */

/** An order, as this module needs to read it: `sale.ts`'s own shape, narrowed. */
export type CampaignSale = {
  day: string;
  customer: { id: string };
  lines: readonly { product?: { name?: string }; given?: number; price?: number; off?: boolean }[];
  messageOnly?: boolean;
  archived?: unknown;
};

/** An account, as the book holds it. */
export type CampaignAccount = { id: string; name: string };

/** A billing document and its evidence, narrowed from `money-model.ts`. */
export type CampaignInvoice = { id: string; amountMinor: number; issuedAt: string; origin?: string; currency?: string };
export type CampaignRequest = { invoiceId: string; sentAt?: string; sentAtSource?: 'sample'|'actual' };
export type CampaignReceipt = { invoiceId: string; amountMinor: number; at: string; status: string } & Partial<Pick<Receipt, 'source' | 'receivedAt' | 'currency' | 'roundingMinor'>>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (value: unknown): value is string => typeof value === 'string' && DAY.test(value);

/** How many calendar days `later` stands after `earlier`. */
export const daysBetween = (earlier: string, later: string): number =>
  Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000);

/** An order is an order: it names a customer, it holds lines, it stands in the book. The same
 *  reading `advanceLimitOf` takes, so the two surfaces count one book. */
const counts = (sale: CampaignSale): boolean =>
  Boolean(sale && !sale.messageOnly && !sale.archived && sale.customer?.id && sale.lines?.length && isDay(sale.day));

/** What each line was worth over the window, by product name, in the book's own minor units. */
export function weeklyValueOf(sales: readonly CampaignSale[], today: string, days = BOOK_WEEK_DAYS): Map<string, number> {
  const from = isDay(today) ? shiftCalendarId(today, 1 - days) : '';
  const totals = new Map<string, number>();
  if (!from) return totals;
  for (const sale of sales) {
    if (!counts(sale) || sale.day < from || sale.day > today) continue;
    for (const line of sale.lines) {
      const name = line?.product?.name?.trim();
      if (!name || line.off) continue;
      const value = (line.given ?? 0) * (line.price ?? 0);
      if (Number.isFinite(value) && value > 0) totals.set(name, (totals.get(name) ?? 0) + value);
    }
  }
  /* One rounding, at the end of each line's own sum: rounding every row first drifts by a cent
     per order, and a card's figure has to equal the figure a spreadsheet of the same rows gives. */
  return new Map([...totals].map(([name, value]) => [name, Math.round(value * 100)]));
}

export type PreBuyReading = {
  product: string;
  /** what that line came to over the last week of orders */
  weeklyMinor: number;
  risePercent: number;
  /** the day the rise lands on, on the workspace's calendar */
  risesOn: string;
  /** two weeks of that line at today's prices — what a pre-buy costs */
  preBuyMinor: number;
};

/** THE LINE THE RISE COSTS MOST. Every published signal is matched against the goods this house
 *  actually sells, and the winner is the one whose weekly value multiplied by its rise is the
 *  largest — a big line moving a little can matter more than a small line moving a lot, and the
 *  card exists to name the money rather than the percentage. */
export function preBuyReadingOf(input: {
  sales: readonly CampaignSale[];
  products: readonly { name: string }[];
  signals: readonly PriceSignal[];
  today: string;
}): PreBuyReading | null {
  const weekly = weeklyValueOf(input.sales, input.today);
  const sold = new Map<string, string>();
  for (const product of input.products) if (product?.name) sold.set(product.name.trim().toLocaleLowerCase(), product.name.trim());
  for (const name of weekly.keys()) sold.set(name.toLocaleLowerCase(), name);
  let best: PreBuyReading | null = null;
  for (const signal of input.signals) {
    const name = sold.get(signal.product.trim().toLocaleLowerCase());
    if (!name || !(signal.risePercent > 0)) continue;
    const weeklyMinor = weekly.get(name) ?? 0;
    if (weeklyMinor <= 0) continue;
    const reading: PreBuyReading = {
      product: name,
      weeklyMinor,
      risePercent: signal.risePercent,
      risesOn: shiftCalendarId(input.today, Math.max(1, Math.round(signal.risesInDays))),
      preBuyMinor: weeklyMinor * PRE_BUY_WEEKS,
    };
    const cost = (row: PreBuyReading) => row.weeklyMinor * row.risePercent;
    if (!best || cost(reading) > cost(best)
      || (cost(reading) === cost(best) && reading.weeklyMinor > best.weeklyMinor)) best = reading;
  }
  return best;
}

export type QuietAccount = { customerId: string; name: string; lastOrderDay: string; days: number };

/** THE ACCOUNTS THAT HAVE GONE QUIET. An account's last order is the later of what the river holds
 *  and what the seeded history records, so an order placed today — or one already scheduled for
 *  next week — takes that account off this card without anybody editing the seed. */
export function quietAccountsOf(input: {
  sales: readonly CampaignSale[];
  accounts: readonly CampaignAccount[];
  history: readonly AccountHistory[];
  today: string;
  quietDays?: number;
}): QuietAccount[] {
  if (!isDay(input.today)) return [];
  const last = new Map<string, string>();
  for (const row of input.history) if (isDay(row.lastOrderDay)) last.set(row.customerId, row.lastOrderDay);
  for (const sale of input.sales) {
    if (!counts(sale)) continue;
    const held = last.get(sale.customer.id);
    if (!held || sale.day > held) last.set(sale.customer.id, sale.day);
  }
  const quietDays = input.quietDays ?? QUIET_DAYS;
  const rows: QuietAccount[] = [];
  for (const account of input.accounts) {
    const day = last.get(account.id);
    if (!day) continue;
    const days = daysBetween(day, input.today);
    if (days >= quietDays) rows.push({ customerId: account.id, name: account.name, lastOrderDay: day, days });
  }
  return rows.sort((a, b) => b.days - a.days || a.name.localeCompare(b.name) || a.customerId.localeCompare(b.customerId));
}

export type EarlyPayReading = { requested: number; settled: number; sharePercent: number; days: number };

/** THE SHARE THAT SETTLES INSIDE A WEEK, off the ledger itself: of the invoices a payment request
 *  first contacted while outstanding, how many settle by seven days after that contact.
 *  A fresh unpaid contact enters the cohort when its observation window matures. Unsent links
 *  do not represent a customer contact. Pre-contact partial principal still counts toward the
 *  remaining balance, while an invoice already fully paid at contact stays outside the cohort. */
export function earlyPayShareOf(input: {
  invoices: readonly CampaignInvoice[]; requests: readonly CampaignRequest[]; receipts: readonly CampaignReceipt[];
  asOf: string; sampleAsOf?: string; days?: number;
}): EarlyPayReading {
  const days=input.days??EARLY_PAY_DAYS,contacts=new Map<string,{at:number; source?:'sample'|'actual'}>();
  for(const request of input.requests){
    const at=typeof request.sentAt==='string'?Date.parse(request.sentAt):NaN;
    if(Number.isFinite(at)&&at<(contacts.get(request.invoiceId)?.at??Infinity))contacts.set(request.invoiceId,{at,source:request.sentAtSource});
  }
  let requested=0,settled=0;
  for(const invoice of input.invoices){
    const contact=contacts.get(invoice.id),first=contact?.at,issued=Date.parse(invoice.issuedAt);
    if(first===undefined||!Number.isFinite(issued)||first<issued||!Number.isSafeInteger(invoice.amountMinor)||invoice.amountMinor<=0)continue;
    const evidence=input.receipts.filter(row=>row.invoiceId===invoice.id&&row.status==='matched'
      &&Number.isSafeInteger(row.amountMinor)&&row.amountMinor>0&&(!row.currency||!invoice.currency||row.currency===invoice.currency));
    const actual=contact?.source==='actual'||evidence.some(row=>row.receivedAt||row.source==='prometeo');
    const clock=Date.parse(invoice.origin==='demo'&&!actual&&input.sampleAsOf?input.sampleAsOf:input.asOf);
    if(!Number.isFinite(clock)||first>clock)continue;
    const deadline=first+days*86400000;
    let before=0,within=0;
    for(const receipt of evidence){
      const at=Date.parse(receiptEffectiveAt(receipt));
      if(!Number.isFinite(at)||at>clock)continue;
      if(at<first)before+=receiptPrincipal(receipt);
      if(at<=deadline)within+=receiptPrincipal(receipt);
    }
    if(before>=invoice.amountMinor||!Number.isSafeInteger(within)||deadline>clock&&within<invoice.amountMinor)continue;
    requested++;
    if(within>=invoice.amountMinor)settled++;
  }
  return {requested,settled,sharePercent:requested?Math.round(settled*100/requested):0,days};
}

/* ── THE OFFER, AND THE WORDS IT PUTS IN A MESSAGE ────────────────────────────────────────── */

export type OfferType = 'percent' | 'fixed' | 'free-delivery';
export type CampaignOffer = { type: OfferType; value: number };

export const OFFER_TYPES: readonly OfferType[] = ['percent', 'fixed', 'free-delivery'];

/** The offer, said the way a message says it. The money formatter is handed in, because the
 *  workspace's currency belongs to `currency.ts` and this module stays pure arithmetic. */
export function offerWords(offer: CampaignOffer, money: (minor: number) => string): string {
  if (offer.type === 'free-delivery') return 'free delivery on';
  if (offer.type === 'fixed') return `${money(Math.max(0, Math.round(offer.value)))} off`;
  return `${Math.max(0, Math.round(offer.value))} % off`;
}

/** The offer, said the way a card and a row say it: the offer alone, with its own unit. */
export function offerLabel(offer: CampaignOffer, money: (minor: number) => string): string {
  if (offer.type === 'free-delivery') return 'Free delivery';
  if (offer.type === 'fixed') return `${money(Math.max(0, Math.round(offer.value)))} off`;
  return `${Math.max(0, Math.round(offer.value))} % off`;
}

/** THE TEMPLATE, MERGED. `{name}` is the account's own name and `{offer}` is the offer's words,
 *  so one template serves three hundred customers and the person reads the real sentence before
 *  it goes. Everything else in the template is theirs, verbatim. */
export function messageOf(template: string, customer: { name: string }, offer: CampaignOffer, money: (minor: number) => string): string {
  return template
    .split('{name}').join(customer.name)
    .split('{offer}').join(offerWords(offer, money))
    .split('{code}').join(WIN_BACK_CODE)
    .trim();
}

/** The win-back message Peter's own brief carries, as a template. */
export const WIN_BACK_TEMPLATE = 'Hi {name}, we miss your orders. {offer} your next one with {code}, this week.';
/** The early-pay message the third card's act prefills. */
export const EARLY_PAY_TEMPLATE = `Hi {name}, {offer} every order you settle within ${EARLY_PAY_DAYS} days. Thank you for your business.`;
/** What a blank custom campaign starts from. */
export const CUSTOM_TEMPLATE = 'Hi {name}, {offer} your next order this week.';

/* ── THE THREE CARDS ──────────────────────────────────────────────────────────────────────── */

export type RecommendationKey = 'pre-buy' | 'win-back' | 'early-pay';

export type Recommendation = {
  key: RecommendationKey;
  /** the heading, which names the thing */
  heading: string;
  /** the sentence under it, stating what the book says */
  fact: string;
  /** the card's own figure, where it carries one */
  figureLabel: string;
  figureText: string;
  /** the act's word — Peter's own, verbatim */
  act: string;
  /** the accounts the act writes to */
  customers: readonly string[];
  /** PEN minor units the advance road carries; 0 on a card that takes no such road */
  advanceMinor: number;
  /** what the act launches with */
  name: string;
  offer: CampaignOffer;
  message: string;
  /** the numbers behind the sentence, for the card's data attributes and its proof */
  facts: Readonly<Record<string, number>>;
};

const dayWords = (day: string): string => {
  const at = Date.parse(`${day}T12:00:00Z`);
  return Number.isFinite(at)
    ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    : '';
};

/** «Bar Manolo, Can Solé and Hotel Rec» — up to five names, then the rest as a count. */
export function accountWords(rows: readonly QuietAccount[], named = QUIET_NAMED): string {
  const names = rows.slice(0, named).map(row => row.name);
  const rest = rows.length - names.length;
  const listed = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
  return rest > 0 ? `${listed} and ${rest} more` : listed;
}

/** THE THREE RECOMMENDED CAMPAIGNS, computed from this workspace's own book (§249, brief B).
 *
 *  Every sentence a card states is built here, from the same numbers the card's data attributes
 *  carry, so the drive reads back exactly what the model said. `money` is the workspace's own
 *  formatter; the reading itself is currency-blind. */
export function recommendationsOf(input: {
  sales: readonly CampaignSale[];
  products: readonly { name: string }[];
  accounts: readonly CampaignAccount[];
  invoices: readonly CampaignInvoice[];
  requests: readonly CampaignRequest[];
  receipts: readonly CampaignReceipt[];
  history: readonly AccountHistory[];
  today: string;
  asOf?: string;
  sampleAsOf?: string;
  market: Market;
  money: (minor: number) => string;
}): Recommendation[] {
  const { money } = input;
  const preBuy = preBuyReadingOf({ sales: input.sales, products: input.products, signals: priceSignalsOf(input.market), today: input.today });
  const quiet = quietAccountsOf({ sales: input.sales, accounts: input.accounts, history: input.history, today: input.today });
  const early = earlyPayShareOf({ invoices: input.invoices, requests: input.requests, receipts: input.receipts,asOf:input.asOf??`${input.today}T23:59:59-05:00`,sampleAsOf:input.sampleAsOf });
  const winBackOffer: CampaignOffer = { type: 'percent', value: WIN_BACK_PERCENT };
  const earlyOffer: CampaignOffer = { type: 'percent', value: EARLY_PAY_PERCENT };

  return [
    {
      key: 'pre-buy',
      heading: 'Pre-buy before the price rise',
      fact: preBuy
        ? `${preBuy.product} · ${money(preBuy.weeklyMinor)} a week in your orders · ${preBuy.risePercent} % more from ${dayWords(preBuy.risesOn)}`
        : 'Price signals for the lines you sell appear here with the week they land.',
      figureLabel: preBuy ? `${PRE_BUY_WEEKS} weeks at today's prices` : '',
      figureText: preBuy ? money(preBuy.preBuyMinor) : '',
      act: 'Get advance',
      customers: [],
      advanceMinor: preBuy?.preBuyMinor ?? 0,
      name: preBuy ? `Pre-buy ${preBuy.product}` : 'Pre-buy',
      offer: { type: 'percent', value: 0 },
      message: '',
      facts: preBuy
        ? { weeklyMinor: preBuy.weeklyMinor, risePercent: preBuy.risePercent, preBuyMinor: preBuy.preBuyMinor }
        : { weeklyMinor: 0, risePercent: 0, preBuyMinor: 0 },
    },
    {
      key: 'win-back',
      heading: 'Win back quiet customers',
      fact: quiet.length
        ? `${accountWords(quiet)} · last order ${quiet[0].days} days ago · ${WIN_BACK_PERCENT} % off with ${WIN_BACK_CODE}`
        : `Accounts quiet for ${QUIET_DAYS} days or more appear here with a ${WIN_BACK_PERCENT} % code to win them back.`,
      figureLabel: quiet.length ? `Quiet for ${QUIET_DAYS} days or more` : '',
      figureText: quiet.length ? `${quiet.length} ${quiet.length === 1 ? 'account' : 'accounts'}` : '',
      act: 'Send campaign',
      customers: quiet.map(row => row.customerId),
      advanceMinor: 0,
      name: 'Win back quiet customers',
      offer: winBackOffer,
      message: WIN_BACK_TEMPLATE,
      facts: { quiet: quiet.length, days: quiet[0]?.days ?? 0 },
    },
    {
      key: 'early-pay',
      heading: 'Early-pay discount',
      fact: early.requested
        ? `${early.sharePercent} % of invoices are paid within ${early.days} days · ${early.settled} of ${early.requested} requests`
        : `The share of invoices paid within ${EARLY_PAY_DAYS} days appears here as payment requests go out.`,
      figureLabel: early.requested ? `Paid within ${early.days} days` : '',
      figureText: early.requested ? `${early.sharePercent} %` : '',
      act: 'Create campaign',
      customers: input.accounts.map(row => row.id),
      advanceMinor: 0,
      name: 'Early-pay discount',
      offer: earlyOffer,
      message: EARLY_PAY_TEMPLATE,
      facts: { sharePercent: early.sharePercent, settled: early.settled, requested: early.requested },
    },
  ];
}

/* ── THE RECORD ───────────────────────────────────────────────────────────────────────────── */

export type CampaignSend = { customerId: string; at: string };

export type CampaignRecord = {
  id: string;
  name: string;
  kind: 'recommended' | 'custom';
  /** the accounts it was launched for, by cast id */
  customers: string[];
  offer: CampaignOffer;
  /** the template, with `{name}` and `{offer}` still in it — the words a person approved */
  message: string;
  /** the wall-clock instant a scheduled campaign is due; `null` on one already sent */
  scheduledFor: string | null;
  /** the largest discount this campaign may give away, in the workspace's minor units */
  budgetMinor: number | null;
  sends: CampaignSend[];
  createdAt: string;
};

export type CampaignBook = { version: 1; scope: string; campaigns: CampaignRecord[] };

export const campaignsKey = (scope: string): string => `${CAMPAIGNS_KEY_PREFIX}${scope}`;
export const emptyCampaignBook = (scope: string): CampaignBook => ({ version: 1, scope, campaigns: [] });

/** One id per launch, from the instant and the book's own length: unique, ordered and free of
 *  randomness, so a tool test and a drive read the same id for the same act. */
export const newCampaignId = (at: string, index: number): string =>
  `campaign-${at.replace(/\D/g, '').slice(0, 14)}-${index + 1}`;

const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

function parseOffer(raw: unknown): CampaignOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<CampaignOffer>;
  if (!OFFER_TYPES.includes(value.type as OfferType)) return null;
  if (!Number.isFinite(value.value) || (value.value as number) < 0 || (value.value as number) > 100_000_000) return null;
  return { type: value.type as OfferType, value: value.value as number };
}

/** One campaign, validated field by field. A damaged record reads as ABSENT rather than as a
 *  half-campaign, because a record nobody can trust must never send a message to a customer. */
function parseCampaign(raw: unknown): CampaignRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<CampaignRecord>;
  if (typeof value.id !== 'string' || !value.id || value.id.length > 120) return null;
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120) return null;
  if (value.kind !== 'recommended' && value.kind !== 'custom') return null;
  if (!Array.isArray(value.customers) || value.customers.length > 2000) return null;
  const customers = value.customers.filter((id): id is string => typeof id === 'string' && Boolean(id) && id.length <= 120);
  if (customers.length !== value.customers.length) return null;
  const offer = parseOffer(value.offer);
  if (!offer) return null;
  if (typeof value.message !== 'string' || value.message.length > 2000) return null;
  if (value.scheduledFor !== null && !instant(value.scheduledFor)) return null;
  const scheduledFor: string | null = value.scheduledFor;
  if (value.budgetMinor !== null && !(Number.isSafeInteger(value.budgetMinor) && (value.budgetMinor as number) >= 0)) return null;
  const budgetMinor: number | null = value.budgetMinor ?? null;
  if (!Array.isArray(value.sends) || value.sends.length > 2000) return null;
  const sends: CampaignSend[] = [];
  for (const row of value.sends) {
    const send = row as Partial<CampaignSend> | null;
    if (!send || typeof send.customerId !== 'string' || !send.customerId || !instant(send.at)) return null;
    sends.push({ customerId: send.customerId, at: send.at });
  }
  if (!instant(value.createdAt)) return null;
  return { id: value.id, name: value.name, kind: value.kind, customers, offer, message: value.message,
    scheduledFor, budgetMinor, sends, createdAt: value.createdAt };
}

/** Validate the stored book before restoring it; a damaged book starts empty. */
export function parseCampaigns(raw: unknown, scope: string): CampaignBook {
  if (!raw || typeof raw !== 'object') return emptyCampaignBook(scope);
  const value = raw as Partial<CampaignBook>;
  if (value.version !== 1 || value.scope !== scope || !Array.isArray(value.campaigns)) return emptyCampaignBook(scope);
  const campaigns: CampaignRecord[] = [];
  const seen = new Set<string>();
  for (const row of value.campaigns.slice(0, 200)) {
    const campaign = parseCampaign(row);
    if (campaign && !seen.has(campaign.id)) { seen.add(campaign.id); campaigns.push(campaign); }
  }
  return { version: 1, scope, campaigns };
}

/** The campaign the launch records, before a single message has gone. */
export function createCampaign(input: {
  id: string; name: string; kind: CampaignRecord['kind']; customers: readonly string[];
  offer: CampaignOffer; message: string; scheduledFor: string | null; budgetMinor: number | null; createdAt: string;
}): CampaignRecord {
  return { id: input.id, name: input.name.trim(), kind: input.kind, customers: [...input.customers],
    offer: input.offer, message: input.message, scheduledFor: input.scheduledFor,
    budgetMinor: input.budgetMinor, sends: [], createdAt: input.createdAt };
}

/** The messages landed. A campaign that has sent is finished scheduling, so its due instant goes. */
export const recordSends = (campaign: CampaignRecord, sends: readonly CampaignSend[]): CampaignRecord =>
  ({ ...campaign, sends: [...campaign.sends, ...sends], scheduledFor: sends.length ? null : campaign.scheduledFor });

export const putCampaign = (book: CampaignBook, campaign: CampaignRecord): CampaignBook => ({
  ...book,
  campaigns: book.campaigns.some(row => row.id === campaign.id)
    ? book.campaigns.map(row => (row.id === campaign.id ? campaign : row))
    : [...book.campaigns, campaign],
});

/** THE CAMPAIGNS WHOSE MOMENT HAS COME: scheduled, nothing sent yet, and the instant passed. The
 *  wall clock decides, because a person who set Thursday meant Thursday on their own device. */
export function dueCampaigns(campaigns: readonly CampaignRecord[], now: string): CampaignRecord[] {
  const at = Date.parse(now);
  if (!Number.isFinite(at)) return [];
  return campaigns
    .filter(row => row.sends.length === 0 && instant(row.scheduledFor) && Date.parse(row.scheduledFor as string) <= at)
    .sort((a, b) => Date.parse(a.scheduledFor as string) - Date.parse(b.scheduledFor as string) || a.id.localeCompare(b.id));
}

/** WHO ORDERED AFTER IT REACHED THEM. A redemption is an order on or after the day that account's
 *  message went out — the book's own answer to «did the campaign work», counted on the workspace
 *  calendar so the send's instant and the order's day are read in one zone. */
export function redemptionsOf(campaign: CampaignRecord, sales: readonly CampaignSale[]): string[] {
  const redeemed = new Set<string>();
  for (const send of campaign.sends) {
    const sentOn = cedarTodayId(new Date(send.at));
    for (const sale of sales) {
      if (!counts(sale) || sale.customer.id !== send.customerId || sale.day < sentOn) continue;
      redeemed.add(send.customerId);
      break;
    }
  }
  return [...redeemed].sort();
}

/** «Scheduled for 18 Sep» — what a pending row says instead of a send count. */
export const scheduleWords = (campaign: CampaignRecord): string =>
  campaign.scheduledFor ? `Scheduled for ${dayWords(cedarTodayId(new Date(campaign.scheduledFor)))}` : '';

/* ── THE STORE: ONE SCOPED KEY, ONE CACHE, ONE EMITTER ────────────────────────────────────── */

const cache = new Map<string, CampaignBook>();
const listeners = new Set<() => void>();

const emit = (): void => { listeners.forEach(listener => listener()); };

export const subscribeCampaigns = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** The book this scope holds, parsed defensively and held for the render that asks again. */
export function campaignsNow(scope: string): CampaignBook {
  const held = cache.get(scope);
  if (held) return held;
  let book = emptyCampaignBook(scope);
  try { book = parseCampaigns(JSON.parse(localStorage.getItem(campaignsKey(scope)) || 'null'), scope); }
  catch { /* A fresh book remains usable. */ }
  cache.set(scope, book);
  return book;
}

/** Save the book and tell every reader. A storage refusal keeps the session's own copy. */
export function saveCampaigns(book: CampaignBook): boolean {
  let stored = true;
  try { localStorage.setItem(campaignsKey(book.scope), JSON.stringify(book)); }
  catch { stored = false; }
  cache.set(book.scope, book);
  emit();
  return stored;
}

if (typeof window !== 'undefined') {
  /* Another tab wrote this book, or cleared storage entirely. */
  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith(CAMPAIGNS_KEY_PREFIX)) { cache.clear(); emit(); }
  });
  /* THE SHARED RESET CONTRACT (PRODUCT-SPEC «Reset»): the inventoried keys are cleared first, and
     this cache drops what it holds so the next read comes back to the seeded empty book. */
  window.addEventListener('rocoto:cedar-workspace-reset', event => {
    const scope = (event as CustomEvent<{ scope?: string }>).detail?.scope;
    if (scope) cache.delete(scope); else cache.clear();
    emit();
  });
}

/** THE ONE READER EVERY SURFACE TAKES. The act in the Sales header, the dialog's three tabs and
 *  the scheduled runner all subscribe here, so a campaign launched in the dialog is on the row
 *  behind it in the same frame — and a Reset Cedar empties all three at once. */
export function useCampaigns(scope: string): { book: CampaignBook; save: (book: CampaignBook) => boolean } {
  const snapshot = React.useCallback(() => campaignsNow(scope), [scope]);
  const book = React.useSyncExternalStore(subscribeCampaigns, snapshot, snapshot);
  return { book, save: saveCampaigns };
}
