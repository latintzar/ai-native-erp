# Stripe V2 — historical implementation and recovery reference

**Status: historical, written August 2026.** The sections below record the original rollout and
contain superseded paths, public-pricing claims, tax assumptions and cadence descriptions.
The executable backend and its tests describe the implemented billing behavior.

[`backend/pricing.json`](../pricing.json) preserves that implementation's catalogue input, recovered
from product tag `v0.196.0` on 2026-09-07. Both provisioning scripts read this backend-owned file;
`tests/vital_term_split.py` checks it against current billing constants and compares their generated
term prices without contacting Stripe. Its restored data changes neither runtime prices nor
existing agreements.

Current commercial intent is recorded in the company’s
[14-day trial decision](../../docs/omitted-sources.md).
Use [engineering readiness](../../docs/ENGINEERING-READINESS.md) and
[the current deployment runbook](../../docs/omitted-sources.md) for release work. The old
commissioning sequence below is retained as recovery history; provider work requires the current
target and authorization to be established. CLI dry runs in these scripts still contact Stripe.

> «i spent all day figuring out this pricing.» — Peter, 2026-08-14
> «you have to do it all, no honest read. the 15 % will absolutely have to be done» — same day
> «my first customer will get an order quantity bundle so they prepay it all rather than go on metered»
> «carlos gets sent his own link and his own stripe link, so that we can do the public one and still
> score him without changing what i quoted him already.»

Original context, 2026-08-14: `product/PRICING-COPY-ES.md` described the customer-facing wording
for the rollout recorded below. That former monorepo path is retained here as provenance.

---

## 0. What changed, in one paragraph

**OUT:** one plan whose price bought a monthly order ceiling — 249 € up to 1.500 pedidos, and Stripe
charged the whole 3-month minimum term at once. **IN:** a seat band (Pequeño 199 € · Mediano 499 € ·
Grande 1.499 €, a month, sin IVA) plus a published per-order rate (0,60 / 0,50 / 0,40 €) plus modules
you turn on (Compras · Reparto · Radar). Nothing caps how many orders enter, «los pedidos se facturan
a mes vencido», and «Sin permanencia» — so the seat bands bill monthly with no committed term, while
the retired ceiling bands keep their three-month one. That difference is a single derived field,
`min_term_months` in `brain/pedidos_billing.py`'s BANDS, and it drives the Stripe `interval_count`,
the Checkout charge and whether `_on_checkout_completed` stamps a `minimum_term_end` at all.

Nothing can be bought under the new model until step 3 below runs: the `pedidos_peq_*` lookup keys do
not exist, so `create_checkout_session` fails closed with `catalogue_not_provisioned`. That is the
safety net this plan is dismantling on purpose — do not dismantle any other one at the same time.

---

## 1. Every object that will be created

Run `python3 scripts/provision_stripe_v2.py --mode <test|live> --dry-run` to see this table against
live Stripe. Amounts are **sin IVA** (`tax_behavior="exclusive"`, immutable for the life of a price;
21 % is added at Checkout by the manual `pedidos_iva_es` TaxRate).

### Products — 8

| product_key | name | why |
|---|---|---|
| `pedidos_peq_product` | Rocoto Ventas Pequeño | keeps the old script's `pedidos_product_key` metadata name — `brain/pedidos_billing._product_key()` builds it |
| `pedidos_med_product` | Rocoto Ventas Mediano | " |
| `pedidos_gra_product` | Rocoto Ventas Grande | " |
| `compras_product` | Rocoto Compras | one product, six prices (3 bands × 2 cadences) |
| `reparto_product` | Rocoto Reparto | one product, two prices; the van COUNT is the item quantity |
| `radar_product` | Rocoto Radar | **no price** — see §5. It exists so the invoice line has a stable identity in Stripe reporting |
| `bundles_product` | Rocoto — pedidos por adelantado | the three prepaid bundles |
| `founder_carlos_product` | Rocoto — Carlos (precio fijado) | one product per pinned customer, so their invoice line says who they are |

### Billing Meter — 1

| event_name | aggregation | value key | customer mapping |
|---|---|---|---|
| `rocoto_pedido` | `sum` | `value` | `by_id` on `stripe_customer_id` |

`stripe.UsageRecord` was removed from the SDK (15.0.1, API `2026-03-25.dahlia`); metered usage is
reported with `stripe.billing.MeterEvent`, and a metered price must name a meter. `sum` of an explicit
`value` rather than `count` of events, so the reporter can batch later without a new meter.

### Prices — 21

**Ventas — the seat band** (licensed, quantity 1)

