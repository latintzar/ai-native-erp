/* THE COPILOT — the agent surface (FEED-IA §196.2, Peter, 2026-09-04):
 *
 *   «the copilot has to be in the fucking ux ui i told you, properly. idk how many times to tell
 *    u. the supply issue and the catalogue shit is just suggestions but it's literally an agent
 *    and should have the same shit like all top agents with other sessions etc. i told u to port
 *    from the fucking app.soyrocoto.com which has the exact UX i wanted for the actual chat and
 *    composer in full even down to the grid.»
 *
 * ═══ WHAT THIS REPLACES ══════════════════════════════════════════════════════════════════════
 * A task-card dialog (800×600) with a suggestions dock and two MODES that took the conversation
 * away whenever a flow ran. Three things are different, and they are the three the directive
 * names:
 *
 *   1 · IT IS A COLUMN, NOT A CARD. The live app's copilot is the desk's third column — full
 *       height, its own head, its thread scrolling internally, its composer always on screen
 *       (`shell/topbar.css`: `.desk.has-copilot { grid-template-columns: 216px 1fr 336px }`).
 *       The kit's frame reserves that track too (E193.16), so the work REFLOWS beside the column
 *       rather than standing behind it — and the column keeps ONE measure at every width above a
 *       phone (E195.30): 416 beside the work where the room holds both, 416 in front of it with a
 *       scrim where it does not, the screen on a handset. Every other property of the port is
 *       kept: the head's height, the ruled ground, the thread's own scrollport, the composer on
 *       the floor and the disclaimer beneath it.
 *   2 · IT HAS SESSIONS. A list of past sessions, a current one and New session — the thing
 *       «all top agents» have and the app's own copilot does not (its thread is component state
 *       and dies with the tab). `store.ts` holds them per tenant.
 *   3 · THE FLOWS ARE CONVERSATIONS. Supply issue and catalogue help open a SESSION with the
 *       first turn already said and the flow's card mounted in the agent's answer — never a mode
 *       that replaces the chat (`flows.tsx`).
 *
 * ═══ THE GRID («even down to the grid») ═════════════════════════════════════════════════════
 * §17.43b of the live app: «the copilot thinks on GRID paper; the customer chat lives on DOTS.
 * Two rooms, two textures.» The ruled ground below is that paper, drawn off theme tokens: two
 * solid guard strips first so no rule lands on an edge, then the two rules, phased half a cell so
 * the first one never sits at x=0 (the app measured a doubled line there and fixed it the same
 * way). The paper does not scroll: paper stays, ink moves.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { useHistoryLayer } from '../anchors';
import { closeSupport } from '../support';
import { Glyph, STEP } from '../glyphs';
import { useSupplyIssues } from '../supply-broadcast';
import { useRules } from '../rules';
import { useWorkflowViewport } from '../workflow-dialog';
import {
  COPILOT_RAIL, copilotPostureAt, copilotTrackOf, copilotWidthOf, stateCopilotOpen,
  usePricedDocument, useWindowWidth,
} from '../shell/viewport';
import type { Cast } from '../../../scenarios/data/cast';
import { CopilotComposer } from './composer';
import { CatalogueCard, ProposalActs, SupplyCard, SupplyReportCard, Trails, say, said, useProducts, type FlowHooks } from './flows';
import { askContext } from './context';
import { ask } from './router';
import { copilotStatusWord, noteCopilotPosture, readCopilotPosture, titleFrom, useCopilotPosture, useSessions } from './store';
import type {
  AssistantContext, AssistantKind, AssistantRuntimeAdapter, CopilotMessage, CopilotSession, OperatorReport,
} from './types';

/* ── THE COLUMN'S OWN MEASURES LIVE WITH THE LADDER (§196.2 · E193.16) ───────────────────────
 * 416 is the conversation's width: the kit's own panel measure (§40.1 — «the measure lands around
 * fifty characters, which is where a conversation reads easiest») plus the column's border. The
 * sessions rail stands BESIDE it only where there is room for both; under that it opens over the
 * thread, which is the posture the app already uses for history on a phone.
 *
 * THEY ARE DECLARED IN `shell/viewport.ts` NOW, not here. E193.02 docked this column OVER the
 * work; §196.2 says it is a TRACK the frame reserves, and a track and the thing standing in it
 * that hold two copies of one number are a track and a column that drift. One file owns the
 * arithmetic — the same file that owns every other width the layout turns on. */
const RAIL_WIDTH = COPILOT_RAIL;

const OPEN_EVENT = 'rocoto:open-assistant';
const VISIBILITY_EVENT = 'rocoto:assistant-visibility';

export type OpenAssistantDetail = { kind?: AssistantKind; context?: AssistantContext };

/** This event only requests a visible client layer. Tenant, recipients and authority stay at host/runtime. */
export function openAssistant(detail: OpenAssistantDetail = {}): void {
  if (typeof window === 'undefined') return;
  closeSupport();
  window.dispatchEvent(new CustomEvent<OpenAssistantDetail>(OPEN_EVENT, { detail }));
}

