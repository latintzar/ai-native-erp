#!/usr/bin/env python3
"""THE REFERENCE WING of the painted matrix (THE-DENSE-BRIEF §C, reference-data.ts).

WHAT THIS FILE IS FOR. build_subjects.py hand-listed the first 223 kinds. This one derives the
next set from the STANDARD REFERENCE instead — 4,722 ladder nodes across twelve families — so the
question «what deserves a painting?» is answered by a RULE over that data rather than by taste:

    a node earns a painting when the trade actually sells it AND it looks like itself on a bench.

`reference_gate.py` computes the candidate set from reference-data.ts (traded ∧ real product ∧
look-distinct). This file supplies the one thing a register cannot: what the thing LOOKS LIKE.
The gate then asserts the two agree — a selected candidate with no clause here is a build error,
and a clause here for a node the reference never names is a build error too. Neither half can
drift silently.

THE LOOK-SPACE RULE, APPLIED (§C: «paint the look-space, map the name-space»):
  · L1 KIND      every kind the market quotes — the BOE's traded species, the cut heads a
                 butcher's window shows, the charcuterie and cheeses Spanish law leaves to
                 «la denominación consagrada por el uso».
  · L2 SORT      ONLY where the variety changes the picture. Tomate raf yes, merluza austral no.
                 The reference holds 586 apple cultivars and 165 pear ones; a market stall shows
                 about eight of each, and eight is what gets painted.
  · L3 FORM      the templates in build_subjects.T, per family.
  · packaged-brand territory gets NOTHING. A GPC brick called «snack mixes» is a shelf, not a
    look; the family mark carries it.
"""


