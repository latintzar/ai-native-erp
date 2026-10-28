import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { APP_ROOT, loadTypeScript } from './ts-module.mjs';

const currency = loadTypeScript('src/prototypes/cedar/currency.ts', 'price-editor-currency-test');
const stockTiers = readFileSync(join(APP_ROOT, 'src/prototypes/cedar/stock-tiers.tsx'), 'utf8');
const productCard = readFileSync(join(APP_ROOT, 'src/prototypes/cedar/product-card.tsx'), 'utf8');

test('Spain price editors display EUR and commit canonical PEN exactly once', () => {
  assert.equal(currency.syntheticAmountForCountry(39, 'spain'), 10);
  assert.equal(currency.canonicalSyntheticAmount(10, 'spain'), 39);
  assert.equal(currency.syntheticAmountForCountry(currency.canonicalSyntheticAmount(12.34, 'spain'), 'spain'), 12.34);

  assert.match(stockTiers, /onCommit\(canonicalPriceEditorAmount\(next, country\)\)/);
  assert.match(stockTiers, /price: canonicalTyped/);
  assert.match(productCard, /price: canonicalPriceEditorAmount\(typed, country\)/);
  assert.match(productCard, /priceEditorUnit\(unit, country\)/);
});

test('Peru price editors preserve canonical values and soles units', () => {
  assert.equal(currency.syntheticAmountForCountry(39, 'peru'), 39);
  assert.equal(currency.canonicalSyntheticAmount(39, 'peru'), 39);
});
