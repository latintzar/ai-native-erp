"""brain/seed.py — THE SEEDED WORLD (Peter, 2026-07-27).

Two jobs, and the second one is the product:

  1. `load_catalogue()` — embed + index the SKUs and their aliases into `catalogue_skus`, the
     grounding the matcher and the doubt faculty stand on.
  2. `load_demo_seed()` — build A DAY THAT LOOKS LIKE A REAL TUESDAY at **Cárnicas Aldonza**
     (invented; LOCKED LAW — never a real company name): eight venues with their own habits, a
     week of chat and orders in every real state, THREE things to review (§5.8's closed set), and
     the §5.7 disambiguation loop visible from both ends — one question already answered and its
     alias learned, one still open and ageing towards the timeout.

WHY THIS IS NOT A FIXTURE. Peter's brief: "a seeded state with stuff to review, orders, etc." — the
seeded world is the product demonstrating itself, so everything in it is REAL STATE on the REAL
tables. The review sheet is `action` rows through `review.hold_for_review` (the one door), the
learned alias is a `sku_aliases` row the matcher will actually hit, the stock shortage is a
`stock_levels` row `brain/stock.check_lines` will actually read, and the out-of-range customer is a
real lat/lon that `brain/range.check` will actually measure against a real depot.

WHAT IS SEEDED vs WHAT IS LIVE — the whole safety story. Every row this module writes is marked, and
the marks are the ONLY thing the teardown may key on:

    catalogue_skus.seeded        orders.seeded        whatsapp_messages.seeded
    customer_profiles.seeded     calls.seeded         order_events.seeded
    sku_aliases.source='seed'    tenants.seeded       card.lineage='seed'
    action / event / open_loop / timer  →  payload (or resume_ref) ->> 'seed_world' = SEED_WORLD

`reset_demo_seed()` deletes by those predicates and nothing else, refuses a tenant that is not the
demo tenant, and refuses outright when it finds a row wearing a seed mark that it did not mint
(`_audit_foreign`). A real customer's order can never be caught by it — it is not marked, and there
is no broad `delete from orders` anywhere in the teardown.

WHERE THE WORLD LIVES (Peter, 2026-07-27): "I want it to be full and have the seeded data when
logged into my account — actually seeded, linked to the account, marked as test data, but in the REAL
schema, as I want first users this week."  So there is no demo database and no demo mode. The world is
written into the LIVE `rocoto` database, on the FOUNDER'S OWN TENANT (`config.BRAIN_TENANT`, which is
what `auth._founder_tenant()` resolves Peter's sign-in to and what `DEMO_TENANT` already equals),
wearing the test-data mark that already existed. Signing in as the founder therefore lands in a
populated app, and the tables a real first customer will use this week are the ones being exercised.

THE COLLISION LAW — the price of living in the live schema. That database already holds real history,
including Peter's OWN two numbers (+12025550110 / +12025550111 are deliberately Bar Lumbre and Café
Sotillo, so a live message merges into a seeded thread). Therefore:

    A SEEDED WRITE MAY NEVER OVERWRITE, MUTATE OR SHADOW A ROW THAT IS NOT ALREADY SEEDED.

Where the seed's key space meets a row it did not mint — a contact, a profile, a card, a catalogue
row, a delivery rule — it SKIPS, keeps the real row, and RECORDS the collision (`_collide`). The
ledger comes back on `load_demo_seed()`/`reset_demo_seed()` as `collisions` and is stored on the seed
meta, so «what did the seed decline to touch on my live box» is answerable without reading this file.
There is no upsert-over-production-history anywhere in the load: every `on conflict do update` in
here carries a `where` clause naming the mark, or it is `do nothing`.

MORE THAN ONE NAMED WORLD (Peter, 2026-07-27; PRODUCT-SPEC §5.10.3): *"can we make another seed
profile, and it lets me switch for company? … in the founder settings, I wanted to let me choose
which seed data profile it is. And I can, like, name them and stuff."*

A PROFILE is a complete world SPEC, named: the distributor's identity, its catalogue, its contacts
with their habits, its shelf, its storefront orders and its brain-intake script. Two origins, one
registry (`registry()`), files first:

    de fábrica  — `aldonza`, the canon world, whose spec is the pair of files this module has always
                  read (`seed/catalogue.json` + `seed/contacts.json`) PLUS the three module constants
                  below it (`_CANON_STOCK`, `_CANON_STOREFRONT_ORDERS`, `_CANON_BRAIN_INTAKE`).
                  Those constants are ALDONZA'S DATA, reached only through its spec — never a global
                  applied to every world. `_CANON_STOCK` names `sku-paleta-cocida-pieza`; a second
                  world that inherited it would seed a shelf count for an article it does not sell,
                  and a world that borrows another world's shelf is not a second world.
                  Other built-ins live in `seed/profiles/<id>/{world,catalogue}.json`.
    suyos       — rows in `seed_profile`, same schema, created/renamed/duplicated/deleted from the
                  app. No deploy, no migration.

  ⚠️ WHY ALDONZA'S TWO FILES DO NOT MOVE into `seed/profiles/aldonza/`, which is what §5.10.3
  describes: `app.py` reads `seed/contacts.json` directly (`_FOUNDER_TENANT_SPEC`) and two Medusa
  scripts read `seed/catalogue.json` by path. Moving them would break three files this pass does not
  own, to gain a directory. The registry points AT them instead, which is the same one-door outcome.

SWITCHING IS A RESET INTO A DIFFERENT WORLD, NOT A SWAP, and that is structural, not a preference:
  1. the demo tenant IS the founder's own tenant (`DEMO_TENANT` = `config.BRAIN_TENANT`, what
     `auth._founder_tenant()` resolves his sign-in to). Making "who am I" depend on a settings row
     gives identity a second source of truth on the one path that must never be ambiguous;
  2. customer scopes are FLAT — `scope_of()` returns `wa.<digits>`, globally. Two worlds could not
     coexist even on different tenants: they would collide in the one key space that is not
     tenant-keyed.
So there is ONE world at a time, on one tenant, and `activate_profile()` is `reset_demo_seed` with a
name beside it: tear the current world down by its mark, build the next.

THE MARK NOW NAMES THE WORLD, and the canon world keeps the bare legacy string ON PURPOSE:

    aldonza          →  seed_world = "rocoto-demo"          (unchanged; see below)
    any other id     →  seed_world = "rocoto-demo:<id>"

If the canon mark had changed, every runtime row already on the live box would instantly be wearing
a mark this seeder "could not have minted" — `_audit_foreign` would call the founder's own world
FOREIGN and his «reiniciar» button would refuse, on prod, with no migration in sight. The teardown
predicate therefore widens from `= SEED_WORLD` to `= any(known_marks())` — still a CLOSED,
inspectable set enumerated from the registry, never `payload ? 'seed_world'`. And the distinction
that keeps `_audit_foreign` meaningful is now explicit: a mark INSIDE the set is STALE (a world we
know how to build, torn down as part of a switch); a mark OUTSIDE it is FOREIGN and the reset refuses.
"""
from __future__ import annotations

import contextvars
import hashlib
import json
import logging
import os
import re
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import config
import db
import tenancy
from brain import embed, matcher, profile

log = logging.getLogger("rocoto.brain.seed")

_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DEFAULT_CATALOGUE = os.path.join(_HERE, "seed", "catalogue.json")
DEFAULT_CONTACTS = os.path.join(_HERE, "seed", "contacts.json")
SEED_META_AGENT = "seed_meta"

# ── THE SEED LINEAGE ─────────────────────────────────────────────────────────────────────────────
# The sentinel every RUNTIME row (event / action / open_loop / timer) this module writes carries on
# its jsonb. It is deliberately a distinctive key rather than a bare `seeded: true`: `seeded` is a
# word anybody might put on a payload, and the teardown must never be able to reach a row it did not
# mint. Changing this string orphans the previous world — `reset_demo_seed` then reports it as
# FOREIGN and refuses, which is the correct loud failure.
SEED_WORLD = "rocoto-demo"
# Every OTHER world's mark. `world_mark()` is the ONE place the two rules meet, so nothing composes
# this string by hand.
SEED_WORLD_PREFIX = "rocoto-demo:"
# The canon profile id — the world `seed/catalogue.json` + `seed/contacts.json` describe, the one
# everything that existed before profiles depends on, and the default active world.
CANON_PROFILE = "aldonza"
PROFILES_DIR = os.path.join(_HERE, "seed", "profiles")
_PROFILE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,31}$")


def world_mark(profile_id: str) -> str:
    """The `seed_world` sentinel for a world. The canon world keeps the BARE legacy string — see the
    module docstring: changing it would make every seeded runtime row on the live box foreign to its
    own reset."""
    pid = (profile_id or CANON_PROFILE).strip()
    return SEED_WORLD if pid == CANON_PROFILE else SEED_WORLD_PREFIX + pid


def is_seed_mark(mark: Any) -> bool:
    """Does this `seed_world` value belong to ANY world this seeder mints? The read models use it to
    answer «is this row test data» — a question that must not become «is this row the canon world»
    the moment a second profile is active."""
    m = str(mark or "")
    return m == SEED_WORLD or (m.startswith(SEED_WORLD_PREFIX) and len(m) > len(SEED_WORLD_PREFIX))


# Row-id prefixes the seeder mints DIRECTLY. A row wearing a seed mark whose id is outside this set
# was written by something else and the reset refuses to touch it (`_audit_foreign`).
#
# ONE documented exception, and it is not a loophole: an order filed through the REAL brain gets its
# id from `events.create_order` (`uuid4().hex`), so it cannot carry a prefix. Those ids are recorded
# on the seed meta at seed time (`_set_seed_meta(brain_orders=…)`) and the audit reads them back —
# so the exemption is an explicit, inspectable LIST of rows, never a widened pattern.
SEED_ID_PREFIXES = ("seed-", "seedmsg-", "rec_seed_", "acr_seed_")
# The ONLY tenant `reset_demo_seed` will run against. Overridable so a rehearsal clone can own its
# own demo tenant; defaults to the tenant everything else in the process already uses.
DEMO_TENANT = os.environ.get("ROCOTO_DEMO_TENANT", "") or config.BRAIN_TENANT


# ── THE WORLD BEING LOADED OR TORN DOWN, right now, in this task ─────────────────────────────────
# A ContextVar and not a module global, for the same reason the collision ledger is one: a founder's
# button and a vital can be in flight at once, and neither may see the other's world. Unset = the
# canon world, so every caller that predates profiles keeps its exact previous behaviour.
_ACTIVE_SPEC: "contextvars.ContextVar[Optional[Dict[str, Any]]]" = contextvars.ContextVar(
    "rocoto_seed_profile", default=None)


def _spec() -> Dict[str, Any]:
    """The ACTIVE world spec. Every reader of the seed data goes through here — `_catalogue_spec`,
    `_contacts_spec`, `demo_scopes`, the stock/storefront/intake blocks — so switching worlds is one
    assignment rather than a signature change on twenty functions."""
    s = _ACTIVE_SPEC.get()
    return s if s is not None else _canon_spec()


def _active_id() -> str:
    return str(_spec().get("id") or CANON_PROFILE)


def _world() -> str:
    """The ACTIVE world's `seed_world` sentinel — the string that rides every runtime row this load
    writes and the only one its own teardown will match it on."""
    return world_mark(_active_id())


def _mark(**extra: Any) -> Dict[str, Any]:
    """The seed mark that rides every runtime payload this module writes — the ACTIVE world's."""
    return {"seed_world": world_mark(_active_id()), **extra}


# ── THE COLLISION LEDGER ─────────────────────────────────────────────────────────────────────────
# Now that the world lives in the LIVE schema, "I skipped it" has to be as visible as "I wrote it".
# Every place the seed's key space can meet a row it did not mint records ONE line here: which table,
# which key, what was KEPT, and why it matters. A ContextVar (not a module global) so two concurrent
# loads — a founder's button and a vital, say — can never read each other's ledger.
_LEDGER: "contextvars.ContextVar[Optional[List[Dict[str, str]]]]" = contextvars.ContextVar(
    "rocoto_seed_collisions", default=None)


def _ledger_open() -> List[Dict[str, str]]:
    """Start a fresh ledger for one load. Returns the list the load will hand back."""
    rows: List[Dict[str, str]] = []
    _LEDGER.set(rows)
    return rows


def _collide(table: str, key: str, kept: str, why: str = "") -> None:
    """A real (non-seeded) row stood where the seed was about to write. We kept theirs; say so.

    LOUD BY DEFAULT (log.info, not debug): on the live box this is the line that explains why a
    seeded thread carries a name or a rule the seed did not choose."""
    rows = _LEDGER.get()
    row = {"table": table, "key": str(key), "kept": str(kept)[:160], "why": why}
    if rows is not None:
        rows.append(row)
    log.info("seed: SKIPPED %s %s — a live row is already there (kept %r). %s",
             table, key, str(kept)[:80], why)


async def _has_live_history(con, phone: str) -> str:
    """Does this phone carry history the seed did not write? Returns the reason ('' = none).

    THE POINT: `whatsapp_user_profiles` and `card` have no `seeded` column, so "is this contact real?"
    cannot be answered by a mark on the row itself. It is answered by the TRAFFIC: an unseeded message,
    an unseeded order, or a customer profile the seed never minted. Peter's own two numbers answer YES
    (they are real conversations), which is exactly why the seed must not rename them."""
    try:
        n = int(await con.fetchval(
            "select count(*) from whatsapp_messages where phone_number=$1 and not seeded", phone) or 0)
        if n:
            return f"{n} mensaje(s) reales"
        n = int(await con.fetchval(
            "select count(*) from orders where phone_number=$1 and not seeded", phone) or 0)
        if n:
            return f"{n} pedido(s) reales"
        n = int(await con.fetchval(
            "select count(*) from customer_profiles where phone_number=$1 and not seeded", phone) or 0)
        if n:
            return "ficha de cliente real"
    except Exception:
        log.debug("seed: live-history probe failed for %s", phone, exc_info=True)
    return ""


# ═══════════════════════════ THE REGISTRY — named worlds, one at a time ══════════════════════════
# A SPEC is the whole of a world, and its shape is the same whether it came from a file or a row:
#
#   {id, name, origin, business{…}, contacts[…], skus[…],
#    stock[[sku_id, qty, unit]…], storefront_orders[…], brain_intake[[phone, text]…],
#    invented_names[…]}
#
# `business` + `contacts` + `skus` are REQUIRED; everything else is optional and ABSENT MEANS ABSENT.
# A profile with no `stock` block has no inventory — honestly — rather than borrowing another
# world's shelf.

def _read_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


_canon_cache: Dict[str, Any] = {}


def _canon_spec() -> Dict[str, Any]:
    """The canon world, assembled from the two files this module has always read plus the three
    module constants below. THOSE CONSTANTS ARE ALDONZA'S DATA and this is the only place they are
    reached from — see the module docstring on why a second world may not inherit them.

    Cached on the two files' mtimes: `_spec()` falls back here on every unbound read, and re-parsing
    two JSON files per call would put a disk read inside loops that used to have none. The mtime key
    means an edited seed file is still picked up without a restart, which is how this module has
    always behaved and how the vitals expect it to."""
    try:
        key = (os.path.getmtime(DEFAULT_CONTACTS), os.path.getmtime(DEFAULT_CATALOGUE))
    except OSError:
        key = None
    if key is not None and _canon_cache.get("key") == key:
        return _canon_cache["spec"]
    world = _read_json(DEFAULT_CONTACTS)
    cat = _read_json(DEFAULT_CATALOGUE)
    inv: List[str] = []
    for k, v in (world.get("invented_names") or {}).items():
        if not str(k).startswith("_") and isinstance(v, list):
            inv.extend(v)
    spec = {
        "id": CANON_PROFILE,
        "name": "Cárnicas Aldonza — el martes canónico",
        "origin": "builtin",
        "editable": False,
        "business": dict(world.get("business") or {}),
        "contacts": list(world.get("contacts") or []),
        "skus": list(cat.get("skus") or []),
        # the documentation blocks the doubt/matcher demo reads (`_learnable_mentions`, `_gaps`,
        # `_dimension_pairs`) ride along untouched — they are part of the catalogue spec
        "catalogue_meta": {k: v for k, v in cat.items() if str(k).startswith("_")},
        "stock": [list(t) for t in _CANON_STOCK],
        "storefront_orders": [list(t) for t in _CANON_STOREFRONT_ORDERS],
        "brain_intake": [list(t) for t in _CANON_BRAIN_INTAKE],
        "invented_names": inv,
    }
    if key is not None:
        _canon_cache["key"], _canon_cache["spec"] = key, spec
    return spec


def _spec_from_body(pid: str, name: str, body: Dict[str, Any], origin: str) -> Dict[str, Any]:
    """A stored/authored body → the canonical spec shape. Missing optional blocks stay MISSING."""
    b = dict(body or {})
    return {
        "id": pid,
        "name": (name or b.get("name") or pid).strip(),
        "origin": origin,
        "editable": origin == "own",
        "business": dict(b.get("business") or {}),
        "contacts": list(b.get("contacts") or []),
        "skus": list(b.get("skus") or []),
        "catalogue_meta": dict(b.get("catalogue_meta") or {}),
        "stock": [list(x) for x in (b.get("stock") or [])],
        "storefront_orders": [list(x) for x in (b.get("storefront_orders") or [])],
        "brain_intake": [list(x) for x in (b.get("brain_intake") or [])],
        "invented_names": list(b.get("invented_names") or []),
    }


def _builtin_specs() -> Dict[str, Dict[str, Any]]:
    """Every world that ships in git. `aldonza` is assembled from the legacy pair; anything else is a
    directory holding `world.json` (+ an optional separate `catalogue.json`). A directory that fails
    to parse is SKIPPED LOUDLY — one malformed built-in must never take the registry down, because
    the registry is what the founder's settings screen and the reset both read."""
    out: Dict[str, Dict[str, Any]] = {CANON_PROFILE: _canon_spec()}
    try:
        names = sorted(os.listdir(PROFILES_DIR))
    except OSError:
        return out
    for pid in names:
        d = os.path.join(PROFILES_DIR, pid)
        wp = os.path.join(d, "world.json")
        if pid == CANON_PROFILE or not os.path.isdir(d) or not os.path.exists(wp):
            continue
        try:
            body = _read_json(wp)
            cp = os.path.join(d, "catalogue.json")
            if os.path.exists(cp):
                cat = _read_json(cp)
                body["skus"] = list(cat.get("skus") or [])
                body["catalogue_meta"] = {k: v for k, v in cat.items() if str(k).startswith("_")}
            out[pid] = _spec_from_body(pid, body.get("name") or pid, body, "builtin")
        except Exception:
            log.warning("seed: built-in profile %s could not be read — skipped", pid, exc_info=True)
    return out


_schema_ready = False


async def _ensure_schema() -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


async def _own_specs() -> Dict[str, Dict[str, Any]]:
    """The founder's own worlds. Fail-soft on the READ: a box whose `seed_profile` table is not there
    yet has no own profiles, which is true, rather than a 500 on the settings screen."""
    try:
        await _ensure_schema()
        async with db.get_pool().acquire() as con:
            rows = await con.fetch("select id, name, body from seed_profile order by created_at")
    except Exception:
        log.debug("seed: own profiles unreadable", exc_info=True)
        return {}
    out: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        body = r["body"]
        if isinstance(body, str):
            try:
                body = json.loads(body or "{}")
            except ValueError:
                body = {}
        out[r["id"]] = _spec_from_body(r["id"], r["name"] or r["id"], body or {}, "own")
    return out


async def registry() -> Dict[str, Dict[str, Any]]:
    """Every registered world, FILES FIRST. An id collision resolves to the file and the shadowed row
    is reported through the collision ledger — the same discipline every other clash in this module
    gets — rather than silently winning or silently losing."""
    out = _builtin_specs()
    for pid, spec in (await _own_specs()).items():
        if pid in out:
            _collide("seed_profile", pid, "el perfil de fábrica del mismo nombre",
                     "un perfil en el repositorio manda sobre uno guardado en la base de datos")
            continue
        out[pid] = spec
    return out


async def known_marks() -> List[str]:
    """The CLOSED set of `seed_world` sentinels this seeder can mint on this box — one per registered
    profile, plus the canon world's bare legacy mark. The teardown widens to this set; the audit
    calls anything outside it FOREIGN. It is enumerated from the registry and is never a pattern."""
    marks = {SEED_WORLD}
    try:
        marks.update(world_mark(pid) for pid in (await registry()))
    except Exception:
        log.warning("seed: registry unreadable — teardown falls back to the canon mark alone",
                    exc_info=True)
    return sorted(marks)


