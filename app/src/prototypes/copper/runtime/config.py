from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from cryptography.fernet import Fernet


@dataclass(frozen=True)
class Settings:
    state_dir: Path
    public_origin: str
    admin_token: str
    encryption_key: str
    allow_live: bool = False
    # The seeded bank (FEED-IA §251): ON for the copper-preview demo, OFF everywhere else, so a
    # workspace with no commissioned provider keeps answering the unconnected posture by default.
    sample_bank: bool = False
    mp_client_id: str = ""
    mp_client_secret: str = ""
    mp_webhook_secret: str = ""
    poll_seconds: int = 60
    cedar_allowed_origins: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        parsed = urlsplit(self.public_origin)
        local = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
        if (parsed.scheme != "https" and not (parsed.scheme == "http" and local)):
            raise ValueError("COPPER_PUBLIC_ORIGIN requires HTTPS or local loopback")
        if parsed.path not in {"", "/"} or parsed.query or parsed.fragment or parsed.username or not parsed.hostname:
            raise ValueError("COPPER_PUBLIC_ORIGIN must be an origin")
        if len(self.admin_token) < 32:
            raise ValueError("COPPER_ADMIN_TOKEN requires at least 32 characters")
        Fernet(self.encryption_key.encode())
        if self.poll_seconds < 5:
            raise ValueError("COPPER_POLL_SECONDS must be at least 5")
        for origin in self.cedar_allowed_origins:
            candidate = urlsplit(origin)
            if candidate.scheme != "https" and not (candidate.scheme == "http" and candidate.hostname in {"127.0.0.1", "localhost"}):
                raise ValueError("CEDAR_ALLOWED_ORIGINS requires HTTPS or explicit loopback")
            if candidate.path or candidate.query or candidate.fragment or candidate.username or not candidate.hostname:
                raise ValueError("CEDAR_ALLOWED_ORIGINS requires exact origins")

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            state_dir=Path(os.environ["COPPER_STATE_DIR"]),
            public_origin=os.environ["COPPER_PUBLIC_ORIGIN"].rstrip("/"),
            admin_token=os.environ["COPPER_ADMIN_TOKEN"],
            encryption_key=os.environ["COPPER_ENCRYPTION_KEY"],
            allow_live=os.environ.get("COPPER_ALLOW_LIVE", "0") == "1",
            sample_bank=os.environ.get("CEDAR_SAMPLE_BANK", "0") == "1",
            mp_client_id=os.environ.get("COPPER_MP_CLIENT_ID", ""),
            mp_client_secret=os.environ.get("COPPER_MP_CLIENT_SECRET", ""),
            mp_webhook_secret=os.environ.get("COPPER_MP_WEBHOOK_SECRET", ""),
            poll_seconds=int(os.environ.get("COPPER_POLL_SECONDS", "60")),
            cedar_allowed_origins=tuple(value.strip() for value in os.environ.get("CEDAR_ALLOWED_ORIGINS", "").split(",") if value.strip()),
        )
