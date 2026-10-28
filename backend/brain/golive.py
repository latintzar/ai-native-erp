"""brain/golive.py — the catalogue→grounding bridge (M1M2-BUILD-PLAN WP-1 + its hardening).

The missing rail between the onboarding wizard and the live grounding catalogue: the wizard parses a
supplier's catalogue into `wizard_state.skus` (brain/skuparse.py) but nothing ever wrote those rows
into `catalogue_skus` — so an onboarded supplier's matcher grounded against NOTHING and
`lifecycle.has_catalogue()` stayed false (reviews/backend-mvp-completeness-2026-07-23 §2).

seed_catalogue(tenant, skus) — TOKEN-FREE and re-runnable (the WP-2 golive endpoint, a re-upload and
a repair run all call the same function):
  · tenant-scoped ids `{tenant}:{content-hash}` — the id embeds the tenant so two tenants' rows can
    NEVER collide on the global `catalogue_skus.id` PK (eng F4), and the upsert is additionally
    tenant-guarded (`where catalogue_skus.tenant_id = excluded.tenant_id`) as belt-and-braces.
  · embeds via the exact seed.py fastembed path (embed.aembed_passages over the name+family doc);
    a row whose content hash is unchanged is NOT re-embedded — a re-run of the same set is a no-op.
  · removed SKUs flip `in_assortment=false` (eng F5 — the re-upload path): rows in this bridge's
    namespace (id under the tenant prefix) absent from the new set stop matching clean, but the row
    (and any learned aliases keyed on its sku_id) survives for when the product returns.
  · REFUSES 0 SKUs (eng F13): a bad/empty upload can never wipe a live grounding catalogue.
  · spine: logs `onboarding.catalogue_seeded` on the tenant scope (deduped on the set hash) and arms
    the DEBOUNCED directory rebuild (directory.schedule_rebuild → distill → the existing
    `onboarding.catalogue_ready` event) so the §6 supplier-card directory follows automatically.

seed_from_wizard(lead_id, tenant=None) — the wizard_state.skus → seed_catalogue adapter: reads the
lead's latest LIVE (non-test) wizard state, resolves the tenant (explicit arg > the token's
tenant_slug) and seeds the parsed rows {code,name,family,unit,price}. Typed refusals
({ok: False, reason}) — never raises on bad input; the caller maps reasons to es-ES copy (dx F3).

WP-2 (the go-live step — the missing back half of onboarding):
  readiness(scope) — the READINESS block {paid_at, has_catalogue, number, active, blocking[]} the CR
    account payload carries (dx F2: Peter always SEES why Activar is absent). Every blocking entry is
    a typed reason + its es-ES copy (dx F3).
  activate(scope, number) — paid + catalogue → seed (WP-1, idempotent) → number bound (E.164 +
    uniqueness) → `tenants.golive_at` ATOMIC claim (one-shot: welcome/bind/activation can never fire
    twice; a second call is a friendly {ok, already_live}) → lifecycle asserted (derived from
    paid+catalogue, never forced) → welcome WhatsApp + app link (gate-checked, egress-sandbox aware).
    The AUTH + write-ahead cr_audit live in cr_control.golive (refund discipline) — this organ owns
    only the domain flow. Everything logs spine events as always.
"""
from __future__ import annotations

import hashlib
import logging
import re
import unicodedata
from typing import Any, Dict, List, Optional

import asyncpg

import config
import db
import tenancy
from brain import embed, matcher, vocab

log = logging.getLogger("rocoto.golive")

# Tenant slugs are ltree-safe lowercase identifiers (runtime scopes are `t.<slug>.…`).
_TENANT_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")

# unit-as-written (skuparse: "kg, g, ud, caja, docena, litro, sarta, pieza…") → catalogue base_unit
# (kg | unit | pack | case — the domain matcher._unit_check reasons over). The raw wording is kept in
# attrs.unit_raw so nothing the supplier wrote is lost. Unknown non-weight wording maps to "unit"
# (the conservative side: a weight-worded order against it flags for review instead of passing).
_UNIT_KG = {"kg", "kgs", "kilo", "kilos", "quilo", "quilos", "k"}
_UNIT_PACK = {"pack", "packs", "paquete", "paquetes", "bolsa", "bolsas", "lote", "lotes"}
_UNIT_CASE = {"caja", "cajas", "case", "cases", "box", "boxes"}


def _base_unit(raw: str) -> str:
    toks = matcher.normalize(raw or "").split()
    if not toks:
        return "kg"                      # the schema default — unstated units stay weight-priced
    if any(t in _UNIT_KG for t in toks):
        return "kg"
    if any(t in _UNIT_CASE for t in toks):
        return "case"
    if any(t in _UNIT_PACK for t in toks):
        return "pack"
    return "unit"


def _price(p: Any) -> Optional[float]:
    """Wizard price → numeric EUR or None. Tolerates '9,50 €' strings from the heuristic parser."""
    if p is None or isinstance(p, bool):
        return None
    if isinstance(p, (int, float)):
        return float(p) if p > 0 else None
    try:
        v = float(str(p).strip().replace("€", "").replace(",", ".").strip())
        return v if v > 0 else None
    except ValueError:
        return None


