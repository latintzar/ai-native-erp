"""demo_reap.py — the /demo retention sweep, as a runnable unit (`python -m demo_reap`).

THE ENTRY POINT ONLY. Every line of the actual deletion lives in `demo_flow.reap()`, because the
demo's own request path calls the same function through `maybe_reap()` and two implementations of
«what does the demo keep» is how a published retention period drifts from the one performed.

WHY THIS EXISTS AT ALL. soyrocoto.com/privacy.html and /datos-seguridad.html both state a deletion
window for demo data. Until 2026-08-09 nothing deleted anything: no reaper for `tenants`,
`demo_sessions`, `demo_magic_links` or `catalogue_intake`; `voice_reply._sweep_dir` does not recurse
and `MEDIA_DIR/intake` is a subdirectory, so uploaded price lists sat on the box indefinitely. A
published retention period we do not perform is a false statement to the data subject (GDPR Art.
5(1)(e) + 13(2)(a)), not a missing feature.

Run by `rocoto-demo-reap.timer` nightly. Idempotent, bounded, fail-soft: running it twice costs
nothing, it can never be the statement that locks a table, and a failure is a log line rather than
a unit that wedges the timer.

    /opt/rocoto/venv/bin/python -m demo_reap            # the nightly pass
    /opt/rocoto/venv/bin/python -m demo_reap --dry-run  # count what WOULD go, delete nothing
"""
from __future__ import annotations

import asyncio
import logging
import sys

import logging_setup

logging_setup.configure()   # the redacting formatter, same as the backend's (logging_setup.py)
log = logging.getLogger("rocoto.demo_reap")


async def _preflight() -> None:
    """SAY IT OUT LOUD IF THE SWEEP CANNOT SEE ITS OWN POPULATION.

    2026-08-09: this unit ran nightly, exited 0, and logged `{'tenants': 0}` for a fortnight while
    the predicate it used (`slug like 'demo_%' and seeded is true`) matched nothing the current
    signup path creates. «Reaped zero» and «cannot reach anything» printed the same line. The
    discriminator is now `tenants.provisioned_via`, added by `db.py`'s ONBOARD_SCHEMA — which is
    applied FAIL-SOFT at boot, so «the column never landed» is a real state this box can be in.
    One query, once per run, so the failure appears in `journalctl -u rocoto-demo-reap` instead of
    being inferred from a zero months later."""
    import db
    async with db.get_pool().acquire() as con:
        col = await con.fetchval(
            "select 1 from information_schema.columns "
            "where table_name='tenants' and column_name='provisioned_via'")
    if not col:
        log.error("PREFLIGHT FAILED: tenants.provisioned_via does not exist on this database, so "
                  "the demo rung of the sweep reaches NOTHING and the published 90-day retention "
                  "window is not being performed. Restart the service (db.init applies the ALTER) "
                  "or apply it by hand.")


async def _main(dry: bool) -> int:
    import db
    import demo_flow
    await db.init()
    await _preflight()
    if dry:
        counts = await demo_flow.reap_preview()
        log.info("demo reap (DRY RUN) — would delete: %s", counts)
    else:
        # the unit runs from /opt/rocoto with the live .env, so this database IS the one that
        # wrote the bytes under MEDIA_DIR/intake — the only place the orphan pass is sound.
        counts = await demo_flow.reap(sweep_orphans=True)
        log.info("demo reap done: %s", counts)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main("--dry-run" in sys.argv)))
