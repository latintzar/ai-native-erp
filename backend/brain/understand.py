"""The post-upload understand pass — colloquial call transcript ↔ uploaded SKUs (Opus 4.8).

This is the hard, reliable part of Rocoto onboarding. After a lead's catalogue is parsed into
`wizard_state.skus` (brain/skuparse.py) AND Peter's discovery call(s) have landed in `calls_onboard`,
this pass reads BOTH and produces the wizard's step-2 matching payload:

  - matches every product the customer SAID (colloquial: 'lo de siempre', nicknames, shorthand) to a
    REAL uploaded SKU — never inventing a SKU that isn't in the catalogue;
  - for each SKU, min/max/unit taken from the transcript where stated, else Opus's own JUDGMENT of a
    normal quantity for that product given everything else said (source='inferred', lower confidence);
  - the accept/hold rules the transcript reveals (sensible Spanish defaults when none stated),
    the daily excel send time, and the waking window — where heard.

ONE Claude Opus 4.8 forced-tool pass (sized prompt → won't time out), then a SILENT Haiku numeric
self-check (catches 18↔80 / mishear errors, corrects in place, NO 'unsure' card), then MERGES the
derived keys into onboarding_progress.wizard_state via jsonb `||` (merge-only — never clobbers the
blob the React wizard owns).

FAIL-SOFT ALWAYS: on a genuine error we set matching_status='error' via the SAME merge (never blank
the existing state) and return {"ok":False,"status":"error"}. We NEVER raise to the caller and NEVER
break the live sancho.service.

ADDITIVE + isolated: touches only the ONBOARD_SCHEMA tables (onboarding_tokens, calls_onboard,
onboarding_progress, events). Nothing here alters the live WhatsApp service.
"""
from __future__ import annotations

import asyncio
import json
import logging

import anthropic

import config
import db
import transcribe  # noqa: F401  (imported per the build contract; understand reads transcripts from DB)

log = logging.getLogger("rocoto.understand")

# unit vocabulary the wizard renders (FROZEN in the build contract). We coerce Opus's unit onto this.
_UNITS = {"kg", "gramos", "piezas", "cajas", "docenas", "litros", "unidades"}
_UNIT_ALIASES = {
    "kilo": "kg", "kilos": "kg", "kgs": "kg", "kilogramo": "kg", "kilogramos": "kg",
    "g": "gramos", "gr": "gramos", "grs": "gramos", "gramo": "gramos",
    "pieza": "piezas", "pza": "piezas", "pzas": "piezas", "pz": "piezas",
    "caja": "cajas", "box": "cajas", "boxes": "cajas",
    "docena": "docenas", "doc": "docenas", "dozen": "docenas",
    "litro": "litros", "l": "litros", "lt": "litros", "lts": "litros",
    "unidad": "unidades", "ud": "unidades", "uds": "unidades", "u": "unidades",
    "unit": "unidades", "units": "unidades", "pack": "cajas", "packs": "cajas",
}
_CONF = {"low", "medium", "high"}
_SRC = {"heard", "inferred"}

# Sensible fallback defaults when the LLM is unreachable (credits/overload) — the wizard must never
# leave the customer stuck; they review these + still reach the waitlist.
_DEFAULT_ACCEPT = [
    "Clientes habituales que piden lo de siempre",
    "Cantidad dentro de su rango normal",
    "Pedidos antes de tu hora de corte",
]
_DEFAULT_HOLD = [
    "Clientes nuevos o sin historial",
    "Cantidades muy por encima de lo normal",
    "Productos agotados o peticiones especiales",
]


def _default_minmax(unit: str) -> tuple[float, float]:
    u = _canon_unit(unit)
    if u in ("kg", "litros"):
        return (5, 30)
    if u == "gramos":
        return (500, 5000)
    return (1, 10)  # piezas / unidades / cajas / docenas


def _fallback_products(skus: list[dict]) -> list[dict]:
    """Build products straight from the parsed catalogue when the matcher can't run. Every SKU becomes
    a product with a default min/max (source='inferred', low confidence, flagged for review)."""
    out: list[dict] = []
    for i, s in enumerate(skus or []):
        if not isinstance(s, dict):
            continue
        name = (str(s.get("name") or "")).strip()
        if not name:
            continue
        unit = _canon_unit(s.get("unit"))
        mn, mx = _default_minmax(unit)
        code = (str(s.get("code") or "")).strip()
        out.append({
            "sku_id": code or str(i), "n": name, "name": name, "unit": unit,
            "min": mn, "max": mx, "confidence": "low", "source": "inferred",
        })
    return out

