"""trends.py — THE TREND ENGINE (OFERTA-DEL-DIA-SPEC §3). Organ ①.

The knowledge that makes «Oferta del día» honest: what restaurants' customers are actually excited
about RIGHT NOW. Caption-only social ingest — Peter, 2026-07-27: *"no video needed cos it'll be in
captions. we filter out video to keep our cost low."*

WHY CAPTIONS ONLY IS CORRECT HERE (and was not, in Vitrina). Vitrina's extractor had to download the
video and run a vision model because a *customer* handed it an arbitrary URL — it was at the mercy of
whatever was sent, caption or no caption. We are not: **we choose which posts we ingest.** So we take
only posts that carry the recipe in the caption and drop the rest on the floor. Cost per post is a
few hundred text tokens, and the corpus is no worse — a creator who writes the recipe out is, if
anything, the creator whose dish is reproducible.

TWO QUESTIONS, KEPT APART (§2 — load-bearing):
  · `top()`    answers **what IS trending** — found organically, without looking for anything, so it
               is evidence. This feeds the daily brief.
  · `match()`  answers **is THIS trending** — asked about an ingredient someone is trying to sell, so
               it is exposed to motivated reasoning. It is allowed to return NOTHING, and the caller
               is required to say so out loud (§4.3). A miss is never dressed as a hit.

THE RAIL (verified on the live box 2026-07-27, not assumed — and one design corrected by the test):
  · `web get <url> --html` → Camoufox renders → posts as `<a href=".../@handle/video/<id>">` next to
    an `<img alt="<the full caption>">`. Same parse for tag pages and profile pages.
  · **`id >> 32` is the exact unix post timestamp.** Confirmed against three real IDs. This is why
    "trending THIS WEEK" is a claim we can stand behind rather than a vibe.
  · **THE SPINE IS A CREATOR SWEEP, NOT A TAG SWEEP.** This was the first design and the test killed
    it: a TAG page returns TikTok's ALL-TIME TOP posts for that tag — measured, the dates came back
    2023-02, 2025-03, 2025-04. Scoring that corpus for "trending this week" would have produced a
    confident weekly trend claim out of three-year-old posts. A CREATOR PROFILE page is ordered
    newest-first (measured: 51 posts, 7 from this month, 8 from last), so sampling a curated set of
    creators gives recency BY CONSTRUCTION and makes "N distinct creators this week" directly
    countable — which is the exact quantity `score()` rests on.
  · Tag pages keep one job: **discovering creators** worth adding to the seed (`discover_creators`).
  · TikTok's SEARCH endpoint is a captcha wall (measured: 282 captcha markers, 0 posts). Not a rail.
  · Engagement counters are NOT in the DOM any more. `score()` does not want them — see below.
"""
from __future__ import annotations

import html as _html
import json
import logging
import os
import re
import subprocess
import unicodedata
from datetime import datetime, timezone
from typing import Any, Iterable

log = logging.getLogger("rocoto.trends")

WEB_CLI = os.environ.get("ROCOTO_WEB_CLI", "/home/peter/.local/bin/web")

# The sweep. es-ES first (this is a Madrid product), then the pan-food tags where a dish crosses over
# before it reaches Spain — a trend we can see coming is worth more than one we catch late.
TAGS_ES = ["receta", "recetafacil", "comidacasera", "cocinaespañola", "tapas", "recetassaludables"]
TAGS_XB = ["recipe", "foodtiktok", "easyrecipe"]
DEFAULT_TAGS = TAGS_ES + TAGS_XB

# §3.3 — what "sufficiently trending" MEANS. Stated once, here, so it is falsifiable rather than a
# mood, and so Peter can move it in one place. Both conditions must hold.
MIN_CREATORS = 3           # distinct creators making the dish inside the window
WINDOW_DAYS = 30           # the window
FRESH_DAYS = 10            # ...and at least one post this recent, or it is a dead trend

_TS_EPOCH_SANE = (1_400_000_000, 2_200_000_000)   # guard against a junk id decoding to a real date


# ─────────────────────────────────────────────────────────────────────────────
# 1 · FETCH — the caption rail
# ─────────────────────────────────────────────────────────────────────────────

_GRID_RE = re.compile(
    r'<a href="(?P<url>https://www\.tiktok\.com/@(?P<handle>[^/"]+)/video/(?P<vid>\d+))"'
    r'(?P<mid>.*?)(?:</a>|<a href=)',
    re.S,
)
_ALT_RE = re.compile(r'<img\b[^>]*\balt="(?P<alt>[^"]*)"', re.S)


