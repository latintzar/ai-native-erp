import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { ArrowLeft, Mail, MessageCircle, Phone, X } from 'lucide-react';
import { ConversationMessages, HistoryStatus } from './connections/app';
import { useProofPolling } from './connections/hooks';
import type { Conversation } from './connections/types';
import { WhatsAppSetupState, useWhatsAppCapability, useWhatsAppConnection } from './whatsapp-connection';
import { usePhoneCapability } from './phone-runtime';
import { useConfig } from './config';
import { syncEmail, type EmailMessage, type MailboxAccount } from './email-api';
import { EmailThreadReader, EmailConnection } from './email-connection';
import { EmailSetupState } from './email-setup-state';
import { emailWrote, mailboxConnected, useEmailCapability } from './email-provider';
import { PhoneHistory } from './phone-history';
import { openPhoneDial } from './phone-session';
import { ChannelApiError } from './cedar-channel-api';

function WhatsAppInbox({ number, sector }: { number?: string; sector: string }) {
  const [, theme] = useStyletron();
  const account = useWhatsAppConnection();
  /* ── ONE SOURCE FOR WHATSAPP'S STANDING, AND THIS PANEL IS A READER (§246 · §247.2) ──────────
     Two things used to happen here. Merely LOOKING at the connected-accounts panel wrote a
     persistent «selected» flag for an account that may never have existed — a reader with a side
     effect, on a fact the whole app then read as activation. And the gate asked
     `Boolean(state.connection)`, which says Connected about a connection bound to ANOTHER
     workspace. The shared capability is the whole of what it asks now, and it writes nothing. */
  const whatsapp = useWhatsAppCapability(sector);
  /* THE CALL ENTRANCE READS THE SAME PHONE CAPABILITY IT OPENS (§246). The press goes through the
     one dial door either way; stating the posture here means a reader can see what the entrance
     knows before the dial mounts. */
  const phone = usePhoneCapability();
  const [selected, setSelected] = React.useState<Conversation | null>(null);
  const [query, setQuery] = React.useState('');
  const locked = React.useCallback(() => {
    setSelected(null);
    window.dispatchEvent(new CustomEvent('cedar-whatsapp-refresh', { detail: { renew: true } }));
  }, []);
  const conversations = useProofPolling<{ conversations: Conversation[] }>('/conversations', whatsapp.bound, locked);
  React.useEffect(() => {
    if (number && conversations.data) {
      const match = conversations.data.conversations.find(item => item.number.replace(/\D/g, '') === number.replace(/\D/g, ''));
      if (match) setSelected(match);
    }
  }, [number, conversations.data]);
  const identity = whatsapp.connection?.phoneId;
  React.useEffect(() => { setSelected(null); }, [identity]);
  const small = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 };
  if (!whatsapp.bound) return <div data-testid="connected-whatsapp-setup" style={{ display: 'grid', gap: theme.sizing.scale500 }}>
    <h2 style={{ ...theme.typography.HeadingSmall, margin: 0 }}>WhatsApp conversations</h2>
    <WhatsAppSetupState sector={sector} />
  </div>;
  /* §246 · ONE CALL ENTRANCE, ONE OUTCOME. This act used to place the call itself, so on an
     account with no commissioned line it painted a red sentence inside the inbox while the very
     same press on the customer sheet showed the phone artwork and one `Connect phone`. It now goes
     through the shared door, which reads the one capability and opens the dial above this inbox —
     the inbox is component state, so a route change would take it away. The answer-device choice
     belongs to the dial, where the call is actually placed. */
  const call = () => {
    if (!selected) return;
    openPhoneDial({ number: selected.number.startsWith('+') ? selected.number : `+${selected.number}` });
  };
  if (selected) return <div style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
      <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setSelected(null)} startEnhancer={() => <ArrowLeft size={16} aria-hidden />}>Conversations</Button>
      <Button kind={KIND.secondary} size={SIZE.compact} data-testid="connected-inbox-call" data-phone-posture={phone.posture} onClick={call} startEnhancer={() => <Phone size={16} aria-hidden />}>Call</Button>
    </header>
    <ConversationMessages key={`${identity}:${selected.id}`} conversation={selected} onBack={() => setSelected(null)} onLocked={locked} />
    <PhoneHistory number={selected.number.startsWith('+') ? selected.number : `+${selected.number}`} displayName={selected.name} />
  </div>;
  const items = conversations.data?.conversations.filter(item => `${item.name} ${item.number} ${item.lastMessage}`.toLowerCase().includes(query.toLowerCase())) || [];
  return <div style={{ display: 'grid', gap: theme.sizing.scale500 }}>
    {account.state && <HistoryStatus state={account.state} />}
    <Input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="Search conversations" aria-label="Search connected WhatsApp conversations" />
    {conversations.error && <p role="alert" style={small}>{conversations.error}</p>}
    {items.map(item => <button key={item.id} onClick={() => setSelected(item)} data-testid="connected-whatsapp-conversation"
      style={{ textAlign: 'left', border: 0, borderBottom: `1px solid ${theme.colors.borderOpaque}`, background: theme.colors.backgroundPrimary,
        color: theme.colors.contentPrimary, padding: `${theme.sizing.scale500} 0`, cursor: 'pointer', minWidth: 0, display: 'grid', gap: theme.sizing.scale300 }}>
      <strong style={theme.typography.LabelMedium}>{item.name || item.number}</strong>
      <span style={{ ...small, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.lastMessage}</span>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{new Date(item.lastAt).toLocaleString('en-GB')} · {item.count} messages</span>
    </button>)}
    {items.length === 0 && <p role="status" style={small}>{query ? 'Try another name or phone number.' : conversations.busy ? 'Reading your conversations…' : 'Shared conversations will appear here as Meta delivers them.'}</p>}
  </div>;
}

