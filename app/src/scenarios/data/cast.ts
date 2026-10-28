/* THE CAST — BUILD-PLAN §5.4, and law 10: NO NAME IS TYPED INTO A SCREEN.
 *
 * Every house, person, product, customer, supplier and batch in the catalogue lives here, in one
 * file, so that «same screen, different data» is mechanically true and not a claim. A screen
 * imports the sector it is drawn with; the sector switch hands it a different one; the markup never
 * changes.
 *
 * ═══ THREE HOUSES, AT PARITY (FEED-IA §89.2) ════════════════════════════════════════════════
 * «I wanted [it] seeded with data for a fish company, for a meat company, and for a vegetable
 * [company], which I would be able to access if I go to settings and then the founder settings
 * tab… I'll be able to use it for demo.» So all three casts are FULL houses: their own identity,
 * their own owner, their own eight comerciales, their own eight runs, their own roster, their own
 * book of about three hundred accounts, their own shelf and their own lotes.
 *
 * AND THE HOUSE-LEVEL FACTS BELONG TO THE CAST, NOT TO THE MODULE. `house`, `owner`, `team` and
 * `runs` ride the cast, so switching the house switches the papers, the roster and the map with it.
 * The fish house's own are re-exported under their old names (`HOUSE`, `OWNER`, `TEAM`, `RUNS`,
 * `HOUSE_DOMAIN`, `COMERCIALES`) for the callers that still read one house — see `app/company.ts`.
 *
 * THE SECTOR ID FOR THE THIRD HOUSE STAYS `fruit`. Peter's word for it is the VEGETABLE house, and
 * `trade` carries that truth to every surface that says it out loud; the id stays as it is because
 * nine sector-keyed tables across `app/` are written in it, and renaming a key to improve a label
 * is a rename that buys nothing.
 *
 * PROVISIONAL NAMES (C-9). The meat and vegetable shelves and every one of their suppliers are the
 * trade's ordinary words rather than the founder's chosen ones. They carry `provisional: true`, the
 * shell draws them with a hairline underline and a «name pending» chip, and changing them later is
 * one edit to this file and zero screens. The first five meat products are verbatim from the
 * founder's own discovery script §2.9.
 *
 * LOCKED NAMES (brief §9) — these ship as written:
 *   products   Merluza · Gamba roja de Palamós · Pulpo · Rape · Lubina de estero ·
 *              Mango de barco · Aguacate Hass
 *   customers  Bar Manolo · Can Solé · Hotel Rec · Restaurant Nou · Distribuciones Vera
 *   supplier   Pescados Rubio
 *   batches    L-2208 · L-2211 · L-2214
 *
 * THE FISH HOUSE IS FROZEN. Its identity, its roster, its 296-row book in its own order, its ids,
 * its products, its lotes and its order are exactly what they were: three houses arrived by growing
 * the file around the first one, never by renumbering it. Every generator below takes a house's own
 * SALT, and the fish house's salt is zero — which is the mechanical reason its every derived fact
 * comes back the same.
 *
 * COPY LAW (C-1). Scenario copy is English. The trade's own nouns stay Spanish because they are
 * terms and not translations — albarán · lonja · lote · calibre · categoría · nota de venta ·
 * media canal · cansaladeria · destrío — and so do the family names, which are the trade's own
 * words for its own shelves.
 */
import type { SectorId, Verdict } from '../meta';

/** The four traceability profiles. Per FAMILY, never per account (C-2). */
export type TraceProfile = 'none' | 'lot' | 'lot+animal' | 'lot+fisheries';

/** Anything with a name carries the provisional flag, so the shell can mark it wherever it lands. */
export type Named = {
  name: string;
  /** the founder has not given this word yet — drawn underlined, with «name pending» */
  provisional?: boolean;
};

export type Family = Named & {
  id: string;
  traceability: TraceProfile;
  /** the whole field set the batch record carries (E3, H1, G1's sub-line) */
  recordFields: string[];
  /** the two facts an order line's secondary row shows (A1) */
  lineFields: string[];
};

/** A product whose imported or legacy category is absent must not inherit the first family in
 * the active cast. It has no traceability obligations until someone classifies it. */
export const UNCLASSIFIED_FAMILY: Family = {
  id: 'unclassified',
  name: 'Unclassified',
  traceability: 'none',
  recordFields: [],
  lineFields: [],
};

export type Product = Named & {
  id: string;
  /** ── THE HOUSE'S OWN REFERENCE (THE CHECKPOINT §16 · MAP 16.13) ───────────────────────────
   *  The code the house's own list calls this row by — what a comercial reads off a tarifa and
   *  what a customer's purchase order quotes. It is SEARCHED (`rowWords`), never displayed as a
   *  second name: a row already says what the goods are, and a code beside the name would be the
   *  ERP's habit, not this app's. Absent where a house has never numbered its shelf. */
  code?: string;
  /** Family.id */
  family: string;
  /** the unit the catalogue sells in */
  unit: string;
  /** the pack the market buys in and how many `unit` it holds. `nominal` where the ratio is a
   *  placeholder until the scale speaks (A9 → F1): a caja de Merluza is 6–7 kg. */
  pack?: { unit: string; factor: number; nominal?: boolean };
  /** the weight that leaves differs from the weight ordered (D13) */
  variableWeight: boolean;
  /** the family's field set, filled for this product */
  trace: Record<string, string>;
};

export type Customer = Named & {
  id: string;
  /** the channel this customer's orders arrive on (D1) */
  channel: 'WhatsApp' | 'phone' | 'email' | 'in person' | 'portal';
  /** the tier this customer sits on (D9.many / D10.tier-assignment) */
  tier: string;
  /* ── WHOSE CUSTOMER THIS IS (FEED-IA §12) ─────────────────────────────────────────────────
   * «The split of 30–50 customers per comercial. The things to resolve would really be per
   * comercial, but the total orders are one bunch.» So the comercial is a fact about the
   * CUSTOMER — the person who holds the account — and never a fact about an order or a screen.
   * The river and the day stay company-wide; only the resolving scopes. */
  /** `Comercial.id` of the person who holds this account */
  comercial?: string;
  /** how they settle — the flag that lights I3's cobro control (FLOWS §5, the cobro) */
  settles: 'credit' | 'cash on delivery';
  /* ── THE ROUND (FEED-IA §21.1) ────────────────────────────────────────────────────────────
   * «A fish distributor thinks in its RUTAS: city zones and coast runs, not administrative
   * borders.» So a customer belongs to one of the house's own delivery zones, and a truck runs
   * that zone. Both are seeded here because this is where the customers are seeded; the zone's
   * shape and its name live with the map that draws it. */
  /** the house's own delivery zone this customer sits in */
  zone?: string;
  /** the truck that runs their zone */
  truck?: number;
  /* ── WHERE THEY ACTUALLY ARE (FEED-IA §25) ────────────────────────────────────────────────
   * «The location has to be a PIN. Real map.» A zone says which run a drop belongs to; only a
   * coordinate says where the door is. Real places in the Barcelona area, each one inside the
   * run its `zone` names, so the pin and the chip beside it agree about the world. `pin-map.tsx`
   * draws it; the tiles under it are checked in by `tools/build-map-tiles.py`. */
  at?: { lat: number; lng: number };
  /* ── AND THE TWO FACTS A NEW ACCOUNT IS ASKED FOR AT BIRTH (FEED-IA §135) ─────────────────
   * The house's seeded book carries neither, and it does not need to: a seeded customer is one the
   * house has been delivering to for years and the van driver knows the door. An account written
   * THIS MORNING has nobody who knows it, so §135's modal asks for both — and they are fields on
   * the customer rather than a note anywhere else, because the albarán prints the address and the
   * reply goes to the number. Optional, so nothing in the cast has to be rewritten. */
  /** the number their orders and their replies go to */
  phone?: string;
  /** the door, as it would be printed — the line §135's localisation resolves to */
  address?: string;
  /** the customer-owned email address, where one has been deliberately provided */
  email?: string;
  /* ── THE PREFERRED SLOT (FEED-IA §21) ─────────────────────────────────────────────────────
   * «Most deliveries are for the MORNING OF — effectively one time. Some carry preferred slots.»
   * So this is ABSENT on most customers by design: a house whose every row carried an hour would
   * be a house that sorts its working list by the clock, and «processing beats chronology». The
   * few who asked for a time have it, and the sort that uses it lives on PAPER — the delivery
   * list prints by requested time, and the working list never does. */
  /** the hour this customer asked their drop to land, where they asked for one. THE SORT THAT
   *  USES IT LIVES ON PAPER: the day's sheet prints by requested time (print-view's `slotOf`),
   *  and a customer who asked for nothing takes the house's own delivery window there. */
  slot?: string;
  /* ── THE CUSTOMER'S OWN SYSTEM (FEED-IA §20) ──────────────────────────────────────────────
   * «If the CUSTOMER integrated their own ERP (tSpoonLab), the albarán can land straight in it.»
   * It is a fact about the customer — arranged once, with them — so it lives on the customer and
   * the print queue reads it off the sale. */
  erp?: { id: string; name: string };
};

export type Supplier = Named & { id: string };

/** One of the house's own people. A name, because §12 scopes the resolving to a PERSON and a row
 *  that said «comercial 3» would be the software making the reader do the lookup.
 *
 *  A WHOLE PERSON, NOT A NAME STRING (FEED-IA §67.1): «the ownership dropdown shows the person
 *  whole: name · their PHONE · their email where it exists — as another column in the drop-down
 *  etc etc — you see where I'm going.» So the reachable facts ride the object itself and every
 *  surface that names a comercial can reach them — the «Whose accounts» dropdown, the customer
 *  sheet's holder, the Team card, the zone card's comercial de zona. `phone` is held by all of
 *  them, because a house reaches its own people by WhatsApp; `email` is held by the ones the
 *  house gave an address to. */
export type Comercial = { id: string; name: string; phone: string; email?: string };

/** ONE OF THE HOUSE'S OWN PEOPLE. A role is a trade-named BUNDLE of what they may do — the
 *  Stripe/Uber lesson: named bundles scale to a six-person distribuidor, a per-toggle matrix scales
 *  to an enterprise sales call (THE-ADMIN-CANON §4). */
export type RoleId = 'gerente' | 'comercial' | 'almacen' | 'repartidor' | 'oficina';

export type Person = {
  id: string;
  name: string;
  role: RoleId;
  /** invites land by PHONE — repartidores are WhatsApp-first (§4) */
  phone: string;
  /** the house address, held by the people the house gave one to (§67.1's «where it exists») */
  email?: string;
  /** the run they hold, where they hold one: a comercial's territory, a repartidor's van */
  zone?: string;
  truck?: number;
  /** the admin right, held explicitly: who may edit the business, the tarifas and the agent */
  admin?: boolean;
  /** ── THE INVITE IS OUT AND NOBODY HAS ANSWERED IT (THE CHECKPOINT §3 · FEED-IA §90.2) ──────
   *  «Invite by email; the invited user completes their own profile; no administrator filling
   *  pointless fields for another person.» So a person can exist on the roster before they have
   *  a name, a phone or a zone: the address was sent to, the role was chosen for them, and
   *  everything else arrives when they accept. Absent on everybody who already answered — a
   *  field that said `invited: false` on thirteen people would be a fact about nothing. */
  invited?: true;
};

/** ONE RUN — one truck over one zone, held by one comercial, carrying `holds` accounts (FEED-IA
 *  §21: «houses run trucks per area… 1… 12»; §12's 30–50 per comercial).
 *
 *  IT IS EXPORTED NOW because Geografía is a reading of it (THE-ADMIN-CANON §2.1): the zones a
 *  house covers ARE its runs, and a seat that kept its own list of them would be a second truth
 *  about the same trucks. */
export type RunSeed = { truck: number; zone: string; comercial: string; holds: number };

/** WHAT A HOUSE IS CALLED AND EVERYTHING ADMINISTRATION READS (FEED-IA §53 · THE-ADMIN-CANON §3).
 *
 *  Every screen in Administration is about the house, so the house joins the cast — law 10 («NO
 *  NAME IS TYPED INTO A SCREEN») is not suspended because the name happens to be the tenant's.
 *  `legalName` and `name` are TWO fields doing two jobs: the Stripe split between the identity on
 *  the paper and the identity on the phone. `fiscalAddress` and `warehouse` are two fields for the
 *  same reason — conflating the domicile with the almacén is the classic error. */
export type House = {
  /** the one domain its people's addresses and its public inbox share */
  domain: string;
  name: string;
  legalName: string;
  taxId: string;
  registry: { volume: string; folio: string; sheet: string; entry: string };
  fiscalAddress: string;
  warehouse: { name: string; address: string; at: { lat: number; lng: number } };
  iban: string;
  phone: string;
  whatsapp: string;
  email: string;
};

export type Batch = {
  id: string;
  /** Product.id */
  product: string;
  /** Supplier.id */
  supplier: string;
  qty: number;
  /** what the distributor paid, per the product's unit */
  cost: number;
  /** the day it landed */
  day: string;
  /** ── THE LOTE'S OWN TRACEABILITY (THE CHECKPOINT §18 · MAP 18.3) ──────────────────────────
   *  The field set hung off the PRODUCT, so two lotes of one SKU could not differ on zona, arte,
   *  categoría or matadero — and differing is the whole reason a lote exists. Two landings of
   *  merluza in one week come off two boats and two grounds, and the albarán that goes with the
   *  crate has to say WHICH.
   *
   *  It is the FAMILY'S own field set, filled for this landing, and it is PARTIAL by design: a
   *  lote states what is true of it and the product's row answers the rest. The readers prefer
   *  the lote's value where it has one — the lot book and the albarán — which is what makes this
   *  field the more specific truth rather than a second copy of the same one. */
  trace?: Record<string, string>;
};

