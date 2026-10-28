#!/usr/bin/env python3
"""THE PAINTED CATALOGUE — the coverage matrix.

Emits subjects.json: the full L0→L3 painting matrix per THE-DENSE-BRIEF §C.

  L0 FAMILY   fish · shellfish · meat · fruit · vegetable · herb-fungus
  L1 KIND     the species / crop / cut-region a fishmonger would name
  L2 SORT     variety, ONLY where the look truly differs (tomate de pera yes,
              merluza de pincho no — provenance is a word, not a look)
  L3 FORM     how it is sold or prepped: entero · eviscerado · filetes · lomos ·
              rodajas · anillas · picada · deshuesado · cocido …
  L4 GRADE    never painted.

Every entry is a labeled training anchor: name <-> image <-> ladder node.

PRIORITY (the order credits are spent in):
  1  the anchor look per kind — L1 wholes (and L2 wholes where the variety looks different)
  2  the high-traffic preps — filetes · lomos · rodajas · cocido · pelado · filetes de carne
  3  the long tail — tacos · picada · anillas · troceado · cortado · deshuesado …
"""
import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent

STYLE_LOCK = (
    "A small still-life painting in a style blending Studio Ghibli background art with "
    "Claude Monet's impressionism: {subject}. Soft luminous brushstrokes, gentle colour, "
    "painterly edges, the subject centered and filling about three quarters of the frame "
    "with even margin on every side, on a plain pure white background, nothing else in "
    "frame, no text, only a soft ground-contact shadow."
)

# tier 1 = the anchor look for a kind; tier 2 = high-traffic preps; tier 3 = long tail
TIER = {
    "entero": 1, "entera": 1, "pieza": 1, "manojo": 1, "racimo": 1,
    "filetes": 2, "lomos": 2, "rodajas": 2, "cocido": 2, "cocida": 2,
    "pelado": 2, "pelada": 2, "limpio": 2, "limpia": 2, "eviscerado": 2,
    "lonchas": 2, "troceado": 2, "deshuesado": 2, "abierta": 2, "cortado": 2,
    "tacos": 3, "picada": 3, "anillas": 3, "tiras": 3, "pata": 3,
    "migas": 3, "desalado": 3, "ahumado": 3, "laminado": 3, "rallado": 3,
    "medallones": 3, "salazon": 3, "congelado": 3,
}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


# ── PREP TEMPLATES ───────────────────────────────────────────────────────────────────────
# {en} = the english common noun, {flesh} = the flesh colour. Overrides beat templates.
T = {
    "fish": {
        "eviscerado": "a single gutted {en}, the belly cavity cleanly opened and empty, lying on its side",
        "filetes": "two clean skin-on fillets of {en} laid neatly side by side, {flesh} flesh",
        "lomos": "two thick boneless loins of {en} set side by side, {flesh} flesh",
        "rodajas": "two thick cross-cut steaks of {en} on the bone, {flesh} flesh around a small round central bone",
        "tacos": "a small neat heap of cubed {en}, {flesh} flesh",
    },
    "shellfish": {
        "pelado": "a single peeled raw {en} tail, {flesh} flesh, curved and glistening",
    },
    "meat": {
        "filetes": "two thin raw slices cut from a {en}, laid overlapping",
        "tacos": "a small neat heap of raw cubes of {en}",
        "picada": "a single rounded mound of freshly minced {en}",
        "troceado": "a small pile of jointed raw pieces of {en}",
        "deshuesado": "a single boned and rolled {en}, tied with butcher's string",
        "lonchas": "a small fan of thin slices of {en}, laid overlapping",
    },
    "vegetable": {
        "manojo": "a single bunch of {en}, the stems gathered and tied",
    },
    "fruit": {},
    "herb-fungus": {
        "manojo": "a single bunch of fresh {en}, the stems gathered and tied",
    },
}


# ═════════════════════════════════════════════════════════════════════════════════════════
#  THE KINDS.  whole = the L1 anchor clause. preps = the L3 forms this kind is really sold in.
#  ov = per-prep overrides where a template would lie. sorts = L2 nodes that LOOK different.
# ═════════════════════════════════════════════════════════════════════════════════════════
KINDS = []


def K(l0, es, whole, preps, en=None, flesh=None, ov=None, sorts=None, l1=None):
    KINDS.append({
        "l0": l0, "es": es, "l1": l1 or slugify(es), "en": en or es.lower(),
        "whole": whole, "flesh": flesh or "white", "preps": preps,
        "ov": ov or {}, "sorts": sorts or [],
    })


# ── FISH ─────────────────────────────────────────────────────────────────────────────────
K("fish", "Merluza",
  "a single whole hake, a slender silver-grey fish with a steel-blue back, a long tapering body and a large mouth, lying on its side",
  ["entero", "eviscerado", "filetes", "lomos", "rodajas", "tacos"], en="hake", flesh="pearly white")
K("fish", "Lubina",
  "a single whole sea bass, a sleek silver fish with a dark grey-green back, a pointed head and a forked tail, lying on its side",
  ["entero", "eviscerado", "filetes", "lomos"], en="sea bass", flesh="bright white")
K("fish", "Dorada",
  "a single whole gilt-head bream, a deep-bodied silver fish with a blunt head and a golden band between the eyes, lying on its side",
  ["entero", "eviscerado", "filetes"], en="gilt-head bream", flesh="white")
K("fish", "Rape",
  "a single whole monkfish, an enormous mottled brown flattened head with a wide grinning mouth and a narrow pale tail behind it",
  ["entero", "lomos", "tacos"], en="monkfish", flesh="firm ivory-white",
  ov={"lomos": "a single thick boned monkfish tail loin, firm ivory-white flesh in a smooth tapering cylinder"})
K("fish", "Rodaballo",
  "a single whole turbot, a wide flat diamond-shaped fish, sandy brown and pebbled on its upper side with both eyes together",
  ["entero", "filetes"], en="turbot", flesh="white")
K("fish", "Salmonete",
  "a single whole red mullet, a small rose-red fish with golden stripes along its flank and two fine barbels under the chin",
  ["entero", "eviscerado", "filetes"], en="red mullet", flesh="pale pink")
K("fish", "Sardina",
  "a single whole sardine, a small fish with a deep blue-green back and bright silver flanks",
  ["entero", "eviscerado", "filetes"], en="sardine", flesh="pinkish grey")
K("fish", "Boquerón",
  "a single whole fresh anchovy, a very slender small fish with a silver-blue back and a large dark eye",
  ["entero", "filetes", "salazon"], en="fresh anchovy", flesh="pale pink",
  ov={"salazon": "two cured salt-anchovy fillets, deep russet brown and glossy with oil, laid side by side",
      "filetes": "two tiny butterflied fresh anchovy fillets, silver skin and pale pink flesh, laid side by side"})
K("fish", "Atún",
  "a single thick block of bluefin tuna loin, deep ruby-red flesh with fine pale sinew lines",
  ["lomos", "rodajas", "tacos"], en="tuna", flesh="deep ruby-red",
  ov={"lomos": "a single thick block of bluefin tuna loin, deep ruby-red flesh with fine pale sinew lines"})
K("fish", "Bonito",
  "a single whole bonito, a torpedo-shaped fish with a steel-blue back, silver belly and fine dark stripes",
  ["entero", "lomos", "rodajas"], en="bonito", flesh="rosy beige")
K("fish", "Caballa",
  "a single whole mackerel, a torpedo-shaped fish with wavy black tiger stripes over a green-blue back and a silver belly",
  ["entero", "eviscerado", "filetes"], en="mackerel", flesh="greyish pink")
K("fish", "Bacalao",
  "a single whole cod, a heavy olive-brown speckled fish with a pale lateral line and a small chin barbel",
  ["entero", "lomos", "desalado", "migas"], en="cod", flesh="snow-white flaking",
  ov={"desalado": "two thick desalted salt-cod loins, snow-white flesh in heavy layered flakes, black skin beneath",
      "migas": "a single loose heap of shredded salt-cod flakes, snow-white and lightly curled"})
