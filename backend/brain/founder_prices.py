"""Rocoto — PINNED FOUNDER PRICES: the `founder_` Stripe namespace the public tooling can never touch.

Peter, 2026-08-14: «carlos gets sent his own link and his own stripe link, so that we can do the
public one and still score him without changing what i quoted him already.»

THE PROBLEM THIS SOLVES. A Stripe Price is IMMUTABLE, so moving a public figure means create-new +
`transfer_lookup_key=True` + archive-old (scripts/reprice_stripe_pedidos.py does exactly that). Any
customer whose quote rides on a PUBLIC lookup_key therefore has their offer silently rewritten the
next time the public list moves. Peter has already quoted a named human 1.347 € for a quarter. That
number has to survive every future reprice untouched, and «remember not to reprice Carlos» is not a
mechanism.

SO THE MECHANISM IS A NAMESPACE, AND IT IS SAFE BY CONSTRUCTION:

  · every pinned price's lookup_key starts with `founder_`  →  `founder_<slug>_<cadence>`
  · `is_protected()` below is the ONE predicate, imported by both Stripe scripts
  · scripts/provision_stripe_v2.py creates a `founder_` price ONLY from this roster, and never
    modifies or archives one
  · scripts/reprice_stripe_pedidos.py refuses to create, modify or archive any `founder_` key at all,
    and prints the count it protected so the operator sees the fence hold

ADDING THE NEXT LOCKED CUSTOMER IS A DATA CHANGE — one entry in FOUNDERS below, then re-run the
provisioning script. There is deliberately no second place to edit.

⚠️ NAME COLLISION, READ ONCE: `founder` is ALSO an auth role in this codebase (operators.is_founder →
Peter's own identity, sup_session.py's cap table). The two are unrelated and must never be wired
together. A tenant is on THIS roster because a human quoted them a number, never because of who is
signed in.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

# The reserved prefix. Everything in this module exists to keep it un-enterable by the public tooling.
NAMESPACE = "founder_"

# ── HOW ORDERS ARE BILLED, AS A POSITIVE FACT ─────────────────────────────────────────────────────
# One key, two values, and BOTH are written — never the absence of a key.
#
# WHY THIS SHAPE EXISTS (defect found 2026-08-15, before it ever ran): the flag used to be
# `metadata['metered'] = '1' | ''`, and the reporter read `metadata['metered'] == ''` as «this is a
# founder whose price already includes their orders, skip them». An ordinary customer's subscription
# carries NO `metered` key at all, and a missing key reads as '' through any tolerant getter — so
# that sentinel would have suppressed metered billing for EVERY normal tenant on the platform while
# looking, in Stripe, exactly like a working system. A marker whose meaning depends on a key being
# absent cannot tell «deliberately included» from «nobody wrote it». So the marker is positive:
# `orders_billing='included'` means the price already covers their orders, `='metered'` means bill
# them per order, and anything else — including nothing at all — is read as 'metered', which is the
# published model and the safe default (it bills what the page quoted rather than silently zero).
ORDERS_BILLING_KEY = "orders_billing"
ORDERS_BILLING_INCLUDED = "included"     # the quoted price already covers their orders
ORDERS_BILLING_METERED = "metered"       # the published per-order rate applies


def orders_billing_of(metered: bool) -> str:
    """The wire value for a pinned price's `metered` flag. Derived in ONE place so the boolean the
    roster carries and the string Stripe carries can never drift apart."""
    return ORDERS_BILLING_METERED if metered else ORDERS_BILLING_INCLUDED


# ── A GLIDE PATH IS SEVERAL PERIODS, AND A PERIOD IS SEVERAL LINES ────────────────────────────────
# Peter, 2026-08-15: «the price that I gave you is the price you get for the first three months, and
# then you also get a discount for the year, locked, because of your trust in me. After that year you
# go to normal pricing.» So a founder is not one price. Carlos has TWO periods before he reaches the
# public list, and they do not bill the same way at all:
#
#   MESES 1–3    one all-in figure — 1.347 € every 3 months, his 15.000 pedidos already inside it
#   MESES 4–12   the Mediano plan + Compras + a per-order rate at HALF the band's list rate, METERED
#   AÑO 2        the public list, which is no longer this file's business
#
# THE SECOND PERIOD IS NOT A SINGLE NUMBER, AND PINNING IT AS ONE WOULD BE A MIS-CHARGE. 1.998 €/mes
# is true at exactly 5.000 pedidos and nowhere else — it is 499 € plan + 249 € Compras + 5.000 ×
# 0,25 €. A composite price of 199800 would bill 1.998 € the month he sends 7.000 pedidos (he owes
# 2.498 €) and 1.998 € the month he sends 3.000 (he owes 1.498 €). The second one is the one that
# decides this: it OVERCHARGES a named customer, every month, against a page that told him the rate
# and told him it was locked. His volume is the single fact in this deal that nobody controls, so the
# only honest shape is the one that tracks it — which is what the public model already is, with one
# rate replaced.
#
# SO A PERIOD IS A PLAN LINE PLUS THE LINES THAT RIDE WITH IT, each its own immutable Stripe Price:
#   ROLE_PLAN      the seat band. Exactly one per cadence, and the only role `resolve()` ever hands
#                  back as THE plan — so a per-order rate can never be attached as a subscription's
#                  plan, which is the failure a flat list of prices invites.
#   ROLE_COMPRAS   the Compras module, licensed, once a month
#   ROLE_ORDERS    the per-order rate, METERED against the `rocoto_pedido` meter, billed in arrears
ROLE_PLAN = "plan"
ROLE_COMPRAS = "compras"
ROLE_ORDERS = "orders"

# Stripe's own two words for a recurring price, as constants because the provisioning script reads
# them straight off a row. A typo mints a LICENSED per-order price — one that charges 0,25 € a MONTH
# instead of 0,25 € a PEDIDO, bills 25 c where 1.250 € was quoted, and looks completely ordinary in
# the dashboard.
USAGE_LICENSED = "licensed"
USAGE_METERED = "metered"


def is_protected(lookup_key: str) -> bool:
    """True when `lookup_key` belongs to the pinned namespace. The public scripts import THIS rather
    than re-typing the prefix, so the fence is one string in one file."""
    return (lookup_key or "").startswith(NAMESPACE)


def pinned_lookup_key(slug: str, cadence: str) -> str:
    """`founder_carlos_trimestre`. Built here so the roster below and the provisioning script can
    never disagree about the shape of a key."""
    return f"{NAMESPACE}{slug}_{cadence}"


def line_lookup_key(slug: str, cadence: str, role: str) -> str:
    """`founder_carlos_mensual_orders` — the key for a line that rides WITH a plan.

    BUILT, NEVER TYPED. The roster nests a period's other lines INSIDE the plan they belong to, so
    the only thing an author writes is the role and the key falls out of (founder, cadence, role)
    here. A key typed by hand beside its plan is a key that can name a different cadence than the
    dict it sits in — and those two would agree in review and disagree in Stripe."""
    return pinned_lookup_key(slug, f"{cadence}_{role}")


# ── THE FIGURES ARE DERIVED FROM THE PUBLIC BAND, NOT TYPED A THIRD TIME ──────────────────────────
# Peter's standing rule: «Prices must appear in exactly one place in the codebase». 499 € already
# exists in product/pricing.json and — mirrored, and asserted against it by tools/check_pricing_sync.py
# — in brain/pedidos_billing.BANDS. Typing 49900 into this roster would be the third copy, which is
# precisely what had to be hunted down by hand the last time the ceilings moved.
#
# So a pinned price states EITHER a literal `amount_cents` — a figure a human quoted, like the 1.347 €
# quarter, which has no public equivalent to derive from — OR a `derive`, naming how it comes off the
# founder's own band. Exactly one of the two, asserted, because a row carrying both has a number that
# silently loses to the other one.
#
# WHAT STOPS A DERIVATION FROM RE-QUOTING HIM LATER. A Stripe Price is immutable and
# scripts/provision_stripe_v2.py is create-only, so the derivation is evaluated ONCE — at the moment
# the price is minted — and it is printed in the dry-run table before anybody types `--yes`. If the
# public list moves afterwards the minted price does not: the next run prints DRIFT on his key and
# leaves it alone. That drift line is the alarm you actually want («the list has moved away from what
# Carlos was quoted»), in the one place somebody is already reading.
#
# ⚠️ THE IMPORT IS LAZY, AND THAT IS LOAD-BEARING. brain/pedidos_billing.py imports THIS module at its
# top (it resolves the roster before anything else at Checkout), so a module-level
# `from brain.pedidos_billing import BANDS` here is a circular import that fails at interpreter start:
# pedidos_billing is half-executed and has not reached BANDS yet. Reading it inside the function keeps
# the dependency one-directional at import time and correct at call time.
def _band(code: str) -> Dict[str, Any]:
    from brain.pedidos_billing import BANDS  # noqa: PLC0415 — circular at module level; see above
    key = (code or "").strip().lower()
    if key not in BANDS:
        raise KeyError(f"founder roster names band {code!r}, which is not in BANDS "
                       f"({sorted(BANDS)}) — a pinned price cannot be derived from a band that does "
                       f"not exist")
    return BANDS[key]


def _derive_band_mensual(b: Dict[str, Any], p: Dict[str, Any]) -> int:
    """The band's own monthly seat fee — Mediano, 499 €."""
    return int(b["mensual_cents"])


