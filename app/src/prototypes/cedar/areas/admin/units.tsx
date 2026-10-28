/** Tenant unit vocabulary and per-SKU unit policy. */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { OFF_LIST, type Product } from '../../../../scenarios/data/cast';
import type { SectorId } from '../../../../scenarios/meta';
import { grownProducts, useCatalogue } from '../../catalogue';
import { useConfig } from '../../config';
import { Section } from '../../rows';
import { openProduct } from '../../anchors';
import { SKUUnits } from '../../product-units';
/* E200.07 · the unit registry asks in the product sheet's own live field (§196.1 «same for units»). */
import { LiveField } from '../../live-field';
import {
  UNIT_KINDS,
  inferredUnitKind,
  saveTenantUnit,
  tenantUnitDefinitions,
  tenantUnitRevision,
  useUnits,
  type UnitKind,
} from '../../units';
import type { AreaMeta } from '../../shell/area';

export const meta: AreaMeta = { id: 'units', title: 'Units', owner: 'V2-ADMIN', panes: false };

/** ONE FLOOR FOR THE WHOLE ROW (E200.07 · INTX-12). The unit registry asks four things on one
 *  line, and the Kind is the live field — which carries the app's 44 px floor everywhere it
 *  stands. Three compact siblings at 36 px in a bottom-aligned grid put four inputs on four
 *  different lines and four tab stops out of reading order, so the row takes one height. */
const FLOOR = { Input: { style: { minHeight: '44px' } } } as const;

const kindLabel: Record<UnitKind, string> = {
  mass: 'Mass',
  volume: 'Volume',
  count: 'Count',
  package: 'Package',
  custom: 'Custom',
};

function TenantUnitRegistry({ sector }: { sector: SectorId }) {
  const [, theme] = useStyletron();
  useUnits();
  const definitions = tenantUnitDefinitions(sector);
  const [label, setLabel] = React.useState('');
  const [plural, setPlural] = React.useState('');
  const [kind, setKind] = React.useState<UnitKind>('custom');
  const [precision, setPrecision] = React.useState('0');
  const [expectedRevision, setExpectedRevision] = React.useState(tenantUnitRevision(sector));
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const numericPrecision = Number(precision);
  const valid = !!label.trim() && Number.isInteger(numericPrecision) && numericPrecision >= 0 && numericPrecision <= 6;
  const save = () => {
    if (!valid) return;
    const result = saveTenantUnit(sector, { label, plural, kind, precision: numericPrecision }, expectedRevision);
    if (!result.ok) { setError(result.error); return; }
    setExpectedRevision(result.revision);
    setLabel('');
    setPlural('');
    setKind('custom');
    setPrecision('0');
    setError('');
    setNotice('Unit added.');
  };
  return <div data-testid="tenant-unit-registry" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
    <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, margin: 0 }}>
      Add a unit your business uses.
    </p>
    {!!definitions.length && <div data-testid="tenant-unit-list" style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
      {definitions.map((definition) => <span key={definition.id} style={{ ...theme.typography.ParagraphSmall, padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`, borderRadius: theme.borders.radius200, backgroundColor: theme.colors.backgroundSecondary }}>
        {definition.label}{definition.plural ? ` / ${definition.plural}` : ''} · {kindLabel[definition.kind]} · {definition.precision} decimals
      </span>)}
    </div>}
    {!definitions.length && <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 }}>Custom units show here once you add one.</p>}
    {/* ONE LINE, ONE BASELINE (E200.07 · better-layout «align to shared edges»). The row was
        bottom-aligned, so the Kind cell — the live field, which grows a line under itself the
        moment it says «Saved» or names a word it declined — pushed its own input ABOVE the three
        beside it and broke the line four labels are read on. Aligned to the top, every label
        shares a line, every input shares a line, and what the field says lands underneath. */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: theme.sizing.scale300, alignItems: 'start' }}>
      <label style={{ ...theme.typography.LabelXSmall, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
        Unit name
        <Input value={label} onChange={(event) => { const value = event.currentTarget.value; setLabel(value); if (!label.trim()) setKind(inferredUnitKind(value)); }} aria-label="Unit name" placeholder="pot" size="compact" overrides={FLOOR} />
      </label>
      <label style={{ ...theme.typography.LabelXSmall, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
        Plural · optional
        <Input value={plural} onChange={(event) => setPlural(event.currentTarget.value)} aria-label="Unit plural" placeholder="pots" size="compact" overrides={FLOOR} />
      </label>
      {/* ── E200.07 · THE KIND IS A LIVE FIELD (§196.1 «same for units») ─────────────────────
          The registry that MAKES the house's units asks in the same organ the product sheet reads
          them back in: the five kinds open on a touch and narrow as the person types. The register
          is closed — a kind decides how the number behaves — so a typed word is declined. */}
      <LiveField
        id="tenant-unit-kind"
        declineSays="Choose a kind from the list."
        label="Kind"
        value={kindLabel[kind]}
        suggestions={UNIT_KINDS.map((value) => ({ value: kindLabel[value], id: value }))}
        placeholder="Choose how it measures"
        allowNew={false}
        size="compact"
        inputTestid="tenant-unit-kind"
        listLabel="Kinds a unit can measure"
        onCommit={({ value, id }) => {
          const chosen = (id as UnitKind | undefined) ?? UNIT_KINDS.find((entry) => kindLabel[entry] === value);
          if (!chosen) return 'Choose a kind from the list.';
          setKind(chosen);
        }}
      />
      <label style={{ ...theme.typography.LabelXSmall, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
        Decimals
        <Input value={precision} onChange={(event) => setPrecision(event.currentTarget.value.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label="Decimal places" size="compact" overrides={FLOOR} />
      </label>
    </div>
    <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
      <Button size={SIZE.compact} disabled={!valid} onClick={save} data-testid="save-tenant-unit">Add unit</Button>
    </div>
    {error && <div role="alert" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{error}</div>}
    {notice && <div role="status" aria-live="polite" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{notice}</div>}
  </div>;
}

function ProductUnits({ sector, product }: { sector: SectorId; product: Product }) {
  const [, theme] = useStyletron();
  return <div data-testid={`unit-product-${product.id}`} style={{ padding: `${theme.sizing.scale600} 0`, borderBottom: `1px solid ${theme.colors.borderOpaque}`, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale500 }}>
      <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => openProduct(product.id)} aria-label={`Open ${product.name}`}>{product.name}</Button>
      <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>Unit {product.unit || 'pending'}</span>
    </div>
    <SKUUnits sector={sector} product={product} compact />
  </div>;
}

export default function Units() {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const [search, setSearch] = React.useState('');
  const catalogue = useCatalogue();
  const cast = derived.cast;
  const products = [...cast.products, ...grownProducts(cast, OFF_LIST[cast.sector] || [], catalogue.state)]
    .filter((product) => product.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <div data-testid="seat-units" style={{ maxWidth: 800, width: '100%', minWidth: 0 }}>
    <Section title="Custom units" testid="tenant-units">
      <TenantUnitRegistry sector={cast.sector} />
    </Section>
    <Section title="Product units" testid="product-units">
      <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, marginTop: 0 }}>
        Set conversions for each product.
      </p>
      <Input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Find a product" aria-label="Find a product" clearOnEscape />
      {products.map((product) => <ProductUnits key={`${cast.sector}:${product.id}`} sector={cast.sector} product={product} />)}
      {!products.length && <p style={theme.typography.ParagraphMedium}>Try another product name.</p>}
    </Section>
  </div>;
}
