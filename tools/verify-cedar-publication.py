#!/usr/bin/env python3
"""verify-cedar-publication.py — what the published Cedar development origin actually serves, held
to the commit the release named: both language entries, the Spanish snapshot's provenance, the
prototype runtime's code fingerprint, the page a person actually opens, and the map ground it draws.

THE BINDING HAS TWO STRENGTHS, AND THE RECEIPT KEEPS THEM APART. The runtime is computed here:
`api.code` is the digest over `git show <sha>:mock-api/app/*.py`, so `/api/health` matches that
commit's own bytes or reds. The frontend is declared: the origin's receipt and the Spanish
provenance each name a source commit, which is compared to the one you passed, and each served entry
is hashed against the digest that same receipt names.

WHY THIS IS A REPOSITORY TOOL. Every Cedar publication so far was verified by three files in /tmp —
a receipt prover, a Playwright smoke and a map-ground probe. A proof that lives outside the tree is
rewritten or trusted from a summary by the next session, and the receipt it wrote is a claim nobody
can re-run. This is those three, one command, one JSON receipt, one exit code, so the next
publication is verified the same way and its receipt lands in the company record beside the others.

IT IS A DIFFERENT QUESTION FROM `deploy/kit/verify-cedar-target.py`, which asks the gallery
publisher's question — is this destination a named Cedar development build whose entry matches its
own receipt — and answers it for whatever is published at the time. This asks whether the origin
serves the commit YOU named. On 14 September the published English entry was byte-identical to the
one the 11 September release published, so only the receipt's `sourceCommit`, the Spanish entry
hash and the runtime fingerprint saw that the origin had moved on.

    python3 tools/verify-cedar-publication.py --source <40-character commit>
    python3 tools/verify-cedar-publication.py --source <sha> --receipt out.json --shots /tmp/shots
    python3 tools/verify-cedar-publication.py --source <sha> --no-browser   # leg A alone
    make verify-publication SOURCE=<sha>

THREE LEGS, EVERY CHECK NAMED.

  A · HTTPS, no browser. `/cedar/prototype.json` names the Cedar development surface and the exact
      source commit; the bytes served at `/cedar/` and `/cedar/index.html` hash to the receipt's
      `entrySha256` and declare `lang="en"`; `/cedar/es/` and `/cedar/es/index.html` both hash to
      `spanishEntrySha256` (a directory index that differs from its own file is how a stale Spanish
      entry hid once) and declare `lang="es"`; `/cedar/es/spanish-snapshot-provenance.json` names
      the same commit; `/api/health` is ok, states `places` and `deepgram` configured, and carries
      the code fingerprint computed here from `git show <sha>:mock-api/app/*.py`.

  B · The published page, in a browser, at 1600 and 390. It boots, the welcome names the workspace
      owner, Money draws soles, Sales opens Prep with marks on it, and `/cedar/es/` serves the same
      workspace in Spanish. Every same-origin `/api` call is a local fixture or a refusal and every
      external request is dropped, so the smoke reaches no provider — which is why its Money card
      shows the seeded projection with the collection service out of reach, and why its Prep marks
      sit on a bare ground. Leg C is where the ground is read.

  C · The live ground, at 1600 and 390. Google's Maps JavaScript draws the Prep map where the public
      browser key is configured, so `data-ground` reads `google`, the view is fitted, marks are on
      it, the screen costs at most one map load and the Static Maps API is untouched. This is the
      one leg a local build leaves open: every drive and CI run draws the checked-in tiles. It loads
      the published page for real, so it holds the run to a reading — analytics dropped at every
      host, every write the page attempts refused, both counted in the receipt.

EXIT 0 ONLY WHEN EVERY CHECK IN EVERY LEG THAT RAN PASSES. A leg skipped by `--no-browser` is
recorded as skipped and is honest about it; a leg that ran and failed is RED. Fail-closed: an
unreachable document, an absent commit or a browser that raises is a red check with its reason in
the receipt, never a silent pass.

WHAT IT TOUCHES AT THE ORIGIN. It reads, and leaves the origin as it found it. Leg A is plain GET
against our own host, with cookies and credentials left out. Leg B answers the published frontend
from fixtures and keeps the network outside it. Leg C loads the page for real and refuses every
write it attempts — the sample collection workspace the page would mint and the customer session
slot it would take are both aborted, and `ground.<width>.writes` holds that count at zero. Google's
own map service keeps its bootstrap RPC, a POST to `maps.googleapis.com` that settles a viewport.
Analytics is dropped at every host, so a verification run stays a reading rather than a visit
(`ground.<width>.analytics`). It calls no provider of ours; the one third-party service it reaches is
Google's map, which is the thing leg C measures, at one map load per width.

AND IT RECORDS NO KEY. A recorded URL keeps its host always, drops its query everywhere, and keeps
its path on the two hosts whose paths are evidence: ours, and Google's map service (the leg-C map
counts read that path). Every other host is written down by name alone. Both keys the published page
carries ride in a URL — the Maps browser key in a query, the analytics project key as a path
segment — and this receipt is copied into the company record.

PROVE IT RED. Point `--source` at any commit other than the published one: `receipt.sourceCommit`,
`spanish.provenanceSourceCommit` and `api.code` go red and the command exits 1. The unit test
(`tools/tests/test_verify_cedar_publication.py`) does the same against a local fixture origin, plus
a tampered entry byte, proves the green case on a matching fixture, and holds both browser legs'
routing to data: every write the published page attempts is refused, analytics is dropped at any
regional host, and a recorded URL carries neither key.
"""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import hashlib
import json
import re
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ORIGIN = "https://demo.soyrocoto.com"
ENTRY = "/cedar/"
SPANISH_ENTRY = "/cedar/es/"
HEALTH = "/api/health"
PROVENANCE = "/cedar/es/spanish-snapshot-provenance.json"
RECEIPT = "/cedar/prototype.json"
WIDTHS = (1600, 390)
COMMIT = re.compile(r"[0-9a-f]{40}")
# Which named checks belong to which leg. `browser.` is the check that says the browser itself ran,
# so an absent Playwright reds both browser legs rather than passing them by silence.
LEG_PREFIXES = {
    "a": ("source.", "receipt.", "english.", "spanish.", "api."),
    "b": ("smoke.", "browser."),
    "c": ("ground.", "browser."),
}
AGENT = "Rocoto Cedar publication verifier"
# Analytics counts a reader as a visit, and a verification run is a reading of our own artifact. Leg
# C drops every analytics host and records the drop; the suffix match holds for any region the
# bundle picks (eu.i., us.i., eu-assets.i.).
ANALYTICS = ("posthog.com",)
GOOGLE_MAPS = ("maps.googleapis.com", "maps.gstatic.com")
# Our own hosts, where a recorded path is evidence rather than a credential.
OURS = re.compile(r"(^|\.)soyrocoto\.com$|^(127\.0\.0\.1|localhost)$")

