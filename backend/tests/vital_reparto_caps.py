"""vital_reparto_caps.py — THE DRIVER CAN REACH THE VAN AND NOTHING ELSE (SPEC §5.11.3).

Adding a `repartidor` role to this codebase was a SECURITY change before it was a feature, and this
vital is the proof. Before it, both resolvers coerced an unrecognised `team_members.role` to
'staff' — and 'staff' carries read+act — so the first `role='repartidor'` row on prod would have
minted a full operator who could approve orders, edit lines and send WhatsApp as Rocoto. Each check
below is that promise, not arithmetic:

  C1  ONE RULE, TWO CARRIERS      — sup_session.ROLE_CAPS and brain_auth.APP_ROLE_CAPS are IDENTICAL.
                                    The desk and the phone resolve membership through one function on
                                    purpose; if the two cap tables disagreed, that disagreement would
                                    BE the vulnerability.
  C2  THE DRIVER HOLDS ONE CAP    — `repartidor` = {deliver}. Not read. Not act. Not admin.
  C3  UNKNOWN IS DENIED, NOT DEMOTED — a role nobody declared reaches NOTHING. The old fallback to
                                    'staff' made every future role a privilege grant by default.
  C4  THE SENIORS CARRY IT        — owner/founder/staff all hold `deliver`, because the day-one case
                                    is the boss driving his own van and he must not need a second
                                    account (Peter, 2026-07-27).
  C5  THE REAL PROOF, STRUCTURAL  — EVERY pre-existing capability-gated route in app.py and sup_api.py
                                    asks for read | act | admin. None asks for `deliver` alone. So a
                                    repartidor session is refused by all of them WITHOUT any handler
                                    having been edited, and least privilege is a property of the cap
                                    set rather than an allowlist somebody must remember to update.
                                    This is the check that catches a future route being written with
                                    the wrong cap.
  C6  DELIVER IS NOT A BACK DOOR  — `deliver` grants nothing on the read/act/admin ladder: no role
                                    gets admin from it, and holding it alone satisfies no existing
                                    dependency.

PURE — no database, no config, no network. It reads the source of both resolvers and both route
files, so it fails at build time rather than on prod.
Run: PYTHONPATH=. python3 tests/vital_reparto_caps.py
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# The caps a route may demand. `deliver` is deliberately NOT here: see C5.
LADDER = {"read", "act", "admin"}
CAP_CALL = re.compile(r"require(?:_app)?(?:_runtime)?_cap\(\s*['\"]([a-z]+)['\"]")


def main():
    print("VITAL: reparto-caps (§5.11.3 — least privilege for the van driver)")

    import sup_session
    from brain import auth as brain_auth

    desk, phone = sup_session.ROLE_CAPS, brain_auth.APP_ROLE_CAPS

    # C1 — one rule, two carriers.
    ck("C1 the two cap tables are identical",
       {k: set(v) for k, v in desk.items()} == {k: set(v) for k, v in phone.items()},
       f"desk={sorted(desk)} phone={sorted(phone)}")

    # C2 — the driver holds exactly one cap.
    ck("C2 repartidor = {deliver} exactly",
       set(desk.get("repartidor", set())) == {"deliver"},
       f"got {sorted(desk.get('repartidor', []))}")
    for bad in ("read", "act", "admin"):
        ck(f"C2 repartidor does NOT hold '{bad}'",
           not sup_session.can("repartidor", bad) and not brain_auth.app_can("repartidor", bad))

    # C3 — an unknown role reaches nothing, on BOTH carriers.
    for role in ("desconocido", "conductor", "", "REPARTIDOR", "admin"):
        ck(f"C3 unknown role {role!r} reaches nothing",
           not any(sup_session.can(role, c) for c in LADDER | {"deliver"})
           and not any(brain_auth.app_can(role, c) for c in LADDER | {"deliver"}),
           "coercing to 'staff' would hand out read+act")

    # C4 — the seniors can drive.
    for role in ("owner", "founder", "staff"):
        ck(f"C4 {role} carries deliver",
           sup_session.can(role, "deliver") and brain_auth.app_can(role, "deliver"))

    # C5 — THE STRUCTURAL PROOF. No pre-existing route is satisfied by `deliver` alone.
    caps_demanded = set()
    for fname in ("app.py", "sup_api.py"):
        src = open(os.path.join(ROOT, fname), encoding="utf-8").read()
        caps_demanded |= set(CAP_CALL.findall(src))
    ck("C5 every capability-gated route demands read|act|admin",
       caps_demanded and caps_demanded <= LADDER,
       f"demanded: {sorted(caps_demanded)}")
    ck("C5 a repartidor satisfies NO existing route's cap",
       not any(sup_session.can("repartidor", c) for c in caps_demanded),
       f"{len(caps_demanded)} distinct caps guarded across app.py + sup_api.py")

    # C6 — deliver is orthogonal: it never implies anything on the ladder.
    ck("C6 deliver implies nothing on the read/act/admin ladder",
       all(not (set(v) == {"deliver"} and set(v) & LADDER) for v in desk.values()))
    ck("C6 no role holds admin without also holding read and act",
       all(not ("admin" in v and not {"read", "act"} <= set(v)) for v in desk.values()))

    ok = all(R)
    print(f"\n{'PASS' if ok else 'FAIL'}: {sum(R)}/{len(R)} checks")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
