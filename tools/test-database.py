#!/usr/bin/env python3
"""Run backend tests in a fresh Compose database, then remove that test project.

Usage: python tools/test-database.py [pytest arguments]
Each invocation owns a cluster and port, including simultaneous runs from one checkout.
Application DATABASE_URL and developer databases are independent of this test setup.
"""
from __future__ import annotations

import contextlib
import os
import signal
import subprocess
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_suite(arguments: list[str], env: dict[str, str]) -> int:
    """Own the pytest process group, including vital subprocesses, through teardown."""
    process = subprocess.Popen(
        [sys.executable, "-m", "pytest", *arguments], cwd=ROOT / "backend", env=env,
        start_new_session=True,
    )
    try:
        return process.wait()
    finally:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        finally:
            # A vital can outlive pytest or ignore SIGTERM. Its group is still ours.
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
            process.wait()


def run_tests(arguments: list[str]) -> int:
    project = "rocoto-test-" + uuid.uuid4().hex[:12]
    compose = ["docker", "compose", "--project-name", project, "--file", str(ROOT / "compose.yaml"),
               "--profile", "test"]
    try:
        subprocess.run(
            [*compose, "up", "--detach", "--wait", "--wait-timeout", "60", "test-db"],
            cwd=ROOT, check=True, timeout=180,
        )
        address = subprocess.check_output(
            [*compose, "port", "test-db", "5432"], cwd=ROOT, text=True, timeout=15,
        ).strip()
        host, port = address.rsplit(":", 1)
        if host != "127.0.0.1" or not port.isdecimal() or not 0 < int(port) < 65536:
            raise RuntimeError("test database must publish a single loopback port")
        dsn = f"postgresql://rocoto:rocoto@127.0.0.1:{port}/postgres"
        env = dict(os.environ)
        # The caller's application settings never select this cluster or its test roles.
        for name in ("ROCOTO_WALL_SUPERUSER_DSN", "ROCOTO_WALL_RT_PASSWORD",
                     "ROCOTO_WALL_CTRL_PASSWORD", "REHEARSAL_DB"):
            env.pop(name, None)
        wall = subprocess.check_output(
            [sys.executable, "tests/rls_wall.py", "--dsn", dsn, "--format", "env"],
            cwd=ROOT / "backend", env=env, text=True, timeout=90,
        )
        for line in wall.splitlines():
            if line:
                name, value = line.split("=", 1)
                env[name] = value
        env["ROCOTO_VITAL_TIMEOUT"] = "900"
        return run_suite(arguments, env)
    finally:
        # This random project belongs only to this invocation, including a failed startup.
        subprocess.run(
            [*compose, "down", "--volumes"], cwd=ROOT, check=True, timeout=60,
        )


def main() -> int:
    def terminate(signum: int, _frame: object) -> None:
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, terminate)
    try:
        return run_tests(sys.argv[1:])
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"Test database setup failed ({type(error).__name__}); check Docker Compose above.",
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
