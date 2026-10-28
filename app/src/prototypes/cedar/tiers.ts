/* THE TARIFAS — the tier registry, the sheet, the relationships, and the log every price lands in.
 *
 * ═══ WHY THIS FILE EXISTS (THE-DENSE-BRIEF §A.11, DESIGN §2) ════════════════════════════════
 * «Tiers configure in Stock; customers associate to tiers; the albarán can switch tier on the fly;
 * tiers can change per SKU per day… every change stamps a HISTORY.» That is one ORGAN, not a
 * component: it runs from Stock's configuration through the customer to the albarán and back into
 * a timeline. So the data has one home, and every surface reads it from here.
 *
 * ═══ ONE TIER MEANS THE WORD DISAPPEARS ════════════════════════════════════════════════════
 * `tiersOfHouse` returning a single tier is the whole of a single-tier house: the surfaces ask this
 * file how many bands there are and draw a FACT rather than a dropdown. Nothing here is a mode —
 * the fractal unfolds because the house has a second tarifa, not because somebody flipped a switch.
 *
 * ═══ AND ONE TIER IS A NAMED THING, NEVER AN ABSENCE (FEED-IA §75.4 · THE-OBJECT-MAP C4) ═════
 * «Let them enable that they have tariffs for all, super easily tweak them even on their phone,
 * and set a GLOBAL SINGLE TARIFF.» A global single tariff is a THING: it has a name the house can
 * write, the product sheet writes prices INTO it, and the settings row states it. So this file
 * seeds one and `tiersOfHouse` can never answer with nothing — a house whose cast carries no bands
 * at all still stands on `SEED_TIER`, because every read below (`bandOf`, `priceOf`, the sheet)
 * indexes `[0]` and an empty registry is a crash disguised as a data question.
 *
 * WHAT DOES NOT CHANGE: a single-priced product's sheet still shows ONE PLAIN PRICE. The tarifa is
 * named in the SETTING (admin/operations); it is not vocabulary the product page makes a person
 * read. `isMultiTier` is still the one question every price surface asks.
 *
 * ═══ WHY A STORE AND NOT THE CONFIG ════════════════════════════════════════════════════════
 * `sale.ts` has to price an albarán and it is not a component, so the tarifas take the shape
 * `grants.ts` and `rules.ts` already took for the same reason: a module singleton, persisted,
 * published through `useSyncExternalStore`. `tiersNow()` is what the fold reads; `useTiers()` is
 * what a component reads so it re-renders on the write.
 *
 * ═══ THE LOG IS THE TRUTH, AND IT IS APPEND-ONLY ═══════════════════════════════════════════
 * Every price written at every level appends a `PriceStamp` — day, tier, price, hour, and whose
 * hand it was. An edit SUPERSEDES its predecessor and the predecessor stays readable underneath,
 * which is the law `price-accordion/types.ts` already states for `PriceLogEntry`. `priceHistoryOf`
 * is the seam the product card reads its timeline from.
 *
 * ═══ THE BASE IS THE HOUSE'S OWN ARITHMETIC ════════════════════════════════════════════════
 * A tarifa nobody has touched is not blank: it is `margin-desk`'s own `listPrice` — the cost this
 * house actually paid, carried up by the list margin, stepped down by the tier. So the sheet here
 * and the price on the Stock card are the same number by construction, and no price is typed into
 * a screen to make a screenshot look right.
 */
import * as React from 'react';
import { CASTS, VARIATION_PRICES, type Cast, type Customer, type Product } from '../../scenarios/data/cast';
import { listPrice, tiersOf } from '../../scenarios/canonical/margin-desk';
import { cedarCast } from './cedar-cast';
import { CEDAR_TIERS_PEN_VERSION, migrateTiersCurrency } from './currency-migration';

/* ── THE OBJECTS ──────────────────────────────────────────────────────────────────────────── */

/** One band the house sells at. A tarifa is a NAME and a set of prices; it owns no customers —
 *  the customers point at it, which is what lets a customer move without a tarifa being rewritten. */
export type Tier = { id: string; name: string };

/** The same band with the size of it, for the registry row that states its customer count. */
export type TierWithCount = Tier & { customers: number };

/** Whose hand set a price. Rocoto's own entries are the only ones that carry the accent. */
export type PriceAuthor = 'hand' | 'rule' | 'rocoto';

/** ONE PRICE, WRITTEN. Entries are appended, never overwritten: today's price supersedes
 *  yesterday's and yesterday's stays readable under it. */
export type PriceStamp = {
  id: string;
  /** `Product.id` */
  product: string;
  /** `Tier.id`, or ONE CUSTOMER'S OWN BAND — `customer:<Customer.id>` (§16.2, see `customerKey`) */
  tier: string;
  /** the day this price was set FOR — sortable, the river's own key */
  day: string;
  price: number;
  /** the hour it was written */
  at: string;
  author: PriceAuthor;
};

/** A temporary account-wide reduction. It is an agreement object with its own schedule and release
 * trail; it never rewrites tariff prices or SKU overrides. The resolved sale price applies the
 * active agreement last, so ending it reveals the exact underlying price that was there before. */
export type CustomerDiscount = {
  id: string;
  customer: string;
  percent: number;
  startsOn: string;
  endsOn: string;
  createdOn: string;
  createdAt: string;
  releasedOn?: string;
  releasedAt?: string;
};

/** THE RELATIONSHIP, WHICH IS THE THING BEING EDITED IN PERCENTAGE MODE. One tier is the anchor
 *  and holds the only typed price; every other tier is a percentage away from it and computes. */
export type Relationship = {
  /** `Tier.id` of the anchor — the one price that is ink */
  anchor: string;
  /** tier id → percentage points from the anchor */
  offsets: Record<string, number>;
};

export type TiersState = {
  version: number;
  /** Highest allocated numeric ID, including retired unpriced tariffs. IDs never get reused. */
  lastTierNumber: number;
  /** the house's own bands. `null` means nobody has named them and the cast's own stand. */
  registry: Tier[] | null;
  /** customer id → tier id, where a hand moved somebody off their standing band */
  customers: Record<string, string>;
  /** every price ever written here, oldest first */
  log: PriceStamp[];
  /** scheduled and released customer discounts, oldest first */
  discounts: CustomerDiscount[];
  /** product id → the tarifas move together (one price serves them all) */
  chain: Record<string, boolean>;
  /** product id → the anchored relationship, where percentage mode saved one */
  anchored: Record<string, Relationship>;
};

