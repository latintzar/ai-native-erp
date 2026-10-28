"""ARTWORK — the house makes a product's painting, through Ideogram (FEED-IA §200.2).

Peter, 2026-09-04: «Why doesn't one of the shrimps actually have an image for that? You should have
the whole ideogram API, by the way, hooked up… it should be in the specification we can make you
ship from there.»

So this is the road's server half. The method is Peter's own and it is not negotiable — it is
stated in THE-PRODUCT-SHEET-SPEC «Artwork» and implemented here literally:

    1 · DESCRIBE A REFERENCE. A painting already in the library, of the same family, is sent to
        Ideogram's describe. What comes back is the house style in the provider's own words.
    2 · TAKE THAT DESCRIPTION VERBATIM. Nobody writes a prompt here. The description is the prompt.
    3 · SWAP THE SUBJECT IN PLACE. Exactly one substring changes — the words that name the
        reference's subject become the words that name the new one. Every other word survives, which
        is what keeps the medium, the light, the ground and the framing inside one family.
    4 · GENERATE at the family's own square, and hand back what the provider made.

WHY THE SWAP IS A SUBSTRING AND NOT A REWRITE. A prompt written fresh for each product is how a set
drifts: one painting arrives on linen, the next on a slate board, a third with a garnish. The
library's whole value is that 793 tiles read as one hand. An exact substring replacement can be
checked by eye — the response carries both the description and the prompt — and it can fail closed:
where `replace` is absent from the description this module refuses by name rather than guessing
which words were the subject.

THE KEY. `IDEOGRAM_API_KEY`, in the environment, like every other secret this service holds
(config.py). The house does not hold one tonight, so `/api/health` answers `artwork: awaiting key`
and every call here refuses with `artwork_awaiting_key` — the runtime road takes the key the moment
the house holds it, and nothing about the road changes when it arrives.

THE DOOR, AND WHY THIS ROAD HAS ONE THE OTHERS DO NOT. `/api/parse`, `/api/identity` and
`/api/transcribe` spend a subscription the house has already paid for. This road spends GENERATION
CREDIT, per call, from a balance that empties — so «can reach the box» must not mean «may spend the
account». CORS is a browser control and a browser control alone: it says nothing to `curl`, and this
service answers on a public hostname. So the road carries two guards of its own, both ahead of the
provider:

  · A HOUSE SECRET. `ARTWORK_SHARED_SECRET` in the environment, presented on the
    `X-Rocoto-Artwork-Key` header and compared in constant time. Under 24 characters is a
    placeholder rather than a secret, so the door reads its length before its value and answers
    `artwork_awaiting_secret` while it is short — the same fail-closed posture as a missing key.
    The header is deliberately ABSENT from the CORS allow-list (`main.py`), so no page on any origin
    can send one: this is a road for the house's own tooling, over the wire, with a secret.
  · AN HOURLY CEILING. `ARTWORK_HOURLY_CEILING` (40 by default) counts calls that REACH Ideogram —
    a describe is one and a generation is one — over a rolling hour, and answers
    `artwork_ceiling_reached` with the seconds until the next slot. It is what bounds the damage of
    a secret that leaks: the loss is a countable number of generations, and each response carries
    the provider's own `reported_cost_usd_micros`, which is what turns that count into money.

THE PROVIDER, pinned. `specs/intelligence/v1/image-job.schema.json` fixes the adapter as
`ideogram-v4-async@1`: multipart/form-data to the async generate endpoint, a `generation_id` back,
polled at `/v1/generations/{id}`. This module implements that adapter and reads the answer
defensively — a provider that changes a field name gets a named failure here, never a silent one.
"""
from __future__ import annotations

import asyncio
import base64
import hmac
import logging
import re
import time
from collections import deque
from typing import Any

import httpx

from .config import ARTWORK_SECRET_FLOOR, settings
from .errors import RuntimeError_

logger = logging.getLogger("rocoto.runtime.artwork")

# The provider call's own ceilings. A generation is a background job at the provider and the poll is
# cheap, so the wait is generous and BOUNDED — an unbounded wait is a request nobody can cancel.
SUBMIT_TIMEOUT = 60.0
POLL_TIMEOUT = 20.0
POLL_EVERY = 3.0
POLL_CEILING = 300.0
# The provider's render URL 404s for a few seconds after the job reports done (the painted library's
# own hard-won note). The download therefore retries a bounded number of times before it gives up.
FETCH_TRIES = 6
FETCH_EVERY = 2.0

# THE FAMILY'S OWN SQUARE. `assets/paintings/normalize.py` places every tile on a 1024 canvas with
# the subject at three quarters of the longest side, so the generation is square from the start and
# the normalizer only has to trim and centre.
SQUARE = "1024x1024"

