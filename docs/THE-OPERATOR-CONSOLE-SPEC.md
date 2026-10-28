# Operator Console contract

**Implemented source, 9 September 2026.** The maintained product has a separately built internal
support interface at `app/operator.html`, owned by [app/src/operator](../app/src/operator/main.tsx),
with [governed backend services](../backend/operator_service.py) and an
[HTTP boundary](../backend/operator_api.py). It shares the Rocoto design theme and follows the
[common environment and release contract](ENGINEERING.md#environments-and-release-authority).
It is independent of Cedar and other customer application candidates.

## Authorization

A normal verified product session identifies the actor. An exact, expiring operator grant additionally
binds actor, environment, tenant and capability. Customer membership and founder status do not imply
support privileges. Deployment configuration selects the environment. Every account operation checks
its required capability on the server; browser visibility is not an access control. The runtime's
RLS scope remains unchanged. There is no wildcard tenant claim or implicit impersonation.

## Maintained operations

The [operator manual](../backend/OPERATOR.md) specifies account browsing/detail, account-profile
correction, scoped session revocation, connection state, synthetic receipt summaries and audit
browsing. It includes explicit capability names, bounded grants, local execution and evidence.

Writes require CSRF, a reason, an idempotency key and explicit account scope. Profile edits also
require the revision read by the caller. State mutation, immutable audit and repeatable response
share a transaction. An audit failure prevents the change. Grants start empty; maintenance grants
and revocations are themselves audited. The browser receives selected account fields and service
state, with private responses marked `no-store`.

## Synthetic accounts

Product adapters own their schema and native resource checks. The company lifecycle owns repeated
create/populate/exercise/reset/delete and its private source/data provenance. The console displays
registered receipt summaries; it does not introduce a second lifecycle engine. Staging/production
accounts use explicitly commissioned identity and effect policies. Releases move reviewed code and
compatible schema, while each environment retains its own users, data and provider credentials.

## Extension boundary

New operator operations belong in a maintained domain service with explicit permission, account and
environment scope, audit, idempotency/recovery and tests of denied as well as permitted behavior.
Any future impersonation must retain both the actual actor and represented identity with a bounded
lifetime. Export/deletion must preserve the established retention/access contract. Provider replay,
reconnect, cancellation and runtime changes need genuine service implementations before a UI control
claims them. These extensions are not implied by the current interface.

Earlier broad Control Room and Cedar founder-page proposals remain in Git history. They are neither
an authorization shortcut nor the current interface contract. [Issue #80](omitted-sources.md)
tracks this implementation and its release evidence.
