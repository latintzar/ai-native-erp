# The original situations brief (Peter, 2026-08-21, recovered verbatim from the session transcript)

# Rocoto — situations catalogue /goal   this is a desing job. not a production job, but it is one step away form production. it is our most intelligent design work yet, so it has to be treated like a ceo giving the top designers in the company to now figiure out the product thst has been a messy mvp that didnt have customer buckets at all. We ar eon a mission to uncover the universal process behind the food wholesaler order and preparation process or the commercial process and so we may have any order taking in fulfillment this is a great day.  

I want you to make an opus 5 ultracode subagent to do this well and remember that this is an upgrade from what we have now so like  yeah better be solid but naturally not thag crzy far from our current design but better.. I'd rather you don't do the full reconnaissance because this is only gonna muddle the stuff that you already have. It's better if you do a sort of light one. You get the most important things, but at design-MD level things.

**Brief for Claude Code.** Build a scrollable catalogue of every situation the product has to
handle, each one rendered as a real screen. This document defines the model, lists every
dimension and configuration, and states the job each screen does.

Read all of it before writing anything.

---

## 0. What this document is for

Rocoto is software for food distributors in Spain. A food distributor is a company that buys
food in bulk — fish, meat, fruit and vegetables — and sells it in smaller quantities to
restaurants, bars and hotels. Their customers place orders by WhatsApp message, voice note,
photograph of a handwritten list, telephone call or email. Somebody at the distributor reads
those messages and types the orders into the company's accounting system by hand.

The thinking behind this product has been done one conversation at a time. Each visit to a
distributor revealed how one company works. Those observations are accurate but partial. This
document exists to write down the complete set: every way a company in this industry can differ,
including combinations nobody has yet been observed using.

The purpose of writing them all down separately is to find out which ones are actually the same.
When every case is written out on its own, it becomes visible that two of them need identical
screens, or that one is another with a single extra column. Reducing the count is the point.
See section 7.

---

## 1. Definitions used in this document

**Dimension.** One question about how a company works. Example: "Who checks an order before it
goes to the warehouse?"

**Configuration.** One valid answer to that question. Example: "Nobody — orders go straight
through unless something could not be read."

**Situation.** A specific combination of configurations that produces a screen different from
any other screen.

**Job.** The single thing the person using that screen is trying to accomplish. Written as one
sentence. If it takes two sentences, the screen is doing two things and should be separated.

**Primitive.** A reusable control. The same primitive appears in many screens.

**SKU.** A single product as it exists in the distributor's own catalogue, with its own code and
its own unit of sale. Example: "Mango de barco, caja de 4 kg, code 4471".

**Albarán.** The document that travels with the goods and lists what is in the boxes. In English,
a delivery note.

**Factura.** The invoice. A separate, later document that says what money is owed.

**Lonja.** The wholesale fish market where a distributor buys.

**Tier.** A named group of customers who are charged the same way. Example: "Tarifa 2".

---

## 2. Rules that apply to the whole catalogue

1. Dimensions do not affect each other. How a company sets prices does not change how goods
   arrive at its warehouse. This means the amount of work is the sum of the dimensions, not the
   product of them.
2. Every situation has exactly one job.
3. If a situation needs a control that already exists in another situation, it reuses that
   control and the card says which one.
4. Some configurations produce no screen at all. This is a normal outcome and is described in
   section 6.
5. When a screen implies a policy, check whether that policy is actually a dimension. In this
   product it usually is.

### The error that produced rule 5

An earlier version of this catalogue showed an order screen with a button labelled *Confirmar
pedido*. That button assumes the company wants a person to check every order before it proceeds.
Some companies want that. Others want orders to proceed automatically and only want to be shown
the ones the software could not read. Others want automatic processing except for customers who
have never ordered before.

Whether an order is reviewed is therefore not a fact about the product. It is a choice the
company makes, which makes it a dimension. See D2.

---

## 3. Statements that are settled and must not be contradicted

**Rocoto produces two things.**

