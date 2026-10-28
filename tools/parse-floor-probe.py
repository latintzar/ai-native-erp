#!/usr/bin/env python3
"""THE PARSEWISE FLOOR PROBE — how much of a read is the provider, and how much is us (§PAR-10).

    «for the parsing and qr shit, which should work flawlessly»   — Peter, FEED-IA §198

THE-PARSING-SPEC PAR-06.2 measured one number for a read — «about two and a half minutes» — and
PAR-10 takes it apart. This probe does exactly what `mock-api/app/parsewise.py`'s `read_raw` does,
with two differences that make it a measurement rather than a service: it polls every **2 seconds**,
and it records, at every poll, the elapsed time and every agent's `extraction_status`. So the answer
to «when did the provider actually finish?» is read off the transcript instead of off the ladder
that happened to ask.

Run from a development checkout with explicitly supplied sandbox provider credentials and a
sample fixture. This creates a temporary Parsewise project and deletes it after measurement.
Export PARSEWISE_API_KEY from the sandbox account, then:

    .venv/bin/python tools/parse-floor-probe.py full albaran \
      --fixture mock-api/tests/fixtures/albaran-fixture.png --poll 2

MODES — each one varies exactly ONE thing against `full`, and the mode name says which
    setup-seq        project → upload → dimension → agents ONE AT A TIME → delete  (no launch)
    setup-par        project → upload ∥ dimension → agents TOGETHER → delete       (no launch)
    full             upload ∥ dimension · agents TOGETHER · launch · poll · results · delete
    full-seq         `full` with the ten agent POSTs QUEUED — everything else identical
    full-setup-seq   `full` with the upload and the dimension QUEUED — everything else identical

`full` against `full-seq` is how E195.11 checked that issuing the ten agent POSTs together changes
nothing about WHAT comes back: four reads each, interleaved so provider drift hits both arms alike,
30 result rows and every agent resolving on all eight. `full` against `full-setup-seq` is the same
question asked of the OTHER concurrency this round introduced — the document upload racing the
dimension creation — because that arm did not exist when the first A/B ran.

EVERY POLL ASKS BOTH STATUS ENDPOINTS **SIMULTANEOUSLY**, ON PURPOSE. `/projects/{id}/status/` is
the cheap one the provider recommends for frequent polling; `/agents/status/` is the one it calls
expensive. Both carry `pipeline_running`, and the question is whether they ever disagree. The two
GETs go out in one `asyncio.gather`, and the order they are listed in ALTERNATES per poll, so a
dispatch-order bias cannot masquerade as a difference between the endpoints. Each poll records both
answers, both durations, and the microsecond gap between the two requests leaving.

PARSEWISE_API_KEY comes from the caller's environment. --fixture selects the input page;
--poll selects the polling interval (default 2 seconds).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import pathlib
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "https://api.parsewise.ai/api/v1"
sys.path.insert(0, str(ROOT / "mock-api"))


async def post(client, path, **kw):
    r = await client.post(BASE + path, **kw)
    if r.status_code >= 400:
        raise SystemExit(f"POST {path} -> {r.status_code} {r.text[:200]}")
    return r


async def run(mode: str, kind: str, fixture: pathlib.Path, poll: float, api_key: str) -> dict:
    import httpx

    from app.parsewise import HEADER_AGENTS, LINE_AGENTS, LINE_DIMENSION, ORDER_AGENT

    H = {"X-API-Key": api_key}
    HJ = {**H, "Content-Type": "application/json"}
    t0 = time.time()
    mark = {}

    def at(name):
        mark[name] = round(time.time() - t0, 2)

    content = fixture.read_bytes()
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, read=300.0)) as c:
        project = await post(c, "/projects/", headers=HJ, json={"name": f"floor-probe {int(t0)}"})
        pid = project.json()["id"]
        at("project")

        async def upload():
            r = await post(c, f"/projects/{pid}/documents/", headers=H,
                           files=[("files", ("albaran.png", content, "image/png"))])
            return r.json()

        async def dimension():
            r = await post(c, f"/projects/{pid}/dimensions/", headers=HJ, json=LINE_DIMENSION[kind])
            return r.json()["id"]

        try:
            if mode in ("setup-seq", "full-setup-seq"):
                doc = await upload()
                at("upload")
                did = await dimension()
                at("dimension")
            else:
                doc, did = await asyncio.gather(upload(), dimension())
                at("upload+dimension")
            document_id = (doc.get("documents") or [{}])[0].get("id")

            bodies = []
            for name, vt, unit, task in [*LINE_AGENTS[kind], ORDER_AGENT]:
                b = {"name": name, "value_type": vt, "extraction_instructions": task,
                     "dimensions": [{"dimension_id": did, "are_values_dynamic": True}]}
                if unit:
                    b["unit"] = unit
                bodies.append(b)
            for name, vt, unit, task in HEADER_AGENTS[kind]:
                b = {"name": name, "value_type": vt, "extraction_instructions": task}
                if unit:
                    b["unit"] = unit
                bodies.append(b)

            if mode in ("setup-seq", "full-seq"):
                for b in bodies:
                    await post(c, f"/projects/{pid}/agents/", headers=HJ, json=b)
            else:
                await asyncio.gather(*[post(c, f"/projects/{pid}/agents/", headers=HJ, json=b) for b in bodies])
            at("agents")
            mark["agent_count"] = len(bodies)

            if not mode.startswith("full"):
                return {"mode": mode, "kind": kind, "marks": mark, "document_id": document_id}

            await post(c, f"/projects/{pid}/agents/launch/", headers=HJ)
            at("launch")

            transcript = []
            done_at = None
            deadline = t0 + 600
            polls = 0
            while time.time() < deadline:
                await asyncio.sleep(poll)
                elapsed = round(time.time() - t0, 2)
                polls += 1

                async def cheap_get():
                    sent = time.time()
                    r = await c.get(f"{BASE}/projects/{pid}/status/", headers=H)
                    return r, sent, int((time.time() - sent) * 1000)

                async def dear_get():
                    sent = time.time()
                    r = await c.get(f"{BASE}/projects/{pid}/agents/status/", headers=H)
                    return r, sent, int((time.time() - sent) * 1000)

                # THE ORDER ALTERNATES so dispatch order cannot be mistaken for a lag (E195.10).
                listed_first = "cheap" if polls % 2 else "dear"
                if listed_first == "cheap":
                    (cheap, cheap_sent, cheap_ms), (st, dear_sent, dear_ms) = await asyncio.gather(cheap_get(), dear_get())
                else:
                    (st, dear_sent, dear_ms), (cheap, cheap_sent, cheap_ms) = await asyncio.gather(dear_get(), cheap_get())
                # What one poll COSTS, so PAR-10.3's trade is stated in bytes, not in adjectives.
                ag_sent = time.time()
                ag = await c.get(f"{BASE}/projects/{pid}/agents/", headers=H)
                ag_ms = int((time.time() - ag_sent) * 1000)
                if st.status_code >= 400 or ag.status_code >= 400 or cheap.status_code >= 400:
                    transcript.append({"t": elapsed, "http": [cheap.status_code, st.status_code, ag.status_code]})
                    continue
                rows = ag.json()
                rows = rows.get("results", rows) if isinstance(rows, dict) else rows
                states = sorted((r.get("extraction_status") or "?") for r in rows)
                running = st.json().get("pipeline_running")
                extra = {"cheap_running": cheap.json().get("pipeline_running"),
                         "parsing_state": cheap.json().get("parsing_state"),
                         "pending_docs": len(cheap.json().get("pending_documents") or []),
                         "cheap_ms": cheap_ms, "dear_ms": dear_ms,
                         "listed_first": listed_first,
                         "dispatch_gap_ms": round((cheap_sent - dear_sent) * 1000, 3),
                         "ag_ms": ag_ms,
                         "bytes": {"gate": len(cheap.content), "agents": len(ag.content),
                                   "agents_status": len(st.content)}}
                transcript.append({"t": elapsed, "running": running,
                                   "pending_agents": sum(1 for s in states if s == "Pending"),
                                   "processed": sum(1 for s in states if s == "Processed"),
                                   "no_result": sum(1 for s in states if s == "No Result"),
                                   **extra})
                if not running and states and all(s in ("Processed", "No Result") for s in states):
                    done_at = elapsed
                    break
            mark["done"] = done_at
            res = await c.get(f"{BASE}/projects/{pid}/results/", headers=H, params={"page_size": 500})
            at("results")
            body = res.json()
            rows = body.get("results", body) if isinstance(body, dict) else body
            mark["result_rows"] = len(rows) if isinstance(rows, list) else -1
            per_agent = {}
            for r in (rows if isinstance(rows, list) else []):
                name = r.get("agent_name") or (r.get("resolution_result") or {}).get("agent_name") or "?"
                st = ((r.get("resolution_result") or {}).get("resolution_status") or "").strip().lower()
                slot = per_agent.setdefault(name, [0, 0])
                slot[0] += 1
                if st == "resolved":
                    slot[1] += 1
            mark["per_agent"] = per_agent
        finally:
            d = await c.delete(f"{BASE}/projects/{pid}/", headers=H)
            at("deleted")
            mark["delete_status"] = d.status_code
    return {"mode": mode, "kind": kind, "poll": poll, "marks": mark,
            "transcript": transcript if mode.startswith("full") else []}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Measure Parsewise with an explicit sandbox key and fixture.")
    parser.add_argument("mode", nargs="?", default="full", choices=(
        "setup-seq", "setup-par", "full", "full-seq", "full-setup-seq"))
    parser.add_argument("kind", nargs="?", default="albaran")
    parser.add_argument("--fixture", required=True, type=pathlib.Path)
    parser.add_argument("--poll", type=float, default=2.0)
    args = parser.parse_args()
    if not args.fixture.is_file():
        parser.error("--fixture must name an existing sample page")
    if args.poll <= 0:
        parser.error("--poll must be greater than zero")
    api_key = os.environ.get("PARSEWISE_API_KEY")
    if not api_key:
        parser.error("supply PARSEWISE_API_KEY from the sandbox provider account in your environment")
    from app.parsewise import LINE_DIMENSION

    if args.kind not in LINE_DIMENSION:
        parser.error("kind must be one of: " + ", ".join(LINE_DIMENSION))
    out = asyncio.run(run(args.mode, args.kind, args.fixture, args.poll, api_key))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
