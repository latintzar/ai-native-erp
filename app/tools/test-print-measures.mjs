/* Cedar preparation arithmetic — the map viewport, the paper's counts and the file's bytes.
 *
 * Peter, 2026-09-10: «the logic of printing etc. the numbers dont add up. make sure its actually
 * calculating everything», «Make sure that for all the addresses you actually come up with, they
 * all show up on the map» and «It's not calculating the right download size».
 *
 * Run: node tools/test-print-measures.mjs
 */
import strict from 'node:assert/strict';

/* THE COUNT THIS FILE PRINTS IS THE COUNT IT RAN. It was a number typed at the bottom and edited by
   hand, which is a claim about the test rather than a measurement of it — and a loop that grew by
   a box moved the truth without moving the number. Every assertion goes through here. */
let checks = 0;
const counted = (name) => (...args) => { checks += 1; return strict[name](...args); };
const assert = {
  equal: counted('equal'),
  notEqual: counted('notEqual'),
  deepEqual: counted('deepEqual'),
  notDeepEqual: counted('notDeepEqual'),
  ok: counted('ok'),
};
import { loadTypeScript } from './ts-module.mjs';

const {
  MAP_ZOOM_SHARPEST, MAP_ZOOM_WIDEST, MAP_TILE, MARK_HIT_FLOOR, PIN_CONTROL,
  boundsOf, mapFitOf, placeFitOf, mapFramesOf, markerPlacementsOf, placementsInside, placementsClear,
  markHitBox, mapCoverageOf, printMeasuresOf, printMeasureWords, dividersIn, byteWords,
  clusterPlacementsOf, clusterClearOf, groupingHolds, groupingStandsApart,
} = loadTypeScript('src/prototypes/cedar/print-measures.ts', 'cedar-print-measures');

/* ── THE MAP HOLDS EVERY ADDRESS ─────────────────────────────────────────────────────────── */

/** The fish house's own delivery world, off `cast.ts`: the market, the centre, the coast run. */
const world = [
  { id: 'd1-manolo', at: { lat: 41.4022, lng: 2.1560 }, label: 'Bar Manolo' },
  { id: 'd1-cansole', at: { lat: 41.3792, lng: 2.1899 }, label: 'Can Solé' },
  { id: 'd1-hotelrec', at: { lat: 41.3925, lng: 2.1745 }, label: 'Hotel Rec' },
  { id: 'd1-nou', at: { lat: 41.4415, lng: 2.1770 }, label: 'Restaurant Nou' },
  { id: 'd1-vera', at: { lat: 41.5388, lng: 2.4449 }, label: 'Distribuciones Vera' },
  { id: 'd1-mercat', at: { lat: 41.3352, lng: 2.1275 }, label: 'Mercat del Port' },
];

const bounds = boundsOf(world);
assert.deepEqual(bounds, { north: 41.5388, south: 41.3352, east: 2.4449, west: 2.1275 });
assert.equal(boundsOf([]), null, 'an empty marker set has no box');

/* THE DEFECT, STATED AS ARITHMETIC. A fixed sharp ground centred on the first customer leaves the
   coast run thousands of pixels outside a phone-sized picture.
   ⚠ `placeFitOf(at, zoom, span)` TAKES THREE ARGUMENTS. This call passed 390 and 210 as if they
   were a box, so `span` became 390 and the loop built 781 × 781 = 609,961 tile objects for a
   ground no surface draws — the assertions passed for a reason unrelated to the sentence above
   them. The default span is the three-by-three the thumbnail and the Delivery Note actually use;
   the 390 × 210 belongs where the picture is measured, which is `placementsInside` below. */
const fixed = placeFitOf(world[0].at, MAP_ZOOM_SHARPEST);
assert.equal(fixed.tiles.length, 9, 'the sharp single-place ground is three tiles by three');
const fixedPlacements = markerPlacementsOf(world, fixed);
assert.equal(placementsInside(fixedPlacements, 390, 210), false,
  'zoom 14 around one customer cannot hold the delivery world');
assert.ok(Math.max(...fixedPlacements.map((p) => Math.abs(p.x))) > 3000,
  'the coast run stands about 3,300 px off a zoom-14 centre');

for (const [width, height] of [[390, 210], [1080, 260], [358, 360], [1080, 480], [320, 190]]) {
  const fit = mapFitOf({ markers: world, width, height });
  const placements = markerPlacementsOf(world, fit);
  assert.equal(placements.length, world.length, `${width}×${height} keeps every pin`);
  assert.equal(placementsInside(placements, width, height), true,
    `${width}×${height} holds every pin inside the picture`);
  assert.ok(fit.zoom >= MAP_ZOOM_WIDEST && fit.zoom <= MAP_ZOOM_SHARPEST, 'the zoom is a checked-in ground');
  assert.equal(fit.fitted, true, `${width}×${height} found a zoom that fits`);
  assert.ok(fit.tiles.length > 0 && fit.tiles.length <= 96, 'the ground stays bounded');
  /* the tiles cover the box: the picture reaches every edge */
  assert.ok(Math.min(...fit.tiles.map((t) => t.left)) <= -width / 2, 'the ground reaches the left edge');
  assert.ok(Math.max(...fit.tiles.map((t) => t.left + MAP_TILE)) >= width / 2, 'the ground reaches the right edge');
  assert.ok(Math.min(...fit.tiles.map((t) => t.top)) <= -height / 2, 'the ground reaches the top edge');
  assert.ok(Math.max(...fit.tiles.map((t) => t.top + MAP_TILE)) >= height / 2, 'the ground reaches the bottom edge');
}

/* A DESK PICTURE IS SHARPER THAN A PHONE PICTURE, because it has the room for it. */
assert.ok(mapFitOf({ markers: world, width: 1080, height: 480 }).zoom
  > mapFitOf({ markers: world, width: 390, height: 210 }).zoom,
  'a bigger box earns a sharper ground');

/* ONE ORDER KEEPS THE SHARPEST GROUND, and stands a little below the middle — its pin hangs by
   its tip, so a point dead centre would put the head of the drop in the upper half and the eye
   reads the picture off the head. */