K("fish", "Gallo",
  "a single whole megrim sole, a slim flat fish, pale sandy brown with both eyes on one side",
  ["entero", "filetes"], en="megrim sole", flesh="white")
K("fish", "Lenguado",
  "a single whole Dover sole, an oval flat fish with a small head and smooth dark brown upper skin",
  ["entero", "filetes"], en="sole", flesh="white")
K("fish", "Corvina",
  "a single whole meagre, a large elongated silver fish with a bronze sheen along the back and a small mouth",
  ["entero", "lomos", "rodajas"], en="meagre", flesh="white")
K("fish", "Mero",
  "a single whole grouper, a heavy-bodied fish with a huge mouth and mottled olive-brown skin",
  ["entero", "lomos", "rodajas"], en="grouper", flesh="firm white")
K("fish", "Pez espada",
  "a single thick cross-cut swordfish steak, dense ivory-pink flesh with a fine dark whorl at the centre",
  ["rodajas", "tacos"], en="swordfish", flesh="ivory-pink",
  ov={"rodajas": "a single thick cross-cut swordfish steak, dense ivory-pink flesh with a fine dark whorl at the centre and a rim of grey skin"})
K("fish", "Salmón",
  "a single whole salmon, a large fish with a blue-silver back and bright silver flanks, lying on its side",
  ["entero", "lomos", "rodajas", "ahumado", "tacos"], en="salmon", flesh="deep orange-pink",
  ov={"ahumado": "a small fan of thin smoked salmon slices, translucent orange-pink with fine pale marbling"})
K("fish", "Trucha",
  "a single whole trout, a small fish with an olive-green back covered in dark spots and a rosy stripe along the flank",
  ["entero", "eviscerado", "filetes"], en="trout", flesh="pale coral")
K("fish", "Palometa",
  "a single whole pomfret, a deep almost circular silver fish with a small head and dark-edged fins",
  ["entero", "filetes"], en="pomfret", flesh="white")
K("fish", "Jurel",
  "a single whole horse mackerel, a slim silver fish with a hard line of bony scutes along the flank and a dark spot by the gill",
  ["entero", "filetes"], en="horse mackerel", flesh="greyish pink")
K("fish", "Congrio",
  "a single thick cross-cut conger eel steak, a pale ring of white flesh around a central bone, grey-brown skin outside",
  ["rodajas"], en="conger eel", flesh="firm white")
K("fish", "Besugo",
  "a single whole red sea bream, a deep-bodied rosy-pink fish with a very large dark eye",
  ["entero", "eviscerado"], en="red sea bream", flesh="white")
K("fish", "Cabracho",
  "a single whole scorpionfish, a knobbly bright red fish with spiny fins and a large blunt head",
  ["entero"], en="scorpionfish", flesh="white")
K("fish", "Raya",
  "a single skate wing, a broad triangular wing with fine radiating ridges, pale pinkish grey",
  ["entera", "limpia"], en="skate wing", flesh="pale pink",
  ov={"entera": "a single skate wing, a broad triangular wing with fine radiating ridges, pale pinkish grey",
      "limpia": "two skinned skate wing fillets, pale pink flesh with fine parallel ridges, laid side by side"})
K("fish", "Dentón",
  "a single whole dentex, a stocky steel-blue fish with a heavy head and prominent teeth",
  ["entero", "lomos"], en="dentex", flesh="white")
K("fish", "Virrey",
  "a single whole blackspot seabream, a rosy-pink fish with a distinct dark spot at the shoulder and a large eye",
  ["entero"], en="blackspot seabream", flesh="white")
K("fish", "Pez de San Pedro",
  "a single whole John Dory, a very thin oval olive-grey fish with a large dark thumbprint spot on its flank and long spiny fins",
  ["entero", "filetes"], en="John Dory", flesh="white", l1="pez-san-pedro")
K("fish", "Rosada",
  "a single whole pink cusk-eel, a long slender pale rose-coloured fish with a tapering tail",
  ["entero", "lomos"], en="pink cusk-eel", flesh="white")
K("fish", "Abadejo",
  "a single whole pollack, a slim bronze-green fish with a pale curved lateral line",
  ["entero", "lomos"], en="pollack", flesh="white")
K("fish", "Bacaladilla",
  "a single whole blue whiting, a small slender silver fish with a pointed snout",
  ["entero"], en="blue whiting", flesh="white")
K("fish", "Cazón",
  "a small neat heap of cubed dogfish, dense pale ivory flesh cut into even blocks",
  ["tacos"], en="dogfish", flesh="pale ivory")
K("fish", "Anguila",
  "a single whole eel, a long smooth dark olive-brown fish coiled loosely on itself",
  ["entera"], en="eel", flesh="white",
  ov={"entera": "a single whole eel, a long smooth dark olive-brown fish coiled loosely on itself"})

# ── SHELLFISH & CEPHALOPODS ──────────────────────────────────────────────────────────────
# «congelado» is a STATE, not a cut, and it earns its own clause for the same reason «cocido»
# does: the frozen prawn is what a house sells and it does not look like the fresh one. The kind
# keeps the ice in the clause — a coat of ice, frost crystals, a few flakes beside it — so the
# frozen tile can never be read as the cooked one.
K("shellfish", "Gamba roja",
  "a single raw red prawn, a deep scarlet shell with long fine antennae and a curled tail",
  ["entera", "cocida", "pelada", "congelado"], en="red prawn", flesh="translucent coral",
  ov={"entera": "a single raw red prawn, a deep scarlet shell with long fine antennae and a curled tail",
      "cocida": "a single cooked red prawn, its shell turned bright orange-red, tail curled under and antennae trailing",
      "pelada": "a single peeled raw red prawn tail, translucent coral flesh curved and glistening",
      "congelado": "a single frozen raw red prawn, a deep scarlet shell glazed with a thin coat of ice and fine white frost crystals, long fine antennae and a curled tail, a few small flakes of ice beside it"})
K("shellfish", "Gamba blanca",
  "a single raw white prawn, a pale translucent grey-pink shell with long fine antennae and a curled tail",
  ["entera", "cocida", "pelada"], en="white prawn", flesh="translucent grey-pink",
  ov={"entera": "a single raw white prawn, a pale translucent grey-pink shell with long fine antennae and a curled tail",
      "cocida": "a single cooked white prawn, its shell turned pale orange-pink, tail curled under",
      "pelada": "a single peeled raw white prawn tail, pale translucent flesh curved and glistening"})
K("shellfish", "Carabinero",
  "a single raw carabinero prawn, an intense deep crimson shell, a large head and very long antennae",
  ["entero"], en="carabinero prawn", flesh="coral")
K("shellfish", "Langostino",
  "a single raw king prawn, a striped grey-pink shell with a long rostrum and fine legs",
  ["entero", "cocido", "pelado"], en="king prawn", flesh="translucent grey",
  ov={"cocido": "a single cooked king prawn, its shell turned bright orange with white banding, tail curled under",
      "pelado": "a single peeled raw king prawn tail, translucent grey flesh curved and glistening"})
K("shellfish", "Cigala",
  "a single raw langoustine, a slim pale orange-pink body with long thin banded claws and black eyes",
  ["entera", "cocida"], en="langoustine", flesh="white",
  ov={"entera": "a single raw langoustine, a slim pale orange-pink body with long thin banded claws and black eyes",
      "cocida": "a single cooked langoustine, its shell a deeper orange, long thin claws held forward"})
K("shellfish", "Bogavante",
  "a single raw lobster, a dark blue-black armoured body with two heavy uneven claws and long antennae",
  ["entero", "cocido"], en="lobster", flesh="white",
  ov={"cocido": "a single cooked lobster, its shell turned deep orange-red, two heavy claws held forward"})
K("shellfish", "Langosta",
  "a single spiny lobster, a rust-orange spined shell with no large claws and two very long thick antennae",
  ["entera", "cocida"], en="spiny lobster", flesh="white",
  ov={"entera": "a single spiny lobster, a rust-orange spined shell with no large claws and two very long thick antennae",
      "cocida": "a single cooked spiny lobster, its spined shell turned bright brick orange, long antennae swept back"})
