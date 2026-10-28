# Cedar operations hub

Selected direction: [Peter’s 10 September brief](../../../../docs/omitted-sources.md).
The [product architecture](PRODUCT-SPEC.md) owns the whole lifecycle. This contract refines its
entry, daily work and mixed live/example account experience. Environment: **development**.

## Information hierarchy

Sales is the daily work queue. A conversation explains an order; the Delivery Note holds its
commercial state; Money reconciles the collection and invoice. Each has one primary action that
advances the selected object. Histories and configuration sit behind named doors.

| Surface | First thing shown | Primary action | Next level |
|---|---|---|---|
| Entrance | Peter and the selected business | Set up your business / Open workspace | About this workspace |
| Setup | One question or provider step | Continue with the selected account | Add another; explicitly selected test-data flow |
| Sales day | Sticky date and outstanding work | Print the day's selected document | Preview with date and Remaining / All controls |
| Print centre | Upcoming delivery batches and next delivery timing | Prepare delivery batch | Another day, print history, Templates |
| Print preview | Exact selected records rendered as the document | Print | Change document, dates or Remaining / All scope |
| Connections | Banking, Payments, Communications | Open a named account | History, Add another, Disconnect |
| Customer chat | Messages and current reply | Reply or Call | Order detail; call → expandable transcript |
| Money | Account balance, invoice/payment destinations | Open the relevant record | Transactions, invoice history, working capital and customer credit |
| Copilot | Answer and relevant action | Review/open the proposed record | Collapsed sources and response details |

## Setup and the prepared workspace

Full-page setup starts near the top of the viewport. It has one contextual Back action where
there is a previous step. Settings uses the same content inside a closable dialog. The channel
choice uses square cards; a provider's actual status determines its Connected tick.

Opening an already connected account shows its verified identity and Continue. **Add another**
starts provider authorization while preserving the current account until a successful return.
**Use test data** opens a rehearsable provider flow, marked Test data inside that selected flow.
Its completion writes fixture provenance to onboarding, never live authorization or account grants.

The entrance separates new-business setup from a prepared operating workspace. Finishing setup
uses **Open workspace**, with the same Sales destination as the entrance's prepared-workspace
choice. The prepared records represent an established business. Replaying setup preserves its
orders, reviewed prices, money ledger and real account connections. The optional catalogue and
invoice-history doors reuse existing upload/review components.

Business data stays in company/config, bank data in Money, accounts in provider stores, and
sequence/progress in the onboarding store. The two visible milestones are messages and banking.
[Onboarding](ONBOARDING-SPEC.md) owns state transitions and recovery.

## Delivery preparation

A print request carries its intent explicitly: document type, date/day range, order IDs and
Remaining / All choice. A Sales day button starts at that day's preview. The print centre starts
from upcoming work. Both use the same preview and confirmation pipeline.

A packing list is an actual output using the existing packing contract, independent of stock
availability and of any dispatch release that follows it. Printing a preview does not itself
complete the physical task: the existing confirmation, captured revision and print journal own
that evidence.
A changed order can become remaining again. Templates configure output and remain tertiary.
[Outputs](../../../../docs/THE-OUTPUTS-SPEC.md) owns the detailed output contract.

## Live sources beside example records

The scenario and the provider account have separate identities. A selected private association
can bind Peter's supplied test sender to a seeded customer, so inbound WhatsApp and email become
that customer's real source evidence and reviewable order drafts. The sender/account binding
lives in private server configuration. The browser receives the authorized customer reference.
Historical messages retain their source time and remain history; new arrivals pass through the
same source identity and draft-review contract.

Disconnect is a provider/runtime operation. It removes the active authorization and ends further
access/ingestion through that association. Reconnect verifies ownership again and recovers the
same saved workspace/history relationship. UI readiness follows current server evidence.
Seeded rows never prove that an account is connected. Real calls and sends remain explicit actions.

Synthetic dates derive from one Peru scenario clock and retain their relative order and spacing.
Bank/fiscal/provider evidence and operator-created timestamps retain their recorded dates. The
clock boundary, source association and parser contracts are documented beside their implementations.
All Cedar merchant amounts use PEN and display soles; Rocoto subscription billing is separate.

