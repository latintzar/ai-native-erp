"""Exercise the actual environment migration against disposable configuration and state."""

from __future__ import annotations

import importlib.util
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / "deploy/staging/demo-env.py"
TEMPLATE = ROOT / "deploy/staging/demo.env.example"


class DemoEnvironment(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "backend.env"
        self.target = self.root / "demo.env"
        self.source.write_text("ANTHROPIC_API_KEY='preserve this fixture'\n"
                               "ROCOTO_AUDIO_RETENTION_DAYS=91\n"
                               "DATABASE_URL=backend-fixture\n_RUNTIME_PRIVATE=private-fixture\n"
                               "_PG_OWNER_PW=owner-fixture\nROCOTO_API_KEY=api-fixture\n"
                               "HOME=/backend/home\nPYTHONPATH=/backend/code\n")

    def run_helper(self, check: bool = False) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(HELPER), "--source", str(self.source), "--target", str(self.target),
             "--template", str(TEMPLATE), "--root", str(self.root), *(["--check"] if check else [])],
            env={"PATH": os.environ["PATH"]}, capture_output=True, text=True, timeout=10,
        )

    def test_first_migration_keeps_only_runtime_configuration_and_preserves_state(self) -> None:
        state = self.root / "kit-state/calls"
        state.mkdir(parents=True)
        recording = state / "fixture.json"
        recording.write_bytes(b'{"fixture":"preserve"}\n')
        before = (recording.stat().st_ino, recording.read_bytes())
        result = self.run_helper()
        self.assertEqual(result.returncode, 0, result.stderr)
        text = self.target.read_text()
        self.assertIn("ANTHROPIC_API_KEY='preserve this fixture'\n", text)
        self.assertIn("ROCOTO_AUDIO_RETENTION_DAYS=91\n", text)
        self.assertNotIn("backend-fixture", text)
        self.assertNotIn("owner-fixture", text)
        self.assertNotIn("api-fixture", text)
        self.assertNotIn("private-fixture", text)
        self.assertNotIn("HOME=", text)
        self.assertNotIn("PYTHONPATH=", text)
        self.assertIn("# DEEPGRAM_API_KEY=\n", text)
        self.assertEqual(stat.S_IMODE(self.target.stat().st_mode), 0o600)
        self.assertEqual(before, (recording.stat().st_ino, recording.read_bytes()))
        self.assertEqual(self.run_helper(check=True).returncode, 0)

    def test_separate_configuration_wins_and_removed_keys_stay_removed(self) -> None:
        self.assertEqual(self.run_helper().returncode, 0)
        self.target.write_text("DEEPGRAM_API_KEY=demo-choice\n")
        result = self.run_helper()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("DEEPGRAM_API_KEY=demo-choice", self.target.read_text())
        self.assertNotIn("preserve this fixture", self.target.read_text())
        self.assertIn("# ANTHROPIC_API_KEY=", self.target.read_text())

    def test_custom_state_or_public_base_requires_explicit_migration(self) -> None:
        for name in ("ROCOTO_RUNTIME_STATE_DIR", "ROCOTO_RUNTIME_PUBLIC_BASE"):
            with self.subTest(name=name):
                self.source.write_text(f"{name}=/keep-this-existing-location\n")
                result = self.run_helper()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(name, result.stderr)
                self.assertFalse(self.target.exists())
        self.source.write_text(f'ROCOTO_RUNTIME_STATE_DIR="{self.root}/kit-state"\n'
                               "ROCOTO_RUNTIME_PUBLIC_BASE=https://demo.soyrocoto.com\n")
        self.assertEqual(self.run_helper().returncode, 0)
        self.assertNotIn("ROCOTO_RUNTIME_STATE_DIR=", self.target.read_text())

    def test_unexpected_names_and_unsafe_permissions_fail_without_values(self) -> None:
        self.target.write_text("DATABASE_URL=do-not-print-this-value\n")
        self.target.chmod(0o600)
        before = self.target.read_bytes()
        for check in (True, False):
            result = self.run_helper(check=check)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("DATABASE_URL", result.stderr)
            self.assertNotIn("do-not-print-this-value", result.stdout + result.stderr)
            self.assertEqual(self.target.read_bytes(), before)
        self.target.write_text("# empty\n")
        self.target.chmod(0o644)
        self.assertNotEqual(self.run_helper(check=True).returncode, 0)

    def test_multiline_values_and_symlinks_refuse_without_overwriting(self) -> None:
        self.source.write_text('ANTHROPIC_API_KEY="do-not-print-this-value\ncontinued"\n')
        result = self.run_helper()
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("do-not-print-this-value", result.stdout + result.stderr)
        self.assertFalse(self.target.exists())
        self.target.symlink_to(self.source)
        self.assertNotEqual(self.run_helper().returncode, 0)
        self.assertTrue(self.target.is_symlink())

    def test_template_coverage_is_derived_from_runtime_readers(self) -> None:
        spec = importlib.util.spec_from_file_location("env_gate_demo_test", ROOT / "tools/env-gate.py")
        assert spec and spec.loader
        gate = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gate)
        found = gate.scan()
        self.assertEqual(TEMPLATE.read_text(), gate.render_demo(gate.demo_names(found)))
        found["NEW_DEMO_SETTING"] = {"files": {"mock-api/app/new_feature.py"}, "default": None}
        self.assertNotEqual(TEMPLATE.read_text(), gate.render_demo(gate.demo_names(found)))

    def test_unquoted_literal_quotes_follow_systemd_semantics(self) -> None:
        self.source.write_text("ANTHROPIC_API_KEY=token'with-apostrophe\n"
                               'BACKEND_SECRET=literal"double-quote\n')
        result = self.run_helper()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("ANTHROPIC_API_KEY=token'with-apostrophe", self.target.read_text())
        self.assertEqual(self.run_helper(check=True).returncode, 0)

    def test_dangling_target_symlink_refuses(self) -> None:
        self.target.symlink_to(self.root / "absent")
        self.assertNotEqual(self.run_helper().returncode, 0)
        self.assertTrue(self.target.is_symlink())


if __name__ == "__main__":
    unittest.main()
