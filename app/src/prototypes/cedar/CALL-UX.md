# Cedar phone calls

## Product hierarchy

Phone lives inside communication, in this order:

1. A customer conversation contains messages and calls.
2. A call opens its controls and facts.
3. The transcript expands inside that call.
4. A saved transcript remains available from the conversation after the call ends.

The phone entry uses one blue handset-and-keypad mark. From a conversation it carries that customer; from the conversation list it opens customer selection and a telephone keypad after activation. Before activation, the same route presents a Cedar phone illustration and one setup action.

Every call entrance goes through one door, `openPhoneDial({number, customerId})` in
[phone-session.ts](phone-session.ts): the customer sheet's head action, its Calls block, the
connected inbox, the `CallDock` a telephone conversation carries where a composer would stand, and
the chat panel's own `requestCall`. One control has one destination, whatever the connection is doing.

That door chooses how it opens, and the choice is about what would be lost. A surface with an
address of its own keeps the canonical hash, so the dial stays shareable and closing it returns
where it came from. A surface that is component state — the customer sheet opened over a product
card or from knows-web, the chat panel's connected inbox, and the Messages panel while it stands on
a conversation — gets the same dial mounted above it, because `location.hash` unmounts their host
and `history.back()` restores the address without restoring them. The Messages panel is the one
`CallDock` is pressed in: a hash write reaches `useRouteTransition`, which closes the panel and the
thread, so the call act would take the conversation it was made about. The number the entrance
carried is what the dial opens with, and an account whose number is derived from its own record
rather than stored on it hands the derived number over, so every entrance opens a dial that can be
pressed.

The dial mounted in place is the SAME dial, with the same acts. `Connect phone` opens phone setup
inside that mount, above the surface it was pressed on, and closing setup returns to the same dial —
the route's own behaviour, so one control has one destination there too.

That dial earns a browser Back step of its own, the same `useHistoryLayer` step every other in-place
surface takes. ONE Back closes the dial and leaves the surface beneath it standing, which is what a
person means by going back from a dial they just opened; a second Back then leaves that surface. A
hash change — an area replaced underneath — takes the dial with it, because an addressed move is a
different thing from a layer being closed.

## Routes

Phone is addressable through two canonical hashes owned by [phone-route.ts](phone-route.ts):

- `#/phone/new?number=…&customer=…` opens the dial surface. Both query fields are optional.
- `#/phone/calls/{sid}` opens an active or saved call by the server-issued reference.

Shared navigation resolves the customer ID from its own customer source, passes that customer to `PhoneDialDialog`, and keeps the previous workspace route as the close destination. An active-call route loads the authenticated call and opens the global controller. Unknown or expired call references return to the conversation list with an ordinary unavailable state.

## Connection state

One selector answers «can this workspace call somebody», and every surface reads it:
[phone-capability.ts](phone-capability.ts)'s `phoneCapabilityOf(state)` takes the provider snapshot
and returns a posture — `checking`, `unavailable`, `setup`, `partial` or `ready` — plus the selected
line, caller ID, inbound number, account readiness, browser and mobile route readiness, forwarding
state, transcript readiness, the `needs` list of what is still pending, and whether the evidence is
`stale`. `ready` requires the default line to be commissioned with `account_verified`,
`caller_id_verified` and `forwarding_state: verified`.

A read that failed to confirm the evidence keeps it. The posture holds, `stale` turns true, and the
surfaces add one quiet word — the dial says `Checking…`, the Calls block appends it to its own
sentence. Only the provider's own answer about this workspace (401, 403, 404) clears the line, so a
transient read leaves a live call dialling instead of revoking it mid-conversation.

A posture that is SETTLED is never `stale`. The provider's own answer about this workspace, and a
first read with nothing standing behind it, both publish `unavailable` with `staleSince: 0`: those
are facts, and a fact is never a pending check. Marking them stale printed
`Connect phone to call from Rocoto. Checking…` on every telephone customer's sheet of a workspace
whose connection cannot be read, and the sixty-second poll renewed it on every failure.

The default line is the one the owner selected, else the first commissioned line, else the first
draft. `usePhoneCapability()` in [phone-runtime.ts](phone-runtime.ts) publishes it. The dial dialog,
the call controller's mount, the Connections Phone card, onboarding's connected channels and phone
setup's own connected flags all read that one value, so one account reads the same everywhere. Live
provider evidence is the only witness: a browser draft, a seeded flag or a saved local status has no
vote.

The Connections Phone card states `Connected`, `Finish setup` or `Connect phone` from the posture,
and prints the provider's own caller ID.

## Call states

For every posture other than `ready` — including `checking` and `unavailable` — `PhoneDialDialog`
shows the same thing: one decorative phone illustration, the line
`Connect your phone with Twilio to make calls.`, and one `Connect phone` action that opens the
existing phone setup. There is no spinner, skeleton or partial control, so a half-commissioned line
presents exactly what an account with no line presents. A failed provider read adds the service's
own sentence as one quiet line under that action, and nothing else changes.

The number, customer, keypad, caller ID, answer-device choice and call action mount only for a
`ready` connection. A browser the line has yet to register leaves `This browser` unselectable and
answers on the mobile — and takes the answer back the moment the line registers it, because the
choice follows the provider in both directions until the person makes one of their own.

Setup keeps the route's intent: the dial route's hash is untouched while setup is open, so a
cancelled or completed setup returns to the same dial with the same customer and number.

