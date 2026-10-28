"""brain/stock.py — STOCK LEVELS, so «no hay stock» is a REASON and not a screen (SPEC §5.8a row 3).

`StockCaptureScreen` shipped before this module did: the app could photograph a shelf, read it back
and ask «¿Algún comentario?» — and then the numbers went nowhere. §5.8 names LOW_STOCK as one of the
exactly three things that may put an order in front of the comercial, and until levels are STORED
that source cannot fire. This module is that state.

THE CORRECTION LOOP IS THE FEATURE (Peter, §5.8b — "what Cal AI never gave you"):
    capture  →  WHAT ROCOTO READ  →  the boss corrects it by talking  →  APPLY  →  the level.
`record_capture` writes the read and touches no level. `apply_capture` takes the read back — possibly
corrected — writes the levels, flips `applied`, and remembers in `corrected` that it had to be fixed.
Applying first and asking later would destroy the only signal that tells us whether the reading is
any good, and it would put a number the boss never agreed to underneath a review reason.

INVENTORY IS OFF BY DEFAULT, PER TENANT — `tenants.inventory_enabled`. That is not a new mechanism:
it is exactly the `tenants.ecommerce_enabled` pattern already in this codebase (an opt-in boolean on
the tenant row, default false, read on the settings surface, toggled by an admin route). Chosen over
`agent_settings` (keyed by agent, not tenant — it cannot express "this distributor") and over a
manifest row (the manifest ladder carries BEHAVIOUR the runtime performs; whether a company counts
its stock is a fact about the company, not a duty). Consequence, and it is the rule:

    IF INVENTORY IS OFF, OR THE LINE'S SKU HAS NO LEVEL ROW, THAT LINE CANNOT BE SHORT.

Silence, never a guess. A distributor who has never counted a shelf must never see an order held for
«no hay stock» — an invented shortage is worse than no inventory at all, because it stops a real
order for a fact we made up. An empty `stock_levels` table therefore holds nothing, ever.

ONE REASON, NEVER A LIST (§5.8a tone law). Three short lines produce ONE sentence naming ONE item:
«no te queda suficiente PALETA COCIDA (quedan 4 kg, te piden 12)». The comercial needs to know what
to decide, not everything the system noticed.

Fail-soft on the READ path (a live turn is never taken down by the inventory table), never fail-soft
on the RULE: `apply_capture` raises rather than write one tenant's count onto another's shelf.

AND THE READING ITSELF LIVES HERE TOO (`read_capture`, 2026-07-27). Until today `/api/stock/capture`
took `read` as an INPUT from the client: the server never looked at the photograph or listened to the
note, `record_capture` faithfully stored whatever it was handed, and the screen's «lo que Rocoto ha
leído» sat above a list Rocoto had not produced. Seeded, it looked perfect; on a real pallet at six in
the morning it came back empty. `read_capture` is the missing sense — and it is in THIS module, not in
a route, because there are two doors onto it (the phone's machine-key rail and the desk's cookie rail)
and a reading that meant one thing on the phone and another on the desk would be two products.

AND THE MATCH IS NOW A THREE-WAY, SAID OUT LOUD (2026-07-27, second pass). Peter: "when they use the
inventory thing, if there's no matching, we need to match to an inventory item… There should be a
matching as well. We can use the same technology as the order brain." He is right that it is one
problem: a photographed pallet and a customer's «el jamoncito» are both a NAME that has to become a
catalogue row, so this uses the SAME machinery (`brain/matcher` — FTS floor + dense lift + rerank) and
the SAME laws (§5.7a: never invent a row, abstain rather than guess, ASK when two candidates are
genuinely close). Every read line now resolves to EXACTLY ONE of:

    MATCHED    one clear catalogue row. Counts against that SKU.
    AMBIGUOUS  the catalogue holds it, but we cannot tell WHICH row. Nobody may pick — the operator
               does. These lines are NOT in `read`, so `apply_capture` structurally cannot write a
               level from one.
    UNMATCHED  nothing in the catalogue matches. This is where the new capability lives: we OFFER TO
               CREATE THE ROW, and the offer is a question, never a write.

NO SECOND SET OF THRESHOLDS EXISTS. The bands are the order brain's own — `matcher.RERANK_CLEAR`
(.45), `matcher.RERANK_UNSURE` (.15), `matcher.MARGIN_TIGHT` (.12) — read through `matcher`'s
`band`/`tight`/`n_close` and classified by `doubt.classify_line`, the same function `brain/pipeline`
runs on a customer's order. `classify_stock_match` below is a MAPPING of that verdict onto these three
words, not a new opinion; the one judgement it adds is stated there and it is about WHO is standing
there, not about any number.

WHY A WRONG MATCH IS WORSE HERE THAN IN AN ORDER. An order is read back to the customer and passes a
comercial; a stock count is silent. A level written against the wrong SKU makes an order for THAT
product wrongly short (or wrongly available) days later, with nothing in the trail pointing back at
the pallet where it went wrong. So: `apply_capture` verifies every sku_id belongs to this tenant
before it writes, an ambiguous line writes nothing at all, and the operator can override any match —
the override is the point of the loop, not an escape hatch from it.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import unicodedata
from typing import Any, Dict, List, Optional

log = logging.getLogger("rocoto.brain.stock")

# The «me queda poco» threshold when the boss has not set one for that SKU. It is a FRACTION of the
# count itself — a quarter of what was last counted — and never an absolute number, because an
# absolute default is meaningless across units: 5 is a rounding error in kilos of potato and a
# fortnight of stock in whole lambs. It is applied ONCE, at the first capture, and stored in
# `stock_levels.low_at`, so the threshold is DATA per SKU (overridable, visible, the same religion as
# the delivery rule) and this constant is only its seed. A quarter of a full shelf is the point at
# which there is no longer room for another normal delivery day.
LOW_AT_FRACTION = 0.25
# Where a level comes from. `capture` = the photo loop; the rest exist so the row can always say who
# is responsible for the number a review reason is standing on.
SOURCES: tuple[str, ...] = ("capture", "voice", "manual", "import")


# ── pure helpers (no DB — the vital exercises the rule with nothing installed) ────────────────────
def _num(v: Any) -> Optional[float]:
    if isinstance(v, bool) or v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _es(v: float) -> str:
    """A quantity the way the boss writes it: «4», «4,5». Whole numbers lose the decimal (nobody
    counts 4,0 kg) and the separator is a comma, because this string is read in Spanish."""
    f = float(v)
    s = f"{f:.2f}".rstrip("0").rstrip(".")
    return (s or "0").replace(".", ",")


def _line_sku(ln: Dict[str, Any]) -> str:
    """The grounded SKU of a line, whichever shape it arrives in — a tabular order line carries
    `sku_id` directly; a pre-decision grounded line carries it under the matcher's pick."""
    sid = ln.get("sku_id") or ln.get("sku")
    if not sid:
        sid = ((ln.get("match") or {}).get("pick") or {}).get("sku_id")
    return str(sid or "")


def _line_name(ln: Dict[str, Any], level: Optional[Dict[str, Any]] = None) -> str:
    return str(ln.get("name") or ln.get("item") or ln.get("mention")
               or (level or {}).get("name") or _line_sku(ln) or "ese producto")


def is_low(level: Dict[str, Any]) -> bool:
    """«Te queda poco» — the Inventario/Hoy signal, distinct from SHORT. A level is low against its
    own threshold and knows nothing about any order; a line is short against the order in front of
    us. Only SHORT is a review reason (§5.8 LOW_STOCK); low is a nudge."""
    qty, low_at = _num(level.get("qty")), _num(level.get("low_at"))
    return qty is not None and low_at is not None and qty <= low_at


def seed_low_at(qty: Any) -> Optional[float]:
    """The threshold a first capture leaves behind when the boss has not set one (LOW_AT_FRACTION)."""
    q = _num(qty)
    return round(q * LOW_AT_FRACTION, 3) if q and q > 0 else None


