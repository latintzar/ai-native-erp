"""urlfetch.py — A LINK A STRANGER PASTED, TURNED INTO BYTES WE ARE WILLING TO READ.

Peter, 2026-08-09: *«tell them that they can even paste a link to their catalog if they want to.»*
Most Spanish distributors already publish their tarifa as a PDF on their own site — Solobuey's is
21 pages at `https://www.solobuey.net/PDF/Catalogos/Catalogo_de_Productos.pdf` — so the URL is
already in the director's head, while «export the spreadsheet, find it, upload it» is five steps he
has to go and do. This module is the one place that turns that URL into an intake source.

WHAT IT IS NOT: a browser. It fetches ONE document and hands back bytes plus a filename the intake
family already knows how to dispatch on. It renders nothing, runs no JavaScript, follows no assets,
and never puts a fetched byte into an error message.

⚠️ THIS IS AN SSRF SURFACE AND IT SITS ON A PUBLIC AUTHED ROUTE. A URL a caller supplies, fetched by
our server, is the classic pivot into the private network and the cloud metadata endpoint. Every
guard below exists because removing it hands a visitor our internal network:

  ① https ONLY, on port 443 ONLY, with no `user:pass@` in the authority. The port rule is the one
    that is easy to think optional and is not: this box answers the *public* internet on 443 through
    Caddy and runs its own organs on 8090+, so «a public IP with an odd port» is a real pivot even
    after the private ranges are refused.
  ② THE NAME IS RESOLVED AND EVERY ADDRESS IT RETURNS MUST BE PUBLIC — not the first one. A
    round-robin record that answers 93.184.216.34 and 127.0.0.1 is a name that gets refused, because
    which address we would have connected to is the resolver's choice and not ours.
  ③ WE CONNECT TO THE IP WE CHECKED, not to the name we checked. `https://<ip>/path` with an explicit
    `Host:` header and `sni_hostname` so TLS is still verified against the real certificate. Without
    this the resolver is asked twice — once by the guard and once by the socket — and a DNS rebind
    that flips between the two answers walks straight through a check that passed (the classic
    TOCTOU; the guard would be theatre).
  ④ REDIRECTS ARE FOLLOWED BY HAND, at most `MAX_REDIRECTS`, and EVERY hop goes through ① – ③ again.
    A perfectly public host is one 302 away from 169.254.169.254, and `follow_redirects=True` would
    take that hop with no guard in front of it.
  ⑤ A HARD BYTE CAP AND A HARD CLOCK, both enforced while streaming rather than after — the
    `content-length` header is a claim, and a server that lies about it or omits it is exactly the
    server that would otherwise stream us a terabyte. The cap counts DECODED bytes, so a gzip bomb
    hits it too.
  ⑥ A CONTENT-TYPE ALLOWLIST, plus a magic-number check where the format has one. An
    `application/octet-stream` (which is how half the world serves .xlsx) is accepted only when the
    URL's own extension names a format we read.
  ⑦ NOTHING FETCHED IS ECHOED. Every refusal is one of the fixed es-ES sentences below. A fetcher
    that quotes the response body back to the caller is a fetcher that reads internal pages aloud.

WHY NOT `~/.local/bin/web` (the peter-web CLI on the dev box): it is an agent tool, absent from the
production box, and its whole value — auto-escalating to a stealth browser and a residential proxy —
is exactly the redirect-following, JS-executing behaviour guard ④ exists to keep off a public route.
The escalation ladder is right for an agent reading the outside web and wrong for a server acting on
a stranger's URL. This module is ~200 lines of httpx with the guards in front.

EGRESS SANDBOX is deliberately NOT honoured here. That floor (`vital_egress_sandbox`) exists so no
rail can *reach a real party* — message, call or email a human. Reading a public PDF contacts nobody,
and suppressing it would make the rehearsal proof of this feature impossible to run.

es-ES on every visitor-facing sentence (the intake family's locked law). Code, comments and logs
stay English.
"""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import os
import re
import socket
from html.parser import HTMLParser
from typing import Optional
from urllib.parse import unquote, urlsplit

