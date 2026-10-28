#!/usr/bin/env python3
"""Batch bookkeeping for THE PAINTED CATALOGUE.

  pipeline.py next N          -> the next N pending slugs + their prompts, priority order
  pipeline.py claim N REQID   -> mark those N as submitted under REQID, print the slug order
  pipeline.py record          -> stdin: JSON object with slugs, job_id, response_ids, image_urls.
                                 downloads each to raw/<slug>.webp, updates the manifest.
  pipeline.py fail SLUG...    -> bump attempts; >=2 attempts becomes status "failed"
  pipeline.py retry SLUG...   -> put a slug back to pending (keeps the attempt count)
  pipeline.py sync            -> merge subjects.json in; never drops a made painting
  pipeline.py stats           -> counts by status / family / priority
"""
import concurrent.futures as cf
import json
import sys
import time
import urllib.request
from pathlib import Path

H = Path(__file__).resolve().parent
MAN = H / "manifest.json"


def load():
    return json.loads(MAN.read_text(encoding="utf-8"))


def save(m):
    MAN.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")


def pending(m):
    order = [s for s in m if m[s]["status"] == "pending"]
    order.sort(key=lambda s: (m[s]["priority"], m[s]["L0_family"], s))
    return order


def cmd_next(n):
    m = load()
    sel = pending(m)[: int(n)]
    print(json.dumps([{"slug": s, "prompt": m[s]["prompt"]} for s in sel], ensure_ascii=False, indent=1))


def cmd_claim(n, reqid):
    m = load()
    sel = pending(m)[: int(n)]
    for s in sel:
        m[s]["status"] = "submitted"
        m[s]["request_id"] = reqid
        m[s]["attempts"] += 1
    save(m)
    print(json.dumps(sel, ensure_ascii=False))


def cmd_prep(n):
    """claim the next N and print the slug list + the prompt array, ready to submit"""
    m = load()
    sel = pending(m)[: int(n)]
    for s in sel:
        m[s]["status"] = "submitted"
    save(m)
    print(json.dumps(sel, ensure_ascii=False))
    print()
    print(json.dumps([m[s]["prompt"] for s in sel], ensure_ascii=False))


def fetch(url, tries=30):
    """render URLs 404 until ready — retry with backoff"""
    delay = 10
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=120).read()
            if len(data) < 5000:
                raise ValueError(f"tiny payload {len(data)}B")
            return data
        except Exception as e:
            last = e
            time.sleep(delay)
            delay = min(delay * 1.3, 30)
    raise last


def cmd_record():
    """stdin: {"slugs":[...], "job_id":..., "response_ids":[...], "image_urls":[...]}"""
    p = json.load(sys.stdin)
    m = load()
    slugs = p["slugs"]
    rids = p.get("response_ids") or [None] * len(slugs)
    urls = p.get("image_urls") or [
        f"https://ideogram.ai/assets/image/balanced/response/{r}@2k" for r in rids]
    reqids = p.get("request_ids") or [p.get("job_id")] * len(slugs)
    if len(slugs) != len(urls):
        print(f"WARN {len(slugs)} slugs vs {len(urls)} urls", file=sys.stderr)
    def one(args):
        slug, url = args
        try:
            return slug, fetch(url), None
        except Exception as e:
            return slug, None, e

    results = dict()
    with cf.ThreadPoolExecutor(max_workers=10) as ex:
        for slug, data, err in ex.map(one, zip(slugs, urls)):
            results[slug] = (data, err)
    ok = 0
    m = load()  # re-read: another batch may have been claimed while we downloaded
    for slug, rid, qid in zip(slugs, rids, reqids):
        data, err = results[slug]
        m[slug]["attempts"] = m[slug].get("attempts", 0) + 1
        if data:
            (H / "raw" / f"{slug}.webp").write_bytes(data)
            m[slug].update(status="done", file=f"raw/{slug}.webp", response_id=rid, request_id=qid)
            ok += 1
        else:
            print(f"FAIL {slug}: {err}", file=sys.stderr)
            m[slug].update(response_id=rid, request_id=qid,
                           status="failed" if m[slug]["attempts"] >= 2 else "pending")
    save(m)
    print(f"downloaded {ok}/{len(slugs)}")


def cmd_fail(slugs):
    m = load()
    for s in slugs:
        m[s]["attempts"] = m[s].get("attempts", 0) + 1
        m[s]["status"] = "failed" if m[s]["attempts"] >= 2 else "pending"
    save(m)
    print(json.dumps({s: m[s]["status"] for s in slugs}))