def _doc_text(name: str, family: str) -> str:
    """The embedding doc — same discipline as seed.py's _doc_text (wizard rows carry no aliases)."""
    parts = [name]
    if family:
        parts.append(family.replace("_", " "))
    return ". ".join(parts)


def _normalize_skus(skus: Any) -> List[Dict[str, Any]]:
    """Wizard rows {code,name,family,unit,price} (seed-shaped `base_unit` also accepted) → canonical
    rows, deduped by identity (last row wins — messy sheets repeat lines). Identity = the supplier's
    own code when present (a rename keeps the same sku_id, so learned aliases survive), else the
    normalized name + base unit."""
    out: Dict[str, Dict[str, Any]] = {}
    for s in skus or []:
        if not isinstance(s, dict):
            continue
        name = str(s.get("name") or "").strip()
        if not name:
            continue
        code = str(s.get("code") or "").strip()
        family = str(s.get("family") or "").strip()
        unit_raw = str(s.get("unit") or s.get("base_unit") or "").strip()
        bu = _base_unit(unit_raw)
        ident = code if code else f"{matcher.normalize(name)}|{bu}"
        out[ident] = {"ident": ident, "code": code or None, "name": name, "family": family,
                      "base_unit": bu, "unit_raw": unit_raw, "price": _price(s.get("price"))}
    return list(out.values())


def normalize_skus(skus: Any) -> List[Dict[str, Any]]:
    """PUBLIC alias of `_normalize_skus` — the §5.10.2 preview MUST derive its rows through the
    writer's own normalisation, never a second implementation, or the day the two drift the screen
    promises something the commit does not do."""
    return _normalize_skus(skus)


