/* THE META CONTRACT — BUILD-PLAN §5.1, verbatim.
 *
 * Every screen file default-exports its scenario and exports `meta`. The consolidated page
 * (`reduction/Reduction.tsx`) is a PURE REDUCTION over these objects, so a missing field is a
 * missing row in a table the founder reads. Nothing on the consolidated page is typed by hand;
 * nothing on a scenario card's chrome is typed by hand either. Both read this object.
 *
 * P0 owns this file. Every other package READS it and never edits it.
 */
import type * as React from 'react';

/** The three frames the catalogue draws in. `paper` is a stage treatment inside a frame (C-15),
 *  never a fourth frame. */
export type Frame = 'desk' | 'phone' | 'public';

/** The eleven groups of brief §7. */
export type Group = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K';

/** How a card differs from the canonical screen it instantiates. `origin` marks the card that
 *  IS the canonical screen; everything else in the cluster deltas from it. */
export type Delta = 'origin' | 'control' | 'column' | 'data' | 'lockup';

/** The sector verdict. `=` same screen · `Δ` same screen, different content or tempo ·
 *  `≠` the screen is absent in that sector. */
export type Verdict = '=' | 'Δ' | '≠';

export type SectorId = 'fish' | 'meat' | 'fruit';

/** One of FLOWS' four threads. */
export type Thread = 1 | 2 | 3 | 4;

export type ScenarioMeta = {
  id: string;                       // 'A13-bis'
  title: string;                    // 'The customer says what arrived was wrong'
  group: Group;
  frame: Frame;
  paper?: boolean;                  // rendered as a printed sheet inside its frame (C-15)
  ifText: string;                   // the condition in words
  dims: string[];                   // ['D2.exceptions'] — configurations, verbatim from the brief
  job: string;                      // ONE sentence
  decides: string;                  // the positive space, as a decision
  inherits: Array<{ region: string; ref: string }>;   // ref = a card id
  open: Array<{ region: string; ref: string }>;       // ref = 'OPEN-4'
  primitives: string[];             // ['U01','U11']
  kit: string[];                    // kit component names used at full fidelity
  canonical: string;                // the canonical screen this instantiates, e.g. 'order-surface'
  delta: Delta;                     // how it differs from its canonical
  deltaText: string;                // the delta in one clause
  sector: { fish: Verdict; meat: Verdict; fruit: Verdict };
  drawnWith: SectorId;              // the data set the card is authored against
  thread: Thread[];                 // FLOWS' threads this card sits on
  step?: number;                    // its step on its primary thread
  fills: string[];                  // junction fields written — FLOWS §5 vocabulary
  reads: string[];                  // junction fields read
  nests?: { inside: string };       // sub-scenario: the ghosted parent card id
  live: string;                     // the interaction, in one clause — shown on the card
};

/** What a screen file exports. The shell globs `screens/*.tsx` and reads exactly this. */
export type ScenarioModule = {
  default: React.ComponentType;
  meta: ScenarioMeta;
};
