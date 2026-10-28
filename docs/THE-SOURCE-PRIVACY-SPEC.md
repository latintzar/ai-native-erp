# Rocoto source privacy — production contract

**Canonical domain contract:** SRC-01 source intake and privacy boundary, used by INT-01 intelligence, DOC-01 documents, CAT-01 catalogue import, and email/provider adapters.

**Status:** build specification. It does not claim a mailbox, Unipile account, OAuth grant, storage service, provider receipt, or data-processing agreement is connected or approved.

**Version:** `2026-08-31/v1`.

This is the binding source-retention rule for Rocoto. It is deliberately narrower than a generic “secure storage” claim: Rocoto must not durably retain raw email bodies or raw email attachment bytes. A source can remain useful through an authorized provider reference and small reviewed business facts without becoming a second mailbox or a shadow file store.

## SRC-PRIV-00 · The invariant

Rocoto does **not** durably write raw email body content, rendered HTML, MIME parts, inline images, attachment bytes, raw OCR/transcription, or raw reply drafts to:

- its database, object/blob store, browser local/session storage, IndexedDB, Cache Storage, service-worker cache, or local file system;
- commands, events, projections, outbox records, retry queues, dead-letter queues, job payloads, provider-webhook archives, backups, exports, search indexes, analytics, metrics dimensions, error reports, or application logs; or
- retained model prompts, model traces, evaluation datasets, screenshots, test fixtures, support bundles, or public documentation.

“Encrypted” does not make an otherwise prohibited Rocoto copy acceptable. “Hash” does not permit a raw body or file to be retained; a keyed, scoped fingerprint may be used only where this contract says it may, with access/re-identification review. A browser may hold raw bytes or text transiently only while an authorized user is actively viewing, selecting, or composing; it must not persist or queue them for reload/retry. The narrow exception in `SRC-PRIV-07` is a policy-approved, one-shot server-to-model extraction of a minimised source view. It is not an ordinary chat prompt, has no browser access or model tools, and is excluded from all retained prompt/tracing/evaluation/output paths.

A derived business fact remains durable when it is independently reviewed or produced by a deterministic, auditable extraction rule and contains no raw source text. Examples: a selected SKU identity, reviewed quantity/unit/price, source arrival time, attachment count, delivery status, or a source-bound evidence locator. The durable fact must say its source reference, extraction/review method, actor or release, time, revision, and confidence/abstention where relevant.

## SRC-PRIV-01 · Data classes and retention

| Class | May Rocoto retain it? | Required handling |
|---|---|---|
| Raw email plain text, HTML, headers with content, MIME, inline image, attachment bytes, provider draft body | **No** | Provider-backed only; on-demand, authorized fetch/stream; `Cache-Control: no-store`; no client persistence. |
| Raw attachment filename, subject or sender display value | Not as a general durable source copy | Return transiently only to an authorized view. Persist an approved business label only if needed, classified and justified. |
| Provider account id, provider email id, RFC822 Message-ID, folder id, native link | Never expose or use as the Rocoto durable public identifier | Server maps them to tenant-scoped opaque refs. Native links are short-lived view values and are not events. |
| `source_ref`, `account_ref`, provider kind, source revision, provider change token, received/sent time, access class, lifecycle state | Yes, minimum necessary | Opaque, tenant-scoped, access-controlled; no raw provider id in browser or ordinary audit views. |
| Evidence field/result | Yes, after policy | Typed derived fact, source ref/revision/locator, sensitivity, expiry, extraction/review lineage. No raw quote by default. |
| Operator-authored note, accepted actual quantity/unit price, approved customer option, tariff/stock fact | Yes, when a domain rule authorizes it | Business record with its own event/audit lifecycle; it is not an email copy. |
| Direct operator upload/photo not delivered by email | Only under a separate explicit asset-retention policy | Consent, purpose, tenant scope, encryption, malware scan, retention/deletion and access policy are required. It must never be silently treated as an email attachment. |
| Synthetic demo/test asset | Yes, only as clearly synthetic fixture material | No customer/tenant source; no production-like identifiers or hidden raw samples. |

