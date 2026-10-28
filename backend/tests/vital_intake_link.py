"""vital_intake_link.py — INGESTION EVERYWHERE (SPEC §5.10.5).

Peter, 2026-07-27: *"the ingestion should work on desktop and mobile. Also if I ask to send me an
ingestion link to my email, it has to… Only difference is that with me, it changes the whole seeded
state. Unless I've asked you to seed relevant 'other' orders, it wouldn't have any and in any case my
demo will involve live sending voice notes to show the orders come in."*

He walks into meetings with real prospects and wants their catalogue on the screen. Every check below
is one PRODUCT PROMISE in that sentence, and each is asserted through the REAL routes on the REAL
ASGI app — never by calling a handler, because the thing being proved is what a request can do:

  L1  SÓLO EL FUNDADOR PUEDE PEDIR UN ENLACE   — no credential → 401 · a signed-in NON-founder → 403
                                                 (the phone door and the desk door BOTH), and neither
                                                 refusal leaves a link behind.
  L2  UN ENLACE MUERTO ES UN ENLACE DESCONOCIDO — caducado, revocado y falso responden EXACTAMENTE lo
                                                 mismo (404 + one sentence), so a probe cannot learn
                                                 that a link ever existed. Every route says it.
  L3  LO QUE SUBES POR EL ENLACE ENTRA COMO IMPORTACIÓN — a paste through the mailed page lands as a
                                                 real `catalogue_intake` row on the founder's tenant,
                                                 parsed by the REAL parser, previewable and
                                                 correctable through the token and NOTHING else: an
                                                 intake the link did not create is a 404 to it.
  L4  EL MUNDO LLEVA SUS ARTÍCULOS Y NI UN PEDIDO INVENTADO — «guardar como perfil» mints a world
                                                 whose catalogue is the ingested one WITH the
                                                 operator's corrections applied (renamed lands
                                                 renamed, dropped is absent) and whose contacts carry
                                                 baskets but ZERO weeks of history.
  L5  ACTIVAR CAMBIA EL MUNDO Y EL ANTERIOR SE VA POR SU PROPIA MARCA — the confirmation word is
                                                 required, and after the switch the new world's rows
                                                 are there, the previous world's are gone, and a row
                                                 that was never seeded SURVIVES.

L1–L2 and the pure halves of L3 need only the ASGI app + a clone. There is no network in this file:
`ROCOTO_EGRESS_SANDBOX` is asserted, so the Resend rail short-circuits and no mail can reach Peter.

    export REHEARSAL_DB=rocoto_rehearsal_<yours>   # BEFORE sourcing, or you measure a dirty DB
    source deploy/harness/rehearsal_env.sh
    PYTHONPATH=. python3 tests/vital_intake_link.py

SAFETY: refuses the live `rocoto` database BY NAME — this vital writes, seeds and deletes rows.
It cleans up after itself (its links, its intakes, its minted worlds).
"""
import asyncio
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

R: list[bool] = []
SKIPPED: list[str] = []

# Everything this run creates, so the teardown is a list rather than a guess.
MADE: dict[str, list] = {"links": [], "intakes": [], "profiles": []}

FOUNDER_EMAIL = "peter@leo.casa"
STRANGER_EMAIL = "no-soy-peter@ejemplo.es"

# One article the CANON world sells and a minted world cannot — read from the canon catalogue rather
# than typed here, so a rename in `seed/catalogue.json` cannot quietly turn L5 into a check on a name
# nobody sells (which would pass forever).
CANON_SKU = json.load(open(os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed", "catalogue.json"),
    encoding="utf-8"))["skus"][0]["name"]

# A tiny, honest price list. Two columns, tab-separated — the shape a supplier's Excel block has when
# it is pasted, which is the paste door's whole reason for existing. No real company name appears.
PASTE = "\n".join([
    "ARTICULO\tPRECIO",
    "Chorizo sarta extra 500 g\t9,80",
    "Queso curado de oveja pieza\t13,90",
    "Lomo embuchado loncheado 100 g\t4,25",
    "Morcilla de arroz atada\t5,60",
    "Panceta adobada bandeja\t7,15",
    "Salchichón de pueblo cular\t11,40",
])


