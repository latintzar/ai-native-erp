import { CEDAR_OPERATOR_NAME, cedarOperatorName } from './cedar-operator';
/* THE CONFIG — the onboarding's ten answers as ONE live data structure, and the function that
 * turns them into the app's emphasis.
 *
 * ═══ THE TWO LAWS THIS FILE EXISTS TO KEEP (THE-APP §"The two laws") ═══════════════════════
 *
 * 1 · THE BLEND LAW. Mode is a property of the LINE, not of the account (THE-ALBARAN-THESIS §0:
 *     "most times it will be that they weigh; other times it'll be that they just put in the
 *     albarán what they've ordered"). So `derive()` returns DEFAULTS AND EMPHASIS ONLY. Read it
 *     end to end and you will find no field that removes a surface, hides a capability, or names
 *     an alternative UI — every value here answers "what does this surface assume first", and
 *     every capability stays one tap away on every account.
 *
 * 2 · CONFIG IS A LIVE DATA STRUCTURE. One object, persisted to localStorage, re-derived on
 *     every read. Settings re-houses the very same question components; answering one there
 *     re-derives the UI in place and nothing breaks underneath. That is the Russian doll, and it
 *     is a first-class requirement of the prototype, not a nicety.
 *
 * WHERE THE ANSWERS SHOW UP. Every derived decision carries a «from your setup» affordance that
 * jumps to the Settings row that produced it — see `anchors.tsx`. The config is therefore always
 * visible at its point of effect, never only in a settings page nobody opens.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';
import { CASTS, HOUSE, type Cast } from '../../scenarios/data/cast';
import { capabilityAvailable } from './release-profile';
import { resetCollectionWorkspace } from './money-api';
import { cedarCast } from './cedar-cast';
import { CEDAR_CONFIG_PEN_VERSION, migrateConfigCurrency } from './currency-migration';
import { seedSoles, soles } from './currency';
/* §86.5 — the accounts a person wrote in the composer, merged onto the cast in the provider */
import { useMadeCustomers } from './customers-made';

/* ── THE TEN QUESTIONS, AS TYPES ──────────────────────────────────────────────────────────── */

/** The ten load-bearing dimensions. Everything else derives or defaults (THE-APP §Onboarding). */
export type QuestionId =
  | 'sector' | 'capture' | 'gate' | 'pricing' | 'weighing'
  | 'goodsIn' | 'stock' | 'delivery' | 'lots' | 'erp';

export const QUESTION_IDS: QuestionId[] = [
  'sector', 'capture', 'gate', 'pricing', 'weighing',
  'goodsIn', 'stock', 'delivery', 'lots', 'erp',
];

/** Q1 — what they sell. An array, because a mix is two answers and not a fourth sector. */
export type SectorKey = SectorId;

/** Q2 — how orders reach them. The DEFAULT door; every other door stays on the surface. */
export type CaptureDoor = 'whatsapp' | 'calls' | 'voice' | 'reps';

/** Q3 — who checks an order before it proceeds. */
export type GateMode = 'all' | 'odd' | 'threshold';

/** Q4 — the pricing fractal's four levels (THE-ALBARAN-THESIS §2). Per ITEM in truth; this is
 *  the level an item opens at when nothing more specific is known about it. */
export type PricingLevel = 1 | 2 | 3 | 4;

/** Q5 — do they weigh. Per line always; this is the line's starting assumption. */
export type WeighingDefault = 'most' | 'some' | 'rarely';

/** Q6 — how supplier documents arrive. The FRONT door at goods-in; the others are one tap away. */
export type GoodsInDoor = 'paper' | 'email' | 'both';

/** Q7 — how stock is known. */
export type StockMode = 'connected' | 'declared' | 'none';

/** Q8 — who delivers. */
export type DeliveryMode = 'van' | 'agency' | 'collect';

/** Q9 — lots on the albarán. Validated against sector, per LOT-LAW §"What this means" §4. */
export type LotsMode = 'print' | 'reference' | 'none';

/** Q10 — where the data ends up. */
export type ErpTarget = 'sage50' | 'holded' | 'a3' | 'file';

/* ── THE ALBARÁN'S PAPER (FEED-IA §37.7) ──────────────────────────────────────────────────────
 * «Global albarán settings: valued or unvalued printing (prices on paper or not, even if priced
 * internally) · print format structures.»
 *
 * Document appearance and customer confirmation policy are distinct, with one explicit dependency. Plenty of houses price
 * everything internally and hand the customer a delivery note with no money on it — the goods and
 * their trazabilidad travel with the crate, and the amounts arrive later on the invoice. So the
 * setting controls customer albarán prices and gates prices in chat confirmations. Internal
 * pricing and ERP invoicing data retain their amounts; hiding customer prices does not erase money.
 *
 * IT IS A HOUSE ANSWER, NOT A CUSTOMER ANSWER. One house prints one kind of albarán, so this is
 * one row in Settings rather than a question per document — the same law §20 keeps about the
 * printer itself: «set ONCE and customisable, a settings row, never a dialog per print.»
 */

