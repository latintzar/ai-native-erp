"""Authorized Cedar email: hosted auth, provider-backed history and explicit invoice review."""

from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from typing import Any, Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from . import cedar_access, cedar_source_budget, parsewise
from .cedar_email_provider import UnipileClient
from .cedar_email_store import EmailStore, opaque
from .config import settings

router = APIRouter(prefix="/api/cedar/email", tags=["cedar-email"])
HEADERS = {"Cache-Control": "no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer"}


def store() -> EmailStore:
    return EmailStore(settings.state_dir / "cedar-email.sqlite")


def provider() -> UnipileClient:
    return UnipileClient(os.getenv("UNIPILE_API_KEY", "").strip())


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def answer(value: Any) -> JSONResponse:
    return JSONResponse(value, headers=HEADERS)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AuthInput(Input):
    provider: Literal["google", "outlook", "imap"]
    return_to: Literal["onboarding", "settings", "check"] = "settings"


class ConsentInput(Input):
    consent: bool


class SearchInput(Input):
    query: str = Field(default="factura", min_length=2, max_length=120)


class SyncInput(Input):
    refresh: bool = False
    # `all` is the mailbox as the person knows it; `customers` is only mail exchanged with bound
    # customer addresses; `query` runs the provider's own content search through Unipile.
    # The product's existing callers send no scope and get their customers' mail, as before.
    scope: Literal["all", "customers"] = "customers"
    query: str | None = Field(default=None, min_length=2, max_length=200)


class CustomerBindingInput(Input):
    address: str = Field(min_length=3, max_length=254)
    customer_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,120}$")


class ForwardingInput(Input):
    workspace_id: str
    account_id: str = Field(pattern=r"^acc_[A-Za-z0-9_-]+$")
    address: str = Field(min_length=5, max_length=254)


class PlainText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        if tag in ("script", "style"):
            self.hidden += 1
        elif tag in ("br", "p", "div", "tr"):
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style") and self.hidden:
            self.hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


def text_view(value: Any, limit: int = 100000) -> str:
    text = value if isinstance(value, str) else ""
    if re.search(r"</?[a-z][^>]*>", text, re.I):
        parser = PlainText()
        parser.feed(text[:limit])
        return "".join(parser.parts)[:limit]
    return text[:limit]


_UNSAFE_TAGS = re.compile(
    r"<\s*(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset|input|button|textarea|select|svg|math)\b"
    r"[^>]*>.*?<\s*/\s*\1\s*>|<\s*(script|iframe|object|embed|form|link|meta|base|applet|frame|frameset|input|button|"
    r"textarea|select|svg|math)\b[^>]*/?>",
    re.IGNORECASE | re.DOTALL,
)
_UNSAFE_ATTRIBUTES = re.compile(r"""\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)""", re.IGNORECASE)
_UNSAFE_URLS = re.compile(
    r"""(href|src|action|formaction|xlink:href)\s*=\s*(["']?)\s*(javascript|vbscript|data:text/html)[^"'\s>]*""",
    re.IGNORECASE,
)


def safe_html(value: Any, limit: int = 400000) -> str:
    """Mail as it was written, minus what could run: scripts, frames, forms, handlers and
    script URLs are removed; the browser shows the rest inside a sandboxed frame."""
    if not isinstance(value, str) or "<" not in value:
        return ""
    html = value[:limit]
    previous = None
    while previous != html:
        previous = html
        html = _UNSAFE_TAGS.sub("", html)
    html = _UNSAFE_ATTRIBUTES.sub("", html)
    html = _UNSAFE_URLS.sub(r'\1=\2#', html)
    return html


def named(items: Any) -> list[dict[str, Any]]:
    """The messages a page can open: Unipile lists placeholder rows with an empty id and no
    subject among a Gmail page (measured 14 September, five in fifty); they carry nothing to read."""
    if not isinstance(items, list):
        return []
    return [
        item
        for item in items
        if isinstance(item, dict) and isinstance(item.get("id"), str) and 0 < len(item["id"]) <= 2048
    ]


def attachment_identities(source_ref: str, items: Any) -> list[tuple[dict[str, Any], str]]:
    """Each file of a message with its identity: a digest of the message's own alias, the file's
    name, its type and its ordinal among same-named files, so two «albaran.pdf» in one message stay
    two files and the name is never stored."""
    if not isinstance(items, list):
        return []
    seen: dict[tuple[str, str], int] = {}
    result: list[tuple[dict[str, Any], str]] = []
    for item in items[:50]:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            continue
        name = text_view(item.get("filename", "Attachment"), 300)
        content_type = str(item.get("mimetype", "application/octet-stream"))[:120]
        ordinal = seen.get((name, content_type), 0)
        seen[(name, content_type)] = ordinal + 1
        result.append((item, EmailStore.attachment_digest(source_ref, name, content_type, ordinal)))
    return result