# ─────────────────────────── the Opus tool ───────────────────────────
_RECORD_UNDERSTANDING_TOOL = {
    "name": "record_understanding",
    "description": (
        "Record the understanding of a Spanish food producer-distributor's business, derived by "
        "matching the products they SAID in the discovery call to the REAL uploaded catalogue SKUs. "
        "Match colloquial spoken names ('lo de siempre', nicknames, shorthand) to the catalogue. "
        "NEVER invent a SKU that is not in the provided catalogue. For each matched SKU give a normal "
        "min/max order quantity: from the transcript where stated, otherwise YOUR OWN JUDGMENT of a "
        "sensible quantity for that product given everything else said (mark source='inferred')."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "products": {
                "type": "array",
                "description": "One entry per uploaded SKU the customer buys/mentions. Only real catalogue SKUs.",
                "items": {
                    "type": "object",
                    "properties": {
                        "sku_id": {
                            "type": "string",
                            "description": "the catalogue SKU code if it has one, else the SKU index (0-based) as a string. MUST be from the provided catalogue.",
                        },
                        "name": {"type": "string", "description": "the SKU's real catalogue display name"},
                        "unit": {
                            "type": "string",
                            "enum": sorted(_UNITS),
                            "description": "order unit for this SKU (kg|gramos|piezas|cajas|docenas|litros|unidades)",
                        },
                        "min": {"type": "number", "description": "normal minimum order quantity for this SKU"},
                        "max": {"type": "number", "description": "normal maximum order quantity for this SKU"},
                        "confidence": {"type": "string", "enum": ["low", "medium", "high"],
                                        "description": "how sure the match + quantities are"},
                        "source": {"type": "string", "enum": ["heard", "inferred"],
                                    "description": "'heard' = min/max stated in the call; 'inferred' = your own judgment of a normal quantity"},
                    },
                    "required": ["sku_id", "name", "unit", "min", "max", "confidence", "source"],
                },
            },
            "unmatched": {
                "type": "array",
                "items": {"type": "string"},
                "description": "products the customer clearly SAID that have NO matching catalogue SKU (verbatim as said).",
            },
            "auto_accept_rules": {
                "type": "array",
                "items": {"type": "string"},
                "description": "short Spanish rules for orders to auto-accept, as the call reveals; sensible Spanish defaults if none stated.",
            },
            "hold_rules": {
                "type": "array",
                "items": {"type": "string"},
                "description": "short Spanish rules for orders to HOLD for review, as the call reveals; sensible Spanish defaults if none stated.",
            },
            "excel_send_time": {
                "type": ["string", "null"],
                "description": "daily send time for the orders Excel as 'HH:MM' if heard in the call, else null.",
            },
            "waking_from": {
                "type": ["string", "null"],
                "description": "start of the hours the assistant answers, as 'HH:00' if heard, else null.",
            },
            "waking_to": {
                "type": ["string", "null"],
                "description": "end of the hours the assistant answers, as 'HH:00' if heard, else null.",
            },
        },
        "required": ["products", "unmatched", "auto_accept_rules", "hold_rules"],
    },
}

_SYSTEM = (
    "You set up an AI ordering assistant for a small Spanish family food producer-distributor "
    "(embutidos/charcutería, fruta-verdura, panadería). You are given: (1) the REAL product "
    "catalogue the business uploaded (each SKU with a code/index, name, family, unit, price) and "
    "(2) the transcript of a discovery phone call with them.\n\n"
    "Your job: match the products they SPOKE about — in informal Spanish, with nicknames, shorthand, "
    "'lo de siempre', partial names — to the REAL uploaded SKUs, and judge a normal order quantity "
    "for each. HARD RULES:\n"
    "- NEVER invent a SKU that is not in the uploaded catalogue. Every product you record MUST be one "
    "of the provided SKUs (use its code, or its 0-based index as a string, as sku_id).\n"
    "- A product they clearly mentioned but that is NOT in the catalogue goes in `unmatched` (verbatim).\n"
    "- min/max/unit: when the customer states a quantity for a product (e.g. 'unos treinta kilos', "
    "'cinco piezas'), that number is their TYPICAL order — set max to AT LEAST that stated amount "
    "(round to a clean number, a touch higher for busy days) and min to roughly HALF of it. NEVER set "
    "max below a quantity the customer clearly stated (source='heard'). When nothing is said for a "
    "product, use your OWN JUDGMENT of a normal min/max given the business (source='inferred', lower "
    "confidence). Keep the same scale the customer used (don't turn 30 kg into 3).\n"
    "- unit must be one of: kg, gramos, piezas, cajas, docenas, litros, unidades.\n"
    "- accept/hold rules, excel_send_time and the waking window: fill from the call where stated; for "
    "the rules give sensible Spanish defaults when the call says nothing; leave times null when not heard.\n"
    "Be decisive and complete — you have one pass."
)

