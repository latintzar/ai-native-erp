/* Channels check — one page, two rails, real providers.
 *
 * Email: the mailbox as the runtime reads it, through `/api/cedar/email/*` exactly as the product
 * calls it, laid out as a mail client so what comes back can be judged at a glance — the newest
 * page of all mail, the mail exchanged with known customers, the mailbox's own search; a thread
 * with each message as it was written (HTML in a sandboxed frame) and its files; a reply from the
 * connected mailbox; a composer that sends from that mailbox to any addresses typed, rich text and
 * files included. The list re-reads itself, so new mail lands at the top. Phone: the product's own `PhoneSetup` walk, with the runtime's evidence beside
 * it. Nothing here is simulated; every row came from the runtime, which got it from the provider.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Avatar } from 'baseui/avatar';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Skeleton } from 'baseui/skeleton';
import { Search, Upload, Delete, Plus } from 'baseui/icon';
import { channelApi, channelDownload, hasChannelWorkspace, resetChannelWorkspace } from '../cedar-channel-api';
import { bindEmailCustomer, disconnectEmail, readEmailStatus, readEmailThread, sendEmail,
  type EmailMessage, type EmailPage, type EmailStatus } from '../email-api';
import { PhoneSetup } from '../phone-setup';
import { usePhoneProvider } from '../phone-runtime';
import { fish } from '../../../scenarios/data/cast';

const ORIGIN = window.location.origin;
type Provider = 'google' | 'outlook';
type View = { kind: 'all'; page: number } | { kind: 'customers' } | { kind: 'search'; query: string };

/* ── small helpers ──────────────────────────────────────────────────────────────────────────── */

/** One key per content: the same words to the same people is the same message, so a second press
 *  returns the first receipt instead of a second send — the idempotency the runtime promises. */
function keyOf(parts: string[]): string {
  let hash = 0;
  for (const char of parts.join(' ')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(16);
}

const readFile = (file: File) => new Promise<{ name: string; content_type: string; data: string }>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error(`Choose ${file.name} again.`));
  reader.onload = () => {
    const url = String(reader.result);
    resolve({ name: file.name, content_type: file.type || 'application/octet-stream', data: url.slice(url.indexOf(',') + 1) });
  };
  reader.readAsDataURL(file);
});

