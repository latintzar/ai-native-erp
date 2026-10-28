"""Source commissioning uses the fixed installed helpers, including their real validation."""

from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def load_source(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "deploy/product" / (name + ".py"))
    assert spec and spec.loader
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


class InstalledHelpers(unittest.TestCase):
    def test_source_installer_uses_installed_demo_validator_and_template(self):
        receiver = load_source("receive")
        with patch.dict(sys.modules, {"receive": receiver}):
            installer = load_source("install")
        self.assertFalse((Path(receiver.__file__).parent / "demo-env.py").exists())
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            installed = root / "usr/local/lib/rocoto-release"
            installed.mkdir(parents=True)
            for name in ("demo-env.py", "demo.env.example"):
                shutil.copyfile(ROOT / "deploy/staging" / name, installed / name)
            private = root / "demo.env"
            private.write_text("# Dedicated consumer with providers unset\n")
            private.chmod(0o600)
            runtime = installer.Runtime.__new__(installer.Runtime)
            runtime.config = {
                "environment": "development",
                "unitContracts": {},
                "environmentFiles": [str(private)],
            }
            with patch.object(receiver, "INSTALLED_TOOLS", installed, create=True):
                runtime.assert_units()
                private.write_text("DATABASE_URL=private-fixture-value\n")
                with self.assertRaises(subprocess.CalledProcessError):
                    runtime.assert_units()

    def test_schema_check_uses_absolute_runuser_with_restricted_runtime_path(self):
        import test_product_commissioning_crash as crash

        actual_run = subprocess.run
        with crash.installation() as (_root, commit, _commands):
            crash.installer.activate("production", commit)
            calls = crash.installer.subprocess.run.call_args_list
            schema = next(call.args[0] for call in calls if call.args[0][0].endswith("runuser"))
        result = actual_run(
            [schema[0], "--version"],
            env={"PATH": "/usr/local/bin:/usr/bin:/bin"},
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertIn("runuser", result.stdout)
        self.assertTrue(Path(schema[0]).is_absolute())


if __name__ == "__main__":
    unittest.main()
