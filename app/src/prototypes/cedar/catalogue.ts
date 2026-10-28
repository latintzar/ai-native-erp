/* THE CATALOGUE — the inventory's four strata, grounded on Rocoto's own tree.
 * THE-INTELLIGENCE §6 (the strata) and §10 (the ontology). V2-STOCK.
 *
 * ═══ WHY FOUR STRATA AND NOT ONE LIST (§6) ═══════════════════════════════════════════════════
 * «Four strata, all visible, none merged.» A catalogue is not the file somebody uploaded; it is
 * the file PLUS everything the house has said since. So this module holds the four layers of that,
 * and keeps them apart on purpose:
 *
 *   1 · THEIR SKUs         what they uploaded, under the tree node each one GROUNDS onto — their
 *                          own word where the upload carried one, and Rocoto's node where it did
 *                          not (§6.1 as upgraded by §10.2)
 *   2 · UNCODED SKUs       things customers ordered that match nothing (§6.2) — `OFF_LIST`
 *   3 · PERSONALIZATIONS   the amendment registry: which bases carry which words, how often (§2)
 *   4 · LEARNED SORTS      what the house WROTE on past albaranes, finer than the SKU, hanging
 *                          under the node it belongs to (§6.4)
 *
 * Merging them would be the ERP move: one flat product table where a guess, a customer's word and
 * a hand-written sort are indistinguishable from a coded SKU. Kept apart, each one carries its own
 * act — ground it, adopt it, graduate it — and every act is one tap.
 *
 * ═══ THE TREE IS THE PRODUCT (§10.1) ═════════════════════════════════════════════════════════
 * «In any company you'd start with some type of pre-seeded intelligence. For us it's the whole
 * tree and encyclopedia of fruit, vegetable and fish. They're paying us for that knowledge — first
 * our own structure, then the learning on their data.»
 *
 * So the labeller does not hand out flat tags. It GROUNDS a name onto a node of a tree Rocoto
 * brought with it — family → category → type → sort — and from then on the house's whole
 * catalogue lives ON that tree. Three consequences the UI has to carry, and does:
 *
 *   · A CORRECTION IS A RE-GROUNDING. The tap offers the NEARBY NODES — the parent, the siblings,
 *     the children — and never a free-text box, because a name typed into a box is a name that
 *     grounds onto nothing.
 *   · A HOUSE SEES THE TREE AT ITS OWN RESOLUTION. «For them, maybe it's all pink and it doesn't
 *     really matter which.» So the categories Stock draws are nodes at the house's own level, and
 *     a group that collapses two kinds Rocoto knows apart SAYS SO on its header.
 *   · A HOUSE PRIOR IS NODE-ANCHORED (§10.3). «The typical tomato of the pink category they sell
 *     is THIS in May, and the other one in October.» A product whose node has kinds under it
 *     carries that one sentence, because that product is where the node→SKU resolution bites.
 *
 * ═══ THE CORRECTION IS THE TRAINING SIGNAL (§1) ══════════════════════════════════════════════
 * There is no thumbs, no rating, no «was this helpful». Re-grounding a category writes an event,
 * sticks, and is the only feedback UI this product will ever have.
 *
 * ═══ WHERE THE WORDS LIVE ════════════════════════════════════════════════════════════════════
 * Law 10 holds here exactly as it holds in `cast.ts`: NO NAME IS TYPED INTO A SCREEN. Every node,
 * every amendment, every learned sort is data in this file, so a screen draws them and never holds
 * one. Names that are not the founder's yet carry `provisional` (C-9) and the shell draws them
 * with its hairline underline, the same as the meat cast.
 *
 * NO PROVIDER, for rules.ts's reason: `main.tsx` and `App.tsx` belong to V2-CORE, so a surface
 * that needed a provider mounted above it could not be written without editing them. One module
 * singleton, persisted, read through `useSyncExternalStore`.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';
import type { Cast, OffListItem, Product } from '../../scenarios/data/cast';
/* THE HOUSES' OWN WORLDS, AT RUNTIME (THE-OBJECT-MAP C7). A learned sort belongs to exactly one
   sector, so `sortMember` looks its base product up in that sector's own cast rather than asking
   for a cast it would then have to be threaded — the same reason `amendmentById` reads the store
   instead of taking it as an argument. `cast.ts` imports nothing from here. */
import { CASTS } from '../../scenarios/data/cast';
import { CEDAR_CATALOGUE_PEN_VERSION, migrateCatalogueCurrency } from './currency-migration';
import {
  CALIBRE_FAMILIES, CALIBRE_WORDS, REF_ATTRS, REF_COMPOSITIONS, REF_NODES, REF_REGISTERS,
  REF_WORDS, type RefNode,
} from './reference-data';

/* ── ROCOTO'S OWN TREE (§10.1) ────────────────────────────────────────────────────────────────
 * The slice §10.8 asks the prototype to carry — tomatoes, merluza forms, chicken cuts — plus
 * enough of the three catalogues around them that every SKU in the cast has somewhere true to
 * land. The real encyclopedia is an engineering asset, versioned and curated per tenant; this is
 * the CONTRACT it has to fill, drawn small enough to read in one screen.
 *
 * It is a tree here and a DAG in the real thing («a name may sit under two parents»). Nothing in
 * this file assumes a single parent except the walk upward, which takes the first it finds — so
 * the day a node grows a second parent, the walk is the only line that changes.
 */
export type NodeLevel = 'family' | 'category' | 'type' | 'sort';

export type TreeNode = {
  id: string;
  /** the trade's own word for it */
  name: string;
  level: NodeLevel;
  parent?: string;
  /** where the row came from — «sourced vs authored is in the data» (THE-STANDARD-CATALOG §50b.3) */
  src?: RefNode['src'];
  /** a Merca quotes it: market priority as an attribute, never as a shorter list (FEED-IA §52.2) */
  traded?: boolean;
  /** standing on its GPC English title, the Spanish word owed (§52.3) */
  pending?: boolean;
};

/* THE 46 NODES THIS SURFACE WAS DRAWN AGAINST. Their ids are permanent and never reused, because
 * every tenant's priors, routings and paintings key on them (§4.2.5). The reference GROWS around
 * them; it never renames or re-levels one. */
const BASE_TREE: TreeNode[] = [
  /* ── fish ── */
  { id: 'n-fish', name: 'Pescado y marisco', level: 'family' },
  { id: 'n-whitefish', name: 'Pescado blanco', level: 'category', parent: 'n-fish' },
  { id: 'n-hake', name: 'Merluza', level: 'type', parent: 'n-whitefish' },
  { id: 'n-hake-hook', name: 'Merluza de pincho', level: 'sort', parent: 'n-hake' },
  { id: 'n-hake-trawl', name: 'Merluza de arrastre', level: 'sort', parent: 'n-hake' },
  { id: 'n-monkfish', name: 'Rape', level: 'type', parent: 'n-whitefish' },
  { id: 'n-farmed', name: 'Pescado de crianza', level: 'category', parent: 'n-fish' },
  { id: 'n-seabass', name: 'Lubina', level: 'type', parent: 'n-farmed' },
  { id: 'n-shellfish', name: 'Marisco', level: 'category', parent: 'n-fish' },
  { id: 'n-prawn', name: 'Gamba roja', level: 'type', parent: 'n-shellfish' },
  { id: 'n-clam', name: 'Almeja', level: 'type', parent: 'n-shellfish' },
  { id: 'n-cephalopod', name: 'Cefalópodos', level: 'category', parent: 'n-fish' },
  { id: 'n-octopus', name: 'Pulpo', level: 'type', parent: 'n-cephalopod' },
  { id: 'n-octopus-rock', name: 'Pulpo de roca', level: 'sort', parent: 'n-octopus' },

  /* ── meat ── */
  { id: 'n-meat', name: 'Carne', level: 'family' },
  { id: 'n-pork', name: 'Cerdo', level: 'category', parent: 'n-meat' },
  { id: 'n-halfcarcass', name: 'Media canal', level: 'type', parent: 'n-pork' },
  { id: 'n-cured', name: 'Curados', level: 'category', parent: 'n-meat' },
  { id: 'n-ham', name: 'Jamón', level: 'type', parent: 'n-cured' },
  { id: 'n-cured-loin', name: 'Lomo embuchado', level: 'type', parent: 'n-cured' },
  { id: 'n-sausage', name: 'Embutido', level: 'category', parent: 'n-meat' },
  { id: 'n-chorizo', name: 'Chorizo', level: 'type', parent: 'n-sausage' },
  { id: 'n-beef', name: 'Vacuno', level: 'category', parent: 'n-meat' },
  { id: 'n-tenderloin', name: 'Solomillo', level: 'type', parent: 'n-beef' },
  { id: 'n-tenderloin-gal', name: 'Solomillo gallego', level: 'sort', parent: 'n-tenderloin' },
  { id: 'n-poultry', name: 'Aves', level: 'category', parent: 'n-meat' },
  { id: 'n-chicken', name: 'Pollo', level: 'type', parent: 'n-poultry' },
  { id: 'n-chicken-wing', name: 'Alitas de pollo', level: 'sort', parent: 'n-chicken' },
  { id: 'n-offal', name: 'Tripas y grasas', level: 'category', parent: 'n-meat' },

  /* ── fruit and vegetable ── */
  { id: 'n-produce', name: 'Fruta y verdura', level: 'family' },
  { id: 'n-vegetable', name: 'Verdura', level: 'category', parent: 'n-produce' },
  { id: 'n-tomato', name: 'Tomate', level: 'type', parent: 'n-vegetable' },
  { id: 'n-tomato-vine', name: 'Tomate rama', level: 'sort', parent: 'n-tomato' },
  { id: 'n-tomato-vine-gr', name: 'Tomate rama griego', level: 'sort', parent: 'n-tomato-vine' },
  { id: 'n-tomato-pink', name: 'Tomate rosa', level: 'sort', parent: 'n-tomato' },
  { id: 'n-tomato-plum', name: 'Tomate pera', level: 'sort', parent: 'n-tomato' },
  { id: 'n-tomato-cherry', name: 'Tomate cherry', level: 'sort', parent: 'n-tomato' },
  { id: 'n-courgette', name: 'Calabacín', level: 'type', parent: 'n-vegetable' },
  { id: 'n-fruit', name: 'Fruta', level: 'category', parent: 'n-produce' },
  { id: 'n-mango', name: 'Mango', level: 'type', parent: 'n-fruit' },
  { id: 'n-avocado', name: 'Aguacate', level: 'type', parent: 'n-fruit' },
  { id: 'n-herb', name: 'Hierbas', level: 'category', parent: 'n-produce' },
  { id: 'n-parsley', name: 'Perejil', level: 'type', parent: 'n-herb' },

  /* ── what every house carries and nobody sells ── */
  { id: 'n-ambient', name: 'Ambiente y secos', level: 'family' },
  { id: 'n-ice', name: 'Hielo', level: 'category', parent: 'n-ambient' },
  { id: 'n-casing', name: 'Tripa natural', level: 'category', parent: 'n-ambient' },
];

/* ═══ THE STANDARD REFERENCE, GROWN ONTO THE SAME TREE (FEED-IA §48/§50/§52) ══════════════════
 * «We shouldn't be surprised by ANY product any supplier offers» — and the answer to that is not
 * a longer hand-list, it is an ENUMERATING SOURCE. `reference-data.ts` is generated from four of
 * them: the BOE's 1,105 registered fish species (Spanish law: «el nombre comercial se considerará
 * como denominación oficial en todo el territorio nacional»), GS1 GPC's 879 Food/Beverage bricks
 * with their cut and cultivar enumerations, Mercamadrid's 538 productos × their variety axis, and
 * Mercabarna's 319-code register. What is authored is the SPANISH LEXICON over those categories,
 * never the existence of a category.
 *
 * THE TREE IS ONE TREE. A grown node hangs under a base node wherever the trade already had a word
 * for its shelf, so «Dorada» arrives as a node of its own under Pescado de crianza and stops
 * borrowing the name of the Lubina it was bucketed with.
 */
export const TREE: TreeNode[] = [
  ...BASE_TREE,
  ...REF_NODES.map<TreeNode>((n) => ({
    id: n.id,
    name: n.name,
    level: n.level,
    parent: n.parent,
    src: n.src,
    traded: n.traded,
    pending: n.pending,
  })),
];

