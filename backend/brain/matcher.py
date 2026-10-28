"""Mention -> formal SKU matching (the grounding step).

Pipeline per mention (Register #17, RUNTIME L1/L2/match):
  1. alias fast-path  — exact normalized alias (customer-scoped first, then global), tried on
                        CALIBRE-PRESERVING forms first
  1b. calibre check   — the number the customer said, reconciled against the tenant's own catalogue
  2. dense            — pgvector cosine over catalogue embeddings (top-k)
  3. sparse           — Postgres FTS over search_text (top-k)
  4. rerank           — bge cross-encoder over the union (the precision lift)
  5. calibre promote  — the catalogue outranks the reranker WITHIN a family told apart by a number
  6. unit/pack check  — flag count-vs-weight / variable-weight mismatches
  7. gate             — absolute floor (abstain -> not in catalogue) + top1-top2 margin (tight -> note)
                        + how many rows are indistinguishable from the pick (`n_close`)

Retrieval recall is the #1 risk (a missed SKU can't be reranked back), so we cast a wide net
(alias ∪ dense-k ∪ sparse-k) before reranking, and abstain on a low *absolute* score rather than
forcing a pick. Returns candidates + best guess + the hard signals the decision agent gates on.
"""
from __future__ import annotations

import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

import config
import db
from brain import embed, rerank

# Gate thresholds — calibrated on real numbers (tests/diag_scores.py). The cross-encoder RANKS
# well (recall@3 = 100%) but its ABSOLUTE score is unreliable: a correct pick can score ~0 and is
# then indistinguishable from a true negative. So instead of a binary abstain we map to the
# register's three confidence bands. Dense cosine does NOT separate in-vs-out-of-catalogue (all
# meat clusters ~0.5-0.8), so it is diagnostic only, never a gate.
RERANK_CLEAR = 0.45    # rerank >= this (or alias hit) => fill clean
RERANK_UNSURE = 0.15   # rerank <  this => genuinely unsure: fill best guess but flag (possible new SKU)
MARGIN_TIGHT = 0.12    # top1-top2 rerank gap below this => "could also be <runner-up>" note
DENSE_K = 10
SPARSE_K = 10

# Generic qualifiers stripped on a secondary alias attempt (code-switch: "chuletas de cerdo"
# -> "chuletas"). Kept conservative — only species/filler words, never product-distinguishing ones.
_GENERIC = {"de", "del", "la", "el", "los", "las", "cerdo", "puerco", "pork", "of"}

_UNIT_WORDS = {
    "kg", "kilo", "kilos", "kgs", "k", "g", "gram", "grams", "gr",
    "unit", "units", "ud", "uds", "u", "piece", "pieces", "pcs", "pc",
    "pack", "packs", "case", "cases", "box", "boxes", "bag", "bags",
    "ring", "rings", "tray", "trays", "of",
}