/** a row's time is READ AT A GLANCE, so it is the short form: a stamp with seconds in it takes
 *  three lines of a 216px rail and says nothing more than this does. */
const when = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** the room's ruled paper, from tokens — §17.43b ported */
function usePaper(): React.CSSProperties {
  const [, theme] = useStyletron();
  const paper = theme.colors.backgroundPrimary;
  const rule = `color-mix(in srgb, ${theme.colors.borderOpaque} 60%, transparent)`;
  const cell = theme.sizing.scale800;
  const guard = theme.sizing.scale300;
  const half = `calc(${cell} / 2)`;
  return {
    backgroundColor: paper,
    backgroundImage: [
      `linear-gradient(${paper}, ${paper})`,
      `linear-gradient(${paper}, ${paper})`,
      `linear-gradient(to right, ${rule} 1px, transparent 1px)`,
      `linear-gradient(to bottom, ${rule} 1px, transparent 1px)`,
    ].join(', '),
    backgroundSize: `100% ${guard}, 100% ${guard}, ${cell} ${cell}, ${cell} ${cell}`,
    backgroundPosition: `left top, left bottom, ${half} ${half}, ${half} ${half}`,
    backgroundRepeat: 'no-repeat, no-repeat, repeat, repeat',
  };
}

/* ── THE TURNS ───────────────────────────────────────────────────────────────────────────────
 * Not two bubbles facing each other: the ask is a small card the operator wrote, the answer is
 * prose on the paper — one voice reading down the page, which is the AI-surface shape the port
 * settled on («less like chat, more like AI»). */
/* ── THE WAIT IS REAL NOW, SO IT IS DRAWN (FEED-IA §196.2 · E198.11) ────────────────────────
 * `router.ts` refused a thinking state for as long as there was no mind behind it — «a picture of
 * work that is not happening». The mind is in the runtime now and the call takes seconds, so the
 * room says what is happening, in the agent's own voice and in its own seat in the thread. It is
 * TEXT rather than a shimmer of grey bars: three fake paragraph skeletons are a picture of an
 * answer's SHAPE, which nobody can know yet. */