const BY_ID = new Map(TREE.map((n) => [n.id, n]));

/** What a node is inside a mix — §2.4's composition edge, for the gama IV/V nodes that ARE mixes. */
export const compositionOf = (id: string): string | undefined => REF_COMPOSITIONS.get(id);

/** The external ids a node carries: FAO alfa-3, scientific name, the Mercas' and GPC's own codes. */
export const externalIdsOf = (id: string) => REF_ATTRS.get(id);

export const nodeOf = (id: string): TreeNode | undefined => BY_ID.get(id);

export const nameOfNode = (id: string): string => BY_ID.get(id)?.name ?? id;

/* Indexed rather than scanned: the tree is thousands of nodes now, and `childrenOf` is called per
 * row of a drawn catalogue. A filter over the whole tree per call is the one thing that would make
 * the growth cost something on screen. */
const BY_PARENT = ((): Map<string, TreeNode[]> => {
  const out = new Map<string, TreeNode[]>();
  for (const n of TREE) {
    if (!n.parent) continue;
    const held = out.get(n.parent);
    if (held) held.push(n);
    else out.set(n.parent, [n]);
  }
  return out;
})();

export const childrenOf = (id: string): TreeNode[] => BY_PARENT.get(id) ?? [];

export const parentOf = (id: string): TreeNode | undefined => {
  const node = BY_ID.get(id);
  return node?.parent ? BY_ID.get(node.parent) : undefined;
};

/** The walk upward, root last. The one line that changes the day a node grows a second parent. */
export function ancestorsOf(id: string): TreeNode[] {
  const out: TreeNode[] = [];
  let at = parentOf(id);
  while (at && out.length < 8) {
    out.push(at);
    at = parentOf(at.id);
  }
  return out;
}

/**
 * THE NEARBY NODES — what a correction may re-ground to (§10.2).
 *
 * The parent, the siblings and the children, in that order: up a level, across a level, down a
 * level. A correction that offered the whole encyclopedia would be a search box, and a search box
 * is the free-text field this design exists to refuse.
 */
export function nearbyNodes(id: string): TreeNode[] {
  const parent = parentOf(id);
  const siblings = parent ? childrenOf(parent.id).filter((n) => n.id !== id) : [];
  const out = [...(parent ? [parent] : []), ...rank(siblings), ...rank(childrenOf(id))];
  return out.filter((n, i) => out.findIndex((m) => m.id === n.id) === i).slice(0, NEARBY);
}

/* HOW MANY NEIGHBOURS ARE STILL NEIGHBOURS. The BOE registers 25 almejas, and a correction that
 * offered all 25 would be the search box this design exists to refuse — the doctrine's own words.
 * So the nearby set stays a set a person can read, and the ones a market actually quotes come
 * first: `traded` is the reference's market-priority attribute, and this is the one place on the
 * surface where it earns its keep. The rest of the branch is reached by walking down it. */
const NEARBY = 12;

const rank = (nodes: TreeNode[]): TreeNode[] => {
  const score = (n: TreeNode): number => (n.traded ? 0 : 1) + (n.pending ? 2 : 0);
  return [...nodes].sort((a, b) => score(a) - score(b));
};

/* ── GROUNDING — NAMES BECOME NODES (§10.2) ───────────────────────────────────────────────────
 * «Every house SKU, every learned sort, every amendment, every order phrase GROUNDS onto a tree
 * node. This is the LLM labeller's real job.»
 *
 * The simulated model reads the NAME and nothing else, because that is what the real one has on
 * the day a catalogue lands and nothing else about the house is known yet. The order of the list
 * is the model's own precedence: the narrow words win over the broad ones, which is why «manteca
 * de cerdo» is a fat and not a pig.
 */
const GROUND: Array<[RegExp, string]> = [
  [/perejil|cilantro|albahaca|hierbabuena/i, 'n-parsley'],
  [/hielo/i, 'n-ice'],
  [/tripa/i, 'n-casing'],
  [/manteca|grasa|sebo/i, 'n-offal'],
  [/pulpo de roca/i, 'n-octopus-rock'],
  [/pulpo|calamar|sepia|chipir[oó]n|choco/i, 'n-octopus'],
  [/merluza de pincho/i, 'n-hake-hook'],
  [/merluza de arrastre/i, 'n-hake-trawl'],
  [/merluza/i, 'n-hake'],
  [/rape/i, 'n-monkfish'],
  [/lubina|dorada|corvina|estero/i, 'n-seabass'],
  [/almeja|mejill|navaja|berberecho/i, 'n-clam'],
  [/gamba|langostino|cigala/i, 'n-prawn'],
  [/bacalao|lenguado|rodaball|pescad/i, 'n-whitefish'],
  [/alita/i, 'n-chicken-wing'],
  [/pollo|pavo|pato|codorniz/i, 'n-chicken'],
  [/jam[oó]n|cecina/i, 'n-ham'],
  [/lomo embuchado|lomo/i, 'n-cured-loin'],
  [/chorizo|sarta|morcilla|butifarra|salchich/i, 'n-chorizo'],
  [/solomillo de ternera gallega|solomillo gallego/i, 'n-tenderloin-gal'],
  [/solomillo|entrec|chuletón|ternera|vacuno|buey/i, 'n-tenderloin'],
  [/media canal|canal|costillar|panceta|papada|cochinillo|cerdo/i, 'n-halfcarcass'],
  [/tomate rama griego|tomate griego/i, 'n-tomato-vine-gr'],
  [/tomate rama/i, 'n-tomato-vine'],
  [/tomate rosa/i, 'n-tomato-pink'],
  [/tomate pera/i, 'n-tomato-plum'],
  [/tomate cherry/i, 'n-tomato-cherry'],
  [/tomate/i, 'n-tomato'],
  [/calabac[ií]n/i, 'n-courgette'],
  [/pimiento|cebolla|lechuga|zanahoria|verdura/i, 'n-vegetable'],
  [/mango/i, 'n-mango'],
  [/aguacate/i, 'n-avocado'],
  [/pl[aá]tano|pi[ñn]a|papaya|manzana|pera|naranja|fruta/i, 'n-fruit'],
];

/** The family a catalogue's own family id belongs to on the tree, so a name the model cannot
 *  place still lands somewhere true rather than nowhere. */
const FAMILY_ROOT: Record<string, string> = {
  pescado: 'n-fish',
  carne: 'n-meat',
  fruta: 'n-produce',
  ambient: 'n-ambient',
};

/* ── THE LEXICON ANSWERS FIRST (THE-STANDARD-CATALOG §2.2, §4.3) ──────────────────────────────
 * «Retrieval-first, model-second: an exact/normalized/fuzzy lexicon lookup answers the large
 * majority for free.» The 33 regexes below stay — they are the cast's own bucket rules and they
 * are the fallback — but a name is now read against 8,000-odd real surfaces before it ever meets
 * one, which is what stops `dorada` landing on the node named Lubina.
 *
 * LEFTMOST-LONGEST, the lexer's rule and the right one here. «SOLOMILLO DE CERDO FRESCO» must beat
 * «solomillo» with «solomillo de cerdo», and «CHULETERO DE AGUJA» must be a chuck and not a
 * garfish — the first thing a trade line names is what the line is about, and the longest reading
 * at that first position is the most specific true one.
 *
 * WHERE TWO NODES CLAIM ONE WORD, THE FAMILY DECIDES. «Aguja» is a garfish to a fishmonger and a
 * chuck to a butcher; both are true, and the reading is picked by the family the line is being
 * read in rather than by whichever source was ingested first.
 */
const LEX = ((): Map<string, Array<{ node: string; reg: string }>> => {
  const out = new Map<string, Array<{ node: string; reg: string }>>();
  for (const row of REF_WORDS) {
    const held = out.get(row.w);
    if (held) held.push({ node: row.node, reg: row.reg });
    else out.set(row.w, [{ node: row.node, reg: row.reg }]);
  }
  return out;
})();

/** The longest surface anyone has bound, so the scan knows when to stop widening the window. */
const LEX_SPAN = 6;

const familyOfNode = (id: string): string => {
  const chain = [BY_ID.get(id), ...ancestorsOf(id)];
  return chain.find((n) => n?.level === 'family')?.id ?? 'n-ambient';
};

/** The family a catalogue's own family id names, so a reading can prefer its own world. */
const FAMILY_OF_SECTOR: Record<string, string> = {
  pescado: 'n-fish', carne: 'n-meat', fruta: 'n-produce', ambient: 'n-ambient',
};

export type Reading = { node: string; said: string; at: number; words: number };

/** What the lexicon reads out of a written name — the node, and the words that claimed it. */
export function readLexicon(name: string, prefer?: string): Reading | undefined {
  const parts = foldWord(name).split(' ').filter(Boolean);
  for (let start = 0; start < parts.length; start += 1) {
    for (let len = Math.min(LEX_SPAN, parts.length - start); len >= 1; len -= 1) {
      const said = parts.slice(start, start + len).join(' ');
      const hit = LEX.get(said);
      if (!hit) continue;
      const inFamily = prefer ? hit.find((c) => familyOfNode(c.node) === prefer) : undefined;
      return { node: (inFamily ?? hit[0]).node, said, at: start, words: len };
    }
  }
  return undefined;
}

/**
 * The node a name grounds onto — the deepest one its words support.
 *
 * FOUR READINGS, IN THIS ORDER: the reference's lexicon; the cast's own bucket regexes; the trade
 * word the document wrote in its own familia column; and the catalogue's family root. The third
 * one is the exam's finding §8.6 — «the familia column, the one column both CSVs kept tidy, is
 * dead weight» — answered: a row nothing else claims now falls to the DOCUMENT'S OWN shelf
 * instead of to the shelf that holds ice and sausage casings.
 */
export function ground(name: string, familyId: string): string {
  const prefer = FAMILY_OF_SECTOR[familyId];
  const read = readLexicon(name, prefer);
  if (read) return read.node;
  for (const [hint, node] of GROUND) if (hint.test(name)) return node;
  const familia = familyId ? LEX.get(foldWord(familyId)) : undefined;
  if (familia) return familia[0].node;
  return FAMILY_ROOT[familyId] ?? 'n-ambient';
}

/* ── THE HOUSE'S OWN RESOLUTION (§10.1) ───────────────────────────────────────────────────────
 * «Houses and customers see it at their own resolution… For them, maybe it's all pink and it
 * doesn't really matter which.» The shelves a house keeps stop at a level; everything the tree
 * knows below that level is one thing to them. Rocoto still knows the difference, and the group's
 * header says so, which is how a person discovers that going deeper is even on offer.
 */
export const HOUSE_RESOLUTION: Record<SectorId, NodeLevel> = {
  fish: 'category',
  meat: 'category',
  fruit: 'category',
};

const ORDER: NodeLevel[] = ['family', 'category', 'type', 'sort'];

/** A node, lifted to the level the house stops at. A node already at or above it stands still. */
export function liftTo(id: string, level: NodeLevel): string {
  const want = ORDER.indexOf(level);
  let at = BY_ID.get(id);
  while (at && ORDER.indexOf(at.level) > want) {
    const up = at.parent ? BY_ID.get(at.parent) : undefined;
    if (!up) break;
    at = up;
  }
  return at?.id ?? id;
}

/* ── THE UPLOAD'S OWN WORDS (§6.1) ────────────────────────────────────────────────────────────
 * «In THEIR categories if they had them.» An export carries a category column filled for the lines
 * somebody kept tidy and empty for the rest — which is the split the founder will see on his own
 * upload. A word the upload carried does two things at once: it GROUNDS the product, and it NAMES
 * that node in this house's own vocabulary, so «Pescado fresco» stays «Pescado fresco» on the
 * screen while the intelligence underneath still knows it as the whitefish node.
 */
export type Arrived = { node: string; word: string };

export const FILED_ON_ARRIVAL: Record<SectorId, Record<string, Arrived>> = {
  fish: {
    merluza: { node: 'n-whitefish', word: 'Pescado fresco' },
    rape: { node: 'n-whitefish', word: 'Pescado fresco' },
    gamba: { node: 'n-shellfish', word: 'Marisco' },
  },
  meat: {
    mediacanal: { node: 'n-pork', word: 'Canal y despiece' },
    chorizo: { node: 'n-sausage', word: 'Embutido' },
    lomo: { node: 'n-sausage', word: 'Embutido' },
  },
  fruit: {
    mango: { node: 'n-fruit', word: 'Fruta' },
    aguacate: { node: 'n-fruit', word: 'Fruta' },
  },
};