# The workspace a fresh browser is given, so the smoke reads the same prepared demo every time.
BOOT = """
if (!sessionStorage.getItem('cedar-publication-verifier')) {
  sessionStorage.setItem('cedar-publication-verifier', '1');
  localStorage.clear();
  localStorage.setItem('rocoto-app-front-door', 'months');
  localStorage.setItem('rocoto-app-config',
    JSON.stringify({version:4, cast:'fish', sector:['fish'], owner:{name:'Peter'}}));
  localStorage.setItem('rocoto-workspace-capabilities:fish',
    JSON.stringify({version:1, pricing:true, inventory:false}));
  localStorage.setItem('rocoto-runtime-base', 'http://127.0.0.1:9');
}
window.print = () => { window.__cedarVerifierPrints = (window.__cedarVerifierPrints || 0) + 1; };
"""
PROOF_STATE = {
    "ready": True,
    "blockers": [],
    "meta": {"appId": "123", "configId": "456", "graphVersion": "v23.0"},
    "connection": {"wabaId": "fixture-waba", "phoneId": "fixture-phone", "number": "+15555550163",
                   "name": "Connected business", "coexistence": True, "workspace": "fish"},
    "history": {"status": "complete", "progress": 100, "messages": 0, "conversations": 0,
                "oldestAt": None, "newestAt": None},
}
# The same-origin calls leg B answers itself, so the smoke reaches the published frontend and stops
# there. `/api/proof/session` is a POST that takes a customer session slot on the live service.
FIXTURES: dict[str, Any] = {
    "/api/proof/session": {"ok": True},
    "/api/proof/state": PROOF_STATE,
    "/api/proof/intake": {"workspace": "fish", "messages": [], "nextCursor": None},
}


