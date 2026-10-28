/** Explicit links between the tenant's exact sellable SKUs.
 *
 * A broad internal category is never evidence that two products are related. These
 * links are deliberately sparse and symmetric: they are created only when a person
 * adds a related SKU or edits the Related items section on a Product Sheet.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';
import type { CatalogueState } from './catalogue';
import { amendmentsOf, graduatedBase } from './catalogue';

export type ProductRelationSource = 'related-sku-creation' | 'product-sheet';
export type ProductRelationLink = {
  left: string;
  right: string;
  at: string;
  by: string;
  source: ProductRelationSource;
  reason?: string;
};
export type ProductRelationEvent = ProductRelationLink & { kind: 'linked' | 'unlinked' };
type RelationBook = {
  version: 2;
  links: Record<string, ProductRelationLink[]>;
  history: Record<string, ProductRelationEvent[]>;
};

type LegacyBook = { version: 1; links?: Record<string, unknown> };
const KEY = 'rocoto-product-relations-v1';
const empty = (): RelationBook => ({ version: 2, links: {}, history: {} });
const edge = (left: string, right: string): [string, string] =>
  left.localeCompare(right) <= 0 ? [left, right] : [right, left];
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const validLink = (value: unknown): value is ProductRelationLink => {
  const row = value as Partial<ProductRelationLink> | null;
  return !!row && validId(row.left) && validId(row.right) && row.left !== row.right
    && typeof row.at === 'string' && typeof row.by === 'string'
    && (row.source === 'related-sku-creation' || row.source === 'product-sheet');
};

function read(): RelationBook {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as RelationBook | LegacyBook | null;
    if (!raw || typeof raw !== 'object') return empty();
    if (raw.version === 2) {
      return {
        version: 2,
        links: Object.fromEntries(Object.entries(raw.links || {}).map(([sector, value]) => [sector, (Array.isArray(value) ? value : []).filter(validLink)])),
        history: Object.fromEntries(Object.entries(raw.history || {}).map(([sector, value]) => [sector, (Array.isArray(value) ? value : []).filter((row): row is ProductRelationEvent => validLink(row) && (row.kind === 'linked' || row.kind === 'unlinked'))])),
      };
    }
    if (raw.version === 1) {
      const migrated = empty();
      for (const [sector, value] of Object.entries(raw.links || {})) {
        migrated.links[sector] = (Array.isArray(value) ? value : []).flatMap((row) => {
          if (!Array.isArray(row) || row.length !== 2 || !validId(row[0]) || !validId(row[1]) || row[0] === row[1]) return [];
          const [left, right] = edge(row[0], row[1]);
          return [{ left, right, at: '', by: 'Imported', source: 'product-sheet' as const }];
        });
      }
      return migrated;
    }
    return empty();
  } catch {
    return empty();
  }
}

let book = read();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const publish = (next: RelationBook): boolean => {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  book = next;
  listeners.forEach((listener) => listener());
  return true;
};

export function useProductRelations() {
  return React.useSyncExternalStore(subscribe, () => book, () => book);
}

export function relatedProductIds(sector: string, productId: string, state: RelationBook = book): string[] {
  return (state.links[sector] || [])
    .filter((row) => row.left === productId || row.right === productId)
    .map((row) => row.left === productId ? row.right : row.left)
    .filter((id, index, rows) => rows.indexOf(id) === index);
}

/** Authored variants are direct relations too. Broad catalogue groups never enter this union. */
export function allRelatedProductIds(
  sector: SectorId,
  productId: string,
  catalogue: CatalogueState,
): string[] {
  const pairs: Array<[string, string]> = amendmentsOf(sector, catalogue)
    .filter((item) => item.hand || item.sellable)
    .map((item) => [item.base, item.id]);
  for (const id of catalogue.graduated) {
    const base = graduatedBase(id);
    if (base) pairs.push([base, id]);
  }
  const authored = pairs
    .filter(([left, right]) => left === productId || right === productId)
    .map(([left, right]) => left === productId ? right : left);
  return [...relatedProductIds(sector, productId), ...authored]
    .filter((id, index, rows) => id !== productId && rows.indexOf(id) === index);
}

export function relationHistoryFor(sector: string, productId: string, state: RelationBook = book): ProductRelationEvent[] {
  return (state.history[sector] || []).filter((row) => row.left === productId || row.right === productId);
}

export function linkProducts(
  sector: string,
  leftId: string,
  rightId: string,
  meta: { by?: string; reason?: string; source?: ProductRelationSource } = {},
): boolean {
  if (!leftId || !rightId || leftId === rightId) return false;
  const [left, right] = edge(leftId, rightId);
  const current = book.links[sector] || [];
  if (current.some((row) => row.left === left && row.right === right)) return true;
  const link: ProductRelationLink = {
    left,
    right,
    at: new Date().toISOString(),
    by: meta.by || 'You',
    source: meta.source || 'product-sheet',
    ...(meta.reason?.trim() ? { reason: meta.reason.trim() } : {}),
  };
  return publish({
    ...book,
    links: { ...book.links, [sector]: [...current, link] },
    history: { ...book.history, [sector]: [...(book.history[sector] || []), { ...link, kind: 'linked' }] },
  });
}

export function unlinkProducts(sector: string, leftId: string, rightId: string, by = 'You'): boolean {
  const [left, right] = edge(leftId, rightId);
  const current = book.links[sector] || [];
  const held = current.find((row) => row.left === left && row.right === right);
  if (!held) return true;
  const event: ProductRelationEvent = { ...held, at: new Date().toISOString(), by, kind: 'unlinked' };
  return publish({
    ...book,
    links: { ...book.links, [sector]: current.filter((row) => row.left !== left || row.right !== right) },
    history: { ...book.history, [sector]: [...(book.history[sector] || []), event] },
  });
}