def add_reference_kinds(K):
    """Append the reference wing to build_subjects.KINDS. K is that module's constructor."""

    # ═══ FISH · the BOE species the Mercas actually quote ═════════════════════════════════════
    # Spanish law makes the BOE's commercial name «denominación oficial en todo el territorio
    # nacional», and 101 of its species carry a Merca quote. 41 of those were unpainted.
    K("fish", "Acedía",
      "a single whole wedge sole, a small oval flat fish, sandy grey-brown on its upper side with both eyes together and a pale fringe of fin all round",
      ["entero", "filetes"], en="wedge sole")
    K("fish", "Aguja",
      "a single whole garfish, a very long slender fish with a bright green-blue back, silver belly and a narrow beaked snout full of fine teeth",
      ["entero", "eviscerado"], en="garfish", flesh="pale grey")
    K("fish", "Alacha",
      "a single whole round sardinella, a slim silver fish with a blue-green back and a small golden spot behind the gill",
      ["entero", "eviscerado"], en="round sardinella", flesh="pinkish grey")
    K("fish", "Aligote",
      "a single whole axillary seabream, a deep-bodied rose-pink fish with a dark blotch at the base of the pectoral fin",
      ["entero", "eviscerado"], en="axillary seabream")
    K("fish", "Arenque",
      "a single whole herring, a slim fish with a steel-blue back, bright silver flanks and large loose scales",
      ["entero", "filetes", "ahumado"], en="herring", flesh="pinkish grey",
      ov={"ahumado": "two smoked herring fillets, deep bronze-gold skin over amber flesh, laid side by side"})
    K("fish", "Barrilete",
      "a single whole skipjack tuna, a torpedo-shaped fish with a dark steel-blue back and four bold dark stripes running along its silver belly",
      ["entero", "lomos"], en="skipjack tuna", flesh="deep red")
    K("fish", "Bertorella",
      "a single whole three-bearded rockling, a slender fish with mottled russet-brown skin and three fine barbels around its mouth",
      ["entero", "eviscerado"], en="rockling")
    K("fish", "Boga",
      "a single whole bogue, a small slim fish with a bronze-gold back, silver flanks marked with fine golden stripes and a very large dark eye",
      ["entero", "eviscerado"], en="bogue")
    K("fish", "Breca",
      "a single whole common pandora, a deep-bodied fish with rosy-pink skin, a silver belly and a small blue mark above the eye",
      ["entero", "eviscerado"], en="pandora")
    K("fish", "Carbonero",
      "a single whole saithe, a heavy dark fish with a slate-black back, a straight white lateral line and a pale belly",
      ["entero", "lomos"], en="saithe", flesh="grey-white")
    K("fish", "Cherna",
      "a single whole wreckfish, a heavy-bodied dark brown fish with a broad blunt head and a large jutting lower jaw",
      ["entero", "lomos", "rodajas"], en="wreckfish", flesh="firm white")
    K("fish", "Chopa",
      "a single whole black seabream, a deep oval fish with dark grey-blue skin crossed by faint vertical bars and a small mouth",
      ["entero", "eviscerado"], en="black seabream")
    K("fish", "Cococha",
      "a small heap of hake kokotxas, four soft pale-ivory tongues of throat meat, glossy and rounded, resting together",
      ["pieza"], en="hake kokotxa")
    K("fish", "Faneca",
      "a single whole pouting, a deep coppery-bronze fish with faint pale vertical bands and a single barbel under the chin",
      ["entero", "eviscerado"], en="pouting")
    K("fish", "Fletán",
      "a single whole halibut, a very large flat fish with a smooth dark slate-brown upper side and both eyes on the right",
      ["entero", "lomos", "rodajas"], en="halibut", flesh="firm white")
    K("fish", "Gallineta",
      "a single whole redfish, a stout bright orange-red fish with very large eyes and a spiny dorsal fin raised along its back",
      ["entero", "lomos"], en="redfish", flesh="pale pink")
    K("fish", "Maruca",
      "a single whole ling, a very long slender fish with mottled bronze-brown skin, a long unbroken dorsal fin and a single chin barbel",
      ["entero", "lomos"], en="ling")
    K("fish", "Melva",
      "a single whole frigate tuna, a small torpedo-shaped fish with a dark blue back patterned with fine wavy lines and a silver belly",
      ["entero", "lomos"], en="frigate tuna", flesh="dark rosy red")
    K("fish", "Mujol",
      "a single whole grey mullet, a stocky silver fish with a flat-topped head, large scales and a blunt rounded snout",
      ["entero", "eviscerado", "filetes"], en="grey mullet", flesh="greyish white")
    K("fish", "Panga",
      "two clean boneless pangasius fillets laid neatly side by side, very pale pinkish-white flesh in a long smooth blade",
      ["filetes"], en="pangasius", flesh="pale pinkish-white")
    K("fish", "Pargo",
      "a single whole common seabream, a deep-bodied silver-pink fish with a steep forehead, strong jaw and a faint gold sheen along the flank",
      ["entero", "eviscerado", "lomos"], en="common seabream")
    K("fish", "Perca",
      "two clean boneless Nile perch loins set side by side, thick firm white flesh with a fine flake",
      ["lomos", "filetes"], en="Nile perch", flesh="firm white")
    K("fish", "Perlón",
      "a single whole tub gurnard, a fish with a big armoured red-orange head, a steeply sloping snout and wide blue-edged pectoral fins",
      ["entero", "eviscerado"], en="gurnard")
    K("fish", "Pintarroja",
      "a single whole small-spotted catshark, a slim sandy-brown shark speckled all over with small dark spots, its tail curled round",
      ["entero", "limpio"], en="catshark",
      ov={"limpio": "a single skinned catshark body, a smooth pale pink tapering trunk with the head and skin removed"})
    K("fish", "Platija",
      "a single whole flounder, an oval flat fish, mottled olive-brown on its upper side with both eyes together and a pale underside showing at the edge",
      ["entero", "filetes"], en="flounder")
    K("fish", "Sargo",
      "a single whole white seabream, a deep silver fish crossed by bold dark vertical bars and a black saddle at the tail root",
      ["entero", "eviscerado"], en="white seabream")
    K("fish", "Solla",
      "a single whole plaice, an oval flat fish, smooth brown on its upper side and scattered with bright orange spots, both eyes on the right",
      ["entero", "filetes"], en="plaice")
    K("fish", "Tilapia",
      "two clean boneless tilapia fillets laid neatly side by side, pale pinkish-white flesh in a broad leaf shape",
      ["filetes"], en="tilapia", flesh="pale pinkish-white")
    K("fish", "Vieja",
      "a single whole parrotfish, a stocky fish with blunt beaked jaws and skin washed in soft rose, grey and turquoise",
      ["entero", "eviscerado"], en="parrotfish")
    K("fish", "Angula",
      "a small dense tangle of live elvers, hundreds of tiny translucent thread-thin eels with fine dark eyes, heaped together",
      ["pieza"], en="elvers")
    K("fish", "Gula",
      "a small heap of gulas, short pale surimi threads shaped like elvers, each with two tiny painted black eyes",
      ["pieza"], en="surimi elvers")
    K("fish", "Surimi",
      "three surimi crab sticks laid side by side, smooth white cylinders wrapped in a bright orange-red outer skin",
      ["pieza"], en="crab sticks")
    K("fish", "Hueva",
      "a single pair of hake roes joined at the base, two plump pale-coral lobes veined with fine red threads",
      ["pieza"], en="fish roe")
    K("fish", "Mojama",
      "a single block of mojama, a dense dark garnet loin of air-cured tuna with a dry oiled surface, two thin slices leaning against it",
      ["pieza", "lonchas"], en="cured tuna loin",
      ov={"lonchas": "a small fan of mojama slices, translucent dark garnet rectangles of cured tuna laid overlapping"})
    K("fish", "Ancas de rana",
      "a small pile of frogs' legs, slim pale pink jointed pairs laid neatly together",
      ["pieza"], en="frogs' legs")

    # ═══ SHELLFISH · the traded species the first pass missed ═════════════════════════════════
    K("shellfish", "Cañaílla",
      "a single sea snail with a knobbly spiral shell, sandy grey-brown and drawn out into a long straight siphon spine",
      ["entera", "cocida"], en="murex",
      ov={"cocida": "a single cooked murex, its knobbly spiral shell warmed to grey-brown, the pale operculum sealing the opening"})
    K("shellfish", "Chirla",
      "a single small wedge clam, a compact triangular shell in pale cream banded with fine brown growth rings",
      ["entera", "abierta"], en="wedge clam",
      ov={"abierta": "a single opened wedge clam on the half shell, pale flesh inside a small cream-and-brown banded shell"})
    K("shellfish", "Escupiña",
      "a single warty venus clam, a thick chalk-white shell ridged with heavy concentric rings like stacked plates",
      ["entera", "abierta"], en="warty venus clam",
      ov={"abierta": "a single opened warty venus clam on the half shell, plump flesh inside a heavily ridged chalk-white shell"})
    K("shellfish", "Gambón",
      "a single raw Argentine red shrimp, a large prawn with a deep red-orange shell, a long rostrum and fine legs tucked beneath",
      ["entera", "cocida", "pelada"], en="Argentine red shrimp", flesh="pale coral",
      ov={"cocida": "a single cooked Argentine red shrimp, its large shell turned a deep brick orange, tail curled under",
          "pelada": "a single peeled raw Argentine red shrimp tail, pale coral flesh curved and glistening"})
    K("shellfish", "Choquito",
      "a single small cuttlefish, a plump oval body in mottled brown and cream with a fringe of fine fin and short tentacles gathered in front",
      ["entera", "limpia"], en="baby cuttlefish",
      ov={"limpia": "a single cleaned baby cuttlefish, a small smooth white pouch with its trimmed tentacles laid beside it"})
    K("shellfish", "Pota",
      "a single flying squid, a long firm reddish-brown mantle with two broad triangular fins and thick tentacles",
      ["entera", "limpia", "anillas"], en="flying squid",
      ov={"limpia": "a single cleaned flying squid tube, a thick chalk-white cylinder with its two fins beside it",
          "anillas": "a small neat heap of thick squid rings, sturdy white bands cut evenly from a flying squid tube"})

    # ═══ MEAT · the cut heads that look like themselves on a butcher's bench ══════════════════
    # PROVACUNO's beef despiece and the pork wing are the register; a cut earns a painting when
    # the counter shows it as its own shape, never because the list has a row for it.
    K("meat", "Aleta de ternera",
      "a single beef thin rib joint, a long flat rectangle of dark red meat layered with fine white fat, rolled slightly at one end",
      ["entero", "filetes", "troceado"], en="beef thin rib")
    K("meat", "Babilla de ternera",
      "a single beef knuckle, a rounded teardrop of lean dark red meat with a thin white fat cap along one edge",
      ["entero", "filetes", "tacos"], en="beef knuckle")
    K("meat", "Brazuelo de ternera",
      "a single beef foreshank joint, a thick tapering cylinder of dark red meat wrapped around a pale round bone",
      ["entero", "troceado"], en="beef foreshank")
    K("meat", "Cadera de ternera",
      "a single beef rump, a broad rounded block of deep red meat with a smooth white fat cap over one face",
      ["entero", "filetes", "tacos"], en="beef rump")
    K("meat", "Contra de ternera",
      "a single beef silverside, a long even block of lean dark red meat sheathed on one side in a thin silvery membrane",
      ["entero", "filetes"], en="beef silverside")
    K("meat", "Espaldilla de ternera",
      "a single beef shoulder clod, a thick irregular block of dark red meat marbled with broad white seams",
      ["entero", "filetes", "tacos"], en="beef shoulder clod")
    K("meat", "Llana de ternera",
      "a single beef flat iron, a flat oblong of dark red meat split lengthways by one straight line of pale gristle",
      ["entero", "filetes"], en="beef flat iron")
    K("meat", "Pescuezo de ternera",
      "a single beef neck joint, a coarse-grained block of dark red meat crossed by heavy white seams of connective tissue",
      ["entero", "troceado", "picada"], en="beef neck")
    K("meat", "Pez de ternera",
      "a single beef chuck tender, a slim tapering cone of dark red meat with a fine pale sinew running down its middle",
      ["entero", "filetes"], en="beef chuck tender")
    K("meat", "Tapa de ternera",
      "a single beef topside, a large flat oval of lean deep red meat with a fine even grain and a thin fat edge",
      ["entero", "filetes", "tacos"], en="beef topside")
    K("meat", "Tapilla de ternera",
      "a single beef tri-tip, a neat triangular block of dark red meat with a thin white fat cap on the wide face",
      ["entero", "filetes"], en="beef tri-tip")
    K("meat", "Vacío de ternera",
      "a single beef bavette, a long loose flat sheet of coarse-grained dark red meat with a thin silvery membrane along one side",
      ["entero", "filetes"], en="beef bavette")
    K("meat", "Hamburguesa",
      "two raw beef burger patties, thick even discs of coarsely minced dark red meat, one resting against the other",
      ["pieza"], en="beef burger")
    K("meat", "Media canal de vacuno",
      "one single half carcass of beef standing upright on its own with clear space all round it, the long ribbed side of a butchered animal, deep red meat under a smooth cream fat cover",
      ["pieza"], en="beef half carcass")

    # ── pork ─────────────────────────────────────────────────────────────────────────────────
    K("meat", "Cabecera de lomo",
      "a single pork collar, a marbled cylinder of rose-pink meat threaded with generous white fat seams",
      ["entero", "filetes", "tacos"], en="pork collar")
    K("meat", "Careta de cerdo",
      "a single pig's face, a flat sheet of pale cream skin with the ear folded at one corner, cleaned and singed",
      ["pieza"], en="pig's face")
    K("meat", "Cochinillo",
      "a single whole oven-ready suckling pig, a small butchered animal with smooth pale cream skin, lying on its side with its trotters folded in",
      ["pieza"], en="suckling pig")
    K("meat", "Jamón fresco",
      "a single fresh pork leg, a large untrimmed haunch of pale rose meat under a thick cream fat cover, the trotter still on",
      ["pieza", "deshuesado"], en="fresh pork leg")
    K("meat", "Lagarto ibérico",
      "two long thin strips of Iberian lagarto, narrow ribbons of dark red pork threaded with fine white marbling, laid side by side",
      ["pieza"], en="Iberian lagarto")
    K("meat", "Magro de cerdo",
      "a small neat heap of lean pork chunks, even cubes of pale rose meat trimmed clean of fat",
      ["pieza"], en="lean pork")
    K("meat", "Oreja de cerdo",
      "a single pig's ear, a broad flat triangle of pale cream skin with a soft cartilage ridge and a fringed edge",
      ["pieza"], en="pig's ear")
    K("meat", "Paletilla de cerdo",
      "a single pork shoulder, a rounded joint of rose-pink meat under a smooth cream rind, the shank bone showing at one end",
      ["pieza", "deshuesado", "troceado"], en="pork shoulder")
    K("meat", "Rabo de cerdo",
      "a single pig's tail, a slim curled cone of pale cream skin tapering to a point",
      ["pieza"], en="pig's tail")
    K("meat", "Chuletero de cerdo",
      "a single rack of pork loin chops, a long strip of rose-pink loin on a row of pale curved rib bones",
      ["pieza", "troceado"], en="pork rack")
    K("meat", "Media canal de cerdo",
      "one single half carcass of pork standing upright on its own with clear space all round it, the long side of a butchered pig, pale rose meat under a smooth cream rind",
      ["pieza"], en="pork half carcass")

    # ── lamb, poultry, game ──────────────────────────────────────────────────────────────────
    K("meat", "Cordero entero",
      "one single whole lamb carcass standing on its own with clear space all round it, a small butchered animal in pale rose meat under a thin cream fat cover, the legs drawn together",
      ["pieza"], en="whole lamb")
    K("meat", "Falda de cordero",
      "a single lamb breast, a flat rectangle of rose-pink meat layered with thin white fat over fine rib bones",
      ["pieza", "troceado"], en="lamb breast")
    K("meat", "Jarrete de cordero",
      "a single lamb shank, a tapering cone of rose-pink meat around one pale bone, the knuckle exposed at the narrow end",
      ["pieza"], en="lamb shank")
    K("meat", "Churrasquitos de cordero",
      "a small pile of lamb riblets, short strips of rose-pink meat on fine curved bones, stacked together",
      ["pieza"], en="lamb riblets")
    K("meat", "Gallina",
      "a single whole oven-ready boiling hen, a plucked headless bird with deep yellow-cream skin, plumper and darker than a young chicken, breast upward",
      ["pieza", "troceado"], en="boiling hen")
    K("meat", "Pintada",
      "a single whole oven-ready guinea fowl, a plucked headless bird with slate-grey skin faintly speckled, its narrow breast upward and legs trussed",
      ["pieza"], en="guinea fowl")
    K("meat", "Carcasa de pollo",
      "a single chicken carcass, a stripped ribcage of pale bone with a little rose meat clinging to it",
      ["pieza"], en="chicken carcass")
    K("meat", "Cuarto trasero de pollo",
      "a single chicken leg quarter, the thigh and drumstick in one piece under smooth pale cream skin",
      ["pieza"], en="chicken leg quarter")
    K("meat", "Contramuslo de pavo",
      "a single boneless turkey thigh, a thick rolled slab of dark rose meat under a fold of pale skin",
      ["pieza", "filetes"], en="turkey thigh")
    K("meat", "Muslo de pato",
      "a single raw duck leg, a plump drumstick and thigh under thick creamy-yellow skin, the bone showing at the narrow end",
      ["pieza"], en="duck leg")
    K("meat", "Confit de pato",
      "a single confit duck leg, a burnished golden-brown leg glossy with rendered fat, the bone bared at the narrow end",
      ["pieza"], en="duck confit")
    K("meat", "Ciervo",
      "a single venison haunch steak, a thick round of very dark red-brown meat with a fine close grain and almost no fat",
      ["pieza", "filetes", "tacos"], en="venison haunch")
    K("meat", "Jabalí",
      "a single wild boar shoulder joint, a coarse dark red block of meat with a thin dark rind and bristly edge",
      ["pieza", "troceado"], en="wild boar")
    K("meat", "Avestruz",
      "two ostrich fillet steaks, thick rounds of very dark crimson meat with a fine close grain, standing side by side",
      ["pieza"], en="ostrich")
    K("meat", "Equino",
      "a single horse loin steak, a broad slab of dark blue-red meat with a fine even grain and a thin pale fat edge",
      ["pieza", "filetes"], en="horse loin")

    # ── offal ────────────────────────────────────────────────────────────────────────────────
    K("meat", "Hígado",
      "a single beef liver lobe, a smooth glossy wedge of deep red-brown organ with a fine sheen and a pale duct at the edge",
      ["pieza", "filetes"], en="beef liver")
    K("meat", "Riñón",
      "a single veal kidney, a cluster of glossy dark red-brown lobes bound together in a smooth membrane",
      ["pieza"], en="kidney")
    K("meat", "Corazón",
      "a single beef heart, a firm dark red cone of dense muscle with pale trimmed vessels at the wide end",
      ["pieza"], en="heart")
    K("meat", "Lengua",
      "a single beef tongue, a long thick tapering muscle with a rough pale grey surface and a rose-red trimmed base",
      ["pieza"], en="tongue")
    K("meat", "Mollejas",
      "a small heap of veal sweetbreads, three soft irregular ivory-pink lobes with a smooth glistening surface",
      ["pieza"], en="sweetbreads")
    K("meat", "Sesos",
      "a single set of lamb brains, two soft pale ivory lobes with a finely folded surface, resting together",
      ["pieza"], en="brains")
    K("meat", "Criadillas",
      "a single pair of bull's testicles, two smooth pale ivory ovals in a fine membrane, resting together",
      ["pieza"], en="bull's testicles")
    K("meat", "Callos",
      "a small heap of raw tripe, honeycombed pale cream sheets with a soft rubbery texture, loosely folded",
      ["pieza"], en="tripe")
    K("meat", "Sangre",
      "a single block of set pig's blood, a dense dark maroon-brown cube with a smooth matt cut face",
      ["pieza"], en="blood curd")
    K("meat", "Manteca de cerdo",
      "a single block of pork lard, a dense snow-white slab with a soft matt surface and a clean cut edge",
      ["pieza"], en="lard")

    # ── charcuterie: embutidos ───────────────────────────────────────────────────────────────
    K("meat", "Botillo",
      "a single botillo, a fat rounded dark red sausage stuffed into a wide gut and tied at the neck, its surface smoked and wrinkled",
      ["pieza"], en="botillo")
    K("meat", "Butifarra blanca",
      "a single coil of butifarra blanca, a pale ivory-pink sausage in a smooth natural casing, curled round on itself",
      ["pieza", "lonchas"], en="white butifarra")
    K("meat", "Butifarra negra",
      "a single coil of butifarra negra, a very dark glossy blood sausage in a natural casing, curled round on itself",
      ["pieza", "lonchas"], en="black butifarra")
    K("meat", "Longaniza",
      "a single long thin cured longaniza, a slender wrinkled deep-red sausage doubled back on itself and tied at both ends",
      ["pieza", "lonchas"], en="longaniza")
    K("meat", "Secallona",
      "a single secallona, a very thin dried sausage in a pale bloom-dusted casing, bent into a loose horseshoe",
      ["pieza"], en="secallona")
    K("meat", "Morcilla de Burgos",
      "a single morcilla de Burgos, a plump dark sausage tied at both ends, one cut end showing black blood pudding studded with white rice grains",
      ["pieza", "lonchas"], en="Burgos blood sausage")
    K("meat", "Morcilla asturiana",
      "a single smoked morcilla asturiana, a short stubby sausage with a wrinkled almost-black smoked skin and a tie at each end",
      ["pieza"], en="smoked blood sausage")
    K("meat", "Chorizo sarta",
      "a single sarta of chorizo, a long thin brick-red sausage tied into a closed ring, its casing dusted and wrinkled",
      ["pieza"], en="chorizo ring")
    K("meat", "Salchichón de Vic",
      "a single salchichón de Vic, a thick straight cured sausage in a pale chalk-white bloomed casing, tied with string along its length",
      ["pieza", "lonchas"], en="Vic salchichón")
    K("meat", "Morcón",
      "a single morcón, a fat rounded cured sausage in a coarse dark red casing tied in a net of string",
      ["pieza", "lonchas"], en="morcón")
    K("meat", "Salami",
      "a single salami, a straight thick cured sausage in a pale bloomed casing, one cut end showing deep red meat flecked with white fat",
      ["pieza", "lonchas"], en="salami")

    # ── charcuterie: curados y cocidos ───────────────────────────────────────────────────────
    K("meat", "Paleta ibérica",
      "a single cured Iberian shoulder ham, a narrow long-boned haunch with a dark rind and a black trotter, the hoof pointing down",
      ["pieza", "lonchas"], en="Iberian shoulder ham",
      ov={"lonchas": "a small fan of very thin Iberian shoulder ham slices, deep crimson veined with translucent fat"})
    K("meat", "Paleta serrana",
      "a single cured serrano shoulder ham, a compact haunch under a pale cream fat rind with the trotter still on",
      ["pieza", "lonchas"], en="serrano shoulder ham",
      ov={"lonchas": "a small fan of thin serrano shoulder ham slices, rose-red marbled with fine white fat"})
    K("meat", "Papada curada",
      "a single slab of cured pork jowl, a thick rectangle of creamy white fat streaked with thin rose-red lines and a peppered rim",
      ["pieza", "lonchas"], en="cured pork jowl")
    K("meat", "Jamón cocido",
      "a single block of cooked ham, a smooth pale rose loaf with a fine even surface and a soft rounded edge",
      ["pieza", "lonchas"], en="cooked ham",
      ov={"lonchas": "a small fan of cooked ham slices, soft pale rose squares laid overlapping"})
    K("meat", "Paleta cocida",
      "a single block of cooked shoulder ham, a pale rose loaf with a slightly coarser grain and a thin glazed skin",
      ["pieza", "lonchas"], en="cooked shoulder ham")
    K("meat", "Mortadela",
      "a single thick round of mortadela, a smooth pale pink cylinder studded with even cubes of white fat and dark peppercorns",
      ["pieza", "lonchas"], en="mortadella",
      ov={"lonchas": "a small fan of mortadella slices, wide pale pink rounds flecked with white fat cubes, laid overlapping"})
    K("meat", "Chopped",
      "a single block of chopped pork loaf, a pale rose square-sided loaf with a fine speckled grain and a smooth cut face",
      ["pieza", "lonchas"], en="chopped pork loaf")
    K("meat", "Fiambre de pavo",
      "a single block of turkey breast loaf, a very pale cream-white cylinder with a smooth matt surface and a lightly roasted edge",
      ["pieza", "lonchas"], en="turkey breast loaf")
    K("meat", "Galantina",
      "a single round of galantine, a pale loaf cut to show a mosaic of meat, pistachio and pepper set in a fine forcemeat",
      ["pieza", "lonchas"], en="galantine")
    K("meat", "Paté",
      "a single terrine of pâté, a smooth soft grey-pink block turned out whole, one corner cut away to show its close texture",
      ["pieza"], en="pâté")
    K("meat", "Salchicha cocida",
      "two cooked frankfurters lying side by side, slim smooth pale rose sausages with rounded ends",
      ["pieza"], en="frankfurter")

    # ═══ DAIRY · the cheeses Spanish custom names, plus the milk shelf ════════════════════════
    # RD 474/2014 art. 20.1 hands the sale name to «la denominación consagrada por el uso» and
    # says so non-exhaustively — which is exactly why the cheese wing is authored, not sourced.
    K("dairy", "Queso manchego",
      "a single wedge of manchego, a firm pale straw-yellow cheese with a dark rind pressed with the zig-zag basket weave",
      ["pieza"], en="manchego")
    K("dairy", "Queso idiazábal",
      "a single wedge of idiazábal, a dense ivory sheep's cheese with a smooth burnished amber smoked rind",
      ["pieza"], en="idiazábal")
    K("dairy", "Queso mahón",
      "a single wedge of mahón, a firm deep-yellow cheese with an orange-waxed rind and softly rounded square edges",
      ["pieza"], en="mahón")
    K("dairy", "Queso majorero",
      "a single wedge of majorero, a compact white goat's cheese with a paprika-rubbed rust-red rind",
      ["pieza"], en="majorero")
    K("dairy", "Queso tetilla",
      "a single tetilla cheese whole, a smooth pale cream cone shaped like a teardrop with a soft glossy rind",
      ["pieza"], en="tetilla")
    K("dairy", "Queso azul",
      "a single wedge of blue cheese, a crumbly ivory paste marbled through with deep blue-green veins",
      ["pieza"], en="blue cheese")
    K("dairy", "Queso de cabra",
      "a single log of goat's cheese, a smooth chalk-white cylinder with a fine bloomed rind, one round cut from the end",
      ["pieza"], en="goat's cheese")
    K("dairy", "Queso de oveja",
      "a single wedge of sheep's cheese, a dense ivory paste with small even eyes and a firm dark natural rind",
      ["pieza"], en="sheep's cheese")
    K("dairy", "Queso de vaca",
      "a single wedge of cow's milk cheese, a supple pale butter-yellow paste under a thin waxed rind",
      ["pieza"], en="cow's cheese")
    K("dairy", "Queso de mezcla",
      "a single wedge of mixed-milk cheese, a firm cream-coloured paste with a lightly patterned pale rind",
      ["pieza"], en="mixed-milk cheese")
    K("dairy", "Queso fresco",
      "a single block of fresh cheese, a soft snow-white cylinder with a smooth damp surface and a faint basket ring",
      ["pieza"], en="fresh cheese")
    K("dairy", "Queso de Burgos",
      "a single Burgos cheese whole, a soft white round with a faintly ridged wet surface, glistening with whey",
      ["pieza"], en="Burgos cheese")
    K("dairy", "Queso mozzarella",
      "a single ball of mozzarella, a smooth glossy white sphere with a soft folded top, wet on the surface",
      ["pieza"], en="mozzarella")
    K("dairy", "Burrata",
      "a single burrata, a soft white pouch of fresh cheese gathered and knotted at the top, one side split to show its creamy centre",
      ["pieza"], en="burrata")
    K("dairy", "Queso parmesano",
      "a single wedge of parmesan, a hard pale amber cheese with a granular broken face and a thick straw-coloured rind",
      ["pieza", "rallado"], en="parmesan",
      ov={"rallado": "a small loose mound of finely grated parmesan, pale golden crumbs heaped up"})
    K("dairy", "Queso emmental",
      "a single wedge of emmental, a firm pale yellow cheese pierced by large round holes",
      ["pieza"], en="emmental")
    K("dairy", "Queso gouda",
      "a single wedge of gouda, a smooth deep-yellow cheese with a thin red wax rind",
      ["pieza"], en="gouda")
    K("dairy", "Queso cheddar",
      "a single block of cheddar, a dense orange-gold cheese with a clean cut face and a slightly crumbly edge",
      ["pieza"], en="cheddar")
    K("dairy", "Queso crema",
      "a single block of cream cheese, a soft snow-white brick with a smooth matt surface and a softly rounded edge",
      ["pieza"], en="cream cheese")
    K("dairy", "Queso rallado",
      "a small loose mound of grated cheese, fine pale golden shreds heaped up",
      ["pieza"], en="grated cheese")
    K("dairy", "Queso en lonchas",
      "a small fan of square cheese slices, thin butter-yellow sheets laid overlapping",
      ["pieza"], en="sliced cheese")
    K("dairy", "Leche",
      "a single glass bottle of milk, a clear bottle filled with opaque white milk under a plain foil cap",
      ["pieza"], en="milk")
    K("dairy", "Nata",
      "a small jug of cream, a plain white jug holding thick ivory cream that catches the light at the lip",
      ["pieza"], en="cream")
    K("dairy", "Mantequilla",
      "a single block of butter, a smooth pale gold brick with a clean cut face, its paper wrapper folded back",
      ["pieza"], en="butter")
    K("dairy", "Margarina",
      "a single tub of margarine, a plain round white tub with the lid off and a smooth pale yellow surface inside",
      ["pieza"], en="margarine")
    K("dairy", "Yogur",
      "a single pot of yogurt, a plain white cup with the foil lid peeled back to show a smooth white surface",
      ["pieza"], en="yogurt")
    K("dairy", "Cuajada",
      "a single earthenware pot of cuajada, a small brown clay cup filled to the rim with a smooth set white curd",
      ["pieza"], en="cuajada")
    K("dairy", "Postre lácteo",
      "a single glass of milk pudding, a small clear glass filled with a smooth pale caramel-coloured custard",
      ["pieza"], en="milk dessert")
    K("dairy", "Huevo",
      "a single pair of hen's eggs resting together, two smooth ovals in warm speckled brown",
      ["pieza"], en="eggs")

    # ═══ PANTRY · the ambient shelf, painted as the honest whole product ══════════════════════
    # A bag of rice IS what a bag of rice looks like. These are the nodes a house carries and
    # nobody thinks to photograph, and their look is the sack, the tin, the bottle.
    K("pantry", "Arroz bomba",
      "a small open cloth sack of bomba rice, the top rolled down to show short round pearl-white grains heaped inside",
      ["pieza"], en="bomba rice")
    K("pantry", "Arroz redondo",
      "a small open cloth sack of short-grain rice, the top rolled down to show plump opaque white grains heaped inside",
      ["pieza"], en="short-grain rice")
    K("pantry", "Arroz largo",
      "a small open cloth sack of long-grain rice, the top rolled down to show slender translucent white grains heaped inside",
      ["pieza"], en="long-grain rice")
    K("pantry", "Arroz integral",
      "a small open cloth sack of brown rice, the top rolled down to show slim tan-coloured grains heaped inside",
      ["pieza"], en="brown rice")
    K("pantry", "Alubia blanca",
      "a small loose heap of dried white beans, smooth ivory kidney-shaped seeds each with a pale eye",
      ["pieza"], en="white beans")
    K("pantry", "Alubia pinta",
      "a small loose heap of dried pinto beans, plump seeds mottled in cream and russet brown",
      ["pieza"], en="pinto beans")
    K("pantry", "Alubia negra",
      "a small loose heap of dried black beans, glossy jet-black seeds each with a fine white eye",
      ["pieza"], en="black beans")
    K("pantry", "Garbanzo castellano",
      "a small loose heap of dried chickpeas, round wrinkled pale gold seeds each drawn to a small beak",
      ["pieza"], en="chickpeas")
    K("pantry", "Garbanzo lechoso",
      "a small loose heap of large pale chickpeas, smooth round cream-white seeds with a soft matt skin",
      ["pieza"], en="lechoso chickpeas")
    K("pantry", "Garbanzo pedrosillano",
      "a small loose heap of small round chickpeas, hard little tan spheres with a fine wrinkled skin",
      ["pieza"], en="pedrosillano chickpeas")
    K("pantry", "Lenteja pardina",
      "a small loose heap of pardina lentils, small flat discs in speckled grey-brown",
      ["pieza"], en="pardina lentils")
    K("pantry", "Lenteja castellana",
      "a small loose heap of castellana lentils, broad flat discs in a soft olive-brown",
      ["pieza"], en="castellana lentils")
    K("pantry", "Lenteja beluga",
      "a small loose heap of beluga lentils, tiny glossy jet-black discs",
      ["pieza"], en="beluga lentils")
    K("pantry", "Aceite de oliva virgen extra",
      "a single dark glass bottle of extra virgin olive oil, its long neck and plain body showing deep green-gold oil where the light passes through",
      ["pieza"], en="extra virgin olive oil")
    K("pantry", "Aceite de oliva virgen",
      "a single clear glass bottle of virgin olive oil, filled with bright yellow-green oil under a plain cap",
      ["pieza"], en="virgin olive oil")
    K("pantry", "Aceite de oliva suave",
      "a single clear plastic bottle of mild olive oil, filled with pale gold oil under a plain cap",
      ["pieza"], en="mild olive oil")
    K("pantry", "Aceite de orujo de oliva",
      "a single clear bottle of olive pomace oil, filled with light amber oil under a plain screw cap",
      ["pieza"], en="pomace oil")
    K("pantry", "Aceite de girasol",
      "a single clear plastic bottle of sunflower oil, filled with pale straw-yellow oil under a plain cap",
      ["pieza"], en="sunflower oil")
    K("pantry", "Aceite de semillas",
      "a single clear bottle of seed oil, filled with very pale gold oil under a plain screw cap",
      ["pieza"], en="seed oil")
    K("pantry", "Vinagre",
      "a single clear glass bottle of wine vinegar, filled with deep amber-red liquid under a plain cap",
      ["pieza"], en="vinegar")
    K("pantry", "Aceituna manzanilla",
      "a small bowl of green manzanilla olives, plump bright olive-green fruits glistening in a shallow white dish",
      ["pieza"], en="manzanilla olives")
    K("pantry", "Aceituna gordal",
      "a small bowl of gordal olives, very large pale green fruits with a smooth taut skin, heaped in a shallow white dish",
      ["pieza"], en="gordal olives")
    K("pantry", "Aceituna negra",
      "a small bowl of black olives, glossy wrinkled dark purple-black fruits heaped in a shallow white dish",
      ["pieza"], en="black olives")
    K("pantry", "Aceituna arbequina",
      "a small bowl of arbequina olives, tiny round brown-green fruits with slim stalks, heaped in a shallow white dish",
      ["pieza"], en="arbequina olives")
    K("pantry", "Aceituna rellena",
      "a small bowl of stuffed olives, bright green fruits each showing a scarlet pepper plug at one end",
      ["pieza"], en="stuffed olives")
    K("pantry", "Conserva de pescado",
      "a single open tin of fish conserve, a shallow round can with the lid rolled back to show fillets packed in oil",
      ["pieza"], en="tinned fish")
    K("pantry", "Conserva vegetal",
      "a single open glass jar of preserved vegetables, a squat jar showing pale piquillo peppers packed against the glass",
      ["pieza"], en="preserved vegetables")
    K("pantry", "Conserva cárnica",
      "a single open tin of meat conserve, a small round can with the lid rolled back to show a pale set loaf inside",
      ["pieza"], en="tinned meat")
    K("pantry", "Encurtido",
      "a single glass jar of pickles, a tall jar packed with gherkins and small onions in a clear brine",
      ["pieza"], en="pickles")
    K("pantry", "Sal",
      "a small loose mound of coarse sea salt, irregular translucent white crystals heaped up",
      ["pieza"], en="sea salt")
    K("pantry", "Azúcar",
      "a small loose mound of white sugar, fine glittering crystals heaped into a soft cone",
      ["pieza"], en="sugar")
    K("pantry", "Harina",
      "a small open paper bag of flour, the top folded down to show a soft mound of fine white powder",
      ["pieza"], en="flour")
    K("pantry", "Sémola",
      "a small loose mound of semolina, fine pale gold grains heaped into a soft cone",
      ["pieza"], en="semolina")
    K("pantry", "Pan rallado",
      "a small loose mound of breadcrumbs, fine sandy-gold crumbs heaped up",
      ["pieza"], en="breadcrumbs")
    K("pantry", "Pasta",
      "a small standing bundle of dried spaghetti, pale gold strands gathered upright and tied with a paper band",
      ["pieza"], en="dried pasta")
    K("pantry", "Pan",
      "a single rustic loaf of bread, a round country loaf with a burnished golden crust slashed across the top",
      ["pieza"], en="bread")
    K("pantry", "Picos",
      "a small heap of picos, tiny pale golden bread sticks piled loosely together",
      ["pieza"], en="bread picos")
    K("pantry", "Biscote",
      "a small stack of rusks, four square pale golden toasts stacked with their edges offset",
      ["pieza"], en="rusks")
    K("pantry", "Galleta",
      "a small stack of biscuits, four round golden-brown biscuits stacked with one leaning against the pile",
      ["pieza"], en="biscuits")
    K("pantry", "Bollería",
      "a single croissant, a plump crescent of layered pastry with a burnished flaky golden crust",
      ["pieza"], en="pastry")
    K("pantry", "Miel",
      "a single glass jar of honey, a squat clear jar filled with glowing amber honey under a plain lid",
      ["pieza"], en="honey")
    K("pantry", "Mermelada",
      "a single glass jar of jam, a squat clear jar filled with deep red preserve under a cloth-topped lid",
      ["pieza"], en="jam")
    K("pantry", "Chocolate",
      "a single bar of dark chocolate, a deep brown slab scored into squares with two squares broken off beside it",
      ["pieza"], en="chocolate")
    K("pantry", "Especia",
      "a small loose mound of ground paprika, a deep brick-red powder heaped into a soft cone",
      ["pieza"], en="ground spice")
    K("pantry", "Caldo",
      "a single carton of stock, a plain rectangular carton standing upright with a small screw cap at one corner",
      ["pieza"], en="stock")
    K("pantry", "Salsa",
      "a single glass bottle of tomato sauce, a slim clear bottle filled with thick deep-red sauce under a plain cap",
      ["pieza"], en="sauce")
    K("pantry", "Sopa preparada",
      "a single carton of soup, a plain rectangular carton standing upright beside a filled white bowl",
      ["pieza"], en="prepared soup")
    K("pantry", "Almendra",
      "a small loose heap of almonds, smooth pointed tan kernels with a finely pitted skin",
      ["pieza"], en="almonds")
    K("pantry", "Nuez",
      "a small heap of walnuts, three round wrinkled brown shells with one cracked open to show the folded kernel",
      ["pieza"], en="walnuts")
    K("pantry", "Avellana",
      "a small loose heap of hazelnuts, round glossy chestnut-brown nuts each with a pale circular base",
      ["pieza"], en="hazelnuts")
    K("pantry", "Pistacho",
      "a small loose heap of pistachios, pale cream shells split open to show green kernels inside",
      ["pieza"], en="pistachios")
    K("pantry", "Cacahuete",
      "a small loose heap of peanuts in their shells, wrinkled pale tan pods pinched at the middle",
      ["pieza"], en="peanuts")
    K("pantry", "Croqueta",
      "a small pile of croquettes, four golden-brown breaded ovals stacked loosely together",
      ["pieza"], en="croquettes")
    K("pantry", "Pizza",
      "a single whole pizza, a round base spread with tomato and melted cheese, cut into even slices",
      ["pieza"], en="pizza")
    K("pantry", "Plato preparado",
      "a single foil tray of prepared food, a rectangular tray with the film peeled back to show a portion of stew inside",
      ["pieza"], en="ready meal")
    K("pantry", "Hielo",
      "a small heap of ice cubes, clear frosted blocks stacked loosely with the light catching their edges",
      ["pieza"], en="ice")
    K("pantry", "Tripa natural",
      "a single coiled hank of natural sausage casing, a pale translucent cream skein resting in a loose loop",
      ["pieza"], en="natural casing")

    # ═══ PRODUCE · the kinds the Mercas quote that the first pass missed ══════════════════════
    K("fruit", "Breva",
      "a single early fig, a large teardrop fruit in deep purple-brown with a dusty bloom and a short thick stalk",
      ["entero"], en="early fig")
    K("fruit", "Castaña",
      "a single chestnut, a glossy mahogany-brown dome flattened on one face with a pale rough patch at the base",
      ["entero"], en="chestnut")
    K("fruit", "Carambola",
      "a single starfruit, a waxy yellow-gold fruit with five deep ribs running its length",
      ["entero"], en="starfruit")
    K("fruit", "Grosella",
      "a single small cluster of redcurrants, a hanging string of tiny translucent scarlet berries",
      ["entero"], en="redcurrants")
    K("fruit", "Higo chumbo",
      "a single prickly pear, an oval fruit in orange-rose skin studded with tiny tufted spine clusters",
      ["entero"], en="prickly pear")
    K("fruit", "Litchi",
      "a single lychee, a round fruit in a rough rose-red rind, one half peeled back to show translucent white flesh",
      ["entero"], en="lychee")
    K("fruit", "Nashi",
      "a single nashi pear, a round golden-bronze fruit with a finely russeted skin and a short stalk",
      ["entero"], en="nashi pear")
    K("fruit", "Pitahaya",
      "a single dragon fruit, an oval fruit in bright magenta skin with green-tipped leafy scales curling outward",
      ["entero"], en="dragon fruit")
    K("fruit", "Rambután",
      "a single rambutan, a small round fruit in a crimson rind covered in soft green-tipped hairs",
      ["entero"], en="rambutan")
    K("fruit", "Tamarindo",
      "a small heap of tamarind pods, curved brittle brown shells with one broken to show the dark sticky pulp",
      ["entero"], en="tamarind")
    K("fruit", "Guayaba",
      "a single guava, a round pale green-yellow fruit with a small dry crown at the top",
      ["entero"], en="guava")
    K("fruit", "Kumquat",
      "a small heap of kumquats, tiny oval orange citrus fruits with two glossy dark leaves",
      ["entero"], en="kumquat")
    K("fruit", "Physalis",
      "a single physalis, a small golden berry inside its papery beige husk peeled back like petals",
      ["entero"], en="physalis")
    K("fruit", "Mangostán",
      "a single mangosteen, a round fruit in a thick deep purple rind with a green woody calyx on top",
      ["entero"], en="mangosteen")
    K("fruit", "Guanábana",
      "a single soursop, a large heart-shaped green fruit covered in soft curved spines",
      ["entero"], en="soursop")
    K("fruit", "Zapote",
      "a single sapote, a round russet-brown fruit with a matt skin and a small woody stalk",
      ["entero"], en="sapote")
    K("fruit", "Curuba", "a single banana passionfruit, a slim oblong fruit in soft golden-yellow skin",
      ["entero"], en="banana passionfruit")
    K("fruit", "Bananito", "a small hand of baby bananas, four short plump bright yellow fingers joined at the crown",
      ["entero"], en="baby banana")
    K("fruit", "Kiwano", "a single horned melon, an oval fruit in bright orange skin studded with short blunt spines",
      ["entero"], en="horned melon")
    K("fruit", "Sharon", "a single sharon fruit, a squat glossy orange persimmon with a flat dry green calyx on top",
      ["entero"], en="sharon fruit")

    K("vegetable", "Borraja",
      "a single bunch of borage stems, thick pale green ribbed stalks gathered upright with their bristly leaves trimmed back",
      ["manojo"], en="borage")
    K("vegetable", "Grelo",
      "a single bunch of turnip tops, loose dark green leaves and slim flowering stems gathered and tied",
      ["manojo"], en="turnip tops")
    K("vegetable", "Guindilla",
      "a small handful of guindilla peppers, slim curved chillies in bright green and scarlet with fine stalks",
      ["entero"], en="guindilla chilli")
    K("vegetable", "Pak choi",
      "a single head of pak choi, thick glossy white stems fanning up into broad dark green leaves",
      ["entero"], en="pak choi")
    K("vegetable", "Tirabeque",
      "a small handful of mangetout pods, flat bright green pods with fine curled tendrils",
      ["entero"], en="mangetout")
    K("vegetable", "Yuca",
      "a single cassava root, a long tapering root in rough dark brown bark, one end cut to show the chalk-white flesh",
      ["entero"], en="cassava")
    K("vegetable", "Ñame",
      "a single yam, a heavy irregular root with a rough grey-brown skin and a pale cut face",
      ["entero"], en="yam")
    K("vegetable", "Okra",
      "a small handful of okra pods, slim ridged green pods tapering to a point",
      ["entero"], en="okra")
    K("vegetable", "Garrofón",
      "a small loose heap of garrofón beans, broad flat ivory-white seeds with a fine dark eye",
      ["entero"], en="garrofón beans")
    K("vegetable", "Chalota",
      "a small group of shallots, three slim copper-skinned bulbs with papery tips, resting together",
      ["entero"], en="shallots")
    K("vegetable", "Calçot",
      "a single bundle of calçots, long white spring onions with pale green tops, gathered upright and tied",
      ["manojo"], en="calçots")
    K("vegetable", "Colinabo",
      "a single kohlrabi, a pale green swollen stem-bulb with cut leaf stalks standing out around its crown",
      ["entero"], en="kohlrabi")
    K("vegetable", "Achicoria roja",
      "a single head of radicchio, a compact round head of deep wine-red leaves veined in white",
      ["entero"], en="radicchio")
    K("vegetable", "Tupinambo",
      "a small heap of Jerusalem artichokes, knobbly pale tan tubers with irregular lobes",
      ["entero"], en="Jerusalem artichoke")
    K("vegetable", "Germinado",
      "a small loose mound of bean sprouts, fine ivory shoots with pale yellow tips tangled together",
      ["entero"], en="bean sprouts")
    K("vegetable", "Alga wakame",
      "a small heap of wakame seaweed, dark green-brown ribboned fronds with a glossy wet sheen",
      ["entero"], en="wakame")


