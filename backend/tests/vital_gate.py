"""vital_gate.py — the deterministic gate vitals (SPEC §5; BUILD-PLAN 4.1 DoD).

Pure function, no DB/LLM. Asserts the money floor: concessions and credit park; a factual quote of
the standing price passes; an off-book quote parks; autonomous grants = 0 (no money-shaped sentence
is ever `ok`).
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import gate  # noqa: E402

_results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    _results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def run() -> int:
    cases_park = [
        ("price concession", "Vale Manolo, te lo dejo a 2,80 el kilo 😉"),
        ("discount", "Te hago un descuento del 10% por ser tú."),
        ("free", "Este mes la última caja va gratis."),
        ("credit — fiao", "No te preocupes, te lo fío y me pagas la semana que viene."),
        ("credit — plazo", "Te lo dejo a plazo, págame cuando puedas."),
    ]
    for label, s in cases_park:
        v = gate.check_outbound(s)
        check(f"parks: {label}", v["needs_approval"] is True and v["money"] is True and v["ok"] is False, s)

    cases_pass = [
        ("factual standing quote", "El jamón está a 3,00 €/kg esta semana.", 3.00),
        ("plain logistics", "Perfecto, te lo llevo el martes por la mañana.", None),
        ("ack", "Recibido, gracias 🙌", None),
    ]
    for label, s, sp in cases_pass:
        v = gate.check_outbound(s, standing_price=sp)
        check(f"passes: {label}", v["ok"] is True and v["needs_approval"] is False, s)

    # an off-book quote (differs from the standing price) parks.
    v = gate.check_outbound("Te lo puedo poner a 2,50 el kilo.", standing_price=3.00)
    check("parks: off-book price vs standing", v["needs_approval"] is True and v["money"] is True,
          "quoted 2,50 vs standing 3,00")

    # autonomous grants = 0 — no concession is ever ok, across a battery of phrasings.
    grants = ["te lo rebajo a 2", "precio especial para ti", "te los dejo en 5€", "invita la casa"]
    all_parked = all(gate.check_outbound(g)["ok"] is False for g in grants)
    check("autonomous grants = 0 (every concession parked)", all_parked)

    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    print(f"\nGate vitals: {passed}/{total} passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(run())
