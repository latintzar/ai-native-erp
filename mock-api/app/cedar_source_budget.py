"""A bounded provider-read budget for publicly creatable Cedar source workspaces."""

from __future__ import annotations

import os
import sqlite3
import time
from contextlib import closing

from fastapi import HTTPException

from .config import settings


def charge(workspace: str) -> None:
    path = settings.state_dir / "cedar-source-budget.sqlite"
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    os.close(fd)
    path.chmod(0o600)
    stamp = int(time.time())
    bucket = stamp // 3600
    with closing(sqlite3.connect(path, timeout=5)) as db, db:
        db.execute("CREATE TABLE IF NOT EXISTS reads (id TEXT PRIMARY KEY, spent INTEGER, expires INTEGER)")
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM reads WHERE expires<=?", (stamp,))
        for identifier, limit in ((f"{workspace}:{bucket}", 20), (f"all:{bucket}", 100)):
            row = db.execute("SELECT spent FROM reads WHERE id=?", (identifier,)).fetchone()
            if row and row[0] >= limit:
                raise HTTPException(429, "Document reads resume next hour. Your source remains available.")
            db.execute(
                "INSERT INTO reads(id,spent,expires) VALUES(?,1,?) "
                "ON CONFLICT(id) DO UPDATE SET spent=spent+1",
                (identifier, (bucket + 1) * 3600),
            )
