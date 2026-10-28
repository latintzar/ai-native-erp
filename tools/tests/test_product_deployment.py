"""Actual archive and generation transactions with controlled service/dependency failure boundaries."""

from __future__ import annotations

import importlib.util
import io
import json
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "deploy/product" / f"{name}.py")
    assert spec and spec.loader
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


receiver = module("receive")
packager = module("package")


class FakeRuntime:
    """Only process boundaries are simulated; archive validation and disk transactions run unchanged."""

    def __init__(self):
        self.fail_prepare = False
        self.fail_schema = False
        self.fail_commit = ""
        self.crash = False
        self.actions = []
        self.action = "upgrade"
        self.compatible = True

    def prepare(self, generation, metadata):
        self.actions.append("prepare")
        if self.fail_prepare:
            raise RuntimeError("dependency installation failed")
        component = "mock-api" if metadata["environment"] == "development" else "backend"
        (generation / (".venv-" + component)).mkdir(mode=0o700)
        (generation / (".venv-" + component) / "dependency-version").write_text(metadata["commit"])
        (generation / "runtime.env").write_text("ROCOTO_RELEASE_COMMIT=" + metadata["commit"])

    def schema(self, generation, operation):
        self.actions.append(operation)
        if self.fail_schema:
            raise RuntimeError("schema check failed")
        return {"action": self.action, "backward_compatible": self.compatible}

    def backup(self):
        self.actions.append("backup")

    def restart(self):
        self.actions.append("restart")
        if self.crash:
            self.crash = False
            raise KeyboardInterrupt("simulated process death after pointer switch")

    def stop(self):
        self.actions.append("stop")

    def healthy(self, commit):
        self.actions.append("health:" + commit)
        return commit != self.fail_commit


