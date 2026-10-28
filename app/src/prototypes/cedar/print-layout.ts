import type { Sale } from './sale';

export type PackingSort = 'route' | 'customer' | 'order-value' | 'lifetime-value';
export type PackingColumns = 1 | 2;

/* ── THE TWO PAPER MEMBERS (THE-OUTPUTS-SPEC OUT-01.3) ────────────────────────────────────────
 * E200 moved these two records off the house and onto the TEMPLATE, and the move changed none of
 * their members: `TemplateLayout`'s `albaran` and `packing` arms (`output-templates.ts`) are these
 * two types, so the renderer and the template read one vocabulary. The profile below stays as what
 * a captured print carries — one frozen record per attempt, both members present, so an attempt
 * reprinted later draws the paper it drew then.
 */
export type AlbaranFields = { finalWeight: boolean; unitPrice: boolean; lineTotal: boolean };
export type PackingLayout = { columns: PackingColumns; groupByTruck: true; sort: PackingSort; lifetimeValues?: Record<string, number> };

/** The renderer's frozen profile. Captured runs carry a copy rather than rereading anything. */
export type PrintLayoutProfile = {
  version: 1;
  albaran: AlbaranFields;
  packing: PackingLayout;
};

export const PRINT_LAYOUT_DEFAULTS: PrintLayoutProfile = {
  version: 1,
  albaran: { finalWeight: false, unitPrice: false, lineTotal: true },
  packing: { columns: 1, groupByTruck: true, sort: 'route' },
};

const keyFor = (sector: string) => `rocoto-print-layout-v1:${sector}`;
const isSort = (value: unknown): value is PackingSort =>
  value === 'route' || value === 'customer' || value === 'order-value' || value === 'lifetime-value';

export const parsePrintLayout = (raw: unknown): PrintLayoutProfile => {
  if (!raw || typeof raw !== 'object') return PRINT_LAYOUT_DEFAULTS;
  const value = raw as Record<string, unknown>;
  const albaran = value.albaran && typeof value.albaran === 'object' ? value.albaran as Record<string, unknown> : {};
  const packing = value.packing && typeof value.packing === 'object' ? value.packing as Record<string, unknown> : {};
  return {
    version: 1,
    albaran: {
      finalWeight: albaran.finalWeight === true,
      unitPrice: albaran.unitPrice === true,
      lineTotal: albaran.lineTotal !== false,
    },
    packing: {
      // Older saved preferences predate the second column and stay readable as one column.
      // Reject unsupported future shapes until a renderer exists for them.
      columns: packing.columns === 2 ? 2 : 1,
      groupByTruck: true,
      sort: isSort(packing.sort) ? packing.sort : 'route',
    },
  };
};

/* ── THE RETIRING KEY (THE-OUTPUTS-SPEC OUT-01.8) ─────────────────────────────────────────────
 * `rocoto-print-layout-v1:<sector>` was the house-wide profile every print read. E200 gives every
 * template its own layout, so the key has one reader left: the migration in `output-templates.ts`,
 * which folds a stored profile into the templates of the matching category and then puts the key
 * away. `savePrintLayout` is gone with it — it was imported once and called nowhere.
 */
export const readLegacyPrintLayout = (sector: string): PrintLayoutProfile | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(sector));
    return raw ? parsePrintLayout(JSON.parse(raw)) : null;
  } catch { return null; }
};

/** Idempotent: a key already away stays away, and a storage that refuses is left as it stands. */
export const clearLegacyPrintLayout = (sector: string): void => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(keyFor(sector)); } catch { /* the key stays; the read is fail-soft */ }
};

/** Lifetime value is calculated from the supplied, captured sale history; no customer profile is inferred. */
export const withLifetimeValues = (profile: PrintLayoutProfile, sales: Sale[]): PrintLayoutProfile => {
  if (profile.packing.sort !== 'lifetime-value') return profile;
  const lifetimeValues = sales.reduce<Record<string, number>>((totals, sale) => {
    totals[sale.customer.id] = (totals[sale.customer.id] ?? 0) + sale.figure;
    return totals;
  }, {});
  return { ...profile, packing: { ...profile.packing, lifetimeValues } };
};
