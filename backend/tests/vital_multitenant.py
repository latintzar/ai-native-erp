"""vital_multitenant.py — DOS DISTRIBUIDORES EN LA MISMA CAJA, Y UN CLIENTE QUE COMPRA A LOS DOS.

WHAT THIS EXISTS TO PROVE. `vital_cold_tenant` (Peter's «BOOM» acceptance test) came back 55/61 with
four FAILs that were all the same defect wearing four hats: nothing in the inbound path ever asked
WHICH DISTRIBUTOR a message was for. Meta's webhook carries `value.metadata.phone_number_id` — the
business line the customer wrote TO, which IS the distributor — and it was read nowhere, so every
inbound on every rail was processed as `config.BRAIN_TENANT`; and the `orders` table, alone among the
commerce tables, had no tenant column at all. Peter is tenant #1, so nothing was broken for him. The
moment a SECOND distributor is onboarded, their orders and their review sheet mix with his.

This vital is that second distributor. Two invented suppliers (Quixote names, never a real company),
two WhatsApp lines, and — the case that actually hurts — ONE restaurant, ONE phone number, buying
from BOTH of them. A shared customer is not a corner case: it is the normal shape of a food market.

THROUGH THE REAL PATH, not by asserting that a predicate exists:
  · LA PUERTA      a real Meta webhook payload (signed) POSTed to the real ASGI app, once per line
  · EL DRENADOR    `brain/queue.claim_due_phone` + `brain/jobs`, the production drainer contract
  · LOS PEDIDOS    `brain/events.create_order` — the writer `pipeline._build_order` itself calls
  · LA HOJA        the body of `GET /api/app/review`, called with a session ctx
  · EL CATÁLOGO    `brain/catalogue.company_catalogue`, the read the app's product list uses
The ONE thing stubbed is the auth dependency on the review route (a Supabase bearer): who a session
resolves to is `vital_tenant_isolation`'s and `vital_sup_auth`'s job, and they already hold it. The
catalogue rows are inserted as fixtures (writing them is `vital_cold_tenant`'s job); every READ under
test is the product's own.

SAFETY: refuses the live `rocoto` database BY NAME. Cleans up every row it creates, keyed on its own
prefixes, so a re-run is identical to a first run.

Standalone:  source deploy/harness/rehearsal_env.sh && PYTHONPATH=. python tests/vital_multitenant.py
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# The rehearsal env MUST win: setdefault means an exported clone DSN is never overwritten by prod's.
for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())
# The Meta door verifies X-Hub-Signature-256 and REFUSES when FB_APP_SECRET is unset (app.py: "an
# unset secret refuses every request"). Off the box neither side has one, so this file's signed
# webhook met a 403 and five of its six door checks fell with it. Which secret it is does not matter
# — both sides read the same name — and with one the signature path is genuinely exercised instead
# of skipped. setdefault, so the box keeps its own.
os.environ.setdefault("FB_APP_SECRET", "vital-app-secret")
os.environ["ROCOTO_EGRESS_SANDBOX"] = "1"      # nothing reaches a real party
os.environ["ROCOTO_TEXT_REPLY_ENABLED"] = "0"  # no model call on the inbound door
os.environ["ORDER_BRAIN_ENABLED"] = "1"        # the durable queue IS the path under test
os.environ["BRAIN_DEBOUNCE_SECONDS"] = "0"     # a burst is due immediately in a test
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-media-multitenant")

import config  # noqa: E402
import db  # noqa: E402

R: list[bool] = []


def ck(name: str, ok: bool, detail: str = "") -> bool:
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""), flush=True)
    return bool(ok)


def info(msg: str) -> None:
    print(f"       · {msg}", flush=True)


# ── EL REPARTO (invented — never a real company, never a seed name) ──────────────────────────────
T_A, T_B = "vitalmt-norte", "vitalmt-sur"
NAME_A, NAME_B = "Embutidos Rocinante S.L.", "Quesos Dulcinea S.L."
LINE_A, LINE_B = "+34910990101", "+34910990102"        # each distributor's own WhatsApp line
PNID_A, PNID_B = "770000000000101", "770000000000102"  # Meta's numeric id for those lines
PNID_X = "770000000000999"                             # a line bound to nobody — the loud path

# THE POINT OF THE WHOLE FILE: ONE restaurant, ONE number, buying from BOTH distributors.
SHARED = "+34655990901"
SHARED_NAME = "Bar Clavileño"
ONLY_A = "+34655990902"     # a customer of A alone (the control)

SKU_A, SKU_B = "vitalmt-sku-a", "vitalmt-sku-b"
PREFIX = "vitalmt-"


def guard_clone() -> None:
    """NEVER run against production. The DSN must name a rehearsal clone."""
    dsn = config.DATABASE_URL or ""
    tail = dsn.rsplit("/", 1)[-1].split("?")[0]
    if "/rocoto_rehearsal" not in dsn or tail == "rocoto":
        print(f"REFUSED: DATABASE_URL is not a rehearsal clone (db={tail!r}). "
              "source deploy/harness/rehearsal_env.sh first.")
        sys.exit(2)


# ── fixtures ─────────────────────────────────────────────────────────────────────────────────────
async def _seed() -> None:
    async with db.get_pool().acquire() as con:
        for slug, name, line, pnid in ((T_A, NAME_A, LINE_A, PNID_A), (T_B, NAME_B, LINE_B, PNID_B)):
            await con.execute(
                "insert into tenants (slug, name, status, number, wa_phone_number_id) "
                "values ($1,$2,'live',$3,$4) on conflict (slug) do update set "
                "status='live', number=excluded.number, wa_phone_number_id=excluded.wa_phone_number_id",
                slug, name, line, pnid)
        for sku, slug, pname in ((SKU_A, T_A, "Chorizo sarta picante"),
                                 (SKU_B, T_B, "Queso curado de oveja")):
            await con.execute(
                "insert into catalogue_skus (id, tenant_id, name, family, base_unit, price, "
                "  in_assortment, search_text) "
                "values ($1,$2,$3,'','kg',9.90,true, to_tsvector('spanish',$3)) "
                "on conflict (id) do update set tenant_id=excluded.tenant_id, name=excluded.name",
                sku, slug, pname)
    import tenancy
    tenancy.forget_wa_cache()   # the registry just changed; do not wait out the TTL


async def _cleanup() -> None:
    phones = [SHARED, ONLY_A]
    async with db.get_pool().acquire() as con:
        await con.execute("delete from order_events where order_id in "
                          "(select id from orders where phone_number = any($1::text[]))", phones)
        await con.execute("delete from medusa_sync where sancho_order_id in "
                          "(select id from orders where phone_number = any($1::text[]))", phones)
        await con.execute("delete from orders where phone_number = any($1::text[])", phones)
        await con.execute("delete from ingest_queue where phone_number = any($1::text[])", phones)
        await con.execute("delete from whatsapp_messages where phone_number = any($1::text[])", phones)
        await con.execute("delete from whatsapp_user_profiles where phone_number = any($1::text[])", phones)
        await con.execute("delete from customer_profiles where phone_number = any($1::text[])", phones)
        await con.execute("delete from sku_aliases where tenant_id = any($1::text[])", [T_A, T_B])
        await con.execute("delete from catalogue_skus where id like $1", PREFIX + "%")
        await con.execute("delete from catalogue_directory where tenant_id = any($1::text[])", [T_A, T_B])
        await con.execute("delete from tenants where slug = any($1::text[])", [T_A, T_B])
        await con.execute("delete from dead_letter where source='tenancy'")
    # THE RUNTIME TABLES GO THROUGH `scoped_tx`, NOT THE CTRL POOL. Every scope-keyed table is
    # `force row level security` and tier-P (rocoto_ctrl) is granted SELECT plus INSERT/UPDATE on
    # event+action ONLY — it has no DELETE anywhere. A cleanup written on the ctrl pool therefore
    # raises permission-denied on every table and, wrapped in a try/except, deletes NOTHING while
    # looking like it worked. (It did exactly that here first: a crashed run left `action` rows that
    # showed up on the next run's review sheet.) `scoped_tx` connects as rocoto_rt with the scope
    # GUC set, which is the one identity allowed to delete a scope's own rows.
    scopes = [f"wa.{''.join(c for c in p if c.isdigit())}" for p in phones]
    for sc in scopes:
        try:
            async with db.scoped_tx(sc) as con:
                # endpoint FIRST: it FKs to contact, so the reverse order fails the whole txn and
                # leaves the scope's rows behind (which is how a crashed run's `action` rows showed
                # up on the next run's review sheet).
                await con.execute("delete from endpoint where addr = any($1::text[])", phones)
                for tbl in ("action", "event", "fact", "card", "summary", "open_loop", "timer",
                            "pending_turn", "scope_state", "sweep_state", "wake",
                            "assembly_snapshot", "contact_role", "contact", "scope_node"):
                    await con.execute(f"delete from {tbl} where scope::text = $1", sc)
        except Exception as e:
            print(f"       (cleanup {sc}: {e})")


# ── LA PUERTA — a real, signed Meta webhook, one per business line ───────────────────────────────
def _meta_payload(pnid: str, frm: str, name: str, text: str, wamid: str) -> dict:
    return {"object": "whatsapp_business_account", "entry": [{"id": "0", "changes": [{
        "field": "messages",
        "value": {
            "messaging_product": "whatsapp",
            "metadata": {"display_phone_number": "0", "phone_number_id": pnid},
            "contacts": [{"wa_id": frm.lstrip("+"), "profile": {"name": name}}],
            "messages": [{"from": frm.lstrip("+"), "id": wamid, "timestamp": str(int(time.time())),
                          "type": "text", "text": {"body": text}}],
        }}]}]}


async def _post_webhook(client, payload: dict) -> int:
    raw = json.dumps(payload).encode()
    headers = {"content-type": "application/json"}
    if config.FB_APP_SECRET:
        headers["X-Hub-Signature-256"] = "sha256=" + hmac.new(
            config.FB_APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    r = await client.post("/meta/whatsapp/webhook", content=raw, headers=headers)
    return r.status_code


async def _wait_for(fn, timeout: float = 12.0, every: float = 0.2):
    """The webhook answers 200 and finishes its work on detached tasks — poll, never sleep-and-hope."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        v = await fn()
        if v:
            return v
        await asyncio.sleep(every)
    return await fn()


