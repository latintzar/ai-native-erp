/* THE AUTHORED WINGS — the part of the standard reference no public source supplies.
 *
 * THE-STANDARD-CATALOG §1.2: «there is no authoritative Spanish register of meat cut names, and
 * the law explicitly says there will not be one» — RD 474/2014 art. 20.1 delegates the sale name
 * to «la denominación consagrada por el uso», and its Anexo II is explicitly non-exhaustive. §4.1
 * calls the resulting job `author_trade_prep`: «the irreducible human piece».
 *
 * FEED-IA §50b.2 names the wings, in this order: EMBUTIDOS/ELABORADOS as a full wing (the only
 * real uploads we hold are an embutidos house, so it is first-contact material), meat cuts beyond
 * PROVACUNO's 22 (pork · poultry · lamb complete), gama IV/V lines.
 *
 * EVERY ROW HERE IS `authored` IN THE DATA. A reader of the generated module can tell a row the
 * BOE published from a row we wrote, because §50b.3's coverage matrix is only honest if the two
 * are countable apart. Rows carrying a `src` other than 'authored' cite the norm they come from —
 * PROVACUNO's despiece (22 beef cuts, §1.2), INTEROVIC's guide (6+10 lamb), RD 4/2014 (the
 * ibérico designations).
 *
 * FORMAT. `kinds` are L1 TYPE nodes under a category; `sorts` are the L2 nodes under a kind, and a
 * sort exists only where the trade names it and prices it apart (§2.1). `words` are extra lexicon
 * surfaces for the node — the trade's other names for the same thing, never a new node (§2.2: «a
 * node is never renamed to match a word; a word is bound to a node»).
 */

/** Categories the authored wings need that the 46-node tree does not hold yet. */
export const AUTHORED_CATEGORIES = [
  /* fish — the BOE spine carries algae and the trade splits blanco from azul */
  { id: 'n-bluefish', name: 'Pescado azul', parent: 'n-fish' },
  { id: 'n-seaweed', name: 'Algas', parent: 'n-fish' },
  /* THE SHELL SHELF (PAINTINGS-TRACKER §35.8's «the bivalve»). A pescadería sells the shelled
   * molluscs off their own counter and the BOE spine already grouped them — `FISH_SHELF` carried
   * one regex for crustaceans and a SECOND for almeja · mejillón · ostra · vieira · navaja ·
   * berberecho · bígaro · cañaílla, both pointed at Marisco. Splitting the rule that already
   * existed is what turns «the bivalve» from a look with nowhere to hang into a rung. The trade
   * word covers the gastropods on the same counter, which «Bivalvos» would not. */
  { id: 'n-bivalve', name: 'Marisco de concha', parent: 'n-fish' },
  /* meat — the tarifa's own familia column names two shelves the tree lacks (§8.6) */
  { id: 'n-cooked', name: 'Cocidos y fiambres', parent: 'n-meat' },
  { id: 'n-lamb', name: 'Cordero y cabrito', parent: 'n-meat' },
  { id: 'n-game', name: 'Caza y otras carnes', parent: 'n-meat' },
  /* the families §2.5 lists, seeded here and filled by Mercamadrid's R market */
  /* THE ROOT SHELF (§35.8's «the root»). Mercamadrid splits its produce only into frutas and
   * hortalizas, so patata, boniato, zanahoria, nabo, chirivía and remolacha all landed on the
   * leaf shelf beside the lettuces. They are stored, priced and displayed apart. */
  { id: 'n-root', name: 'Raíces y tubérculos', parent: 'n-produce' },
  { id: 'n-dairy', name: 'Lácteos', level: 'family' },
  { id: 'n-cheese', name: 'Queso', parent: 'n-dairy' },
  { id: 'n-milk', name: 'Leche y nata', parent: 'n-dairy' },
  { id: 'n-butter', name: 'Mantequillas y grasas lácteas', parent: 'n-dairy' },
  { id: 'n-yoghurt', name: 'Yogures y postres', parent: 'n-dairy' },
  { id: 'n-oils', name: 'Aceites y grasas', level: 'family' },
  { id: 'n-preserves', name: 'Conservas y encurtidos', level: 'family' },
  { id: 'n-pulses', name: 'Legumbre y arroz', level: 'family' },
  { id: 'n-flour', name: 'Pasta y harinas', level: 'family' },
  { id: 'n-bakery', name: 'Panadería y bollería', level: 'family' },
  { id: 'n-grocery', name: 'Despensa', level: 'family' },
  { id: 'n-drinks', name: 'Bebidas', level: 'family' },
];

/* ── THE EMBUTIDOS / ELABORADOS WING (§8.10.1) ────────────────────────────────────────────────
 * 47 of the exam's 60 rows sit here and the tree held three of their kinds. The wing is written
 * at the grain the tarifa prices at: the KIND is the node, and the words that carry the price —
 * ibérico · bellota · serrano · reserva · cocido — are closed registers on the line (§8.10.2),
 * never adjectives fused into a node name.
 */
