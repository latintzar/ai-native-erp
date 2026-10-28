/**
 * The browser-side seam for a connected mailbox.
 *
 * It deliberately contains no OAuth token, provider account id, raw source body, attachment
 * bytes, retry queue, or local persistence. A production implementation registers a thin client
 * for Rocoto's authenticated backend; that backend owns provider credentials and authorization.
 * The default is deliberately unable to send. Fixture metadata and a Settings toggle are never
 * proof that a mailbox is connected.
 */
import * as React from 'react';
import type { ThreadRow } from './sale';
import type { EmailStatus, MailboxAccount } from './email-api';

export type EmailProvider = NonNullable<NonNullable<ThreadRow['email']>['source']>['provider'];
export type ConnectedEmailProvider = Exclude<EmailProvider, 'forwarded'>;
export type EmailSource = NonNullable<NonNullable<ThreadRow['email']>['source']>;

export const emailProviderName = (provider: EmailProvider): string =>
  provider === 'gmail' ? 'Gmail' : provider === 'm365' ? 'Outlook' : 'Forwarded email';

const MAILBOX_HOME: Partial<Record<EmailProvider, string>> = {
  gmail: 'https://mail.google.com/mail/u/0/#inbox',
  m365: 'https://outlook.office.com/mail/',
};

const TRUSTED_NATIVE_HOSTS: Record<ConnectedEmailProvider, readonly string[]> = {
  gmail: ['mail.google.com'],
  m365: ['outlook.office.com', 'outlook.office365.com', 'outlook.live.com'],
};

