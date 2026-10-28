/** A single in-flight read with bounded retries, visibility pause and scope-owned cancellation. */
export type LivePollEnvironment = {
  now: () => number;
  hidden: () => boolean;
  setTimer: (run: () => void, delay: number) => number;
  clearTimer: (id: number) => void;
  listen: (wake: () => void) => () => void;
};

const browserEnvironment = (): LivePollEnvironment => ({
  now: () => Date.now(), hidden: () => document.hidden,
  setTimer: (run, delay) => window.setTimeout(run, delay), clearTimer: id => window.clearTimeout(id),
  listen: wake => {
    window.addEventListener('focus', wake); window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { window.removeEventListener('focus', wake); window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake); };
  },
});

export function startLivePoll(read: (signal: AbortSignal) => Promise<boolean | void>, options: {
  interval?: number; maxDelay?: number; env?: LivePollEnvironment;
} = {}): { wake: () => void; stop: () => void } {
  const env = options.env ?? browserEnvironment(), interval = Math.max(250, options.interval ?? 5000);
  const ceiling = Math.max(interval, options.maxDelay ?? 60000);
  let alive = true, busy = false, failures = 0, nextAt = 0;
  let timer: number | undefined, active: AbortController | undefined;
  const clear = () => { if (timer !== undefined) env.clearTimer(timer); timer = undefined; };
  const schedule = (delay: number) => {
    clear(); nextAt = env.now() + delay;
    if (alive && !env.hidden()) timer = env.setTimer(() => { timer = undefined; void run(); }, delay);
  };
  const run = async () => {
    if (!alive || busy || env.hidden()) return;
    busy = true; active = new AbortController();
    const controller = active;
    try {
      const ok = await read(controller.signal);
      failures = ok === false ? Math.min(10, failures + 1) : 0;
    } catch { failures = Math.min(10, failures + 1); }
    finally {
      busy = false;
      if (active === controller) active = undefined;
      if (alive) schedule(Math.min(ceiling, interval * 2 ** failures));
    }
  };
  const wake = () => {
    if (!alive || busy || env.hidden()) return;
    if (failures && env.now() < nextAt) { schedule(nextAt - env.now()); return; }
    clear(); void run();
  };
  const unlisten = env.listen(wake);
  void run();
  return { wake, stop: () => { alive = false; clear(); active?.abort(); unlisten(); } };
}
