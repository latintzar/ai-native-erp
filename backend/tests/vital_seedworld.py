"""vital_seedworld.py — THE SEEDED WORLD IS THE PRODUCT DEMONSTRATING ITSELF (Peter, 2026-07-27).

Peter's brief: "when I log in it should skip the onboarding and take me straight to the app with
seeded data, a seeded state with stuff to review, orders, etc., with a working 'reset seeded state'
button. And real order intake within that seeded SKU list." So the seeded world is not a fixture,
and each check below is a product promise that must not silently regress:

  S1  THE CATALOGUE IS A REAL LIST     — 45–70 SKUs, every row schema-valid, every price sane, every
                                         base_unit/pack_factor/variable_weight honest for what it is.
  S2  CALIBRE IS THE HIDDEN DIMENSION  — the planted same-product/different-dimension pairs really do
                                         classify DIMENSIONLESS through the REAL `doubt._same_product`
                                         (§5.7: the common ambiguity is the calibre, not the product),
                                         and the near-duplicate pairs really do NOT.
  S3  A CHOICE IS TWO, OR IT IS NONE   — a near-duplicate mention surfaces BOTH members; where it
                                         reduces to exactly two rows that is the genuine multiple
                                         choice (§5.7a's 3-button cap = 2 candidates + the escape),
                                         and where it does not, the law says UNKNOWN, not ambiguous.
                                         The deliberate GAPS match nothing at all → the comercial.
  S4  NO REAL COMPANY NAME, ANYWHERE   — a deny-list of the ones already caught in this repo
                                         (Collsar — Peter's own lead — Casa Alberto, Botín, Casa
                                         Pepe) plus: every business name in the seed comes from the
                                         declared invented set.
  S5  THE RESET CANNOT EAT A REAL ROW  — it is idempotent, it refuses a non-demo tenant, and an
                                         unseeded row constructed by hand SURVIVES it.
  S6  THERE IS SOMETHING TO REVIEW     — the sheet is non-empty, every row carries exactly ONE
                                         boss-facing reason, and each names one of §5.8's three
                                         sources and nothing else.
  S8  THE COLLISION LAW                 — the world now lives in the LIVE schema on the FOUNDER'S OWN
                                         tenant (Peter, 2026-07-27: "actually seeded, linked to the
                                         account, marked as test data, but in the real schema"). So a
                                         seeded write may never overwrite, mutate or SHADOW a row that
                                         is not already seeded: a contact name somebody typed, a real
                                         customer profile, a live party card, an edited catalogue row,
                                         an existing delivery radius — each is KEPT, each is named in
                                         the returned `collisions` ledger, and the founder's own
                                         tenant row survives its own reset.
  S9  TEST DATA READS AS TEST DATA      — a seeded order and a real order are distinguishable in the
                                         read models the app and the desk consume, and a REAL first
                                         customer's order is never marked as seed.
  S10 THE DOOR PETER CAN PRESS HIMSELF  — the reset is reachable from the DESK and only from behind
                                         the full gate. Asserted over the REAL ASGI app (`sup_api`
                                         mounted on a bare FastAPI, real `sup_session` cookies minted
                                         into the clone), never by calling the handler: no session →
                                         401 · no CSRF → 403 · staff role → 403 · ANOTHER TENANT'S
                                         session → 403 and the tenant is NEVER read off the wire ·
                                         no confirmation word → 400 · and every refusal deletes
                                         nothing. Then the press itself: an unseeded row survives it,
                                         a second press leaves ONE world, and it lands in sup_audit.

S1–S4 are PURE — no database, no network. S5–S6 (and S7–S9) need a clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_seedworld.py
Without REHEARSAL_DSN they SKIP cleanly (and the vital still fails on any pure regression).
SAFETY: refuses the live `rocoto` DB — S5 writes and deletes rows.
Run: PYTHONPATH=. python3 tests/vital_seedworld.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import doubt  # noqa: E402  — the REAL faculty, not a copy
from brain import matcher  # noqa: E402  — the REAL normaliser
from brain import seed as bseed  # noqa: E402

R = []
SKIPPED = []
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGUE = os.path.join(HERE, "seed", "catalogue.json")
CONTACTS = os.path.join(HERE, "seed", "contacts.json")


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


CAT = json.load(open(CATALOGUE, encoding="utf-8"))
CON = json.load(open(CONTACTS, encoding="utf-8"))
SKUS = CAT["skus"]
BY = {s["id"]: s for s in SKUS}


# ══ S1 · the catalogue is a real wholesale list ══════════════════════════════════════════════════
print("S1 · el catálogo")
ck("S1 45–70 SKUs (a real charcutería list, not a demo of six)",
   45 <= len(SKUS) <= 70, f"{len(SKUS)}")
ck("S1 ids, codes and names are all unique",
   len({s["id"] for s in SKUS}) == len(SKUS)
   and len({s["code"] for s in SKUS}) == len(SKUS)
   and len({s["name"] for s in SKUS}) == len(SKUS))

_REQUIRED = ("id", "code", "name", "family", "base_unit", "pack_factor", "variable_weight",
             "price", "in_assortment", "aliases")
bad_schema = [s.get("id") for s in SKUS if any(k not in s for k in _REQUIRED)]
ck("S1 every row carries the full schema the loader reads", not bad_schema, str(bad_schema[:4]))

bad_unit = [s["id"] for s in SKUS if s["base_unit"] not in ("kg", "unit", "pack", "case")]
ck("S1 base_unit is one the matcher can reason over (kg|unit|pack|case)",
   not bad_unit, str(bad_unit[:4]))

# pack_factor is "units per case" and only means anything on a COUNT item; a kg line is always 1.
bad_pf = [s["id"] for s in SKUS
          if (s["base_unit"] == "kg" and s["pack_factor"] != 1)
          or not isinstance(s["pack_factor"], int) or s["pack_factor"] < 1]
ck("S1 pack_factor is honest (>=1, and exactly 1 on anything sold by the kilo)",
   not bad_pf, str(bad_pf[:4]))

# variable_weight = priced per kg, exact weight closed at dispatch. That is a WHOLE PIECE, so it can
# never sit on something sold by the unit or the case.
bad_vw = [s["id"] for s in SKUS if s["variable_weight"] and s["base_unit"] != "kg"]
ck("S1 variable_weight only ever sits on a kg line (a 500 g tray has a fixed weight)",
   not bad_vw, str(bad_vw[:4]))

bad_price = [f'{s["id"]}={s["price"]}' for s in SKUS
             if not isinstance(s["price"], (int, float)) or not (0.20 <= float(s["price"]) <= 200)]
ck("S1 every price is a sane wholesale € per base unit (0,20–200)",
   not bad_price, str(bad_price[:4]))

no_alias = [s["id"] for s in SKUS if not (s.get("aliases") or [])]
ck("S1 every row carries at least one thing a customer would actually say",
   not no_alias, str(no_alias[:4]))

fams = sorted({s["family"] for s in SKUS})
ck("S1 the families are a real charcutería's sections, not one bucket",
   len(fams) >= 5, ", ".join(fams))

ck("S1 some rows are loaded but NOT sellable today (in_assortment=false is honest, not decorative)",
   any(not s["in_assortment"] for s in SKUS)
   and sum(1 for s in SKUS if s["in_assortment"]) >= 40)


# ══ S2 · calibre is the hidden dimension — asserted on the REAL doubt._same_product ══════════════
print("\nS2 · la dimensión escondida (doubt._same_product, la función de verdad)")
DIM = CAT["_dimension_pairs"]["pairs"]
ck("S2 the catalogue plants a real number of dimension pairs", len(DIM) >= 10, f"{len(DIM)}")

missing = [p for p in DIM if p[0] not in BY or p[1] not in BY]
ck("S2 every declared pair points at rows that exist", not missing, str(missing[:2]))

not_dimensionless = [(BY[a]["name"], BY[b]["name"]) for a, b in DIM
                     if a in BY and b in BY and not doubt._same_product(BY[a], BY[b])]
ck("S2 EVERY dimension pair classifies DIMENSIONLESS (the question is the calibre, not the product)",
   not not_dimensionless, str(not_dimensionless[:2]))

# and the end-to-end read: a tight margin over such a pair must come out of `classify` as the
# CALIBRE question, with at most two candidates — the 3-button cap (§5.7a).
_a, _b = DIM[0]
v = doubt.classify([{"mention": "chorizo sarta", "qty": 20, "unit": "unit", "price": 4.2,
                     "match": {"band": "clean", "tight": True,
                               "candidates": [{"sku_id": _a, "name": BY[_a]["name"], "score": .62},
                                              {"sku_id": _b, "name": BY[_b]["name"], "score": .57}]}}])
ck("S2 a tight margin over a dimension pair is DIMENSIONLESS end to end",
   bool(v["ask"]) and v["ask"][0]["kind"] == doubt.DIMENSIONLESS,
   (v["ask"][0]["kind"] if v["ask"] else "no ask"))
ck("S2 and it never offers more than two candidates (Meta's 3rd button is «Ninguno, te digo»)",
   bool(v["ask"]) and len(v["ask"][0]["candidates"]) <= doubt.MAX_CANDIDATES)

NEAR = CAT["_near_duplicates"]["pairs"]
wrongly_dim = [(BY[p["a"]]["name"], BY[p["b"]]["name"]) for p in NEAR
               if doubt._same_product(BY[p["a"]], BY[p["b"]])]
ck("S2 a NEAR-DUPLICATE is never mistaken for the same product at another calibre",
   not wrongly_dim, str(wrongly_dim[:2]))

v2 = doubt.classify([{"mention": NEAR[0]["say"], "qty": 6, "unit": "kg", "price": 5.3,
                      "match": {"band": "clean", "tight": True, "candidates": [
                          {"sku_id": NEAR[0]["a"], "name": BY[NEAR[0]["a"]]["name"], "score": .55},
                          {"sku_id": NEAR[0]["b"], "name": BY[NEAR[0]["b"]]["name"], "score": .52}]}}])
ck("S2 a near-duplicate pair is AMBIGUOUS — «which product», not «which calibre»",
   bool(v2["ask"]) and v2["ask"][0]["kind"] == doubt.AMBIGUOUS,
   (v2["ask"][0]["kind"] if v2["ask"] else "no ask"))


# ══ S3 · a choice is two rows, or it is no choice at all ═════════════════════════════════════════
# A pure, deterministic stand-in for retrieval: how many of the words the customer said appear in
# this row's own vocabulary (name + aliases), normalised by the REAL `matcher.normalize`. It is NOT a
# claim about the reranker's numbers — those are measured live in vital_doubt_wire. What it proves is
# the property that is the CATALOGUE's job: that the planted pairs are reachable together, and that
# the planted gaps are reachable by nothing.
print("\nS3 · dos candidatos, o ninguno")
_STOP = {"de", "del", "la", "el", "los", "las", "y", "con", "para", "al", "un", "una", "en"}


def _toks(s):
    return [t for t in matcher.normalize(s).split() if t not in _STOP and not t.isdigit()]


def _row_vocab(s):
    out = set(_toks(s["name"]))
    for a in (s.get("aliases") or []):
        out |= set(_toks(a))
    return out


def _score(mention, s):
    mt = _toks(mention)
    return (sum(1 for t in mt if t in _row_vocab(s)) / len(mt)) if mt else 0.0


def _top(mention):
    scored = [(_score(mention, s), s["id"]) for s in SKUS]
    best = max(v for v, _ in scored)
    return best, sorted(i for v, i in scored if v == best and v > 0)


for p in NEAR:
    best, tied = _top(p["say"])
    both = p["a"] in tied and p["b"] in tied
    ck(f"S3 «{p['say']}» surfaces BOTH candidates together", both, f"top={best:.2f} tied={tied}")
    if p.get("two_candidate"):
        ck(f"S3 «{p['say']}» comes down to EXACTLY two rows — the real multiple choice",
           len(tied) == 2, str(tied))
    else:
        # §5.7a, literally: "if the margin is narrow across five rows we cannot get to two, and the
        # honest classification is UNKNOWN — not ambiguous". Pinning that is pinning the law.
        ck(f"S3 «{p['say']}» ties across MORE than two → UNKNOWN by the 3-button cap, not a question",
           len(tied) > 2, str(tied))

for g in CAT["_gaps"]["mentions"]:
    best, tied = _top(g)
    ck(f"S3 GAP «{g}» matches nothing at all → UNKNOWN → the comercial", best == 0.0, str(tied[:3]))

# The §5.7 learnable mentions must NOT be pre-loaded as aliases — the whole point is that the loop
# LEARNS them. A single leak here silently deletes the demo.
_alias_index = {}
for s in SKUS:
    for a in [s["name"]] + (s.get("aliases") or []):
        _alias_index.setdefault(matcher.normalize(a), set()).add(s["id"])
leaked = [m["say"] for m in CAT["_learnable_mentions"]["mentions"]
          if matcher.normalize(m["say"]) in _alias_index]
ck("S3 what the CUSTOMER teaches is NOT pre-loaded as a seed alias (§5.7 — else no loop, no moat)",
   not leaked, str(leaked))
ck("S3 …but the true rows those mentions map to DO exist",
   all(m["true_sku"] in BY and m["against"] in BY
       for m in CAT["_learnable_mentions"]["mentions"]))


# ══ S4 · no real company name, anywhere ══════════════════════════════════════════════════════════
print("\nS4 · ni un nombre real (LEY)")
# The ones this repo has ALREADY shipped by accident — Collsar is Peter's own lead, the rest are real
# Madrid restaurants. Plus the English-catalogue leftovers that were in the seed before this pass.
DENY = ["collsar", "casa alberto", "botin", "botín", "casa pepe", "sobrino de", "lhardy",
        "casa lucio", "bar manolo", "gastrobar lua", "gastrobar lúa", "el quinto pino",
        "casa nieto", "la bien aparecida", "taberna gil", "mesón el roble", "meson el roble",
        "bar marisol", "la tasca", "peter's bistro", "peter's sandwich"]
def _data_only(o):
    """The seed DATA with the `_`-prefixed documentation blocks stripped out. The deny-list is about
    what the world CONTAINS, not about a comment that names the banned words in order to ban them —
    scanning the prose would make the rule unstatable in its own file."""
    if isinstance(o, dict):
        return {k: _data_only(v) for k, v in o.items() if not str(k).startswith("_")}
    if isinstance(o, list):
        return [_data_only(v) for v in o]
    return o


_blob = (json.dumps(_data_only(CAT), ensure_ascii=False) + "\n"
         + json.dumps(_data_only(CON), ensure_ascii=False) + "\n"
         + open(os.path.join(HERE, "brain", "seed.py"), encoding="utf-8").read()).lower()
hits = [d for d in DENY if d in _blob]
ck("S4 no denied real company name appears in the seed data or the seeder", not hits, str(hits))

INVENTED = set(bseed.invented_names())
ck("S4 the invented set is declared in ONE place and is not empty", len(INVENTED) >= 6,
   f"{len(INVENTED)} nombres")


def _from_invented(name: str) -> bool:
    """A seeded business name must BE one of the invented names, or be one of them with a plain
    channel suffix («Casa Bermejo (tienda)» is the same house's shop account)."""
    n = (name or "").strip()
    return any(n == i or n.startswith(i + " (") for i in INVENTED)


bad_contacts = [c["name"] for c in CON["contacts"] if not _from_invented(c["name"])]
ck("S4 every seeded CUSTOMER is drawn from the invented set", not bad_contacts, str(bad_contacts))
ck("S4 the distributor itself is invented too", _from_invented(CON["business"]["name"]),
   CON["business"]["name"])

# The canon world's storefront accounts. They moved out of a bare module constant and into the
# CANON PROFILE's spec when worlds got names (§5.10.3) — a `getattr(bseed, "_STOREFRONT_ORDERS", [])`
# would now read [] and this whole check would pass by finding nothing, which is worse than failing.
_store = [t[1] for t in (bseed._canon_spec().get("storefront_orders") or [])]
ck("S4 the canon world's e-commerce accounts are still there to check", len(_store) >= 2,
   f"{len(_store)}")
bad_store = [n for n in _store if not _from_invented(n)]
ck("S4 every e-commerce account name is drawn from the invented set too",
   not bad_store, str(bad_store))

ck("S4 6–9 customer businesses (a day, not a diorama)", 6 <= len(CON["contacts"]) <= 9,
   f"{len(CON['contacts'])}")
roles = {c.get("role") for c in CON["contacts"]}
ck("S4 the day has an at-risk one, a brand-new one and a high-volume one",
   {"at_risk", "new", "high_volume"} <= roles, str(sorted(r for r in roles if r)))
ck("S4 every seeded contact has a real delivery point (the range rule needs a lat/lon)",
   all(isinstance(c.get("lat"), (int, float)) and isinstance(c.get("lon"), (int, float))
       for c in CON["contacts"]))
ck("S4 every seeded basket is grounded in a REAL catalogue row",
   all(u["sku_id"] in BY for c in CON["contacts"] for u in c["usual"]),
   str([u["sku_id"] for c in CON["contacts"] for u in c["usual"] if u["sku_id"] not in BY][:4]))


# ══ S11 · MORE THAN ONE NAMED WORLD, and the registry cannot be talked into a bad one ════════════
# PRODUCT-SPEC §5.10.3. Pure — the registry reads files, and `registry()` fail-softs to the built-ins
# when there is no database, so every rule below is checkable without one.
print("\nS11 · perfiles con nombre (el registro y su validador)")
# `registry()` is async and touches the DB only for the founder's OWN profiles, where it fail-softs
# to {} — so with no clone this reads exactly the worlds that ship in git, which is what S11 is about.
REG = asyncio.run(bseed.registry())
ck("S11 the registry holds more than one world", len(REG) >= 2, str(sorted(REG)))
ck("S11 the canon world is registered under its own id and is de fábrica",
   (REG.get(bseed.CANON_PROFILE) or {}).get("origin") == "builtin", bseed.CANON_PROFILE)

# THE MARK. The canon world keeps the bare legacy string — if it ever changes, every seeded runtime
# row already on the live box becomes FOREIGN to its own reset and Peter's button refuses on prod.
ck("S11 the canon world's mark is UNCHANGED (`rocoto-demo`) — a live box's rows stay its own",
   bseed.world_mark(bseed.CANON_PROFILE) == "rocoto-demo", bseed.world_mark(bseed.CANON_PROFILE))
ck("S11 every other world gets its OWN mark, and the marks are all distinct",
   len({bseed.world_mark(p) for p in REG}) == len(REG),
   str(sorted(bseed.world_mark(p) for p in REG)))
ck("S11 `is_seed_mark` recognises every registered world and nothing else",
   all(bseed.is_seed_mark(bseed.world_mark(p)) for p in REG)
   and not bseed.is_seed_mark("rocoto-demo:")            # the bare prefix is not a world
   and not bseed.is_seed_mark("otra-cosa") and not bseed.is_seed_mark(""))
MARKS = asyncio.run(bseed.known_marks())
ck("S11 known_marks() is a CLOSED set enumerated from the registry (never a pattern)",
   set(MARKS) == {bseed.world_mark(p) for p in REG} | {"rocoto-demo"}, str(MARKS))

# EVERY WORLD IS A WORLD. The same laws the canon one is held to (S1/S4), applied to all of them.
for _pid, _s in sorted(REG.items()):
    _inv = list(_s.get("invented_names") or [])
    _names = [(_s.get("business") or {}).get("name") or ""] + \
             [c.get("name") or "" for c in (_s.get("contacts") or [])]
    _bad = [n for n in _names
            if not any(n == i or n.startswith(i + " (") for i in _inv)]
    ck(f"S11 [{_pid}] every business name comes from its OWN declared invented set (LEY)",
       not _bad and bool(_inv), str(_bad[:3]))
    _blob = json.dumps(_data_only(_s), ensure_ascii=False).lower()
    ck(f"S11 [{_pid}] no denied real company name anywhere in the world",
       not [d for d in DENY if d in _blob], str([d for d in DENY if d in _blob]))
    _have = {x.get("id") for x in (_s.get("skus") or [])}
    _ung = [u.get("sku_id") for c in (_s.get("contacts") or [])
            for u in (c.get("usual") or []) if u.get("sku_id") not in _have]
    ck(f"S11 [{_pid}] every basket is grounded in THIS world's own catalogue", not _ung,
       str(_ung[:3]))
    # A WORLD MAY NOT BORROW ANOTHER WORLD'S SHELF. `stock` is optional and absent means absent; what
    # it may never be is a level on an article this world does not sell.
    _bad_stock = [row[0] for row in (_s.get("stock") or []) if row and row[0] not in _have]
    ck(f"S11 [{_pid}] the shelf only holds articles this world actually sells", not _bad_stock,
       str(_bad_stock[:3]))
    _bad_intake = [ph for ph, _t in (_s.get("brain_intake") or [])
                   if ph not in {c.get("phone") for c in (_s.get("contacts") or [])}]
    ck(f"S11 [{_pid}] the brain-intake script only writes from THIS world's own customers",
       not _bad_intake, str(_bad_intake[:3]))

# PHONE NUMBERS ARE A PROFILE'S OWN KEY SPACE. `whatsapp_user_profiles` is keyed on the phone and
# `scope_of` is FLAT, so two worlds sharing a number would MERGE into one conversation. Peter's own
# two numbers are the one exception every world may claim.
_seen: dict = {}
_shared: list = []
for _pid, _s in sorted(REG.items()):
    for _c in (_s.get("contacts") or []):
        _ph = _c.get("phone")
        if not _ph or _ph in bseed.DEMO_PHONES:
            continue
        if _ph in _seen:
            _shared.append(f"{_ph} ({_seen[_ph]} + {_pid})")
        _seen[_ph] = _pid
ck("S11 no two worlds share a customer number (they would merge in the same thread)",
   not _shared, str(_shared[:3]))

# THE VALIDATOR BITES — asserted by handing it worlds that must be refused, not by reading it.
_canon = REG[bseed.CANON_PROFILE]
_other = REG[sorted(p for p in REG if p != bseed.CANON_PROFILE)[0]]


def _refuses(spec, reason):
    try:
        asyncio.run(bseed.validate_spec(spec))
        return False, "it was accepted"
    except bseed.ProfileRejected as e:
        return e.reason == reason, f"{e.reason}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


ck("S11 the validator ACCEPTS a well-formed world",
   asyncio.run(bseed.validate_spec(dict(_other)))["id"] == _other["id"])
# A phone that is genuinely canon's OWN — not one of `DEMO_PHONES`, which every world may claim
# (they are Peter's real numbers and the collision law already protects them). The first draft of
# this check picked `contacts[0]`, which IS a demo phone, and went green against a validator that
# had correctly exempted it: the assertion was testing the exemption, not the rule.
_canon_own = next(c["phone"] for c in _canon["contacts"] if c["phone"] not in bseed.DEMO_PHONES)
_ok, _d = _refuses({**_other, "id": "clash",
                    "contacts": [dict(_other["contacts"][0], phone=_canon_own)]},
                   "phone_collision")
ck("S11 …and REFUSES a world whose phones intersect another registered world's", _ok, _d)
_ok, _d = _refuses({**_other, "id": "clash2",
                    "contacts": [dict(_other["contacts"][0], name="Mesón Fuera Del Set")]},
                   "name_not_invented")
ck("S11 …and REFUSES a name outside the declared invented set (the road a real company name takes), at registration, before it can ever be seeded", _ok, _d)
_ok, _d = _refuses({**_other, "id": "clash3", "invented_names": []}, "no_invented_set")
ck("S11 …and REFUSES a world that declares no closed set of invented names at all", _ok, _d)
_ok, _d = _refuses({**_other, "id": "clash4", "skus": []}, "no_catalogue")
ck("S11 …and REFUSES a world with no catalogue (it would seed an empty grounding)", _ok, _d)
_ok, _d = _refuses({**_other, "id": "NoPe!"}, "bad_id")
ck("S11 …and REFUSES an id that is not a slug (it becomes a mark and a directory name)", _ok, _d)


# ══ S5 / S6 · the database half ══════════════════════════════════════════════════════════════════
DSN = os.environ.get("REHEARSAL_DSN") or os.environ.get("SEEDWORLD_DSN") or ""


def _refuses_live(dsn: str) -> bool:
    """Never the live `rocoto` database. This vital deletes rows."""
    tail = dsn.rsplit("/", 1)[-1].split("?")[0].strip()
    return tail in ("rocoto", "rocoto_prod", "rocoto_live")


async def _db_checks():
    os.environ["DATABASE_URL"] = DSN
    import importlib

    import config as _config
    importlib.reload(_config)
    import db as _db
    importlib.reload(_db)
    importlib.reload(bseed)
    await _db.init()
    tenant = bseed.DEMO_TENANT
    pool = _db.get_pool()

    # ── S5 · the reset refuses a tenant that is not the demo tenant ─────────────────────────────
    try:
        await bseed.reset_demo_seed("una-empresa-de-verdad")
        ck("S5 reset REFUSES a tenant that is not the demo tenant", False, "it ran")
    except ValueError as e:
        ck("S5 reset REFUSES a tenant that is not the demo tenant", "demo tenant" in str(e))

    # ── S5 · the unforgivable one: a NON-seeded row must survive a reset ────────────────────────
    canary_order = "live-canary-order-vitalseedworld"
    canary_msg = "live-canary-msg-vitalseedworld"
    canary_phone = "+34600000999"          # not a seeded contact; not a real number in the seed
    async with pool.acquire() as con:
        await con.execute("delete from orders where id=$1", canary_order)
        await con.execute("delete from whatsapp_messages where id=$1", canary_msg)
        await con.execute(
            "insert into orders (id, phone_number, customer_name, status, lines, seeded) "
            "values ($1,$2,'Cliente de verdad','needs_review','[]'::jsonb,false)",
            canary_order, canary_phone)
        await con.execute(
            "insert into whatsapp_messages (id, phone_number, role, message_text, seeded) "
            "values ($1,$2,'user','esto es tráfico real',false)", canary_msg, canary_phone)

    first = await bseed.reset_demo_seed(tenant, strict=False, through_brain=False)
    async with pool.acquire() as con:
        alive_o = await con.fetchval("select count(*) from orders where id=$1", canary_order)
        alive_m = await con.fetchval("select count(*) from whatsapp_messages where id=$1", canary_msg)
    ck("S5 an UNSEEDED order survives the reset (the one unforgivable failure)", alive_o == 1)
    ck("S5 an UNSEEDED message survives the reset", alive_m == 1)

    # ── S5 · idempotent: pressing it twice leaves ONE world, not two ────────────────────────────
    async def _shape():
        async with pool.acquire() as con:
            return {
                "orders": await con.fetchval("select count(*) from orders where seeded"),
                "messages": await con.fetchval("select count(*) from whatsapp_messages where seeded"),
                "skus": await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1 and seeded", tenant),
                "profiles": await con.fetchval(
                    "select count(*) from customer_profiles where tenant_id=$1 and seeded", tenant),
            }

    shape1 = await _shape()
    await bseed.reset_demo_seed(tenant, strict=False, through_brain=False)
    shape2 = await _shape()
    ck("S5 reset is idempotent — twice leaves the same world, not two", shape1 == shape2,
       f"{shape1} vs {shape2}")
    ck("S5 the world it built is not empty", shape1["orders"] > 0 and shape1["skus"] >= 45, str(shape1))
    ck("S5 the reset returns a per-table receipt of what went and what came back",
       isinstance(first.get("removed"), dict) and isinstance(first.get("created"), dict)
       and "preserved" in first)

    # ── S5 · a seed mark this seeder could not have minted STOPS the reset ─────────────────────
    intruder = "d34db33fd34db33fd34db33fd34db33f"      # uuid-shaped, seeded=true, not in the meta
    async with pool.acquire() as con:
        await con.execute("delete from orders where id=$1", intruder)
        await con.execute(
            "insert into orders (id, phone_number, customer_name, status, lines, seeded) "
            "values ($1,'+34600000998','Fila ajena','needs_review','[]'::jsonb,true)", intruder)
    try:
        await bseed.reset_demo_seed(tenant)             # strict=True by default
        ck("S5 a FOREIGN seed-marked row makes the reset refuse outright", False, "it ran")
    except RuntimeError as e:
        ck("S5 a FOREIGN seed-marked row makes the reset refuse outright", "orders" in str(e))
    except Exception as e:
        ck("S5 a FOREIGN seed-marked row makes the reset refuse outright", False,
           f"{type(e).__name__}: {e}")
    async with pool.acquire() as con:
        still = await con.fetchval("select count(*) from orders where id=$1", intruder)
        await con.execute("delete from orders where id=$1", intruder)
    ck("S5 …and it deleted nothing on the way to refusing", still == 1)

    # ── S5 · every teardown predicate names a mark (read the code, not the comment) ─────────────
    # IT READS THE SQL THE MODULE EXECUTES, NEVER PROSE ABOUT IT. A line-grep over the raw file also
    # reads the module's own docstring — which says, correctly, "there is no broad `delete from
    # orders` anywhere in the teardown" — and turns seed.py's documentation of the rule into a
    # breach of it. So the source is PARSED, and only string literals that are actually arguments
    # are held to the rule: a docstring and a `#` comment cannot delete a row.
    # This is not a softer bar. It is a bar on the statements instead of on the lines: a SQL string
    # split across physical lines is now judged whole (`delete from orders` on one line, `where
    # seeded` on the next used to read as naked), and an f-string's interpolations are replaced with
    # a placeholder, so `{maybe_the_mark}` can never stand in for the word `seeded`.
    src = open(os.path.join(HERE, "brain", "seed.py"), encoding="utf-8").read()
    import ast as _ast
    import re as _re
    _tree = _ast.parse(src)
    _prose = {id(n.value) for n in _ast.walk(_tree)                 # bare string expression = docstring
              if isinstance(n, _ast.Expr) and isinstance(n.value, _ast.Constant)
              and isinstance(n.value.value, str)}
    _in_fstring = {id(v) for n in _ast.walk(_tree) if isinstance(n, _ast.JoinedStr)
                   for v in n.values}
    _stmts: list = []
    for n in _ast.walk(_tree):
        if isinstance(n, _ast.JoinedStr):
            _stmts.append((n.lineno, "".join(
                v.value if isinstance(v, _ast.Constant) and isinstance(v.value, str) else "{?}"
                for v in n.values)))
        elif (isinstance(n, _ast.Constant) and isinstance(n.value, str)
              and id(n) not in _prose and id(n) not in _in_fstring):
            _stmts.append((n.lineno, n.value))
    naked = [f"seed.py:{ln} {' '.join(s.split())[:90]}" for ln, s in _stmts
             if _re.search(r"delete\s+from\s+(orders|whatsapp_messages|customer_profiles|"
                           r"catalogue_skus|calls)\b", s)
             and "seeded" not in s]
    # `reset_to_seeded` is the OPPOSITE polarity on purpose (it deletes what is NOT seeded) and says
    # so in its own docstring; its statements all carry `not seeded`, so they are excluded above.
    ck("S5 no teardown statement deletes from a seeded table without naming the mark", not naked,
       str(naked[:2]))

    # ── S5 · THE SECOND PRESS OF THE BUTTON, with the REAL defaults ────────────────────────────
    # Added 2026-07-27 because this is what actually broke, and every check above stayed green
    # through it: the two resets used by this vital pass `strict=False` (correct for SETUP on a
    # clone ~50 other vitals have written to), which is exactly the flag that skips `_audit_foreign`.
    # `reset_demo_seed()` — what `/api/app/seed/reset` calls, what Peter's button calls — is
    # strict=True + through_brain=True, and a brain burst that could not finish leaves a seeded
    # `preparing` order with a uuid4 id. On the second press the audit called it foreign and REFUSED.
    # So: run it the way the product runs it, twice. The second is `through_brain=False` only to
    # spare the model four calls per regression — the AUDIT runs first either way, and the audit is
    # the whole point of the check.
    await bseed.reset_demo_seed(tenant)                       # defaults: strict=True + the brain
    try:
        await bseed.reset_demo_seed(tenant, through_brain=False)     # strict=True: the audit bites here
        ck("S5 pressing «reiniciar» a SECOND time still runs — the audit knows its own brain orders",
           True)
    except RuntimeError as e:
        ck("S5 pressing «reiniciar» a SECOND time still runs — the audit knows its own brain orders",
           False, str(e)[:180])

    async with pool.acquire() as con:
        alive2 = await con.fetchval("select count(*) from orders where id=$1", canary_order)
    ck("S5 …and the unseeded canary is STILL there after all of them", alive2 == 1)

    async with pool.acquire() as con:
        await con.execute("delete from orders where id=$1", canary_order)
        await con.execute("delete from whatsapp_messages where id=$1", canary_msg)

    # ── S6 · there is something to review, and every row carries exactly ONE reason ─────────────
    import review as _review
    import runtime as _runtime
    rows = await _runtime.review_list(50)
    ck("S6 the seeded review sheet is NOT empty", len(rows) > 0, f"{len(rows)} filas")
    bad_src = [r.get("review_source") for r in rows if r.get("review_source") not in _review.SOURCES]
    ck("S6 every row names one of §5.8's THREE sources and nothing else", not bad_src, str(bad_src))
    empty_why = [r.get("id") for r in rows if not str(r.get("why") or "").strip()]
    ck("S6 every row carries a boss-facing reason", not empty_why, str(empty_why[:3]))
    multi = [str(r.get("why")) for r in rows
             if "\n" in str(r.get("why") or "") or str(r.get("why") or "").count(";") > 0]
    ck("S6 exactly ONE reason per row — never a list (§5.8a tone law)", not multi, str(multi[:2]))
    srcs = {r.get("review_source") for r in rows}
    ck("S6 the seeded day shows the closed set in action (≥2 of the three sources present)",
       len(srcs & set(_review.SOURCES)) >= 2, str(sorted(s for s in srcs if s)))

    # ── S7 · THE TIMEOUT ROW MUST STAND ON A REAL OPEN QUESTION ────────────────────────────────
    # Added 2026-07-27 after the seed silently lost the whole tab (a partial unique index the
    # `on conflict` could not infer) while every check above still went green: the sheet had its
    # TIMEOUT row, the counts claimed an open loop, and there was nothing underneath either of them.
    # A parked reason with no question behind it is precisely the fiction §5.8 exists to prevent, so
    # the three rows one question leaves behind are now asserted through the organs that read them.
    from brain import pipeline as _pipeline
    YORK_SCOPE = _runtime.scope_of("+34611111003")            # Casa Bermejo — the OPEN half
    HAM_PHONE = "+12025550111"                                # Café Sotillo — the RESOLVED half
    async with _db.scoped_tx(YORK_SCOPE) as _c:
        loops = await _c.fetch(
            "select id, kind, status, entity_key from open_loop "
            "where scope=$1::ltree and kind='question' and status='open'", YORK_SCOPE)
        asked_ev = await _c.fetch(
            "select payload->>'mention' as mention, payload->>'ask_key' as ask_key, type "
            "from event where scope=$1::ltree and type = any($2::text[])",
            YORK_SCOPE, [_pipeline.ASKED_EVENT, _review.ASKED])
        fired = await _c.fetchval(
            "select count(*) from timer t join open_loop l on l.id=t.loop_id "
            "where t.scope=$1::ltree and l.kind='question'", YORK_SCOPE)
    ck("S7 the open question is a REAL open_loop tab, not just a sentence on the sheet",
       len(loops) == 1, str([dict(r) for r in loops]))
    ck("S7 …with its (already-aged) timer beside it", fired == 1, f"{fired} timer(s)")
    types = {r["type"] for r in asked_ev}
    ck("S7 one question leaves BOTH rows: question.asked arms the §5.8 clock…",
       _review.ASKED in types, str(sorted(types)))
    ck("S7 …and doubt.asked is the NEVER-TWICE ledger + the tap's lookup key",
       _pipeline.ASKED_EVENT in types, str(sorted(types)))
    ck("S7 the ledger row carries the ask_key the tap resolves against",
       any(r["ask_key"] == "seedmsg-doubt-york-ask" for r in asked_ev
           if r["type"] == _pipeline.ASKED_EVENT))
    # The rule itself, read through the function the runtime calls — not a re-implementation of it.
    york = await _pipeline.asked_mentions("+34611111003")
    ham = await _pipeline.asked_mentions(HAM_PHONE)
    ck("S7 NEVER TWICE: «jamón york» is already in this customer's asked ledger",
       york is not None and "jamón york" in york, str(sorted(york or [])))
    ck("S7 NEVER TWICE: «el jamoncito» is in Sotillo's, so the answered half is not re-asked",
       ham is not None and "el jamoncito" in ham, str(sorted(ham or [])))
    ck("S7 …and it is PER-CUSTOMER — Sotillo's word is not in Bermejo's ledger",
       york is not None and "el jamoncito" not in york)

    # ══ S8 · THE COLLISION LAW — the world lives in the LIVE schema now ═════════════════════════
    # Added 2026-07-27 with the binding to the founder's own tenant. Everything below is planted the
    # way it exists on the live box: a contact name a human typed, a real customer profile, a live
    # party card, an operator-edited catalogue row, a real delivery radius — each sitting exactly
    # where the seed wants to write. The seed must keep every one of them, SAY it kept them, and
    # still build its world around them.
    print("\nS8 · la ley de colisiones (el mundo vive en el esquema real)")
    seed_contacts = [c["phone"] for c in CON["contacts"]]
    NAME_PHONE = seed_contacts[0]                       # a contact the seed wants to name itself
    PROF_PHONE = seed_contacts[1]
    CARD_SCOPE = bseed.scope_of(seed_contacts[2])
    THREAD_CANARY_O = "live-canary-inthread-order"
    THREAD_CANARY_M = "live-canary-inthread-msg"
    REAL_NAME = "Nombre que puso una persona"
    edited_sku = SKUS[0]["id"]

    async with pool.acquire() as con:
        await con.execute(
            "insert into whatsapp_user_profiles (phone_number, display_name) values ($1,$2) "
            "on conflict (phone_number) do update set display_name=excluded.display_name",
            NAME_PHONE, REAL_NAME)
        await con.execute(
            "insert into customer_profiles (phone_number, tenant_id, display_name, seeded) "
            "values ($1,$2,'Ficha real',false) on conflict (tenant_id, phone_number) do update set "
            "seeded=false, display_name='Ficha real'", PROF_PHONE, tenant)
        # an operator edit: the app's catalogue-edit flips `seeded` false and renames the row
        await con.execute(
            "update catalogue_skus set seeded=false, name='NOMBRE CORREGIDO A MANO', price=99.5 "
            "where tenant_id=$1 and id=$2", tenant, edited_sku)
        # a real order + a real message INSIDE a seeded customer's own thread (the hardest case:
        # the reset is about to delete that thread's seeded rows all around them)
        await con.execute("delete from orders where id=$1", THREAD_CANARY_O)
        await con.execute("delete from whatsapp_messages where id=$1", THREAD_CANARY_M)
        await con.execute(
            "insert into orders (id, phone_number, customer_name, status, lines, seeded) "
            "values ($1,$2,'Pedido de verdad','needs_review','[]'::jsonb,false)",
            THREAD_CANARY_O, seed_contacts[2])
        await con.execute(
            "insert into whatsapp_messages (id, phone_number, role, message_text, seeded) "
            "values ($1,$2,'user','tráfico real dentro de un hilo sembrado',false)",
            THREAD_CANARY_M, seed_contacts[2])
        radius_before = await con.fetchval(
            "select range_km from tenant_range where tenant_id=$1", tenant)
        if radius_before is None:
            await con.execute(
                "insert into tenant_range (tenant_id, range_kind, range_km) values ($1,'radius',7) "
                "on conflict (tenant_id) do update set range_km=7", tenant)
            radius_before = 7
    async with _db.scoped_tx(CARD_SCOPE) as sc:
        await sc.execute(
            "insert into card(scope, body, version, lineage) values($1::ltree,$2,0,'live') "
            "on conflict (scope) do update set body=excluded.body, lineage='live'",
            CARD_SCOPE, "FICHA REAL — la construyó una conversación de verdad")

    res = await bseed.reset_demo_seed(tenant, strict=False, through_brain=False)
    led = {(c["table"], c["key"]) for c in (res.get("collisions") or [])}

    async with pool.acquire() as con:
        kept_name = await con.fetchval(
            "select display_name from whatsapp_user_profiles where phone_number=$1", NAME_PHONE)
        ck("S8 a contact name a person typed is NOT renamed by a seed load", kept_name == REAL_NAME,
           repr(kept_name))
        ck("S8 …and the skip is REPORTED, not silent",
           ("whatsapp_user_profiles", NAME_PHONE) in led, str(sorted(led))[:200])
        prof = await con.fetchrow(
            "select display_name, seeded from customer_profiles where phone_number=$1", PROF_PHONE)
        ck("S8 a REAL customer profile is neither recomputed nor marked seeded "
           "(marking it would arm a delete on a real customer)",
           bool(prof) and prof["display_name"] == "Ficha real" and not prof["seeded"],
           str(dict(prof) if prof else None))
        ck("S8 …and that skip is reported too", ("customer_profiles", PROF_PHONE) in led)
        sku = await con.fetchrow(
            "select name, price, seeded from catalogue_skus where tenant_id=$1 and id=$2",
            tenant, edited_sku)
        ck("S8 an operator-EDITED catalogue row survives a re-seed intact (name, price and its "
           "`seeded=false`, which is what stops the teardown ever deleting it)",
           bool(sku) and sku["name"] == "NOMBRE CORREGIDO A MANO" and not sku["seeded"]
           and float(sku["price"]) == 99.5, str(dict(sku) if sku else None))
        ck("S8 …and it is named in the ledger", ("catalogue_skus", edited_sku) in led)
        radius_after = await con.fetchval(
            "select range_km from tenant_range where tenant_id=$1", tenant)
        ck("S8 an existing delivery radius is a REAL operating rule and is left alone",
           radius_after is not None and float(radius_after) == float(radius_before),
           f"{radius_before} -> {radius_after}")
        alive = await con.fetchval("select count(*) from orders where id=$1", THREAD_CANARY_O)
        alivem = await con.fetchval("select count(*) from whatsapp_messages where id=$1",
                                    THREAD_CANARY_M)
        ck("S8 a REAL order inside a SEEDED customer's own thread survives the reset", alive == 1)
        ck("S8 a REAL message inside a SEEDED customer's own thread survives the reset", alivem == 1)
        trow = await con.fetchrow("select slug, name, seeded from tenants where slug=$1", tenant)
        ck("S8 the world is bound to the FOUNDER'S tenant — the business identity lands on "
           "`config.BRAIN_TENANT`, the same slug auth._founder_tenant() resolves him to",
           bool(trow) and (trow["name"] or "").strip() != "" and trow["seeded"],
           str(dict(trow) if trow else None))
        ck("S8 …and the teardown NEVER deletes that row (the app's first call reads it)",
           bool(trow))
    async with _db.scoped_tx(CARD_SCOPE) as sc:
        card = await sc.fetchrow("select body, lineage from card where scope=$1::ltree", CARD_SCOPE)
    ck("S8 a LIVE party card wins over the seeded one",
       bool(card) and card["lineage"] == "live", str(dict(card) if card else None))
    ck("S8 …and that skip is reported", ("card", CARD_SCOPE) in led)

    # ══ S9 · TEST DATA READS AS TEST DATA ══════════════════════════════════════════════════════
    # A founder looking at his own screen must be able to tell a demo order from a real one at a
    # glance — and a REAL first customer's order must never be mistaken for seed. Asserted on the
    # READ MODELS the surfaces actually consume, not on the columns.
    print("\nS9 · el dato de prueba se lee como dato de prueba")
    orders_out = await _db.order_list(limit=200)
    ck("S9 the order read model (`/api/orders`) carries `seeded` on every row",
       bool(orders_out) and all("seeded" in o for o in orders_out),
       str(sorted({tuple(sorted(o.keys()))[:1] for o in orders_out})[:1]))
    seeded_rows = [o for o in orders_out if o.get("seeded")]
    real_rows = [o for o in orders_out if not o.get("seeded")]
    ck("S9 the seeded world reads as seeded", len(seeded_rows) > 10, f"{len(seeded_rows)}")
    ck("S9 …and the hand-made REAL order reads as real (never as seed)",
       any(o["id"] == THREAD_CANARY_O and not o.get("seeded") for o in real_rows))
    one = await _db.order_get(THREAD_CANARY_O)
    ck("S9 a single-order read says it too (`/api/orders/{id}`)",
       bool(one) and one.get("seeded") is False, str((one or {}).get("seeded")))
    rows = await _runtime.review_list(80)
    # `payload` is not always an object (some action kinds park a list) — the classification must be
    # as defensive as app.py's, because an unmarked row means REAL and that is the safe direction.
    def _is_seed(r):
        p = r.get("payload")
        return bool(isinstance(p, dict) and p.get("seed_world") == bseed.SEED_WORLD)
    classed = [(r.get("id"), _is_seed(r)) for r in rows]
    ck("S9 every review-sheet row can be classified seeded/real from its own payload "
       "(app.py annotates `seeded` off exactly this)", bool(classed))
    ck("S9 the seeded review rows ARE marked", any(c[1] for c in classed), str(classed[:4]))

    async with pool.acquire() as con:      # leave the clone tidy
        await con.execute("delete from orders where id=$1", THREAD_CANARY_O)
        await con.execute("delete from whatsapp_messages where id=$1", THREAD_CANARY_M)

    # ══ S10 · THE DOOR PETER CAN PRESS HIMSELF ═════════════════════════════════════════════════
    # Everything above proves the RESET is safe. None of it proves he can REACH it: the reset was
    # only ever callable from a python process on the box, which means "reset it" was a message to
    # the builder, not a button. §S10 is the door — `/api/sup/demo` + `/api/sup/demo/reset` on the
    # desk's own rail — and it is asserted THROUGH THE ASGI STACK, not by calling the handler, so
    # the dependency chain that is the actual guard (cookie → CSRF → capability → tenant fence) is
    # what gets tested. Calling `sup_demo_reset(ctx=…)` directly would skip every one of them and
    # still go green, which is precisely the shape of test that lets an unguarded route ship.
    #
    # The router is mounted on a BARE FastAPI here rather than importing `app` — the organ must be
    # reachable on its own, and a vital that imports the 350 000-line app to test one route fails
    # for reasons that have nothing to do with the route.
    await _s10_door(_db, pool, tenant)
    # LAST, because it DESTROYS the canon world and builds a different one in its place. Everything
    # above assumes Cárnicas Aldonza is what is in the tables; this is the check that it does not
    # have to be. It puts canon back on the way out.
    await _s5b_switch(_db, pool, tenant)


async def _s5b_switch(_db, pool, tenant):
    """S5b/S5c · SWITCHING WORLDS (PRODUCT-SPEC §5.10.3).

    The one unforgivable failure is unchanged and re-asserted here against the MULTI-WORLD teardown:
    a row nobody seeded survives everything. On top of it, the two properties a switch adds:
      · after activating B there is exactly ONE world in the tables — not A's rows and B's rows
        sitting on top of each other, which is what a teardown keyed on a single hardcoded mark would
        have left behind;
      · a profile whose phones collide with another's is refused at REGISTRATION, in the database
        path (S11 asserts the same rule on the file path).
    """
    print("\nS5b/S5c · cambiar de mundo")
    canon = bseed.CANON_PROFILE
    reg = await bseed.registry()
    other = sorted(p for p in reg if p != canon)
    if not other:
        skip("S5b switching lands", "sólo hay un perfil registrado")
        return
    other = other[0]

    # The canary pair again — an order and a message NOBODY seeded, planted on a demo scope so they
    # sit inside the very conversations the teardown reaches into.
    demo_phone = reg[canon]["contacts"][1]["phone"]
    CO, CM = "live-canary-switch-order", "live-canary-switch-msg"
    async with pool.acquire() as con:
        await con.execute("delete from orders where id=$1", CO)
        await con.execute("delete from whatsapp_messages where id=$1", CM)
        await con.execute(
            "insert into orders (id, phone_number, customer_name, status, lines, seeded) "
            "values ($1,$2,'Cliente de verdad','needs_review','[]'::jsonb,false)", CO, demo_phone)
        await con.execute(
            "insert into whatsapp_messages (id, phone_number, role, message_text, seeded) "
            "values ($1,$2,'user','esto es tráfico real',false)", CM, demo_phone)

    await bseed.reset_demo_seed(tenant, strict=False, through_brain=False, profile=canon)
    ck("S5b the active world is recorded by NAME", await bseed.active_profile_id() == canon,
       await bseed.active_profile_id())

    res = await bseed.activate_profile(other, tenant, strict=False, through_brain=False)
    led_sw = {(c["table"], c["key"]) for c in (res.get("collisions") or [])}
    ck("S5b activating another world reports who went and who came",
       res.get("from_profile") == canon and res.get("to_profile") == other,
       f"{res.get('from_profile')} → {res.get('to_profile')}")
    ck("S5b …and the box now says the NEW world is the active one",
       await bseed.active_profile_id() == other)

    # THE POINT. Not one row of the world we left may still be standing.
    old_mark, new_mark = bseed.world_mark(canon), bseed.world_mark(other)
    left = {"action": 0, "event": 0, "open_loop": 0, "timer": 0}
    for scope in await bseed.all_demo_scopes():
        try:
            async with _db.scoped_tx(scope) as c:
                for t, col in (("action", "payload"), ("event", "payload"),
                               ("open_loop", "resume_ref"), ("timer", "payload")):
                    left[t] += int(await c.fetchval(
                        f"select count(*) from {t} where {col}->>'seed_world' = $1", old_mark) or 0)
        except Exception:
            pass
    ck("S5b NOT ONE runtime row of the world we left is still standing", not any(left.values()),
       str(left))
    async with pool.acquire() as con:
        old_skus = await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and seeded and id like 'sku-%' "
            "and id in (select unnest($2::text[]))",
            tenant, [s["id"] for s in reg[canon]["skus"]])
        new_skus = await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and seeded and "
            "id in (select unnest($2::text[]))", tenant, [s["id"] for s in reg[other]["skus"]])
    ck("S5b the OLD world's catalogue is gone", old_skus == 0, f"{old_skus} artículos")
    ck("S5b …and the NEW world's catalogue is the one that is there",
       new_skus == len(reg[other]["skus"]), f"{new_skus}/{len(reg[other]['skus'])}")

    # THE DELIVERY RULE MOVED WITH THE WORLD. Before `tenant_range.seeded` existed the row was
    # written once and never deleted, so world B would have been measuring «fuera de tu radio»
    # against world A's depot — a sentence that is wrong in a way nobody would ever notice.
    async with pool.acquire() as con:
        rng = await con.fetchrow(
            "select range_km::float8 as km, depot_lat, coalesce(seeded,false) as seeded "
            "from tenant_range where tenant_id=$1", tenant)
    want = reg[other]["business"]
    if ("tenant_range", tenant) in led_sw:
        # A REAL (unseeded) radius pre-existed — e.g. the founder provisioning that `vital_founder`
        # exercises writes the founder default before this vital runs in the full suite. The LAW the
        # mark implements («a real one still wins outright», seed.py) says the switch must KEEP it —
        # so the honest assertions here are: untouched, still unseeded, and the keep REPORTED.
        ck("S5b a REAL radius pre-existed and the switch KEPT it (the law held)",
           rng is not None and not rng["seeded"], str(dict(rng) if rng else None))
        ck("S5b …and the keep was REPORTED as a collision, not silent", True)
    else:
        ck("S5b the delivery radius is the NEW world's, not the old one's",
           rng is not None and abs((rng["km"] or 0) - float(want.get("range_km") or 0)) < 0.01,
           f"{dict(rng) if rng else None} vs {want.get('range_km')}")
        ck("S5b …and it is marked as test data, so a REAL radius could never have been moved",
           bool(rng and rng["seeded"]))

    async with pool.acquire() as con:
        alive_o = await con.fetchval("select count(*) from orders where id=$1", CO)
        alive_m = await con.fetchval("select count(*) from whatsapp_messages where id=$1", CM)
    ck("S5b THE UNFORGIVABLE ONE, again, across a switch: the unseeded order is still there",
       alive_o == 1)
    ck("S5b …and so is the unseeded message", alive_m == 1)

    # Switch BACK, twice through the door, and the same row still has to be there. Two switches is
    # where a teardown that widened its predicate would finally reach something it should not.
    await bseed.activate_profile(canon, tenant, strict=False, through_brain=False)
    await bseed.activate_profile(other, tenant, strict=False, through_brain=False)
    await bseed.activate_profile(canon, tenant, strict=False, through_brain=False)
    async with pool.acquire() as con:
        alive_o2 = await con.fetchval("select count(*) from orders where id=$1", CO)
        alive_m2 = await con.fetchval("select count(*) from whatsapp_messages where id=$1", CM)
        stray = await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and seeded and "
            "id in (select unnest($2::text[]))", tenant, [s["id"] for s in reg[other]["skus"]])
    ck("S5b after three more switches the unseeded order AND message are both still alive",
       alive_o2 == 1 and alive_m2 == 1, f"order={alive_o2} msg={alive_m2}")
    ck("S5b …and exactly ONE world is in the tables, not the leftovers of the others", stray == 0,
       f"{stray} artículos del otro mundo")
    ck("S5b we are back on the canon world", await bseed.active_profile_id() == canon)

    # ── S5c · a profile whose phones collide with another's is refused at REGISTRATION ──────────
    made = None
    try:
        made = await bseed.create_profile("Mundo duplicado de prueba", from_profile_id=other)
        ck("S5c duplicating a world is refused — its phones are already another world's",
           False, f"it created {made}")
    except bseed.ProfileRejected as e:
        ck("S5c duplicating a world is refused — its phones are already another world's",
           e.reason == "phone_collision", e.reason)
    except Exception as e:
        ck("S5c duplicating a world is refused — its phones are already another world's",
           False, f"{type(e).__name__}: {e}")

    # …and the DB path can register a world that does NOT collide. Same spec, fresh numbers.
    body = {k: v for k, v in reg[other].items() if k not in ("id", "origin", "editable", "name")}
    body["contacts"] = [dict(c, phone="+3466600" + str(1000 + i)[-4:])
                        for i, c in enumerate(body["contacts"])]
    body["brain_intake"] = []          # its script named the old numbers
    body["storefront_orders"] = []
    created = None
    try:
        created = await bseed.create_profile("Mundo de prueba del vital", body=body)
        ck("S5c a world with its own numbers CAN be registered from the database path",
           bool(created and created.get("id")), str(created))
    except Exception as e:
        ck("S5c a world with its own numbers CAN be registered from the database path", False,
           f"{type(e).__name__}: {e}")
    if created:
        pid = created["id"]
        listed = await bseed.list_profiles()
        ck("S5c …and it shows up in the registry as one of HIS, beside the de fábrica ones",
           any(p["id"] == pid and p["origin"] == "own" for p in listed["profiles"])
           and any(p["origin"] == "builtin" for p in listed["profiles"]),
           str([(p["id"], p["origin"]) for p in listed["profiles"]]))
        ck("S5c …and the registry says which ONE is active",
           sum(1 for p in listed["profiles"] if p["active"]) == 1,
           str([p["id"] for p in listed["profiles"] if p["active"]]))
        # a built-in is read-only from the app; the active one cannot be deleted out from under itself
        try:
            await bseed.delete_profile(canon)
            ck("S5c a de fábrica world cannot be deleted from the app", False, "it was deleted")
        except bseed.ProfileRejected as e:
            ck("S5c a de fábrica world cannot be deleted from the app",
               e.reason in ("builtin_readonly", "profile_active"), e.reason)
        await bseed.activate_profile(pid, tenant, strict=False, through_brain=False)
        try:
            await bseed.delete_profile(pid)
            ck("S5c the ACTIVE world cannot be deleted (its rows would outlive their own name)",
               False, "it was deleted")
        except bseed.ProfileRejected as e:
            ck("S5c the ACTIVE world cannot be deleted (its rows would outlive their own name)",
               e.reason == "profile_active", e.reason)
        await bseed.activate_profile(canon, tenant, strict=False, through_brain=False)
        await bseed.delete_profile(pid)
        ck("S5c …and once it is not active it deletes cleanly",
           pid not in (await bseed.registry()))

    async with pool.acquire() as con:
        alive_o3 = await con.fetchval("select count(*) from orders where id=$1", CO)
    ck("S5c the unseeded canary survived every profile operation too", alive_o3 == 1)
    async with pool.acquire() as con:
        await con.execute("delete from orders where id=$1", CO)
        await con.execute("delete from whatsapp_messages where id=$1", CM)
        await con.execute("delete from whatsapp_user_profiles where phone_number like '+3466600%'")


