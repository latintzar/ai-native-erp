import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND } from 'baseui/button';
import { Input } from 'baseui/input';
import { Checkbox } from 'baseui/checkbox';
import { Forward } from 'lucide-react';
import { ConnectionSetupFrame, SetupChoice, SetupChoices } from './setup-frame';
import { EmailConversation } from './email-thread';
import { cedarEmailExamples, mailboxThreadRows, mergeMailboxMessages } from './email-model';
import { buildSales } from './sale';
import { useDay } from './day';
import { useConfig } from './config';
import { accountOf, useCustomerEdits } from './customer-edits';
import { ChannelApiError } from './cedar-channel-api';
import { useEmailSourceEpoch } from './email-source-session';
import { DocumentLineTable } from './document-line-table';
import { acceptEmailStatus, emailWrote, mailboxConnected, mailboxHistoryReady, useEmailCapability, useEmailProvider } from './email-provider';
import { announceEmailRefresh, beginEmailAuth, bindEmailCustomer, consentEmailInvoices, disconnectEmail, downloadEmailAttachment,
  installMailboxStanding, parseEmailAttachment, readEmailStatus, readEmailThread, searchEmailInvoices, syncEmail,
  type EmailLineReview, type EmailMessage, type EmailStatus, type MailboxAccount, type MailboxProvider } from './email-api';

export type EmailConnectionProps = { scope: string; presentation: 'page' | 'dialog'; onClose: () => void;
  onComplete?: (status: EmailStatus) => void; onSampleComplete?: () => void };

function failure(error: unknown): string { return error instanceof Error ? error.message : 'Try the mailbox connection again.'; }

/** App-level standing survives route changes and clears immediately when access is reset. The
 *  polling lives in `email-provider.ts` now, where every entrance reads the same snapshot; this
 *  host only installs the send authority the renderer asks for from that one evidence. */
export function EmailConnectionHost() {
  const provider = useEmailProvider();
  const evidence = provider.evidence;
  React.useEffect(() => {
    if (!evidence) return undefined;
    return installMailboxStanding(evidence);
  }, [evidence]);
  return null;
}

export function EmailConnection(props: EmailConnectionProps) {
  const epoch = useEmailSourceEpoch();
  return <EmailConnectionContent key={epoch} {...props} />;
}

/* ── ONE QUESTION PER STEP, AND THE QUESTION LEADS (FEED-IA §246 · §247.2) ────────────────────
 *
 * «The flow of connecting should be a single question, a single form prompt … single steps, so it
 *  doesn't even give the extra info. You always give a bunch of extra info. That's a bunch of
 *  sluff.»                                                                 — Peter, 2026-09-10
 *
 * The `choose` screen used to carry SEVEN acts at once: three provider rows, a forwarding button,
 * a connected account with its Disconnect, a Continue, a provider-pending sentence and a test-data
 * button, under a description line explaining the whole thing. It is now one question at a time:
 *
 *   accounts   the mailboxes this workspace holds · Disconnect email · Continue · Add another
 *   choose     «Which mailbox do you use?»  ·  three square choices, the onboarding channel shape
 *   authorize  «Sign in to Gmail»           ·  one act: Open Gmail
 *   forwarding «Forward order email to this address» · the address · one Done
 *   mailbox    the Inbox, reached ONLY from a connected account
 *
 * `Use test data` is onboarding's own door and appears only where `onSampleComplete` was passed;
 * the Connections door states what it can actually do and offers nothing it cannot.
 */
type EmailStep = 'accounts' | 'choose' | 'authorize' | 'forwarding' | 'mailbox' | 'invoices' | 'sample';

const MAILBOX_CHOICES = [
  { id: 'google' as const, name: 'Gmail', logo: '/connection-brands/gmail.png', act: 'Open Gmail' },
  { id: 'outlook' as const, name: 'Microsoft 365', logo: '/connection-brands/microsoft.png', act: 'Open Microsoft' },
];