/** One line of the order A1 reads. */
export type OrderLine = {
  id: string;
  /** Product.id */
  product: string;
  qty: number;
  /** the unit the customer asked in — may differ from the catalogue's (D5) */
  unit: string;
  /** what the line was before Rocoto converted it, where it converted one (A7's supersede law) */
  wasQty?: number;
  price: number;
  /** Batch.id the line draws on */
  lot?: string;
};

export type Order = {
  /** the key is customer + delivery day, never the message (C-19) */
  customer: string;
  deliveryDay: string;
  placedAt: string;
  /** the customer's own words, kept beside the reading */
  words: string[];
  /** the same words as a transcript, for the surface that replays them */
  utterances: Array<{ at: number; text: string }>;
  lines: OrderLine[];
};

export type Cast = {
  sector: SectorId;
  /** the sector's own name, for the switch */
  label: string;
  /** the trade's own word for this house, for the founder's choice: 'Fish' · 'Meat' · 'Fruit and veg' */
  trade: string;
  /** the hour of the day this sector's morning turns on — fish 05:00, fruit 06:30, meat 08:00 */
  hour: string;
  /** the house itself — its name, its fiscal identity, its almacén */
  house: House;
  /** the person whose account this is; the rail's foot says her name */
  owner: Person;
  /** the whole roster, owner first, then the eight who hold the book, then the back office */
  team: Person[];
  /** the runs, one per truck */
  runs: RunSeed[];
  families: Family[];
  products: Product[];
  customers: Customer[];
  /** the people who hold the accounts (§12). All three houses split their book across eight. */
  comerciales: Comercial[];
  suppliers: Supplier[];
  batches: Batch[];
  /** the order A1 and every order-surface instantiation is drawn against */
  order: Order;
};

/* ── THE FAMILIES ─────────────────────────────────────────────────────────────────────────────
 * C-2, settled: D12 is a per-family traceability profile with four values. Sector is a preset
 * that picks a family's default, never a runtime branch. A mixed house — merluza and media canal
 * on one albarán — is two families in one catalogue and nothing special happens. */

export const PESCADO: Family = {
  id: 'pescado',
  name: 'pescado y marisco',
  traceability: 'lot+fisheries',
  recordFields: ['lote', 'nombre científico', 'zona', 'arte', 'método', 'descongelado', 'buque', 'fecha'],
  lineFields: ['zona', 'arte'],
};

export const CARNE: Family = {
  id: 'carne',
  name: 'carne',
  traceability: 'lot+animal',
  recordFields: ['lote', 'birth', 'rearing', 'slaughter', 'cutting', 'plant number'],
  lineFields: ['lote'],
};

export const FRUTA: Family = {
  id: 'fruta',
  name: 'fruta y verdura',
  traceability: 'lot',
  recordFields: ['lote', 'variedad', 'categoría', 'calibre', 'origen', 'GGN'],
  lineFields: ['calibre', 'categoría'],
};

/** The profile every family takes in an account that records nothing — group K's third rail, where
 *  the word «lote» is absent from the product entirely (brief §6). */
export const AMBIENT: Family = {
  id: 'ambient',
  name: 'ambiente y secos',
  traceability: 'none',
  recordFields: [],
  lineFields: [],
};

/* ── THE HOUSE'S OWN BOOK, AT THE SIZE IT REALLY IS (FEED-IA §31.1, §12) ──────────────────────
 * «Fill the data you've seeded — same scale order of magnitude as the actual customers we have,
 * otherwise it will be impossible to test.» A distribuidor doing 300 orders a day holds a book of
 * roughly three hundred accounts split across eight comerciales, and every pixel decision from
 * here on is judged at that load. Five hand-written rows proved the mechanics; they cannot prove
 * whether a column of three hundred reads calm — which is exactly why the meat and vegetable
 * houses grew from five rows to their own three hundred (§89.2).
 *
 * IT IS GENERATED, AND THAT IS THE HONEST FORM. Three hundred hand-typed rows would be three
 * hundred chances to drift; a generator states the RULE the book obeys — this many runs, this many
 * accounts each, these envelopes of ground — and the rule is the thing a reader can check. What it
 * may never be is random: `scatter` is a pure integer hash of the row's own index, so the same
 * morning comes back on every reload and a screenshot is the same screenshot twice. Nothing in
 * this file calls `Math.random` or reads a clock.
 *
 * THE FIVE LOCKED NAMES STAND FIRST AND UNTOUCHED (brief §9). Bar Manolo, Can Solé, Hotel Rec,
 * Restaurant Nou and Distribuciones Vera are the founder's own words and keep their zone, their
 * slot and their door; the fish book grows AROUND them.
 *
 * AND THE BOOK IS NOT «PROVISIONAL» (C-9). That flag marks VOCABULARY the founder has still to
 * choose — a product's name, a shelf's word — and drawing three hundred customers with a «name
 * pending» hairline would say the house does not know who its own customers are. A customer's name
 * belongs to the customer.
 */

/** A deterministic scatter: a pure hash of an index, in 0…1. The seed is the index itself, so a
 *  row's every derived fact is reproducible from its position and nothing else. */
export const scatter = (n: number): number => {
  let x = (n + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
};

/** One of `list`, chosen by the same scatter. */
export const scatterOf = <T>(list: readonly T[], n: number): T => list[Math.floor(scatter(n) * list.length) % list.length];

/** The same scatter, keyed by a row's own id rather than by its position — so a fact seeded onto a
 *  customer stays on that customer when the book around them grows or is reordered. */
export const scatterId = (id: string, salt = 0): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return scatter(((h >>> 0) % 1000003) + salt);
};

/** A PHONE NUMBER IN THE SPANISH MOBILE SHAPE, derived from the person's own place in the roster,
 *  so nothing in this file is a number somebody could mistake for a real one and every row still
 *  shows the shape of one: «+34 639 20 41 88».
 *
 *  THE HOUSE'S OWN SALT MOVES THE BAND. Three houses staff three rosters in one city, and two of
 *  their people holding one number would be a fact the app could contradict itself with — the Team
 *  card, the customer sheet's holder and the escalation row all reach a person by this number. The
 *  salt shifts the prefix and the second pair while the person's own place in the roster keeps the
 *  last two, so every number is unique and every roster still reads as one house's. The fish
 *  house's salt is ZERO, which is why its eight comerciales and its four back-office people carry
 *  exactly the numbers they already carry. */
const phoneOf = (n: number, salt = 0): string =>
  `+34 6${String(30 + n + salt).slice(0, 2)} ${String(100 + n * 7 + salt).slice(0, 2)} ${String(20 + n * 3).padStart(2, '0')} ${String(11 + n * 5).padStart(2, '0')}`;

/** THE EIGHT WHO HOLD THE ACCOUNTS (§12), built from a house's own seed.
 *
 *  WHO CARRIES AN ADDRESS (§67.1's «where it exists»). Four of the eight have a house address —
 *  the ones whose books hold the accounts that arrive by mail and by portal, so paperwork reaches
 *  them where paperwork already goes. The other four run their books on WhatsApp and the phone,
 *  which is how a distribuidor of this size really works, and it is the fact that makes «where it
 *  exists» a real state a row has to draw rather than a field that is always filled. */
type PersonSeed = { id: string; name: string; mail?: true };

const comercialesOf = (seed: PersonSeed[], domain: string, salt: number): Comercial[] =>
  seed.map(({ id, name, mail }, i) => ({
    id,
    name,
    phone: phoneOf(i + 1, salt),
    ...(mail ? { email: `${id}@${domain}` } : {}),
  }));

/* ── THE HOUSE'S OWN ROSTER (THE-ADMIN-CANON §4) ──────────────────────────────────────────────
 * «Their team should appear in a nice way, and they can add more people and give them different
 * rights, whether they have the right as admin to edit the business shit or not.»
 *
 * IT IS DERIVED FROM THE RUNS AND NOT RETYPED. The eight comerciales already exist, each already
 * holds a run, and a second hand-written list of the same eight people would be the split-brain
 * this file exists to prevent: rename a comercial and the team seat would still say the old name.
 * The four back-office people are the ones a distribuidor of this size really has — two in the
 * almacén, one on the van, one in the office — and they carry no run, which is exactly the fact
 * their rows say.
 *
 * PHONE NUMBERS ARE DERIVED TOO (`phoneOf`), from the person's own place in the list plus the
 * house's own salt, so nothing in this file is a number somebody could mistake for a real one and
 * every row still shows the shape of one.
 *
 * A COMERCIAL'S REACHABLE FACTS COME OFF THE COMERCIAL (§67.1). The eight carry their own phone
 * and, where the house gave them one, their address; the roster READS them rather than deriving a
 * second copy, so the Team card, the customer sheet's holder and the «Whose accounts» dropdown all
 * say the same number about the same person.
 */
type BackOfficeSeed = PersonSeed & { role: RoleId };

/** THE WHOLE HOUSE, in the order a roster reads: the person who owns it, the eight who hold the
 *  book, then the people who make the day happen. Thirteen, which is the size of a house doing
 *  three hundred albaranes a morning (§12's design load, staffed). */
function rosterOf(
  owner: Person,
  comerciales: Comercial[],
  runs: RunSeed[],
  back: BackOfficeSeed[],
  domain: string,
  salt: number,
): Person[] {
  return [
    owner,
    ...comerciales.map((c) => {
      const run = runs.find((r) => r.comercial === c.id);
      return {
        id: c.id,
        name: c.name,
        role: 'comercial' as RoleId,
        phone: c.phone,
        ...(c.email ? { email: c.email } : {}),
        zone: run?.zone,
        truck: run?.truck,
      };
    }),
    ...back.map(({ mail, ...p }, i) => ({
      ...p,
      phone: phoneOf(i + 20, salt),
      ...(mail ? { email: `${p.id}@${domain}` } : {}),
    })),
  ];
}

/** REAL GROUND, PER RUN (FEED-IA §25.4: «real map, the customer's real spot, one pin»). These are
 *  the actual neighbourhoods and towns each run covers; a customer's coordinate is one of them plus
 *  a few hundred metres of scatter, so every pin lands inside the run its chip names and the map
 *  and the chip can never disagree about the world.
 *
 *  ONE TABLE, THREE HOUSES. All three are Barcelona distribuidores covering the same six zones,
 *  because they cover one city: `round-map-geo.ts` draws these six shapes, so a fourth zone id
 *  would be a pin on nothing. What differs between the houses is which trucks run which zone and
 *  whose book sits on it — the ground under the city is the city's, not a house's. */
export const RUN_GROUND: Record<string, Array<[number, number]>> = {
  centre: [[41.4036, 2.1561], [41.4013, 2.1526], [41.4013, 2.1400], [41.3990, 2.1206], [41.4090, 2.1418], [41.4133, 2.1450]],
  eixample: [[41.3925, 2.1660], [41.4036, 2.1744], [41.3790, 2.1595], [41.3752, 2.1330], [41.3861, 2.1300], [41.3730, 2.1580], [41.3745, 2.1420]],
  litoral: [[41.3792, 2.1899], [41.3846, 2.1820], [41.3800, 2.1690], [41.3830, 2.1770], [41.3990, 2.2040], [41.3890, 2.1960], [41.4090, 2.2160], [41.4090, 2.1880]],
  nord: [[41.4300, 2.1600], [41.4160, 2.1740], [41.4415, 2.1770], [41.4350, 2.1900], [41.4210, 2.1880], [41.4270, 2.1450]],
  valles: [[41.5463, 2.1086], [41.4914, 2.1400], [41.4727, 2.0863], [41.4970, 2.1570], [41.5160, 2.1250], [41.4840, 2.1880], [41.5330, 2.0830]],
  costa: [[41.4300, 2.2180], [41.4520, 2.2080], [41.4500, 2.2470], [41.4680, 2.2800], [41.4790, 2.3160], [41.4920, 2.3620], [41.5060, 2.3920], [41.5170, 2.3960], [41.5550, 2.4010], [41.5388, 2.4449]],
};

/* THE TRADE'S OWN NAMING GRAMMAR. A Catalan customer book is not a list of adjectives: it is
 * «Can» plus a family name, a trade word plus a family name, a hotel plus a place. So the book is
 * built from FORMS crossed with two pools — the family names a house is called after, and the
 * places one is named for — and each form takes the pool its words actually come from. Twenty-two
 * forms across sixty-odd stems is more than a thousand legible names, of which a book takes fewer
 * than three hundred: no repetition, and no combination that reads machine-made.
 *
 * AND EACH HOUSE WRITES FROM ITS OWN STEMS (§89.2). Three houses drawing three hundred names each
 * out of one pool of stems overlap by about a third — measured, on the first build of this file's
 * three books — and a founder switching from the fish house to the meat house would read the same
 * eighty accounts under a different letterhead. That is «one company recoloured», which is exactly
 * what the seeded houses exist to be the opposite of. So each house holds its own families and its
 * own places, disjoint from the other two, and the books share nothing but the city they sit in.
 */

