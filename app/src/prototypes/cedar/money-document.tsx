import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { ArrowUpRight } from 'lucide-react';
import { OverlayCard } from '../../rocoto/overlay-card';
import { WorkflowContent, WORKFLOW_WIDTH, workflowCardOverrides, useWorkflowPlacement, useWorkflowViewport, type WorkflowDialogProps } from './workflow-dialog';
import { useMoney } from './money-store';
import { receiptEffectiveAt, documentNumber, invoiceClock, isCollectible, formatMoney, formatInvoiceMoney, invoiceDisplayCurrency, invoiceBalance, invoiceForSale, invoiceOverdueDays, invoiceStatusOf, peruDate, requestForInvoice, statusWordsOf, type Receipt, type FiscalState } from './money-model';
import { buildSales, type Sale } from './sale';
import { useDay } from './day';
import { useGrants } from './grants';
import { useConfig } from './config';
import { PaymentLinkActions } from './payment-link-actions';
import { moneyNow } from './money-seed';
import { useWorkspaceCapabilities } from './workspace-capabilities';

/* EVERY MONEY WORD FROM ONE TABLE (FEED-IA §247.6). A payment state is named in `money-model`'s
   `MONEY_STATUS_WORDS` and read through `statusWordsOf`, so an invoice row, a customer-credit row
   and a repayment instalment say one word for one fact. */
export const paymentWords: Record<'paid' | 'part-paid' | 'requested' | 'due' | 'overdue' | 'upcoming' | 'offered' | 'repaying' | 'repaid', string> = {
  paid: statusWordsOf('paid'), 'part-paid': statusWordsOf('part-paid'), requested: statusWordsOf('requested'),
  due: statusWordsOf('due'), overdue: statusWordsOf('overdue'), upcoming: statusWordsOf('upcoming'),
  offered: statusWordsOf('offered'), repaying: statusWordsOf('repaying'), repaid: statusWordsOf('repaid'),
};
/** The payment-request LINK's own five states, one map, and the sent one borrows the payment
 *  table's word so a request and the invoice it belongs to agree (PRODUCT-SPEC status vocabulary). */
export const requestWords = {
  unrequested: 'Preparing link', pending: 'Preparing link', ready: 'Ready to share',
  copied: 'Link copied', sent: statusWordsOf('requested'),
} as const;
/** The fiscal vocabulary, exactly one list. `unissued` is the state of a document NubeFact has yet
 *  to receive; it used to be two sentences on one condition, on one screen. */
const fiscalWords: Record<FiscalState['phase'] | 'unissued', string> = {
  unissued:'Awaiting issuance',
  unprepared:'Invoicing activation pending', 'awaiting-authorization':'Document review pending', authorized:'Ready after payment confirmation',
  submitting:'Submitting to NubeFact', 'query-required':'Check invoice acceptance', pending:'SUNAT response pending', accepted:'Accepted by SUNAT', rejected:'Invoice needs correction', voided:'Invoice voided',
};

export function FiscalActions({invoiceId,scope}:{invoiceId:string;scope:string}) {
  const [,theme]=useStyletron();
  const money=useMoney(scope),invoice=money.state.invoices.find(row=>row.id===invoiceId);
  const [busy,setBusy]=React.useState(false),[message,setMessage]=React.useState('');
  React.useEffect(()=>{setBusy(false);setMessage('');},[scope,invoiceId]);
  if (!invoice || invoice.origin!=='cedar') return null;
  const fiscal=invoice.fiscal;
  const act=async(query:boolean)=>{
    if(busy)return;setBusy(true);setMessage('');
    try {const result=await money.submitInvoice(invoiceId,query);if(!result.ok)setMessage(result.error);}
    finally {setBusy(false);}
  };
  return <section data-testid="money-fiscal" style={{display:'grid',gap:theme.sizing.scale400}}>
    <h3 style={{...theme.typography.LabelLarge,margin:0}}>Electronic invoice</h3>
    {/* THE WORD SAYS WHAT IT IS FOR A MERCHANT; THE PROVENANCE IS IN THE DATA (FEED-IA §251).
        «people dont need to know that» — the environment an account answered in is the drive's
        fact and the operator's, so it travels as `data-mode` rather than in the sentence. */}
    <span data-testid="money-fiscal-status" data-mode={fiscal?.mode ?? ''} style={theme.typography.ParagraphSmall}>{fiscalWords[fiscal ? fiscal.phase : 'unissued']}{fiscal?.mode?' · NubeFact':''}</span>
    {fiscal?.series&&fiscal.number&&<span style={{...theme.typography.ParagraphXSmall,color:theme.colors.contentSecondary}}>{fiscal.series}-{String(fiscal.number).padStart(8,'0')}</span>}
    {fiscal?.can_issue&&<Button size={SIZE.compact} isLoading={busy} onClick={()=>void act(false)} data-testid="money-issue-fiscal">Issue invoice with NubeFact</Button>}
    {fiscal?.can_query&&<Button size={SIZE.compact} kind={KIND.secondary} isLoading={busy} onClick={()=>void act(true)} data-testid="money-query-fiscal">Check invoice</Button>}
    {fiscal?.checked_at&&<span style={{...theme.typography.ParagraphXSmall,color:theme.colors.contentSecondary}}>Checked <MoneyDate value={fiscal.checked_at}/></span>}
    {message&&<p role="status" style={{...theme.typography.ParagraphSmall,margin:0}}>{message}</p>}
  </section>;
}