async def _s10_door(_db, pool, tenant):
    print("\nS10 · la puerta que Peter puede pulsar")
    try:
        import httpx
        from fastapi import FastAPI

        import sup_api
        import sup_session
    except Exception as e:
        ck("S10 the desk rail imports", False, f"{type(e).__name__}: {e}")
        return

    async def _noop(*_a, **_k):
        return {}

    bare = FastAPI()
    sup_api.mount(bare, dispatch_settings=_noop, save_dispatch=_noop, run_dispatch=_noop,
                  dispatch_on_approve=_noop, profile_after_submit=_noop, pedidos_plan=_noop)

    # THE ROUTE MAY NOT TAKE A TENANT. Read off the signature, because this is the property that
    # cannot be tested by sending a bad value: you cannot forge a parameter that does not exist.
    import inspect
    sig = set(inspect.signature(sup_api.sup_demo_reset).parameters)
    ck("S10 the reset route has NO tenant parameter — the tenant comes from the session, and there "
       "is nothing on the wire to forge", not (sig & {"tenant", "tenant_slug", "tenant_id", "slug"}),
       str(sorted(sig)))

    FOREIGN = "vital-seedworld-foreign"
    OWNER_MAIL = "owner@vitalseedworld.test"
    STAFF_MAIL = "staff@vitalseedworld.test"
    ALIEN_MAIL = "alien@vitalseedworld.test"
    async with pool.acquire() as con:
        await con.execute(
            "insert into tenants (slug,name,status,seeded) values ($1,'Vital Seedworld SL','test',true) "
            "on conflict (slug) do nothing", FOREIGN)
    owner = await sup_session.mint(OWNER_MAIL, tenant, "owner", "1.2.3.4", "vital")
    staff = await sup_session.mint(STAFF_MAIL, tenant, "staff", "1.2.3.4", "vital")
    alien = await sup_session.mint(ALIEN_MAIL, FOREIGN, "owner", "1.2.3.4", "vital")

    # An UNSEEDED row planted before the button is pressed. Everything else in S10 can be green and
    # this one check failing would still mean the door is unshippable.
    CANARY_O = "live-canary-desk-door"
    CANARY_M = "live-canary-desk-door-msg"

    async def _plant():
        async with pool.acquire() as con:
            await con.execute("delete from orders where id=$1", CANARY_O)
            await con.execute("delete from whatsapp_messages where id=$1", CANARY_M)
            await con.execute(
                "insert into orders (id, phone_number, customer_name, status, lines, seeded) "
                "values ($1,'+34600000997','Pedido real del escritorio','needs_review','[]'::jsonb,false)",
                CANARY_O)
            await con.execute(
                "insert into whatsapp_messages (id, phone_number, role, message_text, seeded) "
                "values ($1,'+34600000997','user','real, escrito desde el escritorio',false)", CANARY_M)

    async def _alive():
        async with pool.acquire() as con:
            return (await con.fetchval("select count(*) from orders where id=$1", CANARY_O),
                    await con.fetchval("select count(*) from whatsapp_messages where id=$1", CANARY_M))

    async def _seeded_shape():
        """The world's shape, split by WHO WROTE IT — because only one half is deterministic.

        The seeder pre-files rows under its own `seed-` / `seedmsg-` id space: those are byte-exact
        on every run and must be identical across two presses. But `reset_demo_seed(through_brain=
        True)` — which is what the DESK route calls — also replays the seed's messages through the
        REAL order brain, and how many orders an LLM extracts from the same text is not fixed. It was
        96 on one press and 95 on the next, and neither number is wrong.

        Comparing the totals therefore asserted determinism over a model, which is why this check
        went red on a healthy product. It is split rather than loosened: the deterministic half is
        still compared EXACTLY (and is provably stable — `reset_demo_seed(through_brain=False)` twice
        gives an identical id set, measured), and the brain half is held to the property the check
        actually exists to protect: **a second press must not leave TWO worlds.** Duplication is the
        failure. One fewer extraction is model variance."""
        async with pool.acquire() as con:
            return {
                # deterministic: the seeder's own pre-filed rows, exact-match across presses
                "seed_orders": await con.fetchval(
                    "select count(*) from orders where seeded and id like 'seed-%'"),
                "messages": await con.fetchval("select count(*) from whatsapp_messages where seeded"),
                "skus": await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1 and seeded", tenant),
                # model-dependent: what the brain minted from the seeded conversations
                "_brain_orders": await con.fetchval(
                    "select count(*) from orders where seeded and id not like 'seed-%'"),
            }

    await _plant()
    before = await _seeded_shape()
    async with pool.acquire() as con:
        # Scope the audit assertion to THIS run. `sup_audit` is append-only at the DB level (a
        # trigger), so the rows a previous run left cannot be deleted — and counting them would
        # make «it audited the press» pass on a run where nothing was audited at all.
        run_t0 = await con.fetchval("select now()")

    def _as(sess, csrf: bool = True) -> dict:
        """Ride the cookie as an explicit header, never through httpx's jar: the 401 path answers
        with a cookie-DELETING Set-Cookie, and a jar that has just been told to drop `sup_session`
        is not a thing later assertions should be standing on."""
        h = {"cookie": f"sup_session={sess['raw']}"}
        if csrf:
            h["x-sup-csrf"] = sess["csrf"]
        return h

    CONFIRM = {"confirm": "REINICIAR"}
    tr = httpx.ASGITransport(app=bare)
    async with httpx.AsyncClient(transport=tr, base_url="https://desk.test", timeout=600.0) as c:
        # ── the five refusals. After each one the world must be UNTOUCHED. ─────────────────────
        r = await c.post("/api/sup/demo/reset", json=CONFIRM)
        ck("S10 NO SESSION → 401, and the cookie is cleared", r.status_code == 401
           and r.json().get("error") == "session_required", f"{r.status_code} {r.text[:90]}")

        r = await c.post("/api/sup/demo/reset", headers=_as(owner, csrf=False), json=CONFIRM)
        ck("S10 a session WITHOUT the CSRF header → 403 (a cross-site POST can never press it)",
           r.status_code == 403 and r.json().get("error") == "csrf_invalid",
           f"{r.status_code} {r.text[:90]}")

        r = await c.post("/api/sup/demo/reset", headers=_as(staff), json=CONFIRM)
        ck("S10 a STAFF role → 403 cap_required (reset is an admin act, not a shift act)",
           r.status_code == 403 and r.json().get("error") == "cap_required",
           f"{r.status_code} {r.text[:90]}")

        r = await c.post("/api/sup/demo/reset", headers=_as(alien), json=CONFIRM)
        ck("S10 ANOTHER TENANT'S session → 403 not_demo_tenant (the one that would be a disaster)",
           r.status_code == 403 and r.json().get("error") == "not_demo_tenant",
           f"{r.status_code} {r.text[:90]}")

        r = await c.post("/api/sup/demo/reset", headers=_as(owner), json={})
        ck("S10 NO CONFIRMATION WORD → 400 confirm_required (a reset is not an undo)",
           r.status_code == 400 and r.json().get("error") == "confirm_required",
           f"{r.status_code} {r.text[:90]}")
        ck("S10 …and the refusal says the word to type, in es-ES",
           "REINICIAR" in str(r.json().get("detail") or ""), str(r.json().get("detail"))[:90])

        r = await c.post("/api/sup/demo/reset", headers=_as(owner), json={"confirm": "si"})
        ck("S10 the WRONG word → 400 too (only the exact word arms it)", r.status_code == 400,
           f"{r.status_code} {r.text[:90]}")

        after_refusals = await _seeded_shape()
        ck("S10 FIVE refusals later the world is byte-for-byte where it started — a refusal deletes "
           "nothing", after_refusals == before, f"{before} vs {after_refusals}")

        # ── the SIXTH refusal: the audit bites, and it has to say so IN SPANISH ─────────────────
        # `_audit_foreign`'s verdict is the one refusal a founder will actually meet, and the
        # seeder's own exception text is English (written for whoever reads the log). Pasting it
        # into the response put an English sentence on an es-ES screen — LANGUAGE LAW §0.11 — so
        # the door now renders the verdict itself. Pinned here because it is exactly the kind of
        # leak that only shows up on the screen nobody screenshots.
        INTRUDER = "c0ffeec0ffeec0ffeec0ffeec0ffee11"      # uuid-shaped, seeded, not in the meta
        async with pool.acquire() as con:
            await con.execute("delete from orders where id=$1", INTRUDER)
            await con.execute(
                "insert into orders (id, phone_number, customer_name, status, lines, seeded) "
                "values ($1,'+34600000996','Fila ajena','needs_review','[]'::jsonb,true)", INTRUDER)
        r = await c.post("/api/sup/demo/reset", headers=_as(owner), json=CONFIRM)
        detail = str((r.json() or {}).get("detail") or "")
        ck("S10 a FOREIGN seed-marked row makes the DOOR refuse too — 409, nothing deleted",
           r.status_code == 409 and r.json().get("error") == "reset_refused",
           f"{r.status_code} {r.text[:110]}")
        ck("S10 …and the refusal is written in es-ES, naming the table in the boss's words",
           "pedido" in detail and "no se ha borrado nada" in detail, detail[:160])
        ck("S10 …with NOT ONE word of the seeder's English leaking onto a Spanish screen",
           not any(w in detail.lower() for w in
                   ("refuses", "seed mark", "the world", "reset_demo_seed", "look at them")),
           detail[:160])
        async with pool.acquire() as con:
            still = await con.fetchval("select count(*) from orders where id=$1", INTRUDER)
            await con.execute("delete from orders where id=$1", INTRUDER)
        ck("S10 …and the intruder row is still there — it refused BEFORE deleting anything",
           still == 1)
        ck("S10 …and so is everything else", await _seeded_shape() == before)

        # ── the read the button renders BEFORE it is armed ──────────────────────────────────────
        r = await c.get("/api/sup/demo", headers=_as(owner, csrf=False))
        st = r.json() if r.status_code == 200 else {}
        ck("S10 /api/sup/demo answers the founder's own session", r.status_code == 200,
           f"{r.status_code} {r.text[:90]}")
        ck("S10 …and says the world is here and CAN be reset",
           bool(st.get("seeded")) and bool(st.get("resettable")), str(st)[:140])
        counts = st.get("counts") or {}
        ck("S10 …and states BOTH sides of the same tables — what goes AND what stays (the sentence "
           "the control has to be able to write before it is pressed)",
           all(k in counts for k in ("orders", "messages", "customers", "catalogue", "review"))
           and all(k in counts for k in ("live_orders", "live_messages", "live_customers")),
           str(sorted(counts)))
        ck("S10 …and it counts the canary on the LIVE side, never the seeded one",
           int(counts.get("live_orders") or 0) >= 1 and int(counts.get("live_messages") or 0) >= 1,
           f"live_orders={counts.get('live_orders')} live_messages={counts.get('live_messages')}")

        r = await c.get("/api/sup/demo", headers=_as(alien, csrf=False))
        alien_st = r.json() if r.status_code == 200 else {}
        ck("S10 a foreign tenant's READ is honest, not an error screen: resettable=false, no counts",
           r.status_code == 200 and alien_st.get("resettable") is False
           and not (alien_st.get("counts") or {}), f"{r.status_code} {str(alien_st)[:110]}")

        # ── THE PRESS ──────────────────────────────────────────────────────────────────────────
        r = await c.post("/api/sup/demo/reset", headers=_as(owner), json=CONFIRM)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        ck("S10 THE PRESS: the founder's own session resets his own world in ONE call",
           r.status_code == 200 and body.get("ok") is True, f"{r.status_code} {str(body)[:160]}")
        alive_o, alive_m = await _alive()
        ck("S10 the UNSEEDED order survives the press (the one unforgivable failure, through the "
           "door this time)", alive_o == 1)
        ck("S10 the UNSEEDED message survives the press", alive_m == 1)
        ck("S10 the receipt is a per-table count of what went and what came back — never a bare ok",
           isinstance(body.get("removed"), dict) and isinstance(body.get("created"), dict)
           and int(body["removed"].get("orders") or 0) > 0, str(body.get("removed"))[:120])
        ck("S10 …and it NAMES what it deliberately left alone, so the founder never has to read the "
           "code to know what survives", isinstance(body.get("preserved"), list)
           and len(body["preserved"]) >= 3, str(len(body.get("preserved") or [])))
        ck("S10 the receipt is JSON-serialisable all the way down (no diagnostic blob rides the UI "
           "wire)", isinstance(json.loads(json.dumps(body)), dict))

        # ── press it TWICE. This is the thing Peter will actually do. ──────────────────────────
        shape1 = await _seeded_shape()
        r2 = await c.post("/api/sup/demo/reset", headers=_as(owner), json=CONFIRM)
        ck("S10 pressing it a SECOND time still succeeds (strict mode knows its own brain orders)",
           r2.status_code == 200, f"{r2.status_code} {r2.text[:200]}")
        shape2 = await _seeded_shape()
        det1 = {k: v for k, v in shape1.items() if not k.startswith("_")}
        det2 = {k: v for k, v in shape2.items() if not k.startswith("_")}
        ck("S10 …and twice leaves ONE world, not two — the seeder's own rows are IDENTICAL",
           det1 == det2, f"{det1} vs {det2}")
        # The brain half: duplication is the failure this check exists for. A second press replaying
        # the same conversations must not ADD a world's worth of orders on top of the first.
        ck("S10 …and the brain half did not DUPLICATE (a second press adds no second world)",
           shape2["_brain_orders"] <= shape1["_brain_orders"],
           f'{shape1["_brain_orders"]} → {shape2["_brain_orders"]} (model variance down is fine, up is not)')
        alive_o2, alive_m2 = await _alive()
        ck("S10 …and the unseeded canary is STILL there after both presses",
           (alive_o2, alive_m2) == (1, 1), f"{alive_o2}/{alive_m2}")

    # ── the audit trail: a destructive press that leaves no record is not a guarded press ───────
    async with pool.acquire() as con:
        rows = await con.fetch(
            "select tenant_slug, result from sup_audit where action='demo.reset' "
            "and ts >= $1 and actor_email = any($2::text[]) order by ts",
            run_t0, [OWNER_MAIL, ALIEN_MAIL])
    results = [r["result"] for r in rows]
    ck("S10 every press lands in the append-only sup_audit", results.count("ok") == 2, str(results))
    ck("S10 …and so does the REFUSED cross-tenant attempt (the forensic half)",
       "not_demo_tenant" in results, str(results))
    ck("S10 …and the audited tenant is the SESSION's, never one the caller chose",
       all(r["tenant_slug"] in (tenant, FOREIGN) for r in rows),
       str(sorted({r["tenant_slug"] for r in rows})))

    # Leave the clone tidy. `sup_audit` is deliberately NOT cleaned: it is append-only at the DB
    # level and trying to delete from it would fail — which is the property working, not a problem.
    async with pool.acquire() as con:
        await con.execute("delete from orders where id=$1", CANARY_O)
        await con.execute("delete from whatsapp_messages where id=$1", CANARY_M)
        await con.execute("delete from sup_session where actor_email = any($1::text[])",
                          [OWNER_MAIL, STAFF_MAIL, ALIEN_MAIL])
        try:
            await con.execute("delete from tenants where slug=$1", FOREIGN)
        except Exception:
            pass       # an audit row referencing it is allowed to keep it alive


