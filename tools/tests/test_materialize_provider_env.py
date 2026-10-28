"""Security boundaries for 1Password-backed development provider environments."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools/materialize-provider-env.py"


class ProviderEnvironment(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.public = self.root / "consumer.env.public"
        self.references = self.root / "consumer.env.refs"
        self.public.write_text("PUBLIC_ORIGIN=https://preview.example\nAPP_ID=123\n")
        self.references.write_text(
            "APP_SECRET=op://company/preview/app-secret\n"
            "ACCESS_CODE=op://company/preview/access-code\n"
        )

    def run_tool(
        self, *arguments: str, env: dict[str, str] | None = None
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(TOOL), "--public", str(self.public),
             "--references", str(self.references), *arguments],
            text=True,
            capture_output=True,
            timeout=10,
            env=env,
        )

    def test_check_reports_counts_without_references(self) -> None:
        result = self.run_tool("--check")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "provider environment: 4 names, 2 private references\n")
        self.assertNotIn("company/preview", result.stdout + result.stderr)

    def test_private_literal_and_private_public_name_are_refused(self) -> None:
        for path, content in (
            (self.references, "APP_SECRET=a-literal-secret\n"),
            (self.public, "APP_SECRET=a-literal-secret\n"),
        ):
            with self.subTest(path=path.name):
                original = path.read_text()
                path.write_text(content)
                result = self.run_tool("--check")
                path.write_text(original)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("APP_SECRET", result.stderr)
                self.assertNotIn("a-literal-secret", result.stdout + result.stderr)

    def test_authenticated_public_url_is_refused_without_echoing_credentials(self) -> None:
        self.public.write_text("DATABASE_URL=postgresql://user:private-value@database.test/app\n")
        result = self.run_tool("--check")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DATABASE_URL", result.stderr)
        self.assertNotIn("private-value", result.stdout + result.stderr)

    def test_placeholders_duplicates_and_partial_references_are_refused(self) -> None:
        invalid = (
            "APP_SECRET=op://<vault>/<item>/app-secret\n",
            "APP_SECRET=op://company/item/one\nAPP_SECRET=op://company/item/two\n",
            "APP_SECRET=prefix-op://company/item/secret\n",
        )
        for content in invalid:
            with self.subTest(content=content.splitlines()[0]):
                self.references.write_text(content)
                result = self.run_tool("--check")
                self.assertNotEqual(result.returncode, 0)

        self.public.write_text("APP_SECRET=public-value\n")
        self.references.write_text("APP_SECRET=op://company/item/secret\n")
        result = self.run_tool("--check")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("repeats APP_SECRET", result.stderr)

    def fake_op(self, body: str) -> Path:
        op = self.root / "op"
        op.write_text(f"#!{sys.executable}\n{body}")
        op.chmod(0o755)
        return op

    def test_materialization_quotes_values_and_limits_op_environment(self) -> None:
        captured = self.root / "op-environment"
        op = self.fake_op(
            "import os, pathlib, sys\n"
            f"pathlib.Path({str(captured)!r}).write_text('\\n'.join(sorted(os.environ)))\n"
            "reference = sys.stdin.read()\n"
            "values = {'{{ op://company/preview/app-secret }}': 'private a\\\\path\"', "
            "'{{ op://company/preview/access-code }}': 'private-b'}\n"
            "sys.stdout.write(values[reference])\n"
        )
        target = self.root / "runtime.env"
        target.write_text("OLD=preserved-until-success\n")
        target.chmod(0o600)
        environment = {
            **os.environ,
            "UNRELATED_APP_SECRET": "must-not-pass",
            "OP_SERVICE_ACCOUNT_TOKEN": "fixture",
        }
        result = self.run_tool("--output", str(target), "--op-binary", str(op), env=environment)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(target.stat().st_mode & 0o777, 0o600)
        self.assertIn('APP_SECRET="private a\\\\path\\\""', target.read_text())
        self.assertNotIn("private a", result.stdout + result.stderr)
        passed_names = captured.read_text().splitlines()
        self.assertIn("OP_SERVICE_ACCOUNT_TOKEN", passed_names)
        self.assertNotIn("UNRELATED_APP_SECRET", passed_names)

    def test_materialized_escaping_round_trips_through_systemd(self) -> None:
        try:
            user_bus_available = Path(f"/run/user/{os.getuid()}/bus").exists()
        except OSError:
            user_bus_available = False
        if shutil.which("systemd-run") is None or not user_bus_available:
            self.skipTest("systemd user manager unavailable")
        op = self.fake_op(
            "import sys\n"
            "reference = sys.stdin.read()\n"
            "values = {'{{ op://company/preview/app-secret }}': 'private a\\\\path\"', "
            "'{{ op://company/preview/access-code }}': 'private-b'}\n"
            "sys.stdout.write(values[reference])\n"
        )
        target = self.root / "runtime.env"
        result = self.run_tool("--output", str(target), "--op-binary", str(op))
        self.assertEqual(result.returncode, 0, result.stderr)
        verification = subprocess.run(
            [
                "systemd-run",
                "--user",
                "--wait",
                "--collect",
                "--pipe",
                "-p",
                "Type=exec",
                "-p",
                f"EnvironmentFile={target}",
                sys.executable,
                "-c",
                (
                    "import os,sys; expected={'APP_SECRET':'private a\\\\path\"',"
                    "'ACCESS_CODE':'private-b'}; "
                    "sys.exit(any(os.environ.get(k) != v for k,v in expected.items()))"
                ),
            ],
            text=True,
            capture_output=True,
            timeout=10,
        )
        self.assertEqual(verification.returncode, 0, verification.stderr)

    def test_native_inject_stdout_terminator_is_not_part_of_the_secret(self) -> None:
        op = self.fake_op("import sys\nsys.stdout.write('fixture-value\\n')\n")
        target = self.root / "runtime.env"
        result = self.run_tool("--output", str(target), "--op-binary", str(op))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('APP_SECRET="fixture-value"\n', target.read_text())
        self.assertNotIn("fixture-value", result.stdout + result.stderr)

    def test_unsafe_existing_output_and_symlink_are_refused_before_injection(self) -> None:
        marker = self.root / "op-ran"
        op = self.fake_op(f"import pathlib\npathlib.Path({str(marker)!r}).touch()\n")
        target = self.root / "runtime.env"
        target.write_text("OLD=world-readable\n")
        target.chmod(0o644)
        result = self.run_tool("--output", str(target), "--op-binary", str(op))
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(marker.exists())
        target.unlink()
        target.symlink_to(self.root / "elsewhere")
        result = self.run_tool("--output", str(target), "--op-binary", str(op))
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(marker.exists())

    def test_provider_failure_or_multiline_value_preserves_output_without_details(self) -> None:
        target = self.root / "runtime.env"
        target.write_text("OLD=still-here\n")
        target.chmod(0o600)
        programs = (
            "import sys\nprint('private-provider-detail', file=sys.stderr)\nsys.exit(9)\n",
            "import sys\nsys.stdout.write('private-first\\nprivate-second')\n",
        )
        for body in programs:
            with self.subTest(body=body.splitlines()[1]):
                op = self.fake_op(body)
                result = self.run_tool("--output", str(target), "--op-binary", str(op))
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(target.read_text(), "OLD=still-here\n")
                self.assertNotIn("private-", result.stdout + result.stderr)
                self.assertNotIn("op://", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
