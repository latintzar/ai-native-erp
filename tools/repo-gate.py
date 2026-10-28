#!/usr/bin/env python3
"""Check tracked layout and shared agent configuration using the standard library."""

from __future__ import annotations

import json
import runpy
import subprocess
import sys
import tomllib
from pathlib import Path


def check(root: Path) -> list[str]:
    tracked = (
        subprocess.run(["git", "ls-files", "-z"], cwd=root, check=True, capture_output=True)
        .stdout.decode()
        .split("\0")
    )
    layout = json.loads((root / "tools/repo-layout.json").read_text())
    errors = []
    tracked_names = set(filter(None, tracked))
    candidates = set()
    for name in filter(None, tracked):
        if name.split("/", 1)[0] not in layout:
            errors.append(f"{name}: register its root role in tools/repo-layout.json and README.md")
        if any(part in {"node_modules", "__pycache__", ".venv", ".worktrees"} for part in name.split("/")):
            errors.append(f"{name}: generated work belongs outside tracked source")
        parts = Path(name).parts
        if len(parts) >= 5 and parts[:3] == ("app", "src", "prototypes"):
            candidates.add(parts[3])
        if parts[-1] == "deploy.preview.json":
            try:
                contract = runpy.run_path(str(
                    Path(__file__).resolve().parents[1] / "deploy/development/contract.py"
                ))
                target = contract["validate_manifest"](json.loads((root / name).read_text()))
                owner = Path(target["sourceOwner"])
                if Path(name).parent != owner:
                    errors.append(f"{name}: preview target belongs beside its source at {owner}")
                if str(owner / "README.md") not in tracked_names:
                    errors.append(f"{name}: preview source owner needs a tracked README.md")
            except (OSError, ValueError) as exc:
                errors.append(f"{name}: {exc}")
        if name.endswith(".env.refs"):
            public = name.removesuffix(".refs") + ".public"
            if public not in tracked_names:
                errors.append(f"{name}: commit its matching public configuration at {public}")
            else:
                try:
                    contract = runpy.run_path(str(Path(__file__).with_name("materialize-provider-env.py")))
                    contract["input_contract"](root / public, root / name)
                except (OSError, ValueError) as exc:
                    errors.append(f"{name}: {exc}")
    for candidate in sorted(candidates):
        readme = f"app/src/prototypes/{candidate}/README.md"
        if readme not in tracked_names:
            errors.append(f"{candidate}: commit its source/brief entry point at {readme}")
    claude = json.loads((root / ".mcp.json").read_text())["mcpServers"]
    codex = tomllib.loads((root / ".codex/config.toml").read_text()).get("mcp_servers", {})
    if set(claude) != set(codex):
        errors.append("Claude and Codex must declare the same MCP servers")
    for name in set(claude) & set(codex):
        for field in ("url", "command", "args"):
            if claude[name].get(field) != codex[name].get(field):
                errors.append(f"MCP {name}: {field} differs between agents")
    return errors


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    try:
        errors = check(root)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
        print(f"repo-gate: configuration could not be checked: {exc}")
        return 1
    for error in errors:
        print(error)
    print(f"repo-gate: {len(errors)} error(s)")
    return int(bool(errors))


if __name__ == "__main__":
    sys.exit(main())