def normalize(s: str) -> str:
    """Lower, strip accents, drop punctuation, collapse whitespace."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def strip_qty(s: str) -> str:
    """Drop EVERY bare number and unit word, wherever it sits: '5 kg of pork belly' -> 'pork belly'.

    ⚠️ THIS DESTROYS THE CALIBRE, and that was a real, measured order defect (2026-07-27):
    «SALCHICHÓN VELA 55» → «salchichon vela» → the alias table's 40 MM row, band=clean, score 1.0,
    no note, no question. See `split_qty` below for what replaced it. Kept, because a mention whose
    number really was a stray count still deserves one last attempt at an alias, but it is now the
    LAST attempt rather than the second — a form that dropped a dimension may never outrank one that
    kept it.
    """
    n = normalize(s)
    toks = [t for t in n.split() if not (t.isdigit() or t in _UNIT_WORDS)]
    return " ".join(toks) if toks else n


# ── THE NUMBER IS USUALLY THE CALIBRE, NOT THE COUNT (PRODUCT-SPEC §5.7) ─────────────────────────
# "⚠️ CALIBRE IS THE HIDDEN DIMENSION. The ambiguity is usually NOT the product — it is the calibre /
# format / pack." A matcher that throws every digit away as a quantity cannot see the common case at
# all; it silently answers a different question ("which product?") and gets the right product at the
# wrong calibre, which is a WRONG ORDER, not a near miss.
#
# The rule is POSITIONAL, because Spanish order-speak is positional:
#   * a number at the HEAD, before a unit or before the product, is a QUANTITY —
#     «10 kg de chorizo» · «20 sartas de chorizo» · «8 kg de chorizo fresco»
#   * a number that TRAILS the product, or follows «de»/«del»/«calibre»/«nº», QUALIFIES it and must
#     survive into the match — «salchichón vela 55» · «salchichón del 55» · «fuet de 170» · «del 26»
# So `split_qty` consumes only the LEADING run — numbers, unit words, and the connectors that glue a
# quantity to its product — and stops dead at the first content word. Everything from there on is the
# product, digits included.
#
# «de»/«del» are connectors ONLY inside that leading run. In «fuet de 170» the run is empty (it stops
# at «fuet»), so that «de» is never touched and the 170 is kept — position does the disambiguation, no
# second word list required.
_CONNECTORS = {"de", "del", "of"}


def split_qty(s: str) -> Tuple[List[str], List[str]]:
    """(leading quantity tokens, product tokens). Only the LEADING run is a quantity."""
    toks = normalize(s).split()
    i = 0
    while i < len(toks) and (toks[i].isdigit() or toks[i] in _UNIT_WORDS or toks[i] in _CONNECTORS):
        i += 1
    if i >= len(toks):
        # the whole mention was numbers/units/connectors («55», «del 55», «2 kg»): there is no product
        # to separate it from, so nothing is a quantity here and the mention stands as written.
        return [], toks
    return toks[:i], toks[i:]


def item_form(s: str) -> str:
    """The mention with its leading quantity removed and its CALIBRE intact.

    This is the form the alias table, the encoder, the FTS query and the reranker all see first.
    """
    return " ".join(split_qty(s)[1])


def dims_of(s: str) -> Set[str]:
    """The numbers that QUALIFY the product — i.e. every number that survived `split_qty`.

    Note this is only a candidate set. Whether any of them actually means a calibre is decided by the
    tenant's own catalogue (`dimension_index`), never by this function.
    """
    return {t for t in split_qty(s)[1] if t.isdigit()}


def strip_generic(s: str) -> str:
    """Drop generic species/filler qualifiers for a secondary alias attempt
    ('chuletas de cerdo' -> 'chuletas'). Never removes product-distinguishing words."""
    toks = [t for t in normalize(s).split() if t not in _GENERIC]
    return " ".join(toks)


# ── THE CATALOGUE IS THE EVIDENCE (preferred over any hand-written rule) ─────────────────────────
# We do not decide that "55 is a calibre" from a list we wrote. We ask THIS tenant's catalogue: are
# there rows that differ ONLY by a number once unit words are set aside? On the Madrid charcuterie
# catalogue that is exactly four families and they are exactly the ones §5.7 is about:
#     SALCHICHÓN VELA 40 MM / 55 MM · FUET EXTRA 170 G / 500 G
#     POLLO ENTERO 1,2 KG / 1,8 KG   · CHORIZO SARTA EXTRA 500 G / 1 KG
# Where the catalogue gives no such evidence — a single row, or siblings separated by a WORD
# (PIEZA vs LONCHEADO, BURGOS vs CEBOLLA) — a number in the mention decides nothing and the previous
# behaviour stands untouched. That is what keeps this from being a rule that fires everywhere: a fish
# wholesaler's calibres are not a charcutero's, and neither of them should have to teach us theirs.
#
# The stem drops unit words as well as digits, so «FUET EXTRA 170 G» and «FUET EXTRA 500 G» are one
# family while «CHORIZO SARTA EXTRA 1 KG» and «CHORIZO SARTA EXTRA 500 G» — which would otherwise be
# split apart by KG vs G — are too.
DIM_INDEX_TTL = 120.0    # seconds. A catalogue edit is rare; two minutes of staleness on a calibre
                         # index costs nothing, and the alternative is a count(*) on every mention.
_DIM_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _stem_and_nums(name: str) -> Tuple[str, Tuple[str, ...]]:
    toks = normalize(name).split()
    nums = tuple(t for t in toks if t.isdigit())
    stem = " ".join(t for t in toks if not t.isdigit() and t not in _UNIT_WORDS)
    return stem, nums


def build_dimension_index(rows) -> Dict[str, Any]:
    """Pure half of `dimension_index` — rows in, index out, so it is testable with no database."""
    fams: Dict[str, List[Tuple[str, Tuple[str, ...]]]] = {}
    by_sku: Dict[str, Tuple[str, Tuple[str, ...]]] = {}
    for r in rows:
        stem, nums = _stem_and_nums(r["name"] or "")
        if not stem:
            continue
        by_sku[r["id"]] = (stem, nums)
        fams.setdefault(stem, []).append((r["id"], nums))
    dimensioned = {stem for stem, members in fams.items()
                   if len(members) >= 2 and len({n for _, n in members}) >= 2}
    return {"by_sku": by_sku, "families": fams, "dimensioned": dimensioned}


async def dimension_index(con, tenant: str) -> Dict[str, Any]:
    """Which of this tenant's product families are told apart by a NUMBER? Cached per tenant."""
    now = time.monotonic()
    hit = _DIM_CACHE.get(tenant)
    if hit and (now - hit[0]) < DIM_INDEX_TTL:
        return hit[1]
    rows = await con.fetch("select id, name from catalogue_skus where tenant_id=$1", tenant)
    idx = build_dimension_index(rows)
    _DIM_CACHE[tenant] = (now, idx)
    return idx


# ── STAGE 0: the tenant's own CODES (§17.35) ─────────────────────────────────────────────────
# A code is a row in THIS tenant's catalogue, not a regex we invent — the calibre-law discipline.
# An exact code is an IDENTITY and beats any fuzzy name match; a code-shaped token that is not in
# the list abstains loudly (the honest-gap law doing real work on a mistyped code).
_CODE_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_UNIT_WORDS = {"kg", "kilo", "kilos", "g", "gr", "gramo", "gramos", "caja", "cajas", "ud", "uds",
               "unidad", "unidades", "litro", "litros", "l", "ml", "docena", "docenas", "pieza",
               "piezas", "bandeja", "bandejas", "bolsa", "bolsas", "paquete", "paquetes"}