async def all_demo_scopes() -> List[str]:
    """Every runtime scope ANY registered world may touch. The teardown of a switch has to be able to
    reach a STALE world's scopes, which are not the incoming world's — so this is the union, still a
    closed list derived from specs, never "every scope"."""
    scopes: List[str] = []
    seen = set()
    try:
        specs = list((await registry()).values())
    except Exception:
        specs = [_spec()]
    for spec in specs:
        for c in (spec.get("contacts") or []):
            s = scope_of(c.get("phone") or "")
            if s and s not in seen:
                seen.add(s)
                scopes.append(s)
    return scopes


# ── VALIDATION — what a world may not be ────────────────────────────────────────────────────────
class ProfileRejected(ValueError):
    """A profile spec that may not be registered. Carries `reason` (a machine code) beside the
    Spanish sentence, so a route can answer typed and a screen can answer readable."""

    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason


def _from_declared(name: str, declared: List[str]) -> bool:
    n = (name or "").strip()
    return any(n == i or n.startswith(i + " (") for i in declared)


async def validate_spec(spec: Dict[str, Any], *, exclude: str = "") -> Dict[str, Any]:
    """Refuse a world that would be a lie. Every rule here is one an existing law already states;
    this is where they become enforceable at REGISTRATION instead of discovered at load.

      · the id is a slug (it becomes a mark and a directory name);
      · a business/contact name must come from THIS profile's own declared invented set — the LOCKED
        LAW is «never a real company name», and a closed declared set is how that is checkable;
      · every basket is grounded in this profile's OWN catalogue — a world whose contacts order
        articles it does not sell cannot seed;
      · PHONE NUMBERS ARE A PROFILE'S OWN KEY SPACE. `whatsapp_user_profiles` is keyed on the phone
        and `scope_of` is FLAT, so two worlds sharing a number would MERGE. The exception is
        `DEMO_PHONES` — Peter's own two numbers, which every world may claim and which the collision
        law already protects.
    """
    pid = str(spec.get("id") or "").strip()
    if not _PROFILE_ID_RE.match(pid):
        raise ProfileRejected("bad_id", "El identificador sólo puede llevar minúsculas, números y "
                                        "guiones (2–32 caracteres).")
    declared = list(spec.get("invented_names") or [])
    business = dict(spec.get("business") or {})
    contacts = list(spec.get("contacts") or [])
    skus = list(spec.get("skus") or [])
    if not business.get("name"):
        raise ProfileRejected("no_business", "El perfil necesita un negocio con nombre.")
    if not contacts:
        raise ProfileRejected("no_contacts", "El perfil necesita al menos un cliente.")
    if not skus:
        raise ProfileRejected("no_catalogue", "El perfil necesita un catálogo.")
    if not declared:
        raise ProfileRejected(
            "no_invented_set",
            "El perfil tiene que declarar su lista cerrada de nombres inventados. Jamás un nombre "
            "de empresa real.")
    bad = [n for n in [business.get("name")] + [c.get("name") for c in contacts]
           if not _from_declared(str(n or ""), declared)]
    if bad:
        raise ProfileRejected(
            "name_not_invented",
            f"Estos nombres no están en la lista de inventados del perfil: {', '.join(bad[:4])}.")
    have = {s.get("id") for s in skus}
    ungrounded = [u.get("sku_id") for c in contacts for u in (c.get("usual") or [])
                  if u.get("sku_id") not in have]
    if ungrounded:
        raise ProfileRejected(
            "basket_ungrounded",
            f"Hay pedidos habituales que apuntan a artículos que este catálogo no tiene: "
            f"{', '.join(str(x) for x in ungrounded[:4])}.")
    mine = {c.get("phone") for c in contacts if c.get("phone")} - set(DEMO_PHONES)
    for other_id, other in (await registry()).items():
        if other_id in (pid, exclude):
            continue
        theirs = {c.get("phone") for c in (other.get("contacts") or [])} - set(DEMO_PHONES)
        clash = sorted(mine & theirs)
        if clash:
            raise ProfileRejected(
                "phone_collision",
                f"Estos teléfonos ya son de «{other.get('name') or other_id}»: "
                f"{', '.join(clash[:3])}. Dos mundos no pueden compartir un número — se mezclarían "
                f"en la misma conversación.")
    return spec


# ── WHICH WORLD IS ACTIVE ────────────────────────────────────────────────────────────────────────
# Stored on the seed meta (`SEED_META_AGENT`) — the row that already carries `loaded_at`, the
# collision ledger and the brain-order exemption list. ONE place, already read by the one route that
# answers this question.

async def active_profile_id() -> str:
    try:
        pid = str((await _get_seed_meta()).get("active_profile") or "").strip()
    except Exception:
        log.debug("seed: active profile unreadable", exc_info=True)
        pid = ""
    return pid or CANON_PROFILE


async def active_spec() -> Dict[str, Any]:
    pid = await active_profile_id()
    reg = await registry()
    spec = reg.get(pid)
    if spec is None:
        # The active world was deleted from under us (a built-in removed in a deploy, say). Say so
        # and fall back to canon rather than leaving the box with no world it can name.
        log.warning("seed: active profile %r is not registered — falling back to %s", pid,
                    CANON_PROFILE)
        spec = reg[CANON_PROFILE]
    return spec


async def list_profiles() -> Dict[str, Any]:
    """The founder screen's one read: every world, what is in it, and which one is live."""
    reg = await registry()
    active = await active_profile_id()
    if active not in reg:
        active = CANON_PROFILE
    out = []
    for pid, s in sorted(reg.items(), key=lambda kv: (kv[1].get("origin") != "builtin", kv[0])):
        out.append({
            "id": pid,
            "name": s.get("name") or pid,
            "business": (s.get("business") or {}).get("name") or "",
            "origin": s.get("origin") or "own",
            "editable": bool(s.get("editable")),
            "skus": len(s.get("skus") or []),
            "contacts": len(s.get("contacts") or []),
            "active": pid == active,
            "mark": world_mark(pid),
        })
    return {"active": active, "profiles": out}


async def create_profile(name: str, *, from_profile_id: str = "", body: Optional[Dict[str, Any]] = None,
                         profile_id: str = "") -> Dict[str, Any]:
    """Mint one of the founder's OWN worlds — duplicated from a registered one, or from a body an
    ingestion produced (§5.10.2's `from_intake_id` lands here as a body). Validated BEFORE it is
    stored: a profile that could not seed must never be listed as one that can."""
    await _ensure_schema()
    name = (name or "").strip()
    if not name:
        raise ProfileRejected("no_name", "Ponle un nombre al perfil.")
    reg = await registry()
    if from_profile_id:
        src = reg.get(from_profile_id)
        if src is None:
            raise ProfileRejected("no_source", "Ese perfil ya no existe.")
        body = {k: v for k, v in src.items() if k not in ("id", "origin", "editable", "name")}
    body = dict(body or {})
    pid = (profile_id or _slugify(name)).strip()
    base, n = pid, 2
    while pid in reg:
        pid = f"{base}-{n}"
        n += 1
    spec = _spec_from_body(pid, name, body, "own")
    await validate_spec(spec)
    payload = {k: v for k, v in spec.items() if k not in ("id", "origin", "editable")}
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into seed_profile (id, name, body) values ($1,$2,$3::jsonb)",
            pid, name, json.dumps(payload, ensure_ascii=False))
    log.info("seed: profile %s (%s) created from %s", pid, name, from_profile_id or "un cuerpo")
    return {"id": pid, "name": name, "origin": "own"}


async def create_profile_from_intake(intake_id: str, name: str, *, tenant: Optional[str] = None,
                                     history_weeks: int = 0,
                                     contacts_from: str = CANON_PROFILE) -> Dict[str, Any]:
    """A catalogue Peter just INGESTED becomes a demo world he can switch into (§5.10.2).

    This is the join the spec named — `create_profile`'s own docstring says "§5.10.2's
    `from_intake_id` lands here as a body" — and which existed nowhere but that sentence. Without it
    an ingested catalogue commits into the LIVE world and there is no way to keep several of them
    side by side. Peter's actual need, in his words: *"I have demos lined up with different customers
    who wanna see it with their products."* One prospect, one profile, switch before the meeting.

    WHY IT IS NOT «copy the canon world and swap the SKUs», which is the obvious wrong version:

      · **Phones are a world's KEY SPACE.** `whatsapp_user_profiles` is keyed on the phone and
        `scope_of` is FLAT, so two worlds sharing a number MERGE into one conversation —
        `validate_spec` refuses it, and rightly. So the contacts get numbers minted from THIS
        profile's id, deterministically, in a block nothing else uses.
      · **Baskets must be grounded in the world's OWN catalogue.** Canon's baskets name canon's
        SKUs; carried across they would be orders for articles this world does not sell, which
        `validate_spec` also refuses. They are rebuilt from the INGESTED articles instead — which is
        the point anyway: the demo has to show the prospect THEIR products moving.
      · **Names stay invented.** The declared set is the profile name plus its contacts, and
        `validate_spec` checks every one against it. The catalogue is the prospect's; the customers
        buying from it are not.

    **`history_weeks` DEFAULTS TO 0 — a minted world arrives with NO past orders.** Peter, on how
    these demos actually run: *"my demo will involve live sending voice notes to show the orders come
    in."* A world pre-filled with invented history would put orders on the screen that he did not
    place and cannot explain, and the first thing a prospect sees would be fiction rather than their
    own products. The customers exist and carry their usual basket — that is a FACT about them the
    brain should know — but nothing has been ordered yet. Pass `history_weeks=N` when he explicitly
    asks for a world that already has traffic in it.

    Validation happens in `create_profile` BEFORE anything is stored, so a world that could not seed
    is never offered as one that can."""
    await _ensure_schema()
    tenant = tenant or config.BRAIN_TENANT
    name = (name or "").strip()
    if not name:
        raise ProfileRejected("no_name", "Ponle un nombre al perfil.")

    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select id, tenant_id, state, parsed, edits, source_name from catalogue_intake "
            "where id=$1 and tenant_id=$2", intake_id, tenant)
    if row is None:
        raise ProfileRejected("no_intake", "Esa importación ya no existe.")
    if row["state"] not in ("ready", "committed"):
        raise ProfileRejected(
            "intake_not_ready",
            "Esa importación todavía no está revisada. Míralo, corrígelo y entonces guárdalo como "
            "perfil.")

    parsed = row["parsed"]
    if isinstance(parsed, str):
        parsed = json.loads(parsed or "[]")
    edits = row["edits"]
    if isinstance(edits, str):
        edits = json.loads(edits or "{}")
    skus = _intake_skus(list(parsed or []), dict(edits or {}))
    if not skus:
        raise ProfileRejected("no_catalogue",
                              "De esa importación no ha salido ningún artículo que guardar.")

    pid = _slugify(name)
    contacts = _demo_contacts_for(pid, skus, contacts_from, history_weeks)
    body = {
        "business": {"slug": pid, "name": name, "city": "Madrid", "region": "Madrid",
                     "country": "ES", "depot_label": "el almacén",
                     "depot_lat": 40.3465, "depot_lon": -3.6512, "range_km": 35},
        "invented_names": [name] + [c["name"] for c in contacts],
        "contacts": contacts,
        "skus": skus,
        "catalogue_meta": {"source": "intake", "intake_id": intake_id,
                           "source_name": row["source_name"] or ""},
    }
    return await create_profile(name, body=body, profile_id=pid)


def _intake_skus(parsed: List[Dict[str, Any]], edits: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The intake's articles, with the operator's corrections applied, in the profile's SKU shape.

    ⚠️ THE OVERLAY IS NOT RE-DERIVED HERE. It calls `onboarding._apply_edits` — the function the
    preview screen and the commit already read through — because this file had a SECOND, subtly
    different copy of that rule and the two disagreed about every row: it keyed the edits map on
    `code` (falling back to the index) where the wire keys it on the row handle `n`, and it looked
    for `dropped` where `patch_intake` writes `drop`. Measured on real wire rows, 2026-07-27: a row
    Peter RENAMED in the preview landed in the world under its old name, and a row he DROPPED landed
    in it anyway. Both are exactly the silent-guess this product refuses everywhere else, and both
    stop being possible when there is one overlay rather than two."""
    from brain import onboarding as _ob
    out: List[Dict[str, Any]] = []
    for i, raw in enumerate(_ob._apply_edits(list(parsed or []), dict(edits or {}))):
        r = dict(raw or {})
        nm = str(r.get("name") or "").strip()
        if not nm:
            continue
        out.append({
            "id": f"sku-{_slugify(nm)[:40]}-{i}",
            "name": nm,
            "family": str(r.get("family") or "").strip(),
            "base_unit": str(r.get("base_unit") or r.get("unit") or "ud").strip(),
            "price": r.get("price"),
            "aliases": list(r.get("aliases") or []),
        })
    return out


# Invented restaurant names for a minted demo world. A closed set, Quixote-flavoured like every
# other world's, and DISJOINT from the built-ins' sets so two worlds never declare the same name.
_MINTED_VENUES = ["Bar Cardenio", "Mesón Grisóstomo", "Taberna Luscinda", "Café Altisidora",
                  "Freiduría Barataria", "Asador Clavileño"]


def _demo_contacts_for(pid: str, skus: List[Dict[str, Any]], contacts_from: str,
                       history_weeks: int = 0) -> List[Dict[str, Any]]:
    """Customers for a minted world: invented names, phones this world alone owns, and baskets drawn
    from ITS catalogue.

    The phone block is derived from the profile id so it is stable across a re-mint (the same world
    keeps the same customers) and disjoint from every other world's (`validate_spec` refuses a
    collision, because two worlds on one number merge into one conversation). It sits in the +34 999
    5xx xxx test range, which no real Spanish subscriber uses."""
    seed_n = int(hashlib.sha1(pid.encode()).hexdigest()[:6], 16) % 900
    picks = [s for s in skus if s.get("id")][:24]
    contacts: List[Dict[str, Any]] = []
    for k, venue in enumerate(_MINTED_VENUES[: max(2, min(5, len(picks) or 2))]):
        basket = picks[k::len(_MINTED_VENUES)][:4] or picks[:2]
        contacts.append({
            "phone": f"+34999{500 + seed_n:03d}{k + 1:03d}",
            "name": venue,
            "role": "regular",
            "cadence_days": 3 + k,
            "order_dow": [(k * 2) % 6, (k * 2 + 3) % 6],
            # 0 = no invented past orders. See create_profile_from_intake: the demo IS the live
            # voice note landing, so the screen must start empty and fill up in front of the room.
            "weeks": max(0, int(history_weeks)),
            "usual": [{"sku_id": s["id"], "qty": 2 + k, "unit": s.get("base_unit") or "ud"}
                      for s in basket],
            "chitchat": ["buenas", "¿me lo puedes dejar por la mañana?"],
        })
    return contacts


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower().strip()).strip("-")
    return (s or "mundo")[:32]


async def update_profile(profile_id: str, *, name: str = "",
                         body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Rename or re-body one of the founder's OWN worlds. A built-in is read-only in the UI and
    refused here too — it is reviewed like code, which is the whole difference between the two."""
    await _ensure_schema()
    reg = await registry()
    cur = reg.get(profile_id)
    if cur is None:
        raise ProfileRejected("no_profile", "Ese perfil ya no existe.")
    if cur.get("origin") != "own":
        raise ProfileRejected("builtin_readonly",
                              "Los perfiles de fábrica no se editan desde la app.")
    merged = dict(cur)
    if body is not None:
        merged = _spec_from_body(profile_id, name or cur.get("name") or profile_id, body, "own")
    if name:
        merged["name"] = name.strip()
    await validate_spec(merged, exclude=profile_id)
    payload = {k: v for k, v in merged.items() if k not in ("id", "origin", "editable")}
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update seed_profile set name=$2, body=$3::jsonb, updated_at=now() where id=$1",
            profile_id, merged["name"], json.dumps(payload, ensure_ascii=False))
    return {"id": profile_id, "name": merged["name"], "origin": "own"}


async def delete_profile(profile_id: str) -> Dict[str, Any]:
    """Delete one of the founder's own worlds. THE ACTIVE ONE IS REFUSED: deleting the spec of the
    world currently sitting in the tables would leave rows whose mark nothing in the registry can
    name — i.e. it would manufacture the exact FOREIGN state `_audit_foreign` exists to refuse."""
    await _ensure_schema()
    reg = await registry()
    cur = reg.get(profile_id)
    if cur is None:
        raise ProfileRejected("no_profile", "Ese perfil ya no existe.")
    if cur.get("origin") != "own":
        raise ProfileRejected("builtin_readonly", "Los perfiles de fábrica no se borran desde la app.")
    if await active_profile_id() == profile_id:
        raise ProfileRejected(
            "profile_active",
            "Este es el mundo que está cargado ahora mismo. Activa otro antes de borrarlo.")
    async with db.get_pool().acquire() as con:
        await con.execute("delete from seed_profile where id=$1", profile_id)
    return {"id": profile_id, "deleted": True}


def _doc_text(sku: Dict[str, Any]) -> str:
    """The text that gets EMBEDDED for a SKU. Written in Spanish because both the catalogue rows and
    the customers' mentions are Spanish (§5.7a's note on the encoder: the substrate is degraded until
    the bge-m3 swap, but the text itself should at least be the language it is in)."""
    aliases = sku.get("aliases") or []
    parts = [sku["name"]]
    if sku.get("family"):
        parts.append(sku["family"].replace("_", " "))
    if aliases:
        parts.append("también se pide como: " + ", ".join(aliases))
    return ". ".join(parts)


# ── E-commerce surface seed (medusa-integration.md §3) ───────────────────────────────────────────
# The storefront product images are REAL committed assets (medusa/storefront/public/img/*.jpg). Each
# catalogue family maps to its image so /api/ecom/products serves real photos, never a placeholder.
# A curated subset goes live_on_ecom=true with real customization options.
_FAMILY_IMAGE = {
    "embutido_curado": "/img/embutidos.jpg",
    "cocidos": "/img/cocidos.jpg",
    "fresco": "/img/frescos.jpg",
    "iberico": "/img/p_seleccion.jpg",
    "aves": "/img/carne.jpg",
    "casqueria": "/img/pp_offal.jpg",
    "quesos": "/img/p_seleccion.jpg",
}
# Per-SKU hero photos (the storefront's product shots) override the family image where we have one.
# The catalogue row carries its own `image`; this map only exists for the handful the storefront
# shoots differently.
_SKU_IMAGE = {
    "sku-jamon-serrano-pieza": "/img/p_jamon.jpg",
    "sku-jamon-iberico-pieza": "/img/p_jamon.jpg",
    "sku-chorizo-cular-pieza": "/img/p_chorizo.jpg",
    "sku-salchichon-cular": "/img/p_salchichon.jpg",
    "sku-lomo-adobado": "/img/p_lomo.jpg",
}
# Customization options offered on the storefront (the real choices this house supports). [] = none.
_CORTE = {"key": "corte", "label": "Corte", "options": ["Pieza entera", "Loncheado", "Taco"]}
_ENVASE = {"key": "envase", "label": "Envasado", "options": ["A granel", "Vacío 250 g", "Vacío 500 g"]}
_SKU_CUSTOMIZATIONS = {
    "sku-jamon-serrano-pieza": [_CORTE, _ENVASE],
    "sku-jamon-cocido-pieza": [_CORTE, _ENVASE],
    "sku-paleta-cocida-pieza": [_CORTE, _ENVASE],
    "sku-chorizo-cular-pieza": [_ENVASE],
    "sku-salchichon-cular": [_ENVASE],
    "sku-manchego-pieza": [_CORTE, _ENVASE],
    "sku-lomo-embuchado-cana": [_ENVASE],
}
# The subset live on the storefront at seed time (the rest are catalogue-only until the operator
# lists them). A real cross-section across families so the store demos with breadth.
_LIVE_ON_ECOM = {
    "sku-chorizo-sarta-500", "sku-chorizo-cular-pieza", "sku-salchichon-vela-55", "sku-fuet-170",
    "sku-sobrasada", "sku-lomo-embuchado-cana", "sku-jamon-serrano-pieza", "sku-jamon-cocido-lon",
    "sku-paleta-cocida-lon", "sku-morcilla-burgos", "sku-bacon-lon", "sku-manchego-cuna",
    "sku-panceta-adobada-pieza", "sku-costilla-adobada",
}
# Per-product ASAP / out-of-hours envelope (the storefront "pídelo ahora, listo para…" copy). Only
# the fresh/adobado families carry a same-day window; the cured goods go next day.
_SKU_ASAP = {
    "sku-panceta-adobada-pieza": {"asap": True, "ready_by": "same_day", "cutoff": "07:30",
                                  "out_of_hours": False},
    "sku-costilla-adobada": {"asap": True, "ready_by": "same_day", "cutoff": "07:30",
                             "out_of_hours": False},
    "sku-pollo-entero-18": {"asap": False, "ready_by": "next_day", "out_of_hours": False},
}


