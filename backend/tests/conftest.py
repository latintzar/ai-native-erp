"""Gate setup (medusa-integration.md §12): point the brain at its Postgres + the disposable Medusa.

The brain Postgres is config.DATABASE_URL (a pgvector instance). The "disposable Medusa" is the
running Medusa dev server on :9000 with the seeded catalogue — its custom /admin/sancho/* routes
give the drainer idempotent create + seeded-purge. Medusa-dependent tests skip cleanly when :9000
is not reachable, so the pure/engine gates still run anywhere.
"""
import os
import sys

# The owner allowlist is a deployment fact now: config.OWNER_EMAILS and config.MASTER_OWNER_EMAIL
# have no source defaults, so a box that elevates nobody is what an empty environment means. The RBAC
# tests need a box that DOES have owners, so they get one here — set before any test module imports
# `config`, which reads the environment once, at import.
os.environ.setdefault("MASTER_OWNER_EMAIL", "peter@leo.casa")
os.environ.setdefault("OWNER_EMAILS", "peter@leo.casa,owner@example.invalid,peter@rocoto.com")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()
