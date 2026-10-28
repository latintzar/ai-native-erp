"""A fresh installer process can compensate a power loss at each destructive activation phase."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from test_product_commissioning import installer


class PowerLoss(BaseException):
    pass


class RecoverableRuntime:
    def __init__(self, config, **kwargs):
        self.env = {}

    def assert_units(self):
        pass

    def restart(self):
        pass

    def healthy(self, commit):
        return True

    def stop(self):
        pass


@contextmanager
def installation(prior_sudoers=True):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        configs, systemd = root / "configs", root / "systemd"
        configs.mkdir()
        systemd.mkdir()
        commit = "a" * 40
        generation = root / "releases" / commit
        (generation / "backend").mkdir(parents=True)
        (generation / ".ready.json").write_text(
            json.dumps({"commit": commit, "environment": "production", "files": {}})
        )
        (configs / "production.json").write_text(
            json.dumps({"root": str(root), "environment": "production", "services": ["rocoto"]})
        )
        (root / "backend").mkdir()
        (root / "backend" / "preserved").write_text("old backend")
        (root / "old-venv").mkdir()
        (root / "venv").symlink_to("old-venv")
        previous_unit = b"[Service]\nExecStart=/preserved/old-service\n"
        (systemd / "rocoto.service").write_bytes(previous_unit)
        sudoers = root / "sudoers"
        if prior_sudoers:
            sudoers.write_bytes(b"previous scoped sudo policy\n")
        commands = []
        with (
            patch.object(installer, "ROOT_UID", os.geteuid()),
            patch.object(installer, "CONFIGS", configs),
            patch.object(installer, "SYSTEMD", systemd),
            patch.object(installer, "SUDOERS", sudoers),
            patch.object(installer, "Runtime", RecoverableRuntime),
            patch.object(installer, "command", side_effect=lambda *args: commands.append(args)),
            patch.object(installer.subprocess, "run", return_value=SimpleNamespace(returncode=0)),
            patch.object(installer.os, "chown"),
        ):
            yield root, commit, commands


class CrashRecovery(unittest.TestCase):
    def interrupt(self, step, action):
        save = installer.save_journal

        def checkpoint(state, actual):
            save(state, actual)
            if actual == step:
                raise PowerLoss(actual)

        with patch.object(installer, "save_journal", checkpoint), self.assertRaises(PowerLoss):
            action()

    def restored(self, root, commands, prior_sudoers):
        self.assertFalse((root / "backend").is_symlink())
        self.assertEqual((root / "backend/preserved").read_text(), "old backend")
        self.assertEqual(os.readlink(root / "venv"), "old-venv")
        self.assertFalse((root / "current").is_symlink())
        self.assertEqual(
            (root / "systemd/rocoto.service").read_bytes(), b"[Service]\nExecStart=/preserved/old-service\n"
        )
        if prior_sudoers:
            self.assertEqual((root / "sudoers").read_bytes(), b"previous scoped sudo policy\n")
        else:
            self.assertFalse((root / "sudoers").exists())
        state = json.loads(installer.journal_path("production").read_text())
        self.assertEqual(state["status"], "restored")
        self.assertEqual(state["recovery_failures"], [])
        self.assertIn(("systemctl", "restart", "rocoto"), commands)
        before = list(commands)
        installer.recover("production")
        self.assertEqual(commands, before)

    def test_recover_after_alias_move_pointer_switch_unit_and_sudoers_install(self):
        for step in (
            "alias-moved:backend",
            "alias-linked:venv",
            "current-switched",
            "unit-installed:rocoto",
            "sudoers-installed",
        ):
            for prior_sudoers in (False, True):
                with (
                    self.subTest(step=step, prior_sudoers=prior_sudoers),
                    installation(prior_sudoers) as data,
                ):
                    root, commit, commands = data
                    self.interrupt(step, lambda commit=commit: installer.activate("production", commit))
                    state = json.loads(installer.journal_path("production").read_text())
                    self.assertEqual(state["status"], "activating")
                    installer.recover("production")
                    self.restored(root, commands, prior_sudoers)

    def test_recovery_itself_can_resume_after_another_power_loss(self):
        with installation() as (root, commit, commands):
            self.interrupt(
                "sudoers-installed", lambda commit=commit: installer.activate("production", commit)
            )
            self.interrupt("recover:restore unit rocoto", lambda: installer.recover("production"))
            self.assertEqual(
                json.loads(installer.journal_path("production").read_text())["status"], "recoveryfailed"
            )
            installer.recover("production")
            self.restored(root, commands, True)

    def test_development_demo_custody_recovers_partial_chown_and_preserves_new_data(self):
        for partial in (False, True):
            with self.subTest(partial=partial), installation() as (root, commit, commands):
                configuration = {
                    "root": str(root),
                    "environment": "development",
                    "services": ["rocoto-kit-runtime"],
                }
                (installer.CONFIGS / "development.json").write_text(json.dumps(configuration))
                ready = root / "releases" / commit / ".ready.json"
                ready.write_text(json.dumps({"commit": commit, "environment": "development", "files": {}}))
                for service in configuration["services"]:
                    (installer.SYSTEMD / (service + ".service")).write_text("previous " + service)
                for name in ("kit-state", "kit-home"):
                    (root / name).mkdir(mode=0o700)
                data = root / "kit-state" / "state.json"
                data.write_text("preserved data")
                data.chmod(0o640)
                external = root / "external.txt"
                external.write_text("outside custody")
                (root / "kit-home" / "link").symlink_to(external)
                previous = {
                    str(path): (info.st_uid, info.st_gid, info.st_mode & 0o7777)
                    for path, info in installer.custody_nodes(root)
                }
                demo_uid, demo_gid = os.getuid() + 10000, os.getgid() + 10000
                changes = []
                assigned = []

                def chown(
                    path,
                    uid,
                    gid,
                    *,
                    changes=changes,
                    demo_uid=demo_uid,
                    assigned=assigned,
                    partial=partial,
                    **options,
                ):
                    changes.append((str(path), uid, gid, options))
                    if uid == demo_uid:
                        self.assertIn(("systemctl", "stop", "rocoto-kit-runtime"), commands)
                        self.assertFalse(options.get("follow_symlinks", True))
                        assigned.append(str(path))
                        if partial and len(assigned) == 2:
                            raise PowerLoss("during recursive custody change")

                with (
                    patch.object(installer, "DEMO", root / "demo"),
                    patch.object(installer, "DEMO_OWNER_ROOT", root),
                    patch("pwd.getpwnam", return_value=SimpleNamespace(pw_uid=demo_uid, pw_gid=demo_gid)),
                    patch.object(installer.os, "chown", side_effect=chown),
                ):
                    if partial:
                        with self.assertRaises(PowerLoss):
                            installer.activate("development", commit)
                    else:
                        self.interrupt(
                            "demo-custody-assigned", lambda: installer.activate("development", commit)
                        )
                    data.chmod(0o777)
                    created = root / "kit-state" / "new.json"
                    created.write_text("new data retained")
                    installer.recover("development")
                    self.assertEqual(data.read_text(), "preserved data")
                    self.assertEqual(data.stat().st_mode & 0o7777, 0o640)
                    self.assertEqual(created.read_text(), "new data retained")
                    self.assertEqual(external.read_text(), "outside custody")
                    self.assertFalse(any(path == str(external) for path, *_rest in changes))
                    for path, (uid, gid, mode) in previous.items():
                        last = [change for change in changes if change[0] == path][-1]
                        self.assertEqual(last[1:3], (uid, gid))
                        self.assertFalse(last[3].get("follow_symlinks", True))
                        if not Path(path).is_symlink():
                            self.assertEqual(Path(path).stat().st_mode & 0o7777, mode)
                    self.assertIn(("systemctl", "restart", "rocoto-kit-runtime"), commands)
                    self.assertEqual(
                        json.loads(installer.journal_path("development").read_text())["status"], "restored"
                    )

    def test_recovery_refuses_a_journal_with_an_unrelated_alias(self):
        with installation() as (root, commit, commands):
            self.interrupt("current-switched", lambda commit=commit: installer.activate("production", commit))
            path = installer.journal_path("production")
            state = json.loads(path.read_text())
            state["aliases"][str(root / "backend")]["saved"] = "/unrelated/backend"
            path.write_text(json.dumps(state))
            before = list(commands)
            with self.assertRaisesRegex(ValueError, "alias recovery path"):
                installer.recover("production")
            self.assertEqual(commands, before)

    def test_recovery_refuses_writable_or_symlinked_authority(self):
        for damage in ("writable", "symlink"):
            with self.subTest(damage=damage), installation() as (root, commit, commands):
                self.interrupt(
                    "current-switched", lambda commit=commit: installer.activate("production", commit)
                )
                path = installer.journal_path("production")
                if damage == "writable":
                    path.chmod(0o666)
                else:
                    moved = path.with_suffix(".moved")
                    path.rename(moved)
                    path.symlink_to(moved)
                before = list(commands)
                with self.assertRaisesRegex(ValueError, "root-custodied"):
                    installer.recover("production")
                self.assertEqual(commands, before)


if __name__ == "__main__":
    unittest.main()