def _decode_ts(video_id: str) -> datetime | None:
    """TikTok snowflake: the top 32 bits are the unix second the post was created.

    This is the single most valuable thing on the page and it is free. Without it every "trending
    this week" claim would rest on page order, which is popularity, not recency.
    """
    try:
        secs = int(video_id) >> 32
    except (TypeError, ValueError):
        return None
    lo, hi = _TS_EPOCH_SANE
    if not (lo <= secs <= hi):
        return None
    return datetime.fromtimestamp(secs, timezone.utc)


def parse_tag_html(raw: str) -> list[dict[str, Any]]:
    """TikTok tag HTML → posts. Caption comes from the poster `<img alt>`, which carries it in full."""
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for rank, m in enumerate(_GRID_RE.finditer(raw)):
        vid = m.group("vid")
        if vid in seen:
            continue
        alt = _ALT_RE.search(m.group("mid"))
        if not alt:
            continue
        caption = _html.unescape(alt.group("alt")).strip()
        if not caption:
            continue
        seen.add(vid)
        out.append({
            "url": m.group("url"),
            "handle": m.group("handle"),
            "video_id": vid,
            "posted_at": _decode_ts(vid),
            "caption": caption,
            "rank": rank,
        })
    return out


class Blocked(RuntimeError):
    """TikTok served a captcha wall instead of the page."""


_BLOCK_RE = re.compile(r"captcha|verify to continue|security check|Verifica", re.I)


def looks_blocked(raw: str) -> bool:
    """A captcha wall is ~600 KB of real-looking HTML with no posts in it.

    THIS CHECK IS LOAD-BEARING, and it is the difference between a stale trend table and an honest
    one. Measured 2026-07-27: an over-paced profile fetch returns HTTP 200, 604 KB, **307 captcha
    markers and zero video links**. Without this, `parse` returns [] and the caller records "this
    creator posted nothing" — so a fully blocked sweep looks like a quiet week, the brief goes stale
    while reporting success, and `sufficiently_trending` starts answering from a corpus that stopped
    updating. A block must be loud.
    """
    if not raw:
        return False
    if "/video/" in raw:
        return False
    return len(_BLOCK_RE.findall(raw)) >= 5


def _fetch_html(url: str, *, timeout: int, proxy: bool = False) -> str:
    """One page through the `web` CLI (curl → Camoufox → Webshare, auto-escalating on block)."""
    cmd = [WEB_CLI, "get", url, "--html"] + (["--proxy", "on"] if proxy else [])
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        log.warning("trends.fetch_timeout url=%s proxy=%s", url, proxy)
        return ""
    if proc.returncode != 0 or not proc.stdout:
        log.warning("trends.fetch_failed url=%s rc=%s", url, proc.returncode)
        return ""
    if looks_blocked(proc.stdout):
        raise Blocked(url)
    return proc.stdout


# ── PACING ──────────────────────────────────────────────────────────────────
# Measured 2026-07-27: TikTok serves ONE profile per burst from this box and captchas the rest —
# 1 of 10 creators came back, 9 hit the wall. The instinct is to fight it with proxies; the right
# answer is that WE DO NOT NEED TO GO FAST. This is a DAILY brief. Forty creators at one every few
# minutes is a couple of hours of a background worker's day and is indistinguishable from a person
# browsing. Pace by default, escalate to the residential proxy only when a page actually blocks.
PACE_SECONDS = float(os.environ.get("TREND_PACE_SECONDS", "240"))


def fetch_creator_paced(handle: str, *, timeout: int = 300, pace: float | None = None,
                        sleep=None) -> list[dict[str, Any]]:
    """`fetch_creator` + one proxy retry on block + the inter-fetch pause. Never raises."""
    import time as _time
    sleep = sleep or _time.sleep
    handle = handle.lstrip("@")
    url = f"https://www.tiktok.com/@{handle}"
    raw = ""
    try:
        raw = _fetch_html(url, timeout=timeout)
    except Blocked:
        log.warning("trends.blocked handle=%s → residential retry", handle)
        sleep(20)
        try:
            raw = _fetch_html(url, timeout=timeout, proxy=True)
        except Blocked:
            log.error("trends.blocked_after_proxy handle=%s (NOT an empty week — a wall)", handle)
            raw = ""
    posts = parse_tag_html(raw)
    for p in posts:
        p["source"] = f"@{handle}"
    log.info("trends.fetched_creator handle=%s posts=%d", handle, len(posts))
    sleep(PACE_SECONDS if pace is None else pace)
    return posts


