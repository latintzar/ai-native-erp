"""The optional Medusa purge restores through its selected checkout and database."""

from __future__ import annotations

import asyncio
import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

SCRIPT = Path(__file__).resolve().parents[2] / "backend/tests/test_seed_reset.py"


class MedusaSeedRestore(unittest.TestCase):
    def setUp(self) -> None:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.source = Path(temp.name)
        self.executable = self.source / "node_modules/.bin/medusa"
        self.executable.parent.mkdir(parents=True)
        self.executable.write_text("#!/bin/sh\nexit 1\n")
        self.executable.chmod(0o755)
        seed = self.source / "src/scripts/import-seed-catalogue.ts"
        seed.parent.mkdir(parents=True)
        seed.write_text("// Fixture: the process is mocked.\n")
        self.dsn = "postgresql://fixture@medusa-sandbox.test/medusa_test"
        self.client = SimpleNamespace(
            create_order=AsyncMock(return_value={"id": "fixture-order"}),
            purge_seeded=AsyncMock(return_value={"orders": 1}),
            find_order=AsyncMock(return_value=None), aclose=AsyncMock(),
        )
        connection = SimpleNamespace(fetchval=AsyncMock(return_value=1), close=AsyncMock())
        self.connect = AsyncMock(return_value=connection)
        stubs = {
            "gatelib": SimpleNamespace(setup_env=Mock(), medusa_up=Mock(return_value=True)),
            "config": SimpleNamespace(MEDUSA_SYNC_ENABLED=True),
            "brain": SimpleNamespace(
                medusa_client=SimpleNamespace(get_client=Mock(return_value=self.client)),
                medusa_map=SimpleNamespace(build_create_order_payload=lambda order: order),
                seed=SimpleNamespace(),
            ),
            "asyncpg": SimpleNamespace(connect=self.connect),
        }
        for replacement in (
            patch.dict(sys.modules, stubs), patch.object(sys, "path", sys.path.copy()),
            patch.dict(os.environ, {
                "DATABASE_URL": "postgresql://fixture@rocoto-wall.test/runtime",
                "MEDUSA_TEST_DATABASE_URL": self.dsn,
                "MEDUSA_TEST_SOURCE_DIR": str(self.source),
            }, clear=True),
        ):
            replacement.start()
            self.addCleanup(replacement.stop)
        spec = importlib.util.spec_from_file_location("medusa_seed_reset", SCRIPT)
        assert spec and spec.loader
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        process = patch.object(self.module.subprocess, "run")
        self.process = process.start()
        self.addCleanup(process.stop)

    def test_restore_uses_the_installed_cli(self) -> None:
        asyncio.run(self.module._medusa_side())
        self.process.assert_called_once()
        command = self.process.call_args
        self.assertEqual(command.args[0][0], str(self.executable))
        self.assertEqual(Path(command.kwargs["cwd"]), self.source)
        self.assertTrue(command.kwargs["check"])

    def test_restore_process_uses_the_selected_medusa_database(self) -> None:
        asyncio.run(self.module._medusa_side())
        self.process.assert_called_once()
        self.assertEqual(self.process.call_args.kwargs.get("env", {}).get("DATABASE_URL"), self.dsn)
        self.connect.assert_awaited_once_with(self.dsn)

    def test_missing_or_nonexecutable_cli_fails_before_creating_or_purging_orders(self) -> None:
        for missing in (False, True):
            with self.subTest(missing=missing):
                if missing:
                    self.executable.unlink()
                else:
                    self.executable.chmod(0o644)
                with self.assertRaisesRegex(RuntimeError, "node_modules/.bin/medusa"):
                    asyncio.run(self.module._medusa_side())
                self.client.create_order.assert_not_awaited()
                self.client.purge_seeded.assert_not_awaited()
                self.process.assert_not_called()
                self.connect.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
