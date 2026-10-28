"""Shared parsing of the existing bearer header contract."""


def bearer_token(h: str | None) -> str:
    """Extract the token from an 'Authorization: Bearer <token>' header (case-insensitive)."""
    h = (h or "").strip()
    return h[7:].strip() if h.lower().startswith("bearer ") else h
