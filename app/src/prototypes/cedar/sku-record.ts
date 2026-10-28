import * as React from 'react';
import type { Product } from '../../scenarios/data/cast';

/** Tenant-owned identity, separate from reference classification, pricing and stock ledgers. */
export type SKUAlias = { name: string; customer?: string };
export type SKUDetails = {
  name: string;
  code: string;
  unit: string;
  description: string;
  aliases: SKUAlias[];
  archived: boolean;
};
export type SKURevision = { at: string; by: string; before: SKUDetails; after: SKUDetails };
export type SKURecord = {
  /** Stable request identity used only to resume a confirmed creation after another store failed. */
  creationId?: string;
  original: { name: string; code?: string; unit: string };
  details: SKUDetails;
  revision: number;
  history: SKURevision[];
};
const KEY = 'rocoto-sku-records-v1';
type Book = Record<string, SKURecord>;
function read(): Book {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([, r]: [string, any]) =>
          r?.original?.name &&
          r?.details &&
          typeof r.details.name === 'string' &&
          Array.isArray(r.details.aliases) &&
          Array.isArray(r.history),
      ),
    ) as Book;
  } catch {
    return {};
  }
}
let book: Book = read();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const useSKURecords = () =>
  React.useSyncExternalStore(
    subscribe,
    () => book,
    () => book,
  );
export const skuRecord = (sector: string, id: string, records = book) => records[`${sector}:${id}`];
export const skuDetails = (sector: string, product: Product, records = book): SKUDetails =>
  skuRecord(sector, product.id, records)?.details ?? {
    name: product.name,
    code: product.code ?? '',
    unit: product.unit,
    description: '',
    aliases: [],
    archived: false,
  };
export function projectSKU(sector: string, product: Product, records = book): Product {
  const details = skuRecord(sector, product.id, records)?.details;
  return details
    ? {
        ...product,
        name: details.name,
        code: details.code || undefined,
        unit: details.unit,
        provisional: false,
      }
    : product;
}
export type SKUSavePolicy = {
  /** A caller may grant this only after proving the Product has no order, price, stock, or lot history. */
  allowUnitChange?: boolean;
  /** Stable request identity used only to resume a confirmed creation after another store failed. */
  creationId?: string;
};
export function saveSKU(
  sector: string,
  product: Product,
  details: SKUDetails,
  expectedRevision: number,
  by: string,
  policy: SKUSavePolicy = {},
): SKURecord {
  const key = `${sector}:${product.id}`;
  const prior = book[key];
  if ((prior?.revision ?? 0) !== expectedRevision)
    throw new Error(
      'This product changed while you were editing. Close and reopen details to review the latest version. Your draft is still waiting to save.',
    );
  if (!details.name.trim() || !details.unit.trim())
    throw new Error('Give this product a name and Unit.');
  const unitChanged = details.unit.trim().toLocaleLowerCase() !== product.unit.trim().toLocaleLowerCase();
  if (unitChanged && policy.allowUnitChange !== true)
    throw new Error('Orders, prices and stock use this Unit. Another Unit takes a variation.');
  const after = {
    ...details,
    name: details.name.trim(),
    code: details.code,
    unit: details.unit.trim(),
    description: details.description.trim(),
    aliases: details.aliases.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim() })),
  };
  const record = {
    creationId: policy.creationId ?? prior?.creationId,
    original: prior?.original ?? { name: product.name, code: product.code, unit: product.unit },
    details: after,
    revision: expectedRevision + 1,
    history: [
      ...(prior?.history ?? []),
      { at: new Date().toISOString(), by, before: skuDetails(sector, product), after },
    ],
  };
  const next = { ...book, [key]: record };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error(
      'Saving the product stalled in this browser. Your draft is still here; free some storage and try again.',
    );
  }
  book = next;
  listeners.forEach((fn) => fn());
  return record;
}
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) {
      book = read();
      listeners.forEach((fn) => fn());
    }
  });

const initialPrices = new Set<string>();
export const requestInitialSKUPrice = (sector: string, id: string) => {
  initialPrices.add(`${sector}:${id}`);
};
export function takeInitialSKUPrice(sector: string, id: string): boolean {
  const key = `${sector}:${id}`;
  const has = initialPrices.has(key);
  initialPrices.delete(key);
  return has;
}