# THE DOOR. The header the house key travels on, and the rolling hour the ceiling counts over.
HOUSE_HEADER = "X-Rocoto-Artwork-Key"
CEILING_WINDOW = 3600.0
# Every call that reached Ideogram, by monotonic clock — a wall clock that steps backwards would
# hand the ceiling a free hour, and this number is the only thing standing between a leaked secret
# and the account.
_SPENT: deque[float] = deque()

FILE_CONTRACT = {
    "format": "webp",
    "canvas": 1024,
    "box_ratio": 0.75,
    "ground": "white",
    "alpha": False,
    "quality": 92,
    "library": "app/public/paintings/<slug>.webp",
    "source": "assets/paintings/set/<slug>.webp",
    "normalizer": "assets/paintings/normalize.py",
}


def authorize(presented: str) -> None:
    """The house key on the door, read before anything here can spend a generation.

    Constant-time comparison, because a byte-by-byte one leaks the secret to whoever can time it.
    Two refusals, and they mean different things: `artwork_awaiting_secret` says the HOUSE has not
    set one yet (503, the road waiting on configuration, exactly like a missing provider key), and
    `artwork_unauthorized` says the caller presented something else (401).
    """
    secret = settings.artwork_secret
    if len(secret) < ARTWORK_SECRET_FLOOR:
        raise RuntimeError_(
            "artwork_awaiting_secret",
            f"This runtime paints the moment it holds ARTWORK_SHARED_SECRET, "
            f"{ARTWORK_SECRET_FLOOR} characters or more.",
            503,
        )
    if not hmac.compare_digest(presented or "", secret):
        raise RuntimeError_(
            "artwork_unauthorized",
            f"This runtime reads the house secret from the {HOUSE_HEADER} header.",
            401,
        )


def take_a_slot() -> None:
    """One call's room inside the hour's ceiling, taken the moment before the provider is reached.

    It is deliberately NOT taken at the endpoint: a malformed request that never touches Ideogram
    spends nothing, so it costs nothing here either. Where it IS taken — the top of `describe` and
    the top of `generate`, both after the key check — is exactly where money starts.
    """
    now = time.monotonic()
    while _SPENT and now - _SPENT[0] >= CEILING_WINDOW:
        _SPENT.popleft()
    ceiling = settings.artwork_hourly_ceiling
    if len(_SPENT) >= ceiling:
        opens = int(CEILING_WINDOW - (now - _SPENT[0])) + 1 if _SPENT else int(CEILING_WINDOW)
        raise RuntimeError_(
            "artwork_ceiling_reached",
            f"This runtime reaches Ideogram {ceiling} times an hour; the next slot opens in {opens}s.",
            429,
        )
    _SPENT.append(now)


def _key() -> str:
    if not settings.ideogram_key:
        raise RuntimeError_(
            "artwork_awaiting_key",
            "This runtime makes artwork the moment it holds IDEOGRAM_API_KEY.",
            503,
        )
    return settings.ideogram_key


def _headers() -> dict[str, str]:
    return {"Api-Key": _key()}


def slug_for(name: str) -> str:
    """The library's own file name for a product's words — «Gamba roja · congelado» → `gamba-roja-congelado`.

    It is the same fold `painting-map.ts` uses (lowercase, accents dropped, everything else a
    hyphen), so a tile made through this road lands on the name the app will look for.
    """
    import unicodedata

    folded = unicodedata.normalize("NFD", name.lower())
    folded = "".join(c for c in folded if unicodedata.category(c) != "Mn")
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", folded)).strip("-")


def swap_subject(description: str, replace: str, subject: str) -> str:
    """Step 3, and the whole discipline in one function: ONE substring changes, nothing else.

    `replace` must appear in the description exactly once. Absent, this refuses; ambiguous, it
    refuses — because «the second occurrence» is a guess about which words named the subject, and a
    guess here is how a set drifts. The caller reads the description first (`describe_only`) and
    says which words to swap, which is Peter's own method with the machine holding the pen.
    """
    if not replace.strip() or not subject.strip():
        raise RuntimeError_("bad_request", "A subject swap needs the words to replace and the words to put there.", 400)
    found = description.count(replace)
    if found == 0:
        raise RuntimeError_(
            "subject_not_found",
            "Those words are absent from the reference's description; read the description and name "
            "the exact words that describe its subject.",
            422,
        )
    if found > 1:
        raise RuntimeError_(
            "subject_ambiguous",
            f"Those words appear {found} times in the description; name a longer phrase that occurs once.",
            422,
        )
    return description.replace(replace, subject)


