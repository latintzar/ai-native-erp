# Cedar print workflow

This note defines the delivery-batch workflow built on 2026-09-10. The normative output and paper
contracts remain [THE-OUTPUTS-SPEC.md](../../../../docs/THE-OUTPUTS-SPEC.md) and
[THE-PAPER-SPEC.md](../../../../docs/THE-PAPER-SPEC.md).

## Entry points

Prep opens on the most pressing confirmed delivery slot at or after the workspace's current time.
Its first view contains:

1. the current time and the countdown, on a card over the next delivery's map;
2. a raised preparation card which keeps a visible minimum over that map;
3. the batch's day, slot and count, printed progress and the exact primary actions **Print** and
   **Download**;
4. one square Email schedules control;
5. upcoming delivery rows which open the shared Delivery Note and its communication; and
6. every listed delivery on both maps — its own mark, or a member of a counted group — opening that same Delivery Note path.

Each map marker keeps the sale id and uses its customer's real coordinates. Orders at equal
coordinates keep separate, offset controls, so a mark always opens its own order. The map ground
opens the expanded map; a mark stops that event and opens the order directly. A group stops it too and narrows the picture to its own members.

Print opens the next batch's usable Packing list. Download opens the file screen, which states the
exact artifact before the press. Email schedules opens output management. Dates remain on the Sales
day controls, where a person can open a direct day preview. A long salesperson list opens as a
nested full-screen checklist; Back discards its draft and Apply changes Prep's source.

A Sales day header carries up to two configured template buttons. A press opens the same print
screen as the Export centre, already showing the intended document. Each day header is sticky in
the Sales scrollport. The adjacent preview eye and scope chevron have retired; scope is edited in
the preview where its effect is visible.

## One derived set, inside a near-term window

`queue` is everything Prep could prepare: `sheetSalesOf(sales)` filtered to printable, unheld
deliveries at or after the workspace's clock, sorted by day, slot and customer.

`ready` is the WINDOW Prep shows: the next batch's day and the two delivery days after it
(`UPCOMING_DAYS = 3`). The rows, the map marks and the heading's count read that one set, so the
picture answers the question the list asks; the book past the window is stated as one line,
«N more after <day>», rather than dropped. The whole remaining book on one picture is a smear a
person reads nothing off and on one list is a scroll with no end, and three days is what a house
prepares against.

`batch` is the first day-and-slot inside the window, and it is what Print and Download carry.
Both scopes are named once each: **Next delivery batch** states its day, slot and delivery count on
the card; **Upcoming deliveries · N** is the window's own heading. The clock card over the map
states the hour and the countdown and nothing else — the batch sentence printed twice, 40 px apart,
was the «bunch of extra info» Peter named.

## One scroll surface

Peter, 2026-09-10: «for the whole prep screen, I can scroll within the card. It slides out from the
bottom, but I shouldn't be able to scroll within it. That should be hard-coded within the card.»

The task frame's Card owns the only scrollport. `prep-active-card` has no `overflowY`, no
max-height and no transform: it is exactly as tall as its content, so `scrollHeight` equals
`clientHeight` and its computed `overflow-y` is `visible`. `prep-status` is `position: sticky` at
the top of that scrollport, so the card travels up over a map that holds its place, and the last
delivery row is reached through the outer scroll. `export-batch-hub` is a block container rather
than a grid, because a sticky child of a grid sticks inside its own one-row area — which is no
travel at all. `data-expanded` is read from the closest scrolling ancestor's `scrollTop` past
24 px, and the only animated properties are the card's shadow and border, for 400 ms, immediate
under `prefers-reduced-motion: reduce`.

## The map holds every listed delivery

«Make sure that for all the addresses you actually come up with, they all show up on the map»
(Peter, 2026-09-10). Markers come from `ready`, at each customer's stored coordinates, with the
batch flagged. `print-measures.ts:mapFitOf` measures the picture with a `ResizeObserver`, takes the
marker bounds including their fan offsets, and chooses the sharpest checked-in zoom (14 down to 8)
whose span fits inside the box less the pin allowance. The figure states `data-fit`, `data-zoom`,
`data-ground`, `data-at`, `data-markers`, `data-drawn` and `data-clusters`; a single place keeps the
unmeasured three-by-three ground at zoom 14 for thumbnails and the Delivery Note map.

**AND VISIBLE IS PART OF «SHOW UP».** Prep draws a clock card over the top-left of that picture,
and a fit measured against the whole box painted most of the marks underneath it: 142 of 142 at
320, 45 of 142 at 390, 10 of 142 on the desk — measured in the browser, not inferred. The card
hands the fit its own rectangle (`useCardInset` → `MapInset`), so what the fit has to fill is the
L the card leaves: everything under it, or the strip beside it, whichever arm holds the marker
bounds at the sharpest zoom. `mapFitOf` centres the bounds in that arm and shifts the drawn centre
by the distance from the box's own middle — with no card and an asymmetric pin allowance that is
exactly the old half-the-difference shift, which is why a single place still stands with its head
in the middle of the picture. Where no arm can hold the bounds even at the widest ground the fit
says `fitted: false` and uses the whole box: a mark under a card is behind something a finger can
reach past, a mark outside the box is gone. The picture is 260 px tall at every width, because a
210 px phone map under a card of its own left 22 px of free room.