/* ── STRATUM 3: THE AMENDMENT REGISTRY (§2) ───────────────────────────────────────────────────
 * «They'll have an SKU of fresh chicken… and people can say "I want fresh chicken wings, FROZEN."
 * That's an amendment.» The registry is the same fact counted: which bases carry which words, and
 * how often. Recurring ones graduate — «make this its own product?» — and the catalogue grows the
 * way the business actually talks.
 *
 * AN AMENDMENT GROUNDS TOO (§10.2): it is its base's node plus a FACET — state, preparation, size
 * — which is exactly how the tree carries «fresh/frozen» and «whole/fillet» in §10.1.
 *
 * THE WINGS CASE LIVES IN THE MEAT HOUSE, which is the only one of the three catalogues it can
 * honestly live in. Its base is a product the meat cast does not hold yet, so the registry carries
 * the base's own name and flags it provisional (C-9) rather than a fish house being handed poultry
 * to make a demonstration land.
 */

export type Facet = 'state' | 'preparation' | 'size';

export type Amendment = {
  id: string;
  sector: SectorId;
  /** Product.id in that catalogue */
  base: string;
  /** the base's own name, where the catalogue does not hold it yet */
  baseName?: string;
  /** the node the base grounds onto */
  node: string;
  /** which axis of the tree the word moves along */
  facet: Facet;
  /** the founder has not given this word (C-9) */
  provisional?: boolean;
  /** the trade's own word, exactly as it was said */
  word: string;
  /** how many times this month */
  times: number;
  /** A HAND PUT IT THERE (§75.6 / C6). A variation written on the sheet is not counted off the
   *  traffic, so its row says who wrote it rather than a frequency it does not have. */
  hand?: boolean;
  /** An imported or reviewed member that the house sells now. It keeps its own SKU identity;
   * the family only supplies the relationship and inherited context. */
  sellable?: boolean;
};

export const AMENDMENTS: Amendment[] = [
  { id: 'am-fish-merluza', sector: 'fish', base: 'merluza', node: 'n-hake', facet: 'preparation', word: 'sin cabeza', times: 11, provisional: true },
  { id: 'am-fish-pulpo', sector: 'fish', base: 'pulpo', node: 'n-octopus', facet: 'preparation', word: 'cocido', times: 6, provisional: true },
  /* A reviewed house SKU, not a generic reference suggestion: it is sold and priced as its
     own member, while remaining visibly under the fresh Palamós gamba family. */
  { id: 'am-fish-gamba', sector: 'fish', base: 'gamba', node: 'n-prawn', facet: 'state', word: 'congelada', times: 4, sellable: true },

  /* the doctrine's own case, in the trade's own words */
  { id: 'am-meat-alitas', sector: 'meat', base: 'alitas', baseName: 'Alitas de pollo', node: 'n-chicken-wing', facet: 'state', word: 'congeladas', times: 7, provisional: true },
  { id: 'am-meat-jamon', sector: 'meat', base: 'jamon', node: 'n-ham', facet: 'preparation', word: 'loncheado', times: 9, provisional: true },
  { id: 'am-meat-mediacanal', sector: 'meat', base: 'mediacanal', node: 'n-halfcarcass', facet: 'preparation', word: 'deshuesada', times: 5, provisional: true },

  { id: 'am-fruit-aguacate', sector: 'fruit', base: 'aguacate', node: 'n-avocado', facet: 'state', word: 'maduro', times: 14, provisional: true },
  { id: 'am-fruit-tomate', sector: 'fruit', base: 'tomate', node: 'n-tomato-vine', facet: 'state', word: 'verde', times: 6, provisional: true },
];

/* ── STRATUM 4: THE LEARNED SORTS (§6.4, §10.2) ───────────────────────────────────────────────
 * «What they WROTE on past albaranes that's finer than the SKU: "Greek plum tomatoes" under "plum
 * tomato". The albarán is the source of truth about how the house actually speaks; the catalogue
 * learns FROM the documents, never the reverse.»
 *
 * A sort is a NODE, and it hangs under one — so the row names the node it sits under and the
 * documents that prove it, in that order, which is the doctrine's own sentence.
 */

export type LearnedSort = {
  id: string;
  sector: SectorId;
  /** Product.id it was written under */
  under: string;
  /** the node it grounds onto — its parent is the node it hangs under */
  node: string;
  name: string;
  /** how many albaranes carry it */
  albaranes: number;
  provisional?: boolean;
};

export const SORTS: LearnedSort[] = [
  { id: 'so-fish-merluza', sector: 'fish', under: 'merluza', node: 'n-hake-hook', name: 'Merluza de pincho', albaranes: 12, provisional: true },
  { id: 'so-fish-pulpo', sector: 'fish', under: 'pulpo', node: 'n-octopus-rock', name: 'Pulpo de roca', albaranes: 7, provisional: true },
  /* the Greek case, on the tomato this catalogue actually sells */
  { id: 'so-fruit-tomate', sector: 'fruit', under: 'tomate', node: 'n-tomato-vine-gr', name: 'Tomate rama griego', albaranes: 12, provisional: true },
  { id: 'so-meat-solomillo', sector: 'meat', under: 'solomillo', node: 'n-tenderloin-gal', name: 'Solomillo de ternera gallega', albaranes: 9, provisional: true },
];

/** The node a learned sort hangs under, by name — the doctrine's «under Plum tomato». */
export const hangsUnder = (s: LearnedSort): string => parentOf(s.node)?.name ?? nameOfNode(s.node);

/* ── THE FAMILY AND ITS MEMBERS (FEED-IA §75.6 · THE-OBJECT-MAP C5 · C7) ──────────────────────
 * «If there are variations of a product, the main one should become a variation, get it? And
 * adding variations should be a thing too.»
 *
 * THE DEFECT THIS NAMES. A parent used to keep a FULL row — face, name, price — with its
 * variations indented under it, so the parent stood as BOTH the family and one member of it. Read
 * down the column and «Merluza» was two different things one line apart: the family that «sin
 * cabeza» belongs to, and the plain merluza you can put a price on. A person pricing the plain
 * form and a person pricing the family are aiming at the same row.
 *
 * SO A FAMILY WITH MEMBERS HAS NO PRICE OF ITS OWN. The head carries the face and the name and
 * says how many members it has; every MEMBER carries a price, including the base form, which is
 * minted here as the DEFAULT MEMBER. Nothing is lost and nothing is duplicated: the family is the
 * name, the members are the things you sell.
 *
 * AND SORTS ARE MEMBERS TOO (C7, Peter's call). `stock.tsx` used to exempt a learned sort from the
 * variation grammar on the argument that a sort «is a name of its own on the ladder». Under §75.6
 * a sort of Merluza is family-member shaped exactly as «sin cabeza» is — Mango's own row reads
 * «Avión · Barco · Kent · Keitt · 4kg» (§76) with the shipping forms and the cultivars side by
 * side in ONE register. So a sort joins the family and says only what it adds to the base's name.
 *
 * A FAMILY OF ONE IS NOT A FAMILY. A product with no members keeps its whole row — face, name,
 * fact, price — because there is nothing for it to be the head of.
 */

/* THE WORD THE BASE FORM WEARS is `defaultMemberWord`, at the foot of this file with the dimension
 * registers it reads. It used to be a constant here — «Standard» — which is a SaaS word for a
 * thing the trade already has words for. Peter's call, 2026-08-28. */

/** The default member's id — the base's, under a suffix no amendment or sort id can hold, so the
 *  catalogue's one landing keeps working and a member key is always resolvable to its family. */
export const defaultMemberId = (base: string): string => `${base}~base`;

/** The base a member id belongs to, or null where the id is not a default member's. */
export const defaultMemberBase = (id: string): string | null =>
  id.endsWith('~base') ? id.slice(0, -'~base'.length) : null;

/** WHAT A SORT ADDS TO ITS BASE — the sort's own name minus the base's, so a member row states
 *  ONLY what differs (§65.1). «Merluza de pincho» under «Merluza» is «de pincho»; a sort whose
 *  name does not open with its base's keeps the whole of itself, because a member that said
 *  nothing would be worse than one that repeats a word. */
export function sortWord(base: Product, s: LearnedSort): string {
  const head = base.name.trim().toLowerCase();
  const whole = s.name.trim();
  if (whole.toLowerCase().startsWith(`${head} `)) return whole.slice(head.length + 1);
  return whole;
}

/* ── THE SAME SPLIT, ANSWERED FOR A LINE (THE-OBJECT-MAP C7) ──────────────────────────────────
 * A graduated sort is a product of the house whose name is ITS OWN on the ladder — «Merluza de
 * pincho», one string, no raya — so the fold on the albarán side (`sale.ts`'s `memberOf`) cannot
 * find where it breaks by looking at the string, the way it can for the compound `amendmentProduct`
 * mints. The break it needs is the one THIS file already makes for the shelf: the base the sort
 * hangs off, and `sortWord`'s difference. So the register answers it, once, and the catalogue row
 * and the albarán line can never disagree about where a sort's name divides.
 *
 * IT ANSWERS ON THE ID *OR* THE NAME. The id is a graduated sort standing on a line as a product;
 * the name is the same goods reaching a line by any other door — an off-catalogue word a house that
 * sells one-offs put on a document, which is the phrase its own albaranes taught the register in the
 * first place (§6.4). Both are the same goods, so both draw as base and word.
 */
export type SortMember = { base: string; word: string; join: string };

export function sortMember(product: { id: string; name: string }): SortMember | null {
  const s = SORTS.find((x) => x.id === product.id)
    ?? SORTS.find((x) => foldWord(x.name) === foldWord(product.name));
  if (!s) return null;
  const base = sortBase(CASTS[s.sector], s);
  const word = sortWord(base, s);
  const whole = s.name.trim();
  /* A SORT WHOSE NAME DOES NOT OPEN WITH ITS BASE'S KEEPS THE WHOLE OF ITSELF (`sortWord`'s own
     clause). That one is not a member of anything a reader could see — a «member» repeating its
     family's entire name says nothing — so the line draws it whole, as it always has. */
  if (word === whole) return null;
  /* THE JOIN IS THE ONE THE REGISTER ITSELF WROTE, cut out of the name rather than assumed: a sort
     is «Merluza de pincho» and an amendment is «Merluza · sin cabeza», and a line that printed
     either of them with the other's punctuation would be renaming the goods on the paper. */
  return { base: base.name, word, join: whole.slice(base.name.length, whole.length - word.length) };
}

/* ── WHAT A GRADUATION MAKES ──────────────────────────────────────────────────────────────────
 * A graduated amendment and a graduated sort are both PRODUCTS, and they are the same goods more
 * precisely named — so they inherit the base's family, its unit, its variable-weight fact and its
 * traceability profile. Nothing about them is new except the name the house already uses and the
 * node it already grounds onto.
 */

const baseIn = (cast: Cast, id: string): Product | undefined => cast.products.find((p) => p.id === id);

/** The base an amendment rides, real or named-only. A base the catalogue does not hold yet takes
 *  the sector's own first family, which is the shelf its goods would land on. */
export function amendmentBase(cast: Cast, a: Amendment): Product {
  const held = baseIn(cast, a.base);
  if (held) return held;
  return {
    id: a.base,
    name: a.baseName ?? a.base,
    provisional: a.provisional,
    family: cast.families[0].id,
    unit: 'kg',
    variableWeight: true,
    trace: {},
  };
}

/** «Merluza · sin cabeza» — the chip form, kept, so the lineage is legible on the card as well. */
export const amendmentProduct = (cast: Cast, a: Amendment): Product => ({
  ...amendmentBase(cast, a),
  id: a.id,
  /* A relationship does not inherit its parent's business SKU. Until this sellable member is
     assigned its own code, exports correctly fall back to its stable Rocoto identity. */
  code: undefined,
  name: `${amendmentBase(cast, a).name} · ${a.word}`,
  /* Reviewed sellable members keep their ordinary product treatment; only unresolved words wear
     the provisional mark. */
  provisional: a.provisional,
});

export const sortBase = (cast: Cast, s: LearnedSort): Product => baseIn(cast, s.under) ?? cast.products[0];

export const sortProduct = (cast: Cast, s: LearnedSort): Product => ({
  ...sortBase(cast, s),
  id: s.id,
  name: s.name,
  provisional: true,
});