1. The preparation sheet. This lists what the warehouse staff need to pick. It is produced for
   every company. It requires no connection to any other system, no price list, no stock records
   and no cooperation from any software vendor. It works on the first day at every company in
   this industry.
2. The order data. This is sent to the company's existing accounting system, which produces the
   invoice.

**The albarán states what was sent. The factura states what is owed.** Only the factura requires
prices. This is the reason prices can remain entirely inside the company's existing system if
they prefer.

**In Spain there is no law requiring an albarán to be issued, and no law specifying what it must
contain.** It is a voluntary commercial document. Rocoto may therefore generate it.

**Rocoto must never generate a factura.** Invoicing is regulated by Real Decreto 1619/2012, and
software that issues invoices falls under Real Decreto 1007/2023, known as VeriFactu, which
requires certified software producing tamper-evident chained records. By stopping below the
invoice, Rocoto stays outside that regulation completely.

**There is no live two-way synchronisation with the customer's accounting system.** Rocoto already
holds everything the invoice needs, because Rocoto produced the albarán. That information is sent
as one file, once, at the end of the day, in whatever format the accounting system accepts.

**Cost and price are two separate fields.** Cost is the amount the distributor paid. Price is the
amount the distributor charges. A price may be calculated from a cost, or it may be set
independently. They must never be stored or displayed as one thing.

**A tier is a count, not a different system.** A price list or a margin can be a single value for
all customers, or a set of values with customers assigned to each. Eight tiers requires the same
code as one tier.

---

## 4. The dimensions

There are seventeen.

### D1 — Which channels orders arrive on

Some companies receive orders on one channel only. Most receive them on several. A channel that
is switched off does not appear anywhere in the product.

| Configuration | Meaning |
|---|---|
| `D1.whatsapp` | Text messages, voice notes and photographs sent to a WhatsApp number |
| `D1.phone` | Telephone calls, recorded and transcribed |
| `D1.email` | Email, including attachments such as spreadsheets or PDFs |
| `D1.inperson` | An order taken face to face at the market stall and typed in by staff |
| `D1.portal` | A web page where the customer types their own order |

More than one may be selected. All selected channels produce entries in the same list, and
messages from the same customer about the same order stay attached to that order regardless of
which channel each message arrived on.

### D2 — Which orders a person checks before they proceed

| Configuration | Meaning |
|---|---|
| `D2.all` | Every order is checked and confirmed by a person |
| `D2.exceptions` | Only orders containing something the software could not resolve |
| `D2.new-customers` | Orders from established customers proceed automatically; orders from senders never seen before are held |
| `D2.threshold` | Orders above a value or quantity set by the company are held |
| `D2.none` | No order is held. The software records everything and a person reviews afterwards if they wish |

### D3 — What kinds of work appear in the review list

Review is not one activity. Companies differ in which of these they want in one place.

| Configuration | Meaning |
|---|---|
| `D3.confirm` | Approving an order that has been interpreted correctly |
| `D3.edit` | Changing lines on an order before it proceeds |
| `D3.reply` | Answering a customer's question that is not an order — availability, price, a complaint, a delivery time |
| `D3.resolve` | Deciding something the software could not decide, such as which of three similar products was meant |
| `D3.setup` | Recording a preference discovered during an order, such as which variety a customer always takes |

A company that selects `D3.reply` is asking Rocoto to hold the whole conversation. A company that
does not is asking Rocoto to handle only orders and to pass everything else to a person outside
the system.

`D3.setup` deserves particular attention. Preferences are usually discovered while an order is
being handled, not during a setup process. The product must allow a preference to be recorded at
the moment it is learned, and must also allow the same preferences to be edited later on a page
belonging to that customer.

### D4 — What a customer is allowed to order

This dimension controls how strictly an incoming order must match the distributor's catalogue.