def _decorate(tenant: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Stamp the derived identity onto normalized rows: the tenant-namespaced `id`, the embedding
    `doc`, and the content `row_hash` the upsert compares against. Extracted from `seed_catalogue`
    so `plan()` computes the SAME ids — one derivation, two callers (§5.10.4)."""
    for r in rows:
        r["id"] = tenant + ":" + hashlib.sha256(f"{tenant}|{r['ident']}".encode()).hexdigest()[:16]
        r["doc"] = _doc_text(r["name"], r["family"])
        r["row_hash"] = hashlib.sha256(
            f"{r['code']}|{r['name']}|{r['family']}|{r['base_unit']}|{r['price']}|{r['unit_raw']}"
            .encode()).hexdigest()[:16]
    return rows


def _like_prefix(tenant: str) -> str:
    """LIKE pattern for this tenant's id namespace, wildcards escaped (slug '_' would match any char)."""
    esc = tenant.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return esc + ":%"


async def seed_catalogue(tenant: str, skus: List[Dict[str, Any]],
                         carry_over: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """Seed/refresh a tenant's grounding catalogue from parsed SKU rows. Re-runnable and idempotent:
    same set → zero re-embeds, zero new rows, the spine event dedupe-swallowed. Returns
    {ok, tenant, skus, embedded, unchanged, reactivated, removed, carried, set_hash} or
    {ok: False, reason}.

    `carry_over` is the §5.10.2 RENAME answer: `[{"from": <old sku id>, "to": <new sku id>}, …]`,
    each pair confirmed by a human on the preview. On a supplier whose export has no reference
    column a SKU's identity is its normalized name, so renaming an article in the list mints a new
    id and ORPHANS every alias Rocoto spent weeks learning about it — «la de cabeza», «del 55».
    Applied INSIDE this transaction, right after the upserts, so the new row already exists (the
    alias FK points at it) and the retire pass below still sees the old row as absent-and-removed,
    which is exactly right: the article did leave the list, it just took its vocabulary with it."""
    tenant = (tenant or "").strip().lower()
    if not _TENANT_RE.match(tenant):
        return {"ok": False, "reason": "no_tenant"}
    rows = _decorate(tenant, _normalize_skus(skus))
    if not rows:
        return {"ok": False, "reason": "no_skus"}    # refuse: never wipe a live catalogue (eng F13)
    ids = [r["id"] for r in rows]
    set_hash = hashlib.sha256(
        "\n".join(sorted(r["id"] + ":" + r["row_hash"] for r in rows)).encode()).hexdigest()[:32]

    pool = db.get_pool()
    n_removed = 0
    async with pool.acquire() as con:
        existing = {e["id"]: e for e in await con.fetch(
            """select id, attrs->>'row_hash' as row_hash, in_assortment,
                      (embedding is not null) as embedded
                 from catalogue_skus where tenant_id=$1 and id = any($2::text[])""", tenant, ids)}
        # changed/new (or half-written: no embedding) rows get the full embed+upsert; rows whose
        # content hash matches skip embedding entirely — reactivated in place if they were removed.
        upserts = [r for r in rows
                   if not ((e := existing.get(r["id"])) and e["row_hash"] == r["row_hash"]
                           and e["embedded"])]
        upsert_ids = {r["id"] for r in upserts}
        reactivate = [r["id"] for r in rows
                      if r["id"] not in upsert_ids and not existing[r["id"]]["in_assortment"]]

        vecs = await embed.aembed_passages([r["doc"] for r in upserts]) if upserts else []

        # ONE PIPELINED BATCH, NOT ONE ROUND TRIP PER SKU — 2026-08-13, after Peter watched
        # «Guardando» sit there in front of a customer. This was `for r in upserts: await
        # con.execute(...)`, so a 312-row catalogue paid 312 sequential network round trips inside
        # the transaction. Correct, and slow in exactly the place where slowness reads as broken:
        # the last click of the onboarding, with the operator watching.
        #
        # `executemany` sends the same statement with all the argument tuples in one go, so the
        # cost stops scaling with the number of SKUs. The SQL is untouched — same tenant-guarded
        # upsert, same excluded-set — because the row semantics are not what was wrong here.
        payload = []
        for r, vec in zip(upserts, vecs):
            search_src = " ".join([r["name"], r["family"].replace("_", " "),
                                   r["code"] or ""]).strip()
            payload.append((
                r["id"], tenant, r["code"], r["name"], r["family"], r["base_unit"],
                r["price"], vec, search_src or r["name"],
                {"doc": r["doc"], "row_hash": r["row_hash"], "src": "golive",
                 "unit_raw": r["unit_raw"]}))
        async with con.transaction():
            if payload:
                # Tenant-guarded upsert (eng F4): pack_factor/variable_weight are NOT in the update
                # set — the wizard doesn't parse them, so a re-seed never clobbers an operator edit.
                await con.executemany(
                    """insert into catalogue_skus
                         (id, tenant_id, code, name, family, base_unit, pack_factor,
                          variable_weight, price, in_assortment, embedding, search_text, attrs, seeded)
                       values ($1,$2,$3,$4,$5,$6,1,false,$7,true,$8, to_tsvector('english',$9),
                               $10, false)
                       on conflict (id) do update set
                         code=excluded.code, name=excluded.name, family=excluded.family,
                         base_unit=excluded.base_unit, price=excluded.price, in_assortment=true,
                         embedding=excluded.embedding, search_text=excluded.search_text,
                         attrs=excluded.attrs, seeded=false
                       where catalogue_skus.tenant_id = excluded.tenant_id""",
                    payload)
            if reactivate:
                await con.execute(
                    "update catalogue_skus set in_assortment=true "
                    "where tenant_id=$1 and id = any($2::text[])", tenant, reactivate)
            # THE RENAME CARRY-OVER (§5.10.2). Only what a customer TAUGHT us moves: `learned` and
            # `edit` aliases. `seed` and `golive` aliases are rebuilt from the catalogue itself, so
            # dragging them across would just resurrect the old name as a live synonym for the new
            # article — which is the opposite of what a rename means.
            carried = 0
            for pair in (carry_over or []):
                old_id, new_id = str(pair.get("from") or ""), str(pair.get("to") or "")
                if not old_id or not new_id or old_id == new_id or new_id not in set(ids):
                    continue
                tag = await con.execute(
                    "update sku_aliases set sku_id=$3 "
                    "where tenant_id=$1 and sku_id=$2 and source in ('learned','edit')",
                    tenant, old_id, new_id)
                carried += int((tag or "UPDATE 0").split()[-1])
            # removed SKUs → in_assortment=false (eng F5). Scoped to THIS bridge's namespace (the
            # tenant id prefix) so demo-seed / Medusa rows on the same tenant are never touched.
            tag = await con.execute(
                "update catalogue_skus set in_assortment=false "
                "where tenant_id=$1 and id like $2 escape '\\' and in_assortment "
                "  and not (id = any($3::text[]))", tenant, _like_prefix(tenant), ids)
            n_removed = int((tag or "UPDATE 0").split()[-1])
            # golive aliases: rebuilt from the present set each run (exact normalized name → clean
            # alias fast-path). learned/edit/seed aliases are untouched — same discipline as seed.py.
            await con.execute(
                "delete from sku_aliases where tenant_id=$1 and source='golive'", tenant)
            seen: set[str] = set()
            for r in rows:
                # name alias + the CODE aliases (§17.35 M2): a customer who quotes their own
                # article code must hit deterministically. Same guard as `_write_create_aliases`:
                # a purely numeric short code («12») is a number, not a product.
                cands = [matcher.normalize(r["name"])]
                nc = matcher.normalize(r["code"] or "")
                if nc and (any(ch.isalpha() for ch in nc) or len(nc.replace(" ", "")) >= 4):
                    cands += [nc, nc.replace(" ", "")]
                for a in dict.fromkeys(c for c in cands if c):
                    if a in seen:
                        continue
                    seen.add(a)
                    owner = await con.fetchval(
                        "select sku_id from sku_aliases where tenant_id=$1 and alias=$2 limit 1",
                        tenant, a)
                    if owner and owner != r["id"]:
                        continue                    # never steal another sku's alias
                    await con.execute(
                        """insert into sku_aliases (tenant_id, alias, sku_id, phone_number, source, weight)
                           values ($1,$2,$3,null,'golive',1)""", tenant, a, r["id"])
            # THE VOCABULARY PASS (§5.7 / §5.7a — brain/vocab.py). The alias above is the tenant's
            # catalogue name and nothing else; a real customer says «sarta», «del 55», «york». The
            # DETERMINISTIC half runs HERE, in this transaction, because it is pure Python + one
            # bulk insert (~0.9 s on a 2 000-line list, against ~40 s embedding the same upload) —
            # so a tenant can never end up indexed-without-vocabulary: both commit or neither does.
            # It opens a SAVEPOINT of its own, so a vocabulary failure can never take this
            # transaction down with it. The generated half is a lift,
            # scheduled after commit below. Fail-soft by construction (vocab.refresh never raises).
            await vocab.refresh(con, tenant)

    # spine: the seed is an event like everything else — deduped on the set hash so a re-run of the
    # same catalogue is dedupe-swallowed. Fail-soft (an event hiccup never un-seeds the catalogue).
    event_new = False
    try:
        import spine
        scope = f"t.{tenant}"
        async with db.scoped_tx(scope) as scon:
            _, event_new = await spine.append_event(
                scon, scope, "onboarding.catalogue_seeded", "golive",
                {"tenant_id": tenant, "n_skus": len(rows), "embedded": len(upserts),
                 "removed": n_removed, "set_hash": set_hash},
                lane="world", dedupe_key=f"catseed:{tenant}:{set_hash}")
    except Exception:
        log.debug("golive: catalogue_seeded event fail-soft", exc_info=True)
    # the DEBOUNCED directory trigger (review H7): the distill runs once ingest settles and emits
    # the existing `onboarding.catalogue_ready` event — the §6 directory follows automatically.
    try:
        import directory
        directory.schedule_rebuild(tenant)
    except Exception:
        log.debug("golive: directory schedule_rebuild fail-soft", exc_info=True)
    # The GENERATED half of the vocabulary (§5.7a): batched, bounded, cached per row, and never
    # load-bearing — the deterministic floor is already committed above. Only CHANGED/NEW rows cost
    # a model call, so a re-upload of the same catalogue is free.
    vocab.schedule_generation(tenant)

    unchanged = len(rows) - len(upserts) - len(reactivate)
    log.info("golive: catalogue seeded for %s — %d skus (%d embedded, %d unchanged, "
             "%d reactivated, %d removed, %d aliases carried)", tenant, len(rows), len(upserts),
             unchanged, len(reactivate), n_removed, carried)
    return {"ok": True, "tenant": tenant, "skus": len(rows), "embedded": len(upserts),
            "unchanged": unchanged, "reactivated": len(reactivate), "removed": n_removed,
            "carried": carried, "set_hash": set_hash, "event": "new" if event_new else "dedup"}


# ═══ §5.10.2 · THE PREVIEW'S DIFF — what a commit is ABOUT to do, in the writer's own terms ═══════
#
# `/api/app/catalogue/upload` parsed and committed in ONE call: nobody had ever seen what the model
# read before it became the grounding. The preview closes that, and the ONLY safe way to build it is
# from THIS module — `_normalize_skus` for the rows, `_decorate` for the ids, `row_hash` for
# "changed". A preview with its own idea of identity is a preview that lies the first day the two
# disagree, and it would lie about the thing that matters most: whether an article is NEW.

_CHANGED_FIELDS = ("name", "family", "base_unit", "price", "code", "unit_raw")


def _near(a: str, b: str) -> float:
    """How alike two normalized product names are, 0…1. `difflib` is enough and it is in the
    stdlib — the alternative is a trigram index for a list a human is about to read anyway."""
    import difflib
    return difflib.SequenceMatcher(None, a, b).ratio()


async def plan(tenant: str, skus: List[Dict[str, Any]]) -> Dict[str, Any]:
    """What `seed_catalogue(tenant, skus)` WOULD do, in the four buckets an operator thinks in.

    → {ok, tenant, total, nuevos, cambian, iguales, salen, renames} — or {ok: False, reason}.
      · nuevos   the derived id is not in the catalogue yet
      · cambian  present, content hash differs → carries field-level before/after
      · iguales  present and byte-identical (a COUNT — these cost nothing and re-embed nothing;
                 the number is the reassurance that a re-upload is cheap, so it is shown)
      · salen    present, in assortment, inside THIS bridge's id namespace, absent from the new
                 list. Nothing is deleted: the row survives, keeps its history and its learned
                 aliases, and returns the day it reappears in a list.
      · renames  a `nuevos` row whose name is a near-neighbour of a `salen` row, WITH the count of
                 learned aliases that would be orphaned. Only offered where the supplier's list has
                 no reference column for that article — with a code, identity is the code and a
                 rename keeps the same id, so there is nothing to rescue and nothing to ask.

    READ-ONLY, and computed against the destination at READ time so it can never be stale."""
    tenant = (tenant or "").strip().lower()
    if not _TENANT_RE.match(tenant):
        return {"ok": False, "reason": "no_tenant"}
    rows = _decorate(tenant, _normalize_skus(skus))
    if not rows:
        return {"ok": False, "reason": "no_skus"}
    ids = [r["id"] for r in rows]
    by_id = {r["id"]: r for r in rows}

    pool = db.get_pool()
    async with pool.acquire() as con:
        present = {e["id"]: dict(e) for e in await con.fetch(
            """select id, code, name, family, base_unit, price::float8 as price, in_assortment,
                      attrs->>'row_hash' as row_hash, attrs->>'unit_raw' as unit_raw
                 from catalogue_skus where tenant_id=$1 and id = any($2::text[])""", tenant, ids)}
        leaving = [dict(e) for e in await con.fetch(
            """select id, code, name, family, base_unit, price::float8 as price
                 from catalogue_skus
                where tenant_id=$1 and id like $2 escape '\\' and in_assortment
                  and not (id = any($3::text[])) order by name""",
            tenant, _like_prefix(tenant), ids)]
        alias_n = {r["sku_id"]: int(r["n"]) for r in await con.fetch(
            """select sku_id, count(*) as n from sku_aliases
                where tenant_id=$1 and source in ('learned','edit')
                  and sku_id = any($2::text[]) group by sku_id""",
            tenant, [r["id"] for r in leaving])} if leaving else {}

    def _wire(r: Dict[str, Any]) -> Dict[str, Any]:
        return {"id": r["id"], "code": r.get("code") or "", "name": r["name"],
                "family": r.get("family") or "", "base_unit": r["base_unit"],
                "price": r.get("price"), "unit_raw": r.get("unit_raw") or ""}

    nuevos, cambian, iguales = [], [], 0
    for r in rows:
        e = present.get(r["id"])
        if e is None:
            nuevos.append(_wire(r))
        elif e["row_hash"] == r["row_hash"]:
            iguales += 1
        else:
            before = {"name": e["name"], "family": e["family"] or "", "base_unit": e["base_unit"],
                      "price": e["price"], "code": e["code"] or "", "unit_raw": e["unit_raw"] or ""}
            after = {k: _wire(r)[k] for k in _CHANGED_FIELDS}
            cambian.append({**_wire(r), "before": before,
                            "changed": [k for k in _CHANGED_FIELDS if before.get(k) != after.get(k)],
                            "was_removed": not e["in_assortment"]})

    salen = [{**{k: (l.get(k) or "" if k in ("code", "family") else l.get(k)) for k in
                 ("id", "code", "name", "family", "base_unit", "price")},
              "aliases": alias_n.get(l["id"], 0)} for l in leaving]

    # THE RENAME TRAP. Codeless identity + a renamed article = a silent vocabulary wipe.
    renames = []
    codeless_new = [n for n in nuevos if not n["code"] and not (by_id[n["id"]].get("code"))]
    for gone in salen:
        if gone["code"]:
            continue                          # it had a code; a rename would have kept the id
        gnorm = matcher.normalize(gone["name"])
        best, score = None, 0.0
        for cand in codeless_new:
            s = _near(gnorm, matcher.normalize(cand["name"]))
            if s > score:
                best, score = cand, s
        if best is not None and score >= 0.72:
            renames.append({"from": {"id": gone["id"], "name": gone["name"],
                                     "aliases": gone["aliases"]},
                            "to": {"id": best["id"], "name": best["name"]},
                            "score": round(score, 3)})

    return {"ok": True, "tenant": tenant, "total": len(rows), "nuevos": nuevos,
            "cambian": cambian, "iguales": iguales, "salen": salen, "renames": renames}


async def seed_from_wizard(lead_id: str, tenant: Optional[str] = None) -> Dict[str, Any]:
    """The wizard_state.skus → seed_catalogue adapter. Reads the lead's latest LIVE (non-test) wizard
    state — same join discipline as lifecycle._paid_state — and seeds under the resolved tenant
    (explicit arg wins, else the token's tenant_slug). Typed refusals, never raises on bad input."""
    if not (lead_id or "").strip():
        return {"ok": False, "reason": "no_lead"}
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            """select p.wizard_state, t.tenant_slug
                 from onboarding_progress p join onboarding_tokens t on t.token = p.token
                where t.lead_id = $1 and coalesce(p.is_test, false) = false
                order by p.updated_at desc nulls last limit 1""", lead_id)
    if row is None:
        return {"ok": False, "reason": "no_wizard"}
    state = dict(row["wizard_state"]) if row["wizard_state"] else {}
    skus = state.get("skus") if isinstance(state.get("skus"), list) else []
    slug = ((tenant or "").strip() or (row["tenant_slug"] or "").strip()).lower()
    if not slug:
        return {"ok": False, "reason": "no_tenant"}
    if not skus:
        return {"ok": False, "reason": "no_skus"}
    return await seed_catalogue(slug, skus)


# ═══ WP-2 · the go-live step (readiness + activate) ═════════════════════════════════════════════════

# Typed failure reasons → es-ES operator copy (dx F3). The API returns BOTH (reason for machines,
# message for the CR surface) so the UI never invents wording.
REASONS_ES: Dict[str, str] = {
    "no_scope":     "Ámbito no válido — abre la cuenta desde un contacto de WhatsApp.",
    "no_lead":      "Sin ficha de cliente — este número no tiene lead de onboarding.",
    "no_wizard":    "Sin asistente de alta — este cliente no ha empezado el wizard.",
    "not_paid":     "Sin pago — la cuota de alta no está pagada todavía.",
    "no_catalogue": "Sin catálogo — sube los productos primero.",
    "no_skus":      "Sin catálogo — sube los productos primero.",
    "no_number":    "Sin número — introduce el número de WhatsApp del cliente.",
    "bad_number":   "Número no válido — usa el formato internacional (+34…).",
    "number_taken": "Ese número ya está asignado a otro cliente.",
    "no_tenant":    "Sin espacio de trabajo — no se pudo derivar el identificador del negocio.",
    "seed_failed":  "No se pudo cargar el catálogo — revisa los productos del wizard.",
}

_E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")


def _msg(reason: str) -> str:
    return REASONS_ES.get(reason, reason)


def _iso(dt: Any) -> Optional[str]:
    try:
        return dt.isoformat() if dt else None
    except Exception:
        return None


def _wa_phone(scope: str) -> Optional[str]:
    return tenancy.phone_of_scope(scope) or None   # both scope shapes (WP-A1)


def _derive_slug(base: str, lead_id: str) -> str:
    """Deterministic ltree-safe tenant slug for a lead with no stored tenant_slug: ascii-folded
    business/name + a 4-hex lead-id tail (two «Bar Manolo»s can never collide). Underscores only —
    runtime scopes are `t.<slug>.…` and ltree labels reject hyphens."""
    s = unicodedata.normalize("NFKD", (base or "").lower()).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")[:24] or "cliente"
    return f"{s}_{hashlib.sha256((lead_id or '').encode()).hexdigest()[:4]}"


async def _ctx(scope: str) -> Dict[str, Any]:
    """Everything readiness/activate reason over, in one read: the scope's LIVE lead, its latest live
    wizard progress, the resolved tenant slug (stored > derived) and the tenant row's bind state."""
    c: Dict[str, Any] = {"scope": scope, "phone": _wa_phone(scope), "lead_id": None, "name": "",
                         "business": "", "token": None, "tenant_slug_stored": None, "tenant": None,
                         "paid_at": None, "skus": [], "n_cat": 0,
                         "t_number": None, "t_golive_at": None, "t_status": None}
    if not c["phone"]:
        return c
    pool = db.get_pool()
    async with pool.acquire() as con:
        lead = await con.fetchrow(
            "select id, name, business from leads where phone=$1 and coalesce(is_test,false)=false "
            "order by created_at desc limit 1", c["phone"])
        if not lead:
            return c
        c["lead_id"], c["name"], c["business"] = lead["id"], lead["name"] or "", lead["business"] or ""
        row = await con.fetchrow(
            """select t.token, t.tenant_slug, p.paid_at, p.wizard_state
                 from onboarding_tokens t join onboarding_progress p on p.token = t.token
                where t.lead_id = $1 and coalesce(p.is_test, false) = false
                order by p.updated_at desc nulls last limit 1""", c["lead_id"])
        if not row:
            return c
        c["token"], c["tenant_slug_stored"], c["paid_at"] = row["token"], row["tenant_slug"], row["paid_at"]
        state = dict(row["wizard_state"]) if row["wizard_state"] else {}
        c["skus"] = state.get("skus") if isinstance(state.get("skus"), list) else []
        c["tenant"] = (((row["tenant_slug"] or "").strip().lower())
                       or _derive_slug(c["business"] or c["name"], c["lead_id"]))
        c["n_cat"] = int(await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and in_assortment",
            c["tenant"]) or 0)
        t = await con.fetchrow("select number, golive_at, status from tenants where slug=$1", c["tenant"])
        if t:
            c["t_number"], c["t_golive_at"], c["t_status"] = t["number"], t["golive_at"], t["status"]
    return c


