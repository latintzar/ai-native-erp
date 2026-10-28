# Cedar WhatsApp: working integration and product implementation

Owner: Cedar. Focused surface: **Cedar WhatsApp demo**, currently served at
[cedar-demo.soyrocoto.com](https://cedar-demo.soyrocoto.com/?preview=setup).
This document records the implemented integration, its actual evidence and the concrete work for
using it in Cedar's full UX. The [handoff](HANDOFF.md) divides responsibilities between the two
Cedar tasks. The [source README](README.md) owns operation and verification commands.

## Implemented and observed

On 9 September 2026 Peter completed Meta's actual WhatsApp Business coexistence flow: QR scan,
phone-app chat-sharing consent, business/time-zone choices, permission review and Finish. Meta
closed the successful popup and Cedar displayed his real conversations. His earlier refreshed
Meta tab interrupted the handoff; repeating the ordinary flow succeeded.

The backend verified the selected WABA, its sole phone and `is_on_biz_app=true` with
`platform_type=CLOUD_API`; installed the selected account's callback override; read it back; and
preserved the app default callback. The subscription, contacts and history calls were accepted.
At 21:30 UTC the private store contained 1,320 messages across 60 conversations and 444 contacts;
Meta reported progress100. Two batches exposed a provider identity shape described below. These
counts are a timestamped observation. The [deployment and repair receipt](deploy/verification-2026-09-09-48838752.json)
records 2,214 messages across 112 conversations after reprocessing the two saved batches, with
zero pending or failed projections. All 50 previously captured payloads and three provider
operations remained unchanged. Two actual outbound phone-app echo messages were also verified.

The run used an app-owner Facebook login and an account Peter controls. Its actual asset scope
comes from Meta verification. External-customer permission access, newly transferred regular-app
history, outgoing messages, attachment retrieval and new incoming-message delivery each require
their own evidence. Browser and replay tests use synthetic data and have separate receipts.

## Source and product destinations

| Working source | Responsibility | Full Cedar destination and implementation |
|---|---|---|
| [app.tsx](app.tsx), `WhatsAppSetup` | App identification, transfer guidance, launch, waiting and recovery | Extract reusable Cedar connection content/controller; mount the same component in onboarding and the Administration connection dialog. Keep presentation chrome outside the controller. |
| [meta.ts](meta.ts) | SDK loading, synchronous `FB.login`, code/event coordination and diagnostics | Reuse this adapter with injected callbacks. Keep one attempt/disposer per mounted controller. |
| [hooks.ts](hooks.ts), [api.ts](api.ts) | Browser session, polling, paused requests and errors | Place a stable connection/session provider above page/dialog transitions; reuse authenticated requests and cancellation guards. |
| [proof/service.py](proof/service.py), [proof/accounts.py](proof/accounts.py) | Verification, private account sessions, provider operations and callback routing | Keep as Cedar's actual server while integrating the candidate. Maintained-product adoption maps verified assets into the existing authenticated tenant/actor model before exposing data. |
| [proof/storage.py](proof/storage.py) | Durable encrypted capture, contact/message projection, dedupe and chronology | Feed Cedar's real conversation data adapter; preserve provider IDs, account scope and historical/live provenance. |
| [activation-web.tsx](../activation-web.tsx), [activation.ts](../activation.ts) | Existing candidate onboarding | Replace the WhatsApp fixture completion action with backend-confirmed connection state. Record connection and import as distinct facts. |
| [Administration Connections](../areas/admin/connections.tsx) | Existing connection management | Use the same controller/state. Replace the older forward-only history wording with the actual consent/import outcome. |
| [inbox.tsx](../inbox.tsx), [shell/chats.tsx](../shell/chats.tsx), [shell/threads.ts](../shell/threads.ts) | Full conversation UX | Add an explicit real-account data source. Adapt normalized conversation/message DTOs into that source; preserve Cedar's approved presentation and source navigation. |

The existing candidate's localStorage activation/configuration is a fixture store, not account
access. Imported private history stays in the server account store. Customer matching is a
separate reviewed association; a matching phone is evidence, while an ambiguous match is a review
item. Selecting a scenario or customer in the prototype must never select a real server account.

## Actual API contract

All browser requests use the same origin, `credentials: same-origin`, uncached responses and the
host-only Secure/HttpOnly cookie. Shapes are defined in [types.ts](types.ts). Paths below exist now.

| Request | Input | Result and UI use |
|---|---|---|
| `POST /api/proof/session` | `{}` | Reuses a valid session, including an eight-hour account session; otherwise creates a 30-minute unbound setup session. Bootstrap before loading account data. |
| `GET /api/proof/state` | Cookie | `ready`, `blockers`, public `meta`, nullable `connection`, `setup`, `history`. Unbound sessions receive public configuration and empty account state. |
| `POST /api/proof/whatsapp/code` | `{code}` | Immediately exchanges Meta's short-lived code, returns opaque `authorizationId`. Never wait for the asset event before sending the code. |
| `POST /api/proof/whatsapp/connect` | `{authorizationId,event,wabaId,phoneNumberId?,historyRequested:true}` | Accepts coexistence completion only; verifies assets, performs guarded setup, rotates into an eight-hour account session and returns `ProofState`. Meta's consent determines the actual history outcome. |
| `POST /api/proof/whatsapp/disconnect` | Account cookie | Removes this app's WABA subscription, then deletes active token/session authority while retaining the encrypted provider/workspace association and history. |
| `GET /api/proof/intake` | Account cookie; `after?`, `limit` | Returns inbound live text in durable arrival order. Cursor seals WABA, phone and authorization epoch; optional `customerId` comes from exact private sender binding. |
| `GET /api/proof/conversations` | Verified account cookie | Normalized conversations, newest activity first; current proof returns the complete list. Product list pagination is additional work if scale requires it. |
| `GET /api/proof/conversations/{id}/messages` | `before?`, `limit` up to100 | Chronological page with opaque `nextCursor`; merge by message ID, retaining later enrichment. Preserve scroll position when loading older pages. |
| `POST /api/proof/whatsapp/diagnostics` | Validated event/support metadata and report UUID | Private receipt only. The UI displays receipt after HTTP confirmation. Support metadata grants no account access. |
| `GET/POST /webhooks/whatsapp` | Meta verification/signature and payload | Verifies callback challenge/signature, routes exact known WABA/phone, commits encrypted validated account-scoped payloads before acknowledgment, and wakes projection. |
| `GET /download/whatsapp-business` | Device headers | Fixed Apple/Google store redirect, or store-choice fallback. Desktop QR contains this public URL. |

The full Cedar runtime also exposes authenticated `POST /api/cedar/orders/parse` for bounded,
evidence-grounded prototype model extraction. Its workspace bearer access and model-provider budget
are separate from the WhatsApp proof cookie.

Expose these contracts through the chosen Cedar runtime during candidate integration. If adopting
into the maintained backend, add tenant/actor authorization around the same operations and issue
an explicit route migration; do not infer a tenant from browser-supplied WABA/phone IDs or copy this
pilot's unbound-session identity model into the full product. The maintained backend's contracts
and release workflow retain their authority.

## Exact UX and state behavior

1. **Choose the app.** “Do you use the WhatsApp Business app?” is the primary heading. Two outlined
   choices use the supplied app icons and independently focusable store links. Business opens Meta
   in the click handler. Regular opens download and migration help; “My chats are in WhatsApp
   Business” launches Meta after the user's confirmation. Meta owns account/number verification.
2. **Continue in Meta.** Replace app choices with a visible theme spinner, a heading naming the
   current step and one concise instruction. Pause is secondary. Use real status transitions:
   `opening` → `authorizing` → `exchanging` → `awaiting_details`/`connecting`. The spinner indicates
   activity, not a fabricated percentage or completion estimate. Show this in page and dialog.
3. **Connected.** Enter the conversation workspace as soon as verified account state exists. The
   header shows the connected account/number; import continues in the same workspace. Separate
   “account linked” from waiting, syncing, complete, declined and interrupted import states.
4. **History arrives.** Poll state and the open conversation with the existing cadence initially.
   Show actual message/conversation counts and date range; new rows appear progressively. Meta's
   percentage describes provider sync. Local pending work keeps `history.status` syncing;
   projection failures show interrupted even when Meta reported 100%.
   Opening a conversation retains the user's place as new data arrives. A future push transport
   may replace polling while preserving the same normalized events and recovery behavior.
5. **History declined.** Show the actual sharing result and keep the account available for future
   permitted messages. The UI must not promise that the history request can simply be repeated.
6. **Interrupted.** Retain the existing connection and saved messages. Before authorization,
   display the concrete setup/recovery state with one continuation action. A401 during setup
   renews the unbound browser session while retaining a generic explanation above the remounted
   controller. The next explicit attempt clears that explanation; old callbacks remain inert.
7. **Reopen.** Reload uses the verified cookie to reopen saved conversations. Fresh Meta
   authorization can reopen an existing completed account through the same connect endpoint;
   the server returns stored state without replaying accepted subscription/history operations.

Pause disposes the browser attempt; it is not a provider disconnect operation. Browser refresh
on Meta's origin is controlled by Meta/the browser. Cedar should keep its waiting instructions
clear and recover through a new explicit attempt if the handoff is lost. Do not reuse opaque
OAuth URLs or manually replay expired codes. A connected WhatsApp account and a successfully
returned Cedar session are separate stages, so a Meta success screenshot alone must not mark
Cedar's onboarding completed.

The controller must remain mounted through the authorized connect request. Pause background
state polling before launch and abort stale requests before cookie rotation. Resume after the
new cookie response. Preserve generic recovery state above any session-bootstrap remount.
Moving the controller between page/dialog or navigation containers requires an explicit disposer
and recovery test. Keep typed messages, codes and tokens out of browser persistent storage.

## Backend invariants demonstrated by the proof

- A code exchange starts immediately; code and asset events may arrive in either order. Only the
  documented coexistence finish event advances the guarded backend path.
- Verify the complete WABA phone list before choosing the number. This proof supports a sole-number
  WABA because its callback override applies account-wide. Multiple-number support requires an
  explicit account-level routing design rather than changing this guard to select one number.
- Persist the exact account/phone binding and subscription intent before callbacks can race the
  provider response. Subscribe with the account override in the same request; read back both the
  subscription and effective phone routing before requesting contacts/history.
- Accepted one-time operations persist. An uncertain provider result stays held for reconciliation.
  A UI retry never blindly submits another sync request. Use local replay to repair projection.
- Validated payloads are partitioned by account, reserialized, encrypted and durable before
  acknowledgment. Invalid envelopes, signatures and bindings are rejected before capture.
  Message IDs drive dedupe; timestamps drive chronology; later assets enrich earlier placeholders.
  Projection failures retain the captured payload and roll back their projection transaction.
- Real history exposed `thread.context.user_id` in place of `thread.id`. A received contact contains
  the same opaque `contact.user_id` and its phone number. Preserve that provider mapping within the
  account store; resolve by exact opaque identity. Conflicts remain unresolved rather than choosing
  a phone. Reprocess retained dependent events when a valid mapping becomes available. Operator
  backfill reuses captured contact events, with no repeat history request.
- The viewer currently reads normalized message text and attachment placeholders. Authenticated
  media retrieval, media custody and outgoing messaging are explicit implementation work; the
  current proof does not establish those capabilities merely because provider metadata exists.

## Using real conversations for product intelligence

Provide the selected account's normalized messages to the analysis pipeline through an authorized
server adapter. Preserve message/account IDs, source type, timestamp and historical/live marker.
Historical analysis learns patterns and proposes mappings; it must not replay old orders as new
customer actions. Generate any proposed customer/product/order change with source references and
an explicit review/application step under Cedar's existing intelligence and order contracts.
Store analysis cursors and result revisions separately from raw messages. Retry idempotently.

## Live workspace intake

The detailed [source intake contract](../SOURCE-INTAKE-IMPLEMENTATION.md) owns the clock, private
sender association, authorization epoch, parser and durable-apply boundary.

The private runtime maps an exact verified `WABA ID:phone ID` pair to one Cedar workspace through
`CEDAR_PROOF_WORKSPACE_BINDINGS`. On first association the workspace is written into that account's
encrypted connection record. A later authorization of the same provider identity reopens the same
account store and retains its workspace, original connection time, accepted operations and message
ledger. Pausing setup only disposes the browser attempt. A different verified account or phone uses
its own account store and needs its own explicit mapping before intake becomes available.

Authenticated clients read new inbound text from `GET /api/proof/intake?after=<cursor>&limit=50`.
The endpoint starts at the current authorization boundary, labels every row `historical: false`, filters
history, outbound messages and unsupported payloads, and advances an opaque cursor across skipped
rows by durable SQLite arrival sequence. The encrypted cursor carries the exact WABA and phone
identity, so another private account cannot reuse it even under the same encryption key. Cedar polls
only while the returned workspace is the active business. It stores each accepted
message as a `source-arrive` event keyed by workspace, channel and provider message ID, then advances
the per-account cursor after the event is present in the durable day ledger. History remains
available for conversation review and intelligence analysis without entering the order event path.

An exact private sender mapping can add the seeded Cedar `customerId` to an intake row. The map is
scoped by WABA, phone and workspace and stays in server configuration. `POST
/api/proof/whatsapp/disconnect` removes the provider subscription, deletes active authorization and
account browser sessions, and retains the encrypted provider identity, workspace and history.
Reconnect verifies the same account, restores that association and opens a new cursor epoch.

For voice, send finalized transcript deltas with speaker/timing references into the same proposed
order interface; interim words remain display updates. For email, preserve thread/message IDs and
attachment provenance. [The channel handoff](HANDOFF.md) specifies the remaining real email and
phone proofs and their UX hierarchy. This WhatsApp success supplies a working integration pattern;
it does not substitute for those provider proofs.

## Integration sequence and acceptance

1. Consume this PR's verified adapter/service changes in the flagship task with explicit file
   ownership. Extract the reusable controller/content; keep its logic and regression coverage.
2. Wire full Cedar onboarding and Administration to backend state. Replace fixture completion
   and forward-only history copy. Keep a stable controller during the Meta flow and visibly
   distinguish account linking from import progress.
3. Connect the real conversation source to Cedar's inbox/chat/customer surfaces; preserve cursor
   merging, source identity and private account boundaries. Keep fixtures selectable only within
   their separately identified demonstration source.
4. Run the complete user path at desktop and phone sizes: real signup, consent, first messages,
   history browse, reload, settings reopen, cancellation, expired session, interrupted popup,
   return after connection, and reauthorization of an imported account. Verify a separate customer
   and an actual new incoming message. Record callback/state evidence and UI outcomes together.
5. Implement and prove outgoing/media/email/phone capabilities as selected in the handoff. A
   channel marked connected requires its provider result; a capability marked complete requires
   its actual end-to-end proof. Main/product release remains the repository's explicit release step.

Use `make gates`, `make test`, and [browser-drive.py](browser-drive.py). Keep synthetic receipts,
actual aggregate provider receipts and the deployed source/package digest distinct. Account
contents, credentials and opaque OAuth/QR material remain in protected storage and private evidence.