export const TIERS_VERSION = CEDAR_TIERS_PEN_VERSION;

/* ── THE VARIATIONS ARRIVE PRICED (FEED-IA §127.4c) ───────────────────────────────────────────
 * «The price changes per variation.» A member reads `writtenOn(member, band, day)` and falls back
 * to its family's number, so a house where nobody has ever typed a member price shows one figure
 * three times — which is the whole of the defect S10 named.
 *
 * SO THE HOUSE STANDS ON A SHEET IT DID NOT TYPE, exactly as it already does for its bands. A band
 * nobody has touched is not blank — it is `margin-desk`'s own arithmetic — and this is that same
 * idea one level in: a MEMBER nobody has touched stands on its family's number carried by the
 * trade's own ratio.
 *
 * AND IT IS A FLOOR, NOT A LOG ENTRY, WHICH IS THE WHOLE OF THE SHAPE. The first cut of this put
 * the seed INTO the append-only log, and that was wrong for a reason a drive found within the
 * hour: the log is «what a hand wrote», several surfaces COUNT it, and thirty-six house-written
 * stamps made «the pasted rates are the rates that landed» read thirty-nine numbers. A standing
 * sheet is not a history. So it lives beside the log and is consulted only where the log is
 * silent — every counter, every timeline and every Undo sees exactly what it saw before, and a
 * hand's first write on a member supersedes the floor the way it always has.
 *
 * THE NUMBER IS DERIVED, NEVER TYPED. `VARIATION_PRICES` holds the trade's RATIO and this is where
 * it meets the house's own arithmetic — `listPrice` on the base form, at that band's own step. So a
 * supplier's cost moving carries every variation with it, and no figure in this file was chosen to
 * make a screenshot look right.
 */
const variationFloor = (): Map<string, number> => {
  const out = new Map<string, number>();
  for (const v of VARIATION_PRICES) {
    const cast = cedarCast(CASTS[v.sector]);
    const base = cast.products.find((p) => p.id === v.base);
    if (!base) continue;
    tiersOf(cast).forEach((t, at) => {
      out.set(`${v.member}:${t.id}`, Math.round(listPrice(cast, base, at) * v.of * 100) / 100);
    });
  }
  return out;
};

const VARIATION_FLOOR = variationFloor();

/** What the house's own sheet says this member costs on this band, or null where it is not a
 *  member the trade has a ratio for. Read only where the log is silent. */
export const variationPriceOf = (product: string, tierId: string): number | null =>
  VARIATION_FLOOR.get(`${product}:${tierId}`) ?? null;

export const TIERS_DEFAULTS: TiersState = {
  version: TIERS_VERSION,
  lastTierNumber: 0,
  registry: null,
  customers: {},
  log: [],
  discounts: [],
  chain: {},
  anchored: {},
};

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────── */

export const TIERS_STORAGE_KEY = 'rocoto-app-tiers';

const isTier = (t: unknown): t is Tier =>
  Boolean(t) && typeof t === 'object'
  && typeof (t as Tier).id === 'string' && typeof (t as Tier).name === 'string';

const tierNumber = (id: string): number => /^tier \d+$/.test(id) ? Number(id.slice(5)) : 0;
const highestTierNumber = (ids: string[]): number => ids.reduce((highest, id) => Math.max(highest, tierNumber(id)), 0);

const isStamp = (s: unknown): s is PriceStamp => {
  if (!s || typeof s !== 'object') return false;
  const e = s as PriceStamp;
  return typeof e.id === 'string' && typeof e.product === 'string' && typeof e.tier === 'string'
    && typeof e.day === 'string' && typeof e.price === 'number' && typeof e.at === 'string';
};

const isDiscount = (value: unknown): value is CustomerDiscount => {
  if (!value || typeof value !== 'object') return false;
  const discount = value as CustomerDiscount;
  return typeof discount.id === 'string'
    && typeof discount.customer === 'string'
    && Number.isFinite(discount.percent) && discount.percent > 0 && discount.percent < 100
    && typeof discount.startsOn === 'string' && typeof discount.endsOn === 'string'
    && discount.startsOn <= discount.endsOn
    && typeof discount.createdOn === 'string' && typeof discount.createdAt === 'string'
    && (discount.releasedOn === undefined || typeof discount.releasedOn === 'string')
    && (discount.releasedAt === undefined || typeof discount.releasedAt === 'string');
};

/** Read stored tarifas back into the shape this build knows. A field that fails its own validator
 *  takes the default and the rest are kept, so one new field never throws away a house's sheet. */
export function parseTiers(raw: unknown): TiersState {
  if (!raw || typeof raw !== 'object') return TIERS_DEFAULTS;
  const r = migrateTiersCurrency(raw) as Record<string, unknown>;
  if (r.version !== TIERS_VERSION) return TIERS_DEFAULTS;
  const registry = Array.isArray(r.registry) && r.registry.every(isTier) ? (r.registry as Tier[]) : null;
  const log = Array.isArray(r.log) ? (r.log.filter(isStamp) as PriceStamp[]) : [];
  const discounts = Array.isArray(r.discounts) ? (r.discounts.filter(isDiscount) as CustomerDiscount[]) : [];
  const record = (v: unknown): Record<string, string> =>
    v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === 'string'),
        ) as Record<string, string>
      : {};
  const flags = (v: unknown): Record<string, boolean> =>
    v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === 'boolean'),
        ) as Record<string, boolean>
      : {};
  const anchored = (v: unknown): Record<string, Relationship> => {
    if (!v || typeof v !== 'object') return {};
    const out: Record<string, Relationship> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const rel = x as Relationship;
      if (rel && typeof rel === 'object' && typeof rel.anchor === 'string' && rel.offsets) {
        out[k] = { anchor: rel.anchor, offsets: { ...rel.offsets } };
      }
    }
    return out;
  };
  return {
    version: TIERS_VERSION,
    lastTierNumber: Math.max(
      Number.isSafeInteger(r.lastTierNumber) ? Number(r.lastTierNumber) : 0,
      highestTierNumber([...(registry ?? []).map((tier) => tier.id), ...log.map((stamp) => stamp.tier)]),
    ),
    registry: registry && registry.length > 0 ? registry : null,
    customers: record(r.customers),
    log,
    discounts,
    chain: flags(r.chain),
    anchored: anchored(r.anchored),
  };
}

export const tiersStorageKey = (scope: string): string => `${TIERS_STORAGE_KEY}:${scope || 'default'}`;