def _ecom_fields(sku: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve the e-commerce surface fields for a seed SKU from the REAL committed assets + curated
    options. Returns {live_on_ecom, image_url, customizations, asap_envelope}."""
    sid = sku["id"]
    image = _SKU_IMAGE.get(sid) or sku.get("image") or _FAMILY_IMAGE.get(sku.get("family", ""))
    return {
        "live_on_ecom": sid in _LIVE_ON_ECOM,
        "image_url": image,
        "customizations": _SKU_CUSTOMIZATIONS.get(sid, []),
        "asap_envelope": _SKU_ASAP.get(sid, {}),
    }


async def load_catalogue(path: Optional[str] = None, tenant: Optional[str] = None,
                         seeded: bool = True) -> Dict[str, int]:
    """Embed + index a world's SKUs. `path` still names a file for the callers that pass one; with no
    path it is the catalogue of the world BOUND TO THIS TASK (`_ACTIVE_SPEC`), and with nothing bound
    it is the canon one — so every pre-existing caller (`load_catalogue()` in half a dozen tests)
    keeps its exact previous behaviour. Every seeding path binds first (`load_demo_seed` does, and
    `ingest_demo_message` binds the STORED active world), so a bare call is the only way to reach
    canon while another world is loaded, and that is a script, never the product."""
    tenant = tenant or config.BRAIN_TENANT
    skus: List[Dict[str, Any]] = list(_read_json(path)["skus"]) if path else \
        list(_catalogue_spec().get("skus") or [])
    if not skus:
        # A catalogue of nothing would delete this world's seed aliases and index no grounding — an
        # empty world that reads as loaded. Refuse rather than half-build.
        raise ValueError("load_catalogue: el perfil activo no tiene catálogo — no hay nada que cargar")

    docs = [_doc_text(s) for s in skus]
    vecs = await embed.aembed_passages(docs)

    pool = db.get_pool()
    n_sku = n_alias = 0
    skipped: set = set()
    async with pool.acquire() as con:
        if seeded:
            # THE COLLISION CHECK, before a single write: which of the ids we are about to write
            # already exist on this tenant as a row we did NOT mint? An operator edit flips
            # `seeded=false` (app.py's catalogue edit), and a real catalogue loaded through
            # golive.seed_catalogue is unseeded by construction — either way that row is theirs, and
            # the seed leaves it entirely alone rather than "refreshing" a price somebody corrected.
            rows = await con.fetch(
                "select id from catalogue_skus where tenant_id=$1 and not seeded "
                "and id = any($2::text[])", tenant, [s["id"] for s in skus])
            skipped = {r["id"] for r in rows}
            for sid in sorted(skipped):
                _collide("catalogue_skus", sid, "la fila real (editada o cargada de verdad)",
                         "un re-seed nunca reescribe un SKU que ya no es de prueba")
        async with con.transaction():
            # Refresh seed aliases only (keep learned/edit aliases intact). When we are loading the
            # DEMO catalogue the delete is narrowed further — to aliases hanging off SEEDED SKUs — so
            # a real catalogue that lives on the same tenant keeps the aliases its own load wrote
            # (`load_catalogue(seeded=False)` also stamps source='seed'; without this narrowing the
            # demo seed would strip a real tenant's alias table on the founder's own tenant).
            if seeded:
                await con.execute(
                    "delete from sku_aliases a using catalogue_skus s "
                    "where a.tenant_id=$1 and a.source='seed' and s.id=a.sku_id and s.seeded", tenant)
            else:
                await con.execute("delete from sku_aliases where tenant_id=$1 and source='seed'", tenant)
            for sku, doc, vec in zip(skus, docs, vecs):
                if sku["id"] in skipped:
                    continue
                search_src = " ".join([sku["name"], sku.get("family", "").replace("_", " "),
                                       str(sku.get("code") or "")]
                                      + (sku.get("aliases") or []))
                ec = _ecom_fields(sku)
                await con.execute(
                    # ⚠️ `to_tsvector('english', …)` over SPANISH text is wrong for the language, and
                    # it is deliberate: brain/matcher.py queries this column with
                    # `websearch_to_tsquery('english', …)`. Index config and query config MUST match
                    # or the deterministic FTS floor stops firing entirely — so this moves WITH
                    # matcher.py (and golive.py, app.py), never before it.
                    """insert into catalogue_skus
                         (id, tenant_id, code, name, family, base_unit, pack_factor,
                          variable_weight, price, in_assortment, embedding, search_text, attrs, seeded,
                          live_on_ecom, image_url, customizations, asap_envelope)
                       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, to_tsvector('english',$12), $13,$14,
                               $15,$16,$17,$18)
                       on conflict (id) do update set
                         code=excluded.code, name=excluded.name, family=excluded.family,
                         base_unit=excluded.base_unit, pack_factor=excluded.pack_factor,
                         variable_weight=excluded.variable_weight, price=excluded.price,
                         in_assortment=excluded.in_assortment, embedding=excluded.embedding,
                         search_text=excluded.search_text, attrs=excluded.attrs, seeded=excluded.seeded,
                         -- ProfileName rule: an operator edit flips seeded=false; a re-seed must NOT
                         -- clobber those e-commerce fields. Only refresh ecom columns on still-seeded rows.
                         live_on_ecom=case when catalogue_skus.seeded then excluded.live_on_ecom
                                           else catalogue_skus.live_on_ecom end,
                         image_url=case when catalogue_skus.seeded then excluded.image_url
                                        else catalogue_skus.image_url end,
                         customizations=case when catalogue_skus.seeded then excluded.customizations
                                             else catalogue_skus.customizations end,
                         asap_envelope=case when catalogue_skus.seeded then excluded.asap_envelope
                                            else catalogue_skus.asap_envelope end
                       -- THE COLLISION LAW, structural (the pre-check above is the report; THIS is
                       -- the guarantee): a seeded write may only ever land on a row that is already
                       -- seeded. A real row is left exactly as it is, including its `seeded=false`.
                       where catalogue_skus.seeded or not excluded.seeded""",
                    sku["id"], tenant, sku.get("code"), sku["name"], sku.get("family", ""),
                    sku.get("base_unit", "kg"), sku.get("pack_factor", 1),
                    bool(sku.get("variable_weight", False)), sku.get("price"),
                    bool(sku.get("in_assortment", True)), vec, search_src,
                    {"doc": doc}, seeded,
                    ec["live_on_ecom"], ec["image_url"], ec["customizations"], ec["asap_envelope"],
                )
                n_sku += 1
                # aliases: the canonical name + every listed alias, normalized, deduped.
                # ⚠️ §5.7: what the CUSTOMER teaches («el jamoncito», «jamón york», «la de cabeza»)
                # is deliberately NOT in the catalogue's alias list — see catalogue.json's
                # `_learnable_mentions`. Pre-loading them would short-circuit the whole loop: the
                # question would never be asked, so the moat would never be visible.
                seen = set()
                for raw in [sku["name"]] + (sku.get("aliases") or []):
                    a = matcher.normalize(raw)
                    if not a or a in seen:
                        continue
                    seen.add(a)
                    await con.execute(
                        """insert into sku_aliases (tenant_id, alias, sku_id, phone_number, source, weight)
                           values ($1,$2,$3,null,'seed',1)""",
                        tenant, a, sku["id"],
                    )
                    n_alias += 1

    # ── THE CARD, NOT JUST THE ROWS (2026-07-27) ────────────────────────────────────────────────
    # A catalogue is TWO things: `catalogue_skus`, which the matcher stands on, and the DIRECTORY,
    # which is the compacted block pinned into the mind's fold so it can answer «¿tenéis jamón?» in
    # the same breath a human would. This function wrote the first and never armed the second —
    # `golive`, `catalogue.create_sku` and the founder upload route all call `directory`, and the
    # SEED path was the only one that did not.
    #
    # The consequence was invisible and total: on prod, `catalogue_skus` held 68 rows for tenant
    # `rocoto` while `catalogue_directory` held NO row for it at all. The demo world — the one Peter
    # shows people, and the one his own account opens into — had been grounding every conversation
    # with an EMPTY `### CATALOGUE`. And `agent_reply` has no tool that queries `catalogue_skus`, so
    # the card is the ONLY path: an absent card is not a slow answer, it is a confident wrong one.
    #
    # `force=True` and awaited, not the debounced `schedule_rebuild`: a seed load is a bulk restore
    # and the world has to be usable the instant it returns — a reset Peter presses before a demo
    # must not hand him a world whose mind catches up a few seconds later.
    # Fail-soft: the rows are already committed, and a distill hiccup must never un-seed a world.
    try:
        import directory as _directory
        await _directory.build(tenant, force=True)
    except Exception:
        log.debug("seed.load_catalogue: directory build fail-soft for %s", tenant, exc_info=True)

    return {"skus": n_sku, "aliases": n_alias, "skipped_real": len(skipped)}


async def clear_seeded_catalogue(tenant: Optional[str] = None) -> None:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("delete from catalogue_skus where tenant_id=$1 and seeded", tenant)


# ─────────────────────────── Demo seed (contacts + history + profiles) ───────────────────────────

def _catalogue_spec() -> Dict[str, Any]:
    """The ACTIVE world's catalogue, in the shape the file always had (`skus` + the `_`-prefixed
    documentation blocks the doubt demo reads). Reading it through the profile rather than off disk
    is what makes «switch the world» one assignment instead of a rewrite of every caller."""
    s = _spec()
    return {**dict(s.get("catalogue_meta") or {}), "skus": list(s.get("skus") or [])}


def _contacts_spec() -> Dict[str, Any]:
    """The ACTIVE world's business + contacts, in the shape `contacts.json` always had."""
    s = _spec()
    return {"business": dict(s.get("business") or {}), "contacts": list(s.get("contacts") or []),
            "invented_names": {"declared": list(s.get("invented_names") or [])}}


def invented_names(spec: Optional[Dict[str, Any]] = None) -> List[str]:
    """The closed set of business names THIS world may use. The vital asserts every name in the seed
    comes from here, and that none of the already-caught real ones appears anywhere.

    Per-profile on purpose: a second world invents its own houses, and a set that quietly became the
    union of every world's names would stop being able to catch a name that leaked between them."""
    return list((spec or _spec()).get("invented_names") or [])


async def all_invented_names() -> List[str]:
    """Every declared name across the registry — for a cross-world uniqueness read, never for
    validating one profile (see `invented_names`)."""
    out: List[str] = []
    for s in (await registry()).values():
        out.extend(s.get("invented_names") or [])
    return sorted(set(out))


async def _catalogue_map(con, tenant: str) -> Dict[str, Dict[str, Any]]:
    rows = await con.fetch(
        """select id, code, name, base_unit, price::float8 as price, variable_weight
             from catalogue_skus where tenant_id=$1""", tenant)
    return {r["id"]: dict(r) for r in rows}


def _recent_dow(dow: int, weeks_ago: int, today) -> Any:
    offset = (today.weekday() - dow) % 7
    return today - timedelta(days=offset) - timedelta(weeks=weeks_ago)


# Peter's own two WhatsApp numbers. Deliberate: a live message from his phone merges into the SAME
# seeded thread, which is what makes the demo a demo. They get NO current-week order — he places it.
DEMO_PHONES = {"+12025550110", "+12025550111"}
# The one-off extras that keep two consecutive orders from being identical. Drawn from families a
# venue plausibly adds on top of its standing basket, never from the ambiguity pairs (a seeded
# HISTORY should not be teaching the matcher the very words the doubt demo depends on).
_EXTRA_POOL = ["sku-sobrasada", "sku-butifarra", "sku-longaniza-fresca", "sku-chuleta-sajonia",
               "sku-solomillo-cerdo", "sku-lengua-cerdo", "sku-queso-cabra-rulo", "sku-morro-cerdo"]
_JITTER = [0, 1, 0, 2, -1, 0, 1, -1]  # deterministic per-order qty wobble (no two orders identical)


def _cadence_label(days: float) -> str:
    if days <= 4:
        return "Varias veces por semana"
    if days <= 8:
        return "Cada semana"
    if days <= 11:
        return "Casi todas las semanas"
    return "Cada quince días"


def _seed_line(catmap: Dict[str, Dict[str, Any]], sku_id: str, qty: float, unit: str) -> Dict[str, Any]:
    ci = catmap.get(sku_id, {})
    name = ci.get("name", sku_id)
    price = ci.get("price")
    var = bool(ci.get("variable_weight"))
    lt = round(qty * price, 2) if (isinstance(price, (int, float)) and not var) else None
    return {"raw_text": name, "mention": name, "item": name, "sku_id": sku_id, "code": ci.get("code"),
            "name": name, "family": "", "qty": qty, "unit": unit, "price": price, "line_total": lt,
            "variable_weight": var, "note": "", "keep_in_mind": "", "attention": "clean",
            "band": "clean", "confidence": "high"}


def _vary_basket(catmap, usual, idx):
    """Deterministically vary a standing basket so no two seeded orders are identical: jitter
    quantities, occasionally drop the last item, occasionally add a one-off extra."""
    lines = []
    for li, u in enumerate(usual):
        q = max(1, (u["qty"] or 1) + _JITTER[(idx + li) % len(_JITTER)])
        lines.append(_seed_line(catmap, u["sku_id"], q, u["unit"]))
    if idx % 4 == 3 and len(lines) > 1:           # every 4th order: a lighter order
        lines = lines[:-1]
    if idx % 3 == 1:                               # every 3rd-ish: a one-off extra
        have = {u["sku_id"] for u in usual}
        for sku in _EXTRA_POOL:
            if sku not in have and sku in catmap:
                lines.append(_seed_line(catmap, sku, [2, 3, 1, 4][idx % 4], "kg"))
                break
    return lines


_DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _say_map() -> Dict[str, str]:
    """sku_id -> the natural word the customer would say (the first alias), so the seeded order TEXT
    matches the order LINES and the highlight entities land on the right words."""
    m: Dict[str, str] = {}
    for s in _catalogue_spec()["skus"]:
        al = s.get("aliases") or []
        m[s["id"]] = (al[0] if al else s["name"]).lower()
    return m


def _num(q) -> str:
    return str(int(q)) if float(q).is_integer() else f"{q:g}".replace(".", ",")


def _qfmt(qty, unit, say) -> str:
    if unit == "kg":
        return f"{_num(qty)} kg de {say}"
    if unit in ("unit", "units", "ud", "unidad", "uds"):
        return f"{_num(qty)} {say}"
    if unit in ("case", "caja", "cajas"):
        return f"{_num(qty)} cajas de {say}"
    return f"{_num(qty)}{unit} {say}"


def _explicit_text(lines, saymap, day, short=False) -> str:
    """How this trade actually writes an order at 06:10 — a list, no ceremony."""
    segs = [_qfmt(ln["qty"], ln["unit"], saymap.get(ln["sku_id"], ln["name"].lower())) for ln in lines]
    body = ", ".join(segs)
    return body if short else f"buenas, para el {day}: {body}"


def _entities(text, lines, saymap):
    ents, low = [], text.lower()
    for i, ln in enumerate(lines):
        say = saymap.get(ln["sku_id"], ln["name"].lower())
        if say and say in low:
            ents.append({"text": say, "category": "producto", "order_line_index": i})
    return ents


def _seed_media_url(fname: str):
    """Return the served URL for a generated seed asset if it exists, else None (text-only fallback).
    Stored FLAT in MEDIA_DIR as seed-<fname> because /media/{fname} rejects sub-paths (no slashes)."""
    p = os.path.join(config.MEDIA_DIR, f"seed-{fname}")
    return f"{config.PUBLIC_BASE_URL}/media/seed-{fname}" if os.path.exists(p) else None


def _utterances(text: str, dur):
    """Split a voice transcript into timestamped chunks so the transcript view shows timestamps."""
    parts = [p.strip() for p in re.split(r"(?<=[.!?,])\s+", text) if p.strip()]
    if len(parts) < 2:
        w = text.split()
        parts = [" ".join(w[i:i + 9]) for i in range(0, len(w), 9)] or [text]
    n = max(1, len(parts))
    step = (float(dur) if dur else float(n)) / n
    return [{"speaker": 0, "start": round(i * step, 1), "text": p} for i, p in enumerate(parts)]


def _audio_duration(fname: str):
    """Real length of a seeded voice note (seconds) via ffprobe, so the player shows a true duration."""
    p = os.path.join(config.MEDIA_DIR, f"seed-{fname}")
    if not os.path.exists(p):
        return None
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", p], text=True).strip()
        return round(float(out), 1)
    except Exception:
        return None


async def _msg(con, mid, phone, role, text, mtype, ts, *, transcript=None, media_urls=None, meta=None):
    await con.execute(
        """insert into whatsapp_messages
             (id, phone_number, role, message_text, message_type, transcript, transcript_status,
              media_urls, media_types, transcript_meta, created_at, seeded)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true) on conflict (id) do nothing""",
        mid, phone, role, text or "", mtype, transcript,
        ("done" if transcript else "none"),
        media_urls or [],
        (["image/jpeg"] if mtype == "image" else ["audio/ogg"] if mtype == "audio" else []),
        (meta or {}), ts)


def scope_of(phone: str) -> str:
    """The runtime scope for a customer's conversation. `wa.<digits>` is the flat convenience scope
    this deployment uses everywhere (agent_reply._scope, sup_api, gate.app_scope's own fallback)."""
    return tenancy.scope_of(phone)                 # WP-A1: one spelling, in tenancy


# ── Storefront (e-commerce) seed orders ─────────────────────────────────────────────────────────
# DISTINCT, e-commerce-ONLY accounts (NOT the WhatsApp contacts) — a venue orders through ONE channel,
# never both (Peter: "there wouldn't really be a situation where they ordered on e-commerce AND on
# WhatsApp"). Names come from the SAME invented set; the surnames are the shop-side venues.
# Each tuple is (phone, customer_name, status, [(sku_id, qty, unit, line_note)…], order_note).
_CANON_STOREFRONT_ORDERS = [
    ("+34622220001", "Casa Bermejo (tienda)", "needs_review",
     [("sku-chorizo-cular-pieza", 6, "kg", ""),
      ("sku-salchichon-cular", 4, "kg", ""),
      ("sku-jamon-serrano-pieza", 3, "kg", "deshuesar y envasar al vacío en tacos")],
     "Pedido web — deshuesar y envasar al vacío en tacos."),
    ("+34622220002", "Mesón Peral (tienda)", "needs_review",
     [("sku-chorizo-sarta-500", 20, "unit", ""),
      ("sku-fuet-170", 24, "unit", "")],
     "Pedido web."),
    ("+34622220003", "Taberna Ruano (tienda)", "approved",
     [("sku-sobrasada", 8, "unit", ""),
      ("sku-bacon-lon", 6, "unit", "")],
     "Pedido web."),
    ("+34622220004", "Bar Lumbre (tienda)", "approved",
     [("sku-manchego-cuna", 12, "unit", ""),
      ("sku-lomo-embuchado-cana", 6, "unit", "")],
     "Pedido web."),
]


async def _seed_storefront_orders(con, catmap, saymap, now, today, counts) -> None:
    """Seed a handful of from_storefront=true orders, so the default demo blends WhatsApp +
    e-commerce + one e-commerce customization. needs_review ones populate the daily brief; approved
    ones give the Orders tab an e-commerce side. All seeded=true; deterministic ids → idempotent.
    Defensive: never raises (a half-wired box must still get its WhatsApp seed)."""
    try:
        deliver = today + timedelta(days=2)
        # THIS WORLD'S storefront orders — a profile with no `storefront_orders` block simply has no
        # e-commerce side, honestly, instead of inheriting Aldonza's four venues.
        for oi, (phone, name, status, raw_lines, onote) in enumerate(
                _spec().get("storefront_orders") or []):
            lines = []
            for sku_id, qty, unit, lnote in raw_lines:
                ln = _seed_line(catmap, sku_id, qty, unit)
                ln["mention"] = (saymap.get(sku_id, ln["name"]) or ln["name"]).lower()
                if lnote:                       # a customization request flips the line custom
                    ln["note"] = lnote
                    ln["custom"] = True
                lines.append(ln)
            # a couple of hours ago for needs_review (fresh in the brief), a bit older for approved
            cts = now - timedelta(hours=(3 + oi) if status == "needs_review" else (26 + oi))
            await con.execute(
                """insert into orders (id, phone_number, customer_name, status, lines, note,
                                       delivery_date, created_at, seeded, from_storefront)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,true,true) on conflict (id) do nothing""",
                f"seed-store-{phone[-4:]}-{oi}", phone, name, status, lines, onote,
                deliver.isoformat(), cts)
            counts["orders"] += 1
    except Exception:
        log.debug("seed: storefront orders skipped (additive)", exc_info=True)


