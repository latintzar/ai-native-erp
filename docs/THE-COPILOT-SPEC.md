# THE COPILOT SPEC — the agent surface

**Authority:** FEED-IA §196.2 (E193.02). **Supersedes** the assistant contract's *shape* — the
task-card dialog, the thread rail and the two modes — while keeping every behavioural claim
INTX-UTL-A01…A12 makes about what the agent may do. Where this document and an older description
of the *assistant* disagree about layout, this one wins; where they disagree about AUTHORITY, the
older one wins, because §196.2 changed the surface and not the boundary.

Peter, 2026-09-04, recorded whole in FEED-IA §196:

> the copilot has to be in the fucking ux ui i told you, properly. idk how many times to tell u.
> the supply issue and the catalogue shit is just suggestions but it's literally an agent and
> should have the same shit like all top agents with other sessions etc. i told u to port from the
> fucking app.soyrocoto.com which has the exact UX i wanted for the actual chat and composer in
> full even down to the grid.

Three sentences, three requirements: **it is an agent** (sessions), **it is ported** (the live
app's chat and composer, grid included), and **the two flows are conversations** rather than a
suggestions box.

**Where it lives.** `app/src/prototypes/cedar/copilot/` — `types.ts` (session · message · card · the provider
seam) · `store.ts` (the sessions) · `router.ts` (what it answers with) · `composer.tsx` (the ported
editor) · `flows.tsx` (the cards) · `surface.tsx` (the column). `app/assistant.tsx` is now the DOOR
and the names only: `openAssistant` and `AssistantHost`, so every call site — the day bar's
launcher, the stock toolbar, a category row, the Product Sheet — is unchanged.

---

## 1 · The surface

| Part | What it is | Testid |
|---|---|---|
| The column | **The frame's third grid track** (E193.16), full height, standing BESIDE the work — `gridColumn: 3`, sticky, one screen tall, the rail's own recipe mirrored. Standing IN FRONT of the work instead (E195.30) it is fixed to the glass with the scrim under it (z 10 — over the chats panel's 9, under Base's popovers at 12), the same 416 on a desk-sized window and the whole screen on a phone. `data-posture` states which of the four it is drawn as; the frame states the reserved width as `data-copilot-track`. | `assistant-dialog` |
| Head | «Copilot», the sessions control (where the rail is not beside), New session, Close. Every control ≥ 44 px. | `copilot-head` · `workflow-close` · `copilot-new` · `assistant-history-toggle` |
| Sessions | The list, its own head built to the same recipe so both heads come out the same height. Beside the conversation at ≥ 1440; over the thread — never over the head — everywhere else. | `assistant-history` · `copilot-session-<id>` · `copilot-forget-<id>` |
| Thread | The only scrollport. Ruled paper. Turns read down the page. | `assistant-thread` · `copilot-turn-<id>` |
| Floor | Starters and the two doors on the composer's doorstep (empty session only), the composer, the disclaimer. | `assistant-composer-dock` · `copilot-starters` · `assistant-task-actions` · `copilot-disclaimer` |
| Composer | The port's editor: one box, the writing surface above a control row holding the ghost mic and an always-present send. | `assistant-composer` (+ `-box`, `-input`, `-controls`, `-mic`, `-send`, `-help`, `-state`) |

**Postures and measures** (`shell/viewport.ts` owns every number; `copilotPostureAt(width)` is the
pure function, read off the WINDOW):

| Posture | Window | What it is | Track reserved |
|---|---|---|---|
| `phone` | ≤ 612 | the screen, its height following the visual viewport so the composer stays above the on-screen keyboard | 0 |
| `sheet` | 613–887 | 416 px docked at the right edge OVER the work, with the scrim, the shadow and one tap out — the same box the desk stands beside, standing in front instead, because the room cannot hold both | 0 |
| `desk` | 888–1727 | 416 px beside the work — the kit's own conversation measure (§40.1); the sessions rail opens over the thread | 416 |
| `desk-wide` | ≥ 1728 | 216 px rail + 416 px conversation, both standing at once | 632 |

**⚠ AND WITH A DOCUMENT SHOWING MONEY OPEN, THE TWO DESK RUNGS MOVE (§200.3 · E199).** The table
above is the ladder for work that has no row law standing in it. A priced albarán does, so the
agent yields — the rungs become **1664** and **2072**, and §11 below derives both from what the
work cannot go under. The agent's own measure never changes; what changes is whether the work
reflows beside it or is scrimmed behind it.

**THE AGENT'S OWN WIDTH IS 416 AT EVERY RUNG ABOVE A PHONE** (`copilotWidthOf`), and that is the
whole of E195.30. What the window decides is not how big the agent is; it is whether the WORK
reflows beside it or is scrimmed behind it. `desk` starts at **888** and the number is derived the
way every other rung of §103's ladder is — `DESK_FLOOR` (472: the rail's 64 plus the widest of the
desk's two fixed lines, the river pane's 392 + 8 and the day bar's own 408) + `COPILOT_COLUMN`
(416). Above it both things on the screen stand at their own floors; below it one of them would
have to lie about what it can hold.

**AND THE DESK'S FLOOR WAS CORRECTED WHILE DOING IT.** It read 464 — the river pane's line alone —
and the DAY BAR is the wider of the desk's two fixed lines at 408 (48 padding + 109 for the day at
its longest + 12 + 238 for a way out with its mark alone, on the 8-grid). At 484 px of work the bar
could not hold three things and painted «Sales» straight through «Assistant» and «Export»
(photographed at 880 and 900). The bar states what it can hold now: under **616** the launcher
keeps its mark and drops its word, under **544** the area's name leaves the line, and the day — the
one fact on that line stated nowhere else — never leaves. `shell/viewport.ts` owns all the numbers.

