import { seedSoles } from './currency';

export const CEDAR_CONFIG_PEN_VERSION = 4;
export const CEDAR_DAY_PEN_VERSION = 2;
export const CEDAR_TIERS_PEN_VERSION = 2;
export const CEDAR_GRANTS_PEN_VERSION = 2;
export const CEDAR_CATALOGUE_PEN_VERSION = 1;
export const CEDAR_PRINT_JOURNAL_PEN_VERSION = 2;
export const CEDAR_COMPANY_PEN_VERSION = 3;

const recordOf = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Convert the one amount owned by config while preserving every unrelated setup answer. */
export function migrateConfigCurrency(raw: unknown): unknown {
  if (!recordOf(raw)) return raw;
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version >= CEDAR_CONFIG_PEN_VERSION || !recordOf(raw.gate)) return raw;
  const threshold = Number(raw.gate.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0) return raw;
  return { ...raw, gate: { ...raw.gate, threshold: seedSoles(threshold) } };
}

const migrateEvent = (value: unknown): unknown => {
  if (!recordOf(value)) return value;
  if ((value.kind === 'line' || value.kind === 'add')
      && typeof value.price === 'number' && Number.isFinite(value.price)) {
    return { ...value, price: seedSoles(value.price) };
  }
  if (value.kind === 'print' && recordOf(value.prices)) {
    return {
      ...value,
      prices: Object.fromEntries(Object.entries(value.prices).map(([line, price]) => [
        line,
        typeof price === 'number' && Number.isFinite(price) ? seedSoles(price) : price,
      ])),
    };
  }
  return value;
};

/**
 * Upgrade the day ledger as one localStorage value. Version 1 had three monetary leaves:
 * line.price, add.price and the immutable prices captured by print. Quantities, unit factors,
 * percentages, provider evidence and every other event field retain their original values.
 */
export function migrateDayCurrency(raw: unknown): unknown {
  if (!recordOf(raw) || raw.version !== 1 || !recordOf(raw.sectors)) return raw;
  const sectors = Object.fromEntries(Object.entries(raw.sectors).map(([sector, value]) => {
    if (!recordOf(value) || !Array.isArray(value.events)) return [sector, value];
    return [sector, { ...value, events: value.events.map(migrateEvent) }];
  }));
  return { ...raw, version: CEDAR_DAY_PEN_VERSION, sectors };
}

/** Price-stamp logs are the only absolute money in the tariff store; offsets are percentages. */
export function migrateTiersCurrency(raw: unknown): unknown {
  if (!recordOf(raw) || raw.version !== 1 || !Array.isArray(raw.log)) return raw;
  return {
    ...raw,
    version: CEDAR_TIERS_PEN_VERSION,
    log: raw.log.map((stamp) => recordOf(stamp)
      && typeof stamp.price === 'number' && Number.isFinite(stamp.price)
      ? { ...stamp, price: seedSoles(stamp.price) }
      : stamp),
  };
}

/** The grant store has one monetary value; all other numbers are counts, days or minutes. */
export function migrateGrantsCurrency(raw: unknown): unknown {
  if (!recordOf(raw) || raw.version !== 1) return raw;
  return {
    ...raw,
    version: CEDAR_GRANTS_PEN_VERSION,
    ...(typeof raw.ceiling === 'number' && Number.isFinite(raw.ceiling)
      ? { ceiling: seedSoles(raw.ceiling) }
      : {}),
  };
}

/** Sparse import rows may retain one source price while their unit is awaiting review. */
export function migrateCatalogueCurrency(raw: unknown): unknown {
  if (!recordOf(raw)) return raw;
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version >= CEDAR_CATALOGUE_PEN_VERSION) return raw;
  return {
    ...raw,
    version: CEDAR_CATALOGUE_PEN_VERSION,
    minted: Array.isArray(raw.minted) ? raw.minted.map((item) => recordOf(item)
      && typeof item.pendingPrice === 'number' && Number.isFinite(item.pendingPrice)
      ? { ...item, pendingPrice: seedSoles(item.pendingPrice) }
      : item) : raw.minted,
  };
}

/** Recoverable print attempts retain the exact generated line-price snapshot. */
export function migratePrintJournalCurrency(raw: unknown): unknown {
  if (!recordOf(raw) || raw.version !== 1 || !Array.isArray(raw.jobs)) return raw;
  return {
    ...raw,
    version: CEDAR_PRINT_JOURNAL_PEN_VERSION,
    jobs: raw.jobs.map((job) => {
      if (!recordOf(job) || !recordOf(job.saleSnapshot) || !recordOf(job.saleSnapshot.prices)) return job;
      return {
        ...job,
        saleSnapshot: {
          ...job.saleSnapshot,
          prices: Object.fromEntries(Object.entries(job.saleSnapshot.prices).map(([line, price]) => [
            line,
            typeof price === 'number' && Number.isFinite(price) ? seedSoles(price) : price,
          ])),
        },
      };
    }),
  };
}

/** Delivery-zone minimums and free-carriage thresholds are trading money; plan rates stay EUR. */
export function migrateCompanyCurrency(raw: unknown): unknown {
  if (!recordOf(raw)) return raw;
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version >= CEDAR_COMPANY_PEN_VERSION || !Array.isArray(raw.zones)) return raw;
  return {
    ...raw,
    version: CEDAR_COMPANY_PEN_VERSION,
    zones: raw.zones.map((zone) => {
      if (!recordOf(zone)) return zone;
      return {
        ...zone,
        ...(typeof zone.minimum === 'number' && Number.isFinite(zone.minimum)
          ? { minimum: seedSoles(zone.minimum) }
          : {}),
        ...(typeof zone.carriage === 'number' && Number.isFinite(zone.carriage)
          ? { carriage: seedSoles(zone.carriage) }
          : {}),
      };
    }),
  };
}
