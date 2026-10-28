import { cedarOperator, cedarOperatorName } from './cedar-operator';
/* THE COMPANY — the fourth main object, and everything Administration is a reading of.
 *
 * ═══ WHY THIS FILE EXISTS (FEED-IA §53 · THE-ADMIN-CANON §1, §3) ════════════════════════════
 * «Another MAIN object is our company, meaning our customers' company; its sub-objects are THEIR
 * USERS.» The app already carried three objects — the ORDER, the CUSTOMER, the PRODUCT — and every
 * one of them has a home area, a card, and doors in and out. The COMPANY had none: its facts were
 * scattered across `config.brand`, the cast, and seven unrelated sections of a settings page, and
 * the two facts §53 actually leads with — «all your CIF, all the fiscal stuff» and «the main
 * address, PUT THEM ON THE MAP» — did not exist at all.
 *
 * So this is the company's store, and its sub-objects' with it: the people (§4's rights model) and
 * the zones (the bands Geografía is about). One store, because the five clauses of the card style
 * are only true of one object if there is only one of it.
 *
 * ═══ IT COPIES `config.ts`, DELIBERATELY AND EXACTLY ════════════════════════════════════════
 * Same versioned parse, same per-field tolerance, same normalise-on-every-write, same «a field
 * that fails its own validator takes the default and the rest are kept». THE-ADMIN-CANON §3 states
 * the requirement that discipline exists for: «this list is built to keep growing — every new field
 * lands here first, and the store parses per-field so one new field keeps every answered one». A
 * store that reset on a version bump would charge the person their whole setup for every field the
 * canon adds, which would make the canon expensive to grow — and the canon growing is the point.
 *
 * ═══ WHY A STORE AND NOT THE CONFIG CONTEXT ═════════════════════════════════════════════════
 * `grants.ts`'s own reasoning, for the same reason: a module singleton published through
 * `useSyncExternalStore` is readable from a non-component (a fold, a script, a seat's derived
 * count) and re-renders every reader on the same write, with no provider to mount above them. The
 * config is a context because it predates that lesson; this file takes the shape the app settled on.
 *
 * ═══ THE SEEDS COME OUT OF THE CAST ═════════════════════════════════════════════════════════
 * Law 10 — NO NAME IS TYPED INTO A SCREEN — applies to the tenant's own name as much as to a
 * customer's. A cast's `house`, `owner`, `team` and `runs` are the cast's; this file arranges them
 * into the canon's shape and never invents one of them.
 *
 * ═══ AND THERE ARE THREE HOUSES NOW (FEED-IA §89.2) ═════════════════════════════════════════
 * «I wanted it seeded with data for a fish company, for a meat company, and for a vegetable
 * company… I just change which seeded data it has.» So the defaults are a FUNCTION of a sector —
 * `companyDefaults(sector)` — and `COMPANY_DEFAULTS` is that function applied to the house that is
 * STANDING. Every existing caller keeps working unchanged and every one of them means the same
 * thing it always meant: «the seeded answers of the house this app is running as».
 *
 * WHY THIS FILE MAY READ `config.ts`. The standing house lives in the config store, and the seam
 * has to be readable from a NON-COMPONENT at module load — the defaults below are computed once,
 * before any provider mounts, from a file that has no context above it. `config.ts` imports React,
 * the cast and `customers-made`, and none of those reach back here, so the edge is one-way and the
 * cycle the store discipline fears cannot form. The alternative — re-reading and re-parsing the
 * config's own `localStorage` key from this file — would put a second reader on a key this file
 * does not own, which is the split-brain the config's parser exists to prevent.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';
import { CASTS, type Person, type RoleId, type RunSeed } from '../../scenarios/data/cast';
import { standingSector } from './config';
import { zoneNameOf } from './round-map';
import { seedSoles } from './currency';
import { CEDAR_COMPANY_PEN_VERSION, migrateCompanyCurrency } from './currency-migration';

/* ── THE FIELDS (THE-ADMIN-CANON §3) ──────────────────────────────────────────────────────── */

/** THE MERCANTILE REGISTRY'S FOUR. Cheap to hold now, needed the day a formal contract or a
 *  document footer is generated — which is the day it would be expensive to go and ask for. */
export type Registry = { volume: string; folio: string; sheet: string; entry: string };

/** AN ALMACÉN. The house has one today and the shape is a list, because a distribuidor that opens
 *  a second one does not want a redesign — and because the fiscal domicile and the warehouse are
 *  two fields modelled apart, which is the error this shape refuses to make. */
export type Warehouse = {
  id: string;
  name: string;
  address: string;
  /** the pin — the same construction a customer gets (§25.4), real tiles and all */
  at?: { lat: number; lng: number };
};

/** ── ONE WHATSAPP NUMBER, AND WHO HOLDS IT (THE CHECKPOINT §3 · §22 · MAP 3.8, 22.5) ─────────
 *  «When multiple WhatsApp numbers exist, responsibility for a number should be associable with a
 *  team member.» So a number is an OBJECT and not a string: a house with a comercial's line beside
 *  the office line has two rows, each answering «whose is this?» with a person on the roster.
 *
 *  THE OWNER IS A `Member.id`, NEVER A NAME. A name copied onto a second store drifts the day
 *  somebody is renamed; an id is a door into the roster, which is the grammar the escalation map
 *  already speaks. It is ABSENT while nobody holds a number, because a house's main line is often
 *  everybody's — and a field that had to be filled would make the app invent an owner. */
export type WhatsAppLine = {
  /** the number as a person recognises it, in the form they would read it aloud */
  number: string;
  /** the member who answers it, where one does — `Member.id` */
  owner?: string;
};

/** HOW THE HOUSE GETS PAID BY ITS CUSTOMERS. The one source of truth when the agent is asked
 *  «¿cómo os pago?» — and deliberately not the card that pays Rocoto, which lives on the plan. */
export type PaymentTerms = 'onDelivery' | 'thirtyDays' | 'sepa' | 'transfer';

