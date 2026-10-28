# Test data

A company-owned command for versioned synthetic scenarios. This directory is independent of the
company's products: it imports no application code and uses Python's standard library. Each product
supplies a manifest, scenario files and a reviewed adapter. Replacing a product replaces that adapter
and its datasets; this command and its lifecycle remain available. Python 3.11+ on Linux/macOS is required.

## Run a scenario

From this directory, the unrelated [kitten-booking example](examples/kittens/README.md) can be exercised
with SQLite. It demonstrates actual account-owned records and scoped reset without an external service.

```sh
python3 testdata.py plan --manifest examples/kittens/testdata.json --scenario two-households \
  --environment development
python3 testdata.py create --manifest examples/kittens/testdata.json --scenario two-households \
  --environment development --state-root /absolute/private/testdata
# Use the run_id returned by create for every later operation:
python3 testdata.py populate --state-root /absolute/private/testdata --run RUN_ID
python3 testdata.py exercise --state-root /absolute/private/testdata --run RUN_ID
python3 testdata.py status --state-root /absolute/private/testdata --run RUN_ID
python3 testdata.py reset --state-root /absolute/private/testdata --run RUN_ID
python3 testdata.py delete --state-root /absolute/private/testdata --run RUN_ID
```

`plan` reads and validates source without running an adapter. `create` provisions the adapter's owned
account/resources. `populate` loads the selected data. `exercise` runs its declared proof; the result
states exactly which application behavior was exercised. `reset` restores the populated scenario.
`delete` removes that run's owned resources and retains its private receipt. All operations emit JSON.
Capture the returned run ID and receipt path in the task's evidence; a failure returns a nonzero exit.

The private state root belongs outside Git trees and uses mode `0700`; files use `0600`. Its per-run
lock excludes concurrent mutation. Failed operations retain their record and resource identity, so
repeating create or deleting can recover partially commissioned resources. A killed adapter must
recover its identity from its own private marker before acting. Successful deletion retains a tombstone.
Each run keeps its frozen dataset and declared adapter source, input hashes, environment, configuration
fingerprint and receipts. Active run operations verify and execute those recorded source bytes. Create,
populate, exercise and reset also require the current product source to match; start a new run after editing the scenario
or adapter. `status` and `delete` use the verified recovery bundle even after the original product source
changes or is removed. Keep the interpreter and its declared dependencies available for that recovery.

## What is shared and what a product supplies

The common command owns invocation, target selection, private state, locking, immutable scenario
identity, configuration binding, timeouts, failure records and receipts. It does not issue product
SQL, invent accounts or infer database/identity-provider configuration.

A product owns `testdata.json` beside its adapter and source. A minimal manifest is:

```json
{
  "version": 1,
  "product": "my-product",
  "adapter": ["python3", "testdata_adapter.py"],
  "inputs": ["schema.sql"],
  "environments": ["development"],
  "effects": "capture",
  "scenarios": {"busy-day": "fixtures/busy-day.json"}
}
```

The scenario is a JSON object with `synthetic: true`, a stable identity/version, its clock reference
and the product's records and relationships. Retain AI-generated output as data after validation;
replaying a scenario loads those same records. Git keeps dataset revisions. Its adapter validates the
actual schema, identities and relationships. `inputs` names files or globs for all source/configuration
that affects the adapter; the manifest, adapter script and selected scenario are included automatically.
Python and Node adapter commands are supported. There is no shell evaluation. Declare imported source
and schema files and dependency lockfiles in `inputs`; installed dependencies remain the consumer
environment’s responsibility. The recovery bundle is limited to 5,000 files and 64 MiB. Keep generated
outputs, virtual environments and secrets outside that declared source.

A visual fixture scenario can use [the fixture adapter](adapters/fixtures.py) to retain synthetic JSON
collections; its product owns browser loading and state.
An account scenario uses its product's normal account/data services. Provider-backed authentication,
webhooks, workers, model calls and external effects each need their own exercised proof; a populated
page or database is not proof that those integrations ran. Product-specific adapters remain beside
the owning product, with their own tests.

## Adapter protocol and ownership

One JSON request arrives on stdin:

```json
{
  "protocol": 1, "operation": "populate", "run_id": "32_hex_characters",
  "environment": "development", "effects": "capture",
  "state_dir": "/absolute/private/testdata/run_id",
  "manifest": "/absolute/private/testdata/run_id/source/testdata.json",
  "source_manifest": "/source/my-product/testdata.json",
  "scenario": {"synthetic": true}, "resources": {}, "config": {}
}
```

Return one JSON object on stdout: `{"ok":true,"resources":{},"result":{}}`. Failure returns
`ok:false` and preserves known resource identifiers. Keep diagnostics free of credentials.
The CLI suppresses raw stderr and malformed responses. Exact opaque resource identities remain in
the private run journal for cleanup; private configuration values and sensitive fields are filtered
from receipts. Adapters return resource identifiers and keep generated secrets in private owned files.
The request's private `state_dir` is the adapter's home. Ambient provider keys and operator environment
settings are omitted. An optional `--config /absolute/private/config.json` selects explicit private
configuration; the adapter receives its values and its fingerprint stays bound to the run.

The adapter is reviewed application code, with the caller's OS permissions. The protocol is not an
untrusted-code security sandbox. Before every resource mutation it must verify the actual target and
ownership: a displayed database name or user-supplied `synthetic` flag is insufficient. Persist recovery
identity before provisioning; verify it before reuse or deletion. Use transactions, scoped IDs and
native resource ownership labels. Repeated operations preserve other accounts and unrelated resources.
Map the declared effects policy to real transport controls before importing application/provider code.
Retain all generated objects, sessions, jobs and external-resource identities needed for scoped cleanup.
A receipt's `verified` state means the adapter's declared exercise passed; read its evidence for scope.

## Supported targets

The shipped fixture and SQLite examples are development-only and capture external effects. A product
can declare staging after its adapter and target identity have been commissioned and tested. The CLI
requires the requested environment to be explicitly supported. Existing data, real API capability and
an HTTPS address do not change a prototype's logical environment.

Version 1 refuses production provisioning and real external effects. These cannot be enabled with a
manifest flag. A production adapter needs normal authentication, tenant/resource isolation, auditable
operator authority and a reviewed account-scoped cleanup path. Provider sandbox/live configuration is
separate from account purpose. Customer billing/analytics and notification routing must distinguish
synthetic accounts in the product itself. The current Rocoto adapter's exact capabilities are recorded
in its owning repository. Shared fixtures or this CLI alone establish none of those product controls.

## Version and verify

Run `python3 -m unittest discover -s tools/testdata/tests -v` from the company repository root.
The tests exercise the real CLI, independent domains, private-state boundaries, source/configuration
drift, failure recovery, concurrency and scoped reset/deletion.

This command can run directly from a company checkout or be installed with `pip install ./tools/testdata`.
For reproducible offline CI, a consumer may vendor this directory at an exact company commit and record
its source path plus SHA-256 inventory. Update that dependency deliberately; each consumer keeps its
selected version. Source changes are reviewed here, then brought to each consumer with its tests.