_CODE_FRAMES = {"codigo", "ref", "referencia", "art", "articulo", "numero", "sku"}


def build_code_index(rows) -> Dict[str, Any]:
    """Pure half of `code_index` — rows in, index out (the `build_dimension_index` precedent)."""
    by_code: Dict[str, str] = {}
    lengths: Dict[int, int] = {}
    numeric_total = 0
    for r in rows:
        c = normalize(str(r["code"] or ""))
        if not c:
            continue
        flat = c.replace(" ", "").replace("-", "").replace(".", "").replace("/", "")
        if flat.isdigit():
            numeric_total += 1
            lengths[len(flat)] = lengths.get(len(flat), 0) + 1
        for k in (c, flat):
            if k and k not in by_code:            # first owner keeps the form — never steal
                by_code[k] = r["id"]
    return {"by_code": by_code, "has_codes": bool(by_code),
            # a bare numeric token is «code-shaped» only when ≥50% of the tenant's NUMERIC codes
            # share its length, and only at ≥4 digits (0e: «12» is a number, not a product)
            "numeric_lengths": {n for n, cnt in lengths.items()
                                if numeric_total and cnt / numeric_total >= 0.5 and n >= 4}}


async def code_index(con, tenant: str) -> Dict[str, Any]:
    now = time.monotonic()
    hit = _CODE_CACHE.get(tenant)
    if hit and (now - hit[0]) < DIM_INDEX_TTL:
        return hit[1]
    rows = await con.fetch(
        "select id, code from catalogue_skus where tenant_id=$1 and code is not null", tenant)
    idx = build_code_index(rows)
    _CODE_CACHE[tenant] = (now, idx)
    return idx


def code_scan(idx: Dict[str, Any], mention: str) -> Tuple[str, Optional[str], str]:
    """('hit', sku_id, token) | ('abstain', None, token) | ('none', None, '').
    0a exact wins · 0d code-shaped-but-unknown abstains loudly · 0e short numerics only when a
    framing word names them («el código 12») · a numeric followed by a unit word is a QUANTITY."""
    if not idx.get("has_codes"):
        return ("none", None, "")
    toks = normalize(mention).split()
    for i, t in enumerate(toks):
        flat = t.replace("-", "").replace(".", "").replace("/", "")
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        framed = i > 0 and toks[i - 1] in _CODE_FRAMES
        if flat.isdigit():
            if nxt in _UNIT_WORDS and not framed:
                continue                           # «1500 gramos» told us a quantity
            if len(flat) < 4 and not framed:
                continue                           # 0e
        elif not any(ch.isdigit() for ch in flat):
            continue                               # pure words belong to the name path
        sku = idx["by_code"].get(t) or idx["by_code"].get(flat)
        if sku:
            return ("hit", sku, t)
        if framed or (flat.isdigit() and len(flat) in idx["numeric_lengths"]):
            return ("abstain", None, t)            # 0d
    return ("none", None, "")


def _singular(t: str) -> str:
    """Crudest possible Spanish plural strip: velas->vela, fuets->fuet, sartas->sarta.

    A LANGUAGE rule, not a product rule, used for exactly one comparison — does this mention carry
    any word beyond the family's shared vocabulary? Over-stripping there costs a question we would
    otherwise not have asked; it can never pick a SKU.
    """
    if len(t) > 4 and t.endswith("es"):
        return t[:-2]
    if len(t) > 3 and t.endswith("s"):
        return t[:-1]
    return t


def named_nothing(index: Dict[str, Any], sku_id: str, item: str) -> bool:
    """Did the customer say ANYTHING that tells this family's members apart?

    «velas» against SALCHICHON VELA 40 MM / 55 MM carries nothing but the family's own shared words,
    so no calibre was ever chosen — and a score gap between those two rows is the reranker being
    confident about the PRODUCT, which was never in doubt. «fuets de los pequenos» carries «pequenos»
    and «salchichon del 55» carries «55»: those DID choose, and must not be asked again.
    The family's shared vocabulary IS its stem — by construction, the tokens every member has.
    """
    ent = (index.get("by_sku") or {}).get(sku_id)
    if not ent:
        return False
    stem, _ = ent
    if stem not in (index.get("dimensioned") or set()):
        return False
    shared = {_singular(t) for t in stem.split()}
    said = {_singular(t) for t in item.split()
            if t not in _GENERIC and t not in _UNIT_WORDS and t not in _CONNECTORS}
    return not (said - shared)


