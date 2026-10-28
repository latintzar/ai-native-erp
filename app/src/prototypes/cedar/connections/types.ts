/** Private proof DTOs. Provider tokens and the ordinary Cedar fixture model stay server-side. */
export type Connection = {
  wabaId: string;
  phoneId: string;
  number: string;
  name: string;
  coexistence: boolean;
  workspace?: string;
};

export type ProofState = {
  ready: boolean;
  blockers: string[];
  meta: { appId: string; configId: string; graphVersion: string };
  connection: Connection | null;
  setup?: { status: 'pending' | 'ready' | 'interrupted'; step: string; error: string | null } | null;
  history: {
    status: 'idle' | 'waiting' | 'syncing' | 'complete' | 'declined' | 'interrupted';
    progress: number | null;
    messages: number;
    conversations: number;
    oldestAt: string | null;
    newestAt: string | null;
  };
};

export type Conversation = {
  id: string;
  name: string;
  number: string;
  lastMessage: string;
  lastAt: string;
  count: number;
};

export type ProofMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  text: string;
  kind: string;
  timestamp: string;
  historical: boolean;
  mediaAvailable: boolean;
};

export type MessagePage = { messages: ProofMessage[]; nextCursor: string | null };

export type WhatsAppIntakeMessage = {
  id: string;
  conversationId: string;
  name: string;
  number: string;
  text: string;
  timestamp: string;
  historical: false;
  /** Server-resolved from a private exact provider/sender binding. */
  customerId?: string;
};

export type WhatsAppIntakePage = { workspace: string; messages: WhatsAppIntakeMessage[]; nextCursor: string | null };

export function mergeMessages(...pages: ProofMessage[][]): ProofMessage[] {
  const byId = new Map<string, ProofMessage>();
  for (const page of pages) for (const message of page) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) =>
    Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id));
}