print("\nS5/S6 · la mitad con base de datos")
if not DSN:
    for n in ("S5 reset refuses a foreign tenant", "S5 an unseeded row survives",
              "S5 reset is idempotent", "S6 the review sheet is non-empty and one-reason",
              "S8 the collision law (nothing unseeded is overwritten, and the skip is reported)",
              "S9 test data reads as test data in the order + review read models",
              "S10 the desk door (auth · CSRF · capability · wrong tenant · confirmation · audit)",
              "S5b switching worlds leaves exactly ONE world, and the unseeded row survives it",
              "S5c a colliding profile is refused, and the active one cannot be deleted"):
        skip(n, "sin REHEARSAL_DSN (los checks puros siguen siendo vinculantes)")
elif _refuses_live(DSN):
    print("  REFUSED: this vital writes and deletes — point it at a clone, never the live `rocoto` DB.")
    sys.exit(2)
else:
    try:
        asyncio.run(_db_checks())
    except Exception as e:                              # a broken clone is a FAIL, never a silent pass
        ck("S5/S6 the database half ran", False, f"{type(e).__name__}: {e}")

ok = sum(1 for r in R if r)
total = len(R)
print(f"\nvital_seedworld: {ok}/{total}" + (f" ({len(SKIPPED)} skipped)" if SKIPPED else ""))
sys.exit(0 if ok == total else 1)