def reconcile_dimension(index: Dict[str, Any], sku_id: Optional[str],
                        dims: Set[str]) -> Tuple[Optional[str], str]:
    """Does `sku_id` still hold once the calibre the customer named is taken seriously?

    Returns (sku_id, why):
      * (same id, "")        — no calibre in the mention, or no catalogue evidence that numbers
                               separate this family. Nothing to reconcile; the hit stands.
      * (sibling id, "…")    — exactly ONE row in the family carries that calibre. The catalogue
                               resolved it, deterministically, and there is nothing to ask.
      * (None, "…")          — several siblings carry it, or none does. This is NOT a resolution:
                               drop the hit and let retrieval + the doubt faculty see the mention, so
                               it can become the two-option question §5.7 wants instead of a silent
                               guess at a calibre.
    """
    if not sku_id or not dims:
        return sku_id, ""
    ent = (index.get("by_sku") or {}).get(sku_id)
    if not ent:
        return sku_id, ""
    stem, _nums = ent
    if stem not in (index.get("dimensioned") or set()):
        return sku_id, ""
    fam = (index.get("families") or {}).get(stem) or []
    hits = [sid for sid, ns in fam if dims <= set(ns)]
    if len(hits) == 1:
        return hits[0], ("calibre" if hits[0] != sku_id else "")
    if len(hits) > 1:
        return None, f"calibre {'/'.join(sorted(dims))} encaja en {len(hits)} filas de la familia"
    return None, f"calibre {'/'.join(sorted(dims))} que esta familia no lleva"


@dataclass
class MatchResult:
    mention: str
    normalized: str
    candidates: List[Dict[str, Any]] = field(default_factory=list)  # [{sku_id,name,score,method,...}]
    pick: Optional[Dict[str, Any]] = None        # best guess (may be set even when abstaining)
    pick_score: float = 0.0
    runner_up: Optional[Dict[str, Any]] = None
    margin: float = 1.0
    alias_hit: bool = False
    method: str = "none"                          # code | alias | rerank | dense | sparse | none
    band: str = "unsure"                          # clean | note | unsure (register's 3 attention levels)
    abstain: bool = False                         # True (== band 'unsure') => flag, possible new SKU
    tight: bool = False                           # True => margin tight, name the runner-up
    n_close: int = 1                              # rows INDISTINGUISHABLE from the pick (within
                                                  # MARGIN_TIGHT). >2 means no honest 2-way question
                                                  # exists — §5.7a's 3-button law. Counted over the
                                                  # FULL pool, which is why it lives here and is not
                                                  # re-derived downstream from a truncated top-5.
    dims: List[str] = field(default_factory=list)  # the calibre(s) the mention carried, if any
    dim_note: str = ""                            # why the calibre changed / could not decide the pick
    unit_ok: bool = True
    unit_note: str = ""

    def as_dict(self) -> Dict[str, Any]:
        return {
            "mention": self.mention,
            "pick": self.pick,
            "pick_score": round(self.pick_score, 4),
            "runner_up": self.runner_up,
            "margin": round(self.margin, 4),
            "alias_hit": self.alias_hit,
            "method": self.method,
            "band": self.band,
            "abstain": self.abstain,
            "tight": self.tight,
            "n_close": self.n_close,
            "dims": self.dims,
            "dim_note": self.dim_note,
            "unit_ok": self.unit_ok,
            "unit_note": self.unit_note,
            "candidates": self.candidates[:5],
        }


def _unit_check(sku: Dict[str, Any], unit_hint: Optional[str], qty: Optional[float]) -> (bool, str):
    """Flag count-vs-weight and variable-weight situations. Never converts silently."""
    base = (sku.get("base_unit") or "kg").lower()
    pf = sku.get("pack_factor") or 1
    uh = normalize(unit_hint or "")
    # ⚠️ THIS VOCABULARY IS SPANISH OR IT IS NOTHING (2026-08-19). It was English-only —
    # {unit, units, ud, uds, piece, pieces, pcs, pc, u} — so «2 CAJAS de lubina» matched no count
    # word, `_unit_check` returned clean, and a 120 € case was filed, printed and exported as 24 €.
    # `_UNIT_WORDS` twenty lines up has carried caja/pieza/docena/bandeja the whole time; this
    # function simply never looked at it. The same blind spot silently disabled the STOCK check,
    # which skips any line whose unit differs from the level's.
    weight_words = {"kg", "kilo", "kilos", "kgs", "g", "gr", "gram", "grams", "gramo", "gramos"}
    count_words = {"unit", "units", "ud", "uds", "piece", "pieces", "pcs", "pc", "u",
                   "unidad", "unidades", "pieza", "piezas",
                   "caja", "cajas", "docena", "docenas", "bandeja", "bandejas",
                   "bolsa", "bolsas", "paquete", "paquetes"}
    if base == "unit":
        if uh in weight_words:
            return False, f"sold by unit (pack of {int(pf)}) — ordered in {uh}, check count vs weight"
        return True, (f"pack of {int(pf)}" if pf and pf > 1 else "")
    if base in ("pack", "case"):
        if uh in weight_words:
            return False, f"sold by {base} — ordered in {uh}"
        return True, ""
    # base is weight (kg)
    note = ""
    if uh in count_words:
        # NAME THE ARITHMETIC. «confirm weight» tells her to check something; this tells her WHAT:
        # a case is `pack_factor` kilos, so «2 cajas» is 2 × pf, and nothing in this product
        # multiplies that for her yet (VENTAS-COVERAGE.md §1.2). Until it does, the honest
        # behaviour is to hold the line rather than file a number that is wrong by a factor.
        if pf and pf > 1:
            return False, (f"se pide en {uh} y se cobra por kg — {int(pf)} kg por {uh}, "
                           f"confirma los kilos")
        return False, f"priced by kg — ordered as {uh}, confirm weight"
    if sku.get("variable_weight"):
        note = "variable weight — exact kg confirmed at dispatch"
    return True, note


