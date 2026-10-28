"""The PIN CAPABILITY WATCHER — a once-a-week knock on a door Meta has not opened yet.

WHY THIS EXISTS (2026-07-26, empirically established — do not re-derive, it cost real probes):
  · Meta's Cloud API *validates* the pin shape
    {"type":"pin","pin":{"type":"pin"|"unpin","message_id":<wamid>,"expiration_days":1..30}} —
    it is a KNOWN message type, not an unrecognised field;
  · EXECUTING it answers 131000 on our WABA: the feature is built, just not enabled for us;
  · the public docs still list pinning as unsupported. Schema and docs disagree.
So the honest state is NOT-YET-AVAILABLE. The expensive failure mode is not the missing feature —
it is finding out MONTHS LATE that it opened, or burning probes rediscovering the same 131000. This
module makes the discovery automatic and free: one cheap knock a week, and the day it answers, Peter
is told and a durable flag remembers it forever.

THE SHAPE OF IT (deliberately the smallest thing that can work):
  · the raw contract lives in whatsapp_cloud.pin_message / unpin_message (the rail, not here);
  · this module owns the durable memory (`system_flags`: wa_pin_available + wa_pin_probe_last),
    the target choice, the single attempt, and the surface to Peter;
  · worker.run_pin_probe_once calls run_probe_once() on the ordinary tick — no new clock.

INERT BY DEFAULT, AND IMPOSSIBLE TO SPAM — seven guards, each of which alone stops a runaway:
  1. config.ROCOTO_WA_PIN_ENABLED defaults OFF → run_probe_once returns 0 having touched NOTHING
     (no DB read, no network), and the rail's senders refuse before building a payload anyway.
  2. BURNED ON SUCCESS: once wa_pin_available is true the probe never runs again, across restarts
     (the wa_watch precedent — a watcher that has learned its answer stops watching).
  3. DURABLE weekly gate: wa_pin_probe_last is a timestamp in the DB, not a process clock, so a
     crash-loop restarting every 20 seconds still probes at most once a week.
  4. ONE attempt per probe. No retry, no ladder, no backoff loop.
  5. The target is ALWAYS our own founder thread — never a customer. A pin that unexpectedly WORKS
     is visible in someone's chat; the only chat allowed to be surprised is Peter's own.
  6. EGRESS_SANDBOX short-circuits it (the class-E floor every rail here honours).
  7. On success we UNPIN immediately: the probe leaves no residue in the thread it knocked on.

Fail-soft throughout (BUILD-CONTRACT): a probe never raises into the worker tick, and a DB or
network fault is logged and retried next week — never escalated, never silently swallowed as
"still closed" (only a real 131000 means that).
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import config
import db
import tenancy

log = logging.getLogger("rocoto.pin_watch")

# The durable memory. Two keys in the tiny system_flags store (created for brain/wa_watch.py):
#   wa_pin_available — 'true' the day a probe succeeds. Never unset by code; survives restarts.
#   wa_pin_probe_last — ISO8601 UTC of the last ATTEMPT (success or 131000). The weekly gate.
FLAG_AVAILABLE = "wa_pin_available"
FLAG_PROBE_LAST = "wa_pin_probe_last"

# The founder's own WhatsApp thread — the only chat this probe is ever allowed to touch. Same env key
# ops.py reads, resolved here directly so importing this module never drags in the ops env loader.
PETER_PHONE = os.environ.get("SURFACE_PETER_PHONE", "+12025550110")

# Meta drops a pin/reaction whose target is older than 30 days. We aim well inside that so a target
# that ages between selection and the POST can never be the reason a probe "fails".
TARGET_MAX_AGE_DAYS = 20.0


# ─────────────────────────── the durable flag store ───────────────────────────

async def _flag_get(key: str) -> str:
    """Read one system_flags value. '' on ANY error (fail-soft: a DB hiccup must never be read as
    'the capability opened', and must never crash a worker tick)."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            val = await con.fetchval("select value from system_flags where key = $1", key)
        return (val or "").strip()
    except Exception as e:
        log.debug("pin_watch: flag read %s failed (treating as unset): %s", key, e)
        return ""