const single = mapFitOf({ markers: [world[0]], width: 390, height: 210 });
assert.equal(single.zoom, MAP_ZOOM_SHARPEST);
assert.deepEqual(markerPlacementsOf([world[0]], single).map((p) => [Math.round(p.x), Math.round(p.y)]), [[0, 14]],
  'a single order stands on the centre line, its head in the middle of the picture');
assert.equal(placementsInside(markerPlacementsOf([world[0]], single), 390, 210), true,
  'and its whole 44px control is inside the picture');

/* TWO ORDERS AT ONE ADDRESS KEEP TWO CONTROLS. */
const shared = [
  { id: 'a', at: { lat: 41.4022, lng: 2.1560 }, label: 'Bar Manolo' },
  { id: 'b', at: { lat: 41.4022, lng: 2.1560 }, label: 'Bar Manolo · second order' },
];
const sharedFit = mapFitOf({ markers: shared, width: 390, height: 210 });
const sharedPlacements = markerPlacementsOf(shared, sharedFit);
assert.notDeepEqual(
  [sharedPlacements[0].x, sharedPlacements[0].y],
  [sharedPlacements[1].x, sharedPlacements[1].y],
  'orders at one coordinate fan onto separate controls');
assert.deepEqual(sharedPlacements.map((p) => p.id), ['a', 'b'], 'each control keeps its exact sale id');
assert.equal(placementsInside(sharedPlacements, 390, 210), true,
  'and the fan stays inside the picture the fit measured');

/* THE FAN IS PART OF WHAT THE BOX HAS TO HOLD. Four orders on the southernmost address push one
   control a further ten pixels down, and a fit taken off the coordinates alone loses it. */
const crowdedEdge = [
  ...world,
  ...['x1', 'x2', 'x3', 'x4'].map((id) => ({ id, at: { lat: 41.3352, lng: 2.1275 }, label: id })),
];
for (const [width, height] of [[390, 210], [720, 260], [320, 190]]) {
  const fit = mapFitOf({ markers: crowdedEdge, width, height });
  assert.equal(placementsInside(markerPlacementsOf(crowdedEdge, fit), width, height), true,
    `${width}×${height} holds a fanned edge address`);
}

/* ── THE CARD OVER THE CORNER, AND THE MARKS THAT KEEP OUT OF IT ─────────────────────────── */

/* Prep draws a clock card over the top-left of its map. The fit measured the whole box, so most of
   the marks were painted underneath it: at 320 every one of the 142 controls intersected that card
   (measured in the browser). The fit takes the card's rectangle now and fits the marks into the
   room it leaves — under it, or beside it, whichever arm of the L is wider. */
const clock = { right: 189, bottom: 112 };
/* The three boxes Prep actually draws: 320, 390 and the desk, each at the picture's own height. */
for (const [width, height] of [[288, 260], [358, 260], [1080, 260], [1080, 480]]) {
  const open = mapFitOf({ markers: world, width, height });
  const cleared = mapFitOf({ markers: world, width, height, avoid: clock });
  assert.equal(cleared.fitted, true, `${width}×${height} finds a zoom that clears the card`);
  assert.equal(placementsInside(markerPlacementsOf(world, cleared), width, height), true,
    `${width}×${height} still holds every pin inside the picture`);
  assert.equal(placementsClear(markerPlacementsOf(world, cleared), width, height, clock), true,
    `${width}×${height} keeps every mark clear of the clock card`);
  assert.ok(cleared.zoom <= open.zoom,
    'the room a card takes is paid for in zoom rather than in hidden pins');
}

/* AND A PICTURE TOO SMALL FOR BOTH PROMISES KEEPS THE ONE THAT MATTERS. A mark under a card is
   behind something; a mark outside the box is gone — so the fit says `fitted: false` and holds
   every pin on the picture. */
const cramped = mapFitOf({ markers: world, width: 288, height: 190, avoid: clock });
assert.equal(cramped.fitted, false, 'a box with no room for the card says so');
assert.equal(placementsInside(markerPlacementsOf(world, cramped), 288, 190), true,
  'and still holds every pin on the picture');
/* AND THE DEFECT ITSELF: the same box with no inset puts marks under the card. */
assert.equal(placementsClear(markerPlacementsOf(world, mapFitOf({ markers: world, width: 358, height: 210 })), 358, 210, clock), false,
  'a fit measured against the whole box paints marks under the card');

/* THE TWO ARMS, WIDEST FIRST, and no card means one rectangle which is the whole box. */
const armed = mapFramesOf({ width: 358, height: 210, padX: 28, padTop: 52, padBottom: 24, avoid: clock });
assert.equal(armed.length, 2, 'a card in the corner leaves two rectangles');
assert.deepEqual(mapFramesOf({ width: 358, height: 210, padX: 28, padTop: 52, padBottom: 24 }),
  [{ left: 28, right: 330, top: 52, bottom: 186 }], 'with no card the frame is the whole box');

/* `fitted` IS THE ANSWER TO ONE QUESTION, so the flag the figure publishes and the measurement a
   drive takes have to be the same answer. Where the fit says it fitted, every mark is clear of the
   card; where it says it did not, it kept the pins on the picture instead. */
for (const [width, height] of [[288, 260], [358, 260], [1080, 260], [288, 190]]) {
  const fit = mapFitOf({ markers: world, width, height, avoid: clock });
  const placements = markerPlacementsOf(world, fit);
  assert.equal(placementsClear(placements, width, height, clock), fit.fitted,
    `${width}×${height}: data-fitted says exactly whether the marks cleared the card`);
  assert.equal(placementsInside(placements, width, height), true,
    `${width}×${height}: and every pin is on the picture either way`);
}

/* ── WHAT THE PICTURE HOLDS OF WHAT THE LIST COUNTS ──────────────────────────────────────── */

/* A delivery whose address was typed has no coordinate, so the heading counts it and the map
   cannot draw it. The two numbers under the picture are derived once and add back up. */
const mixed = [
  { id: 'a', at: world[0].at },
  { id: 'b', at: world[1].at },
  { id: 'c' },
];
const drawn = mixed.filter((sale) => sale.at);
const coverage = mapCoverageOf(mixed.length, drawn.length);
assert.deepEqual(coverage, { deliveries: 3, onMap: 2, typed: 1 },
  'a book with one typed address is three deliveries, two marks and one address');
assert.equal(coverage.onMap + coverage.typed, coverage.deliveries,
  'the two numbers under the picture add back up to the heading');
