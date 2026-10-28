"""vital_cr_tokens.py — WP-9: the CR design foundation is intact.

Pure file check (no DB). The CR is on ONE token source of truth (tokens.css, generated from Tokens.kt);
this gate proves the DEPLOYED artifacts hold together: tokens.css carries the generated header + the core
token groups, and EVERY `var(--rocoto-*)` cr.css references resolves (in tokens.css or the small labelled
cr.css CR-local :root block). Catches a broken/half-regenerated tokens.css or a cr.css that drifted to an
undefined var. (Tokens.kt itself is not deployed to prod, so build-time regeneration is the drift guard;
this is the runtime-artifact guard.)
"""
import re
from pathlib import Path

CR = Path(__file__).resolve().parent.parent / "cr"
R = []
def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))

def main():
    tokens = (CR / "tokens.css").read_text()
    crcss = (CR / "cr.css").read_text()
    index = (CR / "index.html").read_text()
    defined = set(re.findall(r'(--rocoto-[a-z0-9-]+)\s*:', tokens)) | set(re.findall(r'(--rocoto-[a-z0-9-]+)\s*:', crcss))
    refs = set(re.findall(r'var\((--rocoto-[a-z0-9-]+)', crcss))

    ck("tokens.css carries the GENERATED-from-Tokens.kt header", tokens.lstrip().startswith("/* GENERATED"))
    core = ["--rocoto-bg", "--rocoto-fg", "--rocoto-saffron", "--rocoto-space-lg", "--rocoto-radius-card",
            "--rocoto-elevation-card", "--rocoto-motion-standard", "--rocoto-motion-dur-standard",
            "--rocoto-stroke-hairline", "--rocoto-chat-out-bubble"]
    miss_core = [v for v in core if v not in defined]
    ck("core token groups present (color/space/radius/elevation/motion/stroke/chat)", not miss_core, ", ".join(miss_core))
    missing = sorted(refs - defined)
    ck("every var(--rocoto-*) in cr.css resolves", not missing, ", ".join(missing[:10]))
    ck("index.html loads the token + css + js bundle", all(x in index for x in ["tokens.css", "cr.css", "cr.js"]))
    hexes = re.findall(r':\s*(#[0-9A-Fa-f]{3,6})\b', crcss)
    ck("hand-picked hex confined to the labelled CR-local extensions (<=3)",
       len(hexes) <= 3, f"{len(hexes)} literal hex: {hexes}")

    print(f"\nvital_cr_tokens: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)

if __name__ == "__main__":
    main()