| lookup_key | amount | cadence |
|---|---|---|
| `pedidos_peq_mensual` | 199,00 € | 1 month |
| `pedidos_peq_anual` | 1.990,00 € | 1 year |
| `pedidos_med_mensual` | 499,00 € | 1 month |
| `pedidos_med_anual` | 4.990,00 € | 1 year |
| `pedidos_gra_mensual` | 1.499,00 € | 1 month |
| `pedidos_gra_anual` | 14.990,00 € | 1 year |

Annual is ten months — «Pago anual: dos meses gratis». The script derives that 10 from BANDS and
refuses to run if the bands disagree about it, rather than carrying a second copy of the rule.

**Ventas — the per-order rate** (metered, monthly, in arrears)

| lookup_key | amount | cadence |
|---|---|---|
| `pedidos_peq_orders` | 0,60 € | 1 month, metered → `rocoto_pedido` |
| `pedidos_med_orders` | 0,50 € | 1 month, metered → `rocoto_pedido` |
| `pedidos_gra_orders` | 0,40 € | 1 month, metered → `rocoto_pedido` |

⚠️ **One subscription, one interval.** Stripe requires every recurring item on a subscription to
share an interval. So the monthly metered item rides with the **mensual** seat price, and an **anual**
tenant's orders go on a *second, monthly* subscription against the same price object. The split is a
subscription-shape fact, not a catalogue one — §4 says how to build it.

**Compras — «la mitad de tu plan»**

| lookup_key | amount | cadence |
|---|---|---|
| `compras_peq_mensual` / `_anual` | 99,00 € / 990,00 € | 1 month / 1 year |
| `compras_med_mensual` / `_anual` | 249,00 € / 2.490,00 € | 1 month / 1 year |
| `compras_gra_mensual` / `_anual` | 749,00 € / 7.490,00 € | 1 month / 1 year |

**Reparto — «39 €/furgoneta»** (licensed; the number of vans is the item's `quantity`, so adding a
van is a quantity update, never a new price)

| lookup_key | amount | cadence |
|---|---|---|
| `reparto_van_mensual` | 39,00 € | 1 month |
| `reparto_van_anual` | 390,00 € | 1 year |

**Prepaid order bundles** (one-off, no `recurring`; the allowance rides in metadata)

| lookup_key | amount | metadata |
|---|---|---|
| `pedidos_bundle_5000` | 2.250,00 € | `orders=5000 rate_cents=45 valid_months=12` |
| `pedidos_bundle_10000` | 4.200,00 € | `orders=10000 rate_cents=42 valid_months=12` |
| `pedidos_bundle_25000` | 10.000,00 € | `orders=25000 rate_cents=40 valid_months=12` |

**Pinned founder price** (§7)

| lookup_key | amount | cadence |
|---|---|---|
| `founder_carlos_trimestre` | 1.347,00 € | 3 month |

### Payment Links — 1 (conditional)

One link per pinned price that asks for it. It **refuses to be created** in two cases, each of which
produces something worse than no link:

* the roster entry has no `tenant_slug` → the session would carry no tenant and
  `_on_checkout_completed` ignores it; the customer pays and is provisioned nothing;
* Stripe Tax is inactive → a payment-link line item has no `tax_rates` field, so `automatic_tax` is
  the only route to 21 %, and a Spanish company invoiced without IVA cannot reclaim it.

Both are printed by the dry run. **Fix the roster first; turn Stripe Tax on second.**

---

## 2. What gets archived

**Nothing, unless you pass `--archive-retired`.** The default run is create-only.

`--archive-retired` sets `active=False` on the ceiling-model prices — `pedidos_s_*`, `pedidos_m_*`,
`pedidos_l_*`, `pedidos_xl_*` (mensual, anual, alta). It is a tidy-up so nobody sells a retired band
from the dashboard, and it is opt-in because the new catalogue does not need it.

**Archiving is not cancelling.** Stripe keeps billing an archived price on a subscription that already
holds it; `active=False` only removes it from pickers and stops new sales. A tenant on a ceiling band
is untouched — same amount, same cadence, same renewal. The portal has price switching disabled
(`PORTAL_FEATURES`), so no customer can walk themselves onto an archived price either.

**The `founder_` namespace is never archived, by any flag.** Asserted in the archive loop, not
remembered.

---

## 3. Wiring the per-order metering (route 1)

The catalogue half is done by the script. The reporting half is one new module and one migration.

### 3a. What already exists

