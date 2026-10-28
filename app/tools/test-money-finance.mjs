import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript, loadTypeScript } from './ts-module.mjs';

const F = loadTypeScript('src/prototypes/cedar/money-finance.ts', 'test-money-finance');
const at = '2026-01-31T12:00:00.000Z';
const request = (over = {}) => ({ scope: 'fish', principalMinor: 100000, count: 3, createdAt: at,
  purpose: 'stock', consentAt: at, limitMinor: 2000000, ...over });

for (const count of [1, 3, 6]) {
  test(`${count} repayments preserve every cent and the original month-end day`, () => {
    const plan = F.createAdvance(request({ count }));
    assert.equal(plan.installments.reduce((sum, item) => sum + item.amountMinor, 0), 100000 + ({1: 0, 3: 500, 6: 900}[count]));
    assert.equal(plan.installments.length, count);
    assert.equal(plan.installments[0].dueAt, '2026-02-28');
    if (count > 1) assert.equal(plan.installments[1].dueAt, '2026-03-31');
    assert.deepEqual(F.parseAdvance(plan, 'fish'), plan);
  });

  test(`${count} repayment plan restores only its own scope and valid saved progress`, () => {
    const plan = F.createAdvance(request({ count }));
    assert.equal(F.parseAdvance(plan, 'meat'), null);
    assert.equal(F.parseAdvance({ ...plan, paidCount: count + 1 }, 'fish'), null);
    assert.equal(F.parseAdvance({ ...plan, paidCount: 0.5 }, 'fish'), null);
    assert.equal(F.parseAdvance({ ...plan, paidCount: -1 }, 'fish'), null);
    assert.equal(F.parseAdvance({ ...plan, currency: 'EUR' }, 'fish'), null);
    assert.equal(F.parseAdvance({ ...plan, source: 'live' }, 'fish'), null);
    assert.equal(F.parseAdvance({ ...plan, installments: [{ ...plan.installments[0], amountMinor: 1 }, ...plan.installments.slice(1)] }, 'fish'), null);
    assert.equal(F.parseAdvance({ ...plan, installments: [{ ...plan.installments[0], dueAt: '2026-03-01' }, ...plan.installments.slice(1)] }, 'fish'), null);
  });

  test(`${count} recorded repayments reach zero and stop at completion`, () => {
    const plan = F.createAdvance(request({ count }));
    let current = plan;
    for (let index = 0; index < count; index += 1) {
      current = F.recordAdvanceRepayment(current);
      assert.equal(F.advanceOutstanding(current), plan.installments.slice(index + 1).reduce((sum, item) => sum + item.amountMinor, 0));
      assert.deepEqual(F.parseAdvance(current, 'fish'), current);
    }
    assert.equal(F.advanceOutstanding(current), 0);
    assert.equal(F.advancePrincipalOutstanding(current), 0);
    assert.equal(F.recordAdvanceRepayment(current), current);
    assert.equal(plan.paidCount, 0);
  });
}

test('Uneven repayments distribute the extra cents across the first installments', () => {
  assert.deepEqual(F.createAdvance(request({ count: 3 })).installments.map(item => item.amountMinor), [33500, 33500, 33500]);
  assert.deepEqual(F.createAdvance(request({ count: 6 })).installments.map(item => item.amountMinor), [16817, 16817, 16817, 16817, 16816, 16816]);
});

test('Leap years and December keep monthly due dates on the calendar', () => {
  assert.equal(F.createAdvance(request({ count: 1, createdAt: '2028-01-31T12:00:00.000Z' })).installments[0].dueAt, '2028-02-29');
  assert.equal(F.createAdvance(request({ count: 1, createdAt: '2026-12-31T12:00:00.000Z' })).installments[0].dueAt, '2027-01-31');
});

test('Malformed or unsupported saved plans start with an empty financing preview', () => {
  for (const raw of [null, [], 'plan', {}, { version: 1, scope: 'fish', createdAt: 'bad' }]) assert.equal(F.parseAdvance(raw, 'fish'), null);
  assert.throws(() => F.createAdvance(request({ count: 2 })));
  assert.throws(() => F.createAdvance(request({ scope: '' })));
  assert.throws(() => F.createAdvance(request({ createdAt: 'invalid' })));
});

