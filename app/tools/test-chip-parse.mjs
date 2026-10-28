#!/usr/bin/env node
/* test-chip-parse.mjs — THE LIVE PARSER, HELD TO REAL TRADE PHRASES (FEED-IA §62).
 *
 * «Making the shit chips AS THEY TYPE, even better, so that they don't need to click at all, so it
 * feels as clear as prompting.» A parser that runs on every keystroke is a parser nobody will ever
 * read the output of by hand, so its bar is stated here instead: forty-one phrases the trade
 * actually writes — fish, meat cuts, produce, packaged pantry — each with the parts it MUST
 * resolve and the words that MUST stay theirs.
 *
 * THE PHRASES COME OFF THE REFERENCE, NEVER OFF MY MEMORY (§52). Every product word below was
 * verified present in `reference-lexicon.ts` before it was written into a case — the same
 * enumerated store the parser resolves against — so a phrase failing here is the parser failing,
 * never the test inventing a word the reference never had.
 *
 * FOUR INVARIANTS RUN ON EVERY PHRASE, not only the ones with expectations:
 *   COVERAGE      every token belongs to exactly one chip, in order, with nothing dropped and
 *                 nothing invented — «free text ALWAYS wins» made mechanical (§41.5)
 *   VERBATIM      the chips joined back are the words they typed, character for character (§65.3
 *                 — theirs harnessed, never fought: we never rename what they wrote)
 *   DETERMINISM   two parses of one string are the same object (a live parser that flickers
 *                 between readings on a re-render is a parser that jumps, §59.1)
 *   PREFIXES      every prefix of every phrase parses without throwing — the live path IS the
 *                 prefixes, one per keystroke
 *
 * PROVE IT RED BEFORE TRUSTING IT (the gates-fail-closed law): break one expectation on purpose
 * — change a `name` to a fish that is not there — run, watch it fail with the phrase named, put
 * it back. It was first run with `src/prototypes/cedar/chip-parse.ts` absent and failed at the compile step,
 * which is the honest red for «the organ does not exist yet».
 *
 * RUN:  node tools/test-chip-parse.mjs           (from baseweb/)
 *       node tools/test-chip-parse.mjs --verbose (print every phrase's reading)
 *
 * HOW IT LOADS TYPESCRIPT: `tools/ts-module.mjs` compiles the parser and its imports to CommonJS
 * inside `node_modules/.cache/` and the test requires that — the one loader every tool here uses.
 * A type error fails the compile and therefore the test, which makes this a tsc gate as well as
 * an assertion run.
 */
import { loadTypeScript } from './ts-module.mjs';

const VERBOSE = process.argv.includes('--verbose');

/* ── THE CASES ────────────────────────────────────────────────────────────────────────────────
 * `want` states only what MATTERS for that phrase; anything unstated is not asserted.
 *   name    the L1 the words landed on, by the reference's own name for it
 *   sort    the L2 residue
 *   qty     · unit    the amount at the head, and the unit it is in
 *   pack    the container it leaves in, and what it holds
 *   calibre the band (§8.5)
 *   dims    the closed registers the family carries — state · preparation · iberico · …
 *   free    words that MUST remain theirs, unclaimed, editable (§41.5)
 */
