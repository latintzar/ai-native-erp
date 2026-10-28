"""vital_mindcheck.py — A DEAD MIND MUST NOT READ AS A HEALTHY BOX (2026-07-27).

On 2026-07-27 the model key ran out of credit on prod. Every model call returned
`400 … "Your credit balance is too low"`, and `/healthz` went on answering
`{"ok": true, "degraded": []}` — it watched the process, the DB and the background heartbeats and had
no opinion about the one faculty the product IS. `mindcheck.py` was written that day. This file is the
proof that it is actually WIRED, because a health signal nobody proved is exactly the thing that was
missing in the first place.

  M1 THE ORDER RAIL REPORTS       — `orders.extract_order_sync` (the LAST rail an order arrives on)
                                    reports its outcome; a dead key there is a LOST ORDER.
  M2 THE BRAIN RAIL REPORTS       — `brain/llm.call_tool_sync` (matcher/decision/skuparse/stock).
  M3 TERMINAL ≠ TRANSIENT         — an exhausted balance / a bad key needs a human; a 429 or 529
                                    fixes itself. ONLY the first may ring Peter.
  M4 A TRANSIENT NEVER PAGES      — `report_if_down` is terminal-only (a provider blip must not place
                                    an outbound PHONE CALL to Peter).
  M5 IT NEVER CLAIMS UP ON NOTHING— no observation and no probe ⇒ `unknown`, never `ok`.
  M6 RECOVERY RE-ARMS THE PAGE    — one alert per outage, and a new outage can alert again.
  M7 NO SILENT SWALLOW ON THE FOLLOW-UP DECISION — `runtime.post_call_followup` records a model
                                    silence AS a silence, never as «sin seguimiento (no aporta)».

Every check is PURE: the Anthropic client is replaced, nothing leaves, no DB, no key needed.
Run: PYTHONPATH=. python3 tests/vital_mindcheck.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-vital-not-a-real-key")

import anthropic  # noqa: E402

import mindcheck  # noqa: E402

R, SKIPPED = [], []

# THE SDK FLOOR, and why this is a check and not a footnote. `orders.py`, `brain/skuparse.py` and
# `brain/understand.py` all catch `anthropic.OverloadedError`, which older SDKs do not export —
# `requirements.txt` pins no floor, and leo-dev's system interpreter carries 0.86.0 where it is
# ABSENT (prod's venv runs 0.116.0 where it is present). On such a box the except clause itself
# raises AttributeError, so a model failure is neither retried NOR reported: the very handler that
# calls `mindcheck.note_fail` is the line that explodes. The two rail checks below therefore SKIP
# loudly rather than fail on a box whose SDK could not run the rail in the first place.
SDK_OK = all(hasattr(anthropic, n) for n in
             ("OverloadedError", "RateLimitError", "APITimeoutError", "APIStatusError"))


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


def reset():
    mindcheck._state.update({"ok_at": 0.0, "fail_at": 0.0, "kind": "", "detail": "",
                             "probe_at": 0.0, "probe_ok": None, "probe_kind": "",
                             "probe_quiet_until": 0.0, "paged": False})


_CREDIT_MSG = ("Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', "
               "'message': 'Your credit balance is too low to access the Anthropic API…'}}")


class _CreditDead(anthropic.APIStatusError if SDK_OK else Exception):
    """WHAT THE SDK ACTUALLY RAISED on 2026-07-27, in the real class — a `BadRequestError`, i.e. an
    `APIStatusError`. The class matters and is not a detail: `brain/llm.call_tool_sync` reports to
    mindcheck from an `except anthropic.APIStatusError` clause, so a stub raising a bare `Exception`
    would pass through unreported and this file would be testing its own stub instead of the wiring.
    The SDK's own `__init__` wants a live httpx response, so it is bypassed deliberately."""
    status_code = 400

    def __init__(self):
        Exception.__init__(self, _CREDIT_MSG)
        self.response = None
        self.body = None

    def __str__(self):
        return _CREDIT_MSG


class _Unreachable(anthropic.APIConnectionError if SDK_OK else Exception):
    """The provider we cannot REACH — the other branch of `APIError`, and the one an
    `except APIStatusError` clause does not see. Same deliberate `__init__` bypass."""

    def __init__(self):
        Exception.__init__(self, "Connection error.")


class _Client:
    """Stands in for anthropic.Anthropic. `raiser` decides what the call does."""

    def __init__(self, raiser=None, **kw):
        self._raiser = raiser
        self.messages = self

    def create(self, **kw):
        if self._raiser:
            raise self._raiser()
        class _Blk:                      # a tool_use block the callers will accept
            type = "tool_use"
            name = kw.get("tools", [{}])[0].get("name", "record_order")
            input = {"is_order": False}
        class _Resp:
            content = [_Blk()]
        return _Resp()