**⚠ AND BOTH RUNGS WERE READ OFF THE WRONG NAME FIRST (the E195.30 repair).** They came off «Sales»
(48 px), the NARROWEST name `route-meta.ts` holds, so between 468 and 544 the bar put «Your
business» (124 px) on a line with room for a third of it — and the item that yielded was the DAY:
62 px of «Friday 22.08» at a 560 px window on `#/admin`, 102 at 600, 72 at 640, and 91 and 101 on
`#/customers`, ellipsised, measured on the element. A rung is a FLOOR, and a floor read off the
best case is not a floor. Both are derived from `AREA_NAME_WIDEST` now (124, «Your business» — the
whole register is measured in `shell/viewport.ts`), so the bar sheds at the SAME width in every
area and every name it states is stated whole. The day carries `min-width: max-content` on a desk
besides, so the item that yields is the name — which has `flex: 0 1 auto`, a 32 % cap and an
ellipsis of its own to yield with — for any name the register grows later.

**AND THE SHEET'S OWN FLOOR IS DERIVED TOO — 613.** A sheet is a LAYER: it reserves no track, so
the work beneath keeps the line it had (that is what makes «one tap out» honest — what a person
comes back to is what they left) and the sheet covers the bar's right-hand end, the area's name and
the launcher's word. **That is the acceptance, and it is stated rather than discovered:** reflowing
the bar into the strip beside a sheet is not available at any width of this rung, because the strip
is the window less the conversation and this rung is *defined* as the widths where that is under
the desk's own floor — 471 px at the widest sheet against a bar that needs 408 plus the rail's 64.
What the rung does guarantee is the DAY, the one fact the bar exists for (§37.1), and the floor is
that guarantee's arithmetic: 64 (the rail at rest) + 24 (the bar's own left padding) + 109 (the
day) + 416 (the conversation) = **613**. It read 600 — chosen, not derived — and 601–612 drew a
sheet whose left edge landed at 185–196 px, through the day's own 197. Under 613 the agent takes
the screen instead, which states no half of anything. `drive-204` asserts both halves of the
acceptance in its `sheet` branch: the bar keeps the line it had across the press, and the day
stands clear of the sheet's left edge and whole.

**AND IT IS NOT E193.16'S DEFECT WEARING A NEW HAT, which is worth saying because it photographs
the same.** In the sheet's shots the area's name is a fragment at the sheet's left edge — «Sa» at
887, «P» at 768 (`e195r/shots-204/887-sales.png`, `768-product.png`). E193.16's own OWED
photographed «Sales» half covered too, and that WAS a defect: the column there was the app's
permanent posture at that width, with no scrim, over work a person was still meant to use, and the
header stayed clipped for as long as they worked. This is a dismissible layer with a scrim over
inert work and one tap out, which is what an overlay looks like in every product that has one — the
page behind it keeps its shape. **OWED, and stated rather than smuggled:** the bar COULD shed its
name and the launcher's word for as long as a layer stands in front (nothing else the person can
see would move — the day is left-aligned and stays put), and the only thing that costs is a piece
of state the shell does not have today: `stateCopilotOpen` reports `open && !inFront`, so the day
bar cannot tell a sheet standing from an agent away. If the fragment reads badly to Peter, that is
the fix, and it is a change to the shell's state plumbing rather than to this rung.

⚠ **REPEALS E193.16's `screen`.** From 601 to 1095 the agent used to BE the window — 1095 px wide
at 1095, 416 px wide at 1096, so one pixel of browser width swapped the product for a different
one, against §195. Its reason («the desk is already standing its own two panes one at a time here,
so there is no room to put a third thing beside them») reasoned about the wrong pair: the panes
stack because they cannot both stand, and the question the agent asks is whether ONE honest pane
and the conversation can. At 900 the work keeps 484 px, which is over its own floor. The centred
`maxWidth` cap that lived inside the takeover goes with it — a box that keeps the conversation's
measure has nothing left to cap.

