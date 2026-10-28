/* THE CARDS THE AGENT PUTS IN THE CONVERSATION (FEED-IA §196.2).
 *
 * ⚠ WHAT CHANGED, AND IT IS THE WHOLE POINT OF E193.02. These four surfaces — the supply report,
 * the affected-order review, the manual result and the catalogue correction — were MODES: pressing
 * «Report supply issue» replaced the conversation with a form, and the way back was a chevron.
 * That is «just suggestions», which is the thing §196.2 repeals. They are now CARDS: they are
 * mounted inside the agent's own turn, the conversation stays under them, and the composer stays
 * live beside them, so a person can keep talking while a review is open.
 *
 * THE BEHAVIOUR IS THE ONE THAT WAS ALREADY PROVEN — the affected-order arithmetic, the exact
 * per-order dispositions, the receipt check, the capability gate, the native handoffs and the
 * catalogue's revalidation are lifted whole from the assistant they replace, testids included, so
 * every claim that stood about them still stands. What moved is where they are drawn.
 *
 * WHAT MAY ACT (THE-COPILOT-SPEC §5): «Save category» writes a category; a reviewed supply message
 * may be SENT only where the customerOutbound capability is verified — every other control in
 * here proposes, records or opens a door. No turn, no dictation and no card mount ever sends.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { Input } from 'baseui/input';
import type { Cast, Product } from '../../../scenarios/data/cast';
import { OFF_LIST } from '../../../scenarios/data/cast';
import { openProduct } from '../anchors';
import { groundOf, grownProducts, nearbyNodes, nodeOf, reground, useCatalogue } from '../catalogue';
import {
  ALTERNATIVES, ALTERNATIVE_WORD, affectedOf, messageFor, swapFor, useSupplyIssues,
  usefulNext, type Affected, type Alternative, type Template,
} from '../supply-broadcast';
import type { SupplyIssue } from '../incoming';
import { requestStockEntry } from '../stock-entry-intent';
import { RANK, dayLabelFromId, isStanding, type Sale } from '../sale';
import { openSale } from '../shell/embeds';
import { openChat, openEmail, usePhoneFloorHeight } from '../shell';
import type { SectorId } from '../../../scenarios/meta';
import { capabilityAvailable, PLANNED_CAPABILITY_HELP } from '../release-profile';
import { accountChannelOf } from '../reply-channel';
import { useWorkspaceCapabilities } from '../workspace-capabilities';
import { uid } from './store';
import type {
  Activity, AssistantContext, AssistantRuntimeAdapter, CopilotMessage, CopilotProposal, OperatorReport, SupplyReviewDraft,
} from './types';

const customerOutboundAvailable = capabilityAvailable('customerOutbound');
const releaseInventoryAvailable = capabilityAvailable('inventory');

export const words = (n: number, singular: string, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;

export const digest = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `fnv1a:${(hash >>> 0).toString(16)}`;
};

/** the agent's own turn, ready to append */
export const say = (text: string, extra: Partial<CopilotMessage> = {}): CopilotMessage => ({
  id: uid('turn'), at: new Date().toISOString(), role: 'copilot', text, ...extra,
});
export const said = (text: string, extra: Partial<CopilotMessage> = {}): CopilotMessage => ({
  id: uid('turn'), at: new Date().toISOString(), role: 'operator', text, ...extra,
});

/* ── ACTIVITY (INTX UTL-A09) — short completed/pending/blocked rows off real results ─────────── */
export function Trails({ trails }: { trails: Activity[] }) {
  const [, theme] = useStyletron();
  return <details data-testid="assistant-evidence" aria-label="Activity" style={{ marginTop: theme.sizing.scale300 }}>
    <summary style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, minHeight:44, cursor:'pointer', alignContent:'center' }}>Sources · {trails.length}</summary>
    <div style={{ display:'grid', gap:theme.sizing.scale300 }}>
    {trails.map((trail) => <details key={trail.id} data-status={trail.status} style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale300, backgroundColor: theme.colors.backgroundSecondary }}>
      <summary style={{ listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale300, cursor: 'pointer', ...theme.typography.LabelSmall }}><span>{trail.label}</span><span style={{ color: trail.status === 'blocked' ? theme.colors.negative : theme.colors.contentSecondary, textAlign: 'right' }}>{trail.summary}</span></summary>
      <ul style={{ margin: `${theme.sizing.scale200} 0 0`, paddingLeft: theme.sizing.scale500, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
        {trail.detail.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </details>)}
    </div>
  </details>;
}

