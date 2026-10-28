"""sync.py — THE PANEL IS A VIEW OF THE SPINE (§17.39 · WP-E2).

Peter: «is it http? …server side like claude is. if you leave and come back it notices it's
off-sync and fades a syncing message with spinner and syncs to freshest across the whole app.»

THE LAW, and every piece of it is load-bearing:

 1. ONE CURSOR FOR THE WHOLE APP. `event.id` is already the tenant's single ordered history, so
    `as_of` is a spine sequence number — not a per-table timestamp. One number means "how fresh is
    this panel", and two stores can be compared without asking what they contain.
 2. A LIVE CHANNEL STREAMS THE HEAD. One SSE connection per session: heartbeat + `seq` ticks +
    COARSE invalidation hints (orders · review · brain · settings). Coarse on purpose — the hint
    says which shelf moved, the store refetches; sending diffs would make the wire a second source
    of truth, and then the panel could be wrong in a new way.
 3. COMING BACK IS DETECTED, NEVER ASSUMED. The client compares its stores' `as_of` to the head on
    reconnect / visibilitychange / online, and drops the veil until every store catches up.
 4. WRITES ARE ONLINE-ONLY on the desk. No silent queueing: «a supplier must never believe a change
    landed that did not». The offline-first surface is the reparto APK, which already queues.

WHY THE HEAD IS A QUERY AND NOT A COUNTER: a cached counter is a second thing that can be stale,
and the failure would be invisible — the panel would believe it was fresh. Reading max(id) for the
tenant is cheap (an indexed max) and cannot lie.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncIterator, Optional

import config
import db

log = logging.getLogger("rocoto.sync")

HEARTBEAT_S = 20          # under every proxy idle timeout we run behind
POLL_S = 2                # how often the streamer looks for a new head

# The coarse shelves a hint can name. A store subscribes to one; anything not listed here is not a
# hint, it is a bug — an unknown shelf would silently refresh nothing.
SHELVES = ("orders", "review", "brain", "settings", "chats", "customers")


async def head(tenant: Optional[str] = None) -> int:
    """The tenant's spine head — the largest event id it can see.

    Joins `scope_node` rather than parsing the scope path, so it is correct in BOTH scope shapes:
    flat `wa.<digits>` today and pathed `t.<slug>.wa.<digits>` once ROCOTO_SCOPE_PATHED is on
    (A1 §7). A cursor that only worked in one of them would go silently wrong at the flip.
    """
    slug = tenant or config.BRAIN_TENANT
    try:
        async with db.get_pool().acquire() as con:
            v = await con.fetchval(
                "select coalesce(max(e.id), 0) from event e "
                "join scope_node n on n.scope = e.scope "
                "where n.tenant_slug = $1", slug)
        return int(v or 0)
    except Exception:
        # Fail to ZERO, never to a guess: 0 reads as "I know nothing yet", which makes the client
        # refetch. A wrong-but-plausible head would make it believe it was already up to date.
        log.debug("sync head read fail-soft for %s", slug, exc_info=True)
        return 0


def _frame(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


async def stream(tenant: Optional[str] = None, since: int = 0) -> AsyncIterator[str]:
    """One SSE connection per session: the head, then ticks as it moves, then heartbeats.

    The first frame is ALWAYS the current head, so a client that reconnects learns immediately
    whether it is behind — without waiting for the next write. That is what makes «coming back is
    detected» true for a panel that was closed while nothing happened to it.
    """
    slug = tenant or config.BRAIN_TENANT
    last = int(since or 0)
    cur = await head(slug)
    yield _frame("head", {"seq": cur, "shelves": list(SHELVES)})
    last = cur
    idle = 0.0
    try:
        while True:
            await asyncio.sleep(POLL_S)
            idle += POLL_S
            cur = await head(slug)
            if cur > last:
                # WHICH shelves moved, coarsely: the types written since `last`, mapped to shelves.
                yield _frame("tick", {"seq": cur, "shelves": await shelves_since(slug, last)})
                last = cur
                idle = 0.0
            elif idle >= HEARTBEAT_S:
                # a heartbeat keeps proxies from closing an idle stream, and lets the client tell
                # "nothing happened" apart from "the connection died" — which are different states.
                yield _frame("beat", {"seq": last})
                idle = 0.0
    except asyncio.CancelledError:
        raise
    except Exception:
        log.debug("sync stream ended for %s", slug, exc_info=True)


# event.type prefix → the shelf a store subscribes to. Prefix-matched for the same reason
# behaviour.py matches order verbs by prefix: a new event type should land on the right shelf the
# day it is added, not the day someone remembers to extend a map.
_SHELF_OF = (
    ("order", "orders"),
    ("review", "review"),
    ("action", "review"),
    ("message", "chats"),
    ("msg.", "chats"),
    ("fact", "brain"),
    ("memory", "brain"),
    ("customer", "customers"),
    ("product.", "settings"),
    ("behaviour", "settings"),
    ("install", "settings"),
)


async def shelves_since(tenant: str, since: int) -> list[str]:
    """Which shelves moved since `since`. Unknown types map to nothing rather than to everything:
    a hint that always says "refresh it all" is the same as no hint, and it would make every write
    on the box cost every open panel a full refetch."""
    try:
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select distinct e.type from event e join scope_node n on n.scope = e.scope "
                "where n.tenant_slug = $1 and e.id > $2 limit 200", tenant, int(since))
    except Exception:
        log.debug("shelves_since fail-soft", exc_info=True)
        return list(SHELVES)          # cannot tell → refresh everything, and say so by doing it
    out: set[str] = set()
    for r in rows:
        t = (r["type"] or "").lower()
        for prefix, shelf in _SHELF_OF:
            if t.startswith(prefix):
                out.add(shelf)
    return sorted(out)