async def qualified_siblings(con, tenant: str, mention_norm: str,
                             pick_id: str) -> List[Dict[str, Any]]:
    """Catalogue rows whose name is the mention PLUS a qualifier — «Mango» → «Mango avión».

    THE BARE NAME THAT IS ALSO A STEM (Peter, 2026-08-13, mid-demo: «the order we demoed was for
    mango, but it didnt ask which one. because there was a direct hit to just MANGO. it has to
    know, especially cos its fruit»).

    This is rule 5b's shape — «the calibre nobody named» — one level up from calibres and applied
    to the NAME. When a customer says «mango» and the catalogue carries both `Mango` and `Mango
    avión`, the exact row scores ~1.0 and wins on margin, so every confidence signal we have says
    resolved. None of them is measuring the right thing: the gap is confidence that they said the
    word «mango», which was never in doubt. What is in doubt is which mango, and the mention
    carries nothing that answers it.

    Produce is where this bites hardest, because the qualifier IS the product — variety, origin,
    calibre by another name — and a bare «mango» is what people actually write. Resolving it
    silently puts a variety the customer never chose onto a real order.

    THE ASYMMETRY IS DELIBERATE: `Mango avión` → `Mango` is NOT ambiguous. Saying more than the
    catalogue needs still names one row; saying less than it needs names several. So this only
    fires when the mention is the SHORTER string and a whole word boundary follows it — `mango `
    matches «Mango avión» and never «Mangostán», which is a different fruit.
    """
    if not mention_norm:
        return []
    # THE COMPARISON HAPPENS IN PYTHON, on `normalize` — the same function the aliases and the
    # index were built with, so this cannot disagree with them. A SQL `like` was the obvious
    # narrowing filter and is wrong here: it would need `unaccent`, which this database does not
    # have installed, and without it «platano» (what `normalize` yields) never matches «Plátano
    # canario». Pulling the assortment and filtering in memory is a few hundred short rows for a
    # real catalogue, on a path that already awaited an embedding call.
    rows = await con.fetch(
        """select id, code, name, family, base_unit, pack_factor, variable_weight, price,
                  in_assortment
             from catalogue_skus
            where tenant_id = $1 and in_assortment and id <> $2""",
        tenant, pick_id)
    stem = mention_norm + " "
    return [dict(r) for r in rows if normalize(r["name"]).startswith(stem)]


async def _alias_lookup(con, norm: str, phone: Optional[str], tenant: str) -> Optional[str]:
    if not norm:
        return None
    # customer-scoped alias wins over global
    row = await con.fetchrow(
        """select sku_id from sku_aliases
             where tenant_id=$1 and alias=$2 and (phone_number=$3 or phone_number is null)
             order by (phone_number is not null) desc, weight desc limit 1""",
        tenant, norm, phone,
    )
    return row["sku_id"] if row else None


async def _fetch_sku(con, sku_id: str, tenant: str) -> Optional[Dict[str, Any]]:
    # `code` = the SUPPLIER'S OWN article code (WP-3 "their codes"). Carried as a SEPARATE field all
    # the way to the Excel `codigo` column — NEVER written over sku_id/id (the internal id chain that
    # aliases + accept-rules key on, eng F6).
    row = await con.fetchrow(
        """select id, code, name, family, base_unit, pack_factor::float8 as pack_factor,
                  variable_weight, price::float8 as price, in_assortment,
                  coalesce(attrs->>'doc', name) as doc
             from catalogue_skus where id=$1 and tenant_id=$2""",
        sku_id, tenant,
    )
    return dict(row) if row else None


async def dense_search(con, qvec: List[float], tenant: str, k: int = DENSE_K):
    """Stage 2 in one place: pgvector cosine over the catalogue embeddings.

    Factored out of `match()` (which is its only production caller) so the retrieval eval can
    measure the ENCODER's own recall — dense with no alias fast-path, no FTS union and no reranker
    on top — through the exact query production runs, instead of a copy that can drift from it.
    """
    return await con.fetch(
        """select id, code, name, family, base_unit, pack_factor::float8 as pack_factor,
                  variable_weight, price::float8 as price, in_assortment,
                  coalesce(attrs->>'doc', name) as doc,
                  1 - (embedding <=> $1) as score
             from catalogue_skus
             where tenant_id=$2 and embedding is not null
             order by embedding <=> $1 limit $3""",
        qvec, tenant, k,
    )


