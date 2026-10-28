# backend/tests — what CI runs, what the box runs, and how to run either

Two bodies of proof live here.

- **`test_*.py` files** — the tests pytest collects directly.
- **`vital_*.py` files** — the product's own proofs, one per organ or promise. Each is
  `main()`-shaped and prints its own PASS/FAIL lines. pytest collects `test_*.py` only, so for years
  their only runner was `deploy/harness/run_all_vitals.sh`, which needs root on the production box:
  `/opt/rocoto` paths, `sudo -u postgres`, prod's `.env`. **A vital nobody runs is a document**, and
  that sentence is written four times in `run_all_vitals.sh` by people who learned it the hard way.

`test_vitals.py` is the door: it runs every vital that can run off the box as a subprocess, and lists
every vital that cannot with the reason, reported as a pytest skip. `test_rls_wall.py` proves the
wall the rest of it stands behind. Adding a `vital_*.py` without classifying it in `test_vitals.py`
fails `test_every_vital_is_classified` — a new vital cannot go silently unrun.

## The wall

The suite used to run with `RUNTIME_DATABASE_URL` unset, which makes `db.py` print

```
[db] WARNING: RUNTIME_DATABASE_URL unset — employee-runtime pool uses the OWNER role;
FORCE RLS is BYPASSED (isolation app-code-only)
```

— so every isolation claim was app-code-only, and `schema_rls.sql` was never exercised by anything
but the box. `tests/rls_wall.py` builds the same wall production runs behind, from one superuser DSN:
a fresh database, `ltree` + `vector`, `schema_runtime.sql` then `schema_rls.sql` (the order
`deploy/harness/rehearsal_rebuild.sh` uses), then LOGIN on `rocoto_rt` and `rocoto_ctrl` — the
come-alive step `schema_rls.sql` deliberately leaves out. It proves the wall stands before it hands
out a DSN: `rocoto_rt` writing with no scope set must be refused **by the policy**, and the same
write in scope must land. It emits `DATABASE_URL`, `RUNTIME_DATABASE_URL`, `CONTROL_DATABASE_URL`
and the aliases the vitals read (`SETUP_DSN`, `RT_DSN`, `CTRL_DSN`, `REHEARSAL_DSN`, `REHEARSAL_DB`),
plus `ROCOTO_REQUIRE_RLS=true` — with the wall up there is no reason to tolerate the owner-pool
fallback, so `db.init()` refuses to boot instead of warning, and a wall that quietly stopped being
built cannot leave a green suite behind it.

One difference from production, stated so nobody reads more into a green run than is there: the
owner role on a CI cluster is the container's superuser, which bypasses FORCE RLS. The wall is under
the **runtime** and **control** pools — `db.scoped_tx` and `db.control_pool` — which is where the
isolation floor lives.

The selected Medusa checkout must already have its dependencies installed, including an executable
`node_modules/.bin/medusa`. Seed reset validates that executable and its seed script before changing
Medusa data, and uses `MEDUSA_TEST_DATABASE_URL` for the restore process.

## Run it locally

```bash
make install
make test
make vitals
```

Run these from the repository root with Docker Compose available. Each test command creates a
unique Compose project and loopback port, builds the RLS wall, and removes that test cluster when
finished. Application connection settings and persistent local development data are independent
of these runs. CI supplies its own isolated database service directly to `rls_wall.py`.

Run a selected vital through the same isolated setup:

```bash
.venv/bin/python tools/test-database.py -q tests/test_vitals.py -k vital_rls
```

Direct `rls_wall.py --dsn` use is an advanced test-cluster operation: it recreates its rehearsal
database and changes cluster-wide test-role credentials. Its target must be a dedicated disposable
cluster. The normal Make commands select and manage that cluster automatically. Raw pytest without
the wall skips database vitals and therefore supplies less evidence.

## Optional Medusa integration tests

The normal backend suite keeps Medusa sync off. To exercise an external disposable Medusa service,
set `MEDUSA_TEST_URL` to that service's HTTP origin and supply its `MEDUSA_ADMIN_EMAIL`,
`MEDUSA_ADMIN_PASSWORD`, region and sales-channel IDs through the environment. The harness uses
the selected URL directly; it discovers neither credentials nor services from another checkout.

