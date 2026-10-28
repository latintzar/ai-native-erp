# Product scenarios and authenticated proofs

[Harbor](scenarios/harbor-v1.json) is a retained synthetic dataset for the maintained product.
The [product manifest](../testdata.json) selects this account/catalogue/customer/order scenario;
the company-owned lifecycle command owns run identity, source snapshots, receipts and recovery.
The adapter provisions an isolated local database per run and proves native resource ownership.
[Backend commands](../README.md#synthetic-accounts-and-data) cover create, populate, exercise,
status, reset and delete. Revisions stay in Git; scenario content stays separate from credentials.

## Authenticated exercise

`exercise` now includes [authenticated.py](authenticated.py):

- Calls the normal `/api/sup/session/login` HTTP endpoint and the existing Auth API verifier.
- Uses an explicit offline identity-provider transport for a matching verified OAuth identity.
- Receives the ordinary secure HTTP-only product session; identity and member resolution run normally.
- Exercises an authenticated product order read and weight update, then verifies database persistence
  and audit. Denies missing authentication, invalid identity tokens, absent CSRF, and reads/writes of
  an existing foreign-tenant order. Revokes its session and verifies subsequent access is denied.
- Stores the proof in the owned database and registers a safe company-run receipt summary for the
  Operator Console. Status retains the proof; reset clears it with the owned database baseline.

The proof reports `mode=offline-identity-provider` and `external_identity_provider=uncommissioned`.
It does not claim a Google/provider login or authenticated deployment has been commissioned.
All generated sessions are revoked after the proof, including failure cleanup. Provider credentials,
access tokens and cookie secrets are excluded from public receipts. The adapter's network fence
continues to allow only its owned loopback database.

## Staging and production commissioning

The explicit [staging worker proof](staging_worker.py) is separate from the development database
adapter. On the commissioned `rocoto-staging` host, run it in the maintained generation with that
target's private environment and release metadata already loaded:

```sh
python -m seed.staging_worker new --manifest /private/path/worker-proof.json
python -m seed.staging_worker create --manifest /private/path/worker-proof.json --apply
python -m seed.staging_worker exercise --manifest /private/path/worker-proof.json --apply --receipt /private/path/worker-receipt.json
python -m seed.staging_worker status --manifest /private/path/worker-proof.json
python -m seed.staging_worker reset --manifest /private/path/worker-proof.json --apply
python -m seed.staging_worker delete --manifest /private/path/worker-proof.json --apply
```

Each run owns one generated test tenant, scope, recipient and timer. Installed source hashes,
the synthetic-run registry, tenant status and native RLS must agree. The actual maintained timer
operation performs branch selection, business gates and state transitions. Its injected model
adapter explicitly supplies a confirmation fixture; its email adapter persists the generated
request as `effect.captured`. These records prove domain processing and captured transport intent.
Model quality and real provider delivery have their own proofs. Automatic staging sweeps stay paused.

Ownership, scoped state, captures and audit commit in one transaction. A rejected destination rolls
the timer back to armed. Retrying returns the same captured events and original measurement time.
Status retains the receipt; reset recreates the owned scenario; delete clears owned data and retains
the audit. Retired run IDs stay retired. Separate IdP/member commissioning must be released by its
own operator before this runner deletes the test tenant. Other accounts and their jobs are untouched.

The receipt's `worker` and `effects` objects are measured inputs to the maintained production
release verifier, together with a separately measured ordinary staging IdP/session response.
The fixture adapters contain no credentials and invoke no provider. An authenticated staging
walkthrough still requires that environment's configured IdP and selected test identity.

The [local database adapter](testdata.py) supports **development with captured effects**. Its manifest and guard refuse
staging, production, arbitrary database targets and unselected effect configuration. The offline
identity fixture independently refuses staging/production and requires the owned database marker.
The ordinary operator login uses the actual configured IdP when commissioned; this fixture is never
mounted in a web deployment.

A deployment adapter must first prove its exact deployment/database identity, ordinary IdP login and
account ownership; declare credential/recipient scope and external-effect permissions; and implement
owned reset/delete across all enabled stores, sessions, jobs and providers. It must exercise its real
selected ingestion/worker path and retain those receipts. Current legacy runtime surfaces retain their
single-tenant guard until that exact integration is proved. User data stays in its own environment;
a release promotes compatible code and schema.

The remaining external commissioning requirements are the environment's IdP/provider configuration,
verified identities/grants, permitted recipients, target resources and authorized deployment. They
remain explicit in [issue #79](../../docs/omitted-sources.md), independently of any
choice among customer UI prototypes. The local suite proves the existing application authentication
boundary; it grants no production/customer operation and provisions no provider account.
