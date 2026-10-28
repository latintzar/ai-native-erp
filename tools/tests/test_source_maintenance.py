"""Exercise maintenance entrypoints from unrelated working directories, without services."""

from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(relative: str):
    spec = importlib.util.spec_from_file_location(Path(relative).stem, ROOT / relative)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ArtworkMaintenance(unittest.TestCase):
    def test_generator_preserves_reviewed_resolver_in_separate_output(self):
        source = ROOT / "app/src/prototypes/cedar/painting-map.ts"
        before = source.read_bytes()
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "review.ts"
            result = subprocess.run(
                [sys.executable, str(ROOT / "library/paintings/build_map.py"), "--output", str(output)],
                cwd=folder,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(output.exists(), result.stdout)
            generated = output.read_text()
            original = before.decode()
            marker = "\n];\n"
            self.assertEqual(generated.split(marker, 1)[1], original.split(marker, 1)[1])
            self.assertIn("CURATED_EXACT_SKU_ALIASES", generated)
            self.assertEqual(source.read_bytes(), before)

    def test_reference_checker_reads_current_app_tree(self):
        checker = load("library/paintings/reference_gate.py")
        nodes = checker.load_tree()
        self.assertGreater(len(nodes), 100)
        self.assertTrue(any(row["name"] == "Merluza" for row in nodes.values()))

    def test_resolver_exam_uses_current_source(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "library/paintings/exam_map.py")],
            cwd="/tmp",
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("13/13 pass", result.stdout)


class BaseSourceMaintenance(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / "app"
        (self.app / "tools").mkdir(parents=True)
        for name in ("fork.mjs", "extract-props.mjs", "base-source.mjs"):
            source = ROOT / "app/tools" / name
            if source.exists():
                shutil.copyfile(source, self.app / "tools" / name)
        shutil.copyfile(ROOT / "app/package-lock.json", self.app / "package-lock.json")
        self.upstream = self.root / "upstream"
        (self.upstream / "src/button").mkdir(parents=True)
        version = json.loads((self.app / "package-lock.json").read_text())["packages"]["node_modules/baseui"][
            "version"
        ]
        (self.upstream / "package.json").write_text(json.dumps({"name": "baseui", "version": version}))
        (self.upstream / "LICENSE").write_text("Fixture upstream licence\n")
        (self.upstream / "src/button/types.ts").write_text("export type ButtonProps = { title: string; };\n")
        (self.upstream / "src/button/button.test.ts").write_text("upstream test\n")

    def run_fork(self):
        return subprocess.run(
            [
                "node",
                str(self.app / "tools/fork.mjs"),
                "--source-root",
                str(self.upstream),
                "button",
                "fixture-button",
                "Fixture fork",
            ],
            cwd=self.root,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_fork_copies_source_and_licence_without_overwriting_existing_work(self):
        result = self.run_fork()
        self.assertEqual(result.returncode, 0, result.stderr)
        output = self.app / "src/rocoto/fixture-button"
        self.assertIn("Fixture fork", (output / "types.ts").read_text())
        self.assertEqual(
            (output / "LICENSE.baseweb.txt").read_bytes(), (self.upstream / "LICENSE").read_bytes()
        )
        self.assertFalse((output / "button.test.ts").exists())
        (output / "types.ts").write_text("reviewed changes\n")
        self.assertNotEqual(self.run_fork().returncode, 0)
        self.assertEqual((output / "types.ts").read_text(), "reviewed changes\n")

    def test_fork_missing_licence_and_wrong_version_fail_before_output(self):
        licence = self.upstream / "LICENSE"
        licence.unlink()
        self.assertNotEqual(self.run_fork().returncode, 0)
        self.assertFalse((self.app / "src/rocoto").exists())
        licence.write_text("Fixture upstream licence\n")
        (self.upstream / "package.json").write_text('{"name":"baseui","version":"0.0.0"}')
        self.assertNotEqual(self.run_fork().returncode, 0)
        self.assertFalse((self.app / "src/rocoto").exists())

    def test_props_extractor_reads_local_and_explicit_upstream_types_from_any_cwd(self):
        output = self.root / "props.json"
        result = subprocess.run(
            [
                "node",
                str(ROOT / "app/tools/extract-props.mjs"),
                "--source-root",
                str(self.upstream),
                "--output",
                str(output),
            ],
            cwd=self.root,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        props = json.loads(output.read_text())
        self.assertEqual(props["button"]["props"][0]["name"], "title")
        self.assertIn("product-card", props)
        self.assertIn("composer", props)

    def test_props_extractor_validates_source_before_replacing_snapshot(self):
        output = self.root / "props.json"
        output.write_text("reviewed snapshot\n")
        result = subprocess.run(
            [
                "node",
                str(self.app / "tools/extract-props.mjs"),
                "--source-root",
                str(self.root / "missing"),
                "--output",
                str(output),
            ],
            cwd=self.root,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Base Web source", result.stderr)
        self.assertEqual(output.read_text(), "reviewed snapshot\n")


class RehearsalEntrypoints(unittest.TestCase):
    def test_invalid_environment_is_rejected_before_backend_imports(self):
        import os

        for script in ("rehearsal_url_e2e.py", "sup_http_smoke.py"):
            with self.subTest(script=script):
                env = {"PATH": os.defpath, "DATABASE_URL": "postgresql://fixture@localhost/rocoto"}
                result = subprocess.run(
                    [sys.executable, "-S", str(ROOT / "backend/tests" / script)],
                    cwd="/tmp",
                    env=env,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Rehearsal environment", result.stderr)
                self.assertNotIn("ModuleNotFoundError", result.stderr)

    def test_valid_rehearsal_allows_distinct_roles_and_rejects_mixed_databases(self):
        from unittest.mock import patch

        checker = load("backend/tests/rehearsal_config.py")
        env = {"ROCOTO_EGRESS_SANDBOX": "1"}
        for key, role in zip(
            ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"),
            ("owner", "runtime", "control"),
            strict=True,
        ):
            env[key] = f"postgresql://{role}@localhost:5434/rocoto_rehearsal"
        with patch.dict("os.environ", env, clear=True):
            self.assertEqual(checker.require_rehearsal(), "rocoto_rehearsal")
        env["CONTROL_DATABASE_URL"] = "postgresql://control@other-host/rocoto_rehearsal"
        with patch.dict("os.environ", env, clear=True), self.assertRaises(SystemExit):
            checker.require_rehearsal()

    def test_rehearsal_rejects_query_routing_before_backend_initialization(self):
        from unittest.mock import patch

        checker = load("backend/tests/rehearsal_config.py")
        dsn_keys = ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL")
        clean = dict.fromkeys(dsn_keys, "postgresql://fixture@localhost:5434/rocoto_rehearsal")
        clean["ROCOTO_EGRESS_SANDBOX"] = "1"
        queries = (
            "dbname=rocoto",
            "database=rocoto",
            "host=other-host",
            "port=5432",
            "service=other-service",
            "%64bname=rocoto",
            "sslmode=disable",
        )
        for key in dsn_keys:
            for query in queries:
                with self.subTest(key=key, query=query):
                    env = dict(clean)
                    env[key] += "?" + query
                    with (
                        patch.dict("os.environ", env, clear=True),
                        self.assertRaisesRegex(
                            SystemExit,
                            "plain PostgreSQL URLs",
                        ),
                    ):
                        checker.require_rehearsal()
        with patch.dict("os.environ", clean, clear=True):
            self.assertEqual(checker.require_rehearsal(), "rocoto_rehearsal")


if __name__ == "__main__":
    unittest.main()