def host_of(url: str) -> str:
    """The hostname alone, lowercase and with any port left off, so every host test agrees."""
    return (urlsplit(url).hostname or "").lower()


def keeps_path(host: str) -> bool:
    """Whose path is safe to write down. Ours, where a path is the evidence; and Google's map
    service, whose path is what leg C counts and whose key rides in the query instead. Every other
    host is recorded by its name alone."""
    return bool(OURS.search(host)) or host in GOOGLE_MAPS


def redact(url: str) -> str:
    """A recorded URL keeps its host always, keeps its path where a path is safe, and drops its
    query everywhere. Both keys the published page carries live in a URL — the Maps browser key in
    the query, the analytics project key as a path segment — and this receipt travels into the
    company record."""
    parts = urlsplit(url)
    if not parts.scheme:
        return url
    at = f"{parts.scheme}://{parts.netloc}"
    return at + parts.path if keeps_path(host_of(url)) else at


def is_analytics(host: str) -> bool:
    """Any analytics host, in any region the bundle picks."""
    return any(host == name or host.endswith("." + name) for name in ANALYTICS)


def plan(action: str, kind: str, url: str, method: str, **extra: Any) -> dict[str, Any]:
    """One request's verdict, as data: what happens to it, what it is, and what it was. The path
    follows the same rule the receipt does, so a verdict can be written down as it stands."""
    host = host_of(url)
    return {"action": action, "kind": kind, "method": method, "host": host,
            "path": urlsplit(url).path if keeps_path(host) else "", "url": redact(url), **extra}


def smoke_plan(url: str, method: str, origin: str) -> dict[str, Any]:
    """Leg B's policy. The published frontend boots against local answers: the three proof calls get
    a fixture, every other same-origin `/api/` call gets a refusal, and the rest of the network stays
    outside — so the smoke reads the artifact alone and writes to no service at all."""
    parts = urlsplit(url)
    same_origin = f"{parts.scheme}://{parts.netloc}" == origin
    if same_origin and parts.path in FIXTURES:
        return plan("fixture", "api-fixture", url, method, body=FIXTURES[parts.path])
    if same_origin and parts.path.startswith("/api/"):
        return plan("refuse", "api-refused", url, method)
    if not same_origin:
        return plan("drop", "external-dropped", url, method)
    if method != "GET":
        return plan("drop", "write-refused", url, method)
    return plan("allow", "asset", url, method)


def ground_plan(url: str, method: str) -> dict[str, Any]:
    """Leg C's policy. This leg loads the published page for real, because the live map ground is
    what it measures — so it holds the run to a reading: analytics is dropped, every write the page
    attempts is refused, and the origin is left as it was found. Google's own map service keeps its
    bootstrap RPC, a POST to `maps.googleapis.com`, which is how the JavaScript settles a viewport."""
    host = host_of(url)
    if is_analytics(host):
        return plan("drop", "analytics-dropped", url, method)
    if method != "GET" and host not in GOOGLE_MAPS:
        return plan("drop", "write-refused", url, method)
    return plan("allow", "map" if host in GOOGLE_MAPS else "page", url, method)


