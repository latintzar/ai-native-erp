"""Decision agent (Sonnet) — pick the SKU from the matcher's candidates, and CARRY THE DOUBT.

This is the match-check layer (Register #17) + the single decision (Register #18): it sees each
line's candidates (with bands + scores), the runner-up, and the deterministic validator flags, then
chooses the SKU and writes a rare, friendly keep-in-mind note only on genuine doubt. It never
invents a SKU. Falls back to the matcher's own pick if the model is unavailable.

⚠️ ONE SENTENCE OF THIS DOCSTRING STOPPED BEING TRUE ON 2026-07-26 (WP-2, SPEC §5.7a). It used to
say "it never asks a question", and that was the honest description of a product that made the
DISTRIBUTOR clean up every ambiguity. §5.7 inverted it: the customer is the only person who knows
what «el jamoncito» meant, so the customer is who we ask. Rather than leave a docstring quietly
contradicted by the code, here is the new truth, stated precisely:

  * THE MIND STILL DOES NOT DECIDE TO ASK. `doubt.py` decides — deterministically, with a KIND, a
    DIRECTION and a one-question BUDGET — and the decision is taken upstream, in `brain/pipeline.py`,
    where the connection and the audio verdict live.
  * THIS MODULE IS WHERE THE VERDICT MEETS THE MIND. `doubt.doubt_note(verdict)` is spliced into the
    user turn BEFORE the line blob — organ ② → ④, the exact twin of `confidence.perception_note`
    going into `runtime.run_turn(perception_note=…)`. Pre-reasoning datum, never a branch around the
    mind: the mind knows it is unsure and speaks in its own voice.
  * IT IS EMPTY ON A CLEAN ORDER, AND THAT IS LOAD-BEARING. `doubt_note` returns "" when nothing is
    doubted and `build_user()` then splices NOTHING — a clean order's prompt is byte-identical to
    what it was before this wire existed. Prompt noise on the common path is how a faculty like this
    quietly degrades every other line it touches. `vital_doubt_wire` W1/W9 assert it.
  * THE MIND ONLY WRITES THE SENTENCE. `pregunta` comes back as free es-ES text; the OPTIONS are the
    faculty's real catalogue rows and the surface (buttons vs list) is `actions.py`'s call. The mind
    never picks candidates, never numbers them, never sends anything.

WHY THE QUESTION IS BUILT HERE AND SENT THERE: this module has the model but no scope and no mouth;
`pipeline.py` has both. Splitting it that way keeps `decide()` a pure LLM call that a vital can run
with a stubbed model and no network, and keeps every egress on the one gated door in `actions.py`.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import config
import doubt
from brain import llm, prompts

log = logging.getLogger("rocoto.brain.decision")


def _line_blob(i: int, gl: Dict[str, Any], fl: Dict[str, Any]) -> str:
    m = gl.get("match") or {}
    cands = (m.get("candidates") or [])[:3]
    lines = [f"LINE {i}: customer said \"{gl.get('mention')}\"  qty={gl.get('qty')} unit={gl.get('unit') or '?'}",
             f"  matcher band: {m.get('band')}  alias_hit: {m.get('alias_hit')}"]
    if cands:
        lines.append("  candidates:")
        for c in cands:
            lines.append(f"    - {c.get('sku_id')}  \"{c.get('name')}\"  (score {c.get('score')})")
    else:
        lines.append("  candidates: (none cleared the floor — likely not in catalogue)")
    if fl.get("qty_off_norm") and fl.get("typical_qty"):
        lines.append(f"  validator: qty {gl.get('qty')} is off-normal vs usual ~{fl['typical_qty']}")
    if not fl.get("unit_ok") and fl.get("unit_note"):
        lines.append(f"  validator: {fl['unit_note']}")
    elif fl.get("variable_weight"):
        lines.append("  validator: variable-weight item (exact kg at dispatch)")
    return "\n".join(lines)


def build_user(ctx: Dict[str, Any], synth: Dict[str, Any], vflags: List[Dict[str, Any]],
               doubt_verdict: Optional[Dict[str, Any]] = None) -> str:
    """The EXACT user turn `decide()` sends. Pure — no model, no DB — so the wire's load-bearing
    claim ("the note is injected BEFORE the mind reasons, and is absent on a clean order") is an
    assertion a vital can make on the real string rather than a comment nobody checks.

    ORDER IS THE POINT: instruction → ⚠️ DUDA (if any) → the line blob → the profile. The note sits
    ABOVE the evidence it is about, mirroring `runtime.py`'s perception splice, so the mind reads
    "you are unsure about line N" before it reads line N and not after it has already concluded.
    """
    grounded = synth.get("grounded_lines") or []
    blob = "\n\n".join(_line_blob(i, gl, vflags[i] if i < len(vflags) else {})
                       for i, gl in enumerate(grounded))
    parts = ["Choose the best SKU for each line and add keep_in_mind ONLY on genuine doubt."]

    note = doubt.doubt_note(doubt_verdict or {})
    if note:
        # Empty note ⇒ nothing is spliced at all (not an empty heading, not a blank line): a clean
        # order must produce the prompt it produced before this faculty existed.
        parts += ["", "### " + note]
        ask = (doubt_verdict or {}).get("ask") or []
        if ask:
            parts.append(
                "Escribe `pregunta`: UNA sola pregunta en es-ES sobre «"
                + str(ask[0].get("mention") or "")
                + "», con el tono de §5.7 (el proveedor que se asegura, no el software que se lía). "
                  "Nombra el producto; NO enumeres las opciones — salen como botones.")
        else:
            # A verdict with flagged/ungrounded lines but no askable one. Say so explicitly, or the
            # mind reads a DUDA block and helpfully invents a question the budget already spent.
            parts.append("En este pedido NO se pregunta nada: deja `pregunta` vacío.")

    parts += ["", blob, "", f"PROFILE:\n{ctx.get('profile_text', '')}"]
    return "\n".join(parts)


# ── the deterministic sentence, for when there is no model ────────────────────────────────────
# Fail-soft on the WRITE path, never on the RULE: if the mind is unavailable the QUESTION STILL GOES
# OUT. A doubted line that silently becomes a guess is the failure §5.7a exists to prevent, and an
# in-character canned sentence is a far smaller loss than not asking at all. Written to the §5.7 tone
# law — checking, not confirming, and never «apuntado».
_FALLBACK_QUESTION = {
    doubt.AMBIGUOUS: "A ver que no la líe: cuando me dices «{m}», ¿cuál de estos me pides?",
    doubt.DIMENSIONLESS: "Una cosa rápida con «{m}»: ¿cuál te pongo?",
    doubt.UNIT: "Con «{m}», que no quiero apuntarte lo que no es: ¿cómo te lo pongo?",
    doubt.THIN: "Dime que no la lío: con «{m}», ¿te refieres a esto?",
}


def fallback_question(entry: Dict[str, Any]) -> str:
    """The es-ES question for ONE `doubt.classify()` ask entry, with no model in the loop."""
    m = str((entry or {}).get("mention") or "").strip()
    tmpl = _FALLBACK_QUESTION.get((entry or {}).get("kind") or "",
                                  "A ver que no la líe: cuando me dices «{m}», ¿cuál de estos me pides?")
    return tmpl.format(m=m) if m else ""


async def decide(ctx: Dict[str, Any], synth: Dict[str, Any], vflags: List[Dict[str, Any]],
                 *, doubt_verdict: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Pick the SKU per line, and — only when the faculty spent this order's question — the sentence.

    Returns {lines, order_note, pregunta}. `pregunta` is "" on every clean order and on every path
    where the model was unavailable; `pipeline.py` fills that hole with `fallback_question()` so the
    ask never depends on the LLM being up.
    """
    grounded = synth.get("grounded_lines") or []
    if not grounded:
        return {"lines": [], "order_note": "", "pregunta": ""}

    user = build_user(ctx, synth, vflags, doubt_verdict)
    decided = None
    try:
        decided = await llm.call_tool(
            config.DECISION_MODEL, prompts.DECISION_SYSTEM, user, prompts.DECISION_TOOL,
            "decide_order", max_tokens=1536, fallback=config.ORDER_EXTRACT_FALLBACK_MODEL)
    except Exception:
        log.exception("decision failed")

    if not decided or not decided.get("lines"):
        # fall back to the matcher's own picks so we always file an order
        out = []
        for i, gl in enumerate(grounded):
            pick = (gl.get("match") or {}).get("pick") or {}
            out.append({"index": i, "sku_id": pick.get("sku_id", ""),
                        "qty": gl.get("qty"), "unit": gl.get("unit", ""), "keep_in_mind": ""})
        return {"lines": out, "order_note": synth.get("order_note", ""), "pregunta": ""}

    # guard the indices + carry qty defaults
    clean = []
    for d in decided["lines"]:
        i = d.get("index")
        if not isinstance(i, int) or not (0 <= i < len(grounded)):
            continue
        if d.get("qty") is None:
            d["qty"] = grounded[i].get("qty")
        if not d.get("unit"):
            d["unit"] = grounded[i].get("unit", "")
        clean.append(d)
    if not clean:  # indices all bad -> matcher fallback
        clean = [{"index": i, "sku_id": (gl.get("match") or {}).get("pick", {}).get("sku_id", ""),
                  "qty": gl.get("qty"), "unit": gl.get("unit", ""), "keep_in_mind": ""}
                 for i, gl in enumerate(grounded)]
    # The mind may only speak when the FACULTY opened the door — a `pregunta` on an order with no
    # askable doubt is a hallucinated question to a real customer, so it is dropped here rather than
    # trusted. The budget is code's, never the model's.
    pregunta = str(decided.get("pregunta") or "").strip()
    if not ((doubt_verdict or {}).get("ask")):
        pregunta = ""
    return {"lines": clean, "order_note": decided.get("order_note", synth.get("order_note", "")),
            "pregunta": pregunta}
