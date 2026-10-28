"""Read only Cedar's private, allowlisted signup reports; never initialize application state."""

from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
import stat
import sys
import time
from io import StringIO
from pathlib import Path
from urllib.parse import quote

from cryptography.fernet import Fernet
from dotenv import dotenv_values

TTL = 7 * 24 * 60 * 60
PATTERNS = {
    "attemptId": r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    "event": r"CANCEL|ERROR",
    "errorCode": r"[0-9]{1,12}",
    "currentStep": r"[A-Z_]{1,64}",
    "sessionId": r"[a-fA-F0-9-]{8,64}",
    "reportedAt": r"[0-9]{10,13}",
    "receiptId": r"[0-9a-f]{64}",
    "ownerHash": r"[0-9a-f]{64}",
    "source": r"browser_reported",
    "appId": r"[0-9]{1,40}",
    "configId": r"[0-9]{1,40}",
    "graphVersion": r"v[0-9]+\.[0-9]+",
}


def private_file(path):
    if not path.is_absolute() or path.resolve() != path:
        raise ValueError("A private ordinary file is required")
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
        raise ValueError("A private ordinary file is required")


def read_reports(env_file, limit=20, now=None):
    if not 1 <= limit <= 200:
        raise ValueError("The report limit must be between 1 and 200")
    env_file = Path(env_file)
    private_file(env_file)
    # Select the two local-storage settings before dotenv parsing; interpolation stays disabled.
    selected = "\n".join(
        line for line in env_file.read_text().splitlines()
        if re.match(r"\s*(?:export\s+)?CEDAR_PROOF_(STATE_DIR|ENCRYPTION_KEY)\s*=", line)
    )
    values = dotenv_values(stream=StringIO(selected), interpolate=False)
    directory = Path(values.get("CEDAR_PROOF_STATE_DIR") or "")
    if not directory.is_absolute() or directory.resolve() != directory or not directory.is_dir():
        raise ValueError("An existing private state directory is required")
    database = directory / "cedar-proof.sqlite3"
    private_file(database)
    cipher = Fernet((values.get("CEDAR_PROOF_ENCRYPTION_KEY") or "").encode())
    with sqlite3.connect(f"file:{quote(str(database), safe='/')}?mode=ro", uri=True) as con:
        con.execute("PRAGMA query_only=ON")
        row = con.execute("SELECT body FROM kv WHERE key='signup-diagnostics'").fetchone()
    if row is None:
        return []
    reports = json.loads(cipher.decrypt(row[0]))
    now = time.time() if now is None else now
    result = []
    for report in reports[-200:]:
        if not isinstance(report, dict):
            continue
        observed = report.get("observedAt")
        if (
            isinstance(observed, bool) or not isinstance(observed, (int, float))
            or not math.isfinite(observed) or not now - TTL < observed <= now
        ):
            continue
        safe = {
            key: report[key] for key, pattern in PATTERNS.items()
            if isinstance(report.get(key), str) and re.fullmatch(pattern, report[key])
        }
        safe["observedAt"] = observed
        result.append(safe)
    return result[-limit:]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", required=True, type=Path)
    parser.add_argument("--limit", default=20, type=int)
    args = parser.parse_args()
    try:
        reports = read_reports(args.env_file, args.limit)
    except Exception:
        print("Cedar signup reports require an existing private environment and database.", file=sys.stderr)
        return 2
    print(json.dumps(reports, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