# ═════════════════════════ THE DAY — business, range, stock, review, doubt ═══════════════════════

async def _seed_business(con, tenant: str, spec: Dict[str, Any], counts: Dict[str, int]) -> None:
    """The distributor itself: the `tenants` row (Cárnicas Aldonza — INVENTED), the delivery RULE
    (`tenant_range`: radius km from the Mercamadrid depot, §5.8a item 2) and the prep cutoff the
    §5.8 timeout clamps against.

    THE BINDING (2026-07-27): the row is written on the FOUNDER'S OWN TENANT SLUG — `tenant`, i.e.
    `config.BRAIN_TENANT`, the slug `auth._founder_tenant()` resolves Peter's sign-in to — and NOT on
    the slug in contacts.json. Every other row in this world already carries `tenant_id = tenant`
    (catalogue, profiles, range, stock, e-commerce); writing the identity under a different slug made
    it an ORPHAN nothing read, so the founder's app opened on a tenant row that still said `Sancho`
    while the world underneath it was Cárnicas Aldonza. One tenant, one world.

    `tenants.seeded=true` is what makes the row's CONTENT replaceable; it is upserted so a REAL tenant
    row of the same slug is never silently overwritten with demo data (`where tenants.seeded` on the
    update, so a live row wins and the seed reports the collision instead)."""
    b = spec.get("business") or {}
    slug = str(tenant)                      # ← the founder's tenant, not contacts.json's slug
    try:
        live = await con.fetchrow("select slug, name, seeded from tenants where slug=$1", slug)
        if live and not live["seeded"]:
            _collide("tenants", slug, live["name"] or slug,
                     "el negocio real de este tenant manda sobre el mundo de prueba")
            counts["tenants_skipped"] = counts.get("tenants_skipped", 0) + 1
            return
    except Exception:
        log.debug("seed: tenants pre-check skipped", exc_info=True)
    try:
        await con.execute(
            """insert into tenants (slug, name, tagline, status, seeded, address, city, region,
                                    country, lat, lng, currency_code)
               values ($1,$2,$3,'test',true,$4,$5,$6,$7,$8,$9,'eur')
               on conflict (slug) do update set
                 name=case when tenants.seeded then excluded.name else tenants.name end,
                 tagline=case when tenants.seeded then excluded.tagline else tenants.tagline end,
                 address=case when tenants.seeded then excluded.address else tenants.address end,
                 city=case when tenants.seeded then excluded.city else tenants.city end,
                 lat=case when tenants.seeded then excluded.lat else tenants.lat end,
                 lng=case when tenants.seeded then excluded.lng else tenants.lng end""",
            slug, b.get("name", "Cárnicas Aldonza"), b.get("tagline", ""), b.get("address", ""),
            b.get("city", ""), b.get("region", ""), b.get("country", "ES"),
            b.get("depot_lat"), b.get("depot_lon"))
        counts["tenants"] = counts.get("tenants", 0) + 1
    except Exception:
        log.debug("seed: tenants row skipped", exc_info=True)
    # Inventory is OFF by default per tenant (brain/stock.inventory_on). The seeded world turns it
    # ON, because LOW_STOCK is one of the three review reasons we have to be able to show.
    # Defensive: the column is landing in this same session's stock work (a file this module does
    # not own), so its absence must not take the seed down.
    try:
        await con.execute("update tenants set inventory_enabled=$2 where slug=$1 and seeded",
                          slug, bool(b.get("inventory_enabled", True)))
    except Exception:
        log.info("seed: tenants.inventory_enabled not present yet — inventory stays OFF for %s", slug)
    # The delivery RULE. Written through brain/range.set_range so the seed can never disagree with
    # the module that reads it.
    #
    # A REAL RADIUS IS NEVER TOUCHED. A delivery radius is an operating rule somebody set — a demo
    # load must never move a depot or a radius a real day is being planned against. Absent → the seed
    # supplies one (that is what makes §5.8a's out-of-range review reason fire on real state);
    # present and NOT seeded → kept, and reported.
    #
    # ⚠️ THE MARK (2026-07-27, the switch). `tenant_range` has ONE row per tenant, so before
    # `seeded` existed the seed wrote only into an empty row and the teardown never deleted it.
    # Correct with one world; FATAL with two — profile B's Valencia depot would silently never apply
    # because profile A's Madrid one is still sitting there, and every «fuera de tu radio» sentence
    # in world B would be measured against world A's depot. So the row now carries the mark: a
    # SEEDED row is replaced by the incoming world, a real one still wins outright.
    try:
        from brain import range as _range
        try:
            existing = await con.fetchrow(
                "select range_kind, range_km, coalesce(seeded,false) as seeded from tenant_range "
                "where tenant_id=$1", tenant)
        except Exception:
            # The column is not there (an old box, or `_ensure_schema` could not run). Fall back to
            # the pre-mark behaviour — write only into an empty row — rather than losing the radius
            # entirely, which is what an unguarded read here would have done: the outer `except`
            # would have swallowed it and §5.8a's out-of-range review reason would quietly stop
            # firing on the demo world with no line in the log saying why.
            log.info("seed: tenant_range has no `seeded` column — the demo radius is written only "
                     "when the row is absent, and a profile switch will not move it")
            existing = await con.fetchrow(
                "select range_kind, range_km, false as seeded from tenant_range where tenant_id=$1",
                tenant)
        if existing and not existing["seeded"]:
            _collide("tenant_range", tenant,
                     f"{existing['range_kind']} {existing['range_km']}",
                     "el radio de reparto real no se toca (una regla de verdad, no un dato de prueba)")
            counts["tenant_range_skipped"] = counts.get("tenant_range_skipped", 0) + 1
        else:
            await _range.set_range(con, tenant, range_km=b.get("range_km"),
                                   depot_lat=b.get("depot_lat"), depot_lon=b.get("depot_lon"),
                                   depot_label=b.get("depot_label", ""))
            # The mark, stamped after the module's own writer has run, so `brain/range` stays the one
            # thing that knows how to write a radius and this stays the one thing that marks it.
            try:
                await con.execute("update tenant_range set seeded=true where tenant_id=$1", tenant)
            except Exception:
                log.info("seed: tenant_range.seeded not present — the demo radius will survive a "
                         "profile switch until the column lands")
            counts["tenant_range"] = counts.get("tenant_range", 0) + 1
    except Exception:
        log.debug("seed: tenant_range skipped (brain/range not wired yet)", exc_info=True)


# What the shelf holds this morning. `sku-paleta-cocida-pieza` is DELIBERATELY short against Bar
# Lumbre's and Café Sotillo's usual: that is what makes §5.8's LOW_STOCK reason fire on real state
# instead of a fixture. Everything else is comfortable, so exactly one thing is short — §5.8a's
# "one reason, never a list".
_CANON_STOCK = [
    ("sku-paleta-cocida-pieza", 4, "kg"),
    ("sku-jamon-cocido-pieza", 46, "kg"),
    ("sku-jamon-serrano-pieza", 31, "kg"),
    ("sku-chorizo-cular-pieza", 22, "kg"),
    ("sku-secreto-iberico", 38, "kg"),
    ("sku-presa-iberica", 26, "kg"),
    ("sku-panceta-adobada-pieza", 55, "kg"),
    ("sku-callos-ternera", 40, "kg"),
    ("sku-morcilla-cebolla", 18, "kg"),
    ("sku-chorizo-fresco", 24, "kg"),
    ("sku-manchego-pieza", 15, "kg"),
    ("sku-oreja-cocida", 12, "kg"),
]


async def _seed_stock(con, tenant: str, catmap: Dict[str, Any], counts: Dict[str, int]) -> None:
    """Real `stock_levels` rows, written through brain/stock.set_level so the low_at seeding rule
    (LOW_AT_FRACTION) is the module's and not a copy of it here.

    NOTE ON TEARDOWN: `stock_levels` has no `seeded` column — it does not need one. Its `sku_id` is
    `references catalogue_skus(id) on delete cascade`, so deleting the seeded SKUs takes the seeded
    levels with them, and a level on a REAL (non-seeded) SKU is structurally out of reach."""
    try:
        from brain import stock as _stock
    except Exception:
        return
    # THIS WORLD'S shelf. A profile with no `stock` block seeds no levels at all — see the module
    # docstring: a world that borrows another world's shelf is not a second world.
    for sku_id, qty, unit in (_spec().get("stock") or []):
        if sku_id not in catmap:
            continue
        try:
            # THE COLLISION LAW one level down: a shelf count is written only onto a SEEDED SKU. If
            # this id resolved to a real catalogue row (the loader skipped it, keeping theirs), the
            # demo must not tell a real warehouse it has 4 kg of anything.
            if not await con.fetchval(
                    "select seeded from catalogue_skus where tenant_id=$1 and id=$2", tenant, sku_id):
                _collide("stock_levels", sku_id, "el SKU real (sin nivel de prueba encima)",
                         "no se inventa stock sobre un producto de verdad")
                continue
            await _stock.set_level(con, tenant, sku_id, qty, unit, source="capture")
            counts["stock_levels"] = counts.get("stock_levels", 0) + 1
        except Exception:
            log.debug("seed: stock level %s skipped", sku_id, exc_info=True)


def demo_scopes(contacts: Optional[List[Dict[str, Any]]] = None) -> List[str]:
    """Every runtime scope THIS world may touch — the active profile's customers' conversations, and
    nothing else. The teardown of the RLS-fenced tables runs INSIDE these scopes, so the database
    itself is the second fence: a scoped connection cannot see, let alone delete, a row outside its
    own subtree (schema_rls.sql: ENABLE + FORCE, `scope <@ current_setting('rocoto.scope')`).

    ⚠️ THE TEARDOWN USES `all_demo_scopes()`, NOT THIS. A switch has to reach the scopes of the world
    it is REPLACING, which are not the incoming world's — so the teardown takes the union across the
    registry and this stays the one-world read (the mid-seed idempotency sweep, which is about the
    world being built and nothing else)."""
    cs = contacts if contacts is not None else (_contacts_spec().get("contacts") or [])
    return [scope_of(c["phone"]) for c in cs if c.get("phone")]


async def _seed_card(scope: str, body: str) -> None:
    """The party card the review sheet joins on for `party` (runtime.review_list). `lineage='seed'`
    is the mark the teardown keys on — a live card is 'live', a CR test card is 'test'.

    `card` is RLS-fenced (ENABLE + FORCE), so this goes through `db.scoped_tx` like every other
    runtime write; the owner pool would be refused by the policy, not silently allowed.

    A LIVE CARD WINS. `where card.lineage='seed'` already made that structural; on the live box it
    also has to be VISIBLE, because a seeded thread on one of Peter's own numbers keeps the ficha his
    real conversation built — which is the correct outcome and would otherwise look like a bug."""
    async with db.scoped_tx(scope) as con:
        lineage = await con.fetchval("select lineage from card where scope=$1::ltree", scope)
        if lineage and lineage != "seed":
            _collide("card", scope, f"ficha real (lineage={lineage})",
                     "la ficha que construyó la conversación de verdad manda")
            return
        await con.execute(
            "insert into card(scope, body, version, lineage) values($1::ltree,$2,0,'seed') "
            "on conflict (scope) do update set body=excluded.body "
            "where card.lineage='seed'", scope, body)


async def _silence_invented(phone: str, counts: Dict[str, Any]) -> None:
    """An INVENTED customer number must never be able to receive a real WhatsApp.

    The world lives on the live rail now: `run_brain_intake` runs the REAL brain, and a burst it
    cannot resolve makes the mind ASK — `pipeline._ask` writes the question into the thread AND puts
    it on the wire. For Peter's own two numbers (`DEMO_PHONES`) that is the feature: he taps the
    buttons and the loop closes. For +34 611 111 00x — numbers this repo invented — it is a message
    from a real business number to somebody we made up. Meta's 24-hour window makes delivery
    practically impossible (they have never written to the WABA; their inbound is DB rows, not
    traffic), but "practically impossible" is not a mechanism, and the failed send still parks a
    `wa_delivery_failed` row on the founder's review sheet.

    So the invented scopes are put in SOMBRA — the product's OWN mechanism for a shut mouth (§5.5,
    `gate.set_mode`): every outbound is held and drafted to review instead of sent, and an inbound
    call is not answered in Rocoto's name. THE COLLISION LAW APPLIES HERE TOO: a scope that already
    carries an explicit mode was decided by a person, and the seed does not touch it."""
    if phone in DEMO_PHONES:
        return                                   # Peter's own numbers stay live, on purpose
    scope = scope_of(phone)
    try:
        import gate as _gate
        cur = ((await _gate.effective_mode(scope)) or {}).get("own")
        if cur == "sombra":
            return                               # already silent (an earlier load) — nothing to say
        if cur is not None:                      # somebody DECIDED something else for this scope
            _collide("scope_state", scope, f"mode={cur}",
                     "un modo puesto a mano manda sobre el silencio por defecto del mundo de prueba")
            return
        await _gate.set_mode(scope, "sombra")
        counts["silenced"] = counts.get("silenced", 0) + 1
    except Exception:
        log.warning("seed: could not put the invented number %s in sombra — it could be messaged "
                    "for real if the brain decides to ask", phone, exc_info=True)


async def _seed_review_sheet(con, tenant: str, contacts: List[Dict[str, Any]],
                             counts: Dict[str, int]) -> Dict[str, Any]:
    """THE THREE THINGS TO REVIEW (§5.8's closed set), each carrying exactly ONE boss-facing reason.

    Everything goes through `review.hold_for_review` — the ONE door — so these rows are
    indistinguishable from ones the runtime parks, right down to the `review.held` event and the
    `review_nudge` duty that will chase them. What the seed supplies is the STATE that makes each
    reason true, so the sentence is not a fiction:

      LOW_STOCK  the shelf really is short of PALETA COCIDA (`stock_levels`, above) against a real
                 order for it. The sentence is `brain/stock.short_reason`'s, verbatim.
      FLAG       Bar Carrasco's delivery point really is outside the radius (`tenant_range` +
                 `customer_profiles.lat/lon`), and the distance is `brain/range`'s own measurement.
                 §5.8a: OUT OF RANGE, TOO BIG and DOUBT are all FLAG — one source, one sentence.
      FLAG       Asador Quesada's order really is far above their own median basket
                 (`brain/validators.validate_order`'s band), computed from the seeded history.
      TIMEOUT    a question was asked and not answered inside the window — the open_loop below.

    The rows are minted with the SEED_WORLD mark on their payload, and this function clears its own
    previous marks first, so a re-seed leaves one world and not two."""
    import review
    from brain import range as _range
    from brain import stock as _stock

    # idempotency: drop this world's previous runtime rows before writing today's, scope by scope.
    # The party cards are exempt — they were written earlier in THIS seed run (see `cards=False`).
    await _clear_runtime_marks(demo_scopes(contacts), cards=False)

    out: Dict[str, Any] = {"rows": []}

    def _by_role(role: str) -> Optional[Dict[str, Any]]:
        return next((c for c in contacts if c.get("role") == role), None)

    # NOTE ON `con`: it is the OWNER-pool connection and it is used ONLY to READ the non-RLS state
    # tables (`stock_levels`, `tenant_range`, `orders`). Every WRITE goes through
    # `review.hold_for_review` with no connection, so it opens its own `db.scoped_tx(scope)` —
    # the same door, the same RLS fence and the same `review.held` event as a live park.

    # ── 1 · LOW_STOCK ───────────────────────────────────────────────────────────────────────────
    # Bar Lumbre's fresh order really asks for 12 kg of PALETA COCIDA and the shelf really holds 4.
    # The sentence is `brain/stock.short_reason`'s, computed here from those two rows.
    lumbre = next((c for c in contacts if c["phone"] == "+12025550110"), None) or contacts[0]
    scope = scope_of(lumbre["phone"])
    try:
        levels = await _stock.get_levels(con, tenant, ["sku-paleta-cocida-pieza"])
        v = _stock.verdict([{"sku_id": "sku-paleta-cocida-pieza", "qty": 12, "unit": "kg",
                             "name": "PALETA COCIDA PIEZA"}], levels, inventory_enabled=True)
        reason = v.get("reason") or ""
    except Exception:
        log.debug("seed: stock verdict unavailable", exc_info=True)
        reason = ""
    if reason:
        r = await review.hold_for_review(
            scope, review.LOW_STOCK, text=reason,
            detail=_mark(customer=lumbre["name"], sku_id="sku-paleta-cocida-pieza"))
        out["rows"].append({"source": review.LOW_STOCK, "why": reason, **r})
        counts["review"] = counts.get("review", 0) + 1

    # ── 2 · FLAG · outside the delivery radius ─────────────────────────────────────────────────
    # Bar Carrasco's delivery point is a REAL lat/lon in Alcalá; the depot is a REAL lat/lon at
    # Mercamadrid; the radius is the tenant's own rule. `brain/range` does the measuring and writes
    # the sentence — the seed never states a distance of its own.
    newbie = _by_role("new")
    if newbie:
        nscope = scope_of(newbie["phone"])
        try:
            rv = _range.verdict(await _range.get_range(con, tenant),
                                newbie.get("lat"), newbie.get("lon"))
            rreason, servable = rv.get("reason") or "", rv.get("servable", True)
        except Exception:
            log.debug("seed: range verdict unavailable", exc_info=True)
            rreason, servable = "", True
        if rreason and not servable:
            r = await review.hold_for_review(
                nscope, review.FLAG, text=rreason,
                detail=_mark(customer=newbie["name"], why_kind="range",
                             address=newbie.get("address", "")))
            out["rows"].append({"source": review.FLAG, "why": rreason, **r})
            counts["review"] = counts.get("review", 0) + 1

    # ── 3 · FLAG · the order is far above this customer's own norm ─────────────────────────────
    # Asador Quesada's seeded history IS the norm, and `seed-today-grande` really is ~4× it.
    # `brain/validators.validate_order` computes the ratio and owns the sentence; if it declines to
    # fire (thin history, unpriced lines) the seed does NOT invent a reason — a park with a made-up
    # sentence would be exactly the fiction §5.8 exists to prevent. It logs and moves on.
    big = _by_role("high_volume")
    if big:
        bscope = scope_of(big["phone"])
        try:
            from brain import validators as _val
            recent = [dict(r) for r in await con.fetch(
                "select lines from orders where phone_number=$1 and seeded and status='sent' "
                "order by created_at desc limit $2", big["phone"], _val.ORDER_VALUE_WINDOW)]
            todays = await con.fetchval(
                "select lines from orders where id='seed-today-grande'")
            gl = _grounded_from_lines(todays)
            bv = _val.validate_order(gl, [], {"recent_orders": recent})
            breason = bv.get("reason") or ""
        except Exception:
            log.debug("seed: validate_order unavailable", exc_info=True)
            bv, breason = {}, ""
        if breason:
            r = await review.hold_for_review(
                bscope, review.FLAG, text=breason, money=True,
                detail=_mark(customer=big["name"], why_kind="order_too_big",
                             order_id="seed-today-grande", ratio=bv.get("ratio")))
            out["rows"].append({"source": review.FLAG, "why": breason, **r})
            counts["review"] = counts.get("review", 0) + 1
        else:
            log.info("seed: the order-level norm did not fire for %s — no FLAG invented "
                     "(value=%s typical=%s n=%s)", big["name"], bv.get("value_cents"),
                     bv.get("typical_value_cents"), bv.get("typical_n"))
    return out


def _grounded_from_lines(lines: Any) -> List[Dict[str, Any]]:
    """A filed order's `lines` re-projected into the pre-decision GROUNDED shape
    (`{mention, qty, price, match:{pick:{sku_id, price}}}`) that `brain/validators` reads. The
    catalogue price already rode the line at fill time, so this moves it rather than looking it up:
    one price rule in the product, and this is not a second one."""
    if isinstance(lines, str):
        try:
            lines = json.loads(lines or "[]")
        except ValueError:
            lines = []
    out: List[Dict[str, Any]] = []
    for ln in (lines or []):
        if not isinstance(ln, dict):
            continue
        out.append({"mention": ln.get("mention") or ln.get("name") or "", "qty": ln.get("qty"),
                    "unit": ln.get("unit"), "price": None,
                    "match": {"pick": {"sku_id": ln.get("sku_id") or "", "price": ln.get("price")}}})
    return out


