# backend — the product backend

FastAPI and Postgres: the event log, memory, model turns, action gates and commerce domain, with
a separate timer worker. This is the existing product backend. The shared frontend still uses
prototype data; its intended integration is described in [the product map](../docs/PRODUCT-MAP.md).
The separate kit runtime in `mock-api/` handles the prototype's provider calls.

## Boot it locally

From the repository root, after installing the [prerequisites](../docs/ENGINEERING.md):

```bash
make install
make db-up
export DATABASE_URL="$(make --no-print-directory db-url)"
psql "$DATABASE_URL" \
  -c "create extension if not exists vector; create extension if not exists ltree;"

cd backend
../.venv/bin/python -m schema_migrations upgrade head
ROCOTO_EGRESS_SANDBOX=1 ../.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8092
```

Compose chooses a loopback port and keeps data in this checkout's development volume. `make db-stop`
stops it while retaining data; `docker compose down --volumes` deliberately resets this checkout's
database. Use a separate worktree per task. This minimal local boot uses the container's owner
account; the isolated test setup below configures and verifies the restricted runtime/control roles.

Explicit migrations prepare the schema before boot. Startup verifies its compatible revision,
seeds the tenant and team rows the surfaces read, and warms the embedding model; `GET /healthz` answers what came up. Under `IS_PROD` it runs `config.assert_prod_ready()`
first and refuses to start with a secret missing, naming the names. Every name the process reads
is in [`.env.example`](../.env.example), kept honest by `python3 tools/env-gate.py`.

## The three pools

[`db.py`](db.py) opens three, and which one a caller takes is the isolation contract
([SPEC §12.2](../docs/THE-SCHEMA-SPEC.md)).

| name | role | what it is for |
|---|---|---|
| `DATABASE_URL` | the owner | explicit migrations, startup verification and legacy tables. The local container account is a superuser; scoped runtime work uses the role below. |
| `RUNTIME_DATABASE_URL` | `rocoto_rt` | every employee-runtime read and write, through `db.scoped_tx(scope)`, which sets the RLS scope per transaction. A non-owner role, so the database itself enforces the wall. |
| `CONTROL_DATABASE_URL` | `rocoto_ctrl` | the tier-P pool: cross-scope background scans for the worker and the sweep. Its writes still go back through `scoped_tx`. |

Without the runtime/control DSNs, the legacy fallback uses the owner pool and logs a warning.
`ROCOTO_REQUIRE_RLS=true` makes that missing configuration a startup failure. Staging and the test
setup enable this guard and configure both roles. [`schema_rls.sql`](schema_rls.sql) declares
the roles `NOLOGIN`; the environment bootstrap or local test setup gives them their login
credentials.

## Schema migrations

[Alembic revisions](migrations/README.md) own schema changes. Application startup and module
helpers only verify schema compatibility. From `backend/`, use `python -m schema_migrations plan`
for the checked-out chain, `preflight` to inspect the selected database, `upgrade head` for a
versioned or empty database, and `check` before starting services. Existing unversioned data takes
`verify-legacy` followed by explicit `adopt head`; structural drift refuses adoption.

Each revision records its previous-code compatibility and a safe downgrade or an explicit refusal.
Migration and revision bookkeeping share a PostgreSQL transaction and advisory lock. Deployments
keep persistent data outside code generations and normally roll code back against compatible
expanded schemas. Applied revisions stay immutable; repairs get a new revision.

## HTTP composition and internal support

`app:create_app` builds the application; `app:app` preserves the existing server entrypoint. CRM
session middleware and playbook routes have separate modules. Existing product routes retain
normal authentication and their own domain services. New surfaces register a router in the factory.

The [operator console](OPERATOR.md) is an independent maintained interface at `/operator.html`.
`make build-operator` creates `app/dist-operator`; the product publisher packages it as
`backend/operator-ui`. Its API, explicit grants, Google login and customer-access exclusion are
implemented independently of candidate UIs. An installed bundle and configured identity provider
are deployment requirements; a source build establishes neither external access nor an operator grant.

## Tests

From the repository root, after `make install`, with Docker Compose available:

```bash
make test
make vitals
```

Both targets use the checkout's `.venv` and [test database runner](../tools/test-database.py)
to create a uniquely named Compose cluster with its own loopback port. [tests/rls_wall.py](tests/rls_wall.py)
configures separate runtime/control roles and verifies database-enforced scoped access before
pytest starts. The runner supplies the connection and test role settings, independently of the
caller's application database settings. It removes its own cluster after success or a handled
failure. Separate invocations can run concurrently; each owns its test state. Persistent local
development data stays in the separate `db` service.

`make test` runs backend pytest, kit-runtime tests, frontend tool tests and repository-tool tests.
`make vitals` runs the longer product checks through [tests/test_vitals.py](tests/test_vitals.py).
That pytest adapter runs each supported `vital_*.py` as a subprocess, reports unsupported checks
as skips with reasons, and fails if a newly added vital has no classification. CI runs the same
two sets in separate jobs. [The tests README](tests/README.md) explains their isolation and scope.

To target a vital while retaining the same database setup and interpreter, from the root:

```bash
.venv/bin/python tools/test-database.py -q tests/test_vitals.py -k vital_assemble
```

[`tests/vital_kernel_boundary.py`](tests/vital_kernel_boundary.py) is the layering law. Its KERNEL
and APP sets say which side each module is on: app may import kernel, kernel importing app is the
breach, and the five named legacy edges are a ratchet that only counts down.

### Synthetic accounts and data

