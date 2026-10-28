"""narrate.py — Rocoto narrates his own build to Peter, in first person, in character.

Stream H of the one-go build (BUILD-SESSION-PROMPT.md): at every real milestone — an organ
lands, a vital goes green, a stream completes, a come-alive step, a seal, the demo flag flip —
Rocoto WhatsApps Peter himself, honestly pre-birth, Spanish, milestone cadence (never spam).

This is a STANDALONE CLI *and* an importable module. It rides the EXISTING proven send rail
(twilio_wa.send_whatsapp) so it inherits the live Twilio creds, and logs every send into
whatsapp_messages (role=assistant, message_text prefixed `NARRATE(build): ` so build narration
is grep-able and distinct from real assistant turns). The WhatsApp body Peter reads is clean;
only the DB log carries the prefix.

Design rules (deliberate):
  * FAIL-SOFT on send: narration is a nicety and must NEVER block or crash the build. A closed
    24h window (Twilio 63016) or any network hiccup prints a clear line and returns None; the
    build continues. Peter's replies reopen the window; until then narration silently pauses.
  * SELF-SUFFICIENT env: loads /opt/rocoto/.env (ROCOTO_ENV_FILE override) into os.environ BEFORE
    `import config`, so it works no matter how it's invoked (cron, ssh one-shot, the build driver).
  * OWN short-lived DB connection (never db.init()'s pool) so a milestone ping never boots the
    whole service machinery.

Usage:
    python narrate.py "Empezamos, jefe. 🌶️ …"          # text as arg
    echo "…" | python narrate.py                          # text on stdin (multiline-safe)
    python narrate.py --to +12025550110 "…"              # override recipient (default = Peter UK)
    python narrate.py --milestone streamA.spine "…"       # tag the milestone (goes to notes/log)
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

# Peter's UK number — the thread that is already open (contract: the 24h window is live).
PETER_UK = "+12025550110"

DEFAULT_ENV_FILE = os.environ.get("ROCOTO_ENV_FILE", "/opt/rocoto/.env")


def _load_env_file(path: str = DEFAULT_ENV_FILE) -> None:
    """Load KEY=VALUE lines from the prod .env into os.environ (only keys not already set).
    Skips comments/blanks. No-op if the file is absent (e.g. on leo-dev) so import never crashes."""
    p = Path(path)
    if not p.exists():
        return
    for raw in p.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        # Strip matching surrounding quotes if present.
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        if key and key not in os.environ:
            os.environ[key] = val


# Load env BEFORE importing config (config reads os.getenv at import time).
_load_env_file()

import config  # noqa: E402  (must follow env load)
import twilio_wa  # noqa: E402

LOG_PREFIX = "NARRATE(build): "


async def _log_to_db(to_phone: str, body: str, sid: Optional[str], milestone: Optional[str]) -> None:
    """Append the narration to whatsapp_messages (role=assistant), fail-soft."""
    import asyncpg
    logged = LOG_PREFIX + (f"[{milestone}] " if milestone else "") + body
    con = None
    try:
        con = await asyncpg.connect(config.DATABASE_URL)
        await con.execute(
            "insert into whatsapp_messages (id, phone_number, role, message_text, message_type, "
            "wa_message_id) values ($1,$2,$3,$4,$5,$6)",
            str(uuid.uuid4()), to_phone, "assistant", logged, "text", sid or None,
        )
    except Exception as e:  # pragma: no cover — logging must never break the build
        print(f"[narrate] db log failed (non-fatal): {e}", file=sys.stderr)
    finally:
        if con is not None:
            try:
                await con.close()
            except Exception:
                pass


async def narrate(text: str, to_phone: str = PETER_UK,
                  milestone: Optional[str] = None) -> Optional[str]:
    """Send one in-character build milestone to Peter and log it. Returns the Twilio SID or None.

    FAIL-SOFT: a send failure (closed 24h window, network) is printed and swallowed; the build
    goes on. The DB log records the attempt regardless so the narration trail stays complete."""
    text = (text or "").strip()
    if not text:
        print("[narrate] empty message — nothing to send", file=sys.stderr)
        return None
    sid: Optional[str] = None
    delivered = False
    try:
        sid = await twilio_wa.send_whatsapp(to_phone, text)
    except Exception as e:
        # 63016 = message outside the 24h window; anything else = transient. Never crash.
        print(f"[narrate] send failed (non-fatal, build continues): {e}", file=sys.stderr)

    # VERIFY DELIVERY — a SID is only "Twilio accepted it"; failures land async (the 2026-07-21
    # 63112 outage silently ate every narration while printing "sent"). Poll the real status and
    # never report success on a bare SID again.
    if sid:
        st: dict = {}
        for wait_s in (8, 15):
            await asyncio.sleep(wait_s)
            st = await twilio_wa.get_message_status(sid)
            if st.get("status") in ("delivered", "read", "failed", "undelivered"):
                break
        status = st.get("status", "unknown")
        if status in ("failed", "undelivered"):
            print(f"[narrate] ❌ WhatsApp DELIVERY FAILED (error {st.get('error_code')}) — falling back", file=sys.stderr)
            sid = None  # honest: nothing reached Peter on this rail
        else:
            # 'sent' = handed to WhatsApp, no failure seen; 'delivered'/'read' = confirmed.
            delivered = True
            print(f"[narrate] {'delivered' if status in ('delivered', 'read') else 'sent (no failure reported)'} → {to_phone}  status={status}")

    # FALLBACK RAIL — WhatsApp down must never make Rocoto mute: email Peter (Resend), plain.
    if not delivered:
        try:
            import actions
            ok = await actions.send_email(
                config._env("NARRATE_FALLBACK_EMAIL", config.NOTIFY_EMAIL),
                "Rocoto — narración (WhatsApp caído, te lo mando por aquí)",
                (text or "").replace("\n", "<br>"))
            print(f"[narrate] fallback email {'SENT' if ok else 'FAILED'}", file=sys.stderr)
        except Exception as e:
            print(f"[narrate] fallback email failed: {e}", file=sys.stderr)

    await _log_to_db(to_phone, text, sid, milestone)
    return sid


def _read_text(args_text: Optional[str]) -> str:
    if args_text:
        return args_text
    if not sys.stdin.isatty():
        return sys.stdin.read()
    return ""


def main() -> int:
    ap = argparse.ArgumentParser(description="Rocoto narrates his own build to Peter (Stream H).")
    ap.add_argument("text", nargs="?", help="message text (or pipe on stdin)")
    ap.add_argument("--to", default=PETER_UK, help=f"recipient +E.164 (default {PETER_UK})")
    ap.add_argument("--milestone", default=None, help="milestone tag for the log (e.g. streamA.spine)")
    a = ap.parse_args()
    body = _read_text(a.text)
    if not body.strip():
        print("usage: narrate.py \"message\"  (or pipe text on stdin)", file=sys.stderr)
        return 2
    sid = asyncio.run(narrate(body, to_phone=a.to, milestone=a.milestone))
    # Exit 0 even on a soft send-failure: the build must never abort on narration.
    return 0 if sid or True else 1


if __name__ == "__main__":
    raise SystemExit(main())