def ck(name: str, ok: bool, detail: str = "") -> None:
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name: str, why: str) -> None:
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


def guard_clone(dsn: str) -> None:
    """NEVER production. This vital seeds and deletes; the live database is refused BY NAME."""
    tail = dsn.rsplit("/", 1)[-1].split("?")[0].strip()
    if tail in ("rocoto", "rocoto_prod", "rocoto_live") or "/rocoto_rehearsal" not in dsn:
        print(f"REFUSED: {tail!r} no es un clon de ensayo. "
              "export REHEARSAL_DB=… && source deploy/harness/rehearsal_env.sh")
        sys.exit(2)


# ══════════════════════════════════════════════════════════════════════════════════════════════════
#  THE DOORS, FAKED AT THE EDGE AND NOWHERE ELSE
#
#  `brain/auth.verify_token` is a network call to Supabase and `is_founder` reads that user's OAuth
#  identities. Neither can happen on a sandboxed box, and neither is what this vital is about — what
#  it is about is whether the ROUTES refuse. So exactly two functions are replaced, at the outermost
#  edge of the credential check, and everything inside them (the tenant resolution, the founder rule,
#  the router, the intake organ, the seed registry, the parser) is the real thing.
# ══════════════════════════════════════════════════════════════════════════════════════════════════

def install_fake_identities() -> None:
    from brain import auth as brain_auth

    async def _verify(tok):
        if tok == "T-FUNDADOR":
            return {"email": FOUNDER_EMAIL, "id": "u-peter"}
        if tok == "T-DESCONOCIDO":
            return {"email": STRANGER_EMAIL, "id": "u-otro"}
        return None

    def _is_founder(user):
        return (user or {}).get("email") == FOUNDER_EMAIL

    async def _scope(user):
        import config
        return {"email": (user or {}).get("email") or "", "tenant_slug": config.BRAIN_TENANT,
                "tenant_name": config.BRAIN_TENANT, "role": "founder", "caps": ["admin"],
                "via": "founder", "is_founder": _is_founder(user)}

    brain_auth.verify_token = _verify              # type: ignore[assignment]
    brain_auth.is_founder = _is_founder            # type: ignore[assignment]
    brain_auth.app_scope = _scope                  # type: ignore[assignment]


def bare_app():
    """The router under test, on a bare FastAPI — app.py's own five intake routes are not needed for
    any assertion here and importing it would drag the whole runtime onto a test box."""
    from fastapi import FastAPI

    import intake_api
    a = FastAPI()
    a.include_router(intake_api.router)
    return a


FUNDADOR = {"authorization": "Bearer T-FUNDADOR"}
DESCONOCIDO = {"authorization": "Bearer T-DESCONOCIDO"}