def add_reference_sorts(KINDS):
    """L2 — the varieties that change the PICTURE, never the name-space.

    The reference holds 586 apple cultivars, 165 pears, 43 potatoes and 19 table grapes; every
    one is a real word a house may type and every one resolves onto its kind. What a market
    stall SHOWS is eight of each, and eight is what earns paint (§C: «tomate varieties yes,
    merluza de pincho no — provenance is a word, not a look»).
    """
    by_l1 = {k["l1"]: k for k in KINDS}

    def S(l1, es, whole, preps=None, ov=None):
        k = by_l1[l1]
        s = {"es": es, "whole": whole}
        if preps:
            s["preps"] = preps
        if ov:
            s["ov"] = ov
        if all(x["es"] != es for x in k["sorts"]):
            k["sorts"].append(s)

    S("tomate", "Tomate raf", "a single raf tomato, a squat deeply ribbed fruit in dark green shading to dull red at the shoulders")
    S("tomate", "Tomate kumato", "a single kumato tomato, a round smooth fruit in deep brown-green with a reddish blush")
    S("tomate", "Tomate cherry", "a small cluster of cherry tomatoes on the vine, tiny round scarlet fruits on a green stem")
    S("tomate", "Tomate rama", "a small truss of vine tomatoes, four smooth round red fruits joined along a green stem")
    S("tomate", "Tomate rosa", "a single pink tomato, a very large softly ribbed fruit in a pale rose-pink with a green shoulder")
    S("tomate", "Tomate corazón de buey", "a single oxheart tomato, a big irregular heart-shaped fruit in deep red with heavy shoulder ribs")
    S("manzana", "Manzana pink lady", "a single pink lady apple, a round fruit blushed deep pink over a yellow ground")
    S("manzana", "Manzana starking", "a single starking apple, a tall conical fruit in a deep glossy crimson with faint pale flecks")
    S("manzana", "Manzana verde doncella", "a single verde doncella apple, a squat irregular fruit in a soft yellow-green with a russet stalk well")
    S("pera", "Pera limonera", "a single limonera pear, a smooth broad-based fruit in a clear pale yellow with a slim stalk")
    S("pera", "Pera williams", "a single williams pear, a classic bell-shaped fruit in bright yellow-green with a short curved stalk")
    S("uva", "Uva moscatel", "a single bunch of muscat grapes, a loose cluster of large amber-gold berries with a dusty bloom", ["racimo"])
    S("uva", "Uva red globe", "a single bunch of red globe grapes, a heavy cluster of very large round rose-red berries", ["racimo"])
    S("uva", "Uva aledo", "a single bunch of aledo grapes, a long cluster of firm pale green oval berries", ["racimo"])
    S("uva", "Uva cardinal", "a single bunch of cardinal grapes, a compact cluster of deep purple-red berries with a heavy bloom", ["racimo"])
    S("naranja", "Naranja navelina", "a single navelina orange, a round deep-orange fruit with a small navel dimple at the base",
      preps=["entero", "cortado"],
      ov={"cortado": "a single navelina orange cut in half, the cut face showing bright orange segments under a thin white pith rim"})
    S("naranja", "Naranja sanguina", "a single blood orange, a round fruit in orange skin flushed with deep red at one cheek",
      preps=["entero", "cortado"],
      ov={"cortado": "a single blood orange cut in half, the cut face showing deep ruby-red flesh streaked through the segments"})
    S("naranja", "Naranja valencia late", "a single valencia orange, a smooth oval fruit in an even bright orange with a thin skin",
      preps=["entero", "cortado"],
      ov={"cortado": "a single valencia orange cut in half, the cut face wet and dense with juice, pale orange segments in a very thin rind"})
    S("patata", "Patata agria", "a single agria potato, a long oval tuber with a pale yellow skin and shallow eyes")
    S("patata", "Patata monalisa", "a single monalisa potato, a smooth round tuber with a light golden skin and very shallow eyes")
    S("patata", "Patata kennebec", "a single kennebec potato, a large blocky tuber with a matt cream skin and a few deep eyes")
    S("patata", "Patata roja", "a single red potato, a round tuber with a smooth rose-red skin and pale eyes")
    S("lechuga", "Lechuga iceberg", "a single iceberg lettuce, a tight round head of crisp pale green leaves wrapped over one another")
    S("lechuga", "Lechuga romana", "a single romaine lettuce, an upright elongated head of stiff dark green leaves with heavy white ribs")
    S("lechuga", "Lechuga batavia", "a single batavia lettuce, an open head of crinkled green leaves with wavy bronze-tipped edges")
    S("lechuga", "Lechuga hoja de roble", "a single oak leaf lettuce, a loose rosette of soft lobed leaves in green shading to deep red")
    S("lechuga", "Lechuga lollo rosso", "a single lollo rosso lettuce, a dense rosette of tightly frilled leaves in deep burgundy over a pale heart")
    S("lechuga", "Lechuga trocadero", "a single butterhead lettuce, a soft loose round head of tender pale green leaves")
    # «hearts» painted two glassy HEART SHAPES with a leaf either side. The word is a butcher's
    # noun in English and a shape everywhere else, so the clause names the LETTUCE and lets the
    # tightness do the work.
    S("lechuga", "Cogollo", "two little gem lettuces, small tight elongated heads of crisp pale green leaves lying side by side")
    S("pimiento", "Pimiento rojo", "a single red pepper, a large blocky glossy scarlet fruit with a green stalk and four soft lobes")
    S("pimiento", "Pimiento verde italiano", "a single italian pepper, a long slim curved fruit in a bright mid-green with a thin stalk")
    S("pimiento", "Pimiento amarillo", "a single yellow pepper, a large blocky glossy golden fruit with a green stalk")
    S("pimiento", "Pimiento de padrón", "a small handful of padrón peppers, small crumpled green fruits with slim stalks")
    S("pimiento", "Pimiento del piquillo", "a small heap of piquillo peppers, small deep-red pointed fruits with a smooth roasted skin")
    S("pimiento", "Pimiento lamuyo", "a single lamuyo pepper, a long broad-shouldered scarlet fruit with a thick flesh and a green stalk")
    S("cebolla", "Cebolla morada", "a single red onion, a round bulb in glossy deep purple papery skin with a dry neck")
    S("cebolla", "Cebolla blanca dulce", "a single sweet white onion, a large round bulb in a papery pearl-white skin")
    S("cebolla", "Cebolla tierna", "a small bundle of spring onions, slim white bulbs running up into fresh green tops, tied together", ["manojo"])
    S("ciruela", "Ciruela claudia", "a single greengage plum, a round fruit in a soft yellow-green with a faint pale bloom")
    S("ciruela", "Ciruela roja", "a single red plum, a round glossy scarlet fruit with a shallow seam down one side")
    S("ciruela", "Ciruela amarilla", "a single yellow plum, a small round fruit in a clear golden yellow with a dusty bloom")
    S("cereza", "Picota", "a pair of picota cherries without stalks, two deep dark-red fruits with a firm taut skin")
    S("cereza", "Guinda", "a pair of sour cherries on one stalk, two small bright translucent scarlet fruits")
    S("mandarina", "Clementina", "a single clementine, a small squat glossy orange fruit with two dark green leaves at the stalk")
    S("mandarina", "Satsuma", "a single satsuma, a flattened loose-skinned orange fruit with a slightly puckered rind")