K("shellfish", "Nécora",
  "a single velvet swimming crab, a broad reddish-brown shell with fine hairy edges and bright red eyes",
  ["entera", "cocida"], en="velvet crab", flesh="white",
  ov={"entera": "a single velvet swimming crab, a broad reddish-brown shell with fine hairy edges and bright red eyes",
      "cocida": "a single cooked velvet crab, its shell turned deep orange-red, claws folded in"})
K("shellfish", "Buey de mar",
  "a single brown crab, a wide smooth oval shell with a crimped pie-crust edge and two heavy black-tipped claws",
  ["entero", "cocido"], en="brown crab", flesh="white",
  ov={"cocido": "a single cooked brown crab, its wide shell a warm orange-brown, two heavy black-tipped claws folded in"})
K("shellfish", "Centollo",
  "a single spider crab, a round spiny orange-brown body with very long thin knobbled legs",
  ["entero", "cocido"], en="spider crab", flesh="white",
  ov={"cocido": "a single cooked spider crab, its spiny body a deep orange, very long thin legs folded around it"})
K("shellfish", "Percebe",
  "a single small cluster of goose barnacles, thick dark grey-purple stalks tipped with white horny plates",
  ["entero"], en="goose barnacles", flesh="pink")
K("shellfish", "Mejillón",
  "a single mussel, a glossy blue-black elongated shell with a fine pale growth line",
  ["entero", "limpio", "abierta"], en="mussel", flesh="orange",
  ov={"limpio": "a single cleaned mussel, a glossy blue-black shell scrubbed smooth with the beard removed",
      "abierta": "a single opened mussel on the half shell, plump orange flesh inside a blue-black pearlescent shell"})
K("shellfish", "Almeja fina",
  "a single carpet-shell clam, a rounded pale beige shell with fine concentric rings and faint brown markings",
  ["entera", "abierta"], en="clam", flesh="pale grey",
  ov={"entera": "a single carpet-shell clam, a rounded pale beige shell with fine concentric rings and faint brown markings",
      "abierta": "a single opened clam on the half shell, pale grey flesh inside a smooth cream shell"})
K("shellfish", "Berberecho",
  "a single cockle, a small round cream shell with strong radiating ribs",
  ["entero"], en="cockle", flesh="pale")
K("shellfish", "Navaja",
  "a single razor clam, a long straight golden-brown shell like a folded razor with a pale foot at one end",
  ["entera"], en="razor clam", flesh="ivory",
  ov={"entera": "a single razor clam, a long straight golden-brown shell like a folded razor with a pale foot at one end"})
K("shellfish", "Ostra",
  "a single oyster, a heavy rough grey-brown fluted shell, closed",
  ["entera", "abierta"], en="oyster", flesh="pearly grey",
  ov={"entera": "a single oyster, a heavy rough grey-brown fluted shell, closed",
      "abierta": "a single opened oyster on the half shell, pearly grey flesh in a nacre-lined cup"})
K("shellfish", "Vieira",
  "a single scallop in its shell, a broad fan-shaped ribbed shell in warm sand and rust tones",
  ["entera", "limpia"], en="scallop", flesh="ivory",
  ov={"entera": "a single scallop in its shell, a broad fan-shaped ribbed shell in warm sand and rust tones",
      "limpia": "a single cleaned scallop on the half shell, a plump ivory disc of meat beside its orange coral"})
K("shellfish", "Zamburiña",
  "a single queen scallop, a small fan-shaped shell mottled in purple-brown and cream",
  ["entera"], en="queen scallop", flesh="ivory",
  ov={"entera": "a single queen scallop, a small fan-shaped shell mottled in purple-brown and cream"})
K("shellfish", "Erizo de mar",
  "a single sea urchin, a dark purple-black globe covered in fine moving spines",
  ["entero", "abierta"], en="sea urchin", flesh="orange",
  ov={"abierta": "a single sea urchin opened at the top, five orange tongues of roe inside a spined dark shell"})
K("shellfish", "Bígaro",
  "a single winkle, a small glossy dark blue-grey spiral shell",
  ["entero"], en="winkle", flesh="grey")
K("shellfish", "Coquina",
  "a single wedge clam, a small smooth triangular shell in bands of cream, mauve and tan",
  ["entera"], en="wedge clam", flesh="pale",
  ov={"entera": "a single wedge clam, a small smooth triangular shell in bands of cream, mauve and tan"})
K("shellfish", "Galera",
  "a single mantis shrimp, a long flattened pale grey body with fine banded segments and two dark eye spots on the tail",
  ["entera"], en="mantis shrimp", flesh="white",
  ov={"entera": "a single mantis shrimp, a long flattened pale grey body with fine banded segments and two dark eye spots on the tail"})
K("shellfish", "Quisquilla",
  "a single small grey shrimp, a translucent speckled body with a curled tail and fine long antennae",
  ["entera"], en="grey shrimp", flesh="translucent",
  ov={"entera": "a single small grey shrimp, a translucent speckled body with a curled tail and fine long antennae"})
K("shellfish", "Sepia",
  "a single whole cuttlefish, a broad oval creamy body with fine brown stippling and a fringe of skirt, short tentacles gathered in front",
  ["entera", "limpia", "tiras"], en="cuttlefish", flesh="white",
  ov={"entera": "a single whole cuttlefish, a broad oval creamy body with fine brown stippling and a fringe of skirt, short tentacles gathered in front",
      "limpia": "a single cleaned cuttlefish, a smooth flat sheet of chalk-white flesh, skinned and trimmed",
      "tiras": "a small neat heap of chalk-white cuttlefish strips, cut in even ribbons"})
K("shellfish", "Calamar",
  "a single whole squid, a slim pale pink translucent tube with two triangular fins and a bundle of tentacles",
  ["entero", "limpio", "anillas"], en="squid", flesh="white",
  ov={"limpio": "a single cleaned squid tube, a smooth white cylinder with its two fins and trimmed tentacles beside it",
      "anillas": "a small neat heap of squid rings, pale white bands cut evenly from the tube"})
K("shellfish", "Chipirón",
  "a single baby squid, a small pale pink translucent body with tiny fins and a neat bunch of short tentacles",
  ["entero", "limpio"], en="baby squid", flesh="white",
  ov={"limpio": "a single cleaned baby squid, a small white tube with its tentacles tucked into the opening"})
K("shellfish", "Pulpo",
  "a single raw octopus, a mottled grey-purple head with eight long suckered arms curled loosely around it",
  ["entero", "cocido", "pata"], en="octopus", flesh="white",
  ov={"cocido": "a single cooked octopus, its skin turned deep purple-red, eight arms with pale suckers curled together",
      "pata": "a single cooked octopus tentacle, a tapering purple-red arm with a row of pale suckers along it"})

# ── MEAT ─────────────────────────────────────────────────────────────────────────────────
K("meat", "Chuletón de ternera",
  "a single thick bone-in beef rib steak, deep red marbled flesh with a rim of creamy fat and a clean white rib bone",
  ["pieza"], en="beef rib steak")
K("meat", "Entrecot de ternera",
  "a single boneless beef ribeye steak, deep red flesh finely marbled with a curl of fat at one edge",
  ["pieza"], en="ribeye steak")
K("meat", "Solomillo de ternera",
  "a single whole beef tenderloin, a long tapering deep-red muscle with a silver sheen of sinew",
  ["pieza", "medallones", "tacos"], en="beef tenderloin",
  ov={"medallones": "two thick round beef tenderloin medallions, deep red and neatly trimmed, standing side by side"})
K("meat", "Lomo alto de ternera",
  "a single whole beef fore rib joint, a long deep-red muscle with a broad fat cap and rib bones along one side",
  ["pieza", "filetes"], en="beef fore rib")
K("meat", "Lomo bajo de ternera",
  "a single whole beef sirloin joint, a long deep-red muscle with a thick even fat cap",
  ["pieza", "filetes"], en="beef sirloin")