/** A link may only be an HTTPS URL on the account's own web-mail host. */
export function safeNativeMailboxUrl(provider: EmailProvider, value?: string): string | undefined {
  if (!value || provider === 'forwarded') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && TRUSTED_NATIVE_HOSTS[provider].includes(url.hostname.toLowerCase())
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export type NativeMailboxDestination = {
  href: string;
  /** `exact` means the provider supplied a validated link to this message. */
  exact: boolean;
  label: string;
  help: string;
};

/**
 * A valid provider deep link is preferred. If it is absent, opening the official mailbox home is
 * still useful and is described honestly: it does not promise that the message was located.
 */
export function nativeMailboxDestination(provider: EmailProvider, candidate?: string): NativeMailboxDestination | undefined {
  const label = emailProviderName(provider);
  const exact = safeNativeMailboxUrl(provider, candidate);
  if (exact) return {
    href: exact,
    exact: true,
    label: `Open in ${label}`,
    help: `Opens this message in ${label}.`,
  };
  const home = MAILBOX_HOME[provider];
  if (!home) return undefined;
  return {
    href: home,
    exact: false,
    label: `Open ${label}`,
    help: `Opens ${label}.`,
  };
}

export type EmailReplyAvailability =
  | { kind: 'ready'; provider: ConnectedEmailProvider; sourceRef: string }
  | { kind: 'connection_required'; provider: ConnectedEmailProvider }
  | { kind: 'read_only'; provider: EmailProvider; reason: string };

/** The request crosses directly to the authorized Rocoto backend and is never queued in the UI. */
export type EmailReplyRequest = {
  sourceRef: string;
  provider: ConnectedEmailProvider;
  plainText: string;
  idempotencyKey: string;
};

/** A success is only the provider/backend receipt, never a locally appended chat turn. */
export type EmailReplyResult =
  | { kind: 'accepted'; receiptRef: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'unavailable'; reason: string };

/**
 * This is an account capability reported by the authenticated server adapter. It is deliberately
 * not derived from Settings, a fixture, or the presence of a source row.
 */
export type EmailConnectionStatus =
  | { kind: 'unverified'; reason: string }
  | { kind: 'connected'; providers: readonly ConnectedEmailProvider[]; canSend?: boolean };

/* ── THE AGGREGATOR BEHIND BOTH MAILBOXES (FEED-IA §202.3 · THE-OUTPUTS-SPEC OUT-05.4) ────────
 * Peter, 2026-09-05: «we become their chat and email client. email for those who connected via
 * unipile.»
 *
 * Unipile holds the OAuth grant and answers ONE REST API for Gmail and Microsoft 365 alike — the
 * ruling FEED-IA §101 made and THE-SOURCE-PRIVACY-SPEC SRC-PRIV-06 keeps. THE HOUSE NEVER READS
 * THE WORD: it picks Gmail or Microsoft 365 in Administration → Connections and Rocoto reaches the
 * mailbox through this. The name belongs to the code and to the runtime; a sentence a person reads
 * names the mailbox they chose.
 *
 * WHAT CROSSES INTO THE BROWSER, EXHAUSTIVELY. One boolean per mailbox meaning the door has been
 * armed (`config.mailbox`, `config.ts:121`) and one opaque authorized `source_ref` per message.
 * The grant, the account id, the receipts and every byte of a body stay on the runtime — the rule
 * this file opens with, kept.
 */
export const MAILBOX_AGGREGATOR = 'unipile';

/** READING A THREAD AND SENDING FROM IT ARE TWO AUTHORITIES. Rocoto draws every mail it was
 *  authorized to receive, in every posture; what changes with the mailbox is the SEND. */
export type MailboxPosture = 'connected' | 'arming' | 'forwarded' | 'offline';

export type MailboxStanding = {
  posture: MailboxPosture;
  /** the line under the composer. Every one of them states what IS. */
  says: string;
  /** where the line sends a person who wants the rest of it */
  door?: 'connections' | 'mailbox';
};

/**
 * The four postures of OUT-05.4, folded once so the composer, the mail card and a drive read the
 * same answer. `armed` is the house's own flag in Connections; `connection` is the runtime's word,
 * and the runtime's word wins wherever the two disagree.
 */
export function mailboxStanding(a: {
  connection: EmailConnectionStatus;
  provider: EmailProvider;
  /** this mailbox has been armed in Administration → Connections */
  armed?: boolean;
}): MailboxStanding {
  if (a.provider === 'forwarded') {
    return { posture: 'forwarded', says: 'Reply from the mailbox this arrived in.', door: 'mailbox' };
  }
  if (a.connection.kind === 'connected' && a.connection.providers.includes(a.provider)) {
    if (a.connection.canSend === false) return { posture: 'connected', says: 'Mailbox connected. Open it to reply.', door: 'mailbox' };
    return { posture: 'connected', says: `Sends through ${emailProviderName(a.provider)}.` };
  }
  if (a.armed) {
    return { posture: 'arming', says: `Sending starts when ${emailProviderName(a.provider)} finishes connecting.` };
  }
  return { posture: 'offline', says: 'Connect a mailbox to send from here.', door: 'connections' };
}

/** The one place Connections is reached from a sentence about it (`better-writing` · *Link
 *  straight to a referenced setting*). */
export const CONNECTIONS_EMAIL_HASH = '#/admin/connections/email';

/* ══ ONE ANSWER TO «CAN THIS WORKSPACE READ AND SEND MAIL» (FEED-IA §247.2) ══════════════════
 *
 * «same for emailabout the connection state. always we havbe to be super consistent and not fget
 *  people igo confusing menus when they shouldnt see them»                  — Peter, 11 Sept 2026
 *
 * The phone answered that question in five places until §246 folded it into `phoneCapabilityOf`.
 * Email answered it in six: Connections read `emailStatus.kind === 'connected'`, onboarding
 * repeated the same predicate, the setup progress card repeated it a third time, the connected
 * inbox decided from a list of accounts it fetched itself, the customer sheet decided from a
 * release flag and a customer's channel, and the composer folded four send postures. Each read was
 * taken ONCE per consumer, so a mailbox authorized in another tab, a history import that finished,
 * or an account an operator revoked stayed invisible until reload.
 *
 * `emailCapabilityOf` is the single derivation and it is PURE: a provider snapshot in, a posture
 * out. `useEmailCapability` below polls that snapshot on the boundaries a person can feel. The
 * live provider is the only witness — `company.email`, the app's `config.mailbox` switches and a
 * sample walk's local flags have no vote here.
 */

/* THE EVIDENCE IS THE RUNTIME'S OWN ANSWER, NOT A COPY OF IT. `GET /email/status` is typed once,
   in `email-api.ts`, and this module names it rather than restating its fields — a second
   declaration is where a server that adds a column and a browser that keeps deciding from the old
   one start disagreeing. The import is TYPE ONLY and therefore erased: `email-api.ts` imports this
   module for the runtime it installs, so a value import would be a cycle. */
export type MailboxAccountEvidence = MailboxAccount;
export type MailboxEvidence = EmailStatus;

/** The whole register an email entrance may find itself in. Every one that is not `ready` presents
 *  the same image and the same `Connect email` action — one state, one picture. */
export type EmailPosture = 'checking' | 'unavailable' | 'setup' | 'partial' | 'ready';

/** What is still pending, in the order a person meets it. */
export type EmailNeed = 'connection' | 'mailbox' | 'authorization' | 'history';

/** The shape the shared snapshot publishes; declared here so the selector stays free of React. */
export type EmailProviderState = {
  status: 'checking' | 'ready' | 'unavailable';
  evidence: MailboxEvidence | null;
  error: string;
  /** When the snapshot was last written, in epoch milliseconds. `0` means it has yet to answer. */
  checkedAt: number;
  /** When the evidence stopped being confirmed: the first failed read since the last good one. A
   *  connected mailbox keeps its evidence and its posture through a transient read; the surfaces
   *  say `Checking…` and nothing else moves, because a failed read is a fact about the network. */
  staleSince: number;
};

export type EmailCapability = {
  posture: EmailPosture;
  /** the mailboxes this workspace actually holds, exactly as the provider reported them */
  accounts: MailboxAccountEvidence[];
  /** the one mailbox every entrance speaks about: the first fully connected one, else the first */
  account: MailboxAccountEvidence | null;
  /** the connected mailbox's own address */
  address: string;
  /** the forwarding address this workspace was given, where one stands */
  forwarding: string;
  providers: ConnectedEmailProvider[];
  /** Reading a thread and sending from it are two authorities; this is the send one. */
  canSend: boolean;
  /** the history import has run at least once */
  historyReady: boolean;
  /** the provider application behind the mailboxes is commissioned */
  configured: boolean;
  needs: EmailNeed[];
  error: string;
  checkedAt: number;
  /** The evidence stands, and the last read failed to confirm it. */
  stale: boolean;
  staleSince: number;
};

const MAILBOX_KIND: Partial<Record<MailboxAccountEvidence['provider'], ConnectedEmailProvider>> = {
  google: 'gmail',
  outlook: 'm365',
};

/** A mailbox is connected when the provider says the account is running and it is a mailbox rather
 *  than a forwarding address. The accounts list, the status word and the capability read the same
 *  sentence. */
export function mailboxConnected(account: MailboxAccountEvidence | null | undefined): boolean {
  return Boolean(account && account.mode === 'connected' && account.status === 'connected');
}

/** The history import has run for this mailbox. `history_complete` is the server's word for «there
 *  was no next page»; a mailbox with more than one page of customer mail still counts as imported
 *  once it has a `synced_at`, so a large mailbox never sits at `Finish setup` for ever. */
export function mailboxHistoryReady(account: MailboxAccountEvidence | null | undefined): boolean {
  return Boolean(account && (account.history_complete || account.synced_at));
}

/** The one derivation every email entrance reads. `connection` is the runtime's own send
 *  authority; it decides `canSend` and nothing else, because reading a thread and sending from it
 *  are two authorities and only the second one moves with it. */
export function emailCapabilityOf(state: EmailProviderState, connection?: EmailConnectionStatus): EmailCapability {
  const sends = connection?.kind === 'connected' && connection.canSend !== false;
  const base = {
    accounts: [] as MailboxAccountEvidence[],
    account: null,
    address: '',
    forwarding: '',
    providers: [] as ConnectedEmailProvider[],
    canSend: false,
    historyReady: false,
    configured: false,
    error: state.error,
    checkedAt: state.checkedAt,
    stale: state.staleSince > 0,
    staleSince: state.staleSince,
  };
  if (state.status === 'checking') return { ...base, posture: 'checking', needs: ['connection'] };
  if (state.status === 'unavailable' || !state.evidence) return { ...base, posture: 'unavailable', needs: ['connection'] };
  const accounts = Array.isArray(state.evidence.accounts) ? state.evidence.accounts : [];
  const configured = Boolean(state.evidence.configured);
  const mailboxes = accounts.filter((row) => row.mode === 'connected');
  const account = mailboxes.find(mailboxConnected) ?? mailboxes[0] ?? accounts[0] ?? null;
  const forwarding = accounts.find((row) => row.mode === 'forwarded' && row.forwarding_address)?.forwarding_address ?? '';
  const providers = mailboxes.filter(mailboxConnected)
    .map((row) => MAILBOX_KIND[row.provider])
    .filter((kind): kind is ConnectedEmailProvider => Boolean(kind));
  const stated = { ...base, accounts, configured, forwarding, providers };
  if (!accounts.length) return { ...stated, posture: 'setup', needs: ['mailbox'] };
  const needs: EmailNeed[] = [];
  if (!mailboxes.length) needs.push('mailbox');
  else if (!mailboxes.some(mailboxConnected)) needs.push('authorization');
  else if (!mailboxes.filter(mailboxConnected).some(mailboxHistoryReady)) needs.push('history');
  const connected = mailboxes.some(mailboxConnected);
  return {
    ...stated,
    posture: needs.length ? 'partial' : 'ready',
    account,
    address: connected ? (mailboxes.find(mailboxConnected)?.label ?? '') : '',
    canSend: connected && sends && !needs.length,
    historyReady: mailboxes.filter(mailboxConnected).some(mailboxHistoryReady),
    needs,
  };
}

/** The Connections card's own word for each posture, and the word every other entrance's action
 *  carries. `Connect email` ships exactly as written wherever a mailbox is still to be added. */
export function emailStatusWord(posture: EmailPosture): string {
  if (posture === 'ready') return 'Connected';
  if (posture === 'partial') return 'Finish setup';
  return 'Connect email';
}

/** What the Connections card says under its name: the provider's own evidence, never a local
 *  draft. A workspace with nothing connected names the three mailboxes it can take. */
export function emailCardWords(capability: EmailCapability): string {
  return capability.address || capability.forwarding || 'Gmail, Microsoft or forwarding';
}

/* ── THE CONNECTION'S STATE IS POLLED, NOT READ ONCE PER CONSUMER (FEED-IA §247.2) ────────────
 * The same bounded refresh the phone runs: every boundary a person can feel — returning to the
 * tab, focusing the window, a minute passing with a subscriber mounted — with a ten-second floor
 * so a flurry of focus events is one read, a `revision` generation guard so a response from a
 * previous workspace can never overwrite the current one, and evidence that SURVIVES a read that
 * could not confirm it. Only the provider's own answer about this workspace (401, 403, 404)
 * clears the mailboxes.
 *
 * `readEmailStatus` is reached through a dynamic import on purpose: `email-api.ts` imports this
 * module for the runtime it installs, so a static import would be a cycle. The import is taken
 * once, on the first read, and never at module evaluation. */
const EMAIL_REFRESH_FLOOR_MS = 10000, EMAIL_REFRESH_PERIOD_MS = 60000;
/** The statuses that mean «this workspace holds no mailbox», in the provider's own words. */
const EMAIL_DEFINITIVE = [401, 403, 404];
const EMAIL_INITIAL: EmailProviderState = { status: 'checking', evidence: null, error: '', checkedAt: 0, staleSince: 0 };
let mailbox: EmailProviderState = EMAIL_INITIAL;
const mailboxListeners = new Set<() => void>();
let mailboxPending: Promise<void> | null = null, mailboxRevision = 0, mailboxPeriod = 0;

function publishMailbox(next: EmailProviderState): void {
  mailbox = next;
  for (const listener of mailboxListeners) listener();
}

export function emailProviderNow(): EmailProviderState { return mailbox; }

/* ── A READ THAT BEGAN BEFORE A WRITE IS OLDER THAN THE TRUTH (phone-runtime.ts:42-52) ────────
 * `POST /email/accounts/{ref}/sync`, the customer bindings, an authorization and a disconnect all
 * change what `GET /email/status` answers. A read already in flight when one landed carries the
 * state BEFORE it, so publishing that response walks the snapshot backwards — and a snapshot that
 * walks backwards is read as a REVOCATION: the mailbox a person had just finished importing read
 * `Finish setup` again on Connections, the connected inbox swapped itself for the illustration and
 * the customer sheet's door returned to the picture, for up to the length of one period.
 * `mailboxWrites` is the write generation, in the same shape as `mailboxRevision`: every write
 * stamps it, a read records it when it starts, and `refreshEmailStatus` discards a response whose
 * stamp has moved. `emailWrote` is what a caller wraps its own mailbox write in. */
let mailboxWrites = 0;
export async function emailWrote<T>(request: Promise<T>): Promise<T> {
  try { return await request; } finally { mailboxWrites += 1; }
}

/** The provider answered about this workspace. Every setup write ends here, so a connect, a
 *  disconnect and a history import all reach every entrance without a reload. Evidence a caller
 *  holds directly is newer than any read already in flight, so it stamps the write generation too
 *  and those reads are discarded when they land. */
export function acceptEmailStatus(evidence: MailboxEvidence): void {
  mailboxWrites += 1;
  publishMailbox({ status: 'ready', evidence, error: '', checkedAt: Date.now(), staleSince: 0 });
}

/** What a failed read leaves standing. A definitive answer, and a first read with nothing behind
 *  it, publish `unavailable`; everything else keeps the last evidence and marks it stale.
 *  THAT CLEARING IS A SETTLED POSTURE, so it carries `staleSince: 0` — the phone's own rule
 *  (phone-runtime.ts:112-116). `stale` means «this evidence stands and the last read failed to
 *  confirm it», and a branch that clears the evidence has nothing left to be unsure about. Marking
 *  it stale printed «Connect email … Checking…» on every mail customer's sheet of a workspace
 *  whose mailbox cannot be read, renewed by every failing read: a definitive answer is a fact, and
 *  a fact is never a pending check. */
export function declineEmailStatus(error: unknown): void {
  const now = Date.now(), message = emailError(error);
  const status = (error as { status?: unknown } | null)?.status;
  const definitive = typeof status === 'number' && EMAIL_DEFINITIVE.includes(status);
  if (definitive || !mailbox.evidence) {
    publishMailbox({ status: 'unavailable', evidence: null, error: message, checkedAt: now, staleSince: 0 });
    return;
  }
  publishMailbox({ status: mailbox.status, evidence: mailbox.evidence, error: message, checkedAt: now, staleSince: mailbox.staleSince || now });
}

/** One sentence for every failure, including the ones that arrive with nothing in them. */
export function emailError(error: unknown): string {
  const said = error instanceof Error ? error.message.trim() : '';
  return said || 'Reconnect your mailbox, then try again.';
}

/* ⚠ READING THE STATUS MUST NEVER ALLOCATE A WORKSPACE. `channelApi` opens one the moment it is
   asked for a path, so a poll mounted at app level would hand every visitor a private connection
   workspace they never asked for. The read therefore checks for an EXISTING one first and, finding
   none, states the honest posture: this workspace holds no mailbox, with nothing to apologise for.
   `rocoto:channel-workspace-ready` is what brings the read back the moment a flow opens one. */
async function readMailboxStatus(): Promise<MailboxEvidence | null> {
  const [api, channel] = await Promise.all([import('./email-api'), import('./cedar-channel-api')]);
  if (!channel.hasChannelWorkspace()) return null;
  return api.readEmailStatus();
}

export function refreshEmailStatus(): Promise<void> {
  if (mailboxPending) return mailboxPending;
  const owner = mailboxRevision, began = mailboxWrites;
  /* The response is published only if it is still about this workspace AND no write landed while
     it travelled. Both answers are discarded, because a failure that began before a write says as
     little about the mailbox as a success does. */
  const fresh = (): boolean => owner === mailboxRevision && began === mailboxWrites;
  const task = readMailboxStatus()
    .then(
      (evidence) => {
        if (!fresh()) return;
        if (evidence) acceptEmailStatus(evidence);
        else publishMailbox({ status: 'unavailable', evidence: null, error: '', checkedAt: Date.now(), staleSince: 0 });
      },
      (error) => { if (fresh()) declineEmailStatus(error); },
    )
    .finally(() => { if (mailboxPending === task) mailboxPending = null; });
  mailboxPending = task;
  return mailboxPending;
}

/** A bounded wake-up: the tab came back, so read the connection again unless one just landed. */
function wakeEmailStatus(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (Date.now() - mailbox.checkedAt < EMAIL_REFRESH_FLOOR_MS) return;
  void refreshEmailStatus();
}

const readEmailStatusNow = (): void => { void refreshEmailStatus(); };

function watchEmailStatus(): void {
  if (mailboxPeriod || typeof window === 'undefined') return;
  window.addEventListener('focus', wakeEmailStatus);
  document.addEventListener('visibilitychange', wakeEmailStatus);
  /* A workspace opening is not a boundary the floor may swallow: the previous read answered «no
     workspace» seconds ago, so the floor would hold the entrances at `Connect email` for ten
     seconds after the connection flow opened one. */
  window.addEventListener('rocoto:channel-workspace-ready', readEmailStatusNow);
  mailboxPeriod = window.setInterval(() => { if (!document.hidden) void refreshEmailStatus(); }, EMAIL_REFRESH_PERIOD_MS);
}

function unwatchEmailStatus(): void {
  if (!mailboxPeriod || typeof window === 'undefined') return;
  window.removeEventListener('focus', wakeEmailStatus);
  document.removeEventListener('visibilitychange', wakeEmailStatus);
  window.removeEventListener('rocoto:channel-workspace-ready', readEmailStatusNow);
  window.clearInterval(mailboxPeriod);
  mailboxPeriod = 0;
}

const subscribeMailbox = (listener: () => void): (() => void) => {
  mailboxListeners.add(listener);
  if (mailboxListeners.size === 1) watchEmailStatus();
  return () => { mailboxListeners.delete(listener); if (!mailboxListeners.size) unwatchEmailStatus(); };
};

/** The shared snapshot, with the refresh every setup write calls when it has finished writing. */
export function useEmailProvider(): EmailProviderState & { refresh: () => Promise<void> } {
  const state = React.useSyncExternalStore(subscribeMailbox, () => mailbox, () => mailbox);
  React.useEffect(() => { if (!mailbox.checkedAt && !mailboxPending) void refreshEmailStatus(); }, [state.checkedAt]);
  return { ...state, refresh: refreshEmailStatus };
}

/** The capability every email entrance reads: one posture, one selected mailbox, one pending list. */
export function useEmailCapability(): EmailCapability & { refresh: () => Promise<void> } {
  const state = useEmailProvider();
  const connection = useEmailConnectionStatus();
  const capability = React.useMemo(
    () => emailCapabilityOf(state, connection),
    [state.status, state.evidence, state.error, state.checkedAt, state.staleSince, connection],
  );
  return { ...capability, refresh: state.refresh };
}

/* A WORKSPACE THAT CHANGED HANDS HOLDS NO MAILBOX. Three events reach this store: the channel
   workspace being invalidated (`cedar-channel-api.ts`), Reset Cedar's own announcement — the Reset
   worker's `rocoto:cedar-workspace-reset` `{scope, disconnect}`, which fires AFTER every provider
   disconnect has returned — and a `storage` event from another tab. Each returns the snapshot to
   `checking` and reads again while anything is mounted, so Connections says `Connect email` the
   moment the mailboxes are gone rather than at the next minute boundary. */
function resetEmailProvider(): void {
  mailboxRevision += 1;
  mailboxPending = null;
  publishMailbox(EMAIL_INITIAL);
  if (mailboxListeners.size) void refreshEmailStatus();
}

if (typeof window !== 'undefined') {
  window.addEventListener('rocoto:channel-workspace-reset', resetEmailProvider);
  window.addEventListener('rocoto:cedar-workspace-reset', resetEmailProvider);
  window.addEventListener('rocoto:email-disconnect', (event) => {
    if ((event as CustomEvent<{ phase?: string }>).detail?.phase === 'complete') resetEmailProvider();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key.startsWith('rocoto-cedar-channel-access-v1:')) resetEmailProvider();
  });
}

