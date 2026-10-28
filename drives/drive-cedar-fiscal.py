#!/usr/bin/env python3
"""Cedar billing draft → bank fixture → NubeFact fixture, through actual local HTTP.

Provider HTTP uses MockTransport. This proves the integration, not provider activation.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import sys
import tempfile
from dataclasses import replace
from datetime import date
from pathlib import Path
from typing import Any

import httpx
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("collections_drive", ROOT / "drives/drive-cedar-collections.py")
assert spec and spec.loader
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)
from runtime.cedar_service import create_app  # noqa: E402

OUT = Path(os.getenv("ROCOTO_SHOTS", "/tmp/cedar-fiscal-proof"))
CHECKS: list[str] = []


def check(condition: bool, label: str) -> None:
    if not condition:
        raise AssertionError(label)
    CHECKS.append(label)
    print("GREEN " + label, flush=True)


async def run(browser: Any, width: int) -> None:
    operations: list[str] = []
    current: dict[str, Any] = {}

    def provider_response(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "api.nubefact.com"
        payload = json.loads(request.content)
        operations.append(payload["operacion"])
        if payload["operacion"] == "generar_comprobante":
            current["submitted"] = payload
            raise httpx.ReadTimeout("Isolated uncertain-submission fixture")
        return httpx.Response(
            200,
            json={key: payload[key] for key in ("tipo_de_comprobante", "serie", "numero")}
            | {"aceptada_por_sunat": True, "anulado": False},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(provider_response)) as provider:

        def factory(settings: Any, **_: Any) -> Any:
            app = create_app(replace(settings, allow_live=True), http_client=provider)
            current["app"] = app
            return app

        with tempfile.TemporaryDirectory(prefix="cedar-fiscal-") as directory:
            async with proof.running_service(factory, directory) as (origin, settings, blocked):
                context = await proof.seller_context(browser, origin, width)
                page = await context.new_page()
                page.set_default_timeout(20000)
                errors: list[str] = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                try:
                    await page.goto(proof.URL + "#/money", wait_until="domcontentloaded")
                    await page.get_by_test_id("money-overview").wait_for(timeout=45000)
                    state = await proof.saved(page, "s.examplesLoaded && s.invoices.length === 24")
                    await page.evaluate(
                        "key=>{const s=JSON.parse(localStorage.getItem(key)); Object.assign(s.setup,{sellerName:'Fiscal fixture seller',ruc:'20123456789',invoicing:'pending',bank:'bbva',bankAccountLabel:'Fixture receiving account'});localStorage.setItem(key,JSON.stringify(s));}",
                        proof.KEY,
                    )
                    # ── THE MONEY DOORS READ THE ACCOUNT, NOT A LOCAL FLAG (FEED-IA §247.2) ──
                    # `Prepare payment request` stands where Prometeo says this workspace holds an
                    # authorized receiving account, so the account is authorized in the service
                    # before the walk, and the request's own binding follows once it exists.
                    await page.wait_for_function(
                        "key=>Boolean(localStorage.getItem(key))", arg=proof.WORKSPACE_KEY, timeout=30000
                    )
                    binding = await page.evaluate(
                        "key=>JSON.parse(localStorage.getItem(key))", proof.WORKSPACE_KEY
                    )

                    def account_fixture(state: dict[str, Any]) -> None:
                        state["providers"]["prometeo"] = {
                            "environment": "live",
                            "credentials": {"api_key": "fixture"},
                        }
                        state["bank"].update(
                            status="logged_in",
                            key="fixture-session",
                            provider="bbva_pers_pe",
                            receiving_account={
                                "number": "123456789",
                                "currency": "PEN",
                                "bank": "bbva",
                                "name": "Fixture account",
                                "balance_minor": 500000,
                                "as_of": "2026-09-09T12:00:00Z",
                            },
                        )

                    current["app"].state.store.mutate(binding["id"], account_fixture)
                    await page.reload(wait_until="domcontentloaded")
                    await page.get_by_test_id("money-overview").wait_for(timeout=45000)
                    await expect(page.get_by_test_id("money-balance-card")).to_have_attribute(
                        "data-bank-posture", "ready"
                    )
                    await page.evaluate("location.hash='#/sales'")
                    rows = page.locator('[data-testid^="open-"][data-feed-row]')
                    await rows.first.wait_for()
                    sale_ids = await rows.evaluate_all("nodes=>nodes.map(n=>n.getAttribute('data-feed-row'))")
                    existing = {item["saleId"] for item in state["invoices"]}
                    chosen = None
                    for sale_id in sale_ids:
                        if sale_id in existing:
                            continue
                        await page.evaluate("id=>location.hash='#/sales/'+encodeURIComponent(id)", sale_id)
                        try:
                            await page.get_by_test_id("money-issue-invoice").wait_for(timeout=2000)
                            chosen = sale_id
                            break
                        except Exception:
                            continue
                    check(
                        bool(chosen),
                        f"{width}: Delivery Note prepares payment while invoicing setup is pending",
                    )
                    await page.get_by_test_id("money-issue-invoice").click()
                    await proof.ui.fill(page, "money-issue-address", "Av. Peru 123, Lima")
                    due_input = page.get_by_test_id("money-issue-due")
                    future_due = await due_input.input_value()
                    await due_input.fill("2025-08-22")
                    await page.get_by_test_id("money-confirm-issue").click()
                    await expect(page.get_by_role("alert")).to_contain_text("Choose a due date on or after")
                    rejected_state = await proof.saved(page, "s.invoices.length === 24")
                    check(
                        all(item["origin"] == "demo" for item in rejected_state["invoices"]),
                        f"{width}: invalid due date stays editable before any draft is frozen",
                    )
                    await due_input.fill(future_due)
                    await page.get_by_test_id("money-confirm-issue").click()
                    state = await proof.saved(
                        page,
                        "s.invoices.some(i=>i.origin==='cedar') && s.requests.some(r=>r.remoteId && !r.remotePending)",
                    )
                    invoice = next(item for item in state["invoices"] if item["origin"] == "cedar")
                    link = next(item for item in state["requests"] if item["invoiceId"] == invoice["id"])
                    binding = await page.evaluate(
                        "key=>JSON.parse(localStorage.getItem(key))", proof.WORKSPACE_KEY
                    )
                    check(
                        invoice["status"] == "draft"
                        and invoice["fiscal"]["phase"] == "awaiting-authorization",
                        f"{width}: native request freezes a commercial draft before fiscal acceptance",
                    )
                    check(
                        invoice["issuedAt"][:10] == date.today().isoformat()
                        and invoice["dueAt"] >= date.today().isoformat(),
                        f"{width}: new draft uses current preparation and due dates",
                    )
                    request_path = f"/api/cedar/requests/{link['remoteId']}"
                    owner = {"Authorization": "Bearer " + binding["token"]}
                    admin = {"Authorization": "Bearer " + settings.admin_token}
                    operator = f"/api/operator/workspaces/{binding['id']}"
                    await proof.ui.route(page, f"#/money/invoices/{invoice['id']}", "money-invoice-detail")
                    await expect(page.get_by_test_id("money-issue-fiscal")).to_have_count(0)
                    async with httpx.AsyncClient(base_url=origin) as http:
                        row = (await http.get(request_path, headers=owner)).json()
                        check(
                            row["description"].startswith("Delivery Note ")
                            and row["billing_draft"]["total_minor"] == invoice["amountMinor"],
                            f"{width}: buyer description and frozen billing total preserve document identity",
                        )

                        def bank_fixture(state: dict[str, Any]) -> None:
                            state["requests"][link["remoteId"]]["receiving_account_number"] = "123456789"
                            state["movements"]["a" * 64] = {
                                "id": "a" * 64,
                                "provider": "bbva_pers_pe",
                                "mode": "live",
                                "allocated_to": None,
                                "received_at": "2026-09-09T12:00:00Z",
                                "movement": {
                                    "id": "payment-1",
                                    "account_number": "123456789",
                                    "currency": "PEN",
                                    "reference": row["reference"],
                                    "detail": "Isolated provider receipt",
                                    "date": "2026-09-09",
                                    "debit_minor": 0,
                                    "credit_minor": invoice["amountMinor"],
                                },
                            }

                        current["app"].state.store.mutate(binding["id"], bank_fixture)
                        configured = await http.post(
                            operator + "/providers",
                            headers=admin,
                            json={
                                "provider": "nubefact",
                                "environment": "live",
                                "credentials": {
                                    "api_url": "https://api.nubefact.com/api/v1/fiscal-fixture",
                                    "token": "fixture-token",
                                    "seller_ruc": "20123456789",
                                },
                            },
                        )
                        check(configured.status_code == 200, f"{width}: isolated seller route commissioned")
                        units = {
                            line["unit"]: "KGM" if line["unit"] == "kg" else "NIU"
                            for line in invoice["lines"]
                        }
                        commissioned = await http.post(
                            operator + "/invoices/commission",
                            headers=admin,
                            json={
                                "seller_ruc": "20123456789",
                                "series": "F001",
                                "next_number": 42,
                                "unit_codes": units,
                                "seller_authorization_confirmed": True,
                                "numbering_exclusive_confirmed": True,
                            },
                        )
                        check(
                            commissioned.status_code == 200,
                            f"{width}: reviewed fiscal series and unit mappings are explicit",
                        )
                        authorized = await http.post(
                            operator + f"/requests/{link['remoteId']}/invoice/authorize",
                            headers=admin,
                            json={
                                "draft_fingerprint": row["fiscal"]["draft_fingerprint"],
                                "real_document_confirmed": True,
                                "seller_authorization_confirmed": True,
                                "auto_issue_after_payment": False,
                            },
                        )
                        check(
                            authorized.status_code == 200 and not authorized.json()["fiscal"]["can_issue"],
                            f"{width}: authorization alone cannot issue an unpaid invoice",
                        )
                        matched = await http.post(
                            "/api/cedar/bank/match",
                            headers=owner,
                            json={"movement_id": "a" * 64, "request_id": link["remoteId"]},
                        )
                        check(
                            matched.status_code == 200
                            and matched.json()["confirmed_minor"] == invoice["amountMinor"],
                            f"{width}: authoritative fixture movement settles the exact draft through owner HTTP",
                        )
                    await page.get_by_test_id("money-issue-fiscal").wait_for()
                    await expect(page.get_by_test_id("money-invoice-balance")).to_have_text(
                        await proof.ui.money_text(page, 0)
                    )
                    await page.get_by_test_id("money-issue-fiscal").click()
                    await page.get_by_test_id("money-query-fiscal").wait_for()
                    await expect(page.get_by_test_id("money-fiscal-status")).to_contain_text(
                        "Check invoice acceptance"
                    )
                    check(
                        operations == ["generar_comprobante"],
                        f"{width}: uncertain submission exposes recovery and sends one fixture document",
                    )
                    await page.screenshot(path=str(OUT / f"{width}-invoice-query-required.png"))
                    await page.get_by_test_id("money-query-fiscal").click()
                    await expect(page.get_by_test_id("money-acceptance")).to_have_text("Accepted by SUNAT")
                    await expect(page.get_by_test_id("money-invoice-detail").locator("h2")).to_have_text(
                        "F001-00000042"
                    )
                    await page.reload(wait_until="domcontentloaded")
                    await expect(page.get_by_test_id("money-acceptance")).to_have_text("Accepted by SUNAT")
                    state = await proof.ui.state(page)
                    updated = next(item for item in state["invoices"] if item["id"] == invoice["id"])
                    check(
                        updated["status"] == "draft"
                        and updated["fiscal"]["mode"] == "live"
                        and updated["amountMinor"] == invoice["amountMinor"],
                        f"{width}: server fiscal acceptance survives reload independently of the frozen commercial draft",
                    )
                    check(
                        operations == ["generar_comprobante", "consultar_comprobante"],
                        f"{width}: recovery queries the same identity without resubmission",
                    )
                    check(
                        all(
                            item["origin"] == "demo" and not item.get("fiscal")
                            for item in state["invoices"]
                            if item["id"] != invoice["id"]
                        ),
                        f"{width}: retained sample invoices stay separate from authorized fiscal evidence",
                    )
                    check(
                        current["submitted"]["fecha_de_emision"] != "22-08-2025",
                        f"{width}: fiscal issue date is independent of retained seed clock",
                    )
                    check(
                        not errors and not blocked,
                        f"{width}: connected UI completes with mocked providers and zero external calls",
                    )
                    await page.screenshot(path=str(OUT / f"{width}-invoice-accepted.png"))
                finally:
                    await context.close()


async def main() -> int:
    if not proof.URL.startswith(("http://127.0.0.1:", "http://localhost:")):
        raise SystemExit("Use an isolated local Cedar URL.")
    OUT.mkdir(parents=True, exist_ok=True)
    failures = []
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            try:
                for width in [1600, 390]:
                    await run(browser, width)
            finally:
                await browser.close()
    except Exception as error:
        failures.append(f"{type(error).__name__}: {error}")
        print("RED " + failures[-1], flush=True)
    (OUT / "result.json").write_text(
        json.dumps(
            {
                "checks": CHECKS,
                "failures": failures,
                "provider_evidence": "MockTransport only; zero external provider requests",
            },
            indent=2,
        )
    )
    print(f"{len(CHECKS)} GREEN / {len(failures)} RED · {OUT}", flush=True)
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
