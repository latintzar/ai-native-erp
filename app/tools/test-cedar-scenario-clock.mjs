#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './ts-module.mjs';

const clock = loadTypeScript('src/prototypes/cedar/scenario-clock.ts', 'cedar-scenario-clock-test');

test('Peru calendar boundary is exact and independent of the server timezone', () => {
  assert.equal(clock.cedarTodayId(new Date('2026-09-10T04:59:59Z')), '2026-09-09');
  assert.equal(clock.cedarTodayId(new Date('2026-09-10T05:00:00Z')), '2026-09-10');
});

test('live-source relative dates use the immutable provider instant across midnight', () => {
  assert.equal(
    clock.sourceReferenceDay('2026-09-10T04:00:00Z', '2026-09-10'),
    '2026-09-09',
  );
  assert.equal(clock.sourceReferenceDay('invalid', '2026-09-10'), '2026-09-10');
});

test('fixture dates and embedded trade prose preserve their relative offsets', () => {
  const now = new Date('2026-09-10T15:00:00Z');
  assert.equal(clock.relativeFixtureDay('2025-08-22', now), '2026-09-10');
  assert.equal(clock.relativeFixtureDay('2025-08-20', now), '2026-09-08');
  assert.equal(clock.relativeFixtureDay('2025-08-28', now), '2026-09-16');
  assert.equal(
    clock.relativeFixtureInstant('2025-08-21T16:40:00-05:00', now),
    '2026-09-09T16:40:00-05:00',
  );
  assert.equal(clock.relativeTradeDay('21.08', now), '09.09');
  assert.equal(
    clock.relativeTradeText('LOT L-2208. RUBIO. 21.08 · 3.200 kg.', now),
    'LOT L-2208. RUBIO. 09.09 · 3.200 kg.',
  );
  assert.equal(clock.relativeTradeText('provider id L-2208', now), 'provider id L-2208');
});

test('one boot exposes one stable scenario clock', () => {
  assert.equal(clock.cedarClock.timeZone, 'America/Lima');
  assert.equal(clock.cedarTodayId(), clock.cedarTodayId());
  assert.equal(clock.relativeFixtureDay('2025-08-22'), clock.cedarTodayId());
});