Two weights, one ink: the batch wears the drop, everything upcoming wears a place mark, and the
soonest delivery is painted last so it is the mark a finger reaches. A map opened from one
delivery's row draws THAT delivery as a drop, on top of everything, so the title and the picture
answer the same question.

**A DOOR THAT WAS TYPED RATHER THAN PICKED HAS NO POINT, AND THE SCREEN SAYS SO.** `Customer.at` is
optional and the product reaches that state on its own road — «Freeform addresses are saved as
text» is what the new-customer modal says on screen — so «Upcoming deliveries · N» could stand over
N−1 marks and be right about neither. Three things hold it together now, and `cast.ts` seeds the
case (`Taverna del Mar`, an account with a printed door and no coordinate) so every run walks it:

- **The heading keeps counting deliveries**, because the deliveries are the work.
- **`prep-map-coverage` states the difference, and only the difference**: «{n} on the map · {m} at
  typed addresses», drawn under the picture with the heading whose count it qualifies, and rendered
  only where the two numbers disagree. `data-upcoming` and `data-pins` on `export-batch-hub` carry
  the same two numbers for a drive. **The singular carries its article** — «141 on the map · 1 at a
  typed address» — because the row's own mark two lines below says «… · a typed address» in its
  aria, and one seeded typed address is the only state the demo ever shows.
- **Where the picture holds nothing, the area says what it holds.** `prep-map-background` is the
  door onto the map screen and it renders with the picture it opens: on `firstOnMap`, a delivery
  with a coordinate. A house that typed every door in its first week — the state
  `new-customer-modal.tsx` reaches by design — used to get a bare 260 px rectangle wearing a
  focusable «Open delivery map» whose click and Enter both did nothing. It carries `prep-map-empty`
  instead: one line, «Every upcoming delivery is at a typed address.», with nothing in the tab
  order, while the coverage line under the heading states the same arithmetic in the plural and
  every row carries its address mark.
- **A row with no point carries an address mark rather than a door.** It drew an empty bordered
  square inside a control labelled «Open map for …» that opened a map of everybody else under that
  customer's name; it is a static 56 px glyph now, `prep-address-<sale>`, with the door as its aria
  and no press — exactly as `areas/customers.tsx` guards its own 72 px square. The row still opens
  the Delivery Note. `prep-map-screen` is therefore reachable only for a delivery that has a
  coordinate, the picture opens on the first delivery that has one, and the history layer restores
  `export:prep-map` out of the window rather than out of the whole book — a restored id the window
  no longer holds closes the layer.

**The picture publishes whether it fitted.** `data-fitted` is `mapFitOf`'s own `fitted`, so the
honest fallback to the whole box — the state where marks go back under the clock card — is
assertable rather than invisible. The drive reads it at 320, 390 and 1600, and again on the
Castellano entry (`/cedar/es/`), because the card's height is what decides the fallback and one
extra line of Spanish copy is enough to flip it.

**What a finger presses is the mark itself.** Every mark used to carry a 44 px control over an
8 px dot, so the higher control of an earlier-sorted delivery covered its neighbours and a press on
a mark that was plainly on the screen opened a different customer. A control's box is its own glyph
now, floored at 32 px so there is something to press and at 44 px where the pointer is coarse
(`markHitBox`). Marks still touched each other where deliveries are dense, and the grouping below
is the answer to that.

**Dense marks are one control with a count on it.** A hundred deliveries inside one city, drawn at
a phone-sized zoom, is a smear of touching glyphs: the fan answers orders at ONE coordinate and
stops there, and past a handful the picture says «somewhere around here» about everybody.
`clusterPlacementsOf(placements, radiusPx)` in `print-measures.ts` groups the marks a finger cannot
tell apart — closer to each other than the 44 px touch target — into a disc carrying their count,
and it is pure arithmetic, so a tool test holds it rather than a screenshot. The grouping is a grid
of cells the size of the radius and a greedy seed that claims every unclaimed mark inside its own
radius: deterministic, order-stable, named after the earliest of its members, and never a chain
that reaches across the city one neighbour at a time. **A cluster is a way of showing all of them,
never a way of hiding some** — the partition is total, and the figure publishes both halves so a
drive can add them back up: `data-markers` is every delivery the picture is about and never moves
for a group, `data-drawn` is what the picture is drawing now, `data-clusters` is how many of the
controls are groups. A group is a 44 px button, `map-cluster-<n>`, reading its own count, carrying
`data-members`, saying «{n} deliveries here» in its aria and publishing in `data-opens` whether
this picture has the room to open it; a mark that stands alone is exactly what it always was — same
`map-order-<sale>` testid, same press, same Delivery Note.

