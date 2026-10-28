"""Canonical phone identity — the dedupe key across WhatsApp / voice / storefront / Medusa.

medusa-integration.md §5: ONE canonicalizer, used everywhere. Today `app.py:_norm` only strips
`whatsapp:`; that forks a customer's identity the moment the storefront normalizes differently.
`canon()` parses to E.164 (default region ES) so "+34 611 11 11 02", "0034611111102",
"whatsapp:+34611111102" and "611111102" all resolve to the SAME key: "+34611111102".

Never crashes an inbound: an unparseable string falls back to the stripped raw (so a weird sender
is still stored, just un-canonicalized) — exactly how `_norm` behaved.
"""
from __future__ import annotations

import phonenumbers


def canon(raw: str, region: str = "ES") -> str:
    s = (raw or "").replace("whatsapp:", "").strip()
    if not s:
        return ""
    try:
        n = phonenumbers.parse(s, region)
        if phonenumbers.is_valid_number(n):
            return phonenumbers.format_number(n, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        pass
    return s  # fall back to the stripped string; never crash an inbound


def is_valid(raw: str, region: str = "ES") -> bool:
    """True only if `raw` parses to a VALID phone number (not the canon() raw fallback). Used to gate
    the PUBLIC shop endpoints so a basket can't be spoofed onto an arbitrary number's conversation."""
    s = (raw or "").replace("whatsapp:", "").strip()
    if not s:
        return False
    try:
        return phonenumbers.is_valid_number(phonenumbers.parse(s, region))
    except phonenumbers.NumberParseException:
        return False