async def act_on(route: Any, plan: dict[str, Any]) -> str:
    """Do what a plan says to one browser route, and return the verb that was done — `abort`,
    `fulfill` or `continue` — so a handler's record holds what it DID rather than what the policy
    said (re-review, 14 September 2026). Leg B's `isolate` and leg C's `observe` both run through
    here, and the unit test drives this function with a fake route."""
    action = plan["action"]
    if action == "fixture":
        await route.fulfill(json=plan["body"])
        return "fulfill"
    if action == "refuse":
        await route.fulfill(status=503, content_type="application/json",
                            body='{"detail":"isolated publication smoke"}')
        return "fulfill"
    if action == "drop":
        await route.abort("blockedbyclient")
        return "abort"
    await route.continue_()
    return "continue"


def writes_through(allowed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Writes that reached a service — the count `ground.<width>.writes` holds at zero."""
    return [row for row in allowed if row["method"] != "GET" and row["host"] not in GOOGLE_MAPS]


def analytics_through(allowed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Analytics requests that reached their host — the count `ground.<width>.analytics` holds at
    zero, so a run stays a reading rather than a recorded visit."""
    return [row for row in allowed if is_analytics(row["host"])]


class Checks:
    """Every check by name, each with the value it wanted and the value it got."""

    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}

    def record(self, name: str, passed: bool, expected: Any, actual: Any) -> bool:
        self.rows[name] = {"pass": bool(passed), "expected": expected, "actual": actual}
        return bool(passed)

    def equal(self, name: str, expected: Any, actual: Any) -> bool:
        return self.record(name, expected == actual, expected, actual)

    def skip(self, name: str, reason: str) -> None:
        self.rows[name] = {"pass": False, "expected": "a measured value", "actual": reason}

    @property
    def green(self) -> bool:
        return all(row["pass"] for row in self.rows.values())

    def report(self) -> str:
        width = max((len(name) for name in self.rows), default=0)
        lines = []
        for name, row in self.rows.items():
            mark = "GREEN" if row["pass"] else "RED  "
            lines.append(f"{mark} {name.ljust(width)}  wanted {row['expected']!r}  got {row['actual']!r}")
        return "\n".join(lines)


