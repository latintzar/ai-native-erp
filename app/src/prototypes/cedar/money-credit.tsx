import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Checkbox, STYLE_TYPE } from 'baseui/checkbox';
import { ArrowUpRight, PhoneCall } from 'lucide-react';
import { useMoney, moneyStateNow } from './money-store';
import { unpaidOrders, last30DaysReceipts, receiptEffectiveAt, type UnpaidOrder, requestForInvoice, formatMoney, peruDate, invoiceClock, documentNumber, isCollectible, formatInvoiceMoney, formatLedgerMoney, invoiceBalance, invoiceOverdueDays, invoiceStatusOf, mostUrgentStatus, statusWordsOf, type Invoice, type MoneyState, type MoneyStatus, collectionWordOf } from './money-model';
import { moneyNow } from './money-seed';
import { PaymentLinkActions } from './payment-link-actions';
import { PaymentSettings } from './payment-settings';
import { paymentHoldOf, paymentReminderAt } from './payment-lifecycle';
import { buildSales } from './sale';
import { useGrants } from './grants';
import { useConfig } from './config';
import { nowOf, useDay } from './day';
import { replyHour, useThreads } from './shell/threads';
import { CHASE_HOURS, chaseFeeDate, chaseFeeMinor, chaseKey, lastChaseBeforeReceipt, chaseMessageOf, chaseRecordOf, chaseStatusWords, chaseStepOf, chasedWords, dueChases, putChase, readChase, setAuto, writeChase, type ChaseBook, type ChaseEvery, type ChaseRecord, type ChaseStep } from './chase';
import { ChaseDialog, chaseChannelOf, chaseLinkFor, sendChase } from './chase-dialog';
import type { AccountChannel } from './reply-channel';

/* NOTHING IS FUTURE (FEED-IA §247.8, «also remove future connotation. nothing is future»). A pill
   reading «Future» trailed in this card head, on the working-capital card, on the dashboard's
   customer-credit card and on the customer sheet's Credit block, and it told a reader that a
   working surface was a preview. Customer credit is a feature of this product: it reads the
   invoices the workspace already holds. What gates working capital is the bank connection, and
   the bank posture says so in its own words (MONEY-SPEC «Working capital and customer credit»). */

/* ── UNPAID ORDERS, ONE CARD EACH (FEED-IA §249) ──────────────────────────────────────────────
 * «Money → Customer credit is the list of unpaid orders, one card each … a primary Chase now …
 *  an Auto-chase switch with its own timer … and the card stating "Chased 09:41 · next in 23 h".»
 *
 * The page kept its name and changed its subject: it used to rank CUSTOMERS by what they owe,
 * and it now lists the ORDERS that are unpaid, because a chase is sent about one order and the
 * message names that order's number and amount. The ranking survives as the two sorts — nearest
 * deadline, biggest owed — applied to the orders themselves, and the customer's own totals still
 * stand on the customer sheet's Credit block below.
 */

export type CreditSort = 'deadline' | 'amount';
type CustomerBalance = { customerId: string; name: string; amountMinor: number; dueAt: string; invoices: Invoice[] };

export function customerBalances(state: MoneyState): CustomerBalance[] {
  const customers = new Map<string, CustomerBalance>();
  for (const invoice of state.invoices) {
    if (!isCollectible(invoice) || invoice.currency !== 'PEN' || !invoice.customerId) continue;
    const amountMinor = invoiceBalance(state, invoice.id);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) continue;
    const current = customers.get(invoice.customerId);
    if (current) {
      current.amountMinor += amountMinor;
      current.dueAt = current.dueAt < invoice.dueAt ? current.dueAt : invoice.dueAt;
      current.invoices.push(invoice);
    } else customers.set(invoice.customerId, { customerId: invoice.customerId, name: invoice.customerName,
      amountMinor, dueAt: invoice.dueAt, invoices: [invoice] });
  }
  return [...customers.values()];
}

/* ── THE ORDER'S OWN THREE WORDS (FEED-IA §249: «state Unpaid / Part paid / Paid») ────────────
 * The one Money table still names every state; this card reads it through `statusWordsOf` for
 * «Part paid», «Payment link sent» and «Paid». What §249 adds is the collection reading of the
 * two states a person chases: an order that is due and an order that is late are both UNPAID to
 * the merchant, and the lateness is already printed beside it as «5 days overdue». So the badge
 * carries the fact a chase acts on, and the line under it carries the deadline. */
