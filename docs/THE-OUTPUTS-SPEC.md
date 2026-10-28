# THE OUTPUTS SPEC — templates, the day's buttons, the print screen, and the paper's readers

**E200 · written 2026-09-05 · normative for the English design kit (`kit.soyrocoto.com/app.html`).**

**Current source (2026-09-08):** this output design belongs to the
[Cedar candidate](../app/src/prototypes/cedar/README.md), maintained under
[`app/src/prototypes/cedar/`](../app/src/prototypes/cedar). File/line citations and the OUT-09
implementation plan describe the September 5 inspection. Preserve those references as dated
evidence; compare the current source and [release evidence](omitted-sources.md) before selecting
remaining work.

This document is the single architecture for everything the house sends OUT of Rocoto: paper,
files, email, and the marks the paper carries back in. It supersedes the output sections of
[THE-EXPORT-CANON.md](omitted-sources.md) named in OUT-09, and it is written to be BUILT FROM —
a stranger who reads only this file can build every screen in it.

Its law is FEED-IA §202 (`notes/FEED-IA.md:5500`). Every rule below quotes the phrase of §202 it comes from, once, in the
section that owns it. Every claim about the code as it stands today carries the file and the line.
Every number is measured or marked **to measure**.

Read beside it: [THE-QR-SPEC.md](THE-QR-SPEC.md) (the mark on the packing paper),
[THE-COPILOT-SPEC.md](THE-COPILOT-SPEC.md) (the acts that open a chat and an email),
[THE-PRODUCT-SHEET-SPEC.md](THE-PRODUCT-SHEET-SPEC.md) (artwork on a product),
[Cedar's print workflow](../app/src/prototypes/cedar/PRINT-WORKFLOW.md) (delivery-batch scope,
attempt lifecycle and executable proof), and
[THE-ENGLISH-DESIGN-BACKLOG.md](omitted-sources.md) §E200 (the rows this spec feeds).

### 2026-09-10 delivery-batch amendment

The export centre opens on the work a dispatch team is about to do: **prepare upcoming
deliveries**. Its first view shows the next delivery time, the time until that delivery, a compact
timeline of upcoming stops, and two document actions: **Delivery notes** and **Packing list**.
The packing list is a first-class working document and keeps the packing contract in
[THE-PAPER-SPEC.md](THE-PAPER-SPEC.md): goods, quantities, checkboxes, the handwritten final-weight
seat in one-column layout, truck grouping, capture marks, and operator-confirmed completion.

Every batch preview carries its boundary into the print screen. A person can switch **Remaining**
or **All ready**, then choose a **Day**, **Range**, or **Selected** deliveries before opening the
browser print dialog. The resolved sale ids are frozen into the existing `PrintSubject`, print
attempt and template-revision records. Packing remains complete only after the operator confirms
the captured revision. The interface never infers a print from elapsed time.

The template library is the secondary management surface under **Templates**; **New template** is
tertiary. OUT-02's earlier rule that the library is the first view is superseded by this amendment.
OUT-01's template model, OUT-04's shared Preview/Edit screen, the queue/history contract and the
paper/capture rules remain normative.

In Sales, each sticky day header carries up to two configured document buttons. Pressing one opens
the intended document in the shared print screen. Scope is changed there; the former adjacent eye
and chevron controls are retired. Day headers use the surface's 400 ms settle and remove that
transition under `prefers-reduced-motion`.

---

## OUT-00 · The law, and the architecture in one paragraph

### OUT-00.1 · Peter's words, verbatim (FEED-IA §202.4 and §202.5)

> **§202.4 · The phone print screen** is full-screen, with previous/next findable, and feels right.

> **§202.5 · Templates are one architecture.** The albarán and the packing sheet are CATEGORIES of
> templates. Every template is editable, the two that ship (an albarán, a packing sheet) included;
> a house can add custom ones. The export centre makes it obvious where to tap to edit a saved
> template; the day's buttons are configurable, up to two, chosen in the export centre, albarán +
> packing by default; «Preview» lands on the same screen where the template is edited.

And the transcript those two were read from, kept because the build reads the sentence rather than
the summary:

> also the packing sheet and the albaran shoudl eb categories of templates. they should configure
> the format of them. and i they want any other templates they can i guess make custom ones? or
> should all be treated as custom and the ones that ship default are an albaran one and a packing
> sheet whch they can edit. currently thr place where the templates button is weird and the feel of
> the whole export thing can be improved. shpuld be obvious where to tap to edit the ones they have
> saved to their library. Also, the ones in the daily list should be also configurable. they can
> have up to two buttons, and they can i guess toggle which two via the export. we ship with the
> albaran and packing by default. if they hit preview that takes them literally to the same place
> where they can edit the template. get it? all part of the same architecture

### OUT-00.2 · The architecture

**Every output is a TEMPLATE, and every template stands in a CATEGORY.** A category says what kind
of document this is — `albaran`, `packing`, `day-sheet`, `file`, `email` — and decides which
renderer draws it and which settings it offers. A template says how THIS house draws that kind:
its paper, its fields, its head and foot, its marks, its name. Two templates ship, one in the
albarán category and one in the packing category, and both are ordinary editable templates rather
than fixed documents. A house adds more by starting from a category or by duplicating any template
it already holds. **The export centre is the library** — every template the house owns, grouped by
category, each row opening the one screen where that template is edited. **The day's buttons are
two chosen templates**, picked in that library, albarán and packing on a fresh house. **Preview and
Edit are one screen**: the paper as it will print, with the template's settings beside it on the
desk and behind a control on the phone, and a Print act at the foot of both. One object, one
library, one editor, two ways in.

---

## OUT-01 · The template model

§202.5: «The albarán and the packing sheet are CATEGORIES of templates.»

### OUT-01.1 · What stands there today, and what it costs

The kit already has an object called a template and an object called a saved copy, and the
distinction is written into the code at `app/src/prototypes/cedar/shell/printing.tsx:126`:

> «A template is a starting point. A saved copy is the configured copy people actually run.»

So today a template is a fixed seed a person copies FROM, and only the copy is configurable. That
is the sentence Peter's ask is aimed at: «they should configure the format of them» and «obvious
where to tap to edit the ones they have saved to their library». E200 collapses the two objects
into one. A template IS the thing people run, the thing they edit, and the thing that ships.

Three facts about today's code decide the shape of the new model, and each is a defect the model
closes:

1. **The renderer obeys a house-wide layout profile, and no shipped screen can change it.**
   `PrintLayoutProfile` (`app/src/prototypes/cedar/print-layout.ts:7`) holds the albarán's three field
   toggles and the packing sheet's columns, grouping and sort; it is stored once per sector under
   `rocoto-print-layout-v1:<sector>` (`print-layout.ts:19`) and read by every print
   (`browser-print.tsx:249`). The editor that would change it, `PrintLayoutEditor`
   (`shell/printing.tsx:435`), is **defined and never rendered** — the `View` union at
   `shell/printing.tsx:1744` holds no `layout` member — and `savePrintLayout`
   (`print-layout.ts:53`) is **imported at `shell/printing.tsx:27` and called nowhere in the app**.
   Every house therefore prints `PRINT_LAYOUT_DEFAULTS` (`print-layout.ts:13`) forever.
2. **The layout a saved copy stores never reaches the paper.** `SavedOutput.layout`
   (`shell/printing.tsx:143`) is written by the configuration form (`shell/printing.tsx:1544`,
   values `Standard` · `By truck` · `Customer A–Z`) and read in exactly one place: a chip on the
   card (`shell/printing.tsx:1339`). `requestPrint` (`shell/printing.tsx:1618`) passes
   `capturedLayout`, which is the sector-wide profile, so the chip states a setting the printer
   never sees.
3. **A copy's paper silently rewrites the house default.** `requestPrint` at
   `shell/printing.tsx:1622` calls `setPrintSetup({ paper: output.paper, copies: output.copies,
   set: true })`, so running one saved copy changes `PrintSetup` (`print-queue.ts:167`) for every
   other print in the house.

### OUT-01.2 · The template

One record. Stored per house, one list, ordered by the house's own hand.

| Field | Type | Says |
|---|---|---|
| `id` | string | Stable identity. Shipped templates take `albaran-default` and `packing-default`; a new one takes `<category>-<epoch>`. |
| `category` | `'albaran' \| 'packing' \| 'day-sheet' \| 'file' \| 'email'` | Which renderer draws it and which settings it offers. Fixed at creation; a template never changes category. |
| `name` | string, 1–48 chars | What the house calls it. Shown in the library, on the day's button, and as the print job's title. |
| `paper` | `'A4' \| 'A5'`, on the three paper categories | This template's own sheet, and the pair `PRINTABLE_PAPERS` (`shell/printing.tsx:243`) already names. A `file` or `email` template carries no paper, because it produces none. |
| `copies` | `1 \| 2 \| 3`, on the three paper categories | How many of every sheet. `COPY_STEPS` (`print-queue.ts:165`) already holds the three. |
| `layout` | `TemplateLayout` | The fields and the order — OUT-01.3. This is `PrintLayoutProfile` moved onto the template. |
| `head` | `{ house: boolean; logo: boolean; note: string }` | What the masthead carries. `note` is a single line the house may add, 0–80 chars, printed under the address block. |
| `foot` | `{ note: string; pageNumbers: boolean }` | `note` 0–120 chars, printed under the rule at the foot of every page. |
| `marks` | `{ qr: boolean; corners: boolean }` | The capture marks — OUT-01.5. Held `true` and read-only in the `packing` category. |
| `language` | `'en' \| 'es'` | Which language this template's own printed labels take. It follows the house's language until a person sets it; a house that ships Spanish paper to a Spanish customer from an English app sets it here. |
| `dayButton` | `0 \| 1 \| undefined` | Which of the day's two seats this template holds — OUT-03. |
| `revision` | integer | Rises by one on every saved edit. |
| `updatedAt` / `updatedBy` | ISO string / string | Who last touched it. Shown in the library as «Edited 3 Sep by Marta». |
| `createdAt` / `createdBy` | ISO string / string | Kept for the same reason the saved copy keeps them (`shell/printing.tsx:151`). |
| `lastUsedAt` | ISO string, optional | The last time this template printed or sent. Shown in the library row. |
| `archivedAt` / `archivedBy` | optional | An archived template leaves the library's sections and stands in «Archived · N», which `ArchivedCopies` (`shell/printing.tsx:1354`) already draws. |

### OUT-01.3 · `TemplateLayout` — the «Paper & copies» choices become the template's own

Today's «Paper & copies» card (`shell/printing.tsx:381`, title at `:431`) is a HOUSE default with
two settings, paper and copies. Under this spec those two move onto the template, and the fields
`PrintLayoutProfile` holds move with them. The card keeps its place as the house's *default for a
new template* and says so.

```ts
type TemplateLayout =
  | { kind: 'albaran'; fields: { finalWeight: boolean; unitPrice: boolean; lineTotal: boolean } }
  | { kind: 'packing'; columns: 1 | 2; groupByTruck: true; sort: PackingSort }
  | { kind: 'day-sheet'; stops: 'route' | 'customer' }
  | { kind: 'file'; format: 'CSV'; columns: string[]; columnLabels: Record<string, string>; fileName: string }
  | { kind: 'email'; recipients: string; timing: string; timezone: string; attachments: string; reviewRule: string };
```

These are the same fields THE-SYSTEM-SPEC's own document profile already names
(`notes/THE-SYSTEM-SPEC.md:1766`–`:1769`): «optional albarán **Final weight**, **Unit price**, and
**Line total** fields plus packing **1 column** or **2 columns**, mandatory truck grouping, and
**Route order**, **Customer A–Z**, **Order value**, or **Lifetime value** sorting within each
truck.» E200 moves that profile from the house onto the template and changes none of its members.

Every field above already exists. `albaran` and `packing` are `PrintLayoutProfile['albaran']` and
`['packing']` verbatim (`print-layout.ts:9–10`); `PackingSort` is `'route' | 'customer' |
'order-value' | 'lifetime-value'` (`print-layout.ts:3`). `file` and `email` are the `SavedOutput`
fields of the same names (`shell/printing.tsx:134`–`:163`). The work is a MOVE, not an invention: the
same union, read from the template instead of from a sector key.

Three rules govern the move.

- **The renderer reads the template.** `printSourceRun` (`browser-print.tsx:222`) already takes
  `layoutProfile`; it takes the template's `layout` instead of `readPrintLayout(sector)`
  (`browser-print.tsx:249`). A captured print attempt freezes the template's layout exactly as it
  freezes the profile today, so an attempt reprinted later draws the paper it drew then.
- **`groupByTruck` stays `true`.** It is `true` in the type today (`print-layout.ts:10`) and the
  editor draws it as a pressed pill with an empty handler (`shell/printing.tsx:473`). A control
  that cannot move is a control the library shows as a stated FACT — «Grouped by truck» as a line
  of text under the sort — rather than as a pill offering a choice.
