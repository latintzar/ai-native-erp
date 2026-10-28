## How it hangs together

The tables above are generated. Everything from this heading down is written by hand and lives in
`tools/backend-map-prose.md`; the generator pastes it back every run.

**One process.** `app.py` is the whole HTTP surface: a single FastAPI app on `127.0.0.1:8092` with
Caddy in front of it. It carries 261 routes of its own and mounts nine more organs, each on one
line at the bottom of the file — `sup_api` (the supplier panel, `/api/sup/*`), `demo_auth` and
`claim` (the two doors into an account), `intake_api`, `mcp_server`, `mail_inbound`, `join`,
`api_v1` (the public read API, `/v1/*`) and `reparto_api` (the driver's door). Mount order is a
contract, stated in the comment beside each line: the later organs bind `sup_api`'s own session
dependency, so a consent is exactly as authenticated as the panel.

**Boot.** `app._startup()` refuses first (see «Failing closed» below), then calls `db.init()`, which
opens the pools and applies the schema. After it: the tenant and team rows the surfaces read, the
founder tenant completed, the transcriptions a restart stranded retried, orphaned call rows swept,
and the embedding model warmed off the event loop so the first spoken turn after a restart meets a
hot model.

**The turn.** Every sense funnels into `runtime.run_turn`: `spine` appends the event, `assemble`
builds the bounded fold (the card, the seven-day window, the open tabs, recall, the product
directory, presence), the mind decides from that fold, `gate` checks every outbound sentence that
mentions money, and agency acts. `sweep` is its daily summary and `worker` its only clock — and
`worker` is one of the sixty the law names on neither side, though what it does is kernel work.
Voice inverts the order: it answers from the pinned fold and folds the heavy work between turns on
`voice_fabric`. That set of modules is the kernel — the generic employee, versioned in
`KERNEL-VERSION`.

**The domain.** `brain/` is Rocoto's commerce world, and the largest single thing in the backend:
per message → durable queue → junk gate → a debounce → identity → parallel scale-readers → the
synthesiser that merges and matches SKUs → the decision → deterministic validators → the tabular
order → operator hold-to-submit and undo → an event-sourced order. Billing, entitlement, onboarding,
tenants and the catalogue sit beside it. It is app-side by law: the kernel imports nothing from it.

**The data.** `db.py` holds the schema as python string blocks plus `schema_runtime.sql`, and hands
out three pools — the owner pool for DDL and legacy reads, the runtime pool that connects as a
non-owner role so `FORCE ROW LEVEL SECURITY` binds it, and the control pool for cross-scope
background scans. `backend/README.md` says which to reach for.

## Failing closed (WP-E, 2026-09-06)
The doors that verify a stranger's request now verify it always, and the boot refuses a production
process that cannot.
- **Boot.** `config.assert_prod_ready()` runs first in `app._startup()`. Under `IS_PROD` it raises
  and NAMES anything unset from: `ROCOTO_API_KEY`, `ROCOTO_AGENT_TOOL_SECRET`, `FB_APP_SECRET`,
  `WA_CLOUD_VERIFY_TOKEN`, `OWNER_EMAILS`, plus each rail's webhook secret once that rail is
  configured (`TWILIO_AUTH_TOKEN`, `ELEVENLABS_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`).
- **Webhooks.** Meta, every Twilio callback (`_require_twilio_signature`) and the ElevenLabs
  post-call webhook verify unconditionally; a missing secret is a refusal (403/401), never a skip.
  The one bypass is `ROCOTO_ALLOW_UNSIGNED_WEBHOOKS`, and `config.allow_unsigned_webhooks()` ignores
  it under `IS_PROD`. Stripe and the Resend inbound rail already refused unsigned bodies.
- **Schema.** `db.init()` applies its six schema blocks through `_apply`, which logs and RAISES:
  a half-applied schema never serves traffic. Boot talks through `logging.getLogger("rocoto.db")`.
- **RLS.** `ROCOTO_REQUIRE_RLS=true` makes the fallback to the owner pool a refusal to boot, and
  `/healthz` publishes `rls: {runtime_role, forced}` — `forced:false` also lands in `degraded`.
- **Owners.** `OWNER_EMAILS` / `MASTER_OWNER_EMAIL` have no source defaults; who owns a box is a
  deployment fact (`backend/tests/conftest.py` sets the test box's own).
- **Logs.** `logging_setup.configure()` (ported from `mock-api/app/logging_setup.py`) installs one
  redacting JSON formatter for the backend, the worker, the sweep and the reaper: phone numbers keep
  four digits, emails keep their domain, configured secrets and key-shaped tokens vanish, and
  `uvicorn.access` is silenced. Message bodies are dropped at the call site — the formatter cannot
  recognise a sentence, so content is logged as a length and an id.
