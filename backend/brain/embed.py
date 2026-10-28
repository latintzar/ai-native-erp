"""Dense embeddings — self-hosted ONNX (fastembed), warm-loaded singleton.

⚠️ THE LANGUAGE IS SPANISH (PRODUCT-SPEC §5.7a). Both the catalogue rows («MANZANA GOLDEN 20 – 4/5
PZAS KG», «PALETA COCIDA») and the customers' mentions («el jamoncito», «8 kg de chorizo fresco»)
are es-ES, so the old default — bge-large-en-v1.5, an ENGLISH-ONLY encoder — was reading this trade
through the wrong language. Default is now **BAAI/bge-m3**: multilingual, and 1024-dim like the one
it replaces, so it drops into the same `catalogue_skus.embedding vector(1024)` column with NO
migration. Revert with one env var: `BRAIN_EMBED_MODEL=BAAI/bge-large-en-v1.5`.

CHANGING THE MODEL MEANS RE-EMBEDDING. Query vectors and stored passage vectors must come from the
same encoder or cosine is meaningless — `tests/eval_retrieval.py reembed` does it, and
`brain/seed.py`'s loader does it for a fresh tenant.

bge-m3 is NOT in fastembed's curated list (0.8.0 carries no m3 in dense, sparse or late-interaction),
so "drop-in" needs the registration below — the ONNX export in the official BAAI/bge-m3 repo, CLS
pooling + L2 normalisation, which is what bge-m3's dense head is. Everything downstream is unchanged.

PREFIXES DIFFER BY FAMILY and it matters: bge-v1.5 is asymmetric (queries get an instruction prefix,
passages do not), bge-m3 takes NO instruction on either side. fastembed knows this per registered
model, which is why the callers below stay on query_embed/passage_embed instead of hand-rolling a
prefix — swapping the model swaps the convention with it.

CPU-bound, so async callers use the a* wrappers which offload to a thread.
"""
from __future__ import annotations

import asyncio
import threading
from typing import List, Optional

import config

_model = None
_dim: Optional[int] = None
_lock = threading.Lock()

# Models fastembed does not ship, registered on demand. `pooling`/`normalization` are the model
# card's own recipe — get them wrong and the vectors are silently bad rather than loudly broken.
# `additional_files` carries the external-weights blob: bge-m3's onnx/model.onnx is a small graph
# whose tensors live in onnx/model.onnx_data, and without it the session fails to load.
_CUSTOM = {
    "BAAI/bge-m3": {
        "hf": "BAAI/bge-m3",
        "dim": 1024,
        "pooling": "CLS",
        "normalization": True,
        "model_file": "onnx/model.onnx",
        "additional_files": ["onnx/model.onnx_data"],
        "size_in_gb": 2.3,
        "description": "Multilingual (~100 languages) dense retrieval, 1024-dim, 8192 tokens.",
        "license": "mit",
    },
}


def _register(name: str) -> None:
    """Register a model fastembed does not carry. Idempotent and quiet if it is already known."""
    spec = _CUSTOM.get(name)
    if not spec:
        return
    from fastembed import TextEmbedding
    from fastembed.common.model_description import ModelSource, PoolingType
    if any(m["model"].lower() == name.lower() for m in TextEmbedding.list_supported_models()):
        return
    TextEmbedding.add_custom_model(
        model=name,
        pooling=getattr(PoolingType, spec["pooling"]),
        normalization=spec["normalization"],
        sources=ModelSource(hf=spec["hf"]),
        dim=spec["dim"],
        model_file=spec["model_file"],
        additional_files=list(spec.get("additional_files") or []),
        size_in_gb=spec.get("size_in_gb", 0.0),
        description=spec.get("description", ""),
        license=spec.get("license", ""),
    )


def _get():
    global _model, _dim
    if _model is None:
        with _lock:
            if _model is None:
                from fastembed import TextEmbedding
                _register(config.BRAIN_EMBED_MODEL)
                m = TextEmbedding(config.BRAIN_EMBED_MODEL)
                # Fail LOUD on a dimension mismatch, at load, once — never one row at a time against
                # a vector(1024) column at 06:10 on a live order. The column is the contract; an
                # encoder that does not fit it is a migration decision, not a runtime surprise.
                d = len(list(m.passage_embed(["dim probe"]))[0])
                if d != config.BRAIN_EMBED_DIM:
                    raise RuntimeError(
                        f"BRAIN_EMBED_MODEL={config.BRAIN_EMBED_MODEL} emits {d}-dim vectors but "
                        f"catalogue_skus.embedding is vector({config.BRAIN_EMBED_DIM}). Set "
                        f"BRAIN_EMBED_MODEL back, or migrate the column deliberately.")
                _dim, _model = d, m
    return _model


def dim() -> int:
    """Vector width the loaded encoder actually produces (loads it if needed)."""
    _get()
    return int(_dim or 0)


def warm() -> None:
    """Load the model now (called at startup so the first order isn't slow)."""
    _get()


def embed_query(text: str) -> List[float]:
    return list(_get().query_embed([text]))[0].tolist()


def embed_queries(texts: List[str]) -> List[List[float]]:
    return [v.tolist() for v in _get().query_embed(list(texts))]


def embed_passages(texts: List[str]) -> List[List[float]]:
    return [v.tolist() for v in _get().passage_embed(list(texts))]


async def aembed_query(text: str) -> List[float]:
    return await asyncio.to_thread(embed_query, text)


async def aembed_passages(texts: List[str]) -> List[List[float]]:
    return await asyncio.to_thread(embed_passages, texts)