def normalized(
    db: EmailStore, account: dict[str, Any], message: dict[str, Any], *, body: bool = False
) -> dict[str, Any]:
    ref = db.source(account["ref"], message)
    attachments = []
    for item, identity in attachment_identities(ref, message.get("attachments", [])):
        attachments.append(
            {
                "attachment_ref": db.attachment(ref, item["id"], identity),
                "name": text_view(item.get("filename", "Attachment"), 300),
                "content_type": str(item.get("mimetype", "application/octet-stream"))[:120],
                "available": item.get("is_unavailable") is not True,
            }
        )

    def participants(key: str) -> list[str]:
        return [
            text_view(item.get("email", ""), 254)
            for item in message.get(key, [])[:20]
            if isinstance(item, dict)
        ]

    senders, recipients = participants("from"), participants("to")
    mailbox = str(account.get("owner_address") or account.get("mailbox_address") or "").strip().lower()
    source_address = next(
        (address.strip().lower() for address in senders + recipients if address.strip().lower() != mailbox),
        "",
    )
    customer_id = db.customer_for(
        account["workspace"], account["provider_id"], source_address
    ) if source_address else None
    # A reply goes to the one customer who wrote: mail the business sent is read, not answered.
    outside_senders = [address.strip().lower() for address in senders if address.strip().lower() != mailbox]
    replyable = (
        account["mode"] == "connected"
        and len(outside_senders) == 1
        and db.customer_for(account["workspace"], account["provider_id"], outside_senders[0]) is not None
    )
    return {
        "source_ref": ref,
        "account_ref": account["ref"],
        "provider": account["provider"],
        "mode": account["mode"],
        "subject": text_view(message.get("subject", ""), 500),
        "from": senders,
        "to": recipients,
        "at": str(message.get("date", ""))[:80],
        "body": text_view(message.get("body", "")) if body else "",
        "html": safe_html(message.get("body", "")) if body else "",
        "snippet": text_view(message.get("snippet", ""), 200),
        "unread": message.get("is_unread") is True,
        "attachments": attachments,
        "replyable": replyable,
        **({"customerId": customer_id} if customer_id else {}),
        "provenance": {
            "source_ref": ref,
            "source_revision": 1,
            "method": "unipile-v2",
            "observed_at": now(),
            "content_state": "provider_backed",
        },
    }


async def checked(workspace: str, account_ref: str) -> tuple[EmailStore, dict[str, Any]]:
    db = store()
    account = db.account(workspace, account_ref)
    current = await provider().account(account["provider_id"])
    if current.get("id") != account["provider_id"] or current.get("provider") != account["provider"]:
        raise HTTPException(502, "Mailbox identity needs verification.")
    if current.get("is_locked") or current.get("status") != "running":
        raise HTTPException(409, "Reconnect the mailbox to read its source.")
    account["mailbox_address"] = text_view(current.get("name", ""), 254)
    return db, account


@router.get("/status")
async def status(request: Request) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    accounts = store().accounts(workspace)
    result = []
    for account in accounts:
        try:
            current = await provider().account(account["provider_id"])
            operational = (
                current.get("id") == account["provider_id"]
                and current.get("status") == "running"
                and not current.get("is_locked")
            )
            state = "connected" if operational else "attention"
            label = text_view(current.get("name", "Mailbox"), 254)
            sync_state = current.get("initial_sync", {}).get("status")
        except HTTPException:
            state, label, sync_state = "unavailable", "Mailbox", None
        result.append(
            {
                "account_ref": account["ref"],
                "provider": account["provider"],
                "mode": account["mode"],
                "status": state,
                "label": label,
                "initial_sync": sync_state,
                "revision": account["revision"],
                "history_complete": bool(account["history_complete"]),
                "synced_at": account["synced_at"],
                "invoice_consent_at": account["consent_at"],
                "forwarding_address": account["forwarding_address"],
            }
        )
    return answer(
        {"provider": "unipile", "configured": bool(os.getenv("UNIPILE_API_KEY")), "accounts": result}
    )


