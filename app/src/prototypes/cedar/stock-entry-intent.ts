/* A one-shot hand-off from the Stock Update chooser to the SKU-owned stock editor.
 * It carries no quantity or lot: only the person’s chosen SKU and whether they are
 * receiving stock or recording a count. The canonical editor remains the only writer. */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';

export type StockEntryMode = 'receive' | 'count';
export type StockEntryOrigin = 'stock-update';

export type StockEntryIntent = Readonly<{
  id: string;
  sector: SectorId;
  productId: string;
  mode: StockEntryMode;
  /** The chooser owns the next-item handoff; the SKU sheet still owns every stock write. */
  origin?: StockEntryOrigin;
}>;

let current: StockEntryIntent | null = null;
let sequence = 0;
const listeners = new Set<() => void>();
let stockUpdateOpener: (() => void) | null = null;

const snapshot = (): StockEntryIntent | null => current;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const publish = (next: StockEntryIntent | null): void => {
  current = next;
  for (const listener of listeners) listener();
};

/** Ask the matching SKU sheet to open its existing stock form after navigation. */
export function requestStockEntry(a: Omit<StockEntryIntent, 'id'>): StockEntryIntent {
  const intent: StockEntryIntent = {
    ...a,
    id: `stock-entry-${Date.now().toString(36)}-${++sequence}`,
  };
  publish(intent);
  return intent;
}

/**
 * The Stock area registers its existing chooser here. The SKU sheet can return only after its
 * own canonical write succeeds; it never carries a quantity, lot or draft back to the chooser.
 */
export function useStockUpdateReturn(onOpen: () => void): void {
  const latest = React.useRef(onOpen);
  latest.current = onOpen;

  React.useEffect(() => {
    const opener = () => latest.current();
    stockUpdateOpener = opener;
    return () => {
      if (stockUpdateOpener === opener) stockUpdateOpener = null;
    };
  }, []);
}

/** Returns false only if the Stock utility is no longer mounted. The completed write still stands. */
export function returnToStockUpdate(): boolean {
  if (!stockUpdateOpener) return false;
  stockUpdateOpener();
  return true;
}

/** A SKU sheet consumes only its own pending request. Other products leave it untouched. */
export function useStockEntryIntent(
  sector: SectorId,
  productId: string,
  onOpen: (intent: StockEntryIntent) => void,
): void {
  const intent = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  const latestOpen = React.useRef(onOpen);
  latestOpen.current = onOpen;

  React.useEffect(() => {
    if (!intent || intent.sector !== sector || intent.productId !== productId) return;
    /* Clear before opening so a remount, a history restore, or another SKU cannot replay it. */
    publish(null);
    latestOpen.current(intent);
  }, [intent, productId, sector]);
}