K("meat", "Falda de ternera",
  "a single piece of beef flank, a flat coarse-grained deep-red cut with thin seams of fat",
  ["pieza", "tacos"], en="beef flank")
K("meat", "Morcillo de ternera",
  "a single beef shin joint, a rounded dark-red muscle wrapped in silvery sinew",
  ["pieza", "tacos"], en="beef shin")
K("meat", "Osobuco",
  "a single thick cross-cut beef shin slice, dark red meat in a ring around a round white marrow bone",
  ["pieza"], en="beef shin slice")
K("meat", "Aguja de ternera",
  "a single beef chuck joint, a thick blocky deep-red cut with generous white marbling",
  ["pieza", "filetes", "tacos"], en="beef chuck")
K("meat", "Rabo de toro",
  "a small pile of cut oxtail pieces, dark red rounds of meat around white vertebral bones",
  ["troceado"], en="oxtail",
  ov={"troceado": "a small pile of cut oxtail pieces, dark red rounds of meat around white vertebral bones"})
K("meat", "Carrillera de ternera",
  "a single beef cheek, a plump rounded dark-red muscle with a marbled surface",
  ["pieza"], en="beef cheek")
K("meat", "Costillar de ternera",
  "a single rack of beef short ribs, deep red meat over three thick pale bones",
  ["pieza", "troceado"], en="beef short ribs")
K("meat", "Picaña",
  "a single picanha cap of rump, a triangular deep-red muscle under a thick smooth white fat cap",
  ["pieza"], en="picanha")
K("meat", "Redondo de ternera",
  "a single beef eye of round, a smooth even cylinder of deep-red meat",
  ["pieza", "filetes"], en="beef eye of round")
K("meat", "Carne picada de ternera",
  "a single rounded mound of freshly minced beef, coarse deep-red strands",
  ["pieza"], en="beef", l1="picada-ternera")

K("meat", "Lomo de cerdo",
  "a single whole pork loin, a long pale rose-pink muscle under a smooth even cap of white fat",
  ["pieza", "filetes", "tacos"], en="pork loin")
K("meat", "Panceta de cerdo",
  "a single slab of pork belly, alternating stripes of pale pink meat and creamy white fat with rind on top",
  ["pieza", "lonchas", "tacos"], en="pork belly")
K("meat", "Costillar de cerdo",
  "a single rack of pork ribs, pale pink meat over a curved row of white bones",
  ["pieza", "troceado"], en="pork ribs")
K("meat", "Secreto ibérico",
  "a single piece of Iberian secreto, a flat fan-shaped cut with dense feathered white marbling through dark red meat",
  ["pieza"], en="Iberian secreto")
K("meat", "Presa ibérica",
  "a single piece of Iberian presa, a thick rounded dark-red muscle richly veined with white fat",
  ["pieza"], en="Iberian presa")
K("meat", "Pluma ibérica",
  "a single piece of Iberian pluma, a small flat triangular cut of dark red meat with fine marbling",
  ["pieza"], en="Iberian pluma")
K("meat", "Abanico ibérico",
  "a single piece of Iberian abanico, a long thin strip of dark red meat along a row of small rib bones",
  ["pieza"], en="Iberian abanico")
K("meat", "Solomillo de cerdo",
  "a single whole pork tenderloin, a slim tapering pale pink muscle, smooth and trimmed",
  ["pieza", "medallones"], en="pork tenderloin",
  ov={"medallones": "two thick round pork tenderloin medallions, pale pink and neatly trimmed, standing side by side"})
K("meat", "Carrillera de cerdo",
  "a single pork cheek, a small plump rounded pink muscle with a marbled surface",
  ["pieza"], en="pork cheek")
K("meat", "Chuleta de cerdo",
  "a single bone-in pork chop, pale pink meat with a rim of white fat and a clean rib bone",
  ["pieza"], en="pork chop")
K("meat", "Codillo de cerdo",
  "a single pork knuckle, a rounded joint of pale meat under thick pale rind, one bone protruding",
  ["pieza"], en="pork knuckle")
K("meat", "Papada de cerdo",
  "a single slab of pork jowl, thick creamy white fat with a thin seam of pink meat",
  ["pieza"], en="pork jowl")
K("meat", "Lacón",
  "a single cured pork shoulder, a rounded joint with rosy meat under a pale rind",
  ["pieza"], en="cured pork shoulder")
K("meat", "Manitas de cerdo",
  "a single split pig's trotter, pale gelatinous skin over a small pale bone",
  ["pieza"], en="pig's trotter")
K("meat", "Tocino",
  "a single slab of pork back fat, dense creamy white with a thin rind edge",
  ["pieza"], en="pork back fat")
K("meat", "Carne picada de cerdo",
  "a single rounded mound of freshly minced pork, coarse pale pink strands",
  ["pieza"], en="pork", l1="picada-cerdo")

K("meat", "Paletilla de cordero",
  "a single lamb shoulder, a rounded joint of rosy meat under a thin creamy fat cover with the blade bone within",
  ["pieza", "deshuesado", "troceado"], en="lamb shoulder")
K("meat", "Pierna de cordero",
  "a single lamb leg, a long tapering joint of rosy meat under a thin white fat cover with the shank bone showing",
  ["pieza", "deshuesado", "troceado"], en="lamb leg")
K("meat", "Chuletillas de cordero",
  "a small neat fan of little lamb cutlets, rosy meat with white fat rims and fine bare rib bones",
  ["pieza"], en="lamb cutlets")
K("meat", "Costillar de cordero",
  "a single bound rack of lamb chops, rosy meat over a curved row of cleanly scraped rib bones",
  ["pieza"], en="rack of lamb")
K("meat", "Cuello de cordero",
  "a single lamb neck fillet, a slim tapering rosy muscle with fine marbling",
  ["pieza", "troceado"], en="lamb neck")
K("meat", "Cordero lechal",
  "a single whole milk-fed lamb carcass, pale rosy and very small, laid on its side",
  ["entero"], en="milk-fed lamb",
  ov={"entero": "a single whole milk-fed lamb carcass, pale rosy and very small, laid on its side"})
K("meat", "Pierna de cabrito",
  "a single kid goat leg, a small tapering joint of pale rosy meat with a fine bone",
  ["pieza"], en="kid goat leg")
K("meat", "Conejo entero",
  "one single whole oven-ready rabbit on a butcher's bench, a slim pale skinned carcass with long hind legs, laid on its side",
  ["entero"], en="rabbit", l1="conejo",
  ov={"entero": "one single whole oven-ready rabbit on a butcher's bench, a slim pale skinned carcass with long hind legs, laid on its side"})
# «Conejo troceado» is a NODE of its own now (n-g-conejo-troceado), not a form of the whole
# animal — «a whole rabbit, jointed» was never a thing anyone sells. It keeps its own slug.
K("meat", "Conejo troceado",
  "a small pile of jointed raw pieces of rabbit, pale legs and saddle sections stacked together",
  ["pieza"], en="jointed rabbit", l1="conejo")

K("meat", "Pollo",
  "a single whole chicken, a plump pale golden bird with legs tucked under, breast upward",
  ["entero", "troceado"], en="chicken",
  ov={"entero": "a single whole chicken, a plump pale golden bird with legs tucked under, breast upward"})
K("meat", "Pechuga de pollo",
  "a single skinless chicken breast, a smooth plump pale pink fillet",
  ["pieza", "filetes", "tacos"], en="chicken breast")
K("meat", "Muslo de pollo",
  "a single chicken drumstick, pale golden skin over a rounded leg with the bone at one end",
  ["pieza"], en="chicken drumstick")
K("meat", "Contramuslo de pollo",
  "a single chicken thigh, pale golden skin over a plump flat joint",
  ["pieza", "deshuesado"], en="chicken thigh")
K("meat", "Alitas de pollo",
  "a small pile of chicken wings, pale golden jointed wings gathered together",
  ["pieza"], en="chicken wings")
K("meat", "Higaditos de pollo",
  "a small heap of chicken livers, glossy deep burgundy lobes",
  ["pieza"], en="chicken livers")
