#!/usr/bin/env python3
"""Run a local Python proof with clean credentials and loopback-only sockets."""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python tools/offline-python.py [-m module | script] [arguments]")
    environment = {name: os.environ[name] for name in ("PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "TMPDIR") if name in os.environ}
    environment.update({"PYTHONPATH": str(ROOT / "tools/offline"), "PYTHONDONTWRITEBYTECODE": "1",
                        "ROCOTO_EGRESS_SANDBOX": "1", "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1",
                        "HF_HUB_DISABLE_TELEMETRY": "1", "DO_NOT_TRACK": "1"})
    raise SystemExit(subprocess.run([sys.executable, *sys.argv[1:]], env=environment).returncode)


if __name__ == "__main__":
    main()
