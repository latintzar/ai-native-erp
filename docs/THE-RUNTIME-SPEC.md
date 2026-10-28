# THE RUNTIME SPEC — the calls the browser must not make

**Authority:** FEED-IA §196.5, §196.6 and §196.9 (E193.06). **Boundary:** THE-PARSING-SPEC owns
what a document READS as; THE-VOICE-CONNECTION-SPEC owns the product's phone rail (setup journeys,
routing, consent, the identity card in the UI); THE-SOURCE-PRIVACY-SPEC owns what may be RETAINED.
This document owns the SERVICE: what it exposes, what it holds, what it refuses, how it is deployed
and what has actually been proven against real providers.

Peter, 2026-09-04, recorded whole in FEED-IA §196:

> maybe we need an api. idk. maybe use parsewise so its solid…
>
> the hermes shit remember i wanted to port it. the number->gmaps info was working flawlessly, and
> then the transcription too, with clear speaker diarisation. set to spanish of course. i dont want
> dependencies on the actual hermes caller as thats a packed thing, i want it all self contained in
> here, same as twilio. that shit proved capability now we're doing ti all for real, every part of
> the process, nothing half assed. if i missed a step when explaining it, figure that out.

---

## RUN-00 · The one law

**The runtime never fabricates a result.** A missing key is `missing` in health and a named 503 on
the endpoint. A provider that fails says so. There is no cached answer, no plausible default, no
«we'll try again later». The kit's honest posture — «Runtime offline», «Extraction
unavailable» — is a better product than an invented row, and it is drive-proven in
`drive-198-parsing-qr.py` and `drive-199-runtime.py`.

Two claims follow from it and are forbidden everywhere in this service:

- «This is Customer X» from an approximate Places match (VOICE-00). A candidate that does not carry
  the number we asked about returns NO NAME.
- «The call was recorded» / «the call was transcribed» before the provider says so (VOICE-00).
  Custody is a ladder and each rung needs its own evidence.

## RUN-01 · Where it lives

```
kit.soyrocoto.com  ──►  Caddy  ──┬── /api/*  ──►  127.0.0.1:8790   rocoto-kit-runtime.service
                                 └── everything else ─►  /srv/rocoto-kit  (the static kit)
```

- **Code:** `mock-api/` — FastAPI + uvicorn + httpx, five
  dependencies, Python 3.11+. It imports nothing from founder-hermes, call-recorder or call-log:
  §196.6's «self contained in here» is a build property, not an intention.
- **On the box:** `/srv/rocoto-kit-runtime/{app,venv,.env,recordings,calls}`; unit
  `rocoto-kit-runtime.service`, user `founder`, loopback only.
- **The kit's half:** `app/src/prototypes/cedar/runtime-client.ts` is the ONLY file that names the service.
  Same origin by default; a developer pins `localStorage['rocoto-runtime-base']` at a local build.

## RUN-02 · The contract, endpoint by endpoint

Exactly what `runtime-client.ts` types, and nothing the kit does not name.

| Endpoint | In | Out |
|---|---|---|
| `GET /api/health` | — | `{ok, version, code, providers{parsewise·deepgram·places·twilio: configured\|missing · artwork: configured\|awaiting key · copilot: gemini\|anthropic\|awaiting key}, handwriting{reader, key}}` |
| `POST /api/parse` | multipart `file` + `kind` (`albaran`·`catalogue`·`stock`) | `ParseResult` — `rows[] · columns[] · confidence · provider · evidence{pages,tables} · header{}` |
| `GET /api/identity?number=` | E.164 number | `Identity` — `number · name? · address? · placeId? · mapsUrl? · phoneType · confidence · provider · types[]` |
| `POST /api/transcribe` | multipart `audio` + `language` | `Transcript` — `transcript · utterances[{speaker,start,end,text}] · language · provider` |
| `POST /api/copilot` | `{session{id,messages[≤20]}, context{day,area,document?,orders[≤40],stock[≤60],customer?}, ask}` | `{reply{text}, proposals[], evidence{model,ms,tokens}}` |
| `GET /api/calls?number=` | counterpart number | `CallObject[]`, newest first |
| `POST /api/calls` | `{to}` | `{sid}` — or a named refusal |
| `POST /api/artwork` | header `X-Rocoto-Artwork-Key` + `{reference, describe_only}` — or `{name, reference, description?, replace, subject}` | the reference's description — or `{name·slug·description·prompt·image{data,url}·provider{…}·file{…}}` |
| `POST /api/twilio/{voice,status,recording}` | Twilio's signed form | TwiML / `{ok}` |
| `GET /api/health/twilio` | — | what the Twilio ACCOUNT itself answers |
| `POST /api/paper/manifest` | the packing sheet's own geometry at print time — `{version, locator, token, day, paper, pageMm, marks{qr, corners[3]}, pages[{index, blocks[{sale, rows[{line, printed, cells{finalWeight, qty?, unit?}}]}]}]}`, millimetres from the page's top-left | `{ok, token, locator, pages, cells, storedAt}` |
| `GET /api/paper/manifest/<token>` | the token the paper prints | the manifest as it was recorded — or `404 manifest_unknown` |
| `POST /api/paper/read` | multipart `file` (a photograph of one of our sheets) | `{locator, token, matched{day, sales[]}\|null, pages[{index, quality{tiltDeg, blurScore, lightScore}, readings[{sale, line, cell, written, value, confidence, crop, check}]}], evidence{reader, ms, marksFound}}` |