# ── §5.7 · THE CUSTOMER TRAINS THE AGENT — both halves, visible ─────────────────────────────────
# ONE question already answered (the alias is learned, the loop visibly closed) and ONE still open
# and ageing past the window (so the app shows what a pending question looks like, and TIMEOUT — the
# third review source — is standing on a real unanswered question rather than a mood).
async def _seed_doubt_loop(con, tenant: str, contacts: List[Dict[str, Any]], catmap, now,
                           counts: Dict[str, int]) -> Dict[str, Any]:
    import doubt as _doubt
    import review
    import spine
    from brain import pipeline as _pipeline  # function-scope: seed is imported BY the app
    spec = _catalogue_spec()
    # `_learnable_mentions` is OPTIONAL and, in every world added after the canon one, it is a plain
    # prose NOTE (a `_`-prefixed documentation key, same as `_comment`/`_gaps`) rather than the canon
    # world's `{"mentions":[…]}` structure. Read it only when it is actually the structured shape:
    # calling `.get` on the string form raised `AttributeError: 'str' object has no attribute 'get'`
    # INSIDE the seed load, which surfaced to the founder as a bare «no puedo activar» on every
    # world-switch to one of those profiles (Peter, 2026-07-28). A world without a learnable-mentions
    # script simply seeds no §5.7 learning demo — that is a missing flourish, never a failed switch.
    _lm = spec.get("_learnable_mentions")
    learnable = {m["say"]: m for m in (_lm.get("mentions", []) if isinstance(_lm, dict) else [])}
    out: Dict[str, Any] = {}

    def _name(sid: str) -> str:
        return (catmap.get(sid) or {}).get("name") or sid

    def _asked_payload(mention: str, ask_key: str, question: str, a: str, b: str) -> Dict[str, Any]:
        """The `doubt.asked` payload EXACTLY as `brain/pipeline._ask` writes it.

        THIS ROW IS TWO ORGANS AT ONCE and the seed needs both, or the demo lies about itself:
          · §5.7a's NEVER-TWICE ledger — `pipeline.asked_mentions()` reads `doubt.asked`
            (`payload.mention`), NOT the `question.asked` row that arms the §5.8 clock. Without it,
            saying «jamón york» again gets the customer asked a SECOND time, which is the exact
            nagging §5.7a forbids.
          · the TAP's lookup key — `pipeline.resolve_doubt_tap` finds the question by
            `type='doubt.asked' and payload->>'ask_key' = <the wamid we asked with>`. Without it, a
            tap on the seeded buttons resolves to `no_open_question` and the loop never closes.
        The live wire writes BOTH rows for one question (`review.on_question_asked` + this one), so
        writing both here is fidelity, not belt-and-braces."""
        return _mark(mention=mention, kind=_doubt.AMBIGUOUS, ask_key=ask_key,
                     question=question[:300], order_id=None,
                     options=[{"id": f"{_pipeline.OPTION_SKU_PREFIX}{a}", "title": _name(a)[:24],
                               "sku_id": a},
                              {"id": f"{_pipeline.OPTION_SKU_PREFIX}{b}", "title": _name(b)[:24],
                               "sku_id": b},
                              {"id": _pipeline.ESCAPE_ID, "title": _pipeline.ESCAPE_TITLE,
                               "sku_id": ""}])

    # ══ HALF 1 · RESOLVED — «el jamoncito», asked, tapped, learned ══════════════════════════════
    sotillo = next((c for c in contacts if c["phone"] == "+12025550111"), None)
    m = learnable.get("el jamoncito")
    if sotillo and m:
        phone, scope = sotillo["phone"], scope_of(sotillo["phone"])
        t0 = now - timedelta(days=6, hours=1)
        a, b = m["true_sku"], m["against"]
        await _msg(con, "seedmsg-doubt-jamoncito-q", phone, "user",
                   "buenas, ponme también el jamoncito, 3 kg", "text", t0)
        await _msg(con, "seedmsg-doubt-jamoncito-ask", phone, "assistant",
                   "a ver que no la líe — cuando dices «el jamoncito», ¿cuál te pongo?\n"
                   f"1) {_name(a)}\n2) {_name(b)}\n3) Ninguno, te digo", "text",
                   t0 + timedelta(minutes=2),
                   meta={"interactive": "button", "seed_world": _world(),
                         "options": [{"id": f"sku:{a}", "title": _name(a)[:24]},
                                     {"id": f"sku:{b}", "title": _name(b)[:24]},
                                     {"id": "none", "title": "Ninguno, te digo"}]})
        await _msg(con, "seedmsg-doubt-jamoncito-tap", phone, "user", _name(a), "text",
                   t0 + timedelta(minutes=5),
                   meta={"seed_world": _world(), "option_id": f"sku:{a}",
                         "context_id": "seedmsg-doubt-jamoncito-ask"})
        await _msg(con, "seedmsg-doubt-jamoncito-ack", phone, "assistant",
                   "perfecto, apuntado. Ya no te lo vuelvo a preguntar.", "text",
                   t0 + timedelta(minutes=6))
        counts["messages"] += 4
        # THE ROW THE LOOP EXISTS TO WRITE. Customer-scoped (`phone_number` set), source='learned' —
        # exactly what brain/learn._write_alias mints — so the matcher hits it on the very next
        # order and doubt.classify_line returns alias_hit ⇒ never asked again (§5.7a "NEVER TWICE").
        # delete-then-insert: `sku_aliases` has no unique key, so a bare re-`load_demo_seed` would
        # otherwise stack a second identical learned row (harmless to the matcher, a lie to anyone
        # counting how often this customer taught us the word).
        await con.execute(
            "delete from sku_aliases where tenant_id=$1 and alias=$2 and phone_number=$3 "
            "and source='learned'", tenant, matcher.normalize("el jamoncito"), phone)
        await con.execute(
            """insert into sku_aliases (tenant_id, alias, sku_id, phone_number, source, weight)
               values ($1,$2,$3,$4,'learned',2)""",
            tenant, matcher.normalize("el jamoncito"), a, phone)
        counts["aliases_learned"] = counts.get("aliases_learned", 0) + 1
        try:
            # `event` is RLS-fenced → its own scoped connection, never the owner pool.
            async with db.scoped_tx(scope) as rc:
                # the QUESTION, then the ANSWER that closed it, then the learning — the same three
                # rows the live wire leaves behind, in the same order and with the same causality.
                aid, _ = await spine.append_event(
                    rc, scope, _pipeline.ASKED_EVENT, "seed",
                    _asked_payload("el jamoncito", "seedmsg-doubt-jamoncito-ask",
                                   "cuando dices «el jamoncito», ¿cuál te pongo?", a, b),
                    lane="reasoning", dedupe_key=f"{_world()}:doubt-asked:jamoncito")
                await spine.append_event(
                    rc, scope, _pipeline.ANSWERED_EVENT, "seed",
                    _mark(mention="el jamoncito", sku_id=a, chose=_name(a)[:24],
                          ask_key="seedmsg-doubt-jamoncito-ask"),
                    caused_by=aid, lane="reasoning",
                    dedupe_key=f"{_world()}:doubt-answered:jamoncito")
                await spine.append_event(
                    rc, scope, "learn.alias", "seed",
                    _mark(alias="el jamoncito", sku_id=a, phone=phone), lane="world",
                    dedupe_key=f"{_world()}:learn:jamoncito")
        except Exception:
            log.debug("seed: learn.alias event skipped", exc_info=True)
        out["resolved"] = {"phone": phone, "mention": "el jamoncito", "sku_id": a}

    # ══ HALF 2 · STILL OPEN — «jamón york», asked this morning, no answer, past the window ══════
    bermejo = next((c for c in contacts if c["name"] == "Casa Bermejo"), None)
    m2 = learnable.get("jamón york")
    if bermejo and m2:
        phone, scope = bermejo["phone"], scope_of(bermejo["phone"])
        asked_at = now - timedelta(hours=2, minutes=20)     # the window is ONE HOUR (§5.8) → past it
        a2, b2 = m2["true_sku"], m2["against"]
        await _msg(con, "seedmsg-doubt-york-q", phone, "user",
                   "y ponme 5 kg de jamón york para los sandwiches", "text", asked_at)
        await _msg(con, "seedmsg-doubt-york-ask", phone, "assistant",
                   "no quiero apuntarte lo que no es — cuando dices «jamón york», ¿cuál te pongo?\n"
                   f"1) {_name(a2)}\n2) {_name(b2)}\n3) Ninguno, te digo", "text",
                   asked_at + timedelta(minutes=1),
                   meta={"interactive": "button", "seed_world": _world(),
                         "options": [{"id": f"sku:{a2}", "title": _name(a2)[:24]},
                                     {"id": f"sku:{b2}", "title": _name(b2)[:24]},
                                     {"id": "none", "title": "Ninguno, te digo"}]})
        counts["messages"] += 2
        # The QUESTION TAB + its armed clock. `review.on_question_asked` is the function that owns
        # this in the runtime (it appends `question.asked` and lets the generic binder open the tab
        # from the `question_timeout` manifest_duty ROW). The seed writes the underlying rows
        # DIRECTLY because it needs the tab ALREADY AGED — an armed timer cannot be back-dated
        # through the sense, and a demo that has to wait an hour is not a demo.
        loop_id = None
        try:
            # event / open_loop / timer are all RLS-fenced (schema_rls.sql) — one scoped txn writes
            # the three of them together, which is also how the runtime writes them.
            async with db.scoped_tx(scope) as rc:
                eid, _ = await spine.append_event(
                    rc, scope, review.ASKED, "seed",
                    _mark(ask_key="seedmsg-doubt-york-ask", tier="customer",
                          question="cuando dices «jamón york», ¿cuál te pongo?"),
                    lane="world", dedupe_key=f"{_world()}:asked:york")
                # …and the OTHER half of what one question leaves behind: the never-twice ledger row
                # the tap resolves against. `question.asked` above arms the §5.8 clock; this one is
                # what stops Rocoto asking «jamón york» a second time and what makes the seeded
                # buttons actually close the loop when Peter taps one. (See `_asked_payload`.)
                await spine.append_event(
                    rc, scope, _pipeline.ASKED_EVENT, "seed",
                    _asked_payload("jamón york", "seedmsg-doubt-york-ask",
                                   "cuando dices «jamón york», ¿cuál te pongo?", a2, b2),
                    caused_by=eid, lane="reasoning",
                    dedupe_key=f"{_world()}:doubt-asked:york")
                loop_id = await rc.fetchval(
                    """insert into open_loop (scope, kind, text, status, resume_ref, opened_at,
                                              entity_key, answer_shape, due_at, opened_by_event,
                                              lineage)
                       values ($1::ltree,'question',$2,'open',$3,$4,$5,'free',$6,$7,'live')
                       returning id""",
                    scope, "«jamón york» — el cliente no ha dicho cuál de los dos",
                    _mark(ask_key="seedmsg-doubt-york-ask",
                          options=[f"sku:{a2}", f"sku:{b2}", "none"]),
                    asked_at + timedelta(minutes=1), "question:seedmsg-doubt-york-ask",
                    asked_at + timedelta(hours=1, minutes=1), eid)
                counts["open_loops"] = counts.get("open_loops", 0) + 1
                await rc.execute(
                    """insert into timer (scope, loop_id, fires_at, kind, branch_id, state, payload,
                                          armed_by_event, fired_at, dedupe_key, lineage)
                       values ($1::ltree,$2,$3,'absence','timeout','fired',$4,$5,$6,$7,'live')
                       on conflict (dedupe_key) where dedupe_key is not null do nothing""",
                    scope, int(loop_id), asked_at + timedelta(hours=1, minutes=1),
                    _mark(reason="question_timeout"), eid, now - timedelta(hours=1, minutes=19),
                    f"{_world()}:timer:york")
                counts["timers"] = counts.get("timers", 0) + 1
        except Exception:
            # LOUD, not debug: without this tab the §5.7 loop has no visible open half and the
            # TIMEOUT row on the sheet is standing on nothing. (It was silently losing the whole
            # block: `ux_timer_dedupe` is a PARTIAL unique index, so `on conflict (dedupe_key)`
            # alone cannot infer it and postgres raises — see the `where` clause above.)
            log.warning("seed: the open question tab could not be written on %s "
                        "(the TIMEOUT row is parked anyway)", scope, exc_info=True)
        # ── 4 · TIMEOUT · the third review source, standing on the tab above ────────────────────
        r = await review.hold_for_review(
            scope, review.TIMEOUT,
            text="«jamón york»: le pregunté hace 2 h y no ha contestado — decídelo tú",
            detail=_mark(customer=bermejo["name"], loop_id=(int(loop_id) if loop_id else None),
                         ask_key="seedmsg-doubt-york-ask"))
        counts["review"] = counts.get("review", 0) + 1
        out["open"] = {"phone": phone, "mention": "jamón york",
                       "loop_id": (int(loop_id) if loop_id else None), **r}
    return out


# ══════════════════════════ REAL INTAKE — the brain, not a pre-filed row ═════════════════════════

async def ingest_demo_message(phone: str, text: str, *, tenant: Optional[str] = None,
                              msg_id: Optional[str] = None, when=None,
                              transcript: Optional[str] = None,
                              mtype: str = "text") -> Dict[str, Any]:
    """Drop ONE message into the seeded world and run THE ACTUAL ORDER BRAIN over it.

    This is the answer to Peter's "real order intake within that seeded SKU list": the message row is
    written exactly as WhatsApp would write it, then `brain.pipeline.run_burst` does the rest —
    matcher → validators → doubt → decision → `events.finalize_order`. Nothing here fabricates a
    line, a price or a status.

    THE MARK RIDES THE KWARG, not a stamp afterwards. `seeded` is threaded
    `run_burst → _build_order → events.create_order`, so it lands on the `created` event and the fold
    carries it to `orders`, `order_events` AND `medusa_sync` in one commit. That last one is the
    reason it matters: the Medusa outbox row is minted inside `create_order`, so an unmarked one is a
    real push intent for a demo order that `clear_all_seeded` (which deletes `medusa_sync … and
    seeded`) could never take back — it would survive every reset and stack up four more each time.
    The two UPDATEs below are a cheap idempotent belt for a partial fold; the kwarg is the mechanism.
    """
    tenant = tenant or config.BRAIN_TENANT
    # Called on its own (a route, a script) this has no world bound, and the rows its burst writes
    # would go out wearing the CANON mark while a different world is loaded — a row that belongs to
    # world B carrying world A's name. Bind the stored active world first; inside `run_brain_intake`
    # the load's own binding is already there and this is a no-op.
    _bound = _ACTIVE_SPEC.get() is not None
    token = None if _bound else _ACTIVE_SPEC.set(await active_spec())
    try:
        return await _ingest_demo_message(phone, text, tenant=tenant, msg_id=msg_id, when=when,
                                          transcript=transcript, mtype=mtype)
    finally:
        if token is not None:
            _ACTIVE_SPEC.reset(token)


async def _ingest_demo_message(phone: str, text: str, *, tenant: str,
                               msg_id: Optional[str] = None, when=None,
                               transcript: Optional[str] = None,
                               mtype: str = "text") -> Dict[str, Any]:
    ts = when or datetime.now(timezone.utc)
    mid = msg_id or f"seedmsg-brain-{re.sub(r'[^0-9]', '', phone)[-4:]}-{int(ts.timestamp())}"
    pool = db.get_pool()
    async with pool.acquire() as con:
        await _msg(con, mid, phone, "user", text, mtype, ts, transcript=transcript)
    from brain import pipeline as _pipeline
    started = datetime.now(timezone.utc)          # wall clock: `ts` is deliberately back-dated
    order = await _pipeline.run_burst(phone, [mid], tenant, seeded=True)
    caused = await _caused_orders(phone, started)
    marked = await _mark_burst_runtime(scope_of(phone), started, phone=phone)
    if not order or not isinstance(order, dict) or not order.get("id"):
        return {"ok": False, "message_id": mid, "order": None, "caused_orders": caused,
                "marked": marked, "why": "el brain no extrajo pedido de este mensaje"}
    async with pool.acquire() as con:
        await con.execute("update orders set seeded=true where id=$1", order["id"])
        try:
            await con.execute("update order_events set seeded=true where order_id=$1", order["id"])
        except Exception:
            log.debug("seed: order_events stamp skipped", exc_info=True)
    return {"ok": True, "message_id": mid, "order_id": order["id"], "caused_orders": caused,
            "marked": marked,
            "lines": len(order.get("lines") or []), "status": order.get("status")}


async def _mark_burst_runtime(scope: str, since, *, phone: str = "") -> Dict[str, int]:
    """Put THIS world's mark on the runtime rows the seeded intake's own burst just wrote.

    MEASURED ON THE LIVE BOX, 2026-07-27, which is why it exists: the intake runs the REAL brain, so
    the parks it produces come from `review.hold_for_review` — an `action` row with a plain payload
    and no `seed_world` on it. The teardown deletes runtime rows BY THE MARK, so each of those rows
    survived every reset and the review sheet grew one more «hace falta tu visto bueno» per press: a
    row born of the demo world that READ AS REAL on the founder's own screen, which is the exact
    confusion the seeded/real distinction exists to prevent.

    The window is deliberately tight — from the instant the burst started, in that ONE customer's
    scope, and only rows carrying no mark yet — because two of those scopes are Peter's own live
    numbers: a message he sends DURING a seed load must not be swept up. Seconds wide, one scope,
    additive; and the alternative (leaving them unmarked) is a review sheet that lies about what is
    real."""
    out: Dict[str, Any] = {"event": 0, "action": 0, "open_loop": 0, "timer": 0, "messages": 0,
                           "message_ids": []}
    mark = json.dumps({"seed_world": _world()})
    if phone:
        # The burst's OWN mouth: when the order is ambiguous the brain writes the question into the
        # thread (`pipeline._ask`). That row is Rocoto's, in a seeded conversation, minted by this
        # load — so it wears the mark and the next reset takes it with the rest of the world.
        # ASSISTANT rows only: a message the CUSTOMER sent in the same seconds is real, always.
        try:
            async with db.get_pool().acquire() as con:
                rows = await con.fetch(
                    "update whatsapp_messages set seeded=true "
                    "where phone_number=$1 and created_at >= $2 and not seeded and role='assistant' "
                    "returning id", phone, since)
                out["messages"] = len(rows)
                # Their ids are wamid-shaped, not `seedmsg-`, so — exactly like the brain's orders —
                # they are recorded on the seed meta and the audit reads them back. An exemption that
                # is a LIST OF ROWS, never a widened pattern (see SEED_ID_PREFIXES).
                out["message_ids"] = [r["id"] for r in rows]
        except Exception:
            log.warning("seed: could not mark the burst's own outbound row on %s", phone, exc_info=True)
    try:
        async with db.scoped_tx(scope) as con:
            out["event"] = int(await con.fetchval(
                "with u as (update event set payload = payload || $2::jsonb "
                "  where scope=$1::ltree and ts >= $3 and not (payload ? 'seed_world') returning 1) "
                "select count(*) from u", scope, mark, since) or 0)
            out["action"] = int(await con.fetchval(
                "with u as (update action set payload = payload || $2::jsonb "
                "  where scope=$1::ltree and created_at >= $3 and not (payload ? 'seed_world') "
                "  returning 1) select count(*) from u", scope, mark, since) or 0)
            loops = [r["id"] for r in await con.fetch(
                "update open_loop set resume_ref = coalesce(resume_ref,'{}'::jsonb) || $2::jsonb "
                "where scope=$1::ltree and opened_at >= $3 "
                "and not (coalesce(resume_ref,'{}'::jsonb) ? 'seed_world') returning id",
                scope, mark, since)]
            out["open_loop"] = len(loops)
            if loops:
                # `timer` has no created_at — it hangs off the tab, so the tab is the honest key: a
                # timer whose loop this burst opened is this burst's timer.
                out["timer"] = int(await con.fetchval(
                    "with u as (update timer set payload = payload || $2::jsonb "
                    "  where scope=$1::ltree and loop_id = any($3::bigint[]) "
                    "  and not (payload ? 'seed_world') returning 1) select count(*) from u",
                    scope, mark, loops) or 0)
    except Exception:
        log.warning("seed: could not mark the burst's runtime rows on %s — they would read as REAL "
                    "and the teardown would not remove them", scope, exc_info=True)
    if any(v for k, v in out.items() if k != "message_ids"):
        log.info("seed: marked the burst's runtime rows on %s: %s", scope, out)
    return out


