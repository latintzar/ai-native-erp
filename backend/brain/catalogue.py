"""E-commerce catalogue read-model + product editor (medusa-integration.md §3/§4).

Everything here reads/writes the REAL `catalogue_skus` table — the derived read-model that the Medusa
product subscriber keeps current (db.py §SHOP_SCHEMA). There are NO mocks: the seeded Sancho Cured Meats
SKUs live in `catalogue_skus` (seeded=true) and are the same rows WhatsApp grounding matches against.

Four concerns:
  • `company_catalogue()`  — the company-wide SKU master (ALL skus for the tenant). Shared by both the
    WhatsApp grounding view and the e-commerce store-builder.
  • `ecom_products()`      — the live storefront products (live_on_ecom=true) with image + customizations.
  • `edit_product()`       — the editor: flip live_on_ecom / image_url / customizations / asap_envelope,
    persist to catalogue_skus, flip seeded=false (so a re-seed never clobbers an operator edit — the
    ProfileName rule, db.py), and WRITE THROUGH to Medusa product metadata via the outbox proxy.
  • `create_sku()`         — ONE new row, minted by a person standing in front of the product. NEW.

WHY A THIRD WRITER, AND WHY IT IS NOT A FORK OF THE OTHER TWO (§5.8b, 2026-07-27).
`brain/seed.load_catalogue` writes the DEMO world; `brain/golive.seed_catalogue` writes a WHOLE
catalogue from an uploaded file and owns the re-upload semantics (removed rows leave the assortment,
its own id namespace, its own aliases). Neither can express "this ONE thing, that we are holding, is
not in the list" — and that is the case the inventory tool runs into every single morning, because a
distributor's catalogue is never complete on day one. `create_sku` is the third door, and it is
deliberately the SMALLEST of the three: one row, never a set, never a deletion, never a retirement,
and it REFUSES rather than duplicates.

    A CREATED ROW LIVES IN ITS OWN ID NAMESPACE — `{tenant}#new:{hash}`, never `{tenant}:{hash}`.
    That is not decoration. `golive.seed_catalogue` retires every row under `{tenant}:%` that is
    absent from the file it was just handed. A row the boss created by hand, in the warehouse, is
    absent from every ERP export that does not know about it yet — so sharing golive's namespace
    would mean the next price-list upload silently sets `in_assortment=false` on a product he is
    physically holding and has counted stock against. The cost of a separate namespace is the
    opposite failure: if he later DOES add it to his ERP and re-uploads there will be two rows. That
    one is VISIBLE (two rows in Catálogo), it is the SOFTER failure (the matcher then sees two close
    candidates and ASKS, which is exactly §5.7a's designed behaviour), and it is the one a person can
    fix. A silent disappearance is neither.

Defensive: reads never raise (a transiently-unavailable pool returns []), so the supplier's store view
degrades to empty rather than erroring. `create_sku` is the exception and it is deliberate — it returns
a TYPED refusal (never an exception, never a silent success) because every one of its refusals is
something the operator must SEE and answer.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from typing import Any, Dict, Iterable, List, Optional

import config
import db

log = logging.getLogger("rocoto.catalogue")


def _f(v: Any) -> Optional[float]:
    """Decimal/str price → float for the JSON wire (asyncpg returns numeric as Decimal)."""
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _jpipe(v: Any) -> Any:
    """jsonb comes back already decoded (global codec). Be defensive if it's ever a raw string."""
    if isinstance(v, (list, dict)):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return [] if v.strip().startswith("[") else {}
    return v


