import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, RefreshCw } from 'lucide-react';
import { useMoney } from './money-store';
import { documentNumber, formatMoney, invoiceBalance, isCollectible } from './money-model';
import { collectionGuard } from './money-api';
import { bankHistory, matchBankMovement, type BankActivity, type BankMovement } from './money-bank-api';
import { creditDate } from './money-credit';
import { FeatureArtwork } from './feature-artwork';
import type { MoneyPosture } from './money-bank-capability';

const reasonWords: Record<string, string> = {
  currency_mismatch: 'Review currency', amount_mismatch: 'Review amount', account_mismatch: 'Review receiving account',
  reference_mismatch: 'Review payment reference', review_required: 'Review payment reference',
  reference_not_found: 'Review payment reference', ambiguous_reference: 'Choose the matching request',
  outgoing_movement: 'Money out', debit: 'Money out', sample_evidence: 'Transaction to review',
  bank_account_reference_review_required: 'Review account and payment reference', bank_amount_review_required: 'Review amount',
  bank_authorization_required: 'Reconnect your bank', real_document_review_required: 'Payment activation pending',
  amount_exceeds_balance: 'Review amount',
};

export function BankIncomingChart({ activity, currency, asOf }: { activity: BankActivity; currency: string; asOf: string }) {
  const [, theme] = useStyletron();
  const title = React.useId(), description = React.useId();
  const points = bankHistory(activity, currency, asOf);
  const maximum = Math.max(100, ...points.map(point => point.amountMinor));
  const x = (index: number) => 16 + index * 520 / (points.length - 1);
  const y = (amount: number) => 148 - amount / maximum * 124;
  const coords = points.map((point, index) => `${x(index)},${y(point.amountMinor)}`).join(' ');
  const total = points.reduce((sum, point) => sum + point.amountMinor, 0);
  return <figure data-testid="money-bank-chart" style={{ margin: 0, display: 'grid', gap: theme.sizing.scale400 }}>
    <div style={{ display: 'grid', gap: theme.sizing.scale200 }}><strong data-testid="money-bank-incoming-total" data-amount-minor={total}
      style={{ ...theme.typography.HeadingMedium, whiteSpace: 'nowrap' }}>{formatMoney(total, currency)}</strong>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Last 14 days · {activity.mode === 'live' ? 'Bank transactions' : 'Prometeo'}</span></div>
    <svg viewBox="0 0 552 164" role="img" aria-labelledby={`${title} ${description}`} style={{ width: '100%', display: 'block' }}>
      <title id={title}>Incoming bank transfers</title><desc id={description}>Daily incoming {currency} transfers through {creditDate(asOf)}. Includes matched payments and transfers awaiting review.</desc>
      {[24, 86, 148].map(axis => <line key={axis} x1={16} x2={536} y1={axis} y2={axis} stroke={theme.colors.borderOpaque} />)}
      <polygon points={`16,148 ${coords} 536,148`} fill={theme.colors.backgroundSecondary} />
      <polyline data-testid="money-bank-history-line" data-amounts-minor={points.map(point => point.amountMinor).join(',')}
        points={coords} fill="none" stroke={theme.colors.contentPrimary} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => <circle key={point.at} cx={x(index)} cy={y(point.amountMinor)} r={3} fill={theme.colors.contentPrimary}>
        <title>{creditDate(point.at)}: {formatMoney(point.amountMinor, currency)}</title></circle>)}
    </svg>
    <figcaption style={{ display: 'flex', justifyContent: 'space-between', ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
      <span>{creditDate(points[0].at)}</span><span>{creditDate(points[points.length - 1].at)}</span>
    </figcaption>
  </figure>;
}

/* ONE PICTURE AND ONE ACT, INSTEAD OF A STATEMENT NOBODY'S ACCOUNT WROTE (FEED-IA §246).
 *
 * This card used to manufacture a bank statement out of the local receipt ledger whenever no bank
 * was connected: dated rows, amounts, references, an Account column, a «Review · N» filter and
 * expandable detail — a history the person's connection state never justified. It now answers a
 * non-ready posture exactly as the phone's dial dialog does: the feature object, one sentence and
 * one `Connect bank`. */
function BankSetupState({ posture }: { posture: MoneyPosture }) {
  const [, theme] = useStyletron();
  return <section data-testid="money-bank-activity" style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
    <h2 style={{ ...theme.typography.HeadingSmall, margin: 0 }}>Bank transactions</h2>
    <div data-testid="money-bank-setup-state" data-bank-posture={posture} style={{ display: 'grid', justifyItems: 'center',
      gap: theme.sizing.scale500, textAlign: 'center', padding: theme.sizing.scale800, borderRadius: theme.borders.radius400,
      border: `1px solid ${theme.colors.borderOpaque}`, backgroundColor: theme.colors.backgroundPrimary }}>
      <FeatureArtwork kind="money" size={184} />
      <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, margin: 0, maxWidth: 320 }}>Connect your bank with Prometeo to read your transactions.</p>
      <Button onClick={() => { window.location.hash = '#/admin/connections/payments'; }} data-testid="money-bank-open-setup">Connect bank</Button>
    </div>
  </section>;
}

