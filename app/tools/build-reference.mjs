#!/usr/bin/env node
/* THE STANDARD PRODUCT REFERENCE — fetch + generate (FEED-IA §48/§50/§50b).
 *
 * Peter, §48: «We should have a standard product catalog which includes basically everything that
 * everywhere offers… We shouldn't be surprised by ANY product any supplier offers.» §50's bar:
 * «I want to know that we have basically everything that's sold in the whole Mercabarna and
 * Mercamadrid.» §50b's correction: «that's still lopsided as shit» — so the union build takes each
 * family from its deepest source and AUTHORS the wings where the law delegates to usage.
 *
 * THE SPINES, and what each one is authoritative for (THE-STANDARD-CATALOG §1):
 *   · BOE-A-2026-12598  1,105 fish species — FAO alfa-3 · official Spanish commercial name ·
 *                       scientific name. «El nombre comercial se considerará como denominación
 *                       oficial en todo el territorio nacional.» THE fish spine, by law.
 *   · Mercamadrid       538 productos across 4 markets — the VARIETY axis nothing else carries
 *                       (18 tomato varieties where Reg 2023/2429 can name four commercial types).
 *   · Mercabarna        the 132 + 187 coded product register — a second commercial vocabulary,
 *                       joined as CODES and SYNONYMS, never as new nodes (§7.4's own ceiling).
 *   · Reg (UE) 404/2011 32 presentation codes + 6 state codes — the normative fish prep register.
 *   · tools/reference-authored.mjs — the wings no source supplies (§1.2's verdict).
 *
 * USAGE
 *   node tools/build-reference.mjs --fetch     refresh .reference-cache from the live sources
 *   node tools/build-reference.mjs             generate src/prototypes/cedar/reference-data.ts from the cache
 *
 * DETERMINISM. Given the same cache the output is byte-identical: every collection is sorted
 * before emission and every id is derived from the source string, never from iteration order.
 * The cache is disposable (dot-prefixed, ignored); the SCRIPT is the artifact.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTHORED_CATEGORIES, CURED, SAUSAGE, COOKED, BEEF_CUTS, PORK_CUTS, POULTRY, LAMB_CUTS,
  GAME_MEAT, OFFAL, CHEESE, CHEESE_GPC, DAIRY_REST, PANTRY, PACKAGED_GPC, GPC_CODES, PREPARED,
  FAMILY_WORDS, AMBIENT, REGISTERS,
} from './reference-authored.mjs';
import {
  GPC_FAMILY_MAP, GPC_CLASS_MAP, GLOSS, GPC_STATE, GPC_CUT, GPC_ENUM, GPC_PROPER_ATTRS,
} from './reference-gloss.mjs';

/** The GPC attribute types that enumerate what a thing IS — a cut, a cultivar, a cheese — and
 *  therefore belong on the ladder. Everything else GPC enumerates (origin, flavour, refrigeration,
 *  anatomical form, packing) is a fact ABOUT the goods and stays a dimension register (§2.1). */
const LADDER_ATTRS = new Set([
  'Beef Cut', 'Veal Cut', 'Porcine Cut', 'Lamb/Mutton Cut', 'Chicken Cut', 'Turkey Cut', 'Goat Cut',
  'Apple Variety', 'Pears Variety', 'Grape Variety', 'Type of Cheese',
]);

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.reference-cache');
const OUT = join(HERE, '..', 'src', 'prototypes', 'cedar', 'reference-data.ts');
/* THE SPLIT, AND WHY IT IS A SPLIT AND NOT A TRIM (FEED-IA §52.5). The whole net is 4,681 nodes
 * and 8,882 lexicon bindings, and the two halves cost very different things: the TREE is what a
 * screen draws and has to be there when it draws, the LEXICON is what a written word is resolved
 * against. Keeping them in two modules means the day the surface wants the lexicon on demand, it
 * is one dynamic import and the regex layer already standing behind `ground` is the synchronous
 * answer in the meantime. Nothing is dropped to make a number smaller. */
const OUT_LEX = join(HERE, '..', 'src', 'prototypes', 'cedar', 'reference-lexicon.ts');

/* ── the fold every surface is stored in — the same one catalogue.ts's `foldWord` applies ───── */
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9+/]+/g, ' ').trim();

const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34);

const curl = (url, out, post) => {
  const args = ['-sL', '--max-time', '180', '-o', join(CACHE, out)];
  if (post) args.push('-X', 'POST', '-d', post);
  args.push(url);
  execFileSync('curl', args, { stdio: 'inherit' });
  console.log(`  ${out}`);
};

if (process.argv.includes('--fetch')) {
  mkdirSync(CACHE, { recursive: true });
  console.log('fetching the spines…');
  curl('https://www.boe.es/diario_boe/xml.php?id=BOE-A-2026-12598', 'boe-A-2026-12598.xml');
  for (const m of ['F', 'P', 'C', 'R']) {
    curl('https://www.mercamadrid.es/wp-admin/admin-ajax.php', `mercamadrid-${m}.json`,
      `action=get_products&markets_filter=${m}`);
  }
  for (const s of [2, 3]) {
    curl(`https://www.mercabarna.es/serveis/es_estadistiques-productes/?sector=${s}`, `mercabarna-s${s}.html`);
  }
  console.log('cache refreshed. run again without --fetch to generate.');
  process.exit(0);
}

const read = (f) => readFileSync(join(CACHE, f), 'utf8');

/* ═══ THE STORES (§2.2) ═══════════════════════════════════════════════════════════════════════
 * THE LADDER — canonical, curated, versioned: a node is `id · name · level · parents · external
 * ids · status`. THE LEXICON — every string anyone has ever used for a node, with its register.
 * Kept apart because that split is what makes «never surprised» an engineering property: a node
 * is never renamed to match a word; a word is bound to a node.
 */
const nodes = new Map();   // id -> { id, name, level, parent, src }
const attrs = new Map();   // id -> { fao:Set, sci:Set, codes:Set }
const words = new Map();   // foldedSurface -> [{ node, reg }]
const wordOrder = [];      // insertion order, for a deterministic dump

/** ids the 46-node tree already owns. They stay stable — every tenant's priors, routings and
 *  paintings key on them (§4.2.5: «node ids are permanent and never reused»). */
const EXISTING = new Set([
  'n-fish', 'n-whitefish', 'n-hake', 'n-hake-hook', 'n-hake-trawl', 'n-monkfish', 'n-farmed',
  'n-seabass', 'n-shellfish', 'n-prawn', 'n-clam', 'n-cephalopod', 'n-octopus', 'n-octopus-rock',
  'n-meat', 'n-pork', 'n-halfcarcass', 'n-cured', 'n-ham', 'n-cured-loin', 'n-sausage',
  'n-chorizo', 'n-beef', 'n-tenderloin', 'n-tenderloin-gal', 'n-poultry', 'n-chicken',
  'n-chicken-wing', 'n-offal', 'n-produce', 'n-vegetable', 'n-tomato', 'n-tomato-vine',
  'n-tomato-vine-gr', 'n-tomato-pink', 'n-tomato-plum', 'n-tomato-cherry', 'n-courgette',
  'n-fruit', 'n-mango', 'n-avocado', 'n-herb', 'n-parsley', 'n-ambient', 'n-ice', 'n-casing',
]);
/** the display names those nodes already carry, so a source row naming the same thing MERGES
 *  onto the existing id instead of minting a second node for one product (§4.2.1). */
const EXISTING_NAME = new Map(Object.entries({
  'pescado y marisco': 'n-fish', 'pescado blanco': 'n-whitefish', merluza: 'n-hake',
  'merluza de pincho': 'n-hake-hook', 'merluza de arrastre': 'n-hake-trawl', rape: 'n-monkfish',
  'pescado de crianza': 'n-farmed', lubina: 'n-seabass', marisco: 'n-shellfish',
  'gamba roja': 'n-prawn', almeja: 'n-clam', cefalopodos: 'n-cephalopod', pulpo: 'n-octopus',
  'pulpo de roca': 'n-octopus-rock', carne: 'n-meat', cerdo: 'n-pork', 'media canal': 'n-halfcarcass',
  curados: 'n-cured', jamon: 'n-ham', 'lomo embuchado': 'n-cured-loin', embutido: 'n-sausage',
  chorizo: 'n-chorizo', vacuno: 'n-beef', solomillo: 'n-tenderloin',
  'solomillo gallego': 'n-tenderloin-gal', aves: 'n-poultry', pollo: 'n-chicken',
  'alitas de pollo': 'n-chicken-wing', 'tripas y grasas': 'n-offal', 'fruta y verdura': 'n-produce',
  verdura: 'n-vegetable', tomate: 'n-tomato', 'tomate rama': 'n-tomato-vine',
  'tomate rama griego': 'n-tomato-vine-gr', 'tomate rosa': 'n-tomato-pink',
  'tomate pera': 'n-tomato-plum', 'tomate cherry': 'n-tomato-cherry', calabacin: 'n-courgette',
  fruta: 'n-fruit', mango: 'n-mango', aguacate: 'n-avocado', hierbas: 'n-herb', perejil: 'n-parsley',
  'ambiente y secos': 'n-ambient', hielo: 'n-ice', 'tripa natural': 'n-casing',
}));