export const unpaidWordOf = (status: MoneyStatus): string => collectionWordOf(status);

/* ── ONE VOCABULARY ON BOTH SIDES OF THE LEDGER (FEED-IA §247.6) ──────────────────────────────
 * A customer-credit row used to write its own words — «3 days overdue» here, «Overdue · 3d» on
 * the invoice list, «Due 11 Oct» with no word for a link already sent — so the same invoice read
 * three ways. Every word below comes from `statusWordsOf`, the table in money-model that the
 * repayment timeline reads too. */
export function creditStatusOf(state: MoneyState, invoice: Invoice) {
  const at = invoiceClock(invoice, moneyNow(state));
  return invoiceStatusOf(state, invoice.id, at);
}
export function creditLine(state: MoneyState, invoice: Invoice): string {
  const status = creditStatusOf(state, invoice);
  const overdue = invoiceOverdueDays(state, invoice.id, invoiceClock(invoice, moneyNow(state)));
  if (status === 'overdue') return `${statusWordsOf(status)} · ${overdue}d`;
  /* «Payment link sent» names the DEADLINE it was sent about, so the date beside it can never be
     read as the day the link went out (lead review, 11 September). */
  if (status === 'requested') return `${statusWordsOf(status)} · due ${creditDate(invoice.dueAt)}`;
  return `${statusWordsOf(status)} · ${creditDate(invoice.dueAt)}`;
}

export function creditDate(value: string): string {
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(at) : 'Date to confirm';
}

/** «Due 17 Sep» while the day stands, «5 days overdue» once it has passed. */
export const dueWordsOf = (row: UnpaidOrder): string =>
  row.overdueDays > 0 ? `${row.overdueDays} ${row.overdueDays === 1 ? 'day' : 'days'} overdue` : `Due ${creditDate(row.invoice.dueAt)}`;

/** The chase book for this workspace, kept in step with storage and the shared reset contract. */
function useChaseBook(scope: string): [ChaseBook, (next: ChaseBook) => void] {
  const [book, setBook] = React.useState<ChaseBook>(() => readChase(scope));
  React.useEffect(() => {
    setBook(readChase(scope));
    const sync = (event: StorageEvent) => { if (event.key === null || event.key === chaseKey(scope)) setBook(readChase(scope)); };
    // The shared reset contract clears this key in the same tab, where no storage event fires.
    const reset = () => setBook(readChase(scope));
    window.addEventListener('storage', sync);
    window.addEventListener('rocoto:chase-changed', reset);
    window.addEventListener('rocoto:cedar-workspace-reset', reset);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('rocoto:chase-changed', reset); window.removeEventListener('rocoto:cedar-workspace-reset', reset); };
  }, [scope]);
  const save = React.useCallback((next: ChaseBook) => { writeChase(next); setBook(next); }, []);
  return [book, save];
}

