"""Serve the separately built support interface alongside its authenticated API."""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

HEADERS = {
    "Cache-Control": "no-store",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; "
        "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
}


def install(application: FastAPI, directory: Path) -> None:
    @application.get("/operator.html", include_in_schema=False)
    def entry():
        file = directory / "operator.html"
        if not file.is_file():
            raise HTTPException(503, "operator_build_required")
        return FileResponse(file, media_type="text/html", headers=HEADERS)

    @application.get("/operator/", include_in_schema=False)
    def index():
        return RedirectResponse("/operator.html", status_code=303)

    application.mount("/operator/assets", StaticFiles(directory=directory / "assets", check_dir=False),
                      name="operator-assets")