const TITLES: Record<EmailStep, string> = {
  accounts: 'Connect email', choose: 'Connect email', authorize: 'Connect email',
  forwarding: 'Forwarding address', mailbox: 'Inbox', invoices: 'Find earlier invoices', sample: 'Email test data',
};

function EmailConnectionContent({ scope, presentation, onClose, onComplete, onSampleComplete }: EmailConnectionProps) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const edits = useDay(derived.cast.sector);
  const examples = React.useMemo(() => cedarEmailExamples(derived.cast.sector, buildSales(derived.cast, edits)), [derived.cast, edits]);
  /* THE SHARED SNAPSHOT IS THE STATUS. Every write below publishes into it, so Connections, the
     connected inbox, onboarding and the customer sheet move with this walk rather than after a
     reload — and this screen inherits the bounded refresh instead of running a second poller. */
  const provider = useEmailProvider();
  const capability = useEmailCapability();
  const status = provider.evidence;
  const accounts = React.useMemo(() => status?.accounts ?? [], [status]);
  const [step, setStep] = React.useState<EmailStep>('choose');
  const [chosen, setChosen] = React.useState<MailboxProvider>('google');
  const [exampleId, setExampleId] = React.useState<string | null>(null);
  const [account, setAccount] = React.useState<MailboxAccount | null>(null);
  const [messages, setMessages] = React.useState<EmailMessage[]>([]);
  const [bound, setBound] = React.useState<number | undefined>(undefined);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [more, setMore] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const hydrated = React.useRef(false);
  /* WHERE THE WALK OPENS, AND WHAT DECIDES IT. A workspace that already holds a mailbox opens on
     its accounts; one that holds none opens on the question. It is decided ONCE, from this
     screen's OWN first read, and never from the shared snapshot: opening this door is the act that
     allocates a connection workspace, so the snapshot's honest «no workspace, therefore no
     mailbox» lands first and would open the walk at `choose` on an account holding two mailboxes.
     A read that fails leaves the walk on the question, which is where it starts. */
  const update = React.useCallback(async () => {
    /* `acceptEmailStatus` stamps the write generation, so a periodic read that began before this
       one lands as the older answer and is discarded rather than published over it. */
    const current = await readEmailStatus();
    acceptEmailStatus(current);
    if (!hydrated.current) { hydrated.current = true; setStep(current.accounts.length ? 'accounts' : 'choose'); }
    return current;
  }, []);
  React.useEffect(() => { void update().catch(caught => setError(failure(caught))); }, [update]);
  /* ── THE STEP'S OWN QUESTION TAKES FOCUS ON EVERY STEP CHANGE (§247.2) ───────────────────
     `ConnectionSetupFrame` focuses its h1 in an effect keyed on the TITLE, and accounts, choose
     and authorize all carry the title «Connect email» — so pressing the Gmail tile unmounted the
     focused button and nothing took focus: a keyboard or screen-reader person landed on the body
     with the new question unannounced, while a step that DID change the title jumped to the h1
     instead. Two behaviours inside one walk. Every step change now moves focus to that step's own
     prompt, in the second frame so it lands after the frame's own title focus, and `phone-setup`
     does exactly the same — the two walks read as one design. The first paint keeps the title,
     which is what the dialog announces when it opens. */
  const firstStep = React.useRef(true);
  React.useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return undefined; }
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[data-testid="email-setup-prompt"]')?.focus({ preventScroll: true }));
    });
    return () => { window.cancelAnimationFrame(first); window.cancelAnimationFrame(second); };
  }, [step]);

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (caught) { setError(failure(caught)); } finally { setBusy(false); }
  }
  async function connect(mailbox: MailboxProvider) {
    await perform(async () => {
      const result = await emailWrote(beginEmailAuth(mailbox, window.location.hash.startsWith('#/onboarding') ? 'onboarding' : 'settings'));
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.hostname !== 'auth.unipile.com' || url.username || url.password)
        throw new Error('The mailbox authorization address needs another check.');
      window.location.assign(url.href);
    });
  }
  /* ── THE CUSTOMERS THIS MAILBOX IS READ FOR, PUSHED BEFORE THE FIRST SYNC ────────────────────
     The runtime reads only mail exchanged with an address bound to a customer, so a mailbox that
     connects with no bindings answers an empty history and the person reads it as a broken import.
     The bindings go up first, every customer with an address, and the history's own empty state
     then states how many were looked up. A binding that is refused leaves the others standing. */
  const accountEdits = useCustomerEdits();
  /* THE BOOK AS A HAND HAS WRITTEN IT (§122). An address typed on a customer sheet is exactly the
     address their mail arrives from, so the binding is read through the same fold every other
     surface reads the book through. */
  const customers = React.useMemo(() => derived.cast.customers.map(accountOf), [derived.cast, accountEdits]);
  const pushBindings = React.useCallback(async (row: MailboxAccount) => {
    const addressed = customers.filter(customer => customer.email && customer.email.includes('@'));
    if (!addressed.length) return;
    await Promise.allSettled(addressed.map(customer => emailWrote(bindEmailCustomer(row.account_ref, customer.email as string, customer.id))));
  }, [customers]);
  async function openMailbox(row: MailboxAccount, refresh = false) {
    await perform(async () => {
      setAccount(row); setStep('mailbox');
      if (row.mode === 'connected') await pushBindings(row);
      const page = await emailWrote(syncEmail(row.account_ref, refresh));
      setMessages(previous => refresh || account?.account_ref !== row.account_ref ? page.messages :
        [...new Map([...previous, ...page.messages].map(message => [message.source_ref, message])).values()]);
      setMore(Boolean(page.has_more)); setBound(typeof page.bound === 'number' ? page.bound : undefined);
      announceEmailRefresh(page.messages);
      await update();
    });
  }
  async function disconnect(row: MailboxAccount) {
    window.dispatchEvent(new CustomEvent('rocoto:email-disconnect', { detail: { phase: 'start', accountRef: row.account_ref } }));
    await perform(async () => {
      try {
        await emailWrote(disconnectEmail(row.account_ref));
        setAccount(null); setMessages([]); setSelected(null);
        const current = await update();
        setStep(current.accounts.length ? 'accounts' : 'choose');
        window.dispatchEvent(new CustomEvent('rocoto:email-disconnect', { detail: { phase: 'complete', accountRef: row.account_ref } }));
      } catch (caught) {
        window.dispatchEvent(new CustomEvent('rocoto:email-disconnect', { detail: { phase: 'cancel', accountRef: row.account_ref } }));
        throw caught;
      }
    });
  }
  if (step === 'invoices' && account) return <EmailInvoiceDiscovery account={account} presentation={presentation}
    onClose={onClose} onBack={() => setStep('mailbox')} />;

  const forwarded = accounts.find(row => row.mode === 'forwarded');
  const connected = accounts.filter(mailboxConnected);
  const mailbox = MAILBOX_CHOICES.find(choice => choice.id === chosen) ?? MAILBOX_CHOICES[0];
  const home = () => setStep(accounts.length ? 'accounts' : 'choose');
  const back = step === 'accounts' ? (presentation === 'page' ? onClose : undefined)
    : step === 'sample' && exampleId ? () => setExampleId(null)
      : step === 'choose' ? (accounts.length ? () => setStep('accounts') : (presentation === 'page' ? onClose : undefined))
        : () => { setSelected(null); home(); };
  const prompt: React.CSSProperties = { ...theme.typography.HeadingSmall, margin: 0, outline: 'none', overflowWrap: 'anywhere' };
  const quiet: React.CSSProperties = { ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, margin: 0 };

  return <ConnectionSetupFrame title={TITLES[step]} presentation={presentation} onClose={onClose} onBack={back} testId="email-connection">
    <div data-email-scope={scope} data-email-step={step} data-email-posture={capability.posture}
      style={{ ...theme.typography.ParagraphMedium, display: 'grid', gap: theme.sizing.scale600, minWidth: 0 }}>
      {error && step !== 'sample' && <p role="alert" style={{ color: theme.colors.contentNegative, margin: 0 }}>{error}</p>}
      {busy && <p role="status" style={quiet}>Checking your mailbox…</p>}

      {/* ── THE MAILBOXES THIS WORKSPACE HOLDS ─────────────────────────────────────────────── */}
      {/* THE HOUSE NEVER READS THE AGGREGATOR'S NAME (THE-SOURCE-PRIVACY-SPEC SRC-PRIV-06). A
          connected row already carries the mailbox the person chose and `SetupChoice`'s own
          `Connected` mark, so the row states that and nothing about the transport. */}
      {step === 'accounts' && <>
        {accounts.map(row => <div key={row.account_ref} style={{ display: 'grid', gap: theme.sizing.scale300 }}>
          <SetupChoice name={row.label} testId="email-connected-account"
            description={row.mode === 'forwarded' ? row.forwarding_address || 'Forwarding address'
              : mailboxConnected(row) ? (mailboxHistoryReady(row) ? undefined : 'Reading your mail history') : 'Authorization is finishing'}
            connected={mailboxConnected(row) && mailboxHistoryReady(row)}
            onClick={() => void openMailbox(row, true)} />
          <Button kind={KIND.tertiary} disabled={busy} onClick={() => void disconnect(row)} data-testid="email-disconnect">Disconnect email</Button>
        </div>)}
        {connected.length > 0 && <Button data-testid="email-continue" onClick={() => { if (status) onComplete?.(status); onClose(); }}>Continue</Button>}
        <Button kind={KIND.secondary} onClick={() => setStep('choose')} data-testid="email-add-mailbox">Add another</Button>
        {onSampleComplete && <Button kind={KIND.tertiary} onClick={() => setStep('sample')} data-testid="email-view-sample">Use test data</Button>}
      </>}

      {/* ── STEP ONE · ONE QUESTION, THREE SQUARE CHOICES ──────────────────────────────────── */}
      {step === 'choose' && <>
        <h2 data-testid="email-setup-prompt" tabIndex={-1} style={prompt}>Which mailbox do you use?</h2>
        <SetupChoices testId="email-mailbox-choices">
          {MAILBOX_CHOICES.map(choice => <SetupChoice key={choice.id} variant="tile" name={choice.name} logo={choice.logo}
            connected={capability.providers.includes(choice.id === 'google' ? 'gmail' : 'm365')}
            testId={`email-connect-${choice.id}`} onClick={() => { setChosen(choice.id); setError(''); setStep('authorize'); }} />)}
          {/* THE THIRD CHOICE IS TWO SHORT WORDS ON PURPOSE. `SetupChoice`'s tile label wraps with
              `overflowWrap: anywhere`, and at 320 px a tile is ~70 px of text: «Forwarding
              address» came out as «Forwardin / g address», read at 320 in this pass. The step it
              opens is still titled Forwarding address and still asks Peter's own prompt. */}
          <SetupChoice variant="tile" name="Forward mail" icon={<Forward size={20} aria-hidden />}
            testId="email-forwarding" onClick={() => { setError(''); setStep('forwarding'); }} />
        </SetupChoices>
        {onSampleComplete && <Button kind={KIND.tertiary} onClick={() => setStep('sample')} data-testid="email-view-sample">Use test data</Button>}
      </>}

      {/* ── STEP TWO · THE PROVIDER'S OWN AUTHORIZATION, AS ONE ACT ────────────────────────── */}
      {step === 'authorize' && <>
        <h2 data-testid="email-setup-prompt" tabIndex={-1} style={prompt}>Sign in to {mailbox.name}</h2>
        {status && !status.configured && <p data-testid="email-provider-pending" style={quiet}>Mailbox authorization is awaiting provider setup.</p>}
        <Button isLoading={busy} data-testid="email-authorize" onClick={() => void connect(mailbox.id)}>{mailbox.act}</Button>
      </>}

      {/* ── THE FORWARDING ADDRESS · ONE FACT AND ONE DONE ─────────────────────────────────── */}
      {step === 'forwarding' && <>
        <h2 data-testid="email-setup-prompt" tabIndex={-1} style={prompt}>Forward order email to this address</h2>
        {forwarded?.forwarding_address
          ? <strong data-testid="email-forwarding-address" style={{ ...theme.typography.HeadingLarge, overflowWrap: 'anywhere' }}>{forwarded.forwarding_address}</strong>
          : <p data-testid="email-forwarding-pending" style={quiet}>Your forwarding address is awaiting inbox setup.</p>}
        <Button data-testid="email-forwarding-done" onClick={home}>Done</Button>
      </>}

      {/* ── THE INBOX, REACHED ONLY FROM A CONNECTED ACCOUNT ───────────────────────────────── */}
      {step === 'mailbox' && account && <>
        <p style={quiet}>{account.label} · Incoming and sent</p>
        <Button disabled={busy} onClick={() => void openMailbox(account, true)} data-testid="email-refresh">Refresh email</Button>
        {messages.map(message => <SetupChoice key={message.source_ref} name={message.subject || 'Email'}
          description={`${message.from.join(', ')} · ${message.attachments.length} attachments`} testId="email-message"
          onClick={() => setSelected(message.source_ref)} />)}
        {/* THE COUNT IS THE RESPONSE'S OWN, AND THE SENTENCE IS ABOUT ROCOTO. A sync that carries
            no `bound` states the first sentence alone, so a runtime that has yet to answer with one
            never prints «0 customers»; and the reading is Rocoto's, so Rocoto is its subject. */}
        {!busy && messages.length === 0 && <p data-testid="email-history-empty" style={quiet}>
          Mail from your customers appears here.{bound === undefined ? '' : ` Rocoto read this mailbox for ${bound} ${bound === 1 ? 'customer' : 'customers'}.`}
        </p>}
        {more && <Button disabled={busy} onClick={() => void openMailbox(account)} data-testid="email-history-more">Read earlier email</Button>}
        {selected && <EmailThreadReader account={account} sourceRef={selected} />}
        <Button kind={KIND.secondary} onClick={() => setStep('invoices')} data-testid="email-open-invoice-history">Find earlier invoices</Button>
      </>}

      {/* ── ONBOARDING'S OWN REHEARSAL MAILBOX ─────────────────────────────────────────────── */}
      {step === 'sample' && <div data-testid="email-sample-mailbox" style={{ display: 'grid', gap: theme.sizing.scale500 }}>
        {exampleId ? examples.filter(example => example.saleId === exampleId).map(example => <div key={example.saleId} data-source-sale={example.saleId} data-source-customer={example.customerId}>
          <EmailConversation cast={derived.cast} thread={{ id: example.saleId, customer: { id: example.customerId,
            name: derived.cast.customers.find(customer => customer.id === example.customerId)?.name ?? 'Customer' } }} rows={example.rows} />
          <a href={`#/sales/${example.saleId}`}>View Delivery Note</a>
        </div>) : examples.map(example => <SetupChoice key={example.saleId}
          name={derived.cast.customers.find(customer => customer.id === example.customerId)?.name || 'Customer'}
          description={example.rows[0]?.email?.subject || 'Order'} testId={`email-inbox-thread-${example.saleId}`}
          onClick={() => setExampleId(example.saleId)} />)}
        {onSampleComplete && <Button onClick={onSampleComplete} data-testid="email-use-sample">Continue with test data</Button>}
      </div>}
    </div>
  </ConnectionSetupFrame>;
}