test('Total interest is explicit and saved pricing cannot drift', () => {
  for (const [count, basisPoints, interest] of [[1, 0, 0], [3, 50, 500], [6, 90, 900]]) {
    const plan = F.createAdvance(request({ count }));
    assert.equal(plan.interestBasisPoints, basisPoints);
    assert.equal(plan.interestMinor, interest);
    assert.equal(plan.totalRepaymentMinor, 100000 + interest);
    assert.equal(F.parseAdvance({ ...plan, interestMinor: interest + 1 }, 'fish'), null);
  }
});

/* ── VERSION 3: THE AMOUNT, THE PURPOSE AND THE CONSENT (FEED-IA §249) ────────────────────── */

test('A version 3 plan records the amount asked for, its purpose, the consent and the limit', () => {
  const plan = F.createAdvance(request({ principalMinor: 500000, count: 3, purpose: 'prebuy' }));
  assert.equal(plan.version, 3);
  assert.equal(plan.source, 'plan');
  assert.equal(plan.principalMinor, 500000);
  assert.equal(plan.purpose, 'prebuy');
  assert.equal(plan.consentAt, new Date(at).toISOString());
  assert.equal(plan.limitMinor, 2000000);
  assert.equal(plan.interestMinor, 2500);
  assert.equal(plan.totalRepaymentMinor, 502500);
  assert.deepEqual(plan.installments.map(item => item.amountMinor), [167500, 167500, 167500]);
  assert.deepEqual(F.parseAdvance(plan, 'fish'), plan);
});

test('A version 3 plan is refused outside its own grain, floor, ceiling and limit', () => {
  assert.throws(() => F.createAdvance(request({ principalMinor: 40000 })), /amount/);
  assert.throws(() => F.createAdvance(request({ principalMinor: 105000 })), /amount/);
  assert.throws(() => F.createAdvance(request({ principalMinor: 600000, limitMinor: 500000 })), /amount/);
  assert.throws(() => F.createAdvance(request({ purpose: 'holiday' })), /for/);
  assert.throws(() => F.createAdvance(request({ consentAt: '' })), /Authorize/);
  const plan = F.createAdvance(request({ principalMinor: 500000 }));
  assert.equal(F.parseAdvance({ ...plan, principalMinor: 505000 }, 'fish'), null);
  assert.equal(F.parseAdvance({ ...plan, purpose: 'holiday' }, 'fish'), null);
  assert.equal(F.parseAdvance({ ...plan, consentAt: undefined }, 'fish'), null);
  assert.equal(F.parseAdvance({ ...plan, version: 2 }, 'fish'), null);
});

test('The principal is what a limit measures, and each repayment returns its share', () => {
  const plan = F.createAdvance(request({ principalMinor: 500000, count: 3 }));
  assert.equal(F.advancePrincipalOutstanding(plan), 500000);
  assert.equal(F.advanceOutstanding(plan), 502500);
  const once = F.recordAdvanceRepayment(plan);
  assert.equal(F.advancePrincipalOutstanding(once), 333333);
  assert.equal(F.advancePrincipalOutstanding(F.recordAdvanceRepayment(once)), 166667);
});

/* ── VERSIONS 1 AND 2, THE PLANS ALREADY ACCEPTED ─────────────────────────────────────────── */

test('An existing accepted interest-free plan keeps its original terms', () => {
  const legacy = { version: 1, scope: 'fish', source: 'preview', currency: 'PEN', principalMinor: 100000,
    createdAt: at, count: 3, paidCount: 1, installments: [
      { dueAt: '2026-02-28', amountMinor: 33334 }, { dueAt: '2026-03-31', amountMinor: 33333 },
      { dueAt: '2026-04-30', amountMinor: 33333 }] };
  const restored = F.parseAdvance(legacy, 'fish');
  assert.equal(restored.version, 1);
  assert.equal(restored.interestMinor, 0);
  assert.equal(restored.totalRepaymentMinor, 100000);
  assert.equal(restored.paidCount, 1);
  assert.equal(restored.purpose, undefined);
  assert.equal(restored.consentAt, undefined);
  assert.equal(restored.limitMinor, undefined);
  assert.deepEqual(restored.installments, legacy.installments);
  assert.deepEqual(F.parseAdvance(restored, 'fish'), restored);
});

