"""Preflight for the two optional database-writing rehearsal proofs."""

from __future__ import annotations

import os
import re
from urllib.parse import unquote, urlsplit


def require_rehearsal(database_name: str | None = None) -> str:
    """Validate explicit sandbox DSNs before importing or initializing the backend."""
    if os.environ.get("ROCOTO_EGRESS_SANDBOX") != "1":
        raise SystemExit("Rehearsal environment: set ROCOTO_EGRESS_SANDBOX=1")
    target = None
    for key in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        try:
            value = urlsplit(os.environ.get(key, ""))
            name = unquote(value.path.removeprefix("/"))
            endpoint = (value.hostname, value.port or 5432, name)
        except ValueError:
            raise SystemExit(f"Rehearsal environment: invalid {key}") from None
        # Keep this optional local proof's connection target entirely in the parsed URL.
        # PostgreSQL drivers also resolve routing/service options from query parameters.
        if value.query:
            raise SystemExit(
                f"Rehearsal environment: use plain PostgreSQL URLs for {key}; "
                "put host, port and database in the URL authority and path"
            )
        if (
            value.scheme not in {"postgres", "postgresql"}
            or not value.hostname
            or not re.fullmatch(r"(?:rocoto_)?(?:rehearsal|secfix)(?:_[a-z0-9]+)*", name)
        ):
            raise SystemExit(f"Rehearsal environment: set {key} to an explicit rehearsal database")
        if database_name is not None and name != database_name:
            raise SystemExit(f"Rehearsal environment: {key} must select {database_name}")
        if target is not None and endpoint != target:
            raise SystemExit("Rehearsal environment: all three DSNs must select the same database")
        target = endpoint
    assert target is not None
    return target[2]