def _sku_row(r: Dict[str, Any]) -> Dict[str, Any]:
    """One catalogue_skus row → the wire shape both surfaces share (id, code, name, family, base_unit,
    price, live_on_ecom, image_url, customizations, asap_envelope, medusa_variant_id).

    `seeded` and `created_from` are on the wire because A CATALOGUE ROW NOBODY CAN EXPLAIN IS A
    LIABILITY. `seeded` separates the demo world from the supplier's real one (a gap reported against
    this function on 2026-07-27 — it was invisible, so `/api/ecom/catalogue` could not tell a demo row
    from a real one). `created_from` is the provenance of a row that was born in the warehouse rather
    than in a file: which capture, which photograph, the words that were actually said, and when. It
    is null for every row that came from a file, which is itself the answer to "where did this come
    from" for those."""
    return {
        "id": r.get("id"),
        "code": r.get("code"),
        "name": r.get("name"),
        "family": r.get("family") or "",
        "base_unit": r.get("base_unit") or "kg",
        "pack_factor": _f(r.get("pack_factor")) if r.get("pack_factor") is not None else None,
        "variable_weight": bool(r.get("variable_weight")),
        "price": _f(r.get("price")),
        "in_assortment": bool(r.get("in_assortment", True)),
        "seeded": bool(r.get("seeded")),
        "created_from": (_jpipe(r.get("attrs")) or {}).get("created_from"),
        "live_on_ecom": bool(r.get("live_on_ecom")),
        "image_url": r.get("image_url"),
        "customizations": _jpipe(r.get("customizations")) or [],
        "asap_envelope": _jpipe(r.get("asap_envelope")) or {},
        "medusa_variant_id": r.get("medusa_variant_id"),
    }


async def company_catalogue(*, tenant: Optional[str] = None) -> List[Dict[str, Any]]:
    """The COMPANY-WIDE SKU master: every catalogue_skus row for the tenant (live or not). This is the
    single read shared by WhatsApp grounding AND the e-commerce store-builder — one source of truth."""
    tenant = tenant or config.BRAIN_TENANT
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            rows = await con.fetch(
                """select id, code, name, family, base_unit, pack_factor, variable_weight,
                          price, in_assortment, seeded, attrs, live_on_ecom, image_url,
                          customizations, asap_envelope, medusa_variant_id
                     from catalogue_skus where tenant_id=$1
                    order by (family is null), family, name""",
                tenant)
        return [_sku_row(dict(r)) for r in rows]
    except Exception:
        log.exception("catalogue.company_catalogue failed")
        return []


async def ecom_products(*, tenant: Optional[str] = None) -> List[Dict[str, Any]]:
    """The live storefront products: catalogue_skus where live_on_ecom=true, with the e-commerce
    surface columns (image_url, customizations) + the asap/out-of-hours envelope."""
    tenant = tenant or config.BRAIN_TENANT
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            rows = await con.fetch(
                """select id, code, name, family, base_unit, pack_factor, variable_weight,
                          price, in_assortment, seeded, attrs, live_on_ecom, image_url,
                          customizations, asap_envelope, medusa_variant_id
                     from catalogue_skus where tenant_id=$1 and live_on_ecom=true
                    order by (family is null), family, name""",
                tenant)
        return [_sku_row(dict(r)) for r in rows]
    except Exception:
        log.exception("catalogue.ecom_products failed")
        return []


