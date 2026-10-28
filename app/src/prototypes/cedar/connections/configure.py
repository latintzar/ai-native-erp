"""Collect this development proof's company credentials through private terminal input.

Run on rocoto-dev as Peter. Values stay in a task-owned ignored 0600 environment file.
Existing values are preserved unless a replacement is entered. This does not call a provider.
"""
from __future__ import annotations

import argparse
import getpass
import os
import re
import secrets
import stat
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from cryptography.fernet import Fernet
from dotenv import dotenv_values


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-secret-only", action="store_true", help="Collect only the Meta app secret.")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[5]
    target = root / ".env.cedar-connections.local"
    if target.is_symlink():
        raise SystemExit("Choose an ordinary environment file owned by this task.")
    if target.exists():
        info = target.stat()
        if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
            raise SystemExit("The existing environment file requires current-user ownership and mode 0600.")
    values = {
        key: value for key, value in dotenv_values(target, interpolate=False).items() if value is not None
    }
    if args.app_secret_only:
        entered = getpass.getpass("Rocoto Meta app secret (private input): ")
        if not entered:
            raise SystemExit("Enter the existing Rocoto Meta app secret.")
        values["CEDAR_PROOF_APP_SECRET"] = entered
        save_values(root, target, values)
        return
    print("Cedar development connection setup. Enter keeps an existing value.")
    for name, default in (
        ("APP_ID", "1427034652248456"),
        ("CONFIG_ID", "4618748161700706"),
        ("PUBLIC_ORIGIN", ""),
    ):
        key = "CEDAR_PROOF_" + name
        entered = input(f"{key} ({'saved' if values.get(key) else default or 'required'}): ").strip()
        values[key] = entered or values.get(key, default)
    for name in ("APP_SECRET",):
        key = "CEDAR_PROOF_" + name
        entered = getpass.getpass(f"{key} ({'saved' if values.get(key) else 'required, private input'}): ")
        values[key] = entered or values.get(key, "")
    if not re.fullmatch(r"\d+", values["CEDAR_PROOF_APP_ID"]) or not re.fullmatch(
        r"\d+", values["CEDAR_PROOF_CONFIG_ID"]
    ):
        raise SystemExit("Use the numeric app and Login for Business configuration IDs from Meta.")
    try:
        origin = urlsplit(values["CEDAR_PROOF_PUBLIC_ORIGIN"])
        valid_port = origin.port is None or 1 <= origin.port <= 65535
    except ValueError:
        raise SystemExit("Enter the preview's approved HTTPS origin.") from None
    if (
        origin.scheme != "https" or not origin.hostname or not valid_port or origin.username
        or origin.path or origin.query or origin.fragment
        or len(values["CEDAR_PROOF_PUBLIC_ORIGIN"] + "/webhooks/whatsapp") > 200
    ):
        raise SystemExit("Enter the preview's approved HTTPS origin, such as https://cedar-demo.soyrocoto.com.")
    if not values["CEDAR_PROOF_APP_SECRET"]:
        raise SystemExit("Supply the company Meta app secret.")
    values.setdefault("CEDAR_PROOF_ENCRYPTION_KEY", Fernet.generate_key().decode())
    values.setdefault("CEDAR_PROOF_VERIFY_TOKEN", secrets.token_urlsafe(32))
    values.setdefault("CEDAR_PROOF_GRAPH_VERSION", "v26.0")
    values.setdefault("CEDAR_PROOF_STATE_DIR", str(Path.home() / ".local/share/rocoto/cedar-connections"))
    values.setdefault("CEDAR_PROOF_STATIC_DIR", str(root / "app/dist-cedar-connections"))
    save_values(root, target, values)


def save_values(root: Path, target: Path, values: dict[str, str]) -> None:
    # Single-quoted dotenv values preserve literal dollars; reject line breaks so one input
    # cannot introduce a second setting. This file is consumed by dotenv, never shell-evaluated.
    for key, value in values.items():
        if not re.fullmatch(r"[A-Z_][A-Z_0-9]*", key) or "\n" in value or "\r" in value:
            raise SystemExit("Environment names and values must each fit on one line.")
    lines = []
    for key, value in sorted(values.items()):
        escaped = value.replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"{key}='{escaped}'\n")
    fd, temporary = tempfile.mkstemp(prefix=".cedar-config-", dir=root)
    try:
        with os.fdopen(fd, "w") as handle:
            handle.writelines(lines)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
    finally:
        Path(temporary).unlink(missing_ok=True)
    print(f"Saved {target} with mode 0600. Provider approval and live verification remain separate steps.")


if __name__ == "__main__":
    main()
