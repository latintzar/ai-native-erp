"""Test-data generator + seeder for owner-driven TEST MODE (TEST-MODE-AND-ACCESS spec §4).

The founder (an owner) walks the REAL signed-in onboarding wizard with disposable data, then clicks
"Fill with test data" — this module produces a schema-valid, coherent fake Spanish food producer /
distributor (business + catalogue + catchment + rules + voice + a synthetic onboarding call transcript)
and writes it, ALL marked is_test=true, into the same real structures a live supplier fills. It doubles
as a live-demo tool (walk a prospect through a populated onboarding in seconds), so the content must
read authentic.

Design (hybrid, per spec §4.2 — survives new wizard steps):
  1. DETERMINISTIC SKELETON — seeded stdlib `random` (no Faker dependency on the box) over curated
     Spanish data for the structural fields (program/catchment/times/voice_id/counts). Always valid,
     reproducible for a given seed.
  2. OPTIONAL HAIKU CONTENT — one forced-tool call (brain.llm.call_tool → schema-valid by construction)
     for the fields that must read real: business, 6–12 coherent SKUs, a couple of unmatched items, the
     accept/hold rules AND the call transcript, generated TOGETHER so the products match what's
     "mentioned" in the transcript. Falls back to a canned business when ANTHROPIC_API_KEY is unset or
     the call fails, so the button always works offline/cheap.
  3. VALIDATION GATE — a pydantic model with VALUE constraints (enum membership, HH:MM, [lng,lat]
     bounds), not just shape. Invalid fields are repaired deterministically; an invalid record is never
     written.

Isolation + safety live in brain/onboard_q.py: the multi-table wipe routes through the guarded
`wipe_test` (can't emit a predicate-less delete; count-verified). Test leads are minted with
supabase_user_id=NULL + owner_actor=<owner email> so they never collide with, or hijack, the owner's
LIVE identity-lead (see auth.py).
"""
from __future__ import annotations

import logging
import random
import re
import secrets
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

import config
import db
from brain import llm as _llm
from brain import onboard_q
from brain import onboarding as _ob

log = logging.getLogger("rocoto.testdata")

# ── Canonical enums MIRRORED from the frozen wizard contract (landing-react/src/wizard/data.ts). ──
# A drift test (tests/test_testdata.py) asserts these stay a subset of data.ts, so a new ERP/voice can't
# silently make the generator emit an invalid value.
PROGRAMS = ["sage50", "a3innuva", "holded", "quipu", "woocommerce", "shopify", "otro"]
UNITS = ["kg", "gramos", "piezas", "cajas", "docenas", "litros", "unidades"]
# The 17 real ElevenLabs shared-library voice ids; we PICK from the 4 España voices for a Spain demo but
# VALIDATE against the full set (a hand-set value from any real voice still passes the gate).
VOICE_IDS = [
    "ZW3xqMZ9b1jEKPdZ7X5e", "4v1uoUi065MedHZMinXC", "fdFVaHnG9EDnhRrXLo6O", "kkwhMpkWKv52v80GNaks",
    "tSdO3lUIODN7SK6eWVhu", "13VFWfJ7e20fmvmaqXWl", "DU6CgMQyKnGKapn9a2St", "a7NxsR5B1mpwgpVa10g3",
    "AuLamM8uqriA1XnmkRlT", "aZW91ASeaJuQl7yXe6Vk", "RO0BdeZ6XxVXOfbdD4H0", "5Q6EOtVLYf5DT7l2Xl6D",
    "BYmXbVNTpdEwMCcBbubj", "34EkeMY6ezBFj41NQj1f", "gBXbHGNePmWl9WrdHoCH", "awOajHsqRllBLH3sYn6Z",
    "gYGgQoUerVKyZkkHX9tY",
]
VOICE_IDS_ES = VOICE_IDS[:4]  # Ivan, Azu, Alberto, Antea — peninsular Spanish