assert.deepEqual(mapCoverageOf(142, 142), { deliveries: 142, onMap: 142, typed: 0 },
  'a book the picture holds whole has nothing left to say');
assert.equal(mapCoverageOf(142, 142).typed, 0, 'which is why the line renders only where they differ');
assert.deepEqual(mapCoverageOf(0, 0), { deliveries: 0, onMap: 0, typed: 0 }, 'an empty window counts nothing');
/* AND THE FIT IS TAKEN OFF THE MARKS THAT EXIST, never off the count above them. */
const mixedFit = mapFitOf({ markers: drawn, width: 358, height: 260 });
assert.equal(markerPlacementsOf(drawn, mixedFit).length, 2, 'the picture draws the two it has');
assert.equal(placementsInside(markerPlacementsOf(drawn, mixedFit), 358, 260), true,
  'and holds both of them inside the box');

/* ── DENSE MARKS COLLAPSE INTO COUNTED GROUPS ────────────────────────────────────────────── */

/* Fixed pixel coordinates, so the distances are the assertion rather than a consequence of a
   projection. `clusterPlacementsOf` takes placements, which is what the picture already has. */
const pointAt = (id, x, y, batch = false) => ({ id, label: id, batch, x, y, fanX: 0, fanY: 0, index: 0 });

const near = [pointAt('one', 0, 0), pointAt('two', 10, 0)];
const apart = [pointAt('one', 0, 0), pointAt('two', 60, 0)];
const closeGroup = clusterPlacementsOf(near, PIN_CONTROL);
assert.equal(closeGroup.clusters.length, 1, 'two marks 10px apart are one group');
assert.equal(closeGroup.singles.length, 0, 'and neither of them stands alone');
assert.deepEqual(closeGroup.clusters[0].members, ['one', 'two'], 'the group names both of them');
assert.equal(closeGroup.clusters[0].x, 5, 'the group stands at the mean of its members');
assert.equal(closeGroup.clusters[0].y, 0, 'on both axes');
assert.equal(clusterPlacementsOf(apart, PIN_CONTROL).clusters.length, 0,
  'two marks 60px apart are further than one finger, so they stay two marks');
assert.equal(clusterPlacementsOf(apart, PIN_CONTROL).singles.length, 2, 'and each keeps its own control');
/* THE RADIUS IS THE TOUCH TARGET, and the boundary belongs to the group. */
assert.equal(clusterPlacementsOf([pointAt('one', 0, 0), pointAt('two', PIN_CONTROL, 0)], PIN_CONTROL).clusters.length, 1,
  'a mark exactly one touch target away is still within reach of the same finger');
assert.equal(clusterPlacementsOf([pointAt('one', 0, 0), pointAt('two', PIN_CONTROL + 1, 0)], PIN_CONTROL).clusters.length, 0,
  'and one pixel further is its own mark');
/* THE DISTANCE IS A RADIUS, never a box: a diagonal neighbour is measured the same way. */
assert.equal(clusterPlacementsOf([pointAt('one', 0, 0), pointAt('two', 40, 40)], PIN_CONTROL).clusters.length, 0,
  '40px across and 40px down is 57px away, which is two marks');

/* ORDER-STABLE, AND THE SEED IS THE EARLIEST MEMBER. The markers arrive soonest-first, so the
   group a person presses is named after the delivery that leaves first. */
const crowd = [pointAt('a', 0, 0), pointAt('b', 8, 4), pointAt('c', 300, 0), pointAt('d', -6, 9), pointAt('e', 306, 6)];
const grouped = clusterPlacementsOf(crowd, PIN_CONTROL);
assert.equal(grouped.clusters.length, 2, 'two crowds are two groups');
assert.deepEqual(grouped.clusters.map((cluster) => cluster.id), ['a', 'c'], 'each named after its earliest member');
assert.deepEqual(grouped.clusters[0].members, ['a', 'b', 'd'], 'members keep the order the markers were given');
assert.equal(grouped.singles.length, 0, 'and nothing is left over');
assert.deepEqual(clusterPlacementsOf(crowd, PIN_CONTROL), grouped, 'the same marks give the same groups');

/* A CLUSTER IS A WAY OF SHOWING ALL OF THEM, NEVER A WAY OF HIDING SOME. The partition is total:
   singles plus members is the marker set, counted once. */
assert.equal(groupingHolds(grouped, crowd), true, 'every mark is in exactly one place');
assert.equal(grouped.singles.length + grouped.clusters.reduce((sum, one) => sum + one.members.length, 0),
  crowd.length, 'and the two counts add back up to the deliveries');
assert.equal(groupingHolds(clusterPlacementsOf([], PIN_CONTROL), []), true, 'an empty picture groups nothing');
assert.deepEqual(clusterPlacementsOf([pointAt('one', 0, 0)], PIN_CONTROL).singles.map((one) => one.id), ['one'],
  'one mark is one mark');

/* ⚠ A MARK UNDER THE GROUP'S CONTROL BELONGS TO THE GROUP. The seed promises only that an
   unclaimed mark is further than the radius from the SEED; the control is drawn at the members'
   MEAN, which is a different point. Two marks one control apart and a third 60px out is a group
   whose mean stands 38px from that third mark — inside the control drawn there, which swallowed
   every press aimed at it (photographed, 2026-09-13). */
const underTheDisc = [pointAt('a', 0, 0), pointAt('b', 44, 0), pointAt('c', 60, 0)];
const seeded = clusterPlacementsOf(underTheDisc, PIN_CONTROL);
assert.equal(seeded.clusters.length, 1, 'the seed claims what is inside its own radius');
assert.deepEqual(seeded.singles.map((one) => one.id), [],
  'and the mark the control would have covered is claimed by the second pass rather than left under it');
assert.deepEqual(seeded.clusters[0].members, ['a', 'b', 'c'], 'so the group names all three');
assert.equal(Math.round(seeded.clusters[0].x), 35, 'and the mean is taken again with it inside');
assert.equal(groupingHolds(seeded, underTheDisc), true, 'the partition is still total');
/* A MARK THE CONTROL WOULD MISS STAYS ITS OWN MARK. */
const clearOfTheDisc = [pointAt('a', 0, 0), pointAt('b', 44, 0), pointAt('c', 200, 0)];
const kept = clusterPlacementsOf(clearOfTheDisc, PIN_CONTROL);
assert.deepEqual(kept.singles.map((one) => one.id), ['c'], 'a mark well past the control keeps its own');
assert.equal(kept.clusters.length, 1, 'and the group holds the two that share a spot');