K("meat", "Pavo entero",
  "one single whole oven-ready raw turkey on a butcher's counter, plucked bare and headless, a large plump pale-cream bird with its wings folded flat and the legs trussed, breast upward",
  ["entero"], en="whole turkey", l1="pavo",
  ov={"entero": "one single whole oven-ready raw turkey on a butcher's counter, plucked bare and headless, a large plump pale-cream bird with its wings folded flat and the legs trussed, breast upward"})
K("meat", "Pechuga de pavo",
  "a single skinless turkey breast, a large smooth pale fillet",
  ["pieza", "filetes"], en="turkey breast")
K("meat", "Pato",
  "a single whole duck, a plump bird with creamy fatty skin, legs tucked under",
  ["entero"], en="duck",
  ov={"entero": "a single whole duck, a plump bird with creamy fatty skin, legs tucked under"})
K("meat", "Magret de pato",
  "a single duck breast, dark red meat under a thick scored cap of pale fat",
  ["pieza", "filetes"], en="duck breast")
K("meat", "Codorniz",
  "a single whole quail, a very small plump pale bird with the legs tied together",
  ["entera"], en="quail",
  ov={"entera": "a single whole quail, a very small plump pale bird with the legs tied together"})
K("meat", "Perdiz",
  "a single whole partridge, a small round bird with soft grey-brown feathering at the neck",
  ["entera"], en="partridge",
  ov={"entera": "a single whole partridge, a small round plucked bird with a compact body"})
K("meat", "Pularda",
  "a single whole poulard, a large very plump pale bird trussed with string",
  ["entera"], en="poulard",
  ov={"entera": "a single whole poulard, a large very plump pale bird trussed with string"})

K("meat", "Jamón serrano",
  "a single whole cured ham leg, a long tapering joint with dark rind and a black trotter, hanging by its hock",
  ["pieza", "lonchas"], en="cured ham",
  ov={"lonchas": "a small fan of thin cured ham slices, deep rose-red marbled with fine white fat"})
K("meat", "Jamón ibérico",
  "a single whole Iberian cured ham leg, a slender dark-rinded joint with a black trotter",
  ["pieza", "lonchas"], en="Iberian ham",
  ov={"lonchas": "a small fan of very thin Iberian ham slices, deep crimson veined with translucent fat"})
K("meat", "Chorizo",
  "a single string of cured chorizo, a deep brick-red sausage tied at intervals and curved into a horseshoe",
  ["pieza", "lonchas"], en="chorizo",
  ov={"lonchas": "a small fan of chorizo slices, brick-red rounds flecked with white fat"})
K("meat", "Salchichón",
  "a single cured salchichón sausage, a thick pale-dusted cylinder tied with string",
  ["pieza", "lonchas"], en="salchichón",
  ov={"lonchas": "a small fan of salchichón slices, deep red rounds studded with white fat and peppercorns"})
K("meat", "Lomo embuchado",
  "a single cured pork loin sausage, a long dark red cylinder in a papery casing tied with string",
  ["pieza", "lonchas"], en="cured pork loin",
  ov={"lonchas": "a small fan of cured pork loin slices, deep red rounds rimmed with paprika"})
K("meat", "Morcilla",
  "a single blood sausage, a short dark near-black cylinder tied at both ends",
  ["pieza"], en="blood sausage")
K("meat", "Butifarra",
  "a single coil of fresh butifarra, a pale beige sausage curled loosely on itself",
  ["pieza"], en="butifarra")
K("meat", "Sobrasada",
  "a single sobrasada sausage, a plump orange-red soft sausage in a pale netted casing",
  ["pieza"], en="sobrasada")
K("meat", "Panceta curada",
  "a single slab of cured pork belly, striped pink and white with a paprika-dusted edge",
  ["pieza", "lonchas"], en="cured pork belly")
K("meat", "Bacon",
  "a small fan of bacon rashers, pink meat striped with creamy fat, laid overlapping",
  ["lonchas"], en="bacon",
  ov={"lonchas": "a small fan of bacon rashers, pink meat striped with creamy fat, laid overlapping"})
K("meat", "Salchicha fresca",
  "a single coil of fresh sausages, pale pink links twisted together",
  ["pieza"], en="fresh sausage")
K("meat", "Chistorra",
  "a single coil of chistorra, a thin bright orange-red sausage curled in a loose spiral",
  ["pieza"], en="chistorra")
K("meat", "Cecina",
  "a small fan of cured beef cecina slices, dark garnet red and very thin, laid overlapping",
  ["lonchas"], en="cecina",
  ov={"lonchas": "a small fan of cured beef cecina slices, dark garnet red and very thin, laid overlapping"})
K("meat", "Fuet",
  "a single fuet sausage, a slim white-dusted cured sausage curved gently",
  ["pieza"], en="fuet")

# ── FRUIT ────────────────────────────────────────────────────────────────────────────────
K("fruit", "Manzana",
  "a single apple, a round firm fruit with a short stem",
  ["entera"], en="apple",
  sorts=[
    {"es": "Manzana golden", "whole": "a single golden delicious apple, a clear pale yellow-green skin faintly freckled, with a short stem"},
    {"es": "Manzana fuji", "whole": "a single fuji apple, a round fruit blushed streaky red over pale yellow"},
    {"es": "Manzana granny smith", "whole": "a single granny smith apple, a bright grass-green skin with a waxy sheen"},
    {"es": "Manzana royal gala", "whole": "a single royal gala apple, striped orange-red over a golden ground"},
    {"es": "Manzana reineta", "whole": "a single reineta apple, a squat ribbed fruit with a dull russeted yellow-green skin"},
  ])
K("fruit", "Pera",
  "a single pear, a tapering fruit narrowing to a short stem",
  ["entera"], en="pear",
  sorts=[
    {"es": "Pera conferencia", "whole": "a single conference pear, a long narrow fruit with a bronze-russet green skin"},
    {"es": "Pera blanquilla", "whole": "a single blanquilla pear, a small rounded fruit with a smooth pale yellow-green skin"},
    {"es": "Pera ercolina", "whole": "a single ercolina pear, a plump yellow fruit with a soft red blush on one cheek"},
  ])
K("fruit", "Plátano",
  "a single ripe banana, a curved yellow fruit with fine brown flecks and a dark stem tip",
  ["entero"], en="banana")
K("fruit", "Naranja",
  "a single orange, a round fruit with a dimpled bright orange skin and a small green leaf at the stem",
  ["entera", "cortada"], en="orange",
  ov={"cortada": "a single orange cut in half, the cut face showing wet segmented flesh under a white pith rim"})
K("fruit", "Mandarina",
  "a single mandarin, a small squat orange fruit with a loose glossy skin and a green leaf at the stem",
  ["entera"], en="mandarin")
K("fruit", "Limón",
  "a single lemon, an oval bright yellow fruit with a dimpled skin and a small nipple at one end",
  ["entero", "cortado"], en="lemon",
  ov={"cortado": "a single lemon cut in half, the cut face showing pale wet segments inside a thick white pith rim"})
K("fruit", "Lima",
  "a single lime, a small round deep-green fruit with a glossy dimpled skin",
  ["entera"], en="lime")
K("fruit", "Pomelo",
  "a single grapefruit, a large round fruit with a pale yellow skin flushed pink",
  ["entero", "cortado"], en="grapefruit",
  ov={"cortado": "a single grapefruit cut in half, the cut face showing rosy segments under a thick pale rind"})
K("fruit", "Uva",
  "a single bunch of grapes on the stem",
  ["racimo"], en="grapes",
  sorts=[
    {"es": "Uva blanca", "whole": "a single bunch of white grapes on the stem, translucent pale green berries with a soft bloom"},
    {"es": "Uva negra", "whole": "a single bunch of black grapes on the stem, deep purple berries with a dusty bloom"},
  ])
K("fruit", "Fresa",
  "a single ripe strawberry, a glossy scarlet cone speckled with tiny seeds and a green calyx on top",
  ["entera"], en="strawberry")
K("fruit", "Frambuesa",
  "a single raspberry, a small hollow cluster of soft crimson drupelets",
  ["entera"], en="raspberry")