async def _flag_set(key: str, value: str) -> bool:
    """Upsert one system_flags value. Returns True on success — the caller must know, because the
    weekly gate depends on this write landing (a silently-lost stamp is a probe-every-tick bug)."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "insert into system_flags (key, value, updated_at) values ($1, $2, now()) "
                "on conflict (key) do update set value = $2, updated_at = now()",
                key, value)
        return True
    except Exception as e:
        log.warning("pin_watch: flag write %s=%r failed: %s", key, value, e)
        return False


async def is_pin_available() -> bool:
    """THE public read: has WhatsApp message pinning actually opened for our WABA? False on any error
    and False until a probe has succeeded — nothing may assume the capability it has not seen work."""
    return (await _flag_get(FLAG_AVAILABLE)).lower() == "true"


async def _probe_due(now: Optional[datetime] = None) -> bool:
    """The DURABLE weekly gate. True only when the last recorded attempt is older than
    ROCOTO_PIN_PROBE_SCAN_SEC. An unset/unparseable stamp means "never probed" → due."""
    raw = await _flag_get(FLAG_PROBE_LAST)
    if not raw:
        return True
    try:
        last = datetime.fromisoformat(raw)
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
    except ValueError:
        log.warning("pin_watch: unparseable %s=%r — treating as never probed", FLAG_PROBE_LAST, raw)
        return True
    interval = max(int(getattr(config, "ROCOTO_PIN_PROBE_SCAN_SEC", 7 * 24 * 3600)), 1)
    return (now or datetime.now(timezone.utc)) - last >= timedelta(seconds=interval)


# ─────────────────────────── the known-safe target ───────────────────────────

async def _probe_target() -> Optional[tuple[str, str]]:
    """(phone, wamid) of a message it is SAFE to pin, or None if we have none.

    Safe means all of: it is on PETER's own thread (never a customer's), it is one of OUR OWN
    outbound messages (role='assistant' — we never put a pin on someone else's words), it carries a
    real cloud-rail wamid (a Twilio SID is not pinnable), and it is comfortably inside Meta's 30-day
    window. If the probe ever succeeds, the visible effect lands in the one chat that should see it.
    Raises nothing — a DB fault returns None and the probe simply does not run this week."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            rec = await con.fetchrow(
                "select wa_message_id from whatsapp_messages "
                "where phone_number = $1 and role = 'assistant' "
                "  and wa_message_id like 'wamid.%' "
                "  and created_at > now() - ($2 || ' days')::interval "
                "order by created_at desc limit 1",
                PETER_PHONE, str(TARGET_MAX_AGE_DAYS))
    except Exception as e:
        log.warning("pin_watch: target lookup failed (skipping this week's probe): %s", e)
        return None
    if rec is None or not (rec["wa_message_id"] or "").startswith("wamid."):
        log.info("pin_watch: no recent outbound wamid on the founder thread — nothing safe to pin")
        return None
    return PETER_PHONE, rec["wa_message_id"]


# ─────────────────────────── the spine record ───────────────────────────

async def _event(kind: str, payload: dict, lane: str = "reasoning") -> None:
    """Record the probe on the founder scope's spine. Every attempt leaves a trace — an invisible
    capability check is exactly the kind of thing that later gets re-derived at cost. Fail-soft."""
    try:
        import spine
        scope = tenancy.scope_of(PETER_PHONE)      # WP-A1
        async with db.scoped_tx(scope) as con:
            await spine.append_event(con, scope, kind, "pin_watch", payload, lane=lane)
    except Exception:
        log.debug("pin_watch: %s event fail-soft", kind, exc_info=True)


# ─────────────────────────── the probe ───────────────────────────

