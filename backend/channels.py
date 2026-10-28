"""channels.py — HOW A TENANT IS REACHABLE, and which number we answer from.

Peter, 2026-08-17: «WhatsApp is just one of the channels. They click Connect, and then it'll take
them through a flow… and then after that it would be add number.»

THE MODEL IS META'S OWN, deliberately — a model that disagrees with the platform it wraps leaks that
disagreement into every sync:

    tenant ──▶ channel_connection   the WABA. What "Connect" produces.
                    └──▶ channel_number   the phone numbers under it. What "Add number" produces.

WHAT THIS REPLACES, AND WHY IT IS NOT A REFACTOR. The mapping was `tenants.wa_phone_number_id`: one
column, one unique index, so a tenant held exactly one number and a number exactly one tenant. Two
things followed, and the second is the serious one:

  1. multi-sede / multi-marca / «the sales line and the incidents line» were impossible;
  2. THE OUTBOUND SENDER WAS NOT MODELLED AT ALL. Every message on the box left from the single
     process-global `config.WA_CLOUD_PHONE_ID` — today a US number displaying «Rocoto». Onboard a
     second distributor and their restaurants would have received replies from the first one's
     number. Inbound routing was already per-tenant and green in the vitals, so every surface said
     multi-tenant worked except the one that sends.

THE OLD COLUMN IS NOT DROPPED. `primary_external_id()` derives it, so the legacy readers keep
working while their callers move over; removing it is a later, separate change with its own risk.

── ON SECRETS, WHICH IS THE PART THAT HAS TO BE RIGHT ──────────────────────────────────────────
Every other credential in this codebase is stored as a **sha256 and nothing else** (`cr_session`,
`sup_session`, `mcp_token`) — a leaked backup cannot be replayed. A customer's WhatsApp business
token cannot follow that rule, because we do not verify it, we USE it: it is the thing that sends a
message to somebody's restaurant. So it is the one credential here that must survive round-trip,
and therefore the one that has to be encrypted rather than digested.

Four decisions, each because the obvious alternative is worse:

  · AES-256-GCM (authenticated) with the key from `ROCOTO_SECRET_KEY`, never a column default and
    never derived from anything in the row — so the database alone is not enough to read it. GCM
    rather than CBC because an unauthenticated ciphertext is a decryption oracle.
  · A SEPARATE TABLE (`channel_secret`). `select * from channel_connection` happens in logs, in
    support queries and in pg_dump excerpts; none of those may hand over the ability to message
    somebody's customers.
  · `key_version` from day one. A key that cannot be rotated is a key you will not rotate.
  · A `hint` of the last four characters, so a human can recognise WHICH token a row holds without
    the row being enough to use it.

And the standing rule for anything that touches this module: a token is never logged, never
returned by an API, and never put on a wire. `describe()` exists so a surface has something honest
to render instead.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Any, Optional

import db

log = logging.getLogger("rocoto.channels")

WHATSAPP = "whatsapp"
VOICE = "voice"          # a PSTN number a distributor's calls are forwarded TO
META_CLOUD = "meta_cloud"
TWILIO = "twilio"

MODE_CLOUD = "cloud"
MODE_COEXISTENCE = "coexistence"

# ── the key ─────────────────────────────────────────────────────────────────────────────────────
_KEY_ENV = "ROCOTO_SECRET_KEY"
KEY_VERSION = 1


class SecretUnavailable(RuntimeError):
    """No usable key. RAISED, never swallowed — storing a customer's token in the clear because an
    env var was missing is precisely the failure this module exists to prevent, and a loud boot
    error is cheaper than a quiet breach."""


def _key() -> bytes:
    """The 32-byte AES key from the environment. Accepts base64 or raw; refuses anything short.

    NO FALLBACK, NO DERIVATION FROM A CONSTANT. A default key is the same as no key, except that it
    looks like security in a code review."""
    raw = (os.environ.get(_KEY_ENV) or "").strip()
    if not raw:
        raise SecretUnavailable(
            f"{_KEY_ENV} is not set — channel secrets cannot be read or written. "
            "Generate one with: python3 -c \"import os,base64;print(base64.b64decode and "
            "base64.urlsafe_b64encode(os.urandom(32)).decode())\"")
    try:
        k = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
    except Exception:
        k = raw.encode()
    if len(k) < 32:
        raise SecretUnavailable(f"{_KEY_ENV} is too short ({len(k)} bytes) — 32 are needed")
    return k[:32]


def key_configured() -> bool:
    """Is the box able to hold channel secrets at all? For /healthz and the settings surface, so
    «Connect» can be greyed with a true reason instead of failing halfway through somebody's
    onboarding."""
    try:
        _key()
        return True
    except SecretUnavailable:
        return False


def seal(token: str) -> tuple[bytes, str]:
    """token → (ciphertext, hint). The nonce is prefixed to the ciphertext; GCM's tag is appended by
    the library. Returns the last-4 hint beside it so the caller never has to keep the plaintext."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    t = (token or "").strip()
    if not t:
        raise ValueError("channels.seal: refusing to store an empty token")
    nonce = os.urandom(12)
    ct = AESGCM(_key()).encrypt(nonce, t.encode(), None)
    return nonce + ct, t[-4:]