/** Browser Kit scope. Production supplies the authenticated tenant at the repository boundary. */
function activeScope(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem('rocoto-app-config') ?? 'null');
    if (raw && typeof raw === 'object') {
      const cast = (raw as Record<string, unknown>).cast;
      if (typeof cast === 'string' && cast.trim()) return cast.trim();
    }
  } catch {
    /* A broken selector never permits reading another house's tariff key. */
  }
  return 'fish';
}

function read(scope: string): TiersState {
  try {
    const key = tiersStorageKey(scope);
    const scoped = window.localStorage.getItem(key);
    if (scoped) {
      const source: unknown = JSON.parse(scoped);
      const migrated = migrateTiersCurrency(source);
      const parsed = parseTiers(migrated);
      if (migrated !== source) {
        try {
          window.localStorage.setItem(key, JSON.stringify(parsed));
        } catch (error) {
          console.warn('Rocoto will retry the tariff currency upgrade on the next boot', error);
        }
      }
      return parsed;
    }
    /* One-way compatibility migration: the first standing house may claim the old singleton.
       Removing it immediately prevents a later house from inheriting the same customer IDs. */
    const legacy = window.localStorage.getItem(TIERS_STORAGE_KEY);
    if (legacy) {
      const parsed = parseTiers(migrateTiersCurrency(JSON.parse(legacy)));
      try {
        window.localStorage.setItem(key, JSON.stringify(parsed));
        window.localStorage.removeItem(TIERS_STORAGE_KEY);
      } catch (error) {
        console.warn('Rocoto will retry the scoped tariff upgrade on the next boot', error);
      }
      return parsed;
    }
    return TIERS_DEFAULTS;
  } catch {
    return TIERS_DEFAULTS;
  }
}

let currentScope = typeof window === 'undefined' ? 'default' : activeScope();
let TIERS: TiersState = typeof window === 'undefined' ? TIERS_DEFAULTS : read(currentScope);
const listeners = new Set<() => void>();
let saveError = '';

function ensureScope(scope: string = activeScope()): TiersState {
  if (scope !== currentScope) {
    currentScope = scope;
    TIERS = typeof window === 'undefined' ? TIERS_DEFAULTS : read(scope);
  }
  return TIERS;
}

function publish(next: TiersState, scope: string = activeScope()): boolean {
  ensureScope(scope);
  try {
    window.localStorage.setItem(tiersStorageKey(scope), JSON.stringify(next));
  } catch {
    saveError = 'Saving the price change stalled in this browser. Your saved prices stand as they are. Keep your values here and try again.';
    for (const l of listeners) l();
    return false;
  }
  TIERS = next;
  saveError = '';
  for (const l of listeners) l();
  return true;
}

export const usePriceSaveError = (): string => React.useSyncExternalStore(subscribe, () => saveError, () => '');

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/* A cross-tab write may refresh only the matching active house. Other houses read their own key
   when selected; a storage event is never permission to switch tenant context. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    const prefix = `${TIERS_STORAGE_KEY}:`;
    if (!e.key?.startsWith(prefix) || e.newValue === null) return;
    const scope = e.key.slice(prefix.length);
    if (!scope || scope !== activeScope()) return;
    try {
      currentScope = scope;
      TIERS = parseTiers(JSON.parse(e.newValue));
    } catch {
      return;
    }
    for (const l of listeners) l();
  });
}

/** WHAT THE OBJECT LAYER READS. `sale.ts` calls this inside the fold, so a tarifa written on Stock
 *  is in force on the albarán in the same breath. */
export const tiersNow = (scope: string = activeScope()): TiersState => ensureScope(scope);

const snapshot = (): TiersState => tiersNow();

/** The hook every component reads, so a price written on one surface re-renders the others. */
export const useTiers = (): TiersState =>
  React.useSyncExternalStore(subscribe, snapshot, () => TIERS_DEFAULTS);

/** Back to this house's own bands, with nothing remembered. */
export function resetTiers(scope: string = activeScope()): boolean {
  ensureScope(scope);
  return publish(TIERS_DEFAULTS, scope);
}

/* ── THE REGISTRY ─────────────────────────────────────────────────────────────────────────────
 * A tarifa is a house object. Creating or renaming one is rare and consequential, so it keeps its
 * words (FEED-IA §30) and lives in Stock — never on a product, and never inside an albarán.
 */

/** «tier 2» → «Tarifa 2». The cast holds bands; the house calls them tarifas. */
export const tarifaName = (id: string): string =>
  /^tier \d+$/.test(id) ? `Tarifa ${id.slice(5)}` : id;

/** THE ONE TARIFA EVERY HOUSE HAS (§75.4 · C4). A house that has never touched this screen and a
 *  house that cut its sheet down to one both stand HERE: a named band, editable, that the product
 *  sheet writes into. It is the seed, not a fallback — «never an absence». */
export const SEED_TIER: Tier = { id: 'tier 1', name: 'Tarifa 1' };

/** THE HOUSE'S BANDS. The registry once somebody has named them; the cast's own distinct bands
 *  before that; and the seed where the cast carries none — so the answer is never empty and every
 *  reader below can index it. */
export function tiersOfHouse(cast: Cast): Tier[] {
  const own = tiersNow(cast.sector).registry;
  if (own && own.length > 0) return own;
  const seeded = tiersOf(cast).map((t) => ({ id: t.id, name: tarifaName(t.name) }));
  return seeded.length > 0 ? seeded : [SEED_TIER];
}

/** THE ONE TARIFA, WHERE THERE IS ONE. The settings row names it, and the sheet writes into it. */
export const soleTier = (cast: Cast): Tier => tiersOfHouse(cast)[0];

/** How many bands the house sells at. One is a house with no tier vocabulary at all. */
export const tierCount = (cast: Cast): number => tiersOfHouse(cast).length;

/** THE ONE QUESTION EVERY PRICE SURFACE ASKS. False, and there is no dropdown, no column and no
 *  chain anywhere: the price is a fact. */
export const isMultiTier = (cast: Cast): boolean => tierCount(cast) > 1;

export const tierAt = (cast: Cast, index: number): Tier | undefined => tiersOfHouse(cast)[index];

export const tierIndexOf = (cast: Cast, id: string): number =>
  tiersOfHouse(cast).findIndex((t) => t.id === id);

/** What a band is called, wherever a tier id has to become words. */
export const tierNameOf = (cast: Cast, id: string): string =>
  tiersOfHouse(cast).find((t) => t.id === id)?.name ?? tarifaName(id);