`backend/pedidos_meter.py` counts orders today. `pedidos_order_usage (tenant_id, order_id,
counted_status, counted_at)` carries a UNIQUE `(tenant_id, order_id)` row, written the first time an
order reaches `approved` or `sent`, by `record_order()` on the direct paths and by `reconcile()` as
the safety net for the six call sites this codebase does not own. **That table is already
exactly-once per order, forever** — it is the right thing to bill from, and no second counter should
be invented.

### 3b. The migration — TWO ALTERs, per THE MIGRATION LAW

`schema_runtime.sql` is 100 % `create table if not exists`, applied fail-soft at boot. **Editing the
create-table block to add a column is a silent no-op on prod.** So each column gets its own explicit
statement, next to the existing `alter table pedidos_subscription add column if not exists
welcomed_at timestamptz;` precedent:

```sql
alter table pedidos_order_usage add column if not exists reported_at timestamptz;
alter table pedidos_order_usage add column if not exists billed_via  text;
```

**LANDED 2026-08-15**, plus the partial index the reporter's one hot query needs
(`idx_pedidos_order_usage_unreported ... where reported_at is null`), so the scan stays proportional
to the unsettled backlog rather than to every order ever counted.

No `schema_rls.sql` change: `pedidos_order_usage` is tenant_id-keyed and already carries its explicit
grant in the last block (`grant select, insert, update, delete on pedidos_subscription,
pedidos_order_usage, pedidos_webhook_events to rocoto_rt;`). Adding a column to a granted table needs
no new grant.

### 3c. The reporter — `backend/brain/pedidos_usage_report.py`

**BUILT 2026-08-15** as `backend/brain/pedidos_usage_report.py`, started from `app.py`'s boot event
beside `pedidos_meter.reconcile_loop()`, and runnable by hand:
`python3 -m brain.pedidos_usage_report [--once] [--dry-run] [--tenant SLUG]`. Kill switch without a
deploy: `PEDIDOS_USAGE_REPORT_ENABLED=0` (the meter keeps counting, so nothing is lost while it is
off). One correction to the pseudocode below, and it is the important one — see the ⚠️ under it.

```
for each tenant with pedidos_subscription.status in ('active','past_due'):
    read the subscription's Stripe metadata once
    if metadata['orders_billing'] == 'included':   # a price that already includes their orders
        mark every unreported row billed_via='included:<founder>' , reported_at=now() ; continue
    for each pedidos_order_usage row where reported_at is null, oldest first:
        if a live prepaid bundle still covers it (§6):
            billed_via = 'bundle:<price_id>' ; reported_at = now() ; no Stripe call
        else:
            stripe.billing.MeterEvent.create(
                event_name = 'rocoto_pedido',
                payload    = {'stripe_customer_id': <cust>, 'value': '1'},
                identifier = f'ped_{tenant_id}_{order_id}',
                timestamp  = int(counted_at.timestamp()),
            )
            billed_via = 'metered' ; reported_at = now()
```

⚠️ **THE FOUNDER SENTINEL ABOVE WAS INVERTED, AND IT WOULD HAVE SUPPRESSED BILLING FOR EVERYONE.**
`metadata['metered'] == ''` reads as true for an ORDINARY customer too, because their subscription
carries no `metered` key at all and a missing key is indistinguishable from an empty one. Every
seat-band tenant on the platform would have been marked «already included» and never metered, all
month, while looking correct in Stripe. The flag is now a POSITIVE marker written on every Checkout —
`orders_billing` ∈ `included` | `metered`, `brain/founder_prices.ORDERS_BILLING_KEY` — and anything
unrecognised falls back to `metered`, which bills what the page quoted. Never key a decision that
moves money on the ABSENCE of a key.

Five rules the implementation must keep:

1. **Report to Stripe FIRST, mark the row second.** A crash between the two re-reports the order, and
   Stripe's `identifier` dedupe absorbs it. The other order double-bills a customer silently.
2. **`identifier` and `reported_at` are both needed.** Stripe's dedupe is only a rolling ~24 h window;
   `reported_at` is the permanent one. Neither alone is exactly-once.