export function CustomerCredit({ customerId, scope }: { customerId: string; scope: string }) {
  const [css, theme] = useStyletron();
  const { state } = useMoney(scope);
  const [book] = useChaseBook(scope);
  const now = new Date().toISOString();
  const balance = customerBalances(state).find(item => item.customerId === customerId);
  return <section data-testid="customer-credit" style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.sizing.scale400 }}>
      <h3 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>Credit</h3>
      <strong data-testid="customer-credit-total" style={{ ...theme.typography.HeadingSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatLedgerMoney(state, balance?.amountMinor ?? 0)}</strong>
    </div>
    <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 }}>Outstanding balance</p>
    {balance ? balance.invoices.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map(invoice => {
      const chased = chasedWords(chaseRecordOf(book, invoice.id).sends.slice(-1)[0]?.at ?? null, now);
      return <a key={invoice.id}
      href={`#/money/invoices/${encodeURIComponent(invoice.id)}`} data-testid={`customer-credit-invoice-${invoice.id}`}
      className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.sizing.scale500,
        paddingTop: theme.sizing.scale500, paddingBottom: theme.sizing.scale500, color: theme.colors.contentPrimary,
        borderTop: `1px solid ${theme.colors.borderOpaque}`, textDecoration: 'none', minHeight: '48px',
        ':hover': { backgroundColor: theme.colors.backgroundSecondary }, ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '2px' } })}>
      <span style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}><span style={theme.typography.LabelMedium}>{documentNumber(invoice)}</span>
        <span data-status={creditStatusOf(state, invoice)} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{creditLine(state, invoice)}</span>
        {chased && <span data-testid={`customer-credit-chased-${invoice.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{chased}</span>}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, ...theme.typography.LabelMedium, whiteSpace: 'nowrap' }}>
        {formatInvoiceMoney(invoice, invoiceBalance(state, invoice.id))}<ArrowUpRight size={16} aria-hidden /></span>
    </a>; }) : <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 }}>Customer credit appears here with outstanding invoices.</p>}
  </section>;
}

function readSort(scope: string): CreditSort {
  try { return localStorage.getItem(`rocoto-cedar-finance-credit-sort-v1:${scope}`) === 'amount' ? 'amount' : 'deadline'; }
  catch { return 'deadline'; }
}

/** How often the runner looks, and the boundaries it also looks on — the phone-runtime pattern. */


export function CreditOverview({ scope, title }: { scope: string; title?: string }) {
  const [css, theme] = useStyletron();
  const { state } = useMoney(scope);
  const { derived } = useConfig();
  const cast = derived.cast;
  const threads = useThreads(cast);
  const edits=useDay(cast.sector),grants=useGrants();
  const sales=React.useMemo(()=>buildSales(cast,edits),[cast,edits,grants]);
  const salesById=React.useMemo(()=>new Map(sales.map(sale=>[sale.id,sale])),[sales]);
  const [book, saveBook] = useChaseBook(scope);
  const [now, setNow] = React.useState(() => new Date().toISOString());
  const [open, setOpen] = React.useState<string | null>(null);
  const [view, setView] = React.useState<'unpaid' | 'paid'>('unpaid');
  const [sort, setSort] = React.useState<CreditSort>(() => readSort(scope));
  React.useEffect(() => {
    setSort(readSort(scope));
    const sync = (event: StorageEvent) => { if (event.key === null || event.key === `rocoto-cedar-finance-credit-sort-v1:${scope}`) setSort(readSort(scope)); };
    // The shared reset contract clears this key in the same tab, where no storage event fires.
    const reset = () => setSort(readSort(scope));
    window.addEventListener('storage', sync);
    window.addEventListener('rocoto:cedar-workspace-reset', reset);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('rocoto:cedar-workspace-reset', reset); };
  }, [scope]);
  const choose = (next: CreditSort) => {
    setSort(next);
    try { localStorage.setItem(`rocoto-cedar-finance-credit-sort-v1:${scope}`, next); } catch { /* The current view remains usable for this session. */ }
  };

  const paid = last30DaysReceipts(state, moneyNow(state));
  const rows = unpaidOrders(state, moneyNow(state)).sort((a, b) => (sort === 'amount' ? b.amountMinor - a.amountMinor : a.invoice.dueAt.localeCompare(b.invoice.dueAt))
    || a.invoice.customerName.localeCompare(b.invoice.customerName) || a.invoice.id.localeCompare(b.invoice.id));
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0);
  const channelOf = React.useCallback((customerId: string): AccountChannel =>
    cast.customers.find(customer => customer.id === customerId)?.channel ?? 'WhatsApp', [cast.customers]);

  /* The words a reminder carries, built from the invoice the card stands on. The fee is two per
     cent of what is still owed and it starts seven days out; both are computed here and both are
     stated in the message a person reads before it goes (`chase.ts`). */
  const textFor = React.useCallback((invoice: Invoice, step: ChaseStep, link: string, at: string): string => {
    const current = moneyStateNow(scope);
    const owed = invoiceBalance(current, invoice.id);
    return chaseMessageOf({ step, customerName: invoice.customerName, documentNumber: documentNumber(invoice),
      amountText: formatInvoiceMoney(invoice, owed), dueText: creditDate(invoice.dueAt), link,
      feeText: formatInvoiceMoney(invoice, chaseFeeMinor(owed)), feeDateText: creditDate(chaseFeeDate(at)) });
  }, [scope]);

  /* THE CONVERSATION'S OWN HOUR (shell/threads `replyHour`). A reminder is the newest thing
     anybody has said, so it takes the hour that says so, and the chats list orders it correctly. */
  const hourRef = React.useRef<() => string>(() => nowOf(cast));
  React.useEffect(() => { hourRef.current = () => replyHour(threads, nowOf(cast)); });

  React.useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date().toISOString()),30000);return()=>window.clearInterval(timer);},[]);

  const opened = rows.find(row => row.invoice.id === open);
  const card = css({ display: 'grid', gap: theme.sizing.scale500, minWidth: 0, padding: theme.sizing.scale700,
    border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400,
    backgroundColor: theme.colors.backgroundPrimary, '@media (max-width: 600px)': { padding: theme.sizing.scale600 } });
  const secondary: React.CSSProperties = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary };
  const touch = { BaseButton: { style: { minHeight: '44px' } } };

  return <section data-testid="money-credit" style={{ display: 'grid', gap: theme.sizing.scale600, minWidth: 0 }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: theme.sizing.scale500 }}>
      <div style={{ display: 'grid', gap: theme.sizing.scale200 }}>
        <h2 style={{ ...theme.typography.HeadingSmall, margin: 0 }}>{title ?? (view === 'unpaid' ? 'Unpaid orders' : 'Paid')}</h2>
        <span style={secondary}>{view === 'unpaid' ? 'Amounts owed by your customers' : 'Last 30 days'}</span></div>
      {view === 'unpaid' && <div role="group" aria-label="Sort unpaid orders" style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
        <Button size={SIZE.compact} kind={sort === 'deadline' ? KIND.secondary : KIND.tertiary} aria-pressed={sort === 'deadline'}
          data-testid="credit-sort-deadline" overrides={touch} onClick={() => choose('deadline')}>Nearest deadline</Button>
        <Button size={SIZE.compact} kind={sort === 'amount' ? KIND.secondary : KIND.tertiary} aria-pressed={sort === 'amount'}
          data-testid="credit-sort-amount" overrides={touch} onClick={() => choose('amount')}>Biggest owed</Button>
      </div>}
    </header>
    {title === 'Payments' && <a href="#/money/receipts" data-testid="payments-receipt-history" style={{ ...secondary,
      color: theme.colors.contentPrimary, minHeight: 44, display: 'flex', alignItems: 'center' }}>Receipt history</a>}
    <div role="group" aria-label="Collection records" style={{ display: 'flex', gap: theme.sizing.scale300 }}>
      <Button kind={view === 'unpaid' ? KIND.secondary : KIND.tertiary} aria-pressed={view === 'unpaid'}
        data-testid="credit-tab-unpaid" overrides={touch} onClick={() => setView('unpaid')}>Unpaid orders</Button>
      <Button kind={view === 'paid' ? KIND.secondary : KIND.tertiary} aria-pressed={view === 'paid'}
        data-testid="credit-tab-paid" overrides={touch} onClick={() => setView('paid')}>Paid</Button>
    </div>
    <PaymentSettings scope={scope}/>
    {view === 'unpaid' ? <>
    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'baseline', gap: theme.sizing.scale400 }}>
      <span style={secondary}>{rows.length} {rows.length === 1 ? 'unpaid order' : 'unpaid orders'}</span>
      <strong data-testid="credit-total" style={{ ...theme.typography.HeadingSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatLedgerMoney(state, total)}</strong>
    </div>
    <div style={{ display: 'grid', gap: theme.sizing.scale500 }}>
      {rows.map(row => {
        const invoice = row.invoice;
        const record = chaseRecordOf(book, invoice.id);
        const status = chaseStatusWords(record, now);
        const every = record.auto.everyHours;
        const link=requestForInvoice(state,invoice.id),sale=salesById.get(invoice.saleId);
        const held=paymentHoldOf(state,invoice,sale);
        const save = (next: ChaseRecord) => saveBook(putChase(readChase(scope), next));
        return <article key={invoice.id} className={card} data-testid={`unpaid-card-${invoice.id}`}
          data-status={row.status} data-step={chaseStepOf(record)} data-auto={record.auto.on ? 'on' : 'off'}
          data-every={every} data-amount-minor={row.amountMinor} data-due-at={invoice.dueAt}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-start', gap: theme.sizing.scale500 }}>
            <span style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
              <a href={`#/customers/${encodeURIComponent(invoice.customerId)}`} data-testid={`unpaid-customer-${invoice.id}`}
                className={css({ ...theme.typography.LabelLarge, color: theme.colors.contentPrimary, textDecoration: 'none',
                  overflowWrap: 'anywhere', ':hover': { textDecoration: 'underline' } })}>{invoice.customerName}</a>
              <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{documentNumber(invoice)} · {dueWordsOf(row)}</span>
            </span>
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: theme.sizing.scale600, marginLeft: 'auto' }}>
              <span style={{ display: 'grid', gap: theme.sizing.scale200, textAlign: 'right' }}>
                <strong style={{ ...theme.typography.HeadingXSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatInvoiceMoney(invoice, row.amountMinor)}</strong>
                <span data-testid={`unpaid-state-${invoice.id}`} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{invoice.disputed ? 'Disputed' : unpaidWordOf(row.status)}</span>
              </span>
              <Button kind={KIND.primary} disabled={!link?.sentAt||Boolean(held)} data-testid={`chase-now-${invoice.id}`} overrides={touch}
                onClick={() => setOpen(invoice.id)}>Chase now</Button>
            </span>
          </div>
          <PaymentLinkActions invoiceId={invoice.id} scope={scope} sale={sale}/>
          {record.flaggedAt && <div data-testid={`unpaid-flag-${invoice.id}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
            gap: theme.sizing.scale400, padding: theme.sizing.scale400, borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200, ...theme.typography.LabelSmall }}><PhoneCall size={16} aria-hidden />Needs a call</span>
            <a href={`#/money/advance/${row.amountMinor}`} data-testid={`unpaid-advance-${invoice.id}`}
              className={css({ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, minHeight: '44px',
                display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.sizing.scale200 })}>
              <span style={{ whiteSpace: 'nowrap' }}>Short {formatInvoiceMoney(invoice, row.amountMinor)}?</span>
              <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale100 }}>Pay over time<ArrowUpRight size={14} aria-hidden /></span></a>
          </div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale400,
            borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale500 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.sizing.scale500, minWidth: 0 }}>
              <Checkbox checked={record.auto.on} checkmarkType={STYLE_TYPE.toggle_round}
                disabled={!link?.sentAt||Boolean(held)} onChange={event => {const on=(event.target as HTMLInputElement).checked;save({...record,auto:{on,everyHours:24,nextAt:on?paymentReminderAt(link?.sentAt,record.sends.length):null}});}}
                overrides={{ Input: { props: { 'data-testid': `auto-chase-${invoice.id}` } }, Root: { style: { minHeight: '44px', alignItems: 'center' } } }}>Auto-chase</Checkbox>
              <span data-testid={`auto-chase-every-${invoice.id}`} data-every="24" style={secondary}>24 / 48 / 72 h after sending</span>
            </div>
            <span data-testid={`chase-status-${invoice.id}`} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{status || (link?.sentAt?'Reminders follow the first payment link':'Reminders start after the payment link')}</span>
          </div>
        </article>;
      })}
      {rows.length === 0 && <p style={{ ...theme.typography.ParagraphSmall, margin: 0, color: theme.colors.contentSecondary }}>Unpaid orders appear here with their customer and next deadline.</p>}
    </div>
    <div style={{ display: 'grid', gap: theme.sizing.scale500 }}>
      <h3 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>By customer</h3>
      <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, overflow: 'hidden', backgroundColor: theme.colors.backgroundPrimary }}>
        {customerBalances(state).sort((a, b) => (sort === 'amount' ? b.amountMinor - a.amountMinor : a.dueAt.localeCompare(b.dueAt))
          || a.name.localeCompare(b.name) || a.customerId.localeCompare(b.customerId)).map((item, index) => {
          const itemStatus = mostUrgentStatus(item.invoices.map(invoice => creditStatusOf(state, invoice)));
          return <a key={item.customerId} href={`#/customers/${encodeURIComponent(item.customerId)}`}
            data-testid={`credit-customer-${item.customerId}`} data-amount-minor={item.amountMinor} data-due-at={item.dueAt} data-status={itemStatus}
            className={css({ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) auto 16px', alignItems: 'center', gap: theme.sizing.scale400,
              padding: theme.sizing.scale600, minHeight: '76px', color: theme.colors.contentPrimary, textDecoration: 'none',
              borderTop: index === 0 ? undefined : `1px solid ${theme.colors.borderOpaque}`, ':hover': { backgroundColor: theme.colors.backgroundSecondary },
              ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' } })}>
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary }}>{index + 1}</span>
            <span style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}><span style={{ ...theme.typography.LabelMedium, overflowWrap: 'anywhere' }}>{item.name}</span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{statusWordsOf(itemStatus)} · {creditDate(item.dueAt)} · {item.invoices.length} {item.invoices.length === 1 ? 'invoice' : 'invoices'}</span></span>
            <strong style={{ ...theme.typography.LabelMedium, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatLedgerMoney(state, item.amountMinor)}</strong><ArrowUpRight size={16} aria-hidden />
          </a>; })}
        {customerBalances(state).length === 0 && <p style={{ ...theme.typography.ParagraphSmall, padding: theme.sizing.scale700, margin: 0, color: theme.colors.contentSecondary }}>Outstanding invoices appear here with their customer and next deadline.</p>}
      </div>
    </div>
    </> : <section data-testid="money-paid" aria-label="Paid receipts" style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400 }}>
        <span style={secondary}>{paid.length} {paid.length === 1 ? 'receipt' : 'receipts'}</span>
        <strong style={{ ...theme.typography.HeadingSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatLedgerMoney(state, paid.reduce((sum, row) => sum + row.receipt.amountMinor, 0))}</strong>
      </div>
      {paid.map(({ invoice, receipt }) => {
        const chase = lastChaseBeforeReceipt(chaseRecordOf(book, invoice.id), receiptEffectiveAt(receipt));
        const method = { yape: 'Yape', plin: 'Plin', transfer: 'Transfer', cash: 'Cash' }[receipt.method];
        return <article key={receipt.id} className={card} data-testid={`paid-receipt-${receipt.id}`}
          data-receipt-id={receipt.id} data-invoice-id={invoice.id} data-amount-minor={receipt.amountMinor} data-method={receipt.method} data-at={receiptEffectiveAt(receipt)}>
          <a href={`#/money/invoices/${encodeURIComponent(invoice.id)}`} className={css({ display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale400, minHeight: '44px',
            textDecoration: 'none', color: theme.colors.contentPrimary, ':hover': { textDecoration: 'underline' },
            ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '2px' } })}>
            <span style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
              <strong style={{ ...theme.typography.LabelLarge, overflowWrap: 'anywhere' }}>{invoice.customerName}</strong>
              <span style={secondary}>{documentNumber(invoice)}</span>
            </span>
            <strong style={{ ...theme.typography.HeadingXSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{invoice.origin === 'demo' && receipt.source === 'demo-bank' ? formatInvoiceMoney(invoice, receipt.amountMinor) : formatMoney(receipt.amountMinor, receipt.currency)}</strong>
          </a>
          <span style={secondary}>{method} · <time dateTime={receiptEffectiveAt(receipt)}>{creditDate(peruDate(receiptEffectiveAt(receipt)))}</time></span>
          {chase && <details data-testid={`paid-chase-${receipt.id}`}>
            <summary className={css({ ...theme.typography.LabelSmall, minHeight: '44px', alignContent: 'center', cursor: 'pointer',
              ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '2px' } })}>
              Reminder {chase.step} · {chase.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} · {creditDate(peruDate(chase.at))}
            </summary>
            <p style={{ ...secondary, margin: 0, paddingTop: theme.sizing.scale300, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{chase.text}</p>
          </details>}
        </article>;
      })}
      {paid.length === 0 && <p style={{ ...secondary, margin: 0 }}>Receipts from the last 30 days appear here with their customer, amount and payment method.</p>}
    </section>}
    {opened && <ChaseDialog scope={scope} sector={cast.sector} invoice={opened.invoice} customerId={opened.invoice.customerId}
      accountChannel={channelOf(opened.invoice.customerId)} record={chaseRecordOf(book, opened.invoice.id)}
      everyHours={chaseRecordOf(book, opened.invoice.id).auto.everyHours}
      buildText={link => textFor(opened.invoice, chaseStepOf(chaseRecordOf(book, opened.invoice.id)), link, new Date().toISOString())}
      hourOf={() => hourRef.current()}
      onSent={record => { saveBook(putChase(readChase(scope), record)); setNow(new Date().toISOString()); }}
      onClose={() => setOpen(null)} />}
  </section>;
}
