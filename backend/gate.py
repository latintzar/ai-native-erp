"""gate.py — the deterministic outbound gate (SPEC §5 canonical rule list; BUILD-PLAN 4.1).

"Deliberately dumb: plain rules over keyed facts, no model, because it's the one layer whose failure
we can't accept." Runs on EVERY outbound sentence (SPEC §5: the dangerous grant is prose). v1 covers
the money surface — the bar that matters most: a price CONCESSION, a credit/terms change, or a bare
price that DIFFERS from the keyed standing price → park on the review sheet. Autonomous grants = 0.

Honest scope (v1): concession/credit verbs + a standing-price delta. The full §5 list (size-vs-norm,
geo, new-customer, per-tool needs_approval) folds in with the gate stream — this is the money floor,
the hard one. It ERRS toward parking (over-park is safe; under-park on money is the failure we refuse).

── BLOCK B6 · MODO SOMBRA (SPEC §5.5) ────────────────────────────────────────────────────────────
The second half of this file is the MOUTH switch, and it lives here because §5.5 says where it lives:
"the gate short-circuits all outbound for that scope". Replying and FOLLOWING are separate powers —
in sombra the mind runs FULLY (ingest, transcribe, extract + ground orders from the humans' own
conversation, update cards/facts/tabs, open and track loops, surface for review, nudge the boss,
draft a suggested reply) and he SENDS NOTHING: messages, reactions, typing/read-receipts and calls
all stop here.

ONE FIELD, TWO LEVELS, NO FIFTH FLAG. `scope_state.mode` ∈ {auto, sombra, null=inherit}. The
app-wide default is the same column on the APP SCOPE row (`app_scope()`); a per-customer row wins
because it is the nearer one. The old half-toggles are now VIEWS of this: `scope_state.muted` and
`.takeover_active` are deleted columns (runtime.is_muted / set_takeover read and write `mode`), the
per-customer autopilot endpoint writes `mode`, and `elevenlabs_autoreply_enabled` reports it.

FAIL-CLOSED, LOUD. A DB fault resolving the mode holds the send (and records the draft) rather than
speaking against a boss's instruction — nothing is lost, because a held outbound is recorded as a
draft on the review sheet, whereas a sent one cannot be recalled. It is logged at ERROR so it can
never be a silent outage.

WHAT SOMBRA IS NOT: it is not a global kill switch and not a mute of the HUMAN. Operator-initiated
sends (`POST /api/send`, the CR override rail) are the human's own mouth and are untouched; so is
`actions.escalate`, which speaks to the BOSS — "nudge the boss" is exactly what §5.5 asks sombra to
keep doing.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Optional

log = logging.getLogger("rocoto.gate")

# a price CONCESSION (a grant relative to standing terms) — NOT a bare factual quote.
_CONCESSION = [
    r"\bte l[oa]s?\s+dejo\b", r"\bte l[oa]s?\s+pongo\s+(a|en)\b", r"\bte\s+hago\s+(un\s+)?precio\b",
    r"\bdescuento\b", r"\bre?baj[ao]\b", r"\bte\s+lo\s+rebajo\b", r"\bgratis\b", r"\bsin\s+cargo\b",
    r"\binvita\s+la\s+casa\b", r"\bprecio\s+especial\b", r"\boferta\s+para\s+ti\b",
]
_CREDIT = [
    r"\bfi[aá]o\b", r"\bf[ií]o\b", r"\bfi[aá]\b", r"\ba\s+cr[eé]dito\b", r"\bpl[aá]zo\b",
    r"\bya\s+me\s+pagas\b", r"\bp[aá]game\s+(luego|despu[eé]s|la\s+semana|cuando)\b",
    r"\bcuando\s+puedas\b.{0,20}pag", r"\bd[eé]jalo\s+a\s+deber\b",
]
# a PRICE token: "2,50 €" / "€ 2,50" / "2,50 €/kg" (first two alts), or "a 2,50 el kilo/la unidad/cada"
# (a price without the € symbol). Deliberately NOT a bare "12 kg" (that's a quantity, not a price).
_PRICE = re.compile(
    r"(\d+[.,]?\d*)\s*€|€\s*(\d+[.,]?\d*)|\ba\s+(\d+[.,]?\d*)\s+(?:el\s+kilo|la\s+unidad|la\s+caja|cada)\b")


def _num(s: str) -> Optional[float]:
    try:
        return float(s.replace(",", "."))
    except (TypeError, ValueError):
        return None


def extract_prices(text: str) -> list[float]:
    """Every price-shaped number in a text (€ / 'a X el kilo'), as floats. Not quantities."""
    out = []
    for m in _PRICE.finditer((text or "").lower()):
        v = _num(next((g for g in m.groups() if g), None))
        if v is not None:
            out.append(v)
    return out


def check_outbound(sentence: str, standing_price=None) -> dict:
    """Return {ok, needs_approval, money, reason}. ok=False ⇒ park (never send as-is).

    WP-8 (eng-review HIGH): `standing_price` may be a float OR a LIST of the scope's keyed standing
    prices. A price-shaped number in the sentence that matches NONE of them is an OFF-BOOK quote → park,
    even with no concession verb (a bare 'son 2,10 €' when the book says 2,00)."""
    s = (sentence or "").lower()
    for pat in _CONCESSION:
        if re.search(pat, s):
            return {"ok": False, "needs_approval": True, "money": True,
                    "reason": f"price concession (matched /{pat}/)"}
    for pat in _CREDIT:
        if re.search(pat, s):
            return {"ok": False, "needs_approval": True, "money": True,
                    "reason": f"credit / terms change (matched /{pat}/)"}
    # a bare price that DIFFERS from every keyed standing price also gates (a quote off-book).
    prices = ([standing_price] if isinstance(standing_price, (int, float)) else list(standing_price or []))
    prices = [float(p) for p in prices if p is not None]
    if prices:
        for val in extract_prices(s):
            if all(abs(val - p) > 1e-6 for p in prices):
                return {"ok": False, "needs_approval": True, "money": True,
                        "reason": f"quoted {val} off-book vs standing {prices}"}
    return {"ok": True, "needs_approval": False, "money": False, "reason": "clean"}


async def standing_prices(con, scope: str) -> list[float]:
    """The scope's keyed standing prices (from CURRENT COMMERCIAL facts) — threaded into the gate so a
    bare off-book quote parks. Fail-soft to []."""
    try:
        rows = await con.fetch(
            "select text from fact where scope <@ $1::ltree and kind='COMMERCIAL' and invalid_at is null", scope)
        out: list[float] = []
        for r in rows:
            out.extend(extract_prices(r["text"] or ""))
        return out
    except Exception:
        return []


# ═════════════════════════ MODO SOMBRA — the one mouth switch (SPEC §5.5) ═════════════════════════

AUTO = "auto"
SOMBRA = "sombra"
MODES = (AUTO, SOMBRA)

# every outbound KIND that stops in sombra — the full mouth, not just prose (SPEC §5.5).
KINDS = ("message", "media", "reaction", "interactive", "typing", "call", "voice")


def normalize_mode(mode: Optional[str]) -> Optional[str]:
    """'auto'|'sombra' → itself; None/''/'inherit' → None (no override). Anything else → ValueError."""
    if mode is None:
        return None
    m = str(mode).strip().lower()
    if m in ("", "inherit", "null", "none", "default"):
        return None
    if m not in MODES:
        raise ValueError(f"mode must be one of {MODES} (or empty to inherit), got {mode!r}")
    return m


def _label(s: str) -> str:
    """An ltree-safe label (ltree allows [A-Za-z0-9_] only)."""
    return re.sub(r"[^A-Za-z0-9_]", "_", s or "") or "app"


def app_scope(scope: str = "") -> str:
    """The scope that carries the APP-WIDE default for `scope`.

    A tenanted runtime scope is `t.<slug>.…` (tenancy.tenant_of) → its app row is `t.<slug>`, so the
    RLS policy (`row.scope <@ current_setting('rocoto.scope')`) lets a tenant read and write its own
    default and nobody else's. Everything else (the flat `wa.<digits>` convenience scopes, the boss
    scope) shares the single-tenant app root, named for BRAIN_TENANT."""
    import config
    parts = (scope or "").split(".")
    if len(parts) >= 2 and parts[0] == "t" and parts[1]:
        return f"t.{_label(parts[1])}"
    return _label(getattr(config, "BRAIN_TENANT", "app"))


_SQL_MODE = "select mode from scope_state where scope=$1::ltree"


async def _read_mode(scope: str, con=None) -> Optional[str]:
    """The override stored ON this scope's own row (None = inherit). Raises on a DB fault — the
    callers decide the failure posture, and for the mouth switch that posture is fail-CLOSED.

    `con` is only ever the caller's own scope-bound connection (it saves a pool round-trip and, more
    importantly, cannot deadlock against a lock that connection already holds). It is NEVER used for
    the APP row: under RLS an ancestor row is invisible to a descendant's connection, so reading the
    app-wide default through it would silently answer 'no default'."""
    if con is not None:
        return await con.fetchval(_SQL_MODE, scope)
    import db
    async with db.scoped_tx(scope) as c:
        return await c.fetchval(_SQL_MODE, scope)


async def effective_mode(scope: str, con=None) -> dict[str, Any]:
    """Resolve THE mode for `scope`: {mode, source, own, app, app_scope}.

    Per-customer wins over app-wide; app-wide wins over the 'auto' default. `source` names which one
    decided ('customer' | 'app' | 'default' | 'fail_closed') so every surface can SHOW why a scope is
    silent rather than making the boss guess.

    FAIL-CLOSED: if the DB cannot answer, the answer is sombra — a held send is recoverable (it is
    recorded as a draft), a sent one is not. Logged at ERROR so it is never a silent outage."""
    own = app = None
    try:
        own = normalize_mode(await _read_mode(scope, con))
        aps = app_scope(scope)
        # the app row is read on its OWN scoped connection (see _read_mode) and only when this scope
        # has no override of its own — the per-customer answer never pays for it.
        app = own if aps == scope else (normalize_mode(await _read_mode(aps)) if own is None else None)
    except Exception:
        log.error("gate: could not resolve the sombra mode for %s — HOLDING outbound (fail-closed)",
                  scope, exc_info=True)
        return {"mode": SOMBRA, "source": "fail_closed", "own": None, "app": None,
                "app_scope": app_scope(scope)}
    if own is not None:
        return {"mode": own, "source": "customer", "own": own, "app": app, "app_scope": app_scope(scope)}
    if app is not None:
        return {"mode": app, "source": "app", "own": None, "app": app, "app_scope": app_scope(scope)}
    return {"mode": AUTO, "source": "default", "own": None, "app": None, "app_scope": app_scope(scope)}


async def set_mode(scope: str, mode: Optional[str]) -> dict[str, Any]:
    """Write the override on one scope (`mode=None` clears it → inherit). The ONE writer; every
    surface (takeover, per-customer autopilot, the voice toggle, the app switch) funnels here."""
    import db
    m = normalize_mode(mode)
    async with db.scoped_tx(scope) as con:
        await con.execute(
            "insert into scope_state(scope, mode, updated_at) values($1::ltree,$2,now()) "
            "on conflict (scope) do update set mode=$2, updated_at=now()", scope, m)
    return await effective_mode(scope)


async def set_app_mode(mode: Optional[str], *, like_scope: str = "") -> dict[str, Any]:
    """The app-wide switch ("Rocoto responde"). `like_scope` picks the tenant whose default this is;
    empty = the single-tenant app root. Clearing it (None) falls back to 'auto'."""
    aps = app_scope(like_scope)
    await set_mode(aps, mode)
    return await effective_mode(aps)


async def blocked(scope: str, kind: str = "message", con=None) -> Optional[dict[str, Any]]:
    """None when the mouth is open; the resolved verdict dict when this scope is in SOMBRA.

    `kind` is recorded, never consulted — sombra stops the WHOLE mouth (SPEC §5.5: "no messages, no
    reactions"), and a kind-by-kind exception list is exactly the proliferation this block deletes."""
    v = await effective_mode(scope, con)
    if v["mode"] != SOMBRA:
        return None
    return {**v, "kind": kind if kind in KINDS else "message"}


async def hold(scope: str, kind: str, text: str = "", *, con=None,
               detail: Optional[dict] = None, verdict: Optional[dict] = None) -> dict[str, Any]:
    """SOMBRA'S ONE EXIT — the would-be outbound is recorded, never sent.

    Two rows, both on machinery that already exists (no new system of record):
      · an `action` row (kind='draft', needs_human, money=false) → it lands on the SAME review sheet
        as a parked concession (runtime.review_list) and is therefore already nudged by the standing
        `review_nudge` duty. That is §5.5's "surface to review + nudge the boss + draft-but-not-send"
        with zero new plumbing;
      · a reasoning-lane `sombra.held` event → the log (and `why`/`xray`) show that he DECIDED to say
        this and was held, not that he had nothing to say. A silence with no trace is the one outcome
        that would make sombra untrustworthy.
    Fail-soft on the recording (never raises into a turn) but the HOLD itself is unconditional.
    Returns {held: True, mode, source, kind, draft, action_id}."""
    import db
    import spine
    v = verdict or {"mode": SOMBRA, "source": "unknown"}
    draft = (text or "").strip()
    payload = {"draft": draft[:2000], "surface": kind, "mode_source": v.get("source", ""),
               **(detail or {})}
    out = {"held": True, "mode": SOMBRA, "source": v.get("source", ""), "kind": kind,
           "draft": draft, "action_id": None, "reason": f"sombra:{v.get('source', '')}"}
    own_con = con is None
    cm = None
    try:
        if own_con:
            cm = db.scoped_tx(scope)
            con = await cm.__aenter__()
        eid, _ = await spine.append_event(con, scope, "sombra.held", "gate", payload, lane="reasoning")
        if draft:
            # ⚠️ THE `action` INSERT WRITES `lineage` ITSELF (2026-08-19). `spine.append_event`
            # derives lineage for the EVENT above, and that derivation does NOT reach a direct
            # INSERT into `action` — orders_tool._lineage_of documents exactly this trap for its
            # own action row. Without it a held draft on a `test.` scope was written 'live', so a
            # DEMO turn's undelivered sentence landed on the real review sheet: vital_demo_lineage
            # caught it as «['test','live']» and it blocked two deploys before I read it properly.
            # One derivation, `spine.lineage_of`, shared with orders_tool.
            out["action_id"] = await con.fetchval(
                "insert into action(scope,kind,payload,state,reason,needs_human,money,"
                "opened_by_event,lineage) "
                "values($1::ltree,'draft',$2,'pending',$3,true,false,$4,$5) returning id",
                scope, payload, f"modo sombra ({v.get('source', '')}) — borrador sin enviar", eid,
                spine.lineage_of(scope))
    except Exception:
        log.exception("gate.hold: could not record the held draft for %s (the send stays HELD)", scope)
    finally:
        if own_con and cm is not None:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass
    log.info("SOMBRA: held %s on %s (source=%s, %d chars drafted)", kind, scope, v.get("source"), len(draft))
    return out


async def hold_if_sombra(scope: str, kind: str, text: str = "", *, con=None,
                         detail: Optional[dict] = None) -> Optional[dict[str, Any]]:
    """The one line every emitter calls: `if (h := await gate.hold_if_sombra(...)): return …`.
    None → send. A dict → the send was held and the draft recorded."""
    v = await blocked(scope, kind, con)
    if v is None:
        return None
    return await hold(scope, kind, text, con=con, detail=detail, verdict=v)