def fetch_creator(handle: str, *, timeout: int = 300) -> list[dict[str, Any]]:
    """THE SPINE. A creator's profile page — ordered newest-first, so recency is structural."""
    handle = handle.lstrip("@")
    posts = parse_tag_html(_fetch_html(f"https://www.tiktok.com/@{handle}", timeout=timeout))
    for p in posts:
        p["source"] = f"@{handle}"
    log.info("trends.fetched_creator handle=%s posts=%d", handle, len(posts))
    return posts


def fetch_tag(tag: str, *, timeout: int = 300) -> list[dict[str, Any]]:
    """A tag page. NOT the trend spine — these are all-time top posts (see module docstring).

    Used for `discover_creators` and as a weak cross-check only. Anything read from here must never
    be allowed to carry a "this week" claim on its own.
    """
    posts = parse_tag_html(_fetch_html(f"https://www.tiktok.com/tag/{tag}", timeout=timeout))
    for p in posts:
        p["tag"] = tag
        p["source"] = f"#{tag}"
    log.info("trends.fetched_tag tag=%s posts=%d", tag, len(posts))
    return posts


def discover_creators(tags: list[str] | None = None, *, min_signal: float = 0.7,
                      timeout: int = 300) -> dict[str, int]:
    """Tag pages → handles worth seeding, ranked by how many real recipe captions they wrote.

    The seed list is the one hand-curated input in this engine, exactly as it is in Vitrina's
    pipeline; this keeps curating it cheap instead of a memory exercise.
    """
    found: dict[str, int] = {}
    for tag in (tags or DEFAULT_TAGS):
        for p in fetch_tag(tag, timeout=timeout):
            if recipe_signal(p["caption"]) >= min_signal:
                found[p["handle"]] = found.get(p["handle"], 0) + 1
    return dict(sorted(found.items(), key=lambda kv: kv[1], reverse=True))


def sweep(creators: list[str], *, timeout: int = 300, pace: float | None = None,
          sleep=None) -> dict[str, Any]:
    """The daily ingest: every seeded creator's recent posts, gated to real recipe captions.

    Returns `{posts, reached, blocked}` — NOT a bare list. The caller has to be able to tell a
    genuinely quiet week from a sweep that never got through, because those two look identical in
    the output and mean opposite things (§3.2 / `looks_blocked`). `aggregate()` is only entitled to
    say "trending" about a corpus that was actually collected.
    """
    posts: list[dict[str, Any]] = []
    reached: list[str] = []
    blocked: list[str] = []
    for h in creators:
        got = fetch_creator_paced(h, timeout=timeout, pace=pace, sleep=sleep)
        (reached if got else blocked).append(h)
        for p in got:
            if recipe_signal(p["caption"]) >= RECIPE_GATE:
                posts.append(p)
    if blocked:
        log.warning("trends.sweep_partial reached=%d blocked=%d", len(reached), len(blocked))
    return {"posts": posts, "reached": reached, "blocked": blocked}


# ─────────────────────────────────────────────────────────────────────────────
# 2 · FILTER — arithmetic, before a single token is spent
# ─────────────────────────────────────────────────────────────────────────────

_QTY = re.compile(r"\b\d+\s?(?:g|gr|gramos?|kg|kilos?|ml|l|litros?|cda|cdta|cucharad|taza|oz|lb|cups?|tbsp|tsp)\b", re.I)
_VERBS = re.compile(
    r"\b(?:mezcla|añade|agrega|bate|hornea|sofr[ií]e|corta|pica|cuece|hierve|marina|reposa|sirve|"
    r"tritura|salpimienta|dora|rehoga|amasa|"
    r"mix|add|bake|fry|chop|slice|boil|simmer|marinate|whisk|fold|season|roast|sear)\b", re.I)
_INGR = re.compile(
    r"\b(?:aceite|ajo|cebolla|tomate|harina|huevos?|mantequilla|queso|nata|leche|az[uú]car|sal|"
    r"pimienta|limón|perejil|albahaca|pollo|carne|pescado|gambas?|arroz|pasta|patatas?|"
    r"oil|garlic|onion|butter|cheese|cream|flour|eggs?|sugar|chicken|beef|shrimp|rice|potato)\b", re.I)
_NEG = re.compile(r"\b(?:link in bio|c[oó]digo de descuento|publicidad|#ad\b|sorteo|giveaway)\b", re.I)