Set `MEDUSA_TEST_DATABASE_URL` for variant mapping. The destructive seed-reset check also requires
`MEDUSA_TEST_SOURCE_DIR`, a checkout containing `src/scripts/import-seed-catalogue.ts`, so it can
restore the seeded catalogue after the check. Use a dedicated test service and database: that test
purges their seeded orders and products. Missing restoration inputs fail before the purge; a failed
re-import fails the test. These are test-only settings, separate from the service's `.env.example`.

## What runs where

| Set | Needs | Where |
|---|---|---|
| `NO_DB` | nothing — pure functions, AST, fixtures, stubbed rails | CI, with the DSNs stripped from the env, so the claim is tested |
| `DB` | the wall and nothing else | CI, behind `rls_wall.py` |
| `BOX` | `/opt/rocoto`, a live model or provider key, `sudo -u postgres`, prod's own database, or the founder's phone | `deploy/harness/run_all_vitals.sh`, on production, as root |

`test_vitals.py` carries the classification with a one-line reason per vital.

`vital_terms_acceptance` runs in `NO_DB` and checks the backend's checkout consent, version
metadata and webhook declarations. Legal Markdown and its rendered-page checks live in
[company](../../docs/omitted-sources.md) and
[site's legal checker](https://github.com/Rocoto-Labs/site/blob/main/tools/check_legal.py), respectively. The original combined
vital is retained in Git at `42d27ccc`; its cross-repository inputs are owned by those repositories.

`vital_term_split` also runs in `NO_DB`. It loads `backend/pricing.json` through the actual
provisioning/repricing modules and compares the preserved catalogue with the running backend's
band values, bundle sizes and term cadence. It invokes their local row builders; it leaves their
provider CLI entry points uncalled.

**Every DB vital gets its own database.** The fixture builds two templates once — RUNTIME
(`schema_runtime.sql` + `schema_rls.sql`, the clone `rehearsal_rebuild.sh --with-rls` makes) and
FULL (that plus one `db.init()`, the state the harness's phase-2 vitals meet) — then forks a private
copy per vital, which Postgres does by copying files in about half a second. `vital_rls_coverage` is
the one that takes RUNTIME: it asks whether every scope-keyed table in `schema_runtime.sql` is
fenced, and `db.init()` adds three more `scope` tables that are outside the regime by design.

This is not tidiness. Six vitals went red on rows the previous forty had left behind and green the
instant they were handed a clean database — the sequential version of the collision
`run_all_vitals.sh` documents (four concurrent `vital_presence` runs on one clone: 5/12, 9/12,
10/12, 11/12; the same vital alone: 12/12 every time). Run them sequentially all the same; they
share one cluster, and pytest-xdist would put them back in each other's way.

## Memory

Four vitals — `vital_stock`, `vital_golive`, `vital_codes`, `vital_demo_learn` — embed a catalogue,
which means the model is resident: `vital_stock` peaks at **3.4 GB RSS**. On a small machine, running
them inside a pytest process that is already carrying the rest of the suite puts the box over the
line and an out-of-memory reaper takes them; on the 8 GB dev box that is `earlyoom -m 12`, whose
default action is SIGTERM, and the four come back as `KILLED by signal 15`. They pass on their own
(`4 passed in 55s`). `test_vitals.py` names the signal in the failure so a reaped process is never
read as a failed proof. A 16 GB runner has the headroom; a small box should run
`pytest tests/test_vitals.py` in its own process.

## A green vital here can be a skipped vital

Run against the pinned tree, or a vital can report success for having done nothing. `vital_mindcheck`
skips both of its model rails on an SDK that does not export `OverloadedError` and reports `0/0
checks pass`, which is exit 0 — leo-dev's system interpreter carries `anthropic 0.86.0` and
`backend/requirements.txt` pins `1.4.0`, so CI ran the rails and found three failures this box could
not see. When a vital's verdict matters, check its own count line, and check the version it runs on:

```bash
python3 -c "import anthropic; print(anthropic.__version__)"   # against backend/requirements.txt
```

## The three isolation proofs

`vital_rls` (the DB refuses cross-tenant reads and writes), `vital_rls_coverage` (every `scope`-keyed
table is inside the regime) and `vital_tenant_isolation` (the app rail authenticates the user, not
the APK's machine key) are all in the running set. `vital_rls_coverage` asked its catalogue questions
through `sudo -u postgres psql`, which exists on the production box and nowhere else; it now rides
`SETUP_DSN` when one is exported and keeps the sudo path for the harness.