/* ── THE AGENT'S ORDER ROW (FEED-IA §200.4, Peter 2026-09-04) ─────────────────────────────────
 *
 *   «notice how massive the fucking card is in that test of the copilot that you put. It's a bit
 *    confusing, no?»  →  §200.4: «The Copilot's own order cards in a supply conversation are
 *    ROWS, not posters.»
 *
 * WHAT WAS THERE. Every affected order was a stack of seven things: the name, an accent line
 * saying it was selected, the asked/available line, a «Message preview» LABEL, the whole customer
 * message set as a paragraph, and the acts — 200-odd pixels each, repeated down a 416px column,
 * with the SAME message printed in full on every one of them. That is what made it a poster: the
 * card's own wording field already states the message once, so each row was re-printing the one
 * fact the card had just stated, in the tallest way available.
 *
 * WHAT IT IS NOW, in the row law's own grammar (§192–§195): the identity on the first line, the
 * quantities and the day small under it, the row's own first line of message as a QUIET one-line
 * preview (it differs per row — the quantity is theirs — which is the only reason it is on the
 * row at all), and the acts as compact text on one line. Two facts, one preview, one act line,
 * inside 96px on a desk. Selection is stated by the box and the boundary, so the sentence that
 * used to say it as well is gone.
 */
/** an act on a row: text, compact on a desk, a 44px target under a thumb (INTX-12) */
function RowAct({ testid, onPress, children }: { testid?: string; onPress: () => void; children: React.ReactNode }) {
  const floor = usePhoneFloorHeight();
  return <Button
    kind={KIND.tertiary}
    size={SIZE.mini}
    {...(testid ? { 'data-testid': testid } : {})}
    overrides={{ BaseButton: { style: {
      paddingTop: '2px', paddingBottom: '2px', paddingLeft: '8px', paddingRight: '8px',
      marginLeft: '-8px', marginRight: '0px', ...floor,
    } } }}
    onClick={onPress}
  >{children}</Button>;
}

function OrderRow({ testid, identity, facts, preview, boundary, tone, lead, acts, channel }: {
  testid: string;
  /** the account's own door — `whatsapp` · `email` · `phone` · `note`, the one word every
   *  surface reads (`accountChannelOf`, reply-channel.ts) — so a drive can count the doors
   *  §202.3 owes against the same fact the composer stands on */
  channel?: string;
  /** customer · number — the one line a person reads first */
  identity: React.ReactNode;
  /** what was asked, what stands, and the day — small, under the identity */
  facts?: string;
  /** the row's own first line of message, clipped to one line */
  preview?: string;
  /** the agent's own hand: an accent boundary marks a row it is proposing to act on */
  boundary?: boolean;
  tone?: 'chosen' | 'plain';
  /** the box, where selection is the person's */
  lead?: React.ReactNode;
  acts: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return <article data-testid={testid} data-copilot-row="order" data-channel={channel} style={{
    display: 'grid', gap: '2px', minWidth: 0,
    border: `1px solid ${boundary ? theme.colors.accent : theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300,
    padding: `${theme.sizing.scale200} ${theme.sizing.scale300}`,
    backgroundColor: tone === 'chosen' ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
  }}>
    {lead ?? <span style={{ ...theme.typography.LabelSmall, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{identity}</span>}
    {facts && <span data-testid={`${testid}-facts`} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{facts}</span>}
    {preview && <span data-testid={`${testid}-preview`} style={{ ...theme.typography.ParagraphXSmall, lineHeight: '16px', color: theme.colors.contentSecondary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</span>}
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.sizing.scale300, marginTop: '2px' }}>{acts}</div>
  </article>;
}

/** the frame every card wears — one boundary, the agent's own, inside the agent's turn */
export function CardFrame({ testId, title, note, children }: { testId: string; title: string; note?: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return <section data-testid={testId} data-copilot-card="open" style={{
    display: 'grid', gap: theme.sizing.scale400, marginTop: theme.sizing.scale300,
    padding: theme.sizing.scale500, minWidth: 0,
    border: `1px solid ${theme.colors.accent}`, borderRadius: theme.borders.radius400,
    backgroundColor: theme.colors.backgroundPrimary,
  }}>
    <header>
      <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{title}</h3>
      {note && <p style={{ margin: `${theme.sizing.scale200} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{note}</p>}
    </header>
    {children}
  </section>;
}


/* ── WHAT THE MIND PROPOSED, AS THINGS A PERSON CAN PRESS (FEED-IA §196.2 · §196.9 · E198.11) ──
 *
 * ⚠ THIS IS NOT A NEW CARD, AND THAT IS THE POINT. The mind's `supply-report` proposal mounts the
 * REPORT FORM that was already above; what is left over — open that order, open that customer,
 * this is what the floor should know, and the drafted customer messages — are ACTS, and an act on
 * this surface is a control on the turn. The row is the composer's own starter grammar (Peter,
 * 2026-08-08: a press writes the sentence INTO the box, where it can be edited, spoken over or
 * deleted before anything is sent), which is why a draft PREFILLS the composer rather than sending.
 *
 * NOTHING HERE SENDS. §196.9's drafted replies are the killer feature precisely because they stop
 * one press short of the customer: the words land in the box, the person reads them, and the send
 * is theirs — the same boundary THE-COPILOT-SPEC §5 draws around every other control in this file.
 */
export function ProposalActs({ sector, proposals, sales, onDraft, onLeave }: {
  /** whose house — the openers take a tenant, never a URL (§202.3) */
  sector: SectorId;
  proposals: CopilotProposal[];
  /** the day's own book — the documents an «Open order» press actually opens */
  sales: Sale[];
  /** put these words in the composer, where the person owns them */
  onDraft: (text: string) => void;
  onLeave: () => void;
}) {
  const [, theme] = useStyletron();
  const acts = proposals.filter((proposal) => proposal.kind !== 'answer' && proposal.kind !== 'supply-report');
  if (!acts.length) return null;
  const saleOf = (id: string) => sales.find((one) => one.id === id);
  const nameOf = (id: string) => {
    const order = saleOf(id);
    return order ? `${order.number} · ${order.customer.name}` : id;
  };
  return <div data-testid="copilot-proposals" style={{ display: 'grid', gap: theme.sizing.scale300, marginTop: theme.sizing.scale300, minWidth: 0 }}>
    {acts.map((proposal, index) => {
      if (proposal.kind === 'open-order') {
        return <div key={`open-order-${proposal.orderId}`}>
          <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`copilot-open-order-${proposal.orderId}`}
            overrides={{ BaseButton: { style: { minHeight: '44px', textAlign: 'left', maxWidth: '100%' } } }}
            onClick={() => { const sale = saleOf(proposal.orderId); if (sale) { onLeave(); openSale(sale); } }}>
            Open order {nameOf(proposal.orderId)}
          </Button>
        </div>;
      }
      if (proposal.kind === 'open-chat') {
        /* §202.3 · THE AGENT OPENS THE CHAT, NOT THE CUSTOMER PAGE. «"open chat" for whatsapp
           should be opening the chat popup» — so the press stands the dock down and the panel
           answers, and the app's location is where it was. */
        return <div key={`open-chat-${proposal.customerId}`}>
          <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`copilot-open-chat-${proposal.customerId}`}
            overrides={{ BaseButton: { style: { minHeight: '44px', textAlign: 'left', maxWidth: '100%' } } }}
            onClick={() => { onLeave(); openChat(sector, proposal.customerId); }}>
            Open chat
          </Button>
        </div>;
      }
      if (proposal.kind === 'stock-note') {
        return <p key={`stock-note-${index}`} data-testid="copilot-stock-note"
          style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {proposal.product}: {proposal.text}
        </p>;
      }
      /* §200.4 — THE DRAFTS ARE ROWS TOO, and the count is stated once at their head rather than
         a heading per row. Pressing «Use draft» writes the words into the composer (§196.9). */
      return <section key={`drafts-${index}`} data-testid="copilot-drafts" style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelSmall }}>Drafted replies · {words(proposal.drafts.length, 'order')}</span>
        {proposal.drafts.map((draft) => <OrderRow
          key={draft.orderId}
          testid={`copilot-draft-${draft.orderId}`}
          identity={`${draft.customer} · ${nameOf(draft.orderId).split(' · ')[0]}`}
          preview={draft.text.split('\n')[0]}
          acts={<RowAct testid={`copilot-draft-use-${draft.orderId}`} onPress={() => onDraft(draft.text)}>Use draft</RowAct>}
        />)}
      </section>;
    })}
  </div>;
}