| Configuration | Meaning |
|---|---|
| `D4.sku-only` | Only products in the catalogue, exactly as they appear there. Anything else is rejected or held |
| `D4.sku-plus-note` | Products from the catalogue, with free text attached to a line that a person will read. Example: "el aguacate bien maduro" |
| `D4.sku-plus-class-any` | Products from the catalogue, and the customer may name a class even if that class is not recorded in the catalogue. The class becomes information attached to the line |
| `D4.sku-class-restricted` | Products from the catalogue, and the customer may name a class, but only classes that exist in the catalogue for that product |
| `D4.sku-plus-type` | Products from the catalogue, and the customer may name a type or variety. Functionally the same as a note, but recorded as a named field rather than free text |

`D4.sku-plus-class-any` and `D4.sku-plus-type` behave almost identically. They are listed
separately because the words used in this industry are not interchangeable, and a screen that
says "clase" to a company that says "tipo" will be read as wrong. The underlying control is the
same; the label differs.

### D5 — What units a customer is allowed to order in

| Configuration | Meaning |
|---|---|
| `D5.sku-unit-only` | Orders must use the unit recorded in the catalogue. A customer asking for kilos of a product sold in boxes is held for a person |
| `D5.any-unit` | Orders may use any unit. Rocoto converts using a stored ratio |

Under `D5.any-unit`, a conversion that Rocoto has not seen before does not get guessed. The line
goes to the review list, a person supplies the ratio once, and the ratio is stored against that
product and used automatically from then on.

### D6 — How precisely a product must be identified

| Configuration | Meaning |
|---|---|
| `D6.item` | The product name alone is sufficient |
| `D6.item-sort` | The product name and its origin or variety are both required. Example: "mango de barco" as distinct from "mango de avión" |
| `D6.item-sort-class` | Product name, origin and grade are all required |

A company that sells one grade of one origin of each product needs none of this. A company at a
wholesale fruit market usually needs all of it.

### D7 — How cost is recorded

Cost is what the distributor paid.

| Configuration | Meaning |
|---|---|
| `D7.market-voice` | Discovered at the market each morning and spoken aloud into the phone |
| `D7.doc-digital` | Taken from a supplier's albarán that arrives by email |
| `D7.doc-paper` | Taken from a supplier's albarán that arrives on paper with the goods |
| `D7.contract` | An agreed price that stays the same for weeks or months |
| `D7.none` | Not recorded in Rocoto at all |

### D8 — How the selling price is arrived at

| Configuration | Meaning |
|---|---|
| `D8.list` | A written price list, not calculated from cost. Changed occasionally |
| `D8.margin` | Cost plus a percentage. Requires D7 to be something other than `none` |
| `D8.negotiated` | Agreed with the customer each time an order is placed. No rule exists that could calculate it |
| `D8.none` | Prices are not held in Rocoto. They stay in the company's accounting system. **This is the default** |

### D9 — How many prices or margins exist

| Configuration | Meaning |
|---|---|
| `D9.one` | One price list, or one margin, applying to every customer |
| `D9.many` | Several, with each customer assigned to one of them |

This applies to both `D8.list` and `D8.margin`. It must not produce a separate screen; it adds
columns or rows to the same screen.

### D10 — Agreements that apply to one customer only

This dimension covers arrangements a distributor makes with an individual customer that override
the general rule. More than one may apply at the same time, and they may apply to some products
and not others.

| Configuration | Meaning |
|---|---|
| `D10.none` | Every customer is charged according to the general rule and their tier |
| `D10.fixed-override` | A specific price is agreed with a specific customer for a specific product, and it replaces whatever the general rule would produce |
| `D10.fixed-with-volume` | A specific price is agreed on condition the customer buys an agreed quantity over an agreed period. If they buy less, the arrangement lapses or the price reverts |
| `D10.restricted-catalogue` | The customer may only order an agreed subset of products, because that is what the distributor has undertaken to supply them |
| `D10.tier-assignment` | The customer is assigned to a tier, and receives whatever that tier's price is at the time of ordering. Under `D8.margin` this means the customer receives that tier's margin applied to today's cost |

`D10.fixed-with-volume` is worth stating plainly because it appears in companies whose prices
otherwise change daily. A distributor buying at a market where costs move every morning may still
agree a fixed price with one large customer, accepting the risk in exchange for guaranteed
volume. The product must be able to hold a fixed price inside a company that is otherwise
entirely cost-plus, and must show the person setting it what today's cost implies about that
fixed price — that is, whether the arrangement is currently profitable.

