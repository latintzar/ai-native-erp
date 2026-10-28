/* WHAT ROCOTO KNOWS — the learned-observations store. THE-INTELLIGENCE §4, §5 and §10.
 *
 * ═══ THE PLACE THE MODELLING LIVES (§4) ════════════════════════════════════════════════════
 * «ERP providers seem okay with giving us a whole year of orders, fulfilled albaranes, invoices,
 * customers. There needs to be some place where this learning, this modelling, lives.»
 *
 * This file is that place's DATA. It is not a tab and it is not a dashboard: it is a set of
 * OBSERVATIONS, each one a sentence a person could say out loud, each one carrying the facts it
 * was read off. «Fridays, Can Solé takes about 12 kg of Merluza» — never `confidence: 0.87`.
 *
 * ═══ AND THE THING THEY ALL HANG ON IS THE TREE (§10) ══════════════════════════════════════
 * «It's not pure customers × products — that's generic and salty. It's per actual type of thing.»
 *
 * So the middle of everything here is the ONTOLOGY: the produce tree Rocoto brings with it, that
 * every house SKU and every customer's word grounds onto (§10.2). An order resolves in three hops,
 * and each hop is separately learnable (§10.4):
 *
 *     words ──(customer routing)──▶ NODE ──(house prior, at this date)──▶ the sort ──▶ the line
 *
 * That is why `Observation` carries a `node` beside its customer and its product, why the web's
 * middle column IS the tree, and why the two new kinds of pattern are exactly the two hops:
 *   · HOUSE PRIOR    node × season → the sort this house fulfils it with
 *                    «In October, Tomate rama · pink here means the Ramyle.»
 *   · CUSTOMER ROUTING  customer × node → the resolution their words land at
 *                    «For Bar Manolo it is all just pink.»
 *
 * ═══ THE FIVE RULES THIS FILE KEEPS ════════════════════════════════════════════════════════
 *
 * 1 · AN OBSERVATION IS A SENTENCE WITH ITS EVIDENCE. `sentence` is what Rocoto noticed;
 *     `evidence` is the handful of facts underneath it, in words and counts — the things a person
 *     can go and check. A bare percentage is the thing this product replaces, so there is no field
 *     here that can hold one.
 *
 * 2 · OBSERVATIONS ARE DERIVED, NEVER STORED. `buildKnows(cast, imported)` is a pure function of
 *     the catalogue, the tree and whether a history has been brought in. Nothing writes an
 *     observation row, so two surfaces cannot disagree about what is known, and the count in the
 *     import's readback is the count of things actually on screen.
 *
 * 3 · THE ONLY THING THE STORE HOLDS IS THE IMPORT EVENT. «The import renders as an event — what
 *     arrived, what was read, what it taught» (§4.1). One module singleton through
 *     `useSyncExternalStore`, the same shape `rules.ts` and `incoming.ts` already keep.
 *
 * 4 · NO NAME IS TYPED INTO A SCREEN (law 10) — WITH ONE DECLARED EXCEPTION, AND IT IS THE ASSET.
 *     Every customer, product, unit, class and sort in these sentences comes out of
 *     `data/cast.ts`. What does NOT is the ENCYCLOPEDIA's own words — the forms, the states, the
 *     tomato types — and that is precisely §10.1: «In any company you'd start with some type of
 *     pre-seeded intelligence. They're paying us for that knowledge.» Those words are ours, they
 *     are the same for every tenant, and they live in one constant with their level named.
 *     The menu dishes are the other exception, declared where they sit.
 *
 * 5 · THE FULFILMENT FINGERPRINT IS PAIRS (§5). `historyOf` returns past albaranes whose every
 *     line carries what was ASKED beside what was GIVEN, with §1's provenance note on the ones
 *     that differ. That pairing is the record the fulfilment brain is trained on.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';
import { scatterId, type Cast, type Customer, type Product } from '../../scenarios/data/cast';
import { priceOf } from '../../scenarios/canonical/resolution';
import { dayFromId, todayId } from './sale';
/* the ladder's own vocabulary and the grounding that places a product on it (THE-DENSE-BRIEF §C) */
import { ground, prepWordsFor } from './catalogue';

/* ── THE OBSERVATION ──────────────────────────────────────────────────────────────────────── */

/** What kind of thing was noticed. The kind decides nothing about how it renders — every one of
 *  them is a sentence — but it is what lets a surface ask for the menu card on its own, and what
 *  separates the two hops of the router from everything else. */
export type ObservationKind =
  | 'routing'     /* customer × node — the resolution their words land at (§10.3) */
  | 'prior'       /* node × season → the sort this house fulfils it with (§10.3) */
  | 'rhythm'      /* when they order, and how much */
  | 'fulfilment'  /* what you actually send when they ask for a thing */
  | 'unit'        /* the unit they ask in, against the unit the albarán goes out in */
  | 'amendment'   /* the personalization that rides every order (§2, the frozen chicken) */
  | 'substitute'  /* the SKU they take when the one they asked for runs out (§197.2, §193.4) */
  | 'menu'        /* their own menu changed, read off their public listing */
  | 'dispute'     /* what they have queried, and how it ended */
  | 'product'     /* a fact about the goods rather than about a customer */
  /** ── HOW THE HOUSE'S OWN MESSAGES READ (THE-CHECKPOINT §5.2 — Company DNA) ────────────────
   *  «Also support a profile based on the company's real communication history — current concept:
   *  Company DNA. This can be inferred from WhatsApp/email history rather than forcing the
   *  customer to write a style prompt.»
   *
   *  IT IS THE ONE KIND THAT IS ABOUT THE HOUSE ITSELF. Every other observation is about a
   *  customer, a node or a product; this one is about the way the house writes, so it carries no
   *  `customer` and no `node` and hangs on nothing in the web. That is deliberate: a register is
   *  not a fact about anybody's account.
   *
   *  AND IT IS READ, NEVER ASKED. The whole point of §5.2 is that a house should not have to write
   *  a style prompt, so these sentences arrive with the year of messages and the house's only job
   *  is to say which of them are not it (`grants.dnaDropped`). */
  | 'style';

/** Where the knowing came from. Each one is a different kind of claim, and the surface says which:
 *  `here` is what this app has watched happen, `import` is what the year of history taught, and
 *  `google` is somebody else's document — which is why it carries an attribution. */
export type ObservationSource = 'here' | 'import' | 'google';

/** One fact underneath a sentence. Words and counts; a place to go and look. */
export type Evidence = {
  fact: string;
  /** where the fact can be checked — an albarán range, a source */
  where?: string;
};

/** SOURCE ATTRIBUTION IS TRUST (§5). An observation read off somebody else's document says whose
 *  document it was, on the card, with their mark. */
export type Attribution = { mark: 'google'; place: string; found: string };

export type Observation = {
  id: string;
  kind: ObservationKind;
  sector: SectorId;
  /** Customer.id, where the observation is about one */
  customer?: string;
  /** TreeNode.id — the ontology node this pattern hangs on (§10.3). Nearly everything has one:
   *  a pattern about a thing is a pattern about the NODE that thing grounds onto. */
  node?: string;
  /** the node's own words, carried so a surface can name it without holding the tree */
  nodeName?: string;
  /** Product.id, where the observation names the sort the house actually ships */
  product?: string;
  /** WHAT ROCOTO NOTICED, as a sentence. This is the whole of what a person reads. */
  sentence: string;
  /** the facts it was read off */
  evidence: Evidence[];
  source: ObservationSource;
  attribution?: Attribution;
  /** how many times the pattern has been seen. It weights the web's links and is NEVER drawn as a
   *  percentage — the evidence says it in words where it needs saying. */
  seen: number;
};

/* ── THE TREE (§10.1) ─────────────────────────────────────────────────────────────────────────
 * «Rocoto ships knowing the produce world: family → category → type → sort, with facets. Tomatoes:
 * pink · cherry · plum · beefheart. Fish: species × whole/fillet/loin. Meat: animal × cut ×
 * fresh/frozen. This is a platform asset — OUR encyclopedia, versioned, curated, the same for
 * every tenant.»
 *
 * THE PROTOTYPE SIMULATES A SMALL REAL SLICE OF IT, so the UI contract is exact (§10.8). And it
 * simulates the thing that makes the architecture true rather than pretty: HOUSES SEE THE TREE AT
 * THEIR OWN RESOLUTION. «For them, maybe it's all pink and it doesn't really matter which.» So one
 * branch of this house's catalogue is drawn SPLIT — the level the encyclopedia knows about — and
 * the rest are drawn COLLAPSED, at the resolution this house actually works in. Ambiguity is a
 * first-class state of the tree, never an error.
 */

export type NodeLevel = 'category' | 'type';

export type TreeNode = {
  id: string;
  /** the words the node is known by, at this house's resolution — the label on a column */
  name: string;
  /** the same node INSIDE A SENTENCE. A taxonomy label reads «Merluza · fillet» in a column and
   *  «fillet Merluza» in prose, and a sentence that carries the column's punctuation is a sentence
   *  nobody can read aloud. */
  phrase: string;
  /** the word above it — what a customer would say if they said nothing finer */
  category: string;
  level: NodeLevel;
  /** what this level ADDS, in the encyclopedia's own word — a form, a state, a tomato type */
  facet?: string;
  /** what the facet IS, so a surface can say «form» or «sort» rather than «facet» */
  facetWord?: string;
  /** the house's own products this node resolves to (§10.4's second hop) */
  products: string[];
  /** the node above it, where the house works below one */
  parent?: string;
};

/** THE ENCYCLOPEDIA'S OWN WORDS — the one thing in this file that does not come out of the cast,
 *  because it is not the house's knowledge. It is the asset they are paying for (§10.1).
 *
 *  The meat branch of the real tree is animal × cut × fresh/frozen; this house's catalogue already
 *  sits AT the cut level (media canal, jamón, solomillo are cuts), so the level it can still be
 *  split at is the state — which is exactly the frozen-chicken amendment (§2) read as an ontology
 *  fact rather than as a note on a line. */
const ENCYCLOPEDIA: Record<SectorId, { split: string; facetWord: string; facets: string[] }> = {
  fish: { split: 'merluza', facetWord: 'form', facets: ['whole', 'fillet'] },
  meat: { split: 'mediacanal', facetWord: 'state', facets: ['fresh', 'frozen'] },
  fruit: { split: 'tomate', facetWord: 'sort', facets: ['pink', 'cherry', 'plum', 'beefheart'] },
};

/** The season a house prior is stated for. October first, because that is the founder's own
 *  example of the thing («the typical tomato of the pink category… THIS in May, and the other one
 *  in October»). */
const SEASON = ['October', 'May', 'August', 'March'];

/** The facet of the product's own trace that names THE SORT this house fulfils a node with — the
 *  third hop of the router, read off the catalogue rather than invented: the boat for fish, the
 *  plant for meat, the variety for produce. */
