/** Private provider source views remain in React memory; only opaque access is held by channelApi. */
import { channelApi, channelDownload } from './cedar-channel-api';
import { installEmailProviderRuntime, publishEmailSourceChange, type EmailConnectionStatus } from './email-provider';

export type MailboxProvider = 'google' | 'outlook' | 'imap';
export type MailboxAccount = {
  account_ref: string; provider: MailboxProvider; mode: 'connected' | 'forwarded';
  status: 'connected' | 'attention' | 'unavailable'; label: string; initial_sync?: string | null;
  revision: number; history_complete: boolean; synced_at: string | null;
  invoice_consent_at: string | null; forwarding_address: string | null;
};
export type EmailStatus = { provider: 'unipile'; configured: boolean; accounts: MailboxAccount[] };
export type EmailMessage = {
  source_ref: string; account_ref: string; provider: MailboxProvider; mode: 'connected' | 'forwarded';
  subject: string; from: string[]; to: string[]; at: string; body: string;
  attachments: { attachment_ref: string; name: string; content_type: string; available: boolean }[];
  replyable?: boolean;
  /** The message as written, minus what could run; present on thread reads. */
  html?: string;
  snippet?: string;
  unread?: boolean;
  customerId?: string;
  provenance: { source_ref: string; source_revision: number; method: string; observed_at: string; content_state: 'provider_backed' };
};
/** `bound` is how many customer addresses the history was read for; the empty state states it. */
export type EmailPage = { messages: EmailMessage[]; has_more?: boolean; next_cursor?: string | null; coverage?: string; bound?: number; unnamed?: number };
export type EmailIntakeMessage = {id:string;sourceRef:string;sourceRevision:number;accountRef:string;
  conversationId:string;timestamp:string;text:string;historical:false;customerId?:string};
export type EmailIntakePage = {messages:EmailIntakeMessage[];nextCursor:string;hasMore:boolean};
export type EmailLineReview = { result: { columns: string[]; rows: Record<string, unknown>[] }; review_required: true;
  provenance: { source_ref: string; attachment_ref: string; method: string; observed_at: string } };

export const readEmailStatus = (signal?: AbortSignal) => channelApi<EmailStatus>('/email/status', { signal });
export const readEmailIntake = (after = '', signal?: AbortSignal) => channelApi<EmailIntakePage>(
  `/email/intake?limit=50${after ? `&after=${encodeURIComponent(after)}` : ''}`, { signal });
export const beginEmailAuth = (provider: MailboxProvider, returnTo: 'onboarding' | 'settings' = 'settings') => channelApi<{ url: string; expires_at: string }>('/email/auth', { body: { provider, return_to: returnTo } });
export const disconnectEmail = (account: string) => channelApi<{ disconnected: true }>(`/email/accounts/${account}`, { method: 'DELETE' });
/* THE CUSTOMERS A MAILBOX IS READ FOR (PR #95). The runtime keeps the whole mailbox at Unipile and
   reads only mail exchanged with an address bound to a customer, so the browser pushes one binding
   per customer address BEFORE the first sync. The request carries an address and a customer id and
   nothing else; the private key it forms stays on the server. */
export const bindEmailCustomer = (account: string, address: string, customerId: string) =>
  channelApi<{ customerId: string }>(`/email/accounts/${account}/customer-binding`, { body: { address, customer_id: customerId } });
export const syncEmail = (account: string, refresh = false) => channelApi<EmailPage>(`/email/accounts/${account}/sync`, { body: { refresh } });
export const readEmailThread = (source: string, cursor?: string, signal?: AbortSignal) => channelApi<EmailPage>(`/email/sources/${source}/thread${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal });
export const consentEmailInvoices = (account: string, consent: boolean) => channelApi<{ consent_at: string | null }>(`/email/accounts/${account}/invoice-consent`, { body: { consent } });
export const searchEmailInvoices = (account: string, query: string) => channelApi<EmailPage>(`/email/accounts/${account}/invoice-search`, { body: { query } });
/** Answer a customer's message from the connected mailbox; the provider's send is the receipt. */
export const replyToEmail = (source: string, text: string, idempotencyKey: string, html?: string) =>
  channelApi<{ accepted: true; receipt_ref: string; repeated?: boolean }>(`/email/sources/${source}/reply`, { body: { text, idempotency_key: idempotencyKey, ...(html ? { html } : {}) } });
/** A message composed by the person, sent from their connected mailbox to the addresses they typed. */
export type OutgoingEmail = { to: string[]; cc?: string[]; subject: string; text: string; html?: string; idempotency_key: string;
  attachments?: { name: string; content_type: string; data: string }[];
  /** The source this message answers; the mailbox threads it underneath. */
  in_reply_to?: string };
export const sendEmail = (account: string, mail: OutgoingEmail) =>
  channelApi<{ accepted: true; receipt_ref: string; repeated?: boolean; recipients?: number; files?: number }>(`/email/accounts/${account}/send`, { body: mail, timeoutMs: 120000 });
export const parseEmailAttachment = (source: string, attachment: string) => channelApi<EmailLineReview>(`/email/sources/${source}/attachments/${attachment}/parse`, { body: {}, timeoutMs: 620000 });
export const downloadEmailAttachment = (source: string, attachment: string) => channelDownload(`/email/sources/${source}/attachments/${attachment}`);

/** Install current verified standing in the existing email renderer. Read access grants no send. */
export function installMailboxStanding(status: EmailStatus): () => void {
  const providers = status.accounts.filter(row => row.status === 'connected' && row.mode === 'connected')
    .flatMap(row => row.provider === 'google' ? ['gmail' as const] : row.provider === 'outlook' ? ['m365' as const] : []);
  const connection: EmailConnectionStatus = providers.length ? { kind: 'connected', providers, canSend: true } : { kind: 'unverified', reason: 'Connect your mailbox to continue.' };
  /* A reply leaves from the connected mailbox through the runtime: the customer sees the
     business's own address, and the runtime writes only to known customer addresses. */
  return installEmailProviderRuntime({ connectionStatus: () => connection,
    replyAvailability: source => source && source.provider !== 'forwarded' && providers.includes(source.provider) && source.sourceRef
      ? { kind: 'ready', provider: source.provider, sourceRef: source.sourceRef }
      : { kind: 'read_only', provider: source?.provider ?? 'forwarded', reason: 'Connect this mailbox to reply from Rocoto.' },
    sendReply: async request => {
      try {
        const receipt = await replyToEmail(request.sourceRef, request.plainText, request.idempotencyKey);
        return { kind: 'accepted', receiptRef: receipt.receipt_ref };
      } catch (error) {
        return { kind: 'failed', reason: error instanceof Error ? error.message : 'The mailbox kept the reply; try again.' };
      }
    },
  });
}

export function announceEmailRefresh(messages: EmailMessage[]): void {
  for (const message of messages) publishEmailSourceChange(message.source_ref);
}