def cmd_retry(slugs):
    m = load()
    for s in slugs:
        m[s]["status"] = "pending"
        m[s]["request_id"] = None
    save(m)
    print(f"{len(slugs)} back to pending")


def cmd_mark(slugs):
    """re-assert an in-flight claim (used after a reconcile)"""
    m = load()
    n = 0
    for x in slugs:
        if m[x]["status"] == "pending":
            m[x]["status"] = "submitted"
            n += 1
    save(m)
    print(f"marked {n} submitted")


def cmd_reconcile():
    """disk is the truth: any slug with a raw file is done, anything else stuck in
    `submitted` with no file goes back to pending so it can be re-issued"""
    m = load()
    fixed = back = 0
    for slug, e in m.items():
        has = (H / "raw" / f"{slug}.webp").exists()
        # A KNOWN DEFECT IS NOT EVIDENCE. `defect` means the file on disk was LOOKED AT and
        # rejected — wrong creature, multiple subjects, a hanging composition the bbox law
        # cannot hold. Disk being the truth must not resurrect a painting we already failed.
        if e.get("defect"):
            continue
        if has and e["status"] not in ("done", "probe"):
            e.update(status="done", file=f"raw/{slug}.webp")
            fixed += 1
        elif not has and e["status"] == "submitted":
            e["status"] = "pending"
            back += 1
    save(m)
    print(f"reconciled: {fixed} marked done from disk, {back} returned to pending")


def cmd_sync():
    """MERGE subjects.json into the manifest without ever losing a painting.

    build_subjects.py is free to be re-run — it recomputes the whole matrix from the reference.
    The manifest is the record of what was actually MADE, so the merge is one-directional: a slug
    already in the manifest keeps its status, its file and its response id, and only gains the
    ladder fields if the matrix moved it. A slug the matrix no longer emits is kept and marked
    `orphan` rather than deleted — an image on disk is evidence, and evidence is never dropped
    because a rule changed.
    """
    subs = json.loads((H / "subjects.json").read_text(encoding="utf-8"))
    m = load()
    new = kept = orphan = 0
    seen = set()
    for e in subs:
        s = e["slug"]
        seen.add(s)
        if s in m:
            for k in ("L0_family", "L1_kind", "L2_sort", "L3_form", "es_name"):
                m[s][k] = e[k]
            if m[s]["status"] in ("done", "probe", "submitted", "alias-of"):
                kept += 1
                continue
            m[s].update(subject_clause=e["subject_clause"], prompt=e["prompt"],
                        priority=e["priority"])
            kept += 1
        else:
            m[s] = dict(es_name=e["es_name"], L0_family=e["L0_family"], L1_kind=e["L1_kind"],
                        L2_sort=e["L2_sort"], L3_form=e["L3_form"], priority=e["priority"],
                        subject_clause=e["subject_clause"], prompt=e["prompt"],
                        request_id=None, response_id=None, file=None,
                        status="pending", attempts=0)
            new += 1
    for s, v in m.items():
        if s not in seen and v["status"] not in ("done", "probe"):
            v["status"] = "orphan"
            orphan += 1
    save(m)
    print(f"sync: {new} new · {kept} already in the manifest · {orphan} orphaned")


def cmd_stats():
    m = load()
    st, fam, pri = {}, {}, {}
    for s, e in m.items():
        st[e["status"]] = st.get(e["status"], 0) + 1
        if e["status"] in ("done", "probe"):
            fam[e["L0_family"]] = fam.get(e["L0_family"], 0) + 1
            pri[e["priority"]] = pri.get(e["priority"], 0) + 1
    print("status:", json.dumps(st, sort_keys=True))
    print("have by family:", json.dumps(fam, sort_keys=True))
    print("have by priority:", json.dumps(pri, sort_keys=True))


if __name__ == "__main__":
    c = sys.argv[1]
    if c == "prep":
        cmd_prep(sys.argv[2])
    elif c == "next":
        cmd_next(sys.argv[2])
    elif c == "claim":
        cmd_claim(sys.argv[2], sys.argv[3])
    elif c == "record":
        cmd_record()
    elif c == "fail":
        cmd_fail(sys.argv[2:])
    elif c == "retry":
        cmd_retry(sys.argv[2:])
    elif c == "mark":
        cmd_mark(sys.argv[2:])
    elif c == "reconcile":
        cmd_reconcile()
    elif c == "sync":
        cmd_sync()
    elif c == "stats":
        cmd_stats()
    else:
        raise SystemExit(__doc__)