/** The house writes its own bands. Passing one tarifa is a single-tier house, and every surface
 *  drops the vocabulary on the next render. */
export function setRegistry(tiers: Tier[]): boolean {
  ensureScope();
  return publish({ ...TIERS, registry: tiers.length > 0 ? tiers : null,
    lastTierNumber: Math.max(TIERS.lastTierNumber, highestTierNumber([...tiers, ...(TIERS.registry ?? [])].map((tier) => tier.id))),
  });
}

export function renameTier(cast: Cast, id: string, name: string): boolean {
  const next = tiersOfHouse(cast).map((t) => (t.id === id ? { ...t, name: name.trim() || t.name } : t));
  return setRegistry(next);
}

/** The next band, in the same series. A house grows a tarifa; it does not invent a word for one. */
export function addTier(cast: Cast): void {
  const own = tiersOfHouse(cast);
  const n = Math.max(TIERS.lastTierNumber, highestTierNumber(own.map((tier) => tier.id))) + 1;
  setRegistry([...own, { id: `tier ${n}`, name: `Tarifa ${n}` }]);
}

/** A band comes off the sheet. The customers on it fall back to the first band, because a customer
 *  without a price is a customer nobody can invoice. */
export function removeTier(cast: Cast, id: string): void {
  const own = tiersOfHouse(cast);
  if (own.length <= 1) return;
  const rest = own.filter((t) => t.id !== id);
  const first = rest[0].id;
  const moved = { ...TIERS.customers };
  for (const c of cast.customers) {
    if (tierOfCustomer(c) === id) moved[c.id] = first;
  }
  const anchored = Object.fromEntries(Object.entries(TIERS.anchored).filter(([, rel]) => rel.anchor !== id).map(([sku, rel]) => [sku, {
    ...rel, offsets: Object.fromEntries(Object.entries(rel.offsets).filter(([tier]) => tier !== id)),
  }]));
  publish({ ...TIERS, registry: rest, customers: moved, anchored,
    lastTierNumber: Math.max(TIERS.lastTierNumber, highestTierNumber(own.map((tier) => tier.id))),
  });
}

/* ── THE CUSTOMER'S BAND ──────────────────────────────────────────────────────────────────────
 * `Customer.tier` is the standing fact the cast already carries; this store holds the moves a hand
 * has made since. Reading through one function is what keeps the albarán, the profile and the
 * registry's counts from ever disagreeing about who is on what.
 */

export const tierOfCustomer = (customer: Customer): string =>
  tiersNow().customers[customer.id] ?? customer.tier;

/** THE BAND THIS HOUSE ACTUALLY SELLS THEM AT. A house that has cut its sheet down to one tarifa
 *  still has customers carrying the band they were seeded on, and a customer whose band the house
 *  no longer holds has to be priced by something real — so the sheet's first band answers for
 *  them. Every surface that prices anything reads THIS rather than the raw field. */
export function bandOf(cast: Cast, customer: Customer): string {
  const own = tierOfCustomer(customer);
  const house = tiersOfHouse(cast);
  return house.some((t) => t.id === own) ? own : house[0].id;
}

export function setCustomerTier(customerId: string, tierId: string): boolean {
  ensureScope();
  return publish({ ...TIERS, customers: { ...TIERS.customers, [customerId]: tierId } });
}

/** Everyone on a band, in the cast's own order — the list behind the registry row's count. */
export const membersOf = (cast: Cast, tierId: string): Customer[] =>
  cast.customers.filter((c) => bandOf(cast, c) === tierId);

/** The registry, with the size of each band on it. «The size of the act is visible.» */
export const registryOf = (cast: Cast): TierWithCount[] =>
  tiersOfHouse(cast).map((t) => ({ ...t, customers: membersOf(cast, t.id).length }));

/* ── THE SHEET ────────────────────────────────────────────────────────────────────────────────
 * A price is a fact about (product, tarifa, day). Asked for a day, the sheet answers with the
 * newest thing written ON OR BEFORE that day, and with the house's own arithmetic where nothing
 * has been written at all. So an untouched house has a complete sheet, and a house that set three
 * prices this morning has three prices and the rest of its arithmetic.
 */

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** What the house's own arithmetic says this band pays, before anybody writes anything. */
export const basePrice = (cast: Cast, product: Product, tierId: string): number => {
  const at = tierIndexOf(cast, tierId);
  return listPrice(cast, product, at < 0 ? 0 : at);
};

/** Every stamp for one product, newest first — for ONE of its bands where a band is named. THE
 *  SEAM THE PRODUCT CARD READS ITS TIMELINE FROM.
 *
 *  IT IS WHAT A HAND WROTE, AND ONLY THAT (AUDIT-2 C24 · §51.15). A house that has never typed a
 *  price gets an empty array here, and that is the correct answer: the standing trail underneath —
 *  the days the house's own arithmetic priced — is `knows.ts`'s `priceTrailOf`, and the timeline on
 *  the product sheet is the two of them laid over each other. So a COUNT on the door into that
 *  timeline is the length of the merged reading, never the length of this one: `product-card.tsx`
 *  showed a bare «History» with `data-changes="0"` against four dated rows behind it because it
 *  counted here. The band argument exists so the three readers that wanted one band stop filtering
 *  this result themselves.
 *
 *  AND A CUSTOMER'S OWN PRICE IS NOT PART OF A BAND'S HISTORY (§16.2). Asked for one band, the
 *  filter answers that band and a `customer:` stamp can never be it. Asked for NO band — which is
 *  what the product sheet's timeline does — the customer stamps are left out, because a price that
 *  one account pays is a fact about that account and putting it in the house's own trail would
 *  make the sheet read as though the tarifa had moved. `customerHistoryOf` is where it is read. */
export const priceHistoryOf = (product: Product | string, tierId?: string): PriceStamp[] => {
  const id = typeof product === 'string' ? product : product.id;
  return tiersNow().log
    .filter((s) => s.product === id && (tierId === undefined ? !isCustomerKey(s.tier) : s.tier === tierId))
    .slice()
    .reverse();
};