export const PAYMENT_TERMS: Array<{ value: PaymentTerms; label: string }> = [
  { value: 'onDelivery', label: 'On delivery' },
  { value: 'thirtyDays', label: '30 days' },
  { value: 'sepa', label: 'SEPA direct debit' },
  { value: 'transfer', label: 'Bank transfer' },
];

/** WHAT GOES OUT WHEN THE SHELF HAS SOMETHING ELSE. The trade's most common judgment call, and the
 *  agent READS it — the rule is the house's, which is why it lives in Operations.
 *
 *  IT IS NAMED FOR WHAT HAPPENS, NOT FOR WHAT FAILED. «When a line cannot be served» was the first
 *  wording and a drive caught it: a negative spends the reader's attention on the thing you are
 *  trying to keep out of their head. Something always goes out — the nearest thing, a question, or
 *  the rest of the order — and that is what the row says. */
export type Substitution = 'substitute' | 'ask' | 'remove';

export const SUBSTITUTIONS: Array<{ value: Substitution; label: string; hint: string }> = [
  { value: 'substitute', label: 'Send the nearest thing', hint: 'Rocoto puts the closest catalogue line on and says which one it sent.' },
  { value: 'ask', label: 'Ask the customer', hint: 'Rocoto asks them what to do with that line and keeps the rest moving.' },
  { value: 'remove', label: 'Leave the line off', hint: 'The rest of the order goes out, and the delivery note says the line was short.' },
];

/** THE HOURS THE HOUSE KEEPS. Three of them, because they are three different promises: when the
 *  goods move, when the office answers, and when the AGENT may say somebody is here. */
export type Hours = { warehouse: string; office: string; support: string };

/** THE VOICE (THE-ADMIN-CANON §5's deliberated additions). What the agent answers by, which
 *  languages it holds, and whether it says tú or usted — a real Spanish decision, not a nicety. */
export type Address = 'tu' | 'usted';

export type Language = 'es' | 'ca' | 'en';

export const LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: 'es', label: 'Castellano' },
  { value: 'ca', label: 'Català' },
  { value: 'en', label: 'English' },
];

export type AgentVoice = {
  /** the name it answers by on the phone and on WhatsApp */
  name: string;
  /** the languages it holds a conversation in */
  languages: Language[];
  /** tú or usted */
  address: Address;
};

/** WHERE A TOPIC GOES WHEN ROCOTO HANDS IT OVER. Topic → a person on the team, and the one line
 *  it says meanwhile so a customer is never left holding silence. */
export type EscalationTopic = 'price' | 'claim' | 'newAccount' | 'credit';

export const ESCALATION_TOPICS: Array<{ value: EscalationTopic; label: string }> = [
  { value: 'price', label: 'A price still to set' },
  { value: 'claim', label: 'A complaint about goods' },
  { value: 'newAccount', label: 'A house ordering for the first time' },
  { value: 'credit', label: 'Credit and payment terms' },
];

/** WHAT THE HOUSE HEARS ABOUT, AND WHERE. «The channel here is mostly WhatsApp itself — every
 *  invisible event surfaces» (THE-ADMIN-CANON §2.1). */
export type NotifyEvent = 'standing' | 'escalation' | 'goodsIn' | 'daySheet';

export type NotifyChannel = 'whatsapp' | 'email' | 'app';

export const NOTIFY_EVENTS: Array<{ value: NotifyEvent; label: string; sub: string }> = [
  { value: 'standing', label: 'An order is waiting for you', sub: 'Rocoto brought one to the desk instead of answering it.' },
  { value: 'escalation', label: 'A customer was handed over', sub: 'Rocoto passed a conversation to somebody on the team.' },
  { value: 'goodsIn', label: 'Goods arrived', sub: 'A supplier delivery note landed in the incoming log.' },
  { value: 'daySheet', label: 'The day’s file went out', sub: 'Everything the day carried reached your ERP.' },
];

export const NOTIFY_CHANNELS: Array<{ value: NotifyChannel; label: string }> = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'app', label: 'In the app' },
];

/** THE BAND THE HOUSE IS ON (memory: rocoto-pedidos-pricing — PEQ · MED · GRA, seats plus a
 *  per-order rate, three months up front). The figures are the ones that shipped in the pricing
 *  rewrite, and every one of them renders with its unit on the number's own line. */
export type PlanBand = 'peq' | 'med' | 'gra';

export type Band = {
  value: PlanBand;
  label: string;
  /** what it costs a month, in euros — the RATE, which is what leads (the price-unit law) */
  rate: number;
  /** how many people the band seats */
  seats: number;
  /** what one order costs beyond the band, in cents */
  perOrder: number;
};

export const BANDS: Band[] = [
  { value: 'peq', label: 'Pequeño', rate: 199, seats: 3, perOrder: 12 },
  { value: 'med', label: 'Mediano', rate: 499, seats: 10, perOrder: 9 },
  { value: 'gra', label: 'Grande', rate: 1499, seats: 40, perOrder: 6 },
];

/** HOW LONG WHAT A CUSTOMER SAID IS KEPT. The dial is the surface; the policy call is Peter's and
 *  is recorded as open (THE-ADMIN-CANON §9).
 *
 *  ⚠ THIS DIAL AND THE PHONE RAIL'S RETENTION NOTICE ARE ONE STATEMENT (E195.41 · §195). They were
 *  two, and they disagreed: this dial said «Recordings and transcripts are cleared after ninety
 *  days» while `retentionClock()` on the phone rail said audio goes the moment its transcript is
 *  ready and transcript text lives twelve months. One tenant, two answers to «how long do you keep
 *  my calls» — a checkout-level inconsistency, and both surfaces are in the same app.
 *
 *  THE LINE BETWEEN THEM. This dial governs the TRANSCRIPT: the words a customer said are the
 *  house's own record, so the period is the house's own choice. AUDIO IS NOT A DIAL — it goes as
 *  soon as its transcript is ready, and at thirty days when none arrives (VOICE-09B's custody
 *  class). So both surfaces state the audio rule in the same sentence and neither offers to change
 *  it, and `voice.ts`'s `retentionClock()` builds all five lines out of the value chosen here:
 *  one drawing, one number (§137.1).
 *
 *  `days` is the number the runtime's sweep spends — `ROCOTO_TRANSCRIPT_RETENTION_DAYS`, or a call
 *  record's own `transcriptRetentionDays` once a writer stamps one. 0 means the clock is off, which
 *  is what 0 means on all three of the runtime's knobs. */