function Thinking() {
  const [, theme] = useStyletron();
  return (
    /* ⚠ NO `data-role`. The thread's answers are `article[data-role=copilot]` and every drive counts
       them to know an answer arrived; a thinking line wearing that attribute would BE the answer to
       every one of those waits, and the check that follows would read «Reading the day…» as the
       agent's reply. It is a state, not a turn, so it carries the state's own testid and nothing
       that says it is one. */
    <article data-testid="copilot-thinking" style={{ display: 'grid', gap: theme.sizing.scale100, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Copilot</span>
      <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Reading the day…</p>
    </article>
  );
}

function Turn({ message, children }: { message: CopilotMessage; children?: React.ReactNode }) {
  const [, theme] = useStyletron();
  const operator = message.role === 'operator';
  return (
    <article
      data-testid={`copilot-turn-${message.id}`}
      data-role={message.role}
      style={{
        display: 'grid', gap: theme.sizing.scale100, minWidth: 0,
        justifySelf: operator ? 'end' : 'stretch',
        maxWidth: operator ? 'min(92%, 520px)' : '100%',
        ...(operator
          ? {
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius400,
            padding: theme.sizing.scale400,
            backgroundColor: theme.colors.backgroundSecondary,
          }
          : {}),
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
        {operator ? 'You' : 'Copilot'} · {new Date(message.at).toLocaleString()}{message.dictated ? ' · dictated' : ''}
      </span>
      <p style={{ margin: 0, ...theme.typography.ParagraphSmall, whiteSpace: 'pre-wrap', color: theme.colors.contentPrimary }}>{message.text}</p>
      {message.activity && <Trails trails={message.activity} />}
      {children}
      {/* WHICH MIND ANSWERED, AND WHAT IT COST. The same three facts the runtime journals, on the
          turn itself — an agent that states its own provenance is one a person can audit. */}
      {message.previewTransport && <p data-testid="copilot-preview-provenance" style={{...theme.typography.LabelXSmall,color:theme.colors.contentTertiary}}>OpenAI preview · {message.previewTransport.model}</p>}
      {message.previewFailure && <p data-testid="copilot-preview-failure" data-code={message.previewFailure.code} style={{...theme.typography.LabelXSmall,color:theme.colors.contentTertiary}}>OpenAI preview</p>}
      {message.evidence && (
        <details data-testid={`copilot-evidence-${message.id}`} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
          <summary style={{ minHeight:44, cursor:'pointer', alignContent:'center' }}>Response details</summary>
          {message.evidence.model} · {(message.evidence.ms / 1000).toFixed(1)}s · {message.evidence.tokens} tokens
        </details>
      )}
    </article>
  );
}

/* ── THE SESSIONS ────────────────────────────────────────────────────────────────────────────
 * The list is the agent's memory of what was worked on, and it is the person's to open, start
 * and shorten. It stands beside the conversation on a wide desk and over it everywhere else. */
function SessionsRail({ sessions, currentId, beside, open, onOpen, onNew, onForget, onClose }: {
  sessions: CopilotSession[]; currentId: string | null; beside: boolean; open: boolean;
  onOpen: (id: string) => void; onNew: () => void; onForget: (id: string) => void; onClose: () => void;
}) {
  const [, theme] = useStyletron();
  if (!beside && !open) return null;
  return (
    <aside
      data-testid="assistant-history"
      data-posture={beside ? 'beside' : 'over'}
      aria-label="Sessions"
      style={{
        display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0,
        boxSizing: 'border-box',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRight: beside ? `1px solid ${theme.colors.borderOpaque}` : undefined,
        ...(beside ? { width: `${RAIL_WIDTH}px`, flex: `0 0 ${RAIL_WIDTH}px` } : { position: 'absolute', inset: 0, zIndex: 2 }),
      }}
    >
      {/* BOTH HEADS ARE BUILT THE SAME WAY, so they come out the same height (the app's own note:
          «both headers should match in height»): the head's own padding around a 44px control,
          then the same hairline. Nothing here states a height. */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale200, flexShrink: 0,
        paddingLeft: theme.sizing.scale400, paddingRight: theme.sizing.scale300,
        paddingTop: theme.sizing.scale300, paddingBottom: theme.sizing.scale300,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
      }}>
        <span style={{ ...theme.typography.LabelMedium }}>Sessions</span>
        <div style={{ display: 'flex', gap: theme.sizing.scale100 }}>
          <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="assistant-new-conversation" onClick={onNew}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>New</Button>
          {!beside && <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="copilot-sessions-close" aria-label="Close sessions" onClick={onClose}
            overrides={{ BaseButton: { style: { minHeight: '44px', minWidth: '44px', paddingLeft: 0, paddingRight: 0 } } }}><Glyph id="collapse" size={STEP.small} /></Button>}
        </div>
      </header>
      <div style={{ display: 'grid', alignContent: 'start', gap: theme.sizing.scale200, minWidth: 0, overflowY: 'auto', padding: theme.sizing.scale300 }}>
      {sessions.length ? sessions.map((session) => (
        <div key={session.id} data-testid={`copilot-session-${session.id}`} data-current={session.id === currentId ? 'yes' : 'no'}
          style={{ display: 'flex', alignItems: 'stretch', gap: theme.sizing.scale100, minWidth: 0 }}>
          <Button
            kind={session.id === currentId ? KIND.secondary : KIND.tertiary}
            size={SIZE.compact}
            aria-label={`${session.title} · ${new Date(session.updatedAt).toLocaleString()}`}
            onClick={() => onOpen(session.id)}
            overrides={{ BaseButton: { style: { display: 'block', flex: '1 1 auto', width: '100%', minWidth: 0, overflow: 'hidden', textAlign: 'left', minHeight: '52px', paddingTop: theme.sizing.scale200, paddingBottom: theme.sizing.scale200 } } }}
          >
            {/* the row is a fixed measure and the title is the only thing that may be long, so the
                title alone yields — an ellipsis, never a name broken across three lines */}
            <span style={{ display: 'block', minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</span>
            <span data-testid={`assistant-history-time-${session.id}`} style={{ display: 'block', ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {when(session.updatedAt)}
            </span>
          </Button>
          <Button kind={KIND.tertiary} size={SIZE.compact} aria-label={`Forget ${session.title}`} data-testid={`copilot-forget-${session.id}`} onClick={() => onForget(session.id)}
            overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px', flexShrink: 0, paddingLeft: 0, paddingRight: 0 } } }}>
            <Glyph id="bin" size={STEP.small} />
          </Button>
        </div>
      )) : <p style={{ margin: `${theme.sizing.scale100} 0`, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Your sessions will be listed here.</p>}
      </div>
    </aside>
  );
}

/* ── THE HOST ────────────────────────────────────────────────────────────────────────────────── */
export function CopilotHost({ cast, runtime }: { cast: Cast; runtime?: AssistantRuntimeAdapter }) {
  const [css, theme] = useStyletron();
  const paper = usePaper();
  const sessions = useSessions(cast.sector);
  /* ── THE MIND IS STATED BEFORE ANYTHING IS ASKED (§246 · §247.2) ───────────────────────────
     The door was honest per turn and carried no standing posture, so a person learned which mind
     they had by asking it something first. The runtime's own answer is read when the agent opens
     and rewritten by every ask; the line stands near the composer, exactly where the mailbox's
     posture stands under the chat composer, with one act when it is out of reach. */
  const mind = useCopilotPosture();
  const supply = useSupplyIssues(cast);
  const products = useProducts(cast);

  const [open, setOpen] = React.useState(false);
  /* A BOUNDED READ, ONCE THE AGENT IS OPEN. The posture stands before the first ask and every ask
     overwrites it; a closed agent asks the runtime nothing. */
  React.useEffect(() => { if (open && !mind.checkedAt) void readCopilotPosture(); }, [open, mind.checkedAt]);
  const [sessionsOpen, setSessionsOpen] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  /* THE ASK IN FLIGHT. It is component state and not a filed turn on purpose: the store's write is
     revision-guarded and files ONE append of the person's words and the agent's answer (store.ts),
     so a half-finished exchange never reaches the session list — a reload mid-thought comes back
     to the conversation as it stood, rather than to a question nobody answered. */
  const [asking, setAsking] = React.useState<string | null>(null);
  const askLock = React.useRef(false);
  const threadRef = React.useRef<HTMLDivElement>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);
  const visualHeight = useWorkflowViewport(open);

  /* ── WHICH OF THE FOUR THIS IS (§196.2 · E193.16 · E195.30) ───────────────────────────────
   * The posture is a pure function of the WINDOW — never of the room, because the room is the
   * window minus this column and a reserve that shrank its own decision would oscillate. Four
   * rungs: the phone's screen · the 416 sheet · the 416 track · the 632 track.
   *
   * ⚠ E195.30 REPLACED THE MIDDLE RUNG. E193.16's `screen` gave everything from 601 to 1095 to a
   * takeover, so the agent was 1095px wide at 1095 and 416px wide at 1096 — one pixel of browser
   * width swapping the product for a different one, against §195. The agent keeps ONE measure
   * above the phone now (`copilotWidthOf`), and the width of the window decides only whether the
   * work REFLOWS beside it (≥ 888 = `DESK_FLOOR` 472 plus this measure) or is SCRIMMED behind it.
   * A sheet reserves nothing, so the document under it does not reflow and comes back untouched —
   * which is what makes «one tap out» honest. */
  const width = useWindowWidth();
  /* §200.3 · E199 — WHAT THE WORK IS DECIDES WHERE THE AGENT MAY STAND. A document showing money
     carries the row law (§192–§195), and the row law needs the document's own snug 640 beside a
     river that keeps its 392. Below the width where all three stand at once, the agent steps IN
     FRONT of the work instead of taking the difference out of the document. */
  const priced = usePricedDocument();
  const posture = copilotPostureAt(width, priced);
  const phone = posture === 'phone';
  /* IN FRONT OF THE WORK rather than beside it: the screen under 613 and the 613–887 sheet.
     Both carry the scrim, both reserve no track, and both are fixed to the glass. */
  const inFront = phone || posture === 'sheet';
  const railBeside = posture === 'desk-wide';
  const track = copilotTrackOf(posture);
  const measure = copilotWidthOf(posture, width);

  /* the chats panel stands down while the agent is up — it reads this event (shell/chats.tsx) —
     and the FRAME learns it has a track to reserve. A LAYOUT effect, so the grid gains the track
     on the same frame the column is painted into it (§45.3: a posture claimed after a paint is
     one painted frame in the wrong layout). */
  React.useLayoutEffect(() => {
    stateCopilotOpen(open && !inFront);
    window.dispatchEvent(new CustomEvent(VISIBILITY_EVENT, { detail: { open } }));
    return () => {
      stateCopilotOpen(false);
      window.dispatchEvent(new CustomEvent(VISIBILITY_EVENT, { detail: { open: false } }));
    };
  }, [open, inFront]);

  const sanitize = React.useCallback((raw: AssistantContext): AssistantContext => {
    const known = new Set(products.map((product) => product.id));
    const productId = raw.productId && known.has(raw.productId) ? raw.productId : undefined;
    const productIds = raw.productIds?.filter((id) => known.has(id));
    const orderId = raw.orderId && supply.sales.some((sale) => sale.id === raw.orderId) ? raw.orderId : undefined;
    return {
      source: raw.source, complaint: raw.complaint, productId,
      ...(productIds?.length ? { productIds } : {}),
      ...(raw.categoryId ? { categoryId: raw.categoryId } : {}),
      ...(orderId ? { orderId } : {}),
    };
  }, [products, supply.sales]);

  /* ── THE DOORS (§196.2 — «the supply issue and the catalogue shit» become conversations) ────
     Every surface that used to switch the assistant into a mode now OPENS A SESSION: the person's
     own context sentence is the first turn, and the agent's answer carries the flow's card. */
  const beginFrom = React.useCallback((kind: AssistantKind, raw: AssistantContext) => {
    const context = sanitize(raw);
    const product = context.productId ? products.find((item) => item.id === context.productId) : undefined;
    /* THE GENERAL DOOR RESUMES. A person who presses the agent's own mark is coming back to it,
       so the session they were in is the one that opens; New is a control, never a side effect. */
    if (kind === 'general') return;
    const opening = kind === 'supply'
      ? product ? `Report a supply issue with ${product.name}.` : 'Report a supply issue.'
      : product ? `The category for ${product.name} needs a correction.` : 'A category in the catalogue needs a correction.';
    const reply = kind === 'supply'
      ? say(
        product
          ? `Tell me what the floor has of ${product.name} and when, and I will lay out the orders it touches.`
          : 'Name the product and what happened. Stock and customer messages stay exactly as they are.',
        { card: { kind: 'supply-report' } },
      )
      : say(
        'Choose where these goods belong and record why. Prices, stock, orders and artwork stay as they are.',
        { card: { kind: 'catalogue-review' } },
      );
    /* STAGED, NOT FILED (store.ts): the door's session is held in memory with its first turn and
       its card, and the first real act commits it. A door pressed and abandoned files nothing. */
    sessions.stage({ origin: kind, context, title: titleFrom(opening, 'New session'), messages: [said(opening), reply] });
  }, [products, sanitize, sessions]);

  React.useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenAssistantDetail>).detail ?? {};
      const kind = detail.kind ?? 'general';
      setOpen(true);
      setSessionsOpen(false);
      /* A HALF-TYPED ASK SURVIVES A GLANCE AWAY AND BACK (the app's A21: closing the column used to
         cost her everything she had said). Only a door that opens a NEW session starts on an empty
         box, because those words belong to the session that just ended. */
      if (kind !== 'general') setDraft('');
      beginFrom(kind, detail.context ?? {});
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [beginFrom]);

  useHistoryLayer({
    id: 'assistant',
    active: open,
    snapshot: { session: sessions.currentId ?? null },
    onRestore: (saved) => {
      if (!saved) { setOpen(false); return; }
      if (typeof saved.session === 'string') sessions.open(saved.session);
      setOpen(true);
    },
  });

  /* THE THREAD LANDS ON ITS LAST TURN, the way a conversation does — and it lands TWICE.
     ⚠ ONE SCROLL IS NOT ENOUGH SINCE THE TURNS GREW (E198.11). A turn from the mind mounts a card,
     a row of acts and the evidence line in the same commit, and their measured height settles on
     the NEXT frame — so a single `scrollTop = scrollHeight` in the commit left the newest turn's
     last line cut in half by the composer (screenshot, 1600, drafts). The second pass, on the
     frame after, lands on the height the turn actually came out at. */
  const current = sessions.current;
  const turns = current?.messages ?? [];
  /* IS THE PERSON READING THE END? Kept as they scroll, because everything below re-lands the
     thread only when they were already there — scrolling up to read an earlier turn is theirs. */
  const atEnd = React.useRef(true);
  const land = React.useCallback(() => {
    const el = threadRef.current;
    if (el) { el.scrollTop = el.scrollHeight; atEnd.current = true; }
  }, []);
  React.useEffect(() => {
    land();
    const frame = window.requestAnimationFrame(land);
    return () => window.cancelAnimationFrame(frame);
  }, [turns.length, open, asking, land]);

  /* ── AND IT RE-LANDS WHEN THE FLOOR RISES (E198.11) ──────────────────────────────────────
     ⚠ MEASURED, not theorised: taking a drafted reply puts two lines in the composer, the dock
     grows, the thread's own box shrinks by exactly that much — and the newest turn's last line,
     the evidence, was left cut in half by the dock that had just grown over it (screenshot, 1600).
     The turns did not change, so no scroll effect above fires. The DOCK is what changed, so the
     dock is what is watched: when it resizes and the person was reading the end, the end comes
     back. A person who had scrolled up keeps where they were. */
  React.useEffect(() => {
    const dock = composerRef.current;
    if (!dock || !open || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { if (atEnd.current) land(); });
    observer.observe(dock);
    return () => observer.disconnect();
  }, [open, land]);

  /* a desk opens onto the caret: the person pressed the agent to talk to it. A phone does not —
     an on-screen keyboard that arrives before the room does is the room's own half hidden. */
  React.useEffect(() => {
    if (!open || phone) return;
    const field = composerRef.current?.querySelector('textarea');
    if (field instanceof HTMLTextAreaElement) field.focus();
  }, [open, phone]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const appendTurn = React.useCallback((message: CopilotMessage): boolean => sessions.append([message]), [sessions]);

  const railProps = {
    sessions: sessions.sessions,
    currentId: sessions.currentId,
    open: sessionsOpen,
    onOpen: (id: string) => { sessions.open(id); setSessionsOpen(false); },
    onNew: () => { sessions.startNew(); setDraft(''); setSessionsOpen(false); },
    onForget: (id: string) => sessions.remove(id),
    onClose: () => setSessionsOpen(false),
  };

  const hooks: FlowHooks = {
    cast,
    adapter: runtime,
    context: current?.context ?? {},
    report: current?.flow?.report,
    savedReview: current?.flow?.review,
    onTurn: appendTurn,
    onFlow: (flow) => sessions.patch({ flow: { ...current?.flow, ...flow } }),
    onLeave: () => setOpen(false),
  };

  const startReport = (context: AssistantContext, report: OperatorReport) => {
    sessions.append(
      [said(`Supply report · ${report.text}`), say('Here are the orders this touches. It goes out when you send it.', { card: { kind: 'supply-review' } })],
      { context, flow: { ...current?.flow, report } },
    );
  };

  /* ── THE ASK GOES TO THE MIND (§196.2 · E198.11) ─────────────────────────────────────────
     One road, two postures, ONE append. `router.ask` returns the turn either way — the runtime's
     own answer, or the offline posture off this build's records — and the pair is filed together,
     which is the write the revision guard was built around. The words leave the box the moment
     they are sent, because they are in the conversation now; a refused write puts them back. */
  const submit = () => {
    const text = draft.trim();
    if (!text || askLock.current) return;
    askLock.current = true;
    setAsking(text);
    setDraft('');
    const history = [...turns];
    const sessionId = sessions.currentId ?? 'new';
    const context = askContext({
      cast, products, sales: supply.sales, issues: supply.issues, ledger: supply.ledger,
      rules: supply.rules, today: supply.today, now: supply.now,
      hash: typeof window === 'undefined' ? '' : window.location.hash,
    });
    void ask({
      text,
      reading: { cast, products, sales: supply.sales, issues: supply.issues, today: supply.today },
      context, sessionId, history,
    }).then(({ turn, posture }) => {
      /* WHAT THE ASK ACTUALLY FOUND, published once so the standing line is the last truth rather
         than the last guess. `turn.evidence.model` is the runtime's own word for the mind. */
      noteCopilotPosture(posture, turn.previewTransport?.model ?? turn.evidence?.model);
      if (!sessions.append([said(text), turn])) setDraft(text);
    }).finally(() => {
      askLock.current = false;
      setAsking(null);
    });
  };

  /* THE STARTERS, on the composer's doorstep (the port's own placement, Peter 2026-08-08: «put
     the suggestions above the composer»). They are REAL asks — a press writes the sentence INTO
     the box, where it can be edited, spoken over or deleted before anything is sent. */
  const recentCustomer = supply.sales.find((sale) => sale.day === supply.today)?.customer.name;
  const starters = [
    'What is short today?',
    recentCustomer ? `What did ${recentCustomer} order today?` : 'What is on today’s book?',
    'A category in the catalogue is wrong.',
  ];

  return (
    <>
      {open && inFront && (
        /* THE SCRIM IS ALSO A DOOR (E195.30). A sheet standing over the work has to be one press
           away from gone, and the press a person actually makes is on the work they can still see
           beside it — so the scrim takes it. It stays out of the accessibility tree: the keyboard's
           way out is Escape and the head's own Close, and a scrim announced as a control would be a
           second name for the same act. */
        <div
          aria-hidden="true"
          data-testid="copilot-scrim"
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9, backgroundColor: theme.colors.backgroundOverlay }}
        />
      )}
      <aside
        data-testid="assistant-dialog"
        data-copilot-open={open ? 'yes' : 'no'}
        data-posture={posture}
        role="dialog"
        aria-label="Copilot"
        /* a surface standing IN FRONT of the work says so, the way every other layer in this kit
           does (the chats panel's own `aria-modal`); beside the work it is a column, not a layer */
        aria-modal={open && inFront ? true : undefined}
        aria-hidden={open ? undefined : true}
        ref={(node) => { node?.toggleAttribute('inert', !open); }}
        className={css({
          zIndex: 10,
          display: open ? 'flex' : 'none',
          boxSizing: 'border-box',
          minWidth: 0,
          borderLeft: phone ? undefined : `1px solid ${theme.colors.borderOpaque}`,
          backgroundColor: theme.colors.backgroundPrimary,
          overflow: 'hidden',
          /* ── THE COLUMN IS THE FRAME'S THIRD TRACK, NOT A THING OVER IT (§196.2 · E193.16) ──
             «even down to the grid.» Standing beside the work, this is a GRID ITEM in the track
             `shell/frame.tsx` reserved — placed at column 3 explicitly so nothing auto-placed can
             land in it — and it is the RAIL'S OWN RECIPE mirrored: sticky, exactly one screen
             tall, `border-box`, its own scrollports inside. Sticky rather than fixed because the
             frame is only 100vh while a surface is in PANES; on the settings seats the page grows
             and scrolls, and a 100vh item in a 3.000px row would take its composer off the
             bottom of the world. The rail solved that same problem the same way.

             STANDING IN FRONT IS STILL FIXED, because a layer is not a track: it carries the
             scrim and reserves nothing. The two in-front postures differ in ONE property and it
             is the one the room decides — the phone is the screen, the sheet keeps the
             conversation's own 416 and lets the work stay visible beside it (E195.30). A sheet
             that meets three edges of the glass has no corners to round (the chats panel's own
             law), so it takes the house's overlay shadow and its left border and nothing else. */
          ...(inFront
            ? {
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: `${measure}px`, maxWidth: '100vw',
              ...(phone ? {} : { boxShadow: theme.lighting.shadow700 }),
              ...(phone && visualHeight ? { height: `${Math.round(visualHeight)}px`, top: 'auto' } : {}),
            }
            : {
              gridColumn: 3,
              gridRow: 1,
              position: 'sticky',
              top: 0,
              width: `${track}px`,
              height: '100vh',
            }),
        })}
      >
        {/* ── THE MEASURE IS THE BOX'S NOW, NOT A CAP INSIDE IT (§103 · E195.30) ────────────
            ⚠ REPEALS E193.16's centred cap in place. That cap existed because the `screen`
            posture made the agent as wide as a 1095px window and «a 900px-wide line of the
            agent's prose is the wide square phone stretched» — so the room inside was held to
            rail + conversation and centred, leaving two dead margins inside a surface that had
            just taken the whole screen. The box itself keeps the conversation's measure now
            (`copilotWidthOf`), so the cap has nothing left to cap: one measure, decided once, in
            the file that owns every other width this layout turns on. */}
        <div
          data-testid="assistant-host"
          data-sector={cast.sector}
          style={{
            display: 'flex', flex: '1 1 auto', minWidth: 0, minHeight: 0, position: 'relative',
            width: '100%', boxSizing: 'border-box',
          }}
        >
          {/* BESIDE the conversation where there is room for both; OVER the thread everywhere
              else — and «over» starts BELOW the head, because a list that covers the way out is a
              list a person is stuck inside (measured: the head's own controls were unclickable). */}
          {railBeside && <SessionsRail {...railProps} beside />}

          <section
            data-testid="assistant-conversation-surface"
            style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0, minHeight: 0 }}
          >
            {/* THE HEAD — the port's own recipe: the name, the two session controls, the way out */}
            <header
              data-testid="copilot-head"
              style={{
                display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexShrink: 0,
                paddingLeft: theme.sizing.scale500, paddingRight: theme.sizing.scale300,
                paddingTop: theme.sizing.scale300, paddingBottom: theme.sizing.scale300,
                borderBottom: `1px solid ${theme.colors.borderOpaque}`,
              }}
            >
              <span style={{ ...theme.typography.LabelLarge, flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Copilot</span>
              {!railBeside && (
                <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="assistant-history-toggle" aria-label="Sessions" onClick={() => setSessionsOpen((visible) => !visible)}
                  overrides={{ BaseButton: { style: { minHeight: '44px', minWidth: '44px', gap: theme.sizing.scale200 } } }}>
                  <Glyph id="log" size={STEP.small} />
                  <span>{sessions.sessions.length || ''}</span>
                </Button>
              )}
              <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="copilot-new" aria-label="New session" onClick={() => { sessions.startNew(); setDraft(''); }}
                overrides={{ BaseButton: { style: { minHeight: '44px', minWidth: '44px', paddingLeft: 0, paddingRight: 0 } } }}>
                <Glyph id="plus" size={STEP.small} />
              </Button>
              <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="copilot-close" aria-label="Close copilot" onClick={() => setOpen(false)}
                overrides={{ BaseButton: { style: { minHeight: '44px', minWidth: '44px', paddingLeft: 0, paddingRight: 0 } } }}>
                <Glyph id="collapse" size={STEP.small} />
              </Button>
            </header>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0, minHeight: 0 }}>
            {!railBeside && <SessionsRail {...railProps} beside={false} />}

            {/* THE THREAD, on the room's own ruled paper. It is the only thing that scrolls. */}
            <div
              ref={threadRef}
              data-testid="assistant-thread"
              aria-label="Copilot conversation"
              onScroll={(event) => {
                const el = event.currentTarget;
                atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
              }}
              style={{
                flex: '1 1 auto', minHeight: 0, minWidth: 0, overflowY: 'auto', overscrollBehavior: 'contain',
                display: 'grid', alignContent: 'start', gap: theme.sizing.scale400,
                padding: theme.sizing.scale500, boxSizing: 'border-box',
                ...paper,
              }}
            >
              {turns.length === 0 && (
                /* THE EMPTY ROOM — the mark, then the app's OWN line for this state, verbatim
                   («Pregúntale por su día o pídele un cambio» / «Ask about its day, or ask it to
                   change something», shell/Copilot.tsx), then one sentence of what it reads. The
                   asks themselves sit down by the composer, not up here (Peter, 2026-08-08). */
                <section data-testid="assistant-start" style={{ display: 'grid', gap: theme.sizing.scale200, maxWidth: '520px' }}>
                  <span aria-hidden="true"><Glyph id="ask" size={STEP.large} /></span>
                  <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Ask about its day, or ask it to change something.</h3>
                  <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                    It reads this house’s orders, the shortage ledger and the catalogue. Supply reports and catalogue corrections happen right here in the conversation.
                  </p>
                </section>
              )}
              {turns.map((message) => (
                <Turn key={message.id} message={message}>
                  {message.card?.kind === 'supply-report' && <SupplyReportCard hooks={hooks} onContinue={startReport} />}
                  {message.card?.kind === 'supply-review' && <SupplyCard hooks={hooks} />}
                  {message.card?.kind === 'catalogue-review' && <CatalogueCard hooks={hooks} />}
                  {message.proposals?.length ? (
                    <ProposalActs
                      sector={cast.sector}
                      proposals={message.proposals}
                      sales={supply.sales}
                      onDraft={(text) => setDraft(text)}
                      onLeave={() => setOpen(false)}
                    />
                  ) : null}
                </Turn>
              ))}
              {/* THE PAIR IN FLIGHT — the person's words where they will stand, and the agent
                  saying it is reading. Neither is filed until the answer lands. */}
              {asking !== null && (
                <>
                  <Turn message={{ id: 'asking', at: new Date().toISOString(), role: 'operator', text: asking }} />
                  <Thinking />
                </>
              )}
            </div>

            {/* THE FLOOR — starters, the composer, and the line that says what the agent may do */}
            <footer
              data-testid="assistant-composer-dock"
              ref={composerRef}
              style={{
                flexShrink: 0, display: 'grid', gap: theme.sizing.scale300, minWidth: 0,
                padding: theme.sizing.scale400,
                paddingBottom: phone ? `max(${theme.sizing.scale400}, env(safe-area-inset-bottom))` : theme.sizing.scale400,
                borderTop: `1px solid ${theme.colors.borderOpaque}`,
                backgroundColor: theme.colors.backgroundPrimary,
              }}
            >
              {sessions.failure && (
                <span role="alert" data-testid="assistant-save-error" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{sessions.failure}</span>
              )}
              {/* THE BOX IS BUILT WHEN THE COLUMN OPENS, and that is a REQUIREMENT rather than a
                  preference — the app's own A21 note, met here for the same measured reason: the
                  composer grows itself by reading `scrollHeight` and writing a height, and an
                  element inside a `display: none` dock measures 0. Mounted while stowed it wrote
                  `height: 0px` once and kept it, so the first thing a person saw on opening the
                  agent was a writing surface with no writing surface in it (screenshot, 1600).
                  Nothing is lost by mounting it here: the draft lives in this component. */}
              {open && <CopilotComposer
                testId="assistant-composer"
                value={draft}
                onChange={setDraft}
                onSend={submit}
                adapter={runtime}
                seed={`${cast.sector}-copilot`}
                placeholder="Ask the Copilot, or start a report"
                helpText={phone ? 'Hold the mic to dictate into the box' : 'Enter sends · Shift+Enter for a new line'}
              >
                {/* THE STARTERS AND THE TWO DOORS STAND ON THE COMPOSER'S DOORSTEP and stand down
                    the moment there is a conversation — «a starter is for starting» (the port's
                    own law, Peter 2026-08-08: «put the suggestions above the composer»). */}
                {turns.length === 0 && (
                  <div style={{ display: 'grid', gap: theme.sizing.scale200, justifyItems: 'start', minWidth: 0 }}>
                    <div data-testid="copilot-starters" style={{ display: 'grid', gap: theme.sizing.scale200, justifyItems: 'start', minWidth: 0, maxWidth: '100%' }}>
                      {starters.map((starter, index) => (
                        <Button key={starter} kind={KIND.secondary} size={SIZE.compact} data-testid={`copilot-starter-${index}`} onClick={() => setDraft(starter)}
                          overrides={{ BaseButton: { style: { minHeight: '44px', textAlign: 'left', maxWidth: '100%' } } }}>
                          {starter}
                        </Button>
                      ))}
                    </div>
                    <div data-testid="assistant-task-actions" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.sizing.scale200, minWidth: 0 }}>
                      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Start</span>
                      <Button kind={KIND.secondary} size={SIZE.compact} data-testid="copilot-start-supply" onClick={() => beginFrom('supply', { source: 'navigation' })}
                        overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Report supply issue</Button>
                      <Button kind={KIND.secondary} size={SIZE.compact} data-testid="copilot-start-catalogue" onClick={() => beginFrom('catalogue', { source: 'navigation' })}
                        overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Fix catalogue</Button>
                    </div>
                  </div>
                )}
              </CopilotComposer>}
              {/* ONE STANDING POSTURE, NEAR THE COMPOSER — the mailbox line's own placement and
                  its own shape: what is, and where the answer is a setting, the setting is one
                  press away rather than a path to follow. */}
              <span
                data-testid="copilot-posture"
                data-posture={mind.posture}
                data-model={mind.model}
                style={{
                  ...theme.typography.LabelXSmall, minWidth: 0, color: theme.colors.contentTertiary,
                  display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap',
                }}
              >
                {copilotStatusWord(mind.posture)}
                {mind.posture === 'offline' && (
                  <Button
                    kind={KIND.tertiary}
                    size={SIZE.mini}
                    data-testid="copilot-posture-check"
                    onClick={() => { void readCopilotPosture(); }}
                    overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
                  >
                    Check again
                  </Button>
                )}
              </span>
              <p data-testid="copilot-disclaimer" style={{ margin: 0, ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
                Changes go live when you accept them.
              </p>
            </footer>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