/* ── ONE CUSTOMER'S OWN PRICE (§16.2 · THE-CHECKPOINT-MAP 16.2) ────────────────────────────────
 * «Multiple tariffs / price groups; CUSTOMER-SPECIFIC PRICING; frequently changing daily prices.»
 *
 * A customer's own price is the same OBJECT as a tarifa price — a fact about (product, whose, day),
 * appended, superseding, undoable, readable forever. So it rides the tarifa system's existing shape
 * rather than growing a second store beside it: the band slot carries `customer:<id>` instead of a
 * `Tier.id`, and every verb this file already has — `setPrices`, `dropStamps`, the history, the
 * Undo — works on it unchanged. That is the whole of the mechanism, and it is deliberately the
 * smallest thing that could carry the requirement (§27.5: no second implementation of a working one).
 *
 * WHAT IT IS NOT: a discount, a percentage, or a rule. It is one written price for one account, and
 * an account with none is priced by its band exactly as before.
 */

/** The band slot one customer's own price is written into. */
export const customerKey = (customer: Customer | string): string =>
  `customer:${typeof customer === 'string' ? customer : customer.id}`;

/** Is this band slot a customer's own, rather than one of the house's tarifas? */
export const isCustomerKey = (tier: string): boolean => tier.startsWith('customer:');

/** `customer:c-4` → `c-4`, for the surface that has to name whose price it is. */
export const customerOfKey = (tier: string): string => tier.slice('customer:'.length);

/** Every price written FOR ONE ACCOUNT, newest first. */
export const customerHistoryOf = (product: Product | string, customer: Customer | string): PriceStamp[] =>
  priceHistoryOf(product, customerKey(customer));

/** WHAT THIS ACCOUNT PAYS FOR THIS THING ON THIS DAY — their own written price where a hand has
 *  given them one, and their band's otherwise. Every surface that prices a customer reads THIS, so
 *  the albarán, the profile and the sheet can never disagree about whose number is in force. */
export function discountHistoryOf(customer: Customer | string): CustomerDiscount[] {
  const id = typeof customer === 'string' ? customer : customer.id;
  return tiersNow().discounts.filter((discount) => discount.customer === id).slice().reverse();
}

/** The latest unreleased agreement whose schedule covers this day. A future agreement is visible
 * in history but changes no price until its first day. */
export function discountOn(customer: Customer | string, day: string): CustomerDiscount | null {
  return discountHistoryOf(customer).find((discount) =>
    discount.startsOn <= day
    && discount.endsOn >= day
    && (!discount.releasedOn || discount.releasedOn > day)
  ) ?? null;
}

export function scheduleCustomerDiscount(a: {
  customer: Customer | string;
  percent: number;
  startsOn: string;
  endsOn: string;
  createdOn: string;
  createdAt: string;
}): string | null {
  ensureScope();
  const percent = Math.round(a.percent * 100) / 100;
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100 || !a.startsOn || !a.endsOn || a.startsOn > a.endsOn) return null;
  const id = `discount-${typeof a.customer === 'string' ? a.customer : a.customer.id}-${Date.now()}-${TIERS.discounts.length + 1}`;
  const discount: CustomerDiscount = {
    id,
    customer: typeof a.customer === 'string' ? a.customer : a.customer.id,
    percent,
    startsOn: a.startsOn,
    endsOn: a.endsOn,
    createdOn: a.createdOn,
    createdAt: a.createdAt,
  };
  return publish({ ...TIERS, discounts: [...TIERS.discounts, discount] }) ? id : null;
}

export function releaseCustomerDiscount(id: string, releasedOn: string, releasedAt: string): boolean {
  ensureScope();
  const found = TIERS.discounts.some((discount) => discount.id === id);
  if (!found) return false;
  return publish({
    ...TIERS,
    discounts: TIERS.discounts.map((discount) =>
      discount.id === id ? { ...discount, releasedOn, releasedAt } : discount),
  });
}

/** WHAT THIS ACCOUNT PAYS FOR THIS THING ON THIS DAY — own SKU price or tariff first, then the
 * active temporary account agreement. The discount never mutates either underlying price. */
export function priceFor(cast: Cast, product: Product, customer: Customer, day: string): number {
  const own = writtenOn(product, customerKey(customer), day);
  const standing = own === null ? priceOn(cast, product, bandOf(cast, customer), day) : own;
  const discount = discountOn(customer, day);
  return discount ? Math.round(standing * (1 - discount.percent / 100) * 100) / 100 : standing;
}

/** Does this account stand on a price of its own on this day? The stamp itself, so the row that
 *  says so can also say when it was written and whose hand it was. */
export const ownPriceOf = (product: Product, customer: Customer, day: string): PriceStamp | null => {
  const stamps = customerHistoryOf(product, customer).filter((s) => s.day <= day);
  return stamps[0] ?? null;
};

/** ONE ACCOUNT'S OWN PRICE, WRITTEN. */
export function setCustomerPrice(a: {
  product: Product | string;
  customer: Customer | string;
  day: string;
  price: number;
  at: string;
  author?: PriceAuthor;
}): string[] {
  return setPrices([
    {
      product: typeof a.product === 'string' ? a.product : a.product.id,
      tier: customerKey(a.customer),
      day: a.day,
      price: a.price,
      at: a.at,
      author: a.author ?? 'hand',
    },
  ]);
}

/** The newest stamp on a product, or on one of its bands. Null where the sheet is still the
 *  house's own arithmetic — which is a real answer, not a blank. */
export function lastSetOf(product: Product | string, tierId?: string): PriceStamp | null {
  return priceHistoryOf(product, tierId)[0] ?? null;
}

/** WHAT A HAND ACTUALLY WROTE for this band, this thing, this day — and null where the sheet is
 *  still the house's own arithmetic. THE OPEN ALBARÁN READS THIS (FEED-IA §32): a price somebody
 *  set this morning reaches every document that has yet to print, and a price nobody has touched
 *  leaves the document exactly as the catalogue priced it. */
export function writtenOn(product: Product, tierId: string, day: string): number | null {
  const log = tiersNow().log;
  let found: PriceStamp | null = null;
  for (const s of log) {
    if (s.product !== product.id || s.tier !== tierId || s.day > day) continue;
    if (!found || s.day >= found.day) found = s;
  }
  if (found) return found.price;
  /* ── AND A VARIATION STANDS ON THE HOUSE'S OWN SHEET (§127.4c) ────────────────────────────
     This is the ONE reader that consults the floor, and it is the right one: every surface that
     prices a MEMBER comes through here, and every surface that counts what a hand has done reads
     the log directly and is untouched. A member the trade has no ratio for answers null exactly as
     before, so «nobody has written one» is still a real answer. */
  return variationPriceOf(product.id, tierId);
}

