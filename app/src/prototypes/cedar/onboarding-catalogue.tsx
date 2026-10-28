import * as React from 'react';
import type { Cast, Product } from '../../scenarios/data/cast';
import { useCatalogue } from './catalogue';
import { rememberCatalogueImport, type CatalogueImportSheet } from './catalogue-export';
import { seedImportedUnit } from './units';
import { capabilityAvailable } from './release-profile';
import { useWorkspaceCapabilities } from './workspace-capabilities';
import { setPrices, tiersOfHouse, writtenOn } from './tiers';
import { todayId } from './sale';
const CatalogueIntake = React.lazy(() => import('./areas/stock').then(module => ({ default: module.CatalogueIntake })));

function sampleCatalogue(cast: Cast): CatalogueImportSheet {
  const rows = cast.products.map((product, index) => ({ id: product.id, code: product.code || product.id,
    name: product.name, unit: product.unit, sourceUnit: product.unit,
    cells: [product.code || product.id, product.name, product.unit], sourceRow: index + 2 }));
  return { columns: ['SKU', 'Product', 'Unit'], mapped: { sku: 0, name: 1, unit: 2, price: -1, category: -1, family: -1 },
    rows, sourceRows: rows, lines: rows.length, file: `${cast.sector}-sample-catalogue.csv`, delimiter: ',' };
}

export function OnboardingCatalogue({ cast, onDone }: { cast: Cast; onDone: (kind: 'sample' | 'imported') => void }) {
  const catalogue = useCatalogue();
  const { pricing } = useWorkspaceCapabilities();
  const seed = React.useMemo(() => sampleCatalogue(cast), [cast]);
  return <React.Suspense fallback={<p>Loading product review…</p>}>
    <CatalogueIntake key={cast.sector} testid="onboarding-catalogue-intake" initialSheet={seed} onPut={async sheet => {
      if (!await rememberCatalogueImport(cast.sector, sheet)) throw new Error('Keep this review open and try saving the catalogue again.');
      const pricingAvailable = capabilityAvailable('pricing') && pricing;
      const existing = new Set(cast.products.map(product => product.id));
      const items = sheet.rows.filter(row => !existing.has(row.id)).map(row => ({ id: row.id, code: row.code,
        name: row.name, unit: row.unit, ...(pricingAvailable && row.price !== undefined ? { price: row.price } : {}) }));
      catalogue.mint(cast.sector, items, 'csv');
      const tier = tiersOfHouse(cast)[0]?.id;
      for (const row of items) {
        const product: Product = { id: row.id, code: row.code, name: row.name, unit: row.unit,
          family: 'unclassified', variableWeight: row.unit === 'kg', trace: {} };
        const unit = seedImportedUnit(cast.sector, product);
        if (!unit.ok) throw new Error(unit.error);
        if (pricingAvailable && tier && row.price !== undefined && row.unit.trim()
          && writtenOn(product, tier, todayId(cast)) === null) {
          const saved = setPrices([{ product: row.id, tier, day: todayId(cast), price: row.price, at: cast.hour, author: 'hand' }]);
          if (saved.length !== 1) throw new Error('Keep this review open and save the product price again.');
        }
      }
      onDone(sheet.file === seed.file && sheet.rows.every(row => existing.has(row.id)) ? 'sample' : 'imported');
    }} />
  </React.Suspense>;
}
