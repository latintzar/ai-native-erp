import * as React from 'react';
import { ProofApiError, errorText, proofApi } from './api';

/** A browser session is setup access; verified Meta ownership grants conversation access. */
export function useProofSession() {
  const [attempt, setAttempt] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState('');
  const automaticRestarts = React.useRef(0);
  const restarting = React.useRef(false);
  const active = React.useRef<AbortController | null>(null);
  const confirm = React.useCallback(() => { automaticRestarts.current = 0; }, []);
  const retry = React.useCallback(() => {
    active.current?.abort(); automaticRestarts.current = 0; restarting.current = true;
    setReady(false); setError(''); setAttempt((value) => value + 1);
  }, []);
  const restart = React.useCallback(() => {
    if (restarting.current) return;
    restarting.current = true;
    active.current?.abort(); setReady(false);
    if (++automaticRestarts.current > 1) {
      setError('Allow cookies for this site, then try again.');
      return;
    }
    setError(''); setAttempt((value) => value + 1);
  }, []);
  React.useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    setReady(false); setError('');
    void proofApi<{ ok: boolean }>('/session', { body: {}, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok !== true) { setError('Your browser session needs another attempt. Try again.'); return; }
      restarting.current = false;
      setReady(true);
    }).catch((caught) => { if (!controller.signal.aborted) setError(errorText(caught)); });
    return () => controller.abort();
  }, [attempt]);
  return { ready, error, retry, restart, confirm };
}

/** Recursive polling owns one request and timer. Errors back off; background tabs poll slowly. */
export function useProofPolling<T>(path: string, enabled: boolean, onLocked: () => void, interval = 5000) {
  const [held, setHeld] = React.useState<{ path: string; value: T } | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const pausedNow = React.useRef(false);
  const activeRequest = React.useRef<AbortController | null>(null);
  const [generation, setGeneration] = React.useState(0);
  const refresh = React.useCallback(() => setGeneration((value) => value + 1), []);
  const adopt = React.useCallback((value: T) => { setHeld({ path, value }); refresh(); }, [path, refresh]);
  // Cookie rotation happens inside signup. Invalidate an older state request synchronously,
  // retaining the displayed setup until the response installs the verified account cookie.
  const pause = React.useCallback(() => {
    pausedNow.current = true; activeRequest.current?.abort(); setPaused(true);
  }, []);
  const resume = React.useCallback(() => {
    pausedNow.current = false; setPaused(false); refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!enabled) { setHeld(null); setError(''); setBusy(false); return; }
    if (paused) { setBusy(false); return; }
    let alive = true;
    let timer: number;
    let failures = 0;
    let active: AbortController | undefined;
    const tick = async () => {
      active = new AbortController();
      activeRequest.current = active;
      setBusy(true);
      try {
        const value = await proofApi<T>(path, { signal: active.signal });
        if (!alive || pausedNow.current || active.signal.aborted) return;
        setHeld({ path, value });
        setError('');
        failures = 0;
      } catch (caught) {
        if (!alive || pausedNow.current || active.signal.aborted) return;
        if (caught instanceof ProofApiError && caught.status === 401) { setHeld(null); onLocked(); return; }
        setError(errorText(caught));
        failures += 1;
      } finally {
        if (alive) setBusy(false);
      }
      if (alive && !pausedNow.current) timer = window.setTimeout(tick,
        Math.max(document.hidden ? 15000 : interval, Math.min(30000, interval * 2 ** failures)));
    };
    void tick();
    return () => { alive = false; active?.abort(); window.clearTimeout(timer); };
  }, [path, enabled, onLocked, interval, generation, paused]);

  return { data: enabled && held?.path === path ? held.value : null, error, busy, refresh, adopt, pause, resume };
}
