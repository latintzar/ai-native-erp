"""vital_demo_url.py — THE PASTED LINK, AND EVERY DOOR IT MUST REFUSE TO OPEN.

`/demo` now accepts a URL where it accepted a file and a paste (Peter, 2026-08-09: «tell them that
they can even paste a link to their catalog»). That turns a public, authenticated route into a
thing that makes OUTBOUND requests on a stranger's say-so, which is the textbook SSRF pivot: the
private network, the container network, and 169.254.169.254 are all one typed address away.

So this file is mostly a list of things that must NOT happen, each one an attack somebody has
actually run against somebody else's product:

  ① SCHEME AND SHAPE — http, file, gopher, `user:pass@`, a port that is not 443.
  ② THE ADDRESS ITSELF — loopback, RFC1918, link-local (which is where the cloud metadata endpoint
    lives), unique-local v6, ::1, and an IPv4-mapped v6 address wearing a hat.
  ③ THE NAME'S EVERY ANSWER — a hostname that resolves to one public and one private address is
    refused, because which of the two we would have dialled is the resolver's choice.
  ④ THE HOP — a perfectly public host that 302s to the metadata endpoint. This is the one a guard
    written only at the front door lets straight through.
  ⑤ THE VOLUME — a body past the cap, aborted while streaming rather than after.
  ⑥ THE TYPE — anything outside the allowlist, and a body whose magic number disagrees with the
    content-type it arrived under.
  ⑦ SILENCE — no refusal may contain a byte that was fetched.

Plus ⑧, the happy path both ways (a PDF, and an HTML tarifa reduced to text), and ⑨ the route's own
gate: an unauthenticated POST reaches no fetcher at all.

The network is a `httpx.MockTransport`, so this runs anywhere, deterministically, with no outbound
socket — EXCEPT the one real fetch at the end, which is skipped unless ROCOTO_URL_LIVE=1 (that one
proves the pinned-IP + SNI path against a real server, and is what the rehearsal run uses).

Run:  PYTHONPATH=. python3 tests/vital_demo_url.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx  # noqa: E402

import urlfetch  # noqa: E402

R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def refused(url: str, code: str = "", *, why: str = "") -> tuple[bool, str]:
    """→ (was refused with `code`, the sentence it said). Never lets a success pass as a refusal."""
    try:
        await urlfetch.fetch(url)
        return False, "(it was FETCHED)"
    except urlfetch.UrlRefused as e:
        return (e.code == code if code else True), f"{e.code}: {e.sentence}"


def mock(handler):
    """Point `urlfetch` at a fake network for the duration of one check. It builds its own
    AsyncClient inside `_fetch_inner`, so the CLASS is what gets swapped — the kwargs it passes
    (timeouts, follow_redirects=False) ride through unchanged, which is the point: the redirect
    policy under test is the real one."""
    real = urlfetch.httpx.AsyncClient

    class _Client(real):                                         # type: ignore[misc, valid-type]
        def __init__(self, *a, **kw):
            kw["transport"] = httpx.MockTransport(handler)
            super().__init__(*a, **kw)

    urlfetch.httpx.AsyncClient = _Client                          # type: ignore[assignment]
    return real


def unmock(real):
    urlfetch.httpx.AsyncClient = real                             # type: ignore[assignment]


# The marker a "server" puts in every body. If it ever shows up in a refusal, the fetcher is
# reading the outside world out loud (⑦).
LEAK = "SECRET-INTERNAL-abc123"


async def main() -> int:
    print("\n① SCHEME AND SHAPE — refused before a socket exists")
    for url, code in [
        ("http://example.com/tarifa.pdf", "scheme"),
        ("file:///etc/passwd", "scheme"),
        ("gopher://example.com/x", "scheme"),
        ("//example.com/tarifa.pdf", "scheme"),
        ("https://user:pass@example.com/t.pdf", "shape"),
        ("https://example.com:8090/t.pdf", "port"),
        ("https://example.com:22/t.pdf", "port"),
        ("https://" + "a" * 3000 + ".com/x", "shape"),
        ("https:///nohost", "shape"),
    ]:
        ok, said = await refused(url, code)
        ck(f"{url[:52]:<52} → {code}", ok, said)

    print("\n② THE ADDRESS — every private range, by literal")
    for host, code in [
        ("127.0.0.1", "private"),
        ("10.1.2.3", "private"),
        ("172.16.9.9", "private"),
        ("192.168.1.1", "private"),
        ("169.254.169.254", "private"),          # the cloud metadata endpoint
        ("0.0.0.0", "private"),
        ("[::1]", "private"),
        ("[fd00::1]", "private"),
        ("[fe80::1]", "private"),
        ("[::ffff:127.0.0.1]", "private"),       # v4 loopback wearing a v6 hat
        ("localhost", "private"),                # resolved, not pattern-matched
    ]:
        ok, said = await refused(f"https://{host}/latest/meta-data/", code)
        ck(f"{host:<22} → private", ok, said)

    ck("a public literal passes the address check",
       urlfetch.check_host("93.184.216.34") == "93.184.216.34")

    print("\n③ THE NAME'S EVERY ANSWER — one private address poisons the whole record")
    real_resolve = urlfetch._resolve
    urlfetch._resolve = lambda host: ["93.184.216.34", "127.0.0.1"]
    ok, said = await refused("https://rebind.example/tarifa.pdf", "private")
    ck("a host that answers public AND private is refused (no cherry-picking)", ok, said)
    urlfetch._resolve = lambda host: []
    ok, said = await refused("https://nowhere.example/tarifa.pdf", "dns")
    ck("a name that answers nothing is an honest refusal", ok, said)
    urlfetch._resolve = real_resolve

    # From here on the address check has to pass, so every name resolves to one public literal.
    urlfetch._resolve = lambda host: ["93.184.216.34"]

    print("\n④ THE HOP — a public host that redirects somewhere private")

    def redirect_to(target):
        def h(request: httpx.Request) -> httpx.Response:
            return httpx.Response(302, headers={"location": target}, text=LEAK)
        return h

    for target, code in [
        ("http://169.254.169.254/latest/meta-data/", "scheme"),
        ("https://169.254.169.254/latest/meta-data/", "private"),
        ("https://127.0.0.1/admin", "private"),
        ("https://internal.example:8090/ops", "port"),
        ("//169.254.169.254/latest/meta-data/", "private"),
    ]:
        real = mock(redirect_to(target))
        try:
            ok, said = await refused("https://catalogos.example/tarifa.pdf", code)
        finally:
            unmock(real)
        ck(f"302 → {target[:44]:<44} refused ({code})", ok, said)
        ck("   and the refusal carries no fetched byte", LEAK not in said)

    hops = {"n": 0}

    def endless(request: httpx.Request) -> httpx.Response:
        hops["n"] += 1
        return httpx.Response(302, headers={"location": f"/hop{hops['n']}"}, text=LEAK)

    real = mock(endless)
    try:
        ok, said = await refused("https://catalogos.example/tarifa.pdf", "redirects")
    finally:
        unmock(real)
    ck("a redirect chain stops at the cap", ok, said)
    ck(f"   and it stopped after {hops['n']} hops (cap is {urlfetch.MAX_REDIRECTS + 1})",
       hops["n"] <= urlfetch.MAX_REDIRECTS + 1, str(hops["n"]))

    print("\n⑤ THE VOLUME — aborted while streaming, not after")
    was_cap = urlfetch.MAX_BYTES
    urlfetch.MAX_BYTES = 64 * 1024
    pulled = {"n": 0}

    def firehose(request: httpx.Request) -> httpx.Response:
        async def body():
            for _ in range(400):                       # 400 × 8 KB = 3.2 MB if nothing stops it
                pulled["n"] += 1
                yield b"%PDF-" + b"x" * 8187
        # NO content-length: the honest-server shortcut must not be what saves us here.
        return httpx.Response(200, headers={"content-type": "application/pdf"}, content=body())

    real = mock(firehose)
    try:
        ok, said = await refused("https://catalogos.example/tarifa.pdf", "too_big")
    finally:
        unmock(real)
        urlfetch.MAX_BYTES = was_cap
    ck("an unbounded body is refused", ok, said)
    ck(f"   and the stream was cut early ({pulled['n']} of 400 chunks pulled)", pulled["n"] < 40,
       str(pulled["n"]))

    def liar(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "application/pdf",
                                            "content-length": str(999 * 1024 * 1024)},
                              content=b"%PDF-1.4")

    real = mock(liar)
    try:
        ok, said = await refused("https://catalogos.example/tarifa.pdf", "too_big")
    finally:
        unmock(real)
    ck("a declared length past the cap is refused before the body is pulled", ok, said)

    print("\n⑥ THE TYPE — an allowlist, and a magic number to back it")

    def serves(ctype, body=b"hello"):
        def h(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, headers={"content-type": ctype}, content=body)
        return h

    for ctype, url, code in [
        ("text/xml", "https://c.example/f.xml", "type"),
        ("image/png", "https://c.example/f.png", "type"),
        ("application/zip", "https://c.example/f.zip", "type"),
        ("application/octet-stream", "https://c.example/setup.exe", "type"),
        ("application/json", "https://c.example/api", "type"),
    ]:
        real = mock(serves(ctype, LEAK.encode()))
        try:
            ok, said = await refused(url, code)
        finally:
            unmock(real)
        ck(f"{ctype:<26} → refused", ok, said)
        ck("   and the refusal carries no fetched byte", LEAK not in said)

    real = mock(serves("application/pdf", b"<html>" + LEAK.encode() + b"</html>"))
    try:
        ok, said = await refused("https://c.example/t.pdf", "type")
    finally:
        unmock(real)
    ck("a body whose magic number contradicts its content-type is refused", ok, said)
    ck("   and the refusal carries no fetched byte", LEAK not in said)

    real = mock(serves("application/pdf", b"   "))
    try:
        ok, said = await refused("https://c.example/t.pdf", "empty")
    finally:
        unmock(real)
    ck("an empty body is an honest refusal", ok, said)

    real = mock(serves("text/html", b"<h1>403</h1>"))
    try:
        got = await urlfetch.fetch("https://c.example/tarifa")
        ck("an HTML page is accepted and comes back as text", got["kind"] == "paste", got["kind"])
    except urlfetch.UrlRefused as e:
        ck("html is accepted", False, e.code)
    finally:
        unmock(real)

    def status(code):
        def h(request: httpx.Request) -> httpx.Response:
            return httpx.Response(code, text=LEAK)
        return h

    for sc in (401, 403, 404, 500):
        real = mock(status(sc))
        try:
            ok, said = await refused("https://c.example/t.pdf", "status")
        finally:
            unmock(real)
        ck(f"HTTP {sc} → a sentence with the code in it", ok and str(sc) in said, said)
        ck("   and no fetched byte", LEAK not in said)

    print("\n⑧ THE HAPPY PATHS")
    pdf = b"%PDF-1.4\n" + b"catalogo" * 200

    real = mock(serves("application/pdf", pdf))
    try:
        got = await urlfetch.fetch(
            "https://www.solobuey.net/PDF/Catalogos/Catalogo_de_Productos.pdf")
    finally:
        unmock(real)
    ck("a PDF comes back as a FILE for the intake family", got["kind"] == "file", str(got["kind"]))
    ck("   named after the URL, so the supplier recognises it",
       got["filename"] == "Catalogo_de_Productos.pdf", got["filename"])
    ck("   with the bytes intact", got["data"] == pdf, f"{len(got['data'] or b'')} bytes")

    # An `octet-stream` xlsx — how half the world serves a spreadsheet.
    real = mock(serves("application/octet-stream", b"PK\x03\x04rest-of-the-zip"))
    try:
        got = await urlfetch.fetch("https://c.example/tarifas/2026.xlsx")
    finally:
        unmock(real)
    ck("an octet-stream .xlsx is accepted on its URL's own extension",
       got["kind"] == "file" and got["filename"].endswith(".xlsx"), got["filename"])

    page = (b"<html><head><style>td{color:red}</style>"
            b"<script>var secret='" + LEAK.encode() + b"'</script></head><body>"
            b"<h1>Tarifa 2026</h1><table>"
            b"<tr><td>Chorizo sarta extra</td><td>kg</td><td>9,80</td></tr>"
            b"<tr><td>Queso manchego curado</td><td>kg</td><td>13,90</td></tr>"
            b"</table></body></html>")
    real = mock(serves("text/html", page))
    try:
        got = await urlfetch.fetch("https://c.example/tarifa")
    finally:
        unmock(real)
    ck("an HTML tarifa comes back as a PASTE (never rendered)", got["kind"] == "paste",
       str(got["kind"]))
    ck("   with the products in it", "Chorizo sarta extra" in (got["text"] or ""))
    ck("   the rows tab-separated, so skuparse sees a table",
       "Chorizo sarta extra\tkg\t9,80" in (got["text"] or ""),
       repr((got["text"] or "")[:80]))
    ck("   and the <script> body dropped", LEAK not in (got["text"] or ""))
    ck("   which skuparse then reads as tabular", _looks_tabular(got["text"] or ""))

    urlfetch._resolve = real_resolve

    print("\n⑨ THE ROUTE'S OWN GATE — no cookie, no fetch")
    await _route_gate()

    print("\n⑩ THE REAL WORLD (set ROCOTO_URL_LIVE=1 to run)")
    if os.getenv("ROCOTO_URL_LIVE") == "1":
        got = await urlfetch.fetch(
            "https://www.solobuey.net/PDF/Catalogos/Catalogo_de_Productos.pdf")
        ck("Solobuey's real catalogue fetches over a pinned IP with SNI intact",
           got["kind"] == "file" and (got["data"] or b"").startswith(b"%PDF"),
           f"{len(got['data'] or b'')} bytes, {got['filename']}")
    else:
        print("  [skip] live fetch (ROCOTO_URL_LIVE unset)")

    passed = sum(R)
    print(f"\nDEMO URL INTAKE: {passed}/{len(R)} — "
          f"{'THE DOOR HOLDS' if passed == len(R) else 'DO NOT SHIP'}")
    return 0 if passed == len(R) else 1


def _looks_tabular(text: str) -> bool:
    from brain import skuparse as _sk
    return _sk._looks_tabular(text)


async def _route_gate() -> None:
    """The demo route must refuse an unauthenticated caller BEFORE it dials anything. Proved by
    making the fetcher explode if it is ever reached."""
    os.environ.setdefault("DEMO_FLOW_ENABLED", "1")
    try:
        import app as _app
    except Exception as exc:                       # pragma: no cover — import needs the app's deps
        print(f"  [skip] app import unavailable ({type(exc).__name__})")
        return

    reached = {"n": 0}
    real_fetch = urlfetch.fetch

    async def _boom(url):
        reached["n"] += 1
        raise AssertionError("the fetcher was reached by an unauthenticated caller")

    urlfetch.fetch = _boom
    try:
        transport = httpx.ASGITransport(app=_app.app)
        async with httpx.AsyncClient(transport=transport, base_url="https://t.local") as c:
            r = await c.post("/api/demo/session/whatever/catalog",
                             json={"url": "https://169.254.169.254/latest/meta-data/"})
        ck("an unauthenticated POST is refused (401/403/404/503, never a fetch)",
           r.status_code in (401, 403, 404, 503), f"HTTP {r.status_code}")
        ck("   and the fetcher was never reached", reached["n"] == 0)
    finally:
        urlfetch.fetch = real_fetch

    # Included APIRouters can be lazy; inspect the composed HTTP contract.
    routes = _app.app.openapi()["paths"]
    ck("the URL door is the SAME route as the file and paste doors (one road in)",
       "/api/demo/session/{token}/catalog" in routes)


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
