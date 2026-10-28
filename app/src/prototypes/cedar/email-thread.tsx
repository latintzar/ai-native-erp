/** One email renderer for the order excerpt, supplier feed, and Messages workspace. */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Glyph } from './glyphs';
import { SourceText, SourceAttachment } from './source-content';
import {
  emailProviderName,
  mailboxStanding,
  nativeMailboxDestinationFor,
  useEmailCapability,
  useEmailSourceChange,
  type EmailConnectionStatus,
  type EmailProvider,
  type EmailSource,
  type EmailSourceChange,
} from './email-provider';
import { mailSubjectsShown } from './reply-channel';
import { openEmail } from './shell/threads';
import { isSourceMessage, type Sale } from './sale';
import type { ThreadTurn } from './shell/threads';
import type { Cast } from '../../scenarios/data/cast';
import { ScopedConversationNoteLine, scopedConversationNoteStanding, useScopedConversationNotes } from './scoped-conversation-note';

/** The renderer only needs an identity and a display name, so supplier email can reuse it honestly. */
export type EmailConversationThread = { id: string; customer: { id?: string; name: string } };

/** A compact provider mark without loading a third-party asset or exposing any account data. */
function ProviderMark({ provider }: { provider: EmailProvider }) {
  const [, theme] = useStyletron();
  if (provider === 'm365') {
    return <span aria-hidden="true" data-email-provider-logo="outlook" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 5px)', gap: 1, width: 11, height: 11 }}>
      {[0, 1, 2, 3].map((cell) => <span key={cell} style={{ background: cell === 0 ? theme.colors.contentPrimary : theme.colors.contentSecondary }} />)}
    </span>;
  }
  if (provider === 'gmail') {
    return <span aria-hidden="true" data-email-provider-logo="gmail" style={{ ...theme.typography.LabelXSmall, fontWeight: 800, lineHeight: 1 }}>G</span>;
  }
  return <Glyph id="email" size={16} />;
}

/**
 * ONE EMAIL, AS A CARD — the sender, the subject where it changes, the recipients, the words, the
 * attachments and Reply.
 *
 * ⚠ IT IS EXPORTED BECAUSE A MIXED CONVERSATION NEEDS IT (FEED-IA §246 acceptance 5). A customer
 * who usually writes on WhatsApp can send one email, and that turn stands in the SAME timeline as
 * the WhatsApp ones — so the chat stream draws this card for it rather than a bubble that loses
 * the sender, the subject and the reply path. One renderer, two housings, same testids.
 */