# ─────────────────────────── the Haiku numeric self-check ───────────────────────────
_NUMCHECK_TOOL = {
    "name": "corrected_numbers",
    "description": (
        "Return the corrected numeric min/max for each product after re-reading the call transcript, "
        "silently fixing obvious speech-to-text mishears (e.g. 18 heard as 80, or vice versa) so the "
        "numbers match what the customer actually said. Keep the SAME products in the SAME order."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "products": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "sku_id": {"type": "string"},
                        "min": {"type": "number"},
                        "max": {"type": "number"},
                    },
                    "required": ["sku_id", "min", "max"],
                },
            },
        },
        "required": ["products"],
    },
}

_NUMCHECK_SYSTEM = (
    "You are a silent numeric proofreader. You are given a product order-quantity list and the call "
    "transcript it was derived from. Re-read the numbers against what the customer ACTUALLY said and "
    "return corrected min/max for every product: (1) fix speech-to-text digit mishears (18↔80, 15↔50, "
    "13↔30, 40↔14); (2) fix any min>max swap; (3) fix gross scale errors — if the customer clearly "
    "stated a quantity for a product (e.g. 'unos treinta kilos'), max MUST be at least that amount and "
    "min roughly half of it; never leave max far below a quantity that was clearly stated, and keep the "
    "customer's own scale (30 must not become 3). If a number is already right, keep it. Do NOT change "
    "units, add or remove products, or reorder them. Return the SAME products in the SAME order."
)


def _canon_unit(u) -> str:
    u = (str(u or "")).strip().lower()
    if u in _UNITS:
        return u
    return _UNIT_ALIASES.get(u, "unidades")


def _num(v, default: float = 0.0) -> float:
    try:
        n = float(v)
        if n != n or n in (float("inf"), float("-inf")):  # NaN / inf guard
            return default
        return n
    except (TypeError, ValueError):
        return default


def _hhmm(v):
    """Coerce to 'HH:MM' (00:00–23:59) or None."""
    if not v or not isinstance(v, str):
        return None
    s = v.strip()
    import re
    m = re.match(r"^(\d{1,2}):(\d{2})$", s)
    if not m:
        return None
    h, mm = int(m.group(1)), int(m.group(2))
    if 0 <= h <= 23 and 0 <= mm <= 59:
        return f"{h:02d}:{mm:02d}"
    return None


def _hh00(v):
    """Coerce to 'HH:00' (00:00–23:00) or None."""
    hh = _hhmm(v)
    if not hh:
        return None
    h = int(hh.split(":")[0])
    return f"{h:02d}:00"


def _sku_catalogue_block(skus: list[dict]) -> str:
    """Compact, sized rendering of the uploaded catalogue for the Opus prompt. Index is the fallback
    sku_id when a SKU has no code, so the model can always reference a real catalogue row."""
    lines = []
    for i, s in enumerate(skus or []):
        if not isinstance(s, dict):
            continue
        code = (str(s.get("code") or "")).strip()
        name = (str(s.get("name") or "")).strip()
        fam = (str(s.get("family") or "")).strip()
        unit = (str(s.get("unit") or "")).strip()
        price = s.get("price")
        ref = code or str(i)
        parts = [f"[{ref}] {name or '(sin nombre)'}"]
        if fam:
            parts.append(f"familia={fam}")
        if unit:
            parts.append(f"unidad={unit}")
        if price not in (None, ""):
            parts.append(f"precio={price}")
        lines.append("  " + " · ".join(parts))
    return "\n".join(lines)


