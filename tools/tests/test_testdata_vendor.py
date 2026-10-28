"""Verify the pinned company dependency and exercise its portable contract."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / "tools" / "vendor" / "testdata"


class TestCompanyTestdata(unittest.TestCase):
    def test_vendored_files_match_the_recorded_company_source(self) -> None:
        provenance = json.loads((VENDOR / "SOURCE.json").read_text())
        self.assertEqual(provenance["repository"], "https://github.com/Rocoto-Labs/company")
        self.assertRegex(provenance["commit"], r"^[a-f0-9]{40}$")
        self.assertEqual(provenance["path"], "tools/testdata")
        actual = {
            str(path.relative_to(VENDOR)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in VENDOR.rglob("*")
            if path.is_file() and path.name != "SOURCE.json" and "__pycache__" not in path.parts
        }
        self.assertEqual(actual, provenance["sha256"])

    def test_portable_company_contract(self) -> None:
        result = subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", str(VENDOR / "tests"), "-v"],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=ROOT,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
