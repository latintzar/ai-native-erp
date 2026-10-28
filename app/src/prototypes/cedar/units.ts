/**
 * Tenant and SKU unit policy for the browser kit.
 *
 * This is deliberately a local persistence seam, not the production unit ledger. Its job is to
 * keep the UI honest: a tenant may name any unit, every Product has one Unit, and a conversion
 * is usable only when somebody has recorded an exact relationship. The existing
 * `unitFactor` export remains the sale fold's narrow compatibility boundary.
 */
import * as React from 'react';
import type { Product } from '../../scenarios/data/cast';
import type { SectorId } from '../../scenarios/meta';

export const UNITS_STORAGE_KEY = 'rocoto-app-units';

export const UNIT_KINDS = ['mass', 'volume', 'count', 'package', 'custom'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export type UnitEquivalenceStatus = 'exact' | 'nominal' | 'catch-weight';
export type UnitEquivalenceSource = 'tenant' | 'legacy-pack' | 'reviewed-proposal';

/** A tenant's vocabulary entry. `kind` aids presentation only; it never creates a conversion. */
export type UnitDefinition = {
  id: string;
  label: string;
  plural?: string;
  kind: UnitKind;
  precision: number;
  status: 'active' | 'retired';
  revision: number;
};

/** `1 unit = quantity baseUnit`. Nominal and catch-weight rows never drive an automatic conversion. */
export type UnitEquivalence = {
  id?: string;
  unit: string;
  quantity: number;
  baseUnit: string;
  approximate?: boolean;
  kind?: UnitKind;
  status?: UnitEquivalenceStatus;
  source?: UnitEquivalenceSource;
  /** Tenant rules are defaults; a Product rule for the same unit pair overrides them. */
  scope?: 'tenant' | 'product';
  evidence?: string;
  revision?: number;
};

export type UnitEquivalenceDraft = {
  unit: string;
  quantity: number;
  baseUnit: string;
  status: UnitEquivalenceStatus;
  evidence?: string;
};

/** A customer phrase is scoped to the customer and SKU; it is never a tenant-wide synonym. */
export type CustomerUnitAlias = {
  id: string;
  customerId: string;
  phrase: string;
  unit: string;
  revision: number;
};

/** A model can propose this shape, but it cannot write a UnitDefinition or UnitEquivalence itself. */
export type UnitMappingProposal = {
  id: string;
  sector: SectorId;
  productId: string;
  observedText: string;
  suggestedUnit?: string;
  suggestedEquivalence?: UnitEquivalenceDraft;
  evidence: Array<{ source: string; excerpt: string }>;
  confidence: number;
  status: 'proposed';
};

export type UnitSaveResult =
  | { ok: true; revision: number }
  | { ok: false; revision: number; error: string };

/** Small presentational answer for selectors and line editors. */
export type UnitDescription = {
  label: string;
  kind: UnitKind;
  state: 'tenant' | 'retained' | 'unknown';
};

/** A line editor may display all five states, but only `exact` carries a usable factor. */
export type UnitConversion = {
  fromUnit: string;
  toUnit: string;
  state: 'same' | 'exact' | 'nominal' | 'catch-weight' | 'unknown';
  factor: number | null;
  source?: UnitEquivalenceSource;
  evidence?: string;
};

type ProductUnitRecord = {
  revision: number;
  equivalences: UnitEquivalence[];
  aliases: CustomerUnitAlias[];
};

type TenantUnitRecord = { revision: number; definitions: UnitDefinition[]; equivalences: UnitEquivalence[] };
type UnitsStore = {
  version: 2;
  revision: number;
  tenants: Record<string, TenantUnitRecord>;
  products: Record<string, ProductUnitRecord>;
};

const emptyStore = (): UnitsStore => ({ version: 2, revision: 0, tenants: {}, products: {} });
const keyOf = (sector: SectorId | string, productId: string) => `${sector}:${productId}`;
const normal = (value: string): string => value.trim().toLocaleLowerCase();
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const asKind = (value: unknown): UnitKind => UNIT_KINDS.includes(value as UnitKind) ? (value as UnitKind) : 'custom';
const asStatus = (value: unknown, approximate = false): UnitEquivalenceStatus =>
  value === 'exact' || value === 'nominal' || value === 'catch-weight'
    ? value
    : approximate
      ? 'nominal'
      : 'exact';
const asSource = (value: unknown): UnitEquivalenceSource =>
  value === 'legacy-pack' || value === 'reviewed-proposal' || value === 'tenant' ? value : 'tenant';

/** Preserve a tenant's deliberate classification; infer only when an older record has none. */
const storedKind = (value: unknown, label: string): UnitKind =>
  UNIT_KINDS.includes(value as UnitKind) ? (value as UnitKind) : inferredUnitKind(label);

const MASS_UNITS = new Set(['kg', 'g', 'mg', 'tonne', 'tonnes', 'gram', 'grams', 'gramo', 'gramos', 'kilo', 'kilos']);
const VOLUME_UNITS = new Set(['l', 'ml', 'cl', 'litre', 'litres', 'liter', 'liters', 'litro', 'litros']);
const COUNT_UNITS = new Set(['each', 'unit', 'units', 'piece', 'pieces', 'pc', 'pcs', 'unidad', 'unidades', 'pieza', 'piezas']);
const PACKAGE_UNITS = new Set(['box', 'boxes', 'case', 'cases', 'crate', 'crates', 'sack', 'sacks', 'bag', 'bags', 'pack', 'packs', 'tray', 'trays', 'pallet', 'pallets', 'caja', 'cajas', 'saco', 'sacos', 'bolsa', 'bolsas', 'bandeja', 'bandejas', 'palé', 'palés']);

/** Classification is only a filter/copy hint. `pot`, `bot`, and every tenant word can stay custom. */
export function inferredUnitKind(label: string): UnitKind {
  const value = normal(label);
  if (MASS_UNITS.has(value)) return 'mass';
  if (VOLUME_UNITS.has(value)) return 'volume';
  if (COUNT_UNITS.has(value)) return 'count';
  if (PACKAGE_UNITS.has(value)) return 'package';
  return 'custom';
}

const makeId = (() => {
  let sequence = 0;
  return (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++sequence}`;
})();

function sanitiseEquivalence(value: unknown): UnitEquivalence | null {
  if (!object(value)) return null;
  const unit = text(value.unit);
  const baseUnit = text(value.baseUnit);
  const quantity = value.quantity;
  if (!unit || !baseUnit || normal(unit) === normal(baseUnit) || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0)
    return null;
  const approximate = value.approximate === true;
  const status = asStatus(value.status, approximate);
  return {
    ...(text(value.id) ? { id: text(value.id) } : {}),
    unit,
    quantity,
    baseUnit,
    ...(status === 'exact' ? {} : { approximate: true }),
    kind: storedKind(value.kind, unit),
    status,
    source: asSource(value.source),
    ...(value.scope === 'tenant' || value.scope === 'product' ? { scope: value.scope } : {}),
    ...(text(value.evidence) ? { evidence: text(value.evidence) } : {}),
    revision: typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 1,
  };
}

function sanitiseDefinition(value: unknown): UnitDefinition | null {
  if (!object(value)) return null;
  const id = text(value.id);
  const label = text(value.label);
  const precision = value.precision;
  if (!id || !label || typeof precision !== 'number' || !Number.isInteger(precision) || precision < 0 || precision > 6)
    return null;
  return {
    id,
    label,
    ...(text(value.plural) ? { plural: text(value.plural) } : {}),
    kind: storedKind(value.kind, label),
    precision,
    status: value.status === 'retired' ? 'retired' : 'active',
    revision: typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 1,
  };
}

function sanitiseAlias(value: unknown): CustomerUnitAlias | null {
  if (!object(value)) return null;
  const id = text(value.id);
  const customerId = text(value.customerId);
  const phrase = text(value.phrase);
  const unit = text(value.unit);
  if (!id || !customerId || !phrase || !unit) return null;
  return {
    id,
    customerId,
    phrase,
    unit,
    revision: typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 1,
  };
}

function sanitiseProductRecord(value: unknown): ProductUnitRecord | null {
  if (!object(value)) return null;
  const equivalences = Array.isArray(value.equivalences)
    ? value.equivalences.map(sanitiseEquivalence).filter((row): row is UnitEquivalence => !!row)
    : [];
  const aliases = Array.isArray(value.aliases)
    ? value.aliases.map(sanitiseAlias).filter((row): row is CustomerUnitAlias => !!row)
    : [];
  return {
    revision: typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
    equivalences,
    aliases,
  };
}

function sanitiseTenantRecord(value: unknown): TenantUnitRecord | null {
  if (!object(value)) return null;
  const definitions = Array.isArray(value.definitions)
    ? value.definitions.map(sanitiseDefinition).filter((row): row is UnitDefinition => !!row)
    : [];
  const equivalences = Array.isArray(value.equivalences)
    ? value.equivalences.map(sanitiseEquivalence).filter((row): row is UnitEquivalence => !!row)
    : [];
  return {
    revision: typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
    definitions,
    equivalences,
  };
}

function decode(rawText: string | null): UnitsStore | null {
  if (rawText === null) return emptyStore();
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return null;
  }
  if (!object(raw)) return null;
  if (raw.version === 1 && object(raw.products)) {
    const products: Record<string, ProductUnitRecord> = {};
    for (const [key, rows] of Object.entries(raw.products)) {
      if (!Array.isArray(rows)) continue;
      const equivalences = rows.map(sanitiseEquivalence).filter((row): row is UnitEquivalence => !!row);
      if (equivalences.length) products[key] = { revision: 0, equivalences, aliases: [] };
    }
    return { version: 2, revision: 0, tenants: {}, products };
  }
  if (raw.version !== 2 || !object(raw.products) || !object(raw.tenants)) return null;
  const products: Record<string, ProductUnitRecord> = {};
  const tenants: Record<string, TenantUnitRecord> = {};
  for (const [key, value] of Object.entries(raw.products)) {
    const record = sanitiseProductRecord(value);
    if (record) products[key] = record;
  }
  for (const [key, value] of Object.entries(raw.tenants)) {
    const record = sanitiseTenantRecord(value);
    if (record) tenants[key] = record;
  }
  return {
    version: 2,
    revision: typeof raw.revision === 'number' && Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
    tenants,
    products,
  };
}

function readStore(): UnitsStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    return decode(window.localStorage.getItem(UNITS_STORAGE_KEY)) ?? emptyStore();
  } catch {
    return emptyStore();
  }
}

let held = readStore();
let saveError = '';
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Existing compatibility hook. It exposes a number so current sale/detail consumers keep working. */
export function useUnits(): number {
  return React.useSyncExternalStore(subscribe, () => held.revision, () => held.revision);
}

export function useUnitStore(): UnitsStore {
  return React.useSyncExternalStore(subscribe, () => held, () => held);
}

export function useUnitSaveError(): string {
  return React.useSyncExternalStore(subscribe, () => saveError, () => '');
}

function failure(error: string, revision: number): UnitSaveResult {
  saveError = error;
  notify();
  return { ok: false, revision, error };
}

function persist(next: UnitsStore, revision: number): UnitSaveResult {
  if (typeof window === 'undefined')
    return failure('Units save once this product is open in a browser. Your values are still in the editor.', revision);
  try {
    window.localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return failure('Saving the unit change stalled in this browser. Your previous units stand; keep your values here and try again.', revision);
  }
  held = next;
  saveError = '';
  notify();
  return { ok: true, revision };
}

const blankProductRecord = (): ProductUnitRecord => ({ revision: 0, equivalences: [], aliases: [] });
const blankTenantRecord = (): TenantUnitRecord => ({ revision: 0, definitions: [], equivalences: [] });
const recordFor = (sector: SectorId | string, productId: string): ProductUnitRecord => held.products[keyOf(sector, productId)] ?? blankProductRecord();
const tenantRecordFor = (sector: SectorId | string): TenantUnitRecord => held.tenants[sector] ?? blankTenantRecord();

export const unitRevision = (sector: SectorId | string, productId: string): number => recordFor(sector, productId).revision;
export const tenantUnitRevision = (sector: SectorId | string): number => tenantRecordFor(sector).revision;
export const tenantUnitDefinitions = (sector: SectorId | string, includeRetired = false): UnitDefinition[] =>
  tenantRecordFor(sector).definitions.filter((definition) => includeRetired || definition.status === 'active');
export const tenantUnitEquivalences = (sector: SectorId | string): UnitEquivalence[] =>
  tenantRecordFor(sector).equivalences.map((row) => ({ ...row, scope: 'tenant' as const }));

export function unitDefinitionForLabel(sector: SectorId | string, label: string): UnitDefinition | undefined {
  const key = normal(label);
  return tenantUnitDefinitions(sector, true).find((definition) => normal(definition.label) === key);
}

function unitKindFor(sector: SectorId | string, label: string): UnitKind {
  return unitDefinitionForLabel(sector, label)?.kind ?? inferredUnitKind(label);
}

function knownProductUnit(sector: SectorId | string, product: Product, label: string): boolean {
  const wanted = normal(label);
  if (!wanted) return false;
  const known = unitEquivalences(sector, product).flatMap((row) => [row.unit, row.baseUnit]);
  return normal(product.unit) === wanted || known.some((value) => normal(value) === wanted) || !!unitDefinitionForLabel(sector, label);
}

function sameUnit(a: string, b: string): boolean { return normal(a) === normal(b); }
function sameUnitPair(a: Pick<UnitEquivalence, 'unit' | 'baseUnit'>, b: Pick<UnitEquivalence, 'unit' | 'baseUnit'>): boolean {
  return sameUnit(a.unit, b.unit) && sameUnit(a.baseUnit, b.baseUnit);
}
export function isExactEquivalence(row: UnitEquivalence): boolean {
  return (row.status ?? (row.approximate ? 'nominal' : 'exact')) === 'exact' && row.approximate !== true;
}

/** Legacy `Product.pack` input remains visible as non-calculating evidence. It is never upgraded to
 * an exact conversion or a reviewed Product override merely because an old fixture carried a
 * numeric factor. A separately saved tenant/Product rule for the same pair replaces this evidence. */
function legacyPackEquivalence(product: Product, own: UnitEquivalence[]): UnitEquivalence[] {
  const pack = product.pack;
  if (!pack || own.some((row) => sameUnitPair(row, { unit: pack.unit, baseUnit: product.unit }))) return [];
  const unit = text(pack.unit);
  const baseUnit = text(product.unit);
  const quantity = pack.unit === 'kg' && product.unit !== 'kg' ? 1 / pack.factor : pack.factor;
  if (!unit || !baseUnit || sameUnit(unit, baseUnit) || !Number.isFinite(quantity) || quantity <= 0) return [];
  const status: UnitEquivalenceStatus = 'nominal';
  return [{
    id: `legacy-pack:${product.id}`,
    unit,
    quantity,
    baseUnit,
    approximate: true,
    kind: inferredUnitKind(unit),
    status,
    source: 'legacy-pack',
    revision: 0,
  }];
}

export function unitEquivalences(sector: SectorId | string, product: Product): UnitEquivalence[] {
  const own = recordFor(sector, product.id).equivalences.map((row) => ({ ...row, scope: 'product' as const }));
  const defaults = tenantUnitEquivalences(sector).filter((row) => !own.some((override) => sameUnitPair(override, row)));
  const effective = [...defaults, ...own];
  return [...legacyPackEquivalence(product, effective), ...effective];
}

/** Product-sheet projection: global rules must touch this Product's Unit. Product overrides remain
 * visible as exact Product evidence even after its Unit changes. The conversion graph above keeps
 * every tenant rule so an explicitly requested multi-step calculation can still resolve. */
export function productUnitEquivalences(sector: SectorId | string, product: Product): UnitEquivalence[] {
  const current = normal(product.unit);
  return unitEquivalences(sector, product).filter((row) =>
    row.scope === 'product' || normal(row.unit) === current || normal(row.baseUnit) === current);
}

/** Albarán choices: the Product Unit plus units connected by an applicable conversion. */
export function unitChoices(sector: SectorId | string, product: Product): string[] {
  const seen = new Set<string>();
  return [product.unit, ...productUnitEquivalences(sector, product).flatMap((row) => [row.unit, row.baseUnit])]
    .map(text)
    .filter((label) => !!label && !seen.has(normal(label)) && !!seen.add(normal(label)));
}

/**
 * Compatibility factor used by the existing sale fold: direct, exact, and expressed in the
 * Product's Unit. Call `exactConversionFactor` when an explicit from/to pair is needed.
 */
export function unitFactor(sector: SectorId | string, product: Product, unit: string): number | null {
  return conversion(sector, product, unit, product.unit).factor;
}

export function describeUnit(sector: SectorId | string, product: Product, unit: string): UnitDescription {
  const label = text(unit);
  const definition = unitDefinitionForLabel(sector, label);
  if (definition) return { label: definition.label, kind: definition.kind, state: 'tenant' };
  const retained = [product.unit, ...unitEquivalences(sector, product).flatMap((row) => [row.unit, row.baseUnit])]
    .some((candidate) => sameUnit(candidate, label));
  return { label, kind: inferredUnitKind(label), state: retained ? 'retained' : 'unknown' };
}

/**
 * A UI can say why a factor is unavailable instead of calling all non-exact relationships
 * "unknown". Nominal/catch-weight values remain visible but intentionally have no factor.
 */
export function conversion(sector: SectorId | string, product: Product, fromUnit: string, toUnit = product.unit): UnitConversion {
  if (sameUnit(fromUnit, toUnit)) return { fromUnit, toUnit, state: 'same', factor: 1 };
  const direct = unitEquivalences(sector, product).find((row) => sameUnit(row.unit, fromUnit) && sameUnit(row.baseUnit, toUnit));
  if (direct) {
    const state = direct.status ?? (direct.approximate ? 'nominal' : 'exact');
    return {
      fromUnit,
      toUnit,
      state,
      factor: state === 'exact' && !direct.approximate ? direct.quantity : null,
      source: direct.source,
      ...(direct.evidence ? { evidence: direct.evidence } : {}),
    };
  }
  const factor = exactConversionFactor(sector, product, fromUnit, toUnit);
  return factor === null
    ? { fromUnit, toUnit, state: 'unknown', factor: null }
    : { fromUnit, toUnit, state: 'exact', factor };
}

/** Finds a path of recorded exact relationships. No nominal/catch-weight relationship participates. */
export function exactConversionFactor(sector: SectorId | string, product: Product, fromUnit: string, toUnit: string): number | null {
  if (sameUnit(fromUnit, toUnit)) return 1;
  const edges = new Map<string, Array<{ unit: string; factor: number }>>();
  for (const row of unitEquivalences(sector, product)) {
    if (!isExactEquivalence(row)) continue;
    const from = normal(row.unit);
    const to = normal(row.baseUnit);
    if (!from || !to || from === to || !Number.isFinite(row.quantity) || row.quantity <= 0) continue;
    const forward = edges.get(from) ?? [];
    forward.push({ unit: to, factor: row.quantity });
    edges.set(from, forward);
    const backward = edges.get(to) ?? [];
    backward.push({ unit: from, factor: 1 / row.quantity });
    edges.set(to, backward);
  }
  const wanted = normal(toUnit);
  const queue: Array<{ unit: string; factor: number }> = [{ unit: normal(fromUnit), factor: 1 }];
  const visited = new Set<string>();
  while (queue.length && visited.size < 24) {
    const current = queue.shift()!;
    if (visited.has(current.unit)) continue;
    if (current.unit === wanted) return current.factor;
    visited.add(current.unit);
    for (const edge of edges.get(current.unit) ?? []) {
      if (!visited.has(edge.unit)) queue.push({ unit: edge.unit, factor: current.factor * edge.factor });
    }
  }
  return null;
}

function replaceProductRecord(
  sector: SectorId | string,
  productId: string,
  expectedRevision: number | undefined,
  update: (record: ProductUnitRecord, nextRevision: number) => ProductUnitRecord,
): UnitSaveResult {
  const key = keyOf(sector, productId);
  const prior = recordFor(sector, productId);
  if (expectedRevision !== undefined && expectedRevision !== prior.revision)
    return failure('Units changed in another tab. Reopen this editor to review the latest values; your draft is still waiting to save.', prior.revision);
  const revision = prior.revision + 1;
  const nextRecord = update(prior, revision);
  const next: UnitsStore = {
    ...held,
    revision: held.revision + 1,
    products: { ...held.products, [key]: nextRecord },
  };
  return persist(next, revision);
}

/** Seed the single reviewed Unit on an accepted imported Product. The source word is evidence in
 * the import record; it does not create a second Product-unit role. */
export function seedImportedUnit(
  sector: SectorId | string,
  product: Product,
): UnitSaveResult {
  const unit = text(product.unit);
  if (!unit || unitDefinitionForLabel(sector, unit)) return { ok: true, revision: tenantUnitRevision(sector) };
  return saveTenantUnit(sector, {
    label: unit,
    kind: inferredUnitKind(unit),
    precision: normal(unit) === 'kg' ? 3 : 0,
  });
}

export function saveTenantUnitEquivalence(
  sector: SectorId | string,
  draft: UnitEquivalenceDraft,
  expectedRevision?: number,
): UnitSaveResult {
  const unit = text(draft.unit);
  const baseUnit = text(draft.baseUnit);
  const prior = tenantRecordFor(sector);
  if (!unit || !baseUnit || sameUnit(unit, baseUnit) || !Number.isFinite(draft.quantity) || draft.quantity <= 0)
    return failure('Give two different units and a quantity greater than zero.', prior.revision);
  if (!unitDefinitionForLabel(sector, unit) || !unitDefinitionForLabel(sector, baseUnit))
    return failure('Add both units to the shared unit list before recording a default conversion.', prior.revision);
  if (expectedRevision !== undefined && expectedRevision !== prior.revision)
    return failure('Shared unit rules changed in another tab. Reopen this editor to review the latest values; your draft is still waiting to save.', prior.revision);
  const revision = prior.revision + 1;
  const equivalence: UnitEquivalence = {
    id: prior.equivalences.find((row) => sameUnitPair(row, { unit, baseUnit }))?.id ?? makeId('tenant-unit-equivalence'),
    unit,
    quantity: draft.quantity,
    baseUnit,
    ...(draft.status === 'exact' ? {} : { approximate: true }),
    kind: unitKindFor(sector, unit),
    status: draft.status,
    source: 'tenant',
    scope: 'tenant',
    ...(text(draft.evidence) ? { evidence: text(draft.evidence) } : {}),
    revision,
  };
  const next: UnitsStore = {
    ...held,
    revision: held.revision + 1,
    tenants: {
      ...held.tenants,
      [sector]: {
        ...prior,
        revision,
        equivalences: [...prior.equivalences.filter((row) => !sameUnitPair(row, { unit, baseUnit })), equivalence],
      },
    },
  };
  return persist(next, revision);
}

/** SKU rules override a shared rule for the same unit pair on this Product only. */
export function saveUnitEquivalence(
  sector: SectorId | string,
  product: Product,
  draft: UnitEquivalenceDraft,
  expectedRevision?: number,
): UnitSaveResult {
  const unit = text(draft.unit);
  const baseUnit = text(draft.baseUnit);
  if (!unit || !baseUnit || sameUnit(unit, baseUnit) || !Number.isFinite(draft.quantity) || draft.quantity <= 0)
    return failure('Give two different units and a quantity greater than zero.', unitRevision(sector, product.id));
  if (!knownProductUnit(sector, product, unit) || !knownProductUnit(sector, product, baseUnit))
    return failure('Add both units to this tenant’s unit list before recording a conversion.', unitRevision(sector, product.id));
  return replaceProductRecord(sector, product.id, expectedRevision, (prior, revision) => {
    const equivalence: UnitEquivalence = {
      id: prior.equivalences.find((row) => sameUnitPair(row, { unit, baseUnit }))?.id ?? makeId('unit-equivalence'),
      unit,
      quantity: draft.quantity,
      baseUnit,
      ...(draft.status === 'exact' ? {} : { approximate: true }),
      kind: unitKindFor(sector, unit),
      status: draft.status,
      source: 'tenant',
      scope: 'product',
      ...(text(draft.evidence) ? { evidence: text(draft.evidence) } : {}),
      revision,
    };
    return {
      ...prior,
      revision,
      equivalences: [...prior.equivalences.filter((row) => !sameUnitPair(row, { unit, baseUnit })), equivalence],
    };
  });
}

/** Legacy API retained for the existing sales code. New UI calls `saveUnitEquivalence` with a SKU. */
export function setUnitEquivalence(
  sector: SectorId | string,
  productId: string,
  unit: string,
  quantity: number,
  baseUnit: string,
  approximate = false,
  options?: { expectedRevision?: number; status?: UnitEquivalenceStatus; evidence?: string },
): UnitSaveResult {
  const label = text(unit);
  const base = text(baseUnit);
  if (!label || !base || sameUnit(label, base) || !Number.isFinite(quantity) || quantity <= 0)
    return failure('Give two different units and a quantity greater than zero.', unitRevision(sector, productId));
  const status = options?.status ?? (approximate ? 'nominal' : 'exact');
  return replaceProductRecord(sector, productId, options?.expectedRevision, (prior, revision) => ({
    ...prior,
    revision,
    equivalences: [
      ...prior.equivalences.filter((row) => !sameUnit(row.unit, label)),
      {
        id: prior.equivalences.find((row) => sameUnit(row.unit, label))?.id ?? makeId('unit-equivalence'),
        unit: label,
        quantity,
        baseUnit: base,
        ...(status === 'exact' ? {} : { approximate: true }),
        kind: unitKindFor(sector, label),
        status,
        source: 'tenant',
        scope: 'product',
        ...(text(options?.evidence) ? { evidence: text(options?.evidence) } : {}),
        revision,
      },
    ],
  }));
}

/** Named command seam for a reviewed unit declaration. It never manufactures a conversion. */
export function declareUnit(
  sector: SectorId | string,
  product: Product,
  draft: UnitEquivalenceDraft,
  expectedRevision?: number,
): UnitSaveResult {
  return saveUnitEquivalence(sector, product, draft, expectedRevision);
}

export function setCustomerUnitAlias(
  sector: SectorId | string,
  product: Product,
  draft: Omit<CustomerUnitAlias, 'id' | 'revision'>,
  expectedRevision?: number,
): UnitSaveResult {
  const phrase = text(draft.phrase);
  const unit = text(draft.unit);
  const customerId = text(draft.customerId);
  if (!phrase || !unit || !customerId) return failure('Choose a customer, their wording, and the unit it means.', unitRevision(sector, product.id));
  if (!knownProductUnit(sector, product, unit))
    return failure(`Add ${unit} to this product’s allowed units before saving a customer alias.`, unitRevision(sector, product.id));
  return replaceProductRecord(sector, product.id, expectedRevision, (prior, revision) => {
    const existing = prior.aliases.find((alias) => alias.customerId === customerId && normal(alias.phrase) === normal(phrase));
    const alias: CustomerUnitAlias = { id: existing?.id ?? makeId('unit-alias'), customerId, phrase, unit, revision };
    return {
      ...prior,
      revision,
      aliases: [...prior.aliases.filter((row) => row.id !== alias.id), alias],
    };
  });
}

export const customerUnitAliases = (sector: SectorId | string, productId: string, customerId?: string): CustomerUnitAlias[] =>
  recordFor(sector, productId).aliases.filter((alias) => !customerId || alias.customerId === customerId);

export function saveTenantUnit(
  sector: SectorId | string,
  draft: Omit<UnitDefinition, 'id' | 'revision' | 'status'> & { id?: string; status?: UnitDefinition['status'] },
  expectedRevision?: number,
): UnitSaveResult {
  const label = text(draft.label);
  const precision = draft.precision;
  if (!label) return failure('Give the unit a name before saving.', tenantUnitRevision(sector));
  if (!Number.isInteger(precision) || precision < 0 || precision > 6)
    return failure('Use a precision from 0 to 6 decimal places.', tenantUnitRevision(sector));
  const prior = tenantRecordFor(sector);
  if (expectedRevision !== undefined && expectedRevision !== prior.revision)
    return failure('The tenant unit list changed in another tab. Reopen this editor to review it; your draft is still waiting to save.', prior.revision);
  const same = prior.definitions.find((definition) => normal(definition.label) === normal(label) && definition.id !== draft.id);
  if (same) return failure(`${same.label} is already in this tenant’s unit list.`, prior.revision);
  const revision = prior.revision + 1;
  const id = text(draft.id) || makeId('tenant-unit');
  const definition: UnitDefinition = {
    id,
    label,
    ...(text(draft.plural) ? { plural: text(draft.plural) } : {}),
    kind: asKind(draft.kind) === 'custom' ? 'custom' : asKind(draft.kind),
    precision,
    status: draft.status === 'retired' ? 'retired' : 'active',
    revision,
  };
  const next: UnitsStore = {
    ...held,
    revision: held.revision + 1,
    tenants: {
      ...held.tenants,
      [sector]: {
        ...prior,
        revision,
        definitions: [...prior.definitions.filter((row) => row.id !== id), definition],
      },
    },
  };
  return persist(next, revision);
}

export function retireTenantUnit(sector: SectorId | string, id: string, expectedRevision?: number): UnitSaveResult {
  const prior = tenantRecordFor(sector);
  if (expectedRevision !== undefined && expectedRevision !== prior.revision)
    return failure('The tenant unit list changed in another tab. Reopen this editor to review it; your draft is still waiting to save.', prior.revision);
  const found = prior.definitions.find((definition) => definition.id === id);
  if (!found) return failure('That tenant unit has left the list.', prior.revision);
  const revision = prior.revision + 1;
  const next: UnitsStore = {
    ...held,
    revision: held.revision + 1,
    tenants: {
      ...held.tenants,
      [sector]: {
        ...prior,
        revision,
        definitions: prior.definitions.map((definition) => definition.id === id ? { ...definition, status: 'retired', revision } : definition),
      },
    },
  };
  return persist(next, revision);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== UNITS_STORAGE_KEY) return;
    const next = decode(event.newValue);
    if (!next) {
      saveError = 'Reading a unit change from another tab stalled. Your saved units stand as they are; reload before editing again.';
      notify();
      return;
    }
    held = next;
    saveError = '';
    notify();
  });
}