**THE OWED IS CLOSED (E193.16).** It read: «the live app's copilot is the desk grid's THIRD COLUMN,
so the work reflows beside it — the kit's column DOCKS over the work instead, because the shell's
frame is not this package's territory», and the audit photographed the cost («Sales» in the day bar
half covered, the right pane gone behind the column, the launcher it was opened from underneath it).

`shell/frame.tsx` reserves the track now — `${railWidth}px minmax(0,1fr) ${copilotTrack}px`, the
column's own width read from `useCopilotTrack()` so the track and the thing standing in it can never
disagree — and the column is a real grid item in it rather than a layer over it. **Sticky, not
fixed**: the frame is exactly 100vh only while a surface is in PANES, and on the settings seats the
page grows and scrolls, where a 100vh item in a 3.000px row would take its composer off the bottom
of the world. The rail solved the same problem the same way.

**And the ROOM then decides the rung.** §103's ladder reads the width minus this track, so a 1366px
desk with the agent open has 886px of work — the stacked rung's room, not the compressed rung's —
and the panes stand one at a time instead of squeezing a 640px document into 494. The housing
question (`usePhone`) stays the window's: no docked column may put phone furniture on a desk. The
reserve is read off the WINDOW, never off the room, because a reserve that shrank the room deciding
it would oscillate forever.

**`desk-wide` moved from 1440 to 1728, and the number is derived** — 216 + 416 + 1096, the room two
honest panes need (`COPILOT_RAIL + COPILOT_COLUMN + STACK_MAX + 1`). 1440 was right while the column
was an overlay costing the work nothing; as a track, 632px of a 1600px desk is forty per cent of the
screen and the desk lost BOTH its panes to a list of past sessions.

**⚠ ONE BACK STEP PER LAYER, found here.** Reserving the track makes the frame re-render when the
agent closes, and `useHistoryLayer`'s write effect re-runs on every render (its `snapshot` is a
fresh object at nearly every call site). `history.back()` is asynchronous, so the second run saw the
layer still on the stack and popped AGAIN — two steps out of a one-layer stack, off the app's own
first entry, and the drive photographed a white screen with `localStorage` denied. The guard is in
`app/navigation.ts`, where it protects every layer rather than the one that happened to expose it.

## 2 · Sessions

```ts
type CopilotSession = {
  id; title; createdAt; updatedAt;
  origin: 'general' | 'supply' | 'catalogue';   // the door that opened it
  context: AssistantContext;                     // product / products / category / order
  messages: CopilotMessage[];
  flow?: { report?: OperatorReport; review?: SupplyReviewDraft };
};
```

- **Where they live.** `localStorage['rocoto-copilot-v3:<sector>']`, per tenant, newest first. A
  tenant switch reads that tenant's own list and stands the current one down.
- **⚠ Custody.** This is the Kit's own memory, never an authority. Production history is an
  authenticated, tenant+operator-scoped retained object with a retention policy; a browser store is
  not that, holds no evidence, and is shared with nobody. A browser that refuses to store SAYS so
  (`assistant-save-error`) instead of painting a durable «saved».
- **Only work is written.** Opening the agent, switching session and New write nothing. A door
  STAGES its session — first turn, card and all — in memory; the first real act commits it whole.
  A door pressed and abandoned files nothing, so the list never fills with rooms nobody entered.
- **Which session a tab is in is a fact about the TAB**, deliberately absent from the store: two
  windows may sit in two sessions without moving each other.
- **The revision guard** is the assistant's, kept: a write states the revision it replaces, so a
  second tab that moved the store underneath this one is refused with a sentence rather than
  clobbered. The `storage` event reads the other tab's write back, so both windows are one agent.
- **The list is the person's**: every row carries Forget, and forgetting is immediate.
- **Titles** are the first thing said in the session, cut to a row's measure; times are the short
  form, because a stamp with seconds in it takes three lines of a 216 px rail.

## 3 · Messages

```ts
type CopilotMessage = {
  id; at; role: 'operator' | 'copilot'; text;
  activity?: Activity[];      // short completed/pending/blocked rows off REAL results
  card?: CopilotCard;         // a flow mounted inside this turn
  proposal?: { id; revision; digest; receipt? };   // the receipt of a reviewed send
  dictated?: boolean;         // the words were spoken, and the turn says so
};
```

The operator's turn is a small card on the right; the agent's is prose on the paper — one voice
reading down the page, which is the shape the port settled on («less like chat, more like AI»).
Activity is a disclosure, never a chain of thought and never a progress animation: its rows name
what was read and how many rows it came from.

## 4 · The composer contract

