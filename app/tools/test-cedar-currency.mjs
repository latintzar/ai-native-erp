#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'rolldown/experimental';
import { parse } from '@babel/parser';

const app = new URL('../src/prototypes/cedar/', import.meta.url);
const source = name => readFileSync(new URL(name, app), 'utf8');
const compile = async (label, ts, names, args = []) => {
  const { code, errors } = await transform(label, ts);
  assert.equal(errors?.length ?? 0, 0, String(errors));
  return new Function(...args, `${code.replace(/^export\s+/gm, '')}\nreturn { ${names.join(', ')} };`);
};
const declarations = (text, names) => {
  const ast = parse(text, { sourceType: 'module', plugins: ['typescript'] });
  const found = new Map();
  for (const statement of ast.program.body) {
    const item = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (!item || (item.type !== 'FunctionDeclaration' && item.type !== 'VariableDeclaration')) continue;
    const entries = item.type === 'FunctionDeclaration'
      ? [item.id?.name]
      : item.declarations.map(declaration => declaration.id.type === 'Identifier' ? declaration.id.name : undefined);
    for (const name of entries) if (name && names.includes(name)) found.set(name, text.slice(item.start, item.end));
  }
  for (const name of names) assert.ok(found.has(name), `missing source declaration ${name}`);
  return names.map(name => found.get(name)).join('\n');
};

const currencyNames = ['LEGACY_EUR_TO_PEN', 'seedSoles'];
const currencyFactory = await compile(
  'cedar-currency-values.ts',
  declarations(source('currency.ts'), currencyNames),
  currencyNames,
);
const { LEGACY_EUR_TO_PEN, seedSoles } = currencyFactory();

const migrationText = source('currency-migration.ts').replace(/^import .*\n/, '');
const migrationNames = [
  'CEDAR_CONFIG_PEN_VERSION', 'CEDAR_DAY_PEN_VERSION', 'CEDAR_TIERS_PEN_VERSION',
  'CEDAR_GRANTS_PEN_VERSION', 'CEDAR_CATALOGUE_PEN_VERSION', 'CEDAR_PRINT_JOURNAL_PEN_VERSION',
  'CEDAR_COMPANY_PEN_VERSION', 'recordOf', 'migrateConfigCurrency', 'migrateEvent',
  'migrateDayCurrency', 'migrateTiersCurrency', 'migrateGrantsCurrency',
  'migrateCatalogueCurrency', 'migratePrintJournalCurrency', 'migrateCompanyCurrency',
];
const migrationFactory = await compile('cedar-currency-migration.ts', migrationText, migrationNames, ['seedSoles']);
const migration = migrationFactory(seedSoles);

const oldConfig = { version: 3, cast: 'fish', gate: { mode: 'threshold', threshold: 300 }, pricing: { level: 2 } };
const migratedConfig = migration.migrateConfigCurrency(oldConfig);
assert.deepEqual(migratedConfig, { ...oldConfig, gate: { ...oldConfig.gate, threshold: 1170 } });
assert.equal(oldConfig.gate.threshold, 300, 'migration leaves its source object intact');
assert.strictEqual(migration.migrateConfigCurrency({ ...migratedConfig, version: 4 }).gate.threshold, 1170);

const oldDay = {
  version: 1,
  sectors: {
    fish: {
      sector: 'fish', surfaced: [], confirmed: [], answered: {}, always: [], released: [], notice: {},
      events: [
        { kind: 'line', sale: 'one', at: '07:00', line: 'l1', given: 8, price: 15.8, unitFactor: 2 },
        { kind: 'add', sale: 'one', at: '07:01', line: 'l2', qty: 3, unit: 'kg', price: 13.5 },
        { kind: 'print', sale: 'one', at: '07:02', prices: { l1: 15.8, l2: 13.5 } },
        { kind: 'source-arrive', sale: 'live', at: '07:03', sourceEvent: 'wamid.1', amount: 15.8 },
      ],
    },
  },
};
const migratedDay = migration.migrateDayCurrency(oldDay);
assert.equal(migratedDay.version, 2);
assert.deepEqual(migratedDay.sectors.fish.events.slice(0, 3).map(event => event.price ?? event.prices), [
  61.62, 52.65, { l1: 61.62, l2: 52.65 },
]);
assert.equal(migratedDay.sectors.fish.events[0].given, 8);
assert.equal(migratedDay.sectors.fish.events[0].unitFactor, 2);
assert.equal(migratedDay.sectors.fish.events[1].qty, 3);
assert.deepEqual(migratedDay.sectors.fish.events[3], oldDay.sectors.fish.events[3], 'provider evidence stays untouched');
assert.equal(oldDay.sectors.fish.events[0].price, 15.8, 'day migration leaves its source ledger intact');
assert.strictEqual(migration.migrateDayCurrency(migratedDay), migratedDay, 'a versioned day cannot convert twice');