**Pressing a group opens it.** The picture narrows to that group's members: `mapFitOf` runs again
on those marks alone, which earns a ground at least as sharp, and the members stand as marks or as
smaller groups. **Show all** — one 44 px control in the top-right corner, the one part of the
picture the clock card's L and the delivery card riding over the bottom both leave empty — puts the
whole window back, and so does browser Back, because opening a group is a place a person went: the
narrowing is the innermost history layer (`map:cluster:<picture>`), so on the map screen Back shows
every mark again and the Back after it closes the screen, which is that screen's own rule.

**The grouping runs at every ground, including the sharpest one.** ⚠ The first cut drew no group at
zoom 14, where the checked-in files stop, on the reasoning that marks still sharing a spot there
are the fan's work. The fan is about orders at ONE coordinate, and what was left over was
neighbours: measured 14 September at 1600, the end of that narrowing was 19 marks at zoom 14 with
EIGHT of them under a different customer's control — restaurants 100 to 200 m apart, which is 20 to
30 px there. A group is drawn over those too. What the sharpest ground changes is the press rather
than the drawing: no refit can sharpen zoom 14, so a group there is one to read rather than one to
open, and it says so in `data-opens`.

**The room the picture has is what ends the narrowing.** Below the sharpest ground, what bounds it
is the box: Prep draws its map into one arm of the L the clock card leaves — 132×100 px of a 320 px
picture — and 120 metro deliveries in a box that size are one group at every zoom the box can hold,
so refitting to that group's own members is the same group again. **A group holding every mark the picture can group is a group this picture cannot
open**, so it keeps its count, says so in `data-opens="false"`, and hands the press on to the
surface around the map: Prep's picture sits inside the control that opens the delivery map screen,
which has more than twice the height and no card over it, and those same 120 deliveries come apart
into thirty groups there. ⚠ The first cut of this ended the narrowing the other way — a group that
refitted to itself drew its members as marks — and that put 270 marks on a 390 px picture at zoom
9, 265 of them under another mark's control: the smear this whole section exists to close, one
press further in. Measured 14 September, on the build that shipped it.

The one place the two scopes could have been lost is the group itself, so a group holding a
delivery from the batch about to leave wears the batch's own dashed ring, and the delivery the
picture is titled after never joins a group at all — a picture whose own subject had been swallowed
into a count would answer a different question from its heading. **That mark stays on the picture
while a group is open**, too: the narrowed set is the group's members plus the titled delivery, so
a screen headed «Distribucions Llorens» has Llorens standing on it at every step of the narrowing.
**The refit is a redraw**: the ground, the marks and the groups are painted at the new zoom in one
frame, with nothing animated, so the picture is the same under `prefers-reduced-motion: reduce` as
it is without it.

**Every control takes its own press, which the mean nearly broke.** The seed promises that an
unclaimed mark is further than the radius from the SEED, and the control is drawn at the members'
MEAN — a different point, which can land on top of a mark that stayed out. Photographed on
13 September: on the nested map a 44 px count stood over the very delivery the screen was titled
after, and every press aimed at that mark opened the group instead. Three rules close it, and the
drive reads all three off the browser with `elementFromPoint` rather than off the arithmetic.
**A mark the control would cover belongs to the group**: a second pass in `clusterPlacementsOf`
claims any mark within the radius of a group's drawn point and takes the mean again with it inside,
which settles because each pass removes at least one mark. **Two group controls inside one finger
of each other are one group**: two means can stand near each other where no seed did — a fuzz over
4,000 placement sets drew that pair in 571 of them, the nearest 20.4 px apart, and both carry the
same z-index, so DOM order took the press and the other group's whole membership went with it.
Merging takes the mean again over both memberships, and each merge removes one group, so that
settles too. **And the titled mark, which is held out of the grouping, is what the group moves
for**: `clusterClearOf` pushes a control that lands on it straight out along the line that already
separates them, until a whole control stands between the two points — the fan's own rule, one level
up — on the projected point of whichever ground is drawing, because a clearing computed for the
tiles and thrown away by Google's own projection left a count 9 px from the drop at 320, on the
ground the published build uses. ⚠ **That push is part of the settle loop, because it moves the
control.** Pushing a group off the drop after the grouping had finished sent it 44 px in whatever
direction the drop happened to lie, which can be straight at the next group: measured 14 September
over 400,000 random pairs of centres a finger apart, the closest landed 2.7 px apart, and over the
same 4,000 titled pictures the suite now fuzzes, 156 drew two controls inside one finger. The drop
is handed to `clusterPlacementsOf`, so the point the loop claims marks for and merges groups on is
the point that ends up drawn. Google projects the same Mercator at the same zoom, so its pane draws
those same points moved by one constant. The stack, top down, is then the titled mark, the groups,
and the marks that stand alone with the soonest on top.

