import { openWhatsAppConnection } from './whatsapp-connection';
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND } from 'baseui/button';
import { Input } from 'baseui/input';
import { useConfig } from './config';
import { useMoney } from './money-store';
import { useBankCapability, useInvoicingCapability } from './money-bank-api';
import { invoicingSetupAuthorized, paymentSetupAuthorized, type MoneySetupState } from './money-model';
import { ConnectionSetupFrame, SetupChoice, SetupChoices, SetupDisclosure, type SetupPresentation } from './setup-frame';

/* ONE QUESTION PER STEP, AND THE PROVIDER OWNS THE WORD «CONNECTED» (FEED-IA §246, §247.2).
 *
 * «The flow of connecting should be a single question, a single form prompt … single steps, so it
 *  doesn't even give the extra info. You always give a bunch of extra info. That's a bunch of
 *  sluff.»                                                                    — Peter, 2026-09-10
 *
 * Two repairs, from the phone's own model. (1) The `account` step asked two things at once — a
 * free-text label AND a consent checkbox — and four step titles carried an explanatory sentence
 * under them, which is the exact construction `phone-setup.tsx` deleted. Each step now asks one
 * thing at full weight, and secondary matter lives in the disclosure that already exists.
 * (2) Typing any words and ticking a box used to promote the workspace to «Connected» across four
 * surfaces. The consent step records the seller's authorization and then WAITS: `authorizing` is
 * what the person did, and only `bankCapabilityOf` / `invoicingCapabilityOf` — the polled provider
 * evidence — can reach `payment-ready` or `invoice-ready`. */
export type MoneySetupKind = 'payments' | 'invoicing' | 'overview' | 'email' | 'whatsapp';
type Bank = 'bbva' | 'interbank' | 'scotiabank';
type Step = 'overview' | 'bank' | 'account' | 'consent' | 'payment-authorized' | 'payment-ready'
  | 'seller-name' | 'seller-ruc' | 'seller' | 'signing' | 'invoice-authorized' | 'invoice-ready' | 'whatsapp';
const BANKS: Array<{ id: Bank; name: string; logo: string }> = [
  { id: 'bbva', name: 'BBVA', logo: '/connection-brands/bbva.png' },
  { id: 'interbank', name: 'Interbank', logo: '/connection-brands/interbank.png' },
  { id: 'scotiabank', name: 'Scotiabank', logo: '/connection-brands/scotiabank.png' },
];

