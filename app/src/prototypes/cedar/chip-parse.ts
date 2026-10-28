/* THE LINE SPEAKS PROMPT — the live parser (FEED-IA §62).
 *
 * «Even I'd say just making the shit chips AS THEY TYPE, even better, so that they don't need to
 * click at all, so it feels as clear as prompting, which means "live" "realtime" AI.»
 *
 * ═══ WHAT THIS FILE IS ══════════════════════════════════════════════════════════════════════
 * ONE FUNCTION, run on every keystroke, that turns a typed stream into structured CHIPS —
 * quantity · unit · name · sort · class · calibre · packaging · prep · state · the family's other
 * registers — and leaves everything it could not read as THEIRS. It is pure, synchronous and
 * deterministic: the same string gives the same chips, always, so a re-render can never flicker a
 * reading (§59.1, geometry stays calm) and a drive can assert on it.
 *
 * ═══ THE ONE MECHANIC THAT MAKES «AS THEY TYPE» POSSIBLE ════════════════════════════════════
 * A CHIP IS A SPAN, NEVER A REPLACEMENT. Every chip names a run of THEIR OWN TOKENS and carries
 * their characters verbatim; the reading rides ALONGSIDE as `reads`/`value`. So the organ draws
 * the chip's skin AROUND the words already on screen and nothing moves, nothing is rewritten and
 * nothing is pulled out from under the caret — which is precisely what stopped `detail.tsx`'s
 * `land()` from running live («it runs on COMMIT, never on every keystroke, because a field that
 * pulled characters out from under a caret is unusable»). §62 asks for live; this is how live is
 * affordable.
 *
 * Two consequences the tests hold us to: the chips COVER the tokens exactly once, in order, with
 * no gaps; and joining them back gives the string they typed. `tools/test-chip-parse.mjs` asserts
 * both on all 41 phrases.
 *
 * ═══ FREE TEXT ALWAYS WINS (§41.5, §65.3) ═══════════════════════════════════════════════════
 * A word no register claims becomes a `text` chip: still a chip — walkable, editable, addressable
 * — and never a block, never a correction, never a rename. «Their names, their structure, their
 * order stay THEIRS on the surface; our reference resolves BENEATH their words.» That is why the
 * organ draws a `text` chip with no skin at all: the recognition is the box, so the absence of a
 * box is the honest drawing of «we have not recognised this, and it stands anyway».
 *
 * ═══ WHERE THE WORDS COME FROM (§52) ════════════════════════════════════════════════════════
 * Nothing here holds a list of what exists. The kinds and sorts are read out of the ENUMERATED
 * reference through `catalogue.ts` — `readLexicon` over the 9,691 bindings first (retrieval), then
 * the fuzzy pass over the tree for typos — and the attribute registers are the reference's own
 * closed registers via `dimensionsFor`/`dimensionClaim`. The two registers this file does own are
 * MEASURES and CONTAINERS, and they are honest about it: they are units, not categories of goods,
 * and §52 enumerates what is SOLD, never how it is PACKED. A house extends the containers from its
 * own catalogue by handing `registers.containers` — which is §65.3's «theirs harnessed» applied to
 * the one register the databases do not carry.
 *
 * ═══ ONE ORGAN, EVERY ENTRY SURFACE (§62.4) ═════════════════════════════════════════════════
 * «This is THE entry grammar for every product-entry surface — the sheet's add-a-line, the New
 * Product modal, the catalog's search — ONE shared organ, designed once, reused everywhere.» So
 * this file knows nothing about a sale, a cast or a screen: it takes a string and a few registers
 * and hands back a reading. `chip-entry.tsx` is its one surface; the consumers hand it their own
 * registers and take the `ChipLine` back.
 *
 * ═══ AND EVERY CHIP IS TRAINING DATA (§62.4, §64.1) ═════════════════════════════════════════
 * «Every chip is structure the system learns from… entering products IS teaching.» The reading is
 * kept WITH the words that produced it — `said` beside `reads`/`value` on every chip — so a trace
 * of a corrected line carries both what they wrote and what we read, which is the pair the next
 * prediction trains on. Nothing here throws their words away to store ours.
 *
 * ═══ WHAT IS DELIBERATELY LEFT TO THE BACKEND ═══════════════════════════════════════════════
 * §41.7 and §62.1 both name an LLM standing behind this. It is not here and it is not faked here:
 * this is the retrieval half — exact, fuzzy, register — running in under a millisecond on a
 * keystroke, which is what the model would be asked to beat rather than replace (§4.3's
 * «retrieval-first, model-second»). The design build shows no spinner it has not earned.
 */
import type { SectorId } from '../../scenarios/meta';
import {
  AMENDMENTS, SORTS, TREE,
  ancestorsOf, bandsFor, childrenOf, claims, dimensionsFor, familyKeyOf, foldWord,
  nameOfNode, nodeOf, parentOf, readBand, readLexicon, residueOfName,
  type Dimension, type DimensionId, type TreeNode,
} from './catalogue';

/* ── WHAT A TYPED LINE DECOMPOSES INTO ────────────────────────────────────────────────────── */

/**
 * The parts §62 names, plus the two the reference itself carries.
 *
 * `dimension` is the catch-all for the family's other closed registers — ibérico, curación,
 * format, flavour, category, capture, cultivation, maturity, aging — because a chip per register
 * would be eleven words of vocabulary for one idea: «a fact about the goods, out of a known list».
 * The chip names WHICH register answered in `dimension`, so nothing is lost by the grouping.
 */
export type ChipPart =
  | 'quantity'   // the number they asked for
  | 'unit'       // the unit that number is in
  | 'name'       // L1 · the kind
  | 'sort'       // L2 · the variety, origin or method
  | 'prep'       // how it is prepared
  | 'state'      // alive · fresh · frozen · cooked
  | 'calibre'    // the band the family prices by (§8.5)
  | 'packaging'  // the container it leaves in, and what that container holds
  | 'dimension'  // every other closed register the family carries
  | 'text';      // theirs, unclaimed — never blocked (§41.5)

/** A word of the typed stream, with where it starts, so a caret can be mapped to a chip. */
export type Token = { said: string; at: number };

/**
 * ONE CHIP — a run of their tokens, and what the reference read in it.
 *
 * `said` is always exactly what they typed. `reads`/`value` are ours, and they never replace it.
 */