/* ── THE PRODUCTS A TENANT HAS, catalogue growth included ────────────────────────────────────── */
export function useProducts(cast: Cast): Product[] {
  const catalogue = useCatalogue();
  return React.useMemo(
    () => [...cast.products, ...grownProducts(cast, OFF_LIST[cast.sector] ?? [], catalogue.state)],
    [cast, catalogue.state],
  );
}

/* ── RECIPIENT CARD (lifted whole) ───────────────────────────────────────────────────────────── */
function RecipientCard({ sector, row, selected, disposition, text, onToggle, onOpenOrder, onLeave }: {
  sector: SectorId; row: Affected; selected: boolean; disposition: 'ready' | 'accepted' | 'rejected' | 'retryable'; text: string; onToggle: () => void; onOpenOrder: () => void; onLeave: () => void;
}) {
  const [, theme] = useStyletron();
  const status = disposition === 'accepted' ? 'Sent.' : disposition === 'rejected' ? 'Held. Review before retrying.' : disposition === 'retryable' ? 'Delivery status unknown. Check before retrying.' : text;
  /* ── THE AGENT'S DOOR OPENS INSIDE THE APP (FEED-IA §202.3 · OUT-05.2 · OUT-05.3) ───────────
   * «"open chat" for whatsapp should be opening the chat popup, and open email as well. we become
   * their chat and email client.» This row pressed `web.whatsapp.com` and `mailto:` in a new tab —
   * the agent's own act throwing the person out of the app mid-review. It now stands the dock down
   * and opens the conversation, which is exactly the shape «Open order» beside it already has.
   *
   * ⚠ AND THE GATE GOES (OUT-05.2). The door was drawn only while sending was unavailable, as if
   * reading a conversation needed send authority. Opening one is READING. What the capability
   * still governs is whether the composer can SEND, which is where it belongs. */
  const conversationLabel = row.customer.channel === 'email' ? 'Open the email' : row.customer.channel === 'WhatsApp' ? 'Open chat' : null;
  const openConversation = () => {
    onLeave();
    if (row.customer.channel === 'email') openEmail(sector, row.customer.id, '', row.sale.id);
    else openChat(sector, row.customer.id, row.sale.id);
  };
  const testid = `assistant-recipient-${row.sale.id}`;
  /* THE ROW'S OWN FIRST LINE, and nothing after it. The whole message stands ONCE, in the card's
     wording field above; what belongs on the row is the part that is this order's — their
     quantity, their day — which the first line always carries. */
  const preview = status.split('\n')[0];
  return <OrderRow
    testid={testid}
    channel={accountChannelOf(row.customer.channel)}
    identity={`${row.customer.name} · ${row.sale.number}`}
    lead={customerOutboundAvailable
      ? <Checkbox checked={selected} disabled={disposition === 'accepted'} onChange={onToggle}
          overrides={{ Label: { style: { ...theme.typography.LabelSmall, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } } }}>
          {row.customer.name} · {row.sale.number}
        </Checkbox>
      : undefined}
    /* THE DAY IS SAID THE WAY THE HOUSE SAYS IT — «Friday 22.08», never the id it is stored
       under. A row that prints «2025-08-22» is asking the reader to decode a machine's format
       in the one place the day is a fact about their week. */
    facts={`Asked ${row.asked} ${row.unit} · available ${row.served} ${row.unit} · ${dayLabelFromId(row.day)}${row.reported ? ` · they already asked: ${row.reported}` : ''}`}
    preview={preview}
    boundary={customerOutboundAvailable && selected}
    tone={customerOutboundAvailable && selected ? 'chosen' : 'plain'}
    acts={<>
      <RowAct onPress={onOpenOrder}>Open order</RowAct>
      {conversationLabel && <RowAct testid={`assistant-open-conversation-${row.sale.id}`} onPress={openConversation}>{conversationLabel}</RowAct>}
    </>}
  />;
}