/** THE PRICE THIS BAND PAYS FOR THIS THING ON THIS DAY. */
export function priceOn(cast: Cast, product: Product, tierId: string, day: string): number {
  const log = tiersNow().log;
  let found: PriceStamp | null = null;
  for (const s of log) {
    if (s.product !== product.id || s.tier !== tierId || s.day > day) continue;
    if (!found || s.day > found.day) found = s;
    else if (s.day === found.day) found = s; /* later in the log supersedes earlier on the same day */
  }
  return found ? found.price : basePrice(cast, product, tierId);
}

/** Today's sheet for one product, band by band. */
export const sheetOf = (cast: Cast, product: Product, day: string): Record<string, number> =>
  Object.fromEntries(tiersOfHouse(cast).map((t) => [t.id, priceOn(cast, product, t.id, day)]));

/** ONE PRICE, WRITTEN. Appending is the only way a price ever changes. */
export function setPrice(entry: Omit<PriceStamp, 'id'>): void {
  setPrices([entry]);
}

/** A WHOLE ROW OF THEM, IN ONE ACT — percentage mode's Save restructures several bands at once and
 *  belongs in the history as ONE moment rather than as four.
 *
 *  IT HANDS BACK THE IDS IT WROTE, because §76's «immediate feedback after saving, ideally with
 *  Undo» needs to name the act it is offering to take back. */
export function setPrices(entries: Array<Omit<PriceStamp, 'id'>>): string[] {
  ensureScope();
  if (entries.length === 0) return [];
  const n = TIERS.log.length;
  const stamped = entries.map((e, i) => ({
    ...e,
    price: round2(e.price),
    id: `${e.product}:${e.tier}:${e.day}:${n + i}`,
  }));
  if (!publish({ ...TIERS, log: [...TIERS.log, ...stamped] })) return [];
  return stamped.map((s) => s.id);
}

/** UNDO — AND WHY IT IS NOT AN EDIT OF THE LOG (FEED-IA §76).
 *
 *  The log is append-only and an edit SUPERSEDES rather than overwrites: that law is about PRICES,
 *  which are facts about a day and stay readable forever. This is a different act. A person who
 *  presses Undo on the snackbar is saying the price was never set — the typing was a slip, caught
 *  in the seconds the toast stands — so the retraction removes the stamp instead of writing a
 *  second one on top of it. Two stamps three seconds apart would be a history of a mistake, and
 *  the history is meant to say what the goods cost. Only the ids `setPrices` just handed back can
 *  be dropped, so nothing older than the current act is reachable from here. */
export function dropStamps(ids: string[]): boolean {
  ensureScope();
  if (ids.length === 0) return true;
  const drop = new Set(ids);
  return publish({ ...TIERS, log: TIERS.log.filter((s) => !drop.has(s.id)) });
}

/* ── WHICH ONES STILL WANT A NUMBER (§16.12 · THE-CHECKPOINT-MAP 16.12) ────────────────────────
 * «Recent / needs-price first.» A day's pricing round is not a list of three hundred goods, it is
 * the handful whose rate is still yesterday's — so the surface has to be able to ask which those
 * are. THE QUESTION IS ABOUT THE DAY AND NOTHING ELSE: a price written FOR today stands; anything
 * else — yesterday's stamp, last week's, or the house's own margin arithmetic where no hand has
 * ever written — is a rate that has not been said today.
 *
 * IT IS NOT A STATUS AND IT CARRIES NO COLOUR. Nothing on the floor is wrong about a product whose
 * price has not moved; the reading exists so the RUN can lead with them (§76's «triaging
 * notifications»), and the bottom bar says how many there are.
 */

/** Has a hand written this band's price FOR this day? */
export const pricedOn = (product: Product | string, tierId: string, day: string): boolean =>
  priceHistoryOf(product, tierId).some((s) => s.day === day);

/** …and its inverse, which is the one the run sorts on. */
export const needsPrice = (product: Product | string, tierId: string, day: string): boolean =>
  !pricedOn(product, tierId, day);

/* ── TWO HANDS ON ONE PRICE (§16.9 · THE-CHECKPOINT-MAP 16.9) ──────────────────────────────────
 * A save appends and supersedes, so two people pricing the same merluza at 05:12 and 05:13 used to
 * end in silence: the second write simply stood, and the first person's number was gone from every
 * document without anybody being told. That is the one case in this file where «append-only» is not
 * by itself enough — the LOG is right and the SCREEN was wrong.
 *
 * THE READING IS POSITIONAL, NOT TEMPORAL. The run remembers the stamp each target stood on when it
 * OPENED (a stamp id, or null for a band nobody had written). If the newest stamp is no longer that
 * one, somebody has written since — and the sheet says so, with both numbers, before it writes a
 * third. A clock comparison would have to trust two clocks; an id is the same fact without one.
 */

/** The stamp that landed AFTER the one a run opened on, or null where the sheet has not moved. */
export function writtenSince(
  product: Product | string,
  tierId: string,
  opened: string | null,
): PriceStamp | null {
  const newest = lastSetOf(product, tierId);
  if (!newest) return null;
  return newest.id === opened ? null : newest;
}

/* ── WHAT A RUN CAME TO (§16 «publish» · §76's review state) ───────────────────────────────────
 * The closing act of a pricing round is a READING of it: how many prices, on how many goods, over
 * how many bands, and every one of them with the number it replaced. It is a fold over the ids
 * `setPrices` already hands back, so the review can never disagree with the log it is reading —
 * and it holds no state of its own, which is why a run that is abandoned halfway leaves nothing
 * behind to reconcile.
 */

export type PublishedLine = {
  stamp: PriceStamp;
  /** what this band was standing at before the run wrote — null where nothing had been written */
  was: number | null;
};

export type PublishReading = {
  lines: PublishedLine[];
  /** how many goods the run touched */
  products: number;
  /** the bands it wrote on, in the house's own order */
  tiers: string[];
};

export function publishReading(ids: string[]): PublishReading {
  const want = new Set(ids);
  const log = tiersNow().log;
  const lines: PublishedLine[] = [];
  for (let i = 0; i < log.length; i += 1) {
    const stamp = log[i];
    if (!want.has(stamp.id)) continue;
    /* what stood before it: the newest stamp on the same band EARLIER IN THE LOG that the run did
       not itself write — so a product priced twice in one run states the price it walked in on. */
    let was: number | null = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      const prior = log[j];
      if (prior.product !== stamp.product || prior.tier !== stamp.tier || want.has(prior.id)) continue;
      was = prior.price;
      break;
    }
    lines.push({ stamp, was });
  }
  return {
    lines,
    products: new Set(lines.map((l) => l.stamp.product)).size,
    tiers: [...new Set(lines.map((l) => l.stamp.tier))],
  };
}

