"""Behavior tests against the actual shared CLI and standalone product adapters.

Run from the company checkout: python3 -m unittest discover -s tools/testdata/tests -v
All fixtures use temporary directories, synthetic data and standard-library storage.
"""

import fcntl
import importlib.util
import json
import os
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1]
CLI = TOOLS / "testdata.py"
FIXTURE = TOOLS / "adapters" / "fixtures.py"
KITTENS = TOOLS / "examples" / "kittens"


class LifecycleTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="company-testdata-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.owner = self.root / "product"
        self.owner.mkdir()
        (self.owner / ".git").mkdir()
        self.state_root = self.root / "private-state"
        self.state_root.mkdir(mode=0o700)
        shutil.copy2(FIXTURE, self.owner / "adapter.py")
        self.manifest = self.owner / "testdata.json"
        self.scenario = self.owner / "scenario.json"
        self.write_manifest()
        self.write_scenario()

    def write_manifest(self, **overrides):
        manifest = {
            "version": 1,
            "product": "synthetic-library",
            "adapter": ["python3", "adapter.py"],
            "environments": ["development"],
            "effects": "capture",
            "scenarios": {"readers": "scenario.json"},
        }
        manifest.update(overrides)
        self.manifest.write_text(json.dumps(manifest))

    def write_scenario(self, **overrides):
        fixture = {
            "collections": {
                "books": [{"id": "book-1", "title": "Synthetic garden guide"}],
                "readers": [{"id": "reader-1", "email": "reader@example.invalid"}],
            },
            "effects": [{"kind": "hold-ready", "recipient": "reader@example.invalid", "book_id": "book-1"}],
        }
        fixture.update(overrides)
        self.scenario.write_text(json.dumps({"synthetic": True, "fixture": fixture}))

    def cli(
        self,
        operation,
        run_id=None,
        *,
        success=True,
        manifest=None,
        scenario="readers",
        environment="development",
        state_root=None,
        extra=(),
        env=None,
    ):
        command = [sys.executable, str(CLI), operation, "--state-root", str(state_root or self.state_root)]
        if run_id is None:
            command += [
                "--manifest",
                str(manifest or self.manifest),
                "--scenario",
                scenario,
                "--environment",
                environment,
            ]
        else:
            command += ["--run", run_id]
        command += list(extra)
        completed = subprocess.run(
            command, cwd=self.root, env=env, capture_output=True, text=True, timeout=20
        )
        self.assertEqual(
            completed.returncode == 0,
            success,
            f"exit={completed.returncode}\nstdout={completed.stdout}\nstderr={completed.stderr}",
        )
        try:
            output = json.loads(completed.stdout)
        except json.JSONDecodeError:
            self.fail(
                f"CLI must return one JSON response; got {completed.stdout!r}; stderr={completed.stderr!r}"
            )
        self.assertEqual(output["ok"], success, output)
        return output, completed

    def create(self, **kwargs):
        output, _ = self.cli("create", **kwargs)
        return output

    def fixture_state(self, output):
        return Path(output["resources"]["fixture_file"])

    def test_plan_and_create_require_explicit_target(self):
        for operation in ("plan", "create"):
            completed = subprocess.run(
                [sys.executable, str(CLI), operation, "--state-root", str(self.state_root)],
                cwd=self.root,
                capture_output=True,
                text=True,
                timeout=20,
            )
            self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(list(self.state_root.iterdir()), [])

    def test_plan_has_no_resources_and_create_records_private_provenance(self):
        planned, _ = self.cli("plan")
        self.assertEqual(planned.get("resources", {}), {})
        self.assertFalse(list(self.state_root.rglob("fixtures.json")))
        created = self.create()
        run_dir = self.state_root / created["run_id"]
        self.assertTrue((run_dir / "run.json").is_file())
        self.assertEqual(
            json.loads((run_dir / "scenario.json").read_text()), json.loads(self.scenario.read_text())
        )
        self.assertTrue(Path(created["receipt"]).is_file())
        for path in run_dir.rglob("*"):
            expected = 0o700 if path.is_dir() else 0o600
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), expected, str(path))
        record = (run_dir / "run.json").read_text()
        self.assertIn("synthetic-library", record)
        self.assertIn("scenario", record)
        self.assertIn("sha", record)

    def test_lifecycle_is_repeatable_and_effects_are_captured(self):
        created = self.create()
        run_id = created["run_id"]
        self.cli("create", run_id)
        for _ in range(2):
            populated, _ = self.cli("populate", run_id)
            self.assertEqual(populated["result"]["collections"], {"books": 1, "readers": 1})
        path = self.fixture_state(created)
        populated_bytes = path.read_bytes()
        self.cli("populate", run_id)
        self.assertEqual(path.read_bytes(), populated_bytes)
        for _ in range(2):
            exercised, _ = self.cli("exercise", run_id)
            self.assertEqual(exercised["result"]["captured_effects"], 1)
        state = json.loads(path.read_text())
        self.assertEqual(state["captured_effects"][0]["mode"], "capture")
        effect_id = state["captured_effects"][0]["id"]
        for _ in range(2):
            reset, _ = self.cli("reset", run_id)
            self.assertEqual(reset["result"]["collections"], {"books": 1, "readers": 1})
            self.assertEqual(reset["result"]["captured_effects"], 0)
            self.assertEqual(path.read_bytes(), populated_bytes)
        self.cli("populate", run_id)
        self.assertEqual(path.read_bytes(), populated_bytes)
        self.cli("exercise", run_id)
        self.assertEqual(json.loads(path.read_text())["captured_effects"][0]["id"], effect_id)
        for _ in range(2):
            deleted, _ = self.cli("delete", run_id)
            self.assertFalse(deleted["result"]["exists"])
        self.assertFalse(path.exists())

    def test_failed_create_persists_resource_identity_for_delete(self):
        self.write_scenario(fail_after_create=True)
        failed, _ = self.cli("create", success=False)
        path = self.fixture_state(failed)
        self.assertTrue(path.is_file())
        record = json.loads((self.state_root / failed["run_id"] / "run.json").read_text())
        self.assertIn(str(path), json.dumps(record))
        deleted, _ = self.cli("delete", failed["run_id"])
        self.assertFalse(deleted["result"]["exists"])
        self.assertFalse(path.exists())

    def test_failed_operation_preserves_prior_resources_for_recovery(self):
        (self.owner / "adapter.py").write_text(
            "import json, pathlib, sys\n"
            "request = json.load(sys.stdin)\n"
            "marker = pathlib.Path(request['state_dir']) / 'owned-marker.json'\n"
            "resources = {'marker': str(marker), 'namespace': request['run_id']}\n"
            "if request['operation'] == 'create':\n"
            "    marker.write_text(json.dumps(resources))\n"
            "    marker.chmod(0o600)\n"
            "elif request['operation'] == 'delete':\n"
            "    assert request['resources'] == resources\n"
            "    marker.unlink()\n"
            "if request['operation'] == 'populate':\n"
            "    print(json.dumps({'ok': False, 'resources': {}, 'error': 'Synthetic population fault'}))\n"
            "else:\n"
            "    print(json.dumps({'ok': True, 'resources': resources, "
            "'result': {'exists': marker.exists()}}))\n"
        )
        created = self.create()
        failed, _ = self.cli("populate", created["run_id"], success=False)
        self.assertEqual(failed["resources"], created["resources"])
        record = json.loads((self.state_root / created["run_id"] / "run.json").read_text())
        self.assertEqual(record["resources"], created["resources"])
        self.assertEqual(json.loads(Path(failed["receipt"]).read_text())["resources"], created["resources"])
        self.cli("delete", created["run_id"])
        self.assertFalse(Path(created["resources"]["marker"]).exists())

    def test_reset_and_delete_preserve_another_run_and_unrelated_files(self):
        first = self.create()
        second = self.create()
        self.assertNotEqual(first["run_id"], second["run_id"])
        self.cli("populate", first["run_id"])
        self.cli("populate", second["run_id"])
        second_path = self.fixture_state(second)
        original = second_path.read_bytes()
        sentinel = self.state_root / first["run_id"] / "unrelated.txt"
        sentinel.write_text("keep this unrelated artifact")
        sentinel.chmod(0o600)
        for operation in ("reset", "delete"):
            self.cli(operation, first["run_id"])
            self.assertEqual(second_path.read_bytes(), original)
            self.assertEqual(sentinel.read_text(), "keep this unrelated artifact")
        status, _ = self.cli("status", second["run_id"])
        self.assertEqual(status["result"]["collections"], {"books": 1, "readers": 1})

    def test_private_state_path_boundaries(self):
        public = self.root / "public-state"
        public.mkdir(mode=0o755)
        public.chmod(0o755)
        linked = self.root / "state-link"
        linked.symlink_to(self.state_root, target_is_directory=True)
        inside = self.owner / "private-state"
        inside.mkdir(mode=0o700)
        for path in (public, linked, inside, Path("relative-state")):
            with self.subTest(path=path):
                self.cli("create", state_root=path, success=False)
        self.assertFalse(list(self.root.rglob("fixtures.json")))

    def test_symlink_in_state_parent_is_refused(self):
        actual = self.root / "actual-parent"
        actual.mkdir(mode=0o700)
        (actual / "state").mkdir(mode=0o700)
        alias = self.root / "alias-parent"
        alias.symlink_to(actual, target_is_directory=True)
        self.cli("create", state_root=alias / "state", success=False)

    def test_busy_run_refuses_concurrent_operation(self):
        created = self.create()
        path = self.fixture_state(created)
        original = path.read_bytes()
        with (self.state_root / created["run_id"] / ".lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.cli("status", created["run_id"], success=False)
            self.cli("delete", created["run_id"], success=False)
        self.assertEqual(path.read_bytes(), original)
        self.cli("status", created["run_id"])

    def test_run_id_cannot_select_parent_or_arbitrary_directory(self):
        for run_id in ("../product", str(self.owner), "synthetic-non-uuid"):
            with self.subTest(run_id=run_id):
                self.cli("delete", run_id, success=False)
        self.assertTrue(self.manifest.is_file())

    def test_config_requires_a_private_regular_absolute_file(self):
        config = self.root / "public-config.json"
        config.write_text("{}")
        config.chmod(0o644)
        self.cli("create", success=False, extra=["--config", str(config)])
        config.chmod(0o600)
        link = self.root / "config-link.json"
        link.symlink_to(config)
        self.cli("create", success=False, extra=["--config", str(link)])
        self.cli("create", success=False, extra=["--config", "public-config.json"])

    def test_manifest_paths_stay_in_product_owner(self):
        outside = self.root / "outside.json"
        outside.write_text(self.scenario.read_text())
        self.write_manifest(scenarios={"readers": "../outside.json"})
        self.cli("plan", success=False)
        shutil.copy2(FIXTURE, self.root / "outside.py")
        self.write_manifest(adapter=["python3", "../outside.py"])
        self.cli("create", success=False)
        self.write_manifest()
        self.scenario.unlink()
        self.scenario.symlink_to(outside)
        self.cli("plan", success=False)

    def test_source_manifest_and_scenario_drift_refuse_mutation(self):
        paths = [self.owner / "adapter.py", self.manifest, self.scenario]
        originals = {path: path.read_bytes() for path in paths}
        for path in paths:
            with self.subTest(changed=path.name):
                created = self.create()
                fixture = self.fixture_state(created)
                before = fixture.read_bytes()
                path.write_bytes(originals[path] + b"\n")
                refused, _ = self.cli("populate", created["run_id"], success=False)
                self.assertRegex(json.dumps(refused).lower(), "changed|drift")
                self.assertEqual(fixture.read_bytes(), before)
                path.write_bytes(originals[path])
                self.cli("delete", created["run_id"])

    def test_declared_dependency_drift_refuses_adapter_execution(self):
        dependency = self.owner / "schema.sql"
        dependency.write_text("-- synthetic schema version one\n")
        self.write_manifest(inputs=["*.sql"])
        created = self.create()
        dependency.write_text("-- synthetic schema version two\n")
        self.cli("exercise", created["run_id"], success=False)

    def test_production_and_undeclared_environments_are_refused(self):
        for environment in ("production", "staging"):
            with self.subTest(environment=environment):
                self.cli("create", environment=environment, success=False)
        self.write_manifest(environments=["development", "production"])
        self.cli("create", environment="production", success=False)
        self.assertFalse(list(self.root.rglob("fixtures.json")))

    def test_provider_effects_are_refused_before_adapter_execution(self):
        self.write_manifest(effects="live")
        self.cli("create", success=False)
        self.assertFalse(list(self.root.rglob("fixtures.json")))

    def test_provider_credentials_are_absent_from_adapter_environment(self):
        (self.owner / "adapter.py").write_text(
            "import json, os, sys\n"
            "request = json.load(sys.stdin)\n"
            "print(json.dumps({'ok': True, 'resources': {}, 'result': "
            "{'provider_key_present': 'RESEND_API_KEY' in os.environ, "
            "'openai_key_present': 'OPENAI_API_KEY' in os.environ}}))\n"
        )
        secret = "synthetic-provider-credential-7812"
        environment = dict(os.environ, RESEND_API_KEY=secret, OPENAI_API_KEY=secret)
        output, completed = self.cli("create", env=environment)
        self.assertFalse(output["result"]["provider_key_present"])
        self.assertFalse(output["result"]["openai_key_present"])
        self.assertNotIn(secret, completed.stdout + completed.stderr)
        for path in self.state_root.rglob("*.json"):
            self.assertNotIn(secret, path.read_text())

    def test_config_secrets_and_subprocess_stderr_stay_out_of_receipts(self):
        secret = "synthetic-ephemeral-config-4567"
        config = self.root / "config.json"
        config.write_text(json.dumps({"api_key": secret}))
        config.chmod(0o600)
        (self.owner / "adapter.py").write_text(
            "import json, sys\n"
            "request = json.load(sys.stdin)\n"
            "print(request['config']['api_key'], file=sys.stderr)\n"
            "print(json.dumps({'ok': False, 'resources': {}, "
            "'error': request['config']['api_key']}))\n"
        )
        _, completed = self.cli("create", success=False, extra=["--config", str(config)])
        self.assertNotIn(secret, completed.stdout + completed.stderr)
        for path in self.state_root.rglob("*"):
            if path.is_file():
                self.assertNotIn(secret.encode(), path.read_bytes(), str(path))

    def test_private_resource_identity_remains_exact_for_cleanup(self):
        target_id = "synthetic-private-target-9281"
        config = self.root / "target.json"
        config.write_text(json.dumps({"target_id": target_id}))
        config.chmod(0o600)
        (self.owner / "adapter.py").write_text(
            "import json, sys\n"
            "request = json.load(sys.stdin)\n"
            "resources = {'target_id': request['config']['target_id']}\n"
            "if request['operation'] == 'delete':\n"
            "    assert request['resources'] == resources\n"
            "print(json.dumps({'ok': True, 'resources': resources, 'result': {}}))\n"
        )
        created, completed = self.cli("create", extra=["--config", str(config)])
        self.assertNotIn(target_id, completed.stdout + completed.stderr)
        record_path = self.state_root / created["run_id"] / "run.json"
        self.assertEqual(json.loads(record_path.read_text())["resources"]["target_id"], target_id)
        self.assertNotIn(target_id, Path(created["receipt"]).read_text())
        for _ in range(2):
            _, completed = self.cli("delete", created["run_id"])
            self.assertNotIn(target_id, completed.stdout + completed.stderr)

    def test_recorded_adapter_can_inspect_and_delete_after_product_source_is_removed(self):
        created = self.create()
        self.cli("populate", created["run_id"])
        path = self.fixture_state(created)
        shutil.rmtree(self.owner)
        status, _ = self.cli("status", created["run_id"])
        self.assertEqual(status["result"]["collections"], {"books": 1, "readers": 1})
        self.cli("populate", created["run_id"], success=False)
        self.cli("delete", created["run_id"])
        self.assertFalse(path.exists())

    def test_tampered_or_extended_recorded_adapter_is_refused_before_cleanup(self):
        created = self.create()
        path = self.fixture_state(created)
        original_state = path.read_bytes()
        frozen_adapter = self.state_root / created["run_id"] / "source" / "adapter.py"
        original_adapter = frozen_adapter.read_bytes()
        frozen_adapter.write_bytes(original_adapter + b"\n# synthetic modification\n")
        for operation in ("status", "delete"):
            self.cli(operation, created["run_id"], success=False)
            self.assertEqual(path.read_bytes(), original_state)
        frozen_adapter.write_bytes(original_adapter)
        extra = frozen_adapter.parent / "shadow_module.py"
        extra.write_text("# synthetic undeclared module\n")
        extra.chmod(0o600)
        for operation in ("status", "delete"):
            self.cli(operation, created["run_id"], success=False)
            self.assertEqual(path.read_bytes(), original_state)
        extra.unlink()
        self.cli("delete", created["run_id"])

    def test_invalid_adapter_json_is_safe_and_receipted(self):
        (self.owner / "adapter.py").write_text(
            "import sys\n"
            "print('synthetic-sensitive-stderr-2981', file=sys.stderr)\n"
            "print('unstructured adapter output')\n"
        )
        output, completed = self.cli("create", success=False)
        self.assertNotIn("synthetic-sensitive-stderr-2981", completed.stdout + completed.stderr)
        self.assertTrue(Path(output["receipt"]).is_file())
        self.assertTrue((self.state_root / output["run_id"] / "run.json").is_file())

    def test_timeout_keeps_run_recoverable_and_stops_background_children(self):
        (self.owner / "adapter.py").write_text(
            "import json, pathlib, subprocess, sys, time\n"
            "request = json.load(sys.stdin)\n"
            "marker = pathlib.Path(request['state_dir']) / 'owned-marker.json'\n"
            "if request['operation'] == 'create':\n"
            "    marker.write_text(json.dumps({'run_id': request['run_id']}))\n"
            "    marker.chmod(0o600)\n"
            "    child = 'import pathlib, sys, time; time.sleep(2); pathlib.Path(sys.argv[1]).touch()'\n"
            "    subprocess.Popen([sys.executable, '-c', child, str(marker.parent / 'escaped-child')])\n"
            "    time.sleep(10)\n"
            "elif request['operation'] == 'delete':\n"
            "    assert json.loads(marker.read_text())['run_id'] == request['run_id']\n"
            "    marker.unlink()\n"
            "print(json.dumps({'ok': True, 'resources': {}, 'result': {'exists': marker.exists()}}))\n"
        )
        failed, _ = self.cli("create", success=False, extra=["--timeout", "1"])
        run_dir = self.state_root / failed["run_id"]
        self.assertTrue((run_dir / "owned-marker.json").is_file())
        self.assertTrue(Path(failed["receipt"]).is_file())
        time.sleep(1.2)
        self.assertFalse((run_dir / "escaped-child").exists())
        deleted, _ = self.cli("delete", failed["run_id"])
        self.assertFalse(deleted["result"]["exists"])
        self.assertFalse((run_dir / "owned-marker.json").exists())

    def test_sqlite_product_schema_proves_household_and_run_isolation(self):
        kittens_owner = self.root / "kitten-product"
        shutil.copytree(KITTENS, kittens_owner)
        manifest = kittens_owner / "testdata.json"
        created = self.create(manifest=manifest, scenario="two-households")
        second = self.create(manifest=manifest, scenario="two-households")
        for run in (created, second):
            self.cli("populate", run["run_id"])
            self.cli("exercise", run["run_id"])
            self.cli("exercise", run["run_id"])
        database = Path(created["resources"]["database"])
        spec = importlib.util.spec_from_file_location("kitten_test_adapter", kittens_owner / "adapter.py")
        adapter = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(adapter)
        with sqlite3.connect(database) as connection:
            connection.execute("PRAGMA foreign_keys = ON")
            self.assertIsNotNone(
                adapter.booking_for_household(connection, "household-alder", "booking-alder")
            )
            self.assertIsNone(adapter.booking_for_household(connection, "household-birch", "booking-alder"))
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute(
                    "INSERT INTO bookings VALUES (?, ?, ?, ?)",
                    ("household-alder", "cross-household", "kitten-pip", "2030-02-01T09:00:00Z"),
                )
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM captured_effects").fetchone()[0], 2)
        reset, _ = self.cli("reset", created["run_id"])
        self.assertEqual(
            reset["result"]["counts"], {"households": 2, "kittens": 2, "bookings": 2, "captured_effects": 0}
        )
        self.cli("delete", created["run_id"])
        self.assertFalse(database.exists())
        with sqlite3.connect(second["resources"]["database"]) as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM bookings").fetchone()[0], 2)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM captured_effects").fetchone()[0], 2)

    def test_sqlite_resource_transplanted_from_another_run_is_preserved(self):
        kittens_owner = self.root / "kitten-product"
        shutil.copytree(KITTENS, kittens_owner)
        manifest = kittens_owner / "testdata.json"
        first = self.create(manifest=manifest, scenario="two-households")
        second = self.create(manifest=manifest, scenario="two-households")
        first_database = Path(first["resources"]["database"])
        second_database = Path(second["resources"]["database"])
        original_first = first_database.read_bytes()
        second_bytes = second_database.read_bytes()
        shutil.copyfile(second_database, first_database)
        for operation in ("populate", "exercise", "reset", "delete"):
            self.cli(operation, first["run_id"], success=False)
            self.assertEqual(first_database.read_bytes(), second_bytes)
            self.assertEqual(second_database.read_bytes(), second_bytes)
        first_database.write_bytes(original_first)
        self.cli("delete", first["run_id"])
        self.assertFalse(first_database.exists())
        self.assertTrue(second_database.exists())


if __name__ == "__main__":
    unittest.main()
