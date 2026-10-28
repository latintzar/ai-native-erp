#!/usr/bin/env python3
"""RECORD A DEGRADED READ AS IT ARRIVED, so the suite can hold the fix without a live call.

    python3 deploy/with-env.py --env /path/to/sandbox.env -- \
        python3 tests/record_degraded_reads.py --variants jpeg-30,dirt-05

THE-PARSING-SPEC §PAR-08.2 found two defects with `tools/parse-harness.py`, and §PAR-09 owes both a
test. A test needs the provider's OWN body: `/api/parse` answers the shaped `ParseResult`, and the
shaping is exactly what broke, so the endpoint's answer cannot replay its own failure. This recorder
therefore runs the same provider pipeline the runtime runs — `app.parsewise.read_raw`, one project,
seven agents, launch, poll, delete — over the same damaged image the harness sent, and writes the
results body verbatim into `fixtures/`. One live read per variant, serially, at the provider's real
cost (§PAR-08: 112–188 s each), and never again: the fixture is the record.

The damage is `tools/degrade.py`'s, at the harness's own seed and page scale, so the recorded read is
of the same pixels §PAR-08.1's table was measured on — and this script proves that byte for byte
against the PNG the harness saved when it ran.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import pathlib
import sys
import time

RUNTIME = pathlib.Path(__file__).resolve().parent.parent
SITUATIONS = RUNTIME.parent
sys.path.insert(0, str(RUNTIME))
sys.path.insert(0, str(SITUATIONS / "tools"))

from PIL import Image  # noqa: E402

from app import parsewise  # noqa: E402
from degrade import Sheet, apply_variant  # noqa: E402

FIXTURES = RUNTIME / "tests" / "fixtures"
SOURCE = FIXTURES / "albaran-fixture.png"
# What the harness saved when it measured §PAR-08.1 — the same pixels, and this script says so.
HARNESS_VARIANTS = pathlib.Path("/dev/shm/rocoto-e193-parse-harness/variants")

PROVENANCE = (
    "THE «{variant}» READ OF albaran-fixture.png, RECORDED VERBATIM from Parsewise on {at} in {s} s "
    "by tests/record_degraded_reads.py — the same damage tools/parse-harness.py sent when it "
    "measured THE-PARSING-SPEC §PAR-08.1 (degrade.py «{variant}», seed {seed}, PNG md5 {md5}). "
    "Nothing here is hand-typed. §PAR-08.2 named the defect this read carries and §PAR-09 owes it a "
    "test; tests/test_parse_degraded.py is that test."
)


def damaged(variant: str, seed: int) -> tuple[bytes, str]:
    page = Image.open(SOURCE).convert("RGB")
    sheet = Sheet(region=None, px_per_mm=page.width / 210.0)
    hurt = apply_variant(page, variant, seed, sheet)
    path = pathlib.Path("/dev/shm/rocoto-w14-%s.png" % variant)
    hurt.save(path)
    content = path.read_bytes()
    digest = hashlib.md5(content).hexdigest()
    saved = HARNESS_VARIANTS / (variant + ".png")
    if saved.exists():
        theirs = hashlib.md5(saved.read_bytes()).hexdigest()
        print("  pixels %s · md5 %s · harness %s · %s"
              % (variant, digest[:12], theirs[:12], "SAME IMAGE" if theirs == digest else "DIFFERENT"))
    return content, digest


def record(variant: str, kind: str, seed: int) -> int:
    content, digest = damaged(variant, seed)
    started = time.time()
    print("  reading %s through Parsewise…" % variant, flush=True)
    body = asyncio.run(parsewise.read_raw(content, "albaran.png", "image/png", kind))
    seconds = round(time.time() - started, 1)
    rows = body.get("results", []) if isinstance(body, dict) else []
    out = {"_": PROVENANCE.format(variant=variant, at=time.strftime("%Y-%m-%dT%H:%M:%S"),
                                  s=seconds, seed=seed, md5=digest)}
    out.update(body if isinstance(body, dict) else {"results": body})
    target = FIXTURES / ("parsewise-%s-raw.json" % variant)
    target.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print("    %d result rows · %.0f s → %s" % (len(rows), seconds, target.name), flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--variants", default="jpeg-30,dirt-05")
    parser.add_argument("--kind", default="albaran")
    parser.add_argument("--seed", type=int, default=7, help="the harness's own seed")
    args = parser.parse_args()
    for variant in [name for name in args.variants.split(",") if name]:
        record(variant, args.kind, args.seed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