/* ── THE CONNECTED INBOX READS THE ONE CONNECTION STATE (FEED-IA §247.2) ──────────────────────
 * This panel used to fetch its own `GET /email/status`, draw an account button per row and offer a
 * small `Connect email` beside the history whatever the state was — so a workspace with nothing
 * connected got an empty list, a spinner and a mailbox control, while the very same account showed
 * the envelope and one act on the customer sheet. It now reads `useEmailCapability` like every
 * other entrance: one picture and one `Connect email` until the mailbox is live, and the inbox
 * only once it is. */
function EmailInbox() {
  const [, theme] = useStyletron();
  const capability = useEmailCapability();
  /* ── THE RECORD IS NEVER WHAT THE RULE REMOVES ────────────────────────────────────────────
     A forwarding address is a real source: mail arrived on it and the house holds it. Listing only
     `mailboxConnected` rows dropped that account from this panel entirely, so a workspace whose
     orders arrive on its commissioned forwarding address could open none of its own mail here, and
     a workspace with Gmail BESIDE a forwarding address silently lost the forwarded half under a
     header that says «Email accounts». Every account this workspace holds a record through is
     listed and opens; `posture === 'ready'` gates the SEND and the mailbox-only controls. */
  const accounts = capability.accounts.filter(row => mailboxConnected(row) || row.mode === 'forwarded') as MailboxAccount[];
  const [account, setAccount] = React.useState<MailboxAccount | null>(null);
  const [messages, setMessages] = React.useState<EmailMessage[]>([]);
  const [thread, setThread] = React.useState<string | null>(null);
  const [setup, setSetup] = React.useState(false);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const generation = React.useRef(0);
  const small = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 };
  const fail = (caught: unknown) => setError(caught instanceof ChannelApiError ? caught.message : 'Email needs another connection check.');
  React.useEffect(() => {
    const reset = () => { generation.current++; setAccount(null); setMessages([]); setThread(null); };
    window.addEventListener('rocoto:channel-workspace-reset', reset);
    return () => { generation.current++; window.removeEventListener('rocoto:channel-workspace-reset', reset); };
  }, []);
  /* A mailbox the provider stopped reporting takes its open thread with it. */
  React.useEffect(() => {
    if (account && !accounts.some(row => row.account_ref === account.account_ref)) {
      generation.current++; setAccount(null); setMessages([]); setThread(null);
    }
  }, [accounts, account]);
  const load = (next: MailboxAccount) => {
    const current = ++generation.current; setAccount(next); setMessages([]); setThread(null); setBusy(true); setError('');
    void emailWrote(syncEmail(next.account_ref, true)).then(page => { if (generation.current === current) setMessages(page.messages); })
      .catch(caught => { if (generation.current === current) fail(caught); }).finally(() => { if (generation.current === current) setBusy(false); });
  };
  React.useEffect(() => {
    if (!account) return;
    let active = true, running = false;
    const refresh = async () => {
      if (!active || running || document.hidden) return;
      running = true;
      const current = generation.current;
      try {
        const page = await emailWrote(syncEmail(account.account_ref, true));
        if (active && generation.current === current) setMessages(page.messages);
      } catch (caught) { if (active && generation.current === current) fail(caught); }
      finally { running = false; }
    };
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [account?.account_ref]);
  const door = setup && <EmailConnection scope="connected-account" presentation="dialog" onClose={() => setSetup(false)} onComplete={() => setSetup(false)} />;
  if (!accounts.length) return <div data-testid="connected-email-setup" style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
    <h2 style={{ ...theme.typography.HeadingSmall, margin: 0 }}>Email accounts</h2>
    <EmailSetupState onOpenSetup={() => setSetup(true)} />
    {door}
  </div>;
  return <div style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
    {/* THE NAME HERE IS A WHOLE EMAIL ADDRESS. A forwarding address in this heading pushed «Add a
        mailbox» past the panel's own edge at 320, so the head wraps and the address breaks. */}
    <header style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', minWidth: 0 }}>
      <h2 style={{ ...theme.typography.HeadingSmall, margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>{account?.label || 'Email accounts'}</h2>
      <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="connected-email-accounts" onClick={() => setSetup(true)}>Add a mailbox</Button>
    </header>
    {error && <p role="alert" style={small}>{error}</p>}
    {accounts.map(item => <Button key={item.account_ref} kind={account?.account_ref === item.account_ref ? KIND.primary : KIND.secondary} onClick={() => load(item)}>{item.label}</Button>)}
    {busy && <p role="status" style={small}>Reading your email…</p>}
    {thread && account ? <><Button kind={KIND.tertiary} onClick={() => setThread(null)}>Back to email</Button><EmailThreadReader account={account} sourceRef={thread} /></>
      : messages.map(message => <button key={message.source_ref} data-testid="connected-email-message" onClick={() => setThread(message.source_ref)} style={{ border: 0, borderBottom: `1px solid ${theme.colors.borderOpaque}`, padding: `${theme.sizing.scale500} 0`, textAlign: 'left', cursor: 'pointer',
        background: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, display: 'grid', gap: theme.sizing.scale300 }}>
        <strong style={theme.typography.LabelMedium}>{message.subject}</strong><span style={small}>{message.from.join(', ')}</span>
        <span style={small}>{new Date(message.at).toLocaleString('en-GB')} · {message.attachments.length} attachments</span>
      </button>)}
    {!busy && !account && <p style={small}>Open a mailbox above to read the orders it holds.</p>}
    {door}
  </div>;
}

/* ── A MENU STANDS WHERE THERE IS A CHOICE TO MAKE (§247.2) ────────────────────────────────────
 * «always we havbe to be super consistent and not fget people igo confusing menus when they
 *  shouldnt see them»                                                          — Peter, 2026-09-11
 *
 * Both tabs used to render unconditionally, so a workspace that had connected neither channel met
 * a two-item menu, landed on WhatsApp by default and hit a Connect wall, with a second tab
 * promising an inbox that was equally empty. The switcher now reads both postures: two connected
 * channels are a choice and get the menu; one connected channel opens on itself, because a
 * one-item menu is not a choice; and a workspace with neither gets one picture and one act.
 */
export function ConnectedInbox({ onBack, onClose, number }: { onBack: () => void; onClose?: () => void; number?: string }) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const sector = derived.cast.sector;
  const whatsapp = useWhatsAppCapability(sector);
  const email = useEmailCapability();
  /* A FORWARDING ADDRESS IS A MAILBOX ROW TOO (§247.2 email pass): the panel opens on any row the
     inbox itself lists, so a forwarding-only workspace reaches the records that live there. */
  const emailReady = email.accounts.some((row) => mailboxConnected(row) || row.mode === 'forwarded');
  const [chosen, setChosen] = React.useState<'whatsapp' | 'email' | null>(null);
  React.useEffect(() => { if (number) setChosen('whatsapp'); }, [number]);
  /* The person's own press outranks the postures; otherwise the connected channel opens, and a
     workspace with both connected opens on WhatsApp, which is where orders arrive. */
  const channel = chosen ?? (whatsapp.bound ? 'whatsapp' : emailReady ? 'email' : 'whatsapp');
  const both = whatsapp.bound && emailReady;
  return <section data-testid="connected-inbox" data-channel={channel} data-connected={`${Number(whatsapp.bound) + Number(emailReady)}`}
    style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
    <header style={{ padding: theme.sizing.scale500, display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale300, alignItems: 'center', borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
      <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onBack} startEnhancer={() => <ArrowLeft size={16} aria-hidden />}>Conversations</Button>
      {onClose && <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Minimize conversations" onClick={onClose}><X size={18} aria-hidden /></Button>}
    </header>
    {both && <div data-testid="connected-inbox-switcher" style={{ display: 'flex', gap: theme.sizing.scale300, padding: theme.sizing.scale500 }}>
      <Button kind={channel === 'whatsapp' ? KIND.primary : KIND.secondary} size={SIZE.compact} data-testid="connected-inbox-whatsapp" onClick={() => setChosen('whatsapp')} startEnhancer={() => <MessageCircle size={16} aria-hidden />}>WhatsApp</Button>
      <Button kind={channel === 'email' ? KIND.primary : KIND.secondary} size={SIZE.compact} data-testid="connected-inbox-email" onClick={() => setChosen('email')} startEnhancer={() => <Mail size={16} aria-hidden />}>Email</Button>
    </div>}
    <div style={{ padding: theme.sizing.scale500, overflowY: 'auto', minWidth: 0, minHeight: 0 }}>
      {channel === 'whatsapp' ? <WhatsAppInbox number={number} sector={sector} /> : <EmailInbox />}
    </div>
  </section>;
}