- **A price field follows the workspace.** `unitPrice` and `lineTotal` stand available while the
  workspace carries pricing and the albarán is valued, which is the `valued` gate the editor
  already has (`shell/printing.tsx:461–462`). Where pricing is away, the two fields read «Prices
  arrive with the pricing workspace» and stay put.

### OUT-01.4 · The two that ship

Both are ordinary templates. On a fresh house the list is exactly these two, in this order, and a
person may edit, rename, duplicate or archive either.

**`albaran-default` — «Delivery notes»**

| Field | Shipped value | Comes from |
|---|---|---|
| `category` | `albaran` | `TEMPLATE_PAPER['delivery-notes'] = 'albaranes'` (`shell/printing.tsx:170`) |
| `name` | `Delivery notes` | `OUTPUT_TEMPLATES[0].title` (`shell/printing.tsx:176`) |
| `paper` | `A4` | `DEFAULT_SAVED_OUTPUTS[0].paper` (`shell/printing.tsx:186`) |
| `copies` | `1` | same line |
| `layout` | `{ kind: 'albaran', fields: { finalWeight: false, unitPrice: false, lineTotal: true } }` | `PRINT_LAYOUT_DEFAULTS.albaran` (`print-layout.ts:15`) |
| `head` | `{ house: true, logo: true, note: '' }` | `Identity` (`print-view.tsx:229`) draws the house band today |
| `foot` | `{ note: '', pageNumbers: true }` | the page count the albarán already prints (`print-view.tsx:1334`) |
| `marks` | `{ qr: false, corners: false }` | today the mark is drawn on the packing sheet alone (`print-view.tsx:1204`) |
| `dayButton` | `0` | the first of the day's two seats |

**`packing-default` — «Packing lists»**

| Field | Shipped value | Comes from |
|---|---|---|
| `category` | `packing` | `TEMPLATE_PAPER['packing-sheets'] = 'packing'` (`shell/printing.tsx:171`) |
| `name` | `Packing lists` | `OUTPUT_TEMPLATES[1].title` (`shell/printing.tsx:177`) |
| `paper` | `A4` | `DEFAULT_SAVED_OUTPUTS[1]` (`shell/printing.tsx:187`) |
| `copies` | `1` | same line |
| `layout` | `{ kind: 'packing', columns: 1, groupByTruck: true, sort: 'route' }` | `PRINT_LAYOUT_DEFAULTS.packing` (`print-layout.ts:16`) |
| `head` | `{ house: true, logo: true, note: '' }` | as above |
| `foot` | `{ note: '', pageNumbers: true }` | as above |
| `marks` | `{ qr: true, corners: true }` | OUT-01.5 |
| `dayButton` | `1` | the second of the day's two seats |

The third paper the app draws, the day sheet (`OUTPUT_TEMPLATES[2]`, `shell/printing.tsx:178`),
becomes a CATEGORY with no shipped template. A house that wants one adds it from the category, and
it may then take one of the two day seats like any other template.

### OUT-01.5 · Marks, and the packing category's floor

§202.5 leaves the mark where THE-QR-SPEC put it, and E200 states the rule as a template field so a
custom packing template can never ship paper the reader cannot resolve.

- **Every template in the `packing` category carries the mark.** `marks.qr` and `marks.corners`
  read `true` and stand as a stated fact rather than a switch. The library row and the editor say
  «Carries the capture mark», so a person knows what the paper will bring back.
- The mark's own geometry is THE-QR-SPEC's and stays in `PACKING_QR`
  (`app/src/prototypes/cedar/packing-output.ts:69`): scheme `rocoto:document/packing/v1/`, error correction
  `M`, quiet zone 4 modules, 76 px at 96 dpi = 20.1 mm, module 0.54 mm, floor 0.5 mm — the numbers
  QR-03 tabulates (`notes/THE-QR-SPEC.md:71`). It sits top right of the masthead with «Scan after
  packing» and the token in words beneath it (`print-view.tsx:180`, `:186`).
- Templates in the `albaran`, `day-sheet`, `file` and `email` categories offer `marks.qr` as a
  choice, held `false` on the two that ship.

### OUT-01.6 · Custom templates

Two roads in, and each ends on the same editor screen (OUT-04).

1. **From a category.** «New template» in the library opens a category picker — five rows, each
   naming what that category prints, with the real paper drawn beside it by `PaperMiniature`
   (`shell/printing.tsx:1310`). Choosing one creates a template pre-filled with that category's
   shipped defaults, named «<Category name> 2» where a template of that name already stands, and
   lands on the editor with the name field focused.
2. **From a template.** «Duplicate» on any library row copies every field, appends « copy» to the
   name, sets `revision` to 1, clears `dayButton`, `lastUsedAt`, `archivedAt` and `archivedBy`, and
   lands on the editor. This is the behaviour `onDuplicateOutput` already has
   (`shell/printing.tsx:2293`), with the two new fields cleared.

A house may hold any number of templates. The library sections stay legible past twenty rows
because they are rows rather than posters (OUT-02.3).

### OUT-01.7 · Versioning, and the manifest a template edit re-records

A template edit changes what the paper LOOKS like, and the paper's reader (§199.1) matches a photo
against what the house printed. So an edit has a consequence beyond the screen.

FEED-IA §199.1 (`notes/FEED-IA.md:5460`), the rule this derives from:

> the print already carries the mark (THE-QR-SPEC) and the house remembers what it put on the paper
> (QR-06); from now on it also remembers **where** — a layout manifest per page in millimetres
> (every order block, every line row, every cell, the QR and three corner marks).

**The rule.** Saving a template raises `revision` by one and re-records that template's print
manifest before the next sheet leaves it. A print attempt captures the template id AND its
revision, so a photo read back six weeks later is registered against the geometry that was on the
paper rather than against today's. This is the same discipline `packing-output.ts` already keeps
for the mark: `rememberPackingMark` (`packing-output.ts:139`) writes the locator, the day and the
document ids at the moment the mark is drawn, and QR-06 (`notes/THE-QR-SPEC.md:134`) resolves a
later read against the CONFIRMED-PRINTED revisions rather than against the run's current fold.

**The nearest rule that already exists** is THE-EXPORT-CANON's frozen-profile clause
(`notes/THE-EXPORT-CANON.md:2049`): «The selected profile is frozen into the browser-print artifact,
so opening, retrying or reprinting an older run cannot adopt later layout preferences.» That rule
freezes the LAYOUT into an attempt. E200 extends the same discipline to the GEOMETRY, which is what
a photograph needs.

**Where this rule lives.** The manifest's schema, its millimetre grid and its three corner marks are
[THE-PAPER-SPEC](THE-PAPER-SPEC.md) **PAP-02**, written and shipped at RELEASE-195; QR-06 governs the
mark itself. E200 states only what a TEMPLATE EDIT owes that geometry — the revision, and the
re-record before the next sheet leaves.

### OUT-01.8 · Storage, and the seam the runtime takes later

**Today: the browser.** One key, one house, versioned, with the same fail-soft reader the saved
outputs already use (`shell/printing.tsx:200`, `:201`).

```
rocoto:outputs:templates:<sector>   →   { version: 1, templates: Template[] }
```

A read that parses returns the stored list; a read that does not returns the two shipped templates.
A write that stalls returns `false` and the surface says so in its own words, which is the
`setSavedOutputs` contract (`shell/printing.tsx:1881`, `useSavedOutputs`) kept as it is.

Two keys retire into this one, and their data migrates on first read: `rocoto:export:saved-outputs`
(`shell/printing.tsx:129`) and `rocoto-print-layout-v1:<sector>` (`print-layout.ts:19`). A stored
saved copy becomes a template of the category its `templateId` maps to through `TEMPLATE_PAPER`
(`shell/printing.tsx:169`); the stored layout profile becomes the `layout` of every migrated
template of the matching category, so a house that had set a profile keeps its paper exactly.

`PrintSetup` (`print-queue.ts:167`) stays, and its meaning narrows to what it honestly is: the
DEFAULT paper and copies a NEW template starts from. The line that lets a saved copy overwrite it
(`shell/printing.tsx:1622`) goes.

**Later: the runtime.** The seam is named now so the builders leave it clean.
`GET /api/outputs/templates` and `PUT /api/outputs/templates/<id>`, tenant-scoped like every other
runtime route in THE-RUNTIME-SPEC. The reader and writer live behind two functions —
`readTemplates(sector)` and `writeTemplates(sector, next)` — and every surface calls those two, so
the day the runtime answers, one file changes. The manifest of OUT-01.7 posts to
`POST /api/outputs/manifest` from the same seam.

---

## OUT-02 · The export centre as the library

§202.5: «The export centre makes it obvious where to tap to edit a saved template.»

### OUT-02.1 · Where the «Templates» entry lives today, and why it reads wrong

Today there are FIVE doors to the same destination and they wear two different names.

| Door | Where | Label |
|---|---|---|
| `shell/printing.tsx:2323` | the export centre's HEAD, right side, beside Close | `Templates` |
| `shell/printing.tsx:1702` | inside the Print tab, beside «Saved copies» | `Use template` |
| `shell/printing.tsx:1703` | the dashed add tile in the Print grid | `Use template` |
| `shell/printing.tsx:1721` | inside the Files tab, beside «Saved copies» | `Use template` |
| `shell/printing.tsx:1722` | the dashed add tile in the Files grid | `Use template` |

Four things read wrong, and each is a rule from the skills applied to what is there:

1. **The head's door sits in the chrome, next to Close.** `better-layout` · *Order by importance*:
   the most important content sits near the top and the leading edge. A library's own door parked
   on the trailing edge beside the surface's exit is filed with «leave», not with «this is what you
   own». It also crosses `better-accessibility`'s breathing-room rule — a navigation control and a
   dismissal control sharing one 6 px gap (`scale200`, `shell/printing.tsx:2323`).
2. **One destination, two vocabularies.** `better-writing` · *Consistent flow vocabulary*: a flow
   uses one word throughout. «Templates» and «Use template» reach the same view
   (`setView('templates')`, `shell/printing.tsx:2323` and `onTemplates`,
   `shell/printing.tsx:2291`), so a person reasonably reads them as two different things.
3. **«Use template» is a verb-first label on a control that navigates.** `better-writing` ·
   *Verb-first buttons* asks a label to name its action; the action here is «open the library», and
   the label promises a document is about to be made.
4. **The word cannot carry Peter's ask.** By `shell/printing.tsx:126` a template is a seed you copy
   FROM, so «edit the ones they have saved to their library» has no target: the Edit button on a
   card (`shell/printing.tsx:1344`) edits the COPY. OUT-01 removes the second object, which is what
   makes the new placement possible rather than merely tidier.

### OUT-02.2 · The new placement

**Cedar live Prep supersedes this opening placement.** Its current contract is
[`PRINT-WORKFLOW.md`](../app/src/prototypes/cedar/PRINT-WORKFLOW.md): one scrolling surface — the
task frame's own — carrying a sticky delivery map with a raised preparation card over it, Print and
Download as the two primary acts, and Email schedules as the small utility act. The card keeps a
visible minimum at rest, has no scroll range of its own, and rides up over the map as that one
surface scrolls. The template library remains a secondary screen.

**The library IS the export centre's first view.** Opening the export centre lands on the templates
the house owns. The head keeps the title «Export center» (`shell/printing.tsx:2311`), the day and
salesperson filters (`shell/printing.tsx:2313`) and Close (`shell/printing.tsx:2323`); the
`Templates` button leaves the head, and the four «Use template» doors collapse into ONE primary
control at the top of the library, labelled **«New template»**.

The three destination tabs — Print · Email · Files (`shell/printing.tsx:1699`) — go. Their job was
to sort outputs by where they go, and a category already says that better and says it on the row
itself. What replaces them is one scrolling column of category sections, which is also what lets a
house with nine templates read its library in one glance.

### OUT-02.3 · Anatomy — the library

```
┌───────────────────────────────────────────────────────────────────┐
│ Export center                                        [Filters] [×]│
│ Monday 25.08 · 34 orders                                          │
│                                                                   │
│ Your templates                                    [+ New template]│
│                                                                   │
│ Delivery notes ─────────────────────────────────────────── 2 ─────│
│ ┌──┐ Delivery notes            A4 · 1 copy · Line total           │
│ │▤ │ On the day · seat 1       Printed 09:12 today                │
│ └──┘                        [Print 32] [Preview] [Edit]      [⋯]  │
│ ┌──┐ Delivery notes · no prices   A5 · 1 copy                     │
│ │▤ │                              Printed 3 Sep                   │
│ └──┘                        [Print 32] [Preview] [Edit]      [⋯]  │
│                                                                   │
│ Packing lists ──────────────────────────────────────────── 1 ─────│
│ ┌──┐ Packing lists            A4 · 1 copy · By truck · Route order│
│ │▤ │ On the day · seat 2       Carries the capture mark           │
│ └──┘                        [Print 34] [Preview] [Edit]      [⋯]  │
│                                                                   │
│ Files ──────────────────────────────────────────────────── 1 ─────│
│ Email ──────────────────────────────────────────────────── 0 ─────│
│                                                                   │
│ Archived · 2                                                  [›] │
│ Default for a new template · A4 · 1 copy            [Change]      │
│ Print activity · 3                                            [🕐]│
└───────────────────────────────────────────────────────────────────┘
```