# Real Madrid + Barcelona barrios with plausible [lng, lat] centres (GeoJSON order, matching
# CatchmentArea.center). The map renders a pin per barrio.
_MADRID = ("Madrid", [-3.70379, 40.41678], [
    ("Salamanca", [-3.6766, 40.4299]), ("Chamberí", [-3.7003, 40.4361]),
    ("Malasaña", [-3.7033, 40.4265]), ("La Latina", [-3.7115, 40.4109]),
    ("Retiro", [-3.6795, 40.4150]), ("Chamartín", [-3.6766, 40.4599]),
    ("Chueca", [-3.6977, 40.4224]), ("Lavapiés", [-3.7006, 40.4089]),
])
_BARCELONA = ("Barcelona", [2.16992, 41.38789], [
    ("Gràcia", [2.1589, 41.4028]), ("Eixample", [2.1620, 41.3888]),
    ("El Born", [2.1817, 41.3851]), ("Gòtic", [2.1770, 41.3833]),
    ("Sants", [2.1370, 41.3750]), ("Poblenou", [2.2000, 41.4036]),
    ("Sarrià", [2.1200, 41.3995]), ("Gràcia Nova", [2.1650, 41.4090]),
])
_CITIES = [_MADRID, _BARCELONA]
# Brand-adjacent swatch palette for the catchment pins (valid hex; mirrors the wizard's cycle intent).
_PALETTE = ["#C01B2C", "#2A8358", "#B04A2B", "#E3B84E", "#4E6E9E", "#8A5A9E"]

# Deterministic archetypes fed to Haiku so temp-0 output still VARIES per seed (a different business
# each click) while staying reproducible for a fixed seed.
_ARCHETYPES = [
    "un obrador de embutidos ibéricos en Guijuelo (jamón, chorizo, salchichón, lomo)",
    "una quesería artesana en Asturias (cabrales, quesos de mezcla, tabla de curados)",
    "un almacén de pescado y marisco fresco en Galicia que reparte a restaurantes",
    "una panadería-obrador que surte de pan y bollería a bares y cafeterías",
    "un distribuidor de frutas y verduras de proximidad para hostelería",
    "una bodega familiar que vende vino y vermut a bares de barrio",
    "un obrador de conservas y salazones en el Cantábrico (anchoas, bonito, mejillones)",
    "una carnicería-distribuidora de cordero y ternera de la sierra",
]


# ─────────────────────────── the validation gate (value constraints) ───────────────────────────

_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class WizardStateModel(BaseModel):
    """Validates the fields the generator SETS with real value constraints (enum membership, HH:MM,
    [lng,lat] bounds) — not just shape (an all-Optional shape would validate `{}`, catching nothing).
    Each validator no-ops on None so a per-STEP fill validates only the keys it produced. `extra=allow`
    because the React wizard owns other keys we merge alongside."""
    model_config = ConfigDict(extra="allow")

    program: Optional[str] = None
    voice_id: Optional[str] = None
    excel_send_time: Optional[str] = None
    waking_from: Optional[str] = None
    waking_to: Optional[str] = None
    catchment_center: Optional[list] = None
    catchment: Optional[list] = None
    products: Optional[list] = None

    @field_validator("program")
    @classmethod
    def _v_program(cls, v):
        if v is not None and v not in PROGRAMS:
            raise ValueError(f"program {v!r} not in {PROGRAMS}")
        return v

    @field_validator("voice_id")
    @classmethod
    def _v_voice(cls, v):
        if v is not None and v not in VOICE_IDS:
            raise ValueError(f"voice_id {v!r} not a real ElevenLabs voice")
        return v

    @field_validator("excel_send_time", "waking_from", "waking_to")
    @classmethod
    def _v_time(cls, v):
        if v is not None and not _HHMM.match(v):
            raise ValueError(f"time {v!r} is not HH:MM")
        return v

    @field_validator("catchment_center")
    @classmethod
    def _v_center(cls, v):
        if v is None:
            return v
        if not (isinstance(v, (list, tuple)) and len(v) == 2):
            raise ValueError("catchment_center must be [lng, lat]")
        lng, lat = float(v[0]), float(v[1])
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            raise ValueError("catchment_center out of [lng,lat] range")
        return [lng, lat]

    @field_validator("catchment")
    @classmethod
    def _v_catchment(cls, v):
        if v is None:
            return v
        for a in v:
            c = a.get("center") if isinstance(a, dict) else None
            if not (isinstance(c, (list, tuple)) and len(c) == 2
                    and -180 <= float(c[0]) <= 180 and -90 <= float(c[1]) <= 90):
                raise ValueError("catchment area has an invalid [lng,lat] center")
        return v


