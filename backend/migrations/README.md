# Database migrations

Alembic owns PostgreSQL schema changes. Application startup and module `ensure_schema` helpers
verify the deployed revision; they perform ordinary reads, never DDL or a data backfill.
The [backend guide](../README.md) explains local and deployment connections.

From `backend/`, with the selected environment's owner connection in `DATABASE_URL`:

```sh
python -m schema_migrations plan
python -m schema_migrations preflight
python -m schema_migrations upgrade head
python -m schema_migrations check
```

`plan` lists the checked-out revision chain without connecting. `preflight` reads the selected database
and returns JSON: current/target revision, pending revisions, `action` (`upgrade`, `adopt`, `check`)
and `backward_compatible`. Deployment uses this result before cutover. Connections and passwords
stay in environment configuration; diagnostics contain schema identities, never URLs or SQL parameters.
Alembic itself is also available with `python -m alembic -c alembic.ini …` for revision authoring.

## Existing databases

An empty public schema can upgrade directly. A database with unversioned application tables requires
an explicit, validated adoption:

```sh
python -m schema_migrations verify-legacy
python -m schema_migrations adopt head
```

The first command reads metadata only. Adoption compares existing columns, types, constraints,
indexes, policies, grants, triggers and functions against [the frozen baseline](baseline-catalog.json),
checks the runtime/control role split, then stamps `0001_baseline` and upgrades in the same transaction.
It never replays the old bootstrap SQL against existing customer data. A mismatch names the affected
objects and requires a reviewed forward repair. Extra application objects can remain; required objects
and grants must retain the reviewed shape. Existing tenant defaults and customer rows are preserved.

Revision `0004` also validates the [optional-module schema](0004-catalog.json) after bringing the old
lazy tables under migrations. Existing objects cannot silently defeat an `IF NOT EXISTS` declaration.
These catalog files are metadata snapshots generated from fresh PostgreSQL 16 databases at the named
revision. The baseline test regenerates and compares its snapshot. They contain no customer data.

## Change and rollback

Create a revision with `python -m alembic -c alembic.ini revision -m 'describe the shape change'`.
Write explicit `upgrade()` and `downgrade()` operations, including a data-preserving rollback or a
clear refusal when reversal would lose records. Add a PostgreSQL test for existing data and the
intended rollback. Applied revision scripts and their SQL remain immutable; fixes get a new revision.
The original `schema_runtime.sql` and `schema_rls.sql` are historical runtime-only test references.
New database changes belong in revisions, not those old snapshots or application modules.

Each revision declares `backward_compatible`. It defaults to false. Set true only for an expansion
that preserves the previous application's schema contract. Migration commits update `alembic_version`
and the supported ancestor revisions in `schema_compatibility` atomically. An older binary can start
against the expanded schema only when that metadata explicitly includes its required revision. A
contracting revision truncates the compatibility list. Its release needs a coordinated cutover, not
an automatic rollback promise. Production rollback normally restores code and keeps compatible data.

Migration commands serialize on a PostgreSQL advisory transaction lock, with bounded lock and statement
waits. All revisions, data changes and revision bookkeeping in one invocation commit together. A failure
rolls the transaction back. Ordinary app/worker startup is read-only and safely runs concurrently.

`0001` is the adoption floor: downgrading below it requires a backup restore. `0002` makes inbound
webhook deduplication strict and is reversible. It refuses duplicate pre-existing identities for
explicit repair. `0003` can remove its new operator tables only while they are empty; retained audit
records prohibit destructive downgrade. `0004` preserves optional-module tables that may have existed
before adoption and therefore refuses automatic removal. These refusals preserve data during rollback.

Fresh installation's `orders.tenant_id` default uses explicit `--tenant` or `BRAIN_TENANT` (default
`rocoto`). Existing adoption preserves its prior default. Explicit legacy seed/reset helpers can still
repair their own NULL tenant rows using DML; boot no longer backfills customer records.

## Verification

From the repository root:

```sh
.venv/bin/python tools/test-database.py -q tests/test_schema_migrations.py tests/test_rls_wall.py
```

Tests own a disposable Compose cluster. They cover fresh/concurrent upgrades, repeated upgrades,
read-only/concurrent boot, adoption with existing data, schema and grant drift, transaction rollback,
operator audit preservation, revision compatibility and the absence of application DDL. The standard
backend/vitals bootstrap and synthetic-data adapter also use this migration entrypoint.