async def _caused_orders(phone: str, since) -> List[str]:
    """EVERY order this burst caused — not only the one that came back.

    `run_burst` files its order as `preparing` BEFORE the mind reasons and flips it live at the end
    (`events.finalize_order`). A burst the mind cannot finish — an LLM outage, a timeout — therefore
    leaves that row behind: seeded, `preparing`, and wearing a `uuid4().hex` id that no
    SEED_ID_PREFIX covers. Unless it is named on the seed meta it is FOREIGN to `_audit_foreign`,
    and the SECOND press of «reiniciar» refuses to run. (`clear_all_seeded` would happily delete it —
    it deletes by the MARK, not by the id — so this is about the audit's knowledge, nothing else.)

    Tight by construction, because a widened exemption is how an audit stops meaning anything: this
    phone only, seeded only, and only rows created after the burst started."""
    like = "^(" + "|".join(re.escape(p) for p in SEED_ID_PREFIXES) + ")"
    try:
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select id from orders where phone_number=$1 and seeded and created_at >= $2 "
                "and id !~ $3", phone, since, like)
        return [r["id"] for r in rows]
    except Exception:
        log.debug("seed: caused-orders sweep skipped for %s", phone, exc_info=True)
        return []


# The messages that go through the REAL brain on a full seed. Deliberately few and deliberately
# chosen: each one puts a DIFFERENT retrieval shape in front of the matcher against the seeded SKU
# list. What comes out is the brain's verdict, not the seed's — that is the point, and it is why
# these are listed as INTENTS rather than expected outcomes:
#   1. a plain explicit order        — three unambiguous lines; expect clean, no question
#   2. «lo de siempre» + a change    — the history plus an amendment on one line
#   3. a calibre-shaped mention      — «sartas de chorizo» sits over a real DIMENSION pair
#                                      (500 G / 1 KG). If the alias resolves it outright, good; if the
#                                      margin is tight, §5.7's question is the correct outcome.
#   4. a deliberate GAP              — nothing in the catalogue matches ⇒ UNKNOWN ⇒ the comercial,
#                                      never a multiple choice. Sent from the BRAND-NEW customer,
#                                      who is exactly the person who does not know the range yet.
_CANON_BRAIN_INTAKE = [
    ("+34611111001", "buenas, para mañana: 8 kg de chorizo fresco, 6 kg de morcilla de cebolla y "
                     "10 kg de callos"),
    ("+34611111004", "lo de siempre para el sábado pero súbeme la panceta a 14"),
    ("+12025550110", "ponme 20 sartas de chorizo para el jueves"),
    ("+34611111006", "buenas, y échame también unas anchoas del cantábrico si tenéis"),
]


async def run_brain_intake(tenant: Optional[str] = None) -> List[Dict[str, Any]]:
    """Run `_CANON_BRAIN_INTAKE` through the real pipeline. Each one is independent and fail-soft: an
    unreachable model or a missing embedding server degrades the demo by one order, never by the
    whole seed. The result names exactly what happened to each message, which is what lets the
    report say honestly which orders came from the brain and which were pre-filed."""
    out: List[Dict[str, Any]] = []
    # THIS WORLD'S intake script (a profile without one runs no bursts — it is not Aldonza's four
    # messages against a catalogue that does not contain their words).
    for i, (phone, text) in enumerate(_spec().get("brain_intake") or []):
        try:
            r = await ingest_demo_message(
                phone, text, tenant=tenant,
                msg_id=f"seedmsg-brain-{i}",
                when=datetime.now(timezone.utc) - timedelta(minutes=42 - i * 7))
        except Exception as e:
            r = {"ok": False, "phone": phone, "error": f"{type(e).__name__}: {e}"}
            log.warning("seed: brain intake failed for %s — %s", phone, e)
        r["phone"] = phone
        r["text"] = text
        out.append(r)
    return out


# ════════════════════════════════════ THE FULL SEED ══════════════════════════════════════════════

async def load_demo_seed(tenant: Optional[str] = None, *,
                         through_brain: bool = True,
                         profile: Optional[str] = None) -> Dict[str, Any]:
    """Load the catalogue + the demo world (business, range, stock, contacts, histories, profiles,
    the review sheet and the §5.7 loop), then optionally run a few messages through the REAL brain.
    Every row is marked seeded (see the module docstring), it lands on the FOUNDER'S tenant, and
    anywhere the key space meets a row this module did not mint the real row is kept and the skip is
    reported (`collisions` on the return).

    `profile` names WHICH world to build; None = the one recorded as active (canon on a fresh box).
    It is bound to the task through `_ACTIVE_SPEC`, so every reader below — the catalogue, the
    contacts, the shelf, the storefront, the intake script AND the mark on every runtime payload —
    is this world's, and none of them needed a new argument to become so."""
    tenant = tenant or config.BRAIN_TENANT
    spec_now = await _resolve_profile(profile)
    token = _ACTIVE_SPEC.set(spec_now)
    try:
        return await _load_demo_seed_inner(tenant, through_brain=through_brain,
                                           minted_active=spec_now)
    finally:
        _ACTIVE_SPEC.reset(token)


async def _resolve_profile(profile: Optional[str]) -> Dict[str, Any]:
    """`profile` → its spec. An unknown id RAISES rather than falling back to canon: a switch that
    silently builds a different world than the one named is the failure this whole section is
    arranged to prevent."""
    if not profile:
        return await active_spec()
    reg = await registry()
    spec = reg.get(profile)
    if spec is None:
        raise ProfileRejected("no_profile", f"No existe ningún perfil «{profile}».")
    return spec


async def _load_demo_seed_inner(tenant: str, *, through_brain: bool,
                                minted_active: Dict[str, Any]) -> Dict[str, Any]:
    ledger = _ledger_open()
    cat = await load_catalogue(tenant=tenant, seeded=True)
    spec = _contacts_spec()
    contacts: List[Dict[str, Any]] = spec["contacts"]
    pool = db.get_pool()
    now = datetime.now(timezone.utc)
    today = now.date()
    counts: Dict[str, Any] = {"contacts": 0, "orders": 0, "messages": 0,
                              "catalogue_skipped_real": int(cat.get("skipped_real") or 0)}
    phones: List[str] = []
    real_profiles: set = set()      # contacts whose customer_profiles row is REAL — never recomputed
    minted_contacts: List[str] = []  # whatsapp_user_profiles rows THIS load created (teardown reads them)

    async with pool.acquire() as con:
        catmap = await _catalogue_map(con, tenant)
        saymap = _say_map()
        await _seed_business(con, tenant, spec, counts)
        await _seed_stock(con, tenant, catmap, counts)

        for c in contacts:
            phone, name = c["phone"], c["name"]
            phones.append(phone)
            # ── THE CONTACT ROW. `whatsapp_user_profiles` has no `seeded` column, so "is this
            # contact real?" is answered by TRAFFIC (`_has_live_history`) and by whether the label is
            # already somebody's: a name that is already there is never renamed by a demo load. The
            # ONLY write left is filling a BLANK — the same rule auth._backfill_profile follows, and
            # it destroys nothing. Peter's own two numbers therefore keep the names his real
            # conversations carry, and the seeded thread merges underneath them.
            existing_name = await con.fetchval(
                "select coalesce(display_name,'') from whatsapp_user_profiles where phone_number=$1",
                phone)
            if existing_name is None:                      # no row at all → ours to write
                await con.execute(
                    """insert into whatsapp_user_profiles (phone_number, display_name) values ($1,$2)
                       on conflict (phone_number) do nothing""", phone, name)
                # THE ROW WE MINTED, RECORDED BY NAME. `whatsapp_user_profiles` has no `seeded`
                # column, so before the switch existed the teardown simply left every contact behind
                # — harmless with one world, wrong with two: world A's «Bar Lumbre» would still be
                # sitting on that number while world B calls it something else. The seed already
                # knows which rows are its own (this branch IS that knowledge); it now writes them
                # onto the meta so the teardown can delete exactly those and nothing else. The same
                # shape of exemption `brain_orders` / `brain_messages` already use: AN INSPECTABLE
                # LIST OF ROWS, never a widened pattern.
                minted_contacts.append(phone)
            elif not str(existing_name).strip():           # a row with a BLANK label → fill it
                await con.execute(
                    "update whatsapp_user_profiles set display_name=$2 where phone_number=$1 "
                    "and coalesce(display_name,'')=''", phone, name)
            elif str(existing_name).strip() != name:
                why = await _has_live_history(con, phone) or "ya tenía nombre puesto"
                _collide("whatsapp_user_profiles", phone, existing_name,
                         f"el nombre real manda ({why}); el mundo de prueba no renombra a nadie")
                counts["contacts_skipped"] = counts.get("contacts_skipped", 0) + 1
            # A customer profile that is NOT ours is never recomputed from seeded history and never
            # marked seeded — that mark is what a reset deletes by, so marking a real one would be
            # arming a delete on a real customer.
            if await con.fetchval(
                    "select 1 from customer_profiles where tenant_id=$1 and phone_number=$2 "
                    "and not seeded", tenant, phone):
                real_profiles.add(phone)
                _collide("customer_profiles", phone, "la ficha de cliente real",
                         "no se recalcula con historial de prueba ni se marca como seeded")
                counts["profiles_skipped"] = counts.get("profiles_skipped", 0) + 1
            counts["contacts"] += 1
            await _silence_invented(phone, counts)
            await _seed_card(scope_of(phone),
                             f"FICHA — {name} · {c.get('address', '')} · "
                             f"{_cadence_label(float(c['cadence_days']))}")

            usual = c["usual"]
            cad_label = _cadence_label(float(c["cadence_days"]))
            demo = phone in DEMO_PHONES
            week_start = today - timedelta(days=today.weekday())   # Monday of the current week
            chit = c.get("chitchat") or []
            voices = c.get("voice_samples") or []
            photo = c.get("photo")
            quiet = int(c.get("quiet_days") or 0)

            # Order dates on cadence, oldest -> newest, always relative to today. The two demo
            # contacts have NO current-week order (Peter creates it live in the demo). An AT-RISK
            # customer simply stops: everything inside `quiet_days` is dropped, which is what
            # "silent for 26 days" IS — an absence, not a flag on a row.
            dates = sorted({_recent_dow(d, w, today) for w in range(c["weeks"]) for d in c["order_dow"]})
            dates = [d for d in dates if d < today]
            if demo:
                dates = [d for d in dates if d < week_start]
            if quiet:
                dates = [d for d in dates if (today - d).days > quiet]
            n = len(dates)
            photo_idx = max(0, n - 3)   # one photo order, a few cycles back

            for idx, d in enumerate(dates):
                day = _DAYS[d.weekday()]
                ts = datetime(d.year, d.month, d.day, 6, 10, tzinfo=timezone.utc)  # the real hour
                use_photo = bool(photo) and idx == photo_idx
                use_voice = bool(voices) and (idx % 5 == 3) and not use_photo
                # 'lo de siempre'/voice/photo => the FULL standing basket; explicit/short => a varied
                # basket whose TEXT lists exactly those lines.
                style = idx % 5
                if use_photo or use_voice or style == 1:
                    lines = [_seed_line(catmap, u["sku_id"], u["qty"], u["unit"]) for u in usual]
                else:
                    lines = _vary_basket(catmap, usual, idx)
                for ln in lines:
                    ln["mention"] = (saymap.get(ln["sku_id"], ln["name"]) or ln["name"]).lower()

                # a little life before some orders (interspersed, not clustered)
                if chit and idx % 2 == 0:
                    await _msg(con, f"seedmsg-{phone[-4:]}-pre{idx}", phone, "user",
                               chit[idx % len(chit)], "text", ts - timedelta(hours=3))
                    counts["messages"] += 1

                mid = f"seedmsg-{phone[-4:]}-o{idx}"
                vi = idx % len(voices) if voices else 0
                url = _seed_media_url(f"{phone[-4:]}-photo.jpg") if use_photo else None
                vurl = _seed_media_url(f"{phone[-4:]}-v{vi}.mp3") if use_voice else None
                if use_photo and url:                       # real generated phone-photo of the sheet
                    await _msg(con, mid, phone, "user", "", "image", ts, transcript=photo,
                               media_urls=[url],
                               meta={"src": url, "entities": _entities(photo, lines, saymap)})
                elif use_voice and vurl:                    # real generated voice note
                    vmeta = {"src": vurl, "entities": _entities(voices[vi], lines, saymap)}
                    dur = _audio_duration(f"{phone[-4:]}-v{vi}.mp3")
                    if dur:
                        vmeta["duration_sec"] = dur
                    vmeta["utterances"] = _utterances(voices[vi], dur)
                    vmeta["num_speakers"] = 1
                    await _msg(con, mid, phone, "user", "", "audio", ts, transcript=voices[vi],
                               media_urls=[vurl], meta=vmeta)
                elif use_voice:                             # no audio yet -> the spoken words as text
                    await _msg(con, mid, phone, "user", voices[vi], "text", ts,
                               meta={"entities": _entities(voices[vi], lines, saymap)})
                elif style == 1:
                    await _msg(con, mid, phone, "user", f"buenas, lo de siempre para el {day} 🙏",
                               "text", ts)
                else:                                       # explicit / short order list
                    text = _explicit_text(lines, saymap, day, short=(style == 2))
                    await _msg(con, mid, phone, "user", text, "text", ts,
                               meta={"entities": _entities(text, lines, saymap)})
                counts["messages"] += 1

                # the delivered (past) order, created alongside its message so they sit together
                await con.execute(
                    """insert into orders (id, phone_number, customer_name, status, lines, note, delivery_date,
                                           created_at, source_message_ids, seeded, recurring, recurring_label,
                                           from_storefront, dispatched_at)
                       values ($1,$2,$3,'sent',$4,'',$5,$6,$7,true,true,$8,false,$9)
                       on conflict (id) do nothing""",
                    f"seed-{phone[-4:]}-{idx}", phone, name, lines, d.isoformat(), ts, [mid],
                    cad_label, ts + timedelta(hours=3))
                counts["orders"] += 1

                # our acknowledgement a few minutes later — «recibido», never «listo» (§5.8a tone law)
                summary = ", ".join(
                    f"{_num(l['qty'])}{'' if l['unit'] in ('unit', 'units') else ' ' + l['unit']} "
                    f"{l['mention']}" for l in lines[:4])
                await _msg(con, f"seedmsg-{phone[-4:]}-ack{idx}", phone, "assistant",
                           f"recibido — {summary}. Sale para el {day} 👍", "text",
                           ts + timedelta(minutes=7))
                counts["messages"] += 1

                if chit and idx % 3 == 2:
                    await _msg(con, f"seedmsg-{phone[-4:]}-post{idx}", phone, "user",
                               chit[(idx + 2) % len(chit)], "text", ts + timedelta(hours=5))
                    counts["messages"] += 1

            # ── TODAY, IN EVERY REAL STATE ─────────────────────────────────────────────────────
            # The `orders` vocabulary is needs_review | approved | sent | failed (+ `dispatched_at`,
            # `recurring`, `order_events`). Peter's four words map onto it as:
            #   preparado          → approved
            #   confirmado         → approved + recurring (auto-approved, nothing to decide)
            #   en reparto         → sent + dispatched_at
            #   modificado         → approved + an `order_events` amendment trail
            # That is the honest mapping; there is no fifth column to invent.
            #
            # ⚠️ `c["weeks"] > 0` IS PART OF THE CONDITION, and it is the fix for a real hole. These
            # two orders — the standing one going out in two days, and the fresh one waiting to be
            # reviewed — were minted for EVERY contact regardless of history. A world minted from an
            # ingested catalogue with `history_weeks=0` therefore arrived with 2 invented orders per
            # customer (measured: 10) even though `create_profile_from_intake`'s own docstring
            # promised none, and even though Peter's ask is the opposite: *"unless I've asked you to
            # seed relevant 'other' orders, it wouldn't have any… my demo will involve live sending
            # voice notes to show the orders come in."* Orders on the screen he did not place and
            # cannot explain is the worst thing that can happen in that room.
            # It is also true on its own terms: a RECURRING order is a claim about a cadence, and a
            # customer with no history has demonstrated none. Every built-in world's contacts carry
            # `weeks >= 1`, so nothing that exists today changes shape.
            if not demo and not quiet and int(c.get("weeks") or 0) > 0:
                up = today + timedelta(days=2)
                lines = [_seed_line(catmap, u["sku_id"], u["qty"], u["unit"]) for u in usual]
                for ln in lines:
                    ln["mention"] = (saymap.get(ln["sku_id"], ln["name"]) or ln["name"]).lower()
                await con.execute(
                    """insert into orders (id, phone_number, customer_name, status, lines, delivery_date,
                                           created_at, seeded, recurring, recurring_label, from_storefront)
                       values ($1,$2,$3,'approved',$4,$5, now(), true, true, $6, false)
                       on conflict (id) do nothing""",
                    f"seed-{phone[-4:]}-up", phone, name, lines, up.isoformat(), cad_label)
                counts["orders"] += 1

                # a FRESH order awaiting review — the daily brief has real venues to read through
                fresh = _vary_basket(catmap, usual, c["weeks"] + 3)
                for ln in fresh:
                    ln["mention"] = (saymap.get(ln["sku_id"], ln["name"]) or ln["name"]).lower()
                fmid = f"seedmsg-{phone[-4:]}-fresh"
                fday = _DAYS[up.weekday()]
                ftext = _explicit_text(fresh, saymap, fday)
                fts = now - timedelta(hours=2 + (len(phone) % 5))
                await _msg(con, fmid, phone, "user", ftext, "text", fts,
                           meta={"entities": _entities(ftext, fresh, saymap)})
                await con.execute(
                    """insert into orders (id, phone_number, customer_name, status, lines, note,
                                           delivery_date, created_at, source_message_ids, seeded,
                                           from_storefront)
                       values ($1,$2,$3,'needs_review',$4,'',$5,$6,$7,true,false)
                       on conflict (id) do nothing""",
                    f"seed-{phone[-4:]}-fresh", phone, name, fresh, up.isoformat(), fts, [fmid])
                counts["orders"] += 1
                counts["messages"] += 1

        await _seed_today_states(con, contacts, catmap, saymap, now, today, counts)

        # ── E-commerce (storefront) orders on separate accounts, so the day has BOTH channels ──
        await _seed_storefront_orders(con, catmap, saymap, now, today, counts)

    # Compute profiles, then mark them seeded so a reload wipes them, and write the delivery point.
    # `real_profiles` are the contacts whose profile row already belonged to somebody: skipped end to
    # end — not recomputed (that would rewrite a real basket from seeded history), not marked, not
    # geo-stamped. The `and seeded` on the geo update is the second fence on the same rule.
    seedable = [p for p in phones if p not in real_profiles]
    for phone in seedable:
        # Every real stat (basket, cadence, top products) is computed and written synchronously here.
        # The NARRATIVE — the customer-DNA prose — is the one part that needs a model call, so it is
        # skipped inline (a switch must not block on 6-9 sequential API calls) and backfilled in the
        # background immediately below. Skipping it WITHOUT the backfill is what left the DNA panel
        # blank on 2026-07-28; the two halves belong together.
        await profile.save_profile(phone, tenant, skip_narrative=not through_brain)
    if seedable and not through_brain:
        # Fire-and-forget: the switch returns now, the prose lands seconds later. Never awaited — that
        # would put the model calls straight back on the critical path this skip exists to clear.
        try:
            import asyncio as _asyncio
            _asyncio.create_task(profile.backfill_narratives(list(seedable), tenant))
        except RuntimeError:
            log.debug("seed: no running loop for the narrative backfill (CLI run) — skipped")
    async with pool.acquire() as con:
        await con.execute(
            "update customer_profiles set seeded=true where tenant_id=$1 and phone_number = any($2::text[])",
            tenant, seedable)
        for c in contacts:
            if c["phone"] in real_profiles:
                continue
            try:
                # AND tenant: this is the write the fence audit's refutation turned on. Keyed on
                # phone alone, a second tenant's seed load wrote its coordinates onto the profile
                # row LABELLED with the first tenant — and `/api/sup/orders` then returned them as
                # that tenant's own customer_lat/customer_lon (A1 §7.2).
                await con.execute(
                    "update customer_profiles set address=$2, lat=$3, lon=$4, erp_client_code=$5 "
                    "where phone_number=$1 and tenant_id=$6 and seeded",
                    c["phone"], c.get("address", ""), c.get("lat"), c.get("lon"),
                    c.get("erp_code") or None, tenant)
            except Exception:
                log.debug("seed: profile geo skipped for %s", c["phone"], exc_info=True)

        # the review sheet + the §5.7 loop LAST: both read state the steps above just created
        counts["review_sheet"] = await _seed_review_sheet(con, tenant, contacts, counts)
        counts["doubt_loop"] = await _seed_doubt_loop(con, tenant, contacts, catmap, now, counts)

    # ── E-commerce demo structure (recommendations + accept-rules + a draft basket) ─────────────
    try:
        await _seed_ecommerce(now)
    except Exception:
        log.debug("seed: e-commerce structure skipped (shop tables absent)", exc_info=True)

    brain_orders: List[str] = []
    brain_messages: List[str] = []
    if through_brain:
        counts["brain_intake"] = await run_brain_intake(tenant)
        # every id the brain minted, including the ones no result carried back (see `_caused_orders`)
        brain_orders = sorted({oid for r in counts["brain_intake"]
                               for oid in ([r["order_id"]] if r.get("order_id") else [])
                               + list(r.get("caused_orders") or [])})
        brain_messages = sorted({mid for r in counts["brain_intake"]
                                 for mid in ((r.get("marked") or {}).get("message_ids") or [])})

    # ── THE LAST SWEEP: did anything in the seed's OWN id space turn out to be a real row? ────────
    # Every order/message the seed pre-files uses a deterministic `seed-`/`seedmsg-` id and is written
    # `on conflict (id) do nothing`, so a live row of the same id is structurally safe. This sweep
    # makes it VISIBLE: an id in our namespace carrying `seeded=false` is somebody else's row, the
    # seed's counterpart was silently not written, and the reset will (correctly) never remove it.
    try:
        like = [p + "%" for p in SEED_ID_PREFIXES]
        async with pool.acquire() as con:
            for table in ("orders", "whatsapp_messages"):
                rows = await con.fetch(
                    f"select id from {table} where not seeded and id like any($1::text[]) limit 20", like)
                for r in rows:
                    _collide(table, r["id"], "la fila real que ya ocupaba ese id",
                             "el seed no escribió su copia y el reset nunca la tocará")
    except Exception:
        log.debug("seed: id-space sweep skipped", exc_info=True)

    counts["collisions"] = list(ledger)
    counts["skipped_real"] = len(ledger)
    await _set_seed_meta(loaded_at=now.isoformat(), brain_orders=brain_orders,
                         brain_messages=brain_messages, collisions=list(ledger),
                         active_profile=str(minted_active.get("id") or CANON_PROFILE),
                         minted_contacts=minted_contacts)
    counts["loaded_at"] = now.isoformat()
    counts["tenant"] = tenant
    counts["profile"] = str(minted_active.get("id") or CANON_PROFILE)
    counts["profile_name"] = str(minted_active.get("name") or "")
    counts["seed_world"] = world_mark(str(minted_active.get("id") or CANON_PROFILE))
    return counts