/** THE FISH HOUSE'S OWN, frozen: its book is generated from these and its book is shipped. */
const SURNAMES = [
  'Ferrer', 'Puig', 'Roca', 'Serra', 'Vilà', 'Bosch', 'Mas', 'Riera', 'Sala', 'Vidal',
  'Colomer', 'Prats', 'Rovira', 'Camps', 'Estrada', 'Grau', 'Llobet', 'Marimon', 'Nadal', 'Oliver',
  'Pagès', 'Quintana', 'Ribó', 'Sabaté', 'Tarrés', 'Ventura', 'Xifré', 'Baldrich', 'Cerdà', 'Duran',
  'Escoda', 'Fabré', 'Gelabert', 'Homs', 'Jofre', 'Lluch', 'Miralles', 'Noguera', 'Obiols', 'Pujadas',
  'Rifà', 'Torrents', 'Valls', 'Bonet', 'Cabré', 'Dalmau', 'Estruch', 'Freixa', 'Guasch', 'Pallarès',
  'Segura', 'Batlle', 'Casals', 'Fontanals', 'Gispert', 'Montllor', 'Perelló', 'Rosell', 'Vilaseca', 'Canals',
  'Deulofeu', 'Brugués', 'Fontcuberta', 'Massana', 'Argemí', 'Balcells', 'Codina', 'Farré',
  'Gassó', 'Llorens', 'Munné', 'Padrós', 'Roig', 'Sunyer', 'Tomàs', 'Vergés',
];

const PLACES = [
  'Montseny', 'Garraf', 'Empordà', 'Priorat', 'Penedès', 'Maresme', 'Bages', 'Osona', 'Cerdanya', 'Berguedà',
  'Anoia', 'Montgrí', 'Cadaqués', 'Begur', 'Palamós', 'Blanes', 'Tossa', 'Sitges', 'Calella', 'Arenys',
  'Canet', 'Malgrat', 'Pineda', 'Alella', 'Teià', 'Argentona', 'Caldes', 'Gualba', 'Breda', 'Arbúcies',
  'Viladrau', 'Tavertet', 'Rupit', 'Montserrat', 'Collserola', 'Tibidabo', 'Besòs', 'Llobregat', 'Fluvià', 'Gavarres',
  'Montgat', 'Vallvidrera', 'Ardenya', 'Delta',
];

/** THE MEAT HOUSE'S OWN. Different families, and the places are the inland comarques and towns its
 *  runs actually reach — which is the same fact its doubled city runs say, said in names. */
const MEAT_SURNAMES = [
  'Amigó', 'Anglada', 'Aulet', 'Barceló', 'Blanch', 'Boada', 'Boix', 'Borrell', 'Brunet', 'Cabanes',
  'Camprubí', 'Capdevila', 'Carbonell', 'Cardona', 'Carreras', 'Castells', 'Cirera', 'Clavell', 'Clotet', 'Comas',
  'Corbera', 'Cortada', 'Costa', 'Creus', 'Espona', 'Esteve', 'Falgueras', 'Ferrando', 'Figueras', 'Foix',
  'Fornells', 'Franquesa', 'Gabarró', 'Galí', 'Garrell', 'Gibert', 'Ginesta', 'Granell', 'Guardiola', 'Guinart',
  'Illa', 'Isern', 'Junyent', 'Lladó', 'Llach', 'Llimona', 'Malla', 'Manubens', 'Marcé', 'Martorell',
  'Mateu', 'Mestres', 'Milà', 'Molins', 'Morera', 'Olivella', 'Pareta', 'Parramon', 'Pastor', 'Piera',
  'Pinós', 'Planas', 'Pons', 'Portell', 'Pujol', 'Quer', 'Ràfols', 'Raurell', 'Renom', 'Reverter',
  'Riba', 'Ricart', 'Rigau', 'Riquer', 'Roure', 'Rusiñol',
];

const MEAT_PLACES = [
  'Segrià', 'Urgell', 'Solsonès', 'Pallars', 'Ripollès', 'Garrotxa', 'Selva', 'Vallès', 'Montsià', 'Segarra',
  'Alt Camp', 'Conca', 'Vic', 'Manresa', 'Igualada', 'Berga', 'Tremp', 'Banyoles', 'Figueres', 'Roses',
  'Palafrugell', 'Tordera', 'Lloret', 'Vidreres', 'Hostalric', 'Sils', 'Amer', 'Anglès', 'Salt', 'Celrà',
  'Bàscara', 'Besalú', 'Camprodon', 'Setcases', 'Núria', 'Queralbs', 'Planoles', 'Toses', 'Alp', 'Puigcerdà',
  'Bellver', 'Martinet', 'Organyà', 'Oliana',
];

/** THE VEGETABLE HOUSE'S OWN. Its places are the rivers and the market towns of Ponent and the
 *  Ebre — where the produce it sells is actually grown, and where its inland runs go. */
const FRUIT_SURNAMES = [
  'Abadal', 'Agustí', 'Alsina', 'Andreu', 'Aymar', 'Badia', 'Barnils', 'Bassegoda', 'Bayona', 'Berenguer',
  'Bigas', 'Blasi', 'Boldú', 'Borràs', 'Busquets', 'Calders', 'Cañellas', 'Carner', 'Casadevall', 'Català',
  'Cendra', 'Cervelló', 'Claramunt', 'Colom', 'Comellas', 'Corbella', 'Cuyàs', 'Domènech', 'Elias', 'Espinal',
  'Fàbregas', 'Feixas', 'Ferrés', 'Fiter', 'Forcada', 'Fuster', 'Gassol', 'Gener', 'Girbau', 'Gomà',
  'Gorina', 'Grifell', 'Gual', 'Güell', 'Iglesias', 'Jové', 'Juncà', 'Llauradó', 'Llobera', 'Maimó',
  'Mallart', 'Manent', 'Marfà', 'Masdeu', 'Mercader', 'Miró', 'Moliner', 'Muntada', 'Naspleda', 'Olivé',
  'Palol', 'Panyella', 'Pedrals', 'Peiró', 'Piqué', 'Poch', 'Prunera', 'Ramoneda', 'Reig', 'Rodó',
  'Sagalés', 'Salvadó', 'Sardà', 'Saumell', 'Tenas', 'Trepat',
];

const FRUIT_PLACES = [
  'Segre', 'Ter', 'Muga', 'Onyar', 'Tenes', 'Congost', 'Cardener', 'Francolí', 'Gaià', 'Alcarràs',
  'Alcanar', 'Amposta', 'Balaguer', 'Bellpuig', 'Bellvís', 'Cambrils', 'Cervera', 'Corbins', 'Deltebre', 'Falset',
  'Gandesa', 'Guissona', 'Juneda', 'Linyola', 'Maials', 'Mollerussa', 'Montblanc', 'Móra', 'Reus', 'Riudoms',
  'Sarral', 'Seròs', 'Solivella', 'Tàrrega', 'Torregrossa', 'Ulldecona', 'Vinaixa', 'Xerta', 'Rosselló', 'Vallespir',
  'Conflent', 'Capcir', 'Ebre', 'Garrigues',
];

type NameForm = { say: (stem: string) => string; pool: 'surname' | 'place' };

/* ── THE FORMS, SPLIT (FEED-IA §89.2) ─────────────────────────────────────────────────────────
 * A form is a NAME SHAPE, and shapes divide into two kinds. HOSPITALITY forms are the houses that
 * cook and pour — every trade sells to them, so a bar called Grau is a customer of the fish house,
 * the meat house and the vegetable house alike. THE TRADE'S OWN SHOPS are the other kind: a
 * peixateria buys fish, a carnisseria buys meat, a fruiteria buys vegetables, and each belongs to
 * exactly one house's book.
 *
 * Each form is named once and reused, so a change to the way a shape says itself lands in every
 * book that uses it.
 */
const FORM = {
  can: { say: (s: string) => `Can ${s}`, pool: 'surname' },
  restaurant: { say: (s: string) => `Restaurant ${s}`, pool: 'place' },
  bar: { say: (s: string) => `Bar ${s}`, pool: 'surname' },
  /* A HOTEL IS NAMED TWO WAYS and the book holds both: for the place it stands in, and for the
     family that runs it. Two forms, one word, which is why the list has «Hotel» twice. */
  hotelPlace: { say: (s: string) => `Hotel ${s}`, pool: 'place' },
  hotelFamily: { say: (s: string) => `Hotel ${s}`, pool: 'surname' },
  cal: { say: (s: string) => `Cal ${s}`, pool: 'surname' },
  cerveseria: { say: (s: string) => `Cerveseria ${s}`, pool: 'place' },
  barRestaurant: { say: (s: string) => `Bar Restaurant ${s}`, pool: 'surname' },
  celler: { say: (s: string) => `Celler ${s}`, pool: 'surname' },
  xiringuito: { say: (s: string) => `Xiringuito ${s}`, pool: 'place' },
  cafe: { say: (s: string) => `Cafè ${s}`, pool: 'surname' },
  hostal: { say: (s: string) => `Hostal ${s}`, pool: 'place' },
  fonda: { say: (s: string) => `Fonda ${s}`, pool: 'surname' },
  distribucions: { say: (s: string) => `Distribucions ${s}`, pool: 'surname' },
  taverna: { say: (s: string) => `Taverna ${s}`, pool: 'surname' },
  arrosseria: { say: (s: string) => `Arrosseria ${s}`, pool: 'place' },
  catering: { say: (s: string) => `Càtering ${s}`, pool: 'place' },
  masia: { say: (s: string) => `Masia ${s}`, pool: 'place' },
  vermuteria: { say: (s: string) => `Vermuteria ${s}`, pool: 'surname' },

  /* the fish house's own shops */
  peixateria: { say: (s: string) => `Peixateria ${s}`, pool: 'surname' },
  marisqueria: { say: (s: string) => `Marisqueria ${s}`, pool: 'surname' },

  /* the meat house's own. A braseria grills for a room; a cansaladeria and a carnisseria sell over
     a counter — three shapes a meat house's book is full of and the other two books never hold. */
  carnisseria: { say: (s: string) => `Carnisseria ${s}`, pool: 'surname' },
  cansaladeria: { say: (s: string) => `Cansaladeria ${s}`, pool: 'surname' },
  braseria: { say: (s: string) => `Braseria ${s}`, pool: 'surname' },

  /* the vegetable house's own */
  fruiteria: { say: (s: string) => `Fruiteria ${s}`, pool: 'surname' },
  verduleria: { say: (s: string) => `Verduleria ${s}`, pool: 'place' },
  herbolari: { say: (s: string) => `Herbolari ${s}`, pool: 'surname' },
} satisfies Record<string, NameForm>;

/** THE FISH HOUSE'S FORMS, IN THE ORDER THEY HAVE ALWAYS BEEN IN. The order is load-bearing: a
 *  form's PLACE in this list picks both the shape a row takes and the stem it takes it with, so
 *  reordering the list rewrites all 291 generated names and every id derived from them. The fish
 *  book is shipped, screenshotted and driven against, so this list is frozen — which is why
 *  `Braseria`, a grill house that the meat book claims as its own shape, still stands at index 16
 *  here. A shape can belong to two trades; a book cannot be renumbered. */
const FISH_FORMS: NameForm[] = [
  FORM.can, FORM.restaurant, FORM.bar, FORM.hotelPlace, FORM.cal, FORM.marisqueria,
  FORM.cerveseria, FORM.barRestaurant, FORM.celler, FORM.xiringuito, FORM.cafe, FORM.hostal,
  FORM.fonda, FORM.distribucions, FORM.taverna, FORM.arrosseria, FORM.braseria, FORM.hotelFamily,
  FORM.catering, FORM.peixateria, FORM.masia, FORM.vermuteria,
];

/** THE MEAT HOUSE'S FORMS. Its own three stand where the trade actually stands in its book: the
 *  carnisseria early, because a meat house's commonest account is the shop that resells it. */
const MEAT_FORMS: NameForm[] = [
  FORM.can, FORM.restaurant, FORM.bar, FORM.carnisseria, FORM.hotelPlace, FORM.cal,
  FORM.braseria, FORM.cerveseria, FORM.barRestaurant, FORM.celler, FORM.cansaladeria, FORM.xiringuito,
  FORM.cafe, FORM.hostal, FORM.fonda, FORM.distribucions, FORM.taverna, FORM.arrosseria,
  FORM.hotelFamily, FORM.catering, FORM.masia, FORM.vermuteria,
];

/** THE VEGETABLE HOUSE'S FORMS. The fruiteria leads, for the same reason the carnisseria leads the
 *  meat book — and the order differs from the meat house's throughout, so two houses in one city
 *  never write the same name on the same row. */
const FRUIT_FORMS: NameForm[] = [
  FORM.fruiteria, FORM.can, FORM.restaurant, FORM.bar, FORM.verduleria, FORM.hotelPlace,
  FORM.cal, FORM.cerveseria, FORM.herbolari, FORM.barRestaurant, FORM.celler, FORM.xiringuito,
  FORM.cafe, FORM.hostal, FORM.fonda, FORM.distribucions, FORM.taverna, FORM.arrosseria,
  FORM.hotelFamily, FORM.catering, FORM.masia, FORM.vermuteria,
];

/** `Bar Restaurant Grau` → `bar-restaurant-grau`, which is what a row's every test handle and every
 *  ledger key is made of. Accents come off, because an id is a key and not a word. */
const idOf = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** THE DOORS ORDERS COME THROUGH, in the proportion a distribuidor actually sees them: WhatsApp is
 *  most of a morning, the phone is the old accounts, email is the hotels, and a portal is the one
 *  chain that has one. */
const CHANNELS: Customer['channel'][] = [
  'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp',
  'phone', 'phone', 'phone', 'email', 'email', 'portal',
];

/** THE FEW WHO ASKED FOR AN HOUR (§21: «most deliveries are for the MORNING OF — effectively one
 *  time. Some carry preferred slots»). One customer in eight, and the sort that uses it lives on
 *  paper. A book where every row carried an hour would be a book that sorts by the clock. */
