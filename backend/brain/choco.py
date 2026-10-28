"""§17.49 — A CHOCO LINK IS AN ORDER (WP-G5, the Bidfood gate).

A customer pastes a Choco cart/order link into the thread; Rocoto opens it and books the lines
like any order — the customer never has to change apps. The Albert email claims it («hasta
abre los enlaces de Choco»), so it must actually work before any Bidfood demo.

HOW IT RIDES THE EXISTING MACHINERY, adding no second order path: the extracted lines become
the message's TRANSCRIPT — exactly a voice note's shape («the words of the media») — and
`pipeline._combine` already reads `transcript or message_text`, so the whole downstream
(extraction, grounding, doubts, review) consumes a link message unchanged.

The extraction ladder, deterministic first:
  ① `__NEXT_DATA__` / JSON-LD payloads walked for line-shaped objects (name + quantity keys);
  ② the visible text through the small extraction model (the skuparse tier), asked ONLY to
     transcribe lines it can see — an unreadable page yields NOTHING, never invented lines.
`enrich_row` marks `choco_tried` on the message meta win or lose, so a dead link is fetched
once, not per burst. Fail-soft everywhere: a fetch error leaves the bare link for the mind,
which is today's honest behaviour.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, List, Optional

import httpx

import config
import db

log = logging.getLogger("rocoto.choco")

CHOCO_RE = re.compile(r"https?://(?:[a-z0-9-]+\.)?choco\.com/[^\s>\")]+", re.I)
FETCH_TIMEOUT_S = 8
MAX_BYTES = 2_000_000
_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/126.0 Safari/537.36")

_QTY_KEYS = ("quantity", "qty", "amount", "cantidad")
_NAME_KEYS = ("name", "productName", "title", "nombre", "product_name")
_UNIT_KEYS = ("unit", "uom", "unidad", "packaging")


def find_link(text: str) -> Optional[str]:
    m = CHOCO_RE.search(text or "")
    return m.group(0) if m else None


async def fetch(url: str) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_S, follow_redirects=True,
                                     headers={"user-agent": _UA}) as c:
            r = await c.get(url)
        if r.status_code != 200:
            log.info("choco fetch %s → %s", url[:80], r.status_code)
            return None
        return r.text[:MAX_BYTES]
    except Exception:
        log.info("choco fetch failed for %s", url[:80], exc_info=True)
        return None


def _walk(node: Any, out: List[dict]) -> None:
    if isinstance(node, dict):
        name = next((str(node[k]).strip() for k in _NAME_KEYS
                     if isinstance(node.get(k), str) and node[k].strip()), "")
        qty = next((node[k] for k in _QTY_KEYS
                    if isinstance(node.get(k), (int, float)) and node[k] > 0), None)
        if name and qty is not None:
            unit = next((str(node[k]).strip() for k in _UNIT_KEYS
                         if isinstance(node.get(k), str) and node[k].strip()), "")
            out.append({"name": name, "qty": float(qty), "unit": unit})
        for v in node.values():
            _walk(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, out)


def extract_structured(html: str) -> List[dict]:
    """Ladder rung ①: embedded JSON payloads (__NEXT_DATA__, JSON-LD, preloaded state)."""
    lines: List[dict] = []
    for m in re.finditer(
            r'<script[^>]*(?:id="__NEXT_DATA__"|type="application/(?:ld\+)?json")[^>]*>(.*?)</script>',
            html or "", re.S | re.I):
        try:
            _walk(json.loads(m.group(1)), lines)
        except Exception:
            continue
    # dedupe on (name, qty) keeping order; a cart page repeats its lines across payloads
    seen, out = set(), []
    for l in lines:
        k = (l["name"].lower(), l["qty"])
        if k not in seen:
            seen.add(k)
            out.append(l)
    return out[:60]


def _visible_text(html: str) -> str:
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html or "", flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", t).strip()[:6000]


async def extract_llm(html: str) -> List[dict]:
    """Ladder rung ②: the small extraction model TRANSCRIBES the lines it can see. The prompt
    forbids invention outright — an unreadable page yields [], and [] books nothing."""
    text = _visible_text(html)
    if len(text) < 40:
        return []
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=1,
                                          timeout=25.0)
        resp = await client.messages.create(
            model=config.SKUPARSE_MODEL, max_tokens=800,
            system=("Transcribes líneas de pedido de la página de un carrito. Devuelve SOLO un "
                    "array JSON [{\"name\":str,\"qty\":number,\"unit\":str}] con las líneas que "
                    "VES literalmente. Si no ves líneas de pedido, devuelve []. PROHIBIDO "
                    "inventar: nada que no esté en el texto."),
            messages=[{"role": "user", "content": text}])
        raw = "".join(getattr(b, "text", "") for b in resp.content).strip()
        m = re.search(r"\[.*\]", raw, re.S)
        lines = json.loads(m.group(0)) if m else []
        return [{"name": str(l.get("name") or "").strip(),
                 "qty": float(l.get("qty") or 0),
                 "unit": str(l.get("unit") or "").strip()}
                for l in lines if isinstance(l, dict) and l.get("name") and l.get("qty")][:60]
    except Exception:
        log.info("choco llm extraction failed (fail-soft)", exc_info=True)
        return []


def to_transcript(lines: List[dict], url: str) -> str:
    """The lines as the customer's own words would read — what the whole pipeline consumes."""
    body = "\n".join(f"- {l['qty']:g} {l['unit']} {l['name']}".replace("  ", " ")
                     for l in lines)
    return f"Pedido del enlace Choco ({url}):\n{body}"


async def enrich_row(row: dict, html: Optional[str] = None) -> bool:
    """The pipeline seam: a text message carrying a Choco link, not yet tried → fetch, extract,
    persist the transcript. Returns True when lines landed. `html=` injects a fixture so the
    vitals never touch choco.com."""
    text = str(row.get("message_text") or "")
    url = find_link(text)
    if not url:
        return False
    meta = row.get("transcript_meta") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except ValueError:
            meta = {}
    if row.get("transcript") or meta.get("choco_tried"):
        return False
    page = html if html is not None else await fetch(url)
    lines = extract_structured(page or "")
    if not lines and page:
        lines = await extract_llm(page)
    meta = {**meta, "choco_tried": True, "choco_url": url,
            "choco_lines": len(lines)}
    transcript = to_transcript(lines, url) if lines else None
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update whatsapp_messages set transcript = coalesce($2, transcript), "
            "transcript_status = case when $2 is null then transcript_status else 'done' end, "
            "transcript_meta = $3 where id = $1",
            row.get("id"), transcript, json.dumps(meta))
    if transcript:
        row["transcript"] = transcript   # the in-flight burst sees it too
        log.info("CHOCO LINK OPENED: %d líneas from %s", len(lines), url[:80])
    return bool(transcript)
