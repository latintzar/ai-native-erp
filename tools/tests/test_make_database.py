"""Exercise Make and CI database setup without opening a database connection."""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

FAKE_PYTHON = """\
import argparse
import json
import os
import shlex
import sys
from pathlib import Path

with open(os.environ['ROCOTO_MAKE_TEST_LOG'], 'a') as log:
    log.write(json.dumps({
        'cwd': Path.cwd().name,
        'argv': sys.argv[1:],
        'wall_dsn': os.environ.get('ROCOTO_MAKE_WALL_DSN'),
    }) + '\\n')

if sys.argv[1:2] == ['tests/rls_wall.py']:
    if os.environ.get('ROCOTO_MAKE_WALL_FAIL'):
        raise SystemExit(23)
    parser = argparse.ArgumentParser()
    parser.add_argument('--dsn', default='helper-default')
    args = parser.parse_args(sys.argv[2:])
    print('export ROCOTO_MAKE_WALL_DSN=' + shlex.quote(args.dsn))
"""


class MakeDatabaseConfiguration(unittest.TestCase):
    def test_make_uses_the_disposable_database_runner(self) -> None:
        for target in ("test", "vitals"):
            with self.subTest(target=target):
                result = subprocess.run(
                    ["make", "--dry-run", target, "PYTHON=python3"], cwd=ROOT,
                    env={"PATH": os.environ["PATH"],
                         "DATABASE_URL": "postgresql://existing-app.invalid/customer-data"},
                    capture_output=True, text=True, timeout=15,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                first_command = result.stdout.splitlines()[0]
                self.assertTrue(first_command.startswith("python3 tools/test-database.py -q "))
                self.assertNotIn("existing-app.invalid", result.stdout)
                self.assertNotIn("eval", first_command)


class CIDatabaseConfiguration(unittest.TestCase):
    def test_check_jobs_use_the_dedicated_runner_and_reserved_database_port(self) -> None:
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()

        def job(name: str) -> str:
            match = re.search(
                rf"^  {name}:\n(.*?)(?=^  [a-z][a-z0-9_-]*:\n|\Z)",
                workflow,
                re.MULTILINE | re.DOTALL,
            )
            self.assertIsNotNone(match, f"missing CI job: {name}")
            assert match is not None
            return match.group(1)

        runner = "runs-on: [self-hosted, linux, x64, rocoto-checks]"
        for name in ("gates", "vitals", "deps"):
            with self.subTest(job=name):
                body = job(name)
                self.assertIn(runner, body)
                self.assertEqual(body.count("- name: isolated Python environment"), 1)
                self.assertIn('echo "$PWD/.venv/bin" >> "$GITHUB_PATH"', body)
                self.assertIn('echo "VIRTUAL_ENV=$PWD/.venv" >> "$GITHUB_ENV"', body)

        reserved_dsn = "postgresql://rocoto:rocoto@127.0.0.1:55439/rocoto"
        for name in ("gates", "vitals"):
            with self.subTest(database_job=name):
                body = job(name)
                self.assertIn('ports: ["127.0.0.1:55439:5432"]', body)
                self.assertNotIn('ports: ["5432:5432"]', body)
                self.assertNotIn("job.services.postgres.ports", body)
                self.assertEqual(body.count(reserved_dsn), 2)

        deploy = job("deploy")
        self.assertIn(runner, deploy)
        self.assertNotIn("runs-on: ubuntu-latest", deploy)
        self.assertNotIn("isolated Python environment", deploy)

    def check_steps(self, *, wall_fails: bool) -> None:
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        step_names = (
            "backend tests behind the RLS wall, then mock-api tests", "the vitals behind the RLS wall",
        )
        for name in step_names:
            with self.subTest(step=name), tempfile.TemporaryDirectory() as tmp:
                # Extract the existing YAML literal block; its shell content is executed unchanged.
                block = re.search(
                    r"^      - name: " + re.escape(name)
                    + r"\n(?:        env:\n(?:          .*\n)+)?"
                    + r"        run: \|\n((?:          .*\n)+)",
                    workflow, re.MULTILINE,
                )
                self.assertIsNotNone(block, f"missing CI test step: {name}")
                assert block is not None
                script = "\n".join(line[10:] for line in block.group(1).splitlines())
                root = Path(tmp)
                for directory in ("backend", "mock-api", "bin"):
                    (root / directory).mkdir()
                fake_python = root / "fake-python.py"
                fake_python.write_text(FAKE_PYTHON)
                launcher = root / "bin/python3"
                launcher.write_text(
                    "#!/bin/sh\nexec " + shlex.join([sys.executable, str(fake_python)]) + ' "$@"\n'
                )
                launcher.chmod(0o755)
                log_path = root / "calls.jsonl"
                dsn = "postgresql://ci:fixture@127.0.0.1:5432/postgres"
                env = {"PATH": str(root / "bin") + os.pathsep + os.environ["PATH"],
                       "DATABASE_URL": dsn, "ROCOTO_MAKE_TEST_LOG": str(log_path)}
                if wall_fails:
                    env["ROCOTO_MAKE_WALL_FAIL"] = "1"
                result = subprocess.run(
                    ["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
                    cwd=root, env=env, capture_output=True, text=True, timeout=15,
                )
                calls = [json.loads(line) for line in log_path.read_text().splitlines()]
                self.assertEqual(calls[0]["argv"], ["tests/rls_wall.py", "--dsn", dsn])
                if wall_fails:
                    self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertEqual(len(calls), 1, "CI continued after failed isolation setup")
                else:
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertEqual(len(calls), 3 if name == step_names[0] else 2)
                    for call in calls[1:]:
                        self.assertEqual(call["argv"][:2], ["-m", "pytest"])
                        self.assertEqual(call["wall_dsn"], dsn)

    def test_successful_wall_exports_reach_ci_tests(self) -> None:
        self.check_steps(wall_fails=False)

    def test_failed_wall_stops_ci_tests(self) -> None:
        self.check_steps(wall_fails=True)


if __name__ == "__main__":
    unittest.main()