def shortfalls(lines: List[Dict[str, Any]],
               levels: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Every line the levels say we cannot cover. Pure.

    A line is skipped — never short — when: it has no grounded SKU · its SKU has no level row (we
    have never counted it, so we know nothing) · it has no numeric qty · or its unit does not match
    the level's unit. That last one is deliberate: comparing 12 «cajas» against 40 «kg» needs a pack
    factor and a decision, and a review reason built on a guessed conversion is a reason we cannot
    defend to the boss. Silence, never a guess."""
    out: List[Dict[str, Any]] = []
    for ln in (lines or []):
        sku = _line_sku(ln)
        lvl = levels.get(sku) if sku else None
        if not lvl:
            continue
        want, have = _num(ln.get("qty")), _num(lvl.get("qty"))
        if want is None or have is None or want <= 0:
            continue
        lu = str(lvl.get("unit") or "").strip().lower()
        wu = str(ln.get("unit") or "").strip().lower()
        if lu and wu and lu != wu:
            continue
        if have >= want:
            continue
        out.append({"sku_id": sku, "name": _line_name(ln, lvl), "have": have, "want": want,
                    "unit": lvl.get("unit") or ln.get("unit") or ""})
    # Worst first: least COVERED (have/want), not biggest deficit — a deficit in kilos and a deficit
    # in units are not comparable numbers, but "we can cover a tenth of it" and "we can cover most of
    # it" are. Ties break on the larger absolute gap.
    out.sort(key=lambda s: (s["have"] / s["want"], -(s["want"] - s["have"])))
    return out


def short_reason(short: Dict[str, Any]) -> str:
    """The ONE es-ES reason, naming the ONE item — «no te queda suficiente PALETA COCIDA
    (quedan 4 kg, te piden 12)»."""
    unit = (f" {short['unit']}" if short.get("unit") else "")
    return (f"no te queda suficiente {short['name']} "
            f"(quedan {_es(short['have'])}{unit}, te piden {_es(short['want'])})")


def verdict(lines: List[Dict[str, Any]], levels: Dict[str, Dict[str, Any]], *,
            inventory_enabled: bool) -> Dict[str, Any]:
    """The rule, evaluated. Pure. Returns {ok, short, reason, inventory}.

    `ok` False means the order cannot be filled as asked and §5.8's LOW_STOCK source applies. With
    inventory OFF the answer is always ok=True and the levels are not even consulted — the feature
    being off is not a fact about this order."""
    if not inventory_enabled:
        return {"ok": True, "short": [], "reason": "", "inventory": False}
    short = shortfalls(lines, levels)
    return {"ok": not short, "short": short,
            "reason": short_reason(short[0]) if short else "", "inventory": True}


# ── the state ────────────────────────────────────────────────────────────────────────────────────
async def inventory_on(con, tenant: str) -> bool:
    """Is «Inventario» switched on for this distributor? `tenants.inventory_enabled`, default false.
    Unreadable, or no tenant row at all → OFF. The safe answer is the one that holds no orders."""
    try:
        return bool(await con.fetchval(
            "select inventory_enabled from tenants where slug = $1", tenant))
    except Exception:
        log.exception("stock: could not read inventory_enabled for %s — treating as OFF", tenant)
        return False


async def get_levels(con, tenant: str,
                     sku_ids: Optional[List[str]] = None) -> Dict[str, Dict[str, Any]]:
    """sku_id → level row for this tenant. `sku_ids=None` reads them all; a list reads only those
    (the order path asks for the handful it is holding). Fail-soft to {}: no levels means no line can
    be short, which is the same answer as never having counted."""
    try:
        if sku_ids is None:
            rows = await con.fetch(
                "select l.sku_id, l.qty::float8 as qty, l.unit, l.low_at::float8 as low_at, "
                "       l.source, l.captured_at, l.note, s.name "
                "  from stock_levels l left join catalogue_skus s on s.id = l.sku_id "
                " where l.tenant_id = $1", tenant)
        else:
            ids = [str(s) for s in dict.fromkeys(sku_ids) if s]
            if not ids:
                return {}
            rows = await con.fetch(
                "select l.sku_id, l.qty::float8 as qty, l.unit, l.low_at::float8 as low_at, "
                "       l.source, l.captured_at, l.note, s.name "
                "  from stock_levels l left join catalogue_skus s on s.id = l.sku_id "
                " where l.tenant_id = $1 and l.sku_id = any($2::text[])", tenant, ids)
    except Exception:
        log.exception("stock: could not read levels for %s — treating as NO levels", tenant)
        return {}
    out: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        d = dict(r)
        d["low"] = is_low(d)
        out[str(d["sku_id"])] = d
    return out


async def set_level(con, tenant: str, sku_id: str, qty: Any, unit: str = "kg", *,
                    low_at: Any = None, source: str = "capture",
                    note: str = "") -> Dict[str, Any]:
    """Write one level. The number is what somebody COUNTED — this table never infers a level from
    orders, because a level that drifts on its own would put a review reason on a fiction.

    `low_at` resolution, in order: the value passed in (the boss set it) → whatever the row already
    carries (a threshold he set before survives every later recount) → LOW_AT_FRACTION of this count
    (the seed, applied once). Explicit beats existing beats seed, and it is done in SQL so a
    concurrent capture cannot read-modify-write over a threshold."""
    q = _num(qty)
    if q is None or q < 0:
        raise ValueError("La cantidad tiene que ser un número (0 o más).")
    src = source if source in SOURCES else "manual"
    explicit = _num(low_at)
    r = await con.fetchrow(
        "insert into stock_levels (tenant_id, sku_id, qty, unit, low_at, source, captured_at, note) "
        "values ($1, $2, $3, $4, coalesce($5::numeric, $6::numeric), $7, now(), $8) "
        "on conflict (tenant_id, sku_id) do update set "
        "  qty = excluded.qty, unit = excluded.unit, "
        "  low_at = coalesce($5::numeric, stock_levels.low_at, $6::numeric), "
        "  source = excluded.source, captured_at = now(), note = excluded.note "
        "returning sku_id, qty::float8 as qty, unit, low_at::float8 as low_at, source, "
        "          captured_at, note",
        tenant, str(sku_id), q, (unit or "kg").strip() or "kg", explicit, seed_low_at(q),
        src, (note or "")[:400])
    d = dict(r)
    d["low"] = is_low(d)
    return d


# ── THE READING — a photograph and a spoken note become lines ────────────────────────────────────
# THE READ IS SYNCHRONOUS, and that is a decision, not an omission. The screen is
# camera → «¿Algún comentario?» → «lo que Rocoto ha leído» → Corregir hablando / Guardar: the
# operator is STANDING THERE holding a phone in front of a pallet, and the next thing he does is
# correct what we read. An async read would have to come back to a man who has walked away — it would
# need a notification, a place to land, and a second visit to a screen whose whole shape says "here
# is what I read, fix it" — and the correction loop, which is the feature, would be the thing we
# broke to save a few seconds. So he waits, with a hard ceiling on how long we may make him wait:
# past READ_TIMEOUT_SEC we stop and say so plainly rather than hold the phone. Vision costs money and
# time on every capture; a capture happens a handful of times a day per distributor, which is the
# cheapest thing in this product, and it is paid at the one moment the operator is willing to wait.
#
# THE CEILING IS 60s, AND IT IS MEASURED, NOT GUESSED. Against the real model on the prod box
# (`tests/fixtures/inventario_pizarra.jpg`, a ten-line stock board, sonnet-4-6 vision + the order
# extractor): 16.5s / 19.0s / 19.1s warm, 36.5s on the FIRST call after a restart (the Anthropic
# client, the pool and fastembed all load on it), and 2.9s for a voice-only capture. The first draft
# of this line said 30s — which would have cut the very first capture of every morning, and returned
# «he tardado demasiado» for a board it could read perfectly. A ceiling that fires on a good read is
# worse than no ceiling: it teaches the operator the feature does not work.
READ_TIMEOUT_SEC = float(os.environ.get("STOCK_READ_TIMEOUT_SEC") or 60.0)

# Where a line came from. These are VALUES THE OPERATOR READS (DESIGN-CANON's provenance law: he must
# be able to see where a number came from and correct it), so they are es-ES, like `reason` and `note`.
SRC_PHOTO, SRC_VOICE, SRC_BOTH = "foto", "voz", "foto+voz"

# What the existing OCR path is asked to look at. `transcribe.ocr_image_sync` already transcribes
# every number/unit/product name verbatim and describes the image when there is no text; this rides
# its `caption` hook so the SAME request tells it which of the four things it is looking at. We do not
# build a second vision request in this codebase.
VISION_CAPTION = (
    "Esto es un RECUENTO DE EXISTENCIAS en un almacén mayorista de charcutería en España. La imagen "
    "puede ser un palé, una estantería, una cámara frigorífica, una pizarra escrita a mano o un parte "
    "de existencias en papel. Di primero cuál de esas cosas es, en una línea. Después lista TODO lo "
    "que se pueda contar, una línea por producto, con CANTIDAD Y UNIDAD del oficio (cajas, piezas, "
    "kg, sartas, barquetas, ud). Cuenta las cajas o las piezas que se ven. Copia los nombres y los "
    "números tal cual aparecen, sin traducir ni corregir. Lo que no se vea con claridad, no lo pongas."
)

_LINE_SCHEMA = {
    "type": "object",
    "properties": {
        "item": {"type": "string", "description": "el producto TAL CUAL aparece o se dice"},
        "qty": {"type": "number", "description": "la cantidad; «dos cajas y media» = 2.5"},
        "unit": {"type": "string", "description": "caja | cajas | pieza | piezas | kg | sarta | barqueta | ud"},
        "said": {"type": "string", "description": "las palabras exactas de las que sale esta línea"},
    },
    "required": ["item", "qty", "unit"],
}
# A product the PHOTO shows but nobody put a number on — visible on the pallet, uncounted in either
# source. `qty` is deliberately ABSENT from this shape: forcing a number here is exactly what made
# `_LINE_SCHEMA` invent one, and asking the model to abstain instead is the same law `doubt.py`
# already runs for order lines (§5.7a). Whether one of these turns into a QUESTION (`needs_qty`, see
# `_qty_options`) is decided in `_read_capture`, not by the model — a voice line about the same
# product later in the pipeline still wins, exactly as `fuse()` already prefers voice over photo.
_UNSURE_SCHEMA = {
    "type": "object",
    "properties": {
        "item": {"type": "string", "description": "el producto TAL CUAL aparece en la foto"},
        "unit": {"type": "string", "description": "caja | cajas | pieza | piezas | kg | sarta | barqueta | ud — tu mejor estimación"},
        "why": {"type": "string", "description": "en pocas palabras, qué falta para contarlo (tapado, amontonado, cortado en piezas sueltas…)"},
    },
    "required": ["item", "unit"],
}
_READ_TOOL = {
    "name": "anotar_existencias",
    "description": "Anota, POR SEPARADO, lo que dice cada fuente sobre las existencias de hoy.",
    "input_schema": {
        "type": "object",
        "properties": {
            "photo_lines": {"type": "array", "items": _LINE_SCHEMA,
                            "description": "SÓLO lo que se ve en la foto CON un número claro. Vacía si no hay foto."},
            "voice_lines": {"type": "array", "items": _LINE_SCHEMA,
                            "description": "SÓLO lo que ha dicho el operario. Vacía si no ha dicho nada."},
            "unsure_qty": {"type": "array", "items": _UNSURE_SCHEMA,
                           "description": "Productos que SE VEN en la foto pero SIN un número claro de unidades — ni los pongas en photo_lines ni los omitas."},
        },
        "required": ["photo_lines", "voice_lines", "unsure_qty"],
    },
}
_READ_SYSTEM = (
    "Eres el ayudante de un almacén mayorista de charcutería en España. Te doy dos fuentes sobre las "
    "existencias de HOY: lo que se ve en una FOTO (ya transcrita) y lo que ha DICHO el operario que "
    "está delante del palé. Devuelve TRES listas independientes.\n"
    "REGLAS:\n"
    "· photo_lines y voice_lines: CANTIDAD Y UNIDAD SIEMPRE, leídas SÓLO de su propia fuente. Sin "
    "número claro, esa línea no va aquí — va en unsure_qty.\n"
    "· «dos cajas y media» = 2.5 cajas. «medio kilo» = 0.5 kg. «una docena» = 12.\n"
    "· unsure_qty: un producto que SE VE en la foto pero no se puede contar con seguridad (amontonado, "
    "tapado, cortado en piezas sueltas de tamaño distinto…). No le pongas un número — dilo en `why`.\n"
    "· Copia el nombre del producto TAL CUAL — no lo traduzcas, no lo normalices, no le inventes un "
    "calibre ni un formato que nadie ha dicho.\n"
    "· NUNCA copies una línea de una fuente a la otra, ni siquiera si dicen lo mismo. Quién lo dijo "
    "es justo lo que hay que saber.\n"
    "· Si el operario CORRIGE la foto («no son cuatro cajas, son cuarenta kilos»), la línea corregida "
    "va en voice_lines con la cantidad que él dice, y la de la foto se queda como está en photo_lines.\n"
    "· No inventes productos. Si una fuente no dice nada, su lista va vacía."
)

# The «AskUserQuestion shape» (avisos.py's own phrase for it), applied to a quantity instead of an
# outcome — same 2–4 options + a free-text escape, different content and a different guard: avisos'
# `_clean` DROPS any option carrying a figure the source material did not contain, which is exactly
# backwards here (the whole reason a line reaches this path is that NEITHER source gave a number, so
# every option is necessarily a number the model is proposing, not repeating).
QTY_MIN_OPTIONS = 2
QTY_MAX_OPTIONS = 4
QTY_OPTIONS_TIMEOUT_S = 4.0
QTY_CUSTOM_ID = "otra"

_QTY_TOOL = {
    "name": "proponer_cantidades",
    "description": "Propón 3 cantidades típicas de este producto para un mayorista de charcutería, de menor a mayor.",
    "input_schema": {
        "type": "object",
        "properties": {
            "pregunta": {"type": "string", "description": "una pregunta corta, en español de España, p.ej. «¿Cuántas cajas de chorizo hay?»"},
            "cantidades": {
                "type": "array",
                "items": {"type": "string", "description": "una cantidad con su unidad, p.ej. «2 cajas» — menos de 20 caracteres"},
                "description": "2 o 3 cantidades típicas, de menor a mayor",
            },
        },
        "required": ["pregunta", "cantidades"],
    },
}
_QTY_SYSTEM = (
    "Eres el ayudante de un almacén mayorista de charcutería en España. Te doy un producto que se ve "
    "en una foto de existencias pero sin un número claro de unidades. Propón una pregunta corta y 2 o "
    "3 cantidades típicas que ese producto podría tener en un almacén así, de menor a mayor.\n"
    "REGLAS:\n"
    "· La pregunta y cada cantidad, en español de España, cortas y legibles de un vistazo.\n"
    "· Cada cantidad lleva su unidad (p.ej. «2 cajas», «5 kg»), nunca un número suelto.\n"
    "· No propongas «Otra cantidad»: eso ya está puesto."
)


def _qty_fallback(unit: str) -> Dict[str, Any]:
    """No model, a timeout, or junk back → the generic ladder for that unit. Never blocks the
    capture: a question the operator cannot answer would be worse than no question at all, and this
    guarantees there is always something answerable under his thumb.

    Singular on «1» — «1 cajas» reads as broken Spanish on the one option every ladder starts with.
    `_unit_key` already strips a trailing «s» for exactly this kind of unit-word comparison, so it
    doubles here as the singulariser."""
    u = (unit or "ud").strip() or "ud"
    one = _unit_key(u) or u
    return {"question": f"¿Cuántas {u} hay?", "options": [f"1 {one}", f"2 {u}", f"3 {u}"]}


async def _ask_qty_model(item: str, unit: str) -> Optional[Dict[str, Any]]:
    import config
    if not getattr(config, "ANTHROPIC_API_KEY", ""):
        return None
    from brain import llm
    model = getattr(config, "AVISO_OPTIONS_MODEL", "") or config.VOICE_CHAT_MODEL
    user = f"PRODUCTO: {item}\nUNIDAD ESTIMADA: {unit or '(sin estimar)'}"
    return await llm.call_tool(model, _QTY_SYSTEM, user, _QTY_TOOL, _QTY_TOOL["name"],
                               max_tokens=300, fallback=getattr(config, "ORDER_EXTRACT_FALLBACK_MODEL", None))


async def qty_options(item: str, unit: str) -> Dict[str, Any]:
    """THE QUESTIONNAIRE for one uncounted photo line: a short question + 2–4 tappable quantities +
    an «Otra cantidad» that always opens free text. Fail-soft exactly like `avisos.generate_options`
    (no key, a dead model, a slow model, junk back — all land on `_qty_fallback`, never an exception,
    never a hang) — this is Rocoto proposing the shape of an answer, not deciding the count; the
    operator's own number always wins, whichever option (including the free one) he picks."""
    item = (item or "").strip()
    if not item:
        return _qty_fallback(unit)
    raw: Any = None
    try:
        raw = await asyncio.wait_for(_ask_qty_model(item, unit), timeout=QTY_OPTIONS_TIMEOUT_S)
    except asyncio.TimeoutError:
        log.debug("stock.qty_options: model slower than %ss — the fallback ladder stands", QTY_OPTIONS_TIMEOUT_S)
    except Exception:
        log.debug("stock.qty_options fail-soft — the fallback ladder stands", exc_info=True)
    question = _one_line(raw.get("pregunta")) if isinstance(raw, dict) else ""
    opts: List[str] = []
    if isinstance(raw, dict):
        for c in (raw.get("cantidades") or []):
            label = _one_line(c)
            if label and len(label) <= 24 and label not in opts:
                opts.append(label)
            if len(opts) >= QTY_MAX_OPTIONS - 1:      # room is always left for «Otra cantidad»
                break
    if not question or len(opts) < QTY_MIN_OPTIONS:
        fb = _qty_fallback(unit)
        return fb if not opts else {"question": question or fb["question"], "options": opts}
    return {"question": question, "options": opts}


def _one_line(v: Any) -> str:
    """A model field, made safe to show: one line, no leading/trailing junk. Mirrors `avisos._one_line`
    — kept local rather than imported so this module still has no dependency on `avisos`."""
    return " ".join(str(v or "").split()).strip()

# The es-ES sentences a failed reading comes back with. They say WHAT HAPPENED and what to do next,
# and there is never a fabricated line underneath one of them (§5.8a: silence, never a guess).
NOTE_NOTHING = "No he recibido ni foto ni nota, así que no he leído nada."
NOTE_NO_MODEL = "Ahora mismo no puedo leer la foto ni la nota. Dime qué hay y lo apunto."
NOTE_SLOW = "He tardado demasiado en leerlo. Vuelve a intentarlo, o dímelo hablando y lo apunto."
NOTE_UNREADABLE = "No he sabido leer la foto. Dime qué hay y lo apunto."
NOTE_NO_CATALOGUE = "Todavía no tengo tu catálogo cargado, así que no puedo cuadrar lo que leo con tus productos."


def _empty_read(note: str) -> Dict[str, Any]:
    """A reading that produced nothing, in the SAME shape as one that produced everything — all FOUR
    lists present and empty. A client that has to check whether a key exists before deciding what
    happened will eventually forget to, and the failure of that check looks exactly like an empty
    shelf. The `note` is the only thing that says what went wrong, and it is always a sentence."""
    return {"read": [], "ambiguous": [], "unmatched": [], "needs_qty": [], "note": note}


def client_supplied(read: Any) -> bool:
    """Did the CLIENT hand us a reading, or does it want one? The one rule both capture routes obey,
    named here so it cannot come to mean two things behind two doors.

    A NON-EMPTY list is the CORRECTION PATH: the app posts back the lines the operator fixed by
    talking, and re-reading them would be arguing with the man holding the pallet — they are honoured
    verbatim and no model is called. Absent, null, [] or anything that is not a list means READ IT.

    EMPTY COUNTS AS ABSENT, and that is the load-bearing half: the shipped Android client always
    sends `read` and always sends it `[]` (`ApiClient.stockCapture` defaults it to `emptyList()`), so
    a contract keyed on the field's PRESENCE would have left the phone with exactly the silence it
    had before the reading existed. An empty list has never meant "I counted nothing" here — a
    capture that genuinely reads nothing comes back with a `note` saying so."""
    return isinstance(read, list) and len(read) > 0


def media_bytes(image_url: str) -> tuple:
    """The bytes behind one of OUR OWN `/media/<name>` URLs → (bytes, mime), or (b"", "").

    A capture posted as JSON carries a URL and the reading needs the PIXELS, so this resolves it —
    but ONLY inside this box's own media directory, fenced exactly the way the `/media/{fname}` route
    is fenced. We deliberately do NOT fetch an arbitrary URL: a server that dereferences whatever a
    client hands it is an SSRF, and «lee esta foto» is not worth making the backend a proxy for the
    client's network. A remote URL therefore reads as NO PHOTO — the capture still happens, and the
    spoken note alone is a complete capture. It lives here, beside the reading, so the phone rail and
    the desk rail resolve a photograph the same way."""
    tail = str(image_url or "").rsplit("/media/", 1)
    if len(tail) != 2:
        return b"", ""
    fname = tail[1].split("?")[0].split("#")[0]
    if not fname or "/" in fname or ".." in fname:
        return b"", ""
    try:
        from pathlib import Path

        import config
        p = Path(config.MEDIA_DIR) / fname
        if not p.is_file():
            return b"", ""
        mime = {".png": "image/png", ".webp": "image/webp",
                ".gif": "image/gif"}.get(p.suffix.lower(), "image/jpeg")
        return p.read_bytes(), mime
    except Exception:
        log.exception("stock: could not read local media for %r", image_url)
        return b"", ""


def _unit_key(u: Any) -> str:
    """A unit reduced to what makes two mentions of it THE SAME WORD — lowercase, unaccented, and
    without the plural 's', so «2 cajas» from the voice and «2 caja» from the board are one line.

    USED ONLY INSIDE THE READING, to decide whether the photo and the voice are talking about the
    same measure. It is deliberately NOT used by `shortfalls`, which still compares units raw: this
    one is allowed to be generous because the operator is about to see the result and correct it,
    and that one is not, because nobody sees a review reason before it holds an order."""
    s = unicodedata.normalize("NFKD", str(u or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s[:-1] if len(s) > 2 and s.endswith("s") else s


def _item_key(name: Any) -> str:
    """Same idea as `_unit_key`, for a product NAME: lowercase, unaccented, trimmed. Used ONLY to
    decide whether an `unsure_qty` photo line is the SAME product a voice line already counted (in
    which case the voice count wins outright, same as `fuse()`'s own rule, and no question is asked
    about something the operator already told us)."""
    s = unicodedata.normalize("NFKD", str(name or "").strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def _clean_unsure(raw: Any) -> List[Dict[str, Any]]:
    """The model's `unsure_qty` list, reduced to lines worth asking about: a name, at minimum."""
    out: List[Dict[str, Any]] = []
    for it in (raw or []):
        if not isinstance(it, dict):
            continue
        item = str(it.get("item") or "").strip()
        if not item:
            continue
        out.append({"item": item, "unit": str(it.get("unit") or "").strip().lower(),
                    "why": str(it.get("why") or "").strip()})
    return out


def _clean_lines(raw: Any, source: str) -> List[Dict[str, Any]]:
    """The model's list, reduced to lines we can stand behind: a name, a positive number, a unit."""
    out: List[Dict[str, Any]] = []
    for it in (raw or []):
        if not isinstance(it, dict):
            continue
        item = str(it.get("item") or "").strip()
        q = _num(it.get("qty"))
        if not item or q is None or q < 0:
            continue          # no number, no line — a count without a quantity is not a count
        out.append({"item": item, "qty": float(q), "unit": str(it.get("unit") or "").strip().lower(),
                    "said": str(it.get("said") or "").strip(), "source": source})
    return out


def _collapse(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Two rows of the same product, in the same unit, from the SAME source, are one quantity — a
    shelf photographed with «3 cajas» on one level and «2 cajas» on another holds five. Different
    units stay two lines: 12 cajas and 40 kg of the same thing needs a pack factor and a decision,
    which is exactly the conversion `shortfalls` already refuses to guess."""
    out: List[Dict[str, Any]] = []
    seen: Dict[tuple, Dict[str, Any]] = {}
    for ln in lines:
        key = (_unit_key(ln["item"]), _unit_key(ln["unit"]))
        prev = seen.get(key)
        if prev is None:
            seen[key] = ln
            out.append(ln)
        else:
            prev["qty"] = round(prev["qty"] + ln["qty"], 3)
            if ln.get("said") and ln["said"] not in prev.get("said", ""):
                prev["said"] = (prev.get("said", "") + " · " + ln["said"]).strip(" ·")
    return out


def fuse(photo_lines: List[Dict[str, Any]], voice_lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """ONE reading built from BOTH senses, and THE SPOKEN NOTE WINS on conflict — because a person
    standing in front of the pallet beats a photograph of it. He can see round the back of the stack,
    he knows the half-empty box is half-empty, and «de jamón cocido quedan dos cajas y media» is
    frequently the whole truth the camera never had.

    This is a rule IN CODE, not an instruction in a prompt: the two sources are read independently
    (that is what `_READ_TOOL` asks for) and merged HERE, so the precedence is deterministic and can
    be asserted without a model. A product named by both keeps the SPOKEN quantity and unit, is
    stamped `foto+voz`, and carries the photo's losing numbers in `photo_qty` / `photo_unit` with
    `conflict` set — the operator must be able to see that we overrode the picture and why."""
    merged: List[Dict[str, Any]] = []
    index: Dict[str, Dict[str, Any]] = {}
    for ln in _collapse(photo_lines):
        ln = dict(ln)
        ln["source"] = SRC_PHOTO
        merged.append(ln)
        index.setdefault(_unit_key(ln["item"]), ln)
    for ln in _collapse(voice_lines):
        key = _unit_key(ln["item"])
        prev = index.get(key)
        if prev is None:
            ln = dict(ln)
            ln["source"] = SRC_VOICE
            merged.append(ln)
            index[key] = ln
            continue
        same = (abs(prev["qty"] - ln["qty"]) < 1e-9
                and _unit_key(prev["unit"]) == _unit_key(ln["unit"]))
        prev["photo_qty"], prev["photo_unit"] = prev["qty"], prev["unit"]
        prev["qty"], prev["unit"] = ln["qty"], ln["unit"]      # THE SPOKEN NOTE WINS
        prev["source"] = SRC_BOTH
        prev["conflict"] = not same
        if ln.get("said"):
            prev["said"] = ln["said"]                          # the words that decided it
        # He spoke about the PRODUCT, so any other photo row for the same product is superseded too —
        # a shelf photographed as «4 cajas» here and «12 kg» there, then settled out loud, is ONE
        # answer, not one answer and a leftover.
        merged = [m for m in merged if m is prev or _unit_key(m["item"]) != key]
    return merged


# ── the three seams the vital stubs (a model must never be the reason a vital is flaky) ──────────
async def _vision_text(image_bytes: bytes, mime: str) -> str:
    """The photograph, through the OCR path this codebase already has. Returns '' when there is
    nothing to read — and '' is also what a failure looks like from in here, which is precisely why
    the caller never turns '' into a line."""
    import transcribe
    try:
        out = await asyncio.to_thread(transcribe.ocr_image_sync, image_bytes, mime, VISION_CAPTION)
    except Exception as e:                      # ocr_image_sync swallows, but the seam must not
        _note_model_fail(e)
        log.exception("stock: vision pass raised")
        return ""
    if out:
        _note_model_ok()                        # a real call succeeded — /healthz gets it for free
    return out or ""


async def _extract_lines(ocr_text: str, transcript: str) -> Optional[Dict[str, Any]]:
    """OCR text + the spoken note → two independent lists. Same models as the order brain's
    extractor, because it is the same job: turn what somebody said into lines with numbers.
    `brain/llm.call_tool` already reports every outcome to `mindcheck`."""
    import config
    from brain import llm
    user = ("LO QUE SE VE EN LA FOTO (transcrito):\n"
            + (ocr_text.strip() or "(no hay foto, o no se ha podido leer nada de ella)")
            + "\n\nLO QUE HA DICHO EL OPERARIO:\n"
            + (transcript.strip() or "(no ha dicho nada)"))
    return await llm.call_tool(config.ORDER_EXTRACT_MODEL, _READ_SYSTEM, user, _READ_TOOL,
                               _READ_TOOL["name"], max_tokens=2048,
                               fallback=config.ORDER_EXTRACT_FALLBACK_MODEL)


async def _ground(tenant: str, mention: str, unit: str, qty: Optional[float]) -> Dict[str, Any]:
    """A NAME becomes a SKU the ONE way it becomes a SKU in this product: `brain/matcher.match` —
    alias → dense → sparse → cross-encoder rerank → the three confidence bands. Nothing here invents
    an id, and nothing here has a second opinion about what «paleta» means.

    It returns the matcher's FULL signal set, not a summary. `tight` and `n_close` in particular are
    what tell AMBIGUOUS from UNMATCHED, and `n_close` is only correct when it comes from the matcher —
    it is counted there over the WHOLE candidate pool, and re-deriving it from a truncated list would
    quietly turn a nine-way tie into a two-way choice. `candidates` is widened from 3 to APP_CANDIDATES
    for the same reason: the operator has a screen, and the reason for a short list somewhere else is
    a WhatsApp button limit, not a fact about the doubt (see `classify_stock_match`)."""
    from brain import matcher
    r = await matcher.match(mention, unit_hint=unit or None, qty=qty, tenant=tenant)
    pick = r.pick or {}
    return {"sku_id": str(pick.get("sku_id") or ""), "name": str(pick.get("name") or ""),
            "code": pick.get("code"), "family": pick.get("family") or "",
            "base_unit": pick.get("base_unit") or "", "price": pick.get("price"),
            "band": r.band, "score": round(float(r.pick_score), 4), "alias": bool(r.alias_hit),
            "tight": bool(r.tight), "n_close": int(r.n_close or 1),
            "margin": round(float(r.margin), 4),
            "unit_ok": bool(r.unit_ok), "unit_note": r.unit_note,
            "candidates": [{"sku_id": c.get("sku_id"), "name": c.get("name"),
                            "code": c.get("code"), "family": c.get("family") or "",
                            "base_unit": c.get("base_unit") or "",
                            "score": c.get("score")} for c in (r.candidates or [])[:APP_CANDIDATES]]}


def _note_model_ok() -> None:
    try:
        import mindcheck
        mindcheck.note_ok()
    except Exception:
        log.debug("stock: mindcheck note_ok unavailable", exc_info=True)


def _note_model_fail(exc: BaseException) -> None:
    try:
        import mindcheck
        mindcheck.note_fail(exc)
    except Exception:
        log.debug("stock: mindcheck note_fail unavailable", exc_info=True)


# ── THE THREE-WAY MATCH (§5.7a's laws, applied to a shelf instead of an order) ────────────────────
# These are STRUCTURAL values the client branches on, not prose the operator reads — which is why they
# are English while `confidence` («alta»/«media»), `source` («foto»/«voz») and every `why` are es-ES.
# A client that renders one of these strings has a bug; it is meant to choose a card, not print one.
MATCHED, AMBIGUOUS, UNMATCHED = "matched", "ambiguous", "unmatched"

# HOW MANY CANDIDATES THE OPERATOR SEES — and the reason it is not two.
#
# `doubt.MAX_CANDIDATES` is 2 because META ALLOWS THREE BUTTONS and the escape row «Ninguno, te digo»
# takes one of them (§5.7a: "the 3-button cap shapes the ask"). That cap is a property of the CHANNEL,
# not of the doubt — and this channel is a man holding a phone in front of a pallet, looking at a
# list. Capping his screen at two would throw away rows the matcher genuinely could not separate, and
# he is the one person in the whole system who can tell them apart by picking the box up.
#
# So the FACULTY is unchanged and the SURFACE differs, which is the same split §5.7a already makes
# when it says the mind writes the sentence and the faculty supplies the truth. `capture_note` (the
# conversational half, where the cap DOES apply) names two and counts the rest.
APP_CANDIDATES = 5


def classify_stock_match(g: Dict[str, Any], *, qty: Optional[float] = None,
                         unit: str = "") -> Dict[str, Any]:
    """One grounding result → MATCHED | AMBIGUOUS | UNMATCHED. PURE — no DB, no model.

    THE BANDS ARE NOT MINE. This calls `doubt.classify_line`, the exact function `brain/pipeline` runs
    on a customer's order, which reads `matcher`'s `band` / `tight` / `n_close` / `unit_ok` and the
    thresholds `RERANK_CLEAR .45`, `RERANK_UNSURE .15`, `MARGIN_TIGHT .12`. Inventing a second set for
    stock would mean «paleta» could ground one way in an order and another way on a shelf, and the
    shortfall check compares those two answers to each other. The mapping:

      doubt kind          →  here          because
      ─────────────────────────────────────────────────────────────────────────────────────────────
      None (resolved)     →  MATCHED       one clear row · «alta»
      THIN                →  MATCHED       ONE plausible row, weak. §5.7a calls for a single confirm,
                                           not a choice — so it is matched, marked «media», and the
                                           runner-up rides along as `alternatives` (one tap to swap)
      UNIT                →  MATCHED       the PRODUCT is identified; the unit is the doubt. Carried
                                           as `unit_note`, and `shortfalls` already refuses to compare
                                           mismatched units, so a wrong unit is silent, never a guess
      AMBIGUOUS / DIMENSIONLESS → AMBIGUOUS  two real candidates, tight margin. Nobody picks
      UNKNOWN *with* candidates → AMBIGUOUS  THE WIDE TIE, and the one judgement this function adds:
                                           §5.7a routes it to the COMERCIAL because no honest two-way
                                           question exists for a customer. Here the comercial IS the
                                           person holding the phone, and he has a list rather than
                                           three buttons — so the direction is identical (a human who
                                           can answer), and only the surface differs. The product IS
                                           in his catalogue; offering to create it would be a lie
      UNKNOWN *without* candidates → UNMATCHED  band «unsure», nothing plausible. THIS is the create
                                           offer, and it is deliberately the only door to one
      CONFLICT            →  (unreachable) needs a validator, and a shelf has no "normal quantity"

    Returns {state, sku_id, name, confidence, candidates, alternatives, unit_note, why, n_close}.
    `why` is es-ES: it is shown next to the line."""
    import doubt
    cands = list(g.get("candidates") or [])
    line = {"mention": g.get("heard") or g.get("name") or "", "qty": qty, "unit": unit,
            "price": g.get("price"),
            "match": {"band": g.get("band"), "tight": bool(g.get("tight")),
                      "alias_hit": bool(g.get("alias")), "unit_ok": g.get("unit_ok", True),
                      "unit_note": g.get("unit_note") or "", "n_close": int(g.get("n_close") or 1),
                      "candidates": cands}}
    d = doubt.classify_line(line)
    kind = d.get("kind")
    sku_id, band = str(g.get("sku_id") or ""), (g.get("band") or "unsure").lower()

    if kind in (doubt.AMBIGUOUS, doubt.DIMENSIONLESS) or (
            kind == doubt.UNKNOWN and band != "unsure" and sku_id and cands):
        # The close rows, in the matcher's own order. `n_close` is its count over the FULL pool, so
        # this shows every row it genuinely could not separate — never a truncation dressed as a tie.
        n = max(2, min(int(g.get("n_close") or 2), APP_CANDIDATES))
        return {"state": AMBIGUOUS, "sku_id": "", "name": "", "confidence": "",
                "candidates": cands[:n], "alternatives": [], "unit_note": "",
                "n_close": int(g.get("n_close") or len(cands)),
                "why": "no sé cuál de estos es"}

    if kind == doubt.UNKNOWN or not sku_id or band == "unsure":
        return {"state": UNMATCHED, "sku_id": "", "name": "", "confidence": "",
                "candidates": cands[:APP_CANDIDATES], "alternatives": [], "unit_note": "",
                "n_close": int(g.get("n_close") or 0),
                "why": "no lo encuentro en tu catálogo"}

    # MATCHED. «alta» only for an alias hit or a clean band — a `note` band is a real product with a
    # real reservation, and saying «alta» about it would be the inflation this codebase forbids.
    alts = [c for c in cands if c.get("sku_id") != sku_id][:2] if kind == doubt.THIN else []
    return {"state": MATCHED, "sku_id": sku_id, "name": g.get("name") or "",
            "confidence": "alta" if (g.get("alias") or band == "clean") else "media",
            "candidates": [], "alternatives": alts,
            "unit_note": (g.get("unit_note") or "") if kind == doubt.UNIT else "",
            "n_close": int(g.get("n_close") or 1),
            "why": "" if kind is None else (d.get("reason") or "")}


async def read_capture(con, tenant: str, *, image_bytes: Optional[bytes] = None, mime: str = "",
                       transcript: str = "") -> Dict[str, Any]:
    """READ A CAPTURE — the photograph and the spoken note become lines. This is «lo que Rocoto ha
    leído», and until 2026-07-27 it did not exist: the client sent the list and the screen credited us
    with it.

        {"read":      [{sku_id, name, qty, unit, confidence, source, said, heard, state:"matched",
                        alternatives?, unit_note?, conflict?, photo_qty?, photo_unit?}],
         "ambiguous": [{name, qty, unit, source, said, heard, state:"ambiguous",
                        candidates:[{sku_id,name,code,family,base_unit,score}], n_close, why,
                        can_create:true}],
         "unmatched": [{name, qty, unit, source, said, heard, state:"unmatched", candidates, why,
                        can_create, suggested_code}],
         "note":      "…"}      # es-ES, and EMPTY when the reading went fine

    THREE LISTS, AND THE MIDDLE ONE IS THE NEW HONESTY. `read` is what may be counted; `ambiguous` is
    what the catalogue holds but we cannot name — the operator picks, nobody picks for him, and these
    lines are OUT of `read` so `apply_capture` structurally cannot write a level from one; `unmatched`
    is what is not there at all, and that is where the offer to CREATE the row lives (`can_create` +
    `suggested_code`, the string «te lo genero yo» would actually mint). See `classify_stock_match`
    for which of the three a line lands in and which of the order brain's bands decided it.

    THE TWO SENSES, and which wins. The photo is read on its own, the note is read on its own, and
    `fuse` merges them with THE SPOKEN NOTE WINNING on conflict — a man standing at the pallet beats a
    photograph of it. A capture with NO photo and only a note works completely: the operator can
    simply say what came off the lorry, which at six in the morning is often the only thing that
    happens. A line always declares WHERE it came from (`source`: foto | voz | foto+voz) and an
    overridden photo keeps its losing numbers in `photo_qty`/`photo_unit` with `conflict` set, because
    the operator has to be able to see where a number came from before he can correct it.

    NOTHING HERE INVENTS A SKU. Every name goes through `brain/matcher`; the matcher's own three
    bands decide: clean/alias → `read` with confidence «alta», note (tight, or a unit the SKU does not
    sell in) → `read` with confidence «media» and the runner-up named, and `unsure` → `unmatched`,
    carrying the words the photo or the operator actually used. That is the order brain's law — abstain,
    do not guess — applied here because money and stock are the same kind of promise: a guessed SKU
    writes a level onto the wrong shelf, and a shortfall computed from it holds a real order for a
    fact we made up.

    IT FAILS HONESTLY AND IT NEVER RAISES. No key, no model, a refused image, an ungrounded tenant or
    a read that runs past READ_TIMEOUT_SEC all come back as an EMPTY `read` with a plain es-ES `note`
    — never a fabricated line, never an exception into the request. Model outcomes are reported to
    `mindcheck`, so a dead key shows up in /healthz instead of quietly producing empty readings.

    `con` is this tenant's connection and is used for exactly one thing: `doubt.catalogue_ready` —
    a tenant with no catalogue loaded cannot ground anything, so we say that in one sentence instead
    of running an embedding and a reranker per line to abstain 100% of the time."""
    try:
        return await asyncio.wait_for(
            _read_capture(con, tenant, image_bytes=image_bytes, mime=mime, transcript=transcript),
            timeout=READ_TIMEOUT_SEC)
    except asyncio.TimeoutError:
        log.warning("stock: reading timed out after %.0fs for %s", READ_TIMEOUT_SEC, tenant)
        return _empty_read(NOTE_SLOW)
    except Exception:
        log.exception("stock: reading failed for %s", tenant)
        return _empty_read(NOTE_UNREADABLE)


async def _read_capture(con, tenant: str, *, image_bytes: Optional[bytes], mime: str,
                        transcript: str) -> Dict[str, Any]:
    transcript = (transcript or "").strip()
    if not image_bytes and not transcript:
        return _empty_read(NOTE_NOTHING)

    import config
    if not getattr(config, "ANTHROPIC_API_KEY", ""):
        # We KNOW this one — no call was made, so nothing is claimed about the provider either.
        log.warning("stock: no model key — reading nothing for %s", tenant)
        return _empty_read(NOTE_NO_MODEL)

    ocr = await _vision_text(image_bytes, mime) if image_bytes else ""
    if image_bytes and not ocr and not transcript:
        return _empty_read(NOTE_UNREADABLE)

    try:
        data = await _extract_lines(ocr, transcript)
    except Exception as e:
        _note_model_fail(e)
        log.exception("stock: line extraction failed for %s", tenant)
        return _empty_read(NOTE_NO_MODEL)
    if not isinstance(data, dict):
        return _empty_read(NOTE_UNREADABLE)

    lines = fuse(_clean_lines(data.get("photo_lines"), SRC_PHOTO),
                 _clean_lines(data.get("voice_lines"), SRC_VOICE))
    # A photo line with NO clear count — spotted, not counted. Dropped when a VOICE line already
    # named the same product: he already told us the number, and asking again would be the reading
    # arguing with the man holding the pallet, exactly the thing `fuse()`'s own voice-wins rule
    # exists to prevent. Capped at 6 questions per capture — a pallet is not an interrogation, and a
    # photo with more than six uncounted products needs a second, calmer capture more than it needs
    # six model calls in one screen.
    counted = {_item_key(ln["item"]) for ln in lines if ln["source"] in (SRC_VOICE, SRC_BOTH)}
    unsure = [u for u in _clean_unsure(data.get("unsure_qty")) if _item_key(u["item"]) not in counted][:6]
    needs_qty: List[Dict[str, Any]] = []
    if unsure:
        results = await asyncio.gather(
            *[qty_options(u["item"], u["unit"]) for u in unsure], return_exceptions=True)
        for u, r in zip(unsure, results):
            if isinstance(r, BaseException):
                log.exception("stock: qty_options failed for %r", u["item"])
                r = _qty_fallback(u["unit"])
            options = [{"id": f"q{i + 1}", "label": lbl} for i, lbl in enumerate(r["options"])]
            options.append({"id": QTY_CUSTOM_ID, "label": "Otra cantidad", "free": True})
            needs_qty.append({"name": u["item"], "unit": u["unit"], "why": u["why"],
                              "question": r["question"], "options": options})
    if not lines and not needs_qty:
        return _empty_read(NOTE_UNREADABLE)

    # An ungrounded tenant: every line is honestly unmatched, and we say why in one sentence rather
    # than run the matcher 20 times to abstain 20 times.
    grounded_ok = True
    try:
        import doubt
        grounded_ok = bool((await doubt.catalogue_ready(con, tenant)).get("grounded"))
    except Exception:
        log.exception("stock: could not check catalogue readiness for %s — grounding anyway", tenant)
    if not grounded_ok:
        # UNGROUNDED is its own state (§5.7a), and it is NOT an invitation to create sixty rows one
        # at a time from a pallet: `can_create` is False here and the sentence says why. The fix for
        # an empty catalogue is the catalogue, not the inventory tool. `needs_qty` still travels: a
        # quantity question is about counting, not about matching a SKU, so an empty catalogue is no
        # reason to withhold it — the operator can answer it once the catalogue exists.
        return {"read": [], "ambiguous": [], "needs_qty": needs_qty, "note": NOTE_NO_CATALOGUE,
                "unmatched": [{"name": ln["item"], "qty": ln["qty"], "unit": ln["unit"],
                               "state": UNMATCHED, "source": ln["source"],
                               "said": ln.get("said", ""), "heard": ln["item"],
                               "why": "todavía no tengo tu catálogo", "candidates": [],
                               "can_create": False, "suggested_code": ""}
                              for ln in lines]}

    read: List[Dict[str, Any]] = []
    ambiguous: List[Dict[str, Any]] = []
    unmatched: List[Dict[str, Any]] = []
    cache: Dict[str, Dict[str, Any]] = {}
    for ln in lines:
        key = f"{_unit_key(ln['item'])}|{_unit_key(ln['unit'])}"
        g = cache.get(key)
        if g is None:
            try:
                g = await _ground(tenant, ln["item"], ln["unit"], ln["qty"])
            except Exception:
                # A grounding failure is UNMATCHED, never a guess — and never a create offer either,
                # because "we could not look" is not the same fact as "it is not there".
                log.exception("stock: grounding failed for %r", ln["item"])
                g = {"sku_id": "", "band": "unsure", "candidates": [], "failed": True}
            cache[key] = g
        g = dict(g, heard=ln["item"])
        v = classify_stock_match(g, qty=ln["qty"], unit=ln["unit"])

        # What EVERY line carries, whichever of the three it turned out to be: the words, the numbers,
        # and where they came from. The operator cannot correct what he cannot trace (DESIGN-CANON).
        base = {"name": g.get("name") or ln["item"], "qty": ln["qty"], "unit": ln["unit"],
                "state": v["state"], "source": ln["source"], "said": ln.get("said", ""),
                "heard": ln["item"]}
        if ln.get("conflict"):
            base["conflict"] = True
            base["photo_qty"], base["photo_unit"] = ln.get("photo_qty"), ln.get("photo_unit")
        elif ln["source"] == SRC_BOTH:
            base["photo_qty"], base["photo_unit"] = ln.get("photo_qty"), ln.get("photo_unit")

        if v["state"] == AMBIGUOUS:
            # NOT in `read`, and that is the guarantee rather than a convention: `apply_capture` only
            # ever walks `read`, so an unresolved line is structurally incapable of writing a level.
            ambiguous.append({**base, "name": ln["item"], "candidates": v["candidates"],
                              "n_close": v["n_close"], "why": v["why"], "can_create": True})
            continue
        if v["state"] == UNMATCHED:
            unmatched.append({**base, "name": ln["item"], "candidates": v["candidates"],
                              "why": v["why"], "can_create": not g.get("failed"),
                              "suggested_code": ""})
            continue
        row = {**base, "sku_id": v["sku_id"], "name": v["name"] or ln["item"],
               "confidence": v["confidence"], "score": g.get("score", 0.0)}
        if v["alternatives"]:
            row["alternatives"] = v["alternatives"]   # «¿o querías decir…?» — the swap, one tap away
        if v["unit_note"]:
            row["unit_note"] = v["unit_note"]
        read.append(row)

    # THE CODE WE WOULD MINT, computed once for the whole capture rather than per line, so two
    # unmatched lines in one photograph can never be offered the same number. Purely a SUGGESTION —
    # nothing is reserved, and `catalogue.create_sku` claims the number under a lock when he agrees.
    if unmatched:
        await _suggest_codes(con, tenant, unmatched)
    return {"read": read, "ambiguous": ambiguous, "unmatched": unmatched,
            "needs_qty": needs_qty, "note": ""}


async def _suggest_codes(con, tenant: str, unmatched: List[Dict[str, Any]]) -> None:
    """Fill `suggested_code` on every creatable unmatched line, in place. Fail-soft: without a
    suggestion the question is still perfectly askable («¿tienes código para esto?») — it just cannot
    show the string it would generate, which is a smaller loss than failing the whole reading."""
    try:
        from brain import catalogue
        idx = await catalogue.catalogue_index(con, tenant)
        taken = set(idx["codes"])
        for u in unmatched:
            if not u.get("can_create"):
                continue
            # `heard` FIRST: the words that were actually said or read. `name` is empty on an
            # unmatched line by construction (there is no catalogue name for something that is not in
            # the catalogue), and stemming an empty string would hand every new product the same
            # generic code — «ROC-GEN-001» tells nobody anything.
            c = catalogue.next_code(
                catalogue.code_stem(u.get("heard") or u.get("name") or ""), taken)
            u["suggested_code"] = c
            taken.add(c)          # two lines in one capture never collide on the same number
    except Exception:
        log.exception("stock: could not suggest codes for %s", tenant)


# ── the capture → correction → apply loop ────────────────────────────────────────────────────────
def _json_list(v: Any) -> List[Any]:
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        try:
            out = json.loads(v or "[]")
            return out if isinstance(out, list) else []
        except ValueError:
            return []
    return []


def _read_key(read_json: Any) -> List[tuple]:
    """A capture's reading, reduced to what a correction can change: which SKU, how much, in what
    unit, in what order. Names and notes are prose around the numbers — the boss retyping «paleta»
    as «Paleta» has not corrected anything."""
    items = read_json
    if isinstance(items, str):
        try:
            items = json.loads(items or "[]")
        except ValueError:
            items = []
    out = []
    for it in (items or []):
        if isinstance(it, dict):
            out.append((str(it.get("sku_id") or ""), _num(it.get("qty")),
                        str(it.get("unit") or "").strip().lower()))
    return out


async def record_capture(con, tenant: str, *, image_url: str = "", transcript: str = "",
                         read_json: Any = None) -> int:
    """Store WHAT ROCOTO READ, before any level moves. Returns the capture id — the handle the app
    hands back with «Corregir hablando» or «Guardar». Nothing in `stock_levels` changes here, and
    that is the whole point of the loop."""
    items = read_json if isinstance(read_json, list) else []
    # The jsonb parameter is passed as a native list, NOT json.dumps'd: every db pool registers
    # `set_type_codec("jsonb", encoder=json.dumps)` in db._init_conn, so handing it a string would
    # encode a second time and store a JSON *string* where an array belongs (verified on the clone:
    # jsonb_typeof → 'string'). Silent, and it would make every stored reading unreadable.
    cid = await con.fetchval(
        "insert into stock_captures (tenant_id, image_url, transcript, read_json, corrected, applied) "
        "values ($1, $2, $3, $4::jsonb, false, false) returning id",
        tenant, (image_url or "")[:1000], (transcript or "")[:8000], items)
    return int(cid)


async def apply_capture(con, tenant: str, capture_id: int, read_json: Any = None) -> Dict[str, Any]:
    """Apply a capture to the levels — the moment the reading becomes state.

    `read_json` is the reading AS THE BOSS LEFT IT (corrected by voice, or unchanged). If it differs
    from what we read, the capture is marked `corrected` and the corrected reading REPLACES the
    stored one: what was applied and what is on file must be the same numbers, or the audit trail
    lies. Applying is idempotent — a second Guardar writes nothing and says so.

    Raises on a capture that is not this tenant's: the fence is a rule, not a preference, and a
    silently-skipped write here would leave one distributor's shelf holding another's orders."""
    row = await con.fetchrow(
        "select id, read_json, applied from stock_captures where id = $1 and tenant_id = $2",
        int(capture_id), tenant)
    if not row:
        raise ValueError("No existe esa captura de inventario.")
    if row["applied"]:
        return {"ok": True, "capture_id": int(capture_id), "written": 0, "skipped": 0,
                "rejected": [], "corrected": False, "already_applied": True}

    stored = row["read_json"]
    final = read_json if isinstance(read_json, list) else (
        stored if isinstance(stored, list) else _json_list(stored))
    corrected = _read_key(final) != _read_key(stored)

    # EVERY SKU IS CHECKED AGAINST THIS TENANT'S OWN CATALOGUE BEFORE A LEVEL MOVES. `stock_levels`
    # has a foreign key onto `catalogue_skus(id)`, but that key is GLOBAL — it would happily accept
    # another distributor's sku_id, and the row would then sit on our tenant pointing at their
    # product. The client is also where an OVERRIDE comes from (the operator swapped the match), so
    # this is exactly the path a bad id arrives on. An unknown id writes NOTHING and is named in
    # `rejected`, because a wrong SKU silently counted is worse than an uncounted line: the level is
    # invisible, and days later it makes somebody else's order wrongly short with nothing in the
    # trail pointing back at this pallet.
    want = [str(it.get("sku_id") or "") for it in final if isinstance(it, dict)]
    want = [s for s in dict.fromkeys(want) if s]
    mine: set = set()
    if want:
        try:
            mine = {r["id"] for r in await con.fetch(
                "select id from catalogue_skus where tenant_id=$1 and id = any($2::text[])",
                tenant, want)}
        except Exception:
            # Fail CLOSED. Unreadable catalogue ⇒ we cannot prove any id is ours, so nothing is
            # written and the capture stays un-applied for a retry. The read path is fail-soft; the
            # rule never is (this module's opening law).
            log.exception("stock: could not verify sku ownership for %s — refusing to apply", tenant)
            raise ValueError("No he podido comprobar tus productos. Vuelve a intentarlo.")

    written = skipped = 0
    rejected: List[str] = []
    for it in final:
        if not isinstance(it, dict):
            skipped += 1
            continue
        sku = str(it.get("sku_id") or "")
        q = _num(it.get("qty"))
        if not sku or q is None or q < 0:
            skipped += 1        # a reading we cannot ground writes nothing — never a guessed level
            continue
        if sku not in mine:
            skipped += 1
            rejected.append(sku)
            log.warning("stock: capture %s carried sku %r that is not %s's — not written",
                        capture_id, sku, tenant)
            continue
        try:
            await set_level(con, tenant, sku, q, str(it.get("unit") or "kg"),
                            low_at=it.get("low_at"), source="capture",
                            note=str(it.get("note") or ""))
            written += 1
        except Exception:
            skipped += 1
            log.exception("stock: level write failed for %s/%s (capture %s)", tenant, sku, capture_id)

    await con.execute(                              # native list — see record_capture on the codec
        "update stock_captures set read_json = $3::jsonb, corrected = $4, applied = true "
        " where id = $1 and tenant_id = $2",
        int(capture_id), tenant, list(final), bool(corrected))
    return {"ok": True, "capture_id": int(capture_id), "written": written, "skipped": skipped,
            "rejected": rejected, "corrected": bool(corrected), "already_applied": False}


async def check_lines(con, tenant: str, lines: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Can this order be filled from what we have counted? Returns {ok, short, reason, inventory}.

    The live path, and the read side of §5.8's LOW_STOCK source. Two structural silences, both
    already stated at the top of this module and both re-stated here because they are the rule:
    inventory OFF → ok=True without reading a level; a SKU with no level row → that line cannot be
    short. `reason` names exactly ONE item."""
    if not await inventory_on(con, tenant):
        return {"ok": True, "short": [], "reason": "", "inventory": False}
    skus = [s for s in (_line_sku(ln) for ln in (lines or [])) if s]
    levels = await get_levels(con, tenant, skus) if skus else {}
    return verdict(lines, levels, inventory_enabled=True)


async def low_levels(con, tenant: str) -> List[Dict[str, Any]]:
    """Everything at or under its own threshold — the Inventario «te queda poco» list. A nudge, not
    a review: nobody's order is held because a shelf is thin, only because THIS order cannot be
    filled from it. Empty when inventory is off."""
    if not await inventory_on(con, tenant):
        return []
    levels = await get_levels(con, tenant)
    out = [v for v in levels.values() if v.get("low")]
    out.sort(key=lambda d: (_num(d.get("qty")) or 0.0))
    return out


# ══ THE OVERRIDE, AND THE ASK ════════════════════════════════════════════════════════════════════
async def match_one(con, tenant: str, mention: str, *, unit: str = "",
                    qty: Optional[float] = None) -> Dict[str, Any]:
    """A NAME the operator typed or said → the same three-way. THE OVERRIDE PATH.

    «Corregir hablando» is the feature, and a correction that can only choose between the two rows we
    already offered is not a correction — it is a nicer way of accepting our answer. So this exists:
    he says «no, es la paleta cocida en pieza», and it grounds that through the SAME matcher, with the
    SAME bands, and comes back MATCHED / AMBIGUOUS / UNMATCHED exactly as the reading would have. If
    it comes back UNMATCHED it carries `suggested_code`, which is how a correction turns into a
    creation without him having to start again.

    A stock count is silent — nobody reads it back — so the ability to override any match is not an
    escape hatch from the loop, it IS the loop. Returns the classifier's verdict plus `heard` (what he
    actually said, kept verbatim) and, when creatable, `suggested_code`."""
    mention = " ".join(str(mention or "").split())
    if not mention:
        return {"state": UNMATCHED, "sku_id": "", "name": "", "confidence": "", "candidates": [],
                "alternatives": [], "unit_note": "", "n_close": 0, "heard": "", "can_create": False,
                "suggested_code": "", "why": "no me has dicho qué es"}
    try:
        g = await _ground(tenant, mention, unit, qty)
    except Exception:
        log.exception("stock: match_one grounding failed for %r", mention)
        # "We could not look" is not "it is not there" — so no create offer on a failure.
        return {"state": UNMATCHED, "sku_id": "", "name": "", "confidence": "", "candidates": [],
                "alternatives": [], "unit_note": "", "n_close": 0, "heard": mention,
                "can_create": False, "suggested_code": "",
                "why": "no he podido buscarlo ahora mismo"}
    g = dict(g, heard=mention)
    v = classify_stock_match(g, qty=qty, unit=unit)
    out = {**v, "heard": mention, "qty": qty, "unit": unit,
           "can_create": v["state"] == UNMATCHED, "suggested_code": ""}
    if out["can_create"]:
        await _suggest_codes(con, tenant, [out])
    return out


def capture_note(out: Dict[str, Any]) -> str:
    """THE FACT SHEET THE MIND IS HANDED — the twin of `doubt.doubt_note`, for a stock capture.

    Peter's law, and §5.7's: THE ASK IS THE MIND'S, NOT A FORM. In the app the operator is standing
    there and gets a proper UI step; in CONVERSATION (he sends Rocoto a photo of the cold room and a
    voice note) there is no screen, and a canned template fired at the boss is exactly the tone this
    product refuses. So this supplies the FACTS and the CANDIDATES and the PERMISSION, never the
    wording — the mind writes the sentence, in character, in its own voice.

    EMPTY WHEN THERE IS NOTHING TO ASK, so a clean capture carries no noise into the fold. That is the
    same discipline as `confidence.perception_note` and `doubt.doubt_note`, and it is what stops the
    note from becoming background the mind learns to ignore.

    THE 3-BUTTON CAP APPLIES HERE AND NOT ON THE SCREEN (§5.7a). This is the channel where an ask
    becomes WhatsApp buttons, so an ambiguous line names at most two candidates and counts the rest;
    `read_capture` hands the app up to `APP_CANDIDATES`, because a list is not a button."""
    read = list(out.get("read") or [])
    amb = list(out.get("ambiguous") or [])
    unm = list(out.get("unmatched") or [])
    note = str(out.get("note") or "")
    if not amb and not unm and not note:
        return ""

    L = ["LO QUE HAS LEÍDO DEL INVENTARIO (hecho, no palabras — la frase la escribes tú):"]
    if note:
        L.append(f"· No has podido leerlo bien: {note}")
    if read:
        L.append(f"· CUADRADAS con su producto: {len(read)} "
                 f"({', '.join(str(r.get('name') or '') for r in read[:3])}"
                 f"{'…' if len(read) > 3 else ''}).")
    for a in amb:
        names = [str(c.get("name") or "") for c in (a.get("candidates") or [])][:2]
        rest = max(0, int(a.get("n_close") or len(names)) - len(names))
        opts = " o ".join(f"«{n}»" for n in names) if names else "varias filas"
        L.append(f"· NO SABES CUÁL ES: «{a.get('heard') or a.get('name')}» "
                 f"({_es(float(a.get('qty') or 0))} {a.get('unit') or ''}".rstrip() +
                 f"). Puede ser {opts}" + (f" y {rest} más" if rest else "") +
                 ". PREGÚNTALE cuál es. No elijas tú.")
    for u in unm:
        if u.get("can_create"):
            L.append(f"· NO ESTÁ EN SU CATÁLOGO: «{u.get('heard') or u.get('name')}» "
                     f"({_es(float(u.get('qty') or 0))} {u.get('unit') or ''}".rstrip() +
                     "). PREGÚNTALE si tiene código para esto o si se lo generas tú" +
                     (f" (le propondrías {u['suggested_code']})" if u.get("suggested_code") else "") +
                     ". Sin su respuesta no se da de alta nada.")
        else:
            L.append(f"· NO ESTÁ EN SU CATÁLOGO: «{u.get('heard') or u.get('name')}» — "
                     f"{u.get('why') or 'no se puede dar de alta ahora'}.")
    L.append("NADA de esto está contado todavía. No digas «apuntado», «listo» ni «hecho» hasta que "
             "él conteste y se guarde.")
    return "\n".join(L)