3. **`timestamp` must be within the past 35 days** (Stripe's limit). An older row is marked
   `billed_via='stale'` and logged LOUDLY rather than reported at a wrong date — under-billing is the
   safe direction, silently mis-dated revenue is not.
4. **`config.EGRESS_SANDBOX` early-return.** A MeterEvent is a Stripe write, and every vital runs with
   `ROCOTO_EGRESS_SANDBOX=1`. Without the guard, `run_all_vitals.sh` reports usage against real
   customers.
5. **`.get()` on a Stripe object raises `AttributeError`** (SDK 15.x). Use `_sv` from
   `brain/pedidos_billing.py`.

### 3d. Subscription shape at Checkout

> **STATUS 2026-08-15 — STILL OPEN, AND IT IS THE LAST LINK IN THIS CHAIN.** The reporter now sends
> MeterEvents, but `create_checkout_session` still builds ONE line item (the seat price). Until the
> metered `pedidos_<band>_orders` item rides on the subscription, reported usage aggregates against
> the meter and bills **zero** — no double charge, no wrong charge, just no per-order revenue. The
> metadata half is done: every Checkout stamps `orders_billing` and the module flags, so the moment
> the item is added the reporter is already feeding it. What is left is the item itself, plus the
> annual case below (a second, monthly subscription — Stripe requires one interval per subscription).

* **mensual**: one subscription, two items — `pedidos_<band>_mensual` (qty 1) and
  `pedidos_<band>_orders` (metered, no qty).
* **anual**: subscription A holds `pedidos_<band>_anual`; subscription B holds
  `pedidos_<band>_orders` on its own, monthly. Same customer, both tagged
  `metadata.kind='rocoto_pedidos'`. `_on_checkout_completed` records A's id in
  `pedidos_subscription.stripe_subscription_id`; B's id belongs in the subscription metadata so the
  reporter and the portal can find it.
* **a founder or a live bundle**: **no metered item at all.** See §6 and §7 — this is the case that
  double-charges a named customer if it is left implicit.

---

## 4. Radar's 15 % — the `invoice.created` handler

A percentage is not a Price object, and it does not need to be. The standard Stripe shape for a
percentage surcharge on a variable bill is an **invoice item added to the draft invoice before it
finalises**. Radar is then always exactly 15 % of what they actually had that month, which is the
promise the page makes: «Se activa una vez y cubre todos los módulos que tengas contratados. Si un mes
vendes poco, cuesta poco.»

### 4a. The handler

**BUILT 2026-08-15** in `brain/pedidos_billing.py` (`_on_invoice_created`), routed from
`handle_webhook` alongside the five existing types. Read the code, not this sketch — one line of it
was wrong in a way that never raises:

⚠️ **`_sv(invoice, "subscription")` IS DEAD ON THIS SDK.** On stripe 15.0.1 / API
`2026-03-25.dahlia` an Invoice has **no top-level `subscription` field** — verified against the
installed package, not a doc: `stripe.Invoice.__annotations__` has no such key, and `_invoice.py`
declares `parent: Optional[Parent]` with `Parent.subscription_details.subscription`. `_sv` answers a
missing key with `None`, so the handler would have read every subscription invoice as «not a
subscription invoice», returned quietly, logged nothing, and billed Radar to nobody, forever. The
real path is `brain/pedidos_billing._invoice_subscription_id()`, which also normalises the expanded
form and still accepts the legacy field (a webhook arrives under whatever API version the ENDPOINT is
pinned to, which is dashboard state). `invoice.paid` was reading the same dead path and is fixed too.

```python
async def _on_invoice_created(obj, is_test):
    if _sv(obj, "status") != "draft":            return {"ignored": "not_draft"}
    inv_id  = _sv(obj, "id")
    sub_id  = _invoice_subscription_id(obj)      # ⚠️ NOT _sv(obj, "subscription") — see above
    cust_id = _sv(obj, "customer")
    if not (inv_id and sub_id):                  return {"ignored": "not_a_subscription_invoice"}

    st  = _stripe(is_test)
    sub = await asyncio.to_thread(lambda: st.Subscription.retrieve(sub_id))
    if (_sv(_sv(sub, "metadata") or {}, "kind")) != CHECKOUT_KIND:
        return {"ignored": "not_pedidos"}
    if (_sv(_sv(sub, "metadata") or {}, "radar")) != "1":
        return {"ignored": "radar_off"}          # GUARD 2 — skipped when the tenant has Radar off

    # GUARD 1 — idempotent per invoice. Stripe redelivers by contract, and a second add would
    # double the surcharge on a real bill.
    lines = await asyncio.to_thread(lambda: st.Invoice.list_lines(inv_id, limit=100))
    base = 0
    for ln in lines.data:
        if _sv(_sv(ln, "metadata") or {}, "rocoto_radar") == "1":
            return {"ignored": "radar_already_added"}
        base += int(_sv(ln, "amount") or 0)      # GUARD 3 — Radar excluded from its own base

    pct    = 15                                   # product/pricing.json → rates.radar_pct
    amount = round(base * pct / 100)
    if amount <= 0:                               return {"ignored": "nothing_to_surcharge"}

    iva = await _iva_tax_rate_id(st, is_test)
    if not iva:                                   return {"error": "handler_error"}   # never bill sin IVA

    await asyncio.to_thread(lambda: st.InvoiceItem.create(
        customer=cust_id, invoice=inv_id, quantity=1,
        description=f"Radar — {pct} % de la factura del mes",
        price_data={"product": <radar_product_id>, "currency": "eur",
                    "unit_amount": amount, "tax_behavior": "exclusive"},
        tax_rates=[iva],
        metadata={"rocoto_radar": "1", "kind": CHECKOUT_KIND,
                  "pct": str(pct), "base_cents": str(base)},
    ))
    return {"handled": "invoice.created", "radar_cents": amount}
```

`<radar_product_id>` is resolved once and cached the way `_iva_tax_rate_id` and
`_portal_configuration_id` already are — find the Product by `metadata['rocoto_product_key'] ==
'radar_product'`.

### 4b. The three guards, named

1. **Idempotent per invoice** — a line already tagged `rocoto_radar=1` aborts the whole handler.
   Stripe redelivers webhooks by contract; without this, a retry doubles a real charge.
2. **Skipped when Radar is off** — driven by `subscription.metadata.radar`, stamped at Checkout from
   the module selection. No schema change: the flag lives on the object Stripe already gives us.
3. **Excluded from its own base** — the base is summed from the lines, skipping any radar-tagged one,
   rather than read off `invoice.subtotal`. On a redelivery the subtotal would already include Radar,
   and 15 % of 115 % is a bill nobody agreed to.

### 4c. The dashboard step

`invoice.created` must be added to the enabled events on the `/api/stripe/webhook` endpoint in the
Stripe dashboard — the endpoint's event list is dashboard state, not code. Without it the handler is
never called and Radar silently never bills.

**Timing:** Stripe finalises a draft subscription invoice about an hour after `invoice.created`
(account setting). The handler runs well inside that window. If the account is ever set to finalise
immediately, this breaks — check `Settings → Billing → Subscriptions and emails` before go-live.

---

## 5. How a prepaid bundle suppresses metering

**THE FIRST REAL CUSTOMER TAKES THIS ROUTE, so it has to be right on day one.**

* A bundle is bought **two ways**, and both land on the same handler.
  1. **Beside the plan** (2026-08-16, the self-serve route): the bolsa the visitor picked on
     /precios rides the `mode="subscription"` Checkout as a **one-off line item** on
     `pedidos_bundle_<band>_<qty>`, which Stripe charges on the first invoice. This is the ordinary
     path now — the page quoted the bag, so the page's own Checkout buys it. Until that date the
     payload was `{band, cadence, modules, vans}` and the bag was **quoted and never charged**.
  2. **On its own**, as a one-off Checkout (`mode="payment"`) on the same price — the operator route,
     for a bag bought later.
* Either way the session carries `kind='rocoto_pedidos'`, `bundle_orders=<qty>`,
  `bundle_price=<price_id>` and `bundle_valid_months=<n>`, the last two read off the resolved Price
  so the catalogue stays the authority on what the bag holds and how long it lasts.
* On `checkout.session.completed`, stamp the tenant's **subscription metadata**:
  `orders_prepaid=<qty>`, `orders_prepaid_start=<iso>`, `orders_prepaid_expires=<start + 12 months>`,
  `orders_prepaid_source=<price_id>`, `orders_prepaid_session=<session_id>`. No new table: the
  balance is derivable and Stripe is where it belongs. **A session with a `band` is a plan starting**
  — it takes the plan path and stamps the bag after the subscription row exists; only a bandless
  session is a bare purchase. The session id is stamped because the balance STACKS, so a redelivery
  that was not fenced would double it.
* **Draw-down** = `count(pedidos_order_usage where tenant_id=? and billed_via like 'bundle:%' and
  counted_at >= orders_prepaid_start)`. While that count `< orders_prepaid` **and** `now() <
  orders_prepaid_expires`, an order is marked `billed_via='bundle:<price_id>'` and **no MeterEvent is
  reported**. Metering resumes on the first order after either condition fails.
* The metered subscription item may stay attached throughout — an item with zero reported usage bills
  zero. Simpler than adding and removing items, and it means the resume needs no Stripe write.
* «Válida 12 meses» is the expiry and `valid_months` in `pricing.json` is where the 12 lives.

**The framing, which the billing must not contradict:** a bundle is a discount for paying up front,
never a lower rate for that customer. Their plan's `per_order_cents` is unchanged; the bundle simply
runs out and the published rate takes over.

---

## 6. Pinned founder prices, and the fence

`brain/founder_prices.py` is the roster and the only place a pinned price is declared. Adding the next
locked customer is one entry there plus a re-run of the provisioning script — a data change, not a new
script.

**The problem it solves.** A Stripe Price is immutable, so moving a public figure means create-new +
`transfer_lookup_key=True` + archive-old. Any customer whose quote rides on a public lookup_key
therefore has their offer silently rewritten the next time the list moves. Peter has quoted a named
human 1.347 € for a quarter. That number must survive every future reprice untouched, and «remember
not to reprice Carlos» is not a mechanism.

**The mechanism.** Every pinned price's lookup_key starts with `founder_`, and
`founder_prices.is_protected()` is the one predicate both scripts import:

* `provision_stripe_v2.py` creates a `founder_` price **only** from the roster, refuses (exit 3) if any
  non-founder group ever produces such a key, never modifies or archives one, and prints the fence.
* `reprice_stripe_pedidos.py` refuses to create, modify or archive any `founder_` key — asserted at the
  write, not only filtered at the input — and prints the count of pinned prices it protected on every
  run, so the fence is visible rather than trusted.

**Carlos, concretely.** `founder_carlos_trimestre` · 1.347 € · `interval=month, interval_count=3` ·
`tax_behavior=exclusive` · metadata `founder=carlos quoted=2026-08-14 locked_until=2027-08-14
includes_orders=15000/quarter` · plus a Payment Link so Peter can send a URL.

**His quarter already includes his 15.000 orders**, so that subscription carries **no metered item and
no usage is ever reported against it**. That is modelled explicitly — `metered: False` on the price,
copied onto the session and the subscription as `orders_billing=included` — precisely because a
founder who quietly picked up a metered item on top of a prepaid quarter would be a named customer
charged twice for the same orders.

### 6b. A founder is a GLIDE PATH, and month 4 is a trap (2026-08-15)

Peter: «the price that I gave you is the price you get for the first three months, and then you also
get a discount for the year, locked, because of your trust in me. After that year you go to normal
pricing.» So Carlos has three periods, and `/propuesta/carlos` prints all three:

| | what he pays | how it bills |
|---|---|---|
| meses 1–3 | 1.347 € por adelantado | one all-in price, 15.000 pedidos inside it |
| meses 4–12 | 499 € plan + 249 € Compras + **0,25 €/pedido** | three prices, the last one metered |
| año 2 | the public list (3.248 €/mes at 5.000 pedidos) | nothing pinned — he is an ordinary customer |

**The trap.** `founder_carlos_trimestre` is a subscription price on a three-month interval: it
**renews**. Nothing in Stripe and nothing in this repo moves a customer from one period to the next,
so on the day month 4 arrives the quarter simply charges 1.347 € again — against a page he signed
from that says months 4–12 cost 1.998 €/mes at his volume. A page saying one number while the card is
charged another, to a named human, is the whole thing this namespace exists to prevent.

**Three prices, not one, and the reason is his volume.** 1.998 € is his bill at *exactly* 5.000
pedidos. A composite price pinned at that figure bills 1.998 € the month he sends 7.000 (he owes
2.498 €) and the month he sends 3.000 (he owes 1.498 €) — the second one overcharges him, every
month, against a page that told him the rate. So the period is modelled the way the public model
already is, with one rate replaced:

```
founder_carlos_mensual            499,00 €   1 month   licensed   ← Mediano's seat fee, pinned
founder_carlos_mensual_compras    249,00 €   1 month   licensed   ← «la mitad de tu plan», pinned
founder_carlos_mensual_orders       0,25 €   1 month   METERED    ← half Mediano's 0,50 €, locked
```

All three are **derived** from `BANDS['med']` rather than typed (`derive: band_mensual` /
`band_compras` / `band_per_order_discounted` with `discount_pct: 50`), so no price digit is written a
third time; the create-only script freezes them at mint time and reports DRIFT ever after. The
halving refuses a fractional cent rather than rounding one — half a cent on 5.000 pedidos is 25 € a
month nobody decided.

**`metered` lives on the PRICE, not on the roster entry**, because the same human is `included` for
months 1–3 and `metered` for months 4–12. An entry-level flag could not express his own deal, and the
copy of it that reaches Stripe is exactly the key `pedidos_usage_report.py` keys on.

**The switch is MANUAL and that is deliberate.** He is chaperoned; a scheduled repricing job nobody
asked for is a worse mechanism than Peter moving three line items with the roster in front of him.
The year-1 prices therefore carry **no Payment Link** — he already has a subscription, and a link
would mint a second one that bills him twice. What this work package guarantees is only that the
prices *exist*, inside the fence, before the quarter renews.

**At Checkout, a founder's own lines win over the public catalogue.** `create_checkout_session`
attaches `founder_carlos_mensual_orders` rather than `pedidos_med_orders` — reading the public key
there would bill him **0,50 €, double his locked rate**, on every order, while the plan line showed
the pinned figure and the invoice looked entirely normal. Same for Compras. `founder_prices.line_key()`
returns `''` for everybody else, so nothing changes for an ordinary tenant. His quoted period also
turns Compras **on** («Plan Mediano con Compras dentro»): the roster is the quote, exactly as it
already is for his band and his cadence.

⚠️ **One consequence to know.** `/propuesta/carlos` renders its «meses 4–12» row from `pricing.json`
every build, so a future reprice of Mediano moves the page's 499/249 and does **not** move these
pinned prices. The page would then quote *more* than Stripe charges him — the safe direction, and a
visible one — but it is a disagreement, and pointing the page at the pinned figures is Peter's call.

**At Checkout**, `create_checkout_session` resolves the roster before anything else, so a founder's
band and quoted cadence — not whatever the plan selector sent — are what gets validated and recorded.
`CADENCES` no longer gates them: `trimestre` is a real cadence for a founder and a bad one for
everybody else.

---

## 7. Historical commissioning commands

Run everything from `/root/leo/runtime`. The key comes from the environment and is
never printed. `/opt/rocoto/.env` on prod holds the live one.

### Step 0 — the offline gates (no Stripe, no network)

```bash
cd /root/leo/archive
python3 tools/check_pricing_sync.py        # pricing.json == BANDS, and Peter's own arithmetic
python3 tools/gen_pricing.py --check       # the webapp's generated table is current
```

Both must print `ok`. They run in `landing/deploy.sh` and block that deploy, so a failure here is a
failure everywhere.

### Step 1 — rehearse the whole thing in TEST

```bash
cd /root/leo/runtime
export STRIPE_SECRET_KEY_TEST=…            # from /opt/rocoto/.env, never echoed
python3 scripts/provision_stripe_v2.py --mode test --dry-run
```

Read the table. Every row should say `would create`. Any `DRIFT` line means a test price already
exists at a different amount or cadence — resolve it before going near live.

```bash
python3 scripts/provision_stripe_v2.py --mode test --yes
python3 scripts/provision_stripe_v2.py --mode test --dry-run   # second run: everything says `ok`
```

Idempotency is the acceptance test. A second dry run that is not all `ok` means something is not
keyed on its lookup_key.

### Step 2 — walk a real test purchase

With `PEDIDOS_STRIPE_MODE=test`, buy Pequeño mensual through `/plan` end to end. Check:
`checkout.session.completed` lands · `pedidos_subscription` row is `active` with `band='peq'`,
`orders_ceiling=0`, **`minimum_term_end` NULL** (seat bands say «Sin permanencia») · the welcome email
sends · the invoice shows 199 € + 21 % IVA.

### Step 3 — the live catalogue

```bash
export STRIPE_SECRET_KEY=…
python3 scripts/provision_stripe_v2.py --mode live --dry-run     # ⚠️ READ THE WHOLE TABLE
python3 scripts/provision_stripe_v2.py --mode live --yes
python3 scripts/provision_stripe_v2.py --mode live --dry-run     # confirm: all `ok`
```

The moment this completes, `create_checkout_session` stops returning `catalogue_not_provisioned` and
the seat bands are buyable. Make sure `/precios` and `/plan` are shipping the new model first.

### Step 4 — Carlos

1. **Put his email address in `FOUNDERS['carlos']['emails']`** (`brain/founder_prices.py`). That one
   line is what makes the roster resolve at all: Checkout matches on the workspace slug OR the
   signed-in operator's address, and the address is the identifier that exists BEFORE he has a
   workspace — which is the order things actually happen in, since the link lands on the page he
   signs up from. `tenant_slugs` is the same list for his workspace once it exists (the slug is
   derived from that same address by `provisioning.alta_slug`, so it is predictable).
   ⚠️ Until one identifier is filled in, `resolve()` returns None and he pays the PUBLIC price. It is
   left empty rather than guessed: a wrong address quotes a stranger 1.347 €/trimestre against a page
   saying 199 €.
2. Turn Stripe Tax on for the account (`Settings → Tax`), or the link is refused — a payment link
   cannot carry the manual IVA rate.
3. `python3 scripts/provision_stripe_v2.py --mode live --only founder --dry-run`, then `--yes`.
   Read the **pinned founder prices** block the dry run prints under the table — it groups the roster
   by customer and period the way the bill is shaped, and it is the last thing between you and an
   immutable object carrying a figure you promised somebody out loud.
   ⚠️ `--only founder` will also ensure the `rocoto_pedido` **meter** exists, because his year-1
   per-order price is metered and a metered price cannot be created without one.
4. The printed URL is what Peter sends him. It carries his tenant, his band, `orders_billing=included`
   and his pinned quarter price. Only the quarter has a link — see §6b.

### Step 4b — Carlos, months 4–12 (BEFORE the quarter renews)

The quarter renews on its own; nothing switches him. Step 3 above already mints
`founder_carlos_mensual`, `founder_carlos_mensual_compras` and `founder_carlos_mensual_orders`, so
what is left is the manual move, on the subscription he already has:

1. Confirm the three prices exist and read what you expect:
   `python3 scripts/provision_stripe_v2.py --mode live --only founder --dry-run` → all `ok`.
2. On his subscription in the dashboard, **before** the renewal date: replace the
   `founder_carlos_trimestre` item with `founder_carlos_mensual`, add `founder_carlos_mensual_compras`
   (qty 1), and add `founder_carlos_mensual_orders` (**no quantity** — Stripe rejects one on a metered
   item; the amount comes from reported usage).
3. Set the subscription's `metadata.orders_billing` to **`metered`** and `metadata.includes_orders`
   to **empty**. Until that is done `pedidos_usage_report.py` still reads `included` and marks his
   pedidos as already paid for — the quarter's answer, applied to a period that is metered.
4. Check the next invoice: 499 + 249 fixed, plus his month's pedidos at 0,25 €, plus 21 % IVA.

### Step 5 — the dashboard steps that are not code

* Add **`invoice.created`** to the enabled events on the `/api/stripe/webhook` endpoint (§4c).
* Confirm subscription invoices finalise on a delay, not immediately (§4c).
* Leave the FOUNDER 100 %-off promotion code alone — `allow_promotion_codes=True` still rides on
  every Checkout so Peter can walk the flow without paying.

### Step 6 — tidy up, optional and last

```bash
python3 scripts/provision_stripe_v2.py --mode live --archive-retired --dry-run
python3 scripts/provision_stripe_v2.py --mode live --archive-retired --yes
```

Only after the new catalogue is live and verified. Existing subscriptions are unaffected (§2).

### Never run

`scripts/provision_stripe_pedidos.py` for the seat bands. It is the ceiling-model script and now
refuses them by construction (`CEILING_BANDS`) — it would otherwise have created
`pedidos_peq_mensual` at «199 € every 3 months» under a page quoting 199 €/mes, plus three €0 alta
prices nobody sells.

---

## 8. Open, and needing Peter

1. **Carlos's band.** He was quoted a NUMBER — 1.347 €/trimestre including 15.000 pedidos — never a
   band. The roster records `med` so his row carries a real seat allowance (10 people, which matches
   5.000 orders a month). It is the one inferred field in his entry. Confirm before his first invoice.
2. **Stripe Tax.** Turning it on is the only route to IVA on a Payment Link. If Peter would rather not
   enable it, Carlos gets a Checkout Session URL from `/api/pedidos/checkout` instead (that path
   already attaches the manual `pedidos_iva_es` rate) — but sessions expire in 24 hours, so it is a
   "send it while he's on the phone" link, not one he can sit on.
3. **The bundle saving line goes negative for Grande.** The 5.000 (0,45 €) and 10.000 (0,42 €) bundles
   are *above* Grande's own 0,40 €/pedido rate, so «{X} % más barato que tu tarifa» cannot be true for
   a Grande visitor and the 25.000 bundle ties exactly at 0 %. The report must hide any bundle that
   does not beat that visitor's rate. Page-side decision, flagged here because the prices are real.
4. **The welcome email still prints the ceiling.** `brain/pedidos_welcome_email.py:210` renders
   `orders_ceiling` into a sentence, so a seat-band customer would read «hasta 0 pedidos al mes». Inert
   today only because nothing can be bought yet — it must be fixed before step 3.
5. **A live `.get()` bug on the invoice attachment.** `pedidos_billing.py` reads `obj.get("invoice")`
   and `inv.get(...)` in the welcome-email block; `StripeObject` has no `.get()`, so it raises,
   fail-softs, and the factura link has never actually reached a customer. Fix is `_sv`. Unrelated to
   this plan, listed so it is not lost.