Ported from `app.soyrocoto.com/src/chat/Composer.tsx`'s **editor** variant and
`composer-editor.css`:

- **One box.** The writing surface on top, a control row beneath it. The BOX owns focus (its border
  thickens); the field's own ring is suppressed, because two chromes for one control is what the
  app measured and removed.
- **Send is always present**, dimmed until there is something to send — never swapped away for the
  mic. That swap is the *pill's* law (a voice note IS the message there); here the mic **dictates**.
- **The mic is beside send, as a drawing rather than a disc.** Press and hold; a take replaces the
  writing surface and the recorder owns the row, exactly as the kit's Voice Button is drawn for.
- **Enter sends · Shift+Enter breaks the line.** The editor grammar, not the chat one. A phone says
  «Hold the mic to dictate into the box» instead, because a phone has no Shift.
- **Growth is measured, not counted:** the field takes the height of what is in it up to seven
  lines and then scrolls, computed off the element's own line-height so it follows the type scale.
- **It is mounted when the column opens.** An element inside a `display: none` dock measures 0, and
  a composer that wrote `height: 0px` once is a writing surface with no writing surface in it
  (seen at 1600, fixed, and the app's own A21 note says the same).
- **Dictation is honest.** The take goes to Deepgram nova-3, Spanish, through the kit runtime
  (`runtime.transcribe`). `data-dictation` states the machine: `idle · working · said ·
  unreachable · no-microphone · failed`, and the line beside the box says what to do next —
  **«Runtime offline · type the words here.»** when the service is absent. A fabricated
  transcript is never an option, and typing stays usable through every one of those states.
- **The seam stays.** A host that supplies `AssistantRuntimeAdapter.dictate` wins over the kit
  runtime; approved transport only, and no browser SpeechRecognition fallback.

## 5 · What the agent may act on

> **Superseded by [THE-OUTPUTS-SPEC.md](THE-OUTPUTS-SPEC.md) OUT-05.2** (E200 · FEED-IA §202).
> Opening a conversation is reading, so the Copilot’s «Open chat» and «Open the email» stand always; sending keeps its own authority. The history below is kept.

| It may | It may only propose | It may never |
|---|---|---|
| Save a catalogue category (`Save category`, with an exact target AND a recorded reason) | The supply message's wording, the affected-order selection, the alternatives | Send a customer message where `customerOutbound` is unverified — the review then reads **Draft only** and offers the native doors |
| Record a supply report as evidence on the session | A stock correction (it hands over to the Stock workflow and returns) | Count stock, subtract a lot, reserve a substitute, change a price |
| File, retitle and forget its own sessions | | Claim a delivery a receipt did not confirm: the receipt is checked against the proposal id, digest, sector, revision and the exact recipient set, and a mismatch records nothing as sent |

A turn's words never grant authority. Only a card's own explicit control acts, and each of them is
capability-gated where the capability exists.

**The one act that leaves the house has a server boundary, and it is unchanged by this release:**
`specs/intelligence/v1/assistant-action.schema.json` (`assistant.supply_dispatch.request` /
`.receipt`). The kit's client seam mirrors it exactly — a proposal id, a text digest, the sector,
the revision and the exact recipient set — and a receipt that does not match any one of them
records nothing as sent. tenant_id is resolved from authenticated server scope; the browser's
sector is never accepted as one.

## 6 · The doors

> **Superseded by [THE-OUTPUTS-SPEC.md](THE-OUTPUTS-SPEC.md) OUT-05.2** (E200 · FEED-IA §202).
> The Copilot opens a chat and an email inside the app through the shell’s own openers. The history below is kept.

`openAssistant({ kind, context })` — dispatched by the day bar's launcher (`general`), the stock
toolbar's «Report supply issue» (`supply`), a category row's «Discuss category» and the Product
Sheet's category Edit (`catalogue`).

- `general` **resumes**: a person pressing the agent's own mark is coming back to it, so the session
  they were in opens. New is a control, never a side effect.
- `supply` / `catalogue` **stage a session**: the person's own context sentence is the first turn,
  and the agent's answer carries the flow's card. The composer stays live beside it, so a person can
  keep talking while a review is open. There is no mode and therefore no way back out of one.

## 7 · What the port deliberately left behind

- **«pensando…» — until E198.** The live app shimmers a thinking line while its server thinks. The
  kit had no model behind it, so a thinking state would have been a picture of work that was not
  happening; answers were derived from this house's own records and each one showed the activity it
  read. **The runtime holds a mind now (§9), so the wait is real and the room says so** — in words,
  in the agent's own seat, §9.6. The offline posture keeps the records answer whole.
- **The face GIF** of the app's empty column: the kit's own mark stands there instead (one pack,
  §30).
- **The saffron send circle.** In this kit the accent marks Rocoto's own act and nothing else, and
  sending is the person's act, so send is ink. The accent is kept for the CARD's boundary, which is
  the agent's own hand proposing.

## 8 · Proof

`drives/drive-195-copilot.py` — eight viewports (1920, 1536, 1366, 900, 768, 393, 390, 360): the column's dock,
width and posture; the ruled paper's four layers and its absence everywhere else; the composer's
anatomy, its keyboard grammar, its growth and its 44 px floors; sessions filed only by work,
listed, reopened, **surviving a reload**, and left alone by New; the supply and catalogue flows as
cards inside the conversation with the composer live beside them; and the honest dictation state
with the runtime pointed at a port nothing answers on.

**AND `drives/drive-204-copilot-midwidth.py` holds the mid-width posture itself** (E195.30) at
thirteen widths — 601 · 612 · 613 · 640 · 768 · 887 · 888 · 900 · 1024 · 1095 · 1096 · 1366 ·
1600, all three boundary pairs
included: the agent's one measure, its head on top and its composer on the floor of its own column;
the work unobscured wherever a track is reserved (day bar, river, document, launcher all ending at
or before the column's left edge); the scrim and the head's Close each proven to be one tap out;
the sessions list behind its icon and opening over the thread below the head; the 44 px floors at
every width; and E192's row law under the narrowest room the agent leaves the work — one plan per
document, the identity at or above 160, the terminal above 88, nothing clipped, no sideways scroll.
**It walks the day bar on its own as well** — no agent standing, over the register's shortest name,
its middle and its widest (Sales 48 · Customers 95 · Your business 124) at 560 · 600 · 640 · 704 ·
1024 · 1366: the workspace's own mark stated whole on the element (the day moved to Sales' picker), the name stated whole wherever it is stated at
all, both rungs held in both directions, nothing standing on anything, and the line never taking
the page sideways.

**`drives/drive-198-copilot-mind.py` holds the MIND** (E198) at 1600 and 390, in three postures.
OFFLINE: the runtime pinned at a port nothing answers on — the Copilot says what it is reading, the
sentence carries no word about what is out of reach, the report card still opens and the review
still states the exact affected orders. RECORDED: the drive itself answers `/api/copilot`, and it
answers off the CONTEXT the kit sent — so the request is inspected whole (the day, the area, the
day's orders with their numbers and accounts, the floor, the session, the caps) and every proposal
kind is asserted where the surface draws it: the reply turn, its evidence line, the supply-report
card, «Open order» on an id that is on the book, the stock note as a line, and §196.9's drafts
prefilling the composer with nothing sent. LIVE: a local uvicorn of the real runtime with the
house's Gemini key — one real ask, a reply inside 30 s, a supply report, and every order it names on
the seeded day. Six-viewport screenshots come off the recorded posture, so the conversation in them
is the same conversation tomorrow. §200.3's one name is asserted in every posture.
**189 GREEN / 0 RED**, and RED-PROVED against the pre-E198 build (36 GREEN / 56 RED, led by «the Copilot says
what it is reading right here», «the ask reaches the runtime · None» and «no «Assistant» is visible
anywhere · Assistant | aria-label="AI assistant" | title="AI assistant"»). No regression:
`drive-195-copilot` 515 / 0 at its pin, `drive-204-copilot-midwidth` 923 / 0 at its pin.

**`drives/drive-202-phone-targets.py` sweeps the agent too** (E195.31): six scoped sweeps at
393 · 390 · 360 over the empty room, the conversation, the sessions list, the supply card, the
catalogue card and the row while a take is running, plus eleven of its controls measured by name.

## 9 · The mind (E198)

Sessions, the ported composer and cards that do real work made a body. What answered inside it was
`copilot/router.ts`: a keyword table, `hay.includes('short')`, and one fixed sentence. §196.2 asks
for «the same shit like all top agents», and a top agent has a mind. This section is that mind.

### 9.1 · Where it lives, and why it is not in the browser

In the kit runtime (`mock-api/app/copilot.py`; the wired product's mind is the backend's, STACK.md), behind `POST /api/copilot`, for the same reason
Parsewise, Deepgram, Places and Twilio are there: the kit is a static page and a static page cannot
hold a key. One seam, two providers, chosen by `COPILOT_MODEL` — Gemini 2.5 Flash answers today,
Claude Fable 5.1 is the first choice the moment the API credit exists (§199.3 · §199.6).
`/api/health` reports WHICH mind is standing — `gemini` · `anthropic` · `awaiting key` — because
those are three different products to the person reading the reply.

### 9.2 · The contract

The kit sends the desk as it stands; the mind sends back words and proposals.

```
POST /api/copilot
{ session: { id, messages: [{ role: "person"|"copilot", text, at }] (last 20) },
  context: { day, area,
             document: { number, customer, state, lines: [{ product, qty, unit, price? }] } | null,
             orders: [{ id, number, customer, customerId, state, flags: [string],
                        lines: [{ product, qty, unit }] }]   (≤ 40),
             stock:  [{ product, available, unit, expected? }] (≤ 60),
             customer: { name, tariff, rhythm? } | null },
  ask: string }
→
{ reply: { text },
  proposals: [ { kind: "supply-report", product?, orderIds: [id] }
             | { kind: "drafts", drafts: [{ orderId, customer, text }] }
             | { kind: "open-order", orderId }
             | { kind: "open-chat", customerId }
             | { kind: "stock-note", product, text }
             | { kind: "answer" } ],
  evidence: { model, ms, tokens } }
```

**The proposals are the shapes the surface already renders.** `supply-report` mounts §1's report
card — the one the keyword table already mounted. `drafts` is §196.9's killer feature and it lands
in the composer's own starter grammar: pressing a draft writes it INTO the box, where the person
edits it, speaks over it or deletes it, and the send stays theirs. `open-order` and `open-chat` are
controls on the turn. `stock-note` is a line. `answer` is the words alone. **Nothing new was
designed for the mind; the mind slotted in behind the surface.**

**The context is assembled from surfaces a person can already look at** (`copilot/context.ts`):
`useSupplyIssues` is the fold the stock screen draws, `flagsOf` is the judgement the river's rows
wear, the open document is the one in the address bar. So a reply naming «A-2452 · 40 kg» names a
row the person can go and check.

### 9.3 · Prompt discipline

- **The system prompt is a constant and the whole prompt is deterministic.** `build_prompt` reads no
  clock, no random source and no environment, so the same request builds the same two strings
  forever — and an edit to the Copilot's own words shows up as a diff in
  `backend/tests/fixtures/copilot-prompt.txt` rather than as a change in what the agent says on a
  Tuesday.
- **The prompt states who the Copilot is** (the house's operations copilot at a Spanish fresh-food
  distributor), **that it proposes and the person accepts**, **that every figure it states comes out
  of the context**, **that it answers in the app's language**, and **that every proposal names the
  orders it touches**.
- **Strict JSON out, validated, one retry.** An unreadable answer is fed back its own words and the
  exact complaint — a conversation rather than a louder repeat. Two unreadable answers stop there.
- **The caps live on the server as well as the client.** A cap that lives only on the client is a
  cap a different client does not have.

### 9.4 · What it never does

- **It never supplies a figure.** Quantities, prices, availability, order numbers, customer names
  and product names come out of the context. The model composes and chooses; it does not know.
- **It never names something the person cannot see.** `_ground()` drops any proposal naming an
  order, a customer or a product absent from the context that was sent — which is what makes «Open
  order» land on the right document every time, rather than most of the time.
- **It never acts.** §5 is unchanged: a card's own explicit control is still the only thing that
  changes anything, and a drafted message stops one press short of the customer.
- **It never fabricates on failure.** A missing key is a 503 with a name; a provider that fails or
  times out is a 502/504 with a name. Two unreadable answers earn one honest sentence and the
  `answer` proposal — never an invented supply report.

### 9.5 · The three postures

| Posture | When | What the person gets |
|---|---|---|
| **Live** | the runtime answers | the mind's words, grounded proposals, and the evidence on the turn |
| **Offline** | no runtime, or the runtime answered a failure | the Copilot says what it is reading right here and runs the flows it owns — the keyword table, kept whole, doing the job it always did |
| **Unreadable** | the mind replied twice in a shape the runtime could not read | one sentence saying what to do next, and the `answer` proposal |

The local answer leads with the result. Collapsed Sources retains its Workspace records basis and
the records used; Response details retains actual model timing/token evidence where a model
answered. The entrance explains the development workspace. This progressive disclosure follows
[the operations hub refinement](../app/src/prototypes/cedar/OPERATIONS-HUB-SPEC.md).

### 9.6 · The thinking state, now that it is honest

§7 refused a «pensando…» shimmer while there was no model behind the kit, because it would have
been a picture of work that was not happening. The mind is here and the call takes seconds, so the
room says so: one line, in the agent's own seat in the thread, in words — «Reading the day…» —
rather than three grey skeleton bars, because a skeleton is a picture of an answer's SHAPE and
nobody can know that yet. The ask in flight stands above it, and **neither is filed**: the store
still takes exactly one write of the person's words and the agent's answer, so a reload mid-thought
comes back to the conversation as it stood.

## 10 · One name (§200.3)

«Assistant» is gone from everything a person reads: the launcher's word, its `aria-label` and its
`title`, every heading and every sentence. The `data-testid="assistant-*"` handles stay, because a
testid is a handle for a machine rather than a word for a person, and five drives pin them.
`drive-198-copilot-mind.py` walks the whole DOM — text nodes, `aria-label`, `title`, `placeholder` —
and fails on the word.

---

## 11 · The yield, beside a document with prices (§200.3 · §200.4 · E199)

Peter, 2026-09-04, looking at `1536-supply-conversation.png`:

> the copilot: it's not meant to be a sidebar unless it's okay to load as a sidebar. Maybe that's
> fine for it to be compact when you don't have prices, but when you do have prices, I'm not sure
> … I don't know if you have tested what the albarán delivery note would actually look like when
> the copilot is open and actually has data. You need to make it actually work in terms of design
> and stuff, especially in the list of orders and stuff.

> notice how massive the fucking card is in that test of the copilot that you put. It's a bit
> confusing, no?

### 11.1 · What was measured

It had not been tested. On the E198 bundle, with the long-value albarán open (a six-digit quantity,
«unidades», a 40-character name) and the agent docked:

| window | room | the document's pane | the row |
|---|---|---|---|
| 1512 | 1096 | **511** — under its 640 | stacked |
| 1536 | 1120 | **535** — under its 640 | stacked |
| 1600 | 1184 | **599** — under its 640 | stacked |
| 1728 | 1096 | **511** — under its 640, and NARROWER THAN AT 1600 | stacked |
| 1920 | 1288 | 648 | stacked |

Three failures in one table. **The document went under its own snug measure** at four of the five widths
measured — the dishonest narrowing §103 exists to ban, on the one surface §192–§195 spent four
releases pinning. **It was not monotonic**: 1728 handed the document less room than 1600 did,
because `desk-wide` reserves 632 there — the same «one pixel of browser width swapped the product»
defect E195.30 killed at 1095. And at 1366 the docked column dropped the room to 950, which is the
stacked rung, so opening the agent took **the river** off the screen outright — «especially in the
list of orders and stuff».

### 11.2 · The two rungs, derived

```
   208   the rail at rest on a desk (RAIL_EXPANDED — a desk boots with the rail open)
 + 392   the river pane's floor (LIST_FLOOR)
 +   8   its overlay scrollbar, counted exactly as DESK_FLOOR counts it
 + 640   the document's snug measure (SHEET_SNUG) — a line's fields on ONE row before any wrap
 ────
  1248   PRICED_WORK_FLOOR — the room a priced document and its river cannot go under
 + 416   the conversation (COPILOT_COLUMN)
 ────
  1664   COPILOT_PRICED_DESK_MIN — at and above this the agent may stand BESIDE the work
```

```
  1440   what the desk needs to keep BOTH panes at their FULL anatomy (WIDE_MIN — the sheet's 720)
 + 216   the sessions rail (COPILOT_RAIL)
 + 416   the conversation
 ────
  2072   COPILOT_PRICED_RAIL_BESIDE — and only here may it also bring its history
```

**The rail's rung is read off the top measure, not the floor, and that is deliberate.** A list of
past sessions is the least load-bearing thing on the screen, so it is paid for out of SLACK. Read
off the floor the number is 1880, and at 1920 the rail stood and took the document from 687px of
card to 607 — a wider screen showing a narrower document, which is the defect this section exists
to close.

**And it is ONE threshold, not a hole.** A rule that docked below 1512 (where the room falls to
`stacked` and the document takes the whole box) and again above 1664 would leave a 152px band of
sheet between two bands of column: a person dragging a window edge would watch the product change
twice. Below 1664 the agent is the sheet E195.30 already built — in front of the work, with the
scrim, one tap out — and because a sheet reserves no track, **the work keeps the line it had**: the
river with its rows, its flags and its acts, and the document at its own measure.

**What declares the fact.** `usePricedDocumentDeclared(pricingAvailable)` from a layout effect in
`detail.tsx`, and there only. It reads the CAPABILITY rather than «has at least one priced line»,
because the latter would reflow the layout under the hand that was typing a price in; and it counts
rather than flips, because React runs a leaving effect's cleanup after the arriving one's effect and
a boolean would let a surface on its way out switch off a document that is still standing.

⚠ **The nascent card deliberately does not declare it, and that was measured rather than argued.**
It did for one round — the composer is the albarán one moment earlier — until the drives
photographed the cost: that card is the sales pane's RESTING content, so the agent yielded to a
sheet at every width under 1664 on `#/sales` with nothing open at all, against Peter's own «maybe
that's fine for it to be compact when you don't have prices». What a person gets instead is the
posture the stacked desk already has: at 950 and 1024, pressing «New albarán» opens the ASK SHEET
(`data-ask=yes`) over the river (§75.7), which is what the agent's own rung leaves at 1366 and at
900 too — and `drive-199` asserts the compact frame on that sheet as well as on the pane's card.

**⚠ OWED, and stated rather than smuggled: an ALREADY-OPEN composer does not survive that reflow.**
Press «New albarán» at 1366 and then open the agent: the track drops the room to 950, and
`areas/sales.tsx`'s `React.useEffect(() => { if (pushed) setComposing(false); }, [pushed])` — there
so the desk's §66.3 landing composer does not stand where the river should — fires on the reflow
and CLOSES the card instead of converting it. Two lines away is the conversion it should reach:
`composerSheet = pushed && composing` mounts exactly the ask sheet a fresh boot at 950 gives. The
fix is to tell a composer somebody OPENED from one that is only the pane's landing, and that is a
change to this surface's own state rather than to the agent's rung, so E199 states it and leaves
it. Nothing is lost that the ledger does not hold — a named draft is in the drafts door — but the
person is put back on the river without asking.

### 11.3 · The Copilot's own cards are rows (§200.4)

Every affected order in a supply conversation was a seven-line poster: the name, an accent line
saying it was selected, the asked/available line, a «Message preview» label, the WHOLE customer
message as a paragraph, and the acts. The message was identical on every row — the card's own
wording field states it once — so each row re-printed the one fact the card had just stated, in the
tallest way available.

A row now, in the row law's own grammar: **the identity** on the first line · **the quantities and
the day** small under it, the day said the way the house says it («Friday 22.08», never the id) ·
**the row's own first line of message** as a one-line preview, clipped — it is on the row only
because the quantity in it is theirs · **the acts** as compact text on one line. The count is
stated once, at the head of the rows it counts. **≤ 96px on a desk**, measured; taller on a phone
only because INTX-12 puts a 44px floor under every act. The drafted replies (§196.9) are the same
row, with «Use draft» as their act.

### 11.4 · The new albarán's frame (§200.4)

«Whose albarán» drew three skeleton rows, a ghost total and two grey placeholder buttons under its
four intake doors. §83.1 asked for that structure and was right about the card it was written
against — a head with a placeholder and nothing under it. That card is gone: the four doors
(§196.5) stand between the name and the lines now, so the structure a ghost was drawing is already
on the card in controls a person can press, and three grey rows under them read as «this document
is loading» — the one meaning `src/rocoto/ghost` exists to avoid.

The frame is the head, the four doors on one row with **«Lines appear here once the paper is
read»** riding the same band, and the foot stating «0 lines». **261px at 1600** — head 93 + intake
band 117 + foot 49 + two hairlines — against **487** measured on the published kit, 254 of which was
grey. It grows when there are lines to grow for.

The sentence rides the doors' band rather than standing in one of its own, because the doors and it
are ONE idea — here is how the paper gets in, here is where it lands — and a band of its own put a
third rule across a card that has said nothing yet, for 32px of padding around a 20px sentence.
**The brief asked for 240 and the card is 261**, which is stated rather than shaved: each of the
three bands is one idea at the theme's own padding, and reaching 240 would mean giving this card
paddings no other card in the kit has.

### 11.5 · Proof

`drives/drive-199-copilot-with-data.py` at 1366 · 1536 · 1600 · 1920 (+ 1700 and 2100 for the
document alone, so every posture family has two members, + 390): the posture the priced ladder
states and the track the frame reserves; the document never under its own measure and never
narrower in a wider window standing in the same posture; the row law inside the room the agent
leaves (one plan per document, the unit price under the total right-aligned, nothing clipped, no
sideways scroll); the river's rows keeping their identity, their flags and their acts; the agent's
rows inside 96px with every text line on one line box; and the compact frame with no skeleton row,
no grey button and one sentence — on the pane's own card where two panes stand, and on §75.7's ask
sheet at 1366 · 900 · 393 · 390 where the desk stands one. **210 GREEN / 0 RED.**

**RED-PROVED against the published kit** (`ROCOTO_URL=https://kit.soyrocoto.com/app.html`,
`ONLY=1600,900`): **23 GREEN / 14 RED**, led by «the document never goes under its own snug measure
· card 551 ≥ 592», «the agent takes the posture the priced ladder states · desk vs sheet», «a sheet
reflows nothing: the document keeps the width it had · 687 → 551», «§200.4 · no skeleton line rows ·
3», «no grey placeholder buttons under it · 1», «one sentence says what comes · None» and «the empty
frame is inside 264px · 487».

**No regression:** `drive-192-row-plan` 240/0 · `drive-193-sticky-head` 142/0 · `drive-195-copilot`
515/0 — all three at their pins. `drive-204-copilot-midwidth` re-pinned: it opens `d1-cansole`
half-way through its walk, so from that press it is held to the PRICED ladder, and 1366 and 1600
draw the sheet where they used to draw a docked column over a document squeezed to 511 and 599.
`drive-75.py`'s §83.1 walk is re-pinned to §200.4.