export const CURED = [
  { id: 'n-ham', kind: 'Jamón', words: ['jamon curado', 'jamon de bodega', 'pernil'], sorts: [
    { name: 'Jamón serrano', words: ['serrano', 'jamon serrano bodega'] },
    { name: 'Jamón ibérico', words: ['pata negra', 'jamon iberico de bellota', 'jamon iberico de cebo'] },
    { name: 'Jamón de Teruel', words: ['teruel'] },
    { name: 'Jamón de Trevélez', words: ['trevelez'] },
  ] },
  { id: 'n-shoulder-ham', kind: 'Paleta', words: ['paletilla curada', 'paleta curada'], sorts: [
    { name: 'Paleta serrana', words: ['paleta serrana'] },
    { name: 'Paleta ibérica', words: ['paletilla iberica'] },
  ] },
  { id: 'n-cured-loin', kind: 'Lomo embuchado', words: ['caña de lomo', 'lomo curado', 'lomito'], sorts: [
    { name: 'Lomo ibérico', words: ['lomo iberico de bellota'] },
  ] },
  { id: 'n-cecina', kind: 'Cecina', words: ['cecina de vacuno'], sorts: [
    { name: 'Cecina de León', words: ['cecina leon'] },
  ] },
  { id: 'n-bacon', kind: 'Bacon', words: ['beicon', 'bacon ahumado', 'tocino entreverado ahumado'] },
  { id: 'n-morcon', kind: 'Morcón', words: [] },
  { id: 'n-panceta-curada', kind: 'Panceta curada', words: ['panceta adobada', 'tocino adobado'] },
  { id: 'n-papada-curada', kind: 'Papada curada', words: ['papada adobada'] },
  { id: 'n-lardo', kind: 'Tocino', words: ['tocino blanco', 'tocino salado'] },
];

export const SAUSAGE = [
  { id: 'n-chorizo', kind: 'Chorizo', words: ['chorizo casero', 'chorizo criollo'], sorts: [
    { name: 'Chorizo de Cantimpalos', words: ['cantimpalos'] },
    { name: 'Chorizo riojano', words: ['riojano'] },
    { name: 'Chorizo de León', words: ['chorizo leon'] },
  ] },
  { id: 'n-salchichon', kind: 'Salchichón', words: ['salchichon cular', 'salchichon extra'], sorts: [
    { name: 'Salchichón de Vic', words: ['llonganissa de vic', 'salchichon vic'] },
  ] },
  { id: 'n-fuet', kind: 'Fuet', words: ['fuet extra', 'espetec'] },
  { id: 'n-sobrasada', kind: 'Sobrasada', words: ['sobrasada picante'], sorts: [
    { name: 'Sobrasada de Mallorca', words: ['sobrasada mallorquina'] },
  ] },
  { id: 'n-morcilla', kind: 'Morcilla', words: ['morcilla de cebolla', 'morcilla de arroz'], sorts: [
    { name: 'Morcilla de Burgos', words: ['morcilla burgos'] },
    { name: 'Morcilla de León', words: ['morcilla leon'] },
    { name: 'Morcilla asturiana', words: ['morcilla ahumada'] },
  ] },
  { id: 'n-butifarra', kind: 'Butifarra', words: ['botifarra'], sorts: [
    { name: 'Butifarra blanca', words: ['botifarra blanca'] },
    { name: 'Butifarra negra', words: ['botifarra negra'] },
    { name: 'Butifarra fresca', words: ['botifarra fresca'] },
  ] },
  { id: 'n-longaniza', kind: 'Longaniza', words: ['llonganissa'] },
  { id: 'n-chistorra', kind: 'Chistorra', words: ['txistorra'] },
  { id: 'n-salchicha', kind: 'Salchicha fresca', words: ['salchicha de cerdo', 'salchicha criolla'] },
  { id: 'n-botillo', kind: 'Botillo', words: ['botillo del bierzo', 'androlla'] },
  { id: 'n-sausage-cured', kind: 'Secallona', words: ['somalla', 'petador'] },
];

export const COOKED = [
  { id: 'n-cooked-ham', kind: 'Jamón cocido', words: ['jamon de york', 'jamon york', 'jamon dulce', 'fiambre de jamon'] },
  { id: 'n-cooked-shoulder', kind: 'Paleta cocida', words: ['fiambre de paleta'] },
  { id: 'n-mortadela', kind: 'Mortadela', words: ['mortadela con aceituna', 'mortadela siciliana'] },
  { id: 'n-chopped', kind: 'Chopped', words: ['chopped pork', 'choped', 'chóped'] },
  { id: 'n-turkey-cold', kind: 'Fiambre de pavo', words: ['pechuga de pavo fiambre'] },
  { id: 'n-frankfurt', kind: 'Salchicha cocida', words: ['frankfurt', 'salchicha viena', 'salchicha tipo frankfurt'] },
  { id: 'n-pate', kind: 'Paté', words: ['pate de higado', 'foie gras', 'mousse de pato'] },
  { id: 'n-galantina', kind: 'Galantina', words: ['roulada', 'lomo relleno'] },
  { id: 'n-callos-cooked', kind: 'Callos cocinados', words: ['callos a la madrileña'] },
  { id: 'n-cheek-cooked', kind: 'Carrillera guisada', words: ['carrillada guisada', 'carrillera al vino'] },
];

/* ── THE MEAT CUTS (§1.2, §8.10) ──────────────────────────────────────────────────────────────
 * BEEF is PROVACUNO's own numbered despiece — 22 cuts, «the de-facto national beef reference» —
 * plus the trade names a butcher writes beside them. PORK and POULTRY are authored outright:
 * INTERPORC publishes 8 consumer groups and AVIANZA publishes no despiece at all, so there is no
 * public source to cite. LAMB is INTEROVIC's guide: 6 traditional cuts and 10 campaign cuts, and
 * the campaign ones are tagged as the commercial names they are.
 */
