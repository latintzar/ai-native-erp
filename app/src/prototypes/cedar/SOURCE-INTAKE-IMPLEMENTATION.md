# Cedar source intake: clock, identity, parsing and review

Owner: Cedar development workspace. This specification covers synthetic scenario time and the
authenticated source-to-order boundary. Provider transports keep their own implementation and
evidence documents.

## One scenario clock

[`scenario-clock.ts`](scenario-clock.ts) snapshots the current Peru calendar day once at module
boot. Every synthetic source for that boot resolves against that one snapshot. Reloading after a
Peru day boundary advances the complete synthetic world together; a page left open across midnight
keeps the same day until reload.

The retained fixture anchor is 22 August 2025. `cedarCast()` clones the shared cast and shifts its
order day, batch days, trace dates and trade-form dates embedded in seeded source prose by the exact
calendar offset from that anchor. The shared `CASTS` objects, identifiers, product quantities and
relative spacing stay unchanged. `baseDate()` uses the same boot day, so generated history, current
orders and future orders follow it together.

Fresh Money fixtures shift invoice source days, due dates, receipts and the sample clock through
the same adapter. A generated Money state records `fixtureDay`. On a later boot, `seedMoney()`
recreates it for the new day only while it still has the exact untouched fixture shape. A fiscal
result, remote request, provider/manual receipt or extra event makes the record retained and keeps
all of its timestamps. Provider message timestamps, phone call events, user actions, tariff log
entries, print-journal entries and issued Cedar documents always retain their recorded instants.

## Private source identity

The provider account selects its server store. Browser scenario selection has no authority over
that choice.

WhatsApp uses two exact private configuration maps:

```text
CEDAR_PROOF_WORKSPACE_BINDINGS
  "<waba-id>:<phone-id>" -> "<workspace>"

CEDAR_PROOF_SENDER_BINDINGS
  "<waba-id>:<phone-id>:<normalized-sender>"
    -> {"workspace":"<workspace>","customerId":"<seeded-customer-id>"}
```

The commissioned sender values live only in private service configuration. Resolution requires the
same WABA, phone, workspace and normalized sender. The browser receives the selected seeded
`customerId`; the provider account identifiers and private mapping remain server-side. An
unmatched sender becomes a source-backed customer candidate instead of being attached to an
existing customer.

Email follows the same rule with an exact private key of workspace, provider account and normalized
source address. Phone final transcript deltas carry their call/customer association from the
authenticated phone store. The shared browser-facing envelope is:

```ts
{
  id: string;                 // immutable provider message/final-delta id
  timestamp: string;          // exact provider instant
  customerId?: string;        // server-resolved Cedar customer only
  text: string;
  historical: false;
}
```

Provider-specific account/address aliases and dedupe revisions remain in the server ledger. The
durable dedupe key includes workspace, provider account scope and immutable source event identity.

## WhatsApp authorization lifecycle

The encrypted account record retains the exact WABA/phone identity, Cedar workspace, original
`connectedAt`, messages and accepted operation history. Active authorization is a separate fact:
the connection record has an authorization epoch and the encrypted token.

`POST /api/proof/whatsapp/disconnect` marks the exact phone record inactive, deletes its token and
invalidates every browser session for that account. The final active phone under a WABA also removes
this application from the WABA subscription after provider acceptance; sibling phone connections
keep the shared WABA subscription. Signed webhook changes route by exact WABA and metadata phone ID,
so another phone can neither receive nor authorize this phone's events. Webhook routing, capture,
conversation reads and intake then require a new verified authorization for the disconnected phone.

Reconnect runs Meta verification and the subscription readback again. It reopens the retained
account/workspace relationship and starts a new authorization epoch after provider acceptance.
The intake cursor is sealed with WABA, phone and epoch, so a cursor from another account or a prior
authorization cannot advance the feed. The reconnect boundary excludes history and messages from
the inactive interval. Durable message arrival sequence, rather than provider timestamp, advances
the cursor, so an authorized late webhook with an earlier provider timestamp is still delivered.