/* ⚠ AND TWO GROUPS DRAWN INSIDE ONE FINGER OF EACH OTHER ARE ONE GROUP. Two means can stand near
   each other where no seed did: five marks make {a,b} at (22,0) and {c,d} at (44.5,20.5), whose
   controls are 30px apart — both carry the same z-index, so DOM order took the press and the
   earlier group lost it together with every delivery it named. Found by the fuzz below in 571 of
   4,000 placement sets, the nearest pair 20.4px apart. */
const twoMeans = [pointAt('a', 0, 0), pointAt('b', 44, 0), pointAt('c', 44, 1), pointAt('d', 45, 40), pointAt('e', 60, 70)];
const merged = clusterPlacementsOf(twoMeans, PIN_CONTROL);
assert.equal(merged.clusters.length, 1, 'two group controls one finger apart are one group');
assert.deepEqual(merged.clusters[0].members, ['a', 'b', 'c', 'd'], 'holding both memberships');
assert.equal(merged.clusters[0].id, 'a', 'still named after the earliest member of the pair');
assert.deepEqual(merged.singles.map((one) => one.id), ['e'], 'and the mark beyond both keeps its own control');
assert.equal(Math.round(merged.clusters[0].x * 100) / 100, 33.25, 'the mean is taken again over everyone inside');
assert.equal(groupingHolds(merged, twoMeans), true, 'the partition is still total after a merge');
assert.equal(groupingStandsApart(merged, PIN_CONTROL), true, 'and every control drawn stands its own finger away');
assert.deepEqual(clusterPlacementsOf(twoMeans, PIN_CONTROL), merged, 'merging keeps the same answer for the same marks');

/* EVERY CONTROL TAKES ITS OWN PRESS, OVER THOUSANDS OF PICTURES RATHER THAN OVER FIVE. The drive
   reads this off the browser with `elementFromPoint` on the pictures it walks; the fuzz holds the
   arithmetic to it everywhere, which is where the group-to-group case came from. */
let seed = 20260914;
const roll = (span) => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed / 2147483648) * span; };
let closest = Infinity;
const lost = [];
const crowded = [];
for (let round = 0; round < 4000; round += 1) {
  const marks = [];
  const count = 3 + Math.floor(roll(40));
  for (let at = 0; at < count; at += 1) marks.push(pointAt(`f${at}`, Math.round(roll(400)) - 200, Math.round(roll(240)) - 120));
  const fuzzed = clusterPlacementsOf(marks, PIN_CONTROL);
  if (!groupingHolds(fuzzed, marks)) lost.push(round);
  if (!groupingStandsApart(fuzzed, PIN_CONTROL)) crowded.push(round);
  const points = [...fuzzed.singles, ...fuzzed.clusters];
  for (let one = 0; one < points.length; one += 1) {
    for (let two = one + 1; two < points.length; two += 1) {
      closest = Math.min(closest, Math.hypot(points[one].x - points[two].x, points[one].y - points[two].y));
    }
  }
}
assert.deepEqual(lost, [], 'every delivery is in exactly one place in 4,000 fuzzed pictures');
assert.deepEqual(crowded, [], 'and every control in them stands its own finger from every other');
assert.ok(closest > PIN_CONTROL, `the nearest two controls in those 4,000 pictures are ${closest.toFixed(1)}px apart`);

/* THE MARK THE PICTURE IS TITLED AFTER IS HELD OUT OF THE GROUPING, so the group is pushed off it
   instead: `clusterClearOf` moves a control that lands on that mark straight out along the line
   between them, until a whole control stands between the two points. */
const onTheDrop = { id: 'g', members: ['a', 'b'], x: 10, y: 0, batch: false };
const pushed = clusterClearOf(onTheDrop, { x: 0, y: 0 }, PIN_CONTROL);
assert.equal(Math.round(Math.hypot(pushed.x, pushed.y)), PIN_CONTROL,
  'a group on the picture’s own subject is pushed one control away from it');
assert.equal(pushed.y, 0, 'along the line that already separates them');
assert.deepEqual(clusterClearOf(onTheDrop, { x: 300, y: 0 }, PIN_CONTROL), onTheDrop,
  'and a group already clear of it stands where its members are');
assert.deepEqual(clusterClearOf(onTheDrop, null, PIN_CONTROL), onTheDrop,
  'a picture with no titled mark pushes nothing');
const exactly = clusterClearOf({ ...onTheDrop, x: 0, y: 0 }, { x: 0, y: 0 }, PIN_CONTROL);
assert.equal(exactly.y, PIN_CONTROL,
  'a group exactly on it goes below the point, which is the half of a drop’s control that is free');

/* ⚠ AND THE PUSH IS PART OF THE SETTLE LOOP, BECAUSE IT MOVES THE CONTROL. Four marks make two
   groups whose means stand 46 px apart — their own finger — and a drop one pixel behind the first
   mean pushes that group 44 px STRAIGHT AT the second, leaving two counts 3 px apart and one of
   them holding both presses. Found on 2026-09-14 over 400,000 random pairs, the closest 2.7 px.
   Handing the drop to `clusterPlacementsOf` settles it: the loop merges what the push brought
   together, so the point it holds apart is the point that ends up drawn. */
const pushedTogether = [pointAt('a', -10, 0), pointAt('b', 10, 0), pointAt('c', 36, 0), pointAt('d', 56, 0)];
const looseAnswer = clusterPlacementsOf(pushedTogether, PIN_CONTROL);
assert.equal(looseAnswer.clusters.length, 2, 'with nothing titled the four marks are two groups');
assert.deepEqual([looseAnswer.clusters[0].x, looseAnswer.clusters[1].x], [0, 46],
  'whose means stand their own finger apart');
const titledHere = { x: -1, y: 0 };
/* the way it was drawn before: group first, push after — kept here as the witness, because it is
   the arithmetic that put two counts 3 px apart */
