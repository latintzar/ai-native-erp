/* Cedar's retained money scenario is also consumed by the shared testdata lifecycle.
 * Sale identity and prices come from buildSales; this file adds invoice/receipt events. */
import scenario from './fixtures/money-v1.json';
import {
  createOrderPaymentDocument, invoiceForSale, createRequest, issueInvoice, recordReceipt, recordRequestAction, receiptEffectiveAt,
  type InvoiceSale, type MoneyState, type Result, type Receipt,
} from './money-model';
import { cedarTodayId, relativeFixtureDay, relativeFixtureInstant, shiftCalendarId } from './scenario-clock';

export type MoneySourceSale = InvoiceSale & { day: string; at?: string; state?: string; stamps?: {deliver?:string}; customer: InvoiceSale['customer'] & {channel?:string} };
export const moneyScenario = scenario;

export function moneyWorkspace(scope: string, now?: Date) {
  const workspace = scenario.fixture.collections.workspaces.find(row => row.scope === scope);
  if (!workspace) throw new Error('Choose a sample workspace.');
  return { ...workspace, referenceAt: relativeFixtureInstant(workspace.referenceAt, now) };
}

const retainedMoneySeeds = (scope: string, now?: Date) => scenario.fixture.collections.invoiceSeeds
  .filter(row => row.scope === scope)
  .map(row => ({
    ...row,
    sourceDay: relativeFixtureDay(row.sourceDay, now),
    dueAt: relativeFixtureDay(row.dueAt, now),
    receiptAt: relativeFixtureInstant(row.receiptAt, now),
  }));

type MoneySeed = { scope: string; saleId: string; customerId: string; sourceDay: string; dueAt: string;
  paidBps: number; receiptAt: string; method: Receipt['method']; reference: string; disputed?: boolean };

/** Stable customer habits and invoice selection; amounts always come from the source sale. */
const ordinal = (id: string): number => [...id].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
const methodOf = (customerId: string): Receipt['method'] => {
  const seat = ordinal(customerId) % 20;
  return seat < 10 ? 'yape' : seat < 15 ? 'plin' : seat < 19 ? 'transfer' : 'cash';
};

export function moneySeeds(scope: string, now?: Date, sales: readonly MoneySourceSale[] = []): MoneySeed[] {
  const retained: MoneySeed[] = retainedMoneySeeds(scope, now).map(row => ({ ...row, method: methodOf(row.customerId) }));
  const today = cedarTodayId(now);
  const past = sales.filter(sale => /^d-(?:[2-9]|[1-9][0-9]+)-/.test(sale.id)
    && sale.day >= shiftCalendarId(today, -scenario.history.days) && sale.day <= shiftCalendarId(today, -2)
    && !sale.archived && !sale.messageOnly && sale.figure > 0 && sale.lines.length > 0)
    .sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
  const eligible = past.filter(sale => sale.state !== 'disputed' && sale.day >= shiftCalendarId(today, -37)
    && sale.day <= shiftCalendarId(today, -12))
    .sort((a, b) => ordinal(a.id) - ordinal(b.id) || a.id.localeCompare(b.id));
  const wantedLate = Math.round((past.length + retained.length) * scenario.history.lateBasisPoints / 10000);
  const aged = [37, 22, 12].flatMap(age => eligible.filter(sale => sale.day === shiftCalendarId(today, -age)).slice(0, 2));
  const late = new Set([...aged, ...eligible].map(sale => sale.id).filter((id, index, all) => all.indexOf(id) === index).slice(0, wantedLate));
  const partialEligible = past.filter(sale => sale.state !== 'disputed' && !late.has(sale.id)
    && sale.day >= shiftCalendarId(today, -30))
    .sort((a, b) => ordinal(a.id) - ordinal(b.id) || a.id.localeCompare(b.id));
  const wantedPartial = Math.round((past.length + retained.length) * scenario.history.partialBasisPoints / 10000);
  const partial = new Set(partialEligible.slice(0, wantedPartial).map(sale => sale.id));
  const historical = past.map((sale, index): MoneySeed => {
    const age = calendarDaysBetween(sale.day, today);
    const delay = Math.min(age, ordinal(sale.customer.id) % scenario.history.paymentDelayDays);
    const receiptDay = shiftCalendarId(sale.day, delay);
    const minute = ordinal(sale.id) % 180;
    const time = `${String(5 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00-05:00`;
    const disputed = sale.state === 'disputed';
    return { scope, saleId: sale.id, customerId: sale.customer.id, sourceDay: sale.day,
      dueAt: shiftCalendarId(sale.day, partial.has(sale.id) ? scenario.history.partialDueDays : 7),
      paidBps: disputed || late.has(sale.id) ? 0 : partial.has(sale.id) ? 5000 : 10000,
      receiptAt: `${receiptDay}T${time}`, method: methodOf(sale.customer.id),
      reference: `F001-${String(retained.length + index + 1).padStart(8, '0')}`, ...(disputed ? { disputed: true } : {}) };
  });
  return [...retained, ...historical];
}

