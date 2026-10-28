"""The ordinary local command owns its runtime; external runtime proofs require an explicit host."""

from __future__ import annotations

import importlib.util
import os
import signal
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, cast
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("rocoto_local_dev", ROOT / "tools/dev.py")
assert SPEC and SPEC.loader
DEV = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DEV)


class LocalDevelopmentEntrypoints(unittest.TestCase):
    def test_make_dev_names_the_local_runtime_and_ui_binding(self) -> None:
        result = subprocess.run(
            ["make", "--dry-run", "dev", "RUNTIME_STATE=/tmp/rocoto-test-state"],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("tools/dev.py", result.stdout)
        self.assertIn('ROCOTO_RUNTIME_STATE="/tmp/rocoto-test-state"', result.stdout)

    def test_runtime_socket_and_ui_port_are_owned_per_invocation(self) -> None:
        first = DEV.reserved_runtime_socket()
        second = DEV.reserved_runtime_socket()
        self.addCleanup(first.close)
        self.addCleanup(second.close)
        self.assertNotEqual(first.getsockname()[1], second.getsockname()[1])
        command = DEV.runtime_command(first, "", "http://127.0.0.1:1")
        self.assertEqual(command[-2:], ["--fd", str(first.fileno())])
        self.assertNotIn("--port", command)

    def test_runtime_environment_does_not_inherit_provider_or_product_settings(self) -> None:
        with tempfile.TemporaryDirectory() as state, patch.dict(
            os.environ,
            {"ANTHROPIC_API_KEY": "other-task", "DATABASE_URL": "customer-data"},
            clear=False,
        ):
            environment = DEV.runtime_environment(Path(state))
            again = DEV.runtime_environment(Path(state))
        self.assertNotIn("ANTHROPIC_API_KEY", environment)
        self.assertNotIn("DATABASE_URL", environment)
        self.assertEqual(environment["ROCOTO_RUNTIME_STATE_DIR"], state)
        self.assertEqual(environment["HOME"], str(Path(state) / "home"))
        self.assertEqual(again["HOME"], environment["HOME"])

    def test_retained_state_survives_restarts_and_releases_its_lock(self) -> None:
        with tempfile.TemporaryDirectory() as parent:
            selected = Path(parent) / "candidate"
            with DEV.runtime_state(str(selected)) as (state, lifecycle):
                self.assertEqual(lifecycle, "retained")
                (state / "marker").write_text("kept")
                DEV.runtime_environment(state)
            with DEV.runtime_state(str(selected)) as (state, lifecycle):
                self.assertEqual(lifecycle, "retained")
                self.assertEqual((state / "marker").read_text(), "kept")
                DEV.runtime_environment(state)
            self.assertTrue(selected.exists())

    def test_temporary_state_cleans_up_after_failure(self) -> None:
        state: Path | None = None
        with self.assertRaisesRegex(RuntimeError, "fixture failure"), DEV.runtime_state("") as (
            selected, lifecycle
        ):
            state = selected
            self.assertEqual(lifecycle, "temporary")
            (selected / "marker").write_text("temporary")
            raise RuntimeError("fixture failure")
        assert state is not None
        self.assertFalse(state.exists())

    def test_retained_state_rejects_unsafe_paths(self) -> None:
        with tempfile.TemporaryDirectory() as parent:
            parent_path = Path(parent)
            unsafe_mode = parent_path / "unsafe-mode"
            unsafe_mode.mkdir(mode=0o755)
            unsafe_mode.chmod(0o755)
            with self.assertRaisesRegex(ValueError, "mode 0700"), DEV.runtime_state(str(unsafe_mode)):
                pass

            ordinary_file = parent_path / "ordinary-file"
            ordinary_file.write_text("content")
            with self.assertRaisesRegex(ValueError, "ordinary directory"), DEV.runtime_state(
                str(ordinary_file)
            ):
                pass

            actual = parent_path / "actual"
            actual.mkdir(mode=0o700)
            linked = parent_path / "linked"
            linked.symlink_to(actual, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "symbolic component"), DEV.runtime_state(
                str(linked / "candidate")
            ):
                pass

            owned = parent_path / "owned"
            owned.mkdir(mode=0o700)
            with (
                patch.object(DEV.os, "getuid", return_value=os.getuid() + 1),
                self.assertRaisesRegex(ValueError, "current user"),
                DEV.runtime_state(str(owned)),
            ):
                pass

        with self.assertRaisesRegex(ValueError, "absolute normalized"), DEV.runtime_state(
            "relative/state"
        ):
            pass
        with self.assertRaisesRegex(ValueError, "outside a Git working tree"), DEV.runtime_state(
            str(ROOT / "runtime-state")
        ):
            pass

    def test_retained_state_rejects_concurrent_use(self) -> None:
        with tempfile.TemporaryDirectory() as parent:
            selected = Path(parent) / "candidate"
            with (
                DEV.runtime_state(str(selected)),
                self.assertRaisesRegex(RuntimeError, "already in use"),
                DEV.runtime_state(str(selected)),
            ):
                pass

    def test_runtime_home_rejects_unsafe_existing_directory(self) -> None:
        with tempfile.TemporaryDirectory() as state:
            home = Path(state) / "home"
            home.mkdir(mode=0o755)
            home.chmod(0o755)
            with self.assertRaisesRegex(ValueError, "mode 0700"):
                DEV.runtime_environment(Path(state))

    def test_children_stop_before_temporary_state_cleanup(self) -> None:
        events: list[str] = []

        class Listener:
            def close(self) -> None:
                events.append("listener")

        with DEV.runtime_state("") as (state, _lifecycle):
            self.assertTrue(state.exists())
            with (
                patch.object(DEV, "stop", side_effect=lambda process: events.append(process)),
                DEV.child_processes(cast(Any, Listener())) as children,
            ):
                children.extend(cast(Any, ["runtime", "app"]))
            self.assertTrue(state.exists())
            events.append("state-exists")
        events.append("state-removed")
        self.assertEqual(events, ["listener", "app", "runtime", "state-exists", "state-removed"])

    def test_sigterm_uses_the_same_child_and_state_cleanup(self) -> None:
        events: list[str] = []
        state: Path | None = None

        class Listener:
            def close(self) -> None:
                events.append("listener")

        with (
            patch.object(DEV, "stop", side_effect=lambda process: events.append(process)),
            self.assertRaises(KeyboardInterrupt),
            DEV.shutdown_signals(),
            DEV.runtime_state("") as (selected, _lifecycle),
        ):
            state = selected
            with DEV.child_processes(cast(Any, Listener())) as children:
                children.extend(cast(Any, ["runtime", "app"]))
                os.kill(os.getpid(), signal.SIGTERM)
        assert state is not None
        self.assertFalse(state.exists())
        self.assertEqual(events, ["listener", "app", "runtime"])

    def test_external_runtime_proxy_requires_the_upstream_to_be_named(self) -> None:
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools/serve-with-runtime.py")],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("--upstream or ROCOTO_RUNTIME_UPSTREAM is required", result.stderr)
        self.assertNotIn("kit.soyrocoto.com", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