export type Chip = {
  /** the tokens it covers, `[from, to)` — contiguous, and every token belongs to exactly one */
  from: number;
  to: number;
  /** their own characters, verbatim */
  said: string;
  part: ChipPart;
  /** the reference node a name or a sort landed on */
  node?: string;
  /** the reference's own name for what they wrote. A READING, never a rename (§65.3). */
  reads?: string;
  /** the register value a closed-register chip resolved to — «congelado» for «congelada» */
  value?: string;
  /** which closed register answered */
  dimension?: DimensionId;
  /** the number a quantity chip carries */
  amount?: number;
  /** the unit a fused amount carries — «6kg» is one token and two facts */
  unit?: string;
  /** what a packaging chip says the container holds */
  holds?: { amount: number; unit: string };
  /** the reading had to guess — the lost-hyphen band, flagged rather than passed off (§8.5) */
  ambiguous?: boolean;
};

/** What a packaging chip resolved to, lifted out for the consumer that has to store it. */
export type Packaging = { container: string; holds?: { amount: number; unit: string }; said: string };

/** The whole reading — the chips to draw, and the parts a consumer commits. */
export type ChipLine = {
  /** the string they typed */
  said: string;
  tokens: Token[];
  /** in writing order, covering every token exactly once */
  chips: Chip[];
  /** the deepest node the words support, where they support one */
  node?: string;
  /** L1 · what it is */
  name?: { node: string; name: string; said: string };
  /** L2 · which one */
  sort?: { node?: string; name: string; said: string };
  quantity?: number;
  unit?: string;
  packaging?: Packaging;
  /** every closed register that answered, by its own id */
  dimensions: Partial<Record<DimensionId, string>>;
  /** their words nothing claimed — the amendment that rides the name (§41.5) */
  free: string;
  /** the name a painting is looked up by (§41.5's little photos) */
  face: string;
  /** how much of what they typed the reference answered, 0–1. Stated, never boasted. */
  read: number;
};

/** What the caller knows and this file cannot: the sector, its own containers, and — on the edit
 *  path — the kind the line already stands on.
 *
 *  ⚠ THE GRADE REGISTER LEFT THIS TYPE (FEED-IA §197.2 «Remove class everywhere», §193.4). The SKU
 *  in the title carries what the market sells by and the lot carries when the goods came in, so
 *  there is no third taxonomy for a caller to hand over. A grade word a person still types is
 *  THEIRS: it stays a `text` chip and rides the name as the amendment (§41.5). */
export type ChipRegisters = {
  /** the sector, so another house's learned sorts never appear and a tie reads in its own world */
  sector: SectorId;
  /** the containers this house packs in, off its own catalogue — extends, never replaces, the
   *  trade's own (§65.3: their structure stays theirs) */
  containers?: string[];
  /** THE EDIT PATH'S PRE-CLAIMED KIND (§41.5): editing a line that already stands, the kind is
   *  decided by the line, so the words are judged INSIDE it and can only move the sort or the
   *  attributes. «A typo in de pincho edits the sort, never the kind», by construction. */
  within?: { node: string; name: string };
};

/* ── THE TWO REGISTERS THIS FILE OWNS, AND WHY THEY ARE HERE ──────────────────────────────────
 * A unit is not a category of goods, so §52's «ingest the databases whole» does not reach it: GPC
 * enumerates what is sold, the BOE enumerates species, and neither says what a Spanish fish house
 * puts a merluza in. These two lists are therefore AUTHORED and say so — the same standing the
 * reference gives `CALIBRE_WORDS` — and they are seeded from the units this build's own casts and
 * price sheets are actually written in (`Product.unit` and `Product.pack.unit` across
 * `scenarios/data/`: kg · caja · pieza · saco · manojo · madeja) plus the containers the trade's
 * albaranes carry. A house whose word is missing hands `registers.containers` and is understood.
 *
 * MEASURES vs CONTAINERS is the whole distinction: a measure MEASURES the goods (kg, g, l, ud), a
 * container HOLDS them (caja, saco, malla). It is what tells «caja 6 kg» — the format the goods
 * leave in — apart from «6 kg» — the amount they asked for. Both are units in the ordinary sense
 * and the line's `unit` may be either, which is why they are one lookup with two roles.
 */

/** The words a person writes for a measure, folded to the unit the app stores. */
export const MEASURE_WORDS: Record<string, string> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', k: 'kg',
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  l: 'l', lt: 'l', litro: 'l', litros: 'l', ml: 'ml',
  ud: 'ud', uds: 'ud', u: 'ud', unidad: 'ud', unidades: 'ud',
  docena: 'docena', docenas: 'docena',
};

/** The containers a house packs in. Extended per house, never replaced. */
export const CONTAINER_WORDS: Record<string, string> = {
  caja: 'caja', cajas: 'caja', cajon: 'caja', cajones: 'caja',
  box: 'caja', boxes: 'caja',
  bandeja: 'bandeja', bandejas: 'bandeja',
  barqueta: 'barqueta', barquetas: 'barqueta',
  saco: 'saco', sacos: 'saco',
  malla: 'malla', mallas: 'malla',
  bolsa: 'bolsa', bolsas: 'bolsa',
  palet: 'palet', palets: 'palet', pale: 'palet',
  cubeta: 'cubeta', cubetas: 'cubeta', cubo: 'cubo', cubos: 'cubo',
  garrafa: 'garrafa', garrafas: 'garrafa',
  botella: 'botella', botellas: 'botella',
  lata: 'lata', latas: 'lata', bote: 'bote', botes: 'bote', tarro: 'tarro', tarros: 'tarro',
  brick: 'brick', bricks: 'brick', estuche: 'estuche', estuches: 'estuche',
  pieza: 'pieza', piezas: 'pieza',
  manojo: 'manojo', manojos: 'manojo',
  madeja: 'madeja', madejas: 'madeja',
  bulto: 'bulto', bultos: 'bulto',
};

/** The trade's joining words. They join what they were written for and never stand alone as a
 *  reading — «de pincho» and «pincho» are one claim, and a stray «de» must never print. */
const JOINERS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'al', 'en', 'a', 'su']);

/* ── THE WORDS AN ORDER OPENS AND CLOSES WITH (the acceptance walk, P1-2) ─────────────────────
 * «hola, ponme 20 kg de merluza» came back as THREE lines, one of them «hola · off the catalogue»,
 * with Rocoto asking «Quick one on the hola — how much do you want?». The fuzzy pass reaches a node
 * from a word's first three letters and one edit, and «hola» is one edit from real goods — so the
 * commonest opening word in a Spanish WhatsApp order was landing on the albarán as a product.
 *
 * A GREETING IS NOT A THING ASKED FOR, and this is the closed register that says so. It is a
 * REGISTER and not a heuristic: a fixed, short list of the words a person opens and closes a
 * message with, in the two languages this trade writes in, matched EXACTLY (never fuzzily — a
 * courtesy list that spread by edit distance would start eating goods, which is the bug it exists
 * to fix, inverted). Everything else still reaches the reference exactly as it did.
 *
 * IT BLOCKS A CLAIM AND NOTHING ELSE. The word is still THEIRS — it stays in the text, it still
 * becomes their own chip in the composer — it simply never claims a node, so no line is built from
 * it and no question is asked about it.
 */
