"""Deployment policy for the maintained worker's automatic, cross-tenant sweeps.

Messaging capture alone cannot sandbox billing, model calls, or one-shot provider syncs.
Nonproduction sweeps stay paused until an explicitly scoped adapter governs every effect.
Manual proof code may exercise individual operations with its own fixture/provider seams.
"""

from __future__ import annotations

from typing import TypedDict

import config


class WorkerState(TypedDict):
    environment: str
    mode: str
    processing_enabled: bool


def state() -> WorkerState:
    environment = getattr(config, "ENVIRONMENT", "production" if config.IS_PROD else "development")
    mode = getattr(config, "WORKER_EFFECT_MODE", "paused")
    if environment not in {"development", "staging", "production"} or (
        (environment == "production") != config.IS_PROD
    ):
        raise ValueError("worker environment and production setting must agree")
    if mode not in {"paused", "enabled"}:
        raise ValueError("worker effect mode must be paused or enabled")
    if mode == "enabled" and environment != "production":
        raise ValueError("automatic worker effects require the explicitly enabled production policy")
    if mode == "enabled" and config.EGRESS_SANDBOX:
        raise ValueError("enabled worker requires production provider policy, not messaging sandbox")
    return {"environment": environment, "mode": mode, "processing_enabled": mode == "enabled"}