const SLOTS = ['07:00', '07:30', '08:00', '08:30', '09:15', '10:15', '10:45'];

/** WHAT A HOUSE'S BOOK IS GROWN FROM. Four facts, and the fourth is the reason three houses can
 *  share one generator: the SALT keys every derived fact — the stem a form takes, the ground a pin
 *  lands on, the tier, the channel, the slot, the customer's own ERP. Fish is salt 0, which makes
 *  its book the one already shipped; meat and vegetables take their own, so three houses covering
 *  one city hold three different books rather than one book recoloured. */
type BookSeed = {
  /** the shapes this trade's book is written in, in the order that decides which stem each row takes */
  forms: NameForm[];
  /** the families this house's accounts are called after, and the places they are named for */
  stems: { surname: string[]; place: string[] };
  /** the runs the book is spread across */
  runs: RunSeed[];
  /** the house's own leads, already standing on their runs — each run fills to `holds` MINUS them */
  leads: Customer[];
  /** the name prefixes that mark a WHOLESALE account: the distributor that redistributes, the
   *  trade's own shop that resells, and the caterer that buys in bulk. They order through a portal
   *  and they sit on tier 1; every other shape is a house that cooks, and its volume is thin and
   *  its margin fat — which is exactly what a tier says. */
  wholesale: string[];
  /** the house's own salt */
  salt: number;
};

/** The house's own book, grown to size. The five leads keep the first five places and every derived
 *  fact stays put when the book grows around them. */
function houseBook({ forms, stems, runs, leads, wholesale, salt }: BookSeed): Customer[] {
  /* the run each generated row sits on: every run repeated as many times as it still has room for,
     which is what makes `holds` a number a reader can check against the rendered chips. The leads
     are counted off their own trucks rather than off a hand-written table, so a lead that moves
     run keeps the totals right by construction. */
  const lockedPerRun = new Map<number, number>();
  leads.forEach((l) => {
    if (l.truck !== undefined) lockedPerRun.set(l.truck, (lockedPerRun.get(l.truck) ?? 0) + 1);
  });
  const seats: RunSeed[] = [];
  runs.forEach((run) => {
    for (let i = 0; i < run.holds - (lockedPerRun.get(run.truck) ?? 0); i += 1) seats.push(run);
  });

  const taken = new Set<string>();
  return seats.map((run, k) => {
    const shape = k % forms.length;
    const form = forms[shape];
    const pool = form.pool === 'surname' ? stems.surname : stems.place;
    /* THE STEM WALKS ITS POOL BY A STRIDE COPRIME WITH IT, from an offset that is the form's own
       place in the list plus the house's salt — so one form never repeats a stem before its pool is
       exhausted, two forms landing on one family name («Can Roca» and «Peixateria Roca») is what a
       real book looks like rather than a defect, and two houses starting from different salts write
       different names into the same row. */
    const step = Math.floor(k / forms.length);
    let name = form.say(pool[(shape * 11 + step * 23 + salt) % pool.length]);
    for (let bump = 1; taken.has(name); bump += 1) {
      name = form.say(pool[(shape * 11 + step * 23 + salt + bump * 5) % pool.length]);
    }
    taken.add(name);

    const anchor = scatterOf(RUN_GROUND[run.zone], k * 3 + 1 + salt);
    const hotel = name.startsWith('Hotel') || name.startsWith('Hostal');
    const trade = wholesale.some((w) => name.startsWith(w));
    return {
      id: idOf(name),
      name,
      channel: hotel ? 'email' : trade ? 'portal' : scatterOf(CHANNELS, k * 5 + 2 + salt),
      /* the big accounts are the distributors and the hotels; the bars are where a house's volume
         is thin and its margin is fat, which is exactly what a tier says */
      tier: trade ? 'tier 1' : hotel ? 'tier 1' : scatter(k * 7 + 3 + salt) > 0.55 ? 'tier 2' : 'tier 3',
      settles: scatter(k * 11 + 4 + salt) > 0.78 ? 'cash on delivery' : 'credit',
      zone: run.zone,
      truck: run.truck,
      comercial: run.comercial,
      at: {
        lat: Math.round((anchor[0] + (scatter(k * 13 + 5 + salt) - 0.5) * 0.008) * 10000) / 10000,
        lng: Math.round((anchor[1] + (scatter(k * 17 + 6 + salt) - 0.5) * 0.010) * 10000) / 10000,
      },
      slot: scatter(k * 19 + 7 + salt) > 0.875 ? scatterOf(SLOTS, k * 23 + 8 + salt) : undefined,
      /* THE CUSTOMER'S OWN SYSTEM (§20). A handful of the big accounts have one, because that is
         how many really do — and the albarán lands straight in it for exactly those. */
      erp: trade && scatter(k * 29 + 9 + salt) > 0.6 ? { id: 'tspoonlab', name: 'tSpoonLab' } : undefined,
    } satisfies Customer;
  });
}

/* ── THE FIVE THE MORNING IS BUILT ON ─────────────────────────────────────────────────────────
 * `app/sale.ts` names five customer ids for EVERY house — `manolo`, `cansole`, `hotelrec`, `nou`,
 * `vera`. They carry the record below today (yesterday's settled, delivered and disputed albaranes),
 * the horizon above it, the seeded fills and the seeded readings. So THE IDS ARE SHARED, because
 * they are the morning's own five anchors and a table keyed on them has to find them in whichever
 * house is standing.
 *
 * THE NAMES ARE NOT SHARED, because a name belongs to whoever it names. A meat house's five leads
 * are a meat house's own accounts — its braseria, its hotel, its distribuidor — and a demo to a
 * meat company that opened yesterday's record and read «Can Solé» would be showing them somebody
 * else's book. The fish house keeps the brief's own five words (§9); the other two houses are
 * written in their own trade's grammar, each on a coherent zone, truck, comercial, tier and
 * channel, with their door inside the run their chip names.
 */

/* ═══ FISH — the lonja at 05:00 ══════════════════════════════════════════════════════════════
 * Every product name here is locked by the brief, and so is every derived fact: this house's salt
 * is zero and its forms are frozen, so the book it generates is the book it has always generated.
 */

/** THE HOUSE ITSELF. Its own place is a REAL one: `at` is Mercabarna's fish pavilion in the Zona
 *  Franca, which is where a Barcelona fish distributor's almacén actually is — and it is written in
 *  the literal `at: { lat: …, lng: … }` form because `tools/build-map-tiles.py` reads THIS FILE as
 *  text to know which tiles to draw. A coordinate the builder cannot see is a pin on 404s (§25.4).
 *
 *  `name` is the TRADE-FACING name, which is what a customer says on the phone and what the head of
 *  an albarán prints; `config.brand.name` seeds from it (cast law 10: a name is the cast's, never a
 *  string typed into a config), and the house may rename itself in Tu negocio. */
const FISH_HOUSE: House = {
  domain: 'peixvilalta.cat',
  name: 'Peix Vilalta',
  legalName: 'Peix Vilalta, S.L.',
  taxId: 'B-65 428 901',
  registry: { volume: '44.207', folio: '112', sheet: 'B-451.883', entry: '1ª' },
  fiscalAddress: 'Carrer de Sepúlveda 148, 3r 2a · 08011 Barcelona',
  warehouse: {
    name: 'Mercabarna · pavelló del peix',
    address: 'Carrer Major 34, Mercabarna · 08040 Barcelona',
    at: { lat: 41.3372, lng: 2.1330 },
  },
  iban: 'ES91 2100 0418 4502 0005 1332',
  phone: '+34 932 62 18 40',
  whatsapp: '+34 639 20 41 88',
  email: 'comandes@peixvilalta.cat',
};

/** THE PERSON WHOSE ACCOUNT THIS IS (§53: «It shouldn't be your Rocoto name, but it should be the
 *  person, like their account»). The rail's foot says her name, and the Cuenta seat is hers. She is
 *  drawn in the cast's own naming grammar — a Catalan surname the customer book does not use, so
 *  «Roser Vilalta» and a restaurant can never be read as the same fact, exactly as the comerciales'
 *  surnames are kept out of the book. Her phone is the house's WhatsApp, because in a house this
 *  size it is. */
const FISH_OWNER: Person = {
  id: 'owner',
  name: 'Roser Vilalta',
  role: 'gerente',
  phone: '+34 639 20 41 88',
  email: 'roser@peixvilalta.cat',
  admin: true,
};

/** THE EIGHT WHO HOLD THE ACCOUNTS. Their surnames are kept out of the customer-stem pool above,
 *  so «Laia Clarós» and a restaurant called Clarós can never be read as the same fact. */
const FISH_COMERCIALES: Comercial[] = comercialesOf(
  [
    { id: 'nuria', name: 'Núria Aymerich', mail: true },
    { id: 'jordi', name: 'Jordi Bertran' },
    { id: 'laia', name: 'Laia Clarós', mail: true },
    { id: 'marc', name: 'Marc Danés' },
    { id: 'silvia', name: 'Sílvia Espinet', mail: true },
    { id: 'toni', name: 'Toni Gomis' },
    { id: 'anna', name: 'Anna Hereu' },
    { id: 'pau', name: 'Pau Ibern', mail: true },
  ],
  FISH_HOUSE.domain,
  0,
);

/** THE EIGHT RUNS. Six zones, eight vans: the port and the coast are long enough to need two each,
 *  which is why a truck number and a zone are two facts rather than one. `holds` is the size of the
 *  run's book — 33 to 42, inside §12's 30–50 — and the comercial who holds it is the run's own,
 *  because a territory is how a house splits work. */
const FISH_RUNS: RunSeed[] = [
  { truck: 1, zone: 'centre', comercial: 'nuria', holds: 37 },
  { truck: 2, zone: 'litoral', comercial: 'jordi', holds: 40 },
  { truck: 3, zone: 'eixample', comercial: 'laia', holds: 42 },
  { truck: 4, zone: 'nord', comercial: 'marc', holds: 35 },
  { truck: 5, zone: 'valles', comercial: 'silvia', holds: 33 },
  { truck: 6, zone: 'costa', comercial: 'toni', holds: 38 },
  { truck: 7, zone: 'litoral', comercial: 'anna', holds: 36 },
  { truck: 8, zone: 'costa', comercial: 'pau', holds: 35 },
];

/** the back office: the people a run never names, and the reason a roster is not just the runs.
 *  The office holds an address because the office is where paperwork lands; the almacén and the
 *  van run on the phone in their hand. */
const FISH_BACK_OFFICE: BackOfficeSeed[] = [
  { id: 'ferran', name: 'Ferran Palau', role: 'almacen' },
  { id: 'rosa', name: 'Rosa Miquel', role: 'almacen' },
  { id: 'oriol', name: 'Oriol Sagrera', role: 'repartidor' },
  { id: 'montse', name: 'Montse Rovira', role: 'oficina', mail: true },
];

const FISH_TEAM: Person[] = rosterOf(
  FISH_OWNER, FISH_COMERCIALES, FISH_RUNS, FISH_BACK_OFFICE, FISH_HOUSE.domain, 0,
);

/** THE FIVE THE BRIEF LOCKED, with the run each of them sits on made coherent with §21's eight:
 *  one truck runs one zone, so Hotel Rec takes the Eixample van and Restaurant Nou the Nord one. */
const FISH_LEADS: Customer[] = [
  { id: 'manolo', name: 'Bar Manolo', channel: 'WhatsApp', tier: 'tier 2', settles: 'cash on delivery', zone: 'centre', truck: 1, comercial: 'nuria', at: { lat: 41.4022, lng: 2.1560 } },
  { id: 'cansole', name: 'Can Solé', channel: 'WhatsApp', tier: 'tier 1', settles: 'credit', zone: 'litoral', truck: 2, comercial: 'jordi', slot: '07:30', at: { lat: 41.3792, lng: 2.1899 } },
  { id: 'hotelrec', name: 'Hotel Rec', channel: 'email', tier: 'tier 1', settles: 'credit', zone: 'eixample', truck: 3, comercial: 'laia', erp: { id: 'tspoonlab', name: 'tSpoonLab' }, at: { lat: 41.3925, lng: 2.1745 } },
  { id: 'nou', name: 'Restaurant Nou', channel: 'phone', tier: 'tier 3', settles: 'credit', zone: 'nord', truck: 4, comercial: 'marc', slot: '10:45', at: { lat: 41.4415, lng: 2.1770 } },
  { id: 'vera', name: 'Distribuciones Vera', channel: 'WhatsApp', tier: 'tier 1', settles: 'credit', zone: 'costa', truck: 6, comercial: 'toni', slot: '10:15', at: { lat: 41.5388, lng: 2.4449 } },
];

/* ── ONE DOOR THAT WAS TYPED RATHER THAN PICKED (FEED-IA §246) ────────────────────────────────
 * `at` is optional on a Customer, and the product reaches that state on its own road: «Freeform
 * addresses are saved as text» is what the new-customer modal says on screen, so a house that
 * types a street instead of choosing a saved place keeps an account with a printable address and
 * no coordinate. The book held 296 coordinates and no such account, so Prep's «Upcoming deliveries
 * · N» standing over N marks was true by fixture rather than by construction — and a screen that is
 * right only while the data is tidy is a screen nobody has tested. This account is the case, in the
 * book, every day.
 *
 * IT TAKES THE COAST RUN'S LAST SEAT, which is what keeps every count the drives pin exactly where
 * it was: it is handed to `houseBook` as a lead, so run 8 draws one seat fewer, the book is still
 * 296 accounts, every generated account keeps its index — and the horizon therefore promises this
 * account on the same day, on the same truck, with the same comercial, as the seat it replaces. */
