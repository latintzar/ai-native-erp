"""brain/vocab.py — THE VOCABULARY PASS (PRODUCT-SPEC §5.7 / §5.7a).

A new tenant's catalogue must arrive with its OWN vocabulary, or §5.7's loop starts from nothing.

WHY THIS EXISTS. The demo tenant grounds beautifully because its vocabulary was written BY HAND:
`seed/catalogue.json` carries an `aliases` array per SKU (216 phrases over 68 rows) and
`brain/seed.load_catalogue` turns them into `sku_aliases` rows. The path a REAL customer's uploaded
price list takes — `brain/skuparse.py` → `brain/understand.py` → `brain/golive.seed_catalogue` —
produced exactly ONE alias per SKU: `matcher.normalize(name)`, the full catalogue name. So «CHORIZO
SARTA EXTRA 500 G» was reachable by typing «chorizo sarta extra 500 g» and by nothing else. Every
«sarta», «del 55», «york», «el jamoncito» fell through to a weak semantic tail — which is an
interrogation on the customer's first day, when trust is thinnest, and §5.7a exists to prevent it.

TWO PASSES, DELIBERATELY DIFFERENT IN KIND.

  ① DETERMINISTIC (`plan_row`) — rules, not a model. Free, instant, exactly reproducible, and the
    FTS-floor half of §5.7a's "never vector-only": a customer quoting a real article code, or the
    product name without its pack tail, or the calibre the way the trade says it, must hit
    deterministically. Runs SYNCHRONOUSLY, inside the caller's transaction (see §SYNC below).

  ② GENERATED (`generate`) — one batched model pass, es-ES, wholesale charcutería register, for what
    rules cannot reach: «PALETA COCIDA PIEZA» is asked for as «york», «CHORIZO SARTA» as «sartas».
    Bounded, cached per row, and NEVER load-bearing.

THE COLLISION GUARD IS THE POINT, NOT A SAFETY NET (§5.7a). An alias that could mean two rows of the
SAME catalogue is not an alias — it is precisely the AMBIGUOUS / DIMENSIONLESS case the doubt faculty
must send to the customer as a question. Writing it would silently pick a winner and destroy the
mechanism. So every candidate — rule-made or model-made — is checked against the whole tenant
catalogue AFTER generation, deterministically, and a phrase claimed by two rows is dropped from both.
This is why the pass sometimes writes FEWER aliases than the hand-authored seed: the seed gives
«chorizo sarta» to the 500 G row, while this pass sees the 1 KG row answer to the same phrase and
refuses to choose. That refusal is the product.

WEIGHT / SOURCE ORDERING (§5.7 — the customer's word always wins).
  learned · edit  → weight 2 and grows          ← what a customer taught, or a comercial corrected
  seed · golive   → weight 1
  vocab_rule      → weight 1  (this module)
  vocab_gen       → weight 1  (this module, model-made)
`matcher._alias_lookup` orders by `(phone_number is not null) desc, weight desc`, so a
customer-scoped learned alias beats anything global here. Belt AND braces: this module NEVER writes
an alias string that already exists for the tenant under any other source or scope, so it can never
even become a competing row for something the customer taught us.

IDEMPOTENT AND RE-RUNNABLE. `refresh()` is a pure projection: it deletes only
`source in ('vocab_rule','vocab_gen')` for the tenant and rebuilds them from (rules ∪ cache). Running
it twice changes nothing; `learned`/`edit`/`seed`/`golive` rows are never touched. `generate()` only
calls the model for rows whose content hash differs from the one cached in
`catalogue_skus.attrs->'vocab'`, so a re-upload of an unchanged catalogue costs ZERO model calls and
a re-upload that ADDS ten products pays for ten rows.

§SYNC — WHAT IS GUARANTEED AT GO-LIVE. The deterministic pass is pure Python + one DELETE + one bulk
INSERT: measured at ~0.9 s for a 2 000-line price list (264 ms of it planning), against the ~40 s
that same upload spends being embedded. So it runs in the SAME transaction that writes
`catalogue_skus`. It is therefore impossible for a tenant to be indexed-without-vocabulary:
either both commit or neither does. The generated pass is a LIFT, not a floor — it runs async after
commit, bounded and fail-soft, and if it never runs at all (no API key, an outage) the tenant still
has its whole deterministic vocabulary and the doubt faculty handles the tail exactly as §5.7a
designs. `status()` reports how much of the lift has landed so the CR can show it honestly.

SEEDED ROWS ARE EXCLUDED ON PURPOSE. `catalogue_skus.seeded=true` is the demo world, whose
colloquial mentions («el jamoncito», «jamón york») are withheld BY DESIGN so the §5.7 loop can be
seen closing (seed/catalogue.json `_learnable_mentions`). Generating them would short-circuit the
demo. golive writes `seeded=false`, so real customers get everything.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

import config
import db
from brain import matcher

log = logging.getLogger("rocoto.vocab")

# ── sources + weights (see the module docstring) ────────────────────────────────────────────────
SRC_RULE = "vocab_rule"
SRC_GEN = "vocab_gen"
OUR_SOURCES = (SRC_RULE, SRC_GEN)
WEIGHT_RULE = 1
WEIGHT_GEN = 1

# ── bounds. A 2 000-line price list is not 68 rows (task §5). ───────────────────────────────────
GEN_BATCH = 40                 # rows per model call — small enough to answer well, big enough to be cheap
GEN_CONCURRENCY = 3            # simultaneous model calls
GEN_MAX_ROWS = 4000            # hard ceiling per run; beyond this we generate for the first N and log
GEN_MAX_ALIASES_PER_ROW = 5
MAX_ALIASES_PER_ROW = 26       # rule candidates per row, pre-guard (the guard usually cuts this hard)
MAX_ALIAS_TOKENS = 5
MAX_ALIAS_CHARS = 44
MIN_ALIAS_CHARS = 3

# ── vocabulary of the trade (es-ES, wholesale charcutería / fruta-verdura) ──────────────────────
# Tokens that are pure measure and carry no product identity — stripped off the TAIL of a name.
_MEASURE = {
    "g", "gr", "grs", "gramo", "gramos", "kg", "kgs", "kilo", "kilos", "k",
    "mm", "cm", "cl", "ml", "l", "lt", "lts", "litro", "litros",
}
# Tokens that name a container/format and carry no identity on their own — stripped off the TAIL.
# NOT here on purpose: sarta · cular · vela · caña · herradura · rulo · cuña · loncheado — in this
# trade those IDENTIFY the article («la sarta», «el cular»), they do not decorate it.
_FORMAT_TAIL = {
    "pieza", "piezas", "ud", "uds", "u", "unidad", "unidades", "pza", "pzas",
    "caja", "cajas", "plancha", "bandeja", "barqueta", "bolsa", "tarrina", "sobre", "sobres",
    "doc", "docena", "docenas",
}
# Grade words: real on the albarán, absent from how anyone orders.
_GRADE = {"extra", "especial", "selecto", "selecta", "primera", "superior", "premium",
          "gourmet", "seleccion", "calidad", "natural"}
# Shape words the trade uses AS the name of the article — these invert («sarta de chorizo»).
_SHAPES = {"sarta", "sartas", "cular", "vela", "cana", "herradura", "rulo", "cuna",
           "loncheado", "loncheada", "lonchas", "taco", "barra", "ristra", "filete", "fileteada"}
# Never an alias on its own.
_STOP_SOLO = (_MEASURE | _FORMAT_TAIL | _GRADE | {
    "de", "del", "la", "el", "los", "las", "y", "con", "sin", "para", "por",
    "producto", "articulo", "referencia", "ref", "codigo", "cod", "precio", "iva",
    "fresco", "fresca", "congelado", "congelada", "loncheado", "loncheada",
})
# Adjective endings — «pechuga DE pavo» is right, «panceta DE adobada» is not.
_ADJ_SUFFIX = ("ado", "ada", "ados", "adas", "ido", "ida", "idos", "idas",
               "ico", "ica", "icos", "icas", "oso", "osa", "eno", "ena",
               "ante", "ente", "curado", "curada")
_ADJ_EXTRA = {"fresco", "fresca", "frescos", "frescas", "limpios", "limpias", "entero", "entera",
              "fino", "fina", "grueso", "gruesa", "dulce", "picante", "grande", "pequeno",
              "semicurado", "semicurada", "salado", "salada", "cocido", "cocida"}


def _is_adj(tok: str) -> bool:
    return tok in _ADJ_EXTRA or tok.endswith(_ADJ_SUFFIX)


def _plurals(word: str) -> List[str]:
    """Spanish plural(s) of one token. Consonant endings get BOTH forms («fuet» → fuets/fuetes)
    because this trade is full of catalan/foreign words that take the -s; a plural nobody says is
    dead weight in a table, while a plural we failed to write is a question we did not need to ask."""
    w = (word or "").strip()
    if len(w) < 3 or w.endswith(("s", "x")):
        return []
    if w[-1] in "aeiou":
        return [w + "s"]
    if w.endswith("z"):
        return [w[:-1] + "ces"]
    return [w + "es", w + "s"]


def _strip_tail(tokens: Sequence[str], vocab: Set[str]) -> List[str]:
    """Pop trailing tokens that are digits or in `vocab`. Never empties the list."""
    out = list(tokens)
    while len(out) > 1 and (out[-1].isdigit() or out[-1] in vocab):
        out.pop()
    return out


def _acceptable(alias: str) -> bool:
    a = (alias or "").strip()
    if len(a) < MIN_ALIAS_CHARS or len(a) > MAX_ALIAS_CHARS:
        return False
    toks = a.split()
    if not toks or len(toks) > MAX_ALIAS_TOKENS:
        return False
    if all(t.isdigit() for t in toks):
        return False
    if len(toks) == 1 and toks[0] in _STOP_SOLO:
        return False
    return True


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# ① THE DETERMINISTIC PASS — rules, exactly reproducible
# ══════════════════════════════════════════════════════════════════════════════════════════════════

def plan_row(row: Dict[str, Any]) -> List[str]:
    """Every deterministic alias candidate for ONE catalogue row, normalized and deduped.

    `row` needs `name`; `code` is used when present. Pure — no DB, no model, no globals. The output
    is a CANDIDATE list: the collision guard in `plan_catalogue` decides what survives.

    The rules, in the order the trade actually speaks:
      R1 CODE       — «EMB-CHS-050» → «emb chs 050» + «embchs050» (the FTS floor §5.7a argues for)
      R2 TAIL       — «CHORIZO SARTA EXTRA 500 G» → «chorizo sarta extra» → «chorizo sarta»
      R3 PREFIX     — «SALCHICHÓN IBÉRICO BELLOTA PIEZA» → «salchichon iberico»
      R4 CALIBRE    — «SALCHICHÓN VELA 55 MM» → «vela 55» · «del 55» · «salchichon del 55»
                      «FUET EXTRA 500 G»      → «fuet 500» · «fuet de 500»
      R5 ELISION    — «QUESO CABEZA» → «queso de cabeza»; «CHORIZO SARTA» → «sarta de chorizo»
      R6 PLURAL     — «FUET» → «fuets»/«fuetes»; «ALITA POLLO» → «alitas de pollo»
    """
    name = str(row.get("name") or "").strip()
    if not name:
        return []
    code = str(row.get("code") or "").strip()
    out: List[str] = []

    def add(*vals: str) -> None:
        for v in vals:
            a = matcher.normalize(v)
            if a and _acceptable(a) and a not in out:
                out.append(a)

    # ── R1 · the article CODE and its common written variants ────────────────────────────────────
    if code:
        norm_code = matcher.normalize(code)
        add(norm_code)
        compact = norm_code.replace(" ", "")
        if compact != norm_code:
            add(compact)

    n_tokens = matcher.normalize(name).split()
    if not n_tokens:
        return out

    # ── R2 · the name minus its measure tail, then minus its format tail, then minus grade words ──
    l1 = _strip_tail(n_tokens, _MEASURE)                       # «... extra 500 g» → «... extra»
    l2 = _strip_tail(l1, _FORMAT_TAIL)                         # «... cular extra pieza» → «... cular extra»
    l3 = [t for t in l2 if t not in _GRADE] or l2               # drop grade words anywhere
    l3 = _strip_tail(l3, _FORMAT_TAIL)
    add(" ".join(l1), " ".join(l2), " ".join(l3))

    # ── R3 · the two-word prefix (how a long albarán line gets shortened out loud) ────────────────
    if len(l3) >= 3:
        add(" ".join(l3[:2]))

    head = l3[0] if l3 else n_tokens[0]

    # ── R4 · the calibre / format number, the way the trade says it ──────────────────────────────
    for i, tok in enumerate(n_tokens):
        if not tok.isdigit() or len(tok) < 2:
            continue                                            # «1 KG», «1 2 KG» → nothing sensible
        nxt = n_tokens[i + 1] if i + 1 < len(n_tokens) else ""
        prev = n_tokens[i - 1] if i > 0 else ""
        weight_like = bool(nxt) and nxt in _MEASURE and nxt != "mm"
        joiner = "de" if weight_like else "del"                 # «fuet de 500» vs «salchichón del 55»
        # The CALIBRE-PRESERVING name: «SALCHICHÓN VELA 55 MM» → «salchichon vela 55». `matcher`
        # (2026-07-27) now tries the alias table on the form that KEEPS the number before the one
        # that drops it, precisely because dropping it resolved «vela 55» onto the 40 MM row. This
        # is the row that form is supposed to land on.
        add(f"{' '.join(l3)} {tok}")
        add(f"{head} {tok}", f"{head} {joiner} {tok}")
        if prev and not prev.isdigit() and prev not in _MEASURE and prev not in _GRADE:
            add(f"{prev} {tok}", f"{prev} {joiner} {tok}")
        if not weight_like:
            add(f"{joiner} {tok}")                              # «del 55» — bare calibre, guarded

    # ── R5 · elisions and the inversion this trade lives on ──────────────────────────────────────
    if len(l3) >= 2:
        t1, t2 = l3[0], l3[1]
        if not _is_adj(t2):
            add(f"{t1} de {t2}")
        if t2 in _SHAPES:
            add(f"{t2} de {t1}", f"{t2} {t1}")

    # ── R6 · singular/plural ─────────────────────────────────────────────────────────────────────
    for p in _plurals(head):
        add(p)
        if len(l3) >= 2 and not _is_adj(l3[1]):
            add(f"{p} de {l3[1]}")
    if len(l3) == 1:
        for p in _plurals(l3[0]):
            add(p)
    if len(l3) >= 2 and l3[1] in _SHAPES:
        for p in _plurals(l3[1]):
            add(p, f"{p} de {l3[0]}")

    return out[:MAX_ALIASES_PER_ROW]


def plan_catalogue(rows: Sequence[Dict[str, Any]],
                   *, extra: Optional[Dict[str, Sequence[str]]] = None,
                   taken: Optional[Dict[str, Set[str]]] = None) -> Dict[str, Any]:
    """Rule candidates for a whole catalogue + THE COLLISION GUARD (§5.7a).

    `rows`  — [{id, name, code, ...}] for ONE tenant.
    `extra` — sku_id → already-filtered GENERATED phrases (they go through the same guard).
    `taken` — alias → {sku_id,…} already present in `sku_aliases` from any OTHER source/scope.

    Returns {rule: [(alias, sku_id)], gen: [(alias, sku_id)], dropped_ambiguous: [...],
             dropped_taken: [...]}. Deterministic: same input, same output, always.
    """
    extra = extra or {}
    taken = taken or {}
    claims: Dict[str, Set[str]] = {}
    kind: Dict[Tuple[str, str], str] = {}
    order: List[Tuple[str, str]] = []

    def claim(alias: str, sku_id: str, src: str) -> None:
        claims.setdefault(alias, set()).add(sku_id)
        key = (alias, sku_id)
        if key not in kind:
            kind[key] = src
            order.append(key)
        elif kind[key] == SRC_GEN and src == SRC_RULE:
            kind[key] = SRC_RULE          # a rule and a guess agreeing: record it as the rule

    for r in rows:
        sid = str(r.get("id") or "")
        if not sid:
            continue
        for a in plan_row(r):
            claim(a, sid, SRC_RULE)
        for a in (extra.get(sid) or []):
            a = matcher.normalize(a)
            if a and _acceptable(a):
                claim(a, sid, SRC_GEN)

    rule: List[Tuple[str, str]] = []
    gen: List[Tuple[str, str]] = []
    dropped_ambiguous: List[str] = []
    dropped_taken: List[str] = []
    seen_ambig: Set[str] = set()
    for alias, sid in order:
        owners = claims.get(alias) or set()
        if len(owners) > 1:
            # THE WHOLE POINT: two rows answer to this phrase, so it is a QUESTION, not an alias.
            if alias not in seen_ambig:
                seen_ambig.add(alias)
                dropped_ambiguous.append(alias)
            continue
        if alias in taken:
            # Already claimed by seed / golive / a learned or edited alias — never compete with it,
            # never duplicate it. §5.7's loop must always be able to overrule us.
            dropped_taken.append(alias)
            continue
        (rule if kind[(alias, sid)] == SRC_RULE else gen).append((alias, sid))
    return {"rule": rule, "gen": gen,
            "dropped_ambiguous": dropped_ambiguous, "dropped_taken": dropped_taken}


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# THE PROJECTION — read rows + cache, write sku_aliases. No model, no network.
# ══════════════════════════════════════════════════════════════════════════════════════════════════

def row_hash(row: Dict[str, Any]) -> str:
    """Content hash of the fields the vocabulary depends on. A re-upload that does not change these
    does not re-generate anything."""
    src = "|".join([
        matcher.normalize(str(row.get("name") or "")),
        matcher.normalize(str(row.get("code") or "")),
        str(row.get("family") or ""),
        str(row.get("base_unit") or ""),
    ])
    return hashlib.sha256(src.encode()).hexdigest()[:16]


_ROWS_SQL = """select id, code, name, family, base_unit, seeded,
                      attrs->'vocab' as vocab
                 from catalogue_skus
                where tenant_id=$1 and in_assortment and ($2 or not seeded)"""


async def _load_rows(con, tenant: str, include_seeded: bool) -> List[Dict[str, Any]]:
    return [dict(r) for r in await con.fetch(_ROWS_SQL, tenant, include_seeded)]


async def _taken_aliases(con, tenant: str) -> Dict[str, Set[str]]:
    """alias → {sku_id} for every alias this tenant already has from a source that is NOT ours.
    Includes customer-scoped rows: a phrase one customer taught is not a phrase we may guess at
    globally for everyone else."""
    rows = await con.fetch(
        "select alias, sku_id from sku_aliases where tenant_id=$1 and source <> all($2::text[])",
        tenant, list(OUR_SOURCES))
    out: Dict[str, Set[str]] = {}
    for r in rows:
        out.setdefault(r["alias"], set()).add(r["sku_id"])
    return out


def _cache_fresh(row: Dict[str, Any]) -> bool:
    """Has the generated pass already RUN for this row's current content?

    Distinct from "did it produce anything": a row the model honestly had nothing to say about
    caches `gen: []`, and must not be paid for again on every re-upload. That distinction is the
    whole cost guarantee."""
    v = row.get("vocab")
    return isinstance(v, dict) and v.get("h") == row_hash(row)


def _cached_gen(row: Dict[str, Any]) -> List[str]:
    """The generated phrases cached on the row, IF they were generated for this row's content."""
    if not _cache_fresh(row):
        return []                                   # the row changed → the guess is stale, ignore it
    got = (row.get("vocab") or {}).get("gen")
    return [str(x) for x in got] if isinstance(got, list) else []


