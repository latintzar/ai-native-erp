/** Stock update owns the incoming-source feed; a source never records a receipt by opening it. */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import type { Cast } from '../../scenarios/data/cast';
import type { IncomingMail } from './inbox';
import type { IncomingEvent } from './incoming';
import { EmailConversation } from './email-thread';
import { Glyph } from './glyphs';
import { useEmailConnectionStatus } from './email-provider';
import { usePhoneFloorHeight } from './shell';

export function StockUpdateFeed({ cast, mails, selected, onOpen, renderEvent, demo = false }: {
  cast: Cast; mails: IncomingMail[]; selected: string | null; onOpen: (id: string | null) => void;
  demo?: boolean;
  renderEvent: (event: IncomingEvent) => React.ReactNode;
}) {
  const [, theme] = useStyletron();
  /* the connection's door is a line of caption type, and on a phone a door is 44px (E193.14) */
  const connectionFloor = usePhoneFloorHeight();
  const mail = mails.find(row => row.id === selected);
  const connection = useEmailConnectionStatus();
  const caption = { ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary };
  if (selected) return <section data-testid="stock-update-email" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
    <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Back to incoming stock" data-testid="stock-email-back" onClick={() => onOpen(null)} overrides={{ BaseButton: { style: { alignSelf: 'flex-start', minWidth: '48px', minHeight: '48px', paddingLeft: 0, paddingRight: 0 } } }}><span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Glyph id="caret" size={20} /></span></Button>
    {mail ? <>
      {demo && <span data-testid="stock-email-demo" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Supplier email</span>}
      {mail.messages?.length ? <EmailConversation cast={cast} thread={{ id: mail.id, customer: { name: mail.supplier?.name ?? 'Supplier' } }} rows={mail.messages} /> : <>
        <header><p style={caption}>{mail.supplier?.name ?? 'Supplier'} · {mail.at.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p><h3 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>{mail.subject}</h3></header>
        <p role="status" style={{ ...theme.typography.ParagraphSmall, margin: 0 }}>Original email unavailable.</p>
        <a href="#/admin/connections/email" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary }}>Connect email</a>
      </>}
      <section style={{ borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale500, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
        <h4 style={{ ...theme.typography.LabelMedium, margin: 0 }}>Stock details</h4>
        {mail.events.map(event => <div key={event.id}>{renderEvent(event)}</div>)}
      </section>
    </> : <p role="status">Email unavailable. Go back to incoming stock.</p>}
  </section>;
  return <section data-testid="stock-update-feed" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale600 }}>
    <header style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
      <h3 style={{ ...theme.typography.LabelLarge, margin: 0 }}>Incoming stock</h3>
      {demo && <span data-testid="stock-feed-demo" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Received</span>}
      <a data-testid="stock-email-connection" data-connected={connection.kind === 'connected'} href="#/admin/connections/email" style={{ ...caption, marginLeft: 'auto', display: 'inline-flex', gap: theme.sizing.scale200, alignItems: 'center', textDecoration: 'none', ...connectionFloor }}><Glyph id="email" size={16}/>{connection.kind === 'connected' ? 'Email connected' : 'Connect email'}</a>
    </header>
    {mails.length ? mails.slice(0, 30).map(mail => <Button key={mail.id} kind={KIND.tertiary} size={SIZE.compact} data-testid="stock-incoming-email" data-demo={demo ? "true" : undefined} data-list-card="inset" data-mail={mail.id} onClick={() => onOpen(mail.id)} overrides={{ BaseButton: { style: { display: 'block', textAlign: 'left', boxSizing: 'border-box', width: `calc(100% - ${theme.sizing.scale400})`, margin: `${theme.sizing.scale100} ${theme.sizing.scale200}`, padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`, border: '1px solid transparent', borderRadius: theme.borders.radius400, backgroundColor: 'transparent', cursor: 'default', ':hover': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque }, ':focus-visible': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque, outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' } } } }}>
      <span style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'baseline' }}><span style={{ ...theme.typography.LabelSmall, flex: 1 }}>{mail.supplier?.name ?? 'Supplier'}</span><time style={caption}>{mail.at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</time></span>
      <span style={{ ...theme.typography.ParagraphSmall, display: 'block', marginTop: theme.sizing.scale100 }}>{mail.subject}</span>
      <span style={{ ...caption, display: 'block', marginTop: theme.sizing.scale100 }}>{mail.events.length} stock {mail.events.length === 1 ? 'entry' : 'entries'}{mail.file ? ` · ${mail.file.name}` : ''}</span>
    </Button>) : <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 }}>Deliveries land here once a supplier mailbox is connected.</p>}
  </section>;
}