const COURTESY = new Set([
  /* Spanish */
  'hola', 'holas', 'buenas', 'buenos', 'dias', 'tardes', 'noches', 'gracias', 'saludos',
  'favor', 'porfa', 'porfavor', 'adios', 'hasta', 'luego', 'oye', 'oiga', 'perdona', 'perdon',
  'disculpa', 'disculpe', 'venga', 'vale',
  /* Catalan */
  'bon', 'bona', 'dia', 'tarda', 'vespre', 'nit', 'gracies', 'merces', 'merci', 'salut', 'adeu',
]);

/** Is this word one a message opens or closes with, rather than something asked for? */
const courtesy = (said: string): boolean => COURTESY.has(foldWord(said));

/** The tree family a sector reads in, so «aguja» is a garfish to a fishmonger and a chuck to a
 *  butcher — the reading is picked by the world the line is being written in. */
const FAMILY_OF_SECTOR: Record<SectorId, string> = {
  fish: 'n-fish', meat: 'n-meat', fruit: 'n-produce',
};

/** The longest surface anyone has bound to a node, so the window scan knows where to stop. */
const LEX_SPAN = 6;

/* ── THE FUZZY CANDIDATE SET ──────────────────────────────────────────────────────────────────
 * Indexed on the first three letters of every carrying word of a node's name, so a typo meets a
 * few dozen look-alikes instead of the whole encyclopedia. It is BUILT LAZILY, on the first
 * keystroke rather than at module load, because this file is imported by surfaces that may never
 * see a person type — and 4,700 nodes indexed at import is a cost paid by every screen.
 *
 * THE SEAM, NAMED (it is `catalogue.ts`'s `BY_HEAD` again). That index is private to the file that
 * owns the claim algorithm and this one needs the same shape to return TOKEN SPANS rather than a
 * `placed` list; the duplicate is the price of not editing a file another package is live in, and
 * it collapses the day one package owns both — `nearWord` exported from `catalogue.ts` is the whole
 * change. Both are built from `TREE`, so they cannot disagree about what exists.
 */
let HEADS: Map<string, TreeNode[]> | null = null;

const headsOf = (): Map<string, TreeNode[]> => {
  if (HEADS) return HEADS;
  const out = new Map<string, TreeNode[]>();
  for (const n of TREE) {
    for (const w of foldWord(n.name).split(' ')) {
      if (w.length < 3 || JOINERS.has(w)) continue;
      const key = w.slice(0, 3);
      const held = out.get(key);
      if (held) { if (!held.includes(n)) held.push(n); } else out.set(key, [n]);
    }
  }
  HEADS = out;
  return out;
};

/** The nodes a written word could still have meant, once its first three letters are believed. */
const nearWord = (written: string): TreeNode[] => headsOf().get(foldWord(written).slice(0, 3)) ?? [];

/** The carrying words of a phrase — the joining words removed, because they carry nothing. */
const meat = (phrase: string): string[] =>
  foldWord(phrase).split(' ').filter((w) => w.length > 0 && !JOINERS.has(w));

/* ── READING A NUMBER ─────────────────────────────────────────────────────────────────────── */

const NUMBER = /^(\d+(?:[.,]\d+)?)$/;
/** «6kg» — one token, two facts. A person moving fast does not press space. */
const FUSED = /^(\d+(?:[.,]\d+)?)([a-zA-ZñÑ]+)$/;

const SPOKEN_AMOUNTS: Readonly<Record<string, number>> = {
  one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, half:0.5,
  un:1, una:1, uno:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10, once:11, doce:12, medio:0.5, media:0.5,
};
const amountOf = (said: string, spoken = false): number | undefined => {
  const m = NUMBER.exec(said.trim());
  return m ? Number(m[1].replace(',', '.')) : spoken ? SPOKEN_AMOUNTS[foldWord(said)] : undefined;
};

/* ── THE PARSE ─────────────────────────────────────────────────────────────────────────────── */

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let m = re.exec(text);
  while (m) {
    out.push({ said: m[0], at: m.index });
    m = re.exec(text);
  }
  return out;
}

/**
 * THE CLAIM ALGORITHM, in the order the design decided (§41.5's order, corrected by the phrases
 * themselves). Each step judges its tokens against ITS OWN REGISTER ONLY and marks what it took,
 * so a later step can never re-read a word an earlier one already understood:
 *
 *   1 · AMOUNT     a leading number, and the unit written beside it — «5 kg merluza»
 *   2 · KIND       the lexicon leftmost-longest, then the fuzzy pass — and the sort it implies
 *   3 · GRADE      the house's closed register, announced or bare — and nothing else reaches it
 *   4 · CALIBRE    the band syntax, only where the family prices by one, never at the head
 *   5 · SORT       the kind's own descendants and the sorts this house's albaranes prove
 *   6 · PACKAGING  a container, and what it holds — «caja 6 kg» — or the count of containers
 *   7 · LOOSE AMOUNT  a number and a measure standing anywhere, where no amount was said yet
 *   8 · REGISTERS  the family's dimensions, then their own words for what no register holds
 *   9 · THEIRS     everything left, one chip per word, unblocked
 *
 * THE KIND GOES BEFORE THE GRADE, and the corpus is why. §41.5 puts the grade first because it is
 * cheapest — three words — but a grade register that reads «Extra» will take that word out of
 * «ACEITE DE OLIVA VIRGEN EXTRA», which is a product name in the reference and not a category of
 * anything. A one-word register may not cut a phrase the enumerated reference holds whole, so the
 * name claims its own words first and the grade reads what is left.
 *
 * WHY PACKAGING RUNS BEFORE THE REGISTERS: «caja» is one edit away from «caña», which is a real
 * value of the embutido format register — so a chorizo line would have read a box as a format if
 * the registers went first. The container is the more specific claim and takes its word first.
 */
