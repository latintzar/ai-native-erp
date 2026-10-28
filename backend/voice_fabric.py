"""voice_fabric.py — THE PROCESS FABRIC (IN-CALL-RUNTIME-DESIGN §9.1/§14, review C3). Organ ④.

THE ONE background→mouth/fold contract. During a call the mind's heavy work (recall, aside resolution,
order-brain, API checks, …) runs HERE — in the background, off the reply path — and every result exists
in exactly ONE shape: a `process.completed` spine event with the envelope

    {process, say: str|None, fold: dict|None, money: bool}

  · `say`  — a speakable result: delivered by the NEXT turn's rejoin, ALWAYS through the money gate
             (voice_protocol._pending_rejoin is the sole mouth; a parked say becomes the safe deferral).
  · `fold` — context enrichment (e.g. recall lines): merged into the pinned fold by the pin REBUILD
             (app._build_voice_pin reads the spine — never in-proc mutation; that was review C3's bug).

The SPINE EVENT IS TRUTH; the pin is a read-through cache. Adding a lengthy process = ONE register()
call — trigger, coroutine, expected_ms, stall kind — no new architecture (the WP-3 promise).

REGISTRATION IS SPLIT BY THE KERNEL BOUNDARY, and this file registers only the KERNEL processes —
saying otherwise was a docstring-vs-bytes lie the 2026-07-25 context audit caught (side-finding), so
the honest map, verified by `tests/vital_context.py`:
  · HERE (kernel): recall_refresh (context) · aside_resolve (speech) · api_check (the externals
    contract, dormant until a real API registers a trigger).
  · `rocoto_processes.py` (APP side, imported at app startup): order_brain (speech+fold; its say NEVER
    carries a figure — the total stays data for the gated place step). It lives there because its
    run() imports the commerce stack, which a kernel module may never do.
The union is what `registered()` returns at runtime; the vital asserts order_brain is in it.

Everything fail-soft: a fabric error must never touch the live call.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Optional

import spine

log = logging.getLogger("rocoto.voice_fabric")

# name → {trigger(scope,utterance,ctx)->bool, run(scope,utterance,ctx,**kw)->envelope|None,
#         expected_ms, stall ∈ micro|filler|hum}
_REGISTRY: dict[str, dict] = {}
_INFLIGHT: set[tuple[str, str]] = set()          # (scope, process) — no double-fire while running


def register(name: str, *, trigger: Optional[Callable[..., bool]] = None,
             run: Callable[..., Awaitable[Optional[dict]]] = None, expected_ms: int = 1500,
             stall: str = "filler") -> None:
    _REGISTRY[name] = {"trigger": trigger, "run": run, "expected_ms": expected_ms, "stall": stall}


def registered() -> dict[str, dict]:
    return dict(_REGISTRY)


async def _run_one(name: str, scope: str, utterance: str, ctx: dict, **kw) -> None:
    key = (scope, name)
    if key in _INFLIGHT:
        return
    _INFLIGHT.add(key)
    try:
        spec = _REGISTRY.get(name)
        if not spec or not spec.get("run"):
            return
        env = await spec["run"](scope, utterance, ctx, **kw)
        if not env:
            return
        # `loop_id` (optional) BINDS the result to the tab it reasoned about, so the §4.1.1 ④ advisor
        # slot can render this verdict ON that tab's line instead of leaving it anonymous.
        env = {"process": name, "say": env.get("say"), "fold": env.get("fold"),
               "money": bool(env.get("money")), "loop_id": env.get("loop_id")}
        import db
        async with db.scoped_tx(scope) as con:
            await spine.append_event(con, scope, "process.completed", "voice", env, lane="reasoning")
    except Exception:
        log.warning("voice_fabric: process %s failed for %s (fail-soft)", name, scope, exc_info=True)
    finally:
        _INFLIGHT.discard(key)


def fire_named(name: str, scope: str, utterance: str, ctx: dict, **kw) -> None:
    """Fire ONE process by name, in the background. Never blocks, never raises."""
    try:
        asyncio.get_running_loop()
        asyncio.create_task(_run_one(name, scope, utterance, ctx, **kw))
    except Exception:
        log.debug("voice_fabric: fire_named(%s) failed (fail-soft)", name)


def fire_triggers(scope: str, utterance: str, ctx: dict) -> list[str]:
    """Fire every registered process whose trigger matches this utterance. Returns the fired names
    (the reflex uses them to pick its stall cover). Never blocks, never raises."""
    fired: list[str] = []
    for name, spec in _REGISTRY.items():
        try:
            trig = spec.get("trigger")
            if trig and trig(scope, utterance, ctx):
                fire_named(name, scope, utterance, ctx)
                fired.append(name)
        except Exception:
            log.debug("voice_fabric: trigger %s raised (fail-soft)", name)
    return fired


def stall_hint(fired: list[str]) -> str:
    """The stall cover for the reflex, DERIVED from the slowest fired process (§4: the hum happens
    BECAUSE work is running). Injected into the grounding as data — testable, not improvised."""
    if not fired:
        return ""
    specs = [_REGISTRY[n] for n in fired if n in _REGISTRY]
    if not specs:
        return ""
    worst = max(specs, key=lambda s: s["expected_ms"])
    ms, kind = worst["expected_ms"], worst["stall"]
    if kind == "micro" or ms <= 600:
        return ("PROCESO EN MARCHA (~medio segundo): cubre el hueco alargando una palabra con "
                "naturalidad («a veeer…») — NO anuncies que estás comprobando nada.")
    if kind == "hum" or ms >= 3000:
        return (f"PROCESO EN MARCHA (~{ms // 1000}s, de verdad trabajando): piensa en voz alta con "
                "naturalidad — un «mmm, a ver…», respira, y di que lo estás mirando mientras sigues "
                "con la persona. El resultado llegará al siguiente turno.")
    return (f"PROCESO EN MARCHA (~{max(1, ms // 1000)}s): di en UNA frase natural que lo estás "
            "mirando Y en la MISMA frase haz la siguiente pregunta útil — que la conversación no pare.")


# ── the two delivery surfaces (both read the SPINE — the one contract) ─────────────────────────

async def pending_say(con, scope: str) -> list[dict]:
    """Undelivered speakable results: [{event_id, process, say, money}]. The mouth (rejoin) is the
    SOLE consumer and gates every one."""
    try:
        rows = await con.fetch(
            "select e.id, e.payload from event e where e.scope=$1::ltree and e.type='process.completed' "
            "and coalesce(e.payload->>'say','') <> '' "
            "and not exists (select 1 from event d where d.scope=e.scope and d.type='process.delivered' "
            "  and (d.payload->>'completed_event_id')::bigint = e.id) "
            "order by e.id asc limit 3", scope)
        out = []
        for r in rows:
            p = r["payload"] or {}
            out.append({"event_id": r["id"], "process": p.get("process"),
                        "say": (p.get("say") or "").strip(), "money": bool(p.get("money"))})
        return out
    except Exception:
        log.debug("voice_fabric: pending_say failed (fail-soft)", exc_info=True)
        return []


async def mark_delivered(con, scope: str, event_id: int, gated: bool) -> None:
    await spine.append_event(con, scope, "process.delivered", "voice",
                             {"completed_event_id": event_id, "gated": gated}, lane="reasoning")


async def fold_results(con, scope: str) -> dict:
    """Context enrichment from recent completed processes (the pin REBUILD's read — never in-proc
    mutation). Today: merged recall lines. Extend by envelope key, not by new plumbing."""
    out: dict[str, Any] = {}
    try:
        rows = await con.fetch(
            "select payload from event where scope=$1::ltree and type='process.completed' "
            "and ts > now() - interval '20 minutes' order by id desc limit 10", scope)
        lines: list[str] = []
        for r in rows:
            f = (r["payload"] or {}).get("fold") or {}
            for t in (f.get("recall_lines") or []):
                if t and t not in lines:
                    lines.append(t)
        if lines:
            out["recall_lines"] = lines[:6]
    except Exception:
        log.debug("voice_fabric: fold_results failed (fail-soft)", exc_info=True)
    return out


# ── v1 processes ───────────────────────────────────────────────────────────────────────────────

def _recall_trigger(scope: str, utterance: str, ctx: dict) -> bool:
    return len((utterance or "").strip()) > 12


async def _recall_run(scope: str, utterance: str, ctx: dict, **kw) -> Optional[dict]:
    """Speculative recall in the inter-turn gap (the WIP _recall_ahead, now on the one contract:
    the result rides the SPINE; the pin rebuild merges it — no in-proc mutation)."""
    import db
    import memory
    async with db.scoped_tx(scope) as con:
        hits = await memory.search(con, scope, utterance, k=4)
    lines = [h.get("text", "") for h in hits if h.get("text")]
    return {"fold": {"recall_lines": lines}} if lines else None


async def _aside_run(scope: str, utterance: str, ctx: dict, *, aid: Optional[int] = None, **kw) -> Optional[dict]:
    """The check-aside executor on the fabric: same reasoning as the legacy _resolve_aside, but the
    answer rides the ONE envelope; money-ness computed AT RESOLVE TIME (review C2)."""
    import assemble as _assemble
    import config as _cfg
    import db
    import gate as _gate
    import voice_protocol as vp
    async with db.scoped_tx(scope) as con:
        a = await _assemble.assemble(con, scope, utterance)
    client = vp._anthropic()
    if client is None:
        return None
    sysp = ("Eres Rocoto, resolviendo algo que dijiste que ibas a comprobar en una llamada. Responde en "
            "UNA o dos frases habladas, natural, USANDO SOLO el contexto. Si de verdad no consta, dilo con "
            "naturalidad ('lo he mirado y no me consta, te lo confirmo y te digo'). Nada de listas.")
    user = (a.get("rendered", "") + f"\n\nLo que la persona preguntó en la llamada: «{utterance}»\n"
            "Tu respuesta breve, ya con el dato en la mano:")
    resp = await client.messages.create(model=_cfg.VOICE_CHAT_MODEL, max_tokens=200,
                                        system=sysp, messages=[{"role": "user", "content": user}])
    ans = "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", None) == "text").strip()
    if not ans:
        return None
    if aid:
        async with db.scoped_tx(scope) as con:
            await con.execute("update action set state='executed', outcome=$2 where id=$1",
                              aid, {"answer": ans})
    return {"say": ans, "money": bool(_gate.extract_prices(ans.lower()))}


async def _api_run(scope: str, utterance: str, ctx: dict, **kw) -> Optional[dict]:
    return None   # the externals contract — a real integration registers its own trigger + run


register("recall_refresh", trigger=_recall_trigger, run=_recall_run, expected_ms=900, stall="micro")
register("aside_resolve", run=_aside_run, expected_ms=3000, stall="filler")
register("api_check", run=_api_run, expected_ms=2500, stall="filler")