**Where the drive reads it.** `covered_controls` asks every control on a picture what stands at its
own centre, and the grouping block asks it three times — on the whole window, on the picture one
press narrows it to, and at the end of a walk that presses the biggest group each time until every
group left states that this picture has no room to open it. Six pictures take that walk: Prep at
390, 1600 and 320, the nested map screen, and Prep and that screen again over the stubbed Google
ground.
`groupingStandsApart` holds the same claim in arithmetic over 4,000 fuzzed pictures, and over
4,000 more that carry a titled mark.

**Marks are pointer targets; rows are the keyboard path.** Four hundred focusable marks ahead of
Print and Download is four hundred presses of Tab to reach the act, and every mark is a duplicate
of a list row that opens the same Delivery Note. The mark controls carry `tabIndex={-1}`, the map
group carries `aria-describedby` pointing at `prep-delivery-list`, and the drive asserts that Tab
from the map lands on the card's first control.

## Two grounds

The default ground is the checked-in tiles — files in `app/public/map/`, no key, no meter. Where a
build carries `VITE_GOOGLE_MAPS_KEY` (wired through `app/tools/build-constants.mjs` as
`__GOOGLE_MAPS_KEY__`, read the way `src/posthog.ts` reads its own constant so the Node tool tests
never meet `import.meta`), `google-ground.ts` loads the Maps JavaScript API once, with a timeout,
and draws the map with gestures off, no controls and a grayscale style.

**GOOGLE ONLY WHERE IT EARNS ITS LOAD.** A picture a person opened to look at may ask for it — the
fitted preparation map, the nested delivery map, and a full-size captioned place map such as the
Delivery Note's. Every thumbnail and every captionless small map draws the files, always, and
**the Maps Static API is used nowhere**: Prep mounts one thumbnail per upcoming delivery, so while
those asked Google for a still picture each, ONE screen open cost 129 metered Static Maps requests
before anybody scrolled — measured at 390 with a configured key.

**What that costs, in the numbers rather than in a slogan.** ONE MAPS JAVASCRIPT LOAD PER PICTURE A
PERSON OPENS; AT MOST THREE PICTURES STAND OPEN AT ONCE — Prep, a row's map screen, and a Delivery
Note. The `<script>` is fetched once per page, so counting script requests can never see this: the
metered unit is `new api.Map`, and each open picture builds its own. A person walking N delivery
rows opens N map screens and spends N loads, one at a time, three standing at the most; the whole
upcoming book on one screen still spends ONE, because a thumbnail draws the files. The drive counts
those constructions against a stubbed Maps API: it takes the count while Prep stands alone and
asserts ONE MORE for each picture opened after it, with three pictures standing open at once and
two once the note is closed. ⚠ It asserted a fixed three per session until 14 September, which held
only while that walk opened three pictures in its whole life; the grouping walk opens the delivery
map screen, closes it and opens it again, and a picture opened twice is honestly two loads. The
per-session bound is the account's daily cap, and
[the licences and the quota posture](../../../../docs/kit/LICENSES-AND-ATTRIBUTION.md) carry it.

**The loader waits for the library, because that is when the constructors exist.** Under
`loading=async` Google states that `google.maps` arrives as a loader and the `Map` and `OverlayView`
constructors are attached by `importLibrary`. `loadGoogleMaps` keeps the script tag and resolves the
api only after `await google.maps.importLibrary('maps')` has returned, then checks that both
constructors are functions; anything else resolves null and the picture draws the files. The old
shape read the constructors at `script.onload`, which the provider does not promise — and because
every failure falls back silently, a real key that attached them one tick later would have produced
a page byte-identical to the free ground: no console error, no red drive, `data-ground="tiles"`, and
a bill for a script nobody drew with. The drive's `MAPS_STUB` attaches the constructors ONLY inside
`importLibrary`, so a loader that reads them earlier goes red.

**And the bootstrap's `onload` is not the moment the library can be asked for** (measured on the
published page, 11 September, once a real key stood behind the build). The script tag's own `load`
fires when Google's small bootstrap has run, and at that instant `google.maps` exists WITHOUT
`importLibrary` — `main.js` attaches it a moment later. A loader that treated the missing function as
an answer settled on the files under a valid key, with `data-ground="tiles"` and no error anywhere.
So the script URL names Google's own ready signal, `callback=__rocotoMapsReady`, and the promise
waits for that call (or the timeout, or `gm_authFailure`) before asking for the library. The stub
models the same sequence — the bare namespace at evaluation, the library and the ready call on a
later tick — so a loader that settles at `onload` goes red here, which is how the published defect
was reproduced before it was fixed.