**A section per category**, in this order: Delivery notes · Packing lists · Day sheets · Files ·
Email. The heading is the category's own plural name with its count on the trailing edge. A section
with no templates keeps its heading and holds one line — «A delivery note template prints one note
for each delivery.» — with «New template» beside it, so a person meets the category before they
own one. `better-writing` · *Empty states point forward*.

**A row per template**, and the row is the unit Peter asked for. Left to right:

| Slot | Content | Size |
|---|---|---|
| thumbnail | the real paper, drawn by `PaperMiniature` (`shell/printing.tsx:1310`) at `height: 72` on the desk and `56` on the phone | 51 × 72 desk · 40 × 56 phone — the height is chosen, the width is A4's own 210:297 applied to it |
| name | the template's `name`, `LabelLarge`, one line, `text-overflow: ellipsis` | fills |
| settings line | `paper · copies · the two or three layout facts` — «A4 · 1 copy · Line total» — `ParagraphXSmall`, `contentSecondary` | fills |
| seat line | «On the day · seat 1» where `dayButton` is set; the packing category adds «Carries the capture mark» | fills |
| last used | «Printed 09:12 today» · «Printed 3 Sep» · «Ready to print» before a first run | trailing, desk only |
| acts | `Print N` (primary) · `Preview` · `Edit` | trailing |
| overflow | `⋯` → Duplicate · Set as day button · Archive | 44 × 44 |

**Acts, and which ones earn a seat.** `better-layout` · *Order by importance* and `better-ui` ·
*Motion restraint* both say the same thing here: today's card carries SIX controls in two rows
(`shell/printing.tsx:1341`, `:1343`, `:1344`, `:1348`, `:1349`), all but one tertiary, so nothing
leads. The row carries THREE in the open — Print, Preview, Edit — and files Duplicate, Set as day
button and Archive behind one overflow control. `better-layout` · *Hint at hidden content*: the
`⋯` is that visible affordance, and it carries an `aria-label` naming its template
(«More for Delivery notes»).

**Grouping, measured**, in Base's own sizing scale (`scale300` 8 px · `scale600` 16 px ·
`scale900` 32 px). `better-layout` · *Group with space, not lines*: **8 px** between the lines
inside one row, **16 px** between rows, **32 px** between category sections — the 2× rule at every
level, and each step is a real token rather than a number typed here. The hairline under a category heading is the one separator
the layout keeps, because a heading and its count need a baseline to sit on.

**Which rules were applied, named.**

| Rule | Skill | Where it lands here |
|---|---|---|
| Group with space, not lines | `better-layout` | 8 / 16 / 32 px ladder above; one hairline per category heading and none between rows |
| Order by importance | `better-layout` | the library is the first view; Print leads each row; Duplicate and Archive move behind `⋯` |
| Keep controls distinct from content | `better-layout` | Print is `KIND.primary`; Preview and Edit are `KIND.secondary` with a border; the settings line stays plain text |
| Hint at hidden content | `better-layout` | the `⋯` control, and the archived section's own row with its count |
| Plan for growth and clipping | `better-layout` | no fixed width on the name; the settings line wraps to a second line rather than truncating; the row has `min-height`, never `height` |
| Minimum hit area | `better-accessibility` | every act ≥ 44 × 44, which `smallTarget` (`shell/printing.tsx:1334`) already sets; the whole row is NOT a target, so the three acts stay unambiguous |
| Breathing room between targets | `better-layout` | 12 px (`scale500`) between the three bordered acts, 16 px (`scale600`) before the `⋯` |
| Concentric border radius | `better-ui` | outer = inner + padding: the row takes `radius400` (12 px) and pads `scale300` (8 px), so the thumbnail inside it takes `radius200` (4 px) — 4 + 8 = 12 |
| Image outlines | `better-ui` | the paper thumbnail takes a 1 px outline at `oklch(0 0 0 / 0.1)` in light and `oklch(1 0 0 / 0.1)` in dark |
| Tabular numbers on changing values | `better-typography` | the `Print 32` count and the section counts take `font-variant-numeric: tabular-nums` |
| Truncate without losing content | `better-typography` | the name ellipsises at one line and carries its full value as the row's `title` |
| Empty states point forward | `better-writing` | every category section states what it prints and offers «New template» |
| One capitalization policy | `better-writing` | sentence case on every label and heading, which is what the surface already uses |

### OUT-02.4 · The two postures

**Desk (≥ 560 px).** The library is the export centre's `OverlayCard` at `size={800}`, centred —
`useWorkflowPlacement()` (`workflow-dialog.tsx:94`) returns `PLACEMENT.center` above `PHONE_MAX`
(`shell/viewport.ts:74`, 559). One column of sections; each row is a five-column grid
`51px minmax(0, 1fr) auto auto 44px` — the thumbnail's width, the name and settings, the last-used
column, the three acts, the overflow; the last-used column shows.

**Phone (≤ 559 px).** The same card docks — `PLACEMENT.bottom` — and E200 gives it the SCREEN
posture (OUT-04.3), so the library owns the viewport rather than growing to fit its content. The
row folds to two lines: thumbnail and name and settings on line one, the three acts and the `⋯` on
line two at 44 px. The last-used column moves into the settings line as a third fact. «New
template» becomes a full-width secondary control inset 16 px from both edges — `better-layout` ·
*Inset buttons from the edges*.

### OUT-02.5 · Empty states, in positive words

| State | What stands there |
|---|---|
| A fresh house | The two shipped templates. The library is never empty. |
| A category with no templates | The heading, its count `0`, one sentence naming what that category prints, and «New template». |
| Archived, with none | The archived row stays away until the house archives its first template, which is `ArchivedCopies`' rule today (`shell/printing.tsx:1357`). |
| A template whose day holds no orders | The primary act reads «Ready when orders arrive», which is today's «Waiting for orders» (`shell/printing.tsx:1695`) said forward. |
| A search or filter that lands nothing | «Try another search.» — the sentence the files list already uses (`shell/printing.tsx:1731`). |
| A write that stalls | The row keeps its values and the surface says «Saving this template stalled. Your changes are here.» — today's grammar (`shell/printing.tsx:1575`) with the negative removed. |

---

## OUT-03 · The day's buttons

§202.5: «the day's buttons are configurable, up to two, chosen in the export centre, albarán +
packing by default».

### OUT-03.1 · What stands there today

`DayPaper` (`app/src/prototypes/cedar/areas/sales.tsx:3173`) hard-codes exactly two controls and both of
their documents. The albarán control is `PrintFlush` at `areas/sales.tsx:3242`; the packing control
is `PrintFlush` at `areas/sales.tsx:3271`. Their handlers are written at the call site
(`areas/sales.tsx:5880`–`:5890`) and name their runs in code: `albaranRun` for the first
(`areas/sales.tsx:5881`), `packingRun` for the second (`areas/sales.tsx:5887`). A house cannot
change which two papers a day offers, and the export centre holds no control that would.

`PrintFlush` (`app/src/prototypes/cedar/detail.tsx:1033`) is the object both seats wear: three columns —
print · scope menu · paper — joined by a drawn seam (`detail.tsx:1086`–`:1098`), the mark naming
the DESTINATION rather than the act (`detail.tsx:1056`–`:1062`).

### OUT-03.2 · The two seats

**Up to two, and the house chooses both.** A template's `dayButton` field (OUT-01.2) holds `0`, `1`
or nothing. Seat `0` is the leading seat, seat `1` the trailing one. On a fresh house
`albaran-default` holds seat 0 and `packing-default` holds seat 1, which is the pair that ships
today, so nothing about the first morning changes.

**The two-slot rule.** «Set as day button» on a library row assigns the first free seat. Where both
seats are held, the control opens a two-row chooser naming what stands in each seat — «Seat 1 ·
Delivery notes» and «Seat 2 · Packing lists» — and choosing one moves that template in and returns
the previous holder to the library with its seat cleared. One act, one outcome, and the person sees
what they are replacing before they replace it. `better-writing` · *A confirmation button repeats
the consequence*: the chooser's rows read «Put Kitchen sheets in seat 1» and «Put Kitchen sheets in
seat 2».

**Clearing a seat.** The same overflow control on a template that holds a seat reads «Take off the
day». A day may run with one button or with none; a day with no buttons shows the export centre's
own door in their place, which is the control the header already carries
(`shell/printing.tsx:2415`).

**Archiving.** Archiving a template that holds a seat clears the seat in the same write, so the day
never points at a template the library has put away.

### OUT-03.3 · The tile, on the phone

The anatomy is E196.40's, answering §199.4 (`notes/FEED-IA.md:5463`), measured on `codex/english-e196-tiles` and pending merge (OUT-08.2). Two
tiles side by side on ONE row, each a `PrintFlush` in its `tile` posture:

| Measure | Value | Where it was measured |
|---|---|---|
| tiles per row | 2, `flexWrap: nowrap`, each `flex: 1 1 0` | E196.40, `areas/sales.tsx` `DayPaper` |
| tile size at 360 | 144 × 64 | measured 14 September 2026 on the repaired touch floor, both tiles equal |
| tile size at 390 | 159 × 64 | measured |
| tile size at 393 | 160.5 × 64 | measured |
| the press | the whole tile, one press (the scope and paper seats retired with §246) | measured at 360 |
| the day's head | 88 px, down from 100 | measured before and after |
| tile thickness | 64 px on a phone (`shell/frame.tsx`'s `[data-day-paper]` floor keeps the seat's own 64 above the 44 px touch floor); 56 px is §199's minimum, the number the drive holds; the albarán's own `THICK` (`TOUCH_FLOOR * 2`) stays in `detail.tsx` | measured 14 September 2026 at 360/390/393 and 124 × 64 at 320 |

Line one is the template's NAME. Line two is the mark and the count left to print. That order is
measured rather than preferred: a day's content is 296 px at 360, so a tile body is 100 px and its
words are 84 px, while «Packing lists» alone measures 71 px and «⎙ Packing lists» measures 91 px.
The name and the mark cannot share line one at 360 without truncating the name.

**The words each state takes**, all positive, carried from E196.40 with the template's name in
place of the fixed one:

| State | Line one | Line two |
|---|---|---|
| paper owed | the template's name | `⎙ 32 left` |
| held for review | the template's name | `To review` |
| every sheet out | the template's name | `All printed` |
| queued | the template's name | `Queued` |
| the day holds no orders | the template's name | `Ready when orders arrive` |

The `Aloud` region (`areas/sales.tsx:3236`) and the tile's `aria-label` keep the whole sentence, so
a screen reader hears «Delivery notes · 32 left» while the eye reads two lines.

**Both seats read the record.** Line one is `seat.template.name`, on the albarán seat and on the
packing seat alike, so the three places a seat states its name — the visible line, the
`aria-label` and the `Aloud` sentence — read one field. The packing seat drew the literal «Packing
list» for its category until 13 September 2026, so a house that had named its own packing template
«Bay list» read that name in the two spoken seats and the category's word in the seat itself. The
fresh house is unchanged either way, because `packing-default` is called «Packing list».
`drives/drive-200-day-seats.py` seeds a house holding «Van run» and «Bay list» and asserts both
words stand on the day. In Spanish the four shipped names are mapped where they are rendered, by
`snapshot/spanish-display-source.ts`'s `template.name` adapter, so a name a person typed passes
through untouched.

**What the count means.** It is the number of documents this template still owes paper for, on this
day, under this template's own scope. For an albarán template that is the day's unprinted or
changed albaranes; for a packing template it is the crates whose list the bay is still owed — both
counts come from one line, `areas/sales.tsx` `const owed = template.category === 'albaran' ? fresh :
template.category === 'packing' ? bay : …`, read where `count` is derived. A template whose count is
zero states its state and KEEPS a live press: the paper can still be looked at. A seat stands down
only where the day holds no orders at all (`onPrint: scope.length > 0 ? … : undefined`).

### OUT-03.4 · The desk posture