/** Q11 — what the printed albarán carries. */
export type AlbaranValues = 'valued' | 'unvalued';

/** Q12 — the structure it prints in: the full A4 sheet, or the compact half. */
export type AlbaranShape = 'full' | 'compact';

export type AppConfig = {
  /** the shape of this object, so a stored answer set from an older build is replaced rather
   *  than half-read */
  version: number;
  sector: SectorKey[];
  /** which sector's cast the app draws with when a house sells more than one */
  cast: SectorKey;
  capture: { default: CaptureDoor };
  gate: { mode: GateMode; threshold: number };
  pricing: { level: PricingLevel };
  weighing: { default: WeighingDefault };
  goodsIn: { door: GoodsInDoor };
  stock: { mode: StockMode };
  delivery: { mode: DeliveryMode };
  lots: { mode: LotsMode };
  erp: { target: ErpTarget };
  /** the free line under a question, where the contract offers one */
  notes: Partial<Record<QuestionId, string>>;
  /** THE PAPER TRAIL'S DOOR (THE-APP-V2 §5.6): the inbox arrivals are read from. A prototype
   *  connection — the address is kept, the state is kept, and Stock's incoming log reads it. */
  emailFeed: { connected: boolean; address: string };
  /** THE BRAND BASICS: the house's own name, and the line its albarán signs off with. The name
   *  is on the rail from the moment it is typed. */
  brand: { name: string; line: string };
  /** WHAT THE PRINTED ALBARÁN CARRIES, AND THE SHAPE IT CARRIES IT IN (FEED-IA §37.7). */
  albaran: { values: AlbaranValues; shape: AlbaranShape };
  /** Customer-facing policy. Internal pricing and ERP invoicing retain their own data. */
  confirmation: { includePrices: boolean };
  productRequests: { suggestNewSkus: boolean; erpLines: 'base-item-note' | 'mapped-variation' };
  /** ── THE PERSON, NOT THE PRODUCT (FEED-IA §53) ────────────────────────────────────────────
   * «It shouldn't be your Rocoto name, but it should be the person, like their account.»
   *
   * The rail's foot used to say `brand.name`, which put the HOUSE in the one seat that is about
   * WHO IS SIGNED IN — and then said the same word at the head of every document. This is the
   * other fact, kept apart from the brand on purpose: a house has one name and any number of
   * people, and the day auth lands (Row 0 tenancy) this field is what it fills. Until then it
   * seeds from the cast's own owner, so no name is typed into a screen (cast law 10). */
  owner: { name: string };
};

/**
 * THE SHAPE OF THIS OBJECT, VERSIONED — and the version means something different now.
 *
 * ═══ WHY THE BUMP CHANGED THE PARSER AND NOT JUST THE NUMBER ════════════════════════════════
 * `parseConfig` used to answer a stored version it did not recognise by returning DEFAULTS whole.
 * That is correct for a SHAPE change and catastrophic for a FIELD addition: adding `owner` would
 * have thrown away the sector, the ERP, the printer and the albarán's paper — every answer the
 * person had given — because one new key made the number disagree.
 *
 * The rest of this file already had the right discipline written into it: «a field that does not
 * survive its own validator takes the default; the rest are kept, so one new question never throws
 * away nine answered ones». The version guard was the one place that did not obey it. So the guard
 * is now DIRECTIONAL — a config from the PAST is read field by field, a config from a FUTURE build
 * is the only thing that resets — and every field validates alone, which is what makes that safe.
 */
/* 3 · the version the house's own name landed in (AUDIT-2 C13). `brand.name` defaulted to the
   VENDOR's name until this build, so any config written before it carries «Rocoto» in the field
   that means «what this merchant is called». The parse below drops exactly that value on a v2
   store — a targeted migration rather than a reset, which is what this guard exists to avoid. */
export const CONFIG_VERSION = CEDAR_CONFIG_PEN_VERSION;

/** WHAT THE FIELD USED TO DEFAULT TO, kept only so the migration can recognise it. */
const VENDOR_NAME = 'Rocoto';

/** The starting answers. A prototype must be legal before anybody answers anything, so these are
 *  the commonest house in the trade rather than blanks: fish, WhatsApp, tiers, a van. */
export const DEFAULTS: AppConfig = {
  version: CONFIG_VERSION,
  sector: ['fish'],
  cast: 'fish',
  capture: { default: 'whatsapp' },
  gate: { mode: 'odd', threshold: seedSoles(300) },
  pricing: { level: 2 },
  weighing: { default: 'some' },
  goodsIn: { door: 'both' },
  stock: { mode: 'none' },
  delivery: { mode: 'van' },
  lots: { mode: 'print' },
  erp: { target: 'file' },
  notes: {},
  emailFeed: { connected: false, address: '' },
  /* ── THE HOUSE'S NAME IS THE HOUSE'S (§53 · §43, AUDIT-2 C13) ───────────────────────────────
     This default read `'Rocoto'` — OUR name, seeded into the field that means «what this merchant
     is called» — and every consumer of `brand.name` treats it as the house: `print-view` passes it
     as `house` on all three papers, Tu negocio draws it at 26px over «Razón social · Peix Vilalta,
     S.L.», and the agent's own sign-off says «on behalf of ___». So the demo house's albaranes
     went out under the vendor's name, and its business card wore it beside its real CIF, with the
     CIF's own line naming Rocoto forty pixels below — one word doing two companies.
     §53's whole point is that this object is the MERCHANT's company. It seeds from the cast like
     every other name in this file (cast law 10), and `Rocoto` stays what it always was: the name
     of the product, written where the product speaks about itself. */
  brand: { name: HOUSE.name, line: '' },
  /* The Cedar development operator is shared with its roster and account page. */
  owner: { name: CEDAR_OPERATOR_NAME },
  /* Cedar's commerce walkthrough starts priced; the workspace retains its own later choice. */
  albaran: { values: 'valued', shape: 'full' },
  confirmation: { includePrices: false },
  productRequests: { suggestNewSkus: false, erpLines: 'base-item-note' },
};

