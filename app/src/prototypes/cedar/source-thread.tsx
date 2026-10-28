/** §147: the order's source messages, rendered by the same channel view as the workspace.
 *
 * ═══ AND THE CHIP GOT A COMPOSER (FEED-IA §196.8) ═══════════════════════════════════════════
 * Peter, 2026-09-04: «it's a draft inside the composer itself, AND THE COMPOSER IN THE CHIP
 * EMBEDDED IN THE ALBARAN.» So the conversation embedded in the delivery note is answerable where
 * it stands — the same `ReplyComposer` Messages mounts, with the same channel-stated send button
 * and the same prefilled, deletable draft, reading the SAME deletion record: taking the draft away
 * here takes it away in Messages, because it is one act about one concern.
 *
 * ⚠ THIS REPEALS «embedded order has no reply composer» (E185.06 / drive-143's own words), and
 * nothing else on this surface: the source messages are still the source, the email card is still
 * read-only and provider-custodied, and the composer stands BESIDE the record rather than inside
 * it. A separate draft key per document keeps the chip's words the chip's — an albarán is a place
 * a person answers about THIS order.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { ConcernNote } from './anxiety';
import { dismissedNow, useDismissals } from './dismissals';
import { openChat, openEmail, useThreads } from './shell/threads';
import { EmbeddedConversation, ReplyComposer } from './shell/chats';
import { EmailConversation } from './email-thread';
/* §246 acceptance 5 · the channel each turn stood on, and the seat the conversation's own
   channel is entitled to */
import { accountChannelOf, channelWord, conversationEmailDoor, conversationSeatOf } from './reply-channel';
import { CallDock, ChannelNote } from './call-record';
import { nowOf } from './day';
import { standingConcernsOf, type Sale } from './sale';
import type { Cast } from '../../scenarios/data/cast';
import whatsAppLogo from '../../assets/whatsapp-logo-green.png';