**`copilot` is the one provider health does not answer with `configured`.** It answers with the
NAME of the mind that is standing, because Gemini and Claude are two different products to the
person reading the reply, and `awaiting key` is the third honest word. RUN-12 states the endpoint.

**Additive fields, named here so they are not mistaken for drift.** `code` on health (a digest of
the service's own modules, so a deploy is verifiable from outside); `handwriting{reader, key}` on
health, BESIDE `providers` rather than inside it, because the kit types that record as exactly four
names and a fifth entry there would break a drive that asserts the set (PAR-10.5); `header` on
`ParseResult` (the document number, date and counterparty, extracted the same way as the lines);
`types` on `Identity` (the Places categories, which the identity card will want); `evidence.page
{index, score, margin}` on a paper read, which appears where one token covers several sheets and
states which sheet was read and how clear the choice was (PAR-10.3). The kit types none of them
today and ignores them; each is a fact the runtime already holds and throwing it away would be the
waste.

## RUN-03 · Health says PRESENCE, and says so

`configured` means the environment carried a key when the process started. It does **not** mean the
provider answers: the house Twilio account is `configured` and simultaneously suspended
(RUN-07.4). Health makes no provider call — it is instant and free, and a health check that spends
money is one nobody runs. Where an account's own state matters, `GET /api/health/twilio` asks it
and reports what came back, including the failure.

Twilio needs BOTH halves to read `configured`: the account SID to place a call and the auth token to
prove a webhook is Twilio's. One without the other is `missing`.

**AND THE KIT READS THAT DISTINCTION (E195.21).** This section said it from the first day and the
kit ignored it: `readinessOf` folded presence straight into «Connected», so the deployed runtime —
`twilio: configured`, account `401`, every dial `503 · house_number_missing` — printed a connected
line on the page. The kit's voice seam now asks `GET /api/health/twilio` once, wherever the answer
can still change the standing, and a key nobody accepts reads «Prepared · awaiting connection» with
Twilio's own sentence under it. VOICE-17 carries the amended fold.

### RUN-03.1 · `why` comes from three roads, and only one of them is Twilio speaking

`account_state()` (`mock-api/app/twilio_voice.py`) answers `{reachable, status?, why?}`, and `why` is
written in three different places:

| road | shape of `why` | `status` |
|---|---|---|
| Twilio's own account road answered `>= 400` | Twilio's `message` — «The authorization with Key failed» | the HTTP status |
| the transport failed | a Python EXCEPTION CLASS NAME — «ConnectTimeout» | absent |
| the runtime holds no Twilio keys | the runtime's own words — «not configured» | absent |

**`status` is the marker, and it decides the SENTENCE — not just whether a quote is relayed.**

* **`status` present** ⇒ Twilio's own account road answered and DECLINED these keys. «Twilio answers
  the runtime once the account accepts its keys» is then a true thing to say, and `why` may be
  quoted beside it — bounded: under 120 characters, and carrying no denial, because a relayed
  «… is not …» is a negative on the kit's page whoever typed it.
* **`status` absent** ⇒ the runtime never got an answer out of Twilio at all: its transport failed
  («ConnectTimeout»), or it holds no keys. The ACCOUNT's own state is still open, and claiming it
  declined anything states a fact nobody has. The kit says **«The Twilio account has still to answer
  the runtime for these keys.»** and quotes nothing.

A client that printed every `why` as «Twilio said: …» quotes a stack class as a person's next step.
A runtime that changes the shape of `why` changes what a person reads, so this table is part of the
contract, not a note about it (E195.21 repair round). `drive-199-voice-real.py`'s `account_unasked`
band holds the second row; it caught the kit saying the first row's sentence for the second row's
answer.

## RUN-04 · Parsing — what the runtime owes THE-PARSING-SPEC

The configuration is THE-PARSING-SPEC §PAR-02 and it is implemented literally in
`mock-api/app/parsewise.py`: project → upload → a dynamic **`Line` dimension** → one agent per column
carrying that dimension → header agents carrying none → launch → wait → results → **delete**.

1. **It holds the key.** `PARSEWISE_API_KEY`, server-side. The browser sends a file and a word.
2. **It waits properly, and it asks often, of the endpoint built to be asked often.** «Done» is
   `pipeline_running=false` **and** every agent `Processed` or `No Result`. The flag alone also goes
   false on a cancelled or failed run, so the flag alone would report a silent failure as a finished
   read. The wait sleeps **1.5 s growing ×1.25 to a 4 s cap**. Every rung asks the compact
   `GET /projects/{id}/status/` — Parsewise's schema: «intended for frequent polling (for example,
   every 5 seconds)», 116 bytes an answer — and that GATE decides nothing: when it says the pipeline
   has gone quiet, and on every fifth rung whatever it says, the two calls carrying the predicate
   are made, `GET /agents/` then `GET /agents/status/`. So a gate that lagged or stuck costs a read
   five rungs and can never hold one open. Measured on the box (THE-PARSING-SPEC PAR-10): the
   PROVIDER's own time is **44–191 s** for a one-page albarán, p50 **77 s** over 47 live reads, and
   the runtime now stands within 4 s of it. The 87–138 s this line used to state was that floor plus
   a 25-second ladder.