### D11 — How stock is recorded

| Configuration | Meaning |
|---|---|
| `D11.supplier-doc` | From purchase documents, digital or paper |
| `D11.declared` | Somebody states a quantity aloud. No document exists |
| `D11.published` | A list of what is available is sent to customers each morning, and orders are placed against that list. The list is the stock record |
| `D11.none` | No stock position is kept. Goods are recorded at the moment of sale. **This is the default** |

### D12 — Whether batch numbers are recorded

| Configuration | Meaning |
|---|---|
| `D12.all` | Every line carries a batch number |
| `D12.fish-only` | Only fresh fish, which additionally carries scientific name, catch area, fishing gear, whether wild or farmed, and whether fresh or defrosted |
| `D12.none` | Batch numbers are not recorded |

Under `D12.all` and `D12.fish-only`, a single line may need to draw on two or more batches when
one batch does not contain enough. Different batches were bought at different costs, so the
division changes the profit on that line.

### D13 — Whether goods are weighed before dispatch

| Configuration | Meaning |
|---|---|
| `D13.as-ordered` | The quantity ordered is the quantity charged |
| `D13.weigh-some` | Certain products are weighed, and the weight that leaves differs from the quantity ordered |
| `D13.weigh-all` | Everything is weighed |

Applying to all three: goods held at one grade may be sent as another grade. Example: stock
recorded as class B may be sent to a customer as class A. Both the grade held and the grade sold
must be retained, because the difference is the difference between the cost and the price.

### D14 — Who produces the albarán

| Configuration | Meaning |
|---|---|
| `D14.rocoto` | Rocoto produces it, with batch and traceability fields already filled in |
| `D14.erp` | The company's existing system produces it, from data Rocoto sends |

### D15 — How the albarán reaches the customer

| Configuration | Meaning |
|---|---|
| `D15.paper` | Printed and handed over with the goods |
| `D15.link` | A link is sent to the customer. They open it and read the albarán in a web page |
| `D15.link-export` | As `D15.link`, and the page offers buttons that add the albarán to the customer's own system in that system's own format, with no account and no login required |
| `D15.connected` | The customer has authorised a connection once, and every albarán afterwards arrives in their system automatically |

`D15.link-export` requires explanation because it is the most valuable and least obvious of these.

Restaurant and café businesses keep their own records of what they have bought, usually in a
cost-control system. Today, somebody at the restaurant reads each supplier's albarán and types it
into that system by hand. This is the same manual retyping problem that Rocoto solves for the
distributor, occurring one step further down the chain.

Under `D15.link-export`, the customer receives a link, opens it, sees the albarán, and sees a row
of buttons: one per system Rocoto knows how to produce a file for. Pressing one downloads or
transfers a file already in that system's expected format. No account is created and nothing is
authorised. It works the first time, immediately, with no setup by anybody.

`D15.connected` is the same idea with a one-time authorisation, after which nothing needs pressing
at all.

The commercial reason for building this is not that it saves the customer time. It is that a
distributor whose albaranes can be absorbed without retyping becomes easier to buy from than a
distributor whose albaranes cannot. That is a reason for restaurants to choose that distributor,
which is a stronger argument to sell to the distributor than any internal saving.

The list of target systems must be data, not code. Adding a new one must not require changes to
any screen.

### D16 — When the albarán is sent to the customer

| Configuration | Meaning |
|---|---|
| `D16.on-confirm` | At the moment the distributor marks the albarán as confirmed |
| `D16.on-delivery` | Only once the goods are confirmed as delivered |

`D16.on-delivery` exists because some customers do not want a document in their records for goods
that have not yet arrived.

### D17 — Who confirms that a delivery happened

This dimension is only asked when D16 is `on-delivery`.

| Configuration | Meaning |
|---|---|
| `D17.driver` | Drivers are recorded in Rocoto. Each driver sees their stops in order, marks each one as delivered, and can capture the customer's signature on the driver's phone |
| `D17.scheduled` | No drivers are recorded. Rocoto knows the delivery day and time slot from the order and treats the scheduled time as the confirmation |