@router.post("/auth")
async def auth(body: AuthInput, request: Request) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    base = os.getenv("CEDAR_EMAIL_PUBLIC_BASE", "").rstrip("/")
    parsed = urlsplit(base)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.query
        or parsed.fragment
        or parsed.path
    ):
        raise HTTPException(503, "Mailbox authorization is awaiting its callback address.")
    if len(store().accounts(workspace)) >= 5:
        raise HTTPException(409, "This workspace has five mailbox connections.")
    # Bound attempts before spending provider resources, including abandoned authentication.
    with store().db() as db:
        active = db.execute(
            "SELECT COUNT(*) FROM email_attempts WHERE workspace=? AND expires>?", (workspace, time.time())
        ).fetchone()[0]
    if active >= 5:
        raise HTTPException(429, "Resume your open mailbox connection or try again in ten minutes.")
    state = opaque("auth_")
    client = provider()
    scope = await client.scope(state)
    store().attempt(workspace, scope, body.provider, state, body.return_to)
    expires = datetime.fromtimestamp(time.time() + 600, timezone.utc).isoformat()
    link = await client.auth_link(body.provider, state, scope, base + "/api/cedar/email/callback", expires)
    return answer({"url": link, "expires_at": expires})


@router.get("/callback")
async def callback(state: str = "", account_id: str = "", error_title: str = "") -> Response:
    db = store()
    pending = db.pending(state)
    if not cedar_access.workspace_exists(pending["workspace"]):
        raise HTTPException(403, "The connection workspace has expired.")
    if error_title or not account_id.startswith("acc_"):
        raise HTTPException(400, "Return to Cedar and start a new mailbox connection.")
    account = await provider().account(account_id)
    db.bind(pending, account)
    destination = {
        "onboarding": "/cedar/#/onboarding/channel-setup",
        # The focused channels check page on the same origin (mock-api/deploy/CEDAR-CHANNELS.md).
        "check": "/check/",
    }.get(pending["return_to"], "/cedar/#/admin/connections/email")
    return RedirectResponse(destination, status_code=303, headers=HEADERS)


@router.post("/accounts/{account_ref}/sync")
async def sync(account_ref: str, body: SyncInput, request: Request) -> JSONResponse:
    """Read the mailbox through Unipile, which holds the whole of it.

    `scope:"all"` lists the newest mail, 50 per page with durable pagination; `scope:"customers"`
    lists only mail exchanged with an address bound to a customer (the newest 50 per address,
    merged); `query` runs the provider's content search — Gmail search syntax for Google — so a
    filter such as `pedido OR albarán has:attachment` is answered by the mailbox itself. A bound
    address annotates its messages with `customerId`; it never gates reading.
    """
    workspace = cedar_access.authorize(request)
    db, account = await checked(workspace, account_ref)
    views: list[dict[str, Any]] = []
    more = False
    if body.query:
        page = await provider().emails(account["provider_id"], query=body.query, full=True)
        db.account(workspace, account_ref)
        messages = page.get("data")
        if not isinstance(messages, list) or len(messages) > 100:
            raise HTTPException(502, "Mailbox search needs another check.")
        views = [normalized(db, account, item) for item in named(messages)]
        return answer(
            {
                "messages": views,
                "has_more": bool(page.get("next_cursor")),
                "coverage": "search",
                "query": body.query,
                "unnamed": len(messages) - len(views),
            }
        )
    unnamed = 0
    if body.scope == "customers":
        addresses = db.bound_addresses(workspace, account["provider_id"])
        gathered: dict[str, dict[str, Any]] = {}
        for address in addresses[:50]:
            for page in (
                await provider().emails(account["provider_id"], sender=address, full=True),
                await provider().emails(account["provider_id"], recipient=address, full=True),
            ):
                db.account(workspace, account_ref)
                messages = page.get("data")
                if not isinstance(messages, list) or len(messages) > 100:
                    raise HTTPException(502, "Mailbox history needs another check.")
                usable = named(messages)
                unnamed += len(messages) - len(usable)
                gathered.update((item["id"], item) for item in usable)
                more = more or bool(page.get("next_cursor"))
        # Only the messages shown get an alias: merge, order newest-first, cut, then register.
        newest = sorted(gathered.values(), key=lambda item: str(item.get("date", "")), reverse=True)[:50]
        views = [normalized(db, account, item) for item in newest]
        return answer(
            {
                "messages": views,
                "has_more": more,
                "coverage": "bound-customers",
                "bound": len(addresses),
                "unnamed": unnamed,
            }
        )
    page = await provider().emails(
        account["provider_id"],
        cursor=None if body.refresh else account["cursor"],
        offset=0 if body.refresh else account["offset"],
    )
    db.account(workspace, account_ref)
    messages = page.get("data")
    if not isinstance(messages, list) or len(messages) > 100:
        raise HTTPException(502, "Mailbox history needs another check.")
    views = [normalized(db, account, item) for item in named(messages)]
    unnamed = len(messages) - len(views)
    cursor = page.get("next_cursor")
    complete = not cursor and len(messages) < 50
    with db.db() as conn:
        if body.refresh and account["synced_at"]:
            conn.execute(
                "UPDATE email_accounts SET synced_at=?,revision=revision+1 WHERE ref=?", (now(), account_ref)
            )
        else:
            conn.execute(
                "UPDATE email_accounts SET cursor=?,offset=?,history_complete=?,synced_at=?,"
                "revision=revision+1 WHERE ref=?",
                (
                    cursor if isinstance(cursor, str) else None,
                    0 if complete else account["offset"] + len(messages),
                    int(complete),
                    now(),
                    account_ref,
                ),
            )
    return answer({"messages": views, "has_more": not complete, "coverage": "all-mail", "unnamed": unnamed})