export type EmailSourceChange = Readonly<{
  /** Opaque source identity only. No body, attachment, recipient, or provider payload crosses it. */
  sourceRef: string;
  revision: number;
}>;

export type EmailProviderRuntime = {
  /** Must resolve a tenant- and actor-authorized opaque source reference on the server. */
  replyAvailability(source: EmailSource | undefined): EmailReplyAvailability;
  /** Optional ephemeral provider link, checked again by `safeNativeMailboxUrl` before use. */
  nativeMailboxUrl?(source: EmailSource | undefined): string | undefined;
  /** Must never write the request text to browser persistence or a client retry queue. */
  sendReply(request: EmailReplyRequest): Promise<EmailReplyResult>;
  /** Server-authoritative account capability; absent means that no connection has been verified. */
  connectionStatus?(): EmailConnectionStatus;
  /**
   * Optional authenticated change stream. It may carry only a tenant-authorized opaque source ref;
   * consumers refetch authorized data and never append a speculative local mail turn.
   */
  subscribeSourceChanges?(listener: (sourceRef: string) => void): () => void;
};

const unavailableRuntime: EmailProviderRuntime = {
  replyAvailability(source) {
    const provider = source?.provider ?? 'forwarded';
    if (provider === 'forwarded') return { kind: 'read_only', provider, reason: 'Forwarded email · Reply from the mailbox this arrived in.' };
    return { kind: 'connection_required', provider };
  },
  async sendReply() {
    return { kind: 'unavailable', reason: 'Connect a mailbox to send from here.' };
  },
  connectionStatus() {
    return { kind: 'unverified', reason: 'Connect a mailbox to send from here.' };
  },
};