async def edit_product(sku_id: str, patch: Dict[str, Any], *,
                       tenant: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Edit an e-commerce product. Sets any of live_on_ecom / image_url / customizations / asap_envelope
    on the real catalogue_skus row, flips seeded=false (operator edit → a re-seed won't clobber it — the
    ProfileName rule), and enqueues a Medusa product-metadata write-through on the outbox (§3). The outbox
    drainer applies it to Medusa when MEDUSA_SYNC_ENABLED is on; with the flag off it records the intent
    (land-dark). Returns the updated product row, or None if the sku doesn't exist.

    Partial: only keys PRESENT in `patch` are written (None for image_url is a real "clear the image").
    """
    tenant = tenant or config.BRAIN_TENANT
    patch = patch or {}

    # Build the COALESCE-style partial update: only touch supplied keys. `present` flags which keys the
    # caller actually sent (so we can distinguish "unset image_url" from "leave image_url alone").
    set_live = "live_on_ecom" in patch
    set_img = "image_url" in patch
    set_cust = "customizations" in patch
    set_asap = "asap_envelope" in patch

    live_val = bool(patch.get("live_on_ecom")) if set_live else None
    img_val = patch.get("image_url") if set_img else None
    cust_val = patch.get("customizations") if set_cust else None
    asap_val = patch.get("asap_envelope") if set_asap else None

    if set_cust and not isinstance(cust_val, list):
        cust_val = []
    if set_asap and not isinstance(asap_val, dict):
        asap_val = {}

    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        row = await con.fetchrow(
            """update catalogue_skus set
                       live_on_ecom   = case when $3 then $4 else live_on_ecom end,
                       image_url      = case when $5 then $6 else image_url end,
                       customizations = case when $7 then $8 else customizations end,
                       asap_envelope  = case when $9 then $10 else asap_envelope end,
                       seeded = false
                     where id=$1 and tenant_id=$2
                   returning id, code, name, family, base_unit, variable_weight, price,
                             in_assortment, live_on_ecom, image_url, customizations, asap_envelope,
                             medusa_variant_id, medusa_product_id""",
            sku_id, tenant,
            set_live, live_val,
            set_img, img_val,
            set_cust, cust_val if set_cust else None,   # jsonb codec encodes the list
            set_asap, asap_val if set_asap else None,   # jsonb codec encodes the dict
        )
        if not row:
            return None
        d = dict(row)
        # Write-through to Medusa product metadata via the outbox (§3). Enqueue inside the SAME txn as
        # the catalogue write so the projection intent commits atomically with the edit. Idempotent on
        # idem_key; each edit gets a fresh monotonic key so the latest edit always pushes (last-write
        # -wins on metadata). Older still-pending product rows for this sku are harmless but we mark
        # them superseded to keep the outbox tidy.
        await _enqueue_product_metadata(con, d, tenant)
    return _sku_row(d)


async def _enqueue_product_metadata(con, sku_row: Dict[str, Any], tenant: str) -> None:
    """Record a Medusa product-metadata write-through intent on the outbox. The payload carries the join
    key (medusa_variant_id / medusa_product_id / sancho_sku_id) + the e-commerce metadata to merge. Flag
    -safe: the drainer no-ops until MEDUSA_SYNC_ENABLED flips; the intent is never lost."""
    sku_id = sku_row.get("id")
    seq = int(time.time() * 1000)  # monotonic-enough: each edit is a distinct push (last-write-wins)
    idem = f"product:{sku_id}:{seq}:update_product"
    payload = {
        "sancho_sku_id": sku_id,
        "medusa_variant_id": sku_row.get("medusa_variant_id"),
        "medusa_product_id": sku_row.get("medusa_product_id"),
        "metadata": {
            "live_on_ecom": bool(sku_row.get("live_on_ecom")),
            "image_url": sku_row.get("image_url"),
            "customizations": _jpipe(sku_row.get("customizations")) or [],
            "asap_envelope": _jpipe(sku_row.get("asap_envelope")) or {},
            "seeded": False,  # an operator edit un-seeds the product (mirrors the catalogue row)
        },
    }
    try:
        # Supersede prior still-pending product writes for this sku (keep only the newest intent).
        await con.execute(
            """update medusa_sync set status='done', updated_at=now()
                 where tenant_id=$1 and op='update_product' and status in ('pending','in_flight')
                   and payload->>'sancho_sku_id' = $2""",
            tenant, str(sku_id))
        await con.execute(
            """insert into medusa_sync
                 (tenant_id, sancho_order_id, sancho_seq, op, idem_key, payload, seeded)
               values ($1,$2,$3,'update_product',$4,$5,false)
               on conflict (idem_key) do nothing""",
            tenant, f"product:{sku_id}", seq % 2147483647, idem, payload)  # jsonb codec encodes the dict
    except Exception:
        # Never let an outbox enqueue failure roll back the catalogue edit the operator just made.
        log.exception("catalogue._enqueue_product_metadata failed for sku=%s", sku_id)


# ══ §5.8b · CREATING A CATALOGUE ROW FROM A THING SOMEBODY IS HOLDING ═════════════════════════════
# Peter, 2026-07-27: "if there's no matching, we need to match to an inventory item. If there's an SKU
# item, you need to ask them, 'Do you have an SKU code, or would you like to generate one?'"
#
# The whole of this block exists to make that ONE question answerable safely. Everything else about a
# product can be inferred from the read or left honestly empty; the CODE cannot, because a code is an
# identity and identities are not ours to invent quietly.

# THE MARK. Every code we mint starts `ROC-`, and that prefix is the point: the operator must never
# have to wonder whether a code came out of his own ERP or out of us. No Spanish wholesale ERP in this
# trade emits `ROC-`, so the string itself is the disclosure — no tooltip, no column, no explanation.
# (Uniqueness is NOT the mark's job; `next_code` + the collision check below do that. If some ERP did
# emit `ROC-CHO-001`, the collision check simply moves to 002.)
CODE_MARK = "ROC"
# `ROC-<3 letters>-<3+ digits>`: family/product stem, then a per-stem sequence. Four digits are legal
# so the scheme does not break at a thousand rows in one family — it just gets one character longer.
_CODE_RE = re.compile(r"^" + CODE_MARK + r"-([A-Z]{3})-(\d{3,})$")
_CODE_MAX = 64                     # a code is written on an albarán; anything longer is a paste error

# Words that are never the identity of a product, dropped when the stem is derived. Deliberately tiny:
# only articles/prepositions/conjunctions, never anything that distinguishes a product.
_STEM_STOP = {"de", "del", "la", "el", "los", "las", "al", "a", "y", "e", "o", "u",
              "con", "sin", "en", "para", "por", "un", "una", "unos", "unas"}
_STEM_FALLBACK = "GEN"             # «genérico» — a name that reduces to nothing still gets a code


def _norm_code(raw: Any) -> str:
    """A code AS THE SUPPLIER WROTE IT, minus the things that are typing rather than identity:
    surrounding and repeated whitespace, and case. Nothing else is touched — hyphens, slashes, dots
    and leading zeros are their ERP's format and are not ours to tidy. Empty ⇒ ''."""
    return " ".join(str(raw or "").split()).upper()[:_CODE_MAX]


def code_stem(name: str, family: str = "") -> str:
    """The three-letter middle of a generated code — `CHORIZO SARTA EXTRA` ⇒ `CHO`, family
    `embutidos` ⇒ `EMB`. PURE.

    The FAMILY wins when there is one, because that is how this trade files things and it groups the
    generated codes the way the boss already thinks; the product NAME is the fallback. Digits, unit
    words and the tiny stop-list are skipped, so «500 G DE FUET» stems on `FUE`, not on `500`. A word
    shorter than three letters is padded with X rather than reaching for the next word: `ROC-TEX-001`
    is odd-looking, and odd-looking is correct — it is generated, and it should read that way."""
    from brain import matcher  # ONE normaliser for the whole product
    toks = [t for t in matcher.normalize(family or name).split()
            if t.isalpha() and t not in _STEM_STOP and t not in matcher._UNIT_WORDS]
    if not toks and family:                          # a family of only stop/unit words ⇒ try the name
        toks = [t for t in matcher.normalize(name).split()
                if t.isalpha() and t not in _STEM_STOP and t not in matcher._UNIT_WORDS]
    word = "".join(ch for ch in (toks[0] if toks else "") if ch.isalpha()).upper()
    return (word + "XXX")[:3] if word else _STEM_FALLBACK


def next_code(stem: str, taken: Iterable[str]) -> str:
    """The next free `ROC-<stem>-<n>` given everything already used on this tenant. PURE, so the rule
    is testable with no database — which matters, because "unique" is the only promise a code makes.

    The sequence is per STEM (embutidos and quesos each count from 001 — that is how a person reads a
    code list), continues from the highest existing number rather than filling gaps (a reused number
    would point two different histories at one string), and is then checked against EVERY code on the
    tenant, including the supplier's own, so a generated code can never shadow one of theirs."""
    used = {_norm_code(c) for c in (taken or []) if _norm_code(c)}
    stem = (stem or _STEM_FALLBACK).upper()[:3]
    n = 0
    for c in used:
        m = _CODE_RE.match(c)
        if m and m.group(1) == stem:
            n = max(n, int(m.group(2)))
    while True:
        n += 1
        cand = f"{CODE_MARK}-{stem}-{n:03d}"
        if cand not in used:
            return cand


def is_generated_code(code: Any) -> bool:
    """Did WE mint this code? The app shows a generated code differently from the supplier's own."""
    return bool(_CODE_RE.match(_norm_code(code)))


async def catalogue_index(con, tenant: str) -> Dict[str, Any]:
    """Everything a create needs to know about what is ALREADY there, in one query:
    {codes:set, by_code:{CODE→row}, by_name:{normalised name→row}, families:[…]}.

    One read rather than three because all three questions are asked together, every time, and because
    the name check has to happen in Python: there is no normalised-name column, and comparing raw text
    would let «Salsa Brava» and «SALSA BRAVA  » become two rows for one product."""
    from brain import matcher
    try:
        rows = await con.fetch(
            "select id, code, name, family, base_unit, in_assortment from catalogue_skus "
            " where tenant_id = $1", tenant)
    except Exception:
        log.exception("catalogue_index failed for %s", tenant)
        raise
    codes, by_code, by_name = set(), {}, {}
    fams: Dict[str, int] = {}
    for r in rows:
        d = dict(r)
        c = _norm_code(d.get("code"))
        if c:
            codes.add(c)
            by_code.setdefault(c, d)
        nm = matcher.normalize(d.get("name") or "")
        if nm:
            by_name.setdefault(nm, d)
        f = (d.get("family") or "").strip()
        if f:
            fams[f] = fams.get(f, 0) + 1
    return {"codes": codes, "by_code": by_code, "by_name": by_name,
            "families": [f for f, _ in sorted(fams.items(), key=lambda kv: (-kv[1], kv[0]))],
            "n": len(rows)}


async def suggest_code(con, tenant: str, *, name: str, family: str = "",
                       index: Optional[Dict[str, Any]] = None) -> str:
    """The code we WOULD mint for this product — so «¿te lo genero yo?» can show the actual string
    before he agrees to it. Reserves nothing: two callers a second apart get the same suggestion, and
    `create_sku` is where a number is actually claimed."""
    idx = index if index is not None else await catalogue_index(con, tenant)
    return next_code(code_stem(name, family), idx["codes"])


# ── the refusals, and their es-ES sentences ──────────────────────────────────────────────────────
# Typed, like golive's — the caller maps a reason to copy, and every one of these is a thing the
# operator can act on standing where he is. NONE of them is an exception: a raise here would abort a
# stock count over a naming collision.
_REFUSALS = {
    "no_tenant":  "No sé de qué empresa es este producto.",
    "no_name":    "Necesito el nombre del producto para poder darlo de alta.",
    "no_code":    "Dime el código que le das tú, o te lo genero yo.",
    "code_taken": "Ese código ya lo tiene otro producto tuyo.",
    "name_taken": "Ya tienes ese producto en el catálogo.",
    "failed":     "No he podido dar de alta el producto. Vuelve a intentarlo.",
}


def refusal(reason: str, **extra: Any) -> Dict[str, Any]:
    return {"ok": False, "reason": reason, "detail": _REFUSALS.get(reason, _REFUSALS["failed"]),
            **extra}


def _clean_price(v: Any) -> Optional[float]:
    """A price, or NOTHING. **NULL NEVER BECOMES 0** — that is the whole function.

    A zero price is not "unknown", it is "free", and a free wholesale product does not exist. If a
    0 ever reached this column it would flow into the order total, the Excel and the invoice as a real
    number nobody typed. So 0, negatives, blanks and unparseable text all become NULL, which every
    read in this codebase already renders as «sin precio» rather than «0,00 €»."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v) if v > 0 else None
    s = str(v).strip().replace("€", "").replace(" ", "")
    if not s:
        return None
    if "," in s and "." in s:                        # 1.234,56 vs 1,234.56 — the LAST one is decimal
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        f = float(s)
    except ValueError:
        return None
    return f if f > 0 else None


def _base_unit_of(raw: str) -> str:
    """`caja` ⇒ case, `kg` ⇒ kg … — BORROWED from `brain/golive._base_unit` rather than copied.

    The wizard and the warehouse must not disagree about what «caja» means: if they did, the same
    product uploaded from a spreadsheet and created from a pallet would be priced by different units
    and the matcher's unit check would fire on one and not the other. Borrowing a private name is the
    smaller sin; a second answer to a domain question is the bigger one. Falls back to the schema
    default only if that import ever disappears, and says so in the log rather than silently."""
    try:
        from brain import golive
        return golive._base_unit(raw or "")
    except Exception:
        log.warning("catalogue: golive._base_unit unavailable — defaulting base_unit to kg")
        return "kg"


async def create_sku(con, tenant: str, *, name: str, code: Optional[str] = None,
                     generate_code: bool = False, family: str = "", unit: str = "",
                     base_unit: str = "", pack_factor: Any = None, variable_weight: Any = None,
                     price: Any = None, in_assortment: bool = True,
                     created_from: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """CREATE ONE CATALOGUE ROW — the answer to «no lo encuentro en tu catálogo».

    Returns `{ok:True, sku, code, code_generated, embedded, aliases, note}` or a typed refusal
    `{ok:False, reason, detail, sku?}`. NEVER raises for a domain reason; only a dead database gets
    out of here as an exception.

    THE CODE, which is the only question worth asking (Peter's own framing):
      · `code` supplied     → theirs, kept verbatim (case-folded, whitespace collapsed, nothing else).
      · `generate_code=True`→ `ROC-<FAM>-<NNN>`, minted under a per-tenant advisory lock so two phones
                              in the same warehouse cannot claim one number.
      · neither             → REFUSED with `no_code`. We do not pick silently on his behalf: a code is
                              an identity, and an identity invented without being asked is the exact
                              thing §5.7a forbids one layer down.

    IT REFUSES RATHER THAN DUPLICATES. A code already on this tenant, or a name that normalises onto a
    row already on this tenant, comes back as a refusal CARRYING THAT ROW — because "you already have
    this" is not an error, it is the match he was looking for, and the screen can point the line at it
    with one tap. That is also the last defence against the matcher having simply failed to find
    something that was there all along (a missing embedding, a name written a different way).

    WHAT THE ROW CARRIES, and where each field comes from:
      name             the operator's (or the read's) words, verbatim
      code             his, or ours — see above
      family           only if given; NEVER inferred from a rejected candidate. The nearest thing in
                       the catalogue to a product we just decided is NOT in the catalogue is not
                       evidence about anything, and a wrong familia is a wrong code prefix forever
      base_unit        inferred from the unit the read heard («cajas» ⇒ case), via golive's own map
      pack_factor      1 unless stated — the schema default, and the same thing the wizard writes,
                       because "how many are in a box" is not visible in a photograph
      variable_weight  false unless stated — same reason
      price            NULL unless a real positive number was given (`_clean_price`: NULL never 0)
      in_assortment    true — he is holding it
      seeded           FALSE, always. A created row is real, so no re-seed may ever touch it
      attrs.created_from  the provenance: capture id, photograph, the words heard, who, when

    AND IT IS SEARCHABLE THE INSTANT IT COMMITS, which is the only reason any of this is worth doing:
    the very next order naming this product has to ground. Three indexes, the same three
    `brain/seed.load_catalogue` writes, in one transaction —
      1. `embedding`   the dense lift, via the identical `embed.aembed_passages` path over the same
                       name+family doc. If the encoder is unavailable the row is STILL created and
                       `embedded` comes back False with a sentence saying so — never a silent half-row
      2. `search_text` the FTS floor, `to_tsvector('english', …)`. ⚠️ 'english' over Spanish is wrong
                       for the language and RIGHT for the system: `brain/matcher` queries this column
                       with `websearch_to_tsquery('english', …)`, and a config mismatch would stop the
                       deterministic floor firing at all. It moves WITH matcher.py, never before it.
                       THE CODE IS IN THE DOCUMENT — that is §5.7a's own argument ("a customer quoting
                       a real code must hit deterministically") and neither seed.py nor golive.py puts
                       it there today
      3. `sku_aliases` the exact normalised name and the code, as `source='create'` — a source string
                       no other loader deletes, so a re-seed and a re-upload both leave them alone.
                       An alias another SKU already owns is skipped, never stolen
    Then `vocab.refresh` (the trade's own way of saying it — «sarta», «del 55») and the debounced
    directory rebuild, both fail-soft, exactly as the go-live path does it.
    """
    from brain import embed, matcher, vocab

    tenant = (tenant or "").strip().lower()
    if not tenant:
        return refusal("no_tenant")
    name = " ".join(str(name or "").split())[:300]
    if not name:
        return refusal("no_name")
    family = " ".join(str(family or "").split())[:120]
    supplied = _norm_code(code)
    if not supplied and not generate_code:
        return refusal("no_code")

    bu = (base_unit or "").strip().lower() or _base_unit_of(unit)
    if bu not in ("kg", "unit", "pack", "case"):
        bu = _base_unit_of(unit)
    try:
        pf = float(pack_factor) if pack_factor is not None else 1.0
    except (TypeError, ValueError):
        pf = 1.0
    pf = pf if pf and pf > 0 else 1.0
    vw = bool(variable_weight)
    eur = _clean_price(price)
    doc = ". ".join([p for p in (name, family.replace("_", " ")) if p])

    # THE EMBEDDING IS COMPUTED BEFORE THE TRANSACTION. It is the slow part (an ONNX forward pass, and
    # a cold model load the first time), and holding a per-tenant advisory lock across it would make
    # two operators counting two aisles queue behind each other's encoder.
    vec, embedded, note = None, False, ""
    try:
        vec = (await embed.aembed_passages([doc]))[0]
        embedded = True
    except Exception:
        log.exception("catalogue.create_sku: embedding failed for %s / %r", tenant, name)
        note = ("Lo he dado de alta, pero todavía no lo reconozco por el nombre suelto. "
                "Escríbelo tal cual o dime el código y lo encuentro igual.")

    try:
        async with con.transaction():
            # One writer per tenant while codes are being claimed. xact-scoped, so it is released by
            # the commit or the rollback and can never be leaked by an early return.
            await con.execute("select pg_advisory_xact_lock(hashtext($1))", f"rocoto:sku_new:{tenant}")
            idx = await catalogue_index(con, tenant)

            if supplied and supplied in idx["codes"]:
                return refusal("code_taken", sku=_existing(idx["by_code"][supplied]))
            clash = idx["by_name"].get(matcher.normalize(name))
            if clash:
                return refusal("name_taken", sku=_existing(clash))

            final_code = supplied or next_code(code_stem(name, family), idx["codes"])
            generated = not supplied

            # IDENTITY, and why it is hashed rather than sequential: the same product created twice
            # (a double tap, a retry after a dropped response) must be the SAME row, not two.
            ident = final_code if supplied else f"{matcher.normalize(name)}|{bu}"
            sku_id = f"{tenant}#new:" + hashlib.sha256(
                f"{tenant}|{ident}".encode()).hexdigest()[:12]

            prov = dict(created_from or {})
            prov.setdefault("at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
            prov.setdefault("via", "stock_capture")

            row = await con.fetchrow(
                """insert into catalogue_skus
                     (id, tenant_id, code, name, family, base_unit, pack_factor, variable_weight,
                      price, in_assortment, embedding, search_text, attrs, seeded)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, to_tsvector('english',$12), $13, false)
                   on conflict (id) do nothing
                   returning id, code, name, family, base_unit, pack_factor, variable_weight, price,
                             in_assortment, seeded, attrs, live_on_ecom, image_url, customizations,
                             asap_envelope, medusa_variant_id""",
                sku_id, tenant, final_code, name, family, bu, pf, vw, eur, bool(in_assortment), vec,
                # THE FTS DOCUMENT carries the code as well as the name and the family — see above.
                " ".join([name, family.replace("_", " "), final_code]).strip(),
                {"doc": doc, "src": "create", "created_from": prov})
            if row is None:
                # `do nothing` fired: the same identity is already here (a retry, or a double tap).
                # That is not a failure and it is not a second row — hand back the row that exists.
                have = await con.fetchrow(
                    """select id, code, name, family, base_unit, pack_factor, variable_weight, price,
                              in_assortment, seeded, attrs, live_on_ecom, image_url, customizations,
                              asap_envelope, medusa_variant_id
                         from catalogue_skus where id=$1 and tenant_id=$2""", sku_id, tenant)
                if have is None:
                    return refusal("failed")
                return {"ok": True, "sku": _sku_row(dict(have)), "code": have["code"],
                        "code_generated": is_generated_code(have["code"]), "embedded": True,
                        "aliases": 0, "already_existed": True, "note": ""}

            n_alias = await _write_create_aliases(con, tenant, sku_id, name, final_code)
            # The trade's own words for this row («sarta», «del 55», «fuet de 500»). Deterministic,
            # no model, no network — safe inside this transaction, which is exactly how go-live uses
            # it. It savepoints itself, so a vocabulary hiccup can never lose the product.
            await vocab.refresh(con, tenant)
    except Exception:
        log.exception("catalogue.create_sku failed for %s / %r", tenant, name)
        return refusal("failed")

    # The §6 supplier-card directory should learn the new product. Debounced and fail-soft — a
    # directory that is a minute stale is not a reason to fail a creation that already committed.
    try:
        import directory
        directory.schedule_rebuild(tenant)
    except Exception:
        log.debug("catalogue.create_sku: directory schedule_rebuild fail-soft", exc_info=True)

    log.info("catalogue: created %s %s (%s) for %s — embedded=%s aliases=%d",
             sku_id, final_code, "generado" if generated else "suyo", tenant, embedded, n_alias)
    return {"ok": True, "sku": _sku_row(dict(row)), "code": final_code,
            "code_generated": generated, "embedded": embedded, "aliases": n_alias,
            "already_existed": False, "note": note}


def _existing(r: Dict[str, Any]) -> Dict[str, Any]:
    """The thin shape a refusal carries — enough for the screen to say WHICH row is in the way and to
    point the line at it, without pretending to be a full product read."""
    return {"sku_id": r.get("id"), "id": r.get("id"), "code": r.get("code"), "name": r.get("name"),
            "family": r.get("family") or "", "base_unit": r.get("base_unit") or "kg",
            "in_assortment": bool(r.get("in_assortment", True))}


async def _write_create_aliases(con, tenant: str, sku_id: str, name: str, code: str) -> int:
    """The deterministic floor for a brand-new row: its exact name, its code, and the code with the
    separators taken out (`ROC-CHO-001` ⇒ `roccho001`, because that is how a code gets said and typed).

    `source='create'` on purpose — `seed.load_catalogue` deletes `source='seed'`, `golive` deletes
    `source='golive'`, and neither has ever heard of this one, so a re-seed and a re-upload both leave
    these alone. An alias ANOTHER sku already owns is skipped rather than inserted: two rows behind one
    alias makes `_alias_lookup`'s `limit 1` a coin toss, and a coin toss is precisely what the abstain
    law exists to prevent."""
    from brain import matcher
    cands = [matcher.normalize(name)]
    nc = matcher.normalize(code)
    # A purely numeric short code («12») is NOT aliased: it would collide with a bare quantity, and a
    # customer saying «12» has told us a number, not a product. Letters, or four digits, or nothing.
    if nc and (any(ch.isalpha() for ch in nc) or len(nc.replace(" ", "")) >= 4):
        cands += [nc, nc.replace(" ", "")]
    n = 0
    for a in dict.fromkeys([c for c in cands if c]):
        owner = await con.fetchval(
            "select sku_id from sku_aliases where tenant_id=$1 and alias=$2 limit 1", tenant, a)
        if owner and owner != sku_id:
            log.info("catalogue: alias %r already belongs to %s — not stealing it for %s",
                     a, owner, sku_id)
            continue
        if owner == sku_id:
            continue
        await con.execute(
            "insert into sku_aliases (tenant_id, alias, sku_id, phone_number, source, weight) "
            "values ($1,$2,$3,null,'create',1)", tenant, a, sku_id)
        n += 1
    return n
