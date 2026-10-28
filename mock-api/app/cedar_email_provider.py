"""Unipile v2 HTTP transport. Provider content exists only in request memory."""

from __future__ import annotations

import base64
from typing import Any
from urllib.parse import quote, urlparse

import httpx
from fastapi import HTTPException

# Read the mailbox and reply from it: Unipile's method table names `gmail.readonly` for listing,
# reading and attachments and `gmail.send` for sending; Microsoft needs `Mail.Send` with
# `Mail.ReadWrite` to send and `Mail.Read` to read.
GOOGLE_SCOPES = (
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "email",
)
MICROSOFT_SCOPES = ("Mail.Read", "Mail.ReadWrite", "Mail.Send", "User.Read", "offline_access")


def segment(value: str) -> str:
    if not value or len(value) > 2048:
        raise HTTPException(502, "Mailbox returned an invalid reference.")
    return quote(value, safe="")


class UnipileClient:
    def __init__(self, api_key: str, client: httpx.AsyncClient | None = None):
        self._key = api_key
        self._client = client

    async def request(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        binary: bool = False,
    ) -> Any:
        if not self._key:
            raise HTTPException(503, "Mailbox connection is awaiting provider setup.")
        client = self._client or httpx.AsyncClient(timeout=30, follow_redirects=False)
        try:
            async with client.stream(
                method,
                "https://api.unipile.com" + path,
                headers={"X-API-KEY": self._key, "Accept": "application/json"},
                json=body,
                params=params,
            ) as response:
                if response.status_code in (401, 403):
                    raise HTTPException(503, "Mailbox access needs attention.")
                if response.status_code == 404:
                    raise HTTPException(404, "The source is unavailable in the mailbox.")
                if not 200 <= response.status_code < 300:
                    raise HTTPException(502, "The mailbox provider could not complete this request.")
                chunks: list[bytes] = []
                size = 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > 12 * 1024 * 1024:
                        raise HTTPException(413, "Choose an attachment smaller than 12 MB.")
                    chunks.append(chunk)
                content = b"".join(chunks)
                if binary:
                    return content
                import json

                try:
                    value = json.loads(content)
                except (ValueError, UnicodeDecodeError):
                    raise HTTPException(502, "The mailbox returned an unreadable response.") from None
                if not isinstance(value, dict):
                    raise HTTPException(502, "The mailbox returned an unreadable response.")
                return value
        except httpx.HTTPError:
            raise HTTPException(502, "The mailbox provider is temporarily unavailable.") from None
        finally:
            if self._client is None:
                await client.aclose()

    async def scope(self, reference: str) -> str:
        result = await self.request(
            "POST", "/v2/scopes/", body={"name": "Rocoto mailbox", "reference": reference}
        )
        scope = result.get("id", "")
        if not isinstance(scope, str) or not scope.startswith("scope_"):
            raise HTTPException(502, "The mailbox returned an invalid scope.")
        return scope

    async def auth_link(self, provider: str, state: str, scope: str, redirect: str, expires: str) -> str:
        body: dict[str, Any] = {
            "providers": provider,
            "state": state,
            "account_scope_id": scope,
            "redirect_uri": redirect,
            "expires_on": expires,
        }
        # Rocoto reads mail and replies from the mailbox; it asks for exactly that. Unipile's default
        # request lists its whole catalogue (labels, calendars), and Google's consent screen shows
        # every line unticked. The scope names are the ones Unipile's method table names for
        # List/Get Email, Get an Email Attachment and Send; identity scopes return the address.
        if provider == "google":
            body["config"] = {"google": {"oauth_scope": list(GOOGLE_SCOPES)}}
        elif provider == "outlook":
            body["config"] = {"outlook": {"oauth_scope": list(MICROSOFT_SCOPES)}}
        elif provider == "imap":
            body["config"] = {"imap": {"initial_sync_enable": True}}
        result = await self.request("POST", "/v2/auth/link", body=body)
        link = result.get("link", "")
        parsed = urlparse(link) if isinstance(link, str) else urlparse("")
        if (
            parsed.scheme != "https"
            or parsed.hostname != "auth.unipile.com"
            or parsed.username
            or parsed.port not in (None, 443)
        ):
            raise HTTPException(502, "The mailbox returned an invalid authentication link.")
        return link

    async def account(self, account: str) -> dict[str, Any]:
        return await self.request("GET", f"/v2/accounts/{segment(account)}")

    async def remove_account(self, account: str) -> None:
        result = await self.request("DELETE", f"/v2/accounts/{segment(account)}")
        if result.get("success") is not True:
            raise HTTPException(502, "The mailbox provider could not confirm the disconnection.")

    async def emails(
        self,
        account: str,
        *,
        cursor: str | None = None,
        query: str | None = None,
        offset: int = 0,
        any_email: str | None = None,
        attachments: bool = False,
        after: str | None = None,
        sender: str | None = None,
        recipient: str | None = None,
        full: bool = False,
    ) -> dict[str, Any]:
        # A meta-only page carries no attachments; the customers view and a search read whole
        # messages so an order's PDF shows in the list. All-mail paging stays light.
        params: dict[str, Any] = {"limit": 50} if full else {"limit": 50, "meta_only": "true"}
        if after:
            params["after"] = after
        # Measured 13 September on a Gmail account: `any_email` answered nothing for an address
        # that `from` found at once, so the participant filters are `from` and `to`.
        if sender:
            params["from"] = sender
        if recipient:
            params["to"] = recipient
        if cursor:
            params["cursor"] = cursor
        elif offset:
            params["offset"] = offset
        if query:
            # Unipile passes the query to the provider's own search (Gmail search syntax for Google).
            params["q"] = query
        if attachments:
            params["has_attachment"] = "true"
        if any_email:
            # Unipile keeps the whole mailbox; Rocoto reads only the customers it was told about.
            params["any_email"] = any_email
        return await self.request("GET", f"/v2/{segment(account)}/emails", params=params)

    async def email(self, account: str, message: str) -> dict[str, Any]:
        return await self.request("GET", f"/v2/{segment(account)}/emails/{segment(message)}")

    async def thread(self, account: str, thread: str) -> dict[str, Any]:
        # v2 Get Thread returns the full thread newest-first. Cedar owns bounded display pages.
        return await self.request("GET", f"/v2/{segment(account)}/threads/{segment(thread)}")

    async def send(
        self,
        account: str,
        *,
        to: list[str],
        subject: str,
        plain_text: str,
        reply_to_message_id: str | None = None,
        cc: list[str] | None = None,
        attachments: list[tuple[str, str, bytes]] | None = None,
        html: str | None = None,
    ) -> str:
        """Send from the connected mailbox; a reply threads under the provider message it answers.
        Files travel base64 inside the JSON body, the shape Unipile's send reference names."""
        body: dict[str, Any] = {
            "to": [{"email": address} for address in to],
            "subject": subject,
            "plain_text": plain_text,
        }
        if html:
            body["html"] = html
        if cc:
            body["cc"] = [{"email": address} for address in cc]
        if attachments:
            body["attachments"] = [
                {"filename": name, "content_type": content_type, "content": base64.b64encode(data).decode()}
                for name, content_type, data in attachments
            ]
        if reply_to_message_id:
            body["reply_to_message_id"] = reply_to_message_id
        result = await self.request("POST", f"/v2/{segment(account)}/emails/send", body=body)
        identifier = result.get("id", "")
        if result.get("object") != "EmailSent" or not isinstance(identifier, str) or not identifier:
            raise HTTPException(502, "The mailbox is still confirming the send; try again in a moment.")
        return identifier

    async def attachment(self, account: str, message: str, attachment: str) -> bytes:
        return await self.request(
            "GET",
            f"/v2/{segment(account)}/emails/{segment(message)}/attachments/{segment(attachment)}",
            binary=True,
        )
