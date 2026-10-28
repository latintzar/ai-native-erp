#!/usr/bin/env python3
"""Run the prototype API for one commissioned development preview.

A dedicated preview (the Cedar channels preview at cedar-channels.soyrocoto.com) publishes this
file with `app/` through `deploy/development/`; its systemd unit executes it from the published
release and its root-owned environment file supplies provider configuration, the private state
directory and the preview's own callback origin. It binds loopback only: the host's Caddy route
terminates TLS for the preview's origin and proxies `/api/*` here.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8790)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Choose a port between 1024 and 65535.")
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=args.port, access_log=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