const CASES = [
  { text: 'five kg merluza', sector: 'fish', want: { qty: 5, unit: 'kg', name: 'Merluza' } },
  { text: 'dos cajas de tomate', sector: 'fruit', want: { qty: 2, unit: 'caja', name: 'Tomate' } },
  { text: 'merluza medio kilo', sector: 'fish', want: { qty: 0.5, unit: 'kg', name: 'Merluza' } },
  { text: 'two boxes merluza', sector: 'fish', want: { qty: 2, unit: 'caja', name: 'Merluza' } },
  /* ── FISH ─ the house's own sector: state, preparation, capture, weight bands ───────────── */
  { text: 'merluza sin cabeza congelada caja 6 kg', sector: 'fish',
    want: { name: 'Merluza', dims: { preparation: 'sin cabeza', state: 'congelado' },
            pack: { container: 'caja', holds: { amount: 6, unit: 'kg' } } } },
  { text: '5 kg merluza de pincho', sector: 'fish',
    want: { qty: 5, unit: 'kg', name: 'Merluza', sort: 'de pincho' } },
  { text: 'pulpo de roca cocido', sector: 'fish',
    want: { name: 'Pulpo', sort: 'de roca', dims: { state: 'cocido' } } },
  { text: 'lubina 2-3', sector: 'fish', want: { name: 'Lubina', calibre: '2-3' } },
  { text: 'gamba roja 30/40 caja 2 kg', sector: 'fish',
    want: { name: 'Gamba roja', calibre: '30/40', pack: { container: 'caja', holds: { amount: 2, unit: 'kg' } } } },
  { text: 'rape en lomos fresco', sector: 'fish',
    want: { name: 'Rape', dims: { preparation: 'en lomos', state: 'fresco' } } },
  { text: 'bacalao en salazón', sector: 'fish', want: { name: 'Bacalao', dims: { state: 'en salazón' } } },
  { text: 'salmón ahumado', sector: 'fish', want: { name: 'Salmón', dims: { state: 'ahumado' } } },
  { text: 'pez espada en rodajas ultracongelado', sector: 'fish',
    want: { name: 'Pez espada', dims: { preparation: 'en rodajas', state: 'ultracongelado' } } },
  { text: 'merlusa fresca', sector: 'fish', want: { name: 'Merluza', dims: { state: 'fresco' } } },
  { text: 'atun eviscerado 8+', sector: 'fish',
    want: { name: 'Atun', dims: { preparation: 'eviscerado' }, calibre: '8+' } },
  /* THE GRADE PASS LEFT THE PARSER (FEED-IA §197.2 «Remove class everywhere», §193.4). There is no
     third taxonomy between the SKU and the lot, so «clase A» claims nothing: both words fall
     through to the text pass and RIDE THE NAME as the amendment (§41.5 — their words stay theirs).
     The amount at the tail still reads, which is the rest of the phrase and why it is here. */
  { text: 'lubina de estero clase A 2 cajas', sector: 'fish',
    want: { name: 'Lubina', qty: 2, unit: 'caja', free: ['clase', 'A'] } },
  { text: 'almeja viva malla 1 kg', sector: 'fish',
    want: { name: 'Almeja', dims: { state: 'vivo' }, pack: { container: 'malla', holds: { amount: 1, unit: 'kg' } } } },
  { text: 'boquerón limpio', sector: 'fish', want: { name: 'Anchoa', dims: { preparation: 'limpio' } } },

  /* ── MEAT CUTS ─ the UNECE/PROVACUNO spine, the ibérico norm, curación, aging ───────────── */
  { text: 'solomillo de ternera gallega', sector: 'meat', want: { name: 'Solomillo' } },
  /* the reference holds «Jamón ibérico» as a SORT of Jamón and RD 4/2014 holds «de bellota» as a
     legally enforced attribute of it — so the phrase decomposes into all four parts at once, which
     is exactly what §62 asks the chips to show */
  { text: 'jamón ibérico de bellota loncheado', sector: 'meat',
    want: { name: 'Jamón', sort: 'ibérico',
            dims: { iberico: 'de bellota', preparation: 'loncheado' } } },
  { text: 'lomo alto 45 días', sector: 'meat', want: { name: 'Lomo alto', dims: { aging: '45 días' } } },
  { text: 'pechuga de pollo fileteada', sector: 'meat',
    want: { name: 'Pollo', dims: { preparation: 'fileteado' } } },
  { text: 'carne picada de ternera', sector: 'meat',
    want: { name: 'Carne picada', dims: { category: 'ternera' } } },
  { text: 'costillar de cerdo congelado saco 10 kg', sector: 'meat',
    want: { name: 'Costillar de cerdo', dims: { state: 'congelado' },
            pack: { container: 'saco', holds: { amount: 10, unit: 'kg' } } } },
  { text: 'chorizo sarta picante', sector: 'meat',
    want: { name: 'Chorizo', dims: { form: 'sarta', flavour: 'picante' } } },
  { text: 'media canal de vacuno', sector: 'meat', want: { name: 'Media canal de vacuno' } },
  /* the L1 is Pollo and the FACE is the wing — a sort whose parent's words do not lead it stays
     one chip saying what they wrote, and the two levels live on the line (§41.4) */
  { text: 'alitas de pollo congeladas', sector: 'meat',
    want: { name: 'Pollo', face: 'Alitas de pollo', dims: { state: 'congelado' } } },
  { text: 'panceta adobada bandeja 500 g', sector: 'meat',
    want: { name: 'Panceta', dims: { state: 'adobado' },
            pack: { container: 'bandeja', holds: { amount: 500, unit: 'g' } } } },
  /* a bare «ibérico» is no value of the ibérico norm — every one of RD 4/2014's is qualified —
     so it lands where it is true: the animal's category */
  { text: '3 piezas secreto ibérico', sector: 'meat',
    want: { qty: 3, unit: 'pieza', name: 'Secreto', dims: { category: 'ibérico' } } },
  { text: 'codillo fresco', sector: 'meat', want: { name: 'Codillo', dims: { state: 'fresco' } } },

  /* ── PRODUCE ─ maturity, size calibres, cultivation ─────────────────────────────────────── */
  { text: 'tomate rama griego', sector: 'fruit', want: { name: 'Tomate rama', sort: 'griego' } },
  { text: 'aguacate maduro', sector: 'fruit', want: { name: 'Aguacate', dims: { maturity: 'maduro' } } },
  { text: 'mango ecológico caja 4 kg', sector: 'fruit',
    want: { name: 'Mango', dims: { cultivation: 'ecológico' },
            pack: { container: 'caja', holds: { amount: 4, unit: 'kg' } } } },
  { text: 'calabacín G caja 5 kg', sector: 'fruit',
    want: { name: 'Calabacín', calibre: 'G', pack: { container: 'caja', holds: { amount: 5, unit: 'kg' } } } },
  { text: '10 manojos perejil', sector: 'fruit', want: { qty: 10, unit: 'manojo', name: 'Perejil' } },
  { text: 'platano verde', sector: 'fruit', want: { name: 'Platano', dims: { maturity: 'verde' } } },
  { text: 'lechuga iceberg', sector: 'fruit', want: { name: 'Lechuga' } },

  /* ── PACKAGED PANTRY ─ the GPC wings §51.23 asked the reference to grow ─────────────────── */
  { text: 'aceite de oliva virgen extra caja 12 ud', sector: 'fruit',
    want: { name: 'Aceite de oliva', pack: { container: 'caja', holds: { amount: 12, unit: 'ud' } } } },
  { text: 'arroz bomba saco 25 kg', sector: 'fruit',
    want: { name: 'Arroz', sort: 'bomba', pack: { container: 'saco', holds: { amount: 25, unit: 'kg' } } } },
  { text: 'queso manchego curado', sector: 'fruit',
    want: { name: 'Queso manchego', dims: { curacion: 'curado' } } },
  { text: 'alubia pinta', sector: 'fruit', want: { name: 'Alubia', sort: 'pinta' } },
  /* the reference knows the chickpea's varieties, so this is a SORT and not their free word —
     which is the §52 point: nothing gets added because somebody remembered it */
  { text: 'garbanzo pedrosillano', sector: 'fruit', want: { name: 'Garbanzo', sort: 'pedrosillano' } },
  { text: 'harina de trigo', sector: 'fruit', want: { name: 'Harina' } },
  { text: 'lenteja pardina saco 25 kg', sector: 'fruit',
    want: { name: 'Lenteja', pack: { container: 'saco', holds: { amount: 25, unit: 'kg' } } } },

  /* ── THEIRS, UNCLAIMED ─ free text always wins, and is never blocked (§41.5, §65.3) ─────── */
  /* §142 — editing an existing product must claim its name, never duplicate it as an amendment. */
  { text: 'Pulpo 21 caja', sector: 'fish', within: { node: 'n-octopus', name: 'Pulpo' },
    want: { name: 'Pulpo', qty: 21, unit: 'caja', freeExact: '' } },
  { text: '5 kg GAMBA ROJA selección matutina', sector: 'fish', within: { node: 'n-prawn', name: 'Gamba roja' },
    want: { name: 'Gamba roja', qty: 5, unit: 'kg', freeExact: 'selección matutina' } },
  { text: '21 caja pulpero', sector: 'fish', within: { node: 'n-octopus', name: 'Pulpo' },
    want: { name: 'Pulpo', qty: 21, unit: 'caja', freeExact: 'pulpero' } },

  { text: 'cosa rarísima del mercado', sector: 'fish', want: { free: ['rarísima', 'mercado'] } },
  { text: 'merluza de la lonja de anoche', sector: 'fish',
    want: { name: 'Merluza', free: ['lonja', 'anoche'] } },
];