## SRC-PRIV-02 · Source reference envelope

A durable source association is an opaque reference, never a body or binary payload:

```json
{
  "schema_version": "source_ref.v1",
  "tenant_id": "ten_…",
  "source_ref": "src_…",
  "source_kind": "email_message",
  "provider": "gmail|outlook|imap|forwarded|operator_upload",
  "account_ref": "acc_…",
  "source_revision": 7,
  "observed_at": "2026-08-31T09:14:00Z",
  "access_class": "restricted_source",
  "content_state": "provider_backed|session_only|unavailable",
  "derived_fact_refs": ["evd_…"],
  "expires_at": "2026-09-01T09:14:00Z"
}
```

`source_ref` and `account_ref` are tenant-scoped aliases owned by Rocoto. The backend alone resolves them to provider account/message identifiers. A reply or a native-open request must fail closed if the alias is absent, belongs to another tenant, has been disconnected, is stale, or is not authorized for the current actor/purpose.

A source reference is not proof that content is still readable. `content_state` is shown exactly as **Available in the connected mailbox**, **Available for this browser session**, or **Source unavailable — select it again**. It is never shown as “saved” when Rocoto only retained a reference or an expired session key.

## SRC-PRIV-03 · On-demand read and attachment stream

1. The client requests a source viewer using an opaque `source_ref` and declared purpose (`view_conversation`, `view_attachment`, `review_paper`, or `prepare_reply`).
2. The server authenticates actor, tenant, role, record scope, provider account state, and purpose; it resolves the alias server-side.
3. The server fetches only the required content/attachment from the provider, sanitizes untrusted HTML to safe display text, streams it with `Cache-Control: no-store`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`, and a restrictive content-disposition/CSP policy.
4. The client may render the result in memory. It must not create a durable Blob/IndexedDB/localStorage copy or background retry.
5. Access audit stores `source_ref`, actor, purpose, policy result, timestamp, byte-range class and outcome — never body text, URL, filename, or bytes.

An attachment endpoint is an authenticated, same-origin opaque path such as `GET /v1/sources/{source_ref}/attachments/{attachment_ref}`. It streams the provider response only after authorization and malware/content policy. A provider URL, pre-signed URL, raw email URL, or `data:` URL must not be copied into a durable record or generated from untrusted source text.

For an attachment too large, unsupported, unsafe, expired, or not currently readable, the UI says what happened and gives the next safe action: **This attachment is unavailable in the original mailbox. Open the mailbox or ask for the file again.** It never fabricates a download or substitutes a cached copy.

## SRC-PRIV-04 · Native mailbox opening

> **Superseded by [THE-OUTPUTS-SPEC.md](THE-OUTPUTS-SPEC.md) OUT-05.3** (E200 · FEED-IA §202).
> The in-app thread rendered from the authorized source reference leads; the provider mailbox is the fallback. The history below is kept.

The messages workspace and embedded source trail have two separate actions:

- **View conversation** opens Rocoto’s authorized workspace view.
- **Open in Gmail** or **Open in Outlook** opens the provider mailbox in a new tab.

The server may return a short-lived provider `webLink`/native link after resolving the opaque ref. The client validates HTTPS and a provider-owned allowlist before opening it. It must not construct a message/thread URL from a provider message id. If an exact provider link is unavailable but the provider kind is known, **Open Gmail** opens `mail.google.com` or **Open Outlook** opens `outlook.office.com`; visible help says **Opens Gmail/Outlook. The exact message link is unavailable.** A forwarded email has no invented native mailbox link and says **Forwarded email · Reply in the original mailbox.**

Opening a mailbox is navigation, not a provider write and not evidence of a connected Rocoto account. It does not expose tokens, native URLs, account ids or message ids in logs, analytics, history state, screenshots, or durable records.

## SRC-PRIV-05 · Connected reply contract

The browser has no provider credential. A reply is available only when the backend returns a current, actor-authorized capability for the opaque source ref. A fixture owner flag, address, account label, Settings toggle, email channel, or visible source row never authorizes it.

```json
{
  "schema_version": "email_reply_request.v1",
  "source_ref": "src_…",
  "plain_text": "transient operator draft only",
  "idempotency_key": "idem_…"
}
```

The request body is processed in memory by the authenticated backend and must be redacted before all request/error logging. The durable command/outbox contains the opaque source/account refs, command id, idempotency key, policy/revision result, and later provider receipt ref — not `plain_text`, HTML, recipients, headers, or attachment bytes. A draft remains browser-memory-only until an explicit provider draft action is separately authorized. It disappears on reload; this is shown before the operator relies on it.

The reply state uses exact copy:

| State | Exact operator copy | What happened / next action |
|---|---|---|
| `connection_required` | **Gmail/Outlook is not connected for this message. You can view the conversation or reply in Gmail/Outlook.** | No provider call occurred. |
| `read_only` | **Forwarded email · Reply in the original mailbox.** | No provider call is possible through Rocoto. |
| `ready` | **Reply in Rocoto** / **This reply is sent only after the connected mailbox accepts it.** | A real backend capability exists; compose remains transient. |
| `sending` | **Sending through Gmail/Outlook…** | A request is in flight; do not infer delivery. |
| `accepted` | **Reply accepted by Gmail/Outlook.** | Only after a backend/provider acceptance receipt. Later mailbox sync may reconcile the sent item. |
| `failed` | **We could not send the reply. It is still in the editor.** | No local “sent” message is appended; retry or open mailbox. |

A reply must bind the provider’s correct in-thread identifier server-side. The implementation may not take a message identifier from browser fixture state. Recipient changes, attachments, bulk/transactional sends, scheduled sends, and marketing sends are separate policies and commands; they do not inherit authority from a manual in-thread reply.

## SRC-PRIV-06 · Unipile status and provider constraints

No Unipile adapter, API key, OAuth grant, account connection or provider receipt is present in the current Rocoto workspace. Unipile remains a candidate integration, not a live connection.

Official Unipile documentation currently says Gmail and Outlook accounts are linked through OAuth, while other mail accounts use IMAP/SMTP; Hosted Auth supports email providers with `*:EMAILS`. It also says that enabling IMAP Initial Sync downloads and stores account emails encrypted on Unipile infrastructure. Therefore this contract promises zero durable raw email retention by **Rocoto**, not zero retention by Unipile, the mailbox provider, browser, backups, or other processors. Procurement must record DPA/subprocessors, region, Initial Sync setting, backup/deletion behaviour, incident handling, and approved scopes before activation. [Unipile: link email accounts](https://developer.unipile.com/v2.0/docs/link-email-accounts)

For a direct in-thread reply, Unipile v2 requires `reply_to_message_id`: Gmail and Outlook use the Email object provider `id`; IMAP uses the RFC822 `Message-ID`. Outlook does not support creating a draft as a reply to an existing message. Those identifiers remain server-side behind `source_ref`; Rocoto does not persist them in browser state. Unipile documents attachment content as base64 for its send endpoint, so an authorized attachment send must stream/transform transiently with strict limits and no Rocoto blob or retry copy. [Unipile: create and send emails](https://developer.unipile.com/v2.0/docs/send-emails), [Unipile: v2 email migration](https://developer.unipile.com/v2.0/docs/migration-emails-api)

Unipile webhook payloads can include an upserted Email object for `email.new`. Verify signature/replay protection at ingress, then immediately reduce the event to an opaque reference/change notification. Do not archive the vendor payload or send it into queues/traces. Use account connection events to establish runtime availability, not a UI toggle. [Unipile: event types](https://developer.unipile.com/v2.0/reference/event-types-1)

Hosted Auth links, API keys and callbacks belong to an intermediary backend, never the browser. The backend creates a time-limited link and receives the account callback; it maps the result to a Rocoto account alias. [Unipile: Hosted Auth](https://developer.unipile.com/docs/hosted-auth)

Unipile’s public documentation reviewed for this contract does not establish a portable, provider-neutral exact-message deep-link API. Do not invent Outlook/Gmail thread URLs from IDs. Use a provider-returned, host-validated link if available; otherwise open the official mailbox home with the explicit fallback copy in SRC-PRIV-04.

## SRC-PRIV-06A · WhatsApp connection boundary

WhatsApp access starts forward-only at the accepted connection time. Rocoto must never request, ingest, backfill, display, retain or imply access to any earlier WhatsApp conversation history. This applies equally to setup, settings, source search, conversation cards, testing, support and learning. Historical inputs may be explicitly supplied delivery notes or product, customer or catalogue files under their own review and retention rules; past WhatsApp content is never an eligible historical input.

## SRC-PRIV-07 · Webhooks, jobs, logging and LLM boundary

A provider webhook handler must:

1. authenticate the sender and verify a bounded replay key before any work;
2. reject/ignore malformed, cross-tenant and replayed callbacks without retaining raw payload;
3. resolve only a provider account alias and minimal change class; and
4. emit a durable `source.changed`/`source.unavailable` event containing opaque refs, sequence/revision, policy result and timestamp only.

No raw email content, body-derived snippet, attachment name, native URL, provider message id, token, or serialized webhook is allowed in application logs, structured errors, tracing attributes, queue payloads, alerts, retained model prompts, evaluation fixtures, or support exports.

The ordinary LLM context resolver receives only purpose-authorized, redacted, bounded derived facts. It cannot fetch an email body or attachment itself. A separately approved `source_extraction` release may receive one server-supplied, minimised transient source view only when its purpose, source class, provider data-handling setting, size ceiling, redaction policy, strict typed output schema, and no-retention controls have passed policy. It has no network or command tools, cannot retrieve another source, returns only a typed fact with `source_ref`, `source_revision`, locator class, redaction/sensitivity version, expiry, and review status, and is excluded from prompt logs, telemetry, retries, evaluation data, output text, and durable model-run records. When a reviewer needs to see a source, that remains a separate human viewer action. Every source-derived value is untrusted data, never policy or instructions.

## SRC-PRIV-08 · Supplier, catalogue, upload and paper-photo flows

| Flow | Current safe behaviour | Production requirement |
|---|---|---|
| Supplier email list | A scheduled list is visibly **not sent** without a verified delivery service. The UI cannot create a local sent record. | Provider command through authorized outbox; receipt-backed delivery only; body/attachment not persisted by Rocoto. |
| Email-delivered catalogue/price sheet | Retain provider ref and explicitly reviewed literal SKU facts/result/decision only. Do not copy attachment bytes or parsed full cells to browser storage; no mapping screen precedes review results. | On-demand stream after authorization; reviewed provenance event; source reselect/refetch required to rebuild original layout. |
| Direct catalogue file intake | The selected file and any raw cells live only for the active browser session. E186 retains only a minimal source checksum/reference, row locator and explicitly reviewed literal SKU facts/result/decision; it has no field-mapping screen before results. | Explicit direct-upload asset policy if long retention is needed. Never inherit email-attachment storage rights. |
| Pasted catalogue text | Raw pasted text is active-session-only and is cleared on reload/close. E186 may retain only a scoped text fingerprint, item locator and explicitly reviewed literal SKU facts/result/decision. | Do not put pasted text in local/session storage, logs, model traces, retries or exports. Require a fresh paste when the source is unavailable. |
| Original catalogue export | Available only while the selected source remains in the browser session; after reload says **Select the source file again to download it.** | May fetch from a provider reference after authorization; never fabricate a previously stored download. |
| Working albarán photo | Image bytes and its chosen filename are session-only; durable review baseline/fingerprint/opaque source ref/actuals persist. After reload, an incomplete review says **The photo is gone from this session. Add it again to finish the review.** A matching completed review says **The photo is gone from this session. Your completed review is saved.** | Explicit operator-photo asset policy or provider reference; OCR stays proposed/review-only; no automatic final paper. |
| Email attachment used as paper/photo evidence | Reference-only. | The operator must open/stream it from the provider or deliberately reselect a direct upload under separate consent. |
| Supplier/new-product note | A note may persist only as an operator-authored/reviewed business fact with audience/provenance. | It must not auto-create a SKU or expose an internal note to a customer confirmation. |
| Accepted off-SKU sale item | Retain only the accepted Albarán/source reference, literal wording/unit, actor/time and explicit keep-in-Products decision. Product Requests opens that exact source line through the authorized object door. | It must not retain a second raw source copy, promote itself to a SKU/ERP master, or infer a relation from text/category/repetition. |

A paper review is final only after a still-current, explicit **Finish review** acknowledgement and a later canonical print. Losing session-only photo bytes after reload does not retroactively invalidate an already accepted acknowledgement when its checked document fingerprint and durable source reference still match; the UI says the photo is unavailable and blocks a new or replacement review until the source is selected again. Replacing the source or a material document change invalidates the acknowledgement. A photo attach, OCR-like preview, print preview, or browser reload never by itself marks paper final.

## SRC-PRIV-09 · Legacy migration and deletion

The migration is non-destructive by default:

- New code does not write raw bytes to IndexedDB/localStorage and does not reopen legacy raw photo/catalogue blobs.
- A legacy source reference is shown as unavailable; its reviewed figures/mapping remain usable only if they contain no raw source content.
- Rocoto must not claim that legacy bytes were deleted merely because metadata was reset or the UI cannot read them.
- An explicit, authorized privacy control may invoke a named legacy cleanup. It must state the exact source class/device scope, require confirmation, report success only after the browser/provider confirms it, and report blocked/failure honestly. It cannot affect another tenant.
- Provider disconnect revokes new access and removes opaque aliases/capabilities according to the tenant retention policy. It does not claim to delete the provider’s own mailbox copies; the user receives the provider-specific next action.

**Current-kit migration boundary.** New paper-review and catalogue-import records write an opaque `source_ref` plus reviewed business metadata; selected filenames, column labels, original layout and bytes remain only in session memory. Historic browser records may still contain old labels or filename-derived keys. The feature neither opens their raw bytes nor re-exposes those labels, and it does not rewrite/delete them on boot. An explicit, authorized device cleanup remains required before a house can claim its old local records were removed; its storage scan must prove the result.

## SRC-PRIV-10 · API and policy gates

Before a source/provider integration reaches shadow, all of the following must pass:

- server-issued opaque source/account refs; tenant/actor/purpose authorization; expiry and reconnect checks;
- provider-id and credential isolation from browser, logs, event streams and model context;
- `no-store` source/attachment viewer headers and no persistent client cache;
- exact-message native link host validation plus mailbox-home fallback copy;
- in-thread reply idempotency, receipt state, reconciliation, timeout/failure preservation and no-local-sent proof;
- webhook signature/replay/cross-tenant/redaction tests; and
- synthetic-only fixture/evaluation evidence with raw source leak scanners over events, logs, queue payloads and LLM traces.

The following are proposed design gates, not measured service claims: zero raw-source fields in durable Rocoto storage scans; zero raw-source fields in LLM/evaluation/log scans; 100% denial for cross-tenant or expired source refs; and 100% visible “sent” states backed by the correct provider/recipient receipt.

## SRC-PRIV-11 · Builder tasks and acceptance matrix

| ID | Deliverable | Acceptance evidence |
|---|---|---|
| SRC-PRIV-T01 | Opaque source/account reference service | Cross-tenant, stale, disconnected and unauthorized ref tests fail closed; no provider IDs in client DTO. |
| SRC-PRIV-T02 | Authorized on-demand source/attachment gateway | Stream/no-store/redaction headers, MIME/size/malware rejection and no durable cache test. |
| SRC-PRIV-T03 | Native-mailbox adapter | Valid provider link opens; invalid host rejected; Gmail/Outlook home fallback says exact link unavailable; no invented URL test. |
| SRC-PRIV-T04 | Connected reply backend | Correct threading id server-side, idempotency/receipt/reconciliation/timeout tests, no local sent row and no raw body in durable audit/outbox. |
| SRC-PRIV-T05 | Webhook reduction pipeline | Signature/replay/tenant tests plus raw-payload leak scan. |
| SRC-PRIV-T06 | Supplier/campaign outbox boundary | No provider means no send state; recipient/approval/idempotency/receipt/partial-failure tests. |
| SRC-PRIV-T07 | Direct upload/paper/catalogue policy | Storage scan proves new records have opaque refs but no source filename, columns/header, raw bytes or filename-derived browser key; session-only current-kit tests; reload requires reselect for a new/replacement review while fingerprint/reference-matched accepted review remains attributable; explicit asset-policy alternative; legacy cleanup confirmation/failure test. |
| SRC-PRIV-T08 | LLM/privacy evaluation | Prompt/trace/log/fixture leak scanners and untrusted-source injection cases pass before shadow. |

No external email/provider write is authorized by this document. Connecting an account, sending a reply, storing an asset, running a sync, enabling Initial Sync, deleting a provider message, or purging a legacy store requires the separate actor authorization and production rollout approval defined by the architecture and release contracts.

## SRC-PRIV-12 · Unified camera, file and paste intake

New Product and New Albarán use one source grammar. On a phone the three equal actions are **Take photo**, **Upload file**, and **Paste**. On a desk the first action may open an attached camera when the browser exposes one, while ordinary files remain droppable/selectable and pasted rows remain available. All three sources land in the same structured review; a source does not create a SKU, an Albarán line, stock, a lot, or a price by itself.

Once selected, the source is one contained evidence card inside the current task. It names the source class and honest review state, never a reconstructed filename. **Remove** discards only the active session source; **Replace** reopens file/paste choice; a camera source uses **Retake photo**. The card stays visible through the immediate draft handoff and when Back returns to source review. Removing, replacing, closing, or session-byte expiry cannot silently keep an extraction proposal as accepted evidence. Keyboard focus returns to the invoking source action after removal/cancel, and to the evidence card after a successful replacement.

The source lifecycle is:

1. The browser captures a photo, selected file, or pasted text into active-session memory.
2. Rocoto durably writes only an opaque source reference, source class, MIME class, byte count, capture time, tenant, target draft, and later reviewed facts. The filename and bytes remain session-only.
3. A production extraction service may read one authorised, size-bounded transient source and emit typed proposals. OCR text, document pixels, and pasted raw text are never a durable event, queue payload, log value, analytics value, or model trace.
4. The review shows the source beside proposed rows. A person can correct product, quantity, unit, price, lot, or customer before accepting. Each accepted field records source reference, locator, extractor version, confidence/abstention, reviewer, time, and document revision.
5. Missing, conflicting, or low-quality values stay unresolved. They never become zero, an invented SKU, today's date, a made-up lot, or a silently selected product.
6. A reload keeps reviewed business facts and the opaque association. It says that the source must be selected again if the bytes are no longer present.

A mobile camera input uses the rear-camera hint, but the UI still supports the ordinary system picker. It must survive denial, cancellation, HEIC/JPEG/PNG rotation metadata, a landscape document, low light, and a source larger than the configured ceiling without losing the draft. Camera permission is requested only after **Take photo** is pressed.

The same contract applies to a photograph of a handwritten Albarán and to a photograph used for New Product list intake. New Product review asks for literal SKU, name and Unit first; category, related products and artwork remain separate editable product facts. The extraction may propose them but cannot establish them.

This section does not authorise WhatsApp-history import. WhatsApp remains forward-only from connection time under SRC-PRIV-06A.
