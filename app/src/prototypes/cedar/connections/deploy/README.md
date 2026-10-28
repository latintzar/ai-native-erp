# Cedar WhatsApp demo deployment

The isolated [setup preview](https://cedar-demo.soyrocoto.com/?preview=setup) is published.
Environment: **demo/development**. Machine: `rocoto-staging`.
Hostname: `cedar-demo.soyrocoto.com`; its DNS CNAME targets the existing demo hostname.
The source, systemd unit and Caddy fragment remain owned by this Cedar work package.

**Current verified release:** [48838752](verification-2026-09-09-48838752.json). Real Meta Embedded
Signup, coexistence and history sharing succeeded on Peter's selected account. The repaired
store contains 2,214 messages across 112 conversations, including two actual outbound phone-app
echoes, with zero pending or failed batches. The waiting spinner and setup-session recovery are
deployed. The [implementation contract](../IMPLEMENTATION.md) and [flagship handoff](../HANDOFF.md)
describe the full Cedar integration. Earlier receipts below retain their evidence as observed
at their own deployment times, including acceptance that was then pending.

The `/` and `/?preview=setup` routes open real customer onboarding in the browser.
The service grants private account access after Meta verifies the selected WABA and phone.
Runtime encryption/verification
values and the privately supplied app secret are installed. Read-only Meta requests confirm the
Rocoto app, its configuration ID and live WhatsApp permission status. The existing app callback
remains with `api.soyrocoto.com`; Cedar's connection code installs and verifies an account-specific
callback in its initial subscription request. The actual Meta authorization and history journey
remain the acceptance criterion. The [initial September 9 receipt](verification-2026-09-09.json)
preserves the earlier published revision, privacy checks and provider evidence at that point.
The [Meta-entry deployment receipt](verification-2026-09-09-7b30bc62.json) records source
`7b30bc62`, the native publisher, private readiness, responsive browser checks and the actual
Meta SDK opening Facebook login. The [transfer-help deployment receipt](verification-2026-09-09-e8bdd583.json)
records source `e8bdd583`, verified Business app store buttons and the desktop QR handoff to public
phone transfer instructions. The [device-redirect deployment receipt](verification-2026-09-09-29e0d37d.json)
records source `29e0d37d`: its QR opens a direct device-aware store redirect, verified over actual
HTTPS for Android, iPhone and iPad desktop mode. Real account authorization and conversation import
remain pending.
The [customer-session deployment receipt](verification-2026-09-09-1805bf55.json) records source `1805bf55`:
the customer opens real Meta signup directly from Cedar. Verified account access uses separate
encrypted stores and persistent host-only browser sessions. Local gates, the full test suite and
29 synthetic browser scenes pass. Actual HTTPS checks verify the served artifact, responsive
page/dialog, download QR, unprivileged bootstrap and protected account APIs. The real SDK opens
Facebook login; verification stops before customer credentials or consent. A fresh SDK-only control
attributes the sole observed localStorage key to Meta's app cache; its value was never read.
The actual authorized account/history run remains pending.

The [sequential setup receipt](verification-2026-09-09-703500b1.json) records source `703500b1`:
setup presents one main action per step. Business users continue through Meta; regular WhatsApp
users can download Business and transfer their chats first. Meta owns history-sharing consent.
Local gates, the full test suite and 39 synthetic browser scenes pass. Actual HTTPS checks cover
34 screenshots, the served artifact digest, phone and narrow-desktop layouts, QR decoding,
customer sessions and the real Meta login popup. The phone download follows Cedar's redirect to
Apple, which returns its native App Store link for an iPhone user agent; physical installation
remains a phone check. Verification stops before customer credentials or consent. Authorized
account routing, eligible history, incoming messages and persistence remain the real acceptance run.

The [app-choice deployment receipt](verification-2026-09-09-693055d3.json) records source `693055d3`:
two outlined app choices identify WhatsApp Business and WhatsApp, each with an independent
app-store link. The regular-app path leads through download and transfer instructions; its
single confirmation action opens Meta after the person can see their chats in Business.
One privacy disclosure covers account access and history sharing. All gates and tests pass;
43 synthetic browser screenshots and 14 app-store link checks cover desktop, phones and iPad.
Actual HTTPS checks capture 51 screenshots, confirm the served artifact and private session
boundaries, and open the real SDK's empty Facebook login. Maintained service PIDs and Caddy
configuration stayed unchanged. Actual authorized history and incoming messages remain pending;
newly transferred account eligibility and its older messages require that real acceptance run.

The service has an independent user, loopback port, source directory, credentials and encrypted
state. Its unit hides the existing backend, shared demo and bridge paths. The Caddy fragment uses
the host's existing `/srv/caddy.d/*.caddy` include; it leaves the maintained routing source with
its current owner. Routine product CI does not package or publish this independent entry.

## Redeploy a reviewed revision

The tracked [`deploy.preview.json`](../deploy.preview.json) is the native publication contract for
the logical target `cedar-preview`. It records the existing development/demo host, unit, runtime
identity, source and state paths, environment file, command, loopback health URL and public origin.

From a clean owning worktree, run the source tests described in [the source README](../README.md),
then build a deterministic package and inspect its names-only plan:

```sh
python3 deploy/development/package.py \
  --manifest app/src/prototypes/cedar/connections/deploy.preview.json \
  --output /tmp/cedar-preview.tar.gz
python3 deploy/development/publish.py \
  --package /tmp/cedar-preview.tar.gz --plan
```

After the plan identifies `cedar-preview`, `development/demo`, `rocoto-staging`, the exact source
commit and package digest, publish through the installed constrained receiver:

```sh
python3 deploy/development/publish.py \
  --package /tmp/cedar-preview.tar.gz
```

The receiver accepts the exact commissioned target, validates the installed systemd identity and
paths, rechecks every archive digest, switches `current` atomically, and confirms the declared
service plus its loopback and public health. A failed check restores the preceding release and
confirms its health. The external `/srv/cedar-demo/venv` remains the commissioned dependency
environment; a change to [requirements.txt](requirements.txt) requires a reviewed venv update before
publishing code that needs it.

### One-time receiver commissioning

**Commissioned 9 September 2026.** The reviewed shared receiver, contract, target JSON and lock
are installed. `receive.py check cedar-preview` passed against the actual host bindings. The
application retained PID 67165 and release `63f1fda7cc451a9ef065b8d83600fb478ca0b098`; its unit,
Caddy route and provider environment were preserved. [Company Operations](../../../../../../docs/omitted-sources.md)
records the shared publisher and consumer. The requirements below describe that installed state.

The existing deployment already uses the manifest's source-addressed `current` symlink, unit,
runtime user, state directory, private environment file, Caddy route and public origin. Native
redeploy additionally requires these root-owned host records:

- `receive.py` and `contract.py` from `deploy/development/`, installed together and
  non-writable at `/usr/local/libexec/rocoto-preview/`;
- this exact manifest installed mode 0644 at `/etc/rocoto/previews/cedar-preview.json`;
- `/srv/cedar-demo/.publish.lock`, installed mode 0600;
- root-owned, non-writable receiver, target, environment, install and releases directories.

Verify the installed binding through the receiver's read-only action:

```sh
ssh peter@rocoto-staging \
  'sudo /usr/local/libexec/rocoto-preview/receive.py check cedar-preview'
```

Commissioning these records preserves the active release, unit, Caddy route, state and environment.
The existing runtime environment remains the current credential boundary. Owner-created 1Password
references for the Cedar consumer are a separate open custody step; source redeploy can proceed with
the commissioned mode 0600 environment file.

## Provider commissioning and verification

### Bodega direct authorization probe

The public experiment starts at
`https://demo.soyrocoto.com/api/bodega/connection-test/start`. The bodega runtime's fixed bridge
calls this service's `/api/proof/whatsapp/redirect/start`, `/complete` and `/result` routes. The
start redirects the same browsing context directly to Meta's configured OAuth dialog with the
business-app coexistence selector. Its registered return is exactly `https://demo.soyrocoto.com/`.
The root callback clears the query before the ordinary page loads and submits the code/state to
the same-origin bodega completion endpoint. Completion exchanges the code with that identical
return URI. **Authorized means Meta authorization was received and exchanged.** The acquired token
is discarded; existing connected accounts, histories and subscriptions retain their own state.

`proof/connection_probe.py` owns an independent 24-hour Secure, HttpOnly, SameSite Lax cookie
and private `connection-probe.sqlite3` attempt ledger. The authorization deadline is 600 seconds.
Cookie/state hashes, timestamps, random diagnostic run IDs, bounded outcomes and the original
launch URL encrypted with the existing service key are persisted. Reopening the same button
reuses the pending attempt and exact original URL without extending its deadline. Processing,
completed, expired and unavailable attempts open their result. POST `/restart` explicitly creates
a new attempt; a missing cookie is a first visit, so cookie loss prevents correlation and is a
separate phone-test failure. Code exchange is single-use; completed callbacks return their saved
result. Global start limits persist across restarts; new attempts prune rows older than an hour.
The existing proof account cookie is independent of this probe.

The journal records `bodega_connection_probe` start, resume-request, callback and exchange outcomes using the
random run ID. Uvicorn runs with `access_log=False`; HTTP client request logging is suppressed.
The public reverse proxy must keep request-query access logging disabled because Meta's callback
arrives with a short-lived code. Publishing this helper follows the same `cedar-preview` source
package above; it introduces no configuration key or provider subscription operation. Actual
WhatsApp container behavior, coexistence screens and return persistence require the phone test.

1. Run names-only preflight with the service's environment. Verify the private API refuses
   anonymous reads. Confirm the process user can write its own state and is refused access to the
   hidden product/demo/bridge paths and source writes.
2. Verify HTTPS, privacy headers, login, static artifact digest and the Meta challenge response.
   Open the real Meta flow through the customer setup button. Meta validates its origin/configuration and
   customer consent; record the observed signup version, account eligibility and any settings
   that require the app owner's attention. After the coexistence return, the server verifies the
   sole-number WABA, existing consumers and selected phone. It records the original app callback
   and request intent, then subscribes with the account override in one request. Both subscription
   and phone routing readbacks must identify Cedar, and the app default must remain unchanged,
   before the one-time contacts/history requests. A rejected or uncertain subscription stops
   setup with durable evidence. The code never falls back to a bare subscription. Account-level
   events keep their app-default destination. The retired manual signup-review marker is not a
   prerequisite for opening Meta.
3. After a source publication, update the actual source commit and deployment receipt in the
   existing company Projects/Operations records. After provider commissioning, add the observed
   callback and consumer evidence under the same **development/demo** classification.

## Customer access and real import

The customer clicks through the actual Meta UI. A browser-bound setup session initially receives
public configuration; verified Meta authority over the selected WABA/phone rotates it into a
private account session. Each session resolves its own encrypted store and message routes.
The server retains valid sessions across restarts. The prior shared reviewer gate is retired;
customer setup requires browser interaction only. Provider code exchange, history consent and import
must be observed before claiming the journey passed. The initial proof viewer supplies read
access; new messages and any later sends/parsing use their own explicit acceptance.

## Retire or roll back

Before stopping or moving the receiver, inspect the connected phone's callback and synchronization
state. A change during the one-time import can lose recoverable history. Preserve the encrypted
state and its separate recovery key according to the agreed retention decision, then restore or
remove the dedicated callback through the owning Meta connection's supported path. Leave existing
WABA and application callbacks with their owners.

For an ordinary source rollback, stop this service, restore its preceding compatible package and
restart it with the same private state. Verify the known connection/history counts and capture
health before resuming the real proof. Retirement also removes this unit, Caddy fragment and DNS
record when their consumers are finished, and updates the same company records with the outcome.
