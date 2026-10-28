"""Regression checks for boundaries that should reject mistakes before deployment."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

TOOLS = Path(__file__).resolve().parents[1]


def load(name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, TOOLS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RepositoryBoundaries(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for folder in ("tools", ".codex", "app"):
            (self.root / folder).mkdir()
        (self.root / "tools/repo-layout.json").write_text(json.dumps(["tools", ".codex", ".mcp.json", "app"]))
        (self.root / ".mcp.json").write_text('{"mcpServers":{"posthog":{"url":"https://example.test/mcp"}}}')
        (self.root / ".codex/config.toml").write_text(
            '[mcp_servers.posthog]\nurl="https://example.test/mcp"\n'
        )
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        self.stage()

    def stage(self) -> None:
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)

    def check(self) -> list[str]:
        return load("repo-gate").check(self.root)

    def test_registered_source_passes(self) -> None:
        self.assertEqual(self.check(), [])

    def test_new_top_level_project_is_rejected(self) -> None:
        (self.root / "another-app").mkdir()
        (self.root / "another-app/main.py").write_text("print('hello')")
        self.stage()
        self.assertTrue(any("another-app" in error for error in self.check()))

    def test_tracked_generated_output_is_rejected(self) -> None:
        (self.root / "app/node_modules").mkdir()
        (self.root / "app/node_modules/cache.js").write_text("// generated")
        self.stage()
        self.assertTrue(any("generated work" in error for error in self.check()))

    def test_mcp_endpoint_drift_is_rejected(self) -> None:
        (self.root / ".codex/config.toml").write_text(
            '[mcp_servers.posthog]\nurl="https://different.test/mcp"\n'
        )
        self.assertTrue(any("url differs" in error for error in self.check()))

    def test_missing_agent_server_is_rejected(self) -> None:
        (self.root / ".codex/config.toml").write_text("")
        self.assertTrue(any("same MCP servers" in error for error in self.check()))

    def test_new_candidate_has_its_own_tracked_context_entry(self) -> None:
        candidate = self.root / "app/src/prototypes/another-possibility"
        candidate.mkdir(parents=True)
        (candidate / "main.ts").write_text("export const prototype = true;\n")
        self.stage()
        self.assertTrue(any("source/brief entry point" in error for error in self.check()))
        (candidate / "README.md").write_text("# Another possibility\n\nAn independent product exploration.\n")
        self.stage()
        self.assertEqual(self.check(), [])

    def test_private_reference_file_requires_public_configuration_and_native_references(self) -> None:
        references = self.root / "app/consumer.env.refs"
        references.write_text("APP_SECRET=op://company/consumer/credential\n")
        self.stage()
        self.assertTrue(any("matching public configuration" in error for error in self.check()))
        (self.root / "app/consumer.env.public").write_text("PUBLIC_ORIGIN=https://example.invalid\n")
        self.stage()
        self.assertEqual(self.check(), [])
        references.write_text("APP_SECRET=an-accidental-literal\n")
        self.stage()
        self.assertTrue(any("1Password reference" in error for error in self.check()))

    def test_preview_contract_owns_its_source_and_environment(self) -> None:
        owner = self.root / "app/example"
        owner.mkdir()
        (owner / "README.md").write_text("# Example preview\n")
        target = {
            "schema": 1, "name": "example-preview", "logicalEnvironment": "development/demo",
            "physicalHost": "rocoto-staging", "sourceOwner": "app/example",
            "publicOrigin": "https://example-demo.soyrocoto.com", "buildCommand": [],
            "artifacts": [{"source": "app/example/app.py", "destination": "app.py", "kind": "source"}],
            "runtime": {
                "service": "rocoto-example", "user": "rocoto-example",
                "installPath": "/srv/example/current", "statePath": "/var/lib/rocoto-example",
                "environmentFile": "/etc/rocoto/example.env",
                "workingDirectory": "/srv/example/current",
                "execStart": ["/usr/bin/python3", "/srv/example/current/app.py"],
                "healthUrl": "http://127.0.0.1:8799/health",
            },
        }
        manifest = owner / "deploy.preview.json"
        manifest.write_text(json.dumps(target))
        self.stage()
        self.assertEqual(self.check(), [])
        target["logicalEnvironment"] = "staging"
        manifest.write_text(json.dumps(target))
        self.assertTrue(any("development/demo" in error for error in self.check()))
        target["logicalEnvironment"] = "development/demo"
        target["sourceOwner"] = "app/elsewhere"
        target["artifacts"] = [
            {"source": "app/elsewhere/app.py", "destination": "app.py", "kind": "source"}
        ]
        manifest.write_text(json.dumps(target))
        self.assertTrue(any("beside its source" in error for error in self.check()))


class ReleaseAuthority(unittest.TestCase):
    def test_release_event_boundary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            event_path = Path(tmp) / "event.json"
            env = {
                "ROCOTO_AGENT_LOGIN": "rocoto-agent",
                "ROCOTO_RELEASE_APPROVER": "owner",
                "GITHUB_ACTOR": "owner",
                "GITHUB_EVENT_NAME": "push",
                "GITHUB_REF": "refs/tags/v1.2.3",
                "GITHUB_EVENT_PATH": str(event_path),
            }
            good = {"sender": {"login": "owner", "type": "User"}, "deleted": False}
            for event, changes, expected in [
                (good, {}, 0),
                (good, {"ROCOTO_AGENT_LOGIN": ""}, 1),
                (good, {"GITHUB_EVENT_NAME": "workflow_dispatch"}, 1),
                (good, {"GITHUB_REF": "refs/heads/main"}, 1),
                (good, {"GITHUB_ACTOR": "someone-else"}, 1),
                ({**good, "deleted": True}, {}, 1),
                ({"sender": {"login": "owner", "type": "Bot"}}, {}, 1),
                ([], {}, 1),
                (good, {"GITHUB_EVENT_PATH": str(Path(tmp) / "absent")}, 1),
            ]:
                with self.subTest(event=event, changes=changes):
                    event_path.write_text(json.dumps(event))
                    with patch.dict(os.environ, {**env, **changes}, clear=True):
                        self.assertEqual(load("release-guard").main(), expected)

    def test_local_tag_cannot_reach_publisher(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "deploy/kit").mkdir(parents=True)
            (root / "deploy/release.sh").write_text((TOOLS.parent / "deploy/release.sh").read_text())
            (root / "deploy/kit/publish-chain.sh").write_text("echo LOCAL_PUBLISH_REACHED\n")
            subprocess.run(["git", "init", "-q", "-b", "main", str(root)], check=True)
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            subprocess.run(
                [
                    "git",
                    "-c",
                    "user.name=Test",
                    "-c",
                    "user.email=test@example.test",
                    "-c",
                    "core.hooksPath=/dev/null",
                    "commit",
                    "-qm",
                    "fixture",
                ],
                cwd=root,
                check=True,
            )
            subprocess.run(["git", "tag", "v1.2.3"], cwd=root, check=True)
            subprocess.run(["git", "checkout", "-q", "--detach", "v1.2.3"], cwd=root, check=True)
            result = subprocess.run(
                ["bash", "deploy/release.sh", "v1.2.3"],
                cwd=root,
                env={"PATH": os.environ["PATH"]},
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn("LOCAL_PUBLISH_REACHED", result.stdout)
            self.assertIn("only in the Actions workflow", result.stdout)

    def test_configured_human_can_release(self) -> None:
        self.assertEqual(load("release-guard").validate("rocoto-agent", "owner", "owner"), [])

    def test_shared_identity_is_rejected(self) -> None:
        self.assertTrue(load("release-guard").validate("owner", "owner", "owner"))

    def test_agent_cannot_release(self) -> None:
        self.assertTrue(load("release-guard").validate("rocoto-agent", "rocoto-agent", "owner"))

    def test_uncommissioned_release_is_rejected(self) -> None:
        self.assertTrue(load("release-guard").validate("", "owner", ""))


if __name__ == "__main__":
    unittest.main()
