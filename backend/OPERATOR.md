# Operator Console

The maintained product's internal support interface is `app/operator.html`, built separately from
prototypes. Its source is [app/src/operator](../app/src/operator/main.tsx); it imports the shared
Rocoto theme and BaseUI. [operator_api.py](operator_api.py) exposes `/api/operator/*` and
[operator_service.py](operator_service.py) owns the account operations.

## Access

The console provides Google sign-in through Supabase PKCE. The server exchanges the code, verifies
the returned bearer through the existing Auth API helper, checks the matching verified OAuth identity
and issues the existing `sup_session`. People with customer membership retain their normal session;
internal personnel with an active explicit support grant receive a session with an empty customer
scope and a role denied by every customer capability gate. Provider tokens stay server-side.
The callback binds a one-use PKCE verifier to a secure host-only HTTP-only browser cookie and nonce.
An ordinary verified `sup_session` identifies the person. Each operation additionally requires an
unexpired [operator_access](operator_schema.sql) grant for that exact person, deployment environment,
account and capability. Customer owner/founder status grants no internal support access. HTTP writes
also require the session's CSRF token. The composition root supplies the deployment environment;
requests cannot select it. Grants start empty and expire at their recorded time.

| Capability | Service |
|---|---|
| `accounts.read` | Paginated assigned accounts; account details, team, connection states and scenario receipt summaries |
| `accounts.edit` | Account name/address/city/region/country corrections with a required reason and optimistic revision |
| `sessions.revoke` | Revoke one member's sessions in one assigned account; other memberships remain intact |
| `audit.read` | Paginated audit history for one assigned account |

The database-owner CLI plans changes by default. Use the target's controlled administration context
and normal private `DATABASE_URL` configuration, then review the plan before applying it:

```sh
cd backend
../.venv/bin/python operator_access.py grant --environment staging \
  --email support@example.invalid --tenant ACCOUNT --capability accounts.read \
  --hours 8 --reason 'Support assignment'
# The same command with --apply records the grant and audit atomically.
# Replace grant with revoke to end the exact grant.
```

This command grants an existing verified account access; it creates neither a user nor a session.
Deployment identity is checked, the operator/account must already exist, and grants are bounded to
1–720 hours. There is no browser grant endpoint. Production administration uses the approved release
and operations path, independently of creating a source change.

The deployment needs its own `SUPABASE_URL`, `SUPABASE_ANON_KEY`, Google provider configuration,
and HTTPS `PUBLIC_BASE_URL` serving the console. Supabase must allow the callback
`<PUBLIC_BASE_URL>/api/operator/auth/callback` (including its state query).
The public `/api/operator/auth/config` reports configured/unconfigured state; a missing identity
configuration keeps login closed. This is deployment commissioning, not a generated test identity.

## Integrity and recovery

Every permitted account read and every supported write outcome is audited. Authenticated scope/CSRF
denials also record an outcome. Mutation, immutable audit and idempotency response commit in one
transaction; an audit failure rolls back the mutation. HTTP writes require a UUID `Idempotency-Key`;
retries with identical content replay the same outcome, and changed content under that key conflicts.
Grant revocation and operations share row locks. Profile corrections require the version observed by
the caller, so a concurrent edit returns a conflict for review. Correct an unwanted edit by reading
the current version and applying the intended values with a fresh request and reason. Revoked users
return through normal login.

Reads select explicit columns and filter by exact account. Credential tables, provider tokens,
raw webhook bodies and the runtime's cross-scope data are outside this interface. Account names,
member identity and support reasons are private customer-support data; audit access has its own
capability. Responses use `Cache-Control: no-store`.

## Synthetic scenarios and services

The console displays safe entries from `operator_synthetic_run`: account, environment, scenario,
source digest, lifecycle phase and effect policy. Product adapters register summaries only after
verifying native resource ownership. The company CLI remains the execution mechanism described in
the [backend README](README.md#synthetic-accounts-and-data). The browser executes no shell command,
accepts no filesystem path, and cannot turn a fixture into live egress.

Connection statuses come from the maintained `channel_connection` records. Reconnect, replay,
provider changes, impersonation, customer deletion/export and runtime kill switches are separate
operations requiring their own domain service and proof; this console does not present controls that
claim to implement them. Customer UI candidates, including Cedar, are independent of this console.

## Validation

`tools/test-database.py -q tests/test_operator_console.py` exercises real PostgreSQL, normal signed
sessions and the HTTP router. It proves anonymous/founder denial, environment and tenant boundaries,
capability separation, CSRF, concurrent request replay, revision conflicts, revoked grants, scoped
session revocation, immutable audits and audit-failure rollback. These are local integration proofs;
the PKCE/user-verification exchange is also tested against an offline identity-provider fixture,
including forged identity and state denials. Provider OAuth commissioning and production publication
have separate evidence.
