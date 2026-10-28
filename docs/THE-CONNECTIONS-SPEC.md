# THE CONNECTIONS SPEC — WhatsApp, email and phone, literally how they will be

**Current Cedar work, 9 September 2026:** [FEED-IA §224](FEED-IA.md#224) selects real,
isolated development proofs for WhatsApp, email and Twilio phone, starting with Meta
coexistence and permitted history import from a customer's WhatsApp Business account. Peter
offered his existing account for the first acceptance run. Customer setup asks “Do you use the
WhatsApp Business app?” and shows two outlined app choices with recognizable app icons. Each has
an independent app-store link for identification. Business users open Meta from their choice;
regular users follow download and transfer steps, then confirm their chats are visible in
WhatsApp Business before opening Meta. Each step presents one decision or primary action.
Meta's own popup owns number entry, account checks and sharing consent. Cedar verifies
authorized coexistence before changing callback routing or requesting history. One privacy
disclosure contains the detailed sharing information. Number-entry errors neither identify a
regular account for Cedar nor guarantee automatic popup closure. Newly migrated account
eligibility and delivery of its older chats remain real-provider acceptance checks.
The [Cedar connection work](../app/src/prototypes/cedar/connections/README.md) owns that
scope, current provider findings and acceptance. This supersedes the earlier design-only
restriction for those proofs. Its UX and proposed capabilities remain open to change;
shared-kit adoption and maintained-product integration remain separately selected work.
Earlier provider versions, account-status observations and forward-only history assumptions
below retain their historical date and must be checked against the current proof.

Peter, §208.1: «Connection setup first: WhatsApp, email and phone, fully, with the actual tools.» This is the both-sides contract for each rail: what the person does (the kit's seat), what the provider actually does (its real calls and webhooks), what the runtime does (events, tables, gates), what breaks and how it recovers, and how it is proven. Tools fixed: **Meta WhatsApp Cloud API** (Embedded Signup, through Rocoto-owned backend adapters; [backend/whatsapp_cloud.py](../backend/whatsapp_cloud.py) is the existing provider client), **Unipile** for the house's own mailbox, **Twilio** for the phone (THE-VOICE-CONNECTION-SPEC owns the wiring). Design, not build (§203.0). The kit's runtime is theatre (§204).

## CON-00 · The rule every rail obeys ([PRODUCT-SPEC §17.3](omitted-sources.md), kept)
- **The seat is a card:** a status, a connect button, a settings drawer. Four states and no fifth: `no configurado · conectando · conectado (prueba) · conectado (directo)`. The kit's Administration → Connections seat draws exactly these (E195/E200 as published: «Ready to connect», «Connecting», «Connected · test», «Connected»).
- **One sense, one event.** Every inbound on any rail becomes ONE event on the resolved party's scope. Identity resolves by `endpoint(kind, addr)` with an UPSERT bootstrap; a sender nobody knows becomes a prospect scope, never a silent drop. The junk gate runs BEFORE identity, so a newsletter never mints a contact.
- **Sending goes through the same rail it came from,** gated by the runtime's action layer (§5.0 step 7), never from a surface directly.
- **A down rail is the loudest aviso** (§17.23 «Canal caído»): WhatsApp + email to the owner, because a down door is silent lost orders. Every rail has a pause switch on its card.
- **Test and live** (§17.9): `conectado (prueba)` reaches the runtime with egress stubbed; `conectado (directo)` sends for real. The seat shows which, always.

## CON-01 · WhatsApp — Meta Cloud API by Embedded Signup

**The person.** In Connections, taps «Connect WhatsApp». Meta's Embedded Signup opens (a Meta-hosted dialog in the page, launched by Meta's JavaScript SDK with our app id and the signup configuration id); the person logs into Facebook, picks or creates the business, picks or creates the WhatsApp Business Account, enters or ports the phone number, verifies it by SMS or call. The dialog closes; the card reads `conectando`, then `conectado (prueba)`; a test message round-trips; the person flips to `directo` when ready. A house without a number of its own gets the shared Rocoto line (`agent_reply.py`'s +1 555 919 3021 today; a +34 line when Meta grants it) with `conectado (directo)` immediately and the customer-facing name «Rocoto · <house>».

**The provider, literally** (Graph API v21.0 — `whatsapp_cloud.py`'s `GRAPH`; the road proven end-to-end on 2026-07-28, commit `49e1e00d0`):
1. The SDK's signup returns a **code** and, by the dialog's message event, the `waba_id` and `phone_number_id` the person chose.
2. The backend exchanges the code for a **business token** bound to that WABA (Graph's `oauth/access_token` with the app id, app secret and the code — **verify against commit `49e1e00d0`, which proved this step; the exact call it made is the contract, not this sentence**). Stored encrypted (CON-05).
3. `GET /{waba_id}?fields=name,currency,account_review_status,message_template_namespace` → the card's display name and review state.
4. `POST /{waba_id}/subscribed_apps` → our app receives that WABA's webhooks (`whatsapp_cloud.py:605`).
5. `POST /{phone_number_id}/register` with a 6-digit PIN (`whatsapp_cloud.py:596`; the moment the number leaves any previous provider) → the number is live on the Cloud API. The PIN is stored (two-step verification) so a re-register is possible.
6. `GET /{phone_number_id}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier` → shown on the card; re-read daily.

**Inbound.** One webhook endpoint per environment (`/hooks/whatsapp`): `GET` answers Meta's `hub.challenge` when `hub.verify_token` matches; `POST` is accepted only when `X-Hub-Signature-256` equals HMAC-SHA256(app secret, raw body) — unsigned or mis-signed bodies are dropped and counted. Payload `entry[].changes[].value`: `messages[]` (text · image · document · audio · interactive replies · reactions · location) and `statuses[]` (sent · delivered · read · failed). Each message: junk gate → identity by `wa_id` → ONE `events` row (type `wa.message`, the raw payload kept) → the loop (THE-AI-SPEC §2). Media: `GET /{media_id}` → a short-lived URL → fetched once, stored under the tenant's encrypted store, the URL never kept. Audio → Deepgram transcript as today (`transcript`, `transcript_status` on `whatsapp_messages`).

**Outbound.** `POST /{phone_number_id}/messages` (`_post_messages`): text, media (upload by `POST /{phone_number_id}/media` first), interactive buttons and lists within Meta's limits (`IA_*` constants), reactions, typing indicators; template messages when the 24-hour customer-service window is closed (the house's approved templates, the «we message them first» flow). The sender is the house's number; `from_id` selects it (`sender_scope`). Every send is an event with the returned `wamid`; statuses close the loop.

**Failure and recovery.** Token expired or revoked → `conectado` drops to `conectando` with «Reconnect» on the card and the aviso fires; the signup runs again as `reconnect`. Webhook signature failures → counted, alarmed above a floor. Quality rating drops or messaging tier changes → shown on the card. Meta's 24-hour window closed → the runtime uses a template or holds the reply for the next inbound (the tab stays open). Rate limits → exponential retry with the event kept.

**Privacy.** Message bodies and media encrypted at rest per tenant (THE-IMPLEMENTATION-SPEC §9); the business token encrypted with the tenant's data key; retention per THE-RUNTIME-SPEC.

**Proof.** In staging with a test WABA: signup completes and the card walks the four states; an inbound text becomes exactly one event; a mis-signed webhook is dropped; an outbound text returns a `wamid` and its `delivered` status closes the tab; a revoked token flips the card and fires the aviso; the drive on the kit's seat covers the card's four states and the pause.

**What needs Peter.** Meta app review for Embedded Signup at scale (the app is a Tech Provider already — memory 2026-08-28), the +34 line, the message templates' approval.

## CON-02 · Email — Unipile, one door with the method inside

**The person.** In Connections, one card: «Connect your email». Inside it the method: **Gmail · Microsoft 365 · another mailbox (IMAP)** — or the address we give them to forward to (`pedidos+<tenant>@soyrocoto.com`) when they would rather keep their mailbox out of it. Tapping a method opens Unipile's hosted auth wizard in the same tab; the person grants; the wizard returns to the app; the card reads `conectando` while the first sync runs, then `conectado (prueba)`; a test mail round-trips; `directo` when ready. The kit already names the aggregator (`MAILBOX_AGGREGATOR = 'unipile'`, `email-provider.ts`) and draws the connection statuses.

**The provider, literally** (Unipile API v1, the house's DSN `https://api<N>.unipile.com:<port>`, `X-API-KEY` from the runtime's environment, never the browser):
1. **The link.** `POST /api/v1/hosted/accounts/link` with `{ type: "create" | "reconnect", providers: ["GOOGLE"] | ["MICROSOFT"] | ["MAIL"], api_url, expiresOn: now + 15 min, name: <tenant id>, notify_url: https://api.soyrocoto.com/hooks/unipile/connected, success_redirect_url, failure_redirect_url }` → `{ url }`. The runtime mints the link; the app redirects the person to it (never an iframe — Unipile's own advice).
2. **The callback.** Unipile calls `notify_url` with `{ account_id, name }` → the runtime writes `channel_connection(kind=email, provider=unipile, external_id=account_id, status=conectando)`; `GET /api/v1/accounts/{account_id}` confirms the mailbox address and the provider; the card shows the address.
3. **New mail.** One webhook registered once per environment through Unipile's webhooks endpoint (`POST /api/v1/webhooks` — source email, our request URL `https://api.soyrocoto.com/hooks/unipile/mail`, a secret header we check; **the exact field names are to be verified in Unipile's API reference before building — the payload below is verbatim from their docs, the registration call is not**) delivering the **new-email payload**: `email_id · account_id · event (mail_received | mail_sent | mail_moved) · date · from_attendee{display_name, identifier} · to/cc/bcc/reply_to · subject · body · body_plain · has_attachments · attachments[{id, name, extension, size}] · folders · in_reply_to · tracking_id · origin`. Only `mail_received` in `inbox` folders enters the runtime; `mail_sent` from another device is recorded as the house's own message on the thread (so a reply sent from their phone appears in our thread); `mail_moved` updates the thread's folder.
4. **The body and the attachments.** `GET /api/v1/emails/{email_id}` for the full object when the webhook's `body` is truncated; `GET /api/v1/emails/{email_id}/attachments/{attachment_id}` for each attachment's bytes (PDF · Excel · CSV · images) — these are the tabular shape (§17.3) and go to the document reader (THE-IMPLEMENTATION-SPEC §5). A link-only body is fetched as evidence, never truth.
5. **Sending.** `POST /api/v1/emails` (multipart) `{ account_id, subject, body, to[{display_name, identifier}], cc, attachments }`, `reply_to` set so the thread stays whole; the send is the house's own mailbox sending, so the customer sees the house's address. The scheduled exports (THE-OUTPUTS-SPEC OUT-01 email templates) use the same call with the attachment.
6. **Account status.** Unipile's account-status webhook: `OK · CONNECTING · CREDENTIALS · ERROR/STOPPED · DELETED · CREATION_SUCCESS`. Mapping: `CREATION_SUCCESS`/`OK` → `conectado`; `CONNECTING` → `conectando`; `CREDENTIALS` (the person revoked the grant, changed the password, an admin pulled the app) → the card drops to `conectando` with «Reconnect» (a `reconnect` hosted link) and the aviso fires; `ERROR/STOPPED` → the same plus a note to us; `DELETED` → `no configurado`.
7. **Disconnect.** «Disconnect» on the card → `DELETE /api/v1/accounts/{account_id}` → `no configurado`; the threads stay in our store per retention.

**The forwarding address** (the third method, for houses that will not grant a mailbox): `pedidos+<tenant>@soyrocoto.com` on our own inbound (the runtime's `inbound_mail` road with its provider decision from §17.3's build note — Postmark inbound, raw MIME with attachments). Same junk gate, same identity resolution by the original sender when the forward carries it, otherwise by the forwarding house with the customer named in the body.

**Inbound, in the runtime.** Webhook → the secret header checked → `inbound_mail(tenant, purpose, to_addr, subject, body_text, attachments, email_id, received_at)` → junk gate → identity by `endpoint(kind=email, addr=from.identifier)` → ONE event (`mail.received`, the raw payload kept) → the loop. The three body shapes (prose · tabular · link) land as the same event with the shape noted; the document reader runs on attachments; a parse that cannot be grounded becomes a review row with the attachment attached, never an order.

**Failure and recovery.** `CREDENTIALS` → reconnect road above; webhook missed → a nightly `GET /api/v1/emails?account_id&after=<last seen>` catch-up per account; duplicate deliveries → `email_id` is the idempotency key; attachment too large → the row says so and keeps the mail; Unipile down → the card shows `conectando` and the catch-up runs when it returns.

**Privacy.** Only inbox mail from known or new customer senders enters the runtime; newsletters and internal mail stop at the junk gate and are never stored. Bodies and attachments encrypted per tenant; the Unipile account id is the only provider reference kept. The person can disconnect and delete at any time (ADM-01 data page).

**Proof.** In staging with a test Google account: the hosted link opens and returns; `notify_url` writes the connection; a mail with a pasted grid becomes one event and a review row with the grid; a reply sent from the app arrives from the house's own address; a revoked grant flips the card within a minute and fires the aviso; the catch-up recovers a mail delivered while the webhook was down; the kit's drive covers the one door, the three methods and the four states.

**What needs Peter.** A Unipile account (the DSN and the API key into the runtime's environment), the Google and Microsoft OAuth apps' verification in Unipile's dashboard, the forwarding domain's inbound provider account.

## CON-03 · Phone — Twilio, per THE-VOICE-CONNECTION-SPEC

**The person.** In Connections, the phone card: choose the number model (VOICE-02: the house's own number ported or forwarded, or a Rocoto number), see the provisioning state machine's states (VOICE-02B) mapped onto the four card states, set who is called and when (behaviour's `calls: listen | after_hours | always`), and the recording consent line (VOICE-21).

**The provider, literally.** Twilio Programmable Voice: number purchase or port, the voice webhook to `/hooks/twilio/voice` (signature-verified with the auth token), TwiML for the live turn (VOICE-05A/B), dual-channel recording (VOICE-05C) to our store, status callbacks (VOICE-05E). Deepgram nova-3 for the diarised Spanish transcript (VOICE-18). The runtime's `voice_reply.py` and `voice_protocol.py` already speak to Anthropic for the turn.

**Today.** The house account answers `status 4 · not active` to both credential sets (2026-09-04); every voice road is dry-run proven only (RELEASE-193 onward). Reactivation is Peter's.

**Proof.** VOICE-23 as written; the kit's `drive-199-voice-real` pin holds in both postures (`drive-191-voice` is retired; its journeys live in `drive-199-voice-real`).

## CON-04 · The tables and events the three share

`channel_connection` today: `id · tenant_id · kind · provider · display_name · status · last_error · connected_by · connected_at · revoked_at · created_at · updated_at`. Additions (THE-SCHEMA-SPEC): `external_id` (WABA id · Unipile account id · Twilio SID), `endpoint_addr` (the number or the address), `mode` (`prueba | directo`), `credentials_enc` + `key_version` (the business token, the PIN; Unipile keeps its own credentials, we keep the account id), `last_seen_at`, `paused_at`, `webhook_failures`. `channel_number` for WhatsApp's number facts (display number · verified name · quality · tier). `endpoint(kind, addr)` unique for identity. Events: `wa.message · wa.status · mail.received · mail.sent · mail.moved · call.inbound · call.status · channel.connected · channel.dropped · channel.paused`, all on the party's scope, all append-only.

## CON-05 · The failure matrix, one table
| Failure | The card | The runtime | The person hears |
|---|---|---|---|
| provider token/grant revoked | `conectando` + Reconnect | inbound stops; outbound held; aviso «Canal caído» | WhatsApp + email to the owner |
| webhook signature invalid | unchanged | body dropped, counted; alarm above a floor | nothing (an attack, not a state) |
| webhook missed | unchanged | nightly catch-up (mail); Meta redelivers (WhatsApp) | nothing |
| provider outage | `conectando` | events queue; sends retried with backoff | the card's line |
| the person pauses the rail | `pausado` chip on the card | inbound stored, nothing sent | the card |
| rate limit / tier | unchanged | retry with backoff; the tier shown | the card's line |

## CON-06 · Proof plan
| Claim | Runs | Asserts |
|---|---|---|
| one inbound → one event | staging: send one of each shape on each rail | `SELECT count(*) FROM events WHERE …` = 1 per inbound |
| identity is one contact across rails | the same person mails and WhatsApps | one contact, two endpoints |
| the four states | the kit's connections drive; staging walks | the card's state equals the provider's |
| signatures | forged webhook bodies | dropped and counted |
| a down rail is loud | revoke the grant in staging | the aviso arrives on two rails within a minute |
| sends go through the gate | a surface act | one event with the provider id; nothing sent without the gate |

## CON-07 · What needs Peter before any of this is built
Meta app review for Embedded Signup at scale and the +34 line · a Unipile account (DSN, API key, OAuth apps verified) · the inbound provider for the forwarding domain · the Twilio account reactivated · the Anthropic credit for the turns behind every rail.