export type Retention = 'ninety' | 'year' | 'keep';

export const RETENTIONS: Array<{ value: Retention; label: string; sub: string; kept: string; days: number }> = [
  { value: 'ninety', label: '90 days', days: 90,
    kept: 'Kept 90 days',
    sub: 'What a customer said is kept ninety days, and goes as it ages out.' },
  { value: 'year', label: 'A year', days: 365,
    kept: 'Kept 12 months',
    sub: 'A full trading year of what customers said is kept, and goes as it ages out.' },
  { value: 'keep', label: 'Kept', days: 0,
    kept: 'Kept until you ask for it to go',
    sub: 'Everything a customer said stays until you ask for it to go.' },
];

/** A ZONE'S BAND — what the agent PROMISES about ground the house covers. Wrong band, wrong
 *  promise, which is why these five facts are editable in place on the zone's own card. */
export type ZoneBand = {
  /** the id the customers already carry (`cast.ts`), so a zone and its book cannot drift */
  id: string;
  /* ── THE HOUSE'S OWN WORD FOR THE RUN (FEED-IA §122) ────────────────────────────────────────
   * The map seeds a name — «Litoral», «Gràcia» — and it was the ONLY name a run could have: the
   * zone card printed it as a heading nothing could touch, so a house that calls its coast run
   * «Costa Norte» had to read somebody else's word for its own territory on every chip in the app.
   * A run's name is AUTHORED, and §122 says an authored value is live.
   * ABSENT until somebody renames one, which is what keeps `zoneWordOf` honest: the house's word
   * where there is one, the map's seed everywhere else, and never a stored copy of the seed. */
  name?: string;
  /** the vans on it — two on the long runs, which is why truck and zone are two facts */
  trucks: number[];
  /** the comercial who holds it — a door into Team */
  comercial: string;
  /** the days the van goes out on this run, as `Date.getDay()` numbers */
  days: number[];
  /** the hour an order has to be in by, for that day */
  cutoff: string;
  /** the smallest order the run will carry, in euros */
  minimum: number;
  /** carriage is on the house above this figure, in euros */
  carriage: number;
};

/** ONE OF THE HOUSE'S PEOPLE, as the store keeps them. `Person` is the cast's shape; the store
 *  adds nothing to it and simply owns the list, so a person added here and a person seeded from
 *  the cast are the same kind of thing on the same card. */
export type Member = Person;

export type Company = {
  version: number;

  /* ── Identidad fiscal ──────────────────────────────────────────────────────────────────── */
  /** Razón social — every albarán and factura the system touches carries it, and VeriFactu 2027
   *  makes fiscal identity the data other systems consume */
  legalName: string;
  /** «Super important» (§53). Rocoto's own invoices to the house need it, so Plan depends on it. */
  taxId: string;
  registry: Registry;

  /* ── Direcciones ───────────────────────────────────────────────────────────────────────── */
  /** the domicile that goes on documents */
  fiscalAddress: string;
  /** WHERE ROCOTO'S OWN INVOICE IS MADE OUT TO (THE CHECKPOINT §2 · §4 · MAP 2.4). It is a
   *  SECOND field and not a reading of the first: a group whose accounts are done at head office
   *  bills there and delivers here, and a house that has never said so is billed at its domicile.
   *  So it SEEDS from `fiscalAddress` and moves on its own from the moment anybody edits it. */
  billingAddress: string;
  /** the places the goods actually are, pinned */
  warehouses: Warehouse[];

  /* ── Cobro ─────────────────────────────────────────────────────────────────────────────── */
  /** the COLLECTION account — the house charging its restaurants */
  iban: string;
  terms: PaymentTerms;

  /* ── Contacto público ──────────────────────────────────────────────────────────────────── */
  phone: string;
  /** the numbers Rocoto answers on, each with the person who holds it (22.5, 3.8) */
  whatsapp: WhatsAppLine[];
  email: string;

  /* ── The working style (Operations) ────────────────────────────────────────────────────── */
  hours: Hours;
  /* ── THE HOUSE'S OWN ORDER CUTOFF (FEED-IA §132.1) ──────────────────────────────────────────
   * «Every company has their own for when they accept orders for the following morning… for 6am
   * delivering for the following morning it's 2hrs later at 8am. That's in operations.»
   *
   * The hour a house stops taking orders for TOMORROW. It is a fact about the day's rhythm and not
   * a promise about a run: the ZONE's own `cutoff` (Geography) narrows it per run, exactly the way
   * a zone narrows the delivery days. This is the house-wide answer the agent speaks from when a
   * customer asks «¿hasta qué hora puedo pedir?», and Rocoto reads it — it never decides it.
   *
   * IT IS AUTHORED, SO IT IS LIVE (§122): the row is a `LiveValue`, one press, no confirm. */
  orderCutoff: string;
  substitution: Substitution;

  /* ── The agent's own identity (Your agent) ─────────────────────────────────────────────── */
  agent: AgentVoice;
  /** topic → the member it goes to */
  escalation: Record<EscalationTopic, string>;
  /** the one line it says while the handover happens */
  holdingLine: string;

  /* ── The app's own knobs (App settings) ────────────────────────────────────────────────── */
  language: Language;
  notify: Record<NotifyEvent, NotifyChannel>;

  /* ── Money and data ────────────────────────────────────────────────────────────────────── */
  band: PlanBand;
  /** the card that pays Rocoto, as the four digits a person recognises it by */
  card: string;
  retention: Retention;

  /* ── The sub-objects ───────────────────────────────────────────────────────────────────── */
  members: Member[];
  zones: ZoneBand[];
};

/**
 * THE VERSION, AND WHAT A BUMP COSTS.
 *
 * Same contract as `config.ts`: a stored object from an OLDER build is read field by field, and
 * only a NEWER one resets. So adding a field to the canon costs one entry in the type, one line in
 * the parser, and nobody's answers.
 */
