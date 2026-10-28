"""Commissioning compensation restores disk state even when stopping failed services also fails."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "deploy/product" / (name + ".py"))
    assert spec and spec.loader
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


receiver = load("receive")
with patch.dict(sys.modules, {"receive": receiver}):
    installer = load("install")


class BrokenActivation:
    def __init__(self, config, **kwargs):
        self.env = {}

    def assert_units(self):
        pass

    def restart(self):
        pass

    def healthy(self, commit):
        return False

    def stop(self):
        raise RuntimeError("stop failed during compensation")


class CommissioningRecovery(unittest.TestCase):
    def test_failed_health_and_failed_stop_still_restore_files_and_sudoers(self):
        for prior_sudoers in (None, b"previous scoped sudo policy\n"):
            with self.subTest(prior_sudoers=prior_sudoers), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                configs, systemd = root / "configs", root / "systemd"
                configs.mkdir()
                systemd.mkdir()
                commit = "a" * 40
                generation = root / "releases" / commit
                (generation / "backend").mkdir(parents=True)
                (generation / ".ready.json").write_text(
                    json.dumps({"commit": commit, "environment": "production", "files": {}})
                )
                (configs / "production.json").write_text(
                    json.dumps({"root": str(root), "environment": "production", "services": ["rocoto"]})
                )
                for name in ("backend", "venv"):
                    (root / name).mkdir()
                    (root / name / "preserved").write_text("old " + name)
                previous_unit = b"[Service]\nExecStart=/preserved/old-service\n"
                (systemd / "rocoto.service").write_bytes(previous_unit)
                sudoers = root / "sudoers"
                if prior_sudoers:
                    sudoers.write_bytes(prior_sudoers)
                commands = []
                with (
                    patch.object(installer, "ROOT_UID", __import__("os").geteuid()),
                    patch.object(installer, "CONFIGS", configs),
                    patch.object(installer, "SYSTEMD", systemd),
                    patch.object(installer, "SUDOERS", sudoers),
                    patch.object(installer, "Runtime", BrokenActivation),
                    patch.object(
                        installer,
                        "command",
                        side_effect=lambda *args, commands=commands: commands.append(args),
                    ),
                    patch.object(installer.subprocess, "run", return_value=SimpleNamespace(returncode=0)),
                    patch.object(installer.os, "chown"),
                    self.assertRaisesRegex(RuntimeError, "recovery needs attention") as caught,
                ):
                    installer.activate("production", commit)
                self.assertIn("prepared baseline health failed", str(caught.exception.__cause__))
                for name in ("backend", "venv"):
                    self.assertFalse((root / name).is_symlink())
                    self.assertEqual((root / name / "preserved").read_text(), "old " + name)
                self.assertFalse((root / "current").exists())
                self.assertFalse((root / "current").is_symlink())
                self.assertEqual((systemd / "rocoto.service").read_bytes(), previous_unit)
                if prior_sudoers is None:
                    self.assertFalse(sudoers.exists())
                else:
                    self.assertEqual(sudoers.read_bytes(), prior_sudoers)
                self.assertIn(("systemctl", "daemon-reload"), commands)
                self.assertIn(("systemctl", "restart", "rocoto"), commands)
                receipts = list((root / "commissioning").glob("*/recovery.json"))
                self.assertEqual(len(receipts), 1)
                self.assertEqual(
                    json.loads(receipts[0].read_text())["recovery_failures"], ["stop new services"]
                )


if __name__ == "__main__":
    unittest.main()