def _derive_band_compras(b: Dict[str, Any], p: Dict[str, Any]) -> int:
    """Compras at «la mitad de tu plan» — 249 € on Mediano. Already halved in BANDS and asserted
    against pricing.json there, so it is READ here rather than halved a second time."""
    return int(b["compras_cents"])


def _derive_band_per_order_discounted(b: Dict[str, Any], p: Dict[str, Any]) -> int:
    """The band's published per-order rate less this founder's locked discount — 0,50 € less 50 % is
    0,25 €, «tu tarifa por pedido se queda a la mitad, bloqueada hasta el mes 12».

    IT REFUSES A FRACTION OF A CENT RATHER THAN ROUNDING ONE. A Stripe `unit_amount` is an integer
    number of cents, so a rate of 22,5 c would have to become 22 or 23 — and this figure is
    multiplied by every order the customer sends. Half a cent on 5.000 pedidos is 25 € a month,
    charged or forgiven, with nobody having decided it. Today 50 halves exactly; the refusal is what
    stops a future band rate of 45 c from quietly becoming a different deal than the one that was
    locked to a human's face."""
    rate = int(b["per_order_cents"])
    pct = int(p["discount_pct"])
    if not 0 <= pct < 100:
        raise ValueError(f"per-order discount of {pct} % is not a discount off {rate} c/pedido")
    num = rate * (100 - pct)
    if num % 100:
        raise ValueError(
            f"{pct} % off {rate} c/pedido is {num / 100} c — not a whole number of cents. A Stripe "
            f"unit_amount is an integer, and rounding a per-order rate moves real money at volume: "
            f"quote a discount that lands on a whole cent, or sell the orders as a prepaid bolsa.")
    return num // 100


