#!/usr/bin/env node
/* THE CONFIG STORE READS FORWARD, AND IT DROPS WHAT THE BUILD NO LONGER HOLDS.
 *
 * `parseConfig` is a WHITELIST: it names every field this build knows and builds a fresh object
 * out of them, so a key a past build wrote and this one retired is read by nobody and survives
 * nowhere. `loadConfig` writes the parsed object back whenever the stored version is older, which
 * is how the retired key leaves the browser as well as the session.
 *
 * The field under test is `mailbox` — «Gmail connection; Microsoft 365 connection», two booleans a
 * Money setup step wrote before the live mailbox capability (`email-provider.ts`) answered that
 * question from the provider. This file is the proof that a store carrying it still opens.
 *
 * Run: node tools/test-cedar-config.mjs
 */
import strict from 'node:assert/strict';
import { loadTypeScript } from './ts-module.mjs';

/* The count this file prints is the count it ran (`test-print-measures.mjs`'s rule). */
let checks = 0;
const counted = (name) => (...args) => { checks += 1; return strict[name](...args); };
const assert = {
  equal: counted('equal'),
  deepEqual: counted('deepEqual'),
  ok: counted('ok'),
};

const { CONFIG_VERSION, DEFAULTS, parseConfig } =
  loadTypeScript('src/prototypes/cedar/config.ts', 'cedar-config-store');

/* ── THE RETIRED FIELD ─────────────────────────────────────────────────────────────────────── */

/** A store written by the build that held the two mailbox switches, with nine answers beside them. */
const v1WithMailbox = {
  version: 1,
  sector: ['fish'],
  cast: 'fish',
  capture: { default: 'calls' },
  gate: { mode: 'threshold', threshold: 300 },
  pricing: { level: 3 },
  weighing: { default: 'most' },
  goodsIn: { door: 'email' },
  stock: { mode: 'declared' },
  delivery: { mode: 'agency' },
  lots: { mode: 'reference' },
  erp: { target: 'holded' },
  emailFeed: { connected: true, address: 'pedidos@peixvilalta.example' },
  mailbox: { gmail: true, m365: true },
  brand: { name: 'Peix Vilalta', line: 'Mercabarna' },
};

const parsed = parseConfig(v1WithMailbox);

assert.ok(parsed, 'a v1 store carrying the retired field still parses');
assert.equal('mailbox' in parsed, false, 'and the parsed config holds no mailbox field');
assert.equal('mailbox' in DEFAULTS, false, 'the starting answers hold no mailbox field either');
assert.equal(
  JSON.stringify(parsed).includes('mailbox'), false,
  'so nothing the parser writes back to the browser carries it',
);

/* ── AND THE NINE ANSWERED QUESTIONS SURVIVE THE READ ──────────────────────────────────────── */

assert.equal(parsed.version, CONFIG_VERSION, 'the parsed config wears this build’s own version');
assert.deepEqual(parsed.sector, ['fish']);
assert.equal(parsed.capture.default, 'calls');
assert.equal(parsed.gate.mode, 'threshold');
assert.equal(parsed.pricing.level, 3);
assert.equal(parsed.weighing.default, 'most');
assert.equal(parsed.goodsIn.door, 'email');
assert.equal(parsed.stock.mode, 'declared');
assert.equal(parsed.delivery.mode, 'agency');
assert.equal(parsed.lots.mode, 'reference');
assert.equal(parsed.erp.target, 'holded');
assert.equal(parsed.emailFeed.connected, true, 'the supplier inbox is a different field and it stays');
assert.equal(parsed.emailFeed.address, 'pedidos@peixvilalta.example');
assert.equal(parsed.brand.name, 'Peix Vilalta', 'a house that typed its own name keeps it');

/* A store that never held the field opens the same way, so the read has one shape. */
const without = parseConfig({ ...v1WithMailbox, mailbox: undefined });
assert.equal('mailbox' in without, false);
assert.equal(without.capture.default, 'calls');

/* A config from a FUTURE build is the one case that resets, and the reset holds no mailbox. */
const future = parseConfig({ ...v1WithMailbox, version: CONFIG_VERSION + 1 });
assert.equal('mailbox' in future, false);
assert.equal(future.capture.default, DEFAULTS.capture.default, 'a future shape takes the defaults whole');

console.log(`cedar config store: ${checks} checks passed`);