export function DeliveryNotePaymentBadge({ saleId }: { saleId: string }) {
  const [, theme] = useStyletron();
  const { config } = useConfig();
  const { state } = useMoney(config.cast);
  const capabilities = useWorkspaceCapabilities(config.cast);
  const invoice = invoiceForSale(state, saleId);
  if (!capabilities.money || !invoice) return null;
  const at = invoiceClock(invoice, moneyNow(state));
  const status = invoiceStatusOf(state, invoice.id, at);
  const overdue = invoiceOverdueDays(state, invoice.id, at);
  return <span data-testid={`delivery-payment-${saleId}`} data-payment-status={status} data-overdue-days={overdue}
    style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap',
      padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`, borderRadius: theme.borders.radius200,
      backgroundColor: theme.colors.backgroundSecondary }}>{overdue ? `${statusWordsOf('overdue')} · ${overdue}d` : statusWordsOf(status)}</span>;
}

function MoneyDialog({ title, ariaLabel, ...content }: WorkflowDialogProps) {
  const visualHeight = useWorkflowViewport(true);
  const placement = useWorkflowPlacement();
  // Delivery Note's phone surface and print dock sit at 13/14; this task must clear both.
  const overrides = { ...workflowCardOverrides({ visualHeight }), Root: { style: { zIndex: 16, overflow: 'hidden' } } };
  return <OverlayCard isOpen onClose={content.onClose} size={WORKFLOW_WIDTH} placement={placement} ariaLabel={ariaLabel ?? title} overrides={overrides}><WorkflowContent title={title} {...content} /></OverlayCard>;
}

export function MoneyDate({ value }: { value: string }) {
  const date = new Date(value);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return <time dateTime={value}>{Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(dateOnly ? { timeZone: 'UTC' } : {}) })}</time>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return <label style={{ display: 'grid', gap: theme.sizing.scale300, ...theme.typography.LabelSmall }}>{label}{children}</label>;
}

function ManualReceipt({invoiceId,scope}:{invoiceId:string;scope:string}) {
  const [,theme]=useStyletron(),money=useMoney(scope),invoice=money.state.invoices.find(row=>row.id===invoiceId);
  const [open,setOpen]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  const [amount,setAmount]=React.useState(''),[reference,setReference]=React.useState(''),[method,setMethod]=React.useState<Receipt['method']>('cash');
  const balance=invoiceBalance(money.state,invoiceId);
  if(!invoice||balance<=0)return null;
  const save=async()=>{
    if(busy)return;setBusy(true);
    try{const result=await money.recordReceipt({invoiceId,amountMinor:Math.round(Number(amount)*100),currency:'PEN',method,reference,source:'manual'});
      if(result.ok)setOpen(false);else setError(result.error);
    }finally{setBusy(false);}
  };
  return <>
    <Button kind={KIND.tertiary} size={SIZE.compact} overrides={{BaseButton:{style:{minHeight:'44px',justifySelf:'start'}}}}
      data-testid="money-record-payment" onClick={()=>{setAmount((balance/100).toFixed(2));setReference('');setError('');setOpen(true);}}>Record received payment</Button>
    {open&&<MoneyDialog title="Received payment" onClose={()=>setOpen(false)} testId="money-receipt-dialog"
      actions={<Button isLoading={busy} onClick={()=>void save()} data-testid="money-save-receipt">Save receipt</Button>}>
      <div style={{display:'grid',gap:theme.sizing.scale500}}>
        <p style={{...theme.typography.ParagraphSmall,margin:0}}>{invoice.customerName} · {invoice.number}<br/>Outstanding {formatInvoiceMoney(invoice,balance)}</p>
        <Field label="Amount received · PEN"><Input type="number" min={0.01} step={0.01} value={amount} onChange={event=>setAmount(event.currentTarget.value)} overrides={{Input:{props:{'data-testid':'money-receipt-amount'}}}}/></Field>
        <Field label="Payment method"><select value={method} onChange={event=>setMethod(event.target.value as Receipt['method'])} data-testid="money-receipt-method"
          style={{...theme.typography.ParagraphMedium,minHeight:44,padding:theme.sizing.scale400,color:theme.colors.contentPrimary,background:theme.colors.backgroundSecondary,border:`1px solid ${theme.colors.borderOpaque}`}}>
          <option value="cash">Cash</option><option value="transfer">Bank transfer</option><option value="yape">Yape</option><option value="plin">Plin</option>
        </select></Field>
        <Field label="Receipt reference"><Input value={reference} onChange={event=>setReference(event.currentTarget.value)} overrides={{Input:{props:{'data-testid':'money-receipt-reference'}}}}/></Field>
        <p style={{...theme.typography.ParagraphSmall,margin:0,color:theme.colors.contentSecondary}}>This records your confirmation of money received.</p>
        {error&&<p role="alert" style={{...theme.typography.ParagraphSmall,margin:0}}>{error}</p>}
      </div>
    </MoneyDialog>}
  </>;
}

export function MoneyHistory({ invoiceId, scope }: { invoiceId: string; scope: string }) {
  const [, theme] = useStyletron();
  const { state } = useMoney(scope);
  const invoice = state.invoices.find(item => item.id === invoiceId);
  const events = state.events.filter((event) => event.invoiceId === invoiceId && event.kind !== 'receipt').slice().reverse();
  const receipts = state.receipts.filter((receipt) => receipt.invoiceId === invoiceId).slice().reverse();
  return <section aria-label="Transaction history" data-testid="money-history" style={{ display: 'grid', gap: theme.sizing.scale400 }}>
    <h3 style={{ ...theme.typography.LabelMedium, margin: 0 }}>Transaction history</h3>
    <ManualReceipt invoiceId={invoiceId} scope={scope}/>
    {receipts.map((receipt) => <div key={receipt.id} data-testid="money-history-receipt" data-source={receipt.source} style={{ display: 'grid', gap: theme.sizing.scale200, paddingTop: theme.sizing.scale400, paddingBottom: theme.sizing.scale400, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale400, ...theme.typography.LabelSmall }}><span>{receipt.source === 'manual' ? 'Recorded by you' : receipt.source === 'prometeo' ? 'Verified by Prometeo' : 'Bank receipt'} · {receipt.method === 'yape' ? 'Yape' : receipt.method === 'plin' ? 'Plin' : receipt.method}</span><span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{invoice?.origin === 'demo' && receipt.source === 'demo-bank' ? formatInvoiceMoney(invoice, receipt.amountMinor) : formatMoney(receipt.amountMinor, receipt.currency)}</span></div>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{receipt.reference} · <MoneyDate value={receiptEffectiveAt(receipt)} /></span>
      {(receipt.roundingMinor ?? 0) > 0 && <span data-testid="money-receipt-rounding" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Invoice: {formatMoney(receipt.amountMinor - receipt.roundingMinor!, receipt.currency)} · Rounding: {formatMoney(receipt.roundingMinor!, receipt.currency)}</span>}
      <span style={theme.typography.ParagraphSmall}>{receipt.status === 'matched' ? 'Matched to this invoice' : `Needs review · ${receipt.reason ?? 'Check the receipt details.'}`}</span>
    </div>)}
    {events.length ? events.map((event) => <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500, paddingTop: theme.sizing.scale300, paddingBottom: theme.sizing.scale300, borderBottom: `1px solid ${theme.colors.borderOpaque}`, ...theme.typography.ParagraphSmall }}>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{event.label}</span>
      <span style={{ flexShrink: 0, color: theme.colors.contentSecondary, ...theme.typography.ParagraphXSmall }}><MoneyDate value={event.at} /></span>
    </div>) : <p style={{ ...theme.typography.ParagraphSmall, margin: 0, color: theme.colors.contentSecondary }}>Invoice activity appears here.</p>}
  </section>;
}

export function InvoiceActions({invoiceId,scope,sale}:{invoiceId:string;scope:string;sale?:Sale}) {
  return <PaymentLinkActions invoiceId={invoiceId} scope={scope} sale={sale}/>;
}

export function FiscalPreparation({invoiceId,scope}:{invoiceId:string;scope:string}) {
  const [,theme]=useStyletron(),money=useMoney(scope),invoice=money.state.invoices.find(row=>row.id===invoiceId);
  const [open,setOpen]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  const [ruc,setRuc]=React.useState(''),[sellerRuc,setSellerRuc]=React.useState(money.state.setup.ruc);
  const [address,setAddress]=React.useState(''),[tax,setTax]=React.useState('18');
  const [due,setDue]=React.useState(()=>peruDate(new Date().toISOString()));
  if(!invoice?.collectionOnly)return <FiscalActions invoiceId={invoiceId} scope={scope}/>;
  const save=async()=>{
    if(busy)return;setBusy(true);setError('');
    try{money.updateSetup({ruc:sellerRuc});const result=await money.prepareOrderFiscal(invoiceId,{customerRuc:ruc,customerAddress:address,taxRate:Number(tax),dueAt:due});
      if(result.ok)setOpen(false);else setError(result.error);
    }finally{setBusy(false);}
  };
  return <section style={{display:'grid',gap:theme.sizing.scale400}}>
    <h3 style={{...theme.typography.LabelMedium,margin:0}}>Electronic invoice</h3>
    <Button kind={KIND.secondary} size={SIZE.compact} overrides={{BaseButton:{style:{minHeight:'44px'}}}} data-testid="payment-fiscal-details" onClick={()=>setOpen(true)}>Prepare electronic invoice</Button>
    {open&&<MoneyDialog title="Electronic invoice details" onClose={()=>setOpen(false)} testId="money-issue-dialog" actions={<Button isLoading={busy} data-testid="money-confirm-issue" onClick={()=>void save()}>Save fiscal details</Button>}>
      <div style={{display:'grid',gap:theme.sizing.scale500}}>
        <p style={{...theme.typography.ParagraphMedium,margin:0}}>{invoice.customerName} · {invoice.saleNumber}<br/>{formatInvoiceMoney(invoice)}</p>
        <Field label="Seller RUC"><Input value={sellerRuc} onChange={event=>setSellerRuc(event.currentTarget.value)} inputMode="numeric"/></Field>
        <Field label="Customer RUC"><Input value={ruc} onChange={event=>setRuc(event.currentTarget.value)} inputMode="numeric" overrides={{Input:{props:{'data-testid':'money-issue-ruc'}}}}/></Field>
        <Field label="Customer fiscal address"><Input value={address} onChange={event=>setAddress(event.currentTarget.value)} overrides={{Input:{props:{'data-testid':'money-issue-address',maxLength:100}}}}/></Field>
        <Field label="IGV included in total"><select value={tax} onChange={event=>setTax(event.target.value)} style={{...theme.typography.ParagraphMedium,minHeight:44,padding:theme.sizing.scale400,color:theme.colors.contentPrimary,background:theme.colors.backgroundSecondary,border:`1px solid ${theme.colors.borderOpaque}`}}><option value="18">18%</option><option value="0">0%</option></select></Field>
        <Field label="Fiscal due date"><Input type="date" value={due} onChange={event=>setDue(event.currentTarget.value)}/></Field>
        <p style={{...theme.typography.ParagraphSmall,margin:0,color:theme.colors.contentSecondary}}>Fiscal issuance follows the seller’s document authorization.</p>
        {error&&<p role="alert" style={{...theme.typography.ParagraphSmall,margin:0}}>{error}</p>}
      </div>
    </MoneyDialog>}
  </section>;
}

export function InvoiceDetail({ invoiceId, scope }: { invoiceId: string; scope: string }) {
  const {derived}=useConfig(),edits=useDay(derived.cast.sector),grants=useGrants();
  const sales=React.useMemo(()=>buildSales(derived.cast,edits),[derived.cast,edits,grants]);
  const [, theme] = useStyletron();
  const { state } = useMoney(scope);
  const invoice = state.invoices.find((item) => item.id === invoiceId);
  if (!invoice) return null;
  const balance = invoiceBalance(state, invoiceId);
  const overdue = invoiceOverdueDays(state, invoiceId, invoice ? invoiceClock(invoice, moneyNow(state)) : moneyNow(state));
  const cell: React.CSSProperties = { paddingTop: theme.sizing.scale400, paddingBottom: theme.sizing.scale400, borderBottom: `1px solid ${theme.colors.borderOpaque}`, verticalAlign: 'top' };
  return <article data-testid="money-invoice-detail" style={{ display: 'grid', gap: theme.sizing.scale800, padding: theme.sizing.scale700, minWidth: 0 }}>
    <header style={{ display: 'grid', gap: theme.sizing.scale400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale400 }}><h2 style={{ ...theme.typography.HeadingMedium, margin: 0, overflowWrap:'anywhere' }}>{documentNumber(invoice)}</h2><span data-testid="money-invoice-status" style={{ ...theme.typography.LabelSmall }}>{overdue ? `${statusWordsOf('overdue')} · ${overdue}d` : statusWordsOf(invoiceStatusOf(state, invoiceId, invoiceClock(invoice, moneyNow(state))))}</span></div>
      {invoice.origin==='cedar'&&!invoice.collectionOnly&&invoice.fiscal?.phase!=='accepted'&&<span style={{...theme.typography.LabelSmall,color:theme.colors.contentSecondary}}>Billing draft</span>}
      <span style={{ ...theme.typography.HeadingXSmall }}>{invoice.customerName}</span>
      {invoice.fiscal?.phase==='accepted'&&<span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Powered by <img src="/connection-brands/nubefact.png" alt="NubeFact" width={82} height={25} style={{ objectFit: 'contain' }} /></span>}
      {!invoice.collectionOnly&&<span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>RUC {invoice.customerRuc}</span>}
      <a href={`#/sales/${encodeURIComponent(invoice.saleId)}`} data-testid="money-source-note" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, minHeight:44,display:'inline-flex',alignItems:'center' }}>Delivery Note {invoice.saleNumber} <ArrowUpRight size={14} aria-hidden /></a>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: theme.sizing.scale600 }}>
      <div><span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{invoice.collectionOnly?'Order total':'Invoice total'}</span><div data-testid="money-invoice-total" style={{ ...theme.typography.HeadingSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatInvoiceMoney(invoice)}</div></div>
      <div><span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Outstanding</span><div data-testid="money-invoice-balance" style={{ ...theme.typography.HeadingSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatInvoiceMoney(invoice, balance)}</div></div>
    </div>
    <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: theme.sizing.scale400, ...theme.typography.ParagraphSmall, margin: 0 }}>
      {invoice.fiscal?.record_id&&<><dt style={{ color: theme.colors.contentSecondary }}>NubeFact acceptance</dt><dd data-testid="money-acceptance" data-mode={invoice.fiscal?.mode ?? ''} style={{ margin: 0, textAlign: 'right' }}>{invoice.fiscal ? fiscalWords[invoice.fiscal.phase] : fiscalWords.unprepared}</dd></>}
      <dt style={{ color: theme.colors.contentSecondary }}>{invoice.collectionOnly?'Order linked':invoice.origin==='cedar'?'Prepared':'Issued'}</dt><dd style={{ margin: 0 }}><MoneyDate value={invoice.issuedAt} /></dd>
      {invoice.fiscal?.issue_date&&<><dt style={{color:theme.colors.contentSecondary}}>Invoice issued</dt><dd style={{margin:0}}><MoneyDate value={invoice.fiscal.issue_date}/></dd></>}
      <dt style={{ color: theme.colors.contentSecondary }}>Due</dt><dd style={{ margin: 0 }}><MoneyDate value={invoice.dueAt} /></dd>
      <dt style={{ color: theme.colors.contentSecondary }}>Source Delivery Note</dt><dd data-testid="money-source-amount" data-source-currency={invoice.sourceCurrency} style={{ margin: 0 }}>{formatMoney(Math.round(invoice.sourceTotal * 100), invoice.sourceCurrency)}</dd>
      {invoice.sourceCurrency !== invoice.currency && <><dt style={{ color: theme.colors.contentSecondary }}>Frozen exchange rate</dt><dd data-testid="money-fx-rate" style={{ margin: 0 }}>1 {invoice.sourceCurrency} = {invoice.fxRate} {invoice.currency}</dd></>}
    </dl>
    <InvoiceActions invoiceId={invoiceId} scope={scope} sale={sales.find(sale=>sale.id===invoice.saleId)} />
    <section aria-label="Order lines">
      <table style={{ width: '100%', borderCollapse: 'collapse', ...theme.typography.ParagraphSmall }}><thead><tr><th style={{ ...cell, textAlign: 'left', ...theme.typography.LabelSmall }}>Item</th><th style={{ ...cell, textAlign: 'right', ...theme.typography.LabelSmall }}>Qty</th><th style={{ ...cell, textAlign: 'right', ...theme.typography.LabelSmall }}>{invoiceDisplayCurrency(invoice)}</th></tr></thead><tbody>{invoice.lines.map((line) => <tr key={line.id}><td style={{ ...cell, paddingRight: theme.sizing.scale300 }}>{line.name}</td><td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap', paddingRight: theme.sizing.scale400 }}>{line.quantity} {line.unit}</td><td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatInvoiceMoney(invoice, line.amountMinor)}</td></tr>)}</tbody></table>
      <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: theme.sizing.scale400, ...theme.typography.ParagraphSmall, marginBottom: 0 }}>{!invoice.collectionOnly&&<><dt>Net</dt><dd style={{ margin: 0 }}>{formatInvoiceMoney(invoice, invoice.netMinor)}</dd><dt>IGV · {invoice.taxRate}%</dt><dd style={{ margin: 0 }}>{formatInvoiceMoney(invoice, invoice.taxMinor)}</dd></>}<dt style={theme.typography.LabelMedium}>Total</dt><dd style={{ ...theme.typography.LabelMedium, margin: 0 }}>{formatInvoiceMoney(invoice)}</dd></dl>
    </section>
    <FiscalPreparation invoiceId={invoiceId} scope={scope}/>
    <MoneyHistory invoiceId={invoiceId} scope={scope} />
  </article>;
}