async def probe_once() -> dict:
    """ONE attempt against ONE known-safe target. Returns a typed verdict — never raises.

      {"probed": False, "reason": …}                  nothing was sent (no target, sandbox, …)
      {"probed": True,  "available": False, …}        Meta answered 131000 — still not enabled
      {"probed": True,  "available": True,  …}        IT OPENED — flag flipped, Peter surfaced
      {"probed": True,  "available": False, "error": …}  a REAL fault (not 131000) — reported as one

    The 131000-vs-anything-else distinction is the point: only 131000 means "still closed". An auth
    failure or a network error read as "still closed" would hide a broken rail for weeks."""
    import whatsapp_cloud as wc

    if config.EGRESS_SANDBOX:
        log.info("[EGRESS_SANDBOX] pin capability probe suppressed")
        return {"probed": False, "reason": "egress_sandbox"}

    target = await _probe_target()
    if target is None:
        return {"probed": False, "reason": "no_safe_target"}
    phone, wamid = target

    # Stamp the attempt BEFORE making it. If the process dies mid-probe, the week is still spent —
    # a crash must never become a way to probe again immediately.
    await _flag_set(FLAG_PROBE_LAST, datetime.now(timezone.utc).isoformat())

    try:
        await wc.pin_message(phone, wamid, expiration_days=wc.PIN_MIN_EXPIRATION_DAYS)
    except wc.PinDisabledError:
        # Belt-and-braces: run_probe_once already checked the flag, so this is unreachable in the
        # worker path — but the rail's refusal is authoritative and is never treated as a verdict.
        return {"probed": False, "reason": "flag_off"}
    except Exception as e:  # noqa: BLE001 — the verdict IS the exception; classify, never propagate
        if wc.is_pin_not_enabled_error(e):
            log.info("pin_watch: pinning still not enabled for our WABA (131000) — will look again "
                     "in ~%ss", getattr(config, "ROCOTO_PIN_PROBE_SCAN_SEC", 7 * 24 * 3600))
            await _event("ops.pin_probe", {"result": "not_enabled", "code": wc.ERR_PIN_NOT_ENABLED,
                                           "target_wamid": wamid})
            return {"probed": True, "available": False, "reason": "131000"}
        log.warning("pin_watch: probe failed with something OTHER than 131000 — reporting it as the "
                    "fault it is, not as 'still closed': %s", e)
        await _event("ops.pin_probe", {"result": "error", "error": str(e)[:300],
                                       "target_wamid": wamid})
        return {"probed": True, "available": False, "error": str(e)[:300]}

    # ── IT OPENED ────────────────────────────────────────────────────────────────────────────────
    # Leave no residue: the probe borrowed a real message in Peter's thread, so unpin it at once.
    # Best-effort — a failed unpin must not cost us the discovery we just made.
    unpinned = True
    try:
        await wc.unpin_message(phone, wamid)
    except Exception as e:  # noqa: BLE001
        unpinned = False
        log.info("pin_watch: probe pinned successfully but the unpin failed (%s) — the pin expires "
                 "in %sd on its own", e, wc.PIN_MIN_EXPIRATION_DAYS)

    await _flag_set(FLAG_AVAILABLE, "true")
    await _event("ops.pin_available", {"target_wamid": wamid, "unpinned": unpinned}, lane="world")
    log.info("pin_watch: PINNING IS NOW AVAILABLE on our WABA — %s set, watcher burning itself",
             FLAG_AVAILABLE)

    try:
        import ops
        await ops.record_alert(
            "report",
            "WhatsApp: ya se pueden FIJAR mensajes (pinning) en nuestra cuenta. La API acaba de "
            "aceptar un pin de prueba en tu propio hilo (y lo he quitado enseguida). El código ya "
            "está listo: whatsapp_cloud.pin_message / unpin_message. Falta tu decisión — la "
            "capacidad 'pin_message' sigue DESACTIVADA en el manifiesto; actívala tú cuando quieras "
            "que Rocoto pueda fijar mensajes.")
    except Exception:
        log.exception("pin_watch: surfacing the good news to Peter failed (flag is already set)")

    return {"probed": True, "available": True, "unpinned": unpinned}


async def run_probe_once() -> int:
    """THE SCAN the worker calls each tick. Returns 1 if a probe was attempted, else 0.

    Cheapest possible in the overwhelmingly common case: with the flag off (the default) it returns
    on the first line, having done no DB work and no I/O at all. Never raises into the tick."""
    try:
        if not getattr(config, "ROCOTO_WA_PIN_ENABLED", False):
            return 0                      # inert: zero DB, zero network, zero cost
        if await is_pin_available():
            return 0                      # burned — the answer is known and durable
        if not await _probe_due():
            return 0                      # the durable weekly gate
        res = await probe_once()
        return 1 if res.get("probed") else 0
    except Exception:
        log.exception("pin_watch: probe scan failed — next tick retries (nothing was sent)")
        return 0