def validate_and_repair(state: dict) -> dict:
    """Validate `state` against the value constraints; on failure, deterministically repair the offending
    fields (never ship an invalid record) and re-validate. Returns the validated dict."""
    try:
        WizardStateModel(**state)
        return state
    except Exception as e:  # repair the known-constrained fields, then re-validate
        log.warning("testdata: repairing invalid fill (%s)", e)
        s = dict(state)
        if s.get("program") not in PROGRAMS:
            s["program"] = "sage50"
        if s.get("voice_id") not in VOICE_IDS:
            s["voice_id"] = VOICE_IDS_ES[0]
        for k, dflt in (("excel_send_time", "06:00"), ("waking_from", "07:00"), ("waking_to", "22:00")):
            if not (isinstance(s.get(k), str) and _HHMM.match(s[k])):
                s[k] = dflt
        c = s.get("catchment_center")
        if not (isinstance(c, (list, tuple)) and len(c) == 2):
            s["catchment_center"] = list(_MADRID[1])
        WizardStateModel(**s)  # raises if we still can't make it valid (a real bug)
        return s


# ─────────────────────────── deterministic skeleton ───────────────────────────

def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (name or "negocio").lower()).strip("-") or "negocio"


def _skeleton(rng: random.Random) -> dict:
    """Structural, always-valid fields from curated data + the seeded RNG."""
    city_name, city_center, barrios = rng.choice(_CITIES)
    picked = rng.sample(barrios, k=rng.randint(2, 3))
    catchment = [
        {"id": f"test-{i}-{_slug(n)}", "name": n, "center": list(c), "color": _PALETTE[i % len(_PALETTE)]}
        for i, (n, c) in enumerate(picked)
    ]
    return {
        "program": rng.choice(PROGRAMS),
        "entry_device": "desktop",
        "upload_mode": "desktop",
        "catalogue_submitted": True,
        "catalogue_legit": True,
        "catalogue_checking": False,
        "matching_status": "done",
        "catchment": catchment,
        "catchment_center": list(city_center),
        "excel_send_time": rng.choice(["05:30", "06:00", "07:00", "08:00"]),
        "waking_from": rng.choice(["06:00", "07:00", "08:00"]),
        "waking_to": rng.choice(["21:00", "22:00", "23:00"]),
        "voice_id": rng.choice(VOICE_IDS_ES),
        "tyc_accepted": True,
        "_city": city_name,  # internal hint for the Haiku prompt (stripped before persisting)
    }


# ─────────────────────────── Haiku content (forced tool) + canned fallback ───────────────────────────

_GEN_TOOL = {
    "name": "emit_test_business",
    "description": "Emit ONE realistic but fake Spanish food producer/distributor for test onboarding.",
    "input_schema": {
        "type": "object",
        "properties": {
            "business_name": {"type": "string", "description": "e.g. 'Embutidos La Dehesa'"},
            "contact_name": {"type": "string", "description": "the owner's full name"},
            "business_description": {"type": "string", "description": "one line, in Spanish"},
            "products": {
                "type": "array", "minItems": 6, "maxItems": 12,
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "unit": {"type": "string", "enum": UNITS},
                        "min": {"type": "number"},
                        "max": {"type": "number"},
                    },
                    "required": ["name", "unit", "min", "max"],
                },
            },
            "unmatched": {"type": "array", "items": {"type": "string"},
                          "description": "1-3 spoken items with no clear SKU"},
            "auto_accept_rules": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            "hold_rules": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            "transcript": {"type": "string",
                           "description": "a 2-4 min Spanish onboarding call between Peter (Rocoto) and "
                                          "the prospect: their business, what they sell, delivery area, "
                                          "how they take orders today, their pain. Products mentioned here "
                                          "MUST match `products`."},
        },
        "required": ["business_name", "contact_name", "business_description", "products",
                     "auto_accept_rules", "hold_rules", "transcript"],
    },
}