/** ONE LOOKUP FOR BOTH SOURCES OF A MEMBER (§75.6). A variation a hand wrote graduates exactly as
 *  a counted one does, so every reader that resolves an amendment id has to see the written ones
 *  too — otherwise a graduated hand-written variation resolves to nothing and the row it came from
 *  simply vanishes off the shelf. It reads the store rather than taking it as an argument because
 *  every call site below is already a pure `(id) => …` the whole app leans on. */
const amendmentById = (id: string): Amendment | undefined =>
  AMENDMENTS.find((x) => x.id === id)
  ?? STATE.varied.filter((v) => v.id === id).map<Amendment>((v) => ({
    id: v.id, sector: v.sector, base: v.base, baseName: v.baseName, node: v.node,
    facet: 'preparation', word: v.word, times: 0, hand: true,
  }))[0];

/** The product a graduated row became, whichever stratum it came from. */
export function graduatedProduct(cast: Cast, id: string): Product | undefined {
  const a = amendmentById(id);
  if (a) return amendmentProduct(cast, a);
  const s = SORTS.find((x) => x.id === id);
  return s ? sortProduct(cast, s) : undefined;
}

/** The base a graduated product came off, so it is filed where its base is filed. */
export const graduatedBase = (id: string): string | undefined =>
  amendmentById(id)?.base ?? SORTS.find((x) => x.id === id)?.under;

/** The node a graduated product grounds onto — the sort's own node, or the amendment's base node
 *  with the word riding it as a facet. */
export const graduatedNode = (id: string): string | undefined =>
  amendmentById(id)?.node ?? SORTS.find((x) => x.id === id)?.node;

const sectorOfGraduated = (id: string): SectorId | undefined =>
  amendmentById(id)?.sector ?? SORTS.find((s) => s.id === id)?.sector;

/* ── THE HOUSE PRIOR (§10.3) ──────────────────────────────────────────────────────────────────
 * «The typical tomato of the pink category they sell is THIS in May, and the other one in
 * October.» A prior is `house × node × time` → the specific thing they fulfil with, and it is the
 * whole reason a node is worth having: the router hops words → NODE → the SKU, and this is the
 * second hop.
 *
 * It draws only where the node HAS kinds under it, because that is the only place the resolution
 * is a live question. Every fact in the sentence is read off the product's own trace — nothing
 * here is typed, and a cast that moves moves the sentence with it.
 */