/* ── THE SECTOR GATE (LOT-LAW §"What this means" §3 and §4) ───────────────────────────────────
 * The one place the config is not free: a sector decides what a lot answer may be, because the
 * law decides it. Fish lots must reach the buyer (Reg 931/2011 art 3.1), so the albarán either
 * prints them or points at a document that resolves. Meat carries the lot/remesa the same way.
 * Produce legitimately has none most days, and that is what "not our sector" means here.
 */

export type LotOption = { value: LotsMode; available: boolean; because?: string };

export function lotOptions(sector: SectorKey[]): LotOption[] {
  const fish = sector.includes('fish');
  const meat = sector.includes('meat');
  const because = fish
    ? 'Fish lots reach the buyer with the goods, so the delivery note prints them or points at the supplier document.'
    : meat
      ? 'The lot or remesa reference reaches the buyer, so the delivery note prints it or points at the supplier document.'
      : undefined;
  return [
    { value: 'print', available: true },
    { value: 'reference', available: true },
    { value: 'none', available: !fish && !meat, because },
  ];
}

/** The sector gate at albarán close, per LOT-LAW §4 — fish hard, meat conditional, produce on
 *  origin and category. A mixed house takes the strictest gate its families demand. */
export type ReleaseGate = 'hard' | 'conditional' | 'origin+category';

export const releaseGate = (sector: SectorKey[]): ReleaseGate =>
  sector.includes('fish') ? 'hard' : sector.includes('meat') ? 'conditional' : 'origin+category';

export const RELEASE_GATE_TEXT: Record<ReleaseGate, string> = {
  hard: 'A line releases once its lote is on it.',
  conditional: 'A line releases once it records which box label carries the reference.',
  'origin+category': 'A line releases on origen and categoría; the lote rides along when there is one.',
};

/* ── NORMALISE ────────────────────────────────────────────────────────────────────────────────
 * Every write goes through here, so the structure is legal at rest and the sector gate holds even
 * when the sector changes AFTER the lots question was answered. That is the Russian doll's floor:
 * re-answering question 1 in Settings repairs question 9 rather than leaving it illegal.
 */
export function normalize(c: AppConfig): AppConfig {
  const sector = c.sector.length ? c.sector : DEFAULTS.sector;
  const cast = sector.includes(c.cast) ? c.cast : sector[0];
  const lot = lotOptions(sector).find((o) => o.value === c.lots.mode);
  const lots = lot && lot.available ? c.lots : { mode: 'reference' as LotsMode };
  const threshold = Number.isFinite(c.gate.threshold) && c.gate.threshold > 0
    ? Math.round(c.gate.threshold)
    : DEFAULTS.gate.threshold;
  return {
    ...c,
    sector,
    cast,
    lots,
    gate: { ...c.gate, threshold },
    albaran: {
      ...c.albaran,
      values: capabilityAvailable('albaranValues') ? c.albaran.values : 'unvalued',
    },
  };
}

/* ── PERSISTENCE ──────────────────────────────────────────────────────────────────────────── */

export const STORAGE_KEY = 'rocoto-app-config';

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);

/** Read the stored answers back into the shape this build knows. A field that does not survive
 *  its own validator takes the default; the rest are kept, so one new question never throws away
 *  nine answered ones. */
