#!/usr/bin/env python3
"""Read-only verifier for disposable ERP test tenants. Default: dry-run.

No writes, redirects, response bodies, secrets, URLs, or server-supplied text are
printed. --verify makes one documented GET per provider after strict validation.
"""
import argparse
import ipaddress
import json
import os
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request

MAX_BODY = 65536
ZOHO_HOSTS = {
    "www.zohoapis.com", "www.zohoapis.eu", "www.zohoapis.in",
    "www.zohoapis.com.au", "www.zohoapis.jp", "www.zohoapis.ca",
    "www.zohoapis.com.cn", "www.zohoapis.sa",
}
CHECKS = {
    "bsale": {"env": ("BSALE_ACCESS_TOKEN",), "base_env": "BSALE_BASE_URL", "default": "https://api.bsale.io", "path": "/v1/clients.json?limit=1", "evidence": "https://docs.bsale.dev/clientes/"},
    "erpnext": {"env": ("ERPNEXT_URL", "ERPNEXT_API_KEY", "ERPNEXT_API_SECRET"), "base_env": "ERPNEXT_URL", "default": None, "path": "/api/v2/doctype/Customer/meta", "evidence": "https://docs.frappe.io/framework/user/en/guides/integration/rest_api"},
    "zoho": {"env": ("ZOHO_ACCESS_TOKEN",), "base_env": "ZOHO_API_BASE_URL", "default": "https://www.zohoapis.com", "path": "/inventory/v1/organizations", "evidence": "https://www.zoho.com/inventory/api/v1/organizations/"},
}

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

OPENER = urllib.request.build_opener(NoRedirect)

def absent(spec):
    return [key for key in spec["env"] if not os.environ.get(key)]

def parsed_base(value, provider, resolve=False):
    parsed = urllib.parse.urlparse(value or "")
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.port or parsed.query or parsed.fragment or parsed.path not in ("", "/")):
        raise ValueError("unsafe base URL")
    host = parsed.hostname.lower()
    if provider == "bsale" and host != "api.bsale.io":
        raise ValueError("unapproved Bsale host")
    if provider == "zoho" and host not in ZOHO_HOSTS:
        raise ValueError("unapproved Zoho host")
    if provider == "erpnext":
        try:
            literal = ipaddress.ip_address(host)
            if not literal.is_global:
                raise ValueError("non-public ERPNext host")
        except ValueError as error:
            if str(error) == "non-public ERPNext host":
                raise
        if resolve:
            try:
                addresses = {entry[4][0] for entry in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
                if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
                    raise ValueError("non-public ERPNext resolution")
            except socket.gaierror:
                raise ValueError("ERPNext host unresolved")
    return "https://" + host

def configured_base(spec):
    return os.environ.get(spec["base_env"], spec["default"])

def headers(provider):
    if provider == "bsale":
        return {"access_token": os.environ["BSALE_ACCESS_TOKEN"], "Accept": "application/json"}
    if provider == "zoho":
        return {"Authorization": "Zoho-oauthtoken " + os.environ["ZOHO_ACCESS_TOKEN"], "Accept": "application/json"}
    return {"Authorization": "token {}:{}".format(os.environ["ERPNEXT_API_KEY"], os.environ["ERPNEXT_API_SECRET"]), "Accept": "application/json"}

def safe_summary(provider, payload):
    if provider == "bsale":
        if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
            raise ValueError("unexpected JSON shape")
        return "items={}".format(len(payload["items"]))
    if provider == "erpnext":
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict) or not isinstance(data.get("fields"), list):
            raise ValueError("unexpected JSON shape")
        return "metadata-fields={}".format(len(data["fields"]))
    orgs = payload.get("organizations") if isinstance(payload, dict) and payload.get("code") == 0 else None
    if not isinstance(orgs, list):
        raise ValueError("unexpected JSON shape")
    expected = os.environ.get("ZOHO_EXPECTED_ORGANIZATION_ID")
    if expected and not any(str(org.get("organization_id")) == expected for org in orgs if isinstance(org, dict)):
        raise ValueError("expected organization not present")
    return "organizations={}{}".format(len(orgs), "; expected-organization-match" if expected else "")

def run_check(provider, verify):
    spec = CHECKS[provider]
    missing = absent(spec)
    base = configured_base(spec)
    if not verify:
        try:
            if base:
                parsed_base(base, provider, resolve=False)
            base_note = "base accepted" if base else "base required"
        except ValueError:
            base_note = "base rejected"
        credential_note = "credentials required: " + ", ".join(missing) if missing else "credentials present"
        print("{}: DRY-RUN GET {} ({}, {}; documented endpoint)".format(provider, spec["path"], base_note, credential_note))
        return True
    if missing:
        print("{}: BLOCKED missing credentials".format(provider))
        return False
    try:
        base = parsed_base(base, provider, resolve=(provider == "erpnext"))
    except ValueError:
        print("{}: BLOCKED unsafe base".format(provider))
        return False
    request = urllib.request.Request(base + spec["path"], headers=headers(provider), method="GET")
    try:
        with OPENER.open(request, timeout=15) as response:
            if not 200 <= response.status < 300:
                print("{}: READ-ONLY failed HTTP status".format(provider)); return False
            body = response.read(MAX_BODY + 1)
            if len(body) > MAX_BODY:
                print("{}: READ-ONLY failed oversized response".format(provider)); return False
            try:
                summary = safe_summary(provider, json.loads(body.decode("utf-8")))
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
                print("{}: READ-ONLY failed invalid response".format(provider)); return False
            print("{}: READ-ONLY OK {}".format(provider, summary)); return True
    except urllib.error.HTTPError as error:
        label = "redirect blocked" if 300 <= error.code < 400 else "HTTP failure"
        print("{}: READ-ONLY {}".format(provider, label))
    except (urllib.error.URLError, TimeoutError, OSError):
        print("{}: READ-ONLY network failure".format(provider))
    return False

def self_test():
    assert NoRedirect().redirect_request(None, None, 302, None, None, "https://example.test") is None
    for provider, bad in (("bsale", "https://evil.example"), ("zoho", "https://127.0.0.1"), ("erpnext", "https://127.0.0.1"), ("erpnext", "https://user@example.com"), ("erpnext", "https://example.com/path")):
        try:
            parsed_base(bad, provider, resolve=False)
            raise AssertionError("unsafe base accepted")
        except ValueError:
            pass
    saved = {key: os.environ.pop(key) for spec in CHECKS.values() for key in spec["env"] if key in os.environ}
    try:
        assert all(run_check(name, False) for name in CHECKS)
        assert not run_check("bsale", True)
    finally:
        os.environ.update(saved)
    print("SELF-TEST OK (no network calls)")

def main():
    parser = argparse.ArgumentParser(description="Read-only ERP verifier; default dry-run.")
    parser.add_argument("providers", nargs="*", choices=sorted(CHECKS))
    parser.add_argument("--verify", action="store_true", help="perform one documented GET/provider")
    parser.add_argument("--self-test", action="store_true", help="run local safety tests; no network calls")
    args = parser.parse_args()
    if args.self_test:
        self_test(); return 0
    selected = args.providers or sorted(CHECKS)
    return 0 if all(run_check(name, args.verify) for name in selected) else 1

if __name__ == "__main__":
    sys.exit(main())