One row of two `PrintFlush` lockups, each the same two-line seat the phone draws (the three-column
row retired with the scope and preview controls, §246) — measured at 1366 as
140 × 56 and 123 × 56, re-measured 14 September 2026 (E196.40's own run read 211 × 28 and 225 × 28 before the seats retired). The tile posture is the phone's alone
(`usePhone()`, `shell/viewport.ts:74`).

### OUT-03.5 · What «Preview» does

§202.5: «if they hit preview that takes them literally to the same place where they can edit the
template».

The press on a day's tile opens **OUT-04's screen** (`print-screen.tsx`) on this template, with the
day's documents already loaded and the pager standing on the first one, in Preview mode, with the
Edit control one press away. That is the shipped behaviour since §246 (re-read 14 September 2026):
the `setPrinting` overlay that once stood between the tile and the screen, and the separate scope
and paper seats that opened it, retired with the one-press tile (OUT-03.3).

The library row's own «Preview» does the same thing from the other side, so the two doors Peter
named land on one screen.

---

## OUT-04 · The print screen — one surface, two modes

§202.4: «The phone print screen is full-screen, with previous/next findable, and feels right.»

### OUT-04.1 · The screen

ONE surface. It holds the paper, a pager, a mode control, and one act.

```
DESK ─────────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────────────┐
│ Delivery notes                              [Preview | Edit]     [×] │
│ Customer delivery notes · quantities, prices and totals              │
│                                                                      │
│   ┌───────────────────────────┐   ┌──────────────────────────────┐   │
│   │                           │   │ Paper                        │   │
│   │      the sheet, drawn     │   │  ( A4 ) ( A5 )               │   │
│   │      at its own paper     │   │ Copies                       │   │
│   │      proportion           │   │  ( 1 ) ( 2 ) ( 3 )           │   │
│   │                           │   │ Fields                       │   │
│   │                           │   │  ( Final weight ) ( Unit …   │   │
│   │                           │   │ Head and foot                │   │
│   └───────────────────────────┘   │  [ note ]                    │   │
│   ‹  Fonda Serra · 2208-148  ›    │ Name                         │   │
│      Page 1 of 2                  │  [ Delivery notes ]          │   │
│                                   └──────────────────────────────┘   │
│ [ Print 32 albaranes ]        32 pages awaiting print confirmation   │
└──────────────────────────────────────────────────────────────────────┘

PHONE ────────────────────────────────────────────────────────────────
┌──────────────────────┐
│ Delivery notes    [×]│   the sheet owns the viewport
│ [ Preview | Edit ]   │   the head is 56 px and sticky
├──────────────────────┤
│                      │
│   the sheet, drawn    │
│   at the width the    │
│   screen gives it     │
│                      │
├──────────────────────┤
│ ‹  2208-148  ›  1/2  │   the pager, sticky above the act bar
│ [   Print 32     ]   │   the act bar, above the safe area
└──────────────────────┘
```

### OUT-04.2 · The two modes

**Preview** draws the paper as it will print, paged. It is `PrintView`
(`app/src/prototypes/cedar/print-view.tsx:501`) at `chrome="framed"`, which already means «the surface
carries the title and the way back; the sheet keeps its standfirst and its act»
(`print-view.tsx:483`–`:485`). The stage takes the paper's own proportion of the column, so an A5
sheet reads as a half sheet (`print-view.tsx:537`, and the reasoning at `:533`–`:536`).

**Edit** shows the template's settings against the same paper, live. Every control writes to a
draft of the template and the paper redraws on the next frame, so a person watching the sheet sees
what a toggle does. Saving writes the template and raises its revision (OUT-01.7); leaving with
unsaved changes offers «Save changes» and «Discard changes» — the pair `better-writing` ·
*A confirmation button repeats the consequence* asks for, both naming what they do.

The mode control is a two-segment control in the head, `Preview | Edit`, `aria-pressed` on the
active segment, 44 px tall on both postures. `better-writing` · *Consistent flow vocabulary*: the
two words are the same two everywhere the screen is named, in the library row's acts and in the
day tile's `paperLabel`.

**The settings, per category**, drawn from OUT-01.3 and from the two editors that exist today:

| Category | Groups, in order |
|---|---|
| `albaran` | Paper (A4 · A5) · Copies (1 · 2 · 3) · Fields (Final weight · Unit price · Line total) · Head and foot · Name · Language |
| `packing` | Paper · Copies · Columns (1 column · 2 columns) · Order within each truck (Route order · Customer A–Z · Order value · Lifetime value) · Head and foot · Name · Language · «Grouped by truck» and «Carries the capture mark» as stated facts |
| `day-sheet` | Paper · Copies · Stops (Route order · Customer A–Z) · Head and foot · Name · Language |
| `file` | Format (CSV) · Columns · File name · Name |
| `email` | Recipients · Timing · Time zone · Attachments · Review rule · Name |

The albarán and packing groups are `PrintLayoutEditor`'s own controls (`shell/printing.tsx:435`),
which stop being unreachable and become this screen's Edit mode. Its labels ship as they are:
`Final weight` · `Unit price` · `Line total` (`shell/printing.tsx:458`–`:460`), `1 column` ·
`2 columns` (`shell/printing.tsx:468`–`:469`), `Route order` · `Customer A–Z` · `Order value` ·
`Lifetime value` (`shell/printing.tsx:477`). Its two sentences ship with the copy law applied:
«Final weight stays blank until the scale gives a final reading.» stands as it is
(`shell/printing.tsx:464`); «Prices are unavailable while delivery notes are set to unvalued.»
becomes «Prices arrive with the pricing workspace.»

### OUT-04.3 · The phone posture — full-screen, and how

**Why the screen is small today.** Two separate causes, both measured in the code.

1. **The day's preview asks for no phone posture at all.** `areas/sales.tsx:6280` mounts
   `OverlayCard` with `size={720}` and passes neither `placement` nor `overrides`. `OverlayCard`'s
   own default is `placement: PLACEMENT.center` (`app/src/rocoto/overlay-card/overlay-card.tsx:70`),
   so on a 360 px phone the paper arrives in a centred card rather than a docked sheet, and it
   never reads the visual viewport that `useWorkflowViewport` (`workflow-dialog.tsx:118`) exists to
   supply.
2. **The docked frame grows to its content instead of owning the screen.** `ExportCentre` asks
   `workflowCardOverrides({ padded: !card, visualHeight: workflowHeight })`
   (`shell/printing.tsx:2383`) — no `expanded`. The `expanded` posture exists
   (`workflow-dialog.tsx:38`) and gives `data-workflow-fit="screen"` (`workflow-dialog.tsx:67`),
   and **nothing in the app asks for it**: `data-workflow-fit` appears at that one line and nowhere
   else. Its phone branch also forces `height: 'auto'` (`workflow-dialog.tsx:84`), so even a caller
   that asked for `expanded` would get a content-height sheet on a phone.

**The rule.** On a phone the print screen is a sheet that OWNS the viewport.

- It mounts through `workflowCardOverrides({ expanded: true, visualHeight })` and
  `useWorkflowPlacement()`, so it docks and reads the visual viewport.
- `workflow-dialog.tsx:84`'s phone branch changes to `height: expanded ? viewportHeight : 'auto'`,
  which is the one line that makes `expanded` mean the same thing on both postures. The Scrim's
  phone branch already sets `height`, `minHeight` and `maxHeight` to `viewportHeight`
  (`workflow-dialog.tsx:62`), so the frame and its scrim then agree.
- `areas/sales.tsx:6280` passes `placement={useWorkflowPlacement()}` and the same overrides, so the
  day's preview and the library's preview are one surface with one posture.
- The head is 56 px and sticky at the top — `TOUCH_FLOOR` (44, `shell/viewport.ts:443`) plus
  `scale500` (12) above and below the close control, so the one target in it clears the floor with
  its own breathing room. The pager and the act bar are sticky at the bottom with
  `padding-bottom: env(safe-area-inset-bottom)`. `better-layout` · *Content bleeds, controls float*
  and *Never park a critical action where scrolling clips it*: the paper scrolls between them and
  Print is always reachable.

**A drive asserts the posture rather than the pixels**: `data-workflow-fit="screen"` on the print
screen's frame at 393 · 390 · 360, and the frame's measured height within 2 px of
`window.visualViewport.height`.

### OUT-04.4 · The pager — findable

**Why it is hard to find today.** Three causes, each citable.

1. **It exists only for RUNS.** `PrintRunPreview` (`print-view.tsx:656`) draws the pager, and
   `PrintView` mounts it only when `runKind` is set — `subject.kind === 'day'` with a `run`, or
   `subject.kind === 'packing'` with no truck (`print-view.tsx:541`–`:542`). A single albarán has no
   pager at all.
2. **It is drawn as three ghosts.** Prev and next are `KIND.tertiary` buttons carrying a rotated
   caret and no label (`print-view.tsx:705`, `:723`); between them sits a native `<select>`
   (`print-view.tsx:709`). `better-layout` · *Keep controls distinct from content*: a control with
   no background shape and no border beside a native select reads as decoration. The 48 px target
   is honoured (`print-view.tsx:706`, `:724`) — the SIZE is right and the WEIGHT is wrong.
3. **It sits above the paper, in normal flow.** The row is the first child of the run preview
   (`print-view.tsx:704`), so on a phone the paper below it takes the rest of the sheet and the
   pager leaves the screen as soon as a person scrolls the document they came to read.

**The rule.**

- **Every print screen has a pager**, including a single document, where it states «1 of 1» and
  its two arrows stand down. One anatomy, always in the same place — `better-layout` ·
  *Order by importance* and `better-ui` · *One SVG, recolored per state*.
- **The pager sits BELOW the paper**, sticky to the foot of the sheet on the phone and directly
  under the stage on the desk, immediately above the act bar. A person paging documents is looking
  at the document; the control belongs where their eyes already are.
- **The arrows are `KIND.secondary`**, so they carry a border and read as controls, 48 × 48 on both
  postures, with `aria-label` «Previous document» and «Next document» as they have today
  (`print-view.tsx:705`, `:723`).
- **The middle names the document and its place**: «Fonda Serra · 2208-148» on one line and
  «1 of 12» under it on the desk; the document name alone with «1/12» trailing on the phone. The
  native `<select>` moves behind the middle as a press that opens the same list — a list of twelve
  documents is a list, and a select is the right object for it, but it earns its seat behind the
  name rather than in front of it.
- **Swipe pages the document on the phone.** A horizontal swipe of more than 48 px on the paper
  moves one document — 48 is a stated threshold rather than a measured one, chosen as the pager
  arrow's own width so a deliberate swipe and an accidental one are told apart by the size of the
  control the gesture stands in for, wrapped in `@media (prefers-reduced-motion: no-preference)`, with the arrows
  doing the same job for every other hand. `better-accessibility` · *Every pointer interaction
  needs a keyboard path*: `←` and `→` page while focus is inside the screen.
- **Tabular numbers** on «1 of 12», so the count keeps its box as it climbs
  (`better-typography` · *Tabular numbers on changing values*).

### OUT-04.5 · Paper, and the act

**Paper.** A4 and A5 are the two the renderer supports, which is `PRINTABLE_PAPERS`
(`shell/printing.tsx:243`) filtering `Ticket` out of `PAPER_SIZES` (`print-queue.ts:159`). Under
this spec the choice is the TEMPLATE's, made in Edit mode, so the paper pills leave the act bar —
the pair at `print-view.tsx:746`–`:748` that today writes straight to the house-wide `PrintSetup`. The
Preview mode states the paper as a fact beside the page count: «A4 · 2 pages».

`Ticket` stays in `PAPER_SIZES` (`print-queue.ts:159`) so a preference stored before this release
still parses, and it stands ready for the day a ticket renderer exists. No template offers it while
the browser renderer draws A4 and A5, which is the honest reading of the type's own comment
(`print-queue.ts:161`): «Ticket is retained only for legacy preferences; this browser renderer
supports A4 and A5.»

**The QR and the marks** are drawn per THE-QR-SPEC from `PACKING_QR` (`packing-output.ts:69`), at
the top right of the packing masthead with «Scan after packing» and the token in words beneath
(`print-view.tsx:180`, `:186`). `PackingCaptureMark` (`print-view.tsx:154`) draws them and
`rememberPackingMark` (`packing-output.ts:139`) records the locator, the day and the document ids
at the moment the mark is drawn. E200 adds the template id and revision to that record, so a
photograph read back names the geometry it was printed under (OUT-01.7).

**The act.** One primary control at the foot: «Print 32 albaranes» — the label
`print-view.tsx:742` already builds, with the template's own document noun. It calls
`printSourceRun` (`browser-print.tsx:222`) with the template's `layout` and `copies`. The title of
the attempt is the template's `name`.

### OUT-04.6 · After the print

- The attempt lands in the print queue and the surface says «Print dialog requested · paper
  awaiting confirmation.» — today's sentence (`shell/printing.tsx:1627`).
- The pager's foot states what is owed: «32 pages awaiting print confirmation»
  (`print-view.tsx:751`).
- The mark is remembered. `rememberPackingMark` is idempotent — a locator already stored returns
  without a write (`packing-output.ts:142`) — so a reprint of an unchanged run keeps one record.
- The manifest is posted from the same seam (OUT-01.8), carrying the template id, the revision, the
  paper and the page geometry.
- The template's `lastUsedAt` is written, which is what the library row reads.
- Confirming an attempt keeps today's grammar: «Print confirmed.» (`shell/printing.tsx:1632`).

---

## OUT-05 · Chat and email inside the app

§202.3: «We are their chat and email client. «Open chat» on WhatsApp opens the chat popup inside
the app; «Open email» opens the email thread inside the app; email is live for houses connected
through Unipile. The Copilot's acts and the order's acts open those, never a customer page in their
place.»

### OUT-05.1 · What every «Open chat» and «Open email» does today

| Where | Label | What it does | Verdict |
|---|---|---|---|
| `app/src/prototypes/cedar/source-thread.tsx:90` | `Open chat` | `openFull` (`source-thread.tsx:45`) → `focusThread(cast.sector, sale.customer.id)` | opens the panel in-app |
| `app/src/prototypes/cedar/areas/customers.tsx:1054` | `Open chat` | `openChat` (`areas/customers.tsx:1684`) → `focusThread` | opens the panel in-app |
| `app/src/prototypes/cedar/copilot/flows.tsx:122` | `Open chat` / `Open email` | `openNative` (`copilot/flows.tsx:109`–`:112`) → `window.open('https://web.whatsapp.com/')` or `mailto:` / `https://mail.google.com/` | leaves the app |
| `app/src/prototypes/cedar/shell/chats.tsx:1244` | `Open chat` / `Open mailbox` | `openNative` (`shell/chats.tsx:1210`–`:1213`) → the same two web addresses | leaves the app |
| `app/src/prototypes/cedar/email-thread.tsx:82` | `Open in Gmail` / `Open in Outlook` | `window.open(native.href)` | leaves the app |
| `app/src/prototypes/cedar/email-thread.tsx:85` | *(icon)* `Open communication history` | `openHistory` (`email-thread.tsx:80`) → `openCustomer(id)` → `#/customers/<id>` (`anchors.tsx:232`, `:209`) | **opens a customer page** |
| `app/src/prototypes/cedar/detail.tsx:6528` | `[ Open the chat ]` | a wireframe comment; `focusThread` is imported at `detail.tsx:145` and called nowhere in the file | drawn, unbuilt |

**E198's leftover, corrected.** The E198 note read «open-chat opens the customer, because the chats
panel exports no opener». Both halves are inexact and the spec must say so, because a builder
working from the old sentence would fix the wrong file.

- The Copilot's `Open chat` does **not** open a customer. It opens `https://web.whatsapp.com/` in a
  new tab (`copilot/flows.tsx:111`). The act that opens a customer page is
  `email-thread.tsx:80`, and it stands on every email card in the app.
- The chats panel does export an opener, one level up: `focusThread(sector, id)`
  (`app/src/prototypes/cedar/shell/threads.ts:529`), re-exported at `app/src/prototypes/cedar/shell/index.ts:72`. It
  publishes the focus and dispatches `rocoto:focus-thread`, which `ChatsOverlay` listens for and
  answers by opening the panel (`shell/chats.tsx:3503`–`:3512`). Six surfaces already call it. What
  is missing is an opener keyed by an ORDER rather than by a customer, and an email opener, which
  does not exist in any form.

### OUT-05.2 · «Open chat» — the opener, named

**The function the chat panel must export**, added to `app/src/prototypes/cedar/shell/threads.ts` beside
`focusThread` and re-exported from `app/src/prototypes/cedar/shell/index.ts`:

```ts
/** Open the chat panel on this conversation. `order` scopes the panel to one albarán's exchange
 *  where the caller has one; the panel opens on the whole conversation without it. */
export function openChat(sector: SectorId, customer: string, order?: string): void;
```

It does what `focusThread` does today (`shell/threads.ts:531`–`:538`) and carries `order` in the
`rocoto:focus-thread` detail, so `ChatsOverlay` opens on that order's own exchange — the scoping
`EmbeddedConversation` (`shell/chats.tsx:3274`) already performs, moved to the moment the panel
opens rather than after it.

**Where it is called from.**

| Caller | Line today | What changes |
|---|---|---|
| the order's own act | `app/src/prototypes/cedar/detail.tsx:6528` | the drawn act is built: `openChat(cast.sector, sale.customer.id, sale.id)`; the unused import at `detail.tsx:145` becomes a call |
| the albarán chip | `app/src/prototypes/cedar/source-thread.tsx:45` | gains the order: `openChat(cast.sector, sale.customer.id, sale.id)` |
| the Copilot's act | `app/src/prototypes/cedar/copilot/flows.tsx:111` | the `window.open` goes; `onOpenChat` joins `onOpenOrder` (`copilot/flows.tsx:214`) and calls `onLeave(); openChat(...)`, which is exactly the shape `Open order` already has |
| the composer's channel line | `app/src/prototypes/cedar/shell/chats.tsx:1210` | the `window.open` goes; the panel is already open, so the line states the channel and drops the door |
| the customer's contact bar | `app/src/prototypes/cedar/areas/customers.tsx:1684` | already right; it keeps its behaviour |

**The Copilot's gate goes.** `copilot/flows.tsx:122` renders the act only when
`!customerOutboundAvailable`. Opening a conversation is reading, and reading needs no send
authority, so the act stands always. What the gate governs stays where it belongs: whether the
composer can SEND (OUT-05.5).

**BUILT AS (E200.04, 2026-09-05) — one deviation, stated.** Every `window.open` named above is
gone and every door opens inside the app. The composer's channel line KEEPS its door rather than
dropping it: `ChannelLine` is one component in THREE housings — the Messages workspace, the mail
workspace, and the composer inside the albarán's chip (`source-thread.tsx`) — and in the chip the
panel is closed, so the door is the door §202.3 asks for. Dropping it in the panel alone is right
and is still owed; it costs a re-pin of `hybrid` (drive-197, 567) and `outbound` (drive-184, 23),
whose §196.7 law reads «the native door survives unchanged», so it belongs to whoever next opens
the composer rather than to this row. The order's scoping was built as a LANDING rather than a
filter: `openChat(sector, customer, order)` carries the albarán, the panel states it as
`data-standing-order` and the eye lands on that order's first turn, and the rest of the
conversation stays — an act on one document has no business hiding a customer's other messages.

### OUT-05.2b · And on a phone the conversation IS the screen

**The defect this row found by LOOKING, after its own drive was green.** «Open the chat» on an
albarán at 390 opened the panel UNDERNEATH the albarán. The panel was there in full — fixed at
`0,0,390×844`, `opacity: 1`, focused, standing on the right order — and the person saw the albarán,
unchanged. Every assertion passed over it, because `:visible` is a DOM word: an overlay that opens
behind the work satisfies it exactly.

**Why.** Both surfaces are the phone's whole screen. The albarán's pane is fixed at `LAYER + 1` =
13 (`app/src/prototypes/cedar/detail.tsx`); the panel takes rung 9 (`shell/chats.tsx`), a rung it holds so
the menus Base opens from inside it (12) stay above it. MEASURED: `document.elementFromPoint` at
the panel's own centre answered `line-l1` — a product line of the pane in front of it.

**A rung is the wrong answer** and this row tried it first: 10 changes nothing against 13, and
anything above 13 puts the panel over its own menus.

**Built as: the work steps back.** `shell/threads.ts` grows `setChatIsScreen(standing)` /
`useChatIsScreen()` — a module store beside the openers, in the same `useSyncExternalStore` idiom
the file already keeps. `ChatsOverlay` says when it is standing full-screen on a phone (and
withdraws it on unmount); the albarán's pane answers with `display: 'none'`. HIDDEN, NEVER
UNMOUNTED — the scroll, the drafts and the open sections are all still there, so closing the
conversation gives the albarán back exactly as it was left, which is what a person who opened a
chat FROM a document expects to return to. The desk is untouched: there the panel floats beside
the work and both are visible at once, which is the desk's whole point.

**And the drive now proves PAINT.** `drive-200-chat-email.py`'s `painted()` asks the browser what
a finger would land on at the panel's centre and names the covering testid when it is anything
else. Six assertions, one per door per width. This is the assertion that would have caught it, and
the one every «the popup opened» claim in this spec now rests on.

### OUT-05.3 · «Open email» — the opener that does not exist yet

**The function**, in the same file and exported the same way:

```ts
/** Open the email thread inside the app. `sourceRef` is the authorized source reference the
 *  runtime issued; the thread is rendered from it and never navigated to by a provider URL. */
export function openEmail(sector: SectorId, customer: string, sourceRef: string, order?: string): void;
```

It focuses the customer's conversation the way `openChat` does and marks the panel's channel
`email`, so `ChatsOverlay` mounts `WorkspaceConversation`'s email branch — `EmailConversation`
(`app/src/prototypes/cedar/email-thread.tsx:39`) with `ReplyComposer` beside it, which is the pair
`shell/chats.tsx:3313`–`:3324` already builds.

**Why a reference and never a URL.** THE-SOURCE-PRIVACY-SPEC SRC-PRIV-06
(`notes/THE-SOURCE-PRIVACY-SPEC.md:127`) records that no provider offers a portable exact-message
link, so a deep link would have to be invented. The thread is DRAWN from the authorized
`source_ref` the house already holds. This is the constraint that makes «we are their email client»
the right answer rather than a harder one: the app renders the mail it is authorized to render.

**The composer prefills where a draft exists.** `ReplyComposer` (`shell/chats.tsx:1258`) reads
`standingDraftOf(sales)` (`shell/chats.tsx:1298`), and the rule at `shell/chats.tsx:1254`–`:1257`
stands unchanged: the words are DERIVED while the person has typed nothing, a reload re-derives
them, and the store holds exactly what a person wrote. Opening an email thread with a standing
draft lands the person in a composer that already carries the sentence, with the send still theirs.

**Where it is called from.**

| Caller | Line today | What changes |
|---|---|---|
| the email card's history circle | `app/src/prototypes/cedar/email-thread.tsx:80` | `openCustomer(thread.customer.id)` becomes `openEmail(sector, thread.customer.id, sourceRef)`; the label becomes «Open the email» and the icon becomes the EXPAND mark — see below |
| the email card's footer | `app/src/prototypes/cedar/email-thread.tsx:144` | `Open communication history` becomes «Open the email»; two near-identical labels with opposite destinations become one |
| the Copilot's act | `app/src/prototypes/cedar/copilot/flows.tsx:110` | the `window.open` goes; `onOpenEmail` calls `onLeave(); openEmail(...)` |
| the customer's contact bar | `app/src/prototypes/cedar/areas/customers.tsx:1050` | the `window.open` branch goes; the act opens the thread whether or not sending is verified |
| the composer's channel line | `app/src/prototypes/cedar/shell/chats.tsx:1244` | `Open mailbox` becomes the provider fallback of OUT-05.6 |

**THE CIRCLE'S MARK IS NOT THE CARD'S MARK, and this was read off the screen rather than the
source.** With the mail mark on it the header drew, on one line at 1600:
`✉ Gmail · Read-only … [G Open Gmail] (✉)` — the SAME envelope twice, once as the card's own
subject mark and once as this door, with a labelled button between them that walks OUT of the app.
The unlabelled envelope read as a second Gmail. The WORDS stay («Open the email», in the title and
in the label a screen reader gets); the MARK carries the verb, which is «open it full» —
`Glyph id="expand"`. `better-ui` · *Contextual icons*: an icon earns its place by distinguishing,
and two identical glyphs on one line distinguish nothing.

**OWED, and now measured: that door is one of two.** In the albarán's chip the card also carries
the footer act «Open the email» (`onViewConversation`), and inside the panel the circle re-opens
the conversation that is already standing. One door per card is right; the second is noise. It
stays for now because `email-open-history` is pinned by three drives — `drive-202-phone-targets`
(the 44 px floor sweep), `drive-181-email-privacy` and `drive-200-chat-email` — and folding it into
the footer act is a re-pin of all three, which belongs to whoever next opens the mail card.

### OUT-05.4 · The connection model — Unipile behind «Connect your email»

**What the house sees.** Administration → Connections → «Orders by email»
(`app/src/prototypes/cedar/areas/admin/connections.tsx:473`) offers two mailboxes,
`MAILBOXES` (`areas/admin/connections.tsx:182`–`:185`): **Gmail** and **Microsoft 365**. The door
card is `email-door` (`areas/admin/connections.tsx:624`), titled «Connect your email»
(`:627`), with `Configure` and `Take it off` per method (`:657`, `:648`) and the house's own
provisioned Rocoto address as a third method (`:668`).

**What sits behind it.** Unipile is the aggregator that holds the OAuth grant and answers one REST
API for both providers — FEED-IA §101's ruling (`notes/FEED-IA.md:2515`) and
THE-SOURCE-PRIVACY-SPEC SRC-PRIV-06 (`notes/THE-SOURCE-PRIVACY-SPEC.md:115`). The house never
reads the word: it chooses Gmail or Microsoft 365 and Rocoto reaches the mailbox through Unipile.
**Unipile appears in zero lines of code today** — every mention in the kit is in `notes/`.

**What is stored.** Two shapes in `localStorage` under `rocoto-app-config`
(`app/src/prototypes/cedar/config.ts:268`):

```ts
emailFeed: { connected: boolean; address: string };   // config.ts:113
mailbox:   { gmail: boolean; m365: boolean };          // config.ts:121
```

Both are booleans meaning **the door has been armed**, which the type's own comment states
(`config.ts:114`–`:120`). No token, no account id, no provider receipt, no message body reaches the
browser — the rule `email-provider.ts:1`–`:9` sets and this spec keeps. The runtime holds the
grant; the browser holds a flag and an authorized `source_ref`.

**Reading is a separate authority from sending.** `EmailConnectionStatus`
(`email-provider.ts:97`) already separates them. Under this spec:

| Posture | The thread | The composer |
|---|---|---|
| a mailbox is connected | opens in the app | sends through the provider |
| a mailbox is armed and the grant is pending | opens in the app from the stored source | states «Sending starts when Gmail finishes connecting.» and keeps the words |
| the mail arrived forwarded | opens in the app, read-only | states «Reply from the mailbox this arrived in.» and offers that mailbox's door |
| no mailbox is connected | the mail Rocoto received still opens in the app | states «Connect a mailbox to send from here.» with a link straight to Connections |

Every one of those sentences says what IS. The strings they replace read as denials — «Sending
needs a verified mailbox.» (`email-provider.ts:133`), «Original email unavailable. Open mailbox.»
(`email-thread.tsx:74`), «This forwarded message is read-only.» (`email-thread.tsx:77`), «Provider
activation is required before arrivals can enter Stock.» (`areas/admin/connections.tsx:537`) — and
they go with E194's copy law. `better-writing` · *Settings describe the ON state* and
*Errors say how to fix, next to where it broke*.

**The link, not the path.** «Connect a mailbox to send from here.» carries a link to Connections
rather than a description of where to click. `better-writing` · *Link straight to a referenced
setting*.

### OUT-05.5 · WhatsApp through the house's number

WhatsApp opens the chat popup and sends through the house's own number. The composer's channel line
(`shell/chats.tsx:1228`) states the channel and the number the message will leave from. Where the
house's number is still connecting, the composer holds the words and states «Sending starts when
your number finishes connecting.» — the draft survives, which is `useThreadDraft`'s contract
(`shell/chats.tsx:1286`).

### OUT-05.6 · One composer grammar for both

The hybrid composer is MSG-26, built by **E193.08** (`notes/THE-ENGLISH-DESIGN-BACKLOG.md:490`) and
specified at `notes/THE-INTERACTION-SPEC.md:773`. One `ReplyComposer` (`shell/chats.tsx:1258`) in
three housings, the channel stated on the send control, WhatsApp green and email blue
(`CHANNEL_INK` and `channelTheme` in `rocoto-theme.ts`, `reply-channel.ts`).

E200 changes one clause of it and keeps the rest. MSG-26 today reads
(`notes/THE-INTERACTION-SPEC.md:832`–`:835`):

> Nothing claims delivery. Pressing the control opens the channel's own door carrying the words —
> `wa.me`/`web.whatsapp.com`, the connected provider's compose window, or `mailto:` — the
> conversation gains no turn.

**OWED, and OUT of E200.04's scope.** The clause below is the one half of OUT-05 that E200.04 did
not build: the kit has no outbound send seam, `shell/chats.tsx`'s `hand()` still opens the
channel's own door with the words, and MSG-26's «nothing claims delivery» is what drive-197 pins at
567. Rewiring it needs a runtime endpoint and a release of its own.

**Under §202.3 the send is Rocoto's.** A connected house presses Send and the message leaves
through the house's WhatsApp number or through the connected mailbox, and the conversation gains
its turn. The native door survives as the FALLBACK for a house with nothing connected and for
forwarded mail, where it is the honest answer rather than the only one. Everything else in MSG-26
holds: one composer, the channel on the control, the mic beside the send, the derived-and-deletable
draft of MSG-27.

The channel labels become one pair across the app: **«Send on WhatsApp»** and **«Send by email»**
on the composer; **«Open chat»** and **«Open the email»** on every door that opens a conversation.
`better-writing` · *One voice, flexible tone* and *Consistent flow vocabulary*.

---

## OUT-06 · Artwork wiring

§202.1: «Every product tile is generated with the library's own prompt (the «ghibli/monet» prompt
the main library was made with), never a per-image description.»