`D17.scheduled` exists so that a company can have delivery-triggered sending without adopting a
driver application. The driver application is the heaviest part of the product to introduce into a
working business and must never be a requirement for anything else to function.

---

## 5. The primitives

| ID | Name | Description |
|---|---|---|
| `U01` | Choice chips | Two to four candidate answers, ordered by what this customer has chosen before. One press. The answer is stored and not asked again |
| `U02` | Voice rows | The user holds a button and speaks. Rows appear as words are recognised. Anything not understood appears in amber with the recording attached for replay |
| `U03` | Prefill from last time | Yesterday's values and the same day last week offered as one-press starting points |
| `U04` | Split slider | A quantity divided by dragging a boundary. It is not possible to create or lose units by dragging |
| `U05` | Ratio lock | One slider moves a set of related values while preserving the proportions between them |
| `U06` | Camera capture | One photograph, edges detected automatically. Values that cannot be read are requested by voice rather than by keyboard |
| `U07` | Document beside rows | Extracted lines on one side, the original document on the other, with the matching text highlighted in the original |
| `U08` | Cell grid | A table resembling a spreadsheet. Used for values changed rarely. Includes bulk editing and a marker on rows not changed for a long time |
| `U09` | Empty-slot queue | Items awaiting a value, grouped by customer, completed in one pass. The empty value is shown as empty and never as zero |
| `U10` | Dual value | Two related values on one line: quantity ordered and quantity sent, or grade held and grade sold. Both are kept and both are shown |
| `U11` | Change notice | States that something has changed and lists exactly which records are affected. Never alters anything automatically |
| `U12` | Absent | No screen, no menu entry, and no disabled button |
| `U13` | Export buttons | Customer-facing. A row of buttons, one per target system, each producing a file in that system's format. No account required |
| `U14` | Connection handshake | Customer-facing. Choose a target system once, authorise, and receive future documents automatically |
| `U15` | Drop list | Driver-facing. Today's stops in route order, each marked as delivered, with optional signature capture |

---

## 6. Configurations that produce no screen

When a dimension is configured off, the corresponding part of the product does not exist. It is
not disabled and it is not greyed out. A menu containing entries a company will never use is a
monthly reminder that they are paying for something they do not use.

`D8.none` means there is no prices screen anywhere in that account.
`D11.none` means there is no stock screen.
`D12.none` means the word "lote" does not appear.
`D17` is not asked at all when `D16.on-confirm` is selected.

---

## 7. Situations to render

Each entry below becomes one card. Render the actual screen, not a description of it. Every card
states the condition as an explicit `IF`, the job in one sentence, the screen, and which
primitives it reuses.

### Group A — An order arrives
- **A1** `D2.all` — confirm an order that has been interpreted from a message.
- **A2** `D2.exceptions` and nothing unresolved — see that an order proceeded without me. No
  primary button. This is A1 with the button removed, and that difference is the reason the card
  exists.
- **A3** `D2.exceptions` and one line unresolved — resolve the line that could not be read.
- **A4** `D2.new-customers` and an unknown sender — decide whether this sender becomes a customer.
- **A5** `D2.threshold` exceeded — approve an unusually large order. Show what makes it unusual,
  such as this customer's normal order size.
- **A6** `D6.item-sort` or stricter, and the message did not specify — say which product was
  meant, once. `U01`. Show the evidence behind the ordering of the options.
- **A7** `D5.any-unit`, conversion known and exact — see what will actually be sent and why.
- **A8** `D5.any-unit`, conversion known but not a whole number — choose the quantity over or
  under, and tell the customer. `U01`. Never round silently.
- **A9** `D5.any-unit`, conversion not known — supply the conversion once. `U01`.
- **A10** `D4.sku-plus-note` — an order line carrying free text a person must read.
- **A11** `D4.sku-class-restricted` and the customer named a class not in the catalogue — correct
  or reject the class. `U01`.