import httpx

log = logging.getLogger("rocoto.urlfetch")

# 20 MB of catalogue is a 21-page trade PDF with photographs and room to spare (Solobuey's real one
# is 2.3 MB). It sits UNDER the 25 MB upload ceiling on purpose: a fetch spends our bandwidth and
# our clock, so it may not be the more generous of the two doors.
MAX_BYTES = int(os.getenv("ROCOTO_URL_MAX_BYTES", str(20 * 1024 * 1024)) or 0) or 20 * 1024 * 1024
# The whole errand, hop to hop. A door that can hold a socket open indefinitely is a door that can
# hold the single uvicorn worker's attention indefinitely.
TOTAL_TIMEOUT_S = float(os.getenv("ROCOTO_URL_TIMEOUT_S", "25") or "25")
CONNECT_TIMEOUT_S = 6.0
READ_TIMEOUT_S = 15.0
MAX_REDIRECTS = 3
# How many of these may be in flight at once. Each one is a socket plus up to 20 MB of memory, on a
# box that also answers paying customers' WhatsApp webhooks.
MAX_INFLIGHT = int(os.getenv("ROCOTO_URL_CONCURRENCY", "2") or "2")

USER_AGENT = "RocotoCatalogueReader/1.0 (+https://soyrocoto.com)"

# content-type → the extension `brain/skuparse` dispatches on. `html` is not an extension: an HTML
# page is turned into TEXT here and enters the intake family as a PASTE, because handing skuparse a
# wall of tags would have it reading `<td>` as a product name.
_BY_TYPE: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/x-pdf": ".pdf",
    "text/csv": ".csv",
    "application/csv": ".csv",
    "text/comma-separated-values": ".csv",
    "text/tab-separated-values": ".tsv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-excel": ".xls",
    "text/plain": ".txt",
    "text/html": "html",
    "application/xhtml+xml": "html",
}
# What we accept when the server declines to say (`application/octet-stream`, or nothing at all):
# the URL's OWN extension, and only these. A bare guess would let any binary in.
_BY_EXT = {".pdf", ".csv", ".tsv", ".xlsx", ".xls", ".txt"}
_VAGUE_TYPES = {"", "application/octet-stream", "binary/octet-stream", "application/download"}

# Formats that carry a signature. A file whose bytes disagree with the header it arrived under is
# refused rather than handed to a parser that would then read it as something it is not.
_MAGIC = {".pdf": (b"%PDF",), ".xlsx": (b"PK\x03\x04",), ".xls": (b"\xd0\xcf\x11\xe0", b"PK\x03\x04")}


class UrlRefused(Exception):
    """A refusal a visitor can act on. `sentence` is es-ES and fixed; `code` is for the log and the
    vital, never for a screen. The fetched body NEVER appears in either."""

    def __init__(self, code: str, sentence: str) -> None:
        super().__init__(code)
        self.code = code
        self.sentence = sentence


# Every sentence says what IS or what to do next — the copy law, applied to failure states too.
_SAY = {
    "scheme": "Pásame un enlace que empiece por https:// y lo leo.",
    "port": "Pásame la dirección normal del archivo, la que abre en el navegador.",
    "shape": "Eso parece otra cosa. Copia la dirección de tu catálogo tal cual sale en el navegador.",
    "private": "Ese enlace lleva a una red privada. Dame la dirección pública del catálogo y lo leo.",
    "dns": "Esa dirección web me devuelve un vacío. Repásala y te la leo.",
    "redirects": "Ese enlace salta de un sitio a otro. Dame la dirección final del archivo.",
    "status": "Ese servidor me ha respondido {status}. Copia la dirección otra vez, o súbeme el archivo.",
    "timeout": "Ese servidor tarda mucho en responder. Prueba otra vez o súbeme el archivo.",
    "network": "He llegado hasta ahí y se ha cortado. Prueba otra vez o súbeme el archivo.",
    "too_big": "Ese archivo pesa más de {mb} MB. Mándame la lista de artículos y la leo entera.",
    "type": ("Ese enlace lleva a otro tipo de archivo. Dame el enlace directo del PDF, el Excel "
             "o el CSV."),
    "empty": "Ese enlace me ha devuelto un archivo vacío. Mándame el bueno y lo leo.",
    "busy": "Estoy leyendo otros enlaces ahora mismo. Dame unos segundos y vuelve a pegarlo.",
}