_SYSTEM = (
    "Generas datos de PRUEBA realistas (pero ficticios) para el alta de un proveedor de alimentación "
    "español en Rocoto, un empleado de ventas por IA. Todo debe sonar auténtico en español de España. "
    "El negocio vende a bares, restaurantes y tiendas. Devuelve SOLO mediante la herramienta."
)


def _canned(rng: random.Random, city: str) -> dict:
    """Deterministic fallback business (keyless / on Haiku failure) — the button always works."""
    prods = [
        {"name": "Jamón ibérico de bellota", "unit": "piezas", "min": 1, "max": 8},
        {"name": "Chorizo ibérico sarta", "unit": "kg", "min": 10, "max": 40},
        {"name": "Salchichón ibérico", "unit": "kg", "min": 8, "max": 30},
        {"name": "Lomo embuchado", "unit": "kg", "min": 5, "max": 20},
        {"name": "Morcilla de Burgos", "unit": "kg", "min": 5, "max": 25},
        {"name": "Panceta curada", "unit": "kg", "min": 4, "max": 18},
        {"name": "Fuet", "unit": "unidades", "min": 12, "max": 120},
        {"name": "Sobrasada", "unit": "kg", "min": 3, "max": 15},
    ]
    return {
        "business_name": "Embutidos La Dehesa",
        "contact_name": "Antonio Muñoz",
        "business_description": f"Obrador familiar de embutidos ibéricos que reparte a bares y "
                               f"restaurantes de {city}.",
        "products": prods,
        "unmatched": ["lo de siempre", "la caja mixta"],
        "auto_accept_rules": [
            "Cliente de siempre con pedido dentro de su rango habitual",
            "Antes de las 11:00 y por debajo de 200€",
        ],
        "hold_rules": [
            "Cliente nuevo o sin historial",
            "Más de 50 kg de golpe de un mismo producto",
        ],
        "transcript": (
            "Peter: Hola Antonio, gracias por sacar un rato. Cuéntame un poco, ¿qué es La Dehesa?\n"
            "Antonio: Pues mira, somos un obrador familiar aquí en la zona. Hacemos embutido ibérico "
            "—jamón, chorizo, salchichón, lomo— y repartimos sobre todo a bares y algún restaurante.\n"
            "Peter: ¿Y cómo te llegan los pedidos hoy?\n"
            "Antonio: Un lío, la verdad. Todo por WhatsApp y alguna llamada. Mi hija los va apuntando en "
            "una libreta y luego los pasa al Excel por la noche. Se nos escapa alguno.\n"
            "Peter: ¿Repartís por todo " + city + "?\n"
            "Antonio: Por el centro sobre todo, dos o tres barrios. Salimos con la furgoneta a media "
            "mañana, así que lo que entra antes de las once lo servimos ese día.\n"
            "Peter: Perfecto. ¿Qué es lo que más te preocupa?\n"
            "Antonio: Que no se me pierda ningún pedido y no tener que estar pegado al móvil. Si alguien "
            "pide una barbaridad rara, que me avises tú antes de mandarlo.\n"
            "Peter: Hecho. De eso me encargo yo."
        ),
    }


async def _content(rng: random.Random, city: str) -> dict:
    """Haiku content pass (varied by a seeded archetype); canned fallback when keyless or on failure."""
    if not config.ANTHROPIC_API_KEY:
        return _canned(rng, city)
    archetype = rng.choice(_ARCHETYPES)
    user = (
        f"Genera un negocio de prueba: {archetype}. Ciudad de reparto: {city}. "
        f"Entre 6 y 12 productos coherentes con ese negocio, con unidades y rangos min/max realistas. "
        f"1-2 reglas de auto-aceptación y 1-2 de retención en lenguaje natural. Un transcript de una "
        f"llamada de alta de 2-4 minutos donde se mencionen esos productos y su zona de reparto."
    )
    try:
        out = await _llm.call_tool(
            model=config.SCALE_READER_MODEL, system=_SYSTEM, user=user,
            tool=_GEN_TOOL, tool_name="emit_test_business", max_tokens=3000,
        )
        if out and isinstance(out.get("products"), list) and out.get("products"):
            return out
    except Exception:  # pragma: no cover — never let the button fail; fall back to canned
        log.exception("testdata: Haiku content pass failed — using canned fallback")
    return _canned(rng, city)


