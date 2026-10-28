#!/usr/bin/env python3
"""Portable synthetic-data lifecycle. Product manifests supply datasets and adapters."""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
import signal
import stat
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

VERSION = "1.0.0"
OPERATIONS = ("plan", "create", "populate", "exercise", "status", "reset", "delete")
SECRET_KEY = re.compile(r"(^|_)(password|passwd|secret|token|credential|cookie|authorization|dsn)(_|$)", re.I)
SAFE_ENV = ("PATH", "LANG", "LC_ALL", "TZ", "SYSTEMROOT")
MAX_JSON = 8 * 1024 * 1024
MAX_SOURCE = 64 * 1024 * 1024


class Refused(ValueError):
    """A target or owned resource could not be established."""


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def read_json(path: Path) -> dict:
    if path.stat().st_size > MAX_JSON:
        raise Refused("JSON input exceeds the size limit")
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise Refused("JSON input must be an object")
    return value


def secure(path: Path, *, directory: bool, create: bool = False) -> Path:
    if not path.is_absolute():
        raise Refused("Private state/configuration paths must be absolute")
    for item in (path, *path.parents):
        if item.is_symlink():
            raise Refused("Private state/configuration paths must have ordinary owned parents")
        if (item / ".git").exists():
            raise Refused("Private state/configuration belongs outside Git working trees")
    if create:
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.lstat()
    valid_kind = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    if not valid_kind or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
        raise Refused("Private state/configuration must be owned by this user with mode 0700/0600")
    if not directory and info.st_nlink != 1:
        raise Refused("Private files must have one owner path")
    return path