K("fruit", "Arándano",
  "a single blueberry, a small round deep indigo berry with a dusty bloom and a five-pointed crown",
  ["entero"], en="blueberry")
K("fruit", "Mora",
  "a single blackberry, a glossy black cluster of tight drupelets on a short stem",
  ["entera"], en="blackberry")
K("fruit", "Cereza",
  "a single pair of cherries joined at their long stems, deep glossy crimson",
  ["entera"], en="cherries")
K("fruit", "Ciruela",
  "a single plum, a round deep purple fruit with a dusty bloom and a faint seam down one side",
  ["entera"], en="plum")
K("fruit", "Melocotón",
  "a single peach, a round velvety fruit blushed red over golden yellow with a deep seam",
  ["entero"], en="peach")
K("fruit", "Nectarina",
  "a single nectarine, a round smooth-skinned fruit deep red over yellow with a glossy sheen",
  ["entera"], en="nectarine")
K("fruit", "Paraguayo",
  "a single flat peach, a squat doughnut-shaped fruit, velvety and blushed red over cream",
  ["entero"], en="flat peach")
K("fruit", "Albaricoque",
  "a single apricot, a small round velvety fruit in warm orange with a faint rosy cheek and a deep seam",
  ["entero"], en="apricot")
K("fruit", "Kiwi",
  "a single kiwi fruit, an oval brown fuzzy-skinned fruit",
  ["entero", "cortado"], en="kiwi",
  ov={"cortado": "a single kiwi cut in half, the cut face showing bright green flesh radiating around a pale core ringed with black seeds"})
K("fruit", "Piña",
  "a single pineapple, a barrel of golden-brown diamond scales topped with a spray of stiff green leaves",
  ["entera"], en="pineapple")
K("fruit", "Mango",
  "a single mango, an oval fruit shading from green through gold to a deep red blush",
  ["entero"], en="mango")
K("fruit", "Papaya",
  "a single papaya, a large pear-shaped fruit with a smooth yellow-green skin",
  ["entera", "cortada"], en="papaya",
  ov={"cortada": "a single papaya cut in half, the cut face showing deep orange flesh around a hollow of glossy black seeds"})
K("fruit", "Granada",
  "a single pomegranate, a round deep red fruit with a leathery skin and a crown of stiff points at the top",
  ["entera", "cortada"], en="pomegranate",
  ov={"cortada": "a single pomegranate broken open, tight ruby seeds packed inside a pale membrane"})
K("fruit", "Higo",
  "a single fig, a soft teardrop fruit in deep purple shading to green at the shoulder, with a short stem",
  ["entero"], en="fig")
K("fruit", "Caqui",
  "a single persimmon, a squat glossy deep-orange fruit with a dry four-lobed brown calyx on top",
  ["entero"], en="persimmon")
K("fruit", "Chirimoya",
  "a single cherimoya, a heart-shaped pale green fruit with a scaled thumbprint pattern on the skin",
  ["entera"], en="cherimoya")
K("fruit", "Maracuyá",
  "a single passion fruit, a small round fruit with a wrinkled deep purple skin",
  ["entero"], en="passion fruit")
K("fruit", "Coco",
  "a single coconut, a round hairy brown husk with three dark eyes at one end",
  ["entero"], en="coconut")
K("fruit", "Níspero",
  "a single loquat, a small oval golden-orange fruit with a fine downy skin and a dry calyx",
  ["entero"], en="loquat")
K("fruit", "Membrillo",
  "a single quince, a large knobbly golden-yellow fruit with a downy skin",
  ["entero"], en="quince")
K("fruit", "Dátil",
  "a single date, a small wrinkled amber-brown fruit, glossy and plump",
  ["entero"], en="date")
K("fruit", "Sandía",
  "a single watermelon, a large oval fruit with a deep green skin marbled in lighter stripes",
  ["entera", "cortada"], en="watermelon",
  ov={"cortada": "a single wedge of watermelon, bright pink flesh flecked with black seeds above a pale green rind"})
K("fruit", "Melón",
  "a single melon, a large oval fruit",
  ["entero", "cortado"], en="melon",
  ov={"cortado": "a single wedge of melon, pale flesh above a thin rind, the seed hollow cleaned out"},
  sorts=[
    {"es": "Melón piel de sapo", "whole": "a single piel de sapo melon, a long oval fruit with a mottled dark and light green skin"},
    {"es": "Melón cantalupo", "whole": "a single cantaloupe melon, a round fruit with a beige netted rind and faint green ribs"},
    {"es": "Melón galia", "whole": "a single galia melon, a round fruit with a golden netted rind"},
  ])
K("fruit", "Aguacate",
  "a single avocado, a pear-shaped fruit with a pebbled dark green skin and a small stem nub",
  ["entero", "cortado"], en="avocado",
  ov={"cortado": "a single avocado cut in half, pale green-gold flesh around a large smooth brown stone"})

# ── VEGETABLE ────────────────────────────────────────────────────────────────────────────
K("vegetable", "Tomate",
  "a single tomato with a green calyx at the stem",
  ["entero"], en="tomato",
  sorts=[
    {"es": "Tomate de pera", "whole": "a single plum tomato, an elongated deep-red fruit with a small green calyx"},
    {"es": "Tomate rama", "whole": "a small truss of vine tomatoes, three round red fruits still joined on a green stem", "preps": ["racimo"]},
    {"es": "Tomate rosa", "whole": "a single pink tomato, a large ribbed fruit of soft rose-pink with pale green shoulders"},
    {"es": "Tomate raf", "whole": "a single raf tomato, a squat heavily ribbed fruit, dark green at the shoulders fading to red"},
    {"es": "Tomate cherry", "whole": "a small cluster of cherry tomatoes, tiny round scarlet fruits on a fine green stem", "preps": ["racimo"]},
  ])
K("vegetable", "Lechuga",
  "a single head of lettuce, tightly furled green leaves",
  ["entera"], en="lettuce",
  sorts=[
    {"es": "Lechuga romana", "whole": "a single romaine lettuce, a tall upright head of long ribbed leaves, dark green outside and pale at the heart"},
    {"es": "Lechuga iceberg", "whole": "a single iceberg lettuce, a dense round head of crisp pale green leaves"},
    {"es": "Lechuga hoja de roble", "whole": "a single oak-leaf lettuce, a loose rosette of soft lobed leaves shading from green to bronze-red"},
  ])
K("vegetable", "Escarola",
  "a single head of frisée endive, a wide loose rosette of finely cut curly leaves, pale at the heart",
  ["entera"], en="endive")
K("vegetable", "Endibia",
  "a single Belgian endive, a tight pale spindle of overlapping cream leaves tipped with yellow-green",
  ["entera"], en="Belgian endive")
K("vegetable", "Canónigos",
  "a small bunch of lamb's lettuce, little rosettes of smooth spoon-shaped dark green leaves",
  ["manojo"], en="lamb's lettuce")
K("vegetable", "Rúcula",
  "a small bunch of rocket, slender stems of deeply lobed dark green leaves",
  ["manojo"], en="rocket")
K("vegetable", "Berro",
  "a small bunch of watercress, fine stems crowded with small round dark green leaves",
  ["manojo"], en="watercress")
K("vegetable", "Espinaca",
  "a small bunch of spinach, broad crinkled dark green leaves on pink-tinged stems",
  ["manojo"], en="spinach")
K("vegetable", "Acelga",
  "a single bunch of Swiss chard, broad dark green crinkled leaves on wide white ribs",
  ["manojo"], en="chard")
K("vegetable", "Col",
  "a single white cabbage, a dense pale green globe of tightly wrapped leaves",
  ["entera"], en="cabbage")
K("vegetable", "Lombarda",
  "a single red cabbage, a dense globe of tightly wrapped deep purple leaves with pale veins",
  ["entera"], en="red cabbage")
K("vegetable", "Col rizada",
  "a single bunch of kale, long dark blue-green leaves with tightly ruffled edges",
  ["manojo"], en="kale")
