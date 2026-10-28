"""The repeatable development-preview package and receiver stay inside their declared boundary."""

from __future__ import annotations

import hashlib
import io
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "deploy/development/package.py"
RECEIVER = ROOT / "deploy/development/receive.py"
PUBLISH = ROOT / "deploy/development/publish.py"
sys.path.insert(0, str(RECEIVER.parent))


class DevelopmentPreviewPackage(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=self.root, check=True)
        subprocess.run(["git", "config", "user.email", "preview@example.test"], cwd=self.root, check=True)
        subprocess.run(["git", "config", "user.name", "Preview Test"], cwd=self.root, check=True)
        source = self.root / "prototypes/example"
        source.mkdir(parents=True)
        (source / "app.py").write_text("print('preview')\n")
        (source / "static").mkdir()
        (source / "static/index.html").write_text("<title>Preview</title>\n")
        self.manifest = source / "deploy.preview.json"
        self.manifest.write_text(json.dumps({
            "schema": 1,
            "name": "example-preview",
            "logicalEnvironment": "development/demo",
            "physicalHost": "rocoto-staging",
            "sourceOwner": "prototypes/example",
            "publicOrigin": "https://example-demo.soyrocoto.com",
            "buildCommand": [],
            "artifacts": [
                {"source": "prototypes/example/app.py", "destination": "app.py", "kind": "source"},
                {"source": "prototypes/example/static", "destination": "static", "kind": "source"},
            ],
            "runtime": {
                "service": "rocoto-example-preview",
                "user": "rocoto-example-preview",
                "installPath": "/srv/example-preview/current",
                "statePath": "/var/lib/rocoto-example-preview",
                "environmentFile": "/etc/rocoto/example-preview.env",
                "workingDirectory": "/srv/example-preview/current",
                "execStart": ["/usr/bin/python3", "/srv/example-preview/current/app.py"],
                "healthUrl": "http://127.0.0.1:8799/health",
            },
        }, indent=2))
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        subprocess.run(["git", "commit", "-qm", "fixture"], cwd=self.root, check=True)
        self.revision = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=self.root, text=True
        ).strip()

    def package(self, manifest: Path | None = None,
                environment: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(PACKAGE), "--repo", str(self.root), "--manifest",
             str(manifest or self.manifest), "--output", str(self.root / "preview.tar.gz")],
            capture_output=True, text=True, env=environment,
        )

    def test_package_records_source_revision_and_every_file_hash(self) -> None:
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stderr)
        with tarfile.open(self.root / "preview.tar.gz", "r:gz") as archive:
            names = archive.getnames()
            self.assertEqual(names, ["release.json", "payload/app.py", "payload/static/index.html"])
            release_file = archive.extractfile("release.json")
            self.assertIsNotNone(release_file)
            assert release_file
            release = json.load(release_file)
            self.assertEqual(release["sourceCommit"], self.revision)
            self.assertEqual(release["target"], "example-preview")
            for name, digest in release["files"].items():
                member = archive.extractfile("payload/" + name)
                self.assertIsNotNone(member)
                assert member
                content = member.read()
                self.assertEqual(hashlib.sha256(content).hexdigest(), digest)
        plan = subprocess.run(
            [sys.executable, str(PUBLISH), "--package", str(self.root / "preview.tar.gz"), "--plan"],
            capture_output=True, text=True,
        )
        self.assertEqual(plan.returncode, 0, plan.stderr)
        self.assertEqual(json.loads(plan.stdout)["logicalEnvironment"], "development/demo")

    def test_package_refuses_dirty_owned_source(self) -> None:
        (self.root / "prototypes/example/app.py").write_text("changed\n")
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("owned source has uncommitted changes", result.stderr)

    def test_package_refuses_staging_or_production_targets(self) -> None:
        value = json.loads(self.manifest.read_text())
        for environment, origin in (("staging", value["publicOrigin"]),
                                    ("development/demo", "https://api.soyrocoto.com")):
            with self.subTest(environment=environment, origin=origin):
                candidate = self.root / "candidate.json"
                value["logicalEnvironment"] = environment
                value["publicOrigin"] = origin
                candidate.write_text(json.dumps(value))
                result = self.package(candidate)
                self.assertNotEqual(result.returncode, 0)

    def test_package_refuses_secret_file_artifacts(self) -> None:
        secret = self.root / "prototypes/example/.env"
        secret.write_text("TOKEN=private\n")
        value = json.loads(self.manifest.read_text())
        value["artifacts"].append(
            {"source": "prototypes/example/.env", "destination": ".env", "kind": "source"})
        self.manifest.write_text(json.dumps(value))
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        subprocess.run(["git", "commit", "-qm", "bad fixture"], cwd=self.root, check=True)
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("secret-bearing", result.stderr)

    def test_package_refuses_nested_secret_source_and_destination_paths(self) -> None:
        hidden = self.root / "prototypes/example/.env/value.txt"
        hidden.parent.mkdir()
        hidden.write_text("private\n")
        value = json.loads(self.manifest.read_text())
        value["artifacts"] = [
            {"source": "prototypes/example", "destination": "bundle", "kind": "source"}]
        self.manifest.write_text(json.dumps(value))
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        subprocess.run(["git", "commit", "-qm", "nested fixture"], cwd=self.root, check=True)
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("secret-bearing file", result.stderr)

        hidden.unlink()
        value["artifacts"] = [
            {"source": "prototypes/example/app.py", "destination": "config/token/value",
             "kind": "source"}]
        self.manifest.write_text(json.dumps(value))
        subprocess.run(["git", "add", "-A"], cwd=self.root, check=True)
        subprocess.run(["git", "commit", "-qm", "destination fixture"], cwd=self.root, check=True)
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("secret-bearing paths", result.stderr)

    def test_build_receives_a_scrubbed_environment(self) -> None:
        output = self.root / "prototypes/example/dist/environment.json"
        (self.root / ".gitignore").write_text("prototypes/example/dist/\n")
        value = json.loads(self.manifest.read_text())
        value["buildCommand"] = [
            sys.executable, "-c",
            "import json,os,pathlib; pathlib.Path('prototypes/example/dist').mkdir(); "
            "pathlib.Path('prototypes/example/dist/environment.json').write_text(json.dumps(dict(os.environ)))",
        ]
        value["artifacts"] = [
            {"source": "prototypes/example/dist", "destination": "static", "kind": "build"}]
        self.manifest.write_text(json.dumps(value))
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        subprocess.run(["git", "commit", "-qm", "build fixture"], cwd=self.root, check=True)
        environment = dict(os.environ)
        environment.update({"OP_SERVICE_ACCOUNT_TOKEN": "private-op-value",
                            "RESEND_API_KEY": "private-provider-value"})
        result = self.package(environment=environment)
        self.assertEqual(result.returncode, 0, result.stderr)
        captured = json.loads(output.read_text())
        self.assertNotIn("OP_SERVICE_ACCOUNT_TOKEN", captured)
        self.assertNotIn("RESEND_API_KEY", captured)