const PRIOR_FACTS: Record<string, (t: Record<string, string>) => string | undefined> = {
  pescado: (t) => (t['arte'] && t['zona'] ? `${t['arte']}, from ${t['zona']}` : undefined),
  carne: (t) => (t['birth'] && t['cutting'] ? `born in ${t['birth']}, cut in ${t['cutting']}` : undefined),
  fruta: (t) => (t['variedad'] && t['origen'] ? `the ${t['variedad']}, from ${t['origen']}` : undefined),
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The one sentence a product carries about what its node means HERE, this month.
 *
 * `undefined` where the node has nothing under it, or where the goods carry no facts to say it
 * with — an observation with nothing observed in it is the sentence this product refuses to print.
 */
export function housePrior(cast: Cast, product: Product, node: string, now: Date): string | undefined {
  if (childrenOf(node).length === 0) return undefined;
  const facts = PRIOR_FACTS[product.family]?.(product.trace);
  if (!facts) return undefined;
  return `In ${MONTHS[now.getMonth()]}, «${nameOfNode(node)}» here means ${facts}.`;
}

/* ── THE EVENTS ───────────────────────────────────────────────────────────────────────────────
 * Every act on this surface is a fact about how the house talks, and the fulfilment brain is fed
 * by exactly these (§0's inputs, §1's «the correction IS the feedback»). They are kept in the same
 * store as the acts themselves so the record and the state can never disagree.
 */

export type CatalogueEventKind = 'grounded' | 'adopted' | 'graduated';

export type CatalogueEvent = {
  id: string;
  kind: CatalogueEventKind;
  sector: SectorId;
  /** ISO — a stored Date is a string that only pretends to be one */
  at: string;
  /** what the act was about, in words */
  subject: string;
  /** what Rocoto had said, where a person re-grounded it */
  said?: string;
  /** how many products moved */
  count?: number;
  reason?: string;
};

/** The one sentence each event is read as, so the record and the screen say the same thing. */
export function eventSentence(e: CatalogueEvent): string {
  if (e.kind === 'grounded') {
    const what = (e.count ?? 1) > 1 ? `${e.count} products` : '1 product';
    return e.said
      ? `You moved ${what} to ${e.subject} · Rocoto had said ${e.said}`
      : `You moved ${what} to ${e.subject}`;
  }
  if (e.kind === 'adopted') return `${e.subject} joined the catalogue`;
  return `${e.subject} became a product of its own`;
}

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────── */

export const CATALOGUE_STORAGE_KEY = 'rocoto-app-catalogue';

/** A person's own grounding, and the node it replaced — kept together so the header shows its
 *  work (§1: a suggestion looks right, and shows its work underneath). */
export type Grounding = { node: string; said: string };

/* ── WHAT A PERSON PUT IN THE CATALOGUE THEMSELVES (FEED-IA §44.3) ────────────────────────────
 * «THE NEW PRODUCT MODAL carries its own depth: inside it, drag-and-drop for a CSV import, and
 * Connect to ERP so updates stream from the ERP as they happen.»
 *
 * A dropped CSV and a name typed by hand make the same thing: a product this house sells that
 * arrived through neither the upload nor an order. It is MINTED — the fourth way the catalogue
 * grows, beside adoption and graduation — and it is stored rather than derived, because a row a
 * person typed has no other home to be read back from.
 */
export type Minted = {
  /** `${sector}:${id}` */
  key: string;
  id: string;
  /** Literal house SKU where the source supplied one. The internal id may be encoded to stay route-safe. */
  code?: string;
  name: string;
  unit: string;
  /** A source price without a Product Unit is retained for review, never promoted to a tariff. */
  pendingPrice?: number;
  /** The family deliberately chosen for a manually created product. */
  family?: string;
  /** where it came from, so the row can say it in one word */
  source: 'hand' | 'csv';
};

/* ── A VARIATION A HAND WROTE (FEED-IA §75.6 · THE-OBJECT-MAP C6) ─────────────────────────────
 * «Adding variations should be a thing too.» An amendment is a word the traffic keeps saying and
 * the registry COUNTS it; this is the same shape put there deliberately, from the product's sheet
 * or from the family's own row. It is stored for the reason a minted product is stored: a thing a
 * person wrote has no traffic to be derived back out of.
 *
 * IT BECOMES AN AMENDMENT ON THE WAY OUT (`amendmentsOf`), so every reader downstream — the
 * catalogue row, the sheet, the graduation act — sees ONE kind of member and no surface has to
 * learn a second vocabulary for «the same thing, typed».
 */
export type Varied = {
  /** `${sector}:${baseId}:${word}` */
  key: string;
  id: string;
  sector: SectorId;
  /** Product.id it rides */
  base: string;
  baseName: string;
  /** the node the base grounds onto, read at the moment it was written */
  node: string;
  word: string;
};

export type CatalogueState = {
  version: number;
  /** `${sector}:${productId}` → where a person grounded it */
  grounded: Record<string, Grounding>;
  /** `${sector}:${itemId}` — uncoded SKUs adopted into the catalogue */
  adopted: string[];
  /** amendment and sort ids that became products of their own */
  graduated: string[];
  /** what a person wrote or imported into the catalogue themselves */
  minted: Minted[];
  /** the variations a hand added to a product it already sells (§75.6) */
  varied: Varied[];
  /* ── THE HOUSE'S OWN WORD FOR A PLAIN FORM (FEED-IA §79) ───────────────────────────────────
   * «You realise our catalog is a harness?» The reference supplies «entera» so a base member has
   * a word on the day the house has said nothing. The moment the house says one — typed on the
   * sheet, or carried in their own catalogue when the import maps that column — THEIRS renders
   * and the harness yields. `${sector}:${productId}` → their word. */
  named: Record<string, string>;
  events: CatalogueEvent[];
};

const EMPTY: CatalogueState = {
  version: CEDAR_CATALOGUE_PEN_VERSION,
  grounded: {}, adopted: [], graduated: [], minted: [], varied: [], named: {}, events: [],
};

export const keyOf = (sector: SectorId, id: string): string => `${sector}:${id}`;
/** Honest projection for old minted rows that predate mandatory category selection. */
export const UNCLASSIFIED_FAMILY = 'unclassified';

const isGrounding = (v: unknown): v is Grounding => {
  const x = v as Record<string, unknown> | null;
  return !!x && typeof x === 'object' && typeof x.node === 'string' && typeof x.said === 'string';
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];

function parse(raw: unknown): CatalogueState {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const r = migrateCatalogueCurrency(raw) as Record<string, unknown>;
  if (r.version !== CEDAR_CATALOGUE_PEN_VERSION) return EMPTY;
  const grounded: Record<string, Grounding> = {};
  if (r.grounded && typeof r.grounded === 'object') {
    for (const [k, v] of Object.entries(r.grounded as Record<string, unknown>)) if (isGrounding(v)) grounded[k] = v;
  }
  const events = Array.isArray(r.events)
    ? (r.events.filter((e) => {
        const x = e as Record<string, unknown> | null;
        return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.subject === 'string';
      }) as CatalogueEvent[])
    : [];
  const minted = Array.isArray(r.minted)
    ? (r.minted.filter((m) => {
        const x = m as Record<string, unknown> | null;
        return !!x && typeof x === 'object' && typeof x.key === 'string' && typeof x.id === 'string'
          && typeof x.name === 'string' && typeof x.unit === 'string'
          && (x.code === undefined || typeof x.code === 'string')
          && (x.family === undefined || typeof x.family === 'string')
          && (x.pendingPrice === undefined || (typeof x.pendingPrice === 'number' && Number.isFinite(x.pendingPrice) && x.pendingPrice > 0));
      }) as Minted[])
    : [];
  const varied = Array.isArray(r.varied)
    ? (r.varied.filter((v) => {
        const x = v as Record<string, unknown> | null;
        return !!x && typeof x === 'object' && typeof x.key === 'string' && typeof x.id === 'string'
          && typeof x.base === 'string' && typeof x.word === 'string' && typeof x.node === 'string';
      }) as Varied[])
    : [];
  const named: Record<string, string> = {};
  if (r.named && typeof r.named === 'object') {
    for (const [k, v] of Object.entries(r.named as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) named[k] = v.trim();
    }
  }
  return {
    version: CEDAR_CATALOGUE_PEN_VERSION,
    grounded, adopted: strings(r.adopted), graduated: strings(r.graduated), minted, varied, named, events,
  };
}

function read(): CatalogueState {
  try {
    const encoded = window.localStorage.getItem(CATALOGUE_STORAGE_KEY);
    if (!encoded) return EMPTY;
    const source: unknown = JSON.parse(encoded);
    const migrated = migrateCatalogueCurrency(source);
    const parsed = parse(migrated);
    if (migrated !== source) {
      try {
        window.localStorage.setItem(CATALOGUE_STORAGE_KEY, JSON.stringify(parsed));
      } catch (error) {
        console.warn('Rocoto will retry the catalogue currency upgrade on the next boot', error);
      }
    }
    return parsed;
  } catch {
    return EMPTY;
  }
}

function write(next: CatalogueState): void {
  try {
    window.localStorage.setItem(CATALOGUE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error('Saving the catalogue change stalled. Your existing catalogue stands as it was. Keep your description and try again.');
  }
}

let STATE: CatalogueState = typeof window === 'undefined' ? EMPTY : read();

const listeners = new Set<() => void>();

const publish = (next: CatalogueState): void => {
  write(next);
  STATE = next;
  for (const l of listeners) l();
};

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const snapshot = (): CatalogueState => STATE;

let seq = 0;
const nextId = (): string => `cat-${Date.now().toString(36)}-${++seq}`;

const stamp = (): string => new Date().toISOString();

/* ── THE ACTS ─────────────────────────────────────────────────────────────────────────────── */

/**
 * Re-ground a category onto another node.
 *
 * THE CORRECTION IS ON THE GROUNDING, NOT ON ONE ITEM. The model grounded these together — one
 * reading, one act — so putting them right is one act too, and the event records how many moved.
 * That is also the honest reading of what a person is doing when they say «no, these are Marisco».
 */
export function reground(sector: SectorId, members: Array<{ id: string; said: string }>, node: string, reason?: string): void {
  if (!members.length) return;
  const grounded = { ...STATE.grounded };
  for (const m of members) grounded[keyOf(sector, m.id)] = { node, said: m.said };
  publish({
    ...STATE,
    grounded,
    events: [
      ...STATE.events,
      {
        id: nextId(),
        kind: 'grounded',
        sector,
        at: stamp(),
        subject: nameOfNode(node),
        said: members[0].said,
        count: members.length,
        reason: reason?.trim() || undefined,
      },
    ],
  });
}

/** Adopt an uncoded SKU. It takes a card of its own, with its price and its rules. */
export function adopt(sector: SectorId, item: OffListItem): void {
  const key = keyOf(sector, item.id);
  if (STATE.adopted.includes(key)) return;
  publish({
    ...STATE,
    adopted: [...STATE.adopted, key],
    events: [...STATE.events, { id: nextId(), kind: 'adopted', sector, at: stamp(), subject: item.name }],
  });
}

/**
 * MINT — the products a person wrote or dropped in (§44.3).
 *
 * One act for one press, however many rows it carries: a CSV of forty is one moment in the record,
 * because that is what happened. A name the catalogue already holds stands as it is; nothing here
 * overwrites goods that already exist.
 */
export function mint(sector: SectorId, items: Array<{ id: string; code?: string; name: string; unit: string; price?: number; family?: string }>, source: Minted['source']): void {
  const held = new Set(STATE.minted.map((m) => m.key));
  const fresh = items
    .map((i) => ({ key: keyOf(sector, i.id), id: i.id, code: i.code, name: i.name, unit: i.unit, ...(i.unit.trim() || i.price === undefined ? {} : { pendingPrice: i.price }), family: i.family, source }))
    .filter((m) => !held.has(m.key));
  if (fresh.length === 0) return;
  publish({
    ...STATE,
    minted: [...STATE.minted, ...fresh],
    events: [
      ...STATE.events,
      {
        id: nextId(),
        kind: 'adopted',
        sector,
        at: stamp(),
        subject: fresh.length === 1 ? fresh[0].name : `${fresh.length} products`,
        count: fresh.length,
      },
    ],
  });
}

/** What this house has minted, in the order it arrived. */
export const mintedOf = (sector: SectorId, state: CatalogueState): Minted[] =>
  state.minted.filter((m) => m.key.startsWith(`${sector}:`));

/** A sparse imported SKU may retain a source amount, but no tariff exists until it has a price unit. */
export const pendingImportedPrice = (sector: SectorId, id: string, state: CatalogueState = STATE): number | undefined =>
  mintedOf(sector, state).find((item) => item.id === id)?.pendingPrice;

/**
 * ADD A VARIATION (§75.6 · C6) — the same shape `adopt` and `graduate` already produce.
 *
 * One press writes one member onto a family: the word, the base it rides, and the node the base
 * grounds onto so the member files exactly where its family files. A word the family already
 * carries does nothing rather than growing a second row with the same syllable on it.
 */
/** Resolves an already-known variation without writing catalogue state. */
export function variationIdOf(
  sector: SectorId,
  base: { id: string },
  word: string,
  state: CatalogueState = STATE,
): string | undefined {
  const said = word.trim();
  if (!said) return undefined;
  const key = `${sector}:${base.id}:${said.toLowerCase()}`;
  return state.varied.find((v) => v.key === key)?.id
    ?? AMENDMENTS.find((a) => a.sector === sector && a.base === base.id && a.word.toLowerCase() === said.toLowerCase())?.id;
}

export function vary(
  sector: SectorId,
  base: { id: string; name: string },
  node: string,
  word: string,
  proposedId?: string,
): string | undefined {
  const said = word.trim();
  if (!said) return;
  const known = variationIdOf(sector, base, said);
  if (known) {
    /* The registry's own observed phrase keeps its identity. This legacy caller still adopts it
       here; identity-first creation resolves it before this write and then reaches this branch. */
    const seeded = AMENDMENTS.find((a) => a.id === known);
    if (seeded && !seeded.sellable) graduate(sector, seeded.id, `${base.name} · ${said}`);
    return known;
  }
  const key = `${sector}:${base.id}:${said.toLowerCase()}`;
  const id = proposedId ?? `va-${sector}-${base.id}-${STATE.varied.length + 1}`;
  if (STATE.varied.some((v) => v.id === id))
    throw new Error('This variation identity is already in use. Keep the draft open and try again.');
  publish({
    ...STATE,
    varied: [
      ...STATE.varied,
      { key, id, sector, base: base.id, baseName: base.name, node, word: said },
    ],
    events: [
      ...STATE.events,
      { id: nextId(), kind: 'adopted', sector, at: stamp(), subject: `${base.name} · ${said}` },
    ],
  });
  return id;
}

/** The variations this house wrote itself, as the amendments they are. */
export const variedOf = (sector: SectorId, state: CatalogueState): Amendment[] =>
  state.varied
    .filter((v) => v.sector === sector)
    .map<Amendment>((v) => ({
      id: v.id,
      sector: v.sector,
      base: v.base,
      baseName: v.baseName,
      node: v.node,
      facet: 'preparation',
      word: v.word,
      times: 0,
      hand: true,
    }));

/** Graduate an amendment or a learned sort: the catalogue grows the way the house talks (§2). */
export function graduate(sector: SectorId, id: string, name: string): void {
  if (STATE.graduated.includes(id)) return;
  publish({
    ...STATE,
    graduated: [...STATE.graduated, id],
    events: [...STATE.events, { id: nextId(), kind: 'graduated', sector, at: stamp(), subject: name }],
  });
}

/* ── THE READ ─────────────────────────────────────────────────────────────────────────────── */

/** Where one product sits on the tree, and whose reading that is. */
export type Ground = {
  /** the node the goods themselves land on — as deep as the name supports */
  node: string;
  /** the node the HOUSE keeps its shelf at, which may be shallower */
  shelf: string;
  /** the word on the screen: the house's own where the upload had one, Rocoto's node otherwise */
  name: string;
  /** Rocoto chose it, so it wears the mark and offers the re-grounding (§1) */
  guessed: boolean;
  /** what Rocoto had said, where a person has already moved it */
  said?: string;
};

/**
 * Where one product stands.
 *
 * FOUR READINGS, IN THIS ORDER: a person's own grounding wins; a graduated product goes where its
 * base goes, because it IS its base more precisely named; the upload's own word comes next, and it
 * keeps the house's vocabulary on the screen; and Rocoto's grounding is what is left. Only the
 * last one wears the mark.
 */
export function groundOf(cast: Cast, product: Product, state: CatalogueState): Ground {
  const level = HOUSE_RESOLUTION[cast.sector];
  const deep = graduatedNode(product.id) ?? ground(product.name, product.family);

  const own = state.grounded[keyOf(cast.sector, product.id)];
  if (own) return { node: deep, shelf: own.node, name: nameOfNode(own.node), guessed: false, said: own.said };

  const parent = graduatedBase(product.id);
  if (parent) {
    const base = cast.products.find((p) => p.id === parent);
    if (base) {
      const inherited = groundOf(cast, base, state);
      return { ...inherited, node: deep };
    }
  }

  const arrived = FILED_ON_ARRIVAL[cast.sector]?.[product.id];
  if (arrived) return { node: deep, shelf: arrived.node, name: arrived.word, guessed: false };

  const shelf = liftTo(deep, level);
  return { node: deep, shelf, name: nameOfNode(shelf), guessed: true };
}

export type Group = {
  /** the node the house keeps this shelf at — and the group's identity */
  shelf: string;
  /** the word on the header */
  name: string;
  /** every member was put here by Rocoto, so the header offers the re-grounding */
  guessed: boolean;
  /** what Rocoto had said about this group, where a person has moved it */
  said?: string;
  /** the kinds Rocoto knows apart underneath this one shelf (§10.1's collapse) */
  collapsed: string[];
  members: Product[];
};

/**
 * The SKUs, grouped by the node the house keeps them at.
 *
 * THE ORDER IS THE ORDER THE PRODUCTS ARRIVE IN, not alphabetical: a catalogue read top to bottom
 * should look like the list the house handed over, with its shelves drawn around it.
 *
 * `collapsed` is what makes the resolution visible. Two SKUs Rocoto knows as Merluza and Rape
 * sitting on one «Pescado fresco» shelf is not a mistake — it is the house's own world — and the
 * header can say so, which is how a person finds out that a finer shelf is one tap away.
 */
export function groupsOf(cast: Cast, products: Product[], state: CatalogueState): Group[] {
  const out: Group[] = [];
  for (const product of products) {
    const g = groundOf(cast, product, state);
    const held = out.find((x) => x.shelf === g.shelf && x.name === g.name);
    const kind = g.node !== g.shelf ? nameOfNode(g.node) : '';
    if (held) {
      held.members.push(product);
      held.guessed = held.guessed && g.guessed;
      held.said = held.said ?? g.said;
      if (kind && !held.collapsed.includes(kind)) held.collapsed.push(kind);
    } else {
      out.push({
        shelf: g.shelf,
        name: g.name,
        guessed: g.guessed,
        said: g.said,
        collapsed: kind ? [kind] : [],
        members: [product],
      });
    }
  }
  /* one kind under a shelf is not a collapse, it is a shelf with one thing on it */
  return out.map((g) => ({ ...g, collapsed: g.collapsed.length > 1 ? g.collapsed : [] }));
}

/** THE MEMBERS OF EVERY FAMILY IN THIS HOUSE (§75.6) — the words the traffic keeps saying AND the
 *  ones a hand wrote, in one stream, minus the ones that already became products of their own. The
 *  two sources are one kind on the way out: a surface never learns a second vocabulary. */
export const amendmentsOf = (sector: SectorId, state: CatalogueState): Amendment[] =>
  [...AMENDMENTS.filter((a) => a.sector === sector), ...variedOf(sector, state)]
    .filter((a) => !state.graduated.includes(a.id));

/** The sorts written on past albaranes, minus the ones already adopted. */
export const sortsOf = (sector: SectorId, state: CatalogueState): LearnedSort[] =>
  SORTS.filter((s) => s.sector === sector && !state.graduated.includes(s.id));

/** THE MEMBERS THIS HOUSE HAS GRADUATED, AS PRODUCTS (§75.6 · C7). A graduated amendment and a
 *  graduated sort are things the house SELLS — so the sale side has to be able to reach them by
 *  name, not only the shelf that made them. Held apart from `grownProducts` because that one also
 *  needs the off-list, and a document composer holds a word and no off-list. */
export const graduatedProducts = (cast: Cast, state: CatalogueState): Product[] =>
  state.graduated
    .map((id) => graduatedProduct(cast, id))
    .filter((p): p is Product => !!p && sectorOfGraduated(p.id) === cast.sector);

/** Everything this catalogue has grown, as products: adopted uncoded SKUs and graduated rows. */
export function grownProducts(cast: Cast, offList: OffListItem[], state: CatalogueState): Product[] {
  const adopted = offList
    .filter((i) => state.adopted.includes(keyOf(cast.sector, i.id)))
    .map<Product>((item) => ({
      id: item.id,
      name: item.name,
      provisional: item.provisional,
      /* the ambient family is the profile that records no lote, which is the truth about ice and
         parsley — the same reading `stock.tsx` has always given an adopted thing */
      family: cast.families[cast.families.length - 1].id,
      unit: item.unit,
      variableWeight: false,
      trace: {},
    }));

  const graduated = graduatedProducts(cast, state);

  /* WHAT A PERSON PUT IN THEMSELVES (§44.3) — a minted row is a product like any other: it takes a
     price, a rule and a lot book, and it grounds onto the tree by its own name. */
  const minted = mintedOf(cast.sector, state).map<Product>((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    provisional: true,
    family: m.family?.trim() || UNCLASSIFIED_FAMILY,
    unit: m.unit,
    variableWeight: m.unit === 'kg',
    trace: {},
  }));

  return [...adopted, ...graduated, ...minted];
}

/** Has this uncoded SKU been adopted? */
export const isAdopted = (state: CatalogueState, sector: SectorId, id: string): boolean =>
  state.adopted.includes(keyOf(sector, id));

export type CatalogueApi = {
  state: CatalogueState;
  /** the products a person wrote or dropped in (§44.3) */
  mint: (sector: SectorId, items: Array<{ id: string; code?: string; name: string; unit: string; price?: number; family?: string }>, source: Minted['source']) => void;
  /** move a whole guessed shelf to another node on the tree */
  reground: (sector: SectorId, members: Array<{ id: string; said: string }>, node: string, reason?: string) => void;
  adopt: (sector: SectorId, item: OffListItem) => void;
  graduate: (sector: SectorId, id: string, name: string) => void;
  /** add a member to a family a person is standing in front of (§75.6) */
  vary: (sector: SectorId, base: { id: string; name: string }, node: string, word: string, proposedId?: string) => string | undefined;
};

/** The one hook every surface reads. A screen never holds a node. */
export function useCatalogue(): CatalogueApi {
  const state = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  return React.useMemo<CatalogueApi>(() => ({ state, reground, adopt, graduate, mint, vary }), [state]);
}

/* ═══ THE WRITING LINE'S PARSE (THE-DENSE-BRIEF-DESIGN §10, THE-INTELLIGENCE §10.4) ═══════════
 * «Let them WRITE freely — the system understands which part is which, so a typo knows what part
 * it belongs to, the icons adapt, and edits are rapid and clean» (musing 6).
 *
 * THE PARSE IS A GROUNDING, NOT A SEARCH. Tokens claim nodes of the tree Rocoto brought and words
 * of closed registers, exactly as the router's first hop does — so the picker and the order-reading
 * brain are the same machine seen from a keyboard. What no register claims is the residue, and the
 * residue is the word that rides the name (the amendment machinery, §2).
 *
 * WHY THE PARTS ARE PARSED SEPARATELY, AND WHY THAT IS THE WHOLE TYPO ANSWER (§10 «the unstated
 * parts»): edit distance against 3 class words or ~8 sibling sorts is safe where edit distance
 * against 300 flat SKUs is not. So each part is fuzzy-matched ONLY against its own candidate set,
 * and a misspelling therefore resolves inside the part it was written in — «de pinsho» moves the
 * SORT and cannot touch the KIND.
 *
 * THE LADDER IT SPEAKS (THE-DENSE-BRIEF §C): L0 family · L1 kind · L2 sort · L3 form/prep ·
 * L4 grade. The kind and the sort are nodes; the grade is a closed register; the form/prep and
 * anything else are words.
 */

/** Accents folded, case dropped — the one normalizer both the parse and the paintings use. */
export const foldWord = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Levenshtein, capped — the only distance this file needs, over words of trade length. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return 9;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const row = [i];
    for (let j = 1; j <= n; j += 1) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[n];
}

