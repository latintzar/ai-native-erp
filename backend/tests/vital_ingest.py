"""vital_ingest.py — GIVE IT ANYTHING, SEE WHAT IT UNDERSTOOD, CORRECT IT, COMMIT (§5.10.2).

Peter, 2026-07-27: *"there should be an upload feature in the desktop app and the mobile app where I
can upload, I can paste, and it should use another limb to ingest it… it analyzes it so that it's
formatted and taken in well. So the order brain can use it."*

The middle step is the whole feature. Every check below is a PROMISE TO A SUPPLIER, in his words —
not an assertion about a function.

  I1  «Le doy el Excel más sucio que tengo y me saca los artículos.»
      The real cp1252 ERP export: banner rows, a header that is NOT row 1, `;` delimiters, comma
      decimals, ALL-CAPS names, section titles, blank prices, a totals footer.
  I2  «Lo pego tal cual desde el Excel y entiende exactamente lo mismo.»
      The paste path reaches the SAME articles the file path does. Same set of names, by set
      comparison, never by eye.
  I3  «Le pego la lista que mando yo por WhatsApp — y también la entiende.»
      A format the parser has never seen: bullets, «***QUESOS***» section titles, «9,80 €/kg».
      This is the one that proves «different formats» rather than «a second CSV reader».
  I4  «Antes de guardar nada veo qué va a cambiar.»
      The four buckets against a catalogue that already exists — nuevos · cambian (with the field
      that moved, before and after) · iguales · salen del surtido.
  I5  «Si le cambio el nombre a un artículo no pierdo lo que mis clientes le llaman.»
      THE RENAME TRAP. Without a reference column a SKU's identity IS its name, so renaming one
      orphans every alias Rocoto spent weeks learning. Caught in the preview, carried on commit.
  I6  «Nada se borra.»
      An article that leaves the list keeps its row, its history and its learned aliases, and comes
      back the day it reappears.
  I7  «Puedo corregirlo antes de guardarlo.»
      A price fixed and a row dropped on the preview are what actually lands in the catalogue.
  I8  «Si se ha dejado media lista, me lo dice — y no la guarda a ciegas.»
      The count guard: a tabular source knows how many product lines it had.
  I9  «Si se me va el móvil a mitad, la subida sigue ahí.»
      The intake is a durable row, and a second commit returns the first one's result instead of
      seeding twice.
  I10 «Lo que leyó la máquina se guarda aparte de lo que corregí yo.»
      `parsed` is append-once; `edits` overlays it. That is what tunes the parser afterwards.
  I11 «Un texto enorme no se guarda a medias.»
      Over the ceiling it is REFUSED, never silently clipped.
  I12 «Si lo descarto, se va.»
  I13 An intake belongs to ONE tenant; a wrong id and a wrong tenant answer identically.
  I14-I17 THE ROUTES, through the real ASGI app: no credential → 401 · multipart and JSON on the
      SAME url (paste OR upload is the point) · an over-long paste refused by the route · the
      preview, the correction and the discard over HTTP.
  I18 THE DESK DOOR: the same routes accept a real `sup_session` cookie, and the X-Sup-CSRF double
      submit is NOT lowered to let the desk in. «One road, two doors» is only true if both are.

Run on the CLONE:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_ingest.py
SAFETY: refuses the live `rocoto` DB BY NAME; writes and deletes only its own invented tenants'
rows. Costs a handful of real Sonnet calls (the parse is the thing under test) — it degrades to the
deterministic reader, loudly, when there is no key.
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ[_k] = _DSN
try:
    for _l in (Path("/opt/rocoto/.env").read_text().splitlines()
               if Path("/opt/rocoto/.env").exists() else []):
        _l = _l.strip()
        if _l and not _l.startswith("#") and "=" in _l:
            _k, _, _v = _l.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())
except PermissionError:
    pass
if _DSN:                                   # the .env must never win over the clone we were handed
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ[_k] = _DSN

R, SKIPPED = [], []
# Invented, never a real company (LOCKED LAW). Two tenants: the one that gets a fresh catalogue and
# the one that already has one, so the re-ingestion half has something to be a diff AGAINST.
T_NEW, T_OLD = "vitalingnew", "vitalingold"
TENANTS = (T_NEW, T_OLD)
FIXTURE = Path(__file__).parent / "fixtures" / "cold_tenant_precios.csv"

# The list a supplier actually types into WhatsApp. Not a CSV with different punctuation — bullets,
# a section title in decoration, an em-dash, a price with the unit stuck to it, and a footer.
WHATSAPP_LIST = """Buenas! Va la lista de esta semana, los precios nuevos:

*** EMBUTIDOS ***
- Chorizo sarta extra 500 g - 9,80 €/kg
- Salchichón vela 55 mm — 11,40 €/kg
• Fuet extra 170 g  2,55
Lomo embuchado caña: 18,60 €/kg

QUESOS
Queso manchego curado cuña - 13,90 /kg
Queso tetilla 5,70 ud

Pedido mínimo 150 EUR. Portes incluidos en Madrid capital."""


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


def names_of(rows):
    return {(r.get("name") or "").strip().upper() for r in rows if (r.get("name") or "").strip()}


async def _cleanup(db):
    async with db.get_pool().acquire() as con:
        for t in TENANTS:
            await con.execute("delete from catalogue_intake where tenant_id=$1", t)
            await con.execute("delete from sku_aliases where tenant_id=$1", t)
            await con.execute("delete from catalogue_skus where tenant_id=$1", t)
            await con.execute("delete from catalogue_directory where tenant_id=$1", t)
    for t in TENANTS:
        try:
            async with db.scoped_tx(f"t.{t}") as con:
                await con.execute("delete from event where scope=$1::ltree", f"t.{t}")
        except Exception:
            pass
    try:
        import directory
        for t in TENANTS:
            task = directory._PENDING.pop(t, None)
            if task and not task.done():
                task.cancel()
    except Exception:
        pass


async def _poll(ob, iid, tenant, tries=90):
    """Wait for the background parse, exactly as an app does."""
    for _ in range(tries):
        out = await ob.get_intake(iid, tenant)
        if out and out["state"] != "parsing":
            return out
        await asyncio.sleep(1)
    return await ob.get_intake(iid, tenant)


async def main():
    print(__doc__.splitlines()[0])
    if not _DSN:
        skip("the whole file", "no REHEARSAL_DSN — every check here is a real round-trip")
        return
    import db
    import directory
    from brain import golive
    from brain import onboarding as ob

    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"  (db={dbname})")
    async with db.get_pool().acquire() as con:
        await directory.ensure_schema(con)
        await ob.ensure_intake_schema(con)
    await _cleanup(db)
    have_model = bool(os.environ.get("ANTHROPIC_API_KEY"))
    if not have_model:
        print("  ⚠ no ANTHROPIC_API_KEY — the parse falls back to the deterministic reader; "
              "that is a REAL path (it is what runs when the model is down) but it is not the "
              "primary one.")

    raw = FIXTURE.read_bytes()
    body_text = raw.decode("cp1252")

    # ── I1 · the dirtiest file he has ────────────────────────────────────────────────────────────
    r1 = await ob.create_intake(T_NEW, "vital@rocoto", source_kind="file",
                                source_name="precios.csv", raw_bytes=raw)
    ck("I1 el archivo entra y arranca la lectura sola", r1.get("ok") and r1.get("id"), str(r1))
    iid1 = r1.get("id")
    await ob.run_intake(iid1)
    got1 = await ob.get_intake(iid1, T_NEW)
    rows1 = got1["rows"]
    ck("⚑ I1 «LE DOY EL EXCEL MÁS SUCIO QUE TENGO Y ME SACA LOS ARTÍCULOS» — 34 productos de un "
       "export con cabecera de empresa, títulos de sección, `;`, decimales con coma y un pie de "
       "totales",
       got1["state"] == "ready" and 30 <= len(rows1) <= 36,
       f"state={got1['state']} rows={len(rows1)}")
    ck("I1 …y sabe cuántas líneas de producto TENÍA el archivo (34, las que dice su propio pie) — "
       "sin ese número no hay forma honesta de avisar de que se ha dejado la mitad",
       got1["source_rows"] == 34, f"source_rows={got1['source_rows']}")
    sarta = next((r for r in rows1 if "CHORIZO SARTA" in (r["name"] or "").upper()), None)
    ck("I1 un artículo concreto llega entero: nombre, código, familia, unidad y precio",
       bool(sarta) and sarta["price"] == 9.8 and (sarta["code"] or "").startswith("EMB-")
       and (sarta["unit"] or "").lower().startswith("kg"),
       str(sarta))
    warn_codes = {w["code"] for w in got1["warnings"]}
    ck("I1 …y me dice lo que ha dado por supuesto: hay artículos SIN PRECIO en esa tarifa y saldrán "
       "como «a confirmar» — callarse una suposición es el fallo, no el precio que falta",
       "no_price" in warn_codes, str(sorted(warn_codes)))

    # ── I2 · the same thing, pasted ──────────────────────────────────────────────────────────────
    r2 = await ob.create_intake(T_NEW, "vital@rocoto", source_kind="paste",
                                source_name="pegado", text=body_text)
    await ob.run_intake(r2["id"])
    got2 = await ob.get_intake(r2["id"], T_NEW)
    ck("⚑ I2 «LO PEGO TAL CUAL DESDE EL EXCEL Y ENTIENDE LO MISMO» — el pegar no tiene extensión, "
       "así que decide por el CONTENIDO; los mismos artículos que por archivo",
       got2["state"] == "ready" and names_of(got2["rows"]) == names_of(rows1),
       f"file={len(rows1)} paste={len(got2['rows'])} "
       f"solo-en-uno={sorted(names_of(got2['rows']) ^ names_of(rows1))[:3]}")
    ck("I2 …y lo reconoce como tabla, no como prosa (el conteo determinista sólo existe si hay "
       "columnas)", got2["source_rows"] == 34, f"source_rows={got2['source_rows']}")

    # ── I3 · a format it has never seen ──────────────────────────────────────────────────────────
    r3 = await ob.create_intake(T_NEW, "vital@rocoto", source_kind="paste",
                                source_name="whatsapp", text=WHATSAPP_LIST)
    await ob.run_intake(r3["id"])
    got3 = await ob.get_intake(r3["id"], T_NEW)
    wa_names = names_of(got3["rows"])
    ck("⚑ I3 «LE PEGO LA LISTA QUE MANDO POR WHATSAPP Y TAMBIÉN LA ENTIENDE» — viñetas, títulos "
       "entre asteriscos, guiones largos y «9,80 €/kg»: seis artículos, no seis renglones de texto",
       got3["state"] == "ready" and 5 <= len(got3["rows"]) <= 8, f"rows={len(got3['rows'])}")
    ck("I3 …y el pie NO es un artículo: «Pedido mínimo 150 EUR» parsea precioso y no es un producto",
       not any("PEDIDO M" in n for n in wa_names), str(sorted(wa_names))[:160])
    fuet = next((r for r in got3["rows"] if "FUET" in (r["name"] or "").upper()), None)
    ck("I3 …y el precio pegado a la línea llega bien (2,55 → 2.55, no 255)",
       bool(fuet) and fuet["price"] == 2.55, str(fuet))
    ck("I3 …y avisa de que aquí NO puede contar: sin columnas no hay contra qué comparar, y una "
       "garantía que él cree tener y no tiene es peor que ninguna",
       any(w["code"] == "no_count" for w in got3["warnings"]),
       str([w["code"] for w in got3["warnings"]]))

    # ── I4 · the preview, against a catalogue that already exists ────────────────────────────────
    base = [
        {"code": "", "name": "Chorizo sarta extra 500 g", "family": "embutidos", "unit": "kg",
         "price": 9.20},
        {"code": "", "name": "Queso manchego curado cuña", "family": "quesos", "unit": "kg",
         "price": 13.90},
        {"code": "", "name": "Morcilla de Burgos con arroz", "family": "embutidos", "unit": "kg",
         "price": 6.40},
    ]
    seeded = await golive.seed_catalogue(T_OLD, base)
    ck("I4 (montaje) el catálogo de partida se instala por el ÚNICO escritor que existe",
       seeded.get("ok") and seeded.get("skus") == 3, str(seeded))
    # what a supplier's next list looks like: one price up, one article renamed, one gone, one new.
    nxt = [
        {"code": "", "name": "Chorizo sarta extra 500 g", "family": "embutidos", "unit": "kg",
         "price": 9.80},                                              # cambia (precio)
        {"code": "", "name": "Queso manchego curado en cuña", "family": "quesos", "unit": "kg",
         "price": 13.90},                                             # RENOMBRADO
        {"code": "", "name": "Fuet extra 170 g", "family": "embutidos", "unit": "ud",
         "price": 2.55},                                              # nuevo
    ]                                                                 # morcilla: sale del surtido
    plan = await golive.plan(T_OLD, nxt)
    ck("⚑ I4 «ANTES DE GUARDAR NADA VEO QUÉ VA A CAMBIAR» — nuevos · cambian · iguales · salen "
       "del surtido, calculados con la MISMA identidad con la que se va a escribir. El renombrado "
       "sale DOS veces a propósito (se va uno, llega otro): sin códigos, un artículo renombrado ES "
       "un artículo distinto hasta que un humano diga lo contrario — que es justo lo que I5 le "
       "pregunta",
       plan.get("ok") and len(plan["cambian"]) == 1 and len(plan["salen"]) == 2
       and len(plan["nuevos"]) == 2,
       f"nuevos={len(plan.get('nuevos', []))} cambian={len(plan.get('cambian', []))} "
       f"iguales={plan.get('iguales')} salen={len(plan.get('salen', []))}")
    ch = plan["cambian"][0]
    ck("I4 …y «cambia» dice QUÉ cambia, con el antes y el después — un precio mal leído se caza "
       "aquí, que es el único sitio donde todavía no ha pasado nada",
       ch["changed"] == ["price"] and ch["before"]["price"] == 9.20 and ch["price"] == 9.80,
       f"{ch['changed']} {ch['before']['price']} → {ch['price']}")
    ck("I4 …y «sale del surtido» nombra el artículo, no un identificador",
       plan["salen"][0]["name"].lower().startswith("morcilla"), str(plan["salen"][0])[:90])

    # ── I5 · THE RENAME TRAP ─────────────────────────────────────────────────────────────────────
    old_queso = next(r for r in plan["salen"] if "MANCHEGO" in r["name"].upper())
    async with db.get_pool().acquire() as con:
        for alias in ("la de siempre", "el manchego bueno"):
            await con.execute(
                "insert into sku_aliases (tenant_id, alias, sku_id, source, weight) "
                "values ($1,$2,$3,'learned',3)", T_OLD, alias, old_queso["id"])
    plan2 = await golive.plan(T_OLD, nxt)
    ren = plan2["renames"]
    ck("⚑ I5 «SI LE CAMBIO EL NOMBRE NO PIERDO LO QUE MIS CLIENTES LE LLAMAN» — la pantalla ve que "
       "«queso manchego curado cuña» y «…curado EN cuña» son el mismo artículo y lo pregunta",
       len(ren) == 1 and "MANCHEGO" in ren[0]["from"]["name"].upper()
       and "MANCHEGO" in ren[0]["to"]["name"].upper(), str(ren)[:200])
    ck("I5 …y dice cuántos apodos aprendidos se quedarían huérfanos si dice que no — que es la "
       "razón por la que la pregunta existe",
       len(ren) == 1 and ren[0]["from"]["aliases"] == 2, str(ren[0]["from"]) if ren else "—")
    committed = await golive.seed_catalogue(
        T_OLD, nxt, carry_over=[{"from": ren[0]["from"]["id"], "to": ren[0]["to"]["id"]}])
    async with db.get_pool().acquire() as con:
        carried = [dict(r) for r in await con.fetch(
            "select alias, sku_id, source from sku_aliases where tenant_id=$1 and source='learned' "
            "order by alias", T_OLD)]
    ck("⚑ I5 …y al aceptarlo, «la de siempre» sigue apuntando al artículo — ahora al nuevo. Sin "
       "esto, la segunda subida de cualquier cliente sin códigos borra en silencio el vocabulario "
       "que es el foso entero",
       len(carried) == 2 and all(c["sku_id"] == ren[0]["to"]["id"] for c in carried),
       str(carried)[:200])
    ck("I5 …y sólo se mueve lo APRENDIDO: los alias que el propio catálogo genera se reconstruyen "
       "solos, y arrastrarlos resucitaría el nombre viejo como sinónimo vivo del nuevo",
       committed.get("carried") == 2, str(committed.get("carried")))

    # ── I6 · nothing is deleted ──────────────────────────────────────────────────────────────────
    async with db.get_pool().acquire() as con:
        morc = await con.fetchrow(
            "select id, name, in_assortment from catalogue_skus "
            "where tenant_id=$1 and name ilike 'morcilla%'", T_OLD)
    ck("⚑ I6 «NADA SE BORRA» — la morcilla que ya no está en la lista deja de cuadrar en los "
       "pedidos, pero su fila (y su historial, y sus apodos) sigue ahí",
       morc is not None and morc["in_assortment"] is False, str(dict(morc)) if morc else "BORRADA")
    back = await golive.seed_catalogue(T_OLD, nxt + [base[2]])
    async with db.get_pool().acquire() as con:
        morc2 = await con.fetchrow(
            "select id, in_assortment from catalogue_skus where id=$1", morc["id"])
    ck("I6 …y vuelve sola el día que reaparece en una lista, con el MISMO id — que es lo que hace "
       "que vuelva con todo lo suyo",
       morc2["in_assortment"] is True and back.get("reactivated") == 1,
       f"reactivated={back.get('reactivated')}")

    # ── I7 · the correction step — THE feature ───────────────────────────────────────────────────
    r7 = await ob.create_intake(T_NEW, "vital@rocoto", source_kind="paste",
                                source_name="whatsapp", text=WHATSAPP_LIST)
    await ob.run_intake(r7["id"])
    got7 = await ob.get_intake(r7["id"], T_NEW)
    target = next(r for r in got7["rows"] if "TETILLA" in (r["name"] or "").upper())
    drop_me = next(r for r in got7["rows"] if "LOMO" in (r["name"] or "").upper())
    patched = await ob.patch_intake(r7["id"], T_NEW, {
        str(target["n"]): {"price": "6,20", "family": "quesos"},
        str(drop_me["n"]): {"drop": True},
    })
    ck("⚑ I7 «PUEDO CORREGIRLO ANTES DE GUARDARLO» — un precio arreglado y una línea quitada, y "
       "la lista que queda es la corregida",
       patched and len(patched["rows"]) == len(got7["rows"]) - 1
       and next(r["price"] for r in patched["rows"] if r["n"] == target["n"]) == 6.20,
       f"{len(got7['rows'])} → {len(patched['rows'])}")
    com7 = await ob.commit_intake(r7["id"], T_NEW)
    ck("I7 …y lo que se guarda es lo corregido, no lo que leyó la máquina",
       com7 and com7.get("ok"), str(com7)[:120])
    async with db.get_pool().acquire() as con:
        tet = await con.fetchrow("select price::float8 as p, in_assortment from catalogue_skus "
                                 "where tenant_id=$1 and name ilike '%tetilla%'", T_NEW)
        lomo = await con.fetchval("select count(*) from catalogue_skus "
                                  "where tenant_id=$1 and name ilike '%lomo embuchado%'", T_NEW)
    ck("I7 …en el catálogo de verdad: 6,20 € y sin el artículo que quité",
       tet is not None and tet["p"] == 6.20 and lomo == 0, f"tetilla={tet} lomo_rows={lomo}")

    # ── I10 · what the machine read is kept apart from what he corrected ─────────────────────────
    async with db.get_pool().acquire() as con:
        rowp = await con.fetchrow("select parsed, edits from catalogue_intake where id=$1", r7["id"])
    parsed_price = next((p["price"] for p in rowp["parsed"] if p["n"] == target["n"]), "?")
    ck("⚑ I10 «LO QUE LEYÓ LA MÁQUINA SE GUARDA APARTE DE LO QUE CORREGÍ YO» — `parsed` sigue "
       "diciendo 5.7 aunque el catálogo diga 6,20. Es la única forma de saber después en qué se "
       "equivoca el lector",
       parsed_price == 5.7 and str(target["n"]) in (rowp["edits"] or {}),
       f"parsed={parsed_price} edits={sorted((rowp['edits'] or {}).keys())}")

    # ── I8 · the count guard ─────────────────────────────────────────────────────────────────────
    r8 = await ob.create_intake(T_NEW, "vital@rocoto", source_kind="file",
                                source_name="medio.csv", raw_bytes=raw)
    await ob.run_intake(r8["id"])
    async with db.get_pool().acquire() as con:
        # Simulate the real failure: the reader only got a third of a file whose own columns say 34.
        keep = [p for p in (await con.fetchval(
            "select parsed from catalogue_intake where id=$1", r8["id"]))][:10]
        await con.execute("update catalogue_intake set parsed=$2, warnings=$3 where id=$1",
                          r8["id"], keep,
                          [{"code": "count_guard", "n": 10, "of": 34,
                            "detail": "El archivo tiene 34 líneas de producto y sólo he sabido leer "
                                      "10. Falta demasiado: míralo antes de guardar."}])
    blocked = await ob.commit_intake(r8["id"], T_NEW)
    ck("⚑ I8 «SI SE HA DEJADO MEDIA LISTA, ME LO DICE Y NO LA GUARDA A CIEGAS» — el archivo decía "
       "34 y leyó 10; guardar exige un «sí, guárdalo igual» explícito",
       blocked and blocked.get("ok") is False and blocked.get("reason") == "count_guard",
       str(blocked)[:140])
    forced = await ob.commit_intake(r8["id"], T_NEW, override_guard=True)
    ck("I8 …y ese «igual» existe: es su catálogo y él decide, pero tiene que decirlo",
       forced and forced.get("ok"), str(forced)[:100])

    # ── I9 · durable, and idempotent on a retry ──────────────────────────────────────────────────
    again = await ob.commit_intake(r8["id"], T_NEW, override_guard=True)
    ck("⚑ I9 «SI SE ME VA EL MÓVIL A MITAD, LA SUBIDA SIGUE AHÍ» — reintentar el guardado devuelve "
       "el resultado del primero, no sube el catálogo dos veces",
       again and again.get("ok") and again.get("already") is True, str(again)[:120])
    listed = await ob.list_intakes(T_NEW)
    ck("I9 …y puede ver qué subió y en qué quedó cada cosa",
       len(listed) >= 4 and {i["state"] for i in listed} >= {"ready", "committed"},
       str([(i["source_kind"], i["state"]) for i in listed]))

    # ── I11 · an enormous paste is refused, never half-saved ─────────────────────────────────────
    from brain import skuparse
    huge = await skuparse.parse_paste("Chorizo sarta 9,80\n" * 6000)
    ck("⚑ I11 «UN TEXTO ENORME NO SE GUARDA A MEDIAS» — por encima del techo se RECHAZA con una "
       "frase, nunca se queda con los primeros 60.000 caracteres y calla",
       huge.get("ok") is False and "demasiado largo" in (huge.get("error") or ""),
       (huge.get("error") or "")[:90])

    # ── I12 · discard ────────────────────────────────────────────────────────────────────────────
    r12 = await ob.create_intake(T_NEW, "vital@rocoto", source_kind="paste",
                                 source_name="pegado", text="Chorizo sarta - 9,80 €/kg")
    async with db.get_pool().acquire() as con:
        ref = await con.fetchval("select raw_ref from catalogue_intake where id=$1", r12["id"])
    gone = await ob.discard_intake(r12["id"], T_NEW)
    ck("⚑ I12 «SI LO DESCARTO, SE VA» — el estado queda (alguien miró y dijo que no) y el archivo "
       "no", gone and gone.get("ok") and not Path(ref).exists(), f"{gone} · {ref}")

    # ── tenancy: an intake is one tenant's and nobody else's ─────────────────────────────────────
    other = await ob.get_intake(iid1, T_OLD)
    ck("I13 un intake de un cliente no existe para otro — id equivocado e inquilino equivocado se "
       "responden igual, a propósito", other is None, str(other)[:60])

    # ── I14-I18 · THE ROUTES, through the real ASGI app (house pattern: httpx.ASGITransport) ──────
    # Everything above proves the ORGAN. This half proves the DOOR: one URL that takes a file OR a
    # paste, both credentials, and no way in without one.
    try:
        import httpx

        import app as rocoto_app
    except Exception as exc:
        skip("I14-I18 (the routes)", f"httpx / app unavailable here: {exc}")
    else:
        tr = httpx.ASGITransport(app=rocoto_app.app)             # no lifespan → no startup writes
        async with httpx.AsyncClient(transport=tr, base_url="http://vital") as c:
            r = await c.post("/api/app/catalogue/intake", json={"text": "Chorizo sarta - 9,80"})
            ck("⚑ I14 sin credencial NO SE ENTRA — ni con bearer ni con cookie; la subida de "
               "catálogo escribe en el suelo del que come el pedido",
               r.status_code in (401, 403), f"HTTP {r.status_code}")
            r = await c.get(f"/api/app/catalogue/intake/{iid1}")
            ck("I14 …y tampoco se LEE lo que otro subió", r.status_code in (401, 403),
               f"HTTP {r.status_code}")

            # From here on the gate is stubbed to a known tenant: what is under test is the ROUTE
            # (its body handling, its wiring), not the identity check just proved above.
            rocoto_app.app.dependency_overrides[rocoto_app._intake_gate] = lambda: {
                "tenant": T_NEW, "actor": "vital@rocoto", "door": "app"}
            try:
                r = await c.post("/api/app/catalogue/intake",
                                 files={"file": ("precios.csv", raw, "text/csv")})
                ck("⚑ I15 «SUBO EL ARCHIVO DESDE LA APP» — multipart por la misma URL, y la lectura "
                   "arranca en segundo plano (el móvil no se queda colgado de un Excel)",
                   r.status_code == 200 and r.json().get("state") == "parsing",
                   f"HTTP {r.status_code} {r.text[:100]}")
                iid_http = r.json().get("id")
                r = await c.post("/api/app/catalogue/intake",
                                 json={"text": WHATSAPP_LIST, "name": "pegado"})
                ck("⚑ I16 «O LO PEGO» — LA MISMA URL acepta JSON. Una ruta que declara un `File(...)` "
                   "no puede aceptar un cuerpo JSON, y «pegar O subir» es la razón de existir de "
                   "esta ruta: el cuerpo se lee por content-type",
                   r.status_code == 200 and r.json().get("state") == "parsing",
                   f"HTTP {r.status_code} {r.text[:100]}")
                r = await c.post("/api/app/catalogue/intake",
                                 json={"text": "Chorizo sarta 9,80\n" * 6000})
                ck("I17 un pegado enorme lo rechaza la RUTA, con su frase — nunca guarda los "
                   "primeros 60.000 caracteres y calla", r.status_code == 413,
                   f"HTTP {r.status_code}")
                out = await _poll(ob, iid_http, T_NEW)
                ck("I15 …y al consultarla, la ruta devuelve lo leído CON el diff contra el catálogo "
                   "de hoy — calculado al leer, así que nunca promete algo que ya no es verdad",
                   out and out["state"] == "ready" and isinstance(out.get("diff"), dict)
                   and out["diff"].get("ok"), f"state={out['state'] if out else '—'}")
                r = await c.get(f"/api/app/catalogue/intake/{iid_http}")
                body = r.json()
                ck("I15 …la misma foto por HTTP: filas, avisos y los cuatro montones",
                   r.status_code == 200 and body["count"] == len(out["rows"])
                   and set(body["diff"]) >= {"nuevos", "cambian", "iguales", "salen", "renames"},
                   f"HTTP {r.status_code} count={body.get('count')}")
                target = body["rows"][0]
                r = await c.patch(f"/api/app/catalogue/intake/{iid_http}",
                                  json={"ops": {str(target["n"]): {"price": "1,11"}}})
                ck("I15 …y la corrección viaja por HTTP igual que por dentro",
                   r.status_code == 200
                   and any(x["n"] == target["n"] and x["price"] == 1.11 for x in r.json()["rows"]),
                   f"HTTP {r.status_code}")
                r = await c.post(f"/api/app/catalogue/intake/{iid_http}/discard")
                ck("I15 …y se puede tirar", r.status_code == 200 and r.json().get("ok"),
                   f"HTTP {r.status_code}")
            finally:
                rocoto_app.app.dependency_overrides.clear()

            # ── I18 · THE DESK DOOR, with a real cookie ─────────────────────────────────────────
            # Everything above went in with a phone's BEARER. The desk has no bearer — it exchanged
            # it for a `sup_session` cookie the moment it signed in — and «one road, two doors» is
            # only true if this half is true too. A real session is minted (not the OAuth path: this
            # is about the DOOR, not about who may open it) and used exactly as the browser does.
            import sup_session
            s = await sup_session.mint("vital@rocoto", T_NEW, "owner", "127.0.0.1", "vital")
            async with httpx.AsyncClient(
                transport=tr, base_url="http://vital",
                cookies={sup_session.SUP_COOKIE if hasattr(sup_session, "SUP_COOKIE") else "sup_session": s["raw"]},
            ) as dc:
                # The browser sends BOTH halves of the double submit: the cookie and the token the
                # session handed it. (Written without the header first, and the route refused it —
                # which is the wall doing its job, not a bug.)
                r = await dc.post("/api/app/catalogue/intake",
                                  json={"text": "Chorizo sarta - 9,80 €/kg"},
                                  headers={"x-sup-csrf": s["csrf"]})
                ck("⚑ I18 «LO PEGO DESDE EL ORDENADOR» — la MISMA ruta acepta la cookie del "
                   "escritorio. Un teléfono y una mesa no pueden contarle al mismo proveedor dos "
                   "historias distintas sobre la misma lista",
                   r.status_code == 200 and r.json().get("state") == "parsing",
                   f"HTTP {r.status_code} {r.text[:120]}")
                iid_desk = r.json().get("id") if r.status_code == 200 else None
                # …and the CSRF wall is NOT lowered to let the desk in.
                r = await dc.post("/api/app/catalogue/intake",
                                  json={"text": "Chorizo sarta - 9,80 €/kg"},
                                  headers={"x-sup-csrf": "el-token-de-otro"})
                ck("I18 …y la doble comprobación CSRF sigue en pie: un token equivocado se rechaza, "
                   "no se ignora por venir del escritorio",
                   r.status_code == 403, f"HTTP {r.status_code}")
                if iid_desk:
                    out = await _poll(ob, iid_desk, T_NEW, tries=60)
                    ck("I18 …y lo pegado desde la mesa se lee igual que lo pegado desde el móvil",
                       out is not None and out["state"] == "ready" and out["count"] >= 1,
                       f"state={out['state'] if out else '—'} count={out['count'] if out else 0}")
                    await ob.discard_intake(iid_desk, T_NEW)
            async with db.get_pool().acquire() as con:
                await con.execute("delete from sup_session where session_id=$1", s["session_id"])

    await _cleanup(db)
    ok = sum(1 for x in R if x)
    print(f"\n  {ok}/{len(R)} PASS" + (f" · {len(SKIPPED)} skipped" if SKIPPED else ""))
    return 0 if ok == len(R) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()) or 0)