const pushedAfter = looseAnswer.clusters.map((cluster) => clusterClearOf(cluster, titledHere, PIN_CONTROL));
assert.equal(Math.round(Math.hypot(pushedAfter[0].x - pushedAfter[1].x, pushedAfter[0].y - pushedAfter[1].y)), 3,
  'pushing a group off the drop after the grouping left two counts 3px apart');
const cleared = clusterPlacementsOf(pushedTogether, PIN_CONTROL, titledHere);
assert.equal(cleared.clusters.length, 1, 'a drop behind the first mean makes the push merge them');
assert.deepEqual(cleared.clusters[0].members, ['a', 'b', 'c', 'd'], 'into one group holding all four');
assert.equal(Math.round(Math.hypot(cleared.clusters[0].x - titledHere.x, cleared.clusters[0].y - titledHere.y)),
  PIN_CONTROL, 'standing one control from the mark the picture is titled after');
assert.equal(groupingHolds(cleared, pushedTogether), true, 'and still holding every delivery once');
assert.equal(groupingStandsApart(cleared, PIN_CONTROL), true, 'with every control its own finger from every other');

/* THE SAME CLAIM OVER THOUSANDS OF TITLED PICTURES: the nested map screen is the one that has a
   drop, so the fuzz runs again with one mark held out as the picture's own subject. Grouping first
   and pushing after drew two controls inside one finger in 156 of these 4,000 pictures, the
   closest pair 26.6 px apart; the loop below draws none. */
let dropSeed = 20260915;
const dropRoll = (span) => { dropSeed = (dropSeed * 1103515245 + 12345) % 2147483648; return (dropSeed / 2147483648) * span; };
const swallowed = [];
const touchingDrop = [];
let nearestDrop = Infinity;
for (let round = 0; round < 4000; round += 1) {
  const marks = [];
  const count = 3 + Math.floor(dropRoll(40));
  for (let at = 0; at < count; at += 1) marks.push(pointAt(`f${at}`, Math.round(dropRoll(400)) - 200, Math.round(dropRoll(240)) - 120));
  const titled = marks[Math.floor(dropRoll(marks.length))];
  const groupable = marks.filter((one) => one.id !== titled.id);
  const fuzzed = clusterPlacementsOf(groupable, PIN_CONTROL, titled);
  if (!groupingHolds(fuzzed, groupable)) swallowed.push(round);
  if (!groupingStandsApart(fuzzed, PIN_CONTROL)) touchingDrop.push(round);
  for (const cluster of fuzzed.clusters) {
    nearestDrop = Math.min(nearestDrop, Math.hypot(cluster.x - titled.x, cluster.y - titled.y));
  }
}
assert.deepEqual(swallowed, [], 'the titled mark stays out and every other delivery is placed once');
assert.deepEqual(touchingDrop, [], 'every control stands its own finger from every other, drop included');
assert.ok(nearestDrop >= PIN_CONTROL - 0.001,
  `the nearest count to a titled mark in 4,000 pictures is ${nearestDrop.toFixed(1)}px away`);

/* THE BATCH RING SURVIVES THE GROUPING. The picture carries two scopes at once, so a group that
   holds a delivery about to leave still says so. */
const scopes = clusterPlacementsOf([pointAt('a', 0, 0), pointAt('b', 6, 0, true), pointAt('c', 300, 0)], PIN_CONTROL);
assert.equal(scopes.clusters[0].batch, true, 'a group holding a batch delivery wears the batch ring');
assert.equal(clusterPlacementsOf([pointAt('a', 0, 0), pointAt('b', 6, 0)], PIN_CONTROL).clusters[0].batch, false,
  'and a group of upcoming deliveries alone wears none');

/* THE REAL PIPELINE, AT THE WIDTHS PREP IS DRAWN AT. A hundred deliveries in one city is the
   smear the fan stopped answering; the grouping holds every one of them. */
const dense = [];
for (let step = 0; step < 60; step += 1) {
  dense.push({ id: `dense-${step}`, at: { lat: 41.38 + (step % 8) * 0.0016, lng: 2.17 + Math.floor(step / 8) * 0.0016 } });
}
const denseWorld = [...world, ...dense];
for (const [width, height] of [[390, 260], [1600, 260], [320, 260]]) {
  const fit = mapFitOf({ markers: denseWorld, width, height });
  const placements = markerPlacementsOf(denseWorld, fit);
  const grouping = clusterPlacementsOf(placements, PIN_CONTROL);
  assert.equal(groupingHolds(grouping, placements), true, `${width}×${height}: every delivery is still on the picture`);
  assert.ok(grouping.clusters.length > 0, `${width}×${height}: the dense city collapses into groups`);
  assert.ok(grouping.clusters.length + grouping.singles.length < placements.length,
    `${width}×${height}: and the picture draws fewer controls than it holds deliveries`);
  /* A GROUP STANDS WHERE ITS MEMBERS STAND, so the fit that held every mark holds every group. */
  for (const cluster of grouping.clusters) {
    const members = placements.filter((placement) => cluster.members.includes(placement.id));
    assert.ok(cluster.x >= Math.min(...members.map((one) => one.x)) - 0.001
      && cluster.x <= Math.max(...members.map((one) => one.x)) + 0.001,
      `${width}×${height}: a group stands inside its own members`);
  }
}

/* PRESSING A GROUP NARROWS THE PICTURE, AND THE NARROWING ENDS. The fit is recomputed for the
   members alone, which is a sharper zoom, and at that zoom the members separate. */
const wide = mapFitOf({ markers: denseWorld, width: 390, height: 260 });
const widest = clusterPlacementsOf(markerPlacementsOf(denseWorld, wide), PIN_CONTROL);
const biggest = widest.clusters.reduce((held, one) => (one.members.length > held.members.length ? one : held));
const members = denseWorld.filter((marker) => biggest.members.includes(marker.id));
const narrowed = mapFitOf({ markers: members, width: 390, height: 260 });
assert.ok(narrowed.zoom > wide.zoom, 'pressing a group asks for a sharper ground');
assert.equal(narrowed.fitted, true, 'and the narrowed picture holds its members');
const narrowedGrouping = clusterPlacementsOf(markerPlacementsOf(members, narrowed), PIN_CONTROL);
assert.equal(groupingHolds(narrowedGrouping, markerPlacementsOf(members, narrowed)), true,
  'the narrowed picture still holds every member');