/* ── THE SUPPLY REVIEW, now a card in the turn ───────────────────────────────────────────────── */
export type FlowHooks = {
  cast: Cast;
  adapter?: AssistantRuntimeAdapter;
  context: AssistantContext;
  report?: OperatorReport;
  savedReview?: SupplyReviewDraft;
  /** append a turn to the running session */
  onTurn: (message: CopilotMessage) => boolean;
  /** record the flow's own state on the session */
  onFlow: (flow: { report?: OperatorReport; review?: SupplyReviewDraft }) => boolean;
  /** the person is leaving for another surface — the dock stands down and the session stays */
  onLeave: () => void;
};

function SupplyReview({ cast, issue, adapter, onTurn, reported, rowsOverride, savedReview, onReviewChange, onLeave }: {
  cast: Cast; issue: SupplyIssue; adapter?: AssistantRuntimeAdapter; onTurn: (message: CopilotMessage) => boolean;
  reported?: OperatorReport; rowsOverride?: Affected[]; savedReview?: SupplyReviewDraft;
  onReviewChange: (draft: SupplyReviewDraft) => boolean; onLeave: () => void;
}) {
  const [, theme] = useStyletron();
  const { inventory } = useWorkspaceCapabilities();
  const inventoryAvailable = releaseInventoryAvailable && inventory;
  const supply = useSupplyIssues(cast);
  const products = useProducts(cast);
  const product = products.find((item) => item.id === issue.product);
  const canUseLedgerProjector = cast.products.some((item) => item.id === issue.product);
  const projectedRows = React.useMemo(() => canUseLedgerProjector ? affectedOf({ cast, sales: supply.sales, today: supply.today, issue }) : [], [canUseLedgerProjector, cast, supply.sales, supply.today, issue]);
  const rows = rowsOverride ?? projectedRows;
  /* both read the ledger by issue, and `productOf` falls back rather than throwing, so they are
     safe to compute before the missing-product guard below — which is where the hooks order needs
     them anyway (every hook runs on every render, guard or no guard). */
  const swap = React.useMemo(() => swapFor(cast, supply.ledger, issue), [cast, supply.ledger, issue]);
  const useful = React.useMemo(() => usefulNext({ cast, rules: supply.rules, issue, now: supply.now }), [cast, supply.rules, issue, supply.now]);
  const availableAlternatives = ALTERNATIVES.filter((item) => item !== 'swap' || !!swap);
  const [alternatives, setAlternatives] = React.useState<Alternative[]>(() => ((savedReview?.alternatives as Alternative[] | undefined) ?? availableAlternatives).filter((item) => availableAlternatives.includes(item)));
  const affectedRows = rows.filter((row) => row.owed > 0);
  const [selected, setSelected] = React.useState<string[]>(() => (savedReview?.selected ?? affectedRows.map((row) => row.sale.id)).filter((id) => affectedRows.some((row) => row.sale.id === id)));
  const [message, setMessage] = React.useState(savedReview?.message ?? '');
  const [wordingSaved, setWordingSaved] = React.useState(false);
  const reviewRef = React.useRef<SupplyReviewDraft>({ message: savedReview?.message ?? '', selected: savedReview?.selected ?? affectedRows.map((row) => row.sale.id), alternatives: (savedReview?.alternatives ?? availableAlternatives) as string[] });
  const saveReview = (next: SupplyReviewDraft): boolean => { reviewRef.current = next; return onReviewChange(next); };
  const [outcomes, setOutcomes] = React.useState<Record<string, 'accepted' | 'rejected' | 'retryable'>>({});
  const [failure, setFailure] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const sendLock = React.useRef(false);

  if (!product) return <section data-testid="assistant-supply-missing-product">This product has left this catalogue. Reopen the stock reading before preparing a message.</section>;

  const availability = adapter?.availability() ?? { verified: false, reason: 'Messaging is ready to connect. Review or copy the message meanwhile.' };
  const revision = `${cast.sector}:${issue.product}:${issue.standing}:${issue.committed}:${supply.today}`;
  const template: Template = { keep: alternatives.filter((item) => item !== 'swap' || !!swap), swap };
  const textFor = (row: Affected) => message.trim() || (cast.products.some((item) => item.id === issue.product) ? messageFor({ cast, issue, row, template, useful: row.reported ? useful : undefined }) : customerOutboundAvailable ? 'Write the customer message before sending.' : 'Write a customer update for this review.');
  const pending = affectedRows.filter((row) => selected.includes(row.sale.id) && (outcomes[row.sale.id] === undefined || outcomes[row.sale.id] === 'retryable'));
  const proposalText = pending.map((row) => `${row.sale.id}\u0000${textFor(row)}`).join('\u0001');
  const proposal = { id: `supply:${revision}:${digest(proposalText)}`, digest: digest(proposalText) };
  const setDisposition = (ids: string[] | undefined, next: 'accepted' | 'rejected' | 'retryable') => setOutcomes((held) => ({ ...held, ...(ids ?? []).reduce<Record<string, 'accepted' | 'rejected' | 'retryable'>>((all, id) => ({ ...all, [id]: next }), {}) }));
  const send = async () => {
    if (!adapter || !availability.verified || sendLock.current || pending.length === 0) return;
    sendLock.current = true; setSending(true); setFailure(null);
    try {
      const receipt = await adapter.sendSupplyUpdate({ proposalId: proposal.id, textDigest: proposal.digest, sector: cast.sector, revision, issue: { productId: issue.product, shortage: issue.short, unit: issue.unit }, recipients: pending.map((row) => ({ id: row.sale.id, customerId: row.customer.id, orderId: row.sale.id, text: textFor(row) })) });
      const expected = pending.map((row) => row.sale.id).sort();
      const declared = [...receipt.recipientIds, ...(receipt.rejectedRecipientIds ?? []), ...(receipt.retryableRecipientIds ?? [])].sort();
      if (receipt.proposalId !== proposal.id || receipt.textDigest !== proposal.digest || receipt.sector !== cast.sector || receipt.revision !== revision || declared.join('|') !== expected.join('|')) throw new Error('The delivery receipt belongs to a different proposal. The recipients stay as they were.');
      setDisposition(receipt.recipientIds, 'accepted'); setDisposition(receipt.rejectedRecipientIds, 'rejected'); setDisposition(receipt.retryableRecipientIds, 'retryable');
      const receiptSaved = onTurn(say(receipt.recipientIds.length === expected.length ? `Delivery accepted ${words(expected.length, 'order')}.` : `Delivery accepted ${words(receipt.recipientIds.length, 'order')}; the remaining outcomes need review.`, { proposal: { id: proposal.id, revision, digest: proposal.digest, receipt } }));
      if (!receiptSaved) setFailure('Delivery was accepted; saving the receipt in this browser stalled. Keep this review open.');
    } catch (error) { const detail = error instanceof Error ? error.message : 'The delivery receipt is still to arrive.'; setFailure(`Delivery status is unknown. Check before sending again. ${detail}`); }
    finally { sendLock.current = false; setSending(false); }
  };

  return <CardFrame
    testId="assistant-supply-review"
    title={`${product.name} supply review`}
    note={`${reported ? `${issue.standing} ${issue.unit} reported available · ${issue.committed} ${issue.unit} on open orders.` : `${issue.short} ${issue.unit} short · ${issue.standing} ${issue.unit} available · ${issue.committed} ${issue.unit} on open orders.`} ${inventoryAvailable ? 'Stock changes when you save a count.' : 'Report only. Stock is unchanged.'}`}
  >
    <Trails trails={[{ id: 'stock', label: reported ? 'Reported availability' : 'Stock and orders', summary: `${issue.short} ${issue.unit} short`, status: reported ? 'pending' : 'complete', detail: reported ? [reported.text, 'Report only; stock is unchanged.'] : [issue.method] }, { id: 'orders', label: 'Affected orders', summary: words(affectedRows.length, 'order'), status: 'complete', detail: affectedRows.map((row) => `${row.sale.number} · ${row.customer.name}`) }, { id: 'automatic', label: 'Suggestions', summary: 'Unavailable', status: 'blocked', detail: [customerOutboundAvailable ? 'Review the affected orders before choosing what to send.' : 'Review the affected orders before saving the draft.'] }]} />
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>{availableAlternatives.map((item) => <Button key={item} kind={alternatives.includes(item) ? KIND.primary : KIND.secondary} size={SIZE.compact} shape={SHAPE.pill} onClick={() => { const next = alternatives.includes(item) ? alternatives.filter((value) => value !== item) : [...alternatives, item]; setAlternatives(next); saveReview({ ...reviewRef.current, alternatives: next }); }}>{ALTERNATIVE_WORD[item]}</Button>)}</div>
    <div style={{ display: 'grid', gap: theme.sizing.scale200 }}>
      <label style={{ display: 'grid', gap: theme.sizing.scale100 }}>
        <span style={{ ...theme.typography.LabelSmall }}>Message wording</span>
        <Input value={message} placeholder={customerOutboundAvailable ? 'Edit the message every selected order will receive' : 'Draft an update for these customers'} onChange={(event) => { const next = event.currentTarget.value; setMessage(next); setWordingSaved(false); saveReview({ ...reviewRef.current, message: next }); }} />
      </label>
      <div><Button kind={KIND.secondary} size={SIZE.compact} onClick={() => setWordingSaved(saveReview({ ...reviewRef.current, message }))}>Save wording</Button></div>
      {wordingSaved && <span data-testid="assistant-wording-saved" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Message wording saved to this review.</span>}
    </div>
    {/* §200.4 — THE COUNT IS STATED ONCE, at the head of the rows it counts, so no row has to
        carry a heading of its own. */}
    <div style={{ display: 'grid', gap: theme.sizing.scale300 }}>
      {affectedRows.length > 0 && <span data-testid="assistant-recipients-head" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary }}>Affected orders · {affectedRows.length}</span>}
      {affectedRows.length ? affectedRows.map((row) => <RecipientCard key={row.sale.id} row={row} selected={selected.includes(row.sale.id)} disposition={outcomes[row.sale.id] ?? 'ready'} text={textFor(row)} onToggle={() => { const next = selected.includes(row.sale.id) ? selected.filter((id) => id !== row.sale.id) : [...selected, row.sale.id]; setSelected(next); saveReview({ ...reviewRef.current, selected: next }); }} onOpenOrder={() => { onLeave(); openSale(row.sale); }} sector={cast.sector} onLeave={onLeave} />) : <p style={{ margin: 0, ...theme.typography.ParagraphSmall }}>Every open order stands as it was written.</p>}
    </div>
    {customerOutboundAvailable
      ? <div style={{ display: 'grid', gap: theme.sizing.scale200 }}><span style={{ ...theme.typography.ParagraphXSmall, color: availability.verified ? theme.colors.contentSecondary : theme.colors.negative }}>{availability.verified ? 'Messages are checked for each order.' : availability.reason}</span>{failure && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{failure}</span>}<Button data-testid="assistant-send-supply" kind={KIND.primary} size={SIZE.default} disabled={!availability.verified || sending || pending.length === 0} onClick={() => void send()}>{sending ? 'Sending…' : availability.verified ? `Send to ${words(pending.length, 'order')}` : 'Messaging is ready to connect'}</Button></div>
      : <span data-testid="assistant-draft-only" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Drafts, ready to send from each customer’s chat.</span>}
  </CardFrame>;
}