class DevelopmentPreviewReceiver(unittest.TestCase):
    def test_receiver_refuses_a_tampered_package_before_restart(self) -> None:
        namespace: dict[str, Any] = {"__name__": "preview_receiver_test", "__file__": str(RECEIVER)}
        exec(compile(RECEIVER.read_text(), str(RECEIVER), "exec"), namespace)
        manifest = {
            "schema": 1, "name": "example-preview", "logicalEnvironment": "development/demo",
            "physicalHost": "rocoto-staging", "sourceOwner": "prototypes/example",
            "publicOrigin": "https://example-demo.soyrocoto.com", "buildCommand": [], "artifacts": [],
            "runtime": {"service": "rocoto-example-preview", "user": "rocoto-example-preview",
                        "installPath": "/srv/example/current", "statePath": "/var/lib/example",
                        "environmentFile": "/etc/rocoto/example.env",
                        "workingDirectory": "/srv/example/current",
                        "execStart": ["/usr/bin/python3", "/srv/example/current/app.py"],
                        "healthUrl": "http://127.0.0.1:8799/health"},
        }
        payload = io.BytesIO()
        release = {"schema": 1, "target": "example-preview", "sourceCommit": "a" * 40,
                   "targetManifest": manifest, "files": {"app.py": "0" * 64}}
        with tarfile.open(fileobj=payload, mode="w:gz") as archive:
            for name, content in (("release.json", json.dumps(release).encode()),
                                  ("payload/app.py", b"tampered")):
                info = tarfile.TarInfo(name)
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        with tempfile.TemporaryDirectory() as temporary:
            archive_path = Path(temporary) / "payload.tar.gz"
            archive_path.write_bytes(payload.getvalue())
            with self.assertRaisesRegex(ValueError, "digest"):
                namespace["inspect_package"](archive_path, manifest)

    def test_receiver_refuses_a_release_path_escape(self) -> None:
        namespace: dict[str, Any] = {"__name__": "preview_receiver_test", "__file__": str(RECEIVER)}
        exec(compile(RECEIVER.read_text(), str(RECEIVER), "exec"), namespace)
        manifest = self._target()
        release = {"schema": 1, "target": manifest["name"], "sourceCommit": "a" * 40,
                   "targetManifest": manifest, "files": {"/tmp/escape": "0" * 64}}
        path, archive_temporary = self._archive(release, {"payload//tmp/escape": b"anything"})
        self.addCleanup(archive_temporary.cleanup)
        with self.assertRaisesRegex(ValueError, "normalized relative"):
            namespace["inspect_package"](path, manifest)

    def test_publish_switches_current_symlink_and_rolls_back_failed_health(self) -> None:
        namespace: dict[str, Any] = {"__name__": "preview_receiver_test", "__file__": str(RECEIVER)}
        exec(compile(RECEIVER.read_text(), str(RECEIVER), "exec"), namespace)
        target = self._target()
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        releases = root / "srv/example/releases"
        old = releases / ("b" * 40)
        old.mkdir(parents=True)
        (old / "app.py").write_text("old")
        current = root / "srv/example/current"
        current.symlink_to(Path("releases") / old.name)
        (root / "var/lib/example").mkdir(parents=True)
        release = {"schema": 1, "target": target["name"], "sourceCommit": "a" * 40,
                   "targetManifest": target,
                   "files": {"app.py": hashlib.sha256(b"new").hexdigest()}}
        package, archive_temporary = self._archive(release, {"payload/app.py": b"new"})
        self.addCleanup(archive_temporary.cleanup)
        restarts: list[str] = []
        namespace["restart"] = restarts.append
        health = iter((False, True))
        namespace["healthy"] = lambda _service, _url: next(health)
        namespace["public_healthy"] = lambda _url: True
        with self.assertRaisesRegex(RuntimeError, "health"):
            namespace["publish"](package, target, root)
        self.assertEqual(current.resolve(), old)
        self.assertEqual((current / "app.py").read_text(), "old")
        self.assertEqual(restarts, [target["runtime"]["service"], target["runtime"]["service"]])

    def test_existing_release_mutation_is_refused(self) -> None:
        namespace: dict[str, Any] = {"__name__": "preview_receiver_test", "__file__": str(RECEIVER)}
        exec(compile(RECEIVER.read_text(), str(RECEIVER), "exec"), namespace)
        release = {"files": {"app.py": hashlib.sha256(b"expected").hexdigest()}}
        with tempfile.TemporaryDirectory() as temporary:
            installed = Path(temporary)
            (installed / ".release.json").write_text(json.dumps(release))
            (installed / "app.py").write_text("mutated")
            with self.assertRaisesRegex(ValueError, "different release contents"):
                namespace["verify_installed_release"](installed, release, os.getuid())

    def test_target_derivation_and_parent_file_custody_are_fixed(self) -> None:
        namespace: dict[str, Any] = {"__name__": "preview_receiver_test", "__file__": str(RECEIVER)}
        exec(compile(RECEIVER.read_text(), str(RECEIVER), "exec"), namespace)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            expected = root / "etc/rocoto/previews/example-preview.json"
            self.assertEqual(namespace["commissioned_target_path"]("example-preview", root), expected)
            with self.assertRaisesRegex(ValueError, "lowercase slug"):
                namespace["commissioned_target_path"]("../../other", root)
            parent = root / "etc/rocoto/previews"
            parent.mkdir(parents=True)
            parent.chmod(0o777)
            with self.assertRaisesRegex(ValueError, "root-owned and non-writable"):
                namespace["assert_root_directory"](parent, "preview target directory")
            lock = root / ".publish.lock"
            lock.symlink_to(root / "elsewhere")
            with self.assertRaisesRegex(ValueError, "real commissioned file"):
                namespace["assert_root_file"](lock, "publish lock", private=True)

    @staticmethod
    def _target() -> dict:
        return {
            "schema": 1, "name": "example-preview", "logicalEnvironment": "development/demo",
            "physicalHost": "rocoto-staging", "sourceOwner": "prototypes/example",
            "publicOrigin": "https://example-demo.soyrocoto.com", "buildCommand": [], "artifacts": [],
            "runtime": {"service": "rocoto-example-preview", "user": "rocoto-example-preview",
                        "installPath": "/srv/example/current", "statePath": "/var/lib/example",
                        "environmentFile": "/etc/rocoto/example.env",
                        "workingDirectory": "/srv/example/current",
                        "execStart": ["/usr/bin/python3", "/srv/example/current/app.py"],
                        "healthUrl": "http://127.0.0.1:8799/health"},
        }

    @staticmethod
    def _archive(release: dict, members: dict[str, bytes]) -> tuple[Path, tempfile.TemporaryDirectory]:
        temporary = tempfile.TemporaryDirectory()
        path = Path(temporary.name) / "payload.tar.gz"
        with tarfile.open(path, "w:gz") as archive:
            values = {"release.json": json.dumps(release).encode(), **members}
            for name, content in values.items():
                info = tarfile.TarInfo(name)
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        return path, temporary


if __name__ == "__main__":
    unittest.main()