assert.ok(narrowedGrouping.singles.length + narrowedGrouping.clusters.length > 1,
  'and the members stand as singles or smaller groups rather than as the same one group');

/* ⚠ AND WHERE THE PICTURE RUNS OUT OF ROOM, THE NARROWING ENDS ON THE GROUP RATHER THAN ON A
   SMEAR. Measured on 2026-09-14: the first cut drew a group's members as marks once the refit made
   one group of them, which at 390 ended at 270 marks at zoom 9 with 265 of them under another
   mark's control — the smear this section exists to close, one press further in. A picture whose
   free arm is 132×100px of a 320px box holds 120 metro deliveries in ONE group, and refitting to
   that group's own members is the same group at the same zoom: a fixed point, which the picture
   states («{n} deliveries here», `data-opens="false"`) and hands on. The same deliveries in the
   map screen's box — more than twice the height, no card over it — come apart into thirty. */
const metro = [];
for (let step = 0; step < 120; step += 1) {
  metro.push({ id: `metro-${step}`, at: { lat: 41.30 + (step % 12) * 0.006, lng: 2.05 + Math.floor(step / 12) * 0.010 } });
}
const short = { width: 320, height: 288, avoid: { right: 188, bottom: 188 } };
const shortFit = mapFitOf({ markers: metro, ...short });
const shortGrouping = clusterPlacementsOf(markerPlacementsOf(metro, shortFit), PIN_CONTROL);
assert.equal(shortGrouping.clusters.length, 1, 'a picture with one arm of room draws one group');
assert.equal(shortGrouping.singles.length, 0, 'and no mark stands beside it');
assert.equal(shortGrouping.clusters[0].members.length, metro.length, 'the group names every delivery the picture holds');
const held = metro.filter((marker) => shortGrouping.clusters[0].members.includes(marker.id));
const again = mapFitOf({ markers: held, ...short });
const againGrouping = clusterPlacementsOf(markerPlacementsOf(held, again), PIN_CONTROL);
assert.equal(again.zoom, shortFit.zoom, 'refitting to its own members asks for the same ground');
assert.equal(againGrouping.clusters.length, 1, 'and makes the same one group');
assert.equal(againGrouping.singles.length, 0, 'so this picture is the end of its own narrowing');
const roomy = mapFitOf({ markers: metro, width: 390, height: 480 });
const roomyGrouping = clusterPlacementsOf(markerPlacementsOf(metro, roomy), PIN_CONTROL);
assert.ok(roomy.zoom > shortFit.zoom && roomyGrouping.clusters.length > 1,
  'the same deliveries come apart in the picture with the room, which is where the press goes');

/* AT THE SHARPEST CHECKED-IN GROUND THE FAN IS WHAT PUTS MARKS THAT SHARE A SPOT ON THEIR OWN
   POINTS. Orders at one coordinate are pushed onto a ring, which is what the fit measures and what
   the picture draws. ⚠ It is NOT what gives them their own press, and the grouping still runs at
   zoom 14 for that: measured 2026-09-14 at 1600, the end of a narrowing that stopped grouping at
   the sharpest ground was 19 marks with 8 of them under a neighbour's control — different
   customers 100 to 200 m apart, which is 20 to 30 px there. */
const stacked = [
  { id: 's1', at: world[0].at },
  { id: 's2', at: world[0].at },
  { id: 's3', at: world[0].at },
];
const stackedFit = mapFitOf({ markers: stacked, width: 390, height: 260 });
assert.equal(stackedFit.zoom, MAP_ZOOM_SHARPEST, 'three orders at one address fit at the sharpest ground');
const fanned = markerPlacementsOf(stacked, stackedFit);
assert.equal(new Set(fanned.map((one) => `${one.x},${one.y}`)).size, 3,
  'and the fan gives each of them its own point');
const atTheSharpest = clusterPlacementsOf(fanned, PIN_CONTROL);
assert.equal(atTheSharpest.clusters.length, 1,
  'and the ring is inside one finger, so the sharpest ground draws them as a group too');
assert.equal(atTheSharpest.clusters[0].members.length, 3, 'which names all three');
/* AND TWO DIFFERENT ADDRESSES 30px APART ARE A GROUP THERE AS WELL — the case the fan never had
   an answer for, because the fan is about one coordinate. */
const neighbours = [pointAt('xifre', 0, 0), pointAt('serra', 24, 12), pointAt('rupit', 300, 0)];
const closeBy = clusterPlacementsOf(neighbours, PIN_CONTROL);
assert.deepEqual(closeBy.clusters[0].members, ['xifre', 'serra'], 'two neighbours share one control');
assert.deepEqual(closeBy.singles.map((one) => one.id), ['rupit'], 'and the street away keeps its own');

/* ── WHAT A FINGER PRESSES ───────────────────────────────────────────────────────────────── */

/* A 44px control over an 8px dot covers its neighbours, so a press on a mark that is plainly on
   the screen opened a different delivery. A mark's box is its own glyph, floored so there is
   something to press, and at the touch target where the pointer is coarse. */
assert.equal(markHitBox(8), MARK_HIT_FLOOR, 'a place mark presses at the floor rather than at 44');
assert.equal(markHitBox(8, true), PIN_CONTROL, 'and at the touch target under a coarse pointer');
assert.equal(markHitBox(52), 52, 'a glyph bigger than the floor is its own box');
assert.ok(markHitBox(8) < PIN_CONTROL, 'which is smaller than the control it replaces');

/* ── THE PAPER'S FOUR COUNTS ─────────────────────────────────────────────────────────────── */

const orders = [
  { subject: { kind: 'day', divider: 'albaranes' } },
  { subject: { kind: 'albaran', sale: 'd1-manolo' } },
  { subject: { kind: 'albaran', sale: 'd1-cansole' } },
  { subject: { kind: 'day', divider: 'albaranes' } },
  { subject: { kind: 'albaran', sale: 'd1-nou' } },
  { subject: { kind: 'albaran', sale: 'd1-vera' } },
  { subject: { kind: 'albaran', sale: 'd1-hotelrec' } },
];
assert.equal(dividersIn(orders), 2, 'a truck divider is a document that belongs to no delivery');
const one = printMeasuresOf({ deliveries: 5, documents: orders.length, dividers: dividersIn(orders), copies: 1 });
assert.deepEqual(one, { deliveries: 5, documents: 7, dividers: 2, copies: 1, sheets: 7 });
const two = printMeasuresOf({ deliveries: 5, documents: orders.length, dividers: dividersIn(orders), copies: 2 });
assert.deepEqual(two, { deliveries: 5, documents: 7, dividers: 2, copies: 2, sheets: 14 },
  'copies double the sheets and leave the deliveries alone');