def read_description(payload: dict[str, Any]) -> str:
    """The provider's describe answer → the text, or a named failure.

    Three shapes are accepted because the provider has used all three, and anything else is
    reported rather than coerced: a description this service could not read must never become an
    empty prompt that still generates something.
    """
    candidates = []
    for item in (payload or {}).get("descriptions") or []:
        if isinstance(item, dict):
            candidates.append(item.get("text") or item.get("description") or "")
        elif isinstance(item, str):
            candidates.append(item)
    candidates.append(str((payload or {}).get("description") or ""))
    candidates.append(str((payload or {}).get("text") or ""))
    for text in candidates:
        if text and text.strip():
            return text.strip()
    raise RuntimeError_("describe_unreadable", "Ideogram's description came back without any text.", 502)


def read_generation(payload: dict[str, Any]) -> dict[str, Any]:
    """One polled generation → `{state, url, generation_id, cost_usd_micros, safety}`.

    `state` is one of `running` · `done` · `failed`, folded from whatever word the provider used, and
    an unknown word stays `running` on purpose: the poll has a ceiling, and treating a word this
    service has never seen as a failure would throw away a job that is simply still painting.
    """
    data = payload or {}
    raw = str(data.get("status") or data.get("state") or "").upper()
    images = data.get("data") or data.get("images") or data.get("results") or []
    url = ""
    for image in images:
        if isinstance(image, dict) and (image.get("url") or image.get("image_url")):
            url = str(image.get("url") or image.get("image_url"))
            break
        if isinstance(image, str):
            url = image
            break
    if raw in {"FAILED", "ERROR", "CANCELLED", "CANCELED", "REJECTED"}:
        state = "failed"
    elif url or raw in {"COMPLETED", "COMPLETE", "SUCCEEDED", "SUCCESS", "DONE"}:
        state = "done" if url else "failed"
    else:
        state = "running"
    cost = data.get("reported_cost_usd_micros")
    if cost is None:
        cost = data.get("cost_usd_micros")
    return {
        "state": state,
        "url": url,
        "generation_id": str(data.get("generation_id") or data.get("id") or "") or None,
        "cost_usd_micros": int(cost) if isinstance(cost, (int, float)) else None,
        "safety": str(data.get("safety") or data.get("reported_safety_state") or "not_reported"),
        "failure": str(data.get("error") or data.get("failure_reason") or "") or None,
    }


async def _reference_bytes(client: httpx.AsyncClient, reference: str, reference_url: str) -> tuple[bytes, str]:
    """The painting the description comes from — a library slug, or an explicit URL.

    A slug is resolved against the kit's own public library (`{public_base}/paintings/<slug>.webp`),
    which is where the 793 shipped tiles live, so the ordinary call names a family member and
    nothing else. A URL is accepted for a reference the library does not hold yet.
    """
    if not reference_url and not settings.public_base:
        raise RuntimeError_(
            "runtime_origin_missing", "Set ROCOTO_RUNTIME_PUBLIC_BASE or choose a reference URL.", 503
        )
    url = reference_url or f"{settings.public_base}/paintings/{slug_for(reference)}.webp"
    response = await client.get(url, timeout=POLL_TIMEOUT)
    if response.status_code >= 400 or not response.content:
        raise RuntimeError_("reference_missing", f"The reference painting at {url} could not be read.", 422)
    return response.content, url


async def describe(reference: str = "", reference_url: str = "") -> dict[str, Any]:
    """Step 1 and 2 — the reference's own description, verbatim, plus where it came from."""
    _key()
    take_a_slot()
    async with httpx.AsyncClient(timeout=SUBMIT_TIMEOUT, follow_redirects=True) as client:
        content, url = await _reference_bytes(client, reference, reference_url)
        started = time.time()
        response = await client.post(
            settings.ideogram_base.rstrip("/") + settings.ideogram_describe_path,
            headers=_headers(),
            files={"image_file": ("reference.webp", content, "image/webp")},
        )
        if response.status_code >= 400:
            raise RuntimeError_("describe_failed", f"Ideogram answered {response.status_code} to the description.", 502)
        text = read_description(response.json())
    logger.info("artwork described", extra={"provider": "ideogram", "ms": int((time.time() - started) * 1000),
                                            "outcome": f"{len(text)} characters"})
    return {"description": text, "reference": {"slug": slug_for(reference) if reference else None, "url": url}}