def _refuse(code: str, **fmt) -> UrlRefused:
    return UrlRefused(code, _SAY[code].format(**fmt))


# ── ① the shape of the URL ────────────────────────────────────────────────────────────────────────

def normalise(raw: str) -> tuple[str, str, str]:
    """`raw` → (url, host, path+query). Raises `UrlRefused` on anything we will not dial.

    Pure and synchronous, so the vital can assert every refusal without a network or a database."""
    url = (raw or "").strip()
    if len(url) > 2000:
        raise _refuse("shape")
    parts = urlsplit(url)
    if parts.scheme.lower() != "https":
        raise _refuse("scheme")
    # `user:pass@host` — the oldest way to make a URL read as one host and dial another.
    if "@" in (parts.netloc or ""):
        raise _refuse("shape")
    host = (parts.hostname or "").strip().rstrip(".")
    if not host or " " in host:
        raise _refuse("shape")
    # PORT 443 ONLY. See ① in the module docstring: past the private-range check, a public IP on an
    # unusual port is still this box's own internal organs.
    if parts.port not in (None, 443):
        raise _refuse("port")
    tail = parts.path or "/"
    if parts.query:
        tail += "?" + parts.query
    return url, host, tail


def _ip_is_public(ip: str) -> bool:
    """Public, routable, and not the cloud metadata endpoint. Every private/loopback/link-local/
    reserved range is refused through `ipaddress`'s own tables rather than a hand-written CIDR list —
    the hand-written list is where `::ffff:127.0.0.1` and `64:ff9b::` get forgotten."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    # ::ffff:10.0.0.1 is 10.0.0.1 wearing a hat.
    if isinstance(addr, ipaddress.IPv6Address):
        if addr.ipv4_mapped is not None:
            addr = addr.ipv4_mapped
        elif addr in ipaddress.ip_network("64:ff9b::/96"):        # NAT64 to a v4 address
            addr = ipaddress.ip_address(int(addr) & 0xFFFFFFFF)
    if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_multicast \
            or addr.is_reserved or addr.is_unspecified:
        return False
    # 169.254.169.254 is link-local and already refused above; named here so the reason is greppable
    # the day someone widens the check.
    return str(addr) != "169.254.169.254"


def _resolve(host: str) -> list[str]:
    """Every address this name answers with. Raises on an empty or unresolvable name."""
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError:
        raise _refuse("dns")
    ips = sorted({i[4][0] for i in infos})
    if not ips:
        raise _refuse("dns")
    return ips


def check_host(host: str) -> str:
    """host → the ONE public address we will dial. ALL of them must be public (② above): a name that
    answers with a public address and a private one is a name refused, because the resolver, not us,
    would have picked."""
    # A literal IP in the URL skips DNS but not the check.
    try:
        ipaddress.ip_address(host)
        ips = [host]
    except ValueError:
        ips = _resolve(host)
    # An empty answer is refused HERE and not left to `ips[0]`: a resolver that returns nothing must
    # produce a sentence, never an IndexError that surfaces as a 502 with no idea what happened.
    if not ips:
        raise _refuse("dns")
    for ip in ips:
        if not _ip_is_public(ip):
            log.warning("urlfetch: refused host %r — %s is a private address", host, ip)
            raise _refuse("private")
    return ips[0]


# ── ② the fetch ───────────────────────────────────────────────────────────────────────────────────

_gate: Optional[asyncio.Semaphore] = None


def _inflight() -> asyncio.Semaphore:
    """Built on first use, never at import: a Semaphore made at module scope binds to whatever loop
    is current, and this module is imported by tooling that has none."""
    global _gate
    if _gate is None:
        _gate = asyncio.Semaphore(MAX_INFLIGHT)
    return _gate


async def fetch(raw_url: str) -> dict:
    """A URL → `{kind, filename, data, text, url}`, ready for `create_intake`.

    `kind` is `"file"` (bytes, dispatched on `filename`'s extension) or `"paste"` (an HTML page,
    already reduced to its visible text). Raises `UrlRefused` — never anything else, and never with
    a fetched byte inside it."""
    url, host, tail = normalise(raw_url)
    gate = _inflight()
    # SATURATED MEANS REFUSED, never queued. A queue here would let N visitors each hold a request
    # open waiting for a slot, which is the same outage the semaphore exists to prevent.
    if gate.locked():
        raise _refuse("busy")
    async with gate:
        try:
            return await asyncio.wait_for(_fetch_inner(url, host, tail), TOTAL_TIMEOUT_S)
        except asyncio.TimeoutError:
            raise _refuse("timeout")


async def _fetch_inner(url: str, host: str, tail: str) -> dict:
    timeout = httpx.Timeout(READ_TIMEOUT_S, connect=CONNECT_TIMEOUT_S)
    headers = {
        "user-agent": USER_AGENT,
        "accept": "application/pdf,text/csv,application/vnd.openxmlformats-officedocument."
                  "spreadsheetml.sheet,text/plain,text/html;q=0.8,*/*;q=0.5",
        "accept-encoding": "gzip, deflate",
    }
    # `follow_redirects=False` is the whole point of ④ — every hop is re-checked below by hand.
    async with httpx.AsyncClient(follow_redirects=False, timeout=timeout, http2=False) as client:
        for hop in range(MAX_REDIRECTS + 1):
            ip = check_host(host)
            try:
                async with client.stream(
                    "GET", f"https://{ip}{tail}",
                    headers={**headers, "host": host},
                    extensions={"sni_hostname": host},     # TLS is verified against the NAME
                ) as resp:
                    if resp.status_code in (301, 302, 303, 307, 308):
                        loc = (resp.headers.get("location") or "").strip()
                        if not loc or hop >= MAX_REDIRECTS:
                            raise _refuse("redirects")
                        url, host, tail = _next_hop(url, host, loc)
                        continue
                    if resp.status_code != 200:
                        log.info("urlfetch: %s answered %s", host, resp.status_code)
                        raise _refuse("status", status=resp.status_code)
                    return await _read(resp, url)
            except httpx.TimeoutException:
                raise _refuse("timeout")
            except (httpx.TransportError, httpx.HTTPError) as exc:
                # The exception's text can carry the peer's own words; log the TYPE, say our sentence.
                log.info("urlfetch: transport failure on %s (%s)", host, type(exc).__name__)
                raise _refuse("network")
    raise _refuse("redirects")


def _next_hop(current: str, current_host: str, location: str) -> tuple[str, str, str]:
    """The Location header, resolved against where we are. Relative hops keep the host; absolute
    hops go through `normalise` again, so a 302 to `http://169.254.169.254/` is refused by ① before
    the address check even runs."""
    if location.startswith("//"):
        location = "https:" + location
    if "://" in location:
        return normalise(location)
    if not location.startswith("/"):
        base = urlsplit(current).path.rsplit("/", 1)[0]
        location = f"{base}/{location}"
    return normalise(f"https://{current_host}{location}")


async def _read(resp: httpx.Response, url: str) -> dict:
    """The body, capped while it streams, typed, sniffed, and named."""
    ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
    ext = _BY_TYPE.get(ctype)
    url_ext = _url_ext(url)
    if ext is None:
        # The server declined to say. Its own URL may still name a format we read.
        if ctype in _VAGUE_TYPES and url_ext in _BY_EXT:
            ext = url_ext
        else:
            log.info("urlfetch: refused content-type %r", ctype)
            raise _refuse("type")
    # A declared length past the cap is refused before a byte is pulled. The stream check below is
    # the one that actually holds — this only saves the bandwidth when the server is honest.
    try:
        declared = int(resp.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > MAX_BYTES:
        raise _refuse("too_big", mb=max(1, MAX_BYTES // (1024 * 1024)))

    chunks: list[bytes] = []
    total = 0
    async for chunk in resp.aiter_bytes():
        total += len(chunk)
        if total > MAX_BYTES:
            # Raising out of the iteration closes the stream through `client.stream`'s own context
            # manager, so the rest of the body is never pulled through this box.
            raise _refuse("too_big", mb=max(1, MAX_BYTES // (1024 * 1024)))
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data.strip():
        raise _refuse("empty")

    if ext == "html":
        text = html_to_text(data)
        if not text.strip():
            raise _refuse("empty")
        return {"kind": "paste", "filename": _page_name(url), "data": None, "text": text,
                "url": url}

    want = _MAGIC.get(ext)
    if want and not any(data[:8].startswith(m) for m in want):
        # The header said PDF and the bytes say otherwise. Handing that to `extract_pdf_text` gets
        # an empty parse and a confusing «I could not read it»; the honest answer is this one.
        log.info("urlfetch: %s claimed %s and the bytes disagree", url[:80], ext)
        raise _refuse("type")
    return {"kind": "file", "filename": _file_name(url, ext), "data": data, "text": None,
            "url": url}


# ── ③ naming and HTML ─────────────────────────────────────────────────────────────────────────────

_SAFE_NAME = re.compile(r"[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ._ -]+")


def _url_ext(url: str) -> str:
    tail = urlsplit(url).path.rsplit("/", 1)[-1]
    return ("." + tail.rsplit(".", 1)[-1].lower()) if "." in tail else ""


def _file_name(url: str, ext: str) -> str:
    """The name the confirm screen shows and the extension skuparse dispatches on. Taken from the
    URL because that is the name the supplier recognises («Catalogo_de_Productos.pdf»), scrubbed
    because it lands on a filesystem through `create_intake`."""
    raw = unquote(urlsplit(url).path.rsplit("/", 1)[-1] or "")
    stem = _SAFE_NAME.sub("", raw).strip(" .-")[:120]
    if not stem:
        stem = "catálogo"
    if not stem.lower().endswith(ext):
        stem = stem.rsplit(".", 1)[0] if "." in stem else stem
        stem += ext
    return stem


def _page_name(url: str) -> str:
    host = urlsplit(url).hostname or "página"
    return _SAFE_NAME.sub("", host)[:120] or "página"


class _Visible(HTMLParser):
    """The page's VISIBLE text, with the table grid preserved. A `<tr>` becomes a line and a `<td>`
    a tab, which is exactly the shape `skuparse._looks_tabular` recognises — so a supplier's tarifa
    published as an HTML table arrives as a table and not as prose. Script and style bodies are
    dropped: they are the largest thing on a modern page and none of it is a product."""

    _SKIP = {"script", "style", "noscript", "template", "svg", "head"}
    _BREAK = {"tr", "p", "div", "br", "li", "h1", "h2", "h3", "h4", "table", "section", "article"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self._mute = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._mute += 1
        elif tag in ("td", "th"):
            self.out.append("\t")
        elif tag in self._BREAK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._mute:
            self._mute -= 1
        elif tag in self._BREAK:
            self.out.append("\n")

    def handle_data(self, data):
        if not self._mute and data.strip():
            self.out.append(re.sub(r"[  ]+", " ", data.strip()))


def html_to_text(data: bytes) -> str:
    """HTML bytes → the visible text, tab/newline shaped. NEVER rendered, never executed, and the
    result goes into the intake family as an ordinary paste."""
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            raw = data.decode(enc)
            break
        except Exception:
            continue
    else:                                          # pragma: no cover — latin-1 decodes anything
        raw = data.decode("utf-8", errors="replace")
    p = _Visible()
    try:
        p.feed(raw)
        p.close()
    except Exception:
        log.info("urlfetch: html parse gave up early (using what it read)")
    text = "".join(p.out)
    text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()