def _valid_sku_ids(skus: list[dict]) -> set[str]:
    """Every acceptable sku_id: each SKU's code AND its 0-based index (as strings)."""
    ok: set[str] = set()
    for i, s in enumerate(skus or []):
        ok.add(str(i))
        if isinstance(s, dict):
            code = (str(s.get("code") or "")).strip()
            if code:
                ok.add(code)
    return ok


def _sku_by_id(skus: list[dict]):
    """Map any acceptable sku_id (code or index) → the SKU dict."""
    m: dict[str, dict] = {}
    for i, s in enumerate(skus or []):
        if not isinstance(s, dict):
            continue
        m[str(i)] = s
        code = (str(s.get("code") or "")).strip()
        if code:
            m[code] = s
    return m


# ─────────────────────────── the sync Opus/Haiku calls (run via to_thread) ───────────────────────────

def _understand_sync(catalogue_block: str, transcript: str) -> dict | None:
    """ONE Opus 4.8 forced-tool pass. Falls back to Haiku on overload. Returns the tool input dict,
    or None on failure. NEVER raises."""
    if not config.ANTHROPIC_API_KEY:
        return None
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=8, timeout=90.0)
    user = (
        "CATÁLOGO SUBIDO (SKUs reales — usa el código entre [] o el índice como sku_id):\n"
        f"{catalogue_block}\n\n"
        "TRANSCRIPCIÓN DE LA LLAMADA:\n"
        f"{transcript}\n\n"
        "Rellena record_understanding: empareja lo que dijeron con los SKUs reales, juzga min/max por "
        "producto, y extrae reglas de aceptación/retención, hora de envío del Excel y horario. "
        "Nunca inventes un SKU que no esté en el catálogo."
    )
    models = [config.UNDERSTAND_MODEL]
    fb = getattr(config, "ONBOARD_GATE_MODEL", "") or ""
    if fb and fb not in models:
        models.append(fb)
    resp = None
    for model in models:
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=4096,
                # NB: no temperature — claude-opus-4-8 rejects it ("deprecated for this model"); a
                # forced tool_choice already pins the output, so default sampling is correct.
                system=_SYSTEM,
                tools=[_RECORD_UNDERSTANDING_TOOL],
                tool_choice={"type": "tool", "name": "record_understanding"},
                messages=[{"role": "user", "content": user}],
            )
            break
        except (anthropic.OverloadedError, anthropic.RateLimitError, anthropic.APITimeoutError):
            log.warning("understand overloaded on %s; trying next model", model)
            continue
        except Exception:
            log.exception("understand call failed on %s", model)
            return None
    if resp is None:
        log.warning("understand unavailable (all models overloaded)")
        return None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and block.name == _RECORD_UNDERSTANDING_TOOL["name"]:
            return block.input
    return None


def _numcheck_sync(products: list[dict], transcript: str) -> dict | None:
    """Silent Haiku 18↔80 numeric self-check. Returns {sku_id: {min,max}} corrections, or None.
    NEVER raises — a failure just means we keep the Opus numbers."""
    if not config.ANTHROPIC_API_KEY or not products:
        return None
    # Sized payload: only the id + numbers the checker needs to reason over.
    slim = [{"sku_id": str(p.get("sku_id", "")), "name": p.get("name", ""),
             "unit": p.get("unit", ""), "min": p.get("min"), "max": p.get("max")}
            for p in products]
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=6, timeout=60.0)
    user = (
        "PRODUCTOS (revisa solo los números min/max):\n"
        f"{json.dumps(slim, ensure_ascii=False)}\n\n"
        "TRANSCRIPCIÓN:\n"
        f"{transcript}\n\n"
        "Devuelve corrected_numbers con los mismos productos en el mismo orden, corrigiendo mishears."
    )
    try:
        resp = client.messages.create(
            model=config.ONBOARD_GATE_MODEL,
            max_tokens=2048,
            system=_NUMCHECK_SYSTEM,
            tools=[_NUMCHECK_TOOL],
            tool_choice={"type": "tool", "name": "corrected_numbers"},
            messages=[{"role": "user", "content": user}],
        )
    except Exception:
        log.exception("numeric self-check failed; keeping Opus numbers")
        return None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and block.name == _NUMCHECK_TOOL["name"]:
            data = block.input or {}
            out: dict[str, dict] = {}
            for row in (data.get("products") or []):
                sid = str(row.get("sku_id", ""))
                if sid:
                    out[sid] = {"min": _num(row.get("min")), "max": _num(row.get("max"))}
            return out
    return None