const FISH_TYPED_ADDRESS: Customer = {
  id: 'tavernadelmar',
  name: 'Taverna del Mar',
  channel: 'email',
  tier: 'tier 3',
  settles: 'cash on delivery',
  zone: 'costa',
  truck: 8,
  comercial: 'pau',
  /** the door as it would be printed, typed by a person — and no `at`, which is the whole point */
  address: 'Carrer del Mar 14, Badalona',
};

/** THE ONE ACCOUNT PETER CALLS FROM (2026-09-11). The live phone proof needs a customer whose
 *  number is a real handset Peter holds: his UK mobile. The profile is complete on purpose — a
 *  door, an email, a slot — so a call from that number opens a customer the screens already know,
 *  and nothing about it is hard-coded anywhere else: the runtime matches the caller's number to
 *  this row the way it would for any account the house wrote this morning (§135). */
const FISH_PROOF_ACCOUNT: Customer = {
  id: 'latintzar', name: 'Bar Latintzar', channel: 'phone', tier: 'tier 2', settles: 'cash on delivery',
  zone: 'centre', truck: 1, comercial: 'nuria', slot: '09:30',
  /* The proof account's channels are Peter's own test lines, so a real message from them lands
     in this customer's chat the moment a mailbox or a number is connected (FEED-IA §245.13). */
  phone: '+12025550110', email: 'peter@soyrocoto.com',
  address: 'Carrer de Sant Pere Més Alt 12, 08003 Barcelona',
  at: { lat: 41.3868, lng: 2.1758 },
};

/** The whole book: the founder's five, the house's own three hundred less five (one of them the
 *  typed-address account, in the coast run's last seat), then the proof account — LAST, so every
 *  existing row keeps the index its derived facts hang from. */
export const FISH_CUSTOMERS: Customer[] = [
  ...FISH_LEADS,
  ...houseBook({
    forms: FISH_FORMS,
    stems: { surname: SURNAMES, place: PLACES },
    runs: FISH_RUNS,
    leads: [...FISH_LEADS, FISH_TYPED_ADDRESS],
    wholesale: ['Distribucions', 'Peixateria', 'Càtering'],
    salt: 0,
  }),
  FISH_TYPED_ADDRESS,
  FISH_PROOF_ACCOUNT,
];

export const fish: Cast = {
  sector: 'fish',
  label: 'fish',
  trade: 'Fish',
  hour: '05:00',
  house: FISH_HOUSE,
  owner: FISH_OWNER,
  team: FISH_TEAM,
  runs: FISH_RUNS,
  families: [PESCADO, AMBIENT],
  products: [
    {
      id: 'merluza', code: 'PV-1001', name: 'Merluza', family: 'pescado', unit: 'kg',
      pack: { unit: 'caja', factor: 6.5, nominal: true }, variableWeight: true,
      trace: {
        lote: 'L-2208', 'nombre científico': 'Merluccius merluccius',
        zona: 'FAO 27 · Gran Sol', arte: 'palangre de fondo', método: 'wild',
        descongelado: 'fresh', buque: 'Nuevo Aurora', fecha: '21.08',
      },
    },
    {
      id: 'gamba', code: 'PV-1002', name: 'Gamba roja de Palamós', family: 'pescado', unit: 'kg',
      pack: { unit: 'caja', factor: 2, nominal: true }, variableWeight: true,
      trace: {
        lote: 'L-2211', 'nombre científico': 'Aristeus antennatus',
        zona: 'FAO 37 · Palamós', arte: 'arrastre de fondo', método: 'wild',
        descongelado: 'fresh', buque: 'Germans Pou', fecha: '21.08',
      },
    },
    {
      id: 'pulpo', code: 'PV-1003', name: 'Pulpo', family: 'pescado', unit: 'kg',
      pack: { unit: 'caja', factor: 10, nominal: true }, variableWeight: true,
      trace: {
        lote: 'L-2214', 'nombre científico': 'Octopus vulgaris',
        zona: 'FAO 27 · Gran Sol', arte: 'nasas', método: 'wild',
        descongelado: 'defrosted', buque: 'Mar de Fisterra', fecha: '20.08',
      },
    },
    {
      id: 'rape', code: 'PV-1004', name: 'Rape', family: 'pescado', unit: 'kg',
      pack: { unit: 'caja', factor: 8, nominal: true }, variableWeight: true,
      trace: {
        lote: 'L-2208', 'nombre científico': 'Lophius piscatorius',
        zona: 'FAO 27 · Gran Sol', arte: 'arrastre de fondo', método: 'wild',
        descongelado: 'fresh', buque: 'Nuevo Aurora', fecha: '21.08',
      },
    },
    {
      id: 'lubina', code: 'PV-1005', name: 'Lubina de estero', family: 'pescado', unit: 'kg',
      pack: { unit: 'caja', factor: 5, nominal: false }, variableWeight: true,
      trace: {
        lote: 'L-2214', 'nombre científico': 'Dicentrarchus labrax',
        zona: 'FAO 27 · Cádiz', arte: 'estero', método: 'farmed',
        descongelado: 'fresh', buque: 'Esteros del Sur', fecha: '20.08',
      },
    },
  ],
  customers: FISH_CUSTOMERS,
  comerciales: FISH_COMERCIALES,
  suppliers: [{ id: 'rubio', name: 'Pescados Rubio' }],
  /* THE BOOK IS BOUGHT AT THE SIZE THE DAY IS SOLD AT (FEED-IA §31.1). A house that ships three
     hundred albaranes lands tonnes at the lonja, so the lote quantities are a real morning's
     purchase. At the toy quantities the FIFO proposal ran dry on the twentieth albarán and every
     one after it was offered no lote at all — the guard could not be judged at the load it exists
     for. The costs are untouched: they set the markup every price in this cast is derived from.

     EACH ONE CARRIES ITS OWN TRACEABILITY (§18.3). A landing is a boat, a ground and a gear, and
     two landings of one SKU differ on all three — this pulpo came off Fisterra and this rape off
     Porcupine while both PRODUCT rows say Gran Sol, which is exactly the fact a lote exists to
     hold. The lote's number is absent from the object because the lote IS the object; a `lote`
     key here would be the same fact written twice. */
  batches: [
    {
      id: 'L-2208', product: 'merluza', supplier: 'rubio', qty: 3200, cost: 11.4, day: '21.08',
      trace: { zona: 'FAO 27 · Gran Sol', arte: 'palangre de fondo', buque: 'Nuevo Aurora', fecha: '21.08' },
    },
    {
      id: 'L-2211', product: 'gamba', supplier: 'rubio', qty: 420, cost: 68.0, day: '21.08',
      trace: { zona: 'FAO 37 · Palamós', arte: 'arrastre de fondo', buque: 'Germans Pou', fecha: '21.08' },
    },
    {
      id: 'L-2214', product: 'pulpo', supplier: 'rubio', qty: 1600, cost: 9.2, day: '20.08',
      trace: { zona: 'FAO 27 · Fisterra', arte: 'nasas', buque: 'Mar de Fisterra', fecha: '20.08' },
    },
    /* ── THE HONESTY REPAIR (THE-DATA-CANON §6.2a) ────────────────────────────────────────────
     * Rape and lubina carried revenue with NO COST ROW, so «los más rentables» could only be
     * counted over three of the five goods and had to say so in its method line for the rest of
     * its life. That is a hole in the SEED, not a limit of the analysis: a house that buys five
     * things at the lonja knows what it paid for all five.
     *
     * The costs are the trade's own spread against the prices already in this cast — rape is a
     * dear white fish bought whole, lubina de estero is farmed and steady — so the margin ranking
     * is computed on the whole catalogue and its method line can stop apologising. THE SAME LAW
     * BUILT THE OTHER TWO HOUSES: every product below carries a lote and a cost. */
    {
      id: 'L-2217', product: 'rape', supplier: 'rubio', qty: 780, cost: 13.9, day: '21.08',
      trace: { zona: 'FAO 27 · Porcupine', arte: 'arrastre de fondo', buque: 'Bonaventura', fecha: '21.08' },
    },
    {
      id: 'L-2219', product: 'lubina', supplier: 'rubio', qty: 950, cost: 7.6, day: '20.08',
      trace: { zona: 'FAO 27 · Cádiz', arte: 'estero', buque: 'Esteros del Sur', fecha: '20.08' },
    },
  ],
  order: {
    customer: 'cansole',
    deliveryDay: 'Friday 22.08',
    placedAt: '06:12',
    words: [
      'Morning. For tomorrow: 12 kg merluza, 3 kg gamba roja, and a caja of pulpo.',
      'The merluza for the plancha, so nothing under a kilo if you can.',
    ],
    utterances: [
      { at: 0, text: 'Morning. For tomorrow: 12 kg merluza,' },
      { at: 2600, text: '3 kg gamba roja, and a caja of pulpo.' },
      { at: 6100, text: 'The merluza for the plancha, so nothing under a kilo if you can.' },
    ],
    lines: [
      { id: 'l1', product: 'merluza', qty: 12, unit: 'kg', price: 15.8, lot: 'L-2208' },
      { id: 'l2', product: 'gamba', qty: 3, unit: 'kg', price: 92.0, lot: 'L-2211' },
      { id: 'l3', product: 'pulpo', qty: 10, unit: 'kg', wasQty: 1, price: 13.5, lot: 'L-2214' },
    ],
  },
};

/* ═══ MEAT — Carns Bofill, the meat pavilion at 08:00 ════════════════════════════════════════
 * A Barcelona meat distribuidor at Mercabarna's pavelló de la carn, at the same load as the fish
 * house: eight comerciales, eight runs, a book of three hundred, thirteen shelves and a lote behind
 * every one of them. Its people, its shops and its goods are the meat trade's own — a demo to a
 * meat company runs on a meat house from the river to the tarifas (§89.2).
 */

const MEAT_HOUSE: House = {
  domain: 'carnsbofill.cat',
  name: 'Carns Bofill',
  legalName: 'Carns Bofill, S.L.',
  taxId: 'B-62 310 774',
  registry: { volume: '41.882', folio: '58', sheet: 'B-397.214', entry: '1ª' },
  fiscalAddress: 'Carrer de Provença 231, 2n 1a · 08008 Barcelona',
  warehouse: {
    name: 'Mercabarna · pavelló de la carn',
    address: 'Carrer Longitudinal 7, Mercabarna · 08040 Barcelona',
    at: { lat: 41.3352, lng: 2.1414 },
  },
  iban: 'ES68 0081 0182 6700 0129 4471',
  phone: '+34 933 35 71 20',
  whatsapp: '+34 645 18 33 02',
  email: 'comandes@carnsbofill.cat',
};

const MEAT_OWNER: Person = {
  id: 'owner',
  name: 'Jaume Bofill',
  role: 'gerente',
  phone: '+34 645 18 33 02',
  email: 'jaume@carnsbofill.cat',
  admin: true,
};

/** THE MEAT HOUSE'S OWN EIGHT. Their surnames are kept out of the customer-stem pool for the same
 *  reason the fish house's are: «Neus Fargas» and a braseria called Fargas would read as one fact. */
const MEAT_COMERCIALES: Comercial[] = comercialesOf(
  [
    { id: 'eulalia', name: 'Eulàlia Ballester', mail: true },
    { id: 'guillem', name: 'Guillem Corominas' },
    { id: 'neus', name: 'Neus Fargas', mail: true },
    { id: 'arnau', name: 'Arnau Gironès' },
    { id: 'mireia', name: 'Mireia Llopart', mail: true },
    { id: 'sergi', name: 'Sergi Maragall' },
    { id: 'roger', name: 'Roger Piñol' },
    { id: 'clara', name: 'Clara Trias', mail: true },
  ],
  MEAT_HOUSE.domain,
  10,
);

/** THE MEAT HOUSE'S EIGHT RUNS. Six zones, eight vans — and the doubled zones are the CITY ones,
 *  because a meat house's density is where the kitchens are rather than up the coast. That is the
 *  same city staffed a different way, which is what «three houses, one city, their own trucks» is
 *  for: the two books lie on the ground differently. */
const MEAT_RUNS: RunSeed[] = [
  { truck: 1, zone: 'centre', comercial: 'eulalia', holds: 38 },
  { truck: 2, zone: 'eixample', comercial: 'guillem', holds: 41 },
  { truck: 3, zone: 'litoral', comercial: 'neus', holds: 36 },
  { truck: 4, zone: 'nord', comercial: 'arnau', holds: 34 },
  { truck: 5, zone: 'valles', comercial: 'mireia', holds: 39 },
  { truck: 6, zone: 'costa', comercial: 'sergi', holds: 35 },
  { truck: 7, zone: 'eixample', comercial: 'roger', holds: 40 },
  { truck: 8, zone: 'centre', comercial: 'clara', holds: 37 },
];

const MEAT_BACK_OFFICE: BackOfficeSeed[] = [
  { id: 'bernat', name: 'Bernat Solanes', role: 'almacen' },
  { id: 'gemma', name: 'Gemma Sadurní', role: 'almacen' },
  { id: 'isaac', name: 'Isaac Verdaguer', role: 'repartidor' },
  { id: 'laura', name: 'Laura Ollé', role: 'oficina', mail: true },
];

const MEAT_TEAM: Person[] = rosterOf(
  MEAT_OWNER, MEAT_COMERCIALES, MEAT_RUNS, MEAT_BACK_OFFICE, MEAT_HOUSE.domain, 10,
);