async def _refresh_inner(con, tenant: str, include_seeded: bool) -> Dict[str, Any]:
    # One writer at a time per tenant. Held for the caller's transaction, released on commit.
    await con.execute("select pg_advisory_xact_lock(hashtext($1))", f"vocab:{tenant}")
    rows = await _load_rows(con, tenant, include_seeded)
    if not rows:
        await con.execute(
            "delete from sku_aliases where tenant_id=$1 and source = any($2::text[])",
            tenant, list(OUR_SOURCES))
        return {"ok": True, "tenant": tenant, "rows": 0, "rule": 0, "gen": 0,
                "ambiguous": 0, "taken": 0}

    taken = await _taken_aliases(con, tenant)
    extra = {r["id"]: _cached_gen(r) for r in rows}
    plan = plan_catalogue(rows, extra=extra, taken=taken)

    # Pure projection: our rows are rebuilt from scratch every run, so re-running is a no-op and a
    # re-upload cannot leave a stale alias behind. Nothing outside OUR_SOURCES is ever touched.
    await con.execute(
        "delete from sku_aliases where tenant_id=$1 and source = any($2::text[])",
        tenant, list(OUR_SOURCES))
    pairs = ([(a, s, SRC_RULE, WEIGHT_RULE) for a, s in plan["rule"]] +
             [(a, s, SRC_GEN, WEIGHT_GEN) for a, s in plan["gen"]])
    if pairs:
        await con.execute(
            """insert into sku_aliases (tenant_id, alias, sku_id, phone_number, source, weight)
               select $1, a, s, null, src, w
                 from unnest($2::text[], $3::text[], $4::text[], $5::int[]) as t(a, s, src, w)""",
            tenant, [p[0] for p in pairs], [p[1] for p in pairs],
            [p[2] for p in pairs], [p[3] for p in pairs])
    return {"ok": True, "tenant": tenant, "rows": len(rows),
            "rule": len(plan["rule"]), "gen": len(plan["gen"]),
            "ambiguous": len(plan["dropped_ambiguous"]), "taken": len(plan["dropped_taken"]),
            "ambiguous_sample": plan["dropped_ambiguous"][:12]}