async def match(
    mention: str,
    *,
    phone: Optional[str] = None,
    unit_hint: Optional[str] = None,
    qty: Optional[float] = None,
    tenant: Optional[str] = None,
    k: int = DENSE_K,
) -> MatchResult:
    tenant = tenant or config.BRAIN_TENANT
    norm = normalize(mention)
    # THE CALIBRE-PRESERVING FORM is the primary one; `strip_qty`'s calibre-destroying form survives
    # only as the LAST alias attempt (see `strip_qty`'s docstring for the order it was written wrong).
    norm_item = item_form(mention)
    norm_bare = strip_qty(mention)
    dims = dims_of(mention)
    res = MatchResult(mention=mention, normalized=norm, dims=sorted(dims))
    pool = db.get_pool()

    async with pool.acquire() as con:
        dim_idx = await dimension_index(con, tenant)

        # 0) STAGE 0 — EXACT CODE (§17.35): before the alias table, before everything.
        code_idx = await code_index(con, tenant)
        ckind, csku, ctok = code_scan(code_idx, mention)
        if ckind == "abstain":
            res.band = "unsure"
            res.abstain = True
            res.method = "code"
            res.dim_note = "código «" + ctok + "» no está en tu lista"
            return res
        if ckind == "hit":
            sku0 = await _fetch_sku(con, csku, tenant)
            if sku0:
                # 0c: a name in the same mention resolving to a DIFFERENT sku is a conflict → review,
                # never a silent preference; the customer who quoted a code believes they were clear.
                rem = " ".join(w for w in norm.split() if w != ctok and w not in _CODE_FRAMES)
                rem = strip_qty(rem) or rem
                other = await _alias_lookup(con, rem, phone, tenant) if rem else None
                if other and other != csku:
                    osku = await _fetch_sku(con, other, tenant)
                    res.band = "unsure"
                    res.abstain = True
                    res.method = "code"
                    res.dim_note = "conflicto código/nombre"
                    res.candidates = [{**sku0, "sku_id": sku0["id"], "score": 1.0, "method": "code"}]
                    if osku:
                        res.candidates.append({**osku, "sku_id": osku["id"], "score": 1.0, "method": "alias"})
                    return res
                res.method = "code"
                res.band = "clean"
                res.pick = {**sku0, "sku_id": sku0["id"]}
                res.pick_score = 1.0
                res.margin = 1.0
                res.n_close = 1
                res.candidates = [{**sku0, "sku_id": sku0["id"], "score": 1.0, "method": "code"}]
                res.unit_ok, res.unit_note = _unit_check(sku0, unit_hint, qty)
                if not res.unit_ok:
                    res.band = "note"
                return res

        # 1) alias fast-path, in CALIBRE-PRESERVING ORDER. Every form that keeps the number is tried
        # before any form that drops it, so a mention carrying its calibre can never silently resolve
        # to a sibling that does not.
        #   norm       — «salchichon vela 55 mm»
        #   norm_item  — leading quantity gone, calibre intact: «8 kg de chorizo fresco» -> «chorizo
        #                fresco». That arm is the §5.7a regression fix: `strip_qty`'s word list is
        #                English-first ("of" is in it, «de» is not), so the old code reduced that line
        #                to «de chorizo fresco» and MISSED the learned alias, while the same line
        #                resolved cleanly when the customer left the quantity off.
        #   +generic   — code-switch filler («chuletas de cerdo» -> «chuletas»)
        #   norm_bare  — LAST: every digit dropped, wherever it sat. A hit here is not trusted on its
        #                own; `reconcile_dimension` below re-checks it against the calibre.
        forms = [norm, norm_item, strip_generic(norm), strip_generic(norm_item),
                 norm_bare, strip_generic(norm_bare)]
        seen: set = set()
        sku_id = None
        for f in forms:
            if not f or f in seen:
                continue
            seen.add(f)
            sku_id = await _alias_lookup(con, f, phone, tenant)
            if sku_id:
                break

        # 1b) THE CALIBRE CHECK. An alias that was reached by dropping the customer's number, or one
        # that simply names the family, must still agree with the calibre they said. The catalogue —
        # not a rule we wrote — decides (see `reconcile_dimension`).
        if sku_id:
            fixed, why = reconcile_dimension(dim_idx, sku_id, dims)
            res.dim_note = why
            if fixed is None:
                sku_id = None      # genuinely ambiguous / unstocked calibre -> retrieval + doubt
            elif fixed != sku_id:
                sku_id = fixed     # the catalogue resolved it: same family, the calibre they named

        if sku_id:
            sku = await _fetch_sku(con, sku_id, tenant)
            if sku:
                # A BARE NAME WITH QUALIFIED SIBLINGS IS NOT AN ALIAS HIT. Checked BEFORE
                # `alias_hit` is set, because `doubt.classify_line` returns silence on `alias_hit`
                # as its very first branch — an alias that resolves «mango» to one of two mangos
                # would never reach the question this whole rule exists to ask.
                sibs = await qualified_siblings(con, tenant, normalize(norm_item or norm), sku["id"])
                if sibs:
                    res.method = "alias→qualifier"
                    res.dim_note = "variedad sin nombrar"
                    res.tight = True
                    res.band = "note"
                    res.pick = {**sku, "sku_id": sku["id"]}
                    res.pick_score = 1.0
                    res.margin = 0.0
                    res.candidates = ([{**sku, "sku_id": sku["id"], "score": 1.0,
                                        "method": res.method}]
                                      + [{**s, "sku_id": s["id"], "score": 0.99,
                                          "method": res.method} for s in sibs])
                    res.n_close = len(res.candidates)
                    res.runner_up = res.candidates[1]
                    res.unit_ok, res.unit_note = _unit_check(sku, unit_hint, qty)
                    return res
                res.alias_hit = True
                res.method = "alias+calibre" if res.dim_note == "calibre" else "alias"
                res.band = "clean"
                res.pick = {**sku, "sku_id": sku["id"]}
                res.pick_score = 1.0
                res.margin = 1.0
                res.n_close = 1
                res.candidates = [{**sku, "sku_id": sku["id"], "score": 1.0, "method": res.method}]
                res.unit_ok, res.unit_note = _unit_check(sku, unit_hint, qty)
                if not res.unit_ok:
                    res.band = "note"
                return res

        # 2) dense (pgvector cosine) — on the calibre-preserving form, so «55» reaches the encoder
        qvec = await embed.aembed_query(norm_item or norm or mention)
        dense = await dense_search(con, qvec, tenant, k)
        # 3) sparse (FTS)
        sparse = await con.fetch(
            """select id, code, name, family, base_unit, pack_factor::float8 as pack_factor,
                      variable_weight, price::float8 as price, in_assortment,
                      coalesce(attrs->>'doc', name) as doc,
                      ts_rank(search_text, q) as score
                 from catalogue_skus, websearch_to_tsquery('english', $1) q
                 where tenant_id=$2 and search_text @@ q
                 order by score desc limit $3""",
            norm_item or mention, tenant, SPARSE_K,
        )

    # union by sku_id. Keep dense cosine (semantic, well-calibrated) and a prelim fused score.
    cand: Dict[str, Dict[str, Any]] = {}
    for r in dense:
        d = dict(r)
        d["method"] = "dense"
        d["dense"] = float(d.pop("score") or 0.0)
        d["prelim"] = d["dense"]
        cand[d["id"]] = d
    for r in sparse:
        d = dict(r)
        sc = float(d.pop("score") or 0.0)
        if d["id"] in cand:
            cand[d["id"]]["prelim"] = max(cand[d["id"]]["prelim"], 0.5 + min(sc, 0.5))
            cand[d["id"]]["method"] = "dense+sparse"
        else:
            d["method"] = "sparse"
            d["dense"] = 0.0
            d["prelim"] = 0.5 + min(sc, 0.5)
            cand[d["id"]] = d

    cands = list(cand.values())
    if not cands:
        res.abstain = True
        return res

    # 4) rerank the union with the cross-encoder (precision lift)
    docs = [c.get("doc") or c["name"] for c in cands]
    scores = await rerank.arerank(norm_item or mention, docs)
    if scores is not None and len(scores) == len(cands):
        for c, s in zip(cands, scores):
            c["score"] = float(s)
        res.method = "rerank"
    else:
        for c in cands:
            c["score"] = c.get("prelim", 0.0)
        res.method = "dense"

    cands.sort(key=lambda c: c["score"], reverse=True)

    # 5) THE CALIBRE OUTRANKS THE THIRD DECIMAL. Same law as 1b, on the retrieval half: when the
    # mention named a calibre and the reranker's top row is a sibling that CONTRADICTS it while a
    # sibling that carries it is right there in the pool, the catalogue wins. Only ever moves the
    # pick WITHIN one dimensioned family — it can never promote a different product — and only when
    # the top row is provably the wrong member of it.
    if dims and cands:
        _stem = (dim_idx.get("by_sku") or {}).get(cands[0]["id"], ("", ()))[0]
        if _stem in (dim_idx.get("dimensioned") or set()) \
                and not dims <= set((dim_idx["by_sku"][cands[0]["id"]])[1]):
            for i, c in enumerate(cands[1:], start=1):
                ent = (dim_idx.get("by_sku") or {}).get(c["id"])
                if ent and ent[0] == _stem and dims <= set(ent[1]):
                    cands.insert(0, cands.pop(i))
                    res.dim_note = "calibre"
                    res.method += "+calibre"
                    break

    res.candidates = [
        {"sku_id": c["id"], "code": c.get("code"), "name": c["name"], "family": c.get("family"),
         "base_unit": c.get("base_unit"), "pack_factor": c.get("pack_factor"),
         "variable_weight": c.get("variable_weight"), "price": c.get("price"),
         "in_assortment": c.get("in_assortment"), "doc": c.get("doc"),
         "score": round(c["score"], 4), "dense": round(c.get("dense", 0.0), 4),
         "method": c.get("method")}
        for c in cands
    ]

    top = cands[0]
    res.pick = {k2: top.get(k2) for k2 in
                ("id", "code", "name", "family", "base_unit", "pack_factor", "variable_weight", "price", "in_assortment")}
    res.pick["sku_id"] = top["id"]
    res.pick["dense"] = round(top.get("dense", 0.0), 4)
    res.pick["rerank"] = round(top["score"], 4)
    res.pick_score = top["score"]
    res.runner_up = res.candidates[1] if len(res.candidates) > 1 else None
    if res.dim_note == "calibre":
        # The calibre settled the family, so what is still open is the competition with OTHER
        # products — not the sibling the customer just ruled out by saying a number. Measuring the
        # margin against the sibling would report a doubt the catalogue has already answered.
        _stem = dim_idx["by_sku"][top["id"]][0]
        others = [c["score"] for c in cands[1:]
                  if (dim_idx.get("by_sku") or {}).get(c["id"], ("", ()))[0] != _stem]
        res.margin = res.pick_score - (others[0] if others else 0.0)
    else:
        res.margin = res.pick_score - (cands[1]["score"] if len(cands) > 1 else 0.0)

    # 5b) THE CALIBRE NOBODY NAMED. The other half of the same law. If the top two rows are the same
    # dimensioned family and the mention carries NOTHING that tells them apart — «velas» against
    # SALCHICHON VELA 40 MM / 55 MM — then the reranker's gap is confidence about the PRODUCT, and the
    # product was never in doubt. Resolving on that gap picks a calibre the customer never chose, in
    # silence, on an order. §5.7: "Match the product NAME first, then ask the calibre with real
    # catalogue options." Measured: over the 110 labelled mentions this fires on exactly one, «velas»,
    # which is the seed's own planted two-calibre case and was resolving silently at margin 0.418.
    if not res.dim_note and len(cands) > 1:
        e1 = (dim_idx.get("by_sku") or {}).get(cands[0]["id"])
        e2 = (dim_idx.get("by_sku") or {}).get(cands[1]["id"])
        if e1 and e2 and e1[0] == e2[0] and named_nothing(dim_idx, cands[0]["id"], norm_item or norm):
            res.tight = True
            res.dim_note = "calibre sin nombrar"

    # 5c) THE VARIETY NOBODY NAMED — 5b's law, applied to the NAME instead of the calibre.
    # The mention IS a catalogue row's whole name, and it is ALSO the stem of other rows: «mango»
    # against `Mango` and `Mango avión`. The exact row wins on rerank by a mile, so nothing in the
    # score can see the problem — the margin is confidence about the word, and the word was never in
    # doubt. `qualified_siblings` carries the reasoning and the deliberate asymmetry.
    #
    # The siblings are MERGED INTO `candidates` rather than merely counted, because §5.7a's question
    # is built from that list: a `tight` flag with one candidate asks «which one?» and offers one
    # answer. `n_close` is recomputed below over the merged pool, so a name with nine qualified
    # siblings correctly becomes «no honest question exists» instead of a nine-button menu.
    if not res.dim_note:
        _bare = normalize(norm_item or norm)
        if _bare and normalize(top["name"]) == _bare:
            sibs = await qualified_siblings(con, tenant, _bare, top["id"])
            if sibs:
                have = {c["id"] for c in cands}
                for s in sibs:
                    if s["id"] not in have:
                        cands.append({**s, "sku_id": s["id"],
                                      "score": res.pick_score, "method": "qualifier"})
                res.candidates = [{**c, "sku_id": c["id"]} for c in cands[:5]]
                res.runner_up = res.candidates[1] if len(res.candidates) > 1 else None
                res.margin = 0.0
                res.tight = True
                res.dim_note = "variedad sin nombrar"

    # HOW MANY ROWS ARE INDISTINGUISHABLE FROM THE PICK. Counted here, over the FULL pool, because
    # this is the only place that sees it: `as_dict()` truncates candidates to five, and §5.7a's
    # 3-button law needs to know whether the tie is over exactly two rows (a real multiple choice)
    # or over nine (no honest question exists — see doubt.classify_line).
    res.n_close = sum(1 for c in cands if (res.pick_score - c["score"]) < MARGIN_TIGHT)

    # 6) gate -> the register's three confidence bands (RUNTIME L4):
    #   clean  : alias hit OR reranker confident          -> fill clean
    #   note   : moderate confidence / tight / unit issue -> fill best + a "keep in mind" note
    #   unsure : reranker can't confirm it's a catalogue item (indistinguishable from a non-pork
    #            request) -> fill best guess but flag it (possible new SKU); operator edits, we learn.
    # `or res.tight` keeps 5b's verdict: a calibre nobody named is tight BY CONSTRUCTION, whatever
    # the score gap says, and a plain assignment here would silently throw that away.
    res.tight = (res.margin < MARGIN_TIGHT) or res.tight
    res.unit_ok, res.unit_note = _unit_check(top, unit_hint, qty)
    rr = res.pick_score
    if rr >= RERANK_CLEAR:
        band = "clean"
    elif rr >= RERANK_UNSURE:
        band = "note"
    else:
        band = "unsure"
    if band == "clean" and (res.tight or not res.unit_ok):
        band = "note"
    res.band = band
    res.abstain = (band == "unsure")
    return res
