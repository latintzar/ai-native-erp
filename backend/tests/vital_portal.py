"""vital_portal.py — THE CUSTOMER'S OWN DOOR IS THEIRS, AND IT PROMISES NOTHING (SPEC §5.9).

A restaurant gets one link, sees the orders IT placed with THIS distributor, and can send another
one. Everything that can go wrong with that sentence is a product failure, not an arithmetic one, so
every check below is a PROMISE:

  P1  THE LINK IS THEIRS AND NOBODY ELSE'S — a token resolves to exactly one (tenant, phone), and
      the page it opens is built from THAT pair, never from anything the browser sent. Another
      customer's link never shows a line of this one's history.
  P2  A DEAD LINK LOOKS EXACTLY LIKE A LINK THAT NEVER EXISTED — unknown, revoked, expired and
      malformed all answer the same nothing, so a probe cannot confirm that a restaurant is a
      customer of ours.
  P3  THE LINK IS STABLE, AND ROTATION IS A MINT — asking twice gives the same URL (so a
      confirmation message can always carry it and a restaurant can bookmark it); rotating kills the
      old one in the same commit; there is never more than one live link per customer.
  P4  A LINK THAT IS USED NEVER DIES, A LINK THAT IS FORGOTTEN DOES — the expiry slides on use.
  P5  THEY SEE THEIR OWN ORDERS AND WHAT THEY ALWAYS BUY — history, «lo de siempre», es-ES, and
      their phone MASKED (the page is a link anyone with the URL can open).
  P6  THE PAGE NEVER SHOWS OUR INTERNAL STATE — an order waiting on the comercial reads «recibido»,
      never «pendiente de revisión». Our queue is ours (§5.8a: the customer is told the truth, not
      our diagnosis).
  P7  A TOTAL WE CANNOT STAND BEHIND IS NOT SHOWN — one variable-weight or unpriced line and the
      order has no total. A number the invoice will contradict is a promise nobody made.
  P8  NEVER INVENT A SKU — a product they have never ordered, one that left the assortment, and a
      nonsense quantity are each REFUSED BY NAME, in es-ES, next to the line they are about. A line
      that quietly vanishes between the tap and the order is the worst outcome here.
  P9  THE REORDER IS A REAL ORDER, ON THE REAL RAIL — it lands in `orders` through the same
      `brain/events` fold a WhatsApp burst uses, with name/code/price read off `catalogue_skus`.
  P10 THE COMERCIAL STILL DECIDES — it lands `needs_review`, and no portal path can approve it (§0
      gated agency). The portal is a door, not a grant.
  P11 THE TONE LAW — ACKNOWLEDGED, NEVER CONFIRMED (§5.7/§5.8a): the words «listo», «apuntado»,
      «anotado» and «confirmado» cannot appear in what Rocoto sends back.
  P12 ROCOTO WRITES TO THEM, ON THE ONE MOUTH — the acknowledgement rides
      `actions.send_whatsapp_as_rocoto` (gate → sombra → the rail) and is EVENTED as `msg.sent`.
      Under ROCOTO_EGRESS_SANDBOX nothing reaches a real phone; the vital proves the rail was
      crossed, NOT that a message was delivered.
  P13 THE REVIEW DECISION STILL RUNS — a portal order outside the delivery radius parks with ONE
      reason, through `review.hold_for_review`, exactly like a WhatsApp one.
  P14 THE LOG STAYS TRUE — the intake row is `message_type='portal'`. We do not fake a WhatsApp
      message; "as if they had sent one" is about the CONFIRMATION, not about lying in the log.

P2(shape) · P7 · P8(qty) · P11 · P5(mask) · P6 are PURE — no database, no config, no network. The
rest need a clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_portal.py
Without REHEARSAL_DSN they SKIP cleanly (and the vital still fails on any pure regression).
SAFETY: refuses the live `rocoto` DB BY NAME — it writes and deletes its own test tenant's rows.
Run: PYTHONPATH=. python3 tests/vital_portal.py
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import portal  # noqa: E402

R = []
SKIPPED = []
TENANT = "vitalportal"          # invented; never a real company (LOCKED LAW)
OTHER_TENANT = "vitalportalb"

# Invented customers, never a real company (LOCKED LAW).
BAR_LUMBRE = "+34900000201"
CAFE_SOTILLO = "+34900000202"
MESON_PERAL = "+34900000203"

SKU_JAMON = "vp-sku-jamon"
SKU_QUESO = "vp-sku-queso"
SKU_LOMO = "vp-sku-lomo"        # in the catalogue, NEVER ordered by Bar Lumbre
SKU_GONE = "vp-sku-retirado"    # ordered once, then out of assortment
SKU_OTHER = "vp-sku-ajeno"      # belongs to the OTHER tenant


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


# ══ P11 · THE TONE LAW ═══════════════════════════════════════════════════════════════════════════
_ack1 = portal.acknowledgement(1, "Bar Lumbre")
_ack3 = portal.acknowledgement(3, "")
ck("P11 the acknowledgement says «déjame que lo confirme y te digo enseguida»",
   "déjame que lo confirme" in _ack1.lower() and "enseguida" in _ack1.lower(), _ack1)
ck("P11 …and NEVER «listo», «apuntado», «anotado» ni «confirmado»",
   not any(w in (_ack1 + " " + _ack3).lower()
           for w in ("listo", "apuntado", "anotado", "confirmado")))
ck("P11 the banned set is CODE, not prose (so the next edit cannot quietly break it)",
   {"listo", "apuntado", "anotado", "confirmado"} <= set(portal._TONE_BANNED))
ck("P11 one line reads «1 línea», three read «3 líneas» (es-ES, not a plural bug)",
   "1 línea)" in _ack1 and "3 líneas)" in _ack3, _ack3)
ck("P11 it opens the same way whether or not we know their name — a Spanish trade name is «Bar "
   "Lumbre», and «Bar, recibido…» is what greeting by its first word actually produced",
   _ack1 == _ack3.replace("3 líneas", "1 línea") and _ack1.startswith("Recibido"), _ack1[:26])
# The guard is only real if it FIRES. Widen the banned set to a word the sentence does contain and
# prove the function refuses to hand it back — a tone law that cannot fail is decoration.
_saved = portal._TONE_BANNED
try:
    portal._TONE_BANNED = _saved + ("recibido",)
    portal.acknowledgement(1, "")
    ck("P11 a sentence that broke the law RAISES, it does not ship (no silent fallback)", False,
       "(it returned!)")
except AssertionError as _e:
    ck("P11 a sentence that broke the law RAISES, it does not ship (no silent fallback)",
       "§5.8a" in str(_e), str(_e)[:60])
finally:
    portal._TONE_BANNED = _saved

# ══ P5 · the phone is MASKED on a page anyone with the URL can open ═══════════════════════════════
ck("P5 the customer's number is masked to its last three digits",
   portal.mask_phone(BAR_LUMBRE) == "···· ··· 201", portal.mask_phone(BAR_LUMBRE))
ck("P5 …and a number we do not have masks to nothing rather than to a fake one",
   portal.mask_phone("") == "····" and portal.mask_phone("+3") == "····")

# ══ P6 · the page never shows OUR internal state ══════════════════════════════════════════════════
ck("P6 an order waiting on the comercial reads «recibido» to the customer",
   portal.STATUS_ES["needs_review"] == "recibido" and portal.STATUS_ES["preparing"] == "recibido")
ck("P6 …and NOTHING in the customer-facing status set leaks our queue vocabulary",
   not any(w in " ".join(portal.STATUS_ES.values()).lower()
           for w in ("revis", "pendiente", "flag", "stock", "cola", "comercial")),
   " · ".join(sorted(set(portal.STATUS_ES.values()))))
ck("P6 an approved order is the ONLY one that reads «confirmado» — the word the tone law reserves",
   [k for k, v in portal.STATUS_ES.items() if v == "confirmado"] == ["approved"])

# ══ P7 · a total we cannot stand behind is not shown ══════════════════════════════════════════════
_priced = [{"importe": 12.5, "peso_variable": False}, {"importe": 7.5, "peso_variable": False}]
_variable = [{"importe": 12.5, "peso_variable": False}, {"importe": None, "peso_variable": True}]
_unpriced = [{"importe": 12.5, "peso_variable": False}, {"importe": None, "peso_variable": False}]
ck("P7 a fully priced order shows its total", portal._order_total(_priced) == 20.0)
ck("P7 one variable-weight line and there is NO total (the kilos are confirmed at dispatch)",
   portal._order_total(_variable) is None)
ck("P7 one unpriced line and there is NO total (a figure the invoice contradicts is a lie)",
   portal._order_total(_unpriced) is None)
ck("P7 an empty order has no total either", portal._order_total([]) is None)

# ══ P8 · the quantity rule (pure half) ════════════════════════════════════════════════════════════
ck("P8 a real quantity is accepted and rounded to grams",
   portal._qty("12.5") == 12.5 and portal._qty(3) == 3.0 and portal._qty("0.5") == 0.5)
ck("P8 zero, negative, empty, nonsense, infinity and absurd are ALL refused",
   all(portal._qty(v) is None for v in
       (0, -1, "", None, "muchos", float("inf"), float("nan"), 10 ** 9)))
ck("P8 every refusal has an es-ES sentence to show next to the line it is about",
   set(portal.REFUSALS_ES) == {"no_es_tuyo", "fuera_de_gama", "cantidad", "desconocido"}
   and all(v and v == v.lower() and " " in v for v in portal.REFUSALS_ES.values()))

# ══ P2 · the shape gate, for real ═════════════════════════════════════════════════════════════════
# `resolve` must refuse a malformed token WITHOUT touching the database — proven by calling it with
# no pool initialised at all: a DB hit here would raise, not return None.
_bad = asyncio.run(asyncio.wait_for(portal.resolve(""), 5))
ck("P2 an empty token resolves to nothing without ever reaching the database", _bad is None)
for _t in ("../../etc/passwd", "a" * 400, "tok en", "%27 or 1=1", "<script>"):
    ck(f"P2 «{_t[:18]}» resolves to nothing, without a query",
       asyncio.run(asyncio.wait_for(portal.resolve(_t), 5)) is None)

# ══ P3/P9 · the link and the rail live in ONE place ═══════════════════════════════════════════════
ck("P3 the URL is a real soyrocoto link with the token as its whole secret",
   portal.portal_url("TOK").endswith("/pedidos/TOK") and "://" in portal.portal_url("TOK"),
   portal.portal_url("TOK"))
ck("P3 the sentence that carries it speaks to the customer's own use of it, never to how we built it",
   "pedidos" in portal.link_line_es("https://x/y").lower()
   and not any(w in portal.link_line_es("https://x/y").lower()
               for w in ("portal", "token", "enlace seguro", "sistema", "app")),
   portal.link_line_es("https://soyrocoto.com/pedidos/…"))

_src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         "portal.py"), encoding="utf-8").read()
ck("P9 the reorder files through brain/events — the SAME fold a WhatsApp order uses",
   "events.create_order" in _src and "events.finalize_order" in _src)
# The only statuses this module may WRITE are 'preparing' (the placeholder) and 'needs_review' (the
# filed order). `approved` appears exactly once — as a READ label in STATUS_ES, which is what the
# customer sees when the comercial has already decided. Asserted on the AST, so a check cannot pass
# on a comment and cannot fail on a label.
import ast as _ast  # noqa: E402

_mod = _ast.parse(_src)
_status_writes = {n.value for n in _ast.walk(_mod)
                  if isinstance(n, _ast.keyword) and n.arg == "status"
                  and isinstance(n.value, _ast.Constant)}
_status_writes = {n.value for n in _status_writes if isinstance(n.value, str)} | {
    v.value for k, v in
    [(k, v) for d in _ast.walk(_mod) if isinstance(d, _ast.Dict)
     for k, v in zip(d.keys, d.values)
     if isinstance(k, _ast.Constant) and k.value == "status" and isinstance(v, _ast.Constant)]}
ck("P10 the only order status this module can WRITE is preparing → needs_review",
   _status_writes <= {"preparing", "needs_review"}, str(sorted(_status_writes)))
ck("P10 …and it calls no status setter at all — approving is the comercial's, always",
   "order_set_status" not in _src and "set_status" not in _src and "submit_order" not in _src)
ck("P10 the order is filed at needs_review, explicitly",
   'status="needs_review"' in _src)
ck("P13 the review decision is CALLED, not reimplemented",
   "pipeline.order_checks" in _src and "pipeline.park_decision" in _src
   and "review.hold_for_review" in _src)
ck("P12 the acknowledgement rides the ONE outbound rail, and crosses the gate",
   "actions.send_whatsapp_as_rocoto" in _src and "gate.check_outbound" in _src)
ck("P12 …and this module owns no second mouth (no direct Meta / Twilio send anywhere in it)",
   "whatsapp_cloud" not in _src and "twilio" not in _src.lower())


# ══ THE DATABASE HALF (needs a clone) ═════════════════════════════════════════════════════════════
async def _db_checks(dsn):
    import db
    await db.init()
    async with db.get_pool().acquire() as con:
        name = await con.fetchval("select current_database()")
        if name == "rocoto":
            raise SystemExit("REFUSING to run vital_portal against the LIVE 'rocoto' DB "
                             "— use rocoto_rehearsal")
        print(f"  (db={name})")

    await portal.ensure_schema()
    oids = [f"vitalportal-{i}" for i in range(1, 6)]
    phones = [BAR_LUMBRE, CAFE_SOTILLO, MESON_PERAL]
    skus = [SKU_JAMON, SKU_QUESO, SKU_LOMO, SKU_GONE, SKU_OTHER]
    pool = db.get_pool()

    async def _teardown():
        """Leave the clone exactly as it was found — every row this vital could have caused, by the
        keys it owns (its own tenants, its own invented phones, its own sku ids)."""
        async with pool.acquire() as con:
            mine = [r["id"] for r in await con.fetch(
                "select id from orders where phone_number = any($1::text[])", phones)] + oids
            for tbl in ("order_events", "medusa_sync"):
                try:
                    await con.execute(f"delete from {tbl} where order_id = any($1::text[])", mine)
                except Exception:
                    pass
            await con.execute("delete from portal_tokens where tenant_id = any($1::text[])",
                              [TENANT, OTHER_TENANT])
            await con.execute("delete from orders where phone_number = any($1::text[])", phones)
            await con.execute("delete from whatsapp_messages where phone_number = any($1::text[])",
                              phones)
            await con.execute("delete from customer_profiles where tenant_id = any($1::text[])",
                              [TENANT, OTHER_TENANT])
            try:
                await con.execute("delete from stock_levels where tenant_id = any($1::text[])",
                                  [TENANT, OTHER_TENANT])
            except Exception:
                pass
            await con.execute("delete from catalogue_skus where id = any($1::text[])", skus)
            try:
                await con.execute("delete from tenant_range where tenant_id = any($1::text[])",
                                  [TENANT, OTHER_TENANT])
            except Exception:
                pass
            for ph in phones:
                sc = "wa." + ph.lstrip("+")
                for tbl in ("action", "timer", "open_loop", "event", "scope_state", "scope_node"):
                    try:
                        await con.execute(f"delete from {tbl} where scope = $1::ltree", sc)
                    except Exception:
                        pass

    await _teardown()
    try:
        # ── the world: one tenant, two of its customers, a third on ANOTHER tenant ───────────────
        async with pool.acquire() as con:
            for sku, nm, price, var, assort, tid in (
                    (SKU_JAMON, "JAMÓN COCIDO EXTRA KG", 8.40, False, True, TENANT),
                    (SKU_QUESO, "QUESO CURADO OVEJA KG", 12.90, True, True, TENANT),
                    (SKU_LOMO, "LOMO EMBUCHADO KG", 21.00, False, True, TENANT),
                    (SKU_GONE, "MORCILLA DE ARROZ KG", 5.10, False, False, TENANT),
                    (SKU_OTHER, "PIMENTÓN DE LA VERA KG", 9.00, False, True, OTHER_TENANT)):
                await con.execute(
                    "insert into catalogue_skus (id, tenant_id, code, name, base_unit, price, "
                    "variable_weight, in_assortment) values ($1,$2,$3,$4,'kg',$5,$6,$7) "
                    "on conflict (id) do update set tenant_id=excluded.tenant_id, "
                    "name=excluded.name, price=excluded.price, "
                    "variable_weight=excluded.variable_weight, "
                    "in_assortment=excluded.in_assortment",
                    sku, tid, sku.upper(), nm, price, var, assort)
            for ph, disp, tid in ((BAR_LUMBRE, "Bar Lumbre", TENANT),
                                  (CAFE_SOTILLO, "Café Sotillo", TENANT),
                                  (MESON_PERAL, "Mesón Peral", OTHER_TENANT)):
                await con.execute(
                    "insert into customer_profiles (phone_number, tenant_id, display_name) "
                    "values ($1,$2,$3) on conflict (tenant_id, phone_number) do update set "
                    "tenant_id=excluded.tenant_id, display_name=excluded.display_name",
                    ph, tid, disp)

            def _line(sku, name, qty, price, var=False):
                return {"sku_id": sku, "name": name, "item": name, "qty": qty, "unit": "kg",
                        "price": price, "line_total": (None if var else round(qty * price, 2)),
                        "variable_weight": var}

            # Bar Lumbre's own history: jamón (twice), queso (variable weight), and one morcilla
            # that has since left the assortment.
            hist = [
                (oids[0], BAR_LUMBRE, "needs_review",
                 [_line(SKU_JAMON, "JAMÓN COCIDO EXTRA KG", 10, 8.40)], 3),
                (oids[1], BAR_LUMBRE, "approved",
                 [_line(SKU_JAMON, "JAMÓN COCIDO EXTRA KG", 8, 8.40),
                  _line(SKU_QUESO, "QUESO CURADO OVEJA KG", 4, 12.90, var=True)], 10),
                (oids[2], BAR_LUMBRE, "sent",
                 [_line(SKU_GONE, "MORCILLA DE ARROZ KG", 6, 5.10)], 40),
                (oids[3], CAFE_SOTILLO, "approved",
                 [_line(SKU_LOMO, "LOMO EMBUCHADO KG", 2, 21.00)], 5),
            ]
            for oid, ph, st, lns, days in hist:
                await con.execute(
                    "insert into orders (id, phone_number, customer_name, status, lines, created_at) "
                    "values ($1,$2,'',$3,$4,$5) on conflict (id) do update set "
                    "phone_number=excluded.phone_number, status=excluded.status, "
                    "lines=excluded.lines, created_at=excluded.created_at",
                    oid, ph, st, lns,
                    datetime.now(timezone.utc) - timedelta(days=days))

        # ── P3 · the link is stable; rotation is a mint ───────────────────────────────────────────
        a = await portal.link_for(BAR_LUMBRE)
        b = await portal.link_for(BAR_LUMBRE)
        ck("P3/db asking twice gives the SAME link (bookmarkable; every message can carry it)",
           a["token"] == b["token"] and b["minted"] is False, a["url"][-12:])
        ck("P3/db the link is bound to the customer's OWN tenant, off their profile row",
           a["tenant_id"] == TENANT, a["tenant_id"])
        c = await portal.rotate(BAR_LUMBRE)
        ck("P3/db rotating issues a NEW link", c["token"] != a["token"])
        ck("P3/db …and the old one is dead the same instant",
           await portal.resolve(a["token"]) is None)
        async with pool.acquire() as con:
            n_active = await con.fetchval(
                "select count(*) from portal_tokens where tenant_id=$1 and phone_number=$2 "
                "and status='active'", TENANT, BAR_LUMBRE)
        ck("P3/db there is never more than ONE live link per customer (the DB enforces it)",
           n_active == 1, f"{n_active} active")
        tok = c["token"]

        # ── P1 · the link is theirs and nobody else's ─────────────────────────────────────────────
        who = await portal.resolve(tok, touch=False)
        ck("P1/db the token resolves to exactly one (tenant, cliente)",
           who and who["tenant_id"] == TENANT and who["phone_number"] == BAR_LUMBRE)
        other = await portal.link_for(CAFE_SOTILLO)
        page_them = await portal.view(other["token"])
        ck("P1/db another customer's link shows THEIR orders and not one line of Bar Lumbre's",
           page_them and [p["id"] for p in page_them["pedidos"]] == [oids[3]],
           str([p["id"] for p in (page_them or {}).get("pedidos", [])]))
        ck("P1/db …and it cannot even see Bar Lumbre's sku in «lo de siempre»",
           all(h["sku_id"] != SKU_JAMON for h in (page_them or {}).get("habituales", [])))

        # ── P2 · a dead link looks like one that never existed ────────────────────────────────────
        await portal.revoke(CAFE_SOTILLO)
        ck("P2/db a REVOKED link resolves to exactly the same nothing as a made-up one",
           await portal.resolve(other["token"]) is None
           and await portal.resolve("Zm9vYmFyYmF6cXV1eA") is None)
        ck("P2/db …and the page refuses it identically (the route answers ONE 404)",
           await portal.view(other["token"]) is None
           and await portal.view("Zm9vYmFyYmF6cXV1eA") is None)
        async with pool.acquire() as con:
            await con.execute(
                "update portal_tokens set expires_at = now() - interval '1 day' where token=$1", tok)
        ck("P2/db an EXPIRED link is dead too, with the same silence",
           await portal.resolve(tok) is None and await portal.view(tok) is None)
        async with pool.acquire() as con:
            await con.execute(
                "update portal_tokens set expires_at = now() + interval '30 days' where token=$1",
                tok)
        async with pool.acquire() as con:
            _revoked = await con.fetchval(
                "select count(*) from portal_tokens where tenant_id=$1 and status='revoked'", TENANT)
        ck("P2/db revocation is a STATUS, never a delete — we can still answer «who had a link»",
           _revoked >= 1, f"{_revoked} revocados en el registro")

        # ── P4 · used links live, forgotten links die ─────────────────────────────────────────────
        async with pool.acquire() as con:
            before = await con.fetchval("select expires_at from portal_tokens where token=$1", tok)
        await portal.resolve(tok)
        async with pool.acquire() as con:
            after, uses = await con.fetchrow(
                "select expires_at, uses from portal_tokens where token=$1", tok)
        ck("P4/db using the link pushes its expiry out (a working link never dies)",
           after > before, f"+{(after - before).days}d")
        ck("P4/db …and the use is counted, so an unused link can be found and swept", uses >= 1)

        # ── P5/P6/P7 · the page ───────────────────────────────────────────────────────────────────
        page = await portal.view(tok)
        ck("P5/db the page names the restaurant and MASKS their number",
           page["cliente"]["nombre"] == "Bar Lumbre"
           and page["cliente"]["telefono"] == "···· ··· 201"
           and BAR_LUMBRE not in str(page), page["cliente"]["telefono"])
        ck("P5/db it shows THEIR orders, newest first",
           [p["id"] for p in page["pedidos"]] == [oids[0], oids[1], oids[2]],
           str([p["id"] for p in page["pedidos"]]))
        ck("P6/db the order waiting on the comercial reads «recibido», never our queue's words",
           page["pedidos"][0]["estado"] == "recibido"
           and "revis" not in str(page["pedidos"][0]).lower())
        ck("P7/db the fully priced order shows its total",
           page["pedidos"][0]["total"] == 84.0, str(page["pedidos"][0]["total"]))
        ck("P7/db the order with a variable-weight line shows NO total",
           page["pedidos"][1]["total"] is None)
        ck("P5/db «lo de siempre» offers what they actually buy, with the last quantity ready",
           {h["sku_id"] for h in page["habituales"]} == {SKU_JAMON, SKU_QUESO}
           and next(h for h in page["habituales"] if h["sku_id"] == SKU_JAMON)["cantidad_habitual"] == 10,
           str(sorted(h["sku_id"] for h in page["habituales"])))
        ck("P8/db a product that LEFT the assortment is not offered back to them at all",
           all(h["sku_id"] != SKU_GONE for h in page["habituales"]))
        ck("P5/db every customer-facing key on the page is es-ES (LOCKED LAW)",
           set(page) == {"cliente", "proveedor", "pedidos", "habituales", "caduca"}
           and set(page["pedidos"][0]) == {"id", "fecha", "entrega", "estado", "estado_clave",
                                           "lineas", "total", "nota", "en_curso", "pagado_tarjeta",
                                           "factura_url", "documento_url", "se_puede_pagar"},
           str(sorted(page)))

        # ── P8/P9/P10/P12/P14 · the reorder ───────────────────────────────────────────────────────
        out = await portal.reorder(tok, [
            {"sku_id": SKU_JAMON, "qty": 12},                 # theirs, in assortment → ORDERED
            {"sku_id": SKU_QUESO, "qty": 3},                  # theirs, variable weight → ORDERED
            {"sku_id": SKU_LOMO, "qty": 5},                   # in the catalogue, NEVER theirs
            {"sku_id": SKU_GONE, "qty": 2},                   # theirs once, now out of assortment
            {"sku_id": SKU_OTHER, "qty": 1},                  # ANOTHER TENANT'S sku
            {"sku_id": SKU_JAMON, "qty": "muchos"},           # nonsense quantity
            {"sku_id": "no-existe", "qty": 1},                # invented outright
        ])
        ck("P9/db the reorder is filed and returns its order id", out and out.get("ok")
           and out.get("pedido_id"), str((out or {}).get("pedido_id")))
        ordered = {ln["sku_id"] for ln in out["lineas"]}
        refused = {r["sku_id"]: r["motivo"] for r in out["rechazadas"]}
        ck("P8/db ONLY the two products they have actually ordered before are cursed through",
           ordered == {SKU_JAMON, SKU_QUESO}, str(sorted(ordered)))
        ck("P8/db a product they never ordered is refused BY NAME, not dropped",
           refused.get(SKU_LOMO) == "no_es_tuyo")
        ck("P8/db a product that left the assortment is refused BY NAME",
           refused.get(SKU_GONE) == "fuera_de_gama")
        ck("P8/db ANOTHER TENANT'S sku is not even recognised (the tenant wall holds on the write)",
           refused.get(SKU_OTHER) == "desconocido")
        ck("P8/db an invented sku is refused, never guessed at (§4.3: abstain, don't guess)",
           refused.get("no-existe") == "desconocido")
        ck("P8/db a nonsense quantity is refused with its own reason",
           any(r["motivo"] == "cantidad" for r in out["rechazadas"]))
        ck("P8/db every refusal carries an es-ES sentence to show the customer",
           all(r.get("por_que") for r in out["rechazadas"]))

        async with pool.acquire() as con:
            o = await con.fetchrow("select * from orders where id=$1", out["pedido_id"])
            msg = await con.fetchrow(
                "select * from whatsapp_messages where phone_number=$1 "
                "order by created_at desc limit 1", BAR_LUMBRE)
        ck("P10/db it lands NEEDS_REVIEW — the comercial decides, the portal never approves",
           o["status"] == "needs_review", str(o["status"]))
        lns = {ln["sku_id"]: ln for ln in (o["lines"] or [])}
        ck("P9/db the filed lines carry the CATALOGUE's name, code and price — never the wire's",
           lns[SKU_JAMON]["name"] == "JAMÓN COCIDO EXTRA KG"
           and lns[SKU_JAMON]["code"] == SKU_JAMON.upper()
           and lns[SKU_JAMON]["price"] == 8.40 and lns[SKU_JAMON]["qty"] == 12,
           str(lns[SKU_JAMON].get("price")))
        ck("P9/db a variable-weight line carries NO line total (the kilos are settled at dispatch)",
           lns[SKU_QUESO]["variable_weight"] is True and lns[SKU_QUESO]["line_total"] is None)
        async with pool.acquire() as con:
            _nev = await con.fetchval(
                "select count(*) from order_events where order_id=$1", out["pedido_id"])
        ck("P9/db it is on the SAME event-sourced rail — the order has its own event trail",
           _nev >= 2, f"{_nev} eventos")
        ck("P9/db …and it shows up in the one order list every surface reads",
           any(x["id"] == out["pedido_id"] for x in await db.order_list("needs_review")))
        ck("P14/db the intake row says PORTAL — we do not fake a WhatsApp message in the log",
           msg and msg["message_type"] == "portal" and msg["role"] == "user",
           str((msg or {}).get("message_type")))
        ck("P14/db …and it reads like the order they sent, so the comercial has one thread",
           msg and "JAMÓN COCIDO EXTRA KG" in (msg["message_text"] or ""),
           (msg["message_text"] or "")[:40] if msg else "")

        # ── P12 · Rocoto writes to them, on the one mouth ─────────────────────────────────────────
        import config as _cfg
        ck("P12/db the acknowledgement crossed the outbound rail",
           out.get("aviso_enviado") is True, str(out.get("aviso_id")))
        ck("P12/db …under the egress sandbox, so NOTHING reached a real phone",
           bool(_cfg.EGRESS_SANDBOX) and str(out.get("aviso_id", "")).startswith("SANDBOX"),
           f"sandbox={bool(_cfg.EGRESS_SANDBOX)} sid={out.get('aviso_id')}")
        async with pool.acquire() as con:
            sent = await con.fetchrow(
                "select payload from event where scope=$1::ltree and type='msg.sent' "
                "order by id desc limit 1", "wa." + BAR_LUMBRE.lstrip("+"))
        ck("P12/db the send is EVENTED as msg.sent on the customer's own scope",
           sent is not None)
        ck("P11/db the sentence that actually went out obeys the tone law",
           sent and "déjame que lo confirme" in str(sent["payload"].get("text", "")).lower()
           and not any(w in str(sent["payload"].get("text", "")).lower()
                       for w in ("listo", "apuntado", "anotado", "confirmado")),
           str(sent["payload"].get("text", ""))[:70] if sent else "")

        # ── P13 · the review decision still runs ──────────────────────────────────────────────────
        # Put the depot 400 km from a customer whose point we know, and reorder: the SAME range check
        # a WhatsApp order crosses must park this one, with ONE reason.
        async with pool.acquire() as con:
            await con.execute(
                "update customer_profiles set lat=41.3874, lon=2.1686 where phone_number=$1",
                BAR_LUMBRE)
            try:
                await con.execute(
                    "insert into tenant_range (tenant_id, range_kind, range_km, depot_lat, depot_lon) "
                    "values ($1,'radius',25,40.4168,-3.7038) on conflict (tenant_id) do update set "
                    "range_kind='radius', range_km=25, depot_lat=40.4168, depot_lon=-3.7038",
                    TENANT)
                _has_range = True
            except Exception:
                _has_range = False
        if _has_range:
            async with pool.acquire() as con:
                await con.execute("delete from action where scope=$1::ltree",
                                  "wa." + BAR_LUMBRE.lstrip("+"))
            out2 = await portal.reorder(tok, [{"sku_id": SKU_JAMON, "qty": 2}])
            async with pool.acquire() as con:
                acts = await con.fetch(
                    "select kind, reason, payload from action where scope=$1::ltree "
                    "and needs_human and state='pending'", "wa." + BAR_LUMBRE.lstrip("+"))
            ck("P13/db a portal order outside the delivery radius is PARKED, like a WhatsApp one",
               len(acts) >= 1, f"{len(acts)} parked")
            ck("P13/db …and it carries exactly ONE reason, never a list (§5.8a)",
               len(acts) == 1 and isinstance(acts[0]["payload"].get("text"), str)
               and "\n" not in acts[0]["payload"]["text"],
               (acts[0]["payload"].get("text") or "")[:60] if acts else "")
            ck("P13/db the reason reads as DISTANCE, and claims nothing about a zone",
               acts and ("km" in (acts[0]["payload"].get("text") or "").lower())
               and "zona" not in (acts[0]["payload"].get("text") or "").lower(),
               (acts[0]["payload"].get("text") or "")[:60] if acts else "")
            ck("P13/db the park says it came through the portal, so the drill-down can say so",
               acts and acts[0]["payload"].get("channel") == "portal")
            async with pool.acquire() as con:
                _st2 = await con.fetchval("select status from orders where id=$1",
                                          out2["pedido_id"]) if out2 and out2.get("ok") else None
            ck("P10/db the parked order is STILL needs_review — nothing auto-approved around it",
               _st2 == "needs_review", str(_st2))
        else:
            skip("P13 the review decision on a portal order", "no tenant_range table on this clone")
    finally:
        await _teardown()


_dsn = os.environ.get("REHEARSAL_DSN")
if _dsn:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _dsn)
    os.environ.setdefault("ROCOTO_EGRESS_SANDBOX", "1")
    asyncio.run(_db_checks(_dsn))
else:
    skip("P1/P3/P4/P5/P6/P7/P9/P10/P12/P13/P14 (the round-trip)",
         "no REHEARSAL_DSN (pure checks still ran)")

passed = sum(R)
print(f"vital_portal: {passed}/{len(R)}" + (f" (+{len(SKIPPED)} skipped)" if SKIPPED else "")
      + (" — THE DOOR IS THEIRS, AND IT PROMISES NOTHING" if passed == len(R) else " — BROKEN"))
sys.exit(0 if passed == len(R) else 1)