/** HOW WRONG A WORD MAY BE AND STILL BE THAT WORD. Short words get no slack — «a» and «b» are
 *  class letters and one edit apart — and long ones get two, which is a comercial's real typo. */
const slack = (word: string): number => (word.length <= 3 ? 0 : word.length <= 6 ? 1 : 2);

/** Does this written word claim that register word? Prefixes count: a person who typed «merlu» and
 *  is still typing has already said which kind it is. */
export function claims(written: string, target: string): boolean {
  const w = foldWord(written);
  const t = foldWord(target);
  if (!w || !t) return false;
  if (w === t) return true;
  if (w.length >= 4 && t.startsWith(w)) return true;
  return distance(w, t) <= slack(t);
}

/** The words a phrase is made of, minus the trade's own joining words. «de pincho» is claimed by
 *  «pincho», because that is what a person types when they are moving fast. */
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'al']);

/* THE FUZZY CANDIDATE SET, indexed on the first three letters of every carrying word of a node's
 * name. It is what lets a typo still reach its node once the tree is thousands of rows: a written
 * word is compared against a few dozen look-alikes instead of against everything. */
const BY_HEAD = ((): Map<string, TreeNode[]> => {
  const out = new Map<string, TreeNode[]>();
  for (const n of TREE) {
    for (const w of foldWord(n.name).split(' ')) {
      if (w.length < 3 || STOP.has(w)) continue;
      const key = w.slice(0, 3);
      const held = out.get(key);
      if (held) { if (!held.includes(n)) held.push(n); } else out.set(key, [n]);
    }
  }
  return out;
})();

/** The nodes a written word could still have meant, once its first three letters are believed. */
const nearWord = (written: string): TreeNode[] => BY_HEAD.get(foldWord(written).slice(0, 3)) ?? [];

const meat = (phrase: string): string[] =>
  foldWord(phrase).split(' ').filter((w) => w.length > 0 && !STOP.has(w));

/** Does a written token claim any word of this phrase? EXPORTED because the document's own writing
 *  line resolves phrases with the identical rule — one claim algorithm, two callers. */
export const claimsPhrase = (written: string, phrase: string): boolean =>
  meat(phrase).some((w) => claims(written, w));

/* ── WHAT THE REFERENCE KNOWS A ROW TO BE (FEED-IA §62.1 · §65.3 — AUDIT-2 C26) ───────────────
 * «Their own names, our recognition»: the words on a house's row are the house's, and underneath
 * them the reference already holds what the thing IS — «Merluza» sits on «Pescado blanco», which
 * sits on «Pescado y marisco». A search that reads only the row's own characters cannot answer a
 * word the reference knows and the house never typed, so this hands back the reference's own
 * words for a node — its name and the names it hangs under — for a caller to search beside the
 * house's.
 *
 * IT NEVER RENAMES ANYTHING (§65.3). These words are a way IN, not a label: the row still draws
 * exactly the characters the house wrote. The joining words are dropped for the same reason the
 * claim algorithm drops them — «de» finds nothing and would match everything.
 */
export function readingWordsOf(node: string | undefined): string[] {
  if (!node) return [];
  const here = BY_ID.get(node);
  if (!here) return [];
  const out = new Set<string>();
  for (const n of [here, ...ancestorsOf(node)]) {
    for (const w of foldWord(n.name).split(' ')) {
      if (w.length > 0 && !STOP.has(w)) out.add(w);
    }
  }
  return [...out];
}

/* ── WHAT A WRITTEN LINE DECOMPOSES INTO ──────────────────────────────────────────────────── */

/** which part of the ladder a piece of the written string landed in */
/* ⚠ `class` LEFT THIS UNION (FEED-IA §197.2, §193.4): a written line decomposes into the kind,
   the sort, the calibre band, the amount and the comment — never a grade. */
export type WrittenPart = 'kind' | 'sort' | 'comment' | 'amount' | 'calibre';

/* ── THE CALIBRE BAND, AS A SYNTAX (THE-STANDARD-CATALOG §8.5) ────────────────────────────────
 * The first never-surprised exam scored all 13 rows of a real LUBINA/DORADA price sheet PARTIAL
 * for one reason: «the calibre band — the commercial identity of a farmed fish — has no home», and
 * `parseWritten` could not even reach it, because `qty` reads a LEADING number and «8+» matches no
 * number syntax at all. A band is not a word out of a list. It is a shape:
 *
 *   `2-3`  `2,5-5`   a RANGE of piece weights, the kilos-per-piece band a farm sells by
 *   `8+`   `+5`      an OPEN band, everything above the number
 *   `30/40`          a COUNT band, pieces per kilo — the gamba and langostino way of saying it
 *
 * AND THE DIRT, JUDGED HONESTLY. The sheet we hold lost its hyphens in transit: «LUBINA 23» is the
 * 2–3 band and «LUBINA 15» is either the 1–5 band or 1,5 kg, and §8.5 is explicit that «a number
 * parse cannot tell band from quantity; only the fish-trade convention can». So the lost-hyphen
 * reading is taken ONLY where the trade convention holds it up — a two-digit number, both digits
 * 1–9 and ascending, standing after a kind whose family prices by weight bands, and never in the
 * leading position where it would be a quantity. It is returned FLAGGED `ambiguous`, because a
 * reading that had to guess should say so rather than pass as a measurement.
 */
export type Band = {
  /** the band as it should be written back — «2-3», «8+», «30/40» */
  value: string;
  kind: 'range' | 'open' | 'count';
  /** the hyphen was lost and the trade convention supplied it (§8.1's pegado.txt) */
  ambiguous?: boolean;
};

const num = (s: string): string => s.replace(',', '.');

export function readBand(said: string, lostHyphen: boolean): Band | undefined {
  const t = said.trim();
  let m = /^\+?(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/.exec(t);
  if (m) return { value: `${num(m[1])}-${num(m[2])}`, kind: 'range' };
  m = /^(\d+(?:[.,]\d+)?)\+$/.exec(t) ?? /^\+(\d+(?:[.,]\d+)?)$/.exec(t);
  if (m) return { value: `${num(m[1])}+`, kind: 'open' };
  m = /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(t);
  if (m) return { value: `${m[1]}/${m[2]}`, kind: 'count' };
  if (lostHyphen && /^\d{2}$/.test(t) && t[0] !== '0' && t[1] !== '0' && t[1] > t[0]) {
    return { value: `${t[0]}-${t[1]}`, kind: 'range', ambiguous: true };
  }
  return undefined;
}

/** The families that price by a band, off the reference's own register (§2.3). */
export const bandsFor = (node: string): Dimension['bands'] | undefined =>
  CALIBRE_FAMILIES[familyOfNode(node)] as Dimension['bands'] | undefined;

export type Written = {
  /** L1 · the kind: the node the words landed on, with the word that claimed it */
  kind?: { node: string; name: string; said: string };
  /** L2 · the sort: the variety, origin or method that changes the name or the price */
  sort?: { node?: string; name: string; said: string };
  /** L4 · the calibre band, where the family prices by one (§8.5) */
  calibre?: Band & { said: string };
  /** L3 and the residue: the words no register claimed. They ride the name as the amendment. */
  comment?: string;
  /** a leading number, and the unit written beside it */
  qty?: number;
  unit?: string;
  /** every word, in writing order, with the part it landed in — the chips read off this */
  placed: Array<{ said: string; part: WrittenPart }>;
};

/** The units a person writes beside a number. A word this list has no row for stays a word. */
const UNIT_WORDS: Record<string, string> = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', k: 'kg',
  g: 'g', gr: 'g', gramos: 'g',
  ud: 'ud', uds: 'ud', unidad: 'ud', unidades: 'ud', pieza: 'ud', piezas: 'ud',
  caja: 'caja', cajas: 'caja',
  l: 'l', litro: 'l', litros: 'l',
};

/**
 * THE CLAIM ALGORITHM, in the design's own order (§10): the amount, then the sort against the
 * kind's own neighbourhood, then the kind against the tree; whatever is left over is the comment.
 *
 * ⚠ THE GRADE CLAIM WENT FIRST AND IS NOW GONE (FEED-IA §197.2 «Remove class everywhere»,
 * §193.4). A grade word is left to the comment, which is where a word the registers do not own
 * has always gone.
 *
 * The kind is claimed BEFORE the sort in code because a sort's candidate set is the kind's own
 * children; the order in the doctrine is the order of CHEAPNESS, and this is the order of
 * dependency. Both end in the same place: every part judged against its own register only.
 */