3. **It maps resolution to confidence.** `Resolved` stands; `Requires attention` stands and counts
   against confidence; everything else leaves the field EMPTY. `confidence` is the share of stated
   fields that came back `Resolved`.
4. **It keeps the citation.** `evidence.pages` is the count of distinct pages any stated value
   cited; `evidence.tables` is the count of pages that produced LINE rows — a page of lines is a
   table, and that is the honest reading of a citation list.
5. **The paper lives for one read.** One read is one project holding one document; the project
   is DELETED after the read, which deletes the document and every result derived from it, and the
   deletion is logged as `deleted` or `retained_<status>`. A retained project is a warning in the
   journal, never silence. THE-PARSING-SPEC PAR-10.4 states why the project is per-read: the
   provider's done-signal is a PROJECT fact, so a shared project could not honestly answer «is MY
   document finished».

   The setup POSTs that do not depend on each other go together — the document upload beside the
   dimension, then the ten agents at once — which took the setup from 2.93 s to 1.60 s.

### RUN-04.2 · The step Peter did not spell out: the lines come back in no order

Parsewise returns its result rows unordered and offers no reading order — `all_dimension_values.Line`
comes back **alphabetical** (measured on the live probe). A person checking a delivery note reads
DOWN the paper, so a proposal in provider order is one they have to re-sort by hand, and §195's
checkout-grade consistency dies at the first line. So the position is **extracted like any other
fact**: a seventh agent, `Line number`, on the same `Line` dimension —

> «The position of this goods line in the printed table, counting the first goods line under the
> column headings as 1 and going down. Header rows, totals, taxes and carriage rows are not counted.»

— and the rows are sorted by it. A line whose position went unread keeps its arrival order BEHIND
the placed ones; it is never dropped. `Line number` is deliberately **not** one of the document's
`columns`: it is where a line stands, not something the line states.

Proven live twice on the same page: without the agent the four rows arrived
`Gamba · Pulpo · Merluza · Almeja`; with it, `Merluza · Pulpo · Gamba · Almeja` — the printed order.

## RUN-05 · Identity — the Hermes port, kept exactly

Ported from `apps/call-recorder/product/backend/pipeline.py` (`_google_places_lookup`,
`_enrich_phone`, `_keyterms_for_place`) into `mock-api/app/places.py`. Two behaviours make it
«flawless» and both are kept:

1. **The query is the phone number**, through `inputtype=phonenumber` — never a scraped title used
   as a seed. pipeline.py records what seeding cost: «a granja's number resolved to "Cuc de Llum"
   because the Yelp aggregator listed both».
2. **The candidate must match back on the last nine digits.** Google answers plausibly; an answer
   that does not carry the number asked about is not an identity, and the runtime returns no name.

Two roads, in order: the legacy Find Place endpoint (the only one that accepts a phone number as an
input type) and Places API v1 `searchText` behind the same gate. `phoneType` reads Spain's numbering
plan (6xx/7xx mobile, 8xx/9xx fixed) and answers `unknown` for every other country rather than
asserting a plan it has not checked. `confidence` is 0.95 on the phone-matched legacy road and 0.9
on the v1 road — strong, never 1.0.

`keyterms(place)` returns the business name and the district, and it exists because Hermes runs
enrichment BEFORE transcription: nova-3 then spells «La Hummuseria» instead of «la umuseria».

## RUN-06 · Transcription — nova-3, Spanish, diarised

Ported from `pipeline.py` `_deepgram` / `_parse_deepgram` into `mock-api/app/deepgram.py`, with one
deliberate difference and it is Peter's line: Hermes defaults to `language=multi` because he
cold-calls in three languages; Rocoto's customers speak Spanish to their supplier, so **`es` is the
default here** and the kit's contract types it.

- **ffmpeg → 16 kHz mono WAV first** for the composer's road (a browser's `MediaRecorder` webm/opus
  normalises away a whole class of «the provider read zero seconds» failures).
- **Two tracks stay two tracks** for a call: `multichannel=true`, channel 0 = us, channel 1 = them.
  A mixed single track uses `diarize=true`.
- **Keyterms are best-effort**: a rejected keyterm parameter is retried without it. «A call must
  never be lost over a transcription nicety.»

⚠ **A measured limit, stated rather than hidden.** On ten seconds of clean synthetic Spanish TTS,
nova-3's DIARIZER returned a single speaker even for acoustically distinct voices; the same audio
split across two channels returned two speakers correctly. So the product's speaker separation for
CALLS rests on Twilio's dual-channel recording, not on the diarizer — which is what Hermes concluded
too, in its own comment. For one-track voice notes the transcript is honest about being one voice.

## RUN-07 · Twilio — the steps Peter did not spell out

«if i missed a step when explaining it, figure that out.» Four were missing and are settled here.