async def _seed_today_states(con, contacts, catmap, saymap, now, today, counts) -> None:
    """TODAY's order book in the remaining real states: one out for delivery (sent + dispatched_at)
    and one AMENDED (an `order_events` trail the app renders as «modificado»). Deterministic ids →
    idempotent; both seeded=true."""
    peral = next((c for c in contacts if c["name"] == "Mesón Peral"), None)
    cascajo = next((c for c in contacts if c["name"] == "Freiduría Cascajo"), None)
    big = next((c for c in contacts if c.get("role") == "high_volume"), None)

    # ── «PEDIDO MUY GRANDE» — the state behind §5.8a's order-level review reason ────────────────
    # Not a flag written onto a row: an order that IS four times this customer's own median basket,
    # sitting needs_review with its own inbound message, so `brain/validators.validate_order`
    # computes the ratio from the seeded history and writes the sentence itself.
    if big:
        lines = [_seed_line(catmap, u["sku_id"], (u["qty"] or 1) * 4, u["unit"])
                 for u in big["usual"]]
        for ln in lines:
            ln["mention"] = (saymap.get(ln["sku_id"], ln["name"]) or ln["name"]).lower()
        gmid = "seedmsg-today-grande"
        gtext = ("buenas, para el sábado necesito el cuádruple de lo normal, que tengo dos "
                 "comuniones y una boda: " + ", ".join(
                     _qfmt(ln["qty"], ln["unit"], ln["mention"]) for ln in lines))
        await _msg(con, gmid, big["phone"], "user", gtext, "text", now - timedelta(hours=1),
                   meta={"entities": _entities(gtext, lines, saymap)})
        counts["messages"] += 1
        await con.execute(
            """insert into orders (id, phone_number, customer_name, status, lines, note,
                                   delivery_date, created_at, source_message_ids, seeded,
                                   from_storefront)
               values ($1,$2,$3,'needs_review',$4,'',$5,$6,$7,true,false)
               on conflict (id) do nothing""",
            "seed-today-grande", big["phone"], big["name"], lines,
            (today + timedelta(days=2)).isoformat(), now - timedelta(hours=1), [gmid])
        counts["orders"] += 1

    if peral:
        lines = [_seed_line(catmap, u["sku_id"], u["qty"], u["unit"]) for u in peral["usual"]]
        for ln in lines:
            ln["mention"] = (saymap.get(ln["sku_id"], ln["name"]) or ln["name"]).lower()
        await con.execute(
            """insert into orders (id, phone_number, customer_name, status, lines, delivery_date,
                                   created_at, dispatched_at, delivery_note, seeded, from_storefront)
               values ($1,$2,$3,'sent',$4,$5,$6,$7,$8,true,false) on conflict (id) do nothing""",
            "seed-today-reparto", peral["phone"], peral["name"], lines, today.isoformat(),
            now - timedelta(hours=4), now - timedelta(hours=1),
            "Ruta 2 · reparto sur — salida 08:15")
        counts["orders"] += 1

    if cascajo:
        base = [_seed_line(catmap, u["sku_id"], u["qty"], u["unit"]) for u in cascajo["usual"]]
        for ln in base:
            ln["mention"] = (saymap.get(ln["sku_id"], ln["name"]) or ln["name"]).lower()
        amended = [dict(ln) for ln in base]
        if amended:
            amended[0]["qty"] = (amended[0]["qty"] or 0) + 4     # «súbeme la panceta a 14»
        oid = "seed-today-modificado"
        await con.execute(
            """insert into orders (id, phone_number, customer_name, status, lines, note,
                                   delivery_date, created_at, seeded, from_storefront)
               values ($1,$2,$3,'approved',$4,$5,$6,$7,true,false) on conflict (id) do nothing""",
            oid, cascajo["phone"], cascajo["name"], amended,
            "Modificado por el cliente a las 06:41 — panceta +4 kg",
            (today + timedelta(days=1)).isoformat(), now - timedelta(hours=3))
        counts["orders"] += 1
        # the amendment TRAIL — the event-sourced side is what makes «modificado» TRUE, not a label
        for seq, (etype, payload) in enumerate([
                ("created", {"lines": base}),
                ("qty_changed", {"line": 0, "from": base[0]["qty"] if base else 0,
                                 "to": amended[0]["qty"] if amended else 0,
                                 "reason": "el cliente subió la panceta"}),
                ("line_set", {"lines": amended})], start=1):
            try:
                await con.execute(
                    """insert into order_events (tenant_id, order_id, seq, event_type, payload,
                                                 actor, seeded)
                       values ($1,$2,$3,$4,$5,'customer',true)""",
                    config.BRAIN_TENANT, oid, seq, etype, payload)
            except Exception:
                log.debug("seed: order_events trail skipped", exc_info=True)


async def _seed_ecommerce(now) -> None:
    """Seed the e-commerce employee's demo structure (recommendations + allow-list + a draft basket).
    Business names come from the SAME invented set as everything else (LOCKED LAW)."""
    import uuid

    from brain import baskets as _baskets
    tenant = config.BRAIN_TENANT
    pool = db.get_pool()
    recs = [
        ("ecom", "ecom.standardize_customizations", "customization", "cust:seed:vacio",
         {"sku": "sku-jamon-serrano-pieza", "option_key": "envase",
          "option_value": "Vacío 250 g", "support": 6}),
        ("ecom", "ecom.asap_patterns", "asap", "asap:seed:costilla",
         {"kind": "asap", "pattern": {"sku_scope": "sku-costilla-adobada", "qty_max": 12,
          "timing_window": {"before": "07:30", "horizon": "same_day"}, "customization_free": True},
          "support": "5 aceptados"}),
        ("deliveries", "delivery.consolidation", "consolidation", "consol:seed:bermejo",
         {"customer_phone": "+34611111003", "customer_name": "Casa Bermejo",
          "draft_message": "Hola, ¿y si juntamos los dos pedidos de la semana en uno? "
                           "Te lo dejamos listo el martes y nos ahorramos la carrera del jueves.",
          "route_delta": {"vans_freed": 1, "km_saved": 38}}),
    ]
    async with pool.acquire() as con:
        for agent_id, task_key, kind, dedupe, payload in recs:
            await con.execute(
                """insert into agent_recommendations
                     (id, tenant_id, agent_id, task_key, kind, dedupe_key, payload, status, seeded)
                   values ($1,$2,$3,$4,$5,$6,$7,'open',true)
                   on conflict (tenant_id, task_key, dedupe_key) do nothing""",
                "rec_seed_" + uuid.uuid5(uuid.NAMESPACE_DNS, dedupe).hex[:12],
                tenant, agent_id, task_key, kind, dedupe, payload)
        rules = [
            ("asap", {"sku_scope": "sku-costilla-adobada", "qty_max": 12,
                      "timing_window": {"before": "07:30", "horizon": "same_day"}}),
            ("qty",  {"sku_scope": "sku-jamon-serrano-pieza", "qty_max": 6}),
        ]
        for rkind, pattern in rules:
            await con.execute(
                """insert into accept_rules
                     (id, tenant_id, kind, scope, pattern, enabled, created_from, seeded)
                   values ($1,$2,$3,'tenant',$4,true,'seed',true)
                   on conflict (id) do nothing""",
                "acr_seed_" + uuid.uuid5(uuid.NAMESPACE_DNS, rkind + str(pattern)).hex[:12],
                tenant, rkind, pattern)
    await _baskets.seed_demo(tenant)


async def get_seed_enabled() -> bool:
    """Master demo-seed toggle (Founder Settings). Default ON for the demo; a real launch turns it
    OFF (and it stays off — the seed is then just absent)."""
    s = await db.settings_get("demo_seed") or {}
    return bool(s.get("enabled", config.SEED_ENABLED))


async def set_seed_enabled(on: bool) -> Dict[str, Any]:
    await db.settings_set("demo_seed", {"enabled": bool(on)})
    if on:
        return {"enabled": True, "result": await refresh_seed()}
    return {"enabled": False, "result": {"cleared": await clear_all_seeded()}}


async def _set_seed_meta(loaded_at: str, brain_orders: Optional[List[str]] = None,
                         collisions: Optional[List[Dict[str, str]]] = None,
                         brain_messages: Optional[List[str]] = None,
                         active_profile: str = CANON_PROFILE,
                         minted_contacts: Optional[List[str]] = None) -> None:
    """`brain_orders` is the list of orders the REAL pipeline filed during this seed. They carry
    `uuid4().hex` ids (events.create_order mints them) so they cannot wear a seed id-prefix — the
    audit reads this list instead, which keeps the exemption an inspectable set of rows rather than
    a looser pattern that would let anything through.

    `collisions` is the ledger of rows the load DECLINED to touch because they were not seeded. It is
    stored (capped) so `/api/app/seed` can answer «what on my live box did the seed leave alone» long
    after the load returned."""
    await db.settings_set(SEED_META_AGENT,
                          {"loaded_at": loaded_at, "seed_world": world_mark(active_profile),
                           "tenant": DEMO_TENANT,
                           # WHICH WORLD IS LOADED. One place, and it is the row the one route that
                           # answers this question already reads.
                           "active_profile": active_profile,
                           # the `whatsapp_user_profiles` rows this load minted — the teardown's
                           # inspectable list, see the note at the mint site.
                           "minted_contacts": list(minted_contacts or [])[:200],
                           "brain_orders": list(brain_orders or []),
                           "brain_messages": list(brain_messages or []),
                           "collisions": list(collisions or [])[:60]})


async def _get_seed_meta() -> Dict[str, Any]:
    return await db.settings_get(SEED_META_AGENT) or {}


# ── WHAT THE BUTTON HAS TO BE ABLE TO SAY BEFORE IT IS PRESSED ───────────────────────────────────
# A reset is not an undo, so the control that fires it may not say «reiniciar» and nothing else: the
# person pressing it is entitled to read, first, exactly how many rows go and exactly how many rows
# STAY. That is two numbers per table, not one — `orders` and `live_orders` are the same table read
# from its two sides — and it is the sentence the desk renders verbatim.
#
# These two functions exist so the surfaces do not each grow their own copy of the probes. app.py's
# founder route (`/api/app/seed`) still owns its own private `_seed_counts`; it is byte-equivalent to
# this one and should be collapsed onto it when that file is next opened (noted, not done here — this
# pass does not own app.py).
_WORLD_PROBES = (
    ("catalogue", "select count(*) from catalogue_skus where tenant_id=$1 and seeded", True),
    ("customers", "select count(*) from customer_profiles where tenant_id=$1 and seeded", True),
    ("orders", "select count(*) from orders where seeded", False),
    ("messages", "select count(*) from whatsapp_messages where seeded", False),
    ("calls", "select count(*) from calls where seeded", False),
    # THE OTHER SIDE OF THE SAME TABLES — the rows a reset must never reach. Never summed into the
    # seeded numbers; shown beside them, because «what is real on this box» is the question a founder
    # asks before he shows anybody the screen.
    ("live_orders", "select count(*) from orders where not seeded", False),
    ("live_messages", "select count(*) from whatsapp_messages where not seeded", False),
    ("live_customers",
     "select count(*) from customer_profiles where tenant_id=$1 and not seeded", True),
)


async def world_counts(tenant: Optional[str] = None) -> Dict[str, int]:
    """Read-only counts of the seeded world and of the live rows sharing its tables.

    Every probe is INDEPENDENTLY fail-soft: a table that does not exist on this box reports 0 rather
    than 500-ing the screen the founder is standing in front of."""
    tenant = tenant or DEMO_TENANT
    counts: Dict[str, int] = {}
    pool = db.get_pool()
    for name, sql, needs_tenant in _WORLD_PROBES:
        try:
            async with pool.acquire() as con:
                counts[name] = int(await con.fetchval(*( (sql, tenant) if needs_tenant else (sql,) )) or 0)
        except Exception:
            log.debug("seed: world probe %s skipped", name, exc_info=True)
            counts[name] = 0
    try:
        import runtime as _rt
        counts["review"] = len(await _rt.review_list())
    except Exception:
        log.debug("seed: world probe review skipped", exc_info=True)
        counts["review"] = 0
    return counts


async def world_state(tenant: Optional[str] = None) -> Dict[str, Any]:
    """«Is the test world here, when was it loaded, what is in it, and what did it decline to touch?»

    The one read behind every «reiniciar» control. `seeded` means THE TEST WORLD IS PRESENT — never
    "this database has rows in it", which is why the live_* probes are excluded from the sum.

    `resettable` is the honest answer to «will the button work», computed the same way
    `reset_demo_seed` decides: this tenant must BE the demo tenant. A surface that shows an armed
    button which the server would refuse is a surface that lies."""
    tenant = tenant or DEMO_TENANT
    enabled, loaded_at, collisions = False, None, []
    try:
        enabled = bool(await get_seed_enabled())
    except Exception:
        log.exception("seed: enabled read failed")
    try:
        meta = await _get_seed_meta()
        loaded_at = meta.get("loaded_at")
        collisions = list(meta.get("collisions") or [])
    except Exception:
        log.exception("seed: meta read failed")
    counts = await world_counts(tenant)
    seeded_rows = sum(v for k, v in counts.items() if not k.startswith("live_"))
    # WHICH world, by name — additive to the shape the phone and the desk already read, so both keep
    # working unchanged and both can start saying which world is on screen.
    active, profiles, active_name = CANON_PROFILE, [], ""
    try:
        reg = await registry()
        active = await active_profile_id()
        if active not in reg:
            active = CANON_PROFILE
        profiles = sorted(reg)
        active_name = (reg.get(active) or {}).get("name") or active
    except Exception:
        log.exception("seed: registry read failed")
    return {
        "seeded": bool(enabled or loaded_at or seeded_rows),
        "enabled": enabled,
        "loaded_at": loaded_at,
        "tenant": tenant,
        "demo_tenant": DEMO_TENANT,
        "resettable": tenant == DEMO_TENANT,
        "seed_world": world_mark(active),
        "active_profile": active,
        "active_profile_name": active_name,
        "profile_count": len(profiles),
        "counts": counts,
        "collisions": collisions,
    }


async def _purge_medusa_seeded() -> Dict[str, int]:
    """Delete every Medusa entity tagged metadata.seeded=true (medusa-integration.md §7). Best-effort:
    Medusa may be down or sync disabled → returns {} rather than blocking the local reset."""
    try:
        from brain import medusa_client
        if not medusa_client.enabled():
            return {}
        return await medusa_client.get_client().purge_seeded()
    except Exception:
        return {}


class ForeignSeedRows(RuntimeError):
    """`_audit_foreign` found rows wearing a seed mark this seeder could not have minted, so the
    reset STOPPED BEFORE DELETING ANYTHING.

    It carries the `{table: n}` verdict as an attribute instead of only inside its message, because
    a surface has to be able to say it in the reader's own language. Parsing this exception's text
    to get the table names back would put an English sentence on an es-ES screen (LANGUAGE LAW), and
    a regex over an error message is not a contract.

    It subclasses RuntimeError on purpose: `app.py`'s founder route and `vital_seedworld`'s S5 both
    catch RuntimeError and read `str(e)`, and both keep working unchanged."""

    def __init__(self, foreign: Dict[str, Any], message: str):
        super().__init__(message)
        self.foreign: Dict[str, Any] = dict(foreign or {})


# ═════════════════════════════ THE RESET — safe by construction ══════════════════════════════════
# «reset seeded state» has to be a button a founder can press in front of a customer, so the one
# unforgivable failure is deleting something real. The defence is structural, not careful:
#   · every predicate below names a MARK this module writes, and nothing else;
#   · there is no `delete from orders`/`messages` without `seeded`;
#   · the tenant is checked first and a non-demo tenant RAISES;
#   · `_audit_foreign` looks for rows wearing a mark the seeder could not have minted and REFUSES.

async def _clear_runtime_marks(scopes: Optional[List[str]] = None, *,
                               cards: bool = True,
                               marks: Optional[List[str]] = None) -> Dict[str, int]:
    """Delete the RUNTIME rows (timer → open_loop → action → event) carrying a mark THIS SEEDER MINTS.

    Runs ONCE PER DEMO SCOPE inside `db.scoped_tx`, which makes the fence structural rather than
    careful: under FORCE RLS a scoped connection cannot see a row outside its own subtree, so even a
    predicate bug could not reach another customer's conversation. Deletion order matters — `timer`
    references `open_loop`, and `action`/`open_loop` reference `event`.

    `marks` widened from ONE string to a LIST when worlds got names (§5.10.3). It is still a closed,
    inspectable set — `known_marks()`, enumerated from the registry — and it is NEVER
    `payload ? 'seed_world'`: a switch must tear down the world it is replacing, and only that. A
    mark outside the set stays FOREIGN and stops the whole reset (`_audit_foreign`)."""
    out: Dict[str, int] = {"timer": 0, "open_loop": 0, "action": 0, "event": 0, "card": 0}
    marks = list(marks) if marks is not None else await known_marks()
    for scope in (scopes if scopes is not None else await all_demo_scopes()):
        try:
            async with db.scoped_tx(scope) as con:
                for table, where in (("timer", "payload->>'seed_world' = any($1::text[])"),
                                     ("open_loop", "resume_ref->>'seed_world' = any($1::text[])"),
                                     ("action", "payload->>'seed_world' = any($1::text[])"),
                                     ("event", "payload->>'seed_world' = any($1::text[])")):
                    n = await con.fetchval(
                        f"with d as (delete from {table} where {where} returning 1) "
                        "select count(*) from d", marks)
                    out[table] += int(n or 0)
                if cards:
                    # `cards=False` is what the mid-seed idempotency sweep passes: the party cards
                    # were written EARLIER in the same `load_demo_seed`, and clearing them there
                    # would delete the very rows the review sheet is about to join on for `party`.
                    n = await con.fetchval(
                        "with d as (delete from card where lineage='seed' returning 1) "
                        "select count(*) from d")
                    out["card"] += int(n or 0)
        except Exception:
            log.debug("seed: runtime teardown skipped for %s", scope, exc_info=True)
    return out


