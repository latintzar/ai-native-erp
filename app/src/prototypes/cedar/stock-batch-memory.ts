import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';

export type StockBatchSource = 'manual' | 'paste' | 'file' | 'photo' | 'history' | 'favorite';

export type StockBatchLine = {
  id: string;
  productId: string;
  quantity: number;
  unit: string;
  productionDate?: string;
  lotNumber?: string;
};

export type StockBatchSnapshot = {
  id: string;
  sector: SectorId;
  label: string;
  recordedAt: string;
  source: StockBatchSource;
  lines: StockBatchLine[];
};

type StockBatchMemory = {
  sector: SectorId;
  history: StockBatchSnapshot[];
  favorites: StockBatchSnapshot[];
};

const listeners = new Set<() => void>();
const cache: Partial<Record<SectorId, StockBatchMemory>> = {};

const keyOf = (sector: SectorId) => `rocoto-stock-batches-v1:${sector}`;

const safeLine = (value: unknown): StockBatchLine | null => {
  const row = value as Partial<StockBatchLine> | null;
  if (!row || typeof row.productId !== 'string' || !row.productId.trim()) return null;
  if (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0) return null;
  if (typeof row.unit !== 'string' || !row.unit.trim()) return null;
  return {
    id: typeof row.id === 'string' && row.id ? row.id : crypto.randomUUID(),
    productId: row.productId,
    quantity: Number(row.quantity),
    unit: row.unit,
    ...(typeof row.productionDate === 'string' && row.productionDate ? { productionDate: row.productionDate } : {}),
    ...(typeof row.lotNumber === 'string' && row.lotNumber.trim() ? { lotNumber: row.lotNumber.trim() } : {}),
  };
};

const safeBatch = (value: unknown, sector: SectorId): StockBatchSnapshot | null => {
  const held = value as Partial<StockBatchSnapshot> | null;
  if (!held || held.sector !== sector || typeof held.id !== 'string' || typeof held.label !== 'string') return null;
  const lines = Array.isArray(held.lines) ? held.lines.map(safeLine).filter((line): line is StockBatchLine => !!line) : [];
  if (!lines.length) return null;
  return {
    id: held.id,
    sector,
    label: held.label,
    recordedAt: typeof held.recordedAt === 'string' ? held.recordedAt : new Date(0).toISOString(),
    source: ['manual', 'paste', 'file', 'photo', 'history', 'favorite'].includes(String(held.source)) ? held.source as StockBatchSource : 'manual',
    lines,
  };
};

const read = (sector: SectorId): StockBatchMemory => {
  if (cache[sector]) return cache[sector]!;
  let next: StockBatchMemory = { sector, history: [], favorites: [] };
  try {
    if (typeof window === 'undefined') return next;
    const raw = JSON.parse(localStorage.getItem(keyOf(sector)) || 'null');
    if (raw?.sector === sector) {
      next = {
        sector,
        history: Array.isArray(raw.history) ? raw.history.map((item: unknown) => safeBatch(item, sector)).filter(Boolean).slice(0, 40) as StockBatchSnapshot[] : [],
        favorites: Array.isArray(raw.favorites) ? raw.favorites.map((item: unknown) => safeBatch(item, sector)).filter(Boolean).slice(0, 20) as StockBatchSnapshot[] : [],
      };
    }
  } catch { /* An unreadable browser cache cannot create or favorite stock. */ }
  cache[sector] = next;
  return next;
};

const publish = (next: StockBatchMemory): boolean => {
  try { localStorage.setItem(keyOf(next.sector), JSON.stringify(next)); } catch { return false; }
  cache[next.sector] = next;
  listeners.forEach((listener) => listener());
  return true;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const recordStockBatch = (batch: StockBatchSnapshot) => {
  const held = read(batch.sector);
  const safe = safeBatch(batch, batch.sector);
  if (!safe) throw new Error('A stock batch needs at least one valid product row.');
  if (!publish({ ...held, history: [safe, ...held.history.filter((item) => item.id !== safe.id)].slice(0, 40) })) throw new Error('Saving this stock list to Recent stalled.');
};

export const setStockBatchFavorite = (sector: SectorId, batch: StockBatchSnapshot, favorite: boolean): boolean => {
  const held = read(sector);
  const safe = safeBatch({ ...batch, sector, source: 'favorite' }, sector);
  if (!safe) return false;
  return publish({
    ...held,
    favorites: favorite
      ? [safe, ...held.favorites.filter((item) => item.id !== safe.id)].slice(0, 20)
      : held.favorites.filter((item) => item.id !== safe.id),
  });
};

export function useStockBatchMemory(sector: SectorId): StockBatchMemory {
  return React.useSyncExternalStore(subscribe, () => read(sector), () => ({ sector, history: [], favorites: [] }));
}

if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (!event.key?.startsWith('rocoto-stock-batches-v1:')) return;
  const sector = event.key.slice('rocoto-stock-batches-v1:'.length) as SectorId;
  delete cache[sector];
  listeners.forEach((listener) => listener());
});