/** THE SEED FOLLOWS THE CAST'S OWN CALENDAR (14 September 2026). The fixture's «yesterday» invoices
 *  name a customer and a relative day; the cast draws a Sunday at six percent of its load, so on a
 *  Monday the day the fixture asked for held none of these customers' sales and the sample refused
 *  to seed — `drive-cedar-money.py` and `test-money-seed.mjs` were red every Monday. The invoice
 *  stands on the customer's last delivery on or before the day the fixture asks for; the exact sale
 *  is taken when it exists, so every other weekday reads exactly as before. */
export function sourceSaleFor<T extends MoneySourceSale>(sales: readonly T[], customerId: string, wantedDay: string): T | undefined {
  return [...sales]
    .filter(sale => sale.customer.id === customerId && sale.day <= wantedDay)
    .sort((a, b) => b.day.localeCompare(a.day))[0];
}

/** How many calendar days `later` stands after `earlier` (both `YYYY-MM-DD`). */
export function calendarDaysBetween(earlier: string, later: string): number {
  return Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000);
}

/** Date-only values stay calendar dates; timestamps use the retained Peru sample clock. */
export function moneyDateAfter(scope: string, days: number): string {
  const date = new Date(`${moneyWorkspace(scope).referenceAt.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** User actions advance the sample clock by one second per event, preserving event order. */
export function moneyNow(state: MoneyState): string {
  const reference = moneyWorkspace(state.scope).referenceAt;
  const anchored = state.fixtureDay ? `${state.fixtureDay}${reference.slice(10)}` : reference;
  const arrivals = state.receipts.filter(row => row.receivedAt || row.source === 'prometeo')
    .map(row => Date.parse(receiptEffectiveAt(row))).filter(Number.isFinite);
  return new Date(Math.max(Date.parse(anchored) + state.events.length * 1000, ...arrivals)).toISOString();
}

/** A fixture may follow the calendar on reload while it is still exactly synthetic. Any operator,
 * fiscal or provider addition turns it into a retained record whose timestamps keep their origin. */
function legacyUntouchedFixture(state: MoneyState): boolean {
  const invoices = new Map(state.invoices.map(invoice => [invoice.id, invoice]));
  return state.examplesLoaded
    && state.invoices.every(invoice => invoice.origin === 'demo' && invoice.status === 'accepted' && !invoice.fiscal)
    && state.requests.length === state.invoices.length
    && state.requests.every(request => request.status === 'sent' && !request.copiedAt && !request.remoteId && !request.remotePending)
    && state.receipts.every(receipt => receipt.source === 'demo-bank' && receipt.status === 'matched'
      && receipt.reference === invoices.get(receipt.invoiceId)?.number)
    && state.events.length === state.invoices.length * 3 + state.receipts.length;
}

/** Native URLs, pending registration and unprepared fiscal projections are transport facts.
 * Merchant changes and actual receipt evidence remain in the fixture fingerprint. */
export function moneyFixtureSignature(state: MoneyState): string {
  const value = JSON.stringify({setup:state.setup,invoices:state.invoices.map(({fiscal,...invoice})=>({...invoice,
    ...(fiscal&&fiscal.phase!=='unprepared'?{fiscal}: {})})),
    requests:state.requests.map(({url:_url,remoteId:_id,remotePending:_pending,commercialFingerprint:_fingerprint,paymentQuote:_quote,amountMinor:_amount,dispatch,...row})=>({...row,
      ...(dispatch?{dispatch:{by:dispatch.by,reason:dispatch.reason,channel:dispatch.channel}}:{})})),receipts:state.receipts,events:state.events});
  let hash=2166136261;
  for(let index=0;index<value.length;index++)hash=Math.imul(hash^value.charCodeAt(index),16777619)>>>0;
  return hash.toString(16).padStart(8,'0');
}
export const isUntouchedMoneyFixture = (state: MoneyState): boolean => state.fixtureSignature
  ? state.fixtureSignature===moneyFixtureSignature(state) : legacyUntouchedFixture(state);

export function seedMoney(
  current: MoneyState, sales: MoneySourceSale[], origin: string, now?: Date,
): Result<undefined> {
  const fixtureDay = cedarTodayId(now);
  if (current.examplesLoaded || current.invoices.length) {
    if (!isUntouchedMoneyFixture(current) || (current.fixtureDay === fixtureDay && current.fixtureRevision === 2 && current.fixtureSignature)) {
      return { ok: true, state: current, value: undefined };
    }
    current = { ...current, examplesLoaded: false, fixtureDay: undefined, fixtureSignature: undefined,
      invoices: [], requests: [], receipts: [], events: [] };
  }
  const workspace = moneyWorkspace(current.scope, now);
  const seeds = moneySeeds(current.scope, now, sales);
  /* EXAMPLE RECORDS ARE FIXTURES; A CONNECTION CLAIM IS NOT (FEED-IA §247.2). Seeding writes the
     seller's business identity and the ledger, and leaves every connection posture exactly where
     the person left it — so a workspace that has answered no question claims no account. */
  let state: MoneyState = { ...current, setup: { ...current.setup, sellerName: workspace.houseName,
    ruc: '20123456789', invoiceSeries: 'F001' } };
  for (const row of seeds) {
    const exact = sales.find(candidate => candidate.id === row.saleId && candidate.customer.id === row.customerId && candidate.day === row.sourceDay);
    const sale = exact ?? sourceSaleFor(sales, row.customerId, row.sourceDay);
    if (!sale) return { ok: false, error: 'Restore the sample sales to load this money scenario.' };
    /* When the fixture's day holds no sale for this customer (a Sunday), the invoice is issued and
       its payment requested on the customer's last delivery before it; the due date and the receipt
       keep the fixture's own day — the customer paid yesterday for Saturday's delivery. */
    const issuedAt = `${sale.day}T04:00:00-05:00`;
    const receiptAt = row.receiptAt;
    const issued = issueInvoice(state, sale, { customerRuc: '20123456789', sourceCurrency: 'PEN',
      taxRate: 18, dueAt: row.dueAt }, issuedAt);
    if (!issued.ok) return issued;
    state = {...issued.state,invoices:issued.state.invoices.map(invoice=>invoice.id===issued.value.id?{...invoice,fixtureOwned:true,...(row.disputed?{disputed:true}:{})}:invoice)};
    const created = createRequest(state, issued.value.id, issuedAt, origin);
    if (!created.ok) return created;
    if (row.disputed) state=created.state;
    else {
      const deliveredAt=sale.stamps?.deliver?`${sale.day}T${sale.stamps.deliver}:00-05:00`:issuedAt;
      const early=row.paidBps>0&&Date.parse(row.receiptAt)<Date.parse(deliveredAt);
      const sent=recordRequestAction(created.state,created.value.id,'sent',early?issuedAt:deliveredAt,{by:'auto',reason:early?'early':'delivery',channel:sale.customer.channel==='email'?'email':'whatsapp',text:''},'sample');
      if(!sent.ok)return sent;
      state=sent.state;
    }
    if (row.paidBps > 0) {
      const paid = recordReceipt(state, { invoiceId: issued.value.id,
        amountMinor: Math.round(issued.value.amountMinor * row.paidBps / 10000), currency: 'PEN',
        method: row.method,
        source: 'demo-bank', reference: row.reference }, receiptAt);
      if (!paid.ok) return paid;
      state = paid.state;
    }
  }
  for(const sale of sales) {
    if(invoiceForSale(state,sale.id)||!sale.state||!['made','scheduled','sent','delivered','disputed','settled'].includes(sale.state)
      ||sale.archived||sale.messageOnly||!Number.isFinite(sale.figure)||sale.figure<=0)continue;
    const made=createOrderPaymentDocument(state,{...sale,state:sale.state},`${sale.day<fixtureDay?sale.day:fixtureDay}T04:00:00-05:00`,origin);
    if(!made.ok)continue;
    const disputed=sale.state==='disputed';
    state={...made.state,invoices:made.state.invoices.map(row=>row.id===made.value.id?{...row,fixtureOwned:true,
      ...(disputed?{disputed:true}: {})}:row)};
    const link=state.requests.find(row=>row.invoiceId===made.value.id);
    if(link&&sale.stamps?.deliver&&!disputed) {
      const sent=recordRequestAction(state,link.id,'sent',`${sale.day}T${sale.stamps.deliver}:00-05:00`,{by:'auto',reason:'delivery',channel:sale.customer.channel==='email'?'email':'whatsapp',text:''},'sample');
      if(sent.ok)state=sent.state;
    }
  }
  // Historical fixtures explain the account while preserving the person's setup choices: the
  // seller's own identity is seeded where they have yet to enter one, and every connection
  // posture is returned exactly as they left it.
  const complete: MoneyState = {
    ...state,
    setup: { ...current.setup,
      sellerName: current.setup.sellerName || workspace.houseName,
      ruc: current.setup.ruc || '20123456789',
      invoiceSeries: current.setup.invoiceSeries || 'F001' },
    examplesLoaded: true, fixtureDay, fixtureRevision: 2,
  };
  return {ok:true,state:{...complete,fixtureSignature:moneyFixtureSignature(complete)},value:undefined};
}