function ManualSupplyResult({ cast, context, report, onTurn, onLeave }: { cast: Cast; context: AssistantContext; report: OperatorReport; onTurn: (message: CopilotMessage) => boolean; onLeave: () => void }) {
  const [, theme] = useStyletron();
  const { inventory } = useWorkspaceCapabilities();
  const inventoryAvailable = releaseInventoryAvailable && inventory;
  const products = useProducts(cast);
  const product = context.productId ? products.find((item) => item.id === context.productId) : undefined;
  const reason = report.availabilityKind === 'inbound'
    ? `Incoming stock${report.when ? ` is expected ${report.when}` : ' arrives at a time still to confirm'}. It reaches the floor then.`
    : report.currentAvailability === null
      ? 'The available quantity is still to record.'
      : 'This product and the affected orders read in different units.';
  return <CardFrame testId="assistant-manual-supply-result" title={inventoryAvailable ? 'Review stock' : 'Supply report'} note={`${reason} Stock and messages are unchanged.`}>
    <Trails trails={[{ id: 'report', label: 'Report', summary: product?.name ?? 'product', status: 'complete', detail: report.text.split('\n') }, { id: 'stock', label: inventoryAvailable ? 'Review stock' : 'Stock tracking', summary: inventoryAvailable ? 'needed' : 'Planned', status: 'blocked', detail: [inventoryAvailable ? 'Open Stock to enter a count. This report stays saved here.' : PLANNED_CAPABILITY_HELP] }]} />
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
      {inventoryAvailable
        ? <Button data-testid="assistant-review-counted-stock" kind={KIND.secondary} size={SIZE.compact} disabled={!context.productId} onClick={() => { if (!context.productId) return; onLeave(); requestStockEntry({ sector: cast.sector, productId: context.productId, mode: 'count', origin: 'stock-update' }); openProduct(context.productId); }}>Review stock</Button>
        : <span data-testid="assistant-stock-planned" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{PLANNED_CAPABILITY_HELP}</span>}
      <Button kind={KIND.secondary} size={SIZE.compact} onClick={() => onTurn(say('Supply report saved. Stock and messages unchanged.'))}>Save report</Button>
    </div>
  </CardFrame>;
}