/** HOW ONE BAND STANDS AGAINST ANOTHER, on a day, for a thing. It is what an on-the-fly tarifa
 *  switch multiplies a line by: the document keeps its own arithmetic and moves by the sheet's own
 *  spread, so the switch can never invent a number the sheet does not hold. */
export function tierRatio(
  cast: Cast,
  product: Product,
  from: string,
  to: string,
  day: string,
): number {
  if (from === to) return 1;
  const a = priceOn(cast, product, from, day);
  const b = priceOn(cast, product, to, day);
  return a > 0 ? b / a : 1;
}

/* ── THE CHAIN (the Figma corner-radius idiom) ────────────────────────────────────────────────
 * Closed: one price serves every band, and typing it writes them together. Open: the typed price
 * moves its own band alone. The state is part of the product's price and is visible at rest — a
 * new tarifa cannot silently fork three hundred SKUs, because the chain is what forks them.
 *
 * A house whose seed already prices its bands differently is ALREADY forked, and the control says
 * so on the first render rather than claiming a link the numbers do not have.
 */

export function chainOf(cast: Cast, product: Product, day: string): boolean {
  const own = tiersNow().chain[product.id];
  if (own !== undefined) return own;
  const prices = Object.values(sheetOf(cast, product, day));
  return prices.every((p) => Math.abs(p - prices[0]) < 0.005);
}

export function setChain(product: Product | string, closed: boolean): void {
  ensureScope();
  const id = typeof product === 'string' ? product : product.id;
  publish({ ...TIERS, chain: { ...TIERS.chain, [id]: closed } });
}

/* ── THE PERCENTAGE MODE (the founder's own spec, §A.11) ──────────────────────────────────────
 * «An arrow anchors one tier, the others become +/-% relationships, auto-distributed symmetrically
 * around the middle (even count anchors upper-middle); drag the arrow to re-anchor; the anchor is
 * the price you edit, the rest go grey computed; changes require Save.»
 *
 * The four functions below are the whole of that rule, kept pure so the editor is a view of them
 * and the Ramp — which manipulates the same {anchor, stops[]} — can never disagree with the table.
 */

/** The steps the founder spoke: symmetric, ten points at a time, outward from the middle. */
export const OFFSET_STEPS = [10, 20, 30, 40, 50];

/** THE MIDDLE, AND THE UPPER MIDDLE WHEN THE COUNT IS EVEN. Four bands anchor on the third. */
export const anchorIndexOf = (count: number): number => Math.floor(count / 2);

/** ON ENTRY: the arrow lands on the middle band and the others read symmetric ±10/20/30. */
export function seedRelationship(tiers: Tier[]): Relationship {
  const at = anchorIndexOf(tiers.length);
  const offsets: Record<string, number> = {};
  tiers.forEach((t, i) => {
    const away = Math.abs(i - at);
    const step = OFFSET_STEPS[Math.min(away - 1, OFFSET_STEPS.length - 1)] ?? 0;
    offsets[t.id] = away === 0 ? 0 : (i < at ? -step : step);
  });
  return { anchor: tiers[at]?.id ?? '', offsets };
}

/** WHAT EVERY BAND COMES TO, given the one typed price. The anchor is ink; these are the grey. */
export function pricesFrom(rel: Relationship, tiers: Tier[], anchorPrice: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tiers) {
    const offset = t.id === rel.anchor ? 0 : rel.offsets[t.id] ?? 0;
    out[t.id] = round2(anchorPrice * (1 + offset / 100));
  }
  return out;
}

/** RE-ANCHORING MOVES NO MONEY. The offsets recompute as (price_i / price_anchor′ − 1) · 100, so
 *  every absolute price stands exactly still at the moment the arrow lands somewhere else. */
export function reanchor(
  tiers: Tier[],
  prices: Record<string, number>,
  next: string,
): Relationship {
  const anchorPrice = prices[next] ?? 0;
  const offsets: Record<string, number> = {};
  for (const t of tiers) {
    offsets[t.id] = anchorPrice > 0
      ? ((prices[t.id] ?? anchorPrice) / anchorPrice - 1) * 100
      : 0;
  }
  return { anchor: next, offsets };
}

/** The relationship a product is held in, where percentage mode saved one. */
export const relationshipOf = (product: Product | string): Relationship | null => {
  const id = typeof product === 'string' ? product : product.id;
  return tiersNow().anchored[id] ?? null;
};

/** SAVE — the one deliberate exception to immersion editing, because it restructures several bands
 *  at once. The relationship is kept AND every band's new price is stamped, so the timeline shows
 *  the whole act rather than the anchor alone. */
export function saveRelationship(
  product: Product | string,
  rel: Relationship,
  prices: Record<string, number>,
  day: string,
  at: string,
  author: PriceAuthor = 'hand',
): boolean {
  ensureScope();
  if (!rel.anchor || !Number.isFinite(prices[rel.anchor]) || prices[rel.anchor] <= 0
    || Object.values(prices).some((price) => !Number.isFinite(price) || price <= 0)
    || Object.values(rel.offsets).some((offset) => !Number.isFinite(offset) || offset <= -100)) {
    saveError = 'Saving these tariff prices stalled. Enter a positive base price and valid percentage differences; your saved prices stand as they are.';
    for (const listener of listeners) listener();
    return false;
  }
  const id = typeof product === 'string' ? product : product.id;
  const n = TIERS.log.length;
  const stamped: PriceStamp[] = Object.entries(prices).map(([tier, price], i) => ({
    id: `${id}:${tier}:${day}:${n + i}`,
    product: id,
    tier,
    day,
    price: round2(price),
    at,
    author,
  }));
  return publish({
    ...TIERS,
    log: [...TIERS.log, ...stamped],
    anchored: { ...TIERS.anchored, [id]: rel },
    /* a relationship IS a fork: the bands hold different numbers on purpose */
    chain: { ...TIERS.chain, [id]: false },
  });
}

/** The relationship comes off; the prices it wrote stay written, because they were real prices. */
export function clearRelationship(product: Product | string): void {
  ensureScope();
  const id = typeof product === 'string' ? product : product.id;
  const rest = { ...TIERS.anchored };
  delete rest[id];
  publish({ ...TIERS, anchored: rest });
}

