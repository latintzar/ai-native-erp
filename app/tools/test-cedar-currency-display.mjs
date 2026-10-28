import assert from 'node:assert/strict';
import { loadTypeScript } from './ts-module.mjs';

const { parsePasted } = loadTypeScript('src/prototypes/cedar/tiers.ts', 'cedar-pen-price-paste');
const { soles, solesRate } = loadTypeScript('src/prototypes/cedar/currency.ts', 'cedar-pen-format');
const source = 'Merluza\tS/ 61.62/kg\nGamba roja\tPEN 154.05\nRape\t34.71 soles/kg\nMERLUZA-3';
assert.deepEqual(parsePasted(source).map(({ said, price }) => ({ said, price })), [
  { said: 'Merluza', price: 61.62 },
  { said: 'Gamba roja', price: 154.05 },
  { said: 'Rape', price: 34.71 },
], 'PEN symbols, currency codes and soles units leave product identity and price intact');
assert.equal(soles(1234.5), 'S/ 1,234.50');
assert.equal(solesRate(61.62, 'kg'), 'S/ 61.62/kg');
const storage = new Map([['rocoto-workspace-capabilities:fish', JSON.stringify({
  version: 1, pricing: true, inventory: false, money: false, country: 'spain',
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
const { sheetOf } = loadTypeScript('src/prototypes/cedar/export-files.ts', 'cedar-pen-export');
const { manualDocument } = loadTypeScript('src/prototypes/cedar/manual-exports.ts', 'cedar-pen-workbook');
const product = { id: 'fish-1', name: 'Merluza', unit: 'kg' };
const customer = { id: 'customer-1', name: 'Manolo', channel: 'whatsapp', tier: 'a' };
const cast = { sector: 'fish', products: [product], batches: [{ id: 'lot-1', product: product.id, supplier: 'supplier-1', qty: 2, cost: 39, day: '2025-08-22' }], customers: [customer], suppliers: [] };
const tiers = [{ id: 'a', name: 'Standard' }];
const sales = [{ id: 'sale-1', number: 'A-1', deliveryDay: '2025-08-22', day: '2025-08-22', at: '09:00', customer, state: 'accepted', lines: [{ product, ordered: 2, given: 2, unit: 'kg', price: 39 }] }];
const prices = sheetOf('prices', { cast, tiers, today: '2025-08-22', priceOn: () => 61.62 });
assert.equal(prices.rows[0][prices.head.indexOf('currency')], 'EUR');
assert.equal(prices.rows[0][prices.head.indexOf('price')], '15.80');
const incoming = sheetOf('incoming', { cast, tiers, today: '2025-08-22', priceOn: () => 61.62 });
assert.equal(incoming.rows[0][incoming.head.indexOf('cost')], '10.00');
assert.equal(incoming.rows[0][incoming.head.indexOf('currency')], 'EUR');
const orders = sheetOf('orders', { cast, sales, tiers, today: '2025-08-22', priceOn: () => 61.62 });
assert.deepEqual(
  ['price', 'line total', 'currency'].map((column) => orders.rows[0][orders.head.indexOf(column)]),
  ['10.00', '20.00', 'EUR'],
);
const manual = manualDocument('tariff-prices', { cast, tiers, day: '2025-08-22', priceOn: () => 61.62 });
assert.equal(manual.sheets[0].rows[0][manual.sheets[0].head.indexOf('Moneda')], 'EUR');
assert.equal(manual.sheets[0].rows[0][manual.sheets[0].head.indexOf('Precio registrado')], 15.8);
const manualSales = manualDocument('sales-customers', { cast, sales, ledger: [], day: '2025-08-22', stockAsOf: '2025-08-22T09:00:00Z' });
assert.deepEqual(
  ['Unit price', 'Line total', 'Currency'].map((column) => manualSales.sheets[0].rows[0][manualSales.sheets[0].head.indexOf(column)]),
  [10, 20, 'EUR'],
);
console.log('16 Cedar currency display, price-import and export checks passed');
