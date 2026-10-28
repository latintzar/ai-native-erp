/* test-rail-world.mjs — THE RAILS A DOCUMENT STANDS ON, AND WHICH OF THEM THIS MODEL CAN KNOW.
 *
 * FEED-IA §247.2: «same for emailabout the connection state. always we havbe to be super
 * consistent and not fget people igo confusing menus when they shouldnt see them».
 *
 * `RailWorld` is the house's CONFIGURED rails — the ERP target Settings holds, its cadence, the
 * hour its file goes. The mailbox is a POLLED provider connection, so it is read at the surface
 * through `useEmailCapability()` and never carried here: a rail that states a constant is a model
 * pretending to answer a question it cannot reach. This file pins that boundary.
 *
 * PROVE IT RED: put an `email` member back on `railWorld`'s return and the first test names it;
 * give `emailWordsOf` a second parameter and the second test throws where it reads it.
 *
 * RUN: node app/tools/test-rail-world.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript } from './ts-module.mjs';

const require = createRequire(import.meta.url);
const path = compileTypeScript('src/prototypes/cedar/sale.ts', 'rail-world-test');
const { buildSales, emailWordsOf, erpWordsOf, exportState, fileHourOf, railWorld, slotOf, takesEmail, todayId } = require(path);
const { dayForSector } = require(join(dirname(path), 'day.js'));
const { CASTS } = require(join(dirname(path), '../../scenarios/data/cast.js'));

/** A document, reduced to the fields these two sentences read. */
const saleOf = (patch = {}) => ({
  customer: { name: 'Hotel Rec', channel: 'email', slot: undefined },
  window: '10:30',
  state: 'made',
  ...patch,
});

test('the rail world states the house’s own system and carries no mailbox', () => {
  const world = railWorld(CASTS.fish);
  assert.deepEqual(Object.keys(world), ['erp'],
    'the mailbox is the live capability, read at the surface — `RailWorld` holds the ERP alone');
  assert.equal(world.erp.connected, false);
  assert.equal(world.erp.configured, false);
  assert.equal(world.erp.name, 'Today’s file');
  assert.equal(world.erp.fileAt, fileHourOf(CASTS.fish));
  assert.equal(erpWordsOf(saleOf(), world), 'Choose an ERP to prepare its mapping. Files remain active.');
});

test('the customer’s copy reads the document alone', () => {
  const sent = saleOf({ emailScheduled: { at: '07:02', sendAt: '07:30', sent: '07:30' } });
  assert.equal(emailWordsOf(sent), 'Sent to Hotel Rec at 07:30');

  const scheduled = saleOf({ emailScheduled: { at: '07:02', sendAt: '10:30' } });
  assert.equal(emailWordsOf(scheduled), 'Goes to Hotel Rec at 10:30');

  /* A customer who works on another channel still gets their copy: it rides the crate. */
  const whatsapp = saleOf({ customer: { name: 'Bar Nou', channel: 'whatsapp', slot: undefined } });
  assert.equal(takesEmail(whatsapp), false);
  assert.equal(emailWordsOf(whatsapp), 'Bar Nou works on whatsapp, so their copy goes with the goods');

  const waiting = saleOf({ customer: { name: 'Hotel Rec', channel: 'email', slot: '09:15' } });
  assert.equal(slotOf(waiting), '09:15');
  assert.equal(emailWordsOf(waiting), 'It goes to Hotel Rec at 09:15 once the delivery note is made');
});

/* THE COUNT THE PREP DOOR CARRIES. `data-email` on the door is `state.scheduled.length` once the
   mailbox reads ready, so the partition itself is pinned here: a schedule that has yet to go is
   `scheduled`, one that went is `emailed`, and each sale lands in exactly one of them. */
test('the mail counts split a morning into what is due and what went', () => {
  const cast = CASTS.fish;
  const world = railWorld(cast);
  const today = todayId(cast);
  const sales = buildSales(cast, dayForSector('fish'));
  const mine = sales.filter((sale) => sale.day === today);
  assert.ok(mine.length >= 2, 'the fish morning holds a book to count');
  const due = { ...mine[0], emailScheduled: { at: '07:02', sendAt: '10:30' } };
  const went = { ...mine[1], emailScheduled: { at: '07:02', sendAt: '07:30', sent: '07:30' } };
  const state = exportState([due, went, ...mine.slice(2)], today, world);
  assert.deepEqual(state.scheduled.map((sale) => sale.id), [due.id]);
  assert.deepEqual(state.emailed.map((sale) => sale.id), [went.id]);
});

/* THE SEED INVENTS NO SEND. `scheduleEmail` and `markEmailSent` are the only roads to a mail stamp,
   so a workspace that connects a live mailbox finds its own morning unchanged rather than suddenly
   holding sends its mailbox never made. */
for (const [scope, cast] of Object.entries(CASTS)) test(`${scope}: the seeded morning schedules no mail of its own`, () => {
  const sales = buildSales(cast, dayForSector(scope), { includeArchived: true });
  assert.ok(sales.length > 0);
  assert.deepEqual(sales.filter((sale) => sale.emailScheduled).map((sale) => sale.id), []);
});
