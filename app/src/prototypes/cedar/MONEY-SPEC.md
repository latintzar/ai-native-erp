# Cedar money and connection setup

[Founder direction §227–232](../../../../docs/FEED-IA.md#227) · [Payment evidence contract](PAYMENTS-SPEC.md) · [Company research](../../../../docs/omitted-sources.md).

## Scope

An interactive Cedar prototype for seller setup, Delivery Note → automatic order payment link → customer contact → bank allocation, with fiscal preparation and issuance separately. A scoped browser model, the shared synthetic-data lifecycle and Cedar’s persistent collection API demonstrate the lifecycle together. The selected product path is direct Yape/Plin requests, Prometeo bank data and transaction validation, and NubeFact invoicing. The latest founder direction supersedes the earlier Factiliza pricing preference. Provider entitlement, account access and commercial terms remain commissioning steps. Native Yape/Plin receipt correlation remains a live-account proof. The default walkthrough uses explicit sample evidence. Protected operator routes can exercise commissioned Prometeo reads and NubeFact issue/query operations; actual provider calls require separately configured credentials and permitted operations. Current acceptance evidence uses local HTTP and isolated provider fixtures.

## Navigation and documents

Money opens as a bento dashboard: a large bank balance card on the left, incoming-payment history with a distinct forecast, and large category cards opening nested Invoices, Payments and Transactions views. Full bank activity and customer-credit rankings each live one level below the dashboard. Prometeo, NubeFact, Yape, Plin and the selected bank use locally stored official marks, with provenance beside the assets. The sample balance and chart derive from linked receipt and invoice records. A commissioned account read replaces the balance card with Prometeo’s masked account, amount, currency and read time. The incoming chart then uses fourteen Peru-calendar days of that account’s incoming transfers in its own currency and provider mode. Transfers awaiting matching still count as money received by the bank. The sample sales forecast stays separate from that actual account history. Settings → Connections owns payment-account and invoicing configuration, alongside email and WhatsApp. Sales retains Delivery Notes. Each invoice links to its source Delivery Note; each Delivery Note carries its invoice, amount outstanding, payment request and transaction history. English interface labels use Delivery Note, retaining existing technical identifiers and storage compatibility.

Invoice acceptance, payment-request delivery and money received are separate states. Partial payments reduce the balance; ambiguous/mismatched receipts require review. Copying a link records copying; only a recorded send records delivery. Manual payment recording names its operator/source. Seeded receipt actions and fiscal statuses use ordinary product labels, while the model retains synthetic provenance and the API prevents them from establishing real bank or fiscal evidence. New billing drafts collect before fiscal issuance. Authorized NubeFact issue/query results appear independently beside their payment status; a paid request can therefore still show an invoice awaiting acceptance.

Cedar Sales and every newly prepared billing draft use PEN. A new billing snapshot records `sourceCurrency:PEN` and `fxRate:1`, so the automatic order payment carries the Delivery Note total directly. Customer fiscal data, tax and due date belong to the separate electronic-invoice preparation. Stored legacy invoices retain their recorded EUR source amount, frozen EUR→PEN rate and existing PEN total. Invoice detail formats that recorded source currency and shows the conversion only for a cross-currency record. Live issuance requires operator approval of the exact frozen draft, customer fiscal address, unit mapping, tax classification and commissioned seller series. Amounts use integer minor units, retain currency, and allocations match the invoice currency. Incoming foreign bank evidence keeps its provider currency and remains review evidence against a PEN invoice.

## Setup wrapper

The approved reference is the WhatsApp setup at [cedar-demo](https://cedar-demo.soyrocoto.com/), verified against PR #81 source `693055d3`. Its anatomy is opaque themed background, Rocoto mark, centered 560px column, one direct question/action at a time, provider identity, and expandable data/consent details. Settings presents the same content in a focus-contained modal. Setup is always resumable from Connections; a deferred connection remains available to resume. Each page has one close control, and nested steps have their own Back control. The dialog uses the same content and a 400 ms transition with reduced-motion support.

The wrapper is presentation; connection state belongs to the owning Cedar model. Payment setup identifies an existing bank and the receiving account used for Yape/Plin, describes account/transaction access, then demonstrates consent and an example connection. Invoice setup identifies the seller RUC, document series and reviewed tax/currency settings. The NubeFact step explains the seller’s SOL appointment of NubeFact (RUC 20600695771), followed by provider activation and document acceptance checks. The sample readiness action records a reviewed preview; it does not execute the SOL appointment or establish a live tax connection. The prototype requests no banking passwords, SOL passwords or API secrets.

WhatsApp and email use the same presentation grammar and remain available from settings. Cedar integrates PR81’s real provider/session flow through its same-origin bridge; the existing connection service retains encrypted account/history custody. Onboarding and Settings reuse the same connection bodies. The full origin has its own host-only session and actual Meta login entry proof.

## Working capital and customer credit

The dashboard's Working capital card opens the supplied Monzo Flex “Pay over time” interaction:
the amount, one / three / six monthly payments, exact amounts, due dates, total interest and total
repayment before the grant. The granted plan replaces the offer in the same card; the repayment
details expand beneath its next payment. One month is interest free; three months carry 0.5% total
interest (S/ 25 on S/ 5,000), and six months carry 0.9% total (S/ 45). Integer-minor-unit
instalments sum exactly to principal plus interest, and month-end dates remain valid. The amount
comes from the seller's own book, and «The advance, offered and granted» below holds that
derivation, the plan record and the states of the card. Version 1 and version 2 saved plans hold
the single S/ 1,000 principal those releases offered and keep their own terms — version 1
interest free, version 2 with explicit total pricing. Recording repayments updates that plan; bank
balances and provider ledgers retain their own custody.

A plan a person already accepted survives this release. Version 2 wrote the word `future` in its
`source` until [FEED-IA §247.8](../../../../docs/FEED-IA.md) took that word out of Cedar, so
`parseAdvance` accepts it as the priced shape it names and rebuilds the record as `plan`: the
plan stands, and the browser holds the current word from the first read.

**The bank connection is what opens this card.** `bankCapabilityOf` answers `ready` on the
provider's own authorized receiving account; every other posture draws the card as
`money-working-capital` with `data-plan-posture="setup"` — one object, the sentence *Working
capital opens once your bank is connected.* and one **Connect bank** act
(`money-working-capital-setup-state`, `money-working-capital-open-setup`). The head says the same
thing in one word: the status line reads the plan's own word on a connected bank, and **Connect
bank** on every other posture. Each act on the connected card runs behind that one answer, so the
day a provider is commissioned this card opens with nothing else to change. Customer credit reads
the invoices this workspace already holds, so it stands in every posture.

The working-capital popup uses the full-bleed hero anatomy: illustration, title, body, one primary
action ([FEED-IA §247.6](../../../../docs/FEED-IA.md)). `HeroArtwork` in
[feature-artwork.tsx](feature-artwork.tsx) draws one scene in two frames, so the subject is whole
at both widths: from 560 px up the desk band draws the 21:9 reframe
`/cedar-artwork/hero-working-capital-wide.png` in a 3:1 band, and below it the phone sheet draws
the 16:9 whole, `/cedar-artwork/hero-working-capital.png`.
The scene is what the body sentence under it names — a distributor buying stock at the fish
terminal at dawn, taking a crate of iced fish across a loaded hand trolley beside his open van. It
carries empty alt text, and everything in it is an object rather than a word, so the Castellano
build ships the same file (§247.7). The band claims its height once the picture has drawn, and the
title **Working capital** sits below it with the amount, the repayment choices, the purpose, the
repayment authorization and **Get advance**. The hero register, its reference frame and its receipts live in
[`library/illustrations`](../../../../docs/omitted-sources.md).

### Money states

One vocabulary covers both lifecycles — a working-capital plan and a customer invoice — on both
sides of the ledger, because a person reads one product. `MONEY_STATUS_WORDS` in
[money-model.ts](money-model.ts) is the table; `statusWordsOf()` is the only place a surface turns
a state into a word; `planStatusOf()`, `installmentStatusOf()`, `invoiceStatusOf()` and
`mostUrgentStatus()` are the only places a state is derived. A surface that needs a new word
changes this table.

A working-capital **plan** has three states:

| State | Word | Derived from | Where it is read |
|---|---|---|---|
| `offered` | Offered | no saved plan | working-capital card chip, every row of the offer preview |
| `repaying` | Repaying | `paidCount < count` | working-capital card chip |
| `repaid` | Repaid | `paidCount === count` | working-capital card chip, the completed repayment panel |

A plan nobody has confirmed is an OFFER, so every row of its preview timeline carries the plan's
own word, `offered`, rather than a state of its own.

A **dated amount** — one repayment instalment, one invoice — has six, and both use the same six:

| State | Word | Derived from | Where it is read |
|---|---|---|---|
| `upcoming` | Upcoming | an amount still ahead of its date | the repayment timeline, the card's next-payment line |
| `due` | Due | an amount on its own date | timeline, customer-credit rows, invoice rows |
| `requested` | Payment link sent | an invoice whose request records `sentAt` | customer-credit rows, invoice rows |
| `overdue` | Overdue | its Peru calendar day has passed with an amount left | timeline, credit rows, invoice rows |
| `part-paid` | Part paid | some of the amount arrived and its date stands | credit rows, invoice rows |
| `paid` | Paid | the whole amount arrived | timeline, credit rows, invoice rows |

«Due» is reserved for an amount on or after its date: a payment still ahead of its date reads
«Upcoming», whether or not it is the next one owed, and a late one reads «Overdue».

**One exception, and it is the invoice.** An invoice reads «Due» from the moment it exists;
«Upcoming» belongs to a repayment instalment. A merchant issues an invoice to be paid now — the
date on it is the deadline it becomes late on, rather than the day collection opens — so the
invoice list offers `outstanding`, `overdue`, `part-paid`, `paid` and `requested` and holds no
`upcoming` filter at all. `invoiceStatusOf()` says exactly that by handing `amountStatusOf()` the
invoice's own `dueAt` as today's date, and an instalment hands it the real clock.

Overdue outranks every other word on one amount, and a customer account takes the most urgent word
of its invoices. A row states its word and its detail as `Word · detail`: `Overdue · 3d`,
`Upcoming · S/ 168.17 on 11 Nov`, `Part paid · 11 Oct`. The requested state names the deadline it
was sent about — `Payment link sent · due 11 Oct` — so the date beside it is never read as the day
the link went out.

The payment-request LINK keeps its own five-state map, `requestWords` in
[money-document.tsx](money-document.tsx): Ready to create, Connect to share, Ready to share, Link
copied, and — borrowed from the table above so a request and its invoice agree — Payment link sent.

One word is held apart from this table on purpose. **Scheduled** belongs to Sales, which uses it
for a delivery a person planned (`PROJECTED_SALE_STATES` in
[money-projections.ts](money-projections.ts)); on the repayment timeline it printed a commitment
over an offer nobody had accepted, so Money names its own states and leaves that one where it
came from. A state is named here only when the model holds it, and a date only when the person
chose the plan that produced it.

[test-money-states.mjs](../../../tools/test-money-states.mjs) pins the table and every derivation,
[test-money-capability.mjs](../../../tools/test-money-capability.mjs) pins it beside the connection
postures, and `drives/drive-cedar-money.py` reads the words off the rendered surfaces at 1600, 390
and 320.

## Unpaid orders and Chase now

Money → **Unpaid orders** is the list of unpaid orders ([FEED-IA §249](../../../../docs/FEED-IA.md),
source [the demo brief](../../../../docs/omitted-sources.md)): one card
per order, a primary **Chase now**, an **Auto-chase** switch with its own timer, and the card
stating «Chased 09:41 · next in 23 h». The dashboard card carries the unpaid order count and
outstanding amount, followed by the three nearest deadlines with customer, balance and days
overdue (or the due date while it remains ahead). The customer ranking stands under the unpaid
cards. A chase names one order, its amount and its deadline.

**What the list reads.** `unpaidOrders(state, moneyNow(state))` in [money-model.ts](money-model.ts) folds the
Money ledger: every collectible PEN invoice with a customer and a balance left, with its balance
from `invoiceBalance`, its state from `invoiceStatusOf` and its lateness from `invoiceOverdueDays`,
each read at the invoice's own clock (`invoiceClock` over `moneyNow`, the Money sample instant).
One derivation feeds the count, the total and every card, so the header's figure and the cards
agree by construction. The two sorts — nearest deadline, biggest owed — keep their key
(`rocoto-cedar-finance-credit-sort-v1:<scope>`) and now order the orders.

**Paid.** The **Paid** view sits beside **Unpaid orders** and lists matched receipts for the
last 30 Peru calendar days, including today, newest first. Each receipt carries its customer,
commercial document, received amount, Yape / Plin / Transfer / Cash method and receipt day. Partial
payments belong here as receipts while their remaining balance stays in Unpaid orders. The window
uses the recorded arrival for new sample/manual receipts and the actual bank booking for Prometeo.
Untouched examples keep the invoice's sample calendar. Amounts retain integer minor units.
`last30DaysReceipts` derives this view from the existing Money ledger. A receipt opens its document.

When a reminder preceded a receipt, `lastChaseBeforeReceipt` selects the latest send at or before
that receipt's effective arrival timestamp (`receiptEffectiveAt`), while the original ledger
`at` remains intact beside `receivedAt`. Its **Reminder** disclosure shows the rung, channel and day, then
the original message. The chase book stays the source for this evidence. Reloads retain the same
ledger and book, and the shared workspace reset restores the existing fixture lifecycle.

**Payments.** `#/money/payments` opens both sides under **Payments**: the same unpaid-order
cards, initially nearest deadline first, and **Paid** with the last thirty days of receipts.
**Receipt history** preserves the complete receipt register, search and review filters at
`#/money/receipts`. Existing document links keep their invoice identity.

**Dashboard and receipt proof.** `drives/drive-cedar-money.py`'s `receipts` block checks the card's
count, total, three urgent rows and receipt details at 1600, 390 and 320, including the preceding
reminder, navigation, touch targets and overflow. Model tests cover eligibility, ordering, calendar
boundaries and receipt/chase identity. The previous source is `62cbefb4`; red and green runs use
the same assertions and viewport widths.

**The words on a card.** The amount, the document number and `Due 17 Sep` / `5 days overdue` come
from the ledger. The badge states the order's collection state in §249's own three words —
**Unpaid** for `due` and `overdue`, **Part paid**, **Payment link sent**, **Paid** — through
`unpaidWordOf`, which reads `statusWordsOf` for every state except the two a merchant chases,
where the deadline is already printed beside it. Money's one table still names every state and
`data-status` on the card carries it unchanged.

**The record.** `chase.ts` holds one `ChaseRecord` per invoice — the sends (each with its wall-clock
instant, its rung, its channel and the exact words), the switch with its interval and its next
instant, and the flag — stored as `{ version: 1, scope, records }` under
`rocoto-cedar-chase-v1:<scope>` and inventoried in [workspace-reset.ts](workspace-reset.ts) as
workspace data. `parseChase` validates every field of every record, so a damaged record reads as
absent and its card offers the ladder from rung 1.

**Two clocks, each answering its own question.** The invoices keep the Money sample clock, which is
what holds «5 days overdue» steady across a reload. The TIMER measures real elapsed minutes on the
device, the way WhatsApp's own «last seen» does, so every `at` and `nextAt` is a wall-clock instant
from `Date.now()`. `countdownWords` reads hours from an hour up and minutes below it; `chasedWords`
prints the hour on the day it happened and the day before it after that.

**The three rungs, and their texts.** `chaseStepOf` answers the rung the next reminder stands on,
capped at three. `chaseMessageOf` writes it:

| Rung | Register | The words |
|---|---|---|
| 1 of 3 | softer | *Hi {name}, your order {number} for {amount} is due {date}. Pay here: {link}. Thank you.* |
| 2 of 3 | firmer | *Hi {name}, order {number} for {amount} was due {date}. A late fee of {fee} applies from {feeDate}. Pay here: {link}.* |
| 3 of 3 | firmer | the same words as rung 2, and the card gains the flag and the advance line |

The fee is two per cent of the balance still owed (`chaseFeeMinor`) and it starts seven days from
the day the reminder goes out (`chaseFeeDate`); both are computed from the ledger and both are
stated in the dialog before anything is sent.

**The dialog.** **Chase now** opens `ChaseDialog` ([chase-dialog.tsx](chase-dialog.tsx)): the
customer and the document, the rung and its register in the frame's own step line, the message in
a text area prefilled and editable, the payment link, and the channel — the account's own word from
`channelWord`, with the WhatsApp posture from `whatsappWordFor` beside it when the account is a
WhatsApp one. One act, **Send**.

**The send is one seam.** `sendChase` records the invoice's payment request as sent
(`recordRequestAction`), writes the words into that customer's conversation
(`sendToThread(sector, customerId, text, replyHour(…), undefined, { orderId })` — the thread id is
the customer id and the hour makes the reminder the newest thing anybody has said), and grows the
chase record by one rung. The dialog calls it on **Send**; the timer calls the same function with
no dialog, so a reminder a person sent and a reminder the timer sent are the same event in the same
conversation. `chaseLinkFor` hands back the invoice's canonical payment request, creating it
through `moneyActions(scope).createRequest` when the invoice has none, so a reminder points at the
same buyer page the invoice card shares and the card then reads **Payment link sent**.

**The timer.** The root `OrderPaymentSync` coordinates registration, first contact and reminders
across every Money and Sales route. It wakes while visible, advances at most one due rung per order
in a pass, and checks workspace generation before writing. First contact owns the24/48/72-hour
schedule; a hold pauses its eligibility and a paid balance ends it. Legacy stored interval fields
remain readable. The current card presents the first-contact schedule and its on/off switch.

**The flag and the advance.** The third rung ends the ladder: `recordSend` writes `flaggedAt`,
schedules nothing further, and the card gains **Needs a call** beside **Short {amount}? Pay over
time**, which opens `#/money/advance/<balanceMinor>` — the same door the campaigns' pre-buy card
and the cash-crunch line take. The switch keeps whatever the person set it to; the next act is a
person's.

**What the providers change.** Nothing on this surface. When WhatsApp is commissioned the connected
number sends the same text the conversation already holds, and the chase record's `channel` names
the door it travelled. When the collection service is commissioned the request `chaseLinkFor`
returns carries the Yape/Plin collector the same way the invoice card's does — the URL comes from
the service's own `buyer_url` — so the message body is unchanged and the money arrives on the
provider's ledger. The connected postures are the ones that decide which controls a person meets,
exactly as «Connection state» below states.

**The proof.** [test-chase.mjs](../../../tools/test-chase.mjs) pins the rungs, the three texts, the
fee arithmetic, the `nextAt` arithmetic, `setAuto`, `dueChases`, the countdown and the defensive
parse. `drives/drive-cedar-money.py`'s `chase` block (`ROCOTO_BLOCKS=chase`) walks the surface at
1600, 390 and 320 on Playwright's own clock: the cards counted against the stored ledger, the
dialog's rung and words, **Send** landing in the customer's conversation and the request reading
Payment link sent, **Auto-chase** at 12 h firing the second rung when the clock jumps twelve hours,
and the third flagging the card with the advance line pointing at this order's amount.

## The advance, offered and granted

### The offer

`advanceLimitOf` in [money-finance.ts](money-finance.ts) is the whole derivation, pure and without
imports, so [test-money-finance.mjs](../../../tools/test-money-finance.mjs) runs it against the
seeded book itself. It takes the workspace clock's own Peru day, the seller's sales and every plan
the workspace holds, and answers five numbers: the window it read, the value of the orders inside
it, the limit that book earns, the principal already standing and what can be taken today.

- **The book.** Four weeks ending on the workspace clock's day, that day included — 28 calendar
  days, `from` = the day less 27. An order counts when it names a customer and holds lines; a
  message-only record and an archived draft are neither an order nor collateral, so neither counts.
  Each counted order contributes `Math.round(figure * 100)` exact minor units.
- **The limit.** Half the book (`ADVANCE_SHARE_BASIS_POINTS`, 5 000 bp), rounded down to S/ 500,
  held between the S/ 1,000 floor and the S/ 20,000 ceiling, then raised a tenth
  (`ADVANCE_REPAID_BONUS_BASIS_POINTS`) for each plan repaid on time — `paidCount === count`. The
  bonus applies after the clamp, so the ceiling itself moves with the record: a seller who repays a
  first plan on time holds S/ 22,000, and the card says so.
- **What is available.** The limit less the PRINCIPAL still standing, rounded down to the S/ 100 a
  person chooses in. A limit measures exposure, so the interest a plan prices on top of its
  principal leaves the limit alone and each repayment returns its share
  (`advancePrincipalOutstanding` = `principalMinor − round(principalMinor × paidCount ÷ count)`): a
  S/ 5,000 advance on a S/ 20,000 limit leaves S/ 15,000 available and reads S/ 16,600 after the
  first of three payments.

On the seeded fish book the four weeks hold about S/ 1.45 M of orders, so half of it stands far
above the ceiling and the ceiling is what the card states: **S/ 20,000 available**. The tool test
holds both readings — a synthetic book where the share, the S/ 500 grain, the floor and the window
edges each decide the answer, and the seeded book where the ceiling decides it and the test says
why. Three months of receipts were measured as the alternative basis (S/ 54,549 collected on the
same fixture); half of that clears the ceiling too, so the basis stays the sales the card names.

### The plan record

A grant is one immutable record under `rocoto-cedar-finance-v1:<scope>`, one plan at a time.
Version 3 carries `principalMinor` (a multiple of S/ 100, between S/ 500 and the limit),
`count` (1, 3 or 6), `purpose` (`stock`, `prebuy`, `payroll`, `other`), `consentAt` and the
`limitMinor` that stood at the grant. Pricing is the same table: one payment interest free, three
0.5 % of principal, six 0.9 %, `Math.round`ed to the minor unit, with integer instalments summing
exactly to principal plus interest on the calendar's own month-ends. `parseAdvance` rebuilds every
amount from the record's own principal, count and date and refuses any record whose stored figures
disagree, whose scope is another workspace's or whose progress is outside `0 … count`.

Version 1 and version 2 records still parse and keep their terms. Both hold the single S/ 1,000
principal those releases offered — a version 2 record claiming another principal is refused — and
neither carries a purpose, a consent or a limit, because a consent nobody took is a consent that
was never given. Version 1 stays interest free; version 2 keeps its explicit pricing and the
retired `future` source word reads as `plan`.

### The card

`money-working-capital` on the Money dashboard, behind the bank gate above, has two connected
states and one act each.

**Offered** (`advance-offer`): the heading is the amount available — `advance-available`, tabular,
its word on the number's own line — under it the basis in one sentence, *From your last four weeks
of sales. Repaid from incoming payments.*, and one act, **Get advance** (`advance-open`).

**Granted** (`advance-existing`): the heading is what was granted (`advance-granted`), then the
next payment in the timeline's own state word — *Upcoming · S/ 1,675.00 on 14 Oct* — then what the
limit still holds (`advance-available`, *S/ 15,000.00 still available*). Once every instalment is
paid the plan reads Repaid, the next-payment line becomes *3 of 3 paid* and the raised limit states
itself: *Repaid on time · your limit rose to S/ 22,000.00* (`advance-limit-rose`, shown while the
limit stands above the `limitMinor` the plan recorded at its grant). **Repayment details**
(`advance-details`) expands the timeline, what is still to repay (`advance-outstanding`), the
purpose and the day repayment was authorized (`advance-consent-record`), **Record repayment**
(`advance-record-repayment`) and **Close plan** (`advance-reset`).

The head's status word comes from the one state table — Offered, Repaying, Repaid — and `Connect
bank` on every posture the provider has yet to answer.

### Pay over time

The dialog (`advance-dialog`, title **Pay over time**) keeps the full-bleed hero anatomy and asks
four things in one scrollport, then grants:

1. **Amount** — a Base Slider (`advance-amount`, thumb `advance-amount-thumb`) from S/ 500 to the
   amount available in S/ 100 steps, with the figure in an Input beside it
   (`advance-amount-input`). Each moves the other; both land on the S/ 100 grain the plan is built
   on. It opens at S/ 1,000, or at the amount a route carried.
2. **Choose how to pay** — the three plans, their amounts, dates, total interest and the offered
   timeline recomputed from the chosen amount.
3. **What it is for** — four acts, `advance-purpose-<key>`, **Stock** first.
4. **The authorization** — one checkbox, `advance-consent`: *I authorize repayment from incoming
   Yape and Plin payments*. This is the auto-repayment consent the BaaS and data-protection rules
   ask for, and **Get advance** (`advance-confirm`) waits for it. The authorization and the grant
   are one act, so the plan records the workspace clock's instant for both.

Confirm grants on the spot: the record is written, the dialog closes and the card reads the granted
state. `#/money/advance/<minor>` opens the dialog already on that amount — clamped to the grain and
to what is available — and returns the hash to `#/money` with `history.replaceState`, so browser
Back leaves the dashboard rather than a dialog that already closed; the frame carries
`data-prefilled-minor`. That route is the one road the campaigns' pre-buy card, the cash-crunch
line and the 72 h chase rung all take, and it lands on the offer.

**The cash-crunch line stands out of this release.** `projectMoney` forecasts expected INFLOWS by
due date and holds no outflow model, so a sentence naming the day a seller runs short would be a
number Cedar cannot derive. The entry point is built and proved — the amount-carrying route — and
the line that uses it waits for a payables model.

### Wiring, when the lender of record and Prometeo are commissioned

The demo grants against the workspace's own book; the same four steps run against providers with
one seam each.

- **The offer** stays Cedar's. `advanceLimitOf` reads the seller's book, and the lender's own
  policy replaces the constants — share, floor, ceiling, on-time bonus — as a limit the lender
  returns for this merchant, alongside the dossier that is shared with it.
- **The grant** posts the accepted plan to the lender of record: amount, term, price, purpose,
  the consent with its timestamp, and the disbursement account (the same authorized receiving
  account `bankCapabilityOf` already answers on). The lender's decision and its disbursement
  reference come back on that call; the card reads the lender's record from then on.
- **The repayments** are deducted from matched receipts by the collection service: each Yape, Plin
  or transfer receipt Prometeo confirms is allocated to the running plan before it is allocated to
  an invoice, up to the instalment due. `recordAdvanceRepayment` is the manual form of that one
  step, and the ledger the card reads is the lender's.
- **The consent** is the record that authorizes the deduction. It is written with the grant, it
  travels to the lender with it, and it stands in the dossier's consent log.

### Proof

[test-money-finance.mjs](../../../tools/test-money-finance.mjs) pins the limit on a synthetic book
and on the seeded book of all three casts, the version 3 record and its refusals, the version 1 and
version 2 parses, the principal derivation, the grain clamp and the limit that rises after a plan
is repaid on time. `drives/drive-cedar-money.py` walks the surface at 1600, 390 and 320: the
offered card's amount and basis, **Get advance**, the slider and the figure beside it, three
payments on S/ 5,000, the purpose, the grant waiting for the authorization, the granted card's
three lines, one repayment and its reload, the last two, the raised limit, and the
`#/money/advance/500000` route opening Pay over time already on S/ 5,000. The same assertions are
red on the build of `main`, where the card states one fixed S/ 1,000 and **Choose repayment plan**.

## The lender dossier

A dossier is a document. It states what this workspace is, what has moved through it, what it sells
and to whom, and what the seller has authorized — and it is unrelated to any loan
([FEED-IA §249](../../../../docs/FEED-IA.md), «a dossier is a dossier. it's underlated to an
action/loan»). The advance request remains a separate action on its own card.

### The model

[dossier.ts](dossier.ts) holds the whole derivation. `dossierOf(input)` takes the workspace's
identity, its opening balance, the Money state, the sales the Money area passes and the consents it
holds and an optional requested advance, and answers six sections with source/period metadata plus a repayment-capacity comparison. It imports only `money-model`'s own pure selectors —
`invoiceBalance`, `invoiceOverdueDays`, `isCollectible`, `peruDate` — so an invoice that reads
Overdue on the dashboard reads overdue here, and [test-dossier.mjs](../../../tools/test-dossier.mjs)
runs the real thing. Sales are typed structurally (`DossierSale`), so the module keeps no dependency
on Sales and `MoneySourceSale` satisfies it.

**The financial snapshot uses the ledger clock.** `moneyNow(state)` dates the document,
selects its movements window and supplies the observation instant for `invoiceOverdueDays`.
Its fixture `referenceAt` advances with the workspace's recorded events. Completed PDF preparation
has a separate actual action timestamp, written after generation succeeds. Both clocks retain
their saved evidence through reload: one describes the accounting snapshot, the other the export.

- **The window.** `to` is the prepared day and `from` is 89 calendar days earlier. Every figure in
  Movements reads this ninety-day period, stated with `dossierWindowWords`.
- **Movements.** *Money in* sums matched bank receipts within the period. Cash and manual evidence
  settle their invoice in their own ledger. *Invoiced* sums collectible PEN invoices issued in the
  period. *Average daily balance* averages all ninety closing balances, starting with the account's
  opening balance plus earlier bank receipts and adding each receipt on its own day. *Balance
  today* is the final daily balance and reconciles with `projectMoney`'s `bankBalanceMinor`.
- **Collections.** *Requests sent* counts the invoices with a request the seller recorded as sent.
  *Paid* counts the collectible invoices whose balance is zero, with their total beside it.
  *Success rate* is paid ÷ requests sent, in basis points. *Average time to pay* is the calendar
  days from a document's issue to the receipt that settled it, to one decimal.
- **Order book.** An order is an order — it names a customer and holds lines — which is
  `advanceLimitOf`'s own predicate, so the dossier's book and the advance's limit read one set. The
  book is every order the workspace holds, and it states its own window: Cedar's book carries
  committed orders ahead of today as well as delivered ones, so the window runs from the first
  order day to the last. *Orders per week* is the count over the window's days, times seven;
  *average ticket* is the value over the count; *delivery days per week* is the distinct order days
  over the window's days, times seven, to one decimal. *Top customers* are the five with the most
  value, each with its share of the book. The ISO weeks are kept beside them with their own orders,
  value and days.
- **Risk signals.** *Overdue invoices* is `invoiceOverdueDays` against the prepared instant: the
  count, what is still owed on them and the average days late. *Disputed orders* is the book's own
  state — Cedar's sale states are `request … delivered`, `disputed` and `settled`, so the word the
  document uses is the word the order carries — with its share of the book. *Orders by weekday* is
  seven rows, Monday first, whose shares are allocated so that they sum to exactly 10 000 basis
  points (`sharesOf` hands each share its floor and gives the remainder to the largest fractions).
  *Unit price range* takes the three products the book turns the most value on and states the
  lowest, highest and quantity-weighted average unit price across their lines; where one price
  stands across the whole book the row says so — «S/ 358.80 · steady across 362 lines».
- **Consents.** An ordered list of `{ kind, at }`: `bank-access` from the payment setup's own
  `consentAt` (written the moment the seller authorized the bank connection), `auto-repayment` from
  the advance plan's `consentAt`, and one legacy `share` per completed PDF preparation. A consent with a damaged instant stands
  outside the list, because a consent nobody can date is a consent nobody gave.

### Sources and repayment capacity

Each section prints its source directly below its heading and the calendar period its records cover.
Identity uses the preparation day; Movements uses its ledger window; Collections uses its requests
and receipts; Order book uses its order dates; Risk signals spans its invoice and order records;
Consents spans the retained authorization and document preparation dates. `dossier.evidence` supplies these same
source lines to the screen and PDF through `dossierSourceWords`.

**Repayment capacity** compares the requested advance with the preceding calendar month's takings.
Takings are positive matched PEN receipts, including recorded cash, selected by their Peru calendar
date. The ratio is `requested minor units × 10,000 ÷ takings minor units`, rounded to basis points.
The comparison states the actual month and received total. A month holding zero receipts shows the
condition under which the comparison appears.

The seller enters **Requested advance · PEN** in a 44px field. Its amount is retained as optional
`requestedAdvanceMinor` in the existing dossier log. A saved advance plan supplies its principal as
the initial amount until the seller records a dossier amount. Other-tab saves and workspace reset
update the mounted field through the same scoped log. This is a figure in the document;
the advance request continues through its separate workflow. The exported PDF states a requested amount
and its ratio only when that amount is positive; an empty request retains the actual previous-month
takings alone. The screen keeps its amount-entry guidance.

### The document preparation log

One scoped key, `rocoto-cedar-dossier-v1:<scope>`, holding `{ version: 1, scope, shares: [{ at }], requestedAdvanceMinor? }`
— the last fifty PDF preparations, in order. The legacy `shares` field and `share` consent kind
remain readable; existing timestamps remain exactly as recorded. New records capture wall time
after PDF generation succeeds, independently of the accounting snapshot clock. `parseDossierLog`
validates the version, the scope and every instant,
and a damaged record reads as an EMPTY log rather than as half a record: the page then states the
share act, which is the honest state. The row is inventoried in
[workspace-reset.ts](workspace-reset.ts) as workspace data, so both Reset acts return it to an empty
log, and `money-dossier.tsx` holds the one `useDossierLog(scope)` hook over it with the
subscribe/emit pair `money-store.ts` uses, plus the `storage` and `rocoto:cedar-workspace-reset`
listeners.

### The door

`lender-door` on the Money dashboard, after the working-capital card: the object, the heading
**Lender dossier**, the sentence *Your identity, movements, order book and risk signals in one
document.*, the document's own six section names, the last preparation as a fact line
(`lender-door-shared`, «PDF prepared 14 Sept 09:46») and one act — **Share with lender**
(`lender-door-open`) — which opens `#/money/dossier`. The card carries `data-shared`, and it stands
in every bank posture, because the dossier is the workspace's own data.

From 801 px the door takes the dashboard's right column across both of its last two rows, so
Working capital and Customer credit stack beside it rather than leaving the corner empty; below the
grid's own 800 px breakpoint every card is one column and the placement lifts.

### The page

`money-dossier` at `#/money/dossier` is the document: a ruled paper with a 1080 px outer
measure, an act row carrying a back link to Money (`dossier-back`) and **Share with lender**
(`dossier-share`), then a head — the workspace's legal name, its RUC, **Prepared 14 Sept 2026** and
the movements window — followed by source-record depth, a business overview and six numbered
sections in this order, with ruled dividers and tabular figures and each unit on its number's own line:

| Section | What it states |
|---|---|
| **Identity** | legal name, RUC, owner, address, receiving account |
| **Movements** | money in, invoiced, average daily balance with its own window, balance today |
| **Collections** | requests sent, paid, success rate, average time to pay |
| **Order book** | orders per week, average ticket, book value, delivery days per week, the top five customers with their shares |
| **Risk signals** | overdue invoices, disputed orders, orders by weekday, the unit price range of the top three products |
| **Consents** | each consent with the moment it was given |

The legal name is `setup.sellerName` — what every Cedar invoice already carries — and the address is
the company card's fiscal address the moment anybody edits it, and the address the workspace gave at
setup until then, which is `demo-welcome.tsx`'s own rule. The receiving account is
`bankCapabilityOf`'s masked answer; until a provider answers it reads **Added at bank connection**,
and that one line is the whole difference between a connected workspace and a workspace still to
connect one. Nothing else on the page is gated.

**Share with lender** creates a downloadable PDF named
`dossier-<workspace>-<date>.pdf`, using the legal name's slug and the preparation day. The PDF carries
selectable Inter text and semantic theme colours on fixed A4 pages: business identity, source-record
depth, overview and movements on the first page; collections, payment behaviour and capacity on the
second; the order book, repeat customers and delivered-order history on the third; risk signals and
consents on the fourth. Long consent records continue onto further pages. Each page carries the preparation date
and page count. The PDF uses the same `Dossier` model, source lines and currency formatter as the
screen, independently of the browser's viewport and print settings.

[dossier-pdf.ts](dossier-pdf.ts) loads lazily when the share starts, using the pinned `pdf-lib` and
`@pdf-lib/fontkit` dependencies and the app's installed Inter fonts. A loading state appears on the
pressed button while the file is produced. After generation succeeds and the scope/reset guard
still holds, the action records its actual completion time and starts the browser download.
The head, history and dashboard door state **PDF prepared**. These bytes contain the history captured
before their generation; the next export includes the newly completed action. The record establishes
PDF preparation. Recipient delivery needs its own accepted transport evidence. The ordinary browser
print control
retains the page's existing print stylesheet.

Workspace reset, another tab clearing the workspace, a scope change and leaving the document
cancel a pending export. The request's generation and abort signal fence its font reads, download
and preparation-log write. Ordinary ledger updates leave the captured document snapshot intact.

### Wiring, when Prometeo, NubeFact and a lender are commissioned

The document is the workspace's own data today and the same six sections against providers later,
with one seam each.

- **Movements** becomes the provider's account read. Prometeo returns three to six months of
  movements for the authorized receiving account — the same account `bankCapabilityOf` already
  answers on and `readBankActivity` already reads for the Incoming money chart — so the window
  widens from the days the ledger holds to the months the bank holds, and inflows, the average daily
  balance and the closing balance are read from those movements rather than from matched receipts.
  The window rule is unchanged: the document states the window it actually read.
- **Collections** keeps Cedar's own requests and gains the wallets' own answer: a Yape or Plin
  collection confirmed by the collection service is the receipt the success rate counts, so the rate
  becomes the wallet success rate the lender asks for rather than a count of settled invoices.
- **Identity** takes NubeFact's issued documents beside the invoices: the seller's series, the
  accepted document count and the fiscal address on file, read at the workspace the way
  `invoicingCapabilityOf` already reads it.
- **The share** becomes a post. The dossier is the KYB pack a lender of record receives — identity,
  movements, collections, order book, risk signals and the consent log with its timestamps — posted
  to the lender's intake with the workspace's own identifier, and the share log records the lender
  and the reference the call returns beside the instant it already records. The consent log is what
  authorizes that post, which is why it is part of the document rather than a line beside it.
- **The document stays a document.** No provider answer adds an approval, a score or an offer to
  this page; the lender's own answer lands on the working-capital card, where the advance is offered
  and granted.

### Proof

[test-dossier.mjs](../../../tools/test-dossier.mjs) runs `dossierOf` on two books. A synthetic
ledger and book pin every figure — the 90-day window and daily balance series,
the 50 % success rate, the two ISO weeks, the customer shares, the Monday/Tuesday seasonality, the
three price ranges, the consents in order, and the empty workspace that answers with its own day.
The seeded book of all three casts reconciles: the closing balance against `projectMoney`, the
invoiced total and the overdue count and amount against `invoiceBalance` and `invoiceOverdueDays`,
the order book against the sales themselves, the five customers in order, and the seasonality
summing to exactly one hundred per cent. The share log's parse, its cap and its round trip are held
there too, with the words a window, a share, a percentage and a file name take.

[drives/drive-cedar-dossier.py](../../../../drives/drive-cedar-dossier.py) walks the surface at
1600, 390 and 320: the door and its one act, the six sections in order, every figure measured
against the ledger read out of `localStorage` and the overdue count measured against the dashboard's
own Invoices card, the downloaded PDF's file name and bytes, the unchanged document title,
the record written once, the shared line surviving a reload and standing on the door, and the paper
itself in print media, where the app is gone and the document alone remains. `unconnected` holds the
page with the provider out of reach, and `reset` holds Reset Cedar returning the log to its seed.
The original assertions were red on their preceding build, where the door was absent and `#/money/dossier`
falls back to the invoice list.

## Connection state

One provider answer per money account, and no surface reads a local flag
([FEED-IA §247.2](../../../../docs/FEED-IA.md)). [money-bank-capability.ts](money-bank-capability.ts)
is the pure derivation — a provider snapshot in, a posture out — and
[money-bank-api.ts](money-bank-api.ts) holds the runtime that polls it on the phone's own
boundaries: focus, `visibilitychange`, a sixty-second period with a ten-second floor, and a
revision guard so a response from a previous workspace can never overwrite the current one.

**What a read leaves standing.** Two pure reducers in
[money-bank-capability.ts](money-bank-capability.ts) hold the whole rule, and
[test-money-capability.mjs](../../../tools/test-money-capability.mjs) pins it.

| The read | What it leaves | Why |
|---|---|---|
| it answered | the answer, `staleSince: 0` | the provider spoke |
| it failed and the transport carried the failure (a 500, a 503, a timeout) | the standing evidence, marked `stale` | a failed read is a fact about the network |
| the service answered about THIS workspace — 401, 403, 404 | `unavailable`, evidence cleared, `staleSince: 0` | a rotated or invalidated token is a fact about the account |
| one of the two records answered, the other rejected | the surviving answer beside the carried record, marked `stale` | the carried record stands unconfirmed |
| both records rejected on a first read | `unavailable`, `staleSince: 0` | a settled posture is a fact |

`stale` therefore means «this evidence stands and the last read failed to confirm it». Every
branch that SETTLES a posture carries `staleSince: 0`, because a fact is never a pending check —
the phone shipped, and fixed, the inverse of exactly this (`phone-runtime.ts`, DEFINITIVE).
[money-api.ts](money-api.ts)'s `CollectionApiError` is what carries the service's status up to the
runtime so the definitive branch can read it.

| Account | Selector | Reads | Ready when | Word otherwise |
|---|---|---|---|---|
| Bank (Prometeo) | `bankCapabilityOf` · `useBankCapability` | `GET /api/cedar/bank` | the service returns an authorized receiving account | Connect bank |
| Payments (Yape & Plin) | `walletCapabilityOf` · `useWalletCapability` | the same snapshot's `wallets` | the service states a collector of its own | Set up payments |
| Invoicing (NubeFact) | `invoicingCapabilityOf` · `useInvoicingCapability` | `GET /api/cedar/setup` → `readiness.nubefact` | the account is configured and carries a mode | Set up invoicing |

Four postures: `checking` while the first read is in flight, `unavailable` when the service
answers nothing, `setup` when it answers and holds no account, `ready` on the provider's own word.
Everything that is not `ready` presents one picture and one act — `FeatureArtwork kind="money"`, one
sentence and one button — on the bank-transactions card, the balance card, the working-capital card,
the invoice's payment row and the buyer preview. Wallets never inherit the bank's answer, and a
monitor asking for re-authorization keeps the account connected while stating that one step.

`setup.payments` and `setup.invoicing` say what the PERSON did in the walk — `pending`, `deferred`,
`authorizing`, with the legacy `demo-connected` read as authorized — and nothing reads them for a
connection claim. Seeding writes example records and the seller's identity, never a posture, and
the consent step records consent and then waits: `Authorization sent · Prometeo activates this
account` and `NubeFact activates this account` are what a finished local walk says, and only the
polled provider evidence moves a card to `Your account is connected`.

Money setup asks one question per step, on the phone's model: the bank, the account's name, the
consent act, then the provider's answer. Secondary matter lives in the setup frame's disclosure.

The shared reset contract (`rocoto:cedar-workspace-reset`, PRODUCT-SPEC «Reset») is listened for by
`money-bank-api.ts` (the provider snapshot returns to `checking` and re-reads), `money-store.ts`
(the ledger cache drops), `money-overview.tsx` (the saved advance plan drops) and
`money-credit.tsx` (the credit sort re-reads).

The customer-credit card opens `/money/credit`, which derives customer balances from outstanding sample invoices, ranks by nearest deadline or biggest amount and remembers the selected view. Customer links open the existing profile; its Credit section lists outstanding invoices and deadlines. These controls demonstrate servicing UX. Lending eligibility, funding, credit limits, underwriting and contractual terms are commissioning steps that belong to the provider supplying the money.

### The seeded bank: the demo is a hybrid (FEED-IA §251)

> «it should be with mock data cos we still dont have rela prometeo but people dont need to know
> that. this is still admeo after all. a hybrid real.fake demo» — Peter, 14 September 2026

§247.2 made every Money posture read the provider's own authorized account, and the demo runtime
holds no Prometeo account, so the published page read **Connect bank** on every Money door. The
answer is one deployment switch on the collection service: where a provider is commissioned the
doors read that account, and where one has yet to be, they read Cedar's own seed.

**The switch.** `CEDAR_SAMPLE_BANK=1` in the runtime's private environment
([config.py](../copper/runtime/config.py), `Settings.sample_bank`; the allow-list and the `0`/`1`
validation are in [`__main__.py`](../copper/runtime/__main__.py)). It is **off by default**, so every
existing target, every test and `drive-cedar-money.py`'s unconnected block keep the posture they
prove today. It is on for `copper-preview` — the demo's own runtime at
`copper-demo.soyrocoto.com`, declared in
[copper-preview.env.public](../../../../docs/omitted-sources.md) — and off on
the maintained and staging targets, which run product code against their own isolated services.
The switch is a deployment fact and belongs in the company record's consumer row for that target.

**What it answers, and from which rows.** [`providers/sample_bank.py`](../copper/runtime/providers/sample_bank.py)
reads [`sample_bank_v1.json`](../copper/runtime/sample_bank_v1.json), which is **derived** from
[money-v1.json](fixtures/money-v1.json), [money-seed.ts](money-seed.ts) and `sale.ts` by
[test-sample-bank.mjs](../../../tools/test-sample-bank.mjs) — the same file regenerates it with
`--write` and fails when the two drift, so the service and the browser do one arithmetic. Amounts
are integer minor units; days are offsets from the fixture's reference day, resolved against the
workspace's own calendar exactly as [scenario-clock.ts](scenario-clock.ts) resolves them, so the seed
follows the calendar on both sides. Nothing is invented: every figure is the fixture's.

The ninety-day fixture contract is in [fixtures/README.md](fixtures/README.md). The generated
schema-2 artifact holds one variant per weekday. Both authenticated bank reads accept the saved
Money book's `fixture_day`: an edited book stays on its retained calendar while new receipts keep
their actual arrival times. The selector applies to sample data; commissioned accounts keep their
provider dates. Pristine Money and chase books regenerate together as the Peru day advances.

| The service answers | From |
|---|---|
| `bank` | one Peruvian bank per house, fixed: BBVA for the fish book, Interbank for the meat book, Scotiabank for the fruit book — the three receiving banks Cedar's setup, its request contract and its brand assets already carry |
| `account_label` | the house's own name (`houseName`) |
| `account_mask` | the last four digits of a nine-digit number that is a digest of the scope, so it is the same account on every box and every run |
| `balance_minor` | `openingBalanceMinor` plus matched noncash seeded receipts and new runtime bank receipts through the account clock — the arithmetic [money-projections.ts](money-projections.ts) does in the browser, to the centavo |
| `currency`, `as_of` | the workspace's currency, and the sample clock: the house's own reference hour on the workspace's current day |
| `mode`, `source` | `sample` on the account and on every movement |
| `monitor` | `{enabled: false, status: "off"}` |
| `wallets` | `{yape: true, plin: true}` — the collectors the seeded receipts arrive through |
| `GET /api/cedar/bank/movements` | the seeded receipts as credits, each matched to the request, invoice and Delivery Note the seed allocated it to, newest first |
| `readiness` | `prometeo` and `nubefact` both `configured` with `mode: "sample"`, so `invoicingCapabilityOf` answers `ready` |

**Which house.** The browser states its scope when it creates the workspace
(`POST /api/cedar/workspaces {"scope":"fish"}` in [money-api.ts](money-api.ts), stored by
[cedar_store.py](../copper/runtime/cedar_store.py)). A workspace created before that reads the house
whose name its `setup.seller_name` already carries, and one that has stated neither reads the first
house of the book.

**Where a provider stands, the provider answers.** The seeded answer is scoped per provider and per
workspace: `settings.sample_bank and provider not in state["providers"]`. Commission Prometeo and the
bank door returns to its own posture — `Connect bank` until an account is authorized, then that
account's real balance — while NubeFact, still uncommissioned, keeps the seeded answer. No surface
changes for either: `bankCapabilityOf`, `walletCapabilityOf` and `invoicingCapabilityOf` read one
snapshot, `mode` gains `sample` beside `sandbox` and `live`, and a seeded account is `ready` because
it is an account this workspace collects into.

**The onboarding walk lands in one step.** Money setup's `payments` entry already opens on
`payment-ready` — «Your account is connected» with the account's own name and mask — the moment
`bankCapabilityOf` answers `ready`, and the ring's bank milestone reads the same selector. In sample
mode that is true on the first read, so the walk's own words stand and the step that used to wait on
«Authorization sent» is already complete.

**The words say what it is; the provenance is in the data.** A merchant reads «Bank receipt»,
«Payment request created» and «Invoice accepted · NubeFact». Which account answered travels as
`data-mode` on `money-fiscal-status` and `money-acceptance` and as `data-source` on
`money-history-receipt`, plus `mode` and `source` on every movement — the drive's fact and the
operator's, never a sentence in the way.

**Proof.** [test-sample-bank.mjs](../../../tools/test-sample-bank.mjs) holds the derived ledger to
the browser's own seed on all three books and on a synthetic one;
[test_cedar_native.py](../copper/tests/test_cedar_native.py) holds the service — each house's account
and balance, the movements matched to their requests, the readiness, the default-off switch, and a
commissioned Prometeo account taking the answer back;
[test-money-capability.mjs](../../../tools/test-money-capability.mjs) holds `mode: 'sample'` as
`ready` on all three selectors; and [drive-cedar-hybrid.py](../../../../drives/drive-cedar-hybrid.py)
runs the real service process in sample mode on a private port and walks the published surface at
1600, 390 and 320.


## Acceptance

Demonstrate page/modal setup, defer/resume, settings access, invoice issuance from a Delivery Note, immutable issued amounts, visible source/converted currencies, payment request copied/sent distinction, partial/full manual and simulated receipts, duplicate/mismatch handling, and bidirectional document links. Verify browser persistence and scenario isolation, responsive desktop/phone layouts and keyboard dialog behavior. Show 1600px and 390px screenshots. Run repository gates/tests and the scoped browser drive; distinguish fixture evidence from provider acceptance.

## Owned development architecture

Cedar owns the experience across these existing sources. Their physical folders and hostnames retain compatibility; [money-runtime.json](money-runtime.json) selects the logical development/demo target.

| Layer | Owner and source | Responsibility |
|---|---|---|
| Entrance and onboarding | [Onboarding contract](ONBOARDING-SPEC.md), business/config/channel stores | One business profile, sequential setup, the same connections reopened from settings |
| Sales and documents | Existing Sale/customer IDs, [money-model.ts](money-model.ts) | Frozen invoice amounts, Delivery Note links, separate tax/payment/delivery states |
| Workspace projection | [money-store.ts](money-store.ts), [money-sync.tsx](money-sync.tsx) | Shared receipt ledger for Sales and Money, persistence, bounded background refresh |
| Collection transport | [money-api.ts](money-api.ts), [native service](../copper/runtime/cedar_service.py) | Workspace authorization, canonical invoice request and capability-scoped buyer page |
| Durable evidence | [Cedar store](../copper/runtime/cedar_store.py) | Encrypted persistent workspaces, immutable requests and idempotent receipts |
| External providers | [Service contract](../copper/SPEC.md) | Operator-scoped bank authorization/account binding/transaction reads, NubeFact submit/query recovery |
| Reproducible data | [Money fixtures](fixtures/README.md), [testdata manifest](../../../../testdata-cedar.json) | Existing Cedar identities, ninety-day native PEN history, Peru calendar offsets, shared create/reset/delete lifecycle |

The browser submits a frozen commercial billing identity and its matched opening receipts atomically on first collection creation. A newly prepared draft has a payment reference independent of the fiscal number it is issued with. The optional billing snapshot is immutable after that first request; retained sample invoices omit it. Each workspace/invoice has one canonical service request. Later balance updates and recreated links retain that request and its receipt ledger. Copying, manually recording a send, and receiving money have distinct effects. A retry keeps its original idempotency key. Requests awaiting service acknowledgment stay share-blocked until recovery succeeds.

The workspace token authorizes that workspace’s sample/manual operations. It grants neither provider configuration nor bank-evidence manufacture. Buyer URLs reveal the selected request only. Prometeo live evidence requires a protected authenticated read, an exact bound account/currency and either its stated reference or the current unique amount when the reference is empty. The [exact payment amount contract](PAYMENTS-SPEC.md#exact-payment-amounts-250) reserves quotes atomically, rotates them after partial receipts and keeps old amounts reserved. Each receipt retains actual cash and separate rounding; invoice settlement and fiscal totals use principal. A positive incoming movement whose principal fits the remaining balance allocates in full once. A movement is owned by one request; oversized principal and ambiguous evidence stay in Review. Provider sandbox evidence remains sample evidence. A server-confirmed receipt keeps its Prometeo provenance throughout browser history. The explicit bank payer name is review context; the amount key is labelled in matched bank evidence.

Rocoto’s Stripe subscription state remains in Administration billing. Money owns the distributor’s customer receivables, collections and account view. Working-capital financing has sample schedules and explicitly separate state; it changes neither the bank balance nor the provider ledger.

## Development acceptance evidence

The local native HTTP drive exercises separate seller/buyer browser contexts at desktop and phone widths, copied buyer links, partial/full receipts, both-side polling, idempotency, browser reload, SQLite restart recovery and workspace/capability boundaries. It blocks external provider traffic. The fixture drive covers the broader Money, document, credit and financing interactions. Provider unit/contract tests cover exact account binding and uncertain invoice-submit recovery. Actual Peru account coverage, wallet receipt-reference propagation, real provider acceptance and seller terms remain commissioning evidence.

## Commissioned bank monitoring

The selected live design uses an explicit operator-enabled monitor for each authorized receiving account. A due-time index schedules bounded reads, at least five minutes apart, through the same authenticated movement/account adapter and exact-reference allocator as manual refresh. Last attempt, last error and next due time are retained; session loss and provider failure remain recoverable states. The default sample workspace keeps monitoring disabled, and so does the seeded bank of §251: a workspace answered from the fixture reports `monitor: {enabled: false, status: "off"}` on every read, because a monitor is a schedule of authenticated provider reads and the seed has none to make. Commissioning Prometeo for that workspace returns the monitor to the operator's own switch above. The frontend reads the resulting ledger independently of the provider schedule and propagates updates to Sales, invoices and Money.

A merchant’s real QR becomes payable only on the operator’s explicitly selected, reviewed seller documents. Sample requests keep their sample presentation. Account and QR binding are retained on those selected requests. The commissioning trial must prove the actual recipient and the reference returned by the bank; a known Cedar link identity alone does not establish correlation through a separate wallet transfer.

## Bank transactions and fiscal issuance

The owner-scoped bank feed exposes masked accounts, dates, reference, debit/credit, allocated and unallocated amounts, matching reason and document links. Money offers All/Review, expandable evidence, invoice/Delivery Note navigation and a strict recheck for an eligible exact-reference request. Rechecking uses the same server allocator as the monitor; selecting a document grants no exception to account, currency, amount or provenance checks. Every row on this card is a movement the provider returned; a workspace with no authorized account reads the setup state above instead.

NubeFact commissioning binds the seller RUC, provider mode, series, next available number, unit mapping and tax policy. The operator reviews the precise immutable commercial snapshot before authorizing it. The service reserves the fiscal identity and payload before network I/O. The explicit issue-date policy freezes the current Lima date on the first paid submission; retries retain that date. Authenticated Prometeo receipts must confirm the whole requested amount before automatic issuance; manual and sample receipts keep their own provenance and cannot satisfy that requirement. An uncertain submission is recovered by querying that same identity. Cedar's invoice controls expose provider status and available issue/query actions; accepted fiscal numbers link back to the same commercial document and payment ledger. New billing drafts use their real preparation/due dates; the original seeded documents retain their scenario clock.

Owner capability replacement or a scenario reset aborts in-flight money requests and invalidates late JSON responses before they can update the browser. Private bank/fiscal projections and remote request bindings are cleared; local commercial snapshots and sample/manual entries retain their declared source. Publication preserves the service's existing private state and encrypted provider configuration.

### Gap item 4 proof

`test-dossier.mjs` holds all six source periods, previous-calendar-month receipt boundaries in Lima,
cash inclusion, review exclusion, zero-receipt capacity, the retained requested amount and the PDF
file name. `drive-cedar-dossier.py` adds the `evidence` block: source lines, a quarter-of-takings
comparison, reload persistence, 44px input, viewport fit and an actual downloaded PDF at 1600, 390
and 320. The `recovery` block proves other-tab updates, reset, a failed font read and a successful
retry that records one completed PDF preparation. Network requests prove the PDF code loads at the download action.
The `cancel` block delays a font response while local reset, another-tab reset and scope change
each cancel the old document and preserve the cleared share log at all three widths.
The saved PDF is rendered and inspected alongside the screen captures.

### Business dossier presentation and operating evidence (§255.4.1)

The dossier is a formal business document. Its masthead leads with the business name, RUC,
address and preparation day. A record-depth strip names the historical orders, order lines,
customers and matched receipts behind it; a business overview states the book's value and repeat
customer share. Six numbered chapters retain their independent source periods and measured
figures. A restrained ruled page, consistent typography and wrapping identity fields replace the
separate rounded data cards. The fixed A4 PDF carries the same evidence and chapter hierarchy.

The order book includes dated orders from the preceding 90 calendar days through the preparation
day, excluding messages, archived rows and upcoming dates. Repeat customers have two or more
orders in that window. Delivered-order evidence includes `delivered` and `settled` states. The
weekly chart draws those completed deliveries, names its partial current week and retains the
actual count of each week. All recorded current order states remain in the historical order total.

Collections additionally exposes invoices with multiple matched receipts, part-paid invoices and
their balance, recorded reminders and invoices settled after a reminder. Reminder joins use the
invoice's own id and recorded send timestamp. These are observed records and temporal outcomes;
the dossier derives its figures from the ledger and messages it holds. Data stays in the existing
workspace stores. Requested-advance entry retains its separate consent and share lifecycle.

Payment time uses the first cumulative matched receipt whose allocated principal covers the invoice,
including recorded cash and the source-aware arrival clock. Unique-amount rounding stays in bank
cashflow and takings; principal determines the settlement instant. A later excess payment preserves
that original settlement time. Paid after a reminder joins the actual reminder to that settlement,
within the displayed 90-day operating period. The split-payment regression proves this distinction
with two rounded partial receipts and a final principal receipt after a reminder.

Collections Paid, paid value, success rate and payment time use the same set of collectible PEN
invoices with a recorded sent request. Direct settlements contribute to receipt and operating
evidence; they enter collection-success figures when their own request was sent.

## Order-owned payment lifecycle · gap item 2, 15 September 2026

The selected lifecycle follows [FEED-IA §257](../../../../docs/FEED-IA.md#257).
Every priced collectible order owns a canonical payment request when it becomes collectible.
`createOrderPaymentDocument` freezes the commercial goods and document number; the root
`OrderPaymentSync` registers its actual native checkout automatically. Its three sharing acts are
**Open Yape link**, **Copy link**, and **Send on WhatsApp** or **Send by email**, following the customer
account channel. The open act is a real new-tab anchor. A preparing state covers native registration.
The native reference is `paymentReference(invoice)`, preserving the order's document identity.

The first customer contact follows the delivery evidence. New delivery acts persist their actual
`recordedAt` in the Sale event; historic fixture events keep their authored calendar and hour.
Money offers **On delivery**, **Delivery evening** at18:00 Lima, and **Next morning** at08:00 Lima.
Each policy runs at or after the actual delivery instant. A merchant can send early or hold a
particular order. Dispute, goods changed after loading, part returned, monthly billing and a manual
hold each show a reason and a one-press send. Sending a reviewed hold releases that exact goods
revision; another change restores the hold. Commercial revision preserves the link and receipt
principal and is frozen by fiscal preparation or commissioning. Revision and fiscal preparation
serialize per order in the browser, and native mutation checks the prior commercial fingerprint.

The dispatch ledger owns the exact text, account channel, actor, reason and timestamp. First contact
sets `sentAt`; subsequent manual sends retain that first contact and append distinct dispatch records.
`sendToThread` is the existing scoped customer-conversation transport shared with Chase now. Stable
row identities restore first contacts and reminders after reload exactly once. Native `/dispatch`
records the merchant-action boundary used by fixture retention; the durable message and delivery
reason are in the scoped Money ledger. This browser/native proof establishes the customer conversation
and receipt loop. An external WhatsApp/email provider delivery requires its owning commissioned
transport and delivery evidence.

Reminders are eligible at24,48 and72 hours after first contact, with one pending rung per wake.
Held and paid orders stay outside the automatic ladder. Manual reminders require first contact and
record their native merchant action before writing the conversation. The central `CollectionSync`
uses one owner cursor request per poll, applies changed snapshots in one local commit, and keeps a
partial receipt's remaining amount on the same link. Every asynchronous registration/send checks its
workspace generation after awaits; a reset or cast change stops the previous coordinator before its
next conversation write.

Fiscal details have their own **Prepare electronic invoice** action. A commercial collection
requires the actual seller/customer names, document number, PEN total and priced goods. Fiscal
preparation adds the entered customer RUC/address, seller RUC, tax and due date. The native service
validates the exact commercial identity and goods before attaching the billing draft. Existing
operator authorization, numbering, confirmed-payment and NubeFact acceptance guards remain in force.
Seeded commercial history displays its order and receipts; provider acceptance appears with the
actual native fiscal record. Cash and manually confirmed receipts remain available in Transaction
history and preserve their manual provenance.

### Full-book registration and retained calendars

The fixture supplies a commercial request for every collectible priced Sale. Native hydration runs
in atomic batches of25, prioritizing visible and unpaid orders, then paid history. The service holds
up to2000 requests and10000 receipts within the encrypted workspace size limit. Registration is
idempotent and publishes an actual buyer URL only after the native response. Opening receipts retain
their original amount, method, reference and timestamp; earlier bank evidence keeps its actual clock.
Historical first contact that preceded delivery reads **early payment**.

A pristine browser fixture carries a structural signature that ignores native transport metadata.
A new Peru day rotates its native workspace only through authenticated `/workspace/fixture-rollover`
and only when both browser and native evidence agree that the book is disposable. The native check
requires a sample workspace, fixture-owned requests for the retained day, opening sample receipts,
and pristine provider, destination, fiscal and merchant-action records. Rotation atomically preserves
the encrypted old evidence, closes its payable capabilities and creates a replacement owner binding;
repeating the old-workspace/new-day pair returns that same binding. Authored books retain their
calendar and native workspace. A failed handshake preserves the retained ledger. Duplicate preparations share one native
handshake. A scoped mutation lock fences browser ledger edits during that handshake, then releases
after success, failure or reset; reset cancels the prior preparation before it can seed another book.

The owning browser proof is [drive-cedar-order-payments.py](../../../../drives/drive-cedar-order-payments.py).
Its default uses an isolated native runtime; `ROCOTO_PUBLISHED=1` with the declared demo `ROCOTO_URL`
selects the deployed sample runtime and a fresh scoped workspace. It exercises actual delivery,
customer contact, held sending, new-tab phone/code approval, owner polling and receipt reload at1600,
390 and320. Native, model and store tests cover commercial/fiscal identity, revision races, partial
payment, bulk idempotency, retained calendars and reset during a pending dispatch.

Early-payment conversion measures contacted orders that were outstanding at their earliest valid
first contact. Its seven-day window starts at that contact, and its denominator includes a completed
window or a full settlement already observed within it. Partial principal received before contact
reduces the remaining balance. Automatic unsent links and invoices already paid before contact stay
outside this contact cohort. Callers provide the actual observation instant and the sample ledger
clock explicitly. First contact records its sample or actual clock provenance; actual contacts and
runtime/provider receipt evidence use the actual clock, including an unpaid actual contact.
