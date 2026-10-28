#!/usr/bin/env python3
"""THE LIVE POSTURE, AGAINST A LOCAL BUILD (E195.2 · FEED-IA §196.5 · §196.6 · §198).

A kit surface has TWO postures and both of them must be true:

  OFFLINE · the runtime is absent. A build served from localhost with no pinned base answers its
            own `/api` calls as `Runtime offline` before a request is made
            (`runtime-client.ts` · `localWithoutRuntime`), so every voice and parsing surface must
            keep its design and claim nothing.
  LIVE    · the runtime ANSWERS. `/api/health` reports four providers, `/api/parse` really reads a
            document, `/api/calls` really answers, and `POST /api/calls` refuses by name where the
            runtime holds no house number.

A drive pointed at https://kit.soyrocoto.com/app.html exercises the live posture against the
PUBLISHED artifact. This server exercises it against a LOCAL candidate: it serves the dist and
reverse-proxies `/api/*` to the deployed runtime, so the page's OWN ORIGIN is the runtime, exactly
as it is on kit.soyrocoto.com — the same requests, the same answers, the same waits.

    python3 tools/serve-with-runtime.py --dist app/dist-export-review \
      --upstream https://kit.soyrocoto.com/api
    # prints:  URL http://127.0.0.1:41234/app.html

⚠ THE PAGE MUST BE POINTED AT THIS ORIGIN. `runtime-client.ts` answers an UNPINNED localhost origin
as «no runtime» WITHOUT making a request (`localWithoutRuntime`), so that a static drive logs no
`/api` 404s on every boot. A page served here therefore has to pin the base —
`localStorage.setItem('rocoto-runtime-base', location.origin)` — which is the rule the drives that
serve `/api` themselves already keep (`drive-198-parsing-qr.py`, `drive-199-voice-real.py`).
`drive-191-stock-photo-session.py` and `drive-191-voice.py` do it for you: each probes
`<origin>/api/health` and pins only when something answers. Against https://kit.soyrocoto.com the
pin names the origin the page is already on, so the requests are the published kit's own.

Options: `--dist` (or ROCOTO_DIST), `--upstream` (or ROCOTO_RUNTIME_UPSTREAM), `--port`
(default 0 = pick a free one). The upstream is required because this command exercises an external
runtime; naming it makes that network boundary visible at the command line.

⚠ THE WAIT IS REAL. One `/api/parse` of a small image measured about 41 seconds against the
deployed runtime, and a page of an albarán measured minutes, so the proxy's own timeout is
deliberately generous (`--timeout`, default 420s). A proxy that gave up early would turn the
product's honest `reading` state into a fabricated failure.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import os
import pathlib
import socketserver
import sys
import urllib.error
import urllib.request

# Hop-by-hop headers belong to ONE connection and must never be relayed onto another.
HOP = {"connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade",
       "proxy-authorization", "proxy-authenticate", "content-length", "content-encoding"}


class Proxying(http.server.SimpleHTTPRequestHandler):
    """The dist, plus `/api/*` answered by the deployed runtime, on ONE origin."""

    upstream = ""
    timeout = 420.0
    quiet = True

    def log_message(self, *args):
        if not self.quiet:
            super().log_message(*args)

    # ── the two roads ──────────────────────────────────────────────────────────────────────
    def do_GET(self):
        if self.path.startswith("/api/"):
            self._relay("GET")
            return
        super().do_GET()

    def do_HEAD(self):
        if self.path.startswith("/api/"):
            self._relay("HEAD")
            return
        super().do_HEAD()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self._relay("POST")
            return
        self.send_error(405)

    def do_OPTIONS(self):
        """Same origin means the browser never preflights; a preflight that arrives is relayed."""
        if self.path.startswith("/api/"):
            self._relay("OPTIONS")
            return
        self.send_error(405)

    # ── the relay ──────────────────────────────────────────────────────────────────────────
    def _body(self) -> bytes | None:
        length = self.headers.get("Content-Length")
        if length is not None:
            return self.rfile.read(int(length))
        if (self.headers.get("Transfer-Encoding") or "").lower() == "chunked":
            chunks = []
            while True:
                size = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    self.rfile.readline()
                    break
                chunks.append(self.rfile.read(size))
                self.rfile.readline()
            return b"".join(chunks)
        return None

    def _relay(self, method: str):
        # `/api/health` on this server is `<upstream>/health` — the upstream already ends in /api.
        target = self.upstream.rstrip("/") + self.path[len("/api"):]
        body = self._body()
        request = urllib.request.Request(target, data=body, method=method)
        for name, value in self.headers.items():
            if name.lower() in HOP or name.lower() == "host":
                continue
            request.add_header(name, value)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as answer:
                self._answer(answer.status, answer.headers, answer.read())
        except urllib.error.HTTPError as refused:
            # A REFUSAL IS AN ANSWER. The runtime's 503 «house_number_missing» is the fact the kit
            # must state, so it is relayed whole — status, headers and the named body.
            self._answer(refused.code, refused.headers, refused.read())
        except (urllib.error.URLError, OSError, ValueError) as why:
            self._answer(502, {"Content-Type": "application/json"},
                         ('{"error":{"code":"proxy_unreachable","message":%s}}' % _json_string(str(why))).encode())

    def _answer(self, status: int, headers, payload: bytes):
        self.send_response(status)
        for name, value in (headers.items() if hasattr(headers, "items") else headers.items()):
            if name.lower() in HOP:
                continue
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)


def _json_string(value: str) -> str:
    import json

    return json.dumps(value)


class Threading(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def serve(dist: pathlib.Path, upstream: str, port: int, timeout: float, quiet: bool) -> Threading:
    if not (dist / "app.html").is_file():
        raise SystemExit(f"No app.html under {dist} — build the kit first or pass --dist")
    handler = functools.partial(Proxying, directory=str(dist))
    Proxying.upstream = upstream
    Proxying.timeout = timeout
    Proxying.quiet = quiet
    return Threading(("127.0.0.1", port), handler)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dist", default=os.environ.get("ROCOTO_DIST", "app/dist-export-review"))
    parser.add_argument("--upstream", default=os.environ.get("ROCOTO_RUNTIME_UPSTREAM"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("ROCOTO_SERVE_PORT", "0")))
    parser.add_argument("--timeout", type=float, default=float(os.environ.get("ROCOTO_PROXY_TIMEOUT", "420")))
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    if not args.upstream:
        parser.error(
            "--upstream or ROCOTO_RUNTIME_UPSTREAM is required; name the external runtime explicitly"
        )

    dist = pathlib.Path(args.dist)
    if not dist.is_absolute():
        dist = (pathlib.Path(__file__).resolve().parent.parent / dist).resolve()
    server = serve(dist, args.upstream, args.port, args.timeout, not args.verbose)
    host, port = server.server_address[0], server.server_address[1]
    print(f"URL http://{host}:{port}/app.html", flush=True)
    print(f"DIST {dist}", flush=True)
    print(f"UPSTREAM {args.upstream}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