/** the card that decides which supply state the session is in — the host used to do this */
export function SupplyCard({ hooks }: { hooks: FlowHooks }) {
  const { cast, context, report } = hooks;
  const supply = useSupplyIssues(cast);
  const products = useProducts(cast);

  const manualAffected = React.useMemo((): Affected[] | undefined => {
    if (!report || report.availabilityKind !== 'current' || report.currentAvailability === null || !context.productId) return undefined;
    const product = products.find((item) => item.id === context.productId);
    if (!product) return undefined;
    const rows: Affected[] = [];
    for (const sale of supply.sales) {
      if (RANK[sale.state] >= RANK.sent || (sale.day !== supply.today && !isStanding(sale, supply.today))) continue;
      const lines = sale.lines.filter((item) => item.product.id === product.id && !item.off);
      if (!lines.length) continue;
      /* A report can support arithmetic only when every matching line has the exact product unit. */
      if (lines.some((line) => line.unit !== product.unit)) return undefined;
      const asked = lines.reduce((sum, line) => sum + (line.given ?? line.ordered), 0);
      if (asked <= 0) continue;
      rows.push({ sale, customer: sale.customer, asked, served: 0, owed: asked, unit: product.unit, day: sale.day });
    }
    rows.sort((a, b) => a.day === b.day ? a.sale.at.localeCompare(b.sale.at) : a.day.localeCompare(b.day));
    let left = Math.max(0, report.currentAvailability);
    return rows.map((row) => {
      const served = Math.min(row.asked, left); left -= served;
      return { ...row, served, owed: row.asked - served };
    });
  }, [products, context.productId, report, supply.sales, supply.today]);

  const reportedIssue = React.useMemo(() => {
    if (!report || !context.productId || !manualAffected) return undefined;
    const product = products.find((item) => item.id === context.productId);
    if (!product || report.currentAvailability === null) return undefined;
    const committed = manualAffected.reduce((sum, row) => sum + row.asked, 0);
    return { product: product.id, unit: product.unit, standing: report.currentAvailability, committed, short: Math.max(0, committed - report.currentAvailability), gone: report.currentAvailability === 0, approx: false, method: 'Reported availability; physical stock stands as it was.' } satisfies SupplyIssue;
  }, [products, context.productId, manualAffected, report]);

  if (!report) return null;
  if (!reportedIssue) return <ManualSupplyResult cast={cast} context={context} report={report} onTurn={hooks.onTurn} onLeave={hooks.onLeave} />;
  return <SupplyReview
    key={`${reportedIssue.product}:${reportedIssue.standing}`}
    cast={cast} issue={reportedIssue} adapter={hooks.adapter} onTurn={hooks.onTurn} reported={report}
    rowsOverride={manualAffected} savedReview={hooks.savedReview}
    onReviewChange={(review) => hooks.onFlow({ report, review })}
    onLeave={hooks.onLeave}
  />;
}