async def refresh(con, tenant: str, *, include_seeded: bool = False) -> Dict[str, Any]:
    """Rebuild this tenant's `vocab_rule` + `vocab_gen` aliases from (rules ∪ cached generation).

    NO model call, NO network — safe to run inside the transaction that writes `catalogue_skus`,
    which is exactly how the go-live path uses it (§SYNC). Idempotent. Never raises: a vocabulary
    hiccup must never roll back a catalogue the customer just uploaded.
    """
    tenant = (tenant or "").strip().lower()
    if not tenant:
        return {"ok": False, "reason": "no_tenant"}
    try:
        # ALWAYS a transaction of our own. When the caller already has one open (the go-live path)
        # asyncpg makes this a SAVEPOINT — which is the whole point: if anything in here fails we
        # roll back only ourselves, and the catalogue the customer just uploaded still commits. A
        # bare `except` inside someone else's aborted transaction would take their commit down too.
        async with con.transaction():
            return await _refresh_inner(con, tenant, include_seeded)
    except Exception:
        log.exception("vocab.refresh failed for %s", tenant)
        return {"ok": False, "reason": "error", "tenant": tenant}


async def refresh_tenant(tenant: str, *, include_seeded: bool = False) -> Dict[str, Any]:
    """`refresh` on its own connection (repair runs, tests, the CR)."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            return await refresh(con, tenant, include_seeded=include_seeded)
    except Exception:
        log.exception("vocab.refresh_tenant failed for %s", tenant)
        return {"ok": False, "reason": "error", "tenant": tenant}


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# ② THE GENERATED PASS — how this trade actually TALKS about each product
# ══════════════════════════════════════════════════════════════════════════════════════════════════

_VOCAB_TOOL = {
    "name": "record_vocabulary",
    "description": (
        "Registrar, para cada fila del catálogo, cómo la PIDE de verdad un cliente (un bar, un "
        "restaurante, una tienda) por WhatsApp o por teléfono. Sólo lenguaje de cliente, nunca "
        "lenguaje de catálogo ni de marketing."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "rows": {
                "type": "array",
                "description": "una entrada por fila; puedes omitir filas para las que no tengas nada bueno",
                "items": {
                    "type": "object",
                    "properties": {
                        "i": {"type": "integer", "description": "el número de fila tal cual te lo doy"},
                        "say": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": ("cómo lo pide el cliente: 1-4 palabras, minúsculas. "
                                            "Entre 0 y 5. Mejor ninguna que una dudosa."),
                        },
                    },
                    "required": ["i", "say"],
                },
            },
        },
        "required": ["rows"],
    },
}

_VOCAB_SYSTEM = (
    "Eres el comercial veterano de un mayorista de charcutería y cárnicas de Mercamadrid. Conoces "
    "el habla del oficio: el bar que pide «york», «el jamoncito», «sartas», «del 55», «media de "
    "lomo». Te doy filas REALES del catálogo de UN distribuidor, tal y como se imprimen en su "
    "albarán. Para cada fila escribes SÓLO cómo se la piden sus clientes.\n\n"
    "REGLAS, y son duras:\n"
    "1. Sólo lo que DIRÍA un cliente al pedir. Nunca palabras de catálogo ni de marketing "
    "(«delicioso», «premium», «de primera calidad», «nuestro»).\n"
    "2. NUNCA inventes un producto, un formato, una marca ni un calibre que no esté en la fila.\n"
    "3. NUNCA escribas una frase que pueda referirse a OTRA fila de la lista que te doy. Si dudas "
    "entre dos filas, NO la escribas: esa duda es precisamente lo que hay que preguntarle al "
    "cliente, y si la escribes le estamos eligiendo por él.\n"
    "4. No repitas el nombre completo tal cual: eso ya lo tenemos.\n"
    "5. Español de España, minúsculas, 1-4 palabras. Entre 0 y 5 por fila. Es MEJOR no dar "
    "ninguna que dar una dudosa.\n"
    "6. Si un número aparece en tu frase, tiene que ser un número que esté en la fila."
)


def _batch_user(rows: Sequence[Dict[str, Any]]) -> str:
    lines = []
    for i, r in enumerate(rows):
        bits = [f"[{i}]", str(r.get("name") or "")]
        if r.get("code"):
            bits.append(f"(ref {r['code']})")
        if r.get("family"):
            bits.append(f"· familia {r['family']}")
        if r.get("base_unit"):
            bits.append(f"· se vende por {r['base_unit']}")
        lines.append(" ".join(bits))
    return ("Filas del catálogo de ESTE distribuidor (son vecinas: mira bien cuáles se parecen "
            "entre sí antes de escribir nada):\n\n" + "\n".join(lines))


def _digits(s: str) -> Set[str]:
    return set(re.findall(r"\d+", s or ""))


def filter_generated(row: Dict[str, Any], says: Iterable[Any]) -> List[str]:
    """Deterministic filter over ONE row's model output — before the collision guard ever sees it.

    Drops: junk shapes, anything too long, and any phrase carrying a number the row does not have
    (the cheapest possible guard against an invented calibre)."""
    allowed = _digits(str(row.get("name") or "")) | _digits(str(row.get("code") or ""))
    full = matcher.normalize(str(row.get("name") or ""))
    out: List[str] = []
    for raw in says or []:
        a = matcher.normalize(str(raw or ""))
        if not a or a == full or not _acceptable(a):
            continue
        if not _digits(a) <= allowed:
            continue                                   # a number we never gave it → invented
        if a not in out:
            out.append(a)
        if len(out) >= GEN_MAX_ALIASES_PER_ROW:
            break
    return out


async def _generate_batch(rows: Sequence[Dict[str, Any]]) -> Optional[Dict[str, List[str]]]:
    """One model call over ≤GEN_BATCH rows → sku_id → filtered phrases. Never raises.

    Returns None when the CALL failed, which is not the same as the model having nothing to say:
    only a batch that actually answered may be written to the cache, or one overloaded afternoon
    would permanently mark a tenant's whole catalogue as 'already generated, nothing found'."""
    from brain import llm
    try:
        data = await llm.call_tool(
            config.SKUPARSE_MODEL, _VOCAB_SYSTEM, _batch_user(rows),
            _VOCAB_TOOL, "record_vocabulary", max_tokens=4096,
            fallback=config.ORDER_EXTRACT_FALLBACK_MODEL)
    except Exception:
        log.exception("vocab: batch generation failed (%d rows)", len(rows))
        return None
    if not isinstance(data, dict):
        return None
    out: Dict[str, List[str]] = {}
    for entry in (data.get("rows") or []):
        if not isinstance(entry, dict):
            continue
        try:
            i = int(entry.get("i"))
        except (TypeError, ValueError):
            continue
        if not (0 <= i < len(rows)):
            continue
        row = rows[i]
        phrases = filter_generated(row, entry.get("say") or [])
        if phrases:
            out[row["id"]] = phrases
    return out