const tiers = migration.migrateTiersCurrency({
  version: 1,
  log: [{ id: 'price-1', product: 'hake', tier: 'A', day: 'today', price: 15.8, at: '07:00', author: 'hand' }],
  anchored: { hake: { anchor: 'A', offsets: { A: 0, B: 6 } } },
});
assert.equal(tiers.version, 2);
assert.equal(tiers.log[0].price, 61.62);
assert.deepEqual(tiers.anchored.hake.offsets, { A: 0, B: 6 });
assert.strictEqual(migration.migrateTiersCurrency(tiers), tiers);

const grants = migration.migrateGrantsCurrency({ version: 1, ceiling: 3000, upTo: 3, dispatchWait: 30 });
assert.deepEqual(grants, { version: 2, ceiling: 11700, upTo: 3, dispatchWait: 30 });
assert.strictEqual(migration.migrateGrantsCurrency(grants), grants);

const catalogue = migration.migrateCatalogueCurrency({
  grounded: {}, adopted: [], graduated: [], varied: [], named: {}, events: [],
  minted: [{ key: 'fish:x', id: 'x', name: 'X', unit: '', pendingPrice: 12.4, source: 'csv' }],
});
assert.equal(catalogue.version, 1);
assert.equal(catalogue.minted[0].pendingPrice, 48.36);
assert.strictEqual(migration.migrateCatalogueCurrency(catalogue), catalogue);

const print = migration.migratePrintJournalCurrency({
  version: 1,
  jobs: [{ id: 'print-1', saleSnapshot: { sale: 'sale-1', prices: { l1: 15.8 } }, copies: 2 }],
});
assert.equal(print.version, 2);
assert.equal(print.jobs[0].saleSnapshot.prices.l1, 61.62);
assert.equal(print.jobs[0].copies, 2);
assert.strictEqual(migration.migratePrintJournalCurrency(print), print);

const company = migration.migrateCompanyCurrency({
  version: 2,
  band: 'med',
  zones: [{ id: 'near', minimum: 80, carriage: 250, trucks: [1], days: [1, 2, 3] }],
});
assert.equal(company.version, 3);
assert.equal(company.zones[0].minimum, 312);
assert.equal(company.zones[0].carriage, 975);
assert.equal(company.band, 'med', 'subscription selection remains outside commerce currency migration');
assert.strictEqual(migration.migrateCompanyCurrency(company), company);

const quotaStore = (records) => ({
  getItem: key => records[key] ?? null,
  setItem: () => { throw new Error('quota'); },
  removeItem: () => { throw new Error('quota'); },
});
const withWindow = (localStorage, run) => {
  const previous = globalThis.window;
  globalThis.window = { localStorage };
  const warn = console.warn;
  console.warn = () => {};
  try { return run(); } finally { console.warn = warn; globalThis.window = previous; }
};
const compileReader = async (file, name, args) => compile(
  `cedar-${file}-${name}.ts`, declarations(source(file), [name]), [name], args,
);

const configReader = await compileReader('config.ts', 'loadConfig', ['STORAGE_KEY', 'DEFAULTS', 'parseConfig', 'CONFIG_VERSION']);
const parsedConfig = { version: 4, marker: 'config' };
assert.strictEqual(withWindow(quotaStore({ config: JSON.stringify(oldConfig) }), () =>
  configReader('config', {}, () => parsedConfig, 4).loadConfig()), parsedConfig);

const dayReader = await compileReader('day.ts', 'savedDays', [
  'DAY_STORAGE_KEY', 'migrateDayCurrency', 'recordOf', 'DAY_STORAGE_VERSION', 'SECTORS',
  'savedEvent', 'stringsOf', 'stringMapOf',
]);
const migratedDayForRead = { version: 2, sectors: { fish: { ...migratedDay.sectors.fish, events: [] } } };
const dayRead = dayReader('day', () => migratedDayForRead, value => value && typeof value === 'object' && !Array.isArray(value), 2,
  ['fish'], () => true, value => Array.isArray(value), value => value && typeof value === 'object').savedDays;
assert.deepEqual(withWindow(quotaStore({ day: JSON.stringify(oldDay) }), dayRead).fish.events, []);

const tiersReader = await compileReader('tiers.ts', 'read', ['tiersStorageKey', 'migrateTiersCurrency', 'parseTiers', 'TIERS_STORAGE_KEY', 'TIERS_DEFAULTS']);
const parsedTiers = { version: 2, marker: 'tiers' };
assert.strictEqual(withWindow(quotaStore({ 'tiers:fish': JSON.stringify({ version: 1, log: [] }) }), () =>
  tiersReader(scope => `tiers:${scope}`, migration.migrateTiersCurrency, () => parsedTiers, 'tiers', {}).read('fish')), parsedTiers);

const grantsReader = await compileReader('grants.ts', 'read', ['GRANTS_STORAGE_KEY', 'migrateGrantsCurrency', 'parseGrants', 'GRANT_DEFAULTS']);
const parsedGrants = { version: 2, marker: 'grants' };
assert.strictEqual(withWindow(quotaStore({ grants: JSON.stringify({ version: 1, ceiling: 3000 }) }), () =>
  grantsReader('grants', migration.migrateGrantsCurrency, () => parsedGrants, {}).read()), parsedGrants);