def add_category_faces(K):
    """THE BIG CATEGORY FACE IS THE CREATURE ITSELF (PAINTINGS-TRACKER §35.8).

    A category node is drawn by `paintingFor(nodeName)` on the «What they handle» picker, so its
    key is its own name — file a painting under the slug and the surface takes it with no code
    change. Every fish category falls back to a line mark today; these are what replaces it.

    Two asks in §35.8 have no node to land on and are recorded rather than painted: THE BIVALVE
    and THE ROOT are looks, not rungs — the ladder has no bivalve or root category, so a painting
    for either would be homeless. El pavo and el conejo already own product paintings at their
    own type nodes; a second creature image would collide on the same key.
    """
    # ── the family faces ─────────────────────────────────────────────────────────────────────
    K("category", "Pescado y marisco",
      "a shoal of silver fish turning together over open blue-green water, their flanks catching the light",
      ["pieza"], en="fish and shellfish")
    K("category", "Carne",
      "a single cow standing in profile in a pasture, a heavy red-brown animal with a white face, seen whole",
      ["pieza"], en="meat")
    K("category", "Fruta y verdura",
      "a low basket of mixed fruit and vegetables, tomatoes, apples and green leaves heaped over the rim",
      ["pieza"], en="fruit and vegetables")
    K("category", "Lácteos",
      "a tall glass jug of milk beside a wedge of pale cheese and a small block of butter",
      ["pieza"], en="dairy")
    K("category", "Despensa",
      "a small group of pantry goods, a glass jar, a tin and an open cloth sack of grain standing together",
      ["pieza"], en="pantry")
    K("category", "Legumbre y arroz",
      "three small open sacks side by side, one of white rice, one of golden chickpeas and one of brown lentils",
      ["pieza"], en="pulses and rice")
    K("category", "Aceites y grasas",
      "a single dark glass bottle of olive oil beside a shallow dish of green-gold oil",
      ["pieza"], en="oils and fats")
    K("category", "Conservas y encurtidos",
      "a glass jar of pickled vegetables standing beside an open round tin of fish in oil",
      ["pieza"], en="preserves and pickles")
    K("category", "Panadería y bollería",
      "a round country loaf with a burnished crust beside a plump golden croissant",
      ["pieza"], en="bakery")
    K("category", "Pasta y harinas",
      "an open paper bag of white flour beside an upright bundle of dried spaghetti tied with a band",
      ["pieza"], en="pasta and flour")
    K("category", "Bebidas",
      "a single glass bottle of water standing beside a filled tumbler, the light passing through both",
      ["pieza"], en="drinks")
    K("category", "Ambiente y secos",
      "a folded stack of blue food-service gloves beside a roll of clear film and a small paper tray",
      ["pieza"], en="ambient supplies")

    # ── the fish categories the supplier-forwarding picker asks for by name ───────────────────
    K("category", "Pescado blanco",
      "a single whole white fish lying on a wet stone bench, silver-grey with a steel-blue back and a clear eye",
      ["pieza"], en="white fish")
    K("category", "Pescado azul",
      "a tight group of sardines lying together on ice, deep blue-green backs and bright silver flanks",
      ["pieza"], en="oily fish")
    K("category", "Pescado de crianza",
      "a single sea bass on a bench with the still water of a coastal fish farm behind it, low sun on the surface",
      ["pieza"], en="farmed fish")
    K("category", "Marisco",
      "one single large red prawn lying on the bench and seen head-on, its long fine antennae sweeping forward toward the viewer over many slender legs",
      ["pieza"], en="shellfish")
    K("category", "Cefalópodos",
      "a single octopus with its eight arms curled inward, mottled purple-brown skin and a watchful eye",
      ["pieza"], en="cephalopods")
    K("category", "Algas",
      "a loose spray of fresh seaweed fronds, dark green-brown ribbons still glossy with seawater",
      ["pieza"], en="seaweed")

    # ── the meat categories ──────────────────────────────────────────────────────────────────
    K("category", "Vacuno",
      "a single cow standing in profile in a green pasture, a heavy red-brown animal seen whole and calm",
      ["pieza"], en="beef")
    K("category", "Cerdo",
      "a single pig standing in profile on straw, a broad pale pink animal with dark hooves and a curled tail",
      ["pieza"], en="pork")
    K("category", "Aves",
      "a single hen standing in profile on bare ground, russet-brown feathers and a bright red comb",
      ["pieza"], en="poultry")
    K("category", "Cordero y cabrito",
      "a single lamb standing in profile in a field, a small cream-fleeced animal with dark legs and face",
      ["pieza"], en="lamb and kid")
    K("category", "Caza y otras carnes",
      "a single red deer standing alert in profile at the edge of a wood, antlers raised",
      ["pieza"], en="game")
    K("category", "Curados",
      "a whole cured ham lying on its side on the bench, dark rind over deep red meat, the black trotter at one end and a knife resting beside it",
      ["pieza"], en="cured meats")
    K("category", "Embutido",
      "a coiled ring of brick-red chorizo lying on the bench beside a pale coil of white butifarra",
      ["pieza"], en="sausages")
    K("category", "Cocidos y fiambres",
      "a block of cooked ham beside a thick round of mortadella, both cut to show their pale surfaces",
      ["pieza"], en="cooked meats")
    K("category", "Tripas y grasas",
      "a single beef liver lobe beside a block of white lard on a butcher's bench",
      ["pieza"], en="offal and fats")

    # ── the produce categories ───────────────────────────────────────────────────────────────
    K("category", "Verdura",
      "a broad head of leafy greens with the outer leaves opening wide, deep green and veined in white",
      ["pieza"], en="vegetables")
    K("category", "Fruta",
      "a branch of a stone-fruit tree carrying three ripe peaches among its leaves",
      ["pieza"], en="fruit")
    K("category", "Cítricos",
      "a branch of an orange tree carrying two ripe oranges among dark glossy leaves",
      ["pieza"], en="citrus")
    K("category", "Hierbas",
      "a bundle of mixed fresh herbs gathered and tied with string, parsley, thyme and bay together",
      ["pieza"], en="herbs")
    K("category", "Setas",
      "a cluster of wild mushrooms growing from the same base, chestnut caps over pale thick stems",
      ["pieza"], en="mushrooms")

    # ── THE FOUR RUNGS THE LADDER GREW so these faces would have somewhere to hang ───────────
    # PAINTINGS-TRACKER recorded four §35.8 asks as homeless: the bivalve and the root had no
    # category, and el pavo and el conejo shared one word and one node with the oven-ready animal
    # so a creature and a product could not both exist. Peter's call was GROW THE RUNGS, and the
    # reference now carries n-bivalve · n-root · n-turkey · n-rabbit. These are their faces.
    K("category", "Marisco de concha",
      "a cluster of shellfish on a wet stone bench, an open mussel, a ridged clam and a scallop in its fluted shell resting together",
      ["pieza"], en="shell shellfish")
    K("category", "Raíces y tubérculos",
      "a group of root vegetables lying on the bench with the soil still on them, a carrot, a turnip and two potatoes, their tops trimmed short",
      ["pieza"], en="roots and tubers")
    K("category", "Pavo",
      "a single live turkey standing in profile on bare ground, a broad bronze-black bird with a fanned tail and a red wattle at the throat",
      ["pieza"], en="turkey")
    K("category", "Conejo",
      "a single live rabbit sitting in profile on straw, a compact grey-brown animal with long ears raised",
      ["pieza"], en="rabbit")

    # ── the commissioned COMBINATION (§35.8: one image per supplier's category set) ───────────
    K("category", "Marisco y cefalópodos",
      "a red prawn and a small octopus resting together on the same wet stone bench, the prawn's antennae crossing an arm of the octopus",
      ["pieza"], en="shellfish and cephalopods", l1="combo-marisco-cefalopodos")


