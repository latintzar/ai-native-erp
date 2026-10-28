import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND } from 'baseui/button';
import { Modal, SIZE as MODAL_SIZE } from 'baseui/modal';
import { ConnectionSetupFrame, type SetupPresentation } from './setup-frame';
import { WhatsAppSetup } from './connections/app';
import { useProofPolling, useProofSession } from './connections/hooks';
import type { Connection, ProofState } from './connections/types';
import { WHATSAPP_OTHER_WORKSPACE, whatsappActs, whatsappCapabilityOf, whatsappWordFor, type WhatsAppCapability } from './whatsapp-capability';
import { useConfig } from './config';
import { Check, Plus } from 'lucide-react';
import { WHATSAPP } from '../../rocoto-theme';
import whatsappLogo from './connections/assets/whatsapp-business.webp';
const MetaOnboardingPreview = React.lazy(() => import('./onboarding-meta').then(module => ({ default: module.MetaOnboardingPreview })));

/** WHERE A STATE WITH NOTHING TO PRESS SENDS A PERSON. The plain Connections seat, rather than
 *  `CONNECTIONS_WHATSAPP_HASH` — that tail opens Meta's walk (`areas/admin/connections.tsx`), and
 *  the walk is the thing a workspace binding leaves nothing to do in. */
const CONNECTIONS_SEAT = '#/admin/connections';
const CONNECTIONS_SEAT_WORD = 'Open Connections';

type Request = { presentation: SetupPresentation; onComplete?: (connection: Connection) => void; onClose?: () => void; onTestComplete?: (phone: string) => void };
/* ── `visited` IS A UI FACT, AND IT HAS NO VOTE ANYWHERE (FEED-IA §246 · §247.2) ───────────────
 * It shipped as `activated`, written the moment `openWhatsAppConnection` ran — from Connections,
 * from Money setup, from onboarding, and from merely LOOKING at the connected-accounts panel — so
 * opening the dialog marked the workspace activated before Meta had been asked anything, and
 * nothing anywhere cleared it again. A local draft held a standing vote.
 *
 * The flag stays, because «this browser has been through the WhatsApp door» is a real and useful
 * fact; what changed is its name, its meaning and its reach. `whatsappCapabilityOf` carries it as
 * `visited` and derives the posture from the polled `/state` alone, so no surface can read it as
 * connection evidence, and the workspace reset returns it to false along with the snapshot. */