async def run() -> None:
    import httpx

    import config
    import db
    from brain import onboarding as ob
    from brain import seed as bseed

    await db.init()
    install_fake_identities()
    tr = httpx.ASGITransport(app=bare_app())
    tenant = config.BRAIN_TENANT

    async with httpx.AsyncClient(transport=tr, base_url="https://soyrocoto.test",
                                 timeout=600.0) as c:

        # ══ L1 · SÓLO EL FUNDADOR PUEDE PEDIR UN ENLACE ═══════════════════════════════════════════
        print("\n── L1 · sólo el fundador puede pedir un enlace")
        r = await c.post("/api/app/catalogue/link", json={})
        ck("L1 sin credencial no hay enlace (401/403, nunca uno servido)",
           r.status_code in (401, 403), f"{r.status_code} {r.text[:100]}")

        r = await c.post("/api/app/catalogue/link", headers=DESCONOCIDO, json={})
        ck("L1 una cuenta que NO es la del fundador → 403", r.status_code == 403,
           f"{r.status_code} {r.text[:100]}")
        ck("L1 …y la negativa está en castellano, no es un código",
           " " in str(r.json().get("detail") or ""), str(r.json().get("detail"))[:80])

        async with db.get_pool().acquire() as con:
            leaked = await con.fetchval(
                "select count(*) from intake_links where minted_by=$1", STRANGER_EMAIL) \
                if await con.fetchval("select to_regclass('public.intake_links') is not null") else 0
        ck("L1 …y ninguna de las dos negativas ha dejado un enlace detrás", int(leaked or 0) == 0,
           f"{leaked} filas")

        r = await c.post("/api/app/catalogue/link", headers=FUNDADOR,
                         json={"label": "Cárnicas de prueba", "send": True})
        ck("L1 el fundador SÍ recibe un enlace", r.status_code == 200 and r.json().get("ok") is True,
           f"{r.status_code} {r.text[:120]}")
        first = r.json()
        token = first["url"].rsplit("/", 1)[-1]
        MADE["links"].append(token)
        ck("L1 el enlace vive en /subir/<token> del dominio público",
           "/subir/" in first["url"] and len(token) >= 32, first["url"])
        ck("L1 …y caduca (nunca es un enlace eterno)", bool(first.get("caduca")),
           str(first.get("caduca")))
        ck("L1 …y el correo se manda por el carril de siempre (aquí, cortado por el sandbox)",
           first.get("enviado") is True and not first.get("aviso"),
           f"enviado={first.get('enviado')} aviso={first.get('aviso')!r}")

        r2 = await c.post("/api/app/catalogue/link", headers=FUNDADOR, json={})
        ck("L1 pedirlo otra vez devuelve EL MISMO enlace (el correo que ya tiene abierto sigue "
           "valiendo)", r2.json().get("url") == first["url"] and r2.json().get("nuevo") is False,
           f"{r2.json().get('url','')[-12:]} vs {first['url'][-12:]}")

        # ── THE OTHER DOOR. «Una puerta, dos llaves» is §5.10.2's rule and this block inherits it, so
        # the DESK's cookie must be tested too — a founder rule proved on one credential and assumed
        # on the other is exactly the kind of half-check that lets a desk and a phone disagree about
        # who Peter is. Real `sup_session` rows, ridden as an explicit header (the 401 path answers
        # with a cookie-DELETING Set-Cookie, which a jar should not be standing on).
        import sup_session
        dueno = await sup_session.mint("dueno@vitalintakelink.test", tenant, "owner",
                                       "1.2.3.4", "vital")
        jefe = await sup_session.mint("peter@vitalintakelink.test", tenant, "founder",
                                      "1.2.3.4", "vital")

        def _as(s, csrf=True):
            h = {"cookie": f"sup_session={s['raw']}"}
            if csrf:
                h["x-sup-csrf"] = s["csrf"]
            return h

        r = await c.post("/api/app/catalogue/link", headers=_as(dueno), json={"send": False})
        ck("L1 desde el escritorio, un OWNER que no es el fundador tampoco puede pedirlo → 403",
           r.status_code == 403, f"{r.status_code} {r.text[:90]}")
        r = await c.post("/api/app/catalogue/link", headers=_as(jefe, csrf=False),
                         json={"send": False})
        ck("L1 …y una sesión de escritorio SIN el token CSRF se rechaza (un POST de otro sitio no "
           "puede acuñar un enlace)", r.status_code == 403, f"{r.status_code} {r.text[:90]}")
        r = await c.post("/api/app/catalogue/link", headers=_as(jefe), json={"send": False})
        ck("L1 …y el fundador SÍ lo consigue por la puerta del escritorio",
           r.status_code == 200 and r.json().get("ok") is True, f"{r.status_code} {r.text[:110]}")
        if r.status_code == 200:
            MADE["links"].append(r.json()["url"].rsplit("/", 1)[-1])
            ck("L1 …y es SU enlace, no el del teléfono (un enlace por identidad, nunca compartido)",
               r.json()["url"] != first["url"], r.json()["url"][-12:])
        async with db.get_pool().acquire() as con:
            await con.execute("delete from sup_session where actor_email like $1",
                              "%@vitalintakelink.test")

        # ══ L2 · UN ENLACE MUERTO ES UN ENLACE DESCONOCIDO ════════════════════════════════════════
        print("\n── L2 · caducado, revocado y falso son indistinguibles")
        falso = "x" * 43
        r_falso = await c.get(f"/api/intake/{falso}")
        ck("L2 un token inventado → 404", r_falso.status_code == 404, str(r_falso.status_code))

        # A link that has EXPIRED, built by moving its own clock back — never by a different code path.
        r = await c.post("/api/app/catalogue/link", headers=FUNDADOR, json={"rotate": True})
        caducado = r.json()["url"].rsplit("/", 1)[-1]
        MADE["links"].append(caducado)
        async with db.get_pool().acquire() as con:
            await con.execute("update intake_links set expires_at = now() - interval '1 day' "
                              "where token=$1", caducado)
        r_cad = await c.get(f"/api/intake/{caducado}")

        # A link that was REVOKED, through the real route.
        r = await c.post("/api/app/catalogue/link", headers=FUNDADOR, json={"rotate": True})
        revocado = r.json()["url"].rsplit("/", 1)[-1]
        MADE["links"].append(revocado)
        rv = await c.delete("/api/app/catalogue/link", headers=FUNDADOR)
        ck("L2 revocar es una llamada que dice cuántos enlaces ha apagado",
           rv.status_code == 200 and rv.json().get("revocados") == 1, rv.text[:100])
        r_rev = await c.get(f"/api/intake/{revocado}")

        same = (r_falso.status_code == r_cad.status_code == r_rev.status_code == 404
                and r_falso.json() == r_cad.json() == r_rev.json())
        ck("L2 caducado, revocado y falso responden EXACTAMENTE lo mismo", same,
           f"{r_falso.status_code}/{r_cad.status_code}/{r_rev.status_code} · "
           f"{r_falso.text[:40]} · {r_cad.text[:40]} · {r_rev.text[:40]}")
        ck("L2 …y lo que dice es una frase en castellano que se puede leer",
           "enlace" in str(r_rev.json().get("detail") or "").lower(),
           str(r_rev.json().get("detail"))[:80])

        # Every route, not just the read — one dead token must be dead everywhere.
        muertas = []
        for meth, path, kw in (
            ("GET", f"/api/intake/{revocado}", {}),
            ("POST", f"/api/intake/{revocado}/upload", {"json": {"text": PASTE}}),
            ("GET", f"/api/intake/{revocado}/i/ing_x", {}),
            ("PATCH", f"/api/intake/{revocado}/i/ing_x", {"json": {"ops": {"0": {"name": "x"}}}}),
            ("POST", f"/api/intake/{revocado}/i/ing_x/commit", {"json": {}}),
            ("POST", f"/api/intake/{revocado}/i/ing_x/discard", {"json": {}}),
            ("POST", f"/api/intake/{revocado}/i/ing_x/perfil", {"json": {"name": "X"}}),
            ("POST", f"/api/intake/{revocado}/activar", {"json": {"profile_id": "aldonza"}}),
        ):
            rr = await c.request(meth, path, **kw)
            if rr.status_code != 404:
                muertas.append(f"{meth} {path.rsplit('/', 1)[-1]}={rr.status_code}")
        ck("L2 un enlace revocado está muerto en LAS OCHO puertas, no sólo en la que se lee",
           not muertas, ", ".join(muertas))

        # Back to a live link for the rest.
        r = await c.post("/api/app/catalogue/link", headers=FUNDADOR,
                         json={"label": "Cárnicas de prueba"})
        token = r.json()["url"].rsplit("/", 1)[-1]
        MADE["links"].append(token)

        # ══ L3 · LO QUE SUBES POR EL ENLACE ENTRA COMO IMPORTACIÓN ════════════════════════════════
        print("\n── L3 · lo que sube por el enlace entra como importación de verdad")
        r = await c.get(f"/api/intake/{token}")
        ck("L3 el enlace vivo se abre y dice para quién es",
           r.status_code == 200 and r.json().get("etiqueta") == "Cárnicas de prueba",
           f"{r.status_code} {r.text[:100]}")

        r = await c.post(f"/api/intake/{token}/upload", json={"text": PASTE, "name": "tarifa"})
        ck("L3 una lista pegada por el enlace arranca una importación",
           r.status_code == 200 and r.json().get("id", "").startswith("ing_"), r.text[:120])
        iid = r.json()["id"]
        MADE["intakes"].append(iid)

        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "select tenant_id, source_kind, created_by from catalogue_intake where id=$1", iid)
        ck("L3 …y es una fila `catalogue_intake` del tenant del fundador, marcada como venida del "
           "enlace",
           row is not None and row["tenant_id"] == tenant and row["source_kind"] == "paste"
           and str(row["created_by"]).startswith("enlace:"),
           f"{dict(row) if row else None}")

        # The parse runs in the background — wait for it the way the page does, by polling.
        # THE FIRST POLL'S STATUS IS ASSERTED, not just its body: a link that cannot read the intake
        # it just created answers 404, and a poll loop that only reads `state` sees that as «not
        # ready yet» and skips the rest of the vital in silence. That is precisely how the
        # double-encoded reach list nearly shipped (see `note_intake_on_link`).
        estado, vista = "parsing", {}
        primero = await c.get(f"/api/intake/{token}/i/{iid}")
        ck("L3 el enlace PUEDE leer la importación que acaba de crear (su alcance es lo que subió)",
           primero.status_code == 200, f"{primero.status_code} {primero.text[:90]}")
        for _ in range(120):
            rr = await c.get(f"/api/intake/{token}/i/{iid}")
            vista = rr.json()
            estado = vista.get("state", "")
            if estado != "parsing":
                break
            await asyncio.sleep(1.0)
        if estado != "ready":
            skip("L3 la vista previa", f"el parser no terminó en ready (state={estado}) — "
                                       "¿sin clave de modelo en esta caja?")
            skip("L4 el mundo minado", "depende de una importación leída")
            skip("L5 activar", "depende de una importación leída")
            await teardown(db, bseed)
            return

        filas = vista.get("rows") or []
        ck("L3 la vista previa enseña lo que se ha entendido, artículo por artículo",
           len(filas) >= 4 and all(f.get("name") for f in filas), f"{len(filas)} filas")
        ck("L3 …y cuando el modelo no está, LO DICE en vez de callarse y leer peor a escondidas",
           any(w.get("code") == "model_unavailable" for w in (vista.get("warnings") or [])),
           str([w.get("code") for w in (vista.get("warnings") or [])]))
        ck("L3 …y le pone precio a lo que traía precio",
           sum(1 for f in filas if isinstance(f.get("price"), (int, float))) >= 4,
           str([f.get("price") for f in filas][:6]))

        # THE FENCE: a link reaches what IT uploaded, never what the tenant owns.
        otro = await ob.create_intake(tenant, "app:otra-puerta", source_kind="paste",
                                      source_name="ajeno", text=PASTE)
        MADE["intakes"].append(otro["id"])
        r = await c.get(f"/api/intake/{token}/i/{otro['id']}")
        ck("L3 una importación que NO vino por este enlace es un 404 para él (el tenant no es la "
           "valla)", r.status_code == 404, f"{r.status_code} {r.text[:80]}")

        # The correction step — the whole point of the middle screen.
        nuevo_nombre = "Chorizo sarta EXTRA corregido"
        r = await c.patch(f"/api/intake/{token}/i/{iid}",
                          json={"ops": {"0": {"name": nuevo_nombre}, "1": {"drop": True}}})
        ck("L3 se puede corregir un nombre y quitar una línea desde el enlace",
           r.status_code == 200, f"{r.status_code} {r.text[:100]}")
        filas2 = r.json().get("rows") or []
        ck("L3 …y la corrección se ve en el acto",
           any(f.get("name") == nuevo_nombre for f in filas2) and len(filas2) == len(filas) - 1,
           f"{len(filas)} → {len(filas2)}")

        # ══ L4 · EL MUNDO LLEVA SUS ARTÍCULOS Y NI UN PEDIDO INVENTADO ════════════════════════════
        print("\n── L4 · el mundo minado lleva sus artículos y ni un pedido inventado")
        nombre = f"Prospecto {uuid.uuid4().hex[:6]}"
        r = await c.post(f"/api/intake/{token}/i/{iid}/perfil", json={"name": nombre})
        ck("L4 «guardar como perfil» crea un mundo con el nombre del cliente",
           r.status_code == 200 and r.json().get("ok") is True, f"{r.status_code} {r.text[:140]}")
        if r.status_code != 200:
            await teardown(db, bseed)
            return
        pid = r.json()["perfil"]["id"]
        MADE["profiles"].append(pid)

        r = await c.post(f"/api/intake/{token}/i/{iid}/perfil", json={})
        ck("L4 …y un perfil sin nombre se rechaza en castellano, no se inventa uno",
           r.status_code == 400 and "nombre" in str(r.json().get("detail") or "").lower(),
           f"{r.status_code} {str(r.json().get('detail'))[:70]}")

        # A REFUSAL THAT HAS ALREADY HAD A SIDE EFFECT IS NOT A REFUSAL. «Guardar y activar» with the
        # wrong word must leave NOTHING behind — it used to mint the profile first and fail on the
        # switch, so the operator read «escribe REINICIAR» while a world he could not see existed.
        antes = len((await bseed.list_profiles())["profiles"])
        r = await c.post(f"/api/intake/{token}/i/{iid}/perfil",
                         json={"name": f"Fantasma {uuid.uuid4().hex[:6]}", "activate": True,
                               "confirm": "vale"})
        despues = len((await bseed.list_profiles())["profiles"])
        ck("L4 «guardar y activar» sin la palabra no guarda NADA (una negativa no deja restos)",
           r.status_code == 400 and antes == despues, f"{r.status_code} · {antes} → {despues} mundos")

        reg = await bseed.registry()
        spec = reg.get(pid) or {}
        nombres = [s.get("name") for s in (spec.get("skus") or [])]
        ck("L4 el catálogo del mundo ES el que se subió", len(nombres) == len(filas2),
           f"{len(nombres)} artículos vs {len(filas2)} filas revisadas")
        ck("L4 …con la corrección aplicada: lo renombrado entra renombrado",
           nuevo_nombre in nombres, str(nombres[:3]))
        ck("L4 …y lo que se quitó en la revisión NO está",
           "Queso curado de oveja pieza" not in nombres, str(nombres[:6]))

        contactos = spec.get("contacts") or []
        ck("L4 el mundo trae clientes con su cesta habitual",
           len(contactos) >= 2 and all(cc.get("usual") for cc in contactos),
           f"{len(contactos)} clientes")
        ck("L4 …y CERO semanas de pedidos inventados (la demo es el audio en directo)",
           all(int(cc.get("weeks") or 0) == 0 for cc in contactos),
           str([cc.get("weeks") for cc in contactos]))
        cestas_ok = all(
            all(any(s["id"] == ln["sku_id"] for s in (spec.get("skus") or []))
                for ln in (cc.get("usual") or []))
            for cc in contactos)
        ck("L4 …y cada cesta apunta a un artículo DE ESTE catálogo, nunca a uno de otro mundo",
           cestas_ok)
        tel = [cc.get("phone") for cc in contactos]
        otros_tel = {cc.get("phone") for pid2, sp in reg.items() if pid2 != pid
                     for cc in (sp.get("contacts") or [])}
        ck("L4 …con teléfonos que no comparte con ningún otro mundo (dos mundos en un número se "
           "funden en una conversación)", not (set(tel) & otros_tel),
           str(sorted(set(tel) & otros_tel))[:80])

        # ══ L5 · ACTIVAR CAMBIA EL MUNDO ═══════════════════════════════════════════════════════════
        print("\n── L5 · activar cambia el mundo y el anterior se va por su propia marca")
        r = await c.post(f"/api/intake/{token}/activar", json={"profile_id": pid})
        ck("L5 sin la palabra de confirmación no se activa nada",
           r.status_code == 400 and "REINICIAR" in str(r.json().get("detail") or ""),
           f"{r.status_code} {str(r.json().get('detail'))[:70]}")
        r = await c.post(f"/api/intake/{token}/activar",
                         json={"profile_id": pid, "confirm": "vale"})
        ck("L5 …y una palabra que no es LA palabra tampoco", r.status_code == 400,
           str(r.status_code))

        # SETUP, not the assertion: put a REAL world in the tables first, so «el anterior se va» is
        # a claim about something that was actually there. Loaded through `brain/seed` directly and
        # deliberately not through the brain — what is under test is the SWITCH, and a world nobody
        # loaded would make the teardown assertion pass on an empty database.
        await bseed.activate_profile(bseed.CANON_PROFILE, tenant, strict=False,
                                     through_brain=False)
        anterior = await bseed.active_profile_id()
        async with db.get_pool().acquire() as con:
            antes = int(await con.fetchval(
                "select count(*) from catalogue_skus where tenant_id=$1 and name=$2",
                tenant, CANON_SKU) or 0)
        ck("L5 (montaje) el mundo canónico está puesto y tiene sus artículos",
           anterior == bseed.CANON_PROFILE and antes >= 1, f"{anterior} · {antes} filas")

        # A row that was NEVER seeded. It must survive a switch — that is the whole collision law.
        vivo = "+34600" + uuid.uuid4().hex[:6].translate(str.maketrans("abcdef", "123456"))
        async with db.get_pool().acquire() as con:
            await con.execute(
                "insert into whatsapp_messages (id, phone_number, role, message_text, "
                "message_type, seeded) values ($1,$2,'user','esto es real','text',false) "
                "on conflict (id) do nothing", f"real-{uuid.uuid4().hex[:10]}", vivo)

        r = await c.post(f"/api/intake/{token}/activar",
                         json={"profile_id": pid, "confirm": "REINICIAR"})
        ck("L5 con la palabra, el mundo cambia", r.status_code == 200 and r.json().get("ok"),
           f"{r.status_code} {r.text[:160]}")
        if r.status_code == 200:
            ck("L5 …y el recibo dice quién se fue y quién vino",
               r.json().get("a") == pid and r.json().get("de") == anterior,
               f"{r.json().get('de')} → {r.json().get('a')}")
            ck("L5 …y ahora el mundo activo es ése", await bseed.active_profile_id() == pid)

            marca = bseed.world_mark(anterior)
            async with db.get_pool().acquire() as con:
                mio = await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1 and name=$2 "
                    "and in_assortment", tenant, nuevo_nombre)
                canon_sigue = await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1 and name=$2 "
                    "and in_assortment", tenant, CANON_SKU)
                # The mark is what the teardown matches on — `payload->>'seed_world'` across the four
                # runtime tables (brain/seed §the collision law). Not one row of the world that just
                # left may still be wearing it.
                marca_vieja = await con.fetchval(
                    "select (select count(*) from event where payload->>'seed_world' = $1) "
                    "     + (select count(*) from action where payload->>'seed_world' = $1) "
                    "     + (select count(*) from timer where payload->>'seed_world' = $1) "
                    "     + (select count(*) from open_loop "
                    "        where resume_ref->>'seed_world' = $1)", marca)
                sobrevive = await con.fetchval(
                    "select count(*) from whatsapp_messages where phone_number=$1", vivo)
            # THE PROMISE, MEASURED IN THE TABLES — not in the spec that describes them. The spec
            # said `weeks=0` and the world still arrived with ten invented orders, because the
            # loader minted a standing order and a fresh one per contact regardless of history.
            # «Cero pedidos» has to be counted where Peter would see it: in `orders`.
            async with db.get_pool().acquire() as con:
                pedidos = int(await con.fetchval(
                    "select count(*) from orders where seeded") or 0)
            ck("L5 …y la pantalla empieza VACÍA: ni un pedido inventado en el mundo del prospecto",
               pedidos == 0, f"{pedidos} pedidos sembrados")
            ck("L5 …los artículos del prospecto están en el catálogo vivo", int(mio or 0) >= 1,
               f"{mio} filas de «{nuevo_nombre}»")
            ck("L5 …y los del mundo anterior ya no cuadran en un pedido",
               int(canon_sigue or 0) == 0, f"{canon_sigue} filas de «{CANON_SKU}» siguen en gama")
            ck("L5 …el mundo anterior se ha ido por SU PROPIA marca, no por un borrado a ciegas",
               int(marca_vieja or 0) == 0, f"{marca_vieja} filas de runtime con {marca}")
            ck("L5 …y una fila que nunca fue sembrada SIGUE AHÍ", int(sobrevive or 0) == 1,
               f"{sobrevive} mensajes reales")

            # Put canon back so the box is left as it was found.
            try:
                await bseed.activate_profile(bseed.CANON_PROFILE, tenant, strict=False,
                                             through_brain=False)
            except Exception as e:      # noqa: BLE001 — teardown is best-effort, and says so
                print(f"  (aviso: no se pudo devolver el mundo canónico: {e})")

        async with db.get_pool().acquire() as con:
            await con.execute("delete from whatsapp_messages where phone_number=$1", vivo)

    await teardown(db, bseed)


