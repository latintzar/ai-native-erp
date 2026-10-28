from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("provider_setup", ROOT / "tools/provider-env.py")
SETUP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SETUP)


class ProviderSetupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="erp-provider-test-")
        self.addCleanup(self.temporary.cleanup)
        self.file = Path(self.temporary.name) / "providers.env"
        self.synthetic = "test-private-" + "x" * 32

    def test_literal_private_roundtrip_and_mode(self):
        value = self.synthetic + '$(touch never-run)"\\'
        SETUP.write_private(self.file, {"GEMINI_API_KEY": value})
        self.assertEqual(SETUP.read_private(self.file), {"GEMINI_API_KEY": value})
        self.assertEqual(self.file.stat().st_mode & 0o777, 0o600)
        self.file.chmod(0o644)
        with self.assertRaises(ValueError):
            SETUP.read_private(self.file)

    def test_links_and_source_runtime_are_rejected(self):
        SETUP.write_private(self.file, {"GEMINI_API_KEY": self.synthetic})
        link = self.file.parent / "link.env"; link.symlink_to(self.file)
        with self.assertRaises(ValueError):
            SETUP.read_private(link)
        hard = self.file.parent / "hard.env"; os.link(self.file, hard)
        with self.assertRaises(ValueError):
            SETUP.read_private(self.file)
        with self.assertRaises(ValueError):
            SETUP.checked_path(ROOT / "private-test.env")

    def test_unknown_duplicate_and_oversized_values_rejected(self):
        for content in ("UNREGISTERED_KEY=value\n", "GEMINI_API_KEY=a\nGEMINI_API_KEY=b\n", "GEMINI_API_KEY=" + "x" * 4097):
            self.file.write_text(content); self.file.chmod(0o600)
            with self.assertRaises(ValueError):
                SETUP.read_private(self.file)

    def test_doctor_and_failures_mask_values(self):
        SETUP.write_private(self.file, {"GEMINI_API_KEY": self.synthetic})
        result = subprocess.run([sys.executable, str(ROOT / "tools/provider-env.py"), "doctor", "--file", str(self.file)], capture_output=True, text=True, check=True)
        self.assertNotIn(self.synthetic, result.stdout + result.stderr)
        self.assertTrue(json.loads(result.stdout)["configured"]["copilot-gemini"])
        self.file.write_text("BAD_" + self.synthetic + "=value\n")
        result = subprocess.run([sys.executable, str(ROOT / "tools/provider-env.py"), "doctor", "--file", str(self.file)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertNotIn(self.synthetic, result.stdout + result.stderr)

    def test_child_uses_selected_file_and_clears_inherited_provider_access(self):
        SETUP.write_private(self.file, {"GEMINI_API_KEY": self.synthetic})
        code = "import os; assert os.environ.get('GEMINI_API_KEY'); assert 'OPENAI_API_KEY' not in os.environ; assert os.environ['ROCOTO_RUNTIME_PUBLIC_BASE']=='http://127.0.0.1:8790'; print('selected-private-file')"
        environment = dict(os.environ); environment["OPENAI_API_KEY"] = "inherited-other-account"
        result = subprocess.run([sys.executable, str(ROOT / "tools/provider-env.py"), "run", "--file", str(self.file), "--runtime-base", "http://127.0.0.1:8790", "--", sys.executable, "-c", code], env=environment, capture_output=True, text=True, check=True)
        self.assertEqual(result.stdout.strip(), "selected-private-file")
        self.assertNotIn(self.synthetic, result.stdout + result.stderr)

    def test_configure_requires_a_hidden_terminal(self):
        result = subprocess.run([sys.executable, str(ROOT / "tools/provider-env.py"), "configure", "--file", str(self.file), "--provider", "copilot-gemini"], input=self.synthetic, capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertFalse(self.file.exists())
        self.assertNotIn(self.synthetic, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