def recipe_signal(caption: str) -> float:
    """0..1 — does this caption actually carry a recipe? Pure arithmetic, no model.

    The gate exists to keep cost down AND to keep the corpus clean: a caption that is just
    «😍😍😍 #fyp» tells us nothing about a dish, and paying a model to tell us that is waste.
    """
    c = (caption or "").strip()
    if len(c) < 40:
        return 0.0
    s = 0.0
    if _QTY.search(c):
        s += 0.45
    if _VERBS.search(c):
        s += 0.30
    n_ingr = len(set(m.group(0).lower() for m in _INGR.finditer(c)))
    s += min(0.35, 0.09 * n_ingr)
    if len(c) > 180:
        s += 0.10
    if _NEG.search(c):
        s -= 0.35
    # a caption that is mostly hashtags is a discovery play, not a recipe
    tags = c.count("#")
    if tags and len(re.sub(r"#\S+", "", c).strip()) < 60:
        s -= 0.30
    return max(0.0, min(1.0, s))


RECIPE_GATE = 0.55


# ─────────────────────────────────────────────────────────────────────────────
# 3 · EXTRACT — caption text → a dish, strictly
# ─────────────────────────────────────────────────────────────────────────────

_EXTRACT_SYSTEM = (
    "Eres un extractor de recetas. Recibes textos de publicaciones de cocina (pies de foto de TikTok). "
    "Para CADA entrada devuelves el plato que enseña, si lo enseña.\n\n"
    "Devuelve SOLO JSON válido: {\"dishes\":[{\"i\":<índice>,\"dish\":\"nombre corto del plato en "
    "español\",\"ingredients\":[\"ingrediente base\",...],\"cuisine_tags\":[\"...\"],"
    "\"technique\":\"...\",\"restaurant_fit\":0.0}]}\n\n"
    "REGLAS DURAS:\n"
    "- Si una entrada NO enseña un plato concreto, OMÍTELA. No inventes nunca un plato.\n"
    "- `dish` es el plato genérico ('mantequilla de salvia', 'tartar de atún'), NUNCA el titular del "
    "vídeo ni un texto de marketing.\n"
    "- `ingredients`: como mucho 8, en singular, sin cantidades, ingredientes base comprables.\n"
    "- `restaurant_fit` 0..1: ¿tiene sentido esto en la pizarra de un restaurante español? "
    "Un pastel de cumpleaños infantil: bajo. Un tartar, unas croquetas de temporada: alto.\n"
    "- Español siempre, aunque el pie de foto esté en otro idioma."
)


def _anthropic(system: str, user: str, *, model: str, max_tokens: int = 4096) -> dict[str, Any] | None:
    """Anthropic direct — this backend does NOT use OpenRouter. Do not port Vitrina's client."""
    import urllib.error
    import urllib.request

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        log.warning("trends.no_anthropic_key")
        return None
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode(),
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = json.loads(r.read().decode())
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, KeyError) as e:
        log.warning("trends.anthropic_failed err=%s", e)
        return None
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        log.warning("trends.anthropic_bad_json")
        return None