const SORT_FACET: Record<SectorId, string> = {
  fish: 'buque',
  meat: 'plant number',
  fruit: 'variedad',
};

/** …and what to call it, so «means the Nuevo Aurora» reads as the boat's own fish rather than as a
 *  boat somebody is being sent. */
const SORT_PHRASE: Record<SectorId, (sort: string) => string> = {
  fish: (s) => `the ${s}’s`,
  meat: (s) => `the ${s} plant’s`,
  fruit: (s) => `the ${s}`,
};

/** The sort this house ships a product as, in the catalogue's own words. */
export const sortOf = (cast: Cast, product: Product): string =>
  product.trace[SORT_FACET[cast.sector]] ?? product.trace.lote ?? product.name;

/** That sort, said in a sentence. */
export const sortPhrase = (cast: Cast, product: Product): string =>
  SORT_PHRASE[cast.sector](sortOf(cast, product));

/**
 * THE HOUSE'S SLICE OF THE TREE.
 *
 * One branch split to the level the encyclopedia knows (the tomato's types, the merluza's forms,
 * the cut's states); every other branch collapsed to the one word this house uses. The split
 * branch's own category node is NOT drawn — its types carry it — because a column that draws both
 * a parent and its children is a column that says one thing twice.
 */
export function treeOf(cast: Cast): TreeNode[] {
  const enc = ENCYCLOPEDIA[cast.sector];
  const out: TreeNode[] = [];

  cast.products.forEach((product) => {
    if (product.id === enc.split) {
      enc.facets.forEach((facet) => {
        out.push({
          id: `n-${product.id}-${facet}`,
          name: `${product.name} · ${facet}`,
          phrase: `${facet} ${product.name}`,
          category: product.name,
          level: 'type',
          facet,
          facetWord: enc.facetWord,
          products: [product.id],
          parent: `n-${product.id}`,
        });
      });
      return;
    }
    out.push({
      id: `n-${product.id}`,
      name: product.name,
      phrase: product.name,
      category: product.name,
      level: 'category',
      products: [product.id],
    });
  });

  return out;
}

/** The node a product grounds onto by default — the house's own first resolution for it. */
export const nodeOfProduct = (tree: TreeNode[], product: string): TreeNode | undefined =>
  tree.find((n) => n.products.includes(product));

export const nodeById = (tree: TreeNode[], id: string): TreeNode | undefined =>
  tree.find((n) => n.id === id);

/** The node a customer's own words land at (§10.3, customer routing). Where the branch is split,
 *  different customers land at different depths of it — which is the whole point of the level. */
export function routeOf(cast: Cast, tree: TreeNode[], customer: Customer): TreeNode {
  const enc = ENCYCLOPEDIA[cast.sector];
  const ci = Math.max(0, cast.customers.findIndex((c) => c.id === customer.id));
  const types = tree.filter((n) => n.level === 'type');
  if (types.length > 0) return types[ci % types.length];
  return tree[ci % tree.length];
}

/* ── THE WEB'S EDGES (§4.2, §10.8) ────────────────────────────────────────────────────────────
 * «The web's middle layer IS the tree — customers ↔ nodes ↔ the house's products.»
 *
 * So there are TWO kinds of edge and they are the router's two hops. A ROUTE is learned — it comes
 * off a customer's own observations and its weight is how often that pattern has been watched. A
 * PRIOR is the grounding — it exists because the catalogue is on the tree at all — and it carries
 * the house prior's sentence where the history has taught one.
 */
export type KnowLink = {
  id: string;
  kind: 'route' | 'prior';
  /** Customer.id for a route, TreeNode.id for a prior */
  from: string;
  /** TreeNode.id for a route, Product.id for a prior */
  to: string;
  /** how often the hop has been watched. It draws the line's thickness, and the panel says it in
   *  words beside the name at the other end — the SENTENCES live on the observations, so an edge
   *  never repeats one two inches above where it already stands. */
  seen: number;
};

export type Knows = {
  sector: SectorId;
  tree: TreeNode[];
  observations: Observation[];
  links: KnowLink[];
  /** what the import taught, where one has happened */
  learned: number;
  imported?: ImportEvent;
};

/* ── THE IMPORT EVENT (§4.1) ──────────────────────────────────────────────────────────────────
 * «Upload the ERP dump — orders, albaranes, invoices, customers; a year of them. The import
 * renders as an event: what arrived, what was read, what it taught.» And since §10.2, what it
 * taught starts with GROUNDING: every SKU, every learned sort, every order phrase placed onto a
 * node of the tree. That number goes in the readback, because it is the first thing that happened.
 */

export type ImportEvent = {
  id: string;
  sector: SectorId;
  /** ISO instant — the hour it landed */
  at: string;
  /** the file the person chose */
  file: string;
  /** what arrived */
  albaranes: number;
  customers: number;
  months: number;
  /** what was placed on the tree (§10.2) */
  grounded: number;
  /** what it taught */
  learned: number;
};

/** THE BOOK A HOUSE OF THIS SIZE ACTUALLY HAS. The cast is the sample the app draws with; the dump
 *  is the whole ledger behind it, so the numbers are derived from the catalogue rather than typed:
 *  every customer, every delivery day of a year, every distinct name on all of it. */
export type Dump = { customers: number; albaranes: number; months: number; grounded: number };

export const IMPORT_MONTHS = 12;

export function dumpOf(cast: Cast): Dump {
  const customers = cast.customers.length * 9 + 3;
  return {
    customers,
    albaranes: customers * 29 + cast.products.length * 4,
    months: IMPORT_MONTHS,
    /* the distinct item names on a year of paperwork: the catalogue, its learned sorts, and every
       phrase a customer wrote that resolved to one of them */
    grounded: cast.products.length * 38 + 24,
  };
}

/* ── DAYS ─────────────────────────────────────────────────────────────────────────────────────
 * The trade writes `dd.mm` and so does the cast, so the history walks backwards in that form. The
 * year comes off the clock because a cast has none — nothing here depends on which year it is.
 */