export function parseChips(text: string, registers: ChipRegisters): ChipLine {
  const tokens = tokenize(text);
  const chips: Chip[] = [];
  /** which chip owns each token; `undefined` means still theirs */
  const owner: Array<number | undefined> = tokens.map(() => undefined);
  const dimensions: Partial<Record<DimensionId, string>> = {};

  const isFree = (i: number): boolean => i >= 0 && i < tokens.length && owner[i] === undefined;
  const spanSaid = (from: number, to: number): string =>
    text.slice(tokens[from].at, tokens[to - 1].at + tokens[to - 1].said.length);
  const joiner = (i: number): boolean =>
    i >= 0 && i < tokens.length && JOINERS.has(foldWord(tokens[i].said));

  const put = (from: number, to: number, part: ChipPart, extra: Partial<Chip> = {}): Chip => {
    const chip: Chip = { from, to, said: spanSaid(from, to), part, ...extra };
    const at = chips.length;
    chips.push(chip);
    for (let i = from; i < to; i += 1) owner[i] = at;
    return chip;
  };

  /** The joining word written IN FRONT of a claim belongs to that claim — «en rodajas» is one
   *  fact, and a loose «en» falling through to their free text would print «· en» on an albarán. */
  const absorbJoiner = (chip: Chip): void => {
    const before = chip.from - 1;
    if (!isFree(before) || !joiner(before)) return;
    owner[before] = chips.indexOf(chip);
    chip.from = before;
    chip.said = spanSaid(chip.from, chip.to);
  };

  const containers = containersOf(registers);
  const unitOf = (said: string): string | undefined => {
    const w = foldWord(said);
    return MEASURE_WORDS[w] ?? containers[w];
  };
  const containerOf = (said: string): string | undefined => containers[foldWord(said)];
  const measureOf = (said: string): string | undefined => MEASURE_WORDS[foldWord(said)];

  /* 1 · THE AMOUNT — a leading number, and the unit written beside it. It is the HEAD position
     that makes it an amount rather than a format: «5 kg merluza» is five kilos of hake and
     «merluza caja 5 kg» is a five-kilo box of it, and the trade writes both. */
  let quantity: number | undefined;
  let lineUnit: string | undefined;
  if (tokens.length > 0) {
    const head = tokens[0].said;
    const fused = FUSED.exec(head);
    // A spoken number needs an explicit adjacent measure/container; “media canal” keeps its name.
    const plain = amountOf(head, Boolean(tokens[1] && unitOf(tokens[1].said)));
    if (plain !== undefined) {
      quantity = plain;
      put(0, 1, 'quantity', { amount: plain });
      const beside = tokens[1] ? unitOf(tokens[1].said) : undefined;
      if (beside) {
        lineUnit = beside;
        const u = put(1, 2, 'unit', { value: beside });
        /* «2 cajas DE tomate» — the joining word belongs to the unit that asked for it */
        if (isFree(2) && joiner(2) && tokens[3]) {
          owner[2] = chips.indexOf(u);
          u.to = 3;
          u.said = spanSaid(u.from, u.to);
        }
      }
    } else if (fused && unitOf(fused[2])) {
      quantity = Number(fused[1].replace(',', '.'));
      lineUnit = unitOf(fused[2]);
      put(0, 1, 'quantity', { amount: quantity, unit: lineUnit });
    }
  }

  /* 2 · THE KIND — the enumerated reference, at the words' own depth.
     THE LEXICON ANSWERS FIRST AND IT IS ALSO WHAT KEEPS THIS FAST (§4.3, «retrieval-first,
     model-second»): 9,691 bound surfaces are an exact map lookup, and only the residue meets the
     fuzzy pass. LEFTMOST-LONGEST is the lexer's rule and the right one here — «solomillo de
     ternera gallega» must beat «solomillo», and the first thing a trade line names is what the
     line is about. */
  const prefer = FAMILY_OF_SECTOR[registers.sector];
  let claimed: { node: TreeNode; from: number; to: number } | undefined;
  if (!registers.within) {
    outer:
    for (let start = 0; start < tokens.length; start += 1) {
      const most = Math.min(LEX_SPAN, tokens.length - start);
      for (let len = most; len >= 1; len -= 1) {
        let open = true;
        for (let k = start; k < start + len; k += 1) if (!isFree(k)) { open = false; break; }
        if (!open) continue;
        const phrase = tokens.slice(start, start + len).map((t) => t.said).join(' ');
        /* THE COURTESY REGISTER GUARDS THE EXACT PASS TOO (P1-2). A one-word window that is a
           greeting is never a bound surface, whatever a lexicon of 9,691 of them happens to hold. */
        if (len === 1 && courtesy(phrase)) continue;
        const read = readLexicon(phrase, prefer);
        /* the window is a bound surface only when the reading is the WHOLE of it — otherwise
           `readLexicon` has answered about a shorter phrase inside it and a longer window would
           be claiming words it never read */
        if (!read || read.said !== foldWord(phrase)) continue;
        const node = nodeOf(read.node);
        if (!node) continue;
        claimed = shrink({ node, from: start, to: start + len }, tokens, prefer, registers);
        break outer;
      }
    }
    /* THE FUZZY PASS, over the nodes a typo could still have meant. «merlusa» reaches Merluza
       because they share their first three letters; a typo IN those three letters is not reached,
       and that is the honest limit (§41.5's own). A type beats a category, so «merluza» lands on
       the hake and not on the whitefish shelf above it. */
    if (!claimed) {
      const RANKED: Array<TreeNode['level']> = ['type', 'sort', 'category', 'family'];
      for (const level of RANKED) {
        if (claimed) break;
        for (let i = 0; i < tokens.length && !claimed; i += 1) {
          if (!isFree(i)) continue;
          const said = tokens[i].said;
          if (said.length < 4) continue;
          /* a greeting is one edit from real goods and is never one of them (P1-2) */
          if (courtesy(said)) continue;
          const node = nearWord(said).find(
            (n) => n.level === level && meat(n.name).some((w) => claims(said, w)),
          );
          if (node) claimed = { node, from: i, to: i + 1 };
        }
      }
    }
  }

  let name: ChipLine['name'];
  let sort: ChipLine['sort'];
  let node: string | undefined;

  if (registers.within) {
    name = { ...registers.within, said: '' };
    node = registers.within.node;
    /* The name editor opens with this product's own name. Claim that exact phrase so it cannot
       become an amendment as well; similar or additional words remain the person's text. */
    const heldName = foldWord(registers.within.name);
    const most = heldName.split(' ').filter(Boolean).length;
    held:
    for (let start = 0; start < tokens.length && most > 0; start += 1) {
      for (let length = 1; length <= most && start + length <= tokens.length; length += 1) {
        if (!isFree(start + length - 1)) break;
        if (foldWord(spanSaid(start, start + length)) !== heldName) continue;
        const chip = put(start, start + length, 'name', { node, reads: registers.within.name });
        name.said = chip.said;
        break held;
      }
    }
  } else if (claimed) {
    node = claimed.node.id;
    /* A SORT WRITTEN WHOLE NAMES ITS PARENT AS THE KIND AND ITSELF AS THE SORT, which is what
       the chips have to say. Where the parent's own words LEAD the run — «pulpo | de roca»,
       «tomate rama | griego» — the run splits into two chips, because that is what a person sees
       themselves having written. Where they do not — «alitas de pollo» hangs under Pollo and
       nobody writes «pollo alitas» — the run stays ONE chip saying what they wrote, and the two
       levels live on the line rather than on the skin. */
    const kindNode = claimed.node.level === 'sort'
      ? parentOf(claimed.node.id) ?? claimed.node
      : claimed.node;
    const split = leadOf(claimed, kindNode, tokens);
    if (split > claimed.from && split < claimed.to) {
      const head = put(claimed.from, split, 'name', { node: kindNode.id, reads: kindNode.name });
      const tail = put(split, claimed.to, 'sort',
        { node: claimed.node.id, reads: residueOfName(claimed.node.name, kindNode.name) });
      absorbJoiner(tail);
      name = { node: kindNode.id, name: kindNode.name, said: head.said };
      sort = {
        node: claimed.node.id,
        name: residueOfName(claimed.node.name, kindNode.name),
        said: tail.said,
      };
    } else {
      const one = put(claimed.from, claimed.to, 'name',
        { node: claimed.node.id, reads: claimed.node.name });
      name = { node: kindNode.id, name: kindNode.name, said: one.said };
      if (claimed.node.level === 'sort') {
        sort = {
          node: claimed.node.id,
          name: residueOfName(claimed.node.name, kindNode.name),
          said: one.said,
        };
      }
    }
  }

  /* 3 · THE GRADE PASS IS GONE (FEED-IA §197.2 «Remove class everywhere», §193.4).
     It claimed «clase A» and a bare «A» out of a closed register and wrote them to a third
     taxonomy between the SKU and the lot. There is no such taxonomy: the SKU carries what the
     market sells by, the lot carries when the goods came in. So a grade word claims nothing, falls
     through to the `text` pass below like every other word nothing claimed, and RIDES THE NAME as
     the amendment (§41.5 «their words stay theirs»). Nothing is lost and nothing is invented. */

  /* 4 · THE CALIBRE BAND (§8.5). It runs after the kind because the kind decides whether this
     family prices by a band at all — «GAMBA 30/40» is a count and «CAJA 30/40» is nothing — and
     before the sort so a band can never be eaten as one. It never touches the head, which belongs
     to the amount.

     AND THE LOST-HYPHEN READING IS GUARDED. «LUBINA 23» is the 2–3 band on a sheet whose hyphens
     died in transit, but «CAJA 12 UD» is a dozen units, and both are two ascending digits. So the
     guess is refused where the number is doing an ordinary number's job: standing after a
     container, or standing before a measure. A reading that had to guess says so (`ambiguous`);
     a reading that would have to guess AGAINST the evidence never happens. */
  if (node) {
    const bands = bandsFor(node);
    if (bands) {
      for (let i = 1; i < tokens.length; i += 1) {
        if (!isFree(i)) continue;
        const afterContainer = Boolean(containerOf(tokens[i - 1].said));
        const beforeMeasure = tokens[i + 1] ? Boolean(measureOf(tokens[i + 1].said)) : false;
        const band = readBand(tokens[i].said, bands === 'weight' && !afterContainer && !beforeMeasure);
        if (!band) continue;
        put(i, i + 1, 'calibre', { value: band.value, dimension: 'calibre', ambiguous: band.ambiguous });
        dimensions.calibre = band.value;
        break;
      }
    }
  }

  /* 5 · THE SORT — the kind's own descendants and the sorts this house's albaranes prove, and no
     wider set than that. THE LONGEST SORT WINS: «rama griego» is a finer thing than «rama», so a
     person who wrote both words gets both. */
  if (name && !sort) {
    const kind = name.node;
    const under = (id: string): boolean => id === kind || ancestorsOf(id).some((a) => a.id === kind);
    const candidates: Array<{ node?: string; name: string }> = [
      ...TREE.filter((n) => n.level === 'sort' && under(n.id))
        .map((n) => ({ node: n.id, name: residueOfName(n.name, name!.name) })),
      ...SORTS.filter((s) => s.sector === registers.sector && under(s.node))
        .map((s) => ({ node: s.node, name: residueOfName(s.name, name!.name) })),
    ].sort((a, b) => meat(b.name).length - meat(a.name).length);

    for (const c of candidates) {
      if (sort) break;
      const words = meat(c.name);
      if (words.length === 0) continue;
      for (let i = 0; i < tokens.length && !sort; i += 1) {
        if (!isFree(i)) continue;
        const run: number[] = [];
        let at = i;
        for (const w of words) {
          while (at < tokens.length && (!isFree(at) || joiner(at))) at += 1;
          if (at >= tokens.length || !claims(tokens[at].said, w)) break;
          run.push(at);
          at += 1;
        }
        if (run.length !== words.length) continue;
        /* a sort's words are written consecutively, and only the trade's own joining words may
           stand between them — «pulpo DE roca» is one phrase, «pulpo caja roca» is two
           coincidences and must not become a chip that swallows the box */
        let joined = true;
        for (let k = 1; k < run.length && joined; k += 1) {
          for (let g = run[k - 1] + 1; g < run[k]; g += 1) {
            if (!isFree(g) || !joiner(g)) { joined = false; break; }
          }
        }
        if (!joined) continue;
        const chip = put(run[0], run[run.length - 1] + 1, 'sort', { node: c.node, reads: c.name });
        absorbJoiner(chip);
        sort = { node: c.node, name: c.name, said: chip.said };
        node = c.node ?? node;
      }
    }
  }

  /* 6 · THE PACKAGING — «caja 6 kg» (§62.2: the title takes the trade's full sentence). A
     container standing anywhere but the head, then optionally what it holds.

     A NUMBER IN FRONT OF THE CONTAINER MAKES IT THE AMOUNT INSTEAD. «lubina 2 cajas» is two boxes
     of it, not a box format — the number counts the containers, and the container is then the unit
     that number is in. That is the same fact §35's own arithmetic states: a chip carries arithmetic
     or it does not exist. */
  let packaging: Packaging | undefined;
  for (let i = 1; i < tokens.length && !packaging; i += 1) {
    if (!isFree(i)) continue;
    const which = containerOf(tokens[i].said);
    if (!which) continue;

    const counted = isFree(i - 1) ? amountOf(tokens[i - 1].said, true) : undefined;
    if (counted !== undefined && quantity === undefined) {
      quantity = counted;
      lineUnit = which;
      put(i - 1, i, 'quantity', { amount: counted });
      put(i, i + 1, 'unit', { value: which });
      continue;
    }

    let to = i + 1;
    let holds: { amount: number; unit: string } | undefined;
    const after = isFree(to) && joiner(to) ? to + 1 : to;
    if (isFree(after)) {
      const fused = FUSED.exec(tokens[after].said);
      const plain = amountOf(tokens[after].said, true);
      if (plain !== undefined && isFree(after + 1) && measureOf(tokens[after + 1].said)) {
        holds = { amount: plain, unit: measureOf(tokens[after + 1].said)! };
        to = after + 2;
      } else if (fused && measureOf(fused[2])) {
        holds = { amount: Number(fused[1].replace(',', '.')), unit: measureOf(fused[2])! };
        to = after + 1;
      }
    }
    const chip = put(i, to, 'packaging', { value: which, holds });
    packaging = { container: which, holds, said: chip.said };
  }

  /* 7 · THE LOOSE AMOUNT — «merluza 5 kg», where nothing at the head said how much. A number and
     a measure standing together are an amount wherever they stand; a number the packaging already
     took is not seen here at all, which is what keeps «caja 6 kg» a format. */
  if (quantity === undefined) {
    for (let i = 0; i < tokens.length; i += 1) {
      if (!isFree(i)) continue;
      const plain = amountOf(tokens[i].said, true);
      const fused = FUSED.exec(tokens[i].said);
      if (plain !== undefined && isFree(i + 1) && measureOf(tokens[i + 1].said)) {
        quantity = plain;
        lineUnit = measureOf(tokens[i + 1].said);
        put(i, i + 1, 'quantity', { amount: plain });
        put(i + 1, i + 2, 'unit', { value: lineUnit });
        break;
      }
      if (fused && measureOf(fused[2])) {
        quantity = Number(fused[1].replace(',', '.'));
        lineUnit = measureOf(fused[2]);
        put(i, i + 1, 'quantity', { amount: quantity, unit: lineUnit });
        break;
      }
    }
  }

  /* 8 · THE FAMILY'S REGISTERS — preparation, state, and the rest the ladder grows (§41.1).
     `dimensionClaim`'s own rule, asked per value so the chip learns WHICH one: word against word,
     at the same fold-and-distance the kind used, so «congelada» reaches «congelado» here exactly
     as «merlusa» reaches Merluza above. ONE claim algorithm, several callers.

     THE NARROWER REGISTER WINS A SHARED WORD. «Curado» stands in the meat STATE register and in
     the CURACIÓN register, and a manchego is cured rather than in a state of curing — so the
     registers are tried SMALLEST FIRST, which in this reference is always the one gated to a
     branch (curación to cured · sausage · cheese; ibérico to pork) rather than the family-wide one.
     Size is a proxy for specificity here and it is stated as one; the day `catalogue.ts` exports
     its branch gates, this reads them instead.

     THEIR OWN WORDS CATCH WHAT NO REGISTER HOLDS (§65.3). A house that has written «sin cabeza»
     eleven times this month has named a thing the enumerated registers do not carry, and the
     amendment claims it. The other way round it must NOT go: our reference resolves BENEATH their
     words, so where a register already holds the word, the register's own value is the reading —
     and the chip still shows theirs, because `said` is never rewritten.

     MINIMAL RUNS, LEFTMOST. A value is looked for at one token, then two, then three, so «en
     salazón» takes the two words it needs and never three. */
  if (node) {
    const key = familyKeyOf(node);
    const dims = [...dimensionsFor(key, node)].sort((a, b) => a.words.length - b.words.length);

    const claimRun = (
      words: string[],
      value: string,
      part: ChipPart,
      dimension?: DimensionId,
    ): boolean => {
      for (let len = 1; len <= 3; len += 1) {
        for (let i = 0; i + len <= tokens.length; i += 1) {
          let open = true;
          for (let k = i; k < i + len; k += 1) if (!isFree(k)) { open = false; break; }
          if (!open) continue;
          const said = tokens.slice(i, i + len).map((t) => t.said);
          const every = words.every((w) => said.some((s) => claims(s, w)));
          const used = said.every((s) => words.some((w) => claims(s, w)));
          if (!every || !used) continue;
          const chip = put(i, i + len, part, { value, dimension });
          absorbJoiner(chip);
          return true;
        }
      }
      return false;
    };

    for (const d of dims) {
      if (dimensions[d.id]) continue;
      const value = pickValue(d, tokens, isFree);
      if (!value) continue;
      const words = meat(value);
      if (words.length === 0) continue;
      const part: ChipPart = d.id === 'state' ? 'state'
        : d.id === 'preparation' ? 'prep'
        : d.id === 'calibre' ? 'calibre' : 'dimension';
      if (claimRun(words, value, part, d.id)) dimensions[d.id] = value;
    }

    for (const a of AMENDMENTS) {
      if (a.sector !== registers.sector) continue;
      if (a.node !== node && !ancestorsOf(node).some((n) => n.id === a.node)) continue;
      const id: DimensionId = a.facet === 'state' ? 'state'
        : a.facet === 'size' ? 'calibre' : 'preparation';
      if (dimensions[id]) continue;
      const words = meat(a.word);
      if (words.length === 0) continue;
      if (claimRun(words, a.word, id === 'state' ? 'state' : 'prep', id)) dimensions[id] = a.word;
    }
  }

  /* 9 · THEIRS — every word no register claimed, one chip each, never blocked (§41.5). A `text`
     chip is a first-class chip: it walks with the arrows, it re-opens under the caret, and it goes
     onto the line as the amendment that rides the name. It simply wears no skin, because the skin
     IS the recognition and we have not recognised this. */
  for (let i = 0; i < tokens.length; i += 1) if (isFree(i)) put(i, i + 1, 'text');

  chips.sort((a, b) => a.from - b.from);

  const free = chips.filter((c) => c.part === 'text').map((c) => c.said).join(' ').trim();
  const held = chips.reduce((n, c) => n + (c.part === 'text' ? 0 : c.to - c.from), 0);

  return {
    said: text,
    tokens,
    chips,
    node,
    name,
    sort,
    quantity,
    unit: lineUnit,
    packaging,
    dimensions,
    free,
    face: node ? nameOfNode(node) : free || text.trim(),
    read: tokens.length === 0 ? 0 : held / tokens.length,
  };
}

