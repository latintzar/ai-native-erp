"""Central test/live isolation chokepoint for the onboarding / CRM tables.

WHY THIS EXISTS (the single most important safety invariant in the test-mode work): Supabase holds
IDENTITY ONLY — all app data lives in one self-hosted Postgres reached through one service connection,
so Postgres Row-Level Security protects nothing here. Test/prod isolation is enforced in the APPLICATION
LAYER, and the failure mode of app-layer filtering is "a single forgotten WHERE leaks data" (here: test
rows shown to, or a live customer's rank shifted by, real traffic). So every onboarding/CRM read/write
routes its test-flag predicate through THIS module: callers never hand-type the flag column, so they
cannot emit a predicate-less onboarding query, and a new onboarding table that isn't registered here
raises loudly instead of silently leaking.

Vocabulary: the onboarding/CRM tables use an `is_test` column; the pre-existing brain tables use
`seeded` (same meaning). `flag()` hides which. Mode is a trusted Python bool (False = LIVE, the default
everywhere) — NEVER user input — so `pred()` embeds the literal `true`/`false` rather than a bind param,
which keeps splicing into the existing hand-written multi-param SQL trivial and injection-safe.
"""
from __future__ import annotations

from typing import Any, Optional, Sequence

# False = LIVE (the default everywhere), True = TEST. Named for readability at call sites.
MODE_LIVE = False
MODE_TEST = True

# Which boolean column carries the test flag per table. Onboarding/CRM = `is_test`; brain = `seeded`.
# A table absent from this map is a bug: pred()/flag() raise rather than silently skip the filter.
TEST_FLAG: dict[str, str] = {
    # onboarding / CRM spine
    "leads": "is_test",
    "onboarding_tokens": "is_test",
    "onboarding_progress": "is_test",
    "waitlist": "is_test",
    "drip_state": "is_test",
    "calls_onboard": "is_test",
    "transcript_facts": "is_test",
    "events": "is_test",
    # brain side (pre-existing `seeded` column) — for symmetry / cross-table helpers
    "orders": "seeded",
    "whatsapp_messages": "seeded",
    "calls": "seeded",
    "catalogue_skus": "seeded",
    "customer_profiles": "seeded",
}

# Tables the guarded wipe may ever touch (the onboarding/CRM spine only — brain seed rows are wiped by
# the separate, proven brain/seed.clear_all_seeded path). An allowlist so a typo can't delete elsewhere.
_WIPE_ALLOWED = {
    "leads", "onboarding_tokens", "onboarding_progress", "waitlist",
    "drip_state", "calls_onboard", "transcript_facts", "events",
}
# id columns a scoped wipe may filter on (allowlisted — the value is interpolated into SQL).
_ID_COLS = {"lead_id", "token", "id", "call_id"}
# Refuse to delete more than this many test rows in a single call — a runaway backstop on top of the
# is_test predicate (an accidental live-wipe is already impossible; this catches "way more than a
# demo's worth" as a second signal something is wrong).
WIPE_CEILING = 100_000


def flag(table: str) -> str:
    """The test-flag column name for `table`. Raises on an unregistered table (fail-loud, never leak)."""
    try:
        return TEST_FLAG[table]
    except KeyError:
        raise ValueError(f"onboard_q: table {table!r} has no test-flag mapping (register it in TEST_FLAG)")


def pred(table: str, mode: bool, alias: str = "") -> str:
    """The SQL predicate to splice into a WHERE, e.g. `l.is_test = false`. `mode` is a trusted bool
    (False=live default), so the literal is embedded (no bind param → no $-renumbering in the many
    hand-written queries). `alias` optionally qualifies the column (for joined queries)."""
    col = flag(table)
    prefix = f"{alias}." if alias else ""
    return f"{prefix}{col} = {'true' if mode else 'false'}"


async def wipe_test(
    con,
    table: str,
    *,
    ids: Optional[Sequence[str]] = None,
    id_col: str = "lead_id",
    ceiling: int = WIPE_CEILING,
) -> int:
    """Delete ONLY test rows from `table`, count-verified, inside the CALLER'S transaction.

    Safe by construction: the flag predicate (`{flag}=true`) is ALWAYS present and is not caller-supplied,
    the table + id_col are allowlisted, and the delete is bracketed by count→delete→assert(equal) so a
    concurrent write (count≠deleted) rolls the whole transaction back rather than deleting a surprise set.
    Optionally scope to `ids` on `id_col` (e.g. a single owner's test leads). Returns rows deleted.

    NB: pass a `con` already inside `async with con.transaction():` so the assert can roll back."""
    if table not in _WIPE_ALLOWED:
        raise ValueError(f"wipe_test: table {table!r} is not in the wipe allowlist")
    if id_col not in _ID_COLS:
        raise ValueError(f"wipe_test: id_col {id_col!r} is not allowlisted")
    col = flag(table)
    where = f"{col} = true"
    params: list[Any] = []
    if ids is not None:
        id_list = [i for i in ids if i]
        if not id_list:
            return 0  # nothing in scope → delete nothing (never widen to the whole table)
        where += f" and {id_col} = any($1::text[])"
        params.append(list(id_list))

    n = int(await con.fetchval(f"select count(*) from {table} where {where}", *params) or 0)
    if n > ceiling:
        raise RuntimeError(
            f"wipe_test: refusing to delete {n} rows from {table} (ceiling {ceiling}) — aborting")
    if n == 0:
        return 0
    deleted = int(await con.fetchval(
        f"with d as (delete from {table} where {where} returning 1) select count(*) from d", *params
    ) or 0)
    if deleted != n:
        raise RuntimeError(
            f"wipe_test: count/delete mismatch on {table} ({n} counted, {deleted} deleted) — rolled back")
    return deleted