# ─────────────────────────── DB helpers (isolated onboarding tables) ───────────────────────────

async def _load_context(token: str) -> tuple[str | None, list[dict], str]:
    """Return (lead_id, skus, joined transcript) for a token. lead_id None → token invalid/unknown."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        tok = await con.fetchrow("select lead_id, status from onboarding_tokens where token = $1", token)
        if not tok or not tok["lead_id"]:
            return None, [], ""
        lead_id = tok["lead_id"]
        prog = await con.fetchrow(
            "select wizard_state from onboarding_progress where token = $1", token)
        state = {}
        if prog and prog["wizard_state"]:
            ws = prog["wizard_state"]
            state = ws if isinstance(ws, dict) else (json.loads(ws) if isinstance(ws, str) else {})
        skus = state.get("skus") if isinstance(state.get("skus"), list) else []
        calls = await con.fetch(
            "select transcript, raw_transcript from calls_onboard "
            "where lead_id = $1 order by created_at asc",
            lead_id,
        )
    chunks: list[str] = []
    for c in calls:
        t = (c["transcript"] or "").strip() or (c["raw_transcript"] or "").strip()
        if t:
            chunks.append(t)
    transcript = "\n\n---\n\n".join(chunks)
    return lead_id, skus, transcript


async def _merge_state(token: str, patch: dict) -> None:
    """Merge-only update of wizard_state (jsonb ||). Never clobbers the blob the wizard owns. The
    build-contract SQL: pass a json.dumps'd dict, cast ::jsonb."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "update onboarding_progress set "
            "wizard_state = coalesce(wizard_state,'{}'::jsonb) || $2::jsonb, "
            "version = version + 1, updated_at = now() where token = $1",
            # Pass the dict directly — asyncpg's jsonb codec (db._init_conn) json-encodes it once.
            # (json.dumps here would double-encode → a quoted string → `{} || "str"` wraps to a LIST.)
            token, patch,
        )


async def _log_event(lead_id: str | None, type_: str, payload: dict | None = None) -> None:
    """Best-effort append to the onboarding events log. Never raises."""
    if not lead_id:
        return
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "insert into events (lead_id, type, payload, actor) values ($1,$2,$3,$4)",
                lead_id, type_, (payload or {}), "system",  # dict — jsonb codec encodes once
            )
    except Exception:
        log.exception("understand log_event failed (%s/%s)", lead_id, type_)


# ─────────────────────────── normalisation ───────────────────────────

def _normalise_products(raw_products, skus: list[dict]) -> tuple[list[dict], bool]:
    """Coerce Opus's products onto the frozen wizard shape, dropping any SKU that isn't in the
    catalogue (the anti-hallucination guard). Returns (products, any_dropped)."""
    valid = _valid_sku_ids(skus)
    by_id = _sku_by_id(skus)
    out: list[dict] = []
    dropped = False
    seen: set[str] = set()
    for p in (raw_products or []):
        if not isinstance(p, dict):
            continue
        sid = str(p.get("sku_id", "")).strip()
        if not sid or sid not in valid:
            dropped = True
            continue
        if sid in seen:
            continue
        seen.add(sid)
        sku = by_id.get(sid, {})
        # Display name: prefer the real catalogue name (never a hallucinated one), fall back to Opus's.
        name = (str(sku.get("name") or "")).strip() or (str(p.get("name") or "")).strip()
        unit = _canon_unit(p.get("unit") or sku.get("unit"))
        mn = _num(p.get("min"))
        mx = _num(p.get("max"))
        if mx < mn:  # keep min<=max sane
            mn, mx = mx, mn
        conf = (str(p.get("confidence") or "")).strip().lower()
        if conf not in _CONF:
            conf = "medium"
        src = (str(p.get("source") or "")).strip().lower()
        if src not in _SRC:
            src = "inferred"
        out.append({
            "sku_id": sid,
            "n": name,          # the built wizard renders p.n
            "name": name,       # new code reads p.name (both == display name, per contract)
            "unit": unit,
            "min": mn,
            "max": mx,
            "confidence": conf,
            "source": src,
        })
    return out, dropped