/* ── THE WINDOW THAT CLAIMED TOO MUCH ─────────────────────────────────────────────────────────
 * A lexicon surface can carry words the node's own name does not — the reference says so itself:
 * `RefNode.states` is «the state words a source fused into the name and this reference took back
 * off it». So «bacalao en salazón» is BOUND to the plain Bacalao node, and a window that claimed
 * all three tokens would swallow a state into a name and §62 would lose the chip it exists to draw.
 *
 * THE SHRINK, and its two guards. From the right, a trailing token leaves the name when it is a
 * joiner, or when it is NOT one of the node's own words AND some register of the node's family
 * claims it — and only if the shorter window still reads as a node of its own. So «salmón ahumado»
 * becomes Salmón + ahumado, «panceta adobada» becomes Panceta + adobado, and «alitas de pollo»
 * does NOT shrink, because «pollo» is one of its own words even though the meat category register
 * also holds it. The node's own name outranks every register, which is the rule that keeps a
 * shrink from eating a real name.
 */
function shrink(
  hit: { node: TreeNode; from: number; to: number },
  tokens: Token[],
  prefer: string | undefined,
  registers: ChipRegisters,
): { node: TreeNode; from: number; to: number } {
  let { node, to } = hit;
  const { from } = hit;
  for (let guard = 0; guard < LEX_SPAN && to - from > 1; guard += 1) {
    const last = tokens[to - 1].said;
    if (!JOINERS.has(foldWord(last))) {
      if (meat(node.name).some((w) => claims(last, w))) break;
      if (!registerHolds(node, last, registers)) break;
    }
    /* a trailing joiner joins nothing, so the shorter window is measured without it */
    let end = to - 1;
    while (end > from && JOINERS.has(foldWord(tokens[end - 1].said))) end -= 1;
    if (end <= from) break;
    const phrase = tokens.slice(from, end).map((t) => t.said).join(' ');
    const read = readLexicon(phrase, prefer);
    if (!read || read.said !== foldWord(phrase)) break;
    const shorter = nodeOf(read.node);
    if (!shorter) break;
    node = shorter;
    to = end;
  }
  return { node, from, to };
}

