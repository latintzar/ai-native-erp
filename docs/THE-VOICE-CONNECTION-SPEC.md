# THE VOICE CONNECTION SPEC — Human calling, routing, custody and product contract

**Canonical domain contract:** human telephone connection for Settings, Messages, Customers and the mobile application.

**Status:** top-down design and wiring specification, plus — since §196.6 — the KIT's working operator flow against the kit runtime. Parts VOICE-00…VOICE-16 remain the production contract and imply no provider account, purchased number, regulatory approval, Voice SDK registration or recording consent. PART TWO (VOICE-17…VOICE-23) states what the kit actually does today: Google Places identity, Twilio in and out, Deepgram's diarised Spanish transcript, each through the kit runtime, each with an honest posture when it is out of reach.

**Version:** `2026-09-04/v2` (was `2026-09-02/v1`). ⚠ PART TWO repeals VOICE-01A.1's «the Kit performs no provider request» and VOICE-07B's «Not requested» Places seam; both repeals are stated in place there.

**Authority boundary:** this document owns the human phone rail: provisioning a business line, receiving and placing calls, routing calls to salespeople, optional fallback to a salesperson's phone, call records in Messages, recording/transcription custody, and unknown-caller assignment. `IN-CALL-RUNTIME-DESIGN.md` continues to own the separate AI voice runtime. A human call must never be handed to that runtime merely because both use Twilio.

---

## VOICE-00 · Product decision

Rocoto adds **Phone** as a peer communication channel beside WhatsApp and email. It is one connected object graph, not a dial button glued to the existing AI call demo.

The product promises only what it can prove:

1. An eligible, approved telephone number can be connected to the tenant.
2. Inbound calls can ring the right logged-in salesperson and, when configured, fall back to a verified alternative phone.
3. An authorized salesperson can place an outbound call with an approved business caller ID.
4. Every call has one durable lifecycle and one place in Messages, even when it uses several provider legs.
5. Recording and transcription remain off until the tenant has an approved notice/consent and retention policy.
6. Unknown numbers remain unmatched until evidence is exact or a person assigns them.
7. Calls may produce reviewed orders later, but call transport never depends on the AI runtime.

The following claims are explicitly forbidden:

- “Rocoto can always issue a French number.” Number inventory does not establish regulatory eligibility or the right to use it.
- “Forwarding preserves the original caller ID.” The setup test must prove what the carrier actually sends.
- “The call was recorded” before Twilio reports a completed recording through the recording callback.
- “The call was transcribed” before Deepgram returns a valid result bound to the expected call/recording revision.
- “This is Customer X” from a Google Places result, an approximate name, a prior tenant's data, or a non-unique phone match.
- “The mobile app will ring” because an FCM token exists. Delivery, SDK registration and answer are separate states.
- “The caller saw the business number” without a completed carrier test for that route and country.

---

## VOICE-01 · The four user journeys

### VOICE-01A · Connect a phone line

Settings uses a one-question-at-a-time journey. It never starts with Twilio terminology.

1. **Which business number do customers call today?**
   - E.164 number input with country picker.
   - The number is the business's source number, not yet a Rocoto line.
   - Ownership verification is required before it can become an outbound caller ID.
2. **Where is the business legally established?**
   - Country and registered address drive eligibility.
   - Rocoto checks provider inventory and regulatory requirements; it does not default to France because it is geographically close.
3. **Choose a connection path.**
   - **Use or port the existing number** when supported.
   - **Forward the existing number** to an approved Rocoto number.
   - **Add a new number** only where the business and use case qualify.
4. **Complete the required documents.**
   - Show the provider requirement, why it is needed and review state.
   - Do not ask for documents that the provider has not required for the selected number type.
5. **Set who answers.**
   - Choose one salesperson or a ring group.
   - Add schedule, order and fallback behavior.
6. **Add an alternative phone.**
   - Optional, per salesperson.
   - Verify the destination before it can receive fallback calls.
7. **Turn on forwarding with the carrier.**
   - Carrier-specific instructions are content, not a pretend Rocoto command.
   - The user confirms after changing their carrier setting.
8. **Run the two-call test.**
   - Call the source number from two distinct external numbers.
   - Prove that the app rings, the original caller number is preserved or identify that it is not, fallback works, audio is bidirectional and outbound caller ID is accepted by the carrier.
9. **Choose call-data handling.**
   - Metadata only is the safe default.
   - Recording/transcription can be enabled only after the tenant chooses an approved policy and notice.
10. **Ready.**
   - The final screen names the active business number, who rings, fallback, caller ID and recording policy.

The setup keeps every completed answer. Returning to an earlier step invalidates only dependent checks. Changing country or number type invalidates regulatory approval and inventory selection. Changing the source number invalidates caller-ID verification and the forwarding test.

#### VOICE-01A.1 · Kit preparation and forward-only history boundary

Connection starts with the number customers already call and applies from activation forward. It
imports no earlier call records, recordings, transcripts, voicemails, contacts, or WhatsApp history.
The prepared setup answers are tenant-scoped and persist through reload so an operator can resume;
provider credentials, document bytes and test media do not enter browser storage.

Before live provider eligibility, number procurement and the two real call tests pass, the exact
status is **Prepared · awaiting connection**. Conversation and Customer call controls either open setup or
remain disabled with that reason; they cannot create a local successful-looking call. A labelled
**Preview · no call** may show the configured source number, owner/ring group, schedule and verified
fallback draft. Preview performs no Twilio, Deepgram or Google Places request and writes no call,
recording, transcript or identity event. Only server-derived readiness can replace the prepared
state with Connected and enable real calling.

### VOICE-01B · Receive a call

1. Twilio calls the inbound webhook for a number owned by exactly one tenant connection.
2. Rocoto resolves the tenant from the called Twilio number. It never derives tenant identity from the caller number.
3. Rocoto creates a call session and immutable inbound leg event before routing.
4. The customer endpoint is normalized. One exact, active endpoint link may resolve the customer; zero or multiple links remains unmatched.
5. Routing resolves the customer's owner where configured, then the line's ring group and schedule.
6. Registered app clients ring. The mobile system call surface names the matched customer or shows the number and **Unknown caller**.
7. If no app client answers within the configured window, and the attempt was not explicitly declined, Rocoto sequentially dials the verified fallback destination.
8. A completed bridge becomes `connected`. Missed, busy, failed and canceled outcomes remain distinct.
9. Messages receives one call card backed by the call session. Provider legs do not create duplicate conversation items.
10. If unmatched, an assignment tray lets the operator link an existing customer, create a customer, or leave the caller unmatched.

### VOICE-01C · Place a call

1. The operator taps the phone icon in an open conversation or the new-conversation control.
2. Rocoto shows the exact destination, caller ID, recording policy and salesperson line before dialing.
3. The browser/mobile app requests a short-lived Voice Access Token and a server-created call intent. Raw arbitrary destinations are never trusted by TwiML.
4. The Voice SDK connects the operator leg. The TwiML application resolves the call intent and dials the customer.
5. The operator sees `Connecting`, `Ringing`, then the live timer only after the customer answers.
6. The customer sees the approved business caller ID only where the route test has proved it. The UI does not promise carrier display.
7. End, failure and no-answer are recorded once. A retry is a new call session linked by `retry_of_call_id`.

### VOICE-01D · Resolve an unknown caller

1. The call stays available as **Unknown caller · +E.164** and remains accessible in the unmatched queue.
2. Exact tenant-owned phone endpoint matches are evaluated first.
3. If no exact match exists, Rocoto may request a Google Places candidate using the E.164 number and region.
4. A Places result is shown as **Possible business from Google** with its returned phone and address. It is a suggestion only.
5. The operator chooses **Link customer**, **Create customer**, or **Leave unmatched**.
6. Assignment appends an event and changes the call projection; it does not copy or move the call.
7. Back returns to the exact scroll/filter state in Messages.

---

## VOICE-02 · Number and regulatory model

### VOICE-02A · France is an eligibility result, not a default

