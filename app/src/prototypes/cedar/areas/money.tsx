import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { ArrowLeft, ArrowUpRight, Search, Settings2 } from 'lucide-react';
import { useConfig } from '../config';
import { useDay } from '../day';
import { useGrants } from '../grants';
import { buildSales } from '../sale';
import { Page, usePanes, usePhone, useStacked, useWideColumn } from '../shell';
import type { AreaMeta } from '../shell/area';
import { InvoiceDetail, MoneyDate } from '../money-document';
import { useMoney } from '../money-store';
import { useBankCapability, useWalletCapability } from '../money-bank-api';
import { invoiceClock, documentNumber, isCollectible, formatMoney, formatInvoiceMoney, formatLedgerMoney, invoiceBalance, invoiceOverdueDays, invoiceStatusOf, statusWordsOf } from '../money-model';
import { moneyNow } from '../money-seed';
import { MoneySetup } from '../money-setup';
import { MoneyOverview } from '../money-overview';
import { MoneyDossier } from '../money-dossier';

export const meta: AreaMeta = { id: 'money', title: 'Money', owner: 'CEDAR-MONEY', panes: false };

function useMoneyRoute(): string[] {
  const [hash, setHash] = React.useState(() => window.location.hash);
  React.useEffect(() => {
    const read = () => setHash(window.location.hash);
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').map((part) => { try { return decodeURIComponent(part); } catch { return part; } });
}

function PaymentPreview({ scope, requestId }: { scope: string; requestId: string }) {
  const [, theme] = useStyletron();
  const money = useMoney(scope);
  /* THE SAME POSTURE THE INVOICE CARD READS (FEED-IA §246). A live money-recording control stood
     on this page with no gate at all and answered the press with an error string; the preview and
     the invoice detail now answer identically. */
  const bank = useBankCapability(scope);
  const collects = bank.posture === 'ready';
  /* A COLLECTOR MARK IS A CLAIM ABOUT AN ACCOUNT, exactly as the Prometeo mark is on the balance
     card (§246 review). This page showed the Yape and Plin logos and an account name typed into a
     local draft to the person being asked to pay, while `walletCapabilityOf` stood at `setup` and
     the Connections card read «Set up payments». Each mark now waits for its own collector and the
     account line comes from the provider; with neither answered, the page's own setup act stands. */
  const wallets = useWalletCapability(scope);
  const collectors = wallets.posture === 'ready';
  const request = money.state.requests.find((item) => item.id === requestId);
  const invoice = money.state.invoices.find((item) => item.id === request?.invoiceId);
  const [message, setMessage] = React.useState('');
  if (!request || !invoice) return <div style={{ padding: theme.sizing.scale800 }}><p style={theme.typography.ParagraphMedium}>Open a payment request from its invoice.</p><a href="#/money" style={{ color: theme.colors.contentPrimary }}>Open Money</a></div>;
  const balance = invoiceBalance(money.state, invoice.id);
  const paid = balance === 0;
  return <article data-testid="money-payment-preview" style={{ maxWidth: '560px', width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: theme.sizing.scale800, display: 'grid', gap: theme.sizing.scale800 }}>
    <a href={`#/money/invoices/${encodeURIComponent(invoice.id)}`} style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary }}>← Back to invoice</a>
    <header style={{ display: 'grid', gap: theme.sizing.scale400 }}><h1 style={{ ...theme.typography.HeadingMedium, margin: 0 }}>Payment request</h1><span style={theme.typography.ParagraphMedium}>{invoice.sellerName}</span><span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{documentNumber(invoice)} · {invoice.customerName}</span></header>
    <div><span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Current amount due</span><div data-testid="money-preview-current-balance" style={{ ...theme.typography.DisplaySmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatInvoiceMoney(invoice, balance)}</div>{request.amountMinor !== balance && <p data-testid="money-preview-original-amount" style={{ ...theme.typography.ParagraphSmall, marginBottom: 0, color: theme.colors.contentSecondary }}>Originally requested: {formatInvoiceMoney(invoice, request.amountMinor)}</p>}<p style={{ ...theme.typography.LabelMedium, marginBottom: 0 }}>{paid ? 'Receipt matched' : 'Outstanding on this invoice'}</p></div>
    {(collectors || collects) && <div data-testid="money-preview-collectors" style={{ display: 'flex', gap: theme.sizing.scale700, alignItems: 'center' }}>
      {collectors && wallets.yape && <img src="/connection-brands/yape.png" alt="Yape" width={36} height={36} style={{ objectFit: 'contain' }} />}
      {collectors && wallets.plin && <img src="/connection-brands/plin.png" alt="Plin" width={44} height={44} style={{ objectFit: 'contain' }} />}
      {collects && <span style={theme.typography.ParagraphSmall}>{bank.accountLabel}</span>}
    </div>}
    {collects ? <details style={{ borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale500 }}><summary style={{ ...theme.typography.LabelSmall, cursor: 'pointer', paddingBottom: theme.sizing.scale500 }}>Payment actions</summary><Button size={SIZE.compact} disabled={paid} data-testid="money-preview-simulate" onClick={async () => { const result = await money.simulateReceipt(invoice.id, balance); setMessage(result.ok ? 'Receipt matched to the invoice.' : result.error); }}>Record payment</Button>{message && <p role="status" style={theme.typography.ParagraphSmall}>{message}</p>}</details>
      : <a href="#/admin/connections/payments" data-testid="money-preview-set-up-payments" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale500, minHeight: 44, display: 'flex', alignItems: 'center' }}>Set up payments</a>}
  </article>;
}

