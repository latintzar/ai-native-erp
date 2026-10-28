# Cedar phone implementation

Status, 13 September 2026: the phone rail is commissioned and proven live on the dedicated
development preview `cedar-channels.soyrocoto.com`. The selected Twilio account is verified, the
workspace's number is **issued at the setup step** (a GB mobile through the account's approved
bundle, its voice URL and status callback read back on the preview), and real calls ran through the
whole rail: outgoing in both modes, inbound with first-answer on the browser and on the mobile with
the other leg clearing, hang-up from the web, live media transcription, saved dual-channel
transcripts, line disconnect and reconnect, and the audio recording notice. One check still needs a
real SIM: carrier forwarding reported as `verified`. The dated evidence is in
[Evidence](#evidence-and-remaining-provider-proof); the reproducible flow, account facts and findings
are [the commissioning brief](../../../../docs/omitted-sources.md).

The scoped implementation is `mock-api/app/phone_runtime.py`, `phone_store.py`, `phone_stream.py`, and `phone_retention.py`. Cedar's frontend uses its shared connection workspace; the existing legacy `/api/calls` experiment keeps its separate store and behavior.

How the rail lives inside Cedar — the hybrid connection, the prelinked proof customer, chats, the
order proposal, reset — is [PHONE-INTEGRATION-SPEC.md](PHONE-INTEGRATION-SPEC.md).

## Runtime and access

`main.py` includes `phone_runtime.router`, awaits `phone_runtime.start()` in application startup, and awaits `phone_runtime.stop()` during shutdown. `websockets>=14,<18` is the additional runtime dependency. HTTP clients have fixed provider origins, timeouts and redirect refusal; raw provider errors and credentials stay outside responses/logs.

`POST /api/cedar/access/workspaces` creates the shared Cedar bearer workspace. Phone setup, history, transcripts and call actions require that workspace's bearer. `CEDAR_CHANNEL_OPERATOR_KEY` authorizes commissioning separately. SQLite state is private at `ROCOTO_RUNTIME_STATE_DIR/cedar-phone.sqlite`; the store atomically binds each receiving number and canonical call SID to one workspace. Scoped phone rows are never written to the legacy publicly readable call store.

Existing server environment fields are reused:

| Field | Purpose |
| --- | --- |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Selected Rocoto account and signed callbacks |
| `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` | REST authentication and short-lived browser Voice grants |
| `TWILIO_TWIML_APP_SID` | Browser outgoing-call TwiML application |
| `TWILIO_NUMBER_ISSUE_LIMIT` | How many numbers this runtime may buy in total; 0 refuses issuance |
| `ROCOTO_RUNTIME_PUBLIC_BASE` | Explicit HTTPS origin used to construct and validate callbacks |
| `DEEPGRAM_API_KEY` | Server-only Spanish live/saved transcription |
| `CEDAR_CHANNEL_OPERATOR_KEY` | Shared Cedar commissioning authority |

The commissioning path stores up to five business lines in the scoped connection, independently
from the legacy `TWILIO_HOUSE_NUMBER` / `TWILIO_OPERATOR_NUMBER` fields. The first commissioned
line remains the outgoing default until the owner explicitly changes it. Incoming callbacks select
the exact line by Twilio destination. Existing single-line state upgrades in place to the first
default line without changing its setup, connection or checks.

## The operator grant issues the workspace's number

The measured, reproducible flow — the account facts, the step table and what each provider answered
— is the commissioning record `docs/briefs/cedar-provider-commissioning-2026-09-11.md`, which
arrives with [pull request 95](../../../../docs/omitted-sources.md). Three of its facts
change what the browser draws, so they are stated here beside the code that reads them:

| Fact | What the UI does with it |
| --- | --- |
| The operator grant carries `issue_number`, so the workspace's number is bought at the setup step where the business enters its own number | Step 2 states the issued number from `readiness.inbound_number`; the two numbers the person typed stay as typed |
| The issued number IS the caller ID, so `caller_id_verified` arrives true (`caller_id == inbound_number`) | The caller-ID step stands only while `readiness.caller_id_verified` is false; a grant that issues the number sends the walk from forwarding straight to the transcript question |
| What a recorded call plays first is the operator's `notice` — `none`, `spoken` or `audio` — behind `recording_policy_approved` | The line's own setup carries whether it records; the walk promises the transcript it saves and leaves the notice to the grant |

The recording wire vocabulary lives in one place, `phone-capability.ts`. A line's setup has always
travelled as `off` | `notice`; `PHONE_RECORDING_WIRE` also accepts the operator's `none` | `spoken`
| `audio`, `phoneRecordingOn(value)` reads either, and `phoneRecordingWire(on)` writes the pair the
running runtime accepts. [The capability test](../../../tools/test-phone-capability.mjs) exercises
both vocabularies, so the browser keeps working whichever side of that merge it is built on.

## Commissioning: the operator grants, the setup step buys the number

Peter, 11 September 2026 ([FEED-IA §245](../../../../docs/FEED-IA.md#245--cedar-phone-and-email-go-live-the-number-is-issued-at-setup-no-notice-order-mail-only)):
the number is issued when the business sets up, there is no caller-ID verification step, and a
recorded call hears a short notice in a voice of ours or none at all. The flow has two actors and
two moments.

**1. Operations grants the workspace, once.** `POST /api/cedar/phone/operator/{workspace}/commission`
with the operator bearer carries `issue_number:true`, `number_countries` in order of preference,
optional `compliance:{CC:{BundleSid,AddressSid}}` for a country whose regulation needs a bundle,
`allowed_destinations` (1–20 E.164 numbers this development runtime may ring), `region`,
`deepgram_region`, `account_owner`, `operations_approved:true`, `recording_policy_approved`,
`notice` (`none` | `spoken` | `audio` with `notice_audio_url`) and `configure_webhooks:true`. The
runtime reads the Account with the account credentials — a Standard API key answers 401 on that
one resource and 200 everywhere else — verifies the TwiML Application, pins its Voice URL to
`…/api/cedar/phone/twilio/browser`, and records the grant. `TWILIO_NUMBER_ISSUE_LIMIT` (default 0)
caps how many numbers the whole runtime may buy; at 0 the grant itself is refused. A number the
account already owns can be bound instead with `inbound_number`; its caller ID defaults to that
number.

**2. The person sets up, and that step buys the number.** `Connect phone` asks one question per
step — `What's your current phone number?`, `What's your mobile number?` — and `POST /lines` then
issues the workspace's number once: a number already tagged `rocoto-<workspace>` in the account is
reused; otherwise each preferred country is tried, `Local` then `Mobile`, a regulatory refusal is
recorded in `checks.number.attempts` and skipped, and the first purchase carries the inbound Voice
URL and StatusCallback in the purchase request itself. The bought number becomes the line's
`inbound_number` and its `caller_id`, `caller_id_verified` arrives true, and the line is
`commissioned`. The next step, `Forward your calls to this number`, shows that number large: the
person forwards their own line to it, and `/lines/{id}/forwarding-test` arms a five-minute window
in which a call from the expected handset moves `forwarding_state` to `received`, or to `verified`
when the carrier signs `ForwardedFrom` with the business number. The caller-ID question stands
only while `caller_id_verified` is false, so an issued number goes straight from forwarding to
`Save call transcripts?`, saved through `/lines/{id}/setup`. Browser or mobile answering is chosen
per call, never at setup. Existing lines appear with their exact readiness, `Add another` and an
explicit outgoing-default action; `Use test data` is a labelled local walkthrough of every step
that calls no provider endpoint. `POST /phone/lines` answers with the whole line and the walk holds
that answer as its evidence until a read issued after the write can carry it; a person who leaves
half way resumes at the first step their line has yet to meet.

**Which countries a number can come from today.** Twilio's regulations, read on 11 and 13
September for a business end user: **US** local needs nothing; **GB** mobile is bought with the
account's approved bundle and its validated address, while GB local needs a Business Address
bundle; **FR** local needs a commercial registrar excerpt for identity and address; **ES** local
needs the business registration document with the name and the NIF and a proof of address. Each of
those is one bundle filed once from Rocoto's own documents, after which the preference list simply
starts working for that country. **Peru** is the exception: Twilio sells only toll-free Peruvian
numbers (+51 800…, about £102 a month and £0.30 an inbound minute), so a local Peruvian number
needs another carrier — an open point recorded in the brief.

**The recording notice** is the grant's decision, behind `recording_policy_approved`: `none`
records from answer with no announcement, `spoken` plays the Spanish sentence, `audio` plays an
HTTPS clip on the caller's leg before the dial and on the answering leg through `/twilio/notice`.
The shipped clip is `app/public/cedar-audio/recording-notice-es.mp3` — «Grabamos la llamada para
gestionar tu pedido.», 2.8 s, ElevenLabs `eleven_multilingual_v2` on the Rocoto account (voice
Sarah), verified by Deepgram Nova-3 Spanish at confidence 1.0 on 13 September 2026. Every Cedar
origin serves it at `/cedar-audio/recording-notice-es.mp3`, so `notice_audio_url` is
`<origin>/cedar-audio/recording-notice-es.mp3`. Connections commissioned before the field existed
keep the spoken sentence. The company terms state the notice, its sentence and the retention;
jurisdiction, carrier and privacy approval remain part of commissioning.

## Connection state in the browser

The browser holds one provider snapshot — `{status, evidence, error, checkedAt, staleSince}` — in
`phone-runtime.ts`, published through `usePhoneProvider()`. Its refresh policy is bounded rather
than once-per-page:

| Trigger | Behaviour |
| --- | --- |
| First subscriber mounts | one read, when `checkedAt` is still `0` |
| `window` focus, `document` visibilitychange to visible | one read, with a floor of 10 seconds since the last answer |
| A subscriber stays mounted | one read every 60 seconds while the tab is visible |
| Any setup write | `acceptPhoneSetup(evidence)` publishes the response it just received |
| A read that failed to confirm the evidence | `declinePhoneSetup(error)` keeps the last evidence and its posture and records `staleSince`; the surfaces add one quiet `Checking…` |
| A read the provider answered about this workspace — 401, 403, 404 | the evidence is cleared, the posture is `unavailable`, and `staleSince` is `0` |
| A first read that failed with nothing standing behind it | the same: `unavailable`, `staleSince: 0` |
| Workspace reset or a channel-access storage event | the generation counter advances, the snapshot returns to `checking`, and a fresh read starts while subscribers remain |

A failed read is a fact about the network rather than about the line. With the snapshot read once
per page life this could not arise; with a sixty-second poll it can land mid-call, and clearing the
evidence took the dial's controls, the Connections word and the controller's own 1.5-second
active-call poll with it. Only the provider's own answer about this workspace moves the posture.

A SETTLED posture carries `staleSince: 0`. `stale` means «this evidence stands and the last read
failed to confirm it», so a branch that clears the evidence has nothing left to be unsure about:
publishing `unavailable` with a stale mark printed `Connect phone to call from Rocoto. Checking…` on
every telephone customer's sheet of a workspace whose connection cannot be read, renewed by every
sixty-second failure.

`revision` is the request-generation guard: a response issued before a reset is discarded instead of
overwriting the current workspace's state. `writes` is its counterpart for ordering: every write in
`phoneApi` stamps it, `refreshPhoneSetup` records it when a read starts, and a response whose stamp
has moved is discarded rather than published. A `/phone/setup` read already in flight when
`POST /phone/lines` landed carries the state BEFORE the line existed, and a snapshot that walks
backwards is read as a revocation — which threw the first `Connect phone` on a sample account back
to step 0 under «This line was disconnected».

A write also DROPS the read its stamp condemns. `refreshPhoneSetup` hands a second caller the read
already in flight, and phone setup's last two steps are `write, then await provider.refresh()`, so
that refresh could be handed a task the stamp had already discarded: it resolved having published
nothing and raising nothing, and the caller ID the provider had just verified — or the transcript
choice just saved — stayed missing from the capability for up to a refresh period. Every `phoneApi`
write, and `acceptPhoneSetup`, therefore clear `pending` as well as stamping `writes`; the settling
task's own `finally` is guarded by `if (pending === task)`, so a read that is still legitimate keeps
its slot. Listener count drives the focus/visibility listeners and the interval, so an application
with no phone surface mounted holds no timer.

`phone-capability.ts` derives the single capability from that snapshot. It is a pure module — it
imports only types — so [its tool test](../../../tools/test-phone-capability.mjs) exercises the real
derivation, and the same file loads `phone-runtime.ts` itself under Node to drive the write/refresh
ordering against the real `refreshPhoneSetup`. `phoneCapabilityOf(state)` returns `posture` (`checking`, `unavailable`, `setup`,
`partial`, `ready`), the selected `line`, `callerId`, `inboundNumber`, `accountReady`, `browserReady`,
`mobileReady`, `forwardingState`, `transcriptionReady`, `needs`, `checkedAt`, `stale` and
`staleSince`. `ready` requires the default line
to be commissioned with `account_verified`, `caller_id_verified` and `forwarding_state: verified`;
`browserReady` and `mobileReady` stay separate because they select a call's route rather than the
line's existence. `phoneSetupResumeStep(line)` says where `Connect phone` resumes, and
`phoneStatusWord(posture)` is the Connections card's word.

Every call entrance reads that capability: the dial dialog mounts its controls only on `ready`, the
Connections Phone card takes its status and its description from it, onboarding's phone channel is
connected only on `ready`, and the customer sheet's Calls block states it. A browser draft in
`rocoto-phone-connection-v1:<tenant>` records the numbers a person typed; it never contributes to
that status.

The call controller mounts its session on `accountReady` — the selected line commissioned with
`account_verified` — because incoming calls, active-call recovery and hang-up follow the provider
ACCOUNT. Only placing a call additionally requires `ready`, which is the dial's own question. A line
whose caller ID is still pending therefore takes an incoming call and can be hung up from the web.

`openPhoneDial({number, customerId})` in [phone-session.ts](phone-session.ts) is the one door the
customer sheet's two entrances, the connected inbox and `call-record.tsx`'s `CallDock` use; the chat
panel reaches the same dial through `phoneDialRoute`. It pushes the canonical hash when the surface
has an address of its own, and mounts
`PhoneDialDialog` above the current surface when one of the addressless overlays is standing — the
customer sheet opened over a product card or from knows-web, and the chat panel's connected inbox,
which are component state and would be unmounted by a route change that `history.back()` cannot
restore. Either way the number the entrance carried is the number the dial opens with, and an
entrance on an account whose number is derived rather than stored resolves that derived number
before it calls the door (`customer.phone?.trim() || accountNumber(customer)`), so no entrance opens
a dial with an empty field.

`PhoneDialHost` inside `PhoneCallController` owns the in-place mount, and it holds the route's own
two behaviours. `Connect phone` there renders `PhoneSetup` in the same mount rather than navigating,
so the overlay survives the whole walk and closing setup returns to the same dial. And it drops its
request on `hashchange`, because the dial has no address: without that, browser Back moved the area
underneath and left the dial standing over whatever was drawn next.

### Where a call is read

A call is drawn once, by [`voice-objects.tsx`](voice-objects.tsx), and mounted in three seats: the
customer sheet's rail, the conversation's rail and the dial. The Google Places identity of a number
the book has yet to own is the sheet's own card, `sheet-caller-identity`. `PhoneInboundPreview`
drew a fourth seat — a prepared unmatched-caller queue with its own link-and-create walk, keyed
`phone-unmatched-*` — which nothing mounted; it left [`phone-connection.tsx`](phone-connection.tsx)
on 13 September 2026, and [`drives/drive-199-voice-real.py`](../../../../docs/omitted-sources.md)
drives the three live seats in its place.

## Owner API

Every path below starts `/api/cedar/phone` and uses the shared owner bearer.

| Route | Contract |
| --- | --- |
| `GET /setup` | Default-line compatibility fields plus `{default_line_id,lines[]}`; each line has its own setup, readiness and checks. |
| `POST /setup` | `{source_number,fallback_number,recording:'off'|'notice',live_transcription:boolean}` |
| `POST /lines` | Creates or returns one business line from the setup body; both E.164 numbers are required and distinct. Under an issuance grant it buys the workspace's number once and returns the line `commissioned` with that number as inbound and caller ID. |
| `POST /lines/{line_id}/setup` | Updates transcript preference; commissioned source/fallback identity remains bound. |
| `POST /lines/{line_id}/default` | Selects a commissioned line for future outgoing calls. |
| `DELETE /lines/{line_id}` | Ends that line's active calls, clears its Twilio voice/status hooks, removes its active access and keeps saved call history. The owned Twilio number remains in the provider account. |
| `POST /lines/{line_id}/caller-id/start`, `/caller-id/check` | Twilio's caller-ID verification for a line bound to an owned number whose caller ID differs from it; an issued number never needs it. |
| `POST /lines/{line_id}/forwarding-test` | Arms or reads the selected line's five-minute forwarding observation. |
| `POST /caller-id/start` | `{number}` → `{validation_code,call_sid,status:'pending'}` |
| `POST /caller-id/check` | `{number}` → updated setup/readiness |
| `POST /forwarding-test` | `{expected_from}` → setup with a five-minute observation window |
| `POST /token` | `{device_id}` → `{token,identity,workspaceId,expiresAt}`; expiry is Unix seconds, TTL 600 seconds |
| `POST /calls` | `{to,mode:'browser'|'phone',idempotency_key}` → `{intentId,params:{Intent,Workspace},sid?}` |
| `GET /calls?number=…` | Scoped saved/active history, newest 200 calls |
| `GET /calls/active` | Scoped active calls |
| `GET /calls/{sid}` | Canonical call, also addressable by a known child SID |
| `POST /calls/{sid}/hangup` | End the canonical provider call; signed status callback updates saved truth |
| `POST /calls/{sid}/transcribe` | Explicit bounded retry while provider recording custody remains |
| `GET /calls/{sid}/intake?after=0&limit=50` | Durable intake events, `next_cursor`, `has_more`; limit ≤100 |

Browser `Device.connect` receives the returned parameters unchanged. Grants allow up to eight active per-device identities. The signed browser callback checks identity, workspace and the single-use intent. Each intent retains the outgoing line selected when the owner pressed Call, so a later default change cannot move that call. Canonical `sessionId` equals the public `intentId`; the intent token stays in the authorized browser body. Phone-first callback URLs carry its public derived ID and still require Twilio's signature. A timeout/uncertain REST call creation persists that phase and refuses to resend the same intent. The pilot caps new intents at 20/hour/workspace, ring time at 25 seconds and connected calls at 30 minutes.

Inbound TwiML rings the registered browser identities and the selected fallback phone together. The Client receives the canonical SID in its `ParentCallSid` custom parameter. Twilio connects the first answered child and cancels the other attempts. Canonical state preserves that winner when a canceled or late leg callback arrives. Carrier voicemail can answer a PSTN leg; real handset/voicemail behavior is part of the commissioning check. Native iOS/Android push wake-up is outside this browser-plus-phone implementation.

## Transcripts and intake sources

Live media needs both the signed Twilio WebSocket handshake and its exact account/call/workspace stream capability. Each 8 kHz mu-law track uses its own Deepgram stream and timestamp clock; bounded silence fills transport gaps, overlapping retransmissions have one effect. Deepgram calls use Spanish Nova-3 with `mip_opt_out=true`; keys stay server-side. Three simultaneous live calls are supported by this development process.

`liveTranscript.utterances` contains `{id,track,speaker,start,end,text,final}`. Speaker `0` is the house and `1` the customer, mapped from the direction of the canonical call. Interim segments can update; finalized segments are immutable. A saved dual-channel transcript replaces the displayed live preview while preserving its intake evidence. The saved download explicitly requests two channels and rejects an unsuitable transcription response instead of assigning unsupported speaker roles.

Each finalized segment creates an atomic `final_delta` outbox event with `mode:'incremental'`, stable ID, sequence, source IDs and quoted timing/speaker evidence. Saved transcription creates separate `full_transcript` events with `mode:'historical'`, a revision ID and batches of at most 50 utterances. Replay is idempotent. Consumers preserve the distinction: historical revisions update source review and never create another live intake. The event's `proposal:{kind:'order-intake',customer_id:null,lines:[]}` is explicitly `pending-review`; actual catalogue/customer matching belongs to the reviewed order intake. Source text is evidence, not an instruction to execute.

### Bounded live transcript to order draft

The phone runtime remains the source of utterance truth. The conversation/order consumer reads `GET /calls/{sid}/intake?after={cursor}&limit=50`, accepts only `final_delta` events with `mode:'incremental'`, and accumulates them in sequence order. Interim words update the live transcript UI and never enter order intake. `full_transcript` events are history and review evidence only.

Every accepted utterance carries these stable locators through the whole order proposal:

- `workspace_id`, canonical `call_sid`, intake `event_id` and `sequence`;
- utterance `id`, speaker/track, start/end seconds and exact quoted text;
- `source_id = phone:{workspace_id}:{call_sid}:{utterance_id}`.

One accumulator is allowed per workspace and canonical call. The mounted
[phone intake consumer](phone-intake.tsx) and its deterministic
[chunk model](phone-intake-model.ts) flush whole finalized utterances at the first applicable
boundary:

1. The source timestamp gap reaches 1.8 seconds.
2. Adding another utterance would exceed 800 Unicode characters, 12 finalized utterances or 30 seconds from the first included start time.
3. The call reaches a terminal state, which flushes every remaining finalized utterance.

Deepgram's explicit `speech_final` signal is not yet present in the durable phone event contract,
so the consumer derives the speech boundary from the ordered final-utterance timing. A single
whole utterance above 5,000 characters is retained as evidence and marked for manual review
instead of being sent to the order reader.

An utterance stays whole. If one utterance alone exceeds the character ceiling, it forms one bounded chunk. A boundary before a new utterance flushes the existing chunk and starts the next with that utterance. Live silence uses a timer for promptness; replay derives the same boundary from source timestamps and ordered IDs. A late or retried event with an existing `event_id` has no effect.

The deterministic chunk identity is the hash of `workspace_id`, canonical `call_sid`, ordered included `event_id` values and boundary kind. The consumer writes that chunk, its ordered `source_id` list and the resulting pending order proposal in one durable transaction. Its idempotency key is `(workspace_id, call_sid, chunk_id)`. The consumer advances the intake cursor only after that transaction commits. A crash before commit replays safely; a crash after commit finds the same key and advances the cursor without adding draft lines again.

The order brain receives only the bounded quoted chunk, speaker attribution, known conversation/customer reference and existing open draft reference. It may append a proposed line, quantity or delivery fact to that draft with every contributing `source_id`. It leaves uncertainty as a review item and never performs catalogue/customer assignment or an order action from transcript text alone. Consecutive chunks may enrich one open draft; their stable source sets prevent a repeated utterance from changing it twice.

Conversation integration exposes one generic source-arrival envelope keyed by workspace, provider conversation/call and event ID. Phone maps `final_delta` into that envelope and acknowledges it after the shared ledger durably applies it. The shared intake path filters `full_transcript` before proposal creation while the phone history UI continues to display that saved revision. The complete mounted contract and focused proof are recorded in [PHONE-INTAKE.md](PHONE-INTAKE.md).

The Cedar adapter appends one shared day event per flushed chunk. `eventId` is the deterministic `chunk_id`; the existing workspace-scoped day store supplies the workspace part of the idempotency boundary:

```ts
{
  kind: 'source-arrive', sale: `phone:${eventId}`, at,
  customer, customerName, customerPhone, offset: 0, text,
  channel: 'phone', sourceEvent: eventId, conversation: callSid,
  occurredAt, historical: false, lines,
}
```

The resulting Sale/thread source retains `{channel:'phone', messageId:eventId, conversationId:callSid, occurredAt, historical:false}`. Duplicate delivery is identified by `channel + sourceEvent` inside that workspace. The phone cursor advances only after the day ledger accepts this event durably; rejection or interruption leaves the cursor available for replay.

Raw audio stays in memory (maximum 50 MB) and at Twilio while custody remains. Saved transcription jobs have a durable indexed queue, three-attempt limit, backoff and crash-lease recovery. Cleanup uses authenticated Twilio DELETE and records removal only after successful/already-absent confirmation; failed cleanup retries separately from transcription. A usable transcript triggers provider audio removal. The existing clocks apply to scoped calls too: remaining audio defaults to 30 days, transcript and quoted intake text to 365 days, call-record expiry defaults off. A configured zero disables that clock. Expired evidence retains source locators; expired call records retain a tombstone against callback recreation. Runtime storage/backup operators own corresponding snapshot expiry.

## Evidence and remaining provider proof

Run the focused deterministic suite from the repository root:

```sh
PYTHONPATH=mock-api .venv/bin/pytest -q mock-api/tests/test_cedar_phone.py
python3 tools/py-gate.py types
```

The suite covers workspace isolation, operator commissioning and issuance grants, number purchase
with country fallback and the runtime issue limit, recorded refusals, notice modes on every leg,
selected destinations, once-only uncertain creation, signed callbacks, first-answer/late-leg
ordering, dual-channel roles, raw-audio custody, deletion retry, expiry, restarted recording jobs,
final-delta/history separation, and an actual local signed WebSocket carrying two fixture audio
tracks. All provider HTTP/WebSocket transports in this proof are fixtures; external calls are zero.

Measured on the real providers, on `cedar-channels.soyrocoto.com`:

- **11 September 2026** (source `bf18d961`): operator grant HTTP 200; setup bought a GB mobile
  through the approved bundle; Twilio read back its voice URL, status callback and the TwiML
  application on the preview origin; Voice JWT minted with incoming and outgoing grants; browser
  call intent created; a destination outside `allowed_destinations` refused with 409; Deepgram
  Nova-3 Spanish HTTP 200 on `api.eu.deepgram.com` and `api.deepgram.com` with the repository
  voice fixture.
- **13 September 2026** (source `c80f92d1`), with a rig of two temporary Twilio numbers standing
  in for the house mobile and the customer, each auto-answering with Twilio-hosted TwiML that
  speaks a Spanish order: outgoing calls in both modes; inbound with first-answer on the browser
  (Voice SDK 2.18.4 in headless Chromium) and on the mobile, the other leg clearing each time;
  hang-up from the web; 7 live `final_delta` events per call from the media WebSocket; saved
  dual-channel transcripts with speaker 0 the house and 1 the customer; line disconnect clearing
  the number's hooks at Twilio and reconnect reusing the tagged number without a purchase; the
  audio notice served through `/twilio/notice`. The forwarding test reached `received`;
  `verified` needs a carrier-forwarded call, which a Twilio-to-Twilio call cannot produce. The
  table is in [the commissioning brief](../../../../docs/omitted-sources.md);
  all rig numbers were released afterwards.

Still open: carrier forwarding `verified` with a real SIM, and a filed regulatory bundle before a
Spanish or French number can be issued.

Official transport references: [Twilio Client and simultaneous dialing](https://www.twilio.com/docs/voice/twiml/client), [Dial and dual-channel recording](https://www.twilio.com/docs/voice/twiml/dial), [caller-ID validation](https://www.twilio.com/docs/voice/api/outgoing-caller-ids), [Media Streams frames](https://www.twilio.com/docs/voice/media-streams/websocket-messages), [recording download/deletion](https://www.twilio.com/docs/voice/api/recording), and [Deepgram live transcription](https://developers.deepgram.com/reference/speech-to-text/listen-streaming).
