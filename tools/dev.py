#!/usr/bin/env python3
"""Run the app with one checkout-owned prototype runtime on private loopback ports."""

from __future__ import annotations

import contextlib
import fcntl
import os
import signal
import socket
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv/bin/python"


def _path_has_git_boundary(path: Path) -> bool:
    return any(os.path.lexists(candidate / ".git") for candidate in (path, *path.parents))


def _validate_path_components(path: Path) -> None:
    current = Path(path.anchor)
    for part in path.parts[1:]:
        current /= part
        try:
            metadata = current.lstat()
        except FileNotFoundError:
            break
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError(f"runtime state path contains a symbolic component: {current}")
        if current != path and not stat.S_ISDIR(metadata.st_mode):
            raise ValueError(f"runtime state parent is not a directory: {current}")


def _validate_private_directory(path: Path, label: str) -> None:
    metadata = path.lstat()
    if not stat.S_ISDIR(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
        raise ValueError(f"{label} must be an ordinary directory")
    if metadata.st_uid != os.getuid():
        raise ValueError(f"{label} must be owned by the current user")
    if stat.S_IMODE(metadata.st_mode) != 0o700:
        raise ValueError(f"{label} must have mode 0700")


def _create_private_directory(path: Path) -> None:
    missing: list[Path] = []
    candidate = path
    while not candidate.exists():
        missing.append(candidate)
        candidate = candidate.parent
    for directory in reversed(missing):
        directory.mkdir(mode=0o700)


@contextlib.contextmanager
def runtime_state(selected: str) -> Iterator[tuple[Path, str]]:
    temporary: tempfile.TemporaryDirectory[str] | None = None
    if selected:
        state_dir = Path(selected).expanduser()
        if not state_dir.is_absolute() or ".." in state_dir.parts:
            raise ValueError("RUNTIME_STATE must be an absolute normalized path")
        _validate_path_components(state_dir)
        if _path_has_git_boundary(state_dir):
            raise ValueError("RUNTIME_STATE must be outside a Git working tree")
        _create_private_directory(state_dir)
        lifecycle = "retained"
    else:
        temporary = tempfile.TemporaryDirectory(prefix="rocoto-runtime-")
        state_dir = Path(temporary.name)
        lifecycle = "temporary"
    try:
        _validate_path_components(state_dir)
        _validate_private_directory(state_dir, "runtime state")
        descriptor = os.open(state_dir, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise RuntimeError(f"runtime state is already in use: {state_dir}") from error
            yield state_dir, lifecycle
        finally:
            os.close(descriptor)
    finally:
        if temporary is not None:
            temporary.cleanup()


@contextlib.contextmanager
def child_processes(listener: socket.socket) -> Iterator[list[subprocess.Popen[bytes]]]:
    children: list[subprocess.Popen[bytes]] = []
    try:
        yield children
    finally:
        listener.close()
        for process in reversed(children):
            stop(process)


def interrupt_for_shutdown(_signal_number: int, _frame: object) -> None:
    raise KeyboardInterrupt


@contextlib.contextmanager
def shutdown_signals() -> Iterator[None]:
    previous = signal.signal(signal.SIGTERM, interrupt_for_shutdown)
    try:
        yield
    finally:
        signal.signal(signal.SIGTERM, previous)


def reserved_runtime_socket() -> socket.socket:
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(("127.0.0.1", 0))
    listener.listen(128)
    listener.set_inheritable(True)
    return listener


def free_ui_port(selected: str = "") -> int:
    if selected:
        port = int(selected)
        if not 1 <= port <= 65535:
            raise ValueError("UI_PORT must be between 1 and 65535")
        return port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def runtime_environment(state_dir: Path) -> dict[str, str]:
    # Start the runtime with process necessities only. Provider access enters through the explicitly
    # selected file below, so a key exported for another task cannot leak into this preview.
    keep = ("PATH", "LANG", "LC_ALL", "SSL_CERT_FILE", "SSL_CERT_DIR", "NO_PROXY")
    environment = {name: os.environ[name] for name in keep if name in os.environ}
    private_home = state_dir / "home"
    if private_home.exists() or private_home.is_symlink():
        _validate_private_directory(private_home, "runtime home")
    else:
        private_home.mkdir(mode=0o700)
    environment["HOME"] = str(private_home)
    environment["ROCOTO_RUNTIME_STATE_DIR"] = str(state_dir)
    return environment


def runtime_command(listener: socket.socket, runtime_env: str, public_base: str) -> list[str]:
    command = [str(PYTHON), "-m", "uvicorn", "app.main:app", "--fd", str(listener.fileno())]
    if not runtime_env:
        return command
    selected = Path(runtime_env).expanduser()
    if not selected.is_absolute():
        selected = (ROOT / selected).resolve()
    return [str(PYTHON), str(ROOT / "tools/provider-env.py"), "run", "--file", str(selected),
            "--runtime-base", public_base, "--", *command]


def app_command(port: int) -> list[str]:
    return ["npm", "run", "dev", "--", "--port", str(port)]


def stop(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    with contextlib.suppress(ProcessLookupError):
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def wait_for_runtime(process: subprocess.Popen[bytes], health: str) -> None:
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        code = process.poll()
        if code is not None:
            raise RuntimeError(f"local prototype runtime exited during startup ({code})")
        try:
            with urllib.request.urlopen(health, timeout=0.5) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.05)
    raise RuntimeError(f"local prototype runtime did not answer at {health}")


def main() -> int:
    if not PYTHON.is_file() or not (ROOT / "app/node_modules/.bin/vite").is_file():
        raise RuntimeError("Run `make install` in this checkout first.")
    with shutdown_signals():
        try:
            with runtime_state(os.environ.get("ROCOTO_RUNTIME_STATE", "")) as (state_dir, lifecycle):
                print(f"runtime state: {lifecycle} at {state_dir}", flush=True)
                listener = reserved_runtime_socket()
                with child_processes(listener) as children:
                    runtime_port = int(listener.getsockname()[1])
                    runtime_base = f"http://127.0.0.1:{runtime_port}"
                    ui_port = free_ui_port(os.environ.get("ROCOTO_UI_PORT", ""))
                    runtime_env = os.environ.get("ROCOTO_RUNTIME_ENV", "")
                    environment = runtime_environment(state_dir)
                    environment["ROCOTO_RUNTIME_PUBLIC_BASE"] = runtime_base
                    runtime = subprocess.Popen(
                        runtime_command(listener, runtime_env, runtime_base),
                        cwd=ROOT / "mock-api",
                        env=environment,
                        pass_fds=(listener.fileno(),),
                        start_new_session=True,
                    )
                    children.append(runtime)
                    listener.close()
                    wait_for_runtime(runtime, runtime_base + "/api/health")
                    app_environment = dict(os.environ)
                    app_environment["VITE_ROCOTO_RUNTIME_BASE"] = runtime_base
                    if runtime_env:
                        print(
                            "provider config: selected; provider account proof remains separate",
                            flush=True,
                        )
                    print(f"prototype: http://127.0.0.1:{ui_port}/app.html", flush=True)
                    print(f"runtime:   {runtime_base}/api/health", flush=True)
                    app = subprocess.Popen(
                        app_command(ui_port), cwd=ROOT / "app", env=app_environment,
                        start_new_session=True,
                    )
                    children.append(app)
                    return app.wait()
        except KeyboardInterrupt:
            return 130


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError) as error:
        print(f"dev: {error}", file=sys.stderr)
        raise SystemExit(1) from None
