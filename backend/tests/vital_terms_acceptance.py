"""Checkout declares required terms consent and records the accepted version.

This repository owns the Stripe checkout and webhook declarations checked here. The legal
Markdown belongs to Rocoto-Labs/company and its publication checks belong to Rocoto-Labs/site.
These source assertions run in the NO_DB vital set from any product checkout.

Usage: python tests/vital_terms_acceptance.py
"""
import re
import sys
from datetime import date
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
fails: list[str] = []


def check(ok: bool, label: str) -> None:
    print(f"  {'ok  ' if ok else 'FAIL'}  {label}")
    if not ok:
        fails.append(label)


src = (BACKEND / "brain" / "pedidos_billing.py").read_text()

check('consent_collection={"terms_of_service": "required"}' in src,
      "Checkout declares required terms_of_service consent")
check('"terms_of_service_acceptance"' in src,
      "Checkout declares the acceptance text")

m = re.search(r'^TERMS_VERSION\s*=\s*"([^"]+)"', src, re.M)
version = m.group(1) if m else ""
try:
    version_is_date = date.fromisoformat(version).isoformat() == version
except ValueError:
    version_is_date = False
check(version_is_date, "TERMS_VERSION names an ISO calendar date")
check('"terms_version": TERMS_VERSION' in src,
      "Checkout metadata carries TERMS_VERSION")
check('_sv(consent, "terms_of_service")' in src,
      "The completion webhook reads terms_of_service acceptance")

if fails:
    print(f"vital_terms_acceptance: {len(fails)} failure(s)")
    sys.exit(1)
print("vital_terms_acceptance: 5 backend consent/version declarations pass")
