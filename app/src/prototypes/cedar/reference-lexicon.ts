/* GENERATED FILE — do not hand-edit. Rebuild with `node tools/build-reference.mjs`.
 *
 * THE LEXICON (THE-STANDARD-CATALOG §2.2) — every string anyone has ever used for a node, with the
 * register it came from. It is the larger of the two stores by design: «the reference is small;
 * the vocabulary is large; the vocabulary is the part that compounds with every tenant.»
 *
 * It is a module of its own so it can be loaded on demand the day the surface wants that — the
 * regex layer standing behind `ground` is the synchronous answer in the meantime (§52.5).
 *
 * 9691 bindings over 9177 distinct surfaces · 2191 nodes carrying an external id.
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
const WORDS = `10 piece cut up unece 700208|n-gpc-pollo-troceado-en-10-piezas|c
1st and 2nd segment wing / v wing unece 701302|n-gpc-ala-de-pollo-en-v-primer-y-segundo|c
1st segment and 2nd segment wings unece 701307|n-gpc-alas-de-pollo-de-primer-y-segundo-|c
1st segment wing / wing drummette unece 701304|n-gpc-contramuslito-de-ala-de-pollo|c
2 piece cut up / spilt bird unece 700201|n-gpc-pollo-abierto-en-dos-mitades|c
2 product combinations unece 704001|n-gpc-combinaciones-de-dos-piezas-de-pol|c
2 product combinations unece 714001|n-gpc-combinaciones-de-dos-piezas-de-pav|c
2nd and 3rd segment wing / 2 joint wing unece 701303|n-gpc-ala-de-pollo-de-dos-articulaciones|c
2nd segment wing / wing flat unece 701305|n-gpc-ala-plana-de-pollo-segundo-segment|c
3 product combinations unece 704002|n-gpc-combinaciones-de-tres-piezas-de-po|c
3 product combinations unece 714002|n-gpc-combinaciones-de-tres-piezas-de-pa|c
3rd segment wing / wing tip unece 701306|n-gpc-punta-de-ala-de-pollo|c
4 piece cut up / quartered bird unece 700202|n-gpc-pollo-en-cuartos|c
4 product combinations unece 704003|n-gpc-combinaciones-de-cuatro-piezas-de-|c
4 product combinations unece 714003|n-gpc-combinaciones-de-cuatro-piezas-de--2|c
6 piece cut up unece 700203|n-gpc-pollo-troceado-en-6-piezas|c
8 piece cut up non traditional unece 700205|n-gpc-pollo-troceado-en-8-piezas-corte-a|c
8 piece cut up traditional unece 700204|n-gpc-pollo-troceado-en-8-piezas-corte-t|c
9 piece cut up country cut unece 700207|n-gpc-pollo-troceado-en-9-piezas-corte-c|c
9 piece cut up traditional unece 700206|n-gpc-pollo-troceado-en-9-piezas-corte-t|c
abade|n-f-abade|o
abade jaspeado|n-f-abade-jaspeado|o
abadejo|n-f-abadejo|o
abadejo cong|n-f-abadejo|c
abadejo de alaska|n-f-abadejo-de-alaska|o
abalon japones|n-f-abalon-japones|o
abanico|n-p-abanico|a
abanico iberico|n-p-abanico|a
abate fetel abbe fetel|n-gpc-abate-fetel-abbe-fetel|c
abdominal fat / leaf fat unece 702401|n-gpc-grasa-abdominal-de-pollo|c
abdominal fat unece 712401|n-gpc-grasa-abdominal-de-pavo|c
abejas avispas y hormigas|n-gpc-abejas-avispas-y-hormigas|a
abeto marino|n-f-abeto-marino|o
abichon|n-f-abichon|o
abralia veranyi|n-f-calamarin-de-fondo|s
abudefduf saxatilis|n-f-fula|s
abuete negro|n-f-abuete-negro|o
abugo o siete en boca|n-gpc-abugo-o-siete-en-boca|c
acai|n-gpc-acai|a
acai berries|n-gpc-acai|a
acanthistius brasilianus|n-f-mero-sureno|s
acanthocardia aculeata|n-f-marolo|s
acanthocardia echinata|n-f-carneiro|s
acanthocardia tuberculata|n-f-corruco|s
acanthocybium solandri|n-f-peto|s
acantholabrus palloni|n-f-tordo-de-fondo|s
acanthurus monroviae|n-f-cirujano|s
acedera|n-gpc-acedera|a
acedia|n-f-acedia|o
acedia moteada|n-f-acedia-moteada|o
acedias|n-f-acedia|c
acedias cong|n-f-acedia|c
aceite de girasol|n-d-aceite-de-girasol|a
aceite de oliva|n-d-aceite-de-oliva|a
aceite de oliva suave|n-d-aceite-de-oliva-suave|a
aceite de oliva virgen|n-d-aceite-de-oliva-virgen|a
aceite de oliva virgen extra|n-d-aceite-de-oliva-virgen-extra|a
aceite de orujo de oliva|n-d-aceite-de-orujo-de-oliva|a
aceite de semillas|n-d-aceite-de-semillas|a
aceite de soja|n-d-aceite-de-semillas|a
aceite vegetal|n-gpc-aceite-vegetal|a
aceites|n-oils|a
aceites varios|n-d-aceite-de-semillas|a
aceites y grasas|n-oils|a
aceituna|n-d-aceituna|a
aceituna arbequina|n-d-aceituna-arbequina|a
aceituna de aragon|n-d-aceituna-negra|a
aceituna gordal|n-d-aceituna-gordal|a
aceituna manzanilla|n-d-aceituna-manzanilla|a
aceituna negra|n-d-aceituna-negra|a
aceituna rellena|n-d-aceituna-rellena|a
aceitunas|n-d-aceituna|a
acelas de hojas lisas|n-v-acelga|c
acelas de hojas lisas|n-v-acelas-de-hojas-lisas|c
acelga|n-v-acelga|c
acelgas|n-v-acelga|c
acelgas de hojas rizadas|n-v-acelga|c
acelgas de hojas rizadas|n-v-acelgas-de-hojas-rizadas|c
acete de oliva|n-d-aceite-de-oliva|a
acetes chinensis|n-f-camaron-maoxia|s
acetes indicus|n-f-camaron-indico|s
achicoria|n-v-endivia|c
achicoria|n-v-achicoria|c
acicularis|n-f-acicularis|o
acipenser baerii|n-f-esturion-siberiano|s
acipenser gueldenstaedtii|n-f-esturion-del-danubio|s
acipenser naccarii|n-f-esturion-del-adriatico|s
acipenser stellatus|n-f-esturion-estrellado|s
acipenser sturio|n-f-esturion|s
acipenser transmontanus|n-f-esturion-blanco|s
acolon|n-gpc-acolon|c
adam s pearmain|n-gpc-adam-s-pearmain|c
aditivo alimentario|n-gpc-aditivo-alimentario|a
admiral|n-gpc-admiral|c
adzuki beans|n-gpc-judia-azuki|a
aequipecten opercularis|n-f-volandeira|s
aequipecten tehuelchus|n-f-vieira-amerindia|s
aetomylaeus bovinus|n-f-peje-obispo|s
african red|n-gpc-african-red|c
afruca tangeri|n-f-barrilete|s
aglianico|n-gpc-aglianico|c
agretti|n-gpc-agretti|a
agua|n-d-agua|a
agua con sabor|n-gpc-agua-con-sabor|a
agua envasada|n-gpc-agua-envasada|a
agua mineral|n-d-agua|a
aguacate|n-avocado|a
aguacate cocktail|n-gpc-aguacate-cocktail|a
aguacate de piel lisa|n-gpc-aguacate-de-piel-lisa|a
aguacate fuerte|n-avocado|c
aguacate fuerte|n-v-aguacate-fuerte|c
aguacate hass|n-avocado|c
aguacate hass|n-v-aguacate-hass|c
aguacates|n-avocado|c
aguacioso|n-f-aguacioso|o
aguas|n-d-agua|a
aguaturma|n-gpc-aguaturma|a
aguila marina|n-f-aguila-marina|o
aguja|n-f-aguja|o
aguja|n-b-aguja|a
aguja blanca del atlantico|n-f-aguja-blanca-del-atlantico|o
aguja bola de espaldilla|n-gpc-aguja-bola-de-espaldilla|a
aguja con espaldilla y hueso|n-gpc-aguja-con-espaldilla-y-hueso|a
aguja cong|n-f-aguja|c
aguja cortada a escuadra 4 costillas|n-gpc-aguja-cortada-a-escuadra-4-costill|a
aguja cortada a escuadra 5 costillas|n-gpc-aguja-cortada-a-escuadra-5-costill|a
aguja cortada a escuadra 6 costillas|n-gpc-aguja-cortada-a-escuadra-6-costill|a
aguja cresta|n-gpc-aguja-cresta|a
aguja de cerdo|n-p-cabecera-de-lomo|a
aguja de pico corto|n-f-aguja-de-pico-corto|o
aguja de ternera|n-b-aguja|a
aguja deshuesada|n-gpc-aguja-deshuesada|a
aguja deshuesada 4 costillas|n-gpc-aguja-deshuesada-4-costillas|a
aguja deshuesada 5 costillas|n-gpc-aguja-deshuesada-5-costillas|a
aguja deshuesada 6 costillas|n-gpc-aguja-deshuesada-6-costillas|a
aguja deshuesada de corte largo|n-gpc-aguja-deshuesada-de-corte-largo|a
aguja espaldilla entera|n-gpc-aguja-espaldilla-entera|a
aguja falso solomillo|n-gpc-aguja-falso-solomillo|a
aguja llana|n-gpc-aguja-llana|a
aguja mula|n-f-aguja-mula|o
aguja negra|n-f-aguja-negra|o
aguja pez|n-gpc-aguja-pez|a
aguja picuda|n-f-aguja-picuda|o
agujon|n-f-agujon|o
ahra|n-gpc-ahra|c
ahrista|n-gpc-ahrista|c
ahumados|n-fish|c
airen|n-gpc-airen|c
airen/pinot gris|n-gpc-airen-pinot-gris|c
ajedrea de jardin|n-gpc-ajedrea-de-jardin|a
ajedrea de monte|n-gpc-ajedrea-de-monte|a
ajo|n-v-ajo|c
ajo de oso|n-gpc-ajo-de-oso|a
ajo elefante|n-gpc-ajo-elefante|a
ajo morado|n-v-ajo|c
ajo morado|n-v-ajo-morado|c
ajo o v|n-v-ajo|c
ajo tierno|n-v-ajo|c
ajo tierno|n-v-ajo-tierno|c
ajos|n-v-ajo|c
ajos secos|n-v-ajo|c
ajos secos|n-v-ajos-secos|c
ajos tiernos|n-v-ajo|c
akane prime red|n-gpc-akane-prime-red|c
akca|n-gpc-akca|c
akero|n-gpc-akero|c
ala de pollo de dos articulaciones|n-gpc-ala-de-pollo-de-dos-articulaciones|a
ala de pollo en v primer y segundo segmento|n-gpc-ala-de-pollo-en-v-primer-y-segundo|a
ala entera de pavo|n-gpc-ala-entera-de-pavo|a
ala entera de pollo|n-gpc-ala-entera-de-pollo|a
ala plana de pollo segundo segmento|n-gpc-ala-plana-de-pollo-segundo-segment|a
alacha|n-f-alacha|o
alas de pavo de primer y segundo segmento|n-gpc-alas-de-pavo-de-primer-y-segundo-s|a
alas de pollo|n-chicken-wing|a
alas de pollo con espalda|n-gpc-alas-de-pollo-con-espalda|a
alas de pollo de primer y segundo segmento|n-gpc-alas-de-pollo-de-primer-y-segundo-|a
albacora|n-f-atun-blanco|o
albahaca|n-gpc-albahaca|a
albana|n-gpc-albana|c
albaricoque|n-v-albaricoque|c
albaricoque comun|n-v-albaricoque|c
albaricoque comun|n-v-albaricoque-comun|c
albaricoque galta roja|n-v-albaricoque|c
albaricoque galta roja|n-v-albaricoque-galta-roja|c
albaricoque importacion|n-v-albaricoque|c
albaricoques|n-v-albaricoque|c
albaricoques antones|n-v-albaricoque|c
albaricoques antones|n-v-albaricoques-antones|c
albaricoques bulida|n-v-albaricoque|c
albaricoques bulida|n-v-albaricoques-bulida|c
albaricoques mauricio|n-v-albaricoque|c
albaricoques mauricio|n-v-albaricoques-mauricio|c
albaricoques moniqui|n-v-albaricoque|c
albaricoques moniqui|n-v-albaricoques-moniqui|c
albaricoques pepito|n-v-albaricoque|c
albaricoques pepito|n-v-albaricoques-pepito|c
albaricoques velazquez|n-v-albaricoque|c
albaricoques velazquez|n-v-albaricoques-velazquez|c
albarino|n-gpc-albarino|c
albarola|n-gpc-albarola|c
albarola/vermentino|n-gpc-albarola-vermentino|c
albillo|n-gpc-albillo|c
alborz seedling|n-gpc-alborz-seedling|c
alcachofa|n-v-alcachofa|c
alcachofa blanca tudela|n-v-alcachofa|c
alcachofa blanca tudela|n-v-alcachofa-blanca-tudela|c
alcachofa en conserva|n-d-conserva-vegetal|a
alcachofa violeta|n-v-alcachofa|c
alcachofa violeta|n-v-alcachofa-violeta|c
alcachofas|n-v-alcachofa|c
alcachofas de levante|n-v-alcachofa|c
alcachofas de levante|n-v-alcachofas-de-levante|c
alcachofas del terreno|n-v-alcachofa|c
alcachofas del terreno|n-v-alcachofas-del-terreno|c
alcaparra|n-d-encurtido|a
alcaravea|n-gpc-alcaravea|a
alce|n-gpc-alce|a
alcohol flavouring kit|n-gpc-kit-de-aromatizacion|a
alcohol making kits|n-gpc-kit-de-elaboracion|a
alcohol making supplies|n-gpc-insumos-de-elaboracion|a
alcoholic beverages includes de alcoholised variants|n-gpc-bebidas-alcoholicas|a
alcoholic beverages variety packs|n-gpc-surtidos-de-bebidas-alcoholicas|a
alcoholic pre mixed drinks|n-gpc-combinado-alcoholico|a
alcoholic syrups and bitters|n-gpc-biter-y-siropes-alcoholicos|a
aldas|n-gpc-aldas|c
aleatico|n-gpc-aleatico|c
aleksandruli|n-gpc-aleksandruli|c
alepocephalus bairdii|n-f-talisman|s
aleta|n-b-aleta|a
aleton|n-f-aleton|o
alexandrine douillard|n-gpc-alexandrine-douillard|c
alfiler|n-f-alfiler|o
alfonsino|n-f-alfonsino|o
alfrocheiro|n-gpc-alfrocheiro|c
alfrocheiro/alicante bouschet/tannat/syrah|n-gpc-alfrocheiro-alicante-bouschet-tann|c
alfrocheiro/touriga nacional/syrah|n-gpc-alfrocheiro-touriga-nacional-syrah|c
alga caulerpa|n-f-alga-caulerpa|o
alga de cal|n-f-alga-de-cal|o
alga imperial|n-f-alga-imperial|o
alga nori|n-f-alga-nori|o
alga perfumada|n-f-alga-perfumada|o
alga pestana|n-f-alga-pestana|o
alga pimentera|n-f-alga-pimentera|o
algarroba|n-gpc-algarroba|a
algas|n-seaweed|a
algas elaboradas|n-seaweed|a
alibernet|n-gpc-alibernet|c
alicante|n-gpc-alicante|c
alicante bouschet|n-gpc-alicante-bouschet|c
alicante bouschet/touriga nacional/tempranillo|n-gpc-alicante-bouschet-touriga-nacional|c
alice|n-gpc-alice|c
aligote|n-f-aligote|o
aligote|n-f-fletan|c
alimentacion infantil|n-gpc-alimentacion-infantil|a
alinos y salsas para mojar|n-gpc-alinos-y-salsas-para-mojar|a
alioli|n-d-salsa|a
alistado|n-f-alistado|o
alistado del mediterraneo|n-f-gamba-roja-del-mediterraneo|o
alistado robusto|n-f-alistado-robusto|o
alitan|n-f-alitan|o
alitas|n-chicken-wing|a
alitas de pollo|n-chicken-wing|a
alka|n-gpc-alka|c
alkmene|n-gpc-alkmene|c
alkmene spur linus|n-gpc-alkmene-spur-linus|c
allocyttus niger|n-f-oreo-negro|s
alloteuthis africana|n-f-calamarin-africano|s
alloteuthis media|n-f-calamarin-menor|s
alloteuthis subulata|n-f-calamarin-picudo|s
allothunnus fallai|n-f-atun-lanzon|s
almeja|n-clam|a
almeja amarilla|n-clam|o
almeja americana|n-f-almeja-americana|o
almeja artica|n-f-almeja-artica|o
almeja babosa|n-clam|o
almeja blanca|n-clam|o
almeja blanca|n-f-almeja-blanca|o
almeja casera|n-f-almeja-casera|o
almeja cong|n-clam|c
almeja corazon|n-f-almeja-corazon|o
almeja cultivada|n-clam|c
almeja de chile|n-clam|o
almeja de concha blanda|n-f-almeja-de-concha-blanda|o
almeja de fondo|n-f-almeja-de-fondo|o
almeja de perro|n-f-almeja-de-perro|o
almeja del pacifico|n-clam|o
almeja del pacifico|n-f-almeja-del-pacifico|o
almeja dorada|n-f-almeja-dorada|o
almeja fina|n-clam|o
almeja japonesa|n-clam|o
almeja oriental|n-f-almeja-oriental|o
almeja propulsora|n-f-almeja-propulsora|o
almeja reina|n-f-almeja-reina|o
almeja roja|n-clam|o
almeja rubia|n-clam|o
almeja taca|n-f-almeja-taca|o
almeja tonta|n-f-almeja-tonta|o
almejas babosas|n-clam|c
almejas finas|n-clam|c
almejas o v|n-clam|c
almejas rubias|n-clam|c
almejon|n-f-almejon|o
almendra|n-d-fruto-seco|a
almendra de mar|n-f-almendra-de-mar|o
almendra largueta tostada|n-d-fruto-seco|c
almendra largueta tostada|n-v-almendra-largueta-tostada|c
almendra peluda|n-f-almendra-peluda|o
almendras|n-d-fruto-seco|c
aloe vera|n-gpc-aloe-vera|a
alopias superciliosus|n-f-pez-zorro-negro|s
alopias vulpinus|n-f-pez-zorro|s
alosa|n-f-alosa|o
alosa alosa|n-f-sabalo|s
alosa fallax|n-f-alosa|s
alpheus glaber|n-f-quisquilla-de-pinzas|s
alpicoce|n-v-alpicoce|c
alpicoces|n-v-alpicoce|c
alro|n-gpc-alro|c
alsa|n-gpc-alsa|c
alsidium helminthochorton|n-f-musgo-de-corcega|s
alternative meat/poultry/other animal sausages|n-gpc-embutido-de-especies-alternativas|a
alternative meat/poultry/other animal sausages prepared/processed|n-gpc-embutido-de-especies-alternativas|a
alternative meat/poultry/other animal species|n-gpc-carne-de-especies-alternativas|a
alternative meat/poultry/other animal species unprepared/unprocessed|n-gpc-carne-de-especies-alternativas|a
alternative meat/poultry/other animals species|n-gpc-carne-de-especies-alternativas|a
alternative meat/poultry/other animals species prepared/processed|n-gpc-carne-de-especies-alternativas|a
altesse|n-gpc-altesse|c
alubia|n-d-alubia|a
alubia blanca|n-d-alubia-blanca|a
alubia negra|n-d-alubia-negra|a
alubia pinta|n-d-alubia-pinta|a
alubias|n-d-alubia|a
aluterus heudelotii|n-f-lija-gallo|s
aluterus monoceros|n-f-pez-unicornio|s
aluterus scriptus|n-f-lija-azul|s
alvarelhao|n-gpc-alvarelhao|c
alvarinho|n-gpc-alvarinho|c
alvarinho/arinto/fernao pires/sauvignon blanc/verdelho|n-gpc-alvarinho-arinto-fernao-pires-sauv|c
alwa|n-gpc-alwa|c
amaral|n-gpc-amaral|c
amaranto chino|n-gpc-amaranto-chino|a
amasya|n-gpc-amasya|c
ambiente y secos|n-ambient|a
amblyraja radiata|n-f-raya-radiante|s
ambrosia|n-gpc-ambrosia|c
ameghinomya antiqua|n-clam|s
american cheese|n-gpc-queso-americano|c
american persimmon|n-gpc-caqui-americano|a
ametyst|n-gpc-ametyst|c
amfora|n-gpc-amfora|c
ammodytes tobianus|n-f-aguacioso|s
amorosa|n-gpc-amorosa|c
amphioctopus aegina|n-f-pulpito-oriental|s
amphioctopus fangsiao|n-f-pulpito-oriental|s
amphioctopus membranaceus|n-f-pulpo-membranoso|s
amphioctopus neglectus|n-f-pulpo-kraken|s
amur|n-f-amur|o
amusium pleuronectes|n-f-luna-de-la-india|s
anabas testudineus|n-f-perca-koi|s
anacardo|n-d-fruto-seco|a
anadara antiquata|n-f-arca-antigua|s
anadara similis|n-f-arca-huequera|s
anadara tuberculosa|n-f-arca-negra|s
anago|n-f-anago|o
ananas reinette|n-gpc-ananas-reinette|c
anarhichas denticulatus|n-f-pez-lobo|s
anarhichas lupus|n-f-perro-del-norte|s
anarhichas minor|n-f-perro-chico|s
ancas de rana|n-f-ancas-de-rana|c
ancas de rana cong|n-f-ancas-de-rana|c
ancellotta|n-gpc-ancellotta|c
anchoa|n-f-anchoa|o
anchoa de argentina|n-f-anchoita|o
anchoa de california|n-f-anchoa-de-california|o
anchoa de peru|n-f-anchoveta|o
anchoa del africa austral|n-f-anchoa-del-africa-austral|o
anchoa japonesa|n-f-anchoa-japonesa|o
anchoas|n-f-anchoa|c
anchoas en aceite|n-d-conserva-de-pescado|a
anchoita|n-f-anchoita|o
anchoveta|n-f-anchoveta|o
ancylopsetta dendritica|n-f-platija-tresojos|s
andorina|n-f-andorina|o
andorrero del cabo|n-f-andorrero-del-cabo|o
androlla|n-botillo|a
anemonia sulcata|n-f-ortiguilla|s
angelica|n-gpc-angelica|a
angelote|n-f-angelote|o
angelote argentino|n-f-angelote-argentino|o
angold|n-gpc-angold|c
anguila|n-f-anguila|o
anguila bicolor|n-f-anguila-bicolor|o
anguila cong|n-f-anguila|c
anguilla anguilla|n-f-anguila|s
anguilla bicolor|n-f-anguila-bicolor|s
angula|n-f-anguila|o
angula fresca cocida|n-f-anguila|c
angulas|n-f-anguila|c
angulas cong|n-f-anguila|c
anillas de volador o pota|n-f-pota|c
animal derived edible products prepared/processed|n-gpc-productos-de-origen-animal|a
animal derived edible products unprepared/unprocessed|n-gpc-productos-de-origen-animal|a
anis|n-gpc-anis|a
anise|n-gpc-anis|a
anjova|n-f-anjova|o
anna|n-gpc-anna|c
annabelle|n-gpc-annabelle|c
annaglo|n-gpc-annaglo|c
annona|n-gpc-anonaceas|a
annona fresh cut|n-gpc-anonaceas|a
annona other|n-gpc-anona|a
anojo de primera|n-meat|c
anojo de segunda|n-meat|c
anona|n-gpc-anona|a
anona corazon|n-gpc-anona-corazon|a
anonaceas|n-gpc-anonaceas|a
anoplopoma fimbria|n-f-bacalao-negro-de-alaska|s
antao vaz|n-gpc-antao-vaz|c
antao vaz/arinto/alvarinho|n-gpc-antao-vaz-arinto-alvarinho|c
antej|n-gpc-antej|c
antelope|n-gpc-antilope|a
antelope prepared/processed|n-gpc-antilope|a
antelope unprepared/unprocessed|n-gpc-antilope|a
anthias anthias|n-f-andorina|s
antigonia capros|n-f-galleta|s
antilope|n-gpc-antilope|a
antimora rostrata|n-f-bertorella-azul|s
antroewa|n-gpc-berenjena-antroewa|a
aonori|n-f-aonori|o
aove|n-d-aceite-de-oliva|a
aperitivo|n-d-aperitivo|a
aperitivo inflado|n-gpc-aperitivo-inflado|a
aperitivos|n-d-aperitivo|a
aphanopus carbo|n-f-sable-negro|s
aphia minuta|n-f-chanquete|s
apio|n-v-apio|c
apio amarillento|n-v-apio|c
apio amarillento|n-v-apio-amarillento|c
apio blanco|n-v-apio|c
apio blanco|n-v-apio-blanco|c
apio verde|n-v-apio|c
apio verde|n-v-apio-verde|c
apionabo|n-v-apio|c
apionabo|n-v-apionabo|c
apogon imberbis|n-f-salmonete-real|s
apollo|n-gpc-apollo|c
apple bananas|n-gpc-platano-manzano|a
apple/pear alcoholic beverage sparkling|n-gpc-sidra-espumosa|a
apple/pear alcoholic beverage still|n-gpc-sidra|a
apple/pear beverage sparkling|n-gpc-bebida-de-manzana-espumosa|a
apple/pear beverage sparkling non alcoholic|n-gpc-bebida-de-manzana-espumosa|a
apple/pear beverage still|n-gpc-bebida-de-manzana|a
apple/pear beverage still non alcoholic|n-gpc-bebida-de-manzana|a
apples|n-v-manzana|a
apricots|n-v-albaricoque|a
aquatic invertebrates|n-gpc-invertebrados-marinos|a
aquatic invertebrates prepared/processed|n-cephalopod|a
aquatic invertebrates prepared/processed frozen|n-gpc-invertebrados-marinos|a
aquatic invertebrates prepared/processed perishable|n-gpc-invertebrados-marinos|a
aquatic invertebrates prepared/processed shelf stable|n-gpc-invertebrados-marinos|a
aquatic invertebrates unprepared/unprocessed|n-cephalopod|a
aquatic invertebrates unprepared/unprocessed frozen|n-gpc-invertebrados-marinos|a
aquatic invertebrates unprepared/unprocessed perishable|n-gpc-invertebrados-marinos|a
aquatic invertebrates unprepared/unprocessed shelf stable|n-gpc-invertebrados-marinos|a
aquatic invertebrates/fish/shellfish/seafood combination|n-gpc-mezclas-de-pescado-y-marisco|a
aquatic invertebrates/fish/shellfish/seafood mixes|n-gpc-mezclas-de-pescado-marisco-e-inver|a
aquatic invertebrates/fish/shellfish/seafood mixes prepared/processed frozen|n-gpc-mezclas-de-pescado-marisco-e-inver|a
aquatic invertebrates/fish/shellfish/seafood mixes prepared/processed perishable|n-gpc-mezclas-de-pescado-marisco-e-inver|a
aquatic invertebrates/fish/shellfish/seafood mixes prepared/processed shelf stable|n-gpc-mezclas-de-pescado-marisco-e-inver|a
aquatic invertebrates/fish/shellfish/seafood mixes unprepared/unprocessed frozen|n-gpc-mezclas-de-pescado-marisco-e-inver|a
aquatic invertebrates/fish/shellfish/seafood mixes unprepared/unprocessed perishable|n-gpc-mezclas-de-pescado-marisco-e-inver|a
aquatic invertebrates/fish/shellfish/seafood mixes unprepared/unprocessed shelf stable|n-gpc-mezclas-de-pescado-marisco-e-inver|a
aquatic plants prepared/processed|n-seaweed|a
aquatic plants prepared/processed frozen|n-seaweed|a
aquatic plants prepared/processed perishable|n-seaweed|a
aquatic plants prepared/processed shelf stable|n-seaweed|a
aquatic plants unprepared/unprocessed|n-seaweed|a
aquatic plants unprepared/unprocessed frozen|n-seaweed|a
aquatic plants unprepared/unprocessed perishable|n-seaweed|a
aquatic plants unprepared/unprocessed shelf stable|n-seaweed|a
arana|n-f-arana|o
arana plana|n-f-arana-plana|o
arandano|n-v-arandano|c
arandano rojo|n-gpc-arandano-rojo|a
arandano rojo silvestre|n-gpc-arandano-rojo-silvestre|a
arandano silvestre|n-gpc-arandano-silvestre|a
arandanos|n-v-arandano|c
arany sarfeher|n-gpc-arany-sarfeher|c
arapaima|n-f-arapaima|o
arapaima gigas|n-f-arapaima|s
arbacia lixula|n-f-erizo-negro|s
arbanne arbane|n-gpc-arbanne-arbane|c
arbequina|n-d-aceituna-arbequina|a
arbitan|n-f-maruca-azul|o
arca antigua|n-f-arca-antigua|o
arca de noe|n-f-arca-de-noe|o
arca huequera|n-f-arca-huequera|o
arca negra|n-f-arca-negra|o
arca noae|n-f-arca-de-noe|s
archangel|n-gpc-angelica|a
areni|n-gpc-areni|c
arenque|n-f-arenque|o
arenque cong|n-f-arenque|c
arenque del pacifico|n-f-arenque-del-pacifico|o
arenque en|n-f-arenque|c
arenque en salazon|n-f-arenque|c
arenquillo|n-f-arenquillo|o
arete|n-f-arete|o
arete aleton|n-f-arete-aleton|o
argazo real|n-f-argazo-real|o
argentina silus|n-f-pion-de-altura|s
argentina sphyraena|n-f-polido|s
argobuccinum pustulosum|n-f-corneta-palo|s
argopecten purpuratus|n-f-vieira-del-pacifico|s
argyrosomus heinii|n-f-corvina-arabe|s
argyrosomus hololepidotus|n-f-corvina-africana|s
argyrosomus regius|n-f-corvina|s
ariane|n-gpc-ariane|c
arinarnoa|n-gpc-arinarnoa|c
arinto|n-gpc-arinto|c
aristaeomorpha foliacea|n-f-langostino-moruno|s
aristaeopsis edwardsiana|n-f-carabinero|s
aristeus alcocki|n-f-gamba|s
aristeus antennatus|n-f-gamba-roja-del-mediterraneo|s
aristeus varidens|n-f-alistado|s
aristeus virilis|n-f-alistado-robusto|s
ariwa|n-gpc-ariwa|c
arkcharm|n-gpc-arkcharm|c
arlet/swiss gourmet|n-gpc-arlet-swiss-gourmet|c
armado|n-f-armado|o
armenian cucumber|n-gpc-pepino-armenio|a
arneis|n-gpc-arneis|c
arnoglossus grohmanni|n-f-peluda|s
arnoglossus imperialis|n-f-peluda-imperial|s
arnoglossus laterna|n-f-serrandell|s
arnoglossus thori|n-f-peludilla|s
arola|n-f-arola|o
aroma|n-gpc-aroma|c
arracacha|n-gpc-arracacha|a
arrowroot|n-gpc-arrurruz|a
arroz|n-d-arroz|a
arroz bomba|n-d-arroz-bomba|a
arroz integral|n-d-arroz-integral|a
arroz largo|n-d-arroz-largo|a
arroz redondo|n-d-arroz-redondo|a
arroz y legumbres|n-pulses|a
arrufiac|n-gpc-arrufiac|c
arrurruz|n-gpc-arrurruz|a
artaban|n-gpc-artaban|c
artemesia longinaris|n-f-gamba|s
artemisa|n-gpc-artemisa|a
arthrospira platensis|n-f-espirulina|s
arthur turner|n-gpc-arthur-turner|c
articulata|n-f-articulata|o
artificial casings|n-gpc-tripa-artificial|a
asadura|n-o-casqueria-de-cordero|a
asadura|n-meat|c
ascofilo|n-f-ascophyllum|o
ascophyllum|n-f-ascophyllum|o
ascophyllum nodosum|n-f-ascophyllum|s
asfari|n-gpc-asfari|c
ashmead s kernel|n-gpc-ashmead-s-kernel|c
asparagus|n-v-esparrago|a
assorted cuts block ready bone in unece 505036|n-gpc-despiece-surtido-de-cabrito-con-hu|c
assorted cuts block ready unece 405036|n-gpc-despiece-surtido-de-cordero-listo-|c
assorted pieces special trim unece 505199|n-gpc-piezas-surtidas-de-cabrito-limpiez|c
assyrtiko|n-gpc-assyrtiko|c
astacus astacus|n-f-cangrejo-de-rio-europeo|s
atheresthes evermanni|n-f-halibut-de-kamchatka|s
atheresthes stomias|n-f-halibut-de-alaska|s
atherina boyeri|n-f-pejerrey|s
atherina hepsetus|n-f-chucleto|s
atherina presbyter|n-f-abichon|s
atlantoraja castelnaui|n-f-raya-de-puntos|s
atractoscion aequidens|n-f-corvina-de-boca-amarilla|s
atun|n-f-atun|c
atun blanco|n-f-atun-blanco|o
atun c/c|n-f-atun|c
atun claro o rabil|n-f-atun|c
atun con cabeza|n-f-atun|c
atun con cabeza cong|n-f-atun|c
atun cong|n-f-atun|c
atun de aleta amarilla|n-f-rabil|o
atun de aleta azul|n-f-atun-rojo|o
atun de aleta negra|n-f-atun-de-aleta-negra|o
atun de ojo grande|n-f-patudo|o
atun del pacifico|n-f-atun-del-pacifico|o
atun del sur|n-f-atun-del-sur|o
atun en lata|n-d-conserva-de-pescado|a
atun lanzon|n-f-atun-lanzon|o
atun patudo u obeso|n-f-atun|c
atun rojo|n-f-atun-rojo|o
atun rojo cimarron|n-f-atun|c
atun s/c|n-f-atun|c
atun sin cabeza|n-f-atun|c
atun sin cabeza cong|n-f-atun|c
atun tongol|n-f-atun-tongol|o
aubergines|n-v-berenjena|a
auksis|n-gpc-auksis|c
aulacomya atra|n-f-cholga|s
aulopus filamentosus|n-f-ojo-de-piedra|s
aulostomus strigosus|n-f-peje-trompeta|s
aurora|n-gpc-aurora|c
austroglossus microlepis|n-f-lenguado-del-sur|s
austroglossus pectoralis|n-f-lenguado-del-cabo|s
austrovenus stutchburyi|n-f-berberecho-rey-de-nueva-zelanda|s
auxerrois|n-gpc-auxerrois|c
auxis rochei|n-f-melva|s
auxis thazard|n-f-melva|s
avellana|n-d-fruto-seco|a
avellanas|n-d-fruto-seco|c
aves|n-poultry|a
avesso|n-gpc-avesso|c
avestruz|n-g-avestruz|a
avestruz conserva|n-g-avestruz|c
avestruz elaborado|n-g-avestruz|c
avestruz precocinado|n-g-avestruz|c
avezaath kapel|n-gpc-avezaath-kapel|c
avicola|n-meat|c
avicola cong sin especif|n-meat|c
avicola conserva|n-meat|c
avicola despojo|n-meat|c
avicola elaborado|n-meat|c
avicola fresco sin especi|n-meat|c
avicola precocinado|n-meat|c
avicola sin especi|n-meat|c
avocados|n-avocado|a
avocados fresh cut|n-avocado|a
avocados pebbled peel hass type|n-avocado|a
avocados smooth peel|n-gpc-aguacate-de-piel-lisa|a
aw 164|n-gpc-aw-164|c
azafran|n-d-especia|a
azahar|n-gpc-azahar|a
azal|n-gpc-azal|c
azal/pederna/trajadura/avesso/loureiro|n-gpc-azal-pederna-trajadura-avesso-lour|c
aztec|n-gpc-aztec|c
azucar|n-d-azucar|a
azufu|n-gpc-azufu|c
babaco|n-gpc-babaco|a
babacos|n-gpc-babaco|a
babeasca neagra|n-gpc-babeasca-neagra|c
babilla|n-b-babilla|a
babilla con tapilla|n-gpc-babilla-con-tapilla|a
babilla con tapilla de cabrito|n-gpc-babilla-con-tapilla-de-cabrito|a
babilla de cabrito|n-gpc-babilla-de-cabrito|a
babilla de vacuno|n-gpc-babilla-de-vacuno|a
babosas|n-f-babosa|c
baby bananas|n-gpc-platano-baby|a
baby leaves|n-v-brotes-tiernos|a
baby/infant foods/beverages|n-gpc-alimentacion-y-bebidas-infantiles|a
baby/infant foods/beverages variety packs|n-gpc-surtidos-de-alimentacion-infantil|a
baby/infant formula|n-gpc-leche-infantil|a
baby/infant formula shelf stable|n-gpc-leche-infantil|a
baby/infant specialised beverages|n-gpc-bebida-infantil|a
baby/infant specialised beverages shelf stable|n-gpc-bebida-infantil|a
baby/infant specialised foods|n-gpc-alimentacion-infantil|a
baby/infant specialised foods frozen|n-gpc-alimentacion-infantil|a
baby/infant specialised foods shelf stable|n-gpc-alimentacion-infantil|a
bacaladilla|n-f-bacaladilla|o
bacaladilla austral|n-f-bacaladilla-austral|o
bacaladilla lirio|n-f-bacaladilla|c
bacaladilla lirio grande|n-f-bacaladilla|c
bacaladilla lirio mediano|n-f-bacaladilla|c
bacaladilla lirio pequeno|n-f-bacaladilla|c
bacalao|n-f-bacalao|o
bacalao|n-f-bacalao-de-groenlandia|o
bacalao|n-f-bacalao-del-pacifico|o
bacalao acuic filete|n-f-bacalao|c
bacalao acuicultur entero|n-f-bacalao|c
bacalao cong|n-f-bacalao|c
bacalao criollo|n-f-brotola-criolla|o
bacalao de alaska|n-f-bacalao-del-pacifico|o
bacalao de cultivo|n-f-bacalao|c
bacalao de groenlandia|n-f-bacalao-de-groenlandia|o
bacalao del pacifico|n-f-bacalao-del-pacifico|o
bacalao en|n-f-bacalao|c
bacalao en salazon|n-f-bacalao|c
bacalao entero|n-f-bacalao|c
bacalao entero c/c|n-f-bacalao|c
bacalao entero c/c 1/2 kg|n-f-bacalao|c
bacalao entero s/c 4/6 kg|n-f-bacalao|c
bacalao filete|n-f-bacalao|c
bacalao negro de alaska|n-f-bacalao-negro-de-alaska|o
bacalao salado|n-f-bacalao|c
bacalao salvaje|n-f-bacalao|c
bacalao trozos|n-f-bacalao|c
bacalao trozos cong|n-f-bacalao|c
bacchus|n-gpc-bacchus|c
back fat|n-gpc-tocino-dorsal|c
back half unece 700401|n-gpc-mitad-trasera-de-pollo|c
back half unece 710401|n-gpc-mitad-trasera-de-pavo|c
back half without tail unece 700402|n-gpc-mitad-trasera-de-pollo-sin-rabadil|c
back half without tail unece 710402|n-gpc-mitad-trasera-de-pavo-sin-rabadill|c
back ribs unece 304160|n-gpc-costillar-de-lomo|c
backstrap or backstrip long unece 405101|n-gpc-lomo-limpio-de-cordero-largo|c
backstrap or backstrip short unece 405109|n-gpc-lomo-limpio-de-cordero-corto|c
backstrap/backstrip unece 505101|n-gpc-lomo-limpio-de-cabrito|c
baco noir|n-gpc-baco-noir|c
bacon|n-bacon|a
bacon ahumado|n-bacon|a
bacoreta|n-f-bacoreta|o
bacoreta oriental|n-f-bacoreta-oriental|o
badea|n-gpc-badea|a
baga|n-gpc-baga|c
baga japonesa|n-f-baga-japonesa|o
bagra del ganges|n-f-bagra-del-ganges|o
bagre|n-f-bagre|o
bagre blanco|n-f-bagre-blanco|o
bagre del canal|n-f-bagre-del-canal|o
bagre pinnimaculatus|n-f-bagre-rojo|s
bagre rojo|n-f-bagre-rojo|o
baigent|n-gpc-baigent|c
baila|n-f-baila|o
bailas|n-f-baila|c
bajo de cordero|n-o-falda-de-cordero|a
bajo de ternera|n-b-falda|a
baking/cooking mixes|n-gpc-preparado-para-reposteria|a
baking/cooking mixes frozen|n-gpc-preparado-para-reposteria|a
baking/cooking mixes perishable|n-gpc-preparado-para-reposteria|a
baking/cooking mixes shelf stable|n-gpc-preparado-para-reposteria|a
baking/cooking mixes/supplies|n-gpc-preparados-e-ingredientes-de-repos|a
baking/cooking mixes/supplies variety packs|n-gpc-surtidos-de-reposteria|a
baking/cooking supplies|n-gpc-ingredientes-de-reposteria|a
baking/cooking supplies frozen|n-gpc-ingredientes-de-reposteria|a
baking/cooking supplies perishable|n-gpc-ingredientes-de-reposteria|a
baking/cooking supplies shelf stable|n-gpc-ingredientes-de-reposteria|a
baldwin|n-gpc-baldwin|c
balistes capriscus|n-f-pez-ballesta|s
balm|n-gpc-melisa|a
bamboo shoots|n-gpc-brote-de-bambu|a
banana leaves food garnish|n-gpc-hoja-de-platano|a
bananas|n-v-platano|a
bananas fresh cut|n-v-platano|a
bananito|n-v-bananito|c
bananitos|n-v-bananito|c
bandeja|n-x-bandeja|a
bandejas|n-x-bandeja|a
banderilla|n-d-encurtido|a
baratuciat|n-gpc-baratuciat|c
barbada|n-f-barbada|o
barbadines|n-gpc-badea|a
barbatula barbatula|n-f-locha-de-roca|s
barbera|n-gpc-barbera|c
barbera/dolcetto|n-gpc-barbera-dolcetto|c
barbo comizo|n-f-barbo-comizo|o
barbo comun|n-f-barbo-comun|o
barbo de graells|n-f-barbo-de-graells|o
barbo de montana|n-f-barbo-de-montana|o
barbo de sclater|n-f-barbo-de-sclater|o
barbo gitano|n-f-barbo-de-sclater|o
barbuda|n-f-barbuda|o
barbudo|n-f-barbudo|o
barbudo enano africano|n-f-barbudo-enano-africano|o
barbudo real|n-f-barbudo-real|o
barbus meridionalis|n-f-barbo-de-montana|s
bardana|n-gpc-bardana|a
bardolino|n-gpc-bardolino|c
barqueta|n-x-bandeja|a
barra de pan|n-d-pan|a
barramundi|n-f-perca-gigante|o
barrilete|n-f-barrilete|o
barrilete negro|n-f-barrilete-negro|o
barrita de cereales|n-gpc-barrita-de-cereales|a
barrita de proteinas|n-gpc-barrita-de-proteinas|a
basil|n-gpc-albahaca|a
basmati|n-d-arroz-largo|a
bastardo|n-gpc-bastardo|c
batata|n-v-batata|c
batata moniato|n-v-batata|c
batatas|n-v-batata|c
batatas de lanzarote|n-v-batata|c
batatas de lanzarote|n-v-batatas-de-lanzarote|c
batatas yema de huevo|n-v-batata|c
batatas yema de huevo|n-v-batatas-yema-de-huevo|c
batavia|n-v-lechuga|a
bathophilus nigerrimus|n-f-pez-diablo|s
bathyraja brachyurops|n-f-raya-de-los-canales|s
bathysolea profundicola|n-f-lenguado-de-profundidad|s
bathytoshia centroura|n-f-raya-latigo-islena|s
baujade|n-gpc-baujade|c
baumann s reinette|n-gpc-baumann-s-reinette|c
bavarian blue|n-gpc-queso-azul-de-baviera|c
bavette|n-b-vacio|a
bay 3484|n-gpc-bay-3484|c
baya de boysen|n-gpc-baya-de-boysen|a
baya de goji|n-gpc-baya-de-goji|a
baya de logan|n-gpc-baya-de-logan|a
baya de saskatoon|n-gpc-baya-de-saskatoon|a
beacon|n-gpc-beacon|c
beans winged|n-gpc-judia-alada|a
beans with pods|n-gpc-judias-con-vaina|a
beans with pods fresh cut|n-gpc-judias-con-vaina|a
beaufort|n-gpc-queso-beaufort|c
beauty of bath|n-gpc-beauty-of-bath|c
beauvillon|n-gpc-beauvillon|c
bebida de manzana|n-gpc-bebida-de-manzana|a
bebida de manzana espumosa|n-gpc-bebida-de-manzana-espumosa|a
bebida de zumo de fruta|n-gpc-bebida-de-zumo-de-fruta|a
bebida de zumo de verdura|n-gpc-bebida-de-zumo-de-verdura|a
bebida energetica|n-gpc-bebida-energetica|a
bebida infantil|n-gpc-bebida-infantil|a
bebida isotonica|n-gpc-bebida-isotonica|a
bebida lactea|n-gpc-bebida-lactea|a
bebida vegetal|n-gpc-bebida-vegetal|a
bebidas|n-drinks|a
beech mushrooms|n-gpc-shimeji|a
beef|n-beef|a
beef prepared/processed|n-beef|a
beef sausages|n-gpc-embutido-de-vacuno|a
beef sausages prepared/processed|n-gpc-embutido-de-vacuno|a
beef unprepared/unprocessed|n-beef|a
beefalo|n-gpc-beefalo|a
beefalo/cattalo|n-gpc-beefalo|a
beefalo/cattalo prepared/processed|n-gpc-beefalo|a
beefalo/cattalo unprepared/unprocessed|n-gpc-beefalo|a
beer|n-d-cerveza|a
beer non alcoholic|n-d-cerveza|a
beercheese|n-gpc-queso-a-la-cerveza|c
bees/wasps/ants|n-gpc-abejas-avispas-y-hormigas|a
bees/wasps/ants prepared/processed|n-gpc-abejas-avispas-y-hormigas|a
bees/wasps/ants unprepared/unprocessed|n-gpc-abejas-avispas-y-hormigas|a
beetles|n-gpc-escarabajos|a
beetles prepared/processed|n-gpc-escarabajos|a
beetles unprepared/unprocessed|n-gpc-escarabajos|a
beetroot|n-v-remolacha|a
beicon|n-bacon|a
bejel|n-f-bejel|o
bel el|n-gpc-bel-el|c
belfort|n-gpc-belfort|c
belgica|n-gpc-belgica|c
belle de boskoop|n-gpc-belle-de-boskoop|a
belle de boskoop and mutants|n-gpc-belle-de-boskoop|c
belle fleur de france|n-gpc-belle-fleur-de-france|c
belle fleur larche mouche|n-gpc-belle-fleur-larche-mouche|c
belle lucrative|n-gpc-belle-lucrative|c
bellida|n-gpc-bellida|c
bellota|n-v-bellota|c
bellotas|n-v-bellota|c
belly 10 ribs unece 304082|n-gpc-panceta-de-cerdo-10-costillas|c
belly 11 ribs unece 304081|n-gpc-panceta-de-cerdo-11-costillas|c
belly 12 ribs unece 304080|n-gpc-panceta-de-cerdo-12-costillas|c
belly 13 ribs unece 304079|n-gpc-panceta-de-cerdo-13-costillas|c
belly boneless from 10 ribs unece 304332|n-gpc-panceta-deshuesada-de-10-costillas|c
belly boneless from 11 ribs unece 304331|n-gpc-panceta-deshuesada-de-11-costillas|c
belly boneless from 12 ribs unece 304330|n-gpc-panceta-deshuesada-de-12-costillas|c
belly boneless from 13 ribs unece 304329|n-gpc-panceta-deshuesada-de-13-costillas|c
belly flank on unece 304333|n-gpc-panceta-con-falda|c
belly ribs unece 304160|n-gpc-costillar-de-panceta|c
belone belone|n-f-aguja|s
belorrusskoje malinovoje|n-gpc-belorrusskoje-malinovoje|c
benoni|n-gpc-benoni|c
benthodesmus elongatus|n-f-sable-alargado|s
berberecho|n-f-berberecho|o
berberecho cong|n-f-berberecho|c
berberecho de groenlandia|n-f-berberecho-de-groenlandia|o
berberecho dentado|n-f-berberecho-dentado|o
berberecho gigante del atlantico|n-f-berberecho-gigante-del-atlantico|o
berberecho grande|n-f-berberecho|c
berberecho mediano|n-f-berberecho|c
berberecho pequeno|n-f-berberecho|c
berberecho rey de nueva zelanda|n-f-berberecho-rey-de-nueva-zelanda|o
berberecho verde|n-f-berberecho-verde|o
berberechos|n-f-berberecho|c
berenjena|n-v-berenjena|c
berenjena antroewa|n-gpc-berenjena-antroewa|a
berenjena larga|n-v-berenjena|c
berenjena redonda|n-v-berenjena|c
berenjenas|n-v-berenjena|c
berenjenas blancas|n-v-berenjena|c
berenjenas blancas|n-v-berenjenas-blancas|c
berenjenas moradas|n-v-berenjena|c
berenjenas moradas|n-v-berenjenas-moradas|c
bergamot d esperen|n-gpc-bergamot-d-esperen|c
berlepsch|n-gpc-berlepsch|c
berlepsch rouge|n-gpc-berlepsch-rouge|c
berner rosenapfel rosana|n-gpc-berner-rosenapfel-rosana|c
berries/small fruit|n-gpc-frutos-rojos-y-bayas|a
berries/small fruit fresh cut|n-gpc-frutos-rojos-y-bayas|a
berro|n-v-berro|c
berros|n-v-berro|c
berryteuthis magister|n-f-pota-magister|s
bertanne|n-gpc-bertanne|c
bertorella|n-f-bertorella|o
bertorella artica|n-f-bertorella-artica|o
bertorella azul|n-f-bertorella-azul|o
bertorella cong|n-f-bertorella|c
bertorellas|n-f-bertorella|c
beryx decadactylus|n-f-palometa-roja|s
beryx splendens|n-f-alfonsino|s
besugo|n-f-besugo|o
besugo americano|n-f-alfonsino|o
besugo arabe|n-f-besugo-arabe|o
besugo cong|n-f-besugo|c
besugo de 0 7 a 1 kg|n-f-besugo|c
besugo de 1 a 1 5 kg|n-f-besugo|c
besugo de cultivo|n-f-besugo|c
besugo de la pinta acuicu|n-f-besugo|c
besugo pancho 0 5 a 0 6 k|n-f-besugo|c
besugo salvaje|n-f-besugo|c
beurre alexandre lucas|n-gpc-beurre-alexandre-lucas|c
beurre bosc kaiser alexander|n-gpc-beurre-bosc-kaiser-alexander|c
beurre clairgeau|n-gpc-beurre-clairgeau|c
beurre d anjou|n-gpc-beurre-d-anjou|c
beurre diel|n-gpc-beurre-diel|c
beurre giffard|n-gpc-beurre-giffard|c
beurre hardenpont|n-gpc-beurre-hardenpont|c
beurre hardy|n-gpc-beurre-hardy|c
beurre lebrun|n-gpc-beurre-lebrun|c
beurre precoce morettini|n-gpc-beurre-precoce-morettini|c
beurre superfin|n-gpc-beurre-superfin|c
beverages variety packs|n-gpc-surtidos-de-bebidas|a
bianchetta biancetta|n-gpc-bianchetta-biancetta|c
biancolella|n-gpc-biancolella|c
biancolella/chardonnay/coda di volpe|n-gpc-biancolella-chardonnay-coda-di-vol|c
biborkadarka|n-gpc-biborkadarka|c
bical|n-gpc-bical|c
bicho|n-f-bicho|o
bielaar|n-gpc-bielaar|c
biesterfelder renette|n-gpc-biesterfelder-renette|c
bietigheimer|n-gpc-bietigheimer|c
bife angosto|n-b-lomo-bajo|a
bifurcaria|n-f-bifurcaria|o
bifurcaria bifurcata|n-f-bifurcaria|s
bigaro|n-f-bigaro|o
bigaro blanco|n-f-bigaro-blanco|o
bigaros o caracolillos|n-f-bigaros-o-caracolillo|c
bilberries|n-gpc-arandano-silvestre|a
bilimbi|n-gpc-bilimbi|a
bimi|n-gpc-bimi|a
bimi and other brassica interbreeds|n-gpc-bimi|a
biscote|n-d-biscote|a
biscuits/cookies|n-d-galleta|a
biscuits/cookies frozen|n-d-galleta|a
biscuits/cookies perishable|n-d-galleta|a
biscuits/cookies shelf stable|n-d-galleta|a
biscuits/cookies variety packs|n-gpc-surtidos-de-galletas|a
bison/buffalo|n-gpc-bisonte|a
bison/buffalo prepared/processed|n-gpc-bisonte|a
bison/buffalo unprepared/unprocessed|n-gpc-bisonte|a
bisonte|n-gpc-bisonte|a
biter y siropes alcoholicos|n-gpc-biter-y-siropes-alcoholicos|a
bitter melon|n-gpc-melon-amargo|a
black currants|n-gpc-grosella-negra|a
black eyed peas|n-gpc-judia-carilla|a
black mustard|n-gpc-mostaza-negra|a
black queen|n-gpc-black-queen|c
black radishes|n-gpc-rabano-negro|a
blackberries|n-f-mora|a
blade shoulder 4 rib unece 404776|n-gpc-paletilla-de-cordero-con-espaldill|c
blade shoulder 5 rib unece 404777|n-gpc-paletilla-de-cordero-con-espaldill-2|c
blade shoulder 6 rib unece 404778|n-gpc-paletilla-de-cordero-con-espaldill-3|c
blanc vrai|n-gpc-blanc-vrai|c
blanca de aranjuez|n-gpc-blanca-de-aranjuez|c
blanco colli piacentini|n-gpc-blanco-colli-piacentini|c
blanco di trevigiano|n-gpc-blanco-di-trevigiano|c
blanquillo|n-f-blanquillo|o
blanquillo peruano|n-f-blanquillo-peruano|o
blauburger|n-gpc-blauburger|c
blauer portugieser modry portugal|n-gpc-blauer-portugieser-modry-portugal|c
blaufraenkisch lemberger/blauer limberger|n-gpc-blaufraenkisch-lemberger-blauer-li|c
blaufraenkisch/gamaret|n-gpc-blaufraenkisch-gamaret|c
blaufraenkisch/gamaret/cabernet dorsa|n-gpc-blaufraenkisch-gamaret-cabernet-do|c
blaufraenkisch/gamaret/pinot noir|n-gpc-blaufraenkisch-gamaret-pinot-noir|c
blaufraenkisch/merlot/cabernet sauvignon/cabernet franc|n-gpc-blaufraenkisch-merlot-cabernet-sau|c
blaufraenkisch/merlot/cabernet sauvignon/syrah|n-gpc-blaufraenkisch-merlot-cabernet-sau-2|c
blend|n-gpc-blend|c
blenheim orange|n-gpc-blenheim-orange|c
blennius ocellaris|n-f-torillo|s
bleu de bresse|n-gpc-queso-bleu-de-bresse|c
bloedpeer|n-gpc-bloedpeer|c
bloemeezoet|n-gpc-bloemeezoet|c
blue castello|n-gpc-queso-blue-castello|c
blue cheshire|n-gpc-queso-cheshire-azul|c
blue shropshire|n-gpc-queso-shropshire-azul|c
blue stilton|n-gpc-queso-stilton-azul|c
blueberries|n-v-arandano|a
blushed golden|n-gpc-blushed-golden|c
bobal|n-gpc-bobal|c
bobi|n-f-bobi|o
boca|n-f-barrilete|o
boca de oro|n-f-boca-de-oro|o
boca roja|n-f-boca-roja|o
bocadillos y wraps|n-gpc-bocadillos-y-wraps|a
bocaditos|n-f-pescado|c
bocaditos cong|n-f-pescado|c
bocadulce|n-f-canabota|o
bocarte|n-f-bocarte|c
bocas|n-f-barrilete|c
bocas cong|n-f-barrilete|c
bocas y cuerpos|n-f-barrilete|c
bocina|n-f-bocina|o
bocon|n-f-bocon|o
bocona|n-f-bocona|o
bodianus scrofa|n-f-pejeperro|s
bodianus speciosus|n-f-vieja-lomonegro|s
bodion|n-f-bodion|o
bodion del punto|n-f-bodion|o
body skin unece 702303|n-gpc-piel-de-pollo|c
body skin unece 712303|n-gpc-piel-de-pavo|c
boga|n-f-boga|o
boga de rio|n-f-boga-de-rio|o
bogas|n-f-boga|c
bogatir|n-gpc-bogatir|c
bogavante|n-f-bogavante|c
bogavante americano|n-f-bogavante-americano|o
bogavante cong|n-f-bogavante|c
bogavante congelado cong|n-f-bogavante|c
bogavante europeo|n-f-bogavante-europeo|o
bogavante grande|n-f-bogavantes-o-abacanto|c
bogavante mediano|n-f-bogavantes-o-abacanto|c
bogavante pequeno|n-f-bogavantes-o-abacanto|c
bogavantes o abacantos|n-f-bogavantes-o-abacanto|c
bogazkere|n-gpc-bogazkere|c
bohemia|n-gpc-bohemia|c
bohnapfel|n-gpc-bohnapfel|c
boiken|n-gpc-boiken|c
bola|n-b-babilla|a
boletus|n-gpc-boletus|a
bolinus brandaris|n-f-canailla|s
bolleria|n-d-bolleria|a
bolleria|n-bakery|a
bolleria cong|n-d-bolleria|c
bolsa|n-x-bolsa|a
bolsa de vacio|n-x-bolsa|a
bolsas|n-x-bolsa|a
bomba|n-d-arroz-bomba|a
bombino|n-gpc-bombino|c
bonarda|n-gpc-bonarda|c
bone in split breast with back and ribs unece 710704|n-gpc-media-pechuga-de-pavo-con-hueso-es|c
bone in split breast with back portion ribs and boneless first section wing unece 710703|n-gpc-media-pechuga-de-pavo-con-parte-de|c
bone in split breast with back portion ribs and first section wing unece 710702|n-gpc-media-pechuga-de-pavo-con-parte-de-2|c
bone in split breast with back portion ribs and wing unece 710701|n-gpc-media-pechuga-de-pavo-con-parte-de-3|c
bone in split breast with back without ribs unece 710705|n-gpc-media-pechuga-de-pavo-con-hueso-y-|c
bone in split breast with ribs and wing unece 700702|n-gpc-media-pechuga-de-pollo-con-hueso-c|c
bone in split breast with ribs unece 700701|n-gpc-media-pechuga-de-pollo-con-hueso-y|c
bone in thigh with back portion / thigh quarter unece 701102|n-gpc-contramuslo-de-pollo-con-parte-de-|c
bone in thigh with back portion unece 711102|n-gpc-contramuslo-de-pavo-con-parte-de-e|c
bone in whole breast with back and ribs unece 710604|n-gpc-pechuga-entera-de-pavo-con-hueso-e|c
bone in whole breast with back ribs and boneless first section wing meat unece 710603|n-gpc-pechuga-entera-de-pavo-con-espalda-2|c
bone in whole breast with back ribs and first section wing unece 710602|n-gpc-pechuga-entera-de-pavo-con-espalda-3|c
bone in whole breast with back ribs and wings / front half unece 710601|n-gpc-pechuga-entera-de-pavo-con-espalda|c
bone in whole breast with ribs and wings unece 700602|n-gpc-pechuga-entera-de-pollo-con-hueso-|c
bone in whole breast without back or ribs with tenderloins unece 70615|n-gpc-pechuga-entera-de-pavo-con-hueso-y|c
bone in whole breast without back with ribs and boneless first section wing meat unece 710613|n-gpc-pechuga-entera-de-pavo-con-costill|c
bone in whole breast without back with ribs and first section wings unece 710612|n-gpc-pechuga-entera-de-pavo-con-costill-2|c
bone in whole breast without back with ribs and wings unece 710611|n-gpc-pechuga-entera-de-pavo-con-costill-3|c
bone in whole breast without back with ribs unece 710614|n-gpc-pechuga-entera-de-pavo-con-hueso-y-2|c
boneless drumstick with tendon partially removed unece 711203|n-gpc-jamoncito-de-pavo-deshuesado-tendo|c
boneless drumstick with tendon removed unece 711204|n-gpc-jamoncito-de-pavo-deshuesado-sin-t|c
boneless split breast without back or ribs with tenderloin unece 710711|n-gpc-media-pechuga-de-pavo-deshuesada-c|c
boneless split breast without back rib meat and tenderloin unece 710712|n-gpc-media-pechuga-de-pavo-deshuesada-l|c
boneless split breast without rib meat unece 700704|n-gpc-media-pechuga-de-pollo-deshuesada-|c
boneless thigh squared unece 701104|n-gpc-contramuslo-de-pollo-deshuesado-es|c
boneless thigh trimmed and squared unece 701105|n-gpc-contramuslo-de-pollo-deshuesado-li-2|c
boneless thigh trimmed unece 701103|n-gpc-contramuslo-de-pollo-deshuesado-li|c
boneless whole bird without wings and giblets unece 700103|n-gpc-pollo-entero-deshuesado-sin-alas-n|c
boneless whole breast with rib meat without tenderloins unece 700603|n-gpc-pechuga-entera-de-pollo-deshuesada|c
boneless whole breast with tenderloins unece 700604|n-gpc-pechuga-entera-de-pollo-deshuesada-2|c
boneless whole breast without back ribs or tenderloins unece 710616|n-gpc-pechuga-entera-de-pavo-deshuesada-|c
boneless whole breast without tenderloins unece 700605|n-gpc-pechuga-entera-de-pollo-deshuesada-3|c
boniato|n-v-boniato|c
boniatos|n-v-boniato|c
bonito|n-f-bonito|o
bonito albacora|n-f-bonito|c
bonito atlantico rayado|n-f-bonito|c
bonito austral|n-f-bonito-austral|o
bonito bacoreta|n-f-bonito|c
bonito c/c|n-f-bonito|c
bonito c/c cong|n-f-bonito|c
bonito cong|n-f-bonito|c
bonito de vientre rayado|n-f-listado|o
bonito del norte|n-f-atun-blanco|o
bonito del norte/albacora|n-f-bonito|c
bonito del pacifico|n-f-bonito-del-pacifico|o
bonito del sur|n-f-bonito|c
bonito o v|n-f-bonito|c
bonito oriental|n-f-bonito-oriental|o
bonito s/c|n-f-bonito|c
bonito s/c cong|n-f-bonito|c
bonne louise d avranches|n-gpc-bonne-louise-d-avranches|c
boops boops|n-f-boga|s
boqueron|n-f-anchoa|o
boqueron cong|n-f-anchoa|c
boqueron frances grande|n-f-anchoa|c
boqueron francia|n-f-anchoa|c
boqueron grande|n-f-anchoa|c
boqueron italia|n-f-anchoa|c
boqueron italian terciado|n-f-anchoa|c
boqueron italiano grande|n-f-anchoa|c
boqueron nacional grande|n-f-anchoa|c
boqueron ncnal terciado|n-f-anchoa|c
boqueron portugues|n-f-anchoa|c
boqueron turco|n-f-anchoa|c
borage|n-v-borraja|a
borracho|n-f-perlon|o
borraja|n-v-borraja|c
borraja de huerta|n-v-borraja|c
borraja de huerta|n-v-borraja-de-huerta|c
borraja invernadero|n-v-borraja|c
borraja invernadero|n-v-borraja-invernadero|c
borrajas|n-v-borraja|c
borrajas o v|n-v-borraja|c
boskoop quast|n-gpc-boskoop-quast|c
bothus podas|n-f-poda|s
botifarra|n-butifarra|a
botifarra blanca|n-m-butifarra-blanca|a
botifarra fresca|n-m-butifarra-fresca|a
botifarra negra|n-m-butifarra-negra|a
botillo|n-botillo|a
botillo del bierzo|n-botillo|a
botryocladia botryoides|n-f-uva-marina|s
botrytis riesling|n-gpc-botrytis-riesling|c
botrytis semillon|n-gpc-botrytis-semillon|c
botrytis semillon/sauvignon blanc|n-gpc-botrytis-semillon-sauvignon-blanc|c
bountiful|n-gpc-bountiful|c
bourboulenc|n-gpc-bourboulenc|c
bovale|n-gpc-bovale|c
boysenberries|n-gpc-baya-de-boysen|a
brabant bellefleur|n-gpc-brabant-bellefleur|c
brachetto|n-gpc-brachetto|c
braeburn|n-gpc-braeburn|c
braeburn superstar|n-gpc-braeburn-superstar|c
brak|n-gpc-brak|c
brama australis|n-f-palometa-austral|s
brama brama|n-f-japuta|s
bramley s seedling triomphe de kiel|n-gpc-bramley-s-seedling-triomphe-de-kie|c
brancellao|n-gpc-brancellao|c
branchiostegus semifasciatus|n-f-blanquillo|s
brassica vegetables|n-gpc-coles-y-brasicas|a
brassica vegetables fresh cut|n-gpc-coles-y-brasicas|a
brava early brae|n-gpc-brava-early-brae|c
brazuelo|n-b-brazuelo|a
brazuelo de cabrito|n-gpc-brazuelo-de-cabrito|a
brazuelo de cordero|n-gpc-brazuelo-de-cordero|a
brazuelo de vacuno|n-gpc-brazuelo-de-vacuno|a
brazuelo de vacuno deshuesado|n-gpc-brazuelo-de-vacuno-deshuesado|a
bread|n-d-pan|a
bread frozen|n-d-pan|a
bread perishable|n-d-pan|a
bread shelf stable|n-d-pan|a
bread/bakery products variety packs|n-gpc-surtidos-de-panaderia|a
breadfruits|n-gpc-fruta-del-pan|a
breast and flap boneless unece 405172|n-gpc-pecho-de-cordero-con-falda-deshues|c
breast and flap unece 405010|n-gpc-pecho-de-cordero-con-falda|c
breast quarter unece 700501|n-gpc-cuarto-de-pechuga-de-pollo|c
breast skin pattern unece 712304|n-gpc-piel-de-pechuga-de-pavo-troquelada|c
breast skin unece 702301|n-gpc-piel-de-pechuga-de-pollo|c
breast skin unece 712301|n-gpc-piel-de-pechuga-de-pavo|c
breast trimmings unece 716002|n-gpc-recortes-de-pechuga-de-pavo|c
breca|n-f-breca|o
breca chata|n-f-breca-chata|o
brecas|n-f-breca|c
brecas cong|n-f-breca|c
brettacher gewuerzapfel saemling|n-gpc-brettacher-gewuerzapfel-saemling|c
breva|n-v-breva|c
brevas|n-v-breva|c
brevoortia tyrannus|n-f-sabalo-atlantico|s
brick cheese|n-gpc-queso-brick|c
brie|n-q-queso-brie|a
briosello|n-gpc-briosello|c
brisket 10 rib|n-gpc-pecho-10-costillas|c
brisket 11 rib|n-gpc-pecho-11-costillas|c
brisket 12 rib|n-gpc-pecho-12-costillas|c
brisket 13 rib|n-gpc-pecho-13-costillas|c
brisket boneless 10 rib|n-gpc-pecho-deshuesado-10-costillas|c
brisket boneless 11 rib|n-gpc-pecho-deshuesado-11-costillas|c
brisket boneless 12 rib|n-gpc-pecho-deshuesado-12-costillas|c
brisket boneless 13 rib|n-gpc-pecho-deshuesado-13-costillas|c
brisket deckle off 10 rib|n-gpc-pecho-sin-tapa-10-costillas|c
brisket deckle off 11 rib|n-gpc-pecho-sin-tapa-11-costillas|c
brisket deckle off 12 rib|n-gpc-pecho-sin-tapa-12-costillas|c
brisket deckle off 13 rib|n-gpc-pecho-sin-tapa-13-costillas|c
brisket navel plate|n-gpc-pecho-plato-de-falda|c
brisket point end deckle off 4 rib|n-gpc-punta-de-pecho-sin-tapa-4-costilla|c
brisket point end deckle off 5 rib|n-gpc-punta-de-pecho-sin-tapa-5-costilla|c
brisket point end deckle off 6 rib|n-gpc-punta-de-pecho-sin-tapa-6-costilla|c
brisket point end deckle off 7 rib|n-gpc-punta-de-pecho-sin-tapa-7-costilla|c
brisket point sternum|n-gpc-punta-de-pecho-con-esternon|c
brisket rib plate|n-gpc-pecho-con-plato-de-costillar|c
broad beans|n-gpc-haba|a
broccoli|n-v-brocoli|a
brocoli|n-v-brocoli|c
brosme brosme|n-f-brosmio|s
brosmio|n-f-brosmio|o
brosmio artico|n-f-brosmio-artico|o
brote|n-gpc-brote|a
brote de bambu|n-gpc-brote-de-bambu|a
brotes tiernos|n-v-brotes-tiernos|a
brotola|n-f-brotola|c
brotola blanca|n-f-brotola-blanca|o
brotola brasilena|n-f-brotola-brasilena|o
brotola criolla|n-f-brotola-criolla|o
brotola de barbas|n-f-mustela|o
brotola de fango|n-f-brotola-de-fango|o
brotola de roca|n-f-brotola-de-roca|o
brotola entera|n-f-brotola|c
brotola filete|n-f-brotola|c
brotola otr presentacione|n-f-brotola|c
brotola roja|n-f-brotola-roja|o
brotula barbata|n-f-mustela|s
brotula clarkae|n-f-rosada-de-clark|s
bruggers festivale|n-gpc-bruggers-festivale|c
bruja|n-f-bruja|o
brunello|n-gpc-brunello|c
brunello montalcino|n-gpc-brunello-montalcino|c
brunost|n-gpc-queso-brunost|c
brussel sprouts|n-gpc-col-de-bruselas|a
buccinum undatum|n-f-bocina|s
buey|n-f-buey|c
buey austral|n-f-buey-austral|o
buey cocido|n-f-buey|c
buey cong|n-f-buey|c
buey de mar|n-f-buey-de-mar|o
buey de mar cocido|n-f-buey-de-mar|c
buey vivo|n-f-buey|c
bufalo de agua|n-gpc-bufalo-de-agua|a
buglossidium luteum|n-f-tambor|s
bulb vegetables|n-gpc-hortalizas-de-bulbo|a
bulb vegetables fresh cut|n-gpc-hortalizas-de-bulbo|a
bullock hearts|n-gpc-anona-corazon|a
bunuelo de mar|n-f-bunuelo-de-mar|o
burgado hembra|n-f-burgado-hembra|o
burgado iberico|n-f-burgado-iberico|o
burger meat|n-b-hamburguesa|a
burnet saxifrage|n-gpc-pimpinela|a
burrata|n-q-burrata|a
burro|n-f-burro|o
burro norte o eglefino|n-f-burro|c
burros|n-f-burro|c
busano|n-f-busano|o
busuioaca de bohotin|n-gpc-busuioaca-de-bohotin|c
butifarra|n-butifarra|a
butifarra blanca|n-m-butifarra-blanca|a
butifarra fresca|n-m-butifarra-fresca|a
butifarra negra|n-m-butifarra-negra|a
butt|n-gpc-butt|c
butt and rump|n-gpc-butt-and-rump|c
butt shank off|n-gpc-butt-shank-off|c
butt square cut|n-gpc-butt-square-cut|c
butt tenderloin unece 405081|n-gpc-solomillo-de-cordero-cabeza|c
butter|n-l-mantequilla|a
butter frozen|n-l-mantequilla|a
butter perishable|n-l-mantequilla|a
butter shelf stable|n-l-mantequilla|a
butter/butter substitutes|n-butter|a
buttercheese|n-gpc-queso-butterkase|c
butterflies/moths|n-gpc-mariposas-y-polillas|a
butterflies/moths prepared/processed|n-gpc-mariposas-y-polillas|a
butterflies/moths unprepared/unprocessed|n-gpc-mariposas-y-polillas|a
butterfly cut gizzards unece 711902|n-gpc-mollejas-de-pavo-abiertas-en-marip|c
caballa|n-f-caballa|o
caballa|n-f-caballa-austral|o
caballa austral|n-f-caballa-austral|o
caballa cong|n-f-caballa|c
caballa del sur|n-f-caballa-del-sur|o
caballa del sur|n-f-estornino-del-atlantico|o
caballa o verdel|n-f-caballa|c
caballa o verdel grande|n-f-caballa|c
caballa o verdel otr pre|n-f-caballa|c
caballa o verdel pequena|n-f-caballa|c
caballa o verdel terciada|n-f-caballa|c
caballerote|n-f-pargo-gris|o
caballo|n-g-equino|a
cabecera de lomo|n-p-cabecera-de-lomo|a
cabecera de lomo limpieza especial|n-gpc-cabecera-de-lomo-limpieza-especial|a
cabernet blanc|n-gpc-cabernet-blanc|c
cabernet cortis|n-gpc-cabernet-cortis|c
cabernet dorsa|n-gpc-cabernet-dorsa|c
cabernet franc|n-gpc-cabernet-franc|c
cabernet franc/cabernet sauvignon/merlot|n-gpc-cabernet-franc-cabernet-sauvignon-|c
cabernet franc/cabernet sauvignon/merlot/petit verdot/malbec|n-gpc-cabernet-franc-cabernet-sauvignon--2|c
cabernet franc/merlot|n-gpc-cabernet-franc-merlot|c
cabernet franc/merlot/cabernet sauvignon|n-gpc-cabernet-franc-merlot-cabernet-sau|c
cabernet mitos|n-gpc-cabernet-mitos|c
cabernet noir|n-gpc-cabernet-noir|c
cabernet sauvignon|n-gpc-cabernet-sauvignon|c
cabernet sauvignon/cabernet franc/merlot|n-gpc-cabernet-sauvignon-cabernet-franc-|c
cabernet sauvignon/cabernet franc/merlot/petit verdot/malbec|n-gpc-cabernet-sauvignon-cabernet-franc--2|c
cabernet sauvignon/carmenere/merlot/petit verdot|n-gpc-cabernet-sauvignon-carmenere-merlo|c
cabernet sauvignon/gaglioppo/magliocco|n-gpc-cabernet-sauvignon-gaglioppo-magli|c
cabernet sauvignon/malbec|n-gpc-cabernet-sauvignon-malbec|c
cabernet sauvignon/malbec/syrah|n-gpc-cabernet-sauvignon-malbec-syrah|c
cabernet sauvignon/merlot|n-gpc-cabernet-sauvignon-merlot|c
cabernet sauvignon/merlot/cabernet franc|n-gpc-cabernet-sauvignon-merlot-cabernet|c
cabernet sauvignon/merlot/cabernet franc/carmenere|n-gpc-cabernet-sauvignon-merlot-cabernet-2|c
cabernet sauvignon/merlot/cabernet franc/petit verdot|n-gpc-cabernet-sauvignon-merlot-cabernet-3|c
cabernet sauvignon/merlot/cabernet franc/petit verdot/carmenere|n-gpc-cabernet-sauvignon-merlot-cabernet-4|c
cabernet sauvignon/merlot/malbec|n-gpc-cabernet-sauvignon-merlot-malbec|c
cabernet sauvignon/merlot/petit verdot|n-gpc-cabernet-sauvignon-merlot-petit-ve|c
cabernet sauvignon/merlot/petit verdot/cabernet franc|n-gpc-cabernet-sauvignon-merlot-petit-ve-2|c
cabernet sauvignon/merlot/syrah|n-gpc-cabernet-sauvignon-merlot-syrah|c
cabernet sauvignon/petit verdot|n-gpc-cabernet-sauvignon-petit-verdot|c
cabernet sauvignon/pinotage|n-gpc-cabernet-sauvignon-pinotage|c
cabernet sauvignon/pinotage/cabernet franc|n-gpc-cabernet-sauvignon-pinotage-cabern|c
cabernet sauvignon/refosco|n-gpc-cabernet-sauvignon-refosco|c
cabernet sauvignon/sangiovese|n-gpc-cabernet-sauvignon-sangiovese|c
cabernet sauvignon/syrah|n-gpc-cabernet-sauvignon-syrah|c
cabernet sauvignon/syrah/merlot|n-gpc-cabernet-sauvignon-syrah-merlot|c
cabete|n-f-cabete|o
cabeza|n-meat|c
cabeza de pollo|n-gpc-cabeza-de-pollo|a
caboc|n-gpc-queso-caboc|c
caboti|n-f-caboti|o
cabra|n-gpc-cabra|a
cabracho|n-f-cabracho|o
cabracho cong|n-f-cabracho|c
cabracho de fondo|n-f-cabracho-de-fondo|o
cabracho o rascacio|n-f-cabracho|c
cabrales|n-q-queso-azul|a
cabrales|n-q-queso-cabrales|a
cabrilla|n-f-cabrilla|o
cabrito|n-o-cordero-entero|a
cacahuete|n-d-fruto-seco|a
cacahuete con sal|n-d-fruto-seco|c
cacahuete con sal|n-v-cacahuete-con-sal|c
cacahuete sin sal|n-d-fruto-seco|c
cacahuete sin sal|n-v-cacahuete-sin-sal|c
cacahuetes|n-d-fruto-seco|c
cacao|n-d-chocolate|a
cacao soluble|n-gpc-cacao-soluble|a
cacho|n-f-cacho|o
cachucho|n-f-cachucho|o
caciocavallo|n-gpc-queso-caciocavallo|c
cactus leaves food garnish|n-gpc-nopal|a
cadelucha listada|n-f-cadelucha-listada|o
cadera|n-b-cadera|a
cadera con lomo 1 costilla|n-gpc-cadera-con-lomo-1-costilla|a
cadera con lomo 2 costillas|n-gpc-cadera-con-lomo-2-costillas|a
cadera con lomo 3 costillas|n-gpc-cadera-con-lomo-3-costillas|a
cadera con lomo 4 6 costillas|n-gpc-cadera-con-lomo-4-6-costillas|a
cadera con lomo sin costillas|n-gpc-cadera-con-lomo-sin-costillas|a
cadera de cerdo|n-gpc-cadera-de-cerdo|a
cadera de cerdo deshuesada|n-gpc-cadera-de-cerdo-deshuesada|a
cadera de vacuno|n-gpc-cadera-de-vacuno|a
cadera entera|n-gpc-cadera-entera|a
caella|n-f-tintorera|o
caerphilly|n-gpc-queso-caerphilly|c
cafe|n-d-cafe|a
cafe en capsulas|n-gpc-cafe-en-capsulas|a
cafe en grano|n-gpc-cafe-en-grano|a
cafe liquido concentrado|n-gpc-cafe-liquido-concentrado|a
cafe liquido listo para beber|n-gpc-cafe-liquido-listo-para-beber|a
cafe molido|n-gpc-cafe-molido|a
cafe soluble|n-gpc-cafe-soluble|a
caino|n-gpc-caino|a
caino blanco|n-gpc-caino-blanco|c
caino cainho|n-gpc-caino|c
caino longo|n-gpc-caino-longo|c
cakes sweet|n-gpc-pastel|a
cakes sweet frozen|n-gpc-pastel|a
cakes sweet perishable|n-gpc-pastel|a
cakes sweet shelf stable|n-gpc-pastel|a
cal karasi|n-gpc-cal-karasi|c
calabacin|n-courgette|a
calabacin blanco|n-courgette|c
calabacin blanco|n-v-calabacin-blanco|c
calabacin minicalabacin|n-courgette|c
calabacin minicalabacin|n-v-calabacin-minicalabacin|c
calabacin verde|n-courgette|c
calabacin verde|n-v-calabacin-verde|c
calabacines|n-courgette|c
calabaza|n-v-calabaza|c
calabaza de peregrino|n-gpc-calabaza-de-peregrino|a
calabaza de verano|n-v-calabaza|c
calabaza de verano|n-v-calabaza-de-verano|c
calabaza o v|n-v-calabaza|c
calabaza opo|n-gpc-calabaza-opo|a
calabazas|n-v-calabaza|c
calabazas redonda|n-v-calabaza|c
calabazas redonda|n-v-calabazas-redonda|c
calabazas violin|n-v-calabaza|c
calabazas violin|n-v-calabazas-violin|c
caladoc|n-gpc-caladoc|c
calamar|n-f-calamar|o
calamar anillas|n-f-calamar|c
calamar boston|n-f-calamar|c
calamar boston cong|n-f-calamar|c
calamar california|n-f-calamar|c
calamar california cong|n-f-calamar|c
calamar californiano|n-f-calamar|c
calamar chino|n-f-calamar|c
calamar cong|n-f-calamar|c
calamar de arrecife|n-f-calamar-de-arrecife|o
calamar de boston|n-f-calamar|o
calamar de california|n-f-calamar|o
calamar de china|n-f-calamar|o
calamar de la india|n-f-calamar|o
calamar de monterrey|n-f-calamar|o
calamar del cabo|n-f-calamar|o
calamar del peru|n-f-calamar|o
calamar descong y refrig|n-f-calamar|c
calamar espada|n-f-calamar-espada|o
calamar europeo|n-f-calamar|o
calamar indio|n-f-calamar|c
calamar indio cong|n-f-calamar|c
calamar indopacifico|n-f-calamar-indopacifico|o
calamar japones|n-f-calamar|o
calamar nacional|n-f-calamar|c
calamar nacional cong|n-f-calamar|c
calamar o pota tubo|n-f-calamar|c
calamar paraguas|n-f-calamar-paraguas|o
calamar patagonico|n-f-calamar|o
calamar patagonico 1/2/3/4|n-f-calamar|c
calamar patagonico cong|n-f-calamar|c
calamar romana|n-f-calamar|c
calamar siboga|n-f-calamar-siboga|o
calamar veteado|n-f-calamar|o
calamares romana|n-f-pescado|c
calamares romana cong|n-f-pescado|c
calamarin africano|n-f-calamarin-africano|o
calamarin de fondo|n-f-calamarin-de-fondo|o
calamarin menor|n-f-calamarin-menor|o
calamarin picudo|n-f-calamarin-picudo|o
calamus calamus|n-f-pez-pluma|s
calappa granulata|n-f-cangrejo-real|s
caldo|n-d-caldo|a
caldo de pollo|n-d-caldo|a
caldo preparado|n-d-sopa-preparada|a
california sugar pear|n-gpc-california-sugar-pear|c
callet|n-gpc-callet|c
calliblepharis jubata|n-f-alga-pestana|s
callinectes sapidus|n-f-cangrejo-azul|s
callionymus lyra|n-f-dragoncillo|s
callista chione|n-f-almejon|s
callistoctopus macropus|n-f-pulpo-patudo|s
callorhinchus callorynchus|n-f-quimera-elefante|s
callos|n-c-callos|a
callos|n-beef|c
callos a la madrilena|n-callos-cooked|a
callos cocinados|n-callos-cooked|a
caluga|n-f-caluga|o
camarate|n-gpc-camarate|c
camaron|n-f-camaron|o
camaron arquero|n-f-camaron-arquero|o
camaron blanco|n-f-camaron-blanco|o
camaron boreal|n-f-camaron-boreal|o
camaron cabezudo|n-f-camaron-cabezudo|o
camaron cabezudo del alto|n-f-camaron-cabezudo-del-alto|o
camaron chino|n-f-camaron-cristal-oriental|o
camaron cong|n-f-camaron|c
camaron cristal|n-f-camaron-cristal|o
camaron cristal oriental|n-f-camaron-cristal-oriental|o
camaron de poza|n-f-camaron-de-poza|o
camaron espinoso|n-f-camaron-espinoso|o
camaron flecha|n-f-camaron-flecha|o
camaron grande|n-f-camaron|c
camaron grande cong|n-f-camaron|c
camaron indico|n-f-camaron-indico|o
camaron indio|n-f-camaron-indio|o
camaron maoxia|n-f-camaron-maoxia|o
camaron marcial|n-f-camaron-marcial|o
camaron mediano|n-f-camaron|c
camaron mediano cong|n-f-camaron|c
camaron meridional|n-f-camaron-meridional|o
camaron moteado|n-f-camaron-moteado|o
camaron nailon liso|n-f-camaron-nailon-liso|o
camaron narval|n-f-camaron-narval|o
camaron nieve|n-f-camaron-siete-barbas|o
camaron nordico|n-f-camaron-boreal|o
camaron o v cong|n-f-camaron|c
camaron periquito|n-f-camaron-periquito|o
camaron rasposo|n-f-camaron-rasposo|o
camaron rayado de guinea|n-f-camaron-rayado-de-guinea|o
camaron real|n-f-camaron-verde|o
camaron rojo|n-f-camaron-rojo|o
camaron siete barbas|n-f-camaron-siete-barbas|o
camaron soldado|n-f-camaron-soldado|o
camaron verde|n-f-camaron-verde|o
camaroncillo|n-f-camaroncillo|o
camembert|n-q-queso-camembert|a
camemoro|n-gpc-camemoro|a
cameo|n-gpc-cameo|c
camotillo|n-f-camotillo|o
campidano|n-gpc-campidano|c
campogramma glaycos|n-f-lirio|s
camspur redchief|n-gpc-camspur-redchief|c
cana de azucar|n-d-azucar|c
cana de lomo|n-cured-loin|a
canabota|n-f-canabota|o
canabota gris|n-f-canabota-gris|o
canadilla|n-f-canadilla|c
canailla|n-f-canailla|o
canaiolo|n-gpc-canaiolo|c
canaiolo nero|n-gpc-canaiolo-nero|c
canal de cabrito|n-gpc-canal-de-cabrito|a
canal de cabrito despiezada en 4|n-gpc-canal-de-cabrito-despiezada-en-4|a
canal de cabrito despiezada en 5|n-gpc-canal-de-cabrito-despiezada-en-5|a
canal de cabrito despiezada en 6|n-gpc-canal-de-cabrito-despiezada-en-6|a
canal de cabrito en piezas|n-gpc-canal-de-cabrito-en-piezas|a
canal de cerdo|n-halfcarcass|a
canal de cordero|n-o-cordero-entero|a
canal de cordero|n-gpc-canal-de-cordero|a
canal de cordero telescopada|n-gpc-canal-de-cordero-telescopada|a
canal de vacuno|n-b-media-canal-de-vacuno|a
canal entera de bovino|n-gpc-canal-entera-de-bovino|a
canal entera de cerdo|n-gpc-canal-entera-de-cerdo|a
canaliculada|n-f-canaliculada|o
cancer bellianus|n-f-jaiba-de-roca-dientuda|s
cancer borealis|n-f-cangrejo-canadiense|s
cancer irroratus|n-f-cangrejo-atlantico|s
cancer pagurus|n-f-buey-de-mar|s
cancer porteri|n-f-jaiba-limon|s
cangrejo|n-f-cangrejo|o
cangrejo|n-f-cangrejo-atlantico|o
cangrejo|n-f-cangrejo-mediterraneo|o
cangrejo|n-f-cangrejo-rojo-del-mediterraneo|o
cangrejo africano|n-f-cangrejo-africano|o
cangrejo atlantico|n-f-cangrejo-atlantico|o
cangrejo austral|n-f-cangrejo-austral|o
cangrejo azul|n-f-cangrejo-azul|o
cangrejo azul japones|n-f-cangrejo-azul-japones|o
cangrejo azul nadador|n-f-cangrejo-azul-nadador|o
cangrejo blanco|n-f-cangrejo-blanco|o
cangrejo boreal|n-f-cangrejo-boreal|o
cangrejo canadiense|n-f-cangrejo-canadiense|o
cangrejo chino|n-f-cangrejo-chino|o
cangrejo cong|n-f-cangrejo|c
cangrejo de arrugas|n-f-cangrejo-de-arrugas|o
cangrejo de california|n-f-cangrejo-de-california|o
cangrejo de fango australiano|n-f-cangrejo-de-fango-australiano|o
cangrejo de las marismas|n-f-cangrejo-de-las-marismas|o
cangrejo de las nieves|n-f-cangrejo-de-las-nieves|o
cangrejo de mar|n-f-cangrejo|c
cangrejo de mar rojo|n-f-cangrejo-de-mar-rojo|o
cangrejo de rio|n-f-cangrejo|c
cangrejo de rio europeo|n-f-cangrejo-de-rio-europeo|o
cangrejo de rio real|n-f-cangrejo-de-rio-real|o
cangrejo de roca|n-f-cangrejo-atlantico|o
cangrejo del danubio|n-f-cangrejo-del-danubio|o
cangrejo del pacifico|n-f-cangrejo-de-california|o
cangrejo dorado|n-f-cangrejo-dorado|o
cangrejo ermitano comun|n-f-cangrejo-ermitano-comun|o
cangrejo mandarin|n-f-cangrejo-mandarin|o
cangrejo mar|n-f-cangrejo|c
cangrejo mar cong|n-f-cangrejo|c
cangrejo mediterraneo|n-f-cangrejo-mediterraneo|o
cangrejo moruno|n-f-cangrejo-moruno|o
cangrejo noble|n-f-cangrejo-de-rio-europeo|o
cangrejo pelagico|n-f-cangrejo-pelagico|o
cangrejo real|n-f-cangrejo-real|o
cangrejo real azul|n-f-cangrejo-real-azul|o
cangrejo rey|n-f-cangrejo-rey|o
cangrejo rey del caribe|n-f-cangrejo-rey-del-caribe|o
cangrejo rio|n-f-cangrejo|c
cangrejo rio cong|n-f-cangrejo|c
cangrejo rio/marisma|n-f-cangrejo|c
cangrejo rojo|n-f-cangrejo-rojo|o
cangrejo rojo del mediterraneo|n-f-cangrejo-rojo-del-mediterraneo|o
cangrejo rosa|n-f-cangrejo-rosa|o
cangrejo sucedaneo|n-f-cangrejo|c
cangrejo sucedaneo cong|n-f-cangrejo|c
cangrejo verde|n-f-cangrejo-atlantico|o
cangullo|n-f-cangullo|o
cannonau|n-gpc-cannonau|c
canonigos|n-gpc-canonigos|a
cantal|n-gpc-queso-cantal|c
cantared|n-gpc-cantared|c
canthidermis maculata|n-f-pez-ballesta-rugoso|s
canthidermis sufflamen|n-f-pejepuerco-oceanico|s
cantimpalos|n-m-chorizo-de-cantimpalos|a
cape gooseberries|n-gpc-physalis|a
capelan|n-f-capelan|o
capellan|n-f-capellan|o
capilacea|n-f-capilacea|o
capitolare biturica|n-gpc-capitolare-biturica|c
capon|n-a-poularda|a
caprettone|n-gpc-caprettone|c
capros aper|n-f-ochavo|s
caqui|n-v-caqui|c
caqui americano|n-gpc-caqui-americano|a
caqui rojo brillante|n-v-caqui|c
caqui rojo brillante|n-v-caqui-rojo-brillante|c
caqui sharon|n-v-caqui|c
caqui sharon|n-v-caqui-sharon|c
caquis|n-v-caqui|c
carabinero|n-f-carabinero|o
carabinero grande|n-f-carabinero|c
carabinero grande cong|n-f-carabinero|c
carabinero mediano|n-f-carabinero|c
carabinero pequeno|n-f-carabinero|c
carabinero pequeno cong|n-f-carabinero|c
carabineros|n-f-carabinero|c
carabineros cong|n-f-carabinero|c
carabineros o v cong|n-f-carabinero|c
caracol de mar|n-f-corneta-palo|o
caracol de tierra|n-gpc-caracol-de-tierra|a
caracol luna|n-f-caracol-luna|o
caracola|n-f-caracola|o
caracoles|n-f-caracol|c
caracoles grandes|n-f-caracol|c
caracoles pequenos|n-f-caracol|c
carambola|n-v-carambola|c
caramel|n-f-caramel|o
caramel imperial|n-f-caramel-imperial|o
caramel/toffee apples|n-gpc-manzana-de-caramelo|a
caramelo|n-d-golosina|a
caranx crysos|n-f-jurel-azul|s
caranx hippos|n-f-jurel-caballo|s
caranx rhonchus|n-f-jurel-real|s
carassius carassius|n-f-carpin|s
caraway|n-gpc-alcaravea|a
carbonero|n-f-carbonero|o
carbonero o fogonero|n-f-carbonero|c
carcasa de pollo|n-a-carcasa-de-pollo|a
carcasas|n-a-carcasa-de-pollo|a
carcass 4 way unece|n-gpc-canal-de-cabrito-despiezada-en-4|c
carcass 5 way unece|n-gpc-canal-de-cabrito-despiezada-en-5|c
carcass 6 way unece|n-gpc-canal-de-cabrito-despiezada-en-6|c
carcass pieces unece|n-gpc-canal-de-cabrito-en-piezas|c
carcass side|n-gpc-media-canal-de-bovino|c
carcass side block ready 3 way special trim unece 304003|n-gpc-media-canal-de-cerdo-despiezada-en-2|c
carcass side block ready 3 way unece 304002|n-gpc-media-canal-de-cerdo-despiezada-en|c
carcass side block ready 4 way special trim|n-gpc-media-canal-de-cerdo-despiezada-en-3|c
carcass side unece 304001|n-gpc-media-canal-de-cerdo|c
carcass side unece 404510|n-gpc-media-canal-de-cordero|c
carcass unece|n-gpc-canal-de-cabrito|c
carcass unece 404500|n-gpc-canal-de-cordero|c
carcharhinus altimus|n-f-tiburon-baboso|s
carcharhinus brachyurus|n-f-tiburon-cobrizo|s
carcharhinus falciformis|n-f-jaqueta|s
carcharhinus galapagensis|n-f-tiburon-de-galapagos|s
carcharhinus limbatus|n-f-tiburon-de-puntos-negros|s
carcharhinus obscurus|n-f-tiburon-arenero|s
carcharhinus plumbeus|n-f-tiburon-trozo|s
carcharias taurus|n-f-toro-bacota|s
carcinus aestuarii|n-f-cangrejo-mediterraneo|s
carcinus maenas|n-f-cangrejo-atlantico|s
cardenal atlantico|n-f-cardenal-atlantico|o
cardinal|n-gpc-cardinal|c
cardo|n-v-cardo|c
cardoons|n-v-cardo|a
cardos|n-v-cardo|c
careta|n-p-careta|a
careta de cerdo|n-p-careta|a
caribeneros medianos|n-f-carabinero|c
caribeneros medianos cong|n-f-carabinero|c
carignan carignano/carignane/carinena/carinyena|n-gpc-carinena|c
carignan/grenache|n-gpc-carignan-grenache|c
carinena|n-gpc-carinena|a
cariocas|n-f-carioca|c
carita|n-f-carita|o
carite sierra|n-f-carite-sierra|o
carlarius heudelotii|n-f-bagre|s
carlota|n-v-carlota|c
carlotas|n-v-carlota|c
carmen|n-gpc-carmen|c
carmenere|n-gpc-carmenere|c
carmenere/cabernet sauvignon/syrah/cabernet franc|n-gpc-carmenere-cabernet-sauvignon-syrah|c
carnada de vieja|n-f-carnada-de-vieja|o
carne|n-meat|a
carne de especies alternativas|n-gpc-carne-de-especies-alternativas|a
carne de la escapula de pavo|n-gpc-carne-de-la-escapula-de-pavo|a
carne de potro|n-g-equino|a
carne de varias especies|n-gpc-carne-de-varias-especies|a
carne del ilion de pavo|n-gpc-carne-del-ilion-de-pavo|a
carne fresca|n-meat|a
carne fresca de cerdo|n-pork|a
carne magra|n-p-magro-de-cerdo|a
carne mixta de especies alternativas|n-gpc-carne-mixta-de-especies-alternativ|a
carne para hamburguesa|n-b-carne-picada|a
carne picada|n-b-carne-picada|a
carne picada de cerdo|n-p-carne-picada-de-cerdo|a
carneiro|n-f-carneiro|o
carnes|n-meat|a
carniceria|n-meat|a
carobs|n-gpc-algarroba|a
carola|n-gpc-carola|c
carpa|n-f-carpa|o
carpa amur|n-f-amur|o
carpa cabezona|n-f-carpa-cabezona|o
carpa naranja|n-f-carpa-naranja|o
carpa plateada|n-f-carpa-plateada|o
carpa rohu|n-f-carpa-rohu|o
carpin|n-f-carpin|o
carre|n-o-costillar-de-cordero|a
carre de cabrito 6 costillas|n-gpc-carre-de-cabrito-6-costillas|a
carre de cabrito 7 costillas|n-gpc-carre-de-cabrito-7-costillas|a
carre de cabrito 8 costillas|n-gpc-carre-de-cabrito-8-costillas|a
carre de cabrito 9 costillas|n-gpc-carre-de-cabrito-9-costillas|a
carre de cabrito sin tapa 6 costillas|n-gpc-carre-de-cabrito-sin-tapa-6-costil|a
carre de cabrito sin tapa 7 costillas|n-gpc-carre-de-cabrito-sin-tapa-7-costil|a
carre de cabrito sin tapa 8 costillas|n-gpc-carre-de-cabrito-sin-tapa-8-costil|a
carre de cabrito sin tapa 9 costillas|n-gpc-carre-de-cabrito-sin-tapa-9-costil|a
carre de cordero 6 costillas|n-gpc-carre-de-cordero-6-costillas|a
carre de cordero 7 costillas|n-gpc-carre-de-cordero-7-costillas|a
carre de cordero 8 costillas|n-gpc-carre-de-cordero-8-costillas|a
carre de cordero 9 costillas|n-gpc-carre-de-cordero-9-costillas|a
carre de cordero francesado con tapa 2 costillas|n-gpc-carre-de-cordero-francesado-con-ta|a
carre de cordero francesado con tapa 3 costillas|n-gpc-carre-de-cordero-francesado-con-ta-2|a
carre de cordero francesado con tapa 4 costillas|n-gpc-carre-de-cordero-francesado-con-ta-3|a
carre de cordero francesado con tapa 5 costillas|n-gpc-carre-de-cordero-francesado-con-ta-4|a
carre de cordero francesado con tapa 6 costillas|n-gpc-carre-de-cordero-francesado-con-ta-5|a
carre de cordero francesado con tapa 7 costillas|n-gpc-carre-de-cordero-francesado-con-ta-6|a
carre de cordero francesado con tapa 8 costillas|n-gpc-carre-de-cordero-francesado-con-ta-7|a
carre de cordero francesado con tapa 9 costillas|n-gpc-carre-de-cordero-francesado-con-ta-8|a
carre de cordero francesado sin tapa 2 costillas|n-gpc-carre-de-cordero-francesado-sin-ta|a
carre de cordero francesado sin tapa 3 costillas|n-gpc-carre-de-cordero-francesado-sin-ta-2|a
carre de cordero francesado sin tapa 4 costillas|n-gpc-carre-de-cordero-francesado-sin-ta-3|a
carre de cordero francesado sin tapa 5 costillas|n-gpc-carre-de-cordero-francesado-sin-ta-4|a
carre de cordero francesado sin tapa 6 costillas|n-gpc-carre-de-cordero-francesado-sin-ta-5|a
carre de cordero francesado sin tapa 7 costillas|n-gpc-carre-de-cordero-francesado-sin-ta-6|a
carre de cordero francesado sin tapa 8 costillas|n-gpc-carre-de-cordero-francesado-sin-ta-7|a
carre de cordero francesado sin tapa 9 costillas|n-gpc-carre-de-cordero-francesado-sin-ta-8|a
carre de cordero sin tapa 6 costillas|n-gpc-carre-de-cordero-sin-tapa-6-costil|a
carre de cordero sin tapa 7 costillas|n-gpc-carre-de-cordero-sin-tapa-7-costil|a
carre de cordero sin tapa 8 costillas|n-gpc-carre-de-cordero-sin-tapa-8-costil|a
carre de cordero sin tapa 9 costillas|n-gpc-carre-de-cordero-sin-tapa-9-costil|a
carricante|n-gpc-carricante|c
carrillada|n-p-carrillera|a
carrillada|n-beef|c
carrillada guisada|n-cheek-cooked|a
carrillera|n-p-carrillera|a
carrillera al vino|n-cheek-cooked|a
carrillera de cerdo|n-p-carrillera|a
carrillera guisada|n-cheek-cooked|a
carrots|n-v-zanahoria|a
cartoixa|n-gpc-cartoixa|c
carusella|n-gpc-carusella|c
casabe del pacifico|n-f-casabe-del-pacifico|o
casco acanalado|n-f-casco-acanalado|o
casco tirreno|n-f-casco-tirreno|o
casia|n-gpc-casia|a
casings for food items|n-gpc-tripas-y-envolturas|a
casqueria|n-offal|a
casqueria de cordero|n-o-casqueria-de-cordero|a
cassava|n-v-yuca|a
cassia|n-gpc-casia|a
castana|n-v-castana|c
castana de agua|n-gpc-castana-de-agua|a
castana importacion|n-v-castana|c
castana nacional|n-v-castana|c
castanas|n-v-castana|c
castelao|n-gpc-castelao|c
castelao/tempranillo/pinot noir|n-gpc-castelao-tempranillo-pinot-noir|c
castelao/touriga nacional|n-gpc-castelao-touriga-nacional|c
castell|n-gpc-castell|c
castellana negra|n-gpc-castellana-negra|c
casteller|n-gpc-casteller|c
castelli romani|n-gpc-castelli-romani|c
castelmonte|n-gpc-castelmonte|c
cataetyx laticeps|n-f-picuca|s
catalufa|n-f-catalufa|o
catalufa pintada|n-f-catalufa-pintada|o
catarratto|n-gpc-catarratto|c
catemo africano|n-f-catemo-africano|o
caudle|n-gpc-caudle|c
caulerpa cylindracea|n-f-alga-caulerpa|s
caulerpa lentillifera|n-f-uva-de-mar|s
cauliflower|n-v-coliflor|a
cauloco|n-f-cauloco|o
caulolatilus affinis|n-f-blanquillo-peruano|s
caza y otras carnes|n-game|a
cazon|n-f-cazon|o
cazon|n-f-lija|o
cazon|n-f-tollo-lucero|o
cazon cong|n-f-cazon|c
cazon entero|n-f-cazon|c
cebolla|n-v-cebolla|c
cebolla babosa|n-v-cebolla|c
cebolla babosa|n-v-cebolla-babosa|c
cebolla blanca dulce|n-v-cebolla|c
cebolla blanca dulce|n-v-cebolla-blanca-dulce|c
cebolla calcots|n-v-cebolla|c
cebolla calcots|n-v-cebolla-calcots|c
cebolla francesa/echalote|n-v-cebolla|c
cebolla francesa/echalote|n-v-cebolla-francesa-echalote|c
cebolla grano de oro|n-v-cebolla|c
cebolla grano de oro|n-v-cebolla-grano-de-oro|c
cebolla importacion|n-v-cebolla|c
cebolla liria|n-v-cebolla|c
cebolla liria|n-v-cebolla-liria|c
cebolla morada|n-v-cebolla|c
cebolla morada|n-v-cebolla-morada|c
cebolla nueva|n-v-cebolla|c
cebolla nueva|n-v-cebolla-nueva|c
cebolla seca|n-v-cebolla|c
cebolla seca figueras|n-v-cebolla|c
cebolla tierna|n-v-cebolla|c
cebolla tierna|n-v-cebolla-tierna|c
cebolla valenciana|n-v-cebolla|c
cebolla valenciana|n-v-cebolla-valenciana|c
cebollas|n-v-cebolla|c
cebolleta|n-gpc-cebolleta|a
cebolleta en vinagre|n-d-encurtido|a
cebollino|n-v-cebollino|c
cecina|n-cecina|a
cecina de leon|n-m-cecina-de-leon|a
cecina de vacuno|n-cecina|a
cecina leon|n-m-cecina-de-leon|a
cefalopodos|n-cephalopod|a
celeriac|n-v-apio|a
celery|n-v-apio|a
celery leaves|n-gpc-hoja-de-apio|a
celica welbo|n-gpc-celica-welbo|c
celtuce|n-gpc-lechuga-esparrago|a
centolla|n-f-centolla|o
centolla chilena|n-f-centolla-chilena|o
centolla cocida grande|n-f-centolla|c
centolla cocida mediana|n-f-centolla|c
centolla cocida peququena|n-f-centolla|c
centolla de fondo|n-f-centolla-de-fondo|o
centolla de importacion|n-f-centolla|c
centolla feroz|n-f-centolla-feroz|o
centolla galicia grande|n-f-centolla|c
centolla galicia mediana|n-f-centolla|c
centolla galicia pequena|n-f-centolla|c
centolla grande|n-f-centolla|c
centolla mediana|n-f-centolla|c
centolla peququena|n-f-centolla|c
centolla peruana|n-f-centolla-peruana|o
centollas|n-f-centolla|c
centollo|n-f-centolla|o
centollon|n-f-centollon-antartico|o
centollon antartico|n-f-centollon-antartico|o
centollon chileno|n-f-centollon-antartico|o
centollos|n-f-centolla|c
centollos cong|n-f-centolla|c
centracanthus cirrus|n-f-caramel-imperial|s
centro de canal 10 costillas|n-gpc-centro-de-canal-10-costillas|a
centro de canal 11 costillas|n-gpc-centro-de-canal-11-costillas|a
centro de canal 12 costillas|n-gpc-centro-de-canal-12-costillas|a
centro de canal 13 costillas|n-gpc-centro-de-canal-13-costillas|a
centro de canal deshuesado de 10 costillas|n-gpc-centro-de-canal-deshuesado-de-10-c|a
centro de canal deshuesado de 11 costillas|n-gpc-centro-de-canal-deshuesado-de-11-c|a
centro de canal deshuesado de 12 costillas|n-gpc-centro-de-canal-deshuesado-de-12-c|a
centro de canal deshuesado de 13 costillas|n-gpc-centro-de-canal-deshuesado-de-13-c|a
centrolophus niger|n-f-romerillo|s
centrophorus granulosus|n-f-remudo-blanco|s
centrophorus squamosus|n-f-quelvacho|s
centropomus viridis|n-f-robalito|s
centroscyllium fabricii|n-f-tollo-negro|s
centroscymnus coelolepis|n-f-pailona|s
centroscymnus owstonii|n-f-rasqueta|s
centroselachus crepidater|n-f-sapata-negra|s
cep|n-gpc-boletus|a
cepiland|n-gpc-cepiland|c
cepola macrophthalma|n-f-pez-cinta|s
cepuna|n-gpc-cepuna|c
cerastoderma edule|n-f-berberecho|s
cerastoderma glaucum|n-f-berberecho-verde|s
cerasuolo|n-gpc-cerasuolo|c
cerceal|n-gpc-cerceal|c
cerdo|n-pork|a
cerdo marino|n-f-cerdo-marino|o
cereal de desayuno|n-d-cereal-de-desayuno|a
cereal en grano|n-gpc-cereal-en-grano|a
cereal products|n-gpc-producto-de-cereal|a
cereal products not ready to eat frozen|n-gpc-producto-de-cereal|a
cereal products not ready to eat shelf stable|n-gpc-producto-de-cereal|a
cereal products ready to eat perishable|n-gpc-producto-de-cereal|a
cereal products ready to eat shelf stable|n-gpc-producto-de-cereal|a
cereal/grain/pulse products variety packs|n-gpc-surtidos-de-cereales-y-legumbres|a
cereal/muesli bars|n-gpc-barrita-de-cereales|a
cereales|n-d-cereal-de-desayuno|a
cereza|n-v-cereza|c
cereza burlat sin rabo|n-v-cereza|c
cereza burlat sin rabo|n-v-cereza-burlat-sin-rabo|c
cereza california s rabo|n-v-cereza|c
cereza california s rabo|n-v-cereza-california-s-rabo|c
cereza de aragon|n-v-cereza|c
cereza de aragon|n-v-cereza-de-aragon|c
cereza importacion|n-v-cereza|c
cereza navalinda|n-v-cereza|c
cereza navalinda|n-v-cereza-navalinda|c
cereza starking|n-v-cereza|c
cereza starking|n-v-cereza-starking|c
cereza sumi|n-v-cereza|c
cereza sumi|n-v-cereza-sumi|c
cereza temprana|n-v-cereza|c
cereza temprana|n-v-cereza-temprana|c
cerezas|n-v-cereza|c
cerezas ambrunesas|n-v-cereza|c
cerezas ambrunesas|n-v-cerezas-ambrunesas|c
cerezas barbosas|n-v-cereza|c
cerezas barbosas|n-v-cerezas-barbosas|c
cerezas burlat|n-v-cereza|c
cerezas burlat|n-v-cerezas-burlat|c
cerezas california|n-v-cereza|c
cerezas california|n-v-cerezas-california|c
cerezas guindas|n-v-cereza|c
cerezas guindas|n-v-cerezas-guindas|c
cerezas jarandilla|n-v-cereza|c
cerezas jarandilla|n-v-cerezas-jarandilla|c
cerezas mollares|n-v-cereza|c
cerezas mollares|n-v-cerezas-mollares|c
cerezas o v|n-v-cereza|c
cerezas pico colorado|n-v-cereza|c
cerezas pico colorado|n-v-cerezas-pico-colorado|c
cerezas pico negro|n-v-cereza|c
cerezas pico negro|n-v-cerezas-pico-negro|c
cerezas picotas|n-v-cereza|c
cerezas picotas|n-v-cerezas-picotas|c
cero|n-f-cero|o
cerveza|n-d-cerveza|a
cervezas|n-d-cerveza|a
cesanese|n-gpc-cesanese|c
cetengraulis mysticetus|n-f-bocona|s
cetorhinus maximus|n-f-peregrino|s
cevaal|n-gpc-cevaal|c
cg 10 yellow delicious|n-gpc-cg-10-yellow-delicious|c
chaceon affinis|n-f-cangrejo-rey|s
chaceon fenneri|n-f-cangrejo-dorado|s
chaceon macphersoni|n-f-cangrejo-rosa|s
chaceon maritae|n-f-cangrejo-africano|s
chaceon notialis|n-f-cangrejo-austral|s
chaceon quinquedens|n-f-cangrejo-rojo|s
chaenocephalus aceratus|n-f-pez-hielo|s
chalota|n-gpc-chalota|a
chambourcin|n-gpc-chambourcin|c
chamelea gallina|n-f-chirla|s
champagnezoet|n-gpc-champagnezoet|c
champinon|n-v-champinon|c
champsocephalus gunnari|n-f-pez-hielo-rayado|s
chancellor|n-gpc-chancellor|c
chancharro|n-f-chancharro|o
channa striata|n-f-pez-serpiente-rayado|s
chanos chanos|n-f-sabalote|s
chanquete|n-f-chanquete|o
chanquete chino|n-f-chanquete-chino|o
chantecler belchard|n-gpc-chantecler-belchard|c
chanterelles|n-gpc-rebozuelo|a
chaource|n-gpc-queso-chaource|c
chaparrudo|n-f-chaparrudo|o
chapata|n-d-pan|a
charden|n-gpc-charden|c
chardonnay|n-gpc-chardonnay|c
chardonnay blanc|n-gpc-chardonnay-blanc|c
chardonnay chenin bl|n-gpc-chardonnay-chenin-bl|c
chardonnay rose|n-gpc-chardonnay-rose|c
chardonnay/colombard|n-gpc-chardonnay-colombard|c
chardonnay/macabeo|n-gpc-chardonnay-macabeo|c
chardonnay/moscatel|n-gpc-chardonnay-moscatel|c
chardonnay/pinot meunier/pinot noir|n-gpc-chardonnay-pinot-meunier-pinot-noi|c
chardonnay/pinot noir|n-gpc-chardonnay-pinot-noir|c
chardonnay/sauvignon blanc|n-gpc-chardonnay-sauvignon-blanc|c
chardonnay/sauvignon blanc/cortese|n-gpc-chardonnay-sauvignon-blanc-cortese|c
chardonnay/sauvignon blanc/nosiola|n-gpc-chardonnay-sauvignon-blanc-nosiola|c
chardonnay/semillon|n-gpc-chardonnay-semillon|c
chardonnay/verdelho|n-gpc-chardonnay-verdelho|c
chardonnay/viognier|n-gpc-chardonnay-viognier|c
charles ross|n-gpc-charles-ross|c
charlotte|n-gpc-charlotte|c
charneux|n-gpc-charneux|c
chascanopsetta lugubris|n-f-lenguado-pelicano|s
chasselas chasselas dore|n-gpc-chasselas-chasselas-dore|c
chasselas/mueller thurgau|n-gpc-chasselas-mueller-thurgau|c
chasselas/mueller thurgau/others|n-gpc-chasselas-mueller-thurgau-others|c
chavo|n-f-chavo|o
chayote|n-gpc-chayote|a
cheddar|n-q-queso-cheddar|a
cheese|n-cheese|a
cheese frozen|n-cheese|a
cheese in brine|n-gpc-queso-en-salmuera|c
cheese perishable|n-cheese|a
cheese shelf stable|n-cheese|a
cheese substitutes|n-gpc-sustituto-de-queso|a
cheese substitutes frozen|n-gpc-sustituto-de-queso|a
cheese substitutes perishable|n-gpc-sustituto-de-queso|a
cheese substitutes shelf stable|n-gpc-sustituto-de-queso|a
cheese/cheese substitutes|n-cheese|a
cheilopogon heterurus|n-f-pez-volador|s
cheimerius nufar|n-f-denton-nufar|s
chelidonichthys capensis|n-f-rubio-del-cabo|s
chelidonichthys cuculus|n-f-arete|s
chelidonichthys lastoviza|n-f-rubio|s
chelidonichthys lucerna|n-f-bejel|s
chelidonichthys obscurus|n-f-arete-aleton|s
chelidonichthys spinosus|n-f-rubio-de-aleta-azul|s
chelidonichthys spp|n-f-rubio|s
chelon auratus|n-f-galupe|s
chelon labrosus|n-f-lisa|s
chelon ramada|n-f-morragute|s
chelon saliens|n-f-galua|s
chenin blanc|n-gpc-chenin-blanc|c
chenin blanc/chardonnay|n-gpc-chenin-blanc-chardonnay|c
chenin blanc/sauvignon blanc|n-gpc-chenin-blanc-sauvignon-blanc|c
chenin blanc/semillon|n-gpc-chenin-blanc-semillon|c
cherax quadricarinatus|n-f-cangrejo-de-rio-real|s
cheremshyna|n-gpc-cheremshyna|c
cherimoya|n-v-chirimoya|a
cherna|n-f-cherna|o
cherna cong|n-f-cherna|c
cherna de ley|n-f-cherna-de-ley|o
cherna hapuka|n-f-cherna-hapuka|o
cherna parda|n-f-gitano|o
chernas|n-f-cherna|c
cherne barbudo|n-f-cherne-barbudo|o
cherne blanco de yemen|n-f-cherne-blanco-de-yemen|o
cherne de yemen|n-f-cherne-de-yemen|o
cherne denton|n-f-cherne-denton|o
cherne escamoso|n-f-cherne-escamoso|o
cherne moteado|n-f-cherne-moteado|o
cherne pintado de yemen|n-f-cherne-pintado-de-yemen|o
cherne sahariano|n-f-cherne-sahariano|o
cherry cox|n-gpc-cherry-cox|c
cherry tomatoes oblong|n-gpc-tomate-cherry-alargado|a
cherry tomatoes round|n-gpc-tomate-cherry-redondo|a
chervil|n-gpc-perifollo|a
chewing gum|n-gpc-chicle|a
chiavannesca|n-gpc-chiavannesca|c
chicharro|n-f-chicharro|o
chicharro ojon|n-f-chicharro-ojon|o
chicken|n-chicken|a
chicken prepared/processed|n-chicken|a
chicken sausages|n-gpc-embutido-de-pollo|a
chicken sausages prepared/processed|n-gpc-embutido-de-pollo|a
chicken unprepared/unprocessed|n-chicken|a
chickpeas|n-d-garbanzo|a
chickpeas fresh cut|n-d-garbanzo|a
chicle|n-gpc-chicle|a
chicory leaves|n-gpc-hojas-de-achicoria|a
chicory leaves|n-vegetable|a
chicory leaves fresh cut|n-gpc-hojas-de-achicoria|a
chicozapote|n-gpc-chicozapote|a
chilli peppers|n-v-guindilla|a
chimaera monstrosa|n-f-quimera|s
chinebuli|n-gpc-chinebuli|c
chinese cabbages|n-v-coles-repollo|a
chionoecetes opilio|n-f-cangrejo-de-las-nieves|s
chipiron|n-f-calamar|o
chipiron de boston|n-f-calamar|o
chipiron de california|n-f-calamar|o
chipiron de china|n-f-calamar|o
chipiron de la india|n-f-calamar|o
chipiron de monterrey|n-f-calamar|o
chipiron del cabo|n-f-calamar|o
chipiron del peru|n-f-calamar|o
chipiron europeo|n-f-calamar|o
chipiron japones|n-f-calamar|o
chipiron patagonico|n-f-calamar|o
chipiron veteado|n-f-calamar|o
chipirones|n-f-calamar|c
chipirones cong|n-f-calamar|c
chips/crisps/snack mixes natural/extruded|n-gpc-patatas-fritas-y-aperitivos|a
chips/crisps/snack mixes natural/extruded shelf stable|n-gpc-patatas-fritas-y-aperitivos|a
chirimoya|n-v-chirimoya|c
chirimoya campas|n-v-chirimoya|c
chirimoya campas|n-v-chirimoya-campas|c
chirimoya chile|n-v-chirimoya|c
chirimoya chile|n-v-chirimoya-chile|c
chirimoya fina de jete|n-v-chirimoya|c
chirimoya fina de jete|n-v-chirimoya-fina-de-jete|c
chirimoyas|n-v-chirimoya|c
chirivia|n-v-chirivia|c
chirivias|n-v-chirivia|c
chirla|n-f-chirla|o
chirla cong|n-f-chirla|c
chirla grande|n-f-chirla|c
chirla grande italia|n-f-chirla|c
chirla nacional grande|n-f-chirla|c
chirla nacional pequena|n-f-chirla|c
chirla pequena|n-f-chirla|c
chirla pequena italia|n-f-chirla|c
chirla turca|n-f-chirla|c
chistorra|n-chistorra|a
chivers delight|n-gpc-chivers-delight|c
chives|n-v-cebollino|a
chlamydoselachus anguineus|n-f-tiburon-lagarto|s
chlamys islandica|n-f-zamburina-nordica|s
chlorella|n-f-chlorella|o
chlorella vulgaris|n-f-chlorella|s
chlorophthalmus agassizi|n-f-ojoverde-u-ojiverde|s
chloroscombrus orqueta|n-f-casabe-del-pacifico|s
chlorotocus crassicornis|n-f-camaron-verde|s
chocha|n-clam|o
chochas|n-clam|c
choco|n-f-choquito|o
choco|n-f-sepia|o
choco canario|n-f-choco-canario|o
choco faraonico|n-f-sepia-faraonica|o
choco ganchudo|n-f-sepia-ganchuda|o
choco labiado|n-f-sepia-labiada|o
choco picudo|n-f-choquito-picudo|o
chocolate|n-d-chocolate|a
chocolate and chocolate/sugar candy combinations confectionery|n-d-chocolate|a
chocolate/cocoa/malt|n-gpc-cacao-soluble|a
chocolate/cocoa/malt not ready to drink|n-gpc-cacao-soluble|a
chocolate/cocoa/malt ready to drink|n-gpc-cacao-soluble|a
choi sum|n-gpc-choi-sum|a
cholga|n-f-cholga|o
chondracanthus acicularis|n-f-acicularis|s
chondrus crispus|n-f-musgo-de-irlanda|s
chopa|n-f-chopa|o
chopas|n-f-chopa|c
choped|n-chopped|a
chopitos|n-f-chopito|c
chopon|n-f-chopon|o
chopped|n-chopped|a
chopped pork|n-chopped|a
choquito|n-f-choquito|o
choquito picudo|n-f-choquito-picudo|o
chorito|n-f-mejillon-de-chile|o
chorizo|n-chorizo|a
chorizo|n-f-langostino-moruno|o
chorizo casero|n-chorizo|a
chorizo criollo|n-chorizo|a
chorizo de cantimpalos|n-m-chorizo-de-cantimpalos|a
chorizo de leon|n-m-chorizo-de-leon|a
chorizo leon|n-m-chorizo-de-leon|a
chorizo riojano|n-m-chorizo-riojano|a
christmas pippin|n-gpc-christmas-pippin|c
chromis limbata|n-f-fula-blanca|s
chromochloris zofingiensis|n-f-microalga-chromochloris|s
chucheria|n-d-golosina|a
chucho|n-f-chucho|o
chuck blade bolar|n-gpc-aguja-bola-de-espaldilla|c
chuck blade clod|n-gpc-aguja-espaldilla-entera|c
chuck blade oyster|n-gpc-aguja-llana|c
chuck blade undercut|n-gpc-aguja-pez|c
chuck bone in shoulder|n-gpc-aguja-con-espaldilla-y-hueso|c
chuck crest|n-gpc-aguja-cresta|c
chuck mock tender|n-gpc-aguja-falso-solomillo|c
chuck roll|n-gpc-aguja-deshuesada|c
chuck roll 4 rib|n-gpc-aguja-deshuesada-4-costillas|c
chuck roll 5 rib|n-gpc-aguja-deshuesada-5-costillas|c
chuck roll 6 rib|n-gpc-aguja-deshuesada-6-costillas|c
chuck roll long cut|n-gpc-aguja-deshuesada-de-corte-largo|c
chuck square cut 4 rib|n-gpc-aguja-cortada-a-escuadra-4-costill|c
chuck square cut 5 rib|n-gpc-aguja-cortada-a-escuadra-5-costill|c
chuck square cut 6 rib|n-gpc-aguja-cortada-a-escuadra-6-costill|c
chucla|n-f-chucla|o
chucla ojona|n-f-chucla-ojona|o
chucleto|n-f-chucleto|o
chuleta de aguja|n-b-aguja|a
chuleta de lomo|n-p-lomo-de-cerdo|a
chuletas de cerdo|n-p-chuletero-de-cerdo|a
chuletas de palo|n-o-costillar-de-cordero|a
chuletas de rinonada|n-p-chuletero-de-cerdo|a
chuletas de rinonada de cordero|n-o-costillar-de-cordero|a
chuletero|n-p-cabecera-de-lomo|a
chuletero de aguja|n-p-cabecera-de-lomo|a
chuletero de cerdo|n-p-chuletero-de-cerdo|a
chuleton|n-b-lomo-alto|a
chump bone in unece 504790|n-gpc-rinonada-de-cabrito-con-hueso|c
chump boneless unece 505130|n-gpc-rinonada-de-cabrito-deshuesada|c
chump sirloin bone in unece 404790|n-gpc-rinonada-de-cordero-con-hueso|c
chump sirloin boneless unece 405130|n-gpc-rinonada-de-cordero-deshuesada|c
churrasco de cerdo|n-p-costillar-de-cerdo|a
churrasco de ternera|n-b-costillar|a
churrasquitos|n-o-churrasquitos-de-cordero|a
churrasquitos de cordero|n-o-churrasquitos-de-cordero|a
chutney|n-gpc-chutney|a
chutneys/relishes|n-gpc-chutney|a
chutneys/relishes frozen|n-gpc-chutney|a
chutneys/relishes perishable|n-gpc-chutney|a
chutneys/relishes shelf stable|n-gpc-chutney|a
cicadas/leafhoppers/planthoppers|n-f-cigarra|a
cicadas/leafhoppers/planthoppers prepared/processed|n-f-cigarra|a
cicadas/leafhoppers/planthoppers unprepared/unprocessed|n-f-cigarra|a
cidra|n-gpc-cidra|a
cienna|n-gpc-cienna|c
ciervo|n-g-ciervo|a
cigala|n-f-cigala|o
cigala de andaman|n-f-cigala-de-andaman|o
cigala de bandas rojas|n-f-cigala-de-bandas-rojas|o
cigala de mozambique|n-f-cigala-de-mozambique|o
cigala del indico|n-f-cigala-del-indico|o
cigala extra|n-f-cigala|c
cigala super extra|n-f-cigala|c
cigalas|n-f-cigala|c
cigalas cong|n-f-cigala|c
cigalas grandes|n-f-cigala|c
cigalas grandes cong|n-f-cigala|c
cigalas medianas|n-f-cigala|c
cigalas medianas cong|n-f-cigala|c
cigalas pequenas|n-f-cigala|c
cigalas pequenas cong|n-f-cigala|c
cigarra|n-f-cigarra|o
cigarra enana|n-f-cigarra-enana|o
cigarra oriental|n-f-cigarra-oriental|o
cigarra roja|n-f-cigarra-roja|o
cigarras|n-f-cigarra|a
cilantro|n-gpc-cilantro|a
ciliata mustela|n-f-barbada|s
ciliegiolo|n-gpc-ciliegiolo|c
cinsault|n-gpc-cinsault|c
cinsault/cabernet sauvignon|n-gpc-cinsault-cabernet-sauvignon|c
cinsault/grenache/syrah|n-gpc-cinsault-grenache-syrah|c
cinsault/pinotage|n-gpc-cinsault-pinotage|c
cinsault/syrah|n-gpc-cinsault-syrah|c
cinta de lomo|n-p-lomo-de-cerdo|a
ciperaceas|n-gpc-ciperaceas|a
ciruela|n-v-ciruela|c
ciruela anaspar|n-v-ciruela|c
ciruela anaspar|n-v-ciruela-anaspar|c
ciruela angeleno|n-v-ciruela|c
ciruela angeleno|n-v-ciruela-angeleno|c
ciruela arandana|n-v-ciruela|c
ciruela arandana|n-v-ciruela-arandana|c
ciruela claudia|n-gpc-ciruela-claudia|a
ciruela damascena|n-gpc-ciruela-damascena|a
ciruela fresa|n-v-ciruela|c
ciruela fresa|n-v-ciruela-fresa|c
ciruela importacion|n-v-ciruela|c
ciruela japonesa|n-gpc-ciruela-japonesa|a
ciruela miel oro|n-v-ciruela|c
ciruela miel oro|n-v-ciruela-miel-oro|c
ciruela mirabel|n-gpc-ciruela-mirabel|a
ciruela mume|n-gpc-ciruela-mume|a
ciruela otra familia blac|n-v-ciruela|c
ciruela otra familia blac|n-v-ciruela-otra-familia-blac|c
ciruela red beauty|n-v-ciruela|c
ciruela red beauty|n-v-ciruela-red-beauty|c
ciruela sun gold|n-v-ciruela|c
ciruela sun gold|n-v-ciruela-sun-gold|c
ciruelas|n-v-ciruela|c
ciruelas bentheley|n-v-ciruela|c
ciruelas bentheley|n-v-ciruelas-bentheley|c
ciruelas claudia francesa|n-v-ciruela|c
ciruelas claudia francesa|n-v-ciruelas-claudia-francesa|c
ciruelas frial|n-v-ciruela|c
ciruelas frial|n-v-ciruelas-frial|c
ciruelas golden|n-v-ciruela|c
ciruelas golden|n-v-ciruelas-golden|c
ciruelas japan|n-v-ciruela|c
ciruelas japan|n-v-ciruelas-japan|c
ciruelas metheley|n-v-ciruela|c
ciruelas metheley|n-v-ciruelas-metheley|c
ciruelas moradas|n-v-ciruela|c
ciruelas moradas|n-v-ciruelas-moradas|c
ciruelas prunos|n-v-ciruela|c
ciruelas prunos|n-v-ciruelas-prunos|c
ciruelas reina claudia|n-v-ciruela|c
ciruelas reina claudia|n-v-ciruelas-reina-claudia|c
ciruelas santa rosa|n-v-ciruela|c
ciruelas santa rosa|n-v-ciruelas-santa-rosa|c
ciruelas secas|n-v-ciruela|c
ciruelas secas|n-v-ciruelas-secas|c
ciruelas tolosa|n-v-ciruela|c
ciruelas tolosa|n-v-ciruelas-tolosa|c
cirujano|n-f-cirujano|o
citharus linguatula|n-f-solleta|s
citricos|n-gpc-citricos|a
citron|n-gpc-cidra|a
citronela|n-gpc-citronela|a
citrus|n-gpc-citricos|a
citrus fresh cut|n-gpc-citricos|a
civni|n-gpc-civni|c
claca|n-f-claca|o
clairette|n-gpc-clairette|c
clairette blanc|n-gpc-clairette-blanc|c
clairette rose|n-gpc-clairette-rose|c
clapp s favourite|n-gpc-clapp-s-favourite|c
clara frijs|n-gpc-clara-frijs|c
clarias batrachus|n-f-pez-gato|s
clarias gariepinus|n-f-tinto|s
clementina|n-gpc-clementina|a
clementines|n-gpc-clementina|a
clevener|n-gpc-clevener|c
clevener traminer|n-gpc-clevener-traminer|c
clica|n-clam|o
clica|n-f-almeja-blanca|o
cloudberries|n-gpc-camemoro|a
clupea harengus|n-f-arenque|s
clupea pallasii|n-f-arenque-del-pacifico|s
cobia|n-f-cobia|o
cochinillo|n-p-cochinillo|a
cochinillo abierto|n-gpc-cochinillo-abierto|a
cochinillo entero|n-gpc-cochinillo-entero|a
cocidos|n-cooked|a
cocidos y fiambres|n-cooked|a
coco|n-v-coco|c
coco en seco|n-v-coco|c
coco en verde|n-v-coco|c
coco en verde|n-v-coco-en-verde|c
cococha bacalao|n-f-bacalao|c
cococha bacalao cong|n-f-cococha|c
cococha de rape|n-f-cococha|c
cococha o v|n-f-cococha|c
cocochas|n-f-cococha|c
cocochas cong|n-f-cococha|c
cocochas de bacalao|n-f-cococha|c
cocochas de merluza|n-f-cococha|c
cocochas merluza|n-f-cococha|c
cocochas merluza cong|n-f-cococha|c
cocochas rape|n-f-cococha|c
cocochas rape cong|n-f-cococha|c
cocos|n-v-coco|c
coda di volpe|n-gpc-coda-di-volpe|c
codega|n-gpc-codega|c
codega do larinho|n-gpc-codega-do-larinho|c
codillo|n-p-codillo|a
codillo de cerdo|n-p-codillo|a
codillo delantero|n-gpc-codillo-delantero|a
codillo trasero|n-gpc-codillo-trasero|a
codium|n-f-codium|o
codium fragile|n-f-codium|s
codium tomentosum|n-f-codium|s
codium vermilara|n-f-codium|s
codornices|n-a-codorniz|a
codorniz|n-a-codorniz|a
coelorinchus fasciatus|n-f-granadero|s
coffee capsules/pods|n-gpc-cafe-en-capsulas|a
coffee ground beans|n-gpc-cafe-molido|a
coffee liquid/not ready to drink|n-gpc-cafe-liquido-concentrado|a
coffee liquid/ready to drink|n-gpc-cafe-liquido-listo-para-beber|a
coffee soluble instant|n-gpc-cafe-soluble|a
coffee substitutes capsules/pods|n-gpc-sucedaneo-de-cafe-en-capsulas|a
coffee substitutes ground/infused|n-gpc-sucedaneo-de-cafe-molido|a
coffee substitutes liquid/ready to drink|n-gpc-sucedaneo-de-cafe-liquido|a
coffee substitutes soluble instant|n-gpc-sucedaneo-de-cafe-soluble|a
coffee whole beans|n-gpc-cafe-en-grano|a
coffee/coffee substitutes|n-gpc-cafe-y-sucedaneos-de-cafe|a
coffee/tea/substitutes|n-gpc-cafe-te-e-infusiones|a
coffee/tea/substitutes variety packs|n-gpc-surtidos-de-cafe-e-infusiones|a
cogollos|n-v-lechuga|c
cogollos|n-v-cogollos|c
cohombro|n-f-cohombro|o
cohombro naranja|n-f-cohombro-naranja|o
cohombro rojo|n-f-cohombro-rojo|o
cohombro tubo|n-f-cohombro-tubo|o
coilia nasus|n-f-daoyu|s
cojinova|n-f-cojinova|o
col china|n-v-coles-repollo|c
col china|n-v-col-china|c
col de bruselas|n-gpc-col-de-bruselas|a
col hojas lisas|n-v-coles-repollo|c
col hojas lisas|n-v-col-hojas-lisas|c
col lombarda|n-v-lombarda|c
col lombarda|n-v-col-lombarda|c
col marina|n-gpc-col-marina|a
col puntiaguda|n-gpc-col-puntiaguda|a
col rizada|n-gpc-col-rizada|a
cola de pavo|n-f-cola-de-pavo|o
colas de langosta|n-f-langosta|c
colas langostino|n-f-langostino|c
colas peladas gamba lang|n-f-gamba|c
colby|n-gpc-queso-colby|c
colby jack|n-gpc-queso-colby-jack|c
coles de bruselas|n-v-coles-repollo|c
coles de bruselas|n-v-coles-de-bruselas|c
coles lombarda|n-v-lombarda|c
coles repollo|n-v-coles-repollo|c
coles repollo frances|n-v-coles-repollo|c
coles repollo frances|n-v-coles-repollo-frances|c
coles y brasicas|n-gpc-coles-y-brasicas|a
coliflor|n-v-coliflor|c
coliflor o v|n-v-coliflor|c
coliflor ue|n-v-coliflor|c
coliflores|n-v-coliflor|c
colin|n-f-carbonero|o
colin de alaska|n-f-abadejo-de-alaska|o
colinabo|n-gpc-colinabo|a
colines|n-d-picos|a
colirrabano|n-gpc-colirrabano|a
colistium guentheri|n-f-lenguado-maori|s
colita de cuadril|n-b-tapilla|a
collar butt special trim unece 304240|n-gpc-cabecera-de-lomo-limpieza-especial|c
collina|n-gpc-collina|c
colmenilla|n-gpc-colmenilla|a
colombard|n-gpc-colombard|c
colombard ugni blanc|n-gpc-colombard-ugni-blanc|c
colombard/chardonnay|n-gpc-colombard-chardonnay|c
coloree de juillet|n-gpc-coloree-de-juillet|c
colorino|n-gpc-colorino|c
columna|n-gpc-columna|c
colwick|n-gpc-queso-colwick|c
combinaciones de cuatro piezas de pavo|n-gpc-combinaciones-de-cuatro-piezas-de--2|a
combinaciones de cuatro piezas de pollo|n-gpc-combinaciones-de-cuatro-piezas-de-|a
combinaciones de dos piezas de pavo|n-gpc-combinaciones-de-dos-piezas-de-pav|a
combinaciones de dos piezas de pollo|n-gpc-combinaciones-de-dos-piezas-de-pol|a
combinaciones de tres piezas de pavo|n-gpc-combinaciones-de-tres-piezas-de-pa|a
combinaciones de tres piezas de pollo|n-gpc-combinaciones-de-tres-piezas-de-po|a
combinado alcoholico|n-gpc-combinado-alcoholico|a
combinado sin alcohol|n-gpc-combinado-sin-alcohol|a
comice rouge|n-gpc-comice-rouge|c
comida preparada|n-d-plato-preparado|a
comino|n-d-especia|a
common chicory|n-v-endivia|a
common cultivated mushroom agaricus|n-v-champinon|a
common thyme|n-gpc-tomillo|a
completer|n-gpc-completer|c
comtesse de paris|n-gpc-comtesse-de-paris|c
cona|n-f-cona|o
concha de peregrino|n-f-vieira|o
concha fina|n-f-almejon|o
concha fina grande|n-f-almejon|c
concha fina mediana|n-f-almejon|c
concha fina o v|n-f-almejon|c
concha fina pequena|n-f-almejon|c
concholepas concholepas|n-f-loco|s
concorde|n-gpc-concorde|c
condimentos|n-d-especia|a
condo|n-gpc-condo|c
condoula|n-gpc-condoula|c
conejo|n-f-conejo|o
conejo|n-rabbit|a
conejo en trozos|n-g-conejo-troceado|a
conejo entero|n-g-conejo|a
conejo fresco|n-g-conejo|a
conejo troceado|n-g-conejo-troceado|a
confectionery based spreads|n-d-mermelada|a
confectionery based spreads shelf stable|n-d-mermelada|a
confectionery products|n-gpc-confiteria|a
confectionery products variety packs|n-gpc-surtidos-de-confiteria|a
confectionery/sugar sweetening products variety packs|n-gpc-surtidos-de-confiteria-y-azucares|a
conference|n-gpc-conferencia|c
conferencia|n-gpc-conferencia|a
confit|n-a-confit-de-pato|a
confit de pato|n-a-confit-de-pato|a
confitura|n-d-mermelada|a
congelados varios|n-d-vario|c
congelados vegeales|n-v-vegetal|c
congelados vegeales|n-v-vegeales|c
congelados vegetales|n-v-vegetal|c
conger conger|n-f-congrio|s
congrio|n-f-congrio|o
congrio cong|n-f-congrio|c
conomon melons|n-gpc-melon-conomon|a
conserva carnica|n-d-conserva-carnica|a
conserva de pescado|n-d-conserva-de-pescado|a
conserva vegetal|n-d-conserva-vegetal|a
conservas|n-preserves|a
conservas carnicas|n-d-conserva-carnica|a
conservas de pescado|n-d-conserva-de-pescado|a
conservas vegetal|n-d-conserva-vegetal|c
conservas vegetales|n-d-conserva-vegetal|a
conservas y encurtidos|n-preserves|a
contra|n-b-contra|a
contra de cabrito|n-gpc-contra-de-cabrito|a
contra de vacuno|n-gpc-contra-de-vacuno|a
contra limpia|n-gpc-contra-limpia|a
contra plana|n-gpc-contra-plana|a
contramuslito de ala de pavo|n-gpc-contramuslito-de-ala-de-pavo|a
contramuslito de ala de pollo|n-gpc-contramuslito-de-ala-de-pollo|a
contramuslo de pavo|n-a-contramuslo-de-pavo|a
contramuslo de pavo con parte de espalda|n-gpc-contramuslo-de-pavo-con-parte-de-e|a
contramuslo de pavo deshuesado|n-gpc-contramuslo-de-pavo-deshuesado|a
contramuslo de pavo limpio|n-gpc-contramuslo-de-pavo-limpio|a
contramuslo de pollo|n-a-contramuslo-de-pollo|a
contramuslo de pollo con parte de espalda|n-gpc-contramuslo-de-pollo-con-parte-de-|a
contramuslo de pollo deshuesado|n-gpc-contramuslo-de-pollo-deshuesado|a
contramuslo de pollo deshuesado escuadrado|n-gpc-contramuslo-de-pollo-deshuesado-es|a
contramuslo de pollo deshuesado limpio|n-gpc-contramuslo-de-pollo-deshuesado-li|a
contramuslo de pollo deshuesado limpio y escuadrado|n-gpc-contramuslo-de-pollo-deshuesado-li-2|a
contramuslos|n-a-contramuslo-de-pollo|a
contratapa|n-b-contra|a
cooking wines|n-gpc-vino-de-cocina|a
coop 43|n-gpc-coop-43|c
copos de avena|n-d-cereal-de-desayuno|a
coquina|n-f-coquina|o
coquinas|n-f-coquina|c
corazon|n-c-corazon|a
corazon|n-meat|c
corazon|n-beef|c
corazon de cadera|n-gpc-corazon-de-cadera|a
corazon de chuletero|n-gpc-corazon-de-chuletero|a
corazon de costillar de cordero|n-gpc-corazon-de-costillar-de-cordero|a
corazon de lomo de cerdo|n-gpc-corazon-de-lomo-de-cerdo|a
corazon de lomo de cordero|n-gpc-corazon-de-lomo-de-cordero|a
corazones de pavo con capa|n-gpc-corazones-de-pavo-con-capa|a
corazones de pavo sin capa|n-gpc-corazones-de-pavo-sin-capa|a
corazones de pollo con capa|n-gpc-corazones-de-pollo-con-capa|a
corazones de pollo sin capa|n-gpc-corazones-de-pollo-sin-capa|a
cordero|n-gpc-cordero|a
cordero entero|n-o-cordero-entero|a
cordero lechal|n-o-cordero-entero|a
cordero y cabrito|n-lamb|a
coriander|n-gpc-cilantro|a
corica soborna|n-f-espadin-del-ganges|s
coris julis|n-f-julia|s
corn indian|n-v-maiz|a
cornalin|n-gpc-cornalin|c
cornalin/cabernet sauvignon/syrah/merlot/cabernet franc|n-gpc-cornalin-cabernet-sauvignon-syrah-|c
cornalin/diolinoir/syrah|n-gpc-cornalin-diolinoir-syrah|c
corneta flautera|n-f-corneta-flautera|o
corneta palo|n-f-corneta-palo|o
cornuda|n-f-cornuda|o
coromandel red|n-gpc-coromandel-red|c
corruco|n-f-corruco|o
cortese|n-gpc-cortese|c
cortezas|n-d-aperitivo|a
cortland|n-gpc-cortland|c
corvallo|n-f-corvallo|o
corvina|n-f-corvina|o
corvina acuicultur filete|n-f-corvina|c
corvina acuicultura|n-f-corvina|c
corvina africana|n-f-corvina-africana|o
corvina arabe|n-f-corvina-arabe|o
corvina asiatica|n-f-corvina-asiatica|o
corvina bronce|n-f-corvina-bronce|o
corvina cong|n-f-corvina|c
corvina de angola|n-f-corvina-de-angola|o
corvina de boca amarilla|n-f-corvina-de-boca-amarilla|o
corvina grossa|n-gpc-corvina-grossa|c
corvina naranja|n-f-corvina-naranja|o
corvina negra|n-f-corvina-negra|o
corvina pintada|n-f-corvina-pintada|o
corvina salvaje|n-f-corvina|c
corvina tigre|n-f-corvina-tigre|o
corvina veronese|n-gpc-corvina-veronese|c
corvina veronese/rondinella/molinara|n-gpc-corvina-veronese-rondinella-molina|c
corvina/cabernet sauvignon|n-gpc-corvina-cabernet-sauvignon|c
corvina/corvinone/rondinella|n-gpc-corvina-corvinone-rondinella|c
corvina/corvinone/rondinella/molinara|n-gpc-corvina-corvinone-rondinella-molin|c
corvina/merlot|n-gpc-corvina-merlot|c
corvina/molinara/rondinella|n-gpc-corvina-molinara-rondinella|c
corvina/rondinella|n-gpc-corvina-rondinella|c
corvina/rondinella/corvinone|n-gpc-corvina-rondinella-corvinone|c
corvina/rondinella/molinara|n-gpc-corvina-rondinella-molinara|c
corvina/sangiovese|n-gpc-corvina-sangiovese|c
corvinata amarilla|n-f-corvinata-amarilla|o
corvinata azafran|n-f-corvinata-azafran|o
corvinata listada|n-f-corvinata-listada|o
corvinata pelona|n-f-corvinata-pelona|o
corvinata plateada|n-f-corvinata-plateada|o
corvinata punteada|n-f-corvinata-punteada|o
corvinato|n-f-corvinato|o
corvinon amarillo|n-f-corvinon-amarillo|o
corvinon ocelado|n-f-corvinon-ocelado|o
corvinone|n-gpc-corvinone|c
coryphaena equiselis|n-f-dorado|s
coryphaena hippurus|n-f-lampuga|s
coryphaenoides guentheri|n-f-granadero|s
coryphaenoides rupestris|n-f-granadero|s
corzo|n-gpc-corzo|a
coscia|n-gpc-coscia|c
costaiola|n-gpc-costaiola|c
costiera|n-gpc-costiera|c
costilla de cerdo|n-p-costillar-de-cerdo|a
costilla de ternera|n-b-costillar|a
costillar|n-b-costillar|a
costillar bajo de cabrito 6 costillas|n-gpc-costillar-bajo-de-cabrito-6-costil|a
costillar bajo de cabrito 7 costillas|n-gpc-costillar-bajo-de-cabrito-7-costil|a
costillar bajo de cabrito 8 costillas|n-gpc-costillar-bajo-de-cabrito-8-costil|a
costillar bajo de cabrito 9 costillas|n-gpc-costillar-bajo-de-cabrito-9-costil|a
costillar bajo de cordero 6 costillas|n-gpc-costillar-bajo-de-cordero-6-costil|a
costillar bajo de cordero 7 costillas|n-gpc-costillar-bajo-de-cordero-7-costil|a
costillar bajo de cordero 8 costillas|n-gpc-costillar-bajo-de-cordero-8-costil|a
costillar bajo de cordero 9 costillas|n-gpc-costillar-bajo-de-cordero-9-costil|a
costillar bajo de vacuno|n-gpc-costillar-bajo-de-vacuno|a
costillar completo|n-gpc-costillar-completo|a
costillar de cerdo|n-p-costillar-de-cerdo|a
costillar de cordero|n-o-costillar-de-cordero|a
costillar de lomo|n-gpc-costillar-de-lomo|a
costillar de paletilla de cerdo 2 costillas|n-gpc-costillar-de-paletilla-de-cerdo-2-|a
costillar de paletilla de cerdo 3 costillas|n-gpc-costillar-de-paletilla-de-cerdo-3-|a
costillar de paletilla de cerdo 4 costillas|n-gpc-costillar-de-paletilla-de-cerdo-4-|a
costillar de paletilla de cordero 2 costillas|n-gpc-costillar-de-paletilla-de-cordero-|a
costillar de paletilla de cordero 3 costillas|n-gpc-costillar-de-paletilla-de-cordero--2|a
costillar de paletilla de cordero 4 costillas|n-gpc-costillar-de-paletilla-de-cordero--3|a
costillar de paletilla de cordero 5 costillas|n-gpc-costillar-de-paletilla-de-cordero--4|a
costillar de paletilla de cordero francesado 2 costillas|n-gpc-costillar-de-paletilla-de-cordero--5|a
costillar de paletilla de cordero francesado 3 costillas|n-gpc-costillar-de-paletilla-de-cordero--6|a
costillar de paletilla de cordero francesado 4 costillas|n-gpc-costillar-de-paletilla-de-cordero--7|a
costillar de paletilla de cordero francesado 5 costillas|n-gpc-costillar-de-paletilla-de-cordero--8|a
costillar de panceta|n-gpc-costillar-de-panceta|a
costillar estilo st louis|n-gpc-costillar-estilo-st-louis|a
costillar preparado 4 costillas|n-gpc-costillar-preparado-4-costillas|a
costillar preparado 5 costillas|n-gpc-costillar-preparado-5-costillas|a
costillar preparado 6 costillas|n-gpc-costillar-preparado-6-costillas|a
costillar preparado 7 costillas|n-gpc-costillar-preparado-7-costillas|a
costillar preparado 8 costillas|n-gpc-costillar-preparado-8-costillas|a
costillar preparado 9 costillas|n-gpc-costillar-preparado-9-costillas|a
costillas cortas de cerdo|n-gpc-costillas-cortas-de-cerdo|a
costillas cortas de vacuno 1 costilla|n-gpc-costillas-cortas-de-vacuno-1-costi|a
costillas cortas de vacuno 2 costillas|n-gpc-costillas-cortas-de-vacuno-2-costi|a
costillas cortas de vacuno 3 costillas|n-gpc-costillas-cortas-de-vacuno-3-costi|a
costillas cortas de vacuno 4 costillas|n-gpc-costillas-cortas-de-vacuno-4-costi|a
costillas cortas de vacuno 5 costillas|n-gpc-costillas-cortas-de-vacuno-5-costi|a
costillas cortas de vacuno 6 costillas|n-gpc-costillas-cortas-de-vacuno-6-costi|a
costillas cortas de vacuno 7 costillas|n-gpc-costillas-cortas-de-vacuno-7-costi|a
costillas cortas de vacuno 8 costillas|n-gpc-costillas-cortas-de-vacuno-8-costi|a
costillas cortas de vacuno 9 costillas|n-gpc-costillas-cortas-de-vacuno-9-costi|a
costillitas de lomo|n-gpc-costillitas-de-lomo|a
cottage|n-q-requeson|a
cottage cheese|n-gpc-queso-cottage|c
cottoperca gobio|n-f-gallineta-toro|s
couderc muscat|n-gpc-couderc-muscat|c
coulommiers|n-gpc-queso-coulommiers|c
counoise|n-gpc-counoise|c
courgettes|n-courgette|a
court pendu plat|n-gpc-court-pendu-plat|c
cox s orange pippin|n-gpc-cox-s-orange-pippin|c
crabapples|n-gpc-manzana-silvestre|a
cranberries|n-gpc-arandano-rojo|a
crangon crangon|n-f-camaron-meridional|s
crassostrea virginica|n-f-ostra-virginica-u-ostra-americana|s
crato branco|n-gpc-crato-branco|c
cream|n-l-nata|a
cream cheese preparation|n-gpc-preparado-de-queso-crema|c
cream frozen|n-l-nata|a
cream perishable|n-l-nata|a
cream shelf stable|n-l-nata|a
cream substitute|n-gpc-sustituto-de-nata|a
cream substitute frozen|n-gpc-sustituto-de-nata|a
cream substitute perishable|n-gpc-sustituto-de-nata|a
cream substitute shelf stable|n-gpc-sustituto-de-nata|a
cream/cream substitutes|n-milk|a
creata|n-gpc-creata|c
crema de cacao|n-d-mermelada|a
crema de grasas mixtas|n-gpc-crema-de-grasas-mixtas|a
crema de leche|n-l-nata|a
crema de queso|n-q-queso-crema|a
crema de verduras|n-v-crema-de-verduras|a
crema para untar lactea|n-gpc-crema-para-untar-lactea|a
crema preparada|n-d-sopa-preparada|a
crepidula fornicata|n-f-seba|s
crest unece 701702|n-gpc-cresta-de-pollo|c
cresta de pollo|n-gpc-cresta-de-pollo|a
criadillas|n-c-criadillas|a
criadillas|n-meat|c
criadillas de pavo|n-gpc-criadillas-de-pavo|a
criadillas de pollo|n-gpc-criadillas-de-pollo|a
crimson bramley|n-gpc-crimson-bramley|c
cripps pink|n-gpc-cripps-pink|c
cripps red|n-gpc-cripps-red|c
criterion|n-gpc-criterion|c
croatina|n-gpc-croatina|c
croatina/others|n-gpc-croatina-others|c
croissant|n-d-bolleria|a
crooked cucumber|n-gpc-pepino-retorcido|a
croqueta|n-d-croqueta|a
croquetas|n-d-croqueta|a
croquetas cong|n-f-pescado|c
croquetas de bacalao|n-d-croqueta|c
croquetas merluza palitos|n-d-croqueta|c
crosne|n-gpc-crosne|a
crouchen|n-gpc-crouchen|c
crouchen/riesling|n-gpc-crouchen-riesling|c
crouchen/sauvignon blanc|n-gpc-crouchen-sauvignon-blanc|c
crowngold|n-gpc-crowngold|c
cruceta|n-p-secreto|a
crystallogobius linearis|n-f-gobido-de-cristal|s
cserszegi fuszeres|n-gpc-cserszegi-fuszeres|c
ctenolabrus rupestris|n-f-tabernero|s
ctenopharyngodon idella|n-f-amur|s
cuajada|n-l-cuajada|a
cuarta gama fruta|n-fruit|c
cuarta gama frutas|n-fruit|c
cuarta gama hort|n-v-cuarta-gama-hort|c
cuarta gama hortalizas|n-v-cuarta-gama-hort|c
cuarta gama hortalizas|n-v-cuarta-gama-hortalizas|c
cuarto de pechuga de pollo|n-gpc-cuarto-de-pechuga-de-pollo|a
cuarto delantero 10 costillas|n-gpc-cuarto-delantero-10-costillas|a
cuarto delantero 11 costillas|n-gpc-cuarto-delantero-11-costillas|a
cuarto delantero 12 costillas|n-gpc-cuarto-delantero-12-costillas|a
cuarto delantero 13 costillas|n-gpc-cuarto-delantero-13-costillas|a
cuarto delantero 5 costillas|n-gpc-cuarto-delantero-5-costillas|a
cuarto delantero 6 costillas|n-gpc-cuarto-delantero-6-costillas|a
cuarto delantero 7 costillas|n-gpc-cuarto-delantero-7-costillas|a
cuarto delantero 8 costillas|n-gpc-cuarto-delantero-8-costillas|a
cuarto delantero 9 costillas|n-gpc-cuarto-delantero-9-costillas|a
cuarto delantero con falda 10 costillas|n-gpc-cuarto-delantero-con-falda-10-cost|a
cuarto delantero con falda 11 costillas|n-gpc-cuarto-delantero-con-falda-11-cost|a
cuarto delantero con falda 12 costillas|n-gpc-cuarto-delantero-con-falda-12-cost|a
cuarto delantero con falda 13 costillas|n-gpc-cuarto-delantero-con-falda-13-cost|a
cuarto delantero con falda 4 costillas|n-gpc-cuarto-delantero-con-falda-4-costi|a
cuarto delantero con falda 5 costillas|n-gpc-cuarto-delantero-con-falda-5-costi|a
cuarto delantero con falda 6 costillas|n-gpc-cuarto-delantero-con-falda-6-costi|a
cuarto delantero con falda 7 costillas|n-gpc-cuarto-delantero-con-falda-7-costi|a
cuarto delantero con falda 8 costillas|n-gpc-cuarto-delantero-con-falda-8-costi|a
cuarto delantero con falda 9 costillas|n-gpc-cuarto-delantero-con-falda-9-costi|a
cuarto delantero de cabrito|n-gpc-cuarto-delantero-de-cabrito|a
cuarto delantero de cerdo 1 costilla|n-gpc-cuarto-delantero-de-cerdo-1-costil|a
cuarto delantero de cerdo 2 costillas|n-gpc-cuarto-delantero-de-cerdo-2-costil|a
cuarto delantero de cerdo 3 costillas|n-gpc-cuarto-delantero-de-cerdo-3-costil|a
cuarto delantero de cerdo 4 costillas|n-gpc-cuarto-delantero-de-cerdo-4-costil|a
cuarto delantero de cordero 3 costillas|n-gpc-cuarto-delantero-de-cordero-3-cost|a
cuarto delantero de cordero 4 costillas|n-gpc-cuarto-delantero-de-cordero-4-cost|a
cuarto delantero de cordero 5 costillas|n-gpc-cuarto-delantero-de-cordero-5-cost|a
cuarto delantero de cordero 6 costillas|n-gpc-cuarto-delantero-de-cordero-6-cost|a
cuarto delantero de cordero deshuesado 4 costillas|n-gpc-cuarto-delantero-de-cordero-deshue|a
cuarto delantero de cordero deshuesado 5 costillas|n-gpc-cuarto-delantero-de-cordero-deshue-2|a
cuarto delantero de cordero deshuesado 6 costillas|n-gpc-cuarto-delantero-de-cordero-deshue-3|a
cuarto delantero de cordero semideshuesado 4 costillas|n-gpc-cuarto-delantero-de-cordero-semide|a
cuarto delantero de cordero semideshuesado 5 costillas|n-gpc-cuarto-delantero-de-cordero-semide-2|a
cuarto delantero de cordero semideshuesado 6 costillas|n-gpc-cuarto-delantero-de-cordero-semide-3|a
cuarto trasero 1 costilla|n-gpc-cuarto-trasero-1-costilla|a
cuarto trasero 10 costillas|n-gpc-cuarto-trasero-10-costillas|a
cuarto trasero 2 costillas|n-gpc-cuarto-trasero-2-costillas|a
cuarto trasero 3 costillas|n-gpc-cuarto-trasero-3-costillas|a
cuarto trasero 4 costillas|n-gpc-cuarto-trasero-4-costillas|a
cuarto trasero 5 costillas|n-gpc-cuarto-trasero-5-costillas|a
cuarto trasero 6 costillas|n-gpc-cuarto-trasero-6-costillas|a
cuarto trasero 7 costillas|n-gpc-cuarto-trasero-7-costillas|a
cuarto trasero 8 costillas|n-gpc-cuarto-trasero-8-costillas|a
cuarto trasero 9 costillas|n-gpc-cuarto-trasero-9-costillas|a
cuarto trasero de cabrito|n-gpc-cuarto-trasero-de-cabrito|a
cuarto trasero de cerdo 8 costillas|n-gpc-cuarto-trasero-de-cerdo-8-costilla|a
cuarto trasero de cerdo 9 costillas|n-gpc-cuarto-trasero-de-cerdo-9-costilla|a
cuarto trasero de cordero 6 costillas|n-gpc-cuarto-trasero-de-cordero-6-costil|a
cuarto trasero de cordero 7 costillas|n-gpc-cuarto-trasero-de-cordero-7-costil|a
cuarto trasero de cordero 8 costillas|n-gpc-cuarto-trasero-de-cordero-8-costil|a
cuarto trasero de cordero 9 costillas|n-gpc-cuarto-trasero-de-cordero-9-costil|a
cuarto trasero de pavo|n-gpc-cuarto-trasero-de-pavo|a
cuarto trasero de pavo sin rabadilla|n-gpc-cuarto-trasero-de-pavo-sin-rabadil|a
cuarto trasero de pollo|n-a-cuarto-trasero-de-pollo|a
cuarto trasero de pollo con grasa abdominal|n-gpc-cuarto-trasero-de-pollo-con-grasa-|a
cuarto trasero de pollo con parte de espalda|n-gpc-cuarto-trasero-de-pollo-con-parte-|a
cuarto trasero de pollo con parte de espalda sin rabadilla|n-gpc-cuarto-trasero-de-pollo-con-parte--2|a
cuarto trasero de pollo con parte de espalda sin rabadilla ni grasa abdominal|n-gpc-cuarto-trasero-de-pollo-con-parte--3|a
cuarto trasero de pollo de corte corto|n-gpc-cuarto-trasero-de-pollo-de-corte-c|a
cuarto trasero de pollo de corte corto con incision en contramuslo y jamoncito|n-gpc-cuarto-trasero-de-pollo-de-corte-c-2|a
cuarto trasero de pollo de corte largo|n-gpc-cuarto-trasero-de-pollo-de-corte-l|a
cuarto trasero de pollo de corte largo con incision en contramuslo y jamoncito|n-gpc-cuarto-trasero-de-pollo-de-corte-l-2|a
cuarto trasero entero de pavo|n-gpc-cuarto-trasero-entero-de-pavo|a
cuarto trasero pistola 1 costilla|n-gpc-cuarto-trasero-pistola-1-costilla|a
cuarto trasero pistola 10 costillas|n-gpc-cuarto-trasero-pistola-10-costilla|a
cuarto trasero pistola 2 costillas|n-gpc-cuarto-trasero-pistola-2-costillas|a
cuarto trasero pistola 3 costillas|n-gpc-cuarto-trasero-pistola-3-costillas|a
cuarto trasero pistola 4 costillas|n-gpc-cuarto-trasero-pistola-4-costillas|a
cuarto trasero pistola 5 costillas|n-gpc-cuarto-trasero-pistola-5-costillas|a
cuarto trasero pistola 6 costillas|n-gpc-cuarto-trasero-pistola-6-costillas|a
cuarto trasero pistola 7 costillas|n-gpc-cuarto-trasero-pistola-7-costillas|a
cuarto trasero pistola 8 costillas|n-gpc-cuarto-trasero-pistola-8-costillas|a
cuarto trasero pistola 9 costillas|n-gpc-cuarto-trasero-pistola-9-costillas|a
cuarto trasero sin costillas|n-gpc-cuarto-trasero-sin-costillas|a
cube roll ribeye roll 4 rib|n-gpc-lomo-alto-4-costillas|c
cube roll ribeye roll 5 rib|n-gpc-lomo-alto-5-costillas|c
cube roll ribeye roll 6 rib|n-gpc-lomo-alto-6-costillas|c
cube roll ribeye roll 7 rib|n-gpc-lomo-alto-7-costillas|c
cube roll ribeye roll 8 rib|n-gpc-lomo-alto-8-costillas|c
cucumbers|n-v-pepino|a
cucumbers fresh cut|n-v-pepino|a
cucurbitaceas de piel dura|n-gpc-cucurbitaceas-de-piel-dura|a
cucurbitaceas de piel tierna|n-gpc-cucurbitaceas-de-piel-tierna|a
cucurbits edible peel|n-gpc-cucurbitaceas-de-piel-tierna|a
cucurbits edible peel fresh cut|n-gpc-cucurbitaceas-de-piel-tierna|a
cucurbits inedible peel|n-gpc-cucurbitaceas-de-piel-dura|a
cucurbits inedible peel fresh cut|n-gpc-cucurbitaceas-de-piel-dura|a
cuello de cabrito|n-gpc-cuello-de-cabrito|a
cuello de cordero|n-o-cuello-de-cordero|a
cuello de cordero deshuesado|n-gpc-cuello-de-cordero-deshuesado|a
cuello de pavo|n-gpc-cuello-de-pavo|a
cuello de pollo|n-gpc-cuello-de-pollo|a
cuello de ternera|n-b-pescuezo|a
culata de contra|n-b-contra|a
culata de contra|n-gpc-culata-de-contra|a
culata de contra de cabrito|n-gpc-culata-de-contra-de-cabrito|a
curados|n-cured|a
curd cheese|n-gpc-queso-de-cuajada|c
curled parsley|n-gpc-perejil-rizado|a
curuba|n-v-curuba|c
curubas|n-v-curuba|a
cuscus|n-d-semola|a
cutaneo del tronco|n-gpc-cutaneo-del-tronco|a
cutaneus trunci rose meat|n-gpc-cutaneo-del-tronco|c
cyclopterus lumpus|n-f-lumpo|s
cymbium olla|n-f-cona|s
cynoglossus browni|n-f-lengua-nigeriana|s
cynoglossus cadenati|n-f-lengua-de-ghana|s
cynoglossus canariensis|n-f-lengua-de-canarias|s
cynoglossus cynoglossus|n-f-lengua-tropical|s
cynoglossus senegalensis|n-f-lengua-senegalesa|s
cynoscion guatucupa|n-f-corvinata-listada|s
cynoscion phoxocephalus|n-f-corvina-naranja|s
cynoscion regalis|n-f-corvinata-punteada|s
cynoscion stolzmanni|n-f-corvinata-pelona|s
cynoscion virescens|n-f-corvinato|s
cyprinus carpio|n-f-carpa|s
cyrtodaria siliqua|n-f-almeja-propulsora|s
cystoseira dorada|n-f-cystoseira-dorada|o
cyttopsis rosea|n-f-chavo|s
d joaquina doyenne de julliet|n-gpc-d-joaquina-doyenne-de-julliet|c
dactylopterus volitans|n-f-golondrina|s
dafni|n-gpc-dafni|c
dagetichthys cadenati|n-f-lenguado-de-guinea|s
dagetichthys lusitanicus|n-f-lenguado-portugues|s
daigon|n-gpc-daigon|c
daikon|n-gpc-daikon|a
dairy based drinks|n-gpc-bebida-lactea|a
dairy based drinks not ready to drink shelf stable|n-gpc-bebida-lactea|a
dairy based drinks ready to drink perishable|n-gpc-bebida-lactea|a
dairy based drinks ready to drink shelf stable|n-gpc-bebida-lactea|a
dairy based products / meals not ready to eat/drink frozen|n-gpc-preparados-lacteos|a
dairy based products / meals not ready to eat/drink perishable|n-gpc-preparados-lacteos|a
dairy based products / meals/drink|n-gpc-preparados-lacteos|a
dairy by products|n-gpc-subproducto-lacteo|a
dairy derivatives/by products|n-dairy|a
dairy spreads|n-gpc-crema-para-untar-lactea|a
dairy spreads frozen|n-gpc-crema-para-untar-lactea|a
dairy spreads perishable|n-gpc-crema-para-untar-lactea|a
dairy spreads shelf stable|n-gpc-crema-para-untar-lactea|a
dairy substitute based drinks|n-gpc-bebida-vegetal|a
dairy substitute based drinks not ready to drink shelf stable|n-gpc-bebida-vegetal|a
dairy substitute based drinks ready to drink perishable|n-gpc-bebida-vegetal|a
dairy substitute based drinks ready to drink shelf stable|n-gpc-bebida-vegetal|a
dairy/egg based products / meals|n-gpc-platos-a-base-de-lacteos-y-huevo|a
dairy/egg based products / meals ready to eat perishable|n-gpc-platos-a-base-de-lacteos-y-huevo|a
dairy/egg based products / meals ready to eat shelf stable|n-gpc-platos-a-base-de-lacteos-y-huevo|a
dairy/egg based products / meals variety packs|n-gpc-surtidos-de-platos-con-lacteos-y-h|a
dalatias licha|n-f-lija|s
daliest|n-gpc-daliest|c
daliguy|n-gpc-daliguy|c
dalijean|n-gpc-dalijean|c
dalili delcorf estivale|n-gpc-dalili-delcorf-estivale|c
dalinbel antares|n-gpc-dalinbel-antares|c
dalinco|n-gpc-dalinco|c
daliter|n-gpc-daliter|c
dalitron|n-gpc-dalitron|c
damsons|n-gpc-ciruela-damascena|a
dandelion greens/lion s tooth|n-gpc-diente-de-leon|a
danish blue|n-gpc-queso-azul-danes|c
danziger kantapfel|n-gpc-danziger-kantapfel|c
daoyu|n-f-daoyu|o
dark trimmings unece 716004|n-gpc-recortes-de-carne-oscura-de-pavo|c
dasyatis pastinaca|n-f-chucho|s
dates|n-v-datil|a
datil|n-v-datil|c
datil deglet nour|n-v-datil|c
datil deglet nour|n-v-datil-deglet-nour|c
datil medjoul|n-v-datil|c
datil medjoul|n-v-datil-medjoul|c
datiles|n-v-datil|c
daynir|n-gpc-daynir|c
daytor|n-gpc-daytor|c
de chaunac|n-gpc-de-chaunac|c
deania calceus|n-f-tollo-pajarito|s
deania profundorum|n-f-tollo-flecha|s
decana del comicio|n-gpc-decana-del-comicio|a
decapterus macarellus|n-f-macarela|s
decosta jonagold de coster|n-gpc-decosta-jonagold-de-coster|c
deer other than roe deer|n-g-ciervo|a
deer other than roe deer prepared/processed|n-g-ciervo|a
deer other than roe deer unprepared/unprocessed|n-g-ciervo|a
defatted pattern breast skin unece 712305|n-gpc-piel-de-pechuga-de-pavo-troquelada-2|c
delaware|n-gpc-delaware|c
delbias|n-gpc-delbias|c
delblush|n-gpc-delblush|c
delbuena|n-gpc-delbuena|c
delcorf|n-gpc-delcorf|c
delcorf diana|n-gpc-delcorf-diana|c
delcoros|n-gpc-delcoros|c
delgollune|n-gpc-delgollune|c
delicious ordinaire|n-gpc-delicious-ordinaire|c
delikates|n-gpc-delikates|c
deljeni|n-gpc-deljeni|c
delor|n-gpc-delor|c
delsanne|n-gpc-delsanne|c
dentex angolensis|n-f-denton-angoleno|s
dentex canariensis|n-f-denton-canario|s
dentex dentex|n-f-denton|s
dentex gibbosus|n-f-sama-de-pluma|s
dentex macrophthalmus|n-f-cachucho|s
dentex maroccanus|n-f-sama|s
denton|n-f-denton|o
denton angoleno|n-f-denton-angoleno|o
denton canario|n-f-denton-canario|o
denton europeo|n-f-denton|o
denton nufar|n-f-denton-nufar|o
denton o sama|n-f-denton|c
denton o sama cong|n-f-denton|c
desengrasante|n-x-producto-de-limpieza|a
despensa|n-grocery|a
despiece de pierna de cabrito en 4|n-gpc-despiece-de-pierna-de-cabrito-en-4|a
despiece de pierna de cordero|n-gpc-despiece-de-pierna-de-cordero|a
despiece surtido de cabrito con hueso|n-gpc-despiece-surtido-de-cabrito-con-hu|a
despiece surtido de cordero listo para bloque|n-gpc-despiece-surtido-de-cordero-listo-|a
despojos|n-offal|a
dessert|n-gpc-dessert|c
dessert sauces/toppings/fillings|n-gpc-salsas-y-rellenos-de-postre|a
dessert sauces/toppings/fillings frozen|n-gpc-salsas-y-rellenos-de-postre|a
dessert sauces/toppings/fillings perishable|n-gpc-salsas-y-rellenos-de-postre|a
dessert sauces/toppings/fillings shelf stable|n-gpc-salsas-y-rellenos-de-postre|a
desserts|n-gpc-dessert|a
desserts frozen|n-gpc-dessert|a
desserts perishable|n-gpc-dessert|a
desserts shelf stable|n-gpc-dessert|a
desserts substitutes|n-gpc-sustituto-de-postre|a
desserts substitutes perishable|n-gpc-sustituto-de-postre|a
desserts/dessert toppings variety packs|n-gpc-surtidos-de-postres-y-coberturas|a
desserts/desserts substitutes/dessert sauces/toppings|n-gpc-postres-salsas-y-coberturas|a
destilado|n-gpc-destilado|a
destilados sin alcohol|n-gpc-destilados-sin-alcohol|a
devo|n-gpc-devo|c
diagalves|n-gpc-diagalves|c
diana spur|n-gpc-diana-spur|c
dicentrarchus labrax|n-seabass|s
dicentrarchus punctatus|n-f-baila|s
dicologlossa cuneata|n-f-acedia|s
dicolor|n-gpc-dicolor|c
dictyopteris polypodioides|n-f-alga-perfumada|s
diente de leon|n-gpc-diente-de-leon|a
dijkmanszoet|n-gpc-dijkmanszoet|c
dill|n-gpc-eneldo|a
dilsea carnosa|n-f-dilsea-carnosa|o
dimiat|n-gpc-dimiat|c
dinocardium robustum|n-f-berberecho-gigante-del-atlantico|s
diolinoir|n-gpc-diolinoir|c
diplectrum maximum|n-f-camotillo|s
diplodus annularis|n-f-raspallon|s
diplodus bellottii|n-f-raspallon-del-punto|s
diplodus cervinus|n-f-sargo-breado|s
diplodus puntazzo|n-f-sargo-picudo|s
diplodus sargus|n-f-sargo|s
diplodus vulgaris|n-f-mojarra|s
dipturus batis|n-f-noriega|s
dipturus chilensis|n-f-raya-volantin|s
dipturus innominatus|n-f-raya-dentada|s
dipturus oxyrinchus|n-f-picon|s
diretmoides pauciradiatus|n-f-aleton|s
discovery|n-gpc-discovery|c
dissostichus eleginoides|n-f-robalo-de-fondo|s
dita|n-gpc-dita|c
doc melbi|n-gpc-doc-melbi|c
docteur jules guyot|n-gpc-limonera|c
dolacomi|n-gpc-dolacomi|c
dolcelatte|n-gpc-queso-dolcelatte|c
dolcetto|n-gpc-dolcetto|c
dolcetto/syrah|n-gpc-dolcetto-syrah|c
domina|n-gpc-domina|c
don guindo|n-gpc-don-guindo|c
donacilla cornea|n-f-cadelucha-listada|s
donax semistriatus|n-f-tellerina|s
donax trunculus|n-f-coquina|s
doodles/ puffs|n-gpc-aperitivo-inflado|a
dorada|n-f-dorada|o
dorada acuic 300 400 gr|n-f-dorada|c
dorada acuic 400 600 gr|n-f-dorada|c
dorada acuic mas 600 gr|n-f-dorada|c
dorada cong|n-f-dorada|c
dorada de acuicultura o v|n-f-dorada|c
dorada de captura|n-f-dorada|c
dorada de cultivo|n-f-dorada|c
dorada salvaje|n-f-dorada|c
dorado|n-f-dorado|o
dorado|n-f-lampuga|o
doral|n-gpc-doral|c
dormilona|n-f-dormilona|o
dornfelder|n-gpc-dornfelder|c
dornfelder/pinot noir|n-gpc-dornfelder-pinot-noir|c
doryteuthis gahi|n-f-calamar|s
doryteuthis opalescens|n-f-calamar|s
doryteuthis pealeii|n-f-calamar|s
dosidicus gigas|n-f-poton-del-pacifico|s
dosinia exoleta|n-f-reloj|s
double gloucester|n-gpc-queso-double-gloucester|c
dough based products / meals|n-gpc-masas-y-elaborados-de-masa|a
dough based products / meals not ready to eat savoury frozen|n-gpc-masa-y-platos-de-masa|a
dough based products / meals not ready to eat savoury perishable|n-gpc-masa-y-platos-de-masa|a
dough based products / meals not ready to eat savoury shelf stable|n-gpc-masa-y-platos-de-masa|a
dough based products / meals ready to eat savoury perishable|n-gpc-masa-y-platos-de-masa|a
dough based products / meals ready to eat savoury shelf stable|n-gpc-masa-y-platos-de-masa|a
dough based products / meals savoury|n-gpc-masa-y-platos-de-masa|a
dough based products / meals variety packs|n-gpc-surtidos-de-masas|a
doyenne boussoch|n-gpc-doyenne-boussoch|c
doyenne d hiver|n-gpc-doyenne-d-hiver|c
doyenne du comice|n-gpc-decana-del-comicio|c
draco|n-f-pez-hielo|o
draco rayado|n-f-pez-hielo-rayado|o
dragoncillo|n-f-dragoncillo|o
dragoncillo rojo|n-f-dragoncillo-rojo|o
dragonflies|n-gpc-libelulas|a
dragonflies prepared/processed|n-gpc-libelulas|a
dragonflies unprepared/unprocessed|n-gpc-libelulas|a
drentsche bellefleur|n-gpc-drentsche-bellefleur|c
drepane africana|n-f-catemo-africano|s
dressing/dips|n-gpc-alinos-y-salsas-para-mojar|a
dressing/dips frozen|n-gpc-alinos-y-salsas-para-mojar|a
dressings/dips|n-gpc-alinos-y-salsas-para-mojar|a
dressings/dips perishable|n-gpc-alinos-y-salsas-para-mojar|a
dressings/dips shelf stable|n-gpc-alinos-y-salsas-para-mojar|a
dried breads|n-d-biscote|a
dried breads frozen|n-d-biscote|a
dried breads shelf stable|n-d-biscote|a
drinking enhancers|n-gpc-saborizante-de-bebida|a
drinking enhancers not ready to drink|n-gpc-saborizante-de-bebida|a
drinks flavoured|n-d-refresco|a
drinks flavoured not ready to drink|n-d-refresco|a
drinks flavoured ready to drink|n-d-refresco|a
droe steen|n-gpc-droe-steen|c
drogueria|n-x-producto-de-limpieza|a
drogueria|n-ambient|a
drumstick trimmings unece 716006|n-gpc-recortes-de-jamoncito-de-pavo|c
drumstick unece 701201|n-gpc-jamoncito-de-pollo|c
drumstick unece 711201|n-gpc-jamoncito-de-pavo|c
drupeggio|n-gpc-drupeggio|c
dubbele zoete aagt|n-gpc-dubbele-zoete-aagt|c
duc de bordeaux|n-gpc-duc-de-bordeaux|c
duck|n-a-pato|a
duck prepared/processed|n-a-pato|a
duck unprepared/unprocessed|n-a-pato|a
dulces|n-d-chocolate|a
dulmener rosenapfel dulman rose|n-gpc-dulmener-rosenapfel-dulman-rose|c
dulse|n-f-dulse|o
dumontia|n-f-dumontia|o
dumontia contorta|n-f-dumontia|s
dunaj|n-gpc-dunaj|c
dunaliella salina|n-f-microalga-dunaliella|s
dunantul|n-gpc-dunantul|c
dunlop|n-gpc-queso-dunlop|c
dunn s seedling|n-gpc-dunn-s-seedling|c
durian|n-gpc-durian|a
durif petit syrah|n-gpc-durif-petit-syrah|c
durondeau|n-gpc-durondeau|c
early|n-gpc-early|c
early desire|n-gpc-early-desire|c
early victoria|n-gpc-early-victoria|c
echiichthys vipera|n-f-salvariego|s
echinus esculentus|n-f-erizo-europeo|s
ecolette|n-gpc-ecolette|c
edam|n-q-queso-edam|a
eddo|n-v-eddo|c
edible bird nest|n-gpc-nido-de-golondrina|a
edible bird nest prepared/processed|n-gpc-nido-de-golondrina|a
edible bird nest unprepared/unprocessed|n-gpc-nido-de-golondrina|a
edible donkey hide gelatin|n-gpc-gelatina-de-piel-de-burro|a
edible donkey hide gelatin prepared/processed|n-gpc-gelatina-de-piel-de-burro|a
edible flowers|n-gpc-flor-comestible|a
edible flowers fresh cut|n-gpc-flor-comestible|a
egg based products / meals|n-gpc-platos-a-base-de-huevo|a
egg based products / meals not ready to eat frozen|n-gpc-platos-a-base-de-huevo|a
egg based products / meals not ready to eat perishable|n-gpc-platos-a-base-de-huevo|a
egg based products / meals not ready to eat shelf stable|n-gpc-platos-a-base-de-huevo|a
eggs extracts|n-gpc-extracto-de-huevo|a
eggs imitations|n-gpc-sucedaneo-de-huevo|a
eggs products/substitutes|n-gpc-ovoproducto|a
eggs/eggs extracts industrial process|n-grocery|a
eggs/eggs substitutes|n-grocery|a
eglefino|n-f-eglefino|o
egremont russet|n-gpc-egremont-russet|c
ehrenfelser|n-gpc-ehrenfelser|c
eifeler rambur|n-gpc-eifeler-rambur|c
eisdener klumpke|n-gpc-eisdener-klumpke|c
elaborados|n-f-elaborado|c
elaborados carnico|n-f-elaborado|c
elaborados congelados cong|n-f-elaborado|c
elaborados de pescado|n-f-elaborado|c
elaborados vegetal|n-v-vegetal|c
elaborados vegetales|n-v-vegetal|c
elan|n-gpc-elan|c
elbling|n-gpc-elbling|c
elderberries|n-gpc-sauco|a
eledone cirrhosa|n-f-pulpo-blanco|s
eledone moschata|n-f-pulpo-almizclado|s
eleginops maclovinus|n-f-marujito|s
elephant garlic|n-gpc-ajo-elefante|a
elise|n-gpc-elise|c
elise rathke|n-gpc-elise-rathke|c
elk/wapiti|n-gpc-wapiti|a
elk/wapiti prepared/processed|n-gpc-wapiti|a
elk/wapiti unprepared/unprocessed|n-gpc-wapiti|a
elliot|n-gpc-elliot|c
ellison s orange|n-gpc-ellison-s-orange|c
elongated sweet peppers pointed|n-gpc-pimiento-italiano|a
elshard|n-gpc-elshard|c
elshof|n-gpc-elshof|c
elstar and mutants|n-gpc-elstar-and-mutants|c
elstar armhold|n-gpc-elstar-armhold|c
elstar boerekamp|n-gpc-elstar-boerekamp|c
elstar palm|n-gpc-elstar-palm|c
elstar van der zalm|n-gpc-elstar-van-der-zalm|c
embutido|n-sausage|a
embutido curado|n-sausage|a
embutido de cerdo|n-gpc-embutido-de-cerdo|a
embutido de cordero|n-gpc-embutido-de-cordero|a
embutido de especies alternativas|n-gpc-embutido-de-especies-alternativas|a
embutido de pavo|n-gpc-embutido-de-pavo|a
embutido de pollo|n-gpc-embutido-de-pollo|a
embutido de ternera|n-gpc-embutido-de-ternera|a
embutido de vacuno|n-gpc-embutido-de-vacuno|a
embutido de varias especies|n-gpc-embutido-de-varias-especies|a
embutidos|n-sausage|a
emile d heyst|n-gpc-emile-d-heyst|c
emir|n-gpc-emir|c
emmelichthys nitidus|n-f-andorrero-del-cabo|s
emmental|n-q-queso-emmental|a
emmenthal|n-gpc-queso-emmenthal|c
emmons|n-gpc-emmons|c
empanada|n-d-croqueta|a
empanada cong|n-d-croqueta|c
empanadas|n-d-croqueta|c
empanadas congeladas|n-d-croqueta|c
empanadas pizzas y quiches|n-gpc-empanadas-pizzas-y-quiches|a
empanadilla|n-d-croqueta|a
empanadillas|n-d-croqueta|c
empanadillas cong|n-f-pescado|c
empanador|n-d-pan-rallado|a
emperador|n-f-pez-espada|o
empire|n-gpc-empire|c
emu|n-gpc-emu|a
emu prepared/processed|n-gpc-emu|a
emu unprepared/unprocessed|n-gpc-emu|a
enchelycore anatina|n-f-morena|s
enchelyopus cimbrius|n-f-barbuda|s
encina de mar|n-f-fucus|o
encruzado|n-gpc-encruzado|c
encurtido|n-d-encurtido|a
encurtidos|n-preserves|a
endive broad leaf|n-v-escarola|a
endive curled|n-gpc-escarola-rizada|a
endivia|n-v-endivia|c
endivia roja|n-v-endivia|c
endivia roja|n-v-endivia-roja|c
endivias|n-v-endivia|c
eneldo|n-gpc-eneldo|a
engraulis anchoita|n-f-anchoita|s
engraulis capensis|n-f-anchoa-del-africa-austral|s
engraulis encrasicolus|n-f-anchoa|s
engraulis japonicus|n-f-anchoa-japonesa|s
engraulis mordax|n-f-anchoa-de-california|s
engraulis ringens|n-f-anchoveta|s
enoki|n-gpc-enoki|a
enokitake|n-gpc-enoki|a
ensalada bolsa|n-v-ensalada-preparada|a
ensalada cuatro estaciones|n-v-ensalada-cuatro-estaciones|a
ensalada lista|n-v-ensalada-preparada|a
ensalada preparada|n-v-ensalada-preparada|a
ensis ensis|n-f-navaja-recta|s
ensis leei|n-f-navaja-americana|s
ensis macha|n-f-navaja-macha|s
ensis magnus|n-f-navaja|s
ensis siliqua|n-f-muergo|s
enteroctopus dofleini|n-f-pulpo-gigante-del-pacifico|s
enteroctopus magnificus|n-f-pulpo-gigante-africano|s
enteroctopus megalocyathus|n-f-pulpo-dormilon|s
entrana de falda|n-gpc-entrana-de-falda|a
entrana exterior|n-gpc-entrana-exterior|a
entrana gruesa|n-gpc-entrana-gruesa|a
entrana interior|n-gpc-entrana-interior|a
entrecot|n-b-lomo-alto|a
entrecote|n-b-lomo-alto|a
envases|n-ambient|a
epazote|n-gpc-epazote|a
eperlano|n-f-eperlano|o
eperlano americano|n-f-eperlano|o
ephippus orbis|n-f-pez-mariposa|s
epigonus denticulatus|n-f-bocon|s
epigonus telescopus|n-f-tomas|s
epinephelus aeneus|n-f-cherna-de-ley|s
epinephelus areolatus|n-f-cherne-blanco-de-yemen|s
epinephelus bleekeri|n-f-mero-medioluto|s
epinephelus caninus|n-f-cherne-denton|s
epinephelus chlorostigma|n-f-cherne-pintado-de-yemen|s
epinephelus costae|n-f-falso-abade|s
epinephelus diacanthus|n-f-mero-espinudo|s
epinephelus fasciatus|n-f-falso-abadejo|s
epinephelus goreensis|n-f-mero-castano|s
epinephelus itajara|n-f-mero-guaza|s
epinephelus malabaricus|n-f-mero-malabarico|s
epinephelus marginatus|n-f-mero|s
epinephelus multinotatus|n-f-cherne-moteado|s
epinephelus polylepis|n-f-cherne-escamoso|s
epoisses|n-gpc-queso-epoisses|c
equino|n-g-equino|a
equino despojo|n-g-equino|c
equino fresco|n-g-equino|c
erbaluce|n-gpc-erbaluce|c
erika|n-gpc-erika|c
eriocheir sinensis|n-f-cangrejo-chino|s
eriphia verrucosa|n-f-cangrejo-moruno|s
erizo atlantico|n-f-erizo-atlantico|o
erizo blanco|n-f-erizo-blanco|o
erizo de mar|n-f-erizo-de-mar|o
erizo europeo|n-f-erizo-europeo|o
erizo negro|n-f-erizo-negro|o
erizo violaceo|n-f-erizo-violaceo|o
erovan|n-gpc-erovan|c
eryngii|n-v-seta|a
erythrocles monodi|n-f-pez-rubi|s
escarabajos|n-gpc-escarabajos|a
escarola|n-v-escarola|c
escarola lisa|n-v-escarola|c
escarola lisa|n-v-escarola-lisa|c
escarola o v|n-v-escarola|c
escarola rizada|n-gpc-escarola-rizada|a
escarolas|n-v-escarola|c
escolar|n-f-escolar|o
escolar negro|n-f-escolar-negro|o
escorpion|n-f-escorpion|o
escorpora|n-f-escorpora|o
escorzonera|n-gpc-escorzonera|a
escupina|n-f-escupina|o
escupina grabada|n-f-escupina|o
esox lucius|n-f-lucio|s
espadin|n-f-espadin|o
espadin austral|n-f-espadin-austral|o
espadin del ganges|n-f-espadin-del-ganges|o
espagueti de mar|n-f-espagueti-de-mar|o
espaguetis|n-d-pasta|a
espalda alta de pollo|n-gpc-espalda-alta-de-pollo|a
espalda baja de pollo|n-gpc-espalda-baja-de-pollo|a
espalda baja de pollo limpia|n-gpc-espalda-baja-de-pollo-limpia|a
espalda entera de pollo|n-gpc-espalda-entera-de-pollo|a
espaldilla|n-b-espaldilla|a
espaldilla de cerdo|n-p-paletilla-de-cerdo|a
espaldilla de cordero|n-o-paletilla-de-cordero|a
espardena|n-f-espardena|o
esparrago|n-v-esparrago|c
esparrago blanco|n-v-esparrago|c
esparrago importacion|n-v-esparrago|c
esparrago o v|n-v-esparrago|c
esparrago verde|n-v-esparrago|c
esparrago verde|n-v-esparrago-verde|c
esparragos|n-v-esparrago|c
esparragos blancos|n-v-esparrago|c
esparragos blancos|n-v-esparragos-blancos|c
esparragos en conserva|n-d-conserva-vegetal|a
especia|n-d-especia|a
espetec|n-fuet|a
espeton|n-f-espeton|o
espeton boca amarilla|n-f-espeton-boca-amarilla|o
espinaca|n-v-espinaca|c
espinaca de agua|n-gpc-espinaca-de-agua|a
espinaca de nueva zelanda|n-gpc-espinaca-de-nueva-zelanda|a
espinacas|n-v-espinaca|c
espinoso|n-f-espinoso|o
espirulina|n-f-espirulina|o
espuela de gallo|n-f-acicularis|o
esqueleto de pollo|n-a-carcasa-de-pollo|a
esrom|n-gpc-queso-esrom|c
estornino|n-f-caballa-del-sur|o
estornino del atlantico|n-f-estornino-del-atlantico|o
estorninos|n-f-caballa-del-sur|c
estragon|n-gpc-estragon|a
esturion|n-f-esturion|o
esturion beluga|n-f-esturion-beluga|o
esturion blanco|n-f-esturion-blanco|o
esturion del adriatico|n-f-esturion-del-adriatico|o
esturion del danubio|n-f-esturion-del-danubio|o
esturion estrellado|n-f-esturion-estrellado|o
esturion siberiano|n-f-esturion-siberiano|o
etiqueta|n-x-etiqueta|a
etiquetas|n-x-etiqueta|a
etmopterus princeps|n-f-tollo-lucero-raspa|s
etmopterus pusillus|n-f-tollo-lucero-liso|s
etmopterus spinax|n-f-negrito|s
etmopterus spp|n-f-tollo-lucero|s
etrusca|n-gpc-etrusca|c
euthynnus affinis|n-f-bacoreta-oriental|s
euthynnus alletteratus|n-f-bacoreta|s
euthynnus lineatus|n-f-barrilete-negro|s
eutrigla gurnardus|n-f-perlon|s
extracto de huevo|n-gpc-extracto-de-huevo|a
extractos y potenciadores de sabor|n-gpc-extractos-y-potenciadores-de-sabor|a
extracts/salt/meat tenderisers|n-gpc-sal-y-ablandadores-de-carne|a
extracts/salt/meat tenderisers shelf stable|n-gpc-sal-y-ablandadores-de-carne|a
extracts/seasonings/flavour enhancers|n-gpc-extractos-y-potenciadores-de-sabor|a
extracts/seasonings/flavour enhancers shelf stable|n-gpc-extractos-y-potenciadores-de-sabor|a
eye of forequarter neck fillet unece 405152|n-gpc-filete-de-cuello-de-cordero|c
eye of loin unece 304361|n-gpc-corazon-de-lomo-de-cerdo|c
eye of rack unece 405153|n-gpc-corazon-de-costillar-de-cordero|c
eye of round|n-gpc-redondo-de-vacuno|c
eye of rump|n-gpc-corazon-de-cadera|c
eye of shortloin unece 304360|n-gpc-corazon-de-chuletero|c
eye of shortloin unece 405150|n-gpc-corazon-de-lomo-de-cordero|c
ezerjo|n-gpc-ezerjo|c
fabada en lata|n-d-conserva-carnica|a
faber|n-gpc-faber|c
faberebe|n-gpc-faberebe|c
fabes|n-d-alubia|a
faisan|n-gpc-faisan|a
falanghina|n-gpc-falanghina|c
falda|n-b-falda|a
falda de cordero|n-o-falda-de-cordero|a
falda de cordero|n-gpc-falda-de-cordero|a
falda de cordero deshuesada|n-gpc-falda-de-cordero-deshuesada|a
falda de ternera|n-b-vacio|a
falda de vacuno|n-gpc-falda-de-vacuno|a
falsa brotola|n-f-falsa-brotola|o
falsa gorgona|n-f-falsa-gorgona|o
falsa limanda|n-f-mendo-limon|o
falsa necora|n-f-falsa-necora|o
falso abade|n-f-falso-abade|o
falso abadejo|n-f-falso-abadejo|o
falso musgo de irlanda|n-f-musgo-estrellado|o
falstaff|n-gpc-falstaff|c
famoso|n-gpc-famoso|c
faneca|n-f-faneca|o
faneca cong|n-f-faneca|c
faneca noruega|n-f-faneca-noruega|o
fanecas|n-f-faneca|c
fats edible|n-gpc-grasas-comestibles|a
fats edible animal|n-gpc-grasa-animal|a
fats edible animal perishable|n-gpc-grasa-animal|a
fats edible animal shelf stable|n-gpc-grasa-animal|a
fats edible mixed|n-gpc-grasa-mixta|a
fats edible mixed perishable|n-gpc-grasa-mixta|a
fats edible mixed shelf stable|n-gpc-grasa-mixta|a
fats edible variety packs|n-gpc-surtidos-de-grasas|a
fats edible vegetable/plant|n-gpc-grasa-vegetal|a
fats edible vegetable/plant perishable|n-gpc-grasa-vegetal|a
fats edible vegetable/plant shelf stable|n-gpc-grasa-vegetal|a
favorita|n-gpc-favorita|c
feijoa|n-gpc-feijoa|a
feijoas|n-gpc-feijoa|a
fenbra braeburn fenbra|n-gpc-fenbra-braeburn-fenbra|c
fennel subspecies azoricum|n-gpc-hinojo-de-bulbo|a
fennel subspecies dulce|n-gpc-hinojo-dulce|a
fermentado|n-gpc-fermentado|a
fermentado espumoso|n-gpc-fermentado-espumoso|a
fernao pires|n-gpc-fernao-pires|c
ferns|n-gpc-helechos|a
ferns cinnamon|n-gpc-helecho-canela|a
ferns fresh cut|n-gpc-helechos|a
ferns royal|n-gpc-helecho-real|a
ferreteria|n-d-ferreteria|c
ferreteria|n-ambient|a
feta|n-q-queso-feta|a
feteasca alba|n-gpc-feteasca-alba|c
feteasca alba/leanyka|n-gpc-feteasca-alba-leanyka|c
feteasca neagra|n-gpc-feteasca-neagra|c
feteasca regala|n-gpc-feteasca-regala|c
fiambre de jamon|n-cooked-ham|a
fiambre de paleta|n-cooked-shoulder|a
fiambre de pavo|n-turkey-cold|a
fiambres|n-cooked|a
fiano|n-gpc-fiano|c
fiano/greco|n-gpc-fiano-greco|c
fiddlehead ferns|n-gpc-helecho-tierno|a
fideos|n-d-pasta|a
fiesta red pippin|n-gpc-fiesta-red-pippin|c
figs|n-v-higo|a
filet mignon|n-tenderloin|a
filete bacaladilla lirio|n-f-bacaladilla|c
filete de caballa|n-f-caballa|c
filete de corvina|n-f-corvina|c
filete de cuello de cordero|n-gpc-filete-de-cuello-de-cordero|a
filete de lenguado|n-f-lenguado|c
filete de liba|n-f-liba|c
filete de merluza|n-hake|c
filete de pavo|n-a-pechuga-de-pavo|a
filete de pechuga|n-a-pechuga-de-pollo|a
filete de perca|n-f-perca|c
filete de salmon|n-f-salmon|c
filete de sardina|n-f-sardina|c
filete de trucha|n-f-salmonete|c
filete de trucha|n-f-trucha|c
filippa|n-gpc-filippa|c
film|n-x-film|a
film transparente|n-x-film|a
finesse|n-gpc-finesse|c
finger avocados|n-gpc-aguacate-cocktail|a
finkenwerder prinz|n-gpc-finkenwerder-prinz|c
fireside|n-gpc-fireside|c
first and second section wings unece 711307|n-gpc-alas-de-pavo-de-primer-y-segundo-s|c
first and second wing section unece 711302|n-gpc-primer-y-segundo-segmento-de-ala-d|c
fisali|n-v-fisali|c
fisalis|n-v-fisali|c
fisalis amarillo enano|n-v-fisali|c
fisalis amarillo enano|n-v-fisalis-amarillo-enano|c
fisalis golden berry|n-v-fisali|c
fisalis golden berry|n-v-fisalis-golden-berry|c
fisalis tomatillo|n-v-fisali|c
fisalis tomatillo|n-v-fisalis-tomatillo|c
fish|n-gpc-pescado|a
fish prepared/processed|n-whitefish|a
fish prepared/processed frozen|n-gpc-pescado|a
fish prepared/processed perishable|n-gpc-pescado|a
fish prepared/processed shelf stable|n-gpc-pescado|a
fish substitutes|n-gpc-sustitutos-de-pescado|a
fish substitutes animal based|n-gpc-sustituto-de-pescado-de-origen-ani|a
fish substitutes animal based frozen|n-gpc-sustituto-de-pescado-de-origen-ani|a
fish substitutes animal based perishable|n-gpc-sustituto-de-pescado-de-origen-ani|a
fish substitutes animal based shelf stable|n-gpc-sustituto-de-pescado-de-origen-ani|a
fish substitutes non animal based|n-gpc-sustituto-vegetal-de-pescado|a
fish substitutes non animal based frozen|n-gpc-sustituto-vegetal-de-pescado|a
fish substitutes non animal based perishable|n-gpc-sustituto-vegetal-de-pescado|a
fish substitutes non animal based shelf stable|n-gpc-sustituto-vegetal-de-pescado|a
fish substitutes variety packs|n-gpc-surtidos-de-sustitutos-de-pescado|a
fish unprepared/unprocessed|n-whitefish|a
fish unprepared/unprocessed frozen|n-gpc-pescado|a
fish unprepared/unprocessed perishable|n-gpc-pescado|a
fish unprepared/unprocessed shelf stable|n-gpc-pescado|a
fistularia corneta|n-f-corneta-flautera|s
five flavor berries|n-gpc-schisandra|a
flamingo|n-gpc-flamingo|c
flan|n-l-postre-lacteo|a
flap boneless unece 405173|n-gpc-falda-de-cordero-deshuesada|c
flap unece 405011|n-gpc-falda-de-cordero|c
flat parsley italian|n-gpc-perejil-liso|a
flat sweet peppers tomato peppers|n-gpc-pimiento-de-tomate|a
fletan|n-f-fletan|o
fletan del pacifico|n-f-halibut-del-pacifico|o
fletan negro|n-f-fletan-negro|o
fletan o halibut|n-f-aligote|c
fletan o halibut filete|n-f-aligote|c
flies|n-gpc-moscas|a
flies prepared/processed|n-gpc-moscas|a
flies unprepared/unprocessed|n-gpc-moscas|a
flor comestible|n-gpc-flor-comestible|a
floreal|n-gpc-floreal|c
flores comestibl|n-v-flores-comestibl|c
flores comestibles|n-v-flores-comestibl|c
florina|n-gpc-florina|c
florina querina|n-gpc-florina-querina|c
flour cereal/pulse|n-d-harina|a
flour cereal/pulse shelf stable|n-d-harina|a
fogonero|n-f-carbonero|o
foie gras|n-pate|a
fondo de carne|n-d-caldo|a
fontina|n-gpc-queso-fontina|c
food additives|n-gpc-aditivo-alimentario|a
food glazes|n-gpc-glaseado-alimentario|a
food glazes shelf stable|n-gpc-glaseado-alimentario|a
food/beverage variety packs|n-gpc-surtidos-de-alimentacion|a
forcada|n-gpc-forcada|c
fore feet trotter unece 304175|n-gpc-manitas-delanteras|c
forele|n-gpc-forele|c
forelle|n-gpc-forelle|c
forequarter 1 rib unece 304005|n-gpc-cuarto-delantero-de-cerdo-1-costil|c
forequarter 10 ribs|n-gpc-cuarto-delantero-10-costillas|c
forequarter 11 ribs|n-gpc-cuarto-delantero-11-costillas|c
forequarter 12 ribs|n-gpc-cuarto-delantero-12-costillas|c
forequarter 13 ribs|n-gpc-cuarto-delantero-13-costillas|c
forequarter 2 rib unece 304006|n-gpc-cuarto-delantero-de-cerdo-2-costil|c
forequarter 3 rib unece 304007|n-gpc-cuarto-delantero-de-cerdo-3-costil|c
forequarter 3 rib unece 404969|n-gpc-cuarto-delantero-de-cordero-3-cost|c
forequarter 4 rib unece 304008|n-gpc-cuarto-delantero-de-cerdo-4-costil|c
forequarter 4 rib unece 404971|n-gpc-cuarto-delantero-de-cordero-4-cost|c
forequarter 5 rib unece 404970|n-gpc-cuarto-delantero-de-cordero-5-cost|c
forequarter 5 ribs|n-gpc-cuarto-delantero-5-costillas|c
forequarter 6 rib unece 404972|n-gpc-cuarto-delantero-de-cordero-6-cost|c
forequarter 6 ribs|n-gpc-cuarto-delantero-6-costillas|c
forequarter 7 ribs|n-gpc-cuarto-delantero-7-costillas|c
forequarter 8 ribs|n-gpc-cuarto-delantero-8-costillas|c
forequarter 9 ribs|n-gpc-cuarto-delantero-9-costillas|c
forequarter and flank 10 ribs|n-gpc-cuarto-delantero-con-falda-10-cost|c
forequarter and flank 11 ribs|n-gpc-cuarto-delantero-con-falda-11-cost|c
forequarter and flank 12 ribs|n-gpc-cuarto-delantero-con-falda-12-cost|c
forequarter and flank 13 ribs|n-gpc-cuarto-delantero-con-falda-13-cost|c
forequarter and flank 4 ribs|n-gpc-cuarto-delantero-con-falda-4-costi|c
forequarter and flank 5 ribs|n-gpc-cuarto-delantero-con-falda-5-costi|c
forequarter and flank 6 ribs|n-gpc-cuarto-delantero-con-falda-6-costi|c
forequarter and flank 7 ribs|n-gpc-cuarto-delantero-con-falda-7-costi|c
forequarter and flank 8 ribs|n-gpc-cuarto-delantero-con-falda-8-costi|c
forequarter and flank 9 ribs|n-gpc-cuarto-delantero-con-falda-9-costi|c
forequarter and flank13 ribs|n-gpc-cuarto-delantero-con-falda-13-cost|c
forequarter boneless 4 rib unece 405045|n-gpc-cuarto-delantero-de-cordero-deshue|c
forequarter boneless 5 rib unece 405046|n-gpc-cuarto-delantero-de-cordero-deshue-2|c
forequarter boneless 6 rib unece 405047|n-gpc-cuarto-delantero-de-cordero-deshue-3|c
forequarter partially boned 4 rib unece 404770|n-gpc-cuarto-delantero-de-cordero-semide|c
forequarter partially boned 5 rib unece 404771|n-gpc-cuarto-delantero-de-cordero-semide-2|c
forequarter partially boned 6 rib unece 404772|n-gpc-cuarto-delantero-de-cordero-semide-3|c
forequarter unece 504972|n-gpc-cuarto-delantero-de-cabrito|c
foreshank|n-gpc-brazuelo-de-vacuno|c
foreshank boneless|n-gpc-brazuelo-de-vacuno-deshuesado|c
foreshank unece 505030|n-gpc-brazuelo-de-cabrito|c
forquarter pair 3 rib unece 404959|n-gpc-par-de-cuartos-delanteros-de-corde|c
forquarter pair 4 rib unece 404961|n-gpc-par-de-cuartos-delanteros-de-corde-2|c
forquarter pair 5 rib unece 404960|n-gpc-par-de-cuartos-delanteros-de-corde-3|c
forquarter pair 6 rib unece 404962|n-gpc-par-de-cuartos-delanteros-de-corde-4|c
fortuna delicious|n-gpc-fortuna-delicious|c
fortune|n-gpc-fortune|c
fourme d ambert|n-gpc-queso-fourme-d-ambert|c
frambuesa|n-v-frambuesa|c
frambuesa invierno|n-v-frambuesa|c
frambuesa invierno|n-v-frambuesa-invierno|c
frambuesa verano|n-v-frambuesa|c
frambuesa verano|n-v-frambuesa-verano|c
frambuesas|n-v-frambuesa|c
francusa|n-gpc-francusa|c
frankfurt|n-frankfurt|a
franse wijnpeer|n-gpc-franse-wijnpeer|c
franse zure|n-gpc-franse-zure|c
frappato|n-gpc-frappato|c
frederick|n-gpc-frederick|c
freiherr von berlepsch|n-gpc-freiherr-von-berlepsch|c
freisa|n-gpc-freisa|c
french butter|n-gpc-french-butter|c
french colombard|n-gpc-french-colombard|c
french/wax beans|n-gpc-judia-verde|a
fresa|n-v-fresa|c
fresa silvestre|n-gpc-fresa-silvestre|a
fresas|n-v-fresa|c
fresco|n-gpc-fresco|c
fresh garnish food|n-gpc-guarnicion-fresca|a
freson|n-v-freson|c
freson camarrosa|n-v-freson|c
freson camarrosa|n-v-freson-camarrosa|c
freson candonga|n-v-freson|c
freson candonga|n-v-freson-candonga|c
freson chile|n-v-freson|c
freson chile|n-v-freson-chile|c
freson congelado|n-v-freson|c
freson fortuna|n-v-freson|c
freson fortuna|n-v-freson-fortuna|c
freson francia|n-v-freson|c
freson francia|n-v-freson-francia|c
freson oso grande|n-v-freson|c
freson oso grande|n-v-freson-oso-grande|c
freson pajaro|n-v-freson|c
freson pajaro|n-v-freson-pajaro|c
freson tudla|n-v-freson|c
freson tudla|n-v-freson-tudla|c
freson ventana|n-v-freson|c
freson ventana|n-v-freson-ventana|c
fresones|n-v-freson|c
fresquilla|n-v-fresquilla|c
fresquillas|n-v-fresquilla|c
friulano|n-gpc-friulano|c
frog|n-gpc-rana|a
frog prepared/processed|n-gpc-rana|a
frog unprepared/unprocessed|n-gpc-rana|a
fromage blanc|n-gpc-queso-blanco-batido|c
fromage de chevre|n-gpc-queso-de-cabra-frances|c
fromage frais|n-gpc-queso-fresco-batido|c
front half unece 700301|n-gpc-mitad-delantera-de-pollo|c
front half without wings / whole breast with back unece 700302|n-gpc-mitad-delantera-de-pollo-sin-alas|c
frontenac gris|n-gpc-frontenac-gris|c
frontignac|n-gpc-frontignac|c
fruit|n-fruit|a
fruit fresh cut other|n-gpc-otra-fruta-de-iv-gama|a
fruit herbal infusions/tisanes bags/loose|n-d-infusion|a
fruit herbal infusions/tisanes capsules/pods|n-gpc-infusion-en-capsulas|a
fruit herbal infusions/tisanes instant|n-gpc-infusion-soluble|a
fruit herbal infusions/tisanes liquid/not ready to drink|n-gpc-infusion-concentrada|a
fruit herbal infusions/tisanes liquid/ready to drink|n-gpc-infusion-lista-para-beber|a
fruit juice|n-gpc-zumo-de-fruta|a
fruit juice drinks|n-gpc-bebida-de-zumo-de-fruta|a
fruit juice drinks not ready to drink shelf stable|n-gpc-bebida-de-zumo-de-fruta|a
fruit juice drinks ready to drink perishable|n-gpc-bebida-de-zumo-de-fruta|a
fruit juice drinks ready to drink shelf stable|n-gpc-bebida-de-zumo-de-fruta|a
fruit juice not ready to drink frozen|n-gpc-zumo-de-fruta|a
fruit juice not ready to drink shelf stable|n-gpc-zumo-de-fruta|a
fruit juice ready to drink perishable|n-gpc-zumo-de-fruta|a
fruit juice ready to drink shelf stable|n-gpc-zumo-de-fruta|a
fruit other|n-gpc-otra-fruta-de-iv-gama|a
fruit prepared/processed|n-fruit|a
fruit prepared/processed frozen|n-fruit|a
fruit prepared/processed perishable|n-fruit|a
fruit prepared/processed shelf stable|n-fruit|a
fruit unprepared/unprocessed frozen|n-fruit|a
fruit unprepared/unprocessed shelf stable|n-fruit|a
fruit/nuts/seeds combination|n-gpc-mezclas-de-fruta-y-frutos-secos|a
fruit/nuts/seeds combination variety packs|n-gpc-surtidos-de-fruta-y-frutos-secos|a
fruit/nuts/seeds mixes|n-gpc-mezcla-de-frutos-secos|a
fruit/nuts/seeds mixes prepared/processed shelf stable|n-gpc-mezcla-de-frutos-secos|a
fruits fresh cut|n-gpc-fruta-de-iv-gama|a
fruits fresh cut variety packs mixed|n-gpc-surtidos-de-fruta-cortada|a
fruits unprepared/unprocessed fresh variety packs|n-gpc-surtidos-de-fruta|a
fruits unprepared/unprocessed frozen|n-gpc-fruta-sin-elaborar|a
fruits unprepared/unprocessed shelf stable|n-gpc-fruta-sin-elaborar|a
fruits variety packs|n-gpc-surtidos-de-fruta|a
fruits variety packs mixed|n-gpc-surtidos-de-fruta-cortada|a
fruits/vegetables variety packs unprepared/unprocessed|n-gpc-surtidos-de-fruta-y-verdura-sin-el|a
fruits/vegetables variety packs unprepared/unprocessed fresh|n-gpc-surtidos-de-fruta-y-verdura-sin-el|a
fruits/vegetables/nuts/seeds variety packs|n-gpc-surtidos-de-fruta-verdura-y-frutos|a
frureru|n-gpc-frureru|c
fruta|n-fruit|a
fruta de hueso|n-gpc-fruta-de-hueso|a
fruta de la pasion|n-fruit|c
fruta de pepita|n-gpc-fruta-de-pepita|a
fruta del pan|n-gpc-fruta-del-pan|a
fruta y verdura|n-produce|a
frutas|n-fruit|a
frutas y hortalizas|n-produce|a
fruteria|n-produce|a
fruto seco|n-d-fruto-seco|a
frutos rojos y bayas|n-gpc-frutos-rojos-y-bayas|a
frutos seco|n-d-fruto-seco|c
frutos secos|n-d-fruto-seco|a
frutos secos con cascara|n-d-fruto-seco|a
frutos secos frescos|n-d-fruto-seco|a
fucus|n-f-fucus|o
fucus spiralis|n-f-fucus|s
fucus vesiculosus|n-f-fucus|s
fuet|n-fuet|a
fuet extra|n-fuet|a
fuji and mutants|n-gpc-fuji-and-mutants|c
fuji fubrax|n-gpc-fuji-fubrax|c
fujiip|n-gpc-fujiip|c
fula|n-f-fula|o
fula blanca|n-f-fula-blanca|o
fula negra|n-f-fula-negra|o
full carcass unece 304000|n-gpc-canal-entera-de-cerdo|c
full rib plate unece 304162|n-gpc-costillar-completo|c
fumet|n-d-caldo|a
fungi|n-gpc-setas-y-hongos|a
fungi fresh cut|n-gpc-setas-y-hongos|a
furmint|n-gpc-furmint|c
gadus chalcogrammus|n-f-abadejo-de-alaska|s
gadus macrocephalus|n-f-bacalao-del-pacifico|s
gadus morhua|n-f-bacalao|s
gadus ogac|n-f-bacalao-de-groenlandia|s
gaesdonker renette|n-gpc-gaesdonker-renette|c
gaglioppo|n-gpc-gaglioppo|c
gai choy mustard greens|n-gpc-mostaza-china|a
gai lan|n-gpc-kai-lan|a
gaidropsarus ensis|n-f-bertorella-artica|s
gaidropsarus mediterraneus|n-f-bertorella|s
gaidropsarus vulgaris|n-f-lota|s
gala and mutants|n-gpc-gala-and-mutants|c
gala nowakowski|n-gpc-gala-nowakowski|c
galan|n-f-galan|o
galantina|n-galantina|a
galaxy|n-gpc-galaxy|c
galbena de odobesti|n-gpc-galbena-de-odobesti|c
gale gala malaga|n-gpc-gale-gala-malaga|c
galeodea rugosa|n-f-casco-tirreno|s
galeoides decadactylus|n-f-barbudo-enano-africano|s
galeorhinus galeus|n-f-cazon|s
galera|n-f-galera|o
galera cong|n-f-galera|c
galeus atlanticus|n-f-olayo-atlantico|s
galeus melastomus|n-f-pintarroja-bocanegra|s
galeus murinus|n-f-pintarroja-islandica|s
gallano|n-f-gallano|o
galleta|n-f-galleta|o
galleta|n-d-galleta|a
galletas|n-d-galleta|a
gallina|n-a-gallina|a
gallina de caldo|n-a-gallina|a
gallina de guinea|n-a-pintada|a
gallinas o gallinetas|n-f-gallineta|c
gallineta|n-f-gallineta|o
gallineta cong|n-f-gallineta|c
gallineta del cabo|n-f-gallineta-del-cabo|o
gallineta del pacifico|n-f-gallineta-del-pacifico|o
gallineta nordica|n-f-gallineta-nordica|o
gallineta oceanica|n-f-gallineta-oceanica|o
gallineta pinta|n-f-gallineta-pinta|o
gallineta rosada|n-f-gallineta-rosada|o
gallineta toro|n-f-gallineta-toro|o
gallo|n-f-gallo|o
gallo de s pedro|n-f-gallo|c
gallo del dia|n-f-gallo|c
gallo del norte|n-f-gallo-del-norte|o
gallo filete|n-f-gallo|c
gallo gran sol filete|n-f-gallo|c
gallo grande|n-f-gallo|c
gallo mediano|n-f-gallo|c
gallo pequeno|n-f-gallo|c
gallo plateado|n-f-gallo-plateado|o
gallos|n-f-gallo|c
gallos cong|n-f-gallo|c
galludo|n-f-galludo|o
galludo nato|n-f-galludo-nato|o
galua|n-f-galua|o
galupe|n-f-galupe|o
gamaret|n-gpc-gamaret|c
gamay|n-gpc-gamay|c
gamay/chardonnay/pinot noir|n-gpc-gamay-chardonnay-pinot-noir|c
gamay/merlot|n-gpc-gamay-merlot|c
gamay/pinot noir|n-gpc-gamay-pinot-noir|c
gamba|n-f-gamba|o
gamba /|n-f-gamba|c
gamba blanca|n-f-gamba|o
gamba cocida/salada|n-f-gamba|c
gamba cong|n-f-gamba|c
gamba de altura|n-f-gamba|o
gamba grande con cabeza|n-f-gamba|c
gamba grande con cabeza cong|n-f-gamba|c
gamba guineana|n-f-gamba|o
gamba langostinera|n-f-gamba|c
gamba mediana con cabeza|n-f-gamba|c
gamba mediana con cabeza cong|n-f-gamba|c
gamba pequena con cabeza|n-f-gamba|c
gamba pequena con cabeza cong|n-f-gamba|c
gamba roja|n-prawn|a
gamba roja del indico|n-f-gamba|o
gamba roja del mediterraneo|n-f-gamba-roja-del-mediterraneo|o
gamba sin cabeza colas|n-f-gamba|c
gamba sin cabeza colas cong|n-f-gamba|c
gambas arroceras|n-f-gamba|c
gambas cocidas grandes|n-f-gamba|c
gambas cocidas medianas|n-f-gamba|c
gambas cocidas pequenas|n-f-gamba|c
gambas gigantes|n-f-gamba|c
gambas grandes|n-f-gamba|c
gambas medianas|n-f-gamba|c
gambas pequenas|n-f-gamba|c
gambas plancha|n-f-gamba|c
gambon|n-f-gambon|o
gambon|n-f-gambon-de-mozambique|o
gambon cong|n-f-gambon|c
gambon de mozambique|n-f-gambon-de-mozambique|o
gambon grande|n-f-gambon|c
gambon grande cong|n-f-gambon|c
gambon mediano|n-f-gambon|c
gambon mediano cong|n-f-gambon|c
gambon pequeno|n-f-gambon|c
gambon pequeno cong|n-f-gambon|c
garanoir|n-gpc-garanoir|c
garanoir/merlot|n-gpc-garanoir-merlot|c
garbanzo|n-d-garbanzo|a
garbanzo castellano|n-d-garbanzo-castellano|a
garbanzo lechoso|n-d-garbanzo-lechoso|a
garbanzo pedrosillano|n-d-garbanzo-pedrosillano|a
garbanzos|n-d-garbanzo|a
garcia|n-gpc-garcia|c
garden cress|n-gpc-mastuerzo|a
garganega|n-gpc-garganega|c
garganega/chardonnay|n-gpc-garganega-chardonnay|c
garganega/chardonnay/tocai/trebbiano|n-gpc-garganega-chardonnay-tocai-trebbia|c
garganega/trebbiano|n-gpc-garganega-trebbiano|c
garlic|n-v-ajo|a
garnacha|n-gpc-garnacha|a
garnacha blanca|n-gpc-garnacha-blanca|a
garnacha gris|n-gpc-garnacha-gris|a
garnacha pais|n-gpc-garnacha-pais|a
garnacha peluda|n-gpc-garnacha-peluda|a
garnacha tinta|n-gpc-garnacha-tinta|a
garneo|n-f-garneo|o
garras de pollo elaboradas|n-gpc-garras-de-pollo-elaboradas|a
garrofon|n-v-garrofon|c
gaseosa|n-d-refresco|a
gasterosteus aculeatus|n-f-espinoso|s
gastroclonium ovatum|n-f-ovatum|s
gata|n-f-lija|o
gata|n-f-pailona|o
gatos|n-f-gato|c
gavi|n-gpc-gavi|c
gazpacho|n-v-crema-de-verduras|a
geheimrat dr oldenburg oldenburger|n-gpc-geheimrat-dr-oldenburg-oldenburger|c
geheimratskase|n-gpc-queso-geheimratskase|c
geisenheim|n-gpc-geisenheim|c
gelatina de piel de burro|n-gpc-gelatina-de-piel-de-burro|a
gelber muskateller|n-gpc-gelber-muskateller|c
gelidium corneum|n-f-alga-imperial|s
gelria|n-gpc-gelria|c
general leclerc|n-gpc-general-leclerc|c
gentile|n-gpc-gentile|c
genypterus blacodes|n-f-rosada|s
genypterus capensis|n-f-rosada-del-cabo|s
gephyroberyx darwinii|n-f-reloj-de-fondo|s
germinado|n-v-germinado|c
germinados|n-v-germinado|c
geryon longipes|n-f-cangrejo-rojo-del-mediterraneo|s
gewuerztraminer|n-gpc-gewuerztraminer|c
gewuerztraminer/kerner/pinot blanc/viognier|n-gpc-gewuerztraminer-kerner-pinot-blanc|c
gewuerztraminer/riesling|n-gpc-gewuerztraminer-riesling|c
gewuerztraminer/riesling/pinot gris|n-gpc-gewuerztraminer-riesling-pinot-gri|c
gewurzluiken|n-gpc-gewurzluiken|c
gherkins|n-d-encurtido|a
gieser wildeman|n-gpc-gieser-wildeman|c
gigartina|n-f-gigartina|o
gigartina pistillata|n-f-gigartina|s
ginger|n-v-jengibre|a
ginger gold|n-gpc-ginger-gold|c
ginseng|n-gpc-ginseng|a
giro|n-gpc-giro|c
gitana|n-f-luna-real|o
gitanilla|n-f-gitano|o
gitano|n-f-gitano|o
gizzards butterfly cut unece 701902|n-gpc-mollejas-de-pollo-abiertas-en-mari|c
gizzards mechanically cut unece 701901|n-gpc-mollejas-de-pollo-de-corte-mecanic|c
gizzards v style cut unece 701903|n-gpc-mollejas-de-pollo-de-corte-en-v|c
gjetost|n-gpc-queso-gjetost|c
glaseado alimentario|n-gpc-glaseado-alimentario|a
glasswort|n-gpc-salicornia|a
glaucostegus cemiculus|n-f-guitarra-de-morro-negro|s
globe artichokes|n-v-alcachofa|a
globito|n-f-globito|o
globito robusto|n-f-globito-robusto|o
globito tierno|n-f-globito-tierno|o
glockenapfel weisser|n-gpc-glockenapfel-weisser|c
glosan|n-gpc-glosan|c
glossanodon leioglossus|n-f-bocon|s
gloster|n-gpc-gloster|c
glycymeris glycymeris|n-f-almendra-de-mar|s
glycymeris nummaria|n-f-almeja-tonta|s
glycymeris pilosa|n-f-almendra-peluda|s
glyphus marsupialis|n-f-camaron-periquito|s
glyptocephalus cynoglossus|n-f-mendo|s
goat|n-gpc-cabra|a
goat prepared/processed|n-gpc-cabra|a
goat unprepared/unprocessed|n-gpc-cabra|a
gobido de cristal|n-f-gobido-de-cristal|o
gobius niger|n-f-chaparrudo|s
gobius paganellus|n-f-bobi|s
gobo root/burdock|n-gpc-bardana|a
godello|n-gpc-godello|c
goedhof red elstar goedhof|n-gpc-goedhof-red-elstar-goedhof|c
goji berries|n-gpc-baya-de-goji|a
goldbohemia|n-gpc-goldbohemia|c
goldburger|n-gpc-goldburger|c
golden delicious and mutants|n-gpc-golden-delicious-and-mutants|c
golden lasa|n-gpc-golden-lasa|c
golden mira|n-gpc-golden-mira|c
golden noble|n-gpc-golden-noble|c
golden parsi|n-gpc-golden-parsi|c
golden russet|n-gpc-golden-russet|c
golden russet bosc|n-gpc-golden-russet-bosc|c
golden supreme|n-gpc-golden-supreme|c
goldlane|n-gpc-goldlane|c
goldmuskateller|n-gpc-goldmuskateller|c
goldrush|n-gpc-goldrush|c
goldstar|n-gpc-goldstar|c
golleta|n-f-golleta|o
golondrina|n-f-golondrina|o
golondrina de mar|n-f-golondrina-de-mar|o
golosina|n-d-golosina|a
gominola|n-d-golosina|a
goose|n-gpc-oca|a
goose prepared/processed|n-gpc-oca|a
goose unprepared/unprocessed|n-gpc-oca|a
gooseberries|n-gpc-uva-espina|a
gordal|n-d-aceituna-gordal|a
gorgollasa|n-gpc-gorgollasa|c
gorgonzola|n-q-queso-azul|a
goruli mtsvane|n-gpc-goruli-mtsvane|c
gouda|n-q-queso-gouda|a
gourds|n-gpc-calabaza-de-peregrino|a
graciano|n-gpc-graciano|c
graciano/cabernet sauvignon|n-gpc-graciano-cabernet-sauvignon|c
gracilaria|n-f-gracilaria|o
gracilaria gracilis|n-f-gracilaria-u-ogonori|s
gracilaria multipartita|n-f-gracilaria|s
gracilaria u ogonori|n-f-gracilaria-u-ogonori|o
gracilariopsis longissima|n-f-gracilaria|s
graefin gepa early desire|n-gpc-graefin-gepa-early-desire|c
grain based products / meals|n-gpc-elaborados-a-base-de-cereal|a
grain based products / meals not ready to eat savoury frozen|n-gpc-platos-a-base-de-cereal|a
grain based products / meals not ready to eat savoury perishable|n-gpc-platos-a-base-de-cereal|a
grain based products / meals not ready to eat savoury shelf stable|n-gpc-platos-a-base-de-cereal|a
grain based products / meals ready to eat savoury perishable|n-gpc-platos-a-base-de-cereal|a
grain based products / meals ready to eat savoury shelf stable|n-gpc-platos-a-base-de-cereal|a
grain based products / meals savoury|n-gpc-platos-a-base-de-cereal|a
grain based products / meals variety packs|n-gpc-surtidos-de-elaborados-de-cereal|a
grains/cereal|n-gpc-cereal-en-grano|a
grains/cereal not ready to eat frozen|n-gpc-cereal-en-grano|a
grains/cereal not ready to eat perishable|n-gpc-cereal-en-grano|a
grains/cereal not ready to eat shelf stable|n-gpc-cereal-en-grano|a
grains/cereal ready to eat perishable|n-gpc-cereal-en-grano|a
grains/cereal ready to eat shelf stable|n-gpc-cereal-en-grano|a
grains/flour|n-gpc-granos-y-harinas|a
grains/flour variety packs|n-gpc-surtidos-de-granos-y-harinas|a
grana padano|n-q-queso-parmesano|a
granada|n-v-granada|c
granada grano de elche|n-v-granada|c
granada grano de elche|n-v-granada-grano-de-elche|c
granada mollar de jativa|n-v-granada|c
granada mollar de jativa|n-v-granada-mollar-de-jativa|c
granadas|n-v-granada|c
granadero|n-f-granadero|o
granadero ojisapo|n-f-granadero-ojisapo|o
granadilla|n-gpc-granadilla|a
grand champion|n-gpc-grand-champion|c
granny smith|n-gpc-granny-smith|c
grapefruits|n-v-pomelo|a
grapsus adscensionis|n-f-mariquita-europea|s
grapsus grapsus|n-f-abuete-negro|s
grasa abdominal de pavo|n-gpc-grasa-abdominal-de-pavo|a
grasa abdominal de pollo|n-gpc-grasa-abdominal-de-pollo|a
grasa animal|n-gpc-grasa-animal|a
grasa de cerdo|n-offal-lard|a
grasa de cotnari|n-gpc-grasa-de-cotnari|c
grasa mixta|n-gpc-grasa-mixta|a
grasa vegetal|n-gpc-grasa-vegetal|a
grasshoppers/locusts/crickets|n-gpc-saltamontes-y-grillos|a
grasshoppers/locusts/crickets prepared/processed|n-gpc-saltamontes-y-grillos|a
grasshoppers/locusts/crickets unprepared/unprocessed|n-gpc-saltamontes-y-grillos|a
graue herbstrenette grijze rabouwe|n-gpc-graue-herbstrenette-grijze-rabouwe|c
gravenstein rouge|n-gpc-gravenstein-rouge|c
gravensteiner|n-gpc-gravensteiner|c
grecanico dorato|n-gpc-grecanico-dorato|c
grechetto|n-gpc-grechetto|c
grechetto/trebbiano|n-gpc-grechetto-trebbiano|c
greco|n-gpc-greco|c
greco bianco|n-gpc-greco-bianco|c
greengages|n-gpc-ciruela-claudia|a
greens texas mustard|n-gpc-hoja-de-mostaza|a
greensleeves|n-gpc-greensleeves|c
grelo|n-v-grelo|c
grelos|n-v-grelo|c
grenache blanc garnacha blanca|n-gpc-garnacha-blanca|c
grenache blanc/clairette/bourboulenc/roussanne/viognier|n-gpc-grenache-blanc-clairette-bourboule|c
grenache blanc/marsanne/roussanne|n-gpc-grenache-blanc-marsanne-roussanne|c
grenache carnatxa/garnacha/garnacho/garnatxa|n-gpc-garnacha|c
grenache gris|n-gpc-garnacha-gris|c
grenache noir garnatxa negra/grenache rouge/grenache tinta|n-gpc-garnacha-tinta|c
grenache pais garnacha pais|n-gpc-garnacha-pais|c
grenache peluda garnacha peluda|n-gpc-garnacha-peluda|c
grenache/cabernet sauvignon|n-gpc-grenache-cabernet-sauvignon|c
grenache/cabernet sauvignon/merlot/carignan|n-gpc-grenache-cabernet-sauvignon-merlot|c
grenache/cabernet sauvignon/tempranillo|n-gpc-grenache-cabernet-sauvignon-tempra|c
grenache/carignan/cabernet sauvignon|n-gpc-grenache-carignan-cabernet-sauvign|c
grenache/carignan/cabernet sauvignon/syrah|n-gpc-grenache-carignan-cabernet-sauvign-2|c
grenache/cinsault|n-gpc-grenache-cinsault|c
grenache/cinsault/syrah|n-gpc-grenache-cinsault-syrah|c
grenache/mourvedre|n-gpc-grenache-mourvedre|c
grenache/mourvedre/syrah|n-gpc-grenache-mourvedre-syrah|c
grenache/syrah|n-gpc-grenache-syrah|c
grenache/syrah/mourvedre|n-gpc-grenache-syrah-mourvedre|c
grenache/tempranillo|n-gpc-grenache-tempranillo|c
grenache/tibouren/mourvedre|n-gpc-grenache-tibouren-mourvedre|c
grenache/tibouren/mourvedre/cinsault|n-gpc-grenache-tibouren-mourvedre-cinsau|c
grenache/tibouren/mourvedre/cinsault/syrah|n-gpc-grenache-tibouren-mourvedre-cinsau-2|c
grenachee/merlot|n-gpc-grenachee-merlot|c
grenadier|n-gpc-grenadier|c
grignolino|n-gpc-grignolino|c
grillo|n-gpc-grillo|c
grimothea johni|n-f-sastre-amarillo|s
grimothea monodon|n-f-sastre-rojo|s
grimothea planipes|n-f-langostilla-roja|s
grolleau|n-gpc-grolleau|c
groninger kroon|n-gpc-groninger-kroon|c
gronsvelder klumpke|n-gpc-gronsvelder-klumpke|c
groppello|n-gpc-groppello|c
gros manseng|n-gpc-gros-manseng|c
grosella|n-v-grosella|c
grosella blanca|n-v-grosella|c
grosella blanca|n-v-grosella-blanca|c
grosella negra|n-gpc-grosella-negra|a
grosella roja|n-v-grosella|c
grosella roja|n-v-grosella-roja|c
grover|n-gpc-grover|c
gruener silvaner|n-gpc-gruener-silvaner|c
gruener veltliner|n-gpc-gruener-veltliner|c
gruyere|n-q-queso-gruyere|a
grypy|n-gpc-grypy|c
guabina|n-f-guabina|o
guanabana|n-v-guanabana|c
guante|n-x-guante|a
guantes|n-x-guante|a
guantes de nitrilo|n-x-guante|a
guavas|n-gpc-guayaba|a
guayaba|n-gpc-guayaba|a
guayabo|n-v-guayabo|c
guayabo cas|n-v-guayabo|c
guayabo cas|n-v-guayabo-cas|c
guayabos|n-v-guayabo|c
guinda|n-gpc-guinda|a
guindilla|n-v-guindilla|c
guindilla o v|n-v-guindilla|c
guindillas|n-v-guindilla|c
guindillas rojas|n-v-guindilla|c
guindillas rojas|n-v-guindillas-rojas|c
guindillas verdes|n-v-guindilla|c
guindillas verdes|n-v-guindillas-verdes|c
guinea fowl|n-a-pintada|a
guinea fowl prepared/processed|n-a-pintada|a
guinea fowl unprepared/unprocessed|n-a-pintada|a
guisante|n-v-guisante|c
guisante alado|n-gpc-guisante-alado|a
guisantes|n-v-guisante|c
guisantes con vaina|n-gpc-guisantes-con-vaina|a
guitarra de morro negro|n-f-guitarra-de-morro-negro|o
gula|n-f-gula|c
gula cong|n-f-surimi|c
guldborg|n-gpc-guldborg|c
gutedel|n-gpc-gutedel|c
gyllenkroks astrakan|n-gpc-gyllenkroks-astrakan|c
gymnammodytes cicerelus|n-f-sonso|s
gymnammodytes semisquamatus|n-f-salton|s
gymnothorax afer|n-f-morena|s
gymnothorax bacalladoi|n-f-murion|s
gymnothorax maderensis|n-f-morena|s
gymnothorax polygonius|n-f-papuda|s
gymnothorax unicolor|n-f-morena|s
gymnura altavela|n-f-mantellina|s
haba|n-gpc-haba|a
haba jack|n-gpc-haba-jack|a
habas verd|n-v-habas-verd|c
habas verdes|n-v-habas-verd|c
haematococcus pluvialis|n-f-microalga-haematococcus|s
halibut|n-f-fletan|o
halibut atlantico|n-f-fletan|o
halibut carioca|n-f-halibut-carioca|o
halibut congelado cong|n-f-fletan|c
halibut de alaska|n-f-halibut-de-alaska|o
halibut de kamchatka|n-f-halibut-de-kamchatka|o
halibut del japon|n-f-halibut-del-japon|o
halibut del pacifico|n-f-halibut-del-pacifico|o
halibut espinoso|n-f-halibut-espinoso|o
halibut negro|n-f-fletan-negro|o
halibut patagon|n-f-halibut-patagon|o
halibut perro|n-f-halibut-perro|o
halibut tropical|n-f-halibut-tropical|o
halidrys siliquosa|n-f-roble-marino|s
haliotis discus|n-f-abalon-japones|s
haliotis tuberculata|n-f-oreja-de-mar|s
haliporoides triarthrus|n-f-gambon-de-mozambique|s
halloumi|n-q-queso-halloumi|a
halobatrachus didactylus|n-f-pez-sapo|s
hamburguesa|n-b-hamburguesa|a
hamburguesa vegetal|n-d-sustituto-de-carne|a
haralson|n-gpc-haralson|c
hare|n-gpc-liebre|a
hare prepared/processed|n-gpc-liebre|a
hare unprepared/unprocessed|n-gpc-liebre|a
harina|n-d-harina|a
harina de fuerza|n-d-harina|a
harina de trigo|n-d-harina|a
harinas|n-flour|a
harinas varios|n-d-harina|a
harmonie|n-gpc-harmonie|c
harriotta raleighana|n-f-quimera-picuda|s
harrow delight|n-gpc-harrow-delight|c
harrow sweet|n-gpc-harrow-sweet|c
harslevelu|n-gpc-harslevelu|c
havarti|n-q-queso-havarti|a
head lettuce|n-gpc-lechuga-de-cogollo|a
head lettuce|n-vegetable|a
head lettuce butterhead|n-v-lechuga|a
head lettuce fresh cut|n-gpc-lechuga-de-cogollo|a
head unece 701701|n-gpc-cabeza-de-pollo|c
hearts cap off unece 702101|n-gpc-corazones-de-pollo-sin-capa|c
hearts cap off unece 712101|n-gpc-corazones-de-pavo-sin-capa|c
hearts cap on unece 702102|n-gpc-corazones-de-pollo-con-capa|c
hearts cap on unece 712102|n-gpc-corazones-de-pavo-con-capa|c
heisei fuji beni shogun|n-gpc-heisei-fuji-beni-shogun|c
helado|n-d-helado|a
helados|n-d-helado|a
helados cong|n-d-helado|c
helecho canela|n-gpc-helecho-canela|a
helecho real|n-gpc-helecho-real|a
helecho tierno|n-gpc-helecho-tierno|a
helechos|n-gpc-helechos|a
helicolenus dactylopterus|n-f-gallineta|s
helicolenus mouchezi|n-f-gallineta-pinta|s
heptranchias perlo|n-f-canabota|s
herbs|n-gpc-hierbas-frescas|a
herbs fresh cut|n-gpc-hierbas-frescas|a
herbs other|n-herb|a
herbs variety pack|n-gpc-surtido-de-hierbas|a
herbs/spices|n-gpc-hierbas-y-especias|a
herbs/spices frozen|n-gpc-hierbas-y-especias|a
herbs/spices perishable|n-gpc-hierbas-y-especias|a
herbs/spices shelf stable|n-gpc-hierbas-y-especias|a
herbs/spices/extracts|n-gpc-hierbas-especias-y-extractos|a
herbs/spices/extracts variety packs|n-gpc-surtidos-de-hierbas-y-especias|a
herenperen|n-gpc-herenperen|c
herrera|n-f-herrera|o
heterocarpus ensifer|n-f-camaron-cabezudo|s
heterocarpus gibbosus|n-f-camaron-indio|s
heterocarpus grimaldii|n-f-camaron-cabezudo-del-alto|s
heterocarpus laevigatus|n-f-camaron-nailon-liso|s
heteropriacanthus cruentatus|n-f-catalufa|s
heura|n-d-sustituto-de-carne|a
hexanchus griseus|n-f-canabota-gris|s
hexaplex trunculus|n-f-busano|s
hibrido de baya|n-gpc-hibrido-de-baya|a
hibrido de hueso|n-gpc-hibrido-de-hueso|a
hidala|n-gpc-hidala|c
hielo|n-ice|a
hielo en escamas|n-ice|a
hielo picado|n-ice|a
hierba luisa|n-gpc-hierba-luisa|a
hierbas|n-herb|a
hierbas aromatica|n-herb|c
hierbas aromaticas|n-herb|c
hierbas frescas|n-gpc-hierbas-frescas|a
hierbas y especias|n-gpc-hierbas-y-especias|a
higaditos de pollo|n-a-higaditos-de-pollo|a
higado|n-c-higado|a
higado|n-meat|c
higado|n-beef|c
higado de ternera|n-c-higado|a
higados de pavo|n-gpc-higados-de-pavo|a
higados de pollo|n-a-higaditos-de-pollo|a
higados de pollo|n-gpc-higados-de-pollo|a
higo|n-v-higo|c
higo chumbo|n-v-higo-chumbo|c
higos|n-v-higo|c
higos negros|n-v-higo|c
higos negros|n-v-higos-negros|c
higos secos|n-v-higos-secos|c
higos secos importacion|n-v-higo|c
higos secos importacion|n-v-higos-secos|c
higos secos nacionales|n-v-higo|c
higos secos nacionales|n-v-higos-secos|c
higos verdes|n-v-higo|c
higos verdes|n-v-higos-verdes|c
himanthalia elongata|n-f-espagueti-de-mar|s
hin choy|n-gpc-amaranto-chino|a
hind feet trotter unece 304176|n-gpc-manitas-traseras|c
hindquarter 0 ribs|n-gpc-cuarto-trasero-sin-costillas|c
hindquarter 1 rib|n-gpc-cuarto-trasero-1-costilla|c
hindquarter 10 ribs|n-gpc-cuarto-trasero-10-costillas|c
hindquarter 2 ribs|n-gpc-cuarto-trasero-2-costillas|c
hindquarter 3 ribs|n-gpc-cuarto-trasero-3-costillas|c
hindquarter 4 ribs|n-gpc-cuarto-trasero-4-costillas|c
hindquarter 5 ribs|n-gpc-cuarto-trasero-5-costillas|c
hindquarter 6 rib unece 404786|n-gpc-cuarto-trasero-de-cordero-6-costil|c
hindquarter 6 ribs|n-gpc-cuarto-trasero-6-costillas|c
hindquarter 7 rib unece 404787|n-gpc-cuarto-trasero-de-cordero-7-costil|c
hindquarter 7 ribs|n-gpc-cuarto-trasero-7-costillas|c
hindquarter 8 rib unece 404788|n-gpc-cuarto-trasero-de-cordero-8-costil|c
hindquarter 8 ribs|n-gpc-cuarto-trasero-8-costillas|c
hindquarter 8 ribs unece 3040010|n-gpc-cuarto-trasero-de-cerdo-8-costilla|c
hindquarter 9 rib unece 404789|n-gpc-cuarto-trasero-de-cordero-9-costil|c
hindquarter 9 ribs|n-gpc-cuarto-trasero-9-costillas|c
hindquarter 9 ribs unece 304009|n-gpc-cuarto-trasero-de-cerdo-9-costilla|c
hindquarter unece 504788|n-gpc-cuarto-trasero-de-cabrito|c
hindshank|n-gpc-morcillo-trasero|c
hindshank boneless|n-gpc-morcillo-trasero-deshuesado|c
hindshank unece 505031|n-gpc-jarrete-de-cabrito|c
hinojo|n-v-hinojo|c
hinojo de bulbo|n-gpc-hinojo-de-bulbo|a
hinojo dulce|n-gpc-hinojo-dulce|a
hippoglossoides elassodon|n-f-platija-japonesa|s
hippoglossoides platessoides|n-f-platija-americana|s
hippoglossus hippoglossus|n-f-fletan|s
hippoglossus stenolepis|n-f-halibut-del-pacifico|s
hirundichthys rondeletii|n-f-golondrina-de-mar|s
hisopo|n-gpc-hisopo|a
histioteuthis bonnellii|n-f-calamar-paraguas|s
hock leg unece 304172|n-gpc-codillo-trasero|c
hock shoulder unece 304170|n-gpc-codillo-delantero|c
hoja de apio|n-gpc-hoja-de-apio|a
hoja de col marina|n-f-hoja-de-col-marina|o
hoja de ensalada entera|n-gpc-hoja-de-ensalada-entera|a
hoja de ensalada suelta|n-gpc-hoja-de-ensalada-suelta|a
hoja de mostaza|n-gpc-hoja-de-mostaza|a
hoja de platano|n-gpc-hoja-de-platano|a
hoja santa|n-gpc-hoja-santa|a
hojas de achicoria|n-gpc-hojas-de-achicoria|a
holothuria arguinensis|n-f-cohombro-naranja|s
holothuria holothuria tubulosa|n-f-cohombro-tubo|s
holothuria spp|n-f-cohombro|s
holstein and mutants holsteiner cox|n-gpc-holstein-and-mutants-holsteiner-co|c
holstein rouge|n-gpc-holstein-rouge|c
holthuispenaeopsis atlantica|n-f-gamba|s
homarus americanus|n-f-bogavante-americano|s
homarus gammarus|n-f-bogavante-europeo|s
hondarrabi zeratia hondarrabi zuri|n-gpc-hondarrabi-zuri|c
hondarrabi zuri|n-gpc-hondarrabi-zuri|a
honey|n-d-miel|a
honey gold|n-gpc-honey-gold|c
honey pomelos|n-gpc-pomelo-miel|a
honey shelf stable|n-d-miel|a
honey substitutes|n-gpc-sucedaneo-de-miel|a
honeycrisp|n-gpc-honeycrisp|c
hoplostethus atlanticus|n-f-reloj-anaranjado|s
hoplostethus mediterraneus|n-f-reloj-mediterraneo|s
horneburger pfannkuchen|n-gpc-horneburger-pfannkuchen|c
horse|n-g-equino|a
horse prepared/processed|n-g-equino|a
horse unprepared/unprocessed|n-g-equino|a
horseradish|n-gpc-rabano-picante|a
hortalizas|n-vegetable|a
hortalizas de bulbo|n-gpc-hortalizas-de-bulbo|a
hortalizas de tallo|n-gpc-hortalizas-de-tallo|a
howgate wonder|n-gpc-howgate-wonder|c
huaguan|n-gpc-huaguan|c
huesos y caldo|n-gpc-huesos-y-caldo|a
huevas|n-f-hueva|c
huevas cong|n-f-hueva|c
huevas mojama|n-f-hueva|c
huevo|n-d-huevo|a
huevo campero|n-d-huevo|a
huevo cocido|n-gpc-huevo-cocido|a
huevo con cascara|n-gpc-huevo-con-cascara|a
huevo con cascara de clase b|n-gpc-huevo-con-cascara-de-clase-b|a
huevo con cascara sin clasificar|n-gpc-huevo-con-cascara-sin-clasificar|a
huevos|n-d-huevo|a
humagne rouge|n-gpc-humagne-rouge|c
huso huso|n-f-esturion-beluga|s
huxelrebe|n-gpc-huxelrebe|c
huxelrebe silvaner|n-gpc-huxelrebe-silvaner|c
hybrids of berries|n-gpc-hibrido-de-baya|a
hyperoglyphe antarctica|n-f-mero-antartico-azul|s
hyperoglyphe perciformis|n-f-rufo-derivante|s
hyperoplus lanceolatus|n-f-pion|s
hypophthalmichthys molitrix|n-f-carpa-plateada|s
hypophthalmichthys nobilis|n-f-carpa-cabezona|s
hyporthodus chabaudi|n-f-cherne-barbudo|s
hyporthodus cifuentesi|n-f-mero-oliva|s
hyporthodus haifensis|n-f-cherne-sahariano|s
hyporthodus nigritus|n-f-cherne-de-yemen|s
hyssop|n-gpc-hisopo|a
ice|n-ice|a
ice cream/ice novelties|n-d-helado|a
ice cream/ice novelties frozen|n-d-helado|a
ice cream/ice novelties shelf stable|n-d-helado|a
iceberg lettuce|n-v-lechuga|a
ictalurus punctatus|n-f-bagre-del-canal|s
idared|n-gpc-idared|c
idiazabal|n-q-queso-idiazabal|a
iedzenu|n-gpc-iedzenu|c
ildrod pigeon|n-gpc-ildrod-pigeon|c
ilga|n-gpc-ilga|c
ilium meat oyster unece 716012|n-gpc-carne-del-ilion-de-pavo|c
illex argentinus|n-f-pota|s
illex coindetii|n-f-volador|s
illex illecebrosus|n-f-pota|s
in shell checked/dirty eggs|n-gpc-huevo-con-cascara-de-clase-b|a
in shell nest run eggs|n-gpc-huevo-con-cascara-sin-clasificar|a
in shell table eggs|n-gpc-huevo-con-cascara|a
incrocio manzoni|n-gpc-incrocio-manzoni|c
indian limes|n-gpc-lima-india|a
individually cooked eggs|n-gpc-huevo-cocido|a
inferno|n-gpc-inferno|c
infusion|n-d-infusion|a
infusion concentrada|n-gpc-infusion-concentrada|a
infusion en capsulas|n-gpc-infusion-en-capsulas|a
infusion lista para beber|n-gpc-infusion-lista-para-beber|a
infusion soluble|n-gpc-infusion-soluble|a
infusiones|n-d-infusion|a
ingrediente para sopa|n-gpc-ingrediente-para-sopa|a
ingredientes de reposteria|n-gpc-ingredientes-de-reposteria|a
ingrid marie|n-gpc-ingrid-marie|c
insectos|n-gpc-insectos|a
insectos variados|n-gpc-insectos-variados|a
insects edible prepared/processed|n-gpc-insectos-comestibles|a
insects edible unprepared/unprocessed|n-gpc-insectos-comestibles|a
insects mixed species|n-gpc-insectos-variados|a
insects mixed species prepared/processed|n-gpc-insectos-variados|a
insects mixed species unprepared/unprocessed|n-gpc-insectos-variados|a
insects other|n-gpc-insectos|a
insects other prepared/processed|n-gpc-insectos|a
insects other unprepared/unprocessed|n-gpc-insectos|a
inside cap off unece 505077|n-gpc-tapa-de-cabrito-sin-capa|c
inside skirt|n-gpc-entrana-interior|c
inside unece 505073|n-gpc-tapa-de-cabrito|c
insumos de elaboracion|n-gpc-insumos-de-elaboracion|a
internal flank plate skirt|n-gpc-entrana-de-falda|c
intestines chitterlings unece 716015|n-gpc-intestinos-de-pavo|c
intestinos de pavo|n-gpc-intestinos-de-pavo|a
invertebrados marinos|n-gpc-invertebrados-marinos|a
inzolia|n-gpc-inzolia|c
inzolia/chardonnay|n-gpc-inzolia-chardonnay|c
iron variety|n-gpc-iron-variety|c
irsai oliver|n-gpc-irsai-oliver|c
isbranica|n-gpc-isbranica|c
isochrysis galbana|n-f-microalga-isochrysis|s
istiompax indica|n-f-aguja-negra|s
istiophorus albicans|n-f-pez-vela-del-atlantico|s
istiophorus platypterus|n-f-pez-vela|s
isurus oxyrinchus|n-f-marrajo|s
isurus paucus|n-f-marrajo-carite|s
jabali|n-g-jabali|a
jack beans|n-gpc-haba-jack|a
jackfruits|n-gpc-yaca|a
jacquere|n-gpc-jacquere|c
jacques lebel|n-gpc-jacques-lebel|c
jahong|n-gpc-jahong|c
jaiba de roca dientuda|n-f-jaiba-de-roca-dientuda|o
jaiba limon|n-f-jaiba-limon|o
jaiba satinada|n-f-jaiba-satinada|o
jakob fischer|n-gpc-jakob-fischer|c
jamba 69|n-gpc-jamba-69|c
jambolan|n-gpc-jambolan|a
james grieve and mutants|n-gpc-james-grieve-and-mutants|c
jamon|n-ham|a
jamon cocido|n-cooked-ham|a
jamon curado|n-ham|a
jamon de bodega|n-ham|a
jamon de teruel|n-m-jamon-de-teruel|a
jamon de trevelez|n-m-jamon-de-trevelez|a
jamon de york|n-cooked-ham|a
jamon dulce|n-cooked-ham|a
jamon fresco|n-p-jamon-fresco|a
jamon fresco contra|n-gpc-jamon-fresco-contra|a
jamon fresco de corte corto tipo 1|n-gpc-jamon-fresco-de-corte-corto-tipo-1|a
jamon fresco de corte corto tipo 2|n-gpc-jamon-fresco-de-corte-corto-tipo-2|a
jamon fresco de corte corto tipo 3|n-gpc-jamon-fresco-de-corte-corto-tipo-3|a
jamon fresco de corte largo deshuesado|n-gpc-jamon-fresco-de-corte-largo-deshue|a
jamon fresco de corte largo tipo 1|n-gpc-jamon-fresco-de-corte-largo-tipo-1|a
jamon fresco de corte largo tipo 2|n-gpc-jamon-fresco-de-corte-largo-tipo-2|a
jamon fresco de corte largo tipo 3|n-gpc-jamon-fresco-de-corte-largo-tipo-3|a
jamon fresco despiezado en 3|n-gpc-jamon-fresco-despiezado-en-3|a
jamon fresco despiezado en 4|n-gpc-jamon-fresco-despiezado-en-4|a
jamon fresco despiezado en 5|n-gpc-jamon-fresco-despiezado-en-5|a
jamon fresco despiezado en 6|n-gpc-jamon-fresco-despiezado-en-6|a
jamon fresco punta de babilla|n-gpc-jamon-fresco-punta-de-babilla|a
jamon fresco redondo|n-gpc-jamon-fresco-redondo|a
jamon fresco tapa|n-gpc-jamon-fresco-tapa|a
jamon iberico|n-m-jamon-iberico|a
jamon iberico de bellota|n-m-jamon-iberico|a
jamon iberico de cebo|n-m-jamon-iberico|a
jamon serrano|n-m-jamon-serrano|a
jamon serrano bodega|n-m-jamon-serrano|a
jamon york|n-cooked-ham|a
jamoncito|n-a-muslo-de-pollo|a
jamoncito de pavo|n-gpc-jamoncito-de-pavo|a
jamoncito de pavo deshuesado sin tendon|n-gpc-jamoncito-de-pavo-deshuesado-sin-t|a
jamoncito de pavo deshuesado tendon parcialmente retirado|n-gpc-jamoncito-de-pavo-deshuesado-tendo|a
jamoncito de pollo|n-gpc-jamoncito-de-pollo|a
jamoncito de pollo de corte sesgado|n-gpc-jamoncito-de-pollo-de-corte-sesgad|a
jamoncito y contramuslo de pollo de corte largo con espalda|n-gpc-jamoncito-y-contramuslo-de-pollo-d|a
jamoncitos de pollo|n-a-muslo-de-pollo|a
jamones|n-cured|a
jamones y paletas|n-cured|a
jampal|n-gpc-jampal|c
jams/marmalades|n-d-mermelada|a
jams/marmalades shelf stable|n-d-mermelada|a
jams/marmalades/fruit spreads|n-gpc-mermelada-y-confitura|a
jams/marmalades/fruit spreads perishable|n-gpc-mermelada-y-confitura|a
jan steen|n-gpc-jan-steen|c
japanese medlars|n-gpc-nispero-japones|a
japanese plums|n-gpc-ciruela-japonesa|a
japuta|n-f-japuta|o
jaqueta|n-f-jaqueta|o
jarka|n-gpc-jarka|c
jarlsberg|n-gpc-queso-jarlsberg|c
jarrete|n-b-morcillo|a
jarrete de cabrito|n-gpc-jarrete-de-cabrito|a
jarrete de cordero|n-o-jarrete-de-cordero|a
jarrete trasero de cordero|n-gpc-jarrete-trasero-de-cordero|a
jasappel|n-gpc-jasappel|c
jasus lalandii|n-f-langosta-del-cabo|s
jeanne d arc|n-gpc-jeanne-d-arc|c
jengibre|n-v-jengibre|c
jeromine|n-gpc-jeromine|c
jerseymac|n-gpc-jerseymac|c
jerusalem artichokes|n-gpc-aguaturma|a
jester|n-gpc-jester|c
jibia|n-f-choquito|o
jibia|n-f-sepia|o
jibia canaria|n-f-choco-canario|o
jibia faraonica|n-f-sepia-faraonica|o
jibia ganchuda|n-f-sepia-ganchuda|o
jibia labiada|n-f-sepia-labiada|o
jibia limpia|n-f-choquito|c
jibia limpia cong|n-f-choquito|c
jibia limpia en bloque|n-f-choquito|c
jibia limpia granizada|n-f-choquito|c
jibia o sepia fresca gran|n-f-choquito|c
jibia o sepia gran|n-f-choquito|c
jibia o sepia semiconserv|n-f-choquito|c
jibia pelada|n-f-choquito|c
jibia picuda|n-f-choquito-picudo|o
jibia sucia|n-f-choquito|c
jibia sucia cong|n-f-choquito|c
jibias|n-f-choquito|c
jibias cong|n-f-choquito|c
jicama|n-gpc-jicama|a
jicama bean|n-gpc-jicama|a
joburn|n-gpc-joburn|c
johannisberg|n-gpc-johannisberg|c
johnius dussumieri|n-f-corvina-asiatica|s
jomar|n-gpc-jomar|c
jomured|n-gpc-jomured|c
jonabel|n-gpc-jonabel|c
jonabres|n-gpc-jonabres|c
jonagold and mutants|n-gpc-jonagold-and-mutants|c
jonagold boerekamp|n-gpc-jonagold-boerekamp|c
jonagored and mutants|n-gpc-jonagored-and-mutants|c
jonagored supra|n-gpc-jonagored-supra|c
jonalord|n-gpc-jonalord|c
jonamac|n-gpc-jonamac|c
jonathan|n-gpc-jonathan|c
jonaveld|n-gpc-jonaveld|c
jored nicolai s king jonagold|n-gpc-jored-nicolai-s-king-jonagold|c
jos musch|n-gpc-jos-musch|c
josegold|n-gpc-josegold|c
josephine de malines|n-gpc-josephine-de-malines|c
josta|n-gpc-josta|a
jostaberries|n-gpc-josta|a
jowl unece 304350|n-gpc-papada-de-cerdo|c
jubata|n-f-alga-pestana|o
judia alada|n-gpc-judia-alada|a
judia azuki|n-gpc-judia-azuki|a
judia bobi|n-f-bobi|c
judia carilla|n-gpc-judia-carilla|a
judia de enrame|n-gpc-judia-de-enrame|a
judia de lima|n-gpc-judia-de-lima|a
judia esparrago|n-gpc-judia-esparrago|a
judia seca|n-d-alubia|a
judia verde|n-gpc-judia-verde|a
judia verde boby|n-v-judias-verd|c
judia verde boby|n-v-judia-verde-boby|c
judia verde gallega|n-v-judias-verd|c
judia verde gallega|n-v-judia-verde-gallega|c
judia verde helda|n-v-judias-verd|c
judia verde helda|n-v-judia-verde-helda|c
judia verde marruecos|n-v-judias-verd|c
judia verde marruecos|n-v-judia-verde-marruecos|c
judias con vaina|n-gpc-judias-con-vaina|a
judias verd|n-v-judias-verd|c
judias verdes|n-v-judias-verd|c
judias verdes garrafal|n-v-judias-verd|c
judias verdes garrafal|n-v-judias-verdes-garrafal|c
judias verdes o v|n-v-judias-verd|c
judias verdes perona|n-v-judias-verd|c
judias verdes perona|n-v-judias-verdes-perona|c
juhfark|n-gpc-juhfark|c
jules d airolles|n-gpc-jules-d-airolles|c
julia|n-f-julia|o
juliet|n-gpc-juliet|c
jupiter|n-gpc-jupiter|c
jurel|n-f-jurel|o
jurel azul|n-f-jurel-azul|o
jurel caballo|n-f-jurel-caballo|o
jurel chicharro|n-f-jurel|c
jurel chileno|n-f-jurel-chileno|o
jurel de cunene|n-f-jurel-de-cunene|o
jurel del cabo|n-f-jurel-del-cabo|o
jurel grande|n-f-jurel|c
jurel limon|n-f-jurel-limon|o
jurel mediano|n-f-jurel|c
jurel mediterraneo|n-f-jurel-mediterraneo|o
jurel pequeno|n-f-jurel|c
jurel real|n-f-jurel-real|o
jut|n-gpc-jut|c
juyon|n-f-juyon|o
kabinett|n-gpc-kabinett|c
kadarka|n-gpc-kadarka|c
kai lan|n-gpc-kai-lan|a
kaiser wilhelm|n-gpc-kaiser-wilhelm|c
kajikia albida|n-f-aguja-blanca-del-atlantico|s
kajikia audax|n-f-marlin-rayado|s
kakhuri mtsvane|n-gpc-kakhuri-mtsvane|c
kaki/ sharon fruits|n-v-caqui|a
kale|n-v-kale|c
kalecik karasi|n-gpc-kalecik-karasi|c
kangun|n-gpc-kangun|c
karin schneider rod ingrid marie|n-gpc-karin-schneider-rod-ingrid-marie|c
karmijn de sonnaville|n-gpc-karmijn-de-sonnaville|c
karmozijn|n-gpc-karmozijn|c
kathetostoma giganteum|n-f-rape-de-nueva-zelanda|s
katja|n-gpc-katja|c
katsuwonus pelamis|n-f-listado|s
kekfrankos|n-gpc-kekfrankos|c
keknyelu|n-gpc-keknyelu|c
kent|n-gpc-kent|c
kerner|n-gpc-kerner|c
kerner/scheurebe|n-gpc-kerner-scheurebe|c
kesterens wijnzuur|n-gpc-kesterens-wijnzuur|c
ketchup|n-d-salsa|a
keuleman|n-gpc-keuleman|c
khikhvi|n-gpc-khikhvi|c
kidd s orange red|n-gpc-kidd-s-orange-red|c
kieffer|n-gpc-kieffer|c
kim|n-gpc-kim|c
king jonagold|n-gpc-king-jonagold|c
king mandarins|n-gpc-mandarina-king|a
king of the pippins golden pearmain|n-gpc-king-of-the-pippins-golden-pearmai|c
kiralyleanyka|n-gpc-kiralyleanyka|c
kisi|n-gpc-kisi|c
kit de aromatizacion|n-gpc-kit-de-aromatizacion|a
kit de elaboracion|n-gpc-kit-de-elaboracion|a
kiwano|n-v-kiwano|c
kiwi|n-v-kiwi|c
kiwi c e e|n-v-kiwi|c
kiwi c e e|n-v-kiwi-c-e-e|c
kiwi chile|n-v-kiwi|c
kiwi chile|n-v-kiwi-chile|c
kiwi francia|n-v-kiwi|c
kiwi francia|n-v-kiwi-francia|c
kiwi grecia|n-v-kiwi|c
kiwi grecia|n-v-kiwi-grecia|c
kiwi italia|n-v-kiwi|c
kiwi italia|n-v-kiwi-italia|c
kiwi kiwigold|n-v-kiwi|c
kiwi kiwigold|n-v-kiwi-kiwigold|c
kiwi nacional|n-v-kiwi|c
kiwi nueva zelanda|n-v-kiwi|c
kiwi nueva zelanda|n-v-kiwi-nueva-zelanda|c
kiwi o v|n-v-kiwi|c
kiwi pulpa verde|n-v-kiwi|c
kiwi pulpa verde|n-v-kiwi-pulpa-verde|c
kiwiberries|n-gpc-kiwino|a
kiwifruits|n-v-kiwi|a
kiwifruits fresh cut|n-v-kiwi|a
kiwino|n-gpc-kiwino|a
kizuri|n-gpc-kizuri|c
klapa milule|n-gpc-klapa-milule|c
kleipeer|n-gpc-kleipeer|c
klevner|n-gpc-klevner|c
klingelberger|n-gpc-klingelberger|c
klingelberger riesling|n-gpc-klingelberger-riesling|c
knuckle|n-gpc-babilla-de-vacuno|c
knuckle shoulder 4 rib unece 404773|n-gpc-paletilla-de-cordero-con-brazuelo-|c
knuckle shoulder 5 rib unece 404774|n-gpc-paletilla-de-cordero-con-brazuelo--2|c
knuckle shoulder 6 rib unece 404775|n-gpc-paletilla-de-cordero-con-brazuelo--3|c
knuckle unece 505072|n-gpc-babilla-de-cabrito|c
kochkaese|n-gpc-queso-kochkase|c
koeniglicher kurzstiel|n-gpc-koeniglicher-kurzstiel|c
kohlrabi|n-gpc-colirrabano|a
koit|n-gpc-koit|c
kombu de azucar|n-f-argazo-real|o
kombu de remos|n-f-kombu-de-remos|o
kombu japones|n-f-kombu-japones|o
koningszuur engelse bellefleur|n-gpc-koningszuur-engelse-bellefleur|c
korallo|n-gpc-korallo|c
korem isola nuraghi|n-gpc-korem-isola-nuraghi|c
koricnoje novoje|n-gpc-koricnoje-novoje|c
koshu|n-gpc-koshu|c
kotsifali|n-gpc-kotsifali|c
kovagenkovskoje|n-gpc-kovagenkovskoje|c
krameri tuvioun|n-gpc-krameri-tuvioun|c
kruegers dickstiel celler dickstiel|n-gpc-kruegers-dickstiel-celler-dickstie|c
kruidenierspeer|n-gpc-kruidenierspeer|c
kulikovskoje|n-gpc-kulikovskoje|c
kumkuat|n-v-kunkuat|c
kumkuat|n-v-kumkuat|c
kumquat|n-gpc-kumquat|a
kunkuat|n-v-kunkuat|c
kurrat|n-gpc-puerro-egipcio|a
kyphosus sectatrix|n-f-chopon|s
l acadie blanc|n-gpc-l-acadie-blanc|c
labeo calbasu|n-f-carpa-naranja|s
labeo rohita|n-f-carpa-rohu|s
labrus bergylta|n-f-maragota|s
labrus merula|n-f-tordo-negro|s
labrus mixtus|n-f-gallano|s
labrus viridis|n-f-tordo-verde|s
lacon fresco|n-p-codillo|a
lacrima|n-gpc-lacrima|c
lacrima christi|n-gpc-lacrima-christi|c
lacteos|n-dairy|a
lady|n-gpc-lady|c
lady naomi|n-gpc-lady-naomi|c
lady williams|n-gpc-lady-williams|c
laevicardium crassum|n-f-berberecho-dentado|s
lagarto|n-f-lagarto|o
lagarto|n-p-lagarto|a
lagarto capitan|n-f-lagarto-capitan|o
lagarto iberico|n-p-lagarto|a
lagrein|n-gpc-lagrein|c
lagrein/schiava/teroldego|n-gpc-lagrein-schiava-teroldego|c
lamb|n-gpc-cordero|a
lamb prepared/processed|n-gpc-cordero|a
lamb unprepared/unprocessed|n-gpc-cordero|a
lamb/mutton sausages|n-gpc-embutido-de-cordero|a
lamb/mutton sausages prepared/processed|n-gpc-embutido-de-cordero|a
lambia|n-gpc-lambia|c
lambrusco|n-gpc-lambrusco|c
lambrusco di emilia|n-gpc-lambrusco-di-emilia|c
lambrusco di sorbara|n-gpc-lambrusco-di-sorbara|c
lambrusco grasparossa|n-gpc-lambrusco-grasparossa|c
lambrusco maestri|n-gpc-lambrusco-maestri|c
lambrusco marani|n-gpc-lambrusco-marani|c
lambrusco salamino|n-gpc-lambrusco-salamino|c
lambs lettuce|n-gpc-canonigos|a
laminaria|n-f-laminaria|o
laminaria digitata|n-f-kombu-de-remos|s
laminaria ochroleuca|n-f-laminaria|s
laminaria rodriguezii|n-f-laminaria|s
lamna nasus|n-f-marrajo-sardinero|s
lampanyctus crocodilus|n-f-pez-linterna|s
lamprea|n-f-lamprea|o
lampris guttatus|n-f-luna-real|s
lampuga|n-f-lampuga|o
lancashire|n-gpc-queso-lancashire|c
land snail|n-gpc-caracol-de-tierra|a
land snail prepared/processed|n-gpc-caracol-de-tierra|a
land snail unprepared/unprocessed|n-gpc-caracol-de-tierra|a
landsberger renette|n-gpc-landsberger-renette|c
lane s prince albert|n-gpc-lane-s-prince-albert|c
langosta|n-f-langosta|o
langosta australiana|n-f-langosta-australiana|o
langosta barbona|n-f-langosta-barbona|o
langosta colas|n-f-langosta|c
langosta colas cong|n-f-langosta|c
langosta cong|n-f-langosta|c
langosta del cabo|n-f-langosta-del-cabo|o
langosta del caribe|n-f-langosta-del-caribe|o
langosta del natal|n-f-langosta-del-natal|o
langosta del peru|n-f-langosta-del-peru|o
langosta herrena|n-f-langosta-herrena|o
langosta mora|n-f-langosta-mora|o
langosta real|n-f-langosta-real|o
langosta roja|n-f-langosta|c
langosta verde|n-f-langosta-verde|o
langostas|n-f-langosta|c
langostilla roja|n-f-langostilla-roja|o
langostillo|n-f-corruco|o
langostino|n-f-langostino|o
langostino|n-f-langostino-banana|o
langostino|n-f-langostino-blanco|o
langostino|n-f-langostino-jumbo|o
langostino|n-f-langostino-marfil|o
langostino|n-f-langostino-mediterraneo|o
langostino|n-f-langostino-moruno|o
langostino|n-f-langostino-rosado|o
langostino|n-f-langostino-tigre|o
langostino|n-f-langostino-tigre-arco-iris|o
langostino|n-f-langostino-tigre-marron|o
langostino|n-f-langostino-vannamei|o
langostino /|n-f-langostino|c
langostino austral|n-f-gambon|o
langostino banana|n-f-langostino-banana|o
langostino banana|n-f-langostino-marfil|o
langostino blanco|n-f-langostino-blanco|o
langostino blanco|n-f-langostino-vannamei|o
langostino cocido cong|n-f-langostino|c
langostino cocido envasado atm|n-f-langostino|c
langostino cocido grande|n-f-langostino|c
langostino cocido grande cong|n-f-langostino|c
langostino cocido mediano|n-f-langostino|c
langostino cocido mediano cong|n-f-langostino|c
langostino cocido pequeno|n-f-langostino|c
langostino cocido pequeno cong|n-f-langostino|c
langostino cocido/salado|n-f-langostino|c
langostino cong|n-f-langostino|c
langostino cristal|n-f-langostino-cristal|o
langostino envasado atm|n-f-langostino|c
langostino fresco|n-f-langostino|c
langostino grande|n-f-langostino|c
langostino grande cong|n-f-langostino|c
langostino jumbo|n-f-langostino-jumbo|o
langostino marfil|n-f-langostino-marfil|o
langostino mediano|n-f-langostino|c
langostino mediano cong|n-f-langostino|c
langostino mediterraneo|n-f-langostino-mediterraneo|o
langostino moruno|n-f-langostino-moruno|o
langostino pequeno|n-f-langostino|c
langostino pequeno cong|n-f-langostino|c
langostino rosado|n-f-langostino-rosado|o
langostino s cabeza cola|n-f-langostino|c
langostino s cabeza cola cong|n-f-langostino|c
langostino sudamerica|n-f-langostino|c
langostino tigre|n-f-langostino-tigre|o
langostino tigre arco iris|n-f-langostino-tigre-arco-iris|o
langostino tigre cong|n-f-langostino|c
langostino tigre marron|n-f-langostino-tigre-marron|o
langostino titi|n-f-langostino-titi|o
langostino tunez|n-f-langostino|c
langostino vannamei|n-f-langostino-vannamei|o
lapa|n-f-lapa|o
lapa aspera|n-f-lapa-aspera|o
lapa negra|n-f-lapa-negra|o
lapa punteada|n-f-lapa-punteada|o
larimichthys crocea|n-f-corvinata-azafran|s
larimichthys polyactis|n-f-corvinata-amarilla|s
lateolabrax japonicus|n-f-lubina-japonesa|s
lates calcarifer|n-f-perca-gigante|s
lates niloticus|n-f-perca-del-nilo|s
latigo|n-f-cauloco|o
latona deltoides|n-f-tellina-austral|s
laurel|n-v-laurel|c
laurencia|n-f-laurencia|o
laurencia obtusa|n-f-laurencia|s
lavanda de mar|n-gpc-lavanda-de-mar|a
laxton s superb|n-gpc-laxton-s-superb|c
laxtons fortune|n-gpc-laxtons-fortune|c
le cure pastorenbirne|n-gpc-le-cure-pastorenbirne|c
leaf vegetables fresh cut variety packs mixed|n-gpc-surtidos-de-hoja-cortada|a
leaf vegetables unprepared/unprocessed variety packs|n-gpc-surtidos-de-hoja|a
leaf vegetables variety packs|n-gpc-surtidos-de-hoja|a
leaf vegetables variety packs mixed|n-gpc-surtidos-de-hoja-cortada|a
leanyka|n-gpc-leanyka|c
lechal|n-o-cordero-entero|a
lechal despojo|n-o-cordero-entero|c
leche|n-l-leche|a
leche desnatada|n-l-leche|a
leche en conserva|n-l-leche|c
leche entera|n-l-leche|a
leche fresca|n-l-leche|a
leche infantil|n-gpc-leche-infantil|a
leche semidesnatada|n-l-leche|a
leche y nata|n-milk|a
lechon|n-p-cochinillo|a
lechuga|n-v-lechuga|c
lechuga batavia|n-v-lechuga|c
lechuga batavia|n-v-lechuga-batavia|c
lechuga de cogollo|n-gpc-lechuga-de-cogollo|a
lechuga de hoja suelta|n-gpc-lechuga-de-hoja-suelta|a
lechuga de mar|n-f-aonori|o
lechuga de mar|n-f-lechuga-de-mar|o
lechuga de tallo|n-gpc-lechuga-de-tallo|a
lechuga esparrago|n-gpc-lechuga-esparrago|a
lechuga hoja de roble|n-v-lechuga|c
lechuga hoja de roble|n-v-lechuga-hoja-de-roble|c
lechuga iceberg|n-v-lechuga|c
lechuga larga|n-v-lechuga|c
lechuga lollo rosso|n-v-lechuga|c
lechuga lollo rosso|n-v-lechuga-lollo-rosso|c
lechuga romana|n-gpc-lechuga-romana|a
lechuga sin determinar|n-v-lechuga|c
lechuga trocadero|n-v-lechuga|c
lechuga trocadero|n-v-lechuga-trocadero|c
lechugas|n-v-lechuga|c
lechugas iceberg|n-v-lechuga|c
lechugas iceberg|n-v-lechugas-iceberg|c
lechugas romanas|n-v-lechuga|c
lechugas romanas|n-v-lechugas-romanas|c
lectier|n-gpc-lectier|c
leek|n-v-puerro|a
leg 3 way unece 304311|n-gpc-jamon-fresco-despiezado-en-3|c
leg 4 way unece 304312|n-gpc-jamon-fresco-despiezado-en-4|c
leg 5 way unece 304313|n-gpc-jamon-fresco-despiezado-en-5|c
leg 6 way unece 304314|n-gpc-jamon-fresco-despiezado-en-6|c
leg bottom unece 505067|n-gpc-pierna-de-cabrito-parte-baja|c
leg chump off shank off aithc bone removed unece 404806|n-gpc-pierna-de-cordero-sin-rinonada-jar|c
leg chump off shank off boneless unece 405070|n-gpc-pierna-de-cordero-sin-rinonada-ni--2|c
leg chump off shank off unece 404830|n-gpc-pierna-de-cordero-sin-rinonada-ni-|c
leg chump off shank on aitch bone removed unece 404805|n-gpc-pierna-de-cordero-con-jarrete-sin-|c
leg chump off unece 404820|n-gpc-pierna-de-cordero-sin-rinonada|c
leg chump off unece 504820|n-gpc-pierna-de-cabrito-sin-rinonada|c
leg chump on boneless unece 405060|n-gpc-pierna-de-cordero-con-rinonada-des|c
leg chump on boneless unece 505060|n-gpc-pierna-de-cabrito-con-rinonada-des|c
leg chump on shank off aithc bone removed unece 404802|n-gpc-pierna-de-cordero-con-rinonada-sin-2|c
leg chump on shank off boneless unece 405061|n-gpc-pierna-de-cordero-con-rinonada-sin-3|c
leg chump on shank off unece 404810|n-gpc-pierna-de-cordero-con-rinonada-sin|c
leg chump on shank off unece 504810|n-gpc-pierna-de-cabrito-con-rinonada-sin|c
leg chump on shank on aitch bone removed unece 404801|n-gpc-pierna-de-cordero-con-rinonada-y-j|c
leg chump on unece 404800|n-gpc-pierna-de-cordero-con-rinonada|c
leg chump on unece 504800|n-gpc-pierna-de-cabrito-con-rinonada|c
leg cuts 4 way unece 505065|n-gpc-despiece-de-pierna-de-cabrito-en-4|c
leg cuts unece 405065|n-gpc-despiece-de-pierna-de-cordero|c
leg fillet end unece 404822|n-gpc-pierna-de-cordero-parte-del-filete|c
leg foreshank unece 405030|n-gpc-brazuelo-de-cordero|c
leg hindshank unece 405031|n-gpc-jarrete-trasero-de-cordero|c
leg inside cap off unece 405077|n-gpc-pierna-de-cordero-tapa-sin-capa|c
leg inside unece 304290|n-gpc-jamon-fresco-tapa|c
leg inside unece 405073|n-gpc-pierna-de-cordero-tapa|c
leg knuckle tip unece 304310|n-gpc-jamon-fresco-punta-de-babilla|c
leg knuckle tip unece 405072|n-gpc-pierna-de-cordero-punta-de-babilla|c
leg long cut boneless unece 304200|n-gpc-jamon-fresco-de-corte-largo-deshue|c
leg long cut style 1 unece 304013|n-gpc-jamon-fresco-de-corte-largo-tipo-1|c
leg long cut style 2 unece 304014|n-gpc-jamon-fresco-de-corte-largo-tipo-2|c
leg long cut style 3 unece 304015|n-gpc-jamon-fresco-de-corte-largo-tipo-3|c
leg outside eye unece 304301|n-gpc-jamon-fresco-redondo|c
leg outside unece 304300|n-gpc-jamon-fresco-contra|c
leg outside unece 405075|n-gpc-pierna-de-cordero-contra|c
leg pair and loin saddle 0 rib unece 404901|n-gpc-par-de-piernas-de-cordero-con-sill|c
leg pair and loin saddle 1 rib unece 404902|n-gpc-par-de-piernas-de-cordero-con-sill-2|c
leg pair and loin saddle 2 rib unece 404903|n-gpc-par-de-piernas-de-cordero-con-sill-3|c
leg pair and loin saddle 3 rib unece 404904|n-gpc-par-de-piernas-de-cordero-con-sill-4|c
leg pair and loin saddle 4 rib unece 404905|n-gpc-par-de-piernas-de-cordero-con-sill-5|c
leg pair and loin saddle 5 rib unece 404906|n-gpc-par-de-piernas-de-cordero-con-sill-6|c
leg pair and loin saddle 6 rib unece 404907|n-gpc-par-de-piernas-de-cordero-con-sill-7|c
leg pair and loin saddle unece 504901|n-gpc-par-de-piernas-de-cabrito-con-sill|c
leg pair and saddle 10 rib unece 404943|n-gpc-par-de-piernas-de-cordero-con-sill-8|c
leg pair and saddle 11 rib unece 404944|n-gpc-par-de-piernas-de-cordero-con-sill-9|c
leg pair and saddle 12 rib unece 404945|n-gpc-par-de-piernas-de-cordero-con-sill-10|c
leg pair and saddle 13 rib unece 404946|n-gpc-par-de-piernas-de-cordero-con-sill-11|c
leg pair and saddle 7 rib unece 404941|n-gpc-par-de-piernas-de-cordero-con-sill-12|c
leg pair and saddle 8 rib unece 404940|n-gpc-par-de-piernas-de-cordero-con-sill-13|c
leg pair and saddle 9 rib unece 404942|n-gpc-par-de-piernas-de-cordero-con-sill-14|c
leg pair and saddle unece 504946|n-gpc-par-de-piernas-de-cabrito-con-sill-2|c
leg pair unece 404816|n-gpc-par-de-piernas-de-cordero|c
leg quarter unece 710901|n-gpc-cuarto-trasero-de-pavo|c
leg quarter without tail unece 710902|n-gpc-cuarto-trasero-de-pavo-sin-rabadil|c
leg shank bone easy carve leg unece 404821|n-gpc-pierna-de-cordero-de-trinchado-fac|c
leg shank bone easy carve leg unece 504821|n-gpc-pierna-de-cabrito-de-trinchado-fac|c
leg shank end unece 404823|n-gpc-pierna-de-cordero-parte-del-jarret|c
leg short cut style 1 unece 304016|n-gpc-jamon-fresco-de-corte-corto-tipo-1|c
leg short cut style 2 unece 304017|n-gpc-jamon-fresco-de-corte-corto-tipo-2|c
leg short cut style 3 unece 304018|n-gpc-jamon-fresco-de-corte-corto-tipo-3|c
leg silverside unece 405071|n-gpc-pierna-de-cordero-culata-de-contra|c
leg thick flank unece 405076|n-gpc-pierna-de-cordero-babilla|c
leg with back portion / leg quarter unece 700901|n-gpc-cuarto-trasero-de-pollo-con-parte-|c
leg with back portion without tail / leg quarter without tail unece 700902|n-gpc-cuarto-trasero-de-pollo-con-parte--2|c
leg with back portion without tail or abdominal fat unece 700903|n-gpc-cuarto-trasero-de-pollo-con-parte--3|c
leguado filete|n-f-lenguado|c
leguado filete cong|n-f-lenguado|c
legumbre y arroz|n-pulses|a
legumbres|n-pulses|a
legumbres varias|n-d-vario|c
legumbres varios|n-d-vario|c
leionura atun|n-f-sierra-americano|s
lejia|n-x-producto-de-limpieza|a
lemoen|n-gpc-lemoen|c
lemon thyme|n-gpc-tomillo-limonero|a
lemon verbena|n-gpc-hierba-luisa|a
lemongrass|n-gpc-citronela|a
lemons|n-v-limon|a
lena|n-gpc-lena|c
lengua|n-c-lengua|a
lengua|n-meat|c
lengua|n-beef|c
lengua de canarias|n-f-lengua-de-canarias|o
lengua de ghana|n-f-lengua-de-ghana|o
lengua de ternera|n-c-lengua|a
lengua nigeriana|n-f-lengua-nigeriana|o
lengua senegalesa|n-f-lengua-senegalesa|o
lengua tropical|n-f-lengua-tropical|o
lenguadina|n-f-limanda|o
lenguadina cong|n-f-limanda|c
lenguadina falsa o mendo|n-f-acedia|c
lenguadina o limanda o v|n-f-acedia|c
lenguado|n-f-lenguado|c
lenguado acuicultura|n-f-lenguado|c
lenguado africano|n-f-lenguado-africano|o
lenguado cong|n-f-lenguado|c
lenguado de arena|n-f-lenguado-de-arena|o
lenguado de frechkop|n-f-lenguado-de-frechkop|o
lenguado de guinea|n-f-lenguado-de-guinea|o
lenguado de klein|n-f-lenguado-de-klein|o
lenguado de nueva zelanda|n-f-lenguado-de-nueva-zelanda|o
lenguado de profundidad|n-f-lenguado-de-profundidad|o
lenguado del adriatico|n-f-lenguado-del-adriatico|o
lenguado del cabo|n-f-lenguado-del-cabo|o
lenguado del sur|n-f-lenguado-del-sur|o
lenguado egipcio|n-f-lenguado-egipcio|o
lenguado entero con piel|n-f-lenguado|c
lenguado entero con piel cong|n-f-lenguado|c
lenguado europeo|n-f-lenguado-europeo|o
lenguado grande|n-f-lenguado|c
lenguado limon|n-f-mendo-limon|o
lenguado limon austral|n-f-lenguado-limon-austral|o
lenguado maori|n-f-lenguado-maori|o
lenguado mediano|n-f-lenguado|c
lenguado negro|n-f-soldado|o
lenguado o p|n-f-lenguado|c
lenguado o p cong|n-f-lenguado|c
lenguado pelicano|n-f-lenguado-pelicano|o
lenguado pequeno|n-f-lenguado|c
lenguado portugues|n-f-lenguado-portugues|o
lenguado rubio|n-f-lenguado-senegales|o
lenguado seis monedas|n-f-acedia-moteada|o
lenguado senegales|n-f-lenguado-senegales|o
lenguado tigre|n-f-lenguado-de-guinea|o
lenguado tres monedas|n-f-lenguado-tres-monedas|o
lenguado velludo|n-f-lenguado-velludo|o
lenteja|n-d-lenteja|a
lenteja beluga|n-d-lenteja-beluga|a
lenteja castellana|n-d-lenteja-castellana|a
lenteja pardina|n-d-lenteja-pardina|a
lentejas|n-d-lenteja|a
lentils|n-d-lenteja|a
leon millot|n-gpc-leon-millot|c
leonardeta|n-gpc-leonardeta|c
lepidion guentheri|n-f-moranella-de-gunter|s
lepidion lepidion|n-f-moranella-roja|s
lepidocephalichthys guntea|n-f-locha-guntea|s
lepidocybium flavobrunneum|n-f-escolar-negro|s
lepidopsetta bilineata|n-f-platija-del-pacifico|s
lepidopus caudatus|n-f-pez-cinto|s
lepidorhombus boscii|n-f-gallo|s
lepidorhombus spp|n-f-gallo|s
lepidorhombus whiffiagonis|n-f-gallo-del-norte|s
lepidotrigla cavillone|n-f-cabete|s
lepidotrigla dieuzeidei|n-f-cabete|s
lepidotrigla microptera|n-f-cabete|s
leptochela gracilis|n-f-camaron-cristal-oriental|s
lepturacanthus savala|n-f-pez-sable-savalai|s
lerates|n-gpc-lerates|c
leucoraja circularis|n-f-raya-falsa-vela|s
leucoraja fullonica|n-f-raya-cardadora|s
leucoraja naevus|n-f-raya-santiaguesa|s
leukoma thaca|n-f-almeja-taca|s
levistico|n-gpc-levistico|a
leyden/leiden|n-gpc-queso-leyden|c
liatiko|n-gpc-liatiko|c
liba|n-f-liba|c
libelulas|n-gpc-libelulas|a
liberty|n-gpc-liberty|c
librillo|n-c-callos|a
lichi|n-gpc-lichi|a
lichia amia|n-f-palometon|s
licor|n-d-licor|a
licores|n-d-licor|c
licores importacion|n-d-licor|a
licores nacionales|n-d-licor|a
liebre|n-gpc-liebre|a
ligol|n-gpc-ligol|c
lija|n-f-lija|o
lija aspera|n-f-lija-aspera|o
lija azul|n-f-lija-azul|o
lija gallo|n-f-lija-gallo|o
lilac tannia|n-gpc-malanga-lila|a
lima|n-v-lima|c
lima beans|n-gpc-judia-de-lima|a
lima india|n-gpc-lima-india|a
lima mejicana|n-v-lima|c
lima mejicana|n-v-lima-mejicana|c
lima mexicana|n-gpc-lima-mexicana|a
lima persian|n-v-lima|c
lima persian|n-v-lima-persian|c
limanda|n-f-limanda|o
limanda amarilla|n-f-limanda-amarilla|o
limanda aspera|n-f-limanda-japonesa|s
limanda del canal|n-f-limanda-del-canal|o
limanda japonesa|n-f-limanda-japonesa|o
limanda limanda|n-f-limanda|s
limburgse bellefleur|n-gpc-limburgse-bellefleur|c
limelight|n-gpc-limelight|c
limequat|n-gpc-limequat|a
limequats|n-gpc-limequat|a
limes|n-v-lima|a
limniona|n-gpc-limniona|c
limon|n-v-limon|c
limon eureka|n-v-limon|c
limon eureka|n-v-limon-eureka|c
limon eureka argentina|n-v-limon|c
limon eureka argentina|n-v-limon-eureka-argentina|c
limon eureka sudafrica|n-v-limon|c
limon eureka sudafrica|n-v-limon-eureka-sudafrica|c
limon importacion|n-v-limon|c
limon primafiori|n-v-limon|c
limon primafiori|n-v-limon-primafiori|c
limon rodrejo|n-v-limon|c
limon rodrejo|n-v-limon-rodrejo|c
limonera|n-gpc-limonera|a
limones|n-v-limon|c
limones comun|n-v-limon|c
limones comun|n-v-limones-comun|c
limones verna|n-v-limon|c
limones verna|n-v-limones-verna|c
limpieza|n-d-limpieza|c
limpieza|n-ambient|a
lingonberries|n-gpc-arandano-rojo-silvestre|a
lingzhi mushrooms|n-gpc-reishi|a
liparis tanakae|n-f-tanaka|s
liqueurs|n-d-licor|a
lirio|n-f-lirio|o
lisa|n-f-galupe|o
lisa|n-f-lisa|o
listado|n-f-listado|o
listan blanco|n-gpc-listan-blanco|c
listan negro|n-gpc-listan-negro|c
listan prieto|n-gpc-listan-prieto|c
litchi|n-v-litchi|c
litchis|n-v-litchi|c
lithodes ferox|n-f-centolla-feroz|s
lithodes santolla|n-f-centolla-chilena|s
lithognathus mormyrus|n-f-herrera|s
littorina littorea|n-f-bigaro|s
livers unece 702001|n-gpc-higados-de-pollo|c
livers unece 712001|n-gpc-higados-de-pavo|c
lizzy|n-gpc-lizzy|c
llama|n-gpc-llama|a
llama/alpaca|n-gpc-llama|a
llama/alpaca prepared/processed|n-gpc-llama|a
llama/alpaca unprepared/unprocessed|n-gpc-llama|a
llana|n-b-llana|a
llonganissa|n-longaniza|a
llonganissa de vic|n-m-salchichon-de-vic|a
lobo|n-gpc-lobo|c
lobotes surinamensis|n-f-dormilona|s
locha azul|n-f-bertorella-azul|o
locha de roca|n-f-locha-de-roca|o
locha guntea|n-f-locha-guntea|o
lochbuie red braeburn turners red|n-gpc-lochbuie-red-braeburn-turners-red|c
loco|n-f-loco|o
lodel|n-gpc-lodel|c
loganberries|n-gpc-baya-de-logan|a
loin 6 rib unece 404859|n-gpc-lomo-de-cordero-6-costillas|c
loin 7 rib unece 404861|n-gpc-lomo-de-cordero-7-costillas|c
loin 8 rib unece 404860|n-gpc-lomo-de-cordero-8-costillas|c
loin 9 rib unece 404862|n-gpc-lomo-de-cordero-9-costillas|c
loin boneless from 10 ribs unece 304343|n-gpc-lomo-de-cerdo-deshuesado-de-10-cos|c
loin boneless from 11 ribs unece 304342|n-gpc-lomo-de-cerdo-deshuesado-de-11-cos|c
loin boneless from 12 ribs unece 304341|n-gpc-lomo-de-cerdo-deshuesado-de-12-cos|c
loin boneless from 13 ribs unece 304340|n-gpc-lomo-de-cerdo-deshuesado-de-13-cos|c
loin center cut 10 ribs unece 304101|n-gpc-lomo-de-cerdo-corte-central-10-cos|c
loin center cut 11 ribs unece 304100|n-gpc-lomo-de-cerdo-corte-central-11-cos|c
loin center cut 12 ribs unece 304099|n-gpc-lomo-de-cerdo-corte-central-12-cos|c
loin centre cut 13 ribs unece 304098|n-gpc-lomo-de-cerdo-corte-central-13-cos|c
loin chump on 6 rib unece 404839|n-gpc-lomo-de-cordero-con-rinonada-6-cos|c
loin chump on 7 rib unece 404841|n-gpc-lomo-de-cordero-con-rinonada-7-cos|c
loin chump on 8 rib unece 404840|n-gpc-lomo-de-cordero-con-rinonada-8-cos|c
loin chump on 9 rib unece 404842|n-gpc-lomo-de-cordero-con-rinonada-9-cos|c
loin chump on unece 504840|n-gpc-lomo-de-cabrito-con-rinonada|c
loin long 10 ribs unece 304107|n-gpc-lomo-de-cerdo-largo-10-costillas|c
loin long 11 ribs unece 304106|n-gpc-lomo-de-cerdo-largo-11-costillas|c
loin long 12 ribs unece 304105|n-gpc-lomo-de-cerdo-largo-12-costillas|c
loin long 13 ribs unece 304104|n-gpc-lomo-de-cerdo-largo-13-costillas|c
loin long 4 way unece 304113|n-gpc-lomo-de-cerdo-largo-despiezado-en-|c
loin long blade removed 10 ribs unece 304105|n-gpc-lomo-de-cerdo-largo-sin-aguja-10-c|c
loin long blade removed 11 ribs unece 304104|n-gpc-lomo-de-cerdo-largo-sin-aguja-11-c|c
loin long blade removed 12 ribs unece 304103|n-gpc-lomo-de-cerdo-largo-sin-aguja-12-c|c
loin long blade removed 13 ribs unece 304102|n-gpc-lomo-de-cerdo-largo-sin-aguja-13-c|c
loin riblets unece 304159|n-gpc-costillitas-de-lomo|c
loin tenderloin|n-gpc-solomillo-de-vacuno|c
loin tenderloin psoas minor removed|n-gpc-solomillo-de-vacuno-sin-cadena|c
loin top sirloin top butt|n-gpc-cadera-entera|c
loin tri tip|n-gpc-rabillo-de-cadera|c
loin unece 504860|n-gpc-lomo-de-cabrito|c
loligo forbesii|n-f-calamar|s
loligo reynaudii|n-f-calamar|s
loligo vulgaris|n-f-calamar|s
loliolus japonica|n-f-calamar|s
lollo bionda|n-gpc-lollo-bionda|a
lollo rosso|n-gpc-lollo-rosso|a
lombacad|n-gpc-lombacad|c
lombarda|n-v-lombarda|c
lombarts calville and mutants|n-gpc-lombarts-calville-and-mutants|c
lomentaria articulata|n-f-articulata|s
lomito|n-cured-loin|a
lomo alto|n-b-lomo-alto|a
lomo alto 4 costillas|n-gpc-lomo-alto-4-costillas|a
lomo alto 5 costillas|n-gpc-lomo-alto-5-costillas|a
lomo alto 6 costillas|n-gpc-lomo-alto-6-costillas|a
lomo alto 7 costillas|n-gpc-lomo-alto-7-costillas|a
lomo alto 8 costillas|n-gpc-lomo-alto-8-costillas|a
lomo alto deshuesado|n-gpc-lomo-alto-deshuesado|a
lomo alto sin tapa 5 costillas|n-gpc-lomo-alto-sin-tapa-5-costillas|a
lomo alto sin tapa 6 costillas|n-gpc-lomo-alto-sin-tapa-6-costillas|a
lomo alto sin tapa 7 costillas|n-gpc-lomo-alto-sin-tapa-7-costillas|a
lomo alto sin tapa 8 costillas|n-gpc-lomo-alto-sin-tapa-8-costillas|a
lomo alto sin tapa 9 costillas|n-gpc-lomo-alto-sin-tapa-9-costillas|a
lomo bajo|n-b-lomo-bajo|a
lomo bajo con solomillo 1 costilla|n-gpc-lomo-bajo-con-solomillo-1-costilla|a
lomo bajo con solomillo 2 costillas|n-gpc-lomo-bajo-con-solomillo-2-costilla|a
lomo bajo con solomillo 3 costillas|n-gpc-lomo-bajo-con-solomillo-3-costilla|a
lomo bajo con solomillo sin costillas|n-gpc-lomo-bajo-con-solomillo-sin-costil|a
lomo bajo de vacuno 1 costilla|n-gpc-lomo-bajo-de-vacuno-1-costilla|a
lomo bajo de vacuno 2 costillas|n-gpc-lomo-bajo-de-vacuno-2-costillas|a
lomo bajo de vacuno 3 costillas|n-gpc-lomo-bajo-de-vacuno-3-costillas|a
lomo bajo de vacuno sin costillas|n-gpc-lomo-bajo-de-vacuno-sin-costillas|a
lomo curado|n-cured-loin|a
lomo de cabrito|n-gpc-lomo-de-cabrito|a
lomo de cabrito con rinonada|n-gpc-lomo-de-cabrito-con-rinonada|a
lomo de cerdo|n-p-lomo-de-cerdo|a
lomo de cerdo corte central 10 costillas|n-gpc-lomo-de-cerdo-corte-central-10-cos|a
lomo de cerdo corte central 11 costillas|n-gpc-lomo-de-cerdo-corte-central-11-cos|a
lomo de cerdo corte central 12 costillas|n-gpc-lomo-de-cerdo-corte-central-12-cos|a
lomo de cerdo corte central 13 costillas|n-gpc-lomo-de-cerdo-corte-central-13-cos|a
lomo de cerdo deshuesado de 10 costillas|n-gpc-lomo-de-cerdo-deshuesado-de-10-cos|a
lomo de cerdo deshuesado de 11 costillas|n-gpc-lomo-de-cerdo-deshuesado-de-11-cos|a
lomo de cerdo deshuesado de 12 costillas|n-gpc-lomo-de-cerdo-deshuesado-de-12-cos|a
lomo de cerdo deshuesado de 13 costillas|n-gpc-lomo-de-cerdo-deshuesado-de-13-cos|a
lomo de cerdo largo 10 costillas|n-gpc-lomo-de-cerdo-largo-10-costillas|a
lomo de cerdo largo 11 costillas|n-gpc-lomo-de-cerdo-largo-11-costillas|a
lomo de cerdo largo 12 costillas|n-gpc-lomo-de-cerdo-largo-12-costillas|a
lomo de cerdo largo 13 costillas|n-gpc-lomo-de-cerdo-largo-13-costillas|a
lomo de cerdo largo despiezado en 4|n-gpc-lomo-de-cerdo-largo-despiezado-en-|a
lomo de cerdo largo sin aguja 10 costillas|n-gpc-lomo-de-cerdo-largo-sin-aguja-10-c|a
lomo de cerdo largo sin aguja 11 costillas|n-gpc-lomo-de-cerdo-largo-sin-aguja-11-c|a
lomo de cerdo largo sin aguja 12 costillas|n-gpc-lomo-de-cerdo-largo-sin-aguja-12-c|a
lomo de cerdo largo sin aguja 13 costillas|n-gpc-lomo-de-cerdo-largo-sin-aguja-13-c|a
lomo de cerdo semideshuesado corte central 10 costillas|n-gpc-lomo-de-cerdo-semideshuesado-corte|a
lomo de cerdo semideshuesado corte central 11 costillas|n-gpc-lomo-de-cerdo-semideshuesado-corte-2|a
lomo de cerdo semideshuesado corte central 12 costillas|n-gpc-lomo-de-cerdo-semideshuesado-corte-3|a
lomo de cerdo semideshuesado corte central 13 costillas|n-gpc-lomo-de-cerdo-semideshuesado-corte-4|a
lomo de conejo|n-g-lomo-de-conejo|a
lomo de cordero 6 costillas|n-gpc-lomo-de-cordero-6-costillas|a
lomo de cordero 7 costillas|n-gpc-lomo-de-cordero-7-costillas|a
lomo de cordero 8 costillas|n-gpc-lomo-de-cordero-8-costillas|a
lomo de cordero 9 costillas|n-gpc-lomo-de-cordero-9-costillas|a
lomo de cordero con rinonada 6 costillas|n-gpc-lomo-de-cordero-con-rinonada-6-cos|a
lomo de cordero con rinonada 7 costillas|n-gpc-lomo-de-cordero-con-rinonada-7-cos|a
lomo de cordero con rinonada 8 costillas|n-gpc-lomo-de-cordero-con-rinonada-8-cos|a
lomo de cordero con rinonada 9 costillas|n-gpc-lomo-de-cordero-con-rinonada-9-cos|a
lomo embuchado|n-cured-loin|a
lomo fresco|n-p-lomo-de-cerdo|a
lomo iberico|n-m-lomo-iberico|a
lomo iberico de bellota|n-m-lomo-iberico|a
lomo limpio de cabrito|n-gpc-lomo-limpio-de-cabrito|a
lomo limpio de cordero corto|n-gpc-lomo-limpio-de-cordero-corto|a
lomo limpio de cordero largo|n-gpc-lomo-limpio-de-cordero-largo|a
lomo relleno|n-galantina|a
lonchas de queso|n-q-queso-en-lonchas|a
long cut drumstick and thigh portion with back unece 700904|n-gpc-jamoncito-y-contramuslo-de-pollo-d|c
longan|n-gpc-longan|a
longan dragons eye|n-gpc-longan|a
longaniza|n-longaniza|a
longueiron|n-f-longueiron|o
loose leaf/multileaf lettuce other|n-gpc-lechuga-de-hoja-suelta|a
loose leaf/multileaf salad greens|n-gpc-hoja-de-ensalada-suelta|a
loose leaf/multileaf salad greens|n-vegetable|a
loose leaf/multileaf salad greens fresh cut|n-gpc-hoja-de-ensalada-suelta|a
lophiodes caulinaris|n-f-rape-del-pacifico|s
lophius americanus|n-f-rape-americano|s
lophius budegassa|n-f-rape-negro|s
lophius litulon|n-f-rape-oriental|s
lophius piscatorius|n-f-rape-blanco|s
lophius vaillanti|n-f-rape-africano|s
lophius vomerinus|n-f-rape-del-cabo|s
lord derby|n-gpc-lord-derby|c
lord lambourne|n-gpc-lord-lambourne|c
lota|n-f-lota|o
lotus root|n-gpc-raiz-de-loto|a
louis bonne of jersey|n-gpc-louis-bonne-of-jersey|c
loureiro|n-gpc-loureiro|c
lovage|n-gpc-levistico|a
lower back unece 701402|n-gpc-espalda-baja-de-pollo|c
loxechinus albus|n-f-erizo-blanco|s
lubina|n-seabass|a
lubina acuicult pequqena|n-seabass|c
lubina acuicultu mediana|n-seabass|c
lubina acuicultura grande|n-seabass|c
lubina cong|n-seabass|c
lubina de acuicultura|n-seabass|c
lubina de captura|n-seabass|c
lubina de cultivo|n-seabass|c
lubina japonesa|n-f-lubina-japonesa|o
lubina o robalo|n-seabass|c
lubina o robalo o v|n-seabass|c
lubina rayada|n-f-lubina-rayada|o
lubina salvaje|n-seabass|c
luciano|n-f-luciano|o
lucio|n-f-lucio|o
luciobarbus bocagei|n-f-barbo-comun|s
luciobarbus comizo|n-f-barbo-comizo|s
luciobarbus graellsii|n-f-barbo-de-graells|s
luciobarbus sclateri|n-f-barbo-de-sclater|s
lucioperca|n-f-lucioperca|o
luckystar|n-gpc-luckystar|c
lulas|n-f-lula|c
lulo|n-gpc-lulo|a
lumpo|n-f-lumpo|o
luna|n-gpc-luna|c
luna de la india|n-f-luna-de-la-india|o
luna real|n-f-luna-real|o
luntersche pippeling|n-gpc-luntersche-pippeling|c
luresweet|n-gpc-luresweet|c
luscious|n-gpc-luscious|c
lutjanus agennes|n-f-luciano|s
lutjanus analis|n-f-pargo-criollo|s
lutjanus dentatus|n-f-pargo-marron-africano|s
lutjanus griseus|n-f-pargo-gris|s
lutjanus guttatus|n-f-pargo-de-la-mancha|s
lutjanus malabaricus|n-f-pargo-rojo|s
lutjanus peru|n-f-pargo-peruano|s
lutraria lutraria|n-f-arola|s
luvaro|n-f-luvaro|o
luvarus imperialis|n-f-luvaro|s
luxemburger renette|n-gpc-luxemburger-renette|c
lychees litchi|n-gpc-lichi|a
maagdenpeer|n-gpc-maagdenpeer|c
mabre o herrera|n-f-herrera|c
mabre o herrera cong|n-f-herrera|c
macabeo|n-gpc-macabeo|a
macabeo macabeu|n-gpc-macabeo|c
macabeo/xarel lo/parellada/chardonnay|n-gpc-macabeo-xarel-lo-parellada-chardon|c
macarela|n-f-macarela|o
macarrones|n-d-pasta|a
macha|n-f-macha|o
mache|n-v-mache|c
mache o berros|n-v-mache|c
mache o berros|n-v-mache-o-berros|c
machuelo|n-f-machuelo|o
machuelo araucano|n-f-machuelo-araucano|o
macoun|n-gpc-macoun|c
macroparalepis affinis|n-f-bicho|s
macropipus tuberculatus|n-f-necora-nudosa|s
macroramphosus scolopax|n-f-trompetero|s
macrourus berglax|n-f-granadero|s
macrourus holotrachys|n-f-granadero-ojisapo|s
macrourus spp|n-f-granadero|s
macruronus novaezelandiae|n-f-merluza-de-cola|s
mactromeris polynyma|n-f-almeja-artica|s
madeja|n-casing|a
madreanguila|n-f-barbada|o
madrilla|n-f-madrilla|o
madrona|n-gpc-madrono|a
madrono|n-gpc-madrono|a
magallana gigas|n-f-ostra-rizada|s
magdalena|n-d-bolleria|a
magliocco|n-gpc-magliocco|c
magre|n-f-magre|c
magret|n-a-magret-de-pato|a
magret de pato|n-a-magret-de-pato|a
magro|n-p-magro-de-cerdo|a
magro de cerdo|n-p-magro-de-cerdo|a
magro picado|n-p-magro-de-cerdo|a
maguimithrax spinosissimus|n-f-cangrejo-rey-del-caribe|s
mahana red|n-gpc-mahana-red|c
mahon|n-q-queso-mahon|a
maigold|n-gpc-maigold|c
maiz|n-v-maiz|c
maiz dulce|n-gpc-maiz-dulce|a
maja brachydactyla|n-f-centolla|s
maja squinado|n-f-centolla|s
majarca|n-gpc-majarca|c
makaira nigricans|n-f-marlin-azul|s
malacoraja senta|n-f-raya-lisa|s
malagousia|n-gpc-malagousia|c
malanga blanca|n-gpc-malanga-blanca|a
malanga lila|n-gpc-malanga-lila|a
malbec|n-gpc-malbec|c
malbec/barbera|n-gpc-malbec-barbera|c
malbec/cabernet sauvignon|n-gpc-malbec-cabernet-sauvignon|c
malbec/cabernet sauvignon/petit verdot|n-gpc-malbec-cabernet-sauvignon-petit-ve|c
malbec/sangiovese|n-gpc-malbec-sangiovese|c
mallotus villosus|n-f-capelan|s
malvar|n-gpc-malvar|c
malvasia|n-gpc-malvasia|c
malvasia de sitges|n-gpc-malvasia-de-sitges|c
malvasia del lazio|n-gpc-malvasia-del-lazio|c
malvasia di candia|n-gpc-malvasia-di-candia|c
malvasia di candia aromatica|n-gpc-malvasia-di-candia-aromatica|c
malvasia di schierano|n-gpc-malvasia-di-schierano|c
malvasia nera|n-gpc-malvasia-nera|c
malvasia nera/negroamaro/primitivo|n-gpc-malvasia-nera-negroamaro-primitivo|c
malvasia rei|n-gpc-malvasia-rei|c
malvasia toscana|n-gpc-malvasia-toscana|c
malvasia/trebbiano/verdicchio|n-gpc-malvasia-trebbiano-verdicchio|c
mamey|n-gpc-mamey|a
manchego|n-q-queso-manchego|a
mandarin hybrids|n-gpc-mandarina-hibrida|a
mandarina|n-v-mandarina|c
mandarina clemen late|n-v-mandarina|c
mandarina clemen late|n-v-mandarina-clemen-late|c
mandarina clemen pons|n-v-mandarina|c
mandarina clemen pons|n-v-mandarina-clemen-pons|c
mandarina clementina|n-v-mandarina|c
mandarina hibrida|n-gpc-mandarina-hibrida|a
mandarina importacion|n-v-mandarina|c
mandarina king|n-gpc-mandarina-king|a
mandarina mediterranea|n-gpc-mandarina-mediterranea|a
mandarina nadorcott|n-v-mandarina|c
mandarina nadorcott|n-v-mandarina-nadorcott|c
mandarina okitsu|n-v-mandarina|c
mandarina okitsu|n-v-mandarina-okitsu|c
mandarina oronules|n-v-mandarina|c
mandarina oronules|n-v-mandarina-oronules|c
mandarina oroval|n-v-mandarina|c
mandarina oroval|n-v-mandarina-oroval|c
mandarina orri|n-v-mandarina|c
mandarina orri|n-v-mandarina-orri|c
mandarina ortanique|n-v-mandarina|c
mandarina ortanique|n-v-mandarina-ortanique|c
mandarina satsuma|n-v-mandarina|c
mandarinas|n-v-mandarina|c
mandarinas clausellinas|n-v-mandarina|c
mandarinas clausellinas|n-v-mandarinas-clausellinas|c
mandarinas clementinas|n-v-mandarina|c
mandarinas clementinas|n-v-mandarinas-clementinas|c
mandarinas clemenules|n-v-mandarina|c
mandarinas clemenules|n-v-mandarinas-clemenules|c
mandarinas clemenvilles|n-v-mandarina|c
mandarinas clemenvilles|n-v-mandarinas-clemenvilles|c
mandarinas fortuna|n-v-mandarina|c
mandarinas fortuna|n-v-mandarinas-fortuna|c
mandarinas hernandina|n-v-mandarina|c
mandarinas hernandina|n-v-mandarinas-hernandina|c
mandarinas marisol|n-v-mandarina|c
mandarinas marisol|n-v-mandarinas-marisol|c
mandarinas satsumas|n-v-mandarina|c
mandarinas satsumas|n-v-mandarinas-satsumas|c
mandarinas sin deter|n-v-mandarina|c
mandilaria mandilari|n-gpc-mandilaria-mandilari|c
mandrolisai|n-gpc-mandrolisai|c
manga|n-v-manga|c
manga keitt|n-v-manga|c
manga keitt|n-v-manga-keitt|c
manga kent|n-v-manga|c
manga kent|n-v-manga-kent|c
mango|n-mango|a
mango haden|n-mango|c
mango haden|n-v-mango-haden|c
mango tommy atkins|n-mango|c
mango tommy atkins|n-v-mango-tommy-atkins|c
mangos|n-mango|c
mangostan|n-v-mangostan|c
mangosteen|n-v-mangostan|a
manitas|n-p-manitas|a
manitas|n-meat|c
manitas delanteras|n-gpc-manitas-delanteras|a
manitas traseras|n-gpc-manitas-traseras|a
manos de cerdo|n-p-manitas|a
manta|n-f-manta|o
manta cornuda|n-f-manta-cornuda|o
manteca|n-offal-lard|a
manteca de cerdo|n-offal-lard|a
mantellina|n-f-mantellina|o
mantequilla|n-l-mantequilla|a
mantequillas|n-l-mantequilla|a
mantequillas y grasas lacteas|n-butter|a
mantet|n-gpc-mantet|c
manto negro mantonegro|n-gpc-manto-negro-mantonegro|c
manza royal gala|n-v-manza-royal-gala|c
manza royal gala u e|n-v-manzana|c
manza royal gala u e|n-v-manza-royal-gala|c
manzana|n-v-manzana|c
manzana amarilla golden|n-v-manzana|c
manzana bicolor|n-v-manzana|c
manzana de caramelo|n-gpc-manzana-de-caramelo|a
manzana fuji|n-v-manzana|c
manzana fuji|n-v-manzana-fuji|c
manzana fuji importacion|n-v-manzana|c
manzana fuji importacion|n-v-manzana-fuji|c
manzana g smith|n-v-manzana-g-smith|c
manzana g smith u e|n-v-manzana|c
manzana g smith u e|n-v-manzana-g-smith|c
manzana granny smith|n-v-manzana|c
manzana granny smith|n-v-manzana-granny-smith|c
manzana pink lady|n-v-manzana|c
manzana pink lady|n-v-manzana-pink-lady|c
manzana roja|n-v-manzana|c
manzana royal gala|n-v-manzana|c
manzana royal gala|n-v-manzana-royal-gala|c
manzana royal gala import|n-v-manzana|c
manzana royal gala import|n-v-manzana-royal-gala-import|c
manzana silvestre|n-gpc-manzana-silvestre|a
manzana starking argentin|n-v-manzana|c
manzana starking argentin|n-v-manzana-starking-argentin|c
manzana starking ee uu|n-v-manzana|c
manzana starking ee uu|n-v-manzana-starking-ee-uu|c
manzana verde granny smith|n-v-manzana|c
manzanas|n-v-manzana|c
manzanas bellezas|n-v-manzana|c
manzanas bellezas|n-v-manzanas-bellezas|c
manzanas g smith|n-v-manzanas-g-smith|c
manzanas g smith importac|n-v-manzana|c
manzanas g smith importac|n-v-manzanas-g-smith|c
manzanas golden|n-v-manzana|c
manzanas golden|n-v-manzanas-golden|c
manzanas golden u e|n-v-manzana|c
manzanas golden u e|n-v-manzanas-golden|c
manzanas reineta|n-v-manzana|c
manzanas reineta|n-v-manzanas-reineta|c
manzanas sin determinar|n-v-manzana|c
manzanas starking|n-v-manzana|c
manzanas starking|n-v-manzanas-starking|c
manzanas starking importa|n-v-manzana|c
manzanas starking importa|n-v-manzanas-starking-importa|c
manzanas starking u e|n-v-manzana|c
manzanas starking u e|n-v-manzanas-starking|c
manzanas verde doncella|n-v-manzana|c
manzanas verde doncella|n-v-manzanas-verde-doncella|c
manzanilla|n-d-aceituna-manzanilla|a
maracuya|n-v-maracuya|c
maracuya amarillo|n-gpc-maracuya-amarillo|a
maracuya morado|n-gpc-maracuya-morado|a
maragota|n-f-maragota|o
marechal foch|n-gpc-marechal-foch|c
margarina|n-l-margarina|a
margarine|n-l-margarina|a
margarine frozen|n-l-margarina|a
margarine perishable|n-l-margarina|a
margarine shelf stable|n-l-margarina|a
marguerite marillat|n-gpc-marguerite-marillat|c
maria gomez|n-gpc-maria-gomez|c
maribelle|n-gpc-maribelle|c
mariposas y polillas|n-gpc-mariposas-y-polillas|a
mariquita europea|n-f-mariquita-europea|o
mariri red|n-gpc-mariri-red|c
marisco|n-shellfish|a
marisco de concha|n-bivalve|a
mariscos|n-shellfish|a
marjoram|n-gpc-mejorana|a
marlin azul|n-f-marlin-azul|o
marlin peto|n-f-marlin-peto|o
marlin rayado|n-f-marlin-rayado|o
marlin trompa|n-f-marlin-trompa|o
marolo|n-f-marolo|o
marquette|n-gpc-marquette|c
marrajo|n-f-marrajo|o
marrajo carite|n-f-marrajo-carite|o
marrajo sardinero|n-f-marrajo-sardinero|o
marrajos|n-f-marrajo|c
marrajos cong|n-f-marrajo|c
marsanne|n-gpc-marsanne|c
marsanne/petite arvine|n-gpc-marsanne-petite-arvine|c
marsanne/roussanne/viognier|n-gpc-marsanne-roussanne-viognier|c
marsanne/viognier|n-gpc-marsanne-viognier|c
marselan|n-gpc-marselan|c
maruca|n-f-maruca|o
maruca azul|n-f-maruca-azul|o
maruca cong|n-f-maruca|c
maruca espanola|n-f-maruca-espanola|o
marujito|n-f-marujito|o
masa de pizza|n-d-pizza|a
masa y platos de masa|n-gpc-masa-y-platos-de-masa|a
mashua|n-gpc-mashua|a
mashua capucine tubereuse|n-gpc-mashua|a
mastocarpus stellatus|n-f-musgo-estrellado|s
mastuerzo|n-gpc-mastuerzo|a
maturana blanca|n-gpc-maturana-blanca|c
maturana tinta|n-gpc-maturana-tinta|c
mauzac|n-gpc-mauzac|c
may turnips|n-gpc-nabo-de-mayo|a
mayonesa|n-d-salsa|a
mayonnaise/mayonnaise substitutes|n-d-salsa|a
mayonnaise/mayonnaise substitutes frozen|n-d-salsa|a
mayonnaise/mayonnaise substitutes perishable|n-d-salsa|a
mayonnaise/mayonnaise substitutes shelf stable|n-d-salsa|a
maypole|n-gpc-maypole|c
mazuelo|n-gpc-mazuelo|c
mcintosh|n-gpc-mcintosh|c
mcintosh imperial all red|n-gpc-mcintosh-imperial-all-red|c
meat substitutes|n-gpc-sustitutos-de-carne|a
meat substitutes animal based|n-gpc-sustituto-de-carne-de-origen-anima|a
meat substitutes animal based frozen|n-gpc-sustituto-de-carne-de-origen-anima|a
meat substitutes animal based perishable|n-gpc-sustituto-de-carne-de-origen-anima|a
meat substitutes animal based shelf stable|n-gpc-sustituto-de-carne-de-origen-anima|a
meat substitutes non animal based|n-gpc-sustituto-vegetal-de-carne|a
meat substitutes non animal based frozen|n-gpc-sustituto-vegetal-de-carne|a
meat substitutes non animal based perishable|n-gpc-sustituto-vegetal-de-carne|a
meat substitutes non animal based shelf stable|n-gpc-sustituto-vegetal-de-carne|a
meat substitutes variety packs|n-gpc-surtidos-de-sustitutos-de-carne|a
meat/poultry/other animals prepared/processed|n-gpc-carne-y-aves|a
meat/poultry/other animals sausages prepared/processed|n-sausage|a
meat/poultry/other animals unprepared/unprocessed|n-gpc-carne-y-aves|a
medallon de cordero|n-o-medallones-de-cordero|a
medallones de cordero|n-o-medallones-de-cordero|a
media canal|n-halfcarcass|a
media canal de bovino|n-gpc-media-canal-de-bovino|a
media canal de cabrito|n-gpc-media-canal-de-cabrito|a
media canal de cerdo|n-gpc-media-canal-de-cerdo|a
media canal de cerdo despiezada en 3|n-gpc-media-canal-de-cerdo-despiezada-en|a
media canal de cerdo despiezada en 3 limpieza especial|n-gpc-media-canal-de-cerdo-despiezada-en-2|a
media canal de cerdo despiezada en 4 limpieza especial|n-gpc-media-canal-de-cerdo-despiezada-en-3|a
media canal de cordero|n-gpc-media-canal-de-cordero|a
media canal de vacuno|n-b-media-canal-de-vacuno|a
media pechuga de pavo con hueso espalda y costillas|n-gpc-media-pechuga-de-pavo-con-hueso-es|a
media pechuga de pavo con hueso y espalda sin costillas|n-gpc-media-pechuga-de-pavo-con-hueso-y-|a
media pechuga de pavo con parte de espalda costillas y ala|n-gpc-media-pechuga-de-pavo-con-parte-de-3|a
media pechuga de pavo con parte de espalda costillas y primer segmento de ala|n-gpc-media-pechuga-de-pavo-con-parte-de-2|a
media pechuga de pavo con parte de espalda costillas y primer segmento de ala deshuesado|n-gpc-media-pechuga-de-pavo-con-parte-de|a
media pechuga de pavo deshuesada con solomillo|n-gpc-media-pechuga-de-pavo-deshuesada-c|a
media pechuga de pavo deshuesada limpia de espalda costilla y solomillo|n-gpc-media-pechuga-de-pavo-deshuesada-l|a
media pechuga de pollo con hueso costillas y ala|n-gpc-media-pechuga-de-pollo-con-hueso-c|a
media pechuga de pollo con hueso y costillas|n-gpc-media-pechuga-de-pollo-con-hueso-y|a
media pechuga de pollo con parte de espalda|n-gpc-media-pechuga-de-pollo-con-parte-d|a
media pechuga de pollo deshuesada limpia de costilla|n-gpc-media-pechuga-de-pollo-deshuesada-|a
media pechuga de pollo semideshuesada con carne de costilla y primer segmento de ala|n-gpc-media-pechuga-de-pollo-semideshues|a
mediterranean willowleaf mandarins|n-gpc-mandarina-mediterranea|a
medlar|n-v-nispero|a
medregal|n-f-medregal|o
meelis|n-gpc-meelis|c
megabalanus tintinnabulum|n-f-claca|s
megalops atlanticus|n-f-tarpon|s
meiprinses|n-gpc-meiprinses|c
mejillon|n-f-mejillon|o
mejillon cocido|n-f-mejillon|c
mejillon cong|n-f-mejillon|c
mejillon de chile|n-f-mejillon-de-chile|o
mejillon de nueva zelanda|n-f-mejillon-de-nueva-zelanda|o
mejillon de roca|n-f-mejillon|c
mejillon del pacifico|n-f-mejillon-del-pacifico|o
mejillon extra|n-f-mejillon|c
mejillon grande|n-f-mejillon|c
mejillon normal|n-f-mejillon|c
mejillones en escabeche|n-d-conserva-de-pescado|a
mejorana|n-gpc-mejorana|a
melanogrammus aeglefinus|n-f-eglefino|s
melba|n-gpc-melba|c
melisa|n-gpc-melisa|a
melnik|n-gpc-melnik|c
melocoton|n-v-melocoton|c
melocoton amarillo|n-v-melocoton|c
melocoton andross|n-v-melocoton|c
melocoton andross|n-v-melocoton-andross|c
melocoton carne blanca|n-v-melocoton|c
melocoton carne blanca|n-v-melocoton-carne-blanca|c
melocoton chile|n-v-melocoton|c
melocoton chile|n-v-melocoton-chile|c
melocoton merryl elegant|n-v-melocoton|c
melocoton merryl elegant|n-v-melocoton-merryl-elegant|c
melocoton merryl francisc|n-v-melocoton|c
melocoton merryl francisc|n-v-melocoton-merryl-francisc|c
melocoton rojo|n-v-melocoton|c
melocoton rojo|n-v-melocoton-rojo|c
melocoton rojo p blanca|n-v-melocoton|c
melocoton royal glory|n-v-melocoton|c
melocoton royal glory|n-v-melocoton-royal-glory|c
melocoton temprano|n-v-melocoton|c
melocoton temprano|n-v-melocoton-temprano|c
melocoton tirrenia|n-v-melocoton|c
melocoton tirrenia|n-v-melocoton-tirrenia|c
melocotones|n-v-melocoton|c
melocotones a dunas|n-v-melocoton|c
melocotones a dunas|n-v-melocotones-a-dunas|c
melocotones amarillo|n-v-melocoton|c
melocotones amarillo|n-v-melocotones-amarillo|c
melocotones baby gold|n-v-melocoton|c
melocotones baby gold|n-v-melocotones-baby-gold|c
melocotones calanda|n-v-melocoton|c
melocotones calanda|n-v-melocotones-calanda|c
melocotones campiel|n-v-melocoton|c
melocotones campiel|n-v-melocotones-campiel|c
melocotones cardinal|n-v-melocoton|c
melocotones cardinal|n-v-melocotones-cardinal|c
melocotones catherine|n-v-melocoton|c
melocotones catherine|n-v-melocotones-catherine|c
melocotones dixi red|n-v-melocoton|c
melocotones dixi red|n-v-melocotones-dixi-red|c
melocotones jeronimos|n-v-melocoton|c
melocotones jeronimos|n-v-melocotones-jeronimos|c
melocotones lohabel|n-v-melocoton|c
melocotones lohabel|n-v-melocotones-lohabel|c
melocotones maruja|n-v-melocoton|c
melocotones maruja|n-v-melocotones-maruja|c
melocotones pipas|n-v-melocoton|c
melocotones pipas|n-v-melocotones-pipas|c
melocotones red gallur|n-v-melocoton|c
melocotones red gallur|n-v-melocotones-red-gallur|c
melocotones red glober|n-v-melocoton|c
melocotones red glober|n-v-melocotones-red-glober|c
melocotones red haven|n-v-melocoton|c
melocotones red haven|n-v-melocotones-red-haven|c
melocotones rojo gallur|n-v-melocoton|c
melocotones rojo gallur|n-v-melocotones-rojo-gallur|c
melocotones rojos p amarilla|n-v-melocoton|c
melocotones springtime|n-v-melocoton|c
melocotones springtime|n-v-melocotones-springtime|c
melocotones sudanel|n-v-melocoton|c
melocotones sudanel|n-v-melocotones-sudanel|c
melocotones vesubio|n-v-melocoton|c
melocotones vesubio|n-v-melocotones-vesubio|c
melodie|n-gpc-melodie|c
melon|n-v-melon|c
melon amargo|n-gpc-melon-amargo|a
melon amarillo|n-v-melon|c
melon cantalupo|n-gpc-melon-cantalupo|a
melon cantalupo liso|n-gpc-melon-cantalupo-liso|a
melon categoria|n-v-melon|c
melon categoria|n-v-melon-categoria|c
melon conomon|n-gpc-melon-conomon|a
melon de bourgogne|n-gpc-melon-de-bourgogne|c
melon de invierno|n-gpc-melon-de-invierno|a
melon galia|n-v-melon|c
melon horned|n-v-kiwano|a
melon sin determinar|n-v-melon|c
melon verde piel de sapo|n-v-melon|c
melones|n-v-melon|c
melones amarillo|n-v-melon|c
melones amarillo|n-v-melones-amarillo|c
melones cantaloup|n-v-melon|c
melones cantaloup|n-v-melones-cantaloup|c
melones futuro|n-v-melon|c
melones futuro|n-v-melones-futuro|c
melones galia|n-v-melon|c
melones galia|n-v-melones-galia|c
melones goloso|n-v-melon|c
melones goloso|n-v-melones-goloso|c
melones mochuelo|n-v-melon|c
melones mochuelo|n-v-melones-mochuelo|c
melones piel de sapo|n-v-melon|c
melones piel de sapo|n-v-melones-piel-de-sapo|c
melones roche|n-v-melon|c
melones roche|n-v-melones-roche|c
melones tendrall|n-v-melon|c
melones tendrall|n-v-melones-tendrall|c
melons|n-v-melon|a
melons fresh cut|n-v-melon|a
melrose|n-gpc-melrose|c
melva|n-f-melva|o
membrillo|n-v-membrillo|c
membrillos|n-v-membrillo|c
menaje|n-ambient|a
menaje hosteleria|n-d-menaje-hosteleria|c
mencia|n-gpc-mencia|a
mencia jaen|n-gpc-mencia|c
mencia/tempranillo|n-gpc-mencia-tempranillo|c
mendo|n-f-mendo|o
mendo limon|n-f-mendo-limon|o
mendos|n-f-mendo|c
menestra|n-v-menestra|a
menestra de verduras|n-v-menestra|a
menta|n-gpc-menta|a
mercenaria mercenaria|n-f-almeja-americana|s
meretrix lyrata|n-clam|s
meretrix meretrix|n-f-almeja-oriental|s
meridian|n-gpc-meridian|c
merlan|n-f-merlan|o
merlangius merlangus|n-f-merlan|s
merlot|n-gpc-merlot|c
merlot khorus|n-gpc-merlot-khorus|c
merlot/cabernet franc|n-gpc-merlot-cabernet-franc|c
merlot/cabernet franc/cabernet sauvignon|n-gpc-merlot-cabernet-franc-cabernet-sau|c
merlot/cabernet franc/cabernet sauvignon/syrah|n-gpc-merlot-cabernet-franc-cabernet-sau-2|c
merlot/cabernet sauvignon|n-gpc-merlot-cabernet-sauvignon|c
merlot/cabernet sauvignon/cabernet franc|n-gpc-merlot-cabernet-sauvignon-cabernet|c
merlot/cabernet sauvignon/cabernet franc/malbec/petit verdot|n-gpc-merlot-cabernet-sauvignon-cabernet-2|c
merlot/cabernet sauvignon/malbec|n-gpc-merlot-cabernet-sauvignon-malbec|c
merlot/cabernet sauvignon/petit verdot|n-gpc-merlot-cabernet-sauvignon-petit-ve|c
merlot/cabernet sauvignon/sangiovese|n-gpc-merlot-cabernet-sauvignon-sangiove|c
merlot/cabernet sauvignon/tempranillo/grenache|n-gpc-merlot-cabernet-sauvignon-temprani|c
merlot/chasselas|n-gpc-merlot-chasselas|c
merlot/gamay|n-gpc-merlot-gamay|c
merlot/garanoir/gamaret/cabernet franc|n-gpc-merlot-garanoir-gamaret-cabernet-f|c
merlot/nero d avola|n-gpc-merlot-nero-d-avola|c
merlot/syrah|n-gpc-merlot-syrah|c
merlot/tempranillo/grenache/cabernet sauvignon|n-gpc-merlot-tempranillo-grenache-cabern|c
merluccius australis|n-f-merluza-austral|s
merluccius bilinearis|n-f-merluza-americana|s
merluccius capensis|n-f-merluza-del-cabo|s
merluccius gayi|n-f-merluza-del-peru|s
merluccius hubbsi|n-f-merluza-argentina|s
merluccius merluccius|n-hake|s
merluccius paradoxus|n-f-merluza-del-cabo|s
merluccius polli|n-f-merluza-negra|s
merluccius productus|n-f-merluza-del-pacifico|s
merluccius senegalensis|n-f-merluza-negra|s
merluza|n-hake|a
merluza americana|n-f-merluza-americana|o
merluza argentina|n-f-merluza-argentina|o
merluza arrastre|n-hake|c
merluza arrastre + 1 kg|n-hake|c
merluza austral|n-f-merluza-austral|o
merluza cong|n-hake|c
merluza de|n-hake|c
merluza de altura|n-f-merluza-del-cabo|o
merluza de angola|n-f-merluza-negra|o
merluza de arrastre|n-hake-trawl|a
merluza de chile|n-f-merluza-austral|o
merluza de chile|n-hake|c
merluza de cola|n-f-merluza-de-cola|o
merluza de cola azul|n-f-merluza-de-cola|o
merluza de pincho|n-hake-hook|a
merluza de sudafrica|n-hake|c
merluza del cabo|n-f-merluza-del-cabo|o
merluza del pacifico|n-f-merluza-del-pacifico|o
merluza del peru|n-f-merluza-del-peru|o
merluza del senegal|n-f-merluza-negra|o
merluza entera n 3/4|n-hake|c
merluza europea|n-hake|o
merluza filete|n-hake|c
merluza filete c/p cong|n-hake|c
merluza filete s/p cong|n-hake|c
merluza gayi|n-f-merluza-del-peru|o
merluza gran sol|n-hake|c
merluza gran sol +2 5 5kg|n-hake|c
merluza gran sol +5 kg|n-hake|c
merluza hoki|n-f-merluza-de-cola|o
merluza n 4 hasta 2 5 kg cong|n-hake|c
merluza n 5 de +2 5 kg cong|n-hake|c
merluza negra|n-f-merluza-negra|o
merluza o v|n-hake|c
merluza palangre|n-hake|c
merluza palangre imp|n-hake|c
merluza palangre imp + 1 kg|n-hake|c
merluza palangre nacional|n-hake|c
merluza pincho|n-hake|c
merluza pincho +2 5 5 kg|n-hake|c
merluza pincho +5 kg|n-hake|c
merluza plateada|n-f-merluza-americana|o
merluza rodaja|n-hake|c
merluza rodaja cong|n-hake|c
merluza sudamericana|n-f-merluza-argentina|o
merluza surena|n-f-merluza-austral|o
mermelada|n-d-mermelada|a
mermelada y confitura|n-gpc-mermelada-y-confitura|a
mero|n-f-mero|o
mero antartico azul|n-f-mero-antartico-azul|o
mero castano|n-f-mero-castano|o
mero cong|n-f-mero|c
mero espinudo|n-f-mero-espinudo|o
mero guaza|n-f-mero-guaza|o
mero malabarico|n-f-mero-malabarico|o
mero medioluto|n-f-mero-medioluto|o
mero oliva|n-f-mero-oliva|o
mero sureno|n-f-mero-sureno|o
merseguera|n-gpc-merseguera|c
merwah|n-gpc-merwah|c
mesodesma donacium|n-f-macha|s
metacarcinus edwardsii|n-f-buey-austral|s
metanephrops andamanicus|n-f-cigala-de-andaman|s
metanephrops mozambicus|n-f-cigala-de-mozambique|s
metanephrops thomsoni|n-f-cigala-de-bandas-rojas|s
metapenaeus affinis|n-f-langostino-blanco|s
metapenaeus monoceros|n-f-langostino-banana|s
meunier|n-gpc-meunier|c
mexican limes|n-gpc-lima-mexicana|a
mezcla de frutos secos|n-gpc-mezcla-de-frutos-secos|a
mezclas de pescado marisco e invertebrados|n-gpc-mezclas-de-pescado-marisco-e-inver|a
mezclum|n-v-mezclum|a
michaelmas red|n-gpc-michaelmas-red|c
micro vegetables|n-v-microvegetal|a
micro vegetables fresh cut|n-v-microvegetal|a
microalga chlorella|n-f-chlorella|o
microalga chromochloris|n-f-microalga-chromochloris|o
microalga dunaliella|n-f-microalga-dunaliella|o
microalga haematococcus|n-f-microalga-haematococcus|o
microalga isochrysis|n-f-microalga-isochrysis|o
microalga microchloropsis|n-f-microalga-microchloropsis|o
microalga tetraselmis|n-f-microalga-tetraselmis|o
microchirus azevia|n-f-soldado|s
microchirus frechkopi|n-f-lenguado-de-frechkop|s
microchirus hexophthalmus|n-f-acedia-moteada|s
microchirus ocellatus|n-f-tambor-real|s
microchirus variegatus|n-f-golleta|s
microchloropsis gaditana|n-f-microalga-microchloropsis|s
microcosmus vulgaris|n-f-bunuelo-de-mar|s
micromesistius australis|n-f-bacaladilla-austral|s
micromesistius poutassou|n-f-bacaladilla|s
micropogonias furnieri|n-f-corvinon-amarillo|s
micropterus salmoides|n-f-perca-americana|s
microstomus kitt|n-f-mendo-limon|s
microstomus pacificus|n-f-solla-del-pacifico|s
microvegetal|n-v-microvegetal|c
microvegetales|n-v-microvegetal|c
middle 10 ribs unece 304072|n-gpc-centro-de-canal-10-costillas|c
middle 11 ribs unece 304071|n-gpc-centro-de-canal-11-costillas|c
middle 12 ribs unece 304070|n-gpc-centro-de-canal-12-costillas|c
middle 13 ribs unece 304069|n-gpc-centro-de-canal-13-costillas|c
middle boneless from 10 ribs unece 304322|n-gpc-centro-de-canal-deshuesado-de-10-c|c
middle boneless from 11 ribs unece 304321|n-gpc-centro-de-canal-deshuesado-de-11-c|c
middle boneless from 12 ribs unece 304320|n-gpc-centro-de-canal-deshuesado-de-12-c|c
middle boneless from 13 ribs unece 304319|n-gpc-centro-de-canal-deshuesado-de-13-c|c
miel|n-d-miel|a
mielga|n-f-lija|o
mielga|n-f-mielga|o
mierspenaeopsis hardwickii|n-f-gamba|s
mierspenaeopsis sculptilis|n-f-langostino-tigre-arco-iris|s
miichthys miiuy|n-f-corvina-asiatica|s
military rations|n-gpc-racion-de-campana|a
milk|n-l-leche|a
milk frozen|n-l-leche|a
milk perishable|n-l-leche|a
milk shelf stable|n-l-leche|a
milk substitutes|n-gpc-bebida-vegetal|a
milk substitutes frozen|n-gpc-bebida-vegetal|a
milk substitutes perishable|n-gpc-bebida-vegetal|a
milk substitutes shelf stable|n-gpc-bebida-vegetal|a
milk/butter/cream/yogurts/cheese/eggs/substitutes variety packs|n-gpc-surtidos-de-lacteos-y-huevos|a
milk/milk substitutes|n-milk|a
milka|n-gpc-milka|c
milwa|n-gpc-milwa|c
mimachlamys crassicostata|n-f-peine-de-china|s
mimachlamys varia|n-f-zamburina|s
minneiska|n-gpc-minneiska|c
minnella|n-gpc-minnella|c
minneola y otros tangelos|n-gpc-minneola-y-otros-tangelos|a
minneolas and other tangelos|n-gpc-minneola-y-otros-tangelos|a
minnewasta|n-gpc-minnewasta|c
mint|n-gpc-menta|a
mirabelles|n-gpc-ciruela-mirabel|a
miracielo|n-f-miracielo|o
miracorvina angolensis|n-f-corvina-de-angola|s
miscellaneous fruit|n-gpc-otras-frutas|a
mitad delantera de pollo|n-gpc-mitad-delantera-de-pollo|a
mitad delantera de pollo sin alas|n-gpc-mitad-delantera-de-pollo-sin-alas|a
mitad trasera de pavo|n-gpc-mitad-trasera-de-pavo|a
mitad trasera de pavo sin rabadilla|n-gpc-mitad-trasera-de-pavo-sin-rabadill|a
mitad trasera de pollo|n-gpc-mitad-trasera-de-pollo|a
mitad trasera de pollo sin rabadilla|n-gpc-mitad-trasera-de-pollo-sin-rabadil|a
mitchgla|n-gpc-mitchgla|c
mixed fat spreads|n-gpc-crema-de-grasas-mixtas|a
mixed fat spreads frozen|n-gpc-crema-de-grasas-mixtas|a
mixed fat spreads perishable|n-gpc-crema-de-grasas-mixtas|a
mixed fat spreads shelf stable|n-gpc-crema-de-grasas-mixtas|a
mixed species meat|n-gpc-carne-de-varias-especies|a
mixed species meat unprepared/unprocessed|n-gpc-carne-de-varias-especies|a
mixed species meat/poultry/other animal alternative meat|n-gpc-carne-mixta-de-especies-alternativ|a
mixed species meat/poultry/other animal alternative meat prepared/processed|n-gpc-carne-mixta-de-especies-alternativ|a
mixed species sausages|n-gpc-embutido-de-varias-especies|a
mixed species sausages prepared/processed|n-gpc-embutido-de-varias-especies|a
mizuhopecten yessoensis|n-f-vieira-japonesa|s
mizuna|n-gpc-mizuna|a
mobula mobular|n-f-manta|s
mobula tarapacana|n-f-manta-cornuda|s
modi|n-gpc-modi|c
mojarra|n-f-mojarra|o
molinara|n-gpc-molinara|c
molleja|n-c-mollejas|a
mollejas|n-c-mollejas|a
mollejas|n-meat|c
mollejas|n-beef|c
mollejas de pavo abiertas en mariposa|n-gpc-mollejas-de-pavo-abiertas-en-marip|a
mollejas de pavo elaboradas|n-gpc-mollejas-de-pavo-elaboradas|a
mollejas de pavo semielaboradas|n-gpc-mollejas-de-pavo-semielaboradas|a
mollejas de pollo abiertas en mariposa|n-gpc-mollejas-de-pollo-abiertas-en-mari|a
mollejas de pollo de corte en v|n-gpc-mollejas-de-pollo-de-corte-en-v|a
mollejas de pollo de corte mecanico|n-gpc-mollejas-de-pollo-de-corte-mecanic|a
molva dypterygia|n-f-maruca-azul|s
molva macrophthalma|n-f-maruca-espanola|s
molva molva|n-f-maruca|s
monastrell|n-gpc-monastrell|a
moneu|n-gpc-moneu|c
monica|n-gpc-monica|c
monidel|n-gpc-monidel|c
monochirus hispidus|n-f-lenguado-velludo|s
monomia haani|n-f-cangrejo-mandarin|s
montefalco|n-gpc-montefalco|c
montepulciano|n-gpc-montepulciano|c
monterey jack|n-gpc-queso-monterey-jack|c
moonglo|n-gpc-moonglo|c
moonlight|n-gpc-moonlight|c
moose/elk|n-gpc-alce|a
moose/elk prepared/processed|n-gpc-alce|a
moose/elk unprepared/unprocessed|n-gpc-alce|a
mora|n-f-mora|o
mora moro|n-f-mora|s
mora roja|n-f-falsa-brotola|o
moranella de gunter|n-f-moranella-de-gunter|o
moranella roja|n-f-moranella-roja|o
moras|n-f-mora|c
morcilla|n-morcilla|a
morcilla ahumada|n-m-morcilla-asturiana|a
morcilla asturiana|n-m-morcilla-asturiana|a
morcilla burgos|n-m-morcilla-de-burgos|a
morcilla de arroz|n-morcilla|a
morcilla de burgos|n-m-morcilla-de-burgos|a
morcilla de cebolla|n-morcilla|a
morcilla de leon|n-m-morcilla-de-leon|a
morcilla leon|n-m-morcilla-de-leon|a
morcillo|n-b-morcillo|a
morcillo de cordero|n-o-jarrete-de-cordero|a
morcillo trasero|n-gpc-morcillo-trasero|a
morcillo trasero deshuesado|n-gpc-morcillo-trasero-deshuesado|a
morcon|n-morcon|a
morels|n-gpc-colmenilla|a
morena|n-f-morena|o
morena papuda|n-f-papuda|o
morenocio denton|n-f-morenocio-denton|o
moreto|n-gpc-moreto|c
morgenduft|n-gpc-morgenduft|c
morillon|n-gpc-morillon|c
morio muskat|n-gpc-morio-muskat|c
morone saxatilis|n-f-lubina-rayada|s
morragute|n-f-morragute|o
morro|n-beef|c
morro de cerdo|n-p-careta|a
morruncho|n-f-morruncho|o
mortadela|n-mortadela|a
mortadela con aceituna|n-mortadela|a
mortadela siciliana|n-mortadela|a
moscas|n-gpc-moscas|a
moscatel|n-gpc-moscatel|c
moscatel blanco|n-gpc-moscatel-blanco|a
moscatel de alejandria|n-gpc-moscatel-de-alejandria|a
moscatella|n-gpc-moscatella|c
moscato|n-gpc-moscato|c
moschomavro|n-gpc-moschomavro|c
moschoudi|n-gpc-moschoudi|c
moskato spina|n-gpc-moskato-spina|c
moskofilero|n-gpc-moskofilero|c
mostaza|n-d-salsa|a
mostaza china|n-gpc-mostaza-china|a
mostaza negra|n-gpc-mostaza-negra|a
mother mutterapfel|n-gpc-mother-mutterapfel|c
mourvedre mataro/monastrell|n-gpc-monastrell|c
mourvedre/grenache/syrah|n-gpc-mourvedre-grenache-syrah|c
mourvedre/syrah|n-gpc-mourvedre-syrah|c
mousse de pato|n-pate|a
mozzarella|n-q-queso-mozzarella|a
mozzarella de bufala|n-q-burrata|a
mramornaja|n-gpc-mramornaja|c
mtsvane|n-gpc-mtsvane|c
mueller thurgau riesling silvaner|n-gpc-mueller-thurgau-riesling-silvaner|c
mueller thurgau/chasselas|n-gpc-mueller-thurgau-chasselas|c
mueller thurgau/kerner|n-gpc-mueller-thurgau-kerner|c
mueller thurgau/morillon|n-gpc-mueller-thurgau-morillon|c
mueller thurgau/pinot noir|n-gpc-mueller-thurgau-pinot-noir|c
mueller thurgau/sylvaner|n-gpc-mueller-thurgau-sylvaner|c
muenster|n-gpc-queso-munster|c
muergo|n-f-muergo|o
muesli|n-d-cereal-de-desayuno|a
mugil|n-f-mugil|o
mugil cephalus|n-f-mugil|s
mugwort|n-gpc-artemisa|a
mujol|n-f-mujol|c
mujuretuli|n-gpc-mujuretuli|c
mulinia edulis|n-f-almeja-reina|s
mullus barbatus|n-f-salmonete-de-fango|s
mullus surmuletus|n-f-salmonete-de-roca|s
mumes|n-gpc-ciruela-mume|a
munida rugosa|n-f-xinxa|s
muraena augusti|n-f-morena|s
muraena helena|n-f-morena|s
muraenesox cinereus|n-f-morenocio-denton|s
murion|n-f-murion|o
muscadelle|n-gpc-muscadelle|c
muscardin|n-gpc-muscardin|c
muscaris|n-gpc-muscaris|c
muscat|n-gpc-muscat|c
muscat bailey a|n-gpc-muscat-bailey-a|c
muscat blanc|n-gpc-moscatel-blanco|c
muscat du moulin|n-gpc-muscat-du-moulin|c
muscat of alexandria|n-gpc-moscatel-de-alejandria|c
muscat of spina|n-gpc-muscat-of-spina|c
muscat oliver|n-gpc-muscat-oliver|c
muscat ottonel|n-gpc-muscat-ottonel|c
muscat/gewuerztraminer|n-gpc-muscat-gewuerztraminer|c
musgo de corcega|n-f-musgo-de-corcega|o
musgo de irlanda|n-f-musgo-de-irlanda|o
musgo de mar|n-f-musgo-estrellado|o
musgo estrellado|n-f-musgo-estrellado|o
muskateller|n-gpc-muskateller|c
muslitos|n-f-pescado|c
muslitos cong|n-f-pescado|c
muslo de pato|n-a-muslo-de-pato|a
muslo de pavo|n-a-contramuslo-de-pavo|a
muslo de pollo|n-a-muslo-de-pollo|a
musola|n-f-musola|o
musola de manchas negras|n-f-musola-de-manchas-negras|o
musola dentuda|n-f-musola-dentuda|o
musola segadora|n-f-musola-segadora|o
mustafabey|n-gpc-mustafabey|c
mustard|n-d-salsa|a
mustard frozen|n-d-salsa|a
mustard perishable|n-d-salsa|a
mustard shelf stable|n-d-salsa|a
mustela|n-f-mustela|o
mustelus asterias|n-f-musola-dentuda|s
mustelus lunulatus|n-f-musola-segadora|s
mustelus mustelus|n-f-musola|s
mustelus punctulatus|n-f-musola-de-manchas-negras|s
mustoasa|n-gpc-mustoasa|c
mutsu crispin mutsu nk|n-gpc-mutsu-crispin-mutsu-nk|c
mutton|n-gpc-oveja|a
mutton prepared/processed|n-gpc-oveja|a
mutton unprepared/unprocessed|n-gpc-oveja|a
mya arenaria|n-f-almeja-de-concha-blanda|s
mycella|n-gpc-queso-mycella|c
mycteroperca fusca|n-f-abade|s
mycteroperca rubra|n-f-gitano|s
mycteroperca xenarcha|n-f-abade-jaspeado|s
myliobatis aquila|n-f-aguila-marina|s
mystus cavasius|n-f-bagra-del-ganges|s
mytilus chilensis|n-f-mejillon-de-chile|s
mytilus edulis|n-f-mejillon|s
mytilus galloprovincialis|n-f-mejillon|s
myzopsetta ferruginea|n-f-limanda-amarilla|s
nabo|n-v-nabo|c
nabo de mayo|n-gpc-nabo-de-mayo|a
nabo de teltow|n-gpc-nabo-de-teltow|a
nabo similares|n-v-nabo|c
nabo similares|n-v-nabo-similares|c
nabos|n-v-nabo|c
najdared|n-gpc-najdared|c
najdazd|n-gpc-najdazd|c
name|n-gpc-name|a
name mapuey|n-gpc-name-mapuey|a
name o yame|n-v-name-o-yame|c
nandu|n-gpc-nandu|a
naranja|n-v-naranja|c
naranja grano de oro|n-v-naranja|c
naranja grano de oro|n-v-naranja-grano-de-oro|c
naranja importacion|n-v-naranja|c
naranja lane late|n-v-naranja|c
naranja lane late|n-v-naranja-lane-late|c
naranja navel late|n-v-naranja|c
naranja navel late|n-v-naranja-navel-late|c
naranja navel late sudafr|n-v-naranja|c
naranja navel late sudafr|n-v-naranja-navel-late-sudafr|c
naranja navel powel|n-v-naranja|c
naranja navel powel|n-v-naranja-navel-powel|c
naranja navel sudafrica|n-v-naranja|c
naranja navel sudafrica|n-v-naranja-navel-sudafrica|c
naranja navelina|n-v-naranja|c
naranja navelina|n-v-naranja-navelina|c
naranja salustiana|n-v-naranja|c
naranja salustiana|n-v-naranja-salustiana|c
naranja sanguina|n-v-naranja|c
naranja sanguina|n-v-naranja-sanguina|c
naranja val late argent|n-v-naranja|c
naranja val late argent|n-v-naranja-val-late-argent|c
naranja val late sudafr|n-v-naranja|c
naranja val late sudafr|n-v-naranja-val-late-sudafr|c
naranja valencia late|n-v-naranja|c
naranja valencia late|n-v-naranja-valencia-late|c
naranjas|n-v-naranja|c
naranjas navel|n-v-naranja|c
naranjas navel|n-v-naranjas-navel|c
naranjilla/lulo|n-gpc-lulo|a
narince|n-gpc-narince|c
nascetta|n-gpc-nascetta|c
nashi|n-v-nashi|c
nashi amarillo|n-v-nashi|c
nashi amarillo|n-v-nashi-amarillo|c
nashi oscuro|n-v-nashi|c
nashi oscuro|n-v-nashi-oscuro|c
nata|n-l-nata|a
nata cong|n-l-nata|c
nata liquida|n-l-nata|a
nata para montar|n-l-nata|a
natali gala|n-gpc-natali-gala|c
naticarius hebraeus|n-f-caracol-luna|s
natillas|n-l-postre-lacteo|a
natural casings|n-casing|a
naucrates ductor|n-f-pez-piloto|s
navaja|n-f-muergo|o
navaja|n-f-navaja|o
navaja|n-f-navaja-americana|o
navaja|n-f-navaja-macha|o
navaja|n-f-navaja-recta|o
navaja americana|n-f-navaja-americana|o
navaja europea atlantica|n-f-muergo|c
navaja macha|n-f-navaja-macha|o
navaja recta|n-f-navaja-recta|o
navajas|n-f-muergo|c
navajuela|n-f-navajuela|o
navajuela del pacifico|n-f-navajuela|o
nebbiolo|n-gpc-nebbiolo|c
nebris occidentalis|n-f-guabina|s
neck|n-gpc-pescuezo-de-vacuno|c
neck boneless|n-gpc-pescuezo-de-vacuno-deshuesado|c
neck skin unece 712306|n-gpc-piel-de-cuello-de-pavo|c
neck unece 405020|n-gpc-cuello-de-cordero-deshuesado|c
neck unece 505020|n-gpc-cuello-de-cabrito|c
neck unece 701601|n-gpc-cuello-de-pollo|c
neck unece 711601|n-gpc-cuello-de-pavo|c
necora|n-f-necora|o
necora cocida|n-f-necora|c
necora cocida grande 8 12 cong|n-f-necora|c
necora cocida median12 25 cong|n-f-necora|c
necora grande 8 12|n-f-necora|c
necora median12 25|n-f-necora|c
necora nudosa|n-f-necora-nudosa|o
necora puber|n-f-necora|s
necoras|n-f-necora|c
necoras cocidas extra 5 7 cong|n-f-necora|c
necoras cong|n-f-necora|c
necoras de importacion|n-f-necora|c
necoras extra 5 7|n-f-necora|c
necoras gallegas|n-f-necora|c
nectar|n-d-zumo|a
nectarina|n-v-nectarina|c
nectarina carne amarilla|n-v-nectarina|c
nectarina carne amarilla|n-v-nectarina-carne-amarilla|c
nectarina carne blanca|n-v-nectarina|c
nectarina carne blanca|n-v-nectarina-carne-blanca|c
nectarina carne roja|n-v-nectarina|c
nectarina carne roja|n-v-nectarina-carne-roja|c
nectarina importacion|n-v-nectarina|c
nectarina nacional|n-v-nectarina|c
nectarina pulpa amarilla|n-v-nectarina|c
nectarina pulpa blanca|n-v-nectarina|c
nectarinas|n-v-nectarina|c
nectarines|n-v-nectarina|a
negrara|n-gpc-negrara|c
negretto|n-gpc-negretto|c
negrito|n-f-negrito|o
negroamaro|n-gpc-negroamaro|c
negroamaro/malvasia nera|n-gpc-negroamaro-malvasia-nera|c
negroamaro/malvasianera/sangiovese|n-gpc-negroamaro-malvasianera-sangiovese|c
negroamaro/montepulciano|n-gpc-negroamaro-montepulciano|c
negroamaro/sangiovese/malvasia nera|n-gpc-negroamaro-sangiovese-malvasia-ner|c
nemadactylus macropterus|n-f-pintadilla|s
nemalion elminthoides|n-f-espagueti-de-mar|s
nemipterus japonicus|n-f-baga-japonesa|s
neosalanx tangkahkeii|n-f-chanquete-chino|s
nephrops norvegicus|n-f-cigala|s
nephropsis stewarti|n-f-cigala-del-indico|s
nerello cappuccio|n-gpc-nerello-cappuccio|c
nerello mascalese|n-gpc-nerello-mascalese|c
nero d avola|n-gpc-nero-d-avola|c
nero d avola/cabernet sauvignon|n-gpc-nero-d-avola-cabernet-sauvignon|c
nero d avola/merlot/cabernet sauvignon|n-gpc-nero-d-avola-merlot-cabernet-sauvi|c
nero d avola/syrah|n-gpc-nero-d-avola-syrah|c
nero di troia|n-gpc-nero-di-troia|c
nerophis ophidion|n-f-alfiler|s
netted muskmelons|n-gpc-melon-cantalupo|a
neuburger|n-gpc-neuburger|c
neufchatel|n-gpc-queso-neufchatel|c
new jonagold|n-gpc-new-jonagold|c
new zealand spinach|n-gpc-espinaca-de-nueva-zelanda|a
newton wonder|n-gpc-newton-wonder|c
niagara|n-gpc-niagara|c
nicogreen|n-gpc-nicogreen|c
nicoter|n-gpc-nicoter|c
nido de golondrina|n-gpc-nido-de-golondrina|a
nispero|n-v-nispero|c
nispero algerie o argelin|n-v-nispero|c
nispero algerie o argelin|n-v-nispero-algerie-o-argelin|c
nispero japones|n-gpc-nispero-japones|a
nispero tanaka|n-v-nispero|c
nispero tanaka|n-v-nispero-tanaka|c
nisperos|n-v-nispero|c
nobling|n-gpc-nobling|c
non alcoholic beverages not ready to drink|n-gpc-bebidas-sin-alcohol|a
non alcoholic beverages ready to drink|n-gpc-bebidas-sin-alcohol|a
non alcoholic beverages variety packs|n-gpc-surtidos-de-bebidas-sin-alcohol|a
non alcoholic beverages variety packs not ready to drink|n-gpc-surtidos-de-bebidas-sin-alcohol|a
non alcoholic beverages variety packs ready to drink|n-gpc-surtidos-de-bebidas-sin-alcohol|a
non grape fermented alcoholic beverages sparkling|n-gpc-fermentado-espumoso|a
non grape fermented alcoholic beverages still|n-gpc-fermentado|a
non netted cantaloupe melons|n-gpc-melon-cantalupo-liso|a
noordhollandse suikerpeer|n-gpc-noordhollandse-suikerpeer|c
nopal|n-gpc-nopal|a
noriega|n-f-noriega|o
noris|n-gpc-noris|c
normanda|n-gpc-normanda|c
northern spy|n-gpc-northern-spy|c
nosiola|n-gpc-nosiola|c
notarisappel|n-gpc-notarisappel|c
nototenia|n-f-marujito|o
nototenia coluda|n-f-marujito|o
nototodarus sloanii|n-f-pota-neozelandesa|s
nouveau poiteau|n-gpc-nouveau-poiteau|c
nuece|n-v-nuece|c
nueces|n-v-nuece|c
nueces de california|n-v-nuece|c
nueces de california|n-v-nueces-de-california|c
nueces de francia|n-v-nuece|c
nueces de francia|n-v-nueces-de-francia|c
nueva europa|n-gpc-nueva-europa|c
nueva orleans|n-gpc-nueva-orleans|c
nuez|n-d-fruto-seco|a
nuez de chile|n-v-nuece|c
nuez de chile|n-v-nuez-de-chile|c
nuts/seeds|n-d-fruto-seco|a
nuts/seeds prepared/processed|n-d-fruto-seco|a
nuts/seeds prepared/processed in shell|n-d-fruto-seco|a
nuts/seeds prepared/processed out of shell|n-d-fruto-seco|a
nuts/seeds unprepared/unprocessed in shell|n-gpc-frutos-secos-con-cascara|a
nuts/seeds unprepared/unprocessed in shell|n-d-fruto-seco|a
nuts/seeds unprepared/unprocessed perishable|n-gpc-frutos-secos-frescos|a
nuts/seeds unprepared/unprocessed perishable|n-d-fruto-seco|a
oakleaf lettuce|n-v-lechuga|a
obaideh|n-gpc-obaideh|c
obeidy|n-gpc-obeidy|c
obelisk|n-gpc-obelisk|c
obispo|n-f-obispo|o
oblada|n-f-oblada|o
oblada melanurus|n-f-oblada|s
oblada o doblada|n-f-oblada|c
obrogala|n-gpc-obrogala|c
oca|n-gpc-oca|a
ochavo|n-f-ochavo|o
ocra|n-v-ocra|c
octopus cyanea|n-f-pulpo-azulon|s
octopus djinda|n-f-pulpo-de-roca-occidental|s
octopus maya|n-f-pulpo-maya|s
octopus mimus|n-f-pulpo-burlon|s
octopus vulgaris|n-octopus|s
ocyurus chrysurus|n-f-rabirrubia|s
odin|n-gpc-odin|c
odontaspis ferox|n-f-solrayo|s
odontesthes regia|n-f-pejerrey|s
oedalechilus labeo|n-f-caluga|s
oils edible|n-gpc-aceites-comestibles|a
oils edible vegetable or plant|n-gpc-aceite-vegetal|a
oils edible vegetable or plant perishable|n-gpc-aceite-vegetal|a
oils edible vegetable or plant shelf stable|n-gpc-aceite-vegetal|a
oils/fats edible variety packs|n-gpc-surtidos-de-aceites-y-grasas|a
ojo de bife|n-b-lomo-alto|a
ojo de piedra|n-f-ojo-de-piedra|o
ojoverde u ojiverde|n-f-ojoverde-u-ojiverde|o
okra|n-gpc-okra|a
okra china|n-gpc-okra-china|a
okra chinese|n-gpc-okra-china|a
oksana|n-gpc-oksana|c
okuzgozu|n-gpc-okuzgozu|c
olaszrizling|n-gpc-olaszrizling|c
olayo atlantico|n-f-olayo-atlantico|o
oliva refinado|n-d-aceite-de-oliva-suave|a
oliva virgen|n-d-aceite-de-oliva-virgen|a
oliva virgen extra|n-d-aceite-de-oliva-virgen-extra|a
olivas|n-d-aceituna|a
olives|n-d-aceituna|a
olives perishable|n-d-aceituna|a
olives shelf stable|n-d-aceituna|a
ommastrephes bartramii|n-f-pota-saltadora|s
ommastrephes caroli|n-f-pota-saltadora|s
ompok bimaculatus|n-f-bagre-blanco|s
oncorhynchus gorbuscha|n-f-salmon|s
oncorhynchus keta|n-f-salmon|s
oncorhynchus kisutch|n-f-salmon|s
oncorhynchus mykiss|n-f-trucha-arco-iris|s
oncorhynchus nerka|n-f-salmon|s
oncorhynchus tshawytscha|n-f-salmon|s
onions|n-v-cebolla|a
ontario|n-gpc-ontario|c
opal variety|n-gpc-opal-variety|c
ophichthus remiger|n-f-anago|s
opisthonema libertate|n-f-sardineta-del-pacifico|s
optima|n-gpc-optima|c
optima/ortega|n-gpc-optima-ortega|c
orange blossom food garnish|n-gpc-azahar|a
orangelo|n-gpc-orangelo|a
orangelos|n-gpc-orangelo|a
oranges|n-v-naranja|a
orcynopsis unicolor|n-f-tasarte|s
oregano|n-d-especia|a
oregano griego|n-gpc-oregano-griego|a
oregon|n-gpc-oregon|c
oreja de cerdo|n-p-oreja-de-cerdo|a
oreja de mar|n-f-oreja-de-mar|o
orejas|n-p-oreja-de-cerdo|a
oreo negro|n-f-oreo-negro|o
oreochromis mossambicus|n-f-tilapia-de-mozambique|s
oreochromis niloticus|n-f-tilapia|s
organza|n-gpc-organza|c
orion|n-gpc-orion|c
orleans reinette|n-gpc-orleans-reinette|c
orlik|n-gpc-orlik|c
orlovskoje polosatoje|n-gpc-orlovskoje-polosatoje|c
ortega|n-gpc-ortega|c
ortega/mueller thurgau|n-gpc-ortega-mueller-thurgau|c
ortiguilla|n-f-ortiguilla|o
ortrugo|n-gpc-ortrugo|c
orujo de oliva|n-d-aceite-de-orujo-de-oliva|a
orvieto|n-gpc-orvieto|c
oseleta|n-gpc-oseleta|c
osmerus eperlanus|n-f-eperlano|s
osmerus mordax|n-f-eperlano|s
osmundea pinnatifida|n-f-alga-pimentera|s
osobuco|n-b-morcillo|a
ossau iraty|n-gpc-queso-ossau-iraty|c
ossobuco|n-b-morcillo|a
ostiones|n-f-ostion|c
ostra|n-f-ostra|o
ostra extra|n-f-ostra|c
ostra flor|n-f-ostra|c
ostra gigante|n-f-ostra|c
ostra rizada|n-f-ostra-rizada|o
ostra super|n-f-ostra|c
ostra virginica u ostra americana|n-f-ostra-virginica-u-ostra-americana|o
ostras|n-f-ostra|c
ostrea edulis|n-f-ostra|s
ostrea stentina|n-f-morruncho|s
ostrich|n-g-avestruz|a
ostrich prepared/processed|n-g-avestruz|a
ostrich unprepared/unprocessed|n-g-avestruz|a
otago|n-gpc-otago|c
otava|n-gpc-otava|c
other melons|n-v-melon|a
other sauces dipping/condiments/savoury toppings/savoury spreads/marinades|n-gpc-salsas-y-adobos|a
other sauces dipping/condiments/savoury toppings/savoury spreads/marinades frozen|n-gpc-salsas-y-adobos|a
other sauces dipping/condiments/savoury toppings/savoury spreads/marinades perishable|n-gpc-salsas-y-adobos|a
other sauces dipping/condiments/savoury toppings/savoury spreads/marinades shelf stable|n-gpc-salsas-y-adobos|a
other vegetables|n-gpc-otras-verduras|a
otolithes ruber|n-f-corvina-tigre|s
otolithoides biauritus|n-f-corvina-bronce|s
otra fruta de iv gama|n-gpc-otra-fruta-de-iv-gama|a
otra verdura de iv gama|n-gpc-otra-verdura-de-iv-gama|a
otros ahumados y salazones|n-f-salazon|c
otros pescados|n-f-pescado|c
otros pescados planos|n-f-pescado|c
otros pescados varios|n-f-pescado|c
otros prod varios semicons|n-d-vario|c
otros y salazones|n-f-salazon|c
outside shoulder banjo cut unece 404995|n-gpc-paletilla-de-cordero-cara-externa-|c
outside shoulder oyster cut boneless unece 405055|n-gpc-paletilla-de-cordero-cara-externa--3|c
outside shoulder oyster cut unece 404980|n-gpc-paletilla-de-cordero-cara-externa--2|c
outside shoulder pair unece 404976|n-gpc-par-de-paletillas-de-cordero-cara-|c
outside unece 505075|n-gpc-contra-de-cabrito|c
ovatum|n-f-ovatum|o
oveja|n-gpc-oveja|a
ovino|n-meat|c
ovino canal|n-meat|c
ovino casqueria|n-o-casqueria-de-cordero|a
ovino cong sin especif|n-meat|c
ovino conserva|n-meat|c
ovino despiece|n-meat|c
ovino despiece cong|n-meat|c
ovino despojo|n-meat|c
ovino elaborado|n-meat|c
ovino fresco sin especif|n-meat|c
ovino precocinado|n-meat|c
ovoproducto|n-gpc-ovoproducto|a
oxynotus centrina|n-f-cerdo-marino|s
oxynotus paradoxus|n-f-cerdo-marino|s
oyster mushrooms|n-gpc-seta-de-ostra|a
ozark gold|n-gpc-ozark-gold|c
pachygrapsus marmoratus|n-f-juyon|s
pacifastacus leniusculus|n-f-cangrejo-de-california|s
packaged water flavoured|n-gpc-agua-con-sabor|a
packaged water unflavoured|n-gpc-agua-envasada|a
packham s triumph|n-gpc-packham-s-triumph|c
pacu|n-f-pacu|o
padeiro|n-gpc-padeiro|c
padina pavonica|n-f-cola-de-pavo|s
pagellus acarne|n-f-aligote|s
pagellus affinis|n-f-besugo-arabe|s
pagellus bellottii|n-f-breca-chata|s
pagellus bogaraveo|n-f-besugo|s
pagellus erythrinus|n-f-breca|s
pagrus auriga|n-f-urta|s
pagrus caeruleostictus|n-f-pargo-de-puntos-azules|s
pagrus major|n-f-pargo-rosado|s
pagrus pagrus|n-f-pargo|s
pagurus bernhardus|n-f-cangrejo-ermitano-comun|s
pailona|n-f-pailona|o
pais|n-gpc-pais|c
pak choi|n-v-pak-choi|c
palaemon elegans|n-f-camaron-de-poza|s
palaemon serratus|n-f-camaron|s
palaemon varians|n-f-camaron|s
palava|n-gpc-palava|c
paleta|n-shoulder-ham|a
paleta cocida|n-cooked-shoulder|a
paleta curada|n-shoulder-ham|a
paleta de cerdo|n-p-paletilla-de-cerdo|a
paleta iberica|n-m-paleta-iberica|a
paleta serrana|n-m-paleta-serrana|a
paletilla|n-o-paletilla-de-cordero|a
paletilla cara externa|n-gpc-paletilla-cara-externa|a
paletilla cara externa despiezada en 3|n-gpc-paletilla-cara-externa-despiezada-|a
paletilla cara interna 1 costilla|n-gpc-paletilla-cara-interna-1-costilla|a
paletilla cara interna 2 costillas|n-gpc-paletilla-cara-interna-2-costillas|a
paletilla cara interna 3 costillas|n-gpc-paletilla-cara-interna-3-costillas|a
paletilla cara interna 4 costillas|n-gpc-paletilla-cara-interna-4-costillas|a
paletilla cara interna deshuesada|n-gpc-paletilla-cara-interna-deshuesada|a
paletilla cojin|n-gpc-paletilla-cojin|a
paletilla con panceta|n-gpc-paletilla-con-panceta|a
paletilla curada|n-shoulder-ham|a
paletilla de cabrito cara externa en corte ostra|n-gpc-paletilla-de-cabrito-cara-externa--2|a
paletilla de cabrito cara externa en corte ostra deshuesada|n-gpc-paletilla-de-cabrito-cara-externa-|a
paletilla de cabrito cortada a escuadra 4 costillas|n-gpc-paletilla-de-cabrito-cortada-a-esc|a
paletilla de cabrito cortada a escuadra 5 costillas|n-gpc-paletilla-de-cabrito-cortada-a-esc-2|a
paletilla de cabrito cortada a escuadra 6 costillas|n-gpc-paletilla-de-cabrito-cortada-a-esc-3|a
paletilla de cerdo|n-p-paletilla-de-cerdo|a
paletilla de cerdo cortada a escuadra 1 costilla|n-gpc-paletilla-de-cerdo-cortada-a-escua|a
paletilla de cerdo cortada a escuadra 2 costillas|n-gpc-paletilla-de-cerdo-cortada-a-escua-2|a
paletilla de cerdo cortada a escuadra 3 costillas|n-gpc-paletilla-de-cerdo-cortada-a-escua-3|a
paletilla de cerdo cortada a escuadra 4 costillas|n-gpc-paletilla-de-cerdo-cortada-a-escua-4|a
paletilla de conejo|n-g-paletilla-de-conejo|a
paletilla de cordero|n-o-paletilla-de-cordero|a
paletilla de cordero cara externa en corte banjo|n-gpc-paletilla-de-cordero-cara-externa-|a
paletilla de cordero cara externa en corte ostra|n-gpc-paletilla-de-cordero-cara-externa--2|a
paletilla de cordero cara externa en corte ostra deshuesada|n-gpc-paletilla-de-cordero-cara-externa--3|a
paletilla de cordero con brazuelo 4 costillas|n-gpc-paletilla-de-cordero-con-brazuelo-|a
paletilla de cordero con brazuelo 5 costillas|n-gpc-paletilla-de-cordero-con-brazuelo--2|a
paletilla de cordero con brazuelo 6 costillas|n-gpc-paletilla-de-cordero-con-brazuelo--3|a
paletilla de cordero con espaldilla 4 costillas|n-gpc-paletilla-de-cordero-con-espaldill|a
paletilla de cordero con espaldilla 5 costillas|n-gpc-paletilla-de-cordero-con-espaldill-2|a
paletilla de cordero con espaldilla 6 costillas|n-gpc-paletilla-de-cordero-con-espaldill-3|a
paletilla de cordero cortada a escuadra 4 costillas|n-gpc-paletilla-de-cordero-cortada-a-esc|a
paletilla de cordero cortada a escuadra 5 costillas|n-gpc-paletilla-de-cordero-cortada-a-esc-2|a
paletilla de cordero cortada a escuadra 6 costillas|n-gpc-paletilla-de-cordero-cortada-a-esc-3|a
paletilla de cordero cortada a escuadra deshuesada 4 costillas|n-gpc-paletilla-de-cordero-cortada-a-esc-4|a
paletilla de cordero cortada a escuadra deshuesada 5 costillas|n-gpc-paletilla-de-cordero-cortada-a-esc-5|a
paletilla de cordero cortada a escuadra deshuesada 6 costillas|n-gpc-paletilla-de-cordero-cortada-a-esc-6|a
paletilla de ternera|n-b-espaldilla|a
paletilla iberica|n-m-paleta-iberica|a
paletilla mitad inferior 1 costilla|n-gpc-paletilla-mitad-inferior-1-costill|a
paletilla mitad inferior 2 costillas|n-gpc-paletilla-mitad-inferior-2-costill|a
paletilla mitad inferior 3 costillas|n-gpc-paletilla-mitad-inferior-3-costill|a
paletilla mitad inferior 4 costillas|n-gpc-paletilla-mitad-inferior-4-costill|a
paletilla mitad inferior 5 costillas|n-gpc-paletilla-mitad-inferior-5-costill|a
paletilla mitad inferior 6 costillas|n-gpc-paletilla-mitad-inferior-6-costill|a
paletilla mitad superior 1 costilla|n-gpc-paletilla-mitad-superior-1-costill|a
paletilla mitad superior 2 costillas|n-gpc-paletilla-mitad-superior-2-costill|a
paletilla mitad superior 3 costillas|n-gpc-paletilla-mitad-superior-3-costill|a
paletilla mitad superior 4 costillas|n-gpc-paletilla-mitad-superior-4-costill|a
paletilla mitad superior deshuesada|n-gpc-paletilla-mitad-superior-deshuesad|a
paletilla pectoral|n-gpc-paletilla-pectoral|a
palinurus delagoae|n-f-langosta-del-natal|s
palinurus elephas|n-f-langosta|s
palinurus mauritanicus|n-f-langosta-mora|s
palitos de merluza|n-hake|c
palitos de merluza cong|n-f-pescado|c
palitos salados|n-gpc-palitos-salados|a
palm hearts|n-gpc-palmito|a
palmaria palmata|n-f-dulse|s
palmito|n-gpc-palmito|a
palometa|n-f-japuta|o
palometa ahumada|n-f-japuta|c
palometa austral|n-f-palometa-austral|o
palometa blanca|n-f-palometa-blanca|o
palometa de quilla|n-f-palometa-de-quilla|o
palometa japuta|n-f-japuta|c
palometa o japuta|n-f-japuta|c
palometa o japuta cong|n-f-japuta|c
palometa o japuta entera|n-f-japuta|c
palometa o japuta entera cong|n-f-japuta|c
palometa o japuta o v|n-f-japuta|c
palometa oriental|n-f-palometa-oriental|o
palometa parona|n-f-parona|o
palometa plateada|n-f-palometa-plateada|o
palometa roja|n-f-palometa-roja|o
palometa roja|n-f-japuta|c
palometon|n-f-palometon|o
palomino|n-gpc-palomino|c
palomino fino|n-gpc-palomino-fino|c
palomitas|n-gpc-palomitas|a
pampanito|n-f-pampanito|o
pampano|n-f-pampano|o
pampano mediano|n-f-pampano-mediano|o
pampus argenteus|n-f-palometa-plateada|s
pan|n-d-pan|a
pan|n-bakery|a
pan cong|n-d-pan|c
pan congelado|n-d-pan|a
pan de azucar|n-gpc-pan-de-azucar|a
pan envasado|n-d-pan|a
pan rallado|n-d-pan-rallado|a
pan tostado|n-d-biscote|a
panaderia|n-bakery|a
panaderia y bolleria|n-bakery|a
panceta|n-p-panceta|a
panceta adobada|n-panceta-curada|a
panceta con falda|n-gpc-panceta-con-falda|a
panceta curada|n-panceta-curada|a
panceta de cerdo 10 costillas|n-gpc-panceta-de-cerdo-10-costillas|a
panceta de cerdo 11 costillas|n-gpc-panceta-de-cerdo-11-costillas|a
panceta de cerdo 12 costillas|n-gpc-panceta-de-cerdo-12-costillas|a
panceta de cerdo 13 costillas|n-gpc-panceta-de-cerdo-13-costillas|a
panceta deshuesada de 10 costillas|n-gpc-panceta-deshuesada-de-10-costillas|a
panceta deshuesada de 11 costillas|n-gpc-panceta-deshuesada-de-11-costillas|a
panceta deshuesada de 12 costillas|n-gpc-panceta-deshuesada-de-12-costillas|a
panceta deshuesada de 13 costillas|n-gpc-panceta-deshuesada-de-13-costillas|a
panceta fresca|n-p-panceta|a
panchito con piel|n-d-fruto-seco|c
panchito con piel|n-v-panchito-con-piel|c
panchito sin piel|n-d-fruto-seco|c
panchito sin piel|n-v-panchito-sin-piel|c
panchos|n-f-pancho|c
pandalus borealis|n-f-camaron-boreal|s
pandalus platyceros|n-f-camaron-moteado|s
pandalus spp|n-f-camaron|s
panga|n-f-panga|o
panga cong|n-f-panga|c
panga filete|n-f-panga|c
panga filete cong|n-f-panga|c
panga fresca|n-f-panga|c
pangasianodon hypophthalmus|n-f-panga|s
panulirus argus|n-f-langosta-del-caribe|s
panulirus cygnus|n-f-langosta-australiana|s
panulirus echinatus|n-f-langosta-herrena|s
panulirus gracilis|n-f-langosta-barbona|s
panulirus laevicauda|n-f-langosta-verde|s
panulirus regius|n-f-langosta-real|s
papada|n-p-papada|a
papada adobada|n-papada-curada|a
papada curada|n-papada-curada|a
papada de cerdo|n-p-papada|a
papada de cerdo|n-gpc-papada-de-cerdo|a
papalo|n-gpc-papaloquelite|a
papaloquelite|n-gpc-papaloquelite|a
paparda|n-f-paparda|o
papaskarasi|n-gpc-papaskarasi|c
papaya|n-gpc-papaya|a
papaya gigante|n-v-papaya-gigante|c
papaya grupo solo o sunri|n-v-papaya-gigante|c
papaya grupo solo o sunri|n-v-papaya-grupo-solo-o-sunri|c
papaya o v|n-v-papayo|c
papayas|n-gpc-papaya|a
papayas fresh cut|n-gpc-papaya|a
papayo|n-v-papayo|c
papayos|n-v-papayo|c
papel|n-x-papel|a
papel de estraza|n-x-papel|a
papel film|n-x-film|a
papel parafinado|n-x-papel|a
paphies donacina|n-f-tellina-tuatua|s
papuda|n-f-papuda|o
par de costillares de paletilla de cabrito 4 costillas|n-gpc-par-de-costillares-de-paletilla-de|a
par de costillares de paletilla de cabrito 5 costillas|n-gpc-par-de-costillares-de-paletilla-de-2|a
par de costillares de paletilla de cordero 4 costillas|n-gpc-par-de-costillares-de-paletilla-de-3|a
par de costillares de paletilla de cordero 5 costillas|n-gpc-par-de-costillares-de-paletilla-de-4|a
par de cuartos delanteros de cordero 3 costillas|n-gpc-par-de-cuartos-delanteros-de-corde|a
par de cuartos delanteros de cordero 4 costillas|n-gpc-par-de-cuartos-delanteros-de-corde-2|a
par de cuartos delanteros de cordero 5 costillas|n-gpc-par-de-cuartos-delanteros-de-corde-3|a
par de cuartos delanteros de cordero 6 costillas|n-gpc-par-de-cuartos-delanteros-de-corde-4|a
par de paletillas de cordero cara externa|n-gpc-par-de-paletillas-de-cordero-cara-|a
par de piernas de cabrito con silla|n-gpc-par-de-piernas-de-cabrito-con-sill-2|a
par de piernas de cabrito con silla de lomo|n-gpc-par-de-piernas-de-cabrito-con-sill|a
par de piernas de cordero|n-gpc-par-de-piernas-de-cordero|a
par de piernas de cordero con silla 10 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-8|a
par de piernas de cordero con silla 11 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-9|a
par de piernas de cordero con silla 12 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-10|a
par de piernas de cordero con silla 13 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-11|a
par de piernas de cordero con silla 7 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-12|a
par de piernas de cordero con silla 8 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-13|a
par de piernas de cordero con silla 9 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-14|a
par de piernas de cordero con silla de lomo 1 costilla|n-gpc-par-de-piernas-de-cordero-con-sill-2|a
par de piernas de cordero con silla de lomo 2 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-3|a
par de piernas de cordero con silla de lomo 3 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-4|a
par de piernas de cordero con silla de lomo 4 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-5|a
par de piernas de cordero con silla de lomo 5 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-6|a
par de piernas de cordero con silla de lomo 6 costillas|n-gpc-par-de-piernas-de-cordero-con-sill-7|a
par de piernas de cordero con silla de lomo sin costillas|n-gpc-par-de-piernas-de-cordero-con-sill|a
par de rinonadas de cordero 1 costilla|n-gpc-par-de-rinonadas-de-cordero-1-cost|a
par de rinonadas de cordero 2 costillas|n-gpc-par-de-rinonadas-de-cordero-2-cost|a
par de rinonadas de cordero 3 costillas|n-gpc-par-de-rinonadas-de-cordero-3-cost|a
par de rinonadas de cordero sin costillas|n-gpc-par-de-rinonadas-de-cordero-sin-co|a
paracentrotus lividus|n-f-erizo-de-mar|s
parachondrostoma toxostoma|n-f-madrilla|s
paraguaya|n-v-paraguaya|c
paraguayas|n-v-paraguaya|c
paraguayo|n-v-paraguaya|a
paraguayo o platereta|n-v-paraguaya|c
paraguayo o platereta|n-v-paraguayo-o-platereta|c
paraguayo ufo 4|n-v-paraguaya|c
paraguayo ufo 4|n-v-paraguayo-ufo-4|c
paralichthys brasiliensis|n-f-halibut-carioca|s
paralichthys isosceles|n-f-halibut-tropical|s
paralichthys olivaceus|n-f-halibut-del-japon|s
paralichthys patagonicus|n-f-halibut-patagon|s
paralithodes camtschaticus|n-f-cangrejo-boreal|s
paralithodes platypus|n-f-cangrejo-real-azul|s
paralomis granulosa|n-f-centollon-antartico|s
paralomis longipes|n-f-centolla-peruana|s
paramonacanthus choirocephalus|n-f-pez-ballesta-australiano|s
paranthias furcifer|n-f-rabirrubia-canela|s
parapasiphae sulcatifrons|n-f-camaron-rojo|s
parapenaeopsis stylifera|n-f-gamba|s
parapenaeus longirostris|n-f-gamba|s
parapristipoma octolineatum|n-f-boca-de-oro|s
parastichopus regalis|n-f-espardena|s
parastichopus tremulus|n-f-cohombro-rojo|s
paratapes undulatus|n-clam|s
parchita|n-v-parchita|c
parchita o f de la pas o|n-v-parchita|c
parchita o f de la pas o|n-v-parchita-o-f-de-la-pas-o|c
parchita/f de la p morada|n-v-parchita|c
parchita/f de la p morada|n-v-parchita-f-de-la-p-morada|c
parchitas|n-v-parchita|c
pardina|n-d-lenteja-pardina|a
parellada|n-gpc-parellada|c
parellada/xarel lo/macabeo/chardonnay|n-gpc-parellada-xarel-lo-macabeo-chardon|c
pargo|n-f-pargo|o
pargo cong|n-f-pargo|c
pargo coral|n-f-luciano|o
pargo criollo|n-f-pargo-criollo|o
pargo de la mancha|n-f-pargo-de-la-mancha|o
pargo de puntos azules|n-f-pargo-de-puntos-azules|o
pargo gris|n-f-pargo-gris|o
pargo marron africano|n-f-pargo-marron-africano|o
pargo peruano|n-f-pargo-peruano|o
pargo rojo|n-f-pargo-rojo|o
pargo rosado|n-f-pargo-rosado|o
parmesan|n-gpc-queso-parmesano-rallado|c
parmesano|n-q-queso-parmesano|a
paromola cuvieri|n-f-centolla-de-fondo|s
parona|n-f-parona|o
parona signata|n-f-parona|s
parsley root hamburg|n-gpc-raiz-de-perejil|a
parsnips|n-v-chirivia|a
partially boneless split breast with rib meat and 1st wing segment unece 700705|n-gpc-media-pechuga-de-pollo-semideshues|c
partially processed gizzards unece 711903|n-gpc-mollejas-de-pavo-semielaboradas|c
parupeneus heptacantha|n-f-salmonete-cinabrio|s
pasiphaea multidentata|n-f-camaron-cristal|s
pasiphaea sivado|n-f-camaron-blanco|s
passe crassane|n-gpc-passe-crassane|c
passionfruits|n-fruit|a
passionfruits fresh cut|n-fruit|a
pasta|n-d-pasta|a
pasta cong|n-d-pasta|c
pasta y harinas|n-flour|a
pasta/noodles|n-d-pasta|a
pasta/noodles not ready to eat frozen|n-d-pasta|a
pasta/noodles not ready to eat perishable|n-d-pasta|a
pasta/noodles not ready to eat shelf stable|n-d-pasta|a
pasta/noodles ready to eat perishable|n-d-pasta|a
pasta/noodles ready to eat shelf stable|n-d-pasta|a
pasta/noodles variety packs|n-gpc-surtidos-de-pasta|a
pastas|n-flour|a
pastas alimenticias|n-d-pasta|a
pastel|n-gpc-pastel|a
pasteleria|n-d-bolleria|a
pasteleria dulce|n-gpc-pasteleria-dulce|a
pastinaca negra|n-f-pastinaca-negra|o
pastinaca violeta|n-f-raya-latigo|o
pata negra|n-m-jamon-iberico|a
patagonotothen ramsayi|n-f-marujito|s
patas|n-beef|c
patas de pollo elaboradas|n-gpc-patas-de-pollo-elaboradas|a
patas o pechos cangrejo|n-f-patas-o-pechos-cangrejo|c
patas o pechos cangrejo cong|n-f-patas-o-pechos-cangrejo|c
patata|n-v-patata|c
patata agata|n-v-patata-agata|c
patata agata confeccionad|n-v-patata|c
patata agata confeccionad|n-v-patata-agata-confeccionad|c
patata agata granel|n-v-patata|c
patata agata granel|n-v-patata-agata|c
patata agria|n-v-patata-agria|c
patata agria confeccionad|n-v-patata|c
patata agria confeccionad|n-v-patata-agria-confeccionad|c
patata agria granel|n-v-patata|c
patata agria granel|n-v-patata-agria|c
patata baraka|n-v-patata|c
patata baraka|n-v-patata-baraka|c
patata bintje|n-v-patata-bintje|c
patata bintje confecciona|n-v-patata|c
patata bintje confecciona|n-v-patata-bintje-confecciona|c
patata bintje granel|n-v-patata|c
patata bintje granel|n-v-patata-bintje|c
patata bintje importacion|n-v-patata|c
patata bintje importacion|n-v-patata-bintje|c
patata blanca|n-v-patata|c
patata blanca|n-v-patata-blanca|c
patata blanca calidad mona lisa|n-v-patata|c
patata bonita color conf|n-v-patata|c
patata bonita color conf|n-v-patata-bonita-color-conf|c
patata bonita colorada gr|n-v-patata|c
patata bonita colorada gr|n-v-patata-bonita-colorada-gr|c
patata bonita eur|n-v-patata-bonita-eur|c
patata bonita eur granel|n-v-patata|c
patata bonita eur granel|n-v-patata-bonita-eur|c
patata bonita europ conf|n-v-patata|c
patata bonita europ conf|n-v-patata-bonita-europ-conf|c
patata bonita negra confe|n-v-patata|c
patata bonita negra confe|n-v-patata-bonita-negra-confe|c
patata bonita negra grane|n-v-patata|c
patata bonita negra grane|n-v-patata-bonita-negra-grane|c
patata caesar|n-v-patata-caesar|c
patata caesar confecciona|n-v-patata|c
patata caesar confecciona|n-v-patata-caesar-confecciona|c
patata caesar granel|n-v-patata|c
patata caesar granel|n-v-patata-caesar|c
patata claustar|n-v-patata-claustar|c
patata claustar confeccio|n-v-patata|c
patata claustar confeccio|n-v-patata-claustar-confeccio|c
patata claustar granel|n-v-patata|c
patata claustar granel|n-v-patata-claustar|c
patata desiree|n-v-patata|c
patata desiree|n-v-patata-desiree|c
patata egipto|n-v-patata|c
patata egipto|n-v-patata-egipto|c
patata europa|n-v-patata-europa|c
patata europa confecciona|n-v-patata|c
patata europa confecciona|n-v-patata-europa-confecciona|c
patata europa granel|n-v-patata|c
patata europa granel|n-v-patata-europa|c
patata francesa|n-v-patata|c
patata francesa|n-v-patata-francesa|c
patata jaerla|n-v-patata-jaerla|c
patata jaerla confecciona|n-v-patata|c
patata jaerla confecciona|n-v-patata-jaerla-confecciona|c
patata jaerla granel|n-v-patata|c
patata jaerla granel|n-v-patata-jaerla|c
patata kenebek|n-v-patata|c
patata kenebek|n-v-patata-kenebek|c
patata liseta|n-v-patata-liseta|c
patata liseta confecciona|n-v-patata|c
patata liseta confecciona|n-v-patata-liseta-confecciona|c
patata liseta granel|n-v-patata|c
patata liseta granel|n-v-patata-liseta|c
patata marabel|n-v-patata-marabel|c
patata marabel confeccion|n-v-patata|c
patata marabel confeccion|n-v-patata-marabel-confeccion|c
patata marabel granel|n-v-patata|c
patata marabel granel|n-v-patata-marabel|c
patata marruecos|n-v-patata|c
patata marruecos|n-v-patata-marruecos|c
patata mona lisa|n-v-patata-mona-lisa|c
patata mona lisa confecci|n-v-patata|c
patata mona lisa confecci|n-v-patata-mona-lisa|c
patata mona lisa granel|n-v-patata|c
patata mona lisa granel|n-v-patata-mona-lisa|c
patata negra yema huevo c|n-v-patata|c
patata negra yema huevo c|n-v-patata-negra-yema-huevo-c|c
patata negra yema huevo g|n-v-patata|c
patata negra yema huevo g|n-v-patata-negra-yema-huevo-g|c
patata nueva|n-v-patata|c
patata nueva|n-v-patata-nueva|c
patata red pontiac|n-v-patata-red-pontiac|c
patata red pontiac confec|n-v-patata|c
patata red pontiac confec|n-v-patata-red-pontiac|c
patata red pontiac granel|n-v-patata|c
patata red pontiac granel|n-v-patata-red-pontiac|c
patata roja|n-v-patata|c
patata roja|n-v-patata-roja|c
patata spunta|n-v-patata|c
patata spunta|n-v-patata-spunta|c
patata spunta confecciona|n-v-patata|c
patata spunta confecciona|n-v-patata-spunta-confecciona|c
patata spunta hol|n-v-patata-spunta-hol|c
patata spunta hol granel|n-v-patata|c
patata spunta hol granel|n-v-patata-spunta-hol|c
patata temprana|n-v-patata|c
patata turbo|n-v-patata-turbo|c
patata turbo confeccionad|n-v-patata|c
patata turbo confeccionad|n-v-patata-turbo-confeccionad|c
patata turbo granel|n-v-patata|c
patata turbo granel|n-v-patata-turbo|c
patata vieja|n-v-patata|c
patata vieja|n-v-patata-vieja|c
patatas|n-v-patata|c
patatas fritas|n-d-aperitivo|a
patatas fritas cong|n-d-aperitivo|c
patatas fritas y aperitivos|n-gpc-patatas-fritas-y-aperitivos|a
pate|n-pate|a
pate de higado|n-pate|a
pate frozen|n-pate|a
pate perishable|n-pate|a
pate shelf stable|n-pate|a
patella rustica|n-f-lapa-punteada|s
patella tenuis|n-f-lapa-negra|s
patella ulyssiponensis|n-f-lapa-aspera|s
patella vulgata|n-f-lapa|s
patelo|n-f-patelo|o
pato|n-a-pato|a
patudo|n-f-patudo|o
patudo del atlantico|n-f-patudo|o
paula red|n-gpc-paula-red|c
pavia|n-v-pavia|c
pavias|n-v-pavia|c
pavo|n-turkey|a
pavo entero|n-a-pavo|a
pavo entero|n-gpc-pavo-entero|a
pavo entero sin menudillos|n-gpc-pavo-entero-sin-menudillos|a
pavo fresco|n-a-pavo|a
peaches|n-v-melocoton|a
pears|n-v-pera|a
peas|n-v-guisante|a
peas with pods|n-gpc-guisantes-con-vaina|a
peas with pods fresh cut|n-gpc-guisantes-con-vaina|a
peces de rio|n-f-peces-de-rio|c
peceto|n-b-redondo|a
pecho 10 costillas|n-gpc-pecho-10-costillas|a
pecho 11 costillas|n-gpc-pecho-11-costillas|a
pecho 12 costillas|n-gpc-pecho-12-costillas|a
pecho 13 costillas|n-gpc-pecho-13-costillas|a
pecho con plato de costillar|n-gpc-pecho-con-plato-de-costillar|a
pecho de cordero con falda|n-gpc-pecho-de-cordero-con-falda|a
pecho de cordero con falda deshuesado|n-gpc-pecho-de-cordero-con-falda-deshues|a
pecho deshuesado 10 costillas|n-gpc-pecho-deshuesado-10-costillas|a
pecho deshuesado 11 costillas|n-gpc-pecho-deshuesado-11-costillas|a
pecho deshuesado 12 costillas|n-gpc-pecho-deshuesado-12-costillas|a
pecho deshuesado 13 costillas|n-gpc-pecho-deshuesado-13-costillas|a
pecho plato de falda|n-gpc-pecho-plato-de-falda|a
pecho sin tapa 10 costillas|n-gpc-pecho-sin-tapa-10-costillas|a
pecho sin tapa 11 costillas|n-gpc-pecho-sin-tapa-11-costillas|a
pecho sin tapa 12 costillas|n-gpc-pecho-sin-tapa-12-costillas|a
pecho sin tapa 13 costillas|n-gpc-pecho-sin-tapa-13-costillas|a
pechuga de pavo|n-a-pechuga-de-pavo|a
pechuga de pavo fiambre|n-turkey-cold|a
pechuga de pollo|n-a-pechuga-de-pollo|a
pechuga entera|n-a-pechuga-de-pollo|a
pechuga entera de pavo con costillas y alas sin espalda|n-gpc-pechuga-entera-de-pavo-con-costill-3|a
pechuga entera de pavo con costillas y carne deshuesada del primer segmento de ala sin espalda|n-gpc-pechuga-entera-de-pavo-con-costill|a
pechuga entera de pavo con costillas y primeros segmentos de ala sin espalda|n-gpc-pechuga-entera-de-pavo-con-costill-2|a
pechuga entera de pavo con espalda costillas y alas|n-gpc-pechuga-entera-de-pavo-con-espalda|a
pechuga entera de pavo con espalda costillas y carne deshuesada del primer segmento de ala|n-gpc-pechuga-entera-de-pavo-con-espalda-2|a
pechuga entera de pavo con espalda costillas y primer segmento de ala|n-gpc-pechuga-entera-de-pavo-con-espalda-3|a
pechuga entera de pavo con hueso espalda y costillas|n-gpc-pechuga-entera-de-pavo-con-hueso-e|a
pechuga entera de pavo con hueso y costillas sin espalda|n-gpc-pechuga-entera-de-pavo-con-hueso-y-2|a
pechuga entera de pavo con hueso y solomillos sin espalda ni costillas|n-gpc-pechuga-entera-de-pavo-con-hueso-y|a
pechuga entera de pavo deshuesada limpia de espalda costillas y solomillos|n-gpc-pechuga-entera-de-pavo-deshuesada-|a
pechuga entera de pollo con costillas y solomillos|n-gpc-pechuga-entera-de-pollo-con-costil|a
pechuga entera de pollo con hueso costillas y alas|n-gpc-pechuga-entera-de-pollo-con-hueso-|a
pechuga entera de pollo deshuesada con carne de costilla sin solomillos|n-gpc-pechuga-entera-de-pollo-deshuesada|a
pechuga entera de pollo deshuesada con solomillos|n-gpc-pechuga-entera-de-pollo-deshuesada-2|a
pechuga entera de pollo deshuesada sin solomillos|n-gpc-pechuga-entera-de-pollo-deshuesada-3|a
pechuga pavo|n-a-pechuga-de-pavo|a
pecorino|n-q-queso-pecorino|a
pecten jacobaeus|n-f-vieira|s
pecten maximus|n-f-vieira|s
pederna|n-gpc-pederna|c
pedral|n-gpc-pedral|c
pedro ximenez|n-gpc-pedro-ximenez|c
pedrosillano|n-d-garbanzo-pedrosillano|a
pegusa cadenati|n-f-lenguado-de-guinea|s
pegusa impar|n-f-lenguado-del-adriatico|s
pegusa lascaris|n-f-lenguado-de-arena|s
pegusa triophthalma|n-f-lenguado-tres-monedas|s
peine de china|n-f-peine-de-china|o
peje camello|n-f-peje-camello|o
peje obispo|n-f-peje-obispo|o
peje trompeta|n-f-peje-trompeta|o
peje verde|n-f-peje-verde|o
pejeperro|n-f-pejeperro|o
pejepuerco oceanico|n-f-pejepuerco-oceanico|o
pejerrey|n-f-abichon|o
pejerrey|n-f-chucleto|o
pejerrey|n-f-pejerrey|o
pejerrey chileno|n-f-pejerrey|o
pelaverga|n-gpc-pelaverga|c
pelaya|n-f-pelaya|c
pelaya cong|n-f-pelaya|c
pelotretis flavilatus|n-f-lenguado-limon-austral|s
peltorhamphus novaezeelandiae|n-f-lenguado-de-nueva-zelanda|s
peluda|n-f-peluda|o
peluda imperial|n-f-peluda-imperial|o
peludilla|n-f-peludilla|o
pelvetia canaliculata|n-f-canaliculada|s
penaeopsis serrata|n-f-gamba|s
penaeus aztecus|n-f-langostino|s
penaeus brasiliensis|n-f-langostino|s
penaeus brevirostris|n-f-langostino-cristal|s
penaeus canaliculatus|n-f-langostino-tigre|s
penaeus duorarum|n-f-langostino-rosado|s
penaeus esculentus|n-f-langostino-tigre-marron|s
penaeus indicus|n-f-langostino-banana|s
penaeus japonicus|n-f-langostino-tigre|s
penaeus kerathurus|n-f-langostino-mediterraneo|s
penaeus latisulcatus|n-f-langostino-marfil|s
penaeus monodon|n-f-langostino-jumbo|s
penaeus notialis|n-f-langostino-blanco|s
penaeus semisulcatus|n-f-langostino-banana|s
penaeus subtilis|n-f-langostino|s
penaeus vannamei|n-f-langostino-vannamei|s
pennahia argentata|n-f-corvinata-plateada|s
pentanemus quinquarius|n-f-barbudo-real|s
peon|n-f-polido|o
pepicha|n-gpc-pepicha|a
pepinillo|n-d-encurtido|a
pepino|n-v-pepino|c
pepino alpicoz|n-v-pepino|c
pepino alpicoz|n-v-pepino-alpicoz|c
pepino armenio|n-gpc-pepino-armenio|a
pepino corto tipo espanol|n-v-pepino|c
pepino corto tipo espanol|n-v-pepino-corto-tipo-espanol|c
pepino de mar|n-f-cohombro-rojo|o
pepino largo tipo holand|n-v-pepino|c
pepino largo tipo holand|n-v-pepino-largo-tipo-holand|c
pepino retorcido|n-gpc-pepino-retorcido|a
pepinos|n-v-pepino|c
pepper variety packs|n-gpc-surtidos-de-pimiento|a
peppers|n-v-pimiento|a
peppers fresh cut|n-v-pimiento|a
peprilus medius|n-f-pampano-mediano|s
pera|n-v-pera|c
pera bartlet/ red bartlet|n-v-pera|c
pera bartlet/ red bartlet|n-v-pera-bartlet-red-bartlet|c
pera blanquilla|n-v-pera|c
pera de invierno|n-v-pera|c
pera de verano|n-v-pera|c
pera etrusca|n-v-pera|c
pera etrusca|n-v-pera-etrusca|c
pera general leclerc|n-v-pera|c
pera general leclerc|n-v-pera-general-leclerc|c
pera magallon|n-v-pera|c
pera magallon|n-v-pera-magallon|c
pera nashi|n-v-nashi|a
pera otras variedades|n-v-pera|c
pera packam|n-v-pera|c
pera packam|n-v-pera-packam|c
pera passa crassana c e e|n-v-pera|c
pera passa crassana c e e|n-v-pera-passa-crassana-c-e-e|c
pera temprana|n-v-pera|c
pera ya|n-gpc-pera-ya|a
peras|n-v-pera|c
peras blanquillas|n-v-pera|c
peras blanquillas|n-v-peras-blanquillas|c
peras castell o sanjuaner|n-v-pera|c
peras castell o sanjuaner|n-v-peras-castell-o-sanjuaner|c
peras conference|n-v-pera|c
peras conference|n-v-peras-conference|c
peras de roma|n-v-pera|c
peras de roma|n-v-peras-de-roma|c
peras doyan de comice|n-v-pera|c
peras doyan de comice|n-v-peras-doyan-de-comice|c
peras ercolini|n-v-pera|c
peras ercolini|n-v-peras-ercolini|c
peras limoneras|n-v-pera|c
peras limoneras|n-v-peras-limoneras|c
peras moratini|n-v-pera|c
peras moratini|n-v-peras-moratini|c
peras passa crassana|n-v-pera|c
peras passa crassana|n-v-peras-passa-crassana|c
perca|n-f-perca|c
perca americana|n-f-perca-americana|o
perca cong|n-f-perca|c
perca de mar|n-f-perca-de-mar|o
perca de mar argentina|n-f-perca-de-mar-argentina|o
perca del nilo|n-f-perca-del-nilo|o
perca filete|n-f-perca|c
perca gigante|n-f-perca-gigante|o
perca koi|n-f-perca-koi|o
perca o tilapia|n-f-perca|c
percebe|n-f-percebe|o
percebe canadiense|n-f-percebe-canadiense|o
percebe congelado cong|n-f-percebe|c
percebe del pacifico|n-f-percebe-del-pacifico|o
percebe importacion|n-f-percebe|c
percebe nacional|n-f-percebe|c
percnon gibbesi|n-f-arana-plana|s
perdices|n-a-perdiz|a
perdiz|n-a-perdiz|a
peregrino|n-f-peregrino|o
perejil|n-parsley|a
perejil liso|n-gpc-perejil-liso|a
perejil rizado|n-gpc-perejil-rizado|a
perera|n-gpc-perera|c
pereta|n-v-pereta|c
peretas|n-v-pereta|c
perfumeria|n-d-perfumeria|c
perfumeria|n-ambient|a
perico|n-gpc-perico|c
perifollo|n-gpc-perifollo|a
perifollo oloroso|n-gpc-perifollo-oloroso|a
perifollo tuberoso|n-gpc-perifollo-tuberoso|a
peristedion cataphractum|n-f-armado|s
perita de san juan|n-gpc-perita-de-san-juan|c
perla|n-f-perla|c
perle|n-gpc-perle|c
perlon|n-f-perlon|o
perlones|n-f-perlon|c
perna canaliculus|n-f-mejillon-de-nueva-zelanda|s
perna perna|n-f-mejillon-del-pacifico|s
pernil|n-ham|a
pernil fresco|n-p-jamon-fresco|a
pero|n-v-pero|c
pero de cirio|n-gpc-pero-de-cirio|c
perola|n-gpc-perola|c
peros|n-v-pero|c
perricone|n-gpc-perricone|c
perro chico|n-f-perro-chico|o
perro del norte|n-f-perro-del-norte|o
perros|n-f-perro|c
perrum|n-gpc-perrum|c
persimmon|n-v-caqui|a
persimmon fresh cut|n-v-caqui|a
pescad fina brillo 0 2 k|n-f-pescadilla|c
pescad fina g sol 0 2 k|n-f-pescadilla|c
pescada|n-f-pescada|c
pescada cong|n-f-pescada|c
pescaderia|n-fish|a
pescadilla|n-f-pescadilla|c
pescadilla 500 1000 gr|n-f-pescadilla|c
pescadilla 500 gr|n-f-pescadilla|c
pescadilla americana|n-f-merluza-americana|o
pescadilla argentina|n-f-merluza-argentina|o
pescadilla austral|n-f-merluza-austral|o
pescadilla blanca alg 1 k|n-f-pescadilla|c
pescadilla cong|n-f-pescadilla|c
pescadilla de altura|n-f-merluza-del-cabo|o
pescadilla de angola|n-f-merluza-negra|o
pescadilla de chile|n-f-merluza-austral|o
pescadilla de cola|n-f-merluza-de-cola|o
pescadilla de cola azul|n-f-merluza-de-cola|o
pescadilla del cabo|n-f-merluza-del-cabo|o
pescadilla del pacifico|n-f-merluza-del-pacifico|o
pescadilla del peru|n-f-merluza-del-peru|o
pescadilla del senegal|n-f-merluza-negra|o
pescadilla europea|n-hake|o
pescadilla filete|n-f-pescadilla|c
pescadilla filete cong|n-f-pescadilla|c
pescadilla g sol de|n-f-pescadilla|c
pescadilla g sol de +1 kg|n-f-pescadilla|c
pescadilla gayi|n-f-merluza-del-peru|o
pescadilla h 0 250 k|n-f-pescadilla|c
pescadilla hasta 0 5k|n-f-pescadilla|c
pescadilla hasta 0 8k|n-f-pescadilla|c
pescadilla hasta 1 5k|n-f-pescadilla|c
pescadilla hoki|n-f-merluza-de-cola|o
pescadilla n 0 h 0 250 k cong|n-f-pescadilla|c
pescadilla n 0/1/2|n-f-pescadilla|c
pescadilla n 1 hasta 0 5k cong|n-f-pescadilla|c
pescadilla n 2 hasta 0 8k cong|n-f-pescadilla|c
pescadilla n 3 hasta 1 5k cong|n-f-pescadilla|c
pescadilla negra|n-f-merluza-negra|o
pescadilla negra 0 2 a 1k|n-f-pescadilla|c
pescadilla negra carioca|n-f-pescadilla|c
pescadilla negra pelona|n-f-pescadilla|c
pescadilla o p|n-f-pescadilla|c
pescadilla o p cong|n-f-pescadilla|c
pescadilla pincho|n-f-pescadilla|c
pescadilla pincho +1 kg|n-f-pescadilla|c
pescadilla pincho del dia|n-f-pescadilla|c
pescadilla plateada|n-f-merluza-americana|o
pescadilla popul 0 2/0 8k|n-f-pescadilla|c
pescadilla sudamericana|n-f-merluza-argentina|o
pescadilla surena|n-f-merluza-austral|o
pescadilla tripa 0 2/0 3k|n-f-pescadilla|c
pescado|n-gpc-pescado|a
pescado|n-fish|a
pescado azul|n-bluefish|a
pescado blanco|n-whitefish|a
pescado de crianza|n-farmed|a
pescado y marisco|n-fish|a
pescados|n-f-pescado|c
pescados|n-fish|a
pescados ahumados cong|n-f-pescado|c
pescados precocinados|n-f-pescado|c
pescados precocinados cong|n-f-pescado|c
pescuezo|n-b-pescuezo|a
pescuezo de cordero|n-o-cuello-de-cordero|a
pescuezo de vacuno|n-gpc-pescuezo-de-vacuno|a
pescuezo de vacuno deshuesado|n-gpc-pescuezo-de-vacuno-deshuesado|a
petador|n-sausage-cured|a
petit courbu|n-gpc-petit-courbu|c
petit manseng|n-gpc-petit-manseng|c
petit meslier|n-gpc-petit-meslier|c
petit munster|n-gpc-queso-petit-munster|c
petit verdot|n-gpc-petit-verdot|c
petite arvine|n-gpc-petite-arvine|c
petite arvine/pinot gris/muscat|n-gpc-petite-arvine-pinot-gris-muscat|c
petite meslier|n-gpc-petite-meslier|c
petite pearl|n-gpc-petite-pearl|c
peto|n-f-peto|o
petromyzon marinus|n-f-lamprea|s
pez|n-b-pez|a
pez ballesta|n-f-pez-ballesta|o
pez ballesta australiano|n-f-pez-ballesta-australiano|o
pez ballesta chino|n-f-pez-ballesta-chino|o
pez ballesta rugoso|n-f-pez-ballesta-rugoso|o
pez cinta|n-f-pez-cinta|o
pez cinto|n-f-pez-cinto|o
pez conejo|n-f-pez-conejo|o
pez de limon|n-f-pez-de-limon|o
pez de san pedro|n-f-pez-de-san-pedro|o
pez diablo|n-f-pez-diablo|o
pez espada|n-f-pez-espada|o
pez espada cong|n-f-pez-espada|c
pez espada/emperador|n-b-pez|c
pez gallo de nueva zelanda|n-f-pez-gallo-de-nueva-zelanda|o
pez gato|n-f-pez-gato|o
pez guitarra|n-f-pez-guitarra|o
pez hielo|n-f-pez-hielo|o
pez hielo rayado|n-f-pez-hielo-rayado|o
pez linterna|n-f-pez-linterna|o
pez lobo|n-f-pez-lobo|o
pez loro de guinea|n-f-pez-loro-de-guinea|o
pez mantequilla|n-f-escolar|o
pez mantequilla|n-f-escolar-negro|o
pez mariposa|n-f-pez-mariposa|o
pez piloto|n-f-pez-piloto|o
pez pluma|n-f-pez-pluma|o
pez rata|n-f-pez-conejo|o
pez reina|n-f-pez-reina|o
pez rubi|n-f-pez-rubi|o
pez sable|n-f-pez-sable|o
pez sable savalai|n-f-pez-sable-savalai|o
pez sapo|n-f-pez-sapo|o
pez serpiente rayado|n-f-pez-serpiente-rayado|o
pez unicornio|n-f-pez-unicornio|o
pez vela|n-f-pez-vela|o
pez vela del atlantico|n-f-pez-vela-del-atlantico|o
pez volador|n-f-pez-volador|o
pez zorro|n-f-pez-zorro|o
pez zorro negro|n-f-pez-zorro-negro|o
pfirsichroter sommerapfel|n-gpc-pfirsichroter-sommerapfel|c
pheasant|n-gpc-faisan|a
pheasant prepared/processed|n-gpc-faisan|a
pheasant unprepared/unprocessed|n-gpc-faisan|a
philadelphia|n-q-queso-crema|a
phorcus atratus|n-f-burgado-hembra|s
phorcus sauciatus|n-f-burgado-iberico|s
phycis blennoides|n-f-brotola-de-fango|s
phycis chesteri|n-f-brosmio-artico|s
phycis phycis|n-f-brotola-de-roca|s
phyllariopsis brevipes|n-f-hoja-de-col-marina|s
phymatolithon calcareum|n-f-alga-de-cal|s
physalis|n-gpc-physalis|a
piaractus mesopotamicus|n-f-pacu|s
picada de cerdo|n-p-carne-picada-de-cerdo|a
picada de ternera|n-b-carne-picada|a
picana|n-b-cadera|a
picardan|n-gpc-picardan|c
piceno|n-gpc-piceno|c
pichon|n-gpc-pichon|a
pickled vegetables|n-d-encurtido|a
pickles/relishes/chutneys/olives|n-gpc-encurtidos-chutneys-y-aceitunas|a
pickles/relishes/chutneys/olives variety packs|n-gpc-surtidos-de-encurtidos-y-aceitunas|a
picolit|n-gpc-picolit|c
picon|n-f-picon|o
picos|n-d-picos|a
picos camperos|n-d-picos|a
picotener|n-gpc-picotener|c
picpoul picpoul de pinet|n-gpc-picpoul-picpoul-de-pinet|c
picuca|n-f-picuca|o
picuda barracuda|n-f-picuda-barracuda|o
piedirosso|n-gpc-piedirosso|c
piel de contramuslo y jamoncito de pavo|n-gpc-piel-de-contramuslo-y-jamoncito-de-2|a
piel de contramuslo y jamoncito de pollo|n-gpc-piel-de-contramuslo-y-jamoncito-de|a
piel de cuello de pavo|n-gpc-piel-de-cuello-de-pavo|a
piel de pavo|n-gpc-piel-de-pavo|a
piel de pechuga de pavo|n-gpc-piel-de-pechuga-de-pavo|a
piel de pechuga de pavo troquelada|n-gpc-piel-de-pechuga-de-pavo-troquelada|a
piel de pechuga de pavo troquelada y desgrasada|n-gpc-piel-de-pechuga-de-pavo-troquelada-2|a
piel de pechuga de pollo|n-gpc-piel-de-pechuga-de-pollo|a
piel de pollo|n-gpc-piel-de-pollo|a
pierna|n-o-pierna-de-cordero|a
pierna de cabrito con rinonada|n-gpc-pierna-de-cabrito-con-rinonada|a
pierna de cabrito con rinonada deshuesada|n-gpc-pierna-de-cabrito-con-rinonada-des|a
pierna de cabrito con rinonada sin jarrete|n-gpc-pierna-de-cabrito-con-rinonada-sin|a
pierna de cabrito de trinchado facil|n-gpc-pierna-de-cabrito-de-trinchado-fac|a
pierna de cabrito parte baja|n-gpc-pierna-de-cabrito-parte-baja|a
pierna de cabrito sin rinonada|n-gpc-pierna-de-cabrito-sin-rinonada|a
pierna de cerdo|n-p-jamon-fresco|a
pierna de cordero|n-o-pierna-de-cordero|a
pierna de cordero babilla|n-gpc-pierna-de-cordero-babilla|a
pierna de cordero con jarrete sin rinonada ni hueso de cadera|n-gpc-pierna-de-cordero-con-jarrete-sin-|a
pierna de cordero con rinonada|n-gpc-pierna-de-cordero-con-rinonada|a
pierna de cordero con rinonada deshuesada|n-gpc-pierna-de-cordero-con-rinonada-des|a
pierna de cordero con rinonada sin jarrete|n-gpc-pierna-de-cordero-con-rinonada-sin|a
pierna de cordero con rinonada sin jarrete deshuesada|n-gpc-pierna-de-cordero-con-rinonada-sin-3|a
pierna de cordero con rinonada sin jarrete ni hueso de cadera|n-gpc-pierna-de-cordero-con-rinonada-sin-2|a
pierna de cordero con rinonada y jarrete sin hueso de cadera|n-gpc-pierna-de-cordero-con-rinonada-y-j|a
pierna de cordero contra|n-gpc-pierna-de-cordero-contra|a
pierna de cordero culata de contra|n-gpc-pierna-de-cordero-culata-de-contra|a
pierna de cordero de trinchado facil|n-gpc-pierna-de-cordero-de-trinchado-fac|a
pierna de cordero parte del filete|n-gpc-pierna-de-cordero-parte-del-filete|a
pierna de cordero parte del jarrete|n-gpc-pierna-de-cordero-parte-del-jarret|a
pierna de cordero punta de babilla|n-gpc-pierna-de-cordero-punta-de-babilla|a
pierna de cordero sin rinonada|n-gpc-pierna-de-cordero-sin-rinonada|a
pierna de cordero sin rinonada jarrete ni hueso de cadera|n-gpc-pierna-de-cordero-sin-rinonada-jar|a
pierna de cordero sin rinonada ni jarrete|n-gpc-pierna-de-cordero-sin-rinonada-ni-|a
pierna de cordero sin rinonada ni jarrete deshuesada|n-gpc-pierna-de-cordero-sin-rinonada-ni--2|a
pierna de cordero tapa|n-gpc-pierna-de-cordero-tapa|a
pierna de cordero tapa sin capa|n-gpc-pierna-de-cordero-tapa-sin-capa|a
pierna de lechal|n-o-pierna-de-cordero|a
pierre corneille|n-gpc-pierre-corneille|c
pies de cerdo|n-p-manitas|a
pies/pastries sweet|n-gpc-pasteleria-dulce|a
pies/pastries sweet frozen|n-gpc-pasteleria-dulce|a
pies/pastries sweet perishable|n-gpc-pasteleria-dulce|a
pies/pastries sweet shelf stable|n-gpc-pasteleria-dulce|a
pies/pastries/pizzas/quiches savoury|n-gpc-empanadas-pizzas-y-quiches|a
pies/pastries/pizzas/quiches savoury frozen|n-gpc-empanadas-pizzas-y-quiches|a
pies/pastries/pizzas/quiches savoury perishable|n-gpc-empanadas-pizzas-y-quiches|a
pies/pastries/pizzas/quiches savoury shelf stable|n-gpc-empanadas-pizzas-y-quiches|a
piezas surtidas de cabrito limpieza especial|n-gpc-piezas-surtidas-de-cabrito-limpiez|a
pigato|n-gpc-pigato|c
piglos|n-gpc-piglos|c
pikant|n-gpc-pikant|c
pikkolo|n-gpc-pikkolo|c
pilot|n-gpc-pilot|c
pimento cheese|n-gpc-queso-con-pimiento|c
pimenton|n-d-especia|a
pimienta|n-v-pimienta|c
pimientas|n-v-pimienta|c
pimientas rojas|n-v-pimienta|c
pimientas rojas|n-v-pimientas-rojas|c
pimientas verdes|n-v-pimienta|c
pimientas verdes|n-v-pimientas-verdes|c
pimiento|n-v-pimiento|c
pimiento amarillo|n-v-pimiento|c
pimiento amarillo|n-v-pimiento-amarillo|c
pimiento cuadrado|n-gpc-pimiento-cuadrado|a
pimiento de padron|n-v-pimiento|c
pimiento de padron|n-v-pimiento-de-padron|c
pimiento de tomate|n-gpc-pimiento-de-tomate|a
pimiento del piquillo|n-d-conserva-vegetal|a
pimiento italiano|n-gpc-pimiento-italiano|a
pimiento lamuyo|n-v-pimiento|c
pimiento rojo|n-v-pimiento|c
pimiento rojo california|n-v-pimiento|c
pimiento rojo california|n-v-pimiento-rojo-california|c
pimiento rojo najerano|n-v-pimiento|c
pimiento rojo najerano|n-v-pimiento-rojo-najerano|c
pimiento rojo piquillo|n-v-pimiento|c
pimiento rojo piquillo|n-v-pimiento-rojo-piquillo|c
pimiento rojo toledo|n-v-pimiento|c
pimiento rojo toledo|n-v-pimiento-rojo-toledo|c
pimiento verde c cabra|n-v-pimiento|c
pimiento verde c cabra|n-v-pimiento-verde-c-cabra|c
pimiento verde cristal|n-v-pimiento|c
pimiento verde cristal|n-v-pimiento-verde-cristal|c
pimiento verde italiano|n-v-pimiento|c
pimiento verde italiano|n-v-pimiento-verde-italiano|c
pimientos|n-v-pimiento|c
pimientos lamuyos|n-v-pimiento|c
pimientos lamuyos|n-v-pimientos-lamuyos|c
pimientos rojos|n-v-pimiento|c
pimientos rojos|n-v-pimientos-rojos|c
pimona|n-gpc-pimona|c
pimpinela|n-gpc-pimpinela|a
pina|n-v-pina|c
pina africana|n-v-pina|c
pina africana|n-v-pina-africana|c
pina baby|n-v-pina-baby|c
pina golden sweet|n-v-pina|c
pina golden sweet|n-v-pina-golden-sweet|c
pina tropical|n-v-pina|c
pinas|n-v-pina|c
pineapples|n-v-pina|a
pineapples fresh cut|n-v-pina|a
pinguipes brasilianus|n-f-perca-de-mar|s
pinot auxerrois|n-gpc-pinot-auxerrois|c
pinot blanc pinot bianco/weissburgunder|n-gpc-pinot-blanc-pinot-bianco-weissburg|c
pinot gris grauburgunder/grauer burgunder/pinot grigio/rulaender|n-gpc-pinot-gris-grauburgunder-grauer-bu|c
pinot gris/chardonnay|n-gpc-pinot-gris-chardonnay|c
pinot gris/sauvignon blanc|n-gpc-pinot-gris-sauvignon-blanc|c
pinot gris/traminer/riesling|n-gpc-pinot-gris-traminer-riesling|c
pinot gris/verduzzo|n-gpc-pinot-gris-verduzzo|c
pinot gris/viognier/traminer|n-gpc-pinot-gris-viognier-traminer|c
pinot meunier|n-gpc-pinot-meunier|c
pinot noir blauburgunder/pinot nero/roter veltliner|n-gpc-pinot-noir-blauburgunder-pinot-ner|c
pinot noir/chardonnay|n-gpc-pinot-noir-chardonnay|c
pinot noir/chardonnay/chasselas/kerner|n-gpc-pinot-noir-chardonnay-chasselas-ke|c
pinot noir/chardonnay/chasselas/others|n-gpc-pinot-noir-chardonnay-chasselas-ot|c
pinot noir/chardonnay/pinot meunier|n-gpc-pinot-noir-chardonnay-pinot-meunie|c
pinot noir/gamay|n-gpc-pinot-noir-gamay|c
pinot noir/others|n-gpc-pinot-noir-others|c
pinot noir/pinot blanc/pinot gris/chardonnay|n-gpc-pinot-noir-pinot-blanc-pinot-gris-|c
pinot noir/pinot meunier/chardonnay|n-gpc-pinot-noir-pinot-meunier-chardonna|c
pinot noir/regent/dornfelder/others|n-gpc-pinot-noir-regent-dornfelder-other|c
pinot noir/regent/others|n-gpc-pinot-noir-regent-others|c
pinot noir/syrah|n-gpc-pinot-noir-syrah|c
pinot/chardonnay|n-gpc-pinot-chardonnay|c
pinotage|n-gpc-pinotage|c
pinotage/cabernet sauvignon|n-gpc-pinotage-cabernet-sauvignon|c
pinotage/cinsault|n-gpc-pinotage-cinsault|c
pinotage/merlot|n-gpc-pinotage-merlot|c
pinotage/syrah|n-gpc-pinotage-syrah|c
pinotin|n-gpc-pinotin|c
pinova|n-gpc-pinova|c
pinta de leon|n-d-alubia-pinta|a
pintada|n-a-pintada|a
pintadilla|n-f-pintadilla|o
pintarroja|n-f-pintarroja|o
pintarroja bocanegra|n-f-pintarroja-bocanegra|o
pintarroja islandica|n-f-pintarroja-islandica|o
pintarrojas|n-f-pintarroja|c
pion|n-f-pion|o
pion de altura|n-f-pion-de-altura|o
pipo crem|n-gpc-queso-pipo-crem|c
pirarucu|n-f-arapaima|o
pirella|n-gpc-pirella|c
piros|n-gpc-piros|c
pirulo|n-f-almeja-dorada|o
pistacho|n-d-fruto-seco|a
pistacho irani|n-d-fruto-seco|c
pistacho irani|n-v-pistacho-irani|c
pistacho turco|n-d-fruto-seco|c
pistacho turco|n-v-pistacho-turco|c
pistachos|n-d-fruto-seco|c
pistola de vacuno|n-b-media-canal-de-vacuno|a
pistola hindquarter 1 rib|n-gpc-cuarto-trasero-pistola-1-costilla|c
pistola hindquarter 10 ribs|n-gpc-cuarto-trasero-pistola-10-costilla|c
pistola hindquarter 2 ribs|n-gpc-cuarto-trasero-pistola-2-costillas|c
pistola hindquarter 3 ribs|n-gpc-cuarto-trasero-pistola-3-costillas|c
pistola hindquarter 4 ribs|n-gpc-cuarto-trasero-pistola-4-costillas|c
pistola hindquarter 5 ribs|n-gpc-cuarto-trasero-pistola-5-costillas|c
pistola hindquarter 6 ribs|n-gpc-cuarto-trasero-pistola-6-costillas|c
pistola hindquarter 7 ribs|n-gpc-cuarto-trasero-pistola-7-costillas|c
pistola hindquarter 8 ribs|n-gpc-cuarto-trasero-pistola-8-costillas|c
pistola hindquarter 9 ribs|n-gpc-cuarto-trasero-pistola-9-costillas|c
pistolas|n-b-media-canal-de-vacuno|a
pitahaya|n-v-pitahaya|c
pitahaya amarilla|n-v-pitahaya|c
pitahaya amarilla|n-v-pitahaya-amarilla|c
pitahaya roja|n-v-pitahaya|c
pitahaya roja|n-v-pitahaya-roja|c
pitaya|n-gpc-pitaya|a
pitaya amarilla|n-gpc-pitaya-amarilla|a
pitaya dulce|n-gpc-pitaya-dulce|a
pitayas|n-gpc-pitaya|a
pitayas fresh cut|n-gpc-pitaya|a
pitmaston williams duchess|n-gpc-pitmaston-williams-duchess|c
pizza|n-d-pizza|a
pizza cong|n-d-pizza|c
pizzas|n-d-pizza|c
pizzas congeladas|n-d-pizza|a
placopecten magellanicus|n-f-vieira-del-atlantico|s
plagusia depressa|n-f-cangrejo-blanco|s
plana|n-b-llana|a
plantain bananas|n-v-platano|a
plantas crasas comestibles|n-gpc-plantas-crasas-comestibles|a
plat americano o v|n-v-platano|c
platano|n-v-platano|c
platano baby|n-gpc-platano-baby|a
platano import o banana|n-v-platano|c
platano import o banana|n-v-platano-import-o-banana|c
platano macho|n-v-platano|c
platano macho|n-v-platano-macho|c
platano manzano|n-gpc-platano-manzano|a
platano otras variedades|n-v-platano|c
platano rojo|n-gpc-platano-rojo|a
platanos|n-v-platano|c
platanos canarios|n-v-platano|c
platanos extra|n-v-platano|c
platanos extra|n-v-platanos-extra|c
platanos importacion|n-v-platano|c
platanos primera|n-v-platano|c
platanos primera|n-v-platanos-primera|c
platanos segunda|n-v-platano|c
platanos segunda|n-v-platanos-segunda|c
platichthys flesus|n-f-platija|s
platija|n-f-platija|o
platija americana|n-f-platija-americana|o
platija cong|n-f-platija|c
platija de alaska|n-f-platija-de-alaska|o
platija de nueva zelanda|n-f-platija-de-nueva-zelanda|o
platija del pacifico|n-f-platija-del-pacifico|o
platija filete|n-f-platija|c
platija filete cong|n-f-platija|c
platija japonesa|n-f-platija-japonesa|o
platija nordica|n-f-solla|o
platija tresojos|n-f-platija-tresojos|o
plato listo|n-d-plato-preparado|a
plato preparado|n-d-plato-preparado|a
platos a base de cereal|n-gpc-platos-a-base-de-cereal|a
platos a base de huevo|n-gpc-platos-a-base-de-huevo|a
platos a base de lacteos y huevo|n-gpc-platos-a-base-de-lacteos-y-huevo|a
platos a base de verdura|n-gpc-platos-a-base-de-verdura|a
platusas|n-f-platusa|c
plavac mali|n-gpc-plavac-mali|c
plavaie|n-gpc-plavaie|c
plectorhinchus mediterraneus|n-f-burro|s
pleoticus muelleri|n-f-gambon|s
plesionika edwardsii|n-f-camaron-soldado|s
plesionika heterocarpus|n-f-camaron-flecha|s
plesionika martia|n-f-camaron-marcial|s
plesionika narval|n-f-camaron-narval|s
plesionika williamsi|n-f-camaron-rayado-de-guinea|s
pleuronectes platessa|n-f-solla|s
pleuronectes quadrituberculatus|n-f-platija-de-alaska|s
pluma|n-p-pluma|a
pluma iberica|n-p-pluma|a
plumac|n-gpc-plumac|c
plumcot|n-gpc-plumcot|a
plumcots|n-gpc-plumcot|a
plums|n-v-ciruela|a
plyto|n-gpc-plyto|c
poda|n-f-poda|o
pointed cabbage|n-gpc-col-puntiaguda|a
polaca austral|n-f-bacaladilla-austral|o
polido|n-f-polido|o
polititapes aureus|n-f-almeja-dorada|s
polititapes rhomboides|n-clam|s
pollachius pollachius|n-f-abadejo|s
pollachius virens|n-f-carbonero|s
pollicipes elegans|n-f-percebe-del-pacifico|s
pollicipes pollicipes|n-f-percebe|s
pollicipes polymerus|n-f-percebe-canadiense|s
pollo|n-chicken|a
pollo a cuartos|n-a-pollo-troceado|a
pollo abierto en dos mitades|n-gpc-pollo-abierto-en-dos-mitades|a
pollo campero|n-chicken|a
pollo de corral|n-chicken|a
pollo en cuartos|n-gpc-pollo-en-cuartos|a
pollo en trozos|n-a-pollo-troceado|a
pollo entero|n-chicken|a
pollo entero|n-gpc-pollo-entero|a
pollo entero deshuesado sin alas ni menudillos|n-gpc-pollo-entero-deshuesado-sin-alas-n|a
pollo entero sin menudillos|n-gpc-pollo-entero-sin-menudillos|a
pollo entero sin menudillos con cabeza|n-gpc-pollo-entero-sin-menudillos-con-ca|a
pollo entero sin menudillos con cabeza y patas|n-gpc-pollo-entero-sin-menudillos-con-ca-2|a
pollo entero sin menudillos con cuello entero|n-gpc-pollo-entero-sin-menudillos-con-cu|a
pollo entero sin menudillos con jamoncitos de corte largo|n-gpc-pollo-entero-sin-menudillos-con-ja|a
pollo entero sin menudillos con medio cuello|n-gpc-pollo-entero-sin-menudillos-con-me|a
pollo troceado|n-a-pollo-troceado|a
pollo troceado en 10 piezas|n-gpc-pollo-troceado-en-10-piezas|a
pollo troceado en 6 piezas|n-gpc-pollo-troceado-en-6-piezas|a
pollo troceado en 8 piezas corte alternativo|n-gpc-pollo-troceado-en-8-piezas-corte-a|a
pollo troceado en 8 piezas corte tradicional|n-gpc-pollo-troceado-en-8-piezas-corte-t|a
pollo troceado en 9 piezas corte campero|n-gpc-pollo-troceado-en-9-piezas-corte-c|a
pollo troceado en 9 piezas corte tradicional|n-gpc-pollo-troceado-en-9-piezas-corte-t|a
polybius corrugatus|n-f-cangrejo-de-arrugas|s
polybius depurator|n-f-falsa-necora|s
polybius henslowii|n-f-patelo|s
polybius navigator|n-f-cangrejo|s
polymixia nobilis|n-f-barbudo|s
polyprion americanus|n-f-cherna|s
polyprion oxygeneios|n-f-cherna-hapuka|s
pomadasys incisus|n-f-roncador|s
pomadasys jubelini|n-f-ronco-moteado|s
pomatomus saltatrix|n-f-anjova|s
pome fruits|n-gpc-fruta-de-pepita|a
pome fruits fresh cut|n-gpc-fruta-de-pepita|a
pomegranates|n-v-granada|a
pomelo|n-v-pomelo|c
pomelo amarillo|n-v-pomelo|c
pomelo amarillo|n-v-pomelo-amarillo|c
pomelo chino|n-gpc-pomelo-chino|a
pomelo miel|n-gpc-pomelo-miel|a
pomelo rojo|n-v-pomelo|c
pomelo rojo|n-v-pomelo-rojo|c
pomelos|n-v-pomelo|c
pontastacus leptodactylus|n-f-cangrejo-del-danubio|s
pontinus kuhlii|n-f-obispo|s
pontophilus spinosus|n-f-camaron-espinoso|s
popcorn|n-gpc-palomitas|a
popcorn shelf stable|n-gpc-palomitas|a
porcino|n-meat|c
porcino canal|n-halfcarcass|a
porcino casqueria|n-meat|c
porcino cong sin especif|n-meat|c
porcino conserva|n-meat|c
porcino despiece|n-meat|c
porcino despiece cong|n-meat|c
porcino despojo|n-meat|c
porcino elaborado|n-meat|c
porcino fresco sin especi|n-meat|c
porcino iberico canal|n-meat|c
porcino precocinado|n-meat|c
porcino sin especi|n-meat|c
pork|n-pork|a
pork prepared/processed|n-pork|a
pork sausages|n-gpc-embutido-de-cerdo|a
pork sausages prepared/processed|n-gpc-embutido-de-cerdo|a
pork unprepared/unprocessed|n-pork|a
porphyra umbilicalis|n-f-alga-nori|s
porredana|n-f-porredana|o
portugieser|n-gpc-portugieser|c
portunus pelagicus|n-f-cangrejo-pelagico|s
portunus segnis|n-f-cangrejo-azul-nadador|s
portunus trituberculatus|n-f-cangrejo-azul-japones|s
posip|n-gpc-posip|c
postre|n-gpc-dessert|a
postre lacteo|n-l-postre-lacteo|a
postres y yogures|n-l-postre-lacteo|a
pot marjoram|n-gpc-oregano-griego|a
pota|n-f-pota|o
pota|n-f-pota-neozelandesa|o
pota|n-f-pota-saltadora|o
pota|n-f-volador|o
pota argentina|n-f-pota|o
pota cardena|n-f-pota-cardena|o
pota costera|n-f-pota|o
pota japonesa|n-f-pota-japonesa|o
pota magister|n-f-pota-magister|o
pota naranja|n-f-pota-naranja|o
pota neozelandesa|n-f-pota-neozelandesa|o
pota saltadora|n-f-pota-saltadora|o
potatoes|n-v-patata|a
poton|n-f-poton-del-pacifico|o
poton del pacifico|n-f-poton-del-pacifico|o
poularda|n-a-poularda|a
poulsard|n-gpc-poulsard|c
pre mixed drinks non alcoholic|n-gpc-combinado-sin-alcohol|a
precoce de trevoux and mutants|n-gpc-precoce-de-trevoux-and-mutants|c
precocinado|n-d-plato-preparado|a
precocinados carnico|n-d-precocinados-carnico|c
precocinados de pescado|n-d-precocinados-de-pescado|c
precocinados pescado|n-d-precocinados-de-pescado|c
precocinados vegetal|n-v-vegetal|c
precocinados vegetales|n-v-vegetal|c
premsal prensal|n-gpc-premsal-prensal|c
preparado de queso crema|n-gpc-preparado-de-queso-crema|a
preparado de queso fundido|n-gpc-preparado-de-queso-fundido|a
preparado isotonico|n-gpc-preparado-isotonico|a
preparado para reposteria|n-gpc-preparado-para-reposteria|a
preparados lacteos|n-gpc-preparados-lacteos|a
prepared soups|n-gpc-sopas-preparadas|a
prepared/preserved foods variety packs|n-gpc-surtidos-de-platos-preparados-y-co|a
presa|n-p-presa|a
presa de paleta|n-p-presa|a
presa de paleta|n-gpc-presa-de-paleta|a
presa iberica|n-p-presa|a
present van engeland|n-gpc-present-van-engeland|c
president drouard|n-gpc-president-drouard|c
preto martinho|n-gpc-preto-martinho|c
priacanthus tayenus|n-f-catalufa-pintada|s
prickly pears barbary figs|n-v-higo-chumbo|a
prima|n-gpc-prima|c
primer y segundo segmento de ala de pavo|n-gpc-primer-y-segundo-segmento-de-ala-d|a
primitivo|n-gpc-primitivo|c
primitivo/merlot|n-gpc-primitivo-merlot|c
primo|n-gpc-primo|c
princesse noble|n-gpc-princesse-noble|c
prionace glauca|n-f-tintorera|s
prior|n-gpc-prior|c
priscilla|n-gpc-priscilla|c
procambarus clarkii|n-f-cangrejo-de-las-marismas|s
procanico|n-gpc-procanico|c
processa edulis|n-f-camaroncillo|s
processed cereal products|n-gpc-cereales-elaborados|a
processed cereal products variety packs|n-gpc-surtidos-de-cereales-elaborados|a
processed cheese|n-gpc-queso-fundido|c
processed cheese preparation|n-gpc-preparado-de-queso-fundido|c
processed feet unece 701802|n-gpc-patas-de-pollo-elaboradas|c
processed gizzards unece 711901|n-gpc-mollejas-de-pavo-elaboradas|c
processed paws unece 701801|n-gpc-garras-de-pollo-elaboradas|c
producto de cereal|n-gpc-producto-de-cereal|a
producto de limpieza|n-x-producto-de-limpieza|a
productos carnicos|n-f-productos-carnico|c
productos carnicos cong|n-f-productos-carnico|c
projasus bahamondei|n-f-langosta-del-peru|s
promethichthys prometheus|n-f-conejo|s
prosecco glera|n-gpc-prosecco-glera|c
prosecco/chardonnay|n-gpc-prosecco-chardonnay|c
prosecco/chardonnay/pinot blanc|n-gpc-prosecco-chardonnay-pinot-blanc|c
prosecco/pinot noir|n-gpc-prosecco-pinot-noir|c
protein bars|n-gpc-barrita-de-proteinas|a
proteopitar patagonicus|n-f-almeja-corazon|s
protonibea diacanthus|n-f-corvina-pintada|s
protrachypene precipua|n-f-langostino-titi|s
provolone|n-q-queso-provolone|a
prugnolo gentile|n-gpc-prugnolo-gentile|c
psettodes belcheri|n-f-halibut-perro|s
psettodes bennettii|n-f-halibut-espinoso|s
pseudaphya ferreri|n-f-caboti|s
pseudocaranx dentex|n-f-jurel-limon|s
pseudocarcharias kamoharai|n-f-tiburon-cocodrilo|s
pseudochondrostoma polylepis|n-f-boga-de-rio|s
pseudocyttus maculatus|n-f-pez-gallo-de-nueva-zelanda|s
pseudopercis semifasciata|n-f-perca-de-mar-argentina|s
pseudophycis bachus|n-f-falsa-brotola|s
pseudotolithus senegalensis|n-f-corvina-negra|s
pseudotolithus senegallus|n-f-corvina-negra|s
pseudotriakis microdon|n-f-peje-camello|s
pseudupeneus prayensis|n-f-salmonete-africano|s
pterocladiella capillacea|n-f-capilacea|s
pterogymnus laniarius|n-f-sargo-panga|s
pteroplatytrygon violacea|n-f-raya-latigo|s
puerro|n-v-puerro|c
puerro egipcio|n-gpc-puerro-egipcio|a
puerros|n-v-puerro|c
pulpito oriental|n-f-pulpito-oriental|o
pulpo|n-octopus|a
pulpo almizclado|n-f-pulpo-almizclado|o
pulpo azulon|n-f-pulpo-azulon|o
pulpo blanco|n-f-pulpo-blanco|o
pulpo burlon|n-f-pulpo-burlon|o
pulpo cocido|n-octopus|c
pulpo cong|n-octopus|c
pulpo de angel|n-f-pulpo-de-angel|o
pulpo de roca|n-octopus-rock|a
pulpo de roca occidental|n-f-pulpo-de-roca-occidental|o
pulpo descong y refri|n-octopus|c
pulpo dormilon|n-f-pulpo-dormilon|o
pulpo gallego|n-octopus|c
pulpo gallego cong|n-octopus|c
pulpo gigante africano|n-f-pulpo-gigante-africano|o
pulpo gigante del pacifico|n-f-pulpo-gigante-del-pacifico|o
pulpo grande|n-octopus|c
pulpo kraken|n-f-pulpo-kraken|o
pulpo maya|n-f-pulpo-maya|o
pulpo mediano|n-octopus|c
pulpo membranoso|n-f-pulpo-membranoso|o
pulpo patudo|n-f-pulpo-patudo|o
pulpo pequeno|n-octopus|c
pulpo tailandes|n-octopus|c
pulpo thailandes|n-octopus|c
pulpo thailandes cong|n-octopus|c
pulpo tipo gallego|n-octopus|c
pummelos|n-gpc-pomelo-chino|a
pumpkins/winter squash|n-v-calabaza|a
punta de ala de pollo|n-gpc-punta-de-ala-de-pollo|a
punta de cadera|n-b-cadera|a
punta de pecho con esternon|n-gpc-punta-de-pecho-con-esternon|a
punta de pecho sin tapa 4 costillas|n-gpc-punta-de-pecho-sin-tapa-4-costilla|a
punta de pecho sin tapa 5 costillas|n-gpc-punta-de-pecho-sin-tapa-5-costilla|a
punta de pecho sin tapa 6 costillas|n-gpc-punta-de-pecho-sin-tapa-6-costilla|a
punta de pecho sin tapa 7 costillas|n-gpc-punta-de-pecho-sin-tapa-7-costilla|a
puntarella|n-gpc-puntarella|a
puntarelle|n-gpc-puntarella|a
puntilla|n-f-calamar|o
puntilla africana|n-f-calamarin-africano|o
puntilla cong|n-f-calamar|c
puntilla de china|n-f-calamar|o
puntilla de japon|n-f-calamar|o
puntilla de la india|n-f-calamar|o
puntilla espada|n-f-calamar-espada|o
puntilla menor|n-f-calamarin-menor|o
puntilla picuda|n-f-calamarin-picudo|o
pure de verduras|n-v-crema-de-verduras|a
purple maracujas|n-gpc-maracuya-morado|a
purslane|n-gpc-verdolaga|a
pyriam|n-gpc-pyriam|c
pyrodwarf|n-gpc-pyrodwarf|c
pyropia elongata|n-f-alga-nori|s
quail|n-a-codorniz|a
quail prepared/processed|n-a-codorniz|a
quail unprepared/unprocessed|n-a-codorniz|a
queen cox|n-gpc-queen-cox|c
quelvacho|n-f-quelvacho|o
quelve|n-f-remudo-blanco|o
queso|n-cheese|a
queso a la cerveza|n-gpc-queso-a-la-cerveza|a
queso americano|n-gpc-queso-americano|a
queso azul|n-q-queso-azul|a
queso azul danes|n-gpc-queso-azul-danes|a
queso azul de baviera|n-gpc-queso-azul-de-baviera|a
queso beaufort|n-gpc-queso-beaufort|a
queso blanco aleman|n-gpc-queso-blanco-aleman|a
queso blanco batido|n-gpc-queso-blanco-batido|a
queso bleu de bresse|n-gpc-queso-bleu-de-bresse|a
queso blue castello|n-gpc-queso-blue-castello|a
queso brick|n-gpc-queso-brick|a
queso brie|n-q-queso-brie|a
queso brunost|n-gpc-queso-brunost|a
queso butterkase|n-gpc-queso-butterkase|a
queso caboc|n-gpc-queso-caboc|a
queso cabra|n-q-queso-de-cabra|a
queso cabrales|n-q-queso-cabrales|a
queso caciocavallo|n-gpc-queso-caciocavallo|a
queso caerphilly|n-gpc-queso-caerphilly|a
queso camembert|n-q-queso-camembert|a
queso cantal|n-gpc-queso-cantal|a
queso chaource|n-gpc-queso-chaource|a
queso cheddar|n-q-queso-cheddar|a
queso cheshire azul|n-gpc-queso-cheshire-azul|a
queso cheshire blanco|n-gpc-queso-cheshire-blanco|a
queso cheshire rojo|n-gpc-queso-cheshire-rojo|a
queso colby|n-gpc-queso-colby|a
queso colby jack|n-gpc-queso-colby-jack|a
queso colwick|n-gpc-queso-colwick|a
queso con pimiento|n-gpc-queso-con-pimiento|a
queso cottage|n-q-requeson|a
queso cottage|n-gpc-queso-cottage|a
queso coulommiers|n-gpc-queso-coulommiers|a
queso crema|n-q-queso-crema|a
queso de burgos|n-q-queso-de-burgos|a
queso de cabra|n-q-queso-de-cabra|a
queso de cabra frances|n-gpc-queso-de-cabra-frances|a
queso de cabra rulo|n-q-queso-de-cabra|a
queso de cuajada|n-gpc-queso-de-cuajada|a
queso de mezcla|n-q-queso-de-mezcla|a
queso de oveja|n-q-queso-de-oveja|a
queso de untar|n-q-queso-de-untar|a
queso de vaca|n-q-queso-de-vaca|a
queso dolcelatte|n-gpc-queso-dolcelatte|a
queso double gloucester|n-gpc-queso-double-gloucester|a
queso dunlop|n-gpc-queso-dunlop|a
queso edam|n-q-queso-edam|a
queso emmental|n-q-queso-emmental|a
queso emmenthal|n-gpc-queso-emmenthal|a
queso en lonchas|n-q-queso-en-lonchas|a
queso en polvo|n-q-queso-rallado|a
queso en salmuera|n-gpc-queso-en-salmuera|a
queso epoisses|n-gpc-queso-epoisses|a
queso esrom|n-gpc-queso-esrom|a
queso feta|n-q-queso-feta|a
queso fontina|n-gpc-queso-fontina|a
queso fourme d ambert|n-gpc-queso-fourme-d-ambert|a
queso fresco|n-q-queso-fresco|a
queso fresco batido|n-gpc-queso-fresco-batido|a
queso fresco de burgos|n-q-queso-de-burgos|a
queso fundido|n-gpc-queso-fundido|a
queso geheimratskase|n-gpc-queso-geheimratskase|a
queso gjetost|n-gpc-queso-gjetost|a
queso gouda|n-q-queso-gouda|a
queso gruyere|n-q-queso-gruyere|a
queso halloumi|n-q-queso-halloumi|a
queso havarti|n-q-queso-havarti|a
queso idiazabal|n-q-queso-idiazabal|a
queso jarlsberg|n-gpc-queso-jarlsberg|a
queso kochkase|n-gpc-queso-kochkase|a
queso lancashire|n-gpc-queso-lancashire|a
queso leyden|n-gpc-queso-leyden|a
queso mahon|n-q-queso-mahon|a
queso majorero|n-q-queso-majorero|a
queso manchego|n-q-queso-manchego|a
queso mezcla|n-q-queso-de-mezcla|a
queso monterey jack|n-gpc-queso-monterey-jack|a
queso mozzarella|n-q-queso-mozzarella|a
queso munster|n-gpc-queso-munster|a
queso mycella|n-gpc-queso-mycella|a
queso neufchatel|n-gpc-queso-neufchatel|a
queso ossau iraty|n-gpc-queso-ossau-iraty|a
queso oveja|n-q-queso-de-oveja|a
queso parmesano|n-q-queso-parmesano|a
queso parmesano rallado|n-gpc-queso-parmesano-rallado|a
queso pecorino|n-q-queso-pecorino|a
queso petit munster|n-gpc-queso-petit-munster|a
queso pipo crem|n-gpc-queso-pipo-crem|a
queso provolone|n-q-queso-provolone|a
queso raclette|n-q-queso-raclette|a
queso rallado|n-q-queso-rallado|a
queso reblochon|n-gpc-queso-reblochon|a
queso red leicester|n-gpc-queso-red-leicester|a
queso ricotta|n-q-queso-ricotta|a
queso roule|n-gpc-queso-roule|a
queso saint marcellin|n-gpc-queso-saint-marcellin|a
queso saint paulin|n-gpc-queso-saint-paulin|a
queso sapsago|n-gpc-queso-sapsago|a
queso sbrinz|n-gpc-queso-sbrinz|a
queso shropshire azul|n-gpc-queso-shropshire-azul|a
queso stilton|n-q-queso-stilton|a
queso stilton azul|n-gpc-queso-stilton-azul|a
queso suizo|n-gpc-queso-suizo|a
queso taleggio|n-q-queso-taleggio|a
queso tetilla|n-q-queso-tetilla|a
queso tilsit|n-gpc-queso-tilsit|a
queso tomme au raisin|n-gpc-queso-tomme-au-raisin|a
queso vaca|n-q-queso-de-vaca|a
queso vignotte|n-gpc-queso-vignotte|a
queso wensleydale|n-gpc-queso-wensleydale|a
quesos|n-cheese|c
quimera|n-f-quimera|o
quimera|n-f-quimera-picuda|o
quimera arpon|n-f-quimera-arpon|o
quimera elefante|n-f-quimera-elefante|o
quimera picuda|n-f-quimera-picuda|o
quinces|n-v-membrillo|a
quinta gama|n-v-quinta-gama|c
quinta gama hortalizas|n-v-quinta-gama|c
quinta gama hortalizas|n-v-quinta-gama-hortalizas|c
quisquilla|n-f-camaron-soldado|o
quisquilla de pinzas|n-f-quisquilla-de-pinzas|o
rabadilla de pollo|n-gpc-rabadilla-de-pollo|a
rabadillas de pavo|n-gpc-rabadillas-de-pavo|a
rabanilla|n-v-rabanilla|c
rabanillas|n-v-rabanilla|c
rabano|n-v-rabano|c
rabano negro|n-gpc-rabano-negro|a
rabano picante|n-gpc-rabano-picante|a
rabanos|n-v-rabano|c
rabbit|n-rabbit|a
rabbit prepared/processed|n-rabbit|a
rabbit unprepared/unprocessed|n-rabbit|a
rabigato|n-gpc-rabigato|c
rabil|n-f-rabil|o
rabillo de cadera|n-b-cadera|a
rabillo de cadera|n-gpc-rabillo-de-cadera|a
rabirrubia|n-f-rabirrubia|o
rabirrubia canela|n-f-rabirrubia-canela|o
rabo|n-b-rabo|a
rabo de buey|n-b-rabo|a
rabo de cerdo|n-p-rabo-de-cerdo|a
rabo de ovelha|n-gpc-rabo-de-ovelha|c
rabo de toro|n-b-rabo|a
raboso|n-gpc-raboso|c
rachycentron canadum|n-f-cobia|s
racion de campana|n-gpc-racion-de-campana|a
rack 6 rib unece 404931|n-gpc-carre-de-cordero-6-costillas|c
rack 6 rib unece 504931|n-gpc-carre-de-cabrito-6-costillas|c
rack 7 rib unece 404930|n-gpc-carre-de-cordero-7-costillas|c
rack 7 rib unece 504930|n-gpc-carre-de-cabrito-7-costillas|c
rack 8 rib unece 404932|n-gpc-carre-de-cordero-8-costillas|c
rack 8 rib unece 504932|n-gpc-carre-de-cabrito-8-costillas|c
rack 9 rib unece 404933|n-gpc-carre-de-cordero-9-costillas|c
rack 9 rib unece 504933|n-gpc-carre-de-cabrito-9-costillas|c
rack cap off 6 rib unece 504746|n-gpc-carre-de-cabrito-sin-tapa-6-costil|c
rack cap off 6 ribs unece 404746|n-gpc-carre-de-cordero-sin-tapa-6-costil|c
rack cap off 7 rib unece 504747|n-gpc-carre-de-cabrito-sin-tapa-7-costil|c
rack cap off 7 ribs unece 404747|n-gpc-carre-de-cordero-sin-tapa-7-costil|c
rack cap off 8 rib unece 504748|n-gpc-carre-de-cabrito-sin-tapa-8-costil|c
rack cap off 8 ribs unece 404748|n-gpc-carre-de-cordero-sin-tapa-8-costil|c
rack cap off 9 rib unece 504749|n-gpc-carre-de-cabrito-sin-tapa-9-costil|c
rack cap off 9 ribs unece 404749|n-gpc-carre-de-cordero-sin-tapa-9-costil|c
rack cap off frenched 2 rib unece 404758|n-gpc-carre-de-cordero-francesado-sin-ta|c
rack cap off frenched 3 rib unece 404759|n-gpc-carre-de-cordero-francesado-sin-ta-2|c
rack cap off frenched 4 rib unece 404760|n-gpc-carre-de-cordero-francesado-sin-ta-3|c
rack cap off frenched 5 rib unece 404761|n-gpc-carre-de-cordero-francesado-sin-ta-4|c
rack cap off frenched 6 rib unece 404762|n-gpc-carre-de-cordero-francesado-sin-ta-5|c
rack cap off frenched 7 rib unece 404763|n-gpc-carre-de-cordero-francesado-sin-ta-6|c
rack cap off frenched 8 rib unece 404764|n-gpc-carre-de-cordero-francesado-sin-ta-7|c
rack cap off frenched 9 rib unece 404765|n-gpc-carre-de-cordero-francesado-sin-ta-8|c
rack cap on frenched 2 rib unece 404750|n-gpc-carre-de-cordero-francesado-con-ta|c
rack cap on frenched 3 rib unece 404751|n-gpc-carre-de-cordero-francesado-con-ta-2|c
rack cap on frenched 4 rib unece 404752|n-gpc-carre-de-cordero-francesado-con-ta-3|c
rack cap on frenched 5 rib unece 404753|n-gpc-carre-de-cordero-francesado-con-ta-4|c
rack cap on frenched 6 rib unece 404754|n-gpc-carre-de-cordero-francesado-con-ta-5|c
rack cap on frenched 7 rib unece 404755|n-gpc-carre-de-cordero-francesado-con-ta-6|c
rack cap on frenched 8 rib unece 404756|n-gpc-carre-de-cordero-francesado-con-ta-7|c
rack cap on frenched 9 rib unece 404757|n-gpc-carre-de-cordero-francesado-con-ta-8|c
rack saddle 6 rib unece 404926|n-gpc-silla-de-carre-de-cordero-6-costil|c
rack saddle 7 rib unece 404927|n-gpc-silla-de-carre-de-cordero-7-costil|c
rack saddle 8 rib unece 404928|n-gpc-silla-de-carre-de-cordero-8-costil|c
rack saddle 9 rib unece 404929|n-gpc-silla-de-carre-de-cordero-9-costil|c
raclette|n-q-queso-raclette|a
radicchio|n-gpc-radicchio|a
radicchio redloof|n-gpc-radicchio|a
radicchio rosso|n-gpc-radicchio-rosso|a
radishes|n-v-rabano|a
raeuschling|n-gpc-raeuschling|c
rafzas benita|n-gpc-rafzas-benita|c
rafzubex|n-gpc-rafzubex|c
rafzubin|n-gpc-rafzubin|c
raices y tuberculos|n-root|a
raiz de loto|n-gpc-raiz-de-loto|a
raiz de perejil|n-gpc-raiz-de-perejil|a
raja asterias|n-f-raya-estrellada|s
raja brachyura|n-f-raya-boca-de-rosa|s
raja clavata|n-f-raya-de-clavos|s
raja maderensis|n-f-raya-de-madeira|s
raja microocellata|n-f-raya-de-ojos|s
raja miraletus|n-f-raya-de-espejos|s
raja montagui|n-f-raya-pintada|s
raja radula|n-f-raya-aspera|s
raja spp|n-f-raya|s
raja straeleni|n-f-raya-manchada|s
raja undulata|n-f-raya-mosaico|s
rajella barnardi|n-f-raya-del-sur|s
rajella leopardus|n-f-raya-leopardo|s
rajella lintea|n-f-raya-vela|s
rajka|n-gpc-rajka|c
rajnai rizling|n-gpc-rajnai-rizling|c
ramandolo|n-gpc-ramandolo|c
rambour d hiver|n-gpc-rambour-d-hiver|c
rambour franc|n-gpc-rambour-franc|c
rambutan|n-v-rambutan|c
ramsons|n-gpc-ajo-de-oso|a
rana|n-gpc-rana|a
rapana venosa|n-f-caracola|s
rape|n-monkfish|a
rape africano|n-f-rape-africano|o
rape americano|n-f-rape-americano|o
rape blanco|n-f-rape-blanco|o
rape c/c|n-monkfish|c
rape chino|n-monkfish|c
rape colas|n-monkfish|c
rape cong|n-monkfish|c
rape de boston|n-f-rape-americano|o
rape de nueva zelanda|n-f-rape-de-nueva-zelanda|o
rape del cabo|n-f-rape-del-cabo|o
rape del pacifico|n-f-rape-del-pacifico|o
rape importacion|n-monkfish|c
rape nacional|n-monkfish|c
rape namibia y gran sol|n-monkfish|c
rape negro|n-f-rape-negro|o
rape oriental|n-f-rape-oriental|o
rapeta|n-f-rapeta|o
rara neagra|n-gpc-rara-neagra|c
rascacio|n-f-rascacio|o
rascacio de altura|n-f-rascacio-de-altura|o
rascacio de madeira|n-f-rascacio-de-madeira|o
rascacio toro|n-f-gallineta-toro|o
raspallon|n-f-raspallon|o
raspallon del punto|n-f-raspallon-del-punto|o
raspberries|n-v-frambuesa|a
rasqueta|n-f-rasqueta|o
raya|n-f-raya|o
raya aspera|n-f-raya-aspera|o
raya boca de rosa|n-f-raya-boca-de-rosa|o
raya bramante|n-f-raya-bramante|o
raya cardadora|n-f-raya-cardadora|o
raya cong|n-f-raya|c
raya de clavos|n-f-raya-de-clavos|o
raya de espejos|n-f-raya-de-espejos|o
raya de los canales|n-f-raya-de-los-canales|o
raya de madeira|n-f-raya-de-madeira|o
raya de ojos|n-f-raya-de-ojos|o
raya de puntos|n-f-raya-de-puntos|o
raya del sur|n-f-raya-del-sur|o
raya dentada|n-f-raya-dentada|o
raya estrellada|n-f-raya-estrellada|o
raya falsa vela|n-f-raya-falsa-vela|o
raya latigo|n-f-raya-latigo|o
raya latigo islena|n-f-raya-latigo-islena|o
raya leopardo|n-f-raya-leopardo|o
raya lisa|n-f-raya-lisa|o
raya manchada|n-f-raya-manchada|o
raya marmorada|n-f-raya-marmorada|o
raya mosaico|n-f-raya-mosaico|o
raya pintada|n-f-raya-pintada|o
raya radiante|n-f-raya-radiante|o
raya santiaguesa|n-f-raya-santiaguesa|o
raya vela|n-f-raya-vela|o
raya violeta|n-f-raya-latigo|o
raya volantin|n-f-raya-volantin|o
ready made combination meals|n-d-plato-preparado|a
ready made combination meals not ready to eat frozen|n-d-plato-preparado|a
ready made combination meals not ready to eat perishable|n-d-plato-preparado|a
ready made combination meals not ready to eat shelf stable|n-d-plato-preparado|a
ready made combination meals not ready to eat variety packs|n-gpc-surtidos-de-platos-preparados|a
ready made combination meals ready to eat perishable|n-d-plato-preparado|a
ready made combination meals ready to eat shelf stable|n-d-plato-preparado|a
ready made combination meals ready to eat variety packs|n-gpc-surtidos-de-platos-preparados|a
ready made combination meals variety packs|n-gpc-surtidos-de-platos-preparados|a
reanda|n-gpc-reanda|c
rebella|n-gpc-rebella|c
reblochon|n-gpc-queso-reblochon|c
rebozuelo|n-gpc-rebozuelo|a
recortes de ala de pavo|n-gpc-recortes-de-ala-de-pavo|a
recortes de carne blanca de pavo|n-gpc-recortes-de-carne-blanca-de-pavo|a
recortes de carne oscura de pavo|n-gpc-recortes-de-carne-oscura-de-pavo|a
recortes de cerdo|n-gpc-recortes-de-cerdo|a
recortes de contramuslo de pavo|n-gpc-recortes-de-contramuslo-de-pavo|a
recortes de jamoncito de pavo|n-gpc-recortes-de-jamoncito-de-pavo|a
recortes de pechuga de pavo|n-gpc-recortes-de-pechuga-de-pavo|a
red bananas|n-gpc-platano-rojo|a
red bartlett|n-gpc-red-bartlett|c
red cabbages|n-v-lombarda|a
red cascade|n-gpc-red-cascade|c
red cheshire|n-gpc-queso-cheshire-rojo|c
red chief|n-gpc-red-chief|c
red clapp s starkrimson|n-gpc-red-clapp-s-starkrimson|c
red cox|n-gpc-red-cox|c
red currants|n-v-grosella|a
red delcorf|n-gpc-red-delcorf|c
red delicious and mutants|n-gpc-red-delicious-and-mutants|c
red devil|n-gpc-red-devil|c
red dougherty|n-gpc-red-dougherty|c
red elstar|n-gpc-red-elstar|c
red falstaff|n-gpc-red-falstaff|c
red idared|n-gpc-red-idared|c
red jonaprince|n-gpc-red-jonaprince|c
red king oregon spur red delicious|n-gpc-red-king-oregon-spur-red-delicious|c
red leicester|n-gpc-queso-red-leicester|c
red melba|n-gpc-red-melba|c
red rome|n-gpc-red-rome|c
red sensation bartlett|n-gpc-red-sensation-bartlett|c
red spur delicious|n-gpc-red-spur-delicious|c
red topaz|n-gpc-red-topaz|c
red windsor|n-gpc-red-windsor|c
red york|n-gpc-red-york|c
redfield|n-gpc-redfield|c
redkroft|n-gpc-redkroft|c
redlane|n-gpc-redlane|c
redondo|n-b-redondo|a
redondo de vacuno|n-gpc-redondo-de-vacuno|a
redsleeves|n-gpc-redsleeves|c
redspring|n-gpc-redspring|c
redstar|n-gpc-redstar|c
refosco refosk|n-gpc-refosco-refosk|c
refresco|n-d-refresco|a
refresco cola|n-d-refresco|a
refresco fruta|n-d-refresco|a
regal gala|n-gpc-regal-gala|c
regal prince gala must|n-gpc-regal-prince-gala-must|c
regala|n-gpc-regala|c
reganas|n-d-picos|a
regent|n-gpc-regent|c
regina|n-gpc-regina|c
reglindis|n-gpc-reglindis|c
reichensteiner|n-gpc-reichensteiner|c
reindeer/caribou|n-gpc-reno|a
reindeer/caribou prepared/processed|n-gpc-reno|a
reindeer/caribou unprepared/unprocessed|n-gpc-reno|a
reineta|n-f-palometa-austral|o
reineta blanca del canada|n-gpc-reineta-blanca-del-canada|a
reineta de francia|n-gpc-reineta-de-francia|a
reineta del canada|n-gpc-reineta-del-canada|a
reineta encarnada|n-gpc-reineta-encarnada|c
reineta gris del canada|n-gpc-reineta-gris-del-canada|a
reineta roja del canada|n-gpc-reineta-roja-del-canada|a
reinette blanche du canada|n-gpc-reineta-blanca-del-canada|c
reinette de champagne|n-gpc-reinette-de-champagne|c
reinette de france|n-gpc-reineta-de-francia|c
reinette de landsberg|n-gpc-reinette-de-landsberg|c
reinette de orleans|n-gpc-orleans-reinette|c
reinette descardre|n-gpc-reinette-descardre|c
reinette du canada|n-gpc-reineta-del-canada|c
reinette etoilee|n-gpc-reinette-etoilee|c
reinette evagil|n-gpc-reinette-evagil|c
reinette grise du canada|n-gpc-reineta-gris-del-canada|c
reinette rouge du canada|n-gpc-reineta-roja-del-canada|c
reinhardtius hippoglossoides|n-f-fletan-negro|s
reinstar|n-gpc-reinstar|c
reishi|n-gpc-reishi|a
rejo|n-f-rejo|c
rejo congelado cong|n-f-rejo|c
rejos|n-f-rejo|c
relinda|n-gpc-relinda|c
rellena de anchoa|n-d-aceituna-rellena|a
reloj|n-f-reloj|o
reloj anaranjado|n-f-reloj-anaranjado|o
reloj atlantico|n-f-reloj-anaranjado|o
reloj de fondo|n-f-reloj-de-fondo|o
reloj mediterraneo|n-f-reloj-mediterraneo|o
relojes|n-f-reloj|c
rembrandt|n-gpc-rembrandt|c
remo|n-gpc-remo|c
remol|n-f-remol|o
remolacha|n-v-remolacha|c
remudo blanco|n-f-remudo-blanco|o
reno|n-gpc-reno|a
reno 2|n-gpc-reno-2|c
renora|n-gpc-renora|c
reo|n-f-reo|o
repollo|n-gpc-repollo|a
requeson|n-q-queso-fresco|a
requeson|n-q-requeson|a
resi|n-gpc-resi|c
resista|n-gpc-resista|c
resto|n-f-resto|c
resto congelados cong|n-f-resto|c
resto de fruta|n-fruit|c
resto de frutas|n-fruit|c
resto de hortalizas|n-v-resto-hortaliza|c
resto de patatas|n-v-patata|c
resto hortaliza|n-v-resto-hortaliza|c
resto hortalizas|n-v-resto-hortaliza|c
resto marisco|n-f-resto|c
resto marisco fresco|n-f-resto|c
resto patata|n-v-patata|c
resto patatas|n-v-patata|c
resto pescado|n-f-resto|c
resto pescado fresco|n-f-resto|c
retina|n-gpc-retina|c
reverend w wilks|n-gpc-reverend-w-wilks|c
rewena|n-gpc-rewena|c
rhea|n-gpc-nandu|a
rhea prepared/processed|n-gpc-nandu|a
rhea unprepared/unprocessed|n-gpc-nandu|a
rheinische schafsnase|n-gpc-rheinische-schafsnase|c
rheinischer bohnapfel|n-gpc-rheinischer-bohnapfel|c
rheinischer krummstiel|n-gpc-rheinischer-krummstiel|c
rheinischer winterrambur|n-gpc-rheinischer-winterrambur|c
rheinriesling|n-gpc-rheinriesling|c
rhencus panamensis|n-f-ronco-blanco|s
rhinobatos rhinobatos|n-f-pez-guitarra|s
rhinochimaera atlantica|n-f-quimera-arpon|s
rhode island greening|n-gpc-rhode-island-greening|c
rhombosolea leporina|n-f-platija-de-nueva-zelanda|s
rhombosolea plebeia|n-f-platija-de-nueva-zelanda|s
rhubarb|n-gpc-ruibarbo|a
rib prepared 4 rib|n-gpc-costillar-preparado-4-costillas|c
rib prepared 5 rib|n-gpc-costillar-preparado-5-costillas|c
rib prepared 6 rib|n-gpc-costillar-preparado-6-costillas|c
rib prepared 7 rib|n-gpc-costillar-preparado-7-costillas|c
rib prepared 8 rib|n-gpc-costillar-preparado-8-costillas|c
rib prepared 9 rib|n-gpc-costillar-preparado-9-costillas|c
rib short ribs 1 rib|n-gpc-costillas-cortas-de-vacuno-1-costi|c
rib short ribs 2 ribs|n-gpc-costillas-cortas-de-vacuno-2-costi|c
rib short ribs 3 ribs|n-gpc-costillas-cortas-de-vacuno-3-costi|c
rib short ribs 4 ribs|n-gpc-costillas-cortas-de-vacuno-4-costi|c
rib short ribs 5 ribs|n-gpc-costillas-cortas-de-vacuno-5-costi|c
rib short ribs 6 ribs|n-gpc-costillas-cortas-de-vacuno-6-costi|c
rib short ribs 7 ribs|n-gpc-costillas-cortas-de-vacuno-7-costi|c
rib short ribs 8 ribs|n-gpc-costillas-cortas-de-vacuno-8-costi|c
rib short ribs 9 ribs|n-gpc-costillas-cortas-de-vacuno-9-costi|c
rib spare ribs|n-gpc-costillar-bajo-de-vacuno|c
ribeye|n-b-lomo-alto|a
ribeye roll|n-gpc-lomo-alto-deshuesado|c
ribolla gialla|n-gpc-ribolla-gialla|c
ribs|n-p-costillar-de-cerdo|a
ribston pippin|n-gpc-ribston-pippin|c
richared|n-gpc-richared|c
ricotta|n-q-queso-ricotta|a
rieslaner|n-gpc-rieslaner|c
riesling|n-gpc-riesling|c
riesling italico|n-gpc-riesling-italico|c
riesling kastellan|n-gpc-riesling-kastellan|c
riesling muskat|n-gpc-riesling-muskat|c
riesling renano|n-gpc-riesling-renano|c
riesling/gewuerztraminer|n-gpc-riesling-gewuerztraminer|c
riesling/traminer|n-gpc-riesling-traminer|c
rinon|n-c-rinon|a
rinonada|n-b-lomo-bajo|a
rinonada de cabrito|n-gpc-rinonada-de-cabrito|a
rinonada de cabrito con hueso|n-gpc-rinonada-de-cabrito-con-hueso|a
rinonada de cabrito deshuesada|n-gpc-rinonada-de-cabrito-deshuesada|a
rinonada de cordero 1 costilla|n-gpc-rinonada-de-cordero-1-costilla|a
rinonada de cordero 2 costillas|n-gpc-rinonada-de-cordero-2-costillas|a
rinonada de cordero 3 costillas|n-gpc-rinonada-de-cordero-3-costillas|a
rinonada de cordero con cadera 1 costilla|n-gpc-rinonada-de-cordero-con-cadera-1-c|a
rinonada de cordero con cadera 2 costillas|n-gpc-rinonada-de-cordero-con-cadera-2-c|a
rinonada de cordero con cadera 3 costillas|n-gpc-rinonada-de-cordero-con-cadera-3-c|a
rinonada de cordero con cadera sin costillas|n-gpc-rinonada-de-cordero-con-cadera-sin|a
rinonada de cordero con hueso|n-gpc-rinonada-de-cordero-con-hueso|a
rinonada de cordero deshuesada|n-gpc-rinonada-de-cordero-deshuesada|a
rinonada de cordero sin costillas|n-gpc-rinonada-de-cordero-sin-costillas|a
rinones|n-c-rinon|a
rinones|n-meat|c
riojano|n-m-chorizo-riojano|a
ritt bjerregaard|n-gpc-ritt-bjerregaard|c
rivaner|n-gpc-rivaner|c
rivaner/morio muskat|n-gpc-rivaner-morio-muskat|c
rivaner/riesling|n-gpc-rivaner-riesling|c
rivaner/sauvignon blanc/gelber muskateller/scheurebe|n-gpc-rivaner-sauvignon-blanc-gelber-mus|c
rkatsiteli|n-gpc-rkatsiteli|c
roasting pig full unece 304011|n-gpc-cochinillo-entero|c
roasting pig split unece 304012|n-gpc-cochinillo-abierto|c
robalito|n-f-robalito|o
robalo|n-seabass|o
robalo de fondo|n-f-robalo-de-fondo|o
robijn|n-gpc-robijn|c
roble marino|n-f-roble-marino|o
rocha|n-gpc-rocha|c
rocket|n-gpc-rucula|a
rod ananas|n-gpc-rod-ananas|c
rod astrakan red astrachan|n-gpc-rod-astrakan-red-astrachan|c
roda mantet|n-gpc-roda-mantet|c
rodaballo|n-f-rodaballo|o
rodaballo acuicultura|n-f-rodaballo|c
rodaballo cong|n-f-rodaballo|c
rodaballo de captura|n-f-rodaballo|c
rodaballo de cultivo|n-f-rodaballo|c
rodaballo o v|n-f-rodaballo|c
rodaballo salvaje|n-f-rodaballo|c
rodajas de cazon|n-f-cazon|c
rodajas de merluza|n-hake|c
rode boskoop|n-gpc-rode-boskoop|c
rode dijkmanszoet|n-gpc-rode-dijkmanszoet|c
rode doyenne van doorn|n-gpc-rode-doyenne-van-doorn|c
rode jonathan|n-gpc-rode-jonathan|c
rode keuleman|n-gpc-rode-keuleman|c
roditis|n-gpc-roditis|c
roe deer|n-gpc-corzo|a
roe deer prepared/processed|n-gpc-corzo|a
roe deer unprepared/unprocessed|n-gpc-corzo|a
roelstar elstar roelse|n-gpc-roelstar-elstar-roelse|c
roho 3615 red pinova|n-gpc-roho-3615-red-pinova|c
roja de benejama|n-gpc-roja-de-benejama|c
rolle|n-gpc-rolle|c
rollo de etiquetas|n-x-etiqueta|a
romagold|n-gpc-romagold|c
romaine cos lettuce|n-gpc-lechuga-romana|a
romance variety|n-gpc-romance-variety|c
romanesco|n-gpc-romanesco|a
romanescu|n-v-romanescu|c
rome/rome beauty|n-gpc-rome-rome-beauty|c
romeiko|n-gpc-romeiko|c
romerillo|n-f-romerillo|o
romero|n-f-romero|o
romorantin|n-gpc-romorantin|c
roncador|n-f-burro|o
roncador|n-f-roncador|o
ronco blanco|n-f-ronco-blanco|o
ronco moteado|n-f-ronco-moteado|o
rondinella|n-gpc-rondinella|c
root/tuber vegetables|n-root|a
root/tuber vegetables fresh cut|n-root|a
roquefort|n-q-queso-azul|a
rosada|n-f-rosada|o
rosada|n-f-rosada-del-cabo|o
rosada cong|n-f-rosada|c
rosada de clark|n-f-rosada-de-clark|o
rosada del cabo|n-f-rosada-del-cabo|o
rosada entera|n-f-rosada|c
rosada filete|n-f-rosada|c
rosada filete cong|n-f-rosada|c
rosada rodaja|n-f-rosada|c
rosada rodaja cong|n-f-rosada|c
rosalie|n-gpc-rosalie|c
rosemarie|n-gpc-rosemarie|c
rosemary|n-f-romero|a
rosenmuskateller|n-gpc-rosenmuskateller|c
rosette variety|n-gpc-rosette-variety|c
rosioara pamid|n-gpc-rosioara-pamid|c
rosquilletas|n-d-picos|a
rossese|n-gpc-rossese|c
rossia macrosoma|n-f-globito-robusto|s
rossignola|n-gpc-rossignola|c
rosso|n-gpc-rosso|c
rosso colli di luni|n-gpc-rosso-colli-di-luni|c
rosso di cardinale|n-gpc-rosso-di-cardinale|c
rosso di montalcino|n-gpc-rosso-di-montalcino|c
rosso di toscana|n-gpc-rosso-di-toscana|c
rostroraja alba|n-f-raya-bramante|s
rotberger|n-gpc-rotberger|c
roter berlepsch|n-gpc-roter-berlepsch|c
roter eiserapfel|n-gpc-roter-eiserapfel|c
roter gravensteiner|n-gpc-roter-gravensteiner|c
roter riesling|n-gpc-roter-riesling|c
roter trierer weinapfel|n-gpc-roter-trierer-weinapfel|c
roulada|n-galantina|a
roule|n-gpc-queso-roule|c
round inside|n-gpc-tapa-de-vacuno|c
round inside cap|n-gpc-tapa-capa|c
round inside cap off|n-gpc-tapa-sin-capa|c
round inside cap off trimmed|n-gpc-tapa-sin-capa-limpia|c
round outside|n-gpc-contra-de-vacuno|c
round outside flat|n-gpc-contra-plana|c
round outside trimmed|n-gpc-contra-limpia|c
round silverside|n-gpc-culata-de-contra|c
roupeiro|n-gpc-roupeiro|c
roussanne|n-gpc-roussanne|c
roussanne/marsanne/viognier|n-gpc-roussanne-marsanne-viognier|c
roussanne/picpoul|n-gpc-roussanne-picpoul|c
royal beauty gala|n-gpc-royal-beauty-gala|c
royal braeburn|n-gpc-royal-braeburn|c
royal gala|n-gpc-royal-gala|c
royal red|n-gpc-royal-red|c
rozela|n-gpc-rozela|c
rubin czech cultivar|n-gpc-rubin-czech-cultivar|c
rubin kazakhstan cultivar|n-gpc-rubin-kazakhstan-cultivar|c
rubinette frubaur|n-gpc-rubinette-frubaur|c
rubino|n-gpc-rubino|c
rubinola|n-gpc-rubinola|c
rubinstar|n-gpc-rubinstar|c
rubinstep|n-gpc-rubinstep|c
rubio|n-f-bejel|o
rubio|n-f-rubio|o
rubio de aleta azul|n-f-rubio-de-aleta-azul|o
rubio del cabo|n-f-rubio-del-cabo|o
rubired|n-gpc-rubired|c
ruby cabernet|n-gpc-ruby-cabernet|c
ruby cabernet/cinsault|n-gpc-ruby-cabernet-cinsault|c
ruby cabernet/merlot|n-gpc-ruby-cabernet-merlot|c
ruby cabernet/pinotage|n-gpc-ruby-cabernet-pinotage|c
rucula|n-gpc-rucula|a
rudens svitrainais|n-gpc-rudens-svitrainais|c
ruditapes decussatus|n-clam|s
ruditapes philippinarum|n-clam|s
rufete|n-gpc-rufete|c
rufo africano|n-f-rufo-africano|o
rufo derivante|n-f-rufo-derivante|o
rufo imperial|n-f-rufo-imperial|o
ruibarbo|n-gpc-ruibarbo|a
rulo de cabra|n-q-queso-de-cabra|a
rump|n-gpc-cadera-de-vacuno|c
rump and loin 0 ribs|n-gpc-cadera-con-lomo-sin-costillas|c
rump and loin 1 rib|n-gpc-cadera-con-lomo-1-costilla|c
rump and loin 2 ribs|n-gpc-cadera-con-lomo-2-costillas|c
rump and loin 3 ribs|n-gpc-cadera-con-lomo-3-costillas|c
rump and loin 4 6 ribs|n-gpc-cadera-con-lomo-4-6-costillas|c
rump cap|n-gpc-tapilla-de-cadera|c
runner beans|n-gpc-judia-de-enrame|a
ruvettus pretiosus|n-f-escolar|s
ryugan|n-gpc-ryugan|c
sabalo|n-f-sabalo|o
sabalo atlantico|n-f-sabalo-atlantico|o
sabalote|n-f-sabalote|o
sable|n-f-sable|c
sable alargado|n-f-sable-alargado|o
sable cong|n-f-sable|c
sable negro|n-f-sable-negro|o
sable plateado|n-f-pez-cinto|o
saborizante de bebida|n-gpc-saborizante-de-bebida|a
saccharina japonica|n-f-kombu-japones|s
saccharina latissima|n-f-argazo-real|s
saccorhiza polyschides|n-f-cauloco|s
saddle 10 rib unece 404897|n-gpc-silla-de-cordero-10-costillas|c
saddle 11 rib unece 404898|n-gpc-silla-de-cordero-11-costillas|c
saddle 12 rib unece 404899|n-gpc-silla-de-cordero-12-costillas|c
saddle 13 rib unece 404900|n-gpc-silla-de-cordero-13-costillas|c
saddle 7 rib unece 404911|n-gpc-silla-de-cordero-7-costillas|c
saddle 8 rib unece 404910|n-gpc-silla-de-cordero-8-costillas|c
saddle 9 rib unece 404912|n-gpc-silla-de-cordero-9-costillas|c
saddle unece 504900|n-gpc-silla-de-cabrito|c
saels|n-gpc-saels|c
sage|n-gpc-salvia|a
sagrantino|n-gpc-sagrantino|c
saint edmund s pippin st edmund s russet|n-gpc-saint-edmund-s-pippin-st-edmund-s-|c
saint marcellin|n-gpc-queso-saint-marcellin|c
saint paulin|n-gpc-queso-saint-paulin|c
saint remy|n-gpc-saint-remy|c
sal|n-d-sal|a
sal gorda|n-d-sal|a
sal marina|n-d-sal|a
sal y ablandadores de carne|n-gpc-sal-y-ablandadores-de-carne|a
salak|n-gpc-salak|a
salak snake fruit|n-gpc-salak|a
salamino|n-gpc-salamino|c
salangichthys microdon|n-f-chanquete-chino|s
salazones|n-f-salazon|c
salazones|n-cured|a
salchicha cocida|n-frankfurt|a
salchicha criolla|n-salchicha|a
salchicha de cerdo|n-salchicha|a
salchicha fresca|n-salchicha|a
salchicha tipo frankfurt|n-frankfurt|a
salchicha viena|n-frankfurt|a
salchichon|n-salchichon|a
salchichon cular|n-salchichon|a
salchichon de vic|n-m-salchichon-de-vic|a
salchichon extra|n-salchichon|a
salchichon vic|n-m-salchichon-de-vic|a
salema|n-f-salema|o
salemas|n-f-salema|c
salicornia|n-gpc-salicornia|a
salilota australis|n-f-brotola-criolla|s
salmo salar|n-f-salmon-atlantico|s
salmo trutta|n-f-reo|s
salmon|n-f-salmon|o
salmon|n-f-salmon-atlantico|o
salmon ahumado|n-f-salmon|c
salmon atlantico|n-f-salmon-atlantico|o
salmon cong|n-f-salmon|c
salmon filete|n-f-salmon|c
salmon filete cong|n-f-salmon|c
salmon grande gt 7kg|n-f-salmon|c
salmon keta|n-f-salmon|o
salmon mediano|n-f-salmon|c
salmon mediano 4 5 kg|n-f-salmon|c
salmon pequeno|n-f-salmon|c
salmon pequeno 1 3 kg|n-f-salmon|c
salmon plateado|n-f-salmon|o
salmon real|n-f-salmon|o
salmon rodajas|n-f-salmon|c
salmon rodajas cong|n-f-salmon|c
salmon rojo|n-f-salmon|o
salmon rosado|n-f-salmon|o
salmonete|n-f-salmonete|c
salmonete africano|n-f-salmonete-africano|o
salmonete cinabrio|n-f-salmonete-cinabrio|o
salmonete de fango|n-f-salmonete-de-fango|o
salmonete de fango|n-f-salmonete|c
salmonete de roca|n-f-salmonete-de-roca|o
salmonete de roca|n-f-salmonete|c
salmonete real|n-f-salmonete-real|o
salmonetes|n-f-salmonete|c
salmonetes cong|n-f-salmonete|c
salsa|n-d-salsa|a
salsa de tomate|n-d-salsa|a
salsa para cocinar|n-gpc-salsa-para-cocinar|a
salsas|n-d-salsa|a
salsas y adobos|n-gpc-salsas-y-adobos|a
salsas y rellenos de postre|n-gpc-salsas-y-rellenos-de-postre|a
salsifi|n-gpc-salsifi|a
salsify|n-gpc-salsifi|a
salt sticks / mini pretzels|n-gpc-palitos-salados|a
saltamontes y grillos|n-gpc-saltamontes-y-grillos|a
saltanat|n-gpc-saltanat|c
salton|n-f-salton|o
salvariego|n-f-salvariego|o
salvelino|n-f-salvelino|o
salvelinus alpinus|n-f-trucha-alpina|s
salvelinus fontinalis|n-f-salvelino|s
salvelinus namaycush|n-f-trucha-lacustre|s
salvia|n-gpc-salvia|a
sama|n-f-sama|o
sama de pluma|n-f-sama-de-pluma|o
samling|n-gpc-samling|c
sampion|n-gpc-sampion|c
samso|n-gpc-samso|c
samtrot|n-gpc-samtrot|c
san pedro|n-f-san-pedro|c
san pedro americano|n-f-gallo-plateado|o
san pedro del cabo|n-f-san-pedro-del-cabo|o
sander|n-gpc-sander|c
sander lucioperca|n-f-lucioperca|s
sandia|n-v-sandia|c
sandia con grana|n-v-sandia|c
sandia con semilla|n-v-sandia|c
sandia con semilla|n-v-sandia-con-semilla|c
sandia importacion|n-v-sandia|c
sandia otras variedaedes|n-v-sandia|c
sandia otras variedaedes|n-v-sandia-otras-variedaedes|c
sandia sin grana|n-v-sandia|c
sandia sin semilla|n-v-sandia|c
sandia sin semilla|n-v-sandia-sin-semilla|c
sandias|n-v-sandia|c
sandidge|n-gpc-sandidge|c
sandwiches/filled rolls/wraps|n-gpc-bocadillos-y-wraps|a
sandwiches/filled rolls/wraps frozen|n-gpc-bocadillos-y-wraps|a
sandwiches/filled rolls/wraps perishable|n-gpc-bocadillos-y-wraps|a
sandwiches/filled rolls/wraps variety packs|n-gpc-surtidos-de-bocadillos-y-wraps|a
sangiovese|n-gpc-sangiovese|c
sangiovese/alicante|n-gpc-sangiovese-alicante|c
sangiovese/cabernet sauvignon|n-gpc-sangiovese-cabernet-sauvignon|c
sangiovese/cabernet sauvignon/alicante|n-gpc-sangiovese-cabernet-sauvignon-alic|c
sangiovese/cabernet sauvignon/merlot|n-gpc-sangiovese-cabernet-sauvignon-merl|c
sangiovese/canaiolo|n-gpc-sangiovese-canaiolo|c
sangiovese/canaiolo nero|n-gpc-sangiovese-canaiolo-nero|c
sangiovese/malbec|n-gpc-sangiovese-malbec|c
sangiovese/merlot|n-gpc-sangiovese-merlot|c
sangiovese/merlot/cabernet sauvignon|n-gpc-sangiovese-merlot-cabernet-sauvign|c
sangiovese/merlot/sagrantino|n-gpc-sangiovese-merlot-sagrantino|c
sangiovese/others|n-gpc-sangiovese-others|c
sangiovese/syrah|n-gpc-sangiovese-syrah|c
sangre|n-c-sangre|a
sangre cocida|n-c-sangre|a
sanguinole/summer blutbirne|n-gpc-sanguinole-summer-blutbirne|c
sanquerus validus|n-f-jaiba-satinada|s
santa maria morettini|n-gpc-santa-maria-morettini|c
santana|n-gpc-santana|c
santiaguino|n-f-santiaguino|o
santiaguino oriental|n-f-cigarra-oriental|o
sapata negra|n-f-sapata-negra|o
saperavi|n-gpc-saperavi|c
sapodillo|n-gpc-chicozapote|a
sapote|n-v-zapote|a
sapote black|n-gpc-zapote-negro|a
sapote fresh cut|n-v-zapote|a
sapote white|n-gpc-zapote-blanco|a
sapsago|n-gpc-queso-sapsago|c
sarba|n-gpc-sarba|c
sarda australis|n-f-bonito-austral|s
sarda chiliensis|n-f-bonito-del-pacifico|s
sarda orientalis|n-f-bonito-oriental|s
sarda sarda|n-f-bonito|s
sardina|n-f-sardina|o
sardina normal|n-f-sardina|c
sardina parrocha|n-f-sardina|c
sardina pilchardus|n-f-sardina|s
sardinas|n-f-sardina|c
sardinas cong|n-f-sardina|c
sardinela aceitera|n-f-sardinela-aceitera|o
sardinella aurita|n-f-alacha|s
sardinella longiceps|n-f-sardinela-aceitera|s
sardinella maderensis|n-f-machuelo|s
sardineta del pacifico|n-f-sardineta-del-pacifico|o
sardinillas|n-d-conserva-de-pescado|a
sargassum vulgare|n-f-sargazo-comun|s
sargazo comun|n-f-sargazo-comun|o
sargazo vejigoso|n-f-fucus|o
sargo|n-f-sargo|o
sargo atlantico|n-f-sargo-atlantico|o
sargo breado|n-f-sargo-breado|o
sargo panga|n-f-sargo-panga|o
sargo picudo|n-f-sargo-picudo|o
sarpa salpa|n-f-salema|s
saskatoon berries|n-gpc-baya-de-saskatoon|a
sastre amarillo|n-f-sastre-amarillo|o
sastre rojo|n-f-sastre-rojo|o
satsuma mandarins|n-v-mandarina|a
sauces cooking|n-gpc-salsa-para-cocinar|a
sauces cooking frozen|n-gpc-salsa-para-cocinar|a
sauces cooking perishable|n-gpc-salsa-para-cocinar|a
sauces cooking shelf stable|n-gpc-salsa-para-cocinar|a
sauces/spreads/dips/condiments|n-gpc-salsas-untables-y-condimentos|a
sauces/spreads/dips/condiments variety packs|n-gpc-surtidos-de-salsas-y-condimentos|a
sauco|n-gpc-sauco|a
sauternes|n-gpc-sauternes|c
sauvignac|n-gpc-sauvignac|c
sauvignon blanc|n-gpc-sauvignon-blanc|c
sauvignon blanc/chardonnay|n-gpc-sauvignon-blanc-chardonnay|c
sauvignon blanc/chenin blanc|n-gpc-sauvignon-blanc-chenin-blanc|c
sauvignon blanc/garganega|n-gpc-sauvignon-blanc-garganega|c
sauvignon blanc/gros manseng|n-gpc-sauvignon-blanc-gros-manseng|c
sauvignon blanc/semillon|n-gpc-sauvignon-blanc-semillon|c
sauvignon gris|n-gpc-sauvignon-gris|c
savagnin heida|n-gpc-savagnin-heida|c
savatiano|n-gpc-savatiano|c
savoury bakery products|n-gpc-bolleria-salada|a
savoy cabbages|n-gpc-col-rizada|a
savstaholm|n-gpc-savstaholm|c
sbrinz|n-gpc-queso-sbrinz|c
scapula meat unece 716011|n-gpc-carne-de-la-escapula-de-pavo|c
scarlet benoni|n-gpc-scarlet-benoni|c
scarus hoefleri|n-f-pez-loro-de-guinea|s
schedophilus ovalis|n-f-rufo-imperial|s
schedophilus velaini|n-f-rufo-africano|s
scheurebe|n-gpc-scheurebe|c
scheurebe bacchus|n-gpc-scheurebe-bacchus|c
scheurebe huxelrebe|n-gpc-scheurebe-huxelrebe|c
scheurebe/mueller thurgau|n-gpc-scheurebe-mueller-thurgau|c
schiava|n-gpc-schiava|c
schisandra|n-gpc-schisandra|a
schneica jonica|n-gpc-schneica-jonica|c
schniga gala schnitzer|n-gpc-schniga-gala-schnitzer|c
schoener von nordhausen|n-gpc-schoener-von-nordhausen|c
schwarzriesling|n-gpc-schwarzriesling|c
sciaena umbra|n-f-corvallo|s
sciaenops ocellatus|n-f-corvinon-ocelado|s
sciearly|n-gpc-sciearly|c
scifresh|n-gpc-scifresh|c
sciglo|n-gpc-sciglo|c
scilate|n-gpc-scilate|c
sciray|n-gpc-sciray|c
scired|n-gpc-scired|c
sciros|n-gpc-sciros|c
scomber australasicus|n-f-caballa-austral|s
scomber colias|n-f-estornino-del-atlantico|s
scomber japonicus|n-f-caballa-del-sur|s
scomber scombrus|n-f-caballa|s
scomberesox saurus|n-f-paparda|s
scomberoides commersonnianus|n-f-pez-reina|s
scomberomorus regalis|n-f-cero|s
scomberomorus sierra|n-f-carite-sierra|s
scomberomorus tritor|n-f-carita|s
scophthalmus maximus|n-f-rodaballo|s
scophthalmus rhombus|n-f-remol|s
scorpaena elongata|n-f-gallineta-rosada|s
scorpaena maderensis|n-f-rascacio-de-madeira|s
scorpaena notata|n-f-escorpora|s
scorpaena porcus|n-f-rascacio|s
scorpaena scrofa|n-f-cabracho|s
scorpaena stephanica|n-f-rascacio-de-altura|s
scorzonera|n-gpc-escorzonera|a
scrobicularia plana|n-f-almeja-de-perro|s
scrumptious|n-gpc-scrumptious|c
scyliorhinus canicula|n-f-pintarroja|s
scyliorhinus stellaris|n-f-alitan|s
scylla serrata|n-f-cangrejo-de-fango-australiano|s
scyllarides herklotsii|n-f-cigarra-roja|s
scyllarides latus|n-f-cigarra|s
scyllarus arctus|n-f-santiaguino|s
scyllarus pygmaeus|n-f-cigarra-enana|s
scymnodon ringens|n-f-bruja|s
sea kale|n-gpc-col-marina|a
sea lavender|n-gpc-lavanda-de-mar|a
seafood substitutes|n-gpc-sustitutos-de-marisco|a
seafood substitutes animal based|n-gpc-sustituto-de-marisco-de-origen-ani|a
seafood substitutes animal based frozen|n-gpc-sustituto-de-marisco-de-origen-ani|a
seafood substitutes animal based perishable|n-gpc-sustituto-de-marisco-de-origen-ani|a
seafood substitutes animal based shelf stable|n-gpc-sustituto-de-marisco-de-origen-ani|a
seafood substitutes non animal based|n-gpc-sustituto-vegetal-de-marisco|a
seafood substitutes non animal based frozen|n-gpc-sustituto-vegetal-de-marisco|a
seafood substitutes non animal based perishable|n-gpc-sustituto-vegetal-de-marisco|a
seafood substitutes non animal based shelf stable|n-gpc-sustituto-vegetal-de-marisco|a
seafood substitutes variety packs|n-gpc-surtidos-de-sustitutos-de-marisco|a
seafood variety packs|n-gpc-surtidos-de-marisco|a
seasonings/preservatives/extracts variety packs|n-gpc-surtidos-de-condimentos-y-extracto|a
seba|n-f-seba|o
sebastes alutus|n-f-gallineta-del-pacifico|s
sebastes capensis|n-f-gallineta-del-cabo|s
sebastes jordani|n-f-chancharro|s
sebastes mentella|n-f-gallineta-oceanica|s
sebastes norvegicus|n-f-gallineta-nordica|s
sebastes spp|n-f-gallineta|s
sebo|n-offal-lard|a
secallona|n-sausage-cured|a
seckel|n-gpc-seckel|c
second and third wing section unece 711303|n-gpc-segundo-y-tercer-segmento-de-ala-d|c
second section wing unece 711305|n-gpc-segundo-segmento-de-ala-de-pavo|c
secreto|n-p-secreto|a
secreto iberico|n-p-secreto|a
sedges|n-gpc-ciperaceas|a
sedges fresh cut|n-gpc-ciperaceas|a
seedlings|n-v-germinado|a
seedlings ready to eat|n-v-germinado|a
segundo segmento de ala de pavo|n-gpc-segundo-segmento-de-ala-de-pavo|a
segundo y tercer segmento de ala de pavo|n-gpc-segundo-y-tercer-segmento-de-ala-d|a
seitan|n-d-sustituto-de-carne|a
selar crumenophthalmus|n-f-chicharro-ojon|s
selena|n-gpc-selena|c
semiboneless loin center cut 10 ribs unece 304105|n-gpc-lomo-de-cerdo-semideshuesado-corte|c
semiboneless loin center cut 11 ribs unece 304104|n-gpc-lomo-de-cerdo-semideshuesado-corte-2|c
semiboneless loin center cut 12 ribs unece 304103|n-gpc-lomo-de-cerdo-semideshuesado-corte-3|c
semiboneless loin center cut 13 ribs unece 304102|n-gpc-lomo-de-cerdo-semideshuesado-corte-4|c
semicassis granulata|n-f-casco-acanalado|s
semillon|n-gpc-semillon|c
semillon/chardonnay|n-gpc-semillon-chardonnay|c
semillon/muscadelle|n-gpc-semillon-muscadelle|c
semillon/sauvignon blanc|n-gpc-semillon-sauvignon-blanc|c
semillon/sauvignon blanc/chardonnay|n-gpc-semillon-sauvignon-blanc-chardonna|c
semirossia tenera|n-f-globito-tierno|s
semola|n-d-semola|a
sepia|n-f-choquito|o
sepia|n-f-sepia|o
sepia aculeata|n-f-sepia-oriental|s
sepia andreana|n-f-sepia-del-pacifico|s
sepia bertheloti|n-f-choco-canario|s
sepia canaria|n-f-choco-canario|o
sepia del pacifico|n-f-sepia-del-pacifico|o
sepia elegans|n-f-choquito|s
sepia faraonica|n-f-sepia-faraonica|o
sepia ganchuda|n-f-sepia-ganchuda|o
sepia labiada|n-f-sepia-labiada|o
sepia lycidas|n-f-sepia-labiada|s
sepia officinalis|n-f-sepia|s
sepia orbignyana|n-f-choquito-picudo|s
sepia oriental|n-f-sepia-oriental|o
sepia pharaonis|n-f-sepia-faraonica|s
sepia picuda|n-f-choquito-picudo|o
sepia recurvirostra|n-f-sepia-ganchuda|s
sepiola rondeletii|n-f-globito|s
sepioteuthis lessoniana|n-f-calamar-de-arrecife|s
seriola carpenteri|n-f-medregal|s
seriola dumerili|n-f-pez-de-limon|s
seriola fasciata|n-f-medregal|s
seriola lalandi|n-f-medregal|s
seriola quinqueradiata|n-f-medregal|s
seriola rivoliana|n-f-medregal|s
seriolella brama|n-f-cojinova|s
seriolella caerulea|n-f-cojinova|s
seriolella porosa|n-f-cojinova|s
seriolella punctata|n-f-cojinova|s
serrandell|n-f-serrandell|o
serrano|n-f-serrano|o
serrano|n-m-jamon-serrano|a
serrano imperial|n-f-serrano-imperial|o
serranus atricauda|n-f-serrano-imperial|s
serranus cabrilla|n-f-cabrilla|s
serranus hepatus|n-f-cabrilla|s
serranus scriba|n-f-serrano|s
serripes groenlandicus|n-f-berberecho-de-groenlandia|s
sesos|n-c-sesos|a
seta|n-v-seta|c
seta de cardo|n-v-seta|c
seta de cardo|n-v-seta-de-cardo|c
seta de ostra|n-gpc-seta-de-ostra|a
seta girgola|n-v-seta|c
seta girgola|n-v-seta-girgola|c
seta perrechico|n-v-seta|c
seta perrechico|n-v-seta-perrechico|c
seta shii take|n-v-seta|c
seta shii take|n-v-seta-shii-take|c
seta silvestre|n-gpc-seta-silvestre|a
seta/hongo boletus edulis|n-v-seta|c
seta/hongo boletus edulis|n-v-seta-hongo-boletus-edulis|c
setas|n-v-seta|c
setas de cultivo|n-v-seta|c
setas de cultivo|n-v-setas-de-cultivo|c
setas niscalos|n-v-seta|c
setas niscalos|n-v-setas-niscalos|c
setas otras variedades|n-v-seta|c
setas sin determinar|n-v-seta|c
setas y hongos|n-gpc-setas-y-hongos|a
seyval blanc|n-gpc-seyval-blanc|c
sezao|n-gpc-sezao|c
shalimar|n-gpc-shalimar|c
shallots|n-gpc-chalota|a
shamrock|n-gpc-shamrock|c
sharon|n-v-sharon|c
shellfish|n-shellfish|a
shellfish prepared/processed|n-shellfish|a
shellfish prepared/processed frozen|n-shellfish|a
shellfish prepared/processed perishable|n-shellfish|a
shellfish prepared/processed shelf stable|n-shellfish|a
shellfish unprepared/unprocessed|n-shellfish|a
shellfish unprepared/unprocessed frozen|n-shellfish|a
shellfish unprepared/unprocessed perishable|n-shellfish|a
shellfish unprepared/unprocessed shelf stable|n-shellfish|a
shiitake|n-gpc-shiitake|a
shiitake mushrooms|n-gpc-shiitake|a
shimeji|n-gpc-shimeji|a
short loin unece 504880|n-gpc-rinonada-de-cabrito|c
short ribs unece 304164|n-gpc-costillas-cortas-de-cerdo|c
shortloin 0 rib unece 404881|n-gpc-rinonada-de-cordero-sin-costillas|c
shortloin 0 ribs|n-gpc-lomo-bajo-con-solomillo-sin-costil|c
shortloin 1 rib|n-gpc-lomo-bajo-con-solomillo-1-costilla|c
shortloin 1 rib unece 404880|n-gpc-rinonada-de-cordero-1-costilla|c
shortloin 2 rib unece 404879|n-gpc-rinonada-de-cordero-2-costillas|c
shortloin 2 ribs|n-gpc-lomo-bajo-con-solomillo-2-costilla|c
shortloin 3 rib unece 404878|n-gpc-rinonada-de-cordero-3-costillas|c
shortloin 3 ribs|n-gpc-lomo-bajo-con-solomillo-3-costilla|c
shortloin chump on 0 rib unece 404873|n-gpc-rinonada-de-cordero-con-cadera-sin|c
shortloin chump on 1 rib unece 404874|n-gpc-rinonada-de-cordero-con-cadera-1-c|c
shortloin chump on 2 rib unece 404875|n-gpc-rinonada-de-cordero-con-cadera-2-c|c
shortloin chump on 3 rib unece 404876|n-gpc-rinonada-de-cordero-con-cadera-3-c|c
shortloin pair 0 rib unece 404882|n-gpc-par-de-rinonadas-de-cordero-sin-co|c
shortloin pair 1 rib unece 404883|n-gpc-par-de-rinonadas-de-cordero-1-cost|c
shortloin pair 2 rib unece 404884|n-gpc-par-de-rinonadas-de-cordero-2-cost|c
shortloin pair 3 rib unece 404885|n-gpc-par-de-rinonadas-de-cordero-3-cost|c
shotwell delicious|n-gpc-shotwell-delicious|c
shoulder cushion unece 304183|n-gpc-paletilla-cojin|c
shoulder fat unece 307680|n-gpc-tocino-de-paletilla|c
shoulder inside 1 rib unece 304046|n-gpc-paletilla-cara-interna-1-costilla|c
shoulder inside 2 ribs unece 304047|n-gpc-paletilla-cara-interna-2-costillas|c
shoulder inside 3 ribs unece 304048|n-gpc-paletilla-cara-interna-3-costillas|c
shoulder inside 4 ribs unece 304049|n-gpc-paletilla-cara-interna-4-costillas|c
shoulder inside bonless unece 304241|n-gpc-paletilla-cara-interna-deshuesada|c
shoulder lower half picnic 1 rib|n-gpc-paletilla-mitad-inferior-1-costill|c
shoulder lower half picnic 2 ribs|n-gpc-paletilla-mitad-inferior-2-costill|c
shoulder lower half picnic 3 ribs unece 304053|n-gpc-paletilla-mitad-inferior-3-costill|c
shoulder lower half picnic 4 ribs unece 304052|n-gpc-paletilla-mitad-inferior-4-costill|c
shoulder lower half picnic 5 ribs unece 304051|n-gpc-paletilla-mitad-inferior-5-costill|c
shoulder lower half picnic 6 ribs unece 304050|n-gpc-paletilla-mitad-inferior-6-costill|c
shoulder outside 3 way unece 204045|n-gpc-paletilla-cara-externa-despiezada-|c
shoulder outside oyster cut boneless unece 505055|n-gpc-paletilla-de-cabrito-cara-externa-|c
shoulder outside oyster cut unece 504980|n-gpc-paletilla-de-cabrito-cara-externa--2|c
shoulder outside unece 304044|n-gpc-paletilla-cara-externa|c
shoulder pectoralis unece 304180|n-gpc-paletilla-pectoral|c
shoulder picnic and belly|n-gpc-paletilla-con-panceta|c
shoulder rack 2 rib unece 404732|n-gpc-costillar-de-paletilla-de-cordero-|c
shoulder rack 3 rib unece 404731|n-gpc-costillar-de-paletilla-de-cordero--2|c
shoulder rack 4 rib unece 404732|n-gpc-costillar-de-paletilla-de-cordero--3|c
shoulder rack 5 rib unece 404733|n-gpc-costillar-de-paletilla-de-cordero--4|c
shoulder rack frenched 2 rib unece 404736|n-gpc-costillar-de-paletilla-de-cordero--5|c
shoulder rack frenched 3 rib unece 404737|n-gpc-costillar-de-paletilla-de-cordero--6|c
shoulder rack frenched 4 rib unece 404738|n-gpc-costillar-de-paletilla-de-cordero--7|c
shoulder rack frenched 5 rib unece 404739|n-gpc-costillar-de-paletilla-de-cordero--8|c
shoulder rack pair 4 rib unece 404762|n-gpc-par-de-costillares-de-paletilla-de-3|c
shoulder rack pair 4 rib unece 504762|n-gpc-par-de-costillares-de-paletilla-de|c
shoulder rack pair 5 rib unece 404727|n-gpc-par-de-costillares-de-paletilla-de-4|c
shoulder rack pair 5 rib unece 504727|n-gpc-par-de-costillares-de-paletilla-de-2|c
shoulder ribs 2 ribs unece 304167|n-gpc-costillar-de-paletilla-de-cerdo-2-|c
shoulder ribs 3 ribs unece 304166|n-gpc-costillar-de-paletilla-de-cerdo-3-|c
shoulder ribs 4 ribs unece 304165|n-gpc-costillar-de-paletilla-de-cerdo-4-|c
shoulder serratus ventralis unece 304182|n-gpc-presa-de-paleta|c
shoulder square cut 1 rib unece 304029|n-gpc-paletilla-de-cerdo-cortada-a-escua|c
shoulder square cut 2 ribs unece 304030|n-gpc-paletilla-de-cerdo-cortada-a-escua-2|c
shoulder square cut 3 ribs unece 304031|n-gpc-paletilla-de-cerdo-cortada-a-escua-3|c
shoulder square cut 4 rib unece 504991|n-gpc-paletilla-de-cabrito-cortada-a-esc|c
shoulder square cut 4 ribs unece 304032|n-gpc-paletilla-de-cerdo-cortada-a-escua-4|c
shoulder square cut 5 rib unece 504990|n-gpc-paletilla-de-cabrito-cortada-a-esc-2|c
shoulder square cut 6 rib unece 504992|n-gpc-paletilla-de-cabrito-cortada-a-esc-3|c
shoulder teres major|n-gpc-shoulder-teres-major|c
shoulder upper half boston butt 1 rib unece 304062|n-gpc-paletilla-mitad-superior-1-costill|c
shoulder upper half boston butt 2 ribs unece 304061|n-gpc-paletilla-mitad-superior-2-costill|c
shoulder upper half boston butt 3 ribs|n-gpc-paletilla-mitad-superior-3-costill|c
shoulder upper half boston butt 4 ribs unece 304059|n-gpc-paletilla-mitad-superior-4-costill|c
shoulder upper half boston butt boneless unece 304245|n-gpc-paletilla-mitad-superior-deshuesad|c
sicyonia carinata|n-f-camaron-rasposo|s
side unece 504650|n-gpc-media-canal-de-cabrito|c
sidra|n-gpc-sidra|a
sidra espumosa|n-gpc-sidra-espumosa|a
sidrunkollane talioun|n-gpc-sidrunkollane-talioun|c
siegerrebe|n-gpc-siegerrebe|c
siegerrebe/ortega|n-gpc-siegerrebe-ortega|c
sierra americano|n-f-sierra-americano|o
signe tillisch|n-gpc-signe-tillisch|c
sijsjespeer|n-gpc-sijsjespeer|c
silla de cabrito|n-gpc-silla-de-cabrito|a
silla de carre de cordero 6 costillas|n-gpc-silla-de-carre-de-cordero-6-costil|a
silla de carre de cordero 7 costillas|n-gpc-silla-de-carre-de-cordero-7-costil|a
silla de carre de cordero 8 costillas|n-gpc-silla-de-carre-de-cordero-8-costil|a
silla de carre de cordero 9 costillas|n-gpc-silla-de-carre-de-cordero-9-costil|a
silla de cordero 10 costillas|n-gpc-silla-de-cordero-10-costillas|a
silla de cordero 11 costillas|n-gpc-silla-de-cordero-11-costillas|a
silla de cordero 12 costillas|n-gpc-silla-de-cordero-12-costillas|a
silla de cordero 13 costillas|n-gpc-silla-de-cordero-13-costillas|a
silla de cordero 7 costillas|n-gpc-silla-de-cordero-7-costillas|a
silla de cordero 8 costillas|n-gpc-silla-de-cordero-8-costillas|a
silla de cordero 9 costillas|n-gpc-silla-de-cordero-9-costillas|a
sillago plateado|n-f-sillago-plateado|o
sillago sihama|n-f-sillago-plateado|s
siluro|n-f-siluro|o
silurus glanis|n-f-siluro|s
silverside unece 505071|n-gpc-culata-de-contra-de-cabrito|c
similiparma lurida|n-f-fula-negra|s
sinap orlovskij|n-gpc-sinap-orlovskij|c
single leaf salad greens|n-gpc-hoja-de-ensalada-entera|a
single leaf salad greens|n-vegetable|a
single leaf salad greens fresh cut|n-gpc-hoja-de-ensalada-entera|a
sirius|n-gpc-sirius|c
sirloin|n-b-lomo-bajo|a
sirloin rump boneless unece 304305|n-gpc-cadera-de-cerdo-deshuesada|c
sirloin rump unece 304130|n-gpc-cadera-de-cerdo|c
sirope y melaza|n-gpc-sirope-y-melaza|a
skovfoged|n-gpc-skovfoged|c
slant cut drumstick unece 701202|n-gpc-jamoncito-de-pollo-de-corte-sesgad|c
small fruit variety packs|n-gpc-surtidos-de-frutos-rojos|a
smederevka|n-gpc-smederevka|c
smitten|n-gpc-smitten|c
snack|n-d-aperitivo|a
snacks|n-d-aperitivo|a
snacks other|n-d-aperitivo|a
snacks variety packs|n-gpc-surtidos-de-aperitivos|a
snow peas|n-v-tirabeque|a
snygold|n-gpc-snygold|c
soave|n-gpc-soave|c
sobrasada|n-sobrasada|a
sobrasada de mallorca|n-m-sobrasada-de-mallorca|a
sobrasada mallorquina|n-m-sobrasada-de-mallorca|a
sobrasada picante|n-sobrasada|a
sofrito|n-v-sofrito|a
sofrito de verduras|n-v-sofrito|a
solanacea/others|n-gpc-solanaceas-y-otras|a
solanacea/others fresh cut|n-gpc-solanaceas-y-otras|a
solanaceas y otras|n-gpc-solanaceas-y-otras|a
solaris|n-gpc-solaris|c
soldado|n-f-soldado|o
soldat laboureur|n-gpc-soldat-laboureur|c
solea aegyptiaca|n-f-lenguado-egipcio|s
solea senegalensis|n-f-lenguado-senegales|s
solea solea|n-f-lenguado-europeo|s
solen lamarckii|n-f-longueiron|s
solen marginatus|n-f-longueiron|s
solenocera agassizii|n-f-gamba|s
solenocera crassicornis|n-f-gamba|s
solenocera melantho|n-f-gamba|s
solenocera membranacea|n-f-gamba|s
solla|n-f-solla|o
solla del pacifico|n-f-solla-del-pacifico|o
solleta|n-f-solleta|o
solomillito|n-p-solomillo-de-cerdo|a
solomillo|n-tenderloin|a
solomillo de cabrito|n-gpc-solomillo-de-cabrito|a
solomillo de cerdo|n-p-solomillo-de-cerdo|a
solomillo de cerdo corte unece|n-gpc-solomillo-de-cerdo-corte-unece|a
solomillo de cordero|n-gpc-solomillo-de-cordero|a
solomillo de cordero cabeza|n-gpc-solomillo-de-cordero-cabeza|a
solomillo de cordero sin cabeza|n-gpc-solomillo-de-cordero-sin-cabeza|a
solomillo de pavo con tendon|n-gpc-solomillo-de-pavo-con-tendon|a
solomillo de pavo con tendon recortado|n-gpc-solomillo-de-pavo-con-tendon-recor|a
solomillo de pollo|n-gpc-solomillo-de-pollo|a
solomillo de pollo sin punta de tendon|n-gpc-solomillo-de-pollo-sin-punta-de-te|a
solomillo de vacuno|n-tenderloin|a
solomillo de vacuno|n-gpc-solomillo-de-vacuno|a
solomillo de vacuno sin cadena|n-gpc-solomillo-de-vacuno-sin-cadena|a
solomillo gallego|n-tenderloin-gal|a
solomillo iberico|n-p-solomillo-de-cerdo|a
solrayo|n-f-solrayo|o
somalla|n-sausage-cured|a
sommerfeld|n-gpc-sommerfeld|c
sommerregent|n-gpc-sommerregent|c
somniosus microcephalus|n-f-tiburon-boreal|s
sompat|n-f-ronco-moteado|o
sonso|n-f-sonso|o
sonya|n-gpc-sonya|c
sopa|n-d-sopa-preparada|a
sopa preparada|n-d-sopa-preparada|a
sopa preparada|n-gpc-sopas-preparadas|a
sorbete|n-d-helado|a
sorrel|n-gpc-acedera|a
soup additions|n-gpc-ingrediente-para-sopa|a
soup additions frozen|n-gpc-ingrediente-para-sopa|a
soup additions perishable|n-gpc-ingrediente-para-sopa|a
soup additions shelf stable|n-gpc-ingrediente-para-sopa|a
soups prepared|n-gpc-sopas-preparadas|a
soups prepared frozen|n-gpc-sopas-preparadas|a
soups prepared perishable|n-gpc-sopas-preparadas|a
soups prepared shelf stable|n-gpc-sopas-preparadas|a
soups prepared variety packs|n-gpc-surtidos-de-sopas|a
sour cherries|n-gpc-guinda|a
soursop|n-v-guanabana|a
southern rose|n-gpc-southern-rose|c
southern snap|n-gpc-southern-snap|c
souvignier gris|n-gpc-souvignier-gris|c
spadoncina|n-gpc-spadoncina|c
spare ribs 6 rib unece 405015|n-gpc-costillar-bajo-de-cordero-6-costil|c
spare ribs 6 rib unece 505015|n-gpc-costillar-bajo-de-cabrito-6-costil|c
spare ribs 7 rib unece 405016|n-gpc-costillar-bajo-de-cordero-7-costil|c
spare ribs 7 rib unece 505016|n-gpc-costillar-bajo-de-cabrito-7-costil|c
spare ribs 8 rib unece 405017|n-gpc-costillar-bajo-de-cordero-8-costil|c
spare ribs 8 rib unece 505017|n-gpc-costillar-bajo-de-cabrito-8-costil|c
spare ribs 9 rib unece 405018|n-gpc-costillar-bajo-de-cordero-9-costil|c
spare ribs 9 rib unece 505018|n-gpc-costillar-bajo-de-cabrito-9-costil|c
sparisoma cretense|n-f-vieja-colorada|s
spartan|n-gpc-spartan|c
sparus aurata|n-f-dorada|s
spatburgunder|n-gpc-spatburgunder|c
spencer roll 5 rib|n-gpc-lomo-alto-sin-tapa-5-costillas|c
spencer roll 6 rib|n-gpc-lomo-alto-sin-tapa-6-costillas|c
spencer roll 7 rib|n-gpc-lomo-alto-sin-tapa-7-costillas|c
spencer roll 8 rib|n-gpc-lomo-alto-sin-tapa-8-costillas|c
spencer roll 9 rib|n-gpc-lomo-alto-sin-tapa-9-costillas|c
sphaerechinus granularis|n-f-erizo-violaceo|s
sphaerococcus coronopifolius|n-f-falsa-gorgona|s
sphyraena barracuda|n-f-picuda-barracuda|s
sphyraena sphyraena|n-f-espeton|s
sphyraena viridensis|n-f-espeton-boca-amarilla|s
sphyrna zygaena|n-f-cornuda|s
spicara altum|n-f-chucla-ojona|s
spicara maena|n-f-chucla|s
spicara smaris|n-f-caramel|s
spinach|n-v-espinaca|a
spinach fresh|n-vegetable|a
spinach fresh cut|n-v-espinaca|a
spirits|n-gpc-destilado|a
spirits non alcoholic|n-gpc-destilados-sin-alcohol|a
spisula solida|n-clam|s
spisula subtruncata|n-f-almeja-blanca|s
splendour|n-gpc-splendour|c
split breast with back portion unece 700502|n-gpc-media-pechuga-de-pollo-con-parte-d|c
spondyliosoma cantharus|n-f-chopa|s
sports drinks rehydration not ready to drink|n-gpc-preparado-isotonico|a
sports drinks rehydration ready to drink|n-gpc-bebida-isotonica|a
spratelloides gracilis|n-f-arenquillo|s
sprattus fuegensis|n-f-espadin-austral|s
sprattus sprattus|n-f-espadin|s
spring or spanish onions|n-gpc-cebolleta|a
sprouts|n-gpc-brote|a
sq133|n-gpc-sq133|c
sq159|n-gpc-sq159|c
squab/pigeon|n-gpc-pichon|a
squab/pigeon prepared/processed|n-gpc-pichon|a
squab/pigeon unprepared/unprocessed|n-gpc-pichon|a
squalius cephalus|n-f-cacho|s
squalus acanthias|n-f-mielga|s
squalus blainville|n-f-galludo|s
squalus megalops|n-f-galludo-nato|s
square cut shoulder 4 rib unece 404991|n-gpc-paletilla-de-cordero-cortada-a-esc|c
square cut shoulder 5 rib unece 404990|n-gpc-paletilla-de-cordero-cortada-a-esc-2|c
square cut shoulder 6 rib unece 404992|n-gpc-paletilla-de-cordero-cortada-a-esc-3|c
square cut shoulder boneless 4 rib unece 405051|n-gpc-paletilla-de-cordero-cortada-a-esc-4|c
square cut shoulder boneless 5 rib unece 405050|n-gpc-paletilla-de-cordero-cortada-a-esc-5|c
square cut shoulder boneless 6 rib unece 405052|n-gpc-paletilla-de-cordero-cortada-a-esc-6|c
square sweet peppers blunt|n-gpc-pimiento-cuadrado|a
square tapering sweet peppers peg top|n-v-pimiento|a
squash calabaza|n-v-calabaza|a
squash choko|n-gpc-chayote|a
squash opo|n-gpc-calabaza-opo|a
squatina argentina|n-f-angelote-argentino|s
squatina squatina|n-f-angelote|s
squilla mantis|n-f-galera|s
st laurent|n-gpc-st-laurent|c
st louis style ribs unece 304164|n-gpc-costillar-estilo-st-louis|c
staris|n-gpc-staris|c
stark delicious|n-gpc-stark-delicious|c
starking|n-gpc-starking|c
starkrimson|n-gpc-starkrimson|c
starks s earliest|n-gpc-starks-s-earliest|c
starkspur|n-gpc-starkspur|c
stayman|n-gpc-stayman|c
steinschiller|n-gpc-steinschiller|c
stem lettuce|n-gpc-lechuga-de-tallo|a
stem lettuce|n-vegetable|a
stem lettuce fresh cut|n-gpc-lechuga-de-tallo|a
stem vegetables|n-gpc-hortalizas-de-tallo|a
stem vegetables fresh cut|n-gpc-hortalizas-de-tallo|a
stemless/sweet cherries|n-v-cereza|a
stenotomus chrysops|n-f-sargo-atlantico|s
stephanolepis hispida|n-f-lija-aspera|s
sthenoteuthis oualaniensis|n-f-pota-cardena|s
sthenoteuthis pteropus|n-f-pota-naranja|s
stilton|n-q-queso-stilton|a
stimulants/energy drinks|n-gpc-bebida-energetica|a
stimulants/energy drinks not ready to drink|n-gpc-bebida-energetica|a
stimulants/energy drinks ready to drink|n-gpc-bebida-energetica|a
stock/bones|n-gpc-huesos-y-caldo|a
stock/bones frozen|n-gpc-huesos-y-caldo|a
stock/bones perishable|n-gpc-huesos-y-caldo|a
stock/bones shelf stable|n-gpc-huesos-y-caldo|a
stone fruit|n-gpc-fruta-de-hueso|a
stone fruit fresh cut|n-gpc-fruta-de-hueso|a
stonefruit hybrids|n-gpc-hibrido-de-hueso|a
stramonita haemastoma|n-f-boca-roja|s
strangomera bentincki|n-f-machuelo-araucano|s
strawberries|n-v-fresa|a
striploin 0 ribs|n-gpc-lomo-bajo-de-vacuno-sin-costillas|c
striploin 1 rib|n-gpc-lomo-bajo-de-vacuno-1-costilla|c
striploin 2 ribs|n-gpc-lomo-bajo-de-vacuno-2-costillas|c
striploin 3 ribs|n-gpc-lomo-bajo-de-vacuno-3-costillas|c
stripped lower back unece 701401|n-gpc-espalda-baja-de-pollo-limpia|c
stromateus brasiliensis|n-f-pampanito|s
stromateus fiatola|n-f-pampano|s
strongylocentrotus droebachiensis|n-f-erizo-atlantico|s
sturmer pippin|n-gpc-sturmer-pippin|c
subproducto lacteo|n-gpc-subproducto-lacteo|a
succulent|n-gpc-plantas-crasas-comestibles|a
succulent fresh cut|n-gpc-plantas-crasas-comestibles|a
sucedaneo de cafe en capsulas|n-gpc-sucedaneo-de-cafe-en-capsulas|a
sucedaneo de cafe liquido|n-gpc-sucedaneo-de-cafe-liquido|a
sucedaneo de cafe molido|n-gpc-sucedaneo-de-cafe-molido|a
sucedaneo de cafe soluble|n-gpc-sucedaneo-de-cafe-soluble|a
sucedaneo de huevo|n-gpc-sucedaneo-de-huevo|a
sucedaneo de miel|n-gpc-sucedaneo-de-miel|a
sucree de montlucon|n-gpc-sucree-de-montlucon|c
sugar apples|n-gpc-anona|a
sugar candy/sugar candy substitutes confectionery|n-d-golosina|a
sugar cane|n-d-azucar|a
sugar canes|n-d-azucar|a
sugar canes fresh cut|n-d-azucar|a
sugar snap peas|n-gpc-tirabeque-dulce|a
sugar/sugar substitutes|n-d-azucar|a
sugar/sugar substitutes shelf stable|n-d-azucar|a
sugarloaf|n-gpc-pan-de-azucar|a
sugars/sugar substitute products|n-gpc-azucares-y-edulcorantes|a
sugars/sugar substitute products variety packs|n-gpc-surtidos-de-azucares-y-edulcorante|a
sugisdessert|n-gpc-sugisdessert|c
sultaniye|n-gpc-sultaniye|c
summer savoury|n-gpc-ajedrea-de-jardin|a
summerred|n-gpc-summerred|c
sumoll|n-gpc-sumoll|c
sunetta solanderii|n-f-tellina-del-pacifico|s
sunlight|n-gpc-sunlight|c
sunrise|n-gpc-sunrise|c
sunset|n-gpc-sunset|c
suntan|n-gpc-suntan|c
surimi|n-f-surimi|c
surimi cong|n-f-surimi|c
surtido de hierbas|n-gpc-surtido-de-hierbas|a
surtidos de aceites y grasas|n-gpc-surtidos-de-aceites-y-grasas|a
surtidos de alimentacion|n-gpc-surtidos-de-alimentacion|a
surtidos de alimentacion infantil|n-gpc-surtidos-de-alimentacion-infantil|a
surtidos de aperitivos|n-gpc-surtidos-de-aperitivos|a
surtidos de azucares y edulcorantes|n-gpc-surtidos-de-azucares-y-edulcorante|a
surtidos de bebidas|n-gpc-surtidos-de-bebidas|a
surtidos de bebidas alcoholicas|n-gpc-surtidos-de-bebidas-alcoholicas|a
surtidos de bebidas sin alcohol|n-gpc-surtidos-de-bebidas-sin-alcohol|a
surtidos de bocadillos y wraps|n-gpc-surtidos-de-bocadillos-y-wraps|a
surtidos de bolleria dulce|n-gpc-surtidos-de-bolleria-dulce|a
surtidos de cafe e infusiones|n-gpc-surtidos-de-cafe-e-infusiones|a
surtidos de cereales elaborados|n-gpc-surtidos-de-cereales-elaborados|a
surtidos de cereales y legumbres|n-gpc-surtidos-de-cereales-y-legumbres|a
surtidos de condimentos y extractos|n-gpc-surtidos-de-condimentos-y-extracto|a
surtidos de confiteria|n-gpc-surtidos-de-confiteria|a
surtidos de confiteria y azucares|n-gpc-surtidos-de-confiteria-y-azucares|a
surtidos de elaborados de cereal|n-gpc-surtidos-de-elaborados-de-cereal|a
surtidos de encurtidos y aceitunas|n-gpc-surtidos-de-encurtidos-y-aceitunas|a
surtidos de fruta|n-gpc-surtidos-de-fruta|a
surtidos de fruta cortada|n-gpc-surtidos-de-fruta-cortada|a
surtidos de fruta verdura y frutos secos|n-gpc-surtidos-de-fruta-verdura-y-frutos|a
surtidos de fruta y frutos secos|n-gpc-surtidos-de-fruta-y-frutos-secos|a
surtidos de fruta y verdura sin elaborar|n-gpc-surtidos-de-fruta-y-verdura-sin-el|a
surtidos de frutos rojos|n-gpc-surtidos-de-frutos-rojos|a
surtidos de galletas|n-gpc-surtidos-de-galletas|a
surtidos de granos y harinas|n-gpc-surtidos-de-granos-y-harinas|a
surtidos de grasas|n-gpc-surtidos-de-grasas|a
surtidos de hierbas y especias|n-gpc-surtidos-de-hierbas-y-especias|a
surtidos de hoja|n-gpc-surtidos-de-hoja|a
surtidos de hoja cortada|n-gpc-surtidos-de-hoja-cortada|a
surtidos de iv gama|n-gpc-surtidos-de-iv-gama|a
surtidos de lacteos y huevos|n-gpc-surtidos-de-lacteos-y-huevos|a
surtidos de marisco|n-gpc-surtidos-de-marisco|a
surtidos de masas|n-gpc-surtidos-de-masas|a
surtidos de panaderia|n-gpc-surtidos-de-panaderia|a
surtidos de pasta|n-gpc-surtidos-de-pasta|a
surtidos de pimiento|n-gpc-surtidos-de-pimiento|a
surtidos de platos con lacteos y huevo|n-gpc-surtidos-de-platos-con-lacteos-y-h|a
surtidos de platos de verdura|n-gpc-surtidos-de-platos-de-verdura|a
surtidos de platos preparados|n-gpc-surtidos-de-platos-preparados|a
surtidos de platos preparados y conservas|n-gpc-surtidos-de-platos-preparados-y-co|a
surtidos de postres y coberturas|n-gpc-surtidos-de-postres-y-coberturas|a
surtidos de reposteria|n-gpc-surtidos-de-reposteria|a
surtidos de salsas y condimentos|n-gpc-surtidos-de-salsas-y-condimentos|a
surtidos de sopas|n-gpc-surtidos-de-sopas|a
surtidos de sustitutos de carne|n-gpc-surtidos-de-sustitutos-de-carne|a
surtidos de sustitutos de marisco|n-gpc-surtidos-de-sustitutos-de-marisco|a
surtidos de sustitutos de pescado|n-gpc-surtidos-de-sustitutos-de-pescado|a
surtidos de tomate|n-gpc-surtidos-de-tomate|a
surtidos de untables dulces|n-gpc-surtidos-de-untables-dulces|a
surtidos de verdura|n-gpc-surtidos-de-verdura|a
surtidos de verdura cortada|n-gpc-surtidos-de-verdura-cortada|a
surtidos de vinagres y vinos de cocina|n-gpc-surtidos-de-vinagres-y-vinos-de-co|a
sustituto de carne|n-d-sustituto-de-carne|a
sustituto de carne de origen animal|n-gpc-sustituto-de-carne-de-origen-anima|a
sustituto de marisco de origen animal|n-gpc-sustituto-de-marisco-de-origen-ani|a
sustituto de nata|n-gpc-sustituto-de-nata|a
sustituto de pescado de origen animal|n-gpc-sustituto-de-pescado-de-origen-ani|a
sustituto de postre|n-gpc-sustituto-de-postre|a
sustituto de queso|n-gpc-sustituto-de-queso|a
sustituto de yogur|n-gpc-sustituto-de-yogur|a
sustituto vegetal de carne|n-gpc-sustituto-vegetal-de-carne|a
sustituto vegetal de marisco|n-gpc-sustituto-vegetal-de-marisco|a
sustituto vegetal de pescado|n-gpc-sustituto-vegetal-de-pescado|a
susumaniello|n-gpc-susumaniello|c
suvenirs|n-gpc-suvenirs|c
svatava|n-gpc-svatava|c
swedish turnips rutabagas|n-gpc-colinabo|a
sweet bakery products|n-gpc-bolleria-dulce|a
sweet bakery products variety packs|n-gpc-surtidos-de-bolleria-dulce|a
sweet caroline|n-gpc-sweet-caroline|c
sweet cicely|n-gpc-perifollo-oloroso|a
sweet granadilla|n-gpc-granadilla|a
sweet pitayas|n-gpc-pitaya-dulce|a
sweet potato stems|n-gpc-tallo-de-boniato|a
sweet potatoes|n-v-boniato|a
sweet spreads|n-gpc-untables-dulces|a
sweet spreads variety packs|n-gpc-surtidos-de-untables-dulces|a
sweetcorn|n-gpc-maiz-dulce|a
sweetie|n-gpc-sweetie|a
sweeties|n-gpc-sweetie|a
swiss cheese|n-gpc-queso-suizo|c
syacium micrurum|n-f-limanda-del-canal|s
sylvaner silvaner|n-gpc-sylvaner-silvaner|c
sylvaner/riesling|n-gpc-sylvaner-riesling|c
symphodus cinereus|n-f-bodion|s
symphodus melops|n-f-porredana|s
symphodus tinca|n-f-bodion|s
symphodus trutta|n-f-romero|s
symphony|n-gpc-symphony|c
sympterygia bonapartii|n-f-raya-marmorada|s
synaphobranchus kaupii|n-f-morena|s
synapturichthys kleinii|n-f-lenguado-de-klein|s
synchiropus phaeton|n-f-dragoncillo-rojo|s
syngnathus typhle|n-f-aguja-mula|s
synodus saurus|n-f-lagarto|s
synodus synodus|n-f-lagarto-capitan|s
syrah shiraz|n-gpc-syrah-shiraz|c
syrah/alicante bouschet/tempranillo|n-gpc-syrah-alicante-bouschet-tempranill|c
syrah/alicante bouschet/trincadeira|n-gpc-syrah-alicante-bouschet-trincadeir|c
syrah/cabernet sauvignon|n-gpc-syrah-cabernet-sauvignon|c
syrah/cabernet sauvignon/malbec|n-gpc-syrah-cabernet-sauvignon-malbec|c
syrah/cabernet sauvignon/merlot|n-gpc-syrah-cabernet-sauvignon-merlot|c
syrah/carignan/grenache|n-gpc-syrah-carignan-grenache|c
syrah/cornalin/humagne rouge/diolinoir/cabernet franc|n-gpc-syrah-cornalin-humagne-rouge-dioli|c
syrah/grenache|n-gpc-syrah-grenache|c
syrah/grenache/carignan|n-gpc-syrah-grenache-carignan|c
syrah/grenache/cinsault/cabernet sauvignon/viognier|n-gpc-syrah-grenache-cinsault-cabernet-s|c
syrah/grenache/mourvedre|n-gpc-syrah-grenache-mourvedre|c
syrah/malbec|n-gpc-syrah-malbec|c
syrah/merlot|n-gpc-syrah-merlot|c
syrah/merlot/cabernet sauvignon|n-gpc-syrah-merlot-cabernet-sauvignon|c
syrah/merlot/tempranillo|n-gpc-syrah-merlot-tempranillo|c
syrah/mourvedre|n-gpc-syrah-mourvedre|c
syrah/mourvedre/grenache/tempranillo|n-gpc-syrah-mourvedre-grenache-tempranil|c
syrah/muscadelle|n-gpc-syrah-muscadelle|c
syrah/sangiovese|n-gpc-syrah-sangiovese|c
syrah/touriga nacional|n-gpc-syrah-touriga-nacional|c
syrah/viognier|n-gpc-syrah-viognier|c
syrup/treacle/molasses|n-gpc-sirope-y-melaza|a
syrup/treacle/molasses shelf stable|n-gpc-sirope-y-melaza|a
tabella|n-v-tabella|c
tabernero|n-f-tabernero|o
table grapes|n-gpc-uva-de-mesa|a
taeniurops grabatus|n-f-pastinaca-negra|s
tagelus dombeii|n-f-navajuela|s
tail unece 701501|n-gpc-rabadilla-de-pollo|c
tails unece 711501|n-gpc-rabadillas-de-pavo|c
taleggio|n-q-queso-taleggio|a
talia|n-gpc-talia|c
talisman|n-f-talisman|o
tallo de boniato|n-gpc-tallo-de-boniato|a
talvenauding|n-gpc-talvenauding|c
tamaioasa romaneasca|n-gpc-tamaioasa-romaneasca|c
tamarez|n-gpc-tamarez|c
tamarillo|n-gpc-tamarillo|a
tamarind|n-v-tamarindo|a
tamarindo|n-v-tamarindo|c
tambor|n-f-tambor|o
tambor real|n-f-tambor-real|o
tanaka|n-f-tanaka|o
tangerines|n-v-mandarina|a
tangor|n-gpc-tangor|a
tannat|n-gpc-tannat|c
tannat/merlot|n-gpc-tannat-merlot|c
tapa|n-b-tapa|a
tapa capa|n-gpc-tapa-capa|a
tapa de cabrito|n-gpc-tapa-de-cabrito|a
tapa de cabrito sin capa|n-gpc-tapa-de-cabrito-sin-capa|a
tapa de ternera|n-b-tapa|a
tapa de vacuno|n-gpc-tapa-de-vacuno|a
tapa sin capa|n-gpc-tapa-sin-capa|a
tapa sin capa limpia|n-gpc-tapa-sin-capa-limpia|a
tapilla|n-b-tapilla|a
tapilla de cadera|n-gpc-tapilla-de-cadera|a
taractes rubescens|n-f-palometa-de-quilla|s
taractichthys longipinnis|n-f-cangullo|s
taro|n-gpc-taro|a
tarpon|n-f-tarpon|o
tarragon|n-gpc-estragon|a
tarrango|n-gpc-tarrango|c
tarrina de helado|n-d-helado|a
tasarte|n-f-tasarte|o
tatsoi|n-gpc-tatsoi|a
tauberschwarz|n-gpc-tauberschwarz|c
taunton cross|n-gpc-taunton-cross|c
taurasi|n-gpc-taurasi|c
tawera elliptica|n-f-almeja-del-pacifico|s
taylor s gold|n-gpc-taylor-s-gold|c
te|n-d-infusion|a
te concentrado|n-gpc-te-concentrado|a
te en capsulas|n-gpc-te-en-capsulas|a
te listo para beber|n-gpc-te-listo-para-beber|a
te soluble|n-gpc-te-soluble|a
tea and infusions/tisanes|n-gpc-te-e-infusiones|a
tea bags/loose|n-d-infusion|a
tea capsules/pods|n-gpc-te-en-capsulas|a
tea instant|n-gpc-te-soluble|a
tea liquid/not ready to drink|n-gpc-te-concentrado|a
tea liquid/ready to drink|n-gpc-te-listo-para-beber|a
telamon|n-gpc-telamon|c
telescoped carcass unece 404505|n-gpc-canal-de-cordero-telescopada|c
tellerina|n-f-tellerina|o
tellina austral|n-f-tellina-austral|o
tellina del pacifico|n-f-tellina-del-pacifico|o
tellina tuatua|n-f-tellina-tuatua|o
tellisaare|n-gpc-tellisaare|c
telti kuruk|n-gpc-telti-kuruk|c
teltow turnips|n-gpc-nabo-de-teltow|a
tembladera|n-f-tembladera|o
tembladera de lunares|n-f-tembladera-de-lunares|o
tempranillo|n-gpc-tempranillo|a
tempranillo aragonez/arauxa/tinta de toro/tinta del pais/tinta roriz/tinto fino/ull de llebre|n-gpc-tempranillo|c
tempranillo blanco|n-gpc-tempranillo-blanco|c
tempranillo/cabernet sauvignon|n-gpc-tempranillo-cabernet-sauvignon|c
tempranillo/cabernet sauvignon/merlot|n-gpc-tempranillo-cabernet-sauvignon-mer|c
tempranillo/cabernet sauvignon/syrah|n-gpc-tempranillo-cabernet-sauvignon-syr|c
tempranillo/graciano|n-gpc-tempranillo-graciano|c
tempranillo/graciano/grenache|n-gpc-tempranillo-graciano-grenache|c
tempranillo/graciano/maturana tinta|n-gpc-tempranillo-graciano-maturana-tint|c
tempranillo/graciano/mazuelo|n-gpc-tempranillo-graciano-mazuelo|c
tempranillo/grenache|n-gpc-tempranillo-grenache|c
tempranillo/grenache/cabernet sauvignon|n-gpc-tempranillo-grenache-cabernet-sauv|c
tempranillo/grenache/syrah|n-gpc-tempranillo-grenache-syrah|c
tempranillo/grenache/viognier|n-gpc-tempranillo-grenache-viognier|c
tempranillo/malbec|n-gpc-tempranillo-malbec|c
tempranillo/mazuelo/graciano|n-gpc-tempranillo-mazuelo-graciano|c
tempranillo/merlot|n-gpc-tempranillo-merlot|c
tempranillo/petit verdot|n-gpc-tempranillo-petit-verdot|c
tempranillo/syrah/cabernet sauvignon|n-gpc-tempranillo-syrah-cabernet-sauvign|c
tempranillo/touriga nacional/syrah|n-gpc-tempranillo-touriga-nacional-syrah|c
tempranillo/touriga nacional/touriga franca|n-gpc-tempranillo-touriga-nacional-touri|c
tempranillo/touriga nacional/trincadeira|n-gpc-tempranillo-touriga-nacional-trinc|c
tenca|n-f-tenca|o
tenderloin / inner fillet / tender / small fillet unece 700801|n-gpc-solomillo-de-pollo|c
tenderloin butt off unece 405082|n-gpc-solomillo-de-cordero-sin-cabeza|c
tenderloin unece 304280|n-gpc-solomillo-de-cerdo-corte-unece|c
tenderloin unece 405080|n-gpc-solomillo-de-cordero|c
tenderloin unece 505080|n-gpc-solomillo-de-cabrito|c
tenderloin with tendon clipped unece 710802|n-gpc-solomillo-de-pavo-con-tendon-recor|c
tenderloin with tendon tip off unece 700802|n-gpc-solomillo-de-pollo-sin-punta-de-te|c
tenderloin with tendon unece 710801|n-gpc-solomillo-de-pavo-con-tendon|c
tendones de pavo|n-gpc-tendones-de-pavo|a
tendons straps unece 716021|n-gpc-tendones-de-pavo|c
tenroy|n-gpc-tenroy|c
tercer segmento de ala de pavo|n-gpc-tercer-segmento-de-ala-de-pavo|a
termitas|n-gpc-termitas|a
termites|n-gpc-termitas|a
termites prepared/processed|n-gpc-termitas|a
termites unprepared/unprocessed|n-gpc-termitas|a
ternera|n-gpc-ternera|a
ternera de primera|n-meat|c
ternera de segunda|n-meat|c
ternera extra|n-meat|c
terodola|n-gpc-terodola|c
teroldego|n-gpc-teroldego|c
teroldego/merlot/cabernet sauvignon|n-gpc-teroldego-merlot-cabernet-sauvigno|c
teroldego/petit verdot/cabernet sauvignon/sangiovese|n-gpc-teroldego-petit-verdot-cabernet-sa|c
teroldego/sauvignon blanc|n-gpc-teroldego-sauvignon-blanc|c
terrano|n-gpc-terrano|c
terret|n-gpc-terret|c
terret noir|n-gpc-terret-noir|c
teruel|n-m-jamon-de-teruel|a
testes / fries / testicles unece 702201|n-gpc-criadillas-de-pollo|c
testes unece 712201|n-gpc-criadillas-de-pavo|c
tetilla|n-q-queso-tetilla|a
tetrapturus angustirostris|n-f-marlin-trompa|s
tetrapturus belone|n-f-aguja-de-pico-corto|s
tetrapturus georgii|n-f-marlin-peto|s
tetrapturus pfluegeri|n-f-aguja-picuda|s
tetraselmis suecica|n-f-microalga-tetraselmis|s
thalassoma pavo|n-f-peje-verde|s
thamnaconus septentrionalis|n-f-pez-ballesta-chino|s
thenus orientalis|n-f-cigarra-oriental|s
thick flank|n-gpc-babilla-con-tapilla|c
thick flank unece 505076|n-gpc-babilla-con-tapilla-de-cabrito|c
thick skirt hanging tender|n-gpc-entrana-gruesa|c
thigh / leg skin unece 712302|n-gpc-piel-de-contramuslo-y-jamoncito-de-2|c
thigh and leg skin unece 702302|n-gpc-piel-de-contramuslo-y-jamoncito-de|c
thigh trimmings unece 716005|n-gpc-recortes-de-contramuslo-de-pavo|c
thigh unece 701101|n-gpc-contramuslo-de-pollo-deshuesado|c
thigh unece 711101|n-gpc-contramuslo-de-pavo-deshuesado|c
thimo|n-gpc-thimo|c
thin flank|n-gpc-falda-de-vacuno|c
thin skirt outside skirt|n-gpc-entrana-exterior|c
third section wing unece 711306|n-gpc-tercer-segmento-de-ala-de-pavo|c
thrapsathiri|n-gpc-thrapsathiri|c
thunnus alalunga|n-f-atun-blanco|s
thunnus albacares|n-f-rabil|s
thunnus atlanticus|n-f-atun-de-aleta-negra|s
thunnus maccoyii|n-f-atun-del-sur|s
thunnus obesus|n-f-patudo|s
thunnus orientalis|n-f-atun-del-pacifico|s
thunnus thynnus|n-f-atun-rojo|s
thunnus tonggol|n-f-atun-tongol|s
thurgauer weinapfel|n-gpc-thurgauer-weinapfel|c
tibouren|n-gpc-tibouren|c
tiburon arenero|n-f-tiburon-arenero|o
tiburon baboso|n-f-tiburon-baboso|o
tiburon boreal|n-f-tiburon-boreal|o
tiburon cobrizo|n-f-tiburon-cobrizo|o
tiburon cocodrilo|n-f-tiburon-cocodrilo|o
tiburon de galapagos|n-f-tiburon-de-galapagos|o
tiburon de puntos negros|n-f-tiburon-de-puntos-negros|o
tiburon lagarto|n-f-tiburon-lagarto|o
tiburon trozo|n-f-tiburon-trozo|o
tidal sea vegetables|n-gpc-verduras-marinas|a
tidal sea vegetables fresh cut|n-gpc-verduras-marinas|a
tidal sea vegetables other|n-gpc-verdura-marina|a
tiina|n-gpc-tiina|c
tilapia|n-f-tilapia|o
tilapia de mozambique|n-f-tilapia-de-mozambique|o
tilsit|n-gpc-queso-tilsit|c
tinca tinca|n-f-tenca|s
tinta amarela|n-gpc-tinta-amarela|c
tinta barroca|n-gpc-tinta-barroca|c
tinta franca|n-gpc-tinta-franca|c
tinta francisca|n-gpc-tinta-francisca|c
tinta grossa|n-gpc-tinta-grossa|c
tinta miuda|n-gpc-tinta-miuda|c
tinta pinheira|n-gpc-tinta-pinheira|c
tinta roriz/touriga nacional|n-gpc-tinta-roriz-touriga-nacional|c
tinto|n-f-tinto|o
tinto cao|n-gpc-tinto-cao|c
tintorera|n-f-tintorera|o
tintorera o caella|n-f-tintorera|c
tintorera o caella cong|n-f-tintorera|c
tirabeque|n-v-tirabeque|c
tirabeque dulce|n-gpc-tirabeque-dulce|a
tirabeques|n-v-tirabeque|c
tiras de calamar|n-f-calamar|c
tocai|n-gpc-tocai|c
tocai friulano|n-gpc-tocai-friulano|c
tocineta|n-p-panceta|a
tocino|n-lardo|a
tocino adobado|n-panceta-curada|a
tocino blanco|n-lardo|a
tocino de paletilla|n-gpc-tocino-de-paletilla|a
tocino dorsal|n-gpc-tocino-dorsal|a
tocino entreverado ahumado|n-bacon|a
tocino salado|n-lardo|a
todarodes pacificus|n-f-pota-japonesa|s
todarodes sagittatus|n-f-volador|s
todaropsis eblanae|n-f-pota|s
tofu|n-d-sustituto-de-carne|a
tokay pinot gris|n-gpc-tokay-pinot-gris|c
tollo flecha|n-f-tollo-flecha|o
tollo lucero|n-f-tollo-lucero|o
tollo lucero liso|n-f-tollo-lucero-liso|o
tollo lucero raspa|n-f-tollo-lucero-raspa|o
tollo negro|n-f-tollo-negro|o
tollo pajarito|n-f-tollo-pajarito|o
tomas|n-f-tomas|o
tomate|n-tomato|a
tomate alargado|n-gpc-tomate-alargado|a
tomate asurcado|n-gpc-tomate-asurcado|a
tomate bufalo|n-tomato|c
tomate bufalo|n-v-tomate-bufalo|c
tomate cherry|n-tomato-cherry|a
tomate cherry|n-tomato|c
tomate cherry alargado|n-gpc-tomate-cherry-alargado|a
tomate cherry redondo|n-gpc-tomate-cherry-redondo|a
tomate daniela|n-tomato|c
tomate daniela|n-v-tomate-daniela|c
tomate de importacion|n-tomato|c
tomate en rama|n-tomato|c
tomate en rama|n-tomato-vine|c
tomate granada zafarraya|n-tomato|c
tomate granada zafarraya|n-v-tomate-granada-zafarraya|c
tomate kumato|n-tomato|c
tomate kumato|n-v-tomate-kumato|c
tomate label vasco y simi|n-tomato|c
tomate label vasco y simi|n-v-tomate-label-vasco-y-simi|c
tomate liso rojo canario|n-tomato|c
tomate liso rojo canario|n-v-tomate-liso-rojo-canario|c
tomate maduro|n-tomato|c
tomate maduro|n-v-tomate-maduro|c
tomate mazarron|n-tomato|c
tomate mazarron|n-v-tomate-mazarron|c
tomate muchamiel|n-tomato|c
tomate muchamiel|n-v-tomate-muchamiel|c
tomate navarra/aragon|n-tomato|c
tomate navarra/aragon|n-v-tomate-navarra-aragon|c
tomate o v|n-tomato|c
tomate pera|n-tomato-plum|a
tomate pera|n-tomato|c
tomate raf|n-tomato|c
tomate raf|n-v-tomate-raf|c
tomate rama|n-tomato-vine|a
tomate rama griego|n-tomato-vine-gr|a
tomate rambo|n-tomato|c
tomate rambo|n-v-tomate-rambo|c
tomate redondo|n-gpc-tomate-redondo|a
tomate region|n-tomato|c
tomate rosa|n-tomato-pink|a
tomate triturado|n-d-conserva-vegetal|a
tomate verde|n-tomato|c
tomates|n-tomato|c
tomatillo|n-gpc-tomatillo|a
tomatillos|n-gpc-tomatillo|a
tomato ketchup/ketchup substitutes|n-d-salsa|a
tomato ketchup/ketchup substitutes frozen|n-d-salsa|a
tomato ketchup/ketchup substitutes perishable|n-d-salsa|a
tomato ketchup/ketchup substitutes shelf stable|n-d-salsa|a
tomatoes|n-tomato|a
tomatoes fresh cut|n-tomato|a
tomatoes oblong|n-gpc-tomate-alargado|a
tomatoes ribbed|n-gpc-tomate-asurcado|a
tomatoes round|n-gpc-tomate-redondo|a
tomatoes variety packs|n-gpc-surtidos-de-tomate|a
tomillo|n-gpc-tomillo|a
tomillo limonero|n-gpc-tomillo-limonero|a
tomme au raisin|n-gpc-queso-tomme-au-raisin|c
tongol|n-f-atun-tongol|o
topaz variety|n-gpc-topaz-variety|c
topred|n-gpc-topred|c
torbato|n-gpc-torbato|c
tordo de fondo|n-f-tordo-de-fondo|o
tordo negro|n-f-tordo-negro|o
tordo verde|n-f-tordo-verde|o
torillo|n-f-torillo|o
toro bacota|n-f-toro-bacota|o
torpedo marmorata|n-f-tembladera|s
torpedo torpedo|n-f-tembladera-de-lunares|s
torrontes|n-gpc-torrontes|c
torrontes/chardonnay|n-gpc-torrontes-chardonnay|c
torrontes/chenin blanc|n-gpc-torrontes-chenin-blanc|c
toscano|n-gpc-toscano|c
toston|n-p-cochinillo|a
touriga franca|n-gpc-touriga-franca|c
touriga franca/tempranillo/touriga nacional|n-gpc-touriga-franca-tempranillo-touriga|c
touriga franca/touriga nacional/tempranillo/tinto cao/tinta barroca|n-gpc-touriga-franca-touriga-nacional-te|c
touriga nacional|n-gpc-touriga-nacional|c
touriga nacional/tempranillo|n-gpc-touriga-nacional-tempranillo|c
touriga nacional/tempranillo/touriga franca/castelao/alicante bouschet|n-gpc-touriga-nacional-tempranillo-touri|c
touriga nacional/touriga franca/tempranillo/tinta barroca/tinto cao|n-gpc-touriga-nacional-touriga-franca-te|c
touriga nacional/touriga franca/tempranillo/tinta barroca/tinto cao/vinhao|n-gpc-touriga-nacional-touriga-franca-te-2|c
touriga nacional/touriga franca/tempranillo/tinto cao|n-gpc-touriga-nacional-touriga-franca-te-3|c
tournedo|n-o-tournedo-de-cordero|a
tournedo de cordero|n-o-tournedo-de-cordero|a
trachinotus blochii|n-f-palometa-oriental|s
trachinotus ovatus|n-f-palometa-blanca|s
trachinus araneus|n-f-arana|s
trachinus draco|n-f-escorpion|s
trachinus radiatus|n-f-vibora|s
trachipterus arcticus|n-f-cardenal-atlantico|s
trachurus capensis|n-f-jurel-del-cabo|s
trachurus mediterraneus|n-f-jurel-mediterraneo|s
trachurus murphyi|n-f-jurel-chileno|s
trachurus picturatus|n-f-chicharro|s
trachurus trachurus|n-f-jurel|s
trachurus trecae|n-f-jurel-de-cunene|s
trachyrincus scabrus|n-f-pez-conejo|s
trachysalambria curvirostris|n-f-camaron-arquero|s
trachyscorpia cristulata|n-f-cabracho-de-fondo|s
trajadura|n-gpc-trajadura|c
trajan|n-gpc-trajan|c
traminer|n-gpc-traminer|c
traminer/riesling|n-gpc-traminer-riesling|c
transennella pannosa|n-clam|s
transparente de croncels|n-gpc-transparente-de-croncels|c
traseros de pollo|n-a-cuarto-trasero-de-pollo|a
trebbiano di lugana|n-gpc-trebbiano-di-lugana|c
trebbiano di soave|n-gpc-trebbiano-di-soave|c
trebbiano toscano|n-gpc-trebbiano-toscano|c
trebbiano ugni blanc|n-gpc-trebbiano-ugni-blanc|c
trebbiano/malvasia/grechetto|n-gpc-trebbiano-malvasia-grechetto|c
treixadura|n-gpc-treixadura|c
treixadura/albarino|n-gpc-treixadura-albarino|c
trepat|n-gpc-trepat|c
treptacantha barbata|n-f-cystoseira-dorada|s
trevelez|n-m-jamon-de-trevelez|a
trichiurus lepturus|n-f-pez-sable|s
trigla lyra|n-f-garneo|s
trigla spp|n-f-rubio|s
trimmed thigh unece 711103|n-gpc-contramuslo-de-pavo-limpio|c
trimmings unece 304470|n-gpc-recortes-de-cerdo|c
trincadeira|n-gpc-trincadeira|c
trincadeira das pratas|n-gpc-trincadeira-das-pratas|c
triomphe de vienne|n-gpc-triomphe-de-vienne|c
tripa artificial|n-gpc-tripa-artificial|a
tripa de cerdo|n-casing|a
tripa de vacuno|n-c-callos|a
tripa de vacuno|n-casing|a
tripa natural|n-casing|a
tripas y grasas|n-offal|a
trisopterus esmarkii|n-f-faneca-noruega|s
trisopterus luscus|n-f-faneca|s
trisopterus minutus|n-f-capellan|s
tritia mutabilis|n-f-bigaro-blanco|s
trollinger|n-gpc-trollinger|c
trollinger/blaufraenkisch|n-gpc-trollinger-blaufraenkisch|c
trollinger/riesling|n-gpc-trollinger-riesling|c
trompetero|n-f-trompetero|o
tronco de cabrito|n-gpc-tronco-de-cabrito|a
tronco de cabrito con rinonada|n-gpc-tronco-de-cabrito-con-rinonada|a
tronco de cordero|n-gpc-tronco-de-cordero|a
tronco de cordero con rinonada|n-gpc-tronco-de-cordero-con-rinonada|a
trota|n-f-ronco-moteado|o
trousseau|n-gpc-trousseau|c
trucha|n-f-trucha|c
trucha ahumada|n-f-trucha|c
trucha alpina|n-f-trucha-alpina|o
trucha arco iris|n-f-trucha-arco-iris|o
trucha asalmonada|n-f-trucha|c
trucha blanca|n-f-trucha|c
trucha cong|n-f-trucha|c
trucha de|n-f-trucha|c
trucha de +1 kg|n-f-trucha|c
trucha de 1 kg|n-f-trucha|c
trucha lacustre|n-f-trucha-lacustre|o
trucha marina|n-f-reo|o
trucha otras variedades|n-f-trucha|c
trufa|n-gpc-trufa|a
trufa de mar|n-f-alga-pimentera|o
truffles|n-gpc-trufa|a
trunk chump on unece 404720|n-gpc-tronco-de-cordero-con-rinonada|c
trunk chump on unece 504721|n-gpc-tronco-de-cabrito-con-rinonada|c
trunk unece 4720|n-gpc-tronco-de-cordero|c
trunk unece 504720|n-gpc-tronco-de-cabrito|c
tsitska|n-gpc-tsitska|c
tunda|n-gpc-tunda|c
turbiana|n-gpc-turbiana|c
turkey|n-turkey|a
turkey prepared/processed|n-turkey|a
turkey sausages|n-gpc-embutido-de-pavo|a
turkey sausages prepared/processed|n-gpc-embutido-de-pavo|a
turkey unprepared/unprocessed|n-turkey|a
turnip rooted chervil|n-gpc-perifollo-tuberoso|a
turnip tops|n-v-grelo|a
turnips|n-v-nabo|a
turriga isola nuraghi|n-gpc-turriga-isola-nuraghi|c
tuscan|n-gpc-tuscan|c
txistorra|n-chistorra|a
tydeman s early worcester tydeman s early|n-gpc-tydeman-s-early-worcester-tydeman-|c
tylosurus acus|n-f-agujon|s
tyrian|n-gpc-tyrian|c
ucides occidentalis|n-f-cangrejo-de-mar-rojo|s
ugli|n-gpc-ugli|a
ultramarinos|n-grocery|a
ulva clathrata|n-f-lechuga-de-mar|s
ulva compressa|n-f-lechuga-de-mar|s
ulva intestinalis|n-f-aonori|s
ulva lactuca|n-f-lechuga-de-mar|s
ulva linza|n-f-lechuga-de-mar|s
ulva ohnoi|n-f-lechuga-de-mar|s
ulva rigida|n-f-lechuga-de-mar|s
umbrina canariensis|n-f-verrugato-de-fango|s
umbrina cirrosa|n-f-verrugato|s
umbrina ronchus|n-f-verrugato-fusco|s
unb|n-gpc-unb|c
undaria pinnatifida|n-f-abeto-marino|s
upper back unece 701403|n-gpc-espalda-alta-de-pollo|c
uranoscopus scaber|n-f-miracielo|s
urophycis brasiliensis|n-f-brotola-brasilena|s
urophycis chuss|n-f-brotola-roja|s
urophycis tenuis|n-f-brotola-blanca|s
uroteuthis chinensis|n-f-calamar|s
uroteuthis photololigo duvaucelii|n-f-calamar|s
uroteuthis photololigo edulis|n-f-calamar-espada|s
uroteuthis photololigo sibogae|n-f-calamar-siboga|s
uroteuthis photololigo singhalensis|n-f-calamar-indopacifico|s
urta|n-f-urta|o
uta|n-gpc-uta|c
uva|n-v-uva|c
uva albillo|n-v-uva|c
uva albillo|n-v-uva-albillo|c
uva aledo|n-v-uva|c
uva aledo|n-v-uva-aledo|c
uva alfonso lavalle|n-v-uva|c
uva alfonso lavalle|n-v-uva-alfonso-lavalle|c
uva blanca|n-v-uva|c
uva cardinale|n-v-uva|c
uva cardinale|n-v-uva-cardinale|c
uva chelva|n-v-uva|c
uva chelva|n-v-uva-chelva|c
uva de mar|n-f-uva-de-mar|o
uva de mesa|n-gpc-uva-de-mesa|a
uva dominga|n-v-uva|c
uva dominga|n-v-uva-dominga|c
uva espina|n-gpc-uva-espina|a
uva glober|n-v-uva-glober|c
uva glober importacion|n-v-uva|c
uva glober importacion|n-v-uva-glober|c
uva ideal|n-v-uva|c
uva ideal|n-v-uva-ideal|c
uva importacion o v|n-v-uva|c
uva marina|n-f-uva-marina|o
uva michelle parlier|n-v-uva|c
uva michelle parlier|n-v-uva-michelle-parlier|c
uva moscatel espanola|n-v-uva|c
uva moscatel espanola|n-v-uva-moscatel-espanola|c
uva napoleon|n-v-uva|c
uva napoleon|n-v-uva-napoleon|c
uva negra|n-v-uva|c
uva negra otras variedade|n-v-uva|c
uva negra otras variedade|n-v-uva-negra-otras-variedade|c
uva red glober|n-v-uva|c
uva red glober|n-v-uva-red-glober|c
uva rosetti|n-v-uva|c
uva rosetti|n-v-uva-rosetti|c
uva sin semilla blanca|n-v-uva|c
uva sin semilla blanca|n-v-uva-sin-semilla-blanca|c
uva sin semilla negra|n-v-uva|c
uva sin semilla negra|n-v-uva-sin-semilla-negra|c
uva superior sin semilla|n-v-uva|c
uva superior sin semilla|n-v-uva-superior-sin-semilla|c
uva victoria|n-v-uva|c
uva victoria|n-v-uva-victoria|c
uva villanueva|n-v-uva|c
uva villanueva|n-v-uva-villanueva|c
uvas|n-v-uva|c
vaccarese vacarese|n-gpc-vaccarese-vacarese|c
vacio|n-b-vacio|a
vacuno|n-beef|a
vacuno canal|n-beef|c
vacuno casqueria|n-beef|c
vacuno cong sin especif|n-beef|c
vacuno conserva|n-beef|c
vacuno despiece|n-beef|c
vacuno despiece anojo|n-beef|c
vacuno despiece vaca|n-beef|c
vacuno despojo|n-beef|c
vacuno elaborado|n-beef|c
vacuno fresco sin especif|n-beef|c
vacuno precocinado|n-beef|c
valpolicella|n-gpc-valpolicella|c
valpolicella rosso|n-gpc-valpolicella-rosso|c
valse ijsbout|n-gpc-valse-ijsbout|c
valstar|n-gpc-valstar|c
valtod|n-gpc-valtod|c
vanda|n-gpc-vanda|c
vanstraelenia chirophthalma|n-f-lenguado-africano|s
varios|n-d-vario|c
varios|n-grocery|a
vasarine sviestine|n-gpc-vasarine-sviestine|c
veal|n-gpc-ternera|a
veal prepared/processed|n-gpc-ternera|a
veal sausages|n-gpc-embutido-de-ternera|a
veal sausages prepared/processed|n-gpc-embutido-de-ternera|a
veal unprepared/unprocessed|n-gpc-ternera|a
vegeales|n-v-vegeales|c
vegetable based products / meals|n-gpc-platos-a-base-de-verdura|a
vegetable based products / meals not ready to eat frozen|n-gpc-platos-a-base-de-verdura|a
vegetable based products / meals not ready to eat perishable|n-gpc-platos-a-base-de-verdura|a
vegetable based products / meals not ready to eat shelf stable|n-gpc-platos-a-base-de-verdura|a
vegetable based products / meals ready to eat perishable|n-gpc-platos-a-base-de-verdura|a
vegetable based products / meals ready to eat shelf stable|n-gpc-platos-a-base-de-verdura|a
vegetable based products / meals variety packs|n-gpc-surtidos-de-platos-de-verdura|a
vegetable juice|n-gpc-zumo-de-verdura|a
vegetable juice drinks|n-gpc-bebida-de-zumo-de-verdura|a
vegetable juice drinks not ready to drink shelf stable|n-gpc-bebida-de-zumo-de-verdura|a
vegetable juice drinks ready to drink perishable|n-gpc-bebida-de-zumo-de-verdura|a
vegetable juice drinks ready to drink shelf stable|n-gpc-bebida-de-zumo-de-verdura|a
vegetable juice not ready to drink frozen|n-gpc-zumo-de-verdura|a
vegetable juice not ready to drink shelf stable|n-gpc-zumo-de-verdura|a
vegetable juice ready to drink perishable|n-gpc-zumo-de-verdura|a
vegetable juice ready to drink shelf stable|n-gpc-zumo-de-verdura|a
vegetables|n-vegetable|a
vegetables fresh cut|n-gpc-verdura-de-iv-gama|a
vegetables fresh cut variety packs mixed|n-gpc-surtidos-de-verdura-cortada|a
vegetables other|n-gpc-otra-verdura-de-iv-gama|a
vegetables other fresh cut|n-gpc-otra-verdura-de-iv-gama|a
vegetables prepared/processed|n-vegetable|a
vegetables prepared/processed frozen|n-vegetable|a
vegetables prepared/processed perishable|n-vegetable|a
vegetables prepared/processed shelf stable|n-vegetable|a
vegetables unprepared/unprocessed fresh variety packs|n-gpc-surtidos-de-verdura|a
vegetables unprepared/unprocessed frozen|n-vegetable|a
vegetables unprepared/unprocessed shelf stable|n-vegetable|a
vegetables variety packs|n-gpc-surtidos-de-verdura|a
vegetables variety packs mixed|n-gpc-surtidos-de-verdura-cortada|a
vegetables/fruits variety pack fresh cut|n-gpc-surtidos-de-iv-gama|a
vegetal|n-v-vegetal|c
vegetales|n-v-vegetal|c
vegetales cong|n-v-vegetal|c
velodona togata|n-f-pulpo-de-angel|s
venado|n-g-ciervo|a
venera|n-f-vieira|o
venerupis aspera|n-f-almeja-del-pacifico|s
venerupis corrugata|n-clam|s
venus casina|n-f-almeja-casera|s
venus nux|n-f-almeja-de-fondo|s
venus verrucosa|n-f-escupina|s
verdeca|n-gpc-verdeca|c
verdejo|n-gpc-verdejo|a
verdejo gouveio|n-gpc-verdejo|c
verdelho|n-gpc-verdelho|c
verdello|n-gpc-verdello|c
verdi|n-gpc-verdi|c
verdicchio|n-gpc-verdicchio|c
verdil|n-gpc-verdil|c
verdiso|n-gpc-verdiso|c
verdolaga|n-gpc-verdolaga|a
verdura|n-vegetable|a
verdura marina|n-gpc-verdura-marina|a
verduras|n-vegetable|a
verduras marinas|n-gpc-verduras-marinas|a
verduzzo|n-gpc-verduzzo|c
vermentino|n-gpc-vermentino|c
vermentino maremma|n-gpc-vermentino-maremma|c
vermentino sardo|n-gpc-vermentino-sardo|c
vermuel|n-gpc-vermuel|c
vernaccia|n-gpc-vernaccia|c
vernaccia di san gimingnano|n-gpc-vernaccia-di-san-gimingnano|c
vernatsch|n-gpc-vernatsch|c
verrugato|n-f-verrugato|o
verrugato de fango|n-f-verrugato-de-fango|o
verrugato fusco|n-f-verrugato-fusco|o
vespaiolo|n-gpc-vespaiolo|c
vespolina|n-gpc-vespolina|c
veteran|n-gpc-veteran|c
vibora|n-f-vibora|o
vidal vidal blanc|n-gpc-vidal-vidal-blanc|c
vidiano|n-gpc-vidiano|c
vidoc|n-gpc-vidoc|c
vieira|n-f-vieira|o
vieira amerindia|n-f-vieira-amerindia|o
vieira del atlantico|n-f-vieira-del-atlantico|o
vieira del pacifico|n-f-vieira-del-pacifico|o
vieira grande|n-f-vieira|c
vieira japonesa|n-f-vieira-japonesa|o
vieira mediana|n-f-vieira|c
vieira patagonica|n-f-vieira-patagonica|o
vieira pequena|n-f-vieira|c
vieira platillo|n-f-vieira-platillo|o
vieiras|n-f-vieira|c
vieiras cong|n-f-vieira|c
vieiras o v|n-f-vieira|c
vieja|n-f-vieja|c
vieja colorada|n-f-vieja-colorada|o
vieja lomonegro|n-f-vieja-lomonegro|o
vignanello|n-gpc-vignanello|c
vignotte|n-gpc-queso-vignotte|c
vilana|n-gpc-vilana|c
viljee gala|n-gpc-viljee-gala|c
villard noir|n-gpc-villard-noir|c
vimba|n-f-vimba|o
vimba vimba|n-f-vimba|s
vinagre|n-d-vinagre|a
vinagre de jerez|n-d-vinagre|a
vinagre de modena|n-d-vinagre|a
vinagre de vino|n-d-vinagre|a
vinegars|n-d-vinagre|a
vinegars/cooking wines|n-gpc-vinagres-y-vinos-de-cocina|a
vinegars/cooking wines variety packs|n-gpc-surtidos-de-vinagres-y-vinos-de-co|a
vinhao sousao|n-gpc-vinhao-sousao|c
vino|n-d-vino|a
vino de cocina|n-gpc-vino-de-cocina|a
vino espumoso|n-gpc-vino-espumoso|a
vino generoso|n-gpc-vino-generoso|a
vino tranquilo|n-gpc-vino-tranquilo|a
vinos|n-drinks|a
vinos denominac origen|n-d-vino|a
vinos sin d origen|n-d-vino|a
vinsanto|n-gpc-vinsanto|c
viognier|n-gpc-viognier|c
viognier/grenache|n-gpc-viognier-grenache|c
viosinho|n-gpc-viosinho|c
virgen extra|n-d-aceite-de-oliva-virgen-extra|a
virginia gold|n-gpc-virginia-gold|c
vista bella|n-gpc-vista-bella|c
vital|n-gpc-vital|c
vitovska|n-gpc-vitovska|c
viudo|n-f-rufo-derivante|o
viura|n-gpc-viura|c
vivello bianco|n-gpc-vivello-bianco|c
voir lombacad|n-gpc-voir-lombacad|c
volador|n-f-volador|o
voladores o potas|n-f-pota|c
voladores o potas anilla|n-f-pota|c
voladores o potas anilla cong|n-f-pota|c
voladores o potas cong|n-f-pota|c
voladores o potas tubo|n-f-pota|c
voladores o potas tubo cong|n-f-pota|c
volandeira|n-f-volandeira|o
vranec|n-gpc-vranec|c
wakame|n-f-abeto-marino|o
wapiti|n-gpc-wapiti|a
water buffalo|n-gpc-bufalo-de-agua|a
water buffalo prepared/processed|n-gpc-bufalo-de-agua|a
water buffalo unprepared/unprocessed|n-gpc-bufalo-de-agua|a
water chestnuts|n-gpc-castana-de-agua|a
water spinach /ong choy|n-gpc-espinaca-de-agua|a
watercress|n-v-berro|a
watermelons|n-v-sandia|a
wealthy|n-gpc-wealthy|c
weisskaese white cheese|n-gpc-queso-blanco-aleman|c
well spur|n-gpc-well-spur|c
welschriesling|n-gpc-welschriesling|c
wensleydale|n-gpc-queso-wensleydale|c
white cabbages|n-gpc-repollo|a
white cheshire|n-gpc-queso-cheshire-blanco|c
white radish daikon|n-gpc-daikon|a
white tannia|n-gpc-malanga-blanca|a
white transparent|n-gpc-white-transparent|c
white turkey trimmings unece 716001|n-gpc-recortes-de-carne-blanca-de-pavo|c
whole back unece 701404|n-gpc-espalda-entera-de-pollo|c
whole bird unece 700101|n-gpc-pollo-entero|c
whole bird unece 710101|n-gpc-pavo-entero|c
whole bird w/out giblets with half neck unece 700105|n-gpc-pollo-entero-sin-menudillos-con-me|c
whole bird w/out giblets with head unece 700107|n-gpc-pollo-entero-sin-menudillos-con-ca|c
whole bird w/out giblets with long cut drumsticks unece 700104|n-gpc-pollo-entero-sin-menudillos-con-ja|c
whole bird w/out giblets with whole neck unece 700106|n-gpc-pollo-entero-sin-menudillos-con-cu|c
whole bird without giblets unece 700102|n-gpc-pollo-entero-sin-menudillos|c
whole bird without giblets unece 710102|n-gpc-pavo-entero-sin-menudillos|c
whole bird without giblets with head and feet unece 700108|n-gpc-pollo-entero-sin-menudillos-con-ca-2|c
whole breast with ribs and tenderloins unece 700601|n-gpc-pechuga-entera-de-pollo-con-costil|c
whole carcass|n-gpc-canal-entera-de-bovino|c
whole leg / short cut leg unece 701001|n-gpc-cuarto-trasero-de-pollo-de-corte-c|c
whole leg long cut unece 701003|n-gpc-cuarto-trasero-de-pollo-de-corte-l|c
whole leg long cut with thigh and drumstick incision / long cut sujiire unece 701005|n-gpc-cuarto-trasero-de-pollo-de-corte-l-2|c
whole leg unece 711001|n-gpc-cuarto-trasero-entero-de-pavo|c
whole leg with abdominal fat unece 701002|n-gpc-cuarto-trasero-de-pollo-con-grasa-|c
whole leg with thigh and drumstick incision / short cut sujiire unece 701004|n-gpc-cuarto-trasero-de-pollo-de-corte-c-2|c
whole wing unece 701301|n-gpc-ala-entera-de-pollo|c
whole wing unece 711301|n-gpc-ala-entera-de-pavo|c
wild boar|n-g-jabali|a
wild boar prepared/processed|n-g-jabali|a
wild boar unprepared/unprocessed|n-g-jabali|a
wild mushrooms other|n-gpc-seta-silvestre|a
williams|n-gpc-williams|c
williams bon chretien bartlett|n-gpc-williams-bon-chretien-bartlett|c
wilmuta|n-gpc-wilmuta|c
wine fortified|n-gpc-vino-generoso|a
wine sparkling|n-gpc-vino-espumoso|a
wine sparkling non alcoholic|n-gpc-vino-espumoso|a
wine still|n-gpc-vino-tranquilo|a
wine still non alcoholic|n-gpc-vino-tranquilo|a
winesap|n-gpc-winesap|c
wing drummette unece 711304|n-gpc-contramuslito-de-ala-de-pavo|c
wing trimmings unece 716003|n-gpc-recortes-de-ala-de-pavo|c
winged pea|n-gpc-guisante-alado|a
wings with back attached unece 701308|n-gpc-alas-de-pollo-con-espalda|c
winston|n-gpc-winston|c
winter melons or odourless muskmelons|n-gpc-melon-de-invierno|a
winter nelis|n-gpc-winter-nelis|c
winter savoury|n-gpc-ajedrea-de-monte|a
winterrietpeer|n-gpc-winterrietpeer|c
witloof belgian endive|n-v-endivia|a
woelfle|n-gpc-woelfle|c
wood strawberries|n-gpc-fresa-silvestre|a
worcester pearmain|n-gpc-worcester-pearmain|c
wur37|n-gpc-wur37|c
xantho poressa|n-f-carnada-de-vieja|s
xarel lo|n-gpc-xarel-lo|c
xarel lo vermell|n-gpc-xarel-lo-vermell|c
xinxa|n-f-xinxa|o
xiphias gladius|n-f-pez-espada|s
xiphopenaeus kroyeri|n-f-camaron-siete-barbas|s
xynisteri|n-gpc-xynisteri|c
xynomavro|n-gpc-xynomavro|c
xyrichtys novacula|n-f-galan|s
ya pear shandong|n-gpc-pera-ya|a
yaca|n-gpc-yaca|a
yame o name|n-v-name-o-yame|c
yams|n-gpc-name|a
yardlong beans|n-gpc-judia-esparrago|a
yellow dragonfruits|n-gpc-pitaya-amarilla|a
yellow maracujas|n-gpc-maracuya-amarillo|a
ylistrum balloti|n-f-vieira-platillo|s
yogur|n-l-yogur|a
yogures|n-l-yogur|a
yogures y postres|n-yoghurt|a
yogurt|n-l-yogur|a
yogurt frozen|n-l-yogur|a
yogurt perishable|n-l-yogur|a
yogurt shelf stable|n-l-yogur|a
yogurt substitutes|n-gpc-sustituto-de-yogur|a
yogurt substitutes frozen|n-gpc-sustituto-de-yogur|a
yogurt substitutes perishable|n-gpc-sustituto-de-yogur|a
yogurt substitutes shelf stable|n-gpc-sustituto-de-yogur|a
yogurt/yogurt substitutes|n-yoghurt|a
york|n-gpc-york|c
yuca|n-v-yuca|c
zabergau renette|n-gpc-zabergau-renette|c
zailijskoje|n-gpc-zailijskoje|c
zamburina|n-f-zamburina|o
zamburina nordica|n-f-zamburina-nordica|o
zanahoria|n-v-zanahoria|c
zanahoria en rama|n-v-zanahoria|c
zanahoria en rama|n-v-zanahoria-en-rama|c
zanahoria o v|n-v-zanahoria|c
zanahorias|n-v-zanahoria|c
zanahorias o carlota nant|n-v-zanahoria|c
zanahorias o carlota nant|n-v-zanahorias-o-carlota-nant|c
zancarron|n-b-morcillo|a
zapote|n-v-zapote|c
zapote blanco|n-gpc-zapote-blanco|a
zapote negro|n-gpc-zapote-negro|a
zapotes|n-v-zapote|c
zari|n-gpc-zari|c
zenit|n-gpc-zenit|c
zenopsis conchifer|n-f-gallo-plateado|s
zeugopterus punctatus|n-f-rapeta|s
zeus capensis|n-f-san-pedro-del-cabo|s
zeus faber|n-f-pez-de-san-pedro|s
zghihara de husi|n-gpc-zghihara-de-husi|c
zhigulovskoje|n-gpc-zhigulovskoje|c
zibibbo|n-gpc-zibibbo|c
zigeunerin|n-gpc-zigeunerin|c
zinfandel|n-gpc-zinfandel|c
zoete aagt|n-gpc-zoete-aagt|c
zoete bellefleur|n-gpc-zoete-bellefleur|c
zoete brederode|n-gpc-zoete-brederode|c
zoete ermgaard|n-gpc-zoete-ermgaard|c
zoete kroon|n-gpc-zoete-kroon|c
zoete oranje|n-gpc-zoete-oranje|c
zoete pippeling|n-gpc-zoete-pippeling|c
zonga|n-gpc-zonga|c
zuccalmaglio renette|n-gpc-zuccalmaglio-renette|c
zumo|n-d-zumo|a
zumo de fruta|n-gpc-zumo-de-fruta|a
zumo de verdura|n-gpc-zumo-de-verdura|a
zumos|n-d-zumo|a
zure brederode dikkop|n-gpc-zure-brederode-dikkop|c
zuzi gala|n-gpc-zuzi-gala|c
zweigelt blauer zweigelt/rotburger|n-gpc-zweigelt-blauer-zweigelt-rotburger|c
zweigelt/merlot|n-gpc-zweigelt-merlot|c
zweigelt/merlot/blaufraenkisch/cabernet sauvignon|n-gpc-zweigelt-merlot-blaufraenkisch-cab|c
zwijndrechtse wijnpeer|n-gpc-zwijndrechtse-wijnpeer|c
zygochlamys patagonica|n-f-vieira-patagonica|s`;

/* id|fao,fao|sci;sci|code,code */
const ATTRS = `n-a-codorniz|||10006291,10006307
n-a-pato|||10005771,10005790
n-a-pintada|||10006290,10006306
n-avocado|||10006168,10008198,313AAA,50251400
n-b-pez|||241194,251193
n-bakery|||50180000,50181900
n-beef|||10005767,10005786
n-butter|||50131900
n-casing|||10008043
n-cephalopod|||50122000,50122300
n-cheese|||10000028,10000029,10000030,50131800
n-chicken|||10005769,10005788
n-clam|AYQ,CLJ,CTG,MXL,NWP,PAU,ULO,VNR,VUC|Ameghinomya antiqua.;Meretrix lyrata.;Paratapes undulatus.;Polititapes rhomboides.;Ruditapes decussatus.;Ruditapes philippinarum.;Spisula solida.;Transennella pannosa.;Venerupis corrugata.|245201,2453021
n-courgette|||10006015,326BAA
n-d-aceituna|||10000238,10000239,312GAA
n-d-aperitivo|||10007276,50192100
n-d-azucar|||10000043,10006371,10008233,339BAA,50262600
n-d-biscote|||10000166,10000305
n-d-cereal-de-desayuno|||50221200
n-d-cerveza|||10000159,10008029
n-d-chocolate|||10000045
n-d-croqueta|||2571042,2571043,2571045,50193300
n-d-encurtido|||10000244,10006449
n-d-especia|||10006066
n-d-fruto-seco|||10000007,10000008,10000235,10000236,314AAA,314DAA,50101800,50340100
n-d-galleta|||10000160,10000161,10000304,50182100
n-d-garbanzo|||10006271,10008208,50262200
n-d-golosina|||10000047,50161800
n-d-harina|||10000203
n-d-helado|||10000215,10000216,50192300
n-d-infusion|||10000116,10000119
n-d-lenteja|||10006454
n-d-licor|||10000227
n-d-mermelada|||10000187,10000217,50192400
n-d-miel|||10000213
n-d-pan|||10000163,10000164,10000165,50181900
n-d-pasta|||10000240,10000241,10000242,10000317,10000318,50192900
n-d-pizza|||50193300
n-d-plato-preparado|||10006748,10006749,10006750,10006751,10006752,50193800
n-d-refresco|||10000201,10000202
n-d-salsa|||10006317,10006318,10006319,10006320,10006321,10006322,10006323,10006324,10006325,50171800
n-d-sopa-preparada|||50191500
n-d-sustituto-de-carne|||50390100
n-d-vario|||2432019,339ZAA
n-d-vinagre|||10000051
n-dairy|||50130000,50132600
n-drinks|||50200000,50202300
n-f-abade|MKF|Mycteroperca fusca.|
n-f-abade-jaspeado|GBS|Mycteroperca xenarcha.|
n-f-abadejo|POL|Pollachius pollachius.|241111
n-f-abadejo-de-alaska|ALK|Gadus chalcogrammus.|
n-f-abalon-japones|ABJ|Haliotis discus.|
n-f-abeto-marino|UDP|Undaria pinnatifida.|
n-f-abichon|ATP|Atherina presbyter.|
n-f-abuete-negro|GSQ|Grapsus grapsus.|
n-f-acedia|CET|Dicologlossa cuneata.|
n-f-acedia-moteada|DHZ|Microchirus hexophthalmus.|
n-f-acicularis|GJA|Chondracanthus acicularis.|
n-f-aguacioso|ABZ|Ammodytes tobianus.|
n-f-aguila-marina|MYL|Myliobatis aquila.|
n-f-aguja|GAR|Belone belone.|
n-f-aguja-blanca-del-atlantico|WHM|Kajikia albida.|
n-f-aguja-de-pico-corto|MSP|Tetrapturus belone.|
n-f-aguja-mula|STQ|Syngnathus typhle.|
n-f-aguja-negra|BLM|Istiompax indica.|
n-f-aguja-picuda|SPF|Tetrapturus pfluegeri.|
n-f-agujon|AND|Tylosurus acus.|
n-f-alacha|SAA|Sardinella aurita.|
n-f-aleton|DTW|Diretmoides pauciradiatus.|
n-f-alfiler|NRO|Nerophis ophidion.|
n-f-alfonsino|BYS|Beryx splendens.|
n-f-alga-caulerpa|DYY|Caulerpa cylindracea.|
n-f-alga-de-cal|FMK|Phymatolithon calcareum.|
n-f-alga-imperial|GEQ|Gelidium corneum.|
n-f-alga-nori|DZD,OFH|Porphyra umbilicalis.;Pyropia elongata.|
n-f-alga-perfumada|IYJ|Dictyopteris polypodioides.|
n-f-alga-pestana|YWB|Calliblepharis jubata.|
n-f-alga-pimentera|QHE|Osmundea pinnatifida.|
n-f-aligote|SBA|Pagellus acarne.|
n-f-alistado|ARV|Aristeus varidens.|
n-f-alistado-robusto|AVD|Aristeus virilis.|
n-f-alitan|SYT|Scyliorhinus stellaris.|
n-f-almeja-americana|CLH|Mercenaria mercenaria.|
n-f-almeja-artica|CLT|Mactromeris polynyma.|
n-f-almeja-blanca|ULT|Spisula subtruncata.|
n-f-almeja-casera|KFA|Venus casina.|
n-f-almeja-corazon|ITT|Proteopitar patagonicus.|
n-f-almeja-de-concha-blanda|CLS|Mya arenaria.|
n-f-almeja-de-fondo|VNU|Venus nux.|
n-f-almeja-de-perro|OBN|Scrobicularia plana.|
n-f-almeja-del-pacifico|RTV,TWG|Tawera elliptica.;Venerupis aspera.|
n-f-almeja-dorada|VNA|Polititapes aureus.|
n-f-almeja-oriental|HCA|Meretrix meretrix.|
n-f-almeja-propulsora|QYC|Cyrtodaria siliqua.|
n-f-almeja-reina|ZEC|Mulinia edulis.|
n-f-almeja-taca|TCL|Leukoma thaca.|
n-f-almeja-tonta|GCC|Glycymeris nummaria.|
n-f-almejon|KLK|Callista chione.|
n-f-almendra-de-mar|GKL|Glycymeris glycymeris.|
n-f-almendra-peluda|GCJ|Glycymeris pilosa.|
n-f-alosa|TSD|Alosa fallax.|
n-f-amur|FCG|Ctenopharyngodon idella.|
n-f-anago|OOH|Ophichthus remiger.|
n-f-anchoa|ANE|Engraulis encrasicolus.|2413911,2413912
n-f-anchoa-de-california|NPA|Engraulis mordax.|
n-f-anchoa-del-africa-austral|ANC|Engraulis capensis.|
n-f-anchoa-japonesa|JAN|Engraulis japonicus.|
n-f-anchoita|ANA|Engraulis anchoita.|
n-f-anchoveta|VET|Engraulis ringens.|
n-f-andorina|AHN|Anthias anthias.|
n-f-andorrero-del-cabo|EMM|Emmelichthys nitidus.|
n-f-angelote|AGN|Squatina squatina.|
n-f-angelote-argentino|SUG|Squatina argentina.|
n-f-anguila|ELE|Anguilla anguilla.|251195,2572041
n-f-anguila-bicolor|AAT|Anguilla bicolor.|
n-f-anjova|BLU|Pomatomus saltatrix.|
n-f-aonori|UVI|Ulva intestinalis.|
n-f-arana|TZA|Trachinus araneus.|
n-f-arana-plana|NBZ|Percnon gibbesi.|
n-f-arapaima|ARP|Arapaima gigas.|
n-f-arca-antigua|NDQ|Anadara antiquata.|
n-f-arca-de-noe|RKQ|Arca noae.|
n-f-arca-huequera|NRQ|Anadara similis.|
n-f-arca-negra|NQT|Anadara tuberculosa.|
n-f-arenque|HER|Clupea harengus.|
n-f-arenque-del-pacifico|HEP|Clupea pallasii.|
n-f-arenquillo|SRH|Spratelloides gracilis.|
n-f-arete|GUR|Chelidonichthys cuculus.|
n-f-arete-aleton|GUM|Chelidonichthys obscurus.|
n-f-argazo-real|LQX|Saccharina latissima.|
n-f-armado|PJC|Peristedion cataphractum.|
n-f-arola|UTL|Lutraria lutraria.|
n-f-articulata|QHB|Lomentaria articulata.|
n-f-ascophyllum|ASN|Ascophyllum nodosum.|
n-f-atun|||241361
n-f-atun-blanco|ALB|Thunnus alalunga.|
n-f-atun-de-aleta-negra|BLF|Thunnus atlanticus.|
n-f-atun-del-pacifico|PBF|Thunnus orientalis.|
n-f-atun-del-sur|SBF|Thunnus maccoyii.|
n-f-atun-lanzon|SLT|Allothunnus fallai.|
n-f-atun-rojo|BFT|Thunnus thynnus.|
n-f-atun-tongol|LOT|Thunnus tonggol.|
n-f-bacaladilla|WHB|Micromesistius poutassou.|
n-f-bacaladilla-austral|POS|Micromesistius australis.|
n-f-bacalao|COD|Gadus morhua.|241112,2411121,243301,251111,2680061
n-f-bacalao-de-groenlandia|GRC|Gadus ogac.|
n-f-bacalao-del-pacifico|PCO|Gadus macrocephalus.|
n-f-bacalao-negro-de-alaska|SAB|Anoplopoma fimbria.|
n-f-bacoreta|LTA|Euthynnus alletteratus.|
n-f-bacoreta-oriental|KAW|Euthynnus affinis.|
n-f-baga-japonesa|NNJ|Nemipterus japonicus.|
n-f-bagra-del-ganges|BMC|Mystus cavasius.|
n-f-bagre|SMC|Carlarius heudelotii.|
n-f-bagre-blanco|OKB|Ompok bimaculatus.|
n-f-bagre-del-canal|ITP|Ictalurus punctatus.|
n-f-bagre-rojo|BEC|Bagre pinnimaculatus.|
n-f-baila|SPU|Dicentrarchus punctatus.|
n-f-barbada|LCM|Ciliata mustela.|
n-f-barbo-comizo|LWK|Luciobarbus comizo.|
n-f-barbo-comun|LWD|Luciobarbus bocagei.|
n-f-barbo-de-graells|BUG|Luciobarbus graellsii.|
n-f-barbo-de-montana|BUD|Barbus meridionalis.|
n-f-barbo-de-sclater|BSL|Luciobarbus sclateri.|
n-f-barbuda|ENC|Enchelyopus cimbrius.|
n-f-barbudo|PXV|Polymixia nobilis.|
n-f-barbudo-enano-africano|GAL|Galeoides decadactylus.|
n-f-barbudo-real|PET|Pentanemus quinquarius.|
n-f-barrilete|DQE|Afruca tangeri.|2551012
n-f-barrilete-negro|BKJ|Euthynnus lineatus.|
n-f-bejel|GUU|Chelidonichthys lucerna.|
n-f-berberecho|COC|Cerastoderma edule.|245202,255201
n-f-berberecho-de-groenlandia|QRG|Serripes groenlandicus.|
n-f-berberecho-dentado|LVC|Laevicardium crassum.|
n-f-berberecho-gigante-del-atlantico|DKR|Dinocardium robustum.|
n-f-berberecho-rey-de-nueva-zelanda|KNU|Austrovenus stutchburyi.|
n-f-berberecho-verde|KTG|Cerastoderma glaucum.|
n-f-bertorella|GGD|Gaidropsarus mediterraneus.|
n-f-bertorella-artica|GDE|Gaidropsarus ensis.|
n-f-bertorella-azul|ANT|Antimora rostrata.|
n-f-besugo|SBR|Pagellus bogaraveo.|241131,2411322
n-f-besugo-arabe|SXB|Pagellus affinis.|
n-f-bicho|MCF|Macroparalepis affinis.|
n-f-bifurcaria|QRE|Bifurcaria bifurcata.|
n-f-bigaro|PEE|Littorina littorea.|245301
n-f-bigaro-blanco|NSQ|Tritia mutabilis.|
n-f-blanquillo|UAE|Branchiostegus semifasciatus.|
n-f-blanquillo-peruano|ULA|Caulolatilus affinis.|
n-f-bobi|GON|Gobius paganellus.|327CAA
n-f-boca-de-oro|GRA|Parapristipoma octolineatum.|
n-f-boca-roja|HQM|Stramonita haemastoma.|
n-f-bocina|WHE|Buccinum undatum.|
n-f-bocon|EGD,GLI|Epigonus denticulatus.;Glossanodon leioglossus.|
n-f-bocona|VEP|Cetengraulis mysticetus.|
n-f-bodion|YFC,YVT|Symphodus cinereus.;Symphodus tinca.|
n-f-boga|BOG|Boops boops.|241231
n-f-boga-de-rio|HOY|Pseudochondrostoma polylepis.|
n-f-bogavante|||245101,2551014
n-f-bogavante-americano|LBA|Homarus americanus.|
n-f-bogavante-europeo|LBE|Homarus gammarus.|
n-f-bonito|BON|Sarda sarda.|241363,241364
n-f-bonito-austral|BAU|Sarda australis.|
n-f-bonito-del-pacifico|BEP|Sarda chiliensis.|
n-f-bonito-oriental|BIP|Sarda orientalis.|
n-f-breca|PAC|Pagellus erythrinus.|
n-f-breca-chata|PAR|Pagellus bellottii.|
n-f-brosmio|USK|Brosme brosme.|
n-f-brosmio-artico|GPE|Phycis chesteri.|
n-f-brotola-blanca|HKW|Urophycis tenuis.|
n-f-brotola-brasilena|HKU|Urophycis brasiliensis.|
n-f-brotola-criolla|SAO|Salilota australis.|
n-f-brotola-de-fango|GFB|Phycis blennoides.|
n-f-brotola-de-roca|FOR|Phycis phycis.|
n-f-brotola-roja|HKR|Urophycis chuss.|
n-f-bruja|SYR|Scymnodon ringens.|
n-f-buey-austral|CWE|Metacarcinus edwardsii.|
n-f-buey-de-mar|CRE|Cancer pagurus.|2434042,245102
n-f-bunuelo-de-mar|SSG|Microcosmus vulgaris.|
n-f-burgado-hembra|OAW|Phorcus atratus.|
n-f-burgado-iberico|JKU|Phorcus sauciatus.|
n-f-burro|GBR|Plectorhinchus mediterraneus.|
n-f-busano|FNT|Hexaplex trunculus.|
n-f-caballa|MAC|Scomber scombrus.|
n-f-caballa-austral|MAA|Scomber australasicus.|
n-f-caballa-del-sur|MAS|Scomber japonicus.|
n-f-cabete|LDM,LDV,LEP|Lepidotrigla cavillone.;Lepidotrigla dieuzeidei.;Lepidotrigla microptera.|
n-f-caboti|EDE|Pseudaphya ferreri.|
n-f-cabracho|RSE|Scorpaena scrofa.|
n-f-cabracho-de-fondo|TJX|Trachyscorpia cristulata.|
n-f-cabrilla|CBR,SRJ|Serranus cabrilla.;Serranus hepatus.|
n-f-cacho|LUH|Squalius cephalus.|
n-f-cachucho|DEL|Dentex macrophthalmus.|
n-f-cadelucha-listada|DJC|Donacilla cornea.|
n-f-calamar|CHO,OJD,OJH,OJJ,SQF,SQL,SQO,SQP,SQR|Doryteuthis gahi.;Doryteuthis opalescens.;Doryteuthis pealeii.;Loligo forbesii.;Loligo reynaudii.;Loligo vulgaris.;Loliolus japonica.;Uroteuthis (Photololigo) duvaucelii.;Uroteuthis chinensis.|243101,243102,243202,243204,253101,253102,253103,253104,253105,253106,253107,253108,2571041
n-f-calamar-de-arrecife|UHL|Sepioteuthis lessoniana.|
n-f-calamar-espada|OJE|Uroteuthis (Photololigo) edulis.|
n-f-calamar-indopacifico|OJN|Uroteuthis (Photololigo) singhalensis.|
n-f-calamar-paraguas|HQB|Histioteuthis bonnellii.|
n-f-calamar-siboga|OJI|Uroteuthis (Photololigo) sibogae.|
n-f-calamarin-africano|OUK|Alloteuthis africana.|
n-f-calamarin-de-fondo|BLJ|Abralia veranyi.|
n-f-calamarin-menor|OUM|Alloteuthis media.|
n-f-calamarin-picudo|OUL|Alloteuthis subulata.|
n-f-caluga|ODL|Oedalechilus labeo.|
n-f-camaron|CPR,PAN,PVR|Palaemon serratus.;Palaemon varians.;Pandalus spp|255101
n-f-camaron-arquero|TRV|Trachysalambria curvirostris.|
n-f-camaron-blanco|FAV|Pasiphaea sivado.|
n-f-camaron-boreal|PRA|Pandalus borealis.|
n-f-camaron-cabezudo|HKF|Heterocarpus ensifer.|
n-f-camaron-cabezudo-del-alto|HVQ|Heterocarpus grimaldii.|
n-f-camaron-cristal|FAM|Pasiphaea multidentata.|
n-f-camaron-cristal-oriental|LKG|Leptochela gracilis.|
n-f-camaron-de-poza|PNQ|Palaemon elegans.|
n-f-camaron-espinoso|OFI|Pontophilus spinosus.|
n-f-camaron-flecha|LKO|Plesionika heterocarpus.|
n-f-camaron-indico|EKN|Acetes indicus.|
n-f-camaron-indio|HKJ|Heterocarpus gibbosus.|
n-f-camaron-maoxia|ESH|Acetes chinensis.|
n-f-camaron-marcial|LKT|Plesionika martia.|
n-f-camaron-meridional|CSH|Crangon crangon.|
n-f-camaron-moteado|PWY|Pandalus platyceros.|
n-f-camaron-nailon-liso|HKT|Heterocarpus laevigatus.|
n-f-camaron-narval|PVJ|Plesionika narval.|
n-f-camaron-periquito|GFU|Glyphus marsupialis.|
n-f-camaron-rasposo|YIA|Sicyonia carinata.|
n-f-camaron-rayado-de-guinea|EKW|Plesionika williamsi.|
n-f-camaron-rojo|FHZ|Parapasiphae sulcatifrons.|
n-f-camaron-siete-barbas|BOB|Xiphopenaeus kroyeri.|
n-f-camaron-soldado|LKW|Plesionika edwardsii.|
n-f-camaron-verde|HLQ|Chlorotocus crassicornis.|
n-f-camaroncillo|RKD|Processa edulis.|
n-f-camotillo|DLX|Diplectrum maximum.|
n-f-canabota|HXT|Heptranchias perlo.|
n-f-canabota-gris|SBL|Hexanchus griseus.|
n-f-canailla|BOY|Bolinus brandaris.|245302
n-f-canaliculada|FUP|Pelvetia canaliculata.|
n-f-cangrejo|LQA|Polybius navigator.|245103,245104
n-f-cangrejo-africano|CGE|Chaceon maritae.|
n-f-cangrejo-atlantico|CRG,CRK|Cancer irroratus.;Carcinus maenas.|
n-f-cangrejo-austral|HBN|Chaceon notialis.|
n-f-cangrejo-azul|CRB|Callinectes sapidus.|
n-f-cangrejo-azul-japones|GAZ|Portunus trituberculatus.|
n-f-cangrejo-azul-nadador|QSO|Portunus segnis.|
n-f-cangrejo-blanco|UIS|Plagusia depressa.|
n-f-cangrejo-boreal|KCD|Paralithodes camtschaticus.|
n-f-cangrejo-canadiense|CRJ|Cancer borealis.|
n-f-cangrejo-chino|ERS|Eriocheir sinensis.|
n-f-cangrejo-de-arrugas|ICC|Polybius corrugatus.|
n-f-cangrejo-de-california|PCL|Pacifastacus leniusculus.|
n-f-cangrejo-de-fango-australiano|MUD|Scylla serrata.|
n-f-cangrejo-de-las-marismas|RCW|Procambarus clarkii.|
n-f-cangrejo-de-las-nieves|CRQ|Chionoecetes opilio.|
n-f-cangrejo-de-mar-rojo|UCD|Ucides occidentalis.|
n-f-cangrejo-de-rio-europeo|AAS|Astacus astacus.|
n-f-cangrejo-de-rio-real|CRP|Cherax quadricarinatus.|
n-f-cangrejo-del-danubio|CRD|Pontastacus leptodactylus.|
n-f-cangrejo-dorado|HFB|Chaceon fenneri.|
n-f-cangrejo-ermitano-comun|PZW|Pagurus bernhardus.|
n-f-cangrejo-mandarin|QAI|Monomia haani.|
n-f-cangrejo-mediterraneo|CMR|Carcinus aestuarii.|
n-f-cangrejo-moruno|EIK|Eriphia verrucosa.|
n-f-cangrejo-pelagico|SCD|Portunus pelagicus.|
n-f-cangrejo-real|KPG|Calappa granulata.|
n-f-cangrejo-real-azul|KCI|Paralithodes platypus.|
n-f-cangrejo-rey|KEF|Chaceon affinis.|
n-f-cangrejo-rey-del-caribe|MXI|Maguimithrax spinosissimus.|
n-f-cangrejo-rojo|CRR|Chaceon quinquedens.|
n-f-cangrejo-rojo-del-mediterraneo|GRQ|Geryon longipes.|
n-f-cangrejo-rosa|HNQ|Chaceon macphersoni.|
n-f-cangullo|TAL|Taractichthys longipinnis.|
n-f-capelan|CAP|Mallotus villosus.|
n-f-capellan|POD|Trisopterus minutus.|
n-f-capilacea|OKQ|Pterocladiella capillacea.|
n-f-carabinero|SSH|Aristaeopsis edwardsiana.|
n-f-caracol|||339AAA
n-f-caracol-luna|NKH|Naticarius hebraeus.|
n-f-caracola|RPW|Rapana venosa.|
n-f-caramel|SPC|Spicara smaris.|
n-f-caramel-imperial|EHI|Centracanthus cirrus.|
n-f-carbonero|POK|Pollachius virens.|241214
n-f-cardenal-atlantico|TPA|Trachipterus arcticus.|
n-f-carita|MAW|Scomberomorus tritor.|
n-f-carite-sierra|SIE|Scomberomorus sierra.|
n-f-carnada-de-vieja|JLA|Xantho poressa.|
n-f-carneiro|AKJ|Acanthocardia echinata.|
n-f-carpa|FCP|Cyprinus carpio.|
n-f-carpa-cabezona|BIC|Hypophthalmichthys nobilis.|
n-f-carpa-naranja|LCB|Labeo calbasu.|
n-f-carpa-plateada|SVC|Hypophthalmichthys molitrix.|
n-f-carpa-rohu|LRH|Labeo rohita.|
n-f-carpin|FCC|Carassius carassius.|
n-f-casabe-del-pacifico|HSO|Chloroscombrus orqueta.|
n-f-casco-acanalado|FMG|Semicassis granulata.|
n-f-casco-tirreno|KDH|Galeodea rugosa.|
n-f-catalufa|HTU|Heteropriacanthus cruentatus.|
n-f-catalufa-pintada|PQY|Priacanthus tayenus.|
n-f-catemo-africano|SIC|Drepane africana.|
n-f-cauloco|ZSY|Saccorhiza polyschides.|
n-f-cazon|GAG|Galeorhinus galeus.|241196,251196,251197
n-f-centolla|JDV,SCR|Maja brachydactyla.;Maja squinado.|
n-f-centolla-chilena|KCR|Lithodes santolla.|
n-f-centolla-de-fondo|OLV|Paromola cuvieri.|
n-f-centolla-feroz|KCA|Lithodes ferox.|
n-f-centolla-peruana|KLV|Paralomis longipes.|
n-f-centollon-antartico|PAG|Paralomis granulosa.|
n-f-cerdo-marino|OXN,OXY|Oxynotus centrina.;Oxynotus paradoxus.|
n-f-cero|CER|Scomberomorus regalis.|
n-f-chancharro|SFK|Sebastes jordani.|
n-f-chanquete|FIM|Aphia minuta.|
n-f-chanquete-chino|SZM,XHK|Neosalanx tangkahkeii.;Salangichthys microdon.|
n-f-chaparrudo|GBN|Gobius niger.|
n-f-chavo|ZCD|Cyttopsis rosea.|
n-f-cherna|WRF|Polyprion americanus.|
n-f-cherna-de-ley|GPW|Epinephelus aeneus.|
n-f-cherna-hapuka|WHA|Polyprion oxygeneios.|
n-f-cherne-barbudo|EWZ|Hyporthodus chabaudi.|
n-f-cherne-blanco-de-yemen|EPR|Epinephelus areolatus.|
n-f-cherne-de-yemen|ELG|Hyporthodus nigritus.|
n-f-cherne-denton|EFJ|Epinephelus caninus.|
n-f-cherne-escamoso|EWY|Epinephelus polylepis.|
n-f-cherne-moteado|EWU|Epinephelus multinotatus.|
n-f-cherne-pintado-de-yemen|EFH|Epinephelus chlorostigma.|
n-f-cherne-sahariano|EEI|Hyporthodus haifensis.|
n-f-chicharro|JAA|Trachurus picturatus.|
n-f-chicharro-ojon|BIS|Selar crumenophthalmus.|
n-f-chirla|SVE|Chamelea gallina.|
n-f-chlorella|HQW|Chlorella vulgaris.|
n-f-choco-canario|EJB|Sepia bertheloti.|
n-f-cholga|MSC|Aulacomya atra.|
n-f-chopa|BRB|Spondyliosoma cantharus.|
n-f-chopon|KYS|Kyphosus sectatrix.|
n-f-choquito|EJE|Sepia elegans.|243103,243201,2531010,2531011,2531012
n-f-choquito-picudo|IAR|Sepia orbignyana.|
n-f-chucho|JDP|Dasyatis pastinaca.|
n-f-chucla|BPI|Spicara maena.|
n-f-chucla-ojona|QZU|Spicara altum.|
n-f-chucleto|AHH|Atherina hepsetus.|
n-f-cigala|NEP|Nephrops norvegicus.|245106,255103
n-f-cigala-de-andaman|NEA|Metanephrops andamanicus.|
n-f-cigala-de-bandas-rojas|MFH|Metanephrops thomsoni.|
n-f-cigala-de-mozambique|NEM|Metanephrops mozambicus.|
n-f-cigala-del-indico|NES|Nephropsis stewarti.|
n-f-cigarra|YLL|Scyllarides latus.|10008323,10008333
n-f-cigarra-enana|YLY|Scyllarus pygmaeus.|
n-f-cigarra-oriental|THQ|Thenus orientalis.|
n-f-cigarra-roja|YLK|Scyllarides herklotsii.|
n-f-cirujano|MDO|Acanthurus monroviae.|
n-f-claca|MBW|Megabalanus tintinnabulum.|
n-f-cobia|CBA|Rachycentron canadum.|
n-f-codium|DXW,KII,KJT|Codium fragile.;Codium tomentosum.;Codium vermilara.|
n-f-cohombro|WBX|Holothuria spp.|
n-f-cohombro-naranja|JHG|Holothuria arguinensis.|
n-f-cohombro-rojo|TVK|Parastichopus tremulus.|
n-f-cohombro-tubo|HFT|Holothuria (Holothuria) tubulosa.|
n-f-cojinova|SEM,SEO,SEP,SEU|Seriolella brama.;Seriolella caerulea.;Seriolella porosa.;Seriolella punctata.|
n-f-cola-de-pavo|DWU|Padina pavonica.|
n-f-cona|YBO|Cymbium olla.|
n-f-conejo|PRP|Promethichthys prometheus.|
n-f-congrio|COE|Conger conger.|241292
n-f-coquina|DXL|Donax trunculus.|
n-f-corneta-flautera|FUC|Fistularia corneta.|
n-f-corneta-palo|AZG|Argobuccinum pustulosum.|
n-f-cornuda|SPZ|Sphyrna zygaena.|
n-f-corruco|KTT|Acanthocardia tuberculata.|
n-f-corvallo|CBM|Sciaena umbra.|
n-f-corvina|MGR|Argyrosomus regius.|241197
n-f-corvina-africana|KOB|Argyrosomus hololepidotus.|
n-f-corvina-arabe|QXN|Argyrosomus heinii.|
n-f-corvina-asiatica|JOU,MIH|Johnius dussumieri.;Miichthys miiuy.|
n-f-corvina-bronce|OTB|Otolithoides biauritus.|
n-f-corvina-de-angola|MIV|Miracorvina angolensis.|
n-f-corvina-de-boca-amarilla|AWE|Atractoscion aequidens.|
n-f-corvina-naranja|YNH|Cynoscion phoxocephalus.|
n-f-corvina-negra|CKL,PSS|Pseudotolithus senegalensis.;Pseudotolithus senegallus.|
n-f-corvina-pintada|OTI|Protonibea diacanthus.|
n-f-corvina-tigre|LKR|Otolithes ruber.|
n-f-corvinata-amarilla|CRY|Larimichthys polyactis.|
n-f-corvinata-azafran|LYC|Larimichthys crocea.|
n-f-corvinata-listada|YGC|Cynoscion guatucupa.|
n-f-corvinata-pelona|YNZ|Cynoscion stolzmanni.|
n-f-corvinata-plateada|CRV|Pennahia argentata.|
n-f-corvinata-punteada|STG|Cynoscion regalis.|
n-f-corvinato|YNV|Cynoscion virescens.|
n-f-corvinon-amarillo|CKM|Micropogonias furnieri.|
n-f-corvinon-ocelado|RDM|Sciaenops ocellatus.|
n-f-cystoseira-dorada|YQT|Treptacantha barbata.|
n-f-daoyu|ECA|Coilia nasus.|
n-f-denton|DEC|Dentex dentex.|
n-f-denton-angoleno|DEA|Dentex angolensis.|
n-f-denton-canario|DEN|Dentex canariensis.|
n-f-denton-nufar|SLD|Cheimerius nufar.|
n-f-dilsea-carnosa|SWP|Dilsea carnosa.|
n-f-dorada|SBG|Sparus aurata.|241132,2411321
n-f-dorado|CFW|Coryphaena equiselis.|
n-f-dormilona|LOB|Lobotes surinamensis.|
n-f-dragoncillo|LYY|Callionymus lyra.|
n-f-dragoncillo-rojo|TWB|Synchiropus phaeton.|
n-f-dulse|RHP|Palmaria palmata.|
n-f-dumontia|KKG|Dumontia contorta.|
n-f-eglefino|HAD|Melanogrammus aeglefinus.|
n-f-eperlano|SME,SMR|Osmerus eperlanus.;Osmerus mordax.|
n-f-erizo-atlantico|UYD|Strongylocentrotus droebachiensis.|
n-f-erizo-blanco|UCH|Loxechinus albus.|
n-f-erizo-de-mar|URM|Paracentrotus lividus.|
n-f-erizo-europeo|URS|Echinus esculentus.|
n-f-erizo-negro|UKB|Arbacia lixula.|
n-f-erizo-violaceo|FKG|Sphaerechinus granularis.|
n-f-escolar|OIL|Ruvettus pretiosus.|
n-f-escolar-negro|LEC|Lepidocybium flavobrunneum.|
n-f-escorpion|WEG|Trachinus draco.|
n-f-escorpora|SNQ|Scorpaena notata.|
n-f-escupina|VEV|Venus verrucosa.|
n-f-espadin|SPR|Sprattus sprattus.|
n-f-espadin-austral|FAS|Sprattus fuegensis.|
n-f-espadin-del-ganges|CLK|Corica soborna.|
n-f-espagueti-de-mar|HLZ,NLO|Himanthalia elongata.;Nemalion elminthoides.|
n-f-espardena|JCR|Parastichopus regalis.|
n-f-espeton|YRS|Sphyraena sphyraena.|
n-f-espeton-boca-amarilla|BVV|Sphyraena viridensis.|
n-f-espinoso|GTA|Gasterosteus aculeatus.|
n-f-espirulina|ULL|Arthrospira platensis.|
n-f-estornino-del-atlantico|VMA|Scomber colias.|
n-f-esturion|APU|Acipenser sturio.|
n-f-esturion-beluga|HUH|Huso huso.|
n-f-esturion-blanco|APN|Acipenser transmontanus.|
n-f-esturion-del-adriatico|AAA|Acipenser naccarii.|
n-f-esturion-del-danubio|APG|Acipenser gueldenstaedtii.|
n-f-esturion-estrellado|APE|Acipenser stellatus.|
n-f-esturion-siberiano|APB|Acipenser baerii.|
n-f-falsa-brotola|NEC|Pseudophycis bachus.|
n-f-falsa-gorgona|FCK|Sphaerococcus coronopifolius.|
n-f-falsa-necora|IOD|Polybius depurator.|
n-f-falso-abade|EPK|Epinephelus costae.|
n-f-falso-abadejo|EEA|Epinephelus fasciatus.|
n-f-faneca|BIB|Trisopterus luscus.|
n-f-faneca-noruega|NOP|Trisopterus esmarkii.|
n-f-fletan|HAL|Hippoglossus hippoglossus.|
n-f-fletan-negro|GHL|Reinhardtius hippoglossoides.|
n-f-fucus|FDS,FUV|Fucus spiralis.;Fucus vesiculosus.|
n-f-fula|ABU|Abudefduf saxatilis.|
n-f-fula-blanca|HZL|Chromis limbata.|
n-f-fula-negra|AUU|Similiparma lurida.|
n-f-galan|XYN|Xyrichtys novacula.|
n-f-galera|MTS|Squilla mantis.|245107
n-f-gallano|USI|Labrus mixtus.|
n-f-galleta|ZAC|Antigonia capros.|
n-f-gallineta|BRF,RED|Helicolenus dactylopterus.;Sebastes spp.|
n-f-gallineta-del-cabo|REC|Sebastes capensis.|
n-f-gallineta-del-pacifico|OPP|Sebastes alutus.|
n-f-gallineta-nordica|REG|Sebastes norvegicus.|
n-f-gallineta-oceanica|REB|Sebastes mentella.|
n-f-gallineta-pinta|IJP|Helicolenus mouchezi.|
n-f-gallineta-rosada|EZS|Scorpaena elongata.|
n-f-gallineta-toro|BVG|Cottoperca gobio.|
n-f-gallo|LDB,LEZ|Lepidorhombus boscii.;Lepidorhombus spp|241198
n-f-gallo-del-norte|MEG|Lepidorhombus whiffiagonis.|
n-f-gallo-plateado|JOS|Zenopsis conchifer.|
n-f-galludo|QUB|Squalus blainville.|
n-f-galludo-nato|DOP|Squalus megalops.|
n-f-galua|LZS|Chelon saliens.|
n-f-galupe|MGA|Chelon auratus.|
n-f-gamba|AJA,ASH,DPS,GUS,NAW,NAY,NIS,SKM,SOJ,SOK,SQH|Aristeus alcocki.;Artemesia longinaris.;Holthuispenaeopsis atlantica.;Mierspenaeopsis hardwickii.;Parapenaeopsis stylifera.;Parapenaeus longirostris.;Penaeopsis serrata.;Solenocera agassizii.;Solenocera crassicornis.;Solenocera melantho.;Solenocera membranacea.|245108,255104,255106,2572042,2572044
n-f-gamba-roja-del-mediterraneo|ARA|Aristeus antennatus.|
n-f-gambon|LAA|Pleoticus muelleri.|
n-f-gambon-de-mozambique|KNS|Haliporoides triarthrus.|
n-f-garneo|GUN|Trigla lyra.|
n-f-gigartina|YVO|Gigartina pistillata.|
n-f-gitano|MKU|Mycteroperca rubra.|
n-f-globito|CTR|Sepiola rondeletii.|
n-f-globito-robusto|ROA|Rossia macrosoma.|
n-f-globito-tierno|IRE|Semirossia tenera.|
n-f-gobido-de-cristal|YTN|Crystallogobius linearis.|
n-f-golleta|MKG|Microchirus variegatus.|
n-f-golondrina|DYL|Dactylopterus volitans.|
n-f-golondrina-de-mar|HDR|Hirundichthys rondeletii.|
n-f-gracilaria|GPZ,GXO|Gracilaria multipartita.;Gracilariopsis longissima.|
n-f-gracilaria-u-ogonori|GZG|Gracilaria gracilis.|
n-f-granadero|CNK,CQF,GRV,RHG,RNG|Coelorinchus fasciatus.;Coryphaenoides guentheri.;Coryphaenoides rupestris.;Macrourus berglax.;Macrourus spp.|
n-f-granadero-ojisapo|MCH|Macrourus holotrachys.|
n-f-guabina|NBO|Nebris occidentalis.|
n-f-guitarra-de-morro-negro|RBC|Glaucostegus cemiculus.|
n-f-halibut-carioca|YSL|Paralichthys brasiliensis.|
n-f-halibut-de-alaska|ARF|Atheresthes stomias.|
n-f-halibut-de-kamchatka|KAF|Atheresthes evermanni.|
n-f-halibut-del-japon|BAH|Paralichthys olivaceus.|
n-f-halibut-del-pacifico|HAP|Hippoglossus stenolepis.|
n-f-halibut-espinoso|PSB|Psettodes bennettii.|
n-f-halibut-patagon|QPP|Paralichthys patagonicus.|
n-f-halibut-perro|SOT|Psettodes belcheri.|
n-f-halibut-tropical|YSV|Paralichthys isosceles.|
n-f-herrera|SSB|Lithognathus mormyrus.|
n-f-hoja-de-col-marina|DZB|Phyllariopsis brevipes.|
n-f-jaiba-de-roca-dientuda|KCB|Cancer bellianus.|
n-f-jaiba-limon|QPR|Cancer porteri.|
n-f-jaiba-satinada|PVQ|Sanquerus validus.|
n-f-japuta|POA|Brama brama.|241293
n-f-jaqueta|FAL|Carcharhinus falciformis.|
n-f-julia|COU|Coris julis.|
n-f-jurel|HOM|Trachurus trachurus.|
n-f-jurel-azul|RUB|Caranx crysos.|
n-f-jurel-caballo|CVJ|Caranx hippos.|
n-f-jurel-chileno|CJM|Trachurus murphyi.|
n-f-jurel-de-cunene|HMZ|Trachurus trecae.|
n-f-jurel-del-cabo|HMC|Trachurus capensis.|
n-f-jurel-limon|TRZ|Pseudocaranx dentex.|
n-f-jurel-mediterraneo|HMM|Trachurus mediterraneus.|
n-f-jurel-real|HMY|Caranx rhonchus.|
n-f-juyon|YGM|Pachygrapsus marmoratus.|
n-f-kombu-de-remos|LQD|Laminaria digitata.|
n-f-kombu-japones|LNJ|Saccharina japonica.|
n-f-lagarto|SDR|Synodus saurus.|
n-f-lagarto-capitan|DYZ|Synodus synodus.|
n-f-laminaria|DXY,QQL|Laminaria ochroleuca.;Laminaria rodriguezii.|
n-f-lamprea|LAU|Petromyzon marinus.|
n-f-lampuga|DOL|Coryphaena hippurus.|
n-f-langosta|SLO|Palinurus elephas.|245109,255107,255109
n-f-langosta-australiana|LOA|Panulirus cygnus.|
n-f-langosta-barbona|NUG|Panulirus gracilis.|
n-f-langosta-del-cabo|LBC|Jasus lalandii.|
n-f-langosta-del-caribe|SLC|Panulirus argus.|
n-f-langosta-del-natal|SLN|Palinurus delagoae.|
n-f-langosta-del-peru|PJH|Projasus bahamondei.|
n-f-langosta-herrena|NUE|Panulirus echinatus.|
n-f-langosta-mora|PSL|Palinurus mauritanicus.|
n-f-langosta-real|LOY|Panulirus regius.|
n-f-langosta-verde|NUL|Panulirus laevicauda.|2451010,255108
n-f-langostilla-roja|LQL|Grimothea planipes.|
n-f-langostino|ABS,PNB,PNU|Penaeus aztecus.;Penaeus brasiliensis.;Penaeus subtilis.|2434046,2451011,2551010,2551011,2551021,2572043
n-f-langostino-banana|MPN,PNI,TIP|Metapenaeus monoceros.;Penaeus indicus.;Penaeus semisulcatus.|
n-f-langostino-blanco|MTJ,SOP|Metapenaeus affinis.;Penaeus notialis.|
n-f-langostino-cristal|CSP|Penaeus brevirostris.|
n-f-langostino-jumbo|GIT|Penaeus monodon.|
n-f-langostino-marfil|WKP|Penaeus latisulcatus.|
n-f-langostino-mediterraneo|TGS|Penaeus kerathurus.|
n-f-langostino-moruno|ARS|Aristaeomorpha foliacea.|
n-f-langostino-rosado|APS|Penaeus duorarum.|
n-f-langostino-tigre|EKU,KUP|Penaeus canaliculatus.;Penaeus japonicus.|
n-f-langostino-tigre-arco-iris|NAP|Mierspenaeopsis sculptilis.|
n-f-langostino-tigre-marron|PRB|Penaeus esculentus.|
n-f-langostino-titi|RRJ|Protrachypene precipua.|
n-f-langostino-vannamei|PNV|Penaeus vannamei.|
n-f-lapa|QTV|Patella vulgata.|
n-f-lapa-aspera|LQY|Patella ulyssiponensis.|
n-f-lapa-negra|WPT|Patella tenuis.|
n-f-lapa-punteada|LQR|Patella rustica.|
n-f-laurencia|LVB|Laurencia obtusa.|
n-f-lechuga-de-mar|DXZ,UEA,UJS,UNZ,UVQ,UVU|Ulva clathrata.;Ulva compressa.;Ulva lactuca.;Ulva linza.;Ulva ohnoi.;Ulva rigida.|
n-f-lengua-de-canarias|YOI|Cynoglossus canariensis.|
n-f-lengua-de-ghana|YQF|Cynoglossus cadenati.|
n-f-lengua-nigeriana|YOW|Cynoglossus browni.|
n-f-lengua-senegalesa|YOE|Cynoglossus senegalensis.|
n-f-lengua-tropical|YOY|Cynoglossus cynoglossus.|
n-f-lenguado|||241122,251121,251122
n-f-lenguado-africano|VNC|Vanstraelenia chirophthalma.|
n-f-lenguado-de-arena|SOS|Pegusa lascaris.|
n-f-lenguado-de-frechkop|QOJ|Microchirus frechkopi.|
n-f-lenguado-de-guinea|WZA,YNY|Dagetichthys cadenati.;Pegusa cadenati.|
n-f-lenguado-de-klein|KSY|Synapturichthys kleinii.|
n-f-lenguado-de-nueva-zelanda|ZNZ|Peltorhamphus novaezeelandiae.|
n-f-lenguado-de-profundidad|YMW|Bathysolea profundicola.|
n-f-lenguado-del-adriatico|OAM|Pegusa impar.|
n-f-lenguado-del-cabo|SOE|Austroglossus pectoralis.|
n-f-lenguado-del-sur|SOW|Austroglossus microlepis.|
n-f-lenguado-egipcio|EGY|Solea aegyptiaca.|
n-f-lenguado-europeo|SOL|Solea solea.|
n-f-lenguado-limon-austral|EOL|Pelotretis flavilatus.|
n-f-lenguado-maori|OIG|Colistium guentheri.|
n-f-lenguado-pelicano|NBG|Chascanopsetta lugubris.|
n-f-lenguado-portugues|YNU|Dagetichthys lusitanicus.|
n-f-lenguado-senegales|OAL|Solea senegalensis.|
n-f-lenguado-tres-monedas|WIO|Pegusa triophthalma.|
n-f-lenguado-velludo|MHH|Monochirus hispidus.|
n-f-lija|SCK|Dalatias licha.|
n-f-lija-aspera|FIK|Stephanolepis hispida.|
n-f-lija-azul|ALN|Aluterus scriptus.|
n-f-lija-gallo|AVH|Aluterus heudelotii.|
n-f-limanda|DAB|Limanda limanda.|
n-f-limanda-amarilla|YEL|Myzopsetta ferruginea.|
n-f-limanda-del-canal|YAM|Syacium micrurum.|
n-f-limanda-japonesa|YES|Limanda aspera.|
n-f-lirio|VAD|Campogramma glaycos.|
n-f-lisa|MLR|Chelon labrosus.|
n-f-listado|SKJ|Katsuwonus pelamis.|
n-f-locha-de-roca|BTB|Barbatula barbatula.|
n-f-locha-guntea|LEG|Lepidocephalichthys guntea.|
n-f-loco|SNE|Concholepas concholepas.|
n-f-longueiron|ONK,RAE|Solen lamarckii.;Solen marginatus.|
n-f-lota|GGU|Gaidropsarus vulgaris.|
n-f-lubina-japonesa|BAJ|Lateolabrax japonicus.|
n-f-lubina-rayada|STB|Morone saxatilis.|
n-f-luciano|LJA|Lutjanus agennes.|
n-f-lucio|FPI|Esox lucius.|
n-f-lucioperca|FPP|Sander lucioperca.|
n-f-lumpo|LUM|Cyclopterus lumpus.|
n-f-luna-de-la-india|UMP|Amusium pleuronectes.|
n-f-luna-real|LAG|Lampris guttatus.|
n-f-luvaro|LVM|Luvarus imperialis.|
n-f-macarela|MSD|Decapterus macarellus.|
n-f-macha|CLM|Mesodesma donacium.|
n-f-machuelo|SAE|Sardinella maderensis.|
n-f-machuelo-araucano|CKI|Strangomera bentincki.|
n-f-madrilla|HOX|Parachondrostoma toxostoma.|
n-f-manta|RMM|Mobula mobular.|
n-f-manta-cornuda|RMT|Mobula tarapacana.|
n-f-mantellina|RGL|Gymnura altavela.|
n-f-maragota|USB|Labrus bergylta.|
n-f-mariquita-europea|IFJ|Grapsus adscensionis.|
n-f-marlin-azul|BUM|Makaira nigricans.|
n-f-marlin-peto|RSP|Tetrapturus georgii.|
n-f-marlin-rayado|MLS|Kajikia audax.|
n-f-marlin-trompa|SSP|Tetrapturus angustirostris.|
n-f-marolo|AKK|Acanthocardia aculeata.|
n-f-marrajo|SMA|Isurus oxyrinchus.|241192,251192
n-f-marrajo-carite|LMA|Isurus paucus.|
n-f-marrajo-sardinero|POR|Lamna nasus.|
n-f-maruca|LIN|Molva molva.|
n-f-maruca-azul|BLI|Molva dypterygia.|
n-f-maruca-espanola|SLI|Molva macrophthalma.|
n-f-marujito|BLP,PAT|Eleginops maclovinus.;Patagonotothen ramsayi.|
n-f-medregal|AMJ,RLF,RLR,YTC,YTL|Seriola carpenteri.;Seriola fasciata.;Seriola lalandi.;Seriola quinqueradiata.;Seriola rivoliana.|
n-f-mejillon|MSM,MUS|Mytilus edulis.;Mytilus galloprovincialis.|2434044,2452021,2452022,2552021
n-f-mejillon-de-chile|MYC|Mytilus chilensis.|
n-f-mejillon-de-nueva-zelanda|MUZ|Perna canaliculus.|
n-f-mejillon-del-pacifico|MSL|Perna perna.|
n-f-melva|BLT,FRI|Auxis rochei.;Auxis thazard.|241365
n-f-mendo|WIT|Glyptocephalus cynoglossus.|
n-f-mendo-limon|LEM|Microstomus kitt.|
n-f-merlan|WHG|Merlangius merlangus.|
n-f-merluza-americana|HKS|Merluccius bilinearis.|
n-f-merluza-argentina|HKP|Merluccius hubbsi.|
n-f-merluza-austral|HKN|Merluccius australis.|
n-f-merluza-de-cola|GRN|Macruronus novaezelandiae.|
n-f-merluza-del-cabo|HKK,HKO|Merluccius capensis.;Merluccius paradoxus.|
n-f-merluza-del-pacifico|NHA|Merluccius productus.|
n-f-merluza-del-peru|PHA|Merluccius gayi.|
n-f-merluza-negra|HKB,HKM|Merluccius polli.;Merluccius senegalensis.|
n-f-mero|GPD|Epinephelus marginatus.|
n-f-mero-antartico-azul|BWA|Hyperoglyphe antarctica.|
n-f-mero-castano|EEG|Epinephelus goreensis.|
n-f-mero-espinudo|ELD|Epinephelus diacanthus.|
n-f-mero-guaza|EET|Epinephelus itajara.|
n-f-mero-malabarico|MAR|Epinephelus malabaricus.|
n-f-mero-medioluto|EFK|Epinephelus bleekeri.|
n-f-mero-oliva|EPF|Hyporthodus cifuentesi.|
n-f-mero-sureno|BSZ|Acanthistius brasilianus.|
n-f-microalga-chromochloris|DWV|Chromochloris zofingiensis.|
n-f-microalga-dunaliella|UNI|Dunaliella salina.|
n-f-microalga-haematococcus|HZP|Haematococcus pluvialis.|
n-f-microalga-isochrysis|DQY|Isochrysis galbana.|
n-f-microalga-microchloropsis|DWT|Microchloropsis gaditana.|
n-f-microalga-tetraselmis|TXL|Tetraselmis suecica.|
n-f-mielga|DGS|Squalus acanthias.|
n-f-miracielo|UUC|Uranoscopus scaber.|
n-f-mojarra|CTB|Diplodus vulgaris.|
n-f-mora|RIB|Mora moro.|10005923,319EAA
n-f-moranella-de-gunter|LPH|Lepidion guentheri.|
n-f-moranella-roja|LPJ|Lepidion lepidion.|
n-f-morena|AGD,AGK,AWG,AWM,MMH,MWK,SSK|Enchelycore anatina.;Gymnothorax afer.;Gymnothorax maderensis.;Gymnothorax unicolor.;Muraena augusti.;Muraena helena.;Synaphobranchus kaupii.|
n-f-morenocio-denton|DPC|Muraenesox cinereus.|
n-f-morragute|MGC|Chelon ramada.|
n-f-morruncho|QOS|Ostrea stentina.|
n-f-muergo|EQI|Ensis siliqua.|245308
n-f-mugil|MUF|Mugil cephalus.|
n-f-murion|AWB|Gymnothorax bacalladoi.|
n-f-musgo-de-corcega|DMH|Alsidium helminthochorton.|
n-f-musgo-de-irlanda|IMS|Chondrus crispus.|
n-f-musgo-estrellado|MVT|Mastocarpus stellatus.|
n-f-musola|SMD|Mustelus mustelus.|
n-f-musola-de-manchas-negras|MPT|Mustelus punctulatus.|
n-f-musola-dentuda|SDS|Mustelus asterias.|
n-f-musola-segadora|MUU|Mustelus lunulatus.|
n-f-mustela|BRD|Brotula barbata.|
n-f-navaja|EQK|Ensis magnus.|
n-f-navaja-americana|CLR|Ensis leei.|
n-f-navaja-macha|EQH|Ensis macha.|
n-f-navaja-recta|EQE|Ensis ensis.|
n-f-navajuela|TGZ|Tagelus dombeii.|
n-f-necora|LIO|Necora puber.|2434045,2451012
n-f-necora-nudosa|MQL|Macropipus tuberculatus.|
n-f-negrito|ETX|Etmopterus spinax.|
n-f-noriega|RJB|Dipturus batis.|
n-f-obispo|POI|Pontinus kuhlii.|
n-f-oblada|SBS|Oblada melanurus.|
n-f-ochavo|BOC|Capros aper.|
n-f-ojo-de-piedra|ULF|Aulopus filamentosus.|
n-f-ojoverde-u-ojiverde|CVW|Chlorophthalmus agassizi.|
n-f-olayo-atlantico|GHA|Galeus atlanticus.|
n-f-oreja-de-mar|HLT|Haliotis tuberculata.|
n-f-oreo-negro|BOE|Allocyttus niger.|
n-f-ortiguilla|NOW|Anemonia sulcata.|
n-f-ostra|OYF|Ostrea edulis.|245203
n-f-ostra-rizada|OYG|Magallana gigas.|
n-f-ostra-virginica-u-ostra-americana|OYA|Crassostrea virginica.|
n-f-ovatum|YVR|Gastroclonium ovatum.|
n-f-pacu|CSO|Piaractus mesopotamicus.|
n-f-pailona|CYO|Centroscymnus coelolepis.|
n-f-palometa-austral|BRU|Brama australis.|
n-f-palometa-blanca|POP|Trachinotus ovatus.|
n-f-palometa-de-quilla|TCR|Taractes rubescens.|
n-f-palometa-oriental|POO|Trachinotus blochii.|
n-f-palometa-plateada|SIP|Pampus argenteus.|
n-f-palometa-roja|BXD|Beryx decadactylus.|
n-f-palometon|LEE|Lichia amia.|
n-f-pampanito|TMB|Stromateus brasiliensis.|
n-f-pampano|BLB|Stromateus fiatola.|
n-f-pampano-mediano|WPM|Peprilus medius.|
n-f-panga|PGS|Pangasianodon hypophthalmus.|243305,251198
n-f-paparda|SAU|Scomberesox saurus.|
n-f-papuda|AGI|Gymnothorax polygonius.|
n-f-pargo|RPG|Pagrus pagrus.|241135
n-f-pargo-criollo|LJN|Lutjanus analis.|
n-f-pargo-de-la-mancha|LJS|Lutjanus guttatus.|
n-f-pargo-de-puntos-azules|BSC|Pagrus caeruleostictus.|
n-f-pargo-gris|LJI|Lutjanus griseus.|
n-f-pargo-marron-africano|LJE|Lutjanus dentatus.|
n-f-pargo-peruano|LWP|Lutjanus peru.|
n-f-pargo-rojo|MAL|Lutjanus malabaricus.|
n-f-pargo-rosado|REV|Pagrus major.|
n-f-parona|PAO|Parona signata.|
n-f-pastinaca-negra|RTB|Taeniurops grabatus.|
n-f-patelo|QPH|Polybius henslowii.|
n-f-patudo|BET|Thunnus obesus.|
n-f-peine-de-china|CMN|Mimachlamys crassicostata.|
n-f-peje-camello|PTM|Pseudotriakis microdon.|
n-f-peje-obispo|MPO|Aetomylaeus bovinus.|
n-f-peje-trompeta|AGQ|Aulostomus strigosus.|
n-f-peje-verde|TMP|Thalassoma pavo.|
n-f-pejeperro|IVD|Bodianus scrofa.|
n-f-pejepuerco-oceanico|CZT|Canthidermis sufflamen.|
n-f-pejerrey|ATB,ODR|Atherina boyeri.;Odontesthes regia.|
n-f-pelaya|||241123,251123
n-f-peluda|RKZ|Arnoglossus grohmanni.|
n-f-peluda-imperial|RLI|Arnoglossus imperialis.|
n-f-peludilla|RNH|Arnoglossus thori.|
n-f-perca|||243302,251199
n-f-perca-americana|MPS|Micropterus salmoides.|
n-f-perca-de-mar|PJR|Pinguipes brasilianus.|
n-f-perca-de-mar-argentina|UPR|Pseudopercis semifasciata.|
n-f-perca-del-nilo|NIP|Lates niloticus.|
n-f-perca-gigante|GIP|Lates calcarifer.|
n-f-perca-koi|FPC|Anabas testudineus.|
n-f-percebe|PCB|Pollicipes pollicipes.|
n-f-percebe-canadiense|ZPP|Pollicipes polymerus.|
n-f-percebe-del-pacifico|ZPE|Pollicipes elegans.|
n-f-peregrino|BSK|Cetorhinus maximus.|
n-f-perlon|GUG|Eutrigla gurnardus.|
n-f-perro-chico|CAS|Anarhichas minor.|
n-f-perro-del-norte|CAA|Anarhichas lupus.|
n-f-pescadilla|||241116,241117,251115
n-f-pescado|||2411919,2511219,2511919,2571046
n-f-peto|WAH|Acanthocybium solandri.|
n-f-pez-ballesta|TRG|Balistes capriscus.|
n-f-pez-ballesta-australiano|QZQ|Paramonacanthus choirocephalus.|
n-f-pez-ballesta-chino|KSE|Thamnaconus septentrionalis.|
n-f-pez-ballesta-rugoso|CNT|Canthidermis maculata.|
n-f-pez-cinta|CBC|Cepola macrophthalma.|
n-f-pez-cinto|SFS|Lepidopus caudatus.|
n-f-pez-conejo|TSU|Trachyrincus scabrus.|
n-f-pez-de-limon|AMB|Seriola dumerili.|
n-f-pez-de-san-pedro|JOD|Zeus faber.|
n-f-pez-diablo|BTN|Bathophilus nigerrimus.|
n-f-pez-espada|SWO|Xiphias gladius.|
n-f-pez-gallo-de-nueva-zelanda|SSO|Pseudocyttus maculatus.|
n-f-pez-gato|CBT|Clarias batrachus.|
n-f-pez-guitarra|RBX|Rhinobatos rhinobatos.|
n-f-pez-hielo|SSI|Chaenocephalus aceratus.|
n-f-pez-hielo-rayado|ANI|Champsocephalus gunnari.|
n-f-pez-linterna|LYD|Lampanyctus crocodilus.|
n-f-pez-lobo|CAB|Anarhichas denticulatus.|
n-f-pez-loro-de-guinea|UVB|Scarus hoefleri.|
n-f-pez-mariposa|HUO|Ephippus orbis.|
n-f-pez-piloto|NAU|Naucrates ductor.|
n-f-pez-pluma|CMV|Calamus calamus.|
n-f-pez-reina|OBM|Scomberoides commersonnianus.|
n-f-pez-rubi|EYO|Erythrocles monodi.|
n-f-pez-sable|LHT|Trichiurus lepturus.|
n-f-pez-sable-savalai|SVH|Lepturacanthus savala.|
n-f-pez-sapo|BHD|Halobatrachus didactylus.|
n-f-pez-serpiente-rayado|FSS|Channa striata.|
n-f-pez-unicornio|ALM|Aluterus monoceros.|
n-f-pez-vela|SFA|Istiophorus platypterus.|
n-f-pez-vela-del-atlantico|SAI|Istiophorus albicans.|
n-f-pez-volador|ECE|Cheilopogon heterurus.|
n-f-pez-zorro|ALV|Alopias vulpinus.|
n-f-pez-zorro-negro|BTH|Alopias superciliosus.|
n-f-picon|RJO|Dipturus oxyrinchus.|
n-f-picuca|TVY|Cataetyx laticeps.|
n-f-picuda-barracuda|GBA|Sphyraena barracuda.|
n-f-pintadilla|TAK|Nemadactylus macropterus.|
n-f-pintarroja|SYC|Scyliorhinus canicula.|
n-f-pintarroja-bocanegra|SHO|Galeus melastomus.|
n-f-pintarroja-islandica|GAM|Galeus murinus.|
n-f-pion|YEZ|Hyperoplus lanceolatus.|
n-f-pion-de-altura|ARU|Argentina silus.|
n-f-platija|FLE|Platichthys flesus.|
n-f-platija-americana|PLA|Hippoglossoides platessoides.|
n-f-platija-de-alaska|ALP|Pleuronectes quadrituberculatus.|
n-f-platija-de-nueva-zelanda|RMP,ROF|Rhombosolea leporina.;Rhombosolea plebeia.|
n-f-platija-del-pacifico|ROS|Lepidopsetta bilineata.|
n-f-platija-japonesa|FTS|Hippoglossoides elassodon.|
n-f-platija-tresojos|NYR|Ancylopsetta dendritica.|
n-f-poda|OUB|Bothus podas.|
n-f-polido|ARY|Argentina sphyraena.|
n-f-porredana|YFM|Symphodus melops.|
n-f-pota|SQA,SQI,TDQ|Illex argentinus.;Illex illecebrosus.;Todaropsis eblanae.|
n-f-pota-cardena|YMO|Sthenoteuthis oualaniensis.|
n-f-pota-japonesa|SQJ|Todarodes pacificus.|
n-f-pota-magister|YTT|Berryteuthis magister.|
n-f-pota-naranja|OFE|Sthenoteuthis pteropus.|
n-f-pota-neozelandesa|TSQ|Nototodarus sloanii.|
n-f-pota-saltadora|OFC,OFJ|Ommastrephes bartramii.;Ommastrephes caroli.|
n-f-poton-del-pacifico|GIS|Dosidicus gigas.|
n-f-pulpito-oriental|OFY,OUJ|Amphioctopus aegina.;Amphioctopus fangsiao.|
n-f-pulpo-almizclado|EDT|Eledone moschata.|
n-f-pulpo-azulon|OQC|Octopus cyanea.|
n-f-pulpo-blanco|EOI|Eledone cirrhosa.|
n-f-pulpo-burlon|QDM|Octopus mimus.|
n-f-pulpo-de-angel|VAZ|Velodona togata.|
n-f-pulpo-de-roca-occidental|OZJ|Octopus djinda.|
n-f-pulpo-dormilon|EZM|Enteroctopus megalocyathus.|
n-f-pulpo-gigante-africano|QGU|Enteroctopus magnificus.|
n-f-pulpo-gigante-del-pacifico|OQF|Enteroctopus dofleini.|
n-f-pulpo-kraken|OCW|Amphioctopus neglectus.|
n-f-pulpo-maya|OQY|Octopus maya.|
n-f-pulpo-membranoso|OQR|Amphioctopus membranaceus.|
n-f-pulpo-patudo|OCN|Callistoctopus macropus.|
n-f-quelvacho|GUQ|Centrophorus squamosus.|
n-f-quimera|CMO|Chimaera monstrosa.|
n-f-quimera-arpon|RCT|Rhinochimaera atlantica.|
n-f-quimera-elefante|CHJ|Callorhinchus callorynchus.|
n-f-quimera-picuda|HCR|Harriotta raleighana.|
n-f-quisquilla-de-pinzas|FEL|Alpheus glaber.|
n-f-rabil|YFT|Thunnus albacares.|
n-f-rabirrubia|SNY|Ocyurus chrysurus.|
n-f-rabirrubia-canela|TIF|Paranthias furcifer.|
n-f-rape-africano|MVA|Lophius vaillanti.|
n-f-rape-americano|ANG|Lophius americanus.|
n-f-rape-blanco|MON|Lophius piscatorius.|
n-f-rape-de-nueva-zelanda|STZ|Kathetostoma giganteum.|
n-f-rape-del-cabo|MVO|Lophius vomerinus.|
n-f-rape-del-pacifico|LHU|Lophiodes caulinaris.|
n-f-rape-negro|ANK|Lophius budegassa.|
n-f-rape-oriental|MVN|Lophius litulon.|
n-f-rapeta|ZGP|Zeugopterus punctatus.|
n-f-rascacio|BBS|Scorpaena porcus.|
n-f-rascacio-de-altura|SVV|Scorpaena stephanica.|
n-f-rascacio-de-madeira|MZS|Scorpaena maderensis.|
n-f-raspallon|ANN|Diplodus annularis.|
n-f-raspallon-del-punto|DHQ|Diplodus bellottii.|
n-f-rasqueta|CYW|Centroscymnus owstonii.|
n-f-raya|SKA|Raja spp|241295
n-f-raya-aspera|JAR|Raja radula.|
n-f-raya-boca-de-rosa|RJH|Raja brachyura.|
n-f-raya-bramante|RJA|Rostroraja alba.|
n-f-raya-cardadora|RJF|Leucoraja fullonica.|
n-f-raya-de-clavos|RJC|Raja clavata.|
n-f-raya-de-espejos|JAI|Raja miraletus.|
n-f-raya-de-los-canales|BZB|Bathyraja brachyurops.|
n-f-raya-de-madeira|JFY|Raja maderensis.|
n-f-raya-de-ojos|RJE|Raja microocellata.|
n-f-raya-de-puntos|JRT|Atlantoraja castelnaui.|
n-f-raya-del-sur|JRE|Rajella barnardi.|
n-f-raya-dentada|DPQ|Dipturus innominatus.|
n-f-raya-estrellada|JRS|Raja asterias.|
n-f-raya-falsa-vela|RJI|Leucoraja circularis.|
n-f-raya-latigo|PLS|Pteroplatytrygon violacea.|
n-f-raya-latigo-islena|RDC|Bathytoshia centroura.|
n-f-raya-leopardo|JFV|Rajella leopardus.|
n-f-raya-lisa|RJS|Malacoraja senta.|
n-f-raya-manchada|RFL|Raja straeleni.|
n-f-raya-marmorada|YBQ|Sympterygia bonapartii.|
n-f-raya-mosaico|RJU|Raja undulata.|
n-f-raya-pintada|RJM|Raja montagui.|
n-f-raya-radiante|RJR|Amblyraja radiata.|
n-f-raya-santiaguesa|RJN|Leucoraja naevus.|
n-f-raya-vela|RJK|Rajella lintea.|
n-f-raya-volantin|DPV|Dipturus chilensis.|
n-f-rejo|||2531015
n-f-reloj|DSX|Dosinia exoleta.|
n-f-reloj-anaranjado|ORY|Hoplostethus atlanticus.|
n-f-reloj-de-fondo|GXW|Gephyroberyx darwinii.|
n-f-reloj-mediterraneo|HPR|Hoplostethus mediterraneus.|
n-f-remol|BLL|Scophthalmus rhombus.|
n-f-remudo-blanco|GUP|Centrophorus granulosus.|
n-f-reo|TRS|Salmo trutta.|
n-f-robalito|JPV|Centropomus viridis.|
n-f-robalo-de-fondo|TOP|Dissostichus eleginoides.|
n-f-roble-marino|DVN|Halidrys siliquosa.|
n-f-rodaballo|TUR|Scophthalmus maximus.|2411221,241124,251124
n-f-romerillo|CEO|Centrolophus niger.|
n-f-romero|JCN|Symphodus trutta.|10006072
n-f-roncador|BGR|Pomadasys incisus.|
n-f-ronco-blanco|YSZ|Rhencus panamensis.|
n-f-ronco-moteado|BUR|Pomadasys jubelini.|
n-f-rosada|CUS|Genypterus blacodes.|251116
n-f-rosada-de-clark|OBK|Brotula clarkae.|
n-f-rosada-del-cabo|KCP|Genypterus capensis.|
n-f-rubio|CTZ,GUI,GUY|Chelidonichthys lastoviza.;Chelidonichthys spp;Trigla spp|
n-f-rubio-de-aleta-azul|CZS|Chelidonichthys spinosus.|
n-f-rubio-del-cabo|GUC|Chelidonichthys capensis.|
n-f-rufo-africano|SEY|Schedophilus velaini.|
n-f-rufo-derivante|HYW|Hyperoglyphe perciformis.|
n-f-rufo-imperial|HDV|Schedophilus ovalis.|
n-f-sabalo|ASD|Alosa alosa.|
n-f-sabalo-atlantico|MHA|Brevoortia tyrannus.|
n-f-sabalote|MIL|Chanos chanos.|
n-f-sable-alargado|BDL|Benthodesmus elongatus.|
n-f-sable-negro|BSF|Aphanopus carbo.|
n-f-salazon|||2680079
n-f-salema|SLM|Sarpa salpa.|
n-f-salmon|CHI,CHU,COH,PIN,SOC|Oncorhynchus gorbuscha.;Oncorhynchus keta.;Oncorhynchus kisutch.;Oncorhynchus nerka.;Oncorhynchus tshawytscha.|2411421,243303,2511421,2680062
n-f-salmon-atlantico|SAL|Salmo salar.|
n-f-salmonete|||241195,243304,251194
n-f-salmonete-africano|GOA|Pseudupeneus prayensis.|
n-f-salmonete-cinabrio|RQF|Parupeneus heptacantha.|
n-f-salmonete-de-fango|MUT|Mullus barbatus.|
n-f-salmonete-de-roca|MUR|Mullus surmuletus.|
n-f-salmonete-real|OGT|Apogon imberbis.|
n-f-salton|ZGS|Gymnammodytes semisquamatus.|
n-f-salvariego|TOZ|Echiichthys vipera.|
n-f-salvelino|SVF|Salvelinus fontinalis.|
n-f-sama|DEM|Dentex maroccanus.|
n-f-sama-de-pluma|DEP|Dentex gibbosus.|
n-f-san-pedro-del-cabo|ZCP|Zeus capensis.|
n-f-santiaguino|SCY|Scyllarus arctus.|
n-f-sapata-negra|CYP|Centroselachus crepidater.|
n-f-sardina|PIL|Sardina pilchardus.|241393
n-f-sardinela-aceitera|IOS|Sardinella longiceps.|
n-f-sardineta-del-pacifico|THP|Opisthonema libertate.|
n-f-sargazo-comun|RGV|Sargassum vulgare.|
n-f-sargo|SWA|Diplodus sargus.|
n-f-sargo-atlantico|SCP|Stenotomus chrysops.|
n-f-sargo-breado|SBZ|Diplodus cervinus.|
n-f-sargo-panga|PGA|Pterogymnus laniarius.|
n-f-sargo-picudo|SHR|Diplodus puntazzo.|
n-f-sastre-amarillo|CZJ|Grimothea johni.|
n-f-sastre-rojo|PQG|Grimothea monodon.|
n-f-seba|KDF|Crepidula fornicata.|
n-f-sepia|CTC|Sepia officinalis.|
n-f-sepia-del-pacifico|EJN|Sepia andreana.|
n-f-sepia-faraonica|IAH|Sepia pharaonis.|
n-f-sepia-ganchuda|IAE|Sepia recurvirostra.|
n-f-sepia-labiada|EIY|Sepia lycidas.|
n-f-sepia-oriental|EJA|Sepia aculeata.|
n-f-serrandell|MSF|Arnoglossus laterna.|
n-f-serrano|SRK|Serranus scriba.|
n-f-serrano-imperial|WSA|Serranus atricauda.|
n-f-sierra-americano|SNK|Leionura atun.|
n-f-sillago-plateado|ILS|Sillago sihama.|
n-f-siluro|SOM|Silurus glanis.|
n-f-soldado|MIA|Microchirus azevia.|
n-f-solla|PLE|Pleuronectes platessa.|
n-f-solla-del-pacifico|MIP|Microstomus pacificus.|
n-f-solleta|CIL|Citharus linguatula.|
n-f-solrayo|LOO|Odontaspis ferox.|
n-f-sonso|ZGC|Gymnammodytes cicerelus.|241394
n-f-tabernero|TBR|Ctenolabrus rupestris.|
n-f-talisman|ALC|Alepocephalus bairdii.|
n-f-tambor|GSM|Buglossidium luteum.|
n-f-tambor-real|MRK|Microchirus ocellatus.|
n-f-tanaka|TZK|Liparis tanakae.|
n-f-tarpon|TAR|Megalops atlanticus.|
n-f-tasarte|BOP|Orcynopsis unicolor.|
n-f-tellerina|DXQ|Donax semistriatus.|
n-f-tellina-austral|DNE|Latona deltoides.|
n-f-tellina-del-pacifico|QUZ|Sunetta solanderii.|
n-f-tellina-tuatua|RZQ|Paphies donacina.|
n-f-tembladera|TTR|Torpedo marmorata.|
n-f-tembladera-de-lunares|TTV|Torpedo torpedo.|
n-f-tenca|FTE|Tinca tinca.|
n-f-tiburon-arenero|DUS|Carcharhinus obscurus.|
n-f-tiburon-baboso|CCA|Carcharhinus altimus.|
n-f-tiburon-boreal|GSK|Somniosus microcephalus.|
n-f-tiburon-cobrizo|BRO|Carcharhinus brachyurus.|
n-f-tiburon-cocodrilo|PSK|Pseudocarcharias kamoharai.|
n-f-tiburon-de-galapagos|CCG|Carcharhinus galapagensis.|
n-f-tiburon-de-puntos-negros|CCL|Carcharhinus limbatus.|
n-f-tiburon-lagarto|HXC|Chlamydoselachus anguineus.|
n-f-tiburon-trozo|CCP|Carcharhinus plumbeus.|
n-f-tilapia|TLN|Oreochromis niloticus.|
n-f-tilapia-de-mozambique|TLM|Oreochromis mossambicus.|
n-f-tinto|CLZ|Clarias gariepinus.|
n-f-tintorera|BSH|Prionace glauca.|
n-f-tollo-flecha|SDU|Deania profundorum.|
n-f-tollo-lucero|SHL|Etmopterus spp|
n-f-tollo-lucero-liso|ETP|Etmopterus pusillus.|
n-f-tollo-lucero-raspa|ETR|Etmopterus princeps.|
n-f-tollo-negro|CFB|Centroscyllium fabricii.|
n-f-tollo-pajarito|DCA|Deania calceus.|
n-f-tomas|EPI|Epigonus telescopus.|
n-f-tordo-de-fondo|AKL|Acantholabrus palloni.|
n-f-tordo-negro|WRM|Labrus merula.|
n-f-tordo-verde|WRV|Labrus viridis.|
n-f-torillo|NUO|Blennius ocellaris.|
n-f-toro-bacota|CCT|Carcharias taurus.|
n-f-trompetero|SNS|Macroramphosus scolopax.|
n-f-trucha|||2412421
n-f-trucha-alpina|ACH|Salvelinus alpinus.|
n-f-trucha-arco-iris|TRR|Oncorhynchus mykiss.|
n-f-trucha-lacustre|LAT|Salvelinus namaycush.|
n-f-urta|REA|Pagrus auriga.|
n-f-uva-de-mar|KQE|Caulerpa lentillifera.|
n-f-uva-marina|DZF|Botryocladia botryoides.|
n-f-verrugato|COB|Umbrina cirrosa.|
n-f-verrugato-de-fango|UCA|Umbrina canariensis.|
n-f-verrugato-fusco|UMO|Umbrina ronchus.|
n-f-vibora|TZR|Trachinus radiatus.|
n-f-vieira|SCE,SJA|Pecten jacobaeus.;Pecten maximus.|245309
n-f-vieira-amerindia|QPT|Aequipecten tehuelchus.|
n-f-vieira-del-atlantico|SCA|Placopecten magellanicus.|
n-f-vieira-del-pacifico|SCQ|Argopecten purpuratus.|
n-f-vieira-japonesa|JSC|Mizuhopecten yessoensis.|
n-f-vieira-patagonica|ZYP|Zygochlamys patagonica.|
n-f-vieira-platillo|YYB|Ylistrum balloti.|
n-f-vieja-colorada|PRR|Sparisoma cretense.|
n-f-vieja-lomonegro|BZD|Bodianus speciosus.|
n-f-vimba|VIV|Vimba vimba.|
n-f-volador|SQE,SQM|Illex coindetii.;Todarodes sagittatus.|
n-f-volandeira|QSC|Aequipecten opercularis.|
n-f-xinxa|URQ|Munida rugosa.|
n-f-zamburina|VSC|Mimachlamys varia.|
n-f-zamburina-nordica|ISC|Chlamys islandica.|
n-fish|||50120000,50121500
n-flour|||50221000
n-fruit|||10000002,10000003,10000204,10000205,10000206,10008200,50102000,50250000,50251600
n-g-avestruz|||10005779,10005798
n-g-ciervo|||10005770,10005789
n-g-equino|||10005774,10005793
n-g-jabali|||10006280,10006296
n-gpc-abejas-avispas-y-hormigas|||10008321,10008331
n-gpc-acai|||10006759
n-gpc-acedera|||10006090
n-gpc-aceite-vegetal|||10000040,10006958
n-gpc-aceites-comestibles|||50151500
n-gpc-aditivo-alimentario|||10008061
n-gpc-agretti|||10006461
n-gpc-agua-con-sabor|||10008410
n-gpc-agua-envasada|||10000232
n-gpc-aguacate-cocktail|||10006167
n-gpc-aguacate-de-piel-lisa|||10006169
n-gpc-aguaturma|||10006125
n-gpc-ajedrea-de-jardin|||10006045
n-gpc-ajedrea-de-monte|||10006046
n-gpc-ajo-de-oso|||10006040
n-gpc-ajo-elefante|||10006004
n-gpc-ala-de-pollo-de-dos-articulaciones|||unece:701303
n-gpc-ala-de-pollo-en-v-primer-y-segundo|||unece:701302
n-gpc-ala-entera-de-pavo|||unece:711301
n-gpc-ala-entera-de-pollo|||unece:701301
n-gpc-ala-plana-de-pollo-segundo-segment|||unece:701305
n-gpc-alas-de-pavo-de-primer-y-segundo-s|||unece:711307
n-gpc-alas-de-pollo-con-espalda|||unece:701308
n-gpc-alas-de-pollo-de-primer-y-segundo-|||unece:701307
n-gpc-albahaca|||10006041
n-gpc-alcaravea|||10006056
n-gpc-alce|||10006285,10006301
n-gpc-algarroba|||10005986
n-gpc-alimentacion-infantil|||10000104,10006273
n-gpc-alimentacion-y-bebidas-infantiles|||50193000
n-gpc-alinos-y-salsas-para-mojar|||10000199,10000200,10000583
n-gpc-aloe-vera|||10006360
n-gpc-amaranto-chino|||10006420
n-gpc-angelica|||10006050
n-gpc-anis|||10006334
n-gpc-anona|||10005940,10006433
n-gpc-anona-corazon|||10005941
n-gpc-anonaceas|||10008197,50251300
n-gpc-antilope|||10006282,10006298
n-gpc-aperitivo-inflado|||10006746
n-gpc-arandano-rojo|||10005930
n-gpc-arandano-rojo-silvestre|||10006431
n-gpc-arandano-silvestre|||10005928
n-gpc-arracacha|||10006335
n-gpc-arrurruz|||10006416
n-gpc-artemisa|||10006044
n-gpc-azahar|||10008041
n-gpc-azucares-y-edulcorantes|||50161500
n-gpc-babaco|||10005955
n-gpc-babilla-con-tapilla-de-cabrito|||unece:505076
n-gpc-babilla-de-cabrito|||unece:505072
n-gpc-badea|||10005949
n-gpc-bardana|||10006363
n-gpc-barrita-de-cereales|||10000287
n-gpc-barrita-de-proteinas|||10008059
n-gpc-baya-de-boysen|||10005924
n-gpc-baya-de-goji|||10006429
n-gpc-baya-de-logan|||10006346
n-gpc-baya-de-saskatoon|||10006354
n-gpc-bebida-de-manzana|||10008033
n-gpc-bebida-de-manzana-espumosa|||10008032
n-gpc-bebida-de-zumo-de-fruta|||10000222,10000223,10000309
n-gpc-bebida-de-zumo-de-verdura|||10006255,10006256,10006257
n-gpc-bebida-energetica|||10000266,10000311
n-gpc-bebida-infantil|||10000105
n-gpc-bebida-isotonica|||10000265
n-gpc-bebida-lactea|||10000191,10000192,10000310
n-gpc-bebida-vegetal|||10006969,10006970,10006971,10006972,10006973,10006974
n-gpc-bebidas-alcoholicas|||50202200
n-gpc-bebidas-sin-alcohol|||50202300,50202400
n-gpc-beefalo|||10006283,10006299
n-gpc-berenjena-antroewa|||10006452
n-gpc-bilimbi|||10005963
n-gpc-bimi|||10006445
n-gpc-bisonte|||10005768,10005787
n-gpc-biter-y-siropes-alcoholicos|||10000589
n-gpc-bocadillos-y-wraps|||10000254,10000255,50192500
n-gpc-boletus|||10006035
n-gpc-bolleria-dulce|||50182000
n-gpc-bolleria-salada|||50182200
n-gpc-brazuelo-de-cabrito|||unece:505030
n-gpc-brazuelo-de-cordero|||unece:405030
n-gpc-brote|||10006260
n-gpc-brote-de-bambu|||10006137
n-gpc-bufalo-de-agua|||10006286,10006302
n-gpc-cabecera-de-lomo-limpieza-especial|||unece:304240
n-gpc-cabeza-de-pollo|||unece:701701
n-gpc-cabra|||10005773,10005792
n-gpc-cacao-soluble|||10000178,10000179
n-gpc-cadera-de-cerdo|||unece:304130
n-gpc-cadera-de-cerdo-deshuesada|||unece:304305
n-gpc-cafe-en-capsulas|||10008180
n-gpc-cafe-en-grano|||10008178
n-gpc-cafe-liquido-concentrado|||10008183
n-gpc-cafe-liquido-listo-para-beber|||10000114
n-gpc-cafe-molido|||10008179
n-gpc-cafe-soluble|||10000115
n-gpc-cafe-te-e-infusiones|||50201700
n-gpc-cafe-y-sucedaneos-de-cafe|||50202600
n-gpc-calabaza-de-peregrino|||10006340
n-gpc-calabaza-opo|||10006357
n-gpc-camemoro|||10005925
n-gpc-canal-de-cordero|||unece:404500
n-gpc-canal-de-cordero-telescopada|||unece:404505
n-gpc-canal-entera-de-cerdo|||unece:304000
n-gpc-canonigos|||10006086
n-gpc-caqui-americano|||10005948
n-gpc-caracol-de-tierra|||10005776,10005795
n-gpc-carne-de-especies-alternativas|||10005783,10005802
n-gpc-carne-de-la-escapula-de-pavo|||unece:716011
n-gpc-carne-de-varias-especies|||10005797
n-gpc-carne-del-ilion-de-pavo|||unece:716012
n-gpc-carne-mixta-de-especies-alternativ|||10005778
n-gpc-carne-y-aves|||50240100,50240200
n-gpc-carre-de-cabrito-6-costillas|||unece:504931
n-gpc-carre-de-cabrito-7-costillas|||unece:504930
n-gpc-carre-de-cabrito-8-costillas|||unece:504932
n-gpc-carre-de-cabrito-9-costillas|||unece:504933
n-gpc-carre-de-cabrito-sin-tapa-6-costil|||unece:504746
n-gpc-carre-de-cabrito-sin-tapa-7-costil|||unece:504747
n-gpc-carre-de-cabrito-sin-tapa-8-costil|||unece:504748
n-gpc-carre-de-cabrito-sin-tapa-9-costil|||unece:504749
n-gpc-carre-de-cordero-6-costillas|||unece:404931
n-gpc-carre-de-cordero-7-costillas|||unece:404930
n-gpc-carre-de-cordero-8-costillas|||unece:404932
n-gpc-carre-de-cordero-9-costillas|||unece:404933
n-gpc-carre-de-cordero-francesado-con-ta|||unece:404750
n-gpc-carre-de-cordero-francesado-con-ta-2|||unece:404751
n-gpc-carre-de-cordero-francesado-con-ta-3|||unece:404752
n-gpc-carre-de-cordero-francesado-con-ta-4|||unece:404753
n-gpc-carre-de-cordero-francesado-con-ta-5|||unece:404754
n-gpc-carre-de-cordero-francesado-con-ta-6|||unece:404755
n-gpc-carre-de-cordero-francesado-con-ta-7|||unece:404756
n-gpc-carre-de-cordero-francesado-con-ta-8|||unece:404757
n-gpc-carre-de-cordero-francesado-sin-ta|||unece:404758
n-gpc-carre-de-cordero-francesado-sin-ta-2|||unece:404759
n-gpc-carre-de-cordero-francesado-sin-ta-3|||unece:404760
n-gpc-carre-de-cordero-francesado-sin-ta-4|||unece:404761
n-gpc-carre-de-cordero-francesado-sin-ta-5|||unece:404762
n-gpc-carre-de-cordero-francesado-sin-ta-6|||unece:404763
n-gpc-carre-de-cordero-francesado-sin-ta-7|||unece:404764
n-gpc-carre-de-cordero-francesado-sin-ta-8|||unece:404765
n-gpc-carre-de-cordero-sin-tapa-6-costil|||unece:404746
n-gpc-carre-de-cordero-sin-tapa-7-costil|||unece:404747
n-gpc-carre-de-cordero-sin-tapa-8-costil|||unece:404748
n-gpc-carre-de-cordero-sin-tapa-9-costil|||unece:404749
n-gpc-casia|||10006437
n-gpc-castana-de-agua|||10006372
n-gpc-cebolleta|||10006005
n-gpc-centro-de-canal-10-costillas|||unece:304072
n-gpc-centro-de-canal-11-costillas|||unece:304071
n-gpc-centro-de-canal-12-costillas|||unece:304070
n-gpc-centro-de-canal-13-costillas|||unece:304069
n-gpc-centro-de-canal-deshuesado-de-10-c|||unece:304322
n-gpc-centro-de-canal-deshuesado-de-11-c|||unece:304321
n-gpc-centro-de-canal-deshuesado-de-12-c|||unece:304320
n-gpc-centro-de-canal-deshuesado-de-13-c|||unece:304319
n-gpc-cereal-en-grano|||10000211,10000314,10000315,10000316,10000319
n-gpc-cereales-elaborados|||50221200
n-gpc-chalota|||10006009
n-gpc-chayote|||10006356
n-gpc-chicle|||10006390
n-gpc-chicozapote|||10006368
n-gpc-choi-sum|||10006446
n-gpc-chutney|||10000180,10000586,10000587
n-gpc-cidra|||10006866
n-gpc-cilantro|||10006054
n-gpc-ciperaceas|||10008226,50262700
n-gpc-ciruela-claudia|||10005913
n-gpc-ciruela-damascena|||10005909
n-gpc-ciruela-japonesa|||10005914
n-gpc-ciruela-mirabel|||10005910
n-gpc-ciruela-mume|||10006831
n-gpc-citricos|||10008190,50250600
n-gpc-citronela|||10006159
n-gpc-clementina|||10005886
n-gpc-cochinillo-abierto|||unece:304012
n-gpc-cochinillo-entero|||unece:304011
n-gpc-codillo-delantero|||unece:304170
n-gpc-codillo-trasero|||unece:304172
n-gpc-col-de-bruselas|||10005996
n-gpc-col-marina|||10006458
n-gpc-col-puntiaguda|||10006197
n-gpc-col-rizada|||10006000
n-gpc-coles-y-brasicas|||10008206,50261100
n-gpc-colinabo|||10006118
n-gpc-colirrabano|||10006146
n-gpc-colmenilla|||10006032
n-gpc-combinaciones-de-cuatro-piezas-de-|||unece:704003
n-gpc-combinaciones-de-cuatro-piezas-de--2|||unece:714003
n-gpc-combinaciones-de-dos-piezas-de-pav|||unece:714001
n-gpc-combinaciones-de-dos-piezas-de-pol|||unece:704001
n-gpc-combinaciones-de-tres-piezas-de-pa|||unece:714002
n-gpc-combinaciones-de-tres-piezas-de-po|||unece:704002
n-gpc-combinado-alcoholico|||10000144
n-gpc-combinado-sin-alcohol|||10008035
n-gpc-confiteria|||50161800
n-gpc-contra-de-cabrito|||unece:505075
n-gpc-contramuslito-de-ala-de-pavo|||unece:711304
n-gpc-contramuslito-de-ala-de-pollo|||unece:701304
n-gpc-contramuslo-de-pavo-con-parte-de-e|||unece:711102
n-gpc-contramuslo-de-pavo-deshuesado|||unece:711101
n-gpc-contramuslo-de-pavo-limpio|||unece:711103
n-gpc-contramuslo-de-pollo-con-parte-de-|||unece:701102
n-gpc-contramuslo-de-pollo-deshuesado|||unece:701101
n-gpc-contramuslo-de-pollo-deshuesado-es|||unece:701104
n-gpc-contramuslo-de-pollo-deshuesado-li|||unece:701103
n-gpc-contramuslo-de-pollo-deshuesado-li-2|||unece:701105
n-gpc-corazon-de-chuletero|||unece:304360
n-gpc-corazon-de-costillar-de-cordero|||unece:405153
n-gpc-corazon-de-lomo-de-cerdo|||unece:304361
n-gpc-corazon-de-lomo-de-cordero|||unece:405150
n-gpc-corazones-de-pavo-con-capa|||unece:712102
n-gpc-corazones-de-pavo-sin-capa|||unece:712101
n-gpc-corazones-de-pollo-con-capa|||unece:702102
n-gpc-corazones-de-pollo-sin-capa|||unece:702101
n-gpc-cordero|||10006278,10006294
n-gpc-corzo|||10006393,10006394
n-gpc-costillar-bajo-de-cabrito-6-costil|||unece:505015
n-gpc-costillar-bajo-de-cabrito-7-costil|||unece:505016
n-gpc-costillar-bajo-de-cabrito-8-costil|||unece:505017
n-gpc-costillar-bajo-de-cabrito-9-costil|||unece:505018
n-gpc-costillar-bajo-de-cordero-6-costil|||unece:405015
n-gpc-costillar-bajo-de-cordero-7-costil|||unece:405016
n-gpc-costillar-bajo-de-cordero-8-costil|||unece:405017
n-gpc-costillar-bajo-de-cordero-9-costil|||unece:405018
n-gpc-costillar-completo|||unece:304162
n-gpc-costillar-de-lomo|||unece:304160
n-gpc-costillar-de-paletilla-de-cerdo-2-|||unece:304167
n-gpc-costillar-de-paletilla-de-cerdo-3-|||unece:304166
n-gpc-costillar-de-paletilla-de-cerdo-4-|||unece:304165
n-gpc-costillar-de-paletilla-de-cordero-|||unece:404732
n-gpc-costillar-de-paletilla-de-cordero--2|||unece:404731
n-gpc-costillar-de-paletilla-de-cordero--3|||unece:404732
n-gpc-costillar-de-paletilla-de-cordero--4|||unece:404733
n-gpc-costillar-de-paletilla-de-cordero--5|||unece:404736
n-gpc-costillar-de-paletilla-de-cordero--6|||unece:404737
n-gpc-costillar-de-paletilla-de-cordero--7|||unece:404738
n-gpc-costillar-de-paletilla-de-cordero--8|||unece:404739
n-gpc-costillar-de-panceta|||unece:304160
n-gpc-costillar-estilo-st-louis|||unece:304164
n-gpc-costillas-cortas-de-cerdo|||unece:304164
n-gpc-costillitas-de-lomo|||unece:304159
n-gpc-crema-de-grasas-mixtas|||10006987,10006988,10006989
n-gpc-crema-para-untar-lactea|||10006984,10006985,10006986
n-gpc-cresta-de-pollo|||unece:701702
n-gpc-criadillas-de-pavo|||unece:712201
n-gpc-criadillas-de-pollo|||unece:702201
n-gpc-crosne|||10006966
n-gpc-cuarto-de-pechuga-de-pollo|||unece:700501
n-gpc-cuarto-delantero-de-cabrito|||unece:504972
n-gpc-cuarto-delantero-de-cerdo-1-costil|||unece:304005
n-gpc-cuarto-delantero-de-cerdo-2-costil|||unece:304006
n-gpc-cuarto-delantero-de-cerdo-3-costil|||unece:304007
n-gpc-cuarto-delantero-de-cerdo-4-costil|||unece:304008
n-gpc-cuarto-delantero-de-cordero-3-cost|||unece:404969
n-gpc-cuarto-delantero-de-cordero-4-cost|||unece:404971
n-gpc-cuarto-delantero-de-cordero-5-cost|||unece:404970
n-gpc-cuarto-delantero-de-cordero-6-cost|||unece:404972
n-gpc-cuarto-delantero-de-cordero-deshue|||unece:405045
n-gpc-cuarto-delantero-de-cordero-deshue-2|||unece:405046
n-gpc-cuarto-delantero-de-cordero-deshue-3|||unece:405047
n-gpc-cuarto-delantero-de-cordero-semide|||unece:404770
n-gpc-cuarto-delantero-de-cordero-semide-2|||unece:404771
n-gpc-cuarto-delantero-de-cordero-semide-3|||unece:404772
n-gpc-cuarto-trasero-de-cabrito|||unece:504788
n-gpc-cuarto-trasero-de-cerdo-8-costilla|||unece:3040010
n-gpc-cuarto-trasero-de-cerdo-9-costilla|||unece:304009
n-gpc-cuarto-trasero-de-cordero-6-costil|||unece:404786
n-gpc-cuarto-trasero-de-cordero-7-costil|||unece:404787
n-gpc-cuarto-trasero-de-cordero-8-costil|||unece:404788
n-gpc-cuarto-trasero-de-cordero-9-costil|||unece:404789
n-gpc-cuarto-trasero-de-pavo|||unece:710901
n-gpc-cuarto-trasero-de-pavo-sin-rabadil|||unece:710902
n-gpc-cuarto-trasero-de-pollo-con-grasa-|||unece:701002
n-gpc-cuarto-trasero-de-pollo-con-parte-|||unece:700901
n-gpc-cuarto-trasero-de-pollo-con-parte--2|||unece:700902
n-gpc-cuarto-trasero-de-pollo-con-parte--3|||unece:700903
n-gpc-cuarto-trasero-de-pollo-de-corte-c|||unece:701001
n-gpc-cuarto-trasero-de-pollo-de-corte-c-2|||unece:701004
n-gpc-cuarto-trasero-de-pollo-de-corte-l|||unece:701003
n-gpc-cuarto-trasero-de-pollo-de-corte-l-2|||unece:701005
n-gpc-cuarto-trasero-entero-de-pavo|||unece:711001
n-gpc-cucurbitaceas-de-piel-dura|||10008212,50260900
n-gpc-cucurbitaceas-de-piel-tierna|||10008211,50260700
n-gpc-cuello-de-cabrito|||unece:505020
n-gpc-cuello-de-cordero-deshuesado|||unece:405020
n-gpc-cuello-de-pavo|||unece:711601
n-gpc-cuello-de-pollo|||unece:701601
n-gpc-culata-de-contra-de-cabrito|||unece:505071
n-gpc-daikon|||10006417
n-gpc-despiece-de-pierna-de-cabrito-en-4|||unece:505065
n-gpc-despiece-de-pierna-de-cordero|||unece:405065
n-gpc-despiece-surtido-de-cabrito-con-hu|||unece:505036
n-gpc-despiece-surtido-de-cordero-listo-|||unece:405036
n-gpc-dessert|||10000196,10000197,10000312
n-gpc-destilado|||10000263
n-gpc-destilados-sin-alcohol|||10008034
n-gpc-diente-de-leon|||10006089
n-gpc-durian|||10005972
n-gpc-elaborados-a-base-de-cereal|||50193200
n-gpc-embutido-de-cerdo|||10005840
n-gpc-embutido-de-cordero|||10005835
n-gpc-embutido-de-especies-alternativas|||10005832
n-gpc-embutido-de-pavo|||10005837
n-gpc-embutido-de-pollo|||10005834
n-gpc-embutido-de-ternera|||10005838
n-gpc-embutido-de-vacuno|||10005833
n-gpc-embutido-de-varias-especies|||10005836
n-gpc-empanadas-pizzas-y-quiches|||10000248,10000249,10000250
n-gpc-emu|||10006288,10006304
n-gpc-encurtidos-chutneys-y-aceitunas|||50171900
n-gpc-eneldo|||10006049
n-gpc-enoki|||10006264
n-gpc-epazote|||10008003
n-gpc-escarabajos|||10008319,10008329
n-gpc-escarola-rizada|||10006097
n-gpc-escorzonera|||10006200
n-gpc-espalda-alta-de-pollo|||unece:701403
n-gpc-espalda-baja-de-pollo|||unece:701402
n-gpc-espalda-baja-de-pollo-limpia|||unece:701401
n-gpc-espalda-entera-de-pollo|||unece:701404
n-gpc-espinaca-de-agua|||10006352
n-gpc-espinaca-de-nueva-zelanda|||10006427
n-gpc-estragon|||10006051
n-gpc-extracto-de-huevo|||10006204
n-gpc-extractos-y-potenciadores-de-sabor|||10006214
n-gpc-faisan|||10005780,10005799
n-gpc-falda-de-cordero|||unece:405011
n-gpc-falda-de-cordero-deshuesada|||unece:405173
n-gpc-feijoa|||10006160
n-gpc-fermentado|||10000588
n-gpc-fermentado-espumoso|||10003689
n-gpc-filete-de-cuello-de-cordero|||unece:405152
n-gpc-flor-comestible|||10006261,10008213,50262000
n-gpc-fresa-silvestre|||10005922
n-gpc-fruta-de-hueso|||10008193,50250900
n-gpc-fruta-de-iv-gama|||50380100
n-gpc-fruta-de-pepita|||10008192,50250800
n-gpc-fruta-del-pan|||10005973
n-gpc-fruta-sin-elaborar|||50270100,50310100
n-gpc-frutos-rojos-y-bayas|||10008194,50251000
n-gpc-frutos-secos-con-cascara|||50340100
n-gpc-frutos-secos-frescos|||50330100
n-gpc-garras-de-pollo-elaboradas|||unece:701801
n-gpc-gelatina-de-piel-de-burro|||10008450
n-gpc-ginseng|||10006833
n-gpc-glaseado-alimentario|||10000581
n-gpc-granadilla|||10005951
n-gpc-granos-y-harinas|||50221000
n-gpc-grasa-abdominal-de-pavo|||unece:712401
n-gpc-grasa-abdominal-de-pollo|||unece:702401
n-gpc-grasa-animal|||10000041,10000574
n-gpc-grasa-mixta|||10006990,10006991
n-gpc-grasa-vegetal|||10000042,10000585
n-gpc-grasas-comestibles|||50151600
n-gpc-grosella-negra|||10006194
n-gpc-guarnicion-fresca|||50360100
n-gpc-guayaba|||10005971
n-gpc-guinda|||10005907
n-gpc-guisante-alado|||10006455
n-gpc-guisantes-con-vaina|||10008222,50261500
n-gpc-haba|||10005980
n-gpc-haba-jack|||10005981
n-gpc-helecho-canela|||10006361
n-gpc-helecho-real|||10006362
n-gpc-helecho-tierno|||10006824
n-gpc-helechos|||10008214,50262400
n-gpc-hibrido-de-baya|||10006430
n-gpc-hibrido-de-hueso|||10005916
n-gpc-hierba-luisa|||10006078
n-gpc-hierbas-especias-y-extractos|||50171500
n-gpc-hierbas-frescas|||10008217,50261300
n-gpc-hierbas-y-especias|||10000048,10000049,10000212
n-gpc-higados-de-pavo|||unece:712001
n-gpc-higados-de-pollo|||unece:702001
n-gpc-hinojo-de-bulbo|||10006272
n-gpc-hinojo-dulce|||10006052
n-gpc-hisopo|||10006077
n-gpc-hoja-de-apio|||10006457
n-gpc-hoja-de-ensalada-entera|||10008227
n-gpc-hoja-de-ensalada-suelta|||10008219
n-gpc-hoja-de-mostaza|||10006342
n-gpc-hoja-de-platano|||10008039
n-gpc-hoja-santa|||10008002
n-gpc-hojas-de-achicoria|||10008209
n-gpc-hortalizas-de-bulbo|||10008207,50260200
n-gpc-hortalizas-de-tallo|||10008231,50261600
n-gpc-huesos-y-caldo|||10000578,10000579,10000580
n-gpc-huevo-cocido|||10006211
n-gpc-huevo-con-cascara|||10006210
n-gpc-huevo-con-cascara-de-clase-b|||10006203
n-gpc-huevo-con-cascara-sin-clasificar|||10006202
n-gpc-infusion-concentrada|||10008187
n-gpc-infusion-en-capsulas|||10008186
n-gpc-infusion-lista-para-beber|||10000313
n-gpc-infusion-soluble|||10000210
n-gpc-ingrediente-para-sopa|||10006314,10006315,10006316
n-gpc-ingredientes-de-reposteria|||10000069,10000157,10000158
n-gpc-insectos|||10008328,10008338
n-gpc-insectos-comestibles|||50400100,50400200
n-gpc-insectos-variados|||10008327,10008337
n-gpc-insumos-de-elaboracion|||10000143
n-gpc-intestinos-de-pavo|||unece:716015
n-gpc-invertebrados-marinos|||10000145,10000146,10000147,10000148,10000149,10000150
n-gpc-jambolan|||10006434
n-gpc-jamon-fresco-contra|||unece:304300
n-gpc-jamon-fresco-de-corte-corto-tipo-1|||unece:304016
n-gpc-jamon-fresco-de-corte-corto-tipo-2|||unece:304017
n-gpc-jamon-fresco-de-corte-corto-tipo-3|||unece:304018
n-gpc-jamon-fresco-de-corte-largo-deshue|||unece:304200
n-gpc-jamon-fresco-de-corte-largo-tipo-1|||unece:304013
n-gpc-jamon-fresco-de-corte-largo-tipo-2|||unece:304014
n-gpc-jamon-fresco-de-corte-largo-tipo-3|||unece:304015
n-gpc-jamon-fresco-despiezado-en-3|||unece:304311
n-gpc-jamon-fresco-despiezado-en-4|||unece:304312
n-gpc-jamon-fresco-despiezado-en-5|||unece:304313
n-gpc-jamon-fresco-despiezado-en-6|||unece:304314
n-gpc-jamon-fresco-punta-de-babilla|||unece:304310
n-gpc-jamon-fresco-redondo|||unece:304301
n-gpc-jamon-fresco-tapa|||unece:304290
n-gpc-jamoncito-de-pavo|||unece:711201
n-gpc-jamoncito-de-pavo-deshuesado-sin-t|||unece:711204
n-gpc-jamoncito-de-pavo-deshuesado-tendo|||unece:711203
n-gpc-jamoncito-de-pollo|||unece:701201
n-gpc-jamoncito-de-pollo-de-corte-sesgad|||unece:701202
n-gpc-jamoncito-y-contramuslo-de-pollo-d|||unece:700904
n-gpc-jarrete-de-cabrito|||unece:505031
n-gpc-jarrete-trasero-de-cordero|||unece:405031
n-gpc-jicama|||10006344
n-gpc-josta|||10005934
n-gpc-judia-alada|||10006336
n-gpc-judia-azuki|||10006834
n-gpc-judia-carilla|||10006825
n-gpc-judia-de-enrame|||10005979
n-gpc-judia-de-lima|||10005982
n-gpc-judia-esparrago|||10006158
n-gpc-judia-verde|||10005976
n-gpc-judias-con-vaina|||10008205,50261400
n-gpc-kai-lan|||10006823
n-gpc-kit-de-aromatizacion|||10008042
n-gpc-kit-de-elaboracion|||10000142
n-gpc-kiwino|||10005938
n-gpc-kumquat|||10006345
n-gpc-lavanda-de-mar|||10006459
n-gpc-leche-infantil|||10000575
n-gpc-lechuga-de-cogollo|||10008216
n-gpc-lechuga-de-hoja-suelta|||10006268
n-gpc-lechuga-de-tallo|||10008230
n-gpc-lechuga-esparrago|||10006761
n-gpc-lechuga-romana|||10006085
n-gpc-levistico|||10006057
n-gpc-libelulas|||10008326,10008336
n-gpc-lichi|||10005964
n-gpc-liebre|||10006281,10006297
n-gpc-lima-india|||10006438
n-gpc-lima-mexicana|||10005883
n-gpc-limequat|||10005885
n-gpc-llama|||10005777,10005796
n-gpc-lollo-bionda|||10006424
n-gpc-lollo-rosso|||10006425
n-gpc-lomo-de-cabrito|||unece:504860
n-gpc-lomo-de-cabrito-con-rinonada|||unece:504840
n-gpc-lomo-de-cerdo-corte-central-10-cos|||unece:304101
n-gpc-lomo-de-cerdo-corte-central-11-cos|||unece:304100
n-gpc-lomo-de-cerdo-corte-central-12-cos|||unece:304099
n-gpc-lomo-de-cerdo-corte-central-13-cos|||unece:304098
n-gpc-lomo-de-cerdo-deshuesado-de-10-cos|||unece:304343
n-gpc-lomo-de-cerdo-deshuesado-de-11-cos|||unece:304342
n-gpc-lomo-de-cerdo-deshuesado-de-12-cos|||unece:304341
n-gpc-lomo-de-cerdo-deshuesado-de-13-cos|||unece:304340
n-gpc-lomo-de-cerdo-largo-10-costillas|||unece:304107
n-gpc-lomo-de-cerdo-largo-11-costillas|||unece:304106
n-gpc-lomo-de-cerdo-largo-12-costillas|||unece:304105
n-gpc-lomo-de-cerdo-largo-13-costillas|||unece:304104
n-gpc-lomo-de-cerdo-largo-despiezado-en-|||unece:304113
n-gpc-lomo-de-cerdo-largo-sin-aguja-10-c|||unece:304105
n-gpc-lomo-de-cerdo-largo-sin-aguja-11-c|||unece:304104
n-gpc-lomo-de-cerdo-largo-sin-aguja-12-c|||unece:304103
n-gpc-lomo-de-cerdo-largo-sin-aguja-13-c|||unece:304102
n-gpc-lomo-de-cerdo-semideshuesado-corte|||unece:304105
n-gpc-lomo-de-cerdo-semideshuesado-corte-2|||unece:304104
n-gpc-lomo-de-cerdo-semideshuesado-corte-3|||unece:304103
n-gpc-lomo-de-cerdo-semideshuesado-corte-4|||unece:304102
n-gpc-lomo-de-cordero-6-costillas|||unece:404859
n-gpc-lomo-de-cordero-7-costillas|||unece:404861
n-gpc-lomo-de-cordero-8-costillas|||unece:404860
n-gpc-lomo-de-cordero-9-costillas|||unece:404862
n-gpc-lomo-de-cordero-con-rinonada-6-cos|||unece:404839
n-gpc-lomo-de-cordero-con-rinonada-7-cos|||unece:404841
n-gpc-lomo-de-cordero-con-rinonada-8-cos|||unece:404840
n-gpc-lomo-de-cordero-con-rinonada-9-cos|||unece:404842
n-gpc-lomo-limpio-de-cabrito|||unece:505101
n-gpc-lomo-limpio-de-cordero-corto|||unece:405109
n-gpc-lomo-limpio-de-cordero-largo|||unece:405101
n-gpc-longan|||10006435
n-gpc-lulo|||10006760
n-gpc-madrono|||10006347
n-gpc-maiz-dulce|||10006147
n-gpc-malanga-blanca|||10006110
n-gpc-malanga-lila|||10006109
n-gpc-mamey|||10006365
n-gpc-mandarina-hibrida|||10006441
n-gpc-mandarina-king|||10006439
n-gpc-mandarina-mediterranea|||10006440
n-gpc-manitas-delanteras|||unece:304175
n-gpc-manitas-traseras|||unece:304176
n-gpc-manzana-de-caramelo|||10005822
n-gpc-manzana-silvestre|||10006338
n-gpc-maracuya-amarillo|||10005952
n-gpc-maracuya-morado|||10005953
n-gpc-mariposas-y-polillas|||10008320,10008330
n-gpc-masa-y-platos-de-masa|||10000298,10000299,10000300,10000301,10000302
n-gpc-masas-y-elaborados-de-masa|||50193300
n-gpc-mashua|||10006967
n-gpc-mastuerzo|||10006055
n-gpc-media-canal-de-cabrito|||unece:504650
n-gpc-media-canal-de-cerdo|||unece:304001
n-gpc-media-canal-de-cerdo-despiezada-en|||unece:304002
n-gpc-media-canal-de-cerdo-despiezada-en-2|||unece:304003
n-gpc-media-canal-de-cordero|||unece:404510
n-gpc-media-pechuga-de-pavo-con-hueso-es|||unece:710704
n-gpc-media-pechuga-de-pavo-con-hueso-y-|||unece:710705
n-gpc-media-pechuga-de-pavo-con-parte-de|||unece:710703
n-gpc-media-pechuga-de-pavo-con-parte-de-2|||unece:710702
n-gpc-media-pechuga-de-pavo-con-parte-de-3|||unece:710701
n-gpc-media-pechuga-de-pavo-deshuesada-c|||unece:710711
n-gpc-media-pechuga-de-pavo-deshuesada-l|||unece:710712
n-gpc-media-pechuga-de-pollo-con-hueso-c|||unece:700702
n-gpc-media-pechuga-de-pollo-con-hueso-y|||unece:700701
n-gpc-media-pechuga-de-pollo-con-parte-d|||unece:700502
n-gpc-media-pechuga-de-pollo-deshuesada-|||unece:700704
n-gpc-media-pechuga-de-pollo-semideshues|||unece:700705
n-gpc-mejorana|||10006059
n-gpc-melisa|||10006061
n-gpc-melon-amargo|||10006349
n-gpc-melon-cantalupo|||10006828
n-gpc-melon-cantalupo-liso|||10006826
n-gpc-melon-conomon|||10006829
n-gpc-melon-de-invierno|||10006827
n-gpc-menta|||10006063
n-gpc-mermelada-y-confitura|||10006837
n-gpc-mezcla-de-frutos-secos|||10000207
n-gpc-mezclas-de-fruta-y-frutos-secos|||50101900
n-gpc-mezclas-de-pescado-marisco-e-inver|||10000626,10000627,10000628,10000629,10000630,10000631
n-gpc-mezclas-de-pescado-y-marisco|||50122500
n-gpc-minneola-y-otros-tangelos|||10005880
n-gpc-mitad-delantera-de-pollo|||unece:700301
n-gpc-mitad-delantera-de-pollo-sin-alas|||unece:700302
n-gpc-mitad-trasera-de-pavo|||unece:710401
n-gpc-mitad-trasera-de-pavo-sin-rabadill|||unece:710402
n-gpc-mitad-trasera-de-pollo|||unece:700401
n-gpc-mitad-trasera-de-pollo-sin-rabadil|||unece:700402
n-gpc-mizuna|||10006444
n-gpc-mollejas-de-pavo-abiertas-en-marip|||unece:711902
n-gpc-mollejas-de-pavo-elaboradas|||unece:711901
n-gpc-mollejas-de-pavo-semielaboradas|||unece:711903
n-gpc-mollejas-de-pollo-abiertas-en-mari|||unece:701902
n-gpc-mollejas-de-pollo-de-corte-en-v|||unece:701903
n-gpc-mollejas-de-pollo-de-corte-mecanic|||unece:701901
n-gpc-moscas|||10008324,10008334
n-gpc-mostaza-china|||10006339
n-gpc-mostaza-negra|||10006341
n-gpc-nabo-de-mayo|||10006116
n-gpc-nabo-de-teltow|||10006119
n-gpc-name|||10006112
n-gpc-name-mapuey|||10006351
n-gpc-nandu|||10006292,10006308
n-gpc-nido-de-golondrina|||10008449,10008451
n-gpc-nispero-japones|||10005901
n-gpc-nopal|||10008040
n-gpc-oca|||10006289,10006305,10006968
n-gpc-okra|||10006148
n-gpc-okra-china|||10006366
n-gpc-orangelo|||10006343
n-gpc-oregano-griego|||10006060
n-gpc-otra-fruta-de-iv-gama|||10008203
n-gpc-otra-verdura-de-iv-gama|||10008237
n-gpc-otras-frutas|||50251900
n-gpc-otras-verduras|||50261000
n-gpc-oveja|||10006279,10006295
n-gpc-ovoproducto|||10006212
n-gpc-paletilla-cara-externa|||unece:304044
n-gpc-paletilla-cara-externa-despiezada-|||unece:204045
n-gpc-paletilla-cara-interna-1-costilla|||unece:304046
n-gpc-paletilla-cara-interna-2-costillas|||unece:304047
n-gpc-paletilla-cara-interna-3-costillas|||unece:304048
n-gpc-paletilla-cara-interna-4-costillas|||unece:304049
n-gpc-paletilla-cara-interna-deshuesada|||unece:304241
n-gpc-paletilla-cojin|||unece:304183
n-gpc-paletilla-de-cabrito-cara-externa-|||unece:505055
n-gpc-paletilla-de-cabrito-cara-externa--2|||unece:504980
n-gpc-paletilla-de-cabrito-cortada-a-esc|||unece:504991
n-gpc-paletilla-de-cabrito-cortada-a-esc-2|||unece:504990
n-gpc-paletilla-de-cabrito-cortada-a-esc-3|||unece:504992
n-gpc-paletilla-de-cerdo-cortada-a-escua|||unece:304029
n-gpc-paletilla-de-cerdo-cortada-a-escua-2|||unece:304030
n-gpc-paletilla-de-cerdo-cortada-a-escua-3|||unece:304031
n-gpc-paletilla-de-cerdo-cortada-a-escua-4|||unece:304032
n-gpc-paletilla-de-cordero-cara-externa-|||unece:404995
n-gpc-paletilla-de-cordero-cara-externa--2|||unece:404980
n-gpc-paletilla-de-cordero-cara-externa--3|||unece:405055
n-gpc-paletilla-de-cordero-con-brazuelo-|||unece:404773
n-gpc-paletilla-de-cordero-con-brazuelo--2|||unece:404774
n-gpc-paletilla-de-cordero-con-brazuelo--3|||unece:404775
n-gpc-paletilla-de-cordero-con-espaldill|||unece:404776
n-gpc-paletilla-de-cordero-con-espaldill-2|||unece:404777
n-gpc-paletilla-de-cordero-con-espaldill-3|||unece:404778
n-gpc-paletilla-de-cordero-cortada-a-esc|||unece:404991
n-gpc-paletilla-de-cordero-cortada-a-esc-2|||unece:404990
n-gpc-paletilla-de-cordero-cortada-a-esc-3|||unece:404992
n-gpc-paletilla-de-cordero-cortada-a-esc-4|||unece:405051
n-gpc-paletilla-de-cordero-cortada-a-esc-5|||unece:405050
n-gpc-paletilla-de-cordero-cortada-a-esc-6|||unece:405052
n-gpc-paletilla-mitad-inferior-3-costill|||unece:304053
n-gpc-paletilla-mitad-inferior-4-costill|||unece:304052
n-gpc-paletilla-mitad-inferior-5-costill|||unece:304051
n-gpc-paletilla-mitad-inferior-6-costill|||unece:304050
n-gpc-paletilla-mitad-superior-1-costill|||unece:304062
n-gpc-paletilla-mitad-superior-2-costill|||unece:304061
n-gpc-paletilla-mitad-superior-4-costill|||unece:304059
n-gpc-paletilla-mitad-superior-deshuesad|||unece:304245
n-gpc-paletilla-pectoral|||unece:304180
n-gpc-palitos-salados|||10006747
n-gpc-palmito|||10006136
n-gpc-palomitas|||10000252
n-gpc-pan-de-azucar|||10006095
n-gpc-panceta-con-falda|||unece:304333
n-gpc-panceta-de-cerdo-10-costillas|||unece:304082
n-gpc-panceta-de-cerdo-11-costillas|||unece:304081
n-gpc-panceta-de-cerdo-12-costillas|||unece:304080
n-gpc-panceta-de-cerdo-13-costillas|||unece:304079
n-gpc-panceta-deshuesada-de-10-costillas|||unece:304332
n-gpc-panceta-deshuesada-de-11-costillas|||unece:304331
n-gpc-panceta-deshuesada-de-12-costillas|||unece:304330
n-gpc-panceta-deshuesada-de-13-costillas|||unece:304329
n-gpc-papada-de-cerdo|||unece:304350
n-gpc-papaloquelite|||10008004
n-gpc-papaya|||10005954,10008201,50251700
n-gpc-par-de-costillares-de-paletilla-de|||unece:504762
n-gpc-par-de-costillares-de-paletilla-de-2|||unece:504727
n-gpc-par-de-costillares-de-paletilla-de-3|||unece:404762
n-gpc-par-de-costillares-de-paletilla-de-4|||unece:404727
n-gpc-par-de-cuartos-delanteros-de-corde|||unece:404959
n-gpc-par-de-cuartos-delanteros-de-corde-2|||unece:404961
n-gpc-par-de-cuartos-delanteros-de-corde-3|||unece:404960
n-gpc-par-de-cuartos-delanteros-de-corde-4|||unece:404962
n-gpc-par-de-paletillas-de-cordero-cara-|||unece:404976
n-gpc-par-de-piernas-de-cabrito-con-sill|||unece:504901
n-gpc-par-de-piernas-de-cabrito-con-sill-2|||unece:504946
n-gpc-par-de-piernas-de-cordero|||unece:404816
n-gpc-par-de-piernas-de-cordero-con-sill|||unece:404901
n-gpc-par-de-piernas-de-cordero-con-sill-10|||unece:404945
n-gpc-par-de-piernas-de-cordero-con-sill-11|||unece:404946
n-gpc-par-de-piernas-de-cordero-con-sill-12|||unece:404941
n-gpc-par-de-piernas-de-cordero-con-sill-13|||unece:404940
n-gpc-par-de-piernas-de-cordero-con-sill-14|||unece:404942
n-gpc-par-de-piernas-de-cordero-con-sill-2|||unece:404902
n-gpc-par-de-piernas-de-cordero-con-sill-3|||unece:404903
n-gpc-par-de-piernas-de-cordero-con-sill-4|||unece:404904
n-gpc-par-de-piernas-de-cordero-con-sill-5|||unece:404905
n-gpc-par-de-piernas-de-cordero-con-sill-6|||unece:404906
n-gpc-par-de-piernas-de-cordero-con-sill-7|||unece:404907
n-gpc-par-de-piernas-de-cordero-con-sill-8|||unece:404943
n-gpc-par-de-piernas-de-cordero-con-sill-9|||unece:404944
n-gpc-par-de-rinonadas-de-cordero-1-cost|||unece:404883
n-gpc-par-de-rinonadas-de-cordero-2-cost|||unece:404884
n-gpc-par-de-rinonadas-de-cordero-3-cost|||unece:404885
n-gpc-par-de-rinonadas-de-cordero-sin-co|||unece:404882
n-gpc-pastel|||10000170,10000171,10000172
n-gpc-pasteleria-dulce|||10000245,10000246,10000247
n-gpc-patas-de-pollo-elaboradas|||unece:701802
n-gpc-patatas-fritas-y-aperitivos|||10000177
n-gpc-pavo-entero|||unece:710101
n-gpc-pavo-entero-sin-menudillos|||unece:710102
n-gpc-pecho-de-cordero-con-falda|||unece:405010
n-gpc-pecho-de-cordero-con-falda-deshues|||unece:405172
n-gpc-pechuga-entera-de-pavo-con-costill|||unece:710613
n-gpc-pechuga-entera-de-pavo-con-costill-2|||unece:710612
n-gpc-pechuga-entera-de-pavo-con-costill-3|||unece:710611
n-gpc-pechuga-entera-de-pavo-con-espalda|||unece:710601
n-gpc-pechuga-entera-de-pavo-con-espalda-2|||unece:710603
n-gpc-pechuga-entera-de-pavo-con-espalda-3|||unece:710602
n-gpc-pechuga-entera-de-pavo-con-hueso-e|||unece:710604
n-gpc-pechuga-entera-de-pavo-con-hueso-y|||unece:70615
n-gpc-pechuga-entera-de-pavo-con-hueso-y-2|||unece:710614
n-gpc-pechuga-entera-de-pavo-deshuesada-|||unece:710616
n-gpc-pechuga-entera-de-pollo-con-costil|||unece:700601
n-gpc-pechuga-entera-de-pollo-con-hueso-|||unece:700602
n-gpc-pechuga-entera-de-pollo-deshuesada|||unece:700603
n-gpc-pechuga-entera-de-pollo-deshuesada-2|||unece:700604
n-gpc-pechuga-entera-de-pollo-deshuesada-3|||unece:700605
n-gpc-pepicha|||10008005
n-gpc-pepino-armenio|||10006830
n-gpc-pepino-retorcido|||10006450
n-gpc-pera-ya|||10006415
n-gpc-perejil-liso|||10006199
n-gpc-perejil-rizado|||10006198
n-gpc-perifollo|||10006053
n-gpc-perifollo-oloroso|||10006065
n-gpc-perifollo-tuberoso|||10006418
n-gpc-pescado|||10000016,10000017,10000018,10000281,10000282,10000283
n-gpc-physalis|||10005965
n-gpc-pichon|||10006293,10006309
n-gpc-piel-de-contramuslo-y-jamoncito-de|||unece:702302
n-gpc-piel-de-contramuslo-y-jamoncito-de-2|||unece:712302
n-gpc-piel-de-cuello-de-pavo|||unece:712306
n-gpc-piel-de-pavo|||unece:712303
n-gpc-piel-de-pechuga-de-pavo|||unece:712301
n-gpc-piel-de-pechuga-de-pavo-troquelada|||unece:712304
n-gpc-piel-de-pechuga-de-pavo-troquelada-2|||unece:712305
n-gpc-piel-de-pechuga-de-pollo|||unece:702301
n-gpc-piel-de-pollo|||unece:702303
n-gpc-pierna-de-cabrito-con-rinonada|||unece:504800
n-gpc-pierna-de-cabrito-con-rinonada-des|||unece:505060
n-gpc-pierna-de-cabrito-con-rinonada-sin|||unece:504810
n-gpc-pierna-de-cabrito-de-trinchado-fac|||unece:504821
n-gpc-pierna-de-cabrito-parte-baja|||unece:505067
n-gpc-pierna-de-cabrito-sin-rinonada|||unece:504820
n-gpc-pierna-de-cordero-babilla|||unece:405076
n-gpc-pierna-de-cordero-con-jarrete-sin-|||unece:404805
n-gpc-pierna-de-cordero-con-rinonada|||unece:404800
n-gpc-pierna-de-cordero-con-rinonada-des|||unece:405060
n-gpc-pierna-de-cordero-con-rinonada-sin|||unece:404810
n-gpc-pierna-de-cordero-con-rinonada-sin-2|||unece:404802
n-gpc-pierna-de-cordero-con-rinonada-sin-3|||unece:405061
n-gpc-pierna-de-cordero-con-rinonada-y-j|||unece:404801
n-gpc-pierna-de-cordero-contra|||unece:405075
n-gpc-pierna-de-cordero-culata-de-contra|||unece:405071
n-gpc-pierna-de-cordero-de-trinchado-fac|||unece:404821
n-gpc-pierna-de-cordero-parte-del-filete|||unece:404822
n-gpc-pierna-de-cordero-parte-del-jarret|||unece:404823
n-gpc-pierna-de-cordero-punta-de-babilla|||unece:405072
n-gpc-pierna-de-cordero-sin-rinonada|||unece:404820
n-gpc-pierna-de-cordero-sin-rinonada-jar|||unece:404806
n-gpc-pierna-de-cordero-sin-rinonada-ni-|||unece:404830
n-gpc-pierna-de-cordero-sin-rinonada-ni--2|||unece:405070
n-gpc-pierna-de-cordero-tapa|||unece:405073
n-gpc-pierna-de-cordero-tapa-sin-capa|||unece:405077
n-gpc-piezas-surtidas-de-cabrito-limpiez|||unece:505199
n-gpc-pimiento-cuadrado|||10006190
n-gpc-pimiento-de-tomate|||10006192
n-gpc-pimiento-italiano|||10006100
n-gpc-pimpinela|||10006071
n-gpc-pitaya|||10008202,50251800
n-gpc-pitaya-amarilla|||10005956
n-gpc-pitaya-dulce|||10005957
n-gpc-plantas-crasas-comestibles|||10008232,50262300
n-gpc-platano-baby|||10005896
n-gpc-platano-manzano|||10005895
n-gpc-platano-rojo|||10005899
n-gpc-platos-a-base-de-cereal|||10000293,10000294,10000295,10000296,10000297
n-gpc-platos-a-base-de-huevo|||10005224,10005225,10005226
n-gpc-platos-a-base-de-lacteos-y-huevo|||10005227,10005228,50193500
n-gpc-platos-a-base-de-verdura|||10000288,10000289,10000290,10000291,10000292,50193100
n-gpc-plumcot|||10005915
n-gpc-pollo-abierto-en-dos-mitades|||unece:700201
n-gpc-pollo-en-cuartos|||unece:700202
n-gpc-pollo-entero|||unece:700101
n-gpc-pollo-entero-deshuesado-sin-alas-n|||unece:700103
n-gpc-pollo-entero-sin-menudillos|||unece:700102
n-gpc-pollo-entero-sin-menudillos-con-ca|||unece:700107
n-gpc-pollo-entero-sin-menudillos-con-ca-2|||unece:700108
n-gpc-pollo-entero-sin-menudillos-con-cu|||unece:700106
n-gpc-pollo-entero-sin-menudillos-con-ja|||unece:700104
n-gpc-pollo-entero-sin-menudillos-con-me|||unece:700105
n-gpc-pollo-troceado-en-10-piezas|||unece:700208
n-gpc-pollo-troceado-en-6-piezas|||unece:700203
n-gpc-pollo-troceado-en-8-piezas-corte-a|||unece:700205
n-gpc-pollo-troceado-en-8-piezas-corte-t|||unece:700204
n-gpc-pollo-troceado-en-9-piezas-corte-c|||unece:700207
n-gpc-pollo-troceado-en-9-piezas-corte-t|||unece:700206
n-gpc-pomelo-chino|||10005877
n-gpc-pomelo-miel|||10005878
n-gpc-postres-salsas-y-coberturas|||50192300
n-gpc-preparado-isotonico|||10000264
n-gpc-preparado-para-reposteria|||10000068,10000155,10000156
n-gpc-preparados-e-ingredientes-de-repos|||50181700
n-gpc-preparados-lacteos|||10005826,10005827
n-gpc-presa-de-paleta|||unece:304182
n-gpc-primer-y-segundo-segmento-de-ala-d|||unece:711302
n-gpc-producto-de-cereal|||10000284,10000285,10000286,10006250
n-gpc-productos-de-origen-animal|||50410100,50410200
n-gpc-puerro-egipcio|||10006007
n-gpc-punta-de-ala-de-pollo|||unece:701306
n-gpc-puntarella|||10006423
n-gpc-rabadilla-de-pollo|||unece:701501
n-gpc-rabadillas-de-pavo|||unece:711501
n-gpc-rabano-negro|||10006115
n-gpc-rabano-picante|||10006124
n-gpc-racion-de-campana|||10008058
n-gpc-radicchio|||10006421
n-gpc-radicchio-rosso|||10006094
n-gpc-raiz-de-loto|||10006364
n-gpc-raiz-de-perejil|||10006127
n-gpc-rana|||10005772,10005791
n-gpc-rebozuelo|||10006033
n-gpc-recortes-de-ala-de-pavo|||unece:716003
n-gpc-recortes-de-carne-blanca-de-pavo|||unece:716001
n-gpc-recortes-de-carne-oscura-de-pavo|||unece:716004
n-gpc-recortes-de-cerdo|||unece:304470
n-gpc-recortes-de-contramuslo-de-pavo|||unece:716005
n-gpc-recortes-de-jamoncito-de-pavo|||unece:716006
n-gpc-recortes-de-pechuga-de-pavo|||unece:716002
n-gpc-reishi|||10006836
n-gpc-reno|||10006287,10006303
n-gpc-repollo|||10005999
n-gpc-rinonada-de-cabrito|||unece:504880
n-gpc-rinonada-de-cabrito-con-hueso|||unece:504790
n-gpc-rinonada-de-cabrito-deshuesada|||unece:505130
n-gpc-rinonada-de-cordero-1-costilla|||unece:404880
n-gpc-rinonada-de-cordero-2-costillas|||unece:404879
n-gpc-rinonada-de-cordero-3-costillas|||unece:404878
n-gpc-rinonada-de-cordero-con-cadera-1-c|||unece:404874
n-gpc-rinonada-de-cordero-con-cadera-2-c|||unece:404875
n-gpc-rinonada-de-cordero-con-cadera-3-c|||unece:404876
n-gpc-rinonada-de-cordero-con-cadera-sin|||unece:404873
n-gpc-rinonada-de-cordero-con-hueso|||unece:404790
n-gpc-rinonada-de-cordero-deshuesada|||unece:405130
n-gpc-rinonada-de-cordero-sin-costillas|||unece:404881
n-gpc-romanesco|||10006196
n-gpc-rucula|||10006088
n-gpc-ruibarbo|||10006134
n-gpc-saborizante-de-bebida|||10008495
n-gpc-sal-y-ablandadores-de-carne|||10000050
n-gpc-salak|||10006436
n-gpc-salicornia|||10006460
n-gpc-salsa-para-cocinar|||10000055,10000056,10000057
n-gpc-salsas-untables-y-condimentos|||50171800
n-gpc-salsas-y-adobos|||10000054,10000280,10000577
n-gpc-salsas-y-rellenos-de-postre|||10000193,10000194,10000195
n-gpc-salsifi|||10006367
n-gpc-saltamontes-y-grillos|||10008322,10008332
n-gpc-salvia|||10006353
n-gpc-sauco|||10006432
n-gpc-schisandra|||10006832
n-gpc-segundo-segmento-de-ala-de-pavo|||unece:711305
n-gpc-segundo-y-tercer-segmento-de-ala-d|||unece:711303
n-gpc-seta-de-ostra|||10006031
n-gpc-seta-silvestre|||10006266
n-gpc-setas-y-hongos|||10008215,50261700
n-gpc-shiitake|||10006034
n-gpc-shimeji|||10006263
n-gpc-sidra|||10006327
n-gpc-sidra-espumosa|||10000181
n-gpc-silla-de-cabrito|||unece:504900
n-gpc-silla-de-carre-de-cordero-6-costil|||unece:404926
n-gpc-silla-de-carre-de-cordero-7-costil|||unece:404927
n-gpc-silla-de-carre-de-cordero-8-costil|||unece:404928
n-gpc-silla-de-carre-de-cordero-9-costil|||unece:404929
n-gpc-silla-de-cordero-10-costillas|||unece:404897
n-gpc-silla-de-cordero-11-costillas|||unece:404898
n-gpc-silla-de-cordero-12-costillas|||unece:404899
n-gpc-silla-de-cordero-13-costillas|||unece:404900
n-gpc-silla-de-cordero-7-costillas|||unece:404911
n-gpc-silla-de-cordero-8-costillas|||unece:404910
n-gpc-silla-de-cordero-9-costillas|||unece:404912
n-gpc-sirope-y-melaza|||10000044
n-gpc-solanaceas-y-otras|||10008228,50260500
n-gpc-solomillo-de-cabrito|||unece:505080
n-gpc-solomillo-de-cerdo-corte-unece|||unece:304280
n-gpc-solomillo-de-cordero|||unece:405080
n-gpc-solomillo-de-cordero-cabeza|||unece:405081
n-gpc-solomillo-de-cordero-sin-cabeza|||unece:405082
n-gpc-solomillo-de-pavo-con-tendon|||unece:710801
n-gpc-solomillo-de-pavo-con-tendon-recor|||unece:710802
n-gpc-solomillo-de-pollo|||unece:700801
n-gpc-solomillo-de-pollo-sin-punta-de-te|||unece:700802
n-gpc-sopas-preparadas|||10000260,10000261,10000262,50191500
n-gpc-subproducto-lacteo|||10006728
n-gpc-sucedaneo-de-cafe-en-capsulas|||10008181
n-gpc-sucedaneo-de-cafe-liquido|||10006312
n-gpc-sucedaneo-de-cafe-molido|||10008182
n-gpc-sucedaneo-de-cafe-soluble|||10006311
n-gpc-sucedaneo-de-huevo|||10006213
n-gpc-sucedaneo-de-miel|||10006848
n-gpc-surtido-de-hierbas|||10006456
n-gpc-surtidos-de-aceites-y-grasas|||10000609,50151700
n-gpc-surtidos-de-alimentacion|||10000590,50230100
n-gpc-surtidos-de-alimentacion-infantil|||10000610
n-gpc-surtidos-de-aperitivos|||10000612
n-gpc-surtidos-de-azucares-y-edulcorante|||10000603
n-gpc-surtidos-de-bebidas|||10000623,50202500
n-gpc-surtidos-de-bebidas-alcoholicas|||10000591
n-gpc-surtidos-de-bebidas-sin-alcohol|||10000593,10000594
n-gpc-surtidos-de-bocadillos-y-wraps|||10006217
n-gpc-surtidos-de-bolleria-dulce|||10000597
n-gpc-surtidos-de-cafe-e-infusiones|||10000592
n-gpc-surtidos-de-cereales-elaborados|||10000600
n-gpc-surtidos-de-cereales-y-legumbres|||10000601,50221300
n-gpc-surtidos-de-condimentos-y-extracto|||10000619,50172000
n-gpc-surtidos-de-confiteria|||10000602
n-gpc-surtidos-de-confiteria-y-azucares|||10000622,50161900
n-gpc-surtidos-de-elaborados-de-cereal|||10006228
n-gpc-surtidos-de-encurtidos-y-aceitunas|||10000616
n-gpc-surtidos-de-fruta|||10006172,50252000
n-gpc-surtidos-de-fruta-cortada|||10008204
n-gpc-surtidos-de-fruta-verdura-y-frutos|||10000605,50102200
n-gpc-surtidos-de-fruta-y-frutos-secos|||10000604
n-gpc-surtidos-de-fruta-y-verdura-sin-el|||10008188,50370100
n-gpc-surtidos-de-frutos-rojos|||10008027
n-gpc-surtidos-de-galletas|||10000596
n-gpc-surtidos-de-granos-y-harinas|||10000599
n-gpc-surtidos-de-grasas|||10000608
n-gpc-surtidos-de-hierbas-y-especias|||10000615
n-gpc-surtidos-de-hoja|||10006428,50350600
n-gpc-surtidos-de-hoja-cortada|||10008218
n-gpc-surtidos-de-iv-gama|||10008189,50370200
n-gpc-surtidos-de-lacteos-y-huevos|||10000607,50132200
n-gpc-surtidos-de-marisco|||10000614,50122400
n-gpc-surtidos-de-masas|||10006222
n-gpc-surtidos-de-panaderia|||10000598,50182300
n-gpc-surtidos-de-pasta|||10006219
n-gpc-surtidos-de-pimiento|||10006195
n-gpc-surtidos-de-platos-con-lacteos-y-h|||10006229
n-gpc-surtidos-de-platos-de-verdura|||10006221
n-gpc-surtidos-de-platos-preparados|||10006753,10006754
n-gpc-surtidos-de-platos-preparados-y-co|||10000613,50193400
n-gpc-surtidos-de-postres-y-coberturas|||10000611
n-gpc-surtidos-de-reposteria|||10000595
n-gpc-surtidos-de-salsas-y-condimentos|||10000617
n-gpc-surtidos-de-sopas|||10006216
n-gpc-surtidos-de-sustitutos-de-carne|||10006230
n-gpc-surtidos-de-sustitutos-de-marisco|||10008258
n-gpc-surtidos-de-sustitutos-de-pescado|||10008253
n-gpc-surtidos-de-tomate|||10006166
n-gpc-surtidos-de-untables-dulces|||10000621
n-gpc-surtidos-de-verdura|||10006171,50261800
n-gpc-surtidos-de-verdura-cortada|||10008236
n-gpc-surtidos-de-vinagres-y-vinos-de-co|||10000618
n-gpc-sustituto-de-carne-de-origen-anima|||10008244,10008245,10008246
n-gpc-sustituto-de-marisco-de-origen-ani|||10008255,10008256,10008257
n-gpc-sustituto-de-nata|||10006975,10006976,10006977
n-gpc-sustituto-de-pescado-de-origen-ani|||10008248,10008250,10008252
n-gpc-sustituto-de-postre|||10008458
n-gpc-sustituto-de-queso|||10006995,10006996,10006997
n-gpc-sustituto-de-yogur|||10006978,10006979,10006980
n-gpc-sustituto-vegetal-de-carne|||10005823,10005824,10005825
n-gpc-sustituto-vegetal-de-marisco|||10008107,10008108,10008254
n-gpc-sustituto-vegetal-de-pescado|||10008247,10008249,10008251
n-gpc-sustitutos-de-carne|||50390100
n-gpc-sustitutos-de-marisco|||50390300
n-gpc-sustitutos-de-pescado|||50390200
n-gpc-sweetie|||10005879
n-gpc-tallo-de-boniato|||10006835
n-gpc-tamarillo|||10006358
n-gpc-tangor|||10006442
n-gpc-tapa-de-cabrito|||unece:505073
n-gpc-tapa-de-cabrito-sin-capa|||unece:505077
n-gpc-taro|||10006107
n-gpc-tatsoi|||10006447
n-gpc-te-concentrado|||10008185
n-gpc-te-e-infusiones|||50202700
n-gpc-te-en-capsulas|||10008184
n-gpc-te-listo-para-beber|||10000118
n-gpc-te-soluble|||10000117
n-gpc-tendones-de-pavo|||unece:716021
n-gpc-tercer-segmento-de-ala-de-pavo|||unece:711306
n-gpc-termitas|||10008325,10008335
n-gpc-ternera|||10005785,10005804
n-gpc-tirabeque-dulce|||10005985
n-gpc-tocino-de-paletilla|||unece:307680
n-gpc-tomate-alargado|||10006163
n-gpc-tomate-asurcado|||10006164
n-gpc-tomate-cherry-alargado|||10006161
n-gpc-tomate-cherry-redondo|||10006162
n-gpc-tomate-redondo|||10006165
n-gpc-tomatillo|||10006451
n-gpc-tomillo|||10006075
n-gpc-tomillo-limonero|||10006076
n-gpc-tripa-artificial|||10008044
n-gpc-tripas-y-envolturas|||50172100
n-gpc-tronco-de-cabrito|||unece:504720
n-gpc-tronco-de-cabrito-con-rinonada|||unece:504721
n-gpc-tronco-de-cordero|||unece:4720
n-gpc-tronco-de-cordero-con-rinonada|||unece:404720
n-gpc-trufa|||10006036
n-gpc-ugli|||10005881
n-gpc-untables-dulces|||50192400
n-gpc-uva-de-mesa|||10005918
n-gpc-uva-espina|||10005932
n-gpc-verdolaga|||10006092
n-gpc-verdura-de-iv-gama|||50380200
n-gpc-verdura-marina|||10006262
n-gpc-verduras-marinas|||10008234,50262100
n-gpc-vinagres-y-vinos-de-cocina|||50171700
n-gpc-vino-de-cocina|||10000052
n-gpc-vino-espumoso|||10000275,10008030
n-gpc-vino-generoso|||10000273
n-gpc-vino-tranquilo|||10000276,10008031
n-gpc-wapiti|||10006284,10006300
n-gpc-yaca|||10005974
n-gpc-zapote-blanco|||10006370
n-gpc-zapote-negro|||10006369
n-gpc-zumo-de-fruta|||10000219,10000220,10000307,10000308
n-gpc-zumo-de-verdura|||10006251,10006252,10006253,10006254
n-grocery|||50132300,50132500,50160000,50170000,50190000,50230000,50330000,50340000
n-hake|HKE|Merluccius merluccius.|241113,241114,241115,251112,251113,251114
n-herb|||10008493
n-ice|||10000214
n-l-leche|||10000025,10000026,10000027
n-l-mantequilla|||10000167,10000168,10000169
n-l-margarina|||10006981,10006982,10006983
n-l-nata|||10000188,10000189,10000190
n-l-yogur|||10000277,10000278,10000279
n-mango|||10005969,313EAA
n-meat|||50240000,50240200,50390000,50400000,50410000
n-milk|||50131700,50132000
n-monkfish|||241151,241155,251151,251152
n-octopus|OCC|Octopus vulgaris.|243104,243203,2434041,2531013,2531014
n-oils|||50150000,50151500
n-parsley|||324MAA
n-pate|||10000064,10000306,10000576
n-pork|||10005781,10005800
n-prawn|||255105
n-preserves|||50100000,50102100
n-produce|||50250000,50260000,50270000,50290000,50310000,50320000,50350000,50360000,50370000,50380000
n-pulses|||50220000,50221000
n-rabbit|||10005782,10005801
n-root|||10008224,50260100
n-sausage|||50240300
n-seabass|BSS|Dicentrarchus labrax.|241191,2411921
n-seaweed|||10000137,10000138,10000139,10000151,10000152,10000153,50121800,50122200
n-shellfish|||10000019,10000020,10000021,10000256,10000257,10000258,50121700,50122100
n-tomato|||10008235,326GAZ,326GBZ,50260300
n-turkey|||10005784,10005803
n-v-acelga|||324AAA
n-v-ajo|||10006003,322AAA,322ABA
n-v-albaricoque|||10005905,312AAZ
n-v-alcachofa|||10006130,325DAA
n-v-apio|||10006123,10006131
n-v-arandano|||10005929
n-v-batata|||320AAA,320AAB
n-v-berenjena|||10006128,326AAA,326ACA
n-v-berro|||10006048,324DAA
n-v-boniato|||10006111
n-v-borraja|||10006047,324EAA
n-v-brocoli|||10005988
n-v-brotes-tiernos|||10006269
n-v-calabaza|||10006038,10006355,326CAA
n-v-caqui|||10005946,10008199,319KAZ,50251500
n-v-carambola|||10005961,313GAA
n-v-cardo|||10006135,324FAA
n-v-castana|||314BAA
n-v-cebolla|||10006006,322BAA,322BCA,322BDA
n-v-cebollino|||10006074
n-v-cereza|||10005908,312BAZ
n-v-champinon|||10006157
n-v-chirimoya|||10005939
n-v-chirivia|||10006126,321AAA
n-v-ciruela|||10005917,312CCZ
n-v-coco|||313CAA
n-v-coles-repollo|||10006143
n-v-coliflor|||10005987,325BAA
n-v-curuba|||10005950
n-v-datil|||10005959,319IAA
n-v-endivia|||10006093,10006422
n-v-escarola|||10006155,324HAA
n-v-esparrago|||10006129,323BAA,323BBA
n-v-espinaca|||10006091,10008229,324IAA
n-v-frambuesa|||10005927,319BAA
n-v-fresa|||10005921,319CAA
n-v-freson|||319DAZ
n-v-germinado|||10006259
n-v-granada|||10005970,319JAA
n-v-grelo|||10006117
n-v-grosella|||10006193,319FAA
n-v-guanabana|||10005942
n-v-guindilla|||10006102
n-v-guisante|||10005984,327AAA
n-v-higo|||10005960,319GAZ
n-v-higo-chumbo|||10005967,319HAA
n-v-hinojo|||324JAA
n-v-jengibre|||10006113
n-v-kale|||10006144
n-v-kiwano|||10006350
n-v-kiwi|||10005937,10008196,50251200
n-v-laurel|||10006058
n-v-lechuga|||10006079,10006267,10006419,10006426,324KAA,324KBA,324KZZ
n-v-lima|||10005884,310BAA
n-v-limon|||10005882,310AAA
n-v-lombarda|||10005997,324GBA
n-v-maiz|||10006337,339CAA
n-v-mandarina|||10005887,10005888,310CAA,310CBA,310CZZ
n-v-mangostan|||10005968
n-v-manzana|||10005900,311AAA,311ABA,311ACA,311ADA,311AZZ
n-v-maracuya|||313IAA
n-v-melocoton|||10005912,312DAZ,312DGA,312DZZ
n-v-melon|||10006348,10008220,319LAA,319LBA,319LCA,319LZZ,50260800
n-v-membrillo|||10006173,311BAA
n-v-menestra|||339DAA
n-v-microvegetal|||10008221,50261900
n-v-nabo|||10006120,321BAA
n-v-naranja|||10005889,310DAZ
n-v-nashi|||10005902
n-v-nectarina|||10005911,312FAA,312FBA
n-v-nispero|||10006414,311CAA
n-v-nuece|||314CAA
n-v-pak-choi|||10006145
n-v-paraguaya|||10006443
n-v-patata|||10006104,320BBA,320BCA,320BDA
n-v-pepino|||10006014,10006453,10008210,326DBA,50260600
n-v-pera|||10005903,311DAZ,311DDA,311DEZ,311DHZ
n-v-pimiento|||10006191,10008223,326EAB,326EBB,326EBZ,50260400
n-v-pina|||10005935,10008195,319PAA,50251100
n-v-pitahaya|||313JAA
n-v-platano|||10005897,10005898,10008191,319NAA,319NZZ,50250700
n-v-pomelo|||10005876,310EAA
n-v-puerro|||10006133,322DAA
n-v-rabano|||10006114,321CAA
n-v-rambutan|||10005966,313KAA
n-v-remolacha|||10006121,321DAA
n-v-sandia|||10006037,319MAA,319MBA
n-v-seta|||10006265,331ZAZ
n-v-tamarindo|||10006359
n-v-tirabeque|||10006270
n-v-uva|||319AAA,319ABA
n-v-yuca|||10006108
n-v-zanahoria|||10006122,321EAA
n-v-zapote|||10008225,50262500
n-vegetable|||10000005,10000006,10000270,10000271,10000272,50102100,50260000,50290100,50320100,50350100,50350200,50350300,50350400,50350500,50350700
n-whitefish|||50121500,50121900
n-yoghurt|||50132100`;

export const REF_WORDS: RefWord[] = WORDS.split('\n').map((line) => {
  const [w, node, reg] = line.split('|');
  return { w, node, reg: REGISTER[reg] };
});

export const REF_ATTRS: ReadonlyMap<string, RefAttrs> = new Map(
  ATTRS.split('\n').filter(Boolean).map((line) => {
    const [id, fao, sci, codes] = line.split('|');
    return [id, {
      fao: fao ? fao.split(',') : [],
      sci: sci ? sci.split(';') : [],
      codes: codes ? codes.split(',') : [],
    }] as const;
  }),
);