export const COMPANY_VERSION = CEDAR_COMPANY_PEN_VERSION;

/** the zone's own name for a heading — the house's word for the run, off `round-map-geo` */
export const zoneName = (id: string): string => zoneNameOf(id) ?? id;

/* ── THE STARTING HOUSE ───────────────────────────────────────────────────────────────────────
 * A prototype must be legal before anybody answers anything, so these are a real distribuidor's
 * real answers rather than blanks — the cast's own house, arranged into the canon's shape.
 *
 * THE ZONES ARE FOLDED OUT OF THE RUNS, never listed twice. Two vans on one zone is one zone with
 * two trucks, which is exactly what the runs already say and what a person reading Geografía has to
 * see: the coast is one promise carried by two vehicles.
 *
 * IT TAKES THE RUNS AS AN ARGUMENT because there are three houses and each one drives its own
 * ground (§89.2). A fold that reached for one house's runs would hand every house the fish house's
 * zones, and Geografía would draw a map of somebody else's morning.
 */
const seedZones = (runs: RunSeed[]): ZoneBand[] => {
  const by = new Map<string, ZoneBand>();
  runs.forEach((run, i) => {
    const held = by.get(run.zone);
    if (held) {
      held.trucks.push(run.truck);
      return;
    }
    by.set(run.zone, {
      id: run.zone,
      trucks: [run.truck],
      comercial: run.comercial,
      /* the near runs go out every trading day; the two that reach up the coast go alternate days,
         which is what a van that drives forty kilometres actually does */
      days: i >= 5 ? [1, 3, 5] : [1, 2, 3, 4, 5, 6],
      cutoff: i >= 5 ? '18:00' : '20:00',
      minimum: seedSoles(i >= 5 ? 150 : 80),
      carriage: seedSoles(i >= 5 ? 400 : 250),
    });
  });
  return [...by.values()];
};

/**
 * WHERE A TOPIC GOES, DERIVED FROM THE ROSTER RATHER THAN NAMED (§89.2).
 *
 * The map used to read `price: 'nuria'` · `claim: 'montse'` · `newAccount: 'owner'`, and all three
 * of those ids belong to the FISH house. Seeded onto a meat house they would point at people who
 * are not on it, and every handover would name a stranger — an escalation that resolves to nobody
 * is the agent promising a person who cannot be reached.
 *
 * So the seeds are read off the cast's own people, by the ROLE the topic belongs to: a price goes
 * to somebody who sells, a claim and a credit question go to the office, and a house that has never
 * ordered goes to the person whose account this is. A house with no office falls back to the owner,
 * which is what a small house actually does.
 */
const seedEscalation = (owner: Person, team: Person[]): Record<EscalationTopic, string> => {
  const holder = (role: RoleId): string => (team.find((p) => p.role === role) ?? owner).id;
  return {
    price: holder('comercial'),
    claim: holder('oficina'),
    newAccount: owner.id,
    credit: holder('oficina'),
  };
};

/**
 * THE SEEDED ANSWERS OF ONE HOUSE (FEED-IA §89.2).
 *
 * Everything a cast knows about itself, arranged into the canon's shape: its fiscal identity, its
 * almacén and its pin, its collection account, its public contacts, its roster and its zones. What
 * is NOT a fact about a particular house — the hours a market house keeps, the band it is on, the
 * card that pays Rocoto, the way it answers on the phone — is the same starting answer for all
 * three, because those are the app's own defaults and the house edits them in Administration.
 */
export function companyDefaults(sector: SectorId): Company {
  const { house, owner, team, runs } = CASTS[sector];
  return {
    version: COMPANY_VERSION,

    legalName: house.legalName,
    taxId: house.taxId,
    registry: house.registry,

    fiscalAddress: house.fiscalAddress,
    /* THE DOMICILE, UNTIL SOMEBODY SAYS OTHERWISE. A blank here would ask a house to type an
       address it has already given, which is the pointless field §3 sends this whole canon after. */
    billingAddress: house.fiscalAddress,
    warehouses: [
      { id: 'main', name: house.warehouse.name, address: house.warehouse.address, at: house.warehouse.at },
    ],

    iban: house.iban,
    terms: 'thirtyDays',

    phone: house.phone,
    /* ONE NUMBER, AND THE OWNER IT REALLY HAS. The house's WhatsApp is the gerente's line in all
       three casts — it is the number on their own listing — so the seed says so rather than
       leaving an owner nobody set. A second line is added in Connections. */
    whatsapp: [{ number: house.whatsapp, owner: owner.id }],
    email: house.email,

    hours: { warehouse: '04:30 – 13:00', office: '08:00 – 18:00', support: '06:00 – 20:00' },
    /* 18:00 — the hour the seeded houses close tomorrow's list, twelve hours before the 06:00 van.
       Every house rewrites it; nothing in the app assumes this number (§132.1). */
    orderCutoff: '18:00',
    substitution: 'ask',

    agent: { name: 'Rocoto', languages: ['es', 'ca'], address: 'usted' },
    escalation: seedEscalation(owner, team),
    holdingLine: 'Lo miro y le digo enseguida.',

    language: 'es',
    notify: { standing: 'whatsapp', escalation: 'whatsapp', goodsIn: 'app', daySheet: 'email' },

    band: 'med',
    card: '4242',
    retention: 'year',

    members: team.map((p) => ({ ...(p.id === owner.id ? cedarOperator(p) : p), admin: p.id === owner.id })),
    zones: seedZones(runs),
  };
}

/**
 * THE STANDING HOUSE'S OWN DEFAULTS — what every reader in this file means by «the seed».
 *
 * `parseCompany`'s per-field fallbacks, `read()` and `resetCompany()` all fall back to this object,
 * and all three of them are asking the same question: «what does the house this app is running as
 * start out saying?» Pointing it at the standing sector is what keeps that question answerable
 * after a switch — a stored field read against another house's defaults would fill a gap with a
 * stranger's CIF. The founder's act clears this store before it boots (`config.ts` SEEDED_KEYS), so
 * a stored house and a standing house are always the same house by the time anything parses.
 */