# Named rather than inlined so the roster reads as a sentence («derive: band_per_order_discounted»)
# and an unknown name is a KeyError that prints the typo, instead of a silent zero.
DERIVATIONS = {
    "band_mensual": _derive_band_mensual,
    "band_compras": _derive_band_compras,
    "band_per_order_discounted": _derive_band_per_order_discounted,
}


def amount_cents_of(e: Dict[str, Any], p: Dict[str, Any]) -> int:
    """One pinned price's amount in integer cents — the literal it quotes, or the derivation it names
    applied to its founder's band."""
    has_literal, has_derive = ("amount_cents" in p), ("derive" in p)
    if has_literal == has_derive:
        raise ValueError(
            f"pinned price {p.get('nickname') or p!r} must state exactly one of `amount_cents` (a "
            f"figure a human quoted) or `derive` (how it comes off the band) — it states "
            f"{'both' if has_literal else 'neither'}")
    if has_literal:
        return int(p["amount_cents"])
    name = str(p["derive"])
    if name not in DERIVATIONS:
        raise KeyError(f"unknown derivation {name!r} — one of {sorted(DERIVATIONS)}")
    return int(DERIVATIONS[name](_band(str(e["band"])), p))


# ── THE ROSTER ────────────────────────────────────────────────────────────────────────────────────
# One entry per grandfathered customer. Fields:
#   display          what a human calls them, for the script's table and the Stripe nickname
#   emails           THE IDENTIFIER THAT EXISTS BEFORE THE WORKSPACE DOES. Peter, 2026-08-14:
#                    «carlos gets sent his own link and his own stripe link» — the link lands on the
#                    page he then signs up from, so at quote time there is no workspace to key on.
#                    Matched case-insensitively against the operator email Checkout carries, which
#                    app.py resolves from the SIGNED-IN session (`_pedidos_billing_gate`) and never
#                    from a client-supplied field, so it is a verified address rather than a claim.
#   tenant_slugs     the workspaces that are his, once they exist. A list because a founder can be
#                    matched by more than one over a migration, and `[0]` is the PRIMARY: it is what
#                    the provisioning script's Payment-Link fence reads. EMPTY means the workspace
#                    does not exist yet — the script still creates the PRICE and still REFUSES the
#                    Payment Link, because a link that takes money and provisions nothing (the
#                    webhook ignores a session with no tenant_slug) is the worse of the two outcomes.
#
#                    ⚠️ ONE EMPTY STRING DISABLED THE WHOLE MECHANISM (defect fixed 2026-08-15).
#                    These two were a single `tenant_slug: ""`, matched by exact equality with an
#                    empty-string guard, so `resolve()` returned None for every tenant alive and the
#                    precedence block in `create_checkout_session` never ran once. A roster that
#                    cannot name anybody is not a roster. Both lists are now the fields Peter fills,
#                    and `identify()` below matches EITHER.
#   band             what `pedidos_subscription.band` records for them. It is what the meter and the
#                    seat allowance read, and — since 2026-08-15 — what every `derive` is computed
#                    off. It is NOT what they are charged; that is the price's own amount.
#   quoted/locked_until   the human facts, stamped into Stripe metadata so the dashboard explains
#                    itself a year from now without this file.
#   prices           ONE ENTRY PER PERIOD OF THE GLIDE PATH, keyed by the cadence that period is
#                    quoted on. The entry IS the plan line; `lines` under it are the other prices
#                    that ride on the same subscription (Compras, the per-order rate), and their
#                    lookup_keys are BUILT from the role, never typed. `resolve()` only ever returns
#                    a plan, so a metered per-order rate cannot be attached as somebody's plan.
#
# And on each PRICE — not on the entry, which is the whole point:
#   metered          False when THAT PERIOD's price already includes their orders. Peter, 2026-08-14:
#                    «my first customer will get an order quantity bundle so they prepay it all rather
#                    than go on metered». Carlos's 1.347 €/quarter covers 15.000 orders for that
#                    quarter, so that subscription carries NO metered item and no usage is ever
#                    reported against it. On the wire it becomes `orders_billing`
#                    ('included'|'metered'), never a blank.
#
#                    ⚠️ IT MOVED OFF THE ENTRY AND ONTO THE PRICE ON 2026-08-15, because a founder on
#                    a glide path has two answers. Carlos is `included` for months 1–3 and `metered`
#                    for months 4–12 — the same human, the same roster row, two periods that bill
#                    differently. An entry-level flag could not express his own deal, and the copy of
#                    it that reached Stripe would have said `included` on a metered price: the usage
#                    reporter reads exactly that key and would have marked nine months of his pedidos
#                    as already paid for. Both keys are read with `[...]`, never `.get()`, so a price
#                    that forgets to answer raises instead of inheriting somebody else's answer —
#                    the same rule as ORDERS_BILLING_KEY above, one level down.
#   includes_orders  the prepaid allowance for that period, in the shape it is quoted ('' when the
#                    period buys none). Rides on the subscription metadata so the draw-down can be
#                    read off Stripe alone. `orders_billing` is what DECIDES; this string is what a
#                    human reads beside it.
#   amount_cents |   exactly one. A literal is a figure a human quoted; a `derive` names one of
#   derive           DERIVATIONS above and is computed off `band`. See the block there for why the
#                    derivation cannot re-quote him after the price is minted.
#   usage_type       'licensed' (default) or 'metered'. Only ROLE_ORDERS is ever metered.
FOUNDERS: Dict[str, Dict[str, Any]] = {
    "carlos": {
        "display": "Carlos",
        # ⚠️ ONE LINE, AND IT IS PETER'S TO WRITE: the address he sends Carlos's link to goes in
        # `emails` and everything downstream starts working — Checkout resolves the pinned price the
        # moment Carlos signs in with it, and the reporter reads `orders_billing='included'` off his
        # subscription and never meters him. It is deliberately EMPTY rather than guessed: a wrong
        # address here would either quote a stranger 1.347 €/trimestre against a page saying 199 €,
        # or leave the real Carlos on the public list — both are mis-sales to a named human, and an
        # address is not something to infer. `tenant_slugs` stays empty until his workspace exists
        # (STRIPE-V2-PLAN.md step 4); note the slug is derived from that same address by
        # provisioning.alta_slug, so the email is the only fact actually needed.
        "emails": [],
        # THE WORKSPACE HIS PAYMENT PROVISIONS — set to `carlos` on 2026-08-15 so the payment link
        # could actually be minted. `_ensure_payment_link` refuses without one, and it is right to:
        # `_on_checkout_completed` ignores a session carrying no `tenant_slug`, so a link without it
        # would take 1.347 € and provision nothing.
        #
        # THIS IS A HANDLE, NOT A CLAIM ABOUT WHO HE IS. Unlike `emails` — where a wrong address
        # quotes a stranger 1.347 € against a page saying 199 €, which is why that one stays empty
        # until Peter writes it — a slug is an internal workspace key with no customer on it yet.
        # Rename it before he signs in if his company should name the workspace instead; nothing
        # public depends on it today.
        # HIS WORKSPACE ALREADY EXISTS, AND IT HAS HIS CATALOGUE IN IT — 2026-08-15. Peter said the
        # company is Sitjar, and the obvious move was `sitjar`; the database says otherwise. The demo
        # run at his own table created `xaviersitjar` and loaded 308 SKUs into it — the mango rows
        # that produced matcher rule 5c among them. Provisioning a fresh `sitjar` would have him pay
        # 1.347 € and land in an empty workspace, with the catalogue he watched go in orphaned under
        # a slug nothing points at. The slug is not a naming decision here; it is a pointer at
        # existing data, and the data won.
        "tenant_slugs": ["xaviersitjar"],
        # ⚠️ CONFIRM BEFORE THE FIRST INVOICE: Peter quoted a NUMBER (1.347 €/trimestre incl. 15.000
        # pedidos), never a band. `med` is recorded here so the row carries a real seat allowance —
        # 10 people, which matches a business doing 5.000 orders a month — and it is the only field
        # in this entry that was inferred rather than quoted.
        "band": "med",
        "quoted": "2026-08-14",
        "locked_until": "2027-08-14",
        "default_cadence": "trimestre",
        "prices": {
            # ── MESES 1–3 · one all-in figure, his orders inside it ──────────────────────────────
            # A LITERAL, BECAUSE NOTHING PUBLIC EQUALS IT. 1.347 € is 449 €/mes × 3 from a pitch that
            # predates the seat-band model; there is no band, no module and no rate it can be
            # derived from, so it is stated, and the comment is the derivation.
            "trimestre": {
                "amount_cents": 134700,      # 1.347 € sin IVA
                "interval": "month",
                "interval_count": 3,
                "nickname": "Rocoto — Carlos (precio fijado 2026-08-14)",
                "payment_link": True,
                "metered": False,
                "includes_orders": "15000/quarter",
            },
            # ── EL AÑO · THE SECOND DOOR, ADDED 2026-08-17 ───────────────────────────────────────
            # Peter: «I'd like you to let him buy an annual plan if he wants to, which probably
            # would come out at €4,310, because it's that month we prorate and then apply a 20 %
            # discount to all of that.»
            #
            # THE DERIVATION, so nobody has to reconstruct it from the number: his own founder
            # month is 449 €. 449 × 12 = 5.388, less 20 % = 4.310,40 → 4.310 € for the year, paid
            # once. It is a LITERAL for the same reason `trimestre` is — 449 € predates the
            # seat-band model, so there is no band, module or rate this can be derived from at
            # build time, and the arithmetic above is the audit trail.
            #
            # `includes_orders` MATCHES THE QUARTER'S SHAPE, scaled: the quarter carries 15.000
            # pedidos inside its figure, so a year carries 60.000. Getting this wrong is not a
            # display bug — `pedidos_usage_report` keys on `orders_billing='included'` and would
            # meter him on top of a price that already contains his pedidos.
            "anual": {
                "amount_cents": 431000,      # 4.310 € sin IVA — 449 × 12 − 20 %
                "interval": "year",
                "interval_count": 1,
                "nickname": "Rocoto — Carlos, el año (precio fijado 2026-08-17)",
                "payment_link": True,
                "metered": False,
                "includes_orders": "60000/year",
            },
            # ── MESES 4–12 · THE PRICE THIS ENTRY EXISTS TO MAKE SURE EXISTS ─────────────────────
            # THE TRAP IT CLOSES (2026-08-15). `founder_carlos_trimestre` is a SUBSCRIPTION price on
            # a 3-month interval: it renews. Nothing in Stripe, and nothing in this repo, switches a
            # customer from one period of a glide path to the next. So on the day month 4 arrives,
            # the quarter simply charges 1.347 € again — and /propuesta/carlos, which he was sent and
            # which he signed from, says months 4–12 cost 1.998 €/mes at his volume. A page saying
            # one number while the card is charged another, to a named human, is the exact failure
            # the whole `founder_` namespace was built to prevent. The switch itself stays MANUAL —
            # he is chaperoned, and a scheduled repricing job nobody asked for is a worse mechanism
            # than Peter moving three line items with the roster in front of him — but the prices he
            # would move him ONTO have to exist first, in the fence, before the renewal date.
            #
            # THREE PRICES, NOT ONE, AND THE REASON IS HIS VOLUME. See the glide-path block at the
            # top of this file: 1.998 € is only his bill at exactly 5.000 pedidos. The plan and
            # Compras are fixed monthly figures and are pinned as such; the pedidos are METERED at
            # his locked rate, so the month he grows he is billed for what he sent, and the month he
            # shrinks he is not billed for orders he did not send. The 1.998 € on the page is then a
            # worked example of the rates, which is what the page actually presents it as.
            #
            # ALL THREE ARE PINNED, INCLUDING THE TWO THAT EQUAL TODAY'S PUBLIC FIGURES. 499 € and
            # 249 € are Mediano's own list prices today, so pinning them looks redundant — it is not.
            # `resolve()` falls back to `default_cadence` when a cadence has no pinned price, so a
            # roster carrying no `mensual` plan answers a mensual Checkout with the QUARTER, which is
            # the same 1.347 € trap by another route. And a public reprice of Mediano would move two
            # of the three components of a bill he was told was locked until month 12. Pinned, his
            # year is his year, and a reprice shows up as a DRIFT line rather than on his card.
            #
            # ⚠️ ONE CONSEQUENCE TO KNOW: /propuesta/carlos renders its «meses 4–12» row from
            # pricing.json every build (landing/build.py, `_prop_tokens`), so if Mediano is ever
            # repriced the page's 499/249 move and these pinned prices do not. The page would then
            # quote MORE than Stripe charges him, which is the safe direction of that disagreement
            # and a visible one — but it is a disagreement, and the page is Peter's to point at the
            # pinned figures if he would rather it read them.
            "mensual": {
                "derive": "band_mensual",        # Mediano's seat fee — 499 €
                "interval": "month",
                "interval_count": 1,
                "nickname": "Rocoto — Carlos meses 4–12 · plan (precio fijado 2026-08-14)",
                # NO PAYMENT LINK, DELIBERATELY. A link mints a NEW subscription; Carlos already has
                # one, and the year-1 move is three items changing on the subscription he is on. A
                # second live subscription would bill him twice and split his history in two.
                "payment_link": False,
                # METERED, AND THIS IS THE FLAG THE USAGE REPORTER READS. His quarter's 15.000 are
                # spent; from month 4 every pedido is reported and billed at the rate below.
                "metered": True,
                "includes_orders": "",
                "lines": {
                    # «Plan Mediano con Compras dentro» — the module is inside the quoted 1.998 €,
                    # so it is part of the pinned period rather than something he re-picks.
                    ROLE_COMPRAS: {
                        "derive": "band_compras",    # «la mitad de tu plan» — 249 €
                        "interval": "month",
                        "interval_count": 1,
                        "usage_type": USAGE_LICENSED,
                        "nickname": "Rocoto — Carlos meses 4–12 · Compras (precio fijado 2026-08-14)",
                    },
                    # THE HALVED RATE — the only genuinely new number in the deal, and the only one
                    # the page calls locked: «tu tarifa por pedido se queda a la mitad, 0,25 € en vez
                    # de 0,50 €, bloqueada hasta el mes 12». Written as the DISCOUNT and not as
                    # 25, so it stays half of whatever Mediano publishes at the moment it is minted,
                    # and so «a la mitad» is a fact the code enforces rather than a claim beside a
                    # typed figure.
                    ROLE_ORDERS: {
                        "derive": "band_per_order_discounted",
                        "discount_pct": 50,
                        "interval": "month",
                        "interval_count": 1,
                        "usage_type": USAGE_METERED,
                        "nickname": "Rocoto — Carlos meses 4–12 · pedidos (0,25 €, fijado 2026-08-14)",
                    },
                },
            },
        },
    },
}