K("vegetable", "Coles de Bruselas",
  "a small heap of Brussels sprouts, tight little green globes of furled leaves",
  ["entera"], en="Brussels sprouts",
  ov={"entera": "a small heap of Brussels sprouts, tight little green globes of furled leaves"})
K("vegetable", "Brócoli",
  "a single head of broccoli, a dense dark green dome of tight florets on a thick pale stalk",
  ["entero"], en="broccoli")
K("vegetable", "Coliflor",
  "a single cauliflower, a firm creamy white curd cupped in pale green leaves",
  ["entera"], en="cauliflower")
K("vegetable", "Romanesco",
  "a single romanesco, a pale green cone built of spiralling pointed florets",
  ["entero"], en="romanesco")
K("vegetable", "Alcachofa",
  "a single globe artichoke, a tight violet-green bud of overlapping pointed scales on a cut stem",
  ["entera", "limpia"], en="artichoke",
  ov={"limpia": "a single trimmed artichoke heart, a pale creamy cup with the stem peeled and the outer leaves gone"})
K("vegetable", "Espárrago",
  "a single bundle of asparagus spears tied together",
  ["manojo"], en="asparagus",
  sorts=[
    {"es": "Espárrago verde", "whole": "a single bundle of green asparagus, slim spears with tight violet-tinged tips, tied together"},
    {"es": "Espárrago blanco", "whole": "a single bundle of white asparagus, thick ivory spears with pale closed tips, tied together"},
  ])
K("vegetable", "Judía verde",
  "a small handful of green beans, long slender flat pods in bright green",
  ["manojo"], en="green beans")
K("vegetable", "Guisante",
  "a small handful of pea pods, plump bright green pods with one split open showing the round peas",
  ["entero"], en="peas",
  ov={"entero": "a small handful of pea pods, plump bright green pods with one split open showing the round peas"})
K("vegetable", "Haba",
  "a small handful of broad bean pods, long pale green pods with one split open showing the flat beans in their white lining",
  ["entera"], en="broad beans",
  ov={"entera": "a small handful of broad bean pods, long pale green pods with one split open showing the flat beans in their white lining"})
K("vegetable", "Pimiento",
  "a single sweet pepper, a glossy lobed fruit with a green stem",
  ["entero"], en="pepper",
  sorts=[
    {"es": "Pimiento rojo", "whole": "a single red bell pepper, a glossy deep scarlet blocky fruit with a curved green stem"},
    {"es": "Pimiento verde italiano", "whole": "a single Italian green pepper, a long slender pale green fruit with a slight curve and a green stem"},
    {"es": "Pimiento amarillo", "whole": "a single yellow bell pepper, a glossy golden blocky fruit with a green stem"},
    {"es": "Pimiento de Padrón", "whole": "a small handful of Padrón peppers, little wrinkled dark green fruits with short stems", "preps": ["manojo"]},
    {"es": "Pimiento del piquillo", "whole": "a single piquillo pepper, a small pointed deep-red fruit with a fine tapering tip"},
  ])
K("vegetable", "Berenjena",
  "a single aubergine, a glossy deep purple teardrop with a green spiny calyx at the stem",
  ["entera"], en="aubergine")
K("vegetable", "Calabacín",
  "a single courgette, a smooth dark green cylinder with a pale cut stem",
  ["entero"], en="courgette")
K("vegetable", "Calabaza",
  "a single squash",
  ["entera", "cortada"], en="squash",
  ov={"cortada": "a single wedge of pumpkin, dense orange flesh under a hard rind with the seed hollow scraped out"},
  sorts=[
    {"es": "Calabaza cacahuete", "whole": "a single butternut squash, a smooth beige pear-shaped fruit with a long neck"},
    {"es": "Calabaza violín", "whole": "a single violin pumpkin, a large ribbed pale orange fruit with a curved neck"},
  ])
K("vegetable", "Pepino",
  "a single cucumber, a long dark green cylinder with a faintly ridged waxy skin",
  ["entero"], en="cucumber")
K("vegetable", "Cebolla",
  "a single onion, a papery-skinned bulb with a dry wisp of root at the base",
  ["entera"], en="onion",
  sorts=[
    {"es": "Cebolla blanca", "whole": "a single white onion, a round bulb in fine papery gold-white skin with a dry root wisp"},
    {"es": "Cebolla morada", "whole": "a single red onion, a round bulb in glossy deep purple papery skin"},
  ])
K("vegetable", "Cebolleta",
  "a small bunch of spring onions, slim white bulbs running up into long green tops, tied together",
  ["manojo"], en="spring onions")
K("vegetable", "Ajo",
  "a single head of garlic, a papery white bulb showing the outline of its cloves and a short cut stem",
  ["entero"], en="garlic")
K("vegetable", "Ajo tierno",
  "a small bunch of green garlic shoots, slender pale stems with long green tops, tied together",
  ["manojo"], en="green garlic")
K("vegetable", "Puerro",
  "a single leek, a long white shaft running up into flat dark blue-green leaves, with fine roots at the base",
  ["entero"], en="leek")
K("vegetable", "Zanahoria",
  "a single carrot, a smooth tapering orange root with a tuft of feathery green top",
  ["entera"], en="carrot")
K("vegetable", "Patata",
  "a single potato, an oval tuber with an earthy skin and shallow eyes",
  ["entera"], en="potato",
  sorts=[
    {"es": "Patata nueva", "whole": "a single new potato, a small round tuber with a thin flaking pale gold skin"},
    {"es": "Patata agria", "whole": "a single agria potato, a long oval tuber with a rough golden-brown skin"},
    # THE VARIETY WORD IS LEFT OUT OF THIS CLAUSE ON PURPOSE. «a single monalisa potato…» painted
    # the MONA LISA in a potato's colours, and a reviewer refused it (E197.20): the model reads
    # «monalisa» as the painting, not the tuber. A clause says what the sort LOOKS like, which is
    # the whole of what an L2 node is for, so this one names the look and never the cultivar. The
    # name still reaches the tile — `es` carries it, and the map keys on the slug's words.
    # This entry overrides the reference wing's own `S("patata", "Patata monalisa", …)` in
    # kinds_ref.py, the way `Patata agria` above already does: `S` keeps the first clause written.
    {"es": "Patata monalisa", "whole": "a single smooth round potato, a tuber with a light golden skin and very shallow eyes"},
  ])
K("vegetable", "Boniato",
  "a single sweet potato, a tapering tuber with a smooth rosy-copper skin",
  ["entero"], en="sweet potato")
K("vegetable", "Remolacha",
  "a single beetroot, a round deep crimson root with a fine tail and cut red-veined stems on top",
  ["entera"], en="beetroot")
K("vegetable", "Rábano",
  "a small bunch of radishes, round scarlet roots with white tails and green leafy tops, tied together",
  ["manojo"], en="radishes")
K("vegetable", "Apio",
  "a single head of celery, a tight bundle of pale ribbed stalks rising into green leaves",
  ["entero"], en="celery")
K("vegetable", "Hinojo",
  "a single fennel bulb, a pale layered bulb with cut stalks and a few feathery fronds on top",
  ["entero"], en="fennel")
K("vegetable", "Nabo",
  "a single turnip, a round white root washed with purple at the shoulder and a fine tail",
  ["entero"], en="turnip")
K("vegetable", "Chirivía",
  "a single parsnip, a long tapering cream root with a cut leafy crown",
  ["entera"], en="parsnip")
K("vegetable", "Maíz",
  "a single corn cob, rows of pale yellow kernels half wrapped in a green husk with a wisp of silk",
  ["entero"], en="corn")
K("vegetable", "Cardo",
  "a single bunch of cardoon stalks, long pale ribbed stems tied together",
  ["manojo"], en="cardoon")
K("vegetable", "Jengibre",
  "a single knob of ginger root, a knobbly beige rhizome with pale cut ends",
  ["entero"], en="ginger")

