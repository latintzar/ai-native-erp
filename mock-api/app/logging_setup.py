"""Structured logs, redacted at the door (FEED-IA §196.5 «nothing half assed»).

One JSON object per line on stdout, which is where journald reads it. Every message and every
formatted argument passes through `redact()` first, so a provider that echoes our key back inside
an error string cannot write it into the journal. The redaction lives in the FORMATTER rather than
at each call site, because a rule that depends on every future caller remembering it is not a rule.
"""
from __future__ import annotations

import json
import logging
import sys
import time

from .config import redact


class JsonLine(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": redact(record.getMessage()),
        }
        # `tokens` joined the list with the Copilot (E198): what an answer COST is a fact about the
        # call, like its milliseconds, and it belongs on the same line as the rest of them.
        for key in ("request_id", "route", "status", "ms", "tokens", "provider", "kind", "call_sid", "outcome"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = redact(value) if isinstance(value, str) else value
        if record.exc_info:
            payload["exc"] = redact(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False)


def configure(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLine())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    # Provider HTTP paths can contain private account and message IDs.
    for name in ("httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)
    # uvicorn's own access log would print a second, unredacted line per request; the middleware in
    # main.py logs the same facts in this format, so the duplicate is silenced rather than trusted.
    for name in ("uvicorn.access",):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = False
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = [handler]
        logging.getLogger(name).propagate = False