@router.delete("/accounts/{account_ref}")
async def disconnect(account_ref: str, request: Request) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    db = store()
    account = db.account(workspace, account_ref)
    try:
        await provider().remove_account(account["provider_id"])
    except HTTPException as error:
        # A provider-side 404 already means the requested disconnection is complete.
        if error.status_code != 404:
            raise
    db.remove_account(workspace, account_ref)
    return answer({"disconnected": True})


@router.post("/accounts/{account_ref}/customer-binding")
async def customer_binding(
    account_ref: str, body: CustomerBindingInput, request: Request
) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    db = store()
    account = db.account(workspace, account_ref)
    address = body.address.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", address):
        raise HTTPException(422, "Choose the exact customer email address.")
    db.bind_customer(
        workspace, account["provider_id"], account["provider"], account["owner_address"],
        address, body.customer_id,
    )
    return answer({"customerId": body.customer_id})


class ReplyInput(Input):
    text: str = Field(min_length=1, max_length=5000)
    html: str | None = Field(default=None, max_length=200000)
    idempotency_key: str = Field(min_length=1, max_length=120)

    @field_validator("text")
    @classmethod
    def _spoken(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Write the reply first.")
        return stripped


ADDRESS = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SendFile(Input):
    name: str = Field(min_length=1, max_length=300)
    content_type: str = Field(min_length=3, max_length=120)
    data: str = Field(min_length=1, max_length=8_500_000)


class SendInput(Input):
    """A message composed on the page: recipients the person typed, from their connected mailbox."""

    to: list[str] = Field(min_length=1, max_length=20)
    cc: list[str] = Field(default_factory=list, max_length=20)
    subject: str = Field(min_length=1, max_length=400)
    text: str = Field(min_length=1, max_length=20000)
    html: str | None = Field(default=None, max_length=200000)
    idempotency_key: str = Field(min_length=1, max_length=120)
    attachments: list[SendFile] = Field(default_factory=list, max_length=10)
    # A reply or a forward names the message it answers, so the mailbox threads it underneath.
    in_reply_to: str | None = Field(default=None, min_length=4, max_length=64)

    @field_validator("to", "cc")
    @classmethod
    def _addresses(cls, value: list[str]) -> list[str]:
        cleaned = [address.strip().lower() for address in value if address.strip()]
        for address in cleaned:
            if not ADDRESS.match(address) or len(address) > 254:
                raise ValueError(f"Write a full address: {address}")
        return cleaned

    @field_validator("subject", "text")
    @classmethod
    def _spoken(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Write the message first.")
        return stripped


class OperatorBindingInput(Input):
    workspace_id: str
    address: str = Field(min_length=3, max_length=254)
    customer_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,120}$")


@router.post("/operator/customer-binding")
async def operator_customer_binding(body: OperatorBindingInput, request: Request) -> JSONResponse:
    """Operations registers a known sender for a workspace, the way the WhatsApp sender binding was
    commissioned: the exact address becomes that customer's for every mailbox the workspace holds."""
    cedar_access.require_operator(request)
    if not cedar_access.workspace_exists(body.workspace_id):
        raise HTTPException(404, "Choose an existing connection workspace.")
    address = body.address.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", address):
        raise HTTPException(422, "Choose the exact customer email address.")
    db = store()
    accounts = db.accounts(body.workspace_id)
    if not accounts:
        raise HTTPException(409, "Connect a mailbox in this workspace first.")
    for account in accounts:
        db.bind_customer(
            body.workspace_id, account["provider_id"], account["provider"], account["owner_address"],
            address, body.customer_id,
        )
    return answer({"customerId": body.customer_id, "accounts": len(accounts)})


@router.get("/intake")
async def intake(
    request: Request,
    after: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    db = store()
    messages = []
    cursor = after
    events = db.intake(workspace, after, limit)
    for event in events:
        cursor = int(event["sequence"])
        try:
            _, source = db.resolve(workspace, event["source_ref"])
            _, account = await checked(workspace, event["account_ref"])
            message = await provider().email(account["provider_id"], source["provider_id"])
            # A disconnect can complete while the provider read is in flight.
            db.account(workspace, event["account_ref"])
        except HTTPException as error:
            if error.status_code == 404:
                continue
            raise
        if message.get("id") != source["provider_id"]:
            raise HTTPException(502, "Mailbox source identity needs verification.")
        view = normalized(db, account, message, body=True)
        thread_id = str(message.get("thread_id") or event["source_ref"])
        messages.append(
            {
                "id": f'{event["source_ref"]}:{event["source_revision"]}',
                "sourceRef": event["source_ref"],
                "sourceRevision": event["source_revision"],
                "accountRef": event["account_ref"],
                "conversationId": "email_"
                + hashlib.sha256((event["account_ref"] + ":" + thread_id).encode()).hexdigest()[:32],
                "timestamp": event["occurred_at"],
                "text": view["body"],
                "historical": False,
                **({"customerId": view["customerId"]} if view.get("customerId") else {}),
            }
        )
    return answer(
        {
            "messages": messages,
            "nextCursor": str(cursor) if cursor != after else "",
            "hasMore": len(events) == limit,
        }
    )


@router.post("/sources/{source_ref}/reply")
async def reply(source_ref: str, body: ReplyInput, request: Request) -> JSONResponse:
    """Answer a customer's message from the connected mailbox, threaded under it.

    The reply goes to the message's sender, who must be a known customer address of this
    workspace: the development runtime writes only to customers, the way the phone rail rings only
    its allowed destinations. The provider's send is the receipt; a repeated idempotency key
    returns the same receipt without a second send.
    """
    workspace = cedar_access.authorize(request)
    account, source = store().resolve(workspace, source_ref)
    db, account = await checked(workspace, account["ref"])
    if account.get("mode") != "connected":
        raise HTTPException(403, "Connect your own mailbox to reply from it.")
    # The key is reserved before anything is sent, so two requests with one key make one send:
    # the second sees the first's receipt, or that it is still on its way.
    receipt, state = db.reserve_send(workspace, source_ref, body.idempotency_key)
    if state == "sent":
        return answer({"accepted": True, "receipt_ref": receipt, "repeated": True})
    if state == "pending":
        raise HTTPException(409, "Your reply is on its way.")
    try:
        html = safe_html(body.html) or None
        provider_id = await send_reply(db, workspace, account, source, body.text, html)
    except BaseException:
        db.abandon_send(receipt)
        raise
    db.complete_send(receipt, provider_id)
    return answer({"accepted": True, "receipt_ref": receipt})


async def send_reply(
    db: EmailStore,
    workspace: str,
    account: dict[str, Any],
    source: dict[str, Any],
    text: str,
    html: str | None = None,
) -> str:
    message = await provider().email(account["provider_id"], source["provider_id"])
    db.account(workspace, account["ref"])
    if message.get("id") != source["provider_id"]:
        raise HTTPException(502, "Mailbox source identity needs verification.")
    mailbox = str(account.get("owner_address") or account.get("mailbox_address") or "").strip().lower()
    senders = [address for address in _addresses(message, "from") if address and address != mailbox]
    if len(senders) != 1:
        raise HTTPException(409, "Choose a message from one customer to reply to.")
    if not db.customer_for(workspace, account["provider_id"], senders[0]):
        raise HTTPException(403, "Replies go to your customers; add this address to a customer first.")
    # One line of subject: control characters would otherwise travel into the provider's send.
    subject = re.sub(r"[\x00-\x1f\x7f]+", " ", text_view(message.get("subject", ""), 400)).strip()
    if not subject.lower().startswith("re:"):
        subject = "Re: " + subject
    return await provider().send(
        account["provider_id"],
        to=senders,
        subject=subject,
        plain_text=text,
        html=html,
        reply_to_message_id=source["provider_id"],
    )


@router.post("/accounts/{account_ref}/send")
async def send(account_ref: str, body: SendInput, request: Request) -> JSONResponse:
    """Send a composed message from the connected mailbox to the addresses the person typed.

    The mailbox is the business's own, so the recipients are theirs to choose; the runtime only
    insists on a connected mailbox, one send per idempotency key, and files under the size cap.
    """
    workspace = cedar_access.authorize(request)
    db, account = await checked(workspace, account_ref)
    if account.get("mode") != "connected":
        raise HTTPException(403, "Connect your own mailbox to send from it.")
    files: list[tuple[str, str, bytes]] = []
    total = 0
    for item in body.attachments:
        try:
            data = base64.b64decode(item.data, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(422, "Attach the file again; its content arrived unreadable.") from None
        total += len(data)
        if total > 6 * 1024 * 1024:
            raise HTTPException(413, "Choose files under 6 MB in total.")
        files.append((text_view(item.name, 300), item.content_type[:120], data))
    threaded_under: str | None = None
    if body.in_reply_to:
        origin_account, origin = store().resolve(workspace, body.in_reply_to)
        if origin_account["ref"] != account_ref:
            raise HTTPException(409, "Reply from the mailbox that received the message.")
        threaded_under = str(origin["provider_id"])
    receipt, state = db.reserve_send(workspace, body.in_reply_to or "", body.idempotency_key)
    if state == "sent":
        return answer({"accepted": True, "receipt_ref": receipt, "repeated": True})
    if state == "pending":
        raise HTTPException(409, "Your message is on its way.")
    subject = re.sub(r"[\x00-\x1f\x7f]+", " ", body.subject).strip()
    try:
        provider_id = await provider().send(
            account["provider_id"],
            to=body.to,
            cc=body.cc or None,
            subject=subject,
            plain_text=body.text,
            html=safe_html(body.html) or None,
            attachments=files or None,
            reply_to_message_id=threaded_under,
        )
    except BaseException:
        db.abandon_send(receipt)
        raise
    db.complete_send(receipt, provider_id)
    return answer(
        {
            "accepted": True,
            "receipt_ref": receipt,
            "recipients": len(body.to) + len(body.cc),
            "files": len(files),
        }
    )


@router.get("/sources/{source_ref}/thread")
async def thread(source_ref: str, request: Request, cursor: str | None = None) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    account, source = store().resolve(workspace, source_ref)
    anchor = store().thread_anchor(workspace, account["ref"], source_ref, cursor) if cursor else None
    db, account = await checked(workspace, account["ref"])
    if source["thread_id"]:
        # v2 answers `{object: "Thread", id, emails: [...]}`; the mail inside is newest-first.
        page = await provider().thread(account["provider_id"], source["thread_id"])
        messages = page.get("emails", [])
    else:
        messages = [await provider().email(account["provider_id"], source["provider_id"])]
    db.account(workspace, account["ref"])
    if not isinstance(messages, list):
        raise HTTPException(502, "The mailbox thread needs another check.")
    # Provider order is newest-first. Anchor by ID so new arrivals do not move the next page.
    messages = list({item["id"]: item for item in named(messages)}.values())
    if anchor:
        position = next((index for index, item in enumerate(messages) if item["id"] == anchor), None)
        if position is None:
            raise HTTPException(409, "Refresh this thread to continue its updated history.")
        messages = messages[position + 1 :]
    page_messages = messages[:50]
    has_more = len(messages) > len(page_messages)
    next_cursor = (
        db.thread_page(workspace, account["ref"], source_ref, page_messages[-1]["id"]) if has_more else None
    )
    return answer(
        {
            "messages": [normalized(db, account, item, body=True) for item in page_messages],
            "has_more": has_more,
            "next_cursor": next_cursor,
        }
    )


async def source_attachment(workspace: str, source_ref: str, attachment_ref: str) -> tuple[bytes, str]:
    account, source = store().resolve(workspace, source_ref)
    db, account = await checked(workspace, account["ref"])
    attachment = db.attachment_identity(source_ref, attachment_ref)
    if attachment is None:
        raise HTTPException(404, "Attachment source unavailable.")
    message = await provider().email(account["provider_id"], source["provider_id"])
    listed = attachment_identities(source_ref, message.get("attachments", []))
    # The id seen on this read wins: Gmail issues a fresh one per read path, so the file is
    # recognised by its identity (name, type, ordinal) when the stored id is absent.
    by_id = next((item for item, _ in listed if item.get("id") == attachment["provider_id"]), None)
    metadata = by_id or next((item for item, identity in listed if identity == attachment["identity"]), None)
    if not metadata or metadata.get("is_unavailable") or not isinstance(metadata.get("id"), str):
        raise HTTPException(404, "Attachment source unavailable.")
    content = await provider().attachment(account["provider_id"], source["provider_id"], metadata["id"])
    db.account(workspace, account["ref"])
    content_type = str(metadata.get("mimetype", "application/octet-stream"))
    return content, content_type


@router.post("/sources/{source_ref}/attachments/{attachment_ref}/parse")
async def parse_attachment(source_ref: str, attachment_ref: str, request: Request) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    content, content_type = await source_attachment(workspace, source_ref, attachment_ref)
    if content_type != "application/pdf" or not content.startswith(b"%PDF-"):
        raise HTTPException(415, "Select a PDF attachment to review its lines.")
    cedar_source_budget.charge(workspace)
    parsed = await parsewise.parse_document(content, "source.pdf", content_type, "albaran")
    store().resolve(workspace, source_ref)
    return answer(
        {
            "result": parsed,
            "review_required": True,
            "provenance": {
                "source_ref": source_ref,
                "attachment_ref": attachment_ref,
                "source_revision": 1,
                "method": "parsewise-albaran-lines",
                "observed_at": now(),
                "content_state": "provider_backed",
            },
        }
    )


@router.get("/sources/{source_ref}/attachments/{attachment_ref}")
async def attachment(source_ref: str, attachment_ref: str, request: Request) -> Response:
    content, _ = await source_attachment(cedar_access.authorize(request), source_ref, attachment_ref)
    return Response(
        content,
        media_type="application/octet-stream",
        headers={
            **HEADERS,
            "Content-Disposition": 'attachment; filename="mailbox-attachment"',
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.post("/accounts/{account_ref}/invoice-consent")
async def consent(account_ref: str, body: ConsentInput, request: Request) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    store().account(workspace, account_ref)
    stamp = now() if body.consent else None
    with store().db() as db:
        db.execute("UPDATE email_accounts SET consent_at=? WHERE ref=?", (stamp, account_ref))
    return answer({"consent_at": stamp})


@router.post("/accounts/{account_ref}/invoice-search")
async def invoice_search(account_ref: str, body: SearchInput, request: Request) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    db, account = await checked(workspace, account_ref)
    if not account["consent_at"]:
        raise HTTPException(403, "Give permission to search invoice history first.")
    result = await provider().emails(account["provider_id"], query=body.query, attachments=True)
    db.account(workspace, account_ref)
    return answer(
        {
            "messages": [normalized(db, account, item) for item in named(result.get("data"))[:50]],
            "query": body.query,
            "review_required": True,
            "coverage": "provider-search-results",
            "limit": 50,
        }
    )


@router.post("/forwarding")
async def forwarding(body: ForwardingInput, request: Request) -> JSONResponse:
    cedar_access.require_operator(request)
    if not cedar_access.workspace_exists(body.workspace_id):
        raise HTTPException(404, "Choose an existing connection workspace.")
    address = body.address.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", address):
        raise HTTPException(422, "Enter the commissioned forwarding mailbox address.")
    account = await provider().account(body.account_id)
    if (
        account.get("id") != body.account_id
        or account.get("provider") not in ("google", "outlook", "imap")
        or str(account.get("name", "")).lower() != address
    ):
        raise HTTPException(409, "Verify this forwarding address with its provider mailbox.")
    import sqlite3

    try:
        with store().db() as db:
            db.execute(
                "INSERT INTO email_accounts(ref,workspace,provider_id,provider,scope,mode,status,"
                "forwarding_address,owner_address) VALUES(?,?,?,?,?,?,?,?,?)",
                (
                    opaque("mail_"),
                    body.workspace_id,
                    body.account_id,
                    account["provider"],
                    account.get("account_scope_id") or "",
                    "forwarded",
                    account["status"],
                    address,
                    address,
                ),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "This forwarding mailbox already has a connection.") from None
    return answer({"configured": True})


@router.post("/webhook")
async def webhook(request: Request) -> JSONResponse:
    secret = os.getenv("UNIPILE_WEBHOOK_SECRET", "")
    header = request.headers.get("unipile-signature", "")
    match = re.fullmatch(r"t=(\d+),v0=([a-f0-9]{64})", header)
    if not secret or not match or abs(time.time() - int(match[1])) > 300:
        raise HTTPException(401, "Webhook verification required.")
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 2 * 1024 * 1024:
            raise HTTPException(413, "Webhook exceeds its size budget.")
    signature = hmac.new(secret.encode(), match[1].encode() + b"." + raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, match[2]):
        raise HTTPException(401, "Webhook verification required.")
    try:
        event = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "Webhook payload needs verification.") from None
    if not isinstance(event, dict):
        raise HTTPException(400, "Webhook payload needs verification.")
    # Replay keys and revision invalidation only. The raw provider Email is never archived.
    identifier = event.get("id")
    digest = hashlib.sha256(identifier.encode() if isinstance(identifier, str) else raw).hexdigest()
    payload = event.get("payload", {})
    account_id = event.get("account_id") or (payload.get("account_id") if isinstance(payload, dict) else None)
    with store().db() as db:
        db.execute("DELETE FROM email_webhooks WHERE at<?", (time.time() - 600,))
        inserted = db.execute(
            "INSERT OR IGNORE INTO email_webhooks(digest,at) VALUES(?,?)", (digest, time.time())
        ).rowcount
        if inserted and event.get("type") in ("email.new", "email.delete") and isinstance(account_id, str):
            db.execute("UPDATE email_accounts SET revision=revision+1 WHERE provider_id=?", (account_id,))
    # A push carries the message, and Peter's rule is that only mail Rocoto needs may reach its
    # servers (FEED-IA §245.7). Arrivals therefore come from the filtered pull below; a signed
    # event here only invalidates cached revisions and is acknowledged.
    return answer({"received": True})


PULL_PERIOD_SECONDS = 60
_pull_jobs: set[asyncio.Task] = set()


def _addresses(message: dict[str, Any], key: str) -> set[str]:
    return {
        str(item.get("email", "")).strip().lower()
        for item in message.get(key, [])
        if isinstance(item, dict)
    }


async def pull_arrivals() -> dict[str, int]:
    """Ask each connected mailbox, through Unipile, only for new mail from known customer
    addresses, and queue what is new.

    The mailbox does the filtering: the request names one customer address and a date, so a
    message from anyone else never leaves the provider. A message dated after the mailbox was
    connected is an arrival; earlier mail is history and stays out of the queue. The queue's
    unique key makes a repeated pull idempotent. Gmail applies `after` by date, so the window
    starts a day early and the queue absorbs the overlap.
    """
    db = store()
    queued = 0
    for account in db.pull_targets():
        # A workspace that expired or was reset can open nothing; its mailbox is left unread.
        if not cedar_access.workspace_exists(account["workspace"]):
            continue
        stamp = now()
        live_since = account.get("live_since") or stamp
        if not account.get("live_since"):
            db.mark_pulled(account["ref"], stamp, live_since)
        window = (
            datetime.fromisoformat(live_since.replace("Z", "+00:00")) - timedelta(days=1)
        ).strftime("%Y-%m-%dT00:00:00.000Z")
        owner = str(account.get("owner_address") or "").lower()
        for address in account["addresses"][:50]:
            try:
                page = await provider().emails(account["provider_id"], sender=address, after=window)
            except HTTPException:
                continue
            for message in named(page.get("data")):
                senders = _addresses(message, "from")
                recipients = set().union(*(_addresses(message, key) for key in ("to", "cc", "bcc")))
                date = str(message.get("date", ""))[:80]
                if address not in senders or (owner and owner not in recipients) or date <= live_since:
                    continue
                source_ref = db.source(account["ref"], message)
                if db.enqueue_intake(account["workspace"], account["ref"], source_ref, 1, date):
                    queued += 1
        db.mark_pulled(account["ref"], stamp)
    return {"accounts": len(db.pull_targets()), "queued": queued}


async def pull_loop() -> None:
    while True:
        try:
            if (settings.state_dir / "cedar-email.sqlite").exists() and os.getenv("UNIPILE_API_KEY"):
                await pull_arrivals()
        except Exception:  # noqa: BLE001 - the loop outlives one failed pull
            logging.getLogger("rocoto.runtime.cedar_email").exception("filtered pull needs retry")
        await asyncio.sleep(PULL_PERIOD_SECONDS)


async def start() -> None:
    if any(not task.done() for task in _pull_jobs):
        return
    _pull_jobs.add(asyncio.create_task(pull_loop()))


async def stop() -> None:
    for task in _pull_jobs:
        task.cancel()
    await asyncio.gather(*_pull_jobs, return_exceptions=True)
    _pull_jobs.clear()
