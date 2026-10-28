/** CHASE NOW — the send an unpaid order opens (FEED-IA §249, brief A).
 *
 * «Modal opens … Pre-filled message … User confirms: sends via WhatsApp API + triggers Yape/Plin
 *  payment request … Card updates: "Chased [timestamp]"» — the source thread, 14 September.
 *
 * ═══ THE DIALOG STATES FOUR FACTS AND OFFERS ONE ACT ═══════════════════════════════════════
 * Who it goes to, which rung of the ladder it stands on, the exact words, and the door it travels.
 * Everything a person can change is in the words themselves, so the act needs no second question.
 *
 * ═══ THE SEND IS ONE SEAM, AND THE TIMER TAKES THE SAME ONE ════════════════════════════════
 * `sendChase` below is the whole send: the payment request is recorded as sent, the text lands in
 * that customer's conversation (the thread id IS the customer id), and the chase record grows a
 * rung. The dialog calls it on **Send**; the auto-chase runner in `money-credit.tsx` calls the
 * same function with no dialog at all. One path, so a hand-sent reminder and a timed one are the
 * same event in the same conversation — which is what makes the conversation the record.
 *
 * ═══ THE LINK IS THE INVOICE'S OWN REQUEST ═════════════════════════════════════════════════
 * `chaseLinkFor` hands back the invoice's canonical payment request, creating it through the
 * store when the invoice has none, so the buyer page a reminder points at is the same one the
 * invoice card shares. When the collection service is commissioned that request carries the
 * Yape/Plin collector; the message text is unchanged either way.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button } from 'baseui/button';
import { Textarea } from 'baseui/textarea';
import { ArrowUpRight } from 'lucide-react';
import { WorkflowDialog } from './workflow-dialog';
import { moneyActions, moneyStateNow } from './money-store';
import { collectionGuard, collectionOrigin, collectionOwnerRequest } from './money-api';
import { requestForInvoice, type Invoice, type PaymentRequest } from './money-model';
import { sendToThread } from './shell/threads';
import { accountChannelOf, channelWord, type AccountChannel } from './reply-channel';
import { useWhatsAppCapability } from './whatsapp-connection';
import { whatsappWordFor } from './whatsapp-capability';
import { chaseStepOf, chaseStepWords, recordSend, type ChaseEvery, type ChaseRecord, type ChaseSend, type ChaseStep } from './chase';
import type { SectorId } from '../../scenarios/meta';

/** The account's own door, narrowed to the two a reminder can travel. A telephone account reads
 *  as mail here because that is where a written reminder actually lands for them; the dialog
 *  still prints the account's real channel word, so the person sees which account this is. */
export const chaseChannelOf = (channel: AccountChannel): ChaseSend['channel'] =>
  accountChannelOf(channel) === 'whatsapp' ? 'whatsapp' : 'email';

/** The invoice's canonical payment request, created when the invoice has none. */
export async function chaseLinkFor(scope: string, invoiceId: string): Promise<PaymentRequest | undefined> {
  const held = requestForInvoice(moneyStateNow(scope), invoiceId);
  if (held && !held.remotePending) return held;
  const result = await moneyActions(scope).createRequest(invoiceId);
  return result.ok ? result.value : requestForInvoice(moneyStateNow(scope), invoiceId);
}

export type ChaseSendInput = {
  scope: string;
  sector: SectorId;
  invoice: Invoice;
  customerId: string;
  text: string;
  channel: ChaseSend['channel'];
  step: ChaseStep;
  /** the conversation's own hour, from `replyHour`, so the reminder is the newest thing said */
  hour: string;
  /** the wall-clock instant the timer measures from */
  now: string;
  record: ChaseRecord;
  everyHours: ChaseEvery;
  requestId?: string;
};

