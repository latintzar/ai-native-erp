# Cedar WhatsApp demo and connection proofs

Date: 9 September 2026. Owner: Cedar, one possible Rocoto product direction.
Environment: **development/demo**, including when a real provider and real account are used.
Source: `feat/cedar-ux`; [Peter's original brief and clarifications](../../../../../docs/FEED-IA.md#224).
The [flagship Cedar handoff](HANDOFF.md) assigns the broader onboarding, email and phone work
while this proof retains ownership of the WhatsApp integration and runtime.
The [working implementation and product integration contract](IMPLEMENTATION.md) maps verified
behavior, existing API/source and the exact full-Cedar UX wiring work.

Peter selected three communication channels: WhatsApp, email and phone. The first work package
proves real Meta Embedded Signup and permitted history import from a customer's WhatsApp Business
account. Peter completed the first real connection and confirmed his history in the viewer. Email follows
through Unipile or a forwarding address; phone follows through Twilio and
Deepgram. The design and proposed capabilities can change as those proofs establish behavior.

## First proof

**Observed September 9:** real Embedded Signup, Business-app coexistence, chat-sharing consent,
verified account routing and actual history delivery succeeded. Peter confirmed his conversations
appear and the normal Meta popup closes. The [implementation record](IMPLEMENTATION.md) separates
that evidence from synthetic tests and the remaining channel/customer acceptance checks.
The [current deployment and repair receipt](deploy/verification-2026-09-09-48838752.json) records
2,214 messages across 112 conversations, zero failed batches and two actual outbound phone-app
echoes. The focused surface is the **Cedar WhatsApp demo**; its commissioned origin and callbacks
continue at `cedar-demo.soyrocoto.com`.

The acceptance is a customer completing Meta's own signup, approving their real Business app account,
and seeing its actual eligible conversations and messages appear in their private Cedar viewer.
The viewer opens during synchronization and reports observed counts, date range and progress.
Replay tests establish adapter behavior separately; their synthetic data cannot establish this acceptance.

This is an end-to-end prototype of the production-intended Meta integration. Acceptance includes
real Embedded Signup, eligible history arriving in the viewer, live incoming messages and persistence
across page reloads. The Meta application's customer-onboarding permissions, coexistence configuration
and routing need provider evidence; Cedar's development/demo lifecycle is independent of them.
The word prototype does not select Meta's child Test App feature. The published layout preview is
one supporting surface, while the actual account journey remains the completion criterion.

The isolated entry owns its setup content, API adapter and viewer. It imports existing theme and
message primitives. It uses its own server and protected storage, outside Cedar's fixture stores.
The entry keeps real chat content out of the prototype's analytics and session-recording bootstrap.
The shared kit and normal `app.html` entry retain their existing consumers and publication path.

The same setup content supports an opaque onboarding page and an in-app dialog presentation.
The page has Rocoto's logo at the top left, centered content with generous gutters, and privacy
links at the foot. Meta owns its login, business/number selection and permissions UI. Cedar owns
the explanation, return states, progress, recovery and conversation viewer.

Setup presents one decision or primary action at a time. The first screen asks “Do you use the
WhatsApp Business app?” and shows WhatsApp Business and WhatsApp as outlined choices with
app icons ([source provenance](assets/README.md)). Each has an independent View in app store link to help identify the
app; Apple devices open Apple's listing and other devices open Google Play. The links keep the
setup step and do not launch Meta. The main Business choice opens Meta synchronously from
the click. The regular choice opens download and chat-transfer guidance first. Its final action,
My chats are in WhatsApp Business, confirms readiness and opens Meta in the same click.
Reaching or reloading the transfer step never launches Meta automatically. This action is
separate from Meta's history-sharing consent. Meta collects the number, verifies the account
and asks the customer to approve sharing. Cedar requests the provider-approved history after
signup and displays Meta's actual sharing outcome. One Privacy and chat sharing disclosure
contains the detailed account, history and phone-app information; it stays accessible inside
the dialog.
The real SDK remains directly attached to the customer's click, including after transfer help.
The public `transfer` URL parameter preserves the download or transfer step across a reload.
Device hints choose phone/tablet store links or a desktop QR; a narrow desktop retains its QR.

For an existing Messenger account, WhatsApp's official phone-app migration transfers the number,
chats and media to WhatsApp Business. The connecting business performs that step; its customers
can continue using their existing WhatsApp app. Cedar's transfer help supplies the official
iPhone and Android store links and a desktop QR to `/download/whatsapp-business`. That public
endpoint redirects Android to the Business app's Google Play listing and Apple devices to its
App Store listing, including iPad Safari's desktop user agent. Unknown devices receive the
existing public instructions with both store choices. Redirects use fixed destinations, vary by
browser device headers and stay uncached. The QR contains only a public download URL. Meta
owns the separate authorization and history-sharing flow.

The actual Meta entry remains one action for an existing Business app user. The documented
`is_on_biz_app` check requires an authorized provider phone-number ID after signup. A raw number
entered on a public Cedar screen cannot stand in for account authorization or establish the type
through that API. `true` confirms Business app use; `false` alone does not identify a regular
WhatsApp account. Cedar verifies this field together with `platform_type` before connecting.
Meta documents a phone-prefill option, but a number alone cannot resolve which app the customer
uses. Cedar therefore uses Peter's app-choice fallback and leaves number entry with Meta.
For Business-app onboarding, Meta documents errors 2655095/2655048 for a number that is not
registered in the Business app. An inline error need not close the Meta window or produce a
specific classification in Cedar: cancellation and error events retain a retry path. Cedar never
substitutes an ordinary Cloud API registration when coexistence fails. The 24-hour synchronization
window follows successful coexistence onboarding; typing a number or failing eligibility is a
separate stage. The backend verifies coexistence and callback routing before its once-only requests.
The Messenger-to-Business transfer and the Business-to-Cedar history feed are separately observable:
the first is WhatsApp's supported migration, while the second is proved through the real import.

| Stage | Observable result |
|---|---|
| Browser setup | A short-lived browser session opens Meta; private account access follows verified Meta authorization |
| Meta readiness | Server credentials and the private receiver are configured; the actual Meta flow validates the selected signup configuration, allowed origin and customer consent |
| Authorization | Meta supplies a short-lived code; the server exchanges it immediately and holds the resulting customer token privately |
| Number connection | Server verifies WABA membership, the exact phone ID, `is_on_biz_app` and `CLOUD_API`; coexistence keeps registration with the Business app |
| Callback routing | One subscription request installs Cedar's callback for the sole-number WABA; readbacks verify the account override and effective phone route while preserving the app default |
| History choice | Cedar explains the choice; Meta's actual consent/result determines sharing |
| Synchronization | Contacts/history requests are issued once within Meta's window; signed events are captured durably and projected by provider IDs |
| Conversation viewer | Real imported and new messages appear progressively with stable ordering, pagination and attachment availability |
| Verification | Duplicates, delayed/out-of-order chunks, media enrichment, declined sharing and interrupted import have explicit evidence |

The first viewer is read-only. Importing old messages builds history/context. Live order creation,
outbound messages and PDF parsing have their own later proof; an imported order request is historical
evidence until deliberately selected for further processing. Recent media metadata is preserved so
the retrieval/parsing proof can use an actual attachment rather than a simulated success.

## Current provider facts

These are researched constraints, not Rocoto account commissioning or successful provider tests.

- Meta coexistence exposes eligible one-to-one history for up to 180 days. Group conversations
  are outside that history feed; media asset IDs are supplied for the recent 14-day window.
  Chunks can arrive out of order and later events enrich media placeholders.
  [Meta history reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/history?locale=en_US).
- Contacts/history synchronization is one-time per onboarding and has a 24-hour deadline.
  Meta records declined history sharing independently of a working number connection. Phone-app
  outbound messages arrive through `smb_message_echoes`.
  [Meta coexistence](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users?locale=en_US).
- Embedded Signup v4 is selected by a new Login for Business configuration. The coexistence
  example's `sessionInfoVersion: "3"` describes the event payload schema; it is separate from the
  signup version. The authorization code expires after 30 seconds, so code exchange starts before
  waiting for the other signup event data.
  [Meta implementation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation?locale=en_US),
  [versions](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions?locale=en_US).
- Phone callback overrides are configured on the phone ID and take precedence over WABA/app
  callbacks. They divert the supported fields rather than copying them. Account updates retain
  the app's default callback. Read existing routing before applying an override; the proof must
  preserve another consumer's routing.
  [Meta callback overrides](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/override?locale=en_US).
  The current [Subscribed Apps API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api)
  supports a subscription request containing `override_callback_uri` and `verify_token` together.
  Cedar uses that combined request with a sole-number WABA and verified ownership. Provider
  rejection or uncertain outcomes stop setup; a bare-subscription fallback is outside this contract.
  Read both the account subscription and effective phone routing before contacts/history sync.
  Preserve the app default and existing consumers. Ordinary `account_update` events remain on
  the app default; a synthetic check of the maintained handler established that the documented
  event shape is acknowledged without message processing. That source check is separate from a
  deployed-runtime fingerprint. The selected account's real subscription subsequently succeeded.
- Regular WhatsApp supports transferring account history/media into the WhatsApp Business app.
  Meta then evaluates coexistence eligibility separately and may require additional Business-app
  activity (error 3441045). Exporting the converted account's older history requires a separate
  real proof; those two documents do not guarantee immediate eligibility or complete transfer into
  Cedar. [WhatsApp account transfer](https://faq.whatsapp.com/665643701880397/?cms_platform=iphone&locale=en_US),
  [Meta eligibility errors](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/errors?locale=en_US).

### Earlier rejected attempts

These observations precede the successful connection documented above. They preserve the diagnosis
limits; they are not instructions to change the working configuration.

**Earlier signup observation, September 9:** Peter reaches Meta's number-registration screen
and receives an already-registered WhatsApp account error (`2494064`). His actual SDK URL
retains the documented coexistence `featureType` and `sessionInfoVersion`; the deployed bundle
matches source. The introduction identifies Leo.casa and includes Marketing Messages API and
Cloud API terms. Those observations do not establish a completed coexistence connection.
Current [v4 documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4)
supports Business app onboarding and describes a phone-first UI, so the screen title alone
cannot diagnose a fallback. The selected configuration's login variation, products and actual
Business-app option initially required inspection. Peter's subsequent dashboard paste confirms
WhatsApp Embedded Signup, WhatsApp Cloud API plus Marketing Messages API for WhatsApp,
a system-user access token, WhatsApp accounts and the two WhatsApp permissions. Meta explicitly
supports the marketing product together with coexistence in its
[business onboarding guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/onboard-business-customers/).
Their combination alone therefore does not explain this rejection. The actual customer-flow
choices were initially under inspection; Peter subsequently confirms the introduction leads
directly to number entry, with an empty existing-number selector and an option to add one.
He observes no existing-Business-app connection choice. Eligibility was then unverified; the
general Standard Access warning is not
an observed permission access-level label. Public app metadata returns the configuration ID/name;
a direct configuration-node metadata read returns Graph 100/subcode 33. Keep the existing
Business app registration and chats while resolving this provider-flow issue. Changing launch
flags, registering a fresh Cloud API number or deleting the phone account would be an
unverified change. Real authorization, routing and history acceptance were still pending at that point.
Peter subsequently confirms the Meta app is **Live** and the signup uses a different Facebook
login from the app administrator's. This supersedes the earlier dashboard paste's Development
label. A customer's distinct Facebook login is expected; it does not establish the cause of
the rejection. Cedar's own environment remains development/demo independently of Meta app mode.

A fresh read-only Graph check at 20:04 UTC on September 9 confirms an active application
subscription containing `history`, `smb_app_state_sync` and `smb_message_echoes`, with the
existing app callback preserved. Both WhatsApp permissions still report `live`. Together with
Peter's actual popup URL, these observations cover the launch flag, permissions and webhook
subscriptions in the suggested prerequisite checklist. The check made no provider changes;
the selected customer's callback routing and real history import were verified later through the
successful journey. Meta's documented activity requirement does not establish a fixed seven-day threshold.

**Earlier diagnostic proposal:** retry the unchanged signup in a fresh private browser session.
A [resolved report on Chatling's own issue tracker](https://chatling.featurebase.app/p/connect-a-whatsapp-business-app-option-missing-in-coexistence-flow)
describes the same missing-option/registered-number sequence and reports success using Incognito
after the maintainer's retry instruction. This is firsthand workaround evidence, not an established
Meta caching diagnosis; the maintainer's underlying change is undisclosed. Cedar's current served
launch still matches the official coexistence sample. The app is Live and a separate customer
Facebook login is expected.

The existing configuration subsequently completed coexistence and history sharing. A proposed
comparison with a new Cloud-API-only configuration was unnecessary and was not performed. Peter
reported changing the Facebook login and an earlier account's 2FA situation; those changes were
not isolated, so the original `2494064` cause remains unattributed. Preserve the working provider
configuration and the actual successful journey as the integration baseline.

### Private signup diagnostics

The reported-number failure exposed a separate, reproducible issue: Cedar discarded Meta's
structured `CANCEL`/`ERROR` data. The adapter now sends a bounded support report to
`POST /api/proof/whatsapp/diagnostics` during an explicit signup attempt. It retains only event,
numeric error code, failed step, provider support session reference and provider timestamp.
The server adds its receipt ID, observed time and configured app/configuration/Graph version.
These are browser-reported diagnostics; they establish neither provider authorization nor account
ownership. Provider error text, OAuth codes, tokens, selected assets and conversations stay out
of the report. Numeric metadata is accepted as a number or string at the browser boundary;
the API accepts its strict normalized form.

Authorization stops immediately on cancellation and expires after five minutes. A separate
support listener remains for at most 30 minutes after the explicit launch, ending earlier on
the next attempt, component unmount, explicit pause or successful connection. Late support
events can be retained after authorization has stopped; late codes and success events stay inert.
Bare cancellation/error events and later enriched reports are retained separately with local
duplicate suppression and a ten-report cap. Transport errors and server 5xx responses receive
at most two retries with the same receipt key. The UI shows delivery in progress, a confirmed
server receipt or a failed delivery; a failed report does not replace the signup error.
Delivery still requires an active unbound browser session and a provider postMessage while the
page is listening; a reloaded page cannot recover an earlier lost report. Exact Meta origins and an exact
Cedar request origin apply. The private encrypted ring retains at most 200 reports for seven
days, with durable rate limits and idempotent receipts. It has no public read endpoint. Operator
inspection uses [diagnostics.py](proof/diagnostics.py) with the selected runtime environment file;
the CLI reads only the diagnostics row through a read-only database connection.

The parser, cancellation/expiry ordering, private endpoint/storage and browser interception have synthetic
tests. Those tests establish reporting behavior; the subsequent real account run establishes
coexistence, consent, scoped routing and imported history independently.
The native publisher deployed this change at `2417e69e` after Peter renewed Tailscale access.
An actual HTTPS request carrying an explicitly synthetic `SYNTHETIC_QA` event was read back
through the private operator CLI; the served bundle matches the package. The selected Meta
configuration and provider environment remained unchanged, as did maintained service PIDs and
Caddy configuration. [Deployment receipt](deploy/verification-2026-09-09-2417e69e.json).
The subsequent [lifecycle deployment](deploy/verification-2026-09-09-c46f1059.json) publishes
`c46f1059`: delayed support capture and visible receipt/failure. Its actual HTTPS synthetic probe
delivers after the old one-second cutoff and confirms the private receipt and on-screen acknowledgment.
At that verification point, the actual customer report and provider rejection remained unresolved.
The later successful signup is recorded above; the original missing report was never received.

Rocoto's company register identifies Meta app `1427034652248456`. The existing site's
[`conectar/index.html`](https://github.com/Rocoto-Labs/site/blob/main/conectar/index.html) records
Login for Business configuration `4618748161700706`; its older code uses Graph v23 and describes
Cloud API permissions. Cedar's actual coexistence journey is the current integration evidence.
September 9 read-only Graph requests verified app `1427034652248456` as Rocoto and configuration
`4618748161700706` as belonging to it. The privately supplied app secret is installed in the
isolated preview. Its active WhatsApp callback is `https://api.soyrocoto.com/meta/whatsapp/webhook`,
which remains with its existing consumer. Coexistence configuration and scoped callback routing
are verified through the actual connection journey. The [initial deployment receipt](deploy/verification-2026-09-09.json)
distinguishes those initial read-only provider checks from the subsequent real account/history proof.
An additional read-only `/permissions` response reports `whatsapp_business_management` and
`whatsapp_business_messaging` with status `live`. That is observed permission status; it does not
by itself establish the selected signup configuration, coexistence eligibility or completed import.
The app's public domain is `soyrocoto.com`, with its website, privacy policy and terms URLs configured.
The [provider receipt](deploy/provider-verification-2026-09-09.json) preserves these observed values
and the limits of that evidence separately from synthetic tests and actual customer authorization.
Use company-owned access according to [Operations](../../../../../docs/omitted-sources.md).

The maintained [webhook route](../../../../../backend/app.py) and its
[tenant resolver](../../../../../backend/tenancy.py) can route an unknown phone to the configured
default tenant. The combined account subscription installs the dedicated receiver in the same
documented request. This proof preserves the existing app callback and tenant resolver; it verifies
the resulting selected-account routing before asking Meta for history.

## Source relationships

The prior Cedar screens are in [activation-web.tsx](../activation-web.tsx) and
[Administration Connections](../areas/admin/connections.tsx). They contain preparation/fixture
behavior, including earlier forward-only history wording. This proof establishes the real flow
before replacing those surfaces. Its imported messages use a separate source and storage boundary.

Existing maintained backend examples establish provenance:
[wa_onboard.py](../../../../../backend/wa_onboard.py),
[wa_coexistence.py](../../../../../backend/wa_coexistence.py),
and the channel routes in [sup_api.py](../../../../../backend/sup_api.py).
The isolated proof is Cedar-owned experimental code. Any ongoing shared use or maintained-product
adoption requires an explicit owner/dependency, its applicable contract, and integration evidence.

## Email proof after WhatsApp

Use Unipile's real hosted authorization for Gmail, Microsoft 365 and supported other mailboxes.
Read a real account's paginated historical messages, receive new-mail/sent-mail events, fetch an
actual attachment, and prove the selected parser with that attachment. Preserve provider message
and thread IDs through retries and replies. The existing
[email-provider.ts](../email-provider.ts) is a candidate adapter seam.

An assigned forwarding address is a separate ingress method. It receives forwarded mail;
connected-mailbox authorization supplies mailbox history and sent-mail synchronization. Keep the
original sender, forwarding provenance and attachment evidence visible.
[Unipile hosted authentication](https://developer.unipile.com/docs/hosted-auth),
[email retrieval](https://developer.unipile.com/docs/retrieving-emails).

## Phone proof after email

Twilio owns telephone call control. Deepgram supplies live transcription. The planned hierarchy is
**customer chat → call → transcript**, with independent transcript expansion and call minimization.

- A persistent call indicator shows the person, elapsed time and current call state. Opening it
  returns to that customer's chat/call. Its final position is a design choice to review.
- Inbound routing can ring the browser and a separately reachable mobile destination, with the
  first answer canceling the others. Test voicemail winning the race. Forwarding a business
  number to Twilio and dialing that same number back would create a forwarding loop; choose a
  separate destination or a mobile Voice SDK endpoint.
- Caller ID verification and inbound routing are separate setup steps. Twilio's caller-ID API
  returns a code and calls the number for the user to enter that code. Purchasing/porting a
  Twilio number and configuring carrier forwarding establish the incoming route.
- The web app's authenticated server holds the call session's parent/child IDs, so ending the
  call from Cedar terminates the appropriate legs even when the salesperson answered by phone.
- A passive two-track media stream reaches the server and Deepgram. Interim words are provisional
  display; finalized utterances form the stored transcript. Each completed call retains its
  transcript and source timing in the chat.
- Order extraction consumes finalized speech deltas at utterance/turn boundaries with bounded
  debounce and maximum batch size. Keep source spans and idempotent draft revisions; measure
  latency, accuracy and cost before selecting thresholds. Reprocessing every interim word or
  splitting only by character count loses corrections and sentence context.

Sources: [Twilio simultaneous destinations](https://www.twilio.com/docs/voice/twiml/client),
[caller-ID verification](https://www.twilio.com/docs/voice/api/outgoing-caller-ids),
[call control](https://www.twilio.com/docs/voice/api/call-resource),
[media streams](https://www.twilio.com/docs/voice/twiml/stream),
[Deepgram endpointing](https://developers.deepgram.com/docs/understand-endpointing-interim-results).

## Hosting and delivery

Code and builds live in the task's worktree on `rocoto-dev`. The
[public setup preview](https://cedar-demo.soyrocoto.com/?preview=setup) runs on `rocoto-staging`,
which also hosts the separate staging environment. Its hostname, runtime identity, private data
directory, callback and consumer are **demo/development**, recorded in the existing project/service
registers. A distinct origin isolates browser storage. Real provider usage retains that classification.

The source PR is independently reviewable. Merging `main` publishes shared demo/staging, so this
task leaves its PR for review until publication is requested. A separate preview's provisioning
is accounted for independently; ordinary builds and tests stay inside this worktree.

The first live run needs the approved Meta configuration, company-owned protected app credential,
reachable verified callback, isolated encrypted storage and browser sessions ready together.
Keep the Business app open during import. Retain actual result counts/date range and bounded
verification evidence privately; store source and aggregate receipts without conversation content
in the repository. Any eventual removal of the preview includes checking its callback, active
connection, retained data and provider access.

Stable adapters and replay/integration tests carry useful work into later UX iterations. Provider
changes, reconnection and operating failures remain maintenance responsibilities as the product grows.

## Run and verify

From the owning worktree, install the repository's pinned dependencies with `make install`.
The isolated build uses the same locked frontend packages and has its own output directory:

```sh
node app/src/prototypes/cedar/connections/build.mjs
node app/tools/test-cedar-connections.mjs
.venv/bin/python -m pytest -q app/src/prototypes/cedar/connections/proof
```

`make gates` covers frontend types, theme/copy and the ordinary repository contracts.
`make test` includes the browser protocol and backend replay tests; CI also builds this entry
and explicitly lints its Python source after installing dependencies. The normal Cedar build
continues to use its existing entry.

Published provider configuration follows the shared [native materializer](../../../../../docs/omitted-sources.md):
committed public settings identify this consumer, and concrete company `op://` references resolve
its private values. Cedar's reference example awaits owner-created, source-matched items. The
installed protected environment remains usable for source publication while that custody step is
completed; preserve its encryption and verification values with the existing state. The retired
reviewer access-code value can remain in an existing environment file and is ignored by this flow.
Use the [registered development publisher](deploy/README.md#redeploy-a-reviewed-revision) for updates.

For operator commissioning, the [configuration helper](configure.py) takes the existing Meta app
secret through hidden terminal input. Customer onboarding takes place entirely in the browser.
The helper preserves saved values and creates an ignored, current-user-owned `0600` environment
file. Its public IDs default to the recovered Rocoto values.
The published preview origin is `https://cedar-demo.soyrocoto.com`.
For the existing deployed preview's credential handoff, `configure.py --app-secret-only` asks
one hidden question and preserves other saved values. The operator transfers that one field
to the dedicated runtime environment; provider review remains separate from key presence.

```sh
.venv/bin/python app/src/prototypes/cedar/connections/configure.py
.venv/bin/python app/src/prototypes/cedar/connections/proof/run.py \
  --env-file .env.cedar-connections.local --preflight
.venv/bin/python app/src/prototypes/cedar/connections/proof/run.py \
  --env-file .env.cedar-connections.local --port 4182
```

The customer opens the actual Meta flow using the configured Rocoto app and configuration.
Meta validates the allowed SDK/OAuth origin, available products and account consent. A provider
configuration error is a visible setup result to resolve in the existing app dashboard. A manual
`CEDAR_PROOF_SIGNUP_REVIEWED_FOR` marker is no longer required to attempt that flow.
The backend accepts only the coexistence completion event, independently verifies the actual
Business app number, audits consumers, and verifies scoped routing before requesting history.
Record the observed configuration/version and account results; configuration ownership alone
does not prove Embedded Signup v4 or customer onboarding readiness.

The runner binds to loopback behind the preview's HTTPS reverse proxy. Preflight checks local
configuration and prints only missing/invalid variable names. Each account's callback behavior and
history import are verified through its real authorization. The protected
page opens at `/`; `/?presentation=dialog` presents the same content in its modal shell.
See the [demo deployment](deploy/README.md) for runtime identity, custody and rollback.

`/` and `/?preview=setup` open the same real customer onboarding. `/?presentation=dialog` uses
the same content in a dialog. The browser starts an unprivileged session, then opens the actual
Meta SDK. The first visitor and a returning customer use the same entry; all account and message
reads resolve to the session's verified account. Customer setup uses Meta's UI throughout.

The [account registry](proof/accounts.py) owns opaque browser sessions and separate encrypted
account stores. Unbound sessions expose public setup configuration for 30 minutes. The server
exchanges Meta's code immediately, verifies access to the exact WABA and phone, then rotates into
an eight-hour account session. Session tokens stay in Secure, HttpOnly, host-only cookies;
only their hashes and encrypted bindings persist. Existing root-store data retains its location,
while additional accounts have private directories with derived names. Signed webhook entries
resolve to their known WABA and retain the existing exact-phone validation.

The page pauses state polling during Meta signup and connection, discarding older in-flight
responses while retaining the displayed setup. Polling resumes after the connection response
installs its rotated cookie, including when a verified account's later provider step reports an error.

A fresh Meta authorization can reopen a completed connection after the import window. That path
checks provider authority and grants access to saved chats without replaying subscription or sync.
Full product identity, team membership and roles remain an explicit maintained-product adoption.

State, signed events and valid browser sessions persist encrypted outside source. A restart
marks pending setup interrupted. Accepted one-time provider requests stay recorded; uncertain
outcomes require operator reconciliation before another request. Saved account state records the
observed authorization, while revocation/account-health verification remains separate.

Meta's 100% value reports provider synchronization completion. Local pending/failed projections
remain visible separately through the import state; the receipt records observed counts/date range.
The protocol provides no total expected message count for proving every eligible message arrived.

The protocol, Graph transport and signed history/contact/live/echo tests use **synthetic** inputs.
The published preview also has actual HTTPS/browser/privacy checks and read-only Meta app/configuration
identity evidence. Peter's real account authorization, verified routing and visible history have
now passed. Live-message delivery and separate-customer access require their own evidence; each
customer authorizes the account they manage through the same UI.

For the browser proof after building, run:

```sh
.venv/bin/python app/src/prototypes/cedar/connections/browser-drive.py
```

It uses the repository's pinned Playwright, an ephemeral loopback server and intercepted API/SDK
responses. It checks session recovery, delayed connection and cookie rotation, returning-account
reloads, expired-session clearing, setup/dialog, imported-history pagination and automatic updates
at desktop, 390px and 320px widths. Screenshots and a synthetic-only receipt stay under
`/tmp/cedar-ux-browser/synthetic/`; the drive makes no provider calls.