/** THE MEAT HOUSE'S OWN FIVE, on the ids the morning is keyed to. A braseria that buys a canal a
 *  week, the hotel that takes the jamón, the distribuidor up the coast — the accounts a meat house
 *  actually leads with. */
const MEAT_LEADS: Customer[] = [
  { id: 'manolo', name: 'Bar Torner', channel: 'WhatsApp', tier: 'tier 2', settles: 'cash on delivery', zone: 'centre', truck: 1, comercial: 'eulalia', at: { lat: 41.4015, lng: 2.1530 } },
  { id: 'cansole', name: 'Braseria Mallol', channel: 'WhatsApp', tier: 'tier 1', settles: 'credit', zone: 'eixample', truck: 2, comercial: 'guillem', slot: '07:30', at: { lat: 41.3861, lng: 2.1300 } },
  { id: 'hotelrec', name: 'Hotel Ronda', channel: 'email', tier: 'tier 1', settles: 'credit', zone: 'litoral', truck: 3, comercial: 'neus', erp: { id: 'tspoonlab', name: 'tSpoonLab' }, at: { lat: 41.3846, lng: 2.1820 } },
  { id: 'nou', name: 'Restaurant Guixot', channel: 'phone', tier: 'tier 3', settles: 'credit', zone: 'nord', truck: 4, comercial: 'arnau', slot: '10:45', at: { lat: 41.4300, lng: 2.1600 } },
  { id: 'vera', name: 'Distribucions Feliu', channel: 'WhatsApp', tier: 'tier 1', settles: 'credit', zone: 'costa', truck: 6, comercial: 'sergi', slot: '10:15', at: { lat: 41.4920, lng: 2.3620 } },
];

export const MEAT_CUSTOMERS: Customer[] = [
  ...MEAT_LEADS,
  ...houseBook({
    forms: MEAT_FORMS,
    stems: { surname: MEAT_SURNAMES, place: MEAT_PLACES },
    runs: MEAT_RUNS,
    leads: MEAT_LEADS,
    wholesale: ['Distribucions', 'Carnisseria', 'Càtering'],
    salt: 7919,
  }),
];

export const meat: Cast = {
  sector: 'meat',
  label: 'meat',
  trade: 'Meat',
  hour: '08:00',
  house: MEAT_HOUSE,
  owner: MEAT_OWNER,
  team: MEAT_TEAM,
  runs: MEAT_RUNS,
  families: [CARNE, AMBIENT],
  /* THE SHELF, ACROSS THE WING'S OWN CATEGORIES (§89.2). Thirteen goods over cerdo, curados,
     embutido, vacuno, aves and tripas — the shape of a real meat distribuidor's list rather than a
     sample of five. Each one is grounded on a node `app/catalogue.ts`'s tree already holds, and its
     word is one the painted library already has a face for, so the shelf draws with pictures.
     Every name carries `provisional` (C-9): these are the trade's ordinary words, and the founder's
     one sentence replaces any of them here and nowhere else. */
  products: [
    {
      id: 'mediacanal', code: 'CB-2001', name: 'Media canal de cerdo', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'pieza', factor: 42, nominal: true }, variableWeight: true,
      trace: {
        lote: 'L-4102', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.05421/CT',
      },
    },
    {
      id: 'chorizo', code: 'CB-2002', name: 'Chorizo sarta', family: 'carne', unit: 'caja', provisional: true,
      pack: { unit: 'kg', factor: 5 }, variableWeight: false,
      trace: {
        lote: 'L-4103', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.09933/CT',
      },
    },
    {
      id: 'lomo', code: 'CB-2003', name: 'Lomo embuchado', family: 'carne', unit: 'pieza', provisional: true,
      variableWeight: false,
      trace: {
        lote: 'L-4104', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.09933/CT',
      },
    },
    {
      id: 'jamon', code: 'CB-2004', name: 'Jamón al corte', family: 'carne', unit: 'kg', provisional: true,
      variableWeight: true,
      trace: {
        lote: 'L-4105', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.05421/CT',
      },
    },
    {
      id: 'solomillo', code: 'CB-2005', name: 'Solomillo de ternera', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'pieza', factor: 1.8, nominal: true }, variableWeight: true,
      trace: {
        lote: 'L-4106', birth: 'Francia', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.05421/CT',
      },
    },
    {
      id: 'pollo', code: 'CB-2006', name: 'Pollo entero', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 12, nominal: true }, variableWeight: true,
      trace: {
        lote: 'L-4107', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.21744/CT',
      },
    },
    {
      id: 'pechuga', code: 'CB-2007', name: 'Pechuga de pollo', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 5 }, variableWeight: true,
      trace: {
        lote: 'L-4108', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.21744/CT',
      },
    },
    {
      id: 'alitas', code: 'CB-2008', name: 'Alitas de pollo', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 6 }, variableWeight: false,
      trace: {
        lote: 'L-4109', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.21744/CT',
      },
    },
    {
      id: 'butifarra', code: 'CB-2009', name: 'Butifarra', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'sarta', factor: 3, nominal: true }, variableWeight: false,
      trace: {
        lote: 'L-4110', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.09933/CT',
      },
    },
    {
      id: 'costillar', code: 'CB-2010', name: 'Costillar de cerdo', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'pieza', factor: 3.4, nominal: true }, variableWeight: true,
      trace: {
        lote: 'L-4111', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.05421/CT',
      },
    },
    {
      id: 'entrecot', code: 'CB-2011', name: 'Entrecot de ternera', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 8, nominal: true }, variableWeight: true,
      trace: {
        lote: 'L-4112', birth: 'Francia', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.05421/CT',
      },
    },
    {
      id: 'picada', code: 'CB-2012', name: 'Carne picada de ternera', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'bandeja', factor: 2 }, variableWeight: false,
      trace: {
        lote: 'L-4113', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.05421/CT',
      },
    },
    {
      id: 'callos', code: 'CB-2013', name: 'Callos', family: 'carne', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 10, nominal: true }, variableWeight: false,
      trace: {
        lote: 'L-4114', birth: 'España', rearing: 'España', slaughter: 'España',
        cutting: 'España', 'plant number': 'ES 10.05421/CT',
      },
    },
  ],
  customers: MEAT_CUSTOMERS,
  comerciales: MEAT_COMERCIALES,
  /* THREE HOUSES THIS ONE BUYS FROM: the escorxador that sends the canales, the charcuterie that
     cures, and the poultry house whose shelf this house forwards whole (see FORWARDING_PARTNERS).
     The names carry `provisional` (C-9) — a supplier's word is the founder's to give. */
  suppliers: [
    { id: 'garriga', name: 'Escorxador Garriga', provisional: true },
    { id: 'olot', name: "Embotits d'Olot", provisional: true },
    { id: 'puigverd', name: 'Avícola Puigverd', provisional: true },
  ],
  /* A LOTE BEHIND EVERY SHELF, AT THE SIZE THE DAY IS SOLD AT. The fish house learned this the
     hard way (the honesty repair at `L-2217`): a product carrying revenue with no cost row makes
     the margin fold count over part of the catalogue and say so forever. So all thirteen have a
     lote, a real morning's purchase and a cost under the price. THE NUMBERS ARE THIS HOUSE'S OWN —
     `L-41xx` is the meat house's sequence, so no two houses' lotes can ever be confused. */
  batches: [
    {
      id: 'L-4102', product: 'mediacanal', supplier: 'garriga', qty: 5200, cost: 3.1, day: '21.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.05421/CT' },
    },
    {
      id: 'L-4103', product: 'chorizo', supplier: 'olot', qty: 640, cost: 27.5, day: '19.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.09933/CT' },
    },
    {
      id: 'L-4104', product: 'lomo', supplier: 'olot', qty: 380, cost: 12.8, day: '19.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.09933/CT' },
    },
    {
      id: 'L-4105', product: 'jamon', supplier: 'olot', qty: 1450, cost: 21.4, day: '18.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.09933/CT' },
    },
    {
      id: 'L-4106', product: 'solomillo', supplier: 'garriga', qty: 620, cost: 19.6, day: '21.08',
      trace: { birth: 'Irlanda', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.05421/CT' },
    },
    {
      id: 'L-4107', product: 'pollo', supplier: 'puigverd', qty: 2100, cost: 2.35, day: '21.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.21744/CT' },
    },
    {
      id: 'L-4108', product: 'pechuga', supplier: 'puigverd', qty: 1350, cost: 4.9, day: '21.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.21744/CT' },
    },
    {
      id: 'L-4109', product: 'alitas', supplier: 'puigverd', qty: 780, cost: 2.1, day: '20.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.21744/CT' },
    },
    {
      id: 'L-4110', product: 'butifarra', supplier: 'olot', qty: 540, cost: 5.4, day: '20.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.09933/CT' },
    },
    {
      id: 'L-4111', product: 'costillar', supplier: 'garriga', qty: 960, cost: 4.2, day: '21.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.05421/CT' },
    },
    {
      id: 'L-4112', product: 'entrecot', supplier: 'garriga', qty: 430, cost: 16.8, day: '20.08',
      trace: { birth: 'Francia', rearing: 'Francia', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.05421/CT' },
    },
    {
      id: 'L-4113', product: 'picada', supplier: 'garriga', qty: 880, cost: 6.1, day: '21.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.05421/CT' },
    },
    {
      id: 'L-4114', product: 'callos', supplier: 'garriga', qty: 320, cost: 3.6, day: '19.08',
      trace: { birth: 'España', rearing: 'España', slaughter: 'España', cutting: 'España', 'plant number': 'ES 10.05421/CT' },
    },
  ],
  /* THE ORDER THIS HOUSE IS DRAWN AGAINST. `l1` stands at 21 kg because the customer said «half a
     media canal» and the canal is 42 kg — `app/sale.ts`'s ASKED_QTY is written against that pair,
     so the line's amount and the words above it are the same fact said twice. */
  order: {
    customer: 'cansole',
    deliveryDay: 'Friday 22.08',
    placedAt: '09:05',
    words: [
      'For Friday: half a media canal, two cajas of chorizo sarta, and 4 kg of jamón al corte.',
      'The jamón sliced thin, same as always.',
    ],
    utterances: [
      { at: 0, text: 'For Friday: half a media canal, two cajas of chorizo sarta,' },
      { at: 3200, text: 'and 4 kg of jamón al corte.' },
      { at: 5400, text: 'The jamón sliced thin, same as always.' },
    ],
    lines: [
      { id: 'l1', product: 'mediacanal', qty: 21, unit: 'kg', price: 4.6, lot: 'L-4102' },
      { id: 'l2', product: 'chorizo', qty: 2, unit: 'caja', price: 36.0, lot: 'L-4103' },
      { id: 'l3', product: 'jamon', qty: 4, unit: 'kg', price: 31.5, lot: 'L-4105' },
    ],
  },
};

/* ═══ FRUIT AND VEG — Fruites Amat, the fruit pavilion at 06:30 ══════════════════════════════
 * Peter's word for this house is the VEGETABLE house, and `trade` says so on every surface that
 * says it out loud. The sector id stays `fruit` because nine sector-keyed tables across `app/` are
 * written in it. Same load as the other two: eight comerciales, eight runs, three hundred accounts,
 * thirteen shelves, a lote behind each.
 */

const FRUIT_HOUSE: House = {
  domain: 'fruitesamat.cat',
  name: 'Fruites Amat',
  legalName: 'Fruites Amat, S.L.',
  taxId: 'B-66 054 318',
  registry: { volume: '46.115', folio: '204', sheet: 'B-512.660', entry: '1ª' },
  fiscalAddress: 'Carrer del Rosselló 92, baixos · 08029 Barcelona',
  warehouse: {
    name: 'Mercabarna · pavelló de fruites i hortalisses',
    address: 'Carrer Transversal 4, Mercabarna · 08040 Barcelona',
    at: { lat: 41.3419, lng: 2.1275 },
  },
  iban: 'ES14 0049 1806 9520 1013 8827',
  phone: '+34 934 12 60 55',
  whatsapp: '+34 627 44 19 06',
  email: 'comandes@fruitesamat.cat',
};

const FRUIT_OWNER: Person = {
  id: 'owner',
  name: 'Mercè Amat',
  role: 'gerente',
  phone: '+34 627 44 19 06',
  email: 'merce@fruitesamat.cat',
  admin: true,
};

const FRUIT_COMERCIALES: Comercial[] = comercialesOf(
  [
    { id: 'bruna', name: 'Bruna Calvet', mail: true },
    { id: 'nil', name: 'Nil Terradas' },
    { id: 'ona', name: 'Ona Bellsolà', mail: true },
    { id: 'pol', name: 'Pol Reguant' },
    { id: 'aina', name: 'Aina Vinyals', mail: true },
    { id: 'xavier', name: 'Xavier Bassols' },
    { id: 'marta', name: 'Marta Bonastre' },
    { id: 'genis', name: 'Genís Almirall', mail: true },
  ],
  FRUIT_HOUSE.domain,
  20,
);

/** THE VEGETABLE HOUSE'S EIGHT RUNS. The doubled zones are the INLAND ones — the Vallès and the
 *  north — because this house's weight is the towns it grew out of, which is a third way of
 *  staffing the same six zones. */
const FRUIT_RUNS: RunSeed[] = [
  { truck: 1, zone: 'centre', comercial: 'bruna', holds: 36 },
  { truck: 2, zone: 'eixample', comercial: 'nil', holds: 39 },
  { truck: 3, zone: 'nord', comercial: 'ona', holds: 35 },
  { truck: 4, zone: 'valles', comercial: 'pol', holds: 42 },
  { truck: 5, zone: 'litoral', comercial: 'aina', holds: 33 },
  { truck: 6, zone: 'costa', comercial: 'xavier', holds: 34 },
  { truck: 7, zone: 'valles', comercial: 'marta', holds: 40 },
  { truck: 8, zone: 'nord', comercial: 'genis', holds: 41 },
];

