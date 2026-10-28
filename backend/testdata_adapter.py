#!/usr/bin/env python3
"""Product adapter for the company testdata protocol; owns one local throwaway cluster.

The private ownership journal precedes every Docker mutation. Public resources identify
the run; credentials stay in its private directory. Protocol stdout is one JSON object.
"""

from __future__ import annotations

import asyncio
import contextlib
import fcntl
import hashlib
import json
import os
import re
import secrets
import socket
import stat
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

BACKEND = Path(__file__).resolve().parent
ADAPTER = "rocoto-postgres-v1"
OWNER_FILE = "adapter-owner.json"
COMPOSE_FILE = "adapter-compose.json"
OPERATIONS = {"create", "populate", "exercise", "status", "reset", "delete"}
LABEL_PREFIX = "com.rocoto.testdata."


class Refusal(Exception):
    """A safe, credential-free protocol error."""


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def scenario_for(value: dict) -> dict:
    """This reviewed scenario is synthetic by construction; custom imports need a new adapter."""
    fixture = json.loads((BACKEND / "seed/scenarios/harbor-v1.json").read_text())
    if value not in ({}, {"id": fixture["id"]}, fixture):
        raise Refusal("scenario must match the reviewed harbor-v1 fixture")
    return fixture


def private_directory(path: str) -> Path:
    p = Path(path)
    if not p.is_absolute() or p != p.resolve():
        raise Refusal("state_dir must be an absolute directory without symlink components")
    info = p.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise Refusal("state_dir must be private and owned by the current user")
    return p


def read_private(path: Path) -> dict:
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise Refusal("adapter state must be a private owned regular file")
        return json.load(stream)


