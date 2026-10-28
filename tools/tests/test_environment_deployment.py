"""Exercise the receiver and public checks without touching a deployment host."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class StagingPublicBoundary(unittest.TestCase):
    def check_step(self, responses: dict[str, int]) -> None:
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        block = re.search(
            r"^      - name: staging frontend is undeployed\n"
            r"(?:        if: .*\n)?"
            r"        run: \|\n((?:          .*\n)+)",
            workflow,
            re.MULTILINE,
        )
        self.assertIsNotNone(block, "CI does not verify the staging frontend boundary")
        assert block
        script = "\n".join(line[10:] for line in block[1].splitlines())
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            binary = directory / "bin"
            binary.mkdir()
            curl = binary / "curl"
            curl.write_text(
                f"#!{sys.executable}\n"
                "import json, os, sys\n"
                "from urllib.parse import urlsplit\n"
                "url = urlsplit(sys.argv[-1])\n"
                "assert url.netloc == 'staging.soyrocoto.com'\n"
                "print(json.loads(os.environ['RESPONSES']).get(url.path, 404))\n"
            )
            curl.chmod(0o755)
            result = subprocess.run(
                ["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
                cwd=directory,
                env={
                    "PATH": str(binary) + os.pathsep + os.environ["PATH"],
                    "RESPONSES": json.dumps(responses),
                },
                capture_output=True,
                text=True,
                timeout=10,
            )
            if all(status == 404 for status in responses.values()):
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            else:
                self.assertNotEqual(result.returncode, 0, "CI accepted an unexpected frontend response")

    def test_undeployed_frontend_passes(self) -> None:
        self.check_step({})

    def test_published_frontend_or_failed_server_fails(self) -> None:
        for path, status in (
            ("/", 200),
            ("/app.html", 200),
            ("/assets/staging-boundary-check.js", 200),
            ("/sales", 200),
            ("/", 503),
        ):
            with self.subTest(path=path, status=status):
                self.check_step({path: status})


if __name__ == "__main__":
    unittest.main()
