"""Local backend tests use an explicitly selected disposable Medusa service."""

from __future__ import annotations

import asyncio
import importlib.util
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("medusa_test_gatelib", ROOT / "backend/tests/gatelib.py")
assert SPEC and SPEC.loader
GATELIB = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATELIB)


class MedusaTestConfiguration(unittest.TestCase):
    def test_default_setup_uses_neither_checkout_secrets_nor_running_services(self) -> None:
        with patch.dict(os.environ, {}, clear=True), \
                patch.object(GATELIB.os.path, "exists", return_value=True), \
                patch("builtins.open", side_effect=AssertionError("reading another checkout")), \
                patch.object(GATELIB.socket, "create_connection") as connect:
            GATELIB.setup_env()
            self.assertEqual(os.environ["MEDUSA_SYNC_ENABLED"], "false")
            connect.assert_not_called()

    def test_inherited_runtime_configuration_does_not_enable_integration_tests(self) -> None:
        with patch.dict(os.environ, {"MEDUSA_SYNC_ENABLED": "true"}, clear=True), \
                patch.object(GATELIB.socket, "create_connection") as connect:
            GATELIB.setup_env()
            self.assertEqual(os.environ["MEDUSA_SYNC_ENABLED"], "false")
            self.assertFalse(GATELIB.medusa_up())
            connect.assert_not_called()

    def test_explicit_test_url_selects_the_runtime_and_connection(self) -> None:
        url = "http://medusa-sandbox.test:19000"
        with patch.dict(os.environ, {"MEDUSA_TEST_URL": url}, clear=True), \
                patch.object(GATELIB.socket, "create_connection") as connect:
            GATELIB.setup_env()
            self.assertEqual(os.environ["MEDUSA_BASE_URL"], url)
            self.assertEqual(os.environ["MEDUSA_SYNC_ENABLED"], "true")
            self.assertTrue(GATELIB.medusa_up())
            connect.assert_called_once_with(("medusa-sandbox.test", 19000), timeout=1)

    def test_unconfigured_variant_mapping_opens_no_database(self) -> None:
        connect = AsyncMock()
        with patch.dict(os.environ, {}, clear=True), \
                patch.dict(sys.modules, {"asyncpg": SimpleNamespace(connect=connect)}):
            self.assertEqual(asyncio.run(GATELIB._medusa_variant_map()), {})
            connect.assert_not_called()

    def test_variant_mapping_uses_the_selected_test_database(self) -> None:
        connection = SimpleNamespace(
            fetch=AsyncMock(return_value=[{"sid": "sku", "vid": "variant", "pid": "product"}]),
            close=AsyncMock(),
        )
        connect = AsyncMock(return_value=connection)
        dsn = "postgresql://sandbox:fixture@medusa-sandbox.test:5544/medusa_test"
        with patch.dict(os.environ, {"MEDUSA_TEST_DATABASE_URL": dsn}, clear=True), \
                patch.dict(sys.modules, {"asyncpg": SimpleNamespace(connect=connect)}):
            self.assertEqual(asyncio.run(GATELIB._medusa_variant_map()), {"sku": ("variant", "product")})
            connect.assert_awaited_once_with(dsn)
            connection.close.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