export function parseConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== 'object') return DEFAULTS;
  const source = raw as Record<string, unknown>;
  /* ── THE VERSION GUARD IS DIRECTIONAL (and this is the whole of the migration story) ────────
   * A config written by an OLDER build is read field by field: every reader below already falls
   * back on its own, so the fields this build has gained take their defaults and the fields the
   * person actually answered survive. That is the only behaviour that lets the canon keep growing —
   * THE-ADMIN-CANON §3 says «this list is built to keep growing; every new field lands here first»,
   * and a store that reset on every addition would make each new field cost the person their setup.
   *
   * A config written by a NEWER build is the one case that resets, because a field this code has
   * never heard of cannot be validated by it and half-reading a future shape is how a store starts
   * lying. `version` missing entirely is treated as ancient rather than as broken. */
  const stored = typeof source.version === 'number' ? source.version : 0;
  if (stored > CONFIG_VERSION) return DEFAULTS;
  const r = migrateConfigCurrency(source) as Record<string, unknown>;
  const obj = (k: string): Record<string, unknown> =>
    (r[k] && typeof r[k] === 'object' ? (r[k] as Record<string, unknown>) : {});
  const sectors = Array.isArray(r.sector)
    ? (r.sector.filter((s) => s === 'fish' || s === 'meat' || s === 'fruit') as SectorKey[])
    : DEFAULTS.sector;
  const level = Number(obj('pricing').level);
  return normalize({
    version: CONFIG_VERSION,
    sector: sectors.length ? sectors : DEFAULTS.sector,
    cast: oneOf<SectorKey>(r.cast, ['fish', 'meat', 'fruit'], DEFAULTS.cast),
    capture: { default: oneOf<CaptureDoor>(obj('capture').default, ['whatsapp', 'calls', 'voice', 'reps'], DEFAULTS.capture.default) },
    gate: {
      mode: oneOf<GateMode>(obj('gate').mode, ['all', 'odd', 'threshold'], DEFAULTS.gate.mode),
      threshold: Number(obj('gate').threshold) || DEFAULTS.gate.threshold,
    },
    pricing: { level: (level === 1 || level === 2 || level === 3 || level === 4 ? level : DEFAULTS.pricing.level) as PricingLevel },
    weighing: { default: oneOf<WeighingDefault>(obj('weighing').default, ['most', 'some', 'rarely'], DEFAULTS.weighing.default) },
    goodsIn: { door: oneOf<GoodsInDoor>(obj('goodsIn').door, ['paper', 'email', 'both'], DEFAULTS.goodsIn.door) },
    stock: { mode: oneOf<StockMode>(obj('stock').mode, ['connected', 'declared', 'none'], DEFAULTS.stock.mode) },
    delivery: { mode: oneOf<DeliveryMode>(obj('delivery').mode, ['van', 'agency', 'collect'], DEFAULTS.delivery.mode) },
    lots: { mode: oneOf<LotsMode>(obj('lots').mode, ['print', 'reference', 'none'], DEFAULTS.lots.mode) },
    erp: { target: oneOf<ErpTarget>(obj('erp').target, ['sage50', 'holded', 'a3', 'file'], DEFAULTS.erp.target) },
    notes: (r.notes && typeof r.notes === 'object' ? (r.notes as AppConfig['notes']) : {}),
    /* A CONFIG STORED BEFORE THESE FIELDS EXISTED IS STILL A GOOD CONFIG. They validate to the
       default one field at a time, so a set of answers written by an earlier build survives
       whole — the same rule the ten answers already keep.

       AND A CONFIG STORED WITH A FIELD THIS BUILD RETIRED IS STILL A GOOD CONFIG. This return is
       a WHITELIST: it names the fields this build holds and constructs a fresh object out of
       them, so a key an older build wrote is read by nobody and travels nowhere. `loadConfig`
       writes the parsed object back whenever the stored version is the older one, which is how
       the retired key leaves the browser as well as the session — the migration is the shape of
       this parse rather than a step beside it. `mailbox` — «Gmail connection; Microsoft 365
       connection», two booleans a Money setup step wrote — left the shape here when the live
       mailbox capability (`email-provider.ts`) became the one answer to that question.
       `app/tools/test-cedar-config.mjs` opens a v1 store carrying it and reads the nine answers
       back. */
    emailFeed: {
      connected: obj('emailFeed').connected === true,
      address: typeof obj('emailFeed').address === 'string' ? (obj('emailFeed').address as string) : '',
    },
    brand: {
      /* A v2 STORE THAT SAYS «Rocoto» IS SAYING THE OLD DEFAULT, NOT A CHOICE (C13). Nobody typed
         it; it was seeded. A house that has genuinely renamed itself since keeps whatever it
         typed, and a v3 store is taken at its word whatever it says. */
      name: typeof obj('brand').name === 'string' && (obj('brand').name as string).trim()
        && !(stored < 3 && (obj('brand').name as string).trim() === VENDOR_NAME)
        ? (obj('brand').name as string)
        : DEFAULTS.brand.name,
      line: typeof obj('brand').line === 'string' ? (obj('brand').line as string) : '',
    },
    albaran: {
      values: oneOf<AlbaranValues>(obj('albaran').values, ['valued', 'unvalued'], DEFAULTS.albaran.values),
      shape: oneOf<AlbaranShape>(obj('albaran').shape, ['full', 'compact'], DEFAULTS.albaran.shape),
    },
    confirmation: { includePrices: obj('confirmation').includePrices === true },
    productRequests: {
      suggestNewSkus: obj('productRequests').suggestNewSkus === true,
      erpLines: oneOf(obj('productRequests').erpLines, ['base-item-note', 'mapped-variation'] as const, 'base-item-note'),
    },
    /* A CONFIG STORED BEFORE THE OWNER EXISTED IS STILL A GOOD CONFIG — it simply has no person
       on it yet, and takes the cast's. This one line is what the directional guard above bought. */
    owner: {
      name: cedarOperatorName(obj('owner').name, CASTS[oneOf<SectorKey>(r.cast, ['fish', 'meat', 'fruit'], DEFAULTS.cast)].owner.name),
    },
  });
}

