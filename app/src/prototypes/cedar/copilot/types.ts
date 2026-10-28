/* THE COPILOT'S OBJECTS (FEED-IA §196.2 — «it's literally an agent and should have the same
 * shit like all top agents with other sessions etc.»).
 *
 * The old assistant had one thing: a Thread with Entries, and two MODES that replaced the
 * conversation whenever a flow ran. §196.2 repeals the modes. What is left is an agent with
 * three objects, and they are the ones every top agent has:
 *
 *   SESSION   a conversation with a title, a time and a place in a list. It survives the tab
 *             (localStorage, per tenant), which is what makes a session LIST a list rather than
 *             a memory of this minute.
 *   MESSAGE   one turn. It carries words, and — this is the change — it may carry a CARD: the
 *             supply review or the catalogue correction, mounted INSIDE the turn that opened it.
 *   CARD      a flow the agent put in the conversation. It is where the agent's proposals live,
 *             and nothing in it acts until the person presses the act.
 *
 * WHAT THE AGENT MAY ACT ON is a property of the CARD, never of the words: a turn can explain,
 * organise and draft; only a card's own explicit control changes anything, and the only two that
 * do are the catalogue's «Save category» and the reviewed supply message's Send (which is itself
 * capability-gated). THE-COPILOT-SPEC.md states the whole boundary.
 */
import type { Cast } from '../../../scenarios/data/cast';
import type { CopilotProposal } from '../runtime-client';
import type { Take } from '../../../rocoto/voice-button-kit';

/** which door opened the session — it decides the first turn and the session's title */
export type AssistantKind = 'general' | 'supply' | 'catalogue';

export type AssistantContext = {
  productId?: string;
  productIds?: string[];
  categoryId?: string;
  orderId?: string;
  complaint?: string;
  source?: 'stock' | 'catalogue' | 'navigation' | 'unknown';
};

export type OpenAssistantDetail = { kind?: AssistantKind; context?: AssistantContext };

/* ── THE PROVIDER SEAM (unchanged from the assistant it replaces) ───────────────────────────── */

export type AssistantSendRequest = {
  proposalId: string;
  textDigest: string;
  sector: Cast['sector'];
  revision: string;
  issue: { productId: string; shortage: number; unit: string };
  recipients: Array<{ id: string; customerId: string; orderId: string; text: string }>;
};

export type AssistantDeliveryReceipt = {
  id: string;
  proposalId: string;
  textDigest: string;
  sector: Cast['sector'];
  revision: string;
  /** Order ids that the provider accepted. Unknown timeout ids must not appear here. */
  recipientIds: string[];
  rejectedRecipientIds?: string[];
  retryableRecipientIds?: string[];
  acceptedAt: string;
};

export type AssistantRuntimeAdapter = {
  availability(): { verified: boolean; reason?: string };
  sendSupplyUpdate(request: AssistantSendRequest): Promise<AssistantDeliveryReceipt>;
  /** Approved transport only. No browser SpeechRecognition fallback is permitted. */
  dictate?(take: Take): string | undefined;
};

/* ── THE TURN'S PARTS ───────────────────────────────────────────────────────────────────────── */

/** a completed, pending or blocked step the agent actually took — never a chain of thought */
export type Activity = {
  id: string;
  label: string;
  summary: string;
  detail: string[];
  status: 'complete' | 'blocked' | 'pending';
};

/** THE CARDS. A card is a flow that lives inside a turn; it is the only thing that may act. */
export type CopilotCard =
  /** the supply report form — product, what happened, availability, when */
  | { kind: 'supply-report' }
  /** the reviewed supply message: affected orders, wording, per-order outcome */
  | { kind: 'supply-review' }
  /** the catalogue correction: products, reason, target category */
  | { kind: 'catalogue-review' };

export type OperatorReport = {
  text: string;
  currentAvailability: number | null;
  availabilityKind: 'current' | 'inbound';
  when: string;
};

export type SupplyReviewDraft = { message: string; selected: string[]; alternatives: string[] };

export type CopilotMessage = {
  id: string;
  at: string;
  role: 'operator' | 'copilot';
  text: string;
  /** what the agent read to answer — from real results only (INTX UTL-A09) */
  activity?: Activity[];
  /** a flow mounted in this turn */
  card?: CopilotCard;
  /* ── WHAT THE MIND PROPOSED, AND WHAT IT COST (FEED-IA §196.2 · E198) ──────────────────────
   * A turn that came from the runtime carries the proposals it made and the evidence of the call.
   * Both are optional and both are additive to store v3: a session filed before the mind existed
   * reads back exactly as it did, because a turn with neither field renders as it always has. */
  /** the acts the mind put on this turn — grounded server-side against the context it was sent */
  proposals?: CopilotProposal[];
  /** which mind answered, how long it took, what it cost. Printed on the turn. */
  evidence?: { model: string; ms: number; tokens: number };
  /** the receipt of a reviewed send, kept with the turn that reported it */
  proposal?: { id: string; revision: string; digest: string; receipt?: AssistantDeliveryReceipt };
  /** the words arrived by dictation — stated on the turn, because the person spoke them */
  dictated?: boolean;
};

export type CopilotSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** the door that opened it */
  origin: AssistantKind;
  context: AssistantContext;
  messages: CopilotMessage[];
  /** the running flow's own state, so reopening a session restores the review it was in */
  flow?: { report?: OperatorReport; review?: SupplyReviewDraft };
};

/** version 3: sessions replace v2's threads, and they live in localStorage rather than the tab.
 *  WHICH session a tab is in is deliberately absent — that is a fact about the window, not about
 *  the house's record, so two windows may sit in two sessions without moving each other. */
export type { CopilotProposal } from '../runtime-client';

export type CopilotStore = {
  version: 3;
  sector: Cast['sector'];
  revision: number;
  sessions: CopilotSession[];
};