const catalogueReader = await compileReader('catalogue.ts', 'read', ['CATALOGUE_STORAGE_KEY', 'migrateCatalogueCurrency', 'parse', 'EMPTY']);
const parsedCatalogue = { version: 1, marker: 'catalogue' };
assert.strictEqual(withWindow(quotaStore({ catalogue: JSON.stringify({ minted: [] }) }), () =>
  catalogueReader('catalogue', migration.migrateCatalogueCurrency, () => parsedCatalogue, {}).read()), parsedCatalogue);

const printReader = await compileReader('print-queue.ts', 'readJournal', ['PRINT_JOURNAL_KEY', 'migratePrintJournalCurrency', 'parsePrintJournal']);
const parsedPrint = { version: 2, jobs: [{ marker: 'print' }] };
assert.deepEqual(withWindow(quotaStore({ print: JSON.stringify({ version: 1, jobs: [] }) }), () =>
  printReader('print', migration.migratePrintJournalCurrency, () => parsedPrint).readJournal()), parsedPrint.jobs);

const companyReader = await compileReader('company.ts', 'read', ['COMPANY_STORAGE_KEY', 'migrateCompanyCurrency', 'parseCompany', 'COMPANY_DEFAULTS']);
const parsedCompany = { version: 3, marker: 'company' };
assert.strictEqual(withWindow(quotaStore({ company: JSON.stringify({ version: 2, zones: [] }) }), () =>
  companyReader('company', migration.migrateCompanyCurrency, () => parsedCompany, {}).read()), parsedCompany);

const castText = source('cedar-cast.ts').replace(/^import .*\n/gm, '');
const castFactory = await compile('cedar-cast.ts', castText, ['cedarCast', 'cedarSourceCast'], [
  'cedarOperator', 'seedSoles', 'cedarDayFromId', 'cedarTodayId', 'relativeTradeDay',
  'relativeTradeText',
]);
const cedarOperator = person => ({ ...person, name: 'Peter' });
const { cedarCast, cedarSourceCast } = castFactory(
  cedarOperator, seedSoles, id => new Date(`${id}T12:00:00Z`), () => '2026-09-10',
  value => value, value => value,
);
const shared = {
  sector: 'fish', label: 'Fish', owner: { id: 'owner', name: 'Legacy owner' },
  team: [{ id: 'owner', name: 'Legacy owner' }, { id: 'other', name: 'Other' }],
  products: [{ id: 'hake', trace: { fecha: '22.08' } }], customers: [], families: [], suppliers: [],
  batches: [{ id: 'b1', product: 'hake', supplier: 's1', qty: 12, cost: 11.4, day: 'today' }],
  order: { customer: 'c1', deliveryDay: 'tomorrow', placedAt: '07:00', words: [], utterances: [], lines: [
    { id: 'l1', product: 'hake', qty: 8, unit: 'kg', price: 15.8 },
  ] },
};
const snapshot = structuredClone(shared);
const adapted = cedarCast(shared);
assert.deepEqual(shared, snapshot, 'the shared scenario remains immutable');
assert.notStrictEqual(adapted, shared);
assert.strictEqual(cedarCast(shared), adapted, 'one source cast resolves to one stable Cedar clone');
assert.strictEqual(cedarCast(adapted), adapted, 'an adapted cast remains adapted');
assert.strictEqual(cedarSourceCast(adapted), shared, 'seed arithmetic can recover the immutable source cast');
assert.equal(adapted.batches[0].cost, 44.46);
assert.equal(adapted.order.lines[0].price, 61.62);
assert.equal(adapted.order.lines[0].qty, shared.order.lines[0].qty);
assert.equal(adapted.owner.name, 'Peter');
assert.equal(adapted.team[0].name, 'Peter');
assert.equal(adapted.team[1].name, 'Other');
assert.notStrictEqual(adapted.products, shared.products, 'dated products are cloned before shifting');

const qtyFactory = await compile('cedar-day-quantity.ts', declarations(source('day.ts'), ['qtyFor']), ['qtyFor'], ['scatter', 'seedSoles', 'LEGACY_EUR_TO_PEN']);
const scatter = value => ((value * 9301 + 49297) % 233280) / 233280;
const { qtyFor } = qtyFactory(scatter, seedSoles, LEGACY_EUR_TO_PEN);
const legacyQtyFor = (price, i, k) => {
  const money = 55 + Math.pow(scatter(i * 53 + k * 7 + 23), 1.4) * 465;
  const raw = money / Math.max(price, 1);
  return raw >= 8 ? Math.round(raw) : Math.max(1, Math.round(raw * 2) / 2);
};
for (const price of [0.4, 0.8, 1, 9.2, 13.5, 15.8, 68, 92]) {
  for (let i = 0; i < 300; i += 1) {
    for (let k = 0; k < 5; k += 1) {
      assert.equal(qtyFor(seedSoles(price), i, k, price), legacyQtyFor(price, i, k), `quantity changed for ${price}/${i}/${k}`);
    }
  }
}

console.log('PASS Cedar casts convert monetary leaves without changing shared scenarios or seed quantities');
console.log('PASS config and day migrations convert exact legacy fields once');
console.log('PASS all seven commerce stores retain migrated data in memory when persistence is temporarily unavailable');
