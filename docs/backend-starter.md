# Persistent backend starter

The maintained backend owns FastAPI routes, PostgreSQL records, authentication, events, scoped memory, action gates and the worker. Cedar’s browser-state adapter is a separate prototype implementation.

## Prove the first order

Install Python 3.12, PostgreSQL 16 and its `vector`/`ltree` extensions. Node 22.12+ is required by the UI dependencies.

```sh
make install
make starter-proof
```

`tools/starter-proof.py` creates a private temporary PostgreSQL cluster on a new loopback port. It accepts no database URL. It verifies the server’s data directory before schema work and cleans up only its own cluster.

The retained `harbor-v1` scenario supplies one tenant, one owner/member, three products, two customers and two orders. The proof uses the existing `seed.testdata` application operations to approve an order and persist its catalogue-backed value snapshot. A conflicting retry preserves that snapshot.

The ordinary HTTP login/session route runs against an explicit offline identity-provider transport. The proof verifies CSRF, session revocation, persisted weight/audit and cross-tenant denial. Runtime-role reads hide foreign scoped events; foreign writes fail under PostgreSQL RLS. It then restarts PostgreSQL and reads the same approved order and value again.

The receipt is written to `/tmp/erp-starter-proof.json`. Its authentication evidence says `offline-identity-provider`; model/provider calls are zero. This proves application processing, storage and boundaries. Actual identity/provider commissioning remains a separate acceptance step.

## Existing Docker lifecycle

The original portable lifecycle provisions a uniquely owned Docker PostgreSQL cluster per run. With Docker Compose available:

```sh
make testdata ARGS='plan --manifest backend/testdata.json --scenario harbor-v1 --environment development'
make testdata ARGS='create --manifest backend/testdata.json --scenario harbor-v1 --environment development --state-root /absolute/private/testdata'
```

Use the returned run ID with that same private directory:

```sh
make testdata ARGS='populate --state-root /absolute/private/testdata --run RUN_ID'
make testdata ARGS='exercise --state-root /absolute/private/testdata --run RUN_ID'
make testdata ARGS='status --state-root /absolute/private/testdata --run RUN_ID'
make testdata ARGS='reset --state-root /absolute/private/testdata --run RUN_ID'
make testdata ARGS='delete --state-root /absolute/private/testdata --run RUN_ID'
```

Its journal, ownership markers, captured effects and recovery bundle remain private. [Original backend guide](../backend/README.md) and [scenario contract](../backend/seed/README.md) retain the deeper implementation.

## Start the maintained service

`make db-up` creates this checkout’s separate development database. `make db-url` prints that local connection URL. Create extensions, run explicit migrations and then start the API as described in `backend/README.md`. Configure separate `RUNTIME_DATABASE_URL` and `CONTROL_DATABASE_URL` roles, and set `ROCOTO_REQUIRE_RLS=true` for the scoped runtime contract.

The local development owner account can migrate schema; runtime operations use their restricted role. Schema migration and role verification are explicit steps. `backend/migrations/README.md` explains revision compatibility and rollback.

Actual operator identity belongs to the installation. `ROCOTO_FOUNDER_ID`, `ROCOTO_FOUNDER_EMAIL` and `ROCOTO_FOUNDER_NAME` deliberately require explicit configuration before founder bootstrap grants any membership. Public fixtures use reserved synthetic contact identities. The first Harbor proof creates its own scoped owner without granting a fixed external person authority.