export function BankActivityCard({ scope, activity, posture, loading, error, onRefresh }: {
  scope: string; activity: BankActivity | null; posture: MoneyPosture; loading: boolean; error: string; onRefresh: () => Promise<void>;
}) {
  const [css, theme] = useStyletron();
  const money = useMoney(scope);
  const connected = posture === 'ready';
  const [filter, setFilter] = React.useState<'all' | 'review'>('all');
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState(8);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');
  React.useEffect(() => { setExpanded(null); setBusy(null); setMessage(''); setLimit(8); }, [scope, activity?.ready, connected]);
  const rows: BankMovement[] = activity?.movements || [];
  const reviews = rows.filter(row => row.status === 'review' && row.credit_minor > 0).length;
  const filtered = rows.filter(row => filter === 'all' || (row.status === 'review' && row.credit_minor > 0));
  const secondary: React.CSSProperties = { ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary };
  const check = async (row: BankMovement, requestId: string, invoiceId: string) => {
    const current = collectionGuard(scope);
    setBusy(row.id); setMessage('');
    try {
      await matchBankMovement(scope, row.id, requestId); current();
      const result = await money.refreshRequest(invoiceId); current();
      if (!result.ok) throw new Error(result.error);
      await onRefresh(); current(); setMessage('Payment checked.');
    } catch (cause) { try { current(); setMessage(cause instanceof Error ? cause.message : 'Try checking this payment again.'); } catch { /* The next workspace owns its view. */ } }
    finally { try { current(); setBusy(null); } catch { /* Reset cleared the previous action. */ } }
  };
  if (!connected) return <BankSetupState posture={posture} />;
  return <section data-testid="money-bank-activity" style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.sizing.scale400 }}>
      <div style={{ display: 'grid', gap: theme.sizing.scale200 }}><h2 style={{ ...theme.typography.HeadingSmall, margin: 0 }}>Bank transactions</h2>
        <span style={secondary}>Prometeo</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300 }}>
        <Button kind={filter === 'all' ? KIND.secondary : KIND.tertiary} size={SIZE.compact} aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setLimit(8); }}>All</Button>
        <Button data-testid="money-bank-review-filter" kind={filter === 'review' ? KIND.secondary : KIND.tertiary} size={SIZE.compact} aria-pressed={filter === 'review'} onClick={() => { setFilter('review'); setLimit(8); }}>Review{reviews ? ` · ${reviews}` : ''}</Button>
        <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Refresh bank transactions" disabled={loading} onClick={() => { void onRefresh(); }}><RefreshCw size={16} aria-hidden /></Button>
      </div>
    </header>
    <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, overflow: 'hidden' }}>
      {filtered.slice(0, limit).map((row, index) => {
        const open = row.id === expanded;
        const invoice = money.state.invoices.find(item => item.id === row.invoice_id);
        const candidate = row.mode === 'live' && row.status === 'review' && row.debit_minor === 0 && row.credit_minor > 0
          ? money.state.invoices.filter(item => item.origin === 'cedar' && isCollectible(item) && item.number === row.reference
            && item.currency === row.currency && invoiceBalance(money.state, item.id) >= row.credit_minor)
            .flatMap(item => { const request = money.state.requests.find(link => link.invoiceId === item.id && link.remoteId); return request?.remoteId ? [{ invoice: item, requestId: request.remoteId }] : []; }) : [];
        const amount = row.credit_minor || -row.debit_minor;
        const detailId = `bank-transaction-${row.id}`;
        return <div key={row.id} style={{ borderTop: index ? `1px solid ${theme.colors.borderOpaque}` : undefined }}>
          <button type="button" data-testid="money-bank-transaction" data-movement-id={row.id} aria-expanded={open} aria-controls={detailId}
            onClick={() => { setExpanded(open ? null : row.id); setMessage(''); }} className={css({ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr) auto 16px',
              width: '100%', border: 0, backgroundColor: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, textAlign: 'left',
              padding: theme.sizing.scale600, gap: theme.sizing.scale400, alignItems: 'center', minHeight: '76px', cursor: 'pointer',
              ':hover': { backgroundColor: theme.colors.backgroundSecondary }, ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' } })}>
            {amount >= 0 ? <ArrowDownLeft size={18} aria-hidden /> : <ArrowUpRight size={18} aria-hidden />}
            <span style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}><span style={{ ...theme.typography.LabelMedium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invoice?.customerName || row.detail || row.reference || 'Bank transfer'}</span>
              <span style={secondary}>{creditDate(row.date)} · {row.debit_minor > 0 ? 'Money out' : row.status === 'matched' ? 'Matched' : 'Review'}</span></span>
            <strong style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{amount > 0 ? '+' : ''}{formatMoney(amount, row.currency)}</strong>
            <ChevronDown size={16} aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined }} />
          </button>
          {open && <div id={detailId} data-testid="money-bank-transaction-detail" style={{ display: 'grid', gap: theme.sizing.scale500, padding: theme.sizing.scale600, paddingTop: 0 }}>
            {row.detail && <p style={{ ...theme.typography.ParagraphSmall, margin: 0, overflowWrap: 'anywhere' }}>{row.detail}</p>}
            {row.status === 'review' && row.payer_name && <p style={{ ...theme.typography.ParagraphSmall, margin: 0, overflowWrap: 'anywhere' }}>Payer: {row.payer_name}</p>}
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: theme.sizing.scale300, ...secondary }}>
              {row.match_key === 'amount' ? <><dt>Matched by</dt><dd style={{ margin: 0, textAlign: 'right' }}>Exact amount</dd></>
                : <><dt>Reference</dt><dd style={{ margin: 0, textAlign: 'right', overflowWrap: 'anywhere' }}>{row.reference || 'Awaiting reference'}</dd></>}
              <dt>Account</dt><dd style={{ margin: 0, textAlign: 'right' }}>{row.account_mask}</dd>
              {row.mode === 'sandbox' && <><dt>Source</dt><dd style={{ margin: 0, textAlign: 'right' }}>Prometeo sandbox</dd></>}
              {row.allocated_minor > 0 && <><dt>Matched to request</dt><dd style={{ margin: 0, textAlign: 'right' }}>{formatMoney(row.allocated_minor, row.currency)}</dd></>}
            </dl>
            {row.status === 'review' && row.credit_minor > 0 && <p style={{ ...secondary, margin: 0 }}>{reasonWords[row.reason] || 'Review payment reference'}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.sizing.scale500 }}>
              {invoice && <a href={`#/money/invoices/${encodeURIComponent(invoice.id)}`} style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, minHeight: 44, display: 'flex', alignItems: 'center' }}>{documentNumber(invoice)} <ArrowUpRight size={16} aria-hidden /></a>}
              {row.document_id && <a href={`#/sales/${encodeURIComponent(row.document_id)}`} style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, minHeight: 44, display: 'flex', alignItems: 'center' }}>Delivery Note <ArrowUpRight size={16} aria-hidden /></a>}
              {candidate.length === 1 && <Button size={SIZE.compact} data-testid="money-bank-match" disabled={busy !== null} isLoading={busy === row.id}
                onClick={() => { void check(row, candidate[0].requestId, candidate[0].invoice.id); }}>Check payment</Button>}
            </div>
            {message && <p role="status" style={{ ...secondary, margin: 0 }}>{message}</p>}
          </div>}
        </div>;
      })}
      {filtered.length === 0 && <p role="status" style={{ ...theme.typography.ParagraphSmall, margin: 0, padding: theme.sizing.scale700, color: theme.colors.contentSecondary }}>{loading ? 'Loading transactions…' : filter === 'review' ? 'Payments are up to date.' : 'Bank transfers appear here.'}</p>}
      {filtered.length > limit && <div style={{ padding: theme.sizing.scale400 }}><Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setLimit(value => value + 20)}>Show more</Button></div>}
    </div>
    {error && <p role="status" style={{ ...secondary, margin: 0 }}>{error}</p>}
  </section>;
}
