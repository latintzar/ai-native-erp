# Cedar email: working integration and product implementation

Owner: Cedar. Focused surface: **the channels check page**, served at
[cedar-channels.soyrocoto.com/check](https://cedar-channels.soyrocoto.com/check/), and the Cedar
workspace on the same origin. This document records the implemented integration, its actual
evidence and the concrete work for using it in Cedar's full UX, in the shape of
[the WhatsApp document](connections/IMPLEMENTATION.md). The runtime contract is
[EMAIL-IMPLEMENTATION.md](EMAIL-IMPLEMENTATION.md); the measured steps are in
[the commissioning brief](../../../../docs/omitted-sources.md);
which turns draw as email and where a reply leaves from is [CHANNEL-SEMANTICS.md](CHANNEL-SEMANTICS.md).

Peter's words, [FEED-IA §245.13](../../../../docs/FEED-IA.md#24513--the-hybrid-connection-prelinked-to-a-customer-specced-like-whatsapp-14-september):
«get it into cedar with a hybrid real connection meaning if i connect my email and send an email
from peter@soyrocoto.com it's "prelinked" to a customer so it appears in chats. and then if i
reset seeded state AND disconnect it removes the connection … the order brain should actually
work in practice.»

## Implemented and observed

On 13 September 2026 Peter connected his Gmail through Unipile's hosted sign-in from the check
page; the runtime bound the account to his workspace and listed it with its address. Two order
mails with PDFs sent from `peter@soyrocoto.com`, the address registered as the customer Bar
Latintzar, were queued by the filtered pull and listed in the customers view with
`customerId:"latintzar"`; the attachment route returned `pedido-viernes.pdf` as the file (33,485
bytes, `%PDF-`); the reply route sent «Recibido, gracias…» from the connected Gmail and the
company inbox received it as `Re: Pedido Bar Latintzar viernes` with `In-Reply-To` set, in the
same thread; the same idempotency key returned the same receipt with one provider send.

On 14 September the filters were measured through the product route (customers 6, all mail 30
named rows plus 20 placeholders per page, `pedido` 24, `pedido has:attachment` 7,
`subject:viernes` 8); the check page became a mail client (list, threads as written in a
sandboxed frame, files, rich-text reply, reply all, forward, a composer with files); a composed
message with the order PDF reached the company inbox from Peter's Gmail with the file attached,
and Peter sent from the page himself. Rich text on a reply is proven by the runtime's own fixture
(`html` travels beside `text` to the provider) rather than by a measured live reply. Main carries
the read rail as `2d2263c3` (PR #101) and the mail client, the HTML body, rich text and
`in_reply_to` as `04a69c9c` (PR #103). Every count above is a runtime answer read back, never a
local append.

## Source and product destinations

- Runtime: [cedar_email.py](../../../../mock-api/app/cedar_email.py) (routes),
  [cedar_email_provider.py](../../../../mock-api/app/cedar_email_provider.py) (Unipile v2),
  [cedar_email_store.py](../../../../mock-api/app/cedar_email_store.py) (opaque aliases only).
- Browser contract: [email-api.ts](email-api.ts) over the unchanged types in
  [email-provider.ts](email-provider.ts); the source projection in [email-model.ts](email-model.ts).
- Reference surface: [channels-check/app.tsx](channels-check/app.tsx) — the list rows, the thread
  pane with the sandboxed HTML frame and file chips, the Reply / Reply all / Forward compose box,
  the rich-text editor and the docked composer are the behaviour to carry into Cedar.
- Product destinations: the customer's chat (turns), the customer screen (Send email), Connections
  → Email and the onboarding channel step (tiles with the provider marks), Settings (reset).
- **The prelink** lives in the cast, [`cast.ts`](../../scenarios/data/cast.ts)
  `FISH_PROOF_ACCOUNT`: Bar Latintzar (`latintzar`, the last row of the fish book) carries
  `peter@soyrocoto.com` and `+12025550110`, Peter's own test channels, so a real message from
  them lands in that customer's chat the moment a mailbox or a number is connected. The connections
  screen pushes one `POST /email/accounts/{ref}/customer-binding` per customer address before the
  first sync (PR #94), so the bindings exist from the first open of the connected mailbox, with
  nothing special in the runtime. A house whose real customers have real addresses gets the same behaviour
  from its own book.

## Actual API contract

All routes under `/api/cedar/email`, HTTPS on the preview origin. The owner's workspace bearer
authorizes every route below except three: `GET /callback` is the hosted sign-in's return and
consumes its one-time attempt, `POST /operator/customer-binding` takes the operator key, and
`POST /webhook` verifies Unipile's signature and carries nothing into the queue.

| Route | What it answers |
| --- | --- |
| `POST /auth` `{provider, return_to}` | the hosted sign-in link; `return_to` is `onboarding`, `settings` or `check`; the link asks to read and send only |
| `GET /callback` | binds the account to the workspace after the sign-in, redirects to the return target |
| `GET /status` | `configured`, `accounts[]` with `account_ref`, `provider`, `mode`, `status`, `label` (the address) |
| `POST /accounts/{ref}/customer-binding` `{address, customer_id}` | the private customer match for that address |
| `POST /accounts/{ref}/sync` `{}` | the customers view: whole messages exchanged with the workspace's known customer addresses (the first 50 of them), newest first, capped at 50 messages; each with `customerId`, `snippet`, `unread`, `attachments[]`, `replyable`; `bound:n` counts every known address, `unnamed:n` the rows the mailbox listed empty |
| `POST /accounts/{ref}/sync` `{scope:"all"}` / `{query}` | the newest mail paged (meta-only, `refresh:true` restarts) / the mailbox's own search on whole messages |
| `GET /intake?after=…&limit=…` | arrivals queued by the filtered pull (every minute, only new mail from known customer addresses dated after the connection) |
| `GET /sources/{ref}/thread` | the thread newest-first, each message with `body`, `html` (as written, minus what could run), `attachments[]` |
| `GET /sources/{ref}/attachments/{att}` | the file's bytes |
| `POST /sources/{ref}/attachments/{att}/parse` | order lines from a PDF through the albarán reader (`PARSEWISE_API_KEY` on the runtime) |
| `POST /sources/{ref}/reply` `{text, html, idempotency_key}` | a reply from the connected mailbox to the customer who wrote, threaded; known customers only; the key is reserved before the send |
| `POST /accounts/{ref}/send` `{to, cc, subject, text, html, attachments, in_reply_to, idempotency_key}` | a composed message from the connected mailbox to any addresses, files base64 under 6 MB, threaded under `in_reply_to` |
| `DELETE /accounts/{ref}` | the provider forgets the account, then the runtime purges aliases, cursors, bindings and receipts |

## Exact UX and state behavior

1. **Connect.** Connections → Email or the onboarding channel step shows Gmail and Microsoft 365
   tiles with their own marks (`/connection-brands/gmail.png`, `/connection-brands/microsoft.png`,
   [CHANNEL-BRANDS.md](../../../public/connection-brands/CHANNEL-BRANDS.md)) and the forwarding
   tile. A tile opens the hosted sign-in; the return lands on the screen it left; the connected
   mailbox shows its address, state and Disconnect; a second connection of the same mailbox is a
   second row.
2. **Bind.** The first open of a connected mailbox pushes the bindings; `bound:n` on the next sync is
   the proof. A mailbox connected through onboarding gets the same push.
3. **Chats.** The customers view draws as turns in each customer's chat: sender, time, the
   mailbox's own `snippet`, file chips. A list read carries no body — `body` and `html` arrive with
   the thread read — so opening a turn reads its thread and shows the message as written, `html` in
   a sandboxed frame sized to its content, the frame the check page uses; its files open as files.
   Turns are threaded under their conversation in the order the thread read gives. New arrivals
   land at the top of the chat by themselves: the list re-reads every thirty seconds and whenever
   the tab becomes visible again; there is no separate «arrivals» control.
4. **Answer.** The mailbox reports `canSend:true` and `replyAvailability` ready for a source read
   from it, so the existing composer path is live. ⚠ **What each door carries.** The shared
   contract `EmailReplyRequest` in [email-provider.ts](email-provider.ts) carries `plainText` and
   an idempotency key and nothing else, so the standing's `sendReply` sends plain text. Rich text
   and files reach the mailbox through [email-api.ts](email-api.ts) directly —
   `replyToEmail(source, text, key, html)` for a reply, `sendEmail(account, {to, cc, subject, text,
   html, attachments, in_reply_to})` for everything else — which is what the check page uses. A
   rich-text conversation composer therefore either calls those two, or `EmailReplyRequest` grows
   `html` and `attachments`: a deliberate change to the shared contract, made with its consumers
   ([reply-channel.ts](reply-channel.ts), [email-thread.tsx](email-thread.tsx)), never a
   work-around. Reply all and Forward are the same composer with recipients, the `Re:` or `Fwd:`
   subject and the quoted original prefilled, forwarded files carried, `in_reply_to` set for a
   reply. «Send email» on the customer screen opens the composer addressed to the customer and
   sends through `sendEmail`. The thread shows the reply when the mailbox lists it; nothing is
   appended locally. While the mailbox is a forwarding one, the composer states where the reply
   leaves from, as [CHANNEL-SEMANTICS §2](CHANNEL-SEMANTICS.md) requires.
5. **Disconnect.** Connections → Email → Disconnect: the provider forgets the account first; the
   runtime purges the local record; the mailbox's own mail is untouched; the standing reports
   `unverified` and the tiles offer connection again.
6. **Reset.** «Reset workspace data» returns the seeded book to its seed and keeps the connection.
   «Reset and disconnect everything» runs every provider's own disconnect and clears a connection's
   local mirror only when the provider answered ([workspace-reset.ts](workspace-reset.ts), FEED-IA
   §247.6). After it, Bar Latintzar is back in the seeded book with its addresses, the mailbox is
   gone at the provider, and connecting again walks step 1 onward.
7. **Mail area (open call).** Mail from people who are not customers is what `scope:"all"` and
   `query` answer. Whether Cedar gets a plain Mail area for it, or stays customer-only, is Peter's
   call; the runtime supports both today.

## Backend invariants demonstrated by the proof

- Rocoto's servers receive only what was asked for: customers' mail by default, an explicit page
  of all mail or a filter's matches, and — unasked — only arrivals from known customer addresses
  (FEED-IA §245.7). Unipile holds the whole mailbox and carries the query; Google or Microsoft
  answer it; no webhook endpoint is registered.
- Nothing of the mail is retained: opaque aliases, provider ids, timestamps, a digest of an
  attachment's name and type, the exact bound customer addresses, and a send's receipt. Bodies,
  subjects, names, HTML, files and reply text are transient answers.
- A message is served as written with scripts, frames, forms, handlers and script URLs removed;
  the browser shows it in a sandboxed frame. Outgoing HTML is sanitized the same way.
- A reply or a send happens once per idempotency key: the key is reserved before the send, a
  repeat returns the first receipt, a concurrent repeat learns the message is on its way.
- A reply leaves only from a connected mailbox (a forwarding mailbox answers 403) and only to a
  known customer; a composed message leaves only from a connected mailbox, to the addresses the
  business chose.
- A file is recognised inside its message whichever id the provider hands out on a read; two
  same-named files in one message stay two files.
- A page keeps the rows the mailbox named and counts the placeholder rows it listed empty.
- Disconnect is provider-first; the local purge follows the provider's answer; a workspace that
  expired or was reset is left unread by the pull.

## Using real conversations for product intelligence

A turn that carries an order goes through the order brain exactly as a WhatsApp turn does
([SOURCE-INTAKE-IMPLEMENTATION.md](SOURCE-INTAKE-IMPLEMENTATION.md), «Structured order reading»):
its text through `POST /api/cedar/orders/parse` with the server-selected customer and the source
day; its PDF through the attachment parse route, the albarán line reader. The result draws as the
order widget on the turn — the widget WhatsApp turns use — with the Delivery Note in review, and
the chat is where the person confirms it. The order PDF that reached the connected Gmail on 13
September is the fixture of that walk. On the preview both readers wait for a credential:
`GET /api/health` answers `parsewise: missing` (the PDF line reader, `PARSEWISE_API_KEY`) and
`copilot: awaiting key` (the text order reader, `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`). Neither
is in the Rocoto vault, so both are Peter's to supply before this walk runs live.

## Live workspace intake

Email intake reads `GET /email/intake?after=<cursor>&limit=50` and applies each row to the day
ledger as one idempotent `source-arrive` event keyed by channel and source reference, advancing
the cursor only after every event in the page is durable — the rule WhatsApp and phone use.
Arrivals come from the filtered pull, so a row is always mail from a known customer address dated
after the connection; historical mail is read through the customers view and the thread, never
through the queue. The check page shows the same arrivals as rows landing at the top of the list.

## Integration sequence and acceptance

1. Connections and onboarding tiles carry the provider marks; the hosted sign-in returns to the
   screen it left; the connected mailbox shows its address; two connections are two rows.
2. After the first open, `bound:n` counts every customer with an address, Bar Latintzar included.
3. Bar Latintzar's chat lists the mail exchanged with `peter@soyrocoto.com` as turns with snippets,
   unread weight and file chips; a turn opens as written; a file opens as a file.
4. A new mail from `peter@soyrocoto.com` lands at the top of the chat within a minute of the pull
   with no button pressed; the ledger holds one `source-arrive` for it.
5. An order PDF on a turn draws the order widget with its lines and the Delivery Note in review;
   an order in the text does the same through the order brain.
6. A reply written in the chat, rich text and a file included, arrives in the customer's inbox from
   the connected mailbox, threaded; the chat shows it when the mailbox lists it. Reply all, Forward
   and «Send email» on the customer screen send through the same routes.
7. «Reset workspace data» keeps the mailbox; «Reset and disconnect everything» removes it at the
   provider, the standing reports `unverified`, the tiles offer connection again, and Bar Latintzar
   stands in the seeded book with its addresses.
8. Every step's evidence is a runtime answer read back and recorded in the pull request; the copy
   law and the theme gate hold on every string and colour.
