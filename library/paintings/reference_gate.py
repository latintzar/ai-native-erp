#!/usr/bin/env python3
"""THE LOOK-SPACE RULE, COMPUTED (THE-DENSE-BRIEF §C).

The first matrix was a hand-list, and a hand-list cannot answer «what are we missing?». This
module reads the STANDARD REFERENCE — reference-data.ts's 4,676 generated nodes plus catalogue.ts's
46 base nodes — and computes the set of nodes that DESERVE A PAINTING, so coverage is a measured
number rather than a feeling.

THE RULE, in one line: a node earns a painting when the trade quotes it AND it looks like itself.

    traded                 the Mercas quote it. 101 BOE fish species, 517 Merca produce rows.
                           `traded` rides as an attribute so the register stays complete and the
                           MARKET decides what gets paint (FEED-IA §52.2).
    src != 'gpc'           GS1's 879 Food/Beverage bricks are SHELVES, not looks. «Mezclas de
                           pescado y marisco» has no picture; the family mark carries it. This is
                           the «skip packaged-brand territory» rule, applied as a source test
                           rather than as 462 individual judgements.
    not REGISTER_NOISE     Mercamadrid's price sheet carries aggregate rows — «Resto», «Elaborado»,
                           «Pescado», «Cuarta gama hort.». They are line items in a price series,
                           not products on a bench. Named, so the skip is auditable.
    not LOOK_ALIAS         two official words, one picture: Centolla/Centollo, Bocarte/Boquerón,
                           Lirio/Bacaladilla, Pescadilla/Merluza. The word binds to the node in the
                           LEXICON; the picture does not fork. This IS «map the name-space».
    + every family and category node — the big faces (§35.8), keyed by their own name.
    + the AUTHORED WINGS. The Mercas are wholesale markets for fresh produce, so they quote no
      cheese, no charcuterie and no rice. Those nodes exist because RD 474/2014 art. 20.1 hands
      the sale name to «la denominación consagrada por el uso» — authored is the source, and the
      absence of a Merca quote is a fact about the market, never about the product.

Reads the .ts files directly. They are the generated truth; a parallel copy of the tree here would
be a second source waiting to drift.
"""
import re
import unicodedata
from pathlib import Path

APP = Path(__file__).resolve().parents[2] / "app" / "src" / "prototypes" / "cedar"

LEVEL = {"f": "family", "c": "category", "t": "type", "s": "sort"}
SOURCE = {"b": "boe", "m": "mercamadrid", "x": "mercabarna", "a": "authored", "p": "provacuno",
          "i": "interovic", "j": "interovic-campaign", "r": "rd4-2014", "4": "reg404",
          "2": "reg2429", "g": "gpc"}

# ── the aggregate rows a price sheet carries and a bench never shows ──────────────────────────
REGISTER_NOISE = {
    "Resto", "Elaborado", "Pescado", "Salazon", "Surtido", "Productos carnico", "Peces de rio",
    "Vario", "Vegetal", "Menestra", "Microvegetal", "Germinado", "Cuarta gama hort.",
    "Quinta gama", "Resto hortaliza", "Flores comestibl", "Coles-repollo",
    "Patas o pechos cangrejo", "Hueva",  # painted once under its own kind, not per species
    "Producto de limpieza", "Bandeja", "Bolsa", "Etiqueta", "Film", "Guante", "Papel",
    # hostelería sundries the drinks family swept up — carried, never eaten, never painted
    "Ferretería", "Limpieza", "Menaje hostelería", "Perfumería",
}

# ── THE REFERENCE NAMES A CUT BARE; A BENCH NAMES ITS SPECIES ─────────────────────────────────
# PROVACUNO's despiece calls it «Tapa», and a butcher's window calls it «Tapa de ternera» —
# because «Aguja» alone is also a fish. The painting carries the species; this map is the join,
# and writing it down is what keeps the coverage number honest.
NODE_PAINTED_AS = {
    "Aleta": "Aleta de ternera", "Babilla": "Babilla de ternera", "Brazuelo": "Brazuelo de ternera",
    "Cadera": "Cadera de ternera", "Contra": "Contra de ternera", "Espaldilla": "Espaldilla de ternera",
    "Llana": "Llana de ternera", "Pescuezo": "Pescuezo de ternera", "Pez": "Pez de ternera",
    "Tapa": "Tapa de ternera", "Tapilla": "Tapilla de ternera", "Vacío": "Vacío de ternera",
    "Careta": "Careta de cerdo", "Lagarto": "Lagarto ibérico",
    "Ñame o yame": "Ñame", "Pimienta": "Especia",
    # fish rows that are a second word for a picture already on the wall
    "San pedro": "Pez de San Pedro", "Chopito": "Choquito", "Buey": "Buey de mar",
    "Pescada": "Merluza", "Rejo": "Pulpo", "Lula": "Calamar", "Caracol": "Cañaílla",
    "Cangrejo": "Nécora", "Platusa": "Platija", "Pelaya": "Solla", "Gato": "Pintarroja",
    "Marrajo": "Cazón", "Tintorera": "Cazón", "Pancho": "Besugo", "Perro": "Pintarroja",
}