type Snapshot = { visited: boolean; request: Request | null; state: ProofState | null; error: string; busy: boolean; checkedAt: number };
const selectionKey = 'rocoto-cedar-whatsapp-selected-v1';
function readVisited(): boolean {
  try { return localStorage.getItem(selectionKey) === 'true'; } catch { return false; }
}
const initial = (): Snapshot => ({ visited: readVisited(), request: null, state: null, error: '', busy: false, checkedAt: 0 });
let snapshot: Snapshot = initial();
const listeners = new Set<() => void>();
function update(patch: Partial<Snapshot>) { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const read = () => snapshot;
export const useWhatsAppConnection = () => React.useSyncExternalStore(subscribe, read, read);
/** THE ONE DERIVATION EVERY WHATSAPP ENTRANCE READS (`whatsapp-capability.ts`), subscribed —
 *  `usePhoneCapability`'s counterpart, so the Connections card, the connected inbox,
 *  setup-progress, onboarding and the composer all answer with the same posture. */
export function useWhatsAppCapability(sector: string): WhatsAppCapability {
  const held = useWhatsAppConnection();
  return React.useMemo(
    () => whatsappCapabilityOf({ state: held.state, error: held.error, checkedAt: held.checkedAt, visited: held.visited }, sector),
    [held.state, held.error, held.checkedAt, held.visited, sector],
  );
}
/** Opening the door is a visit. It is recorded as one, and it proves the door was opened. */
function noteWhatsAppVisit(): void {
  try { localStorage.setItem(selectionKey, 'true'); } catch { /* The current session still works. */ }
  if (!snapshot.visited) update({ visited: true });
}
export function openWhatsAppConnection(request: Request): void {
  noteWhatsAppVisit(); update({ request });
}
/* ── THE SHARED RESET CONTRACT · this store returns to its initial posture ──────────────────────
 * The reset worker clears the inventoried browser keys for the scope and (when it is the
 * disconnecting act) waits for the providers' own calls, THEN dispatches the event. What is left
 * here is this module's memory: the visit flag and the last `/state` snapshot. Both go, and the
 * mounted session's polling writes the provider's fresh answer back in. `phone-runtime.ts:166` is
 * the same handler for the same class of fact. */
function resetWhatsAppConnection() {
  snapshot = { ...initial(), request: snapshot.request };
  listeners.forEach(listener => listener());
  window.dispatchEvent(new CustomEvent('cedar-whatsapp-refresh'));
}
if (typeof window !== 'undefined') {
  window.addEventListener('rocoto:cedar-workspace-reset', resetWhatsAppConnection);
  window.addEventListener('rocoto:channel-workspace-reset', resetWhatsAppConnection);
}
function close(completed = false) { const request = snapshot.request; update({ request: null }); if (!completed) request?.onClose?.(); }

/* ── ONE PICTURE FOR EVERY POSTURE THAT IS NOT A CONNECTION (§246 · §247.2) ────────────────────
 * The phone's dial dialog draws exactly this for `checking`, `unavailable`, `setup` and `partial`
 * (`phone-controller.tsx`), and so does the mailbox (`EmailSetupState`). WhatsApp's entrances drew
 * four different things, so a person who pressed twice saw two states of the same account. This is
 * the third member of that set: same shape, same one act, same posture attribute for a drive. */
export function WhatsAppSetupState({ sector, onOpenSetup, size = 96, says = 'Connect WhatsApp Business to read your chats and answer customer orders.' }: {
  sector: string; onOpenSetup?: () => void; size?: number; says?: string;
}) {
  /* ⚠ THE MARK IS META'S, AND IT IS DRAWN AT A MARK'S SIZE. The phone and the mailbox open on a
     PAINTED feature object (`FeatureArtwork`, 184 px); `library/illustrations/` holds no WhatsApp
     object yet, so this state stands on the provider's own brand mark instead — and a brand mark
     blown up to 184 px is a slab of green that outweighs the sentence and the act beside it.
     Reviewed at 1600, 390 and 320. When the WhatsApp object lands, this becomes
     `<FeatureArtwork kind="whatsapp" size={184} />` and nothing else here moves. */
  const [, theme] = useStyletron();
  const capability = useWhatsAppCapability(sector);
  /* ── `partial` HAS TWO CAUSES, AND ONE OF THEM HAS NO STEP BEHIND IT (§247.2 · OUT-05) ───────
     An interrupted Meta walk is this house's to finish, so it keeps «Finish setup» and the door
     that resumes it. A connection an operator bound to ANOTHER workspace reads the same posture
     and walking Meta's signup again returns the same binding — `Connection.workspace` comes from
     `config.workspace_for(wabaId, phoneId)` and `Store.bind_workspace` keeps an existing binding
     where it is. So this state says where the account IS set up, in the Connections card's own
     words, and its one act opens that card, which is where the operator repair is named. */
  const acts = whatsappActs(capability);
  const open = () => {
    if (!acts) { window.location.hash = CONNECTIONS_SEAT; return; }
    if (onOpenSetup) { onOpenSetup(); return; }
    openWhatsAppConnection({ presentation: 'dialog' });
  };
  return <div data-testid="whatsapp-setup-state" data-whatsapp-posture={capability.posture} data-acts={acts ? 'yes' : 'no'}
    style={{ display: 'grid', justifyItems: 'center', gap: theme.sizing.scale500, textAlign: 'center' }}>
    <img src={whatsappLogo} alt="" width={size} height={size} style={{ maxWidth: '100%', height: 'auto' }} />
    <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, margin: 0, maxWidth: 320 }}>{acts ? says : WHATSAPP_OTHER_WORKSPACE}</p>
    <Button onClick={open} data-testid="whatsapp-open-setup" overrides={{ BaseButton: { style: {
      minHeight: '44px', backgroundColor: WHATSAPP.green, color: WHATSAPP.onGreen,
      ':hover': { backgroundColor: `color-mix(in srgb, ${WHATSAPP.green} 88%, ${theme.colors.contentPrimary})` },
      ':active': { backgroundColor: `color-mix(in srgb, ${WHATSAPP.green} 78%, ${theme.colors.contentPrimary})` },
    } } }}>{acts ? whatsappWordFor(capability) : CONNECTIONS_SEAT_WORD}</Button>
    {capability.error && <p role="status" data-testid="whatsapp-setup-note"
      style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0, maxWidth: 320 }}>{capability.error}</p>}
  </div>;
}