def add_shelf_heads(K):
    """The last rungs the gate found bare: the drinks shelf, the four category faces Lácteos
    hangs, and the generic heads whose SORTS were painted before the kind itself was.

    A house carries these and nobody photographs them, which is exactly why the reference has
    them and the first hand-list did not.
    """
    # ── drinks: a distributor's own shelf, painted as the honest whole product ────────────────
    K("pantry", "Agua",
      "a single clear plastic bottle of still water, filled to the neck under a plain blue cap",
      ["pieza"], en="water")
    K("pantry", "Refresco",
      "a single chilled glass bottle of cola, dark liquid behind clear glass with a crown cap and beaded condensation",
      ["pieza"], en="soft drink")
    K("pantry", "Zumo",
      "a single carton of orange juice standing upright beside a filled tumbler of pulpy orange juice",
      ["pieza"], en="juice")
    K("pantry", "Cerveza",
      "a single brown glass beer bottle beside a tall glass of pale amber beer with a white head",
      ["pieza"], en="beer")
    K("pantry", "Vino",
      "a single dark green wine bottle with a plain foil capsule, standing beside a glass holding a little deep red wine",
      ["pieza"], en="wine")
    K("pantry", "Licor",
      "a single clear glass spirit bottle with a long neck and a short cork stopper, holding pale amber liquor",
      ["pieza"], en="spirits")
    K("pantry", "Café",
      "a small loose heap of roasted coffee beans beside a filled white espresso cup",
      ["pieza"], en="coffee")
    K("pantry", "Infusión",
      "a single glass cup of herbal infusion, pale amber liquid with a few dried leaves settled at the bottom",
      ["pieza"], en="herbal tea")

    # ── the generic heads whose varieties were painted first ─────────────────────────────────
    K("pantry", "Arroz",
      "a small open cloth sack of rice, the top rolled down to show white grains heaped inside and a few spilled on the bench",
      ["pieza"], en="rice")
    K("pantry", "Alubia",
      "a small loose heap of dried beans, smooth kidney-shaped seeds in mixed cream and russet",
      ["pieza"], en="dried beans")
    K("pantry", "Garbanzo",
      "a small open cloth sack of dried chickpeas, the top rolled down to show round pale gold seeds heaped inside and a few spilled on the bench",
      ["pieza"], en="chickpeas")
    K("pantry", "Lenteja",
      "a small loose heap of dried lentils, small flat discs in a soft olive-brown",
      ["pieza"], en="lentils")
    K("pantry", "Aceite de oliva",
      "a single dark glass bottle of olive oil beside a shallow white dish holding a pool of green-gold oil",
      ["pieza"], en="olive oil")
    K("pantry", "Aceituna",
      "a small bowl of mixed olives, green and black fruits glistening together in a shallow white dish",
      ["pieza"], en="olives")
    K("pantry", "Precocinados cárnico",
      "a small tray of breaded meat escalopes, two pale golden crumbed cutlets lying side by side",
      ["pieza"], en="breaded meat")
    K("pantry", "Precocinados de pescado",
      "a small tray of breaded fish fingers, four even golden crumbed batons lying in a row",
      ["pieza"], en="breaded fish")
    K("vegetable", "Ensalada preparada",
      "a single open bag of prepared salad, clear film peeled back to show mixed green and red leaves spilling out",
      ["entero"], en="prepared salad")
    K("vegetable", "Sofrito",
      "a small bowl of fresh sofrito, chopped tomato, onion and green pepper mixed together in a shallow white dish",
      ["entero"], en="sofrito")
    K("vegetable", "Crema de verduras",
      "a single white bowl of vegetable soup, a smooth pale orange purée with a slight sheen on the surface",
      ["entero"], en="vegetable soup")

    # ── the category faces Lácteos and the pantry families hang ──────────────────────────────
    K("category", "Queso",
      "a whole wheel of hard cheese resting on the bench with one wedge cut out and leaning against it, a dark natural rind around a dense pale-gold paste",
      ["pieza"], en="cheese")
    K("category", "Leche y nata",
      "a tall glass jug of milk beside a small jug of thick cream, both catching the light at the lip",
      ["pieza"], en="milk and cream")
    K("category", "Mantequillas y grasas lácteas",
      "a block of pale gold butter with its paper folded back, beside a small open tub of soft spread",
      ["pieza"], en="butter and dairy fats")
    K("category", "Yogures y postres",
      "a plain white yogurt pot with its foil peeled back, beside a small glass of set caramel custard",
      ["pieza"], en="yogurts and desserts")

    # ── three generic heads whose SORTS were orphaned: the reference splits them, a bench does not
    K("shellfish", "Almeja",
      "a single clam, a rounded ridged shell in mottled cream and grey-brown, closed tight",
      ["entera", "abierta"], en="clam",
      ov={"abierta": "a single opened clam on the half shell, pale grey flesh inside a ridged cream shell"})
    K("herb-fungus", "Seta",
      "a small cluster of wild mushrooms, chestnut-brown caps over thick pale stems, grouped together",
      ["entera"], en="wild mushroom",
      ov={"entera": "a small cluster of wild mushrooms, chestnut-brown caps over thick pale stems, grouped together"})
    K("pantry", "Fruto seco",
      "a small mixed heap of nuts, almonds, hazelnuts and walnut halves tumbled together",
      ["pieza"], en="mixed nuts")