The default reusable path is `make testdata ARGS='…'`, backed by the company-owned
[portable lifecycle](../tools/vendor/testdata/README.md). This product's [manifest](testdata.json)
selects its [adapter](testdata_adapter.py) and [Harbor dataset](seed/scenarios/harbor-v1.json).
Harbor is a retained synthetic scenario for the maintained backend, independent of any UI candidate.
Run these commands from the repository root:

```sh
make testdata ARGS='plan --manifest backend/testdata.json --scenario harbor-v1 --environment development'
make testdata ARGS='create --manifest backend/testdata.json --scenario harbor-v1 --environment development --state-root /absolute/private/testdata'
# Use create's run_id with the same private state root:
make testdata ARGS='populate --state-root /absolute/private/testdata --run RUN_ID'
make testdata ARGS='exercise --state-root /absolute/private/testdata --run RUN_ID'
make testdata ARGS='status --state-root /absolute/private/testdata --run RUN_ID'
make testdata ARGS='reset --state-root /absolute/private/testdata --run RUN_ID'
make testdata ARGS='delete --state-root /absolute/private/testdata --run RUN_ID'
```

Install checkout dependencies with `make install`; the adapter requires Docker Compose and the local
engine at `unix:///var/run/docker.sock`.
Each run provisions its own loopback PostgreSQL cluster, generated roles, ownership marker and
canonical tenant/operator/membership. Populate loads three catalogue items, two customers and two
orders. Exercise uses maintained order approval/value persistence and proves scoped runtime-role
reads/writes behind RLS. Reset restores that run's populated baseline; delete verifies native
ownership before removing its container, network and volume. Repeated operations retain other runs.
The private run journal keeps source/data hashes, recovery source, resource IDs and JSON receipts.
`status` and `delete` remain available after editing or removing the original product source.

This adapter supports development and captured effects. Its authenticated exercise uses the normal
HTTP login/session path, tenant membership checks, CSRF and order updates, with an explicitly offline
identity-provider transport. It revokes that generated session after proof. It provisions its own
database rather than accepting an application DSN. Ingestion, model/worker and external provider
proofs are reported separately from the processing that actually ran. Staging authentication, production synthetic
accounts and controlled real communications remain commissioning work in
[#79](../docs/omitted-sources.md). The
[common environment lifecycle](../docs/ENGINEERING.md#environments-and-release-authority) governs
those adapters, independently of Cedar or any other product direction.

The earlier helpers retain their existing callers and narrower scope:

| Tool | What exists | Limit to preserve |
|---|---|---|
| [`test_account.py`](test_account.py) | Development CLI creates `tenants`, `operators` and `team_members`, with the Cárnicas Aldonza seed world by default. `--session` plus `ROCOTO_ALLOW_TEST_SESSION=1` can mint a real `sup_session`. | Use an isolated nonproduction database. The guard rejects the database name `rocoto`; that name check is not a general production-access boundary. Session minting skips external identity verification. Legacy runtime routes still fence data to the deployment tenant, as the script warns. Its seeded-account drop and the seed module's world reset have separate scopes. |
| [`brain/testdata.py`](brain/testdata.py) | Generates validated onboarding data using a deterministic skeleton and optional AI content with a canned fallback. Existing `/api/test/*` routes in [`app.py`](app.py) require an owner and `TEST_MODE_ENABLED`; they create test onboarding sessions, fill them and offer guarded wipes. | These are test leads, onboarding tokens/progress and transcript records. They are not the full canonical tenant/person/membership creator or an ingestion proof. AI-generated output should be retained with its seed for exact replay. |
| [`control_room.py:create_test_world`](control_room.py) | The Control Room's `act` capability can generate a catalogue, customer scopes/cards and facts under a test tenant scope, then build its directory. | This performs a real model call and creates runtime world data; it does not create the canonical account rows or a signed-in person. Generated output and its resulting IDs need to be retained for reproducible reuse and scoped cleanup. |

New portable scenarios use the manifest path above. The proposed
[Operator Console](../docs/THE-OPERATOR-CONSOLE-SPEC.md) is one possible interface to product-owned
account services; [readiness](../docs/ENGINEERING-READINESS.md) records commissioned capabilities.

## Billing catalogue

[`pricing.json`](pricing.json) supplies module rates and bundle inputs to the existing operator
scripts, [`provision_stripe_v2.py`](scripts/provision_stripe_v2.py) and
[`reprice_stripe_pedidos.py`](scripts/reprice_stripe_pedidos.py). Its data was recovered unchanged
from tag `v0.196.0`, commit `76d7ab50653dde26089c3f620233172e8856e1b1`, at
`apps/rocoto/product/pricing.json`; historical instruction comments remain in that Git source.
Runtime prices continue to use `brain/pedidos_billing.py`.

The `NO_DB` vital [`vital_term_split.py`](tests/vital_term_split.py) checks catalogue/runtime
agreement and the provisioning/repricing term rows locally. The provider CLIs contact Stripe,
including in dry-run mode. This preserves the implemented model; current intended offers follow
[the company commercial decision](../docs/omitted-sources.md)
and releases follow [engineering readiness](../docs/ENGINEERING-READINESS.md).

## The map

[`ARCHITECTURE.md`](ARCHITECTURE.md) lists every module with its package, its layer, its size and
its first docstring line. It is generated — `python3 tools/backend-map.py` writes it, `--check`
fails when it is stale — so it describes the backend that is here. The prose at its foot is
hand-written and lives in `tools/backend-map-prose.md`.