def with_client(mod, raiser):
    """Point ONE module's `anthropic.Anthropic` at the stub for the duration of a call."""
    real = mod.anthropic.Anthropic
    mod.anthropic.Anthropic = lambda **kw: _Client(raiser, **kw)
    return real


def main():
    print(__doc__.splitlines()[0])

    # ── M1 · the order rail ──────────────────────────────────────────────────────────────────────
    import orders
    if not SDK_OK:
        skip("M1/M2 the two model rails", f"anthropic {getattr(anthropic, '__version__', '?')} does "
             "not export OverloadedError — this box cannot run the rails at all (see SDK_OK)")
        return tail()
    reset()
    real = with_client(orders, _CreditDead)
    try:
        orders.extract_order_sync("ponme 12 kg de paleta", "+34900000741")
    finally:
        orders.anthropic.Anthropic = real
    st = asyncio.run(mindcheck.status(probe=False))
    ck("⚑ M1 THE ORDER RAIL — a dead key on `orders.extract_order_sync` is DOWN in /healthz, not a "
       "log line (this is the rail an order actually arrives on)",
       st["state"] == "down" and st["source"] == "observed" and st.get("terminal") is True,
       f"{st['state']}/{st['detail']}")
    ck("M1 …and it says so in the boss's language, naming what a human must do",
       "saldo" in st["detail"], st["detail"])

    reset()
    real = with_client(orders, None)
    try:
        orders.extract_order_sync("hola", "+34900000741")
    finally:
        orders.anthropic.Anthropic = real
    st = asyncio.run(mindcheck.status(probe=False))
    ck("M1 a SUCCESSFUL extraction is observed too — the signal is free and rides real traffic",
       st["state"] == "up" and st["source"] == "observed", st["state"])

    # ── M2 · the brain rail ──────────────────────────────────────────────────────────────────────
    from brain import llm
    reset()
    real = with_client(llm, _CreditDead)
    try:
        try:
            llm.call_tool_sync("m", "s", "u", {"name": "t"}, "t")
        except Exception:
            pass
    finally:
        llm.anthropic.Anthropic = real
    st = asyncio.run(mindcheck.status(probe=False))
    ck("⚑ M2 THE BRAIN RAIL — `brain/llm.call_tool_sync` reports too (matcher · decision · skuparse · "
       "the stock reading all ride it)",
       st["state"] == "down" and st.get("terminal") is True, f"{st['state']}/{st['detail']}")
    # THE HOLE THIS CHECK NAMES (2026-07-27, brain/llm.py — not this file's to fix). That rail reports
    # from `except anthropic.APIStatusError`, and `APITimeoutError`/`APIConnectionError` are NOT
    # APIStatusErrors — they are the OTHER branch of `APIError`. So a provider we cannot REACH (DNS,
    # TLS, a hung socket, the 60s timeout) escapes unreported on every brain call. Recorded here as a
    # fact about today's code rather than a failing assertion, because the fix is one word in a file
    # this vital does not own: `except anthropic.APIError as e:`.
    reset()
    real = with_client(llm, _Unreachable)
    try:
        try:
            llm.call_tool_sync("m", "s", "u", {"name": "t"}, "t")
        except Exception:
            pass
    finally:
        llm.anthropic.Anthropic = real
    st_to = asyncio.run(mindcheck.status(probe=False))
    print(f"  [NOTE] a CONNECTION-level failure on the brain rail reports {st_to['state']!r} "
          f"(not 'down') — `except APIStatusError` misses APIConnectionError/APITimeoutError; "
          f"one-line fix in brain/llm.py: `except anthropic.APIError as e:`")

    # ── M3 · terminal vs transient ───────────────────────────────────────────────────────────────
    class _Overloaded(Exception):
        status_code = 529

    class _BadKey(Exception):
        status_code = 401

    ck("M3 an exhausted balance is TERMINAL (a human must act)",
       mindcheck._classify(_CreditDead())[0] == "terminal")
    ck("M3 a key that does not authenticate is TERMINAL",
       mindcheck._classify(_BadKey())[0] == "terminal")
    ck("M3 a 529 overload is TRANSIENT — it fixes itself and must never wake anyone",
       mindcheck._classify(_Overloaded())[0] == "transient")
    reset()
    mindcheck.note_fail(_Overloaded())
    st = asyncio.run(mindcheck.status(probe=False))
    ck("M3 …and a transient does NOT read as down: `unknown` (we have not observed a healthy call)",
       st["state"] == "unknown", st["state"])

    # ── M4 · a transient never pages ─────────────────────────────────────────────────────────────
    rung = []

    async def _fake_surface(cls, text, **kw):
        rung.append(cls)
        return {"alert_id": 1}

    import ops
    _orig = ops.record_alert
    ops.record_alert = _fake_surface
    try:
        reset()
        asyncio.run(mindcheck.report_if_down({"state": "down", "detail": "un 500 pasajero",
                                            "terminal": False}))
        ck("⚑ M4 A PROVIDER BLIP NEVER RINGS PETER — class A is a WhatsApp, then an email, then an "
           "OUTBOUND CALL; only a terminal outage earns that",
           rung == [], f"rung={rung}")
        reset()
        asyncio.run(mindcheck.report_if_down({"state": "down", "detail": "sin saldo", "terminal": True}))
        ck("M4 a TERMINAL outage records an inbox alert, once", rung == ["A"], f"rung={rung}")
        # ── M6 · one alert per outage, re-armed by recovery ──────────────────────────────────────
        asyncio.run(mindcheck.report_if_down({"state": "down", "detail": "sin saldo", "terminal": True}))
        ck("M6 the SAME outage does not ring twice (an alert that repeats is an alert nobody reads)",
           rung == ["A"], f"rung={rung}")
        mindcheck.note_ok()
        asyncio.run(mindcheck.report_if_down({"state": "down", "detail": "sin saldo", "terminal": True}))
        ck("M6 …and RECOVERY re-arms it, so the NEXT outage is heard", rung == ["A", "A"], f"rung={rung}")
    finally:
        ops.record_alert = _orig

    # ── M5 · never up on nothing ─────────────────────────────────────────────────────────────────
    reset()
    st = asyncio.run(mindcheck.status(probe=False))
    ck("⚑ M5 WITH NO EVIDENCE THE ANSWER IS `unknown`, NEVER `ok` — that distinction is the whole "
       "lesson of the incident",
       st["state"] == "unknown" and st["source"] == "none", f"{st['state']}/{st['source']}")
    reset()
    mindcheck._state["probe_quiet_until"] = mindcheck.time.time() + 60
    st = asyncio.run(mindcheck.status())
    ck("M5 a probe we could not COMPLETE is also `unknown` — never down (that would page Peter about "
       "our own timeout) and never up",
       st["state"] == "unknown" and st["detail"] == "no se pudo comprobar", st["detail"])

    # ── M7 · the follow-up decision does not turn silence into a judgement ───────────────────────
    import runtime
    reset()

    class _DeadAsync:
        def __init__(self, **kw):
            self.messages = self

        async def create(self, **kw):
            raise _CreditDead()

        async def close(self):
            pass

    _ra = runtime.anthropic.AsyncAnthropic if hasattr(runtime, "anthropic") else None
    import anthropic as _a
    _real_async = _a.AsyncAnthropic
    _a.AsyncAnthropic = lambda **kw: _DeadAsync(**kw)
    _real_scope = runtime.scope_of
    appended = []

    async def _run():
        # keep it entirely out of the database: the decision half is what is under test
        import spine
        _rap = spine.append_event

        async def _fake_append(con, scope, typ, src, payload, **kw):
            appended.append(payload.get("text", ""))
            return 0, True
        spine.append_event = _fake_append

        class _NullCM:
            async def __aenter__(self):
                return None

            async def __aexit__(self, *a):
                return False
        import db as _db
        _rtx = _db.scoped_tx
        _db.scoped_tx = lambda scope: _NullCM()
        try:
            return await runtime.post_call_followup("+34900000742", summary="hablamos de precios",
                                                    name="Casa Bermejo")
        finally:
            spine.append_event = _rap
            _db.scoped_tx = _rtx

    try:
        dec = asyncio.run(_run())
    finally:
        _a.AsyncAnthropic = _real_async
        runtime.scope_of = _real_scope

    st = asyncio.run(mindcheck.status(probe=False))
    ck("⚑ M7 A MODEL SILENCE IS RECORDED AS A SILENCE — never as «sin seguimiento (no aporta)», "
       "which is a decision nobody made and is what xray shows the boss",
       dec.get("decided") is False and dec.get("follow_up") is False
       and appended and "no pude decidir" in appended[-1], f"reasoning={appended[-1:]}")
    ck("M7 …and that failure is reported to mindcheck too (it was a model call like any other)",
       st["state"] == "down" and st.get("terminal") is True, f"{st['state']}/{st['detail']}")

    reset()
    return tail()


def tail():
    ok = sum(1 for r in R if r)
    print(f"\n  {ok}/{len(R)} checks pass" + (f"  ({len(SKIPPED)} skipped)" if SKIPPED else ""))
    sys.exit(0 if ok == len(R) else 1)


if __name__ == "__main__":
    main()
