/* GENERATED FILE — do not hand-edit. Rebuild with `node tools/build-reference.mjs`.
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
 * GS1 GPC's 879 Food/Beverage bricks landed (418 onto nodes the Spanish sources already
 * named, 461 minted) and every one of the BOE's 1,105 registered species landed
 * (on 1006 distinct official commercial names). Nothing was chosen; the market
 * evidence rides as the `traded` attribute instead of as a shorter list.
 *
 * THIS BUILD: 4680 nodes · 9177 distinct surfaces · 9691 lexicon bindings.
 * Nodes by source: authored 236 · boe 1002 · gpc 2838 · interovic 6 · interovic-campaign 3 · mm 576 · provacuno 19.
 * Nodes by level: category 80 · family 8 · sort 3129 · type 1463.
 * Standing on a GPC English title, Spanish owed: 5.
 */

export type RefLevel = 'family' | 'category' | 'type' | 'sort';

/** Where a row came from. `authored` is ours; everything else names the register that published
 *  it, so §50b.3's coverage matrix can count sourced and authored apart. */
export type RefSource =
  | 'boe' | 'mercamadrid' | 'mercabarna' | 'reg404' | 'reg2429' | 'rd4-2014'
  | 'provacuno' | 'interovic' | 'interovic-campaign' | 'gpc' | 'authored';

/** Which vocabulary a surface belongs to (§2.2). `oficial` is the BOE's own commercial name —
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
const NODES = `n-a-carcasa-de-pollo|Carcasa de pollo|s|n-chicken|a||
n-a-codorniz|Codorniz|t|n-poultry|a|t|elaborado,sin elaborar
n-a-confit-de-pato|Confit de pato|s|n-a-pato|a||
n-a-contramuslo-de-pavo|Contramuslo de pavo|t|n-turkey|a||
n-a-contramuslo-de-pollo|Contramuslo de pollo|s|n-chicken|a||
n-a-cuarto-trasero-de-pollo|Cuarto trasero de pollo|s|n-chicken|a||
n-a-gallina|Gallina|t|n-poultry|a||
n-a-higaditos-de-pollo|Higaditos de pollo|s|n-chicken|a||
n-a-magret-de-pato|Magret de pato|s|n-a-pato|a||
n-a-muslo-de-pato|Muslo de pato|s|n-a-pato|a||
n-a-muslo-de-pollo|Muslo de pollo|s|n-chicken|a||
n-a-pato|Pato|t|n-poultry|a||elaborado,sin elaborar
n-a-pavo|Pavo entero|t|n-turkey|a||
n-a-pechuga-de-pavo|Pechuga de pavo|t|n-turkey|a||
n-a-pechuga-de-pollo|Pechuga de pollo|s|n-chicken|a||
n-a-perdiz|Perdiz|t|n-poultry|a|t|
n-a-pintada|Pintada|t|n-poultry|a||elaborado,sin elaborar
n-a-pollo-troceado|Pollo troceado|s|n-chicken|a||
n-a-poularda|Poularda|t|n-poultry|a||
n-b-aguja|Aguja|t|n-beef|p||
n-b-aleta|Aleta|t|n-beef|p||
n-b-babilla|Babilla|t|n-beef|p||
n-b-brazuelo|Brazuelo|t|n-beef|p||
n-b-cadera|Cadera|t|n-beef|p||
n-b-carne-picada|Carne picada|t|n-beef|a||
n-b-contra|Contra|t|n-beef|p||
n-b-costillar|Costillar|t|n-beef|p||
n-b-espaldilla|Espaldilla|t|n-beef|p||
n-b-falda|Falda|t|n-beef|a||
n-b-hamburguesa|Hamburguesa|t|n-beef|a||
n-b-llana|Llana|t|n-beef|p||
n-b-lomo-alto|Lomo alto|t|n-beef|p||
n-b-lomo-bajo|Lomo bajo|t|n-beef|p||
n-b-media-canal-de-vacuno|Media canal de vacuno|t|n-beef|a|t|
n-b-morcillo|Morcillo|t|n-beef|p||
n-b-pescuezo|Pescuezo|t|n-beef|p||
n-b-pez|Pez|t|n-beef|p|t|
n-b-rabo|Rabo|t|n-beef|p||
n-b-redondo|Redondo|t|n-beef|p||
n-b-tapa|Tapa|t|n-beef|p||
n-b-tapilla|Tapilla|t|n-beef|p||
n-b-vacio|Vacío|t|n-beef|p||
n-bacon|Bacon|t|n-cured|a||
n-bakery|Panadería y bollería|f||a||
n-bivalve|Marisco de concha|c|n-fish|a||
n-bluefish|Pescado azul|c|n-fish|a||
n-botillo|Botillo|t|n-sausage|a||
n-butifarra|Butifarra|t|n-sausage|a||
n-butter|Mantequillas y grasas lácteas|c|n-dairy|a||
n-c-callos|Callos|t|n-offal|a||
n-c-corazon|Corazón|t|n-offal|a||
n-c-criadillas|Criadillas|t|n-offal|a||
n-c-higado|Hígado|t|n-offal|a||
n-c-lengua|Lengua|t|n-offal|a||
n-c-mollejas|Mollejas|t|n-offal|a||
n-c-rinon|Riñón|t|n-offal|a||
n-c-sangre|Sangre|t|n-offal|a||
n-c-sesos|Sesos|t|n-offal|a||
n-callos-cooked|Callos cocinados|t|n-cooked|a||
n-cecina|Cecina|t|n-cured|a||
n-cheek-cooked|Carrillera guisada|t|n-cooked|a||
n-cheese|Queso|c|n-dairy|a|t|ambiente,congelado,refrigerado
n-chistorra|Chistorra|t|n-sausage|a||
n-chopped|Chopped|t|n-cooked|a||
n-cooked|Cocidos y fiambres|c|n-meat|a||
n-cooked-ham|Jamón cocido|t|n-cooked|a||
n-cooked-shoulder|Paleta cocida|t|n-cooked|a||
n-d-aceite-de-girasol|Aceite de girasol|t|n-oils|a|t|
n-d-aceite-de-oliva|Aceite de oliva|t|n-oils|a|t|
n-d-aceite-de-oliva-suave|Aceite de oliva suave|s|n-d-aceite-de-oliva|a||
n-d-aceite-de-oliva-virgen|Aceite de oliva virgen|s|n-d-aceite-de-oliva|a||
n-d-aceite-de-oliva-virgen-extra|Aceite de oliva virgen extra|s|n-d-aceite-de-oliva|a||
n-d-aceite-de-orujo-de-oliva|Aceite de orujo de oliva|s|n-d-aceite-de-oliva|a||
n-d-aceite-de-semillas|Aceite de semillas|t|n-oils|a|t|
n-d-aceituna|Aceituna|t|n-preserves|a|t|ambiente,refrigerado
n-d-aceituna-arbequina|Aceituna arbequina|s|n-d-aceituna|a||
n-d-aceituna-gordal|Aceituna gordal|s|n-d-aceituna|a||
n-d-aceituna-manzanilla|Aceituna manzanilla|s|n-d-aceituna|a||
n-d-aceituna-negra|Aceituna negra|s|n-d-aceituna|a||
n-d-aceituna-rellena|Aceituna rellena|s|n-d-aceituna|a||
n-d-agua|Agua|t|n-drinks|a|t|
n-d-alubia|Alubia|t|n-pulses|a|t|
n-d-alubia-blanca|Alubia blanca|s|n-d-alubia|a||
n-d-alubia-negra|Alubia negra|s|n-d-alubia|a||
n-d-alubia-pinta|Alubia pinta|s|n-d-alubia|a||
n-d-aperitivo|Aperitivo|t|n-grocery|g|t|
n-d-arroz|Arroz|t|n-pulses|a|t|
n-d-arroz-bomba|Arroz bomba|s|n-d-arroz|a||
n-d-arroz-integral|Arroz integral|s|n-d-arroz|a||
n-d-arroz-largo|Arroz largo|s|n-d-arroz|a||
n-d-arroz-redondo|Arroz redondo|s|n-d-arroz|a||
n-d-azucar|Azúcar|t|n-grocery|a|t|ambiente,cortado
n-d-biscote|Biscote|t|n-bakery|a||ambiente,congelado
n-d-bolleria|Bollería|t|n-bakery|a|t|
n-d-cafe|Café|t|n-drinks|a|t|
n-d-caldo|Caldo|t|n-grocery|a||
n-d-cereal-de-desayuno|Cereal de desayuno|t|n-grocery|g||
n-d-cerveza|Cerveza|t|n-drinks|a|t|sin alcohol
n-d-chocolate|Chocolate|t|n-grocery|a|t|
n-d-conserva-carnica|Conserva cárnica|t|n-preserves|a|t|
n-d-conserva-de-pescado|Conserva de pescado|t|n-preserves|a|t|
n-d-conserva-vegetal|Conserva vegetal|t|n-preserves|a|t|
n-d-croqueta|Croqueta|t|n-grocery|g|t|
n-d-encurtido|Encurtido|t|n-preserves|a||
n-d-especia|Especia|t|n-grocery|a|t|
n-d-ferreteria|Ferretería|t|n-drinks|m|t|
n-d-fruto-seco|Fruto seco|t|n-grocery|g|t|con cáscara,elaborado,refrigerado,sin cáscara,sin elaborar
n-d-galleta|Galleta|t|n-bakery|a|t|ambiente,congelado,refrigerado
n-d-garbanzo|Garbanzo|t|n-pulses|a|t|cortado
n-d-garbanzo-castellano|Garbanzo castellano|s|n-d-garbanzo|a||
n-d-garbanzo-lechoso|Garbanzo lechoso|s|n-d-garbanzo|a||
n-d-garbanzo-pedrosillano|Garbanzo pedrosillano|s|n-d-garbanzo|a||
n-d-golosina|Golosina|t|n-grocery|g||
n-d-harina|Harina|t|n-flour|a|t|ambiente
n-d-helado|Helado|t|n-yoghurt|g|t|ambiente,congelado
n-d-huevo|Huevo|t|n-grocery|a|t|
n-d-infusion|Infusión|t|n-drinks|a|t|
n-d-lenteja|Lenteja|t|n-pulses|a|t|
n-d-lenteja-beluga|Lenteja beluga|s|n-d-lenteja|a||
n-d-lenteja-castellana|Lenteja castellana|s|n-d-lenteja|a||
n-d-lenteja-pardina|Lenteja pardina|s|n-d-lenteja|a||
n-d-licor|Licor|t|n-drinks|a|t|
n-d-limpieza|Limpieza|t|n-drinks|m|t|
n-d-menaje-hosteleria|Menaje hostelería|t|n-drinks|m|t|
n-d-mermelada|Mermelada|t|n-grocery|g||ambiente
n-d-miel|Miel|t|n-grocery|a|t|ambiente
n-d-pan|Pan|t|n-bakery|a|t|ambiente,congelado,refrigerado
n-d-pan-rallado|Pan rallado|t|n-flour|a||
n-d-pasta|Pasta|t|n-flour|a|t|ambiente,concentrado,congelado,listo para consumir,refrigerado
n-d-perfumeria|Perfumería|t|n-drinks|m|t|
n-d-picos|Picos|t|n-bakery|a||
n-d-pizza|Pizza|t|n-grocery|g|t|
n-d-plato-preparado|Plato preparado|t|n-grocery|g||ambiente,concentrado,congelado,listo para consumir,refrigerado
n-d-precocinados-carnico|Precocinados cárnico|t|n-grocery|m|t|
n-d-precocinados-de-pescado|Precocinados de pescado|t|n-grocery|m|t|
n-d-refresco|Refresco|t|n-drinks|a|t|concentrado,listo para consumir
n-d-sal|Sal|t|n-grocery|a||
n-d-salsa|Salsa|t|n-grocery|a||ambiente,congelado,refrigerado
n-d-semola|Sémola|t|n-flour|a||
n-d-sopa-preparada|Sopa preparada|t|n-grocery|g||
n-d-sustituto-de-carne|Sustituto de carne|t|n-meat|g||
n-d-vario|Vario|t|n-ambient|m|t|
n-d-vinagre|Vinagre|t|n-oils|a||
n-d-vino|Vino|t|n-drinks|a|t|
n-d-zumo|Zumo|t|n-drinks|a|t|
n-dairy|Lácteos|f||a||
n-drinks|Bebidas|f||a||
n-f-abade|Abade|t|n-whitefish|b||
n-f-abade-jaspeado|Abade jaspeado|s|n-f-abade|b||
n-f-abadejo|Abadejo|t|n-whitefish|b|t|
n-f-abadejo-de-alaska|Abadejo de Alaska|s|n-f-abadejo|b||
n-f-abalon-japones|Abalón japonés|t|n-bivalve|b||
n-f-abeto-marino|Abeto marino|t|n-seaweed|b||
n-f-abichon|Abichón|t|n-whitefish|b||
n-f-abuete-negro|Abuete negro|t|n-whitefish|b||
n-f-acedia|Acedía|t|n-whitefish|b|t|
n-f-acedia-moteada|Acedía moteada|s|n-f-acedia|b||
n-f-acicularis|Acicularis|t|n-whitefish|b||
n-f-aguacioso|Aguacioso|t|n-whitefish|b||
n-f-aguila-marina|Águila marina|t|n-whitefish|b||
n-f-aguja|Aguja|t|n-bluefish|b|t|
n-f-aguja-blanca-del-atlantico|Aguja blanca del Atlántico|s|n-f-aguja|b||
n-f-aguja-de-pico-corto|Aguja de pico corto|s|n-f-aguja|b||
n-f-aguja-mula|Aguja mula|s|n-f-aguja|b||
n-f-aguja-negra|Aguja negra|s|n-f-aguja|b||
n-f-aguja-picuda|Aguja picuda|s|n-f-aguja|b||
n-f-agujon|Agujón|t|n-bluefish|b||
n-f-alacha|Alacha|t|n-bluefish|b|t|
n-f-aleton|Aletón|t|n-whitefish|b||
n-f-alfiler|Alfiler|t|n-whitefish|b||
n-f-alfonsino|Alfonsiño|t|n-whitefish|b||
n-f-alga-caulerpa|Alga caulerpa|t|n-seaweed|b||
n-f-alga-de-cal|Alga de cal|t|n-seaweed|b||
n-f-alga-imperial|Alga imperial|t|n-seaweed|b||
n-f-alga-nori|Alga nori|t|n-seaweed|b||
n-f-alga-perfumada|Alga perfumada|t|n-seaweed|b||
n-f-alga-pestana|Alga pestaña|t|n-seaweed|b||
n-f-alga-pimentera|Alga pimentera|t|n-seaweed|b||
n-f-aligote|Aligote|t|n-whitefish|b|t|
n-f-alistado|Alistado|t|n-shellfish|b||
n-f-alistado-robusto|Alistado Robusto|s|n-f-alistado|b||
n-f-alitan|Alitán|t|n-whitefish|b||
n-f-almeja-americana|Almeja americana|s|n-clam|b||
n-f-almeja-artica|Almeja ártica|s|n-clam|b||
n-f-almeja-blanca|Almeja blanca|s|n-clam|b||
n-f-almeja-casera|Almeja casera|s|n-clam|b||
n-f-almeja-corazon|Almeja corazón|s|n-clam|b||
n-f-almeja-de-concha-blanda|Almeja de Concha Blanda|s|n-clam|b||
n-f-almeja-de-fondo|Almeja de fondo|s|n-clam|b||
n-f-almeja-de-perro|Almeja de perro|s|n-clam|b||
n-f-almeja-del-pacifico|Almeja del Pacífico|s|n-clam|b||
n-f-almeja-dorada|Almeja dorada|s|n-clam|b||
n-f-almeja-oriental|Almeja oriental|s|n-clam|b||
n-f-almeja-propulsora|Almeja propulsora|s|n-clam|b||
n-f-almeja-reina|Almeja reina|s|n-clam|b||
n-f-almeja-taca|Almeja taca|s|n-clam|b||
n-f-almeja-tonta|Almeja tonta|s|n-clam|b||
n-f-almejon|Almejón|t|n-bivalve|b|t|
n-f-almendra-de-mar|Almendra de mar|t|n-bivalve|b||
n-f-almendra-peluda|Almendra peluda|t|n-bivalve|b||
n-f-alosa|Alosa|t|n-bluefish|b||
n-f-amur|Amur|t|n-whitefish|b||
n-f-anago|Anago|t|n-whitefish|b||
n-f-ancas-de-rana|Ancas de rana|t|n-whitefish|m|t|
n-f-anchoa|Anchoa|t|n-bluefish|b|t|
n-f-anchoa-de-california|Anchoa de California|s|n-f-anchoa|b||
n-f-anchoa-del-africa-austral|Anchoa del África austral|s|n-f-anchoa|b||
n-f-anchoa-japonesa|Anchoa japonesa|s|n-f-anchoa|b||
n-f-anchoita|Anchoíta|t|n-bluefish|b||
n-f-anchoveta|Anchoveta|t|n-bluefish|b||
n-f-andorina|Andoriña|t|n-whitefish|b||
n-f-andorrero-del-cabo|Andorrero del Cabo|t|n-whitefish|b||
n-f-angelote|Angelote|t|n-whitefish|b||
n-f-angelote-argentino|Angelote argentino|s|n-f-angelote|b||
n-f-anguila|Anguila|t|n-bluefish|b|t|
n-f-anguila-bicolor|Anguila bicolor|s|n-f-anguila|b||
n-f-anjova|Anjova|t|n-bluefish|b||
n-f-aonori|Aonori|t|n-seaweed|b||
n-f-arana|Araña|t|n-whitefish|b||
n-f-arana-plana|Araña plana|s|n-f-arana|b||
n-f-arapaima|Arapaima|t|n-whitefish|b||
n-f-arca-antigua|Arca antigua|t|n-bivalve|b||
n-f-arca-de-noe|Arca de Noé|t|n-bivalve|b||
n-f-arca-huequera|Arca huequera|t|n-bivalve|b||
n-f-arca-negra|Arca negra|t|n-bivalve|b||
n-f-arenque|Arenque|t|n-bluefish|b|t|
n-f-arenque-del-pacifico|Arenque del Pacífico|s|n-f-arenque|b||
n-f-arenquillo|Arenquillo|t|n-whitefish|b||
n-f-arete|Arete|t|n-whitefish|b||
n-f-arete-aleton|Arete aletón|s|n-f-arete|b||
n-f-argazo-real|Argazo real|t|n-seaweed|b||
n-f-armado|Armado|t|n-whitefish|b||
n-f-arola|Arola|t|n-whitefish|b||
n-f-articulata|Articulata|t|n-whitefish|b||
n-f-ascophyllum|Ascophyllum|t|n-whitefish|b||
n-f-atun|Atun|t|n-bluefish|m|t|
n-f-atun-blanco|Atún blanco|t|n-bluefish|b||
n-f-atun-de-aleta-negra|Atún de aleta negra|t|n-bluefish|b||
n-f-atun-del-pacifico|Atún del Pacífico|t|n-bluefish|b||
n-f-atun-del-sur|Atún del sur|t|n-bluefish|b||
n-f-atun-lanzon|Atún lanzón|t|n-bluefish|b||
n-f-atun-rojo|Atún rojo|t|n-bluefish|b||
n-f-atun-tongol|Atún tongol|t|n-bluefish|b||
n-f-babosa|Babosa|t|n-whitefish|m|t|
n-f-bacaladilla|Bacaladilla|t|n-whitefish|b|t|
n-f-bacaladilla-austral|Bacaladilla austral|s|n-f-bacaladilla|b||
n-f-bacalao|Bacalao|t|n-whitefish|b|t|
n-f-bacalao-de-groenlandia|Bacalao de Groenlandia|s|n-f-bacalao|b||
n-f-bacalao-del-pacifico|Bacalao del pacífico|s|n-f-bacalao|b||
n-f-bacalao-negro-de-alaska|Bacalao negro de Alaska|s|n-f-bacalao|b||
n-f-bacoreta|Bacoreta|t|n-bluefish|b||
n-f-bacoreta-oriental|Bacoreta oriental|s|n-f-bacoreta|b||
n-f-baga-japonesa|Baga japonesa|t|n-whitefish|b||
n-f-bagra-del-ganges|Bagra del Ganges|t|n-whitefish|b||
n-f-bagre|Bagre|t|n-whitefish|b||
n-f-bagre-blanco|Bagre blanco|s|n-f-bagre|b||
n-f-bagre-del-canal|Bagre del canal|s|n-f-bagre|b||
n-f-bagre-rojo|Bagre rojo|s|n-f-bagre|b||
n-f-baila|Baila|t|n-whitefish|b|t|
n-f-barbada|Barbada|t|n-whitefish|b||
n-f-barbo-comizo|Barbo comizo|t|n-whitefish|b||
n-f-barbo-comun|Barbo común|t|n-whitefish|b||
n-f-barbo-de-graells|Barbo de Graells|t|n-whitefish|b||
n-f-barbo-de-montana|Barbo de montaña|t|n-whitefish|b||
n-f-barbo-de-sclater|Barbo de Sclater|t|n-whitefish|b||
n-f-barbuda|Barbuda|t|n-whitefish|b||
n-f-barbudo|Barbudo|t|n-whitefish|b||
n-f-barbudo-enano-africano|Barbudo enano africano|s|n-f-barbudo|b||
n-f-barbudo-real|Barbudo real|s|n-f-barbudo|b||
n-f-barrilete|Barrilete|t|n-whitefish|b|t|
n-f-barrilete-negro|Barrilete negro|s|n-f-barrilete|b||
n-f-bejel|Bejel|t|n-whitefish|b||
n-f-berberecho|Berberecho|t|n-bivalve|b|t|
n-f-berberecho-de-groenlandia|Berberecho de Groenlandia|s|n-f-berberecho|b||
n-f-berberecho-dentado|Berberecho dentado|s|n-f-berberecho|b||
n-f-berberecho-gigante-del-atlantico|Berberecho gigante del Atlántico|s|n-f-berberecho|b||
n-f-berberecho-rey-de-nueva-zelanda|Berberecho Rey de Nueva Zelanda|s|n-f-berberecho|b||
n-f-berberecho-verde|Berberecho verde|s|n-f-berberecho|b||
n-f-bertorella|Bertorella|t|n-whitefish|b|t|
n-f-bertorella-artica|Bertorella ártica|s|n-f-bertorella|b||
n-f-bertorella-azul|Bertorella azul|s|n-f-bertorella|b||
n-f-besugo|Besugo|t|n-whitefish|b|t|
n-f-besugo-arabe|Besugo árabe|s|n-f-besugo|b||
n-f-bicho|Bicho|t|n-whitefish|b||
n-f-bifurcaria|Bifurcaria|t|n-whitefish|b||
n-f-bigaro|Bígaro|t|n-bivalve|b|t|
n-f-bigaro-blanco|Bígaro blanco|s|n-f-bigaro|b||
n-f-bigaros-o-caracolillo|Bigaros o caracolillo|t|n-whitefish|m|t|
n-f-blanquillo|Blanquillo|t|n-whitefish|b||
n-f-blanquillo-peruano|Blanquillo peruano|s|n-f-blanquillo|b||
n-f-bobi|Bobi|t|n-whitefish|b|t|
n-f-boca-de-oro|Boca de oro|t|n-whitefish|b||
n-f-boca-roja|Boca roja|t|n-whitefish|b||
n-f-bocarte|Bocarte|t|n-whitefish|m|t|
n-f-bocina|Bocina|t|n-bivalve|b||
n-f-bocon|Bocón|t|n-whitefish|b||
n-f-bocona|Bocona|t|n-whitefish|b||
n-f-bodion|Bodión|t|n-whitefish|b||
n-f-boga|Boga|t|n-whitefish|b|t|
n-f-boga-de-rio|Boga de río|s|n-f-boga|b||
n-f-bogavante|Bogavante|t|n-shellfish|m|t|
n-f-bogavante-americano|Bogavante americano|t|n-shellfish|b||
n-f-bogavante-europeo|Bogavante europeo|t|n-shellfish|b||
n-f-bogavantes-o-abacanto|Bogavantes o abacanto|t|n-whitefish|m|t|
n-f-bonito|Bonito|t|n-bluefish|b|t|
n-f-bonito-austral|Bonito austral|s|n-f-bonito|b||
n-f-bonito-del-pacifico|Bonito del Pacífico|s|n-f-bonito|b||
n-f-bonito-oriental|Bonito oriental|s|n-f-bonito|b||
n-f-breca|Breca|t|n-whitefish|b|t|
n-f-breca-chata|Breca chata|s|n-f-breca|b||
n-f-brosmio|Brosmio|t|n-whitefish|b||
n-f-brosmio-artico|Brosmio ártico|s|n-f-brosmio|b||
n-f-brotola|Brotola|t|n-whitefish|m|t|
n-f-brotola-blanca|Brótola blanca|t|n-whitefish|b||
n-f-brotola-brasilena|Brótola brasileña|t|n-whitefish|b||
n-f-brotola-criolla|Brótola criolla|t|n-whitefish|b||
n-f-brotola-de-fango|Brótola de fango|t|n-whitefish|b||
n-f-brotola-de-roca|Brótola de roca|t|n-whitefish|b||
n-f-brotola-roja|Brótola roja|t|n-whitefish|b||
n-f-bruja|Bruja|t|n-whitefish|b||
n-f-buey|Buey|t|n-whitefish|m|t|
n-f-buey-austral|Buey austral|t|n-whitefish|b||
n-f-buey-de-mar|Buey de mar|t|n-shellfish|b|t|
n-f-bunuelo-de-mar|Buñuelo de mar|t|n-shellfish|b||
n-f-burgado-hembra|Burgado hembra|t|n-whitefish|b||
n-f-burgado-iberico|Burgado ibérico|t|n-whitefish|b||
n-f-burro|Burro|t|n-whitefish|b|t|
n-f-busano|Busano|t|n-bivalve|b||
n-f-caballa|Caballa|t|n-bluefish|b|t|
n-f-caballa-austral|Caballa austral|s|n-f-caballa|b||
n-f-caballa-del-sur|Caballa del sur|s|n-f-caballa|b|t|
n-f-cabete|Cabete|t|n-whitefish|b||
n-f-caboti|Cabotí|t|n-whitefish|b||
n-f-cabracho|Cabracho|t|n-whitefish|b|t|
n-f-cabracho-de-fondo|Cabracho de fondo|s|n-f-cabracho|b||
n-f-cabrilla|Cabrilla|t|n-whitefish|b||
n-f-cacho|Cacho|t|n-whitefish|b||
n-f-cachucho|Cachucho|t|n-whitefish|b|t|
n-f-cadelucha-listada|Cadelucha listada|t|n-whitefish|b||
n-f-calamar|Calamar|t|n-cephalopod|b|t|
n-f-calamar-de-arrecife|Calamar de arrecife|s|n-f-calamar|b||
n-f-calamar-espada|Calamar espada|s|n-f-calamar|b||
n-f-calamar-indopacifico|Calamar indopacífico|s|n-f-calamar|b||
n-f-calamar-paraguas|Calamar paraguas|s|n-f-calamar|b||
n-f-calamar-siboga|Calamar Siboga|s|n-f-calamar|b||
n-f-calamarin-africano|Calamarín africano|t|n-cephalopod|b||
n-f-calamarin-de-fondo|Calamarín de fondo|t|n-cephalopod|b||
n-f-calamarin-menor|Calamarín menor|t|n-cephalopod|b||
n-f-calamarin-picudo|Calamarín picudo|t|n-cephalopod|b||
n-f-caluga|Caluga|t|n-whitefish|b||
n-f-camaron|Camarón|t|n-shellfish|b|t|
n-f-camaron-arquero|Camarón arquero|s|n-f-camaron|b||
n-f-camaron-blanco|Camarón blanco|s|n-f-camaron|b||
n-f-camaron-boreal|Camarón boreal|s|n-f-camaron|b||
n-f-camaron-cabezudo|Camarón cabezudo|s|n-f-camaron|b||
n-f-camaron-cabezudo-del-alto|Camarón cabezudo del alto|s|n-f-camaron|b||
n-f-camaron-cristal|Camarón cristal|s|n-f-camaron|b||
n-f-camaron-cristal-oriental|Camarón cristal oriental|s|n-f-camaron|b||
n-f-camaron-de-poza|Camarón de poza|s|n-f-camaron|b||
n-f-camaron-espinoso|Camarón espinoso|s|n-f-camaron|b||
n-f-camaron-flecha|Camarón flecha|s|n-f-camaron|b||
n-f-camaron-indico|Camarón índico|s|n-f-camaron|b||
n-f-camaron-indio|Camarón indio|s|n-f-camaron|b||
n-f-camaron-maoxia|Camarón maoxía|s|n-f-camaron|b||
n-f-camaron-marcial|Camarón marcial|s|n-f-camaron|b||
n-f-camaron-meridional|Camarón meridional|s|n-f-camaron|b||
n-f-camaron-moteado|Camarón moteado|s|n-f-camaron|b||
n-f-camaron-nailon-liso|Camarón nailón liso|s|n-f-camaron|b||
n-f-camaron-narval|Camarón narval|s|n-f-camaron|b||
n-f-camaron-periquito|Camarón periquito|s|n-f-camaron|b||
n-f-camaron-rasposo|Camarón rasposo|s|n-f-camaron|b||
n-f-camaron-rayado-de-guinea|Camarón rayado de Guinea|s|n-f-camaron|b||
n-f-camaron-rojo|Camarón rojo|s|n-f-camaron|b||
n-f-camaron-siete-barbas|Camarón siete barbas|s|n-f-camaron|b||
n-f-camaron-soldado|Camarón soldado|s|n-f-camaron|b|t|
n-f-camaron-verde|Camarón verde|s|n-f-camaron|b||
n-f-camaroncillo|Camaroncillo|t|n-whitefish|b||
n-f-camotillo|Camotillo|t|n-whitefish|b||
n-f-canabota|Cañabota|t|n-whitefish|b||
n-f-canabota-gris|Cañabota gris|s|n-f-canabota|b||
n-f-canadilla|Cañadilla|t|n-bivalve|m|t|
n-f-canailla|Cañaílla|t|n-bivalve|b|t|
n-f-canaliculada|Canaliculada|t|n-whitefish|b||
n-f-cangrejo|Cangrejo|t|n-shellfish|b|t|
n-f-cangrejo-africano|Cangrejo africano|s|n-f-cangrejo|b||
n-f-cangrejo-atlantico|Cangrejo atlántico|s|n-f-cangrejo|b||
n-f-cangrejo-austral|Cangrejo austral|s|n-f-cangrejo|b||
n-f-cangrejo-azul|Cangrejo azul|s|n-f-cangrejo|b||
n-f-cangrejo-azul-japones|Cangrejo azul japonés|s|n-f-cangrejo|b||
n-f-cangrejo-azul-nadador|Cangrejo azul nadador|s|n-f-cangrejo|b||
n-f-cangrejo-blanco|Cangrejo blanco|s|n-f-cangrejo|b||
n-f-cangrejo-boreal|Cangrejo boreal|s|n-f-cangrejo|b||
n-f-cangrejo-canadiense|Cangrejo canadiense|s|n-f-cangrejo|b||
n-f-cangrejo-chino|Cangrejo chino|s|n-f-cangrejo|b||
n-f-cangrejo-de-arrugas|Cangrejo de arrugas|s|n-f-cangrejo|b||
n-f-cangrejo-de-california|Cangrejo de California|s|n-f-cangrejo|b||
n-f-cangrejo-de-fango-australiano|Cangrejo de fango australiano|s|n-f-cangrejo|b||
n-f-cangrejo-de-las-marismas|Cangrejo de las marismas|s|n-f-cangrejo|b||
n-f-cangrejo-de-las-nieves|Cangrejo de las nieves|s|n-f-cangrejo|b||
n-f-cangrejo-de-mar-rojo|Cangrejo de Mar Rojo|s|n-f-cangrejo|b||
n-f-cangrejo-de-rio-europeo|Cangrejo de rio europeo|s|n-f-cangrejo|b||
n-f-cangrejo-de-rio-real|Cangrejo de rio real|s|n-f-cangrejo|b||
n-f-cangrejo-del-danubio|Cangrejo del Danubio|s|n-f-cangrejo|b||
n-f-cangrejo-dorado|Cangrejo dorado|s|n-f-cangrejo|b||
n-f-cangrejo-ermitano-comun|Cangrejo ermitaño común|s|n-f-cangrejo|b||
n-f-cangrejo-mandarin|Cangrejo mandarín|s|n-f-cangrejo|b||
n-f-cangrejo-mediterraneo|Cangrejo mediterráneo|s|n-f-cangrejo|b||
n-f-cangrejo-moruno|Cangrejo moruno|s|n-f-cangrejo|b||
n-f-cangrejo-pelagico|Cangrejo pelágico|s|n-f-cangrejo|b||
n-f-cangrejo-real|Cangrejo real|s|n-f-cangrejo|b||
n-f-cangrejo-real-azul|Cangrejo real azul|s|n-f-cangrejo|b||
n-f-cangrejo-rey|Cangrejo rey|s|n-f-cangrejo|b||
n-f-cangrejo-rey-del-caribe|Cangrejo rey del Caribe|s|n-f-cangrejo|b||
n-f-cangrejo-rojo|Cangrejo rojo|s|n-f-cangrejo|b||
n-f-cangrejo-rojo-del-mediterraneo|Cangrejo rojo del Mediterráneo|s|n-f-cangrejo|b||
n-f-cangrejo-rosa|Cangrejo rosa|s|n-f-cangrejo|b||
n-f-cangullo|Cangullo|t|n-whitefish|b||
n-f-capelan|Capelán|t|n-whitefish|b||
n-f-capellan|Capellán|t|n-whitefish|b||
n-f-capilacea|Capilácea|t|n-whitefish|b||
n-f-carabinero|Carabinero|t|n-shellfish|b|t|
n-f-caracol|Caracol|t|n-whitefish|m|t|
n-f-caracol-luna|Caracol luna|t|n-bivalve|b||
n-f-caracola|Caracola|t|n-whitefish|b||
n-f-caramel|Caramel|t|n-whitefish|b||
n-f-caramel-imperial|Caramel imperial|s|n-f-caramel|b||
n-f-carbonero|Carbonero|t|n-whitefish|b|t|
n-f-cardenal-atlantico|Cardenal atlántico|t|n-whitefish|b||
n-f-carioca|Carioca|t|n-whitefish|m|t|
n-f-carita|Carita|t|n-bluefish|b||
n-f-carite-sierra|Carite sierra|t|n-bluefish|b||
n-f-carnada-de-vieja|Carnada de vieja|t|n-whitefish|b||
n-f-carneiro|Carneiro|t|n-bivalve|b||
n-f-carpa|Carpa|t|n-whitefish|b||
n-f-carpa-cabezona|Carpa cabezona|s|n-f-carpa|b||
n-f-carpa-naranja|Carpa naranja|s|n-f-carpa|b||
n-f-carpa-plateada|Carpa plateada|s|n-f-carpa|b||
n-f-carpa-rohu|Carpa rohu|s|n-f-carpa|b||
n-f-carpin|Carpín|t|n-whitefish|b||
n-f-casabe-del-pacifico|Casabe del Pacífico|t|n-whitefish|b||
n-f-casco-acanalado|Casco acanalado|t|n-whitefish|b||
n-f-casco-tirreno|Casco tirreno|t|n-whitefish|b||
n-f-catalufa|Catalufa|t|n-whitefish|b||
n-f-catalufa-pintada|Catalufa pintada|s|n-f-catalufa|b||
n-f-catemo-africano|Catemo africano|t|n-whitefish|b||
n-f-cauloco|Cauloco|t|n-whitefish|b||
n-f-cazon|Cazón|t|n-bluefish|b|t|
n-f-centolla|Centolla|t|n-shellfish|b|t|
n-f-centolla-chilena|Centolla chilena|s|n-f-centolla|b||
n-f-centolla-de-fondo|Centolla de fondo|s|n-f-centolla|b||
n-f-centolla-feroz|Centolla feroz|s|n-f-centolla|b||
n-f-centolla-peruana|Centolla peruana|s|n-f-centolla|b||
n-f-centollon-antartico|Centollón antártico|t|n-whitefish|b||
n-f-cerdo-marino|Cerdo marino|s|n-pork|b||
n-f-cero|Cero|t|n-bluefish|b||
n-f-chancharro|Chancharro|t|n-whitefish|b||
n-f-chanquete|Chanquete|t|n-whitefish|b||
n-f-chanquete-chino|Chanquete chino|s|n-f-chanquete|b||
n-f-chaparrudo|Chaparrudo|t|n-whitefish|b||
n-f-chavo|Chavo|t|n-whitefish|b||
n-f-cherna|Cherna|t|n-whitefish|b|t|
n-f-cherna-de-ley|Cherna de ley|s|n-f-cherna|b||
n-f-cherna-hapuka|Cherna hapuka|s|n-f-cherna|b||
n-f-cherne-barbudo|Cherne barbudo|t|n-whitefish|b||
n-f-cherne-blanco-de-yemen|Cherne blanco de Yemen|t|n-whitefish|b||
n-f-cherne-de-yemen|Cherne de Yemen|t|n-whitefish|b||
n-f-cherne-denton|Cherne dentón|t|n-whitefish|b||
n-f-cherne-escamoso|Cherne escamoso|t|n-whitefish|b||
n-f-cherne-moteado|Cherne moteado|t|n-whitefish|b||
n-f-cherne-pintado-de-yemen|Cherne pintado de Yemen|t|n-whitefish|b||
n-f-cherne-sahariano|Cherne sahariano|t|n-whitefish|b||
n-f-chicharro|Chicharro|t|n-bluefish|b||
n-f-chicharro-ojon|Chicharro ojón|s|n-f-chicharro|b||
n-f-chirla|Chirla|t|n-bivalve|b|t|
n-f-chlorella|Chlorella|t|n-seaweed|b||
n-f-choco-canario|Choco canario|t|n-cephalopod|b||
n-f-cholga|Cholga|t|n-bivalve|b||
n-f-chopa|Chopa|t|n-whitefish|b|t|
n-f-chopito|Chopito|t|n-whitefish|m|t|
n-f-chopon|Chopón|t|n-whitefish|b||
n-f-choquito|Choquito|t|n-cephalopod|b|t|
n-f-choquito-picudo|Choquito picudo|s|n-f-choquito|b||
n-f-chucho|Chucho|t|n-whitefish|b||
n-f-chucla|Chucla|t|n-whitefish|b||
n-f-chucla-ojona|Chucla ojona|s|n-f-chucla|b||
n-f-chucleto|Chucleto|t|n-whitefish|b||
n-f-cigala|Cigala|t|n-shellfish|b|t|
n-f-cigala-de-andaman|Cigala de Andamán|s|n-f-cigala|b||
n-f-cigala-de-bandas-rojas|Cigala de bandas rojas|s|n-f-cigala|b||
n-f-cigala-de-mozambique|Cigala de Mozambique|s|n-f-cigala|b||
n-f-cigala-del-indico|Cigala del Índico|s|n-f-cigala|b||
n-f-cigarra|Cigarra|t|n-shellfish|b||elaborado,sin elaborar
n-f-cigarra-enana|Cigarra enana|s|n-f-cigarra|b||
n-f-cigarra-oriental|Cigarra oriental|s|n-f-cigarra|b||
n-f-cigarra-roja|Cigarra roja|s|n-f-cigarra|b||
n-f-cirujano|Cirujano|t|n-whitefish|b||
n-f-claca|Claca|t|n-whitefish|b||
n-f-cobia|Cobia|t|n-whitefish|b||
n-f-cococha|Cococha|t|n-whitefish|m|t|
n-f-codium|Codium|t|n-seaweed|b||
n-f-cohombro|Cohombro|t|n-shellfish|b||
n-f-cohombro-naranja|Cohombro naranja|s|n-f-cohombro|b||
n-f-cohombro-rojo|Cohombro rojo|s|n-f-cohombro|b||
n-f-cohombro-tubo|Cohombro tubo|s|n-f-cohombro|b||
n-f-cojinova|Cojinova|t|n-whitefish|b||
n-f-cola-de-pavo|Cola de pavo|t|n-whitefish|b||
n-f-cona|Coña|t|n-bivalve|b||
n-f-conejo|Conejo|t|n-whitefish|b||
n-f-congrio|Congrio|t|n-whitefish|b|t|
n-f-coquina|Coquina|t|n-bivalve|b|t|
n-f-corneta-flautera|Corneta flautera|t|n-whitefish|b||
n-f-corneta-palo|Corneta palo|t|n-whitefish|b||
n-f-cornuda|Cornuda|t|n-whitefish|b||
n-f-corruco|Corruco|t|n-bivalve|b||
n-f-corvallo|Corvallo|t|n-whitefish|b||
n-f-corvina|Corvina|t|n-farmed|b|t|
n-f-corvina-africana|Corvina africana|s|n-f-corvina|b||
n-f-corvina-arabe|Corvina árabe|s|n-f-corvina|b||
n-f-corvina-asiatica|Corvina asiática|s|n-f-corvina|b||
n-f-corvina-bronce|Corvina bronce|s|n-f-corvina|b||
n-f-corvina-de-angola|Corvina de Angola|s|n-f-corvina|b||
n-f-corvina-de-boca-amarilla|Corvina de boca amarilla|s|n-f-corvina|b||
n-f-corvina-naranja|Corvina naranja|s|n-f-corvina|b||
n-f-corvina-negra|Corvina negra|s|n-f-corvina|b||
n-f-corvina-pintada|Corvina pintada|s|n-f-corvina|b||
n-f-corvina-tigre|Corvina tigre|s|n-f-corvina|b||
n-f-corvinata-amarilla|Corvinata amarilla|t|n-whitefish|b||
n-f-corvinata-azafran|Corvinata azafrán|t|n-whitefish|b||
n-f-corvinata-listada|Corvinata listada|t|n-whitefish|b||
n-f-corvinata-pelona|Corvinata pelona|t|n-whitefish|b||
n-f-corvinata-plateada|Corvinata plateada|t|n-whitefish|b||
n-f-corvinata-punteada|Corvinata punteada|t|n-whitefish|b||
n-f-corvinato|Corvinato|t|n-whitefish|b||
n-f-corvinon-amarillo|Corvinón amarillo|t|n-whitefish|b||
n-f-corvinon-ocelado|Corvinón ocelado|t|n-whitefish|b||
n-f-cystoseira-dorada|Cystoseira dorada|t|n-whitefish|b||
n-f-daoyu|Daoyú|t|n-whitefish|b||
n-f-denton|Dentón|t|n-whitefish|b|t|
n-f-denton-angoleno|Dentón angoleño|s|n-f-denton|b||
n-f-denton-canario|Dentón canario|s|n-f-denton|b||
n-f-denton-nufar|Dentón nufar|s|n-f-denton|b||
n-f-dilsea-carnosa|Dilsea carnosa|t|n-whitefish|b||
n-f-dorada|Dorada|t|n-farmed|b|t|
n-f-dorado|Dorado|t|n-bluefish|b||
n-f-dormilona|Dormilona|t|n-whitefish|b||
n-f-dragoncillo|Dragoncillo|t|n-whitefish|b||
n-f-dragoncillo-rojo|Dragoncillo rojo|s|n-f-dragoncillo|b||
n-f-dulse|Dulse|t|n-seaweed|b||
n-f-dumontia|Dumontia|t|n-whitefish|b||
n-f-eglefino|Eglefino|t|n-whitefish|b||
n-f-elaborado|Elaborado|t|n-whitefish|m|t|
n-f-eperlano|Eperlano|t|n-whitefish|b||
n-f-erizo-atlantico|Erizo atlántico|t|n-shellfish|b||
n-f-erizo-blanco|Erizo blanco|t|n-shellfish|b||
n-f-erizo-de-mar|Erizo de mar|t|n-shellfish|b|t|
n-f-erizo-europeo|Erizo europeo|t|n-shellfish|b||
n-f-erizo-negro|Erizo negro|t|n-shellfish|b||
n-f-erizo-violaceo|Erizo violaceo|t|n-shellfish|b||
n-f-escolar|Escolar|t|n-whitefish|b||
n-f-escolar-negro|Escolar negro|s|n-f-escolar|b||
n-f-escorpion|Escorpión|t|n-whitefish|b||
n-f-escorpora|Escórpora|t|n-whitefish|b||
n-f-escupina|Escupiña|t|n-bivalve|b|t|
n-f-espadin|Espadín|t|n-bluefish|b||
n-f-espadin-austral|Espadín austral|s|n-f-espadin|b||
n-f-espadin-del-ganges|Espadín del Ganges|s|n-f-espadin|b||
n-f-espagueti-de-mar|Espagueti de mar|t|n-seaweed|b||
n-f-espardena|Espardeña|t|n-shellfish|b||
n-f-espeton|Espetón|t|n-whitefish|b||
n-f-espeton-boca-amarilla|Espetón boca amarilla|s|n-f-espeton|b||
n-f-espinoso|Espinoso|t|n-whitefish|b||
n-f-espirulina|Espirulina|t|n-seaweed|b||
n-f-estornino-del-atlantico|Estornino del Atlántico|t|n-bluefish|b||
n-f-esturion|Esturión|t|n-whitefish|b||
n-f-esturion-beluga|Esturión beluga|s|n-f-esturion|b||
n-f-esturion-blanco|Esturión blanco|s|n-f-esturion|b||
n-f-esturion-del-adriatico|Esturión del Adriático|s|n-f-esturion|b||
n-f-esturion-del-danubio|Esturión del Danubio|s|n-f-esturion|b||
n-f-esturion-estrellado|Esturión estrellado|s|n-f-esturion|b||
n-f-esturion-siberiano|Esturión siberiano|s|n-f-esturion|b||
n-f-falsa-brotola|Falsa brótola|t|n-whitefish|b||
n-f-falsa-gorgona|Falsa gorgona|t|n-whitefish|b||
n-f-falsa-necora|Falsa nécora|t|n-whitefish|b||
n-f-falso-abade|Falso abade|t|n-whitefish|b||
n-f-falso-abadejo|Falso abadejo|t|n-whitefish|b||
n-f-faneca|Faneca|t|n-whitefish|b|t|
n-f-faneca-noruega|Faneca noruega|s|n-f-faneca|b||
n-f-fletan|Fletán|t|n-whitefish|b|t|
n-f-fletan-negro|Fletán negro|s|n-f-fletan|b||
n-f-fucus|Fucus|t|n-seaweed|b||
n-f-fula|Fula|t|n-whitefish|b||
n-f-fula-blanca|Fula blanca|s|n-f-fula|b||
n-f-fula-negra|Fula negra|s|n-f-fula|b||
n-f-galan|Galán|t|n-whitefish|b||
n-f-galera|Galera|t|n-shellfish|b|t|
n-f-gallano|Gallano|t|n-whitefish|b||
n-f-galleta|Galleta|t|n-whitefish|b||
n-f-gallineta|Gallineta|t|n-whitefish|b|t|
n-f-gallineta-del-cabo|Gallineta del Cabo|s|n-f-gallineta|b||
n-f-gallineta-del-pacifico|Gallineta del Pacífico|s|n-f-gallineta|b||
n-f-gallineta-nordica|Gallineta nórdica|s|n-f-gallineta|b||
n-f-gallineta-oceanica|Gallineta oceánica|s|n-f-gallineta|b||
n-f-gallineta-pinta|Gallineta pinta|s|n-f-gallineta|b||
n-f-gallineta-rosada|Gallineta rosada|s|n-f-gallineta|b||
n-f-gallineta-toro|Gallineta toro|s|n-f-gallineta|b||
n-f-gallo|Gallo|t|n-whitefish|b|t|
n-f-gallo-del-norte|Gallo del norte|s|n-f-gallo|b||
n-f-gallo-plateado|Gallo plateado|s|n-f-gallo|b||
n-f-galludo|Galludo|t|n-whitefish|b||
n-f-galludo-nato|Galludo ñato|s|n-f-galludo|b||
n-f-galua|Galua|t|n-bluefish|b||
n-f-galupe|Galupe|t|n-bluefish|b|t|
n-f-gamba|Gamba|t|n-shellfish|b|t|
n-f-gamba-roja-del-mediterraneo|Gamba roja del Mediterráneo|s|n-f-gamba|b||
n-f-gambon|Gambón|t|n-whitefish|b|t|
n-f-gambon-de-mozambique|Gambón de Mozambique|s|n-f-gambon|b||
n-f-garneo|Garneo|t|n-whitefish|b||
n-f-gato|Gato|t|n-whitefish|m|t|
n-f-gigartina|Gigartina|t|n-whitefish|b||
n-f-gitano|Gitano|t|n-whitefish|b||
n-f-globito|Globito|t|n-cephalopod|b||
n-f-globito-robusto|Globito robusto|s|n-f-globito|b||
n-f-globito-tierno|Globito tierno|s|n-f-globito|b||
n-f-gobido-de-cristal|Góbido de cristal|t|n-whitefish|b||
n-f-golleta|Golleta|t|n-whitefish|b||
n-f-golondrina|Golondrina|t|n-whitefish|b||
n-f-golondrina-de-mar|Golondrina de mar|s|n-f-golondrina|b||
n-f-gracilaria|Gracilaria|t|n-seaweed|b||
n-f-gracilaria-u-ogonori|Gracilaria u ogonori|s|n-f-gracilaria|b||
n-f-granadero|Granadero|t|n-whitefish|b||
n-f-granadero-ojisapo|Granadero ojisapo|s|n-f-granadero|b||
n-f-guabina|Guabina|t|n-whitefish|b||
n-f-guitarra-de-morro-negro|Guitarra de morro negro|t|n-whitefish|b||
n-f-gula|Gula|t|n-whitefish|m|t|
n-f-halibut-carioca|Halibut carioca|t|n-whitefish|b||
n-f-halibut-de-alaska|Halibut de Alaska|t|n-whitefish|b||
n-f-halibut-de-kamchatka|Halibut de Kamchatka|t|n-whitefish|b||
n-f-halibut-del-japon|Halibut del Japón|t|n-whitefish|b||
n-f-halibut-del-pacifico|Halibut del Pacífico|t|n-whitefish|b||
n-f-halibut-espinoso|Halibut espinoso|t|n-whitefish|b||
n-f-halibut-patagon|Halibut patagón|t|n-whitefish|b||
n-f-halibut-perro|Halibut perro|t|n-whitefish|b||
n-f-halibut-tropical|Halibut tropical|t|n-whitefish|b||
n-f-herrera|Herrera|t|n-whitefish|b|t|
n-f-hoja-de-col-marina|Hoja de col marina|t|n-whitefish|b||
n-f-hueva|Hueva|t|n-whitefish|m|t|
n-f-jaiba-de-roca-dientuda|Jaiba de roca dientuda|t|n-shellfish|b||
n-f-jaiba-limon|Jaiba limón|t|n-shellfish|b||
n-f-jaiba-satinada|Jaiba satinada|t|n-shellfish|b||
n-f-japuta|Japuta|t|n-bluefish|b|t|
n-f-jaqueta|Jaqueta|t|n-whitefish|b||
n-f-julia|Julia|t|n-whitefish|b||
n-f-jurel|Jurel|t|n-bluefish|b|t|
n-f-jurel-azul|Jurel azul|s|n-f-jurel|b||
n-f-jurel-caballo|Jurel caballo|s|n-f-jurel|b||
n-f-jurel-chileno|Jurel chileno|s|n-f-jurel|b||
n-f-jurel-de-cunene|Jurel de Cunene|s|n-f-jurel|b||
n-f-jurel-del-cabo|Jurel del Cabo|s|n-f-jurel|b||
n-f-jurel-limon|Jurel limón|s|n-f-jurel|b||
n-f-jurel-mediterraneo|Jurel mediterráneo|s|n-f-jurel|b||
n-f-jurel-real|Jurel real|s|n-f-jurel|b||
n-f-juyon|Juyón|t|n-whitefish|b||
n-f-kombu-de-remos|Kombu de remos|t|n-seaweed|b||
n-f-kombu-japones|Kombu japonés|t|n-seaweed|b||
n-f-lagarto|Lagarto|t|n-whitefish|b||
n-f-lagarto-capitan|Lagarto capitán|s|n-f-lagarto|b||
n-f-laminaria|Laminaria|t|n-seaweed|b||
n-f-lamprea|Lamprea|t|n-whitefish|b||
n-f-lampuga|Lampuga|t|n-bluefish|b||
n-f-langosta|Langosta|t|n-shellfish|b|t|
n-f-langosta-australiana|Langosta australiana|s|n-f-langosta|b||
n-f-langosta-barbona|Langosta barbona|s|n-f-langosta|b||
n-f-langosta-del-cabo|Langosta del Cabo|s|n-f-langosta|b||
n-f-langosta-del-caribe|Langosta del Caribe|s|n-f-langosta|b||
n-f-langosta-del-natal|Langosta del Natal|s|n-f-langosta|b||
n-f-langosta-del-peru|Langosta del Perú|s|n-f-langosta|b||
n-f-langosta-herrena|Langosta herreña|s|n-f-langosta|b||
n-f-langosta-mora|Langosta mora|s|n-f-langosta|b||
n-f-langosta-real|Langosta real|s|n-f-langosta|b||
n-f-langosta-verde|Langosta verde|s|n-f-langosta|b|t|
n-f-langostilla-roja|Langostilla roja|t|n-shellfish|b||
n-f-langostino|Langostino|t|n-shellfish|b|t|
n-f-langostino-banana|Langostino banana|s|n-f-langostino|b||
n-f-langostino-blanco|Langostino blanco|s|n-f-langostino|b||
n-f-langostino-cristal|Langostino cristal|s|n-f-langostino|b||
n-f-langostino-jumbo|Langostino jumbo|s|n-f-langostino|b||
n-f-langostino-marfil|Langostino marfil|s|n-f-langostino|b||
n-f-langostino-mediterraneo|Langostino mediterráneo|s|n-f-langostino|b||
n-f-langostino-moruno|Langostino moruno|s|n-f-langostino|b||
n-f-langostino-rosado|Langostino rosado|s|n-f-langostino|b||
n-f-langostino-tigre|Langostino tigre|s|n-f-langostino|b|t|
n-f-langostino-tigre-arco-iris|Langostino tigre arco iris|s|n-f-langostino|b||
n-f-langostino-tigre-marron|Langostino tigre marrón|s|n-f-langostino|b||
n-f-langostino-titi|Langostino Titi|s|n-f-langostino|b||
n-f-langostino-vannamei|Langostino vannamei|s|n-f-langostino|b||
n-f-lapa|Lapa|t|n-bivalve|b||
n-f-lapa-aspera|Lapa áspera|s|n-f-lapa|b||
n-f-lapa-negra|Lapa negra|s|n-f-lapa|b||
n-f-lapa-punteada|Lapa punteada|s|n-f-lapa|b||
n-f-laurencia|Laurencia|t|n-whitefish|b||
n-f-lechuga-de-mar|Lechuga de mar|t|n-seaweed|b||
n-f-lengua-de-canarias|Lengua de Canarias|t|n-whitefish|b||
n-f-lengua-de-ghana|Lengua de Ghana|t|n-whitefish|b||
n-f-lengua-nigeriana|Lengua nigeriana|t|n-whitefish|b||
n-f-lengua-senegalesa|Lengua senegalesa|t|n-whitefish|b||
n-f-lengua-tropical|Lengua Tropical|t|n-whitefish|b||
n-f-lenguado|Lenguado|t|n-whitefish|m|t|
n-f-lenguado-africano|Lenguado africano|t|n-whitefish|b||
n-f-lenguado-de-arena|Lenguado de arena|t|n-whitefish|b||
n-f-lenguado-de-frechkop|Lenguado de Frechkop|t|n-whitefish|b||
n-f-lenguado-de-guinea|Lenguado de Guinea|t|n-whitefish|b||
n-f-lenguado-de-klein|Lenguado de Klein|t|n-whitefish|b||
n-f-lenguado-de-nueva-zelanda|Lenguado de Nueva Zelanda|t|n-whitefish|b||
n-f-lenguado-de-profundidad|Lenguado de profundidad|t|n-whitefish|b||
n-f-lenguado-del-adriatico|Lenguado del Adriático|t|n-whitefish|b||
n-f-lenguado-del-cabo|Lenguado del Cabo|t|n-whitefish|b||
n-f-lenguado-del-sur|Lenguado del sur|t|n-whitefish|b||
n-f-lenguado-egipcio|Lenguado egipcio|t|n-whitefish|b||
n-f-lenguado-europeo|Lenguado europeo|t|n-whitefish|b||
n-f-lenguado-limon-austral|Lenguado limón austral|t|n-whitefish|b||
n-f-lenguado-maori|Lenguado maorí|t|n-whitefish|b||
n-f-lenguado-pelicano|Lenguado pelícano|t|n-whitefish|b||
n-f-lenguado-portugues|Lenguado portugués|t|n-whitefish|b||
n-f-lenguado-senegales|Lenguado senegalés|t|n-whitefish|b||
n-f-lenguado-tres-monedas|Lenguado tres monedas|t|n-whitefish|b||
n-f-lenguado-velludo|Lenguado velludo|t|n-whitefish|b||
n-f-liba|Liba|t|n-whitefish|m|t|
n-f-lija|Lija|t|n-whitefish|b||
n-f-lija-aspera|Lija áspera|s|n-f-lija|b||
n-f-lija-azul|Lija azul|s|n-f-lija|b||
n-f-lija-gallo|Lija gallo|s|n-f-lija|b||
n-f-limanda|Limanda|t|n-whitefish|b|t|
n-f-limanda-amarilla|Limanda amarilla|s|n-f-limanda|b||
n-f-limanda-del-canal|Limanda del canal|s|n-f-limanda|b||
n-f-limanda-japonesa|Limanda japonesa|s|n-f-limanda|b||
n-f-lirio|Lirio|t|n-whitefish|b|t|
n-f-lisa|Lisa|t|n-bluefish|b||
n-f-listado|Listado|t|n-bluefish|b||
n-f-locha-de-roca|Locha de roca|t|n-whitefish|b||
n-f-locha-guntea|Locha guntea|t|n-whitefish|b||
n-f-loco|Loco|t|n-whitefish|b||
n-f-longueiron|Longueirón|t|n-bivalve|b||
n-f-lota|Lota|t|n-whitefish|b||
n-f-lubina-japonesa|Lubina japonesa|s|n-seabass|b||
n-f-lubina-rayada|Lubina rayada|s|n-seabass|b||
n-f-luciano|Luciano|t|n-whitefish|b||
n-f-lucio|Lucio|t|n-whitefish|b||
n-f-lucioperca|Lucioperca|t|n-whitefish|b||
n-f-lula|Lula|t|n-whitefish|m|t|
n-f-lumpo|Lumpo|t|n-whitefish|b||
n-f-luna-de-la-india|Luna de la India|t|n-whitefish|b||
n-f-luna-real|Luna real|t|n-whitefish|b||
n-f-luvaro|Luvaro|t|n-whitefish|b||
n-f-macarela|Macarela|t|n-whitefish|b||
n-f-macha|Macha|t|n-whitefish|b||
n-f-machuelo|Machuelo|t|n-bluefish|b||
n-f-machuelo-araucano|Machuelo araucano|s|n-f-machuelo|b||
n-f-madrilla|Madrilla|t|n-whitefish|b||
n-f-magre|Magre|t|n-whitefish|m|t|
n-f-manta|Manta|t|n-whitefish|b||
n-f-manta-cornuda|Manta cornuda|s|n-f-manta|b||
n-f-mantellina|Mantellina|t|n-whitefish|b||
n-f-maragota|Maragota|t|n-whitefish|b||
n-f-mariquita-europea|Mariquita europea|t|n-whitefish|b||
n-f-marlin-azul|Marlín azul|t|n-bluefish|b||
n-f-marlin-peto|Marlín peto|t|n-bluefish|b||
n-f-marlin-rayado|Marlín rayado|t|n-bluefish|b||
n-f-marlin-trompa|Marlín trompa|t|n-bluefish|b||
n-f-marolo|Marolo|t|n-bivalve|b||
n-f-marrajo|Marrajo|t|n-bluefish|b|t|
n-f-marrajo-carite|Marrajo carite|s|n-f-marrajo|b||
n-f-marrajo-sardinero|Marrajo sardinero|s|n-f-marrajo|b||
n-f-maruca|Maruca|t|n-whitefish|b|t|
n-f-maruca-azul|Maruca azul|s|n-f-maruca|b||
n-f-maruca-espanola|Maruca española|s|n-f-maruca|b||
n-f-marujito|Marujito|t|n-whitefish|b||
n-f-medregal|Medregal|t|n-bluefish|b||
n-f-mejillon|Mejillón|t|n-bivalve|b|t|
n-f-mejillon-de-chile|Mejillón de Chile|s|n-f-mejillon|b||
n-f-mejillon-de-nueva-zelanda|Mejillón de Nueva Zelanda|s|n-f-mejillon|b||
n-f-mejillon-del-pacifico|Mejillón del Pacífico|s|n-f-mejillon|b||
n-f-melva|Melva|t|n-bluefish|b|t|
n-f-mendo|Mendo|t|n-whitefish|b|t|
n-f-mendo-limon|Mendo limón|s|n-f-mendo|b||
n-f-merlan|Merlán|t|n-whitefish|b||
n-f-merluza-americana|Merluza americana|s|n-hake|b||
n-f-merluza-argentina|Merluza argentina|s|n-hake|b||
n-f-merluza-austral|Merluza austral|s|n-hake|b|t|
n-f-merluza-de-cola|Merluza de cola|s|n-hake|b||
n-f-merluza-del-cabo|Merluza del Cabo|s|n-hake|b||
n-f-merluza-del-pacifico|Merluza del Pacífico|s|n-hake|b||
n-f-merluza-del-peru|Merluza del Perú|s|n-hake|b||
n-f-merluza-negra|Merluza negra|s|n-hake|b||
n-f-mero|Mero|t|n-whitefish|b|t|
n-f-mero-antartico-azul|Mero antártico azul|s|n-f-mero|b||
n-f-mero-castano|Mero castaño|s|n-f-mero|b||
n-f-mero-espinudo|Mero espinudo|s|n-f-mero|b||
n-f-mero-guaza|Mero guaza|s|n-f-mero|b||
n-f-mero-malabarico|Mero malabárico|s|n-f-mero|b||
n-f-mero-medioluto|Mero medioluto|s|n-f-mero|b||
n-f-mero-oliva|Mero oliva|s|n-f-mero|b||
n-f-mero-sureno|Mero sureño|s|n-f-mero|b||
n-f-microalga-chromochloris|Microalga Chromochloris|t|n-seaweed|b||
n-f-microalga-dunaliella|Microalga Dunaliella|t|n-seaweed|b||
n-f-microalga-haematococcus|Microalga Haematococcus|t|n-seaweed|b||
n-f-microalga-isochrysis|Microalga Isochrysis|t|n-seaweed|b||
n-f-microalga-microchloropsis|Microalga Microchloropsis|t|n-seaweed|b||
n-f-microalga-tetraselmis|Microalga Tetraselmis|t|n-seaweed|b||
n-f-mielga|Mielga|t|n-whitefish|b||
n-f-miracielo|Miracielo|t|n-whitefish|b||
n-f-mojarra|Mojarra|t|n-whitefish|b||
n-f-mora|Mora|t|n-whitefish|b|t|
n-f-moranella-de-gunter|Moranella de Günter|t|n-whitefish|b||
n-f-moranella-roja|Moranella roja|t|n-whitefish|b||
n-f-morena|Morena|t|n-whitefish|b||
n-f-morenocio-denton|Morenocio dentón|t|n-whitefish|b||
n-f-morragute|Morragute|t|n-bluefish|b||
n-f-morruncho|Morruncho|t|n-bivalve|b||
n-f-muergo|Muergo|t|n-bivalve|b|t|
n-f-mugil|Mugil|t|n-bluefish|b||
n-f-mujol|Mujol|t|n-bluefish|m|t|
n-f-murion|Murión|t|n-whitefish|b||
n-f-musgo-de-corcega|Musgo de Córcega|t|n-seaweed|b||
n-f-musgo-de-irlanda|Musgo de Irlanda|t|n-seaweed|b||
n-f-musgo-estrellado|Musgo estrellado|t|n-seaweed|b||
n-f-musola|Musola|t|n-whitefish|b||
n-f-musola-de-manchas-negras|Musola de manchas negras|s|n-f-musola|b||
n-f-musola-dentuda|Musola Dentuda|s|n-f-musola|b||
n-f-musola-segadora|Musola segadora|s|n-f-musola|b||
n-f-mustela|Mustela|t|n-whitefish|b||
n-f-navaja|Navaja|t|n-bivalve|b||
n-f-navaja-americana|Navaja americana|s|n-f-navaja|b||
n-f-navaja-macha|Navaja macha|s|n-f-navaja|b||
n-f-navaja-recta|Navaja recta|s|n-f-navaja|b||
n-f-navajuela|Navajuela|t|n-whitefish|b||
n-f-necora|Nécora|t|n-shellfish|b|t|
n-f-necora-nudosa|Nécora nudosa|s|n-f-necora|b||
n-f-negrito|Negrito|t|n-whitefish|b||
n-f-noriega|Noriega|t|n-whitefish|b||
n-f-obispo|Obispo|t|n-whitefish|b||
n-f-oblada|Oblada|t|n-whitefish|b|t|
n-f-ochavo|Ochavo|t|n-whitefish|b||
n-f-ojo-de-piedra|Ojo de piedra|t|n-whitefish|b||
n-f-ojoverde-u-ojiverde|Ojoverde u ojiverde|t|n-whitefish|b||
n-f-olayo-atlantico|Olayo atlántico|t|n-whitefish|b||
n-f-oreja-de-mar|Oreja de mar|t|n-bivalve|b||
n-f-oreo-negro|Oreo negro|t|n-whitefish|b||
n-f-ortiguilla|Ortiguilla|t|n-whitefish|b||
n-f-ostion|Ostion|t|n-whitefish|m|t|
n-f-ostra|Ostra|t|n-bivalve|b|t|
n-f-ostra-rizada|Ostra rizada|s|n-f-ostra|b||
n-f-ostra-virginica-u-ostra-americana|Ostra virgínica u ostra americana|s|n-f-ostra|b||
n-f-ovatum|Ovatum|t|n-whitefish|b||
n-f-pacu|Pacú|t|n-whitefish|b||
n-f-pailona|Pailona|t|n-whitefish|b||
n-f-palometa-austral|Palometa austral|t|n-bluefish|b||
n-f-palometa-blanca|Palometa blanca|t|n-bluefish|b||
n-f-palometa-de-quilla|Palometa de Quilla|t|n-bluefish|b||
n-f-palometa-oriental|Palometa oriental|t|n-bluefish|b||
n-f-palometa-plateada|Palometa plateada|t|n-bluefish|b||
n-f-palometa-roja|Palometa roja|t|n-bluefish|b|t|
n-f-palometon|Palometón|t|n-bluefish|b||
n-f-pampanito|Pampanito|t|n-whitefish|b||
n-f-pampano|Pámpano|t|n-whitefish|b||
n-f-pampano-mediano|Pámpano mediano|s|n-f-pampano|b||
n-f-pancho|Pancho|t|n-whitefish|m|t|
n-f-panga|Panga|t|n-whitefish|b|t|
n-f-paparda|Paparda|t|n-bluefish|b||
n-f-papuda|Papuda|t|n-whitefish|b||
n-f-pargo|Pargo|t|n-whitefish|b|t|
n-f-pargo-criollo|Pargo criollo|s|n-f-pargo|b||
n-f-pargo-de-la-mancha|Pargo de la mancha|s|n-f-pargo|b||
n-f-pargo-de-puntos-azules|Pargo de puntos azules|s|n-f-pargo|b||
n-f-pargo-gris|Pargo gris|s|n-f-pargo|b||
n-f-pargo-marron-africano|Pargo Marrón africano|s|n-f-pargo|b||
n-f-pargo-peruano|Pargo peruano|s|n-f-pargo|b||
n-f-pargo-rojo|Pargo rojo|s|n-f-pargo|b||
n-f-pargo-rosado|Pargo rosado|s|n-f-pargo|b||
n-f-parona|Parona|t|n-whitefish|b||
n-f-pastinaca-negra|Pastinaca negra|t|n-whitefish|b||
n-f-patas-o-pechos-cangrejo|Patas o pechos cangrejo|t|n-whitefish|m|t|
n-f-patelo|Patelo|t|n-whitefish|b||
n-f-patudo|Patudo|t|n-bluefish|b||
n-f-peces-de-rio|Peces de rio|t|n-whitefish|m|t|
n-f-peine-de-china|Peine de China|t|n-bivalve|b||
n-f-peje-camello|Peje camello|t|n-whitefish|b||
n-f-peje-obispo|Peje obispo|t|n-whitefish|b||
n-f-peje-trompeta|Peje trompeta|t|n-whitefish|b||
n-f-peje-verde|Peje verde|t|n-whitefish|b||
n-f-pejeperro|Pejeperro|t|n-whitefish|b||
n-f-pejepuerco-oceanico|Pejepuerco oceánico|t|n-whitefish|b||
n-f-pejerrey|Pejerrey|t|n-bluefish|b||
n-f-pelaya|Pelaya|t|n-whitefish|m|t|
n-f-peluda|Peluda|t|n-whitefish|b||
n-f-peluda-imperial|Peluda imperial|s|n-f-peluda|b||
n-f-peludilla|Peludilla|t|n-whitefish|b||
n-f-perca|Perca|t|n-whitefish|m|t|
n-f-perca-americana|Perca americana|t|n-whitefish|b||
n-f-perca-de-mar|Perca de mar|t|n-whitefish|b||
n-f-perca-de-mar-argentina|Perca de mar argentina|t|n-whitefish|b||
n-f-perca-del-nilo|Perca del Nilo|t|n-whitefish|b||
n-f-perca-gigante|Perca gigante|t|n-whitefish|b||
n-f-perca-koi|Perca koi|t|n-whitefish|b||
n-f-percebe|Percebe|t|n-shellfish|b|t|
n-f-percebe-canadiense|Percebe canadiense|s|n-f-percebe|b||
n-f-percebe-del-pacifico|Percebe del Pacífico|s|n-f-percebe|b||
n-f-peregrino|Peregrino|t|n-whitefish|b||
n-f-perla|Perla|t|n-whitefish|m|t|
n-f-perlon|Perlón|t|n-whitefish|b|t|
n-f-perro|Perro|t|n-whitefish|m|t|
n-f-perro-chico|Perro chico|t|n-whitefish|b||
n-f-perro-del-norte|Perro del norte|t|n-whitefish|b||
n-f-pescada|Pescada|t|n-whitefish|m|t|
n-f-pescadilla|Pescadilla|t|n-whitefish|m|t|
n-f-pescado|Pescado|t|n-whitefish|m|t|
n-f-peto|Peto|t|n-bluefish|b||
n-f-pez-ballesta|Pez ballesta|t|n-whitefish|b||
n-f-pez-ballesta-australiano|Pez ballesta australiano|t|n-whitefish|b||
n-f-pez-ballesta-chino|Pez ballesta chino|t|n-whitefish|b||
n-f-pez-ballesta-rugoso|Pez Ballesta rugoso|t|n-whitefish|b||
n-f-pez-cinta|Pez cinta|t|n-whitefish|b||
n-f-pez-cinto|Pez cinto|t|n-bluefish|b||
n-f-pez-conejo|Pez conejo|t|n-whitefish|b||
n-f-pez-de-limon|Pez de limón|t|n-bluefish|b||
n-f-pez-de-san-pedro|Pez de San Pedro|t|n-whitefish|b||
n-f-pez-diablo|Pez diablo|t|n-whitefish|b||
n-f-pez-espada|Pez espada|t|n-bluefish|b|t|
n-f-pez-gallo-de-nueva-zelanda|Pez gallo de Nueva Zelanda|t|n-whitefish|b||
n-f-pez-gato|Pez gato|t|n-whitefish|b||
n-f-pez-guitarra|Pez guitarra|t|n-whitefish|b||
n-f-pez-hielo|Pez hielo|t|n-whitefish|b||
n-f-pez-hielo-rayado|Pez hielo rayado|t|n-whitefish|b||
n-f-pez-linterna|Pez Linterna|t|n-whitefish|b||
n-f-pez-lobo|Pez lobo|t|n-whitefish|b||
n-f-pez-loro-de-guinea|Pez loro de Guinea|t|n-whitefish|b||
n-f-pez-mariposa|Pez mariposa|t|n-whitefish|b||
n-f-pez-piloto|Pez piloto|t|n-whitefish|b||
n-f-pez-pluma|Pez pluma|t|n-whitefish|b||
n-f-pez-reina|Pez reina|t|n-bluefish|b||
n-f-pez-rubi|Pez rubí|t|n-whitefish|b||
n-f-pez-sable|Pez sable|t|n-bluefish|b||
n-f-pez-sable-savalai|Pez sable savalai|t|n-whitefish|b||
n-f-pez-sapo|Pez sapo|t|n-whitefish|b||
n-f-pez-serpiente-rayado|Pez serpiente rayado|t|n-whitefish|b||
n-f-pez-unicornio|Pez unicornio|t|n-whitefish|b||
n-f-pez-vela|Pez vela|t|n-bluefish|b||
n-f-pez-vela-del-atlantico|Pez vela del Atlántico|t|n-bluefish|b||
n-f-pez-volador|Pez volador|t|n-whitefish|b||
n-f-pez-zorro|Pez zorro|t|n-whitefish|b||
n-f-pez-zorro-negro|Pez zorro negro|t|n-whitefish|b||
n-f-picon|Picón|t|n-whitefish|b||
n-f-picuca|Picuca|t|n-whitefish|b||
n-f-picuda-barracuda|Picuda Barracuda|t|n-whitefish|b||
n-f-pintadilla|Pintadilla|t|n-whitefish|b||
n-f-pintarroja|Pintarroja|t|n-bluefish|b|t|
n-f-pintarroja-bocanegra|Pintarroja bocanegra|s|n-f-pintarroja|b||
n-f-pintarroja-islandica|Pintarroja islándica|s|n-f-pintarroja|b||
n-f-pion|Pión|t|n-whitefish|b||
n-f-pion-de-altura|Pión de altura|s|n-f-pion|b||
n-f-platija|Platija|t|n-whitefish|b|t|
n-f-platija-americana|Platija americana|s|n-f-platija|b||
n-f-platija-de-alaska|Platija de Alaska|s|n-f-platija|b||
n-f-platija-de-nueva-zelanda|Platija de Nueva Zelanda|s|n-f-platija|b||
n-f-platija-del-pacifico|Platija del Pacífico|s|n-f-platija|b||
n-f-platija-japonesa|Platija japonesa|s|n-f-platija|b||
n-f-platija-tresojos|Platija tresojos|s|n-f-platija|b||
n-f-platusa|Platusa|t|n-whitefish|m|t|
n-f-poda|Poda|t|n-whitefish|b||
n-f-polido|Polido|t|n-whitefish|b||
n-f-porredana|Porredana|t|n-whitefish|b||
n-f-pota|Pota|t|n-cephalopod|b|t|
n-f-pota-cardena|Pota cárdena|s|n-f-pota|b||
n-f-pota-japonesa|Pota japonesa|s|n-f-pota|b||
n-f-pota-magister|Pota magister|s|n-f-pota|b||
n-f-pota-naranja|Pota naranja|s|n-f-pota|b||
n-f-pota-neozelandesa|Pota neozelandesa|s|n-f-pota|b||
n-f-pota-saltadora|Pota saltadora|s|n-f-pota|b||
n-f-poton-del-pacifico|Potón del Pacífico|t|n-cephalopod|b||
n-f-productos-carnico|Productos carnico|t|n-whitefish|m|t|
n-f-pulpito-oriental|Pulpito oriental|t|n-whitefish|b||
n-f-pulpo-almizclado|Pulpo almizclado|s|n-octopus|b||
n-f-pulpo-azulon|Pulpo azulón|s|n-octopus|b||
n-f-pulpo-blanco|Pulpo blanco|s|n-octopus|b||
n-f-pulpo-burlon|Pulpo burlón|s|n-octopus|b||
n-f-pulpo-de-angel|Pulpo de ángel|s|n-octopus|b||
n-f-pulpo-de-roca-occidental|Pulpo de roca occidental|s|n-octopus|b||
n-f-pulpo-dormilon|Pulpo dormilón|s|n-octopus|b||
n-f-pulpo-gigante-africano|Pulpo gigante africano|s|n-octopus|b||
n-f-pulpo-gigante-del-pacifico|Pulpo gigante del Pacífico|s|n-octopus|b||
n-f-pulpo-kraken|Pulpo kraken|s|n-octopus|b||
n-f-pulpo-maya|Pulpo maya|s|n-octopus|b||
n-f-pulpo-membranoso|Pulpo membranoso|s|n-octopus|b||
n-f-pulpo-patudo|Pulpo patudo|s|n-octopus|b||
n-f-quelvacho|Quelvacho|t|n-whitefish|b||
n-f-quimera|Quimera|t|n-bluefish|b||
n-f-quimera-arpon|Quimera arpón|s|n-f-quimera|b||
n-f-quimera-elefante|Quimera elefante|s|n-f-quimera|b||
n-f-quimera-picuda|Quimera picuda|s|n-f-quimera|b||
n-f-quisquilla-de-pinzas|Quisquilla de pinzas|t|n-shellfish|b||
n-f-rabil|Rabil|t|n-bluefish|b||
n-f-rabirrubia|Rabirrubia|t|n-whitefish|b||
n-f-rabirrubia-canela|Rabirrubia canela|s|n-f-rabirrubia|b||
n-f-rape-africano|Rape africano|s|n-monkfish|b||
n-f-rape-americano|Rape americano|s|n-monkfish|b||
n-f-rape-blanco|Rape blanco|s|n-monkfish|b||
n-f-rape-de-nueva-zelanda|Rape de Nueva Zelanda|s|n-monkfish|b||
n-f-rape-del-cabo|Rape del Cabo|s|n-monkfish|b||
n-f-rape-del-pacifico|Rape del Pacífico|s|n-monkfish|b||
n-f-rape-negro|Rape negro|s|n-monkfish|b||
n-f-rape-oriental|Rape oriental|s|n-monkfish|b||
n-f-rapeta|Rapeta|t|n-whitefish|b||
n-f-rascacio|Rascacio|t|n-whitefish|b||
n-f-rascacio-de-altura|Rascacio de altura|s|n-f-rascacio|b||
n-f-rascacio-de-madeira|Rascacio de madeira|s|n-f-rascacio|b||
n-f-raspallon|Raspallón|t|n-whitefish|b||
n-f-raspallon-del-punto|Raspallón del punto|s|n-f-raspallon|b||
n-f-rasqueta|Rasqueta|t|n-whitefish|b||
n-f-raya|Raya|t|n-whitefish|b|t|
n-f-raya-aspera|Raya áspera|s|n-f-raya|b||
n-f-raya-boca-de-rosa|Raya boca de rosa|s|n-f-raya|b||
n-f-raya-bramante|Raya bramante|s|n-f-raya|b||
n-f-raya-cardadora|Raya cardadora|s|n-f-raya|b||
n-f-raya-de-clavos|Raya de clavos|s|n-f-raya|b||
n-f-raya-de-espejos|Raya de espejos|s|n-f-raya|b||
n-f-raya-de-los-canales|Raya de los canales|s|n-f-raya|b||
n-f-raya-de-madeira|Raya de madeira|s|n-f-raya|b||
n-f-raya-de-ojos|Raya de ojos|s|n-f-raya|b||
n-f-raya-de-puntos|Raya de puntos|s|n-f-raya|b||
n-f-raya-del-sur|Raya del sur|s|n-f-raya|b||
n-f-raya-dentada|Raya dentada|s|n-f-raya|b||
n-f-raya-estrellada|Raya estrellada|s|n-f-raya|b||
n-f-raya-falsa-vela|Raya falsa vela|s|n-f-raya|b||
n-f-raya-latigo|Raya látigo|s|n-f-raya|b||
n-f-raya-latigo-islena|Raya látigo isleña|s|n-f-raya|b||
n-f-raya-leopardo|Raya leopardo|s|n-f-raya|b||
n-f-raya-lisa|Raya lisa|s|n-f-raya|b||
n-f-raya-manchada|Raya manchada|s|n-f-raya|b||
n-f-raya-marmorada|Raya marmorada|s|n-f-raya|b||
n-f-raya-mosaico|Raya mosaico|s|n-f-raya|b||
n-f-raya-pintada|Raya pintada|s|n-f-raya|b||
n-f-raya-radiante|Raya radiante|s|n-f-raya|b||
n-f-raya-santiaguesa|Raya santiaguesa|s|n-f-raya|b||
n-f-raya-vela|Raya Vela|s|n-f-raya|b||
n-f-raya-volantin|Raya volantín|s|n-f-raya|b||
n-f-rejo|Rejo|t|n-whitefish|m|t|
n-f-reloj|Reloj|t|n-bivalve|b|t|
n-f-reloj-anaranjado|Reloj anaranjado|s|n-f-reloj|b||
n-f-reloj-de-fondo|Reloj de fondo|s|n-f-reloj|b||
n-f-reloj-mediterraneo|Reloj mediterráneo|s|n-f-reloj|b||
n-f-remol|Remol|t|n-whitefish|b||
n-f-remudo-blanco|Remudo blanco|t|n-whitefish|b||
n-f-reo|Reo|t|n-bluefish|b||
n-f-resto|Resto|t|n-whitefish|m|t|
n-f-robalito|Robalito|t|n-whitefish|b||
n-f-robalo-de-fondo|Róbalo de fondo|t|n-whitefish|b||
n-f-roble-marino|Roble marino|t|n-whitefish|b||
n-f-rodaballo|Rodaballo|t|n-farmed|b|t|
n-f-romerillo|Romerillo|t|n-whitefish|b||
n-f-romero|Romero|t|n-whitefish|b||
n-f-roncador|Roncador|t|n-whitefish|b||
n-f-ronco-blanco|Ronco blanco|t|n-whitefish|b||
n-f-ronco-moteado|Ronco moteado|t|n-whitefish|b||
n-f-rosada|Rosada|t|n-whitefish|b|t|
n-f-rosada-de-clark|Rosada de Clark|s|n-f-rosada|b||
n-f-rosada-del-cabo|Rosada del cabo|s|n-f-rosada|b||
n-f-rubio|Rubio|t|n-whitefish|b||
n-f-rubio-de-aleta-azul|Rubio de aleta azul|s|n-f-rubio|b||
n-f-rubio-del-cabo|Rubio del cabo|s|n-f-rubio|b||
n-f-rufo-africano|Rufo africano|t|n-whitefish|b||
n-f-rufo-derivante|Rufo derivante|t|n-whitefish|b||
n-f-rufo-imperial|Rufo imperial|t|n-whitefish|b||
n-f-sabalo|Sábalo|t|n-bluefish|b||
n-f-sabalo-atlantico|Sábalo atlántico|s|n-f-sabalo|b||
n-f-sabalote|Sabalote|t|n-whitefish|b||
n-f-sable|Sable|t|n-bluefish|m|t|
n-f-sable-alargado|Sable alargado|t|n-bluefish|b||
n-f-sable-negro|Sable negro|t|n-bluefish|b||
n-f-salazon|Salazon|t|n-whitefish|m|t|
n-f-salema|Salema|t|n-whitefish|b|t|
n-f-salmon|Salmón|t|n-bluefish|b|t|
n-f-salmon-atlantico|Salmón atlántico|s|n-f-salmon|b||
n-f-salmonete|Salmonete|t|n-whitefish|m|t|
n-f-salmonete-africano|Salmonete africano|t|n-whitefish|b||
n-f-salmonete-cinabrio|Salmonete cinabrio|t|n-whitefish|b||
n-f-salmonete-de-fango|Salmonete de fango|t|n-whitefish|b|t|
n-f-salmonete-de-roca|Salmonete de roca|t|n-whitefish|b|t|
n-f-salmonete-real|Salmonete real|t|n-whitefish|b||
n-f-salton|Saltón|t|n-whitefish|b||
n-f-salvariego|Salvariego|t|n-whitefish|b||
n-f-salvelino|Salvelino|t|n-bluefish|b||
n-f-sama|Sama|t|n-whitefish|b||
n-f-sama-de-pluma|Sama de pluma|s|n-f-sama|b||
n-f-san-pedro|San pedro|t|n-whitefish|m|t|
n-f-san-pedro-del-cabo|San Pedro del Cabo|t|n-whitefish|b||
n-f-santiaguino|Santiaguiño|t|n-shellfish|b||
n-f-sapata-negra|Sapata negra|t|n-whitefish|b||
n-f-sardina|Sardina|t|n-bluefish|b|t|
n-f-sardinela-aceitera|Sardinela aceitera|t|n-bluefish|b||
n-f-sardineta-del-pacifico|Sardineta del Pacífico|t|n-bluefish|b||
n-f-sargazo-comun|Sargazo común|t|n-seaweed|b||
n-f-sargo|Sargo|t|n-whitefish|b|t|
n-f-sargo-atlantico|Sargo Atlántico|s|n-f-sargo|b||
n-f-sargo-breado|Sargo breado|s|n-f-sargo|b||
n-f-sargo-panga|Sargo Panga|s|n-f-sargo|b||
n-f-sargo-picudo|Sargo picudo|s|n-f-sargo|b||
n-f-sastre-amarillo|Sastre amarillo|t|n-whitefish|b||
n-f-sastre-rojo|Sastre rojo|t|n-whitefish|b||
n-f-seba|Seba|t|n-whitefish|b||
n-f-sepia|Sepia|t|n-cephalopod|b||
n-f-sepia-del-pacifico|Sepia del Pacífico|s|n-f-sepia|b||
n-f-sepia-faraonica|Sepia faraónica|s|n-f-sepia|b||
n-f-sepia-ganchuda|Sepia ganchuda|s|n-f-sepia|b||
n-f-sepia-labiada|Sepia labiada|s|n-f-sepia|b||
n-f-sepia-oriental|Sepia oriental|s|n-f-sepia|b||
n-f-serrandell|Serrandell|t|n-whitefish|b||
n-f-serrano|Serrano|t|n-whitefish|b||
n-f-serrano-imperial|Serrano imperial|s|n-f-serrano|b||
n-f-sierra-americano|Sierra americano|t|n-whitefish|b||
n-f-sillago-plateado|Sillago plateado|t|n-whitefish|b||
n-f-siluro|Siluro|t|n-whitefish|b||
n-f-soldado|Soldado|t|n-whitefish|b||
n-f-solla|Solla|t|n-whitefish|b|t|
n-f-solla-del-pacifico|Solla del Pacífico|s|n-f-solla|b||
n-f-solleta|Solleta|t|n-whitefish|b||
n-f-solrayo|Solrayo|t|n-whitefish|b||
n-f-sonso|Sonso|t|n-whitefish|b|t|
n-f-surimi|Surimi|t|n-whitefish|m|t|
n-f-tabernero|Tabernero|t|n-whitefish|b||
n-f-talisman|Talismán|t|n-whitefish|b||
n-f-tambor|Tambor|t|n-whitefish|b||
n-f-tambor-real|Tambor real|s|n-f-tambor|b||
n-f-tanaka|Tanaka|t|n-whitefish|b||
n-f-tarpon|Tarpón|t|n-whitefish|b||
n-f-tasarte|Tasarte|t|n-bluefish|b||
n-f-tellerina|Tellerina|t|n-bivalve|b||
n-f-tellina-austral|Tellina austral|t|n-bivalve|b||
n-f-tellina-del-pacifico|Tellina del Pacífico|t|n-bivalve|b||
n-f-tellina-tuatua|Tellina Tuatua|t|n-bivalve|b||
n-f-tembladera|Tembladera|t|n-whitefish|b||
n-f-tembladera-de-lunares|Tembladera de lunares|s|n-f-tembladera|b||
n-f-tenca|Tenca|t|n-whitefish|b||
n-f-tiburon-arenero|Tiburón arenero|t|n-bluefish|b||
n-f-tiburon-baboso|Tiburón baboso|t|n-bluefish|b||
n-f-tiburon-boreal|Tiburón boreal|t|n-bluefish|b||
n-f-tiburon-cobrizo|Tiburón cobrizo|t|n-bluefish|b||
n-f-tiburon-cocodrilo|Tiburón cocodrilo|t|n-bluefish|b||
n-f-tiburon-de-galapagos|Tiburón de galápagos|t|n-bluefish|b||
n-f-tiburon-de-puntos-negros|Tiburón de puntos negros|t|n-bluefish|b||
n-f-tiburon-lagarto|Tiburón lagarto|t|n-bluefish|b||
n-f-tiburon-trozo|Tiburón trozo|t|n-bluefish|b||
n-f-tilapia|Tilapia|t|n-whitefish|b|t|
n-f-tilapia-de-mozambique|Tilapia de Mozambique|s|n-f-tilapia|b||
n-f-tinto|Tinto|t|n-whitefish|b||
n-f-tintorera|Tintorera|t|n-bluefish|b|t|
n-f-tollo-flecha|Tollo flecha|t|n-whitefish|b||
n-f-tollo-lucero|Tollo lucero|t|n-whitefish|b||
n-f-tollo-lucero-liso|Tollo lucero liso|t|n-whitefish|b||
n-f-tollo-lucero-raspa|Tollo lucero raspa|t|n-whitefish|b||
n-f-tollo-negro|Tollo negro|t|n-whitefish|b||
n-f-tollo-pajarito|Tollo pajarito|t|n-whitefish|b||
n-f-tomas|Tomás|t|n-whitefish|b||
n-f-tordo-de-fondo|Tordo de fondo|t|n-whitefish|b||
n-f-tordo-negro|Tordo negro|t|n-whitefish|b||
n-f-tordo-verde|Tordo verde|t|n-whitefish|b||
n-f-torillo|Torillo|t|n-whitefish|b||
n-f-toro-bacota|Toro bacota|t|n-whitefish|b||
n-f-trompetero|Trompetero|t|n-whitefish|b||
n-f-trucha|Trucha|t|n-bluefish|m|t|
n-f-trucha-alpina|Trucha alpina|t|n-bluefish|b||
n-f-trucha-arco-iris|Trucha arco iris|t|n-bluefish|b||
n-f-trucha-lacustre|Trucha lacustre|t|n-bluefish|b||
n-f-urta|Urta|t|n-whitefish|b||
n-f-uva-de-mar|Uva de mar|t|n-whitefish|b||
n-f-uva-marina|Uva marina|t|n-whitefish|b||
n-f-verrugato|Verrugato|t|n-whitefish|b||
n-f-verrugato-de-fango|Verrugato de fango|s|n-f-verrugato|b||
n-f-verrugato-fusco|Verrugato fusco|s|n-f-verrugato|b||
n-f-vibora|Víbora|t|n-whitefish|b||
n-f-vieira|Vieira|t|n-bivalve|b|t|
n-f-vieira-amerindia|Vieira amerindia|s|n-f-vieira|b||
n-f-vieira-del-atlantico|Vieira del Atlántico|s|n-f-vieira|b||
n-f-vieira-del-pacifico|Vieira del Pacífico|s|n-f-vieira|b||
n-f-vieira-japonesa|Vieira japonesa|s|n-f-vieira|b||
n-f-vieira-patagonica|Vieira patagónica|s|n-f-vieira|b||
n-f-vieira-platillo|Vieira platillo|s|n-f-vieira|b||
n-f-vieja|Vieja|t|n-whitefish|m|t|
n-f-vieja-colorada|Vieja colorada|t|n-whitefish|b||
n-f-vieja-lomonegro|Vieja lomonegro|t|n-whitefish|b||
n-f-vimba|Vimba|t|n-whitefish|b||
n-f-volador|Volador|t|n-cephalopod|b||
n-f-volandeira|Volandeira|t|n-bivalve|b||
n-f-xinxa|Xinxa|t|n-shellfish|b||
n-f-zamburina|Zamburiña|t|n-bivalve|b||
n-f-zamburina-nordica|Zamburiña nórdica|s|n-f-zamburina|b||
n-flour|Pasta y harinas|f||a||
n-frankfurt|Salchicha cocida|t|n-cooked|a||
n-fuet|Fuet|t|n-sausage|a||
n-g-avestruz|Avestruz|t|n-game|a|t|elaborado,sin elaborar
n-g-ciervo|Ciervo|t|n-game|a|t|elaborado,sin elaborar
n-g-conejo|Conejo entero|t|n-rabbit|a||
n-g-conejo-troceado|Conejo troceado|t|n-rabbit|a||
n-g-equino|Equino|t|n-game|a|t|elaborado,sin elaborar
n-g-jabali|Jabalí|t|n-game|a||elaborado,sin elaborar
n-g-lomo-de-conejo|Lomo de conejo|t|n-rabbit|a||
n-g-paletilla-de-conejo|Paletilla de conejo|t|n-rabbit|a||
n-galantina|Galantina|t|n-cooked|a||
n-game|Caza y otras carnes|c|n-meat|a||
n-gpc-abate-fetel-abbe-fetel|Abate fetel (abbe fetel)|s|n-v-pera|g||
n-gpc-abejas-avispas-y-hormigas|Abejas, avispas y hormigas|t|n-gpc-insectos-comestibles|g||elaborado,sin elaborar
n-gpc-abugo-o-siete-en-boca|Abugo o siete en boca|s|n-v-pera|g||
n-gpc-acai|Açaí|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-acedera|Acedera|t|n-vegetable|g||
n-gpc-aceite-vegetal|Aceite vegetal|t|n-gpc-aceites-comestibles|g||ambiente,refrigerado
n-gpc-aceites-comestibles|Aceites comestibles|c|n-oils|g||
n-gpc-acolon|Acolon|s|n-gpc-vino-espumoso|g||
n-gpc-adam-s-pearmain|Adam's pearmain|s|n-v-manzana|g||
n-gpc-aditivo-alimentario|Aditivo alimentario|t|n-gpc-hierbas-especias-y-extractos|g||
n-gpc-admiral|Admiral|s|n-v-manzana|g||
n-gpc-african-red|African red|s|n-v-manzana|g||
n-gpc-aglianico|Aglianico|s|n-gpc-vino-espumoso|g||
n-gpc-agretti|Agretti|t|n-gpc-verduras-marinas|g||
n-gpc-agua-con-sabor|Agua con sabor|t|n-gpc-bebidas-sin-alcohol|g||
n-gpc-agua-envasada|Agua envasada|t|n-gpc-bebidas-sin-alcohol|g||
n-gpc-aguacate-cocktail|Aguacate cocktail|t|n-avocado|g||
n-gpc-aguacate-de-piel-lisa|Aguacate de piel lisa|t|n-avocado|g||
n-gpc-aguaturma|Aguaturma|t|n-root|g||
n-gpc-aguja-bola-de-espaldilla|Aguja, bola de espaldilla|s|n-beef|g||
n-gpc-aguja-con-espaldilla-y-hueso|Aguja con espaldilla y hueso|s|n-beef|g||
n-gpc-aguja-cortada-a-escuadra-4-costill|Aguja cortada a escuadra, 4 costillas|s|n-beef|g||
n-gpc-aguja-cortada-a-escuadra-5-costill|Aguja cortada a escuadra, 5 costillas|s|n-beef|g||
n-gpc-aguja-cortada-a-escuadra-6-costill|Aguja cortada a escuadra, 6 costillas|s|n-beef|g||
n-gpc-aguja-cresta|Aguja, cresta|s|n-beef|g||
n-gpc-aguja-deshuesada|Aguja deshuesada|s|n-beef|g||
n-gpc-aguja-deshuesada-4-costillas|Aguja deshuesada, 4 costillas|s|n-beef|g||
n-gpc-aguja-deshuesada-5-costillas|Aguja deshuesada, 5 costillas|s|n-beef|g||
n-gpc-aguja-deshuesada-6-costillas|Aguja deshuesada, 6 costillas|s|n-beef|g||
n-gpc-aguja-deshuesada-de-corte-largo|Aguja deshuesada de corte largo|s|n-beef|g||
n-gpc-aguja-espaldilla-entera|Aguja, espaldilla entera|s|n-beef|g||
n-gpc-aguja-falso-solomillo|Aguja, falso solomillo|s|n-beef|g||
n-gpc-aguja-llana|Aguja, llana|s|n-beef|g||
n-gpc-aguja-pez|Aguja, pez|s|n-beef|g||
n-gpc-ahra|Ahra|s|n-v-manzana|g||
n-gpc-ahrista|Ahrista|s|n-v-manzana|g||
n-gpc-airen|Airén|s|n-gpc-vino-espumoso|g||
n-gpc-airen-pinot-gris|Airen/pinot gris|s|n-gpc-vino-espumoso|g||
n-gpc-ajedrea-de-jardin|Ajedrea de jardín|t|n-gpc-hierbas-frescas|g||
n-gpc-ajedrea-de-monte|Ajedrea de monte|t|n-gpc-hierbas-frescas|g||
n-gpc-ajo-de-oso|Ajo de oso|t|n-gpc-hierbas-frescas|g||
n-gpc-ajo-elefante|Ajo elefante|t|n-gpc-hortalizas-de-bulbo|g||
n-gpc-akane-prime-red|Akane (prime red)|s|n-v-manzana|g||
n-gpc-akca|Akca|s|n-v-pera|g||
n-gpc-akero|Akero|s|n-v-manzana|g||
n-gpc-ala-de-pollo-de-dos-articulaciones|Ala de pollo de dos articulaciones|s|n-chicken|g||
n-gpc-ala-de-pollo-en-v-primer-y-segundo|Ala de pollo en V, primer y segundo segmento|s|n-chicken|g||
n-gpc-ala-entera-de-pavo|Ala entera de pavo|s|n-turkey|g||
n-gpc-ala-entera-de-pollo|Ala entera de pollo|s|n-chicken|g||
n-gpc-ala-plana-de-pollo-segundo-segment|Ala plana de pollo, segundo segmento|s|n-chicken|g||
n-gpc-alas-de-pavo-de-primer-y-segundo-s|Alas de pavo de primer y segundo segmento|s|n-turkey|g||
n-gpc-alas-de-pollo-con-espalda|Alas de pollo con espalda|s|n-chicken|g||
n-gpc-alas-de-pollo-de-primer-y-segundo-|Alas de pollo de primer y segundo segmento|s|n-chicken|g||
n-gpc-albahaca|Albahaca|t|n-gpc-hierbas-frescas|g||
n-gpc-albana|Albana|s|n-gpc-vino-espumoso|g||
n-gpc-albarino|Albariño|s|n-gpc-vino-espumoso|g||
n-gpc-albarola|Albarola|s|n-gpc-vino-espumoso|g||
n-gpc-albarola-vermentino|Albarola/vermentino|s|n-gpc-vino-espumoso|g||
n-gpc-albillo|Albillo|s|n-gpc-vino-espumoso|g||
n-gpc-alborz-seedling|Alborz seedling|s|n-v-manzana|g||
n-gpc-alcaravea|Alcaravea|t|n-gpc-hierbas-frescas|g||
n-gpc-alce|Alce|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-aldas|Aldas|s|n-v-manzana|g||
n-gpc-aleatico|Aleatico|s|n-gpc-vino-espumoso|g||
n-gpc-aleksandruli|Aleksandruli|s|n-gpc-vino-espumoso|g||
n-gpc-alexandrine-douillard|Alexandrine douillard|s|n-v-pera|g||
n-gpc-alfrocheiro|Alfrocheiro|s|n-gpc-vino-espumoso|g||
n-gpc-alfrocheiro-alicante-bouschet-tann|Alfrocheiro/alicante bouschet/tannat/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-alfrocheiro-touriga-nacional-syrah|Alfrocheiro/touriga nacional/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-algarroba|Algarroba|t|n-gpc-otras-verduras|g||
n-gpc-alibernet|Alibernet|s|n-gpc-vino-espumoso|g||
n-gpc-alicante|Alicante|s|n-gpc-vino-espumoso|g||
n-gpc-alicante-bouschet|Alicante bouschet|s|n-gpc-vino-espumoso|g||
n-gpc-alicante-bouschet-touriga-nacional|Alicante bouschet/touriga nacional/tempranillo|s|n-gpc-vino-espumoso|g||
n-gpc-alice|Alice|s|n-v-manzana|g||
n-gpc-alimentacion-infantil|Alimentación infantil|t|n-gpc-alimentacion-y-bebidas-infantiles|g||ambiente,congelado
n-gpc-alimentacion-y-bebidas-infantiles|Alimentación y bebidas infantiles|c|n-grocery|g||
n-gpc-alinos-y-salsas-para-mojar|Aliños y salsas para mojar|t|n-gpc-salsas-untables-y-condimentos|g||ambiente,congelado,refrigerado
n-gpc-alka|Alka|s|n-v-pera|g||
n-gpc-alkmene|Alkmene|s|n-v-manzana|g||
n-gpc-alkmene-spur-linus|Alkmene spur linus|s|n-v-manzana|g||
n-gpc-aloe-vera|Aloe vera|t|n-gpc-plantas-crasas-comestibles|g||
n-gpc-alro|Alro|s|n-v-manzana|g||
n-gpc-alsa|Alsa|s|n-v-pera|g||
n-gpc-altesse|Altesse|s|n-gpc-vino-espumoso|g||
n-gpc-alvarelhao|Alvarelhao|s|n-gpc-vino-espumoso|g||
n-gpc-alvarinho|Alvarinho|s|n-gpc-vino-espumoso|g||
n-gpc-alvarinho-arinto-fernao-pires-sauv|Alvarinho/arinto/fernao pires/sauvignon blanc/verdelho|s|n-gpc-vino-espumoso|g||
n-gpc-alwa|Alwa|s|n-v-manzana|g||
n-gpc-amaral|Amaral|s|n-gpc-vino-espumoso|g||
n-gpc-amaranto-chino|Amaranto chino|t|n-vegetable|g||
n-gpc-amasya|Amasya|s|n-v-manzana|g||
n-gpc-ambrosia|Ambrosia|s|n-v-manzana|g||
n-gpc-ametyst|Ametyst|s|n-v-manzana|g||
n-gpc-amfora|Amfora|s|n-v-pera|g||
n-gpc-amorosa|Amorosa|s|n-v-manzana|g||
n-gpc-ananas-reinette|Ananas reinette|s|n-v-manzana|g||
n-gpc-ancellotta|Ancellotta|s|n-gpc-vino-espumoso|g||
n-gpc-angelica|Angélica|t|n-gpc-hierbas-frescas|g||
n-gpc-angold|Angold|s|n-v-manzana|g||
n-gpc-anis|Anís|t|n-gpc-hierbas-frescas|g||
n-gpc-anna|Anna|s|n-v-pera|g||
n-gpc-annabelle|Annabelle|s|n-v-manzana|g||
n-gpc-annaglo|Annaglo|s|n-v-manzana|g||
n-gpc-anona|Anona|t|n-gpc-anonaceas|g||
n-gpc-anona-corazon|Anona corazón|t|n-gpc-anonaceas|g||
n-gpc-anonaceas|Anonáceas|c|n-produce|g||cortado
n-gpc-antao-vaz|Antao vaz|s|n-gpc-vino-espumoso|g||
n-gpc-antao-vaz-arinto-alvarinho|Antao vaz/arinto/alvarinho|s|n-gpc-vino-espumoso|g||
n-gpc-antej|Antej|s|n-v-manzana|g||
n-gpc-antilope|Antílope|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-aperitivo-inflado|Aperitivo inflado|t|n-d-aperitivo|g||
n-gpc-apollo|Apollo|s|n-v-manzana|g||
n-gpc-arandano-rojo|Arándano rojo|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-arandano-rojo-silvestre|Arándano rojo silvestre|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-arandano-silvestre|Arándano silvestre|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-arany-sarfeher|Arany sarfeher|s|n-gpc-vino-espumoso|g||
n-gpc-arbanne-arbane|Arbanne (arbane)|s|n-gpc-vino-espumoso|g||
n-gpc-areni|Areni|s|n-gpc-vino-espumoso|g||
n-gpc-ariane|Ariane|s|n-v-manzana|g||
n-gpc-arinarnoa|Arinarnoa|s|n-gpc-vino-espumoso|g||
n-gpc-arinto|Arinto|s|n-gpc-vino-espumoso|g||
n-gpc-ariwa|Ariwa|s|n-v-manzana|g||
n-gpc-arkcharm|Arkcharm|s|n-v-manzana|g||
n-gpc-arlet-swiss-gourmet|Arlet/swiss gourmet|s|n-v-manzana|g||
n-gpc-arneis|Arneis|s|n-gpc-vino-espumoso|g||
n-gpc-aroma|Aroma|s|n-v-manzana|g||
n-gpc-arracacha|Arracacha|t|n-root|g||
n-gpc-arrufiac|Arrufiac|s|n-gpc-vino-espumoso|g||
n-gpc-arrurruz|Arrurruz|t|n-root|g||
n-gpc-artaban|Artaban|s|n-gpc-vino-espumoso|g||
n-gpc-artemisa|Artemisa|t|n-gpc-hierbas-frescas|g||
n-gpc-arthur-turner|Arthur turner|s|n-v-manzana|g||
n-gpc-asfari|Asfari|s|n-v-manzana|g||
n-gpc-ashmead-s-kernel|Ashmead's kernel|s|n-v-manzana|g||
n-gpc-assyrtiko|Assyrtiko|s|n-gpc-vino-espumoso|g||
n-gpc-auksis|Auksis|s|n-v-manzana|g||
n-gpc-aurora|Aurora|s|n-v-manzana|g||
n-gpc-auxerrois|Auxerrois|s|n-gpc-vino-espumoso|g||
n-gpc-avesso|Avesso|s|n-gpc-vino-espumoso|g||
n-gpc-avezaath-kapel|Avezaath kapel|s|n-v-pera|g||
n-gpc-aw-164|Aw 164|s|n-v-manzana|g||
n-gpc-azahar|Azahar|t|n-gpc-guarnicion-fresca|g||
n-gpc-azal|Azal|s|n-gpc-vino-espumoso|g||
n-gpc-azal-pederna-trajadura-avesso-lour|Azal/pederna/trajadura/avesso/loureiro|s|n-gpc-vino-espumoso|g||
n-gpc-aztec|Aztec|s|n-v-manzana|g||
n-gpc-azucares-y-edulcorantes|Azúcares y edulcorantes|c|n-grocery|g||
n-gpc-azufu|Azufu|s|n-v-manzana|g||
n-gpc-babaco|Babaco|t|n-gpc-papaya|g||
n-gpc-babeasca-neagra|Babeasca neagra|s|n-gpc-vino-espumoso|g||
n-gpc-babilla-con-tapilla|Babilla con tapilla|s|n-beef|g||
n-gpc-babilla-con-tapilla-de-cabrito|Babilla con tapilla de cabrito|s|n-gpc-cabra|g||
n-gpc-babilla-de-cabrito|Babilla de cabrito|s|n-gpc-cabra|g||
n-gpc-babilla-de-vacuno|Babilla de vacuno|s|n-beef|g||
n-gpc-bacchus|Bacchus|s|n-gpc-vino-espumoso|g||
n-gpc-baco-noir|Baco noir|s|n-gpc-vino-espumoso|g||
n-gpc-badea|Badea|t|n-fruit|g||
n-gpc-baga|Baga|s|n-gpc-vino-espumoso|g||
n-gpc-baigent|Baigent|s|n-v-manzana|g||
n-gpc-baldwin|Baldwin|s|n-v-manzana|g||
n-gpc-baratuciat|Baratuciat|s|n-gpc-vino-espumoso|g||
n-gpc-barbera|Barbera|s|n-gpc-vino-espumoso|g||
n-gpc-barbera-dolcetto|Barbera/dolcetto|s|n-gpc-vino-espumoso|g||
n-gpc-bardana|Bardana|t|n-root|g||
n-gpc-bardolino|Bardolino|s|n-gpc-vino-espumoso|g||
n-gpc-barrita-de-cereales|Barrita de cereales|t|n-gpc-cereales-elaborados|g||
n-gpc-barrita-de-proteinas|Barrita de proteínas|t|n-gpc-cereales-elaborados|g||
n-gpc-bastardo|Bastardo|s|n-gpc-vino-espumoso|g||
n-gpc-baujade|Baujade|s|n-v-manzana|g||
n-gpc-baumann-s-reinette|Baumann's reinette|s|n-v-manzana|g||
n-gpc-bay-3484|Bay 3484|s|n-v-manzana|g||
n-gpc-baya-de-boysen|Baya de Boysen|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-baya-de-goji|Baya de goji|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-baya-de-logan|Baya de Logan|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-baya-de-saskatoon|Baya de Saskatoon|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-beacon|Beacon|s|n-v-manzana|g||
n-gpc-beauty-of-bath|Beauty of bath|s|n-v-manzana|g||
n-gpc-beauvillon|Beauvillon|s|n-gpc-vino-espumoso|g||
n-gpc-bebida-de-manzana|Bebida de manzana|t|n-gpc-bebidas-alcoholicas|g||sin alcohol
n-gpc-bebida-de-manzana-espumosa|Bebida de manzana espumosa|t|n-gpc-bebidas-alcoholicas|g||sin alcohol
n-gpc-bebida-de-zumo-de-fruta|Bebida de zumo de fruta|t|n-gpc-bebidas-sin-alcohol|g||ambiente,concentrado,listo para consumir,refrigerado
n-gpc-bebida-de-zumo-de-verdura|Bebida de zumo de verdura|t|n-gpc-bebidas-sin-alcohol|g||ambiente,concentrado,listo para consumir,refrigerado
n-gpc-bebida-energetica|Bebida energética|t|n-gpc-bebidas-sin-alcohol|g||concentrado,listo para consumir
n-gpc-bebida-infantil|Bebida infantil|t|n-gpc-alimentacion-y-bebidas-infantiles|g||ambiente
n-gpc-bebida-isotonica|Bebida isotónica|t|n-gpc-bebidas-sin-alcohol|g||
n-gpc-bebida-lactea|Bebida láctea|t|n-gpc-bebidas-sin-alcohol|g||ambiente,concentrado,listo para consumir,refrigerado
n-gpc-bebida-vegetal|Bebida vegetal|t|n-gpc-bebidas-sin-alcohol|g||ambiente,concentrado,congelado,listo para consumir,refrigerado
n-gpc-bebidas-alcoholicas|Bebidas alcohólicas|c|n-drinks|g||
n-gpc-bebidas-sin-alcohol|Bebidas sin alcohol|c|n-drinks|g||
n-gpc-beefalo|Beefalo|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-bel-el|Bel-el|s|n-v-manzana|g||
n-gpc-belfort|Belfort|s|n-v-manzana|g||
n-gpc-belgica|Belgica|s|n-v-manzana|g||
n-gpc-belle-de-boskoop|Belle de Boskoop|s|n-v-manzana|g||
n-gpc-belle-fleur-de-france|Belle-fleur de france|s|n-v-manzana|g||
n-gpc-belle-fleur-larche-mouche|Belle-fleur larche mouche|s|n-v-manzana|g||
n-gpc-belle-lucrative|Belle lucrative|s|n-v-pera|g||
n-gpc-bellida|Bellida|s|n-v-manzana|g||
n-gpc-belorrusskoje-malinovoje|Belorrusskoje malinovoje|s|n-v-manzana|g||
n-gpc-benoni|Benoni|s|n-v-manzana|g||
n-gpc-berenjena-antroewa|Berenjena antroewa|t|n-gpc-solanaceas-y-otras|g||
n-gpc-bergamot-d-esperen|Bergamot d'esperen|s|n-v-pera|g||
n-gpc-berlepsch|Berlepsch|s|n-v-manzana|g||
n-gpc-berlepsch-rouge|Berlepsch rouge|s|n-v-manzana|g||
n-gpc-berner-rosenapfel-rosana|Berner rosenapfel (rosana)|s|n-v-manzana|g||
n-gpc-bertanne|Bertanne|s|n-v-manzana|g||
n-gpc-beurre-alexandre-lucas|Beurre alexandre lucas|s|n-v-pera|g||
n-gpc-beurre-bosc-kaiser-alexander|Beurre bosc (kaiser alexander)|s|n-v-pera|g||
n-gpc-beurre-clairgeau|Beurre clairgeau|s|n-v-pera|g||
n-gpc-beurre-d-anjou|Beurre d'anjou|s|n-v-pera|g||
n-gpc-beurre-diel|Beurre diel|s|n-v-pera|g||
n-gpc-beurre-giffard|Beurré giffard|s|n-v-pera|g||
n-gpc-beurre-hardenpont|Beurre hardenpont|s|n-v-pera|g||
n-gpc-beurre-hardy|Beurre hardy|s|n-v-pera|g||
n-gpc-beurre-lebrun|Beurre lebrun|s|n-v-pera|g||
n-gpc-beurre-precoce-morettini|Beurré précoce morettini|s|n-v-pera|g||
n-gpc-beurre-superfin|Beurre superfin|s|n-v-pera|g||
n-gpc-bianchetta-biancetta|Bianchetta (biancetta)|s|n-gpc-vino-espumoso|g||
n-gpc-biancolella|Biancolella|s|n-gpc-vino-espumoso|g||
n-gpc-biancolella-chardonnay-coda-di-vol|Biancolella/chardonnay/coda di volpe|s|n-gpc-vino-espumoso|g||
n-gpc-biborkadarka|Biborkadarka|s|n-gpc-vino-espumoso|g||
n-gpc-bical|Bical|s|n-gpc-vino-espumoso|g||
n-gpc-bielaar|Bielaar|s|n-v-manzana|g||
n-gpc-biesterfelder-renette|Biesterfelder renette|s|n-v-manzana|g||
n-gpc-bietigheimer|Bietigheimer|s|n-v-manzana|g||
n-gpc-bilimbi|Bilimbi|t|n-gpc-otras-frutas|g||
n-gpc-bimi|Bimi|t|n-gpc-coles-y-brasicas|g||
n-gpc-bisonte|Bisonte|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-biter-y-siropes-alcoholicos|Bíter y siropes alcohólicos|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-black-queen|Black queen|s|n-gpc-vino-espumoso|g||
n-gpc-blanc-vrai|Blanc vrai|s|n-gpc-vino-espumoso|g||
n-gpc-blanca-de-aranjuez|Blanca de aranjuez|s|n-v-pera|g||
n-gpc-blanco-colli-piacentini|Blanco colli piacentini|s|n-gpc-vino-espumoso|g||
n-gpc-blanco-di-trevigiano|Blanco di trevigiano|s|n-gpc-vino-espumoso|g||
n-gpc-blauburger|Blauburger|s|n-gpc-vino-espumoso|g||
n-gpc-blauer-portugieser-modry-portugal|Blauer portugieser (modry portugal)|s|n-gpc-vino-espumoso|g||
n-gpc-blaufraenkisch-gamaret|Blaufraenkisch/gamaret|s|n-gpc-vino-espumoso|g||
n-gpc-blaufraenkisch-gamaret-cabernet-do|Blaufraenkisch/gamaret/cabernet dorsa|s|n-gpc-vino-espumoso|g||
n-gpc-blaufraenkisch-gamaret-pinot-noir|Blaufraenkisch/gamaret/pinot noir|s|n-gpc-vino-espumoso|g||
n-gpc-blaufraenkisch-lemberger-blauer-li|Blaufraenkisch (lemberger/blauer limberger)|s|n-gpc-vino-espumoso|g||
n-gpc-blaufraenkisch-merlot-cabernet-sau|Blaufraenkisch/merlot/cabernet sauvignon/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-blaufraenkisch-merlot-cabernet-sau-2|Blaufraenkisch/merlot/cabernet sauvignon/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-blend|Blend|s|n-gpc-vino-espumoso|g||
n-gpc-blenheim-orange|Blenheim orange|s|n-v-manzana|g||
n-gpc-bloedpeer|Bloedpeer|s|n-v-pera|g||
n-gpc-bloemeezoet|Bloemeezoet|s|n-v-manzana|g||
n-gpc-blushed-golden|Blushed golden|s|n-v-manzana|g||
n-gpc-bobal|Bobal|s|n-gpc-vino-espumoso|g||
n-gpc-bocadillos-y-wraps|Bocadillos y wraps|c|n-grocery|g||congelado,refrigerado
n-gpc-bogatir|Bogatir|s|n-v-manzana|g||
n-gpc-bogazkere|Bogazkere|s|n-gpc-vino-espumoso|g||
n-gpc-bohemia|Bohemia|s|n-v-manzana|g||
n-gpc-bohnapfel|Bohnapfel|s|n-v-manzana|g||
n-gpc-boiken|Boiken|s|n-v-manzana|g||
n-gpc-boletus|Boletus|t|n-gpc-setas-y-hongos|g||
n-gpc-bolleria-dulce|Bollería dulce|c|n-bakery|g||
n-gpc-bolleria-salada|Bollería salada|c|n-bakery|g||
n-gpc-bombino|Bombino|s|n-gpc-vino-espumoso|g||
n-gpc-bonarda|Bonarda|s|n-gpc-vino-espumoso|g||
n-gpc-bonne-louise-d-avranches|Bonne louise d'avranches|s|n-v-pera|g||
n-gpc-boskoop-quast|Boskoop quast|s|n-v-manzana|g||
n-gpc-botrytis-riesling|Botrytis riesling|s|n-gpc-vino-espumoso|g||
n-gpc-botrytis-semillon|Botrytis semillon|s|n-gpc-vino-espumoso|g||
n-gpc-botrytis-semillon-sauvignon-blanc|Botrytis semillon/sauvignon blanc|s|n-gpc-vino-espumoso|g||
n-gpc-bountiful|Bountiful|s|n-v-manzana|g||
n-gpc-bourboulenc|Bourboulenc|s|n-gpc-vino-espumoso|g||
n-gpc-bovale|Bovale|s|n-gpc-vino-espumoso|g||
n-gpc-brabant-bellefleur|Brabant bellefleur|s|n-v-manzana|g||
n-gpc-brachetto|Brachetto|s|n-gpc-vino-espumoso|g||
n-gpc-braeburn|Braeburn|s|n-v-manzana|g||
n-gpc-braeburn-superstar|Braeburn superstar|s|n-v-manzana|g||
n-gpc-brak|Brak|s|n-v-manzana|g||
n-gpc-bramley-s-seedling-triomphe-de-kie|Bramley's seedling (triomphe de kiel)|s|n-v-manzana|g||
n-gpc-brancellao|Brancellao|s|n-gpc-vino-espumoso|g||
n-gpc-brava-early-brae|Brava (early brae)|s|n-v-manzana|g||
n-gpc-brazuelo-de-cabrito|Brazuelo de cabrito|s|n-gpc-cabra|g||
n-gpc-brazuelo-de-cordero|Brazuelo de cordero|s|n-gpc-cordero|g||
n-gpc-brazuelo-de-vacuno|Brazuelo de vacuno|s|n-beef|g||
n-gpc-brazuelo-de-vacuno-deshuesado|Brazuelo de vacuno deshuesado|s|n-beef|g||
n-gpc-brettacher-gewuerzapfel-saemling|Brettacher gewuerzapfel (saemling)|s|n-v-manzana|g||
n-gpc-briosello|Briosello|s|n-gpc-vino-espumoso|g||
n-gpc-brote|Brote|t|n-v-microvegetal|g||
n-gpc-brote-de-bambu|Brote de bambú|t|n-gpc-hortalizas-de-tallo|g||
n-gpc-bruggers-festivale|Bruggers festivale|s|n-v-manzana|g||
n-gpc-brunello|Brunello|s|n-gpc-vino-espumoso|g||
n-gpc-brunello-montalcino|Brunello montalcino|s|n-gpc-vino-espumoso|g||
n-gpc-bufalo-de-agua|Búfalo de agua|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-busuioaca-de-bohotin|Busuioaca de bohotin|s|n-gpc-vino-espumoso|g||
n-gpc-butt|Butt|s|n-beef|g|p|
n-gpc-butt-and-rump|Butt and rump|s|n-beef|g|p|
n-gpc-butt-shank-off|Butt shank off|s|n-beef|g|p|
n-gpc-butt-square-cut|Butt square cut|s|n-beef|g|p|
n-gpc-cabecera-de-lomo-limpieza-especial|Cabecera de lomo, limpieza especial|s|n-pork|g||
n-gpc-cabernet-blanc|Cabernet blanc|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-cortis|Cabernet cortis|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-dorsa|Cabernet dorsa|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-franc|Cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-franc-cabernet-sauvignon-|Cabernet franc/cabernet sauvignon/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-franc-cabernet-sauvignon--2|Cabernet franc/cabernet sauvignon/merlot/petit verdot/malbec|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-franc-merlot|Cabernet franc/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-franc-merlot-cabernet-sau|Cabernet franc/merlot/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-mitos|Cabernet mitos|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-noir|Cabernet noir|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon|Cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-cabernet-franc-|Cabernet sauvignon/cabernet franc/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-cabernet-franc--2|Cabernet sauvignon/cabernet franc/merlot/petit verdot/malbec|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-carmenere-merlo|Cabernet sauvignon/carmenere/merlot/petit verdot|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-gaglioppo-magli|Cabernet sauvignon/gaglioppo/magliocco|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-malbec|Cabernet sauvignon/malbec|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-malbec-syrah|Cabernet sauvignon/malbec/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-merlot|Cabernet sauvignon/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-merlot-cabernet|Cabernet sauvignon/merlot/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-merlot-cabernet-2|Cabernet sauvignon/merlot/cabernet franc/carmenere|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-merlot-cabernet-3|Cabernet sauvignon/merlot/cabernet franc/petit verdot|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-merlot-cabernet-4|Cabernet sauvignon/merlot/cabernet franc/petit verdot/carmenere|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-merlot-malbec|Cabernet sauvignon/merlot/malbec|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-merlot-petit-ve|Cabernet sauvignon/merlot/petit verdot|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-merlot-petit-ve-2|Cabernet sauvignon/merlot/petit verdot/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-merlot-syrah|Cabernet sauvignon/merlot/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-petit-verdot|Cabernet sauvignon/petit verdot|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-pinotage|Cabernet sauvignon/pinotage|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-pinotage-cabern|Cabernet sauvignon/pinotage/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-refosco|Cabernet sauvignon/refosco|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-sangiovese|Cabernet sauvignon/sangiovese|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-syrah|Cabernet sauvignon/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-cabernet-sauvignon-syrah-merlot|Cabernet sauvignon/syrah/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-cabeza-de-pollo|Cabeza de pollo|s|n-chicken|g||
n-gpc-cabra|Cabra|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-cacao-soluble|Cacao soluble|t|n-gpc-bebidas-sin-alcohol|g||concentrado,listo para consumir
n-gpc-cadera-con-lomo-1-costilla|Cadera con lomo, 1 costilla|s|n-beef|g||
n-gpc-cadera-con-lomo-2-costillas|Cadera con lomo, 2 costillas|s|n-beef|g||
n-gpc-cadera-con-lomo-3-costillas|Cadera con lomo, 3 costillas|s|n-beef|g||
n-gpc-cadera-con-lomo-4-6-costillas|Cadera con lomo, 4-6 costillas|s|n-beef|g||
n-gpc-cadera-con-lomo-sin-costillas|Cadera con lomo, sin costillas|s|n-beef|g||
n-gpc-cadera-de-cerdo|Cadera de cerdo|s|n-pork|g||
n-gpc-cadera-de-cerdo-deshuesada|Cadera de cerdo deshuesada|s|n-pork|g||
n-gpc-cadera-de-vacuno|Cadera de vacuno|s|n-beef|g||
n-gpc-cadera-entera|Cadera entera|s|n-beef|g||
n-gpc-cafe-en-capsulas|Café en cápsulas|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-cafe-en-grano|Café en grano|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-cafe-liquido-concentrado|Café líquido concentrado|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-cafe-liquido-listo-para-beber|Café líquido listo para beber|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-cafe-molido|Café molido|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-cafe-soluble|Café soluble|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-cafe-te-e-infusiones|Café, té e infusiones|c|n-drinks|g||
n-gpc-cafe-y-sucedaneos-de-cafe|Café y sucedáneos de café|c|n-drinks|g||
n-gpc-caino|Caíño|s|n-gpc-vino-espumoso|g||
n-gpc-caino-blanco|Caíño blanco|s|n-gpc-vino-espumoso|g||
n-gpc-caino-longo|Caíño longo|s|n-gpc-vino-espumoso|g||
n-gpc-cal-karasi|Cal karasi|s|n-gpc-vino-espumoso|g||
n-gpc-calabaza-de-peregrino|Calabaza de peregrino|t|n-gpc-cucurbitaceas-de-piel-dura|g||
n-gpc-calabaza-opo|Calabaza opo|t|n-gpc-cucurbitaceas-de-piel-tierna|g||
n-gpc-caladoc|Caladoc|s|n-gpc-vino-espumoso|g||
n-gpc-california-sugar-pear|California sugar pear|s|n-v-pera|g||
n-gpc-callet|Callet|s|n-gpc-vino-espumoso|g||
n-gpc-camarate|Camarate|s|n-gpc-vino-espumoso|g||
n-gpc-camemoro|Camemoro|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-cameo|Cameo|s|n-v-manzana|g||
n-gpc-campidano|Campidano|s|n-gpc-vino-espumoso|g||
n-gpc-camspur-redchief|Camspur (redchief)|s|n-v-manzana|g||
n-gpc-canaiolo|Canaiolo|s|n-gpc-vino-espumoso|g||
n-gpc-canaiolo-nero|Canaiolo nero|s|n-gpc-vino-espumoso|g||
n-gpc-canal-de-cabrito|Canal de cabrito|s|n-gpc-cabra|g||
n-gpc-canal-de-cabrito-despiezada-en-4|Canal de cabrito despiezada en 4|s|n-gpc-cabra|g||
n-gpc-canal-de-cabrito-despiezada-en-5|Canal de cabrito despiezada en 5|s|n-gpc-cabra|g||
n-gpc-canal-de-cabrito-despiezada-en-6|Canal de cabrito despiezada en 6|s|n-gpc-cabra|g||
n-gpc-canal-de-cabrito-en-piezas|Canal de cabrito en piezas|s|n-gpc-cabra|g||
n-gpc-canal-de-cordero|Canal de cordero|s|n-gpc-cordero|g||
n-gpc-canal-de-cordero-telescopada|Canal de cordero telescopada|s|n-gpc-cordero|g||
n-gpc-canal-entera-de-bovino|Canal entera de bovino|s|n-beef|g||
n-gpc-canal-entera-de-cerdo|Canal entera de cerdo|s|n-pork|g||
n-gpc-cannonau|Cannonau|s|n-gpc-vino-espumoso|g||
n-gpc-canonigos|Canónigos|t|n-vegetable|g||
n-gpc-cantared|Cantared|s|n-v-manzana|g||
n-gpc-capitolare-biturica|Capitolare biturica|s|n-gpc-vino-espumoso|g||
n-gpc-caprettone|Caprettone|s|n-gpc-vino-espumoso|g||
n-gpc-caqui-americano|Caqui americano|t|n-v-caqui|g||
n-gpc-caracol-de-tierra|Caracol de tierra|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-cardinal|Cardinal|s|n-v-manzana|g||
n-gpc-carignan-grenache|Carignan/grenache|s|n-gpc-vino-espumoso|g||
n-gpc-carinena|Cariñena|s|n-gpc-vino-espumoso|g||
n-gpc-carmen|Carmen|s|n-v-pera|g||
n-gpc-carmenere|Carmenere|s|n-gpc-vino-espumoso|g||
n-gpc-carmenere-cabernet-sauvignon-syrah|Carmenere/cabernet sauvignon/syrah/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-carne-de-especies-alternativas|Carne de especies alternativas|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-carne-de-la-escapula-de-pavo|Carne de la escápula de pavo|s|n-turkey|g||
n-gpc-carne-de-varias-especies|Carne de varias especies|t|n-gpc-carne-y-aves|g||sin elaborar
n-gpc-carne-del-ilion-de-pavo|Carne del ilion de pavo|s|n-turkey|g||
n-gpc-carne-mixta-de-especies-alternativ|Carne mixta de especies alternativas|t|n-gpc-carne-y-aves|g||elaborado
n-gpc-carne-y-aves|Carne y aves|c|n-meat|g||
n-gpc-carola|Carola|s|n-v-manzana|g||
n-gpc-carre-de-cabrito-6-costillas|Carré de cabrito, 6 costillas|s|n-gpc-cabra|g||
n-gpc-carre-de-cabrito-7-costillas|Carré de cabrito, 7 costillas|s|n-gpc-cabra|g||
n-gpc-carre-de-cabrito-8-costillas|Carré de cabrito, 8 costillas|s|n-gpc-cabra|g||
n-gpc-carre-de-cabrito-9-costillas|Carré de cabrito, 9 costillas|s|n-gpc-cabra|g||
n-gpc-carre-de-cabrito-sin-tapa-6-costil|Carré de cabrito sin tapa, 6 costillas|s|n-gpc-cabra|g||
n-gpc-carre-de-cabrito-sin-tapa-7-costil|Carré de cabrito sin tapa, 7 costillas|s|n-gpc-cabra|g||
n-gpc-carre-de-cabrito-sin-tapa-8-costil|Carré de cabrito sin tapa, 8 costillas|s|n-gpc-cabra|g||
n-gpc-carre-de-cabrito-sin-tapa-9-costil|Carré de cabrito sin tapa, 9 costillas|s|n-gpc-cabra|g||
n-gpc-carre-de-cordero-6-costillas|Carré de cordero, 6 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-7-costillas|Carré de cordero, 7 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-8-costillas|Carré de cordero, 8 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-9-costillas|Carré de cordero, 9 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-con-ta|Carré de cordero francesado con tapa, 2 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-con-ta-2|Carré de cordero francesado con tapa, 3 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-con-ta-3|Carré de cordero francesado con tapa, 4 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-con-ta-4|Carré de cordero francesado con tapa, 5 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-con-ta-5|Carré de cordero francesado con tapa, 6 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-con-ta-6|Carré de cordero francesado con tapa, 7 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-con-ta-7|Carré de cordero francesado con tapa, 8 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-con-ta-8|Carré de cordero francesado con tapa, 9 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-sin-ta|Carré de cordero francesado sin tapa, 2 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-sin-ta-2|Carré de cordero francesado sin tapa, 3 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-sin-ta-3|Carré de cordero francesado sin tapa, 4 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-sin-ta-4|Carré de cordero francesado sin tapa, 5 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-sin-ta-5|Carré de cordero francesado sin tapa, 6 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-sin-ta-6|Carré de cordero francesado sin tapa, 7 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-sin-ta-7|Carré de cordero francesado sin tapa, 8 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-francesado-sin-ta-8|Carré de cordero francesado sin tapa, 9 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-sin-tapa-6-costil|Carré de cordero sin tapa, 6 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-sin-tapa-7-costil|Carré de cordero sin tapa, 7 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-sin-tapa-8-costil|Carré de cordero sin tapa, 8 costillas|s|n-gpc-cordero|g||
n-gpc-carre-de-cordero-sin-tapa-9-costil|Carré de cordero sin tapa, 9 costillas|s|n-gpc-cordero|g||
n-gpc-carricante|Carricante|s|n-gpc-vino-espumoso|g||
n-gpc-cartoixa|Cartoixa|s|n-gpc-vino-espumoso|g||
n-gpc-carusella|Carusella|s|n-v-pera|g||
n-gpc-casia|Casia|t|n-gpc-otras-frutas|g||
n-gpc-castana-de-agua|Castaña de agua|t|n-gpc-ciperaceas|g||
n-gpc-castelao|Castelao|s|n-gpc-vino-espumoso|g||
n-gpc-castelao-tempranillo-pinot-noir|Castelao/tempranillo/pinot noir|s|n-gpc-vino-espumoso|g||
n-gpc-castelao-touriga-nacional|Castelao/touriga nacional|s|n-gpc-vino-espumoso|g||
n-gpc-castell|Castell|s|n-v-pera|g||
n-gpc-castellana-negra|Castellana negra|s|n-gpc-vino-espumoso|g||
n-gpc-casteller|Casteller|s|n-gpc-vino-espumoso|g||
n-gpc-castelli-romani|Castelli romani|s|n-gpc-vino-espumoso|g||
n-gpc-castelmonte|Castelmonte|s|n-gpc-vino-espumoso|g||
n-gpc-catarratto|Catarratto|s|n-gpc-vino-espumoso|g||
n-gpc-caudle|Caudle|s|n-v-manzana|g||
n-gpc-cebolleta|Cebolleta|t|n-gpc-hortalizas-de-bulbo|g||
n-gpc-celica-welbo|Celica (welbo)|s|n-v-manzana|g||
n-gpc-centro-de-canal-10-costillas|Centro de canal, 10 costillas|s|n-pork|g||
n-gpc-centro-de-canal-11-costillas|Centro de canal, 11 costillas|s|n-pork|g||
n-gpc-centro-de-canal-12-costillas|Centro de canal, 12 costillas|s|n-pork|g||
n-gpc-centro-de-canal-13-costillas|Centro de canal, 13 costillas|s|n-pork|g||
n-gpc-centro-de-canal-deshuesado-de-10-c|Centro de canal deshuesado de 10 costillas|s|n-pork|g||
n-gpc-centro-de-canal-deshuesado-de-11-c|Centro de canal deshuesado de 11 costillas|s|n-pork|g||
n-gpc-centro-de-canal-deshuesado-de-12-c|Centro de canal deshuesado de 12 costillas|s|n-pork|g||
n-gpc-centro-de-canal-deshuesado-de-13-c|Centro de canal deshuesado de 13 costillas|s|n-pork|g||
n-gpc-cepiland|Cepiland|s|n-v-manzana|g||
n-gpc-cepuna|Cepuna|s|n-v-pera|g||
n-gpc-cerasuolo|Cerasuolo|s|n-gpc-vino-espumoso|g||
n-gpc-cerceal|Cerceal|s|n-gpc-vino-espumoso|g||
n-gpc-cereal-en-grano|Cereal en grano|t|n-gpc-granos-y-harinas|g||ambiente,concentrado,congelado,listo para consumir,refrigerado
n-gpc-cereales-elaborados|Cereales elaborados|c|n-pulses|g||
n-gpc-cesanese|Cesanese|s|n-gpc-vino-espumoso|g||
n-gpc-cevaal|Cevaal|s|n-v-manzana|g||
n-gpc-cg-10-yellow-delicious|Cg 10 yellow delicious|s|n-v-manzana|g||
n-gpc-chalota|Chalota|t|n-gpc-hortalizas-de-bulbo|g||
n-gpc-chambourcin|Chambourcin|s|n-gpc-vino-espumoso|g||
n-gpc-champagnezoet|Champagnezoet|s|n-v-manzana|g||
n-gpc-chancellor|Chancellor|s|n-gpc-vino-espumoso|g||
n-gpc-chantecler-belchard|Chantecler (belchard)|s|n-v-manzana|g||
n-gpc-charden|Charden|s|n-v-manzana|g||
n-gpc-chardonnay|Chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-blanc|Chardonnay blanc|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-chenin-bl|Chardonnay chenin bl|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-colombard|Chardonnay/colombard|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-macabeo|Chardonnay/macabeo|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-moscatel|Chardonnay/moscatel|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-pinot-meunier-pinot-noi|Chardonnay/pinot meunier/pinot noir|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-pinot-noir|Chardonnay/pinot noir|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-rose|Chardonnay rose|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-sauvignon-blanc|Chardonnay/sauvignon blanc|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-sauvignon-blanc-cortese|Chardonnay/sauvignon blanc/cortese|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-sauvignon-blanc-nosiola|Chardonnay/sauvignon blanc/nosiola|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-semillon|Chardonnay/semillon|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-verdelho|Chardonnay/verdelho|s|n-gpc-vino-espumoso|g||
n-gpc-chardonnay-viognier|Chardonnay/viognier|s|n-gpc-vino-espumoso|g||
n-gpc-charles-ross|Charles ross|s|n-v-manzana|g||
n-gpc-charlotte|Charlotte|s|n-v-manzana|g||
n-gpc-charneux|Charneux|s|n-v-pera|g||
n-gpc-chasselas-chasselas-dore|Chasselas (chasselas dore)|s|n-gpc-vino-espumoso|g||
n-gpc-chasselas-mueller-thurgau|Chasselas/mueller-thurgau|s|n-gpc-vino-espumoso|g||
n-gpc-chasselas-mueller-thurgau-others|Chasselas/mueller-thurgau/others|s|n-gpc-vino-espumoso|g||
n-gpc-chayote|Chayote|t|n-gpc-cucurbitaceas-de-piel-tierna|g||
n-gpc-chenin-blanc|Chenin blanc|s|n-gpc-vino-espumoso|g||
n-gpc-chenin-blanc-chardonnay|Chenin blanc/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-chenin-blanc-sauvignon-blanc|Chenin blanc/sauvignon blanc|s|n-gpc-vino-espumoso|g||
n-gpc-chenin-blanc-semillon|Chenin blanc/semillon|s|n-gpc-vino-espumoso|g||
n-gpc-cheremshyna|Cheremshyna|s|n-v-pera|g||
n-gpc-cherry-cox|Cherry cox|s|n-v-manzana|g||
n-gpc-chiavannesca|Chiavannesca|s|n-gpc-vino-espumoso|g||
n-gpc-chicle|Chicle|t|n-gpc-confiteria|g||
n-gpc-chicozapote|Chicozapote|t|n-v-zapote|g||
n-gpc-chinebuli|Chinebuli|s|n-gpc-vino-espumoso|g||
n-gpc-chivers-delight|Chivers delight|s|n-v-manzana|g||
n-gpc-choi-sum|Choi sum|t|n-gpc-coles-y-brasicas|g||
n-gpc-christmas-pippin|Christmas pippin|s|n-v-manzana|g||
n-gpc-chutney|Chutney|t|n-gpc-encurtidos-chutneys-y-aceitunas|g||ambiente,congelado,refrigerado
n-gpc-cidra|Cidra|t|n-gpc-citricos|g||
n-gpc-cienna|Cienna|s|n-gpc-vino-espumoso|g||
n-gpc-cilantro|Cilantro|t|n-gpc-hierbas-frescas|g||
n-gpc-ciliegiolo|Ciliegiolo|s|n-gpc-vino-espumoso|g||
n-gpc-cinsault|Cinsault|s|n-gpc-vino-espumoso|g||
n-gpc-cinsault-cabernet-sauvignon|Cinsault/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-cinsault-grenache-syrah|Cinsault/grenache/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-cinsault-pinotage|Cinsault/pinotage|s|n-gpc-vino-espumoso|g||
n-gpc-cinsault-syrah|Cinsault/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-ciperaceas|Ciperáceas|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-ciruela-claudia|Ciruela claudia|t|n-gpc-fruta-de-hueso|g||
n-gpc-ciruela-damascena|Ciruela damascena|t|n-gpc-fruta-de-hueso|g||
n-gpc-ciruela-japonesa|Ciruela japonesa|t|n-gpc-fruta-de-hueso|g||
n-gpc-ciruela-mirabel|Ciruela mirabel|t|n-gpc-fruta-de-hueso|g||
n-gpc-ciruela-mume|Ciruela mume|t|n-gpc-fruta-de-hueso|g||
n-gpc-citricos|Cítricos|c|n-produce|g||cortado
n-gpc-citronela|Citronela|t|n-gpc-hierbas-frescas|g||
n-gpc-civni|Civni|s|n-v-manzana|g||
n-gpc-clairette|Clairette|s|n-gpc-vino-espumoso|g||
n-gpc-clairette-blanc|Clairette blanc|s|n-gpc-vino-espumoso|g||
n-gpc-clairette-rose|Clairette rose|s|n-gpc-vino-espumoso|g||
n-gpc-clapp-s-favourite|Clapp's favourite|s|n-v-pera|g||
n-gpc-clara-frijs|Clara frijs|s|n-v-pera|g||
n-gpc-clementina|Clementina|t|n-gpc-citricos|g||
n-gpc-clevener|Clevener|s|n-gpc-vino-espumoso|g||
n-gpc-clevener-traminer|Clevener traminer|s|n-gpc-vino-espumoso|g||
n-gpc-cochinillo-abierto|Cochinillo abierto|s|n-pork|g||
n-gpc-cochinillo-entero|Cochinillo entero|s|n-pork|g||
n-gpc-coda-di-volpe|Coda di volpe|s|n-gpc-vino-espumoso|g||
n-gpc-codega|Codega|s|n-gpc-vino-espumoso|g||
n-gpc-codega-do-larinho|Codega do larinho|s|n-gpc-vino-espumoso|g||
n-gpc-codillo-delantero|Codillo delantero|s|n-pork|g||
n-gpc-codillo-trasero|Codillo trasero|s|n-pork|g||
n-gpc-col-de-bruselas|Col de Bruselas|t|n-gpc-coles-y-brasicas|g||
n-gpc-col-marina|Col marina|t|n-gpc-verduras-marinas|g||
n-gpc-col-puntiaguda|Col puntiaguda|t|n-gpc-coles-y-brasicas|g||
n-gpc-col-rizada|Col rizada|t|n-gpc-coles-y-brasicas|g||
n-gpc-coles-y-brasicas|Coles y brásicas|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-colinabo|Colinabo|t|n-gpc-coles-y-brasicas|g||
n-gpc-colirrabano|Colirrábano|t|n-gpc-coles-y-brasicas|g||
n-gpc-collina|Collina|s|n-v-manzana|g||
n-gpc-colmenilla|Colmenilla|t|n-gpc-setas-y-hongos|g||
n-gpc-colombard|Colombard|s|n-gpc-vino-espumoso|g||
n-gpc-colombard-chardonnay|Colombard/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-colombard-ugni-blanc|Colombard ugni blanc|s|n-gpc-vino-espumoso|g||
n-gpc-coloree-de-juillet|Coloree de juillet|s|n-v-pera|g||
n-gpc-colorino|Colorino|s|n-gpc-vino-espumoso|g||
n-gpc-columna|Columna|s|n-gpc-vino-espumoso|g||
n-gpc-combinaciones-de-cuatro-piezas-de-|Combinaciones de cuatro piezas de pollo|s|n-chicken|g||
n-gpc-combinaciones-de-cuatro-piezas-de--2|Combinaciones de cuatro piezas de pavo|s|n-turkey|g||
n-gpc-combinaciones-de-dos-piezas-de-pav|Combinaciones de dos piezas de pavo|s|n-turkey|g||
n-gpc-combinaciones-de-dos-piezas-de-pol|Combinaciones de dos piezas de pollo|s|n-chicken|g||
n-gpc-combinaciones-de-tres-piezas-de-pa|Combinaciones de tres piezas de pavo|s|n-turkey|g||
n-gpc-combinaciones-de-tres-piezas-de-po|Combinaciones de tres piezas de pollo|s|n-chicken|g||
n-gpc-combinado-alcoholico|Combinado alcohólico|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-combinado-sin-alcohol|Combinado sin alcohol|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-comice-rouge|Comice rouge|s|n-v-pera|g||
n-gpc-completer|Completer|s|n-gpc-vino-espumoso|g||
n-gpc-comtesse-de-paris|Comtesse de paris|s|n-v-pera|g||
n-gpc-concorde|Concorde|s|n-v-pera|g||
n-gpc-condo|Condo|s|n-v-pera|g||
n-gpc-condoula|Condoula|s|n-v-pera|g||
n-gpc-conferencia|Conferencia|s|n-v-pera|g||
n-gpc-confiteria|Confitería|c|n-grocery|g||
n-gpc-contra-de-cabrito|Contra de cabrito|s|n-gpc-cabra|g||
n-gpc-contra-de-vacuno|Contra de vacuno|s|n-beef|g||
n-gpc-contra-limpia|Contra limpia|s|n-beef|g||
n-gpc-contra-plana|Contra plana|s|n-beef|g||
n-gpc-contramuslito-de-ala-de-pavo|Contramuslito de ala de pavo|s|n-turkey|g||
n-gpc-contramuslito-de-ala-de-pollo|Contramuslito de ala de pollo|s|n-chicken|g||
n-gpc-contramuslo-de-pavo-con-parte-de-e|Contramuslo de pavo con parte de espalda|s|n-turkey|g||
n-gpc-contramuslo-de-pavo-deshuesado|Contramuslo de pavo deshuesado|s|n-turkey|g||
n-gpc-contramuslo-de-pavo-limpio|Contramuslo de pavo limpio|s|n-turkey|g||
n-gpc-contramuslo-de-pollo-con-parte-de-|Contramuslo de pollo con parte de espalda|s|n-chicken|g||
n-gpc-contramuslo-de-pollo-deshuesado|Contramuslo de pollo deshuesado|s|n-chicken|g||
n-gpc-contramuslo-de-pollo-deshuesado-es|Contramuslo de pollo deshuesado, escuadrado|s|n-chicken|g||
n-gpc-contramuslo-de-pollo-deshuesado-li|Contramuslo de pollo deshuesado, limpio|s|n-chicken|g||
n-gpc-contramuslo-de-pollo-deshuesado-li-2|Contramuslo de pollo deshuesado, limpio y escuadrado|s|n-chicken|g||
n-gpc-coop-43|Coop 43|s|n-v-manzana|g||
n-gpc-corazon-de-cadera|Corazón de cadera|s|n-beef|g||
n-gpc-corazon-de-chuletero|Corazón de chuletero|s|n-pork|g||
n-gpc-corazon-de-costillar-de-cordero|Corazón de costillar de cordero|s|n-gpc-cordero|g||
n-gpc-corazon-de-lomo-de-cerdo|Corazón de lomo de cerdo|s|n-pork|g||
n-gpc-corazon-de-lomo-de-cordero|Corazón de lomo de cordero|s|n-gpc-cordero|g||
n-gpc-corazones-de-pavo-con-capa|Corazones de pavo con capa|s|n-turkey|g||
n-gpc-corazones-de-pavo-sin-capa|Corazones de pavo sin capa|s|n-turkey|g||
n-gpc-corazones-de-pollo-con-capa|Corazones de pollo con capa|s|n-chicken|g||
n-gpc-corazones-de-pollo-sin-capa|Corazones de pollo sin capa|s|n-chicken|g||
n-gpc-cordero|Cordero|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-cornalin|Cornalin|s|n-gpc-vino-espumoso|g||
n-gpc-cornalin-cabernet-sauvignon-syrah-|Cornalin/cabernet sauvignon/syrah/merlot/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-cornalin-diolinoir-syrah|Cornalin/diolinoir/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-coromandel-red|Coromandel red|s|n-v-manzana|g||
n-gpc-cortese|Cortese|s|n-gpc-vino-espumoso|g||
n-gpc-cortland|Cortland|s|n-v-manzana|g||
n-gpc-corvina-cabernet-sauvignon|Corvina/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-corvinone-rondinella|Corvina/corvinone/rondinella|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-corvinone-rondinella-molin|Corvina/corvinone/rondinella/molinara|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-grossa|Corvina grossa|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-merlot|Corvina/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-molinara-rondinella|Corvina/molinara/rondinella|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-rondinella|Corvina/rondinella|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-rondinella-corvinone|Corvina/rondinella/corvinone|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-rondinella-molinara|Corvina/rondinella/molinara|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-sangiovese|Corvina/sangiovese|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-veronese|Corvina veronese|s|n-gpc-vino-espumoso|g||
n-gpc-corvina-veronese-rondinella-molina|Corvina veronese/rondinella/molinara|s|n-gpc-vino-espumoso|g||
n-gpc-corvinone|Corvinone|s|n-gpc-vino-espumoso|g||
n-gpc-corzo|Corzo|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-coscia|Coscia|s|n-v-pera|g||
n-gpc-costaiola|Costaiola|s|n-gpc-vino-espumoso|g||
n-gpc-costiera|Costiera|s|n-gpc-vino-espumoso|g||
n-gpc-costillar-bajo-de-cabrito-6-costil|Costillar bajo de cabrito, 6 costillas|s|n-gpc-cabra|g||
n-gpc-costillar-bajo-de-cabrito-7-costil|Costillar bajo de cabrito, 7 costillas|s|n-gpc-cabra|g||
n-gpc-costillar-bajo-de-cabrito-8-costil|Costillar bajo de cabrito, 8 costillas|s|n-gpc-cabra|g||
n-gpc-costillar-bajo-de-cabrito-9-costil|Costillar bajo de cabrito, 9 costillas|s|n-gpc-cabra|g||
n-gpc-costillar-bajo-de-cordero-6-costil|Costillar bajo de cordero, 6 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-bajo-de-cordero-7-costil|Costillar bajo de cordero, 7 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-bajo-de-cordero-8-costil|Costillar bajo de cordero, 8 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-bajo-de-cordero-9-costil|Costillar bajo de cordero, 9 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-bajo-de-vacuno|Costillar bajo de vacuno|s|n-beef|g||
n-gpc-costillar-completo|Costillar completo|s|n-pork|g||
n-gpc-costillar-de-lomo|Costillar de lomo|s|n-pork|g||
n-gpc-costillar-de-paletilla-de-cerdo-2-|Costillar de paletilla de cerdo, 2 costillas|s|n-pork|g||
n-gpc-costillar-de-paletilla-de-cerdo-3-|Costillar de paletilla de cerdo, 3 costillas|s|n-pork|g||
n-gpc-costillar-de-paletilla-de-cerdo-4-|Costillar de paletilla de cerdo, 4 costillas|s|n-pork|g||
n-gpc-costillar-de-paletilla-de-cordero-|Costillar de paletilla de cordero, 2 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-de-paletilla-de-cordero--2|Costillar de paletilla de cordero, 3 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-de-paletilla-de-cordero--3|Costillar de paletilla de cordero, 4 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-de-paletilla-de-cordero--4|Costillar de paletilla de cordero, 5 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-de-paletilla-de-cordero--5|Costillar de paletilla de cordero francesado, 2 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-de-paletilla-de-cordero--6|Costillar de paletilla de cordero francesado, 3 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-de-paletilla-de-cordero--7|Costillar de paletilla de cordero francesado, 4 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-de-paletilla-de-cordero--8|Costillar de paletilla de cordero francesado, 5 costillas|s|n-gpc-cordero|g||
n-gpc-costillar-de-panceta|Costillar de panceta|s|n-pork|g||
n-gpc-costillar-estilo-st-louis|Costillar estilo St. Louis|s|n-pork|g||
n-gpc-costillar-preparado-4-costillas|Costillar preparado, 4 costillas|s|n-beef|g||
n-gpc-costillar-preparado-5-costillas|Costillar preparado, 5 costillas|s|n-beef|g||
n-gpc-costillar-preparado-6-costillas|Costillar preparado, 6 costillas|s|n-beef|g||
n-gpc-costillar-preparado-7-costillas|Costillar preparado, 7 costillas|s|n-beef|g||
n-gpc-costillar-preparado-8-costillas|Costillar preparado, 8 costillas|s|n-beef|g||
n-gpc-costillar-preparado-9-costillas|Costillar preparado, 9 costillas|s|n-beef|g||
n-gpc-costillas-cortas-de-cerdo|Costillas cortas de cerdo|s|n-pork|g||
n-gpc-costillas-cortas-de-vacuno-1-costi|Costillas cortas de vacuno, 1 costilla|s|n-beef|g||
n-gpc-costillas-cortas-de-vacuno-2-costi|Costillas cortas de vacuno, 2 costillas|s|n-beef|g||
n-gpc-costillas-cortas-de-vacuno-3-costi|Costillas cortas de vacuno, 3 costillas|s|n-beef|g||
n-gpc-costillas-cortas-de-vacuno-4-costi|Costillas cortas de vacuno, 4 costillas|s|n-beef|g||
n-gpc-costillas-cortas-de-vacuno-5-costi|Costillas cortas de vacuno, 5 costillas|s|n-beef|g||
n-gpc-costillas-cortas-de-vacuno-6-costi|Costillas cortas de vacuno, 6 costillas|s|n-beef|g||
n-gpc-costillas-cortas-de-vacuno-7-costi|Costillas cortas de vacuno, 7 costillas|s|n-beef|g||
n-gpc-costillas-cortas-de-vacuno-8-costi|Costillas cortas de vacuno, 8 costillas|s|n-beef|g||
n-gpc-costillas-cortas-de-vacuno-9-costi|Costillas cortas de vacuno, 9 costillas|s|n-beef|g||
n-gpc-costillitas-de-lomo|Costillitas de lomo|s|n-pork|g||
n-gpc-couderc-muscat|Couderc muscat|s|n-gpc-vino-espumoso|g||
n-gpc-counoise|Counoise|s|n-gpc-vino-espumoso|g||
n-gpc-court-pendu-plat|Court pendu plat|s|n-v-manzana|g||
n-gpc-cox-s-orange-pippin|Cox's orange pippin|s|n-v-manzana|g||
n-gpc-crato-branco|Crato branco|s|n-gpc-vino-espumoso|g||
n-gpc-creata|Creata|s|n-gpc-vino-espumoso|g||
n-gpc-crema-de-grasas-mixtas|Crema de grasas mixtas|t|n-butter|g||ambiente,congelado,refrigerado
n-gpc-crema-para-untar-lactea|Crema para untar láctea|t|n-butter|g||ambiente,congelado,refrigerado
n-gpc-cresta-de-pollo|Cresta de pollo|s|n-chicken|g||
n-gpc-criadillas-de-pavo|Criadillas de pavo|s|n-turkey|g||
n-gpc-criadillas-de-pollo|Criadillas de pollo|s|n-chicken|g||
n-gpc-crimson-bramley|Crimson bramley|s|n-v-manzana|g||
n-gpc-cripps-pink|Cripps pink|s|n-v-manzana|g||
n-gpc-cripps-red|Cripps red|s|n-v-manzana|g||
n-gpc-criterion|Criterion|s|n-v-manzana|g||
n-gpc-croatina|Croatina|s|n-gpc-vino-espumoso|g||
n-gpc-croatina-others|Croatina/others|s|n-gpc-vino-espumoso|g||
n-gpc-crosne|Crosne|t|n-root|g||
n-gpc-crouchen|Crouchen|s|n-gpc-vino-espumoso|g||
n-gpc-crouchen-riesling|Crouchen/riesling|s|n-gpc-vino-espumoso|g||
n-gpc-crouchen-sauvignon-blanc|Crouchen/sauvignon blanc|s|n-gpc-vino-espumoso|g||
n-gpc-crowngold|Crowngold|s|n-v-manzana|g||
n-gpc-cserszegi-fuszeres|Cserszegi fuszeres|s|n-gpc-vino-espumoso|g||
n-gpc-cuarto-de-pechuga-de-pollo|Cuarto de pechuga de pollo|s|n-chicken|g||
n-gpc-cuarto-delantero-10-costillas|Cuarto delantero, 10 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-11-costillas|Cuarto delantero, 11 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-12-costillas|Cuarto delantero, 12 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-13-costillas|Cuarto delantero, 13 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-5-costillas|Cuarto delantero, 5 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-6-costillas|Cuarto delantero, 6 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-7-costillas|Cuarto delantero, 7 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-8-costillas|Cuarto delantero, 8 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-9-costillas|Cuarto delantero, 9 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-10-cost|Cuarto delantero con falda, 10 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-11-cost|Cuarto delantero con falda, 11 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-12-cost|Cuarto delantero con falda, 12 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-13-cost|Cuarto delantero con falda, 13 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-4-costi|Cuarto delantero con falda, 4 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-5-costi|Cuarto delantero con falda, 5 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-6-costi|Cuarto delantero con falda, 6 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-7-costi|Cuarto delantero con falda, 7 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-8-costi|Cuarto delantero con falda, 8 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-con-falda-9-costi|Cuarto delantero con falda, 9 costillas|s|n-beef|g||
n-gpc-cuarto-delantero-de-cabrito|Cuarto delantero de cabrito|s|n-gpc-cabra|g||
n-gpc-cuarto-delantero-de-cerdo-1-costil|Cuarto delantero de cerdo, 1 costilla|s|n-pork|g||
n-gpc-cuarto-delantero-de-cerdo-2-costil|Cuarto delantero de cerdo, 2 costillas|s|n-pork|g||
n-gpc-cuarto-delantero-de-cerdo-3-costil|Cuarto delantero de cerdo, 3 costillas|s|n-pork|g||
n-gpc-cuarto-delantero-de-cerdo-4-costil|Cuarto delantero de cerdo, 4 costillas|s|n-pork|g||
n-gpc-cuarto-delantero-de-cordero-3-cost|Cuarto delantero de cordero, 3 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-delantero-de-cordero-4-cost|Cuarto delantero de cordero, 4 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-delantero-de-cordero-5-cost|Cuarto delantero de cordero, 5 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-delantero-de-cordero-6-cost|Cuarto delantero de cordero, 6 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-delantero-de-cordero-deshue|Cuarto delantero de cordero deshuesado, 4 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-delantero-de-cordero-deshue-2|Cuarto delantero de cordero deshuesado, 5 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-delantero-de-cordero-deshue-3|Cuarto delantero de cordero deshuesado, 6 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-delantero-de-cordero-semide|Cuarto delantero de cordero semideshuesado, 4 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-delantero-de-cordero-semide-2|Cuarto delantero de cordero semideshuesado, 5 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-delantero-de-cordero-semide-3|Cuarto delantero de cordero semideshuesado, 6 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-trasero-1-costilla|Cuarto trasero, 1 costilla|s|n-beef|g||
n-gpc-cuarto-trasero-10-costillas|Cuarto trasero, 10 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-2-costillas|Cuarto trasero, 2 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-3-costillas|Cuarto trasero, 3 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-4-costillas|Cuarto trasero, 4 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-5-costillas|Cuarto trasero, 5 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-6-costillas|Cuarto trasero, 6 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-7-costillas|Cuarto trasero, 7 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-8-costillas|Cuarto trasero, 8 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-9-costillas|Cuarto trasero, 9 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-de-cabrito|Cuarto trasero de cabrito|s|n-gpc-cabra|g||
n-gpc-cuarto-trasero-de-cerdo-8-costilla|Cuarto trasero de cerdo, 8 costillas|s|n-pork|g||
n-gpc-cuarto-trasero-de-cerdo-9-costilla|Cuarto trasero de cerdo, 9 costillas|s|n-pork|g||
n-gpc-cuarto-trasero-de-cordero-6-costil|Cuarto trasero de cordero, 6 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-trasero-de-cordero-7-costil|Cuarto trasero de cordero, 7 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-trasero-de-cordero-8-costil|Cuarto trasero de cordero, 8 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-trasero-de-cordero-9-costil|Cuarto trasero de cordero, 9 costillas|s|n-gpc-cordero|g||
n-gpc-cuarto-trasero-de-pavo|Cuarto trasero de pavo|s|n-turkey|g||
n-gpc-cuarto-trasero-de-pavo-sin-rabadil|Cuarto trasero de pavo sin rabadilla|s|n-turkey|g||
n-gpc-cuarto-trasero-de-pollo-con-grasa-|Cuarto trasero de pollo con grasa abdominal|s|n-chicken|g||
n-gpc-cuarto-trasero-de-pollo-con-parte-|Cuarto trasero de pollo con parte de espalda|s|n-chicken|g||
n-gpc-cuarto-trasero-de-pollo-con-parte--2|Cuarto trasero de pollo con parte de espalda, sin rabadilla|s|n-chicken|g||
n-gpc-cuarto-trasero-de-pollo-con-parte--3|Cuarto trasero de pollo con parte de espalda, sin rabadilla ni grasa abdominal|s|n-chicken|g||
n-gpc-cuarto-trasero-de-pollo-de-corte-c|Cuarto trasero de pollo de corte corto|s|n-chicken|g||
n-gpc-cuarto-trasero-de-pollo-de-corte-c-2|Cuarto trasero de pollo de corte corto con incisión en contramuslo y jamoncito|s|n-chicken|g||
n-gpc-cuarto-trasero-de-pollo-de-corte-l|Cuarto trasero de pollo de corte largo|s|n-chicken|g||
n-gpc-cuarto-trasero-de-pollo-de-corte-l-2|Cuarto trasero de pollo de corte largo con incisión en contramuslo y jamoncito|s|n-chicken|g||
n-gpc-cuarto-trasero-entero-de-pavo|Cuarto trasero entero de pavo|s|n-turkey|g||
n-gpc-cuarto-trasero-pistola-1-costilla|Cuarto trasero pistola, 1 costilla|s|n-beef|g||
n-gpc-cuarto-trasero-pistola-10-costilla|Cuarto trasero pistola, 10 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-pistola-2-costillas|Cuarto trasero pistola, 2 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-pistola-3-costillas|Cuarto trasero pistola, 3 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-pistola-4-costillas|Cuarto trasero pistola, 4 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-pistola-5-costillas|Cuarto trasero pistola, 5 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-pistola-6-costillas|Cuarto trasero pistola, 6 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-pistola-7-costillas|Cuarto trasero pistola, 7 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-pistola-8-costillas|Cuarto trasero pistola, 8 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-pistola-9-costillas|Cuarto trasero pistola, 9 costillas|s|n-beef|g||
n-gpc-cuarto-trasero-sin-costillas|Cuarto trasero, sin costillas|s|n-beef|g||
n-gpc-cucurbitaceas-de-piel-dura|Cucurbitáceas de piel dura|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-cucurbitaceas-de-piel-tierna|Cucurbitáceas de piel tierna|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-cuello-de-cabrito|Cuello de cabrito|s|n-gpc-cabra|g||
n-gpc-cuello-de-cordero-deshuesado|Cuello de cordero deshuesado|s|n-gpc-cordero|g||
n-gpc-cuello-de-pavo|Cuello de pavo|s|n-turkey|g||
n-gpc-cuello-de-pollo|Cuello de pollo|s|n-chicken|g||
n-gpc-culata-de-contra|Culata de contra|s|n-beef|g||
n-gpc-culata-de-contra-de-cabrito|Culata de contra de cabrito|s|n-gpc-cabra|g||
n-gpc-cutaneo-del-tronco|Cutáneo del tronco|s|n-beef|g||
n-gpc-d-joaquina-doyenne-de-julliet|D. joaquina (doyenne de julliet)|s|n-v-pera|g||
n-gpc-dafni|Dafni|s|n-gpc-vino-espumoso|g||
n-gpc-daigon|Daigon|s|n-v-pera|g||
n-gpc-daikon|Daikon|t|n-root|g||
n-gpc-daliest|Daliest|s|n-v-manzana|g||
n-gpc-daliguy|Daliguy|s|n-v-manzana|g||
n-gpc-dalijean|Dalijean|s|n-v-manzana|g||
n-gpc-dalili-delcorf-estivale|Dalili (delcorf estivale)|s|n-v-manzana|g||
n-gpc-dalinbel-antares|Dalinbel (antarès)|s|n-v-manzana|g||
n-gpc-dalinco|Dalinco|s|n-v-manzana|g||
n-gpc-daliter|Daliter|s|n-v-manzana|g||
n-gpc-dalitron|Dalitron|s|n-v-manzana|g||
n-gpc-danziger-kantapfel|Danziger kantapfel|s|n-v-manzana|g||
n-gpc-daynir|Daynir|s|n-v-pera|g||
n-gpc-daytor|Daytor|s|n-v-pera|g||
n-gpc-de-chaunac|De chaunac|s|n-gpc-vino-espumoso|g||
n-gpc-decana-del-comicio|Decana del comicio|s|n-v-pera|g||
n-gpc-decosta-jonagold-de-coster|Decosta (jonagold de coster)|s|n-v-manzana|g||
n-gpc-delaware|Delaware|s|n-gpc-vino-espumoso|g||
n-gpc-delbias|Delbias|s|n-v-pera|g||
n-gpc-delblush|Delblush|s|n-v-manzana|g||
n-gpc-delbuena|Delbuena|s|n-v-pera|g||
n-gpc-delcorf|Delcorf|s|n-v-manzana|g||
n-gpc-delcorf-diana|Delcorf diana|s|n-v-manzana|g||
n-gpc-delcoros|Delcoros|s|n-v-manzana|g||
n-gpc-delgollune|Delgollune|s|n-v-manzana|g||
n-gpc-delicious-ordinaire|Delicious ordinaire|s|n-v-manzana|g||
n-gpc-delikates|Delikates|s|n-v-manzana|g||
n-gpc-deljeni|Deljeni|s|n-v-manzana|g||
n-gpc-delor|Delor|s|n-v-manzana|g||
n-gpc-delsanne|Delsanne|s|n-v-pera|g||
n-gpc-despiece-de-pierna-de-cabrito-en-4|Despiece de pierna de cabrito en 4|s|n-gpc-cabra|g||
n-gpc-despiece-de-pierna-de-cordero|Despiece de pierna de cordero|s|n-gpc-cordero|g||
n-gpc-despiece-surtido-de-cabrito-con-hu|Despiece surtido de cabrito con hueso|s|n-gpc-cabra|g||
n-gpc-despiece-surtido-de-cordero-listo-|Despiece surtido de cordero listo para bloque|s|n-gpc-cordero|g||
n-gpc-dessert|Dessert|s|n-v-manzana|g||ambiente,congelado,refrigerado
n-gpc-destilado|Destilado|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-destilados-sin-alcohol|Destilados sin alcohol|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-devo|Devo|s|n-v-pera|g||
n-gpc-diagalves|Diagalves|s|n-gpc-vino-espumoso|g||
n-gpc-diana-spur|Diana spur|s|n-v-manzana|g||
n-gpc-dicolor|Dicolor|s|n-v-pera|g||
n-gpc-diente-de-leon|Diente de león|t|n-vegetable|g||
n-gpc-dijkmanszoet|Dijkmanszoet|s|n-v-manzana|g||
n-gpc-dimiat|Dimiat|s|n-gpc-vino-espumoso|g||
n-gpc-diolinoir|Diolinoir|s|n-gpc-vino-espumoso|g||
n-gpc-discovery|Discovery|s|n-v-manzana|g||
n-gpc-dita|Dita|s|n-v-pera|g||
n-gpc-doc-melbi|Doč melbi|s|n-v-manzana|g||
n-gpc-dolacomi|Dolacomi|s|n-v-pera|g||
n-gpc-dolcetto|Dolcetto|s|n-gpc-vino-espumoso|g||
n-gpc-dolcetto-syrah|Dolcetto/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-domina|Domina|s|n-gpc-vino-espumoso|g||
n-gpc-don-guindo|Don guindo|s|n-v-pera|g||
n-gpc-doral|Doral|s|n-gpc-vino-espumoso|g||
n-gpc-dornfelder|Dornfelder|s|n-gpc-vino-espumoso|g||
n-gpc-dornfelder-pinot-noir|Dornfelder/pinot noir|s|n-gpc-vino-espumoso|g||
n-gpc-doyenne-boussoch|Doyenne boussoch|s|n-v-pera|g||
n-gpc-doyenne-d-hiver|Doyenne d'hiver|s|n-v-pera|g||
n-gpc-drentsche-bellefleur|Drentsche bellefleur|s|n-v-manzana|g||
n-gpc-droe-steen|Droe steen|s|n-gpc-vino-espumoso|g||
n-gpc-drupeggio|Drupeggio|s|n-gpc-vino-espumoso|g||
n-gpc-dubbele-zoete-aagt|Dubbele zoete aagt|s|n-v-manzana|g||
n-gpc-duc-de-bordeaux|Duc de bordeaux|s|n-v-pera|g||
n-gpc-dulmener-rosenapfel-dulman-rose|Dulmener rosenapfel (dulman rose)|s|n-v-manzana|g||
n-gpc-dunaj|Dunaj|s|n-gpc-vino-espumoso|g||
n-gpc-dunantul|Dunantul|s|n-gpc-vino-espumoso|g||
n-gpc-dunn-s-seedling|Dunn's seedling|s|n-v-manzana|g||
n-gpc-durian|Durián|t|n-gpc-otras-frutas|g||
n-gpc-durif-petit-syrah|Durif (petit syrah)|s|n-gpc-vino-espumoso|g||
n-gpc-durondeau|Durondeau|s|n-v-pera|g||
n-gpc-early|Early|s|n-v-manzana|g||
n-gpc-early-desire|Early desire|s|n-v-pera|g||
n-gpc-early-victoria|Early victoria|s|n-v-manzana|g||
n-gpc-ecolette|Ecolette|s|n-v-manzana|g||
n-gpc-egremont-russet|Egremont russet|s|n-v-manzana|g||
n-gpc-ehrenfelser|Ehrenfelser|s|n-gpc-vino-espumoso|g||
n-gpc-eifeler-rambur|Eifeler rambur|s|n-v-manzana|g||
n-gpc-eisdener-klumpke|Eisdener klumpke|s|n-v-manzana|g||
n-gpc-elaborados-a-base-de-cereal|Elaborados a base de cereal|c|n-grocery|g||
n-gpc-elan|Elan|s|n-v-manzana|g||
n-gpc-elbling|Elbling|s|n-gpc-vino-espumoso|g||
n-gpc-elise|Elise|s|n-v-manzana|g||
n-gpc-elise-rathke|Elise rathke|s|n-v-manzana|g||
n-gpc-elliot|Elliot|s|n-v-pera|g||
n-gpc-ellison-s-orange|Ellison's orange|s|n-v-manzana|g||
n-gpc-elshard|Elshard|s|n-v-manzana|g||
n-gpc-elshof|Elshof|s|n-v-manzana|g||
n-gpc-elstar-and-mutants|Elstar and mutants|s|n-v-manzana|g||
n-gpc-elstar-armhold|Elstar armhold|s|n-v-manzana|g||
n-gpc-elstar-boerekamp|Elstar boerekamp|s|n-v-manzana|g||
n-gpc-elstar-palm|Elstar palm|s|n-v-manzana|g||
n-gpc-elstar-van-der-zalm|Elstar van der zalm|s|n-v-manzana|g||
n-gpc-embutido-de-cerdo|Embutido de cerdo|t|n-sausage|g||elaborado
n-gpc-embutido-de-cordero|Embutido de cordero|t|n-sausage|g||elaborado
n-gpc-embutido-de-especies-alternativas|Embutido de especies alternativas|t|n-sausage|g||elaborado
n-gpc-embutido-de-pavo|Embutido de pavo|t|n-sausage|g||elaborado
n-gpc-embutido-de-pollo|Embutido de pollo|t|n-sausage|g||elaborado
n-gpc-embutido-de-ternera|Embutido de ternera|t|n-sausage|g||elaborado
n-gpc-embutido-de-vacuno|Embutido de vacuno|t|n-sausage|g||elaborado
n-gpc-embutido-de-varias-especies|Embutido de varias especies|t|n-sausage|g||elaborado
n-gpc-emile-d-heyst|Emile d'heyst|s|n-v-pera|g||
n-gpc-emir|Emir|s|n-gpc-vino-espumoso|g||
n-gpc-emmons|Emmons|s|n-v-manzana|g||
n-gpc-empanadas-pizzas-y-quiches|Empanadas, pizzas y quiches|t|n-gpc-bolleria-salada|g||ambiente,congelado,refrigerado
n-gpc-empire|Empire|s|n-v-manzana|g||
n-gpc-emu|Emú|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-encruzado|Encruzado|s|n-gpc-vino-espumoso|g||
n-gpc-encurtidos-chutneys-y-aceitunas|Encurtidos, chutneys y aceitunas|c|n-grocery|g||
n-gpc-eneldo|Eneldo|t|n-gpc-hierbas-frescas|g||
n-gpc-enoki|Enoki|t|n-gpc-setas-y-hongos|g||
n-gpc-entrana-de-falda|Entraña de falda|s|n-beef|g||
n-gpc-entrana-exterior|Entraña exterior|s|n-beef|g||
n-gpc-entrana-gruesa|Entraña gruesa|s|n-beef|g||
n-gpc-entrana-interior|Entraña interior|s|n-beef|g||
n-gpc-epazote|Epazote|t|n-gpc-hierbas-frescas|g||
n-gpc-erbaluce|Erbaluce|s|n-gpc-vino-espumoso|g||
n-gpc-erika|Erika|s|n-v-pera|g||
n-gpc-erovan|Erovan|s|n-v-manzana|g||
n-gpc-escarabajos|Escarabajos|t|n-gpc-insectos-comestibles|g||elaborado,sin elaborar
n-gpc-escarola-rizada|Escarola rizada|t|n-vegetable|g||
n-gpc-escorzonera|Escorzonera|t|n-root|g||
n-gpc-espalda-alta-de-pollo|Espalda alta de pollo|s|n-chicken|g||
n-gpc-espalda-baja-de-pollo|Espalda baja de pollo|s|n-chicken|g||
n-gpc-espalda-baja-de-pollo-limpia|Espalda baja de pollo limpia|s|n-chicken|g||
n-gpc-espalda-entera-de-pollo|Espalda entera de pollo|s|n-chicken|g||
n-gpc-espinaca-de-agua|Espinaca de agua|t|n-vegetable|g||
n-gpc-espinaca-de-nueva-zelanda|Espinaca de Nueva Zelanda|t|n-vegetable|g||
n-gpc-estragon|Estragón|t|n-gpc-hierbas-frescas|g||
n-gpc-etrusca|Etrusca|s|n-v-pera|g||
n-gpc-extracto-de-huevo|Extracto de huevo|t|n-grocery|g||
n-gpc-extractos-y-potenciadores-de-sabor|Extractos y potenciadores de sabor|t|n-gpc-hierbas-especias-y-extractos|g||ambiente
n-gpc-ezerjo|Ezerjo|s|n-gpc-vino-espumoso|g||
n-gpc-faber|Faber|s|n-gpc-vino-espumoso|g||
n-gpc-faberebe|Faberebe|s|n-gpc-vino-espumoso|g||
n-gpc-faisan|Faisán|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-falanghina|Falanghina|s|n-gpc-vino-espumoso|g||
n-gpc-falda-de-cordero|Falda de cordero|s|n-gpc-cordero|g||
n-gpc-falda-de-cordero-deshuesada|Falda de cordero deshuesada|s|n-gpc-cordero|g||
n-gpc-falda-de-vacuno|Falda de vacuno|s|n-beef|g||
n-gpc-falstaff|Falstaff|s|n-v-manzana|g||
n-gpc-famoso|Famoso|s|n-gpc-vino-espumoso|g||
n-gpc-favorita|Favorita|s|n-gpc-vino-espumoso|g||
n-gpc-feijoa|Feijoa|t|n-gpc-otras-frutas|g||
n-gpc-fenbra-braeburn-fenbra|Fenbra (braeburn fenbra)|s|n-v-manzana|g||
n-gpc-fermentado|Fermentado|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-fermentado-espumoso|Fermentado espumoso|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-fernao-pires|Fernao pires|s|n-gpc-vino-espumoso|g||
n-gpc-feteasca-alba|Feteasca alba|s|n-gpc-vino-espumoso|g||
n-gpc-feteasca-alba-leanyka|Feteasca alba/leanyka|s|n-gpc-vino-espumoso|g||
n-gpc-feteasca-neagra|Feteasca neagra|s|n-gpc-vino-espumoso|g||
n-gpc-feteasca-regala|Feteasca regala|s|n-gpc-vino-espumoso|g||
n-gpc-fiano|Fiano|s|n-gpc-vino-espumoso|g||
n-gpc-fiano-greco|Fiano/greco|s|n-gpc-vino-espumoso|g||
n-gpc-fiesta-red-pippin|Fiesta (red pippin)|s|n-v-manzana|g||
n-gpc-filete-de-cuello-de-cordero|Filete de cuello de cordero|s|n-gpc-cordero|g||
n-gpc-filippa|Filippa|s|n-v-manzana|g||
n-gpc-finesse|Finesse|s|n-v-manzana|g||
n-gpc-finkenwerder-prinz|Finkenwerder prinz|s|n-v-manzana|g||
n-gpc-fireside|Fireside|s|n-v-manzana|g||
n-gpc-flamingo|Flamingo|s|n-v-pera|g||
n-gpc-flor-comestible|Flor comestible|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-floreal|Floreal|s|n-gpc-vino-espumoso|g||
n-gpc-florina|Florina|s|n-v-manzana|g||
n-gpc-florina-querina|Florina (querina)|s|n-v-manzana|g||
n-gpc-forcada|Forcada|s|n-gpc-vino-espumoso|g||
n-gpc-forele|Forele|s|n-v-manzana|g||
n-gpc-forelle|Forelle|s|n-v-pera|g||
n-gpc-fortuna-delicious|Fortuna delicious|s|n-v-manzana|g||
n-gpc-fortune|Fortune|s|n-v-manzana|g||
n-gpc-francusa|Francusa|s|n-gpc-vino-espumoso|g||
n-gpc-franse-wijnpeer|Franse wijnpeer|s|n-v-pera|g||
n-gpc-franse-zure|Franse zure|s|n-v-manzana|g||
n-gpc-frappato|Frappato|s|n-gpc-vino-espumoso|g||
n-gpc-frederick|Frederick|s|n-v-manzana|g||
n-gpc-freiherr-von-berlepsch|Freiherr von berlepsch|s|n-v-manzana|g||
n-gpc-freisa|Freisa|s|n-gpc-vino-espumoso|g||
n-gpc-french-butter|French butter|s|n-v-pera|g||
n-gpc-french-colombard|French colombard|s|n-gpc-vino-espumoso|g||
n-gpc-fresa-silvestre|Fresa silvestre|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-fresco|Fresco|s|n-v-manzana|g||
n-gpc-friulano|Friulano|s|n-gpc-vino-espumoso|g||
n-gpc-frontenac-gris|Frontenac gris|s|n-gpc-vino-espumoso|g||
n-gpc-frontignac|Frontignac|s|n-gpc-vino-espumoso|g||
n-gpc-frureru|Frureru|s|n-v-manzana|g||
n-gpc-fruta-de-hueso|Fruta de hueso|c|n-produce|g||cortado
n-gpc-fruta-de-iv-gama|Fruta de IV gama|c|n-produce|g||
n-gpc-fruta-de-pepita|Fruta de pepita|c|n-produce|g||cortado
n-gpc-fruta-del-pan|Fruta del pan|t|n-gpc-otras-frutas|g||
n-gpc-fruta-sin-elaborar|Fruta sin elaborar|c|n-produce|g||
n-gpc-frutos-rojos-y-bayas|Frutos rojos y bayas|c|n-produce|g||cortado
n-gpc-frutos-secos-con-cascara|Frutos secos con cáscara|c|n-grocery|g||
n-gpc-frutos-secos-frescos|Frutos secos frescos|c|n-grocery|g||
n-gpc-fuji-and-mutants|Fuji and mutants|s|n-v-manzana|g||
n-gpc-fuji-fubrax|Fuji fubrax|s|n-v-manzana|g||
n-gpc-fujiip|Fujiip|s|n-v-manzana|g||
n-gpc-furmint|Furmint|s|n-gpc-vino-espumoso|g||
n-gpc-gaesdonker-renette|Gaesdonker renette|s|n-v-manzana|g||
n-gpc-gaglioppo|Gaglioppo|s|n-gpc-vino-espumoso|g||
n-gpc-gala-and-mutants|Gala and mutants|s|n-v-manzana|g||
n-gpc-gala-nowakowski|Gala nowakowski|s|n-v-manzana|g||
n-gpc-galaxy|Galaxy|s|n-v-manzana|g||
n-gpc-galbena-de-odobesti|Galbena de odobesti|s|n-gpc-vino-espumoso|g||
n-gpc-gale-gala-malaga|Gale gala (malaga)|s|n-v-manzana|g||
n-gpc-gamaret|Gamaret|s|n-gpc-vino-espumoso|g||
n-gpc-gamay|Gamay|s|n-gpc-vino-espumoso|g||
n-gpc-gamay-chardonnay-pinot-noir|Gamay/chardonnay/pinot noir|s|n-gpc-vino-espumoso|g||
n-gpc-gamay-merlot|Gamay/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-gamay-pinot-noir|Gamay/pinot noir|s|n-gpc-vino-espumoso|g||
n-gpc-garanoir|Garanoir|s|n-gpc-vino-espumoso|g||
n-gpc-garanoir-merlot|Garanoir/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-garcia|Garcia|s|n-v-manzana|g||
n-gpc-garganega|Garganega|s|n-gpc-vino-espumoso|g||
n-gpc-garganega-chardonnay|Garganega/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-garganega-chardonnay-tocai-trebbia|Garganega/chardonnay/tocai/trebbiano|s|n-gpc-vino-espumoso|g||
n-gpc-garganega-trebbiano|Garganega/trebbiano|s|n-gpc-vino-espumoso|g||
n-gpc-garnacha|Garnacha|s|n-gpc-vino-espumoso|g||
n-gpc-garnacha-blanca|Garnacha blanca|s|n-gpc-vino-espumoso|g||
n-gpc-garnacha-gris|Garnacha gris|s|n-gpc-vino-espumoso|g||
n-gpc-garnacha-pais|Garnacha país|s|n-gpc-vino-espumoso|g||
n-gpc-garnacha-peluda|Garnacha peluda|s|n-gpc-vino-espumoso|g||
n-gpc-garnacha-tinta|Garnacha tinta|s|n-gpc-vino-espumoso|g||
n-gpc-garras-de-pollo-elaboradas|Garras de pollo elaboradas|s|n-chicken|g||
n-gpc-gavi|Gavi|s|n-gpc-vino-espumoso|g||
n-gpc-geheimrat-dr-oldenburg-oldenburger|Geheimrat dr. oldenburg (oldenburger)|s|n-v-manzana|g||
n-gpc-geisenheim|Geisenheim|s|n-gpc-vino-espumoso|g||
n-gpc-gelatina-de-piel-de-burro|Gelatina de piel de burro|t|n-gpc-productos-de-origen-animal|g||elaborado
n-gpc-gelber-muskateller|Gelber muskateller|s|n-gpc-vino-espumoso|g||
n-gpc-gelria|Gelria|s|n-v-pera|g||
n-gpc-general-leclerc|General leclerc|s|n-v-pera|g||
n-gpc-gentile|Gentile|s|n-v-pera|g||
n-gpc-gewuerztraminer|Gewuerztraminer|s|n-gpc-vino-espumoso|g||
n-gpc-gewuerztraminer-kerner-pinot-blanc|Gewuerztraminer/kerner/pinot blanc/viognier|s|n-gpc-vino-espumoso|g||
n-gpc-gewuerztraminer-riesling|Gewuerztraminer/riesling|s|n-gpc-vino-espumoso|g||
n-gpc-gewuerztraminer-riesling-pinot-gri|Gewuerztraminer/riesling/pinot gris|s|n-gpc-vino-espumoso|g||
n-gpc-gewurzluiken|Gewurzluiken|s|n-v-manzana|g||
n-gpc-gieser-wildeman|Gieser wildeman|s|n-v-pera|g||
n-gpc-ginger-gold|Ginger gold|s|n-v-manzana|g||
n-gpc-ginseng|Ginseng|t|n-root|g||
n-gpc-giro|Giro|s|n-gpc-vino-espumoso|g||
n-gpc-glaseado-alimentario|Glaseado alimentario|t|n-gpc-salsas-untables-y-condimentos|g||ambiente
n-gpc-glockenapfel-weisser|Glockenapfel (weisser)|s|n-v-manzana|g||
n-gpc-glosan|Glosan|s|n-v-manzana|g||
n-gpc-gloster|Gloster|s|n-v-manzana|g||
n-gpc-godello|Godello|s|n-gpc-vino-espumoso|g||
n-gpc-goedhof-red-elstar-goedhof|Goedhof (red elstar goedhof)|s|n-v-manzana|g||
n-gpc-goldbohemia|Goldbohemia|s|n-v-manzana|g||
n-gpc-goldburger|Goldburger|s|n-gpc-vino-espumoso|g||
n-gpc-golden-delicious-and-mutants|Golden delicious and mutants|s|n-v-manzana|g||
n-gpc-golden-lasa|Golden lasa|s|n-v-manzana|g||
n-gpc-golden-mira|Golden mira|s|n-v-manzana|g||
n-gpc-golden-noble|Golden noble|s|n-v-manzana|g||
n-gpc-golden-parsi|Golden parsi|s|n-v-manzana|g||
n-gpc-golden-russet|Golden russet|s|n-v-manzana|g||
n-gpc-golden-russet-bosc|Golden russet bosc|s|n-v-pera|g||
n-gpc-golden-supreme|Golden supreme|s|n-v-manzana|g||
n-gpc-goldlane|Goldlane|s|n-v-manzana|g||
n-gpc-goldmuskateller|Goldmuskateller|s|n-gpc-vino-espumoso|g||
n-gpc-goldrush|Goldrush|s|n-v-manzana|g||
n-gpc-goldstar|Goldstar|s|n-v-manzana|g||
n-gpc-gorgollasa|Gorgollasa|s|n-gpc-vino-espumoso|g||
n-gpc-goruli-mtsvane|Goruli mtsvane|s|n-gpc-vino-espumoso|g||
n-gpc-graciano|Graciano|s|n-gpc-vino-espumoso|g||
n-gpc-graciano-cabernet-sauvignon|Graciano/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-graefin-gepa-early-desire|Graefin gepa (early desire)|s|n-v-pera|g||
n-gpc-granadilla|Granadilla|t|n-fruit|g||
n-gpc-grand-champion|Grand champion|s|n-v-pera|g||
n-gpc-granny-smith|Granny smith|s|n-v-manzana|g||
n-gpc-granos-y-harinas|Granos y harinas|c|n-pulses|g||
n-gpc-grasa-abdominal-de-pavo|Grasa abdominal de pavo|s|n-turkey|g||
n-gpc-grasa-abdominal-de-pollo|Grasa abdominal de pollo|s|n-chicken|g||
n-gpc-grasa-animal|Grasa animal|t|n-gpc-grasas-comestibles|g||ambiente,refrigerado
n-gpc-grasa-de-cotnari|Grasa de cotnari|s|n-gpc-vino-espumoso|g||
n-gpc-grasa-mixta|Grasa mixta|t|n-gpc-grasas-comestibles|g||ambiente,refrigerado
n-gpc-grasa-vegetal|Grasa vegetal|t|n-gpc-grasas-comestibles|g||ambiente,refrigerado
n-gpc-grasas-comestibles|Grasas comestibles|c|n-oils|g||
n-gpc-graue-herbstrenette-grijze-rabouwe|Graue herbstrenette (grijze rabouwe)|s|n-v-manzana|g||
n-gpc-gravenstein-rouge|Gravenstein rouge|s|n-v-manzana|g||
n-gpc-gravensteiner|Gravensteiner|s|n-v-manzana|g||
n-gpc-grecanico-dorato|Grecanico dorato|s|n-gpc-vino-espumoso|g||
n-gpc-grechetto|Grechetto|s|n-gpc-vino-espumoso|g||
n-gpc-grechetto-trebbiano|Grechetto/trebbiano|s|n-gpc-vino-espumoso|g||
n-gpc-greco|Greco|s|n-gpc-vino-espumoso|g||
n-gpc-greco-bianco|Greco bianco|s|n-gpc-vino-espumoso|g||
n-gpc-greensleeves|Greensleeves|s|n-v-manzana|g||
n-gpc-grenache-blanc-clairette-bourboule|Grenache blanc/clairette/bourboulenc/roussanne/viognier|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-blanc-marsanne-roussanne|Grenache blanc/marsanne/roussanne|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-cabernet-sauvignon|Grenache/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-cabernet-sauvignon-merlot|Grenache/cabernet sauvignon/merlot/carignan|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-cabernet-sauvignon-tempra|Grenache/cabernet sauvignon/tempranillo|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-carignan-cabernet-sauvign|Grenache/carignan/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-carignan-cabernet-sauvign-2|Grenache/carignan/cabernet sauvignon/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-cinsault|Grenache/cinsault|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-cinsault-syrah|Grenache/cinsault/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-mourvedre|Grenache/mourvedre|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-mourvedre-syrah|Grenache/mourvedre/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-syrah|Grenache/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-syrah-mourvedre|Grenache/syrah/mourvedre|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-tempranillo|Grenache/tempranillo|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-tibouren-mourvedre|Grenache/tibouren/mourvedre|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-tibouren-mourvedre-cinsau|Grenache/tibouren/mourvedre/cinsault|s|n-gpc-vino-espumoso|g||
n-gpc-grenache-tibouren-mourvedre-cinsau-2|Grenache/tibouren/mourvedre/cinsault/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-grenachee-merlot|Grenachee/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-grenadier|Grenadier|s|n-v-manzana|g||
n-gpc-grignolino|Grignolino|s|n-gpc-vino-espumoso|g||
n-gpc-grillo|Grillo|s|n-gpc-vino-espumoso|g||
n-gpc-grolleau|Grolleau|s|n-gpc-vino-espumoso|g||
n-gpc-groninger-kroon|Groninger kroon|s|n-v-manzana|g||
n-gpc-gronsvelder-klumpke|Gronsvelder klumpke|s|n-v-manzana|g||
n-gpc-groppello|Groppello|s|n-gpc-vino-espumoso|g||
n-gpc-gros-manseng|Gros manseng|s|n-gpc-vino-espumoso|g||
n-gpc-grosella-negra|Grosella negra|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-grover|Grover|s|n-v-pera|g||
n-gpc-gruener-silvaner|Gruener silvaner|s|n-gpc-vino-espumoso|g||
n-gpc-gruener-veltliner|Gruener veltliner|s|n-gpc-vino-espumoso|g||
n-gpc-grypy|Grypy|s|n-v-pera|g||
n-gpc-guarnicion-fresca|Guarnición fresca|c|n-produce|g||
n-gpc-guayaba|Guayaba|t|n-gpc-otras-frutas|g||
n-gpc-guinda|Guinda|t|n-gpc-fruta-de-hueso|g||
n-gpc-guisante-alado|Guisante alado|t|n-gpc-guisantes-con-vaina|g||
n-gpc-guisantes-con-vaina|Guisantes con vaina|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-guldborg|Guldborg|s|n-v-manzana|g||
n-gpc-gutedel|Gutedel|s|n-gpc-vino-espumoso|g||
n-gpc-gyllenkroks-astrakan|Gyllenkroks astrakan|s|n-v-manzana|g||
n-gpc-haba|Haba|t|n-gpc-judias-con-vaina|g||
n-gpc-haba-jack|Haba jack|t|n-gpc-judias-con-vaina|g||
n-gpc-haralson|Haralson|s|n-v-manzana|g||
n-gpc-harmonie|Harmonie|s|n-v-manzana|g||
n-gpc-harrow-delight|Harrow delight|s|n-v-pera|g||
n-gpc-harrow-sweet|Harrow sweet|s|n-v-pera|g||
n-gpc-harslevelu|Harslevelu|s|n-gpc-vino-espumoso|g||
n-gpc-heisei-fuji-beni-shogun|Heisei-fuji (beni shogun)|s|n-v-manzana|g||
n-gpc-helecho-canela|Helecho canela|t|n-gpc-helechos|g||
n-gpc-helecho-real|Helecho real|t|n-gpc-helechos|g||
n-gpc-helecho-tierno|Helecho tierno|t|n-gpc-helechos|g||
n-gpc-helechos|Helechos|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-herenperen|Herenperen|s|n-v-pera|g||
n-gpc-hibrido-de-baya|Híbrido de baya|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-hibrido-de-hueso|Híbrido de hueso|t|n-gpc-fruta-de-hueso|g||
n-gpc-hidala|Hidala|s|n-v-manzana|g||
n-gpc-hierba-luisa|Hierba luisa|t|n-gpc-hierbas-frescas|g||
n-gpc-hierbas-especias-y-extractos|Hierbas, especias y extractos|c|n-grocery|g||
n-gpc-hierbas-frescas|Hierbas frescas|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-hierbas-y-especias|Hierbas y especias|t|n-gpc-hierbas-especias-y-extractos|g||ambiente,congelado,refrigerado
n-gpc-higados-de-pavo|Hígados de pavo|s|n-turkey|g||
n-gpc-higados-de-pollo|Hígados de pollo|s|n-chicken|g||
n-gpc-hinojo-de-bulbo|Hinojo de bulbo|t|n-gpc-hortalizas-de-tallo|g||
n-gpc-hinojo-dulce|Hinojo dulce|t|n-gpc-hierbas-frescas|g||
n-gpc-hisopo|Hisopo|t|n-gpc-hierbas-frescas|g||
n-gpc-hoja-de-apio|Hoja de apio|t|n-gpc-hierbas-frescas|g||
n-gpc-hoja-de-ensalada-entera|Hoja de ensalada entera|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-hoja-de-ensalada-suelta|Hoja de ensalada suelta|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-hoja-de-mostaza|Hoja de mostaza|t|n-gpc-coles-y-brasicas|g||
n-gpc-hoja-de-platano|Hoja de plátano|t|n-gpc-guarnicion-fresca|g||
n-gpc-hoja-santa|Hoja santa|t|n-gpc-hierbas-frescas|g||
n-gpc-hojas-de-achicoria|Hojas de achicoria|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-holstein-and-mutants-holsteiner-co|Holstein and mutants (holsteiner cox)|s|n-v-manzana|g||
n-gpc-holstein-rouge|Holstein rouge|s|n-v-manzana|g||
n-gpc-hondarrabi-zuri|Hondarrabi zuri|s|n-gpc-vino-espumoso|g||
n-gpc-honey-gold|Honey gold|s|n-v-manzana|g||
n-gpc-honeycrisp|Honeycrisp|s|n-v-manzana|g||
n-gpc-horneburger-pfannkuchen|Horneburger pfannkuchen|s|n-v-manzana|g||
n-gpc-hortalizas-de-bulbo|Hortalizas de bulbo|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-hortalizas-de-tallo|Hortalizas de tallo|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-howgate-wonder|Howgate wonder|s|n-v-manzana|g||
n-gpc-huaguan|Huaguan|s|n-v-manzana|g||
n-gpc-huesos-y-caldo|Huesos y caldo|t|n-gpc-hierbas-especias-y-extractos|g||ambiente,congelado,refrigerado
n-gpc-huevo-cocido|Huevo cocido|t|n-grocery|g||
n-gpc-huevo-con-cascara|Huevo con cáscara|t|n-grocery|g||
n-gpc-huevo-con-cascara-de-clase-b|Huevo con cáscara de clase B|t|n-grocery|g||
n-gpc-huevo-con-cascara-sin-clasificar|Huevo con cáscara sin clasificar|t|n-grocery|g||
n-gpc-humagne-rouge|Humagne rouge|s|n-gpc-vino-espumoso|g||
n-gpc-huxelrebe|Huxelrebe|s|n-gpc-vino-espumoso|g||
n-gpc-huxelrebe-silvaner|Huxelrebe silvaner|s|n-gpc-vino-espumoso|g||
n-gpc-idared|Idared|s|n-v-manzana|g||
n-gpc-iedzenu|Iedzēnu|s|n-v-manzana|g||
n-gpc-ildrod-pigeon|Ildrod pigeon|s|n-v-manzana|g||
n-gpc-ilga|Ilga|s|n-v-manzana|g||
n-gpc-incrocio-manzoni|Incrocio manzoni|s|n-gpc-vino-espumoso|g||
n-gpc-inferno|Inferno|s|n-gpc-vino-espumoso|g||
n-gpc-infusion-concentrada|Infusión concentrada|t|n-gpc-te-e-infusiones|g||
n-gpc-infusion-en-capsulas|Infusión en cápsulas|t|n-gpc-te-e-infusiones|g||
n-gpc-infusion-lista-para-beber|Infusión lista para beber|t|n-gpc-te-e-infusiones|g||
n-gpc-infusion-soluble|Infusión soluble|t|n-gpc-te-e-infusiones|g||
n-gpc-ingrediente-para-sopa|Ingrediente para sopa|t|n-gpc-sopas-preparadas|g||ambiente,congelado,refrigerado
n-gpc-ingredientes-de-reposteria|Ingredientes de repostería|t|n-gpc-preparados-e-ingredientes-de-repos|g||ambiente,congelado,refrigerado
n-gpc-ingrid-marie|Ingrid marie|s|n-v-manzana|g||
n-gpc-insectos|Insectos|t|n-gpc-insectos-comestibles|g||elaborado,sin elaborar
n-gpc-insectos-comestibles|Insectos comestibles|c|n-meat|g||
n-gpc-insectos-variados|Insectos variados|t|n-gpc-insectos-comestibles|g||elaborado,sin elaborar
n-gpc-insumos-de-elaboracion|Insumos de elaboración|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-intestinos-de-pavo|Intestinos de pavo|s|n-turkey|g||
n-gpc-invertebrados-marinos|Invertebrados marinos|t|n-cephalopod|g||ambiente,congelado,elaborado,refrigerado,sin elaborar
n-gpc-inzolia|Inzolia|s|n-gpc-vino-espumoso|g||
n-gpc-inzolia-chardonnay|Inzolia/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-iron-variety|Iron (variety)|s|n-v-manzana|g||
n-gpc-irsai-oliver|Irsai oliver|s|n-gpc-vino-espumoso|g||
n-gpc-isbranica|Isbranica|s|n-v-manzana|g||
n-gpc-jacquere|Jacquere|s|n-gpc-vino-espumoso|g||
n-gpc-jacques-lebel|Jacques lebel|s|n-v-manzana|g||
n-gpc-jahong|Jahong|s|n-v-manzana|g||
n-gpc-jakob-fischer|Jakob fischer|s|n-v-manzana|g||
n-gpc-jamba-69|Jamba 69|s|n-v-manzana|g||
n-gpc-jambolan|Jambolán|t|n-gpc-otras-frutas|g||
n-gpc-james-grieve-and-mutants|James grieve and mutants|s|n-v-manzana|g||
n-gpc-jamon-fresco-contra|Jamón fresco, contra|s|n-pork|g||
n-gpc-jamon-fresco-de-corte-corto-tipo-1|Jamón fresco de corte corto, tipo 1|s|n-pork|g||
n-gpc-jamon-fresco-de-corte-corto-tipo-2|Jamón fresco de corte corto, tipo 2|s|n-pork|g||
n-gpc-jamon-fresco-de-corte-corto-tipo-3|Jamón fresco de corte corto, tipo 3|s|n-pork|g||
n-gpc-jamon-fresco-de-corte-largo-deshue|Jamón fresco de corte largo deshuesado|s|n-pork|g||
n-gpc-jamon-fresco-de-corte-largo-tipo-1|Jamón fresco de corte largo, tipo 1|s|n-pork|g||
n-gpc-jamon-fresco-de-corte-largo-tipo-2|Jamón fresco de corte largo, tipo 2|s|n-pork|g||
n-gpc-jamon-fresco-de-corte-largo-tipo-3|Jamón fresco de corte largo, tipo 3|s|n-pork|g||
n-gpc-jamon-fresco-despiezado-en-3|Jamón fresco despiezado en 3|s|n-pork|g||
n-gpc-jamon-fresco-despiezado-en-4|Jamón fresco despiezado en 4|s|n-pork|g||
n-gpc-jamon-fresco-despiezado-en-5|Jamón fresco despiezado en 5|s|n-pork|g||
n-gpc-jamon-fresco-despiezado-en-6|Jamón fresco despiezado en 6|s|n-pork|g||
n-gpc-jamon-fresco-punta-de-babilla|Jamón fresco, punta de babilla|s|n-pork|g||
n-gpc-jamon-fresco-redondo|Jamón fresco, redondo|s|n-pork|g||
n-gpc-jamon-fresco-tapa|Jamón fresco, tapa|s|n-pork|g||
n-gpc-jamoncito-de-pavo|Jamoncito de pavo|s|n-turkey|g||
n-gpc-jamoncito-de-pavo-deshuesado-sin-t|Jamoncito de pavo deshuesado sin tendón|s|n-turkey|g||
n-gpc-jamoncito-de-pavo-deshuesado-tendo|Jamoncito de pavo deshuesado, tendón parcialmente retirado|s|n-turkey|g||
n-gpc-jamoncito-de-pollo|Jamoncito de pollo|s|n-chicken|g||
n-gpc-jamoncito-de-pollo-de-corte-sesgad|Jamoncito de pollo de corte sesgado|s|n-chicken|g||
n-gpc-jamoncito-y-contramuslo-de-pollo-d|Jamoncito y contramuslo de pollo de corte largo con espalda|s|n-chicken|g||
n-gpc-jampal|Jampal|s|n-gpc-vino-espumoso|g||
n-gpc-jan-steen|Jan steen|s|n-v-manzana|g||
n-gpc-jarka|Jarka|s|n-v-manzana|g||
n-gpc-jarrete-de-cabrito|Jarrete de cabrito|s|n-gpc-cabra|g||
n-gpc-jarrete-trasero-de-cordero|Jarrete trasero de cordero|s|n-gpc-cordero|g||
n-gpc-jasappel|Jasappel|s|n-v-manzana|g||
n-gpc-jeanne-d-arc|Jeanne d'arc|s|n-v-pera|g||
n-gpc-jeromine|Jeromine|s|n-v-manzana|g||
n-gpc-jerseymac|Jerseymac|s|n-v-manzana|g||
n-gpc-jester|Jester|s|n-v-manzana|g||
n-gpc-jicama|Jícama|t|n-root|g||
n-gpc-joburn|Joburn|s|n-v-manzana|g||
n-gpc-johannisberg|Johannisberg|s|n-gpc-vino-espumoso|g||
n-gpc-jomar|Jomar|s|n-v-manzana|g||
n-gpc-jomured|Jomured|s|n-v-manzana|g||
n-gpc-jonabel|Jonabel|s|n-v-manzana|g||
n-gpc-jonabres|Jonabres|s|n-v-manzana|g||
n-gpc-jonagold-and-mutants|Jonagold and mutants|s|n-v-manzana|g||
n-gpc-jonagold-boerekamp|Jonagold boerekamp|s|n-v-manzana|g||
n-gpc-jonagored-and-mutants|Jonagored and mutants|s|n-v-manzana|g||
n-gpc-jonagored-supra|Jonagored supra|s|n-v-manzana|g||
n-gpc-jonalord|Jonalord|s|n-v-manzana|g||
n-gpc-jonamac|Jonamac|s|n-v-manzana|g||
n-gpc-jonathan|Jonathan|s|n-v-manzana|g||
n-gpc-jonaveld|Jonaveld|s|n-v-manzana|g||
n-gpc-jored-nicolai-s-king-jonagold|Jored (nicolai's king jonagold)|s|n-v-manzana|g||
n-gpc-jos-musch|Jos musch|s|n-v-manzana|g||
n-gpc-josegold|Josegold|s|n-v-manzana|g||
n-gpc-josephine-de-malines|Josephine de malines|s|n-v-pera|g||
n-gpc-josta|Josta|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-judia-alada|Judía alada|t|n-gpc-judias-con-vaina|g||
n-gpc-judia-azuki|Judía azuki|t|n-gpc-judias-con-vaina|g||
n-gpc-judia-carilla|Judía carilla|t|n-gpc-guisantes-con-vaina|g||
n-gpc-judia-de-enrame|Judía de enrame|t|n-gpc-judias-con-vaina|g||
n-gpc-judia-de-lima|Judía de Lima|t|n-gpc-judias-con-vaina|g||
n-gpc-judia-esparrago|Judía espárrago|t|n-gpc-judias-con-vaina|g||
n-gpc-judia-verde|Judía verde|t|n-gpc-judias-con-vaina|g||
n-gpc-judias-con-vaina|Judías con vaina|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-juhfark|Juhfark|s|n-gpc-vino-espumoso|g||
n-gpc-jules-d-airolles|Jules d'airolles|s|n-v-pera|g||
n-gpc-juliet|Juliet|s|n-v-manzana|g||
n-gpc-jupiter|Jupiter|s|n-v-manzana|g||
n-gpc-jut|Jut|s|n-v-pera|g||
n-gpc-kabinett|Kabinett|s|n-gpc-vino-espumoso|g||
n-gpc-kadarka|Kadarka|s|n-gpc-vino-espumoso|g||
n-gpc-kai-lan|Kai-lan|t|n-gpc-coles-y-brasicas|g||
n-gpc-kaiser-wilhelm|Kaiser wilhelm|s|n-v-manzana|g||
n-gpc-kakhuri-mtsvane|Kakhuri mtsvane|s|n-gpc-vino-espumoso|g||
n-gpc-kalecik-karasi|Kalecik karasi|s|n-gpc-vino-espumoso|g||
n-gpc-kangun|Kangun|s|n-gpc-vino-espumoso|g||
n-gpc-karin-schneider-rod-ingrid-marie|Karin schneider (rod ingrid marie)|s|n-v-manzana|g||
n-gpc-karmijn-de-sonnaville|Karmijn de sonnaville|s|n-v-manzana|g||
n-gpc-karmozijn|Karmozijn|s|n-v-pera|g||
n-gpc-katja|Katja|s|n-v-manzana|g||
n-gpc-kekfrankos|Kekfrankos|s|n-gpc-vino-espumoso|g||
n-gpc-keknyelu|Keknyelu|s|n-gpc-vino-espumoso|g||
n-gpc-kent|Kent|s|n-v-manzana|g||
n-gpc-kerner|Kerner|s|n-gpc-vino-espumoso|g||
n-gpc-kerner-scheurebe|Kerner/scheurebe|s|n-gpc-vino-espumoso|g||
n-gpc-kesterens-wijnzuur|Kesterens wijnzuur|s|n-v-manzana|g||
n-gpc-keuleman|Keuleman|s|n-v-manzana|g||
n-gpc-khikhvi|Khikhvi|s|n-gpc-vino-espumoso|g||
n-gpc-kidd-s-orange-red|Kidd's orange red|s|n-v-manzana|g||
n-gpc-kieffer|Kieffer|s|n-v-pera|g||
n-gpc-kim|Kim|s|n-v-manzana|g||
n-gpc-king-jonagold|King jonagold|s|n-v-manzana|g||
n-gpc-king-of-the-pippins-golden-pearmai|King of the pippins (golden pearmain)|s|n-v-manzana|g||
n-gpc-kiralyleanyka|Kiralyleanyka|s|n-gpc-vino-espumoso|g||
n-gpc-kisi|Kisi|s|n-gpc-vino-espumoso|g||
n-gpc-kit-de-aromatizacion|Kit de aromatización|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-kit-de-elaboracion|Kit de elaboración|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-kiwino|Kiwiño|t|n-v-kiwi|g||
n-gpc-kizuri|Kizuri|s|n-v-manzana|g||
n-gpc-klapa-milule|Klapa mīlule|s|n-v-pera|g||
n-gpc-kleipeer|Kleipeer|s|n-v-pera|g||
n-gpc-klevner|Klevner|s|n-gpc-vino-espumoso|g||
n-gpc-klingelberger|Klingelberger|s|n-gpc-vino-espumoso|g||
n-gpc-klingelberger-riesling|Klingelberger riesling|s|n-gpc-vino-espumoso|g||
n-gpc-koeniglicher-kurzstiel|Koeniglicher kurzstiel|s|n-v-manzana|g||
n-gpc-koit|Koit|s|n-v-manzana|g||
n-gpc-koningszuur-engelse-bellefleur|Koningszuur (engelse bellefleur)|s|n-v-manzana|g||
n-gpc-korallo|Korallo|s|n-v-manzana|g||
n-gpc-korem-isola-nuraghi|Korem isola nuraghi|s|n-gpc-vino-espumoso|g||
n-gpc-koricnoje-novoje|Koričnoje novoje|s|n-v-manzana|g||
n-gpc-koshu|Koshu|s|n-gpc-vino-espumoso|g||
n-gpc-kotsifali|Kotsifali|s|n-gpc-vino-espumoso|g||
n-gpc-kovagenkovskoje|Kovaĝenkovskoje|s|n-v-manzana|g||
n-gpc-krameri-tuvioun|Krameri tuvioun|s|n-v-manzana|g||
n-gpc-kruegers-dickstiel-celler-dickstie|Kruegers dickstiel (celler dickstiel)|s|n-v-manzana|g||
n-gpc-kruidenierspeer|Kruidenierspeer|s|n-v-pera|g||
n-gpc-kulikovskoje|Kulikovskoje|s|n-v-manzana|g||
n-gpc-kumquat|Kumquat|t|n-gpc-citricos|g||
n-gpc-l-acadie-blanc|L'acadie blanc|s|n-gpc-vino-espumoso|g||
n-gpc-lacrima|Lacrima|s|n-gpc-vino-espumoso|g||
n-gpc-lacrima-christi|Lacrima christi|s|n-gpc-vino-espumoso|g||
n-gpc-lady|Lady|s|n-v-manzana|g||
n-gpc-lady-naomi|Lady naomi|s|n-v-pera|g||
n-gpc-lady-williams|Lady williams|s|n-v-manzana|g||
n-gpc-lagrein|Lagrein|s|n-gpc-vino-espumoso|g||
n-gpc-lagrein-schiava-teroldego|Lagrein/schiava/teroldego|s|n-gpc-vino-espumoso|g||
n-gpc-lambia|Lambia|s|n-gpc-vino-espumoso|g||
n-gpc-lambrusco|Lambrusco|s|n-gpc-vino-espumoso|g||
n-gpc-lambrusco-di-emilia|Lambrusco di emilia|s|n-gpc-vino-espumoso|g||
n-gpc-lambrusco-di-sorbara|Lambrusco di sorbara|s|n-gpc-vino-espumoso|g||
n-gpc-lambrusco-grasparossa|Lambrusco grasparossa|s|n-gpc-vino-espumoso|g||
n-gpc-lambrusco-maestri|Lambrusco maestri|s|n-gpc-vino-espumoso|g||
n-gpc-lambrusco-marani|Lambrusco marani|s|n-gpc-vino-espumoso|g||
n-gpc-lambrusco-salamino|Lambrusco salamino|s|n-gpc-vino-espumoso|g||
n-gpc-landsberger-renette|Landsberger renette|s|n-v-manzana|g||
n-gpc-lane-s-prince-albert|Lane's prince albert|s|n-v-manzana|g||
n-gpc-lavanda-de-mar|Lavanda de mar|t|n-gpc-verduras-marinas|g||
n-gpc-laxton-s-superb|Laxton's superb|s|n-v-manzana|g||
n-gpc-laxtons-fortune|Laxtons fortune|s|n-v-manzana|g||
n-gpc-le-cure-pastorenbirne|Le cure (pastorenbirne)|s|n-v-pera|g||
n-gpc-leanyka|Leanyka|s|n-gpc-vino-espumoso|g||
n-gpc-leche-infantil|Leche infantil|t|n-gpc-alimentacion-y-bebidas-infantiles|g||ambiente
n-gpc-lechuga-de-cogollo|Lechuga de cogollo|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-lechuga-de-hoja-suelta|Lechuga de hoja suelta|t|n-vegetable|g||
n-gpc-lechuga-de-tallo|Lechuga de tallo|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-lechuga-esparrago|Lechuga espárrago|t|n-vegetable|g||
n-gpc-lechuga-romana|Lechuga romana|t|n-vegetable|g||
n-gpc-lectier|Lectier|s|n-v-pera|g||
n-gpc-lemoen|Lemoen|s|n-v-manzana|g||
n-gpc-lena|Lena|s|n-v-manzana|g||
n-gpc-leon-millot|Leon millot|s|n-gpc-vino-espumoso|g||
n-gpc-leonardeta|Leonardeta|s|n-v-pera|g||
n-gpc-lerates|Lerates|s|n-v-manzana|g||
n-gpc-levistico|Levístico|t|n-gpc-hierbas-frescas|g||
n-gpc-liatiko|Liatiko|s|n-gpc-vino-espumoso|g||
n-gpc-libelulas|Libélulas|t|n-gpc-insectos-comestibles|g||elaborado,sin elaborar
n-gpc-liberty|Liberty|s|n-v-manzana|g||
n-gpc-lichi|Lichi|t|n-gpc-otras-frutas|g||
n-gpc-liebre|Liebre|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-ligol|Ligol|s|n-v-manzana|g||
n-gpc-lima-india|Lima india|t|n-gpc-citricos|g||
n-gpc-lima-mexicana|Lima mexicana|t|n-gpc-citricos|g||
n-gpc-limburgse-bellefleur|Limburgse bellefleur|s|n-v-manzana|g||
n-gpc-limelight|Limelight|s|n-v-manzana|g||
n-gpc-limequat|Limequat|t|n-gpc-citricos|g||
n-gpc-limniona|Limniona|s|n-gpc-vino-espumoso|g||
n-gpc-limonera|Limonera|s|n-v-pera|g||
n-gpc-listan-blanco|Listán blanco|s|n-gpc-vino-espumoso|g||
n-gpc-listan-negro|Listán negro|s|n-gpc-vino-espumoso|g||
n-gpc-listan-prieto|Listán prieto|s|n-gpc-vino-espumoso|g||
n-gpc-lizzy|Lizzy|s|n-v-manzana|g||
n-gpc-llama|Llama|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-lobo|Lobo|s|n-v-manzana|g||
n-gpc-lochbuie-red-braeburn-turners-red|Lochbuie red braeburn (turners red)|s|n-v-manzana|g||
n-gpc-lodel|Lodel|s|n-v-manzana|g||
n-gpc-lollo-bionda|Lollo bionda|t|n-vegetable|g||
n-gpc-lollo-rosso|Lollo rosso|t|n-vegetable|g||
n-gpc-lombacad|Lombacad|s|n-v-pera|g||
n-gpc-lombarts-calville-and-mutants|Lombarts calville and mutants|s|n-v-manzana|g||
n-gpc-lomo-alto-4-costillas|Lomo alto, 4 costillas|s|n-beef|g||
n-gpc-lomo-alto-5-costillas|Lomo alto, 5 costillas|s|n-beef|g||
n-gpc-lomo-alto-6-costillas|Lomo alto, 6 costillas|s|n-beef|g||
n-gpc-lomo-alto-7-costillas|Lomo alto, 7 costillas|s|n-beef|g||
n-gpc-lomo-alto-8-costillas|Lomo alto, 8 costillas|s|n-beef|g||
n-gpc-lomo-alto-deshuesado|Lomo alto deshuesado|s|n-beef|g||
n-gpc-lomo-alto-sin-tapa-5-costillas|Lomo alto sin tapa, 5 costillas|s|n-beef|g||
n-gpc-lomo-alto-sin-tapa-6-costillas|Lomo alto sin tapa, 6 costillas|s|n-beef|g||
n-gpc-lomo-alto-sin-tapa-7-costillas|Lomo alto sin tapa, 7 costillas|s|n-beef|g||
n-gpc-lomo-alto-sin-tapa-8-costillas|Lomo alto sin tapa, 8 costillas|s|n-beef|g||
n-gpc-lomo-alto-sin-tapa-9-costillas|Lomo alto sin tapa, 9 costillas|s|n-beef|g||
n-gpc-lomo-bajo-con-solomillo-1-costilla|Lomo bajo con solomillo, 1 costilla|s|n-beef|g||
n-gpc-lomo-bajo-con-solomillo-2-costilla|Lomo bajo con solomillo, 2 costillas|s|n-beef|g||
n-gpc-lomo-bajo-con-solomillo-3-costilla|Lomo bajo con solomillo, 3 costillas|s|n-beef|g||
n-gpc-lomo-bajo-con-solomillo-sin-costil|Lomo bajo con solomillo, sin costillas|s|n-beef|g||
n-gpc-lomo-bajo-de-vacuno-1-costilla|Lomo bajo de vacuno, 1 costilla|s|n-beef|g||
n-gpc-lomo-bajo-de-vacuno-2-costillas|Lomo bajo de vacuno, 2 costillas|s|n-beef|g||
n-gpc-lomo-bajo-de-vacuno-3-costillas|Lomo bajo de vacuno, 3 costillas|s|n-beef|g||
n-gpc-lomo-bajo-de-vacuno-sin-costillas|Lomo bajo de vacuno, sin costillas|s|n-beef|g||
n-gpc-lomo-de-cabrito|Lomo de cabrito|s|n-gpc-cabra|g||
n-gpc-lomo-de-cabrito-con-rinonada|Lomo de cabrito con riñonada|s|n-gpc-cabra|g||
n-gpc-lomo-de-cerdo-corte-central-10-cos|Lomo de cerdo, corte central, 10 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-corte-central-11-cos|Lomo de cerdo, corte central, 11 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-corte-central-12-cos|Lomo de cerdo, corte central, 12 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-corte-central-13-cos|Lomo de cerdo, corte central, 13 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-deshuesado-de-10-cos|Lomo de cerdo deshuesado de 10 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-deshuesado-de-11-cos|Lomo de cerdo deshuesado de 11 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-deshuesado-de-12-cos|Lomo de cerdo deshuesado de 12 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-deshuesado-de-13-cos|Lomo de cerdo deshuesado de 13 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-largo-10-costillas|Lomo de cerdo largo, 10 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-largo-11-costillas|Lomo de cerdo largo, 11 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-largo-12-costillas|Lomo de cerdo largo, 12 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-largo-13-costillas|Lomo de cerdo largo, 13 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-largo-despiezado-en-|Lomo de cerdo largo despiezado en 4|s|n-pork|g||
n-gpc-lomo-de-cerdo-largo-sin-aguja-10-c|Lomo de cerdo largo sin aguja, 10 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-largo-sin-aguja-11-c|Lomo de cerdo largo sin aguja, 11 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-largo-sin-aguja-12-c|Lomo de cerdo largo sin aguja, 12 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-largo-sin-aguja-13-c|Lomo de cerdo largo sin aguja, 13 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-semideshuesado-corte|Lomo de cerdo semideshuesado, corte central, 10 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-semideshuesado-corte-2|Lomo de cerdo semideshuesado, corte central, 11 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-semideshuesado-corte-3|Lomo de cerdo semideshuesado, corte central, 12 costillas|s|n-pork|g||
n-gpc-lomo-de-cerdo-semideshuesado-corte-4|Lomo de cerdo semideshuesado, corte central, 13 costillas|s|n-pork|g||
n-gpc-lomo-de-cordero-6-costillas|Lomo de cordero, 6 costillas|s|n-gpc-cordero|g||
n-gpc-lomo-de-cordero-7-costillas|Lomo de cordero, 7 costillas|s|n-gpc-cordero|g||
n-gpc-lomo-de-cordero-8-costillas|Lomo de cordero, 8 costillas|s|n-gpc-cordero|g||
n-gpc-lomo-de-cordero-9-costillas|Lomo de cordero, 9 costillas|s|n-gpc-cordero|g||
n-gpc-lomo-de-cordero-con-rinonada-6-cos|Lomo de cordero con riñonada, 6 costillas|s|n-gpc-cordero|g||
n-gpc-lomo-de-cordero-con-rinonada-7-cos|Lomo de cordero con riñonada, 7 costillas|s|n-gpc-cordero|g||
n-gpc-lomo-de-cordero-con-rinonada-8-cos|Lomo de cordero con riñonada, 8 costillas|s|n-gpc-cordero|g||
n-gpc-lomo-de-cordero-con-rinonada-9-cos|Lomo de cordero con riñonada, 9 costillas|s|n-gpc-cordero|g||
n-gpc-lomo-limpio-de-cabrito|Lomo limpio de cabrito|s|n-gpc-cabra|g||
n-gpc-lomo-limpio-de-cordero-corto|Lomo limpio de cordero corto|s|n-gpc-cordero|g||
n-gpc-lomo-limpio-de-cordero-largo|Lomo limpio de cordero largo|s|n-gpc-cordero|g||
n-gpc-longan|Longan|t|n-gpc-otras-frutas|g||
n-gpc-lord-derby|Lord derby|s|n-v-manzana|g||
n-gpc-lord-lambourne|Lord lambourne|s|n-v-manzana|g||
n-gpc-louis-bonne-of-jersey|Louis bonne of jersey|s|n-v-pera|g||
n-gpc-loureiro|Loureiro|s|n-gpc-vino-espumoso|g||
n-gpc-luckystar|Luckystar|s|n-v-manzana|g||
n-gpc-lulo|Lulo|t|n-gpc-solanaceas-y-otras|g||
n-gpc-luna|Luna|s|n-v-manzana|g||
n-gpc-luntersche-pippeling|Luntersche pippeling|s|n-v-manzana|g||
n-gpc-luresweet|Luresweet|s|n-v-manzana|g||
n-gpc-luscious|Luscious|s|n-v-pera|g||
n-gpc-luxemburger-renette|Luxemburger renette|s|n-v-manzana|g||
n-gpc-maagdenpeer|Maagdenpeer|s|n-v-pera|g||
n-gpc-macabeo|Macabeo|s|n-gpc-vino-espumoso|g||
n-gpc-macabeo-xarel-lo-parellada-chardon|Macabeo/xarel-lo/parellada/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-macoun|Macoun|s|n-v-manzana|g||
n-gpc-madrono|Madroño|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-magliocco|Magliocco|s|n-gpc-vino-espumoso|g||
n-gpc-mahana-red|Mahana red|s|n-v-manzana|g||
n-gpc-maigold|Maigold|s|n-v-manzana|g||
n-gpc-maiz-dulce|Maíz dulce|t|n-gpc-otras-verduras|g||
n-gpc-majarca|Majarca|s|n-gpc-vino-espumoso|g||
n-gpc-malagousia|Malagousia|s|n-gpc-vino-espumoso|g||
n-gpc-malanga-blanca|Malanga blanca|t|n-root|g||
n-gpc-malanga-lila|Malanga lila|t|n-root|g||
n-gpc-malbec|Malbec|s|n-gpc-vino-espumoso|g||
n-gpc-malbec-barbera|Malbec/barbera|s|n-gpc-vino-espumoso|g||
n-gpc-malbec-cabernet-sauvignon|Malbec/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-malbec-cabernet-sauvignon-petit-ve|Malbec/cabernet sauvignon/petit verdot|s|n-gpc-vino-espumoso|g||
n-gpc-malbec-sangiovese|Malbec/sangiovese|s|n-gpc-vino-espumoso|g||
n-gpc-malvar|Malvar|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia|Malvasía|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-de-sitges|Malvasía de Sitges|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-del-lazio|Malvasia del lazio|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-di-candia|Malvasia di candia|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-di-candia-aromatica|Malvasia di candia aromatica|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-di-schierano|Malvasia di schierano|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-nera|Malvasia nera|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-nera-negroamaro-primitivo|Malvasia nera/negroamaro/primitivo|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-rei|Malvasia rei|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-toscana|Malvasia toscana|s|n-gpc-vino-espumoso|g||
n-gpc-malvasia-trebbiano-verdicchio|Malvasia/trebbiano/verdicchio|s|n-gpc-vino-espumoso|g||
n-gpc-mamey|Mamey|t|n-v-zapote|g||
n-gpc-mandarina-hibrida|Mandarina híbrida|t|n-gpc-citricos|g||
n-gpc-mandarina-king|Mandarina king|t|n-gpc-citricos|g||
n-gpc-mandarina-mediterranea|Mandarina mediterránea|t|n-gpc-citricos|g||
n-gpc-mandilaria-mandilari|Mandilaria (mandilari)|s|n-gpc-vino-espumoso|g||
n-gpc-mandrolisai|Mandrolisai|s|n-gpc-vino-espumoso|g||
n-gpc-manitas-delanteras|Manitas delanteras|s|n-pork|g||
n-gpc-manitas-traseras|Manitas traseras|s|n-pork|g||
n-gpc-mantet|Mantet|s|n-v-manzana|g||
n-gpc-manto-negro-mantonegro|Manto negro (mantonegro)|s|n-gpc-vino-espumoso|g||
n-gpc-manzana-de-caramelo|Manzana de caramelo|t|n-d-aperitivo|g||
n-gpc-manzana-silvestre|Manzana silvestre|t|n-gpc-fruta-de-pepita|g||
n-gpc-maracuya-amarillo|Maracuyá amarillo|t|n-fruit|g||
n-gpc-maracuya-morado|Maracuyá morado|t|n-fruit|g||
n-gpc-marechal-foch|Marechal foch|s|n-gpc-vino-espumoso|g||
n-gpc-marguerite-marillat|Marguerite marillat|s|n-v-pera|g||
n-gpc-maria-gomez|Maria gomez|s|n-gpc-vino-espumoso|g||
n-gpc-maribelle|Maribelle|s|n-v-manzana|g||
n-gpc-mariposas-y-polillas|Mariposas y polillas|t|n-gpc-insectos-comestibles|g||elaborado,sin elaborar
n-gpc-mariri-red|Mariri red|s|n-v-manzana|g||
n-gpc-marquette|Marquette|s|n-gpc-vino-espumoso|g||
n-gpc-marsanne|Marsanne|s|n-gpc-vino-espumoso|g||
n-gpc-marsanne-petite-arvine|Marsanne/petite arvine|s|n-gpc-vino-espumoso|g||
n-gpc-marsanne-roussanne-viognier|Marsanne/roussanne/viognier|s|n-gpc-vino-espumoso|g||
n-gpc-marsanne-viognier|Marsanne/viognier|s|n-gpc-vino-espumoso|g||
n-gpc-marselan|Marselan|s|n-gpc-vino-espumoso|g||
n-gpc-masa-y-platos-de-masa|Masa y platos de masa|t|n-gpc-masas-y-elaborados-de-masa|g||ambiente,concentrado,congelado,listo para consumir,refrigerado
n-gpc-masas-y-elaborados-de-masa|Masas y elaborados de masa|c|n-grocery|g||
n-gpc-mashua|Mashua|t|n-root|g||
n-gpc-mastuerzo|Mastuerzo|t|n-gpc-hierbas-frescas|g||
n-gpc-maturana-blanca|Maturana blanca|s|n-gpc-vino-espumoso|g||
n-gpc-maturana-tinta|Maturana tinta|s|n-gpc-vino-espumoso|g||
n-gpc-mauzac|Mauzac|s|n-gpc-vino-espumoso|g||
n-gpc-maypole|Maypole|s|n-v-manzana|g||
n-gpc-mazuelo|Mazuelo|s|n-gpc-vino-espumoso|g||
n-gpc-mcintosh|Mcintosh|s|n-v-manzana|g||
n-gpc-mcintosh-imperial-all-red|Mcintosh imperial all red|s|n-v-manzana|g||
n-gpc-media-canal-de-bovino|Media canal de bovino|s|n-beef|g||
n-gpc-media-canal-de-cabrito|Media canal de cabrito|s|n-gpc-cabra|g||
n-gpc-media-canal-de-cerdo|Media canal de cerdo|s|n-pork|g||
n-gpc-media-canal-de-cerdo-despiezada-en|Media canal de cerdo despiezada en 3|s|n-pork|g||
n-gpc-media-canal-de-cerdo-despiezada-en-2|Media canal de cerdo despiezada en 3, limpieza especial|s|n-pork|g||
n-gpc-media-canal-de-cerdo-despiezada-en-3|Media canal de cerdo despiezada en 4, limpieza especial|s|n-pork|g||
n-gpc-media-canal-de-cordero|Media canal de cordero|s|n-gpc-cordero|g||
n-gpc-media-pechuga-de-pavo-con-hueso-es|Media pechuga de pavo con hueso, espalda y costillas|s|n-turkey|g||
n-gpc-media-pechuga-de-pavo-con-hueso-y-|Media pechuga de pavo con hueso y espalda, sin costillas|s|n-turkey|g||
n-gpc-media-pechuga-de-pavo-con-parte-de|Media pechuga de pavo con parte de espalda, costillas y primer segmento de ala deshuesado|s|n-turkey|g||
n-gpc-media-pechuga-de-pavo-con-parte-de-2|Media pechuga de pavo con parte de espalda, costillas y primer segmento de ala|s|n-turkey|g||
n-gpc-media-pechuga-de-pavo-con-parte-de-3|Media pechuga de pavo con parte de espalda, costillas y ala|s|n-turkey|g||
n-gpc-media-pechuga-de-pavo-deshuesada-c|Media pechuga de pavo deshuesada con solomillo|s|n-turkey|g||
n-gpc-media-pechuga-de-pavo-deshuesada-l|Media pechuga de pavo deshuesada, limpia de espalda, costilla y solomillo|s|n-turkey|g||
n-gpc-media-pechuga-de-pollo-con-hueso-c|Media pechuga de pollo con hueso, costillas y ala|s|n-chicken|g||
n-gpc-media-pechuga-de-pollo-con-hueso-y|Media pechuga de pollo con hueso y costillas|s|n-chicken|g||
n-gpc-media-pechuga-de-pollo-con-parte-d|Media pechuga de pollo con parte de espalda|s|n-chicken|g||
n-gpc-media-pechuga-de-pollo-deshuesada-|Media pechuga de pollo deshuesada, limpia de costilla|s|n-chicken|g||
n-gpc-media-pechuga-de-pollo-semideshues|Media pechuga de pollo semideshuesada con carne de costilla y primer segmento de ala|s|n-chicken|g||
n-gpc-meelis|Meelis|s|n-v-manzana|g||
n-gpc-meiprinses|Meiprinses|s|n-v-manzana|g||
n-gpc-mejorana|Mejorana|t|n-gpc-hierbas-frescas|g||
n-gpc-melba|Melba|s|n-v-manzana|g||
n-gpc-melisa|Melisa|t|n-gpc-hierbas-frescas|g||
n-gpc-melnik|Melnik|s|n-gpc-vino-espumoso|g||
n-gpc-melodie|Melodie|s|n-v-manzana|g||
n-gpc-melon-amargo|Melón amargo|t|n-gpc-cucurbitaceas-de-piel-tierna|g||
n-gpc-melon-cantalupo|Melón cantalupo|t|n-v-melon|g||
n-gpc-melon-cantalupo-liso|Melón cantalupo liso|t|n-v-melon|g||
n-gpc-melon-conomon|Melón conomon|t|n-v-melon|g||
n-gpc-melon-de-bourgogne|Melon de bourgogne|s|n-gpc-vino-espumoso|g||
n-gpc-melon-de-invierno|Melón de invierno|t|n-v-melon|g||
n-gpc-melrose|Melrose|s|n-v-manzana|g||
n-gpc-mencia|Mencía|s|n-gpc-vino-espumoso|g||
n-gpc-mencia-tempranillo|Mencia/tempranillo|s|n-gpc-vino-espumoso|g||
n-gpc-menta|Menta|t|n-gpc-hierbas-frescas|g||
n-gpc-meridian|Meridian|s|n-v-manzana|g||
n-gpc-merlot|Merlot|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-franc|Merlot/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-franc-cabernet-sau|Merlot/cabernet franc/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-franc-cabernet-sau-2|Merlot/cabernet franc/cabernet sauvignon/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-sauvignon|Merlot/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-sauvignon-cabernet|Merlot/cabernet sauvignon/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-sauvignon-cabernet-2|Merlot/cabernet sauvignon/cabernet franc/malbec/petit verdot|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-sauvignon-malbec|Merlot/cabernet sauvignon/malbec|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-sauvignon-petit-ve|Merlot/cabernet sauvignon/petit verdot|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-sauvignon-sangiove|Merlot/cabernet sauvignon/sangiovese|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-cabernet-sauvignon-temprani|Merlot/cabernet sauvignon/tempranillo/grenache|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-chasselas|Merlot/chasselas|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-gamay|Merlot/gamay|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-garanoir-gamaret-cabernet-f|Merlot/garanoir/gamaret/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-khorus|Merlot khorus|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-nero-d-avola|Merlot/nero d'avola|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-syrah|Merlot/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-merlot-tempranillo-grenache-cabern|Merlot/tempranillo/grenache/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-mermelada-y-confitura|Mermelada y confitura|t|n-gpc-untables-dulces|g||refrigerado
n-gpc-merseguera|Merseguera|s|n-gpc-vino-espumoso|g||
n-gpc-merwah|Merwah|s|n-gpc-vino-espumoso|g||
n-gpc-meunier|Meunier|s|n-gpc-vino-espumoso|g||
n-gpc-mezcla-de-frutos-secos|Mezcla de frutos secos|t|n-gpc-mezclas-de-fruta-y-frutos-secos|g||ambiente,elaborado
n-gpc-mezclas-de-fruta-y-frutos-secos|Mezclas de fruta y frutos secos|c|n-preserves|g||
n-gpc-mezclas-de-pescado-marisco-e-inver|Mezclas de pescado, marisco e invertebrados|t|n-gpc-mezclas-de-pescado-y-marisco|g||ambiente,congelado,elaborado,refrigerado,sin elaborar
n-gpc-mezclas-de-pescado-y-marisco|Mezclas de pescado y marisco|c|n-fish|g||
n-gpc-michaelmas-red|Michaelmas red|s|n-v-manzana|g||
n-gpc-milka|Milka|s|n-v-pera|g||
n-gpc-milwa|Milwa|s|n-v-manzana|g||
n-gpc-minneiska|Minneiska|s|n-v-manzana|g||
n-gpc-minnella|Minnella|s|n-gpc-vino-espumoso|g||
n-gpc-minneola-y-otros-tangelos|Minneola y otros tangelos|t|n-gpc-citricos|g||
n-gpc-minnewasta|Minnewasta|s|n-v-manzana|g||
n-gpc-mitad-delantera-de-pollo|Mitad delantera de pollo|s|n-chicken|g||
n-gpc-mitad-delantera-de-pollo-sin-alas|Mitad delantera de pollo sin alas|s|n-chicken|g||
n-gpc-mitad-trasera-de-pavo|Mitad trasera de pavo|s|n-turkey|g||
n-gpc-mitad-trasera-de-pavo-sin-rabadill|Mitad trasera de pavo sin rabadilla|s|n-turkey|g||
n-gpc-mitad-trasera-de-pollo|Mitad trasera de pollo|s|n-chicken|g||
n-gpc-mitad-trasera-de-pollo-sin-rabadil|Mitad trasera de pollo sin rabadilla|s|n-chicken|g||
n-gpc-mitchgla|Mitchgla|s|n-v-manzana|g||
n-gpc-mizuna|Mizuna|t|n-gpc-coles-y-brasicas|g||
n-gpc-modi|Modi|s|n-v-manzana|g||
n-gpc-molinara|Molinara|s|n-gpc-vino-espumoso|g||
n-gpc-mollejas-de-pavo-abiertas-en-marip|Mollejas de pavo abiertas en mariposa|s|n-turkey|g||
n-gpc-mollejas-de-pavo-elaboradas|Mollejas de pavo elaboradas|s|n-turkey|g||
n-gpc-mollejas-de-pavo-semielaboradas|Mollejas de pavo semielaboradas|s|n-turkey|g||
n-gpc-mollejas-de-pollo-abiertas-en-mari|Mollejas de pollo abiertas en mariposa|s|n-chicken|g||
n-gpc-mollejas-de-pollo-de-corte-en-v|Mollejas de pollo de corte en V|s|n-chicken|g||
n-gpc-mollejas-de-pollo-de-corte-mecanic|Mollejas de pollo de corte mecánico|s|n-chicken|g||
n-gpc-monastrell|Monastrell|s|n-gpc-vino-espumoso|g||
n-gpc-moneu|Moneu|s|n-gpc-vino-espumoso|g||
n-gpc-monica|Monica|s|n-gpc-vino-espumoso|g||
n-gpc-monidel|Monidel|s|n-v-manzana|g||
n-gpc-montefalco|Montefalco|s|n-gpc-vino-espumoso|g||
n-gpc-montepulciano|Montepulciano|s|n-gpc-vino-espumoso|g||
n-gpc-moonglo|Moonglo|s|n-v-manzana|g||
n-gpc-moonlight|Moonlight|s|n-v-manzana|g||
n-gpc-morcillo-trasero|Morcillo trasero|s|n-beef|g||
n-gpc-morcillo-trasero-deshuesado|Morcillo trasero deshuesado|s|n-beef|g||
n-gpc-moreto|Moreto|s|n-gpc-vino-espumoso|g||
n-gpc-morgenduft|Morgenduft|s|n-v-manzana|g||
n-gpc-morillon|Morillon|s|n-gpc-vino-espumoso|g||
n-gpc-morio-muskat|Morio muskat|s|n-gpc-vino-espumoso|g||
n-gpc-moscas|Moscas|t|n-gpc-insectos-comestibles|g||elaborado,sin elaborar
n-gpc-moscatel|Moscatel|s|n-gpc-vino-espumoso|g||
n-gpc-moscatel-blanco|Moscatel blanco|s|n-gpc-vino-espumoso|g||
n-gpc-moscatel-de-alejandria|Moscatel de Alejandría|s|n-gpc-vino-espumoso|g||
n-gpc-moscatella|Moscatella|s|n-v-pera|g||
n-gpc-moscato|Moscato|s|n-gpc-vino-espumoso|g||
n-gpc-moschomavro|Moschomavro|s|n-gpc-vino-espumoso|g||
n-gpc-moschoudi|Moschoudi|s|n-gpc-vino-espumoso|g||
n-gpc-moskato-spina|Moskato spina|s|n-gpc-vino-espumoso|g||
n-gpc-moskofilero|Moskofilero|s|n-gpc-vino-espumoso|g||
n-gpc-mostaza-china|Mostaza china|t|n-gpc-coles-y-brasicas|g||
n-gpc-mostaza-negra|Mostaza negra|t|n-gpc-coles-y-brasicas|g||
n-gpc-mother-mutterapfel|Mother (mutterapfel)|s|n-v-manzana|g||
n-gpc-mourvedre-grenache-syrah|Mourvedre/grenache/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-mourvedre-syrah|Mourvedre/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-mramornaja|Mramornaja|s|n-v-pera|g||
n-gpc-mtsvane|Mtsvane|s|n-gpc-vino-espumoso|g||
n-gpc-mueller-thurgau-chasselas|Mueller-thurgau/chasselas|s|n-gpc-vino-espumoso|g||
n-gpc-mueller-thurgau-kerner|Mueller-thurgau/kerner|s|n-gpc-vino-espumoso|g||
n-gpc-mueller-thurgau-morillon|Mueller-thurgau/morillon|s|n-gpc-vino-espumoso|g||
n-gpc-mueller-thurgau-pinot-noir|Mueller-thurgau/pinot noir|s|n-gpc-vino-espumoso|g||
n-gpc-mueller-thurgau-riesling-silvaner|Mueller-thurgau (riesling-silvaner)|s|n-gpc-vino-espumoso|g||
n-gpc-mueller-thurgau-sylvaner|Mueller-thurgau/sylvaner|s|n-gpc-vino-espumoso|g||
n-gpc-mujuretuli|Mujuretuli|s|n-gpc-vino-espumoso|g||
n-gpc-muscadelle|Muscadelle|s|n-gpc-vino-espumoso|g||
n-gpc-muscardin|Muscardin|s|n-gpc-vino-espumoso|g||
n-gpc-muscaris|Muscaris|s|n-gpc-vino-espumoso|g||
n-gpc-muscat|Muscat|s|n-gpc-vino-espumoso|g||
n-gpc-muscat-bailey-a|Muscat bailey a|s|n-gpc-vino-espumoso|g||
n-gpc-muscat-du-moulin|Muscat du moulin|s|n-gpc-vino-espumoso|g||
n-gpc-muscat-gewuerztraminer|Muscat/gewuerztraminer|s|n-gpc-vino-espumoso|g||
n-gpc-muscat-of-spina|Muscat of spina|s|n-gpc-vino-espumoso|g||
n-gpc-muscat-oliver|Muscat oliver|s|n-gpc-vino-espumoso|g||
n-gpc-muscat-ottonel|Muscat ottonel|s|n-gpc-vino-espumoso|g||
n-gpc-muskateller|Muskateller|s|n-gpc-vino-espumoso|g||
n-gpc-mustafabey|Mustafabey|s|n-v-pera|g||
n-gpc-mustoasa|Mustoasa|s|n-gpc-vino-espumoso|g||
n-gpc-mutsu-crispin-mutsu-nk|Mutsu (crispin - mutsu nk)|s|n-v-manzana|g||
n-gpc-nabo-de-mayo|Nabo de mayo|t|n-gpc-coles-y-brasicas|g||
n-gpc-nabo-de-teltow|Nabo de Teltow|t|n-gpc-coles-y-brasicas|g||
n-gpc-najdared|Najdared|s|n-v-manzana|g||
n-gpc-najdazd|Najdazd|s|n-v-manzana|g||
n-gpc-name|Ñame|t|n-root|g||
n-gpc-name-mapuey|Ñame mapuey|t|n-root|g||
n-gpc-nandu|Ñandú|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-narince|Narince|s|n-gpc-vino-espumoso|g||
n-gpc-nascetta|Nascetta|s|n-gpc-vino-espumoso|g||
n-gpc-natali-gala|Natali gala|s|n-v-manzana|g||
n-gpc-nebbiolo|Nebbiolo|s|n-gpc-vino-espumoso|g||
n-gpc-negrara|Negrara|s|n-gpc-vino-espumoso|g||
n-gpc-negretto|Negretto|s|n-gpc-vino-espumoso|g||
n-gpc-negroamaro|Negroamaro|s|n-gpc-vino-espumoso|g||
n-gpc-negroamaro-malvasia-nera|Negroamaro/malvasia nera|s|n-gpc-vino-espumoso|g||
n-gpc-negroamaro-malvasianera-sangiovese|Negroamaro/malvasianera/sangiovese|s|n-gpc-vino-espumoso|g||
n-gpc-negroamaro-montepulciano|Negroamaro/montepulciano|s|n-gpc-vino-espumoso|g||
n-gpc-negroamaro-sangiovese-malvasia-ner|Negroamaro/sangiovese/malvasia nera|s|n-gpc-vino-espumoso|g||
n-gpc-nerello-cappuccio|Nerello cappuccio|s|n-gpc-vino-espumoso|g||
n-gpc-nerello-mascalese|Nerello mascalese|s|n-gpc-vino-espumoso|g||
n-gpc-nero-d-avola|Nero d'avola|s|n-gpc-vino-espumoso|g||
n-gpc-nero-d-avola-cabernet-sauvignon|Nero d'avola/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-nero-d-avola-merlot-cabernet-sauvi|Nero d'avola/merlot/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-nero-d-avola-syrah|Nero d'avola/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-nero-di-troia|Nero di troia|s|n-gpc-vino-espumoso|g||
n-gpc-neuburger|Neuburger|s|n-gpc-vino-espumoso|g||
n-gpc-new-jonagold|New jonagold|s|n-v-manzana|g||
n-gpc-newton-wonder|Newton wonder|s|n-v-manzana|g||
n-gpc-niagara|Niagara|s|n-gpc-vino-espumoso|g||
n-gpc-nicogreen|Nicogreen|s|n-v-manzana|g||
n-gpc-nicoter|Nicoter|s|n-v-manzana|g||
n-gpc-nido-de-golondrina|Nido de golondrina|t|n-gpc-productos-de-origen-animal|g||elaborado,sin elaborar
n-gpc-nispero-japones|Níspero japonés|t|n-gpc-fruta-de-pepita|g||
n-gpc-nobling|Nobling|s|n-gpc-vino-espumoso|g||
n-gpc-noordhollandse-suikerpeer|Noordhollandse suikerpeer|s|n-v-pera|g||
n-gpc-nopal|Nopal|t|n-gpc-guarnicion-fresca|g||
n-gpc-noris|Noris|s|n-v-manzana|g||
n-gpc-normanda|Normanda|s|n-v-manzana|g||
n-gpc-northern-spy|Northern spy|s|n-v-manzana|g||
n-gpc-nosiola|Nosiola|s|n-gpc-vino-espumoso|g||
n-gpc-notarisappel|Notarisappel|s|n-v-manzana|g||
n-gpc-nouveau-poiteau|Nouveau poiteau|s|n-v-pera|g||
n-gpc-nueva-europa|Nueva europa|s|n-v-manzana|g||
n-gpc-nueva-orleans|Nueva orleans|s|n-v-manzana|g||
n-gpc-obaideh|Obaideh|s|n-gpc-vino-espumoso|g||
n-gpc-obeidy|Obeidy|s|n-gpc-vino-espumoso|g||
n-gpc-obelisk|Obelisk|s|n-v-manzana|g||
n-gpc-obrogala|Obrogala|s|n-v-manzana|g||
n-gpc-oca|Oca|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-odin|Odin|s|n-v-manzana|g||
n-gpc-okra|Okra|t|n-gpc-otras-verduras|g||
n-gpc-okra-china|Okra china|t|n-root|g||
n-gpc-oksana|Oksana|s|n-v-pera|g||
n-gpc-okuzgozu|Okuzgozu|s|n-gpc-vino-espumoso|g||
n-gpc-olaszrizling|Olaszrizling|s|n-gpc-vino-espumoso|g||
n-gpc-ontario|Ontario|s|n-v-manzana|g||
n-gpc-opal-variety|Opal (variety)|s|n-v-manzana|g||
n-gpc-optima|Optima|s|n-gpc-vino-espumoso|g||
n-gpc-optima-ortega|Optima/ortega|s|n-gpc-vino-espumoso|g||
n-gpc-orangelo|Orangelo|t|n-gpc-citricos|g||
n-gpc-oregano-griego|Orégano griego|t|n-gpc-hierbas-frescas|g||
n-gpc-oregon|Oregon|s|n-v-manzana|g||
n-gpc-organza|Organza|s|n-gpc-vino-espumoso|g||
n-gpc-orion|Orion|s|n-v-manzana|g||
n-gpc-orleans-reinette|Orleans reinette|s|n-v-manzana|g||
n-gpc-orlik|Orlik|s|n-v-manzana|g||
n-gpc-orlovskoje-polosatoje|Orlovskoje polosatoje|s|n-v-manzana|g||
n-gpc-ortega|Ortega|s|n-gpc-vino-espumoso|g||
n-gpc-ortega-mueller-thurgau|Ortega/mueller-thurgau|s|n-gpc-vino-espumoso|g||
n-gpc-ortrugo|Ortrugo|s|n-gpc-vino-espumoso|g||
n-gpc-orvieto|Orvieto|s|n-gpc-vino-espumoso|g||
n-gpc-oseleta|Oseleta|s|n-gpc-vino-espumoso|g||
n-gpc-otago|Otago|s|n-v-manzana|g||
n-gpc-otava|Otava|s|n-v-manzana|g||
n-gpc-otra-fruta-de-iv-gama|Otra fruta de IV gama|t|n-gpc-fruta-de-iv-gama|g||cortado
n-gpc-otra-verdura-de-iv-gama|Otra verdura de IV gama|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-otras-frutas|Otras frutas|c|n-produce|g||
n-gpc-otras-verduras|Otras verduras|c|n-produce|g||
n-gpc-oveja|Oveja|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-ovoproducto|Ovoproducto|t|n-grocery|g||
n-gpc-ozark-gold|Ozark gold|s|n-v-manzana|g||
n-gpc-packham-s-triumph|Packham's triumph|s|n-v-pera|g||
n-gpc-padeiro|Padeiro|s|n-gpc-vino-espumoso|g||
n-gpc-pais|Pais|s|n-gpc-vino-espumoso|g||
n-gpc-palava|Palava|s|n-gpc-vino-espumoso|g||
n-gpc-paletilla-cara-externa|Paletilla, cara externa|s|n-pork|g||
n-gpc-paletilla-cara-externa-despiezada-|Paletilla, cara externa despiezada en 3|s|n-pork|g||
n-gpc-paletilla-cara-interna-1-costilla|Paletilla, cara interna, 1 costilla|s|n-pork|g||
n-gpc-paletilla-cara-interna-2-costillas|Paletilla, cara interna, 2 costillas|s|n-pork|g||
n-gpc-paletilla-cara-interna-3-costillas|Paletilla, cara interna, 3 costillas|s|n-pork|g||
n-gpc-paletilla-cara-interna-4-costillas|Paletilla, cara interna, 4 costillas|s|n-pork|g||
n-gpc-paletilla-cara-interna-deshuesada|Paletilla, cara interna deshuesada|s|n-pork|g||
n-gpc-paletilla-cojin|Paletilla, cojín|s|n-pork|g||
n-gpc-paletilla-con-panceta|Paletilla con panceta|s|n-pork|g||
n-gpc-paletilla-de-cabrito-cara-externa-|Paletilla de cabrito, cara externa en corte ostra, deshuesada|s|n-gpc-cabra|g||
n-gpc-paletilla-de-cabrito-cara-externa--2|Paletilla de cabrito, cara externa en corte ostra|s|n-gpc-cabra|g||
n-gpc-paletilla-de-cabrito-cortada-a-esc|Paletilla de cabrito cortada a escuadra, 4 costillas|s|n-gpc-cabra|g||
n-gpc-paletilla-de-cabrito-cortada-a-esc-2|Paletilla de cabrito cortada a escuadra, 5 costillas|s|n-gpc-cabra|g||
n-gpc-paletilla-de-cabrito-cortada-a-esc-3|Paletilla de cabrito cortada a escuadra, 6 costillas|s|n-gpc-cabra|g||
n-gpc-paletilla-de-cerdo-cortada-a-escua|Paletilla de cerdo cortada a escuadra, 1 costilla|s|n-pork|g||
n-gpc-paletilla-de-cerdo-cortada-a-escua-2|Paletilla de cerdo cortada a escuadra, 2 costillas|s|n-pork|g||
n-gpc-paletilla-de-cerdo-cortada-a-escua-3|Paletilla de cerdo cortada a escuadra, 3 costillas|s|n-pork|g||
n-gpc-paletilla-de-cerdo-cortada-a-escua-4|Paletilla de cerdo cortada a escuadra, 4 costillas|s|n-pork|g||
n-gpc-paletilla-de-cordero-cara-externa-|Paletilla de cordero, cara externa en corte banjo|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-cara-externa--2|Paletilla de cordero, cara externa en corte ostra|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-cara-externa--3|Paletilla de cordero, cara externa en corte ostra, deshuesada|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-con-brazuelo-|Paletilla de cordero con brazuelo, 4 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-con-brazuelo--2|Paletilla de cordero con brazuelo, 5 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-con-brazuelo--3|Paletilla de cordero con brazuelo, 6 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-con-espaldill|Paletilla de cordero con espaldilla, 4 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-con-espaldill-2|Paletilla de cordero con espaldilla, 5 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-con-espaldill-3|Paletilla de cordero con espaldilla, 6 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-cortada-a-esc|Paletilla de cordero cortada a escuadra, 4 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-cortada-a-esc-2|Paletilla de cordero cortada a escuadra, 5 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-cortada-a-esc-3|Paletilla de cordero cortada a escuadra, 6 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-cortada-a-esc-4|Paletilla de cordero cortada a escuadra, deshuesada, 4 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-cortada-a-esc-5|Paletilla de cordero cortada a escuadra, deshuesada, 5 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-de-cordero-cortada-a-esc-6|Paletilla de cordero cortada a escuadra, deshuesada, 6 costillas|s|n-gpc-cordero|g||
n-gpc-paletilla-mitad-inferior-1-costill|Paletilla, mitad inferior, 1 costilla|s|n-pork|g||
n-gpc-paletilla-mitad-inferior-2-costill|Paletilla, mitad inferior, 2 costillas|s|n-pork|g||
n-gpc-paletilla-mitad-inferior-3-costill|Paletilla, mitad inferior, 3 costillas|s|n-pork|g||
n-gpc-paletilla-mitad-inferior-4-costill|Paletilla, mitad inferior, 4 costillas|s|n-pork|g||
n-gpc-paletilla-mitad-inferior-5-costill|Paletilla, mitad inferior, 5 costillas|s|n-pork|g||
n-gpc-paletilla-mitad-inferior-6-costill|Paletilla, mitad inferior, 6 costillas|s|n-pork|g||
n-gpc-paletilla-mitad-superior-1-costill|Paletilla, mitad superior, 1 costilla|s|n-pork|g||
n-gpc-paletilla-mitad-superior-2-costill|Paletilla, mitad superior, 2 costillas|s|n-pork|g||
n-gpc-paletilla-mitad-superior-3-costill|Paletilla, mitad superior, 3 costillas|s|n-pork|g||
n-gpc-paletilla-mitad-superior-4-costill|Paletilla, mitad superior, 4 costillas|s|n-pork|g||
n-gpc-paletilla-mitad-superior-deshuesad|Paletilla, mitad superior deshuesada|s|n-pork|g||
n-gpc-paletilla-pectoral|Paletilla, pectoral|s|n-pork|g||
n-gpc-palitos-salados|Palitos salados|t|n-d-aperitivo|g||
n-gpc-palmito|Palmito|t|n-gpc-hortalizas-de-tallo|g||
n-gpc-palomino|Palomino|s|n-gpc-vino-espumoso|g||
n-gpc-palomino-fino|Palomino fino|s|n-gpc-vino-espumoso|g||
n-gpc-palomitas|Palomitas|t|n-d-aperitivo|g||ambiente
n-gpc-pan-de-azucar|Pan de azúcar|t|n-vegetable|g||
n-gpc-panceta-con-falda|Panceta con falda|s|n-pork|g||
n-gpc-panceta-de-cerdo-10-costillas|Panceta de cerdo, 10 costillas|s|n-pork|g||
n-gpc-panceta-de-cerdo-11-costillas|Panceta de cerdo, 11 costillas|s|n-pork|g||
n-gpc-panceta-de-cerdo-12-costillas|Panceta de cerdo, 12 costillas|s|n-pork|g||
n-gpc-panceta-de-cerdo-13-costillas|Panceta de cerdo, 13 costillas|s|n-pork|g||
n-gpc-panceta-deshuesada-de-10-costillas|Panceta deshuesada de 10 costillas|s|n-pork|g||
n-gpc-panceta-deshuesada-de-11-costillas|Panceta deshuesada de 11 costillas|s|n-pork|g||
n-gpc-panceta-deshuesada-de-12-costillas|Panceta deshuesada de 12 costillas|s|n-pork|g||
n-gpc-panceta-deshuesada-de-13-costillas|Panceta deshuesada de 13 costillas|s|n-pork|g||
n-gpc-papada-de-cerdo|Papada de cerdo|s|n-pork|g||
n-gpc-papaloquelite|Papaloquelite|t|n-gpc-hierbas-frescas|g||
n-gpc-papaskarasi|Papaskarasi|s|n-gpc-vino-espumoso|g||
n-gpc-papaya|Papaya|c|n-produce|g||cortado
n-gpc-par-de-costillares-de-paletilla-de|Par de costillares de paletilla de cabrito, 4 costillas|s|n-gpc-cabra|g||
n-gpc-par-de-costillares-de-paletilla-de-2|Par de costillares de paletilla de cabrito, 5 costillas|s|n-gpc-cabra|g||
n-gpc-par-de-costillares-de-paletilla-de-3|Par de costillares de paletilla de cordero, 4 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-costillares-de-paletilla-de-4|Par de costillares de paletilla de cordero, 5 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-cuartos-delanteros-de-corde|Par de cuartos delanteros de cordero, 3 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-cuartos-delanteros-de-corde-2|Par de cuartos delanteros de cordero, 4 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-cuartos-delanteros-de-corde-3|Par de cuartos delanteros de cordero, 5 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-cuartos-delanteros-de-corde-4|Par de cuartos delanteros de cordero, 6 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-paletillas-de-cordero-cara-|Par de paletillas de cordero, cara externa|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cabrito-con-sill|Par de piernas de cabrito con silla de lomo|s|n-gpc-cabra|g||
n-gpc-par-de-piernas-de-cabrito-con-sill-2|Par de piernas de cabrito con silla|s|n-gpc-cabra|g||
n-gpc-par-de-piernas-de-cordero|Par de piernas de cordero|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill|Par de piernas de cordero con silla de lomo, sin costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-10|Par de piernas de cordero con silla, 12 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-11|Par de piernas de cordero con silla, 13 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-12|Par de piernas de cordero con silla, 7 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-13|Par de piernas de cordero con silla, 8 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-14|Par de piernas de cordero con silla, 9 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-2|Par de piernas de cordero con silla de lomo, 1 costilla|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-3|Par de piernas de cordero con silla de lomo, 2 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-4|Par de piernas de cordero con silla de lomo, 3 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-5|Par de piernas de cordero con silla de lomo, 4 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-6|Par de piernas de cordero con silla de lomo, 5 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-7|Par de piernas de cordero con silla de lomo, 6 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-8|Par de piernas de cordero con silla, 10 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-piernas-de-cordero-con-sill-9|Par de piernas de cordero con silla, 11 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-rinonadas-de-cordero-1-cost|Par de riñonadas de cordero, 1 costilla|s|n-gpc-cordero|g||
n-gpc-par-de-rinonadas-de-cordero-2-cost|Par de riñonadas de cordero, 2 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-rinonadas-de-cordero-3-cost|Par de riñonadas de cordero, 3 costillas|s|n-gpc-cordero|g||
n-gpc-par-de-rinonadas-de-cordero-sin-co|Par de riñonadas de cordero, sin costillas|s|n-gpc-cordero|g||
n-gpc-parellada|Parellada|s|n-gpc-vino-espumoso|g||
n-gpc-parellada-xarel-lo-macabeo-chardon|Parellada/xarel-lo/macabeo/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-passe-crassane|Passe crassane|s|n-v-pera|g||
n-gpc-pastel|Pastel|t|n-gpc-bolleria-dulce|g||ambiente,congelado,refrigerado
n-gpc-pasteleria-dulce|Pastelería dulce|t|n-gpc-bolleria-dulce|g||ambiente,congelado,refrigerado
n-gpc-patas-de-pollo-elaboradas|Patas de pollo elaboradas|s|n-chicken|g||
n-gpc-patatas-fritas-y-aperitivos|Patatas fritas y aperitivos|t|n-d-aperitivo|g||ambiente
n-gpc-paula-red|Paula red|s|n-v-manzana|g||
n-gpc-pavo-entero|Pavo entero|s|n-turkey|g||
n-gpc-pavo-entero-sin-menudillos|Pavo entero sin menudillos|s|n-turkey|g||
n-gpc-pecho-10-costillas|Pecho, 10 costillas|s|n-beef|g||
n-gpc-pecho-11-costillas|Pecho, 11 costillas|s|n-beef|g||
n-gpc-pecho-12-costillas|Pecho, 12 costillas|s|n-beef|g||
n-gpc-pecho-13-costillas|Pecho, 13 costillas|s|n-beef|g||
n-gpc-pecho-con-plato-de-costillar|Pecho con plato de costillar|s|n-beef|g||
n-gpc-pecho-de-cordero-con-falda|Pecho de cordero con falda|s|n-gpc-cordero|g||
n-gpc-pecho-de-cordero-con-falda-deshues|Pecho de cordero con falda, deshuesado|s|n-gpc-cordero|g||
n-gpc-pecho-deshuesado-10-costillas|Pecho deshuesado, 10 costillas|s|n-beef|g||
n-gpc-pecho-deshuesado-11-costillas|Pecho deshuesado, 11 costillas|s|n-beef|g||
n-gpc-pecho-deshuesado-12-costillas|Pecho deshuesado, 12 costillas|s|n-beef|g||
n-gpc-pecho-deshuesado-13-costillas|Pecho deshuesado, 13 costillas|s|n-beef|g||
n-gpc-pecho-plato-de-falda|Pecho, plato de falda|s|n-beef|g||
n-gpc-pecho-sin-tapa-10-costillas|Pecho sin tapa, 10 costillas|s|n-beef|g||
n-gpc-pecho-sin-tapa-11-costillas|Pecho sin tapa, 11 costillas|s|n-beef|g||
n-gpc-pecho-sin-tapa-12-costillas|Pecho sin tapa, 12 costillas|s|n-beef|g||
n-gpc-pecho-sin-tapa-13-costillas|Pecho sin tapa, 13 costillas|s|n-beef|g||
n-gpc-pechuga-entera-de-pavo-con-costill|Pechuga entera de pavo con costillas y carne deshuesada del primer segmento de ala, sin espalda|s|n-turkey|g||
n-gpc-pechuga-entera-de-pavo-con-costill-2|Pechuga entera de pavo con costillas y primeros segmentos de ala, sin espalda|s|n-turkey|g||
n-gpc-pechuga-entera-de-pavo-con-costill-3|Pechuga entera de pavo con costillas y alas, sin espalda|s|n-turkey|g||
n-gpc-pechuga-entera-de-pavo-con-espalda|Pechuga entera de pavo con espalda, costillas y alas|s|n-turkey|g||
n-gpc-pechuga-entera-de-pavo-con-espalda-2|Pechuga entera de pavo con espalda, costillas y carne deshuesada del primer segmento de ala|s|n-turkey|g||
n-gpc-pechuga-entera-de-pavo-con-espalda-3|Pechuga entera de pavo con espalda, costillas y primer segmento de ala|s|n-turkey|g||
n-gpc-pechuga-entera-de-pavo-con-hueso-e|Pechuga entera de pavo con hueso, espalda y costillas|s|n-turkey|g||
n-gpc-pechuga-entera-de-pavo-con-hueso-y|Pechuga entera de pavo con hueso y solomillos, sin espalda ni costillas|s|n-turkey|g||
n-gpc-pechuga-entera-de-pavo-con-hueso-y-2|Pechuga entera de pavo con hueso y costillas, sin espalda|s|n-turkey|g||
n-gpc-pechuga-entera-de-pavo-deshuesada-|Pechuga entera de pavo deshuesada, limpia de espalda, costillas y solomillos|s|n-turkey|g||
n-gpc-pechuga-entera-de-pollo-con-costil|Pechuga entera de pollo con costillas y solomillos|s|n-chicken|g||
n-gpc-pechuga-entera-de-pollo-con-hueso-|Pechuga entera de pollo con hueso, costillas y alas|s|n-chicken|g||
n-gpc-pechuga-entera-de-pollo-deshuesada|Pechuga entera de pollo deshuesada con carne de costilla, sin solomillos|s|n-chicken|g||
n-gpc-pechuga-entera-de-pollo-deshuesada-2|Pechuga entera de pollo deshuesada con solomillos|s|n-chicken|g||
n-gpc-pechuga-entera-de-pollo-deshuesada-3|Pechuga entera de pollo deshuesada sin solomillos|s|n-chicken|g||
n-gpc-pederna|Pederna|s|n-gpc-vino-espumoso|g||
n-gpc-pedral|Pedral|s|n-gpc-vino-espumoso|g||
n-gpc-pedro-ximenez|Pedro Ximénez|s|n-gpc-vino-espumoso|g||
n-gpc-pelaverga|Pelaverga|s|n-gpc-vino-espumoso|g||
n-gpc-pepicha|Pepicha|t|n-gpc-hierbas-frescas|g||
n-gpc-pepino-armenio|Pepino armenio|t|n-v-melon|g||
n-gpc-pepino-retorcido|Pepino retorcido|t|n-v-pepino|g||
n-gpc-pera-ya|Pera ya|t|n-gpc-fruta-de-pepita|g||
n-gpc-perejil-liso|Perejil liso|t|n-gpc-hierbas-frescas|g||
n-gpc-perejil-rizado|Perejil rizado|t|n-gpc-hierbas-frescas|g||
n-gpc-perera|Perera|s|n-gpc-vino-espumoso|g||
n-gpc-perico|Perico|s|n-v-pera|g||
n-gpc-perifollo|Perifollo|t|n-gpc-hierbas-frescas|g||
n-gpc-perifollo-oloroso|Perifollo oloroso|t|n-gpc-hierbas-frescas|g||
n-gpc-perifollo-tuberoso|Perifollo tuberoso|t|n-root|g||
n-gpc-perita-de-san-juan|Perita de san juan|s|n-v-pera|g||
n-gpc-perle|Perle|s|n-gpc-vino-espumoso|g||
n-gpc-pero-de-cirio|Pero de cirio|s|n-v-manzana|g||
n-gpc-perola|Perola|s|n-v-pera|g||
n-gpc-perricone|Perricone|s|n-gpc-vino-espumoso|g||
n-gpc-perrum|Perrum|s|n-gpc-vino-espumoso|g||
n-gpc-pescado|Pescado|t|n-whitefish|g||ambiente,congelado,elaborado,refrigerado,sin elaborar
n-gpc-pescuezo-de-vacuno|Pescuezo de vacuno|s|n-beef|g||
n-gpc-pescuezo-de-vacuno-deshuesado|Pescuezo de vacuno deshuesado|s|n-beef|g||
n-gpc-petit-courbu|Petit courbu|s|n-gpc-vino-espumoso|g||
n-gpc-petit-manseng|Petit manseng|s|n-gpc-vino-espumoso|g||
n-gpc-petit-meslier|Petit meslier|s|n-gpc-vino-espumoso|g||
n-gpc-petit-verdot|Petit verdot|s|n-gpc-vino-espumoso|g||
n-gpc-petite-arvine|Petite arvine|s|n-gpc-vino-espumoso|g||
n-gpc-petite-arvine-pinot-gris-muscat|Petite arvine/pinot gris/muscat|s|n-gpc-vino-espumoso|g||
n-gpc-petite-meslier|Petite meslier|s|n-gpc-vino-espumoso|g||
n-gpc-petite-pearl|Petite pearl|s|n-gpc-vino-espumoso|g||
n-gpc-pfirsichroter-sommerapfel|Pfirsichroter sommerapfel|s|n-v-manzana|g||
n-gpc-physalis|Physalis|t|n-gpc-otras-frutas|g||
n-gpc-picardan|Picardan|s|n-gpc-vino-espumoso|g||
n-gpc-piceno|Piceno|s|n-gpc-vino-espumoso|g||
n-gpc-pichon|Pichón|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-picolit|Picolit|s|n-gpc-vino-espumoso|g||
n-gpc-picotener|Picotener|s|n-gpc-vino-espumoso|g||
n-gpc-picpoul-picpoul-de-pinet|Picpoul (picpoul de pinet)|s|n-gpc-vino-espumoso|g||
n-gpc-piedirosso|Piedirosso|s|n-gpc-vino-espumoso|g||
n-gpc-piel-de-contramuslo-y-jamoncito-de|Piel de contramuslo y jamoncito de pollo|s|n-chicken|g||
n-gpc-piel-de-contramuslo-y-jamoncito-de-2|Piel de contramuslo y jamoncito de pavo|s|n-turkey|g||
n-gpc-piel-de-cuello-de-pavo|Piel de cuello de pavo|s|n-turkey|g||
n-gpc-piel-de-pavo|Piel de pavo|s|n-turkey|g||
n-gpc-piel-de-pechuga-de-pavo|Piel de pechuga de pavo|s|n-turkey|g||
n-gpc-piel-de-pechuga-de-pavo-troquelada|Piel de pechuga de pavo troquelada|s|n-turkey|g||
n-gpc-piel-de-pechuga-de-pavo-troquelada-2|Piel de pechuga de pavo troquelada y desgrasada|s|n-turkey|g||
n-gpc-piel-de-pechuga-de-pollo|Piel de pechuga de pollo|s|n-chicken|g||
n-gpc-piel-de-pollo|Piel de pollo|s|n-chicken|g||
n-gpc-pierna-de-cabrito-con-rinonada|Pierna de cabrito con riñonada|s|n-gpc-cabra|g||
n-gpc-pierna-de-cabrito-con-rinonada-des|Pierna de cabrito con riñonada, deshuesada|s|n-gpc-cabra|g||
n-gpc-pierna-de-cabrito-con-rinonada-sin|Pierna de cabrito con riñonada, sin jarrete|s|n-gpc-cabra|g||
n-gpc-pierna-de-cabrito-de-trinchado-fac|Pierna de cabrito de trinchado fácil|s|n-gpc-cabra|g||
n-gpc-pierna-de-cabrito-parte-baja|Pierna de cabrito, parte baja|s|n-gpc-cabra|g||
n-gpc-pierna-de-cabrito-sin-rinonada|Pierna de cabrito sin riñonada|s|n-gpc-cabra|g||
n-gpc-pierna-de-cordero-babilla|Pierna de cordero, babilla|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-con-jarrete-sin-|Pierna de cordero con jarrete, sin riñonada ni hueso de cadera|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-con-rinonada|Pierna de cordero con riñonada|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-con-rinonada-des|Pierna de cordero con riñonada, deshuesada|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-con-rinonada-sin|Pierna de cordero con riñonada, sin jarrete|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-con-rinonada-sin-2|Pierna de cordero con riñonada, sin jarrete ni hueso de cadera|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-con-rinonada-sin-3|Pierna de cordero con riñonada, sin jarrete, deshuesada|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-con-rinonada-y-j|Pierna de cordero con riñonada y jarrete, sin hueso de cadera|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-contra|Pierna de cordero, contra|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-culata-de-contra|Pierna de cordero, culata de contra|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-de-trinchado-fac|Pierna de cordero de trinchado fácil|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-parte-del-filete|Pierna de cordero, parte del filete|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-parte-del-jarret|Pierna de cordero, parte del jarrete|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-punta-de-babilla|Pierna de cordero, punta de babilla|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-sin-rinonada|Pierna de cordero sin riñonada|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-sin-rinonada-jar|Pierna de cordero sin riñonada, jarrete ni hueso de cadera|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-sin-rinonada-ni-|Pierna de cordero sin riñonada ni jarrete|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-sin-rinonada-ni--2|Pierna de cordero sin riñonada ni jarrete, deshuesada|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-tapa|Pierna de cordero, tapa|s|n-gpc-cordero|g||
n-gpc-pierna-de-cordero-tapa-sin-capa|Pierna de cordero, tapa sin capa|s|n-gpc-cordero|g||
n-gpc-pierre-corneille|Pierre corneille|s|n-v-pera|g||
n-gpc-piezas-surtidas-de-cabrito-limpiez|Piezas surtidas de cabrito, limpieza especial|s|n-gpc-cabra|g||
n-gpc-pigato|Pigato|s|n-gpc-vino-espumoso|g||
n-gpc-piglos|Piglos|s|n-v-manzana|g||
n-gpc-pikant|Pikant|s|n-v-manzana|g||
n-gpc-pikkolo|Pikkolo|s|n-v-manzana|g||
n-gpc-pilot|Pilot|s|n-v-manzana|g||
n-gpc-pimiento-cuadrado|Pimiento cuadrado|t|n-v-pimiento|g||
n-gpc-pimiento-de-tomate|Pimiento de tomate|t|n-v-pimiento|g||
n-gpc-pimiento-italiano|Pimiento italiano|t|n-v-pimiento|g||
n-gpc-pimona|Pimona|s|n-v-manzana|g||
n-gpc-pimpinela|Pimpinela|t|n-gpc-hierbas-frescas|g||
n-gpc-pinot-auxerrois|Pinot auxerrois|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-blanc-pinot-bianco-weissburg|Pinot blanc (pinot bianco/weissburgunder)|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-chardonnay|Pinot/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-gris-chardonnay|Pinot gris/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-gris-grauburgunder-grauer-bu|Pinot gris (grauburgunder/grauer burgunder/pinot grigio/rulaender)|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-gris-sauvignon-blanc|Pinot gris/sauvignon blanc|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-gris-traminer-riesling|Pinot gris/traminer/riesling|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-gris-verduzzo|Pinot gris/verduzzo|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-gris-viognier-traminer|Pinot gris/viognier/traminer|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-meunier|Pinot meunier|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-blauburgunder-pinot-ner|Pinot noir (blauburgunder/pinot nero/roter veltliner)|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-chardonnay|Pinot noir/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-chardonnay-chasselas-ke|Pinot noir/chardonnay/chasselas/kerner|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-chardonnay-chasselas-ot|Pinot noir/chardonnay/chasselas/others|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-chardonnay-pinot-meunie|Pinot noir/chardonnay/pinot meunier|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-gamay|Pinot noir/gamay|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-others|Pinot noir/others|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-pinot-blanc-pinot-gris-|Pinot noir/pinot blanc/pinot gris/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-pinot-meunier-chardonna|Pinot noir/pinot meunier/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-regent-dornfelder-other|Pinot noir/regent/dornfelder/others|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-regent-others|Pinot noir/regent/others|s|n-gpc-vino-espumoso|g||
n-gpc-pinot-noir-syrah|Pinot noir/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-pinotage|Pinotage|s|n-gpc-vino-espumoso|g||
n-gpc-pinotage-cabernet-sauvignon|Pinotage/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-pinotage-cinsault|Pinotage/cinsault|s|n-gpc-vino-espumoso|g||
n-gpc-pinotage-merlot|Pinotage/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-pinotage-syrah|Pinotage/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-pinotin|Pinotin|s|n-gpc-vino-espumoso|g||
n-gpc-pinova|Pinova|s|n-v-manzana|g||
n-gpc-pirella|Pirella|s|n-v-manzana|g||
n-gpc-piros|Piros|s|n-v-manzana|g||
n-gpc-pitaya|Pitaya|c|n-produce|g||cortado
n-gpc-pitaya-amarilla|Pitaya amarilla|t|n-gpc-pitaya|g||
n-gpc-pitaya-dulce|Pitaya dulce|t|n-gpc-pitaya|g||
n-gpc-pitmaston-williams-duchess|Pitmaston (williams duchess)|s|n-v-pera|g||
n-gpc-plantas-crasas-comestibles|Plantas crasas comestibles|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-platano-baby|Plátano baby|t|n-v-platano|g||
n-gpc-platano-manzano|Plátano manzano|t|n-v-platano|g||
n-gpc-platano-rojo|Plátano rojo|t|n-v-platano|g||
n-gpc-platos-a-base-de-cereal|Platos a base de cereal|t|n-gpc-elaborados-a-base-de-cereal|g||ambiente,concentrado,congelado,listo para consumir,refrigerado
n-gpc-platos-a-base-de-huevo|Platos a base de huevo|t|n-gpc-platos-a-base-de-lacteos-y-huevo|g||ambiente,concentrado,congelado,refrigerado
n-gpc-platos-a-base-de-lacteos-y-huevo|Platos a base de lácteos y huevo|c|n-grocery|g||ambiente,listo para consumir,refrigerado
n-gpc-platos-a-base-de-verdura|Platos a base de verdura|c|n-grocery|g||ambiente,concentrado,congelado,listo para consumir,refrigerado
n-gpc-plavac-mali|Plavac mali|s|n-gpc-vino-espumoso|g||
n-gpc-plavaie|Plavaie|s|n-gpc-vino-espumoso|g||
n-gpc-plumac|Plumac|s|n-v-manzana|g||
n-gpc-plumcot|Plumcot|t|n-gpc-fruta-de-hueso|g||
n-gpc-plyto|Plyto|s|n-gpc-vino-espumoso|g||
n-gpc-pollo-abierto-en-dos-mitades|Pollo abierto en dos mitades|s|n-chicken|g||
n-gpc-pollo-en-cuartos|Pollo en cuartos|s|n-chicken|g||
n-gpc-pollo-entero|Pollo entero|s|n-chicken|g||
n-gpc-pollo-entero-deshuesado-sin-alas-n|Pollo entero deshuesado, sin alas ni menudillos|s|n-chicken|g||
n-gpc-pollo-entero-sin-menudillos|Pollo entero sin menudillos|s|n-chicken|g||
n-gpc-pollo-entero-sin-menudillos-con-ca|Pollo entero sin menudillos, con cabeza|s|n-chicken|g||
n-gpc-pollo-entero-sin-menudillos-con-ca-2|Pollo entero sin menudillos, con cabeza y patas|s|n-chicken|g||
n-gpc-pollo-entero-sin-menudillos-con-cu|Pollo entero sin menudillos, con cuello entero|s|n-chicken|g||
n-gpc-pollo-entero-sin-menudillos-con-ja|Pollo entero sin menudillos, con jamoncitos de corte largo|s|n-chicken|g||
n-gpc-pollo-entero-sin-menudillos-con-me|Pollo entero sin menudillos, con medio cuello|s|n-chicken|g||
n-gpc-pollo-troceado-en-10-piezas|Pollo troceado en 10 piezas|s|n-chicken|g||
n-gpc-pollo-troceado-en-6-piezas|Pollo troceado en 6 piezas|s|n-chicken|g||
n-gpc-pollo-troceado-en-8-piezas-corte-a|Pollo troceado en 8 piezas, corte alternativo|s|n-chicken|g||
n-gpc-pollo-troceado-en-8-piezas-corte-t|Pollo troceado en 8 piezas, corte tradicional|s|n-chicken|g||
n-gpc-pollo-troceado-en-9-piezas-corte-c|Pollo troceado en 9 piezas, corte campero|s|n-chicken|g||
n-gpc-pollo-troceado-en-9-piezas-corte-t|Pollo troceado en 9 piezas, corte tradicional|s|n-chicken|g||
n-gpc-pomelo-chino|Pomelo chino|t|n-gpc-citricos|g||
n-gpc-pomelo-miel|Pomelo miel|t|n-gpc-citricos|g||
n-gpc-portugieser|Portugieser|s|n-gpc-vino-espumoso|g||
n-gpc-posip|Posip|s|n-gpc-vino-espumoso|g||
n-gpc-postres-salsas-y-coberturas|Postres, salsas y coberturas|c|n-grocery|g||
n-gpc-poulsard|Poulsard|s|n-gpc-vino-espumoso|g||
n-gpc-precoce-de-trevoux-and-mutants|Precoce de trevoux and mutants|s|n-v-pera|g||
n-gpc-premsal-prensal|Premsal (prensal)|s|n-gpc-vino-espumoso|g||
n-gpc-preparado-de-queso-crema|Preparado de queso crema|s|n-cheese|g||
n-gpc-preparado-de-queso-fundido|Preparado de queso fundido|s|n-cheese|g||
n-gpc-preparado-isotonico|Preparado isotónico|t|n-gpc-bebidas-sin-alcohol|g||
n-gpc-preparado-para-reposteria|Preparado para repostería|t|n-gpc-preparados-e-ingredientes-de-repos|g||ambiente,congelado,refrigerado
n-gpc-preparados-e-ingredientes-de-repos|Preparados e ingredientes de repostería|c|n-bakery|g||
n-gpc-preparados-lacteos|Preparados lácteos|t|n-gpc-platos-a-base-de-lacteos-y-huevo|g||concentrado,congelado,refrigerado
n-gpc-presa-de-paleta|Presa de paleta|s|n-pork|g||
n-gpc-present-van-engeland|Present van engeland|s|n-v-manzana|g||
n-gpc-president-drouard|President drouard|s|n-v-pera|g||
n-gpc-preto-martinho|Preto martinho|s|n-gpc-vino-espumoso|g||
n-gpc-prima|Prima|s|n-v-manzana|g||
n-gpc-primer-y-segundo-segmento-de-ala-d|Primer y segundo segmento de ala de pavo|s|n-turkey|g||
n-gpc-primitivo|Primitivo|s|n-gpc-vino-espumoso|g||
n-gpc-primitivo-merlot|Primitivo/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-primo|Primo|s|n-v-manzana|g||
n-gpc-princesse-noble|Princesse noble|s|n-v-manzana|g||
n-gpc-prior|Prior|s|n-gpc-vino-espumoso|g||
n-gpc-priscilla|Priscilla|s|n-v-manzana|g||
n-gpc-procanico|Procanico|s|n-gpc-vino-espumoso|g||
n-gpc-producto-de-cereal|Producto de cereal|t|n-gpc-cereales-elaborados|g||ambiente,concentrado,congelado,listo para consumir,refrigerado
n-gpc-productos-de-origen-animal|Productos de origen animal|c|n-meat|g||
n-gpc-prosecco-chardonnay|Prosecco/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-prosecco-chardonnay-pinot-blanc|Prosecco/chardonnay/pinot blanc|s|n-gpc-vino-espumoso|g||
n-gpc-prosecco-glera|Prosecco (glera)|s|n-gpc-vino-espumoso|g||
n-gpc-prosecco-pinot-noir|Prosecco/pinot noir|s|n-gpc-vino-espumoso|g||
n-gpc-prugnolo-gentile|Prugnolo gentile|s|n-gpc-vino-espumoso|g||
n-gpc-puerro-egipcio|Puerro egipcio|t|n-gpc-hortalizas-de-bulbo|g||
n-gpc-punta-de-ala-de-pollo|Punta de ala de pollo|s|n-chicken|g||
n-gpc-punta-de-pecho-con-esternon|Punta de pecho con esternón|s|n-beef|g||
n-gpc-punta-de-pecho-sin-tapa-4-costilla|Punta de pecho sin tapa, 4 costillas|s|n-beef|g||
n-gpc-punta-de-pecho-sin-tapa-5-costilla|Punta de pecho sin tapa, 5 costillas|s|n-beef|g||
n-gpc-punta-de-pecho-sin-tapa-6-costilla|Punta de pecho sin tapa, 6 costillas|s|n-beef|g||
n-gpc-punta-de-pecho-sin-tapa-7-costilla|Punta de pecho sin tapa, 7 costillas|s|n-beef|g||
n-gpc-puntarella|Puntarella|t|n-vegetable|g||
n-gpc-pyriam|Pyriam|s|n-v-pera|g||
n-gpc-pyrodwarf|Pyrodwarf|s|n-v-pera|g||
n-gpc-queen-cox|Queen cox|s|n-v-manzana|g||
n-gpc-queso-a-la-cerveza|Queso a la cerveza|s|n-cheese|g||
n-gpc-queso-americano|Queso americano|s|n-cheese|g||
n-gpc-queso-azul-danes|Queso azul danés|s|n-cheese|g||
n-gpc-queso-azul-de-baviera|Queso azul de Baviera|s|n-cheese|g||
n-gpc-queso-beaufort|Queso beaufort|s|n-cheese|g||
n-gpc-queso-blanco-aleman|Queso blanco alemán|s|n-cheese|g||
n-gpc-queso-blanco-batido|Queso blanco batido|s|n-cheese|g||
n-gpc-queso-bleu-de-bresse|Queso bleu de Bresse|s|n-cheese|g||
n-gpc-queso-blue-castello|Queso blue castello|s|n-cheese|g||
n-gpc-queso-brick|Queso brick|s|n-cheese|g||
n-gpc-queso-brunost|Queso brunost|s|n-cheese|g||
n-gpc-queso-butterkase|Queso butterkäse|s|n-cheese|g||
n-gpc-queso-caboc|Queso caboc|s|n-cheese|g||
n-gpc-queso-caciocavallo|Queso caciocavallo|s|n-cheese|g||
n-gpc-queso-caerphilly|Queso caerphilly|s|n-cheese|g||
n-gpc-queso-cantal|Queso cantal|s|n-cheese|g||
n-gpc-queso-chaource|Queso chaource|s|n-cheese|g||
n-gpc-queso-cheshire-azul|Queso cheshire azul|s|n-cheese|g||
n-gpc-queso-cheshire-blanco|Queso cheshire blanco|s|n-cheese|g||
n-gpc-queso-cheshire-rojo|Queso cheshire rojo|s|n-cheese|g||
n-gpc-queso-colby|Queso colby|s|n-cheese|g||
n-gpc-queso-colby-jack|Queso colby jack|s|n-cheese|g||
n-gpc-queso-colwick|Queso colwick|s|n-cheese|g||
n-gpc-queso-con-pimiento|Queso con pimiento|s|n-cheese|g||
n-gpc-queso-cottage|Queso cottage|s|n-cheese|g||
n-gpc-queso-coulommiers|Queso coulommiers|s|n-cheese|g||
n-gpc-queso-de-cabra-frances|Queso de cabra francés|s|n-cheese|g||
n-gpc-queso-de-cuajada|Queso de cuajada|s|n-cheese|g||
n-gpc-queso-dolcelatte|Queso dolcelatte|s|n-cheese|g||
n-gpc-queso-double-gloucester|Queso double gloucester|s|n-cheese|g||
n-gpc-queso-dunlop|Queso dunlop|s|n-cheese|g||
n-gpc-queso-emmenthal|Queso emmenthal|s|n-cheese|g||
n-gpc-queso-en-salmuera|Queso en salmuera|s|n-cheese|g||
n-gpc-queso-epoisses|Queso époisses|s|n-cheese|g||
n-gpc-queso-esrom|Queso esrom|s|n-cheese|g||
n-gpc-queso-fontina|Queso fontina|s|n-cheese|g||
n-gpc-queso-fourme-d-ambert|Queso fourme d'Ambert|s|n-cheese|g||
n-gpc-queso-fresco-batido|Queso fresco batido|s|n-cheese|g||
n-gpc-queso-fundido|Queso fundido|s|n-cheese|g||
n-gpc-queso-geheimratskase|Queso geheimratskäse|s|n-cheese|g||
n-gpc-queso-gjetost|Queso gjetost|s|n-cheese|g||
n-gpc-queso-jarlsberg|Queso jarlsberg|s|n-cheese|g||
n-gpc-queso-kochkase|Queso kochkäse|s|n-cheese|g||
n-gpc-queso-lancashire|Queso lancashire|s|n-cheese|g||
n-gpc-queso-leyden|Queso leyden|s|n-cheese|g||
n-gpc-queso-monterey-jack|Queso monterey jack|s|n-cheese|g||
n-gpc-queso-munster|Queso münster|s|n-cheese|g||
n-gpc-queso-mycella|Queso mycella|s|n-cheese|g||
n-gpc-queso-neufchatel|Queso neufchâtel|s|n-cheese|g||
n-gpc-queso-ossau-iraty|Queso ossau-iraty|s|n-cheese|g||
n-gpc-queso-parmesano-rallado|Queso parmesano rallado|s|n-cheese|g||
n-gpc-queso-petit-munster|Queso petit munster|s|n-cheese|g||
n-gpc-queso-pipo-crem|Queso pipo crem|s|n-cheese|g||
n-gpc-queso-reblochon|Queso reblochon|s|n-cheese|g||
n-gpc-queso-red-leicester|Queso red leicester|s|n-cheese|g||
n-gpc-queso-roule|Queso roulé|s|n-cheese|g||
n-gpc-queso-saint-marcellin|Queso saint-marcellin|s|n-cheese|g||
n-gpc-queso-saint-paulin|Queso saint-paulin|s|n-cheese|g||
n-gpc-queso-sapsago|Queso sapsago|s|n-cheese|g||
n-gpc-queso-sbrinz|Queso sbrinz|s|n-cheese|g||
n-gpc-queso-shropshire-azul|Queso shropshire azul|s|n-cheese|g||
n-gpc-queso-stilton-azul|Queso stilton azul|s|n-cheese|g||
n-gpc-queso-suizo|Queso suizo|s|n-cheese|g||
n-gpc-queso-tilsit|Queso tilsit|s|n-cheese|g||
n-gpc-queso-tomme-au-raisin|Queso tomme au raisin|s|n-cheese|g||
n-gpc-queso-vignotte|Queso vignotte|s|n-cheese|g||
n-gpc-queso-wensleydale|Queso wensleydale|s|n-cheese|g||
n-gpc-rabadilla-de-pollo|Rabadilla de pollo|s|n-chicken|g||
n-gpc-rabadillas-de-pavo|Rabadillas de pavo|s|n-turkey|g||
n-gpc-rabano-negro|Rábano negro|t|n-root|g||
n-gpc-rabano-picante|Rábano picante|t|n-root|g||
n-gpc-rabigato|Rabigato|s|n-gpc-vino-espumoso|g||
n-gpc-rabillo-de-cadera|Rabillo de cadera|s|n-beef|g||
n-gpc-rabo-de-ovelha|Rabo de ovelha|s|n-gpc-vino-espumoso|g||
n-gpc-raboso|Raboso|s|n-gpc-vino-espumoso|g||
n-gpc-racion-de-campana|Ración de campaña|t|n-gpc-surtidos-de-alimentacion|g||
n-gpc-radicchio|Radicchio|t|n-vegetable|g||
n-gpc-radicchio-rosso|Radicchio rosso|t|n-vegetable|g||
n-gpc-raeuschling|Raeuschling|s|n-gpc-vino-espumoso|g||
n-gpc-rafzas-benita|Rafzas (benita)|s|n-v-pera|g||
n-gpc-rafzubex|Rafzubex|s|n-v-manzana|g||
n-gpc-rafzubin|Rafzubin|s|n-v-manzana|g||
n-gpc-raiz-de-loto|Raíz de loto|t|n-root|g||
n-gpc-raiz-de-perejil|Raíz de perejil|t|n-root|g||
n-gpc-rajka|Rajka|s|n-v-manzana|g||
n-gpc-rajnai-rizling|Rajnai rizling|s|n-gpc-vino-espumoso|g||
n-gpc-ramandolo|Ramandolo|s|n-gpc-vino-espumoso|g||
n-gpc-rambour-d-hiver|Rambour d'hiver|s|n-v-manzana|g||
n-gpc-rambour-franc|Rambour franc|s|n-v-manzana|g||
n-gpc-rana|Rana|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-rara-neagra|Rara neagra|s|n-gpc-vino-espumoso|g||
n-gpc-reanda|Reanda|s|n-v-manzana|g||
n-gpc-rebella|Rebella|s|n-v-manzana|g||
n-gpc-rebozuelo|Rebozuelo|t|n-gpc-setas-y-hongos|g||
n-gpc-recortes-de-ala-de-pavo|Recortes de ala de pavo|s|n-turkey|g||
n-gpc-recortes-de-carne-blanca-de-pavo|Recortes de carne blanca de pavo|s|n-turkey|g||
n-gpc-recortes-de-carne-oscura-de-pavo|Recortes de carne oscura de pavo|s|n-turkey|g||
n-gpc-recortes-de-cerdo|Recortes de cerdo|s|n-pork|g||
n-gpc-recortes-de-contramuslo-de-pavo|Recortes de contramuslo de pavo|s|n-turkey|g||
n-gpc-recortes-de-jamoncito-de-pavo|Recortes de jamoncito de pavo|s|n-turkey|g||
n-gpc-recortes-de-pechuga-de-pavo|Recortes de pechuga de pavo|s|n-turkey|g||
n-gpc-red-bartlett|Red bartlett|s|n-v-pera|g||
n-gpc-red-cascade|Red cascade|s|n-v-pera|g||
n-gpc-red-chief|Red chief|s|n-v-manzana|g||
n-gpc-red-clapp-s-starkrimson|Red clapp's (starkrimson)|s|n-v-pera|g||
n-gpc-red-cox|Red cox|s|n-v-manzana|g||
n-gpc-red-delcorf|Red delcorf|s|n-v-manzana|g||
n-gpc-red-delicious-and-mutants|Red delicious and mutants|s|n-v-manzana|g||
n-gpc-red-devil|Red devil|s|n-v-manzana|g||
n-gpc-red-dougherty|Red dougherty|s|n-v-manzana|g||
n-gpc-red-elstar|Red elstar|s|n-v-manzana|g||
n-gpc-red-falstaff|Red falstaff|s|n-v-manzana|g||
n-gpc-red-idared|Red idared|s|n-v-manzana|g||
n-gpc-red-jonaprince|Red jonaprince|s|n-v-manzana|g||
n-gpc-red-king-oregon-spur-red-delicious|Red king oregon spur (red delicious)|s|n-v-manzana|g||
n-gpc-red-melba|Red melba|s|n-v-manzana|g||
n-gpc-red-rome|Red rome|s|n-v-manzana|g||
n-gpc-red-sensation-bartlett|Red sensation bartlett|s|n-v-pera|g||
n-gpc-red-spur-delicious|Red spur delicious|s|n-v-manzana|g||
n-gpc-red-topaz|Red topaz|s|n-v-manzana|g||
n-gpc-red-windsor|Red windsor|s|n-v-manzana|g||
n-gpc-red-york|Red york|s|n-v-manzana|g||
n-gpc-redfield|Redfield|s|n-v-manzana|g||
n-gpc-redkroft|Redkroft|s|n-v-manzana|g||
n-gpc-redlane|Redlane|s|n-v-manzana|g||
n-gpc-redondo-de-vacuno|Redondo de vacuno|s|n-beef|g||
n-gpc-redsleeves|Redsleeves|s|n-v-manzana|g||
n-gpc-redspring|Redspring|s|n-v-manzana|g||
n-gpc-redstar|Redstar|s|n-v-manzana|g||
n-gpc-refosco-refosk|Refosco (refosk)|s|n-gpc-vino-espumoso|g||
n-gpc-regal-gala|Regal (gala)|s|n-v-manzana|g||
n-gpc-regal-prince-gala-must|Regal prince (gala must)|s|n-v-manzana|g||
n-gpc-regala|Regala|s|n-v-manzana|g||
n-gpc-regent|Regent|s|n-gpc-vino-espumoso|g||
n-gpc-regina|Regina|s|n-v-manzana|g||
n-gpc-reglindis|Reglindis|s|n-v-manzana|g||
n-gpc-reichensteiner|Reichensteiner|s|n-gpc-vino-espumoso|g||
n-gpc-reineta-blanca-del-canada|Reineta blanca del Canadá|s|n-v-manzana|g||
n-gpc-reineta-de-francia|Reineta de Francia|s|n-v-manzana|g||
n-gpc-reineta-del-canada|Reineta del Canadá|s|n-v-manzana|g||
n-gpc-reineta-encarnada|Reineta encarnada|s|n-v-manzana|g||
n-gpc-reineta-gris-del-canada|Reineta gris del Canadá|s|n-v-manzana|g||
n-gpc-reineta-roja-del-canada|Reineta roja del Canadá|s|n-v-manzana|g||
n-gpc-reinette-de-champagne|Reinette de champagne|s|n-v-manzana|g||
n-gpc-reinette-de-landsberg|Reinette de landsberg|s|n-v-manzana|g||
n-gpc-reinette-descardre|Reinette descardre|s|n-v-manzana|g||
n-gpc-reinette-etoilee|Reinette etoilee|s|n-v-manzana|g||
n-gpc-reinette-evagil|Reinette evagil|s|n-v-manzana|g||
n-gpc-reinstar|Reinstar|s|n-v-manzana|g||
n-gpc-reishi|Reishi|t|n-gpc-setas-y-hongos|g||
n-gpc-relinda|Relinda|s|n-v-manzana|g||
n-gpc-rembrandt|Rembrandt|s|n-v-manzana|g||
n-gpc-remo|Remo|s|n-v-manzana|g||
n-gpc-reno|Reno|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-reno-2|Reno 2|s|n-v-manzana|g||
n-gpc-renora|Renora|s|n-v-manzana|g||
n-gpc-repollo|Repollo|t|n-gpc-coles-y-brasicas|g||
n-gpc-resi|Resi|s|n-v-manzana|g||
n-gpc-resista|Resista|s|n-v-manzana|g||
n-gpc-retina|Retina|s|n-v-manzana|g||
n-gpc-reverend-w-wilks|Reverend w. wilks|s|n-v-manzana|g||
n-gpc-rewena|Rewena|s|n-v-manzana|g||
n-gpc-rheinische-schafsnase|Rheinische schafsnase|s|n-v-manzana|g||
n-gpc-rheinischer-bohnapfel|Rheinischer bohnapfel|s|n-v-manzana|g||
n-gpc-rheinischer-krummstiel|Rheinischer krummstiel|s|n-v-manzana|g||
n-gpc-rheinischer-winterrambur|Rheinischer winterrambur|s|n-v-manzana|g||
n-gpc-rheinriesling|Rheinriesling|s|n-gpc-vino-espumoso|g||
n-gpc-rhode-island-greening|Rhode island greening|s|n-v-manzana|g||
n-gpc-ribolla-gialla|Ribolla gialla|s|n-gpc-vino-espumoso|g||
n-gpc-ribston-pippin|Ribston pippin|s|n-v-manzana|g||
n-gpc-richared|Richared|s|n-v-manzana|g||
n-gpc-rieslaner|Rieslaner|s|n-gpc-vino-espumoso|g||
n-gpc-riesling|Riesling|s|n-gpc-vino-espumoso|g||
n-gpc-riesling-gewuerztraminer|Riesling/gewuerztraminer|s|n-gpc-vino-espumoso|g||
n-gpc-riesling-italico|Riesling italico|s|n-gpc-vino-espumoso|g||
n-gpc-riesling-kastellan|Riesling kastellan|s|n-gpc-vino-espumoso|g||
n-gpc-riesling-muskat|Riesling muskat|s|n-gpc-vino-espumoso|g||
n-gpc-riesling-renano|Riesling renano|s|n-gpc-vino-espumoso|g||
n-gpc-riesling-traminer|Riesling/traminer|s|n-gpc-vino-espumoso|g||
n-gpc-rinonada-de-cabrito|Riñonada de cabrito|s|n-gpc-cabra|g||
n-gpc-rinonada-de-cabrito-con-hueso|Riñonada de cabrito con hueso|s|n-gpc-cabra|g||
n-gpc-rinonada-de-cabrito-deshuesada|Riñonada de cabrito deshuesada|s|n-gpc-cabra|g||
n-gpc-rinonada-de-cordero-1-costilla|Riñonada de cordero, 1 costilla|s|n-gpc-cordero|g||
n-gpc-rinonada-de-cordero-2-costillas|Riñonada de cordero, 2 costillas|s|n-gpc-cordero|g||
n-gpc-rinonada-de-cordero-3-costillas|Riñonada de cordero, 3 costillas|s|n-gpc-cordero|g||
n-gpc-rinonada-de-cordero-con-cadera-1-c|Riñonada de cordero con cadera, 1 costilla|s|n-gpc-cordero|g||
n-gpc-rinonada-de-cordero-con-cadera-2-c|Riñonada de cordero con cadera, 2 costillas|s|n-gpc-cordero|g||
n-gpc-rinonada-de-cordero-con-cadera-3-c|Riñonada de cordero con cadera, 3 costillas|s|n-gpc-cordero|g||
n-gpc-rinonada-de-cordero-con-cadera-sin|Riñonada de cordero con cadera, sin costillas|s|n-gpc-cordero|g||
n-gpc-rinonada-de-cordero-con-hueso|Riñonada de cordero con hueso|s|n-gpc-cordero|g||
n-gpc-rinonada-de-cordero-deshuesada|Riñonada de cordero deshuesada|s|n-gpc-cordero|g||
n-gpc-rinonada-de-cordero-sin-costillas|Riñonada de cordero, sin costillas|s|n-gpc-cordero|g||
n-gpc-ritt-bjerregaard|Ritt bjerregaard|s|n-v-manzana|g||
n-gpc-rivaner|Rivaner|s|n-gpc-vino-espumoso|g||
n-gpc-rivaner-morio-muskat|Rivaner/morio muskat|s|n-gpc-vino-espumoso|g||
n-gpc-rivaner-riesling|Rivaner/riesling|s|n-gpc-vino-espumoso|g||
n-gpc-rivaner-sauvignon-blanc-gelber-mus|Rivaner/sauvignon blanc/gelber muskateller/scheurebe|s|n-gpc-vino-espumoso|g||
n-gpc-rkatsiteli|Rkatsiteli|s|n-gpc-vino-espumoso|g||
n-gpc-robijn|Robijn|s|n-v-manzana|g||
n-gpc-rocha|Rocha|s|n-v-pera|g||
n-gpc-rod-ananas|Rod ananas|s|n-v-manzana|g||
n-gpc-rod-astrakan-red-astrachan|Rod astrakan (red astrachan)|s|n-v-manzana|g||
n-gpc-roda-mantet|Roda mantet|s|n-v-manzana|g||
n-gpc-rode-boskoop|Rode boskoop|s|n-v-manzana|g||
n-gpc-rode-dijkmanszoet|Rode dijkmanszoet|s|n-v-manzana|g||
n-gpc-rode-doyenne-van-doorn|Rode doyenne van doorn|s|n-v-pera|g||
n-gpc-rode-jonathan|Rode jonathan|s|n-v-manzana|g||
n-gpc-rode-keuleman|Rode keuleman|s|n-v-manzana|g||
n-gpc-roditis|Roditis|s|n-gpc-vino-espumoso|g||
n-gpc-roelstar-elstar-roelse|Roelstar (elstar roelse)|s|n-v-manzana|g||
n-gpc-roho-3615-red-pinova|Roho 3615 (red pinova)|s|n-v-manzana|g||
n-gpc-roja-de-benejama|Roja de benejama|s|n-v-manzana|g||
n-gpc-rolle|Rolle|s|n-gpc-vino-espumoso|g||
n-gpc-romagold|Romagold|s|n-v-manzana|g||
n-gpc-romance-variety|Romance (variety)|s|n-v-manzana|g||
n-gpc-romanesco|Romanesco|t|n-gpc-coles-y-brasicas|g||
n-gpc-rome-rome-beauty|Rome/rome beauty|s|n-v-manzana|g||
n-gpc-romeiko|Romeiko|s|n-gpc-vino-espumoso|g||
n-gpc-romorantin|Romorantin|s|n-gpc-vino-espumoso|g||
n-gpc-rondinella|Rondinella|s|n-gpc-vino-espumoso|g||
n-gpc-rosalie|Rosalie|s|n-v-manzana|g||
n-gpc-rosemarie|Rosemarie|s|n-v-pera|g||
n-gpc-rosenmuskateller|Rosenmuskateller|s|n-gpc-vino-espumoso|g||
n-gpc-rosette-variety|Rosette (variety)|s|n-v-manzana|g||
n-gpc-rosioara-pamid|Rosioara pamid|s|n-gpc-vino-espumoso|g||
n-gpc-rossese|Rossese|s|n-gpc-vino-espumoso|g||
n-gpc-rossignola|Rossignola|s|n-gpc-vino-espumoso|g||
n-gpc-rosso|Rosso|s|n-gpc-vino-espumoso|g||
n-gpc-rosso-colli-di-luni|Rosso colli di luni|s|n-gpc-vino-espumoso|g||
n-gpc-rosso-di-cardinale|Rosso di cardinale|s|n-gpc-vino-espumoso|g||
n-gpc-rosso-di-montalcino|Rosso di montalcino|s|n-gpc-vino-espumoso|g||
n-gpc-rosso-di-toscana|Rosso di toscana|s|n-gpc-vino-espumoso|g||
n-gpc-rotberger|Rotberger|s|n-gpc-vino-espumoso|g||
n-gpc-roter-berlepsch|Roter berlepsch|s|n-v-manzana|g||
n-gpc-roter-eiserapfel|Roter eiserapfel|s|n-v-manzana|g||
n-gpc-roter-gravensteiner|Roter gravensteiner|s|n-v-manzana|g||
n-gpc-roter-riesling|Roter riesling|s|n-gpc-vino-espumoso|g||
n-gpc-roter-trierer-weinapfel|Roter trierer weinapfel|s|n-v-manzana|g||
n-gpc-roupeiro|Roupeiro|s|n-gpc-vino-espumoso|g||
n-gpc-roussanne|Roussanne|s|n-gpc-vino-espumoso|g||
n-gpc-roussanne-marsanne-viognier|Roussanne/marsanne/viognier|s|n-gpc-vino-espumoso|g||
n-gpc-roussanne-picpoul|Roussanne/picpoul|s|n-gpc-vino-espumoso|g||
n-gpc-royal-beauty-gala|Royal beauty (gala)|s|n-v-manzana|g||
n-gpc-royal-braeburn|Royal braeburn|s|n-v-manzana|g||
n-gpc-royal-gala|Royal gala|s|n-v-manzana|g||
n-gpc-royal-red|Royal red|s|n-v-manzana|g||
n-gpc-rozela|Rozela|s|n-v-manzana|g||
n-gpc-rubin-czech-cultivar|Rubin (czech cultivar)|s|n-v-manzana|g||
n-gpc-rubin-kazakhstan-cultivar|Rubin (kazakhstan cultivar)|s|n-v-manzana|g||
n-gpc-rubinette-frubaur|Rubinette (frubaur)|s|n-v-manzana|g||
n-gpc-rubino|Rubino|s|n-gpc-vino-espumoso|g||
n-gpc-rubinola|Rubinola|s|n-v-manzana|g||
n-gpc-rubinstar|Rubinstar|s|n-v-manzana|g||
n-gpc-rubinstep|Rubinstep|s|n-v-manzana|g||
n-gpc-rubired|Rubired|s|n-gpc-vino-espumoso|g||
n-gpc-ruby-cabernet|Ruby cabernet|s|n-gpc-vino-espumoso|g||
n-gpc-ruby-cabernet-cinsault|Ruby cabernet/cinsault|s|n-gpc-vino-espumoso|g||
n-gpc-ruby-cabernet-merlot|Ruby cabernet/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-ruby-cabernet-pinotage|Ruby cabernet/pinotage|s|n-gpc-vino-espumoso|g||
n-gpc-rucula|Rúcula|t|n-vegetable|g||
n-gpc-rudens-svitrainais|Rudens svītrainais|s|n-v-manzana|g||
n-gpc-rufete|Rufete|s|n-gpc-vino-espumoso|g||
n-gpc-ruibarbo|Ruibarbo|t|n-gpc-hortalizas-de-tallo|g||
n-gpc-ryugan|Ryugan|s|n-gpc-vino-espumoso|g||
n-gpc-saborizante-de-bebida|Saborizante de bebida|t|n-gpc-bebidas-sin-alcohol|g||concentrado
n-gpc-saels|Saels|s|n-v-pera|g||
n-gpc-sagrantino|Sagrantino|s|n-gpc-vino-espumoso|g||
n-gpc-saint-edmund-s-pippin-st-edmund-s-|Saint edmund's pippin (st. edmund's russet)|s|n-v-manzana|g||
n-gpc-saint-remy|Saint remy|s|n-v-pera|g||
n-gpc-sal-y-ablandadores-de-carne|Sal y ablandadores de carne|t|n-gpc-hierbas-especias-y-extractos|g||ambiente
n-gpc-salak|Salak|t|n-gpc-otras-frutas|g||
n-gpc-salamino|Salamino|s|n-gpc-vino-espumoso|g||
n-gpc-salicornia|Salicornia|t|n-gpc-verduras-marinas|g||
n-gpc-salsa-para-cocinar|Salsa para cocinar|t|n-gpc-salsas-untables-y-condimentos|g||ambiente,congelado,refrigerado
n-gpc-salsas-untables-y-condimentos|Salsas, untables y condimentos|c|n-grocery|g||
n-gpc-salsas-y-adobos|Salsas y adobos|t|n-gpc-salsas-untables-y-condimentos|g||ambiente,congelado,refrigerado
n-gpc-salsas-y-rellenos-de-postre|Salsas y rellenos de postre|t|n-gpc-postres-salsas-y-coberturas|g||ambiente,congelado,refrigerado
n-gpc-salsifi|Salsifí|t|n-root|g||
n-gpc-saltamontes-y-grillos|Saltamontes y grillos|t|n-gpc-insectos-comestibles|g||elaborado,sin elaborar
n-gpc-saltanat|Saltanat|s|n-v-manzana|g||
n-gpc-salvia|Salvia|t|n-gpc-hierbas-frescas|g||
n-gpc-samling|Samling|s|n-gpc-vino-espumoso|g||
n-gpc-sampion|Sampion|s|n-v-manzana|g||
n-gpc-samso|Samso|s|n-gpc-vino-espumoso|g||
n-gpc-samtrot|Samtrot|s|n-gpc-vino-espumoso|g||
n-gpc-sander|Sander|s|n-v-manzana|g||
n-gpc-sandidge|Sandidge|s|n-v-manzana|g||
n-gpc-sangiovese|Sangiovese|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-alicante|Sangiovese/alicante|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-cabernet-sauvignon|Sangiovese/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-cabernet-sauvignon-alic|Sangiovese/cabernet sauvignon/alicante|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-cabernet-sauvignon-merl|Sangiovese/cabernet sauvignon/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-canaiolo|Sangiovese/canaiolo|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-canaiolo-nero|Sangiovese/canaiolo nero|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-malbec|Sangiovese/malbec|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-merlot|Sangiovese/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-merlot-cabernet-sauvign|Sangiovese/merlot/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-merlot-sagrantino|Sangiovese/merlot/sagrantino|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-others|Sangiovese/others|s|n-gpc-vino-espumoso|g||
n-gpc-sangiovese-syrah|Sangiovese/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-sanguinole-summer-blutbirne|Sanguinole/summer blutbirne|s|n-v-pera|g||
n-gpc-santa-maria-morettini|Santa maria (morettini)|s|n-v-pera|g||
n-gpc-santana|Santana|s|n-v-manzana|g||
n-gpc-saperavi|Saperavi|s|n-gpc-vino-espumoso|g||
n-gpc-sarba|Sarba|s|n-gpc-vino-espumoso|g||
n-gpc-sauco|Saúco|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-sauternes|Sauternes|s|n-gpc-vino-espumoso|g||
n-gpc-sauvignac|Sauvignac|s|n-gpc-vino-espumoso|g||
n-gpc-sauvignon-blanc|Sauvignon blanc|s|n-gpc-vino-espumoso|g||
n-gpc-sauvignon-blanc-chardonnay|Sauvignon blanc/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-sauvignon-blanc-chenin-blanc|Sauvignon blanc/chenin blanc|s|n-gpc-vino-espumoso|g||
n-gpc-sauvignon-blanc-garganega|Sauvignon blanc/garganega|s|n-gpc-vino-espumoso|g||
n-gpc-sauvignon-blanc-gros-manseng|Sauvignon blanc/gros manseng|s|n-gpc-vino-espumoso|g||
n-gpc-sauvignon-blanc-semillon|Sauvignon blanc/semillon|s|n-gpc-vino-espumoso|g||
n-gpc-sauvignon-gris|Sauvignon gris|s|n-gpc-vino-espumoso|g||
n-gpc-savagnin-heida|Savagnin (heida)|s|n-gpc-vino-espumoso|g||
n-gpc-savatiano|Savatiano|s|n-gpc-vino-espumoso|g||
n-gpc-savstaholm|Savstaholm|s|n-v-manzana|g||
n-gpc-scarlet-benoni|Scarlet benoni|s|n-v-manzana|g||
n-gpc-scheurebe|Scheurebe|s|n-gpc-vino-espumoso|g||
n-gpc-scheurebe-bacchus|Scheurebe bacchus|s|n-gpc-vino-espumoso|g||
n-gpc-scheurebe-huxelrebe|Scheurebe huxelrebe|s|n-gpc-vino-espumoso|g||
n-gpc-scheurebe-mueller-thurgau|Scheurebe/mueller-thurgau|s|n-gpc-vino-espumoso|g||
n-gpc-schiava|Schiava|s|n-gpc-vino-espumoso|g||
n-gpc-schisandra|Schisandra|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-schneica-jonica|Schneica (jonica)|s|n-v-manzana|g||
n-gpc-schniga-gala-schnitzer|Schniga (gala schnitzer)|s|n-v-manzana|g||
n-gpc-schoener-von-nordhausen|Schoener von nordhausen|s|n-v-manzana|g||
n-gpc-schwarzriesling|Schwarzriesling|s|n-gpc-vino-espumoso|g||
n-gpc-sciearly|Sciearly|s|n-v-manzana|g||
n-gpc-scifresh|Scifresh|s|n-v-manzana|g||
n-gpc-sciglo|Sciglo|s|n-v-manzana|g||
n-gpc-scilate|Scilate|s|n-v-manzana|g||
n-gpc-sciray|Sciray|s|n-v-manzana|g||
n-gpc-scired|Scired|s|n-v-manzana|g||
n-gpc-sciros|Sciros|s|n-v-manzana|g||
n-gpc-scrumptious|Scrumptious|s|n-v-manzana|g||
n-gpc-seckel|Seckel|s|n-v-pera|g||
n-gpc-segundo-segmento-de-ala-de-pavo|Segundo segmento de ala de pavo|s|n-turkey|g||
n-gpc-segundo-y-tercer-segmento-de-ala-d|Segundo y tercer segmento de ala de pavo|s|n-turkey|g||
n-gpc-selena|Selena|s|n-v-manzana|g||
n-gpc-semillon|Semillon|s|n-gpc-vino-espumoso|g||
n-gpc-semillon-chardonnay|Semillon/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-semillon-muscadelle|Semillon/muscadelle|s|n-gpc-vino-espumoso|g||
n-gpc-semillon-sauvignon-blanc|Semillon/sauvignon blanc|s|n-gpc-vino-espumoso|g||
n-gpc-semillon-sauvignon-blanc-chardonna|Semillon/sauvignon blanc/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-seta-de-ostra|Seta de ostra|t|n-gpc-setas-y-hongos|g||
n-gpc-seta-silvestre|Seta silvestre|t|n-gpc-setas-y-hongos|g||
n-gpc-setas-y-hongos|Setas y hongos|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-seyval-blanc|Seyval blanc|s|n-gpc-vino-espumoso|g||
n-gpc-sezao|Sezao|s|n-gpc-vino-espumoso|g||
n-gpc-shalimar|Shalimar|s|n-v-manzana|g||
n-gpc-shamrock|Shamrock|s|n-v-manzana|g||
n-gpc-shiitake|Shiitake|t|n-gpc-setas-y-hongos|g||
n-gpc-shimeji|Shimeji|t|n-gpc-setas-y-hongos|g||
n-gpc-shotwell-delicious|Shotwell delicious|s|n-v-manzana|g||
n-gpc-shoulder-teres-major|Shoulder teres major|s|n-pork|g|p|
n-gpc-sidra|Sidra|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-sidra-espumosa|Sidra espumosa|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-sidrunkollane-talioun|Sidrunkollane talioun|s|n-v-manzana|g||
n-gpc-siegerrebe|Siegerrebe|s|n-gpc-vino-espumoso|g||
n-gpc-siegerrebe-ortega|Siegerrebe/ortega|s|n-gpc-vino-espumoso|g||
n-gpc-signe-tillisch|Signe tillisch|s|n-v-manzana|g||
n-gpc-sijsjespeer|Sijsjespeer|s|n-v-pera|g||
n-gpc-silla-de-cabrito|Silla de cabrito|s|n-gpc-cabra|g||
n-gpc-silla-de-carre-de-cordero-6-costil|Silla de carré de cordero, 6 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-carre-de-cordero-7-costil|Silla de carré de cordero, 7 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-carre-de-cordero-8-costil|Silla de carré de cordero, 8 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-carre-de-cordero-9-costil|Silla de carré de cordero, 9 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-cordero-10-costillas|Silla de cordero, 10 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-cordero-11-costillas|Silla de cordero, 11 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-cordero-12-costillas|Silla de cordero, 12 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-cordero-13-costillas|Silla de cordero, 13 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-cordero-7-costillas|Silla de cordero, 7 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-cordero-8-costillas|Silla de cordero, 8 costillas|s|n-gpc-cordero|g||
n-gpc-silla-de-cordero-9-costillas|Silla de cordero, 9 costillas|s|n-gpc-cordero|g||
n-gpc-sinap-orlovskij|Sinap orlovskij|s|n-v-manzana|g||
n-gpc-sirius|Sirius|s|n-v-manzana|g||
n-gpc-sirope-y-melaza|Sirope y melaza|t|n-gpc-azucares-y-edulcorantes|g||ambiente
n-gpc-skovfoged|Skovfoged|s|n-v-manzana|g||
n-gpc-smederevka|Smederevka|s|n-gpc-vino-espumoso|g||
n-gpc-smitten|Smitten|s|n-v-manzana|g||
n-gpc-snygold|Snygold|s|n-v-manzana|g||
n-gpc-soave|Soave|s|n-gpc-vino-espumoso|g||
n-gpc-solanaceas-y-otras|Solanáceas y otras|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-solaris|Solaris|s|n-gpc-vino-espumoso|g||
n-gpc-soldat-laboureur|Soldat laboureur|s|n-v-pera|g||
n-gpc-solomillo-de-cabrito|Solomillo de cabrito|s|n-gpc-cabra|g||
n-gpc-solomillo-de-cerdo-corte-unece|Solomillo de cerdo, corte UNECE|s|n-pork|g||
n-gpc-solomillo-de-cordero|Solomillo de cordero|s|n-gpc-cordero|g||
n-gpc-solomillo-de-cordero-cabeza|Solomillo de cordero, cabeza|s|n-gpc-cordero|g||
n-gpc-solomillo-de-cordero-sin-cabeza|Solomillo de cordero sin cabeza|s|n-gpc-cordero|g||
n-gpc-solomillo-de-pavo-con-tendon|Solomillo de pavo con tendón|s|n-turkey|g||
n-gpc-solomillo-de-pavo-con-tendon-recor|Solomillo de pavo con tendón recortado|s|n-turkey|g||
n-gpc-solomillo-de-pollo|Solomillo de pollo|s|n-chicken|g||
n-gpc-solomillo-de-pollo-sin-punta-de-te|Solomillo de pollo sin punta de tendón|s|n-chicken|g||
n-gpc-solomillo-de-vacuno|Solomillo de vacuno|s|n-beef|g||
n-gpc-solomillo-de-vacuno-sin-cadena|Solomillo de vacuno sin cadena|s|n-beef|g||
n-gpc-sommerfeld|Sommerfeld|s|n-v-manzana|g||
n-gpc-sommerregent|Sommerregent|s|n-v-manzana|g||
n-gpc-sonya|Sonya|s|n-v-manzana|g||
n-gpc-sopas-preparadas|Sopas preparadas|c|n-grocery|g||ambiente,congelado,refrigerado
n-gpc-southern-rose|Southern rose|s|n-v-manzana|g||
n-gpc-southern-snap|Southern snap|s|n-v-manzana|g||
n-gpc-souvignier-gris|Souvignier gris|s|n-gpc-vino-espumoso|g||
n-gpc-spadoncina|Spadoncina|s|n-v-pera|g||
n-gpc-spartan|Spartan|s|n-v-manzana|g||
n-gpc-spatburgunder|Spatburgunder|s|n-gpc-vino-espumoso|g||
n-gpc-splendour|Splendour|s|n-v-manzana|g||
n-gpc-sq133|Sq133|s|n-v-manzana|g||
n-gpc-sq159|Sq159|s|n-v-manzana|g||
n-gpc-st-laurent|St. laurent|s|n-gpc-vino-espumoso|g||
n-gpc-staris|Štaris|s|n-v-manzana|g||
n-gpc-stark-delicious|Stark delicious|s|n-v-manzana|g||
n-gpc-starking|Starking|s|n-v-manzana|g||
n-gpc-starkrimson|Starkrimson|s|n-v-manzana|g||
n-gpc-starks-s-earliest|Starks's earliest|s|n-v-manzana|g||
n-gpc-starkspur|Starkspur|s|n-v-manzana|g||
n-gpc-stayman|Stayman|s|n-v-manzana|g||
n-gpc-steinschiller|Steinschiller|s|n-gpc-vino-espumoso|g||
n-gpc-sturmer-pippin|Sturmer pippin|s|n-v-manzana|g||
n-gpc-subproducto-lacteo|Subproducto lácteo|t|n-dairy|g||
n-gpc-sucedaneo-de-cafe-en-capsulas|Sucedáneo de café en cápsulas|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-sucedaneo-de-cafe-liquido|Sucedáneo de café líquido|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-sucedaneo-de-cafe-molido|Sucedáneo de café molido|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-sucedaneo-de-cafe-soluble|Sucedáneo de café soluble|t|n-gpc-cafe-y-sucedaneos-de-cafe|g||
n-gpc-sucedaneo-de-huevo|Sucedáneo de huevo|t|n-grocery|g||
n-gpc-sucedaneo-de-miel|Sucedáneo de miel|t|n-gpc-untables-dulces|g||
n-gpc-sucree-de-montlucon|Sucree de montlucon|s|n-v-pera|g||
n-gpc-sugisdessert|Sugisdessert|s|n-v-manzana|g||
n-gpc-sultaniye|Sultaniye|s|n-gpc-vino-espumoso|g||
n-gpc-summerred|Summerred|s|n-v-manzana|g||
n-gpc-sumoll|Sumoll|s|n-gpc-vino-espumoso|g||
n-gpc-sunlight|Sunlight|s|n-v-manzana|g||
n-gpc-sunrise|Sunrise|s|n-v-manzana|g||
n-gpc-sunset|Sunset|s|n-v-manzana|g||
n-gpc-suntan|Suntan|s|n-v-manzana|g||
n-gpc-surtido-de-hierbas|Surtido de hierbas|t|n-gpc-hierbas-frescas|g||
n-gpc-surtidos-de-aceites-y-grasas|Surtidos de aceites y grasas|c|n-oils|g||
n-gpc-surtidos-de-alimentacion|Surtidos de alimentación|c|n-grocery|g||
n-gpc-surtidos-de-alimentacion-infantil|Surtidos de alimentación infantil|t|n-gpc-alimentacion-y-bebidas-infantiles|g||
n-gpc-surtidos-de-aperitivos|Surtidos de aperitivos|t|n-d-aperitivo|g||
n-gpc-surtidos-de-azucares-y-edulcorante|Surtidos de azúcares y edulcorantes|t|n-gpc-azucares-y-edulcorantes|g||
n-gpc-surtidos-de-bebidas|Surtidos de bebidas|c|n-drinks|g||
n-gpc-surtidos-de-bebidas-alcoholicas|Surtidos de bebidas alcohólicas|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-surtidos-de-bebidas-sin-alcohol|Surtidos de bebidas sin alcohol|t|n-gpc-bebidas-sin-alcohol|g||concentrado,listo para consumir
n-gpc-surtidos-de-bocadillos-y-wraps|Surtidos de bocadillos y wraps|t|n-gpc-bocadillos-y-wraps|g||
n-gpc-surtidos-de-bolleria-dulce|Surtidos de bollería dulce|t|n-gpc-bolleria-dulce|g||
n-gpc-surtidos-de-cafe-e-infusiones|Surtidos de café e infusiones|t|n-gpc-cafe-te-e-infusiones|g||
n-gpc-surtidos-de-cereales-elaborados|Surtidos de cereales elaborados|t|n-gpc-cereales-elaborados|g||
n-gpc-surtidos-de-cereales-y-legumbres|Surtidos de cereales y legumbres|c|n-pulses|g||
n-gpc-surtidos-de-condimentos-y-extracto|Surtidos de condimentos y extractos|c|n-grocery|g||
n-gpc-surtidos-de-confiteria|Surtidos de confitería|t|n-gpc-confiteria|g||
n-gpc-surtidos-de-confiteria-y-azucares|Surtidos de confitería y azúcares|c|n-grocery|g||
n-gpc-surtidos-de-elaborados-de-cereal|Surtidos de elaborados de cereal|t|n-gpc-elaborados-a-base-de-cereal|g||
n-gpc-surtidos-de-encurtidos-y-aceitunas|Surtidos de encurtidos y aceitunas|t|n-gpc-encurtidos-chutneys-y-aceitunas|g||
n-gpc-surtidos-de-fruta|Surtidos de fruta|c|n-produce|g||fresco,sin elaborar
n-gpc-surtidos-de-fruta-cortada|Surtidos de fruta cortada|t|n-gpc-fruta-de-iv-gama|g||cortado
n-gpc-surtidos-de-fruta-verdura-y-frutos|Surtidos de fruta, verdura y frutos secos|c|n-preserves|g||
n-gpc-surtidos-de-fruta-y-frutos-secos|Surtidos de fruta y frutos secos|t|n-gpc-mezclas-de-fruta-y-frutos-secos|g||
n-gpc-surtidos-de-fruta-y-verdura-sin-el|Surtidos de fruta y verdura sin elaborar|c|n-produce|g||fresco
n-gpc-surtidos-de-frutos-rojos|Surtidos de frutos rojos|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-surtidos-de-galletas|Surtidos de galletas|t|n-d-galleta|g||
n-gpc-surtidos-de-granos-y-harinas|Surtidos de granos y harinas|t|n-gpc-granos-y-harinas|g||
n-gpc-surtidos-de-grasas|Surtidos de grasas|t|n-gpc-grasas-comestibles|g||
n-gpc-surtidos-de-hierbas-y-especias|Surtidos de hierbas y especias|t|n-gpc-hierbas-especias-y-extractos|g||
n-gpc-surtidos-de-hoja|Surtidos de hoja|c|n-produce|g||sin elaborar
n-gpc-surtidos-de-hoja-cortada|Surtidos de hoja cortada|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-surtidos-de-iv-gama|Surtidos de IV gama|c|n-produce|g||
n-gpc-surtidos-de-lacteos-y-huevos|Surtidos de lácteos y huevos|c|n-dairy|g||
n-gpc-surtidos-de-marisco|Surtidos de marisco|c|n-fish|g||
n-gpc-surtidos-de-masas|Surtidos de masas|t|n-gpc-masas-y-elaborados-de-masa|g||
n-gpc-surtidos-de-panaderia|Surtidos de panadería|c|n-bakery|g||
n-gpc-surtidos-de-pasta|Surtidos de pasta|t|n-d-pasta|g||
n-gpc-surtidos-de-pimiento|Surtidos de pimiento|t|n-v-pimiento|g||
n-gpc-surtidos-de-platos-con-lacteos-y-h|Surtidos de platos con lácteos y huevo|t|n-gpc-platos-a-base-de-lacteos-y-huevo|g||
n-gpc-surtidos-de-platos-de-verdura|Surtidos de platos de verdura|t|n-gpc-platos-a-base-de-verdura|g||
n-gpc-surtidos-de-platos-preparados|Surtidos de platos preparados|t|n-d-plato-preparado|g||concentrado,listo para consumir
n-gpc-surtidos-de-platos-preparados-y-co|Surtidos de platos preparados y conservas|c|n-grocery|g||
n-gpc-surtidos-de-postres-y-coberturas|Surtidos de postres y coberturas|t|n-gpc-postres-salsas-y-coberturas|g||
n-gpc-surtidos-de-reposteria|Surtidos de repostería|t|n-gpc-preparados-e-ingredientes-de-repos|g||
n-gpc-surtidos-de-salsas-y-condimentos|Surtidos de salsas y condimentos|t|n-gpc-salsas-untables-y-condimentos|g||
n-gpc-surtidos-de-sopas|Surtidos de sopas|t|n-gpc-sopas-preparadas|g||
n-gpc-surtidos-de-sustitutos-de-carne|Surtidos de sustitutos de carne|t|n-gpc-sustitutos-de-carne|g||
n-gpc-surtidos-de-sustitutos-de-marisco|Surtidos de sustitutos de marisco|t|n-gpc-sustitutos-de-marisco|g||
n-gpc-surtidos-de-sustitutos-de-pescado|Surtidos de sustitutos de pescado|t|n-gpc-sustitutos-de-pescado|g||
n-gpc-surtidos-de-tomate|Surtidos de tomate|t|n-tomato|g||
n-gpc-surtidos-de-untables-dulces|Surtidos de untables dulces|t|n-gpc-untables-dulces|g||
n-gpc-surtidos-de-verdura|Surtidos de verdura|c|n-produce|g||fresco,sin elaborar
n-gpc-surtidos-de-verdura-cortada|Surtidos de verdura cortada|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-surtidos-de-vinagres-y-vinos-de-co|Surtidos de vinagres y vinos de cocina|t|n-gpc-vinagres-y-vinos-de-cocina|g||
n-gpc-sustituto-de-carne-de-origen-anima|Sustituto de carne de origen animal|t|n-gpc-sustitutos-de-carne|g||ambiente,congelado,refrigerado
n-gpc-sustituto-de-marisco-de-origen-ani|Sustituto de marisco de origen animal|t|n-gpc-sustitutos-de-marisco|g||ambiente,congelado,refrigerado
n-gpc-sustituto-de-nata|Sustituto de nata|t|n-milk|g||ambiente,congelado,refrigerado
n-gpc-sustituto-de-pescado-de-origen-ani|Sustituto de pescado de origen animal|t|n-gpc-sustitutos-de-pescado|g||ambiente,congelado,refrigerado
n-gpc-sustituto-de-postre|Sustituto de postre|t|n-gpc-postres-salsas-y-coberturas|g||refrigerado
n-gpc-sustituto-de-queso|Sustituto de queso|t|n-cheese|g||ambiente,congelado,refrigerado
n-gpc-sustituto-de-yogur|Sustituto de yogur|t|n-yoghurt|g||ambiente,congelado,refrigerado
n-gpc-sustituto-vegetal-de-carne|Sustituto vegetal de carne|t|n-gpc-sustitutos-de-carne|g||ambiente,congelado,refrigerado
n-gpc-sustituto-vegetal-de-marisco|Sustituto vegetal de marisco|t|n-gpc-sustitutos-de-marisco|g||ambiente,congelado,refrigerado
n-gpc-sustituto-vegetal-de-pescado|Sustituto vegetal de pescado|t|n-gpc-sustitutos-de-pescado|g||ambiente,congelado,refrigerado
n-gpc-sustitutos-de-carne|Sustitutos de carne|c|n-meat|g||
n-gpc-sustitutos-de-marisco|Sustitutos de marisco|c|n-meat|g||
n-gpc-sustitutos-de-pescado|Sustitutos de pescado|c|n-meat|g||
n-gpc-susumaniello|Susumaniello|s|n-gpc-vino-espumoso|g||
n-gpc-suvenirs|Suvenirs|s|n-v-pera|g||
n-gpc-svatava|Svatava|s|n-v-manzana|g||
n-gpc-sweet-caroline|Sweet caroline|s|n-v-manzana|g||
n-gpc-sweetie|Sweetie|t|n-gpc-citricos|g||
n-gpc-sylvaner-riesling|Sylvaner/riesling|s|n-gpc-vino-espumoso|g||
n-gpc-sylvaner-silvaner|Sylvaner (silvaner)|s|n-gpc-vino-espumoso|g||
n-gpc-symphony|Symphony|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-alicante-bouschet-tempranill|Syrah/alicante bouschet/tempranillo|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-alicante-bouschet-trincadeir|Syrah/alicante bouschet/trincadeira|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-cabernet-sauvignon|Syrah/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-cabernet-sauvignon-malbec|Syrah/cabernet sauvignon/malbec|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-cabernet-sauvignon-merlot|Syrah/cabernet sauvignon/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-carignan-grenache|Syrah/carignan/grenache|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-cornalin-humagne-rouge-dioli|Syrah/cornalin/humagne rouge/diolinoir/cabernet franc|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-grenache|Syrah/grenache|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-grenache-carignan|Syrah/grenache/carignan|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-grenache-cinsault-cabernet-s|Syrah/grenache/cinsault/cabernet sauvignon/viognier|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-grenache-mourvedre|Syrah/grenache/mourvedre|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-malbec|Syrah/malbec|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-merlot|Syrah/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-merlot-cabernet-sauvignon|Syrah/merlot/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-merlot-tempranillo|Syrah/merlot/tempranillo|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-mourvedre|Syrah/mourvedre|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-mourvedre-grenache-tempranil|Syrah/mourvedre/grenache/tempranillo|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-muscadelle|Syrah/muscadelle|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-sangiovese|Syrah/sangiovese|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-shiraz|Syrah (shiraz)|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-touriga-nacional|Syrah/touriga nacional|s|n-gpc-vino-espumoso|g||
n-gpc-syrah-viognier|Syrah/viognier|s|n-gpc-vino-espumoso|g||
n-gpc-talia|Talia|s|n-gpc-vino-espumoso|g||
n-gpc-tallo-de-boniato|Tallo de boniato|t|n-gpc-hortalizas-de-tallo|g||
n-gpc-talvenauding|Talvenauding|s|n-v-manzana|g||
n-gpc-tamaioasa-romaneasca|Tamaioasa romaneasca|s|n-gpc-vino-espumoso|g||
n-gpc-tamarez|Tamarez|s|n-gpc-vino-espumoso|g||
n-gpc-tamarillo|Tamarillo|t|n-gpc-solanaceas-y-otras|g||
n-gpc-tangor|Tangor|t|n-gpc-citricos|g||
n-gpc-tannat|Tannat|s|n-gpc-vino-espumoso|g||
n-gpc-tannat-merlot|Tannat/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-tapa-capa|Tapa, capa|s|n-beef|g||
n-gpc-tapa-de-cabrito|Tapa de cabrito|s|n-gpc-cabra|g||
n-gpc-tapa-de-cabrito-sin-capa|Tapa de cabrito sin capa|s|n-gpc-cabra|g||
n-gpc-tapa-de-vacuno|Tapa de vacuno|s|n-beef|g||
n-gpc-tapa-sin-capa|Tapa sin capa|s|n-beef|g||
n-gpc-tapa-sin-capa-limpia|Tapa sin capa, limpia|s|n-beef|g||
n-gpc-tapilla-de-cadera|Tapilla de cadera|s|n-beef|g||
n-gpc-taro|Taro|t|n-root|g||
n-gpc-tarrango|Tarrango|s|n-gpc-vino-espumoso|g||
n-gpc-tatsoi|Tatsoi|t|n-gpc-coles-y-brasicas|g||
n-gpc-tauberschwarz|Tauberschwarz|s|n-gpc-vino-espumoso|g||
n-gpc-taunton-cross|Taunton cross|s|n-v-manzana|g||
n-gpc-taurasi|Taurasi|s|n-gpc-vino-espumoso|g||
n-gpc-taylor-s-gold|Taylor's gold|s|n-v-pera|g||
n-gpc-te-concentrado|Té concentrado|t|n-gpc-te-e-infusiones|g||
n-gpc-te-e-infusiones|Té e infusiones|c|n-drinks|g||
n-gpc-te-en-capsulas|Té en cápsulas|t|n-gpc-te-e-infusiones|g||
n-gpc-te-listo-para-beber|Té listo para beber|t|n-gpc-te-e-infusiones|g||
n-gpc-te-soluble|Té soluble|t|n-gpc-te-e-infusiones|g||
n-gpc-telamon|Telamon|s|n-v-manzana|g||
n-gpc-tellisaare|Tellisaare|s|n-v-manzana|g||
n-gpc-telti-kuruk|Telti kuruk|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo|Tempranillo|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-blanco|Tempranillo blanco|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-cabernet-sauvignon|Tempranillo/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-cabernet-sauvignon-mer|Tempranillo/cabernet sauvignon/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-cabernet-sauvignon-syr|Tempranillo/cabernet sauvignon/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-graciano|Tempranillo/graciano|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-graciano-grenache|Tempranillo/graciano/grenache|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-graciano-maturana-tint|Tempranillo/graciano/maturana tinta|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-graciano-mazuelo|Tempranillo/graciano/mazuelo|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-grenache|Tempranillo/grenache|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-grenache-cabernet-sauv|Tempranillo/grenache/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-grenache-syrah|Tempranillo/grenache/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-grenache-viognier|Tempranillo/grenache/viognier|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-malbec|Tempranillo/malbec|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-mazuelo-graciano|Tempranillo/mazuelo/graciano|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-merlot|Tempranillo/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-petit-verdot|Tempranillo/petit verdot|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-syrah-cabernet-sauvign|Tempranillo/syrah/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-touriga-nacional-syrah|Tempranillo/touriga nacional/syrah|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-touriga-nacional-touri|Tempranillo/touriga nacional/touriga franca|s|n-gpc-vino-espumoso|g||
n-gpc-tempranillo-touriga-nacional-trinc|Tempranillo/touriga nacional/trincadeira|s|n-gpc-vino-espumoso|g||
n-gpc-tendones-de-pavo|Tendones de pavo|s|n-turkey|g||
n-gpc-tenroy|Tenroy|s|n-v-manzana|g||
n-gpc-tercer-segmento-de-ala-de-pavo|Tercer segmento de ala de pavo|s|n-turkey|g||
n-gpc-termitas|Termitas|t|n-gpc-insectos-comestibles|g||elaborado,sin elaborar
n-gpc-ternera|Ternera|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-terodola|Terodola|s|n-gpc-vino-espumoso|g||
n-gpc-teroldego|Teroldego|s|n-gpc-vino-espumoso|g||
n-gpc-teroldego-merlot-cabernet-sauvigno|Teroldego/merlot/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-teroldego-petit-verdot-cabernet-sa|Teroldego/petit verdot/cabernet sauvignon/sangiovese|s|n-gpc-vino-espumoso|g||
n-gpc-teroldego-sauvignon-blanc|Teroldego/sauvignon blanc|s|n-gpc-vino-espumoso|g||
n-gpc-terrano|Terrano|s|n-gpc-vino-espumoso|g||
n-gpc-terret|Terret|s|n-gpc-vino-espumoso|g||
n-gpc-terret-noir|Terret noir|s|n-gpc-vino-espumoso|g||
n-gpc-thimo|Thimo|s|n-v-pera|g||
n-gpc-thrapsathiri|Thrapsathiri|s|n-gpc-vino-espumoso|g||
n-gpc-thurgauer-weinapfel|Thurgauer weinapfel|s|n-v-manzana|g||
n-gpc-tibouren|Tibouren|s|n-gpc-vino-espumoso|g||
n-gpc-tiina|Tiina|s|n-v-manzana|g||
n-gpc-tinta-amarela|Tinta amarela|s|n-gpc-vino-espumoso|g||
n-gpc-tinta-barroca|Tinta barroca|s|n-gpc-vino-espumoso|g||
n-gpc-tinta-franca|Tinta franca|s|n-gpc-vino-espumoso|g||
n-gpc-tinta-francisca|Tinta francisca|s|n-gpc-vino-espumoso|g||
n-gpc-tinta-grossa|Tinta grossa|s|n-gpc-vino-espumoso|g||
n-gpc-tinta-miuda|Tinta miuda|s|n-gpc-vino-espumoso|g||
n-gpc-tinta-pinheira|Tinta pinheira|s|n-gpc-vino-espumoso|g||
n-gpc-tinta-roriz-touriga-nacional|Tinta roriz/touriga nacional|s|n-gpc-vino-espumoso|g||
n-gpc-tinto-cao|Tinto cao|s|n-gpc-vino-espumoso|g||
n-gpc-tirabeque-dulce|Tirabeque dulce|t|n-gpc-guisantes-con-vaina|g||
n-gpc-tocai|Tocai|s|n-gpc-vino-espumoso|g||
n-gpc-tocai-friulano|Tocai friulano|s|n-gpc-vino-espumoso|g||
n-gpc-tocino-de-paletilla|Tocino de paletilla|s|n-pork|g||
n-gpc-tocino-dorsal|Tocino dorsal|s|n-pork|g||
n-gpc-tokay-pinot-gris|Tokay pinot gris|s|n-gpc-vino-espumoso|g||
n-gpc-tomate-alargado|Tomate alargado|t|n-tomato|g||
n-gpc-tomate-asurcado|Tomate asurcado|t|n-tomato|g||
n-gpc-tomate-cherry-alargado|Tomate cherry alargado|t|n-tomato|g||
n-gpc-tomate-cherry-redondo|Tomate cherry redondo|t|n-tomato|g||
n-gpc-tomate-redondo|Tomate redondo|t|n-tomato|g||
n-gpc-tomatillo|Tomatillo|t|n-gpc-solanaceas-y-otras|g||
n-gpc-tomillo|Tomillo|t|n-gpc-hierbas-frescas|g||
n-gpc-tomillo-limonero|Tomillo limonero|t|n-gpc-hierbas-frescas|g||
n-gpc-topaz-variety|Topaz (variety)|s|n-v-manzana|g||
n-gpc-topred|Topred|s|n-v-manzana|g||
n-gpc-torbato|Torbato|s|n-gpc-vino-espumoso|g||
n-gpc-torrontes|Torrontés|s|n-gpc-vino-espumoso|g||
n-gpc-torrontes-chardonnay|Torrontes/chardonnay|s|n-gpc-vino-espumoso|g||
n-gpc-torrontes-chenin-blanc|Torrontes/chenin blanc|s|n-gpc-vino-espumoso|g||
n-gpc-toscano|Toscano|s|n-gpc-vino-espumoso|g||
n-gpc-touriga-franca|Touriga franca|s|n-gpc-vino-espumoso|g||
n-gpc-touriga-franca-tempranillo-touriga|Touriga franca/tempranillo/touriga nacional|s|n-gpc-vino-espumoso|g||
n-gpc-touriga-franca-touriga-nacional-te|Touriga franca/touriga nacional/tempranillo/tinto cao/tinta barroca|s|n-gpc-vino-espumoso|g||
n-gpc-touriga-nacional|Touriga nacional|s|n-gpc-vino-espumoso|g||
n-gpc-touriga-nacional-tempranillo|Touriga nacional/tempranillo|s|n-gpc-vino-espumoso|g||
n-gpc-touriga-nacional-tempranillo-touri|Touriga nacional/tempranillo/touriga franca/castelao/alicante bouschet|s|n-gpc-vino-espumoso|g||
n-gpc-touriga-nacional-touriga-franca-te|Touriga nacional/touriga franca/tempranillo/tinta barroca/tinto cao|s|n-gpc-vino-espumoso|g||
n-gpc-touriga-nacional-touriga-franca-te-2|Touriga nacional/touriga franca/tempranillo/tinta barroca/tinto cao/vinhao|s|n-gpc-vino-espumoso|g||
n-gpc-touriga-nacional-touriga-franca-te-3|Touriga nacional/touriga franca/tempranillo/tinto cao|s|n-gpc-vino-espumoso|g||
n-gpc-trajadura|Trajadura|s|n-gpc-vino-espumoso|g||
n-gpc-trajan|Trajan|s|n-v-manzana|g||
n-gpc-traminer|Traminer|s|n-gpc-vino-espumoso|g||
n-gpc-traminer-riesling|Traminer/riesling|s|n-gpc-vino-espumoso|g||
n-gpc-transparente-de-croncels|Transparente de croncels|s|n-v-manzana|g||
n-gpc-trebbiano-di-lugana|Trebbiano di lugana|s|n-gpc-vino-espumoso|g||
n-gpc-trebbiano-di-soave|Trebbiano di soave|s|n-gpc-vino-espumoso|g||
n-gpc-trebbiano-malvasia-grechetto|Trebbiano/malvasia/grechetto|s|n-gpc-vino-espumoso|g||
n-gpc-trebbiano-toscano|Trebbiano toscano|s|n-gpc-vino-espumoso|g||
n-gpc-trebbiano-ugni-blanc|Trebbiano (ugni blanc)|s|n-gpc-vino-espumoso|g||
n-gpc-treixadura|Treixadura|s|n-gpc-vino-espumoso|g||
n-gpc-treixadura-albarino|Treixadura/albarino|s|n-gpc-vino-espumoso|g||
n-gpc-trepat|Trepat|s|n-gpc-vino-espumoso|g||
n-gpc-trincadeira|Trincadeira|s|n-gpc-vino-espumoso|g||
n-gpc-trincadeira-das-pratas|Trincadeira das pratas|s|n-gpc-vino-espumoso|g||
n-gpc-triomphe-de-vienne|Triomphe de vienne|s|n-v-pera|g||
n-gpc-tripa-artificial|Tripa artificial|t|n-gpc-tripas-y-envolturas|g||
n-gpc-tripas-y-envolturas|Tripas y envolturas|c|n-grocery|g||
n-gpc-trollinger|Trollinger|s|n-gpc-vino-espumoso|g||
n-gpc-trollinger-blaufraenkisch|Trollinger/blaufraenkisch|s|n-gpc-vino-espumoso|g||
n-gpc-trollinger-riesling|Trollinger/riesling|s|n-gpc-vino-espumoso|g||
n-gpc-tronco-de-cabrito|Tronco de cabrito|s|n-gpc-cabra|g||
n-gpc-tronco-de-cabrito-con-rinonada|Tronco de cabrito con riñonada|s|n-gpc-cabra|g||
n-gpc-tronco-de-cordero|Tronco de cordero|s|n-gpc-cordero|g||
n-gpc-tronco-de-cordero-con-rinonada|Tronco de cordero con riñonada|s|n-gpc-cordero|g||
n-gpc-trousseau|Trousseau|s|n-gpc-vino-espumoso|g||
n-gpc-trufa|Trufa|t|n-gpc-setas-y-hongos|g||
n-gpc-tsitska|Tsitska|s|n-gpc-vino-espumoso|g||
n-gpc-tunda|Tunda|s|n-v-manzana|g||
n-gpc-turbiana|Turbiana|s|n-gpc-vino-espumoso|g||
n-gpc-turriga-isola-nuraghi|Turriga isola nuraghi|s|n-gpc-vino-espumoso|g||
n-gpc-tuscan|Tuscan|s|n-v-manzana|g||
n-gpc-tydeman-s-early-worcester-tydeman-|Tydeman's early worcester (tydeman's early)|s|n-v-manzana|g||
n-gpc-tyrian|Tyrian|s|n-gpc-vino-espumoso|g||
n-gpc-ugli|Ugli|t|n-gpc-citricos|g||
n-gpc-unb|Unb|s|n-gpc-vino-espumoso|g||
n-gpc-untables-dulces|Untables dulces|c|n-grocery|g||
n-gpc-uta|Uta|s|n-v-pera|g||
n-gpc-uva-de-mesa|Uva de mesa|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-uva-espina|Uva espina|t|n-gpc-frutos-rojos-y-bayas|g||
n-gpc-vaccarese-vacarese|Vaccarese (vacarese)|s|n-gpc-vino-espumoso|g||
n-gpc-valpolicella|Valpolicella|s|n-gpc-vino-espumoso|g||
n-gpc-valpolicella-rosso|Valpolicella rosso|s|n-gpc-vino-espumoso|g||
n-gpc-valse-ijsbout|Valse ijsbout|s|n-v-pera|g||
n-gpc-valstar|Valstar|s|n-v-manzana|g||
n-gpc-valtod|Valtod|s|n-v-manzana|g||
n-gpc-vanda|Vanda|s|n-v-manzana|g||
n-gpc-vasarine-sviestine|Vasarine sviestine|s|n-v-pera|g||
n-gpc-verdeca|Verdeca|s|n-gpc-vino-espumoso|g||
n-gpc-verdejo|Verdejo|s|n-gpc-vino-espumoso|g||
n-gpc-verdelho|Verdelho|s|n-gpc-vino-espumoso|g||
n-gpc-verdello|Verdello|s|n-gpc-vino-espumoso|g||
n-gpc-verdi|Verdi|s|n-v-pera|g||
n-gpc-verdicchio|Verdicchio|s|n-gpc-vino-espumoso|g||
n-gpc-verdil|Verdil|s|n-gpc-vino-espumoso|g||
n-gpc-verdiso|Verdiso|s|n-gpc-vino-espumoso|g||
n-gpc-verdolaga|Verdolaga|t|n-vegetable|g||
n-gpc-verdura-de-iv-gama|Verdura de IV gama|c|n-produce|g||
n-gpc-verdura-marina|Verdura marina|t|n-gpc-verduras-marinas|g||
n-gpc-verduras-marinas|Verduras marinas|t|n-gpc-verdura-de-iv-gama|g||cortado
n-gpc-verduzzo|Verduzzo|s|n-gpc-vino-espumoso|g||
n-gpc-vermentino|Vermentino|s|n-gpc-vino-espumoso|g||
n-gpc-vermentino-maremma|Vermentino maremma|s|n-gpc-vino-espumoso|g||
n-gpc-vermentino-sardo|Vermentino sardo|s|n-gpc-vino-espumoso|g||
n-gpc-vermuel|Vermuel|s|n-v-manzana|g||
n-gpc-vernaccia|Vernaccia|s|n-gpc-vino-espumoso|g||
n-gpc-vernaccia-di-san-gimingnano|Vernaccia di san gimingnano|s|n-gpc-vino-espumoso|g||
n-gpc-vernatsch|Vernatsch|s|n-gpc-vino-espumoso|g||
n-gpc-vespaiolo|Vespaiolo|s|n-gpc-vino-espumoso|g||
n-gpc-vespolina|Vespolina|s|n-gpc-vino-espumoso|g||
n-gpc-veteran|Veteran|s|n-v-manzana|g||
n-gpc-vidal-vidal-blanc|Vidal (vidal blanc)|s|n-gpc-vino-espumoso|g||
n-gpc-vidiano|Vidiano|s|n-gpc-vino-espumoso|g||
n-gpc-vidoc|Vidoc|s|n-gpc-vino-espumoso|g||
n-gpc-vignanello|Vignanello|s|n-gpc-vino-espumoso|g||
n-gpc-vilana|Vilana|s|n-gpc-vino-espumoso|g||
n-gpc-viljee-gala|Viljee gala|s|n-v-manzana|g||
n-gpc-villard-noir|Villard noir|s|n-gpc-vino-espumoso|g||
n-gpc-vinagres-y-vinos-de-cocina|Vinagres y vinos de cocina|c|n-grocery|g||
n-gpc-vinhao-sousao|Vinhao (sousao)|s|n-gpc-vino-espumoso|g||
n-gpc-vino-de-cocina|Vino de cocina|t|n-gpc-vinagres-y-vinos-de-cocina|g||
n-gpc-vino-espumoso|Vino espumoso|t|n-gpc-bebidas-alcoholicas|g||sin alcohol
n-gpc-vino-generoso|Vino generoso|t|n-gpc-bebidas-alcoholicas|g||
n-gpc-vino-tranquilo|Vino tranquilo|t|n-gpc-bebidas-alcoholicas|g||sin alcohol
n-gpc-vinsanto|Vinsanto|s|n-gpc-vino-espumoso|g||
n-gpc-viognier|Viognier|s|n-gpc-vino-espumoso|g||
n-gpc-viognier-grenache|Viognier/grenache|s|n-gpc-vino-espumoso|g||
n-gpc-viosinho|Viosinho|s|n-gpc-vino-espumoso|g||
n-gpc-virginia-gold|Virginia gold|s|n-v-manzana|g||
n-gpc-vista-bella|Vista bella|s|n-v-manzana|g||
n-gpc-vital|Vital|s|n-gpc-vino-espumoso|g||
n-gpc-vitovska|Vitovska|s|n-gpc-vino-espumoso|g||
n-gpc-viura|Viura|s|n-gpc-vino-espumoso|g||
n-gpc-vivello-bianco|Vivello bianco|s|n-gpc-vino-espumoso|g||
n-gpc-voir-lombacad|Voir lombacad|s|n-v-pera|g||
n-gpc-vranec|Vranec|s|n-gpc-vino-espumoso|g||
n-gpc-wapiti|Wapití|t|n-gpc-carne-y-aves|g||elaborado,sin elaborar
n-gpc-wealthy|Wealthy|s|n-v-manzana|g||
n-gpc-well-spur|Well spur|s|n-v-manzana|g||
n-gpc-welschriesling|Welschriesling|s|n-gpc-vino-espumoso|g||
n-gpc-white-transparent|White transparent|s|n-v-manzana|g||
n-gpc-williams|Williams|s|n-v-pera|g||
n-gpc-williams-bon-chretien-bartlett|Williams bon chretien (bartlett)|s|n-v-pera|g||
n-gpc-wilmuta|Wilmuta|s|n-v-manzana|g||
n-gpc-winesap|Winesap|s|n-v-manzana|g||
n-gpc-winston|Winston|s|n-v-manzana|g||
n-gpc-winter-nelis|Winter nelis|s|n-v-pera|g||
n-gpc-winterrietpeer|Winterrietpeer|s|n-v-pera|g||
n-gpc-woelfle|Woelfle|s|n-gpc-vino-espumoso|g||
n-gpc-worcester-pearmain|Worcester pearmain|s|n-v-manzana|g||
n-gpc-wur37|Wur37|s|n-v-manzana|g||
n-gpc-xarel-lo|Xarel·lo|s|n-gpc-vino-espumoso|g||
n-gpc-xarel-lo-vermell|Xarel·lo vermell|s|n-gpc-vino-espumoso|g||
n-gpc-xynisteri|Xynisteri|s|n-gpc-vino-espumoso|g||
n-gpc-xynomavro|Xynomavro|s|n-gpc-vino-espumoso|g||
n-gpc-yaca|Yaca|t|n-gpc-otras-frutas|g||
n-gpc-york|York|s|n-v-manzana|g||
n-gpc-zabergau-renette|Zabergau renette|s|n-v-manzana|g||
n-gpc-zailijskoje|Zailijskoje|s|n-v-manzana|g||
n-gpc-zapote-blanco|Zapote blanco|t|n-v-zapote|g||
n-gpc-zapote-negro|Zapote negro|t|n-v-zapote|g||
n-gpc-zari|Zari|s|n-v-manzana|g||
n-gpc-zenit|Zenit|s|n-gpc-vino-espumoso|g||
n-gpc-zghihara-de-husi|Zghihara de husi|s|n-gpc-vino-espumoso|g||
n-gpc-zhigulovskoje|Zhigulovskoje|s|n-v-manzana|g||
n-gpc-zibibbo|Zibibbo|s|n-gpc-vino-espumoso|g||
n-gpc-zigeunerin|Zigeunerin|s|n-v-manzana|g||
n-gpc-zinfandel|Zinfandel|s|n-gpc-vino-espumoso|g||
n-gpc-zoete-aagt|Zoete aagt|s|n-v-manzana|g||
n-gpc-zoete-bellefleur|Zoete bellefleur|s|n-v-manzana|g||
n-gpc-zoete-brederode|Zoete brederode|s|n-v-pera|g||
n-gpc-zoete-ermgaard|Zoete ermgaard|s|n-v-manzana|g||
n-gpc-zoete-kroon|Zoete kroon|s|n-v-manzana|g||
n-gpc-zoete-oranje|Zoete oranje|s|n-v-manzana|g||
n-gpc-zoete-pippeling|Zoete pippeling|s|n-v-manzana|g||
n-gpc-zonga|Zonga|s|n-v-manzana|g||
n-gpc-zuccalmaglio-renette|Zuccalmaglio renette|s|n-v-manzana|g||
n-gpc-zumo-de-fruta|Zumo de fruta|t|n-gpc-bebidas-sin-alcohol|g||ambiente,concentrado,congelado,listo para consumir,refrigerado
n-gpc-zumo-de-verdura|Zumo de verdura|t|n-gpc-bebidas-sin-alcohol|g||ambiente,concentrado,congelado,listo para consumir,refrigerado
n-gpc-zure-brederode-dikkop|Zure brederode (dikkop)|s|n-v-pera|g||
n-gpc-zuzi-gala|Zuzi gala|s|n-v-manzana|g||
n-gpc-zweigelt-blauer-zweigelt-rotburger|Zweigelt (blauer zweigelt/rotburger)|s|n-gpc-vino-espumoso|g||
n-gpc-zweigelt-merlot|Zweigelt/merlot|s|n-gpc-vino-espumoso|g||
n-gpc-zweigelt-merlot-blaufraenkisch-cab|Zweigelt/merlot/blaufraenkisch/cabernet sauvignon|s|n-gpc-vino-espumoso|g||
n-gpc-zwijndrechtse-wijnpeer|Zwijndrechtse wijnpeer|s|n-v-pera|g||
n-grocery|Despensa|f||a||
n-l-cuajada|Cuajada|t|n-yoghurt|a||
n-l-leche|Leche|t|n-milk|a|t|ambiente,congelado,refrigerado
n-l-mantequilla|Mantequilla|t|n-butter|a|t|ambiente,congelado,refrigerado
n-l-margarina|Margarina|t|n-butter|a||ambiente,congelado,refrigerado
n-l-nata|Nata|t|n-milk|a|t|ambiente,congelado,refrigerado
n-l-postre-lacteo|Postre lácteo|t|n-yoghurt|a|t|
n-l-yogur|Yogur|t|n-yoghurt|a||ambiente,congelado,refrigerado
n-lamb|Cordero y cabrito|c|n-meat|a||
n-lardo|Tocino|t|n-cured|a||
n-longaniza|Longaniza|t|n-sausage|a||
n-m-butifarra-blanca|Butifarra blanca|s|n-butifarra|a||
n-m-butifarra-fresca|Butifarra fresca|s|n-butifarra|a||
n-m-butifarra-negra|Butifarra negra|s|n-butifarra|a||
n-m-cecina-de-leon|Cecina de León|s|n-cecina|a||
n-m-chorizo-de-cantimpalos|Chorizo de Cantimpalos|s|n-chorizo|a||
n-m-chorizo-de-leon|Chorizo de León|s|n-chorizo|a||
n-m-chorizo-riojano|Chorizo riojano|s|n-chorizo|a||
n-m-jamon-de-teruel|Jamón de Teruel|s|n-ham|a||
n-m-jamon-de-trevelez|Jamón de Trevélez|s|n-ham|a||
n-m-jamon-iberico|Jamón ibérico|s|n-ham|a||
n-m-jamon-serrano|Jamón serrano|s|n-ham|a||
n-m-lomo-iberico|Lomo ibérico|s|n-cured-loin|a||
n-m-morcilla-asturiana|Morcilla asturiana|s|n-morcilla|a||
n-m-morcilla-de-burgos|Morcilla de Burgos|s|n-morcilla|a||
n-m-morcilla-de-leon|Morcilla de León|s|n-morcilla|a||
n-m-paleta-iberica|Paleta ibérica|s|n-shoulder-ham|a||
n-m-paleta-serrana|Paleta serrana|s|n-shoulder-ham|a||
n-m-salchichon-de-vic|Salchichón de Vic|s|n-salchichon|a||
n-m-sobrasada-de-mallorca|Sobrasada de Mallorca|s|n-sobrasada|a||
n-milk|Leche y nata|c|n-dairy|a||
n-morcilla|Morcilla|t|n-sausage|a||
n-morcon|Morcón|t|n-cured|a||
n-mortadela|Mortadela|t|n-cooked|a||
n-o-casqueria-de-cordero|Casquería de cordero|t|n-lamb|a|t|
n-o-churrasquitos-de-cordero|Churrasquitos de cordero|t|n-lamb|j||
n-o-cordero-entero|Cordero entero|t|n-lamb|a|t|
n-o-costillar-de-cordero|Costillar de cordero|t|n-lamb|i||
n-o-cuello-de-cordero|Cuello de cordero|t|n-lamb|i||
n-o-falda-de-cordero|Falda de cordero|t|n-lamb|i||
n-o-jarrete-de-cordero|Jarrete de cordero|t|n-lamb|i||
n-o-medallones-de-cordero|Medallones de cordero|t|n-lamb|j||
n-o-paletilla-de-cordero|Paletilla de cordero|t|n-lamb|i||
n-o-pierna-de-cordero|Pierna de cordero|t|n-lamb|i||
n-o-tournedo-de-cordero|Tournedó de cordero|t|n-lamb|j||
n-offal-lard|Manteca de cerdo|t|n-offal|a||
n-oils|Aceites y grasas|f||a||
n-p-abanico|Abanico|t|n-pork|a||
n-p-cabecera-de-lomo|Cabecera de lomo|t|n-pork|a||
n-p-careta|Careta|t|n-pork|a||
n-p-carne-picada-de-cerdo|Carne picada de cerdo|t|n-pork|a||
n-p-carrillera|Carrillera|t|n-pork|a||
n-p-chuletero-de-cerdo|Chuletero de cerdo|t|n-pork|a||
n-p-cochinillo|Cochinillo|t|n-pork|a|t|
n-p-codillo|Codillo|t|n-pork|a||
n-p-costillar-de-cerdo|Costillar de cerdo|t|n-pork|a||
n-p-jamon-fresco|Jamón fresco|t|n-pork|a||
n-p-lagarto|Lagarto|t|n-pork|a||
n-p-lomo-de-cerdo|Lomo de cerdo|t|n-pork|a||
n-p-magro-de-cerdo|Magro de cerdo|t|n-pork|a||
n-p-manitas|Manitas|t|n-pork|a||
n-p-oreja-de-cerdo|Oreja de cerdo|t|n-pork|a||
n-p-paletilla-de-cerdo|Paletilla de cerdo|t|n-pork|a||
n-p-panceta|Panceta|t|n-pork|a||
n-p-papada|Papada|t|n-pork|a||
n-p-pluma|Pluma|t|n-pork|a||
n-p-presa|Presa|t|n-pork|a||
n-p-rabo-de-cerdo|Rabo de cerdo|t|n-pork|a||
n-p-secreto|Secreto|t|n-pork|a||
n-p-solomillo-de-cerdo|Solomillo de cerdo|t|n-pork|a||
n-panceta-curada|Panceta curada|t|n-cured|a||
n-papada-curada|Papada curada|t|n-cured|a||
n-pate|Paté|t|n-cooked|a||ambiente,congelado,refrigerado
n-preserves|Conservas y encurtidos|f||a||
n-pulses|Legumbre y arroz|f||a||
n-q-burrata|Burrata|t|n-cheese|a||
n-q-queso-azul|Queso azul|t|n-cheese|a||
n-q-queso-brie|Queso brie|t|n-cheese|g||
n-q-queso-cabrales|Queso cabrales|t|n-cheese|g||
n-q-queso-camembert|Queso camembert|t|n-cheese|g||
n-q-queso-cheddar|Queso cheddar|t|n-cheese|a||
n-q-queso-crema|Queso crema|t|n-cheese|a||
n-q-queso-de-burgos|Queso de Burgos|t|n-cheese|a||
n-q-queso-de-cabra|Queso de cabra|t|n-cheese|a||
n-q-queso-de-mezcla|Queso de mezcla|t|n-cheese|a||
n-q-queso-de-oveja|Queso de oveja|t|n-cheese|a||
n-q-queso-de-untar|Queso de untar|t|n-cheese|a||
n-q-queso-de-vaca|Queso de vaca|t|n-cheese|a||
n-q-queso-edam|Queso edam|t|n-cheese|g||
n-q-queso-emmental|Queso emmental|t|n-cheese|a||
n-q-queso-en-lonchas|Queso en lonchas|t|n-cheese|a||
n-q-queso-feta|Queso feta|t|n-cheese|g||
n-q-queso-fresco|Queso fresco|t|n-cheese|a||
n-q-queso-gouda|Queso gouda|t|n-cheese|a||
n-q-queso-gruyere|Queso gruyère|t|n-cheese|g||
n-q-queso-halloumi|Queso halloumi|t|n-cheese|g||
n-q-queso-havarti|Queso havarti|t|n-cheese|g||
n-q-queso-idiazabal|Queso idiazábal|t|n-cheese|a||
n-q-queso-mahon|Queso mahón|t|n-cheese|a||
n-q-queso-majorero|Queso majorero|t|n-cheese|a||
n-q-queso-manchego|Queso manchego|t|n-cheese|a||
n-q-queso-mozzarella|Queso mozzarella|t|n-cheese|a||
n-q-queso-parmesano|Queso parmesano|t|n-cheese|a||
n-q-queso-pecorino|Queso pecorino|t|n-cheese|g||
n-q-queso-provolone|Queso provolone|t|n-cheese|g||
n-q-queso-raclette|Queso raclette|t|n-cheese|g||
n-q-queso-rallado|Queso rallado|t|n-cheese|a||
n-q-queso-ricotta|Queso ricotta|t|n-cheese|g||
n-q-queso-stilton|Queso stilton|t|n-cheese|g||
n-q-queso-taleggio|Queso taleggio|t|n-cheese|g||
n-q-queso-tetilla|Queso tetilla|t|n-cheese|a||
n-q-requeson|Requesón|t|n-cheese|g||
n-rabbit|Conejo|c|n-game|a|t|elaborado,sin elaborar
n-root|Raíces y tubérculos|c|n-produce|a||cortado
n-salchicha|Salchicha fresca|t|n-sausage|a||
n-salchichon|Salchichón|t|n-sausage|a||
n-sausage-cured|Secallona|t|n-sausage|a||
n-seaweed|Algas|c|n-fish|a||ambiente,congelado,refrigerado
n-shoulder-ham|Paleta|t|n-cured|a||
n-sobrasada|Sobrasada|t|n-sausage|a||
n-turkey|Pavo|c|n-poultry|a|t|elaborado,sin elaborar
n-turkey-cold|Fiambre de pavo|t|n-cooked|a||
n-v-acelas-de-hojas-lisas|Acelas de hojas lisas|s|n-v-acelga|m|t|
n-v-acelga|Acelga|t|n-vegetable|m|t|
n-v-acelgas-de-hojas-rizadas|Acelgas de hojas rizadas|s|n-v-acelga|m|t|
n-v-achicoria|Achicoria|s|n-v-endivia|m|t|
n-v-aguacate-fuerte|Aguacate fuerte|s|n-avocado|m|t|
n-v-aguacate-hass|Aguacate hass|s|n-avocado|m|t|
n-v-ajo|Ajo|t|n-vegetable|m|t|
n-v-ajo-morado|Ajo morado|s|n-v-ajo|m|t|
n-v-ajo-tierno|Ajo tierno|s|n-v-ajo|m|t|
n-v-ajos-secos|Ajos secos|s|n-v-ajo|m|t|
n-v-albaricoque|Albaricoque|t|n-fruit|m|t|
n-v-albaricoque-comun|Albaricoque comun|s|n-v-albaricoque|m|t|
n-v-albaricoque-galta-roja|Albaricoque galta roja|s|n-v-albaricoque|m|t|
n-v-albaricoques-antones|Albaricoques antones|s|n-v-albaricoque|m|t|
n-v-albaricoques-bulida|Albaricoques bulida|s|n-v-albaricoque|m|t|
n-v-albaricoques-mauricio|Albaricoques mauricio|s|n-v-albaricoque|m|t|
n-v-albaricoques-moniqui|Albaricoques moniqui|s|n-v-albaricoque|m|t|
n-v-albaricoques-pepito|Albaricoques pepito|s|n-v-albaricoque|m|t|
n-v-albaricoques-velazquez|Albaricoques velazquez|s|n-v-albaricoque|m|t|
n-v-alcachofa|Alcachofa|t|n-vegetable|m|t|
n-v-alcachofa-blanca-tudela|Alcachofa blanca tudela|s|n-v-alcachofa|m|t|
n-v-alcachofa-violeta|Alcachofa violeta|s|n-v-alcachofa|m|t|
n-v-alcachofas-de-levante|Alcachofas de levante|s|n-v-alcachofa|m|t|
n-v-alcachofas-del-terreno|Alcachofas del terreno|s|n-v-alcachofa|m|t|
n-v-almendra-largueta-tostada|Almendra largueta tostada|s|n-d-fruto-seco|m|t|
n-v-alpicoce|Alpicoce|t|n-vegetable|m|t|
n-v-apio|Apio|t|n-vegetable|m|t|
n-v-apio-amarillento|Apio amarillento|s|n-v-apio|m|t|
n-v-apio-blanco|Apio blanco|s|n-v-apio|m|t|
n-v-apio-verde|Apio verde|s|n-v-apio|m|t|
n-v-apionabo|Apionabo|s|n-v-apio|m|t|
n-v-arandano|Arándano|t|n-fruit|m|t|
n-v-bananito|Bananito|t|n-fruit|m|t|
n-v-batata|Batata|t|n-vegetable|m|t|
n-v-batatas-de-lanzarote|Batatas de lanzarote|s|n-v-batata|m|t|
n-v-batatas-yema-de-huevo|Batatas yema de huevo|s|n-v-batata|m|t|
n-v-bellota|Bellota|t|n-fruit|m|t|
n-v-berenjena|Berenjena|t|n-vegetable|m|t|
n-v-berenjenas-blancas|Berenjenas blancas|s|n-v-berenjena|m|t|
n-v-berenjenas-moradas|Berenjenas moradas|s|n-v-berenjena|m|t|
n-v-berro|Berro|t|n-vegetable|m|t|
n-v-boniato|Boniato|t|n-vegetable|m|t|
n-v-borraja|Borraja|t|n-vegetable|m|t|
n-v-borraja-de-huerta|Borraja de huerta|s|n-v-borraja|m|t|
n-v-borraja-invernadero|Borraja invernadero|s|n-v-borraja|m|t|
n-v-breva|Breva|t|n-fruit|m|t|
n-v-brocoli|Brocoli|t|n-vegetable|m|t|
n-v-brotes-tiernos|Brotes tiernos|s|n-v-ensalada-preparada|a||
n-v-cacahuete-con-sal|Cacahuete con sal|s|n-d-fruto-seco|m|t|
n-v-cacahuete-sin-sal|Cacahuete sin sal|s|n-d-fruto-seco|m|t|
n-v-calabacin-blanco|Calabacín blanco|s|n-courgette|m|t|
n-v-calabacin-minicalabacin|Calabacin minicalabacin|s|n-courgette|m|t|
n-v-calabacin-verde|Calabacin verde|s|n-courgette|m|t|
n-v-calabaza|Calabaza|t|n-vegetable|m|t|
n-v-calabaza-de-verano|Calabaza de verano|s|n-v-calabaza|m|t|
n-v-calabazas-redonda|Calabazas redonda|s|n-v-calabaza|m|t|
n-v-calabazas-violin|Calabazas violin|s|n-v-calabaza|m|t|
n-v-caqui|Caqui|t|n-fruit|m|t|cortado
n-v-caqui-rojo-brillante|Caqui rojo brillante|s|n-v-caqui|m|t|
n-v-caqui-sharon|Caqui sharon|s|n-v-caqui|m|t|
n-v-carambola|Carambola|t|n-fruit|m|t|
n-v-cardo|Cardo|t|n-vegetable|m|t|
n-v-carlota|Carlota|t|n-vegetable|m|t|
n-v-castana|Castaña|t|n-fruit|m|t|
n-v-cebolla|Cebolla|t|n-vegetable|m|t|
n-v-cebolla-babosa|Cebolla babosa|s|n-v-cebolla|m|t|
n-v-cebolla-blanca-dulce|Cebolla blanca dulce|s|n-v-cebolla|m|t|
n-v-cebolla-calcots|Cebolla calçots|s|n-v-cebolla|m|t|
n-v-cebolla-francesa-echalote|Cebolla francesa/echalote|s|n-v-cebolla|m|t|
n-v-cebolla-grano-de-oro|Cebolla grano de oro|s|n-v-cebolla|m|t|
n-v-cebolla-liria|Cebolla liria|s|n-v-cebolla|m|t|
n-v-cebolla-morada|Cebolla morada|s|n-v-cebolla|m|t|
n-v-cebolla-nueva|Cebolla nueva|s|n-v-cebolla|m|t|
n-v-cebolla-tierna|Cebolla tierna|s|n-v-cebolla|m|t|
n-v-cebolla-valenciana|Cebolla valenciana|s|n-v-cebolla|m|t|
n-v-cebollino|Cebollino|t|n-vegetable|m|t|
n-v-cereza|Cereza|t|n-fruit|m|t|
n-v-cereza-burlat-sin-rabo|Cereza burlat sin rabo|s|n-v-cereza|m|t|
n-v-cereza-california-s-rabo|Cereza california s. rabo|s|n-v-cereza|m|t|
n-v-cereza-de-aragon|Cereza de aragon|s|n-v-cereza|m|t|
n-v-cereza-navalinda|Cereza navalinda|s|n-v-cereza|m|t|
n-v-cereza-starking|Cereza starking|s|n-v-cereza|m|t|
n-v-cereza-sumi|Cereza sumi|s|n-v-cereza|m|t|
n-v-cereza-temprana|Cereza temprana|s|n-v-cereza|m|t|
n-v-cerezas-ambrunesas|Cerezas ambrunesas|s|n-v-cereza|m|t|
n-v-cerezas-barbosas|Cerezas barbosas|s|n-v-cereza|m|t|
n-v-cerezas-burlat|Cerezas burlat|s|n-v-cereza|m|t|
n-v-cerezas-california|Cerezas california|s|n-v-cereza|m|t|
n-v-cerezas-guindas|Cerezas guindas|s|n-v-cereza|m|t|
n-v-cerezas-jarandilla|Cerezas jarandilla|s|n-v-cereza|m|t|
n-v-cerezas-mollares|Cerezas mollares|s|n-v-cereza|m|t|
n-v-cerezas-pico-colorado|Cerezas pico colorado|s|n-v-cereza|m|t|
n-v-cerezas-pico-negro|Cerezas pico negro|s|n-v-cereza|m|t|
n-v-cerezas-picotas|Cerezas picotas|s|n-v-cereza|m|t|
n-v-champinon|Champiñon|t|n-vegetable|m|t|
n-v-chirimoya|Chirimoya|t|n-fruit|m|t|
n-v-chirimoya-campas|Chirimoya campas|s|n-v-chirimoya|m|t|
n-v-chirimoya-chile|Chirimoya chile|s|n-v-chirimoya|m|t|
n-v-chirimoya-fina-de-jete|Chirimoya fina de jete|s|n-v-chirimoya|m|t|
n-v-chirivia|Chirivia|t|n-vegetable|m|t|
n-v-ciruela|Ciruela|t|n-fruit|m|t|
n-v-ciruela-anaspar|Ciruela anaspar|s|n-v-ciruela|m|t|
n-v-ciruela-angeleno|Ciruela angeleno|s|n-v-ciruela|m|t|
n-v-ciruela-arandana|Ciruela arandana|s|n-v-ciruela|m|t|
n-v-ciruela-fresa|Ciruela fresa|s|n-v-ciruela|m|t|
n-v-ciruela-miel-oro|Ciruela miel oro|s|n-v-ciruela|m|t|
n-v-ciruela-otra-familia-blac|Ciruela otra familia blac|s|n-v-ciruela|m|t|
n-v-ciruela-red-beauty|Ciruela red beauty|s|n-v-ciruela|m|t|
n-v-ciruela-sun-gold|Ciruela sun gold|s|n-v-ciruela|m|t|
n-v-ciruelas-bentheley|Ciruelas bentheley|s|n-v-ciruela|m|t|
n-v-ciruelas-claudia-francesa|Ciruelas claudia francesa|s|n-v-ciruela|m|t|
n-v-ciruelas-frial|Ciruelas frial|s|n-v-ciruela|m|t|
n-v-ciruelas-golden|Ciruelas golden|s|n-v-ciruela|m|t|
n-v-ciruelas-japan|Ciruelas japan|s|n-v-ciruela|m|t|
n-v-ciruelas-metheley|Ciruelas metheley|s|n-v-ciruela|m|t|
n-v-ciruelas-moradas|Ciruelas moradas|s|n-v-ciruela|m|t|
n-v-ciruelas-prunos|Ciruelas prunos|s|n-v-ciruela|m|t|
n-v-ciruelas-reina-claudia|Ciruelas reina claudia|s|n-v-ciruela|m|t|
n-v-ciruelas-santa-rosa|Ciruelas santa rosa|s|n-v-ciruela|m|t|
n-v-ciruelas-secas|Ciruelas secas|s|n-v-ciruela|m|t|
n-v-ciruelas-tolosa|Ciruelas tolosa|s|n-v-ciruela|m|t|
n-v-coco|Coco|t|n-fruit|m|t|
n-v-coco-en-verde|Coco en verde|s|n-v-coco|m|t|
n-v-cogollos|Cogollos|s|n-v-lechuga|m|t|
n-v-col-china|Col china|s|n-v-coles-repollo|m|t|
n-v-col-hojas-lisas|Col hojas lisas|s|n-v-coles-repollo|m|t|
n-v-col-lombarda|Col lombarda|s|n-v-lombarda|m|t|
n-v-coles-de-bruselas|Coles de bruselas|s|n-v-coles-repollo|m|t|
n-v-coles-repollo|Coles-repollo|t|n-vegetable|m|t|
n-v-coles-repollo-frances|Coles repollo -frances-|s|n-v-coles-repollo|m|t|
n-v-coliflor|Coliflor|t|n-vegetable|m|t|
n-v-crema-de-verduras|Crema de verduras|t|n-vegetable|a||
n-v-cuarta-gama-hort|Cuarta gama hort.|t|n-vegetable|m|t|
n-v-cuarta-gama-hortalizas|Cuarta gama hortalizas|s|n-v-cuarta-gama-hort|m|t|
n-v-curuba|Curuba|t|n-fruit|m|t|
n-v-datil|Datil|t|n-fruit|m|t|
n-v-datil-deglet-nour|Datil deglet nour|s|n-v-datil|m|t|
n-v-datil-medjoul|Datil medjoul|s|n-v-datil|m|t|
n-v-eddo|Eddo|t|n-root|m|t|
n-v-endivia|Endivia|t|n-vegetable|m|t|
n-v-endivia-roja|Endivia roja|s|n-v-endivia|m|t|
n-v-ensalada-cuatro-estaciones|Ensalada cuatro estaciones|s|n-v-ensalada-preparada|a||
n-v-ensalada-preparada|Ensalada preparada|t|n-vegetable|a||
n-v-escarola|Escarola|t|n-vegetable|m|t|
n-v-escarola-lisa|Escarola lisa|s|n-v-escarola|m|t|
n-v-esparrago|Esparrago|t|n-vegetable|m|t|
n-v-esparrago-verde|Esparrago verde|s|n-v-esparrago|m|t|
n-v-esparragos-blancos|Esparragos blancos|s|n-v-esparrago|m|t|
n-v-espinaca|Espinaca|t|n-vegetable|m|t|cortado
n-v-fisali|Fisali|t|n-fruit|m|t|
n-v-fisalis-amarillo-enano|Fisalis amarillo enano|s|n-v-fisali|m|t|
n-v-fisalis-golden-berry|Fisalis golden berry|s|n-v-fisali|m|t|
n-v-fisalis-tomatillo|Fisalis tomatillo|s|n-v-fisali|m|t|
n-v-flores-comestibl|Flores comestibl|t|n-vegetable|m|t|
n-v-frambuesa|Frambuesa|t|n-fruit|m|t|
n-v-frambuesa-invierno|Frambuesa invierno|s|n-v-frambuesa|m|t|
n-v-frambuesa-verano|Frambuesa verano|s|n-v-frambuesa|m|t|
n-v-fresa|Fresa|t|n-fruit|m|t|
n-v-freson|Freson|t|n-fruit|m|t|
n-v-freson-camarrosa|Freson camarrosa|s|n-v-freson|m|t|
n-v-freson-candonga|Freson candonga|s|n-v-freson|m|t|
n-v-freson-chile|Freson chile|s|n-v-freson|m|t|
n-v-freson-fortuna|Fresón fortuna|s|n-v-freson|m|t|
n-v-freson-francia|Freson francia|s|n-v-freson|m|t|
n-v-freson-oso-grande|Freson oso grande|s|n-v-freson|m|t|
n-v-freson-pajaro|Freson pajaro|s|n-v-freson|m|t|
n-v-freson-tudla|Freson tudla|s|n-v-freson|m|t|
n-v-freson-ventana|Freson ventana|s|n-v-freson|m|t|
n-v-fresquilla|Fresquilla|t|n-fruit|m|t|
n-v-garrofon|Garrofon|t|n-vegetable|m|t|
n-v-germinado|Germinado|t|n-vegetable|m|t|listo para consumir
n-v-granada|Granada|t|n-fruit|m|t|
n-v-granada-grano-de-elche|Granada grano de elche|s|n-v-granada|m|t|
n-v-granada-mollar-de-jativa|Granada mollar de jativa|s|n-v-granada|m|t|
n-v-grelo|Grelo|t|n-vegetable|m|t|
n-v-grosella|Grosella|t|n-fruit|m|t|
n-v-grosella-blanca|Grosella blanca|s|n-v-grosella|m|t|
n-v-grosella-roja|Grosella roja|s|n-v-grosella|m|t|
n-v-guanabana|Guanábana|t|n-fruit|m|t|
n-v-guayabo|Guayabo|t|n-fruit|m|t|
n-v-guayabo-cas|Guayabo cas|s|n-v-guayabo|m|t|
n-v-guindilla|Guindilla|t|n-vegetable|m|t|
n-v-guindillas-rojas|Guindillas rojas|s|n-v-guindilla|m|t|
n-v-guindillas-verdes|Guindillas verdes|s|n-v-guindilla|m|t|
n-v-guisante|Guisante|t|n-vegetable|m|t|
n-v-habas-verd|Habas verd|t|n-vegetable|m|t|
n-v-higo|Higo|t|n-fruit|m|t|
n-v-higo-chumbo|Higo chumbo|t|n-fruit|m|t|
n-v-higos-negros|Higos negros|s|n-v-higo|m|t|
n-v-higos-secos|Higos secos|s|n-v-higo|m|t|
n-v-higos-verdes|Higos verdes|s|n-v-higo|m|t|
n-v-hinojo|Hinojo|t|n-vegetable|m|t|
n-v-jengibre|Jengibre|t|n-root|m|t|
n-v-judia-verde-boby|Judia verde boby|s|n-v-judias-verd|m|t|
n-v-judia-verde-gallega|Judia verde gallega|s|n-v-judias-verd|m|t|
n-v-judia-verde-helda|Judia verde helda|s|n-v-judias-verd|m|t|
n-v-judia-verde-marruecos|Judia verde marruecos|s|n-v-judias-verd|m|t|
n-v-judias-verd|Judias verd|t|n-vegetable|m|t|
n-v-judias-verdes-garrafal|Judias verdes garrafal|s|n-v-judias-verd|m|t|
n-v-judias-verdes-perona|Judias verdes perona|s|n-v-judias-verd|m|t|
n-v-kale|Kale|t|n-vegetable|m|t|
n-v-kiwano|Kiwano|t|n-fruit|m|t|
n-v-kiwi|Kiwi|t|n-fruit|m|t|cortado
n-v-kiwi-c-e-e|Kiwi c.e.e.|s|n-v-kiwi|m|t|
n-v-kiwi-chile|Kiwi chile|s|n-v-kiwi|m|t|
n-v-kiwi-francia|Kiwi francia|s|n-v-kiwi|m|t|
n-v-kiwi-grecia|Kiwi grecia|s|n-v-kiwi|m|t|
n-v-kiwi-italia|Kiwi italia|s|n-v-kiwi|m|t|
n-v-kiwi-kiwigold|Kiwi kiwigold|s|n-v-kiwi|m|t|
n-v-kiwi-nueva-zelanda|Kiwi nueva zelanda|s|n-v-kiwi|m|t|
n-v-kiwi-pulpa-verde|Kiwi pulpa verde|s|n-v-kiwi|m|t|
n-v-kumkuat|Kumkuat|s|n-v-kunkuat|m|t|
n-v-kunkuat|Kunkuat|t|n-fruit|m|t|
n-v-laurel|Laurel|t|n-vegetable|m|t|
n-v-lechuga|Lechuga|t|n-vegetable|m|t|
n-v-lechuga-batavia|Lechuga batavia|s|n-v-lechuga|m|t|
n-v-lechuga-hoja-de-roble|Lechuga hoja de roble|s|n-v-lechuga|m|t|
n-v-lechuga-lollo-rosso|Lechuga lollo rosso|s|n-v-lechuga|m|t|
n-v-lechuga-trocadero|Lechuga trocadero|s|n-v-lechuga|m|t|
n-v-lechugas-iceberg|Lechugas iceberg|s|n-v-lechuga|m|t|
n-v-lechugas-romanas|Lechugas romanas|s|n-v-lechuga|m|t|
n-v-lima|Lima|t|n-fruit|m|t|
n-v-lima-mejicana|Lima mejicana|s|n-v-lima|m|t|
n-v-lima-persian|Lima persian|s|n-v-lima|m|t|
n-v-limon|Limon|t|n-fruit|m|t|
n-v-limon-eureka|Limon eureka|s|n-v-limon|m|t|
n-v-limon-eureka-argentina|Limon eureka argentina|s|n-v-limon|m|t|
n-v-limon-eureka-sudafrica|Limon eureka sudafrica|s|n-v-limon|m|t|
n-v-limon-primafiori|Limon primafiori|s|n-v-limon|m|t|
n-v-limon-rodrejo|Limon rodrejo|s|n-v-limon|m|t|
n-v-limones-comun|Limones comun|s|n-v-limon|m|t|
n-v-limones-verna|Limones verna|s|n-v-limon|m|t|
n-v-litchi|Litchi|t|n-fruit|m|t|
n-v-lombarda|Lombarda|t|n-vegetable|m|t|
n-v-mache|Mache|t|n-vegetable|m|t|
n-v-mache-o-berros|Mache o berros|s|n-v-mache|m|t|
n-v-maiz|Maiz|t|n-vegetable|m|t|
n-v-mandarina|Mandarina|t|n-fruit|m|t|
n-v-mandarina-clemen-late|Mandarina clemen late|s|n-v-mandarina|m|t|
n-v-mandarina-clemen-pons|Mandarina clemen pons|s|n-v-mandarina|m|t|
n-v-mandarina-nadorcott|Mandarina nadorcott|s|n-v-mandarina|m|t|
n-v-mandarina-okitsu|Mandarina okitsu|s|n-v-mandarina|m|t|
n-v-mandarina-oronules|Mandarina oronules|s|n-v-mandarina|m|t|
n-v-mandarina-oroval|Mandarina oroval|s|n-v-mandarina|m|t|
n-v-mandarina-orri|Mandarina orri|s|n-v-mandarina|m|t|
n-v-mandarina-ortanique|Mandarina ortanique|s|n-v-mandarina|m|t|
n-v-mandarinas-clausellinas|Mandarinas clausellinas|s|n-v-mandarina|m|t|
n-v-mandarinas-clementinas|Mandarinas clementinas|s|n-v-mandarina|m|t|
n-v-mandarinas-clemenules|Mandarinas clemenules|s|n-v-mandarina|m|t|
n-v-mandarinas-clemenvilles|Mandarinas clemenvilles|s|n-v-mandarina|m|t|
n-v-mandarinas-fortuna|Mandarinas fortuna|s|n-v-mandarina|m|t|
n-v-mandarinas-hernandina|Mandarinas hernandina|s|n-v-mandarina|m|t|
n-v-mandarinas-marisol|Mandarinas marisol|s|n-v-mandarina|m|t|
n-v-mandarinas-satsumas|Mandarinas satsumas|s|n-v-mandarina|m|t|
n-v-manga|Manga|t|n-fruit|m|t|
n-v-manga-keitt|Manga keitt|s|n-v-manga|m|t|
n-v-manga-kent|Manga kent|s|n-v-manga|m|t|
n-v-mango-haden|Mango haden|s|n-mango|m|t|
n-v-mango-tommy-atkins|Mango tommy atkins|s|n-mango|m|t|
n-v-mangostan|Mangostan|t|n-fruit|m|t|
n-v-manza-royal-gala|Manza. royal gala|s|n-v-manzana|m|t|
n-v-manzana|Manzana|t|n-fruit|m|t|
n-v-manzana-fuji|Manzana fuji|s|n-v-manzana|m|t|
n-v-manzana-g-smith|Manzana g. smith .|s|n-v-manzana|m|t|
n-v-manzana-granny-smith|Manzana granny smith|s|n-v-manzana|m|t|
n-v-manzana-pink-lady|Manzana pink lady|s|n-v-manzana|m|t|
n-v-manzana-royal-gala|Manzana royal gala|s|n-v-manzana|m|t|
n-v-manzana-royal-gala-import|Manzana royal gala import|s|n-v-manzana|m|t|
n-v-manzana-starking-argentin|Manzana starking argentin|s|n-v-manzana|m|t|
n-v-manzana-starking-ee-uu|Manzana starking ee.uu.|s|n-v-manzana|m|t|
n-v-manzanas-bellezas|Manzanas bellezas|s|n-v-manzana|m|t|
n-v-manzanas-g-smith|Manzanas g.smith|s|n-v-manzana|m|t|
n-v-manzanas-golden|Manzanas golden|s|n-v-manzana|m|t|
n-v-manzanas-reineta|Manzanas reineta|s|n-v-manzana|m|t|
n-v-manzanas-starking|Manzanas starking|s|n-v-manzana|m|t|
n-v-manzanas-starking-importa|Manzanas starking importa|s|n-v-manzana|m|t|
n-v-manzanas-verde-doncella|Manzanas verde doncella|s|n-v-manzana|m|t|
n-v-maracuya|Maracuya|t|n-fruit|m|t|
n-v-melocoton|Melocoton|t|n-fruit|m|t|
n-v-melocoton-andross|Melocoton andross|s|n-v-melocoton|m|t|
n-v-melocoton-carne-blanca|Melocoton carne blanca|s|n-v-melocoton|m|t|
n-v-melocoton-chile|Melocoton chile|s|n-v-melocoton|m|t|
n-v-melocoton-merryl-elegant|Melocoton merryl elegant|s|n-v-melocoton|m|t|
n-v-melocoton-merryl-francisc|Melocoton merryl francisc|s|n-v-melocoton|m|t|
n-v-melocoton-rojo|Melocoton rojo|s|n-v-melocoton|m|t|
n-v-melocoton-royal-glory|Melocoton royal glory|s|n-v-melocoton|m|t|
n-v-melocoton-temprano|Melocoton temprano|s|n-v-melocoton|m|t|
n-v-melocoton-tirrenia|Melocoton tirrenia|s|n-v-melocoton|m|t|
n-v-melocotones-a-dunas|Melocotones a.dunas|s|n-v-melocoton|m|t|
n-v-melocotones-amarillo|Melocotones amarillo|s|n-v-melocoton|m|t|
n-v-melocotones-baby-gold|Melocotones baby gold|s|n-v-melocoton|m|t|
n-v-melocotones-calanda|Melocotones calanda|s|n-v-melocoton|m|t|
n-v-melocotones-campiel|Melocotones campiel|s|n-v-melocoton|m|t|
n-v-melocotones-cardinal|Melocotones cardinal|s|n-v-melocoton|m|t|
n-v-melocotones-catherine|Melocotones catherine|s|n-v-melocoton|m|t|
n-v-melocotones-dixi-red|Melocotones dixi red|s|n-v-melocoton|m|t|
n-v-melocotones-jeronimos|Melocotones jeronimos|s|n-v-melocoton|m|t|
n-v-melocotones-lohabel|Melocotones lohabel|s|n-v-melocoton|m|t|
n-v-melocotones-maruja|Melocotones maruja|s|n-v-melocoton|m|t|
n-v-melocotones-pipas|Melocotones pipas|s|n-v-melocoton|m|t|
n-v-melocotones-red-gallur|Melocotones red gallur|s|n-v-melocoton|m|t|
n-v-melocotones-red-glober|Melocotones red glober|s|n-v-melocoton|m|t|
n-v-melocotones-red-haven|Melocotones red haven|s|n-v-melocoton|m|t|
n-v-melocotones-rojo-gallur|Melocotones rojo gallur|s|n-v-melocoton|m|t|
n-v-melocotones-springtime|Melocotones springtime|s|n-v-melocoton|m|t|
n-v-melocotones-sudanel|Melocotones sudanel|s|n-v-melocoton|m|t|
n-v-melocotones-vesubio|Melocotones vesubio|s|n-v-melocoton|m|t|
n-v-melon|Melon|t|n-fruit|m|t|cortado
n-v-melon-categoria|Melon categoria|s|n-v-melon|m|t|
n-v-melones-amarillo|Melones amarillo|s|n-v-melon|m|t|
n-v-melones-cantaloup|Melones cantaloup|s|n-v-melon|m|t|
n-v-melones-futuro|Melones futuro|s|n-v-melon|m|t|
n-v-melones-galia|Melones galia|s|n-v-melon|m|t|
n-v-melones-goloso|Melones goloso|s|n-v-melon|m|t|
n-v-melones-mochuelo|Melones mochuelo|s|n-v-melon|m|t|
n-v-melones-piel-de-sapo|Melones piel de sapo|s|n-v-melon|m|t|
n-v-melones-roche|Melones roche|s|n-v-melon|m|t|
n-v-melones-tendrall|Melones tendrall|s|n-v-melon|m|t|
n-v-membrillo|Membrillo|t|n-fruit|m|t|
n-v-menestra|Menestra|t|n-vegetable|a|t|
n-v-mezclum|Mezclum|s|n-v-ensalada-preparada|a||
n-v-microvegetal|Microvegetal|t|n-vegetable|m|t|cortado
n-v-nabo|Nabo|t|n-vegetable|m|t|
n-v-nabo-similares|Nabo similares|s|n-v-nabo|m|t|
n-v-name-o-yame|Ñame o yame|t|n-root|m|t|
n-v-naranja|Naranja|t|n-fruit|m|t|
n-v-naranja-grano-de-oro|Naranja grano de oro|s|n-v-naranja|m|t|
n-v-naranja-lane-late|Naranja lane late|s|n-v-naranja|m|t|
n-v-naranja-navel-late|Naranja navel late|s|n-v-naranja|m|t|
n-v-naranja-navel-late-sudafr|Naranja navel late sudafr|s|n-v-naranja|m|t|
n-v-naranja-navel-powel|Naranja navel powel|s|n-v-naranja|m|t|
n-v-naranja-navel-sudafrica|Naranja navel sudafrica|s|n-v-naranja|m|t|
n-v-naranja-navelina|Naranja navelina|s|n-v-naranja|m|t|
n-v-naranja-salustiana|Naranja salustiana|s|n-v-naranja|m|t|
n-v-naranja-sanguina|Naranja sanguina|s|n-v-naranja|m|t|
n-v-naranja-val-late-argent|Naranja val. late argent.|s|n-v-naranja|m|t|
n-v-naranja-val-late-sudafr|Naranja val. late sudafr.|s|n-v-naranja|m|t|
n-v-naranja-valencia-late|Naranja valencia late|s|n-v-naranja|m|t|
n-v-naranjas-navel|Naranjas navel|s|n-v-naranja|m|t|
n-v-nashi|Nashi|t|n-fruit|m|t|
n-v-nashi-amarillo|Nashi amarillo|s|n-v-nashi|m|t|
n-v-nashi-oscuro|Nashi oscuro|s|n-v-nashi|m|t|
n-v-nectarina|Nectarina|t|n-fruit|m|t|
n-v-nectarina-carne-amarilla|Nectarina carne amarilla|s|n-v-nectarina|m|t|
n-v-nectarina-carne-blanca|Nectarina carne blanca|s|n-v-nectarina|m|t|
n-v-nectarina-carne-roja|Nectarina carne roja|s|n-v-nectarina|m|t|
n-v-nispero|Nispero|t|n-fruit|m|t|
n-v-nispero-algerie-o-argelin|Nispero algerie o argelin|s|n-v-nispero|m|t|
n-v-nispero-tanaka|Nispero tanaka|s|n-v-nispero|m|t|
n-v-nuece|Nuece|t|n-fruit|m|t|
n-v-nueces-de-california|Nueces de california|s|n-v-nuece|m|t|
n-v-nueces-de-francia|Nueces de francia|s|n-v-nuece|m|t|
n-v-nuez-de-chile|Nuez de chile|s|n-v-nuece|m|t|
n-v-ocra|Ocra|t|n-fruit|m|t|
n-v-pak-choi|Pak choi|t|n-vegetable|m|t|
n-v-panchito-con-piel|Panchito con piel|s|n-d-fruto-seco|m|t|
n-v-panchito-sin-piel|Panchito sin piel|s|n-d-fruto-seco|m|t|
n-v-papaya-gigante|Papaya gigante|t|n-fruit|m|t|
n-v-papaya-grupo-solo-o-sunri|Papaya grupo solo o sunri|s|n-v-papaya-gigante|m|t|
n-v-papayo|Papayo|t|n-fruit|m|t|
n-v-paraguaya|Paraguaya|t|n-fruit|m|t|
n-v-paraguayo-o-platereta|Paraguayo o platereta|s|n-v-paraguaya|m|t|
n-v-paraguayo-ufo-4|Paraguayo ufo 4|s|n-v-paraguaya|m|t|
n-v-parchita|Parchita|t|n-fruit|m|t|
n-v-parchita-f-de-la-p-morada|Parchita/f de la p morada|s|n-v-parchita|m|t|
n-v-parchita-o-f-de-la-pas-o|Parchita o f de la pas o|s|n-v-parchita|m|t|
n-v-patata|Patata|t|n-vegetable|m|t|
n-v-patata-agata|Patata agata|s|n-v-patata|m|t|
n-v-patata-agata-confeccionad|Patata agata confeccionad|s|n-v-patata|m|t|
n-v-patata-agria|Patata agria|s|n-v-patata|m|t|
n-v-patata-agria-confeccionad|Patata agria confeccionad|s|n-v-patata|m|t|
n-v-patata-baraka|Patata baraka|s|n-v-patata|m|t|
n-v-patata-bintje|Patata bintje|s|n-v-patata|m|t|
n-v-patata-bintje-confecciona|Patata bintje confecciona|s|n-v-patata|m|t|
n-v-patata-blanca|Patata blanca|s|n-v-patata|m|t|
n-v-patata-bonita-color-conf|Patata bonita color conf|s|n-v-patata|m|t|
n-v-patata-bonita-colorada-gr|Patata bonita colorada gr|s|n-v-patata|m|t|
n-v-patata-bonita-eur|Patata bonita eur.|s|n-v-patata|m|t|
n-v-patata-bonita-europ-conf|Patata bonita europ. conf|s|n-v-patata|m|t|
n-v-patata-bonita-negra-confe|Patata bonita negra confe|s|n-v-patata|m|t|
n-v-patata-bonita-negra-grane|Patata bonita negra grane|s|n-v-patata|m|t|
n-v-patata-caesar|Patata caesar|s|n-v-patata|m|t|
n-v-patata-caesar-confecciona|Patata caesar confecciona|s|n-v-patata|m|t|
n-v-patata-claustar|Patata claustar|s|n-v-patata|m|t|
n-v-patata-claustar-confeccio|Patata claustar confeccio|s|n-v-patata|m|t|
n-v-patata-desiree|Patata desiree|s|n-v-patata|m|t|
n-v-patata-egipto|Patata egipto|s|n-v-patata|m|t|
n-v-patata-europa|Patata europa|s|n-v-patata|m|t|
n-v-patata-europa-confecciona|Patata europa confecciona|s|n-v-patata|m|t|
n-v-patata-francesa|Patata francesa|s|n-v-patata|m|t|
n-v-patata-jaerla|Patata jaerla|s|n-v-patata|m|t|
n-v-patata-jaerla-confecciona|Patata jaerla confecciona|s|n-v-patata|m|t|
n-v-patata-kenebek|Patata kenebek|s|n-v-patata|m|t|
n-v-patata-liseta|Patata liseta|s|n-v-patata|m|t|
n-v-patata-liseta-confecciona|Patata liseta confecciona|s|n-v-patata|m|t|
n-v-patata-marabel|Patata marabel|s|n-v-patata|m|t|
n-v-patata-marabel-confeccion|Patata marabel confeccion|s|n-v-patata|m|t|
n-v-patata-marruecos|Patata marruecos|s|n-v-patata|m|t|
n-v-patata-mona-lisa|Patata mona lisa|s|n-v-patata|m|t|
n-v-patata-negra-yema-huevo-c|Patata negra yema huevo c|s|n-v-patata|m|t|
n-v-patata-negra-yema-huevo-g|Patata negra yema huevo g|s|n-v-patata|m|t|
n-v-patata-nueva|Patata nueva|s|n-v-patata|m|t|
n-v-patata-red-pontiac|Patata red pontiac|s|n-v-patata|m|t|
n-v-patata-roja|Patata roja|s|n-v-patata|m|t|
n-v-patata-spunta|Patata spunta|s|n-v-patata|m|t|
n-v-patata-spunta-confecciona|Patata spunta confecciona|s|n-v-patata|m|t|
n-v-patata-spunta-hol|Patata spunta hol.|s|n-v-patata|m|t|
n-v-patata-turbo|Patata turbo|s|n-v-patata|m|t|
n-v-patata-turbo-confeccionad|Patata turbo confeccionad|s|n-v-patata|m|t|
n-v-patata-vieja|Patata vieja|s|n-v-patata|m|t|
n-v-pavia|Pavia|t|n-fruit|m|t|
n-v-pepino|Pepino|t|n-vegetable|m|t|cortado
n-v-pepino-alpicoz|Pepino alpicoz|s|n-v-pepino|m|t|
n-v-pepino-corto-tipo-espanol|Pepino corto tipo español|s|n-v-pepino|m|t|
n-v-pepino-largo-tipo-holand|Pepino largo tipo holand.|s|n-v-pepino|m|t|
n-v-pera|Pera|t|n-fruit|m|t|
n-v-pera-bartlet-red-bartlet|Pera bartlet/ red bartlet|s|n-v-pera|m|t|
n-v-pera-etrusca|Pera etrusca|s|n-v-pera|m|t|
n-v-pera-general-leclerc|Pera general leclerc|s|n-v-pera|m|t|
n-v-pera-magallon|Pera magallon|s|n-v-pera|m|t|
n-v-pera-packam|Pera packam|s|n-v-pera|m|t|
n-v-pera-passa-crassana-c-e-e|Pera passa crassana c.e.e|s|n-v-pera|m|t|
n-v-peras-blanquillas|Peras blanquillas|s|n-v-pera|m|t|
n-v-peras-castell-o-sanjuaner|Peras castell o sanjuaner|s|n-v-pera|m|t|
n-v-peras-conference|Peras conference|s|n-v-pera|m|t|
n-v-peras-de-roma|Peras de roma|s|n-v-pera|m|t|
n-v-peras-doyan-de-comice|Peras doyan de comice|s|n-v-pera|m|t|
n-v-peras-ercolini|Peras ercolini|s|n-v-pera|m|t|
n-v-peras-limoneras|Peras limoneras|s|n-v-pera|m|t|
n-v-peras-moratini|Peras moratini|s|n-v-pera|m|t|
n-v-peras-passa-crassana|Peras passa crassana|s|n-v-pera|m|t|
n-v-pereta|Pereta|t|n-fruit|m|t|
n-v-pero|Pero|t|n-fruit|m|t|
n-v-pimienta|Pimienta|t|n-vegetable|m|t|
n-v-pimientas-rojas|Pimientas rojas|s|n-v-pimienta|m|t|
n-v-pimientas-verdes|Pimientas verdes|s|n-v-pimienta|m|t|
n-v-pimiento|Pimiento|t|n-vegetable|m|t|cortado
n-v-pimiento-amarillo|Pimiento amarillo|s|n-v-pimiento|m|t|
n-v-pimiento-de-padron|Pimiento de padron|s|n-v-pimiento|m|t|
n-v-pimiento-rojo-california|Pimiento rojo california|s|n-v-pimiento|m|t|
n-v-pimiento-rojo-najerano|Pimiento rojo najerano|s|n-v-pimiento|m|t|
n-v-pimiento-rojo-piquillo|Pimiento rojo piquillo|s|n-v-pimiento|m|t|
n-v-pimiento-rojo-toledo|Pimiento rojo toledo|s|n-v-pimiento|m|t|
n-v-pimiento-verde-c-cabra|Pimiento verde c. cabra|s|n-v-pimiento|m|t|
n-v-pimiento-verde-cristal|Pimiento verde cristal|s|n-v-pimiento|m|t|
n-v-pimiento-verde-italiano|Pimiento verde italiano|s|n-v-pimiento|m|t|
n-v-pimientos-lamuyos|Pimientos lamuyos|s|n-v-pimiento|m|t|
n-v-pimientos-rojos|Pimientos rojos|s|n-v-pimiento|m|t|
n-v-pina|Piña|t|n-fruit|m|t|cortado
n-v-pina-africana|Piña africana|s|n-v-pina|m|t|
n-v-pina-baby|Piña baby|t|n-fruit|m|t|
n-v-pina-golden-sweet|Piña golden sweet|s|n-v-pina|m|t|
n-v-pistacho-irani|Pistacho irani|s|n-d-fruto-seco|m|t|
n-v-pistacho-turco|Pistacho turco|s|n-d-fruto-seco|m|t|
n-v-pitahaya|Pitahaya|t|n-fruit|m|t|
n-v-pitahaya-amarilla|Pitahaya amarilla|s|n-v-pitahaya|m|t|
n-v-pitahaya-roja|Pitahaya roja|s|n-v-pitahaya|m|t|
n-v-platano|Platano|t|n-fruit|m|t|cortado
n-v-platano-import-o-banana|Platano import. o banana|s|n-v-platano|m|t|
n-v-platano-macho|Platano macho|s|n-v-platano|m|t|
n-v-platanos-extra|Platanos extra|s|n-v-platano|m|t|
n-v-platanos-primera|Platanos primera|s|n-v-platano|m|t|
n-v-platanos-segunda|Platanos segunda|s|n-v-platano|m|t|
n-v-pomelo|Pomelo|t|n-fruit|m|t|
n-v-pomelo-amarillo|Pomelo amarillo|s|n-v-pomelo|m|t|
n-v-pomelo-rojo|Pomelo rojo|s|n-v-pomelo|m|t|
n-v-puerro|Puerro|t|n-vegetable|m|t|
n-v-quinta-gama|Quinta gama|t|n-vegetable|m|t|
n-v-quinta-gama-hortalizas|Quinta gama hortalizas|s|n-v-quinta-gama|m|t|
n-v-rabanilla|Rabanilla|t|n-vegetable|m|t|
n-v-rabano|Rabano|t|n-vegetable|m|t|
n-v-rambutan|Rambutan|t|n-fruit|m|t|
n-v-remolacha|Remolacha|t|n-root|m|t|
n-v-resto-hortaliza|Resto hortaliza|t|n-vegetable|m|t|
n-v-romanescu|Romanescu|t|n-vegetable|m|t|
n-v-sandia|Sandia|t|n-fruit|m|t|
n-v-sandia-con-semilla|Sandia con semilla|s|n-v-sandia|m|t|
n-v-sandia-otras-variedaedes|Sandia otras variedaedes|s|n-v-sandia|m|t|
n-v-sandia-sin-semilla|Sandia sin semilla|s|n-v-sandia|m|t|
n-v-seta|Seta|t|n-vegetable|m|t|
n-v-seta-de-cardo|Seta de cardo|s|n-v-seta|m|t|
n-v-seta-girgola|Seta girgola|s|n-v-seta|m|t|
n-v-seta-hongo-boletus-edulis|Seta/hongo boletus edulis|s|n-v-seta|m|t|
n-v-seta-perrechico|Seta perrechico|s|n-v-seta|m|t|
n-v-seta-shii-take|Seta shii-take|s|n-v-seta|m|t|
n-v-setas-de-cultivo|Setas de cultivo|s|n-v-seta|m|t|
n-v-setas-niscalos|Setas niscalos|s|n-v-seta|m|t|
n-v-sharon|Sharon|t|n-fruit|m|t|
n-v-sofrito|Sofrito|t|n-vegetable|a||
n-v-tabella|Tabella|t|n-vegetable|m|t|
n-v-tamarindo|Tamarindo|t|n-fruit|m|t|
n-v-tirabeque|Tirabeque|t|n-vegetable|m|t|
n-v-tomate-bufalo|Tomate bufalo|s|n-tomato|m|t|
n-v-tomate-daniela|Tomate daniela|s|n-tomato|m|t|
n-v-tomate-granada-zafarraya|Tomate granada zafarraya|s|n-tomato|m|t|
n-v-tomate-kumato|Tomate kumato|s|n-tomato|m|t|
n-v-tomate-label-vasco-y-simi|Tomate label vasco y simi|s|n-tomato|m|t|
n-v-tomate-liso-rojo-canario|Tomate liso rojo canario|s|n-tomato|m|t|
n-v-tomate-maduro|Tomate maduro|s|n-tomato|m|t|
n-v-tomate-mazarron|Tomate mazarron|s|n-tomato|m|t|
n-v-tomate-muchamiel|Tomate muchamiel|s|n-tomato|m|t|
n-v-tomate-navarra-aragon|Tomate navarra/aragon|s|n-tomato|m|t|
n-v-tomate-raf|Tomate raf|s|n-tomato|m|t|
n-v-tomate-rambo|Tomate rambo|s|n-tomato|m|t|
n-v-uva|Uva|t|n-fruit|m|t|
n-v-uva-albillo|Uva albillo|s|n-v-uva|m|t|
n-v-uva-aledo|Uva aledo|s|n-v-uva|m|t|
n-v-uva-alfonso-lavalle|Uva alfonso lavalle|s|n-v-uva|m|t|
n-v-uva-cardinale|Uva cardinale|s|n-v-uva|m|t|
n-v-uva-chelva|Uva chelva|s|n-v-uva|m|t|
n-v-uva-dominga|Uva dominga|s|n-v-uva|m|t|
n-v-uva-glober|Uva glober|s|n-v-uva|m|t|
n-v-uva-ideal|Uva ideal|s|n-v-uva|m|t|
n-v-uva-michelle-parlier|Uva michelle parlier|s|n-v-uva|m|t|
n-v-uva-moscatel-espanola|Uva moscatel española|s|n-v-uva|m|t|
n-v-uva-napoleon|Uva napoleon|s|n-v-uva|m|t|
n-v-uva-negra-otras-variedade|Uva negra otras variedade|s|n-v-uva|m|t|
n-v-uva-red-glober|Uva red glober|s|n-v-uva|m|t|
n-v-uva-rosetti|Uva rosetti|s|n-v-uva|m|t|
n-v-uva-sin-semilla-blanca|Uva sin semilla blanca|s|n-v-uva|m|t|
n-v-uva-sin-semilla-negra|Uva sin semilla negra|s|n-v-uva|m|t|
n-v-uva-superior-sin-semilla|Uva superior sin semilla|s|n-v-uva|m|t|
n-v-uva-victoria|Uva victoria|s|n-v-uva|m|t|
n-v-uva-villanueva|Uva villanueva|s|n-v-uva|m|t|
n-v-vegeales|Vegeales|s|n-v-vegetal|m|t|
n-v-vegetal|Vegetal|t|n-vegetable|m|t|
n-v-yuca|Yuca|t|n-root|m|t|
n-v-zanahoria|Zanahoria|t|n-vegetable|m|t|
n-v-zanahoria-en-rama|Zanahoria en rama|s|n-v-zanahoria|m|t|
n-v-zanahorias-o-carlota-nant|Zanahorias o carlota nant|s|n-v-zanahoria|m|t|
n-v-zapote|Zapote|t|n-fruit|m|t|cortado
n-x-bandeja|Bandeja|t|n-ambient|a||
n-x-bolsa|Bolsa|t|n-ambient|a||
n-x-etiqueta|Etiqueta|t|n-ambient|a||
n-x-film|Film|t|n-ambient|a||
n-x-guante|Guante|t|n-ambient|a||
n-x-papel|Papel|t|n-ambient|a||
n-x-producto-de-limpieza|Producto de limpieza|t|n-ambient|a|t|
n-yoghurt|Yogures y postres|c|n-dairy|a||`;

/* id|what is inside it — §2.4's composition edge, for the gama IV/V nodes that are mixes */
const COMPOSITIONS = `n-v-brotes-tiernos|canónigos · rúcula · espinaca baby
n-v-ensalada-cuatro-estaciones|iceberg · lombarda · zanahoria · escarola
n-v-menestra|judía verde · zanahoria · alcachofa · guisante · coliflor
n-v-mezclum|lechuga hoja de roble · lollo rosso · rúcula · canónigos
n-v-sofrito|tomate · cebolla · pimiento`;

export const REF_NODES: RefNode[] = NODES.split('\n').map((line) => {
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
  COMPOSITIONS.split('\n').filter(Boolean).map((l) => {
    const [id, what] = l.split('|');
    return [id, what] as const;
  }),
);

/* ── THE DIMENSION REGISTERS THE REFERENCE BRINGS (§2.3, FEED-IA §41.1) ────────────────────────
 * Closed, versioned lists with an `otro` escape that writes a proposal. Sourced ones name their
 * source: RD 4/2014's ibérico designations are legally enforced words, Reg (UE) 404/2011's state
 * codes are the normative fish register, and the rest are the trade extension §1.1 says has to be
 * built on top of them — «rodajas, lomos, ventresca, anillas, tacos» are on half the fish
 * albaranes in Spain and on none of the 32 normative presentation codes.
 */
export const REF_REGISTERS: Record<string, { label: string; src: string; words: string[] }> = {
  iberico: { label: "Ibérico", src: "rd4-2014", words: ["de bellota","de cebo de campo","de cebo","100% ibérico","ibérico 75%","ibérico 50%"] },
  curacion: { label: "Curación", src: "authored", words: ["tierno","semicurado","curado","viejo","añejo","bodega","reserva","gran reserva"] },
  form: { label: "Format", src: "authored", words: ["sarta","ristra","vela","herradura","cular","caña","lonchado","taco","cuña","pieza","rulo","barra","bloque","en plancha","ristra","madeja","loncheado"] },
  flavour: { label: "Flavour", src: "authored", words: ["dulce","picante","muy picante","agridulce","al pimentón","a las finas hierbas","con ajo","trufado"] },
  category: { label: "Category", src: "mm", words: ["ternera","añojo","novillo","vacuno mayor","buey","lechal","recental","pascual","cabrito","cochinillo","cerdo blanco","duroc","ibérico","pollo","gallina","pavo","pato","codorniz"] },
  stateFish: { label: "State", src: "reg404", words: ["vivo","fresco","refrigerado","congelado","ultracongelado","cocido","salado","seco","ahumado","en salazón","en conserva","en escabeche","marinado"] },
  stateMeat: { label: "State", src: "authored", words: ["fresco","refrigerado","congelado","cocido","asado","ahumado","adobado","marinado","curado","en salazón","empanado","guisado"] },
  prepFish: { label: "Preparation", src: "reg404+authored", words: ["entero","eviscerado","descabezado","sin piel","sin cola","limpio","en lomos","en filetes","en rodajas","en tacos","en medallones","en anillas","ventresca","tronco","mariposa","desespinado","troceado","picada","huevas","surimi"] },
  prepMeat: { label: "Preparation", src: "authored", words: ["entero","limpio","en piezas","fileteado","picado","troceado","deshuesado","en tacos","en dados","en lonchas","loncheado","atado","brida","abierto"] },
  capture: { label: "Capture", src: "authored", words: ["de pincho","de anzuelo","de arrastre","de cerco","de volanta","de nasa","de marisqueo","de cultivo","salvaje"] },
  cultivation: { label: "Cultivation", src: "authored", words: ["convencional","ecológico","integrada","hidropónico","invernadero","aire libre"] },
};

/* ── THE CALIBRE AXIS (§2.3, §8.5) ────────────────────────────────────────────────────────────
 * «The calibre band — the commercial identity of a farmed fish — has no home»: all 13 rows of the
 * real fish sheet were PARTIAL for this one axis. A band is not a word out of a list, it is a
 * SYNTAX — `n-n` (2-3 kg), `n+` (8+), `n/n` (30/40 count) — plus the trade's own named bands.
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