export function MoneySetup({ kind, presentation, onClose, doneLabel, onComplete, defaultAccountLabel, identityCollected, onEditIdentity, onBackToPrevious }: {
  kind: MoneySetupKind; presentation: SetupPresentation; onClose: () => void; doneLabel?: string; onComplete?: () => void; defaultAccountLabel?: string;
  identityCollected?: boolean; onEditIdentity?: () => void; onBackToPrevious?: () => void;
}) {
  const [, theme] = useStyletron();
  const finish = onComplete || onClose;
  const { config, set } = useConfig();
  const { state, updateSetup } = useMoney(config.cast);
  const setup = state.setup;
  const bank = useBankCapability(config.cast);
  const invoicing = useInvoicingCapability(config.cast);
  const bankReady = bank.posture === 'ready', invoicingReady = invoicing.posture === 'ready';
  /* `email` stays a KIND because it is the route token Administration → Connections answers to,
     and that seat opens the mailbox walk itself (`connections.tsx` renders `EmailConnection`). The
     STEP is gone: its two switches wrote `config.mailbox`, a browser draft that spoke for a mailbox
     nobody had connected, and nothing has mounted this screen for email since. */
  const initialStep = (): Step => kind === 'payments'
    ? bankReady ? 'payment-ready' : paymentSetupAuthorized(setup) ? 'payment-authorized' : setup.bankAccountLabel ? 'account' : 'bank'
    : kind === 'invoicing' ? invoicingReady ? 'invoice-ready' : invoicingSetupAuthorized(setup) ? 'invoice-authorized' : identityCollected ? 'seller' : 'seller-name'
      : kind === 'whatsapp' ? 'whatsapp' : 'overview';
  const [step, setStep] = React.useState<Step>(initialStep);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    setStep(initialStep());
    setError('');
  }, [kind, config.cast]);
  /* THE PROVIDER MOVES THIS SCREEN, AND ONLY THE PROVIDER. A person waiting on `Authorization
     sent` lands on the connected step the moment the polled snapshot says the account is live. */
  React.useEffect(() => { if (bankReady && step === 'payment-authorized') setStep('payment-ready'); }, [bankReady, step]);
  React.useEffect(() => { if (invoicingReady && step === 'invoice-authorized') setStep('invoice-ready'); }, [invoicingReady, step]);
  React.useEffect(() => {
    const selector = ({ account: 'setup-bank-account', 'seller-name': 'setup-seller-name', 'seller-ruc': 'setup-ruc', seller: 'setup-invoice-series' } as Partial<Record<Step, string>>)[step];
    if (!selector) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => { second = window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-testid="${selector}"]`)?.focus({ preventScroll: true })); });
    return () => { window.cancelAnimationFrame(first); window.cancelAnimationFrame(second); };
  }, [step]);
  const save = (patch: Partial<MoneySetupState>): boolean => {
    const result = updateSetup(patch);
    if (!result.ok) { setError(result.error); return false; }
    setError('');
    return true;
  };
  const chosenBank = BANKS.find((item) => item.id === setup.bank);
  const paymentFlow = ['bank', 'account', 'consent', 'payment-authorized', 'payment-ready'].includes(step);
  const invoiceFlow = ['seller-name', 'seller-ruc', 'seller', 'signing', 'invoice-authorized', 'invoice-ready'].includes(step);
  const gap = { display: 'grid', gap: theme.sizing.scale500 } as const;
  const paragraph = { ...theme.typography.ParagraphSmall, margin: 0, color: theme.colors.contentSecondary };
  const facts = { ...gap, padding: theme.sizing.scale500, borderRadius: theme.borders.radius300,
    backgroundColor: theme.colors.backgroundSecondary };
  const go = (next: Step) => { setError(''); setStep(next); };
  const leave = () => {
    if (paymentFlow && !paymentSetupAuthorized(setup) && !save({ payments: 'deferred' })) return;
    if (invoiceFlow && !invoicingSetupAuthorized(setup) && !save({ invoicing: 'deferred' })) return;
    onClose();
  };
  const back = step === 'account' ? () => go('bank') : step === 'consent' ? () => go('account')
    : step === 'signing' ? () => go('seller')
    : step === 'seller-ruc' ? () => go('seller-name') : step === 'seller' && !identityCollected ? () => go('seller-ruc')
    : kind === 'overview' && step !== 'overview' ? () => go('overview') : onBackToPrevious;
  const titles: Record<Step, string> = {
    overview: 'Payments and invoicing', bank: 'Your receiving bank', account: 'What do you call this account?',
    consent: 'Allow access to balances and transactions', 'payment-authorized': 'Authorization sent',
    'payment-ready': 'Your account is connected', 'seller-name': 'Business name', 'seller-ruc': 'Your RUC', seller: 'Invoice series',
    signing: 'Authorize invoicing for this business', 'invoice-authorized': 'Authorization sent',
    'invoice-ready': 'Your invoices are ready', whatsapp: 'Connect your WhatsApp',
  };
  const disclosure = paymentFlow ? <SetupDisclosure title="Account access and privacy">
    <p style={paragraph}>Prometeo provides access to the bank account you authorize. Available account types and transaction details depend on your bank.</p>
    <p style={paragraph}>Yape and Plin receipts depend on the receiving account’s transaction details. Your bank and wallet determine their account fees.</p>
    <p data-testid="setup-manual-consequence" style={paragraph}>You can record payments and match them to invoices in Money.</p>
  </SetupDisclosure> : invoiceFlow ? <SetupDisclosure title="Invoice data and authorization">
    <p style={paragraph}>Rocoto prepares the invoice details. NubeFact generates, signs and submits electronic documents using its digital certificate after the seller authorizes it.</p>
    <p style={paragraph}>Each seller authorizes NubeFact in SUNAT using their Clave SOL. NubeFact confirms account activation and the contracted document allowance.</p>
    <p style={paragraph}>Authorize NubeFact S.A., RUC 20600695771, as your PSE in SUNAT using your Clave SOL. Choose a start date tomorrow or later. Live tax submission becomes available after that date and NubeFact activation.</p>
    <a href="https://repositorio.nubefact.com/doc/2f996b.pdf" target="_blank" rel="noopener noreferrer"
      style={{ color: theme.colors.contentPrimary, ...theme.typography.LabelSmall, minHeight: 44, display: 'flex', alignItems: 'center' }}>SUNAT authorization steps</a>
    <p style={paragraph}>NubeFact confirms any applicable OSE appointment and enables the seller’s production account.</p>
    <p data-testid="setup-manual-consequence" style={paragraph}>Continue issuing official documents with your current invoicing service during activation.</p>
  </SetupDisclosure> : <SetupDisclosure title="Connection details">
    <p style={paragraph}>Each connection has its own account access and activation steps. You can return to Connections to finish setup.</p>
  </SetupDisclosure>;
  const defer = <div style={gap}>
    <Button kind={KIND.tertiary} onClick={() => {
      if (paymentFlow && !paymentSetupAuthorized(setup) && !save({ payments: 'deferred' })) return;
      if (invoiceFlow && !invoicingSetupAuthorized(setup) && !save({ invoicing: 'deferred' })) return;
      finish();
    }} data-testid="setup-defer">Set up later</Button>
  </div>;
  return <ConnectionSetupFrame title={titles[step]} presentation={presentation}
    onClose={leave} onBack={back} disclosure={disclosure} testId="money-setup">
    {invoiceFlow && <img src="/connection-brands/nubefact.png" alt="NubeFact logo" width={136} height={40} style={{ objectFit: 'contain', objectPosition: 'left' }} />}
    {error && <p role="alert" style={{ ...paragraph, color: theme.colors.negative }}>{error}</p>}
    {step === 'overview' && <div style={gap}>
      <SetupChoice name="Payments" description={bankReady ? 'Review your receiving account' : 'Connect your receiving account and match incoming payments'}
        testId="setup-payments" onClick={() => go(bankReady ? 'payment-ready' : setup.bankAccountLabel ? 'account' : 'bank')} />
      <SetupChoice name="Invoicing" description={invoicingReady ? 'Review your seller details' : 'Invoices and delivery guides · Powered by NubeFact'}
        logo="/connection-brands/nubefact.png" testId="setup-invoicing" onClick={() => go(invoicingReady ? 'invoice-ready' : identityCollected ? 'seller' : 'seller-name')} />
      <Button kind={KIND.tertiary} onClick={onClose} data-testid="setup-overview-done">Done</Button>
    </div>}
    {step === 'bank' && <div style={gap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500 }}>
        <img src="/connection-brands/yape.png" alt="Yape" width={36} height={36} style={{ objectFit: 'contain' }} />
        <img src="/connection-brands/plin.png" alt="Plin" width={48} height={40} style={{ objectFit: 'contain' }} />
      </div>
      <SetupChoices>{BANKS.map((item) => <SetupChoice variant="tile" key={item.id} name={item.name} logo={item.logo}
        testId={`setup-bank-${item.id}`} onClick={() => { if (save({ bank: item.id, payments: 'pending', bankAccountLabel: defaultAccountLabel || '', consentAt: undefined })) go('account'); }} />)}</SetupChoices>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400 }}>
        <img src="/connection-brands/prometeo.png" alt="Prometeo" width={57} height={13} style={{ objectFit: 'contain' }} />
        <span style={paragraph}>Bank connection</span>
      </div>
      {defer}
    </div>}
    {step === 'account' && <form style={gap} onSubmit={(event) => {
      event.preventDefault();
      if (!chosenBank || !setup.bankAccountLabel.trim()) { setError('Name your receiving account.'); return; }
      go('consent');
    }}>
      {chosenBank && <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500 }}>
        <img src={chosenBank.logo} alt={`${chosenBank.name} logo`} width={80} height={40} style={{ objectFit: 'contain' }} />
        <span style={theme.typography.LabelLarge}>{chosenBank.name}</span>
      </div>}
      <Input value={setup.bankAccountLabel || ''} onChange={(event) => save({ bankAccountLabel: event.currentTarget.value })}
        required maxLength={80} autoComplete="off" aria-label="Account name" overrides={{ Input: { props: { 'data-testid': 'setup-bank-account' } } }} />
      <Button type="submit" disabled={!setup.bankAccountLabel.trim()} data-testid="setup-account-continue">Continue</Button>
      {defer}
    </form>}
    {step === 'consent' && <div style={gap}>
      {chosenBank && <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500 }}>
        <img src={chosenBank.logo} alt={`${chosenBank.name} logo`} width={80} height={40} style={{ objectFit: 'contain' }} />
        <span style={theme.typography.LabelLarge}>{chosenBank.name} · {setup.bankAccountLabel}</span>
      </div>}
      <Button data-testid="setup-connect-sample" onClick={() => {
        if (save({ payments: 'authorizing', consentAt: new Date().toISOString() })) go('payment-authorized');
      }}>Allow access</Button>
      {defer}
    </div>}
    {step === 'payment-authorized' && <div style={gap}>
      <div style={facts} data-testid="setup-payment-authorized"><strong style={theme.typography.LabelLarge}>{chosenBank?.name} · {setup.bankAccountLabel}</strong>
        <p style={paragraph}>Prometeo activates this account.</p></div>
      <Button onClick={() => kind === 'overview' ? go(invoicingReady ? 'invoice-ready' : identityCollected ? 'seller' : 'seller-name') : finish()} data-testid="setup-payment-done">
        {kind === 'overview' ? 'Continue to invoicing' : doneLabel || 'Done'}</Button>
      <Button kind={KIND.tertiary} onClick={() => go('bank')} data-testid="setup-change-bank">Choose another bank</Button>
    </div>}
    {step === 'payment-ready' && <div style={gap}>
      <div style={facts} data-testid="setup-payment-ready"><strong style={theme.typography.LabelLarge}>{bank.accountLabel || setup.bankAccountLabel}{bank.accountMask ? ` · ${bank.accountMask}` : ''}</strong>
        <p style={paragraph}>Balances and payments in one place.</p></div>
      <Button onClick={() => kind === 'overview' ? go(invoicingReady ? 'invoice-ready' : identityCollected ? 'seller' : 'seller-name') : finish()} data-testid="setup-payment-done">
        {kind === 'overview' ? 'Continue to invoicing' : doneLabel || 'Done'}</Button>
      <Button kind={KIND.tertiary} onClick={() => go('bank')} data-testid="setup-change-bank">Choose another bank</Button>
    </div>}
    {step === 'seller-name' && <form style={gap} onSubmit={event => {
      event.preventDefault(); if (!setup.sellerName.trim()) { setError('Enter your business name.'); return; } go('seller-ruc');
    }}>
      <Input value={setup.sellerName || ''} required maxLength={160} autoComplete="organization" aria-label="Seller name"
        onChange={event => save({ sellerName: event.currentTarget.value, invoicing: 'pending' })} overrides={{ Input: { props: { 'data-testid': 'setup-seller-name' } } }} />
      <Button type="submit" data-testid="setup-seller-continue">Continue</Button>{defer}
    </form>}
    {step === 'seller-ruc' && <form style={gap} onSubmit={event => {
      event.preventDefault(); if (!/^\d{11}$/.test(setup.ruc)) { setError('Enter your 11-digit RUC.'); return; } go('seller');
    }}>
      <Input value={setup.ruc || ''} required inputMode="numeric" maxLength={11} pattern="[0-9]{11}" aria-label="RUC"
        onChange={event => save({ ruc: event.currentTarget.value.replace(/\D/g, '').slice(0, 11), invoicing: 'pending' })}
        overrides={{ Input: { props: { 'data-testid': 'setup-ruc' } } }} />
      <Button type="submit" data-testid="setup-ruc-continue">Continue</Button>{defer}
    </form>}
    {step === 'seller' && <form style={gap} onSubmit={(event) => {
      event.preventDefault();
      if (!/^\d{11}$/.test(setup.ruc) || !setup.sellerName.trim() || !/^F[A-Z0-9]{3}$/.test(setup.invoiceSeries)) {
        setError('Enter an 11-digit RUC, seller name and four-character invoice series starting with F.'); return;
      }
      go('signing');
    }}>
      {identityCollected ? <div style={facts} data-testid="setup-collected-identity">
        <strong style={theme.typography.LabelMedium}>{setup.sellerName}</strong><span style={paragraph}>RUC {setup.ruc}</span>
        {onEditIdentity && <Button type="button" kind={KIND.tertiary} onClick={onEditIdentity} data-testid="setup-edit-business">Edit business details</Button>}
      </div> : null}
      <Input value={setup.invoiceSeries} required maxLength={4} pattern="F[A-Z0-9]{3}"
        aria-label="Invoice series" onChange={(event) => save({ invoiceSeries: event.currentTarget.value.toUpperCase(), invoicing: 'pending' })}
        overrides={{ Input: { props: { 'data-testid': 'setup-invoice-series' } } }} />
      <Button type="submit" data-testid="setup-review-invoicing">Review authorization</Button>
      {defer}
    </form>}
    {step === 'signing' && <div style={gap}>
      <div style={facts}><strong style={theme.typography.LabelLarge}>{setup.sellerName}</strong>
        <p style={paragraph}>RUC {setup.ruc} · Series {setup.invoiceSeries} · PEN</p></div>
      <Button onClick={() => { if (save({ invoicing: 'authorizing' })) go('invoice-authorized'); }} data-testid="setup-enable-invoice-preview">Authorize invoicing</Button>
      {defer}
    </div>}
    {step === 'invoice-authorized' && <div style={gap}>
      <div style={facts} data-testid="setup-invoice-authorized"><strong style={theme.typography.LabelLarge}>{setup.sellerName}</strong>
        <p style={paragraph}>RUC {setup.ruc} · Series {setup.invoiceSeries} · PEN</p>
        <p style={paragraph} data-testid="setup-signing-pending">NubeFact activates this account.</p></div>
      <Button onClick={finish} data-testid="setup-invoice-done">{doneLabel || 'Done'}</Button>
      <Button kind={KIND.tertiary} data-testid="setup-edit-invoicing" onClick={() => go(identityCollected ? 'seller' : 'seller-name')}>Edit business details</Button>
    </div>}
    {step === 'invoice-ready' && <div style={gap}>
      <div style={facts} data-testid="setup-invoice-ready"><strong style={theme.typography.LabelLarge}>{setup.sellerName}</strong>
        <p style={paragraph}>RUC {setup.ruc} · Series {setup.invoiceSeries} · PEN</p>
        <p style={paragraph}>Powered by NubeFact</p></div>
      <Button onClick={finish} data-testid="setup-invoice-done">{doneLabel || 'Done'}</Button>
      <Button kind={KIND.tertiary} data-testid="setup-edit-invoicing" onClick={() => go(identityCollected ? 'seller' : 'seller-name')}>Edit business details</Button>
    </div>}
    {step === 'whatsapp' && <div style={gap}>
      <p style={paragraph}>Meta verifies your business account and manages the chat sharing you approve.</p>
      <Button onClick={() => openWhatsAppConnection({ presentation: 'dialog', onComplete: () => finish() })} data-testid="setup-whatsapp-open">Connect WhatsApp Business</Button>
      <Button kind={KIND.tertiary} onClick={onClose}>Done</Button>
    </div>}
  </ConnectionSetupFrame>;
}