export const BEEF_CUTS = [
  { name: 'Solomillo', id: 'n-tenderloin', src: 'provacuno', words: ['solomillo de vacuno', 'filet mignon'] },
  { name: 'Lomo alto', src: 'provacuno', words: ['entrecot', 'entrecote', 'chuletón', 'chuleton', 'ribeye', 'ojo de bife'] },
  { name: 'Lomo bajo', src: 'provacuno', words: ['riñonada', 'sirloin', 'bife angosto'] },
  { name: 'Cadera', src: 'provacuno', words: ['rabillo de cadera', 'picaña', 'punta de cadera'] },
  { name: 'Tapilla', src: 'provacuno', words: ['colita de cuadril'] },
  { name: 'Tapa', src: 'provacuno', words: ['tapa de ternera'] },
  { name: 'Contra', src: 'provacuno', words: ['culata de contra', 'contratapa'] },
  { name: 'Babilla', src: 'provacuno', words: ['bola'] },
  { name: 'Redondo', src: 'provacuno', words: ['peceto'] },
  { name: 'Aguja', src: 'provacuno', words: ['chuleta de aguja', 'aguja de ternera'] },
  { name: 'Pescuezo', src: 'provacuno', words: ['cuello de ternera'] },
  { name: 'Pez', src: 'provacuno', words: [] },
  { name: 'Llana', src: 'provacuno', words: ['plana'] },
  { name: 'Espaldilla', src: 'provacuno', words: ['paletilla de ternera'] },
  { name: 'Aleta', src: 'provacuno', words: [] },
  { name: 'Brazuelo', src: 'provacuno', words: [] },
  { name: 'Morcillo', src: 'provacuno', words: ['jarrete', 'ossobuco', 'osobuco', 'zancarrón'] },
  { name: 'Vacío', src: 'provacuno', words: ['bavette', 'falda de ternera'] },
  { name: 'Costillar', src: 'provacuno', words: ['costilla de ternera', 'churrasco de ternera'] },
  { name: 'Rabo', src: 'provacuno', words: ['rabo de toro', 'rabo de buey'] },
  { name: 'Falda', src: 'authored', words: ['bajo de ternera'] },
  { name: 'Carne picada', src: 'authored', words: ['picada de ternera', 'carne para hamburguesa'] },
  { name: 'Hamburguesa', src: 'authored', words: ['burger meat'] },
  { name: 'Media canal de vacuno', src: 'authored', words: ['canal de vacuno', 'pistola de vacuno', 'pistolas'] },
];

export const PORK_CUTS = [
  { name: 'Media canal', id: 'n-halfcarcass', src: 'authored', words: ['canal de cerdo', 'porcino canal'] },
  { name: 'Solomillo de cerdo', src: 'authored', words: ['solomillo iberico', 'solomillito'] },
  { name: 'Lomo de cerdo', src: 'authored', words: ['cinta de lomo', 'lomo fresco', 'chuleta de lomo'] },
  { name: 'Cabecera de lomo', src: 'authored', words: ['aguja de cerdo', 'chuletero de aguja', 'chuletero'] },
  { name: 'Presa', src: 'authored', words: ['presa iberica', 'presa de paleta'] },
  { name: 'Secreto', src: 'authored', words: ['secreto iberico', 'cruceta'] },
  { name: 'Pluma', src: 'authored', words: ['pluma iberica'] },
  { name: 'Lagarto', src: 'authored', words: ['lagarto iberico'] },
  { name: 'Abanico', src: 'authored', words: ['abanico iberico'] },
  { name: 'Panceta', src: 'authored', words: ['tocineta', 'panceta fresca'] },
  { name: 'Costillar de cerdo', src: 'authored', words: ['costilla de cerdo', 'churrasco de cerdo', 'ribs'] },
  { name: 'Chuletero de cerdo', src: 'authored', words: ['chuletas de cerdo', 'chuletas de riñonada'] },
  { name: 'Jamón fresco', src: 'authored', words: ['pierna de cerdo', 'pernil fresco'] },
  { name: 'Paletilla de cerdo', src: 'authored', words: ['paleta de cerdo', 'espaldilla de cerdo'] },
  { name: 'Codillo', src: 'authored', words: ['codillo de cerdo', 'lacón fresco'] },
  { name: 'Magro de cerdo', src: 'authored', words: ['magro', 'magro picado', 'carne magra'] },
  { name: 'Carrillera', src: 'authored', words: ['carrillada', 'carrillera de cerdo'] },
  { name: 'Papada', src: 'authored', words: ['papada de cerdo'] },
  { name: 'Careta', src: 'authored', words: ['morro de cerdo', 'careta de cerdo'] },
  { name: 'Manitas', src: 'authored', words: ['manos de cerdo', 'pies de cerdo'] },
  { name: 'Oreja de cerdo', src: 'authored', words: ['orejas'] },
  { name: 'Rabo de cerdo', src: 'authored', words: [] },
  { name: 'Cochinillo', src: 'authored', words: ['tostón', 'lechón'] },
  { name: 'Carne picada de cerdo', src: 'authored', words: ['picada de cerdo'] },
];