# ── quoted on a price sheet, never seen on a Spanish bench ────────────────────────────────────
# Merca rows for deep-water, bait or strictly regional species. They keep their ladder node and
# their words; what they do not get is a commissioned painting, and the family mark carries them.
TOO_RARE = {
    "Babosa", "Bobi", "Brotola", "Burro", "Cachucho", "Carioca", "Herrera", "Liba", "Magre",
    "Oblada", "Perla", "Reloj", "Sable", "Salema", "Sonso",
}

# ── two words, one picture (the lexicon forks, the look does not) ─────────────────────────────
LOOK_ALIAS = {
    "Bocarte": "Boquerón", "Anchoa": "Boquerón", "Pescadilla": "Merluza",
    "Merluza austral": "Merluza", "Lirio": "Bacaladilla", "Centolla": "Centollo",
    "Ostion": "Ostra", "Gamba": "Gamba blanca", "Camarón": "Quisquilla",
    "Camarón soldado": "Quisquilla", "Muergo": "Navaja", "Galupe": "Mujol",
    "Baila": "Lubina", "Limanda": "Platija", "Mendo": "Gallo", "Almejón": "Almeja fina",
    "Salmonete de roca": "Salmonete", "Salmonete de fango": "Salmonete",
    "Bigaros o caracolillo": "Bígaro", "Cañadilla": "Cañaílla", "Langosta verde": "Langosta",
    "Bogavantes o abacanto": "Bogavante", "Japuta": "Palometa", "Palometa roja": "Palometa",
    "Endivia": "Endibia", "Judias verd": "Judía verde", "Habas verd": "Haba",
    "Romanescu": "Romanesco", "Freson": "Fresa", "Paraguaya": "Paraguayo",
    "Papayo": "Papaya", "Papaya gigante": "Papaya", "Nuece": "Nuez", "Carlota": "Zanahoria",
    "Batata": "Boniato", "Kale": "Col rizada", "Mache": "Canónigos", "Ocra": "Okra",
    "Fisali": "Physalis", "Kunkuat": "Kumquat", "Guayabo": "Guayaba", "Manga": "Mango",
    "Mangostan": "Mangostán", "Pitahaya": "Pitahaya", "Rambutan": "Rambután",
    "Piña baby": "Piña", "Pereta": "Pera", "Pero": "Manzana", "Fresquilla": "Melocotón",
    "Pavia": "Melocotón", "Alpicoce": "Pepino", "Tabella": "Haba", "Rabanilla": "Rábano",
    "Eddo": "Ñame", "Parchita": "Maracuyá", "Bellota": "Castaña", "Nashi": "Nashi",
    "Poularda": "Pularda", "Carrillera": "Carrillera de cerdo", "Panceta": "Panceta de cerdo",
    "Papada": "Papada de cerdo", "Abanico": "Abanico ibérico", "Pluma": "Presa ibérica",
    "Presa": "Presa ibérica", "Secreto": "Secreto ibérico", "Codillo": "Codillo de cerdo",
    "Manitas": "Manitas de cerdo", "Aguja": "Aguja de ternera", "Falda": "Falda de ternera",
    "Costillar": "Costillar de ternera", "Morcillo": "Morcillo de ternera",
    "Rabo": "Rabo de toro", "Redondo": "Redondo de ternera", "Solomillo": "Solomillo de ternera",
    "Lomo alto": "Lomo alto de ternera", "Lomo bajo": "Lomo bajo de ternera",
    "Carne picada": "Picada ternera", "Carne picada de cerdo": "Picada cerdo",
    "Cerdo marino": "Cerdo", "Jamón": "Jamón serrano", "Paleta": "Paleta serrana",
    "Lomo ibérico": "Lomo embuchado", "Cecina de León": "Cecina",
    "Callos cocinados": "Callos", "Carrillera guisada": "Carrillera de ternera",
    "Casquería de cordero": "Tripas y grasas", "Medallones de cordero": "Pierna de cordero",
    "Tournedó de cordero": "Pierna de cordero", "Lomo de conejo": "Conejo",
    "Paletilla de conejo": "Conejo", "Chuletero de cerdo": "Chuletero de cerdo",
    "Queso de untar": "Queso crema", "Sustituto de carne": None, "Subproducto lácteo": None,
}