/** Does any register of this node's family claim that written word? The question the shrink asks
 *  before it gives a word back — a word nothing else wants stays on the name. */
function registerHolds(node: TreeNode, written: string, registers: ChipRegisters): boolean {
  for (const d of dimensionsFor(familyKeyOf(node.id), node.id)) {
    for (const w of d.words) {
      const parts = meat(w);
      if (parts.length === 1 && claims(written, parts[0])) return true;
    }
  }
  for (const a of AMENDMENTS) {
    if (a.sector !== registers.sector) continue;
    const parts = meat(a.word);
    if (parts.length === 1 && claims(written, parts[0])) return true;
  }
  return false;
}

/** WHERE THE KIND'S OWN WORDS STOP INSIDE A CLAIMED RUN — the token index the sort starts at, or
 *  `from` where the kind does not lead the run at all. Joining words are walked past rather than
 *  matched, so «aceite de oliva | virgen extra» splits where a reader would split it. */
function leadOf(
  hit: { node: TreeNode; from: number; to: number },
  kindNode: TreeNode,
  tokens: Token[],
): number {
  if (hit.node.level !== 'sort') return hit.from;
  const words = meat(kindNode.name);
  if (words.length === 0) return hit.from;
  let at = hit.from;
  for (const w of words) {
    while (at < hit.to && JOINERS.has(foldWord(tokens[at].said))) at += 1;
    if (at >= hit.to || !claims(tokens[at].said, w)) return hit.from;
    at += 1;
  }
  return at;
}