An outgoing call chooses `This browser` or `My mobile`. An incoming call rings both registered browser clients and the selected mobile. `Answer here` accepts the browser leg; answering the mobile accepts the phone leg. The first provider-confirmed answer wins and the other leg clears. Hang up remains available in the web app for either route.

`Connect phone` asks ONE question per step, and the question is the heading:

| Step | Prompt | The one act |
| --- | --- | --- |
| 0 | `What's your current phone number?` | the business number, then Continue |
| 1 | `What's your mobile number?` | the mobile number, then Continue |
| 2 | `Forward your calls to this number` | the issued number, one status line, then the forwarding test |
| 3 | `Verify your caller ID` | `Call me to verify`, then the code and `Check verification` |
| 4 | `Save call transcripts?` | one checkbox, then `Done` |

Step 1 creates the line, and an operator grant that carries `issue_number` buys the workspace's own
number at that moment. Step 2 states that issued number, large, as the destination to forward to;
the two numbers the person typed stay as typed. The issued number is also the caller ID, so
`caller_id_verified` arrives true and step 3 stands aside — it appears only while the provider still
owes that verification. Step 4 asks for the transcript the line saves; what a recorded call plays
first is the operator's own `notice` decision, so this step promises only what it delivers. The
commissioning record `docs/briefs/cedar-provider-commissioning-2026-09-11.md`
([pull request 95](../../../../docs/omitted-sources.md)) holds the measured provider flow
behind those steps.

Each step carries one primary action and no explanatory paragraph. A person who leaves half way
returns to the first step their line has yet to meet rather than to the forwarding test. A line
disconnected elsewhere states that in one line and offers one act. Existing business lines show
their actual Prepared or Connected state. `Add another` creates another independent line. The first commissioned
line stays the outgoing default until `Use for outgoing calls`; incoming calls continue to resolve
by their exact Twilio destination. The browser/mobile choice appears only on the call action.
`Disconnect phone` ends active calls on that line, clears its Twilio voice hooks and removes the
line from Cedar while keeping its saved calls and transcripts. The Twilio account keeps ownership
of the number. Another commissioned line becomes the outgoing default when needed.

`PhoneCallController` mounts once under the application provider. Expanded state shows the counterpart, number, status, controls, conversation return and collapsed transcript. Minimized state keeps caller and answered duration visible across every workspace route. Pressing its caller area returns to the matching conversation; a separate control expands the call again. Completed calls freeze their duration and replace live transcript content with the saved transcript when processing finishes.

The controller and transcript disclosure animate over exactly 400 ms with the shared smooth easing. `prefers-reduced-motion: reduce` makes those state changes immediate. The product uses one close convention: close dismisses a completed call or dialog; the downward control minimizes an active call.

## Trust and transport

The browser receives only server-issued intent parameters. Duplicate presses share one pending intent. A second call waits until the current call ends. Incoming browser calls correlate through `ParentCallSid`; child-leg IDs also resolve through the authenticated owner API. A workspace reset disposes its device, tokens and private call projections before another workspace can mount.

The customer surface shows call state, caller ID, destination, transcript availability and setup actions. Account identifiers, SDK state, provider names, media custody URLs and transport diagnostics stay in internal setup and operational evidence.

Reload restores provider call state and re-registers this browser only after the user enabled browser calling. A page reload ends that page's WebRTC audio while a continuing mobile leg reappears from the next authenticated read. Native operating-system wake-up belongs to a future mobile SDK.

## Evidence

- [Call model tests](../../../tools/test-phone-call-model.mjs) cover duration, terminal ordering, number identity and response validation.
- [Session tests](../../../tools/test-phone-session.mjs) cover duplicate intents, active-call exclusion, reset races, canonical inbound recovery and keypad routing.
- [Route tests](../../../tools/test-phone-route.mjs) cover canonical dial/call URLs and reject path-shaped call references.
- [Capability tests](../../../tools/test-phone-capability.mjs) cover every posture — sample, prepared line, caller ID pending, forwarding waiting or received, browser off, ready, error, checking — plus default-line resolution with two lines, the resume step and the card's status word.
- [Browser drive](../../../../drives/drive-cedar-phone.py) covers setup, dial, first-answer behavior, route persistence, minimize/return, hang up and live/saved transcript access at 1600 px and 390 px. Its seven blocks also walk a sample account through its very first `Connect phone` — the walk that creates its own line, states the issued number and skips the answered caller-ID step — park a provider read across each of that walk's two writes and release it afterwards, hold the first read of a half-commissioned line open at a barrier so `checking` is a fact rather than a race, flip the fixture under a live page through ready, stale and revoked, press the customer-sheet and connected-inbox entrances by route and in place above a standing overlay (with `Connect phone` driven on that in-place dial, ONE browser Back closing it and the surface beneath still standing, and the call row's date and label measured against each other at 320 px), and press the act a telephone conversation carries where a composer would — from its own route, and again inside the Messages panel, where the dial mounts above the conversation and the thread is still open after it closes.
- [The Hermes-port drive](../../../../docs/omitted-sources.md) drives the same rail against a harness that answers both the legacy runtime and the Cedar channel API: the standing in every posture, the call records and their diarised Spanish transcript, the outbound intent, a refused call, and the Connections card's own word and door.

Real-call acceptance still requires the selected Rocoto account, callback configuration and authorized test-number evidence.