def _batches(rows: Sequence[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """Batch by FAMILY so near-duplicates land in the same call — the model can only refuse an
    ambiguous phrase if it can SEE the sibling row it would collide with."""
    by_family: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        by_family.setdefault(str(r.get("family") or ""), []).append(r)
    out: List[List[Dict[str, Any]]] = []
    for fam in sorted(by_family):
        group = by_family[fam]
        for i in range(0, len(group), GEN_BATCH):
            out.append(group[i:i + GEN_BATCH])
    return out


async def generate(tenant: str, *, include_seeded: bool = False,
                   max_rows: int = GEN_MAX_ROWS, refresh_after: bool = True) -> Dict[str, Any]:
    """The model pass, for rows whose cached vocabulary is missing or stale. Never raises.

    Cost control: only CHANGED/NEW rows are sent, batched by family, ≤GEN_CONCURRENCY in flight.
    Each batch's cache write is its own statement, so a partial run is still a consistent partial
    improvement — there is no half-written state to clean up.
    """
    tenant = (tenant or "").strip().lower()
    if not tenant:
        return {"ok": False, "reason": "no_tenant"}
    if not config.ANTHROPIC_API_KEY:
        # Honest no-op: the deterministic floor is already in place, the lift simply does not run.
        return {"ok": False, "reason": "no_api_key", "tenant": tenant}
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            rows = await _load_rows(con, tenant, include_seeded)
    except Exception:
        log.exception("vocab.generate: cannot read catalogue for %s", tenant)
        return {"ok": False, "reason": "error", "tenant": tenant}

    pending = [r for r in rows if not _cache_fresh(r)]
    truncated = len(pending) > max_rows
    pending = pending[:max_rows]
    if not pending:
        # Every live row already has vocabulary generated for its CURRENT content — a re-upload of an
        # unchanged catalogue costs nothing at all.
        return {"ok": True, "tenant": tenant, "rows": len(rows), "pending": 0, "generated": 0,
                "batches": 0, "failed_batches": 0, "cached": True}

    batches = _batches(pending)
    sem = asyncio.Semaphore(GEN_CONCURRENCY)
    produced: Dict[str, List[str]] = {}
    answered: List[Dict[str, Any]] = []
    failed = 0

    async def run(batch: List[Dict[str, Any]]) -> None:
        nonlocal failed
        async with sem:
            got = await _generate_batch(batch)
        if got is None:
            failed += 1
            return                                  # do NOT cache a batch that never answered
        answered.extend(batch)
        produced.update(got)

    await asyncio.gather(*(run(b) for b in batches))

    # Cache on the row it describes: an unchanged row is never regenerated, and golive's own upsert
    # only clobbers `attrs` for rows whose CONTENT changed — where a stale guess would be wrong.
    now = datetime.now(timezone.utc).isoformat()
    by_id = {r["id"]: r for r in answered}
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            async with con.transaction():
                for sid, row in by_id.items():
                    blob = {"h": row_hash(row), "gen": produced.get(sid, []),
                            "at": now, "model": config.SKUPARSE_MODEL}
                    await con.execute(
                        """update catalogue_skus
                              set attrs = coalesce(attrs,'{}'::jsonb) || jsonb_build_object('vocab', $3::jsonb)
                            where id=$1 and tenant_id=$2""",
                        sid, tenant, blob)
    except Exception:
        log.exception("vocab.generate: cache write failed for %s", tenant)
        return {"ok": False, "reason": "cache_write_failed", "tenant": tenant}

    out = {"ok": True, "tenant": tenant, "rows": len(rows), "pending": len(pending),
           "batches": len(batches), "failed_batches": failed,
           "generated": sum(len(v) for v in produced.values()),
           "rows_with_vocab": len(produced), "truncated": truncated}
    if refresh_after:
        out["refresh"] = await refresh_tenant(tenant, include_seeded=include_seeded)
    log.info("vocab.generate %s — %d rows, %d batches, %d phrases", tenant, len(pending),
             len(batches), out["generated"])
    return out


# ── the async hand-off (task §5: bounded, non-blocking, never load-bearing) ──────────────────────
_running: Set[str] = set()


def schedule_generation(tenant: str) -> bool:
    """Fire the model pass in the background. Deduped per tenant, fail-soft, returns whether it was
    started. The caller has ALREADY committed the deterministic vocabulary — this only ever adds."""
    tenant = (tenant or "").strip().lower()
    if not tenant or tenant in _running:
        return False
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return False

    async def _run() -> None:
        try:
            await generate(tenant)
        except Exception:
            log.exception("vocab: background generation failed for %s", tenant)
        finally:
            _running.discard(tenant)

    _running.add(tenant)
    loop.create_task(_run())
    return True


async def status(tenant: str, *, include_seeded: bool = False) -> Dict[str, Any]:
    """What vocabulary this tenant actually has — the honest readout for the CR.

    `floor_ready` is the guarantee: the deterministic vocabulary exists for every live row. `lift`
    reports how much of the generated pass has landed; it is NEVER a blocker (§SYNC).
    """
    tenant = (tenant or "").strip().lower()
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            rows = await _load_rows(con, tenant, include_seeded)
            counts = await con.fetch(
                "select source, count(*) as n from sku_aliases where tenant_id=$1 group by source",
                tenant)
    except Exception:
        log.exception("vocab.status failed for %s", tenant)
        return {"ok": False, "reason": "error", "tenant": tenant}
    by_source = {r["source"]: int(r["n"]) for r in counts}
    pending = [r for r in rows if not _cache_fresh(r)]
    return {
        "ok": True, "tenant": tenant, "rows": len(rows),
        "rule": by_source.get(SRC_RULE, 0), "generated": by_source.get(SRC_GEN, 0),
        "learned": by_source.get("learned", 0) + by_source.get("edit", 0),
        "seed": by_source.get("seed", 0) + by_source.get("golive", 0),
        "floor_ready": bool(rows) and by_source.get(SRC_RULE, 0) > 0,
        "lift_pending_rows": len(pending),
        "lift_complete": not pending,
    }