/** The register value the written words support, tried against the free tokens only. It is the
 *  reference's own `dimensionClaim` rule, asked per value so the caller learns WHICH value. */
function pickValue(
  d: Dimension,
  tokens: Token[],
  isFree: (i: number) => boolean,
): string | undefined {
  const said = tokens.filter((_, i) => isFree(i)).map((t) => t.said);
  if (said.length === 0) return undefined;
  /* the longest value first, so «muy picante» beats «picante» where both were written */
  const words = [...d.words].sort((a, b) => meat(b).length - meat(a).length);
  return words.find((w) => {
    const parts = meat(w);
    return parts.length > 0 && parts.every((part) => said.some((s) => claims(s, part)));
  });
}

/** The containers this house packs in — the trade's own, plus whatever its catalogue added. */
function containersOf(registers: ChipRegisters): Record<string, string> {
  if (!registers.containers || registers.containers.length === 0) return CONTAINER_WORDS;
  const out = { ...CONTAINER_WORDS };
  for (const c of registers.containers) out[foldWord(c)] = c;
  return out;
}

/* ── THE SUGGESTIONS ──────────────────────────────────────────────────────────────────────────
 * «Suggestions appear below AS CHIPS with the little photos» (§62.3, §41.5). They are the same
 * object the field draws, one step before it is written — which is the whole reason they are
 * chips and not a list: a person who takes one has put a chip where a chip was going to be.
 *
 * AND THEY NEVER RESTRICT (§41.5): «they can always type anything». A suggestion is an offer to
 * save keystrokes, so the field commits whatever is typed whether or not it is on this list, and
 * nothing here can refuse a word.
 */
export type ChipSuggestion = {
  /** the words to put in — the reference's own, or the register's */
  word: string;
  part: ChipPart;
  node?: string;
  dimension?: DimensionId;
  /** the name a painting is looked up by — set on the parts that HAVE a face (§41.5: the main
   *  name and the sort). A register value has no face and is drawn as a plain chip. */
  face?: string;
  /** the tokens it would replace, `[from, to)` */
  from: number;
  to: number;
  /** the register it came out of, in the register's own label — a noun, one or two words, which
   *  is Base's own rule for a tag. It names the part; it never explains it. */
  register?: string;
  /** Rocoto's own reading rather than a search of what they typed — the one place the accent
   *  belongs on this surface (§51: the accent marks the AI's own act and nothing else) */
  rocoto?: boolean;
};

const SUGGESTION_CAP = 6;

/**
 * What could come next, given the reading and where the caret is.
 *
 * TWO REGISTERS OF OFFER, and they are different acts:
 *   THEY ARE TYPING A WORD    the offers are what that word could still become — the reference's
 *                             own names first (a kind is a palpable list and the L1 should always
 *                             land on one, §41.5), then the family's register values.
 *   THE WORD IS EMPTY         the offers are what this line is MISSING — the finer things under
 *                             the kind they have already named, then the registers its family
 *                             carries. That is Rocoto reading their line rather than their word,
 *                             so those carry the accent.
 */