def write_private(path: Path, value: dict) -> None:
    """Atomic journal update, durable before starting or modifying Docker resources."""
    fd, temp = tempfile.mkstemp(prefix=".adapter-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(canonical(value) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
        directory = os.open(path.parent, os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(temp)


def resources_for(owner: dict) -> dict:
    return {
        key: owner[key]
        for key in (
            "adapter",
            "run_id",
            "owner_id",
            "project",
            "state_dir",
            "database",
            "tenant_slug",
            "scenario_sha256",
        )
    }


def labels_for(owner: dict) -> dict:
    return {
        LABEL_PREFIX + "adapter": ADAPTER,
        LABEL_PREFIX + "owner": owner["owner_id"],
        LABEL_PREFIX + "run": owner["run_id"],
        LABEL_PREFIX + "state": hashlib.sha256(owner["state_dir"].encode()).hexdigest(),
    }


def compose_for(owner: dict) -> dict:
    labels = labels_for(owner)
    return {
        "services": {
            "db": {
                "image": "pgvector/pgvector:pg16",
                "labels": labels,
                "environment": {
                    "POSTGRES_USER": "testdata_owner",
                    "POSTGRES_PASSWORD": owner["passwords"]["owner"],
                    "POSTGRES_DB": "postgres",
                },
                "ports": ["127.0.0.1::5432"],
                "volumes": ["data:/var/lib/postgresql/data"],
                "healthcheck": {
                    "test": ["CMD", "pg_isready", "-U", "testdata_owner", "-d", "postgres"],
                    "interval": "1s",
                    "timeout": "5s",
                    "retries": 40,
                },
            }
        },
        "volumes": {"data": {"labels": labels}},
        "networks": {"default": {"labels": labels}},
    }


def validate_owner(owner: dict, request: dict, scenario: dict) -> None:
    token = owner.get("owner_id", "")
    if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{32}", token):
        raise Refusal("ownership journal identity is invalid")
    if request["operation"] in {"status", "delete"}:
        scenario = owner["scenario"]
    expected = {
        "adapter": ADAPTER,
        "run_id": request["run_id"],
        "owner_id": token,
        "project": "rocoto-testdata-" + token[:20],
        "state_dir": request["state_dir"],
        "database": "testdata",
        "tenant_slug": "synthetic_" + token[:16],
        "scenario_sha256": digest(scenario),
    }
    if resources_for(owner) != expected:
        raise Refusal("ownership journal differs from the requested run")
    if digest(owner.get("scenario")) != owner["scenario_sha256"]:
        raise Refusal("stored scenario differs from its ownership fingerprint")
    if request["resources"] and request["resources"] != expected:
        raise Refusal("resource receipt differs from the private ownership journal")
    passwords = owner.get("passwords", {})
    if set(passwords) != {"owner", "runtime", "control"} or any(
        not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{48}", value) for value in passwords.values()
    ):
        raise Refusal("ownership journal credentials are invalid")
    if owner.get("phase") not in {"reserved", "initializing", "ready", "resetting", "deleted"}:
        raise Refusal("ownership journal phase is invalid")


def reserve(request: dict, scenario: dict, directory: Path) -> dict:
    path = directory / OWNER_FILE
    if path.exists() or path.is_symlink():
        owner = read_private(path)
        validate_owner(owner, request, scenario)
        return owner
    if request["resources"] or request["operation"] != "create":
        raise Refusal("create must first reserve this run's ownership journal")
    token = secrets.token_hex(16)
    owner = {
        "adapter": ADAPTER,
        "run_id": request["run_id"],
        "owner_id": token,
        "project": "rocoto-testdata-" + token[:20],
        "state_dir": str(directory),
        "database": "testdata",
        "tenant_slug": "synthetic_" + token[:16],
        "scenario_sha256": digest(scenario),
        "phase": "reserved",
        "scenario": scenario,
        "passwords": {role: secrets.token_hex(24) for role in ("owner", "runtime", "control")},
    }
    write_private(path, owner)
    return owner


class Cluster:
    def __init__(self, owner: dict):
        self.owner = owner
        self.directory = Path(owner["state_dir"])
        self.project = owner["project"]

    def docker(self, *args: str, timeout: int = 30) -> str:
        # A local engine is selected explicitly; caller Docker contexts and registry secrets
        # cannot select a different host. Only the normal executable lookup is inherited.
        try:
            result = subprocess.run(
                ["docker", "--host", "unix:///var/run/docker.sock", *args],
                env={"PATH": os.defpath, "DOCKER_CONFIG": str(self.directory / "docker-config")},
                cwd=self.directory,
                text=True,
                capture_output=True,
                timeout=timeout,
            )
        except (OSError, subprocess.SubprocessError) as error:
            raise Refusal("local Docker operation failed: " + type(error).__name__) from None
        if result.returncode:
            # Compose diagnostics may contain the generated password/environment. The caller
            # receives a safe operation name; Docker itself retains local diagnostics.
            raise Refusal("local Docker command failed: " + args[0])
        return result.stdout.strip()

    def compose(self, *args: str, timeout: int = 60) -> str:
        path = self.directory / COMPOSE_FILE
        expected = compose_for(self.owner)
        if path.exists() or path.is_symlink():
            if read_private(path) != expected:
                raise Refusal("Compose definition differs from the ownership journal")
        else:
            write_private(path, expected)
        return self.docker(
            "compose", "--project-name", self.project, "--file", str(path), *args, timeout=timeout
        )

    def inspect_owned(self) -> dict[str, list[dict]]:
        """Inspect all project members before adoption or teardown, including partial startup."""
        result: dict[str, list[dict]] = {}
        expected_names = {
            "container": self.project + "-db-1",
            "volume": self.project + "_data",
            "network": self.project + "_default",
        }
        for kind in ("container", "volume", "network"):
            listing = [kind, "ls", "--quiet", "--filter", "label=com.docker.compose.project=" + self.project]
            if kind == "container":
                listing.insert(2, "--all")
            identifiers = set(self.docker(*listing).split())
            # A same-named resource with a missing/foreign project label must also be
            # inspected: Compose can otherwise adopt that volume during a partial retry.
            listing[-1] = "name=" + expected_names[kind]
            identifiers.update(self.docker(*listing).split())
            ids = sorted(identifiers)
            objects = json.loads(self.docker(kind, "inspect", *ids)) if ids else []
            if len(objects) > 1:
                raise Refusal("unexpected additional Docker resources in this run's project")
            for obj in objects:
                labels = (obj.get("Config", {}) if kind == "container" else obj).get("Labels", {}) or {}
                expected_labels = {**labels_for(self.owner), "com.docker.compose.project": self.project}
                if any(labels.get(key) != value for key, value in expected_labels.items()):
                    raise Refusal("Docker ownership labels differ from this run")
                if obj.get("Name", "").lstrip("/") != expected_names[kind]:
                    raise Refusal("Docker resource identity differs from this run")
                if kind == "container":
                    if labels.get("com.docker.compose.service") != "db":
                        raise Refusal("unexpected Compose service in this run")
                    saved = self.owner.get("container_id")
                    if saved and obj["Id"] != saved:
                        raise Refusal("owned container was replaced outside this lifecycle")
                    mounts = obj.get("Mounts", [])
                    if (
                        len(mounts) != 1
                        or mounts[0].get("Type") != "volume"
                        or mounts[0].get("Name") != expected_names["volume"]
                        or mounts[0].get("Destination") != "/var/lib/postgresql/data"
                    ):
                        raise Refusal("database storage differs from this run's owned volume")
            result[kind] = objects
        return result

    def start(self) -> int:
        objects = self.inspect_owned()
        if self.owner["phase"] == "reserved" and any(objects.values()):
            raise Refusal("reserved Docker project already has resources")
        if self.owner.get("container_id") and not objects["container"]:
            raise Refusal("owned container is missing; delete this run to reclaim its resources")
        self.owner["phase"] = "initializing"
        write_private(self.directory / OWNER_FILE, self.owner)
        self.compose("up", "--detach", "--wait", "--wait-timeout", "60", "db", timeout=180)
        objects = self.inspect_owned()
        if not all(len(objects[kind]) == 1 for kind in ("container", "volume", "network")):
            raise Refusal("Docker startup did not produce the complete owned cluster")
        self.owner["container_id"] = objects["container"][0]["Id"]
        write_private(self.directory / OWNER_FILE, self.owner)
        return self.port(objects)

    def port(self, objects: dict | None = None) -> int:
        objects = self.inspect_owned() if objects is None else objects
        if not all(len(objects[kind]) == 1 for kind in ("container", "volume", "network")):
            raise Refusal("owned database container is unavailable")
        container = objects["container"][0]
        if not container.get("State", {}).get("Running"):
            raise Refusal("owned database container is stopped")
        if set(container.get("NetworkSettings", {}).get("Networks", {})) != {self.project + "_default"}:
            raise Refusal("owned database network differs from the isolated Compose network")
        bindings = container.get("NetworkSettings", {}).get("Ports", {}).get("5432/tcp") or []
        if len(bindings) != 1 or bindings[0].get("HostIp") != "127.0.0.1":
            raise Refusal("database must publish one loopback port")
        port = bindings[0].get("HostPort", "")
        if not port.isdecimal() or not 0 < int(port) < 65536:
            raise Refusal("owned database port is invalid")
        return int(port)

    def delete(self) -> dict:
        objects = self.inspect_owned()
        # Remove only inspected IDs. Cleanup stays available if a later adapter revision
        # changes its Compose template, and a modified Compose file cannot widen deletion.
        for kind in ("container", "volume", "network"):
            objects = self.inspect_owned()
            for obj in objects[kind]:
                identity = obj["Name"] if kind == "volume" else obj["Id"]
                args = [kind, "rm", *(["--force"] if kind == "container" else []), identity]
                self.docker(*args, timeout=90)
        if any(self.inspect_owned().values()):
            raise Refusal("owned Docker resources remain after deletion")
        self.owner["phase"] = "deleted"
        write_private(self.directory / OWNER_FILE, self.owner)
        return {"state": "deleted", "owned_resources_remaining": 0}


def isolate_backend_environment(owner: dict, port: int) -> None:
    """Only generated local DB credentials enter product imports; egress reaches that port."""
    os.environ.clear()
    root = f"@127.0.0.1:{port}/testdata"
    os.environ.update(
        {
            "PATH": os.defpath,
            "DATABASE_URL": "postgresql://testdata_owner:" + owner["passwords"]["owner"] + root,
            "RUNTIME_DATABASE_URL": "postgresql://rocoto_rt:" + owner["passwords"]["runtime"] + root,
            "CONTROL_DATABASE_URL": "postgresql://rocoto_ctrl:" + owner["passwords"]["control"] + root,
            "ROCOTO_REQUIRE_RLS": "true",
            "ROCOTO_EGRESS_SANDBOX": "1",
            "BRAIN_TENANT": owner["tenant_slug"],
        }
    )
    connect, connect_ex = socket.socket.connect, socket.socket.connect_ex

    def check(address: Any) -> None:
        if not isinstance(address, tuple) or address[:2] != ("127.0.0.1", port):
            raise Refusal("capture mode permits the owned loopback database connection")

    def guarded_connect(sock: socket.socket, address: Any) -> Any:
        check(address)
        return connect(sock, address)

    def guarded_connect_ex(sock: socket.socket, address: Any) -> Any:
        check(address)
        return connect_ex(sock, address)

    for name, method in (("connect", guarded_connect), ("connect_ex", guarded_connect_ex)):
        setattr(socket.socket, name, method)


def validate_request(request: dict) -> tuple[Path, dict]:
    if not isinstance(request, dict) or request.get("protocol") != 1:
        raise Refusal("expected testdata protocol 1")
    if request.get("operation") not in OPERATIONS or request.get("environment") != "development":
        raise Refusal("this adapter requires a supported development operation")
    if not isinstance(request.get("run_id"), str) or not re.fullmatch(
        r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}", request["run_id"]
    ):
        raise Refusal("run_id must be a short safe identifier")
    if not all(isinstance(request.get(key), dict) for key in ("scenario", "resources", "config")):
        raise Refusal("scenario, resources and config must be JSON objects")
    if request["config"] not in ({}, {"effects": "capture"}):
        raise Refusal("this adapter accepts capture effects configuration")
    if not isinstance(request.get("state_dir"), str):
        raise Refusal("state_dir must be an absolute private directory")
    scenario = (
        request["scenario"]
        if request["operation"] in {"status", "delete"}
        else scenario_for(request["scenario"])
    )
    return private_directory(request["state_dir"]), scenario


def main() -> int:
    resources: dict = {}
    try:
        request = json.loads(sys.stdin.read(1_048_577))
        directory, scenario = validate_request(request)
        fd = os.open(directory / "adapter.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            marker = directory / OWNER_FILE
            if (
                request["operation"] == "delete"
                and not request["resources"]
                and not marker.exists()
                and not marker.is_symlink()
            ):
                # The engine may have been interrupted before this subprocess reserved
                # anything. This adapter creates zero resources before that durable marker.
                print(
                    canonical(
                        {
                            "ok": True,
                            "resources": {},
                            "result": {"state": "deleted", "owned_resources_remaining": 0},
                        }
                    )
                )
                return 0
            owner = reserve(request, scenario, directory)
            scenario = owner["scenario"]
            resources = resources_for(owner)
            cluster = Cluster(owner)
            operation = request["operation"]
            if operation == "delete":
                result = cluster.delete()
            elif owner["phase"] == "deleted":
                if operation != "status":
                    raise Refusal("this run is deleted; create a new run identity")
                if any(cluster.inspect_owned().values()):
                    raise Refusal("deleted run has unexpected Docker resources")
                result = {"state": "deleted", "owned_resources_remaining": 0}
            elif operation == "status" and owner["phase"] != "ready":
                objects = cluster.inspect_owned()
                result = {
                    "state": owner["phase"],
                    "docker_resources": {k: len(v) for k, v in objects.items()},
                }
            else:
                previous_phase = owner["phase"]
                if operation == "create":
                    port = cluster.port() if previous_phase == "ready" else cluster.start()
                else:
                    port = cluster.port()
                isolate_backend_environment(owner, port)
                # Product imports occur only after selecting and proving the local cluster.
                sys.modules.setdefault("testdata_adapter", sys.modules[__name__])
                from seed.testdata import operate

                result = asyncio.run(operate(operation, owner, scenario, port, previous_phase))
                owner["phase"] = "ready"
                write_private(directory / OWNER_FILE, owner)
        response = {"ok": True, "resources": resources, "result": result}
        code = 0
    except Exception as error:
        message = (
            str(error) if isinstance(error, Refusal) else "adapter operation failed: " + type(error).__name__
        )
        print(message, file=sys.stderr)
        response = {"ok": False, "resources": resources, "result": {}, "error": message}
        code = 1
    print(canonical(response))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