def unseal(blob: bytes) -> str:
    """(ciphertext) → token. Raises on tamper — GCM authenticates, so a modified row fails loudly
    instead of decrypting to rubbish we would then send to Meta."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    b = bytes(blob or b"")
    if len(b) < 13:
        raise ValueError("channels.unseal: ciphertext too short")
    return AESGCM(_key()).decrypt(b[:12], b[12:], None).decode()


# ── connections ────────────────────────────────────────────────────────────────────────────────
async def upsert_connection(tenant: str, *, kind: str = WHATSAPP, provider: str = META_CLOUD,
                            external_id: str = "", display_name: str = "",
                            coexistence: bool = False, scopes: str = "",
                            connected_by: str = "", token: Optional[str] = None) -> dict[str, Any]:
    """Record what "Connect" produced. Idempotent on (kind, external_id) — running Connect twice
    updates the row rather than minting a second WABA for the same account, which is the shape a
    customer who reconnects after an error actually produces.

    `token` is optional so the connection can exist in `connecting` before the code exchange
    returns; passing it seals it into `channel_secret` in the same transaction."""
    async with db.get_pool().acquire() as con, con.transaction():
        row = await con.fetchrow(
            """insert into channel_connection
                     (tenant_id, kind, provider, external_id, display_name, coexistence, scopes,
                      connected_by, status, connected_at)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,
                           case when $4 = '' then 'connecting' else 'connected' end,
                           case when $4 = '' then null else now() end)
                   on conflict (kind, external_id) where external_id <> ''
                   do update set display_name = excluded.display_name,
                                 coexistence  = excluded.coexistence,
                                 scopes       = excluded.scopes,
                                 status       = 'connected',
                                 last_error   = '',
                                 revoked_at   = null,
                                 connected_at = coalesce(channel_connection.connected_at, now()),
                                 updated_at   = now()
                   returning id, tenant_id, kind, external_id, status, coexistence""",
            tenant, kind, provider, external_id, display_name, coexistence, scopes, connected_by)
        cid = int(row["id"])
        if token:
            blob, hint = seal(token)
            await con.execute(
                """insert into channel_secret (connection_id, tenant_id, ciphertext, key_version, hint)
                       values ($1,$2,$3,$4,$5)
                       on conflict (connection_id) do update
                         set ciphertext = excluded.ciphertext, key_version = excluded.key_version,
                             hint = excluded.hint, rotated_at = now()""",
                cid, tenant, blob, KEY_VERSION, hint)
    log.info("channels: connection %s for %s (%s ext=%s coexistence=%s)",
             cid, tenant, kind, external_id or "-", coexistence)
    return dict(row)


async def token_for(connection_id: int) -> Optional[str]:
    """The business token for this connection, decrypted. THE ONLY READER of `channel_secret`.

    Returns None rather than raising when there is no row — a connection mid-flow legitimately has
    no token yet, and the caller's own «not connected» path is the honest answer. A DECRYPT failure
    does raise: a tampered or wrong-key row must not be papered over."""
    async with db.get_pool().acquire() as con:
        blob = await con.fetchval(
            "select ciphertext from channel_secret where connection_id = $1", int(connection_id))
    return unseal(blob) if blob else None


# ── numbers ────────────────────────────────────────────────────────────────────────────────────
async def upsert_number(tenant: str, connection_id: int, *, external_id: str, e164: str = "",
                        label: str = "", mode: str = MODE_CLOUD, status: str = "pending",
                        verified_name: str = "", quality_rating: str = "",
                        throughput: str = "", make_primary: Optional[bool] = None,
                        kind: str = WHATSAPP) -> dict[str, Any]:
    """Record a number under a connection. Idempotent on its platform id.

    `make_primary=None` means «primary if this tenant has none yet» — so the first number a
    supplier adds becomes the one we answer from without them having to know the word "primary",
    and the second does not silently steal it."""
    async with db.get_pool().acquire() as con, con.transaction():
        if make_primary is None:
            has = await con.fetchval(
                "select 1 from channel_number where tenant_id=$1 and kind=$2 "
                "and is_primary and status <> 'removed' limit 1", tenant, kind)
            make_primary = not has
        if make_primary:
            # The DB enforces one primary per (tenant, kind); stand the old one down first so
            # the unique index is a guarantee rather than an error the caller has to handle.
            await con.execute(
                "update channel_number set is_primary=false, updated_at=now() "
                "where tenant_id=$1 and kind=$2 and is_primary", tenant, kind)
        row = await con.fetchrow(
            """insert into channel_number
                     (connection_id, tenant_id, kind, external_id, e164, label, mode, status,
                      verified_name, quality_rating, throughput, is_primary, last_synced_at)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
                   on conflict (kind, external_id) do update
                     set e164 = excluded.e164, label = excluded.label, mode = excluded.mode,
                         status = excluded.status, verified_name = excluded.verified_name,
                         quality_rating = excluded.quality_rating, throughput = excluded.throughput,
                         is_primary = excluded.is_primary, last_synced_at = now(),
                         updated_at = now()
                   returning id, tenant_id, external_id, e164, label, mode, status, is_primary""",
            int(connection_id), tenant, kind, external_id, e164, label, mode, status,
            verified_name, quality_rating, throughput, bool(make_primary))
    log.info("channels: %s number %s (%s) for %s mode=%s primary=%s",
             kind, external_id, e164 or "-", tenant, mode, make_primary)
    return dict(row)


async def numbers_for(tenant: str, *, kind: str = WHATSAPP) -> list[dict[str, Any]]:
    """Every live number this tenant holds — the panel's list, primary first."""
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select n.id, n.external_id, n.e164, n.label, n.mode, n.status, n.is_primary, "
            "       n.owner_email, "
            "       n.verified_name, n.quality_rating, n.connection_id, c.coexistence "
            "from channel_number n join channel_connection c on c.id = n.connection_id "
            "where n.tenant_id=$1 and n.kind=$2 and n.status <> 'removed' "
            "order by n.is_primary desc, n.id", tenant, kind)
    return [dict(r) for r in rows]