/** Mounted above routing; session state and polling survive onboarding → Settings → inbox. */
function WhatsAppSession() {
  const [, theme] = useStyletron();
  const held = useWhatsAppConnection();
  const { config, derived } = useConfig();
  const [addingAccount, setAddingAccount] = React.useState(false);
  const [testData, setTestData] = React.useState(false);
  React.useEffect(() => { setAddingAccount(false); setTestData(false); }, [held.request]);
  const session = useProofSession();
  const [recovery, setRecovery] = React.useState('');
  const attempted = React.useRef(false);
  const onLocked = React.useCallback(() => {
    if (attempted.current) setRecovery('Your setup session needs a fresh connection. Continue with WhatsApp Business.');
    session.restart();
  }, [session.restart]);
  const state = useProofPolling<ProofState>('/state', session.ready, onLocked);
  const onActivityChange = React.useCallback((active: boolean) => {
    update({ busy: active });
    if (active) { attempted.current = true; setRecovery(''); state.pause(); }
    else state.resume();
  }, [state.pause, state.resume]);
  React.useEffect(() => {
    if (state.data) session.confirm();
    if (state.data?.connection) { attempted.current = false; setRecovery(''); }
    /* WHEN THE PROVIDER LAST ANSWERED. `checkedAt` is what separates «the read has yet to land»
       from «the read landed and there is no account», which is the difference between the
       `checking` posture and the `setup` one. */
    update({ state: state.data, error: session.error || state.error, checkedAt: state.data ? Date.now() : snapshot.checkedAt });
  }, [state.data, state.error, session.error, session.confirm]);
  React.useEffect(() => {
    const refresh = (event: Event) => (event as CustomEvent<{renew?: boolean}>).detail?.renew ? onLocked() : state.refresh();
    window.addEventListener('cedar-whatsapp-refresh', refresh);
    return () => window.removeEventListener('cedar-whatsapp-refresh', refresh);
  }, [state.refresh, onLocked]);
  if (!held.request) return null;
  const paragraph = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 };
  const connection = session.ready ? state.data?.connection : null;
  const onboardingConnection = Boolean(held.request.onComplete && connection?.workspace === derived.cast.sector);
  const content = <ConnectionSetupFrame title="" contentTitleId="connections-title" presentation={held.request.presentation}
    onClose={() => close()} onBack={held.request.presentation === 'page' ? addingAccount ? () => setAddingAccount(false) : () => close() : undefined} testId="whatsapp-connection" disclosure={<p style={paragraph}>
      Meta controls your account and history permissions. Your connected chats stay available in Cedar.

    </p>}>
    <div style={{ display: 'grid', gap: theme.sizing.scale600 }}>
      {recovery && <p role="alert" style={paragraph}>{recovery}</p>}
      {connection && !addingAccount && onboardingConnection && <>
        <h1 id="connections-title" style={{ ...theme.typography.HeadingLarge, margin: 0 }}>WhatsApp Business</h1>
        <div data-testid="whatsapp-existing-account" style={{ display:'flex', alignItems:'center', gap:theme.sizing.scale500, padding:theme.sizing.scale600,
          border:`1px solid ${theme.colors.borderOpaque}`, borderRadius:theme.borders.radius400 }}>
          <img src={whatsappLogo} alt="" width={48} height={48} />
          <div style={{ display:'grid', gap:theme.sizing.scale200, minWidth:0, flex:1 }}><strong style={theme.typography.LabelLarge}>{connection.name}</strong>
            <span style={paragraph}>{connection.number}</span></div><Check size={20} aria-label="Connected" />
        </div>
        <Button data-testid="whatsapp-connection-continue" disabled={held.busy}
          onClick={() => { const complete = snapshot.request?.onComplete; close(true); complete?.(connection); }}>Continue</Button>
      </>}
      {session.ready && state.data && !(connection && !addingAccount && onboardingConnection) ? <>
        {state.error && <p role="alert" style={paragraph}>{state.error}</p>}
        <WhatsAppSetup state={state.data} addingAccount={addingAccount} onConnected={next => { state.adopt(next); setAddingAccount(false); }} onLocked={onLocked}
          onRefresh={state.refresh} onActivityChange={onActivityChange} />
      </> : !(connection && !addingAccount && onboardingConnection) && <>
        <h1 id="connections-title" style={{ ...theme.typography.HeadingLarge, margin: 0 }}>Connect WhatsApp</h1>
        <p role="status" style={paragraph}>{session.error || state.error || 'Opening your WhatsApp connection…'}</p>
        {(session.error || state.error) && <Button kind={KIND.secondary} onClick={session.error ? session.retry : state.refresh}>Try again</Button>}
      </>}
      {connection && !addingAccount && <Button kind={KIND.tertiary} onClick={() => setAddingAccount(true)} startEnhancer={() => <Plus size={18} aria-hidden />}
        data-testid="whatsapp-add-another">Add another</Button>}
      <Button kind={KIND.tertiary} data-testid="whatsapp-use-test-data" onClick={() => setTestData(true)}>Use test data</Button>
      {testData && <React.Suspense fallback={<p role="status" style={paragraph}>Opening setup…</p>}><MetaOnboardingPreview
        restart scope={derived.cast.sector} phone={connection?.number || derived.cast.house.whatsapp} businessName={connection?.name || config.brand.name}
        onClose={() => setTestData(false)} onComplete={number => { const complete = snapshot.request?.onTestComplete; setTestData(false); if (complete) { close(true); complete(number); } }} /></React.Suspense>}
    </div>
  </ConnectionSetupFrame>;
  if (held.request.presentation === 'dialog') return content;
  return <Modal isOpen onClose={() => close()} size={MODAL_SIZE.full} closeable={false} animate={false} overrides={{
    Dialog: { style: { margin: 0, width: '100vw', maxWidth: '100vw', height: '100dvh', maxHeight: '100dvh', overflowY: 'auto', borderRadius: 0 } },
    DialogContainer: { style: { height: '100dvh', alignItems: 'stretch' } },
  }}>{content}</Modal>;
}
export default function WhatsAppConnectionHost() {
  return <WhatsAppSession />;
}
