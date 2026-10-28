/** Tenant catalogue placement: category, family and SKU are three separate records. */
import * as React from 'react';
import type { Product } from '../../scenarios/data/cast';
import type { SectorId } from '../../scenarios/meta';
import { ancestorsOf, ground, nodeOf } from './catalogue';

export type TenantCategory = { id: string; name: string };
export type TenantProductFamily = { id: string; name: string; categoryId: string };
export type SKUPlacement = { productId: string; categoryId: string; familyId: string };

type Book = { version: 1; categories: Record<string, TenantCategory[]>; families: Record<string, TenantProductFamily[]>; placements: Record<string, SKUPlacement> };
const KEY = 'rocoto-product-ontology-v1';
const empty = (): Book => ({ version: 1, categories: {}, families: {}, placements: {} });
const normal = (value: string) => value.trim().toLocaleLowerCase();
const keyOf = (sector: string, id: string) => `${sector}:${id}`;
const uid = (kind: string) => `${kind}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

function read(): Book {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || raw.version !== 1 || typeof raw !== 'object') return empty();
    const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
    const categories = Object.fromEntries(Object.entries(raw.categories || {}).map(([sector, list]) => [sector, rows(list).filter((row: any) => row && typeof row.id === 'string' && typeof row.name === 'string').map((row: any) => ({ id: row.id, name: row.name }))]));
    const families = Object.fromEntries(Object.entries(raw.families || {}).map(([sector, list]) => [sector, rows(list).filter((row: any) => row && typeof row.id === 'string' && typeof row.name === 'string' && typeof row.categoryId === 'string').map((row: any) => ({ id: row.id, name: row.name, categoryId: row.categoryId }))]));
    const placements = Object.fromEntries(Object.entries(raw.placements || {}).filter(([, row]: [string, any]) => row && typeof row.productId === 'string' && typeof row.categoryId === 'string' && typeof row.familyId === 'string').map(([id, row]: [string, any]) => [id, { productId: row.productId, categoryId: row.categoryId, familyId: row.familyId }]));
    return { version: 1, categories, families, placements };
  } catch { return empty(); }
}

let book = typeof window === 'undefined' ? empty() : read();
const listeners = new Set<() => void>();
const publish = (next: Book) => { localStorage.setItem(KEY, JSON.stringify(next)); book = next; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const useProductOntology = () => React.useSyncExternalStore(subscribe, () => book, () => book);

function referenceCategory(product: Product): TenantCategory {
  const deep = nodeOf(ground(product.name, product.family));
  const category = [deep, ...(deep ? ancestorsOf(deep.id) : [])].find(node => node?.level === 'category');
  return { id: `reference:${category?.id ?? product.family}`, name: (category?.name ?? product.family) || 'Uncategorised' };
}
function fallbackPlacement(product: Product): { category: TenantCategory; family: TenantProductFamily } {
  const category = referenceCategory(product);
  return { category, family: { id: `legacy:${product.id}`, name: product.name, categoryId: category.id } };
}

export function placementFor(sector: SectorId | string, product: Product): { category: TenantCategory; family: TenantProductFamily; saved: boolean } {
  const placement = book.placements[keyOf(sector, product.id)];
  const category = placement && (book.categories[sector] || []).find(row => row.id === placement.categoryId);
  const family = placement && (book.families[sector] || []).find(row => row.id === placement.familyId && row.categoryId === placement.categoryId);
  if (category && family) return { category, family, saved: true };
  return { ...fallbackPlacement(product), saved: false };
}

export function categoryOptions(sector: SectorId | string, products: Product[]): TenantCategory[] {
  const rows = [...(book.categories[sector] || []), ...products.map(referenceCategory)];
  return rows.filter((row, index) => row.name.trim() && rows.findIndex(other => normal(other.name) === normal(row.name)) === index).sort((a, b) => a.name.localeCompare(b.name));
}

export function familyOptions(sector: SectorId | string, categoryId: string, products: Product[]): TenantProductFamily[] {
  const explicit = (book.families[sector] || []).filter(row => row.categoryId === categoryId);
  const inferred = products.map(product => placementFor(sector, product)).filter(row => row.category.id === categoryId).map(row => row.family);
  const rows = [...explicit, ...inferred];
  return rows.filter((row, index) => row.name.trim() && rows.findIndex(other => other.categoryId === row.categoryId && normal(other.name) === normal(row.name)) === index).sort((a, b) => a.name.localeCompare(b.name));
}

export function saveSKUPlacement(sector: SectorId | string, productId: string, input: { categoryId?: string; categoryName: string; familyId?: string; familyName: string }): { category: TenantCategory; family: TenantProductFamily } {
  const categoryName = input.categoryName.trim();
  const familyName = input.familyName.trim();
  if (!categoryName || !familyName) throw new Error('Choose or create both a category and a product family.');
  const categories = [...(book.categories[sector] || [])];
  let category = categories.find(row => row.id === input.categoryId) || categories.find(row => normal(row.name) === normal(categoryName));
  if (!category) { category = { id: uid('category'), name: categoryName }; categories.push(category); }
  const families = [...(book.families[sector] || [])];
  let family = families.find(row => row.id === input.familyId && row.categoryId === category!.id) || families.find(row => row.categoryId === category!.id && normal(row.name) === normal(familyName));
  if (!family) { family = { id: uid('family'), name: familyName, categoryId: category.id }; families.push(family); }
  publish({ ...book, categories: { ...book.categories, [sector]: categories }, families: { ...book.families, [sector]: families }, placements: { ...book.placements, [keyOf(sector, productId)]: { productId, categoryId: category.id, familyId: family.id } } });
  return { category, family };
}