Twilio's current France guidance distinguishes multiple number classes and use restrictions. Local `+331`–`+335` and national `+339` numbers have French address/document requirements and are limited to manual or preview-dialed interpersonal calling; the listed technical-platform and verified-polyvalent ranges have different permitted use cases and document requirements. Availability can change and an available number may still be unusable until its regulatory bundle is approved. See [Twilio's France regulatory guidelines](https://www.twilio.com/en-us/guidelines/fr/regulatory), [France phone-number terms](https://www.twilio.com/en-us/legal/service-country-specific-terms/france-phone-numbers), and [Twilio regulatory onboarding](https://www.twilio.com/docs/phone-numbers/regulatory/getting-started).

Therefore:

- Rocoto asks for legal establishment, address, number purpose and desired capability before choosing a country or number type.
- Geographic proximity is not an eligibility or quality rule.
- A Spanish business that cannot satisfy French local/national requirements is not offered a false “French number ready” path.
- Porting or hosting the existing business number is preferred where feasible because it preserves customer muscle memory.
- A new number is purchased only after regulatory eligibility, address/bundle state and inventory are all current.
- Country, type, capabilities and use restrictions are stored as provider facts with `observed_at`; they are not embedded as permanent client constants.

### VOICE-02B · Provisioning state machine

```text
draft
  -> checking_eligibility
  -> documents_required
  -> under_review
  -> inventory_search
  -> number_selected
  -> purchasing
  -> configuring
  -> forwarding_required
  -> test_required
  -> ready
```

Any non-terminal state can enter `blocked` with a typed reason. `documents_rejected`, `inventory_unavailable`, `purchase_failed`, `configuration_failed` and `test_failed` retain the last safe state and a next action. `suspended`, `disconnecting` and `disconnected` are lifecycle states after activation.

The provider workflow uses two separate operations: search `AvailablePhoneNumbers`, then create an `IncomingPhoneNumber`; Twilio documents both through its [IncomingPhoneNumber API](https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource). The purchase command is server-only, idempotent and tied to an exact reviewed inventory result. A client cannot submit an arbitrary provider number SID.

### VOICE-02C · Source number, inbound number and caller ID are different objects

| Object | Meaning | Proof required |
|---|---|---|
| `source_number` | The number customers already call and the carrier may forward | Tenant attestation plus forwarding test |
| `inbound_number` | Voice-capable number owned/hosted by the tenant's Twilio connection | Provider ownership, regulatory approval, inbound callback test |
| `outbound_caller_id` | Number Twilio is allowed to present for outbound calls | Owned Twilio number or completed outgoing-caller-ID verification |
| `fallback_destination` | Salesperson phone dialed after app timeout | Destination verification and actor authorization |

Twilio supports verifying an external number as an outgoing caller ID through a verification call and code; that does not make it an inbound Twilio number. See [OutgoingCallerIds](https://www.twilio.com/docs/voice/api/outgoing-caller-ids).

Carrier forwarding is an external action. Twilio's `<Dial>` can preserve the inbound caller as the caller ID for a forwarded leg, but the upstream carrier may already have rewritten the number before Twilio receives it. The activation test records `preserved`, `rewritten_to_source`, `anonymous` or `unknown`. Automatic customer matching is disabled when preservation is not proved.

### VOICE-02D · Tenant isolation

Use one Twilio subaccount per Rocoto tenant unless a documented provider constraint requires a narrower pool. Subaccounts separate numbers, caller IDs, applications, calls and recordings; Twilio documents the isolation boundary in its [Subaccounts API](https://www.twilio.com/docs/iam/api/subaccounts). Rocoto still enforces tenant authorization because the parent account remains financially and operationally responsible.

Every inbound number has exactly one active `tenant_id`. Reassignment requires a two-sided migration command, callback drain and reconciliation. A webhook whose `AccountSid`, called number or provider alias cannot resolve uniquely goes to a metadata-only quarantine and never enters another tenant's Messages.

---

## VOICE-03 · Canonical objects

All provider identifiers are server-side opaque aliases in client DTOs. Every mutable aggregate has `tenant_id`, `revision`, `created_at`, `updated_at` and an append-only event history.

### VOICE-03A · `VoiceConnection`

```json
{
  "id": "vcon_…",
  "tenant_id": "ten_…",
  "provider": "twilio",
  "provider_account_ref": "pacc_…",
  "processing_region": "US1|IE1|AU1",
  "edge": "ashburn|dublin|sydney|other-supported-edge",
  "country": "ES",
  "number_type": "local|national|mobile|toll_free|hosted|ported",
  "source_number_ref": "phn_…",
  "inbound_number_ref": "phn_…",
  "outbound_caller_id_ref": "cli_…",
  "regulatory_requirement_ref": "reg_…",
  "regulatory_status": "not_started|documents_required|under_review|approved|rejected|expired",
  "forwarding_state": "not_required|required|claimed_enabled|verified|failed",
  "caller_id_preservation": "untested|preserved|rewritten_to_source|anonymous|unknown",
  "state": "draft|checking_eligibility|documents_required|under_review|inventory_search|number_selected|purchasing|configuring|forwarding_required|test_required|ready|blocked|suspended|disconnecting|disconnected",
  "capabilities": ["inbound", "outbound", "fallback_pstn"],
  "observed_at": "2026-09-02T12:00:00Z"
}
```

No raw API credential, full regulatory document, provider console URL or unredacted fallback number is returned to ordinary clients.

**Processing region is required configuration.** Omitting it silently uses Twilio US1 and is therefore
a configuration error for this rail. The restricted API key, TwiML App, number/caller-ID capability,
Android Push Credential, generated SDK Access Tokens, REST call resources and webhooks must all be
validated against the same Twilio account and processing region; the selected Edge is an explicit
transport route within that region. Region capability is checked before setup offers a route. In
particular, Twilio's current regional matrix does not support Verified Caller IDs in IE1, so **keep
the existing number as verified outbound caller ID** is unavailable there unless the provider later
reports and Rocoto proves that capability. See [Twilio regional Voice SDK configuration](https://www.twilio.com/docs/global-infrastructure/use-the-voice-android-sdk-with-a-non-us-twilio-region) and [regional product and feature availability](https://www.twilio.com/docs/global-infrastructure/regional-product-and-feature-availability).

### VOICE-03B · `VoiceRoute`

```json
{
  "id": "vrte_…",
  "connection_id": "vcon_…",
  "mode": "customer_owner_then_group|fixed_owner|ring_group",
  "owner_user_id": "usr_…",
  "ring_group_user_ids": ["usr_…"],
  "ring_seconds": 18,
  "fallback_mode": "none|owner_verified_phone|group_sequence",
  "schedule_id": "sch_…",
  "timezone": "Europe/Madrid",
  "explicit_decline_stops_fallback": true,
  "revision": 4
}
```

The route snapshot is copied by reference onto the call session at start so later settings edits do not rewrite historical routing evidence.

### VOICE-03C · `VoiceIdentity` and `VoiceDeviceBinding`

`VoiceIdentity` binds an app user to a server-issued Twilio client identity. The identity is tenant-scoped and opaque; it is never an email address or raw user id.

`VoiceDeviceBinding` records user, platform, device installation id, Twilio client identity, push channel, registration state, last registration/heartbeat and revoked time. It stores an opaque push/provider binding ref, not a reusable Voice Access Token.

```text
registration_state = pending | registered | stale | revoked | failed
reachability       = unknown | recently_registered | foreground_ready | unavailable
```

`recently_registered` is not a guarantee that the device will ring. Routing outcomes provide the truth.

### VOICE-03D · `CallSession`

```json
{
  "id": "call_…",
  "tenant_id": "ten_…",
  "connection_id": "vcon_…",
  "direction": "inbound|outbound",
  "source_endpoint_ref": "end_…",
  "destination_endpoint_ref": "end_…",
  "customer_id": null,
  "party_id": "pty_…",
  "assigned_user_id": "usr_…",
  "route_snapshot_ref": "vrs_…",
  "status": "requested|routing|dialing|ringing|connected|ended",
  "outcome": null,
  "recording_policy_ref": "rpol_…",
  "recording_state": "off",
  "transcript_state": "not_requested",
  "started_at": "2026-09-02T12:00:00Z",
  "answered_at": null,
  "ended_at": null,
  "retry_of_call_id": null,
  "revision": 1
}
```

`outcome` is set only at terminal `ended`: `completed`, `no_answer`, `busy`, `declined`, `failed`, `canceled`, `abandoned` or `provider_unknown`. `ended` and `completed` are not synonyms.

### VOICE-03E · `CallLeg`

A session can have many provider legs: inbound PSTN parent, app client child, fallback PSTN child, or outbound client parent and customer PSTN child.

```json
{
  "id": "leg_…",
  "call_id": "call_…",
  "provider_call_ref": "pcall_…",
  "provider_parent_call_ref": "pcall_…",
  "kind": "pstn|client|fallback_pstn",
  "party_role": "customer|operator|system",
  "direction": "inbound_to_twilio|outbound_from_twilio",
  "attempt": 1,
  "status": "queued|initiated|ringing|in_progress|completed|busy|no_answer|failed|canceled",
  "sequence": 7,
  "provider_timestamp": "2026-09-02T12:00:01Z"
}
```

Provider callbacks may arrive out of order. Projections fold by provider sequence/timestamp and terminal precedence; arrival time alone never reopens a terminal leg. Twilio documents status callbacks and the possibility of callback reordering on the [Call resource](https://www.twilio.com/docs/voice/api/call-resource).

### VOICE-03F · `RecordingRef`

A call can have more than one recording segment when an app attempt falls back to PSTN.

```json
{
  "id": "rec_…",
  "call_id": "call_…",
  "leg_ids": ["leg_…", "leg_…"],
  "provider_recording_ref": "prec_…",
  "channels": 2,
  "channel_role_map": {"0": "customer", "1": "operator"},
  "state": "requested|recording|available|processing|retained|deleting|deleted|failed",
  "duration_ms": null,
  "retention_deadline": null,
  "encryption_mode": "provider_default|customer_key",
  "revision": 1
}
```

The client never receives a provider media URL. Twilio's completed recording callback, not a call-completed callback, authorizes the transition to `available`. Twilio's [Recording resource](https://www.twilio.com/docs/voice/api/recording) states that deleting completed media is irreversible while limited metadata may remain temporarily.

### VOICE-03G · `CallTranscript`

```json
{
  "id": "trn_…",
  "call_id": "call_…",
  "source_recording_revisions": ["rec_…@2"],
  "provider_request_ref": "dgr_…",
  "language": "multi",
  "state": "not_requested|queued|streaming|processing|ready|corrected|expired|failed",
  "utterances": [
    {"speaker_role": "customer", "text": "…", "start_ms": 0, "end_ms": 1250, "confidence": 0.92}
  ],
  "retention_policy_ref": "ret_…",
  "revision": 1
}
```

The transcript is sensitive communication content. It is encrypted, access-controlled, retention-bound and excluded from logs, analytics dimensions and retained model prompts. Reviewed order/customer facts point to transcript evidence locators without copying the whole transcript.

### VOICE-03H · Identity candidates and assignment

`IdentityCandidate` records a proposed customer/account match with source, score and reasons. Durable exact facts are limited to tenant-owned phone evidence or caller self-identification. Allowed sources are `tenant_phone_endpoint`, `caller_self_identification` and `google_places`. A Google candidate is a transient response view: durable state retains only the permitted Google `place_id`, the Rocoto-owned caller phone evidence, request/policy revision, expiry and the person's decision. It does not copy the returned Google name, address or phone into candidate history. A score never performs the write.

`CallAssignment` is the command result: call id, previous/new party/customer, actor, reason, time and revision. Linking a call can create a tenant endpoint relationship only after collision checks. It cannot merge customers.

---

## VOICE-04 · State and event law

### VOICE-04A · Independent state machines

Do not compress transport, recording, transcription and identity into one status.

```text
call:       requested -> routing -> dialing -> ringing -> connected -> ended(outcome)
recording:  off | awaiting_policy -> requested -> recording -> available -> processing -> retained -> deleting -> deleted
transcript: not_requested -> queued -> streaming|processing -> ready -> corrected|expired
identity:   unresolved -> candidates_ready -> assigned | left_unmatched
```

Failures stay typed on their own axis. A completed call can have `recording=failed` and `transcript=failed`; a missed call has no recording but is still a valid Messages event.

### VOICE-04B · Canonical events

Every event uses the shared spine envelope, tenant scope, actor/provider source, occurred/observed time, schema version, idempotency key and opaque provider refs.

| Event | Minimum payload |
|---|---|
| `voice.connection.requested` | connection, source number ref, country/use-case facts |
| `voice.connection.regulatory_changed` | provider status, requirement ref, observed time |
| `voice.connection.number_provisioned` | inbound number ref, capabilities, provider receipt ref |
| `voice.connection.tested` | test run, per-check result, actor |
| `voice.device.registered` | identity/device binding ref, platform, expiry |
| `call.requested` | session, direction, authorized intent, route revision |
| `call.routed` | route snapshot, selected identities, reason |
| `call.leg.status_changed` | leg ref, status, provider sequence/time |
| `call.started` | connected session, answered time |
| `call.ended` | terminal outcome, duration, last leg revisions |
| `call.missed` | outcome and assigned recipients |
| `call.recording.started` | recording ref, policy/consent evidence ref |
| `call.recording.available` | recording ref, channels, duration, callback receipt |
| `call.recording.deleted` | recording ref, provider deletion receipt/outcome |
| `call.transcript.ready` | transcript ref/version, source recording revisions |
| `call.identity.proposed` | call, candidate refs, source/reasons |
| `call.identity.assigned` | call, old/new party, actor, reason |

Existing `call.started` and `call.ended` remain the cross-channel presence events. A projector may continue writing the legacy `calls` row and `call_transcript` message during migration; those tables are projections, not the new authority.

### VOICE-04C · Dedupe and reconciliation

- Status callbacks dedupe on tenant/provider-account alias + provider Call SID + callback event/status + sequence.
- Recording callbacks dedupe on provider Recording SID + status.
- Deepgram results dedupe on internal transcription job + source recording revision + provider request id.
- A periodic reconciler fetches nonterminal provider calls/recordings after callback timeout.
- Reconciliation appends a correction event; it does not mutate history silently.
- Unknown/ambiguous provider aliases go to a metadata-only dead letter with no audio or transcript.

---

## VOICE-05 · Exact transport wiring

### VOICE-05A · Inbound

```text
carrier forwards/ports business number
  -> Twilio inbound number
  -> POST /webhooks/twilio/voice/inbound
  -> tenant + connection resolution from AccountSid/To alias
  -> CallSession + inbound CallLeg
  -> route snapshot
  -> <Dial answerOnBridge="true" action="…/dial-result">
       <Client>one or more registered salesperson identities</Client>
  -> connected OR typed dial result
  -> sequential fallback <Dial><Number> only on timeout/unavailable policy
```

The fallback is sequential to prevent the app and personal phone from creating two answered bridges. An explicit app decline stops fallback when route policy says so; timeout, absent registration and provider failure may continue. A fallback destination is verified before activation and never supplied by an inbound request.

Inbound tenant resolution uses the called Twilio number and subaccount. `From`, `ForwardedFrom`, display name and custom headers are untrusted caller evidence.

### VOICE-05B · Outbound

```text
POST /v1/calls {customer_id|endpoint_id, connection_id, idempotency_key}
  -> auth + role + tenant + endpoint + capability checks
  -> short-lived call_intent (opaque, single-use, destination server-side)
  -> POST /v1/voice/access-token
  -> Twilio Voice SDK Device.connect({call_intent})
  -> TwiML App POST /webhooks/twilio/voice/outbound
  -> validate Twilio signature + resolve call_intent
  -> <Dial callerId="approved business identity"><Number>resolved destination</Number></Dial>
```

The Voice Access Token carries a tenant-scoped opaque identity and VoiceGrant. It is short-lived, actor-bound and never persisted. The browser cannot choose a TwiML App SID or arbitrary caller ID. Twilio documents the required AccessToken/VoiceGrant model in [IAM Access Tokens](https://www.twilio.com/docs/iam/access-tokens) and browser/mobile clients in [Voice SDKs](https://www.twilio.com/docs/voice/sdks).

### VOICE-05C · Recording and channel roles

Twilio dual-channel recording is the product term; “stereo” is acceptable only as explanatory copy, never as a role assumption. With `<Dial record="record-from-answer-dual">`, Twilio writes the parent call to channel 0 and the child call to channel 1. See [TwiML `<Dial>`](https://www.twilio.com/docs/voice/twiml/dial).

That means role mapping changes by direction:

| Bridge | Channel 0 / parent | Channel 1 / child |
|---|---|---|
| Inbound PSTN -> app client/fallback | Customer | Operator |
| Outbound app client -> PSTN | Operator | Customer |

The existing post-call code's fixed `channel 0 = caller, channel 1 = Rocoto` rule is valid only for the first row. Human outbound calling must persist leg roles and write the channel map when recording starts. It may never guess from channel index after the fact.

If consent must occur after answer, recording cannot start with `record-from-answer-dual` before the consent gate. The approved TwiML/REST flow must play the notice or collect required affirmation first and start recording only after that state is recorded. A declined caller continues without recording where policy permits; the UI shows **Audio off**.

### VOICE-05D · Live and post-call transcription

Post-call dual-channel transcription is the reliable authority:

1. Recording callback reports `completed` and channel count.
2. A worker authenticates to Twilio and streams the media response directly to Deepgram; no temporary object-store or local file is created.
3. The request uses Deepgram multichannel rather than diarization because each participant already has a physical channel. Deepgram documents the distinction in [Multichannel versus diarization](https://developers.deepgram.com/docs/multichannel-vs-diarization) and the feature in [Multichannel transcription](https://developers.deepgram.com/docs/multichannel).
4. The worker maps each channel through the stored leg-role map, validates duration/channel count and writes one transcript revision.
5. Only after successful policy processing does the audio deletion job run.

Optional live transcription uses Twilio unidirectional `<Start><Stream track="both_tracks">`. Twilio emits separate `inbound` and `outbound` track frames with timestamps; Rocoto must timestamp-align and interleave them correctly before using a multichannel streaming request. A mixed single channel may use diarization only as an explicitly lower-confidence preview. See [Twilio `<Stream>`](https://www.twilio.com/docs/voice/twiml/stream), [Media Stream messages](https://www.twilio.com/docs/voice/media-streams/websocket-messages), and [Deepgram streaming](https://developers.deepgram.com/reference/speech-to-text/listen-streaming). The post-call transcript replaces, rather than silently merges with, the live preview.

Use `https://api.eu.deepgram.com` / `wss://api.eu.deepgram.com` for this EU workload and set `mip_opt_out=true` on every request. Deepgram documents the [EU endpoint](https://developers.deepgram.com/reference/custom-endpoints) and [Model Improvement Partnership opt-out](https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program).

### VOICE-05E · Webhooks and failover

Every Twilio HTTP callback and Media Stream WebSocket validates `X-Twilio-Signature` with the exact externally visible URL and all received parameters through Twilio's official helper. Unknown future parameters are included rather than filtered. See [Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security).

The inbound number and TwiML App configure a fallback webhook served from a separate failure domain. It can return a minimal safe fallback route or apology; it must not depend on the primary database write path. See [Twilio Voice failover guidance](https://www.twilio.com/docs/voice/twilio-voice-failover-best-practices).

---

## VOICE-06 · Server API contract

### VOICE-06A · Operator APIs

| Method | Route | Command/read contract |
|---|---|---|
| `GET` | `/v1/voice/connections` | Actor-scoped connection summaries and current capabilities |
| `POST` | `/v1/voice/connections/eligibility-checks` | Country/address/use-case facts -> provider requirement snapshot |
| `POST` | `/v1/voice/connections` | Create draft connection; no provider purchase |
| `POST` | `/v1/voice/connections/{id}/documents-session` | Short-lived provider/document upload handoff; no raw document in app logs |
| `POST` | `/v1/voice/connections/{id}/provision` | Idempotent reviewed provider purchase/configure command |
| `PUT` | `/v1/voice/connections/{id}/route` | Revision-checked route and fallback policy |
| `POST` | `/v1/voice/connections/{id}/forwarding-test` | Create bounded two-call activation test |
| `POST` | `/v1/voice/fallback-destinations` | Begin verification of actor-owned destination |
| `POST` | `/v1/voice/fallback-destinations/{id}/verify` | Complete code/call verification |
| `POST` | `/v1/voice/devices/register-intent` | Return Voice registration token/identity for current app device |
| `DELETE` | `/v1/voice/devices/{id}` | Revoke device and Twilio binding |
| `POST` | `/v1/voice/access-token` | Short-lived Voice SDK token for current user/device |
| `POST` | `/v1/calls` | Authorized outbound call intent; destination resolved server-side |
| `GET` | `/v1/calls/{id}` | Tenant-authorized call/card/detail read model |
| `POST` | `/v1/calls/{id}/end` | End current actor's connected leg/call per policy |
| `POST` | `/v1/calls/{id}/identity-candidates` | Request tenant-local/Places suggestions |
| `POST` | `/v1/calls/{id}/assign` | Revision-checked human assignment |
| `POST` | `/v1/calls/{id}/recording/delete` | Policy/role-gated deletion command |

All writes require `Idempotency-Key`, actor/tenant authorization and expected aggregate revision where a prior read is being edited. A provider timeout returns `accepted/pending` with a command id; it never returns a fabricated ready/sent state.

### VOICE-06B · Provider callbacks

```text
POST /webhooks/twilio/voice/inbound
POST /webhooks/twilio/voice/outbound
POST /webhooks/twilio/voice/status
POST /webhooks/twilio/voice/dial-result
POST /webhooks/twilio/voice/recording
POST /webhooks/twilio/voice/stream-status
WSS  /webhooks/twilio/voice/media
POST /webhooks/deepgram/transcription
```

Callback paths accept provider identifiers but reduce them immediately to tenant-scoped aliases and events. Request bodies, media, transcripts and tokens never enter generic request logging or dead letters.

---

## VOICE-07 · Messages and customer UI

### VOICE-07A · One communication timeline

Phone calls are communication objects alongside WhatsApp messages and email cards. The timeline stores a `call_ref`; it does not duplicate the transcript, provider IDs or recording URL into `ThreadRow`.

Call card anatomy:

- phone channel mark;
- `Incoming call`, `Outgoing call` or `Missed call`;
- customer name or `Unknown caller · +34 …`;
- duration or terminal reason;
- salesperson name and time;
- one concise state: `Live`, `Transcript processing`, `Audio off`, `Transcript ready` or `Recording failed`;
- linked albarán chip only if an actual record link exists;
- hover/active inset-card treatment used by the rest of Messages;
- click opens call detail, never the customer or order by surprise.

Call detail uses a standard sheet on desktop and full screen on mobile. It shows identity, direction, participants, route, time/duration, transcript when authorized, recording policy/state, linked records and activity. Provider identifiers and recording URLs never appear.

The customer sheet's communications section can filter **All · WhatsApp · Email · Phone**. “Important” content is an explicit pinned operator note or linked business record. This specification does not authorize an AI summary.

### VOICE-07B · Unknown-caller tray

The tray sits above the conversation composer or call detail actions and says one thing:

> **Who was this?** Link this call so the next one reaches the right salesperson.

Actions:

- **Link customer** opens search and shows exact phone collisions.
- **Create customer** starts with the phone prefilled and requires a human-entered name.
- **Leave unmatched** dismisses the tray for this call without deleting it.

If a Places candidate exists, it is a bounded transient card under the search results:

> **Possible business from Google**  
> Bar Example · Carrer … · phone matches exactly

The card shows required Google Maps attribution beside the response and expires with the permitted
response session. No checkbox is preselected. Choosing it may fill a new-customer draft while the
response is available; the operator still confirms, and the resulting customer facts are a person's
new business record rather than a stored Places response.

The current Kit renders this seam as **Possible business from Google · Not requested** and returns no
candidate facts. Its prepared inbound fixture makes no provider request and creates no call, audio,
transcript or Places response. The fixture's tenant-scoped browser decision survives reload only to
prove cancel, dismiss, collision and assignment behavior; it is not a production call/customer
record. Production authority remains the event and projection model in VOICE-04 through VOICE-06.

### VOICE-07C · Google Maps enrichment boundary

The predecessor Hermes `brain/enrich.py` reference read a stored profile location or a demo seed. That other-company implementation establishes no Rocoto Google Places integration; the Rocoto product adapter is new work.

Resolution order is fixed:

1. Normalize the caller to E.164 with region evidence.
2. Find active phone endpoints inside the current tenant.
3. One exact endpoint match can identify the customer. Multiple matches are an ambiguity.
4. Only if unresolved and the capability is enabled, call Google Places Text Search with the phone and region.
5. Request only needed fields. Compare the returned `internationalPhoneNumber` after normalization.
6. Exact phone equality can label the result **Possible business from Google**; non-equal results are discarded.
7. A person creates or links the customer.

Google says Text Search can search by phone number but results are not guaranteed to be consistent. Place Details returns selected fields through field masks. See [Places Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details), and [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies). Google is never an identity authority. Returned name/address/phone remain transient and render with required Google Maps attribution. Durable candidate/audit state stores the permitted place ID and human decision only; the compared caller phone remains Rocoto source evidence, not a copied Places field. Review EEA terms before activation.

Twilio Lookup may validate/format a number and provide paid line-type data, but Twilio documents authoritative caller-name lookup only for supported markets such as US CNAM. It cannot be used as a Spanish business identity service. See [Twilio Lookup v2](https://www.twilio.com/docs/lookup/v2-api).

---

## VOICE-08 · Call UI

### VOICE-08A · Entry points

- Open conversation: phone icon in the header. Accessible name: **Call {customer}**.
- New conversation: phone icon beside new-message. It opens customer/phone search, not an empty dial pad first.
- Customer sheet: primary channel says **Call** only when Phone is the configured main channel; otherwise Phone remains a channel action.
- Call cards: click opens call detail. There is no nested customer navigation.

Before dialing, a compact standard dialog shows customer/number, **Calling from**, salesperson line and recording state. Primary action **Call**. If caller ID or line is not ready, the dialog gives the settings action rather than pretending to dial.

### VOICE-08B · Desktop/browser states

The browser uses Twilio's JavaScript Voice SDK while the workspace is open. The states are visually distinct:

| State | Primary UI |
|---|---|
| `connecting` | Customer, **Connecting…**, cancel |
| `ringing` | Customer, **Ringing…**, end |
| `connected` | Timer, mute, keypad, audio output, end |
| `reconnecting` | Timer remains, **Reconnecting…**, end |
| `ended` | Outcome and duration; close or call again |

Controls sit at the outer corners/edges of the workspace where expected, while identity and conversation content stay centered. Icon buttons use the shared icon family, 44px minimum pointer target and visible focus ring. No status uses a decorative notification dot.

Incoming calls display an inset card over the workspace with **Answer** and **Decline**. An answered call opens the call workspace. A declined call does not trigger personal-phone fallback when the route says explicit decline stops fallback.

Browser registration is available only while the session is authenticated and the SDK Device is registered. A background/closed browser is not considered a reliable inbound endpoint.

### VOICE-08C · Android

The predecessor Android app reference contains Firebase Messaging and a full-screen Hermes `CallScreen`; that reference's Gradle dependencies contain no Twilio Voice SDK and its `startCall` endpoint starts a server-side AI call. These are historical implementation references, with source ownership tracked in [PRODUCT-MAP](PRODUCT-MAP.md). The Rocoto human call rail must:

- add the official Twilio Voice Android SDK;
- register the signed-in user's opaque Voice identity using the current FCM token and a Twilio Android Push Credential backed by FCM HTTP v1 credentials; the retired legacy Server Key path is forbidden;
- handle `CallInvite`, cancellation and registration refresh/revoke;
- use an OS-compliant incoming-call notification/system surface when backgrounded;
- connect the accepted invite to a human `CallUiState`, not `spectate/takeover` AI state;
- use the existing full-screen visual tokens, identity, timer and bottom controls;
- add keypad and Bluetooth/audio-route handling;
- keep the call active across navigation/process constraints through the required foreground/service lifecycle;
- revoke Twilio registration when identity or tenant changes.

Twilio documents FCM registration and incoming CallInvites in the [Android Voice SDK guide](https://www.twilio.com/docs/voice/sdks/android/get-started), token/push lifecycle in [mobile Voice SDK best practices](https://www.twilio.com/docs/voice/sdks/mobile-best-practices), and the FCM HTTP v1 migration in the [Android 3.x changelog](https://www.twilio.com/docs/voice/sdks/android/3x-changelog).

On mobile, the live call is full screen without the app navbar/footer. Controls remain in the lower thumb zone with at least 48dp targets. The back gesture minimizes to a persistent call strip; it never silently ends the call. Returning restores the exact live state.

### VOICE-08D · Alternative-number fallback UI

The alternative number belongs to Settings -> Phone -> salesperson route. It is never requested while a customer is already ringing.

The setup row shows masked number, `Verified`, ring order and edit/remove actions. After a fallback attempt, the call activity says one of:

- **The app did not answer. Rang ·· 42 instead.**
- **The app call was declined. Fallback was not used.**
- **The fallback number did not answer.**

Fallback is a routing fact, not an error toast. The operator can inspect it later in call activity.

---

## VOICE-09 · Recording, transcript and privacy custody

### VOICE-09A · Safe default

New connections start `metadata_only`. Rocoto records call direction, participants by opaque refs, routing attempts, times, duration, outcomes, assignment and linked business records. Audio and transcript are absent.

Recording/transcription activation requires:

- named purpose and legal basis;
- jurisdictions/call-direction policy;
- approved spoken notice and, where required, affirmative consent flow;
- tenant retention period for audio and transcript;
- authorized roles;
- DPA/subprocessor review for Twilio and Deepgram;
- deletion/export/data-subject process;
- successful synthetic and consent-decline tests.

Recording laws vary by jurisdiction and call context. Twilio recommends consulting counsel and using the strictest applicable consent standard; see [Twilio's call-recording guidance](https://help.twilio.com/articles/360011522553). This spec is a technical control, not legal advice.

### VOICE-09B · Custody classes

| Data | Rocoto durable storage | Provider storage | Default handling |
|---|---|---|---|
| Call metadata/events | Yes | Provider also has call records | Tenant-scoped, audit/retention policy |
| Raw live media | No | Twilio streams transiently | Memory-only stream to Deepgram; no logs/queues |
| Raw recording audio | No Rocoto blob/file | Twilio only while policy permits | Delete after successful transcript/retention deadline |
| Transcript | Yes only when activated | Deepgram processes request | Encrypted sensitive content; role/retention controls |
| Derived reviewed order facts | Yes | No requirement | Normal business-record retention with evidence locator |
| Google Places candidate | Place ID + Rocoto request/decision evidence only | Google | Returned name/address/phone are transient, attributed and expire; no automatic identity link |

Twilio says recordings use provider encryption at rest by default and offers customer-key recording encryption under specific editions/configuration. Rocoto must show `provider_default` until customer-key encryption is actually provisioned and tested. See [Twilio recording settings](https://www.twilio.com/docs/voice/recording-settings) and [recording encryption](https://www.twilio.com/docs/voice/tutorials/voice-recording-encryption).

No `recording_url` is stored. The current legacy `calls.recording_url` field must stop receiving new writes before this rail activates. Provider media is fetched from a strict Twilio host using server credentials, streamed to Deepgram and closed.

### VOICE-09C · Logs, queues and access

- Redact phone numbers in routine logs; store tenant-scoped endpoint/call aliases.
- Never log Twilio signatures, auth tokens, Voice Access Tokens, FCM/APNs tokens, media payloads, transcript text or Places response bodies.
- Job payloads carry call/recording/transcript refs, not audio URLs or transcript content.
- Transcript reads require actor, tenant, call scope, purpose and role; access is audited without text.
- Recording replay, if ever enabled, uses an authenticated no-store streaming gateway; no provider URL reaches the browser.
- Support tooling shows metadata by default and requires audited elevation for transcript access.
- Provider media deletion is verified and reconciled; **Media deleted** appears only after provider confirmation. Twilio may retain non-playable recording metadata for its documented post-delete period (currently 40 days), so this state never implies provider metadata purge.

Deepgram's `mip_opt_out=true` must be present on every prerecorded and streaming request. Regional routing, model settings and opt-out are explicit configuration, not assumptions.

---

## VOICE-10 · Capability flags and dependencies

Capabilities are server-issued per tenant/actor. Client fixture switches never grant provider authority.

| Capability | Default | Required dependencies |
|---|---|---|
| `voice_connection` | off | provider account, tenant subaccount strategy, settings release |
| `voice_inbound` | off | connection `ready`, signed webhook, route, tested number |
| `voice_outbound` | off | connection `ready`, verified/owned caller ID, TwiML App, role |
| `voice_browser_sdk` | off | Voice Access Token endpoint, JS SDK, mic policy |
| `voice_android_sdk` | off | Android SDK, FCM HTTP v1-backed Twilio Push Credential, registered device |
| `voice_fallback_pstn` | off | verified destination, route, toll-fraud controls |
| `voice_recording` | off | approved policy/notice/consent, callback, deletion worker |
| `voice_transcription` | off | recording or approved media stream, Deepgram EU, retention |
| `voice_live_transcript` | off | two-track stream, alignment proof, streaming budget/monitoring |
| `voice_places_enrichment` | off | restricted Places key, EEA terms review, human assignment UI |
| `voice_ai_answering` | **hard off / deferred** | separate AI runtime design and release; never implied here |

Hiding a disabled capability must leave the rest of Messages, Customers and Settings coherent. A Phone channel can show historic metadata after the connection is disabled; it cannot place or receive new calls.

---

## VOICE-11 · Current repository mapping and migration

### VOICE-11A · Reuse

| Current asset | Keep/reuse | Required change |
|---|---|---|
| `backend/spine.py` provider entity map and scoped events | Yes | Add Twilio account/number/call/recording aliases and voice event schemas |
| `backend/presence_call.py` `call.started` / `call.ended` | Yes | Drive from the canonical human call session as well as AI calls |
| `android/.../ui/call/CallScreen.kt` visual system | Yes | Split human transport state from AI `spectate/takeover`; add SDK/audio/keypad states |
| Existing FCM token plumbing | Yes | Register/revoke Twilio Voice device bindings; distinguish normal notification token from Voice binding |
| `backend/postcall.py` Twilio-host validation and multichannel processing | Partly | Map roles from legs/direction; use EU Deepgram endpoint; remove durable recording URL |
| `backend/voice.py` / ElevenLabs stream | No for human transport | Remains AI runtime; do not route human calls through it |
| `ThreadRow` / customer communications cards | Yes | Add opaque `call_ref` presentation object and call-card states |
| `brain/enrich.py` | No as Places proof | It currently uses stored profile/demo seed; build a separate provider adapter |

### VOICE-11B · Legacy `calls` projection

The current `calls` table is one row keyed to a `call_transcript` WhatsApp message and has one `call_sid`, one `recording_sid`, a durable `recording_url`, mutable transcript `lines`, `mode=live|eleven` and `operator_state=agent|takeover`. It cannot represent:

- separate tenant connection and route revisions;
- inbound/outbound parent/child/fallback legs;
- multiple recording segments;
- independent transport/recording/transcript/identity states;
- human Voice SDK participants;
- callback ordering and provider alias isolation; or
- consent/retention policy evidence.

Migration order:

1. Add new aggregates/events and provider alias mappings without changing old reads.
2. Project new AI and human call events to the legacy table for existing mobile reads.
3. Stop new writes to `recording_url`; backfill only opaque provider refs where safely resolvable.
4. Move Messages/mobile reads to `CallSessionView`.
5. Reconcile active calls and prove no duplicate/missing timeline cards.
6. Remove legacy table authority only after replay equivalence and rollback proof.

### VOICE-11C · Current mobile truth

- Firebase Messaging is already configured and the app posts device tokens to the backend.
- The Gradle file labels FCM as suitable for future Twilio Voice incoming push, but no `com.twilio:voice-android` dependency or `Voice.register`/`CallInvite` implementation exists.
- `ApiClient.startCall(phone)` calls `/api/calls/start`, whose current product meaning is a server-side business-number/AI call. It is not a Voice SDK call intent.
- The call screen is real UI evidence for layout and tokens, not evidence of a human app-to-PSTN transport.

The new APIs use `/v1/voice/*` and `/v1/calls` during migration so the old AI endpoint cannot be invoked accidentally.

---

## VOICE-12 · Required configuration and external services

No credential value was inspected or validated for this specification. Repository code proves only that some environment variable names and a number registry exist.

### VOICE-12A · Existing names in backend configuration

```text
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_API_KEY_SID
TWILIO_API_KEY_SECRET
TWILIO_VOICE_FROM
VALIDATE_TWILIO
DEEPGRAM_API_KEY
DEEPGRAM_LANGUAGE
PUBLIC_BASE_URL
ROCOTO_CALL_RECORDING
```

`TWILIO_AUTH_TOKEN` remains necessary for webhook signature validation even when restricted API keys are used for REST calls.

The existing backend defaults `PUBLIC_BASE_URL` to its local development listener. Deployed
callbacks require the environment's configured origin; `ROCOTO_VOICE_PUBLIC_BASE` inherits that
origin unless explicitly configured. Retained applications and voice adapters use Rocoto-owned
routing configuration independently of the future connection flow designed here.

### VOICE-12B · New configuration/secrets required

```text
TWILIO_PROCESSING_REGION                       # required; never rely on implicit US1
TWILIO_EDGE                                    # explicit supported edge for the chosen region
TWILIO_VOICE_APP_SID
TWILIO_PUSH_CREDENTIAL_SID_ANDROID             # must be backed by FCM HTTP v1 credentials
TWILIO_PUSH_CREDENTIAL_SID_IOS              # only when an iOS app exists
TWILIO_VOICE_FALLBACK_BASE_URL              # separate failure domain
TWILIO_RECORDING_PUBLIC_KEY_SID             # only for proven customer-key encryption
DEEPGRAM_API_BASE=https://api.eu.deepgram.com
GOOGLE_MAPS_API_KEY                          # server-restricted Places API key
VOICE_ACCESS_TOKEN_TTL_SECONDS
VOICE_CALL_INTENT_TTL_SECONDS
VOICE_RECORDING_DELETE_SCAN_SECONDS
```

Tenant regulatory bundle/address SIDs, subaccount refs, purchased-number refs, caller-ID refs, routes and fallback destinations are encrypted/opaque database records, not global environment variables.

### VOICE-12C · Missing external provisioning/work

- Twilio tenant/subaccount provisioning policy and least-privilege API keys;
- approved regulatory bundle/address workflow for every offered country/number type;
- current eligible number inventory at activation time;
- region-co-located restricted API key, TwiML App, numbers/caller-ID capability, SDK tokens/call resources and Android Push Credential;
- Firebase project/service-account credential for FCM HTTP v1 mapped to the Twilio Android Push Credential; no legacy Server Key;
- iOS APNs/PushKit/CallKit setup only if an iOS app is added;
- separate highly available fallback webhook deployment;
- Deepgram EU endpoint configuration and no-training/retention procurement record;
- Google Places server project/key, budget, EEA terms and field-retention review;
- Twilio and Deepgram DPA/subprocessor/security review;
- legal approval of recording purpose, notice, consent behavior and retention;
- support/runbook for porting, forwarding failure, lost device, number suspension and provider outage.

The repository number registry records a verified Spanish caller ID and notes that the current account lacked a Spanish regulatory bundle for purchasing a local number. That is a current setup gap, not proof that a French number is available, approved or preferable.

---

## VOICE-13 · Failure and recovery matrix

| Failure | Product state | Recovery |
|---|---|---|
| Regulatory documents missing/rejected | Connection blocked; no number promise | Show exact provider requirement; resubmit or choose eligible path |
| Inventory disappears before purchase | `inventory_unavailable` | Re-search; never substitute silently |
| Carrier forwarding rewrites caller ID | Test failed for auto identity | Keep calls as unknown; carrier/porting route or explicit acceptance |
| Voice SDK device not registered | App attempt skipped/failed | Sequential verified fallback if configured |
| App ring times out | Attempt `no_answer` | Fallback; call card records both attempts |
| Operator explicitly declines | Attempt `declined` | Stop fallback when policy says so |
| Fallback phone does not answer | Session `ended/no_answer` | Missed-call card and optional callback action |
| Twilio status callbacks reorder | Projection holds terminal precedence | Reconcile provider resource and append correction event |
| Recording callback delayed | `recording=recording` | Reconciler fetch; never show playable/complete |
| Recording is mono unexpectedly | `recording=failed` or lower-confidence policy | No fabricated speaker roles; retry/metadata-only |
| Deepgram fails | Call remains completed; transcript failed | Bounded retry while audio retention permits, then delete/expire per policy |
| Recording deletion fails | `deleting/failed` visible to admins | Retry and alert; never claim deletion |
| Places unavailable/no exact phone | No candidate | Manual search/create remains available |
| Unknown number matches two customers | Ambiguous | Human choice; no automatic route by customer owner |
| Primary webhook unavailable | Provider fallback webhook | Minimal safe route; later reconcile events |
| Tenant disconnects line | New calls disabled | Preserve historic call metadata; revoke devices/tokens/webhooks |

---

## VOICE-14 · Release plan and proof

This order is mandatory because later stages depend on earlier custody and identity boundaries.

### Stage 0 · Procurement and legal

- choose supported country/number types from live provider facts;
- approve subaccount, DPA, region, recording/transcription and Places policies;
- create synthetic-only test identities and numbers;
- define emergency calling limitation copy: Rocoto Phone is business calling, not an emergency service.

### Stage 1 · Metadata-only connection

- provision one test tenant/number;
- signed inbound/outbound webhooks, provider aliases, call/leg events and reconciliation;
- Messages cards and unknown assignment;
- no recording, transcription, Places or fallback.

### Stage 2 · Browser and Android human calling

- short-lived access tokens and call intents;
- JavaScript Device and Android Voice SDK registration;
- foreground/background/locked-device inbound tests;
- audio route, Bluetooth, permission, reconnect and end-call tests.

### Stage 3 · Salesperson routing and fallback

- owner/ring-group schedules;
- verified fallback destinations;
- explicit-decline versus timeout behavior;
- per-salesperson caller-ID/route test evidence.

### Stage 4 · Recording and transcription

- approved consent/notice policy;
- dual-channel role mapping for inbound/outbound/fallback;
- EU Deepgram, opt-out, deletion, access and retention proof;
- metadata-only behavior remains available.

### Stage 5 · Places suggestion

- exact-phone candidate only;
- human assignment and collision tests;
- cache/terms/tenant-boundary proof.

### Stage 6 · Controlled rollout

- synthetic shadow, internal tenant, named pilot tenants, then wider release;
- rollback disables new calls without deleting history;
- AI answering remains hard off.

### VOICE-14A · Acceptance evidence

| Evidence ID | Required proof |
|---|---|
| `V-E01` | Two external callers prove inbound caller-ID behavior for the actual carrier forwarding path |
| `V-E02` | Owned/verified outbound caller ID tested to at least the supported carrier/country matrix; UI wording remains non-guaranteed |
| `V-E03` | Cross-tenant provider SID/number/callback tests all fail closed |
| `V-E04` | Duplicate and reordered Twilio callbacks produce one correct call card and terminal state |
| `V-E05` | App closed/background/foreground/locked tests show route and fallback truth on real Android devices |
| `V-E06` | Explicit decline does not fall back; timeout does; no double answer |
| `V-E07` | Inbound and outbound dual-channel fixtures map customer/operator correctly |
| `V-E08` | Consent declined yields a connected metadata-only call with no recording request |
| `V-E09` | Audio never appears in Rocoto DB/blob/log/queue; Twilio deletion is receipt/reconciliation backed |
| `V-E10` | Deepgram requests use EU host and `mip_opt_out=true`; transcript/access retention tests pass |
| `V-E11` | Unknown/ambiguous phone never auto-links; exact tenant endpoint is isolated; Places remains a human suggestion |
| `V-E12` | Lost/revoked device cannot mint a token or receive new invites |
| `V-E13` | Primary webhook outage reaches independent fallback and reconciles without cross-tenant/duplicate events |
| `V-E14` | Accessibility: call controls have names, focus, 44px/48dp targets, contrast and reduced-motion behavior |
| `V-E15` | Connection-time fixtures prove no prior call, recording, transcript, voicemail, contact or WhatsApp history is requested/imported; reload restores only tenant-scoped prepared answers |
| `V-E16` | Kit/reference network assertion records zero Twilio, Deepgram and Places requests; **Prepared · awaiting connection** gates call controls and every preview says **Preview · no call** |

No stage becomes `ACTUAL` from a kit interaction, local mock, provider console screenshot, seeded transcript or successful compile alone.

---

## VOICE-15 · Risks that remain real

1. **Country/number eligibility:** France is not a universal workaround for Spanish number procurement. Regulatory review and live inventory can block the path.
2. **Forwarded caller identity:** the first carrier leg can erase the original caller number. No application code can recover evidence that never arrives.
3. **Caller-ID presentation:** verified/owned caller ID authorizes Twilio use but destination carriers can filter or rewrite display.
4. **Recording law:** cross-border calls can trigger different consent rules. Tenant configuration cannot substitute for legal review.
5. **Role inversion:** current fixed channel roles would mislabel outbound calls. This is a release blocker for transcription.
6. **Push reachability:** FCM registration is not proof of delivery or answer. Sequential fallback and real-device tests are required.
7. **Provider custody:** Twilio/Deepgram still process data even when Rocoto stores no audio file. Contracts, regions, retention and deletion must be explicit.
8. **Places identity:** a business listing is mutable and sometimes shared. It is useful for a suggestion, never for automatic account assignment.
9. **Emergency/service limits:** browser/app calling is not a replacement for normal emergency calling and must say so during activation.
10. **Cost/toll fraud:** outbound call intents, fallback destinations, rate limits, country allowlists, duration caps and anomaly alerts are required before public release.

---

## VOICE-16 · Official sources reviewed

Reviewed `2026-09-02`. Only primary Twilio, Deepgram and Google documentation informs provider claims in this spec.

### Twilio

- [France regulatory guidelines](https://www.twilio.com/en-us/guidelines/fr/regulatory)
- [France phone-number terms](https://www.twilio.com/en-us/legal/service-country-specific-terms/france-phone-numbers)
- [Phone-number regulatory FAQ](https://www.twilio.com/docs/phone-numbers/regulatory/faq)
- [Regulatory onboarding](https://www.twilio.com/docs/phone-numbers/regulatory/getting-started)
- [IncomingPhoneNumber API](https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource)
- [Outgoing caller IDs](https://www.twilio.com/docs/voice/api/outgoing-caller-ids)
- [Call resource and callbacks](https://www.twilio.com/docs/voice/api/call-resource)
- [`<Dial>` and dual-channel recording](https://www.twilio.com/docs/voice/twiml/dial)
- [Recording resource](https://www.twilio.com/docs/voice/api/recording)
- [Recording settings](https://www.twilio.com/docs/voice/recording-settings)
- [Recording encryption](https://www.twilio.com/docs/voice/tutorials/voice-recording-encryption)
- [Recording consent guidance](https://help.twilio.com/articles/360011522553)
- [Voice SDK overview](https://www.twilio.com/docs/voice/sdks)
- [JavaScript Voice SDK](https://www.twilio.com/docs/voice/sdks/javascript)
- [Android Voice SDK](https://www.twilio.com/docs/voice/sdks/android/get-started)
- [Mobile SDK best practices](https://www.twilio.com/docs/voice/sdks/mobile-best-practices)
- [IAM Access Tokens](https://www.twilio.com/docs/iam/access-tokens)
- [Media Streams](https://www.twilio.com/docs/voice/media-streams)
- [`<Stream>`](https://www.twilio.com/docs/voice/twiml/stream)
- [Media Stream WebSocket messages](https://www.twilio.com/docs/voice/media-streams/websocket-messages)
- [Webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Voice failover](https://www.twilio.com/docs/voice/twilio-voice-failover-best-practices)
- [Subaccounts](https://www.twilio.com/docs/iam/api/subaccounts)
- [Lookup v2](https://www.twilio.com/docs/lookup/v2-api)
- [Twilio data-protection addendum](https://www.twilio.com/en-us/legal/data-protection-addendum)

### Deepgram

- [Multichannel transcription](https://developers.deepgram.com/docs/multichannel)
- [Multichannel versus diarization](https://developers.deepgram.com/docs/multichannel-vs-diarization)
- [Streaming transcription](https://developers.deepgram.com/reference/speech-to-text/listen-streaming)
- [Prerecorded transcription](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded)
- [Callback transcription](https://developers.deepgram.com/docs/callback)
- [EU/custom endpoints](https://developers.deepgram.com/reference/custom-endpoints)
- [Model Improvement Partnership opt-out](https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program)

### Google Maps Platform

- [Places Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Places data fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)


---

# PART TWO · THE HERMES PORT, FOR REAL (FEED-IA §196.6 · E193.07)

**Added 2026-09-04. Version `2026-09-04/v2`.** Everything above stands; what follows is the part
§196.6 turned from a prepared design into a working operator flow against the kit runtime, and the
steps Peter did not spell out, figured out and written down.

> «the hermes shit remember i wanted to port it. the number->gmaps info was working flawlessly, and
> then the transcription too, with clear speaker diarisation. set to spanish of course. i dont want
> dependencies on the actual hermes caller as thats a packed thing, i want it all self contained in
> here, same as twilio. that shit proved capability now we're doing ti all for real, every part of
> the process, nothing half assed. if i missed a step when explaining it, figure that out.»
> — Peter, 2026-09-04

⚠ **What this repeals.** VOICE-01A.1's «the Kit performs no Twilio, Deepgram or Google Places
request» and VOICE-07B's «the current Kit renders this seam as *Possible business from Google · Not
requested*» are withdrawn for the surfaces below. The kit now asks a service of its own, which holds
the keys, and shows what it answered. Everything the old paragraphs protected survives as a STATE:
a runtime that cannot be reached says so, and no surface invents a call, a name or a transcript.

## VOICE-17 · The seam: one client, one set of postures

The kit reaches four providers through ONE service — `app/src/prototypes/cedar/runtime-client.ts` — and one
seam file reads it for every voice surface: `app/src/prototypes/cedar/voice.ts`. No component fetches.

| What the kit needs | Endpoint | Kit posture when it fails |
|---|---|---|
| which providers the service holds | `GET /api/health` | `Runtime offline` |
| whether the Twilio account answers | `GET /api/health/twilio` | the line stays `Prepared · awaiting connection` |
| who a number belongs to | `GET /api/identity?number=` | `Runtime offline` · the card names nobody |
| the calls held on one number | `GET /api/calls?number=` | `Runtime offline` · no rows |
| place a call | `POST /api/calls {to}` | the provider's refusal, by name, or `Runtime offline` |
| words from audio | `POST /api/transcribe` | the composer's own honest dictation states (§196.7) |

**READINESS IS THREE FACTS AGREEING** (`readinessOf`, amended by E195.21): the runtime reports
`twilio: configured`, the Twilio ACCOUNT answers for those keys at `GET /api/health/twilio`, AND the
tenant has saved the number customers call. Any one of them outstanding reads **Prepared · awaiting
connection**, with the sentence under it naming the one that is; a runtime that cannot be reached
reads **Runtime offline**; an account still being asked reads **Checking the line…**; all
three present read **Connected**.

*Why the third fact exists.* Until E195.21 readiness folded PRESENCE straight into «Connected», and
the deployed runtime met it: `/api/health` reported `twilio: configured` while
`/api/health/twilio` answered `401 · The authorization with Key failed` and every dial the surface
offered came back `503 · house_number_missing`. The kit printed **Connected · Customers reach the
house on +34 …** over a line that could place nothing — the claim VOICE-00 forbids, on the page. A
key in an env file is not an account that answers, and the runtime's own health endpoint says so;
the kit now reads it. The account is asked ONCE per app, and only where its answer can still change
the standing — that is, only when the keys are held and the house number is saved.

**A REFUSAL IS AN ANSWER WITH A NAME.** The runtime «refuses, by name, on any fact it does not
have»: `{"error":{"code":"house_number_missing","message":"…"}}` beside the status. The client
carries that code and sentence (`RuntimeRefused`), and the surfaces state the boundary it names —
«The house number is still to be set on the runtime.» — rather than a bare status code.

*Every code the kit can print has house words* (`REFUSAL_WORDS`, completed in E195.21's repair
round). The provider-answered family — `twilio_failed` (raised by `POST /api/calls`, so it reaches
four call seats through `dialState.because`), `deepgram_failed`, `parsewise_failed` — is written by
the runtime as «<Provider> answered 502.», a status number handed to a person to act on; so is the
door family `too_large` and `empty_upload`, and the framework's own `http_error` («Not Found») and
`runtime_error` («TypeError while handling the request»). Each is said as the fact plus the act that
follows it. **A refusal with an EMPTY body** — `RuntimeRefused(status, '', '', path)` — has no code
and no sentence, and its own `message` falls back to «Runtime · <status> on <path>»: the exact bare
status this section repealed. It reads «The runtime turned this request down. Its journal holds the
reason.» And `RuntimeUnreachable`'s message carries the BASE URL — a fact for a console and a leak
on a page. Every seat but one already branched on `RuntimeUnreachable` before calling
`refusalWords`; the account read did not, and printed «Twilio said: Runtime offline at
https://kit.soyrocoto.com/api.» That seat now branches, and `refusalWords` answers
`RuntimeUnreachable` with the state word as defence in depth for the next seat that forgets.

**A RELAYED SENTENCE IS STILL THE KIT'S COPY** (E195.21 repair round). `/api/health/twilio` answers
`why` from three roads — Twilio's own `message`, a Python exception CLASS NAME, and the runtime's
own words — and only the first is Twilio speaking (THE-RUNTIME-SPEC §RUN-03.1 tables them). The
runtime marks that road with a `status`, and that marker decides the WHOLE sentence, not only
whether a quote rides along: with it, Twilio declined these keys and «Twilio answers the runtime
once the account accepts its keys» is true, with `why` quoted beside it when it is under 120
characters and carries no denial; without it, the account's own state is still open and the rail
says **«The Twilio account has still to answer the runtime for these keys.»** The decision is made
once, in `accountFrom`/`askAccount`, where the provenance is known — `readinessOf` prints the
finished sentence and composes no relay it cannot vouch for.

*And a refusal to a DIAL is said the same way.* `POST /api/calls` can answer `twilio_failed`, and it
can answer with a status and no body at all; `drive-199-voice-real.py`'s `dial_refused` band drives
both and holds the call seat to the house's words, with the status and the road kept off the page.

**THE QUEUE GOES LIVE WITH THE LINE, not with a health answer** (E195.21). A runtime that merely
answers holds no call for a house whose line was never activated: the rail «keeps the calls it
handled after activation». Reading health-answers-therefore-live replaced E191's labelled rehearsal
with an empty live list on a house that has no line yet — a state nobody designed. `liveQueue` is
`readiness.ready`.

**One read per question.** Health is read once for the whole app; a number's identity once per
number; a number's calls once per number, re-read only on an explicit press. A voice surface never
polls, because a list that re-fetches behind a person's back is a provider bill nobody asked for.
The one exception is the activation watch (VOICE-19), which polls only while a person is watching.

## VOICE-18 · The diarised Spanish transcript, and which voice is which

Deepgram nova-3 is asked in Spanish, with diarisation. It hands back numbered speakers, and **a
number is not a name** — this is the step §196.6 did not spell out.

1. **A two-track recording answers it outright.** Twilio's `record-from-answer-dual` puts one leg
   per channel, so channel 0 IS the house's leg and channel 1 IS the caller's. No heuristic.
2. **A single mixed track does not.** The diarizer's speaker numbers are labels in the order it
   first heard each voice, and nothing in them says which is the house.

The kit cannot see which road a transcript took, so the panel:

- takes **speaker 0 = the house** as its default and SAYS SO in words («… · 2 voices · Marc Danés is
  voice 1»);
- offers ONE control, **Swap voices**, which moves the house's voice to the next speaker;
- remembers the choice per call sid in `rocoto-call-voices`, so a correction outlives a reload;
- gives a third or fourth voice its own number («Voice 3») rather than lending it either name.

Every line carries its **second in the call** (`0:07`) and can be taken as a **quote** — «who · when
— the words» — onto the clipboard, so the reply is written from what was actually said. The composer
prefill seam belongs to Messages (§196.7 · §196.8); the transcript's job is to hand over an exact,
attributed line.

**Privacy of the words (VOICE-09B, applied to the kit).** The browser is handed WORDS, never audio:
no provider media URL reaches the page, there is no player, and the panel states the recording's
custody beside the text — «Metadata only» · «Recording with the provider» · «Recording held by
Rocoto». A quote is a deliberate act by a person; nothing is copied automatically, and no transcript
text is written to browser storage. What the browser keeps about a call is one integer: which voice
is the house's.

## VOICE-19 · The activation test, for real

VOICE-01A step 8, performed rather than promised. Both legs live in Connections' activation step.

1. **Inbound.** The kit reads the calls the runtime holds on the house number, remembers their sids,
   and watches. The operator rings the house number from their own phone. The first inbound call the
   runtime did not have before is the pass, and the pass PRINTS its own evidence — «Incoming call
   from +34 699 11 22 33 · Today · 09:02 · 12 sec». A leg that finds nothing stays **Waiting**,
   forever if need be; it never times out into a pass.
2. **Outbound.** The kit asks the runtime to ring a number the operator is holding. Twilio's sid is
   proof the account ACCEPTED the request — it is not proof of a ring — so the leg then waits for
   the operator's own ear: **It rang** is a person's press, and only that closes it.
3. **A pass is never written into the browser's own record.** `phone-connection-config` keeps
   decisions and normalises every provider-owned field back to pending on write, so a saved setup
   still reads `inboundActivation: not-run`. The evidence lives with the runtime; the browser keeps
   choices. This is VOICE-01A.1, unchanged, and it is what makes the rest of the rail trustworthy.
4. **OWED · assignment.** Linking a real call to an account is `CallAssignment` (VOICE-03H) and the
   runtime contract names no endpoint for it yet. The kit therefore READS the call and the identity
   and leaves the decision to a person, saying so on the surface: «The account this caller belongs
   to is a person's decision, kept with the call on the runtime.» The endpoint owed is
   `POST /api/calls/{sid}/assign {customerId | createFrom}` with the collision checks VOICE-03H
   states; until it exists, no kit surface writes a link a reload would lose.

## VOICE-20 · The missed call

A missed call is READ, not stored as a state: an **inbound** call the runtime holds with no answered
seconds is a call nobody in the house took. An **outbound** call with no seconds is one the customer
did not take, and reads «Outgoing call · rang out».

A missed inbound call is the ONE call state that owes the house an act, so it wears §196.3's red
vocabulary wherever it stands — the row's 2px outline, a red «Missed» pill, red ink on the words —
and its sheet says what it left behind: «Nobody in the house reached this call. Ring them back from
here.» The act beside it is **Call them back**, gated on the same readiness as every other call.

The missed row spends no column on a duration it does not have: it states WHEN, and stops. The
right-hand column carries the one concise state about the audio, never a second way of saying the
call's own kind.

## VOICE-21 · Recording custody, retention and the Spanish consent line

`metadata_only` remains the default (VOICE-09A) and the kit ships in it. Everything below is what a
tenant must have BEFORE recording is turned on for a Spanish line.

**The legal shape in Spain.** Recording a call one is a party to is not an interception offence
(Código Penal art. 197 covers a THIRD party intercepting), but the recording is personal data and
the AEPD/GDPR duties apply in full: a lawful basis, information given before the recording starts,
a retention period, and the data-subject rights. Consent is the weakest basis to rely on for a
business call and the easiest to lose; a legitimate-interest or contract basis with a clear notice is
the usual shape, and the notice is not optional under either. **This spec is a technical control,
not legal advice**; counsel signs the basis and the notice before the flag is turned on.

**The spoken notice** (Spanish, because it is spoken to customers; it is the shipped string, and it
is played before the first word of the conversation on every recorded call, inbound and outbound):

> «Le informamos de que esta llamada se graba y se transcribe para gestionar su pedido. Puede pedir
> una copia o la supresión de la grabación escribiendo a [correo del responsable].»

The caller must be able to continue WITHOUT being recorded: a call where the person objects is
completed with recording off, and the objection is an event on the call, never a reason to end it.

**Retention, stated as a clock the product keeps:**

| Object | Default retention | What ends it |
|---|---|---|
| Call metadata and events | the tenant's business-record period | tenant deletion policy |
| Provider audio | deleted as soon as the transcript is `ready` | verified provider deletion, reconciled |
| Audio where no transcript succeeded | 30 days, then deleted | the retention worker |
| Transcript text | tenant-set, default 12 months | the retention worker; a data-subject erasure |
| Derived reviewed order facts | normal business-record retention | they cite an evidence locator, never the text |

«Media deleted» appears only after the provider confirms deletion, and it never implies that
provider metadata is purged (Twilio's documented post-delete window applies). Deepgram requests carry
`mip_opt_out=true`, always.

### VOICE-21A · The retention worker (E195.40)

The clock above was a table until E195. It is now `mock-api/app/retention.py` — **in the tree, proven
by 33 pytest checks, installed by `deploy.sh` step 4b, and not yet on the box**: today
`systemctl list-unit-files 'rocoto-kit-retention*'` answers «0 unit files listed». Six decisions the
table left to the implementation are recorded here so the code and the spec say the same thing.

1. **«Provider audio» covers the copy on OUR disk.** VOICE-09B wants no Rocoto blob at all; the
   runtime keeps one only long enough to transcribe it (`twilio_voice.take_custody`). So the copy on
   this box inherits the provider copy's clock and `retention.forget_audio()` is called ON that
   path, the moment the transcript is attached — «as soon as the transcript is `ready`» is
   therefore true rather than «within a day». Custody falls from `ours` back to `provider`, which
   is the honest word once the bytes are gone, and the record states `audioRemovedAt` and
   `audioRemovedReason`. The daily sweep is the NET under that line: a crash between the transcript
   and the deletion, a file older than the module, an orphan wav with no record at all.
2. **A transcript is `ready` when it carries WORDS.** Deepgram answering a silent leg is a finished
   request, and treating it as ready would delete the only evidence the call left, so an empty
   transcript keeps its audio on the 30-day clock instead.
3. **Each artefact is aged by its own clock.** A call record is aged by the call's `startedAt`,
   because the file is rewritten by every later leg and by the sweep itself — aging it by mtime
   would restart the transcript's twelve months every time the sweep touched the record. Audio is
   aged by the wav's own mtime, the instant the bytes landed here, which nothing rewrites. An
   artefact with no clock at all is KEPT.
4. **The call record's own deadline is OFF by default** (`ROCOTO_CALL_RECORD_RETENTION_DAYS=0`):
   «the tenant's business-record period» is the tenant's to state, and a service that invented one
   would be deleting a house's books on a number nobody chose. Set it and the sweep enforces it,
   taking that record's audio and transcript with it.

5. **0 MEANS THE CLOCK IS OFF, AND IT MEANS THAT ON ALL THREE KNOBS.** `ROCOTO_CALL_RECORD_
   RETENTION_DAYS=0` always meant «keep»; the other two meant «delete everything on the next
   sweep», and that was proven rather than argued: with both at 0, a three-day-old transcript and a
   three-day-old wav were destroyed — `transcripts_expired=2 … bytes_freed=1024`. One number cannot
   carry two meanings across three knobs an operator sets in one file, and the reading that costs a
   house its records is the wrong one to keep. Each rule is guarded `if <days> and age >= <days>`.
   A house that wants audio gone at once already has that: it goes the moment its transcript is
   ready.
6. **A record may state its OWN transcript period, and it wins.** `ROCOTO_TRANSCRIPT_RETENTION_DAYS`
   is the BOX's number, and a box serves one house today — but the period is the TENANT's choice
   (`RETENTIONS` in `company.ts`, the dial on «Your data»). So the sweep reads
   `transcriptRetentionDays` off the call record when the record states one and falls back to the
   box knob when it does not. NOTHING WRITES IT YET: the kit's dial is local state, and a runtime
   write would be an endpoint the kit does not name (RUN-02). Today the knob governs, the unit sets
   365, and the kit's shipped dial says «A year» — the same twelve months. The writer is owed, and
   RUN-11 item 5 says so.

`python -m app.retention` plans and prints; `--apply` acts; `--json` is what the timer's journal
carries. The journal states COUNTS and never contents (VOICE-09C): one line per artefact naming the
call sid and the rule, one summary line of counts, and no transcript text or phone number anywhere
in it — asserted against the line `logging_setup.JsonLine` actually emits, so a writer that put a
number in an `extra=` fails the suite, and against the SHAPE of that line, so it cannot ride in
under a key nobody scans. The sweep is idempotent, it creates nothing — a box that has taken no call
sweeps to zeros and its disk is untouched — and `rocoto-kit-retention.timer` will run it daily at
03:20 with `Persistent=true`, so a box that was off catches up rather than skipping a day.

**THE PLAN COUNTS EXACTLY WHAT THE APPLY REMOVES.** Both modes decide in the same order, and the
first decision is which records are past the house's own period — because a due record takes its
audio with it, including audio still inside its own thirty days. Reaching that audio only under
`--apply` made the plan under-report: a hundred-day-old record holding a one-day-old wav planned
«audio_kept=1 … bytes_freed=0» and then deleted 8,192 bytes. `deploy.sh` step 4b's guard and the
nightly journal are both that number, so both would have lied. `audio_with_record` is its own
counter, and `sum(rules.values())` equals the artefact count.

**THE WRITES ARE SAFE AGAINST THE SERVICE RUNNING BESIDE THE SWEEP.** `store.save()` and
`store.revise()` write through a temp file and `os.replace()` — whole record or nothing — and both
take an `fcntl.flock` on `calls/.lock`, because uvicorn and the sweep are two PROCESSES and a
`threading.Lock` locks neither against the other. `forget_audio()` holds that lock across the delete
AND the revise, so a recording webhook cannot land between them and put `recordingPath` back on a
record whose wav has gone.

**AND THE DEPLOY ENABLES NOTHING IT HAS NOT PROVEN.** `deploy.sh` step 4b sends the units, runs the
dry run as the runtime's own user against the real store with `|| die`, and only then
`systemctl enable --now`s the timer. The first version of that step enabled the timer first, so a
deploy that failed the guard still walked away leaving a nightly `--apply` armed.

### VOICE-21B · The tenant notice, and where it stands (E195.41)

VOICE-09A requires a «tenant retention period for audio and transcript» BEFORE recording can be
turned on, so the notice stands with the posture that turns it on: **Connections → the phone rail →
step 3 of 5, «Routing and privacy»**, under the recording-default card and inside that step's own
body. It is `RetentionNotice` in `phone-connection.tsx`, drawn from `retentionClock()` in `voice.ts`
— one drawing, one home for the numbers, named in the runtime's comments and naming them back.

It states the clock as five lines, each saying what IS kept and for how long:

| Time, direction, participants and outcome | Kept with your business records |
| Recorded audio | Kept until its transcript is ready, then removed |
| Audio while its transcript is pending | Kept 30 days, then removed |
| Transcript text | **the tenant's dial** — Kept 90 days · Kept 12 months · Kept until you ask for it to go |
| Order facts read from a call | Kept with the order, citing the call |

and closes with the caller's own half and the control: «Every recorded call opens by telling the
caller, in Spanish, that the call is recorded and transcribed to handle their order, and where to
ask for a copy or an erasure. Your data sets how long a transcript is kept.» The kit is English, so
the SPOKEN Spanish string stays where it is shipped from — VOICE-21 above — and the surface states
in English what the caller will hear.

**The closing sentence used to name the daemon**, and it was withdrawn to the deploy gate: «A daily
sweep on the runtime keeps this clock» is true of the tree and false of the box, which lists no
`rocoto-kit-retention` unit, and publishing the kit ahead of the runtime deploy would ship a promise
the machine cannot honour. It returns to this copy when the timer is running. What stands there
instead is true the moment the kit is published, and it is more use to a house: where the period is
set.

### VOICE-21C · ONE ANSWER TO «HOW LONG DO YOU KEEP MY CALLS» (E195.41 · §195)

**Two surfaces state retention, and they used to disagree.** «Your data» → «How long conversations
are kept» carried one row, «Recordings and transcripts», with a three-way dial — 90 days · A year ·
Kept — whose own copy said «Recordings and transcripts are cleared after ninety days». The phone
rail's notice said audio goes the moment its transcript is ready and transcript text lives twelve
months, and it read nothing from that dial. One tenant, one app, two answers to the question a house
actually asks. §195 is checkout-level consistency, and this is the same failure a rung up.

**WHICH SURFACE GOVERNS WHICH OBJECT, stated once:**

| Object | Governed by | Why |
|---|---|---|
| Transcript text | **the dial on «Your data»** | the words a customer said are the house's own record, so the period is the house's own choice |
| Recorded audio | **VOICE-09B's custody rule** | «no Rocoto blob/file» — audio goes as soon as its transcript is ready, at 30 days when none arrives, and a dial that offered to keep it longer would offer what the runtime refuses to do |
| Time, direction, participants, outcome | the business-record period | metadata is the house's books |
| Order facts read from a call | the order they cite | they are evidence for a line, and they live with it |

**So there is one drawing.** `voice.ts` exports `retentionClock(retention)` — the five rows, with
the transcript row's period taken from `RETENTIONS` in `company.ts`, which IS the dial — and both
surfaces render it. «Your data» now carries three rows: the transcript (pressable, opening the
dial) and the two audio rules as facts, in the phone rail's own words character for character.
`drive-195-retention-notice.py`'s block E walks both surfaces in one context, moves the dial to
ninety days and asserts the phone rail followed, then sets it back. Red-proved twice: a
`retentionClock` that ignores the dial answers **78 GREEN / 2 RED**, and a seat that goes back to
«Recordings and transcripts» answers **75 GREEN / 5 RED**.

**The runtime's side of it.** `ROCOTO_TRANSCRIPT_RETENTION_DAYS` is the box's number and the sweep
prefers a call record's own `transcriptRetentionDays` when a record states one (VOICE-21A decision
6). Nothing stamps that field yet — the dial is local state and a runtime write would be an endpoint
the kit does not name — so on today's single-house box the knob governs and the unit sets 365, which
is the same twelve months the shipped dial states. RUN-11 item 5 carries the owed writer.

**Every line says what IS.** A sentence about what a system does hold answers the question a house
is asking; a sentence about what it does NOT hold spends their attention on the wrong subject and
plants the doubt it meant to settle. The recording default was migrated for the same reason —
«Store no call audio by default» became «Audio begins when the house turns recording on, and it
stays with the provider» — which is also true to VOICE-09A, where a `metadata_only` connection has
no audio anywhere until the house turns recording on — and `drive-195-retention-notice.py` holds
the whole surface to it with a
word-boundary scan, so the regression cannot come back quietly.

## VOICE-22 · The kit's voice surfaces, and where each object is drawn

One drawing per object, mounted everywhere it stands (§137.1's law applied to this rail).

| Object | File | Where it stands |
|---|---|---|
| the rail's standing line | `voice-objects.tsx` · `RuntimeStanding` | Connections' activation step and review, the call dialog, the unmatched queue, the customer's Calls block |
| the identity card | `voice-objects.tsx` · `IdentityCard` | the unknown caller (asks by itself), the customer sheet (asks on a press), the create-customer draft (asks on a press) |
| a call as a row | `voice-objects.tsx` · `CallRow` / `CallList` | the customer's Calls block, the conversation's rail, the unmatched queue |
| a call, opened | `voice-objects.tsx` · `CallDetail` | the customer sheet, the conversation, the unknown-caller dialog |
| the transcript | `voice-objects.tsx` · `TranscriptPanel` | inside every call sheet |
| the activation test | `phone-connection.tsx` · `ActivationTest` | Connections, step 4 |
| the retention clock | `phone-connection.tsx` · `RetentionNotice` AND `areas/admin/data.tsx` (numbers: `voice.ts` · `retentionClock()`, transcript period from `company.ts` · `RETENTIONS`) | Connections, step 3 — under the recording default it explains; «Your data» → «How long conversations are kept» |
| the seam | `voice.ts` | every one of the above |

**Who is asked, and when.** VOICE-07C's order is enforced by WHERE the lookup is automatic: the
house's own book is matched first — two numbers are the same line when their last nine digits are —
so the unmatched queue is exactly the inbound calls on the house line that no account owns, and only
those are looked up by themselves. A number that already belongs to an account is looked up when a
person presses, because the house is the authority about its own customers and Google is a
suggestion about a stranger.

**What the customer sheet gained.** A `Calls` block beside `Emails`: the rail's standing, the
account's calls, one control to call them, and the identity card. It stands whenever the runtime can
answer, and always for an account whose orders arrive BY phone. The same block rides the albarán's
customer overlay unchanged, because the sheet is one (§137.1).

## VOICE-23 · Proof

`drives/drive-199-voice-real.py` — **245 GREEN / 0 RED** at 1920×1080 · 1536×864 · 1366×768 ·
393×873 · 390×844 · 360×800, across four postures (runtime ABSENT · runtime up without Twilio ·
runtime STUBBED by the harness · the real W6 runtime when it answers), proven red first by six
source flips. `drives/drive-191-voice.py` keeps E191's design honest at **271 / 4**, its two
§196.6-repealed claims migrated in place.

**E195.21 · the live posture, proven as its own posture.** `drive-191-voice.py` now reads
`/api/health` and `/api/health/twilio` on the page's own origin and holds the rail's standing to
what it finds, once per journey per viewport — «Runtime offline» with no runtime, «Prepared
· not connected» against the deployed one — and it prints the posture it found, so a green run says
WHICH truth it proved. `drive-199-voice-real.py` gains an `account_refused` band: a stub that HOLDS
Twilio keys and answers `401` on the account is held to «Prepared · awaiting connection», in Twilio's own
words, with the outbound act still the device's dialler. Both counts are pinned in
`run-193-public-proof.py`, and both are red first against the E193 dist, whose fold reads
«Connected» on key presence alone.

**E195.21 repair round · three more bands, and what they caught.** `drive-199-voice-real.py` now
drives seven postures. `account_unasked` answers `/api/health/twilio` with the TRANSPORT shape
(`{"reachable": false, "why": "ConnectTimeout"}` — no `status`) and holds the rail to the same
standing in the HOUSE's own words, with `Twilio said` and `ConnectTimeout` both absent from the
card. **It caught the kit saying «Twilio answers the runtime once the account accepts its keys» for
an account that had never answered** — a declined-keys sentence over an unanswered account — which
is why `status` now decides the sentence and not merely the quote. `dial_refused` drives `POST
/api/calls` twice: once refusing by NAME (`twilio_failed`), once refusing with a status and NO BODY
at all. Against the published E193 dist those two legs print «Runtime · 502 on /api/calls» and
«Runtime · 503 on /api/calls» on the customer sheet — a status code and an endpoint path handed to a
person as the outcome of pressing **Call** — and that is the red the band was written to produce.
The pin is `voice-real` 240 → **256**; on a box where the W6 runtime answers on 127.0.0.1:8790 the
leg adds its own claims, which is why an earlier run of this suite reported 245 where the runner
pins 240.

The live Google Places leg was run against the real runtime from this box: `GET /api/identity` for
`+34 932 21 10 00` answered `Hotel Arts Barcelona`, `Carrer de la Marina, 19-21 · 08005 Barcelona`,
`landline`, confidence `0.95`, with the canonical `place_id` map URL — «the number->gmaps info was
working flawlessly», ported and proven. A number Google cannot place came back with confidence `0`
and no name, which the kit reads as «Google knows this number as a private line» rather than as a
match.