async def generate(prompt: str) -> dict[str, Any]:
    """Step 4 — the pinned `ideogram-v4-async@1` adapter: submit, poll, download.

    The image is returned as bytes, base64 in the response, because a caller that has to fetch a
    provider URL later is a caller racing the provider's own expiry — and the tile has to be
    normalised into the library anyway.
    """
    _key()
    take_a_slot()
    endpoint = settings.ideogram_base.rstrip("/") + settings.ideogram_generate_path
    async with httpx.AsyncClient(timeout=SUBMIT_TIMEOUT, follow_redirects=True) as client:
        # multipart/form-data is the adapter's own transport (image-job.schema.json), and a field
        # with `None` for its filename is how httpx writes a plain multipart field.
        fields = {"prompt": prompt, "resolution": SQUARE, "rendering_speed": "QUALITY", "num_images": "1"}
        submitted = await client.post(
            endpoint,
            headers=_headers(),
            files={key: (None, value) for key, value in fields.items()},
        )
        if submitted.status_code >= 400:
            raise RuntimeError_("generate_failed", f"Ideogram answered {submitted.status_code} to the generation.", 502)
        first = read_generation(submitted.json())
        generation_id = first["generation_id"]
        if not generation_id and first["state"] != "done":
            raise RuntimeError_("generate_unreadable", "Ideogram accepted the generation without naming it.", 502)

        state = first
        waited = 0.0
        while state["state"] == "running" and waited < POLL_CEILING:
            await asyncio.sleep(POLL_EVERY)
            waited += POLL_EVERY
            polled = await client.get(
                settings.ideogram_base.rstrip("/") + settings.ideogram_generation_path.format(id=generation_id),
                headers=_headers(), timeout=POLL_TIMEOUT)
            if polled.status_code >= 400:
                raise RuntimeError_("generate_failed", f"Ideogram answered {polled.status_code} to the poll.", 502)
            state = read_generation(polled.json())
            state["generation_id"] = state["generation_id"] or generation_id

        if state["state"] == "running":
            # THE QUOTA'S OWN SIGNATURE (the painted library's note): a job accepted just before the
            # wallet empties sits `running` for ever and its URL 404s for ever. Say that, by name.
            raise RuntimeError_(
                "generate_stalled",
                f"Ideogram was still painting after {int(waited)}s; the generation id is "
                f"{generation_id} and the account's quota is the first thing to read.",
                504,
            )
        if state["state"] == "failed" or not state["url"]:
            raise RuntimeError_("generate_failed", f"Ideogram could not paint it ({state['failure'] or 'no image'}).", 502)

        image = b""
        for attempt in range(FETCH_TRIES):
            got = await client.get(state["url"], timeout=POLL_TIMEOUT)
            if got.status_code < 400 and got.content:
                image = got.content
                break
            await asyncio.sleep(FETCH_EVERY)
        if not image:
            raise RuntimeError_("image_unreachable", "The painted image is not downloadable yet.", 504)

    logger.info("artwork painted", extra={"provider": "ideogram", "outcome": state["generation_id"] or "unnamed"})
    return {
        "bytes": len(image),
        "data": base64.b64encode(image).decode("ascii"),
        "content_type": "image/png",
        "url": state["url"],
        "generation_id": state["generation_id"],
        "cost_usd_micros": state["cost_usd_micros"],
        "safety": state["safety"],
    }


async def paint(*, name: str, reference: str = "", reference_url: str = "", description: str = "",
                replace: str = "", subject: str = "", describe_only: bool = False) -> dict[str, Any]:
    """The whole road, in the order the specification states it.

    `describe_only` stops after step 2 and hands back the description, which is how a caller reads it
    before naming the words to swap. Everything else runs steps 1–4 and returns the painting with
    the description and the prompt beside it, so what changed is visible without asking the provider.
    """
    if not describe_only and not name.strip():
        raise RuntimeError_("bad_request", "A painting needs the product's own name.", 400)
    if not reference.strip() and not reference_url.strip():
        raise RuntimeError_("bad_request", "A painting needs a family reference to be described.", 400)

    described = None
    if description.strip():
        source = {"description": description.strip(),
                  "reference": {"slug": slug_for(reference) if reference else None, "url": reference_url or None}}
    else:
        described = await describe(reference=reference, reference_url=reference_url)
        source = described
    if describe_only:
        return {"ok": True, **source, "provider": {"adapter_id": "ideogram-v4-async@1", "model_id": "ideogram-v4"}}

    prompt = swap_subject(source["description"], replace, subject)
    image = await generate(prompt)
    return {
        "ok": True,
        "name": name.strip(),
        "slug": slug_for(name),
        "reference": source["reference"],
        "description": source["description"],
        "prompt": prompt,
        "image": {k: image[k] for k in ("bytes", "data", "content_type", "url")},
        "provider": {
            "adapter_id": "ideogram-v4-async@1",
            "model_id": "ideogram-v4",
            "endpoint_variant": "standard",
            "generation_id": image["generation_id"],
            "reported_cost_usd_micros": image["cost_usd_micros"],
            "reported_safety_state": image["safety"],
        },
        "file": FILE_CONTRACT,
    }