export default function Money() {
  const [css, theme] = useStyletron();
  const { derived } = useConfig();
  const cast = derived.cast;
  const edits = useDay(cast.sector);
  const grants = useGrants();
  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants]);
  const money = useMoney(cast.sector);
  const { state } = money;
  const phone = usePhone();
  const stackedDesk = useStacked();
  const stacked = phone || stackedDesk;
  const route = useMoneyRoute();
  const setup = route[1] === 'setup';
  const preview = route[1] === 'request';
  const overview = !route[1] || route[1] === 'overview';
  const hubDetail = route[1] === 'transactions' || route[1] === 'credit' || (route[1] === 'payments' && !route[2]) ? route[1] as 'transactions' | 'credit' | 'payments' : null;
  /* TWO DOORS OF §249 (FEED-IA). `#/money/dossier` is the lender dossier page;
     `#/money/advance/<minor>` is the dashboard with Pay over time already open on that amount,
     the road the campaigns' pre-buy card, the cash-crunch line and the 72 h chase all take. */
  const dossier = route[1] === 'dossier';
  const advanceMinor = route[1] === 'advance' && /^\d{1,9}$/.test(route[2] ?? '') ? Number(route[2]) : undefined;
  usePanes(!phone && !setup && !preview && !overview && !hubDetail && !dossier && advanceMinor === undefined);
  useWideColumn(overview || Boolean(hubDetail) || dossier || advanceMinor !== undefined);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const tab = route[1] === 'payments' || route[1] === 'receipts' ? 'payments' : 'invoices';
  React.useEffect(() => { money.ensureExamples(sales); }, [cast.sector, sales]);
  React.useEffect(() => { setQuery(''); setFilter('all'); }, [cast.sector, tab]);
  const search = query.toLocaleLowerCase().trim();
  const invoices = state.invoices.filter((invoice) => {
    const status = invoiceStatusOf(state, invoice.id, invoiceClock(invoice, moneyNow(state)));
    return (!search || `${documentNumber(invoice)} ${invoice.customerName} ${invoice.customerRuc} ${invoice.saleNumber}`.toLocaleLowerCase().includes(search))
      && (filter === 'all' || (filter === 'outstanding' ? invoiceBalance(state, invoice.id) > 0 : status === filter));
  });
  const receipts = state.receipts.filter((receipt) => {
    const invoice = state.invoices.find((item) => item.id === receipt.invoiceId);
    return (!search || `${receipt.reference} ${receipt.method} ${invoice ? documentNumber(invoice) : ''} ${invoice?.customerName ?? ''}`.toLocaleLowerCase().includes(search))
      && (filter === 'all' || receipt.status === filter);
  });
  const selectedId = route[2] && (route[1] === 'invoices' || route[1] === 'payments' || route[1] === 'receipts') ? route[2] : (!stacked ? (tab === 'invoices' ? invoices[0]?.id : receipts[0]?.invoiceId) : undefined);
  const selected = state.invoices.find((invoice) => invoice.id === selectedId);
  const outstanding = state.invoices.filter((invoice) => isCollectible(invoice)).reduce((sum, invoice) => sum + invoiceBalance(state, invoice.id), 0);
  const collected = state.receipts.filter((receipt) => receipt.status === 'matched').reduce((sum, receipt) => sum + receipt.amountMinor, 0);
  const review = state.receipts.filter((receipt) => receipt.status === 'review').length;
  const open = (id: string) => { window.location.hash = `#/money/${tab}/${encodeURIComponent(id)}`; };
  const changeTab = (next: 'invoices' | 'payments') => { setFilter('all'); window.location.hash = `#/money/${next}`; };
  const rowClass = (picked: boolean) => css({ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale500, textAlign: 'left', paddingTop: theme.sizing.scale600, paddingBottom: theme.sizing.scale600, paddingLeft: theme.sizing.scale600, paddingRight: theme.sizing.scale600, color: theme.colors.contentPrimary, backgroundColor: picked ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary, border: 0, borderBottom: `1px solid ${theme.colors.borderOpaque}`, cursor: 'pointer', ':hover': { backgroundColor: theme.colors.backgroundSecondary }, ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' } });
  const secondary: React.CSSProperties = { ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary };

  if (setup) {
    const kind = route[2] === 'payments' || route[2] === 'invoicing' ? route[2] : 'overview';
    return <MoneySetup kind={kind} presentation="page" onClose={() => { window.location.hash = '#/money'; }} />;
  }
  if (preview) return <Page title="Money"><PaymentPreview scope={cast.sector} requestId={route[2] ?? ''} /></Page>;
  if (hubDetail) return <Page title="Money"><MoneyOverview scope={cast.sector} sales={sales} view={hubDetail} /></Page>;
  if (dossier) return <Page title="Money"><MoneyDossier scope={cast.sector} sales={sales} /></Page>;
  if (advanceMinor !== undefined) return <Page title="Money"><MoneyOverview scope={cast.sector} sales={sales} advanceMinor={advanceMinor} /></Page>;
  if (overview) return <Page title="Money"><MoneyOverview scope={cast.sector} sales={sales} /></Page>;

  return <Page title="Money" fill>
    <div data-testid="money-workspace" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, minWidth: 0 }}>
      {(!stacked || !selected) && <header style={{ padding: theme.sizing.scale600, display: 'grid', gap: theme.sizing.scale600, borderBottom: `1px solid ${theme.colors.borderOpaque}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300 }}>
          <div style={{ display: 'flex', gap: theme.sizing.scale300, minWidth: 0 }}><Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Money overview" onClick={() => { window.location.hash = '#/money'; }}><ArrowLeft size={17} aria-hidden /></Button><div role="tablist" aria-label="Money views" style={{ display: 'flex', gap: theme.sizing.scale300 }}>{(['invoices', 'payments'] as const).map((value) => <Button key={value} role="tab" aria-selected={tab === value} aria-controls="money-records" id={`money-tab-${value}`} kind={tab === value ? KIND.primary : KIND.tertiary} size={SIZE.compact} onClick={() => changeTab(value)} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const next = value === 'invoices' ? 'payments' : 'invoices'; changeTab(next); document.getElementById(`money-tab-${next}`)?.focus(); } }} data-testid={`money-tab-${value}`}>{value === 'invoices' ? 'Invoices' : 'Payments'}</Button>)}</div></div>
          <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Money connections" onClick={() => { window.location.hash = '#/money/setup'; }} data-testid="money-setup"><Settings2 size={18} aria-hidden />{!phone && <>&nbsp; Connections</>}</Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : '1fr 1fr auto', gap: theme.sizing.scale500 }}>
          <div><div style={secondary}>Outstanding</div><span data-testid="money-total-outstanding" style={{ ...theme.typography.LabelLarge, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatLedgerMoney(state, outstanding)}</span></div>
          <div><div style={secondary}>Collected</div><span data-testid="money-total-collected" style={{ ...theme.typography.LabelLarge, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatLedgerMoney(state, collected)}</span></div>
          <div><div style={secondary}>Needs review</div><span data-testid="money-total-review" style={theme.typography.LabelLarge}>{review}</span></div>
        </div>
        <div style={{ display: 'flex', gap: theme.sizing.scale400, minWidth: 0 }}>
          <Input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={tab === 'invoices' ? 'Search invoices or customers' : 'Search receipts or customers'} aria-label="Search Money" startEnhancer={<Search size={17} aria-hidden />} size="compact" clearable overrides={{ Input: { props: { 'data-testid': 'money-search' } } }} />
          <select aria-label="Payment status" value={filter} onChange={(event) => setFilter(event.currentTarget.value)} data-testid="money-filter" style={{ ...theme.typography.LabelSmall, minWidth: 128, maxWidth: '42%', color: theme.colors.contentPrimary, background: theme.colors.backgroundPrimary, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, padding: theme.sizing.scale300 }}>
            <option value="all">All statuses</option>{tab === 'invoices' ? <><option value="outstanding">Outstanding</option>{(['overdue', 'due', 'requested', 'part-paid', 'paid'] as const).map((status) => <option key={status} value={status}>{statusWordsOf(status)}</option>)}</> : <><option value="matched">Matched</option><option value="review">Needs review</option></>}
          </select>
        </div>
      </header>}
      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, minWidth: 0 }}>
        {(!stacked || !selected) && <section id="money-records" role="tabpanel" aria-labelledby={`money-tab-${tab}`} style={{ flex: selected && !stacked ? '1 1 46%' : '1 1 auto', minWidth: 0, overflowY: phone ? 'visible' : 'auto', borderRight: selected && !stacked ? `1px solid ${theme.colors.borderOpaque}` : undefined }}>
          <div style={{ ...secondary, padding: `${theme.sizing.scale400} ${theme.sizing.scale600}`, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>{tab === 'invoices' ? `${invoices.length} invoices` : `${receipts.length} payments`}</div>
          {tab === 'invoices' ? invoices.map((invoice) => <button key={invoice.id} type="button" className={rowClass(selected?.id === invoice.id)} onClick={() => open(invoice.id)} data-testid="money-invoice-row" data-invoice-id={invoice.id} aria-label={`Open invoice ${documentNumber(invoice)} for ${invoice.customerName}`}>
            <span style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}><span style={{ ...theme.typography.LabelMedium, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{invoice.customerName}</span><span style={secondary}>{documentNumber(invoice)} · Due <MoneyDate value={invoice.dueAt} /></span></span>
            <span style={{ display: 'grid', gap: theme.sizing.scale200, textAlign: 'right' }}><span style={{ ...theme.typography.LabelMedium, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatInvoiceMoney(invoice)}</span><span style={secondary}>{invoiceOverdueDays(state, invoice.id, invoiceClock(invoice, moneyNow(state))) > 0 ? `${statusWordsOf('overdue')} · ${invoiceOverdueDays(state, invoice.id, invoiceClock(invoice, moneyNow(state)))}d` : statusWordsOf(invoiceStatusOf(state, invoice.id, invoiceClock(invoice, moneyNow(state))))}</span></span>
          </button>) : receipts.map((receipt) => { const invoice = state.invoices.find((item) => item.id === receipt.invoiceId); return <button key={receipt.id} type="button" className={rowClass(selected?.id === invoice?.id)} onClick={() => open(receipt.invoiceId)} data-testid="money-payment-row" aria-label={`Open payment for ${invoice ? documentNumber(invoice) : receipt.invoiceId}`}>
            <span style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}><span style={{ ...theme.typography.LabelMedium, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{invoice?.customerName ?? 'Receipt for review'}</span><span style={secondary}>{receipt.method === 'yape' ? 'Yape' : receipt.method === 'plin' ? 'Plin' : receipt.method === 'cash' ? 'Cash' : 'Bank transfer'} · <MoneyDate value={receipt.at} /></span><span style={{ ...secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{receipt.reference}</span></span>
            <span style={{ display: 'grid', gap: theme.sizing.scale200, textAlign: 'right' }}><span style={{ ...theme.typography.LabelMedium, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{invoice?.origin === 'demo' && receipt.source === 'demo-bank' ? formatInvoiceMoney(invoice, receipt.amountMinor) : formatMoney(receipt.amountMinor, receipt.currency)}</span><span style={secondary}>{receipt.status === 'review' ? 'Needs review' : receipt.source === 'manual' ? 'Recorded manually' : receipt.source === 'prometeo' ? 'Verified · Prometeo' : 'Matched'}</span></span>
          </button>; })}
          {(tab === 'invoices' ? invoices.length === 0 : receipts.length === 0) && <div style={{ padding: theme.sizing.scale800, display: 'grid', gap: theme.sizing.scale500 }}><p style={{ ...theme.typography.ParagraphMedium, margin: 0 }}>{search || filter !== 'all' ? 'Change the search or status to show more records.' : tab === 'invoices' ? 'Create an invoice from a Delivery Note.' : 'Recorded receipts appear here.'}</p><a href="#/sales" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary }}>Open Delivery Notes <ArrowUpRight size={14} aria-hidden /></a></div>}
        </section>}
        {selected && <section aria-label="Invoice detail" style={{ flex: stacked ? '1 1 auto' : '1 1 54%', minWidth: 0, overflowY: phone ? 'visible' : 'auto' }}>
          {stacked && <div style={{ padding: theme.sizing.scale400, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}><Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => { window.location.hash = `#/money/${tab}`; }} data-testid="money-detail-back"><ArrowLeft size={18} aria-hidden />&nbsp; {tab === 'invoices' ? 'Invoices' : 'Payments'}</Button></div>}
          <InvoiceDetail key={selected.id} scope={cast.sector} invoiceId={selected.id} />
        </section>}
      </div>
    </div>
  </Page>;
}