export const COMPANY_DEFAULTS: Company = companyDefaults(standingSector());

/* ── NORMALISE ────────────────────────────────────────────────────────────────────────────────
 * Every write goes through here, so the structure is legal at rest and the two invariants that are
 * actually load-bearing hold however a surface writes:
 *
 *   1 · SOMEBODY HOLDS THE ADMIN RIGHT. A house that switched the last admin off would be locked
 *       out of its own business — and a switch that can lock you out is a switch that will. So the
 *       last one on stays on, exactly the way the last sector and the last delivery day do.
 *   2 · A ZONE SERVES AT LEAST ONE DAY. A zone with no days is a promise the agent cannot keep, and
 *       the honest way to stop serving a zone is to remove the zone.
 *   3 · A NUMBER NEVER NAMES SOMEBODY WHO LEFT. An owner is a `Member.id`, and a person can be
 *       taken off the roster from another card entirely — so the id is checked against the roster
 *       on every write and a stale one is cleared. An unowned number is an honest state; a number
 *       owned by a name the Team card no longer holds is the app pointing at nobody.
 */
export function normalizeCompany(c: Company): Company {
  const admins = c.members.filter((m) => m.admin);
  const members = admins.length > 0
    ? c.members
    : c.members.map((m, i) => (i === 0 ? { ...m, admin: true } : m));
  const zones = c.zones.map((z) => (z.days.length ? z : { ...z, days: [1, 2, 3, 4, 5, 6] }));
  const onRoster = new Set(members.map((m) => m.id));
  const whatsapp = c.whatsapp.map((w) => (w.owner && !onRoster.has(w.owner) ? { number: w.number } : w));
  return { ...c, members, zones, whatsapp };
}

/* ── PERSISTENCE ──────────────────────────────────────────────────────────────────────────── */

export const COMPANY_STORAGE_KEY = 'rocoto-app-company';

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' && v.trim() ? v : fallback;

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);

const numberIn = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : fallback;

const dayList = (v: unknown, fallback: number[]): number[] => {
  const days = Array.isArray(v) ? v.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6) : [];
  return days.length ? days : fallback;
};

const ROLES: RoleId[] = ['gerente', 'comercial', 'almacen', 'repartidor', 'oficina'];

/** Read a stored house back into the shape this build knows. Field by field, so one new field in
 *  the canon never throws away twenty answered ones. */
