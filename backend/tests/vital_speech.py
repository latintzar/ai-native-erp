"""vital_speech.py — THE MOUTH SANITIZER (Peter 2026-07-22: the agent SPOKE «Risa breve, natural» aloud
in a live test). A stage direction must be PERFORMED (v3 → real [tag]) or DROPPED (flash) — never read
as text. Ordinary parentheticals (prices, asides) are untouched. Deterministic, no DB, no LLM.
"""
import os
import sys
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

sys.path.insert(0, ".")
from voice_reply import sanitize_spoken  # noqa: E402

R = []


def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


CASES = [
    ("(Risa breve, natural) Vale, te lo apunto.", False, "Vale, te lo apunto.", "the LIVE bug: cue stripped on flash"),
    ("*suspira* Bueno, a ver.", False, "Bueno, a ver.", "asterisk cue stripped"),
    ("[pausa] vale", False, "vale", "bracket cue stripped"),
    ("(tono alegre) ¡Hola!", False, "¡Hola!", "tone cue stripped"),
    ("(sonríe) claro que sí", False, "claro que sí", "prefix form (sonríe) stripped"),
    ("Son 2,50 € (2,50 el bote).", False, "Son 2,50 € (2,50 el bote).", "a REAL parenthetical (price) kept"),
    ("(risa) ¡Qué bueno!", True, "[laughs] ¡Qué bueno!", "v3: cue PERFORMED as a real audio tag"),
    ("(respira hondo) Vale.", True, "[exhales] Vale.", "v3: breathe-on-command PERFORMED (Peter's ask)"),
    ("[exhales] ¿Así? [laughs]", True, "[exhales] ¿Así? [laughs]", "deliberate v3 tags pass through"),
    ("(carraspea) Perdona, dime.", True, "[clears throat] Perdona, dime.", "clear-throat PERFORMED (Peter's ask)"),
    ("(tararea) Mmm, qué día.", True, "[hums] Mmm, qué día.", "humming PERFORMED (Peter's ask)"),
    ("(resopla) Vaya tela.", True, "[exhales] Vaya tela.", "nasal exhale PERFORMED (Peter's ask)"),
    ("[clears throat] A ver…", True, "[clears throat] A ver…", "official multi-word tag passes through"),
]

for text, v3, want, label in CASES:
    got = sanitize_spoken(text, v3=v3)
    ck(label, got == want, f"{got!r}")

passed = sum(R)
print(f"\nSPEECH SANITIZER: {passed}/{len(R)} — {'CUES PERFORMED, NEVER READ' if passed == len(R) else 'A CUE WOULD BE SPOKEN'}")
raise SystemExit(0 if passed == len(R) else 1)