def _to_products(raw: list) -> list[dict]:
    """Coerce Haiku/canned product dicts to the frozen Product shape ({n,name,unit,min,max,source})."""
    out = []
    for p in raw or []:
        name = str(p.get("name") or "").strip()
        if not name:
            continue
        unit = p.get("unit") if p.get("unit") in UNITS else "kg"
        try:
            mn, mx = float(p.get("min", 1)), float(p.get("max", 10))
        except (TypeError, ValueError):
            mn, mx = 1, 10
        if mx < mn:
            mn, mx = mx, mn
        out.append({"n": name, "name": name, "unit": unit,
                    "min": round(mn), "max": round(mx), "source": "seed"})
    return out


# ─────────────────────────── the generator ───────────────────────────

async def generate_fill(scope: str = "all", seed: Optional[int] = None) -> dict:
    """Produce a validated fill. Returns {wizard_state, business, contact, email, transcript, seed}.
    `scope` = 'all' (full onboarding) or a step id (catalogue|products|catchment|excel|accept|hold|voice
    |waking) → only that step's keys. `seed` reproduces a fill (QA/screenshots); default random."""
    if seed is None:
        seed = secrets.randbits(30)
    rng = random.Random(seed)
    skel = _skeleton(rng)
    city = skel.pop("_city", "Madrid")
    # Per-step fills use the fast deterministic path; a full fill also pulls Haiku content (realism/demo).
    content = await _content(rng, city) if scope in ("all", "products", "catalogue") else _canned(rng, city)

    products = _to_products(content.get("products"))
    skus = [{"name": p["name"], "unit": p["unit"], "price": round(rng.uniform(3, 45), 2)} for p in products]
    business = str(content.get("business_name") or "Negocio de prueba").strip()
    contact = str(content.get("contact_name") or "").strip()
    email = f"test+{_slug(business)}@rocoto.test"

    full = {
        **skel,
        "catalogue_filename": f"catalogo_{_slug(business)}.xlsx",
        "catalogue_count": len(products),
        "skus": skus,
        "products": products,
        "unmatched": [str(x) for x in (content.get("unmatched") or [])][:4],
        "auto_accept_rules": [str(x) for x in (content.get("auto_accept_rules") or [])][:4] or None,
        "hold_rules": [str(x) for x in (content.get("hold_rules") or [])][:4] or None,
    }
    full = {k: v for k, v in full.items() if v is not None}

    # Slice to the requested scope so a per-step "Fill this step" only touches that step's keys.
    _SCOPE_KEYS = {
        "catalogue": ["program", "entry_device", "upload_mode", "catalogue_submitted", "catalogue_legit",
                      "catalogue_checking", "catalogue_filename", "catalogue_count", "skus"],
        "products": ["matching_status", "products", "unmatched", "skus"],
        "catchment": ["catchment", "catchment_center"],
        "excel": ["excel_send_time"],
        "accept": ["auto_accept_rules"],
        "hold": ["hold_rules"],
        "voice": ["voice_id"],
        "waking": ["waking_from", "waking_to"],
    }
    if scope != "all" and scope in _SCOPE_KEYS:
        state = {k: full[k] for k in _SCOPE_KEYS[scope] if k in full}
    else:
        state = full

    state = validate_and_repair(state)
    return {
        "wizard_state": state, "business": business, "contact": contact, "email": email,
        "transcript": str(content.get("transcript") or ""), "seed": seed,
    }


# ─────────────────────────── session / fill / wipe / status / audit ───────────────────────────

async def mint_test_session(owner_actor: str) -> dict:
    """Create a TEST lead (supabase_user_id=NULL + owner_actor so it never touches the owner's live
    identity-lead) + a test token, and return {token, url, lead_id, business}. The welcome screen shows
    a plausible business straight away; `fill` enriches it."""
    seed = secrets.randbits(30)
    rng = random.Random(seed)
    skel = _skeleton(rng)
    city = skel.get("_city", "Madrid")
    canned = _canned(rng, city)
    business = canned["business_name"]
    contact = canned["contact_name"]
    email = f"test+{_slug(business)}@rocoto.test"

    lead_id = f"lead_test_{uuid.uuid4().hex[:14]}"
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "insert into leads (id, phone, name, business, email, status, supabase_user_id, "
            "is_test, owner_actor) values ($1, NULL, $2, $3, $4, 'signed_up', NULL, true, $5)",
            lead_id, contact, business, email, (owner_actor or "").lower(),
        )
    token = await _ob.mint_token(lead_id, is_test=True)
    await _ob.log_event(lead_id, "test_session_created", {"owner": owner_actor, "business": business},
                        actor=(owner_actor or ""), is_test=True)
    base = _ob.PUBLIC_BASE_URL
    return {"token": token, "url": f"{base}/onboarding/{token}?test=1", "lead_id": lead_id,
            "business": business}