1. **Who is called first.** A browser cannot hold a phone leg without the Voice SDK, so `POST
   /api/calls` rings the OPERATOR's phone and the TwiML then bridges to the customer with
   `record="record-from-answer-dual"`. That order is also what makes the recording exact — channel 0
   is us, channel 1 is them. (On `<Dial>` the dual channel is encoded in the `record` VALUE;
   `recordingChannels` belongs to `<Record>` and is silently ignored, producing a mono file where
   both legs are summed. The Hermes caller's own comment, kept.)
2. **Which number the customer sees.** `ROCOTO_HOUSE_NUMBER`, and nothing else. An unset house
   number REFUSES the call: VOICE-00 forbids claiming a caller ID that has not been proven.
3. **Which webhooks are believed.** Only Twilio's, proven by `X-Twilio-Signature` over the exact
   public URL **including its query string** and the exact form. ⚠ The query string is part of the
   signature and dropping it is a silent total failure — the outbound TwiML URL carries `?to=+34…`,
   so a validator built on the path alone rejects every webhook the runtime itself asked for.
   `drive-199-runtime.py` caught exactly that, and the fix carries a regression test.
4. **When a recording is «ours».** `none` → `provider` (Twilio announced one) → `ours` (the bytes
   are on this disk). Transcription happens after the webhook has been answered, because Twilio
   retries a slow webhook and a retry would transcribe the same recording twice, at the provider's
   price, into the same record.

**The call record is a FILE**, keyed by call SID, merged by every leg. The Hermes caller kept this
in memory and its own comment records the cost: a deploy between the TwiML and the recording webhook
wiped the dialled number.

### RUN-07.4 · The house account, as it actually is

The Twilio credentials in the box's env belong to account `AC8d86…`, and the account answers:

```
{"code":20003,"message":"authentication failed, account AC8d86… with status 4 is not active"}
```

with the API-key pair answering `401 · The authorization with Key failed`. It is the ONLY Twilio
account on the box (three env backups carry the same SID), and prod's `/opt/rocoto/.env` carries the
same one. So: the Twilio code path is complete and proven by a validated dry run (signature, TwiML,
custody ladder, call record, `/api/calls`), and **no call has been placed**. Reactivating or
replacing the account, and Peter's explicit go, are both OWED — see RUN-11.

## RUN-08 · What holds the line

- **CORS is an allow-list**: `https://kit.soyrocoto.com`, `localhost`, `127.0.0.1` (any port, for a
  developer's build). A wildcard would let any page on the internet spend four live keys. Proven
  admitting and refusing, in Python and in a real browser.
- **Secrets never leave**: `redact()` runs inside the LOG FORMATTER, so a provider's own error that
  quotes the key back, and httpx's own request line carrying `key=…` in a URL, both reach the
  journal as `[redacted]`. The env file is 0600 root-owned; the deploy pipes it and writes nothing
  on this side; `env-names.txt` is the only list of names in the repo.
- **No schema door**: `/docs`, `/redoc` and `/openapi.json` are off. This is a private seam.
- **Uploads are capped** (40 MB default) and an empty upload is refused before a provider is called.
- **systemd hardening**: `ProtectSystem=strict`, `ReadWritePaths=/srv/rocoto-kit-runtime`,
  `ProtectHome`, `PrivateTmp`, `NoNewPrivileges`.
- **Structured logs**: one JSON object per line — `ts · level · logger · msg` plus `request_id ·
  route · status · ms · provider · kind · call_sid · outcome`.

## RUN-09 · Deploying it

The demo runtime deploys through [CI](omitted-sources.md) from a merged PR, using
[the staging receiver](omitted-sources.md). The old standalone production script
`mock-api/deploy/deploy.sh` was retired on 2026-09-07; Git commit `42d27ccc` preserves it.
A production change to this service needs a commissioned runtime release path; the kit tag
workflow publishes static artifacts. See [the deployment runbook](omitted-sources.md).

The following records the historical publisher's steps and the evidence behind them. Later
references to `deploy.sh` in this specification describe that recorded implementation:

1. `assert_prod_box` from `deploy/prod-host.sh` — refuses the old Ashburn box,
   refuses a box it cannot reach, refuses one carrying `DECOMMISSIONED`.
2. rsync the code, build the venv, install the five dependencies.
3. **Pipe** the keys into `/srv/rocoto-kit-runtime/.env` (0600, root) — they touch no disk here.
4. Install the unit and **restart** it. (`enable --now` leaves a running service alone, so a second
   deploy would serve the old code and report success. The health `code` digest is compared against
   this tree and the deploy is refused if they differ.)
5. Record what the kit serves TODAY: `/app.html`, `/`, a deep SPA path, the `Cache-Control` header.
6. Back up `/etc/caddy/Caddyfile`, patch it with `patch-caddy.py`, `caddy validate`, reload.
7. Re-fetch the four recorded things and compare BYTE FOR BYTE; any difference rolls the Caddyfile
   back and the deploy dies.
8. `GET https://kit.soyrocoto.com/api/health` from outside, and the CORS header with it.

### RUN-09.1 · The Caddy change, and why it is four lines and not one

```
handle /api/* {
    reverse_proxy 127.0.0.1:8790
}
handle {
    try_files {path} {path}/ /index.html
    file_server
}
```

⚠ **A bare `handle /api/*` is a bug**, and this was measured rather than assumed: `caddy adapt` on
the one-handle form emits the try_files **rewrite at route 1 and the /api subroute at route 2**.
The kit is an SPA whose try_files ends at `/index.html`, so `/api/health` finds no file, is
rewritten to `/index.html`, and the `/api/*` matcher no longer matches — every API call would be
answered with the kit's HTML, a failure that reads as «the runtime is down» and is really «the
runtime was never asked». Sibling `handle` blocks are mutually exclusive, so pairing them is what
splits the two roads. `patch-caddy.py` is idempotent, refuses any block that is not the one it was
written for, and asserts that every byte outside the block is unchanged.

### RUN-09.2 · State on the box

`/srv/rocoto-kit-runtime/calls/<sid>.json` (call records) and `recordings/<sid>.wav` (audio in our
custody), plus one empty `calls/.lock` — the file every writer takes an `fcntl.flock` on, because
uvicorn and the nightly sweep are two processes (E195.40). Nothing else is written: it is skipped by
the `glob('*.json')` every reader uses, and it holds no bytes. The Parsewise project is deleted at
the provider; the uploaded
bytes are transient (SRC-PRIV-07); a Places answer lives in the response and nowhere else; Deepgram's
transcode happens inside a `TemporaryDirectory` under the unit's own `PrivateTmp`.

**And both are swept — IN THE TREE, INSTALLED BY `deploy.sh` STEP 4b, AND NOT YET ON THE BOX.**
State that order plainly, because the present tense would be a claim about a machine: today
`systemctl list-unit-files 'rocoto-kit-retention*'` on 138.199.221.222 answers «0 unit files
listed» and `/srv/rocoto-kit-backend/app/app/retention.py` does not exist. The paragraph below
describes what the deploy installs; the sentence that says it is running belongs to the deploy that
installs it.

`app/retention.py` keeps VOICE-21's clock: audio goes as soon as its transcript is ready (on the
custody path itself, and the sweep is the net), audio with a pending transcript goes at 30 days,
transcript text goes at the house's own period — twelve months by default — and the call record
stays for the house's business-record period, `ROCOTO_CALL_RECORD_RETENTION_DAYS=0` by default
because that period is the tenant's to state. **0 means the clock is OFF on all three knobs**, which
is decision 5 in VOICE-21A and the reason the audio and transcript rules are guarded the way the
record rule always was. `python -m app.retention` plans, `--apply` acts, and
`rocoto-kit-retention.timer` will run it daily at 03:20 (`Persistent=true`, so a box that was off
catches up). It creates nothing: a store that does not exist sweeps to zeros and the disk is left
exactly as it was found. The plan counts exactly what the apply removes, including a fresh wav held
by a record past the house's period. The journal carries counts, never contents — asserted against
the line `logging_setup.JsonLine` actually emits, `extra=` fields included. 33 pytest checks against
a fake store tree; the six implementation decisions are recorded in VOICE-21A.

**The store's writes are safe against the service running beside the sweep.** `store.save()` and
`store.revise()` write through a temp file and `os.replace()` — whole record or nothing, so a box
that loses power mid-write keeps a record that still parses — and both take an `fcntl.flock` on
`calls/.lock`, which the uvicorn process and the sweep's own process both respect. A `threading.Lock`
would have locked neither against the other. `retention.forget_audio()` holds that lock across the
delete AND the revise, so a recording webhook cannot land between them and write `recordingPath`
back onto a record whose wav has just gone — the RUN-00 claim this module exists to prevent.

### RUN-09.3 · The digest, and the trap inside it

`/api/health` states `code`: the first twelve hex of a sha256 over the service's own `*.py`, in
`sorted(glob(...))` order — CODEPOINT order, where `__init__.py` leads. `deploy.sh` computes the
same twelve characters over the files it just sent and REFUSES the deploy when they differ, which is
what makes «the running process is this tree» a fact rather than a hope.

⚠ The shell side must compute it under `LC_ALL=C`. A UTF-8 locale's `ls` collates punctuation away
and files `__init__.py` under «init», between `errors.py` and `logging_setup.py` — a different
concatenation and therefore a different digest, for no reason at all. It stayed invisible while
`__init__.py` was empty and fired the moment it carried a line of text. The guard was right and the
comparison was wrong; the fix is in `deploy.sh` beside the line it bit.

## RUN-10 · The proof — run from the box, 2026-09-04

Every command below was run for real; keys are redacted and no key ever appears in a response.

**RUN-10.1 · Live health, through the public URL**

```
$ curl -s https://kit.soyrocoto.com/api/health
{"ok":true,"version":"1.0.0","code":"12180c4db7ad",
 "providers":{"parsewise":"configured","deepgram":"configured","places":"configured","twilio":"configured"}}
```

**RUN-10.2 · A real Parsewise read of a fixture albarán, end to end through `/api/parse`** (87 s;
`backend/tests/make_fixture_albaran.py` draws the page — four goods lines, the fourth stating no
lot, and a total row):

```
$ curl -sS -X POST -F "file=@tests/fixtures/albaran-fixture.png;type=image/png" -F "kind=albaran" \
    https://kit.soyrocoto.com/api/parse
rows:
  Merluza grande · 12.5 kg · 13.5 · L-250903
  Pulpo cocido   · 21   kg · 18.9 · L-250902
  Gamba roja     · 3   caja · 92.0 · L-250903
  Almeja fina    · 4.25 kg · 31.4 · (no lot — absent, not borrowed)
columns: Product code · Product name · Quantity · Unit · Unit price (EUR) · Lot
confidence: 1.0    evidence: {pages: 1, tables: 1}
header: {Document number: 2026/0418, Document date: 2026-09-03, Counterparty: Restaurant Can Sabate}
journal: "parsewise project deleted" → "parsewise read · 87279 ms · 4 rows"
```

Comma decimals read as decimals; «caja» survived beside three «kg»; the TOTAL row was not read as a
line; the missing lot came back absent; the lines are in the printed order (RUN-04.2); and the
project was deleted.

**RUN-10.3 · A real Google Places identity for a real Spanish business number**

```
$ curl -s "https://kit.soyrocoto.com/api/identity?number=%2B34935563000"
{"number":"+34935563000","name":"Mercabarna",
 "address":"Carrer Major, 76, Sants-Montjuïc, 08040 Barcelona, Espanya",
 "placeId":"ChIJ8feMrzGfpBIRqaTJMdzjc-c",
 "mapsUrl":"https://www.google.com/maps/place/?q=place_id:ChIJ8feMrzGfpBIRqaTJMdzjc-c",
 "phoneType":"landline","confidence":0.95,"provider":"google-places",
 "types":["food","point_of_interest","establishment"]}

$ curl -s ".../api/identity?number=%2B34935185053"   → "El Nacional Barcelona", Pg. de Gràcia
$ curl -s ".../api/identity?number=%2B34910000042"   → {"confidence":0.0}  · NO NAME, as VOICE-00 requires
```

**RUN-10.4 · A real Deepgram transcription of Spanish, through `/api/transcribe`** (1.3 s):

```
$ curl -s -X POST -F "audio=@spanish.wav;type=audio/wav" -F "language=es" \
    https://kit.soyrocoto.com/api/transcribe
{"transcript":"Buenas. ¿Qué necesitas para esta semana? Buenos días. Le confirmo el pedido enseguida.",
 "utterances":[{"speaker":0,"start":0.0,"end":2.16,"text":"Buenas. ¿Qué necesitas para esta semana?"},
               {"speaker":0,"start":2.96,"end":5.44,"text":"Buenos días. Le confirmo el pedido enseguida."}],
 "language":"es","provider":"deepgram nova-3"}
```

And the two-track call shape, through the module the recording custody uses:

```
dual detected: True
speakers: [0, 1]
  spk0 0.00–1.84 Buenas, ¿qué necesitas para esta semana?
  spk1 3.04–5.52 Buenos días, le confirmo el pedido enseguida.
```

**RUN-10.5 · Twilio, as far as an inactive account allows**

```
$ curl -s https://kit.soyrocoto.com/api/health/twilio
{"twilio":{"reachable":false,"status":401,"why":"The authorization with Key failed"}}

REST, with the account SID + auth token:
{"code":20003,"message":"authentication failed, account AC8d86… with status 4 is not active"}

$ curl -s -X POST -d '{"to":"+34935563000"}' -H 'Content-Type: application/json' .../api/calls
{"error":{"code":"house_number_missing","message":"This runtime has no house number, so it will not place a call."}}

$ curl -s -o /dev/null -w '%{http_code}' -X POST .../api/twilio/voice -d 'CallSid=CA1'   → 403
```

The signed road is proven in the SEALED runtime (no secret, no account): a correctly signed voice
webhook returns TwiML carrying the house caller ID, `record-from-answer-dual` and both callbacks; a
signature that no longer matches the form is refused; the webhook writes one durable call record
that `/api/calls?number=` finds, at custody `none`.

**RUN-10.6 · The harnesses**

- `backend/tests/` — **53 pytest checks**, no network, against recorded real provider responses
  (Parsewise's 23 result rows, Deepgram's two-channel utterances, Google's phone-matched candidates).
- `drives/drive-199-runtime.py` — the Playwright harness. See `drives/README.md` for its count, its
  three postures and the reds proved on purpose.

## RUN-12 · Artwork — the house makes a product's painting

FEED-IA §200.2: «Every product carries artwork, and the house makes it.» The method is
THE-PRODUCT-SHEET-SPEC §16 and `mock-api/app/artwork.py` implements it literally — describe a family
reference, take that description **verbatim**, swap exactly ONE substring for the new subject,
generate at the family's own 1024 square, hand back the painting with the description and the prompt
beside it so what changed is visible without asking the provider.

1. **It holds the key.** `IDEOGRAM_API_KEY`, server-side, redacted out of every log line and every
   response the same way the other secrets are, and carried to the box by `deploy/env-names.txt`
   like every other name. **The runtime road takes the key the moment the house holds it**; until
   then `GET /api/health` answers `artwork: awaiting key` and every call answers
   `artwork_awaiting_key` with a 503. A key-less runtime states what it is waiting for — that is the
   whole of RUN-00 applied to paint.
2. **It holds a door, because this is the one road that spends money per call.** `/api/parse`,
   `/api/identity` and `/api/transcribe` spend a subscription the house has already bought. This one
   spends GENERATION CREDIT out of a balance that empties, so «can reach the box» must not mean «may
   spend the account». CORS is a browser control and a browser control alone: it says nothing to
   `curl`, and this service answers on a public hostname. Two guards, both ahead of the provider:
   - **A house secret.** `ARTWORK_SHARED_SECRET`, presented on the `X-Rocoto-Artwork-Key` header and
     compared in constant time. Under 24 characters is a placeholder rather than a secret, so the
     door reads its length before its value: short or unset answers `artwork_awaiting_secret` (503),
     and anything else presented answers `artwork_unauthorized` (401). **The header is deliberately
     outside the CORS allow-list**, so a browser's preflight is refused before the request is ever
     made — this is a road for the house's own tooling, over the wire, holding a secret.
   - **An hourly ceiling.** `ARTWORK_HOURLY_CEILING`, 40 by default, counts the calls that REACH
     Ideogram — a describe is one, a generation is one — over a rolling hour, and answers
     `artwork_ceiling_reached` (429) naming the seconds until the next slot. It is what makes a
     leaked secret a countable loss instead of an open account, and every painted answer carries the
     provider's own `reported_cost_usd_micros`, which is what turns that count into money. The
     counter lives in the process, so the ceiling is per worker; the unit file
     (`deploy/rocoto-kit-runtime.service`) runs uvicorn with one.
   The slot is taken where money starts — the top of `describe` and the top of `generate` — so a
   malformed request that got through the door reaches no provider and costs nothing.
   **`artwork: configured` needs BOTH halves**, the way Twilio needs an account and a token: credit
   to spend, and a house secret naming who may spend it.
3. **The provider is pinned.** `ideogram-v4-async@1`, from `specs/intelligence/v1/image-job.schema.json`:
   multipart/form-data to `/v1/ideogram-v4/async/generate`, a `generation_id` back, polled at
   `/v1/generations/{id}`. The base URL and the three paths are configuration
   (`IDEOGRAM_BASE_URL`, `IDEOGRAM_DESCRIBE_PATH`, `IDEOGRAM_GENERATE_PATH`,
   `IDEOGRAM_GENERATION_PATH`), so a provider that moves an endpoint costs an environment edit.
4. **The swap fails closed.** `replace` must occur in the description exactly once. Absent →
   `subject_not_found`; twice → `subject_ambiguous`; both 422, both naming what to do. Which words
   were the subject is a question this service asks rather than answers.
5. **The wait is bounded and its ending is named.** A generation still running at the ceiling answers
   `generate_stalled` **with the generation id** — that is the painted library's own hard-won
   signature of a quota that emptied mid-queue, where the job sits `running` for ever and its URL
   404s for ever. A render URL that 404s briefly after the job reports done is retried; one that
   stays unreachable answers `image_unreachable`.
6. **What the suite proves.** `tests/test_artwork.py` (26 tests) drives the swap, the two recorded
   provider answers, every refusal, the health word and the redaction — and then **the wire**: a
   local server speaking this adapter takes the multipart submit, answers `PENDING` and then
   `COMPLETED`, 404s its render URL once and then serves the bytes, and the assertions are that the
   prompt which went out is the description with exactly one substring swapped, that the poll
   followed the job to done, that the retried download came back, and that a job still `PENDING` at
   the ceiling raises `generate_stalled` naming its generation. That proves this client's behaviour;
   the fixtures `ideogram-describe.json` and `ideogram-generation.json` carry the adapter's shape.
   The door is proven there too: no secret, a placeholder secret, no header and a wrong header are
   four refusals by name; the house secret opens the door and the runtime then says what it still
   owes; the ceiling refuses the call past its count and rolls its hour; and a browser asking to
   send `X-Rocoto-Artwork-Key` is refused at the preflight. The live receipt — one real describe and
   one real generation, timed — is owed with the key, and is listed in RUN-11.

## RUN-11 · What is OWED

1. **A working Twilio account.** `AC8d86…` is `status 4 · not active`. Until it is reactivated or
   replaced, `POST /api/calls` cannot be exercised end to end.
2. **A house number and an operator number.** `ROCOTO_HOUSE_NUMBER` / `ROCOTO_OPERATOR_NUMBER` are
   unset by design — the runtime refuses to dial rather than guess a caller ID.
3. **Peter's go for a real outbound call.** Not authorized in this pass, and stated rather than
   quietly skipped.
4. **Inbound.** Number provisioning, the ring group and the fallback phone are
   THE-VOICE-CONNECTION-SPEC's journeys; this service exposes the webhooks they will point at.
5. **Retention — WRITTEN AND PROVEN, NOT YET ON THE BOX.** The sweeper is `app/retention.py`, the
   units are `deploy/rocoto-kit-retention.{service,timer}`, and `deploy.sh` step 4b installs them
   behind a dry run that must pass BEFORE the timer is enabled. Today the box lists no such unit and
   holds no such module, so «a daily sweep keeps this clock» is true of the tree and owed by the
   deploy. The custody path already deletes the audio it just transcribed (proven by awaiting
   `take_custody` itself), and the tenant notice stands in Connections' «Routing and privacy» step.
   Two things stay owed inside it beyond the deploy: the PROVIDER half — verified deletion of
   Twilio's own copy, which needs a live account (item 1) and reconciliation before «Media deleted»
   may ever be shown (VOICE-09C) — and the WRITER for a per-tenant period. The sweep already reads
   `transcriptRetentionDays` off a call record when the record states one (VOICE-21A decision 6);
   nothing stamps it, because the kit's dial is local state and a runtime write would be an endpoint
   the kit does not name (RUN-02). Until then the box knob governs, and the unit sets 365 — the same
   twelve months the kit's shipped dial states.

   **Packing manifests are the half that is already settled**: `manifests/` is swept at
   `ROCOTO_PAPER_MANIFEST_DAYS` (30) on every write, and a photograph sent to `/api/paper/read` is
   held in memory for that one request (THE-PAPER-SPEC).
6. **A real-albarán corpus.** THE-PARSING-SPEC §PAR-07's accuracy question is still open: one clean
   synthetic page proves the configuration, never the accuracy on a creased note at 05:40.
7. **`/api/parse` is a long request.** 44–191 s held open, p50 77 s — the provider's own time,
   measured over 47 live reads in THE-PARSING-SPEC PAR-10.2. If a proxy or a phone network starts
   cutting it, the answer is a poll token, not a shorter wait.
8. **An Ideogram key, a house secret, and the live artwork receipt.** `IDEOGRAM_API_KEY` and
   `ARTWORK_SHARED_SECRET` are the two things between `POST /api/artwork` and a painting on the box;
   both names are already in `deploy/env-names.txt`, so the deploy carries them the moment
   `.env.local` holds them. With them: one real `describe` and one real generation, timed, written
   in beside the Parsewise and Deepgram receipts (RUN-10) — and the fixtures replaced by those two
   recordings.
9. **The Copilot's own credit.** `COPILOT_MODEL=gemini` answers on the free tier, which counts
   twenty requests per model per day; `anthropic` is implemented whole and its account holds no
   credit (§199.6). Neither fact is dressed as the other, and RUN-13 states which mind is standing
   on `/api/health` rather than leaving a person to guess from a reply.

## RUN-13 · The Copilot's mind (E198 · FEED-IA §196.2 · §199.3)

`POST /api/copilot`. The kit sends the desk — the day, the area, the open document, the day's orders
with their flags, the shortage ledger, the customer in hand — and the session so far; the mind sends
back a reply, proposals and the evidence of the call. THE-COPILOT-SPEC §9 holds the contract in full;
this section holds what the RUNTIME owes it.

### RUN-13.1 · The seam

One module, two providers, one choice.

| | Gemini | Anthropic |
|---|---|---|
| chosen by | `COPILOT_MODEL=gemini` (the default) | `COPILOT_MODEL=anthropic` |
| key | `GEMINI_API_KEY` | `ANTHROPIC_API_KEY` |
| model | `COPILOT_GEMINI_MODEL`, default `gemini-2.5-flash` | `COPILOT_ANTHROPIC_MODEL`, default `claude-fable-5-1` |
| road | `POST {base}/models/{model}:generateContent`, `x-goog-api-key`, `responseMimeType: application/json` | `POST {base}/v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01` |

Both are raw `httpx`, exactly like the four providers beside them — one transport, one timeout
discipline, one error shape, and no sixth dependency shipped to the box to speak one documented REST
endpoint. `evidence.model` reports the model that ACTUALLY answered, never the default: Google's free
tier counts requests per model per project per day, and a day whose twenty are spent can still be
proven end to end on a sibling model. Thinking takes no parameter on Claude Fable 5.1 — it is always
on — so the Anthropic body carries `output_config.effort` and no `thinking` field.

### RUN-13.2 · What the runtime enforces, whatever the client sent

- **The caps.** 20 session messages, 40 orders, 60 stock rows, 30 lines per order, 2.000 characters
  of ask. A cap that lives only on the client is a cap a different client does not have.
- **The shape.** Only the documented fields are forwarded; a field nobody named is dropped here
  rather than sent to a provider by accident.
- **The grounding.** Every proposal naming an order, a customer or a product that is absent from the
  context is DROPPED. An order named by its number lands on its id. This is why «Open order» is
  trustworthy rather than usually right.
- **The budget.** One 30 s budget, at most two attempts, and the retry carries the model's own words
  back with the exact complaint.

### RUN-13.3 · What it answers on a bad day

| | |
|---|---|
| neither key | `503 copilot_unconfigured` — the kit stands on the offline posture |
| provider refused or failed | `502 copilot_failed` |
| the budget ran out | `504 copilot_timeout` |
| two unreadable answers | `200` with one honest sentence and the `answer` proposal |

The journal carries the provider, the outcome, the milliseconds and the model. It never carries a
word of what was said.

### RUN-13.4 · Deploying it

`deploy/env-names.txt` carries `GEMINI_API_KEY` and `ANTHROPIC_API_KEY`. The house's env file spells
the Gemini key `GEMINI_API_KEY_HELLO`, so `deploy/with-env.py` maps the one name onto the other —
the mapping lives in the one file that already knows how to read that env file, and the runtime
never learns a second name for one key.