- **A12** `D10.restricted-catalogue` and the customer ordered something outside their agreed list
  — decide whether to supply it anyway.
- **A13** the customer changes an order already recorded — see what the change affects. `U11`.

### Group B — Cost
- **B1** `D7.market-voice` — record today's costs quickly, outdoors, with cold hands. `U02` and
  `U03`. Show the change against yesterday on each line.
- **B2** `D7.doc-digital` — check that the supplier's document says what the software read.
  `U07`.
- **B3** `D7.doc-paper` — record a paper document while the lorry is still at the loading bay.
  `U06` then `U02`. The photograph is retained against the batch.
- **B4** `D7.contract` — update agreed costs a few times a year. `U08`.

### Group C — Price
- **C1** `D8.list` with `D9.one`, and **C2** with `D9.many` — revise a price list. `U08`. The
  second has one column per tier and is otherwise identical.
- **C3** `D8.margin` with `D9.one` — set today's margin and see the resulting price.
- **C4** `D8.margin` with `D9.many` — move every tier at once without changing the relationship
  between them. `U05`. Show how many customers are in each tier.
- **C5** a price changed after orders were recorded at the previous price — decide what to do
  about those orders. `U11`. List the customers, the times, and the difference in euros. Offer
  "leave them as they are" as the first option.
- **C6** `D8.negotiated` — supply prices for everything waiting for one customer in one sitting.
  `U09`. Show the cost and the margin agreed with that customer last time.
- **C7** two tiers could both apply to one customer — decide which tier applies, once. `U01`.
- **C8** `D10.fixed-override` — set a fixed price for one customer and one product. Show what
  the general rule would have produced, so the size of the exception is visible.
- **C9** `D10.fixed-with-volume` — set a fixed price conditional on an agreed quantity. Show
  progress against the agreed quantity and, when cost has moved, whether the arrangement is
  currently profitable at today's cost.
- **C10** `D10.fixed-with-volume` and the customer is behind on the agreed quantity — decide
  whether the arrangement continues.

### Group D — Stock
- **D1s** `D11.declared` — record what arrived when there is no document. `U02`.
- **D2s** `D11.published` — publish today's availability, which also becomes today's stock
  record. `U02`, `U03`, and a send action. State on the screen that sending is what makes it the
  stock.
- **D3s** `D11.published`, a product is exhausted, and a customer asks for it — offer an
  alternative immediately. Order the alternatives by what this customer has bought before and
  show the margin on each. This is the only screen in the product that increases revenue rather
  than reducing work.
- **D4s** an order exceeds the quantity available — `U11`, then D3s.

### Group E — Batches
- **E1** `D12.all`, and the line fits in one batch — no action required. The oldest batch fills
  the line automatically. Render this to show how little happens in the ordinary case.
- **E2** a line requires two or more batches — divide the quantity. `U04`. Because batches were
  bought at different costs, recalculate and display the blended cost and the resulting margin
  as the boundary is dragged. A third batch adds a second boundary.
- **E3** `D12.fish-only` — no action required. Traceability information attaches to the batch
  once and prints on every albarán drawing on that batch.

### Group F — Dispatch
- **F1** `D13.weigh-some` or `D13.weigh-all` — record what actually left. `U10`.
- **F2** the weight of a box of a product is not yet known — supply it once. `U01`.
- **F3** goods held at one grade are sent as another — record both. `U10`. Show cost and selling
  price on the line so the effect on margin is visible at the moment of the decision.

### Group G — Producing the albarán
- **G1** `D14.rocoto` — check it once, change anything necessary, and send it. Batch and
  traceability fields are already filled. The editable moment exists for things software cannot
  know, such as a note for the driver.
- **G2** `D14.erp` — confirm that the data reached the accounting system.
- **G3** no connection to the accounting system yet — the same screen as G2, with a file instead
  of a direct write. State that this is a normal arrangement and not a failure.