# ── DOP/IGP rows: a protected origin is a word and a price, never a different picture ─────────
_DOP = re.compile(r"^(Chorizo|Morcilla|Salchichón|Jamón|Paleta|Sobrasada|Butifarra|Queso|Cecina)"
                  r" (de |del |riojano|ibéric|serran)", re.I)


def fold(s):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKD", s or "")
                  .encode("ascii", "ignore").decode().lower()).strip()


def load_tree():
    txt = (APP / "reference-data.ts").read_text(encoding="utf-8")
    block = txt.split("const NODES = `", 1)[1].split("`;", 1)[0]
    nodes = {}
    for line in block.split("\n"):
        if not line.strip():
            continue
        f = (line.split("|") + [""] * 7)[:7]
        nodes[f[0]] = dict(id=f[0], name=f[1], level=LEVEL[f[2]], parent=f[3] or None,
                           src=SOURCE.get(f[4], f[4]), traded="t" in f[5])
    cat = (APP / "catalogue.ts").read_text(encoding="utf-8")
    base = cat.split("const BASE_TREE: TreeNode[] = [", 1)[1].split("\n];", 1)[0]
    for m in re.finditer(r"\{ id: '([^']+)', name: '([^']+)', level: '([^']+)'"
                         r"(?:, parent: '([^']+)')? \}", base):
        i, n, l, p = m.groups()
        nodes[i] = dict(id=i, name=n, level=l, parent=p, src="base", traded=False)
    return nodes


def candidates(nodes):
    """The nodes that OWE a painting, computed. Returns {id: node}.

    L2 IS NAME-SPACE AND IT IS NOT A GAP (§C). The reference carries 586 apple cultivars, 165
    pears, 43 potatoes and 19 table grapes because every one is a word a house may type. None of
    them owes a picture: `paintingFor` walks up to the kind, so «Manzana starking argentin»
    already has a face — its kind's. A sort earns paint only where the variety CHANGES the
    picture, and those are the ~66 authored in kinds_ref.add_reference_sorts. So sorts are
    excluded from the debt here and audited separately by `orphan_sorts` — a sort is only a
    problem when its KIND is unpainted, which is a hole one rung up.
    """
    out = {}
    for n in nodes.values():
        if n["level"] in ("family", "category"):
            if n["src"] == "gpc":
                continue                           # a GPC brick promoted to a shelf is still a shelf
            out[n["id"]] = n                       # the big faces (§35.8)
            continue
        if n["level"] == "sort":
            continue                               # name-space: resolved by the kind above it
        if n["src"] == "gpc":
            continue                               # a shelf, not a look
        if n["name"] in REGISTER_NOISE:
            continue
        if n["name"] in LOOK_ALIAS or n["name"] in TOO_RARE:
            continue
        if _DOP.match(n["name"]):
            continue                               # a protected origin is a word, not a picture
        if n["traded"] or n["src"] in ("authored", "provacuno", "interovic"):
            out[n["id"]] = n
    return out


def orphan_sorts(nodes, painted):
    """Sorts whose KIND is unpainted too — the only sorts that are really uncovered."""
    out = []
    for n in nodes.values():
        if n["level"] != "sort" or n["src"] == "gpc":
            continue
        p = nodes.get(n["parent"] or "")
        if p and p["level"] in ("type", "sort") and fold(p["name"]) not in painted:
            out.append(n)
    return out


def report(matrix_entries):
    """matrix_entries: the built subjects list. Prints the coverage the rule measures."""
    nodes = load_tree()
    cand = candidates(nodes)
    painted = set()
    for e in matrix_entries:
        painted.add(fold(e["es_name"].split(" · ")[0]))
        painted.add(fold(e["L1_kind"].replace("-", " ")))
    hit = {i: n for i, n in cand.items()
           if fold(n["name"]) in painted or fold(NODE_PAINTED_AS.get(n["name"], "")) in painted}
    miss = {i: n for i, n in cand.items() if i not in hit}
    return cand, hit, miss


if __name__ == "__main__":
    import json
    subs = json.loads((Path(__file__).resolve().parent / "subjects.json").read_text())
    cand, hit, miss = report(subs)
    print(f"reference candidates: {len(cand)}   painted: {len(hit)}   unpainted: {len(miss)}")
    by = {}
    for n in miss.values():
        by.setdefault(n["src"], []).append(n["name"])
    for s in sorted(by):
        print(f"\n  {s} ({len(by[s])}): " + " · ".join(sorted(by[s])[:400]))