/* ── A PASTED PRICE LIST (§16.5 · THE-CHECKPOINT-MAP 16.5) ────────────────────────────────────
 * «Daily price entry needs far better UX than a giant ERP matrix: PASTE; type; dictate; bulk
 * update; resolve conflicts; publish.» A price list arrives as two columns in a mail, a WhatsApp,
 * a spreadsheet cell range — the goods and the number — and the thing a person does with it is
 * ctrl-V.
 *
 * THIS HALF IS THE NUMBER, AND ONLY THE NUMBER. Splitting the rate off the end of a line is
 * arithmetic and belongs where the rates live; reading WHICH GOODS the rest of the line names is
 * §62's organ (`chip-parse.ts`) and the catalogue's own `matches`, and this file knows nothing
 * about either. So the paste door parses here and resolves there, and neither half grows a second
 * copy of the other (§27.5).
 *
 * THE PRICE IS THE TAIL. Every real list — «Merluza sin cabeza    14,82», «Gamba roja; 39,50 €/kg»,
 * «RAP-2  Rape  8,90 €» — puts the goods first and the money last, whatever sits between them, and
 * the currency and the rate unit are noise this reads past. A line with no number at the end is a
 * HEADER or a note, and it is dropped rather than guessed at.
 */

export type PastedLine = {
  /** the line exactly as it was pasted */
  raw: string;
  /** what is left once the price and its currency come off — the words the catalogue resolves */
  said: string;
  price: number;
};

/** «14,82» · «1.412,05» · «8.90» → a number. Spanish lists write the comma; exports write the
 *  point; a list with both has the point as its thousands separator, which is the only reading
 *  under which «1.412,05» and «1,412.05» are the same money. */
export function parseRate(said: string): number | null {
  const t = said.trim();
  if (!t) return null;
  const dot = t.lastIndexOf('.');
  const comma = t.lastIndexOf(',');
  let plain: string;
  if (dot >= 0 && comma >= 0) {
    plain = comma > dot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (comma >= 0) {
    plain = t.replace(/\./g, '').replace(',', '.');
  } else if (dot >= 0) {
    /* a single point with three digits behind it is a thousands separator, not a rate */
    plain = /\.\d{3}$/.test(t) ? t.replace(/\./g, '') : t;
  } else {
    plain = t;
  }
  const n = Number(plain);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** THE NUMBER HAS TO STAND APART FROM THE GOODS. Without the leading separator «MERLUZA-3» reads
 *  as «MERLUZA» at three soles — a code's own digits taken for money, which is the one way a paste
 *  can be confidently wrong. A rate is a column, so it is preceded by the thing that made it one. */
const RATE_TAIL = /(?:^|[\s;:|·\t])(?:(?:S\/\.?|PEN)\s*)?(\d[\d.,]*)\s*$/iu;
/** the currency and the rate unit, in the forms a Spanish sheet writes them */
const MONEY_TAIL = /\s*(?:S\/|PEN|soles?|€|eur|euros?)?\s*(?:(?:\/|per\s+)\s*[\p{L}]+)?\s*$/iu;
/** what a two-column line puts between the goods and the money */
const COLUMN_TAIL = /[\s;:|·\-–—]+$/u;

/** A pasted block, read line by line. Lines the reading cannot answer are LEFT OUT rather than
 *  guessed — the count of what was read is stated on the surface, so nothing is silently dropped. */
export function parsePasted(text: string): PastedLine[] {
  const out: PastedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const body = line.replace(MONEY_TAIL, '');
    const tail = RATE_TAIL.exec(body);
    if (!tail) continue;
    const price = parseRate(tail[1]);
    if (price === null) continue;
    const said = body.slice(0, tail.index).replace(COLUMN_TAIL, '').trim();
    if (!said) continue;
    out.push({ raw: line, said, price });
  }
  return out;
}

/* ── THE WORDS ────────────────────────────────────────────────────────────────────────────────
 * Said here so the editor, the albarán and the product card use one sentence for one fact. Every
 * one of them says what IS: a price that has not been written yet is priced by today's tarifa when
 * the paper comes out, and that is a promise rather than a gap.
 */

/** «€/kg» — the unit shares the number's own line, always. */
export const priceUnitOf = (product: Product): string => `S/ per ${product.unit}`;

/** What an offset reads as on the relationship column. */
export const offsetWords = (offset: number): string =>
  offset === 0 ? '0%' : `${offset > 0 ? '+' : '−'}${Math.abs(offset).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`;

/** What a band's row says about where its number came from. */
export const sourceWords = (stamp: PriceStamp | null): string =>
  stamp ? `Set ${stamp.at} · ${stamp.day.slice(8)}.${stamp.day.slice(5, 7)}` : 'From your catalogue';

/** THE SINGLE-TIER HOUSE, SAID (§75.4 · C4). The house HAS a tarifa — it is named, it is the one
 *  the sheet writes into — and this is the line under its name in the setting. The word still never
 *  reaches a product page: the product shows one plain price. */
export const ONE_LIST_WORDS = 'Every customer buys on it.';

/** THE BOTTOM BAR'S COUNT (§16.12). It states what the run is FOR: the goods still waiting on
 *  today's rate where there are any, and the size of the run where the day is already said. Both
 *  are affirmative — a count of what to do, never a count of what is missing. */
export const runWords = (targets: number, waiting: number): string =>
  waiting > 0
    ? `${waiting} ${waiting === 1 ? 'needs a price' : 'need a price'}`
    : `${targets} ${targets === 1 ? 'price' : 'prices'}`;

/** THE CONFLICT LINE (§16.9). Said as a fact about a person and a moment, with both numbers on the
 *  row so the choice is made by reading rather than by remembering. */
export const conflictWords = (stamp: PriceStamp): string =>
  `Someone priced this at ${stamp.at}`;

/** WHAT THE CLOSING ACT SAYS IT DID (§16 «publish»). Prices reach the tarifas the moment they are
 *  saved — §76's own directive, and `dropStamps` is the way back — so this sentence states the SIZE
 *  of the round rather than promising a transition. */
export const publishWords = (r: PublishReading): string => {
  const n = r.lines.length;
  const prices = `${n} ${n === 1 ? 'price' : 'prices'}`;
  const bands = r.tiers.length > 1 ? ` · ${r.tiers.length} tarifas` : '';
  return `${prices}${bands}`;
};