assert.deepEqual(printMeasureWords(two),
  ['5 deliveries', '7 documents', '2 truck dividers', '2 copies', '14 sheets']);
assert.deepEqual(printMeasureWords(printMeasuresOf({ deliveries: 1, documents: 1, dividers: 0, copies: 1 })),
  ['1 delivery'], 'a measure equal to the one before it is the same thing said twice');
assert.deepEqual(printMeasureWords(printMeasuresOf({ deliveries: 5, documents: 5, dividers: 0, copies: 2 })),
  ['5 deliveries', '2 copies', '10 sheets'], 'copies are what turn five documents into ten sheets');

/* ── WHAT A FILE WEIGHS ──────────────────────────────────────────────────────────────────── */

assert.equal(byteWords(812), '812 bytes');
assert.equal(byteWords(1438), '1,438 bytes');
assert.equal(byteWords(12681), '12.7 kB · 12,681 bytes');

/* ── THE FILE ITSELF ─────────────────────────────────────────────────────────────────────── */

const storage = new Map([['rocoto-workspace-capabilities:fish', JSON.stringify({
  version: 1, pricing: true, inventory: false, money: true, country: 'peru',
  moneyByCountry: { peru: true, spain: false },
})]]);
globalThis.window = {
  addEventListener() {},
  location: { hostname: 'demo.soyrocoto.com' },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
};

const {
  configuredFileOf, batchMeasuresOf, deliveryFigureOf, deliveryTotalOf, fileColumnsOf, CSV_BOM,
} = loadTypeScript('src/prototypes/cedar/output-files.ts', 'cedar-output-files');

const merluza = { name: 'Merluza' };
const gamba = { name: 'Gambó de Palamós' };
const caja = { name: 'Caixa de peix' };
const sales = [
  {
    id: 'd1-cansole', number: 'A-1041', customer: { name: 'Can Solé' },
    lines: [
      { product: merluza, given: 12.5, unit: 'kg', price: 61.62 },
      { product: gamba, given: 3, unit: 'kg', price: 154.05 },
    ],
  },
  {
    id: 'd1-hotelrec', number: 'A-1042', customer: { name: 'Peix Vilalta, S.L.' },
    lines: [
      { product: merluza, given: 4, unit: 'kg', price: 61.62 },
      { product: caja, given: 2, unit: 'box', price: 39 },
    ],
  },
];

const template = {
  id: 'file-1', name: 'Order file', fileName: 'orders',
  columns: ['Customer', 'Product', 'Quantity', 'Unit price'],
  columnLabels: { Customer: 'Customer', Product: 'Product', Quantity: 'Quantity', 'Unit price': 'Unit price' },
};

assert.deepEqual(fileColumnsOf(template.columns, true),
  ['Delivery', 'Customer', 'Product', 'Quantity', 'Unit price', 'Order total'],
  'the delivery number opens the file and the delivery total closes it');
assert.deepEqual(fileColumnsOf(template.columns, false),
  ['Delivery', 'Customer', 'Product', 'Quantity'],
  'a house that hides prices downloads a file with no money column');

const peru = configuredFileOf({ template, sales, priced: true, day: '2026-09-11', country: 'peru' });
assert.equal(peru.fileName, 'orders-2026-09-11.csv');
assert.equal(peru.format, 'CSV');
/* THE HEAD ROW IS PART OF THE OBJECT, so the screen that offers the file prints what the file
   writes rather than the four fields the template chose. */
assert.deepEqual(peru.head, peru.text.split('\r\n')[0].split(','),
  'the stated head row is the file’s own first line');
assert.deepEqual(peru.head, ['Delivery', 'Customer', 'Product', 'Quantity', 'Unit price', 'Order total']);
assert.equal(peru.saleIds.join(','), 'd1-cansole,d1-hotelrec');

/* THE BOM AND THE LINE ENDINGS ARE PART OF THE FILE. */
assert.equal(peru.payload.startsWith(CSV_BOM), true, 'the payload opens with the byte-order mark');
assert.equal(peru.payload.slice(1), peru.text, 'the payload is the mark and the text, nothing else');
assert.equal(peru.text.split('\r\n').length, 3, 'a head row and one row per delivery, CRLF-terminated');

/* BYTES ARE NOT CHARACTERS. «Gambó» and «Solé» are two bytes each, and the mark is three. */
assert.equal(peru.bytes, Buffer.byteLength(peru.payload, 'utf8'));
assert.ok(peru.bytes > peru.payload.length, 'accented names weigh more than they count');
assert.equal(peru.bytes - peru.payload.length, 11,
  'two extra for the mark, one for é, two for the pair of ó, one for each of the six separators');

/** RFC 4180 back out again: a quoted cell holds this file's own separator, so a row is parsed
 *  rather than split. The drive parses the downloaded file the same way. */
