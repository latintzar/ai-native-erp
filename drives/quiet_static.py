"""One quiet static server for the drives that serve a build themselves (runner maintenance, 13 September 2026).

Cedar POSTs `/api/cedar/access/workspaces` and `/api/proof/session` while the page boots. Python's
`SimpleHTTPRequestHandler` knows only GET and HEAD, so it answered those with 501 and Chromium
logged «Failed to load resource: the server responded with a status of 501» — a console error the
drives count as a page error. Measured on `app/dist-export-review`, the build of origin/main
14157a5d, it is 34 of the reds five suites of the public-proof runner carried: `artwork` 14,
`geometry` 8, `product` 4, `capture` 2, and `runtime` 6 at the REACHING widths. It belongs to the
LOCAL posture rather than to any candidate — the PUBLIC posture serves a kit that has a runtime,
and these calls are answered there. `drive-197-uncoded-section.py` had already met it and answered
with a 204 in its own handler. This module is that answer, once.

204 is what an absent runtime means here: a response with no body. Both clients read it the way
they read the 501 — `cedar-channel-api.ts` and `connections/api.ts` each parse the empty body to
`null` and raise their own unavailable-workspace error, so the workspace stays unavailable and the
surfaces stand where they stood. What changes is the CONSOLE: Chromium
writes «Failed to load resource» for a status in the 400s and 500s and writes nothing for a 204,
so the drives stop counting the local posture as a page error. Everything else still 404s through
the parent handler, so a real asset that fails to load is still a red.

    from quiet_static import serve_quietly
    server, origin = serve_quietly(DIST)          # http://127.0.0.1:<port>
    try:
        ...
    finally:
        server.shutdown()
        server.server_close()

`python3 drives/quiet_static.py` runs the module's own five-answer self-check, so what it returns
is provable without a browser and without a build.
"""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

# THE ANSWER, AS A NUMBER A DRIVE CAN PRINT. A run that states its posture in words — «the origin
# is offline» — should read that sentence off the server rather than carry a copy of it, so the
# sentence cannot go on saying 204 after the handler stops sending one.
API_ANSWER = 204


class QuietStatic(http.server.SimpleHTTPRequestHandler):
    """Static files, no request log, and every `/api/*` POST answered `API_ANSWER`."""

    def log_message(self, *_):
        pass

    def do_POST(self):  # noqa: N802 — BaseHTTPRequestHandler's own spelling
        if self.path.startswith("/api/"):
            self.send_response(API_ANSWER)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_error(404, "File not found")


class _Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def serve_quietly(dist: str | pathlib.Path, host: str = "127.0.0.1") -> tuple[socketserver.TCPServer, str]:
    """Serve `dist` on a free loopback port in a daemon thread; return (server, origin)."""
    server = _Server((host, 0), functools.partial(QuietStatic, directory=str(dist)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://{host}:{server.server_address[1]}"


def _self_check() -> int:
    """`python3 drives/quiet_static.py` — the server's answers, without a browser.

    A server whose whole job is WHICH STATUS it returns should be able to say so on its own: the
    `/api/*` POST answers `API_ANSWER`, a POST anywhere else answers 404, and a GET of a file that
    is absent answers 404 as well — which is the half that keeps a real asset failure red.
    """
    import http.client
    import tempfile
    import urllib.parse

    with tempfile.TemporaryDirectory() as room:
        (pathlib.Path(room) / "app.html").write_text("<!doctype html>\n")
        server, origin = serve_quietly(room)
        host = urllib.parse.urlsplit(origin).netloc
        try:
            def ask(method: str, path: str) -> int:
                link = http.client.HTTPConnection(host, timeout=5)
                try:
                    link.request(method, path)
                    return link.getresponse().status
                finally:
                    link.close()

            asked = [
                ("POST /api/proof/session", ask("POST", "/api/proof/session"), API_ANSWER),
                ("POST /api/cedar/access/workspaces", ask("POST", "/api/cedar/access/workspaces"), API_ANSWER),
                ("POST /elsewhere", ask("POST", "/elsewhere"), 404),
                ("GET /app.html", ask("GET", "/app.html"), 200),
                ("GET /missing.js", ask("GET", "/missing.js"), 404),
            ]
        finally:
            server.shutdown()
            server.server_close()

    failed = 0
    for label, answered, wanted in asked:
        agreed = answered == wanted
        failed += 0 if agreed else 1
        print(f"{'GREEN' if agreed else 'RED  '} {label} · {answered} (expected {wanted})")
    print(f"quiet_static · {len(asked) - failed} green / {failed} red")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_self_check())