def _apply_numcheck(products: list[dict], corrections: dict | None) -> None:
    """Silently overwrite min/max with the Haiku-corrected numbers (in place). No 'unsure' card."""
    if not corrections:
        return
    for p in products:
        c = corrections.get(str(p.get("sku_id", "")))
        if not c:
            continue
        mn, mx = _num(c.get("min"), p["min"]), _num(c.get("max"), p["max"])
        if mx < mn:
            mn, mx = mx, mn
        p["min"], p["max"] = mn, mx


# ─────────────────────────── public API ───────────────────────────

async def understand(token: str) -> dict:
    """The post-upload Opus understand pass for one onboarding token.

    Reads the lead's discovery-call transcript(s) + the uploaded SKUs, runs ONE Opus 4.8 forced-tool
    pass, a silent Haiku 18↔80 numeric self-check, then MERGES the derived keys into
    onboarding_progress.wizard_state (jsonb ||, merge-only). Returns {"ok","status","products_count"}.

    Fail-soft: on any genuine error, sets matching_status='error' via the same merge (never blanks the
    existing state) and returns {"ok":False,"status":"error"}. Never raises.
    """
    token = (token or "").strip()
    if not token:
        return {"ok": False, "status": "error", "products_count": 0}

    # Load context (isolated onboarding tables). A DB hiccup here is a genuine error → mark + return.
    try:
        lead_id, skus, transcript = await _load_context(token)
    except Exception:
        log.exception("understand: load context failed for token")
        await _safe_error(token, None)
        return {"ok": False, "status": "error", "products_count": 0}

    if lead_id is None:
        # Unknown/invalid token — nothing to do, nothing to clobber. Non-leaking.
        return {"ok": False, "status": "error", "products_count": 0}

    if not skus:
        # No catalogue parsed yet: leave the state alone save for an explicit idle marker.
        try:
            await _merge_state(token, {"matching_status": "idle"})
        except Exception:
            log.exception("understand: idle merge failed")
        return {"ok": True, "status": "idle", "products_count": 0}

    # Mark running (best-effort — a failure here shouldn't abort the pass).
    try:
        await _merge_state(token, {"matching_status": "running"})
    except Exception:
        log.exception("understand: running merge failed (continuing)")

    # ── ONE Opus 4.8 forced-tool pass ──
    catalogue_block = _sku_catalogue_block(skus)
    try:
        data = await asyncio.to_thread(_understand_sync, catalogue_block, transcript)
    except Exception:
        log.exception("understand: Opus pass raised")
        data = None
    if data is None:
        # LLM unreachable (credits/overload/network). NEVER strand the customer: fall back to the
        # parsed SKUs with default min/max so they can review + still reach the waitlist.
        fb = _fallback_products(skus)
        if not fb:
            await _safe_error(token, lead_id)
            return {"ok": False, "status": "error", "products_count": 0}
        try:
            await _merge_state(token, {
                "matching_status": "partial", "products": fb, "unmatched": [],
                "auto_accept_rules": _DEFAULT_ACCEPT, "hold_rules": _DEFAULT_HOLD,
                "matching_fallback": True,
            })
        except Exception:
            log.exception("understand: fallback merge failed")
            await _safe_error(token, lead_id)
            return {"ok": False, "status": "error", "products_count": 0}
        await _log_event(lead_id, "understand_fallback", {"products_count": len(fb)})
        return {"ok": True, "status": "partial", "products_count": len(fb), "fallback": True}

    products, dropped = _normalise_products(data.get("products"), skus)

    # ── THE COLD SIGNUP (2026-07-27) ───────────────────────────────────────────────────────────
    # This pass is TRANSCRIPT-DRIVEN by design: its prompt says «empareja lo que dijeron con los SKUs
    # reales», so with an EMPTY transcript Opus correctly answers `products: []` — it was told to
    # match what the customer said, and the customer said nothing. That is right for the post-call
    # flow this was built for and WRONG for the acceptance test Peter actually states: sign up a new
    # customer, they upload their data, it works. A supplier who onboards without a discovery call
    # was landing on an EMPTY «Entendiendo tu gama» step with 34 parsed SKUs sitting one table away.
    #
    # So: no products + a real catalogue ⇒ the SAME deterministic fallback the model-unreachable
    # branch above already uses (`_fallback_products`: every parsed SKU with a sane default min/max
    # for its unit), marked `matching_fallback` so the wizard can say these are defaults to review
    # rather than something we claim to have heard. It never overrides a real match — it only fires
    # when the pass produced none — and the rules/hours Opus DID derive are kept.
    if not products and skus:
        products = _fallback_products(skus)
        if products:
            log.info("understand: no products matched (transcript %s) — defaulting %d parsed SKUs",
                     "empty" if not (transcript or "").strip() else "present", len(products))
            data = dict(data)
            data["_defaulted"] = True

    # ── silent Haiku 18↔80 numeric self-check (best-effort) ──
    if products and transcript:
        try:
            corrections = await asyncio.to_thread(_numcheck_sync, products, transcript)
        except Exception:
            log.exception("understand: numeric self-check raised (keeping Opus numbers)")
            corrections = None
        _apply_numcheck(products, corrections)

    # ── build the merge patch (only the keys we derive) ──
    unmatched = [str(x).strip() for x in (data.get("unmatched") or []) if str(x).strip()]
    auto_accept = [str(x).strip() for x in (data.get("auto_accept_rules") or []) if str(x).strip()]
    hold = [str(x).strip() for x in (data.get("hold_rules") or []) if str(x).strip()]
    status = "partial" if unmatched or dropped or data.get("_defaulted") else "done"

    patch: dict = {
        "matching_status": status,
        "products": products,
        "unmatched": unmatched,
        "auto_accept_rules": auto_accept,
        "hold_rules": hold,
    }
    if data.get("_defaulted"):
        # the wizard renders these as DEFAULTS TO REVIEW, never as «esto es lo que dijiste»
        patch["matching_fallback"] = True
    send_time = _hhmm(data.get("excel_send_time"))
    if send_time:
        patch["excel_send_time"] = send_time
    w_from = _hh00(data.get("waking_from"))
    if w_from:
        patch["waking_from"] = w_from
    w_to = _hh00(data.get("waking_to"))
    if w_to:
        patch["waking_to"] = w_to

    try:
        await _merge_state(token, patch)
    except Exception:
        log.exception("understand: final merge failed")
        await _safe_error(token, lead_id)
        return {"ok": False, "status": "error", "products_count": 0}

    await _log_event(lead_id, "understand_done", {
        "status": status, "products_count": len(products), "unmatched_count": len(unmatched)})
    return {"ok": True, "status": status, "products_count": len(products)}


