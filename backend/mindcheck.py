"""mindcheck.py — IS THE MIND ACTUALLY ABLE TO THINK? (2026-07-27)

THE INCIDENT THIS EXISTS FOR. On 2026-07-27 the Anthropic key ran out of credit on prod. Every model
call — `orders.extract_order_sync`, `brain/llm.py`, `runtime.py`, `voice_protocol.py` — began returning

    400 invalid_request_error: "Your credit balance is too low to access the Anthropic API."

and `/healthz` went on answering `{"ok": true, "degraded": []}`, because it probes the process, the DB
and the background heartbeats and had no opinion at all about the one faculty the product IS. A dead
mind read as a healthy box. That is the same failure mode as the agentmemory service that died silently
for six days: the thing that was down was the thing nothing watched.

TWO SENSES, because neither alone is honest:

  1. OBSERVED — every real model call reports its outcome here (`note_ok` / `note_fail`). This is free,
     it is the truth about production traffic, and it cannot be fooled by a probe that happens to work.
     But it is BLIND WITHOUT TRAFFIC, and this trade is bursty: orders land 05:00-07:00. A key that
     dies at midnight would be observed dead by the first restaurant, not by us.
  2. PROBED — a one-token call, cached hard, run ONLY when the observed sense has nothing fresh to say.
     This is what turns "we haven't noticed" into "we checked".

WHAT IT REFUSES TO DO:
  * It never claims the mind is UP on no evidence. With no observation and no probe the answer is
    `unknown`, never `ok` — that distinction is the entire lesson of the incident.
  * It never turns /healthz into a 503. A watchdog that restart-loops the service because a model
    provider is down would turn a billing problem into an outage. Same reasoning as the existing
    heartbeat staleness: surface it in `degraded`, keep answering 200.
  * It never blocks. The probe runs off-thread under a hard timeout; a slow provider must not make the
    liveness endpoint slow, because that is how a watchdog decides the box is dead.

TERMINAL vs TRANSIENT is the load-bearing distinction. A 429 or a 529 is the provider being busy and it
fixes itself; an auth failure or an exhausted balance does NOT fix itself and needs a human. Only the
second kind records an inbox alert ONCE per outage (re-armed on recovery), because an alert that
repeats every health poll is an alert nobody reads.
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any, Dict, Optional

log = logging.getLogger("rocoto.mindcheck")

# How long a successful observation stays fresh enough to skip the probe. Longer than any realistic gap
# between two orders inside a working morning, shorter than a quiet night.
FRESH_SEC = 900
# The probe's own cache. A dead key does not recover in ninety seconds, and a live one does not rot.
PROBE_TTL_SEC = 600
# Hard ceiling on the probe, well under any watchdog's patience.
PROBE_TIMEOUT_SEC = 6.0
# How long we refuse to probe again after a probe we could not COMPLETE. Without this, a merely SLOW
# provider makes every /healthz poll start a fresh probe (the outcome was never cached), each one
# holding an uncancellable `to_thread` worker — `asyncio.wait_for` abandons the await, never the
# thread — out of a default executor that is `cpu_count + 4` wide (SIX on the 2-core prod box) and
# shared with every model call, every transcription and every ffmpeg pass. /healthz then answers in
# ~8s instead of ~0.05s, `rocoto_watchdog.sh` curls it with `--max-time 10`, and two ticks later it
# runs `systemctl restart rocoto rocoto-worker`. That is a model provider being slow turned into a
# restart loop of the live service — the exact outcome the 200-not-503 rule above exists to prevent.
PROBE_COOLDOWN_SEC = 120.0

# The two shapes that mean A HUMAN MUST ACT. Matched on the provider's own wording as well as the
# status, because a 400 is otherwise indistinguishable from a malformed request on our side.
_CREDIT_RE = re.compile(r"credit balance is too low|insufficient.{0,20}credit|quota", re.I)

_state: Dict[str, Any] = {
    "ok_at": 0.0,          # last observed success
    "fail_at": 0.0,        # last observed failure
    "kind": "",            # terminal | transient
    "detail": "",          # a short human sentence, never a stack trace
    "probe_at": 0.0,
    "probe_ok": None,      # None = never probed
    "probe_kind": "",      # terminal | transient — why the last probe said down
    "probe_quiet_until": 0.0,  # a probe we could not complete: do not start another before this
    "paged": False,        # have we already told Peter about THIS outage?
}


def _classify(exc: BaseException) -> tuple[str, str]:
    """terminal (a human must act) vs transient (it fixes itself). Never raises."""
    name = exc.__class__.__name__
    msg = str(exc)
    status = getattr(exc, "status_code", None)
    if _CREDIT_RE.search(msg):
        return "terminal", "sin saldo en la API del modelo — hay que recargar"
    if status in (401, 403) or "authentication" in name.lower() or "permission" in name.lower():
        return "terminal", f"la clave del modelo no autentica ({name})"
    if status == 400:
        # A plain 400 is usually OUR bad request, not a dead provider. Recorded, never paged.
        return "transient", f"petición rechazada por el modelo ({name})"
    return "transient", f"{name}{f' {status}' if status else ''}"


def note_ok() -> None:
    """A real model call succeeded. Clears the outage and re-arms the page."""
    _state["ok_at"] = time.time()
    _state["kind"] = ""
    _state["detail"] = ""
    if _state["paged"]:
        log.info("mindcheck: model calls are succeeding again")
    _state["paged"] = False


def note_fail(exc: BaseException) -> None:
    """A real model call failed. Fail-soft — this must never raise into a live turn."""
    try:
        kind, detail = _classify(exc)
        _state["fail_at"] = time.time()
        _state["kind"] = kind
        _state["detail"] = detail
        if kind == "terminal":
            log.error("mindcheck: THE MIND CANNOT THINK — %s", detail)
    except Exception:
        log.debug("mindcheck.note_fail fail-soft", exc_info=True)


def _observed() -> Optional[str]:
    """`up` / `down` / None when we have observed nothing recent enough to say."""
    now = time.time()
    if _state["fail_at"] > _state["ok_at"] and _state["kind"] == "terminal":
        return "down"
    if now - _state["ok_at"] < FRESH_SEC:
        return "up"
    return None


def _probe_sync() -> tuple[bool, str, str]:
    """One token, the cheapest true answer there is. → (ok, detail, kind)."""
    import anthropic

    import config
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=0,
                                 timeout=PROBE_TIMEOUT_SEC)
    try:
        # The cheapest model the runtime already uses, so the probe can never be the thing that costs
        # money. It is asking "does this key work", not "is this model good".
        client.messages.create(model=config.VOICE_CHAT_MODEL, max_tokens=1,
                               messages=[{"role": "user", "content": "."}])
        return True, "", ""
    except Exception as e:  # noqa: BLE001 — the probe classifies, it never propagates
        kind, detail = _classify(e)
        if kind == "terminal":
            note_fail(e)
        return False, detail, kind


async def status(*, probe: bool = True) -> Dict[str, Any]:
    """{state: up|down|unknown, detail, source: observed|probe|none, since}.

    `unknown` is a real answer and the honest one when nothing has been observed and the probe is not
    available — it is what stops this from re-becoming a health check that says everything is fine.
    """
    obs = _observed()
    if obs == "down":
        # `_observed` only ever says down on a TERMINAL kind, so this branch is terminal by construction.
        return {"state": "down", "detail": _state["detail"], "source": "observed",
                "since": int(_state["fail_at"]), "terminal": True}
    if obs == "up":
        return {"state": "up", "detail": "", "source": "observed", "since": int(_state["ok_at"])}
    if not probe:
        return {"state": "unknown", "detail": "sin tráfico reciente", "source": "none", "since": 0}

    now = time.time()
    if _state["probe_ok"] is not None and now - _state["probe_at"] < PROBE_TTL_SEC:
        ok = bool(_state["probe_ok"])
        return {"state": "up" if ok else "down", "detail": "" if ok else _state["detail"],
                "source": "probe", "since": int(_state["probe_at"]),
                "terminal": (not ok) and _state["probe_kind"] == "terminal"}
    if now < _state["probe_quiet_until"]:
        # We tried recently and could not finish. Say so honestly and DO NOT start another one —
        # see PROBE_COOLDOWN_SEC: an uncached slow probe per health poll is how a slow provider
        # becomes a watchdog restart of the live service.
        return {"state": "unknown", "detail": "no se pudo comprobar", "source": "none", "since": 0}
    try:
        ok, detail, kind = await asyncio.wait_for(asyncio.to_thread(_probe_sync),
                                                  timeout=PROBE_TIMEOUT_SEC + 2)
    except Exception:
        # A probe we could not complete tells us nothing. It must not read as DOWN — that would page
        # Peter about our own timeout — and it must not read as UP. It must also not be retried on the
        # very next poll, or /healthz inherits the provider's latency forever.
        log.debug("mindcheck probe did not complete", exc_info=True)
        _state["probe_quiet_until"] = now + PROBE_COOLDOWN_SEC
        return {"state": "unknown", "detail": "no se pudo comprobar", "source": "none", "since": 0}
    _state["probe_at"] = now
    _state["probe_ok"] = ok
    _state["probe_kind"] = kind
    _state["probe_quiet_until"] = 0.0
    if ok:
        note_ok()
    return {"state": "up" if ok else "down", "detail": "" if ok else detail,
            "source": "probe", "since": int(now), "terminal": (not ok) and kind == "terminal"}


async def report_if_down(st: Dict[str, Any]) -> None:
    """Record one terminal-outage alert, re-armed by recovery. Monitoring reads degraded health."""
    if st.get("state") != "down" or not st.get("terminal") or _state["paged"]:
        return
    _state["paged"] = True
    try:
        import ops
        receipt = await ops.record_alert(
            "A", f"Model provider requires attention: {st.get('detail') or 'terminal failure'}.")
        if receipt.get("alert_id") is None:
            _state["paged"] = False  # Retry persistence on the next health poll.
    except Exception:
        _state["paged"] = False
        log.exception("mindcheck: could not persist the model outage")