/* ── THE REPORT FORM, now a card ─────────────────────────────────────────────────────────────── */
export function SupplyReportCard({ hooks, onContinue }: { hooks: FlowHooks; onContinue: (context: AssistantContext, report: OperatorReport) => void }) {
  const [, theme] = useStyletron();
  const { cast, context } = hooks;
  const products = useProducts(cast);
  const [productId, setProductId] = React.useState(context.productId ?? '');
  const [productQuery, setProductQuery] = React.useState('');
  const [problem, setProblem] = React.useState(context.complaint ?? '');
  const [availability, setAvailability] = React.useState('');
  const [when, setWhen] = React.useState('');
  const [availabilityKind, setAvailabilityKind] = React.useState<'current' | 'inbound'>('current');
  const product = products.find((item) => item.id === productId);
  const visibleProducts = products.filter((item) => item.name.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 12);
  const continueReview = () => {
    const parsed = availability.trim() ? Number(availability.replace(',', '.')) : null;
    if (product && problem.trim() && (parsed === null || (Number.isFinite(parsed) && parsed >= 0))) {
      onContinue({ ...context, productId }, {
        text: `Problem: ${problem.trim()}\n${availabilityKind === 'current' ? 'Reported available now' : 'Reported incoming stock'}: ${availability.trim() || 'still to confirm'} ${product.unit}\nWhen: ${when.trim() || 'still to confirm'}`,
        currentAvailability: parsed, availabilityKind, when: when.trim(),
      });
    }
  };
  return <CardFrame testId="assistant-supply-report" title="Report a supply issue" note="Report only. Stock and customer messages stay unchanged.">
    <label style={{ display: 'grid', gap: theme.sizing.scale100 }}><span style={{ ...theme.typography.LabelSmall }}>Product</span><Input value={productQuery} onChange={(event) => setProductQuery(event.currentTarget.value)} placeholder="Search products" /></label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>{visibleProducts.map((item) => <Button key={item.id} kind={item.id === productId ? KIND.primary : KIND.secondary} size={SIZE.compact} shape={SHAPE.pill} onClick={() => setProductId(item.id)}>{item.name}</Button>)}</div>
    {product && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Unit: {product.unit}</span>}
    <label style={{ display: 'grid', gap: theme.sizing.scale100 }}><span style={{ ...theme.typography.LabelSmall }}>What happened?</span><Input value={problem} onChange={(event) => setProblem(event.currentTarget.value)} placeholder="Describe the supply problem" /></label>
    <div style={{ display: 'flex', gap: theme.sizing.scale200 }}><Button kind={availabilityKind === 'current' ? KIND.primary : KIND.secondary} size={SIZE.compact} onClick={() => setAvailabilityKind('current')}>Available now</Button><Button kind={availabilityKind === 'inbound' ? KIND.primary : KIND.secondary} size={SIZE.compact} onClick={() => setAvailabilityKind('inbound')}>Incoming stock</Button></div>
    <label style={{ display: 'grid', gap: theme.sizing.scale100 }}><span style={{ ...theme.typography.LabelSmall }}>{availabilityKind === 'current' ? 'Available now' : 'Incoming amount'}{product ? ` (${product.unit})` : ''}</span><Input value={availability} onChange={(event) => setAvailability(event.currentTarget.value)} placeholder={availabilityKind === 'current' ? 'Enter available amount' : 'Enter confirmed incoming amount'} /></label>
    <label style={{ display: 'grid', gap: theme.sizing.scale100 }}><span style={{ ...theme.typography.LabelSmall }}>When</span><Input value={when} onChange={(event) => setWhen(event.currentTarget.value)} placeholder="Expected date/time, only if confirmed" /></label>
    <div><Button kind={KIND.primary} size={SIZE.default} disabled={!product || !problem.trim()} onClick={continueReview}>Review affected orders</Button></div>
  </CardFrame>;
}