§202.8: «The subject clause for a new product's tile is written by Claude Opus in the library's own
clause grammar … from the product's name, sort and form, so the style stays consistent and the
picture is accurate for the house's own product; the locked prompt wraps it; Ideogram paints it.»

### OUT-06.1 · The locked prompt, verbatim

`assets/paintings/build_subjects.py:28`–`:34`. It ships whole, in every prompt, and it is never
shortened — the rule THE-DENSE-BRIEF-DESIGN states at `notes/THE-DENSE-BRIEF-DESIGN.md:198`.

```python
STYLE_LOCK = (
    "A small still-life painting in a style blending Studio Ghibli background art with "
    "Claude Monet's impressionism: {subject}. Soft luminous brushstrokes, gentle colour, "
    "painterly edges, the subject centered and filling about three quarters of the frame "
    "with even margin on every side, on a plain pure white background, nothing else in "
    "frame, no text, only a soft ground-contact shadow."
)
```

Resolved, this is the exact string every one of the 793 entries in
`assets/paintings/manifest.json` carries in its `prompt` field:

> A small still-life painting in a style blending Studio Ghibli background art with Claude Monet's
> impressionism: {subject}. Soft luminous brushstrokes, gentle colour, painterly edges, the subject
> centered and filling about three quarters of the frame with even margin on every side, on a plain
> pure white background, nothing else in frame, no text, only a soft ground-contact shadow.