async def _safe_error(token: str, lead_id: str | None) -> None:
    """Mark matching_status='error' via the merge (never blanks state). Best-effort."""
    try:
        await _merge_state(token, {"matching_status": "error"})
    except Exception:
        log.exception("understand: error-merge failed for token")
    await _log_event(lead_id, "understand_error", {})


async def propagate_correction(token: str, field: str, new_value) -> dict:
    """A wizard edit re-derives dependents (Sonnet). Real but simple: log the correction, and re-run
    the relevant cheap derivation where it's obviously dependent; otherwise just acknowledge.

    Fail-soft: never raises. Returns {"ok":True, ...}.
    """
    token = (token or "").strip()
    field = (field or "").strip()
    if not token or not field:
        return {"ok": True, "note": "noop"}

    # Resolve the lead for the audit log (best-effort, non-leaking).
    lead_id = None
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            row = await con.fetchrow(
                "select lead_id from onboarding_tokens where token = $1", token)
            if row:
                lead_id = row["lead_id"]
    except Exception:
        log.exception("propagate_correction: lead lookup failed")

    await _log_event(lead_id, "wizard_correction", {"field": field, "value": _jsonable(new_value)})

    # Cheap dependent re-derivations. The only dependency worth re-running here is a catalogue change:
    # if the SKUs themselves were edited, the product↔SKU match must be recomputed — delegate to the
    # full understand pass (itself fail-soft). Everything else is an independent wizard field: nothing
    # to re-derive, so we simply acknowledge (this keeps the pass fast and avoids surprise Opus spend).
    try:
        if field in ("skus", "catalogue", "catalogue_submitted"):
            res = await understand(token)
            return {"ok": True, "rederived": "products", "status": res.get("status")}
    except Exception:
        log.exception("propagate_correction: re-derive failed for %s", field)
        return {"ok": True, "rederived": "products", "status": "error"}

    return {"ok": True, "rederived": None}


def _jsonable(v):
    """Keep the audit payload JSON-safe without exploding on odd types."""
    try:
        json.dumps(v)
        return v
    except (TypeError, ValueError):
        return str(v)