/* ── THE RUNNER ───────────────────────────────────────────────────────────────────────────── */

const fold = (s) => String(s).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

let failures = 0;
const fail = (text, said) => { failures += 1; console.log(`  ✗ «${text}»\n      ${said}`); };

function check(parse, c) {
  /* No grade register is handed over: `ChipRegisters` dropped it with the grade pass (§197.2). */
  const registers = { sector: c.sector, within: c.within };
  const line = parse(c.text, registers);
  const w = c.want ?? {};

  /* the four invariants, on every phrase */
  const spanned = line.chips.reduce((n, ch) => n + (ch.to - ch.from), 0);
  if (spanned !== line.tokens.length) {
    fail(c.text, `coverage: ${spanned} tokens chipped of ${line.tokens.length}`);
  }
  let at = 0;
  for (const ch of line.chips) {
    if (ch.from !== at) fail(c.text, `chips are not contiguous at token ${at} (chip starts ${ch.from})`);
    at = ch.to;
  }
  const back = line.chips.map((ch) => ch.said).join(' ');
  if (fold(back) !== fold(c.text)) fail(c.text, `verbatim: chips read back as «${back}»`);
  const twice = parse(c.text, registers);
  if (JSON.stringify(twice) !== JSON.stringify(line)) fail(c.text, 'determinism: two parses differ');
  for (let i = 1; i <= c.text.length; i += 1) {
    try { parse(c.text.slice(0, i), registers); }
    catch (e) { fail(c.text, `prefix «${c.text.slice(0, i)}» threw: ${e.message}`); break; }
  }

  /* the phrase's own expectations */
  if (w.name !== undefined && line.name?.name !== w.name) {
    fail(c.text, `name: expected «${w.name}», read «${line.name?.name ?? '—'}»`);
  }
  if (w.face !== undefined && line.face !== w.face) {
    fail(c.text, `face: expected «${w.face}», read «${line.face}»`);
  }
  if (w.sort !== undefined && fold(line.sort?.name ?? '') !== fold(w.sort)) {
    fail(c.text, `sort: expected «${w.sort}», read «${line.sort?.name ?? '—'}»`);
  }
  if (w.qty !== undefined && line.quantity !== w.qty) {
    fail(c.text, `quantity: expected ${w.qty}, read ${line.quantity ?? '—'}`);
  }
  if (w.unit !== undefined && line.unit !== w.unit) {
    fail(c.text, `unit: expected «${w.unit}», read «${line.unit ?? '—'}»`);
  }
  if (w.calibre !== undefined && line.dimensions.calibre !== w.calibre) {
    fail(c.text, `calibre: expected «${w.calibre}», read «${line.dimensions.calibre ?? '—'}»`);
  }
  if (w.pack) {
    const p = line.packaging;
    if (!p || p.container !== w.pack.container) {
      fail(c.text, `packaging: expected «${w.pack.container}», read «${p?.container ?? '—'}»`);
    } else if (w.pack.holds && (p.holds?.amount !== w.pack.holds.amount || p.holds?.unit !== w.pack.holds.unit)) {
      fail(c.text, `packaging holds: expected ${w.pack.holds.amount} ${w.pack.holds.unit}, read `
        + `${p.holds ? `${p.holds.amount} ${p.holds.unit}` : '—'}`);
    }
  }
  for (const [id, value] of Object.entries(w.dims ?? {})) {
    if (line.dimensions[id] !== value) {
      fail(c.text, `${id}: expected «${value}», read «${line.dimensions[id] ?? '—'}»`);
    }
  }
  if (w.freeExact !== undefined && line.free !== w.freeExact) {
    fail(c.text, `free text: expected «${w.freeExact}», read «${line.free}»`);
  }
  for (const word of w.free ?? []) {
    const kept = line.chips.some((ch) => ch.part === 'text' && fold(ch.said) === fold(word));
    if (!kept) fail(c.text, `free text: «${word}» was claimed instead of staying theirs`);
  }

  if (VERBOSE) {
    console.log(`  «${c.text}»`);
    for (const ch of line.chips) {
      console.log(`      ${String(ch.part).padEnd(10)} ${String(ch.said).padEnd(24)}`
        + `${ch.value ?? ch.reads ?? ''}`);
    }
  }
  return line;
}