const parseRow = (row) => {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let at = 0; at < row.length; at += 1) {
    const char = row[at];
    if (quoted) {
      if (char === '"' && row[at + 1] === '"') { value += '"'; at += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { cells.push(value); value = ''; }
    else value += char;
  }
  cells.push(value);
  return cells;
};

/* THE ROWS ADD UP TO THE NUMBER THE SCREEN OFFERS. */
const rows = peru.text.split('\r\n').slice(1).map(parseRow);
const totalColumn = peru.columns.indexOf('Order total');
const summed = rows.reduce((sum, row) => sum + Number(row[totalColumn]), 0);
assert.equal(Math.round(summed * 100) / 100, peru.measures.total,
  'the file’s own money column sums to the batch total');
assert.equal(peru.measures.total, 1232.40 + 324.48);
assert.equal(deliveryFigureOf(sales[0]), 1232.40, '12.5 × 61.62 + 3 × 154.05');
assert.equal(deliveryTotalOf(sales[0], 'peru'), 1232.40);
assert.equal(peru.measures.totalAsCanonical, peru.measures.total, 'Peru is the canonical currency');
assert.equal(peru.measures.deliveries, 2);
assert.equal(peru.measures.lines, 4);
assert.deepEqual(peru.measures.quantities, [{ unit: 'kg', quantity: 19.5 }, { unit: 'box', quantity: 2 }],
  'quantities sum per unit and keep their own units apart');
assert.equal(peru.measures.currency, 'PEN');

/* THE ROW COUNT IS THE DELIVERY COUNT, whatever a delivery carries. */
assert.equal(rows.length, peru.measures.deliveries);
assert.equal(rows[0][peru.columns.indexOf('Delivery')], 'A-1041');
assert.equal(rows[0][peru.columns.indexOf('Quantity')], '12.5 kg · 3 kg');

/* SPAIN CONVERTS ONCE PER DELIVERY, so the column and the total stay one number. */
const spain = configuredFileOf({ template, sales, priced: true, day: '2026-09-11', country: 'spain' });
const spainRows = spain.text.split('\r\n').slice(1).map(parseRow);
const spainSummed = spainRows.reduce((sum, row) => sum + Number(row[totalColumn]), 0);
assert.equal(Math.round(spainSummed * 100) / 100, spain.measures.total,
  'the euro column sums to the euro total');
assert.equal(spain.measures.currency, 'EUR');
assert.equal(spain.measures.total, Math.round((1232.40 / 3.9) * 100) / 100 + Math.round((324.48 / 3.9) * 100) / 100);
assert.equal(spainRows[0][spain.columns.indexOf('Unit price')].split(' · ')[0], '15.80',
  'the unit price is the country’s own money, converted once');
assert.equal(spain.measures.quantities[0].quantity, 19.5, 'a kilo is a kilo in both countries');
assert.notEqual(spain.bytes, peru.bytes, 'a converted file is its own artifact with its own size');

/* AN EMPTY SCOPE STILL PRODUCES A DESCRIBABLE FILE. */
const empty = configuredFileOf({ template, sales: [], priced: true, day: '2026-09-11', country: 'peru' });
assert.equal(empty.measures.deliveries, 0);
assert.equal(empty.measures.total, 0);
assert.equal(empty.text.split('\r\n').length, 1, 'the head row stands alone');
assert.equal(empty.bytes, Buffer.byteLength(empty.payload, 'utf8'));

/* A QUOTED CELL IS STILL ONE CELL. */
assert.ok(peru.text.includes('"Peix Vilalta, S.L."'), 'a comma inside a name is wrapped, never split');

/* WITHOUT PRICES THE FILE CARRIES NO MONEY AT ALL. */
const plain = configuredFileOf({ template, sales, priced: false, day: '2026-09-11', country: 'peru' });
assert.equal(plain.columns.includes('Order total'), false);
assert.equal(plain.columns.includes('Unit price'), false);
assert.equal(plain.measures.total, 1556.88, 'the batch is still worth what it is worth');

/* THE COUNTRY DEFAULT COMES FROM THE WORKSPACE ITSELF. */
assert.equal(batchMeasuresOf(sales, 'peru').total, 1556.88);

console.log(`Cedar print measures, map fit and download file: ${checks} checks passed`);

/* ── THE PUSH OFF THE TITLED MARK STAYS INSIDE THE PICTURE (re-review, 14 September 2026) ──────
 * A group whose members sat beside a titled mark at the fit's inset edge was pushed 44 px straight
 * off the picture, and its control's centre left the box `placementsInside` measures. With the
 * box given, the push turns along the edge until a whole control fits a full gap away. */
{
  const box = { width: 400, height: 300 };
  const titled = { x: 30, y: 150 };
  const beside = { id: 'g', members: ['a', 'b'], batch: false, x: 26, y: 150 };
  const straight = clusterClearOf(beside, titled, 44);
  assert.ok(straight.x < 22, `unbounded, the push leaves the box · x ${straight.x.toFixed(1)}`);
  const kept = clusterClearOf(beside, titled, 44, box);
  const half = 22;
  assert.ok(kept.x - half >= 0 && kept.x + half <= box.width && kept.y - half >= 0 && kept.y + half <= box.height,
    `bounded, the whole control stays inside · ${kept.x.toFixed(1)}, ${kept.y.toFixed(1)}`);
  assert.ok(Math.hypot(kept.x - titled.x, kept.y - titled.y) >= 44 - 1e-9, 'and a full gap from the titled mark');
  /* the corner: the mark in the corner, the group on it — a control still fits at 44 px away */
  const corner = clusterClearOf({ ...beside, x: 22, y: 22 }, { x: 22, y: 22 }, 44, box);
  assert.ok(corner.x - half >= 0 && corner.y - half >= 0, `the corner turns the push inward · ${corner.x.toFixed(1)}, ${corner.y.toFixed(1)}`);
  /* and a box too small for any full-gap seat clamps the straight push, deterministically */
  const tiny = clusterClearOf({ ...beside, x: 30, y: 30 }, { x: 30, y: 30 }, 44, { width: 60, height: 60 });
  assert.deepEqual([Math.round(tiny.x * 1e6) / 1e6, Math.round(tiny.y * 1e6) / 1e6], [30, 38], 'a box with no room clamps to its inside');
  /* fuzz: 2,000 random marks and groups inside random boxes, every cleared control inside */
  let seed = 20260914;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let round = 0; round < 2000; round += 1) {
    const size = { width: 120 + Math.floor(random() * 500), height: 120 + Math.floor(random() * 400) };
    const mark = { x: half + random() * (size.width - 2 * half), y: half + random() * (size.height - 2 * half) };
    const group = { id: 'g', members: ['a'], batch: false, x: mark.x + (random() - 0.5) * 40, y: mark.y + (random() - 0.5) * 40 };
    const out = clusterClearOf(group, mark, 44, size);
    assert.ok(out.x - half >= -1e-9 && out.x + half <= size.width + 1e-9 && out.y - half >= -1e-9 && out.y + half <= size.height + 1e-9,
      `round ${round}: the cleared control stays inside ${size.width}×${size.height} · ${out.x.toFixed(1)}, ${out.y.toFixed(1)}`);
  }
}
console.log('print-measures: the cluster push stays inside the picture (edge, corner, no-room clamp, 2,000-round fuzz)');

