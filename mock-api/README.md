# The kit runtime — the calls the browser must not make

**FEED-IA §196.5 · §196.6 · §196.9 (E193.06).** The full contract, the proofs and what is owed live
in [`docs/THE-RUNTIME-SPEC.md`](../docs/THE-RUNTIME-SPEC.md). This file is how to run it.

The kit at kit.soyrocoto.com is a static page. Four things it must do need a secret — Parsewise
extraction (the adapter retains its historical module name), Google Places identity, Deepgram transcription, Twilio — and a static page cannot hold
one. This service holds them, on the box, behind the kit's own origin at `/api`, and it implements
exactly the contract the kit already reads: `app/src/prototypes/cedar/runtime-client.ts`.

**It never fabricates a result.** A missing key is `missing` in health and a named 503 on the
endpoint; a provider that fails says so; there is no cached answer and no plausible default.

## Layout

```
mock-api/
  app/            main.py · config.py · errors.py · logging_setup.py
                  parsewise.py · places.py · deepgram.py · twilio_voice.py · store.py
  tests/          pytest checks against RECORDED real provider responses (no network)
                  record_degraded_reads.py writes a live read into fixtures/ — the only file here
                  that spends a key, and it is run by hand, never by the suite
  deploy/         systemd units · the Caddy snippet + patcher · with-env.py
```

Ported, never imported: `places.py` and `deepgram.py` carry the working parts of
`apps/call-recorder/product/backend/pipeline.py`; `twilio_voice.py` carries `caller.py`'s. Nothing in
this service imports founder-hermes, call-recorder or call-log — §196.6's «self contained in here».

## Run it locally

```bash
cd mock-api
ROCOTO_RUNTIME_STATE_DIR="$(mktemp -d /tmp/rocoto-runtime.XXXXXX)" \
  ROCOTO_RUNTIME_PUBLIC_BASE=http://127.0.0.1:8790 \
  ../.venv/bin/python deploy/with-env.py --env /path/to/local-sandbox.env -- \
  ../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8790
curl -s http://127.0.0.1:8790/api/health
```

Run `make install` from the repository root first. Each command above starts with a private
temporary state directory. Reuse an explicitly chosen local state directory to retain a session.
Each runtime explicitly configures its own `ROCOTO_RUNTIME_PUBLIC_BASE`. Provider callbacks and
implicit artwork references require that origin; the published kit origin is never a fallback.
`with-env.py` reads ONLY the names in `deploy/env-names.txt`, prints those names and never a value.
To point a local kit build at it: `localStorage.setItem('rocoto-runtime-base', 'http://127.0.0.1:8790')`.

The repository-level command expresses the same lifecycle directly:

```bash
make dev RUNTIME_STATE=/home/peter/.local/state/rocoto/cedar UI_PORT=8081 \
  RUNTIME_ENV=/absolute/path/to/private.env
```

Omitting `RUNTIME_STATE` creates temporary server state and prints that lifetime. The explicit path
preserves runtime state independently of browser storage and source. `RUNTIME_ENV` selects the
consumer's provider configuration; it is a configuration choice rather than evidence of sandboxing.
An account Peter explicitly selects for a Rocoto trial keeps its actual owner, consumer and
environment recorded in company Operations. Its authentic data stays private, credentials remain
in explicitly selected configuration, and each read, write, call or message follows the authorized
operation scope.

With no keys at all it still runs, and every road refuses by name — which is the posture
`drive-199-runtime.py`'s SEALED block drives.

## Test it

From `mock-api/`, after `make install` in the repository root:

```bash
../.venv/bin/python -m pytest tests -q
```

For the browser/runtime drive, run from the repository root after `make build`:

```bash
PATH="$PWD/.venv/bin:$PATH" ROCOTO_DIST=app/dist-export-review ROCOTO_RUNTIME_LIVE=0 \
  .venv/bin/python drives/drive-199-runtime.py
```

This selects the local drive legs. [Drive instructions](../docs/omitted-sources.md) describe the separate
provider-backed checks and their recorded evidence.

## Deploy it

A dedicated development preview of this API plus the Cedar UI runs at
`cedar-channels.soyrocoto.com` for the phone and email providers; its commissioning and publish
commands are in [deploy/CEDAR-CHANNELS.md](../docs/omitted-sources.md).

The demo's kit runtime deploys from a merged PR through [CI](../docs/omitted-sources.md),
onto the staging box. The unused direct-production `deploy/deploy.sh` was retired on 2026-09-07;
its last version is retained in Git at `42d27ccc`. Units, the Caddy patcher and explicit environment
loader remain here as recovery inputs. Production runtime deployment still needs commissioning;
the current kit tag workflow publishes static artifacts. See [the deployment runbook](../docs/omitted-sources.md).

Read it with `journalctl -u rocoto-kit-runtime -f` — one JSON object per line, secrets redacted in
the formatter, so a provider that quotes our key back cannot write it into the journal.
