# Cedar WhatsApp demo: handoff to the full Cedar product

Cedar is Rocoto's evolving product prototype. Its WhatsApp integration has now completed real Meta
Embedded Signup, Business-app coexistence and history sharing. Peter sees his real conversations;
the successful Meta popup closes. Read-only runtime checks verify account/phone ownership,
account-specific callback routing and accepted contacts/history requests. Preserve the actual
[connection proof](README.md) in [PR81](../../../../../docs/omitted-sources.md).
The [verified runtime](deploy/verification-2026-09-09-48838752.json) contains 2,214 messages across
112 conversations after the local import repair, with zero pending or failed batches. Two actual
messages sent in the phone app arrived through Meta's outbound echo feed.
Use the [working implementation and product integration contract](IMPLEMENTATION.md) for the
actual API, source-to-UX mapping, state transitions, recovery and integration sequence. Both tasks
work on Cedar: this one owns the proven functional integration and its implementation documentation;
the other owns the holistic product experience and its integration across the three channels.

## Ownership and integration

The connection-proof task owns the current WhatsApp adapter, `connections/proof/`, its private
runtime, and the waiting/recovery fix in `connections/app.tsx`. Support for Meta's opaque contact
user IDs found in real history is deployed and the saved batches are repaired. Coordinate changes to those files and the
provider callbacks, state and environment with that task. The flagship Cedar task owns the full
product UX, onboarding integration and the new email/phone work; build those alongside the
WhatsApp work with separate files. Reuse the proven provider/session layer and its constraints.

Work in the task's own branch/worktree and follow current repository engineering guidance. Keep
experiments scoped to Cedar, preserve unrelated foundation/shared-kit work, and leave a reviewable
PR. The commissioned Cedar preview is **development/demo**, even with real providers and private
customer data. Use the owning preview's declared publisher. Main merges publish shared demo and
staging, so merging or product publication requires its own selected scope.

## Product work to finish

- **One onboarding experience:** reusable Cedar content inside either an opaque onboarding page
  or a settings dialog; Rocoto mark, generous gutters, clear centered content and footer privacy
  links. Each step presents one primary action. Setup also remains accessible from settings.
- **WhatsApp:** integrate the real Meta flow, history-sharing outcome, visible progress, recovery,
  connected account and conversation viewer into the flagship prototype. Meta owns number
  verification and permission screens. Business-app users connect directly; regular-app users get
  transfer/download guidance. Peter observed Meta itself messaging a regular-app user to install
  Business. Use the device-aware store link and desktop QR. Keep the existing phone app and chats.
  Reauthorization reopens saved imports; preserve the once-only provider sync guards.
- **Email:** deliver real Unipile authorization for supported mailbox providers, initial historical
  messages, new-mail/sent events, threads and attachments. Also design an assigned forwarding
  address as a separate intake path; forwarding supplies forwarded messages, while mailbox
  authorization supplies mailbox history. Preserve sender and attachment provenance. Prove a
  real PDF/attachment through the selected parser, with its source message available for review.
- **Phone:** use Twilio for real inbound/outbound calls and Deepgram for live transcription. From
  any customer chat with a callable number, users can call. Ring the browser and a distinct mobile
  destination; first answer cancels the other ringing leg. Test voicemail and forwarding loops.
  Provide incoming, dialing, ringing, active, ended and error states with normal call controls.
  A persistent active-call indicator shows who and elapsed time and opens the relevant chat.
  Hierarchy: customer chat → call UI → expandable live transcript. Calls and transcripts can be
  minimized independently; finished calls retain an easily opened full transcript. Ending a call
  through web or phone must terminate the appropriate Twilio call legs. Twilio number/forwarding
  setup and caller-ID verification are separate steps; use the actual provider verification flow.
- **Live order drafting:** feed finalized speech/message deltas into the order system with
  utterance boundaries, bounded batching and idempotency. Show draft changes with their source
  evidence and review state. Measure latency, accuracy and cost before choosing batch thresholds.

## Evidence and delivery