export function loadConfig(): AppConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const source: unknown = JSON.parse(raw);
    const parsed = parseConfig(source);
    const stored = source && typeof source === 'object' && typeof (source as Record<string, unknown>).version === 'number'
      ? (source as Record<string, unknown>).version as number
      : 0;
    if (stored < CONFIG_VERSION) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch (error) {
        console.warn('Rocoto will retry the config currency upgrade on the next boot', error);
      }
    }
    return parsed;
  } catch {
    return DEFAULTS;
  }
}

export function saveConfig(c: AppConfig): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

export function clearConfig(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** THE HOUSE THAT IS STANDING, read straight off the store.
 *
 *  A store that seeds itself per house needs this answer BEFORE any provider mounts — `company.ts`
 *  computes its defaults at module load, from a non-component, and there is no context above it to
 *  ask. So the config offers the one field, read through the same parser every other reader uses,
 *  and nobody outside this file writes a `localStorage` key that belongs to it. */
export const standingSector = (): SectorKey => loadConfig().cast;

/* ── THE KEYS THE APP OWNS, IN ONE PLACE (FEED-IA §89.2) ──────────────────────────────────────
 * The founder's two acts below re-seed the app, and a re-seed is only total if it reaches EVERY
 * store the app has accumulated. So the list of what a seeded world is made of lives here, once,
 * and the next store to land registers by adding its key to it.
 *
 * WHAT BELONGS ON THIS LIST: any key holding the HOUSE'S OWN DATA — the answers, the company card
 * and its roster and zones, the catalogue, the accounts written in the composer, the grants, the
 * imports and menus, the partners and their runs, the print queue, the rules, the tarifas. All of
 * it is seeded from a cast, all of it is edited in place, and all of it belongs to the house that
 * is standing rather than to the person looking at it.
 *
 * WHAT STAYS OFF IT: a person's own view preference. `rocoto-rail-open` is whether the rail is
 * open — the same fact about the same person whichever house they are demoing — so it survives
 * both acts and the rail comes back the width they left it.
 *
 * THE KEYS ARE WRITTEN OUT RATHER THAN IMPORTED from the stores that own them, deliberately: half
 * of those stores import this file, so pulling their constants in here would put the config at the
 * bottom of an import cycle to learn fourteen strings. The strings are the contract; the comment
 * above is what keeps them honest.
 */
export const SEEDED_KEYS: string[] = [
  STORAGE_KEY,
  /* THE ACTIVATION RECORD IS THE HOUSE'S OWN (THE CHECKPOINT §13.5). The tests it completed and
     the cohort it turned on belong to the house that is standing, exactly as its grants and its
     imports do — so a switch to the meat house starts that house's rollout at nothing, and a
     Reset returns it to the seed. Registered here by the rule this list's own header states. */
  'rocoto-app-activation',
  'rocoto-albaran-paper-review-v1',
  'rocoto-app-note-reviews', 'rocoto-app-note-reviews-v2',
  'rocoto-app-company',
  'rocoto-app-catalogue',
  'rocoto-app-customers-made',
  'rocoto-app-grants',
  'rocoto-app-imports',
  'rocoto-app-menus',
  'rocoto-app-partners',
  'rocoto-app-partners-seeded',
  'rocoto-app-partner-runs',
  'rocoto-app-print',
  /* A TRUCK A HAND MOVED IS THE HOUSE'S OWN RECORD TOO (THE CHECKPOINT §19.7) — it names one of
     this house's orders and one of this house's runs, and neither survives a switch. */
  'rocoto-app-round-override',
  'rocoto-app-rules',
  'rocoto-app-rules-seeded',
  'rocoto-app-tiers',
  'rocoto-app-day', 'rocoto-app-units', // §142: the same house reset clears its design ledger and units.
];

/**
 * SEED THE WHOLE APP INTO ONE HOUSE — the act both founder controls are made of.
 *
 * ═══ WHY IT BOOTS (FEED-IA §89.2) ═══════════════════════════════════════════════════════════
 * Half this app's stores are MODULE SINGLETONS that read `localStorage` once at import: the
 * catalogue's, the grants', the rules', the company's. They publish to their own subscribers and
 * they never re-read the key underneath them, which is correct for a store and fatal for a swap —
 * a house switched in place would leave four stores holding the house that just left.
 *
 * So a full re-seed IS a fresh boot, and the boot is what makes the swap total: the keys go, the
 * new house's config is written, and every singleton reads the world again on the way up. The
 * config persists across that reload, which is exactly the persistence §89.2 asks for — «I just
 * change which seeded data it has», and it is still that house tomorrow.
 */
function seedInto(sector: SectorKey): void {
  resetCollectionWorkspace(sector);
  const cast = CASTS[sector];
  /* THE HOUSE'S OWN NAME AND ITS OWNER'S COME OFF THE CAST (law 10 — a name is the cast's). The
     rest starts at DEFAULTS, because a fresh house has answered nothing yet. */
  const next = normalize({
    ...DEFAULTS,
    sector: [sector],
    cast: sector,
    brand: { name: cast.house.name, line: DEFAULTS.brand.line },
    owner: { name: CEDAR_OPERATOR_NAME },
  });
  try {
    for (const key of SEEDED_KEYS) window.localStorage.removeItem(key);
    // These candidate fixtures are scoped per house; a reseed also resets its finance examples.
    for (const key of Object.keys(window.localStorage)) {
      if ((['rocoto-cedar-money-', 'rocoto-cedar-finance-', 'rocoto-cedar-onboarding-', 'rocoto-cedar-meta-preview-', 'rocoto-workspace-capabilities:']
        .some(prefix => key.startsWith(prefix))) && key.endsWith(`:${sector}`)) window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* a prototype in a private window still has to run */
  }
  window.location.reload();
}

/** THE FOUNDER'S OWN ACT (FEED-IA §89.2). Switching a house re-seeds the whole app. */
export function switchHouse(sector: SectorKey): void {
  seedInto(sector);
}

/** The seeded world returns to its seed. */
export function resetHouse(): void {
  seedInto(standingSector());
}

/* ── DERIVE — config → the app's emphasis ─────────────────────────────────────────────────────
 * THE-APP §"Derivation rules", made typed. Every field is a DEFAULT or an EMPHASIS. Nothing here
 * removes a surface: `stock.mode === 'none'` makes stock QUIET, never absent; `delivery.mode ===
 * 'collect'` de-emphasises rounds, and la entrega stays on the albarán.
 */

/** What Prices leads with, and where an item's accordion opens. */
export type PriceLead = 'list' | 'tiers' | 'anchor' | 'grid';

/** What Goods leads with. Three leads, one surface — the other two stay on it. */
export type GoodsLead = 'goods-in' | 'announcement' | 'feed';

/** How loudly a line asks for a weight. Every line can still be weighed. */
export type WeighPrompt = 'every-line' | 'variable-lines' | 'on-request';

export type Derived = {
  /** the cast the app draws with, and the sector set it came from */
  cast: Cast;
  sectors: SectorKey[];
  mixed: boolean;
  /** the two facts a line's secondary row shows, per family (A1's sector delta) */
  lineFields: string[];

  /* A LABEL AND A SHORT FORM, side by side, for a reason: a chip holds a NAME and a row holds a
     SENTENCE. Putting the sentence in the chip truncates it to «Today opens on t…», which is a
     fact the reader cannot use. So every derivation that appears in both places carries both. */
  capture: { front: CaptureDoor; label: string; short: string };

  queue: {
    /** Today's queue filter default */
    filter: 'all' | 'flagged';
    label: string;
    short: string;
    /** the number A5's threshold uses, when a threshold is what they said */
    threshold: number | null;
  };

  prices: {
    /** the level an item's Price Accordion OPENS at */
    opensAt: PricingLevel;
    lead: PriceLead;
    leadLabel: string;
    /** the slot queue stands on Today only when prices are set by hand each day */
    slotQueueOnToday: boolean;
    /** levels 3 and 4 both produce a daily log, so the item's price over time is a chart */
    dailyLog: boolean;
  };

  weighing: { prompt: WeighPrompt; label: string };

  goods: {
    /** which captura door is front; the others remain one tap away */
    frontDoor: GoodsInDoor;
    frontDoorLabel: string;
    lead: GoodsLead;
    leadLabel: string;
    /** the announcement leads, the feed leads with override chips, or stock is quiet */
    stockVoice: 'declared' | 'connected' | 'quiet';
  };

  dispatch: {
    /** rounds lead the surface, or step back and let la entrega carry it */
    rounds: 'lead' | 'quiet';
    roundsLabel: string;
    gate: ReleaseGate;
    gateLabel: string;
  };

  lots: {
    mode: LotsMode;
    label: string;
    short: string;
    /** the trazabilidad block prints the codes rather than a pointer */
    onAlbaran: boolean;
  };

  erp: { target: ErpTarget; label: string; fileLabel: string };

  /* THE PAPER'S OWN TWO FACTS (FEED-IA §37.7). `valued` and `compact` are the booleans the print
     view actually branches on; `format` is the sheet `el papel` draws, so the page count the queue
     counts down and the page count the preview shows come off one answer. */
  albaran: {
    values: AlbaranValues;
    valued: boolean;
    shape: AlbaranShape;
    compact: boolean;
    /** the paper the sheet is set on — the full sheet, or the half a compact albarán prints on */
    format: 'a4' | 'a5';
    valuesLabel: string;
    valuesShort: string;
    shapeLabel: string;
    shapeShort: string;
  };
};

const CAPTURE_LABEL: Record<CaptureDoor, string> = {
  whatsapp: 'WhatsApp leads the capture',
  calls: 'Calls lead the capture',
  voice: 'Voice leads the capture',
  reps: 'The reps’ own orders lead the capture',
};

const PRICE_LEAD_LABEL: Record<PriceLead, string> = {
  list: 'Prices lead with the list',
  tiers: 'Prices lead with the tiers',
  anchor: 'Prices lead with the anchor and its offsets',
  grid: 'Prices lead with the day’s grid',
};

const WEIGH_LABEL: Record<WeighPrompt, string> = {
  'every-line': 'Every line opens with the scale',
  'variable-lines': 'Lines that vary by weight open with the scale',
  'on-request': 'The scale opens on the line that asks for it',
};

const GOODS_DOOR_LABEL: Record<GoodsInDoor, string> = {
  paper: 'The camera is the front door at the bay',
  email: 'The email inbox is the front door',
  both: 'The camera and the inbox share the front door',
};

const GOODS_LEAD_LABEL: Record<GoodsLead, string> = {
  'goods-in': 'Goods leads with la captura',
  announcement: 'Goods leads with the Stock Announcement',
  feed: 'Goods leads with the email feed and its override chips',
};

const CAPTURE_SHORT: Record<CaptureDoor, string> = {
  whatsapp: 'WhatsApp',
  calls: 'Calls',
  voice: 'Voice',
  reps: 'The reps',
};

/* THE STRANGER TEST (THE-APP-V2 §6.7). «"Lotes on the line" — what the hell does that mean?» It
 * reads as an idiom («on the line» = at stake) rather than as a fact about the document, which is
 * exactly why nobody could decode it. The short form rides a CHIP, which Base truncates at
 * scale3200, so the fix cannot be a longer sentence — it has to be a shorter true one: say what
 * happens to the lote and stop. The full sentence lives in LOTS_LABEL below, where there is room
 * for it. */
const LOTS_SHORT: Record<LotsMode, string> = {
  print: 'Lote printed',
  reference: 'Lote by document',
  none: 'Origen, categoría',
};

const LOTS_LABEL: Record<LotsMode, string> = {
  print: 'The delivery note prints the lote on every line it has one for',
  reference: 'The delivery note points at the supplier document, and the pointer opens it',
  none: 'The delivery note carries origen and categoría; the lote rides along when there is one',
};

/* WHAT THE PAPER CARRIES, SAID AS WHAT IT CARRIES (FEED-IA §37.7). Both sentences state the
 * document that holds the money, because a house that prints goods only has the amounts on its
 * invoice — that is the arrangement, and it is the fact worth saying. */
const VALUES_LABEL: Record<AlbaranValues, string> = {
  valued: 'The delivery note prints each line’s price and the total.',
  unvalued: 'The delivery note prints the goods, and the invoice carries the amounts.',
};

const VALUES_SHORT: Record<AlbaranValues, string> = {
  valued: 'With prices',
  unvalued: 'Goods only',
};

const SHAPE_LABEL: Record<AlbaranShape, string> = {
  full: 'The full A4 sheet: the lote in its own column, and room around the lines.',
  compact: 'The compact A5 half sheet: the lote under the name, and the same trazabilidad.',
};

/** The row's own words for it. A trailing column clips to one line, so the shape says its paper
 *  and its register in three words and the card says the sentence. */
const SHAPE_SHORT: Record<AlbaranShape, string> = {
  full: 'A4, full',
  compact: 'A5, compact',
};

const ERP_LABEL: Record<ErpTarget, string> = {
  sage50: 'Sage 50',
  holded: 'Holded',
  a3: 'A3',
  file: 'the day’s file',
};

export function derive(c: AppConfig): Derived {
  const cast = cedarCast(CASTS[c.cast]);
  const level = c.pricing.level;
  const lead: PriceLead = level === 1 ? 'list' : level === 2 ? 'tiers' : level === 3 ? 'anchor' : 'grid';
  const goodsLead: GoodsLead =
    c.stock.mode === 'declared' ? 'announcement' : c.stock.mode === 'connected' ? 'feed' : 'goods-in';
  const prompt: WeighPrompt =
    c.weighing.default === 'most' ? 'every-line' : c.weighing.default === 'some' ? 'variable-lines' : 'on-request';
  const gate = releaseGate(c.sector);
  const albaranValues: AlbaranValues = capabilityAvailable('albaranValues') ? c.albaran.values : 'unvalued';

  return {
    cast,
    sectors: c.sector,
    mixed: c.sector.length > 1,
    lineFields: cast.families.flatMap((f) => f.lineFields).filter((f, i, a) => a.indexOf(f) === i),

    capture: {
      front: c.capture.default,
      label: CAPTURE_LABEL[c.capture.default],
      short: CAPTURE_SHORT[c.capture.default],
    },

    queue: {
      filter: c.gate.mode === 'all' ? 'all' : 'flagged',
      label:
        c.gate.mode === 'all'
          ? 'Today opens on the whole queue'
          : c.gate.mode === 'odd'
            ? 'Today opens on the flagged orders'
            : `Today opens on the orders over ${soles(c.gate.threshold)}`,
      /* the threshold's unit shares the number's line, in the chip as everywhere else */
      short:
        c.gate.mode === 'all'
          ? 'The whole queue'
          : c.gate.mode === 'odd'
            ? 'Flagged orders'
            : `From ${soles(c.gate.threshold)}`,
      threshold: c.gate.mode === 'threshold' ? c.gate.threshold : null,
    },

    prices: {
      opensAt: level,
      lead,
      leadLabel: PRICE_LEAD_LABEL[lead],
      slotQueueOnToday: level === 4,
      dailyLog: level >= 3,
    },

    weighing: { prompt, label: WEIGH_LABEL[prompt] },

    goods: {
      frontDoor: c.goodsIn.door,
      frontDoorLabel: GOODS_DOOR_LABEL[c.goodsIn.door],
      lead: goodsLead,
      leadLabel: GOODS_LEAD_LABEL[goodsLead],
      stockVoice: c.stock.mode === 'declared' ? 'declared' : c.stock.mode === 'connected' ? 'connected' : 'quiet',
    },

    dispatch: {
      rounds: c.delivery.mode === 'collect' ? 'quiet' : 'lead',
      roundsLabel:
        c.delivery.mode === 'van'
          ? 'Dispatch leads with the day’s rounds'
          : c.delivery.mode === 'agency'
            ? 'Dispatch leads with the rounds the agency collects'
            : 'Dispatch leads with the pickups, and la entrega stays on the delivery note',
      gate,
      gateLabel: RELEASE_GATE_TEXT[gate],
    },

    lots: {
      mode: c.lots.mode,
      label: LOTS_LABEL[c.lots.mode],
      short: LOTS_SHORT[c.lots.mode],
      onAlbaran: c.lots.mode === 'print',
    },

    erp: {
      target: c.erp.target,
      label: ERP_LABEL[c.erp.target],
      fileLabel: c.erp.target === 'file' ? 'Today’s file' : `Today’s file, for ${ERP_LABEL[c.erp.target]}`,
    },

    albaran: {
      values: albaranValues,
      valued: albaranValues === 'valued',
      shape: c.albaran.shape,
      compact: c.albaran.shape === 'compact',
      format: c.albaran.shape === 'compact' ? 'a5' : 'a4',
      valuesLabel: VALUES_LABEL[albaranValues],
      valuesShort: VALUES_SHORT[albaranValues],
      shapeLabel: SHAPE_LABEL[c.albaran.shape],
      shapeShort: SHAPE_SHORT[c.albaran.shape],
    },
  };
}

/* ── THE CONTEXT ──────────────────────────────────────────────────────────────────────────────
 * One object, one setter, and the derivation beside it — so a surface never re-derives by hand
 * and two surfaces can never disagree about what the answers mean.
 */

export type ConfigState = {
  config: AppConfig;
  derived: Derived;
  /** merge a patch and persist. Every write is normalised, so the sector gate always holds. */
  set: (patch: Partial<AppConfig> | ((prev: AppConfig) => Partial<AppConfig>)) => boolean;
  /** back to the starting answers, with nothing remembered */
  reset: (preserveCast?: SectorKey) => boolean;
};

const ConfigContext = React.createContext<ConfigState>({
  config: DEFAULTS,
  derived: derive(DEFAULTS),
  set: () => false,
  reset: () => false,
});

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<AppConfig>(() => loadConfig());
  /* ── THE ACCOUNTS THE HOUSE WROTE ITSELF (FEED-IA §86.5) ────────────────────────────────────
   * «It should let them enter a new customer bro.» A customer born in the composer has to BE a
   * customer everywhere — the river, the search, the book, every fold — so it is merged onto the
   * cast HERE, at the one place the app reads a cast from, rather than being a second class of
   * person every surface would have to know about.
   *
   * THE IDENTITY IS STABLE WHILE THE BOOK IS. Half this app memoises on the cast's own identity
   * (`buildSales`'s fold cache among them), so the merge is memoised on the two things it is made
   * of and a render that changes neither hands back the very same object. With nothing made, it
   * hands back the CAST ITSELF — a house that has never written an account pays nothing at all for
   * this, not even one extra array. */
  const made = useMadeCustomers(config.cast);
  const derived = React.useMemo<Derived>(() => {
    const base = derive(config);
    if (made.length === 0) return base;
    return { ...base, cast: { ...base.cast, customers: [...base.cast.customers, ...made] } };
  }, [config, made]);

  const configRef = React.useRef(config);
  configRef.current = config;
  const set = React.useCallback<ConfigState['set']>((patch) => {
    const prev = configRef.current;
    const next = normalize({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) });
    if (!saveConfig(next)) return false;
    configRef.current = next;
    setConfig(next);
    return true;
  }, []);
  React.useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = loadConfig(); configRef.current = next; setConfig(next);
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  const reset = React.useCallback<ConfigState['reset']>((preserveCast = configRef.current.cast) => {
    const next = normalize({ ...DEFAULTS, sector: [preserveCast], cast: preserveCast });
    if (!saveConfig(next)) return false;
    configRef.current = next;
    setConfig(next);
    return true;
  }, []);

  const value = React.useMemo<ConfigState>(
    () => ({ config, derived, set, reset }),
    [config, derived, set, reset],
  );

  return React.createElement(ConfigContext.Provider, { value }, children);
}

/** The one hook every surface in the app reads. A screen never holds an answer. */
export const useConfig = (): ConfigState => React.useContext(ConfigContext);