async def tenant_of_external(external_id: str, *, kind: str = WHATSAPP) -> Optional[str]:
    """INBOUND ROUTING: Meta's `value.metadata.phone_number_id` → the tenant that owns it.

    The unique index on (kind, external_id) is what makes a mis-route impossible rather than
    unlikely — it is the same fence `tenants.wa_phone_number_id`'s unique index used to provide,
    kept deliberately when the column became a table."""
    pid = (external_id or "").strip()
    if not pid:
        return None
    async with db.get_pool().acquire() as con:
        return await con.fetchval(
            "select tenant_id from channel_number where kind=$1 and external_id=$2 "
            "and status <> 'removed'", kind, pid)


async def set_number_owner(tenant: str, number_id: int, owner_email: str = "") -> dict[str, Any]:
    """Allocate a number to a comercial, or hand it back to the house.

    An empty `owner_email` is «the house» and is a real answer, not a missing one — most suppliers
    are one person with one number and must never be made to invent an owner. Tenant-scoped in the
    UPDATE, so a number id from another distributor touches nothing (the same fence every verb on
    this table uses)."""
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "update channel_number set owner_email = nullif($3,''), updated_at = now() "
            "where id = $1 and tenant_id = $2 and status <> 'removed' "
            "returning id, e164, label, owner_email, is_primary",
            int(number_id), tenant, (owner_email or "").strip().lower())
    if not row:
        return {}
    log.info("channels: number %s of %s now belongs to %s",
             row["id"], tenant, row["owner_email"] or "the house")
    return dict(row)


async def tenant_of_did(dialled: str) -> tuple[Optional[str], bool]:
    """INBOUND VOICE ROUTING: the number the caller DIALLED → (tenant, was_it_known).

    THE DIALLED NUMBER IS THE ONLY SAFE KEY. The obvious alternative — the diverting number, which
    says whose phone forwarded the call — is not reliable: 3GPP TS 22.082 §1.3.8 makes presenting it
    a SUBSCRIPTION OPTION of the forwarding subscriber, and Twilio's `ForwardedFrom` is observably
    present for one caller and absent for the next on the SAME forwarded line. Routing a distributor's
    orders on a field that silently vanishes is how a chef's order reaches the wrong wholesaler.
    The DID we issued is ours, it is one per tenant, and the unique index on (kind, external_id) makes
    a mis-route impossible rather than unlikely.

    Returns `known=False` on an unrecognised number so the caller decides — this deliberately mirrors
    `tenancy.tenant_for_wa_number_id`'s contract rather than inventing a second one. It does NOT
    invent a tenant: while `channel_number` holds no voice rows at all (today, on a single-tenant
    box) every call is legitimately unknown, and the caller falls back exactly as it does now."""
    num = (dialled or "").strip()
    if not num:
        return None, False
    slug = await tenant_of_external(num, kind=VOICE)
    if slug:
        return slug, True
    log.warning("channels: inbound call to an UNREGISTERED number %s — no tenant owns it", num)
    return None, False