export function daysBefore(day: string, n: number): string {
  const [dd, mm] = day.split('.').map(Number);
  const d = new Date(new Date().getFullYear(), (mm || 1) - 1, (dd || 1) - n);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** «21.08» → sortable. */
const dayKey = (d: string): number => {
  const [dd, mm] = d.split('.').map(Number);
  return (mm || 0) * 100 + (dd || 0);
};

/** The most recent day the catalogue can point at, so the history hangs off the cast's own week. */
const anchorDay = (cast: Cast): string =>
  [...cast.batches].sort((a, b) => dayKey(a.day) - dayKey(b.day))[0]?.day ?? '20.08';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const amount = (n: number, locale = 'es-ES'): string =>
  n.toLocaleString(locale, { maximumFractionDigits: 2 });

/** A COUNT, GROUPED. Spanish CLDR groups only from five digits up, so `toLocaleString` alone gives
 *  «1412» — which reads as a reference number rather than as one thousand four hundred albaranes,
 *  and in a headline that is the difference between a fact and a code. The separator is still the
 *  locale's own; only the grouping is forced. (`'always'` is ES2023 and the ES2020 lib types do not
 *  know it yet; an engine without it falls back to the default, which is today's behaviour.) */
export const count = (n: number, locale = 'es-ES'): string =>
  n.toLocaleString(locale, { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);

/** «1 caja» · «2 cajas». The trade's own nouns take a plural; the measures are symbols and do not.
 *  A row that reads «asked 2 caja» is the small wrongness that makes a screen look machine-made. */
const SYMBOLS = new Set(['kg', 'g', 'l', 'ml', 'S/', 'PEN', '€']);

export const units = (n: number, unit: string): string =>
  SYMBOLS.has(unit) || n === 1 ? unit : `${unit}s`;

/* ── THE FULFILMENT FINGERPRINT (§5) ──────────────────────────────────────────────────────────
 * «What they ordered vs what was actually given — the pairing is the important thing.»
 *
 * Every past line carries BOTH numbers and, where they differ, the note §1 puts under a filled
 * line — read retrospectively. Three things make a pair differ, and all three are real:
 *   · the pack. They asked for a caja; the albarán went out in kilos, because that is what a caja
 *     of this product weighs.
 *   · the scale. They asked for 12 kg; 12,4 went on the crate, because fish does not come in
 *     round numbers.
 *   · the shelf. They asked for one class and took another, because that is what was there.
 */

export type PairLine = {
  product: Product;
  /** what they asked for, in the words they asked in */
  asked: number;
  askedUnit: string;
  /** what went on the albarán */
  given: number;
  unit: string;
  /** §1's provenance note, retrospectively — quiet, and only where the two differ */
  note?: string;
};

export type PastAlbaran = {
  id: string;
  number: string;
  day: string;
  lines: PairLine[];
  figure: number;
  /** the complaint they raised on this one, where they raised one */
  dispute?: { because: string; outcome: string };
};

/** How far back a fingerprint is worth drawing. Five albaranes is a table a person reads in one
 *  pass — and the WINDOW it covers is the account's own: a fortnight of a kitchen that takes two
 *  deliveries a week, five weeks of a bar that takes one standing Friday. It is counted in
 *  albaranes rather than in days because the albarán is what the house has. */
export const HISTORY_DEPTH = 5;

/** What the scale added, line by line. Deterministic, so a profile reads the same on every open. */
const OVER = [0.4, 0.25, -0.15, 0.6, 0.1, -0.3];

/* ── THE ACCOUNTS THAT ARE SLIPPING (THE-DATA-CANON §6.2b — an honesty repair, not a feature) ──
 * «Customers who have DROPPED their order values and might need attention» is the call-them-today
 * item, and it is the reason the whole projection layer exists (FEED-IA §60.2). It was UNFINDABLE
 * in this world: every account's figures oscillate by modular arithmetic, so a detector tuned to
 * see a drop in that noise sees one everywhere, and a detector tuned to ignore the noise sees one
 * nowhere. Neither is a reading — both are the generator talking.
 *
 * So a few accounts really are slipping. `DRIFTING` is a deterministic, tiny slice of the book —
 * a handful of houses out of three hundred, which is what a real month looks like — and their
 * quantities fall over their last albaranes in a way that is MONOTONE, so the detector can require
 * monotonicity and stop firing on oscillation. The demo stops needing a caveat, and the reading
 * means what it says.
 *
 * `k` is the albarán's own index and counts BACKWARDS: k=0 is the most recent. So the taper runs
 * the other way — the recent ones are the small ones.
 */
const isDrifting = (ci: number): boolean => ci % 89 === 5;

/** how much of their old rhythm a drifting account is placing, per albarán, most recent first */
const DRIFT = [0.42, 0.55, 0.78, 1, 1];

const indexOfCustomer = (cast: Cast, customer: Customer): number =>
  Math.max(0, cast.customers.findIndex((c) => c.id === customer.id));

/** The products this customer takes — deterministic, and never the whole shelf, because a customer
 *  who buys everything is a customer nobody recognises. */
export function productsOf(cast: Cast, customer: Customer): Product[] {
  const ci = indexOfCustomer(cast, customer);
  const picked = cast.products.filter((_, p) => (ci + p) % 3 !== 2);
  const shelf = picked.length >= 2 ? picked : cast.products;
  /* ROTATE BEFORE TRIMMING. Filtering and then taking the first three left the catalogue's last
     product on nobody's shelf, so its branch of the tree stood in the web saying «0 customers land
     here» — a hole that reads as a fault rather than as a fact. Rotating spreads the trim across
     the shelf, so every product this house sells is somebody's. */
  const turn = ci % shelf.length;
  return [...shelf.slice(turn), ...shelf.slice(0, turn)].slice(0, 3);
}

/* ── THE RHYTHM AN ACCOUNT ORDERS ON (§42.1) ──────────────────────────────────────────────────
 * «THEIR TYPICAL ORDER DAYS» leads the customer sheet, and it was UNREACHABLE BY CONSTRUCTION.
 * Every account's history was minted at a flat three-day step, and three and seven are coprime —
 * so five albaranes landed on five DIFFERENT weekdays for every house in the book, `dayPatternOf`'s
 * «seen twice or more» could not be met by anybody, and the head fact fell through to the cadence
 * on all 296 accounts. «Rhythms» on the data seat counted 0 of 296, and the card that walks its
 * rule through the house's own cases had no case to walk.
 *
 * THE SEED WAS THE FALSEHOOD, NOT THE READING. A trade's book is not one shape. A bar takes its
 * fish on a Friday and has for years. A kitchen with two deliveries takes a Monday and a Thursday.
 * A house that reorders when the chamber runs low lands on a different day every time — which is
 * REAL, and is the whole reason the cadence sentence exists. So the mint gives all three, and
 * `dayPatternOf` finds a weekday where there is one because there IS one. Its law is untouched:
 * a weekday still earns its place by recurring, and the accounts below that meet it meet it.
 *
 * WHICH KIND A HOUSE IS, IS THE HOUSE'S OWN FACT — a pure read of its id through `scatterId`, so
 * it travels with the customer when the book grows or is reordered, and the same account reads the
 * same on every open. About two in three keep a standing weekday, which is what leaves «Rhythms» a
 * coverage worth stating: a tile reading «296 of 296» says nothing about coverage.
 *
 * THE WINDOW IS STILL A MONTH AT ITS WIDEST. A weekly house's last five albaranes ARE five weeks —
 * that is the account, not a stretch of it — so the span runs to four weeks and a phase where it
 * used to run to twelve days. Every account still lands albaranes inside the running month, and
 * the surfaces that read a month (`monthOf`, the sheet's «This month», the profile's volume chart)
 * count what they drew and print the count beside it, so a weekly house saying «3 albaranes» this
 * month is saying the true thing about itself.
 */

/** The three ways a house orders, and the whole of them. */
type Rhythm = 'weekly' | 'twice-weekly' | 'cadence';

/* Four independent reads off one id want four salts; one salt read four times is one fact wearing
   four hats, and the book would line its rhythms up with its phases. */
const RHYTHM_SALT = 617;
const PHASE_SALT = 1213;
const PAIR_SALT = 1811;
const CADENCE_SALT = 2417;

/** WHICH KIND OF ORDERER THIS ACCOUNT IS. Roughly a third on one standing day, a third on two, a
 *  third on none — a book where two houses in three can be relied on and the rest have to be
 *  watched, which is the book a comercial actually holds. */
function rhythmOf(customer: Customer): Rhythm {
  const r = scatterId(customer.id, RHYTHM_SALT);
  if (r < 0.34) return 'weekly';
  if (r < 0.65) return 'twice-weekly';
  return 'cadence';
}

/** the SECOND standing day of a twice-weekly house, counted backwards off the first — so a house
 *  standing on Monday takes its other delivery on the Thursday, Friday or Saturday ahead of it.
 *  Three to five days apart is the spread a kitchen with two runs a week actually keeps: far
 *  enough apart to be two deliveries, inside one week so the week holds. */
const pairGapOf = (customer: Customer): number =>
  2 + Math.floor(scatterId(customer.id, PAIR_SALT) * 3);

/** how often a house with no standing day comes back. Two to five days — and every one of those
 *  steps is coprime with seven, which is WHY these accounts have no weekday rather than a detail
 *  beside it: a house that reorders every fourth day walks around the calendar, so the cadence is
 *  the only true thing to say about it and the cadence is what its sheet says. */
const cadenceStepOf = (customer: Customer): number =>
  2 + Math.floor(scatterId(customer.id, CADENCE_SALT) * 4);

/** HOW MANY DAYS BEFORE THE CAST'S ANCHOR the account's `k`-th albarán landed. `k` counts
 *  BACKWARDS — k=0 is the last one they took — so the offsets rise with it. */
function historyOffset(customer: Customer, k: number): number {
  /* WHERE IN THE WEEK THE ACCOUNT SITS. One to seven days back off the anchor, so a house's
     standing day can be any day of the week and two neighbours in the book are not one house. */
  const first = 1 + Math.floor(scatterId(customer.id, PHASE_SALT) * 7);
  switch (rhythmOf(customer)) {
    /* ONE STANDING DAY, EVERY WEEK — the bar that takes its fish on a Friday. Five albaranes are
       five Fridays, so that weekday is seen five times and the account's head reads «Fri». */
    case 'weekly':
      return first + k * 7;
    /* TWO STANDING DAYS A WEEK. The gaps alternate `g` and `7 - g` walking back, so the pair
       repeats every week: the nearer day is seen three times, the further one twice, and both
       clear `dayPatternOf`'s bar on their own. */
    case 'twice-weekly':
      return first + Math.floor(k / 2) * 7 + (k % 2) * pairGapOf(customer);
    /* NO STANDING DAY. They come back when the chamber runs low, at a step that is not a week, so
       five albaranes land on five weekdays and none of them recurs. */
    default:
      return first + k * cadenceStepOf(customer);
  }
}

/** THE PAST, IN PAIRS. `historyOf` is the customer's fulfilment fingerprint: five albaranes, each
 *  line carrying what was asked beside what was given. */
/** Historical probe records are deterministic for an immutable cast and customer id. Sharing
 * this read projection avoids rebuilding and formatting the same records for every card, search,
 * chart and knowledge reader. A new cast identity owns a new cache; current order edits remain
 * in the separate event projection. */
const historicalRecords = new WeakMap<Cast, Map<string, PastAlbaran[]>>();
export function historyOf(cast: Cast, customer: Customer): PastAlbaran[] {
  let house = historicalRecords.get(cast);
  const cached = house?.get(customer.id);
  if (cached) return cached;

  const ci = indexOfCustomer(cast, customer);
  const anchor = anchorDay(cast);
  const shelf = productsOf(cast, customer);

  const records = Array.from({ length: HISTORY_DEPTH }, (_, k) => {
    const day = daysBefore(anchor, historyOffset(customer, k));
    const [dd, mm] = day.split('.');
    const lines: PairLine[] = shelf
      .filter((_, p) => (ci + k + p) % 4 !== 3)
      .map((product, p) => {
        const base = 2 + ((ci * 5 + k * 3 + p * 4) % 9);
        const pack = product.pack;

        /* THEY ASKED FOR A PACK, AND THE ALBARÁN WENT OUT IN THE CATALOGUE'S OWN UNIT */
        if (pack && pack.unit !== product.unit && (ci + k + p) % 3 === 0) {
          const packs = 1 + ((ci + k) % 2);
          const given = round2(packs * pack.factor + (pack.nominal ? OVER[(k + p) % OVER.length] : 0));
          return {
            product,
            asked: packs,
            askedUnit: pack.unit,
            given,
            unit: product.unit,
            note: `they asked for ${amount(packs)} ${units(packs, pack.unit)} · sent ${amount(given)} ${product.unit} — a ${pack.unit} runs about ${amount(pack.factor)} ${product.unit}`,
          };
        }

        /* THE SCALE DECIDED IT */
        if (product.variableWeight) {
          const given = round2(base + OVER[(ci + k + p) % OVER.length]);
          return {
            product,
            asked: base,
            askedUnit: product.unit,
            given,
            unit: product.unit,
            note: `they asked for ${amount(base)} ${product.unit} · the scale said ${amount(given)}`,
          };
        }

        /* THE SHELF DECIDED IT, or nothing did.
           ⚠ THE SWAP USED TO BE A GRADE — «they asked for class A · sent class B — what you had».
           FEED-IA §197.2 removes class everywhere, and §193.4 says why: the SKU carries what the
           market sells by. A swap between two grades of one SKU is not a fact this app holds any
           more, so the line is what it is and states nothing extra. */
        return {
          product,
          asked: base,
          askedUnit: product.unit,
          given: base,
          unit: product.unit,
        };
      });

    /* THE SLIP IS ON THE GOODS, NOT ON THE MONEY. A house that is drifting away orders LESS, and
       the figure follows from the lines the way it does for everybody else — a figure scaled
       directly would be a number with no albarán behind it, which is the one thing this file's
       whole pairs-and-provenance design exists to refuse. */
    const taper = isDrifting(ci) ? DRIFT[k] ?? 1 : 1;
    if (taper !== 1) {
      for (const l of lines) {
        l.given = round2(l.given * taper);
        l.asked = round2(l.asked * taper);
      }
    }
    const figure = round2(lines.reduce((sum, l) => sum + l.given * priceOf(cast, l.product), 0));
    const complaining = k === 2 && ci % 2 === 1 && lines.length > 0;

    return {
      id: `${customer.id}-${k}`,
      number: `${dd}${mm}-${100 + ci * 7 + k}`,
      day,
      lines,
      figure,
      dispute: complaining
        ? {
            because: `The ${lines[0].product.name} came in under what the delivery note says. Please look at it.`,
            outcome: 'The line was credited the same day.',
          }
        : undefined,
    };
  });
  if (!house) { house = new Map(); historicalRecords.set(cast, house); }
  house.set(customer.id, records);
  return records;
}

/** Their complaints, tied to the albaranes they were raised on. */
export function complaintsOf(cast: Cast, customer: Customer): PastAlbaran[] {
  return historyOf(cast, customer).filter((a) => a.dispute);
}

/* ── THE WORDS THAT ARE NOT THE CATALOGUE'S ───────────────────────────────────────────────────
 * THE AMENDMENT is the cast's OWN second sentence, condensed to the thing that rides the line
 * (§2). Fish: «The merluza for the plancha, so nothing under a kilo if you can.» Meat: «The jamón
 * sliced thin, same as always.» Fruit: «El aguacate bien maduro, we plate it on Saturday.» Each
 * one says what IS rather than what is missing, which is the standing copy law.
 */
const AMENDMENT: Record<SectorId, string> = {
  fish: 'over a kilo a piece',
  meat: 'sliced thin',
  fruit: 'ripe enough to plate the next day',
};

/* THE MENU DISH is the customer's own document. What a restaurant puts on its menu is outside your
 * catalogue by definition — reading it is how you find out what they are ABOUT to ask for, which is
 * the whole value of the card. Two per sector, cycled by customer, so no two profiles read alike. */
const MENU: Record<SectorId, Array<{ dish: string; asks: string }>> = {
  fish: [
    { dish: 'a tuna tartare', asks: 'tuna' },
    { dish: 'a razor-clam starter', asks: 'razor clams' },
  ],
  meat: [
    { dish: 'a steak tartare', asks: 'beef fillet' },
    { dish: 'a pork-belly bao', asks: 'pork belly' },
  ],
  fruit: [
    { dish: 'a fig and burrata salad', asks: 'figs' },
    { dish: 'a passion-fruit sorbet', asks: 'passion fruit' },
  ],
};

/** THE WINDOW A RHYTHM IS COUNTED OVER — a quarter of Fridays, which is long enough to be a
 *  pattern and short enough that a person can picture it. Stated once, because the sentence and the
 *  count have to be true of the same window. */
const RHYTHM_WINDOW = 14;

/** The months a year of history reaches back through. Words, because «since May» is how a person
 *  says it and «since 2026-05» is how a database says it. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June'];

/** Anchor an observation to the node its product grounds onto, so every pattern about a thing is a
 *  pattern about a place on the tree. */
const on = (tree: TreeNode[], product?: string): { node?: string; nodeName?: string } => {
  if (!product) return {};
  const node = nodeOfProduct(tree, product);
  return node ? { node: node.id, nodeName: node.name } : {};
};

/* ── WHAT THIS APP HAS WATCHED HAPPEN ─────────────────────────────────────────────────────────
 * The observations that exist before anybody brings a history in. They come off the day the app
 * already draws — the customers, their shelves, the cast's own order and its amendment — plus the
 * one source that is nobody's ERP: their public listing. One ROUTING is in here too, because the
 * day's own orders already say where a customer's words land.
 */
function hereObservations(cast: Cast, tree: TreeNode[]): Observation[] {
  const out: Observation[] = [];
  const anchor = anchorDay(cast);

  cast.customers.forEach((customer, ci) => {
    const shelf = productsOf(cast, customer);
    const own = cast.order.customer === customer.id;
    /* THE CAST'S OWN CUSTOMER GETS THE CAST'S OWN NUMBERS, so the sentence a reader checks against
       the feed is the same sentence: «Fridays, Can Solé takes about 12 kg of Merluza.» */
    const line = own ? cast.order.lines[0] : undefined;
    const product = line ? cast.products.find((p) => p.id === line.product) ?? shelf[0] : shelf[0];
    const qty = line ? line.qty : 3 + ((ci * 4) % 9);
    /* HOW MANY OF THE WINDOW'S FRIDAYS IT WAS SEEN ON — and it may never exceed the window. It was
       `11 + ci`, which is fine for the five hand-written customers this file was written against
       and reads «185 of the last 14 Fridays» on the 174th row of a real book: a sentence the reader
       can see is impossible, on the one card whose whole job is to be checkable. */
    const seen = RHYTHM_WINDOW - 6 + (ci % 7);

    out.push({
      id: `rhythm-${customer.id}`,
      kind: 'rhythm',
      sector: cast.sector,
      customer: customer.id,
      product: product.id,
      ...on(tree, product.id),
      sentence: `Fridays, ${customer.name} takes about ${amount(qty)} ${product.unit} of ${product.name}.`,
      evidence: [
        { fact: `${seen} of the last ${RHYTHM_WINDOW} Fridays`, where: `Customer delivery notes since ${MONTHS[ci % MONTHS.length]}` },
        { fact: `between ${amount(qty - 2)} and ${amount(qty + 3)} ${product.unit} each time` },
      ],
      source: 'here',
      seen,
    });

    /* THEIR MENU, READ OFF THEIR OWN LISTING (§5). Somebody else's document, so it carries their
       mark and the day it was read. */
    const menu = MENU[cast.sector][ci % MENU[cast.sector].length];
    const found = daysBefore(anchor, 2 + ci);
    out.push({
      id: `menu-${customer.id}`,
      kind: 'menu',
      sector: cast.sector,
      customer: customer.id,
      /* ── IT STATES WHAT IT READ, AND STOPS THERE (AUDIT-2 C31 · §5) ──────────────────────
         It used to end «— they may start asking for {asks}», which is Rocoto guessing out loud in
         its own voice about a customer's future orders. This file's whole contract is that every
         sentence is something READ, carrying its evidence and its source; a forecast has no
         evidence row to stand on, and the reader cannot tell which half of the sentence was found
         and which half was imagined. What the dish implies is left in the evidence, where it is
         labelled as an inference and a person can weigh it. */
      sentence: `Their menu added ${menu.dish} on ${found}.`,
      evidence: [
        { fact: `Their listing was edited on ${found}`, where: 'Google Maps' },
        { fact: `${menu.asks} would be a new line for them` },
      ],
      source: 'google',
      attribution: { mark: 'google', place: customer.name, found },
      seen: 1,
    });
  });

  /* THE AMENDMENT THAT RIDES EVERY ORDER (§2) — on the customer whose own words the cast holds. */
  const owner = cast.customers.find((c) => c.id === cast.order.customer);
  const amended = cast.products.find((p) => p.id === cast.order.lines[0].product);
  if (owner && amended) {
    out.push({
      id: `amendment-${owner.id}`,
      kind: 'amendment',
      sector: cast.sector,
      customer: owner.id,
      product: amended.id,
      ...on(tree, amended.id),
      sentence: `${owner.name} takes their ${amended.name} ${AMENDMENT[cast.sector]}, and says so on every order.`,
      evidence: [
        { fact: `Their own words: “${cast.order.words[cast.order.words.length - 1]}”`, where: owner.channel },
        { fact: 'It has ridden the line on every delivery note since' },
      ],
      source: 'here',
      seen: 9,
    });

    /* ONE ROUTING, FROM THE DAY ITSELF (§10.3). Their words already landed somewhere this morning,
       and where they landed is a fact this app watched happen. */
    const route = routeOf(cast, tree, owner);
    out.push({
      id: `routing-${owner.id}`,
      kind: 'routing',
      sector: cast.sector,
      customer: owner.id,
      node: route.id,
      nodeName: route.name,
      product: route.products[0],
      sentence: route.facet
        ? `${owner.name} says «${route.category}» and means «${route.phrase}» — that is where their words land.`
        : `${owner.name} says «${route.category}» and takes whichever sort you have that day.`,
      evidence: [
        { fact: 'Today’s order landed there', where: owner.channel },
        {
          fact: route.facet
            ? `Every line of theirs on this branch has gone out ${route.facet}`
            : 'Every sort on this branch has gone to them at some point',
        },
      ],
      source: 'here',
      seen: 6,
    });
  }

  return out;
}

/* ── WHAT THE YEAR OF HISTORY TAUGHT ──────────────────────────────────────────────────────────
 * The fulfilment brain's own material (§0), and now the router's two hops (§10.4): where each
 * customer's words land, and what this house fulfils that node with at this time of year. Every
 * sentence here is one the real system must be able to produce — that is what «the UI defines the
 * contract» means (§9).
 */
function importObservations(cast: Cast, tree: TreeNode[]): Observation[] {
  const out: Observation[] = [];

  /* ── THE HOUSE PRIORS: node × season → the sort (§10.3) ───────────────────────────────────
   * «The typical tomato of the pink category they sell is THIS in May, and the other one in
   * October.» The sort is read off the catalogue's own trace — the variety, the boat, the plant —
   * so the sentence names a thing a person can go and find on a crate. */
  tree
    .filter((n) => n.level === 'type')
    .forEach((node, i) => {
      const product = cast.products.find((p) => p.id === node.products[0]);
      if (!product) return;
      const season = SEASON[i % SEASON.length];
      const seen = 26 + i * 9;
      out.push({
        id: `prior-${node.id}`,
        kind: 'prior',
        sector: cast.sector,
        node: node.id,
        nodeName: node.name,
        product: product.id,
        sentence: `In ${season}, «${node.phrase}» → ${product.name} · ${sortOf(cast, product)}.`,
        evidence: [
          { fact: `${seen} ${season} lines matched this product`, where: 'Imported delivery notes' },
          { fact: `Earlier delivery notes use another ${node.facetWord ?? 'sort'}` },
        ],
        source: 'import',
        seen,
      });
    });

  cast.customers.forEach((customer, ci) => {
    const shelf = productsOf(cast, customer);

    /* ── THE CUSTOMER ROUTING: customer × node → their resolution (§10.3) ─────────────────── */
    const route = routeOf(cast, tree, customer);
    /* WHERE A CUSTOMER'S RESOLUTION SITS IS ITS OWN FACT, and it is deliberately NOT correlated
       with which branch they land on: tying the two made every customer on one branch read the
       same sentence, which is how a set of patterns turns into wallpaper. */
    const collapsed = ci % 3 === 1 || !route.facet;
    const seenRoute = 18 + ci * 3;
    out.push({
      id: `routing-import-${customer.id}`,
      kind: 'routing',
      sector: cast.sector,
      customer: customer.id,
      node: route.id,
      nodeName: route.name,
      product: route.products[0],
      sentence: collapsed
        ? `${customer.name}: «${route.category}» → available ${route.facetWord ?? 'sort'}.`
        : `${customer.name}: «${route.phrase}» → ${route.facet}.`,
      evidence: [
        { fact: `${seenRoute} orders matched this category`, where: 'Imported delivery notes' },
        {
          fact: collapsed
            ? `${seenRoute} delivery notes recorded the available ${route.facetWord ?? 'sort'}`
            : `${seenRoute} delivery notes recorded ${route.facet}`,
        },
      ],
      source: 'import',
      seen: seenRoute,
    });

    /* THE PACK, RESOLVED. «When they ask for a caja, you send 10 kg.» */
    const packed = shelf.find((p) => p.pack && p.pack.unit !== p.unit);
    if (packed && packed.pack) {
      const seen = 9 + ci;
      out.push({
        id: `fulfil-${customer.id}`,
        kind: 'fulfilment',
        sector: cast.sector,
        customer: customer.id,
        product: packed.id,
        ...on(tree, packed.id),
        sentence: `When ${customer.name} asks for ${packed.pack.unit} ${packed.name}: ${amount(packed.pack.factor)} ${packed.unit}.`,
        evidence: [
          { fact: `${seen} recorded requests since ${MONTHS[(ci + 2) % MONTHS.length]}`, where: 'Customer delivery notes' },
          { fact: `the ${packed.pack.unit} has run between ${amount(packed.pack.factor - 0.5)} and ${amount(packed.pack.factor + 1)} ${packed.unit}` },
        ],
        source: 'import',
        seen,
      });

      /* THE UNIT THEY SPEAK IN, against the unit the document goes out in (§3). */
      out.push({
        id: `unit-${customer.id}`,
        kind: 'unit',
        sector: cast.sector,
        customer: customer.id,
        product: packed.id,
        ...on(tree, packed.id),
        sentence: `${customer.name}: ${packed.pack.unit} requested → ${packed.unit} on the delivery note.`,
        evidence: [
          { fact: `${14 + ci} imported orders use this conversion`, where: 'Customer delivery notes' },
          { fact: `Recorded conversion: 1 ${packed.pack.unit} = ${amount(packed.pack.factor)} ${packed.unit}` },
        ],
        source: 'import',
        seen: 14 + ci,
      });
    }

    /* THE SKU THEY TAKE WHEN THE ONE THEY ASKED FOR IS GONE.
       ⚠ THIS WAS A CLASS FACT — «class B when class A is unavailable» — until FEED-IA §197.2
       «Remove class everywhere». §193.4 says where the knowledge belongs: the SKU carries what
       the market sells by, so a substitution the house has watched is one SKU standing in for
       another, which is a fact both the customer and the floor can name. */
    const wanted = shelf[(ci + 1) % shelf.length];
    const instead = shelf[(ci + 2) % shelf.length];
    if (instead && wanted && instead.id !== wanted.id) {
      const seen = 4 + (ci % 3);
      out.push({
        id: `substitute-${customer.id}`,
        kind: 'substitute',
        sector: cast.sector,
        customer: customer.id,
        product: wanted.id,
        ...on(tree, wanted.id),
        sentence: `${customer.name}: ${instead.name} when ${wanted.name} is unavailable.`,
        evidence: [
          { fact: `${seen} delivery notes recorded ${instead.name} in its place`, where: 'Customer delivery notes' },
        ],
        source: 'import',
        seen,
      });
    }

    /* WHAT THEY HAVE QUERIED, tied to the albarán it was raised on. */
    complaintsOf(cast, customer).forEach((a) => {
      const product = a.lines[0]?.product;
      out.push({
        id: `dispute-${a.id}`,
        kind: 'dispute',
        sector: cast.sector,
        customer: customer.id,
        product: product?.id,
        ...on(tree, product?.id),
        sentence: `${customer.name} has queried one weight — on delivery note ${a.number}. It settled the same day.`,
        evidence: [
          { fact: a.dispute?.because ?? '', where: `delivery note ${a.number}` },
          { fact: a.dispute?.outcome ?? '' },
        ],
        source: 'import',
        seen: 1,
      });
    });
  });

  /* THE GOODS THEMSELVES (§4.4): learned facts ride the product — its real conversions, its
     rhythm, the form it actually ships in. */
  cast.products.forEach((product, pi) => {
    const takers = cast.customers.filter((c) => productsOf(cast, c).some((p) => p.id === product.id));
    const seen = 40 + pi * 17;

    out.push({
      id: `product-shape-${product.id}`,
      kind: 'product',
      sector: cast.sector,
      product: product.id,
      ...on(tree, product.id),
      sentence: product.variableWeight
        ? `${product.name} goes out about ${amount(OVER[pi % OVER.length] + 0.35)} ${product.unit} over what was asked.`
        : `${product.name} goes out by the ${product.pack?.unit ?? product.unit}, ${amount(product.pack?.factor ?? 1)} ${product.unit} at a time.`,
      evidence: [
        { fact: `the scale, across ${seen} lines`, where: 'Imported delivery notes' },
        { fact: `${seen} delivery-note lines include a scale value` },
      ],
      source: 'import',
      seen,
    });

    out.push({
      id: `product-rhythm-${product.id}`,
      kind: 'product',
      sector: cast.sector,
      product: product.id,
      ...on(tree, product.id),
      sentence: `${product.name} moves hardest on Thursdays and Fridays, to ${takers.length} of your customers.`,
      evidence: [
        { fact: `${Math.round(seen * 0.6)} of last month’s ${seen} lines fell on those two days` },
        { fact: `${takers.map((c) => c.name).join(', ')} take it` },
      ],
      source: 'import',
      seen: Math.round(seen * 0.6),
    });
  });

  /* ── AND HOW THE HOUSE ITSELF WRITES (§5.2) ───────────────────────────────────────────────
     The year of messages teaches two different things: what the customers ask for, and how this
     house answers. Both arrive with the same import, so both are folded here — and the second one
     is what Tu agente offers as the fourth register. */
  out.push(...styleObservations(cast));

  return out;
}

/* ── THE COMPANY DNA (THE-CHECKPOINT §5.2) ────────────────────────────────────────────────────
 * What the year of messages says about the way this house writes. Five sentences, each one read
 * off the house's OWN book — the channels its accounts are on, the size of that book, the people
 * who answer — so a fish house and a meat house get different DNA and neither gets a paragraph
 * somebody typed.
 *
 * ═══ WHY IT IS AN OBSERVATION AND NOT A SETTING ════════════════════════════════════════════
 * Because it is READ. Every sentence here carries its evidence and its source exactly like every
 * other observation in this file, which is what makes it CHECKABLE: a house that disagrees with a
 * line can see what it was read off before dropping it. A settings field could not do that — it
 * would be the software asserting a style with nothing under it.
 *
 * ═══ THE INFERENCE IS ONE READING AND IT IS NAMED ══════════════════════════════════════════
 * `insights.ts` names which register these come to. This file states the FACTS; naming what they
 * add up to is the analysis layer's job, and it carries its method like every other reading there.
 */

/** THE CHANNELS A HOUSE IS ON FIRST-NAME TERMS DOWN. A book that reaches its customers on
 *  WhatsApp and the phone writes differently from one that reaches them through a portal, and
 *  that is a fact the app already holds on every account. */
const FAMILIAR_CHANNELS = new Set<Customer['channel']>(['WhatsApp', 'phone', 'in person']);

/** How many of this house's accounts are on a familiar rail, and how many there are. */
export const familiarReach = (cast: Cast): { familiar: number; total: number } => ({
  familiar: cast.customers.filter((c) => FAMILIAR_CHANNELS.has(c.channel)).length,
  total: cast.customers.length,
});

export function styleObservations(cast: Cast): Observation[] {
  const dump = dumpOf(cast);
  const { familiar, total } = familiarReach(cast);
  /* THE HOUSE'S OWN VOLUMES, so every count below is this book's rather than a number typed into
     a sentence. A reply per albarán is the floor a year of messages stands on. */
  const replies = dump.albaranes;
  const mornings = Math.round(replies * 0.62);
  /* THE PEOPLE WHO ANSWER, EACH OF THEM ONCE. The owner is in the team as well as at the head of
     it, so the naive concatenation printed «Roser and Roser» — a sentence that reads as a bug
     about the house rather than as a fact about it. Seen on the shot, fixed at the fold. */
  const answers = [cast.owner, ...cast.team]
    .filter((p) => p.name)
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);

  return [
    {
      id: 'style-address',
      kind: 'style',
      sector: cast.sector,
      sentence: familiar * 2 >= total
        ? 'Your messages address a customer as tú.'
        : 'Your messages address a customer as usted.',
      evidence: [
        {
          fact: `${familiar} of your ${total} accounts reach you on WhatsApp, the phone or at the counter`,
          where: 'your own accounts',
        },
        { fact: `the same form across ${count(dump.months)} months of messages`, where: 'the year you brought in' },
      ],
      source: 'import',
      seen: replies,
    },
    {
      id: 'style-open',
      kind: 'style',
      sector: cast.sector,
      sentence: 'You open with a good morning and go straight to the order.',
      evidence: [
        { fact: `${count(mornings)} of ${count(replies)} replies start that way`, where: 'the year you brought in' },
        { fact: 'the order is in the first line of nearly all of them' },
      ],
      source: 'import',
      seen: mornings,
    },
    {
      id: 'style-length',
      kind: 'style',
      sector: cast.sector,
      sentence: 'Your answers run to one line.',
      evidence: [
        { fact: `${count(Math.round(replies * 0.81))} of them are a single line`, where: 'the year you brought in' },
        { fact: 'the longest of them is two' },
      ],
      source: 'import',
      seen: Math.round(replies * 0.81),
    },
    {
      id: 'style-figure',
      kind: 'style',
      sector: cast.sector,
      sentence: 'You confirm with the figure and the day on it.',
      evidence: [
        {
          fact: `${count(Math.round(replies * 0.74))} confirmations carried the total`,
          where: 'the year you brought in',
        },
        { fact: 'and the day the goods are for' },
      ],
      source: 'import',
      seen: Math.round(replies * 0.74),
    },
    {
      id: 'style-signoff',
      kind: 'style',
      sector: cast.sector,
      sentence: `Your people answer in their own name — ${answers.slice(0, 2).map((p) => p.name.split(/\s+/)[0]).join(' and ')}.`,
      evidence: [
        { fact: `${answers.length} people answer from the same number`, where: 'your own numbers' },
        { fact: `${count(dump.customers)} accounts have written to it` },
      ],
      source: 'import',
      seen: answers.length,
    },
  ];
}

/** The DNA lines this house has kept — the fold every surface reads (§5.2: editable, never
 *  forced). Dropping a line is the house's own answer, so the fold takes the dropped ids rather
 *  than reaching into the grants store: it stays a pure read. */
export const houseStyle = (knows: Knows, dropped: string[] = []): Observation[] =>
  knows.observations.filter((o) => o.kind === 'style' && !dropped.includes(o.id));

/** How many patterns a history WOULD teach this house — read at the moment of the import, so the
 *  number in the readback is the number of things a person can then go and open. */
export const learnableCount = (cast: Cast): number =>
  importObservations(cast, treeOf(cast)).length;

/* ── THE EDGES, BUILT ─────────────────────────────────────────────────────────────────────── */

function linksOf(tree: TreeNode[], observations: Observation[]): KnowLink[] {
  const links: KnowLink[] = [];

  /* THE PRIORS. A node resolves to a product because the catalogue is ON the tree — that edge
     exists before anybody learns anything. Where a house prior has been learned, its own count is
     the edge's weight. */
  tree.forEach((node) => {
    node.products.forEach((product) => {
      const prior = observations.find((o) => o.kind === 'prior' && o.node === node.id && o.product === product);
      links.push({
        id: `prior·${node.id}·${product}`,
        kind: 'prior',
        from: node.id,
        to: product,
        seen: prior?.seen ?? 4,
      });
    });
  });

  /* THE ROUTES. A customer's words land on a node because their own patterns say so.
     THE WEIGHT IS THE ROUTING'S OWN COUNT, NEVER A SUM. Adding every pattern that touches the pair
     produced «seen 52 times» for a hop nothing had watched 52 times — a number a reader could go
     and disprove against the evidence sitting two lines under it. Where a routing has been learned
     its count speaks; otherwise the strongest pattern on the pair does. */
  const pairs = new Map<string, Observation[]>();
  observations.forEach((o) => {
    if (!o.customer || !o.node) return;
    const id = `route·${o.customer}·${o.node}`;
    pairs.set(id, [...(pairs.get(id) ?? []), o]);
  });

  pairs.forEach((held, id) => {
    const routing = held.find((o) => o.kind === 'routing');
    const strongest = held.reduce((best, o) => (o.seen > best.seen ? o : best), held[0]);
    const speaks = routing ?? strongest;
    links.push({
      id,
      kind: 'route',
      from: speaks.customer as string,
      to: speaks.node as string,
      seen: speaks.seen,
    });
  });

  return links;
}

/** Cast + the tree + the import, folded into everything that is known. */
export function buildKnows(cast: Cast, imported?: ImportEvent): Knows {
  const tree = treeOf(cast);
  const observations = [
    ...hereObservations(cast, tree),
    ...(imported ? importObservations(cast, tree) : []),
  ];
  return {
    sector: cast.sector,
    tree,
    observations,
    links: linksOf(tree, observations),
    learned: imported ? imported.learned : 0,
    imported,
  };
}

/** Everything known about one customer, the strongest pattern first. */
export const aboutCustomer = (knows: Knows, id: string): Observation[] =>
  knows.observations.filter((o) => o.customer === id).sort((a, b) => b.seen - a.seen);

/** Everything known about one product. */
export const aboutProduct = (knows: Knows, id: string): Observation[] =>
  knows.observations.filter((o) => o.product === id).sort((a, b) => b.seen - a.seen);

/** Everything hanging on one node of the tree — the routings into it and the priors out of it. */
export const aboutNode = (knows: Knows, id: string): Observation[] =>
  knows.observations.filter((o) => o.node === id).sort((a, b) => b.seen - a.seen);

/** The menu card, which is the one observation a surface asks for by name (§5). */
export const menuChangeOf = (knows: Knows, id: string): Observation | undefined =>
  knows.observations.find((o) => o.kind === 'menu' && o.customer === id);

/** THE READBACK, IN SENTENCES (§4.1, §10.2). One headline that states what was read and what it
 *  taught, and under it the grounding — because placing the names on the tree is the first thing
 *  that happened and everything else is built on it. Never a bar chart of an import. */
export function readback(e: ImportEvent): { headline: string; lines: string[] } {
  return {
    headline: `${count(e.albaranes)} delivery notes · ${count(e.customers)} customers · ${count(e.learned)} patterns`,
    lines: [
      `${count(e.grounded)} products matched to catalogue.`,
      `${e.months} months imported from file.`,
    ],
  };
}

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────────
 * One module-level array of import events, persisted, published through `useSyncExternalStore` —
 * the same shape `rules.ts` keeps, and for the same reason: `main.tsx` and `App.tsx` belong to
 * V2-CORE, so a surface needing a provider above it could not be written without editing them.
 */

export const IMPORTS_STORAGE_KEY = 'rocoto-app-imports';

const isImport = (e: unknown): e is ImportEvent => {
  if (!e || typeof e !== 'object') return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.at === 'string' &&
    typeof x.file === 'string' &&
    Number.isFinite(x.albaranes) &&
    Number.isFinite(x.customers) &&
    Number.isFinite(x.grounded) &&
    Number.isFinite(x.learned) &&
    (x.sector === 'fish' || x.sector === 'meat' || x.sector === 'fruit')
  );
};

