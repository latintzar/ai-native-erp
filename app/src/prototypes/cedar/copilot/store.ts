/* THE SESSIONS STORE (FEED-IA §196.2 — «with other sessions etc.»).
 *
 * WHY localStorage AND NOT THE TAB. The assistant kept its threads in `sessionStorage`, which is
 * honest about custody and wrong about the object: a list of past sessions that empties when the
 * tab closes is not a list of past sessions. A top agent's sessions are there tomorrow. So the
 * kit keeps them per tenant in localStorage, and the custody note stands where it belongs:
 *
 *   ⚠ THIS IS THE KIT'S OWN MEMORY, NOT AN AUTHORITY. Production history is an authenticated,
 *   tenant+operator-scoped retained object with a retention policy; localStorage is never that.
 *   Nothing here is evidence, nothing here is shared between people, and a browser that refuses
 *   to store says so on the surface instead of pretending it saved (`failure` below).
 *
 * ONLY WORK IS WRITTEN. Opening the agent, switching session and pressing New write NOTHING: a
 * session that was opened and not used is not a session, and an agent that files an empty one on
 * every glance hands the person a list of nothing. A door STAGES its session — first turn, card
 * and all — in memory, and the first real act commits it whole. That is also why «which session
 * am I in» is a fact about this TAB and not about the store: two windows may sit in two different
 * sessions, and neither moves the other.
 *
 * THE REVISION GUARD is the assistant's, kept: a write states which revision it is replacing, so
 * a second tab that moved the store underneath this one is REFUSED rather than clobbered — and
 * the refusal is a sentence the person reads, not a silent loss. The `storage` event is what
 * makes the two tabs one agent: the other tab's write is read back here.
 */
import * as React from 'react';
import type { Cast } from '../../../scenarios/data/cast';
import { runtime as kitRuntime } from '../runtime-client';
import type { AssistantContext, AssistantKind, CopilotMessage, CopilotSession, CopilotStore } from './types';

const KEY = (sector: Cast['sector']) => `rocoto-copilot-v3:${sector}`;

export const blank = (sector: Cast['sector']): CopilotStore => ({ version: 3, sector, revision: 0, sessions: [] });

export function readStore(sector: Cast['sector']): CopilotStore {
  if (typeof window === 'undefined') return blank(sector);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY(sector)) ?? 'null') as CopilotStore | null;
    if (parsed?.version !== 3 || parsed.sector !== sector || !Array.isArray(parsed.sessions)) return blank(sector);
    return parsed;
  } catch { return blank(sector); }
}

/** null on success, or the sentence the person reads */
export function writeStore(next: CopilotStore): string | null {
  try {
    const previous = readStore(next.sector);
    if (previous.revision !== next.revision - 1) {
      return 'This agent moved in another tab. Reopen the session before saving again.';
    }
    window.localStorage.setItem(KEY(next.sector), JSON.stringify(next));
    return null;
  } catch { return 'This browser kept the session out of storage. Copy anything you need before leaving.'; }
}

export const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** the session's name in the list: the first thing that was said, cut to a list row's measure */
export const titleFrom = (text: string, fallback: string): string => {
  const line = text.trim().split('\n')[0].trim();
  if (!line) return fallback;
  return line.length > 64 ? `${line.slice(0, 63)}…` : line;
};

export type SessionSeed = {
  origin: AssistantKind;
  context: AssistantContext;
  title: string;
  messages: CopilotMessage[];
};

export type SessionsApi = {
  /** what is filed, newest first */
  sessions: CopilotSession[];
  /** the session this tab is in — the staged one until it is committed */
  current: CopilotSession | undefined;
  currentId: string | null;
  /** the sentence a refused write left behind, or null */
  failure: string | null;
  /** open a filed session (no write — the tab moves, the store does not) */
  open: (id: string) => void;
  /** leave for an empty session (no write) */
  startNew: () => void;
  /** a door's session: held in memory until the first real act commits it */
  stage: (seed: SessionSeed) => void;
  /** append turns to the session this tab is in, committing a staged one whole */
  append: (messages: CopilotMessage[], patch?: Partial<Pick<CopilotSession, 'flow' | 'context'>>) => boolean;
  /** record a running flow's own state without adding a turn */
  patch: (patch: Partial<Pick<CopilotSession, 'flow' | 'context'>>) => boolean;
  /** forget one filed session — the list is the person's, so it is theirs to shorten */
  remove: (id: string) => void;
};

