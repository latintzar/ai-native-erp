/* THE TRACE — a conversation PLAYS its story when you open it.
 *
 * ═══ WHAT PETER ASKED FOR, VERBATIM (FEED-IA §120.1) ════════════════════════════════════════
 * «How does the in-memory theatre happen? Are there any animations in terms of what appears?
 * Maybe each time we open a new chat or we go to any of the historical chats, it shows the
 * animation of them. It's a bit like in a demo, where we can trace what's going on: the theatre,
 * the order, and then something gets clarified, and then the order updates and the confidence
 * level updates.»
 *
 * ═══ SO THE BEATS ARE NAMED BEFORE THE LAYOUT (FEED-IA §115.6, FILM THINKING) ═══════════════
 * A thread is not a stagger of N rows; it is a scene with a before, an action and a landing. The
 * plan below cuts one conversation into exactly the beats he named:
 *
 *   ┌─ THE TRACE ────────────────────────────────────────────────────────────────────────────┐
 *   │  0 · THE RECORD    everything older than the arc, already standing — a person opening a │
 *   │                    forty-message thread is not made to watch forty messages arrive      │
 *   │  1 · SAID          the message lands                                                    │
 *   │  2 · ANSWERED      Rocoto says something back — the clarification, where there is one    │
 *   │  3 · MOVED         the order updates, and the act line says what moved it (§77.5b)       │
 *   │  4 · READ          what Rocoto decided about it — the inspector, on a test conversation  │
 *   │  N · SETTLED       the tick lands. The confidence organ is the LAST beat, always.        │
 *   └────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══ MEASURED BEATS, NEVER A SPINNER (FEED-IA §102's timing discipline) ═════════════════════
 * ONE cadence, and it is a THEME TOKEN rather than a number somebody liked: `timing200`, read off
 * `theme.animation` and stated once as `BEAT_MS`. Nothing here spins, nothing pulses, nothing
 * waits on a network. The whole trace is bounded by construction — `MAX_PARTS` caps how many
 * beats a conversation of any length can plan — so opening a chat can never cost more than
 * `(MAX_PARTS + 2) × BEAT_MS`, which is under two seconds on the busiest thread in the house.
 *
 * ═══ IT PLAYS ONCE, AND THEN IT IS THE RECORD ═══════════════════════════════════════════════
 * A person re-opening a conversation to READ it must never wait through the show again. `PLAYED`
 * remembers which conversations have run in this session, so the second open is INSTANT and the
 * thread stands as a plain transcript. The replay affordance is how it is asked for again — a
 * quiet mark in the header, never an automatic second performance.
 *
 * ═══ AND NOTHING LEAVES THE DOCUMENT ════════════════════════════════════════════════════════
 * A beat that has not landed yet is PAINTED OUT — opacity and a 6px rise — and never removed. The
 * rows, their words, their attributes and their controls are all in the DOM from the first frame,
 * so a trace cannot break a screen reader's reading of the conversation, cannot break a harness,
 * and cannot move one pixel of layout while it plays. It is paint, on the theme's own timing.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { useStillness } from './stage';

/* ── THE PLAN ─────────────────────────────────────────────────────────────────────────────── */

/** WHAT A BEAT IS, and the list is closed. `record` is beat 0 — the conversation as it already
 *  stood — and `settled` is the last one, which is the tick. */
export type BeatKind = 'record' | 'said' | 'answered' | 'moved' | 'read' | 'settled';

/** WHAT THE TRACE READS OFF A ROW, and it is deliberately structural: the plan needs three facts
 *  about a turn and has no business knowing what else a `ThreadTurn` carries. */
export type TraceRow = {
  author: 'received' | 'sent' | 'ai';
  /** did this turn SAY anything — words, a take, a photograph, a card */
  spoken: boolean;
  /** did it move the order (§77.5b's act line) */
  moved: boolean;
  /** does an inspector stand after it (the checkpoint §10.9) */
  read: boolean;
};

export type TracePlan = {
  /** how many beats this conversation has, the record and the tick included */
  beats: number;
  /** what each beat is, by index — the film's own naming, and the attribute a drive reads */
  kinds: BeatKind[];
  /** the beat row `i`'s words land on */
  said: number[];
  /** the beat row `i`'s act line lands on, or -1 where it has none */
  moves: number[];
  /** the beat row `i`'s inspector lands on, or -1 where it has none */
  reads: number[];
  /** the beat the order face stands from */
  orderBeat: number;
  /** the beat the tick settles on — always the last */
  settleBeat: number;
};

/** HOW MANY PARTS THE ARC MAY PLAY. Six is what fits inside two seconds at this cadence, and it
 *  is the whole reason a long conversation opens as fast as a short one: everything the arc
 *  cannot hold falls back into the record and is simply THERE. */
const MAX_PARTS = 6;

/** THE PLAN, BUILT FROM THE END BACKWARDS — because the story a person opens a conversation for
 *  is the RECENT one, and the arc has to end on the newest turn whatever else it drops. */