function read(): ImportEvent[] {
  try {
    const raw = window.localStorage.getItem(IMPORTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isImport) : [];
  } catch {
    return [];
  }
}

function write(next: ImportEvent[]): void {
  try {
    window.localStorage.setItem(IMPORTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* a prototype in a private window still has to run */
  }
}

let IMPORTS: ImportEvent[] = typeof window === 'undefined' ? [] : read();

const listeners = new Set<() => void>();

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const snapshot = (): ImportEvent[] => IMPORTS;

const publish = (next: ImportEvent[]): void => {
  IMPORTS = next;
  write(next);
  for (const fn of listeners) fn();
};

let seq = 0;

/** THE PERSON'S ACT, RECORDED. Choosing a file is the whole gesture; everything the readback says
 *  afterwards is a reading of this one event. */
export function importHistory(a: { cast: Cast; file: string; at?: Date }): ImportEvent {
  const dump = dumpOf(a.cast);
  const event: ImportEvent = {
    id: `import-${Date.now().toString(36)}-${++seq}`,
    sector: a.cast.sector,
    at: (a.at ?? new Date()).toISOString(),
    file: a.file,
    albaranes: dump.albaranes,
    customers: dump.customers,
    months: dump.months,
    grounded: dump.grounded,
    learned: learnableCount(a.cast),
  };
  publish([...IMPORTS, event]);
  return event;
}

/** Take a house's history back out — the undo for a person who imported the wrong file. */
export function forgetImports(sector: SectorId): void {
  publish(IMPORTS.filter((e) => e.sector !== sector));
}

export const useImports = (): ImportEvent[] =>
  React.useSyncExternalStore(subscribe, snapshot, snapshot);

/** The history this house has brought in, where it has brought one in. */
export function useImport(sector: SectorId): ImportEvent | undefined {
  const all = useImports();
  return React.useMemo(() => [...all].reverse().find((e) => e.sector === sector), [all, sector]);
}

/** The one hook every surface reads. A screen never assembles what is known. */
export function useKnows(cast: Cast): Knows {
  const imported = useImport(cast.sector);
  return React.useMemo(() => buildKnows(cast, imported), [cast, imported]);
}

/* ═══ WHO BUYS IT (THE-DENSE-BRIEF-DESIGN §2, the product card) ═══════════════════════════════
 * «Every product gets a CARD like the albarán's: who ordered last, biggest orderer, price
 * fluctuations» (musing 11). Two one-fact rows, both counted off the house's own record rather
 * than claimed — the fingerprint machinery above, read down the product's column instead of the
 * customer's row.
 */

export type LastOrder = {
  customer: Customer;
  /** the day it went out, in the trade's own words */
  day: string;
  qty: number;
  unit: string;
};

export type BiggestOrderer = {
  customer: Customer;
  /** what they have taken of it across the window */
  qty: number;
  unit: string;
  /** what that came to */
  figure: number;
  /** how many albaranes carried it */
  albaranes: number;
};

export type Buyers = {
  last?: LastOrder;
  biggest?: BiggestOrderer;
  /** how many of this house's customers take it at all */
  customers: number;
};

/** THE WINDOW EVERY COUNT ON THE CARD IS TRUE OF — the five albaranes a fingerprint draws, per
 *  customer. Stating the window is what keeps «biggest orderer» a fact rather than a boast. */
export const BUYERS_WINDOW = HISTORY_DEPTH;

export function buyersOf(cast: Cast, product: Product): Buyers {
  let last: LastOrder | undefined;
  let lastKey = -1;
  const totals = new Map<string, { customer: Customer; qty: number; figure: number; albaranes: number; unit: string }>();

  for (const customer of cast.customers) {
    for (const albaran of historyOf(cast, customer)) {
      const lines = albaran.lines.filter((l) => l.product.id === product.id);
      if (lines.length === 0) continue;
      const qty = lines.reduce((sum, l) => sum + l.given, 0);
      const unit = lines[0].unit;

      const key = dayKey(albaran.day);
      if (key > lastKey) {
        lastKey = key;
        last = { customer, day: albaran.day, qty: round2(qty), unit };
      }

      const at = totals.get(customer.id) ?? { customer, qty: 0, figure: 0, albaranes: 0, unit };
      at.qty += qty;
      at.figure += qty * priceOf(cast, product);
      at.albaranes += 1;
      totals.set(customer.id, at);
    }
  }

  const ranked = [...totals.values()].sort((a, b) => b.qty - a.qty);
  const top = ranked[0];

  return {
    last,
    biggest: top
      ? {
          customer: top.customer,
          qty: round2(top.qty),
          unit: top.unit,
          figure: round2(top.figure),
          albaranes: top.albaranes,
        }
      : undefined,
    customers: ranked.length,
  };
}

/* ═══ THE PRICE IN TIME — THE SEEDED TRAIL UNDER THE WRITTEN LOG ══════════════════════════════
 * THE SEAM: `tiers.ts` owns `priceHistoryOf(product)`, the append-only record of every price a
 * HAND has written here. An untouched house has written none — and a card that answered «how has
 * this moved» with an empty box would be saying nothing where the trade has an answer. So this is
 * the house's own trail behind that log: the days the sheet stood at, derived from the list price
 * the catalogue already carries, deterministic so a card reads the same on every open.
 *
 * IT IS THE PROTOTYPE'S HISTORY AND IT SAYS SO — `author: 'house'`, which the card prints as the
 * house's own sheet and never as somebody's act. Written stamps sit ON TOP of it: where a hand set
 * a price for a day, that day is the hand's. The day tiers.ts backfills real history, this
 * function loses its callers and goes.
 */

export type PriceMove = {
  /** the day it stood for, in the trade's own words */
  day: string;
  price: number;
  /** whose price it is — a hand's, a rule's, Rocoto's, or the house's standing sheet */
  author: 'hand' | 'rule' | 'rocoto' | 'house';
};

/** How many days back the trail draws. A fortnight of a real sheet, read in one pass. */
export const TRAIL_DAYS = 8;

/** The days this product's price stood at, oldest first. */
export function priceTrailOf(cast: Cast, product: Product): PriceMove[] {
  const anchor = anchorDay(cast);
  const list = priceOf(cast, product);
  /* the market moves the sheet by a few cents at a time, and it moves it the same way every time
     this card is opened — a deterministic wobble off the product's own place in the catalogue */
  const seed = cast.products.findIndex((p) => p.id === product.id) + 1;
  const step = (k: number): number => Math.sin(seed * 1.7 + k * 0.9) * 0.06 + Math.sin(k * 2.3) * 0.03;

  return Array.from({ length: TRAIL_DAYS }, (_, k) => {
    const back = TRAIL_DAYS - 1 - k;
    return {
      day: daysBefore(anchor, back * 2),
      price: round2(list * (1 + step(back))),
      author: 'house' as const,
    };
  });
}

/* ═══ THE PREP NOTE'S STORE IS GONE, AS ITS OWN COMMENT PROMISED ══════════════════════════════
 * It stood here as a stub while `sale.ts` belonged to another package, and it said exactly what
 * would happen to it: «when sale.ts grows the field, `prepOf` becomes `line.prepNote`, `setPrep`
 * becomes the event, and this whole block is deleted. Nothing else moves.» That is what happened
 * (FEED-IA §33.2). The note is `SaleLine.prepNote`, written by the `prep-note` event through the
 * same append-only ledger every other line edit uses, so the document, the paper and the trace all
 * read one history instead of a history and a side-store.
 *
 * WHAT STAYS HERE IS THE MEMORY HALF, which was always knows.ts's own business: what this customer
 * always wants done to this thing.
 */

/** WHAT THIS CUSTOMER ALWAYS WANTS DONE TO THIS THING (§6, «customer memory first»). Seeded from
 *  the house's own record so the suggestion list is loaded from the first frame: a customer who has
 *  taken this product more than twice has a habit, and the habit is the L3 word their shelf sits on.
 *  It ranks ABOVE the house's vocabulary, because a remembered habit beats a menu. */
export function rememberedPreps(cast: Cast, customer: Customer | undefined, product: Product): string[] {
  if (!customer) return [];
  const words = prepWordsFor(cast.sector, ground(product.name, product.family));
  if (words.length === 0) return [];
  const taken = historyOf(cast, customer)
    .flatMap((a) => a.lines)
    .filter((l) => l.product.id === product.id).length;
  if (taken < 2) return [];
  const ci = Math.max(0, cast.customers.findIndex((c) => c.id === customer.id));
  const pi = Math.max(0, cast.products.findIndex((p) => p.id === product.id));
  return [words[(ci + pi) % words.length]];
}

/* ═══ THE BOOK'S OWN NUMBERS (FEED-IA §37.6) ══════════════════════════════════════════════════
 * «CUSTOMERS get the same: their own surface, master-detail, the customer's main sheet as the
 * preview — standard card structure.»
 *
 * A sheet about a customer owes three money facts and they are all COUNTED off the record rather
 * than claimed: what this month has come to, what one of their albaranes usually comes to, and
 * which goods carry the account. All three read the SAME fingerprint the profile already draws
 * (`historyOf`), so the row on the list, the sentence on the sheet and the pairs in the record can
 * never disagree about one customer — there is one history and these are readings of it.
 *
 * WHAT IS NOT HERE IS ANYTHING ABOUT MONEY OWED. «We don't track payments» (§34.1): these are
 * sales figures — what went out and what it came to — and nothing on this surface says collected,
 * outstanding or due.
 */

/** What a customer has taken in one calendar month. `month` is the trade's own `mm`. */
export type MonthSpend = { month: string; figure: number; albaranes: number };

/** One good, folded across the window: how much of it they take, and what that comes to. */
export type BasketLine = {
  product: Product;
  qty: number;
  unit: string;
  figure: number;
  /** how many of the albaranes in the window carried it */
  albaranes: number;
};

/** THE USUAL BASKET: how many albaranes the window holds, what one of them usually comes to, and
 *  the goods that make it up — biggest first. */
export type Basket = { albaranes: number; typical: number; lines: BasketLine[] };

/**
 * «21.08» → «08». The trade writes `dd.mm` and the month is the half that groups.
 *
 * ⚠ AND IT TAKES BOTH OF THE APP'S DAY FORMS, because the app has two and this function is the one
 * place they meet. World B writes `dd.mm` (the trade's own); World A writes `2026-08-22` (`dayIdOf`
 * — sortable, and what every `Sale.day` carries). Splitting only on «.» returned '' for every
 * World A day, and three readings quietly stood on that:
 *
 *   · the customers book's «This month» figure took `monthKeyOf(todayId(cast))` = '' as its window,
 *     so NO history matched it and the number was live-only on a row whose sub-line says «so far».
 *   · «Tus mejores clientes» made the same call, so the ranking its method line promises blends
 *     «your history and this week's albaranes» blended one of them.
 *   · `seasons()` folded every sale onto the single key '' — one bucket, so the region waited. It
 *     was RIGHT to wait (one month is not a season) but it was waiting by accident, and an accident
 *     that agrees with you is still not a reason.
 *
 * One function, both forms, and the three readings say what they claim.
 */
export const monthKeyOf = (day: string): string =>
  (day.includes('-') ? day.split('-')[1] : day.split('.')[1]) ?? '';

/** the month a `mm` key stands for, at the width an axis has room for */
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** «08» → «Aug». An axis of twelve bars labelled 01…12 is a chart of numbers about numbers. */
export const monthLabelOf = (key: string): string => MONTH_SHORT[(Number(key) || 1) - 1] ?? key;

/**
 * THIS MONTH, ON THEIR ACCOUNT (§37.6, «a quiet money fact»).
 *
 * The history is the spine; `live` is what is on the feed right now and has no albarán behind it
 * yet. Both are the same kind of fact — goods that went to this customer this month — so the
 * figure adds them rather than choosing, and the count says how many documents it is a sum of.
 * The caller passes the live rows because the day's ledger belongs to `sale.ts`; this file knows
 * the record and nothing about a morning.
 */
export function monthOf(
  cast: Cast,
  customer: Customer,
  month: string,
  live: Array<{ day: string; figure: number }> = [],
): MonthSpend {
  let figure = 0;
  let albaranes = 0;
  for (const a of historyOf(cast, customer)) {
    if (monthKeyOf(a.day) !== month) continue;
    figure += a.figure;
    albaranes += 1;
  }
  for (const s of live) {
    if (monthKeyOf(s.day) !== month) continue;
    figure += s.figure;
    albaranes += 1;
  }
  return { month, figure: round2(figure), albaranes };
}

/**
 * WHAT THEY USUALLY TAKE, counted (§37.6, «the numbers»).
 *
 * A basket is the account's own shape: the same window the fingerprint reads, folded down the
 * PRODUCT column instead of across the albarán. `figure` is money and therefore what the lines
 * sort by — a customer whose account is merluza is a merluza customer even in a week they took
 * more kilos of something cheap — and `albaranes` is what keeps a one-off out of the top of the
 * list without any threshold having to be invented.
 */
export function basketOf(cast: Cast, customer: Customer): Basket {
  const past = historyOf(cast, customer);
  const folded = new Map<string, BasketLine>();

  for (const albaran of past) {
    /* one albarán counts ONCE towards a product's `albaranes`, however many lines carried it */
    const seen = new Set<string>();
    for (const line of albaran.lines) {
      const at = folded.get(line.product.id) ?? {
        product: line.product,
        qty: 0,
        unit: line.unit,
        figure: 0,
        albaranes: 0,
      };
      at.qty += line.given;
      at.figure += line.given * priceOf(cast, line.product);
      if (!seen.has(line.product.id)) {
        at.albaranes += 1;
        seen.add(line.product.id);
      }
      folded.set(line.product.id, at);
    }
  }

  const total = past.reduce((sum, a) => sum + a.figure, 0);
  return {
    albaranes: past.length,
    typical: past.length > 0 ? round2(total / past.length) : 0,
    lines: [...folded.values()]
      .map((l) => ({ ...l, qty: round2(l.qty), figure: round2(l.figure) }))
      .sort((a, b) => b.figure - a.figure),
  };
}

/* ═══ THE HEAD FACTS, AND THE MENU AS AN OBJECT (FEED-IA §42) ═════════════════════════════════
 * «Think objects and sub-objects; make the actually-important thing the important thing.»
 *
 * §42 puts three facts at the head of a customer's sheet that no selector answered before — their
 * typical order DAYS, their typical ORDER, and whether they run their own system — and it makes
 * THEIR MENU a top-level object of which a menu change is an EVENT. All four are answered here,
 * off the same record every other number on that sheet is counted from.
 */

/** Monday first, because a trade week does. */
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SHORT_DAY: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

/** A history day is «dd.mm» — the trade's own writing — while the ledger's are ISO. `dayFromId`
 * on «dd.mm» yields an Invalid Date, which silently emptied every pattern read off history (the
 * §115.4 pass caught it: cadence said «no rhythm yet» for exactly the accounts with the most
 * rhythm). The year comes from the cast's own calendar, never the machine's clock. */
const dateOfHistoryDay = (day: string, cast: Cast): Date => {
  if (day.includes('-')) return dayFromId(day);
  const [dd, mm] = day.split('.').map(Number);
  return new Date(dayFromId(todayId(cast)).getFullYear(), (mm || 1) - 1, dd || 1);
};
const weekdayOf = (day: string, cast: Cast): string =>
  WEEK[(dateOfHistoryDay(day, cast).getDay() + 6) % 7];

export type DayPattern = {
  /** the weekdays their albaranes actually land on, in week order — «Mon · Wed · Fri» */
  days: string[];
  /** how often one arrives at all, when nothing recurs — «about every 3 days» */
  cadence: string;
};

/**
 * THEIR TYPICAL ORDER DAYS (§42.1), counted rather than claimed.
 *
 * A weekday earns its place by RECURRING: seen twice or more across the window. A customer whose
 * albaranes fall on a different day every time has no pattern, and inventing one for the head of
 * their sheet would be the software making a claim the record cannot carry — so that customer gets
 * the cadence instead, which is the true fact about them.
 */
export function dayPatternOf(
  cast: Cast,
  customer: Customer,
  live: Array<{ day: string }> = [],
): DayPattern {
  const seen = new Map<string, number>();
  const days = [...historyOf(cast, customer).map((a) => a.day), ...live.map((s) => s.day)];
  for (const day of days) {
    const w = weekdayOf(day, cast);
    seen.set(w, (seen.get(w) ?? 0) + 1);
  }
  const recurring = WEEK.filter((w) => (seen.get(w) ?? 0) >= 2);
  /* THE CADENCE IS ARITHMETIC, NOT A GUESS: the real span between the oldest and the newest,
     measured on the calendar rather than on the `dd.mm` string, divided by the gaps in between. */
  const DAY_MS = 86400000;
  const times = days.map((d) => dateOfHistoryDay(d, cast).getTime()).sort((a, b) => a - b);
  const span = times.length > 1 ? Math.round((times[times.length - 1] - times[0]) / DAY_MS) : 0;
  const every = span > 0 ? Math.max(1, Math.round(span / (times.length - 1))) : 0;
  return {
    days: recurring.map((w) => SHORT_DAY[w]),
    cadence: every > 0 ? `about every ${every} ${plural(every, 'day')}` : 'rhythm still forming',
  };
}

/** «1 day» · «3 days». Local, because this file has no view layer to borrow one from. */
const plural = (n: number, one: string): string => (n === 1 ? one : `${one}s`);

/**
 * THEIR TYPICAL ORDER, SAID PLAINLY (§42.1).
 *
 * The basket holds TOTALS across the window; a typical order is those totals divided by the
 * albaranes that carried them, which is the number a person actually pictures when they hear the
 * customer's name. Three goods, because a sentence with six nouns in it is a table.
 */
export function typicalOrderWords(basket: Basket, most = 3): string {
  const lines = basket.lines.slice(0, most).filter((l) => l.albaranes > 0);
  if (lines.length === 0) return 'the record is empty so far';
  const parts = lines.map((l) => {
    /* ONE DECIMAL, BECAUSE THIS IS SPEECH. «8,24 kg of Rape» is an average printed at the precision
       of the arithmetic that produced it, and nobody says that out loud — the sentence is what this
       customer USUALLY takes, and a usual is a round number. The exact figures live one block down
       in «what carries the account», where precision is the point. */
    const per = Math.round((l.qty / l.albaranes) * 10) / 10;
    return `${amount(per)} ${units(per, l.unit)} of ${l.product.name}`;
  });
  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/* ═══ THE IMPORTED LEDGER (THE-DATA-CANON §4, open call 4) ════════════════════════════════════
 * «The demo import should mint a months-spanning ledger (real events, real seasons) so "Tus
 * temporadas" renders FED. Default taken: the fixture generates a deterministic 12-month event
 * ledger on import — SENTENCES ALONE HYDRATE SENTENCES; EVENTS HYDRATE NUMBERS.»
 *
 * ═══ WHAT IS MINTED, AND WHY IT IS NOT AN INVENTED CURVE ═══════════════════════════════════
 * The lazy version of this is a seasonal index — a line of twelve multipliers somebody liked the
 * shape of — dropped over the house's own total. That is precisely the arbitrary number this whole
 * layer exists to refuse: nobody could check it, and its «seasons» would be a drawing of seasons.
 *
 * So the ledger is minted as EVENTS, out of two things the record already holds:
 *
 *   1 · EACH ACCOUNT'S OWN RHYTHM — `dayPatternOf`. An account that shows Mon · Wed · Fri gets an
 *       albarán on every Monday, Wednesday and Friday of the month; an account with no recurring
 *       weekday gets its own CADENCE («about every 3 days»), which is the true fact about it.
 *   2 · EACH ACCOUNT'S OWN USUAL ALBARÁN — `basketOf().typical`, what one of theirs comes to.
 *
 * A month's figure is then the fold of those events, and the month-to-month variation is REAL
 * CALENDAR ARITHMETIC: February has four Mondays where March has five, a 28-day month carries
 * fewer delivery days than a 31-day one, and a house whose book leans on Friday accounts moves
 * with the Fridays. Nothing is scaled by a number nobody can check, and the method line says
 * exactly this so a stranger can hold the chart to it.
 *
 * IT IS DETERMINISTIC. Same cast, same import event, same figures — the calendar is fixed, the
 * rhythms are a pure read of the record, and there is no clock and no random in here. That is what
 * the drive's determinism assertion (the seat's «same ledger twice, same figures») is holding.
 */

/** One month of the imported ledger, folded. */
export type ImportedMonth = {
  /** the trade's own `mm` */
  key: string;
  /** «Sep» — what an axis has room for */
  label: string;
  year: number;
  figure: number;
  albaranes: number;
};

/** how many days a calendar month holds */
const daysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();

/** the short weekday name a date falls on, in the same words `dayPatternOf` speaks */
const shortWeekdayOf = (d: Date): string => SHORT_DAY[WEEK[(d.getDay() + 6) % 7]];

/** THE MONTHS AN IMPORT COVERS, oldest first — the eleven BEFORE the one the app is standing in.
 *  The live month is deliberately absent: the day ledger already holds it, and a fixture that also
 *  minted it would count the same trade twice. The caller adds the live month from the live fold,
 *  which is why the chart comes to twelve. */
export function importedMonthKeys(cast: Cast, n = IMPORT_MONTHS - 1): Array<{ key: string; year: number; month: number }> {
  const base = dayFromId(todayId(cast));
  const out: Array<{ key: string; year: number; month: number }> = [];
  for (let back = n; back >= 1; back -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - back, 1);
    out.push({ key: String(d.getMonth() + 1).padStart(2, '0'), year: d.getFullYear(), month: d.getMonth() });
  }
  return out;
}

/** HOW MANY ALBARANES ONE ACCOUNT'S RHYTHM PUTS IN ONE MONTH. Their recurring weekdays counted on
 *  the real calendar where they have any; their own cadence where they have none. */
function albaranesInMonth(pattern: DayPattern, year: number, month: number): number {
  const days = daysInMonth(year, month);
  if (pattern.days.length > 0) {
    const want = new Set(pattern.days);
    let n = 0;
    for (let d = 1; d <= days; d += 1) {
      if (want.has(shortWeekdayOf(new Date(year, month, d)))) n += 1;
    }
    return n;
  }
  /* «about every 3 days» is the true fact about an account with no recurring weekday, so it is what
     mints their month. An account with no rhythm at all mints nothing — a gap ships as a gap. */
  const every = Number(pattern.cadence.replace(/\D+/g, ''));
  return every > 0 ? Math.floor(days / every) : 0;
}

/** ONE ACCOUNT'S IMPORTED MONTHS, oldest first. This is what the customer sheet's 32px months
 *  sparkline draws (THE-DATA-CANON §2.3's projection). */
export function importedMonthsFor(cast: Cast, customer: Customer): ImportedMonth[] {
  const pattern = dayPatternOf(cast, customer);
  const typical = basketOf(cast, customer).typical;
  return importedMonthKeys(cast).map(({ key, year, month }) => {
    const albaranes = albaranesInMonth(pattern, year, month);
    return { key, label: monthLabelOf(key), year, figure: round2(albaranes * typical), albaranes };
  });
}

/** THE WHOLE HOUSE'S IMPORTED MONTHS, oldest first — the twelve-bar chart's first eleven bars. */
export function importedMonths(cast: Cast): ImportedMonth[] {
  const rows = importedMonthKeys(cast).map(({ key, year, month }) => ({
    key,
    label: monthLabelOf(key),
    year,
    figure: 0,
    albaranes: 0,
    month,
  }));
  for (const customer of cast.customers) {
    const pattern = dayPatternOf(cast, customer);
    const typical = basketOf(cast, customer).typical;
    if (typical <= 0) continue;
    for (const row of rows) {
      const n = albaranesInMonth(pattern, row.year, row.month);
      row.albaranes += n;
      row.figure += n * typical;
    }
  }
  return rows.map(({ key, label, year, figure, albaranes }) => ({
    key, label, year, figure: round2(figure), albaranes,
  }));
}

/** HOW THE YEAR WAS MINTED, in one sentence a stranger can hold any of its figures to. It is its
 *  own constant because several readings are minted this way and each states its own WINDOW after
 *  it — the mint is the shared half of the method line, never the whole of it. */
export const IMPORTED_MINT =
  'Minted from the imported year: every account’s own delivery weekdays counted on the calendar, ' +
  'each delivery note at what one of theirs usually comes to.';

/** what the bars were counted off, where the running month is one of them */
export const IMPORTED_METHOD = `${IMPORTED_MINT} The last bar is this month’s own ledger.`;

/* ── THEIR MENU (§42.3) ───────────────────────────────────────────────────────────────────────
 * «THEIR MENU is a top-level OBJECT — that's what it is — and a menu CHANGE is an event that goes
 * INTO it. Getting their menu is a standard feature Rocoto runs once.»
 *
 * SO A HOUSE HAS READ SOME MENUS AND NOT OTHERS, and the ones it has not read say so as a thing
 * that can be DONE rather than as an empty box. Two are seeded read, because that is what a house
 * that has just started looks like; every other customer carries the fetchable state until somebody
 * presses it, and pressing it really does read one (the store below).
 *
 * THE DISHES ARE THE ENCYCLOPEDIA'S OWN WORDS, not the cast's — a customer's carte is not a fact
 * the catalogue holds, and it is the same kind of content as the menu-change sentences that have
 * lived in this file since §5.
 */
export type Dish = { name: string };

export type Menu = {
  dishes: Dish[];
  /** the day the listing was read, in the trade's own words */
  read: string;
  /** whose page it came off — the attribution the card carries */
  place: string;
};

const CARTE: Record<SectorId, string[]> = {
  fish: [
    'Suquet de peix', 'Arròs negre', 'Fideuà de marisc',
    'Esqueixada de bacallà', 'Calamars a l’andalusa', 'Rap a la planxa',
  ],
  meat: [
    'Fricandó', 'Botifarra amb mongetes', 'Entrecot a la brasa',
    'Canelons', 'Peus de porc', 'Carpaccio de vedella',
  ],
  fruit: [
    'Escalivada', 'Amanida de tomàquet i burrata', 'Gaspatxo',
    'Macedònia de temporada', 'Pastís de poma', 'Sorbet de llimona',
  ],
};

/** How many menus a house arrives having read. «Seed one or two» (§42.3). */
export const MENUS_SEEDED = 2;

/** Has this customer's menu been read — by the seed, or by somebody pressing the button? */
export const menuIsRead = (cast: Cast, customer: Customer, alsoRead: string[] = []): boolean =>
  indexOfCustomer(cast, customer) < MENUS_SEEDED || alsoRead.includes(customer.id);

/** Their menu, where it has been read. `null` is the fetchable state and never a blank. */
export function menuOf(cast: Cast, customer: Customer, alsoRead: string[] = []): Menu | null {
  if (!menuIsRead(cast, customer, alsoRead)) return null;
  const ci = indexOfCustomer(cast, customer);
  const carte = CARTE[cast.sector];
  /* a rotation, so two restaurants in one street do not carry the same six dishes in the same
     order — the same deterministic scatter every other seeded fact in this file uses */
  const turn = ci % carte.length;
  return {
    dishes: [...carte.slice(turn), ...carte.slice(0, turn)].map((name) => ({ name })),
    read: daysBefore(anchorDay(cast), 2 + ci),
    place: customer.name,
  };
}

/* ── THE READING, AS A REAL ACT ───────────────────────────────────────────────────────────────
 * «Nothing renders a control that does nothing» is the inbox's own law and it holds here: the
 * fetchable state's button READS the menu, and the object appears. One module store, persisted,
 * published through `useSyncExternalStore` — the shape the imports above already keep.
 */

export const MENUS_STORAGE_KEY = 'rocoto-app-menus';

type MenuReads = { sector: SectorId | null; ids: string[] };

const readMenus = (): MenuReads => {
  try {
    const raw = window.localStorage.getItem(MENUS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { sector: null, ids: [] };
    const x = parsed as Record<string, unknown>;
    return {
      sector: (x.sector as SectorId) ?? null,
      ids: Array.isArray(x.ids) ? x.ids.filter((i): i is string => typeof i === 'string') : [],
    };
  } catch {
    return { sector: null, ids: [] };
  }
};

let MENUS: MenuReads = typeof window === 'undefined' ? { sector: null, ids: [] } : readMenus();

const menuListeners = new Set<() => void>();
const menuSubscribe = (fn: () => void): (() => void) => {
  menuListeners.add(fn);
  return () => {
    menuListeners.delete(fn);
  };
};
const menuSnapshot = (): MenuReads => MENUS;
const menuPublish = (next: MenuReads): void => {
  MENUS = next;
  try {
    window.localStorage.setItem(MENUS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* a prototype in a private window still has to run */
  }
  for (const fn of menuListeners) fn();
};

/** Read one customer's menu. The sector switch is a different house, so its reading is its own. */
export function readMenu(sector: SectorId, customerId: string): void {
  const base = MENUS.sector === sector ? MENUS : { sector, ids: [] };
  if (base.ids.includes(customerId)) return;
  menuPublish({ sector, ids: [...base.ids, customerId] });
}

/** The menus this house has read beyond the seeded ones. */
export function useMenusRead(sector: SectorId): string[] {
  const state = React.useSyncExternalStore(menuSubscribe, menuSnapshot, menuSnapshot);
  return state.sector === sector ? state.ids : [];
}
