"""Modular scheduled tasks + the recommendation→accept loop (employee-scheduled-tasks.md).

Each job runs INCREMENTALLY (a durable watermark cursor), under a per-task advisory lock (the timer
and a manual "Run now" can't race), and ALWAYS writes last_result (ok | error | skipped). Jobs are
DETERMINISTIC heuristics over the seeded/real history (the LLM is the once-a-week rule AUTHOR, not the
runtime); they emit recommendation cards. The owner accepts a card → a concrete behaviour change:
  asap/qty/autoaccept → an accept_rules row (the engine's deterministic envelope)
  customization       → a customization accept_rule + the option appended to the SKU (no longer rogue)
  consolidation       → a staged proactive-WhatsApp draft (owner still confirms the send)
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

import config
import db

log = logging.getLogger("rocoto.tasks")

EPOCH = "1970-01-01T00:00:00+00:00"

# task_key → (agent_id, job_fn). Job fn: (con, since_iso, tenant) -> (recs, new_cursor_iso, scanned)
def _registry():
    return {
        "ecom.standardize_customizations": ("ecom", _job_standardize_customizations),
        "ecom.asap_patterns": ("ecom", _job_asap_patterns),
        "delivery.consolidation": ("deliveries", _job_consolidation),
        "orders.autoaccept_patterns": ("orders", _job_autoaccept_patterns),
    }


def task_catalog() -> List[Dict[str, str]]:
    return [{"task_key": k, "agent_id": v[0]} for k, v in _registry().items()]


# ── task row plumbing ───────────────────────────────────────────────────────────────────────
async def _ensure_task(tenant: str, agent_id: str, task_key: str) -> None:
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            """insert into agent_tasks (id, tenant_id, agent_id, task_key, watermark)
                 values ($1,$2,$3,$4,$5)
               on conflict (tenant_id, task_key) do nothing""",
            f"atk_{task_key}__{tenant}", tenant, agent_id, task_key, {"cursor_ts": EPOCH, "version": 1})


def _cursor(wm: Any) -> str:
    if isinstance(wm, dict):
        return wm.get("cursor_ts") or EPOCH
    return EPOCH


async def _write_result(con, tenant: str, task_key: str, result: dict, advance: Optional[str]) -> None:
    if advance:
        await con.execute(
            """update agent_tasks set last_run_at=now(), last_result=$3, running=false,
                 watermark = jsonb_set(coalesce(watermark,'{}'::jsonb), '{cursor_ts}', to_jsonb($4::text)),
                 updated_at=now() where tenant_id=$1 and task_key=$2""",
            tenant, task_key, result, advance)
    else:
        await con.execute(
            """update agent_tasks set last_run_at=now(), last_result=$3, running=false, updated_at=now()
                 where tenant_id=$1 and task_key=$2""",
            tenant, task_key, result)


async def run_task(task_key: str, *, force: bool = False, source: str = "manual",
                   tenant: Optional[str] = None) -> Dict[str, Any]:
    tenant = tenant or config.BRAIN_TENANT
    spec = _registry().get(task_key)
    if not spec:
        return {"status": "error", "error": f"unknown task {task_key}"}
    agent_id, fn = spec
    await _ensure_task(tenant, agent_id, task_key)
    pool = db.get_pool()
    t0 = time.monotonic()
    async with pool.acquire() as con:
        if not force:
            enabled = await con.fetchval(
                "select enabled from agent_tasks where tenant_id=$1 and task_key=$2", tenant, task_key)
            if not enabled:
                res = {"status": "skipped", "reason": "disabled", "source": source}
                await _write_result(con, tenant, task_key, res, advance=None)
                return res
        got = await con.fetchval(
            "select pg_try_advisory_lock(hashtext($1)::bigint)", f"task:{tenant}:{task_key}")
        if not got:
            return {"status": "skipped", "reason": "locked"}
        try:
            wm = await con.fetchval(
                "select watermark from agent_tasks where tenant_id=$1 and task_key=$2", tenant, task_key)
            since = _cursor(wm)
            recs, new_cursor, scanned = await fn(con, since, tenant)
            produced = 0
            for rec in recs:
                await _upsert_rec(con, tenant, agent_id, task_key, rec)
                produced += 1
            res = {"status": "ok", "scanned": scanned, "produced": produced,
                   "ran_ms": int((time.monotonic() - t0) * 1000), "source": source,
                   "run_id": uuid.uuid4().hex[:12], "ts": db.now_iso().isoformat()}
            await _write_result(con, tenant, task_key, res, advance=new_cursor)
            return res
        except Exception as e:
            log.exception("task %s failed", task_key)
            res = {"status": "error", "error": str(e)[:300], "source": source,
                   "ts": db.now_iso().isoformat()}
            await _write_result(con, tenant, task_key, res, advance=None)
            return res
        finally:
            await con.execute(
                "select pg_advisory_unlock(hashtext($1)::bigint)", f"task:{tenant}:{task_key}")


async def run_all_due(tenant: Optional[str] = None, *, source: str = "timer") -> Dict[str, Any]:
    out = {}
    for task_key in _registry():
        out[task_key] = await run_task(task_key, source=source, tenant=tenant)
    return out


async def _upsert_rec(con, tenant: str, agent_id: str, task_key: str, rec: dict) -> None:
    rid = "rec_" + uuid.uuid4().hex[:16]
    await con.execute(
        """insert into agent_recommendations (id, tenant_id, agent_id, task_key, kind, dedupe_key, payload, seeded)
             values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (tenant_id, task_key, dedupe_key) do update
             set payload=excluded.payload
             where agent_recommendations.status='open'""",   # never re-raise a dismissed/accepted card
        rid, tenant, agent_id, task_key, rec["kind"], rec.get("dedupe_key", ""), rec.get("payload", {}),
        rec.get("seeded", False))


# ── the 4 jobs (deterministic heuristics over the order/message history) ─────────────────────
def _parse_iso(s: str):
    from datetime import datetime, timezone
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return datetime(1970, 1, 1, tzinfo=timezone.utc)


async def _scan_orders(con, since: str, tenant: str) -> List[dict]:
    rows = await con.fetch(
        "select id, phone_number, customer_name, lines, status, created_at, seeded "
        "from orders where created_at > $1 and tenant_id = $2 order by created_at asc",
        _parse_iso(since), tenant)
    return [dict(r) for r in rows]


def _max_cursor(rows: List[dict], since: str) -> str:
    c = since
    for r in rows:
        ts = r.get("created_at")
        if ts is not None:
            iso = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            if iso > c:
                c = iso
    return c


async def _job_standardize_customizations(con, since: str, tenant: str) -> Tuple[List[dict], str, int]:
    rows = await _scan_orders(con, since, tenant)
    clusters: Dict[Tuple[Any, str], dict] = {}
    for r in rows:
        for ln in (r.get("lines") or []):
            val = (ln.get("customization") or ln.get("note") or "").strip()
            if not val or len(val) > 40:
                continue
            key = (ln.get("sku_id"), val.lower())
            c = clusters.setdefault(key, {"support": 0, "sku": ln.get("sku_id"), "value": val})
            c["support"] += 1
    recs = []
    for (sku, valnorm), c in clusters.items():
        if c["support"] >= 3:
            recs.append({"kind": "customization", "seeded": False,
                         "dedupe_key": f"cust:{sku}:{valnorm}",
                         "payload": {"sku": sku, "option_key": "format", "option_value": c["value"],
                                     "support": c["support"]}})
    return recs, _max_cursor(rows, since), len(rows)


def _envelope_recs(rows: List[dict], kind: str, dedupe_prefix: str, max_total: int) -> List[dict]:
    qty_by: Dict[Any, dict] = {}
    for r in rows:
        if r.get("status") not in ("approved", "sent"):
            continue
        for ln in (r.get("lines") or []):
            sku = ln.get("sku_id")
            if not sku:
                continue
            d = qty_by.setdefault(sku, {"qtys": [], "cat": ln.get("family"), "name": ln.get("item")})
            d["qtys"].append(float(ln.get("qty") or 0))
    recs = []
    for sku, d in qty_by.items():
        qs = sorted(d["qtys"])
        if len(qs) >= 3:
            iamax = qs[max(0, int(len(qs) * 0.9) - 1)]
            recs.append({"kind": kind, "seeded": False, "dedupe_key": f"{dedupe_prefix}:{sku}",
                         "payload": {"kind": kind, "pattern": {
                             "max_qty_per_line": max(qs), "skus": [sku], "no_customizations": True,
                             "delivery_window": "next_day_am", "max_total_eur": max_total,
                             "instant_accept_max": iamax},
                             "support": f"{len(qs)} accepted"}})
    return recs


async def _job_asap_patterns(con, since: str, tenant: str) -> Tuple[List[dict], str, int]:
    rows = await _scan_orders(con, since, tenant)
    return _envelope_recs(rows, "asap", "asap", 600), _max_cursor(rows, since), len(rows)


async def _job_autoaccept_patterns(con, since: str, tenant: str) -> Tuple[List[dict], str, int]:
    rows = await _scan_orders(con, since, tenant)
    return _envelope_recs(rows, "autoaccept", "autoaccept", 400), _max_cursor(rows, since), len(rows)


async def _job_consolidation(con, since: str, tenant: str) -> Tuple[List[dict], str, int]:
    rows = await _scan_orders(con, since, tenant)
    freq: Dict[str, dict] = {}
    for r in rows:
        ph = r.get("phone_number") or ""
        if not ph:
            continue
        d = freq.setdefault(ph, {"n": 0, "name": r.get("customer_name")})
        d["n"] += 1
    recs = []
    for ph, d in freq.items():
        if d["n"] >= 2:
            recs.append({"kind": "consolidation", "seeded": False, "dedupe_key": f"consol:{ph}",
                         "payload": {"customer_phone": ph, "customer_name": d.get("name"),
                                     "opportunity": f"{d['n']} orders → 1 weekly",
                                     "draft_message": (f"We see you order {d['n']}× — consolidate to one "
                                                       "weekly delivery? We'd free a van and pass the saving on."),
                                     "route_delta": {"vans_freed": 1, "km_saved": 45}}})
    return recs, _max_cursor(rows, since), len(rows)


# ── recommendation → accept / dismiss loop ──────────────────────────────────────────────────
async def list_recommendations(agent_id: Optional[str] = None, *, tenant: Optional[str] = None,
                               status: str = "open") -> List[dict]:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con:
        if agent_id:
            rows = await con.fetch(
                "select * from agent_recommendations where tenant_id=$1 and agent_id=$2 and status=$3 "
                "order by created_at desc", tenant, agent_id, status)
        else:
            rows = await con.fetch(
                "select * from agent_recommendations where tenant_id=$1 and status=$2 order by created_at desc",
                tenant, status)
    return [dict(r) for r in rows]


async def get_tasks(agent_id: Optional[str] = None, *, tenant: Optional[str] = None) -> List[dict]:
    tenant = tenant or config.BRAIN_TENANT
    for k, (aid, _) in _registry().items():
        if agent_id is None or aid == agent_id:
            await _ensure_task(tenant, aid, k)
    pool = db.get_pool()
    async with pool.acquire() as con:
        if agent_id:
            rows = await con.fetch(
                "select * from agent_tasks where tenant_id=$1 and agent_id=$2 order by task_key", tenant, agent_id)
        else:
            rows = await con.fetch("select * from agent_tasks where tenant_id=$1 order by task_key", tenant)
    return [dict(r) for r in rows]


async def set_task(task_key: str, *, enabled: Optional[bool] = None, cadence: Optional[str] = None,
                   tenant: Optional[str] = None) -> Optional[dict]:
    tenant = tenant or config.BRAIN_TENANT
    spec = _registry().get(task_key)
    if not spec:
        return None
    await _ensure_task(tenant, spec[0], task_key)
    pool = db.get_pool()
    async with pool.acquire() as con:
        if enabled is not None:
            await con.execute("update agent_tasks set enabled=$3, updated_at=now() where tenant_id=$1 and task_key=$2",
                              tenant, task_key, enabled)
        if cadence is not None:
            await con.execute("update agent_tasks set cadence=$3, updated_at=now() where tenant_id=$1 and task_key=$2",
                              tenant, task_key, cadence)
        row = await con.fetchrow("select * from agent_tasks where tenant_id=$1 and task_key=$2", tenant, task_key)
    return dict(row) if row else None


async def accept_recommendation(rec_id: str, *, tenant: Optional[str] = None,
                                actor: str = "owner") -> Optional[Dict[str, Any]]:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con:
        async with con.transaction():
            row = await con.fetchrow(
                "select * from agent_recommendations where id=$1 and tenant_id=$2 for update", rec_id, tenant)
            if not row:
                return None
            rec = dict(row)
            if rec["status"] == "accepted":
                return {"status": "accepted", "result": rec.get("result"), "idempotent": True}
            kind = rec["kind"]
            payload = rec.get("payload") or {}
            result: Dict[str, Any] = {}
            seeded = bool(rec.get("seeded", False))
            if kind in ("asap", "qty", "autoaccept"):
                rid = "acr_" + uuid.uuid4().hex[:16]
                pattern = payload.get("pattern") or payload
                rule_kind = "qty" if kind == "qty" else "asap"
                await con.execute(
                    """insert into accept_rules (id, tenant_id, kind, scope, pattern, enabled, created_from, seeded)
                         values ($1,$2,$3,'tenant',$4,true,$5,$6)""",
                    rid, tenant, rule_kind, pattern, f"recommendation:{rec_id}", seeded)
                result = {"accept_rule_id": rid}
            elif kind == "customization":
                rid = "acr_" + uuid.uuid4().hex[:16]
                sku = payload.get("sku")
                val = payload.get("option_value")
                okey = payload.get("option_key", "format")
                await con.execute(
                    """insert into accept_rules (id, tenant_id, kind, scope, pattern, enabled, created_from, seeded)
                         values ($1,$2,'customization','tenant',$3,true,$4,$5)""",
                    rid, tenant, {"sku": sku, "option_key": okey, "option_value": val},
                    f"recommendation:{rec_id}", seeded)
                if sku:  # observable behaviour change: offer the option on the SKU
                    await con.execute(
                        "update catalogue_skus set customizations = coalesce(customizations,'[]'::jsonb) || $2::jsonb "
                        "where id=$1", sku, [{"option_key": okey, "value": val}])
                result = {"accept_rule_id": rid, "sku": sku, "option_value": val}
            elif kind == "consolidation":
                result = {"draft_id": "drf_" + uuid.uuid4().hex[:12],
                          "customer": payload.get("customer_phone"),
                          "message": payload.get("draft_message")}
            await con.execute(
                "update agent_recommendations set status='accepted', decided_at=now(), result=$2 where id=$1",
                rec_id, result)
            return {"status": "accepted", "result": result}


async def dismiss_recommendation(rec_id: str, *, tenant: Optional[str] = None) -> Optional[dict]:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "update agent_recommendations set status='dismissed', decided_at=now() "
            "where id=$1 and tenant_id=$2 and status='open' returning id, status", rec_id, tenant)
    return dict(row) if row else None


# ── CLI entrypoint (the systemd timers call this; employee-scheduled-tasks.md §2b) ──
if __name__ == "__main__":
    import asyncio as _asyncio
    import sys

    import db as _db

    async def _cli() -> None:
        await _db.init()
        argv = sys.argv[1:]
        cmd = argv[0] if argv else "run-due"
        if cmd == "run-due":
            res = await run_all_due(source="timer")
            log.info("run-due: %d jobs dispatched", len(res))
        elif cmd == "run":
            tk = argv[argv.index("--task") + 1] if "--task" in argv else None
            if not tk:
                print("usage: run --task <task_key>"); return
            print(await run_task(tk, force=True, source="manual"))
        elif cmd == "list":
            for t in await get_tasks():
                print(t.get("task_key"), "enabled=" + str(t.get("enabled")), "cadence=" + str(t.get("cadence")))
        else:
            print("commands: run-due | run --task <key> | list")

    _asyncio.run(_cli())