export function EmailTurnCard({ scope, row, them, house, showSubject = false, onReply, aimedAt }: {
  scope: string;
  row: ThreadTurn;
  /** the customer's display name, where the turn carries no sender of its own */
  them: string;
  /** the house's display name, for a turn this desk sent */
  house: string;
  showSubject?: boolean;
  onReply?: (row: ThreadTurn) => void;
  aimedAt?: string;
}) {
  const [, theme] = useStyletron();
  const noteStanding = scopedConversationNoteStanding(scope, row.scopedNote);
  return <React.Fragment>
    {noteStanding && row.scopedNote && <ScopedConversationNoteLine scope={scope} note={row.scopedNote} side={row.author === 'sent' ? 'sent' : 'received'} testid="email-scoped-note" />}
    <article data-testid={`exchange-turn-${row.id}`} data-author={row.author}
      data-email-entry="message" data-scoped-note-boundary={noteStanding ? 'standing' : undefined} style={{ padding: theme.sizing.scale500, margin: `${noteStanding ? theme.sizing.scale100 : theme.sizing.scale400} 0 ${theme.sizing.scale400}`, minWidth: 0, background: theme.colors.mono100, border: `1px solid ${noteStanding ? theme.colors.accent : theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, boxShadow: `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 7%, transparent)` }}>
      {showSubject && row.email?.subject &&
        <h4 style={{ ...theme.typography.LabelMedium, margin: `0 0 ${theme.sizing.scale400}` }}>{row.email.subject}</h4>}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300 }}>
        <span data-email-sender style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>
          {row.email?.from || (row.author === 'received' ? them : house)}</span>
        {row.time && <time style={{ marginLeft: 'auto', flexShrink: 0, ...theme.typography.ParagraphXSmall,
          color: theme.colors.contentTertiary }}>{row.time}</time>}
      </header>
      {!!row.email?.to.length && <p style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary,
        margin: `${theme.sizing.scale200} 0 ${theme.sizing.scale500}`, overflowWrap: 'anywhere' }}>To {row.email.to.join(', ')}</p>}
      <p style={{ ...theme.typography.ParagraphSmall, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: 0 }}>
        <SourceText text={row.text} /></p>
      {!!row.attachments?.length && <div data-testid="source-files" style={{ display: 'flex', flexWrap: 'wrap',
        gap: theme.sizing.scale300, marginTop: theme.sizing.scale400 }}>
        {row.attachments.map((file) => <SourceAttachment key={file.id} file={file} />)}</div>}
      {/* §196.7 · Reply AIMS the composer at this message. It writes nothing, sends nothing and
          leaves the source record exactly as it found it. */}
      {onReply && row.author === 'received' && <div style={{ display: 'flex', marginTop: theme.sizing.scale400 }}>
        <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="email-reply" data-aimed={aimedAt === row.id ? 'yes' : 'no'}
          aria-pressed={aimedAt === row.id} onClick={() => onReply(row)}
          overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
          {aimedAt === row.id ? 'Replying' : 'Reply'}
        </Button>
      </div>}
    </article>
  </React.Fragment>;
}

export function EmailConversation({ cast, sale, thread, rows = [], source: sourceOverride, subject, onViewConversation, onSourceChanged, onReply, aimedAt }: {
  cast: Cast;
  sale?: Sale;
  thread: EmailConversationThread;
  rows?: ThreadTurn[];
  /* ── §196.7 · «emails can be answered in the chip or by hitting reply and answering in the
     composer». THIS IS THE REPLY HALF, and it is deliberately only an AIM: pressing it names the
     message the composer is answering and nothing else. The SOURCE stays exactly as read-only as
     it was — no field, no send, no local mail turn — because the writing surface stands BESIDE
     this record rather than inside it, which is what keeps E185's provider-custody claim true
     while §196.7's composer exists. */
  onReply?: (row: ThreadTurn) => void;
  /** the message the composer is currently aimed at, so the card says so */
  aimedAt?: string;
  /** Supplier feeds may have only the authorized opaque source, never a reconstructed raw body. */
  source?: EmailSource;
  subject?: string;
  /** The embedded order excerpt opens the real Messages workspace from below the message. */
  onViewConversation?: () => void;
  /** Ask the owning authorized query to refetch after a receipt/provider update. */
  onSourceChanged?: (change: EmailSourceChange) => void;
}) {
  const [, theme] = useStyletron();
  useScopedConversationNotes(cast.sector);
  const messages = rows.filter(isSourceMessage).filter((row) => row.text || row.attachments?.length);
  /** the subject stands on the first mail and on every one that changes it (`reply-channel.ts`) */
  const subjectShown = mailSubjectsShown(messages, { channel: 'email' });
  const origin = [...messages].reverse().find((row) => row.author === 'received' && row.email);
  const metadata = origin?.email;
  const source = sourceOverride ?? metadata?.source;
  const provider = source?.provider ?? 'forwarded';
  const providerName = emailProviderName(provider);
  const native = nativeMailboxDestinationFor(source);
  /* §247.2 · THE CARD READS THE ONE LIVE MAILBOX CAPABILITY. It used to read the runtime's send
     word and, for the fourth posture, the house's own `config.mailbox` switches — a browser draft
     that could say «Connecting» about a workspace holding no mailbox at all. Posture, send word
     and the provider's own fallback door now come from the same snapshot every other email
     entrance reads. */
  const mailbox = useEmailCapability();
  const connection: EmailConnectionStatus = mailbox.posture === 'ready'
    ? { kind: 'connected', providers: mailbox.providers, canSend: mailbox.canSend }
    : { kind: 'unverified', reason: 'Connect a mailbox to send from here.' };
  useEmailSourceChange(source?.sourceRef, onSourceChanged);
  /* ── WHAT THE SEND CAN DO, IN THE MAILBOX'S OWN FOUR POSTURES (§202.3 · OUT-05.4) ──────────
     The record itself is read from the authorized source in every posture — «we become their
     chat and email client» is exactly that — so this line is only ever about SENDING, and every
     one of its four sentences says what IS. */
  /* ⚠ AND THE ARMING IS READ HERE TOO. `mailboxStanding` has four postures and the fourth —
     «the mailbox is arming» — needs the house's own switch: without it this card said «Read-only»
     over a composer inches below saying «Sending starts when Gmail finishes connecting», which is
     two surfaces reporting different postures of one mailbox. `shell/chats.tsx` reads it the same
     way, off the same config. */
  const standing = mailboxStanding({
    connection,
    provider,
    /* «Arming» is a mailbox the provider is still authorizing — the capability's own `partial`. */
    armed: mailbox.posture === 'partial',
  });
  const readonlyReason = source ? standing.says : 'The email opens here as soon as the mailbox hands it over.';
  /* ── THE DOOR IS ROCOTO'S OWN (FEED-IA §202.3 · OUT-05.3) ──────────────────────────────────
     «"open email" … we become their chat and email client.» This circle used to walk to
     `#/customers/<id>` — a customer page in the email's place, which is the one thing §202.3
     names — so it opens THE EMAIL, drawn from the reference the house is authorized to hold.
     The provider's own door survives below as the FALLBACK of OUT-05.6, for forwarded mail and
     for a house with nothing connected yet. */
  const openThisEmail = () => { if (thread.customer.id) openEmail(cast.sector, thread.customer.id, source?.sourceRef ?? ''); };
  const fallbackDoor = native && standing.posture !== 'connected';
  const topAction = <>
    {fallbackDoor && <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="email-open-native"
      startEnhancer={<ProviderMark provider={provider} />}
      onClick={() => window.open(native.href, '_blank', 'noopener,noreferrer')}>{native.label}</Button>}
    {/* ⚠ THE DOOR'S MARK IS NOT THE CARD'S OWN MARK. Read at 1600 after E200.04's first pass: the
        header drew ✉ Gmail · Read-only … [G Open Gmail] (✉) — the SAME envelope twice on one line,
        once as the card's subject mark and once as this door, with the labelled button between
        them walking OUT of the app. The unlabelled envelope read as a second Gmail. The words stay
        («Open the email», in the title and the label); the mark says the verb this button carries,
        which is «open it full» — `better-ui` · *Contextual icon animations* and *One SVG*: an icon
        beside content earns its place by distinguishing, and two identical glyphs distinguish
        nothing. */}
    {thread.customer.id && <Button kind={KIND.tertiary} size={SIZE.mini} shape="circle" data-testid="email-open-history"
      aria-label={`Open the email from ${thread.customer.name}`} title="Open the email" onClick={openThisEmail}><Glyph id="expand" size={16} /></Button>}
  </>;

  return <section data-testid="email-thread" data-provider={provider} data-readonly="true" data-sector={cast.sector}
    style={{ backgroundColor: theme.colors.backgroundPrimary, border: `1px solid ${theme.colors.borderOpaque}`,
      borderRadius: theme.borders.radius300, minWidth: 0, overflow: 'hidden' }}>
    <header style={{ padding: theme.sizing.scale600, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, marginBottom: theme.sizing.scale400, flexWrap: 'wrap' }}>
        <Glyph id="email" size={18} />
        <span data-testid="email-connection" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{providerName}</span>
        {/* ⚠ `data-state` STILL NAMES THE MECHANISM E185 BUILT — the provider's own door, which
            survives as OUT-05.6's fallback — and `data-posture` names what §202.3 added: which of
            the mailbox's four standings this card is in. Two facts, two attributes, neither
            pretending to be the other. */}
        <span data-testid="email-reply-state" data-state="native-handoff" data-posture={standing.posture}
          style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
          {standing.posture === 'connected' ? 'Connected'
            : standing.posture === 'arming' ? 'Connecting'
              : standing.posture === 'forwarded' ? 'Forwarded' : 'Read-only'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>{topAction}</div>
      </div>
      {fallbackDoor && <p data-testid="email-native-help" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, margin: `0 0 ${theme.sizing.scale300}` }}>{native.help}</p>}
      <h3 data-testid="email-subject" style={{ ...theme.typography.HeadingXSmall, margin: 0, overflowWrap: 'anywhere' }}>
        {/* A HEADING NAMES THE THING. With no subject to print, the thing this card holds is the
            mail this customer sent — so it says that, rather than reporting an absence. */}
        {metadata?.subject || subject || `From ${thread.customer.name}`}</h3>
    </header>
    <div style={{ padding: `0 ${theme.sizing.scale600}` }}>
      {messages.length === 0 && <p data-testid="email-original-unavailable" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: `${theme.sizing.scale600} 0` }}>
        The email opens here as soon as the mailbox hands it over.
      </p>}
      {/* ⚠ «WHERE IT CHANGES» IS ONE RULE AND IT LIVES IN `reply-channel.ts`. It used to be written
          here and nowhere else, so when the card was extracted for the chat stream the stream got
          «print it whenever there is one» and a mixed customer's three mails on one subject printed
          it three times. `!sale` stays a HOUSING guard: the compact order summary's own header
          already prints the subject above these cards. */}
      {messages.map((row) => <EmailTurnCard key={row.id} scope={cast.sector} row={row}
        them={thread.customer.name} house={cast.house.name}
        showSubject={!sale && (subjectShown.get(row.id) ?? false)}
        onReply={onReply} aimedAt={aimedAt} />)}
    </div>
    <footer style={{ padding: theme.sizing.scale600, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
      <p data-testid="email-readonly-reason" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{readonlyReason}</p>
      {onViewConversation && <div style={{ marginTop: theme.sizing.scale500 }}>
        {/* ONE PAIR OF WORDS ACROSS THE APP (OUT-05.6): «Open chat» and «Open the email». Two
            near-identical labels with opposite destinations became one. */}
        <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="trail-open-email"
          onClick={onViewConversation}>Open the email</Button>
      </div>}
    </footer>
  </section>;
}