async def teardown(db, bseed) -> None:
    """Everything this run made, removed. A vital that leaves rows behind is the reason the next one
    fails for a reason nobody can explain."""
    try:
        for pid in MADE["profiles"]:
            try:
                await bseed.delete_profile(pid)
            except Exception:
                pass
        async with db.get_pool().acquire() as con:
            if MADE["links"]:
                await con.execute("delete from intake_links where token = any($1::text[])",
                                  MADE["links"])
            if MADE["intakes"]:
                await con.execute("delete from catalogue_intake where id = any($1::text[])",
                                  MADE["intakes"])
    except Exception as e:              # noqa: BLE001
        print(f"  (aviso: limpieza incompleta: {e})")


def main() -> None:
    dsn = os.environ.get("REHEARSAL_DSN") or os.environ.get("DATABASE_URL") or ""
    if not dsn:
        print("REFUSED: sin REHEARSAL_DSN. source deploy/harness/rehearsal_env.sh")
        sys.exit(2)
    guard_clone(dsn)
    os.environ["DATABASE_URL"] = dsn
    os.environ.setdefault("ROCOTO_EGRESS_SANDBOX", "1")
    # THE PARSE RUNS ON ITS DETERMINISTIC HALF, ON PURPOSE — not because the model is inconvenient.
    #   · What this vital is about is the LINK: who may mint one, what a dead one answers, what a
    #     token may reach, and what the world it mints contains. The Sonnet read is §5.10.2's
    #     subject and is exercised where that lives.
    #   · `skuparse._extract_skus_sync` returns [] the moment there is no key, and `_finish` falls
    #     back to the deterministic column map with a `model_unavailable` warning — a REAL production
    #     path an operator sees on a bad day, asserted below rather than avoided.
    #   · A vital that needs a paid API to be up is a vital that goes red for a reason that is not a
    #     regression. Measured first: with a key present and no credit, the anthropic client's 8
    #     retries ran inside `asyncio.to_thread` and the whole run hung past 900 s.
    os.environ["ANTHROPIC_API_KEY"] = ""

    import importlib

    import config
    importlib.reload(config)
    if not config.EGRESS_SANDBOX:
        print("REFUSED: el sandbox de salida está apagado — este vital manda correos.")
        sys.exit(2)
    ck("L0 el carril de salida está cortado (ningún correo puede salir de un ensayo)", True)

    asyncio.run(run())

    print(f"\nvital_intake_link: {sum(R)}/{len(R)} green"
          + (f", {len(SKIPPED)} skipped" if SKIPPED else ""))
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
