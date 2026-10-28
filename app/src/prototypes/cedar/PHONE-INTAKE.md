# Cedar phone transcript to order

The [phone implementation](PHONE-IMPLEMENTATION.md) owns carrier calls, consent, final speech and
saved transcripts. [`phone-intake.tsx`](phone-intake.tsx) consumes that source inside Cedar;
[`phone-intake-model.ts`](phone-intake-model.ts) owns page validation and grouping. This is a
**development** adapter into Cedar's existing review ledger and configured prototype order reader.

## Source and grouping

The mounted consumer runs when an authorized commissioned line has live transcription enabled.
It reads the private runtime's newest-first window, then each call's incremental outbox. The runtime
bounds this window at 200 calls; the consumer keeps every returned call eligible so an active call
can cross the Peru day boundary and older calls retain their place while newer calls arrive. It
polls every 2.5 seconds, serially, with 100 source events per page. Saved `full_transcript` records
remain history. Only finalized speaker-1 customer speech enters the reader; the runtime owns that
speaker/track mapping.

Adjacent customer finals become one quoted chunk. A source-time gap of at least 1.8 seconds,
800 characters, 12 utterances or a 30-second span starts the next chunk. An unfinished chunk waits
until 1.8 seconds after its last delivered final, or until the call ends. Utterances stay whole.
A single chunk over the model's 5,000-character input bound becomes a manual conversation review
with its complete source text retained. Partial speech stays in the live transcript UI.

## Review and persistence

The current selected call customer or an exact unique E.164 match selects an existing customer.
An unmatched number creates a source-backed customer reference. A provider account and call retain
their private workspace identity; the browser scenario never chooses a provider credential.

The source chunk key is SHA-256 of workspace, canonical call SID, ordered event IDs and utterance
IDs. The draft retains `phoneSource`: workspace, call SID, event IDs, stable source IDs and exact
speaker/track/time/text evidence. The ordinary source-arrival fold produces the Sales row and
customer conversation. The configured reader proposes quantities/products/dates for review.
Each chunk is a separately reviewable proposal; commercial merging or amendments require review.

The consumer acknowledges a page only after its accepted source events are durably present in
the day ledger. A failed save keeps its cursor. Replaying after cursor loss filters utterance IDs
already recorded, so a different page boundary cannot duplicate an order. Workspace reset,
disconnection or unmount aborts pending reads before local writes. A completed disconnect attempt
refreshes polling against the current account evidence. Each call has its own failure boundary, so
one malformed or temporarily unavailable call leaves the rest of the runtime window available.
Browser storage accelerates cursor resume; an in-memory cursor keeps the mounted session advancing
when browser storage is unavailable, while ledger evidence remains the reload dedupe authority.

Provider timestamps remain exact. Synthetic date shifting applies to prepared scenarios only.

## Proof

`app/tools/test-phone-intake.mjs` covers grouping, full-page cursor progress, the 200-call and
overnight window, per-call fault isolation, storage fallback, historical/house exclusion, malformed
cursor and foreign-call rejection, source-key isolation, replay, failed durable saves and disconnect
during a slow read. `drives/drive-cedar-phone-intake.py` exercises the mounted browser consumer, authenticated
source/reader routes, one Sales arrival, source metadata and reload without another model request.
These transports are explicit isolated fixtures. Live Twilio/Deepgram streaming and model output
are recorded separately when the owning development credentials and numbers are commissioned.