def extract_dishes(posts: list[dict[str, Any]], *, model: str | None = None,
                   batch: int = 25) -> list[dict[str, Any]]:
    """Captions → dishes. VALIDATED, and a malformed row is DISCARDED WHOLE.

    Same law as the supplier card's group-map (`directory.py`): a model licensed to write free text
    into this slot is a model licensed to invent a dish that nobody is cooking — and an invented
    trend is exactly the thing that makes a comercial look stupid in front of a chef.
    """
    model = model or os.environ.get("TREND_EXTRACT_MODEL", "claude-sonnet-4-6")
    out: list[dict[str, Any]] = []
    for start in range(0, len(posts), batch):
        chunk = posts[start:start + batch]
        user = json.dumps(
            [{"i": i, "text": p["caption"][:900]} for i, p in enumerate(chunk)],
            ensure_ascii=False,
        )
        parsed = _anthropic(_EXTRACT_SYSTEM, user, model=model)
        if not parsed or not isinstance(parsed.get("dishes"), list):
            log.warning("trends.extract_discarded batch=%d", start // batch)
            continue
        for d in parsed["dishes"]:
            if not isinstance(d, dict):
                continue
            try:
                i = int(d.get("i", -1))
            except (TypeError, ValueError):
                continue
            if not (0 <= i < len(chunk)):
                continue
            dish = str(d.get("dish") or "").strip()
            if not dish or len(dish) > 90:
                continue
            ingredients = [str(x).strip().lower() for x in (d.get("ingredients") or [])
                           if str(x).strip()][:8]
            if not ingredients:
                continue
            try:
                fit = max(0.0, min(1.0, float(d.get("restaurant_fit", 0.5))))
            except (TypeError, ValueError):
                fit = 0.5
            p = chunk[i]
            out.append({
                "dish": dish,
                "dish_norm": normalise(dish),
                "ingredients": ingredients,
                "cuisine_tags": [str(x).strip().lower() for x in (d.get("cuisine_tags") or [])][:6],
                "technique": str(d.get("technique") or "")[:60],
                "restaurant_fit": fit,
                "post": {"url": p["url"], "handle": p["handle"], "tag": p.get("tag"),
                         "posted_at": p["posted_at"].isoformat() if p.get("posted_at") else None,
                         "rank": p["rank"]},
            })
    return out


def normalise(s: str) -> str:
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\b(?:la|el|los|las|de|del|con|al|a|un|una|y)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


# ─────────────────────────────────────────────────────────────────────────────
# 4 · SCORE + AGGREGATE
# ─────────────────────────────────────────────────────────────────────────────

def aggregate(rows: Iterable[dict[str, Any]], *, now: datetime | None = None) -> list[dict[str, Any]]:
    """Group extracted dishes → scored trends.

    §3.3 — WHY DISTINCT CREATORS AND NOT LIKES. TikTok stopped putting engagement counters in the
    DOM, and the instinct is to go hunting for them. Resist it: the number of creators INDEPENDENTLY
    making the same dish inside the window is a *better* trend signal than one post's like count.
    One post with 2M likes is one post. Eleven cooks making sage butter this week is a trend — that
    is what the word means. Rank on the tag page (TikTok orders by popularity) carries the
    engagement proxy we lost, as a weight rather than as the spine.
    """
    now = now or datetime.now(timezone.utc)
    by: dict[str, dict[str, Any]] = {}
    for r in rows:
        k = r["dish_norm"]
        if not k:
            continue
        g = by.setdefault(k, {
            "dish_norm": k, "dish": r["dish"], "ingredients": {}, "cuisine_tags": {},
            "posts": [], "handles": set(), "fits": [],
        })
        g["posts"].append(r["post"])
        g["handles"].add(r["post"]["handle"])
        g["fits"].append(r["restaurant_fit"])
        for ing in r["ingredients"]:
            g["ingredients"][ing] = g["ingredients"].get(ing, 0) + 1
        for t in r["cuisine_tags"]:
            g["cuisine_tags"][t] = g["cuisine_tags"].get(t, 0) + 1

    out: list[dict[str, Any]] = []
    for g in by.values():
        stamps = [datetime.fromisoformat(p["posted_at"]) for p in g["posts"] if p.get("posted_at")]
        in_window = [t for t in stamps if (now - t).days <= WINDOW_DAYS]
        last = max(stamps) if stamps else None
        creators = len({p["handle"] for p in g["posts"]
                        if p.get("posted_at")
                        and (now - datetime.fromisoformat(p["posted_at"])).days <= WINDOW_DAYS})
        days_since = (now - last).days if last else 9_999
        recency = 0.5 ** (max(0, days_since) / 14.0)          # half-life two weeks
        mean_rank = sum(p["rank"] for p in g["posts"]) / max(1, len(g["posts"]))
        rank_w = 1.0 / (1.0 + mean_rank / 40.0)
        fit = sum(g["fits"]) / max(1, len(g["fits"]))
        score = creators * recency * rank_w * (0.5 + 0.5 * fit)

        out.append({
            "dish_norm": g["dish_norm"],
            "dish": g["dish"],
            "ingredients": sorted(g["ingredients"], key=g["ingredients"].get, reverse=True)[:8],
            "cuisine_tags": sorted(g["cuisine_tags"], key=g["cuisine_tags"].get, reverse=True)[:5],
            "n_posts": len(g["posts"]),
            "n_creators": creators,
            "n_in_window": len(in_window),
            "last_post": last.isoformat() if last else None,
            "days_since": days_since,
            "restaurant_fit": round(fit, 2),
            "score": round(score, 3),
            "sufficiently_trending": creators >= MIN_CREATORS and days_since <= FRESH_DAYS,
            "posts": sorted(g["posts"], key=lambda p: p.get("posted_at") or "", reverse=True)[:6],
        })
    out.sort(key=lambda r: r["score"], reverse=True)
    return out


def evidence_line(t: dict[str, Any]) -> str:
    """The claim, shown to the supplier as EVIDENCE, never as a bare adjective.

    §3.3/§4.3 — "está de moda" is worthless and unfalsifiable. "11 cocineros en los últimos 30 días,
    el más reciente hace 2 días" is something he can repeat to a chef and be right about.
    """
    n, d = t["n_creators"], t["days_since"]
    when = "hoy" if d <= 0 else ("ayer" if d == 1 else f"hace {d} días")
    return f"{n} cocineros lo han publicado en los últimos {WINDOW_DAYS} días · el último, {when}"
