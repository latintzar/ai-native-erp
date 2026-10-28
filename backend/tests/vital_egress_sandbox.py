"""vital_egress_sandbox.py — the CLASS-E floor (BUILD-PLAN §4.5 E / WP-0.5).

Under ROCOTO_EGRESS_SANDBOX, NO rail may reach a real party. This asserts every network send —
WhatsApp (both rails), email, outbound voice call — short-circuits to a sandbox sentinel with ZERO
network, so a rehearsal turn or a vital can never message/call/email a real human. Deterministic, no DB.

Run:  ROCOTO_EGRESS_SANDBOX=1 PYTHONPATH=. venv/bin/python tests/vital_egress_sandbox.py
"""
import asyncio
import os

os.environ.setdefault("ROCOTO_EGRESS_SANDBOX", "1")  # the harness also exports it; belt-and-suspenders

import config  # noqa: E402

R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def main():
    ck("config.EGRESS_SANDBOX flag honored from env", config.EGRESS_SANDBOX)
    import actions
    import twilio_wa

    wa = await twilio_wa.send_whatsapp("+34999000123", "this must never leave the box")
    ck("send_whatsapp suppressed (sandbox sentinel, no Twilio/cloud call)", wa == "SANDBOX-wa", repr(wa))

    em = await actions.send_email("nobody@example.com", "must not send", "<p>x</p>")
    ck("send_email suppressed (returns ok, no Resend HTTP)", em is True)

    call = await twilio_wa.start_outbound_call("+34999000123", "https://example/twiml")
    ck("start_outbound_call suppressed (no Twilio voice call)", call == "SANDBOX-call", repr(call))

    # WP-2.5 dirty-rehearsal find: the floor must cover EVERY raw Resend sender, not just actions.py —
    # the dispatch email (the daily Excel!), the customer notify and the onboarding email all send raw.
    import orders
    dm = await orders.send_email_async("nobody@example.com", "must not send", "<p>x</p>",
                                       attachment_name="a.xlsx", attachment_bytes=b"x")
    ck("orders.send_email_async (dispatch Excel rail) suppressed",
       dm.get("ok") and dm.get("id") == "SANDBOX-email", repr(dm))

    from brain import notify as brain_notify
    nm = await brain_notify._send_email("nobody@example.com", "must not send", "<p>x</p>")
    ck("brain.notify._send_email suppressed", nm.get("ok") and nm.get("id") == "SANDBOX-email", repr(nm))

    from brain import onboarding as brain_onboarding
    om = await brain_onboarding._send("nobody@example.com", "must not send", "<p>x</p>")
    ck("brain.onboarding._send (wizard-link rail) suppressed",
       om.get("ok") and om.get("id") == "SANDBOX-email", repr(om))

    # Provider-boundary regression: make every possible HTTP/Twilio client construction explode.
    # A sandboxed rail must return its fake success before credentials, media resolution or a
    # provider client are touched. These doubles make the test safe even against the unfixed code.
    import whatsapp_cloud as wc
    from brain import notify as brain_notify

    forbidden_attempts = []

    class _ForbiddenNetwork:
        def __init__(self, *args, **kwargs):
            forbidden_attempts.append("HTTP client")
            raise AssertionError("sandbox leak constructed an HTTP client")

    def _forbidden_twilio(*args, **kwargs):
        forbidden_attempts.append("Twilio client")
        raise AssertionError("sandbox leak constructed a Twilio client")

    async def _sandbox_result(name, call, expected):
        attempts_before = len(forbidden_attempts)
        try:
            got = await call()
        except Exception as e:
            ck(name, False, f"{type(e).__name__}: {e}")
            return
        new_attempts = forbidden_attempts[attempts_before:]
        ck(name, expected(got) and not new_attempts,
           f"result={got!r}, forbidden clients={new_attempts!r}")

    old_http = wc.httpx.AsyncClient
    old_twilio = twilio_wa._client
    old_typing = twilio_wa._get_typing_client
    old_cloud_token = config.WA_CLOUD_TOKEN
    old_cloud_phone = config.WA_CLOUD_PHONE_ID
    old_twilio_sid = config.TWILIO_ACCOUNT_SID
    old_twilio_token = config.TWILIO_AUTH_TOKEN
    old_sms_service = config.TWILIO_MESSAGING_SERVICE_SID
    try:
        wc.httpx.AsyncClient = _ForbiddenNetwork
        twilio_wa._client = _forbidden_twilio
        twilio_wa._get_typing_client = _forbidden_twilio
        config.WA_CLOUD_TOKEN = "sandbox-test-token"
        config.WA_CLOUD_PHONE_ID = "15550000000"
        config.TWILIO_ACCOUNT_SID = "ACsandbox"
        config.TWILIO_AUTH_TOKEN = "sandbox-token"
        config.TWILIO_MESSAGING_SERVICE_SID = "MGsandbox"

        def is_wa(got):
            return got == "SANDBOX-wa"
        await _sandbox_result("Cloud text suppressed before Graph HTTP",
                              lambda: wc.send_text("+34999000123", "x"), is_wa)
        await _sandbox_result("Cloud media suppressed before URL fetch/upload/Graph HTTP",
                              lambda: wc.send_media("+34999000123", "https://invalid.example/x.ogg"),
                              is_wa)
        await _sandbox_result("Cloud template suppressed before Graph HTTP",
                              lambda: wc.send_template("+34999000123", "approved_template"), is_wa)
        await _sandbox_result("Cloud reaction suppressed at shared message boundary",
                              lambda: wc.send_reaction("+34999000123", "wamid.TARGET", "👍"), is_wa)
        await _sandbox_result("Cloud interactive suppressed at shared message boundary",
                              lambda: wc.send_interactive_buttons(
                                  "+34999000123", "Choose", [{"id": "a", "title": "A"}]), is_wa)
        await _sandbox_result("Cloud typing suppressed with fake success",
                              lambda: wc.send_typing_indicator("wamid.INBOUND"), lambda got: got is True)
        await _sandbox_result("Cloud media upload suppressed before Graph HTTP",
                              lambda: wc.upload_media(b"x", "image/png"),
                              lambda got: got == "SANDBOX-media")
        await _sandbox_result("Twilio template suppressed before SDK client",
                              lambda: twilio_wa.send_template("+34999000123", "HXsandbox"), is_wa)
        await _sandbox_result("Twilio typing suppressed with fake success",
                              lambda: twilio_wa.send_typing_indicator("SMsandbox"),
                              lambda got: got is True)
        await _sandbox_result("customer notification SMS suppressed before SDK client",
                              lambda: brain_notify._send_sms("+34999000123", "x"),
                              lambda got: got.get("ok") and got.get("sid") == "SANDBOX-sms")
    finally:
        wc.httpx.AsyncClient = old_http
        twilio_wa._client = old_twilio
        twilio_wa._get_typing_client = old_typing
        config.WA_CLOUD_TOKEN = old_cloud_token
        config.WA_CLOUD_PHONE_ID = old_cloud_phone
        config.TWILIO_ACCOUNT_SID = old_twilio_sid
        config.TWILIO_AUTH_TOKEN = old_twilio_token
        config.TWILIO_MESSAGING_SERVICE_SID = old_sms_service

    passed = sum(R)
    print(f"\nEGRESS SANDBOX: {passed}/{len(R)} — "
          f"{'CLASS-E FLOOR HOLDS (no rail can reach a real party)' if passed == len(R) else 'LEAK — DO NOT REHEARSE'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