const FRUIT_BACK_OFFICE: BackOfficeSeed[] = [
  { id: 'pere', name: 'Pere Marquès', role: 'almacen' },
  { id: 'judit', name: 'Judit Sanjaume', role: 'almacen' },
  { id: 'alex', name: 'Àlex Montaner', role: 'repartidor' },
  { id: 'berta', name: 'Berta Casanovas', role: 'oficina', mail: true },
];

const FRUIT_TEAM: Person[] = rosterOf(
  FRUIT_OWNER, FRUIT_COMERCIALES, FRUIT_RUNS, FRUIT_BACK_OFFICE, FRUIT_HOUSE.domain, 20,
);

const FRUIT_LEADS: Customer[] = [
  { id: 'manolo', name: 'Bar Aleu', channel: 'WhatsApp', tier: 'tier 2', settles: 'cash on delivery', zone: 'centre', truck: 1, comercial: 'bruna', at: { lat: 41.4090, lng: 2.1418 } },
  { id: 'cansole', name: 'Restaurant Quirze', channel: 'WhatsApp', tier: 'tier 1', settles: 'credit', zone: 'eixample', truck: 2, comercial: 'nil', slot: '07:30', at: { lat: 41.3790, lng: 2.1595 } },
  { id: 'hotelrec', name: 'Hotel Vela', channel: 'email', tier: 'tier 1', settles: 'credit', zone: 'nord', truck: 3, comercial: 'ona', erp: { id: 'tspoonlab', name: 'tSpoonLab' }, at: { lat: 41.4160, lng: 2.1740 } },
  { id: 'nou', name: 'Restaurant Bagà', channel: 'phone', tier: 'tier 3', settles: 'cash on delivery', zone: 'valles', truck: 4, comercial: 'pol', slot: '10:45', at: { lat: 41.4914, lng: 2.1400 } },
  { id: 'vera', name: 'Distribucions Nolla', channel: 'WhatsApp', tier: 'tier 1', settles: 'credit', zone: 'costa', truck: 6, comercial: 'xavier', slot: '10:15', at: { lat: 41.4680, lng: 2.2800 } },
];

export const FRUIT_CUSTOMERS: Customer[] = [
  ...FRUIT_LEADS,
  ...houseBook({
    forms: FRUIT_FORMS,
    stems: { surname: FRUIT_SURNAMES, place: FRUIT_PLACES },
    runs: FRUIT_RUNS,
    leads: FRUIT_LEADS,
    wholesale: ['Distribucions', 'Fruiteria', 'Càtering'],
    salt: 15013,
  }),
];

export const fruit: Cast = {
  sector: 'fruit',
  label: 'fruit',
  trade: 'Fruit and veg',
  hour: '06:30',
  house: FRUIT_HOUSE,
  owner: FRUIT_OWNER,
  team: FRUIT_TEAM,
  runs: FRUIT_RUNS,
  families: [FRUTA, AMBIENT],
  /* KIT CATALOGUE TRUTH BOUNDARY. The production audit proves this tenant has 308 source-ordered
     SKUs, but that source file is deliberately not checked into this repository. Do not reconstruct
     it from transcript phrases. This compact design fixture keeps its authored order and omits every
     unverified supplier code. Only PMR2 and CEG below are exact source identities evidenced by
     THE-TEST-CHAT-STUDY; the remaining rows stay explicitly provisional. */
  products: [
    {
      id: 'mango', name: 'Mango de barco', family: 'fruta', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 4 }, variableWeight: false,
      trace: {
        lote: 'L-7203', variedad: 'Kent', categoría: 'I', calibre: '12',
        origen: 'Perú', GGN: '4049928615743',
      },
    },
    {
      id: 'aguacate', name: 'Aguacate Hass', family: 'fruta', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 4 }, variableWeight: false,
      trace: {
        lote: 'L-7204', variedad: 'Hass', categoría: 'I', calibre: '16',
        origen: 'Málaga', GGN: '4049928330561',
      },
    },
    {
      id: 'tomate', name: 'Tomate rama', family: 'fruta', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 6 }, variableWeight: false,
      trace: {
        lote: 'L-7205', variedad: 'Ramyle', categoría: 'I', calibre: 'M',
        origen: 'Almería', GGN: '4049928117995',
      },
    },
    {
      id: 'calabacin', name: 'Calabacín', family: 'fruta', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 5 }, variableWeight: false,
      trace: {
        lote: 'L-7206', variedad: 'Sinatra', categoría: 'II', calibre: 'M',
        origen: 'Almería', GGN: '4049928117995',
      },
    },
    {
      id: 'pimiento', code: 'PMR2', name: 'PIMIENTO ROJO 1ª', family: 'fruta', unit: 'kg',
      pack: { unit: 'caja', factor: 5 }, variableWeight: false,
      trace: {
        lote: 'L-7207', variedad: 'Lamuyo', categoría: 'I', calibre: 'G',
        origen: 'Almería', GGN: '4049928117995',
      },
    },
    {
      id: 'cebolla', code: 'CEG', name: 'CEBOLLA SACO 25KG', family: 'fruta', unit: 'kg',
      pack: { unit: 'saco', factor: 10 }, variableWeight: false,
      trace: {
        lote: 'L-7208', variedad: 'Recas', categoría: 'I', calibre: '60/80',
        origen: 'Lleida', GGN: '4049928441120',
      },
    },
    {
      id: 'patata', name: 'Patata monalisa', family: 'fruta', unit: 'kg', provisional: true,
      pack: { unit: 'saco', factor: 15 }, variableWeight: false,
      trace: {
        lote: 'L-7209', variedad: 'Monalisa', categoría: 'I', calibre: '45/65',
        origen: 'Prades', GGN: '4049928441120',
      },
    },
    {
      id: 'lechuga', name: 'Lechuga romana', family: 'fruta', unit: 'pieza', provisional: true,
      pack: { unit: 'caja', factor: 12 }, variableWeight: false,
      trace: {
        lote: 'L-7210', variedad: 'Romana', categoría: 'I', calibre: '12',
        origen: 'Maresme', GGN: '4049928507109',
      },
    },
    {
      /* THE WORD IS CHOSEN FOR WHERE IT LANDS. «Judía verde» stood here first and the reference
         grounds it on a GPC brick that lifts to «Verdura de IV gama» — fourth-range means washed
         and cut, which a crate of fresh beans is not, and the shelf heading would have said so on
         every screen. The puerro is the same kind of staple, it lands on Verdura, and it has a
         face in the painted library. */
      id: 'puerro', name: 'Puerro', family: 'fruta', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 5 }, variableWeight: false,
      trace: {
        lote: 'L-7211', variedad: 'Bandit', categoría: 'I', calibre: 'M',
        origen: 'Maresme', GGN: '4049928507109',
      },
    },
    {
      id: 'alcachofa', name: 'Alcachofa', family: 'fruta', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 8 }, variableWeight: false,
      trace: {
        lote: 'L-7212', variedad: 'Blanca de Tudela', categoría: 'I', calibre: '11/12',
        origen: 'Tudela', GGN: '4049928604327',
      },
    },
    {
      id: 'naranja', name: 'Naranja navelina', family: 'fruta', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 15 }, variableWeight: false,
      trace: {
        lote: 'L-7213', variedad: 'Navelina', categoría: 'I', calibre: '4',
        origen: 'València', GGN: '4049928772016',
      },
    },
    {
      id: 'melon', name: 'Melón piel de sapo', family: 'fruta', unit: 'kg', provisional: true,
      pack: { unit: 'caja', factor: 10 }, variableWeight: false,
      trace: {
        lote: 'L-7214', variedad: 'Piel de sapo', categoría: 'I', calibre: '3',
        origen: 'La Mancha', GGN: '4049928908354',
      },
    },
    {
      id: 'albahaca', name: 'Albahaca', family: 'fruta', unit: 'manojo', provisional: true,
      pack: { unit: 'caja', factor: 20 }, variableWeight: false,
      trace: {
        lote: 'L-7215', variedad: 'Genovesa', categoría: 'I', calibre: '30 g',
        origen: 'Maresme', GGN: '4049928507109',
      },
    },
  ],
  customers: FRUIT_CUSTOMERS,
  comerciales: FRUIT_COMERCIALES,
  /* THREE HOUSES THIS ONE BUYS FROM: the Ponent growers, the market gardens down the Llobregat, and
     the importer that lands the mango and the aguacate. Provisional (C-9) until the founder names
     them — and the placeholder that used to stand here carried the fish owner's own surname, which
     is the kind of accident a seeded world reads as a fact. */
  suppliers: [
    { id: 'ponent', name: 'Fruites de Ponent', provisional: true },
    { id: 'hortes', name: 'Hortalisses del Baix', provisional: true },
    { id: 'tropic', name: 'Tròpic Import', provisional: true },
  ],
  /* A LOTE BEHIND EVERY SHELF, in this house's own sequence — `L-72xx`. */
  batches: [
    {
      id: 'L-7203', product: 'mango', supplier: 'tropic', qty: 1900, cost: 2.15, day: '21.08',
      trace: { variedad: 'Kent', categoría: 'I', calibre: '12', origen: 'Perú', GGN: '4049928615743' },
    },
    {
      id: 'L-7204', product: 'aguacate', supplier: 'tropic', qty: 1450, cost: 3.4, day: '21.08',
      trace: { variedad: 'Hass', categoría: 'I', calibre: '16', origen: 'Málaga', GGN: '4049928330561' },
    },
    {
      id: 'L-7205', product: 'tomate', supplier: 'hortes', qty: 2600, cost: 1.05, day: '20.08',
      trace: { variedad: 'Ramyle', categoría: 'I', calibre: 'M', origen: 'Almería', GGN: '4049928117995' },
    },
    {
      id: 'L-7206', product: 'calabacin', supplier: 'hortes', qty: 1800, cost: 0.86, day: '20.08',
      trace: { variedad: 'Sinatra', categoría: 'II', calibre: 'M', origen: 'Almería', GGN: '4049928117995' },
    },
    {
      id: 'L-7207', product: 'pimiento', supplier: 'hortes', qty: 1250, cost: 1.45, day: '21.08',
      trace: { variedad: 'Lamuyo', categoría: 'I', calibre: 'G', origen: 'Almería', GGN: '4049928117995' },
    },
    {
      id: 'L-7208', product: 'cebolla', supplier: 'ponent', qty: 3100, cost: 0.62, day: '19.08',
      trace: { variedad: 'Recas', categoría: 'I', calibre: '60/80', origen: 'Lleida', GGN: '4049928441120' },
    },
    {
      id: 'L-7209', product: 'patata', supplier: 'ponent', qty: 4200, cost: 0.48, day: '19.08',
      trace: { variedad: 'Monalisa', categoría: 'I', calibre: '45/65', origen: 'Álava', GGN: '4049928441120' },
    },
    {
      id: 'L-7210', product: 'lechuga', supplier: 'hortes', qty: 1600, cost: 0.72, day: '21.08',
      trace: { variedad: 'Romana', categoría: 'I', calibre: '12', origen: 'Maresme', GGN: '4049928507109' },
    },
    {
      id: 'L-7211', product: 'puerro', supplier: 'hortes', qty: 900, cost: 1.15, day: '21.08',
      trace: { variedad: 'Bandit', categoría: 'I', calibre: 'M', origen: 'Maresme', GGN: '4049928507109' },
    },
    {
      id: 'L-7212', product: 'alcachofa', supplier: 'ponent', qty: 720, cost: 2.3, day: '20.08',
      trace: { variedad: 'Blanca de Tudela', categoría: 'I', calibre: '11/12', origen: 'Tudela', GGN: '4049928604327' },
    },
    {
      id: 'L-7213', product: 'naranja', supplier: 'ponent', qty: 2800, cost: 0.94, day: '20.08',
      trace: { variedad: 'Navelina', categoría: 'II', calibre: '4', origen: 'València', GGN: '4049928772016' },
    },
    {
      id: 'L-7214', product: 'melon', supplier: 'ponent', qty: 2200, cost: 0.78, day: '21.08',
      trace: { variedad: 'Piel de sapo', categoría: 'I', calibre: '3', origen: 'La Mancha', GGN: '4049928908354' },
    },
    {
      id: 'L-7215', product: 'albahaca', supplier: 'hortes', qty: 240, cost: 0.85, day: '21.08',
      trace: { variedad: 'Genovesa', categoría: 'I', calibre: '30 g', origen: 'Maresme', GGN: '4049928507109' },
    },
  ],
  order: {
    customer: 'cansole',
    deliveryDay: 'Friday 22.08',
    placedAt: '07:40',
    words: [
      'For tomorrow: 3 cajas of mango de barco, 2 of aguacate Hass, and 6 kg of tomate rama.',
      'El aguacate bien maduro, we plate it on Saturday.',
    ],
    utterances: [
      { at: 0, text: 'For tomorrow: 3 cajas of mango de barco,' },
      { at: 2400, text: '2 of aguacate Hass, and 6 kg of tomate rama.' },
      { at: 6000, text: 'El aguacate bien maduro, we plate it on Saturday.' },
    ],
    lines: [
      { id: 'l1', product: 'mango', qty: 12, unit: 'kg', wasQty: 3, price: 3.2, lot: 'L-7203' },
      { id: 'l2', product: 'aguacate', qty: 8, unit: 'kg', wasQty: 2, price: 4.9, lot: 'L-7204' },
      { id: 'l3', product: 'tomate', qty: 6, unit: 'kg', price: 1.75, lot: 'L-7205' },
    ],
  },
};