async def main() -> int:
    guard_clone()
    import httpx

    import app as rocoto_app
    import runtime
    import tenancy
    from brain import catalogue as brain_catalogue
    from brain import events as brain_events
    from brain import queue as brain_queue

    await db.init()
    await _cleanup()
    await _seed()
    print(f"── LA CAJA: {NAME_A} ({T_A}, {LINE_A}) · {NAME_B} ({T_B}, {LINE_B})")
    print(f"   EL CLIENTE COMPARTIDO: {SHARED_NAME} {SHARED} — compra a los dos\n")

    print("── ① LA PUERTA · el número por el que entra el mensaje decide de quién es")
    ck("un número de WhatsApp desconocido resuelve al inquilino de la caja, y AVISA",
       (await tenancy.tenant_for_wa_number_id(PNID_X)) == (config.BRAIN_TENANT, False))
    async with db.get_pool().acquire() as con:
        shouted = await con.fetchval(
            "select count(*) from dead_letter where source='tenancy' and reason like 'unknown_%'")
    ck("ese aviso queda escrito (dead_letter), nunca se traga en silencio", int(shouted or 0) >= 1,
       f"{shouted} fila(s)")
    ck("la línea de cada distribuidor resuelve a SU empresa",
       (await tenancy.tenant_for_wa_number_id(PNID_A))[0] == T_A
       and (await tenancy.tenant_for_wa_number_id(PNID_B))[0] == T_B)

    wamid_a, wamid_b = "wamid.MT" + uuid.uuid4().hex[:16], "wamid.MT" + uuid.uuid4().hex[:16]
    transport = httpx.ASGITransport(app=rocoto_app.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://mt.test") as client:
        s1 = await _post_webhook(client, _meta_payload(
            PNID_A, SHARED, SHARED_NAME, "Buenas, ponme 10 kg de chorizo sarta para mañana", wamid_a))
        s2 = await _post_webhook(client, _meta_payload(
            PNID_B, SHARED, SHARED_NAME, "Hola, mándame 6 kg de queso curado el jueves", wamid_b))
    ck("la puerta contesta 200 a las dos entradas", s1 == 200 and s2 == 200, f"{s1}/{s2}")

    async def _msgs():
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select wa_message_id, tenant_id from whatsapp_messages where phone_number=$1", SHARED)
        return {r["wa_message_id"]: r["tenant_id"] for r in rows} if len(rows) >= 2 else None
    msgs = await _wait_for(_msgs) or {}
    ck("el mensaje guardado sabe por qué línea entró",
       msgs.get(wamid_a) == T_A and msgs.get(wamid_b) == T_B, str(msgs))

    async def _queued():
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select tenant_id, count(*) n from ingest_queue where phone_number=$1 group by 1", SHARED)
        return {r["tenant_id"]: r["n"] for r in rows} if len(rows) >= 2 else None
    q = await _wait_for(_queued) or {}
    ck("EL PEDIDO ENTRA EN LA COLA DE SU DISTRIBUIDOR, no en la del primero",
       q.get(T_A) == 1 and q.get(T_B) == 1, f"cola por empresa: {q}")

    print("\n── ② EL DRENADOR · vacía las dos colas, y nunca mezcla las ráfagas")
    claims = {}
    for _ in range(4):
        c = await brain_queue.claim_due_phone()
        if not c:
            break
        claims[c[0]] = (c[1], c[2])
    ck("el drenador reclama trabajo de LAS DOS empresas", set(claims) == {T_A, T_B}, str(list(claims)))
    ck("cada ráfaga lleva su propia empresa y su propio mensaje",
       claims.get(T_A, ("", []))[1] != claims.get(T_B, ("", []))[1]
       and all(v[0] == SHARED for v in claims.values()),
       "dos empresas, un teléfono, dos ráfagas distintas")

    print("\n── ③ LOS PEDIDOS · el libro de cada distribuidor es suyo")
    o_a = await brain_events.create_order(
        {"phone_number": SHARED, "customer_name": SHARED_NAME, "status": "needs_review",
         "lines": [{"item": "Chorizo sarta", "qty": 10, "unit": "kg", "sku_id": SKU_A}]},
        actor="system", tenant=T_A)
    o_b = await brain_events.create_order(
        {"phone_number": SHARED, "customer_name": SHARED_NAME, "status": "needs_review",
         "lines": [{"item": "Queso curado", "qty": 6, "unit": "kg", "sku_id": SKU_B}]},
        actor="system", tenant=T_B)
    o_a2 = await brain_events.create_order(
        {"phone_number": ONLY_A, "customer_name": "Freiduría Sansón", "status": "approved",
         "lines": [{"item": "Chorizo sarta", "qty": 2, "unit": "kg", "sku_id": SKU_A}]},
        actor="system", tenant=T_A)
    ck("un pedido nace sabiendo de quién es",
       o_a.get("tenant_id") == T_A and o_b.get("tenant_id") == T_B,
       f"{o_a.get('tenant_id')} / {o_b.get('tenant_id')}")

    list_a = {o["id"] for o in await db.order_list(tenant=T_A)}
    list_b = {o["id"] for o in await db.order_list(tenant=T_B)}
    ck("LA PESTAÑA DE PEDIDOS SÓLO ENSEÑA LOS PEDIDOS DE TU EMPRESA",
       o_b["id"] not in list_a and o_a["id"] not in list_b and o_a["id"] in list_a,
       f"norte={len(list_a)} sur={len(list_b)}")
    ck("abrir el pedido de otra empresa por su id no devuelve nada",
       await db.order_get(o_b["id"], tenant=T_A) is None
       and (await db.order_get(o_b["id"], tenant=T_B) or {}).get("id") == o_b["id"])
    ck("el mismo teléfono no comparte pedido: cada empresa ve el suyo",
       {r["id"] for r in await db.order_list(tenant=T_A)} & {o_b["id"]} == set())

    disp_a = [o["id"] for o in await db.orders_for_dispatch(tenant=T_A)]
    disp_b = [o["id"] for o in await db.orders_for_dispatch(tenant=T_B)]
    ck("el Excel del día se compila con los pedidos de una sola empresa",
       disp_a == [o_a2["id"]] and disp_b == [], f"norte={disp_a} sur={disp_b}")
    ck("«pendientes de revisar» cuenta lo tuyo, no lo del vecino",
       await db.orders_pending_review_count(tenant=T_A) == 1
       and await db.orders_pending_review_count(tenant=T_B) == 1)

    print("\n── ④ EL CLIENTE COMPARTIDO · una ficha abierta no se llena con el pedido del otro")
    prep_a = await brain_events.ensure_preparing(SHARED, SHARED_NAME, tenant=T_A)
    prep_b = await brain_events.ensure_preparing(SHARED, SHARED_NAME, tenant=T_B)
    ck("cada empresa abre SU propia ficha «preparando» para el mismo teléfono", prep_a != prep_b,
       f"{prep_a[:8]} vs {prep_b[:8]}")
    ck("volver a mirar devuelve la ficha de tu empresa, no la del otro",
       await brain_events.find_preparing(SHARED, T_A) == prep_a
       and await brain_events.find_preparing(SHARED, T_B) == prep_b)
    am_a = await brain_events.latest_amendable(SHARED, T_A)
    am_b = await brain_events.latest_amendable(SHARED, T_B)
    ck("«que sean 12 kilos» cambia el pedido de la empresa a la que se lo dijo",
       (am_a or {}).get("id") == o_a["id"] and (am_b or {}).get("id") == o_b["id"],
       f"{(am_a or {}).get('id')} / {(am_b or {}).get('id')}")

    print("\n── ⑤ LA HOJA · «lo que te toca» es tuyo y sólo tuyo")
    import review as review_mod
    # CADA MOTIVO SE RETIENE EN EL SCOPE DE SU PROPIA EMPRESA. Antes ambos colgaban de UN scope
    # plano compartido, que era la única forma posible cuando el grafo de identidad admitía una
    # sola parte por teléfono. Con la clave (tenant_slug, kind, addr) y el scope con la empresa en
    # la ruta, el cliente compartido tiene una parte por empresa — y construir el scope CON el
    # inquilino deja esta línea correcta en los dos modos: con la bandera apagada `scope_of` ignora
    # el inquilino y devuelve el camino plano de siempre.
    scope_a = runtime.scope_of(SHARED, T_A)
    scope_b = runtime.scope_of(SHARED, T_B)
    scope = scope_a           # el resto del bloque sigue usando `scope` para lo compartido
    for sc, oid, why in ((scope_a, o_a["id"], "Pídele que confirme los 10 kg de chorizo."),
                         (scope_b, o_b["id"], "Pídele que confirme los 6 kg de queso.")):
        await review_mod.hold_for_review(sc, review_mod.FLAG, text=why,
                                         detail={"order_id": oid, "cause": "vitalmt"})
    sheet_a = json.loads(bytes((await rocoto_app.api_app_review(ctx={"tenant_slug": T_A})).body))["items"]
    sheet_b = json.loads(bytes((await rocoto_app.api_app_review(ctx={"tenant_slug": T_B})).body))["items"]
    ids_a = {i["order_id"] for i in sheet_a}
    ids_b = {i["order_id"] for i in sheet_b}
    ck("LA HOJA DEL COMERCIAL YA NO ESTÁ VACÍA", bool(sheet_a) and bool(sheet_b),
       f"norte={len(sheet_a)} sur={len(sheet_b)}")
    ck("cada motivo aparece en la hoja de la empresa a la que le toca",
       o_a["id"] in ids_a and o_b["id"] in ids_b, f"{ids_a} / {ids_b}")
    ck("NINGUNA EMPRESA VE EL MOTIVO DE LA OTRA, ni compartiendo cliente y teléfono",
       o_b["id"] not in ids_a and o_a["id"] not in ids_b)
    ck("cada fila trae su frase en español y por qué está delante de ti",
       all((i.get("why") or "").strip() and i.get("review_source") for i in sheet_a + sheet_b))

    print("\n── ⑥ EL CATÁLOGO · lo que vende cada uno es suyo")
    cat_a = {p["id"] for p in await brain_catalogue.company_catalogue(tenant=T_A)}
    cat_b = {p["id"] for p in await brain_catalogue.company_catalogue(tenant=T_B)}
    ck("cada distribuidor sólo ve sus propios productos",
       cat_a == {SKU_A} and cat_b == {SKU_B}, f"norte={cat_a} sur={cat_b}")

    print("\n── ⑦ LA CAJA DE PETER SIGUE SIENDO LA SUYA (lo que no se puede romper)")
    ck("el inquilino de la caja no ha cambiado", config.BRAIN_TENANT == "rocoto",
       f"BRAIN_TENANT={config.BRAIN_TENANT!r}")
    ck("un pedido sin empresa declarada sigue cayendo en la de la caja",
       (await db.order_insert({"id": PREFIX + "fallback", "phone_number": ONLY_A,
                               "status": "needs_review", "lines": []}))["tenant_id"]
       == config.BRAIN_TENANT)
    async with db.get_pool().acquire() as con:
        await con.execute("delete from orders where id=$1", PREFIX + "fallback")
    async with db.control_pool().acquire() as con:
        bound = await con.fetchval("select tenant_slug from scope_node where scope=$1::ltree", scope)
    ck("el cliente que escribe queda atado a una empresa (ya no NULL)", bool(bound),
       f"scope_node.tenant_slug={bound!r}")

    # ── ⑧ EL CLIENTE COMPARTIDO: DOS EMPRESAS, DOS MEMORIAS (WP-A1 fase C) ────────────────────
    # Antes: `endpoint` sólo tenía UNIQUE (kind, addr), así que el grafo de identidad admitía UNA
    # sola parte por número de teléfono en toda la caja — la segunda empresa pedía su cliente por
    # teléfono y recibía el cliente de la PRIMERA, sin que saltara ningún error. Medido, no supuesto
    # (A1-TENANT-SCOPE-CUTOVER §7.1). Ahora la clave es (tenant_slug, kind, addr) y el scope lleva
    # la empresa en la ruta, así que cada una tiene su parte y su memoria.
    #
    # Este bloque sustituye al viejo ⑧ («lo que este pase no cierra»), que describía justo esta
    # limitación. La ley: un vital dice lo que ES verdad hoy — cuando la verdad cambia, se reescribe
    # la afirmación, no se parchea para que pase.
    print("\n── ⑧ EL CLIENTE COMPARTIDO TIENE DOS MEMORIAS (fase C)")
    import tenancy
    pathed = tenancy.SCOPE_PATHED
    if not pathed:
        info("ROCOTO_SCOPE_PATHED=0 → el scope sigue plano y el cliente compartido comparte memoria. "
             "Es el estado por defecto y es correcto hasta que se encienda la bandera; las "
             "afirmaciones de abajo sólo aplican con la bandera puesta.")
    else:
        async with db.control_pool().acquire() as con:
            rows = await con.fetch(
                "select scope::text as scope, tenant_slug from scope_node "
                "where scope::text like $1 order by scope", "%" + SHARED.replace("+", "")[-9:])
        owners = {r["tenant_slug"] for r in rows}
        ck("dos distribuidores que comparten cliente tienen DOS partes, no una",
           len(rows) >= 2, f"scopes={[r['scope'] for r in rows]}")
        ck("cada parte la posee su propia empresa", {T_A, T_B} <= owners,
           f"dueños={owners}")
        ck("ninguna parte queda sin dueño (un NULL aquí es la fuga silenciosa de §7.1)",
           None not in owners, f"dueños={owners}")
        async with db.control_pool().acquire() as con:
            cards = await con.fetchval(
                "select count(distinct scope) from card where scope::text like $1",
                "%" + SHARED.replace("+", "")[-9:])
        ck("la memoria (card) tampoco se comparte: una por empresa", int(cards or 0) >= 2,
           f"cards={cards}")

    print("\n── ⑨ LO QUE ESTE PASE SIGUE SIN CERRAR (medido, no supuesto)")
    info("`owns_runtime` sigue vallando 12 de sus 14 endpoints: sólo GET /orders y GET /orders/{id} "
         "filtran ya por inquilino. agent_settings y calls no tienen columna de empresa todavía "
         "(audits/2026-08-06-a1-fence-sites.md).")

    await _cleanup()
    ok = sum(1 for x in R if x)
    bad = len(R) - ok
    print(f"\n  {ok}/{len(R)} PASS" + (f", {bad} FAIL" if bad else ""))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