Build UX and isolated provider proofs together so provider constraints shape the final experience.
Each channel needs an actual connection, historical/live data where supported, reload/reconnection,
error recovery and visible end-to-end results. Clearly distinguish fixture tests, real provider
checks and verified results. Customer notifications need an explicit browser/mobile delivery design;
an app-store release is not a blanket prerequisite for browser notifications.

The WhatsApp owner-account run proves this account's real path. Separate-customer permissions,
fresh regular-to-Business history behavior and new-message arrival remain explicit checks until
verified. Peter's visible-history confirmation and Meta's progress100 do not establish an expected
total for every eligible message. Keep real conversations and credentials in the protected consumer
store; record source, aggregates and verification receipts separately.

Use Rocoto-owned provider access and existing company records. Commission missing access through
the company's private credential route; do not substitute another company's account. Finish and
verify the selected work autonomously, raising only meaningful product choices or required account
access. Provider changes and reconnect/recovery remain ongoing maintenance responsibilities.

## The browser's one reading of that connection (FEED-IA §246 · §247.2, 11 September 2026)

> «same for emailabout the connection state. always we havbe to be super consistent and not fget
>  people igo confusing menus when they shouldnt see them» — Peter, 11 September 2026

The provider service in this folder is unchanged. What changed is the one place outside it that
decides what a WhatsApp entrance may draw: [`whatsapp-capability.ts`](../whatsapp-capability.ts),
the WhatsApp counterpart of [`phone-capability.ts`](../phone-capability.ts). It is pure — the
polled `/state` snapshot in, one posture out — and it is what the Connections card, the connected
inbox, the Business setup card, onboarding and the chat composer all read now.

- **Five postures, three words.** `checking · unavailable · setup · partial · ready`, and
  `whatsappStatusWord` says `Connected`, `Finish setup` or `Connect WhatsApp`. Every posture short
  of a connection presents the same picture and the same one act (`WhatsAppSetupState`).
- **The workspace match is strict.** `connection.workspace === sector`, the rule
  `whatsapp-intake.tsx` already applied at every mutation boundary. A connection bound to another
  house reads `partial` here and lends this workspace no number.
- **`partial` has two causes, and the card tells them apart.** `needs: ['account']` is a Meta walk
  left half way through: the card keeps **Finish setup** and the door that resumes it.
  `needs: ['workspace']` is an account bound to another workspace, and that binding is the
  OPERATOR'S — `config.workspace_for(wabaId, phoneId)` reads `CEDAR_PROOF_WORKSPACE_BINDINGS`
  ([`proof/service.py`](proof/service.py) `:71-81`, `:292-295`, `:624-626`) and
  [`proof/storage.py`](proof/storage.py) `:283-284` keeps an existing binding where it is. Meta's
  signup therefore returns the same answer however many times it is walked, so the card and the
  Team numbers guard say **This WhatsApp account is set up for another workspace.** and carry no
  act. Moving that binding is an operator change to this folder's configuration.
- **The send disc is the person's door, in every posture.** `wa.me` opens in the person's own
  WhatsApp exactly as `mailto:` opens in their own mail client, so the composer's disc stays live
  and this connection gates what ROCOTO performs — which is stated in words under the box beside
  one **Connect WhatsApp** act. [`../CHANNEL-SEMANTICS.md`](../CHANNEL-SEMANTICS.md) §3 holds it.
- **`rocoto-cedar-whatsapp-selected-v1` is a VISIT, not a connection.** It is written by opening
  the setup door and it carries no vote anywhere; the workspace reset returns it to false.
- **Reset.** `whatsapp-connection.tsx` listens for `rocoto:cedar-workspace-reset` and
  `rocoto:channel-workspace-reset` and returns its store to its initial posture, the way
  `phone-runtime.ts` does.

Proved by `app/tools/test-whatsapp-capability.mjs`, `drives/drive-cedar-operations-hub.py`,
`drives/drive-cedar-onboarding.py` and `drives/drive-cedar-channels.py`.