### OUT-06.2 · The subject clause, and its grammar

`{subject}` is a SUBJECT CLAUSE: a noun phrase naming one object and how it is presented, in the
present tense, with no sentence around it. The library composed 793 of them by hand and by
template, and the grammar is written down in code.

**The composition point** — `assets/paintings/build_subjects.py:979`–`:980`:

```python
                "subject_clause": clause,
                "prompt": STYLE_LOCK.format(subject=clause),
```

**The resolver** — `assets/paintings/build_subjects.py:929`–`:939`. Four rungs, an override beats a
template, and a subject with no clause stops the build rather than inventing one:

```python
def clause_for(kind, prep, whole_clause, es_name, sort_ov=None):
    if sort_ov and prep in sort_ov:
        return sort_ov[prep]
    if prep in kind["ov"]:
        return kind["ov"][prep]
    if prep in WHOLE_FORMS:
        return whole_clause
    tpl = T.get(kind["l0"], {}).get(prep)
    if tpl:
        return tpl.format(en=kind["en"], flesh=kind["flesh"])
    raise SystemExit(f"NO CLAUSE for {es_name} / {prep}")
```

**The templates** — `assets/paintings/build_subjects.py:54`–`:82`, where `{en}` is the English
common noun and `{flesh}` the flesh colour. Six examples, quoted so a model writing a new clause
has the register in front of it:

| Family · form | Clause |
|---|---|
| fish · `eviscerado` | `a single gutted {en}, the belly cavity cleanly opened and empty, lying on its side` |
| fish · `filetes` | `two clean skin-on fillets of {en} laid neatly side by side, {flesh} flesh` |
| shellfish · `pelado` | `a single peeled raw {en} tail, {flesh} flesh, curved and glistening` |
| meat · `picada` | `a single rounded mound of freshly minced {en}` |
| meat · `deshuesado` | `a single boned and rolled {en}, tied with butcher's string` |
| vegetable · `manojo` | `a single bunch of {en}, the stems gathered and tied` |

And the one Peter quoted in §202.8 as the register to hold:

> a single raw red prawn, a deep scarlet shell with long fine antennae and a curled tail

**The rules a written clause obeys**, read off the 793:

1. It opens with a count and an article: «a single …», «two …», «a small neat heap of …».
2. It names ONE object or one arrangement of one object, and nothing else in the frame.
3. It says the state: raw · cooked · gutted · peeled · sliced · bunched.
4. It may carry colour and surface — «deep scarlet shell», «glistening», «{flesh} flesh».
5. It is a noun phrase. It carries no verb of its own, no final stop, and no style words: the style
   is `STYLE_LOCK`'s, and a clause that repeats it fights it.
6. It is 8–28 words.

**Who writes a new one.** §202.8: Claude Opus, from the product's name, its sort and its form, given
the six examples above and the six rules, returning the clause and nothing else. The house's own
product gets a picture of the house's own product, in the library's register.

### OUT-06.3 · The road, on product arrival

A product arrives three ways and all three take the same road: **typed** in New product, **imported**
from a catalogue, or **read off a sheet**. Today the first two already call
`ensureSKUArtworkRequest` (`app/src/prototypes/cedar/sku-artwork.tsx:54`).

```
 1  a product arrives                typed · imported · read off a sheet
 2  ask the library by name          exactPaintingFor(original ?? display)
                                     app/src/prototypes/cedar/painting-map.ts:914
 3  a tile exists       → serve it   /paintings/<slug>.webp
 4  a tile is absent    → write the clause     Claude Opus, §202.8, OUT-06.2
 5                      → wrap it              STYLE_LOCK.format(subject=clause)
 6                      → paint it             POST /api/artwork
 7                      → normalise it         1024 · 0.75 · white · WebP q92
 8                      → store it             the library's contract, OUT-06.5
 9                      → serve it from then on
```

**Step 2, exactly as it stands.** `SKUArtwork` (`app/src/prototypes/cedar/sku-artwork.tsx:68`) resolves in
one order — an approved uploaded photo, then the library tile, then nothing
(`sku-artwork.tsx:82`–`:87`) — and it asks the library with the RETAINED ORIGINAL SKU name, falling
back to the display name, so renaming a product keeps its picture. `exactPaintingFor`
(`painting-map.ts:914`) matches on exact visual evidence, through
`CURATED_EXACT_SKU_ALIASES` (`painting-map.ts:892`) and past `SUPPRESSED_EXACT_PAINTINGS`
(`painting-map.ts:908`), and returns `null` on a miss. That `null` is the trigger for step 4.

**Step 6, the call.** `POST /api/artwork` on branch `codex/english-e197-art`, registered at
`mock-api/app/main.py:160` and implemented at `mock-api/app/artwork.py:373`. It goes to Ideogram with
`resolution=1024x1024`, `rendering_speed=QUALITY`, `num_images=1`
(`mock-api/app/artwork.py:313`), and it returns the image as base64 in the body because provider
URLs expire (`mock-api/app/artwork.py:364`, and the reasoning at `:302`–`:305`).

**And here is the change E200 makes to it.** That endpoint today builds its prompt by asking
Ideogram to `describe` a sibling tile and swapping one substring of the returned description
(`mock-api/app/artwork.py:396`, `swap_subject` at `:181`). §202.1 rules that out in six words —
«never a per-image description» — and §202.8 says what replaces it: the clause is written, the lock
wraps it. So `paint()` gains one prompt road and keeps the other:

| Road | Prompt | When |
|---|---|---|
| **`locked`** (the new default) | `STYLE_LOCK.format(subject=clause)`, the clause written per OUT-06.2 | every product arriving without a tile |
| `described` (kept) | Ideogram's own `describe` of a named reference, one substring swapped | a person editing one tile by hand, which is the method peter-image owns |

The request gains `clause` and `road`; `road` defaults to `locked`. The response's `prompt` field
already carries whatever was sent (`mock-api/app/artwork.py:405`), so the manifest records the exact
prompt either way, which is what `LICENSES-AND-ATTRIBUTION.md:139` promises.

### OUT-06.4 · While a tile is being made

The product keeps its seat and its seat says what is happening. Positive words, every state.

| State | The seat draws | The words |
|---|---|---|
| a tile exists | the tile | — |
| a photo is approved | the photo | — |
| the clause is being written | the family mark, quiet | «Painting this one» |
| the paint is running | the family mark, quiet | «Painting this one» |
| the tile has landed | the tile | «Painted just now» for one beat |
| the house's credit is spent | the family mark | «Painting starts when credit is topped up» |
| the artwork road is closed | the family mark | «Painting starts when the house key is set» |

The mark is the drawn family face `ProductFace` already uses (`app/src/prototypes/cedar/product-face.tsx:174`),
which is a real drawing rather than an empty box. The bare `＋` glyph that stands in the tile seat
today (`app/src/prototypes/cedar/sku-artwork.tsx:134`) is `aria-hidden` and says nothing; it goes, and the
editor's «Product photo shows here.» (`sku-artwork.tsx:162`) stands as it is because it already
says what will be.

`data-art-status` on the seat (`sku-artwork.tsx:122`) grows two values —
`photo` · `library` · `painting` · `missing` — and it is what a drive reads.

### OUT-06.5 · Storing, and the library's contract

The file contract is already written, at `mock-api/app/artwork.py:96`–`:106`:

| Field | Value |
|---|---|
| format | `webp` |
| canvas | `1024` |
| box ratio | `0.75` |
| ground | `white` |
| alpha | `False` |
| quality | `92` |
| library | `app/public/paintings/<slug>.webp` |
| source | `assets/paintings/set/<slug>.webp` |
| normalizer | `assets/paintings/normalize.py` |

`normalize.py` produces exactly that: it learns the ground from a 10 px border ring at the 75th
percentile, lifts it to white, snaps everything within tolerance to pure 255, places the subject's
longest side at 0.75 of a 1024 canvas, and writes WebP at quality 92
(`assets/paintings/normalize.py:38`–`:46`, `:130`–`:133`, `:147`–`:157`). It refuses to write a
tile whose ink coverage is under 0.02 (`normalize.py:150`).

