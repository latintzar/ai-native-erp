# Cedar phone: working integration and product implementation

Owner: Cedar. Focused surface: **the channels check page**, served at
[cedar-channels.soyrocoto.com/check](https://cedar-channels.soyrocoto.com/check/), and the Cedar
workspace on the same origin. This document records the implemented integration, its actual
evidence and the concrete work for using it in Cedar's full UX, in the shape of
[the WhatsApp document](connections/IMPLEMENTATION.md). The runtime contract, the browser
snapshot and the transcript-to-order path are [PHONE-IMPLEMENTATION.md](PHONE-IMPLEMENTATION.md);
the measured steps are in [the commissioning brief](../../../../docs/omitted-sources.md);
what a call turn is and where a reply leaves from is [CHANNEL-SEMANTICS.md](CHANNEL-SEMANTICS.md);
the call screens are [CALL-UX.md](CALL-UX.md).

Peter's words, [FEED-IA §245.13](../../../../docs/FEED-IA.md#24513--the-hybrid-connection-prelinked-to-a-customer-specced-like-whatsapp-14-september)
and [§245.14](../../../../docs/FEED-IA.md#24514--same-for-phone-14-september): «a hybrid real
connection … "prelinked" to a customer so it appears in chats … if i reset seeded state AND
disconnect it removes the connection … the order brain should actually work in practice» — «same
for phone».

## Implemented and observed

On 11 September 2026 the operator grant approved a workspace for calling and the setup step
bought the workspace's number at the mobile step (a GB mobile through the approved regulatory
bundle, `+44 7460 094145`), wired its voice URL, status callback and TwiML application on the
preview origin, minted a Voice JWT with incoming and outgoing grants, created a browser call
intent, refused a destination outside the allowed list with 409, and reached Deepgram Nova-3
Spanish on the EU and US endpoints. The caller ID is the issued number; the verification step is
gone.

On 13 September, with two temporary Twilio numbers standing in for the house mobile and the
customer (each auto-answering with Twilio-hosted TwiML that speaks a Spanish order): outgoing
calls in both modes; inbound with first answer on the browser (Voice SDK 2.18.4) and on the
mobile, the other leg clearing each time; hang-up from the web; seven live `final_delta` events
per call from the media WebSocket; saved dual-channel transcripts with speaker 0 the house and 1
the customer; the recording notice served as the shipped ElevenLabs clip; disconnect clearing the
number's hooks at Twilio and reconnect reusing the tagged number without a purchase. All rig
numbers were released. Main carries the runtime through PRs #95, #99 and #100; the number is
issued at setup, the notice is `none`, `spoken` or `audio` per grant.

Still open, and only Peter can close them: carrier forwarding `verified` (a real call forwarded by
the Spanish SIM), the regulatory bundle documents for a Spanish or French number, and Peru.

## Source and product destinations

- Runtime: [phone_runtime.py](../../../../mock-api/app/phone_runtime.py) (routes, Twilio, Deepgram,
  media WebSocket), [phone_store.py](../../../../mock-api/app/phone_store.py) (lines, calls,
  issued numbers, intake outbox). Operator grants and the notice clip are in
  [mock-api/deploy/CEDAR-CHANNELS.md](../../../../docs/omitted-sources.md).
- Browser contract: [phone-runtime.ts](phone-runtime.ts) (the one provider snapshot),
  [phone-capability.ts](phone-capability.ts) (the derived posture), [phone-session.ts](phone-session.ts)
  (the dial door), [phone-call-model.ts](phone-call-model.ts) (`customerForPhone`),
  [phone-intake.tsx](phone-intake.tsx) and [phone-intake-model.ts](phone-intake-model.ts) (the
  bounded transcript chunks that become order proposals).
- Product destinations: the setup walk ([phone-setup.tsx](phone-setup.tsx), also mounted on the
  check page), Connections → Phone, the onboarding channel step, the customer sheet's Calls block
  and dial, the chat panel's dial, the call route and the call dock, Settings (reset).
- **The prelink** lives in the cast, [`cast.ts`](../../scenarios/data/cast.ts) `FISH_PROOF_ACCOUNT`:
  Bar Latintzar carries `+12025550110`, Peter's UK number. `customerForPhone` resolves an
  inbound call's number against the book, so a call from that number is Bar Latintzar's call: its
  live transcript chunks land in that customer's chat as `source-arrive` events and its order
  proposal opens on that customer. The business number is whatever Peter types at setup (his
  Spanish line); the Rocoto number is bought there. Nothing in the runtime names either number.

## Actual API contract

All routes under `/api/cedar/phone`, owner bearer unless stated; the rest is in
[PHONE-IMPLEMENTATION.md](PHONE-IMPLEMENTATION.md#owner-api).

| Route | What it answers |
| --- | --- |
| `POST /operator/{workspace}/commission` (operator bearer) | the grant: `issue_number`, `number_countries`, `compliance`, `allowed_destinations`, `notice`, `recording_policy_approved`, regions |
| `GET /setup` | the workspace's lines with `readiness` (`inbound_number`, `caller_id_verified`, `forwarding_state`, `browser_ready`, `transcription_ready`) |
| `POST /lines` `{source_number, fallback_number, recording, live_transcription}` | buys or reuses the workspace's number and wires it; the line with its issued number |
| `POST /lines/{id}/setup`, `POST /lines/{id}/default` | the recording and transcript choices; the default line |
| `POST /lines/{id}/forwarding-test` `{expected_from}` | a five-minute window; `forwarding_state` moves to `received` or `verified` |
| `POST /token` | the Voice JWT for the browser |
| `POST /calls` `{to, mode:"browser"|"phone", idempotency_key}` | the call intent; a destination outside the grant answers 409 |
| `GET /calls`, `GET /calls/active`, `GET /calls/{sid}` | call rows with `answeredBy`, status, duration, transcript |
| `GET /calls/{sid}/intake?after=…` | `final_delta` (live, incremental) and `full_transcript` (saved) events |
| `POST /calls/{sid}/hangup` | ends the call at Twilio |
| `DELETE /lines/{id}` | ends active calls, clears the number's hooks; the number stays in the account for reuse |
| Twilio callbacks `/twilio/inbound`, `/twilio/browser`, `/twilio/bridge`, `/twilio/status`, `/twilio/recording`, `/twilio/notice` | signed; first answer wins, the notice plays per grant, the recording is transcribed and deleted |

## Exact UX and state behavior

1. **Connect.** Connections → Phone or the onboarding channel step opens the setup walk: the
   business number, the mobile that also rings (the Rocoto number is bought here and shown large as
   the number to forward to), the forwarding test, recording and transcript, Finish. The caller-ID
   step is skipped because the issued number is the caller ID. The Twilio mark
   (`/connection-brands/twilio.png`) identifies the provider on the tiles.
2. **Posture.** One provider snapshot feeds every surface: the Connections card, the customer
   sheet's Calls block, the dial, onboarding. `ready` requires the default line commissioned with
   the account verified, the caller ID verified and forwarding `verified`; the call controller mounts
   on the account alone, so an incoming call rings and can be hung up before forwarding is
   verified. **Open product call**: outgoing calls need no forwarding, so whether the dial unlocks
   on the account alone is Peter's decision (the commissioning brief's UI needs carries it too).
3. **Chats.** An inbound call from a customer's number is that customer's call: while it runs,
   the live transcript's bounded chunks land in the customer's chat as turns (channel `phone`,
   conversation the call SID) and the order proposal opens on the customer; when it ends, the saved
   dual-channel transcript is the call record, the house as speaker 0 and the customer as speaker 1.
   A call from an unknown number lands on the placeholder customer the intake names.
4. **Call.** The customer sheet, the chat panel and the call dock open the one dial with the
   customer's number; «This browser» rings the customer through the Voice SDK, «My mobile» rings
   the mobile first and bridges the customer; the caller ID is the Rocoto number; hang-up from the
   web ends it. The recording switch promises the transcript; the notice is the grant's decision.
5. **Disconnect.** Connections → Phone → Disconnect clears the number's hooks at Twilio and ends
   active calls; call history stays; the number stays in the account and is reused by tag on the
   next setup without a purchase.
6. **Reset.** «Reset workspace data» keeps the line; «Reset and disconnect everything» runs the
   phone disconnect first and clears the local mirror only when the provider answered
   ([workspace-reset.ts](workspace-reset.ts), FEED-IA §247.6). After it, Bar Latintzar is back in
   the seeded book with its number, the line is gone, and the setup walk starts from the business
   number again; the issued number waits in the account under its tag.

## Backend invariants demonstrated by the proof

- A call rings only the workspace's own legs and only the destinations its grant allows; an
  intent to any other number answers 409 before Twilio is asked.
- The number is bought once per workspace and reused by tag; the runtime's issue limit bounds
  purchases; every purchase attempt is recorded.
- Every Twilio callback is signature-checked; first answer wins and the other legs are cancelled;
  a REST-created call and its inbound leg carry different SIDs and the row lives under the inbound.
- Recording is transcribed dual-channel with speaker roles from the call's direction, then deleted
  at Twilio after confirmation; raw audio never lands on disk.
- `final_delta` events are atomic, sequenced and idempotent; `full_transcript` is history and
  never opens a second order.
- The notice plays per grant on every leg (`none`, `spoken`, the shipped ElevenLabs clip).

## Using real conversations for product intelligence

The live transcript's finalized utterances are flushed in bounded chunks (timing gap, size, or
call end) and each chunk goes to the order brain with the customer reference and the open draft;
the brain may append proposed lines with every contributing `source_id` and leaves uncertainty in
review ([PHONE-IMPLEMENTATION.md](PHONE-IMPLEMENTATION.md#bounded-live-transcript-to-order-draft)).
A call from `+12025550110` speaking an order is the fixture of that walk; the 13 September rig
calls spoke «diez cajas de merluza» and produced seven live events each. The transcript itself is
live today; the order reader behind it waits for a credential, since the preview answers
`copilot: awaiting key` (`GEMINI_API_KEY` or `ANTHROPIC_API_KEY`) — Peter's to supply.

## Live workspace intake

Phone intake reads `GET /calls/{sid}/intake?after=<cursor>&limit=50`, accepts `final_delta` with
`mode:'incremental'`, and applies one `source-arrive` per chunk to the day ledger, keyed by channel
and chunk id, advancing the cursor only after durable apply — the rule WhatsApp and email use.

## Integration sequence and acceptance

1. Connections and onboarding open the setup walk; the Rocoto number is bought at the mobile step
   and shown large; the caller-ID step is skipped; the connected line shows its number and posture.
2. Bar Latintzar's number is the proof: a call from `+12025550110` to the Rocoto number rings
   the browser and the mobile together; the first answer wins; the transcript chunks land in Bar
   Latintzar's chat as turns and the order proposal opens on that customer.
3. Calling Bar Latintzar from the customer sheet rings it from the Rocoto number in either mode;
   hang-up from the web ends it; the call record shows both speakers.
4. The forwarding test moves to `received` on a Twilio-to-Twilio call and to `verified` on a
   carrier-forwarded call from the Spanish SIM; the dial's unlock follows the decision named in «Exact UX and state behavior» step 2.
5. «Reset workspace data» keeps the line; «Reset and disconnect everything» clears it at Twilio and
   locally, the setup walk starts again, and the next setup reuses the tagged number.
6. Every step's evidence is a runtime answer read back and recorded in the pull request; the copy
   law and the theme gate hold on every string and colour.
