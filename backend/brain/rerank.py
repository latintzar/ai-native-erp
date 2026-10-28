"""Cross-encoder reranker — the biggest precision lift on the matching tail.

bge-reranker-base scores (query, doc) pairs; output is a relevance logit which we squash
to (0,1) with a sigmoid so the matcher can use one absolute floor + a top1-top2 margin for
the gate. Degrades gracefully: if the reranker can't load, rerank() returns None and the
matcher falls back to the fused dense+sparse score.
"""
from __future__ import annotations

import asyncio
import math
import threading
from typing import List, Optional

import config

_model = None
_lock = threading.Lock()
_failed = False


def _get():
    global _model, _failed
    if _model is None and not _failed:
        with _lock:
            if _model is None and not _failed:
                try:
                    from fastembed.rerank.cross_encoder import TextCrossEncoder
                    _model = TextCrossEncoder(config.BRAIN_RERANK_MODEL)
                except Exception:
                    _failed = True
    return _model


def warm() -> None:
    _get()


def _sigmoid(x: float) -> float:
    try:
        return 1.0 / (1.0 + math.exp(-x))
    except OverflowError:
        return 0.0 if x < 0 else 1.0


def rerank(query: str, docs: List[str]) -> Optional[List[float]]:
    """Return a sigmoid-squashed relevance score per doc (aligned to `docs`), or None."""
    if not docs:
        return []
    m = _get()
    if m is None:
        return None
    try:
        raw = list(m.rerank(query, list(docs)))
        return [_sigmoid(float(s)) for s in raw]
    except Exception:
        return None


async def arerank(query: str, docs: List[str]) -> Optional[List[float]]:
    return await asyncio.to_thread(rerank, query, docs)