**What E200 adds is the writing.** The endpoint returns bytes and declares where they belong; no
code puts them there. The seam:

```
POST /api/artwork  { name, clause, road: 'locked' }
  → runtime normalises with the same arithmetic normalize.py uses
  → runtime writes  <library>/paintings/<slug>.webp
  → runtime appends the manifest row: es_name · subject_clause · prompt ·
                                      request_id · response_id · file · status: done
  → runtime answers { slug, url }
  → the app serves /paintings/<slug>.webp from then on
```

`slug_for` (`mock-api/app/artwork.py:168`) already reproduces `painting-map.ts`'s fold, so a tile
made here lands on the name the app looks for. The `PAINTINGS` row that `build_map.py` writes
offline becomes a runtime row on the same shape (`painting-map.ts:17`).

### OUT-06.6 · The gate

`tools/artwork-gate.py` on `codex/english-e197-art`, 141 lines, and its law at `:9`–`:10`: «every
catalogue PRODUCT and every sellable VARIANT resolves to a painting the app can draw, and the file
that painting names is on disk.» It reads the app's own tables through
`app/tools/artwork-tables.mjs` and calls the app's own `exactPaintingFor` rather than
re-implementing resolution (`tools/artwork-gate.py:12`–`:16`). It names two debts apart — a product
no painting resolves for, and a product whose painting is refused — and it checks three files:
the shipped tile present, the reviewed source present, and the two byte-identical
(`tools/artwork-gate.py:93`–`:98`). It exits 1 while anything is missing (`:135`).

E200 keeps it exactly and adds one state: a product whose tile is BEING PAINTED is named as
in-flight rather than counted as a debt, so a house adding fifty products does not turn the gate
red for the minutes the paint takes.

The gate answers §200.2's «the gate names any product without artwork» (`notes/FEED-IA.md:5484`), and it is the reason the
frozen Gamba roja de Palamós would have been caught: `CURATED_EXACT_SKU_ALIASES`
(`painting-map.ts:892`) binds `Gamba roja de Palamós` to `Gamba roja` today, which is the reviewed
fix for that exact product.

### OUT-06.7 · The keys, and the house secret on the door

⚠ **Every line number in this section is on `codex/english-e197-art`**, where the artwork road
lives; `main` carries none of these lines yet (OUT-08.1).

Two names, and the values live only in the environment. `mock-api/app/config.py:37` holds the one
`os.getenv` in the service and every secret enters through it; `redact()` is the single chokepoint
every log runs through (`mock-api/app/config.py:1`–`:15`).

| Name | What it is | Where it is read |
|---|---|---|
| `IDEOGRAM_API_KEY` | the credit the paint spends | `mock-api/app/config.py:75`, sent as the `Api-Key` header at `mock-api/app/artwork.py:164` |
| `ARTWORK_SHARED_SECRET` | the house secret on the door | `mock-api/app/config.py:85`, compared with `hmac.compare_digest` at `mock-api/app/artwork.py:109`–`:130` |
| `ARTWORK_HOURLY_CEILING` | how much a house may spend in an hour, default 40 | `mock-api/app/config.py:86`, enforced at `mock-api/app/artwork.py:133`–`:151` |

The door's wire name is `X-Rocoto-Artwork-Key` (`mock-api/app/artwork.py:89`), and it is
deliberately absent from the CORS allow-list (`mock-api/app/main.py:75`) so a browser can never
carry it. A secret shorter than 24 characters is refused — «A house secret shorter than this is a
password, not a secret» (`mock-api/app/config.py:27`). Health reads `artwork: configured` only when
BOTH halves are present (`mock-api/app/config.py:120`, `:124`).

Both names join `mock-api/deploy/env-names.txt` (lines 10 and 11 on the art branch), which is the
only list `deploy/with-env.py` reads and the reason a value never touches this repository.

---

## OUT-07 · The proof plan

Every section above is pinned by a drive that goes red on purpose before it goes green. The
grammar is `drives/README.md`'s: assert the LAW rather than the presence of a box, prove every
guard found what it was about to measure, and record the source flip that turned each assertion red.

Drive numbers 205–209 are free; 204 is the highest in `drives/` today.

### OUT-07.1 · The five drives

| Drive | Pins | Viewports |
|---|---|---|
| `drives/drive-205-templates.py` | OUT-01 · OUT-02 | 1920 · 1536 · 1366 · 393 · 390 · 360 |
| `drives/drive-200-day-seats.py` | OUT-03 | 1920 · 1600 · 1366 · 393 · 390 · 360 |
| `drives/drive-207-print-screen.py` | OUT-04 | 1536 · 1366 · 393 · 390 · 360 |
| `drives/drive-208-chat-email.py` | OUT-05 | 1366 · 390 |
| `drives/drive-209-artwork.py` | OUT-06 | 1366 · 390 |

### OUT-07.2 · The assertions, one line each

**`drive-205-templates.py` — the library.**

1. The export centre opens on the library, and the library is its first view.
2. A fresh house holds exactly two templates, «Delivery notes» in the albarán section and «Packing
   lists» in the packing section.
3. Every category has a section, and a section with no templates states what it prints and offers
   «New template».
4. Each row carries a paper thumbnail, a name, a settings line, acts «Print N» · «Preview» · «Edit»
   and one overflow control.
5. Every act on every row measures at least 44 × 44 at 360.
6. The gaps go 8 · 16 · 32 px — inside a row, between rows, between sections.
7. «Templates» stands nowhere in the export centre's head, and «Use template» stands nowhere at all.
8. Editing a template's paper to A5 and printing draws an A5 sheet, and the house's default paper
   is unchanged afterwards.
9. Editing a packing template's sort to «Customer A–Z» changes the printed order.
10. Duplicating a template makes a second row whose day seat is empty.
11. A word-boundary scan of every string this view renders finds none of `not` · `no` · `never` ·
    `nothing` · `cannot` · `without`.

**`drive-200-day-seats.py` — the day.** (Built under the E200 numbering its siblings took —
`drive-200-library.py`, `drive-200-print-screen.py`, `drive-200-template-model.py` — and at SIX
viewports rather than four, because the desk posture turns at 1600 as well as at 1366.)

1. A day shows two tiles side by side on ONE row at 393 · 390 · 360.
2. Each tile is at least 88 px thick and the pair splits the row within 8 px.
3. Tile one names the template in seat 0 and tile two the template in seat 1.
4. «Set as day button» on a third template opens the seat chooser, and choosing seat 1 renames tile
   one on the day.
5. «Take off the day» leaves one tile and the day still prints.
6. The desk keeps one row of two three-column lockups at 1366.
7. The count on a tile equals the documents that template still owes paper for.
8. The paper seat opens the print screen on that template with the day's documents loaded.

**`drive-207-print-screen.py` — the screen.**

1. On the phone the frame carries `data-workflow-fit="screen"` and measures within 2 px of
   `window.visualViewport.height` at 393 · 390 · 360.
2. The pager stands BELOW the paper and is inside the viewport with the paper scrolled to its foot.
3. Previous and next are visible, bordered, at least 48 × 48, and their `aria-label`s read
   «Previous document» and «Next document».
4. A single-document subject shows a pager reading «1 of 1» with both arrows standing down.
5. Next moves the paper to the second document and the middle names it.
6. `←` and `→` page while focus is inside the screen.
7. The act bar holds one primary act and it is reachable with the paper scrolled anywhere.
8. Edit shows the template's settings; toggling «Line total» removes the column from the paper on
   the same screen.
9. Saving raises the template's revision and the library row states the new settings.
10. A packing template's paper carries the QR at the masthead's top right with its token in words.

**`drive-208-chat-email.py` — chat and email.**

1. The Copilot's «Open chat» opens the chat panel inside the app, and the page's location is
   unchanged.
2. The Copilot's «Open email» opens the email thread inside the app.
3. The order's «Open the chat» opens the panel scoped to that order's exchange.
4. The email card's history control opens the email thread rather than `#/customers/<id>`.
5. No surface in the walk calls `window.open` — asserted by stubbing `window.open` and failing the
   run if it fires.
6. A standing draft prefills the composer and the send stays unpressed.
7. With no mailbox connected, the thread still opens and the composer states «Connect a mailbox to
   send from here.» with a working link to Connections.
8. The copy-law scan over every string these surfaces render.

**`drive-209-artwork.py` — artwork.**

1. Every catalogue product resolves to a tile the app draws — `tools/artwork-gate.py` green.
2. A product created with a name the library holds serves its tile without a request.
3. A product created with a name the library lacks sets `data-art-status="painting"` and draws the
   family mark with «Painting this one».
4. The prompt the runtime sends starts with `STYLE_LOCK`'s first eleven words and contains the
   written clause — asserted against a stubbed provider, so no credit is spent.
5. The clause obeys OUT-06.2: it opens with an article, holds 8–28 words, ends without a stop, and
   carries none of `Ghibli` · `Monet` · `brushstroke` · `impressionis`.
6. A painted tile lands at `/paintings/<slug>.webp` at 1024 × 1024, WebP, opaque.
7. With the key away, the seat reads «Painting starts when the house key is set» and the product
   still saves.

### OUT-07.3 · The red-proof method

Each drive is proven by a source flip that makes exactly the assertions it should make go red,
while its geometry legs stay green — which is what proves the drive asserts the LAW rather than the
presence of a box. One flip per drive, minimum, recorded in the release note with its counts.

| Drive | The flip | What must go red |
|---|---|---|
| 205 | put «Templates» back in the export head | assertions 1 and 7 |
| 205 | make the row's Edit act tertiary and 32 px tall | assertion 5 at 360 |
| `drive-200-day-seats.py` | give `DayPaper` back its two hard-coded controls | assertions 3, 4 and 5 |
| 207 | drop `expanded` from the print screen's overrides | assertion 1 at all three phone widths |
| 207 | move the pager back above the paper | assertion 2 |
| 208 | restore `window.open` in `copilot/flows.tsx` | assertions 1, 2 and 5 |
| 209 | send the described prompt instead of the locked one | assertion 4 |

### OUT-07.4 · The counts to add to the runner

`drives/run-193-public-proof.py` grows five `Suite` rows in `SUITES` (`drives/run-193-public-proof.py:132`)
and five `EXPECTED_GREEN` entries (`:52`). The values start as `None`, which lets the suite run for
count discovery and deliberately fails the release gate until a reviewed number replaces it — the
rule the file's own docstring states at `:31`. RELEASE-196 is that review: every E200 suite's
number in the runner today was measured by the release agent in both postures before it was
written, and each carries a comment saying what it counts.

```python
    Suite("templates", "drive-205-templates.py"),
    Suite("day-seats", "drive-200-day-seats.py"),
    Suite("print-screen", "drive-207-print-screen.py"),
    Suite("chat-email", "drive-208-chat-email.py"),
    Suite("artwork", "drive-209-artwork.py"),
```

```python
    "templates": None,      # to measure — six viewports × eleven assertions
    "day-seats": None,      # to measure — six viewports × five blocks (E200.06)
    "print-screen": None,   # to measure — five viewports × ten assertions
    "chat-email": None,     # to measure — two viewports × eight assertions
    "artwork": None,        # to measure — two viewports × seven assertions
```

Two existing suites move with this work and their pins are re-measured: `phone-targets`
(`drive-202-phone-targets.py`) gains the library's rows and the print screen's pager, and
`frames-previews` (`drive-203-frames-previews.py`) reads the library through the new anatomy.

---

## OUT-08 · What is owed, and what is out of scope

Stated plainly, because a spec that hides its debts costs more than one that names them.

### OUT-08.1 · Owed, and this spec depends on it

1. **THE-PAPER-SPEC is written — this list said otherwise, and RELEASE-195 closed it.**
   [THE-PAPER-SPEC](THE-PAPER-SPEC.md) carries the layout manifest in millimetres (**PAP-02**), the
   three corner marks, the homography and the cell-crop grammar, measured. OUT-01.7 points at
   PAP-02 for the schema and states only what a template EDIT owes it.
2. **The manifest's own store.** OUT-01.8 names `POST /api/outputs/manifest`; the runtime holds no
   such route today. `POST /api/paper/manifest` — the PACKING sheet's own — is live (PAP-02), and
   the templates' one is the same seam widened.
3. **E196.40 stands on `main` from RELEASE-195.** The two-tile phone posture OUT-03.3 measures is
   published; OUT-03 builds on it directly rather than on a branch.
4. **`POST /api/artwork` stands on `main` from RELEASE-195**, with `tools/artwork-gate.py`,
   `app/tools/artwork-tables.mjs`, `drives/drive-197-artwork.py` and THE-RUNTIME-SPEC's
   `RUN-12`. OUT-06 builds on it. The KEY is still owed (item 5).
5. **`IDEOGRAM_API_KEY` and `ARTWORK_SHARED_SECRET` are Peter's to set.** Neither name is in
   `mock-api/deploy/env-names.txt` on `main`. The endpoint answers `artwork_awaiting_key`
   (`mock-api/app/artwork.py:157`) until they are, and the app's copy says so positively (OUT-06.4).
