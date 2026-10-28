"""The runtime loader requires an explicit environment file."""

from __future__ import annotations

import importlib.util
import io
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / "mock-api/deploy/with-env.py"


class RuntimeEnvironmentSelection(unittest.TestCase):
    def test_missing_environment_argument_reads_no_file(self) -> None:
        spec = importlib.util.spec_from_file_location("runtime_environment", SCRIPT)
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with patch.object(sys, "argv", [str(SCRIPT)]), \
                patch.object(module, "read", return_value={}) as read, redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as error:
                module.main()
            self.assertEqual(error.exception.code, 2)
            read.assert_not_called()

    def test_selected_environment_reaches_the_child(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            selected = Path(tmp) / "sandbox.env"
            selected.write_text("ANTHROPIC_API_KEY=fixture-only\nUNRELATED_VALUE=ignored\n")
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--env", str(selected), "--", sys.executable, "-c",
                 "import os; assert os.environ['ANTHROPIC_API_KEY'] == 'fixture-only'; "
                 "assert 'UNRELATED_VALUE' not in os.environ"],
                env={"PATH": os.environ["PATH"]}, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
