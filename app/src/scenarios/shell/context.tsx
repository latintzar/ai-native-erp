/* THE SHELL'S STATE — three contexts, and nothing else is global.
 *
 * · SECTOR   the global switch. A screen never holds a sector; it reads this one and pulls its
 *            cast. That is the mechanical proof of «same screen, different data»: a card that
 *            breaks under the switch is a defect in the screen, not a fourth sector.
 * · HIGHLIGHT the web, made legible without clicking. Hovering a cross-reference chip lights the
 *            ghost region it points at, and hovering a ghost region lights its chip. One id in
 *            one place; both ends read it.
 * · CATALOGUE every meta the build found, so back-references («leaned on by A3 A6 A7 … (24)»)
 *            and the consolidated page are computed rather than typed.
 */
import * as React from 'react';
import type { ScenarioMeta, SectorId } from '../meta';
import { CASTS, type Cast } from '../data/cast';

/* ── SECTOR ───────────────────────────────────────────────────────────────────────────────── */

type SectorState = { sector: SectorId; setSector: (s: SectorId) => void };
const SectorContext = React.createContext<SectorState>({ sector: 'fish', setSector: () => {} });

export const SectorProvider = SectorContext.Provider;

/** The sector switch's value, and the cast it selects. One hook, so a screen imports no data. */
export function useSector(): SectorState & { cast: Cast } {
  const state = React.useContext(SectorContext);
  return { ...state, cast: CASTS[state.sector] };
}

/* ── HIGHLIGHT ────────────────────────────────────────────────────────────────────────────── */

type HighlightState = { lit: string | null; light: (ref: string | null) => void };
const HighlightContext = React.createContext<HighlightState>({ lit: null, light: () => {} });

export const HighlightProvider = HighlightContext.Provider;
export const useHighlight = () => React.useContext(HighlightContext);

/** Both ends of a cross-reference use this: it returns the hover handlers and whether this ref is
 *  currently lit, so a chip and the region it points at cannot drift apart. */
export function useRefLink(ref: string | null | undefined) {
  const { lit, light } = useHighlight();
  return {
    lit: !!ref && lit === ref,
    handlers: ref
      ? {
          onMouseEnter: () => light(ref),
          onMouseLeave: () => light(null),
          onFocus: () => light(ref),
          onBlur: () => light(null),
        }
      : {},
  };
}

/* ── THE CATALOGUE ────────────────────────────────────────────────────────────────────────── */

export type CatalogueEntry = ScenarioMeta & { path: string };
const CatalogueContext = React.createContext<CatalogueEntry[]>([]);

export const CatalogueProvider = CatalogueContext.Provider;
export const useCatalogue = () => React.useContext(CatalogueContext);

/** Who leans on this card. Computed from every other card's `inherits`, never declared. */
export function backReferences(all: CatalogueEntry[], id: string): string[] {
  return all.filter((m) => m.inherits.some((i) => i.ref === id)).map((m) => m.id).sort();
}
