"""An actual unprivileged identity traverses config parents while private siblings stay private."""

from __future__ import annotations

import json
import os
import pwd
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from test_product_commissioning import ROOT


class ConfigTraversal(unittest.TestCase):
    def test_private_parent_acl_preserves_other_access_and_only_exposes_public_child(self):
        if not all(shutil.which(name) for name in ("getfacl", "setfacl", "runuser")):
            self.skipTest("native ACL tools and runuser required")
        prefix = [] if os.geteuid() == 0 else ["sudo", "-n"]
        if prefix and (
            not shutil.which("sudo") or subprocess.run([*prefix, "true"], capture_output=True).returncode
        ):
            self.skipTest("native root/identity proof requires root or sudo")
        actor = pwd.getpwnam("nobody")
        other = pwd.getpwnam("daemon")
        script = r"""
import json, os, sys
from pathlib import Path
root = Path(sys.argv[1]); root.mkdir(mode=0o750)
public = root / 'releases'; public.mkdir(mode=0o755)
(public / 'development.json').write_text('{"environment":"development"}')
(public / 'development.json').chmod(0o644)
secret = root / 'private.env'; secret.write_text('private fixture'); secret.chmod(0o600)
"""
        apply_script = (
            "import sys,importlib.util;from pathlib import Path;sys.path.insert(0,sys.argv[1]);"
            "spec=importlib.util.spec_from_file_location('installer',Path(sys.argv[1])/'install.py');"
            "m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);"
            "m.grant_config_traversal(Path(sys.argv[2]),'nobody')"
        )
        for masked in (False, True):
            with self.subTest(masked=masked), tempfile.TemporaryDirectory() as temporary:
                outer = Path(temporary)
                outer.chmod(0o755)
                root = outer / "company"

                def privileged(*args):
                    result = subprocess.run([*prefix, *args], capture_output=True, text=True)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    return result.stdout

                def as_actor(*args, account="nobody"):
                    return subprocess.run(
                        [*prefix, "runuser", "-u", account, "--", *args], capture_output=True, text=True
                    )

                try:
                    privileged(sys.executable, "-c", script, str(root))
                    if masked:
                        # Preserve a named user's masked execute bit without accidentally granting it.
                        privileged("setfacl", "--no-mask", "-m", f"u:{other.pw_uid}:r-x,m::r--", str(root))
                    before = privileged("getfacl", "-cpn", str(root))
                    denied = as_actor("cat", str(root / "releases/development.json"))
                    self.assertNotEqual(denied.returncode, 0)
                    privileged(sys.executable, "-c", apply_script, str(ROOT / "deploy/product"), str(root))
                    allowed = as_actor("cat", str(root / "releases/development.json"))
                    self.assertEqual(allowed.returncode, 0, allowed.stderr)
                    self.assertEqual(json.loads(allowed.stdout), {"environment": "development"})
                    self.assertNotEqual(as_actor("ls", str(root)).returncode, 0)
                    self.assertNotEqual(as_actor("cat", str(root / "private.env")).returncode, 0)
                    self.assertNotEqual(as_actor("touch", str(root / "added-file")).returncode, 0)
                    self.assertNotEqual(
                        as_actor("cat", str(root / "releases/development.json"), account="daemon").returncode,
                        0,
                    )
                    after = privileged("getfacl", "-cpn", str(root))
                    self.assertIn(f"user:{actor.pw_uid}:--x", after)
                    self.assertIn("user::rwx", after)
                    self.assertIn("other::---", after)
                    if masked:
                        self.assertIn(f"user:{other.pw_uid}:r--", after)
                        self.assertIn("group::r--", after)
                    else:
                        # Every pre-existing entry remains byte-identical on the actual 0750 host case.
                        for line in before.splitlines():
                            if line:
                                self.assertIn(line, after)
                    privileged(sys.executable, "-c", apply_script, str(ROOT / "deploy/product"), str(root))
                    self.assertEqual(privileged("getfacl", "-cpn", str(root)), after)
                    self.assertEqual(
                        privileged("stat", "-c", "%a:%u", str(root / "private.env")).strip(), "600:0"
                    )
                finally:
                    # Every privileged mutation is confined to this test-owned temporary directory.
                    privileged("rm", "-rf", str(root))


if __name__ == "__main__":
    unittest.main()