export function parseWritten(
  text: string,
  registers: {
    /** the sector, so the learned sorts of another house's catalogue never appear */
    sector: SectorId;
    /** the family the writer is in, where the words alone place nothing */
    family?: string;
    /* THE EDIT PATH'S PRE-CLAIMED KIND (§10, «rapid clean edits»). Editing an existing line, the
       kind is already decided by the line — so the written words are judged INSIDE it and can only
       move the sort or the comment. That is what makes «a typo in de pincho edits the
       sort, never the kind» true by construction rather than by luck. */
    within?: { node: string; name: string };
  },
): Written {
  const raw = text.trim().split(/\s+/).filter(Boolean);
  const open = raw.map((said) => ({ said, taken: false }));
  const out: Written = { placed: [] };

  const take = (i: number, part: WrittenPart): string => {
    open[i].taken = true;
    out.placed.push({ said: open[i].said, part });
    return open[i].said;
  };

  /* 1 · THE AMOUNT — a leading number, and the unit written beside it. «5 kg merluza» */
  const first = open[0];
  if (first && /^\d+([.,]\d+)?$/.test(first.said)) {
    out.qty = Number(first.said.replace(',', '.'));
    take(0, 'amount');
    const next = open[1];
    const unit = next ? UNIT_WORDS[foldWord(next.said)] : undefined;
    if (unit) {
      out.unit = unit;
      take(1, 'amount');
    }
  }

  /* 3 · THE KIND — the tree, at the words' own depth. A type beats a category, so «merluza» lands
     on the hake and not on the whitefish shelf above it. A line already standing on the albarán
     brings its own kind, and then this step does not run at all. */
  const RANKED: NodeLevel[] = ['type', 'sort', 'category', 'family'];
  let claimed: { node: TreeNode; at: number } | undefined;
  if (registers.within) {
    out.kind = { ...registers.within, said: '' };
  } else {
    /* THE LEXICON FIRST, AND IT IS ALSO WHAT KEEPS THIS FAST. A scan of every node of a
       thousands-strong tree at every keystroke would be the one thing the growth broke; an exact
       map lookup over the surfaces answers the large majority for free (§4.3's «retrieval-first,
       model-second»), and only the residue meets the fuzzy pass. */
    const read = readLexicon(text, registers.family ? FAMILY_OF_SECTOR[registers.family] : undefined);
    if (read) {
      const node = BY_ID.get(read.node);
      if (node) {
        const at = open.findIndex((t, i) => !t.taken && i >= read.at);
        claimed = { node, at: at < 0 ? read.at : at };
      }
    }
    /* THE FUZZY PASS, over the nodes a typo could still have meant. «merlusa» reaches Merluza
       because they share their first three letters, and the candidate set is those nodes and no
       wider — edit distance against three class words or a handful of look-alike names is safe
       where edit distance against the whole encyclopedia is not (§10's own reasoning, one level
       up). A typo in the FIRST THREE letters is not reached, and that is the honest limit. */
    for (const level of RANKED) {
      if (claimed) break;
      for (let i = 0; i < open.length && !claimed; i += 1) {
        if (open[i].taken) continue;
        const node = nearWord(open[i].said).find((n) => n.level === level && claimsPhrase(open[i].said, n.name));
        if (node) claimed = { node, at: i };
      }
    }
  }
  if (claimed) {
    /* the kind is the TYPE the words support — a sort node written whole («pulpo de roca») names
       its parent as the kind and itself as the sort, which is what the chips have to say */
    const node = claimed.node;
    const kindNode = node.level === 'sort' ? parentOf(node.id) ?? node : node;
    out.kind = { node: kindNode.id, name: kindNode.name, said: take(claimed.at, 'kind') };
    if (node.level === 'sort') out.sort = { node: node.id, name: residueOfName(node.name, kindNode.name), said: out.kind.said };
  }

  /* 3b · THE CALIBRE BAND. It runs after the kind because the kind decides whether this family
     prices by a band at all — «GAMBA 30/40» is a count and «CAJA 30/40» is nothing. It runs before
     the sort so a band can never be eaten as one, and it never touches index 0, which belongs to
     the amount. */
  if (out.kind) {
    const bands = bandsFor(out.kind.node);
    for (let i = 1; i < open.length && !out.calibre && bands; i += 1) {
      if (open[i].taken) continue;
      const band = readBand(open[i].said, bands === 'weight');
      if (band) out.calibre = { ...band, said: take(i, 'calibre') };
    }
  }

  /* 4 · THE SORT — the kind's own descendants and the sorts the house's albaranes prove, and no
     wider set than that. This is why «de pinsho» can only ever move the sort.
     THE LONGEST SORT WINS: «rama griego» is a finer thing than «rama», so a person who wrote both
     words gets both, and a person who wrote one gets the one they wrote. */
  if (out.kind && !out.sort) {
    const kindName = out.kind.name;
    const under = (id: string): boolean =>
      id === out.kind!.node || ancestorsOf(id).some((a) => a.id === out.kind!.node);
    const candidates: Array<{ node?: string; name: string }> = [
      ...TREE.filter((n) => n.level === 'sort' && under(n.id)).map((n) => ({
        node: n.id,
        name: residueOfName(n.name, kindName),
      })),
      ...SORTS.filter((s) => s.sector === registers.sector && under(s.node)).map((s) => ({
        node: s.node,
        name: residueOfName(s.name, kindName),
      })),
    ].sort((a, b) => meat(b.name).length - meat(a.name).length);

    for (const c of candidates) {
      if (out.sort) break;
      const words = meat(c.name);
      if (words.length === 0) continue;
      for (let i = 0; i < open.length && !out.sort; i += 1) {
        /* the words of a sort are written consecutively, and the trade's joining words in between
           are joining words, not evidence — «de pincho» and «pincho» are the same claim */
        const run: number[] = [];
        let at = i;
        for (const w of words) {
          while (at < open.length && (open[at].taken || STOP.has(foldWord(open[at].said)))) at += 1;
          if (at >= open.length || !claims(open[at].said, w)) break;
          run.push(at);
          at += 1;
        }
        if (run.length !== words.length) continue;
        const said = run.map((k) => take(k, 'sort')).join(' ');
        out.sort = { node: c.node, name: c.name, said };
      }
    }
  }

  /* «de pincho» is two words, and the joining word joins the sort it was written for — so it never
     falls through to the comment and prints «· de» on the albarán. */
  if (out.sort && out.sort.said) {
    const at = open.findIndex((t) => t.said === out.sort!.said);
    const before = open[at - 1];
    if (before && !before.taken && STOP.has(foldWord(before.said))) {
      out.sort.said = `${take(at - 1, 'sort')} ${out.sort.said}`;
    }
  }

  /* 5 · THE RESIDUE — whatever no register claimed. It is the word that rides the name. */
  const rest = open.filter((t) => !t.taken);
  rest.forEach((t) => take(open.indexOf(t), 'comment'));
  const comment = rest.map((t) => t.said).join(' ').trim();
  if (comment) out.comment = comment;

  /* the chips read in writing order, never in the order the algorithm happened to claim them */
  out.placed.sort((a, b) => raw.indexOf(a.said) - raw.indexOf(b.said));
  return out;
}

/** «Pulpo de roca» under «Pulpo» is «de roca» — the base is already said by the kind chip, and a
 *  sort chip that repeated it would print the product's name twice. */
export function residueOfName(full: string, base: string): string {
  const f = foldWord(full);
  const b = foldWord(base);
  if (b && f.startsWith(b) && full.length > base.length) return full.slice(base.length).trim();
  return full;
}

/** The name a written line resolves to — what the painting and the candidates are looked up by. */
export const writtenName = (w: Written): string =>
  [w.kind?.name, w.sort?.name].filter(Boolean).join(' ').trim();

/** The catalogue row a claimed kind lands on, where the house has one. A house that sells no such
 *  thing gets nothing back, and the house's own posture decides what happens then (§10, grants). */
export function productForNode(cast: Cast, node: string): Product | undefined {
  const exact = cast.products.find((p) => ground(p.name, p.family) === node);
  if (exact) return exact;
  const name = nameOfNode(node);
  return cast.products.find((p) => claimsPhrase(p.name.split(/\s+/)[0], name));
}

/* ── L3 · THE FORM AND PREP VOCABULARY (THE-DENSE-BRIEF §C, §6) ───────────────────────────────
 * The words the prep note suggests: how the thing is packed and prepped when it leaves the house.
 *
 * THE NO-WORD-TWICE LAW, MADE MECHANICAL (§6): «a word that changes what the thing IS rides the
 * name as the amendment chip; a phrase about packing sits under the title as the note — no word
 * appears in both places on one line.» So the vocabulary is filtered against the amendment
 * registry at read time rather than kept apart by hand: a word that graduates into an amendment
 * leaves the prep list in the same breath.
 */
const PREP_WORDS: Record<string, string[]> = {
  'n-fish': ['entero', 'eviscerado', 'en lomos', 'en filetes', 'en rodajas', 'en hielo', 'al vacío por separado'],
  'n-meat': ['en piezas', 'picada', 'fileteada', 'atada', 'al vacío por separado', 'en bandeja'],
  'n-produce': ['en caja de madera', 'en malla', 'ramos atados', 'sin apilar', 'papel entre capas'],
  'n-ambient': ['en saco', 'en bolsa'],
};

/** The prep words for a node — the family's own, minus anything the amendment registry claims and
 *  minus anything the PREPARATION dimension claims (§41.1, the same no-word-twice law one level
 *  up: «en filetes» is what the goods ARE, so it is a dimension, and the note keeps the words that
 *  are genuinely about packing — «en hielo», «al vacío por separado»). */
export function prepWordsFor(sector: SectorId, node: string): string[] {
  const family = [nodeOf(node), ...ancestorsOf(node)].find((n) => n?.level === 'family');
  const words = PREP_WORDS[family?.id ?? 'n-ambient'] ?? [];
  const taken = new Set([
    ...AMENDMENTS.filter((a) => a.sector === sector).map((a) => foldWord(a.word)),
    ...Object.values(PREPARATION).flat().map(foldWord),
  ]);
  return words.filter((w) => !taken.has(foldWord(w)));
}

/* ═══ THE DIMENSIONS THE LADDER GROWS (FEED-IA §41.1) ═════════════════════════════════════════
 * «The ladder grows dimensions by family: fruit/veg get MATURITY (customers specify it — "mature
 * bananas"); fish/meat get PREPARATION (chopped or not), STATE (alive · fresh · frozen) and AGING
 * where it applies. Houses that never prep simply never touch the dropdown — the option's presence
 * costs them nothing.»
 *
 * ═══ A DIMENSION IS A CLOSED REGISTER, AND THAT IS WHY IT IS NOT AN AMENDMENT (§2) ══════════
 * An amendment is FREE WORDS the house happened to say: it is counted, it graduates into a product
 * of its own, and it may be anything at all. A dimension is a fact about the goods whose values are
 * KNOWN — the same handful for every house in the family — so it is a field with a register rather
 * than a word riding the name. Two lines that both say «congelado» are then the same fact, and the
 * app can count them, group them, price them and print them as one thing; two lines carrying the
 * free word «congelado» are two strings that happen to match today.
 *
 * ═══ THE REGISTER IS PER FAMILY, BECAUSE THE WORDS ARE ══════════════════════════════════════
 * A fish is alive or it is not; a pork loin never was. So «vivo» stands on the fish register and is
 * absent from the meat one — rather than both families sharing one list with a word one of them can
 * never truthfully use. The same holds for preparation: fish is filleted into lomos and rodajas,
 * meat is picada and deshuesada, and a shared list would make each house read past half of it.
 *
 * ═══ AN UNUSED DIMENSION COSTS NOTHING, MECHANICALLY ════════════════════════════════════════
 * «Houses that never prep simply never touch the dropdown.» A value nobody set draws NOTHING on the
 * line — no slot, no placeholder, no empty field — and the register stands only while the line's
 * own editor is open. So a house that sells whole fish and nothing else never meets the word.
 *
 * ═══ AND THERE IS NO CLASS BESIDE THEM ANY MORE (FEED-IA §197.2, §193.4) ════════════════════
 * §41.2's «first/second class exists as normal internal fields» is REPEALED: «Remove class
 * everywhere». What the market sells by is in the SKU; when the goods came in is the lot; what the
 * goods ARE is a dimension. Those are the three, and this file owns the third.
 */

export type DimensionId =
  | 'maturity' | 'preparation' | 'state' | 'aging'
  /* the axes the first never-surprised exam found the corpus pricing by and the model lacking
   * (§8.7): the calibre band, the ibérico norma de calidad, curación, the embutido's own format,
   * the animal's category, the capture method, the cultivation method */
  | 'calibre' | 'iberico' | 'curacion' | 'form' | 'flavour' | 'category' | 'capture' | 'cultivation'
  /* HOW IT TRAVELLED (THE CHECKPOINT §7 — «transport/origin distinctions such as air vs boat») */
  | 'transport';

export type Dimension = {
  id: DimensionId;
  /** the field's own label — English, the review surface's language */
  label: string;
  /** the closed register, in the trade's own words */
  words: string[];
  /** where the register comes from, so a sourced word and an authored one stay countable apart */
  src?: string;
  /** a register whose values are written as BANDS rather than picked from the list (§8.5) */
  bands?: 'weight' | 'count' | 'size';
};

/** THE PREPARATION REGISTER, per family. Shared with `prepWordsFor` above, which is what keeps a
 *  preparation word out of the packing note in the same breath. */
const PREPARATION: Record<string, string[]> = {
  pescado: REF_REGISTERS.prepFish.words,
  carne: REF_REGISTERS.prepMeat.words,
};