/* ── THE CATALOGUE CORRECTION, now a card ────────────────────────────────────────────────────── */
export function CatalogueCard({ hooks }: { hooks: FlowHooks }) {
  const [, theme] = useStyletron();
  const { cast, context } = hooks;
  const catalogue = useCatalogue();
  const products = useProducts(cast);
  const [chosen, setChosen] = React.useState<string[]>(() => context.productIds ?? (context.productId ? [context.productId] : []));
  const members = React.useMemo(() => chosen.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product)), [chosen, products]);
  const sourceCategory = context.categoryId ?? (members[0] ? groundOf(cast, members[0], catalogue.state).node : '');
  const [target, setTarget] = React.useState('');
  const [complaint, setComplaint] = React.useState(context.complaint ?? '');
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const options = React.useMemo(() => sourceCategory ? nearbyNodes(sourceCategory) : [], [sourceCategory]);
  const apply = () => {
    if (!target || target === sourceCategory || members.length === 0 || !nodeOf(target) || !complaint.trim()) return;
    try {
      const reason = `Catalogue correction: ${complaint.trim()}`;
      reground(cast.sector, members.map((product) => ({ id: product.id, said: groundOf(cast, product, catalogue.state).name })), target, reason);
      const saved = hooks.onTurn(say(`Category saved for ${words(members.length, 'product')}. Prices, stock, and orders are unchanged.`));
      setApplyError(saved ? null : 'Category saved; saving the agent’s receipt in this browser stalled. Keep this review open.');
    } catch { setApplyError('Saving the category stalled. Your catalogue stands as it was.'); }
  };
  return <CardFrame
    testId="assistant-catalogue-review"
    title="Review a catalogue correction"
    note={members.length ? `${words(members.length, 'product')} selected. Choose the corrected category and record why.` : 'Choose a product, then the corrected category and reason.'}
  >
    <Trails trails={[{ id: 'selection', label: 'Products', summary: words(members.length, 'product'), status: 'complete', detail: members.map((product) => product.name) }, { id: 'automatic', label: 'Automatic review', summary: 'Ready to connect', status: 'blocked', detail: ['Automatic suggestions are unavailable. Choose a category to continue.'] }]} />
    {!members.length && <div data-testid="assistant-catalogue-picker" style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>{products.map((product) => <Button key={product.id} kind={KIND.secondary} size={SIZE.compact} shape={SHAPE.pill} onClick={() => setChosen([product.id])}>{product.name}</Button>)}</div>}
    <label style={{ display: 'grid', gap: theme.sizing.scale100 }}><span style={{ ...theme.typography.LabelSmall }}>Why change it?</span><Input value={complaint} onChange={(event) => setComplaint(event.currentTarget.value)} placeholder="Describe the category correction" /></label>
    {applyError && <span role="alert" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{applyError}</span>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>{options.map((node) => <Button key={node.id} kind={target === node.id ? KIND.primary : KIND.secondary} size={SIZE.compact} shape={SHAPE.pill} onClick={() => setTarget(node.id)}>{node.name}</Button>)}</div>
    <div><Button kind={KIND.primary} size={SIZE.default} disabled={!target || target === sourceCategory || !complaint.trim() || members.length === 0} onClick={apply}>Save category</Button></div>
  </CardFrame>;
}