/* ── THE INDEX ────────────────────────────────────────────────────────────────────────────────
 * The sector switch hands a screen one of these; nothing else about the screen changes. */

export const CASTS: Record<SectorId, Cast> = { fish, meat, fruit };
export const SECTORS: SectorId[] = ['fish', 'meat', 'fruit'];

/* ── WHAT A VARIATION IS WORTH (FEED-IA §127.4c, off S10) ─────────────────────────────────────
 * «The catalog's story is variations… AND THE PRICE CHANGES PER VARIATION.»
 *
 * THE DEFECT THIS FIXES, EXACTLY. Merluza's three members — entera · sin cabeza · de pincho — all
 * printed 14,82 €/kg, because a member with no written price falls back to its FAMILY'S number and
 * nobody had ever written one. Three rows, one figure, on the surface whose whole subject is that
 * these are DIFFERENT THINGS. A catalogue that prices every form of the goods identically is a
 * catalogue saying the forms do not matter.
 *
 * IT IS A RATIO AND NOT A PRICE, and that is the honest shape. The house's own arithmetic already
 * decides what merluza costs — the cost it actually paid, carried up by the list margin, stepped
 * down by the band — so a typed absolute here would be a second source of truth that drifts the
 * moment a supplier moves. What the trade actually knows is the RELATION: hook-caught hake carries
 * a third again over the net, a headless presentation moves keener than prime whole fish, cooked
 * octopus carries the labour and the yield loss. That relation is stable, so that is what is
 * written, and every band inherits it by construction.
 *
 * `why` is not decoration: it is what a fishmonger would say, and it is the thing to argue with if
 * one of these is wrong.
 */
export type VariationPrice = {
  sector: SectorId;
  /** the member's own id — an amendment's or a learned sort's, as `catalogue.ts` mints them */
  member: string;
  /** the product it hangs off, whose band price this is a ratio of */
  base: string;
  /** what it stands at, as a share of the base form's own price on the same band */
  of: number;
  why: string;
};

export const VARIATION_PRICES: VariationPrice[] = [
  { sector: 'fish', member: 'am-fish-merluza', base: 'merluza', of: 0.88, why: 'Headless moves as the everyday presentation, under prime whole fish' },
  { sector: 'fish', member: 'so-fish-merluza', base: 'merluza', of: 1.34, why: 'Hook-caught: one fish at a time, unmarked, and the market pays for it' },
  { sector: 'fish', member: 'am-fish-pulpo', base: 'pulpo', of: 1.42, why: 'Cooked carries the labour and the weight it loses in the pot' },
  { sector: 'fish', member: 'so-fish-pulpo', base: 'pulpo', of: 1.18, why: 'Rock octopus is firmer and the kitchens ask for it by name' },
  { sector: 'fish', member: 'am-fish-gamba', base: 'gamba', of: 0.62, why: 'Frozen is a different trade from a Palamós boat the same morning' },
  { sector: 'meat', member: 'am-meat-alitas', base: 'alitas', of: 0.86, why: 'Frozen wings hold, so they go out under the fresh line' },
  { sector: 'meat', member: 'am-meat-jamon', base: 'jamon', of: 1.22, why: 'Sliced is bench time and the trim that goes with it' },
  { sector: 'meat', member: 'am-meat-mediacanal', base: 'mediacanal', of: 1.28, why: 'Boned out is the butcher’s hour, carried on the kilo that is left' },
  { sector: 'meat', member: 'so-meat-solomillo', base: 'solomillo', of: 1.35, why: 'Galician tenderloin is bought as its own thing, not as tenderloin' },
  { sector: 'fruit', member: 'am-fruit-aguacate', base: 'aguacate', of: 1.12, why: 'Ready to eat is a week of ripening room somebody paid for' },
  { sector: 'fruit', member: 'am-fruit-tomate', base: 'tomate', of: 0.9, why: 'Green goes to the kitchens that want it firm, and it goes keener' },
  { sector: 'fruit', member: 'so-fruit-tomate', base: 'tomate', of: 1.15, why: 'Greek vine is bought for the vine, and it travels further' },
];

/* ── LOOKUPS ──────────────────────────────────────────────────────────────────────────────────
 * Every screen reads names through these, so a screen never holds a string. */

export const productOf = (cast: Cast, id: string): Product =>
  cast.products.find((p) => p.id === id) ?? cast.products[0];

export const customerOf = (cast: Cast, id: string): Customer =>
  cast.customers.find((c) => c.id === id) ?? cast.customers[0];

export const supplierOf = (cast: Cast, id: string): Supplier =>
  cast.suppliers.find((s) => s.id === id) ?? cast.suppliers[0];

/** WHO HOLDS THIS ACCOUNT (§12), as a name and never as a number. */
export const comercialOf = (cast: Cast, customer: Customer): Comercial | undefined =>
  customer.comercial ? cast.comerciales.find((c) => c.id === customer.comercial) : undefined;

/** THE HOUSE, THE ROSTER AND THE RUNS OF ONE SECTOR. Administration reads these, so switching the
 *  seeded house switches the papers, the Team seat and Geografía with it (§89.2). */
export const houseOf = (s: SectorId): House => CASTS[s].house;
export const teamOf = (s: SectorId): Person[] => CASTS[s].team;
export const runsOf = (s: SectorId): RunSeed[] => CASTS[s].runs;

/** the fish house's own, kept under their old names — see the callers in `app/company.ts` */
export const HOUSE = fish.house;
export const OWNER = fish.owner;
export const TEAM = fish.team;
export const RUNS = fish.runs;
export const HOUSE_DOMAIN = fish.house.domain;
export const COMERCIALES = fish.comerciales;

/** HOW MANY ACCOUNTS ONE OF THEM HOLDS. The member card's «their book» is this number, and it is
 *  counted off the same book the customers area draws — a headcount that disagreed with the book
 *  would be the software contradicting itself across two seats. */
export const bookOf = (cast: Cast, person: string): Customer[] =>
  cast.customers.filter((c) => c.comercial === person);

/** THE BOOK, INDEXED. A screen asking «who is this customer» three hundred times a render may not
 *  walk three hundred rows to find out, so the lookup above is backed by a map built once per cast
 *  (§31.1 — scale is what turns a linear scan into a frame drop). */
const BOOKS = new WeakMap<Cast, Map<string, Customer>>();

export function customerBook(cast: Cast): Map<string, Customer> {
  const held = BOOKS.get(cast);
  if (held) return held;
  const made = new Map(cast.customers.map((c) => [c.id, c]));
  BOOKS.set(cast, made);
  return made;
}

export const batchOf = (cast: Cast, id: string): Batch | undefined =>
  cast.batches.find((b) => b.id === id);

export const familyOf = (cast: Cast, product: Product): Family =>
  cast.families.find((f) => f.id === product.family) ?? UNCLASSIFIED_FAMILY;

/** The order line's secondary row: the family's two line fields, filled from the product. This is
 *  the whole of A1's sector delta — the markup is one, the row is data. */
export const lineFacts = (cast: Cast, product: Product): Array<{ label: string; value: string }> =>
  familyOf(cast, product).lineFields.map((label) => ({ label, value: product.trace[label] ?? '' }));

/** Does any family in this account record a lote? Group K's third rail turns on this. */
export const recordsLots = (cast: Cast): boolean =>
  cast.families.some((f) => f.traceability !== 'none');

/* ── OFF THE LIST ─────────────────────────────────────────────────────────────────────────────
 * THE-APP-V2 §2: a line can name something the catalogue does not hold, and it is simply labelled
 * `sku: false`. These are those labels — the things that ride along on an order and were never
 * given a SKU: ice, herbs, casing. They live HERE and not in the surface that draws them, because
 * law 10 holds for them too: no name is typed into a screen.
 *
 * Every one carries `provisional` (C-9), because these are the trade's ordinary words and not yet
 * the founder's chosen ones — so Stock draws them with the same hairline underline it draws the
 * meat cast with, and one sentence in this file replaces them.
 */
export type OffListItem = Named & {
  id: string;
  /** what the customer's own line asked for, in the words they used */
  qty: number;
  unit: string;
};

export const OFF_LIST: Record<SectorId, OffListItem[]> = {
  fish: [
    { id: 'hielo', name: 'Hielo en escamas', provisional: true, qty: 2, unit: 'saco' },
    { id: 'almeja', name: 'Almeja fina', provisional: true, qty: 3, unit: 'kg' },
  ],
  meat: [
    { id: 'tripa', name: 'Tripa natural', provisional: true, qty: 4, unit: 'madeja' },
    { id: 'manteca', name: 'Manteca de cerdo', provisional: true, qty: 6, unit: 'kg' },
  ],
  fruit: [
    { id: 'perejil', name: 'Perejil', provisional: true, qty: 5, unit: 'manojo' },
    { id: 'hielo', name: 'Hielo en escamas', provisional: true, qty: 2, unit: 'saco' },
  ],
};

/* ── THE PARTNER SUPPLIERS (FEED-IA §35.7) ────────────────────────────────────────────────────
 * «Chosen products (all, or categories) are sent AS A LIST by email to a partner supplier
 * (company name · the person/team that handles it · address), on a CUTOFF TIMER per product
 * category — chicken and turkey cut off at 01:30 and sent daily to the beef supplier; later
 * arrivals roll to the next day. The send is AUTOMATIC — no person presses it at 01:30.»
 *
 * THE FOUNDER'S OWN EXAMPLE IS A MEAT HOUSE forwarding its poultry shelf to the house that handles
 * it, so it is seeded where it belongs: Carns Bofill lists pollo, pechuga and alitas, and Avícola
 * Puigverd fulfils them. Its cutoff is 01:30, BEFORE the meat house's morning opens at 08:00 — so a
 * morning's orders never make that morning's list and every one of them rolls to the next day's
 * run, which is the case verbatim.
 *
 * The fish house carries the same shape twice over, and its two seeds are deliberately the two
 * cases the mechanic has:
 *
 *   · MARISCOS VIDAL cuts off at 01:30, BEFORE the lonja opens at 05:00 — the founder's own case,
 *     transposed.
 *   · ESTEROS DE SANLÚCAR cuts off at 06:00, INSIDE the working morning — so a run splits a day in
 *     two: the early orders make today's list and the rest roll. That is the case the first one
 *     cannot show.
 *
 * A PARTNER'S NAME IS NOT PROVISIONAL (C-9). That flag marks vocabulary the founder has still to
 * choose — a product's word, a shelf's word. A partner supplier is the house's own trading
 * partner, the same kind of fact as a customer's name, and the customer book is not provisional
 * either: a name belongs to whoever it names.
 *
 * `categories` ARE LADDER NODES (`app/catalogue.ts`'s tree), never words. Categorisation IS the
 * routing (THE-DENSE-BRIEF §C), so what a partner takes is stated in the same ids the intelligence
 * grounds a written name onto, and the two can never drift into two opinions.
 *
 * THE VEGETABLE HOUSE CARRIES THE EMPTY STATE, on purpose. A house that has connected nobody is the
 * ordinary state this feature is offered from, and the empty state is where it says what connecting
 * one will do (§35.6, the Google-setup feeling). Switching to Fruites Amat in Settings reaches it.
 */
export type PartnerSeed = {
  id: string;
  company: string;
  /** the person or the team that handles it at their end */
  contact: string;
  contactKind: 'person' | 'team';
  email: string;
  /** ladder nodes: a family (L0) takes everything under it, a category (L1) takes its own shelf */
  categories: string[];
  /** «01:30» — the hour the day's list closes and goes */
  cutoff: string;
};

export const FORWARDING_PARTNERS: Record<SectorId, PartnerSeed[]> = {
  fish: [
    {
      id: 'vidal',
      company: 'Mariscos Vidal',
      contact: 'Quim Vidal',
      contactKind: 'person',
      email: 'pedidos@mariscosvidal.es',
      /* Marisco and Cefalópodos — the gamba and the pulpo, which this house sells and another
         house lands. Two shelves on one partner is what makes the set a COMBINATION (§35.8). */
      categories: ['n-shellfish', 'n-cephalopod'],
      cutoff: '01:30',
    },
    {
      id: 'sanlucar',
      company: 'Esteros de Sanlúcar',
      contact: 'Pedidos',
      contactKind: 'team',
      email: 'pedidos@esterosdesanlucar.es',
      /* Pescado de crianza — the lubina de estero, which comes off the Cádiz esteros and not off
         the lonja. One shelf, and the contact is a desk rather than a person. */
      categories: ['n-farmed'],
      cutoff: '06:00',
    },
  ],
  meat: [
    {
      id: 'puigverd',
      company: 'Avícola Puigverd',
      contact: 'Ramon Puigverd',
      contactKind: 'person',
      email: 'comandes@avicolapuigverd.cat',
      /* Aves — the whole poultry shelf: pollo, pechuga and alitas. The house sells them, the
         partner rears and dresses them, and the list goes at 01:30 without anybody pressing it. */
      categories: ['n-poultry'],
      cutoff: '01:30',
    },
  ],
  fruit: [],
};

/** A sector verdict, spelled for a reader. Used by the shell and the consolidated page alike. */
export const VERDICT_TEXT: Record<Verdict, string> = {
  '=': 'same screen',
  'Δ': 'same screen, different content',
  '≠': 'absent',
};