6. **Unipile has no account and no key.** `notes/THE-LIVE-PATH.md:53` records it as «the one
   external account still to create». OUT-05's connected posture is designed and its live half
   waits on that.

### OUT-08.2 · Contradictions this spec resolves, and how

| Contradiction | Where | E200's answer |
|---|---|---|
| «the library's own prompt» vs the runtime's describe→swap | §202.1 vs `mock-api/app/artwork.py:396` | §202.8 settles it: Opus writes the clause, `STYLE_LOCK` wraps it. The described road stays for a person editing one tile by hand (OUT-06.3). |
| «background removed» vs an opaque contract | `notes/FEED-IA.md:5484` (§200.2) vs `mock-api/app/artwork.py:101` | The ground is a plain pure white square, which is what `STYLE_LOCK` asks for and `normalize.py` produces. A transparent library is a separate decision and is out of scope. |
| A4/A5 vs A4/A5/Ticket | `THE-EXPORT-CANON.md:2045` vs `:450` | The paper categories offer A4 and A5, which is what the renderer draws; `Ticket` stays in the type for the file and email categories and for stored preferences (OUT-04.5). |
| «Favourites» meaning two things | `THE-EXPORT-CANON.md:91` (banned) vs §200.5 (`notes/FEED-IA.md:5487`, endorsed) | The word retires. The library holds TEMPLATES; the day holds two SEATS. Neither is called a favourite. |
| One print button vs three marked controls | §129.1 vs §199.4 (`notes/FEED-IA.md:5463`) / §200.5 (`:5487`) | §202.5 is the later law and it says two, chosen by the house. Two seats. |
| «Nothing claims delivery» | `THE-INTERACTION-SPEC.md:832` | Superseded for a connected house by §202.3 (OUT-05.6); the native door stays as the fallback. |

### OUT-08.3 · Out of scope, deliberately

- **The ERP rail and scheduled email.** They keep their objects and their surfaces; a template of
  the `email` category carries the schedule it carries today.
- **The Copilot's own composer** (THE-COPILOT-SPEC §4). It is the agent's editor and it stays.
- **The parsing road** (§196.5, §199.1–§199.3). E200 records where a template edit touches the
  manifest and stops there; the reading half is E198's and THE-PAPER-SPEC's.
- **Transparent artwork**, a second library at 512 and 256, and any change to the 793 tiles that
  ship.
- **Provider OAuth.** The browser holds a flag and an authorized reference; the grant is the
  runtime's and the wiring session's.

---

## OUT-09 · The files, and the order of work

**Historical implementation plan — 2026-09-05.** The inventory and work order below record the
E200 proposal at that date, including its labels such as “new”. The maintained
[Cedar source](../app/src/prototypes/cedar/README.md) and [release record](omitted-sources.md)
establish what was subsequently built; current work is selected through the relevant GitHub issue.

### OUT-09.1 · The map

| File | What changes |
|---|---|
| `app/src/prototypes/cedar/output-templates.ts` | **new** — the `Template` type, the categories, the two shipped defaults, `readTemplates` / `writeTemplates`, the migration from the two retiring keys |
| `app/src/prototypes/cedar/print-layout.ts` | `PrintLayoutProfile` becomes `TemplateLayout`'s two paper members; `readPrintLayout` / `savePrintLayout` retire into the migration |
| `app/src/prototypes/cedar/shell/printing.tsx` | the library replaces `DayDestinations`' three tabs; `SavedOutput` and `OUTPUT_TEMPLATES` retire into `Template`; `PrintLayoutEditor` (`:435`) becomes OUT-04's Edit mode; the head's «Templates» (`:2323`) goes; `requestPrint`'s write to the house default (`:1622`) goes |
| `app/src/prototypes/cedar/print-view.tsx` | the pager moves below the paper and mounts for every subject (`:541`, `:704`); the paper pills leave the act bar (`:746`); the layout comes from the template |
| `app/src/prototypes/cedar/workflow-dialog.tsx` | the phone branch honours `expanded` (`:84`) |
| `app/src/prototypes/cedar/browser-print.tsx` | `printSourceRun` takes the template's layout rather than reading the sector's (`:249`); the attempt captures the template id and revision |
| `app/src/prototypes/cedar/print-queue.ts` | `PrintSetup` narrows to the default a NEW template starts from |
| `app/src/prototypes/cedar/areas/sales.tsx` | `DayPaper` (`:3173`) reads the two seats; the two hard-coded handlers (`:5880`–`:5890`) resolve their template; the preview `OverlayCard` (`:6280`) takes the workflow placement and overrides |
| `app/src/prototypes/cedar/detail.tsx` | `PrintFlush` (`:1033`) gains the tile posture; the albarán dock's drawn «Open the chat» (`:6528`) is built on the import already at `:145` |
| `app/src/prototypes/cedar/shell/threads.ts` | `openChat(sector, customer, order?)` and `openEmail(sector, customer, sourceRef, order?)` beside `focusThread` (`:529`) |
| `app/src/prototypes/cedar/shell/index.ts` | both openers re-exported (`:72`) |
| `app/src/prototypes/cedar/shell/chats.tsx` | the reopen listener carries the order (`:3503`); the composer's channel line drops its native door (`:1210`, `:1244`) |
| `app/src/prototypes/cedar/email-thread.tsx` | `openHistory` (`:80`) becomes `openEmail`; the two «communication history» labels become «Open the email» (`:85`, `:144`) |
| `app/src/prototypes/cedar/copilot/flows.tsx` | `openNative` (`:109`) goes; `onOpenChat` and `onOpenEmail` join `onOpenOrder` (`:214`); the `!customerOutboundAvailable` gate leaves the open acts (`:122`) |
| `app/src/prototypes/cedar/areas/customers.tsx` | `contact` (`:1030`) opens in-app on both channels |
| `app/src/prototypes/cedar/email-provider.ts` | the four denial strings become the positive postures of OUT-05.4 |
| `app/src/prototypes/cedar/areas/admin/connections.tsx` | the mailbox rows and the door state the connection in positive words (`:509`, `:537`, `:664`) |
| `app/src/prototypes/cedar/sku-artwork.tsx` | the `＋` (`:134`) becomes the family mark with its state words; `data-art-status` (`:122`) gains `painting` |
| `app/src/prototypes/cedar/painting-map.ts` | a runtime-added row joins `PAINTINGS` without a rebuild |
| `baseweb/src/app/export-library.tsx` · `custom-export-builder.tsx` · `custom-exports.ts` · `manual-exports.ts` | **decide and act.** `ExportLibrary` (`export-library.tsx:132`) is exported and mounted nowhere, it duplicates the live `export-template-gallery` testid (`:361` against `shell/printing.tsx:1506`), and `custom-exports.ts` carries Spanish strings (`:39`, `:43`, `:54`) in an English-only kit. Either mount its XLSX builder as the `file` category's Edit mode, or delete all four and keep `manual-exports.ts` for the worksheets. |
| `mock-api/app/artwork.py` | `road: 'locked' \| 'described'`, `clause`, the write, the manifest append |
| `mock-api/app/main.py` | the two `/api/outputs/*` routes |
| `mock-api/deploy/env-names.txt` | `IDEOGRAM_API_KEY`, `ARTWORK_SHARED_SECRET` |
| `tools/artwork-gate.py` | the in-flight state |
| `drives/drive-205-templates.py` … `drive-209-artwork.py` | **new** — OUT-07 |
| `drives/run-193-public-proof.py` | five suites and five pins (`:52`, `:132`) |
| `drives/drive-202-phone-targets.py` · `drive-203-frames-previews.py` | re-measured against the new anatomy |
| `notes/THE-EXPORT-CANON.md` · `THE-SYSTEM-SPEC.md` · `THE-INTERACTION-SPEC.md` · `THE-COPILOT-SPEC.md` · `THE-SOURCE-PRIVACY-SPEC.md` | the supersession pointers of OUT-09.3 |

### OUT-09.2 · The order of work

**Wave 1 — the model, alone, and everything waits on it.**
`W1` · `output-templates.ts` + the migration + `print-layout.ts`. One builder. Nothing else starts.

**Wave 2 — four builders in parallel, once W1 lands.**

| Lane | Scope | Depends on |
|---|---|---|
| `W2a` | OUT-02, the library in `shell/printing.tsx` | W1 |
| `W2b` | OUT-04, the print screen in `print-view.tsx` + `workflow-dialog.tsx` + `browser-print.tsx` | W1 |
| `W2c` | OUT-05, the two openers and every caller | nothing — it may start beside W1 |
| `W2d` | OUT-06, the artwork road | `codex/english-e197-art` merged |

**Wave 3 — after W2a and W2b both land.**
`W3` · OUT-03, the day's seats in `areas/sales.tsx` + `detail.tsx`. It reads the library's seat
assignment (W2a) and opens the print screen (W2b), so it can only be built once both exist. Rebase
onto `codex/english-e196-tiles` first.

**Wave 4 — after every lane.**
`W4a` · the five drives and the runner's pins. `W4b` · the supersession pointers and INDEX.
`W4c` · the four orphan files decided.

W2c is the one lane with no dependency on W1, so a second builder may start it on day one.
W2d needs only its own branch merged. W2a and W2b touch different files and may run beside each
other; both touch `shell/printing.tsx` only at its edges, and W2b's work in that file is limited to
removing the paper pills.

### OUT-09.3 · The pointers this spec leaves behind

A two-line pointer at the top of each superseded section, and the history stays.

| File | Section | The pointer |
|---|---|---|
| `notes/THE-EXPORT-CANON.md` | `### 0.3 · Templates seed saved copies; they are not favourites` (`:74`) | superseded by THE-OUTPUTS-SPEC OUT-01 — one object, not two; a template IS the thing people run |
| `notes/THE-EXPORT-CANON.md` | `## 7 · THREE PAPERS…` (`:545`) | superseded by THE-OUTPUTS-SPEC OUT-01.4 — the three papers are three CATEGORIES, and two templates ship |
| `notes/THE-EXPORT-CANON.md` | `### 18.19 · Historical E187 integrated Export Centre…` (`:2054`) | superseded by THE-OUTPUTS-SPEC OUT-02 — the library is the export centre's first view |
| `notes/THE-EXPORT-CANON.md` | the «Paper & copies» rule (`:2045`) and the frozen-profile rule (`:2049`) | superseded by THE-OUTPUTS-SPEC OUT-01.3 and OUT-01.7 — paper, copies and layout belong to the template |
| `notes/THE-SYSTEM-SPEC.md` | `### DOC-01.6 · Custom export recipes` (`:1777`) | superseded by THE-OUTPUTS-SPEC OUT-01.2 — `ExportTemplate` and `SavedOutput` become one `Template` |
| `notes/THE-INTERACTION-SPEC.md` | `### Export, print, packing, files and integrations anatomy` (`:462`) | superseded by THE-OUTPUTS-SPEC OUT-02 and OUT-04 — one library, one screen, two modes |
| `notes/THE-INTERACTION-SPEC.md` | MSG-25's native-door tail (`:765`) | superseded by THE-OUTPUTS-SPEC OUT-05 — «Open chat» and «Open the email» open the app's own surfaces |
| `notes/THE-INTERACTION-SPEC.md` | MSG-26's «Nothing claims delivery» (`:823`) | superseded by THE-OUTPUTS-SPEC OUT-05.6 — a connected house sends from Rocoto |
| `notes/THE-COPILOT-SPEC.md` | `## 5 · What the agent may act on` (`:220`) and `## 6 · The doors` (`:241`) | superseded in part by THE-OUTPUTS-SPEC OUT-05.2 — the Copilot opens a chat and an email in-app |
| `notes/THE-SOURCE-PRIVACY-SPEC.md` | `## SRC-PRIV-04 · Native mailbox opening` (`:73`) | superseded by THE-OUTPUTS-SPEC OUT-05.3 — the in-app thread leads; the provider door is the fallback |
| `notes/THE-ENGLISH-DESIGN-BACKLOG.md` | E184.06 (`:192`) | superseded by THE-OUTPUTS-SPEC OUT-05.3 — the communication-history circle becomes the email door |

---

## OUT-10 · The reading of §202, clause by clause

One table, so a builder can check the spec against the law without reading it twice.

| Clause | Where it is built |
|---|---|
| §202.1 · one prompt for every painting | OUT-06.1 · OUT-06.3 |
| §202.2 · deploy | out of scope for this spec; E200 ships on its own release |
| §202.3 · we are their chat and email client | OUT-05 |
| §202.4 · the phone print screen | OUT-04.3 · OUT-04.4 |
| §202.5 · templates are one architecture | OUT-00.2 · OUT-01 · OUT-02 · OUT-03 · OUT-04 |
| §202.6 · the design skills | applied and named in OUT-02.3, OUT-04, OUT-05 |
| §202.7 · the spec is clean and proper | this document |
| §202.8 · the clause is written by a model | OUT-06.2 |