class Deployment(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.runtime = FakeRuntime()
        self.source = self.root / "source"
        self.source.mkdir()
        for name in ("app.py", "worker.py", "requirements.txt", "schema_migrations.py"):
            path = self.source / "backend" / name
            path.parent.mkdir(exist_ok=True)
            path.write_text("# fixture\n")
        self.deploy_root = self.root / "installed"
        self.deploy_root.mkdir()

    def artifact(self, commit="a" * 40, environment="production"):
        output = self.root / f"{commit}.tar.gz"
        metadata = packager.package(self.source, output, commit, environment)
        parsed, files = receiver.inspect_package(output, environment)
        self.assertEqual(parsed, metadata)
        return metadata, files

    def publish(self, commit):
        metadata, files = self.artifact(commit)
        return receiver.deploy(self.deploy_root, metadata, files, self.runtime)

    def assert_generation(self, commit):
        self.assertEqual(receiver.current(self.deploy_root), commit)
        current = self.deploy_root / "current"
        self.assertEqual((current / ".venv-backend/dependency-version").read_text(), commit)
        self.assertEqual((current / "runtime.env").read_text(), "ROCOTO_RELEASE_COMMIT=" + commit)

    def test_matching_code_and_dependencies_switch_together_and_retries_reuse(self):
        self.publish("a" * 40)
        self.publish("b" * 40)
        self.assert_generation("b" * 40)
        before = self.runtime.actions.count("prepare")
        self.publish("b" * 40)
        self.assertEqual(self.runtime.actions.count("prepare"), before)
        journal = json.loads((self.deploy_root / "release-state.json").read_text())
        self.assertEqual(journal["previous"], "a" * 40)
        self.assertTrue((self.deploy_root / "releases" / ("a" * 40)).is_dir())

    def test_dependency_and_schema_failures_preserve_serving_generation(self):
        self.publish("a" * 40)
        for stage in ("fail_prepare", "fail_schema"):
            with self.subTest(stage=stage):
                setattr(self.runtime, stage, True)
                with self.assertRaises(RuntimeError):
                    self.publish("b" * 40)
                setattr(self.runtime, stage, False)
                self.assert_generation("a" * 40)

    def test_failed_health_restores_code_and_venv_and_keeps_migrated_data(self):
        self.publish("a" * 40)
        self.runtime.fail_commit = "b" * 40
        with self.assertRaises(RuntimeError):
            self.publish("b" * 40)
        self.assert_generation("a" * 40)
        self.assertEqual(
            json.loads((self.deploy_root / "release-state.json").read_text())["status"], "rolled-back"
        )
        self.assertNotIn("downgrade", self.runtime.actions)

    def test_interrupted_cutover_recovers_before_next_publish(self):
        self.publish("a" * 40)
        self.runtime.crash = True
        with self.assertRaises(KeyboardInterrupt):
            self.publish("b" * 40)
        self.assertEqual(receiver.current(self.deploy_root), "b" * 40)
        self.publish("c" * 40)
        self.assertIn("health:" + "a" * 40, self.runtime.actions[-12:])
        self.assert_generation("c" * 40)

    def test_no_existing_generation_failure_stops_units(self):
        self.runtime.fail_commit = "a" * 40
        with self.assertRaises(RuntimeError):
            self.publish("a" * 40)
        self.assertIsNone(receiver.current(self.deploy_root))
        self.assertIn("stop", self.runtime.actions)

    def test_adoption_and_incompatible_schema_require_explicit_commissioning(self):
        self.publish("a" * 40)
        self.runtime.action = "adopt"
        with self.assertRaises(ValueError):
            self.publish("b" * 40)
        self.runtime.action = "upgrade"
        self.runtime.compatible = False
        with self.assertRaises(ValueError):
            self.publish("b" * 40)
        self.assert_generation("a" * 40)

    def test_host_lock_blocks_concurrent_publication(self):
        with receiver.host_lock(self.deploy_root), self.assertRaises(BlockingIOError):
            self.publish("a" * 40)
        self.assertIsNone(receiver.current(self.deploy_root))

    def test_modified_generation_and_malicious_current_pointer_are_refused(self):
        self.publish("a" * 40)
        (self.deploy_root / "current/backend/app.py").write_text("changed")
        with self.assertRaises(ValueError):
            self.publish("a" * 40)
        (self.deploy_root / "current").unlink()
        (self.deploy_root / "current").symlink_to("../../outside")
        with self.assertRaises(ValueError):
            self.publish("b" * 40)

    def test_archive_rejects_traversal_links_duplicates_extra_roots_and_tampering(self):
        for name, kind in (
            ("../escape", tarfile.REGTYPE),
            ("backend/evil", tarfile.SYMTYPE),
            ("staging/index.html", tarfile.REGTYPE),
            ("backend/.env", tarfile.REGTYPE),
            ("backend/app.py", tarfile.REGTYPE),
        ):
            with self.subTest(name=name):
                output = self.root / "bad.tar.gz"
                metadata, files = self.artifact()
                with tarfile.open(output, "w:gz") as archive:
                    all_files = {"release.json": json.dumps(metadata).encode(), **files}
                    for path, content in all_files.items():
                        info = tarfile.TarInfo(path)
                        info.size = len(content)
                        archive.addfile(info, io.BytesIO(content))
                    info = tarfile.TarInfo(name)
                    info.type, info.linkname = kind, "../../outside"
                    info.size = 1 if kind == tarfile.REGTYPE else 0
                    archive.addfile(info, io.BytesIO(b"x") if info.size else None)
                with self.assertRaises(ValueError):
                    receiver.inspect_package(output, "production")
        self.assertFalse((self.root / "escape").exists())

    def test_other_unix_identity_cannot_read_backend_generations_or_aliases(self):
        available = subprocess.run(["sudo", "-n", "-u", "nobody", "id", "-u"], capture_output=True, timeout=5)
        if available.returncode:
            self.skipTest("independent Unix identity probe requires local operator permission")
        self.root.chmod(0o755)
        self.deploy_root.chmod(0o755)
        self.publish("a" * 40)
        self.publish("b" * 40)
        (self.deploy_root / "backend").symlink_to("current/backend")
        (self.deploy_root / "venv").symlink_to("current/.venv-backend")
        public = self.deploy_root / "public-fixture"
        public.write_text("public")
        self.assertEqual(
            subprocess.run(["sudo", "-n", "-u", "nobody", "test", "-r", str(public)]).returncode, 0
        )
        for path in (
            "backend/app.py",
            "venv/dependency-version",
            "current/backend/app.py",
            "current/.venv-backend/dependency-version",
            "releases/" + "a" * 40 + "/backend/app.py",
            "releases/" + "a" * 40 + "/.venv-backend/dependency-version",
        ):
            result = subprocess.run(
                ["sudo", "-n", "-u", "nobody", "test", "-r", str(self.deploy_root / path)]
            )
            self.assertNotEqual(result.returncode, 0, path)

    def test_each_target_rejects_another_consumers_artifact(self):
        import shutil

        product_metadata, _ = self.artifact(environment="staging")
        self.assertEqual({name.split("/")[0] for name in product_metadata["files"]}, {"backend"})
        for name in ("demo/index.html", "mock-api/app/main.py", "mock-api/requirements.txt"):
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fixture")
        with self.assertRaises(ValueError):
            self.artifact(environment="staging")
        with self.assertRaises(ValueError):
            self.artifact(environment="production")
        shutil.rmtree(self.source / "backend")
        _, files = self.artifact(environment="development")
        self.assertIn("demo/index.html", files)
        self.assertFalse(any(name.startswith("backend/") for name in files))
        with self.assertRaises(ValueError):
            receiver.inspect_package(self.root / (("a" * 40) + ".tar.gz"), "staging")

    def test_wrong_host_refuses_before_configuration_or_service_access(self):
        with patch.object(receiver.socket, "gethostname", return_value="rocoto-dev"):
            with self.assertRaisesRegex(ValueError, "exact configured target host"):
                receiver.commissioned_configuration("staging")
            with self.assertRaisesRegex(ValueError, "exact configured target host"):
                receiver.commissioned_configuration("production")

    def test_cutover_stops_consumers_before_switching_and_restarts_after(self):
        self.publish("a" * 40)
        original_stop, original_restart = self.runtime.stop, self.runtime.restart

        def stop():
            self.assertEqual(receiver.current(self.deploy_root), "a" * 40)
            original_stop()

        def restart():
            self.assertEqual(receiver.current(self.deploy_root), "b" * 40)
            original_restart()

        with (
            patch.object(self.runtime, "stop", side_effect=stop),
            patch.object(self.runtime, "restart", side_effect=restart),
        ):
            self.publish("b" * 40)

    def test_fixed_environment_and_unit_contracts_fail_closed(self):
        envfile = self.root / "product.env"
        envfile.write_text("ROCOTO_ENVIRONMENT=staging\nIS_PROD=false\nROCOTO_EGRESS_SANDBOX=1\n")
        envfile.chmod(0o600)
        config = {
            "environment": "staging",
            "root": str(self.root),
            "environmentFiles": [str(envfile)],
            "unitContracts": {"api": {"UnsetEnvironment": ""}},
        }
        with patch.object(receiver.Runtime, "assert_units"):
            receiver.Runtime(config)
            with envfile.open("a") as handle:
                handle.write("ROCOTO_EGRESS_SANDBOX=0\n")
            with self.assertRaises(ValueError):
                receiver.Runtime(config)
        with (
            patch.object(receiver.subprocess, "check_output", return_value="ROCOTO_EGRESS_SANDBOX"),
            self.assertRaises(ValueError),
        ):
            receiver.Runtime(config)


class IndependentConsumers(unittest.TestCase):
    def test_development_and_staging_publish_and_rollback_without_touching_each_other(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            stage, dev = root / "staging", root / "development"
            stage.mkdir()
            dev.mkdir()
            state = root / "private-demo-state"
            state.write_text("existing prototype state")
            product_db = root / "private-staging-state"
            product_db.write_text("existing maintained test account")
            runtimes = {"staging": FakeRuntime(), "development": FakeRuntime()}
            roots = {"staging": stage, "development": dev}

            def publish(environment, commit):
                source = root / (environment + "-source")
                source.mkdir(exist_ok=True)
                names = (
                    ["mock-api/app/main.py", "mock-api/requirements.txt", "demo/index.html"]
                    if environment == "development"
                    else [
                        "backend/app.py",
                        "backend/worker.py",
                        "backend/requirements.txt",
                        "backend/schema_migrations.py",
                    ]
                )
                for name in names:
                    path = source / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text("# source " + commit)
                artifact = root / (environment + ".tar.gz")
                packager.package(source, artifact, commit, environment)
                metadata, files = receiver.inspect_package(artifact, environment)
                return receiver.deploy(roots[environment], metadata, files, runtimes[environment])

            publish("staging", "a" * 40)
            publish("development", "a" * 40)
            stage_journal = (stage / "release-state.json").read_bytes()
            stage_actions = list(runtimes["staging"].actions)
            publish("development", "b" * 40)
            self.assertEqual((stage / "release-state.json").read_bytes(), stage_journal)
            self.assertEqual(runtimes["staging"].actions, stage_actions)
            self.assertEqual(receiver.current(stage), "a" * 40)
            self.assertFalse(
                set(runtimes["development"].actions) & {"preflight", "upgrade", "check", "backup"}
            )
            dev_journal = (dev / "release-state.json").read_bytes()
            dev_actions = list(runtimes["development"].actions)
            runtimes["staging"].fail_commit = "c" * 40
            with self.assertRaises(RuntimeError):
                publish("staging", "c" * 40)
            self.assertEqual(receiver.current(stage), "a" * 40)
            self.assertEqual(receiver.current(dev), "b" * 40)
            self.assertEqual((dev / "release-state.json").read_bytes(), dev_journal)
            self.assertEqual(runtimes["development"].actions, dev_actions)
            self.assertEqual(state.read_text(), "existing prototype state")
            self.assertEqual(product_db.read_text(), "existing maintained test account")

    def test_transport_scope_cannot_select_production_or_a_different_fixed_consumer(self):
        self.assertEqual(
            receiver.selected_command("environment", "publish development"), ("development", "publish")
        )
        self.assertEqual(
            receiver.selected_command("environment", "rollback staging"), ("staging", "rollback")
        )
        for target, command in (
            ("environment", "publish production"),
            ("environment", "publish"),
            ("staging", "publish development"),
            ("production", "publish staging"),
            ("environment", "publish development extra"),
            ("environment", "bash development"),
        ):
            with self.subTest(target=target, command=command), self.assertRaises(ValueError):
                receiver.selected_command(target, command)

    def test_installed_consumers_have_disjoint_generation_and_service_ownership(self):
        stage = json.loads((ROOT / "deploy/product/staging.json").read_text())
        dev = json.loads((ROOT / "deploy/product/development.json").read_text())
        self.assertNotEqual(stage["root"], dev["root"])
        self.assertFalse(set(stage["services"]) & set(dev["services"]))
        self.assertNotEqual(stage["environmentFiles"][0], dev["environmentFiles"][0])
        self.assertEqual(dev["services"], ["rocoto-kit-runtime"])
        self.assertEqual(stage["services"], ["rocoto-staging", "rocoto-staging-worker"])


class ProductReleaseAuthority(unittest.TestCase):
    def test_product_tags_use_existing_protected_namespace_and_distinct_human(self):
        spec = importlib.util.spec_from_file_location("product_guard", ROOT / "tools/release-guard.py")
        assert spec and spec.loader
        guard = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(guard)
        with tempfile.TemporaryDirectory() as temporary:
            event = Path(temporary) / "event.json"
            event.write_text(json.dumps({"sender": {"login": "owner", "type": "User"}}))
            env = {
                "ROCOTO_AGENT_LOGIN": "rocoto-agent",
                "ROCOTO_RELEASE_APPROVER": "owner",
                "GITHUB_ACTOR": "owner",
                "GITHUB_EVENT_PATH": str(event),
                "GITHUB_EVENT_NAME": "push",
                "GITHUB_REF": "refs/tags/vproduct-1.2.3",
            }
            with patch.dict(guard.os.environ, env, clear=True):
                self.assertEqual(guard.main(product=True), 0)
                self.assertEqual(guard.main(), 1)
                guard.os.environ["GITHUB_ACTOR"] = "rocoto-agent"
                self.assertEqual(guard.main(product=True), 1)
                guard.os.environ["GITHUB_ACTOR"] = "owner"
                guard.os.environ["GITHUB_REF"] = "refs/tags/v1.2.3"
                self.assertEqual(guard.main(product=True), 1)
            workflow = (ROOT / ".github/workflows/release.yml").read_text()
            self.assertIn('"!vproduct-*"', workflow)
            self.assertIn(
                'tags: ["vproduct-*"]', (ROOT / ".github/workflows/product-release.yml").read_text()
            )


if __name__ == "__main__":
    unittest.main()