class ReadOnlyOrigin:
    """GET, and only GET. No cookies, no credentials, no request body, nothing written."""

    def __init__(self, base: str, timeout: float = 25.0) -> None:
        self.base = base.rstrip("/")
        self.timeout = timeout
        self.reads: list[dict[str, Any]] = []

    def read(self, path: str) -> tuple[int, bytes, str]:
        request = urllib.request.Request(
            self.base + path, method="GET",
            headers={"Cache-Control": "no-cache", "Accept": "*/*", "User-Agent": AGENT},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                status, body, trouble = int(response.status), response.read(), ""
        except urllib.error.HTTPError as failure:
            status, body, trouble = int(failure.code), b"", f"HTTP {failure.code}"
        except (OSError, ValueError) as failure:  # DNS, TLS, timeout, malformed URL
            status, body, trouble = 0, b"", f"{type(failure).__name__}: {failure}"
        self.reads.append({"path": path, "status": status, "bytes": len(body), "trouble": trouble})
        return status, body, trouble

    def document(self, path: str) -> tuple[dict[str, Any], str]:
        status, body, trouble = self.read(path)
        if trouble or status != 200:
            return {}, trouble or f"HTTP {status}"
        try:
            value = json.loads(body)
        except ValueError as failure:
            return {}, f"unreadable JSON: {failure}"
        return (value, "") if isinstance(value, dict) else ({}, "the document is not an object")


def git(repo: Path, *arguments: str) -> bytes:
    """One git read, straight out of the object database. Raises on a commit this checkout lacks."""
    done = subprocess.run(["git", "-C", str(repo), *arguments], capture_output=True, check=True)
    return done.stdout


def source_modules(repo: Path, revision: str) -> list[str]:
    """The prototype runtime's own modules at that commit: `mock-api/app/*.py`, its own directory
    only, sorted — the order the fingerprint depends on."""
    listing = git(repo, "ls-tree", "-r", "--name-only", revision, "--", "mock-api/app").decode()
    return sorted(p for p in listing.splitlines()
                  if p.endswith(".py") and Path(p).parent == Path("mock-api/app"))


def prototype_api_fingerprint(repo: Path, revision: str) -> str:
    """What `/api/health` reports as `code`: the first twelve hex of the SHA-256 over those modules'
    bytes, concatenated in that order. It is computed from Git, so the answer belongs to the commit
    rather than to whatever happens to sit in the working tree."""
    modules = source_modules(repo, revision)
    if not modules:
        raise ValueError(f"{revision} holds no mock-api/app modules")
    digest = hashlib.sha256(b"".join(git(repo, "show", f"{revision}:{path}") for path in modules))
    return digest.hexdigest()[:12]


def leg_a(origin: ReadOnlyOrigin, source: str, repo: Path, checks: Checks) -> dict[str, Any]:
    """HTTPS only: the receipt, both entries, the Spanish provenance and the runtime fingerprint."""
    try:
        expected_code = prototype_api_fingerprint(repo, source)
        checks.record("source.commitPresent", True, source, source)
    except (subprocess.CalledProcessError, ValueError) as failure:
        expected_code = ""
        checks.record("source.commitPresent", False, source,
                      f"{repo} cannot read {source}: {type(failure).__name__}")

    receipt, trouble = origin.document(RECEIPT)
    checks.record("receipt.reachable", not trouble, "the Cedar receipt answers", trouble or "answered")
    checks.equal("receipt.surface", "cedar", receipt.get("surface"))
    checks.equal("receipt.environment", "development", receipt.get("environment"))
    checks.equal("receipt.sourceCommit", source, receipt.get("sourceCommit"))

    status, english, english_trouble = origin.read(ENTRY)
    english_digest = hashlib.sha256(english).hexdigest()
    checks.record("english.served", status == 200 and not english_trouble, 200, english_trouble or status)
    checks.equal("english.entrySha256", receipt.get("entrySha256"), english_digest)
    file_status, english_file, _ = origin.read(ENTRY + "index.html")
    checks.equal("english.fileServed", english_digest,
                 hashlib.sha256(english_file).hexdigest() if file_status == 200 else f"HTTP {file_status}")
    checks.record("english.lang", b'<html lang="en"' in english[:400], 'lang="en"',
                  english[:400].decode("utf-8", "replace").strip()[:60])

    checks.equal("spanish.receiptEntry", SPANISH_ENTRY, receipt.get("spanishEntry"))
    directory_status, spanish_directory, _ = origin.read(SPANISH_ENTRY)
    spanish_status, spanish_file, _ = origin.read(SPANISH_ENTRY + "index.html")
    spanish_digest = hashlib.sha256(spanish_file).hexdigest()
    checks.equal("spanish.directoryIndexServed", receipt.get("spanishEntrySha256"),
                 hashlib.sha256(spanish_directory).hexdigest() if directory_status == 200
                 else f"HTTP {directory_status}")
    checks.equal("spanish.fileServed", receipt.get("spanishEntrySha256"),
                 spanish_digest if spanish_status == 200 else f"HTTP {spanish_status}")
    checks.record("spanish.lang", b'<html lang="es"' in spanish_file[:400], 'lang="es"',
                  spanish_file[:400].decode("utf-8", "replace").strip()[:60])
    provenance, provenance_trouble = origin.document(PROVENANCE)
    checks.equal("spanish.provenanceSourceCommit", source,
                 provenance.get("sourceCommit", provenance_trouble or "absent"))

    health, health_trouble = origin.document(HEALTH)
    checks.record("api.ok", health.get("ok") is True, True, health.get("ok", health_trouble or "absent"))
    checks.equal("api.code", expected_code or "a readable source commit", health.get("code"))
    providers = health.get("providers", {})
    checks.equal("api.places", "configured", providers.get("places"))
    checks.equal("api.deepgram", "configured", providers.get("deepgram"))

    return {
        "receipt": receipt,
        "englishEntrySha256": english_digest,
        "spanishEntrySha256Served": spanish_digest,
        "spanishProvenance": provenance,
        "prototypeApi": {"expectedCode": expected_code, "health": health},
        "reads": origin.reads,
    }


async def smoke_viewport(browser: Any, base: str, spanish: str, width: int, shots: Path,
                         checks: Checks) -> dict[str, Any]:
    """One viewport of leg B. Every request is answered locally or dropped."""
    from playwright.async_api import expect

    label = f"smoke.{width}"
    origin = f"{urlsplit(base).scheme}://{urlsplit(base).netloc}"
    context = await browser.new_context(
        viewport={"width": width, "height": 1000 if width > 700 else 844},
        timezone_id="America/Lima", has_touch=width <= 520, service_workers="block")
    await context.add_init_script(BOOT)
    intercepted: list[dict[str, str]] = []

    async def isolate(route: Any) -> None:
        verdict = smoke_plan(route.request.url, route.request.method, origin)
        did = await act_on(route, verdict)
        if did != "continue":
            intercepted.append({"kind": verdict["kind"], "url": verdict["url"], "did": did})

    await context.route("**/*", isolate)
    page = await context.new_page()
    page.set_default_timeout(30_000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    measured: dict[str, Any] = {"width": width, "intercepted": intercepted}

    try:
        await page.goto(base + "#/welcome", wait_until="domcontentloaded")
        await expect(page.get_by_test_id("demo-welcome")).to_be_visible()
        checks.record(f"{label}.boot", True, "the Cedar entry mounts", "mounted")
        await page.screenshot(path=str(shots / f"smoke-{width}-1-welcome.png"), animations="disabled")

        welcome = await page.get_by_test_id("demo-welcome").inner_text()
        measured["welcome"] = " · ".join(welcome.split("\n")[:6])
        choices = [await page.get_by_test_id(name).is_visible()
                   for name in ("demo-view-onboarding", "demo-start-selling")]
        fits = await page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        checks.record(f"{label}.welcome", "Peter" in welcome and all(choices) and bool(fits),
                      "the welcome names its owner, offers both doors and fits the viewport",
                      {"owner": "Peter" in welcome, "choices": choices, "fits": bool(fits)})

        await page.evaluate("location.hash='#/money'")
        await expect(page.get_by_test_id("money-overview")).to_be_visible()
        balance = await page.get_by_test_id("money-bank-balance").inner_text()
        measured["balance"] = balance.strip()
        checks.record(f"{label}.money", "S/" in balance, "a balance in soles", balance.strip())
        await page.screenshot(path=str(shots / f"smoke-{width}-2-money.png"), animations="disabled")

        await page.evaluate("location.hash='#/sales'")
        await expect(page.get_by_test_id("river")).to_be_visible()
        await page.get_by_test_id("export-centre").scroll_into_view_if_needed()
        await page.get_by_test_id("export-centre").click()
        hub = page.get_by_test_id("export-batch-hub")
        await expect(hub).to_be_visible()
        await expect(page.get_by_test_id("prep-status")).to_be_visible()
        pins = int(await hub.get_attribute("data-pins") or 0)
        measured["prepPins"] = pins
        checks.record(f"{label}.prep", pins > 0, "Prep opens with marks on its map", pins)
        await page.screenshot(path=str(shots / f"smoke-{width}-3-prep.png"), animations="disabled")

        await page.goto(spanish + "#/money", wait_until="domcontentloaded")
        await expect(page.get_by_test_id("money-overview")).to_be_visible()
        language = await page.evaluate("document.documentElement.lang")
        money = await page.get_by_test_id("money-overview").inner_text()
        measured["spanish"] = {"lang": language, "heading": money.split("\n")[0].strip()}
        checks.record(f"{label}.spanish", language == "es" and "Dinero" in money,
                      "the Spanish entry serves the same workspace in Spanish",
                      measured["spanish"])
        await page.screenshot(path=str(shots / f"smoke-{width}-4-spanish.png"), animations="disabled")

        checks.record(f"{label}.pageErrors", not errors, 0, errors[:3] or 0)
        measured["status"] = "GREEN"
    except Exception as failure:  # a raising browser is a red check, never a silent pass
        checks.skip(f"{label}.completed", f"{type(failure).__name__}: {failure}")
        measured["status"] = "RED"
        measured["error"] = f"{type(failure).__name__}: {failure}"
        measured["url"] = page.url
        measured["pageErrors"] = errors[:3]
        with contextlib.suppress(Exception):
            await page.screenshot(path=str(shots / f"smoke-{width}-failure.png"), full_page=True)
    finally:
        await context.close()
    return measured


async def ground_viewport(browser: Any, base: str, width: int, shots: Path,
                          checks: Checks) -> dict[str, Any]:
    """One viewport of leg C: the ground the published Prep map actually drew."""
    label = f"ground.{width}"
    context = await browser.new_context(
        viewport={"width": width, "height": 1000 if width > 700 else 844},
        timezone_id="America/Lima", has_touch=width <= 520, service_workers="block")
    await context.add_init_script(BOOT)
    seen: list[dict[str, Any]] = []

    async def observe(route: Any) -> None:
        verdict = ground_plan(route.request.url, route.request.method)
        did = await act_on(route, verdict)
        # what the handler DID is the record; `allowed` below reads it, so a handler that stopped
        # aborting a write would land that write in `ground.<width>.writes` and red the run
        seen.append(verdict | {"did": did})

    await context.route("**/*", observe)
    page = await context.new_page()
    page.set_default_timeout(60_000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    measured: dict[str, Any] = {"width": width}

    try:
        await page.goto(base + "#/sales", wait_until="domcontentloaded")
        await page.get_by_test_id("river").wait_for()
        await page.get_by_test_id("export-centre").scroll_into_view_if_needed()
        await page.get_by_test_id("export-centre").click()
        await page.get_by_test_id("export-batch-hub").wait_for(timeout=30_000)
        figure = page.locator("[data-testid=prep-status] [data-ground]").first
        await figure.wait_for(timeout=30_000)
        for _ in range(40):  # Google's own ready callback settles the ground; 20 s is generous
            if await figure.get_attribute("data-ground") == "google":
                break
            await page.wait_for_timeout(500)
        await page.wait_for_timeout(5_000)
        allowed = [row for row in seen if row["did"] == "continue"]
        maps = [row["path"] for row in allowed if row["host"] in GOOGLE_MAPS]
        bootstrap = [path for path in maps if path == "/maps/api/js"]
        static = [path for path in maps if path.startswith("/maps/api/staticmap")]
        refused = [{"kind": row["kind"], "method": row["method"], "url": row["url"]}
                   for row in seen if row["did"] == "abort"]
        measured.update({
            "ground": await figure.get_attribute("data-ground"),
            "fitted": await figure.get_attribute("data-fitted"),
            "zoom": await figure.get_attribute("data-zoom"),
            "markers": await figure.get_attribute("data-markers"),
            "pins": await page.locator("[data-testid=prep-status] [data-order-id]").count(),
            "mapBootstrapLoads": len(bootstrap), "staticMapsRequests": len(static),
            "googleRequests": len(maps), "refused": refused,
            "writesRefused": [row for row in refused if row["kind"] == "write-refused"],
            "analyticsDropped": len([row for row in refused if row["kind"] == "analytics-dropped"]),
            "pageErrors": errors[:3],
        })
        await page.screenshot(path=str(shots / f"ground-{width}.png"), animations="disabled")
        checks.equal(f"{label}.ground", "google", measured["ground"])
        checks.equal(f"{label}.fitted", "true", measured["fitted"])
        checks.record(f"{label}.marks", int(measured["markers"] or 0) > 0, "marks on the ground",
                      measured["markers"])
        checks.record(f"{label}.mapLoads", len(bootstrap) <= 1, "at most one map load", len(bootstrap))
        checks.equal(f"{label}.staticMaps", 0, len(static))
        checks.equal(f"{label}.writes", 0, len(writes_through(allowed)))
        checks.equal(f"{label}.analytics", 0, len(analytics_through(allowed)))
        checks.record(f"{label}.pageErrors", not errors, 0, errors[:3] or 0)
        measured["status"] = "GREEN" if measured["ground"] == "google" else "RED"
    except Exception as failure:
        checks.skip(f"{label}.completed", f"{type(failure).__name__}: {failure}")
        measured.update({"status": "RED", "error": f"{type(failure).__name__}: {failure}",
                         "pageErrors": errors[:3]})
        with contextlib.suppress(Exception):
            await page.screenshot(path=str(shots / f"ground-{width}-failure.png"), full_page=True)
    finally:
        await context.close()
    return measured


async def browser_legs(base: str, spanish: str, shots: Path, checks: Checks) -> dict[str, Any]:
    """Legs B and C, one Chromium, one viewport at a time — this box has four cores."""
    from playwright.async_api import async_playwright

    shots.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
        try:
            smoke = [await smoke_viewport(browser, base, spanish, width, shots, checks)
                     for width in WIDTHS]
            ground = [await ground_viewport(browser, base, width, shots, checks) for width in WIDTHS]
        finally:
            await browser.close()
    return {"smoke": smoke, "ground": ground}


def leg_status(checks: Checks, leg: str, ran: bool) -> str:
    """A leg is GREEN when every check it owns passed, RED when one failed OR when it owns none —
    a leg that measured nothing has proved nothing."""
    if not ran:
        return "skipped"
    rows = [row for name, row in checks.rows.items() if name.startswith(LEG_PREFIXES[leg])]
    return "GREEN" if rows and all(row["pass"] for row in rows) else "RED"


def verify(source: str, origin_base: str, repo: Path, shots: Path, browser: bool) -> dict[str, Any]:
    """Every leg selected, one receipt."""
    checks = Checks()
    origin = ReadOnlyOrigin(origin_base)
    evidence = leg_a(origin, source, repo, checks)
    browser_evidence: dict[str, Any] = {}
    if browser:
        try:
            browser_evidence = asyncio.run(browser_legs(
                origin.base + ENTRY, origin.base + SPANISH_ENTRY, shots, checks))
        except Exception as failure:  # an absent or broken Playwright is a red run, not a pass
            checks.skip("browser.available", f"{type(failure).__name__}: {failure}")

    return {
        "verifiedAt": datetime.now(timezone.utc).isoformat(),
        "environment": "development",
        "origin": origin.base + ENTRY,
        "sourceCommit": source,
        **evidence,
        **browser_evidence,
        "legs": {leg: leg_status(checks, leg, browser or leg == "a") for leg in ("a", "b", "c")},
        "checks": checks.rows,
        "status": "GREEN" if checks.green else "RED",
        "report": checks.report(),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="verify-cedar-publication.py",
        description="Prove the published Cedar development artifact against its exact source commit.")
    parser.add_argument("--source", required=True, help="the 40-character main commit the release published")
    parser.add_argument("--origin", default=DEFAULT_ORIGIN,
                        help=f"the published origin (default {DEFAULT_ORIGIN})")
    parser.add_argument("--receipt", type=Path, help="write the JSON receipt here")
    parser.add_argument("--shots", type=Path, default=Path("/tmp/cedar-publication-verification"),
                        help="screenshot directory for the browser legs")
    parser.add_argument("--repo", type=Path, default=ROOT, help="the checkout that holds the source commit")
    parser.add_argument("--no-browser", dest="browser", action="store_false",
                        help="run leg A alone, with no browser")
    arguments = parser.parse_args(argv)

    if not COMMIT.fullmatch(arguments.source):
        parser.error("--source takes the exact 40-character commit the release published")

    result = verify(arguments.source, arguments.origin, arguments.repo, arguments.shots, arguments.browser)
    print(result["report"], flush=True)
    print(f"\n{result['status']} · {arguments.origin}{ENTRY} · source {arguments.source}"
          f" · legs {result['legs']}", flush=True)
    if arguments.receipt:
        arguments.receipt.parent.mkdir(parents=True, exist_ok=True)
        arguments.receipt.write_text(json.dumps(result, indent=2) + "\n")
        print(f"receipt {arguments.receipt}", flush=True)
    return 0 if result["status"] == "GREEN" else 1


if __name__ == "__main__":
    raise SystemExit(main())
