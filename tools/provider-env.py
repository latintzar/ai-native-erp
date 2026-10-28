#!/usr/bin/env python3
"""Private provider setup. Values enter a hidden prompt or selected private file."""
from __future__ import annotations

import argparse
import ast
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import stat
import sys
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
GROUPS = {
    "copilot-gemini": ({"GEMINI_API_KEY"}, {"COPILOT_MODEL": "gemini", "COPILOT_GEMINI_MODEL": "gemini-3.5-flash-lite"}, "COPILOT_GEMINI_MODEL"),
    "copilot-anthropic": ({"ANTHROPIC_API_KEY"}, {"COPILOT_MODEL": "anthropic"}, "COPILOT_ANTHROPIC_MODEL"),
    "documents": ({"PARSEWISE_API_KEY"}, {}, None),
    "transcription": ({"DEEPGRAM_API_KEY"}, {}, None),
    "places": ({"GOOGLE_PLACES_API_KEY"}, {}, None),
    "artwork": ({"IDEOGRAM_API_KEY"}, {"ARTWORK_HOURLY_CEILING": "1"}, None),
}


def allowed_names():
    names = set()
    for source in (ROOT / "backend/config.py", ROOT / "mock-api/app/config.py"):
        tree = ast.parse(source.read_text())
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = node.func.id if isinstance(node.func, ast.Name) else ""
            if name in {"_env", "_first_env", "_bool", "_int", "_float"}:
                for argument in node.args[:len(node.args) if name == "_first_env" else 1]:
                    if isinstance(argument, ast.Constant) and isinstance(argument.value, str):
                        names.add(argument.value)
    # The maintained backend also reads declared settings in its domain modules.
    for line in (ROOT / ".env.example").read_text().splitlines():
        name, separator, _value = line.partition("=")
        if separator and re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
            names.add(name)
    return names


def checked_path(path):
    selected = Path(path).expanduser()
    if not selected.is_absolute() or selected != selected.resolve() or selected.is_relative_to(ROOT):
        raise ValueError("Use an absolute private path outside this checkout.")
    if selected.exists():
        info = selected.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1:
            raise ValueError("Use an owned regular mode-0600 file.")
    return selected


def read_private(path):
    selected = checked_path(path)
    allowed = allowed_names()
    values = {}
    if not selected.exists():
        return values
    if selected.stat().st_size > 65_536:
        raise ValueError("Private configuration exceeds its size bound.")
    for raw in selected.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        name, separator, value = line.partition("=")
        if not separator or name not in allowed or name in values:
            raise ValueError("Check configuration names.")
        if value.startswith('"'):
            value = json.loads(value)
        if not isinstance(value, str) or len(value) > 4096 or any(character in value for character in "\n\r\0"):
            raise ValueError("Use bounded single-line values.")
        values[name] = value
    return values


def write_private(path, values):
    selected = checked_path(path)
    selected.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
    info = selected.parent.stat()
    if info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError("Use an owned mode-0700 configuration directory.")
    if set(values) - allowed_names():
        raise ValueError("Check configuration names.")
    descriptor, temporary = tempfile.mkstemp(prefix=".providers-", dir=selected.parent)
    try:
        with os.fdopen(descriptor, "w") as stream:
            for name, value in sorted(values.items()):
                stream.write(name + "=" + json.dumps(value) + "\n")
            stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, selected)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["configure", "doctor", "run"])
    parser.add_argument("--file", type=Path, required=True)
    parser.add_argument("--provider", choices=sorted(GROUPS))
    parser.add_argument("--model")
    parser.add_argument("--runtime-base", help=argparse.SUPPRESS)
    pieces = sys.argv[1:]
    child = []
    if "--" in pieces:
        split = pieces.index("--")
        pieces, child = pieces[:split], pieces[split + 1:]
    arguments = parser.parse_args(pieces)
    try:
        values = read_private(arguments.file)
        if arguments.command == "configure":
            if not arguments.provider:
                raise ValueError("Select a provider capability.")
            if not sys.stdin.isatty():
                raise ValueError("Use a private interactive terminal for hidden input.")
            required, settings, model_name = GROUPS[arguments.provider]
            for name in sorted(required):
                value = getpass.getpass(name + ": ")
                if not 8 <= len(value) <= 4096 or any(character in value for character in "\n\r\0"):
                    raise ValueError("Check the private provider value.")
                values[name] = value
            values.update(settings)
            if arguments.model:
                if not model_name or len(arguments.model) > 128 or not all(character.isalnum() or character in "._:/-" for character in arguments.model):
                    raise ValueError("Check the provider model identifier.")
                values[model_name] = arguments.model
            if arguments.provider == "artwork":
                if not values.get("ARTWORK_SHARED_SECRET"):
                    values["ARTWORK_SHARED_SECRET"] = secrets.token_urlsafe(32)
            write_private(arguments.file, values)
            print(json.dumps({"saved": True, "provider": arguments.provider, "provider_calls": 0}))
        elif arguments.command == "doctor":
            print(json.dumps({"configured": {label: all(values.get(name) for name in required)
                                              for label, (required, _settings, _model) in GROUPS.items()},
                              "configured_names": sorted(name for name, value in values.items() if value),
                              "file_present": arguments.file.exists(), "provider_calls": 0}))
        else:
            if not child or not arguments.file.is_file():
                raise ValueError("Select a local child process.")
            keep = {"PATH", "HOME", "LANG", "LC_ALL", "SSL_CERT_FILE", "SSL_CERT_DIR", "NO_PROXY",
                    "ROCOTO_RUNTIME_PUBLIC_BASE", "ROCOTO_RUNTIME_STATE_DIR"}
            environment = {name: value for name, value in os.environ.items() if name in keep}
            if arguments.runtime_base:
                base = urlsplit(arguments.runtime_base)
                if base.scheme != "http" or base.hostname not in {"127.0.0.1", "localhost"} or not base.port or base.path or base.query or base.fragment or base.username:
                    raise ValueError("Use this development runtime's loopback origin.")
                values["ROCOTO_RUNTIME_PUBLIC_BASE"] = arguments.runtime_base
            os.execvpe(child[0], child, {**environment, **values})
    except (OSError, ValueError, EOFError, RuntimeError):
        parser.exit(2, "Check private provider configuration and file permissions.\n")


if __name__ == "__main__":
    main()