async def _audit_foreign(con, tenant: str, scopes: Optional[List[str]] = None) -> Dict[str, Any]:
    """Is anything wearing a seed mark that this seeder did not mint?

    Two questions, both answerable in SQL:
      · a `seeded=true` row whose id is outside `SEED_ID_PREFIXES` — something else marked it;
      · a runtime row carrying a `seed_world` that is not ANY REGISTERED WORLD'S — leftovers of
        something this seeder cannot build.
    Either one means the teardown is about to act on rows it does not understand, and the honest
    answer is to stop and name them. Fail-soft on the READ (a table that does not exist is not a
    foreign row), never on the verdict.

    THE DISTINCTION THE SWITCH ADDED, and it is the whole reason profiles do not weaken this: a mark
    INSIDE `known_marks()` is STALE — a world we know how to build, standing where the next one goes,
    torn down by name. A mark OUTSIDE it is FOREIGN and still refuses outright. Before profiles the
    two were the same question because there was only one mark; they are different questions now, and
    conflating them would have turned every switch into a refusal (or, worse, every unknown mark into
    something the teardown felt entitled to delete).

    `con` is the owner pool and covers the non-RLS tables; the scope-keyed ones are audited through
    each demo scope's own connection, because that is the only connection allowed to see them."""
    # SEED_ID_PREFIXES is a module constant, never user input — this interpolation is a literal.
    like = " and ".join(f"id not like '{p}%'" for p in SEED_ID_PREFIXES)
    _meta = await _get_seed_meta()
    brain_orders = list(_meta.get("brain_orders") or [])
    # The messages the brain's own mouth wrote inside a seeded burst (`_mark_burst_runtime`): wamid
    # ids, marked seeded on purpose, recorded row by row — the same shape of exemption as the orders.
    brain_messages = list(_meta.get("brain_messages") or [])
    foreign: Dict[str, Any] = {}

    async def _count(c, label: str, sql: str, *args) -> None:
        try:
            n = int(await c.fetchval(sql, *args) or 0)
            if n:
                foreign[label] = foreign.get(label, 0) + n
        except Exception:
            log.debug("seed: audit of %s skipped", label, exc_info=True)

    await _count(con, "orders",
                 f"select count(*) from orders where seeded and {like} "
                 "and not (id = any($1::text[]))", brain_orders)
    await _count(con, "whatsapp_messages",
                 f"select count(*) from whatsapp_messages where seeded and {like} "
                 "and not (id = any($1::text[]))", brain_messages)
    await _count(con, "catalogue_skus",
                 "select count(*) from catalogue_skus where tenant_id=$1 and seeded "
                 "and id not like 'sku-%'", tenant)
    marks = await known_marks()
    for scope in (scopes if scopes is not None else await all_demo_scopes()):
        try:
            async with db.scoped_tx(scope) as sc:
                await _count(sc, "action_other_world",
                             "select count(*) from action where payload ? 'seed_world' "
                             "and not (payload->>'seed_world' = any($1::text[]))", marks)
                await _count(sc, "event_other_world",
                             "select count(*) from event where payload ? 'seed_world' "
                             "and not (payload->>'seed_world' = any($1::text[]))", marks)
        except Exception:
            log.debug("seed: scoped audit skipped for %s", scope, exc_info=True)
    return foreign


async def clear_all_seeded(tenant: Optional[str] = None) -> Dict[str, Any]:
    """Delete every seeded row (catalogue, aliases, contacts' messages/orders/profiles, the review
    sheet, the tabs) in Rocoto AND the seeded entities in Medusa. LIVE ROWS SURVIVE — every
    predicate names a mark, and there is no unqualified delete anywhere in here."""
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    removed: Dict[str, Any] = {}
    removed.update(await _clear_runtime_marks())
    async with pool.acquire() as con:
        await con.execute(
            "delete from order_events where order_id in (select id from orders where seeded)")
        removed["orders"] = int(await con.fetchval(
            "with d as (delete from orders where seeded returning 1) select count(*) from d") or 0)
        removed["messages"] = int(await con.fetchval(
            "with d as (delete from whatsapp_messages where seeded returning 1) "
            "select count(*) from d") or 0)
        await con.execute("delete from calls where seeded")
        await con.execute("delete from customer_profiles where tenant_id=$1 and seeded", tenant)
        # deleting the seeded SKUs CASCADES sku_aliases and stock_levels (both FK on
        # catalogue_skus(id) on delete cascade), which is exactly right: an alias or a shelf count
        # that hangs off a demo SKU is a demo artefact, and one hanging off a REAL SKU is untouched.
        removed["catalogue_skus"] = int(await con.fetchval(
            "with d as (delete from catalogue_skus where tenant_id=$1 and seeded returning 1) "
            "select count(*) from d", tenant) or 0)
        await con.execute("delete from sku_aliases where tenant_id=$1 and source='seed'", tenant)
        # THE SEEDED DELIVERY RULE. `where seeded` is the whole of the safety here: a real radius
        # (`seeded=false`, or a row that predates the column) is structurally out of reach, so
        # `preserved`'s promise about a real depot survives — it just got precise enough to let the
        # NEXT world write its own depot instead of silently inheriting this one's.
        try:
            removed["tenant_range"] = int(await con.fetchval(
                "with d as (delete from tenant_range where tenant_id=$1 and coalesce(seeded,false) "
                "returning 1) select count(*) from d", tenant) or 0)
        except Exception:
            log.debug("seed: tenant_range teardown skipped (no `seeded` column yet)", exc_info=True)
        # THE CONTACT ROWS THIS SEEDER MINTED, by the list it wrote at mint time — never by a
        # pattern over the phone number. Two extra fences, both of which have to hold or a real
        # person loses their name: the row must still say what the seed named it (somebody who
        # renamed it owns it now), and the number must carry no live traffic (`_has_live_history` —
        # which is exactly what keeps Peter's own two numbers, and anyone who ever wrote in, safe).
        try:
            meta = await _get_seed_meta()
            names = {c["phone"]: c.get("name") or "" for s in (await registry()).values()
                     for c in (s.get("contacts") or []) if c.get("phone")}
            gone = 0
            for ph in list(meta.get("minted_contacts") or []):
                if ph in DEMO_PHONES or await _has_live_history(con, ph):
                    continue
                n = await con.fetchval(
                    "with d as (delete from whatsapp_user_profiles where phone_number=$1 "
                    "and coalesce(display_name,'') = $2 returning 1) select count(*) from d",
                    ph, names.get(ph, ""))
                gone += int(n or 0)
            if gone:
                removed["contacts"] = gone
        except Exception:
            log.debug("seed: minted-contact teardown skipped", exc_info=True)
        # THE TENANT ROW THE WORLD IS BOUND TO IS NEVER DELETED. Since the seed writes the business
        # identity onto the FOUNDER'S tenant (`_seed_business`), that row is what `auth.app_gate`
        # reads to answer the app's very first call — deleting it mid-reset would blank the founder's
        # own tenant for as long as the rebuild takes, and a crash in between would leave him with no
        # tenant at all. Its CONTENT is replaced by the reload (upsert, `where tenants.seeded`), which
        # is the whole of what a reset owes. What IS removed is a LEGACY seeded row under the old
        # contacts.json slug — the orphan the previous binding used to mint.
        try:
            legacy = str((_contacts_spec().get("business") or {}).get("slug") or "")
            if legacy and legacy != tenant:
                removed["tenants"] = int(await con.fetchval(
                    "with d as (delete from tenants where slug=$1 and seeded returning 1) "
                    "select count(*) from d", legacy) or 0)
        except Exception:
            log.debug("seed: tenants teardown skipped", exc_info=True)
        # the Medusa outbox + scheduled-task/recommendation/rule tables: drop seeded rows
        for t in ("medusa_sync", "agent_recommendations", "accept_rules", "agent_tasks",
                  "basket_sessions"):
            try:
                await con.execute(f"delete from {t} where tenant_id=$1 and seeded", tenant)
            except Exception:
                pass  # tables may not exist on a brain-only box
        # THE CAPTURE LOG. `stock_levels` already goes when its SKU does (the FK cascade off
        # `catalogue_skus`, above) — but `stock_captures` is a plain JSONB history row with no FK to
        # anything and no `seeded` column, so it survived every reset until now: Peter could
        # photograph a pallet ten times testing the app and the reset would clear the SEEDED catalogue
        # underneath those captures while the captures themselves piled up forever. Wiped WHOLESALE
        # for this tenant, same reasoning as `medusa_sync` above — a capture is demo/test traffic on
        # the demo tenant, never a real distributor's audit trail (this function already refuses
        # anything but `DEMO_TENANT`, checked by its caller before it is ever reached).
        try:
            removed["stock_captures"] = int(await con.fetchval(
                "with d as (delete from stock_captures where tenant_id=$1 returning 1) "
                "select count(*) from d", tenant) or 0)
        except Exception:
            log.debug("seed: stock_captures teardown skipped (table may not exist)", exc_info=True)
    removed["medusa"] = await _purge_medusa_seeded()
    return removed


async def reset_demo_seed(tenant: Optional[str] = None, *, strict: bool = True,
                          through_brain: bool = False,
                          profile: Optional[str] = None) -> Dict[str, Any]:
    """«Reiniciar el estado de demostración» — tear the seeded world down and build it back.

    ⚠️ `through_brain=False` by default (Peter, 2026-07-28: "resetting seeded state doesn't work,
    it's resetting for over a minute no resolution") — same fix, same reasoning as
    `activate_profile`'s own default: this is a data rebuild, not a live-LLM demo, and the button the
    founder actually presses (`POST /api/app/seed/reset`) calls this directly, not through
    `activate_profile`, so that earlier fix never reached it. See `activate_profile`'s docstring for
    the full story ("why do we need the key for the switching lol").

    THE CONTRACT, and it is the whole point of the function:
      · IT ONLY EVER DELETES ROWS IT MARKED. Every predicate in `clear_all_seeded` /
        `_clear_runtime_marks` names one of the marks in the module docstring. A real customer's
        order carries none of them and cannot be reached: there is no unqualified delete in the path.
      · IT REFUSES A TENANT THAT IS NOT THE DEMO TENANT (`DEMO_TENANT`) — raises, never "helpfully"
        falls back, because the fallback is the failure.
      · IT REFUSES OUTRIGHT when `_audit_foreign` finds a row wearing a seed mark this seeder could
        not have minted (an id outside SEED_ID_PREFIXES, or another world's `seed_world`). Pass
        `strict=False` to proceed anyway — it is then a decision somebody took, in writing.
      · IT IS IDEMPOTENT. Pressing it twice leaves ONE world: every id is deterministic and every
        write is an upsert or an `on conflict do nothing`, and the runtime rows are cleared by mark
        before they are re-minted.
      · IT REBUILDS ONTO THE LIVE SCHEMA WITHOUT TOUCHING WHAT IS NOT ITS OWN. The rebuild half obeys
        the collision law (module docstring): a contact, profile, card, catalogue row or delivery rule
        that is not seeded is kept and reported in `collisions`, never overwritten.

      · `profile` NAMES THE WORLD IT BUILDS BACK, and defaults to the ACTIVE one — so today's button
        keeps meaning «put THIS world back». Passing a different id is the SWITCH (§5.10.3): the
        current world is torn down by its own mark and the named one is built in its place. Nothing
        is archived, on purpose — a world is a pure function of its spec, so the only thing archiving
        would preserve is the demo traffic generated while demoing, which is exactly what he wants
        gone. Live rows are untouched either way; that is the collision law, not a special case here.

    Returns {tenant, from_profile, to_profile, removed:{table:n}, created:{…}, foreign:{…},
    collisions:[…], preserved:[…]} — a per-table count of what went, what came back, and what it
    deliberately did not touch."""
    tenant = tenant or DEMO_TENANT
    if tenant != DEMO_TENANT:
        raise ValueError(
            f"reset_demo_seed refuses tenant {tenant!r}: the demo tenant is {DEMO_TENANT!r}. "
            "This is the guard that stops a demo reset from ever running against a real world.")
    was = await active_profile_id()
    target = await _resolve_profile(profile)                  # raises on an unknown id
    pool = db.get_pool()
    async with pool.acquire() as con:
        foreign = await _audit_foreign(con, tenant)
    if foreign and strict:
        raise ForeignSeedRows(
            foreign,
            "reset_demo_seed refuses to run: the world contains rows wearing a seed mark this "
            f"seeder did not create — {foreign}. Look at them before clearing anything "
            "(reset_demo_seed(strict=False) proceeds, and that is a decision, not a default).")
    removed = await clear_all_seeded(tenant)
    created = await load_demo_seed(tenant, through_brain=through_brain, profile=target["id"])
    return {
        "tenant": tenant, "seed_world": world_mark(target["id"]),
        "from_profile": was, "to_profile": target["id"],
        "to_profile_name": target.get("name") or target["id"],
        "switched": was != target["id"],
        "removed": removed, "created": created, "foreign": foreign,
        "collisions": list(created.get("collisions") or []),
        # Named so nobody has to read the code to know what survives a reset on purpose.
        "preserved": [
            "every row without a seed mark (live orders, live messages, real customers)",
            "tenant_range with seeded=false — a REAL delivery radius and depot. The seed writes one "
            "only when there is none, marks its own, and deletes only what it marked, so switching "
            "worlds moves the demo depot and never a real one",
            "sku_aliases with source='learned' on a NON-seeded SKU — real learning, kept",
            "the founder's own `tenants` row — its content is rebuilt, the row itself is never "
            "deleted (auth.app_gate reads it on the app's first call)",
            "every contact name, customer profile, party card and catalogue row that was not seeded "
            "— see `collisions` for exactly which ones and what was kept",
        ],
    }


async def activate_profile(profile_id: str, tenant: Optional[str] = None, *,
                           strict: bool = True, through_brain: bool = False) -> Dict[str, Any]:
    """SWITCH THE WORLD. «Activar» on the founder screen.

    It is `reset_demo_seed` with a name beside it, and it is deliberately not a swap — see the module
    docstring for why one tenant and one flat scope space make a swap impossible rather than merely
    inadvisable. What a founder needs to be able to read BEFORE he presses it is `switch_preview()`:
    two numbers per table, what goes and what stays. What he reads AFTER is this return — the same
    receipt shape the reset already had (`removed` / `created` / `foreign` / `collisions` /
    `preserved`) plus `from_profile` / `to_profile`. A reset that cannot say what it did is not a
    reset a founder can press in front of a customer.

    ⚠️ `through_brain=False` HERE, DELIBERATELY DIFFERENT FROM `load_demo_seed`'s OWN DEFAULT
    (Peter, 2026-07-28: *"why do we need the key for the switching lol"* — a fair question, and the
    honest answer was "it didn't need to, that was a bug"). Switching which demo world is active is a
    DATA swap — the seeded customers/catalogue/orders/review-sheet/doubt-loop are already fully
    populated by `load_demo_seed` deterministically, no model call involved. `through_brain=True`
    additionally runs a HANDFUL of the seeded messages through the REAL live-LLM intake pipeline
    (`run_brain_intake` → `ingest_demo_message`) purely as a "watch it happen live" demo flourish —
    genuinely nice for a guided walkthrough, but it makes an everyday "switch world" button slow
    (several sequential real API calls) and couples a basic app action to Anthropic credit balance,
    rate limits and model latency, none of which the switch itself needs. A caller that specifically
    wants the live-intake flourish still can — the parameter is still here — but the founder's own
    switcher no longer asks for it by default."""
    tenant = tenant or DEMO_TENANT
    target = await _resolve_profile(profile_id)               # raises on an unknown id
    was = await active_profile_id()
    res = await reset_demo_seed(tenant, strict=strict, through_brain=through_brain,
                                profile=target["id"])
    log.info("seed: world switched %s → %s on %s", was, target["id"], tenant)
    return res


async def switch_preview(profile_id: str, tenant: Optional[str] = None) -> Dict[str, Any]:
    """«Activar» asks first, and the question carries TWO NUMBERS PER TABLE, not one.

    `world_counts` already returns both sides — the seeded rows and the live rows sharing the same
    tables — because «how much of this is real» is the first thing a founder needs before he presses
    anything in front of a customer. This is that read, plus who is going and who is coming."""
    tenant = tenant or DEMO_TENANT
    target = await _resolve_profile(profile_id)
    was = await active_profile_id()
    reg = await registry()
    counts = await world_counts(tenant)
    return {
        "from": {"id": was, "name": (reg.get(was) or {}).get("name") or was},
        "to": {"id": target["id"], "name": target.get("name") or target["id"],
               "business": (target.get("business") or {}).get("name") or "",
               "skus": len(target.get("skus") or []),
               "contacts": len(target.get("contacts") or [])},
        "same_world": was == target["id"],
        # goes = what the teardown will delete (rows wearing a mark). stays = the live side of the
        # very same tables. Never summed together: the whole point is that they are two numbers.
        "goes": {k: v for k, v in counts.items() if not k.startswith("live_")},
        "stays": {k[5:]: v for k, v in counts.items() if k.startswith("live_")},
        "resettable": tenant == DEMO_TENANT,
    }


async def refresh_seed(tenant: Optional[str] = None) -> Dict[str, Any]:
    """Wipe seeded rows then reload — live (non-seeded) rows survive. Kept as the name the existing
    admin routes call; `reset_demo_seed` is the same thing with the guards and the receipt."""
    cleared = await clear_all_seeded(tenant)
    loaded = await load_demo_seed(tenant)
    return {"cleared": cleared, "loaded": loaded}


async def reset_to_seeded(tenant: Optional[str] = None) -> Dict[str, int]:
    """Restore the pristine seeded snapshot for a repeatable demo: delete ALL live (non-seeded)
    traffic — messages/orders/calls/queue from any demo run, including a half-finished live order on
    the two Peter numbers — leaving only the seeded history. Gated behind SEED_ENABLED (demo tool).

    ⚠️ WAS "never wire this to the founder «reiniciar» button" — Peter, 2026-07-28, explicitly asked
    for exactly that: "when i hit reset seeded state it should literally clear the orders i made live
    etc, and the messages. they should clear from the event log etc". He is the only person on this
    box; every non-seeded row on DEMO_TENANT right now IS his own testing, never a real customer's —
    the danger this docstring warned about does not apply to the one person who can consent to it for
    himself. `api_app_seed_reset` now calls this AFTER `reset_demo_seed`, not instead of it.

    THE EVENT LOG, added in the same pass: a live order/message going but its `event` (spine) rows
    surviving would leave the review sheet, `why`/`xray`, and every duty-binder read still describing
    orders that no longer exist. Scoped by TENANT via `scope_of`'s own convention (`wa.<digits>` for
    the runtime tenant, `t.<slug>.…` for others) — never a blanket delete, so a multi-tenant box's
    OTHER tenants are untouched."""
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    out = {"orders": 0, "messages": 0, "calls": 0, "events": 0}
    async with pool.acquire() as con:
        await con.execute(
            "delete from order_events where order_id in (select id from orders where not seeded)")
        out["orders"] = int(await con.fetchval(
            "with d as (delete from orders where not seeded returning 1) select count(*) from d") or 0)
        out["messages"] = int(await con.fetchval(
            "with d as (delete from whatsapp_messages where not seeded returning 1) select count(*) from d") or 0)
        out["calls"] = int(await con.fetchval(
            "with d as (delete from calls where not seeded returning 1) select count(*) from d") or 0)
        await con.execute("delete from ingest_queue")
        try:
            await con.execute("delete from medusa_sync")  # wipe ALL outbox intents (live demo + seeded)
        except Exception:
            pass
        try:
            # Plain text LIKE on the ltree's own text cast — simpler and more predictable than lquery
            # syntax for a tenant slug we do not control the characters of.
            prefix = "wa.%" if tenant == config.BRAIN_TENANT else f"t.{tenant}.%"
            out["events"] = int(await con.fetchval(
                "with d as (delete from event where scope::text like $1 returning 1) "
                "select count(*) from d", prefix) or 0)
        except Exception:
            log.exception("reset_to_seeded: event-log wipe failed (fail-soft — orders/messages already cleared)")
    out["medusa"] = await _purge_medusa_seeded()
    return out


async def main() -> None:
    await db.init()
    res = await load_catalogue()
    print("catálogo cargado:", res)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