**The marks on Google's ground are our own DOM controls.** `google.maps.Marker` carries Google's
identity: no testid, no `data-order-id`, nothing a drive can read or a keyboard order can be stated
about. An `OverlayView` hands back a pane and a projection instead, the app portals the same
controls into it, and the two grounds are one behaviour — same ids, same press, same tab posture.
The viewport is ours too: `mapFitOf` already measures a 256-pixel Mercator ground, which is what
Google draws, so the centre and the zoom are handed over rather than recomputed with `fitBounds`.
**The groups are ours on both grounds as well**: Google projects the markers, a group stands at the
mean of its own members' projected points and is pushed off the titled mark from THAT point — the
same two rules the checked-in ground takes — and the drive walks the whole grouping, the press, the
way back and the end of the narrowing against the stubbed Maps API, on Prep's picture and on the
nested map screen, which is the picture that has both a drop and the room to narrow.

The credit follows the ground: `MAP_CREDIT` is drawn under the picture where the files are the
ground, and Google renders its own attribution inside its own map. A missing key, a load failure, a
timeout or an over-quota `gm_authFailure` falls back to the tiles. The key is public by design and
fenced on the account: referrer restriction, API restriction to Maps JavaScript, and a daily cap.
[The licences and the quota posture](../../../../docs/kit/LICENSES-AND-ATTRIBUTION.md) carry the
full record. Drives, CI and offline review run with no key, so the tile ground is the truth for
every proof; `drive-cedar-print-workflow.py` walks the Google ground against a stubbed Maps API,
which proves the app's own contract on that seam without an account.

**THE STUB PROVES OUR CONTRACT; ONLY A PUBLISHED PAGE PROVES GOOGLE'S.** A `VITE_GOOGLE_MAPS_KEY`
repository variable proves nothing on its own: the live proof is the lead's, at publication, and it
is one photograph of the published page showing `data-ground="google"` on Prep's own figure. Until
that photograph exists, every claim about the Google ground in this note is a claim about the seam
the stub answers.

## Scope contract

`PrintScreenRequest.scope` carries the opening boundary:

```ts
type PrintBatchScope = {
  coverage: 'remaining' | 'all';
  period: 'day' | 'range' | 'selected';
  day: string;
  through?: string;
  selectedIds?: string[];
};
```

The Export centre starts with `period: 'selected'` and the ids in the next delivery slot. A Sales
day button starts with `period: 'day'`. Both let the operator switch coverage and period before
printing.

- **Remaining delivery notes** use `newPaperOf`: printable sales whose note has yet to print or
  changed after its confirmed print.
- **Remaining packing lists** use `remainingPackingSales`, followed by `unqueuedPackingSales`: the
  latest packing revision still needs an operator-confirmed copy and is outside a live attempt.
- **All ready** uses the printable delivery set for the chosen boundary and leaves review-held
  sales with Review.
- **Day** matches one ISO delivery day.
- **Range** includes both ISO endpoints and builds one run per day.
- **Selected** intersects the operator's ids with the printable delivery set.

Changing a scope recomputes the preview, pager, count, primary button and `data-sales` source in one
render. Zero Remaining shows “This scope is complete” and offers All ready, another period, or
selected deliveries. The Print action rests until the scope contains a delivery.

Selected deliveries is a compact door on the print screen. It opens a nested full-screen checklist;
Back discards its draft and Apply commits the checked sale ids to the preview and print source.

## The file, its bytes and its numbers

«It's not calculating the right download size» and «the numbers dont add up. make sure its actually
calculating everything» (Peter, 2026-09-10).

`output-files.ts:configuredFileOf` builds the whole artifact once, from the template, the selected
sales, the priced flag, the day and the country, and returns `fileName`, `format`, `columns`,
`text`, `payload`, `bytes`, `saleIds` and the batch measures. The Download screen renders those
values before the press; `downloadConfiguredFile` hands the same `text` to `saveCsv`, which now
returns the `Blob.size` the browser actually wrote and is what the notice and the activity record
state. `payload` is the byte-order mark plus the text, and `bytes` is its UTF-8 length — characters
are not bytes, so a size counted off `text.length` is wrong on every accented customer name.

The file's columns are the template's, between two the file always carries: **Delivery** opens each
row, so two customers of the same name are two rows a person can tell apart, and **Order total**
closes it wherever the house prices its papers, so the rows add up to the number the screen
offered. `GeneratedFile.head` is the row those columns actually write, the template's own labels
applied, and **every screen that offers the file prints that head**: the export centre's flow
sentence, its preview tile and the template editor's tile all read it, because a screen that says
«CSV · Customer, Product, Quantity» over a file whose head row is
`Delivery,Customer,Product,Quantity,Order total` has described a different artifact. The column
builder states the two fixed columns in words, beside the fields it does offer.

The same file says the same sentence at every door it can be saved from — Prep's Download screen,
the export centre's flow and its Recent files row, and a Sales day seat: the file's name, what it
weighs, and the deliveries it carries. Money is converted from canonical PEN **once per delivery**, and the batch total is the
sum of exactly those per-delivery numbers — converting each line and then the sum separately is
what made a Spanish batch disagree with itself by a cent. `totalAsCanonical` carries that amount
back in PEN so `soles()` prints it unchanged and no second money formatter exists.