## Structured order reading

`POST /api/cedar/orders/parse` is a configured prototype model adapter aligned with the maintained
order brain's conservative extraction boundary. It is not the maintained five-scale persistence
pipeline. The route requires a Cedar channel bearer workspace and charges the existing per-workspace
provider-read budget.

The request includes the source event, literal text, server-selected customer, the source instant's
Peru calendar day and a bounded Cedar catalogue. This keeps relative phrases such as “tomorrow”
anchored to the recorded source even when a retained live page is consumed after midnight. The
server limits text, products and lines, validates real calendar
dates and supplies only these fields to the configured Gemini or Anthropic adapter. It accepts:

- an order classification and whether a reply is due;
- exact source quotes for every proposed line;
- positive numeric quantities where the customer stated one;
- unknown or quantity-free lines retained for operator clarification;
- product IDs grounded to the supplied catalogue;
- a delivery day only with an exact quoted date phrase from the message.

The response records model name, latency and token count as internal evidence. Every accepted order
becomes a `source-arrive` event in the current Cedar day ledger with source ID, channel,
conversation, exact provider time, extracted evidence, confidence and `needsReply`. The operator
reviews the resulting Delivery Note. Its conversation composer begins with a customer-safe draft
for complaints, questions, later additions and first inbound orders. The draft is editable and
deletable. Sending remains behind the channel's commissioned outgoing transport and an explicit
operator action.

While Sales is open, a newly durable provider order raises the existing non-focusing Sales notice
with the customer name and an **Open** action. Loading retained receipts or changing workspace stays
quiet. The explicit action releases the current status, date, owner and search narrows, opens the
exact Delivery Note, and uses the river's existing 400 ms/reduced-motion landing treatment.

When the model key is awaiting commissioning or the provider call fails, the client uses the
existing bounded local reader. That fallback admits an order line only when it matches a known
product and an explicit quantity, marks intelligence mode `heuristic`, and keeps the result in
review. It never represents itself as model extraction.

## Durable application and acknowledgement

WhatsApp intake reads `GET /api/proof/intake?after=<cursor>&limit=50`. Rows marked historical,
outbound or outside the active authorization boundary stay in conversation history. The client
applies each eligible row to the existing day ledger as one idempotent `source-arrive` event keyed
by channel and provider message ID. It advances the local cursor only after every event in the page
is present in that durable ledger. Repeating a page therefore reuses the same sale and never opens
a second order.

Phone uses the equivalent rule for each bounded `final_delta`: dedupe by workspace, call SID and
stable event ID, retain utterance evidence, and acknowledge its cursor only after durable apply.
Full transcripts remain call history. Email uses immutable provider message/revision identity and
keeps attachment provenance with its source.

## Proof boundary

Synthetic tests prove Peru timezone boundaries, relative offsets, cast immutability, next-day
recreation of an untouched persisted Money fixture, and preservation after a provider/operator
addition. Server tests prove authenticated model access, strict collection/date validation, quote
and product grounding, missing-quantity retention and explicit missing-key behavior.

The isolated Sales browser drive starts with the live order hidden behind the Archived narrow,
proves the named notice appears, presses **Open**, and checks that the exact selected Delivery Note
is inside the viewport. A reload with the transport cursor removed stays quiet and keeps the model
read count at one through durable-ledger dedupe.

The WhatsApp suite proves exact sender/workspace mapping, exact same-WABA phone routing, durable
arrival cursors, late webhook delivery, cross-account and cross-epoch cursor rejection, per-phone
disconnect token/session revocation, sibling subscription continuity, stopped capture while
inactive, and reconnect preservation of the encrypted workspace/history.
An operational disconnect against the commissioned account is a release action and is excluded
from automated testing. A fresh inbound message from the selected test sender supplies the final
live source-to-Sales proof after the model credential is commissioned.
