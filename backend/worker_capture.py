"""Typed, scope-bound provider capture for the maintained timer operation's staging proof."""

from __future__ import annotations

import asyncpg

import config
import spine


class TimerCapture:
    """An explicit fixture adapter; captured intent is persisted, never called delivered."""

    def __init__(self, manifest: dict, timer_id: int, branch: dict):
        self.manifest, self.timer_id, self.branch = manifest, timer_id, branch
        self.scope = "test.synthetic_" + manifest["run_id"] + ".worker"
        self.address = "worker-" + manifest["run_id"] + "@example.invalid"

    def check_scope(self, scope: str, timer_id: int) -> None:
        if (
            getattr(config, "ENVIRONMENT", "development") != "staging"
            or config.IS_PROD
            or not config.EGRESS_SANDBOX
            or scope != self.scope
            or timer_id != self.timer_id
        ):
            raise ValueError("timer capture requires its exact staging proof scope and job")

    def check_branch(self, branch: dict | None) -> None:
        if branch != self.branch or not branch or branch.get("channel") != "email" or branch.get("rearm"):
            raise ValueError("timer capture accepts only the manifest's bounded email branch")

    async def record(self, con: asyncpg.Connection, caused_by: int, operation: str, payload: dict) -> None:
        await spine.append_event(
            con,
            self.scope,
            "effect.captured",
            "staging-worker-proof",
            {
                "run_id": self.manifest["run_id"],
                "job_id": str(self.timer_id),
                "source_commit": self.manifest["source_commit"],
                "operation": operation,
                "capture": payload,
                "provider_delivered": False,
            },
            caused_by=caused_by,
            lane="reasoning",
        )

    async def verify_branch(self, con: asyncpg.Connection, caused_by: int) -> bool:
        await self.record(
            con, caused_by, "llm.verify_branch", {"fixture": "confirmed-v1", "result": "CONFIRMED"}
        )
        return True

    async def send_email(
        self, con: asyncpg.Connection, caused_by: int, address: str, subject: str, html: str
    ) -> bool:
        if address != self.address:
            raise ValueError("timer capture refuses another destination")
        await self.record(
            con, caused_by, "email.send", {"address": address, "subject": subject, "html": html}
        )
        return True
