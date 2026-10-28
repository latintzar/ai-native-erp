# Cedar email and invoice source review

Status, 14 September 2026: the email rail is commissioned and proven end to end on the dedicated
development preview `cedar-channels.soyrocoto.com` against Unipile v2 — a separate product from
the v1 dashboard, with its own login (`dashboardv2.unipile.com`), the fixed base
`https://api.unipile.com/v2` and a Service API Key created inside an Application; the earlier 401
was a v1 token. Peter's Gmail is connected through the hosted sign-in; the runtime reads the
customers' mail, an explicit page of all mail or a filter, queues arrivals from known customer
addresses through a filtered pull (no webhook endpoint is registered), returns an attachment as
the file, and sends a reply from the connected mailbox that lands threaded in the customer's inbox.
The measured steps are in
[the commissioning brief](../../../../docs/omitted-sources.md); how
the rail lives inside Cedar — the hybrid connection, the prelinked proof customer, chats, the order
widget, reset — is [EMAIL-INTEGRATION-SPEC.md](EMAIL-INTEGRATION-SPEC.md).

Peter, 11 and 13 September 2026 ([FEED-IA §245.5](../../../../docs/FEED-IA.md#2455--unipile-holds-everything-rocoto-reads-order-mail)
and [§245.7](../../../../docs/FEED-IA.md#2457--only-the-mail-rocoto-needs-may-reach-its-servers-13-september)):
Unipile is the certified store that holds the whole mailbox, and only the mail Rocoto needs may
reach Rocoto's servers. So the mailbox does the filtering, in both directions of time. Reading
history is a query: `sync` reads mail exchanged with known customer addresses (`scope:"customers"`,
the default, `from` then `to`), pages the newest mail when the person asks for all of it
(`scope:"all"`), or runs the provider's own content search (`query`, Gmail search syntax for
Google); only the matches come back. Arrivals are a **filtered
pull**: every minute the runtime asks each connected mailbox, through Unipile, only for new mail
from known customer addresses dated after the connection, and queues what is new. A push would
have carried every new message to the runtime, so the Unipile webhook endpoint is removed and the
signed `/email/webhook` route only acknowledges. A known customer address is a label on a message
that says which customer sent it; what reaches the runtime is what the person asked for — their
customers' mail, a page of all mail, a filter's matches — and, unasked, only arrivals from known
customer addresses.

Mail is one channel among three. Which turns a conversation draws as email, which as WhatsApp and
which as a call record — and where a reply leaves from — is
[Channel semantics](CHANNEL-SEMANTICS.md) (FEED-IA §246 acceptance 5). This file owns the mailbox
connection, the authorized source and what a send can do; that one owns the presentation contract.

## Ownership and routes

The root-owned `cedar_access.authorize()` resolves a server-issued workspace capability. A cast,
demo identity, mailbox address or browser-supplied provider ID grants no account access.

- [Email router](../../../../mock-api/app/cedar_email.py), [HTTP transport](../../../../mock-api/app/cedar_email_provider.py)
  and [private alias store](../../../../mock-api/app/cedar_email_store.py).
- [Reusable email screens](email-connection.tsx), [typed API](email-api.ts), [source projection](email-model.ts).
- [Upload router](../../../../mock-api/app/cedar_documents.py) and [upload/review component](invoice-history-upload.tsx).

| Route under `/api/cedar` | Behavior |
| --- | --- |
| `GET /email/status` | Current provider-backed account status; configuration and verification remain separate. |
| `POST /email/auth` | Selected `google`, `outlook` or `imap`; private ten-minute hosted-auth attempt. |
| `GET /email/callback` | Verifies account, provider and immutable Unipile scope, consumes the attempt once. |
| `DELETE /email/accounts/{account_ref}` | Removes the account at Unipile, then purges its local aliases, cursors and active provider-account bindings. Provider 404 is treated as an already-complete disconnect. |
| `POST /email/accounts/{account_ref}/customer-binding` | Stores an exact private customer match for this workspace, provider account and normalized source address. |
| `POST /email/operator/customer-binding` | Operator bearer: `{workspace_id, address, customer_id}` binds the address for every mailbox of that workspace — the commissioning rig's way to register a test sender. |
| `GET /email/intake?after=…&limit=…` | Reads the sources the filtered pull queued, through their current provider account; raw sender/account identity stays server-side. |
| `POST /email/accounts/{account_ref}/sync` | `scope:"customers"` (the default, and what the product's existing callers get) reads whole messages exchanged with each known customer address (`from`, then `to`), merged newest-first, capped at 50 and aliased only then, `coverage:"bound-customers"`, `bound:n`; `scope:"all"` pages the newest mail (50 per page, durable cursor, meta-only; `refresh:true` restarts from the newest page); `query` runs the mailbox's own search (Gmail syntax) on whole messages. Every answer carries `unnamed:n`, the rows the mailbox listed without an id. |
| `POST /email/sources/{source_ref}/reply` | Sends `{text}` from a **connected** mailbox (a forwarding mailbox answers 403) to the message's sender, threaded under it (`Re:` subject, provider `reply_to_message_id`). The sender must be a known customer address of the workspace; `html` travels alongside `text` when the reply was written rich. The `idempotency_key` is reserved before the send: a repeat returns the first receipt, a concurrent repeat answers 409 while the first is on its way. |
| `POST /email/accounts/{account_ref}/send` | A message composed by the person, sent from their **connected** mailbox to the addresses they typed (`to`, `cc`, `subject`, `text`, optional `html` sanitized the same way, base64 `attachments` under 6 MB in total, and `in_reply_to`, the source it answers, so the mailbox threads it underneath); the key is reserved before the send and a repeat returns the first receipt. The mailbox is the business's own, so its recipients are its own choice. |
| `GET /email/sources/{source_ref}/thread?cursor=…` | Authorized thread, 50 messages per display page; opaque continuation bound to the workspace and selected source. Each message carries `body` (plain text) and `html`, the message as written minus what could run (scripts, frames, forms, handlers and script URLs removed); the browser shows it inside a sandboxed frame. List rows carry `snippet` and `unread`. |
| `GET /email/sources/{source_ref}/attachments/{attachment_ref}` | Authenticated download of the file's bytes with attachment disposition and no-store headers; the file is recognised inside its message whichever id the provider hands out on this read. |
| `POST /email/sources/{source_ref}/attachments/{attachment_ref}/parse` | Transient PDF bytes through the existing Parsewise line parser; source-bound review result. |
| `POST /email/accounts/{account_ref}/invoice-consent` | Explicit grant or withdrawal of invoice-history search permission. |
| `POST /email/accounts/{account_ref}/invoice-search` | Up to 50 provider search candidates after permission; query remains transient. |
| `POST /email/forwarding` | Protected operator assigns a verified receiving mailbox to a workspace. |
| `POST /email/webhook` | Verifies Unipile HMAC, freshness and replay, acknowledges and marks the named account changed so an open browser refreshes. Arrivals come from the filtered pull, so no endpoint is registered at Unipile and a push carries nothing into the queue. |
| `POST /documents` | Explicit operator-upload custody; multipart `file` and `retention_consent=private-30-days`. |
| `GET /documents` | Reload private source files and their retained review results. |
| `POST /documents/{source_ref}/parse` | Read PDF/JPEG/PNG document lines; durable lease prevents simultaneous duplicate parsing. |
| `GET /documents/{source_ref}/file`, `DELETE /documents/{source_ref}` | Owner-only source download or removal. |

## Provider contract

Transport uses Unipile v2 at the fixed `https://api.unipile.com` origin, server-only `X-API-KEY`,
bounded responses and disabled redirects. Hosted links must use `auth.unipile.com`.

Every auth attempt creates a fresh Unipile scope and supplies its `account_scope_id` in the hosted
link. The callback's account must belong to that immutable scope and selected provider. Account
assignment is unique across workspaces. The browser chooses only `return_to=onboarding|settings|check`;
the server supplies `/cedar/#/onboarding/channel-setup`, `/cedar/#/admin/connections/email` or the
check page `/check/`.

The hosted link narrows the OAuth request to what Rocoto does with the mailbox: read it and
reply from it. For Google that is `gmail.readonly` and `gmail.send` plus the identity scopes; for
Microsoft `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `User.Read` and `offline_access` — the scopes
Unipile's method table names for listing, reading, attachments and sending. Without this, Unipile's
default request lists its whole catalogue, calendars included, and Google's consent screen shows
every line unticked.

What the runtime asks the mailbox, and nothing more:

- **All mail** (`scope:"all"`): `GET /v2/{account}/emails?limit=50&meta_only=true` with a durable
  cursor. Meta-only pages carry no attachments, which is why this list shows none.
- **Mail with customers** (`scope:"customers"`): per known customer address, whole messages with
  `from=<address>` and then `to=<address>`. `any_email` answered nothing on Gmail (measured 13
  September); `from` and `to` answer at once. Whole messages carry the attachment list.
- **A content filter** (`query`): `q=<Gmail search syntax>` on whole messages, answered by the
  mailbox's own search — `pedido OR albarán has:attachment` is a query Gmail runs, not Rocoto.
- **Arrivals**: every minute, `from=<address>&after=<connection date>` per known customer address
  of every connected mailbox whose workspace still exists; a match is queued when the mailbox owner
  is among its recipients (to, cc or bcc). Unipile has no content rules of its own: it holds the OAuth grant and
  carries the query; Google or Microsoft answer it; Rocoto's servers receive the answer only.
- **A reply**: `POST /v2/{account}/emails/send` with `to` = the customer, `subject` `Re: …`,
  `plain_text` and `reply_to_message_id` = the message's Unipile id (its Gmail id on v2), which
  Gmail threads under the original with `In-Reply-To` and `References` set.
- **A composed message**: the same send with `to`, `cc`, `subject`, `plain_text` and
  `attachments[{filename, content_type, content: base64}]`, the JSON shape the send reference
  names; the mailbox files it under Sent like any mail written there.

Provider shapes that differ from the reference's first reading, all measured on a Gmail account:
a thread comes back as `{object:"Thread", id, emails:[…]}` (newest first); Gmail issues a
**different attachment id on every read path** — list, thread and single message each hand out
their own — so a download reads the message again and recognises the file by name and type before
fetching with that read's id; a page of fifty can carry **placeholder rows with an empty id** (no
subject, the fetch time as date), which every list read drops and counts as `unnamed`; and `q`
answers a plain word or one Gmail operator, while two operators combined answer nothing.
IMAP enables Unipile Initial Sync explicitly to support its all-mail history/search endpoints.
The provider choice explains this storage. Google/Microsoft application OAuth configuration,
approved scopes and the provider's commercial/data-processing setup remain commissioning tasks.

Primary contracts checked:

- [Hosted authentication](https://developer.unipile.com/v2.0/docs/authenticate-with-hosted-auth),
  [create auth link](https://developer.unipile.com/v2.0/reference/createauthlink),
  [create scope](https://developer.unipile.com/v2.0/reference/createscope),
  [account identity and status](https://developer.unipile.com/v2.0/reference/getaccount).
- [Email history and search](https://developer.unipile.com/v2.0/reference/getemailslist),
  [threads](https://developer.unipile.com/v2.0/reference/getthread),
  [send an email](https://developer.unipile.com/v2.0/reference/sendemail),
  [v2 attachment paths](https://developer.unipile.com/v2.0/docs/migration-emails-api).
- [Webhook signature](https://developer.unipile.com/v2.0/docs/configure-a-webhook),
  [event payloads](https://developer.unipile.com/v2.0/reference/event-types-1).

## Replying from the connected mailbox

A reply leaves from the mailbox the business connected, so the customer sees the business's own
address and their thread stays whole — Peter's rule: «let them reply FROM rocoto», from their own
email. The runtime sends only to a known customer address of the workspace, the way the phone rail
rings only its allowed destinations; the guard runs before anything is sent (`403` names the step:
add the address to a customer). The browser contract is unchanged: `installMailboxStanding` reports
`canSend:true` once a mailbox is connected, `replyAvailability` answers `ready` for a source read
from that mailbox, and `sendReply` posts the composer's plain text and idempotency key to the reply
route and returns the provider's receipt. A repeated key returns the first receipt without a second
send. The reply is not appended locally: the thread shows it when the mailbox does.

## Retention and provenance

`cedar-email.sqlite` retains tenant-scoped opaque account/source/attachment aliases, private provider
IDs, connection attempts, cursors, timestamps, revisions and exact normalized addresses selected
for private customer bindings. An attachment row keeps a SHA-256 digest of the message's own alias, the file's name, its type
and its ordinal among same-named files, next to the provider id seen last, so the file is
recognised again without its name being stored and two same-named files stay two. A sent reply
keeps its opaque receipt, the workspace's idempotency key, the source it answered and the
provider's message id (empty while the send is on its way); the text leaves through the provider
and is retained nowhere; disconnect purges the account's receipts with its sources. Subjects, other addresses, filenames, headers, bodies, HTML, MIME
and email attachment bytes are transient authorized views. A forwarded
receiving address is the operator-commissioned business configuration. A message's HTML is served for
display only, with scripts, frames, forms, handlers and script URLs removed, and its plain text
beside it; neither is retained. Provider URLs are never used as download destinations.

Arrivals: `email_accounts.live_since` is the connection moment; the pull asks for mail dated after
it (Gmail applies the date only, so the window opens a day early and the queue's unique key absorbs
the overlap), one request per known customer address per mailbox per minute. Queued rows hold an
opaque source reference and the provider timestamp; bodies are read on demand through `/email/intake`.
History is paged on demand, with durable pagination; an always-running full-backfill worker is not
implemented. Customer identity resolves only from the exact private key `(workspace,
provider account, normalized source address)` and fails closed. The browser receives only
`customerId`; it never receives the provider account/address binding key. An explicit binding also
records a private reconnection profile keyed by `(workspace, provider, verified mailbox owner,
source address)`. Disconnect purges the active provider-account binding; reconnecting the same
verified mailbox in the same workspace restores it onto the new provider account. A different
mailbox, provider or workspace cannot inherit it. Provider events and invoice allocation are
separate facts.

Operator-selected files are a separate explicitly authorized source class under
`cedar-operator-upload-30d-v1`: private bytes and parser results are held in a 0600 SQLite file for
continued review, with a 30-day access expiry. Expired records are securely removed on subsequent
document-store access and by the runtime's hourly maintenance. Limits: 12 MB/file;
25 megapixels/image; 20 files and 50 MB
per workspace; 1,000 files globally. Delete removes the source and review result. Provider-backed
email bytes never enter this store.

The [pre-parser request guard](../../../../mock-api/app/cedar_request_limits.py) authenticates the
exact document-upload route before reading or parsing multipart. It limits the actual body to
13 MiB, allows three concurrent buffers per process and enforces a 30-second read deadline.
The document handler retains its stricter 12 MB file limit.

Parsewise reads share a private source budget: 20 attempts per workspace per hour and 100 globally
per hour. Reopening a completed upload review uses its stored result. Provider failures consume an
attempt; the next hour renews the budget. The budget stores only opaque workspace counters.

Parsewise currently understands `albaran`, `catalogue` and `stock`; this integration uses its
existing `albaran` line review. It does not label that output as a verified fiscal invoice, infer
RUC/invoice identifiers, issue to SUNAT, or auto-allocate payments. Each result carries its source,
method, revision, time and review requirement. Fiscal extraction/acceptance remains a separate
domain step. Downloads use attachment disposition, restrictive CSP and no-store headers; a
dedicated malware scanning service is not commissioned in this path.

## Connection state and entries

FEED-IA [§247.2](../../../../docs/FEED-IA.md): *"same for emailabout the connection state. always we
havbe to be super consistent and not fget people igo confusing menus when they shouldnt see them"*.
This is the phone's [§246 treatment](PHONE-IMPLEMENTATION.md) applied to mail, with the same
selector shape, the same refresh policy, the same frame and the same testid scheme, so the two
channels read as one design.

### One selector, one snapshot

[`email-provider.ts`](email-provider.ts) owns both. `emailCapabilityOf(state, connection)` is pure —
a provider snapshot in, a posture out — so [`app/tools/test-email-capability.mjs`](../../../tools/test-email-capability.mjs)
runs the real function rather than a copy of it. The evidence type is `email-api.ts`'s own
`EmailStatus`, imported as a type so the two never drift.

| Posture | The provider snapshot says | What every entry shows |
| --- | --- | --- |
| `checking` | the first read has yet to land | the illustration and **Connect email** |
| `unavailable` | no channel workspace, or a definitive 401/403/404 | the illustration and **Connect email** |
| `setup` | the workspace holds no account row at all | the illustration and **Connect email** |
| `partial` | an account exists and its authorization or history is pending, or a forwarding address stands alone | the illustration and **Connect email**; the card says **Finish setup** |
| `ready` | one mailbox is `mode:"connected"`, `status:"connected"` and imported | the inbox, the refresh, the history and the send the state justifies |

`needs` names what is pending in the order a person meets it: `connection · mailbox · authorization
· history`. `canSend` is a second authority and never moves the posture — Rocoto draws every mail it
was authorized to receive in every posture, and what changes with the mailbox is the SEND.
`historyReady` accepts either `history_complete` or any `synced_at`, so a mailbox with more than one
page of customer mail leaves **Finish setup** after its first import.

Live provider state outranks every local draft. `company.email` and a sample walk's flags reach no
argument of the selector, so a workspace that armed a switch and authorized nothing reads `setup`.
The two mailbox switches are gone with their step: `config.mailbox.gmail|m365` held «Gmail
connection; Microsoft 365 connection» as a browser draft, the `MoneySetup kind='email'` step was
its only writer, and `railWorld`'s `email` rail in [`sale.ts`](sale.ts) was its last reader. The
field left [`config.ts`](config.ts) on 13 September 2026; a stored config carrying it opens, and
the parse drops it (`app/tools/test-cedar-config.mjs`). `email` stays a MoneySetup KIND because it
is the route token Administration → Connections answers to, and that seat opens the mailbox walk
itself.

### The refresh policy

`useEmailCapability()` reads one module-level snapshot, refreshed on the boundaries a person can
feel: `focus`, `visibilitychange`, a sixty-second period while a subscriber is mounted, and every
setup write (`acceptEmailStatus`). A ten-second floor makes a flurry of focus events one read, and a
`revision` generation guard stops a response from a previous workspace overwriting the current one.
A read that could not confirm the evidence keeps it and records `staleSince`; only the provider's own
answer about this workspace clears the mailboxes.

**Two generations, exactly as [`phone-runtime.ts`](phone-runtime.ts) keeps them.** `mailboxRevision`
is the workspace generation; `mailboxWrites` is the WRITE generation. Every mailbox write stamps it —
`acceptEmailStatus` itself, and `emailWrote(...)` around `beginEmailAuth`, the customer bindings,
`syncEmail` and `disconnectEmail` — a read records it when it starts, and `refreshEmailStatus`
discards any response, success or failure, whose stamp has moved. Without it the sixty-second read
that was already in flight when a sync landed published the PRE-sync row: Connections returned to
**Finish setup**, the connected inbox swapped itself for the illustration and the customer sheet's
door returned to the picture, with no act that explains it.

**A settled posture is never «Checking…».** `declineEmailStatus` clears the evidence with
`staleSince: 0` on both of its clearing branches — the provider's own 401/403/404 about this
workspace, and a first read with nothing behind it. `stale` means «this evidence stands and the last
read failed to confirm it», so a branch that clears the evidence has nothing left to be unsure
about; marking it stale printed a permanent «Checking…» beside the artwork on every mail customer's
sheet of a workspace whose mailbox cannot be read.

Reading the status never allocates a connection workspace: `refreshEmailStatus` checks
`hasChannelWorkspace()` first and, finding none, publishes `unavailable` with no error to apologise
for. `rocoto:channel-workspace-ready` brings the read back the moment a flow opens one.

`resetEmailProvider` is the listener that returns the snapshot to `checking` and reads again. It is
bound to `rocoto:channel-workspace-reset`, to the Reset worker's `rocoto:cedar-workspace-reset`
`{scope, disconnect}` — which fires after every provider disconnect has returned — to a completed
`rocoto:email-disconnect`, and to a cross-tab `storage` event on the channel access key.

### The entries

| Entry | File | What it draws |
| --- | --- | --- |
| Connections → Email card | [`areas/admin/connections.tsx`](areas/admin/connections.tsx) | `emailStatusWord(posture)` — Connected · Finish setup · Connect email — with `emailCardWords` describing it from provider evidence |
| Connected accounts | [`connected-inbox.tsx`](connected-inbox.tsx) | `EmailSetupState` until the workspace holds an account it keeps records through; then every connected mailbox AND every forwarding address, with their messages |
| Onboarding email channel | [`cedar-onboarding.tsx`](cedar-onboarding.tsx) | `EmailSetupState`, then the walk; the channel tile's Connected badge reads `posture === 'ready'` |
| Business setup card | [`setup-progress.tsx`](setup-progress.tsx) | the communication milestone reads `posture === 'ready'` |
| Customer sheet email action | [`areas/customers.tsx`](areas/customers.tsx) | the composer when the mailbox can send; otherwise the stored source; otherwise `EmailSetupState` |
| Email card in a thread | [`email-thread.tsx`](email-thread.tsx) | the posture chip and the provider's own fallback door, both from the capability |
| Composer mailbox line | [`shell/chats.tsx`](shell/chats.tsx) | `mailboxStanding` fed by the capability; its one act is labelled **Connect email** |
| Prep → Scheduled email | [`shell/printing.tsx`](shell/printing.tsx) | `ready` reads `emailCardWords · emailStatusWord` — the mailbox and **Connected**; every other posture draws `EmailSetupState` under the destination's own name |

`EmailSetupState` lives in its own module, [`email-setup-state.tsx`](email-setup-state.tsx):
`FeatureArtwork kind="email"` at 184 px, one sentence, one 44 px button labelled exactly **Connect
email**, and the capability's own error as a quiet status line. It is a module of its own so that a
surface which needs only the picture imports the illustration, the theme and one capability — a
static import of `email-connection.tsx` beside that file's own `React.lazy` made the lazy boundary
inert and pulled the whole mailbox stack into the importer's chunk. The built kit is the proof:
`assets/email-connection-*.js` is now its own chunk and the entry chunk no longer holds the walk. Its testids mirror the phone's — `email-setup-state` beside
`phone-call-setup-state`, `email-open-setup` beside `phone-call-open-setup`, `data-email-posture`
beside `data-phone-posture`.

**The rule removes controls, never records.** Mail that already arrived — forwarded, fixture or
already synced — stays readable in every posture. What the state stands in place of is the SEND and
the MAILBOX controls: `email-refresh`, `email-history-more`, `email-open-invoice-history`,
`email-message`, `connected-email-message` and `customer-email-send`.

### One question per step

`EmailConnection` walks `accounts → choose → authorize → forwarding → mailbox → invoices`, and each
step carries one visible prompt (`email-setup-prompt`, an `h2`) and one primary action.

| Step | Prompt | The one act |
| --- | --- | --- |
| `accounts` | the mailboxes this workspace holds, each named by its own address and marked **Connected** | Disconnect email · Continue · Add another |
| `choose` | *Which mailbox do you use?* | three square choices: Gmail, Microsoft 365, Forward mail |
| `authorize` | *Sign in to Gmail* / *Sign in to Microsoft 365* | **Open Gmail** / **Open Microsoft** — the provider's hosted link, which returns to the flow |
| `forwarding` | *Forward order email to this address* | the address, and **Done** |
| `mailbox` | the Inbox, reached only from a connected account | Refresh email · Read earlier email · Find earlier invoices |

**The step's own question takes focus on every step change.** `ConnectionSetupFrame` focuses its `h1`
in an effect keyed on the TITLE, and `accounts`, `choose` and `authorize` share the title *Connect
email* — so a press unmounted the focused control and left the new question unannounced, while a step
that did change the title jumped to the `h1`. Both walks now focus their own prompt (`tabIndex={-1}`,
second animation frame) on every step change and keep the title on the first paint;
[`phone-setup.tsx`](phone-setup.tsx) does the same with `phone-setup-prompt`.

**The house never reads the aggregator's name** (THE-SOURCE-PRIVACY-SPEC SRC-PRIV-06). A connected
account row carries the mailbox the person chose and `SetupChoice`'s own **Connected** mark; the
transport is named in the code and in the runtime alone.

`Mailbox authorization is awaiting provider setup.` stands on the `authorize` step, which is the step
it is about. A refused authorization shows one line and keeps the same one act. `Use test data`
appears only where `onSampleComplete` was passed, which is onboarding alone; the Connections door
states what it can actually do. The `choose` step keeps the `email-connection` testid and the
`data-email-step="choose"` attribute that `drives/drive-cedar-workspace.py` asserts.

### Customer bindings before the first sync

PR #95: the runtime keeps the whole mailbox at Unipile and, by default, reads only mail exchanged
with an address bound to a customer (all mail and a filter are explicit asks). So opening a
connected account pushes one
`POST /email/accounts/{ref}/customer-binding` per customer address — read through `accountOf`, so an
address typed on a customer sheet is bound too — and only then calls sync. A refused binding leaves
the others standing.

The history's empty state reads *Mail from your customers appears here.* A sync whose response
carried a `bound` adds the count as a sentence about the reading Rocoto did — *Rocoto read this
mailbox for 8 customers.* — and a response without one states the first sentence alone, so a runtime
that has yet to send a count never prints «0 customers» about a mailbox that was read for eight.

### Proofs

- `node app/tools/test-email-capability.mjs` — every posture, both send authorities, stale local
  state, forwarding-only, paged history and the two account predicates.
- `ROCOTO_DIST=app/dist-email .venv/bin/python drives/drive-cedar-email.py` — seven blocks:
  `mailbox` (the walk end to end), `steps` (one question per step, and the prompt taking focus),
  `entrances` (every email entry in the unconnected posture), `state-led` (partial, forwarding only,
  connected without a reload, a stale read, a revoked mailbox and the reset announcement),
  `write-guard` (a status read parked across a sync, and the history count), `inbox` (a forwarding
  address listed and opened beside a mailbox) and `prep` (the scheduled-email destination in both
  postures). `ROCOTO_ONLY` narrows a run; `ROCOTO_WIDTHS` selects the widths.

## Components and shared state

`EmailConnection({scope,presentation,onClose,onComplete?,onSampleComplete?})` works as a page or
dialog. Connected completion requires verified accounts and an explicit Continue. The visible
`Use test data` entry traverses a separate sample mailbox and completes only through
`onSampleComplete`. `EmailConnectionHost` mounts once at app level and preserves current
standing across routes, clearing it on workspace reset. It reads only an existing private
workspace; rendering the host never allocates one.

`EmailIntake` is the app-level live bridge. The filtered pull queues only an incoming message
from a known customer address to the verified mailbox owner. The browser resolves the opaque source
through `/email/intake`, requires the server-supplied exact `customerId`, checks the day ledger
before the model call, and passes an abort signal through `readSourceOrder`. It writes one
`source-arrive` event with `channel:'email'`, immutable opaque source/revision, provider timestamp,
opaque conversation and order-reading evidence. Its cursor advances only after that event is
present in the durable day ledger. A disconnect aborts and pauses an in-flight provider/model read
before provider deletion; provider 404 completes the same local purge. History sync, sent mail and
sample mail never enter this live queue.

`ConnectedEmailThread({account,messages})` reuses the established Gmail/Outlook email renderer.
IMAP has a plain-text source view because the existing renderer's provider union is narrower.
A reply leaves through Rocoto from the connected mailbox (`POST /email/sources/{ref}/reply`, see
[Replying from the connected mailbox](#replying-from-the-connected-mailbox)); the thread shows it
when the mailbox lists it.

`EmailThreadReader({account,sourceRef})` is shared by Settings and the connected inbox. Email
disconnect completion increments the shared source epoch, aborts open reads and clears independently
mounted source views. Each history, thread, attachment and search route rechecks account authority
after its provider read before returning source content. Unipile's
Get Thread returns the full thread newest-first; Cedar splits that response into display pages.
Private continuation aliases retain an anchor message ID for 30 minutes. New arrivals therefore
preserve the next older page. Messages merge by source ID in chronological order, and current
refresh keeps already opened history. Account resets discard pending pages and private views.

`EmailInvoiceDiscovery({account,presentation,onClose,onBack?,onResults?})` owns permission, search
and source review. `InvoiceHistoryUpload({presentation,onClose,onBack?,onResults?})` owns private
upload, persisted readback and continued review. Root mounts these in onboarding and Settings.
Invoice discovery keeps results and PDF review visible after search; its explicit Continue calls
`onResults`, which advances onboarding to completion.

Sample email derives from actual `buildSales` rows, customer/product/line/source identities and
the retained workspace clock. It does not create a second customer or catalogue dataset, nor does
its status authorize a provider operation.

## Many customers, one Application

Unipile's model fits a multi-tenant product and the runtime uses it that way: one Application for
Rocoto, one Scope per connection (the hosted link carries `account_scope_id`; the account stays in
that Scope), one connected account per customer mailbox, billed per connected account with no
usage fees. What Unipile holds for a v2 Gmail or Microsoft 365 account is an encrypted session
token — the OAuth grant happens at Google or Microsoft and the credentials do not transit through
Unipile — and mail content is processed transiently, without a mailbox copy; IMAP with Initial
Sync is the one mode that stores mail there, encrypted, and the product enables it only for IMAP.
Unipile SAS is a French company under the GDPR and states SOC 2 Type II on its site; it is listed
as a sub-processor in Rocoto's DPA. On Rocoto's side the runtime keeps opaque aliases and private
provider IDs, reads only mail exchanged with customer-bound addresses, hands the browser opaque
references and no account identity, and serves attachments with no-store headers.

Before customer mailboxes are connected in production, three steps remain: read each customer's
account through an Account API Key restricted to that customer's Scope instead of the Service key,
so a leaked key exposes one tenant rather than every mailbox; register Rocoto's own Google and
Microsoft OAuth applications in the Application's OAuth tab so the consent screen names Rocoto,
which for Gmail means Google's restricted-scope verification; and sign Unipile's data-processing
agreement and request its SOC 2 report for the company's records.

## Commissioning and proof

Environment names, always server-side:

- `UNIPILE_API_KEY`: the v2 **Service API Key** of the Rocoto Application. Only an organization
  Admin or Owner can create it, and only in the dashboard (Application → API Keys → Create →
  Service). The key belongs to one Application; every scope and account lives in that Application.
- `UNIPILE_WEBHOOK_SECRET`: retired with the push on 13 September; when set it only lets the
  `/email/webhook` route verify and acknowledge a signed event. No endpoint is registered at Unipile.
- `CEDAR_EMAIL_PUBLIC_BASE`: the HTTPS origin the hosted-auth link returns to;
  `https://cedar-channels.soyrocoto.com` on the preview, `https://demo.soyrocoto.com` once the demo
  runtime carries the same keys.
- Shared `CEDAR_CHANNEL_OPERATOR_KEY`, `ROCOTO_RUNTIME_STATE_DIR`, and `PARSEWISE_API_KEY` for the
  attachment parse route.

Commissioned on 11 September 2026: the vault credential is the v2 Service key (vault item
`Unipile`), `GET /v2/accounts` answers 200, and `POST /email/auth` creates a scope and a
hosted-auth link for `google` and for `outlook`. On 13 September Peter connected his Gmail through
the check page, an order mail with a PDF from a registered customer address entered the queue,
and arrivals moved from the push to the filtered pull. Later that day, through the product's own
routes as the workspace owner: the customers view listed the order with its PDF; the attachment
route returned the file itself (33,485 bytes, `%PDF-`, SHA-256 `88828b2a…`, readable as the order
document); the reply route sent «Recibido, gracias…» from the connected Gmail, and the customer
mailbox received it as `Re: Pedido Bar Latintzar viernes` from `owner@example.invalid` with
`In-Reply-To` set to the order's Message-ID, in the same thread; the same idempotency key returned
the same receipt (`sent_98np…`) and the provider was asked once. The consent
screen names Unipile with its default OAuth application; registering Rocoto's own Google and
Microsoft applications in the Application's OAuth tab (Gmail API, redirect
`https://api.unipile.com/v2/auth/oauth/callback`, Google's restricted-scope verification) is the
production step. The live acceptance that follows the mailbox owner's sign-in: the callback binds
the account, the connected-accounts screen pushes one binding per customer address, `sync` reads
history for those addresses only, one message with a PDF from a known customer arrives through the
filtered pull and its bytes come back through the attachment route, the operator assigns a
forwarding mailbox, and disconnect is confirmed by the provider before the local purge. Sending a
test email to a person's mailbox requires its own explicit authorization.

Local reproducible proof:

```sh
PYTHONPATH=mock-api .venv/bin/python -m pytest mock-api/tests/test_cedar_email.py mock-api/tests/test_cedar_documents.py mock-api/tests/test_cedar_request_limits.py -q
(cd app && node --test tools/test-email-model.mjs tools/test-email-intake-cancellation.mjs)
ROCOTO_URL=http://127.0.0.1:8097/app.html .venv/bin/python drives/drive-cedar-email.py
```

HTTP fixtures cover callback substitution/replay, owner isolation, exact private customer matching,
same-owner reconnection restore, provider-confirmed disconnect and local purge, signed incoming
intake through the filtered pull, source retention, thread and
attachment reads (including a download whose single read hands out a fresh attachment id), whole
messages for the customers view and search against meta-only all-mail pages, the reply guard,
threading and idempotent receipt, search permission/withdrawal, PDF provenance, signed event replay, operator
upload validation, duplicate-source reuse, parser-result reuse, reload, deletion and expiry.
The browser proof labels its owner API responses as fixtures and blocks external providers.
The 60-message HTTP regression covers a new arrival between pages, repeat reads, private cursor
ownership and the oldest attachment. The browser regression covers 61 ordered messages, current
refresh, a late page after workspace reset, and connected Gmail result review before completion.
Its desktop/phone cases also verify that resetting the private workspace removes an open upload
review and its source rows. Request-guard fixtures cover unauthorized unread bodies, declared and
chunked oversize, concurrency capacity, timeout recovery and the real multipart route.