export const POULTRY = [
  { name: 'Pollo', id: 'n-chicken', src: 'authored', words: ['pollo entero', 'pollo campero', 'pollo de corral'], sorts: [
    { name: 'Alitas de pollo', id: 'n-chicken-wing', words: ['alas de pollo', 'alitas'] },
    { name: 'Pechuga de pollo', words: ['filete de pechuga', 'pechuga entera'] },
    { name: 'Muslo de pollo', words: ['jamoncito', 'jamoncitos de pollo'] },
    { name: 'Contramuslo de pollo', words: ['contramuslos'] },
    { name: 'Cuarto trasero de pollo', words: ['traseros de pollo'] },
    { name: 'Carcasa de pollo', words: ['carcasas', 'esqueleto de pollo'] },
    { name: 'Higaditos de pollo', words: ['hígados de pollo', 'higados de pollo'] },
    { name: 'Pollo troceado', words: ['pollo en trozos', 'pollo a cuartos'] },
  ] },
  /* PAVO IS A SHELF, NOT A CUT (PAINTINGS-TRACKER, 2026-08-25). It was a type whose «sorts» were
   * its cuts, so the whole bird and the shelf were the same node and the same word — and the
   * painted library could hold either the CREATURE (the category's face, §35.8) or the
   * oven-ready bird, never both. Levelling it up gives the bird its own node, «Pavo entero»,
   * and leaves «Pavo» to mean the shelf. Same move for Conejo in GAME_MEAT. */
  { name: 'Pavo', id: 'n-turkey', level: 'category', src: 'authored', words: [], sorts: [
    { name: 'Pavo entero', id: 'n-a-pavo', words: ['pavo entero', 'pavo fresco'] },
    { name: 'Pechuga de pavo', words: ['filete de pavo', 'pechuga pavo'] },
    { name: 'Contramuslo de pavo', words: ['muslo de pavo'] },
  ] },
  { name: 'Gallina', src: 'authored', words: ['gallina de caldo'] },
  { name: 'Pato', src: 'authored', words: [], sorts: [
    { name: 'Magret de pato', words: ['magret'] },
    { name: 'Confit de pato', words: ['confit'] },
    { name: 'Muslo de pato', words: [] },
  ] },
  { name: 'Codorniz', src: 'authored', words: ['codornices'] },
  { name: 'Perdiz', src: 'authored', words: ['perdices'] },
  { name: 'Pintada', src: 'authored', words: ['gallina de guinea'] },
  { name: 'Poularda', src: 'authored', words: ['capón'] },
];

export const LAMB_CUTS = [
  { name: 'Pierna de cordero', src: 'interovic', words: ['pierna', 'pierna de lechal'] },
  { name: 'Paletilla de cordero', src: 'interovic', words: ['paletilla', 'espaldilla de cordero'] },
  { name: 'Costillar de cordero', src: 'interovic', words: ['chuletas de palo', 'chuletas de riñonada de cordero', 'carré'] },
  { name: 'Jarrete de cordero', src: 'interovic', words: ['morcillo de cordero'] },
  { name: 'Cuello de cordero', src: 'interovic', words: ['pescuezo de cordero'] },
  { name: 'Falda de cordero', src: 'interovic', words: ['bajo de cordero'] },
  { name: 'Medallones de cordero', src: 'interovic-campaign', words: ['medallón de cordero'] },
  { name: 'Tournedó de cordero', src: 'interovic-campaign', words: ['tournedo'] },
  { name: 'Churrasquitos de cordero', src: 'interovic-campaign', words: ['churrasquitos'] },
  { name: 'Cordero entero', src: 'authored', words: ['canal de cordero', 'cordero lechal', 'lechal', 'cabrito'] },
  { name: 'Casquería de cordero', src: 'authored', words: ['ovino casqueria', 'asadura'] },
];

export const GAME_MEAT = [
  { name: 'Conejo', id: 'n-rabbit', level: 'category', src: 'authored', words: [], sorts: [
    { name: 'Conejo entero', id: 'n-g-conejo', words: ['conejo entero', 'conejo fresco'] },
    { name: 'Conejo troceado', words: ['conejo en trozos'] },
    { name: 'Lomo de conejo', words: [] },
    { name: 'Paletilla de conejo', words: [] },
  ] },
  { name: 'Ciervo', src: 'authored', words: ['venado'] },
  { name: 'Jabalí', src: 'authored', words: ['jabali'] },
  { name: 'Avestruz', src: 'authored', words: [] },
  { name: 'Equino', src: 'authored', words: ['carne de potro', 'caballo'] },
];

export const OFFAL = [
  { name: 'Hígado', src: 'authored', words: ['higado de ternera'] },
  { name: 'Riñón', src: 'authored', words: ['riñones', 'riñon'] },
  { name: 'Corazón', src: 'authored', words: [] },
  { name: 'Callos', src: 'authored', words: ['tripa de vacuno', 'librillo'] },
  { name: 'Mollejas', src: 'authored', words: ['molleja'] },
  { name: 'Sesos', src: 'authored', words: [] },
  { name: 'Lengua', src: 'authored', words: ['lengua de ternera'] },
  { name: 'Criadillas', src: 'authored', words: [] },
  { name: 'Sangre', src: 'authored', words: ['sangre cocida'] },
  { name: 'Manteca de cerdo', id: 'n-offal-lard', src: 'authored', words: ['manteca', 'grasa de cerdo', 'sebo'] },
];