async def fill(token: str, scope: str = "all", seed: Optional[int] = None,
               owner_actor: str = "") -> Optional[dict]:
    """Generate + write an is_test fill for a TEST token. Returns the fresh full wizard_state, or None if
    the token is not an active TEST token (never fills a live token)."""
    token = (token or "").strip()
    pool = db.get_pool()
    async with pool.acquire() as con:
        tok = await con.fetchrow(
            "select lead_id, is_test from onboarding_tokens where token = $1 and status = 'active'", token)
    if not tok or not tok["is_test"] or not tok["lead_id"]:
        return None
    lead_id = tok["lead_id"]

    gen = await generate_fill(scope, seed)
    state = gen["wizard_state"]
    async with pool.acquire() as con, con.transaction():
        # Merge the fill into the existing wizard_state (preserve keys outside this scope). The
        # is_test column is never touched, so the immutability trigger passes.
        await con.execute(
            "update onboarding_progress set "
            "wizard_state = coalesce(wizard_state, '{}'::jsonb) || $2, "
            "version = version + 1, updated_at = now() where token = $1",
            token, state)
        # Enrich the TEST lead (guarded: is_test=true, so a live lead can never be touched here).
        await con.execute(
            "update leads set name = coalesce(nullif($2,''), name), "
            "business = coalesce(nullif($3,''), business), email = coalesce(nullif($4,''), email), "
            "updated_at = now() where id = $1 and is_test = true",
            lead_id, gen.get("contact", ""), gen.get("business", ""), gen.get("email", ""))
        # The synthetic onboarding call transcript. note_path='test://<token>' can never collide with
        # the real file-ingest idempotency key (which is a filesystem path), so ingest never re-touches it.
        if gen.get("transcript") and scope in ("all", "catalogue", "products"):
            await con.execute(
                "insert into calls_onboard (id, lead_id, phone, note_path, transcript, kind, is_test) "
                "values ($1, $2, '', $3, $4, 'test', true) "
                "on conflict (note_path) do update set transcript = excluded.transcript",
                f"call_test_{uuid.uuid4().hex[:14]}", lead_id, f"test://{token}", gen["transcript"])
    await _ob.log_event(lead_id, "test_fill", {"scope": scope, "seed": gen.get("seed")},
                        actor=(owner_actor or "owner"), is_test=False)
    async with pool.acquire() as con:
        ws = await con.fetchval("select wizard_state from onboarding_progress where token = $1", token)
    return dict(ws) if ws else state


# Wipe order: children before parents (no hard FKs, but tidy). (table, id_col to scope an owner wipe on).
_WIPE_TABLES = [
    ("events", "lead_id"), ("transcript_facts", "lead_id"), ("calls_onboard", "lead_id"),
    ("drip_state", "lead_id"), ("waitlist", "lead_id"), ("onboarding_progress", "token"),
    ("onboarding_tokens", "lead_id"), ("leads", "id"),
]


async def _scope_ids(con, owner_actor: str, scope: str) -> tuple[list[str], list[str]]:
    """Resolve the (test lead ids, test token ids) in scope. scope='all' → every test row; else the
    caller's own test leads (owner_actor)."""
    if scope == "all":
        leads = [r["id"] for r in await con.fetch("select id from leads where is_test = true")]
    else:
        leads = [r["id"] for r in await con.fetch(
            "select id from leads where is_test = true and owner_actor = $1", (owner_actor or "").lower())]
    tokens = []
    if leads:
        tokens = [r["token"] for r in await con.fetch(
            "select token from onboarding_tokens where is_test = true and lead_id = any($1::text[])", leads)]
    return leads, tokens


