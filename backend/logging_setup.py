"""Structured logs, redacted at the door — the kit runtime's `mock-api/app/logging_setup.py`,
ported to the product backend.

One JSON object per line on stdout, which is where journald reads it. Every message, every formatted
argument and every `extra=` value passes through `redact()` first, so a phone number, an email
address or a key that a provider echoed back at us inside an error string cannot reach the journal.
The redaction lives in the FORMATTER rather than at each call site, because a rule that depends on
every future caller remembering it is not a rule.

What redaction does NOT do is make it safe to log a message body: a customer's sentence is not
key-shaped, so nothing here can recognise it. Content is dropped at the call site (log its length or
its id); this file is the floor under that discipline, not a substitute for it.
"""
from __future__ import annotations

import json
import logging
import re
import sys
import time

import config

# The line's own keys. A writer's `extra=` reaches the journal only through this list, so a new field
# carrying a customer's words cannot ride in under a name nobody scans for (the kit's rule, §196.5).
FIELDS = ("request_id", "route", "status", "ms", "tokens", "provider", "kind",
          "call_sid", "msg_id", "scope", "tenant", "outcome", "n")

# A key-shaped token in free text (a provider's own error message can quote our key back at us).
_KEYISH = re.compile(r"\b(sk-ant|sk|rk|AC|SK|dg|pw|whsec|AIza)[-_a-zA-Z0-9]{16,}\b")
# A phone number in the INTERNATIONAL forms this product writes: `+34932211000`, `+34 932 21 10 00`,
# `whatsapp:+34…` (the prefix is stripped before it is logged, and the `+` survives either way) and
# the `0034…` dial form. `identity_phone.canon` produces E.164, so this is what a log line holds.
# Bounded to those two shapes on purpose: a rule loose enough to also catch a bare local number would
# catch every date and epoch in the journal with it, and a masked timestamp reads as a bug.
_PHONE = re.compile(r"(?<!\w)(?:\+|00)\d{1,3}(?:[ .\-]?\d){6,14}\b")
_EMAIL = re.compile(r"\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")


def _mask_phone(m: "re.Match[str]") -> str:
    """Keep the last four digits and nothing else. Four digits is what a human needs to recognise the
    number they are already looking at in the app; it is not enough to dial, or to identify anyone."""
    digits = re.sub(r"\D", "", m.group(0))
    if len(digits) < 8:            # too short to be a phone number — a price, an id, a count
        return m.group(0)
    return f"{'+' if m.group(0).startswith('+') else ''}…{digits[-4:]}"


def redact(text: str) -> str:
    """Mask the personal data and the secrets: emails keep their domain, phone numbers their last
    four digits, configured secrets and key-shaped tokens vanish entirely."""
    if not text:
        return text
    out = text
    for secret in _secrets():
        out = out.replace(secret, "[redacted]")
    out = _KEYISH.sub("[redacted]", out)
    out = _EMAIL.sub(lambda m: f"…@{m.group(2)}", out)
    return _PHONE.sub(_mask_phone, out)


def _secrets() -> tuple[str, ...]:
    """Every configured value that must never reach a log line or a traceback. Read per call so a
    rotated key redacts too; short values are skipped (a two-character 'secret' would eat the text)."""
    names = ("ROCOTO_API_KEY", "ROCOTO_AGENT_TOOL_SECRET", "FB_APP_SECRET", "WA_CLOUD_APP_SECRET",
             "WA_CLOUD_TOKEN", "WA_CLOUD_VERIFY_TOKEN", "TWILIO_AUTH_TOKEN", "TWILIO_API_KEY_SECRET",
             "ELEVENLABS_API_KEY", "ELEVENLABS_WEBHOOK_SECRET", "STRIPE_SECRET_KEY",
             "STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY_TEST", "STRIPE_WEBHOOK_SECRET_TEST",
             "ANTHROPIC_API_KEY", "DEEPGRAM_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY",
             "MEDUSA_SUBSCRIBER_TOKEN", "DEMO_PHONE_SIGNING_SECRET", "DEMO_TURNSTILE_SECRET",
             "ROCOTO_CAL_API_KEY", "ROCOTO_CAL_CLIENT_SECRET")
    g = vars(config)
    return tuple(v for v in (g.get(n) or "" for n in names) if isinstance(v, str) and len(v) >= 8)


class JsonLine(logging.Formatter):
    """One JSON object per record, everything textual passed through `redact()`."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
                  + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": redact(record.getMessage()),
        }
        for key in FIELDS:
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = redact(value) if isinstance(value, str) else value
        if record.exc_info:
            payload["exc"] = redact(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False)


def configure(level: str = "INFO") -> None:
    """Install the redacting formatter as the ROOT handler — this replaces logging.basicConfig, and
    it must run before anything else logs. Idempotent: the root's handlers are replaced, never added
    to, so a second call (a test, a reload) cannot double every line."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLine())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    # uvicorn's access log would print a second, unredacted line per request — and its line carries
    # the full path, which on this backend holds tokens (`/api/demo/stream/{token}`) and phone
    # numbers. Silenced rather than trusted; the routes log what they mean to say.
    for name in ("uvicorn.access",):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = False
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = [handler]
        logging.getLogger(name).propagate = False