test('A version 2 plan keeps its S/ 1,000 principal, its pricing and the retired source word', () => {
  const priced = { version: 2, scope: 'fish', source: 'future', currency: 'PEN', principalMinor: 100000,
    createdAt: at, count: 6, paidCount: 2, interestBasisPoints: 90, interestMinor: 900, totalRepaymentMinor: 100900,
    installments: [16817, 16817, 16817, 16817, 16816, 16816].map((amountMinor, index) => ({
      dueAt: ['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31'][index], amountMinor })) };
  const restored = F.parseAdvance(priced, 'fish');
  assert.equal(restored.version, 2);
  assert.equal(restored.source, 'plan');
  assert.equal(restored.principalMinor, 100000);
  assert.equal(restored.paidCount, 2);
  assert.equal(restored.limitMinor, undefined);
  assert.equal(F.parseAdvance({ ...priced, principalMinor: 500000 }, 'fish'), null, 'version 2 held one principal and holds it still');
});

/* ── THE OFFER: WHAT THE BOOK MAKES AVAILABLE ─────────────────────────────────────────────── */

const order = (day, figure) => ({ day, figure, customer: { id: 'c' }, lines: [{ id: 'l1' }] });
const limitOf = (sales, plans = [], day = '2026-09-14') => F.advanceLimitOf({ day, sales, plans });

test('The limit is half of four weeks of sales, in S/ 500 steps', () => {
  const limit = limitOf([order('2026-09-14', 12345.67)]);
  assert.equal(limit.bookMinor, 1234567);
  assert.equal(limit.limitMinor, 600000, 'S/ 6,172.83 rounds down to S/ 6,000');
  assert.equal(limit.availableMinor, 600000);
  assert.equal(limit.from, '2026-08-18');
  assert.equal(limit.to, '2026-09-14');
});

test('The floor and the ceiling hold the limit at S/ 1,000 and S/ 20,000', () => {
  assert.equal(limitOf([]).limitMinor, F.ADVANCE_FLOOR_MINOR);
  assert.equal(limitOf([order('2026-09-14', 100)]).limitMinor, F.ADVANCE_FLOOR_MINOR);
  assert.equal(limitOf([order('2026-09-14', 100000)]).limitMinor, F.ADVANCE_CEILING_MINOR);
  assert.equal(F.ADVANCE_FLOOR_MINOR, 100000);
  assert.equal(F.ADVANCE_CEILING_MINOR, 2000000);
});

test('Four weeks means the reference day and the twenty-seven before it', () => {
  assert.equal(limitOf([order('2026-08-18', 12345.67)]).bookMinor, 1234567, 'the first day of the window counts');
  assert.equal(limitOf([order('2026-08-17', 12345.67)]).bookMinor, 0, 'the day before it stands outside');
  assert.equal(limitOf([order('2026-09-15', 12345.67)]).bookMinor, 0, 'a delivery still ahead stands outside');
});

test('A message, an archived draft and an empty order are outside the book', () => {
  const sales = [
    { ...order('2026-09-14', 1000), messageOnly: true },
    { ...order('2026-09-14', 1000), archived: '2026-09-13' },
    { ...order('2026-09-14', 1000), lines: [] },
    { ...order('2026-09-14', 1000), customer: {} },
    order('2026-09-14', 1000),
  ];
  assert.equal(limitOf(sales).bookMinor, 100000);
});

test('The principal standing leaves the rest of the limit available', () => {
  const sales = [order('2026-09-14', 100000)];
  const plan = F.createAdvance(request({ principalMinor: 500000, count: 3 }));
  const granted = limitOf(sales, [plan]);
  assert.equal(granted.limitMinor, 2000000);
  assert.equal(granted.drawnMinor, 500000);
  assert.equal(granted.availableMinor, 1500000, 'S/ 20,000 less the S/ 5,000 granted');
  const once = limitOf(sales, [F.recordAdvanceRepayment(plan)]);
  assert.equal(once.drawnMinor, 333333);
  assert.equal(once.availableMinor, 1660000, 'what is available stands on the S/ 100 grain');
});

test('A plan repaid on time raises the limit by a tenth', () => {
  const sales = [order('2026-09-14', 100000)];
  let plan = F.createAdvance(request({ principalMinor: 500000, count: 3 }));
  for (let index = 0; index < 3; index += 1) plan = F.recordAdvanceRepayment(plan);
  const repaid = limitOf(sales, [plan]);
  assert.equal(repaid.repaidCount, 1);
  assert.equal(repaid.drawnMinor, 0);
  assert.equal(repaid.limitMinor, 2200000, 'S/ 20,000 rises to S/ 22,000');
  assert.equal(repaid.availableMinor, 2200000);
  assert.equal(limitOf(sales, [plan, plan]).limitMinor, 2400000, 'two plans repaid on time, two tenths');
});

