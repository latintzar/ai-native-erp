"""Run the real CI verification step against a local transport fixture."""

from __future__ import annotations

import ast
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RuntimeDeploymentVerification(unittest.TestCase):
    def check_step(self, case: str) -> None:
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        block = re.search(
            r"^      - name: demo runtime matches published source\n"
            r"(?:        if: .*\n)?"
            r"        run: \|\n((?:          .*\n)+)",
            workflow,
            re.MULTILINE,
        )
        self.assertIsNotNone(block, "CI has no running-runtime/source comparison")
        assert block
        script = "\n".join(line[10:] for line in block[1].splitlines())
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "_ship-development/mock-api/app"
            source.mkdir(parents=True)
            main = source / "main.py"
            main.write_text((ROOT / "mock-api/app/main.py").read_text())
            (source / "fixture.py").write_text("VALUE = 1\n")
            # The oracle is the actual running service's function, isolated from app startup.
            tree = ast.parse(main.read_text())
            function = next(
                node
                for node in tree.body
                if isinstance(node, ast.FunctionDef) and node.name == "_code_digest"
            )
            namespace: dict = {"__file__": str(main)}
            exec(compile(ast.Module(body=[function], type_ignores=[]), str(main), "exec"), namespace)
            health = {"ok": True, "code": namespace["_code_digest"]()}
            if case == "stale":
                (source / "fixture.py").write_text("VALUE = 2\n")
            elif case == "missing-code":
                health.pop("code")
            elif case == "unhealthy":
                health["ok"] = False
            elif case == "empty-payload":
                for file in source.iterdir():
                    file.unlink()
            (root / "response.json").write_text(json.dumps(health))
            binary = root / "bin"
            binary.mkdir()
            curl = binary / "curl"
            curl.write_text(
                f"#!{sys.executable}\n"
                "import pathlib, sys\n"
                "assert sys.argv[-1] == 'https://demo.soyrocoto.com/api/health'\n"
                "pathlib.Path(sys.argv[sys.argv.index('-o') + 1]).write_bytes("
                "pathlib.Path('response.json').read_bytes())\n"
            )
            curl.chmod(0o755)
            result = subprocess.run(
                ["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
                cwd=root,
                env={"PATH": str(binary) + os.pathsep + os.environ["PATH"]},
                capture_output=True,
                text=True,
                timeout=10,
            )
            if case == "matching":
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            else:
                self.assertNotEqual(result.returncode, 0, case + ": CI accepted invalid evidence")

    def test_matching_runtime_passes(self) -> None:
        self.check_step("matching")

    def test_stale_runtime_fails(self) -> None:
        self.check_step("stale")

    def test_incomplete_health_or_payload_fails(self) -> None:
        for case in ("missing-code", "unhealthy", "empty-payload"):
            with self.subTest(case=case):
                self.check_step(case)


if __name__ == "__main__":
    unittest.main()