const LEVELS = { family: 'f', category: 'c', type: 't', sort: 's' };

/** The words a name is MADE of, minus the trade's joining words and minus their order — so
 *  «Tomate en rama» and «Tomate rama» are recognised as one thing, and the second one binds as a
 *  WORD rather than minting a second node for one tomato (§4.2.3: undoing the sources' fusions is
 *  the main work of the merge, and it is mostly mechanical). */
const JOIN = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'al', 'en', 'a']);
const shape = (s) => fold(s).split(' ').filter((w) => w && !JOIN.has(w)).sort().join(' ');
const shapesUnder = new Map(); /* parentId -> Map<shape, nodeId> */
const shapeIndex = new Map();  /* shape of a surface -> the nodes that surface reaches */
const sameShapeUnder = (parent, name) => shapesUnder.get(parent)?.get(shape(name));

function node(id, name, level, parent, src) {
  if (nodes.has(id)) return nodes.get(id);
  const n = { id, name, level, parent, src };
  nodes.set(id, n);
  const key = parent ?? '';
  if (!shapesUnder.has(key)) shapesUnder.set(key, new Map());
  const bucket = shapesUnder.get(key);
  if (!bucket.has(shape(name))) bucket.set(shape(name), id);
  return n;
}

/** Mint a node for a source row, merging onto an existing id where the trade already named it. */
function mint(name, level, parent, src, prefix) {
  const key = fold(name);
  const held = EXISTING_NAME.get(key);
  if (held) return nodes.get(held) ?? node(held, name, level, parent, src);
  let id = `${prefix}${slug(name)}`;
  if (nodes.has(id) && nodes.get(id).name !== name) {
    let k = 2;
    while (nodes.has(`${id}-${k}`)) k += 1;
    id = `${id}-${k}`;
  }
  return node(id, name, level, parent, src);
}

/** Bind a surface to a node. A surface two nodes both claim keeps BOTH candidates — the resolver
 *  picks by the family it is reading in, and falls back to the first bound (§4.2.2's precedence
 *  applied to surfaces rather than to display names: the tree's own words, then the authored
 *  wings, then BOE, then the Mercas). «Aguja» is a garfish to a fishmonger and a chuck to a
 *  butcher, and the reference has to be able to say both. */
function bind(surface, nodeId, reg) {
  const w = fold(surface);
  if (!w || w.length < 2) return;
  if (!words.has(w)) { words.set(w, []); wordOrder.push(w); }
  const list = words.get(w);
  if (!list.some((c) => c.node === nodeId)) list.push({ node: nodeId, reg });
  const sh = shape(surface);
  if (sh && sh !== w) {
    if (!shapeIndex.has(sh)) shapeIndex.set(sh, []);
    const bucket = shapeIndex.get(sh);
    if (!bucket.some((c) => c.node === nodeId)) bucket.push({ node: nodeId, reg });
  }
}

function attr(id, key, value) {
  if (!value) return;
  if (!attrs.has(id)) attrs.set(id, { fao: new Set(), sci: new Set(), codes: new Set() });
  attrs.get(id)[key].add(value);
}

/* THE 46 NODES THE SURFACE ALREADY DRAWS, seeded so the growth resolves against them: an upward
 * walk needs the whole chain, and a source row naming something the tree already names has to find
 * it. They are filtered out at emission — catalogue.ts keeps owning its own TREE literal, and this
 * module only ever ADDS. */
const EXISTING_TREE = [
  ['n-fish', 'Pescado y marisco', 'family', ''], ['n-whitefish', 'Pescado blanco', 'category', 'n-fish'],
  ['n-hake', 'Merluza', 'type', 'n-whitefish'], ['n-hake-hook', 'Merluza de pincho', 'sort', 'n-hake'],
  ['n-hake-trawl', 'Merluza de arrastre', 'sort', 'n-hake'], ['n-monkfish', 'Rape', 'type', 'n-whitefish'],
  ['n-farmed', 'Pescado de crianza', 'category', 'n-fish'], ['n-seabass', 'Lubina', 'type', 'n-farmed'],
  ['n-shellfish', 'Marisco', 'category', 'n-fish'], ['n-prawn', 'Gamba roja', 'type', 'n-shellfish'],
  ['n-clam', 'Almeja', 'type', 'n-shellfish'], ['n-cephalopod', 'Cefalópodos', 'category', 'n-fish'],
  ['n-octopus', 'Pulpo', 'type', 'n-cephalopod'], ['n-octopus-rock', 'Pulpo de roca', 'sort', 'n-octopus'],
  ['n-meat', 'Carne', 'family', ''], ['n-pork', 'Cerdo', 'category', 'n-meat'],
  ['n-halfcarcass', 'Media canal', 'type', 'n-pork'], ['n-cured', 'Curados', 'category', 'n-meat'],
  ['n-ham', 'Jamón', 'type', 'n-cured'], ['n-cured-loin', 'Lomo embuchado', 'type', 'n-cured'],
  ['n-sausage', 'Embutido', 'category', 'n-meat'], ['n-chorizo', 'Chorizo', 'type', 'n-sausage'],
  ['n-beef', 'Vacuno', 'category', 'n-meat'], ['n-tenderloin', 'Solomillo', 'type', 'n-beef'],
  ['n-tenderloin-gal', 'Solomillo gallego', 'sort', 'n-tenderloin'],
  ['n-poultry', 'Aves', 'category', 'n-meat'], ['n-chicken', 'Pollo', 'type', 'n-poultry'],
  ['n-chicken-wing', 'Alitas de pollo', 'sort', 'n-chicken'],
  ['n-offal', 'Tripas y grasas', 'category', 'n-meat'], ['n-produce', 'Fruta y verdura', 'family', ''],
  ['n-vegetable', 'Verdura', 'category', 'n-produce'], ['n-tomato', 'Tomate', 'type', 'n-vegetable'],
  ['n-tomato-vine', 'Tomate rama', 'sort', 'n-tomato'],
  ['n-tomato-vine-gr', 'Tomate rama griego', 'sort', 'n-tomato-vine'],
  ['n-tomato-pink', 'Tomate rosa', 'sort', 'n-tomato'], ['n-tomato-plum', 'Tomate pera', 'sort', 'n-tomato'],
  ['n-tomato-cherry', 'Tomate cherry', 'sort', 'n-tomato'],
  ['n-courgette', 'Calabacín', 'type', 'n-vegetable'], ['n-fruit', 'Fruta', 'category', 'n-produce'],
  ['n-mango', 'Mango', 'type', 'n-fruit'], ['n-avocado', 'Aguacate', 'type', 'n-fruit'],
  ['n-herb', 'Hierbas', 'category', 'n-produce'], ['n-parsley', 'Perejil', 'type', 'n-herb'],
  ['n-ambient', 'Ambiente y secos', 'family', ''], ['n-ice', 'Hielo', 'category', 'n-ambient'],
  ['n-casing', 'Tripa natural', 'category', 'n-ambient'],
];

for (const [id, name, level, parent] of EXISTING_TREE) {
  node(id, name, level, parent || undefined, 'authored');
  bind(name, id, 'authored');
}

/* ═══ 1 · THE FISH SPINE — BOE-A-2026-12598 (§1.1) ════════════════════════════════════════════
 * Parsed from the annex table: 1,105 rows of `COD FAO · nombre comercial · nombre científico`.
 * The commercial name is the node's display name, full stop (§4.2.2's precedence: oficial wins).
 * Everything else the row carries becomes a lexicon attribute — the FAO alfa-3 is the external
 * id, the scientific name is the dedup key across sources.
 */
const cleanName = (s) => s.replace(/\*/g, '').replace(/\s+/g, ' ').replace(/\.$/, '').trim();