/** THE GATE STANDS BEFORE THE READ (FEED-IA §247.9). A Money-off workspace mounts no invoice card
 *  and makes no money-provider read: the capability is asked first, the card and its `useBankCapability`
 *  mount only where Money is on (the same shape as `BankMilestone` in setup-progress.tsx). */
export function DeliveryNoteMoney({ sale, scope }: { sale: Sale; scope: string }) {
  const { money: moneyEnabled } = useWorkspaceCapabilities(scope);
  if (!moneyEnabled) return null;
  return <DeliveryNoteMoneyCard sale={sale} scope={scope} />;
}

function DeliveryNoteMoneyCard({sale,scope}:{sale:Sale;scope:string}) {
  const [,theme]=useStyletron(),money=useMoney(scope),invoice=invoiceForSale(money.state,sale.id);
  React.useEffect(()=>{if(!invoice)money.ensureOrderDocument(sale);},[sale,scope,invoice?.id,money.ensureOrderDocument]);
  return <section data-testid="delivery-note-money" aria-label="Order payment" style={{borderTop:`1px solid ${theme.colors.borderOpaque}`,paddingTop:theme.sizing.scale700,marginTop:theme.sizing.scale700,display:'grid',gap:theme.sizing.scale600,minWidth:0}}>
    <h3 style={{...theme.typography.LabelLarge,margin:0}}>Order payment</h3>
    {invoice?<><div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:theme.sizing.scale400}}>
      <a href={`#/money/invoices/${encodeURIComponent(invoice.id)}`} data-testid="delivery-note-invoice-link" style={{...theme.typography.LabelMedium,color:theme.colors.contentPrimary,minHeight:44,display:'inline-flex',alignItems:'center'}}>{documentNumber(invoice)}<ArrowUpRight size={16} aria-hidden/></a>
      <span style={theme.typography.ParagraphSmall}>{statusWordsOf(invoiceStatusOf(money.state,invoice.id,invoiceClock(invoice,moneyNow(money.state))))} · {formatInvoiceMoney(invoice,invoiceBalance(money.state,invoice.id))}</span>
    </div><InvoiceActions invoiceId={invoice.id} scope={scope} sale={sale}/><FiscalPreparation invoiceId={invoice.id} scope={scope}/><MoneyHistory invoiceId={invoice.id} scope={scope}/></>
    :<p style={{...theme.typography.ParagraphSmall,margin:0,color:theme.colors.contentSecondary}}>The payment link follows this order’s priced goods.</p>}
  </section>;
}