export function SourceThread({ sale, cast, anchor }: {
  sale: Sale; cast: Cast; anchor?: React.RefObject<HTMLDivElement>;
}) {
  const [, theme] = useStyletron();
  useDismissals();
  /* §196.7 clause 1 · Reply on one email in the chip aims the chip's own composer at it. */
  const [aimed, setAimed] = React.useState<{ id: string; subject?: string; from?: string } | null>(null);
  const responseConcerns = standingConcernsOf(sale)
    .filter((concern) => concern.kind === 'response' && !dismissedNow(sale.id, concern.id));
  const threads = useThreads(cast);
  const thread = threads.find((candidate) => candidate.customer.id === sale.customer.id);
  /* The sale's own message ids remain the durable source association even when the thread rebuilds. */
  const sourceIds = new Set(sale.thread.map((row) => `${sale.id}:${row.id}`));
  const rows = thread?.rows.filter((row) => sourceIds.has(row.id) || row.orderId === sale.id) ?? [];
  /* ── THE CHIP READS THE ACCOUNT'S OWN DOOR, NEVER «any row carried mail» (§246 acceptance 5) ──
     It used to call the whole chip an EMAIL the moment one turn carried mail metadata, and it
     called every other received turn WhatsApp evidence — which is how a telephone order came out
     as green bubbles under a «Send on WhatsApp» button. The account decides the seat; each TURN
     decides how it is drawn (`shell/chats.tsx`'s stream). */
  const account = accountChannelOf(sale.customer.channel);
  const email = account === 'email';
  /* ONE SEAT LAW, READ RATHER THAN RESTATED (the chats-fix review's own finding). This chip and
     the Messages housing computed the same rule out of the same three facts, in two files. It
     lives in `reply-channel.ts` now and both call it. */
  const emailStanding = conversationEmailDoor(sale.customer, rows);
  const writes = conversationSeatOf(sale.customer, rows) === 'composer';
  if (!rows.length || !thread) return null;
  /* §202.3 · OUT-05.2 — the albarán's own door opens the popup ON THIS ORDER's exchange. The
     panel already knows how to stand on one order; what it was missing was being told which. */
  const openFull = () => openChat(cast.sector, sale.customer.id, sale.id);
  const origin = [...rows].reverse().find((row) => row.author === 'received' && row.email);
  const openMail = () => openEmail(cast.sector, sale.customer.id, origin?.email?.source?.sourceRef ?? '', sale.id);
  /** THE CHIP'S OWN WRITING SURFACE — one document, one draft key (§196.8). */
  const composer = <div style={{ padding: `${theme.sizing.scale400} 0 ${theme.sizing.scale500}`, minWidth: 0 }}>
    <ReplyComposer
      cast={cast}
      customer={sale.customer}
      sales={[sale]}
      draftKey={`${sale.customer.id}:chip:${sale.id}`}
      mail={email}
      emailStanding={emailStanding}
      aimedAtEmail={aimed}
      onClearAim={() => setAimed(null)}
      emailTo={origin?.email?.from}
      emailSubject={origin?.email?.subject}
      emailProvider={origin?.email?.source?.provider}
      emailSourceRef={origin?.email?.source?.sourceRef}
      testid="chip-composer"
    />
  </div>;
  /* WHAT STANDS WHERE THE COMPOSER WOULD. A telephone conversation is answered by calling it; an
     account with no message door says where its orders come from. */
  const foot = writes ? composer
    : account === 'phone' ? <CallDock customer={sale.customer} says="This conversation happens by telephone." />
      : <ChannelNote customer={sale.customer} />;
  return <div ref={anchor} data-testid="conversation" data-channel={account}
    data-turns={rows.length} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0, paddingBottom: '80px' }}>
    {responseConcerns.map((concern, index) => <div key={concern.id} data-testid="source-reply-tab" style={{ alignSelf: 'stretch',
      backgroundColor: theme.colors.backgroundPrimary, border: `1px solid ${responseConcerns.length ? theme.colors.accent : theme.colors.borderOpaque}`,
      borderBottom: 0, borderRadius: `${theme.borders.radius300} ${theme.borders.radius300} 0 0`,
      padding: theme.sizing.scale400, marginBottom: `-${theme.sizing.scale400}`, position: 'relative', zIndex: 1 }}>
      <ConcernNote sale={sale} concern={concern.id} says={concern.says} mark="Rocoto held its reply"
        now={nowOf(cast)} testid={index === 0 ? "reply-concern" : "reply-concern-" + concern.id} />
    </div>)}
    {email ? <section data-testid="order-email" style={{ border: `1px solid ${responseConcerns.length ? theme.colors.accent : theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300, minWidth: 0, overflow: 'hidden', padding: `0 ${theme.sizing.scale400}` }}>
        <div style={{ margin: `0 -${theme.sizing.scale400}` }}>
          <EmailConversation cast={cast} sale={sale} thread={thread} rows={rows} onViewConversation={openMail}
            onReply={(row) => setAimed({ id: row.id, subject: row.email?.subject, from: row.email?.from })}
            aimedAt={aimed?.id} />
        </div>
        {foot}
      </section> :
      <section data-testid="order-chat" style={{ border: `1px solid ${responseConcerns.length ? theme.colors.accent : theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300, minWidth: 0, overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300,
          backgroundColor: theme.colors.backgroundPrimary, padding: `${theme.sizing.scale300} ${theme.sizing.scale500}` }}>
          {/* ⚠ THE MARK BELONGS TO THE CHANNEL THAT OWNS IT. A portal account used to get the
              WhatsApp logo because the guard only excluded the telephone — a brand mark over a
              conversation that never touched that brand. */}
          {account === 'whatsapp' &&
            <img src={whatsAppLogo} width="20" height="20" alt="" aria-hidden="true" />}
          {/* A HEADING NAMES THE THING, and it names it the way a name is written: the cast stores
              `portal` and `in person` in lower case because they are DATA, and a label is not.
              ⚠ THE LABEL IS `channelWord`'s, not this file's. The Messages thread header used to
              print the raw value, so one account read «Phone» here and «phone · Marc» there. */}
          <span style={{ ...theme.typography.LabelSmall }}>{channelWord(sale.customer.channel)}</span>
          <div style={{ marginLeft: 'auto' }}><Button kind={KIND.tertiary} size={SIZE.mini} data-testid="trail-open-chat"
            onClick={openFull}>Open chat</Button></div>
        </header>
        {/* §196.7 clause 1 INSIDE A MIXED TIMELINE. A WhatsApp (or portal) account can carry one
            mail turn in this document's own rows; pressing Reply on it aims THIS chip's composer,
            because the chip is what holds the writing surface here. Where the chip stands no
            composer, the aim is withheld and the card paints no Reply. */}
        <EmbeddedConversation cast={cast} sale={sale} onOpenFull={openFull}
          onAimMail={writes ? (row) => setAimed({ id: row.id, subject: row.email?.subject, from: row.email?.from }) : undefined}
          aimedMailAt={aimed?.id} />
        <div style={{ padding: `0 ${theme.sizing.scale400}` }}>{foot}</div>
      </section>}
  </div>;
}