let runtime: EmailProviderRuntime = unavailableRuntime;
let revision = 0;
const listeners = new Set<() => void>();
const sourceListeners = new Set<(change: EmailSourceChange) => void>();
let sourceRevision = 0;
let stopRuntimeSourceChanges: (() => void) | undefined;
const notify = (): void => {
  revision += 1;
  for (const listener of listeners) listener();
};

/** The adapter calls this only after a server-authorized source update or provider receipt. */
export function publishEmailSourceChange(sourceRef: string): void {
  if (!sourceRef) return;
  const change: EmailSourceChange = { sourceRef, revision: ++sourceRevision };
  for (const listener of sourceListeners) listener(change);
}

export function subscribeEmailSourceChanges(listener: (change: EmailSourceChange) => void): () => void {
  sourceListeners.add(listener);
  return () => sourceListeners.delete(listener);
}

/**
 * The production shell calls this once after it has installed its authenticated backend adapter.
 * It is intentionally an in-memory registration; it is neither a provider connection store nor a
 * way to authorize a send from fixture data.
 */
export function installEmailProviderRuntime(next: EmailProviderRuntime): () => void {
  const previous = runtime;
  stopRuntimeSourceChanges?.();
  runtime = next;
  stopRuntimeSourceChanges = next.subscribeSourceChanges?.(publishEmailSourceChange);
  notify();
  return () => {
    if (runtime === next) {
      stopRuntimeSourceChanges?.();
      stopRuntimeSourceChanges = undefined;
      runtime = previous;
      stopRuntimeSourceChanges = previous.subscribeSourceChanges?.(publishEmailSourceChange);
      notify();
    }
  };
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = (): number => revision;

export function useEmailReplyAvailability(source: EmailSource | undefined): EmailReplyAvailability {
  const seen = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  return React.useMemo(() => runtime.replyAvailability(source), [source, seen]);
}

export function emailConnectionStatus(): EmailConnectionStatus {
  return runtime.connectionStatus?.() ?? { kind: 'unverified', reason: 'Connect a mailbox to send from here.' };
}

/** A view can display only server-reported capability; it must not infer it from configuration. */
export function useEmailConnectionStatus(): EmailConnectionStatus {
  const seen = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  return React.useMemo(() => emailConnectionStatus(), [seen]);
}

/**
 * Lets a feed/workspace refetch one authorized source after a provider change. The notification
 * intentionally contains no message body and does not mutate the local conversation.
 */
export function useEmailSourceChange(sourceRef: string | undefined, onChange?: (change: EmailSourceChange) => void): void {
  React.useEffect(() => {
    if (!sourceRef || !onChange) return undefined;
    return subscribeEmailSourceChanges((change) => {
      if (change.sourceRef === sourceRef) onChange(change);
    });
  }, [sourceRef, onChange]);
}

export function nativeMailboxDestinationFor(source: EmailSource | undefined): NativeMailboxDestination | undefined {
  const provider = source?.provider ?? 'forwarded';
  return nativeMailboxDestination(provider, runtime.nativeMailboxUrl?.(source) ?? source?.nativeUrl);
}

export const emailReplyIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `reply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const sendConnectedEmailReply = (request: EmailReplyRequest): Promise<EmailReplyResult> =>
  runtime.sendReply(request);