## Voice and assistant behavior

The phone connection starts with **Connect phone**, then forwarding, a real forwarding test and
caller-ID verification. Selecting browser or mobile belongs to Call. Incoming calls ring the
configured endpoints; the first answered leg wins. Chat owns the call, and the call owns its
expandable live/saved transcript. The active-call indicator survives navigation and opens that
customer's chat. [Phone](PHONE-IMPLEMENTATION.md) and [call UX](CALL-UX.md) own the carrier state;
[transcript intake](PHONE-INTAKE.md) owns finalized speech becoming a reviewable order.

Deepgram provides actual dictation. Source/call transcription and ordinary input dictation share
provider custody and availability rules. Orders inferred from transcription remain proposals until
commercial review, with their source/final-utterance references retained.
The opt-in `drives/drive-cedar-dictation-live.py` proof uses repository audio as the browser's
microphone, sends one real development transcription and checks that the editable composer
retains its existing text. Calls use their separate carrier and two-track streaming proof.

The Copilot first uses the configured prototype runtime. A bounded local reading can answer
order counts, dates, values, named customers/products and reply queues from the current records.
It offers existing review/open actions. Sources explain which path answered; provider/model
metadata sits behind Response details. Natural-language form input preserves literal text and
shows its recognized structure for review. The local parser reads spelled quantities next to
explicit units (for example five kg or dos cajas); product names such as media canal retain their
identity. Recognition stays bounded and editable while the model path is commissioned. Neither a spoken command nor a typed request alone
executes a payment, deletion or customer send.

The entrance's **About this workspace** disclosure is the operator-facing explanation of example
records, test flows and live provider actions. Live account and payment states remain factual at
those actions. The financial features name the connection that opens them: until the bank answers,
working capital stands as one object, one sentence and **Connect bank**, and customer credit reads
the invoices the workspace already holds ([FEED-IA §247.8](../../../../docs/FEED-IA.md)).

## Visual system

- Existing kit type, colors, borders and controls; Cedar-specific composition lives in Cedar.
- White working surfaces, generous grouped spacing, one quiet boundary per card. Detail lists
  appear behind a category or record; avoid repeating every record on its parent dashboard.
- Provider marks use original artwork and proportions. Compact rendering preserves sharpness;
  small raster wordmarks are displayed at sizes suitable for high-density screens.
- The sage wallet and delivery crate share a tactile illustration style. They belong to feature
  entry and completion states, with decorative alt text. Operational rows use document/channel
  glyphs so images support recognition without competing with order content.
- Interaction transitions use the kit's `timing400` token. Cedar's entry also applies the system
  reduced-motion preference to nested kit controls. Forms keep focus, the composer stays visible,
  and each nested layer has one contextual Back action consistent with browser history.

## Acceptance and evidence

| Proof | Required behavior |
|---|---|
| Onboarding browser drive | Upper layout, square choices, full-page navigation, explicit test provenance, connected identity, return to banking, completion and resume at desktop/mobile widths |
| Print workflow | Upcoming/day entry, exact Remaining / All scope, packing output, date changes, journal confirmation, edited-order revision, one Back per layer |
| Seed consistency | Today-relative date offsets; stable IDs, quantities and PEN totals; operator edits and real timestamps preserved |
| Provider tests | Authorized account scope, actual disconnect, reconnect association, inbound deduplication, source→reviewable order draft, attachments/transcript custody |
| Phone proof | Forwarding/caller-ID progression; line/default selection; first answer; web hang-up of a mobile leg; minimize/restore/saved transcript |
| Assistant proof | Values from current records, literal source text retained, bounded proposals, no implicit external action; Deepgram real-audio result |
| Development release | Green gates/tests, protected PR, declared development artifacts, public receipt and served source match, existing private state retained |

Measured live behavior, deterministic integration fixtures and activation dependencies are recorded
separately in the release evidence. A provider credential or public HTTPS URL selects neither
staging nor product adoption.