const restoredChases=new Set<string>();
if(typeof window!=='undefined')window.addEventListener('rocoto:money-workspace-reset',event=>{
  const scope=(event as CustomEvent<{scope:string}>).detail?.scope;
  for(const key of restoredChases)if(key.startsWith(`${scope}:`))restoredChases.delete(key);
});
/** Retained reminders use the same row identity when a conversation opens after reload. */
export function hydrateChaseMessage(sector:SectorId,invoice:Invoice,send:ChaseSend):void {
  const identity=`${sector}:${invoice.id}:${send.at}:${send.step}`;
  if(restoredChases.has(identity))return;
  const hour=new Date(send.at).toLocaleTimeString('en-GB',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit'});
  sendToThread(sector,invoice.customerId,send.text,hour,undefined,{orderId:invoice.saleId,id:`chase:${invoice.id}:${send.at}:${send.step}`});
  restoredChases.add(identity);
}

/** One reminder, sent. Returns the record the card should hold afterwards. */
export function sendChase(input: ChaseSendInput): ChaseRecord {
  if (input.requestId) moneyActions(input.scope).recordRequestAction(input.requestId, 'sent');
  hydrateChaseMessage(input.sector,input.invoice,{at:input.now,step:input.step,channel:input.channel,text:input.text});
  return recordSend(input.record, { at: input.now, step: input.step, channel: input.channel, text: input.text }, input.everyHours);
}

export type ChaseDialogProps = {
  scope: string;
  sector: SectorId;
  invoice: Invoice;
  customerId: string;
  /** the account's own channel, as the book holds it */
  accountChannel: AccountChannel;
  record: ChaseRecord;
  everyHours: ChaseEvery;
  /** the words for this rung, given the link once it resolves */
  buildText: (link: string) => string;
  /** the conversation's hour at the moment of sending */
  hourOf: () => string;
  onSent: (record: ChaseRecord) => void;
  onClose: () => void;
};

export function ChaseDialog({ scope, sector, invoice, customerId, accountChannel, record, everyHours, buildText, hourOf, onSent, onClose }: ChaseDialogProps) {
  const [, theme] = useStyletron();
  const whatsapp = useWhatsAppCapability(sector);
  const step = chaseStepOf(record);
  const channel = chaseChannelOf(accountChannel);
  const [request, setRequest] = React.useState<PaymentRequest | undefined>(() => requestForInvoice(moneyStateNow(scope), invoice.id));
  const [linking, setLinking] = React.useState(true);
  const [text, setText] = React.useState(() => buildText(requestForInvoice(moneyStateNow(scope), invoice.id)?.url ?? ''));
  const edited = React.useRef(false);
  const sending = React.useRef(false);
  const [sendError,setSendError]=React.useState('');

  React.useEffect(() => {
    let active = true;
    setLinking(true);
    void chaseLinkFor(scope, invoice.id).then(link => {
      if (!active) return;
      setRequest(link);
      setLinking(false);
      if (link && !edited.current) setText(buildText(link.url));
    });
    return () => { active = false; };
    // The words are rebuilt for this invoice's own rung; `buildText` closes over the current state.
  }, [scope, invoice.id]);

  const send = async () => {
    if (sending.current || !request?.sentAt) return;
    sending.current = true;setSendError('');
    const check=collectionGuard(scope);
    try {
      if(request.remoteId&&collectionOrigin())await collectionOwnerRequest(scope,`/requests/${encodeURIComponent(request.remoteId)}/dispatch`,{by:'manual'});
      check();
      onSent(sendChase({ scope, sector, invoice, customerId, text, channel, step, hour: hourOf(),
        now: new Date().toISOString(), record, everyHours, requestId: request.id }));
      onClose();
    } catch(error){setSendError(error instanceof Error?error.message:'Reconnect to send this reminder.');}
    finally {sending.current=false;}
  };

  const label: React.CSSProperties = { ...theme.typography.LabelSmall, color: theme.colors.contentSecondary };
  const fact: React.CSSProperties = { ...theme.typography.ParagraphSmall, margin: 0, overflowWrap: 'anywhere' };

  return <WorkflowDialog title="Chase now" onClose={onClose} testId="chase-dialog" step={chaseStepWords(step)}
    actions={<Button data-testid="chase-send" disabled={linking || !request?.sentAt || text.trim().length === 0} onClick={()=>void send()}
      overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Send</Button>}>
    <div style={{ display: 'grid', gap: theme.sizing.scale700, minWidth: 0 }}>
      {sendError&&<p role="alert" style={fact}>{sendError}</p>}
      <div style={{ display: 'grid', gap: theme.sizing.scale200 }}>
        <span data-testid="chase-customer" style={{ ...theme.typography.HeadingXSmall }}>{invoice.customerName}</span>
        <span style={label}>{invoice.number} · {invoice.saleNumber}</span>
      </div>
      <label style={{ display: 'grid', gap: theme.sizing.scale300, ...theme.typography.LabelSmall, minWidth: 0 }}>Message
        <Textarea value={text} rows={6} aria-label="Reminder message"
          onChange={event => { edited.current = true; setText(event.currentTarget.value); }}
          overrides={{ Input: { props: { 'data-testid': 'chase-message' } } }} />
      </label>
      <div style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
        <span style={label}>Payment link</span>
        {request ? <a data-testid="chase-link" href={request.url} target="_blank" rel="noopener noreferrer" style={{ ...fact, color: theme.colors.contentPrimary,
          display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200, minHeight: '44px' }}>Open payment link<ArrowUpRight size={14} aria-hidden /></a>
          : <p data-testid="chase-link" style={fact}>The payment link arrives with this reminder.</p>}
      </div>
      <div style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
        <span style={label}>Channel</span>
        <p data-testid="chase-channel" style={fact}>{channelWord(accountChannel)}{channel === 'whatsapp' ? ` · ${whatsappWordFor(whatsapp)}` : ''}</p>
      </div>
    </div>
  </WorkflowDialog>;
}