def entry(slug: str) -> Optional[Dict[str, Any]]:
    return FOUNDERS.get((slug or "").strip().lower())


def _slugs(e: Dict[str, Any]) -> List[str]:
    return [s.strip() for s in (e.get("tenant_slugs") or []) if (s or "").strip()]


def _emails(e: Dict[str, Any]) -> List[str]:
    return [a.strip().lower() for a in (e.get("emails") or []) if (a or "").strip()]


def primary_slug(e: Dict[str, Any]) -> str:
    """The workspace the Payment Link may point at, or '' while none exists. First entry wins."""
    got = _slugs(e)
    return got[0] if got else ""


def for_tenant(tenant_slug: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """(slug, entry) for the workspace, or None. Exact match against `tenant_slugs` — a founder is a
    named workspace, never a pattern, and an entry with no slug yet matches nobody by this route."""
    t = (tenant_slug or "").strip()
    if not t:
        return None
    for slug, e in FOUNDERS.items():
        if t in _slugs(e):
            return slug, e
    return None


def for_email(email: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """(slug, entry) for the operator's address, or None. Case-insensitive exact match — the address
    arrives from the signed-in session, so this asks «is this the human we quoted», and it is the
    route that works before the workspace exists at all."""
    a = (email or "").strip().lower()
    if not a:
        return None
    for slug, e in FOUNDERS.items():
        if a in _emails(e):
            return slug, e
    return None


def identify(tenant_slug: str = "", email: str = "") -> Optional[Tuple[str, Dict[str, Any]]]:
    """(slug, entry) for whichever identifier names a founder. The WORKSPACE wins when both are
    given: a slug is a fact about the account being billed, an address is a fact about the person
    signed into it, and it is the account that gets the subscription."""
    return for_tenant(tenant_slug) or for_email(email)


def resolve(tenant_slug: str = "", cadence: str = "", email: str = "") -> Optional[Dict[str, Any]]:
    """The pinned price this buyer gets, or None for everybody else. Matched on the workspace slug
    OR the signed-in operator's address — see `identify`.

    The requested `cadence` only picks AMONG a founder's own pinned prices; it can never fall back to
    a public band. A founder who asks for a cadence they have no pinned price for gets their
    `default_cadence` — the quote they were given — rather than the public list, which is the whole
    point of the namespace.

    Returns {slug, cadence, lookup_key, amount_cents, interval, interval_count, band, metered,
    orders_billing, includes_orders, quoted, locked_until, lines} — everything the Checkout builder
    needs, so it never has to reach back into the roster a second time.

    `lines` is the rest of that period's bill (Compras, the per-order rate), each with its own pinned
    lookup_key. It is a TUPLE and it is empty for a period that is one all-in price, so a caller can
    always iterate it. Use `line_key()` to ask for one by role."""
    found = identify(tenant_slug, email)
    if not found:
        return None
    slug, e = found
    want = (cadence or "").strip().lower()
    prices: Dict[str, Any] = e.get("prices") or {}
    key = want if want in prices else str(e.get("default_cadence") or "")
    p = prices.get(key)
    if not p:
        return None
    out = _row(slug, e, key, ROLE_PLAN, p, p)
    out["lines"] = tuple(
        {"role": role, "lookup_key": line_lookup_key(slug, key, role),
         "usage_type": str(ln.get("usage_type") or USAGE_LICENSED),
         "amount_cents": amount_cents_of(e, ln)}
        for role, ln in (p.get("lines") or {}).items())
    return out


def line_key(pinned: Optional[Dict[str, Any]], role: str) -> str:
    """The pinned lookup_key for `role` in a resolved founder price, or '' when this period carries
    no such line.

    '' MEANS «USE THE PUBLIC CATALOGUE», which is what every non-founder gets and what a founder gets
    for anything outside their lock — Carlos's Reparto, if he ever adds vans, is a public price at a
    public rate, because nobody quoted him a different one. Callers write
    `line_key(pinned, ROLE_ORDERS) or lookup_key(band, 'orders')`, so the pinned line wins where one
    exists and nothing changes where none does."""
    for ln in ((pinned or {}).get("lines") or ()):
        if ln["role"] == role:
            return str(ln["lookup_key"])
    return ""


def _row(slug: str, e: Dict[str, Any], cadence: str, role: str,
         p: Dict[str, Any], plan: Dict[str, Any]) -> Dict[str, Any]:
    """One pinned price, flattened — the shape both `resolve()` and the provisioning script read.

    `plan` is the PLAN price this row belongs to; for a plan row it is the row itself. HOW A PERIOD
    BILLS ITS ORDERS IS A FACT ABOUT THE PERIOD, not about one line of it, so `metered` and
    `includes_orders` are read off the plan for every row. A Compras line that answered for itself
    could say `included` under a metered plan, and that string is the one the usage reporter keys on.

    Read with `plan[...]` rather than `plan.get(...)`: a price that forgot to state how its orders
    are billed must raise here, not inherit a default. That is the same rule as ORDERS_BILLING_KEY at
    the top of this file — a marker whose meaning depends on a key being absent cannot tell
    «deliberately included» from «nobody wrote it»."""
    metered = bool(plan["metered"])
    usage = str(p.get("usage_type") or USAGE_LICENSED)
    return {
        "slug": slug, "display": e.get("display") or slug, "cadence": cadence, "role": role,
        "lookup_key": (pinned_lookup_key(slug, cadence) if role == ROLE_PLAN
                       else line_lookup_key(slug, cadence, role)),
        "product_key": f"{NAMESPACE}{slug}_product",
        "amount_cents": amount_cents_of(e, p),
        "interval": p["interval"], "interval_count": int(p["interval_count"]),
        "usage_type": usage, "meter": usage == USAGE_METERED,
        "nickname": p.get("nickname") or f"Rocoto — {slug} {cadence} {role}",
        "payment_link": bool(p.get("payment_link")),
        "band": e.get("band") or "",
        "metered": metered,
        "orders_billing": orders_billing_of(metered),
        "includes_orders": str(plan["includes_orders"]),
        "quoted": str(e.get("quoted") or ""), "locked_until": str(e.get("locked_until") or ""),
        "tenant_slug": primary_slug(e),
    }


def price_rows() -> Tuple[Dict[str, Any], ...]:
    """Every pinned price, flattened for the provisioning script — one row per Stripe Price.

    A period contributes its plan and then every line that rides with it, in that order, so the
    dry-run table reads as the bill does: the plan, then what is on top of it."""
    rows = []
    for slug, e in FOUNDERS.items():
        for cadence, p in (e.get("prices") or {}).items():
            rows.append(_row(slug, e, cadence, ROLE_PLAN, p, p))
            for role, ln in (p.get("lines") or {}).items():
                rows.append(_row(slug, e, cadence, role, ln, p))
    return tuple(rows)


def stripe_metadata(row: Dict[str, Any]) -> Dict[str, str]:
    """The metadata every pinned Stripe object carries. Peter's exact keys: founder / quoted /
    locked_until / includes_orders, plus the roster's own routing fields so a dashboard reader can
    see which workspace the price belongs to and how its orders are billed.

    `orders_billing` REPLACED `metered: '1'|''` here on 2026-08-15. This dict is copied by the
    Payment Link onto every session it mints and from there onto the SUBSCRIPTION — which is the
    exact object the usage reporter reads — so an empty-string flag written here is an empty-string
    flag read there, indistinguishable from the key simply not existing on an ordinary customer's
    subscription. See ORDERS_BILLING_KEY at the top of this file."""
    return {
        "founder": row["slug"],
        "quoted": row["quoted"],
        "locked_until": row["locked_until"],
        "includes_orders": row["includes_orders"],
        "band": row["band"],
        ORDERS_BILLING_KEY: row.get("orders_billing") or orders_billing_of(bool(row.get("metered"))),
        "tenant_slug": row["tenant_slug"],
        # WHICH PERIOD AND WHICH LINE, so three prices under one founder are told apart in the
        # dashboard by something other than their nickname. `cadence` names the period of the glide
        # path; `role` says whether this is the plan, Compras or the per-order rate.
        "cadence": row.get("cadence") or "",
        "role": row.get("role") or ROLE_PLAN,
        "protected": "founder_namespace",
    }


# The keys above that are true of the HUMAN rather than of one line on one period's invoice.
PRODUCT_METADATA_KEYS: Tuple[str, ...] = (
    "founder", "quoted", "locked_until", "band", "tenant_slug", "protected")


def stripe_product_metadata(row: Dict[str, Any]) -> Dict[str, str]:
    """The metadata a founder's PRODUCT carries — a strict subset of `stripe_metadata`, and the keys
    it drops are the reason it exists.

    All of a founder's prices hang off ONE product, so their invoice line says who they are. The
    provisioning script's `_products()` stamps that product with the FIRST row's metadata, and
    Carlos's first row is his quarter — whose orders are `included` — while his year-1 rows are
    `metered`. Copying a price-level answer up to the product would leave a product reading
    `orders_billing=included` sitting over a metered per-order price: a marker that is simply wrong
    about half of what it covers. Nothing bills off product metadata; a HUMAN reads it, and a human
    is exactly who that would mislead. Same for `cadence` and `role`, which name one price out of
    three."""
    m = stripe_metadata(row)
    return {k: m[k] for k in PRODUCT_METADATA_KEYS}