/** One thread reader for Settings and the inbox. Current refresh and earlier pages stay separate. */
export function EmailThreadReader({ account, sourceRef }: { account: MailboxAccount; sourceRef: string }) {
  const epoch = useEmailSourceEpoch();
  if (epoch > 0) return null;
  return <EmailThreadReaderContent key={`${account.account_ref}:${sourceRef}`} account={account} sourceRef={sourceRef} />;
}

function EmailThreadReaderContent({ account, sourceRef }: { account: MailboxAccount; sourceRef: string }) {
  const [, theme] = useStyletron();
  const [messages, setMessages] = React.useState<EmailMessage[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const active = React.useRef(true), running = React.useRef(false), olderLoaded = React.useRef(false);
  const request = React.useRef<AbortController | null>(null);
  const read = React.useCallback(async (next?: string) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      request.current = new AbortController();
      const page = await readEmailThread(sourceRef, next, request.current.signal);
      if (!active.current) return;
      setMessages(previous => mergeMailboxMessages(previous, page.messages));
      if (next) olderLoaded.current = true;
      if (next || !olderLoaded.current) setCursor(page.next_cursor ?? null);
    } catch (caught) {
      if (active.current) {
        if (next && caught instanceof ChannelApiError && [404, 409].includes(caught.status)) {
          olderLoaded.current = false; setCursor(null);
        }
        setError(failure(caught));
      }
    }
    finally { running.current = false; if (active.current) setBusy(false); }
  }, [sourceRef]);
  React.useEffect(() => {
    active.current = true; void read();
    const refresh = () => { if (!document.hidden) void read(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { active.current = false; request.current?.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [read]);
  return <div data-testid="email-thread-reader" style={{ display: 'grid', gap: theme.sizing.scale400 }}>
    {cursor && <Button kind={KIND.secondary} disabled={busy} data-testid="email-thread-more" onClick={() => void read(cursor)}>Older messages</Button>}
    {busy && <p role="status">Reading email…</p>}
    {error && <div role="alert"><p>{error}</p><Button kind={KIND.tertiary} onClick={() => void read()}>Refresh thread</Button></div>}
    <ConnectedEmailThread account={account} messages={messages} />
  </div>;
}

export function ConnectedEmailThread({ account, messages }: { account: MailboxAccount; messages: EmailMessage[] }) {
  const epoch = useEmailSourceEpoch();
  const source = `${account.account_ref}:${messages.map(message => `${message.source_ref}:${message.provenance.source_revision}`).join('|')}`;
  if (epoch > 0) return null;
  return <ConnectedEmailThreadContent key={source} account={account} messages={messages} />;
}

function ConnectedEmailThreadContent({ account, messages }: { account: MailboxAccount; messages: EmailMessage[] }) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const [review, setReview] = React.useState<EmailLineReview | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const active = React.useRef(true);
  React.useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  return <div data-testid="email-live-thread" style={{ ...theme.typography.ParagraphSmall, minWidth: 0, overflowWrap: 'anywhere' }}>
    {account.provider === 'imap' && account.mode !== 'forwarded' ? messages.map(message => <article key={message.source_ref}>
      <h2>{message.subject}</h2><p>{message.from.join(', ')}</p><p style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p>
    </article>) : <EmailConversation cast={derived.cast} thread={{ id: account.account_ref, customer: { name: account.label } }}
      rows={mailboxThreadRows(messages, account.label)} subject={messages[0]?.subject} />}
    {messages.flatMap(message => message.attachments.map(file => <Button key={`download-${file.attachment_ref}`} kind={KIND.tertiary}
      disabled={busy || !file.available} data-testid="email-download-attachment" onClick={() => {
        setBusy(true); setError(''); void downloadEmailAttachment(message.source_ref, file.attachment_ref).then(blob => {
          if (!active.current) return;
          const url = URL.createObjectURL(blob); const link = document.createElement('a');
          link.href = url; link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }).catch(error => setError(failure(error))).finally(() => setBusy(false));
      }}>Download {file.name}</Button>))}
    {messages.flatMap(message => message.attachments.filter(file => file.content_type === 'application/pdf').map(file =>
      <Button key={file.attachment_ref} disabled={busy || !file.available} kind={KIND.secondary} data-testid="email-parse-pdf"
        onClick={() => { setBusy(true); setError(''); void parseEmailAttachment(message.source_ref, file.attachment_ref)
          .then(result => { if (active.current) setReview(result); }).catch(error => { if (active.current) setError(failure(error)); }).finally(() => { if (active.current) setBusy(false); }); }}>Review {file.name}</Button>))}
    {busy && <p role="status">Reading PDF lines…</p>}
    {error && <p role="alert">{error}</p>}
    {review && <div data-testid="email-pdf-review"><h3 style={theme.typography.HeadingXSmall}>Document lines to review</h3>
      <details><summary>Source details</summary><p>{review.provenance.source_ref} · {review.provenance.method}</p></details>
      <DocumentLineTable result={review.result} />
    </div>}
  </div>;
}

type EmailInvoiceDiscoveryProps = {
  account: MailboxAccount; presentation: 'page' | 'dialog'; onClose: () => void; onBack?: () => void;
  onResults?: (messages: EmailMessage[]) => void;
};

export function EmailInvoiceDiscovery(props: EmailInvoiceDiscoveryProps) {
  const epoch = useEmailSourceEpoch();
  if (epoch > 0) return <ConnectionSetupFrame title="Connect email" presentation={props.presentation} onClose={props.onClose}>
    <Button onClick={props.onClose}>Continue</Button></ConnectionSetupFrame>;
  return <EmailInvoiceDiscoveryContent key={props.account.account_ref} {...props} />;
}

function EmailInvoiceDiscoveryContent({ account, presentation, onClose, onBack, onResults }: EmailInvoiceDiscoveryProps) {
  const [, theme] = useStyletron();
  const [consent, setConsent] = React.useState(false);
  const [query, setQuery] = React.useState('factura');
  const [results, setResults] = React.useState<EmailMessage[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const active = React.useRef(true);
  React.useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  return <ConnectionSetupFrame title={results ? 'Invoices to review' : 'Find earlier invoices'} presentation={presentation} onClose={onClose} onBack={onBack}
    description={results ? undefined : `Search invoice attachments in ${account.label}.`} testId="email-invoice-discovery">
    {results === null && <><Checkbox checked={consent} onChange={event => setConsent(event.currentTarget.checked)} data-testid="email-invoice-consent">Allow Rocoto to search earlier invoice email</Checkbox>
    <Input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="Invoice search" aria-label="Invoice search"
      overrides={{ Input: { props: { 'data-testid': 'email-invoice-query' } } }} />
    <Button disabled={!consent || busy || query.trim().length < 2} data-testid="email-invoice-search" onClick={() => {
      setBusy(true); setError(''); void consentEmailInvoices(account.account_ref, true)
        .then(() => searchEmailInvoices(account.account_ref, query.trim()))
        .then(page => { if (active.current) setResults(page.messages); })
        .catch(error => { if (active.current) setError(failure(error)); }).finally(() => { if (active.current) setBusy(false); });
    }}>{busy ? 'Searching invoice email…' : 'Search invoices'}</Button></>}
    {error && <p role="alert">{error}</p>}
    {results && <><p data-testid="email-invoice-results" style={theme.typography.ParagraphSmall}>{results.length} {results.length === 1 ? 'email' : 'emails'} to review</p>
      <ConnectedEmailThread account={account} messages={results} />
      <Button disabled={busy} data-testid="email-invoice-continue" onClick={() => { onResults?.(results); if (!onResults) onClose(); }}>Continue</Button>
      <Button kind={KIND.tertiary} onClick={() => setResults(null)}>Search again</Button></>}
  </ConnectionSetupFrame>;
}
