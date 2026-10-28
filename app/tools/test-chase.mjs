/* The chase model: the ladder, its three texts, the timer's arithmetic and its defensive parse.
 *
 * `chase.ts` is what every unpaid-order card and the auto-chase runner read, so the rungs, the
 * words and the instants are pinned here rather than in a browser drive. The drive then proves
 * the same rules on the rendered surface (drives/drive-cedar-money.py, the chase block). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const chase = loadTypeScript('src/prototypes/cedar/chase.ts', 'chase-test');
const {
  CHASE_STEPS, CHASE_HOURS, CHASE_EVERY_DEFAULT, CHASE_KEY_PREFIX, CHASE_FEE_BASIS_POINTS, CHASE_FEE_DAYS,
  chaseKey, emptyChaseBook, emptyChaseRecord, parseChase, chaseRecordOf, putChase,
  chaseStepOf, chaseStepWords, chaseFeeMinor, chaseFeeDate, chaseMessageOf,
  recordSend, setAuto, dueChases, countdownWords, chasedWords, chaseStatusWords,
} = chase;

const NOW = '2026-09-14T14:00:00.000Z';
const send = (at, step, text = 'x') => ({ at, step, channel: 'whatsapp', text });

test('the ladder has three rungs and the step is capped at the last one', () => {
  assert.equal(CHASE_STEPS, 3);
  let record = emptyChaseRecord('invoice-1');
  assert.equal(chaseStepOf(record), 1);
  record = recordSend(record, send(NOW, 1), 24);
  assert.equal(chaseStepOf(record), 2);
  record = recordSend(record, send(NOW, 2), 24);
  assert.equal(chaseStepOf(record), 3);
  record = recordSend(record, send(NOW, 3), 24);
  assert.equal(chaseStepOf(record), 3);
  assert.equal(record.sends.length, 3);
  assert.equal(record.flaggedAt, NOW, 'the third reminder flags the card for a person');
});

test('the step words name the rung and its register', () => {
  assert.equal(chaseStepWords(1), 'Reminder 1 of 3 · softer');
  assert.equal(chaseStepWords(2), 'Reminder 2 of 3 · firmer');
  assert.equal(chaseStepWords(3), 'Reminder 3 of 3 · firmer');
});

test('the three texts are the escalation §249 names', () => {
  const base = { customerName: 'Marisquería Zurbano', documentNumber: 'PAY-00000003', amountText: 'S/ 1,240.00',
    dueText: '17 Sep', link: 'https://cedar.invalid/#/money/request/request-fish-1',
    feeText: 'S/ 24.80', feeDateText: '21 Sep' };
  assert.equal(chaseMessageOf({ ...base, step: 1 }),
    'Hi Marisquería Zurbano, your order PAY-00000003 for S/ 1,240.00 is due 17 Sep. Pay here: https://cedar.invalid/#/money/request/request-fish-1. Thank you.');
  const firmer = 'Hi Marisquería Zurbano, order PAY-00000003 for S/ 1,240.00 was due 17 Sep. A late fee of S/ 24.80 applies from 21 Sep. Pay here: https://cedar.invalid/#/money/request/request-fish-1.';
  assert.equal(chaseMessageOf({ ...base, step: 2 }), firmer);
  assert.equal(chaseMessageOf({ ...base, step: 3 }), firmer, 'step 3 repeats the firmer words; the card carries the escalation');
  // A reminder with no request yet states the order and the amount, and skips the pay sentence.
  assert.equal(chaseMessageOf({ ...base, step: 1, link: '' }),
    'Hi Marisquería Zurbano, your order PAY-00000003 for S/ 1,240.00 is due 17 Sep. Thank you.');
});

test('the late fee is two per cent of the balance, from seven days out', () => {
  assert.equal(CHASE_FEE_BASIS_POINTS, 200);
  assert.equal(CHASE_FEE_DAYS, 7);
  assert.equal(chaseFeeMinor(124000), 2480);
  assert.equal(chaseFeeMinor(12345), 247, 'half-up on the minor unit');
  assert.equal(chaseFeeMinor(0), 0);
  assert.equal(chaseFeeMinor(-1), 0);
  assert.equal(chaseFeeMinor(Number.NaN), 0);
  assert.equal(chaseFeeDate(NOW), '2026-09-21');
  assert.equal(chaseFeeDate('not a date'), '');
});

test('a send moves the timer on by its own interval, and the last rung stops it', () => {
  let record = setAuto(emptyChaseRecord('invoice-1'), true, 12, NOW);
  assert.equal(record.auto.nextAt, '2026-09-15T02:00:00.000Z');
  record = recordSend(record, send('2026-09-15T02:00:00.000Z', 1), 12);
  assert.equal(record.auto.nextAt, '2026-09-15T14:00:00.000Z');
  record = recordSend(record, send('2026-09-15T14:00:00.000Z', 2), 48);
  assert.equal(record.auto.nextAt, '2026-09-17T14:00:00.000Z', 'the interval a send carries is the one it schedules from');
  assert.equal(record.auto.everyHours, 48);
  record = recordSend(record, send('2026-09-17T14:00:00.000Z', 3), 48);
  assert.equal(record.auto.nextAt, null, 'the ladder ends at three: the next act is a call');
  assert.equal(record.auto.on, true);
});

test('a send with the timer off schedules nothing', () => {
  const record = recordSend(emptyChaseRecord('invoice-1'), send(NOW, 1), 24);
  assert.equal(record.auto.nextAt, null);
  assert.equal(record.auto.on, false);
  assert.equal(record.flaggedAt, null);
});

test('setAuto starts the countdown now and clears it when it is turned off', () => {
  assert.deepEqual(CHASE_HOURS, [12, 24, 48]);
  assert.equal(CHASE_EVERY_DEFAULT, 24);
  const on = setAuto(emptyChaseRecord('invoice-1'), true, 24, NOW);
  assert.equal(on.auto.on, true);
  assert.equal(on.auto.nextAt, '2026-09-15T14:00:00.000Z');
  const off = setAuto(on, false, 24, NOW);
  assert.equal(off.auto.on, false);
  assert.equal(off.auto.nextAt, null);
  // A finished ladder schedules nothing, whichever way the switch is set.
  const finished = [1, 2, 3].reduce((held, step) => recordSend(held, send(NOW, step), 24), emptyChaseRecord('invoice-1'));
  assert.equal(setAuto(finished, true, 12, NOW).auto.nextAt, null);
});

test('dueChases answers on the timer, the balance and the rung that is left', () => {
  const ready = setAuto(emptyChaseRecord('a'), true, 12, '2026-09-14T00:00:00.000Z');
  const ahead = setAuto(emptyChaseRecord('b'), true, 48, '2026-09-14T13:00:00.000Z');
  const manual = recordSend(emptyChaseRecord('c'), send('2026-09-13T00:00:00.000Z', 1), 24);
  const paid = setAuto(emptyChaseRecord('d'), true, 12, '2026-09-14T00:00:00.000Z');
  const finished = [1, 2, 3].reduce((held, step) => recordSend(held, send('2026-09-13T00:00:00.000Z', step), 12),
    setAuto(emptyChaseRecord('e'), true, 12, '2026-09-12T00:00:00.000Z'));
  const records = { a: ready, b: ahead, c: manual, d: paid, e: finished };
  const balances = { a: 124000, b: 50000, c: 50000, d: 0, e: 50000 };
  assert.deepEqual(dueChases(records, NOW, balances).map(row => row.invoiceId), ['a']);
  assert.deepEqual(dueChases(records, '2026-09-14T11:00:00.000Z', balances).map(row => row.invoiceId), []);
  assert.deepEqual(dueChases(records, 'not a date', balances), []);
  // Two due at once come back in a stable order, so a catch-up walks them the same way twice.
  const second = setAuto(emptyChaseRecord('aa'), true, 12, '2026-09-14T00:00:00.000Z');
  assert.deepEqual(dueChases({ ...records, aa: second }, NOW, { ...balances, aa: 1 }).map(row => row.invoiceId), ['a', 'aa']);
});

test('the countdown reads in hours above the hour and minutes below it', () => {
  assert.equal(countdownWords('2026-09-15T13:00:00.000Z', NOW), 'next in 23 h');
  assert.equal(countdownWords('2026-09-14T14:40:00.000Z', NOW), 'next in 40 min');
  assert.equal(countdownWords('2026-09-14T15:00:00.000Z', NOW), 'next in 1 h');
  assert.equal(countdownWords('2026-09-14T14:00:00.000Z', NOW), 'due now');
  assert.equal(countdownWords('2026-09-14T13:00:00.000Z', NOW), 'due now');
  assert.equal(countdownWords(null, NOW), '');
  assert.equal(countdownWords('not a date', NOW), '');
});

test('the chased words carry the hour, and the day once it has passed', () => {
  const at = new Date('2026-09-13T14:41:00.000Z');
  const hour = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const day = at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  assert.equal(chasedWords(at.toISOString(), '2026-09-13T20:00:00.000Z'), `Chased ${hour}`);
  assert.equal(chasedWords(at.toISOString(), '2026-09-15T09:00:00.000Z'), `Chased ${day} ${hour}`);
  assert.equal(chasedWords(null, NOW), '');
});

test('the card line joins what was said last to what happens next', () => {
  let record = setAuto(emptyChaseRecord('invoice-1'), true, 24, NOW);
  assert.equal(chaseStatusWords(record, NOW), 'next in 24 h');
  record = recordSend(record, send(NOW, 1), 24);
  const hour = new Date(NOW).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  assert.equal(chaseStatusWords(record, '2026-09-14T15:00:00.000Z'), `Chased ${hour} · next in 23 h`);
  assert.equal(chaseStatusWords(setAuto(record, false, 24, NOW), NOW), `Chased ${hour}`);
});

test('a receipt links to the latest chase at or before its exact timestamp', () => {
  const receiptAt = '2026-09-15T14:00:00.000Z';
  const earlier = send('2026-09-15T08:30:00-05:00', 1, 'Earlier reminder');
  const latest = send('2026-09-15T08:59:59.999-05:00', 2, 'Latest reminder');
  const later = send('2026-09-15T14:00:00.001Z', 3, 'Later reminder');
  const record = { ...emptyChaseRecord('invoice-1'), sends: [later, latest, earlier] };
  assert.equal(chase.lastChaseBeforeReceipt(record, receiptAt), latest, 'timestamp order wins over array order and UTC-offset spelling');
  const simultaneous = send(receiptAt, 2, 'Same instant');
  assert.equal(chase.lastChaseBeforeReceipt({ ...record, sends: [...record.sends, simultaneous] }, receiptAt), simultaneous);
  assert.equal(chase.lastChaseBeforeReceipt({ ...record, sends: [later] }, receiptAt), null, 'a later reminder cannot explain an earlier receipt');
  assert.equal(chase.lastChaseBeforeReceipt(emptyChaseRecord('invoice-1'), receiptAt), null);
  assert.equal(chase.lastChaseBeforeReceipt(record, 'invalid'), null);
  assert.equal(chase.lastChaseBeforeReceipt({ ...record, sends: [send('invalid', 1)] }, receiptAt), null);
  assert.deepEqual(record.sends, [later, latest, earlier], 'the chase history keeps its original order');
});

test('the book is stored under its own scoped key and rebuilt defensively', () => {
  assert.equal(CHASE_KEY_PREFIX, 'rocoto-cedar-chase-v1:');
  assert.equal(chaseKey('fish'), 'rocoto-cedar-chase-v1:fish');
  const record = recordSend(setAuto(emptyChaseRecord('invoice-1'), true, 12, NOW), send(NOW, 1), 12);
  const book = putChase(emptyChaseBook('fish'), record);
  assert.deepEqual(parseChase(JSON.parse(JSON.stringify(book)), 'fish'), book, 'a stored book round-trips');
  assert.deepEqual(parseChase(book, 'meat'), emptyChaseBook('meat'), 'another workspace reads its own book');
  for (const bad of [null, 'text', 42, {}, { version: 2, scope: 'fish', records: {} }, { version: 1, scope: 'fish' }]) {
    assert.deepEqual(parseChase(bad, 'fish'), emptyChaseBook('fish'));
  }
  const damaged = [
    { ...record, sends: [{ ...send(NOW, 4) }] },
    { ...record, sends: [{ ...send('yesterday', 1) }] },
    { ...record, sends: [{ at: NOW, step: 1, channel: 'pigeon', text: 'x' }] },
    { ...record, auto: { on: true, everyHours: 36, nextAt: null } },
    { ...record, auto: { on: 'yes', everyHours: 12, nextAt: null } },
    { ...record, auto: { on: true, everyHours: 12, nextAt: 'soon' } },
    { ...record, flaggedAt: 'soon' },
    { ...record, invoiceId: 'invoice-2' },
  ];
  for (const row of damaged) {
    const read = parseChase({ version: 1, scope: 'fish', records: { 'invoice-1': row } }, 'fish');
    assert.deepEqual(read.records, {}, 'a damaged record reads as absent');
    assert.deepEqual(chaseRecordOf(read, 'invoice-1'), emptyChaseRecord('invoice-1'), 'and the card offers the ladder from step 1');
  }
  // A damaged record leaves the healthy ones standing.
  const mixed = parseChase({ version: 1, scope: 'fish', records: { 'invoice-1': record, 'invoice-2': { nonsense: true } } }, 'fish');
  assert.deepEqual(Object.keys(mixed.records), ['invoice-1']);
});


test('the aged seed opens with three retained chase rungs and respects an existing book', () => {
  assert.equal(typeof chase.seedChaseBook, 'function');
  const invoices = [5,15,30].map((days,index) => ({ id:`aged-${index}`, number:`F001-0000000${index+1}`, customerName:`Customer ${index+1}`, customerId:`c${index}`,
    status:'accepted', origin:'demo', currency:'PEN', amountMinor:10000, dueAt:new Date(Date.parse(NOW)-days*86400000).toISOString().slice(0,10) }));
  const state = { scope:'fish', invoices, receipts:[], requests:[], events:[] };
  const book = chase.seedChaseBook(state, NOW);
  assert.deepEqual(Object.values(book.records).map(row=>row.sends.length), [1,2,3]);
  assert.equal(Object.values(book.records)[2].flaggedAt !== null,true);
  assert.ok(Object.values(book.records).slice(0,2).every(row=>Date.parse(row.auto.nextAt)>Date.parse(NOW)));
  assert.deepEqual(chase.seedChaseBook(state,NOW), book);
});

test('fixture chase identity survives reload and an authored rung retains the book',()=>{
  const state={scope:'fish',fixtureDay:'2026-09-15',invoices:[{id:'aged',customerId:'c',customerName:'Buyer',number:'F001-1',currency:'PEN',status:'accepted',origin:'demo',amountMinor:10000,dueAt:'2026-09-01'}],receipts:[]};
  const seeded=chase.seedChaseBook(state,'2026-09-15T12:00:00Z',[{customer:{id:'c',channel:'email'}}]);
  assert.equal(Object.values(seeded.records)[0].sends[0].channel,'email');
  assert.equal(chase.hasAuthoredChase(chase.parseChase(JSON.parse(JSON.stringify(seeded)),'fish')),false);
  const changed=chase.putChase(seeded,chase.setAuto(Object.values(seeded.records)[0],false,24,'2026-09-15T13:00:00Z'));
  assert.equal(chase.hasAuthoredChase(changed),true);
});

test('seed reminder timestamps follow the order first contact at24-hour intervals',()=>{
  const sentAt='2026-09-01T12:00:00.000Z';
  const state={scope:'fish',invoices:[{id:'aged',customerId:'c',customerName:'Buyer',number:'F001-1',currency:'PEN',status:'accepted',origin:'demo',amountMinor:10000,dueAt:'2026-09-01'}],receipts:[],requests:[{invoiceId:'aged',sentAt}]};
  const book=chase.seedChaseBook(state,NOW);
  assert.equal(Object.values(book.records)[0].sends[0].at,'2026-09-02T12:00:00.000Z');
});
