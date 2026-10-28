"""The publication verifier, against a fixture origin it can hold still.

Leg A is the leg that decides whether a release is what it says it is, so it is the leg that has to
be provable without the internet. These tests stand up a local HTTP server over a temporary
directory shaped exactly like the published artifact — `cedar/prototype.json`, both language
entries, the Spanish provenance, `api/health` — and then break it one way at a time:

  matching fixture      every check passes, the command exits 0 and writes a receipt
  tampered entry byte   `english.entrySha256` reds; the receipt still names both hashes
  another commit        `receipt.sourceCommit` and `spanish.provenanceSourceCommit` red
  nothing served        every check reds with its reason, and nothing raises (fail-closed)

The runtime fingerprint reads Git, so these tests replace that one function and prove it separately
against a recorded `git` — which module names it takes, in which order, and how far it truncates.
"""

import contextlib
import functools
import hashlib
import http.server
import importlib.util
import io
import json
import pathlib
import tempfile
import threading
import unittest
from typing import Any
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = "a" * 40
OTHER = "b" * 40
CODE = "6b1c071aa31e"
ENGLISH = b'<!doctype html>\n<html lang="en"><head><title>Rocoto app</title></head><body></body></html>'
SPANISH = b'<!doctype html>\n<html lang="es"><head><title>Rocoto</title></head><body></body></html>'
ORIGIN = "https://demo.soyrocoto.com"
POSTHOG = "phc_fixtureprojectkeyfixtureprojectkeyfix"  # the shape of the key, as a path segment
MAPS_BOOTSTRAP = "https://maps.googleapis.com/maps/api/js?key=SECRET&loading=async&v=weekly"
# The four non-GET requests the published Cedar page makes while leg C reads its map ground,
# recorded from the live origin on 14 September. The first two reach a live Rocoto service: one
# mints a collection workspace with its token, the other takes a customer session slot.
PAGE_WRITES = (
    ("POST", "https://copper-demo.soyrocoto.com/api/cedar/workspaces"),
    ("POST", "https://demo.soyrocoto.com/api/proof/session"),
    ("POST", "https://eu.i.posthog.com/flags/?v=2"),
    ("POST", "https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1"
             ".MapsJsInternalService/GetViewportInfo"),
)

spec = importlib.util.spec_from_file_location(
    "cedar_publication_verifier", ROOT / "tools/verify-cedar-publication.py"
)
assert spec is not None and spec.loader is not None
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """The fixture origin says nothing on stderr; a passing test prints nothing."""

    def log_message(self, format: str, *args: Any) -> None:
        return


class PublicationVerifierTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.published = pathlib.Path(self.temp.name) / "published"
        self.receipt_file = pathlib.Path(self.temp.name) / "receipt.json"
        self.write_artifact(SOURCE)
        self.origin = self.serve(self.published)
        self.fingerprint = mock.patch.object(verifier, "prototype_api_fingerprint", return_value=CODE)
        self.fingerprint.start()
        self.addCleanup(self.fingerprint.stop)

    # ── the fixture ───────────────────────────────────────────────────────────────────────────
    def write_artifact(self, source: str, english: bytes = ENGLISH, spanish: bytes = SPANISH) -> None:
        """A published tree: the receipt names the commit and the two entry hashes it serves."""
        cedar = self.published / "cedar"
        (cedar / "es").mkdir(parents=True, exist_ok=True)
        (self.published / "api").mkdir(parents=True, exist_ok=True)
        (cedar / "index.html").write_bytes(english)
        (cedar / "es/index.html").write_bytes(spanish)
        (cedar / "prototype.json").write_text(json.dumps({
            "surface": "cedar", "environment": "development", "sourceCommit": source,
            "entrySha256": hashlib.sha256(english).hexdigest(),
            "spanishEntry": "/cedar/es/",
            "spanishEntrySha256": hashlib.sha256(spanish).hexdigest(),
        }))
        (cedar / "es/spanish-snapshot-provenance.json").write_text(json.dumps({
            "locale": "es-ES", "sourceCommit": source,
            "generator": "babel-ast-vite-spanish-source-transform",
            "translatedEntries": 5819, "policy": "english-primary-frozen-spanish",
        }))
        (self.published / "api/health").write_text(json.dumps({
            "ok": True, "version": "1.0.0", "code": CODE,
            "providers": {"parsewise": "missing", "deepgram": "configured", "places": "configured"},
        }))

    def serve(self, directory: pathlib.Path) -> str:
        handler = functools.partial(QuietHandler, directory=str(directory))
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join, 5)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_address[1]}"

    def run_verifier(self, source: str = SOURCE, origin: str | None = None) -> tuple[int, dict[str, Any]]:
        """The CLI, with its printed report held so `make test` stays readable."""
        self.printed = io.StringIO()
        with contextlib.redirect_stdout(self.printed):
            code = verifier.main(["--source", source, "--origin", origin or self.origin,
                                  "--receipt", str(self.receipt_file), "--no-browser"])
        return code, json.loads(self.receipt_file.read_text())

    def failed(self, receipt: dict[str, Any]) -> list[str]:
        return sorted(name for name, row in receipt["checks"].items() if not row["pass"])

    # ── green ─────────────────────────────────────────────────────────────────────────────────
    def test_matching_publication_passes_every_check(self) -> None:
        code, receipt = self.run_verifier()
        self.assertEqual(self.failed(receipt), [])
        self.assertEqual(code, 0)
        self.assertEqual(receipt["status"], "GREEN")
        self.assertEqual(receipt["legs"], {"a": "GREEN", "b": "skipped", "c": "skipped"})
        self.assertEqual(receipt["sourceCommit"], SOURCE)
        self.assertEqual(receipt["englishEntrySha256"], hashlib.sha256(ENGLISH).hexdigest())
        self.assertEqual(receipt["spanishEntrySha256Served"], hashlib.sha256(SPANISH).hexdigest())
        self.assertEqual(receipt["prototypeApi"]["expectedCode"], CODE)
        self.assertEqual(receipt["spanishProvenance"]["sourceCommit"], SOURCE)
        self.assertIn("GREEN receipt.sourceCommit", self.printed.getvalue())
        self.assertIn(f"receipt {self.receipt_file}", self.printed.getvalue())

    def test_every_check_carries_the_value_it_measured(self) -> None:
        _, receipt = self.run_verifier()
        for name, row in receipt["checks"].items():
            self.assertEqual(sorted(row), ["actual", "expected", "pass"], name)
        self.assertEqual(receipt["checks"]["api.code"]["actual"], CODE)
        self.assertEqual(receipt["checks"]["receipt.sourceCommit"]["actual"], SOURCE)
        self.assertIn("english.fileServed", receipt["checks"])
        self.assertIn("spanish.directoryIndexServed", receipt["checks"])
        for leg in ("source.commitPresent", "receipt.surface", "english.lang", "spanish.lang",
                    "api.ok", "api.places", "api.deepgram"):
            self.assertIn(leg, receipt["checks"])

    # ── red ───────────────────────────────────────────────────────────────────────────────────
    def test_tampered_entry_reds_the_entry_hash(self) -> None:
        (self.published / "cedar/index.html").write_bytes(ENGLISH + b"<!-- one more byte -->")
        code, receipt = self.run_verifier()
        self.assertEqual(self.failed(receipt), ["english.entrySha256"])
        self.assertEqual(code, 1)
        self.assertEqual(receipt["status"], "RED")
        self.assertEqual(receipt["legs"]["a"], "RED")
        row = receipt["checks"]["english.entrySha256"]
        self.assertEqual(row["expected"], hashlib.sha256(ENGLISH).hexdigest())
        self.assertNotEqual(row["actual"], row["expected"])

    def test_mismatched_source_commit_reds_the_commit_binding(self) -> None:
        self.write_artifact(OTHER)
        code, receipt = self.run_verifier(source=SOURCE)
        self.assertEqual(self.failed(receipt),
                         ["receipt.sourceCommit", "spanish.provenanceSourceCommit"])
        self.assertEqual(code, 1)
        self.assertEqual(receipt["checks"]["receipt.sourceCommit"],
                         {"pass": False, "expected": SOURCE, "actual": OTHER})
        self.assertEqual(receipt["checks"]["spanish.provenanceSourceCommit"]["actual"], OTHER)
        self.assertTrue(receipt["checks"]["english.entrySha256"]["pass"])

    def test_unserved_origin_reds_every_check_without_raising(self) -> None:
        code, receipt = self.run_verifier(origin=self.origin + "/absent")
        self.assertEqual(code, 1)
        self.assertEqual(receipt["legs"]["a"], "RED")
        self.assertTrue(receipt["checks"]["source.commitPresent"]["pass"])
        for name in ("receipt.reachable", "receipt.sourceCommit", "english.entrySha256",
                     "spanish.fileServed", "api.ok"):
            self.assertFalse(receipt["checks"][name]["pass"], name)
        self.assertIn("404", str(receipt["checks"]["receipt.reachable"]["actual"]))
        self.assertTrue(all(read["status"] == 404 for read in receipt["reads"]), receipt["reads"])

    def test_a_short_source_is_refused_before_any_read(self) -> None:
        refusal = io.StringIO()  # argparse writes its usage to stderr; a passing test stays quiet
        with contextlib.redirect_stderr(refusal), self.assertRaises(SystemExit) as refused:
            verifier.main(["--source", "14157a5d", "--origin", self.origin, "--no-browser"])
        self.assertEqual(refused.exception.code, 2)
        self.assertIn("the exact 40-character commit", refusal.getvalue())

    # ── the pieces leg A stands on ────────────────────────────────────────────────────────────
    def test_fingerprint_takes_the_runtime_modules_of_that_commit_in_order(self) -> None:
        self.fingerprint.stop()  # this test measures the real function, against a recorded `git`
        self.addCleanup(self.fingerprint.start)
        listing = "\n".join([
            "mock-api/app/routes.py", "mock-api/app/main.py", "mock-api/app/health.py",
            "mock-api/app/static/asset.py",  # a subdirectory is another package, so it stays out
            "mock-api/app/README.md",        # and only Python carries the runtime's code
        ]).encode()
        bytes_by_module = {"main.py": b"main", "health.py": b"health", "routes.py": b"routes"}

        def recorded(repo: pathlib.Path, *arguments: str) -> bytes:
            if arguments[0] == "ls-tree":
                return listing
            return bytes_by_module[arguments[1].split("/")[-1]]

        with mock.patch.object(verifier, "git", side_effect=recorded):
            self.assertEqual(verifier.source_modules(ROOT, SOURCE),
                             ["mock-api/app/health.py", "mock-api/app/main.py", "mock-api/app/routes.py"])
            digest = verifier.prototype_api_fingerprint(ROOT, SOURCE)
        self.assertEqual(digest, hashlib.sha256(b"healthmainroutes").hexdigest()[:12])
        self.assertEqual(len(digest), 12)

    def test_a_commit_this_checkout_lacks_reds_the_source_check(self) -> None:
        self.fingerprint.stop()
        self.addCleanup(self.fingerprint.start)
        with mock.patch.object(verifier, "git", side_effect=ValueError("unknown revision")):
            code, receipt = self.run_verifier()
        self.assertEqual(code, 1)
        self.assertFalse(receipt["checks"]["source.commitPresent"]["pass"])
        self.assertFalse(receipt["checks"]["api.code"]["pass"])
        self.assertEqual(receipt["prototypeApi"]["expectedCode"], "")

    def test_a_recorded_url_keeps_our_path_and_holds_a_third_party_to_its_host(self) -> None:
        """Both keys the published page carries sit in a URL: the Maps browser key in the query, the
        analytics project key as a path segment. A receipt travels into the company record, so it
        keeps the host of a third party and the path of one of ours."""
        self.assertEqual(verifier.redact(MAPS_BOOTSTRAP), "https://maps.googleapis.com/maps/api/js")
        self.assertEqual(verifier.redact(f"https://eu-assets.i.posthog.com/array/{POSTHOG}/config.js"),
                         "https://eu-assets.i.posthog.com")
        self.assertEqual(verifier.redact("https://cdn.example.com/bundle/TOKEN/app.js"),
                         "https://cdn.example.com")
        self.assertEqual(verifier.redact("https://demo.soyrocoto.com/api/proof/session?workspace=fish"),
                         "https://demo.soyrocoto.com/api/proof/session")
        self.assertEqual(verifier.redact("https://copper-demo.soyrocoto.com/api/cedar/workspaces"),
                         "https://copper-demo.soyrocoto.com/api/cedar/workspaces")
        _, receipt = self.run_verifier()
        self.assertNotIn("key=", json.dumps(receipt))

    def test_a_recorded_request_carries_neither_key(self) -> None:
        """The two rows that carried a key before: leg B's dropped-external row and leg C's."""
        analytics = f"https://eu-assets.i.posthog.com/array/{POSTHOG}/config.js"
        recorded = json.dumps([verifier.smoke_plan(analytics, "GET", ORIGIN),
                               verifier.ground_plan(analytics, "GET"),
                               verifier.smoke_plan(MAPS_BOOTSTRAP, "GET", ORIGIN),
                               verifier.ground_plan(MAPS_BOOTSTRAP, "GET")])
        self.assertNotIn(POSTHOG, recorded)
        self.assertNotIn("SECRET", recorded)
        self.assertIn("https://eu-assets.i.posthog.com", recorded)

    def test_a_leg_that_measured_nothing_is_red_rather_than_green(self) -> None:
        checks = verifier.Checks()
        checks.record("smoke.1600.boot", True, "mounted", "mounted")
        self.assertEqual(verifier.leg_status(checks, "b", True), "GREEN")
        self.assertEqual(verifier.leg_status(checks, "c", True), "RED")
        self.assertEqual(verifier.leg_status(checks, "c", False), "skipped")
        checks.skip("browser.available", "ModuleNotFoundError: playwright")
        self.assertEqual(verifier.leg_status(checks, "b", True), "RED")