/* THE REGISTERS THE REFERENCE BRINGS. Reg (UE) 404/2011's six state codes are the normative fish
 * core; RD 4/2014's «de bellota · de cebo de campo · de cebo» are legally enforced words carrying
 * the corpus's largest price spread; the rest is the trade extension §1.1 says must be built on
 * top of the norm, because «rodajas, lomos, ventresca, anillas» are on half the fish albaranes in
 * Spain and on none of the 32 normative presentation codes. */
const reg = (id: DimensionId, key: keyof typeof REF_REGISTERS): Dimension => ({
  id,
  label: REF_REGISTERS[key].label,
  words: REF_REGISTERS[key].words,
  src: REF_REGISTERS[key].src,
});

/** The calibre register for a family — the trade's named bands plus the shape a written one takes
 *  (§8.5: «calibre must be a closed register with band syntax attached to the families that price
 *  by it»). All 13 rows of the real fish sheet were PARTIAL for want of exactly this. */
const calibre = (words: string[], bands: Dimension['bands']): Dimension =>
  ({ id: 'calibre', label: 'Calibre', words, bands, src: 'authored' });

/* ── HOW IT TRAVELLED (THE CHECKPOINT §7 · MAP 7.10) ──────────────────────────────────────────
 * «Products can differ on tiny but commercially important attributes: … transport/origin
 * distinctions such as air vs boat.» It is the smallest register in the file and one of the
 * loudest facts on the shelf: a mango that flew is picked ripe and costs twice a mango that came
 * by sea, and the vegetable house's own catalogue already carries the distinction IN A NAME —
 * «Mango de barco», whose sibling in the trade is «Mango de avión». The same holds for fish: an
 * air-freighted atún and a boat-landed one are two prices and two shelves.
 *
 * TWO WORDS, AND THEY ARE THE TRADE'S OWN. There is no third way for goods to reach Mercabarna
 * from another continent, so the register is closed at two and stays honest. Meat is absent
 * because a media canal does not fly.
 */
const TRANSPORT: Dimension = {
  id: 'transport',
  label: 'Transport',
  words: ['de avión', 'de barco'],
  src: 'authored',
};

const FAMILY_DIMENSIONS: Record<string, Dimension[]> = {
  pescado: [
    reg('state', 'stateFish'),
    reg('preparation', 'prepFish'),
    calibre(CALIBRE_WORDS.fish, 'weight'),
    reg('capture', 'capture'),
    TRANSPORT,
  ],
  carne: [
    reg('state', 'stateMeat'),
    reg('preparation', 'prepMeat'),
    reg('category', 'category'),
    reg('iberico', 'iberico'),
    reg('curacion', 'curacion'),
    reg('form', 'form'),
    reg('flavour', 'flavour'),
    /* AGING IS DAYS, AND IT IS THE BEEF CASE. «Aging where it applies» — the maturation a house
       counts in days is dry-aged beef, and `dimensionsFor` gates it on the node so a chorizo never
       carries a field about a thing chorizo does not have. Cured hams are counted in months and
       are a different fact; this register refuses to pretend otherwise until that one is designed. */
    { id: 'aging', label: 'Aging', words: ['15 días', '21 días', '30 días', '45 días', '60 días'] },
  ],
  fruta: [
    /* THE FOUNDER'S OWN CASE: «customers specify it — mature bananas». Three words, and the middle
       one is the morning: most goods leave the house «en su punto». */
    { id: 'maturity', label: 'Maturity', words: ['verde', 'en su punto', 'maduro'] },
    calibre(CALIBRE_WORDS.produce, 'size'),
    reg('cultivation', 'cultivation'),
    TRANSPORT,
  ],
  ambient: [calibre(CALIBRE_WORDS.casing, 'count')],
  /* THE FAMILIES THE REFERENCE BROUGHT WITH IT. Six queso rows of the first exam grounded onto the
     shelf that holds ice, for want of a dairy family to land on (§8.10.5); a cheese is priced by
     its curación exactly as a jamón is, and by nothing else the meat register holds. */
  lacteo: [
    reg('state', 'stateMeat'),
    reg('curacion', 'curacion'),
    reg('form', 'form'),
  ],
  despensa: [
    reg('state', 'stateMeat'),
  ],
};

/* ── THE PLAIN FORM'S OWN WORD (FEED-IA §75.6 · §78.4 · Peter, 2026-08-28) ────────────────────
 * «If there are variations of a product, the main one should become a variation» minted a base
 * member, and the base member needed a word. It was given «Standard» — an invented one, and a SaaS
 * word for goods that have had trade words for four hundred years. Peter's call: THE WORD COMES OFF
 * THE REFERENCE — «entera» for whole fish, the cut's own register for meat, «fresca» where that is
 * the plain state — and «tal cual» where the reference holds no natural word.
 *
 * THE RESOLUTION, in three lines and no literals but the fallback:
 *   1 · the goods' dimension family, off the kind node they hang from (`familyKeyOf`);
 *   2 · that family's PREPARATION register, or its STATE register where it has no preparation —
 *       the reference's own lists, which are written PLAIN-FIRST: `prepFish` opens on «entero»,
 *       `prepMeat` on «entero», `stateMeat` on «fresco». So the plain form is `words[0]`;
 *   3 · nothing? then `NO_PLAIN_FORM`.
 *
 * IT MOVES WITH THE REFERENCE, which is the point of reading it rather than typing it: fruta and
 * ambient carry no preparation and no state today, so they say «tal cual»; the morning a produce
 * state register lands, produce starts saying «fresca» and no code here changes.
 *
 * AND THE WORD AGREES WITH THE GOODS. The registers are written in the masculine; Spanish makes the
 * adjective agree with the noun it describes, and the noun is the family's own head word. «Merluza
 * entera», «Pulpo entero», «Gamba entera», «Rape entero» — read off the name, never a table.
 */

/** What a base member says where the reference holds no plain-form word for its goods. */
export const NO_PLAIN_FORM = 'tal cual';

const agreed = (word: string, name: string): string =>
  (foldWord(name).split(' ')[0] ?? '').endsWith('a') && word.endsWith('o')
    ? `${word.slice(0, -1)}a`
    : word;

/** The word the base form wears as a member of its own family (§75.6). It is a LABEL for the plain
 *  thing, not a description of it: the family's name is one line up, so this row says only which of
 *  the forms it is. */
export function defaultMemberWord(node: string, name: string): string {
  const dimensions = FAMILY_DIMENSIONS[familyKeyOf(node)] ?? [];
  const plain =
    dimensions.find((d) => d.id === 'preparation') ?? dimensions.find((d) => d.id === 'state');
  const word = plain?.words[0];
  return word ? agreed(word, name) : NO_PLAIN_FORM;
}

/* ── THE HARNESS SPEAKS ONLY UNTIL THE HOUSE SPEAKS (FEED-IA §79) ──────────────────────────────
 * «Do you have our catalogue as a separate thing to the actual client's names for stuff? You
 * realise our catalog is a harness?» Two layers, never blurred: their catalogue is THE THING, the
 * reference is the scaffolding it hangs on. So every word the harness supplies is a DEFAULT.
 *
 * The base member's word is the first of those defaults to be built, and this is its order:
 *
 *      the house's own word  ??  the reference's form word  ??  «tal cual»
 *
 * A house that calls the plain form «pieza entera», or «fresco», or «normal», gets THAT on the row
 * — the harness never argues with a name, here or anywhere (§41.5, §62: free text always wins).
 * `named` is one map for both ways a house can say it: typed on the product sheet, or carried in
 * their own catalogue the day the import maps that column — both write through `nameThePlainForm`,
 * so there is one seam and not two.
 */
export function plainFormWord(
  sector: SectorId,
  product: { id: string; name: string },
  node: string,
  state: CatalogueState,
): string {
  return state.named[keyOf(sector, product.id)] ?? defaultMemberWord(node, product.name);
}

/** The house naming the plain form of one of its own families. An empty word HANDS IT BACK to the
 *  harness rather than blanking the row: a word deleted is a house that has stopped saying one. */
export function nameThePlainForm(sector: SectorId, base: { id: string; name: string }, word: string): void {
  const said = word.trim();
  const key = keyOf(sector, base.id);
  const named = { ...STATE.named };
  if (said) named[key] = said;
  else delete named[key];
  publish({
    ...STATE,
    named,
    events: [
      ...STATE.events,
      { id: nextId(), kind: 'adopted', sector, at: stamp(), subject: `${base.name} · ${said || 'the reference’s word'}` },
    ],
  });
}

/** The dimension family a node belongs to, for a row that arrives with no catalogue behind it —
 *  a document's line, a customer's words, a minted product. */
export function familyKeyOf(node: string): string {
  const family = familyOfNode(node);
  return ({
    'n-fish': 'pescado', 'n-meat': 'carne', 'n-produce': 'fruta', 'n-ambient': 'ambient',
    'n-dairy': 'lacteo',
  } as Record<string, string>)[family] ?? 'despensa';
}

/** The node under which aging is a fact a house actually counts. */
const AGED = 'n-beef';

/* WHICH BRANCH EACH OF THE NARROW REGISTERS IS TRUE ON. «Houses that never prep simply never touch
 * the dropdown» is only free if the dropdown is not there in the first place — an ibérico field on
 * a chicken line is a field about a thing chicken does not have. So a register that belongs to one
 * branch names it, and `dimensionsFor` gates on the walk up. */
const GATED: Partial<Record<DimensionId, string[]>> = {
  aging: [AGED],
  iberico: ['n-pork', 'n-cured', 'n-sausage', 'n-cooked'],
  curacion: ['n-cured', 'n-sausage', 'n-cheese'],
  form: ['n-sausage', 'n-cured', 'n-cooked', 'n-cheese'],
  flavour: ['n-sausage', 'n-cured', 'n-cooked'],
};

/**
 * The dimensions this line's goods take — the family's own, with the ones that need a node gated
 * on it.
 *
 * A HOUSE NEVER CONFIGURES THIS. The family the product already carries decides it, which is what
 * makes the option's presence free: nobody chose to switch it on, and nobody has to switch it off.
 */
export function dimensionsFor(family: string, node: string): Dimension[] {
  const all = FAMILY_DIMENSIONS[family] ?? [];
  const chain = new Set([node, ...ancestorsOf(node).map((a) => a.id)]);
  return all.filter((d) => {
    const on = GATED[d.id];
    return !on || on.some((id) => chain.has(id));
  });
}

/** One dimension by id, so a stored value can be drawn with its own label wherever it is read. */
export const dimensionOf = (family: string, id: DimensionId): Dimension | undefined =>
  (FAMILY_DIMENSIONS[family] ?? []).find((d) => d.id === id);

/** The words that join a register value without carrying it. «en filetes» is claimed by writing
 *  «filetes»; «15 días» is not claimed by writing «días», because the number IS the fact. */
const JOINS = new Set(['en', 'su', 'a', 'al', 'de']);

/**
 * Does a WRITTEN PHRASE claim a value of this register?
 *
 * WORD AGAINST WORD, never phrase against phrase. The residue a person writes is «de pincho
 * congelada» — a sort and a state in one breath — so a comparison that measured the whole string
 * against «congelado» found nothing and the state stayed a free word. Every written word is tried
 * against every carrying word of the value, at the same fold-and-distance the parse uses, so
 * «congelada» reaches «congelado» here exactly as «merlusa» reaches Merluza there (§41.5).
 *
 * EVERY CARRYING WORD MUST BE CLAIMED, which is what keeps the aging register honest: «30 días»
 * and «15 días» share their second word, so the number has to be said for either to be taken.
 */
export const dimensionClaim = (written: string, d: Dimension): string | undefined => {
  /* A BAND REGISTER READS A SHAPE, NOT A WORD (§8.5). «2-3» is in no list and never will be, so
     the calibre register is asked for its syntax before it is asked for its vocabulary. */
  if (d.bands) {
    for (const token of written.trim().split(/\s+/)) {
      const band = readBand(token, d.bands === 'weight');
      if (band) return band.value;
    }
  }
  const said = meat(written);
  if (said.length === 0) return undefined;
  return d.words.find((w) => {
    const parts = meat(w).filter((p) => !JOINS.has(p));
    return parts.length > 0 && parts.every((part) => said.some((s) => claims(s, part)));
  });
};
