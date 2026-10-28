"""Test cluster ownership, credential selection, and cleanup without external calls."""
from __future__ import annotations

import contextlib
import importlib.util
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

RUNNER_PATH = Path(__file__).resolve().parents[1] / "test-database.py"
SPEC = importlib.util.spec_from_file_location("test_database_runner", RUNNER_PATH)
assert SPEC and SPEC.loader
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)

WALL = "DATABASE_URL=postgresql://isolated/rehearsal\nROCOTO_EGRESS_SANDBOX=1\n"


class TestDatabaseOwnership(unittest.TestCase):
    def test_application_connection_is_replaced_and_only_owned_project_is_removed(self) -> None:
        with patch.object(RUNNER.subprocess, "run") as run, \
                patch.object(RUNNER.subprocess, "check_output",
                             side_effect=["127.0.0.1:5555\n", WALL]) as output, \
                patch.object(RUNNER, "run_suite", return_value=7) as suite, \
                patch.dict(RUNNER.os.environ, {
                    "DATABASE_URL": "postgresql://existing-app.invalid/customer-data",
                    "ROCOTO_WALL_SUPERUSER_DSN": "postgresql://another-app.invalid/postgres",
                    "REHEARSAL_DB": "existing-data", "ROCOTO_WALL_RT_PASSWORD": "existing-role",
                }, clear=True):
            self.assertEqual(RUNNER.run_tests(["-q", "tests/test_example.py"]), 7)
        wall_call = output.call_args_list[1]
        self.assertIn("postgresql://rocoto:rocoto@127.0.0.1:5555/postgres", wall_call.args[0])
        self.assertNotIn("ROCOTO_WALL_SUPERUSER_DSN", wall_call.kwargs["env"])
        self.assertNotIn("REHEARSAL_DB", wall_call.kwargs["env"])
        self.assertEqual(suite.call_args.args[1]["DATABASE_URL"], "postgresql://isolated/rehearsal")
        self.assertEqual(suite.call_args.args[1]["ROCOTO_EGRESS_SANDBOX"], "1")
        started = run.call_args_list[0].args[0]
        removed = run.call_args_list[-1].args[0]
        self.assertEqual(started[:8], removed[:8])
        self.assertEqual(removed[6:8], ["--profile", "test"])
        self.assertTrue(started[3].startswith("rocoto-test-"))
        self.assertEqual(removed[-2:], ["down", "--volumes"])

    def test_setup_failure_cleans_up_without_running_pytest(self) -> None:
        for phase in ("startup", "wall"):
            with self.subTest(phase=phase), \
                    patch.object(RUNNER.subprocess, "run") as run, \
                    patch.object(RUNNER.subprocess, "check_output") as output, \
                    patch.object(RUNNER, "run_suite") as suite:
                error = subprocess.CalledProcessError(1, ["test-setup"])
                if phase == "startup":
                    run.side_effect = [error, subprocess.CompletedProcess([], 0)]
                else:
                    output.side_effect = ["127.0.0.1:5555", error]
                with self.assertRaises(subprocess.CalledProcessError):
                    RUNNER.run_tests(["-q"])
                suite.assert_not_called()
                self.assertEqual(run.call_args_list[-1].args[0][-2:], ["down", "--volumes"])

    def test_nonlocal_port_is_rejected_before_database_setup(self) -> None:
        with patch.object(RUNNER.subprocess, "run") as run, \
                patch.object(RUNNER.subprocess, "check_output", return_value="0.0.0.0:5555") as output:
            with self.assertRaises(RuntimeError):
                RUNNER.run_tests(["-q"])
            self.assertEqual(output.call_count, 1)
            self.assertEqual(run.call_args_list[-1].args[0][-2:], ["down", "--volumes"])

    def test_each_invocation_owns_a_distinct_project(self) -> None:
        with patch.object(RUNNER.subprocess, "run") as run, \
                patch.object(RUNNER.subprocess, "check_output",
                             side_effect=["127.0.0.1:5555", WALL] * 2), \
                patch.object(RUNNER, "run_suite", return_value=0):
            RUNNER.run_tests(["-q"])
            RUNNER.run_tests(["-q"])
            self.assertNotEqual(run.call_args_list[0].args[0][3], run.call_args_list[2].args[0][3])

    def test_sigterm_removes_the_suite_process_group_before_database_cleanup(self) -> None:
        # A fake pytest spawns a vital that ignores SIGTERM. Compose and the wall stay mocked,
        # while the runner's real process ownership and signal handling execute in a child.
        wrapper = """
import importlib.util, json, os, pathlib, subprocess, sys
spec = importlib.util.spec_from_file_location('runner', sys.argv[1])
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
root = pathlib.Path(sys.argv[2])
def compose(args, **kwargs):
    if 'down' in args:
        (root / 'cleanup').write_text(json.dumps(args))
    return subprocess.CompletedProcess(args, 0)
subprocess.run = compose
subprocess.check_output = lambda args, **kwargs: (
    '127.0.0.1:5555\\n' if 'port' in args else
    'DATABASE_URL=postgresql://isolated/rehearsal\\nROCOTO_EGRESS_SANDBOX=1\\n')
sys.argv = ['runner.py']
raise SystemExit(runner.main())
"""
        vital = """
import json, os, pathlib, signal, time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
pathlib.Path(os.environ['ROCOTO_SIGNAL_TEST_STATE']).write_text(
    json.dumps({'child': os.getpid(), 'group': os.getpgrp()}))
time.sleep(60)
"""
        with tempfile.TemporaryDirectory(prefix="rocoto-signal-test-") as temporary:
            root = Path(temporary)
            fake_pytest = root / "pytest"
            fake_pytest.mkdir()
            (fake_pytest / "__init__.py").write_text("")
            (fake_pytest / "__main__.py").write_text(
                "import subprocess, sys, time\n"
                f"subprocess.Popen([sys.executable, '-c', {vital!r}])\n"
                "time.sleep(60)\n"
            )
            env = {**os.environ, "PYTHONPATH": str(root),
                   "ROCOTO_SIGNAL_TEST_STATE": str(root / "state")}
            process = subprocess.Popen(
                [sys.executable, "-c", wrapper, str(RUNNER_PATH), str(root)], env=env,
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
            )
            state = {}
            try:
                deadline = time.monotonic() + 5
                while not (root / "state").exists() and time.monotonic() < deadline:
                    time.sleep(0.02)
                self.assertTrue((root / "state").exists(), "signal fixture failed to start")
                state = json.loads((root / "state").read_text())
                process.send_signal(signal.SIGTERM)
                _, errors = process.communicate(timeout=10)
                self.assertEqual(process.returncode, 143, errors)
                self.assertTrue((root / "cleanup").exists())
                self.assertEqual(json.loads((root / "cleanup").read_text())[6:8], ["--profile", "test"])
                deadline = time.monotonic() + 3
                while self.process_running(state["child"]) and time.monotonic() < deadline:
                    time.sleep(0.02)
                self.assertFalse(self.process_running(state["child"]), "orphaned vital after cancellation")
            finally:
                if state:
                    with contextlib.suppress(ProcessLookupError):
                        os.killpg(state["group"], signal.SIGKILL)
                if process.poll() is None:
                    process.kill()
                process.communicate(timeout=5)

    @staticmethod
    def process_running(pid: int) -> bool:
        try:
            # A reparented zombie has exited; its reaping belongs to the host's PID 1.
            return Path(f"/proc/{pid}/stat").read_text().rpartition(")")[2].split()[0] != "Z"
        except FileNotFoundError:
            return False


if __name__ == "__main__":
    unittest.main()
