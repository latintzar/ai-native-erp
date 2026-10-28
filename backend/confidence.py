"""confidence.py — TRANSCRIPTION CONFIDENCE GATING (Peter 2026-07-22).

Two distinct failure modes when we turn spoken audio into an action, and they need DIFFERENT handling:

  * DIRTY AUDIO — low ASR confidence: the transcription itself is unreliable. Even perfect SKU matching
    is worthless on a bad transcript. → ALWAYS route the order/action to HUMAN REVIEW. A learning tab
    won't fix bad audio; a human has to confirm what was actually said.

  * CLEAR-BUT-UNFAMILIAR — high ASR confidence but words/slang/aliases the matcher couldn't resolve:
    the audio was fine, we just don't know their vocabulary yet. → a LEARNING tab that later reconciles
    against what the human ULTIMATELY confirmed/edited, learns 'when they say X they mean Y', and may
    fire a 'did you mean X?' follow-up. (Handled by the learning loop — this module classifies.)

Thresholds are knobs (measured baselines; tighten with traffic). Deterministic, no LLM.
"""
from __future__ import annotations

DIRTY_AVG = 0.62        # avg utterance confidence below this → dirty audio
DIRTY_LOW_WORD_FRAC = 0.22  # more than this fraction of words below 0.5 → dirty audio
DIRTY_MIN_WORD = 0.30   # any single word this unsure, on an order, is a smell


def score(utterances: list[dict]) -> dict:
    """Aggregate a transcript's confidence from Deepgram utterances (each carrying confidence +
    min_word_confidence + low_word_frac). Returns {avg, min_word, low_word_frac, n}."""
    confs = [u.get("confidence") for u in (utterances or []) if isinstance(u.get("confidence"), (int, float))]
    mins = [u.get("min_word_confidence") for u in (utterances or []) if isinstance(u.get("min_word_confidence"), (int, float))]
    fracs = [u.get("low_word_frac") for u in (utterances or []) if isinstance(u.get("low_word_frac"), (int, float))]
    avg = sum(confs) / len(confs) if confs else None
    return {"avg": avg, "min_word": (min(mins) if mins else None),
            "low_word_frac": (max(fracs) if fracs else None), "n": len(confs)}


def classify(utterances: list[dict]) -> dict:
    """Return {level ∈ 'clean'|'shaky'|'dirty', avg, reason, review}. `review=True` ⇒ never auto-act on
    the order — a human confirms first. Fail-safe: unknown/no confidence → 'shaky' + review (never
    silently trust an unmeasured transcript on money)."""
    sc = score(utterances)
    avg = sc["avg"]
    if avg is None:
        return {"level": "shaky", "review": True, "reason": "no confidence signal — review to be safe", **sc}
    dirty = (avg < DIRTY_AVG) or ((sc["low_word_frac"] or 0) > DIRTY_LOW_WORD_FRAC) or ((sc["min_word"] or 1) < DIRTY_MIN_WORD)
    if dirty:
        return {"level": "dirty", "review": True,
                "reason": f"audio poco fiable (confianza media {avg:.2f}) — a revisión humana", **sc}
    return {"level": "clean", "review": False, "reason": f"transcripción fiable (confianza {avg:.2f})", **sc}


def perception_note(conf: dict) -> str:
    """The fold-ready PERCEPTION note for a voice-note turn (organ ② → ④, injected BEFORE the mind).
    Empty for clean audio (no noise in the prompt)."""
    if not conf or not conf.get("review"):
        return ""
    avg = conf.get("avg")
    return ("⚠️ PERCEPCIÓN (pre-razonamiento, dato duro): esta nota de voz llegó con AUDIO POCO FIABLE "
            + (f"(confianza {avg:.2f}). " if isinstance(avg, (int, float)) else "(sin señal de confianza). ")
            + "NO des por buenos nombres, cantidades ni pedidos oídos ahí — pueden estar mal transcritos. "
              "Pide con naturalidad que te lo repita o te lo confirme por texto («oye, se te cortaba un "
              "poco — ¿me lo confirmas por aquí?»). Cualquier pedido de ese audio va a revisión humana, "
              "no lo confirmes tú.")
