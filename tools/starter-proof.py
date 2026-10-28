#!/usr/bin/env python3
"""Persist and approve Harbor orders in a newly owned native PostgreSQL cluster.

Requires PostgreSQL16 binaries, vector/ltree and checkout Python dependencies.
The controller creates its own private cluster, proves application/RLS behaviour,
restarts that cluster, reads persisted data, then removes its own temporary files.
It accepts no database DSN and makes no model/provider calls.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def pg_bin():
    executable = shutil.which("initdb")
    if executable:
        return Path(executable).parent
    for base in (Path("/usr/lib/postgresql/16/bin"), Path("/opt/homebrew/opt/postgresql@16/bin")):
        if (base / "initdb").is_file():
            return base
    raise RuntimeError("Install PostgreSQL16 with vector and ltree, or use the Docker lifecycle guide.")


def command(arguments, log):
    subprocess.run([str(value) for value in arguments], check=True, stdout=log, stderr=log)


async def application_proof(directory, binary, port, password, log):
    from urllib.parse import quote
    import asyncpg

    data = directory / "data"
    owner_dsn = f"postgresql://testdata_owner:{quote(password)}@127.0.0.1:{port}/testdata"
    admin_dsn = owner_dsn.rsplit("/", 1)[0] + "/postgres"
    connection = await asyncpg.connect(admin_dsn)
    try:
        actual = await connection.fetchval("show data_directory")
        if Path(actual).resolve() != data.resolve():
            raise RuntimeError("Owned PostgreSQL directory differs from this proof.")
        await connection.execute("create database testdata")
    finally:
        await connection.close()
    runtime_password, control_password = secrets.token_hex(24), secrets.token_hex(24)
    tenant = "harbor_" + secrets.token_hex(6)
    os.environ.update({"DATABASE_URL": owner_dsn,
                       "RUNTIME_DATABASE_URL": f"postgresql://rocoto_rt:{runtime_password}@127.0.0.1:{port}/testdata",
                       "CONTROL_DATABASE_URL": f"postgresql://rocoto_ctrl:{control_password}@127.0.0.1:{port}/testdata",
                       "BRAIN_TENANT": tenant, "ROCOTO_REQUIRE_RLS": "true", "ROCOTO_EGRESS_SANDBOX": "1"})
    sys.path.insert(0, str(ROOT / "backend"))
    from seed import testdata
    import db

    scenario_bytes = (ROOT / "backend/seed/scenarios/harbor-v1.json").read_bytes()
    scenario = json.loads(scenario_bytes)
    owner = {"adapter": "rocoto-native-starter-proof-v1", "run_id": secrets.token_hex(16),
             "owner_id": secrets.token_hex(16), "project": "erp_starter_proof", "state_dir": str(directory),
             "database": "testdata", "tenant_slug": tenant,
             "scenario_sha256": hashlib.sha256(scenario_bytes).hexdigest(),
             "passwords": {"runtime": runtime_password, "control": control_password}}
    await testdata.initialize(owner, "reserved")
    await testdata.open_pools()
    try:
        await testdata.account(owner, scenario)
        await testdata.populate(owner, scenario)
        result = await testdata.exercise(owner, scenario)
        order_id = tenant + ":order:" + scenario["orders"][0]["id"]
        before = await db.order_get(order_id, tenant=tenant)
        assert before and before["status"] == "approved"
        expected = before["value_snapshot_cents"]
    finally:
        await testdata.close_pools()
    command([binary / "pg_ctl", "-D", data, "-m", "fast", "-w", "stop"], log)
    command([binary / "pg_ctl", "-D", data, "-l", directory / "postgres.log", "-w", "start"], log)
    await testdata.open_pools()
    try:
        persisted = await db.order_get(order_id, tenant=tenant)
        assert persisted and persisted["status"] == "approved" and persisted["value_snapshot_cents"] == expected
        counts = (await testdata.status(owner, scenario))["counts"]
    finally:
        await testdata.close_pools()
    return {"mode": "owned-native-postgres", "scenario": scenario["id"], "upstream_commit": "12d77d610c82a21c602a7706861f043e16607a74",
            "counts": counts, "approved_order_value_cents": expected,
            "database_restart_preserves_order": True, "runtime_rls": result["proofs"]["runtime_rls"],
            "authentication": result["proofs"]["authentication"], "external_provider_calls": 0,
            "model_calls": 0, "effects": "captured", "scope": "Maintained backend; Cedar browser integration is separate."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--isolated", action="store_true", help=argparse.SUPPRESS)
    arguments = parser.parse_args()
    if not arguments.isolated:
        return subprocess.run([sys.executable, str(ROOT / "tools/offline-python.py"), str(Path(__file__).resolve()),
                               "--isolated", "--receipt", str(arguments.receipt.resolve())]).returncode
    binary = pg_bin()
    with tempfile.TemporaryDirectory(prefix="erp-starter-") as temporary:
        directory = Path(temporary)
        password = secrets.token_hex(24)
        descriptor = os.open(directory / "owner-password", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            stream.write(password + "\n")
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0)); port = listener.getsockname()[1]
        with (directory / "controller.log").open("w") as log:
            started = False
            try:
                command([binary / "initdb", "-D", directory / "data", "-U", "testdata_owner", "--auth-local=trust",
                         "--auth-host=scram-sha-256", "--pwfile", directory / "owner-password", "--no-locale", "--encoding=UTF8"], log)
                with (directory / "data/postgresql.conf").open("a") as settings:
                    settings.write(f"\nlisten_addresses='127.0.0.1'\nport={port}\nunix_socket_directories='{directory}'\n")
                command([binary / "pg_ctl", "-D", directory / "data", "-l", directory / "postgres.log", "-w", "start"], log)
                started = True
                receipt = asyncio.run(application_proof(directory, binary, port, password, log))
                arguments.receipt.parent.mkdir(parents=True, exist_ok=True)
                arguments.receipt.write_text(json.dumps(receipt, indent=2) + "\n")
                print(json.dumps(receipt))
            finally:
                if started:
                    subprocess.run([str(binary / "pg_ctl"), "-D", str(directory / "data"), "-m", "fast", "-w", "stop"], stdout=log, stderr=log)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