async def wipe(owner_actor: str, scope: str = "own", confirm: bool = True) -> dict:
    """Delete is_test rows. scope='own' (default — the caller's own test data) or 'all' (owner-only, all
    test data). confirm=False returns a DRY-RUN preview (counts of what WOULD be deleted, nothing
    deleted). Every delete goes through onboard_q.wipe_test (guarded, count-verified, can't touch live)."""
    scope = "all" if scope == "all" else "own"
    pool = db.get_pool()
    async with pool.acquire() as con:
        leads, tokens = await _scope_ids(con, owner_actor, scope)

        if not confirm:  # DRY RUN — count only, no transaction, no delete.
            counts: dict[str, int] = {}
            for table, idcol in _WIPE_TABLES:
                col = onboard_q.flag(table)
                if scope == "all":
                    counts[table] = int(await con.fetchval(
                        f"select count(*) from {table} where {col} = true") or 0)
                else:
                    ids = tokens if idcol == "token" else leads
                    counts[table] = 0 if not ids else int(await con.fetchval(
                        f"select count(*) from {table} where {col} = true and {idcol} = any($1::text[])",
                        list(ids)) or 0)
            return {"dry_run": True, "scope": scope, "leads": len(leads), "counts": counts,
                    "total": sum(counts.values())}

        deleted: dict[str, int] = {}
        async with con.transaction():
            for table, idcol in _WIPE_TABLES:
                if scope == "all":
                    deleted[table] = await onboard_q.wipe_test(con, table)
                else:
                    ids = tokens if idcol == "token" else leads
                    deleted[table] = await onboard_q.wipe_test(con, table, ids=ids, id_col=idcol)
    await _ob.log_event(None, "test_wipe", {"scope": scope, "deleted": deleted},
                        actor=(owner_actor or ""), is_test=False)
    return {"dry_run": False, "scope": scope, "deleted": deleted, "total": sum(deleted.values())}


async def status(owner_actor: str) -> dict:
    """Counts for the owner console + the caller's resumable test sessions."""
    owner_actor = (owner_actor or "").lower()
    pool = db.get_pool()
    async with pool.acquire() as con:
        test_leads = await con.fetchval("select count(*) from leads where is_test = true")
        my_leads = await con.fetchval(
            "select count(*) from leads where is_test = true and owner_actor = $1", owner_actor)
        test_tokens = await con.fetchval("select count(*) from onboarding_tokens where is_test = true")
        test_calls = await con.fetchval("select count(*) from calls_onboard where is_test = true")
        test_waitlist = await con.fetchval("select count(*) from waitlist where is_test = true")
        sessions = await con.fetch(
            "select l.id as lead_id, l.business, l.name, t.token, t.created_at "
            "from leads l join onboarding_tokens t on t.lead_id = l.id "
            "where l.is_test = true and l.owner_actor = $1 and t.status = 'active' "
            "order by t.created_at desc limit 20", owner_actor)
    return {
        "test_leads": int(test_leads or 0), "my_test_leads": int(my_leads or 0),
        "test_tokens": int(test_tokens or 0), "test_calls": int(test_calls or 0),
        "test_waitlist": int(test_waitlist or 0),
        "sessions": [{
            "lead_id": r["lead_id"], "business": r["business"] or "", "name": r["name"] or "",
            "token": r["token"], "url": f"{_ob.PUBLIC_BASE_URL}/onboarding/{r['token']}?test=1",
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        } for r in sessions],
    }


async def audit(limit: int = 50) -> list[dict]:
    """The owner/test audit trail — the owner-action events (test_fill/test_wipe/test_session_created)
    logged is_test=false so they SURVIVE a wipe. Newest first."""
    limit = max(1, min(int(limit or 50), 200))
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            "select id, lead_id, type, payload, actor, created_at from events "
            "where type in ('test_fill','test_wipe','test_session_created','owner_action') "
            "order by created_at desc limit $1", limit)
    return [{
        "id": r["id"], "lead_id": r["lead_id"], "type": r["type"],
        "payload": dict(r["payload"]) if r["payload"] else {}, "actor": r["actor"] or "",
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    } for r in rows]