def _readiness_of(c: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {"paid_at": _iso(c["paid_at"]), "has_catalogue": c["n_cat"] > 0,
                           "wizard_skus": len(c["skus"]), "number": c["t_number"],
                           "active": c["t_golive_at"] is not None, "golive_at": _iso(c["t_golive_at"]),
                           "tenant": c["tenant"], "blocking": []}

    def block(r: str) -> None:
        out["blocking"].append({"reason": r, "message": _msg(r)})

    if out["active"]:
        return out                                   # live: nothing blocks
    if not c["phone"]:
        block("no_scope"); return out
    if not c["lead_id"]:
        block("no_lead"); return out
    if not c["token"]:
        block("no_wizard"); return out
    if not c["paid_at"]:
        block("not_paid")
    if c["n_cat"] == 0 and not c["skus"]:            # golive can seed from the wizard — only BOTH empty blocks
        block("no_catalogue")
    if not c["t_number"]:                            # satisfied by the Números input, not a hard stop (UI knows)
        block("no_number")
    return out


async def readiness(scope: str) -> Dict[str, Any]:
    """The READINESS block for the CR account payload (dx F2). Fail-soft: any read error surfaces as
    the safe not-ready shape, never an exception into the account card."""
    try:
        return _readiness_of(await _ctx(scope))
    except Exception:
        log.exception("golive: readiness read failed for %s", scope)
        return {"paid_at": None, "has_catalogue": False, "wizard_skus": 0, "number": None,
                "active": False, "golive_at": None, "tenant": None,
                "blocking": [{"reason": "no_scope", "message": _msg("no_scope")}]}


def _app_link() -> str:
    """The app download link the welcome carries — mirrors /api/version (MEDIA_DIR/version.json wins)."""
    try:
        import json as _json
        from pathlib import Path
        vf = Path(config.MEDIA_DIR) / "version.json"
        if vf.exists():
            u = (_json.loads(vf.read_text()) or {}).get("apk_url")
            if u:
                return str(u)
    except Exception:
        log.debug("golive: version.json read fail-soft", exc_info=True)
    return config._env("ROCOTO_APK_URL", "https://files.soyrocoto.com/Rocoto-arm64.apk")


async def _send_welcome(scope: str, phone: str, name: str, tenant: str, number: str) -> Dict[str, Any]:
    """The one-shot welcome (reached only through the golive_at claim). Gate-checked like anything
    SPOKEN; a park or send failure is never a silent drop (SPEC §5) — it lands as a needs_human
    action. EGRESS_SANDBOX suppresses the real rail inside twilio_wa."""
    first = (name or "").split()[0] if (name or "").strip() else ""
    text = (f"¡Bienvenido a Rocoto{', ' + first if first else ''}! 🎉 Tu alta está completa: tu catálogo "
            f"está cargado y tu número {number} queda vinculado. Descárgate la app aquí: {_app_link()} "
            f"— y escríbeme por aquí para lo que necesites. Ya estoy trabajando.")
    import gate
    # MODO SOMBRA (SPEC §5.5) first: the welcome is Rocoto introducing himself, which is exactly the
    # speech a boss in sombra has said he does not want. Held → drafted on the review sheet, and the
    # go-live claim still completes (the alta is done; only the greeting waits for a human).
    if await gate.hold_if_sombra(scope, "message", text, detail={"origin": "golive_welcome"}):
        log.info("golive: SOMBRA for %s — welcome drafted, not sent", scope)
        return {"sent": False, "parked": True, "held": "sombra"}
    try:
        verdict = gate.check_outbound(text)
    except Exception:
        log.exception("golive: gate.check_outbound raised — parking the welcome (fail-closed)")
        verdict = {"ok": False, "needs_approval": True, "reason": "gate_error"}
    sid: Optional[str] = None
    parked = False
    if verdict.get("needs_approval"):
        parked = True
    else:
        import twilio_wa
        try:
            sid = await twilio_wa.send_whatsapp(phone, text)
        except Exception:
            log.exception("golive: welcome send failed for %s — parking", scope)
            parked = True
    if parked:
        try:
            async with db.scoped_tx(scope) as con:
                await con.execute(
                    "insert into action(scope,kind,payload,state,reason,needs_human) "
                    "values($1::ltree,'send_outbound',$2,'pending',$3,true)",
                    scope, {"sentence": text, "surface": "wa", "origin": "golive"},
                    verdict.get("reason") or "welcome send failed")
        except Exception:
            log.exception("golive: welcome park failed for %s", scope)
        return {"sent": False, "parked": True}
    # spine: the welcome is an event like everything else (deduped per tenant — belt under the claim)
    try:
        import spine
        eid = None
        async with db.scoped_tx(scope) as con:
            eid, _ = await spine.append_event(
                con, scope, "msg.sent", "golive",
                {"text": text, "addr": phone, "origin": "golive", "tenant_id": tenant,
                 "wa_message_id": sid},
                lane="world", dedupe_key=f"golive_welcome:{tenant}")
        try:
            import projector
            await projector.project_msg_sent(scope, text, sid, eid)
        except Exception:
            pass
    except Exception:
        log.debug("golive: welcome msg.sent event fail-soft", exc_info=True)
    return {"sent": True, "sid": sid}


async def activate(scope: str, number: str, wa_phone_number_id: str = "") -> Dict[str, Any]:
    """The go-live flow (M1M2 WP-2): validate readiness → seed (WP-1) → atomic golive_at claim
    (bind number + status live, one-shot) → lifecycle asserted (derived, never forced) → welcome.
    Typed refusals {ok: False, reason, message, readiness}; a repeat is {ok: True, already_live}.

    `wa_phone_number_id` is Meta's NUMERIC phone-number id for the line being bound — the key every
    Cloud-API webhook carries and the ONLY thing that tells the inbound door which distributor a
    message is for (see tenancy.tenant_for_wa_number_id). Embedded Signup hands it back at the end of
    the flow; go-live is where it belongs, because a tenant that is live on a number must be
    routable on it. Optional: omitted, the tenant is live but its inbound falls to the single-tenant
    fallback (loudly), which is exactly the state every tenant is in before this pass."""
    ctx = await _ctx(scope)
    rd = _readiness_of(ctx)
    if rd["active"]:
        return {"ok": True, "already_live": True, "tenant": rd["tenant"], "number": rd["number"],
                "golive_at": rd["golive_at"], "readiness": rd}
    hard = [b for b in rd["blocking"] if b["reason"] != "no_number"]
    if hard:
        r = hard[0]["reason"]
        return {"ok": False, "reason": r, "message": _msg(r), "readiness": rd}
    number = re.sub(r"[\s\-.]", "", number or "")
    if not number:
        return {"ok": False, "reason": "no_number", "message": _msg("no_number"), "readiness": rd}
    if not _E164_RE.match(number):
        return {"ok": False, "reason": "bad_number", "message": _msg("bad_number"), "readiness": rd}
    tenant = rd["tenant"]
    if not tenant or not _TENANT_RE.match(tenant):
        return {"ok": False, "reason": "no_tenant", "message": _msg("no_tenant"), "readiness": rd}
    pool = db.get_pool()
    # friendly uniqueness pre-check (the partial unique index is the race-safe belt underneath)
    async with pool.acquire() as con:
        other = await con.fetchval("select slug from tenants where number=$1 and slug<>$2",
                                   number, tenant)
    if other:
        return {"ok": False, "reason": "number_taken", "message": _msg("number_taken"), "readiness": rd}
    # stamp a derived slug onto the token so every later read resolves the SAME tenant
    if ctx["token"] and not (ctx["tenant_slug_stored"] or "").strip():
        async with pool.acquire() as con:
            await con.execute("update onboarding_tokens set tenant_slug=$1 "
                              "where token=$2 and tenant_slug is null", tenant, ctx["token"])
    # (1) the WP-1 bridge — idempotent, re-runnable; a failed seed leaves the claim untouched
    seeded: Dict[str, Any] = {"ok": True, "skus": ctx["n_cat"], "skipped": True}
    if ctx["skus"]:
        seeded = await seed_catalogue(tenant, ctx["skus"])
        if not seeded.get("ok"):
            log.warning("golive: seed refused for %s (%s)", tenant, seeded.get("reason"))
            return {"ok": False, "reason": "seed_failed", "message": _msg("seed_failed"),
                    "detail": seeded.get("reason"), "readiness": rd}
    # (2) the ATOMIC claim: bind + activate exactly once (second caller sees golive_at set → no-op)
    async with pool.acquire() as con:
        await con.execute(
            "insert into tenants (slug, name, status) values ($1,$2,'draft') "
            "on conflict (slug) do nothing", tenant, ctx["business"] or ctx["name"] or tenant)
        try:
            claimed = await con.fetchval(
                "update tenants set golive_at=now(), status='live', number=$2, "
                "  wa_phone_number_id=coalesce(nullif($3,''), wa_phone_number_id), updated_at=now() "
                "where slug=$1 and golive_at is null returning golive_at",
                tenant, number, (wa_phone_number_id or "").strip())
        except asyncpg.UniqueViolationError:      # lost the number race to another tenant
            return {"ok": False, "reason": "number_taken", "message": _msg("number_taken"),
                    "readiness": rd}
    if claimed is None:
        rd2 = await readiness(scope)
        return {"ok": True, "already_live": True, "tenant": tenant, "number": rd2.get("number"),
                "golive_at": rd2.get("golive_at"), "readiness": rd2}
    # (3) lifecycle ASSERT (derives from paid+catalogue — never forced; a miss is a loud log, not a write)
    async with pool.acquire() as con:
        n_cat = int(await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and in_assortment", tenant) or 0)
    lifecycle_state = "onboarded" if (ctx["paid_at"] and n_cat > 0) else "incomplete"
    if lifecycle_state != "onboarded":
        log.warning("golive: %s claimed live but lifecycle does not derive onboarded "
                    "(paid=%s, catalogue=%d)", tenant, bool(ctx["paid_at"]), n_cat)
    # spine: the activation is an event like everything else (one-shot by the claim; deduped as belt)
    try:
        import spine
        tscope = f"t.{tenant}"
        async with db.scoped_tx(tscope) as scon:
            await spine.append_event(
                scon, tscope, "onboarding.golive", "golive",
                {"tenant_id": tenant, "number": number, "lead_id": ctx["lead_id"],
                 "lifecycle": lifecycle_state, "n_skus": n_cat},
                lane="world", dedupe_key=f"golive:{tenant}")
    except Exception:
        log.debug("golive: onboarding.golive event fail-soft", exc_info=True)
    # (3a-bis) THE BOSS'S OWN SCOPE NOW BELONGS TO HIS OWN TENANT (2026-07-27, multi-tenancy pass).
    # A distributor's `wa.<digits>` scope is created while he is still a PROSPECT — during signup,
    # before his tenant exists — so it was bound to the box's tenant (`tenancy.tenant_of` on a flat
    # `wa.` path returns BRAIN_TENANT). Going live is the moment that stops being true: from here his
    # own thread, his own review rows and his own card are HIS company's, not the box owner's.
    # Forced, not coalesced: this is the one event that is allowed to correct the provisional
    # binding. Fail-soft — a mis-bound scope is a wrong sheet, never a failed activation.
    try:
        _bscope = (scope or "").strip()          # `activate(scope, …)` IS the boss's own scope
        if _bscope:
            async with db.scoped_tx(_bscope) as bcon:
                await bcon.execute("update scope_node set tenant_slug=$2 where scope=$1::ltree",
                                   _bscope, tenant)
                await bcon.execute("update contact set tenant_slug=$2 where scope=$1::ltree",
                                   _bscope, tenant)
    except Exception:
        log.debug("golive: boss-scope tenant bind fail-soft", exc_info=True)
    # (3b) FORCE the supplier-card directory distill SYNCHRONOUSLY (rehearsal rough-edge #1): the
    # debounced catalogue_ready rebuild leaves a ~20s window (or a restart mid-debounce) where the
    # first order after golive grounds with zero directory. Activation is rare and not latency-
    # sensitive -- pay the distill here so the first order is never blind. Fail-soft: the debounced
    # path remains the healer.
    try:
        import directory as _directory
        await _directory.build(tenant, force=True)
    except Exception:
        log.warning("golive: synchronous directory distill failed (debounced rebuild will heal)",
                    exc_info=True)
    # (4) the one-shot welcome + app link
    welcome = await _send_welcome(scope, ctx["phone"], ctx["name"], tenant, number)
    log.info("golive: %s LIVE — number %s bound, lifecycle=%s, welcome=%s",
             tenant, number, lifecycle_state, "sent" if welcome.get("sent") else "parked")
    return {"ok": True, "already_live": False, "tenant": tenant, "number": number,
            "golive_at": _iso(claimed), "lifecycle": lifecycle_state, "seeded": seeded,
            "welcome": welcome, "readiness": await readiness(scope)}
