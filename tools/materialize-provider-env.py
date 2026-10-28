#!/usr/bin/env python3
"""Validate or atomically materialize one provider consumer's private environment."""

from __future__ import annotations

import argparse
import os
import re
import stat
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

NAME = re.compile(r"[A-Z][A-Z0-9_]*")
REFERENCE = re.compile(r"op://[^\s]+")
PRIVATE_NAME = re.compile(
    r"(?:SECRET|TOKEN|PASSWORD|PASSCODE|ACCESS_CODE|API_KEY|PRIVATE_KEY|ENCRYPTION_KEY|CREDENTIAL|DSN)"
)
UNRESOLVED = re.compile(r"(?:<[^>]+>|\b(?:TODO|CHANGEME|REPLACE_ME)\b)", re.IGNORECASE)


def assignments(path: Path) -> dict[str, str]:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"{path.name} must be a regular file")
    values: dict[str, str] = {}
    for number, raw in enumerate(path.read_text().splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith(("#", ";")):
            continue
        name, separator, value = line.partition("=")
        if not separator or not NAME.fullmatch(name):
            raise ValueError(f"{path.name} line {number} requires NAME=value syntax")
        if name in values:
            raise ValueError(f"{path.name} repeats {name}")
        value = value.strip()
        if not value or UNRESOLVED.search(value):
            raise ValueError(f"{path.name} leaves {name} unresolved")
        values[name] = value
    if not values:
        raise ValueError(f"{path.name} contains no configuration names")
    return values


def input_contract(public_path: Path, reference_path: Path) -> tuple[dict[str, str], dict[str, str]]:
    public = assignments(public_path)
    private = assignments(reference_path)
    overlap = set(public) & set(private)
    if overlap:
        raise ValueError("configuration repeats " + ", ".join(sorted(overlap)))
    for name, value in public.items():
        if REFERENCE.fullmatch(value) or "op://" in value:
            raise ValueError(f"{public_path.name} keeps 1Password references in the reference file")
        if PRIVATE_NAME.search(name):
            raise ValueError(f"{public_path.name} keeps private name {name} in the reference file")
        if urlsplit(value).username is not None:
            raise ValueError(f"{public_path.name} keeps authenticated URL {name} in the reference file")
    for name, value in private.items():
        if REFERENCE.fullmatch(value) is None:
            raise ValueError(f"{reference_path.name} requires one complete 1Password reference for {name}")
    return public, private


def private_op_environment() -> dict[str, str]:
    keep = {"HOME", "PATH", "XDG_CONFIG_HOME", "XDG_RUNTIME_DIR", "SSH_AUTH_SOCK", "TERM"}
    return {name: value for name, value in os.environ.items() if name in keep or name.startswith("OP_")}


def resolve(reference: str, op_binary: str) -> str:
    result = subprocess.run(
        [op_binary, "inject"],
        input="{{ " + reference + " }}",
        text=True,
        capture_output=True,
        env=private_op_environment(),
        check=False,
    )
    if result.returncode:
        raise ValueError(f"1Password injection failed with exit status {result.returncode}")
    # `op inject` terminates stdout with one newline even when its input has none.
    # Remove that transport terminator only; embedded or additional newlines remain invalid.
    value = result.stdout.removesuffix("\n")
    if not value or "\n" in value or "\r" in value or "\0" in value or "op://" in value:
        raise ValueError("1Password returned an invalid single-line value")
    return value


def systemd_value(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def materialize(public_path: Path, reference_path: Path, target: Path, op_binary: str) -> int:
    public, private = input_contract(public_path, reference_path)
    if not target.is_absolute():
        raise ValueError("output path must be absolute")
    if target.is_symlink():
        raise ValueError("output must be a regular file")
    if target.exists() and (not target.is_file() or stat.S_IMODE(target.stat().st_mode) != 0o600):
        raise ValueError("existing output must be a regular file with mode 0600")
    target.parent.mkdir(parents=True, exist_ok=True)
    parent = target.parent.stat()
    if target.parent.resolve() != target.parent or parent.st_uid != os.getuid() or parent.st_mode & 0o022:
        raise ValueError(
            "output directory must be owned by this operator, non-symbolic and privately writable"
        )

    resolved = {name: resolve(reference, op_binary) for name, reference in private.items()}
    values = {**public, **resolved}
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    temporary = Path(temporary_name)
    try:
        os.chmod(temporary, 0o600)
        with os.fdopen(descriptor, "w") as handle:
            handle.write("# Materialized from committed public config and 1Password references.\n")
            for name, value in values.items():
                handle.write(f"{name}={systemd_value(value)}\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
        directory = os.open(target.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)
    return len(values)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", type=Path, required=True)
    parser.add_argument("--references", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--op-binary", default="op", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.check == (args.output is not None):
        parser.error("choose exactly one of --check or --output")
    try:
        if args.check:
            public, private = input_contract(args.public, args.references)
            total = len(public) + len(private)
            print(f"provider environment: {total} names, {len(private)} private references")
            return 0
        count = materialize(args.public, args.references, args.output, args.op_binary)
    except (OSError, ValueError) as error:
        parser.exit(1, f"provider environment: {error}\n")
    print(f"provider environment: wrote {count} names to {args.output} with mode 0600")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