test('An amount a route or a campaign carries lands on the grain and inside the limit', () => {
  assert.equal(F.clampAdvanceAmount(500000, 2000000), 500000);
  assert.equal(F.clampAdvanceAmount(512345, 2000000), 510000);
  assert.equal(F.clampAdvanceAmount(10, 2000000), F.ADVANCE_MINIMUM_MINOR);
  assert.equal(F.clampAdvanceAmount(9999999, 600000), 600000);
  assert.equal(F.clampAdvanceAmount(Number.NaN, 2000000), F.ADVANCE_FLOOR_MINOR);
  assert.equal(F.ADVANCE_STEP_MINOR, 10000);
  assert.equal(F.ADVANCE_MINIMUM_MINOR, 50000);
});

/* ── THE SEEDED FISH BOOK, RECONCILED ─────────────────────────────────────────────────────── */

const require = createRequire(import.meta.url);
const seed = loadTypeScript('src/prototypes/cedar/money-seed.ts', 'money-finance-seed-test');
const model = loadTypeScript('src/prototypes/cedar/money-model.ts', 'money-finance-model-test');
const salePath = compileTypeScript('src/prototypes/cedar/sale.ts', 'money-finance-sale-test');
const castPath = compileTypeScript('src/prototypes/cedar/cedar-cast.ts', 'money-finance-cast-test');
const { buildSales } = require(salePath);
const { cedarCast } = require(castPath);
const { dayForSector } = require(join(dirname(salePath), 'day.js'));
const { CASTS } = require(join(dirname(salePath), '../../scenarios/data/cast.js'));

test('The seeded book answers the card, and its own ceiling is what binds', () => {
  for (const [scope, cast] of Object.entries(CASTS)) {
    const sales = buildSales(cedarCast(cast), dayForSector(scope));
    const day = model.peruDate(seed.moneyWorkspace(scope).referenceAt);
    const limit = F.advanceLimitOf({ day, sales, plans: [] });
    // The same window, summed here rather than there: one book, two implementations.
    const from = new Date(Date.parse(`${day}T12:00:00Z`) - 27 * 86400000).toISOString().slice(0, 10);
    const counted = sales.filter(sale => sale.day >= from && sale.day <= day && !sale.messageOnly
      && !sale.archived && sale.customer.id && sale.lines.length);
    assert.equal(limit.from, from);
    assert.equal(limit.to, day);
    assert.equal(limit.bookMinor, counted.reduce((sum, sale) => sum + Math.round(sale.figure * 100), 0));
    assert.ok(counted.length > 0, `${scope}: the seeded book holds orders inside its own four weeks`);
    assert.ok(limit.bookMinor / 2 > F.ADVANCE_CEILING_MINOR,
      `${scope}: half the book stands above the ceiling, so the ceiling is what the card states`);
    assert.equal(limit.limitMinor, F.ADVANCE_CEILING_MINOR);
    assert.equal(limit.availableMinor, F.ADVANCE_CEILING_MINOR, `${scope}: S/ 20,000 available`);
  }
});

test('The demo grant reads back off the seeded fish book', () => {
  const sales = buildSales(cedarCast(CASTS.fish), dayForSector('fish'));
  const workspace = seed.moneyWorkspace('fish');
  const day = model.peruDate(workspace.referenceAt);
  const offered = F.advanceLimitOf({ day, sales, plans: [] });
  const plan = F.createAdvance({ scope: 'fish', principalMinor: 500000, count: 3, createdAt: workspace.referenceAt,
    purpose: 'stock', consentAt: workspace.referenceAt, limitMinor: offered.limitMinor });
  assert.deepEqual(plan.installments.map(item => item.amountMinor), [167500, 167500, 167500], 'S/ 1,675 a month');
  const granted = F.advanceLimitOf({ day, sales, plans: [plan] });
  assert.equal(granted.availableMinor, 1500000, 'S/ 15,000 still available');
  let settled = plan;
  for (let index = 0; index < 3; index += 1) settled = F.recordAdvanceRepayment(settled);
  const raised = F.advanceLimitOf({ day, sales, plans: [settled] });
  assert.equal(raised.limitMinor, 2200000, 'repaid on time, the limit rose to S/ 22,000');
  assert.ok(raised.limitMinor > plan.limitMinor, 'the card compares against the limit that stood at the grant');
});