async def primary_external_id(tenant: str, *, kind: str = WHATSAPP) -> Optional[str]:
    """OUTBOUND: which of our numbers answers for this tenant when the conversation does not say.

    This is the function that ends «one hard-wired sender». A caller with a conversation in hand
    should prefer `sender_for()` below — the number a customer WROTE TO is the number they must
    hear back from, and only when that is unknowable does the tenant's primary decide."""
    async with db.get_pool().acquire() as con:
        return await con.fetchval(
            "select external_id from channel_number where tenant_id=$1 and kind=$2 "
            "and is_primary and status <> 'removed' limit 1", tenant, kind)


async def sender_for(tenant: str, customer_phone: str = "", *, kind: str = WHATSAPP) -> Optional[str]:
    """The number to send FROM, in the order that respects the customer:

      ① the number this customer is routed to (`customer_routing`) — they wrote to it;
      ② the tenant's primary;
      ③ None → the caller falls back to the box default and SAYS SO in its log.

    A restaurant that has messaged «Frutas Sitjar» for two years must not suddenly receive a reply
    from a number they have never seen; that is indistinguishable from a scam, and it is why this
    resolution is a function rather than a column read."""
    ph = (customer_phone or "").strip()
    if ph:
        async with db.get_pool().acquire() as con:
            ext = await con.fetchval(
                "select n.external_id from customer_routing r "
                "join channel_number n on n.id = r.channel_number_id "
                "where r.tenant_id=$1 and r.phone_number=$2 and n.status <> 'removed'", tenant, ph)
        if ext:
            return ext
    return await primary_external_id(tenant, kind=kind)


# ── routing ────────────────────────────────────────────────────────────────────────────────────
#: «leave this one alone» — distinct from None, which means «clear it».
#: A sentinel is needed because both are real instructions and the panel sends both: «I changed who
#: owns this customer» must not touch which number they talk to, AND «this customer goes back to the
#: house number» must actually be expressible. Using None for both made clearing impossible, which
#: is the shape of bug where a UI has a control that silently does nothing.
KEEP: Any = object()


async def set_routing(tenant: str, phone_number: str, *,
                      channel_number_id: Any = KEEP,
                      assigned_to: Any = KEEP, note: str = "",
                      updated_by: str = "") -> dict[str, Any]:
    """The panel's per-customer selector. Two independent questions:

      · which of OUR numbers this customer talks to
      · which comercial owns the relationship

    Pass `KEEP` (the default) to leave one alone, `None` to clear it, or a value to set it.
    Clearing the number returns them to the tenant's primary — which is the number they already
    know, so it is always a safe answer (see `sender_for`)."""
    async with db.get_pool().acquire() as con:
        cur = await con.fetchrow(
            "select channel_number_id, assigned_to from customer_routing "
            "where tenant_id=$1 and phone_number=$2", tenant, phone_number)
        num = (cur["channel_number_id"] if cur else None) if channel_number_id is KEEP else channel_number_id
        who = (cur["assigned_to"] if cur else "") if assigned_to is KEEP else (assigned_to or "")
        row = await con.fetchrow(
            """insert into customer_routing (tenant_id, phone_number, channel_number_id,
                                             assigned_to, note, updated_by)
               values ($1,$2,$3,$4,$5,$6)
               on conflict (tenant_id, phone_number) do update
                 set channel_number_id = excluded.channel_number_id,
                     assigned_to       = excluded.assigned_to,
                     note              = case when $5 = '' then customer_routing.note else $5 end,
                     updated_by        = $6,
                     updated_at        = now()
               returning tenant_id, phone_number, channel_number_id, assigned_to, note""",
            tenant, phone_number, num, who, note, updated_by)
    return dict(row)


async def routing_for(tenant: str, phone_number: str) -> dict[str, Any]:
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select channel_number_id, assigned_to, note from customer_routing "
            "where tenant_id=$1 and phone_number=$2", tenant, phone_number)
    return dict(row) if row else {"channel_number_id": None, "assigned_to": "", "note": ""}


# ── what a surface may see ─────────────────────────────────────────────────────────────────────
async def describe(tenant: str) -> dict[str, Any]:
    """The tenant's channel state, SAFE TO RENDER. No token, ever — the hint is the most a screen
    gets, which is enough to say «connected as …9459» and nothing more."""
    async with db.get_pool().acquire() as con:
        conns = await con.fetch(
            "select c.id, c.kind, c.provider, c.external_id, c.display_name, c.status, "
            "       c.coexistence, c.connected_at, c.last_error, coalesce(s.hint,'') as hint "
            "from channel_connection c left join channel_secret s on s.connection_id = c.id "
            "where c.tenant_id=$1 and c.revoked_at is null order by c.id", tenant)
    return {"connections": [dict(c) for c in conns],
            "numbers": await numbers_for(tenant),
            "secrets_available": key_configured()}