/* ── DAIRY, seeded so the exam's six queso rows stop landing next to the ice (§8.10.5) ──────── */
export const CHEESE = [
  { name: 'Queso manchego', words: ['manchego'] },
  { name: 'Queso de oveja', words: ['queso oveja'] },
  { name: 'Queso de cabra', words: ['queso cabra', 'rulo de cabra', 'queso de cabra rulo'] },
  { name: 'Queso de vaca', words: ['queso vaca'] },
  { name: 'Queso de mezcla', words: ['queso mezcla'] },
  { name: 'Queso idiazábal', words: ['idiazabal'] },
  { name: 'Queso tetilla', words: ['tetilla'] },
  { name: 'Queso mahón', words: ['mahon'] },
  { name: 'Queso majorero', words: [] },
  { name: 'Queso de Burgos', words: ['queso fresco de burgos'] },
  { name: 'Queso azul', words: ['cabrales', 'roquefort', 'gorgonzola'] },
  { name: 'Queso mozzarella', words: ['mozzarella'] },
  { name: 'Queso parmesano', words: ['parmesano', 'grana padano'] },
  { name: 'Queso emmental', words: ['emmental'] },
  { name: 'Queso gouda', words: ['gouda'] },
  { name: 'Queso cheddar', words: ['cheddar'] },
  { name: 'Queso fresco', words: ['requesón', 'requeson'] },
  { name: 'Queso crema', words: ['crema de queso', 'philadelphia'] },
  { name: 'Queso rallado', words: ['queso en polvo'] },
  { name: 'Queso en lonchas', words: ['lonchas de queso'] },
  { name: 'Queso de untar', words: [] },
  { name: 'Burrata', words: ['mozzarella de búfala'] },
];

/* GPC's `Type of Cheese` enumeration is 91 values, and it is the second opinion §1.5 promises —
 * international where ours is Spanish. These are the ones a Spanish distributor actually carries,
 * written the way a Spanish invoice writes them, each citing the GPC class it comes off. */
export const CHEESE_GPC = [
  { name: 'Queso brie', words: ['brie'] },
  { name: 'Queso camembert', words: ['camembert'] },
  { name: 'Queso gruyère', words: ['gruyere'] },
  { name: 'Queso provolone', words: ['provolone'] },
  { name: 'Queso pecorino', words: ['pecorino'] },
  { name: 'Queso ricotta', words: ['ricotta'] },
  { name: 'Queso feta', words: ['feta'] },
  { name: 'Queso halloumi', words: ['halloumi'] },
  { name: 'Queso havarti', words: ['havarti'] },
  { name: 'Queso taleggio', words: ['taleggio'] },
  { name: 'Queso raclette', words: ['raclette'] },
  { name: 'Queso edam', words: ['edam'] },
  { name: 'Queso stilton', words: ['stilton'] },
  { name: 'Queso cabrales', words: ['cabrales'] },
  { name: 'Requesón', words: ['cottage', 'queso cottage'] },
];

export const DAIRY_REST = [
  { parent: 'n-milk', name: 'Leche', words: ['leche entera', 'leche desnatada', 'leche semidesnatada', 'leche fresca'] },
  { parent: 'n-milk', name: 'Nata', words: ['nata para montar', 'nata líquida', 'crema de leche'] },
  { parent: 'n-butter', name: 'Mantequilla', words: ['mantequillas'] },
  { parent: 'n-butter', name: 'Margarina', words: [] },
  { parent: 'n-yoghurt', name: 'Yogur', words: ['yogures', 'yogurt'] },
  { parent: 'n-yoghurt', name: 'Cuajada', words: [] },
  { parent: 'n-yoghurt', name: 'Postre lácteo', words: ['natillas', 'flan', 'postres y yogures'] },
];