`batchMeasuresOf` states deliveries (one CSV row per sale), lines, quantities summed per unit, and
the money total. `sale.figure` is `figureOf(lines)` — `round(Σ given × price)` — and
`deliveryFigureOf` performs that same arithmetic, so the file, the preview and the Delivery Note
are one number.

## Deliveries, documents, dividers, copies, sheets

`own` is the deliveries on a run; `orders` is the documents the printer is handed, truck dividers
included; `template.copies` multiplies documents into sheets. `print-measures.ts:printMeasuresOf`
states all five, `printMeasureWords` draws each one beside its own noun and stays quiet where a
measure equals the one before it. The print screen carries `data-orders`, `data-documents`,
`data-dividers`, `data-copies` and `data-sheets`.

Each measure is stated ONCE on screen. The primary verb counts DELIVERIES in the delivery's own
noun — «Print 6 deliveries»: «Print 6 packing lists» stood beside «8 documents · 4 truck dividers»
and a pager reading «Truck 3 · 3 packing lists», so one phrase carried three different numbers on
one screen. The pager counts documents, in the paper's own words. The scope line adds the rest
underneath **on a phone only**, because the desk's head facts already draw the whole list 60 px
above it.

## Attempt and completion lifecycle

The print screen resolves the live sales first, then builds `PrintOrder[]` with `runOrdersOf`.
`printSourceRun` captures that same set with the selected template id, template revision, paper,
copies, layout and current sale revisions. A changed range therefore changes the idempotency input
and the generated popup. Existing `PrintSubject` ids and print activity records remain the audit
identity.

Opening the browser dialog records a requested attempt. The activity queue keeps generated page
counts and captured HTML. The operator's confirmation moves the attempt to printed. A packing
confirmation additionally completes the exact `{ sector, day, sale, packingRevision }` records;
an edit to packing content creates a new remaining revision.

Packing output is available while the Inventory workspace is switched off. Inventory preparation
ticks and packing-print completion are separate records. The printed packing list keeps truck
grouping, order heads, goods rows, amounts, checkboxes, the one-column handwritten final-weight
seat, capture QR and corner marks described by THE-PAPER-SPEC.

## Clock, release and navigation boundaries