export function parseCompany(raw: unknown): Company {
  if (!raw || typeof raw !== 'object') return COMPANY_DEFAULTS;
  const source = raw as Record<string, unknown>;
  const stored = typeof source.version === 'number' ? source.version : 0;
  /* a house written by a FUTURE build is the only reset — see `config.ts` for the reasoning */
  if (stored > COMPANY_VERSION) return COMPANY_DEFAULTS;
  const r = migrateCompanyCurrency(source) as Record<string, unknown>;

  const obj = (k: string): Record<string, unknown> =>
    (r[k] && typeof r[k] === 'object' ? (r[k] as Record<string, unknown>) : {});

  const registry = obj('registry');
  const hours = obj('hours');
  const agent = obj('agent');
  const escalation = obj('escalation');
  const notify = obj('notify');

  const warehouses = Array.isArray(r.warehouses)
    ? (r.warehouses as Record<string, unknown>[])
      .filter((w) => w && typeof w === 'object' && typeof w.id === 'string')
      .map((w, i) => {
        const at = w.at && typeof w.at === 'object' ? (w.at as Record<string, unknown>) : null;
        const fallback = COMPANY_DEFAULTS.warehouses[i] ?? COMPANY_DEFAULTS.warehouses[0];
        return {
          id: String(w.id),
          name: str(w.name, fallback.name),
          address: str(w.address, fallback.address),
          at: at && typeof at.lat === 'number' && typeof at.lng === 'number'
            ? { lat: at.lat, lng: at.lng }
            : fallback.at,
        } satisfies Warehouse;
      })
    : [];

  const members = Array.isArray(r.members)
    ? (r.members as Record<string, unknown>[])
      .filter((m) => m && typeof m === 'object' && typeof m.id === 'string' && typeof m.name === 'string')
      .map((m) => ({
        id: String(m.id),
        name: m.id === 'owner' ? cedarOperatorName(m.name, CASTS[standingSector()].owner.name) : String(m.name),
        role: oneOf<RoleId>(m.role, ROLES, 'comercial'),
        phone: str(m.phone, ''),
        email: typeof m.email === 'string' && m.email.trim() ? m.email : undefined,
        zone: typeof m.zone === 'string' ? m.zone : undefined,
        truck: typeof m.truck === 'number' ? m.truck : undefined,
        admin: m.admin === true,
        /* PENDING SURVIVES A RELOAD, and only pending is written: `invited: false` on twelve
           people is a fact about nothing (§3.3). */
        invited: m.invited === true ? (true as const) : undefined,
      } satisfies Member))
    : [];

  /* THE NUMBERS, EACH WITH WHOEVER ANSWERS IT. A stored string from the build before this one is
     read as the one number it was — the whole point of the per-field parse, and the cheapest
     possible migration of a field that changed shape rather than meaning. */
  const whatsapp = Array.isArray(r.whatsapp)
    ? (r.whatsapp as unknown[])
      .filter((w): w is Record<string, unknown> => Boolean(w) && typeof w === 'object')
      .map((w) => ({
        number: str(w.number, ''),
        owner: typeof w.owner === 'string' && w.owner ? w.owner : undefined,
      } satisfies WhatsAppLine))
      .filter((w) => w.number)
    : typeof r.whatsapp === 'string' && r.whatsapp.trim()
      ? [{ number: r.whatsapp }]
      : [];

  const zones = Array.isArray(r.zones)
    ? (r.zones as Record<string, unknown>[])
      .filter((z) => z && typeof z === 'object' && typeof z.id === 'string')
      .map((z) => {
        const seed = COMPANY_DEFAULTS.zones.find((s) => s.id === z.id) ?? COMPANY_DEFAULTS.zones[0];
        return {
          id: String(z.id),
          trucks: Array.isArray(z.trucks)
            ? (z.trucks as unknown[]).filter((t): t is number => typeof t === 'number')
            : seed.trucks,
          /* ABSENT STAYS ABSENT. Defaulting this to the seed would freeze the map's word into
             every house's storage on the first write to any OTHER field on the band. */
          ...(typeof z.name === 'string' && z.name.trim() ? { name: z.name.trim() } : null),
          comercial: str(z.comercial, seed.comercial),
          days: dayList(z.days, seed.days),
          cutoff: str(z.cutoff, seed.cutoff),
          minimum: numberIn(z.minimum, seed.minimum),
          carriage: numberIn(z.carriage, seed.carriage),
        } satisfies ZoneBand;
      })
    : [];

  return normalizeCompany({
    version: COMPANY_VERSION,

    legalName: str(r.legalName, COMPANY_DEFAULTS.legalName),
    taxId: str(r.taxId, COMPANY_DEFAULTS.taxId),
    registry: {
      volume: str(registry.volume, COMPANY_DEFAULTS.registry.volume),
      folio: str(registry.folio, COMPANY_DEFAULTS.registry.folio),
      sheet: str(registry.sheet, COMPANY_DEFAULTS.registry.sheet),
      entry: str(registry.entry, COMPANY_DEFAULTS.registry.entry),
    },

    fiscalAddress: str(r.fiscalAddress, COMPANY_DEFAULTS.fiscalAddress),
    /* A HOUSE THAT NEVER SAID WHERE TO BILL IT IS BILLED AT ITS DOMICILE — the stored domicile
       and not the seed's, so a house that moved and never touched billing moves with it. */
    billingAddress: str(r.billingAddress, str(r.fiscalAddress, COMPANY_DEFAULTS.billingAddress)),
    warehouses: warehouses.length ? warehouses : COMPANY_DEFAULTS.warehouses,

    iban: str(r.iban, COMPANY_DEFAULTS.iban),
    terms: oneOf<PaymentTerms>(r.terms, PAYMENT_TERMS.map((t) => t.value), COMPANY_DEFAULTS.terms),

    phone: str(r.phone, COMPANY_DEFAULTS.phone),
    whatsapp: whatsapp.length ? whatsapp : COMPANY_DEFAULTS.whatsapp,
    email: str(r.email, COMPANY_DEFAULTS.email),

    hours: {
      warehouse: str(hours.warehouse, COMPANY_DEFAULTS.hours.warehouse),
      office: str(hours.office, COMPANY_DEFAULTS.hours.office),
      support: str(hours.support, COMPANY_DEFAULTS.hours.support),
    },
    orderCutoff: str(r.orderCutoff, COMPANY_DEFAULTS.orderCutoff),
    substitution: oneOf<Substitution>(r.substitution, SUBSTITUTIONS.map((s) => s.value), COMPANY_DEFAULTS.substitution),

    agent: {
      name: str(agent.name, COMPANY_DEFAULTS.agent.name),
      languages: Array.isArray(agent.languages)
        ? ((agent.languages as unknown[]).filter((l): l is Language =>
          LANGUAGES.some((x) => x.value === l)) as Language[])
        : COMPANY_DEFAULTS.agent.languages,
      address: oneOf<Address>(agent.address, ['tu', 'usted'], COMPANY_DEFAULTS.agent.address),
    },
    escalation: {
      price: str(escalation.price, COMPANY_DEFAULTS.escalation.price),
      claim: str(escalation.claim, COMPANY_DEFAULTS.escalation.claim),
      newAccount: str(escalation.newAccount, COMPANY_DEFAULTS.escalation.newAccount),
      credit: str(escalation.credit, COMPANY_DEFAULTS.escalation.credit),
    },
    holdingLine: str(r.holdingLine, COMPANY_DEFAULTS.holdingLine),

    language: oneOf<Language>(r.language, LANGUAGES.map((l) => l.value), COMPANY_DEFAULTS.language),
    notify: {
      standing: oneOf<NotifyChannel>(notify.standing, NOTIFY_CHANNELS.map((c) => c.value), COMPANY_DEFAULTS.notify.standing),
      escalation: oneOf<NotifyChannel>(notify.escalation, NOTIFY_CHANNELS.map((c) => c.value), COMPANY_DEFAULTS.notify.escalation),
      goodsIn: oneOf<NotifyChannel>(notify.goodsIn, NOTIFY_CHANNELS.map((c) => c.value), COMPANY_DEFAULTS.notify.goodsIn),
      daySheet: oneOf<NotifyChannel>(notify.daySheet, NOTIFY_CHANNELS.map((c) => c.value), COMPANY_DEFAULTS.notify.daySheet),
    },

    band: oneOf<PlanBand>(r.band, BANDS.map((b) => b.value), COMPANY_DEFAULTS.band),
    card: str(r.card, COMPANY_DEFAULTS.card),
    retention: oneOf<Retention>(r.retention, RETENTIONS.map((x) => x.value), COMPANY_DEFAULTS.retention),

    members: members.length ? members : COMPANY_DEFAULTS.members,
    zones: zones.length ? zones : COMPANY_DEFAULTS.zones,
  });
}

function read(): Company {
  try {
    const encoded = window.localStorage.getItem(COMPANY_STORAGE_KEY);
    if (!encoded) return COMPANY_DEFAULTS;
    const source: unknown = JSON.parse(encoded);
    const migrated = migrateCompanyCurrency(source);
    const parsed = parseCompany(migrated);
    if (migrated !== source) {
      try {
        window.localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(parsed));
      } catch (error) {
        console.warn('Rocoto will retry the company currency upgrade on the next boot', error);
      }
    }
    return parsed;
  } catch {
    return COMPANY_DEFAULTS;
  }
}

let COMPANY: Company = typeof window === 'undefined' ? COMPANY_DEFAULTS : read();

const listeners = new Set<() => void>();

