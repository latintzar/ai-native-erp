"""rt_embed.py — the EMPLOYEE-RUNTIME dense embedder (SPEC §5: 384-d multilingual).

The runtime's memory organs (fact / summary / watch-vector) store a `vector(384)`
alongside a Spanish `to_tsvector` FTS column (schema_runtime.sql §fact/§summary). Recall is
hybrid: FTS is the deterministic floor, the dense vector is the semantic lift. This module owns
the dense half.

Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384-d, multilingual). This is
DELIBERATELY distinct from brain/embed.py's bge-large-en (1024-d, English-only catalogue): the
runtime memory is Spanish/code-switched customer text, so it needs a multilingual encoder at the
384-d the runtime schema declares. Symmetric model → no query/passage instruction split (unlike bge),
so one `embed()` serves both write-time (fact/summary embedding) and read-time (recall query).

Lazy-loaded fastembed singleton, mirroring brain/embed.py (thread-safe double-checked init, a* thread
offloads for the async callers). CPU-bound ONNX, so async callers use aembed/aembed_many which offload
to a thread (asyncio.to_thread) — never block the event loop.

FAIL-SOFT (the load-bearing property): if fastembed is missing or the model fails to load, we log ONCE
and every call returns a ZERO vector of length 384. A zero embedding is a valid pgvector value the
codec accepts, and cosine distance to it is a constant — so the HNSW dense search contributes nothing
and hybrid recall degrades cleanly to FTS-only. The runtime keeps serving; it never crashes on a
model-load failure. (SPEC §5 / §4.3 recall.)

Returns are plain python lists of floats — asyncpg + pgvector's register_vector codec (db._init_conn)
accepts a list directly for a `vector` column, so callers hand these straight to append_event /
write_fact / recall queries with no json.dumps and no manual cast.
"""
from __future__ import annotations

import asyncio
import logging
import os
import threading
from typing import List

log = logging.getLogger("rocoto.rt_embed")

# The runtime memory dimension — MUST equal the vector(384) columns in schema_runtime.sql
# (fact.embedding, summary.embedding, watch.emb). The zero-vector fallback is this long.
RT_EMBED_DIM = 384
# SPEC §5 default: 384-d multilingual (Spanish). Env-overridable, but any override MUST also be 384-d
# or the pgvector insert will reject the row — keep it in lockstep with RT_EMBED_DIM.
RT_EMBED_MODEL = (os.getenv("RT_EMBED_MODEL") or
                  "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2").strip()

_model = None
_lock = threading.Lock()
_load_failed = False           # sticky: once the load fails we fall back forever (no reload storms)
_warned = False                # log the fallback exactly ONCE, not per-call


def _zero() -> List[float]:
    """A valid 384-d zero vector — the fail-soft value that degrades recall to FTS-only."""
    return [0.0] * RT_EMBED_DIM


def _get():
    """Return the fastembed singleton, or None if the model could not be loaded (fail-soft).

    Double-checked locking mirrors brain/embed.py._get(). On any import/load failure we set the
    sticky `_load_failed` flag, log once, and return None so every caller degrades to zero-vectors.
    """
    global _model, _load_failed, _warned
    if _model is not None:
        return _model
    if _load_failed:
        return None
    with _lock:
        if _model is not None:
            return _model
        if _load_failed:
            return None
        try:
            from fastembed import TextEmbedding
            _model = TextEmbedding(RT_EMBED_MODEL)
        except Exception as e:  # pragma: no cover - exercised only when fastembed/model is absent
            _load_failed = True
            if not _warned:
                _warned = True
                log.warning(
                    "rt_embed: fastembed/model %r failed to load (%s); runtime recall degrades to "
                    "FTS-only, embed() returns zero-vectors of length %d.",
                    RT_EMBED_MODEL, e, RT_EMBED_DIM)
            return None
    return _model


def warm() -> None:
    """Load the model now (called at startup so the first fact-write / recall isn't slow).

    Fail-soft: a load failure is swallowed here (logged once inside _get) — warm() never raises, so a
    missing model can't abort boot of the runtime (SPEC §5).
    """
    _get()


def embed(text: str) -> List[float]:
    """Embed one string → a plain 384-d python list (SPEC §5).

    Symmetric model → no query/passage prefix. Fail-soft: returns a zero-vector if the model is
    unavailable. Returns a plain list (pgvector codec accepts it directly).
    """
    m = _get()
    if m is None:
        return _zero()
    try:
        return list(m.embed([text or ""]))[0].tolist()
    except Exception as e:  # pragma: no cover - a runtime encode error must never crash the caller
        log.warning("rt_embed: embed() failed (%s); returning zero-vector.", e)
        return _zero()


def embed_many(texts: List[str]) -> List[List[float]]:
    """Batch-embed → a list of plain 384-d python lists, order-aligned with `texts` (SPEC §5).

    Fail-soft: if the model is unavailable, returns a zero-vector for each input (so the caller gets a
    list of the same length and never has to special-case the degraded path).
    """
    items = list(texts or [])
    m = _get()
    if m is None:
        return [_zero() for _ in items]
    if not items:
        return []
    try:
        return [v.tolist() for v in m.embed([t or "" for t in items])]
    except Exception as e:  # pragma: no cover - encode error → degrade, never crash
        log.warning("rt_embed: embed_many() failed (%s); returning zero-vectors.", e)
        return [_zero() for _ in items]


async def aembed(text: str) -> List[float]:
    """Async embed one string — offloads the CPU-bound ONNX call to a thread (never blocks the loop)."""
    return await asyncio.to_thread(embed, text)


async def aembed_many(texts: List[str]) -> List[List[float]]:
    """Async batch embed — offloads to a thread (SPEC §5). Order-aligned with `texts`."""
    return await asyncio.to_thread(embed_many, list(texts or []))