**One clock** (FEED-IA §247.8, «one Prep clock in the workspace's timezone»). Delivery days come
from `scenario-clock.ts`, which shifts the retained fixture onto Cedar's boot day. The hour Prep
shows comes from the same module and the same zone: `prepClockOf` reads one instant in
`workspaceClock().timeZone` and returns the pair `{ dayId, hhmm }`, refreshed every 30 seconds, and
`minutesUntilSlot(day, slot, clock)` counts from that pair's own day. Past slots leave the live
queue; the next current or future slot becomes the batch. The card states the hour as `HH:mm` and
nothing about zones — the house clock is the house clock.

**Three time sources, and what each one is for.** `prepClockOf(new Date(), workspaceClock().timeZone)`
is the live instant: the hour on the card, the day the queue filters against and the origin the
countdown measures from. `cedarTodayId()` is that same reading taken once at boot with the hour
dropped; it dates the whole retained book, so every fixture day, delivery day and seeded money
date follows it and a midnight passing mid-session leaves the cast where it stands. `nowOf(cast)` in
`day.ts` is a seeded narrative hour — `cast.hour` plus the ordering window — and it is what «New
since 06:40» and the house's appetite are measured against: deterministic fixture time, so the
same morning renders the same way on every reload. The print screen takes `nowOf(cast)`; Prep's
card takes `prepClockOf`.

**The zone is the market's own, read once at boot.** `workspaceClock()` reads the workspace's
country from `workspace-capabilities.ts` as `scenario-clock.ts` loads: Peru gives `America/Lima`,
Spain gives `Europe/Madrid`. `cedarTodayId`, the queue filter, the countdown, the card's hour and
the library's press stamps then all come off that one reading, so a Spanish workspace at half past
midnight in Madrid states «00:30 now» and names Madrid's day — the hour on the wall of the person
looking at the screen. Switching the market re-dates the retained book, and it does so on a fresh
page load. Every door that can change the stored country is already a page load: the Country
control in Settings saves the market and reloads (`areas/admin/app-settings.tsx`), switching house
reseeds and reloads (`config.ts:seedInto`), and Reset Cedar leaves through the prepared workspace
entry. So the boot snapshot holds for the whole of the session it opens, and the market press that
moves the clock is the same press that moves the currency. Fiscal and commercial dates stay on Peru's calendar wherever the market stands — `peruDate`
in `money-model.ts` reads `America/Lima` directly, because SUNAT's calendar belongs to the seller
rather than to the screen, and a Spanish workspace opens with Money quiet (FEED-IA §247.9).

**A recorded instant keeps its instant and is read in that same zone.** `usedWhen` states a
template's «Printed 09:12 today» through `workspaceClock().timeZone`, the same reading the batch
card two doors away states its own hour in. The stored value stays exactly what the press wrote:
`scenario-clock.ts` holds that rule, and provider and user-action timestamps never pass through
the fixture shift. Four stamps on this screen read the reader's own zone
instead: a print attempt's `shortAttemptTime`, the provider receipts in the schedule's Send
history, the Export centre's recent-file rows, and `nextRunWords`, whose schedule carries its own
`timezone` field and belongs to the scheduled-email contract.

**Why it matters.** The day label read `todayId(cast)` while the hour read
`new Date().toLocaleTimeString(…)` — the browser's own zone — so for the hours where the two zones
hold different dates the card named one day and the countdown counted from another. Measured on
main's build at 00:30 in Madrid: «Sunday 13.09 · 07:00 · 4 deliveries» under «Next batch in 6h
30m», when Lima's 13.09 07:00 had gone ten and a half hours earlier and the real next batch was
Monday 14.09 07:30, fourteen hours out. And a Spanish workspace read Lima's hour, which is the
same defect with the market on the wrong side of it: «17:30 now» on a screen standing in Madrid at
half past midnight, seven hours and a calendar day from the clock on the wall behind it.

Two invariants are proved now. The label and the countdown agree at every hour of the day, in every
browser zone; and the hour a workspace states is its own market's.
`app/tools/test-prep-clock.mjs` (602 checks) holds the arithmetic — both markets, every hour of the
day, five browser zones, and Madrid's summer and winter — and `drives/drive-cedar-prep-clock.py`
(134 checks) walks the screen:
a Peruvian house and a Spanish one, from Madrid, from Lima and from UTC, at two instants across a
midnight, at 1600, 390 and 320, plus a midnight that passes while Prep is open and the library row
that reports a press. That drive stands at 134 green / 0 red on this build and at 76 green / 58 red
on main's own (`app/dist-export-review`, source `14157a5d`). At 22:30Z a Peruvian workspace reads
«17:30 now · Next batch in 14h · Monday 14.09 · 07:30» from all three browser zones, and a Spanish
one reads «00:30 now · Next batch in 6h 30m · Monday 14.09 · 07:00» from all three.

The active print workflow uses the released printable-sale rules. Supplier intake, customer
outbound automation, ERP automation, scheduled subcontractor email and the parked dispatch area
remain capability-gated. Sector-specific release checks still belong to the operational workflow
that commits the sale; the print screen leaves review-held sales in Review.

The Export centre, its print screen, and a direct Sales print screen each own one browser-history
layer. Back removes the innermost layer. Forward restores its serialized `PrintScreenRequest`.

## Executable proof

Build the English candidate, then run:

```bash
cd app
npm run build:app-en
cd ..
ROCOTO_DIST=app/dist-export-review ROCOTO_SHOTS=/tmp/cedar-print \
  .venv/bin/python drives/drive-cedar-print-workflow.py
```

The drive walks 390×844 with Inventory off, then repeats the preparation surface at 1600×900 and
320×720, and finishes with a run that names a Google key and refuses every `maps.googleapis.com`
request. It asserts the relative Peru day, sticky day headers, retired eye/chevron controls,
packing availability and rows, the exact next-slot selection, Back/Forward, zero Remaining, range
source ids, the primary action's count, the popup's exact sale ids and zero page errors; and, from
2026-09-11:

- every listed delivery is a mark of its own or a member a group names, those two carry the listed
  sale ids, every control sits inside the map box AND clear of the clock card at all three widths,
  a mark's control is its own glyph rather than a 44 px square, and a group's is the touch target
  (⚠ the first three were retargeted on 2026-09-13: they counted `map-order-` controls against the
  rows, which held while every delivery drew its own mark);
- the list, the map and the heading's count are the same near-term window, and the book past it is
  stated as «N more after <day>»;
- Tab from the map lands on the card's first control, and the marks stand outside the tab order;
- the nested map marks the delivery it is titled after;
- a configured key costs ONE Maps JavaScript load and no Static Maps request, and against a stubbed
  Maps API the Google ground draws our own controls, with the listed sale ids, opening the same
  Delivery Note, while the row thumbnails stay on the files;
- the card has no scroll range of its own, the outer surface moves it over a map that stays, the
  last delivery row is reachable, and returning to the top restores the peek;
- the download is captured with `expect_download`: its bytes match the stated size, its rows match
  the stated deliveries, and its money column sums to the stated total;
- deliveries, documents, dividers, copies and sheets, including two copies doubling the sheets and
  a multi-truck run counting its dividers as documents;
- a refused Google ground falls back to the tiles with every delivery still on the map;
- the rows, the heading, `data-upcoming`, `data-pins` and `prep-map-coverage` state one arithmetic;
  a typed address carries a 56 px mark rather than a door, and its row still opens its own Delivery
  Note, with the singular reading «141 on the map · 1 at a typed address»;
- a window where EVERY door was typed — the cast is intercepted so the bundle carries no coordinate
  at all — draws no `prep-map-background`, states «Every upcoming delivery is at a typed address.»
  in `prep-map-empty`, holds nothing in the picture area's tab order, and reads «0 on the map · 142
  at typed addresses» under the heading, at 390, 1600 and 320;
- `data-fitted` is true at 320, 390 and 1600, and again on the Castellano entry, where the marks
  also stand clear of that entry's own clock card;
- one `new api.Map` per picture a person opens — three with Prep, a row's map screen and a Delivery
  Note open, two once the note is closed — counted by a stub counter, against a stub that attaches
  the constructors only inside `importLibrary`, attached on a tick after the bootstrap and announced
  through Google's `callback`;
- the desk pager names the documents it counts and the phone keeps the compact ratio;

and, from 2026-09-13 (FEED-IA §247.8):

- dense marks collapse into counted groups at 390, 1600, 320, on the nested map screen, on the
  stubbed Google ground and on the Castellano entry; each group reads its own count, says «{n}
  deliveries here», carries `map-cluster-<n>` and stands outside the tab order;
- the groups' members plus the marks that stand alone are every delivery the figure names, counted
  once — `data-drawn` equals `data-markers` on a whole window and neither ever shrinks for a group;
- pressing a group draws its own deliveries — plus the delivery the picture is titled after — at a
  ground at least as sharp, with every member still on the picture and the group opened into more
  than one control or stating the end of the narrowing; **Show all** stands at the touch target on
  the narrowed picture and puts the whole window back, and so does browser Back, after which the
  screen the picture is on is still open;
- every mark and every group takes its own press — `elementFromPoint` at each control's centre
  lands inside that control — on the whole window, on the narrowed picture and at the end of a walk
  that presses the biggest group until every group left says this picture has no room to open it,
  at 390, 1600, 320, on the nested map screen, and on both of those pictures over Google's ground;
- a mark still opens its exact Delivery Note, on both grounds, whether it stood alone from the
  start or was reached by opening a group.

Its review frames are:

- `/tmp/cedar-print/01-batch-hub-390.png`
- `/tmp/cedar-print/02-packing-stock-off-390.png`
- `/tmp/cedar-print/02b-current-day-390.png`
- `/tmp/cedar-print/03-zero-remaining-390.png`
- `/tmp/cedar-print/04-range-print-390.png`
- `/tmp/cedar-print/05-print-requested-390.png`
- `/tmp/cedar-print/06-download-390.png` · `06-download-1600.png`
- `/tmp/cedar-print/07-batch-hub-1600.png` · `07-batch-hub-320.png`
- `/tmp/cedar-print/08-prep-scrolled-390.png` · `-1600.png` · `-320.png`
- `/tmp/cedar-print/10-google-fallback-390.png` · `12-google-ground-390.png`
- `/tmp/cedar-print/16-prep-es-390.png` · `16-prep-es-1600.png` — the Castellano entry's own Prep
- `/tmp/cedar-print/17-typed-address-390.png` · `-1600.png` · `-320.png` — the row with the mark
- `/tmp/cedar-print/18-print-pager-1600.png` — «Truck 2 · 1 packing list · 2 of 2 documents»
- `/tmp/cedar-print/19-typed-only-typed-390.png` · `-typed-1600.png` · `-typed-320.png` — the
  picture area with no coordinates behind it, stating what it holds
- `/tmp/cedar-print/20-clusters-whole-*.png` · `21-clusters-narrowed-*.png` — the grouped window
  and the picture a group opens onto, at 390, 1600, 320, on the map screen and on Google's ground

The pure arithmetic has its own suite: `node app/tools/test-print-measures.mjs` (233 checks, and the
number it prints is the number it ran rather than one typed at the bottom) proves the map fit, the
card the fit keeps its marks clear of, `fitted` as the same answer a drive measures, the coverage a
window with a typed address has, the fan, the mark's hit box, the grouping of dense marks — two
marks 10 px apart in one group and 60 px apart in two, the group's centre as its members' mean, the
seed as the earliest member, the same marks giving the same groups, the mark the control would have
covered claimed rather than left under it, two group controls one finger apart merged into one, a
group pushed clear of the picture's titled mark, the partition total at every width Prep draws, a
press that reaches a sharper ground and separates its members, and the end of the narrowing where
the box has one arm of room — plus the 4,000-picture fuzz behind «every control takes its own
press» — the five print measures, the byte count with accents and the money column against the
total, in Peru and in Spain.

`app/tools/build-map-tiles.py` draws a FIVE-by-three strip per place at zoom 14 — the sharpest
ground is the one a fitted picture can land on with a box wider than three tiles, and the
three-by-three it drew before left 34 of the 187 tiles a z14 fit can put on screen as quiet ground.
425 tiles in all, under a 440 ceiling; the whole-box fill at z14 was measured at 558, with 178
pictures a fit can never ask for.
