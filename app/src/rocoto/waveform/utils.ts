/* GROWN from Base Web's own `src/template-component/` scaffold; `utils.ts` is Base's own name for
 * a component's pure maths (see `src/button-timed/utils.ts`).
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * EVERYTHING HERE IS DETERMINISTIC. That is the point of the file. A waveform drawn from
 * `Math.random()` is a different picture on every render, which makes a screenshot diff useless
 * and a design review impossible — the reviewer cannot tell a layout change from a new dice roll.
 * So a field is either drawn from real levels the caller measured, or from a SEED: the same seed
 * always draws the same field, on every machine, forever.
 */

/** 32-bit FNV-1a — a string becomes one stable number */
function seedOf(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — a small, fast, fully deterministic generator */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** THE FIELD AT REST. Noise alone reads as static, so the levels ride a slow ripple: the field
 *  gets the loud-and-quiet shape a spoken sentence has, and stays the same field every time. */
export function peaksFromSeed(seed: string, count: number): number[] {
  const n = seedOf(seed);
  const next = random(n);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const ripple = 0.5 + 0.5 * Math.sin(i * 0.9 + (n % 7));
    const level = 0.16 + 0.72 * next() * (0.35 + 0.65 * ripple);
    out.push(Math.min(1, Math.max(0.12, level)));
  }
  return out;
}

/** THE FIELD IN MOTION, WITH NO MICROPHONE. A level source whose value is a pure function of how
 *  many times it has been read, so the meter is alive on a page that was never granted a
 *  microphone — and identical on the second run, so a screenshot taken at tick 40 is the same
 *  picture tomorrow. Three detuned rhythms give syllables inside words inside phrases, and the
 *  breath between phrases drops under the noise gate, so the field visibly collapses to dots. */
export function createSimulatedAmplitude(seed = 'hello'): () => number {
  const n = seedOf(seed);
  let tick = 0;
  return () => {
    const t = tick++;
    const syllable = 0.5 + 0.5 * Math.sin(t * 0.55 + (n % 13));
    const word = 0.5 + 0.5 * Math.sin(t * 0.17 + (n % 7));
    const grain = 0.78 + 0.22 * Math.sin(t * 1.9 + (n % 3));
    const breath = Math.sin(t * 0.075 + (n % 5));
    // the pause between phrases, roughly a second every five: under the gate, so dots
    if (breath < -0.55) return 0.05 * grain;
    // speech sits well clear of the gate, so the pauses are the only place the field flattens
    const voice = (0.35 + 0.65 * syllable) * (0.45 + 0.55 * word);
    return Math.min(1, Math.max(0, (0.3 + 0.7 * voice) * grain));
  };
}

/** THE HEIGHT LAW, and there is only one, shared by all three modes: under the gate a mark is its
 *  own dot; over it, the mark grows from that dot to the tallest the size allows. Reading the
 *  remainder above the gate (rather than the raw level) means the first audible sound already
 *  lifts the mark clear of the dots instead of crawling up from them. */
export function barHeight(level: number, gate: number, dot: number, max: number): number {
  if (!(level > gate)) return dot;
  return dot + ((level - gate) / (1 - gate)) * (max - dot);
}

/** fit a measured field to the number of marks the width actually allows */
export function resample(levels: number[], count: number): number[] {
  if (count <= 0) return [];
  if (levels.length === 0) return new Array(count).fill(0);
  if (levels.length === 1) return new Array(count).fill(levels[0]);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const at = count === 1 ? 0 : (i / (count - 1)) * (levels.length - 1);
    out.push(levels[Math.min(levels.length - 1, Math.max(0, Math.round(at)))]);
  }
  return out;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** «0:07» — minutes and padded seconds, the only time format this system speaks */
export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = total % 60;
  return `${Math.floor(total / 60)}:${seconds < 10 ? '0' : ''}${seconds}`;
}