export function useSessions(sector: Cast['sector']): SessionsApi {
  const [store, setStore] = React.useState<CopilotStore>(() => readStore(sector));
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<CopilotSession | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const storeRef = React.useRef(store);
  const pendingRef = React.useRef(pending);
  const currentRef = React.useRef(currentId);
  storeRef.current = store;
  pendingRef.current = pending;
  currentRef.current = currentId;

  /* a tenant switch is a different agent: read that tenant's own sessions, and stand down */
  React.useEffect(() => {
    const next = readStore(sector);
    storeRef.current = next;
    setStore(next);
    setCurrentId(null);
    setPending(null);
    setFailure(null);
  }, [sector]);

  /* the other tab wrote — read it back, so both windows are one agent */
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== KEY(sector)) return;
      const next = readStore(sector);
      storeRef.current = next;
      setStore(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [sector]);

  const commit = React.useCallback((update: (current: CopilotStore) => CopilotStore): boolean => {
    const next = update(storeRef.current);
    const refused = writeStore(next);
    if (refused) { setFailure(refused); return false; }
    storeRef.current = next;
    setStore(next);
    setFailure(null);
    return true;
  }, []);

  const open = React.useCallback((id: string) => {
    setPending(null);
    setCurrentId(id);
  }, []);

  const startNew = React.useCallback(() => {
    setPending(null);
    setCurrentId(null);
  }, []);

  const stage = React.useCallback((seed: SessionSeed) => {
    const at = new Date().toISOString();
    const session: CopilotSession = {
      id: uid('session'), title: seed.title, createdAt: at, updatedAt: at,
      origin: seed.origin, context: seed.context, messages: seed.messages,
    };
    setPending(session);
    setCurrentId(null);
  }, []);

  const append = React.useCallback((messages: CopilotMessage[], patch?: Partial<Pick<CopilotSession, 'flow' | 'context'>>): boolean => {
    const at = new Date().toISOString();
    const filed = storeRef.current.sessions.find((session) => session.id === currentRef.current);
    const base: CopilotSession = filed ?? pendingRef.current ?? {
      id: uid('session'), title: 'New session', createdAt: at, updatedAt: at, origin: 'general', context: {}, messages: [],
    };
    const next: CopilotSession = {
      ...base,
      ...(patch ?? {}),
      updatedAt: at,
      title: base.messages.length || !messages.length ? base.title : titleFrom(messages[0].text, base.title),
      messages: [...base.messages, ...messages],
    };
    const saved = commit((now) => ({
      ...now,
      revision: now.revision + 1,
      sessions: now.sessions.some((session) => session.id === base.id)
        ? now.sessions.map((session) => (session.id === base.id ? next : session))
        : [next, ...now.sessions],
    }));
    if (!saved) return false;
    setPending(null);
    setCurrentId(base.id);
    return true;
  }, [commit]);

  const patch = React.useCallback((changes: Partial<Pick<CopilotSession, 'flow' | 'context'>>): boolean =>
    append([], changes), [append]);

  const remove = React.useCallback((id: string) => {
    commit((now) => ({ ...now, revision: now.revision + 1, sessions: now.sessions.filter((session) => session.id !== id) }));
    if (currentRef.current === id) setCurrentId(null);
  }, [commit]);

  const current = store.sessions.find((session) => session.id === currentId) ?? pending ?? undefined;

  /* ONE OBJECT PER STATE, not per render: the surface hangs `openAssistant`'s listener off a
     callback built from this, and a fresh object every render re-subscribes the window listener on
     every keystroke. */
  return React.useMemo(
    () => ({ sessions: store.sessions, current, currentId: currentId ?? pending?.id ?? null, failure, open, startNew, stage, append, patch, remove }),
    [store.sessions, current, currentId, pending, failure, open, startNew, stage, append, patch, remove],
  );
}

/* ── THE COPILOT'S STANDING POSTURE (FEED-IA §246 · §247.2) ────────────────────────────────────
 * «always we havbe to be super consistent and not fget people igo confusing menus when they
 *  shouldnt see them»                                                          — Peter, 2026-09-11
 *
 * The door was honest PER TURN and carried no standing posture: the offline state was announced
 * inside a message's activity trail, and the evidence line named the model only after an answer
 * already existed. So a person could look at the Copilot and learn which mind they had only by
 * asking it something first. The phone states its posture before you press anything
 * (`phone-capability.ts`), the mailbox states its own under the composer, and this is the same
 * rule one level down: the last posture is published here and the surface renders it once, near
 * the composer.
 *
 * It is the RUNTIME's word and nothing else. `runtime.health()` reports what the service holds
 * before the first ask; every `router.ask` result overwrites it with what actually happened.
 */
export type CopilotPosture = 'checking' | 'live' | 'offline';

export type CopilotRuntimeStanding = {
  posture: CopilotPosture;
  /** the mind behind the answers, in the runtime's own word */
  model: string;
  /** when the posture was last written, in epoch milliseconds. `0` means it has yet to answer. */
  checkedAt: number;
};

let standing: CopilotRuntimeStanding = { posture: 'checking', model: '', checkedAt: 0 };
const standingListeners = new Set<() => void>();

/** What a finished ask actually found. `router.ask` answers `live` or `offline` for every turn. */
export function noteCopilotPosture(posture: 'live' | 'offline', model = ''): void {
  standing = { posture, model: model || (posture === 'live' ? standing.model : ''), checkedAt: Date.now() };
  standingListeners.forEach((listener) => listener());
}

/** What the runtime HOLDS, read once when the agent opens, so the posture stands before the first
 *  ask. A read that fails is a runtime out of reach, which is the offline posture's own subject. */
export async function readCopilotPosture(): Promise<void> {
  try {
    const health = await kitRuntime.health();
    const model = health.providers.copilot ?? '';
    noteCopilotPosture(model === 'gemini' || model === 'anthropic' ? 'live' : 'offline', model);
  } catch {
    noteCopilotPosture('offline');
  }
}

export function useCopilotPosture(): CopilotRuntimeStanding {
  return React.useSyncExternalStore(
    React.useCallback((listener: () => void) => {
      standingListeners.add(listener);
      return () => { standingListeners.delete(listener); };
    }, []),
    () => standing,
    () => standing,
  );
}

/** The one word the surface prints, in the same three-word shape as `phoneStatusWord`,
 *  `emailStatusWord` and `whatsappStatusWord` — one state, one sentence, the same voice. */
export function copilotStatusWord(posture: CopilotPosture): string {
  if (posture === 'live') return 'Connected';
  if (posture === 'checking') return 'Checking';
  return 'Answering from your workspace records';
}