### Group H — Delivering the albarán to the customer
- **H1** `D15.paper` — print it. The layout matters because it is read on a loading bay.
- **H2** `D15.link` — send a link and see whether it was opened, by whom, and when.
- **H3** `D15.link` seen from the customer's side — read the albarán without an account.
- **H4** `D15.link-export` seen from the customer's side — add this albarán to my own system.
  `U13`. A row of buttons, one per target system. No account, no authorisation, works the first
  time.
- **H5** `D15.connected`, first time — authorise once and stop typing albaranes. `U14`.
- **H6** `D15.connected`, ordinary operation — no action required. A record on the distributor's
  side showing which albaranes reached which customer systems. Render it to show that in the
  finished state nobody is doing anything.

### Group I — Timing and delivery confirmation
- **I1** `D16.on-confirm` — one control on the albarán screen.
- **I2** `D16.on-delivery` with `D17.scheduled` — see the delivery time the software inferred
  from the order and change it if wrong.
- **I3** `D16.on-delivery` with `D17.driver` — mark stops as delivered. `U15`. Used one-handed,
  in a vehicle, possibly in rain. Stops in route order, large targets.
- **I4** signature capture — obtain a signature on the driver's phone.
- **I5** the distributor's view of a round in progress — see which drops have been completed.
  Only drops still outstanding after a set hour should be visually distinct.

### Group J — Customer records
- **J1** a customer's page — see and change everything the software has learned about this
  customer: preferred varieties, tier, agreed prices, restricted catalogue, delivery address,
  contact numbers, delivery days.
- **J2** recording a preference discovered during an order — store it without leaving the order.
  `D3.setup`.

### Group K — Configurations producing no screen
- **K1** `D8.none`, **K2** `D11.none`, **K3** `D12.none`, **K4** `D17` not asked.
  One card showing a menu with those entries absent rather than disabled. The job is nothing,
  and that is the point.

---

## 8. Reduction

After rendering every situation, examine them and report which are the same. Use these three
categories:

**Identical screens.** Example: B3, which records cost from a paper document, and the equivalent
stock situation are the same screen with a different destination.

**Identical apart from a column.** Example: C1 and C2. D9 must never produce a second screen.

**Identical apart from one control.** Example: A1 and A2 differ only in the presence of a primary
button. This is the clearest evidence that review is a dimension rather than a feature.

Where situations converge, show the screen once and annotate it, rather than rendering it twice.
At the end of the output, state two numbers: how many situations were written, and how many
screens are actually required.

---

## 9. How to build it

- One self-contained HTML file. No build step, no external files, no content delivery networks.
- Scrollable, with group headings matching section 7.
- Each card: the `IF` condition, the job in one sentence, the rendered screen, and the primitives
  reused.
- Text inside screens is in Spanish. Conditions, jobs and annotations are in English.
- `U04` and `U05` must be draggable. The split slider must recalculate blended cost and margin
  while being dragged.
- `U13`, `U14` and `U15` are the only parts of the product used by somebody other than the
  distributor's own staff. Make that distinction visible in the design rather than only stated.
- Use these names throughout. Products: Merluza, Gamba roja de Palamós, Pulpo, Rape, Lubina de
  estero, Mango de barco, Aguacate Hass. Customers: Bar Manolo, Can Solé, Hotel Rec, Restaurant
  Nou, Distribuciones Vera. Supplier: Pescados Rubio. Batches: L-2208, L-2211, L-2214.

## 10. Questions to raise rather than answer

List these at the end of the output.

1. How often does a single line require two batches? If it is twice a day, `U04` is a
   convenience. If it is forty times a day, it is the reason a company buys the product. This has
   not been measured.
2. Do companies record batch numbers in practice, or does the field exist in their accounting
   system and remain empty?
3. Is there a method of recording stock not covered by D11?
4. Does any real company want `D2.none`, meaning no review of any order?
5. For `D15.link-export`, which cost-control systems used by restaurants accept an imported file,
   and what format does each expect? This determines whether the most commercially valuable idea
   in this document can be built now or not.
6. Under `D10.fixed-with-volume`, what happens when the customer does not reach the agreed
   quantity? Does the price revert, is a difference invoiced, or is it simply renegotiated? This
   varies by company and has not been established.