function whenOf(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at.slice(0, 10);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const nameOf = (address: string) => {
  const local = address.split('@')[0] || address;
  return local.split(/[._-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || address;
};
const initialsOf = (address: string) => nameOf(address).split(' ').slice(0, 2).map(w => w[0]).join('');
const splitAddresses = (value: string) => value.split(/[,;\s]+/).map(a => a.trim()).filter(Boolean);
/** The message a reply answers: the latest one written by someone else, as a mail client does. */
const answerable = (thread: EmailMessage[], selected: EmailMessage, me: string) =>
  thread.find(m => (m.from[0] ?? '').toLowerCase() !== me.toLowerCase()) ?? thread[0] ?? selected;

/* ── the message as written, inside a sandboxed frame ───────────────────────────────────────── */

function HtmlFrame({ html, text }: { html: string; text: string }) {
  const [, theme] = useStyletron();
  const [height, setHeight] = React.useState(120);
  const frame = React.useRef<HTMLIFrameElement>(null);
  const body = html || `<pre style="white-space:pre-wrap;font:inherit;margin:0">${text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))}</pre>`;
  const doc = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data: cid:; style-src 'unsafe-inline'; font-src https: data:">
<base target="_blank"><style>body{margin:0;font:${theme.typography.ParagraphMedium.fontSize}/${theme.typography.ParagraphMedium.lineHeight} ${theme.typography.ParagraphMedium.fontFamily};color:${theme.colors.contentPrimary};overflow-wrap:anywhere}img{max-width:100%;height:auto}blockquote{border-left:3px solid ${theme.colors.borderOpaque};margin:0;padding-left:12px;color:${theme.colors.contentSecondary}}</style></head><body>${body}</body></html>`;
  const measure = React.useCallback(() => {
    const inner = frame.current?.contentDocument?.documentElement;
    if (inner) setHeight(Math.min(3200, Math.max(60, inner.scrollHeight + 8)));
  }, []);
  /* Images and fonts settle after the load event, so the frame is measured again for a few seconds. */
  React.useEffect(() => {
    const timers = [120, 400, 900, 1800, 3200, 5000].map(ms => window.setTimeout(measure, ms));
    return () => timers.forEach(window.clearTimeout);
  }, [doc, measure]);
  return (
    <iframe ref={frame} title="Message" srcDoc={doc} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" onLoad={measure}
      style={{ width: '100%', height, border: 0, display: 'block', backgroundColor: theme.colors.backgroundPrimary }} />
  );
}

/* ── a small rich-text editor: what the mail carries is the HTML it produces ────────────────── */

type Rich = { html: string; text: string };
function RichEditor({ value, onChange, placeholder, minHeight = 160, testId, initialHtml = '' }: { value: Rich; onChange: (next: Rich) => void; placeholder: string; minHeight?: number; testId?: string; initialHtml?: string }) {
  const [, theme] = useStyletron();
  const box = React.useRef<HTMLDivElement>(null);
  const emit = React.useCallback(() => { const el = box.current; if (el) onChange({ html: el.innerHTML, text: el.innerText }); }, [onChange]);
  const seeded = React.useRef(false);
  React.useEffect(() => { if (box.current && initialHtml && !seeded.current) { seeded.current = true; box.current.innerHTML = initialHtml; emit(); } }, [initialHtml, emit]);
  const command = (name: string, arg?: string) => { box.current?.focus(); document.execCommand(name, false, arg); emit(); };
  const tool = (label: string, name: string, arg?: string, title?: string) => (
    <button type="button" title={title ?? label} onMouseDown={e => e.preventDefault()} onClick={() => command(name, arg)}
      style={{ ...theme.typography.LabelSmall, minWidth: 30, height: 28, padding: '0 8px', borderRadius: theme.borders.radius200, border: `1px solid ${theme.colors.borderOpaque}`, backgroundColor: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, cursor: 'pointer' }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: 'grid', gap: theme.sizing.scale200 }}>
      <div style={{ display: 'flex', gap: theme.sizing.scale100, flexWrap: 'wrap' }}>
        {tool('B', 'bold')}{tool('I', 'italic')}{tool('U', 'underline')}
        {tool('• List', 'insertUnorderedList')}{tool('1. List', 'insertOrderedList')}{tool('Quote', 'formatBlock', 'blockquote')}
        <button type="button" title="Link the selected words" onMouseDown={e => e.preventDefault()}
          onClick={() => { const url = window.prompt('Link address'); if (url) command('createLink', url); }}
          style={{ ...theme.typography.LabelSmall, minWidth: 30, height: 28, padding: '0 8px', borderRadius: theme.borders.radius200, border: `1px solid ${theme.colors.borderOpaque}`, backgroundColor: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, cursor: 'pointer' }}>
          Link
        </button>
        {tool('Plain', 'removeFormat', undefined, 'Remove formatting')}
      </div>
      <div style={{ position: 'relative' }}>
        {value.text.trim() === '' && value.html.replace(/<[^>]+>/g, '').trim() === '' && (
          <span style={{ ...theme.typography.ParagraphMedium, position: 'absolute', top: 10, left: 12, color: theme.colors.contentTertiary, pointerEvents: 'none' }}>{placeholder}</span>
        )}
        <div ref={box} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={placeholder} data-testid={testId}
          onInput={emit} onBlur={emit}
          style={{ ...theme.typography.ParagraphMedium, minHeight, padding: '10px 12px', borderRadius: theme.borders.radius200, border: `1px solid ${theme.colors.borderOpaque}`, backgroundColor: theme.colors.backgroundPrimary, outline: 'none', overflowWrap: 'anywhere' }} />
      </div>
    </div>
  );
}

/* ── one compose box: a new message, a reply, a reply to all, a forward ────────────────────── */

type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';
type ComposeProps = {
  account: EmailStatus['accounts'][number]; mode: ComposeMode; origin?: EmailMessage; docked?: boolean;
  onSent: (line: string) => void; onClose: () => void;
};
const escapeHtml = (value: string) => value.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

function ComposeBox({ account, mode, origin, docked = false, onSent, onClose }: ComposeProps) {
  const [, theme] = useStyletron();
  const me = account.label.toLowerCase();
  const others = origin ? [...origin.from, ...origin.to].map(a => a.toLowerCase()).filter(a => a && a !== me) : [];
  const initial = React.useMemo(() => {
    if (!origin || mode === 'new') return { to: '', cc: '', subject: '', html: '' };
    const when = new Date(origin.at).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const original = origin.html || `<pre style="white-space:pre-wrap;font:inherit;margin:0">${escapeHtml(origin.body)}</pre>`;
    const quoted = `<br><br><div><p style="margin:0 0 6px 0;color:${theme.colors.contentSecondary}">On ${when}, ${nameOf(origin.from[0] ?? '')} &lt;${escapeHtml(origin.from[0] ?? '')}&gt; wrote:</p><blockquote style="border-left:3px solid ${theme.colors.borderOpaque};margin:0;padding-left:12px">${original}</blockquote></div>`;
    const base = origin.subject.replace(/^\s*((re|fwd?|rv|tr)\s*:\s*)+/i, '');
    if (mode === 'forward') return { to: '', cc: '', subject: `Fwd: ${base}`, html: quoted };
    const mine = origin.from.some(a => a.toLowerCase() === me);
    const to = mine ? origin.to : origin.from;
    const rest = others.filter(a => !to.map(f => f.toLowerCase()).includes(a));
    return { to: to.join(', '), cc: mode === 'replyAll' ? rest.join(', ') : '', subject: `Re: ${base}`, html: quoted };
  }, [origin, mode, others, me, theme.colors.contentSecondary, theme.colors.borderOpaque]);
  const [to, setTo] = React.useState(initial.to);
  const [cc, setCc] = React.useState(initial.cc);
  const [subject, setSubject] = React.useState(initial.subject);
  const [draft, setDraft] = React.useState<Rich>({ html: '', text: '' });
  const [files, setFiles] = React.useState<File[]>([]);
  const [carried, setCarried] = React.useState(mode === 'forward' ? (origin?.attachments ?? []) : []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const fileInput = React.useRef<HTMLInputElement>(null);
  const send = async () => {
    setBusy(true); setError('');
    try {
      const recipients = splitAddresses(to); const copies = splitAddresses(cc);
      const attachments = await Promise.all(files.map(readFile));
      for (const file of carried) {
        if (!origin) break;
        const blob = await channelDownload(`/email/sources/${origin.source_ref}/attachments/${file.attachment_ref}`);
        const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onerror = () => reject(new Error(`Choose ${file.name} again.`)); r.onload = () => { const u = String(r.result); resolve(u.slice(u.indexOf(',') + 1)); }; r.readAsDataURL(blob); });
        attachments.push({ name: file.name, content_type: file.content_type || blob.type || 'application/octet-stream', data });
      }
      const text = draft.text.trim();
      const receipt = await sendEmail(account.account_ref, {
        to: recipients, cc: copies, subject: subject.trim(), text, html: draft.html, attachments,
        in_reply_to: mode === 'reply' || mode === 'replyAll' ? origin?.source_ref : undefined,
        idempotency_key: `compose-${keyOf([mode, origin?.source_ref ?? '', ...recipients, ...copies, subject.trim(), text, ...attachments.map(f => `${f.name}:${f.data.length}`)])}`,
      });
      onSent(`«${subject.trim()}» sent from ${account.label} to ${[...recipients, ...copies].join(', ')}: receipt ${receipt.receipt_ref}${receipt.files ? `, ${receipt.files} file${receipt.files === 1 ? '' : 's'}` : ''}${receipt.repeated ? ' (this exact message was already sent; the mailbox kept the first)' : ''}`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const small: React.CSSProperties = { ...theme.typography.ParagraphSmall, margin: 0, color: theme.colors.contentSecondary };
  const shell: React.CSSProperties = docked
    ? { position: 'fixed', right: 24, bottom: 24, width: 640, maxWidth: 'calc(100vw - 48px)', zIndex: 20, boxShadow: theme.lighting.shadow600, backgroundColor: theme.colors.backgroundPrimary, borderRadius: theme.borders.radius400, border: `1px solid ${theme.colors.borderOpaque}` }
    : { backgroundColor: theme.colors.backgroundPrimary, borderRadius: theme.borders.radius400, border: `1px solid ${theme.colors.borderOpaque}` };
  const title = mode === 'new' ? 'New message' : mode === 'forward' ? 'Forward' : mode === 'replyAll' ? 'Reply to all' : 'Reply';
  return (
    <div style={{ ...shell, display: 'grid', gap: 10, padding: 16 }} data-testid="check-email-compose">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...theme.typography.LabelLarge }}>{title} · from {account.label}</span>
        <Button size={SIZE.mini} kind={KIND.tertiary} onClick={onClose} startEnhancer={<Delete size={16} />}>Close</Button>
      </div>
      <Input value={to} onChange={e => setTo(e.currentTarget.value)} placeholder="To" size="compact" overrides={{ Input: { props: { 'data-testid': 'check-email-to' } } }} />
      <Input value={cc} onChange={e => setCc(e.currentTarget.value)} placeholder="Cc" size="compact" overrides={{ Input: { props: { 'data-testid': 'check-email-cc' } } }} />
      <Input value={subject} onChange={e => setSubject(e.currentTarget.value)} placeholder="Subject" size="compact" overrides={{ Input: { props: { 'data-testid': 'check-email-subject' } } }} />
      <RichEditor value={draft} onChange={setDraft} placeholder="Write the message" minHeight={mode === 'new' ? 200 : 140} testId="check-email-body" initialHtml={initial.html} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={fileInput} type="file" multiple hidden onChange={e => setFiles(current => [...current, ...Array.from(e.currentTarget.files ?? [])])} aria-label="Files to attach" data-testid="check-email-files" />
        <Button size={SIZE.mini} kind={KIND.secondary} onClick={() => fileInput.current?.click()} startEnhancer={<Upload size={16} />}>Attach files</Button>
        {carried.map(f => (
          <span key={f.attachment_ref} style={{ ...theme.typography.LabelXSmall, display: 'inline-flex', gap: 6, alignItems: 'center', padding: '4px 8px', borderRadius: 10, backgroundColor: theme.colors.backgroundTertiary }}>
            📎 {f.name}
            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setCarried(current => current.filter(c => c.attachment_ref !== f.attachment_ref))} style={{ border: 0, background: 'none', cursor: 'pointer', color: theme.colors.contentSecondary, font: 'inherit' }}>×</button>
          </span>
        ))}
        {files.map((f, i) => (
          <span key={`${f.name}-${i}`} style={{ ...theme.typography.LabelXSmall, display: 'inline-flex', gap: 6, alignItems: 'center', padding: '4px 8px', borderRadius: 10, backgroundColor: theme.colors.backgroundTertiary }}>
            📎 {f.name} ({Math.max(1, Math.round(f.size / 1024))} KB)
            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(current => current.filter((_, j) => j !== i))} style={{ border: 0, background: 'none', cursor: 'pointer', color: theme.colors.contentSecondary, font: 'inherit' }}>×</button>
          </span>
        ))}
      </div>
      {error && <p role="alert" style={{ ...small, color: theme.colors.negative }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Button size={SIZE.compact} onClick={send} isLoading={busy} data-testid="check-email-send"
          disabled={splitAddresses(to).length === 0 || subject.trim().length === 0 || draft.text.trim().length === 0}>Send</Button>
        <span style={small}>{mode === 'new' || mode === 'forward' ? 'Unipile sends it from your mailbox; it shows in your Sent folder like any mail you write.' : 'Threads under the message you are answering, from your mailbox.'}</span>
      </div>
    </div>
  );
}

/* ── the mail client ────────────────────────────────────────────────────────────────────────── */

function MailCheck() {
  const [, theme] = useStyletron();
  const [status, setStatus] = React.useState<EmailStatus | null>(null);
  const [view, setView] = React.useState<View>({ kind: 'all', page: 1 });
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState<EmailPage | null>(null);
  const [selected, setSelected] = React.useState<EmailMessage | null>(null);
  const [thread, setThread] = React.useState<EmailMessage[]>([]);
  const [fresh, setFresh] = React.useState<Set<string>>(new Set());
  const known = React.useRef<Set<string> | null>(null);
  const [composing, setComposing] = React.useState<{ mode: ComposeMode; origin?: EmailMessage; key: number } | null>(null);
  const [receipts, setReceipts] = React.useState<string[]>([]);
  const [senderAddress, setSenderAddress] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const customers = React.useMemo(() => fish.customers.filter(c => c.email && c.email.includes('@')), []);
  const proofCustomer = fish.customers.find(c => c.id === 'latintzar');
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  };
  const refresh = React.useCallback(() => run('status', async () => { setStatus(await readEmailStatus()); }), []);
  React.useEffect(() => { void refresh(); }, [refresh]);
  const account = status?.accounts[0];

  /* One read for a chosen view; `quiet` is the list refreshing itself, which keeps the open
     thread and marks the rows that were not there before. */
  const read = React.useCallback((next: View, refreshNewest = false, quiet = false) => run(quiet ? 'refresh' : 'read', async () => {
    if (!account) return;
    const request = next.kind === 'all' ? { scope: 'all', refresh: refreshNewest || next.page === 1 }
      : next.kind === 'customers' ? { scope: 'customers' } : { query: next.query };
    const answer = await channelApi<EmailPage>(`/email/accounts/${account.account_ref}/sync`, { body: request });
    const refs = new Set(answer.messages.map(m => m.source_ref));
    if (quiet && known.current) setFresh(new Set([...refs].filter(ref => !known.current?.has(ref))));
    else setFresh(new Set());
    known.current = refs;
    setView(next); setPage(answer);
    if (!quiet) { setSelected(null); setThread([]); }
  }), [account]);
  React.useEffect(() => { if (account && !page && busy === '') void read({ kind: 'all', page: 1 }); }, [account, page, busy, read]);
  /* New mail lands at the top by itself: the current view is re-read every thirty seconds and
     whenever the tab comes back into view. */
  const current = React.useRef<View>(view);
  current.current = view;
  React.useEffect(() => {
    if (!account) return undefined;
    const again = () => {
      const v = current.current;
      if (document.visibilityState === 'visible' && (v.kind !== 'all' || v.page === 1)) void read(v, v.kind === 'all', true);
    };
    const timer = window.setInterval(again, 30000);
    document.addEventListener('visibilitychange', again);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', again); };
  }, [account, read]);

  const connect = (provider: Provider) => run('auth', async () => {
    const link = await channelApi<{ url: string }>('/email/auth', { body: { provider, return_to: 'check' } });
    window.location.assign(link.url);
  });
  const open = (message: EmailMessage) => run('thread', async () => {
    setSelected(message); setComposing(current => (current?.mode === 'new' ? current : null));
    setThread((await readEmailThread(message.source_ref)).messages);
  });
  const reopen = React.useCallback((message: EmailMessage) => run('refresh', async () => {
    setThread((await readEmailThread(message.source_ref)).messages);
  }), []);
  const download = (message: EmailMessage, attachment: EmailMessage['attachments'][number]) => run(`file:${attachment.attachment_ref}`, async () => {
    const blob = await channelDownload(`/email/sources/${message.source_ref}/attachments/${attachment.attachment_ref}`);
    setNote(`${attachment.name}: ${blob.size} bytes from the mailbox.`);
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  });
  const startCompose = (mode: ComposeMode, origin?: EmailMessage) => setComposing({ mode, origin, key: Date.now() });
  const sent = (line: string) => {
    setReceipts(current => [line, ...current]);
    const answered = composing?.origin;
    setComposing(null);
    if (answered && selected) window.setTimeout(() => { void reopen(selected); }, 4000);
  };
  const bind = () => run('bind', async () => {
    if (!account) return;
    const results = await Promise.allSettled(customers.map(c => bindEmailCustomer(account.account_ref, c.email as string, c.id)));
    setNote(`${results.filter(r => r.status === 'fulfilled').length} of ${customers.length} customer addresses registered from the book.`);
  });
  const bindSender = () => run('bind-sender', async () => {
    if (!account || !proofCustomer) return;
    const address = senderAddress.trim().toLowerCase();
    if (!address.includes('@')) throw new Error('Type the full address that plays a customer.');
    await bindEmailCustomer(account.account_ref, address, proofCustomer.id);
    setNote(`${address} is ${proofCustomer.name}: mail from it lands on that customer.`);
  });
  const disconnect = (ref: string) => run(`disconnect:${ref}`, async () => {
    await disconnectEmail(ref);
    setPage(null); setSelected(null); setThread([]); setFresh(new Set()); known.current = null; setNote(''); setReceipts([]); setComposing(null); setView({ kind: 'all', page: 1 });
    await refresh();
  });

  const messages = page?.messages ?? [];
  const label = (v: View) => v.kind === 'all' ? 'All mail' : v.kind === 'customers' ? 'With customers' : `Search «${v.query}»`;
  const text: React.CSSProperties = { ...theme.typography.ParagraphMedium, margin: 0 };
  const small: React.CSSProperties = { ...theme.typography.ParagraphSmall, margin: 0, color: theme.colors.contentSecondary };
  const railItem = (active: boolean): React.CSSProperties => ({ ...theme.typography.LabelMedium, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%',
    padding: '8px 12px', borderRadius: theme.borders.radius300, border: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit',
    backgroundColor: active ? theme.colors.backgroundTertiary : 'transparent', color: theme.colors.contentPrimary, fontWeight: active ? 700 : 500 });
  const card: React.CSSProperties = { backgroundColor: theme.colors.backgroundPrimary, borderRadius: theme.borders.radius400, border: `1px solid ${theme.colors.borderOpaque}` };

  return (
    <section style={{ display: 'grid', gap: theme.sizing.scale500 }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
        <h2 style={{ ...theme.typography.HeadingMedium, margin: 0, whiteSpace: 'nowrap' }}>Mail</h2>
        <div style={{ flex: '1 1 360px', maxWidth: 720 }}>
          <Input value={query} onChange={e => setQuery(e.currentTarget.value)} placeholder="Search the mailbox — Gmail syntax, for example pedido has:attachment"
            startEnhancer={<Search size={20} />} clearable disabled={!account} overrides={{ Input: { props: { 'data-testid': 'check-email-filter' } } }}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim().length >= 2) void read({ kind: 'search', query: query.trim() }); }} />
        </div>
        {account && <Button size={SIZE.compact} onClick={() => read({ kind: 'search', query: query.trim() })} disabled={query.trim().length < 2} kind={KIND.secondary} data-testid="check-email-filter-run">Search</Button>}
        {account && <Button size={SIZE.compact} onClick={() => startCompose('new')} startEnhancer={<Plus size={18} />} data-testid="check-email-compose-open">Compose</Button>}
      </div>
      {error && <p role="alert" style={{ ...text, color: theme.colors.negative }}>{error}</p>}
      {note && <p style={small} data-testid="check-email-note">{note}</p>}
      {receipts.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }} data-testid="check-email-receipts">
          {receipts.slice(0, 3).map((line, index) => <p key={index} style={{ ...small, color: theme.colors.positive }}>✓ {line}</p>)}
        </div>
      )}

      {/* three panes */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(340px, 0.95fr) minmax(420px, 1.25fr)', gap: theme.sizing.scale500, alignItems: 'stretch', minHeight: 640 }}>
        {/* rail */}
        <nav style={{ display: 'grid', gap: theme.sizing.scale300, alignContent: 'start' }}>
          <button type="button" style={railItem(view.kind === 'all')} onClick={() => read({ kind: 'all', page: 1 }, true)} disabled={!account} data-testid="check-email-history">
            <span>All mail</span>{view.kind === 'all' && page && <span style={small}>{messages.length}{page.has_more ? '+' : ''}</span>}
          </button>
          <button type="button" style={railItem(view.kind === 'customers')} onClick={() => read({ kind: 'customers' })} disabled={!account} data-testid="check-email-customers">
            <span>With customers</span>{view.kind === 'customers' && page && <span style={small}>{messages.length}</span>}
          </button>
          {view.kind === 'search' && (
            <button type="button" style={railItem(true)} onClick={() => read(view)}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Search «{view.query}»</span><span style={small}>{messages.length}</span>
            </button>
          )}
          <div style={{ height: 1, backgroundColor: theme.colors.borderOpaque, margin: '8px 0' }} />
          <p style={{ ...theme.typography.LabelSmall, margin: '0 12px', color: theme.colors.contentSecondary }}>Mailboxes at Unipile{status ? (status.configured ? '' : ' · awaiting the provider key') : ' · reading…'}</p>
          {status?.accounts.map((mailbox, index) => (
            <div key={mailbox.account_ref} style={{ display: 'grid', gap: 2, padding: '4px 12px' }}>
              <span style={{ ...theme.typography.LabelSmall, overflow: 'hidden', textOverflow: 'ellipsis' }}>{index === 0 ? 'Reading ' : 'Also '}{mailbox.label}</span>
              <span style={small}>{mailbox.provider} · {mailbox.status}</span>
              <Button size={SIZE.mini} kind={KIND.tertiary} onClick={() => disconnect(mailbox.account_ref)} isLoading={busy === `disconnect:${mailbox.account_ref}`} data-testid="check-email-disconnect" overrides={{ BaseButton: { style: { justifyContent: 'flex-start', paddingLeft: 0 } } }}>
                Disconnect{index > 0 ? ' this one' : ''}
              </Button>
            </div>
          ))}
          <div style={{ display: 'grid', gap: 6, padding: '4px 12px' }}>
            {([['google', 'Gmail', '/connection-brands/gmail.png'], ['outlook', 'Microsoft 365', '/connection-brands/microsoft.png']] as [Provider, string, string][]).map(([id, name, logo]) => (
              <button key={id} type="button" onClick={() => connect(id)} disabled={busy === 'auth'} data-testid={`check-email-${id}`}
                style={{ ...theme.typography.LabelSmall, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: theme.borders.radius300, border: `1px solid ${theme.colors.borderOpaque}`, backgroundColor: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                <img src={logo} alt="" width={22} height={22} style={{ objectFit: 'contain' }} />
                <span>Connect {name}</span>
              </button>
            ))}
          </div>
          {account && proofCustomer && (
            <details style={{ padding: '4px 12px' }}>
              <summary style={{ ...theme.typography.LabelSmall, cursor: 'pointer', color: theme.colors.contentSecondary }}>Test customers</summary>
              <div style={{ display: 'grid', gap: 6, paddingTop: 6 }}>
                <input value={senderAddress} onChange={e => setSenderAddress(e.currentTarget.value)} type="email" placeholder="address that plays a customer" aria-label={`Customer address for ${proofCustomer.name}`} data-testid="check-email-sender"
                  style={{ ...theme.typography.ParagraphSmall, padding: 6, borderRadius: theme.borders.radius200, border: `1px solid ${theme.colors.borderOpaque}`, width: '100%' }} />
                <Button size={SIZE.mini} kind={KIND.secondary} onClick={bindSender} isLoading={busy === 'bind-sender'} data-testid="check-email-bind-sender">This address is {proofCustomer.name}</Button>
                <Button size={SIZE.mini} kind={KIND.tertiary} onClick={bind} isLoading={busy === 'bind'} data-testid="check-email-bind">Register the book's {customers.length} addresses</Button>
              </div>
            </details>
          )}
        </nav>

        {/* list */}
        <div style={{ ...card, display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }} data-testid="check-email-inbox">
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${theme.colors.borderOpaque}`, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <span style={{ ...theme.typography.LabelMedium }}>{account ? label(view) : 'Connect a mailbox'}{view.kind === 'all' && view.page > 1 ? ` · page ${view.page}` : ''}</span>
            <span style={small}>{busy === 'read' ? 'asking the mailbox…' : busy === 'refresh' ? 'checking for new mail…' : page ? `${messages.length} rows${fresh.size ? ` · ${fresh.size} new` : ''}${page.bound !== undefined ? ` · ${page.bound} customer address${page.bound === 1 ? '' : 'es'}` : ''}${page.unnamed ? ` · ${page.unnamed} listed empty` : ''}` : ''}</span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '72vh' }}>
            {busy === 'read' && messages.length === 0 && [0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ padding: '12px 14px' }}><Skeleton rows={2} width="100%" height="40px" animation /></div>)}
            {busy !== 'read' && page && messages.length === 0 && <p style={{ ...small, padding: 16 }}>The mailbox answered 0 rows for this read.</p>}
            {messages.map(message => {
              const active = selected?.source_ref === message.source_ref;
              const sender = message.from[0] ?? '';
              return (
                <button key={message.source_ref} type="button" onClick={() => open(message)} data-testid="check-email-row"
                  style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 12, alignItems: 'start', width: '100%', textAlign: 'left', padding: '10px 14px', border: 0, cursor: 'pointer', font: 'inherit',
                    borderLeft: `3px solid ${active ? theme.colors.contentPrimary : 'transparent'}`, borderBottom: `1px solid ${theme.colors.borderTransparent}`,
                    backgroundColor: active ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary, color: theme.colors.contentPrimary }}>
                  <Avatar name={nameOf(sender)} size="36px" initials={initialsOf(sender)} />
                  <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <span style={{ ...theme.typography.LabelMedium, fontWeight: message.unread ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fresh.has(message.source_ref) && <span style={{ ...theme.typography.LabelXSmall, marginRight: 8, padding: '1px 6px', borderRadius: 10, backgroundColor: theme.colors.contentPrimary, color: theme.colors.contentInversePrimary }}>new</span>}
                      {nameOf(sender)}{message.customerId ? <span style={{ ...theme.typography.LabelXSmall, marginLeft: 8, padding: '1px 6px', borderRadius: 10, backgroundColor: theme.colors.backgroundTertiary, color: theme.colors.contentSecondary }}>customer · {message.customerId}</span> : null}
                    </span>
                    <span style={{ ...theme.typography.ParagraphSmall, fontWeight: message.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.subject || '(untitled)'}</span>
                    <span style={{ ...small, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.snippet || sender}</span>
                    {message.attachments.length > 0 && (
                      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {message.attachments.map(a => a.name).join(' · ')}</span>
                    )}
                  </span>
                  <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{whenOf(message.at)}</span>
                </button>
              );
            })}
          </div>
          <div style={{ padding: 10, borderTop: `1px solid ${theme.colors.borderOpaque}`, display: 'flex', gap: 8, alignItems: 'center' }}>
            {page && view.kind === 'all' && page.has_more && <Button size={SIZE.mini} kind={KIND.secondary} onClick={() => read({ kind: 'all', page: view.page + 1 })} isLoading={busy === 'read'}>Older mail</Button>}
            {page && view.kind === 'all' && view.page > 1 && <Button size={SIZE.mini} kind={KIND.tertiary} onClick={() => read({ kind: 'all', page: 1 }, true)}>Newest</Button>}
            <span style={small}>{page?.coverage ?? ''}</span>
          </div>
        </div>

        {/* reading pane */}
        <div style={{ ...card, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }} data-testid="check-email-thread">
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
            <h3 style={{ ...theme.typography.HeadingSmall, margin: 0, overflowWrap: 'anywhere' }}>{selected ? (selected.subject || '(untitled)') : 'Reading pane'}</h3>
            {selected && <p style={small}>{thread.length || 1} message{thread.length === 1 ? '' : 's'} in this thread{selected.customerId ? ` · customer ${selected.customerId}` : ''}</p>}
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '72vh', padding: 18, display: 'grid', gap: 18, alignContent: 'start' }}>
            {!selected && <p style={small}>Choose a message to read it here as it was written.</p>}
            {selected && busy === 'thread' && <Skeleton rows={4} width="100%" height="120px" animation />}
            {thread.map(message => {
              const sender = message.from[0] ?? '';
              return (
                <article key={message.source_ref} style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12, alignItems: 'center' }}>
                    <Avatar name={nameOf(sender)} size="40px" initials={initialsOf(sender)} />
                    <div style={{ display: 'grid', minWidth: 0 }}>
                      <span style={{ ...theme.typography.LabelMedium }}>{nameOf(sender)} <span style={{ ...small, display: 'inline' }}>&lt;{sender}&gt;</span></span>
                      <span style={small}>to {message.to.map(a => a.toLowerCase() === account?.label.toLowerCase() ? 'you' : a).join(', ') || 'you'}</span>
                    </div>
                    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{new Date(message.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <HtmlFrame html={message.html ?? ''} text={message.body} />
                  {message.attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {message.attachments.map(attachment => (
                        <button key={attachment.attachment_ref} type="button" onClick={() => download(message, attachment)} title={attachment.content_type}
                          style={{ ...theme.typography.LabelSmall, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: theme.borders.radius300, border: `1px solid ${theme.colors.borderOpaque}`, backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.contentPrimary, cursor: 'pointer', font: 'inherit' }}>
                          📎 {attachment.name}{busy === `file:${attachment.attachment_ref}` ? ' …' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            {selected && thread.length > 0 && account && (composing?.mode === 'new' || !composing) && (
              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                {(['reply', 'replyAll', 'forward'] as ComposeMode[]).map(mode => (
                  <Button key={mode} size={SIZE.compact} kind={KIND.secondary} onClick={() => startCompose(mode, answerable(thread, selected, account.label))} data-testid={`check-email-${mode}`}
                    overrides={{ BaseButton: { style: { borderRadius: theme.borders.radius400 } } }}>
                    {mode === 'reply' ? '↩ Reply' : mode === 'replyAll' ? '↩↩ Reply all' : '↪ Forward'}
                  </Button>
                ))}
              </div>
            )}
            {selected && account && composing && composing.mode !== 'new' && (
              <ComposeBox key={composing.key} account={account} mode={composing.mode} origin={composing.origin} onSent={sent} onClose={() => setComposing(null)} />
            )}
          </div>
        </div>
      </div>

      {/* a new message, docked bottom-right like a mail client */}
      {composing?.mode === 'new' && account && (
        <ComposeBox key={composing.key} account={account} mode="new" docked onSent={sent} onClose={() => setComposing(null)} />
      )}
    </section>
  );
}

function PhoneCheck() {
  const [, theme] = useStyletron();
  const provider = usePhoneProvider();
  const [open, setOpen] = React.useState(false);
  const text: React.CSSProperties = { ...theme.typography.ParagraphMedium, margin: 0 };
  const line = provider.evidence?.lines.find(l => l.line_id === provider.evidence?.default_line_id) ?? provider.evidence?.lines[0];
  return (
    <section style={{ display: 'grid', gap: theme.sizing.scale500, padding: theme.sizing.scale700, borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundSecondary }}>
      <h2 style={{ ...theme.typography.HeadingMedium, margin: 0 }}>Phone</h2>
      <p style={text}>
        {provider.status === 'checking' ? 'Reading the phone connection…' : provider.status === 'unavailable' ? `Phone connection: ${provider.error || 'awaiting setup'}` :
          line ? `Line ${line.readiness.inbound_number || '(number pending)'} · ${line.mode} · forwarding ${line.readiness.forwarding_state} · caller ID ${line.readiness.caller_id_verified ? 'ready' : 'pending'} · browser ${line.readiness.browser_ready ? 'ready' : 'pending'} · transcripts ${line.readiness.transcription_ready ? 'ready' : 'pending'}` :
            'This workspace is ready for its first line: the walk below buys the Rocoto number at the mobile step.'}
      </p>
      {open ? (
        <div style={{ borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundPrimary, padding: theme.sizing.scale600 }}>
          <PhoneSetup presentation="page" tenant="fish" sourceNumber="" members={[]} onClose={() => setOpen(false)} onComplete={() => setOpen(false)} />
        </div>
      ) : <div><Button size={SIZE.compact} kind={KIND.secondary} onClick={() => setOpen(true)} data-testid="check-phone-open">Open phone setup</Button></div>}
      <details style={{ ...theme.typography.ParagraphSmall }}>
        <summary style={{ cursor: 'pointer', color: theme.colors.contentSecondary }}>Runtime evidence (raw)</summary>
        <pre style={{ ...theme.typography.MonoParagraphXSmall, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: theme.sizing.scale400, borderRadius: theme.borders.radius200, backgroundColor: theme.colors.backgroundTertiary }}>
          {JSON.stringify(provider.evidence ?? provider.error ?? 'reading…', null, 2)}
        </pre>
      </details>
      <p style={{ ...text, color: theme.colors.contentSecondary }}>Calls themselves run in Cedar: <a href={`${ORIGIN}/cedar/#/customers`} style={{ color: theme.colors.linkText }}>open Cedar</a>, choose a customer, Call.</p>
    </section>
  );
}

export function ChannelsCheck() {
  const [, theme] = useStyletron();
  const [workspace, setWorkspace] = React.useState(hasChannelWorkspace());
  return (
    <main style={{ maxWidth: 1440, margin: '0 auto', padding: theme.sizing.scale700, display: 'grid', gap: theme.sizing.scale800 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
        <h1 style={{ ...theme.typography.HeadingLarge, margin: 0 }}>Channels check</h1>
        <p style={{ ...theme.typography.ParagraphSmall, margin: 0, color: theme.colors.contentSecondary }}>
          {ORIGIN} · the same channel workspace as Cedar on this origin{workspace ? '' : ' (allocated on the first action)'}.
          <Button size={SIZE.mini} kind={KIND.tertiary} onClick={() => { resetChannelWorkspace(); setWorkspace(false); window.location.reload(); }}>Start a fresh workspace</Button>
        </p>
      </header>
      <MailCheck />
      <PhoneCheck />
    </main>
  );
}