def atomic(path: Path, value: dict) -> None:
    if path.exists() or path.is_symlink():
        secure(path, directory=False)
    fd, name = tempfile.mkstemp(prefix=".write-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
        directory_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(name)


def owned_source(owner: Path, relative: str) -> Path:
    if not isinstance(relative, str) or Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise Refused("Manifest inputs must be relative to their owning source")
    path = owner / relative
    for item in (path, *path.parents):
        if item == owner.parent:
            break
        if item.is_symlink():
            raise Refused("Manifest inputs must use ordinary source files")
    if not path.is_file() or not path.resolve().is_relative_to(owner):
        raise Refused("Manifest input is missing from its owning source")
    return path


def source(manifest_path: Path, scenario_name: str, environment: str) -> tuple[dict, dict, list[str]]:
    if manifest_path.is_symlink():
        raise Refused("Manifest must be an ordinary source file")
    manifest_path = manifest_path.resolve(strict=True)
    owner = manifest_path.parent
    manifest = read_json(manifest_path)
    if manifest.get("version") != 1:
        raise Refused("Manifest version must be 1")
    product = manifest.get("product")
    if not isinstance(product, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", product):
        raise Refused("Manifest needs a stable product slug")
    if environment not in ("development", "staging", "production"):
        raise Refused("Select development, staging or production explicitly")
    # A production account path needs its commissioned authorization and adapter proof.
    # No production adapter is shipped in v1; a manifest flag cannot grant that authority.
    if environment == "production":
        raise Refused("Production account provisioning is unsupported by this tool version")
    environments = manifest.get("environments", [])
    if not isinstance(environments, list) or environment not in environments:
        raise Refused("The product adapter does not support this environment")
    if manifest.get("effects", "capture") != "capture":
        raise Refused("This tool version supports captured external effects only")
    scenarios = manifest.get("scenarios", {})
    if not isinstance(scenarios, dict) or scenario_name not in scenarios:
        raise Refused("Select a scenario declared by the product manifest")
    scenario_path = owned_source(owner, scenarios[scenario_name])
    scenario = read_json(scenario_path)
    if scenario.get("synthetic") is not True:
        raise Refused("Scenario must explicitly declare synthetic data")
    command = manifest.get("adapter")
    if not isinstance(command, list) or len(command) != 2 or not all(isinstance(x, str) for x in command):
        raise Refused("Adapter command must contain its interpreter and relative source script")
    if command[0] not in ("python3", "python", "node"):
        raise Refused("Supported adapter interpreters are python3 and node")
    script = owned_source(owner, command[1])
    inputs = manifest.get("inputs", [])
    if not isinstance(inputs, list) or not all(isinstance(x, str) for x in inputs):
        raise Refused("Manifest inputs must be a list of source paths or glob patterns")
    files = {manifest_path, script, scenario_path}
    for pattern in inputs:
        if Path(pattern).is_absolute() or ".." in Path(pattern).parts:
            raise Refused("Manifest input pattern escapes its source owner")
        matched = list(owner.glob(pattern))
        if not matched:
            raise Refused("Manifest input pattern matches no source files")
        for path in matched:
            if path.is_file():
                files.add(owned_source(owner, str(path.relative_to(owner))))
    if len(files) > 5000 or sum(path.stat().st_size for path in files) > MAX_SOURCE:
        raise Refused("Declared adapter source exceeds the recovery bundle limit")
    hashes = {str(path.relative_to(owner)): digest(path.read_bytes()) for path in sorted(files)}
    revision = None
    with contextlib.suppress(OSError, subprocess.SubprocessError):
        revision = subprocess.check_output(
            ["git", "-C", str(owner), "rev-parse", "HEAD"],
            stderr=subprocess.DEVNULL,
            env={key: os.environ[key] for key in SAFE_ENV if key in os.environ},
            timeout=5,
            text=True,
        ).strip()
    context = {
        "manifest": str(manifest_path),
        "product": product,
        "scenario_name": scenario_name,
        "environment": environment,
        "effects": "capture",
        "source_hashes": hashes,
        "manifest_relative": manifest_path.name,
        "source_revision": revision,
        "scenario_sha256": digest(scenario_path.read_bytes()),
    }
    interpreter = sys.executable if command[0] in ("python", "python3") else "node"
    return context, scenario, [interpreter, str(script)]


def freeze_source(folder: Path, context: dict) -> None:
    """Retain exact reviewed source before any adapter can provision resources."""
    owner = Path(context["manifest"]).parent
    bundle = secure(folder / "source", directory=True, create=True)
    for relative, expected in context["source_hashes"].items():
        raw = owned_source(owner, relative).read_bytes()
        if digest(raw) != expected:
            raise Refused("Source changed while recording the recovery bundle")
        target = bundle / relative
        for parent in reversed(target.parent.relative_to(bundle).parents):
            secure(bundle / parent, directory=True, create=True)
        secure(target.parent, directory=True, create=True)
        if target.exists() or target.is_symlink():
            secure(target, directory=False)
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
    # Directory entries must be durable before the pending resource journal.
    for directory in [bundle, *[p for p in bundle.rglob("*") if p.is_dir()]]:
        fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def frozen_source(folder: Path, record: dict) -> tuple[dict, list[str], str]:
    bundle = secure(folder / "source", directory=True)
    actual_files = set()
    for entry in bundle.rglob("*"):
        secure(entry, directory=entry.is_dir())
        if entry.is_file():
            actual_files.add(str(entry.relative_to(bundle)))
    if actual_files != set(record["source_hashes"]):
        raise Refused("Recorded adapter source contains unexpected or missing files")
    for relative, expected in record["source_hashes"].items():
        path = owned_source(bundle, relative)
        secure(path, directory=False)
        if digest(path.read_bytes()) != expected:
            raise Refused("Recorded adapter source differs from its recovery hash")
    manifest_path = owned_source(bundle, record["manifest_relative"])
    context, scenario, command = source(manifest_path, record["scenario_name"], record["environment"])
    for key in ("source_hashes", "scenario_sha256", "product", "environment", "effects"):
        if context[key] != record[key]:
            raise Refused("Recorded adapter source differs from its target binding")
    secure(folder / "scenario.json", directory=False)
    if read_json(folder / "scenario.json") != scenario:
        raise Refused("Frozen scenario differs from its recorded source")
    return scenario, command, str(manifest_path)


def clean(value: object, secrets: tuple[str, ...] = ()) -> object:
    """Receipts retain public results. Adapter output is a reviewed interface, never a secret store."""
    if isinstance(value, dict):
        return {
            key: clean(item, secrets)
            for key, item in value.items()
            if isinstance(key, str) and not SECRET_KEY.search(key)
        }
    if isinstance(value, list):
        return [clean(item, secrets) for item in value]
    if isinstance(value, str):
        for secret in secrets:
            if secret:
                value = value.replace(secret, "[private]")
        if re.search(r"://[^/\s]+:[^/\s]+@", value):
            return "[private connection]"
    return value


def secret_values(value: object) -> tuple[str, ...]:
    if isinstance(value, dict):
        return tuple(s for v in value.values() for s in secret_values(v))
    if isinstance(value, list):
        return tuple(s for v in value for s in secret_values(v))
    return (value,) if isinstance(value, str) and len(value) >= 4 else ()


def invoke(command: list[str], request: dict, timeout: int) -> dict:
    env = {key: os.environ[key] for key in SAFE_ENV if key in os.environ}
    env.update({"HOME": request["state_dir"], "PYTHONDONTWRITEBYTECODE": "1", "TESTDATA_EFFECTS": "capture"})
    # HOME is the adapter's private run directory; ambient provider keys and agent stores
    # are not passed through. This is environment hygiene, not an untrusted-code sandbox.
    with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(
            command,
            cwd=Path(request["manifest"]).parent,
            env=env,
            stdin=subprocess.PIPE,
            stdout=output,
            stderr=errors,
            start_new_session=True,
        )
        try:
            process.communicate(json.dumps(request).encode(), timeout=timeout)
        except BaseException:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            raise
        finally:
            # An adapter's background children must not survive its invocation.
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
        output.seek(0)
        raw = output.read(MAX_JSON + 1)
        if len(raw) > MAX_JSON:
            raise Refused("Adapter response exceeds the size limit")
        try:
            response = json.loads(raw)
        except (ValueError, UnicodeError) as error:
            raise Refused(
                "Adapter did not return a valid JSON response; run retained for recovery"
            ) from error
        if not isinstance(response, dict) or not isinstance(response.get("ok"), bool):
            raise Refused("Adapter response must declare an operation result")
        if not isinstance(response.get("resources", {}), dict) or not isinstance(
            response.get("result", {}), dict
        ):
            raise Refused("Adapter resources and results must be objects")
        if process.returncode and response["ok"]:
            raise Refused("Adapter exited unsuccessfully; run retained for recovery")
        return response


def operate(args: argparse.Namespace) -> dict:
    if not 1 <= args.timeout <= 900:
        raise Refused("Adapter timeout must be between 1 and 900 seconds")
    if (
        args.operation == "create"
        and not args.run
        and not (args.manifest and args.scenario and args.environment)
    ):
        raise Refused("Create needs a manifest, scenario and explicit environment")
    if args.operation == "plan":
        if not args.manifest or not args.scenario or not args.environment:
            raise Refused("Plan needs a manifest, scenario and explicit environment")
        context, _, _ = source(Path(args.manifest), args.scenario, args.environment)
        return {"ok": True, "operation": "plan", "status": "planned", **context}
    if not args.state_root:
        raise Refused("Select an absolute private --state-root")
    root = secure(Path(args.state_root), directory=True, create=True)
    run_id = args.run or (uuid.uuid4().hex if args.operation == "create" else "")
    if not re.fullmatch(r"[a-f0-9]{32}", run_id):
        raise Refused("Select the 32-character run ID returned by create")
    folder = root / run_id
    if args.operation != "create" and not folder.exists():
        raise Refused("Run record is absent; no resources were changed")
    folder = secure(folder, directory=True, create=args.operation == "create")
    lock_path = folder / ".lock"
    flags = os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(lock_path, flags, 0o600)
    try:
        secure(lock_path, directory=False)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise Refused("This run is busy; another operation holds its lock") from error
        state_path = folder / "run.json"
        if state_path.exists():
            secure(state_path, directory=False)
            record = read_json(state_path)
            if record.get("run_id") != run_id or record.get("state_dir") != str(folder):
                raise Refused("Run ownership record does not match its private directory")
            if args.manifest and Path(args.manifest).resolve() != Path(record["manifest"]):
                raise Refused("Run belongs to a different product manifest")
            if args.scenario and args.scenario != record["scenario_name"]:
                raise Refused("Run belongs to a different scenario")
            if args.environment and args.environment != record["environment"]:
                raise Refused("Run belongs to a different environment")
            if args.operation not in ("status", "delete"):
                context, _, _ = source(
                    Path(record["manifest"]), record["scenario_name"], record["environment"]
                )
                if context["source_hashes"] != record["source_hashes"]:
                    raise Refused(
                        "Source or scenario changed; create a new run or use status/delete to retire this one"
                    )
        else:
            if args.operation != "create" or not args.manifest or not args.scenario or not args.environment:
                raise Refused("Create needs a manifest, scenario and explicit environment")
            context, scenario, command = source(Path(args.manifest), args.scenario, args.environment)
            record = {
                "version": 1,
                "tool_version": VERSION,
                "run_id": run_id,
                "state_dir": str(folder),
                "phase": "planned",
                "resources": {},
                "sequence": 0,
                **context,
            }
            freeze_source(folder, context)
            atomic(folder / "scenario.json", scenario)
            atomic(state_path, record)
        scenario, command, executable_manifest = frozen_source(folder, record)
        if record["phase"] == "deleted":
            if args.operation not in ("status", "delete"):
                raise Refused("Run is deleted; create a new run to reuse this scenario")
            return {
                "ok": True,
                "operation": args.operation,
                "run_id": run_id,
                "status": "deleted",
                "resources": record.get("public_resources", clean(record.get("resources", {}))),
                "result": {"already_deleted": True, "exists": False},
            }
        config_path = (
            Path(args.config)
            if args.config
            else Path(record["config_path"])
            if record.get("config_path")
            else None
        )
        config = read_json(secure(config_path, directory=False)) if config_path else {}
        config_hash = digest(json.dumps(config, sort_keys=True).encode())
        if record.get("config_hash") and record["config_hash"] != config_hash:
            raise Refused("Private target configuration changed; restore it before accessing this run")
        if args.config:
            record["config_path"] = str(config_path)
        record["config_hash"] = config_hash
        if config.get("effects", "capture") != "capture":
            raise Refused("External effects must remain captured")
        prior_phase = record["phase"]
        record["phase"] = "pending"
        record["pending_operation"] = args.operation
        record["sequence"] += 1
        atomic(state_path, record)
        request = {
            "protocol": 1,
            "operation": args.operation,
            "run_id": run_id,
            "environment": record["environment"],
            "effects": "capture",
            "state_dir": str(folder),
            "manifest": executable_manifest,
            "source_manifest": record["manifest"],
            "scenario": scenario,
            "resources": record.get("resources", {}),
            "config": config,
        }
        try:
            response = invoke(command, request, args.timeout)
        except (OSError, ValueError, subprocess.SubprocessError, KeyboardInterrupt, SystemExit) as error:
            response = {
                "ok": False,
                "resources": record.get("resources", {}),
                "result": {"failure": type(error).__name__},
            }
        # A refusal may have no new resource information. Keep the last known
        # ownership receipt so the adapter can recover or delete that same run.
        if response["ok"] or response.get("resources"):
            record["resources"] = response.get("resources", record.get("resources", {}))
        # Resource identities are opaque adapter inputs. Keep their exact values
        # in private state; redact only the public receipt and terminal response.
        private_values = secret_values(config)
        record["public_resources"] = clean(record.get("resources", {}), private_values)
        public_response = clean(response, private_values)
        assert isinstance(public_response, dict)
        response = public_response
        phases = {
            "create": "created",
            "populate": "populated",
            "exercise": "verified",
            "reset": "populated",
            "delete": "deleted",
            "status": prior_phase,
        }
        phase = phases[args.operation] if response["ok"] else "failed"
        if args.operation == "create" and response["ok"] and prior_phase in ("populated", "verified"):
            phase = prior_phase
        record["phase"] = phase
        record.pop("pending_operation", None)
        record["last_operation"] = args.operation
        record["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
        receipt = {
            "version": 1,
            "tool_version": VERSION,
            "ok": response["ok"],
            "operation": args.operation,
            "run_id": run_id,
            "status": phase,
            "product": record["product"],
            "scenario": record["scenario_name"],
            "scenario_sha256": record["scenario_sha256"],
            "source_hashes": record["source_hashes"],
            "source_revision": record["source_revision"],
            "environment": record["environment"],
            "effects": "capture",
            "recorded_at": record["updated_at"],
            "resources": record["public_resources"],
            "result": response.get("result", {}),
        }
        receipts = secure(folder / "receipts", directory=True, create=True)
        receipt_path = receipts / f"{record['sequence']:06d}-{args.operation}.json"
        atomic(receipt_path, receipt)
        record["last_receipt"] = str(receipt_path)
        atomic(state_path, record)
        if not response["ok"]:
            receipt["error"] = "Adapter operation failed; private run state is retained for recovery"
        return {**receipt, "receipt": str(receipt_path)}
    finally:
        os.close(fd)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=OPERATIONS)
    parser.add_argument("--manifest")
    parser.add_argument("--scenario")
    parser.add_argument("--environment", choices=("development", "staging", "production"))
    parser.add_argument("--state-root")
    parser.add_argument("--run")
    parser.add_argument("--config", help="explicit private JSON adapter configuration; values stay private")
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args(argv)

    def terminate(_signum: int, _frame: object) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, terminate)
    try:
        result = operate(args)
    except (OSError, ValueError, KeyError, TypeError, KeyboardInterrupt) as error:
        message = str(error) if isinstance(error, Refused) else f"Operation refused ({type(error).__name__})"
        result = {"ok": False, "operation": args.operation, "error": message}
    print(json.dumps(result, sort_keys=True))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