/* ── PANTRY — the kinds that make an embutidos tarifa's «VARIOS» family land somewhere true ──── */
export const PANTRY = [
  { parent: 'n-oils', name: 'Aceite de oliva', words: ['acete de oliva', 'aove'], sorts: [
    { name: 'Aceite de oliva virgen extra', words: ['virgen extra', 'oliva virgen extra'] },
    { name: 'Aceite de oliva virgen', words: ['oliva virgen'] },
    { name: 'Aceite de oliva suave', words: ['oliva refinado'] },
    { name: 'Aceite de orujo de oliva', words: ['orujo de oliva'] },
  ] },
  { parent: 'n-oils', name: 'Aceite de girasol', words: [] },
  { parent: 'n-oils', name: 'Aceite de semillas', words: ['aceite de soja', 'aceites varios'] },
  { parent: 'n-oils', name: 'Vinagre', words: ['vinagre de jerez', 'vinagre de módena', 'vinagre de vino'] },
  { parent: 'n-preserves', name: 'Aceituna', words: ['aceitunas', 'olivas'], sorts: [
    { name: 'Aceituna gordal', words: ['gordal'] },
    { name: 'Aceituna manzanilla', words: ['manzanilla'] },
    { name: 'Aceituna arbequina', words: ['arbequina'] },
    { name: 'Aceituna negra', words: ['aceituna de aragón'] },
    { name: 'Aceituna rellena', words: ['rellena de anchoa'] },
  ] },
  { parent: 'n-preserves', name: 'Encurtido', words: ['pepinillo', 'alcaparra', 'cebolleta en vinagre', 'banderilla'] },
  { parent: 'n-preserves', name: 'Conserva de pescado', words: ['conservas de pescado', 'atún en lata', 'sardinillas', 'anchoas en aceite', 'mejillones en escabeche'] },
  { parent: 'n-preserves', name: 'Conserva vegetal', words: ['conservas vegetales', 'tomate triturado', 'pimiento del piquillo', 'espárragos en conserva', 'alcachofa en conserva'] },
  { parent: 'n-preserves', name: 'Conserva cárnica', words: ['conservas cárnicas', 'fabada en lata'] },
  { parent: 'n-pulses', name: 'Garbanzo', words: ['garbanzos'], sorts: [
    { name: 'Garbanzo pedrosillano', words: ['pedrosillano'] },
    { name: 'Garbanzo castellano', words: [] },
    { name: 'Garbanzo lechoso', words: [] },
  ] },
  { parent: 'n-pulses', name: 'Alubia', words: ['alubias', 'judía seca', 'fabes'], sorts: [
    { name: 'Alubia blanca', words: [] },
    { name: 'Alubia pinta', words: ['pinta de León'] },
    { name: 'Alubia negra', words: [] },
  ] },
  { parent: 'n-pulses', name: 'Lenteja', words: ['lentejas'], sorts: [
    { name: 'Lenteja pardina', words: ['pardina'] },
    { name: 'Lenteja castellana', words: [] },
    { name: 'Lenteja beluga', words: [] },
  ] },
  { parent: 'n-pulses', name: 'Arroz', words: [], sorts: [
    { name: 'Arroz bomba', words: ['bomba'] },
    { name: 'Arroz redondo', words: [] },
    { name: 'Arroz largo', words: ['basmati'] },
    { name: 'Arroz integral', words: [] },
  ] },
  { parent: 'n-flour', name: 'Harina', words: ['harinas varios', 'harina de trigo', 'harina de fuerza'] },
  { parent: 'n-flour', name: 'Pasta', words: ['pastas alimenticias', 'macarrones', 'espaguetis', 'fideos'] },
  { parent: 'n-flour', name: 'Sémola', words: ['cuscús'] },
  { parent: 'n-flour', name: 'Pan rallado', words: ['empanador'] },
  { parent: 'n-bakery', name: 'Pan', words: ['pan envasado', 'pan congelado', 'barra de pan', 'chapata'] },
  { parent: 'n-bakery', name: 'Picos', words: ['picos camperos', 'colines', 'regañás', 'rosquilletas'] },
  { parent: 'n-bakery', name: 'Galleta', words: ['galletas'] },
  { parent: 'n-bakery', name: 'Bollería', words: ['pastelería', 'croissant', 'magdalena'] },
  { parent: 'n-bakery', name: 'Biscote', words: ['pan tostado'] },
  { parent: 'n-grocery', name: 'Azúcar', words: [] },
  { parent: 'n-grocery', name: 'Sal', words: ['sal marina', 'sal gorda'] },
  { parent: 'n-grocery', name: 'Miel', words: [] },
  { parent: 'n-grocery', name: 'Especia', words: ['condimentos', 'pimentón', 'orégano', 'comino', 'azafrán'] },
  { parent: 'n-grocery', name: 'Chocolate', words: ['cacao', 'dulces'] },
  { parent: 'n-grocery', name: 'Huevo', words: ['huevos', 'huevo campero'] },
  { parent: 'n-grocery', name: 'Salsa', words: ['mayonesa', 'ketchup', 'mostaza', 'alioli'] },
  { parent: 'n-grocery', name: 'Caldo', words: ['caldo de pollo', 'fondo de carne', 'fumet'] },
  { parent: 'n-drinks', name: 'Agua', words: ['aguas', 'agua mineral'] },
  { parent: 'n-drinks', name: 'Refresco', words: ['refresco cola', 'refresco fruta', 'gaseosa'] },
  { parent: 'n-drinks', name: 'Cerveza', words: ['cervezas'] },
  { parent: 'n-drinks', name: 'Vino', words: ['vinos denominac origen', 'vinos sin d. origen'] },
  { parent: 'n-drinks', name: 'Licor', words: ['licores nacionales', 'licores importación'] },
  { parent: 'n-drinks', name: 'Zumo', words: ['zumos', 'néctar'] },
  { parent: 'n-drinks', name: 'Café', words: [] },
  { parent: 'n-drinks', name: 'Infusión', words: ['infusiones', 'té'] },
];

/* ── THE PACKAGED SKELETON FROM GPC (§1.5, FEED-IA §50.2) ─────────────────────────────────────
 * «GPC reaches the sellable product — but only if brick + attributes are treated as one unit», and
 * its schema is «published in Oxford English», so every Spanish word on this side is our
 * translation work. So GPC is used for the two things it is genuinely good for: the SHAPE of the
 * packaged wing (135 food classes, 879 bricks — both counted off the May-2026 release here), and
 * the CLASS CODE as an external id on the nodes we can assert a Spanish name for. A brick whose
 * Spanish name we cannot assert is left unmapped rather than machine-translated into the
 * reference.
 */
export const PACKAGED_GPC = [
  { parent: 'n-grocery', name: 'Salsa', gpc: '50171800', words: ['salsas', 'mayonesa', 'ketchup', 'mostaza', 'alioli', 'salsa de tomate'] },
  { parent: 'n-grocery', name: 'Sopa preparada', gpc: '50191500', words: ['sopa', 'crema preparada', 'caldo preparado'] },
  { parent: 'n-grocery', name: 'Aperitivo', gpc: '50192100', words: ['snack', 'patatas fritas', 'aperitivos', 'cortezas'] },
  { parent: 'n-grocery', name: 'Fruto seco', gpc: '50340100', words: ['frutos secos', 'almendra', 'nuez', 'avellana', 'pistacho', 'anacardo', 'cacahuete'] },
  { parent: 'n-grocery', name: 'Mermelada', gpc: '50192400', words: ['confitura', 'crema de cacao'] },
  { parent: 'n-grocery', name: 'Cereal de desayuno', gpc: '50221200', words: ['cereales', 'muesli', 'copos de avena'] },
  { parent: 'n-grocery', name: 'Golosina', gpc: '50161800', words: ['caramelo', 'chuchería', 'gominola'] },
  { parent: 'n-grocery', name: 'Plato preparado', gpc: '50193800', words: ['precocinado', 'comida preparada', 'plato listo'] },
  { parent: 'n-grocery', name: 'Croqueta', gpc: '50193300', words: ['croquetas', 'empanadilla', 'empanada'] },
  { parent: 'n-grocery', name: 'Pizza', gpc: '50193300', words: ['pizzas congeladas', 'masa de pizza'] },
  { parent: 'n-yoghurt', name: 'Helado', gpc: '50192300', words: ['helados', 'sorbete', 'tarrina de helado'] },
  { parent: 'n-meat', name: 'Sustituto de carne', gpc: '50390100', words: ['tofu', 'seitán', 'heura', 'hamburguesa vegetal'] },
];