export function planOf(rows: TraceRow[]): TracePlan {
  const said = rows.map(() => 0);
  const moves = rows.map(() => -1);
  const reads = rows.map(() => -1);

  /* WHAT THE ARC WOULD PLAY, newest first, until it is full. Each turn contributes up to three
     parts — its words, the order it moved, what Rocoto decided — and they are taken as a SET so a
     turn is never cut in half across the arc's own edge. */
  type Part = { row: number; kind: BeatKind };
  const arc: Part[] = [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const r = rows[i];
    const parts: Part[] = [];
    if (r.spoken) parts.push({ row: i, kind: r.author === 'ai' ? 'answered' : 'said' });
    if (r.moved) parts.push({ row: i, kind: 'moved' });
    if (r.read) parts.push({ row: i, kind: 'read' });
    if (parts.length === 0) continue;
    if (arc.length + parts.length > MAX_PARTS) break;
    arc.unshift(...parts);
  }

  const kinds: BeatKind[] = ['record'];
  let orderBeat = -1;
  for (const part of arc) {
    kinds.push(part.kind);
    const beat = kinds.length - 1;
    if (part.kind === 'moved') {
      moves[part.row] = beat;
      /* THE ORDER APPEARS ON THE BEAT IT FIRST MOVED — «the theatre, the order». */
      if (orderBeat < 0) orderBeat = beat;
    } else if (part.kind === 'read') {
      reads[part.row] = beat;
    } else {
      said[part.row] = beat;
    }
  }
  /* THE TICK IS THE LAST BEAT, ALWAYS — «and the confidence level updates» is where he ends the
     sentence, so it is where the trace ends too (§120.1 · §120.2). */
  kinds.push('settled');

  return {
    beats: kinds.length,
    kinds,
    said,
    moves,
    reads,
    /* AN ORDER THE CONVERSATION ALREADY CARRIED STANDS WITH THE RECORD. It was not formed in the
       arc, so claiming it arrived during the arc would be the trace telling a story that did not
       happen. */
    orderBeat: orderBeat >= 0 ? orderBeat : 0,
    settleBeat: kinds.length - 1,
  };
}

/* ── THE PLAYER ───────────────────────────────────────────────────────────────────────────── */

/** ONE THEME TOKEN, READ ONCE — `animation.timing200`. The cadence is the design system's, so a
 *  change to the system's own rhythm reaches this trace without anybody editing it (§102). */
export const beatMs = (timing: string): number => {
  const n = Number.parseFloat(timing);
  return timing.trim().endsWith('ms') ? n : n * 1000;
};

/** WHICH CONVERSATIONS HAVE ALREADY PLAYED IN THIS SESSION. Module state on purpose: it is a fact
 *  about this visit, not about the house, so it is never written to the store — a person coming
 *  back tomorrow gets the trace again, and a person clicking between two threads does not. */
const PLAYED = new Set<string>();

/** ⚠ IT IS `ThreadTrace`, NOT `Trace`. `trace.ts` already owns `Trace` — the supervised example a
 *  correction teaches — and two exported types of one name in one codebase is the drift §30 keeps
 *  icons out of. This one is a PERFORMANCE; that one is a training row. */
export type ThreadTrace = {
  /** how many beats have landed */
  shown: number;
  /** is beat `b` on screen yet */
  on: (b: number) => boolean;
  /** is the performance still running */
  playing: boolean;
  /** put the whole conversation on screen NOW — any input calls this (§4.5's skippable law) */
  land: () => void;
  /** run it again, from the top */
  replay: () => void;
};

/**
 * THE PERFORMANCE, KEYED BY THE CONVERSATION IT IS ABOUT.
 *
 * ⚠ SEAM: this is `stage.tsx`'s `useWalk` with ONE thing added — a SUBJECT. `useWalk` resets on
 * `steps` and `from` alone, which is right for a stage that performs one script; a conversation
 * trace has to restart when the person opens a DIFFERENT thread, and two threads can easily plan
 * the same number of beats. Giving `useWalk` a `key` deletes this player and nothing else changes.
 * Its stillness, its skippability and its one-timer-at-a-time discipline are that function's, kept
 * clause for clause.
 */
export function useTrace(key: string, beats: number, ms: number): ThreadTrace {
  const still = useStillness();
  const played = PLAYED.has(key);
  const [shown, setShown] = React.useState(still || played ? beats : 1);

  /* A DIFFERENT CONVERSATION IS A DIFFERENT PERFORMANCE. One that has run stands whole; one that
     has not opens on its record and plays from there. */
  React.useEffect(() => {
    setShown(still || PLAYED.has(key) ? beats : 1);
  }, [key, beats, still]);

  /* ONE TIMER AT A TIME, cleared on every change, so nothing races and nothing fires into a
     conversation somebody has already left. */
  React.useEffect(() => {
    if (shown >= beats) {
      PLAYED.add(key);
      return undefined;
    }
    const next = window.setTimeout(() => setShown((n) => n + 1), ms);
    return () => window.clearTimeout(next);
  }, [shown, beats, key, ms]);

  const land = React.useCallback(() => setShown(beats), [beats]);
  const replay = React.useCallback(() => {
    PLAYED.delete(key);
    setShown(1);
  }, [key]);

  return {
    shown,
    on: React.useCallback((b: number) => b < shown, [shown]),
    playing: shown < beats,
    land,
    replay,
  };
}

/* ── THE PAINT ────────────────────────────────────────────────────────────────────────────── */

/**
 * HOW A BEAT ARRIVES — and it is the reveal this app already ships (`detail.tsx`'s new line).
 *
 * Opacity and a 6px rise, on the theme's own timing and easing, PAINT ONLY: nothing under a beat
 * can be shoved by it landing, and the row's box is its full size from the first frame. A reader
 * who has asked for less motion gets the conversation with no travel at all, which is the whole
 * of what that setting means.
 */
export function useBeat(): (on: boolean) => React.CSSProperties {
  const [, theme] = useStyletron();
  const still = useStillness();
  return React.useCallback(
    (on: boolean) => ({
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0)' : 'translateY(6px)',
      transitionProperty: 'opacity, transform',
      /* stillness is `0ms`, the same literal `detail.tsx`'s own reveal writes in its
         reduced-motion query — a duration, never a brand value the theme gate owns */
      transitionDuration: still ? '0ms' : theme.animation.timing400,
      transitionTimingFunction: theme.animation.easeOutCurve,
    }),
    [theme, still],
  );
}