class RoutingPolicyTests(unittest.TestCase):
    """What the two browser legs let through, as data.

    The published page writes while it draws: it mints a collection workspace and takes a customer
    session slot. A verification run is a reading, so both legs answer or refuse every write and the
    origin is left as it was found. Google's own map service keeps its bootstrap RPC, which is the
    one non-GET that leaves the browser."""

    def plans(self, method_and_urls: Any) -> list[dict[str, Any]]:
        return [verifier.ground_plan(url, method) for method, url in method_and_urls]

    def test_leg_c_refuses_every_write_the_page_attempts(self) -> None:
        workspace, session, flags, viewport = self.plans(PAGE_WRITES)
        for plan in (workspace, session):
            self.assertEqual(plan["action"], "drop", plan)
            self.assertEqual(plan["kind"], "write-refused", plan)
            self.assertEqual(plan["method"], "POST", plan)
        self.assertEqual(flags["action"], "drop")
        self.assertEqual(viewport["action"], "allow")  # Google's own map service answers its own RPC
        self.assertEqual(viewport["host"], "maps.googleapis.com")

    def test_leg_c_reads_the_ground_the_published_page_draws(self) -> None:
        for url in (MAPS_BOOTSTRAP, "https://maps.gstatic.com/mapfiles/tile.png",
                    f"{ORIGIN}/cedar/assets/app.js", f"{ORIGIN}/api/orders"):
            plan = verifier.ground_plan(url, "GET")
            self.assertEqual(plan["action"], "allow", url)

    def test_leg_c_names_the_analytics_host_it_drops(self) -> None:
        for host in ("eu.i.posthog.com", "eu-assets.i.posthog.com", "us.i.posthog.com", "posthog.com"):
            plan = verifier.ground_plan(f"https://{host}/flags/", "GET")
            self.assertEqual(plan["action"], "drop", host)
            self.assertEqual(plan["kind"], "analytics-dropped", host)
            self.assertEqual(plan["host"], host)
        self.assertTrue(verifier.is_analytics("us.i.posthog.com"))
        self.assertFalse(verifier.is_analytics("demo.soyrocoto.com"))
        self.assertFalse(verifier.is_analytics("notposthog.com"))

    def test_leg_b_answers_the_page_itself_and_keeps_the_network_out(self) -> None:
        fixture = verifier.smoke_plan(f"{ORIGIN}/api/proof/state", "GET", ORIGIN)
        self.assertEqual(fixture["action"], "fixture")
        self.assertEqual(fixture["body"]["ready"], True)
        self.assertEqual(verifier.smoke_plan(f"{ORIGIN}/api/proof/session", "POST", ORIGIN)["action"],
                         "fixture")
        self.assertEqual(verifier.smoke_plan(f"{ORIGIN}/api/orders", "GET", ORIGIN)["action"], "refuse")
        for _, url in PAGE_WRITES:
            plan = verifier.smoke_plan(url, "POST", ORIGIN)
            self.assertIn(plan["action"], ("drop", "fixture"), url)
        self.assertEqual(verifier.smoke_plan(f"{ORIGIN}/cedar/assets/app.js", "GET", ORIGIN)["action"],
                         "allow")
        self.assertEqual(verifier.smoke_plan(f"{ORIGIN}/cedar/", "POST", ORIGIN)["action"], "drop")

    def test_the_handler_does_what_the_plan_says(self) -> None:
        """Both browser legs route through `act_on`, which returns the verb it performed on the
        route; the run's `allowed` list reads that verb. So the handler itself is under test: a
        write plan must ABORT the route, a fixture plan must FULFILL it, and only an allow plan
        may let it CONTINUE (re-review, 14 September 2026)."""
        import asyncio

        class FakeRoute:
            def __init__(self) -> None:
                self.calls: list[str] = []

            async def abort(self, reason: str = "") -> None:
                self.calls.append(f"abort:{reason}")

            async def fulfill(self, **kwargs: Any) -> None:
                self.calls.append("fulfill:" + ("json" if "json" in kwargs else str(kwargs.get("status"))))

            async def continue_(self) -> None:
                self.calls.append("continue")

        async def drive(plan: dict[str, Any]) -> tuple[str, list[str]]:
            route = FakeRoute()
            did = await verifier.act_on(route, plan)
            return did, route.calls

        for _, url in PAGE_WRITES:
            plan = verifier.ground_plan(url, "POST")
            did, calls = asyncio.run(drive(plan))
            if plan["action"] == "allow":
                # the one non-GET that leaves the browser: Google's own bootstrap RPC
                self.assertIn(plan["host"], verifier.GOOGLE_MAPS, url)
                self.assertEqual((did, calls), ("continue", ["continue"]), url)
            else:
                self.assertEqual((did, calls), ("abort", ["abort:blockedbyclient"]), url)
        bootstrap = verifier.ground_plan("https://maps.googleapis.com/maps/api/js", "GET")
        did, calls = asyncio.run(drive(bootstrap))
        self.assertEqual((did, calls), ("continue", ["continue"]))
        did, calls = asyncio.run(drive(verifier.smoke_plan(f"{ORIGIN}/api/proof/state", "GET", ORIGIN)))
        self.assertEqual(did, "fulfill", "a fixture plan fulfils from the fixture")
        self.assertTrue(calls and calls[0].startswith("fulfill"), calls)
        did, calls = asyncio.run(drive(verifier.smoke_plan(f"{ORIGIN}/cedar/", "POST", ORIGIN)))
        self.assertEqual((did, calls), ("abort", ["abort:blockedbyclient"]))

    def test_a_check_counts_what_the_run_let_through(self) -> None:
        """`ground.<width>.writes` and `.analytics` read the allowed list, so a handler that stops
        refusing lands its request there and reds the run."""
        allowed = [plan for plan in self.plans(PAGE_WRITES) if plan["action"] == "allow"]
        self.assertEqual(verifier.writes_through(allowed), [])
        self.assertEqual(verifier.analytics_through(allowed), [])
        let_through = [verifier.ground_plan(url, method) | {"action": "allow"}
                       for method, url in PAGE_WRITES]  # a handler that forgot to refuse
        self.assertEqual(len(verifier.writes_through(let_through)), 3)  # the analytics POST counts too
        self.assertEqual(len(verifier.analytics_through(let_through)), 1)


if __name__ == "__main__":
    unittest.main()