/** The GPC class each shelf we already hold sits in — an external id, never a rename (§2.6). */
export const GPC_CODES = [
  ['n-cheese', '50131800'], ['n-milk', '50131700'], ['n-yoghurt', '50132100'],
  ['n-butter', '50131900'], ['n-oils', '50151500'], ['n-sausage', '50240300'],
  ['n-preserves', '50102100'], ['n-pulses', '50221000'], ['n-bakery', '50181900'],
  ['n-drinks', '50202300'], ['n-fish', '50121500'], ['n-shellfish', '50121700'],
  ['n-meat', '50240200'], ['n-produce', '50250000'], ['n-vegetable', '50260000'],
  ['n-fruit', '50250000'], ['n-seaweed', '50121800'], ['n-flour', '50221000'],
];

/* ── GAMA IV/V — the compositions §2.4 says must be real nodes ────────────────────────────────
 * «Gama IV and V get REAL NODES… because the trade names them.» A mix carries a `composition`
 * listing what is inside it; a single species cooked or cut carries no node at all, because its
 * gama falls out of state + prep + pack.
 */
export const PREPARED = [
  { parent: 'n-vegetable', name: 'Ensalada preparada', words: ['ensalada bolsa', 'ensalada lista'], sorts: [
    { name: 'Mezclum', composition: 'lechuga hoja de roble · lollo rosso · rúcula · canónigos' },
    { name: 'Ensalada cuatro estaciones', composition: 'iceberg · lombarda · zanahoria · escarola' },
    { name: 'Brotes tiernos', composition: 'canónigos · rúcula · espinaca baby' },
  ] },
  { parent: 'n-vegetable', name: 'Menestra', words: ['menestra de verduras'], composition: 'judía verde · zanahoria · alcachofa · guisante · coliflor' },
  { parent: 'n-vegetable', name: 'Sofrito', words: ['sofrito de verduras'], composition: 'tomate · cebolla · pimiento' },
  { parent: 'n-vegetable', name: 'Crema de verduras', words: ['puré de verduras', 'gazpacho'] },
];

/* ── THE FAMILIA WORDS REAL DOCUMENTS WRITE (§8.10.6) ─────────────────────────────────────────
 * «The familia column, the one column both CSVs kept tidy, is dead weight to today's surface»,
 * because FAMILY_ROOT's keys were the cast's internal ids. These are the words the two real
 * catalogues and both Mercas actually write in that column, each bound to the shelf it names —
 * so a row nothing else claims falls to the DOCUMENT'S OWN shelf.
 */
export const FAMILY_WORDS = [
  ['embutido curado', 'n-sausage'], ['embutidos', 'n-sausage'], ['embutido', 'n-sausage'],
  ['jamones', 'n-cured'], ['jamónes', 'n-cured'], ['jamones y paletas', 'n-cured'],
  ['curados', 'n-cured'], ['salazones', 'n-cured'],
  ['cocidos', 'n-cooked'], ['cocidos y fiambres', 'n-cooked'], ['fiambres', 'n-cooked'],
  ['carne fresca', 'n-meat'], ['carne fresca de cerdo', 'n-pork'], ['carnes', 'n-meat'],
  ['carnicería', 'n-meat'], ['casquería', 'n-offal'], ['despojos', 'n-offal'],
  ['quesos', 'n-cheese'], ['queso', 'n-cheese'], ['lácteos', 'n-dairy'], ['lacteos', 'n-dairy'],
  ['pescado', 'n-fish'], ['pescados', 'n-fish'], ['pescadería', 'n-fish'],
  ['marisco', 'n-shellfish'], ['mariscos', 'n-shellfish'], ['pescado y marisco', 'n-fish'],
  ['fruta', 'n-fruit'], ['frutas', 'n-fruit'], ['verdura', 'n-vegetable'], ['verduras', 'n-vegetable'],
  ['hortalizas', 'n-vegetable'], ['frutas y hortalizas', 'n-produce'], ['frutería', 'n-produce'],
  ['aceites', 'n-oils'], ['aceites y grasas', 'n-oils'],
  ['conservas', 'n-preserves'], ['encurtidos', 'n-preserves'],
  ['legumbres', 'n-pulses'], ['legumbre y arroz', 'n-pulses'], ['arroz y legumbres', 'n-pulses'],
  ['harinas', 'n-flour'], ['pastas', 'n-flour'],
  ['panadería', 'n-bakery'], ['bollería', 'n-bakery'], ['pan', 'n-bakery'],
  ['bebidas', 'n-drinks'], ['vinos', 'n-drinks'],
  ['despensa', 'n-grocery'], ['ultramarinos', 'n-grocery'], ['varios', 'n-grocery'],
  ['droguería', 'n-ambient'], ['limpieza', 'n-ambient'], ['menaje', 'n-ambient'],
  ['ferretería', 'n-ambient'], ['perfumería', 'n-ambient'], ['envases', 'n-ambient'],
];