console.log('chip-parse — the live parser, against the trade\'s own phrases (FEED-IA §62)\n');
const { parseChips } = loadTypeScript('src/prototypes/cedar/chip-parse.ts', 'chip-parse-test');

const t0 = Date.now();
const lines = CASES.map((c) => check(parseChips, c));
const ms = Date.now() - t0;

/* ── THE COVERAGE FIGURE, STATED HONESTLY (§50b: balance is MEASURED) ─────────────────────── */
let tokens = 0;
let resolved = 0;
const parts = {};
for (const line of lines) {
  tokens += line.tokens.length;
  for (const ch of line.chips) {
    parts[ch.part] = (parts[ch.part] ?? 0) + 1;
    if (ch.part !== 'text') resolved += ch.to - ch.from;
  }
}
console.log(`\n  phrases       ${CASES.length}`);
console.log(`  tokens        ${tokens} — ${resolved} resolved, ${tokens - resolved} left theirs `
  + `(${Math.round((resolved / tokens) * 100)}% read)`);
console.log(`  chips by part ${Object.entries(parts).sort((a, b) => b[1] - a[1])
  .map(([p, n]) => `${p} ${n}`).join(' · ')}`);
console.log(`  every prefix of every phrase parsed — ${CASES.reduce((n, c) => n + c.text.length, 0)} live reads in ${ms} ms`);

if (failures > 0) {
  console.log(`\n  RED — ${failures} failure${failures === 1 ? '' : 's'}\n`);
  process.exit(1);
}
console.log('\n  GREEN\n');