function publish(next: Company): boolean {
  const normalized = normalizeCompany(next);
  try {
    window.localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return false;
  }
  COMPANY = normalized;
  for (const l of listeners) l();
  return true;
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** WHAT A NON-COMPONENT READS — a fold, a derived count, a script. */
export const companyNow = (): Company => COMPANY;

const snapshot = companyNow;

/** Write one or more fields. Every write normalises, so the two invariants always hold. */
export function setCompany(patch: Partial<Company> | ((prev: Company) => Partial<Company>)): boolean {
  return publish({ ...COMPANY, ...(typeof patch === 'function' ? patch(COMPANY) : patch) });
}

/** Back to the starting house, with nothing remembered. */
export function resetCompany(): boolean {
  return publish(COMPANY_DEFAULTS);
}

/**
 * SEED THIS STORE FOR ANOTHER HOUSE (FEED-IA §89.2).
 *
 * A house switch hands Administration a different company: a different card, a different roster, a
 * different set of zones. This is that hand-off, and it is a normal publish — every seat reading
 * `useCompany` re-renders on it, in place, the same way they do when a CIF is edited.
 *
 * IT IS THE SEAM, AND THE FOUNDER'S CONTROL REACHES THE SAME PLACE THROUGH A BOOT. `config.ts`'s
 * `switchHouse` clears this store's key and reloads, because four other stores in this app read
 * their key once at import and a swap has to reach all of them (the reasoning is written out there).
 * This function is what a caller uses to move ONE store — this one — without a boot, and it is what
 * makes `companyDefaults` a seam rather than a private helper.
 */
export function reseedCompany(sector: SectorId): void {
  publish(companyDefaults(sector));
}

/** The hook every surface reads, so a field written on one seat re-renders the others. */
export const useCompany = (): Company => React.useSyncExternalStore(subscribe, snapshot, snapshot);

/* ── THE SUB-OBJECTS' OWN ACTS ────────────────────────────────────────────────────────────────
 * «Made within those parts» — clause four of the card style. A person is made inside Team and a
 * band is set inside Geografía, so the acts live here beside the store rather than inside a
 * component that happens to draw them.
 */

/** Change one person. */
export function setMember(id: string, patch: Partial<Member>): void {
  setCompany((c) => ({ members: c.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
}

/* ── ADDING A PERSON, AND INVITING ONE (THE CHECKPOINT §3 · FEED-IA §90.2) ────────────────────
 * «Invite by email; the invited user completes their own profile; no administrator filling
 * pointless fields for another person; friendly invitation state.» THE-ADMIN-CANON §4's
 * phone-first note yields to that, and Peter's §90.2 ruling is the one that stands: EMAIL LEADS.
 *
 * TWO ACTS, BECAUSE THEY ARE TWO THINGS. `addMember` writes somebody who is already here — the
 * seeded roster, a person the house is recording. `invite` writes somebody who has been WRITTEN
 * TO and has answered nothing: the address, the role the house chose for them, and no other field
 * touched. What arrives on acceptance is theirs to fill in.
 *
 * THE ADDRESS FIELD TAKES BOTH, and the fork is recorded rather than decided (MAP 3.2): an
 * address with an `@` in it is an email and anything else is a number, so a house that works by
 * WhatsApp is not stopped at the door while email leads the copy.
 */

/** Add one who is already here. */
export function addMember(person: {
  name?: string; phone?: string; email?: string; role: RoleId; invited?: true;
}): string {
  /* THE NAME IS THE ADDRESS UNTIL THEY GIVE ONE. A roster row has to draw something, and the
     address is what the house actually knows about a person it has only written to. */
  const shown = person.name ?? person.email ?? person.phone ?? '';
  const id = `p-${shown.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`;
  setCompany((c) => ({
    members: [...c.members, {
      id,
      name: shown,
      role: person.role,
      phone: person.phone ?? '',
      email: person.email,
      invited: person.invited,
    }],
  }));
  return id;
}

/** Write to somebody who is not here yet. One address, one role, and nothing else asked. */
export function invite(address: string, role: RoleId): string {
  const said = address.trim();
  const byMail = said.includes('@');
  return addMember({
    email: byMail ? said : undefined,
    phone: byMail ? undefined : said,
    role,
    invited: true,
  });
}

/** Who is still waiting to answer — the count the Team card says out loud (§3.4). */
export const invitedCount = (c: Company): number => c.members.filter((m) => m.invited).length;

/* ── THE INVITE'S OTHER TWO ENDS (THE CHECKPOINT §3.4 — P5's acts, on P0's field) ─────────────
 * `invite()` above opens the state; these two close it, and they live HERE beside it so the whole
 * lifecycle is one vocabulary in one store rather than a verb in the store and two open-coded
 * writes in a component. There is no second store and no second truth: both are ordinary writes
 * against `Member.invited`.
 *
 * AND THERE IS DELIBERATELY NO `resendInvite`. Sending an invite a second time writes nothing —
 * it is the same invite, to the same address, with the same role waiting behind it — so a store
 * act would be a function that changes no state pretending to be one. What the act actually owes
 * is the §76 answer («immediate feedback after saving»), and that is a sentence on the card the
 * press happened on. The day a real mailer exists it will owe a sent-at and a count, and THAT is
 * when this file gains the third verb.
 */

/** Take the invite back. It is `removeMember`'s write, said in the invite's own word: nothing of
 *  theirs is here yet, so taking the invite back and taking the person off are the same act — and
 *  it inherits the last-person guard, which is the only reason it routes through that function. */
export function revokeInvite(id: string): void {
  removeMember(id);
}

/** The invite's end. The pending mark comes off and the name THEY gave stands where the address
 *  the house typed had been standing. `invited: undefined` rather than `false`, because this store
 *  writes the field only while it is true (see `parseCompany`). */
export function acceptInvite(id: string, name: string): void {
  setMember(id, { name, invited: undefined });
}

/** Hand one of the house's numbers to one of its people, or take the owner off it (§3.8). */
export function setNumberOwner(number: string, owner: string | undefined): void {
  setCompany((c) => ({
    whatsapp: c.whatsapp.map((w) => (w.number === number ? { number: w.number, owner } : w)),
  }));
}

/** The number the house answers on — what a surface with room for one says (22.5). */
export const mainNumber = (c: Company): string => c.whatsapp[0]?.number ?? '';

/** Take one off the roster. The house keeps at least one person, for the same reason it keeps at
 *  least one admin: an empty team is a house nobody can sign into. */
export function removeMember(id: string): void {
  setCompany((c) => (c.members.length <= 1 ? {} : { members: c.members.filter((m) => m.id !== id) }));
}

/** Change one zone's band. */
/* ── WHAT THIS HOUSE CALLS THAT RUN (§122) ────────────────────────────────────────────────────
 * `bandOf`'s shape, for a name instead of a price: the house's own word wins, the map's seeded one
 * answers for every run nobody has renamed, and every surface that names a run reads THIS rather
 * than the raw seed. It lives here rather than beside the map because the fold is here, and
 * `round-map.tsx` may not import this module — `company.ts` already imports IT, and a cycle
 * between a store and the geography it names is how both stop being loadable.
 */
export const zoneWordOf = (id?: string): string | undefined => {
  if (!id) return undefined;
  const own = COMPANY.zones.find((z) => z.id === id)?.name;
  return own && own.trim() ? own : zoneNameOf(id);
};

export function setZone(id: string, patch: Partial<ZoneBand>): void {
  setCompany((c) => ({ zones: c.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) }));
}

/* ── READINGS ─────────────────────────────────────────────────────────────────────────────────
 * The company card «summarizes into its parts» (clause two), and every one of those summaries is
 * COUNTED off this store rather than typed — a headcount that disagreed with the roster under it
 * would be the software contradicting itself between two rows of one card.
 */

export const memberOf = (c: Company, id: string): Member | undefined => c.members.find((m) => m.id === id);

export const adminCount = (c: Company): number => c.members.filter((m) => m.admin).length;

export const bandOf = (c: Company): Band => BANDS.find((b) => b.value === c.band) ?? BANDS[1];

/* ── THE FISCAL IDENTITY, AS PAPER CARRIES IT (THE-ADMIN-CANON §3 · FEED-IA §53) ──────────────
 * «All your CIF, all the fiscal stuff… that should be something that's super important.» It is
 * super important for one concrete reason: **every albarán and factura the system touches carries
 * it**, and VeriFactu 2027 makes fiscal identity the data other systems consume — so the store
 * that holds it owes the PAPER an accessor rather than making the paper reach in and compose two
 * fields itself.
 *
 * TWO FACTS, ONE LINE, AND THE ORDER IS THE LAW'S. Razón social first because it is the entity;
 * the CIF second because it is that entity's number. They are joined here, once, so a document, a
 * footer and an invoice can never write the house's own identity three ways.
 *
 * IT IS THE LEGAL NAME AND NOT THE TRADE NAME. The wordmark on a paper's identity band is
 * `config.brand.name` — what the house is CALLED, the Stripe legal-vs-public split (canon §3) —
 * and this is what it IS. Both belong on a document that leaves the building, and they are two
 * fields precisely so neither has to stand in for the other.
 *
 * ═══ HOW THE PAPER CONSUMES IT (the seam, stated for whoever owns `print-view.tsx`) ══════════
 * `Identity({ house })` draws the wordmark inside a RESERVED band (`BAND`), so the fiscal line is
 * ONE line added under that band and not inside it — the band's height is what keeps the page's
 * geometry identical before and after a house has a logo, and growing it from within would move
 * every paper's first row. The whole consumption is:
 *
 *     const fiscal = useFiscalLine();          // inside Identity, beside `wordmarkFit`
 *     …
 *     <span data-house-fiscal>{fiscal}</span>  // under the reserved band, LabelXSmall, secondary
 *
 * Nothing else changes: `PaperHead`'s three-cell grid keeps its columns, and all three papers
 * (albarán · the day's sheet · the packing list) gain the line at once because all three draw the
 * same `Identity`.
 */

/** The house's legal identity as one line — «Peix Vilalta, S.L. · B-65 428 901». Pure, so a
 *  document, a test or a non-React caller can all ask the same question of the same object. */
export const fiscalLineOf = (c: Company): string => [c.legalName, c.taxId].filter(Boolean).join(' · ');

/** The same line, off the live store, for a component that draws it. It re-renders when the CIF is
 *  edited on the company card, which is what makes «change it once, it changes on the paper» true
 *  rather than a claim. */
export const useFiscalLine = (): string => fiscalLineOf(useCompany());

/* Inbound Rocoto order addresses are server-provisioned tenant objects. The browser never
 * derives or displays an alias from a legal name; Connections waits for a unique-alias and
 * ingestion-health receipt. */

/** THE ROLE'S OWN WORD, and the one line of what it may do (THE-ADMIN-CANON §4's bundles). */
export const ROLE_LABEL: Record<RoleId, string> = {
  gerente: 'Gerente',
  comercial: 'Comercial',
  almacen: 'Almacén',
  repartidor: 'Repartidor',
  oficina: 'Oficina',
};

export const ROLE_DOES: Record<RoleId, string> = {
  gerente: 'The business, the tarifas, the agent’s dials, the team.',
  comercial: 'Their own accounts and book, the tarifas in view, discount up to the ceiling.',
  almacen: 'Picking, stock and goods-in.',
  repartidor: 'Routes, entregas and cobros on the round.',
  oficina: 'Facturas and cobros.',
};

export const ROLES_IN_ORDER: RoleId[] = ['gerente', 'comercial', 'almacen', 'repartidor', 'oficina'];

/** Money as Spain writes it. The unit rides the number — never a line of its own (the price-unit
 *  law), which is why every caller gets a string with the € already inside it. */
export const euros = (n: number): string =>
  /* ── GROUPED FROM FOUR DIGITS, LIKE EVERY OTHER FIGURE THIS APP PRINTS ──────────────────────
   * Spanish CLDR groups only from FIVE digits up, so a plain `toLocaleString` printed the term
   * total as «1497 €» — a four-figure price read as a reference number, on the one surface whose
   * whole job is what the house pays. `knows.ts`'s own `count` made this ruling for the analysis
   * layer (AUDIT-2 C35); money on the Plan seat is the same number seen by the same eye. */
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions)} €`;

/** Cents, for the per-order rate a band charges beyond its seats. */
export const cents = (n: number): string => `${(n / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