/* ── AMBIENT — §2.5 narrows it to what a food house carries and nobody sells ──────────────── */
export const AMBIENT = [
  { name: 'Hielo', id: 'n-ice', words: ['hielo en escamas', 'hielo picado'] },
  { name: 'Tripa natural', id: 'n-casing', words: ['tripa de cerdo', 'tripa de vacuno', 'madeja'] },
  { name: 'Film', words: ['film transparente', 'papel film'] },
  { name: 'Bandeja', words: ['bandejas', 'barqueta'] },
  { name: 'Bolsa', words: ['bolsas', 'bolsa de vacío'] },
  { name: 'Etiqueta', words: ['etiquetas', 'rollo de etiquetas'] },
  { name: 'Guante', words: ['guantes', 'guantes de nitrilo'] },
  { name: 'Papel', words: ['papel de estraza', 'papel parafinado'] },
  { name: 'Producto de limpieza', words: ['droguería', 'desengrasante', 'lejía'] },
];

/* ── THE DIMENSION REGISTERS THE WING PRICES BY (§8.10.2, FEED-IA §41.1) ──────────────────────
 * Each is CLOSED and each is a fact about the goods, so two lines that both say it are the same
 * fact and can be counted, grouped, priced and printed as one thing (catalogue.ts's own §2).
 */
export const REGISTERS = {
  /* RD 4/2014, norma de calidad del ibérico — the designations are legally enforced words, and
   * they carry the corpus's largest price spread (jamón 320,00 vs serrano 95,00, §8.7.2). */
  iberico: { label: 'Ibérico', src: 'rd4-2014', words: [
    'de bellota', 'de cebo de campo', 'de cebo', '100% ibérico', 'ibérico 75%', 'ibérico 50%',
  ] },
  /* The trade's curing grades. A different fact from Extra/A/B freshness class (§8.7.3). */
  curacion: { label: 'Curación', src: 'authored', words: [
    'tierno', 'semicurado', 'curado', 'viejo', 'añejo', 'bodega', 'reserva', 'gran reserva',
  ] },
  /* The embutido's own trade formats, casing included (§8.7.5). Standard trade formats, all of
   * them riding as free comment until this register existed. */
  form: { label: 'Format', src: 'authored', words: [
    'sarta', 'ristra', 'vela', 'herradura', 'cular', 'caña', 'lonchado', 'taco', 'cuña', 'pieza',
    'rulo', 'barra', 'bloque', 'en plancha', 'ristra', 'madeja', 'loncheado',
  ] },
  /* §8.7.6's flavour axis: «picante/dulce — a product split in chorizo and sobrasada, no
   * register». It is a split the trade prices and names by, so it is a register like any other. */
  flavour: { label: 'Flavour', src: 'authored', words: [
    'dulce', 'picante', 'muy picante', 'agridulce', 'al pimentón', 'a las finas hierbas',
    'con ajo', 'trufado',
  ] },
  /* UNECE field 5 + Mercamadrid's own AÑOJO/LECHAL/COCHINILLO vocabulary (§2.3). */
  category: { label: 'Category', src: 'mm', words: [
    'ternera', 'añojo', 'novillo', 'vacuno mayor', 'buey',
    'lechal', 'recental', 'pascual', 'cabrito',
    'cochinillo', 'cerdo blanco', 'duroc', 'ibérico',
    'pollo', 'gallina', 'pavo', 'pato', 'codorniz',
  ] },
  /* Reg (UE) 404/2011 Cuadro 2's six state codes, extended with the trade's own processed words
   * the exam found unheld (§8.7.4): cocido · asado · ahumado · adobado. */
  stateFish: { label: 'State', src: 'reg404', words: [
    'vivo', 'fresco', 'refrigerado', 'congelado', 'ultracongelado', 'cocido', 'salado', 'seco',
    'ahumado', 'en salazón', 'en conserva', 'en escabeche', 'marinado',
  ] },
  stateMeat: { label: 'State', src: 'authored', words: [
    'fresco', 'refrigerado', 'congelado', 'cocido', 'asado', 'ahumado', 'adobado', 'marinado',
    'curado', 'en salazón', 'empanado', 'guisado',
  ] },
  /* Reg (UE) 404/2011 Cuadro 1's presentation codes carry the normative core; the trade extension
   * is §1.1's «honest limit» — rodajas, lomos, ventresca, anillas are on half the fish albaranes
   * in Spain and on none of the 32 codes. */
  prepFish: { label: 'Preparation', src: 'reg404+authored', words: [
    'entero', 'eviscerado', 'descabezado', 'sin piel', 'sin cola', 'limpio',
    'en lomos', 'en filetes', 'en rodajas', 'en tacos', 'en medallones', 'en anillas',
    'ventresca', 'tronco', 'mariposa', 'desespinado', 'troceado', 'picada', 'huevas', 'surimi',
  ] },
  prepMeat: { label: 'Preparation', src: 'authored', words: [
    'entero', 'limpio', 'en piezas', 'fileteado', 'picado', 'troceado', 'deshuesado',
    'en tacos', 'en dados', 'en lonchas', 'loncheado', 'atado', 'brida', 'abierto',
  ] },
  /* §2.3's CAPTURE axis — Mercamadrid fuses it into the name («MERLUZA PINCHO»). */
  capture: { label: 'Capture', src: 'authored', words: [
    'de pincho', 'de anzuelo', 'de arrastre', 'de cerco', 'de volanta', 'de nasa',
    'de marisqueo', 'de cultivo', 'salvaje',
  ] },
  /* §2.3's CULTIVATION axis for produce. */
  cultivation: { label: 'Cultivation', src: 'authored', words: [
    'convencional', 'ecológico', 'integrada', 'hidropónico', 'invernadero', 'aire libre',
  ] },
};