# ── HERB & FUNGUS ────────────────────────────────────────────────────────────────────────
K("herb-fungus", "Perejil", "a single bunch of flat-leaf parsley, bright green leaves on fine stems, tied together", ["manojo"], en="parsley")
K("herb-fungus", "Albahaca", "a single bunch of basil, broad glossy green leaves on soft stems, tied together", ["manojo"], en="basil")
K("herb-fungus", "Romero", "a single bunch of rosemary, woody stems crowded with fine needle leaves, tied together", ["manojo"], en="rosemary")
K("herb-fungus", "Tomillo", "a single bunch of thyme, wiry stems with tiny grey-green leaves, tied together", ["manojo"], en="thyme")
K("herb-fungus", "Eneldo", "a single bunch of dill, feathery blue-green fronds on slim stems, tied together", ["manojo"], en="dill")
K("herb-fungus", "Cilantro", "a single bunch of coriander, rounded lobed green leaves on pale stems, tied together", ["manojo"], en="coriander")
K("herb-fungus", "Menta", "a single bunch of mint, pairs of crinkled green leaves up square stems, tied together", ["manojo"], en="mint")
K("herb-fungus", "Laurel", "a single small bunch of bay leaves, stiff glossy dark green leaves on a woody twig", ["manojo"], en="bay")
K("herb-fungus", "Salvia", "a single bunch of sage, soft grey-green velvety leaves on pale stems, tied together", ["manojo"], en="sage")
K("herb-fungus", "Cebollino", "a single bunch of chives, straight fine dark green tubes, tied together", ["manojo"], en="chives")
K("herb-fungus", "Orégano", "a single bunch of oregano, small oval green leaves crowding fine woody stems, tied together", ["manojo"], en="oregano")
K("herb-fungus", "Champiñón",
  "a single button mushroom, a smooth round cream cap on a short thick stem",
  ["entero", "laminado"], en="button mushroom",
  ov={"laminado": "a small fan of sliced button mushrooms, pale cream slices showing the gilled underside"})
K("herb-fungus", "Boletus",
  "a single cep, a fat pale barrel of a stem under a broad glossy chestnut-brown cap",
  ["entero", "laminado"], en="cep",
  ov={"laminado": "a small fan of sliced cep, thick pale slices edged in chestnut brown"})
K("herb-fungus", "Níscalo",
  "a single saffron milk cap, a funnelled orange cap with darker concentric rings and green-bruised edges",
  ["entero"], en="saffron milk cap")
K("herb-fungus", "Seta de ostra",
  "a single cluster of oyster mushrooms, wide fan-shaped grey caps growing from one pale base",
  ["entera"], en="oyster mushrooms",
  ov={"entera": "a single cluster of oyster mushrooms, wide fan-shaped grey caps growing from one pale base"})
K("herb-fungus", "Shiitake",
  "a single shiitake mushroom, a domed tan cap with a cracked pale surface on a fibrous stem",
  ["entero"], en="shiitake")
K("herb-fungus", "Rebozuelo",
  "a single chanterelle, a golden-yellow trumpet with a wavy rippled edge and blunt ridges beneath",
  ["entero"], en="chanterelle")
K("herb-fungus", "Colmenilla",
  "a single morel, a tall honeycombed dark brown cone on a pale hollow stem",
  ["entera"], en="morel",
  ov={"entera": "a single morel, a tall honeycombed dark brown cone on a pale hollow stem"})
K("herb-fungus", "Trufa negra",
  "a single black truffle, a small knobbly coal-black sphere with a finely warted surface",
  ["entera"], en="black truffle",
  ov={"entera": "a single black truffle, a small knobbly coal-black sphere with a finely warted surface"})


# ═══ THE REFERENCE WING ══════════════════════════════════════════════════════════════════
# The 223 kinds above were hand-listed. Everything past this line is derived from the STANDARD
# REFERENCE (reference-data.ts + catalogue.ts's base tree) by the rule in reference_gate.py:
# a node earns a painting when the trade quotes it AND it looks like itself on a bench.
from kinds_ref import (add_category_faces, add_reference_kinds,  # noqa: E402
                       add_reference_sorts, add_shelf_heads)

add_reference_kinds(K)
add_reference_sorts(KINDS)
add_category_faces(K)
add_shelf_heads(K)


# ═══ EXPAND THE MATRIX ═══════════════════════════════════════════════════════════════════
WHOLE_FORMS = {"entero", "entera", "pieza", "manojo", "racimo"}


def clause_for(kind, prep, whole_clause, es_name, sort_ov=None):
    if sort_ov and prep in sort_ov:
        return sort_ov[prep]
    if prep in kind["ov"]:
        return kind["ov"][prep]
    if prep in WHOLE_FORMS:
        return whole_clause
    tpl = T.get(kind["l0"], {}).get(prep)
    if tpl:
        return tpl.format(en=kind["en"], flesh=kind["flesh"])
    raise SystemExit(f"NO CLAUSE for {es_name} / {prep}")


def prep_label(prep):
    return {"entera": "entero", "cocida": "cocido", "pelada": "pelado",
            "limpia": "limpio", "cortada": "cortado"}.get(prep, prep)


entries = []
seen = set()

for kind in KINDS:
    # the L1 node itself (no L2), for every prep it is really sold in
    nodes = [(None, kind["es"], kind["whole"], kind["preps"], None)]
    # plus each L2 sort whose LOOK differs
    for s in kind["sorts"]:
        nodes.append((slugify(s["es"]), s["es"], s["whole"], s.get("preps", kind["preps"]), s.get("ov")))

    # a kind that has look-distinct L2 sorts does not need its own generic whole painted —
    # the sorts ARE the look. It keeps its non-whole preps (they are variety-blind).
    if kind["sorts"]:
        generic_preps = [p for p in kind["preps"] if p not in WHOLE_FORMS]
        nodes[0] = (None, kind["es"], kind["whole"], generic_preps, None)

    for l2, es_name, whole_clause, preps, sort_ov in nodes:
        for prep in preps:
            label = prep_label(prep)
            slug = slugify(es_name) + ("" if label in WHOLE_FORMS else "-" + label)
            if slug in seen:
                continue
            seen.add(slug)
            clause = clause_for(kind, prep, whole_clause, es_name, sort_ov)
            entries.append({
                "slug": slug,
                "es_name": es_name if label in WHOLE_FORMS else f"{es_name} · {label}",
                "L0_family": kind["l0"],
                "L1_kind": kind["l1"],
                "L2_sort": l2,
                "L3_form": label,
                "priority": TIER[label],
                "subject_clause": clause,
                "prompt": STYLE_LOCK.format(subject=clause),
            })

entries.sort(key=lambda e: (e["priority"], e["L0_family"], e["slug"]))

out = HERE / "subjects.json"
out.write_text(json.dumps(entries, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

# ═══ THE COVERAGE REPORT ═════════════════════════════════════════════════════════════════
fams = {}
for e in entries:
    fams.setdefault(e["L0_family"], [0, 0, 0])
    fams[e["L0_family"]][e["priority"] - 1] += 1

print(f"KINDS (L1): {len(KINDS)}   L2 sorts: {sum(len(k['sorts']) for k in KINDS)}")
print(f"TOTAL PAINTINGS IN THE MATRIX: {len(entries)}\n")
print(f"{'family':<14}{'P1 anchor':>11}{'P2 prep':>10}{'P3 tail':>9}{'total':>8}")
for f in sorted(fams):
    a, b, c = fams[f]
    print(f"{f:<14}{a:>11}{b:>10}{c:>9}{a+b+c:>8}")
t = [sum(v[i] for v in fams.values()) for i in range(3)]
print(f"{'ALL':<14}{t[0]:>11}{t[1]:>10}{t[2]:>9}{sum(t):>8}")
print(f"\nwritten -> {out}")

# ═══ WHAT THE REFERENCE SAYS WE STILL OWE ════════════════════════════════════════════════
import reference_gate  # noqa: E402
cand, hit, miss = reference_gate.report(entries)
print(f"\nREFERENCE COVERAGE: {len(hit)}/{len(cand)} candidate nodes painted "
      f"({100 * len(hit) // max(1, len(cand))}%) — {len(miss)} unpainted")
