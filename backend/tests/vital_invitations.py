#!/usr/bin/env python3
"""vital_invitations — §17.41's invitation · §17.33's states (WP-A3).

§17.41's acceptance is a sentence: «a stranger with a link joins as Oficina in under a minute».
Everything below is what has to be true for that sentence to be safe.

THE TWO LAWS, and they are the reason this file exists:
  · «NOTHING ABOUT THE PERSON CHANGES UNTIL THEY ACCEPT» (§17.33). A pending invitation must grant
    nothing at all — no membership, no read. If it granted anything, «invitation pending» would be
    a lie on the roster.
  · «REVOKING KILLS THE LINK IMMEDIATELY; THEY WERE NEVER IN THE DATA» (§17.33). Not eventually,
    not at the next sweep — the instant the column is written, including for a link already sitting
    open in someone's browser.

And the one §17.41 spells out for the page: an expired or revoked link «says so plainly and offers
nothing» — so each refusal is a DISTINCT reason, never a shrug.

Run:  source deploy/harness/rehearsal_env.sh && python3 tests/vital_invitations.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import db  # noqa: E402

PASS = FAIL = 0
T = "vitalinv"
EMAIL = "oficina@ejemplo.es"


def ck(label, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  [PASS] {label}" + (f" — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


async def members(tenant):
    async with db.get_pool().acquire() as con:
        return await con.fetchval(
            "select count(*) from team_members where tenant_slug=$1", tenant)


async def main() -> int:
    await db.init()
    from brain import invitations as inv

    async with db.get_pool().acquire() as con:
        await con.execute("insert into tenants(slug,name,status,seeded) values($1,'La Brujula','test',true) "
                          "on conflict (slug) do nothing", T)
        await con.execute("delete from invitation where tenant_slug=$1", T)
        await con.execute("delete from team_members where tenant_slug=$1", T)

    print("\n-- (1) NADA CAMBIA HASTA QUE ACEPTA (§17.33) --")
    i = await inv.create(T, EMAIL, "staff", invited_by="maria@labrujula.es")
    ck("la invitacion existe y lleva su papel", i["role"] == "staff" and len(i["token"]) > 20)
    ck("PERO no ha creado ningun miembro — «invitacion pendiente» seria mentira si lo hiciera",
       await members(T) == 0, f"miembros={await members(T)}")

    p = await inv.peek(i["token"])
    ck("la pagina de invitacion sabe quien invita y a que empresa (§17.41: el que invita es el sujeto)",
       p and p["invited_by"] == "maria@labrujula.es" and p["tenant_name"] == "La Brujula")
    ck("y queda marcada como ABIERTA — «enviada hace 2 dias · sin abrir» es una frase de la lista",
       p["opened_at"] is not None)
    ck("mirarla tampoco crea un miembro", await members(T) == 0)

    print("\n-- (2) EL ENLACE ES DE UNA PERSONA, NO AL PORTADOR --")
    bad = await inv.accept(i["token"], "otro@ejemplo.es")
    ck("otro correo NO entra — si no, el token seria una credencial al portador para la empresa",
       bad["ok"] is False and bad["error"] == "wrong_email", str(bad))
    ck("y sigue sin haber miembros", await members(T) == 0)

    ok = await inv.accept(i["token"], EMAIL)
    ck("el correo correcto entra, con SU papel", ok["ok"] and ok["role"] == "staff", str(ok))
    ck("ahora si hay un miembro", await members(T) == 1)
    again = await inv.accept(i["token"], EMAIL)
    ck("un enlace ya usado no vuelve a servir", again["ok"] is False and again["error"] == "accepted")

    print("\n-- (3) REVOCAR MATA EL ENLACE EN EL ACTO --")
    j = await inv.create(T, "segundo@ejemplo.es", "repartidor", invited_by="maria@labrujula.es")
    ck("revocar responde que si", await inv.revoke(j["token"]) is True)
    r = await inv.accept(j["token"], "segundo@ejemplo.es")
    ck("y el enlace muere AL INSTANTE, no en la proxima pasada "
       "(incluso uno ya abierto en el navegador de alguien)",
       r["ok"] is False and r["error"] == "revoked", str(r))
    ck("no se ha creado miembro alguno", await members(T) == 1)

    print("\n-- (4) CADUCA A LOS 7 DIAS, Y SE COMPRUEBA AL USARLO --")
    k = await inv.create(T, "tarde@ejemplo.es", "staff")
    async with db.get_pool().acquire() as con:
        await con.execute("update invitation set expires_at = now() - interval '1 day' "
                          "where token=$1", k["token"])
    e = await inv.accept(k["token"], "tarde@ejemplo.es")
    ck("caducada dice CADUCADA — cada negativa tiene su razon, nunca un encogimiento de hombros "
       "(§17.41: «lo dice claramente y no ofrece nada»)",
       e["ok"] is False and e["error"] == "expired", str(e))
    ck("un token inventado se distingue de uno caducado",
       (await inv.accept("no-existe", EMAIL))["error"] == "unknown")

    print("\n-- (5) REINVITAR REENVIA, NO ACUMULA ENLACES VIVOS --")
    a = await inv.create(T, "repe@ejemplo.es", "staff")
    b = await inv.create(T, "repe@ejemplo.es", "staff")
    old = await inv.accept(a["token"], "repe@ejemplo.es")
    ck("el enlace ANTERIOR deja de servir en cuanto se reenvia",
       old["ok"] is False and old["error"] == "revoked", str(old))
    ck("el nuevo si sirve", (await inv.accept(b["token"], "repe@ejemplo.es"))["ok"] is True)

    print("\n-- (6) LA LISTA MUESTRA ESTADOS, Y NO REPARTE LLAVES --")
    await inv.create(T, "pendiente@ejemplo.es", "staff")
    ros = await inv.roster(T)
    by_email = {x["email"]: x["state"] for x in ros}
    ck("las aceptadas y las revocadas SALEN de la lista (esos dos actos terminan una invitacion)",
       "oficina@ejemplo.es" not in by_email and "segundo@ejemplo.es" not in by_email, str(by_email))
    ck("la pendiente sigue, como pendiente", by_email.get("pendiente@ejemplo.es") == "pending")
    ck("y la CADUCADA sigue en la lista, marcada como tal — es la fila que pide «Reenviar», "
       "y una invitacion que desaparece sola a los 7 dias es justo el estado que hay que ver",
       by_email.get("tarde@ejemplo.es") == "expired", str(by_email))
    ck("y la lista NO devuelve los tokens — enumera invitaciones, no reparte sus llaves",
       all("token" not in x for x in ros))

    rejected = 0
    for args in ((T, "sin-arroba", "staff"), (T, "x@y.es", "jefazo")):
        try:
            await inv.create(*args)
        except ValueError:
            rejected += 1
    ck("un correo invalido o un papel inventado se rechazan en voz alta", rejected == 2)

    async with db.get_pool().acquire() as con:
        await con.execute("delete from invitation where tenant_slug=$1", T)
        await con.execute("delete from team_members where tenant_slug=$1", T)
        await con.execute("delete from tenants where slug=$1", T)

    print(f"\n  {PASS}/{PASS + FAIL} PASS" + ("" if not FAIL else f"  [{FAIL} FAILED]"))
    return 1 if FAIL else 0


if __name__ == "__main__":
    print("-- vital_invitations · §17.41 el token ES el enlace · §17.33 los estados --")
    sys.exit(asyncio.run(main()))
