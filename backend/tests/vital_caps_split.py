#!/usr/bin/env python3
"""vital_caps_split — §17.34's three-way split of the `admin` bit (WP-A3).

    admin:rocoto   the employee's own settings — catalogue, documents, sends, behaviour, alerts
    admin:negocio  the business — fiscal, IBAN, subscription, zones, people, invitations
    golive         arming and disarming a channel

THE PROPERTY THAT MATTERS MOST IS THAT NOTHING CHANGED YET. `admin` survives as a one-release
legacy alias, so all 29 existing `require_cap("admin")` sites keep meaning owner/founder only.
A role split that silently widens an endpoint is a privilege escalation nobody reviewed — so the
first assertions here are about what did NOT move.

The desk and the phone carry the same table on purpose («a staff account means the same thing on
the phone as on the desk»), and that agreement is asserted rather than assumed: two hand-maintained
permission tables drift, and the drift is invisible until someone reaches something they should not.

Run:  python3 tests/vital_caps_split.py     (no database needed — this is pure policy)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import sup_session  # noqa: E402
from brain import auth as brain_auth  # noqa: E402

PASS = FAIL = 0


def ck(label, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  [PASS] {label}" + (f" — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


def main() -> int:
    can = sup_session.can

    print("\n-- (1) NADA SE HA ENSANCHADO (lo primero, porque es lo peligroso) --")
    ck("el alias legacy `admin` sigue siendo SOLO propietario/fundador",
       can("owner", "admin") and can("founder", "admin")
       and not can("staff", "admin") and not can("repartidor", "admin"))
    ck("la oficina NO gana `admin` por la puerta de atras — "
       "ningun endpoint de hoy cambia de dueno", not can("staff", "admin"))
    ck("el repartidor sigue teniendo exactamente una capacidad",
       sup_session.ROLE_CAPS["repartidor"] == frozenset({"deliver"}))

    print("\n-- (2) §17.34 · LA OFICINA LLEVA EL EMPLEADO, EL DUENO LLEVA EL NEGOCIO --")
    ck("la oficina PUEDE con los ajustes del empleado (catalogo, documentos, envios)",
       can("staff", "admin:rocoto"))
    ck("la oficina NO puede con el negocio (fiscal, IBAN, suscripcion, personas)",
       not can("staff", "admin:negocio"))
    ck("armar y desarmar es SOLO del dueno (§17.34.3: cerrar un canal pesa como abrirlo)",
       can("owner", "golive") and not can("staff", "golive") and not can("repartidor", "golive"))
    ck("el dueno lo tiene todo", all(can("owner", c) for c in
       ("read", "act", "deliver", "admin", "admin:rocoto", "admin:negocio", "golive")))

    print("\n-- (3) UN ROL DESCONOCIDO NO ALCANZA NADA --")
    for cap in ("read", "act", "admin", "admin:rocoto", "admin:negocio", "golive", "deliver"):
        if can("desconocido", cap) or can("", cap):
            ck(f"un rol desconocido no alcanza {cap}", False)
            break
    else:
        ck("un rol desconocido (o vacio) no alcanza NADA — se deniega, no se degrada", True)

    print("\n-- (4) EL MOVIL Y EL ESCRITORIO DICEN LO MISMO --")
    desk = {r: set(c) for r, c in sup_session.ROLE_CAPS.items()}
    phone = {r: set(c) for r, c in brain_auth.APP_ROLE_CAPS.items()}
    ck("las dos tablas cubren los mismos roles", set(desk) == set(phone),
       f"{sorted(desk)} vs {sorted(phone)}")
    diffs = {r: (desk[r] ^ phone[r]) for r in desk if r in phone and desk[r] != phone[r]}
    ck("y conceden exactamente las mismas capacidades por rol — dos tablas a mano se separan, "
       "y la separacion no se ve hasta que alguien alcanza algo que no deberia",
       not diffs, str(diffs))

    print(f"\n  {PASS}/{PASS + FAIL} PASS" + ("" if not FAIL else f"  [{FAIL} FAILED]"))
    return 1 if FAIL else 0


if __name__ == "__main__":
    print("-- vital_caps_split · §17.34 el bit admin se parte en tres --")
    sys.exit(main())
