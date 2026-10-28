# Read-only ERP connection verifier

`erp-verify.py` is a no-write verifier for disposable test tenants. It never signs up, creates data, follows redirects, logs secrets, prints response bodies, prints complete URLs, or emits server-supplied text. Without `--verify`, it is a no-network dry-run. `--verify` sends one documented HTTPS `GET`, reads at most 64 KiB, requires the expected JSON shape, and prints only a non-PII count/metadata summary.

## Credential boundary and host rules

Use a dedicated least-privilege test identity. Set credentials in the process environment only; do not place them in a file, command line, source control, or chat. Bsale is fixed to `api.bsale.io`; Zoho accepts only its documented regional API hosts; ERPNext accepts an HTTPS public hostname with no userinfo, port, path, query, fragment, loopback or private-IP resolution. Deliberate self-hosted/private ERPNext support is excluded from this utility and needs a separately reviewed network policy.

| Provider | Required environment variables | Read-only endpoint and JSON check |
|---|---|---|
| Bsale | `BSALE_ACCESS_TOKEN`; optional `BSALE_BASE_URL` but it must remain `https://api.bsale.io` | clients list → `items` array |
| ERPNext | `ERPNEXT_URL`, `ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET` | Customer metadata → `data.fields` array |
| Zoho Inventory | `ZOHO_ACCESS_TOKEN`; optional `ZOHO_API_BASE_URL` at an official Zoho regional host; optional `ZOHO_EXPECTED_ORGANIZATION_ID` | organizations → `code: 0`, `organizations` array; expected ID must match if set |

Sources: [Bsale clients](https://docs.bsale.dev/clientes/), [Frappe REST metadata](https://docs.frappe.io/framework/user/en/guides/integration/rest_api), [Zoho organizations](https://www.zoho.com/inventory/api/v1/organizations/).

## Usage

```bash
python3 erp-verify.py
python3 erp-verify.py --self-test
python3 erp-verify.py --verify zoho
```

The first and second commands make no network call. The final command needs an owner-approved OAuth token. A success means only that this constrained read endpoint returned the expected JSON shape; it does not prove a write workflow, tenant identity unless `ZOHO_EXPECTED_ORGANIZATION_ID` matched, or operational correctness.

## Bsale environment distinction

For API sandbox verification, create the self-service account at [account.bsale.dev/users/create](https://account.bsale.dev/users/create), linked by [Bsale First steps](https://docs.bsale.dev/get-started/), and complete email validation. The API documentation does not assert a 30-day duration or phone requirement. This verifier's Bsale configuration is for that test environment only.

Do not use a Bsale production customer OAuth token unless an integrator has already been approved: Bsale's [OAuth documentation](https://docs.bsale.dev/oauth/) requires vendor form submission and vendor-issued `app_id`/`usrToken` before customer authorization. Production OAuth is tier 2 in the connection cascade, not immediate self-service tier 1.