function parseBoe() {
  const xml = read('boe-A-2026-12598.xml');
  const out = [];
  for (const m of xml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((c) => cleanName(c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')));
    if (cells.length === 3 && cells[0] !== 'CODFAO') out.push(cells);
  }
  return out;
}

/** The trade's own first word decides the shelf. A keyword table over the commercial name beats a
 *  taxonomy over the scientific name here, because the shelf a Spanish fishmonger keeps is a trade
 *  category and not a clade — and where the word says nothing, the genus is the safety net. The
 *  PLACEMENT is authored even where the NAME is official; the data says so per node. */
const FISH_SHELF = [
  ['n-cephalopod', /^(pulpo|calamar|calamarin|sepia|sepiola|choco|chipiron|pota|poton|jibia|globito|nautilo|argonauta|volador|lula)\b/],
  ['n-shellfish', /^(cangrejo|camaron|langostino|gamba|langosta|cigala|centoll|bogavante|necora|buey de mar|percebe|quisquilla|carabinero|galera|cigarra|santiaguiño|santiaguino|krill|jaiba|langostilla|escamarlan|nephrops)\b/],
  /* THE SHELL SHELF. This rule already existed as a second `n-shellfish` line — the BOE spine
   * had grouped the shelled molluscs apart from the crustaceans and both were pointed at the
   * same shelf. It now lands on its own rung. The spiny ones (erizo, holoturia, espardeña)
   * stay with Marisco: a sea urchin is not sold off the shell counter. */
  ['n-bivalve', /^(almeja|almejon|berberecho|mejillon|ostra|ostion|vieira|zamburiña|zamburina|volandeira|navaja|coquina|chirla|arca|lapa|bigaro|caracol|cañailla|canailla|busano|verigueto|escupiña|escupina|longueiron|telina|tellina|mactra|muergo|solen|concha|pie de burro|taca|oreja de mar|abulon|bocina|cornete|cañadilla|canadilla|nacra|pinna|datil de mar|callo de|peregrina)\b/],
  ['n-shellfish', /^(holoturia|cohombro|erizo|espardeña|espardena)\b/],
  ['n-seaweed', /^(alga|microalga|lechuga de mar|espagueti de mar|kombu|wakame|nori|dulse|musgo|agar|sargazo|ulva|codium|fucus)\b/],
  ['n-farmed', /^(dorada|corvina|rodaballo)\b/],
  ['n-bluefish', /^(atun|bonito|caballa|verdel|sarda|sardina|sardinela|sardineta|boqueron|anchoa|jurel|chicharro|melva|listado|rabil|patudo|albacora|pez espada|marlin|aguja|agujon|palometa|palometon|salmon|trucha|anguila|angula|arenque|espadin|alacha|machuelo|saurel|lisa|mujol|sable|pez cinto|medregal|seriola|lampuga|lecha|serviola|tasarte|bacoreta|carite|reo|salvelino|pejerrey|espadarte|marrajo|cazon|tintorera|tiburon|quimera|pintarroja)\b/],
];
const FISH_GENUS = [
  ['n-shellfish', /^(Penaeus|Parapenaeus|Aristeus|Aristaeomorpha|Nephrops|Homarus|Palinurus|Panulirus|Scyllar|Cancer|Carcinus|Necora|Maja|Chionoecetes|Callinectes|Paralithodes|Crangon|Palaemon|Pandalus|Pollicipes|Squilla|Munida|Galathea|Portunus|Lithodes|Litopenaeus|Metapenaeus|Solenocera|Plesionika|Macrobrachium|Procambarus|Astacus|Pacifastacus|Austropotamobius|Chaceon|Geryon|Paracentrotus|Echinus|Holothuria|Strongylocentrotus|Microcosmus)/],
  ['n-bivalve', /^(Mytilus|Perna|Ostrea|Crassostrea|Magallana|Pecten|Aequipecten|Mimachlamys|Ruditapes|Venerupis|Venus|Chamelea|Callista|Dosinia|Donax|Ensis|Solen|Cerastoderma|Acanthocardia|Spisula|Mactromeris|Mya|Arca|Anadara|Glycymeris|Mactra|Haliotis|Littorina|Buccinum|Bolinus|Hexaplex|Charonia|Patella|Nassarius|Cymbium|Strombus|Neptunea|Babylonia|Pinna|Modiolus|Aulacomya|Choromytilus|Scrobicularia|Panopea|Meretrix|Paphia|Polititapes|Mercenaria)/],
  ['n-cephalopod', /^(Octopus|Eledone|Sepia|Sepiola|Loligo|Doryteuthis|Illex|Todarodes|Todaropsis|Ommastrephes|Nautilus|Argonauta|Rossia|Alloteuthis|Berryteuthis|Dosidicus|Sthenoteuthis|Architeuthis|Sepioteuthis|Nototodarus|Martialia)/],
  ['n-seaweed', /^(Ulva|Laminaria|Undaria|Porphyra|Palmaria|Himanthalia|Fucus|Codium|Chondrus|Gracilaria|Gelidium|Saccharina|Alaria|Chlorella|Spirulina|Arthrospira|Haematococcus|Dunaliella|Tetraselmis|Nannochloropsis|Odontella|Schizochytrium|Euglena)/],
  ['n-bluefish', /^(Scomber|Sardina|Sardinella|Engraulis|Trachurus|Thunnus|Katsuwonus|Euthynnus|Sarda|Auxis|Clupea|Sprattus|Alosa|Belone|Scomberesox|Seriola|Coryphaena|Xiphias|Makaira|Istiophorus|Kajikia|Tetrapturus|Salmo|Oncorhynchus|Salvelinus|Anguilla|Mugil|Chelon|Liza|Trachinotus|Brama|Lichia|Pomatomus|Scomberomorus|Acanthocybium|Trichiurus|Lepidopus|Aphanopus|Thunnini)/],
];

function fishShelf(name, sci) {
  const n = fold(name);
  for (const [shelf, rx] of FISH_SHELF) if (rx.test(n)) return shelf;
  for (const [shelf, rx] of FISH_GENUS) if (rx.test(sci)) return shelf;
  return 'n-whitefish';
}

/** «Merluza o merluza/pescadilla europea» is one node with three surfaces. The FIRST alternative
 *  is the display name; « o » separates alternatives and «/» separates the two words a single
 *  alternative may be written with. */
function surfacesOf(commercial) {
  const alts = commercial.split(/\s+o\s+/i).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const alt of alts) {
    const m = alt.match(/^(\S+)\/(\S+)(\s+.*)?$/);
    if (m) { out.push(`${m[1]}${m[3] ?? ''}`.trim(), `${m[2]}${m[3] ?? ''}`.trim()); } else out.push(alt);
  }
  return out.filter(Boolean);
}

const boeRows = parseBoe();
const boeByDisplay = new Map();
for (const [fao, commercial, sci] of boeRows) {
  const surfaces = surfacesOf(commercial);
  const display = surfaces[0].charAt(0).toUpperCase() + surfaces[0].slice(1);
  if (!boeByDisplay.has(fold(display))) {
    boeByDisplay.set(fold(display), { display, surfaces: new Set(), fao: new Set(), sci: new Set() });
  }
  const g = boeByDisplay.get(fold(display));
  for (const s of surfaces) g.surfaces.add(s);
  g.fao.add(fao);
  g.sci.add(sci);
}

/* A qualified name whose first word is itself a registered kind is that kind's SORT — «Merluza
 * austral» under «Merluza», «Almeja fina» under «Almeja». That is the L1 KIND / L2 SORT split of
 * §2.1 read straight off the BOE's own naming, and it is what turns a flat 1,042-row list into a
 * ladder a house can walk. */
const boeKinds = [...boeByDisplay.values()].sort((a, b) => a.display.localeCompare(b.display, 'es'));
const kindByFirstWord = new Map();
for (const g of boeKinds) {
  const w = fold(g.display);
  if (!w.includes(' ')) kindByFirstWord.set(w, g);
}
for (const [k, id] of EXISTING_NAME) if (!k.includes(' ') && id.startsWith('n-')) {
  if (!kindByFirstWord.has(k)) kindByFirstWord.set(k, { display: k, existing: id });
}

let fishTypes = 0; let fishSorts = 0;
const boeNodeOf = new Map();
for (const g of boeKinds) {
  const w = fold(g.display);
  const first = w.split(' ')[0];
  const parentKind = w.includes(' ') ? kindByFirstWord.get(first) : undefined;
  const shelf = fishShelf(g.display, [...g.sci][0]);
  let n;
  if (parentKind) {
    const pid = parentKind.existing ?? boeNodeOf.get(fold(parentKind.display));
    n = mint(g.display, 'sort', pid ?? shelf, 'boe', 'n-f-');
    if (n.level === 'sort') fishSorts += 1;
  } else {
    n = mint(g.display, 'type', shelf, 'boe', 'n-f-');
    if (!EXISTING.has(n.id)) fishTypes += 1;
  }
  boeNodeOf.set(w, n.id);
  for (const s of g.surfaces) bind(s, n.id, 'oficial');
  for (const f of g.fao) attr(n.id, 'fao', f);
  for (const s of g.sci) { attr(n.id, 'sci', s); bind(s, n.id, 'cientifico'); }
}

/* ═══ 2 · THE AUTHORED WINGS (§50b.2) ═════════════════════════════════════════════════════════
 * Bound after the fish spine so the tree's own words and the wings own the homographs a fishmonger
 * and a butcher spell the same — and before the Mercas, whose vocabulary is commercial rather
 * than canonical.
 */
for (const c of AUTHORED_CATEGORIES) {
  node(c.id, c.name, c.level ?? 'category', c.parent, 'authored');
  bind(c.name, c.id, 'authored');
}

function wing(rows, parent, prefix, defaultSrc) {
  for (const r of rows) {
    const id = r.id ?? `${prefix}${slug(r.name ?? r.kind)}`;
    const name = r.name ?? r.kind;
    const p = r.parent ?? parent;
    /* A WING ROW MAY BE A SHELF. `Pavo` and `Conejo` each held their own cuts as «sorts», which
     * made the whole animal and the shelf one node under one word. Levelling a row up moves its
     * children one rung with it, so the cuts become types and the whole bird gets a node of its
     * own — the split the painted library needs to hold a creature and a product at once. */
    const level = r.level ?? 'type';
    const n = node(id, name, level, p, r.src ?? defaultSrc);
    if (!nodes.get(id).parent) nodes.get(id).parent = p;
    bind(name, id, 'authored');
    for (const w of r.words ?? []) bind(w, id, 'authored');
    if (r.composition) compositions.set(id, r.composition);
    const sortLevel = level === 'category' ? 'type' : 'sort';
    for (const s of r.sorts ?? []) {
      const sid = s.id ?? `${prefix}${slug(s.name)}`;
      node(sid, s.name, sortLevel, n.id, r.src ?? defaultSrc);
      bind(s.name, sid, 'authored');
      for (const w of s.words ?? []) bind(w, sid, 'authored');
      if (s.composition) compositions.set(sid, s.composition);
    }
  }
}
const compositions = new Map();

wing(CURED, 'n-cured', 'n-m-', 'authored');
wing(SAUSAGE, 'n-sausage', 'n-m-', 'authored');
wing(COOKED, 'n-cooked', 'n-m-', 'authored');
wing(BEEF_CUTS, 'n-beef', 'n-b-', 'provacuno');
wing(PORK_CUTS, 'n-pork', 'n-p-', 'authored');
wing(POULTRY, 'n-poultry', 'n-a-', 'authored');
wing(LAMB_CUTS, 'n-lamb', 'n-o-', 'interovic');
wing(GAME_MEAT, 'n-game', 'n-g-', 'authored');
wing(OFFAL, 'n-offal', 'n-c-', 'authored');
wing(CHEESE, 'n-cheese', 'n-q-', 'authored');
wing(CHEESE_GPC, 'n-cheese', 'n-q-', 'gpc');
wing(DAIRY_REST, 'n-dairy', 'n-l-', 'authored');
wing(PANTRY, 'n-grocery', 'n-d-', 'authored');
for (const r of PACKAGED_GPC) {
  const n = node(`n-d-${slug(r.name)}`, r.name, 'type', r.parent, 'gpc');
  bind(r.name, n.id, 'authored');
  for (const w of r.words) bind(w, n.id, 'authored');
  attr(n.id, 'codes', r.gpc);
}
wing(PREPARED, 'n-vegetable', 'n-v-', 'authored');
wing(AMBIENT, 'n-ambient', 'n-x-', 'authored');

/* ═══ 3 · MERCAMADRID — the variety axis (§1.3) ═══════════════════════════════════════════════
 * One POST per market. `Variedades` is a comma-joined list of 30-CHARACTER FIXED-WIDTH fields —
 * which is why §1.3's «commas inside values break naive comma-splitting» (`MERLUZA PINCHO
 * +2,5-5 KG.`) is a solved problem here rather than a hazard: the split is positional.
 */
function mm(market) {
  const raw = read(`mercamadrid-${market}.json`).replace(/^﻿/, '').trim();
  return JSON.parse(raw).data.map((r) => ({
    familia: r.Familia.trim(),
    producto: r.DesProducto1.trim(),
    variedades: splitFixed(r.Variedades),
  }));
}
function splitFixed(s) {
  const out = [];
  for (let i = 0; i < s.length; i += 31) out.push(s.slice(i, i + 30).trim());
  return out.filter(Boolean);
}

/* THE SUFFIX TABLE (§4.2.3). «Undoing the sources' fusions is the main work of this step and it is
 * mostly mechanical.» Each of these is a DIMENSION READING that the source fused into the name;
 * stripping it is what stops `BACALAO` and `BACALAO CONG` becoming two nodes for one fish. */
const FUSED = [
  [/\bCONG\.?\b|\bCONGELAD[OA]S?\b/gi, 'state:congelado'],
  [/\bFRESC[OA]S?\b/gi, 'state:fresco'],
  [/\bCOCID[OA]S?\b/gi, 'state:cocido'],
  [/\bSECO\b|\bSALAD[OA]\b|\bSALAZ[OÓ]N\b/gi, 'state:salado'],
  [/\bAHUMAD[OA]S?\b/gi, 'state:ahumado'],
  [/\bGRANEL\b/gi, 'pack:granel'],
  [/\bCONFECC?I?(ONADA|ONADO|ÓN)?\b/gi, 'pack:confeccionado'],
  [/\bDE IMPORTACION\b|\bIMPORTACI[OÓ]N?\b|\bIMPORTAC\b/gi, 'origin:importación'],
  [/\bU\.?E\.?\b/gi, 'origin:U.E.'],
  [/\bNACIONAL(ES)?\b/gi, 'origin:nacional'],
  [/\bS\/C\b/gi, 'prep:sin cabeza'],
  [/\bS\/P\b/gi, 'prep:sin piel'],
  [/\bC\/P\b/gi, 'prep:con piel'],
  [/\bSIN ESPECIF\w*\b|\bSIN DETER\w*\b/gi, 'note:sin especificar'],
  [/\+?\d+([.,]\d+)?\s*[-/]\s*\d+([.,]\d+)?\s*KG\.?/gi, 'calibre:band'],
  [/\+\s?\d+([.,]\d+)?\s*KG\.?/gi, 'calibre:band'],
  [/\bN-\d\b/gi, 'calibre:band'],
  [/\bHASTA \d+([.,]\d+)?\s*KG\.?/gi, 'calibre:band'],
];
/** «`O.V.` = otras variedades — a residual bucket, which must map to the parent node, never to a
 *  node called OV» (§1.3's dirt list, verbatim). */
const RESIDUAL = /\bO\.?\s?V\.?\b|\bOTRAS VARIEDADES\b|\bVARIOS\b|\bREGION\b/i;

function unfuse(s) {
  let out = ` ${s} `;
  const read = [];
  for (const [rx, tag] of FUSED) {
    if (rx.test(out)) { read.push(tag); out = out.replace(rx, ' '); }
    rx.lastIndex = 0;
  }
  return { name: out.replace(/[.,;]+$/g, '').replace(/\s+/g, ' ').trim(), read };
}

/** Trade lists write plurals; the ladder writes the thing. «TOMATES» is the tomato node and
 *  «LIMONES» is the limón node — Spanish forms one plural with `+s` after a vowel and another with
 *  `+es` after a consonant, and only a dictionary tells the two apart. The lexicon IS the
 *  dictionary: both candidates are offered to the resolver, and where neither resolves the stem's
 *  last letter decides (a stem ending n·l·r·d·z·j·s took `+es`, everything else took `+s`). */
function singularCandidates(s) {
  const w = s.trim();
  const out = [w];
  if (/es$/i.test(w) && w.length > 4) out.push(w.slice(0, -2));
  if (/s$/i.test(w) && w.length > 3) out.push(w.slice(0, -1));
  return [...new Set(out)];
}
function singular(s) {
  const w = s.trim();
  if (/es$/i.test(w) && w.length > 4 && /[nlrdzjs]$/i.test(w.slice(0, -2))) return w.slice(0, -2);
  if (/s$/i.test(w) && w.length > 3) return w.slice(0, -1);
  return w;
}

const titleCase = (s) => {
  const low = s.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
};

/** The node a source string already resolves to — the lexicon answering for itself, longest match
 *  first, which is the same rule catalogue.ts's resolver runs. */
function resolveSurface(text, prefer) {
  const parts = fold(text).split(' ').filter(Boolean);
  for (let start = 0; start < parts.length; start += 1) {
    for (let len = Math.min(6, parts.length - start); len >= 1; len -= 1) {
      const key = parts.slice(start, start + len).join(' ');
      const hit = words.get(key);
      if (hit) {
        if (prefer) {
          const inFamily = hit.find((c) => familyOf(c.node) === prefer);
          if (inFamily) return inFamily.node;
        }
        return hit[0].node;
      }
    }
    if (start > 1) break; /* leftmost-longest: a match must start in the first words */
  }
  return undefined;
}
function familyOf(id) {
  let at = nodes.get(id);
  let guard = 0;
  while (at?.parent && guard < 8) { at = nodes.get(at.parent); guard += 1; }
  return at?.id;
}

/** THE MERGE RESOLVE, and it is deliberately stricter than the grounding one. Merging a source's
 *  CATEGORY onto a node we hold must match the WHOLE name — «Bebida de manzana espumosa» is not a
 *  manzana, and a leftmost-longest scan that is right for grounding a written line is wrong here.
 *  So: the folded string, then the same string with the trade's joining words and word order
 *  dropped, and nothing looser than that. */
function resolveExact(text, prefer) {
  for (const key of [fold(text), shape(text)]) {
    const hit = key.includes(' ') || key.length > 2
      ? (words.get(key) ?? shapeIndex.get(key))
      : words.get(key);
    if (!hit) continue;
    if (prefer) {
      const inFamily = hit.find((c) => familyOf(c.node) === prefer);
      if (inFamily) return inFamily.node;
    }
    return hit[0].node;
  }
  return undefined;
}
function resolveExactProduct(text, prefer) {
  for (const c of singularCandidates(text)) {
    const hit = resolveExact(c, prefer);
    if (hit) return hit;
  }
  return undefined;
}

/** The plural-tolerant resolve: the raw string, then each singular candidate. */
function resolveProduct(text, prefer) {
  for (const c of singularCandidates(text)) {
    const hit = resolveSurface(c, prefer);
    if (hit) return hit;
  }
  return undefined;
}

/** A PRODUCTO MADE ONLY OF DIMENSION WORDS IS A DIMENSION ROW, NOT A PRODUCT.
 *
 * Mercamadrid's pescados market carries a row whose producto is literally `AHUMADOS`. `unfuse`
 * does its job and strips the state word, and what came back was the empty string — which then
 * minted a node with NO NAME and the id `n-f-`, hanging under Pescado blanco with a Merca quote
 * on it. It reached the generated module and the app, where it is a shelf a person can pick and
 * a face the painted library is asked to draw, and it says nothing.
 *
 * This is the same shape as the `O.V.` residual bucket §1.3 already names: a row that is a
 * READING of goods rather than goods. The words still bind — «ahumados» is a real thing a house
 * writes, and it belongs on the shelf's lexicon — but nothing is minted, because a node needs a
 * name and this row has none once its readings are taken off it.
 */
const isDimensionRow = (base) => !base || !base.trim();

const stats = { mmNodes: 0, mmWords: 0, mbJoined: 0, mbUnmatched: 0, mmDimensionRows: 0 };
/** «Market priority as an attribute» (§52.2): the nodes a Merca actually quotes. */
const traded = new Set();
const quote = (id) => traded.add(id);

/* F · frutas y hortalizas — Familia 1 = frutas, 2 = hortalizas (the source's own split). */
const PRODUCE_SHELF = { 1: 'n-fruit', 2: 'n-vegetable', 3: 'n-vegetable' };
/** THE ROOT SHELF. Mercamadrid's produce split is two-way, so a sack of potatoes landed on the
 *  same shelf as a head of lettuce. Roots and tubers are stored dry, priced by the sack and shown
 *  apart from the leaf; the shelf is the rung §35.8's «the root» asks for. Minted rows route here
 *  — a node the tree already held keeps the parent it was given, because ids and their places are
 *  permanent (§4.2.5). */
const ROOT = /^(patata|papa|boniato|batata|zanahoria|nabo|chirivia|remolacha|rabano|rabanilla|yuca|mandioca|ñame|name|colinabo|tupinambo|jengibre|apionabo|salsifi|chufa|malanga|eddo|taro)\b/;
const rootShelf = (base) => (ROOT.test(fold(base)) ? 'n-root' : undefined);
for (const row of mm('F')) {
  if (/^AJUSTE/i.test(row.producto)) continue;
  const shelf = PRODUCE_SHELF[Number(row.familia)] ?? 'n-vegetable';
  const base = unfuse(row.producto).name;
  if (isDimensionRow(base)) {
    bind(row.producto, shelf, 'comercial'); stats.mmDimensionRows += 1; continue;
  }
  const held = resolveProduct(base, 'n-produce');
  const kind = held ? nodes.get(held) : mint(titleCase(singular(base)), 'type', rootShelf(base) ?? shelf, 'mm', 'n-v-');
  if (!held) stats.mmNodes += 1;
  bind(row.producto, kind.id, 'comercial');
  bind(base, kind.id, 'comercial');
  bind(singular(base), kind.id, 'comercial');
  quote(kind.id);
  for (const v of row.variedades) {
    const { name } = unfuse(v);
    bind(v, kind.id, 'comercial');
    stats.mmWords += 1;
    if (!name || RESIDUAL.test(v)) continue;                 /* the residual bucket is the parent */
    if (shape(name) === shape(base) || shape(name) === shape(kind.name)) continue;
    const twin = sameShapeUnder(kind.id, name);              /* «Tomate en rama» IS «Tomate rama» */
    if (twin) { bind(name, twin, 'comercial'); bind(v, twin, 'comercial'); quote(twin); continue; }
    const already = resolveProduct(name, 'n-produce');
    if (already && already !== kind.id) { bind(name, already, 'comercial'); quote(already); continue; }
    const sort = mint(titleCase(name), 'sort', kind.id, 'mm', 'n-v-');
    stats.mmNodes += 1;
    bind(name, sort.id, 'comercial');
    bind(v, sort.id, 'comercial');
    quote(sort.id);
  }
}

/* P · pescados — the BOE owns the fish names, so this market lands as VOCABULARY on the spine.
 * A producto the spine cannot answer for is a real gap and becomes a node of its own. */
for (const row of mm('P')) {
  if (/^AJUSTE/i.test(row.producto)) continue;
  const base = unfuse(row.producto).name;
  if (isDimensionRow(base)) {
    bind(row.producto, 'n-fish', 'comercial'); stats.mmDimensionRows += 1; continue;
  }
  const held = resolveProduct(base, 'n-fish');
  /* A MERCA-MINTED FISH TAKES THE SAME SHELF RULES AS A BOE ONE. Every row this market could not
   * answer for used to land on Pescado blanco whatever it was, so the generic «Trucha» sat beside
   * the hakes while its own BOE species sat on Pescado azul. The keyword table is right there. */
  const kind = held ? nodes.get(held)
    : mint(titleCase(singular(base)), 'type', fishShelf(base, ''), 'mm', 'n-f-');
  if (!held) stats.mmNodes += 1;
  bind(row.producto, kind.id, 'comercial');
  bind(base, kind.id, 'comercial');
  quote(kind.id);
  for (const v of row.variedades) {
    const { name } = unfuse(v);
    bind(v, kind.id, 'comercial');
    stats.mmWords += 1;
    if (!name || RESIDUAL.test(v)) continue;
    const already = resolveProduct(name, 'n-fish');
    bind(name, already ?? kind.id, 'comercial');
    quote(already ?? kind.id);
  }
}

/* C · carnes — «rich on the CATEGORY axis, empty on cut names» (§1.2). So every row is a lexicon
 * row on the meat tree and none of it mints a cut. */
for (const row of mm('C')) {
  if (/^AJUSTE|^VARIOS/i.test(row.producto)) continue;
  const base = unfuse(row.producto).name;
  const held = isDimensionRow(base) ? 'n-meat' : (resolveProduct(base, 'n-meat') ?? 'n-meat');
  bind(row.producto, held, 'comercial');
  if (!isDimensionRow(base)) bind(base, held, 'comercial');
  quote(held);
  for (const v of row.variedades) { bind(v, held, 'comercial'); stats.mmWords += 1; }
}

/* R · varios — secos, aceites, lácteos, conservas: the packaged wing's own commercial vocabulary,
 * which is where the founder's «grain, dairy, packaged, whatever» meets a real source. */
const R_SHELF = {
  10: 'n-dairy', 11: 'n-dairy', 12: 'n-grocery', 13: 'n-oils', 14: 'n-bakery', 15: 'n-pulses',
  16: 'n-preserves', 17: 'n-grocery', 18: 'n-drinks', 19: 'n-drinks', 20: 'n-grocery',
  21: 'n-meat', 22: 'n-ambient',
};
for (const row of mm('R')) {
  if (/^AJUSTE|^ELECTRICIDAD/i.test(row.producto)) continue;
  const base = unfuse(row.producto).name;
  const shelf = R_SHELF[Number(row.familia)] ?? 'n-grocery';
  if (isDimensionRow(base)) {
    bind(row.producto, shelf, 'comercial'); stats.mmDimensionRows += 1; continue;
  }
  const held = resolveProduct(base);
  const kind = held ? nodes.get(held) : mint(titleCase(singular(base)), 'type', shelf, 'mm', 'n-d-');
  if (!held) stats.mmNodes += 1;
  bind(row.producto, kind.id, 'comercial');
  bind(base, kind.id, 'comercial');
  quote(kind.id);
  for (const v of row.variedades) { bind(v, kind.id, 'comercial'); stats.mmWords += 1; }
}

/* ═══ 4 · MERCABARNA — the coded register, joined as CODES and SYNONYMS (§7.1) ════════════════
 * «Mercabarna publishes its own standard vocabulary as a CODED register of 563 products across
 * three sectors — and nothing deeper.» So it never mints a node: it binds its words and hangs its
 * code on the node they resolve to. `326GBZ` = HORTALIZAS FRUTO TOMATE MADURO.
 */
for (const sector of [2, 3]) {
  const html = read(`mercabarna-s${sector}.html`);
  const block = html.split('name="producte"')[1]?.split('</select>')[0] ?? '';
  const groups = new Map();
  const gblock = html.split('name="grup"')[1]?.split('</select>')[0] ?? '';
  for (const m of gblock.matchAll(/<option[^>]*value="(\d{3})"[^>]*>([\s\S]*?)<\/option>/g)) {
    groups.set(m[1], m[2].replace(/\s+/g, ' ').trim());
  }
  for (const m of block.matchAll(/<option[^>]*value="([A-Z0-9]{5,8})"[^>]*>([\s\S]*?)<\/option>/g)) {
    const code = m[1];
    const label = m[2].replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
    const group = groups.get(code.slice(0, 3)) ?? '';
    const product = label.startsWith(group) ? label.slice(group.length).trim() : label;
    if (!product) continue;
    const { name } = unfuse(product);
    const hit = resolveSurface(name || product, sector === 2 ? 'n-fish' : 'n-produce')
      ?? resolveSurface(product);
    if (hit) {
      bind(product, hit, 'comercial');
      if (name && name !== product) bind(name, hit, 'comercial');
      attr(hit, 'codes', code);
      quote(hit);
      stats.mbJoined += 1;
    } else {
      stats.mbUnmatched += 1;
    }
  }
}

/* ═══ 5 · GS1 GPC — THE TOP NET, INGESTED WHOLE (FEED-IA §52.1) ═══════════════════════════════
 * «Ingest ALL 879 food/beverage bricks whole as the reference's top net — every family exists
 * because the enumerating source says so, never because anyone listed it.»
 *
 * ONE DOCTRINAL MOVE, AND IT IS THE SAME ONE THE MERCAS GET (§2.1, §4.2.3). GPC splits a brick by
 * refrigeration and by prepared-ness: `Fish - Unprepared/Unprocessed` exists three times over, for
 * Frozen, Perishable and Shelf Stable. Those are STATES, and a state is a dimension a line carries,
 * not an identity — «we put them on ONE node with state=congelado, because state is a dimension».
 * So every one of the 879 bricks LANDS, carrying its own code and its state reading, and the ones
 * that differ only by state land on one node. Nothing is selected out; the fusion is undone.
 *
 * AND THE SPANISH IS THE ONLY AUTHORED PART (§52.3). A brick whose Spanish name we cannot assert
 * keeps its GPC English title and is flagged `pending` — the category is in the reference and
 * countable; the word is owed.
 */
const gpcState = new Map();     /* nodeId -> the state words GPC fused into its titles */
const gpcPending = new Set();   /* nodes standing on their GPC English title */
const gpc = { bricks: 0, merged: 0, minted: 0, named: 0, pending: 0, enumerated: 0 };

function gpcHead(title) {
  let t = title;
  const read = [];
  for (const [rx, word] of GPC_STATE) {
    if (rx.test(t)) { if (word) read.push(word); t = t.replace(rx, ''); }
  }
  t = t.replace(/\s*-\s*$/, '').replace(/\s+/g, ' ').trim();
  return { head: t, read };
}

/* AN ENUMERATED VALUE'S SPANISH (§52.3). The same unfusing the bricks get, one rung lower: a cut
 * title arrives with UNECE's own code and the rib count the cut is taken at fused into it, and
 * neither is the cut's identity. The CODE is an external id and rides off as an attribute. The
 * RIB COUNT stays in the name — the trade prices a 6-rib rack apart from a 9-rib one, so the two
 * are two nodes — but it is composed back onto the authored head rather than authored once per
 * rib, which is why 635 cut nodes are answered by 409 authored words.
 *
 * `owed` is the pending flag: TRUE only where the value is a description we have no Spanish for.
 * A cultivar off one of the proper-noun registers is never owed a word — Tempranillo is already
 * the Spanish for Tempranillo. */
const UNECE_CODE = /\s*\(unece\s*(\d*)\)/i;
const RIB_COUNT = /\s*(\d+(?:-\d+)?)\s*ribs?$/i;
const tidyCut = (s) => s.replace(/[\s,-]+$/, '').replace(/\s+/g, ' ').trim();

function gpcEnum(attrTitle, pretty) {
  const whole = GPC_ENUM[pretty];
  if (whole) return { name: whole, code: undefined, owed: false };
  const cm = pretty.match(UNECE_CODE);
  const code = cm && cm[1] ? cm[1] : undefined;
  const rest = tidyCut(cm ? pretty.replace(UNECE_CODE, '') : pretty);
  const rm = rest.match(RIB_COUNT);
  const ribs = rm ? rm[1] : undefined;
  const head = rm ? tidyCut(rest.replace(RIB_COUNT, '')) : rest;
  const es = GPC_ENUM[rest] ?? GPC_CUT[attrTitle]?.[head];
  if (!es) return { name: pretty, code, owed: !GPC_PROPER_ATTRS.has(attrTitle) };
  if (ribs === undefined) return { name: es, code, owed: false };
  /* the count rides after a comma rather than after a `de`: a cut name that already ends in a
   * qualifier («…sin tapa») would otherwise read as though the qualifier had the ribs. */
  const count = ribs === '0' ? 'sin costillas'
    : ribs === '1' ? '1 costilla'
      : `${ribs} costillas`;
  return { name: `${es}, ${count}`, code, owed: false };
}

if (existsSync(join(CACHE, 'gpc', 'GPC as of May 2026 (2026-05-20) EN.json'))) {
  const schema = JSON.parse(readFileSync(join(CACHE, 'gpc', 'GPC as of May 2026 (2026-05-20) EN.json'), 'utf8')).Schema;
  const food = schema.find((s) => s.Code === 50000000);
  for (const family of food.Childs ?? []) {
    const famHead = gpcHead(family.Title).head;
    let famId = GPC_FAMILY_MAP[family.Code];
    if (!famId) {
      const es = GLOSS[family.Title] ?? GLOSS[famHead];
      famId = mint(es ?? famHead, 'family', undefined, 'gpc', 'n-gpc-').id;
      if (!es) gpcPending.add(famId);
      bind(family.Title, famId, 'authored');
    }
    attr(famId, 'codes', String(family.Code));
    for (const klass of family.Childs ?? []) {
      const kHead = gpcHead(klass.Title).head;
      let classId = GPC_CLASS_MAP[klass.Code];
      if (!classId) {
        const es = GLOSS[klass.Title] ?? GLOSS[kHead];
        const held = es ? resolveExactProduct(es, familyOf(famId)) : undefined;
        classId = held ?? mint(es ?? kHead, 'category', famId, 'gpc', 'n-gpc-').id;
        if (!es && !held) gpcPending.add(classId);
      }
      attr(classId, 'codes', String(klass.Code));
      bind(klass.Title, classId, 'authored');
      for (const brick of klass.Childs ?? []) {
        gpc.bricks += 1;
        const { head, read } = gpcHead(brick.Title);
        const es = GLOSS[brick.Title] ?? GLOSS[head];
        /* the brick's own words first, then its Spanish — a brick that IS a node we hold merges */
        const held = resolveExactProduct(head, familyOf(classId))
          ?? (es ? resolveExactProduct(es, familyOf(classId)) : undefined)
          ?? (es ? resolveExactProduct(es) : undefined);
        let id;
        if (held) { id = held; gpc.merged += 1; } else {
          const n = mint(es ?? head, 'type', classId, 'gpc', 'n-gpc-');
          id = n.id;
          gpc.minted += 1;
          if (!es) gpcPending.add(id);
        }
        if (es) gpc.named += 1;
        attr(id, 'codes', String(brick.Code));
        bind(brick.Title, id, 'authored');
        bind(head, id, 'authored');
        if (es) bind(es, id, 'authored');
        if (read.length) {
          const held2 = gpcState.get(id) ?? new Set();
          for (const r of read) held2.add(r);
          gpcState.set(id, held2);
        }
        /* THE ENUMERATIONS UNDER A BRICK. GPC's `Beef Cut` (152) · `Porcine Cut` (118) ·
         * `Lamb/Mutton Cut` (164) · `Apple Variety` (577) · `Grape Variety` (870) · `Type of
         * Cheese` (91) are the enumerating source for the LADDER's own L2 rung — a cut and a
         * cultivar are what a thing IS. The attribute types that name a FACT ABOUT the goods —
         * origin, flavour, refrigeration, anatomical form — are dimension registers and stay off
         * the tree, which is §2.1's line drawn exactly where the doctrine draws it. */
        for (const at of brick.Childs ?? []) {
          if (!LADDER_ATTRS.has(at.Title)) continue;
          for (const v of at.Childs ?? []) {
            const raw = v.Title;
            if (/^(UNCLASSIFIED|UNIDENTIFIED|OTHER|COMBINATION|MIXED|NOT APPLICABLE)$/i.test(raw)) continue;
            const pretty = raw.charAt(0) + raw.slice(1).toLowerCase();
            const already = resolveExactProduct(pretty, familyOf(id));
            if (already && already !== id) { bind(pretty, already, 'comercial'); continue; }
            const twin = sameShapeUnder(id, pretty);
            if (twin) { bind(pretty, twin, 'comercial'); continue; }
            /* THE ENUMERATION IS UNTOUCHED AND ONLY THE WORD IS OURS (§52.3): the value that
             * lands is chosen on the ENGLISH title above, exactly as before, so no Spanish name
             * can merge two enumerated values into one node or mint a third. */
            const { name: esName, code: unece, owed } = gpcEnum(at.Title, pretty);
            const sort = mint(esName, 'sort', id, 'gpc', 'n-gpc-');
            gpc.enumerated += 1;
            if (owed) gpcPending.add(sort.id);
            if (unece) attr(sort.id, 'codes', `unece:${unece}`);
            bind(pretty, sort.id, 'comercial');
            if (esName !== pretty) bind(esName, sort.id, 'authored');
          }
        }
      }
    }
  }
  gpc.pending = gpcPending.size;
}

/* ═══ 6 · THE FAMILIA WORDS (§8.10.6) ═════════════════════════════════════════════════════════ */
for (const [w, id] of FAMILY_WORDS) bind(w, id, 'authored');
for (const [id, code] of GPC_CODES) attr(id, 'codes', code);

/* ═══ EMIT ════════════════════════════════════════════════════════════════════════════════════
 * Packed newline-delimited records rather than object literals: this is thousands of rows, and a
 * row of five short fields costs about a third of what `{ id: '…', name: '…' }` costs in the
 * bundle. It parses once at module load and is data either way.
 */
const SRC_CODE = {
  boe: 'b', mm: 'm', mb: 'x', authored: 'a', provacuno: 'p', interovic: 'i',
  'interovic-campaign': 'j', 'rd4-2014': 'r', reg404: '4', reg2429: '2', gpc: 'g',
};
const REG_CODE = { oficial: 'o', cientifico: 's', comercial: 'c', autonomico: 'r', authored: 'a', codigo: 'd' };

const orderedNodes = [...nodes.values()]
  .filter((n) => !EXISTING.has(n.id))
  .sort((a, b) => a.id.localeCompare(b.id));

/* MARKET PRIORITY, as an attribute rather than a cut (§52.2). Every species the BOE registers is
 * in the reference; the ones the Mercas quote carry the flag, so «what is actually traded» is a
 * filter over a complete list and never a reason to have shortened the list. */

/* FLAGS, one letter each: `t` the Mercas quote it · `p` standing on a GPC English title, the
 * Spanish word owed (§52.3). */
const nodeLines = orderedNodes.map((n) => {
  const flags = `${traded.has(n.id) ? 't' : ''}${gpcPending.has(n.id) ? 'p' : ''}`;
  const state = [...(gpcState.get(n.id) ?? [])].sort().join(',');
  return [n.id, n.name, LEVELS[n.level], n.parent ?? '', SRC_CODE[n.src] ?? 'a', flags, state].join('|');
});

/* every existing node that GREW an attribute or a parent-side child still needs its attrs carried */
const attrLines = [...attrs.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([id, a]) => [id, [...a.fao].sort().join(','), [...a.sci].sort().join(';'), [...a.codes].sort().join(',')].join('|'))
  .filter((l) => l.split('|').slice(1).some(Boolean));

const wordLines = [];
for (const w of [...wordOrder].sort()) {
  for (const c of words.get(w)) wordLines.push([w, c.node, REG_CODE[c.reg]].join('|'));
}

const compLines = [...compositions.entries()].sort().map(([id, c]) => `${id}|${c}`);

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const registerLines = Object.entries(REGISTERS)
  .map(([id, r]) => `  ${id}: { label: ${JSON.stringify(r.label)}, src: ${JSON.stringify(r.src)}, words: ${JSON.stringify(r.words)} },`)
  .join('\n');

const counts = {
  nodes: orderedNodes.length,
  bySrc: {},
  byLevel: {},
  words: wordLines.length,
  surfaces: wordOrder.length,
};
for (const n of orderedNodes) {
  counts.bySrc[n.src] = (counts.bySrc[n.src] ?? 0) + 1;
  counts.byLevel[n.level] = (counts.byLevel[n.level] ?? 0) + 1;
}

const header = `/* GENERATED FILE — do not hand-edit. Rebuild with \`node tools/build-reference.mjs\`.
 *
 * THE STANDARD PRODUCT REFERENCE (FEED-IA §48/§50/§50b, THE-STANDARD-CATALOG). The tree plus the
 * words plus the dimensions that every house's own catalogue GROUNDS onto — «first our own
 * structure, then the learning on their data» (catalogue.ts §10.1).
 *
 * TWO STORES, NEVER ONE (§2.2). The LADDER is canonical, curated and small: a node exists because
 * the trade names it. The LEXICON is every string anyone has ever used for a node, with the
 * register it came from. A node is never renamed to match a word; a word is bound to a node — and
 * that split is what makes «never surprised» an engineering property rather than an aspiration.
 *
 * L0–L2 ARE THE TREE, L3–L4 ARE DIMENSIONS (§2.1). Read as five levels of a tree the ladder
 * explodes: fish alone is ~350 kinds × 55 presentations × 6 states × calibres. So family ·
 * category · type · sort answer WHAT IT IS and live here; form, prep, calibre and grade answer
 * HOW IT ARRIVES and are readings a line carries. A UN working party reached the same split
 * independently — UNECE's purchaser code puts the cut in field 2 and refrigeration, category,
 * feeding, fat trim, weight range and packing in fields 4–14.
 *
 * SOURCED vs AUTHORED IS IN THE DATA (§50b.3). Every node carries the source that produced it, so
 * the per-family coverage matrix can count them apart. Authored rows are the wings where Spanish
 * law delegates to custom — RD 474/2014 art. 20.1 hands the sale name to «la denominación
 * consagrada por el uso» and its list of consecrated names is explicitly non-exhaustive.
 *
 * COMPLETENESS IS BY CONSTRUCTION, AND IT IS THE SOURCE'S OWN COUNT (§52.1/§52.4). Every one of
 * GS1 GPC's 879 Food/Beverage bricks landed (${gpc.merged} onto nodes the Spanish sources already
 * named, ${gpc.minted} minted) and every one of the BOE's 1,105 registered species landed
 * (on ${boeByDisplay.size} distinct official commercial names). Nothing was chosen; the market
 * evidence rides as the \`traded\` attribute instead of as a shorter list.
 *
 * THIS BUILD: ${counts.nodes} nodes · ${counts.surfaces} distinct surfaces · ${counts.words} lexicon bindings.
 * Nodes by source: ${Object.entries(counts.bySrc).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}.
 * Nodes by level: ${Object.entries(counts.byLevel).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}.
 * Standing on a GPC English title, Spanish owed: ${gpc.pending}.
 */`;

const body = `${header}

export type RefLevel = 'family' | 'category' | 'type' | 'sort';

/** Where a row came from. \`authored\` is ours; everything else names the register that published
 *  it, so §50b.3's coverage matrix can count sourced and authored apart. */
export type RefSource =
  | 'boe' | 'mercamadrid' | 'mercabarna' | 'reg404' | 'reg2429' | 'rd4-2014'
  | 'provacuno' | 'interovic' | 'interovic-campaign' | 'gpc' | 'authored';

/** Which vocabulary a surface belongs to (§2.2). \`oficial\` is the BOE's own commercial name —
 *  «denominación oficial en todo el territorio nacional» — and outranks every other string. */
export type RefRegister = 'oficial' | 'cientifico' | 'comercial' | 'autonomico' | 'authored' | 'codigo';

export type RefNode = {
  id: string;
  name: string;
  level: RefLevel;
  parent?: string;
  src: RefSource;
  /** the Mercas quote it — market priority as an attribute, never as a reason to shorten the list */
  traded?: boolean;
  /** standing on its GPC English title: the category is sourced, the Spanish word is owed */
  pending?: boolean;
  /** the state words a source fused into the name and this reference took back off it (§4.2.3) */
  states?: string[];
};

const LEVEL: Record<string, RefLevel> = { f: 'family', c: 'category', t: 'type', s: 'sort' };
const SOURCE: Record<string, RefSource> = {
  b: 'boe', m: 'mercamadrid', x: 'mercabarna', a: 'authored', p: 'provacuno', i: 'interovic',
  j: 'interovic-campaign', r: 'rd4-2014', '4': 'reg404', '2': 'reg2429', g: 'gpc',
};

/* id|name|level|parent|src|flags|states */
const NODES = \`${esc(nodeLines.join('\n'))}\`;

/* id|what is inside it — §2.4's composition edge, for the gama IV/V nodes that are mixes */
const COMPOSITIONS = \`${esc(compLines.join('\n'))}\`;

export const REF_NODES: RefNode[] = NODES.split('\\n').map((line) => {
  const [id, name, level, parent, src, flags, states] = line.split('|');
  return {
    id,
    name,
    level: LEVEL[level],
    parent: parent || undefined,
    src: SOURCE[src],
    traded: flags.includes('t') || undefined,
    pending: flags.includes('p') || undefined,
    states: states ? states.split(',') : undefined,
  };
});

export { REF_WORDS, REF_ATTRS } from './reference-lexicon';
export type { RefWord, RefAttrs } from './reference-lexicon';

/** «A node that is a mix carries a composition edge listing the species nodes inside it» (§2.4). */
export const REF_COMPOSITIONS: ReadonlyMap<string, string> = new Map(
  COMPOSITIONS.split('\\n').filter(Boolean).map((l) => {
    const [id, what] = l.split('|');
    return [id, what] as const;
  }),
);

/* ── THE DIMENSION REGISTERS THE REFERENCE BRINGS (§2.3, FEED-IA §41.1) ────────────────────────
 * Closed, versioned lists with an \`otro\` escape that writes a proposal. Sourced ones name their
 * source: RD 4/2014's ibérico designations are legally enforced words, Reg (UE) 404/2011's state
 * codes are the normative fish register, and the rest are the trade extension §1.1 says has to be
 * built on top of them — «rodajas, lomos, ventresca, anillas, tacos» are on half the fish
 * albaranes in Spain and on none of the 32 normative presentation codes.
 */
export const REF_REGISTERS: Record<string, { label: string; src: string; words: string[] }> = {
${registerLines}
};

/* ── THE CALIBRE AXIS (§2.3, §8.5) ────────────────────────────────────────────────────────────
 * «The calibre band — the commercial identity of a farmed fish — has no home»: all 13 rows of the
 * real fish sheet were PARTIAL for this one axis. A band is not a word out of a list, it is a
 * SYNTAX — \`n-n\` (2-3 kg), \`n+\` (8+), \`n/n\` (30/40 count) — plus the trade's own named bands.
 * So the register carries both: the words, and the shape a written band takes.
 */
export const CALIBRE_WORDS: Record<string, string[]> = {
  fish: ['extra', 'grande', 'mediano', 'pequeño', 'terciado'],
  produce: ['GG', 'G', 'M', 'P', 'primera', 'segunda'],
  casing: ['28/30', '30/32', '32/34', '34/36', '36/38', '38/40'],
};

/** The families that PRICE by calibre, and the shape their bands take. A house selling packaged
 *  grocery never meets the field (§41.1: «an unused dimension costs nothing»). */
export const CALIBRE_FAMILIES: Record<string, 'weight' | 'count' | 'size'> = {
  'n-fish': 'weight',
  'n-produce': 'size',
  'n-ambient': 'count',
};
`;

const lexicon = `/* GENERATED FILE — do not hand-edit. Rebuild with \`node tools/build-reference.mjs\`.
 *
 * THE LEXICON (THE-STANDARD-CATALOG §2.2) — every string anyone has ever used for a node, with the
 * register it came from. It is the larger of the two stores by design: «the reference is small;
 * the vocabulary is large; the vocabulary is the part that compounds with every tenant.»
 *
 * It is a module of its own so it can be loaded on demand the day the surface wants that — the
 * regex layer standing behind \`ground\` is the synchronous answer in the meantime (§52.5).
 *
 * ${wordLines.length} bindings over ${wordOrder.length} distinct surfaces · ${attrLines.length} nodes carrying an external id.
 */
import type { RefRegister } from './reference-data';

export type RefWord = { w: string; node: string; reg: RefRegister };

/** The external ids a node carries: FAO alfa-3 and scientific name from the BOE, Mercabarna's and
 *  GS1's own product codes. The scientific name is the dedup key across sources (§4.2.1). */
export type RefAttrs = { fao: string[]; sci: string[]; codes: string[] };

const REGISTER: Record<string, RefRegister> = {
  o: 'oficial', s: 'cientifico', c: 'comercial', r: 'autonomico', a: 'authored', d: 'codigo',
};

/* surface|node|register — the surface is already folded (lowercase, unaccented, single-spaced) */
const WORDS = \`${esc(wordLines.join('\n'))}\`;

/* id|fao,fao|sci;sci|code,code */
const ATTRS = \`${esc(attrLines.join('\n'))}\`;

export const REF_WORDS: RefWord[] = WORDS.split('\\n').map((line) => {
  const [w, node, reg] = line.split('|');
  return { w, node, reg: REGISTER[reg] };
});

export const REF_ATTRS: ReadonlyMap<string, RefAttrs> = new Map(
  ATTRS.split('\\n').filter(Boolean).map((line) => {
    const [id, fao, sci, codes] = line.split('|');
    return [id, {
      fao: fao ? fao.split(',') : [],
      sci: sci ? sci.split(';') : [],
      codes: codes ? codes.split(',') : [],
    }] as const;
  }),
);
`;

writeFileSync(OUT, body, 'utf8');
writeFileSync(OUT_LEX, lexicon, 'utf8');
const bytes = Buffer.byteLength(body, 'utf8') + Buffer.byteLength(lexicon, 'utf8');
console.log(`wrote ${OUT}`);
console.log(`wrote ${OUT_LEX}`);
console.log(`  ${counts.nodes} nodes · ${counts.surfaces} surfaces · ${counts.words} bindings · ${(bytes / 1024).toFixed(0)} KB`);
console.log(`  by source: ${JSON.stringify(counts.bySrc)}`);
console.log(`  by level:  ${JSON.stringify(counts.byLevel)}`);
console.log(`  BOE: ${boeRows.length} rows → ${boeByDisplay.size} distinct commercial names (${fishTypes} kinds, ${fishSorts} sorts)`);
console.log(`  Mercamadrid: ${stats.mmNodes} nodes minted, ${stats.mmWords} variety strings bound`);
console.log(`  Mercabarna: ${stats.mbJoined} codes joined, ${stats.mbUnmatched} unmatched`);
console.log(`  GPC: ${gpc.bricks}/879 bricks landed (${gpc.merged} merged, ${gpc.minted} minted, ${gpc.named} Spanish-named)`);
console.log(`       ${gpc.enumerated} nodes off the cut/cultivar/cheese enumerations · ${gpc.pending} standing on an English title`);
console.log(`  traded (a Merca quotes it): ${traded.size} nodes`);
