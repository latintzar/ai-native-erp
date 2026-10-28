"""Real age + PostgreSQL round trips on a networkless, disposable cluster; no provider credentials."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time
import unittest
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKUP = ROOT / "deploy" / "backup"
CORE = ["event", "fact", "card", "contact", "scope_node", "open_loop", "timer", "manifest_duty", "endpoint"]


class TestEncryptedBackup(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        for program in ("docker", "age", "age-keygen", "flock"):
            if not shutil.which(program):
                raise unittest.SkipTest(f"encrypted roundtrip requires {program}")
        probe = subprocess.run(["docker", "info"], capture_output=True, timeout=20)
        if probe.returncode:
            raise unittest.SkipTest("encrypted roundtrip requires a local Docker engine")
        cls.container = "rocoto-backup-test-" + uuid.uuid4().hex[:12]
        cls.addClassCleanup(
            lambda: subprocess.run(["docker", "rm", "-fv", cls.container], capture_output=True, timeout=30)
        )
        subprocess.run(
            [
                "docker",
                "run",
                "--pull=never",
                "-d",
                "--name",
                cls.container,
                "--network",
                "none",
                "--label",
                "com.rocoto.purpose=backup-test",
                "-e",
                "POSTGRES_HOST_AUTH_METHOD=trust",
                "pgvector/pgvector:pg16",
            ],
            check=True,
            capture_output=True,
            timeout=40,
        )
        for _ in range(60):
            # The entrypoint's temporary initialization server accepts Unix-socket reads before
            # it shuts down. TCP becomes ready when the final server can keep this test's DB.
            if cls.pg("pg_isready", "-h", "127.0.0.1", "-U", "postgres").returncode == 0:
                break
            time.sleep(0.2)
        else:
            raise RuntimeError("disposable PostgreSQL did not start")
        cls.pg("createdb", "-U", "postgres", "synthetic_source").check_returncode()
        sql = " ".join(f"CREATE TABLE {table}(id integer PRIMARY KEY, value text);" for table in CORE)
        sql += " INSERT INTO event VALUES(1, 'synthetic-sensitive-backup-row');"
        cls.pg("psql", "-U", "postgres", "-d", "synthetic_source", "-c", sql).check_returncode()

    @classmethod
    def pg(cls, *args):
        return subprocess.run(
            ["docker", "exec", cls.container, *args], capture_output=True, text=True, timeout=30
        )

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="rocoto-backup-test-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.bin = self.base / "bin"
        self.bin.mkdir()
        self.identity = self.base / "identity"
        subprocess.run(["age-keygen", "-o", str(self.identity)], check=True, capture_output=True)
        self.identity.chmod(0o600)
        self.recipients = self.base / "recipients"
        public = subprocess.run(
            ["age-keygen", "-y", str(self.identity)], check=True, capture_output=True
        ).stdout
        self.recipients.write_bytes(public)
        self.env = {
            **os.environ,
            "PATH": str(self.bin) + os.pathsep + os.environ["PATH"],
            "ROCOTO_BACKUP_PG_MODE": "direct",
            "ROCOTO_DB": "synthetic_source",
            "ROCOTO_BACKUP_RECIPIENTS_FILE": str(self.recipients),
            "ROCOTO_BACKUP_IDENTITY_FILE": str(self.identity),
            "ROCOTO_BACKUP_DIR": str(self.base / "backups"),
            "ROCOTO_OFFBOX_DIR": str(self.base / "offbox"),
        }
        # Transport adapters execute the actual PostgreSQL tools inside our owned, networkless cluster.
        for program in ("pg_dump", "pg_restore", "createdb", "dropdb", "psql"):
            path = self.bin / program
            path.write_text(
                "#!/usr/bin/env python3\nimport os, sys\n"
                f"os.execvp('docker', ['docker','exec','-i',{self.container!r},{program!r},'-U','postgres']"
                " + sys.argv[1:])\n"
            )
            path.chmod(0o700)

    def run_script(self, name, *args, env=None):
        return subprocess.run(
            ["bash", str(BACKUP / name), *map(str, args)],
            env=env or self.env,
            capture_output=True,
            text=True,
            timeout=90,
        )

    def backup(self):
        result = self.run_script("rocoto_backup.sh")
        self.assertEqual(result.returncode, 0, result.stderr)
        return self.base / "backups" / "LATEST.dump.age"

    def assert_source_and_scratch(self):
        query = self.pg(
            "psql", "-U", "postgres", "-d", "synthetic_source", "-tAc", "SELECT value FROM event WHERE id=1"
        )
        self.assertEqual(query.stdout.strip(), "synthetic-sensitive-backup-row")
        scratch = self.pg(
            "psql",
            "-U",
            "postgres",
            "-tAc",
            "SELECT count(*) FROM pg_database WHERE datname LIKE 'rocoto_restore_%'",
        )
        self.assertEqual(scratch.stdout.strip(), "0")

    def test_encrypted_producer_and_real_restore_keep_source_intact(self):
        artifact = self.backup()
        encrypted = artifact.read_bytes()
        self.assertTrue(encrypted.startswith(b"age-encryption.org/v1\n"))
        self.assertNotIn(b"PGDMP", encrypted)
        self.assertNotIn(b"synthetic-sensitive-backup-row", encrypted)
        self.assertEqual(artifact.stat().st_mode & 0o777, 0o600)
        result = self.run_script("restore_drill.sh", artifact)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("RESTORE-DRILL PASS", result.stdout)
        self.assert_source_and_scratch()
        self.assertFalse(list((self.base / "backups").glob("*.dump")))
        self.assertFalse(list((self.base / "backups").glob("*.partial")))

    def test_missing_or_invalid_recipient_fails_before_database_read(self):
        (self.bin / "pg_dump").write_text('#!/bin/sh\ntouch "$ROCOTO_BACKUP_DIR-read"\nexit 1\n')
        for value in ("", "invalid-recipient\n"):
            self.recipients.write_text(value)
            result = self.run_script("rocoto_backup.sh")
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(Path(self.env["ROCOTO_BACKUP_DIR"] + "-read").exists())
            self.assertFalse((self.base / "backups").exists())

    def test_dump_failure_preserves_previous_backup_and_removes_partial(self):
        previous = self.backup().resolve()
        (self.bin / "pg_dump").write_text("#!/bin/sh\nprintf partial-data\nexit 1\n")
        result = self.run_script("rocoto_backup.sh")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.base / "backups" / "LATEST.dump.age").resolve(), previous)
        self.assertFalse(list((self.base / "backups").glob("*.partial")))

    def test_wrong_identity_and_corrupt_ciphertext_fail_and_clean_scratch(self):
        artifact = self.backup()
        other = self.base / "other-identity"
        subprocess.run(["age-keygen", "-o", str(other)], check=True, capture_output=True)
        other.chmod(0o600)
        result = self.run_script(
            "restore_drill.sh", artifact, env={**self.env, "ROCOTO_BACKUP_IDENTITY_FILE": str(other)}
        )
        self.assertNotEqual(result.returncode, 0)
        self.assert_source_and_scratch()
        encrypted = artifact.read_bytes()
        artifact.write_bytes(encrypted[:-30])
        result = self.run_script("restore_drill.sh", artifact)
        self.assertNotEqual(result.returncode, 0)
        self.assert_source_and_scratch()

    def test_offbox_transport_receives_encryption_from_producer(self):
        transport = self.bin / "ssh"
        transport.write_text(
            "#!/usr/bin/env python3\nimport os, sys\n"
            "if sys.argv[-1].endswith('rocoto_backup.sh --stream'):\n"
            f"    os.execvp('bash', ['bash', {str(BACKUP / 'rocoto_backup.sh')!r}, '--stream'])\n"
            "sys.exit(0)\n"
        )
        transport.chmod(0o700)
        result = self.run_script("rocoto_backup_pull.sh")
        self.assertEqual(result.returncode, 0, result.stderr)
        artifact = self.base / "offbox" / "LATEST.dump.age"
        restored = self.run_script("restore_drill.sh", artifact)
        self.assertEqual(restored.returncode, 0, restored.stderr)
        self.assert_source_and_scratch()
        # A stale/old producer returning plaintext is refused and the prior recovery point survives.
        previous = artifact.resolve()
        transport.write_text("#!/bin/sh\nprintf 'PGDMP-plaintext'\n")
        result = self.run_script("rocoto_backup_pull.sh")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(artifact.resolve(), previous)
        self.assertFalse(list((self.base / "offbox").glob("*.partial")))


if __name__ == "__main__":
    unittest.main()
