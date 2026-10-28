"""Commissioned units survive reboot, recover exact enablement, and retain deploy-owned journals."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import test_product_commissioning_crash as crash
from test_product_commissioning import ROOT, installer


class CommissioningPersistence(unittest.TestCase):
    def test_native_enablement_and_interrupted_recovery_preserve_previous_links(self):
        real_run = subprocess.run
        for previously_enabled in (False, True):
            for interrupted in (False, True):
                with (
                    self.subTest(enabled=previously_enabled, interrupted=interrupted),
                    crash.installation() as data,
                ):
                    root, commit, commands = data
                    systemd = root / "etc/systemd/system"
                    systemd.mkdir(parents=True)
                    runtime_systemd = root / "run/systemd/system"
                    runtime_systemd.mkdir(parents=True)
                    old = installer.SYSTEMD / "rocoto.service"
                    (systemd / old.name).write_bytes(old.read_bytes())
                    if previously_enabled:
                        wants = systemd / "custom.target.wants"
                        wants.mkdir()
                        (wants / old.name).symlink_to("../rocoto.service")
                        runtime_wants = runtime_systemd / "temporary.target.wants"
                        runtime_wants.mkdir()
                        (runtime_wants / old.name).symlink_to(systemd / old.name)

                    def command(*arguments, commands=commands, root=root):
                        commands.append(arguments)
                        if arguments[:2] == ("systemctl", "enable"):
                            real_run(
                                ["systemctl", "--root", str(root), "enable", arguments[2]],
                                check=True,
                                capture_output=True,
                            )

                    with (
                        patch.object(installer, "SYSTEMD", systemd),
                        patch.object(installer, "RUNTIME_SYSTEMD", runtime_systemd),
                        patch.object(installer, "command", side_effect=command),
                    ):
                        previous = installer.capture_enablement(["rocoto"])
                        if interrupted:
                            crash.CrashRecovery().interrupt(
                                "unit-enabled:rocoto",
                                lambda commit=commit: installer.activate("production", commit),
                            )
                            self.assertTrue((systemd / "multi-user.target.wants/rocoto.service").is_symlink())
                            crash.CrashRecovery().interrupt(
                                "recover:restore unit enablement", lambda: installer.recover("production")
                            )
                            installer.recover("production")
                            self.assertEqual(installer.capture_enablement(["rocoto"]), previous)
                        else:
                            installer.activate("production", commit)
                            enabled = real_run(
                                ["systemctl", "--root", str(root), "is-enabled", "rocoto"],
                                capture_output=True,
                                text=True,
                            )
                            self.assertEqual(enabled.returncode, 0, enabled.stderr)
                            self.assertEqual(enabled.stdout.strip(), "enabled")
                            state = json.loads(installer.journal_path("production").read_text())
                            self.assertEqual(state["enablement"], previous)
                            self.assertEqual(state["status"], "active")

    def test_root_written_operational_state_is_readable_and_rewritable_by_deploy_uid(self):
        if os.geteuid() == 0:
            import pwd

            actor = pwd.getpwnam("nobody")
            prefix = []
            actor_command = ["runuser", "-u", "nobody", "--"]
        else:
            if (
                not shutil.which("sudo")
                or subprocess.run(["sudo", "-n", "true"], capture_output=True).returncode
            ):
                self.skipTest("root writer proof requires sudo or root")
            actor = type("Identity", (), {"pw_uid": os.getuid(), "pw_gid": os.getgid()})()
            prefix = ["sudo", "-n"]
            actor_command = []
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            if os.geteuid() == 0:
                os.chown(root, actor.pw_uid, actor.pw_gid)
            # Reproduce the former root writer: the actual deployment UID cannot read its 0600 journal.
            legacy_script = (
                "import sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);"
                "from receive import write_json;"
                "write_json(Path(sys.argv[2])/'release-state.json',{'status':'active'})"
            )
            result = subprocess.run(
                [*prefix, sys.executable, "-c", legacy_script, str(ROOT / "deploy/product"), str(root)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            denied = subprocess.run(
                [
                    *actor_command,
                    sys.executable,
                    "-c",
                    "import sys;open(sys.argv[1]).read()",
                    str(root / "release-state.json"),
                ],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(denied.returncode, 0)
            self.assertIn("PermissionError", denied.stderr)
            # Only the bounded writer runs as root; it neither loads target config nor touches services.
            script = (
                "import sys,importlib.util;from pathlib import Path;"
                "sys.path.insert(0,sys.argv[1]);"
                "spec=importlib.util.spec_from_file_location('installer',Path(sys.argv[1])/'install.py');"
                "m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);"
                "m.write_release_state(Path(sys.argv[2]),{'status':'active'})"
            )
            result = subprocess.run(
                [*prefix, sys.executable, "-c", script, str(ROOT / "deploy/product"), str(root)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            state = root / "release-state.json"
            self.assertEqual(state.stat().st_uid, actor.pw_uid)
            self.assertEqual(state.stat().st_gid, actor.pw_gid)
            self.assertEqual(state.stat().st_mode & 0o777, 0o600)
            actor_script = (
                "import sys,json;from pathlib import Path;sys.path.insert(0,sys.argv[1]);"
                "from receive import write_json;root=Path(sys.argv[2]);"
                "assert json.loads((root/'release-state.json').read_text())['status']=='active';"
                "write_json(root/'release-state.json',{'status':'rolled-back'})"
            )
            result = subprocess.run(
                [*actor_command, sys.executable, "-c", actor_script, str(ROOT / "deploy/product"), str(root)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(state.read_text())["status"], "rolled-back")

    def test_operational_snapshot_restore_preserves_original_custody(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            state, snapshots = root / "release-state.json", root / "snapshots"
            snapshots.mkdir(mode=0o700)
            state.write_text('{"status":"active"}')
            state.chmod(0o600)
            with (
                patch.object(installer, "ROOT_UID", os.getuid()),
                patch.object(installer.os, "chown") as chown,
            ):
                record = installer.snapshot(state, snapshots, "previous-release-state")
                installer.restore_snapshot(state, snapshots, record, preserve_owner=True)
            self.assertEqual(chown.call_args.args[1:], (record["uid"], record["gid"]))
            self.assertEqual(state.stat().st_mode & 0o777, 0o600)


if __name__ == "__main__":
    unittest.main()