export function suggestChips(
  line: ChipLine,
  at: number,
  registers: ChipRegisters,
  limit: number = SUGGESTION_CAP,
): ChipSuggestion[] {
  const typing = foldWord(line.tokens[at]?.said ?? '');
  const out: ChipSuggestion[] = [];
  const seen = new Set<string>();
  const from = Math.min(at, line.tokens.length);
  const to = line.tokens[at] ? at + 1 : from;

  /* ONE WORD, ONE OFFER. The dedup key is the WORD and not the word-and-part, because a house's
     own «verde» and the maturity register's «verde» are the same press to the person looking at
     the shelf — the first drive shot had both sitting there, twice, and a shelf that offers a
     person the same word twice is a shelf that has not been read. First offer wins, and the order
     below is the order of specificity, so the one that wins is the one that says more. */
  const offer = (s: Omit<ChipSuggestion, 'from' | 'to'>): void => {
    const key = foldWord(s.word);
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({ ...s, from, to });
  };

  /* WHAT THEY ARE TYPING, WIDENED. A prefix of three letters reaches the head index; two letters
     is answered by a walk of the tree, which is 4,700 rows of `startsWith` and cheaper than the
     index it would otherwise need. Below two letters nothing is offered, because everything is.

     THE ORDER IS THE REFERENCE'S OWN, on three keys and in this order:
       1 · THE NAME STARTS WITH WHAT THEY TYPED. A person typing «cab» means a word that begins
           «cab» — «Caballa», «Cabracho» — and «Andorrero del Cabo» is a coincidence of the third
           word. The first drive read that list and the coincidence was sitting at the top.
       2 · THE MARKET QUOTES IT (`traded`, §52.2 — «the market evidence rides as an attribute,
           never as a shorter list»). It is what makes a real fish beat a real-but-rare one
           without either of them leaving the reference.
       3 · THE LEVEL — a type before a sort before a shelf, the same rank the claim uses.
     Every one of them is a fact the reference carries; none of them is a hand-ordered list. */
  if (typing.length >= 2) {
    const pool = typing.length >= 3
      ? nearWord(typing)
      : TREE.filter((n) => foldWord(n.name).startsWith(typing));
    const RANK: Array<TreeNode['level']> = ['type', 'sort', 'category', 'family'];
    const hits = pool
      .map((n) => ({ n, starts: foldWord(n.name).startsWith(typing) }))
      .filter(({ n, starts }) => starts || meat(n.name).some((w) => claims(typing, w)))
      .sort((a, b) => {
        if (a.starts !== b.starts) return a.starts ? -1 : 1;
        if (Boolean(a.n.traded) !== Boolean(b.n.traded)) return a.n.traded ? -1 : 1;
        return RANK.indexOf(a.n.level) - RANK.indexOf(b.n.level);
      });
    for (const { n } of hits) offer({ word: n.name, part: 'name', node: n.id, face: n.name });
  }

  /* THE FINER THINGS UNDER WHAT THEY ALREADY NAMED — «Merluza» offers «de pincho». It is
     Rocoto's own reading of their line, so it carries the accent. */
  if (line.name && !line.sort) {
    const kind = line.name.name;
    const under = [
      ...childrenOf(line.name.node).filter((n) => n.level === 'sort' || n.level === 'type'),
    ];
    for (const n of under) {
      const residue = residueOfName(n.name, kind);
      if (typing && !foldWord(residue).startsWith(typing) && !claims(typing, meat(residue)[0] ?? '')) continue;
      offer({ word: residue, part: 'sort', node: n.id, face: n.name, rocoto: !typing });
    }
    for (const s of SORTS) {
      if (s.sector !== registers.sector) continue;
      if (s.node !== line.name.node && !ancestorsOf(s.node).some((a) => a.id === line.name!.node)) continue;
      const residue = residueOfName(s.name, kind);
      if (typing && !foldWord(residue).startsWith(typing)) continue;
      offer({ word: residue, part: 'sort', node: s.node, face: s.name, rocoto: !typing });
    }
  }

  /* THE REGISTERS THIS FAMILY CARRIES — their own words first, then the enumerated lists.
     A register already answered is not offered again: one fact, one chip. */
  if (line.node) {
    for (const a of AMENDMENTS) {
      if (a.sector !== registers.sector) continue;
      if (a.node !== line.node && !ancestorsOf(line.node).some((n) => n.id === a.node)) continue;
      const id: DimensionId = a.facet === 'state' ? 'state' : 'preparation';
      if (line.dimensions[id]) continue;
      if (typing && !foldWord(a.word).startsWith(typing)) continue;
      offer({
        word: a.word,
        part: id === 'state' ? 'state' : 'prep',
        dimension: id,
        register: 'Yours',
        rocoto: !typing,
      });
    }
    for (const d of dimensionsFor(familyKeyOf(line.node), line.node)) {
      if (line.dimensions[d.id]) continue;
      for (const w of d.words) {
        if (typing && !foldWord(w).startsWith(typing) && !meat(w).some((p) => claims(typing, p))) continue;
        offer({
          word: w,
          part: d.id === 'state' ? 'state' : d.id === 'preparation' ? 'prep' : d.id === 'calibre' ? 'calibre' : 'dimension',
          dimension: d.id,
          register: d.label,
        });
      }
    }
  }

  /* THE CONTAINERS, once the goods are named and nothing has said how it leaves. */
  if (line.node && !line.packaging && typing.length >= 2) {
    for (const [word, held] of Object.entries(containersOf(registers))) {
      if (!word.startsWith(typing)) continue;
      offer({ word: held, part: 'packaging', register: 'Packaging' });
    }
  }

  return out.slice(0, limit);
}

/**
 * A suggestion, taken — the pure edit, so the organ holds no parsing of its own.
 *
 * It returns the tokens and WHERE THE CARET GOES, because a person who took a suggestion is
 * mid-sentence: the caret lands on a fresh empty token after what they just took, and typing
 * carries on. Taking a suggestion is therefore exactly one keystroke different from typing it,
 * which is §62's «they don't need to click at all» kept true from both directions.
 */
export function applyChip(
  tokens: string[],
  s: ChipSuggestion,
): { tokens: string[]; active: number } {
  const words = s.word.trim().split(/\s+/).filter(Boolean);
  const next = [...tokens.slice(0, s.from), ...words, ...tokens.slice(s.to)];
  const active = s.from + words.length;
  if (next[active] === undefined) next.push('');
  return { tokens: next, active };
}
