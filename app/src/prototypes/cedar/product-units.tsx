/** Product Unit conversions: shared rules first, with deliberate Product overrides. */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
/* §196.1 · «same for units» — the conversion rule chooses its units through the SAME live field
   the product sheet and New product use. One organ, everywhere a unit is picked. */
import { LiveUnitField } from './live-field';
import type { Product } from '../../scenarios/data/cast';
import type { SectorId } from '../../scenarios/meta';
import {
  inferredUnitKind,
  saveTenantUnit,
  saveTenantUnitEquivalence,
  saveUnitEquivalence,
  tenantUnitDefinitions,
  tenantUnitRevision,
  unitDefinitionForLabel,
  productUnitEquivalences,
  unitRevision,
  useUnits,
  type UnitEquivalence,
  type UnitEquivalenceStatus,
} from './units';

export type SKUUnitsProps = {
  sector: SectorId;
  product: Product;
  compact?: boolean;
};

type UnitOption = { id: string; label: string };
type ConversionScope = 'tenant' | 'product';
type ConversionDraft = {
  unit: string;
  quantity: string;
  baseUnit: string;
  status: UnitEquivalenceStatus;
  scope: ConversionScope;
  evidence: string;
};

const normal = (value: string) => value.trim().toLocaleLowerCase();
const blankConversion = (baseUnit = ''): ConversionDraft => ({
  unit: '',
  quantity: '',
  baseUnit,
  status: 'exact',
  scope: 'tenant',
  evidence: '',
});
const decimal = (value: string) => Number(value.replace(',', '.'));
const equivalenceStatus = (row: UnitEquivalence): UnitEquivalenceStatus =>
  row.status ?? (row.approximate ? 'nominal' : 'exact');

function optionsFor(sector: SectorId, product: Product, rows: UnitEquivalence[]): UnitOption[] {
  const labels = [
    ...tenantUnitDefinitions(sector).map((definition) => definition.label),
    product.unit,
    ...rows.flatMap((row) => [row.unit, row.baseUnit]),
  ].map((label) => label.trim()).filter(Boolean);
  const seen = new Set<string>();
  return labels
    .filter((label) => !seen.has(normal(label)) && !!seen.add(normal(label)))
    .map((label) => ({ id: normal(label), label }));
}


/** Mounted from the Product sheet directly beneath Unit. There is one Product Unit; these rules
 * connect packaging or customer units to it. Shared rules are the default, while an exact Product
 * rule for the same unit pair overrides the shared value without mutating it. */
export function SKUUnits({ sector, product, compact = false }: SKUUnitsProps) {
  const [, theme] = useStyletron();
  useUnits();
  const rows = productUnitEquivalences(sector, product);
  const currentUnit = product.unit.trim();
  const options = optionsFor(sector, product, rows);
  const [editing, setEditing] = React.useState(false);
  const [expectedProductRevision, setExpectedProductRevision] = React.useState(unitRevision(sector, product.id));
  const [expectedTenantRevision, setExpectedTenantRevision] = React.useState(tenantUnitRevision(sector));
  const [conversion, setConversion] = React.useState<ConversionDraft>(() => blankConversion(currentUnit));
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.sizing.scale300,
    padding: compact ? theme.sizing.scale400 : theme.sizing.scale500,
    border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300,
    minWidth: 0,
  };

  const begin = (row?: UnitEquivalence) => {
    setExpectedProductRevision(unitRevision(sector, product.id));
    setExpectedTenantRevision(tenantUnitRevision(sector));
    setConversion(row ? {
      unit: row.unit,
      quantity: String(row.quantity),
      baseUnit: row.baseUnit,
      status: 'exact',
      scope: row.scope === 'product' ? 'product' : 'tenant',
      evidence: row.evidence ?? '',
    } : blankConversion(currentUnit));
    setError('');
    setNotice('');
    setEditing(true);
  };
  const quantity = decimal(conversion.quantity);
  const validConversion = !!conversion.unit
    && !!conversion.baseUnit
    && normal(conversion.unit) !== normal(conversion.baseUnit)
    && Number.isFinite(quantity)
    && quantity > 0;
  const save = () => {
    const draft = {
      unit: conversion.unit,
      quantity,
      baseUnit: conversion.baseUnit,
      status: 'exact' as const,
      evidence: conversion.evidence,
    };
    let currentTenantRevision = expectedTenantRevision;
    for (const label of [conversion.unit, conversion.baseUnit]) {
      if (unitDefinitionForLabel(sector, label)) continue;
      const added = saveTenantUnit(sector, {
        label,
        kind: inferredUnitKind(label),
        precision: normal(label) === 'kg' ? 3 : 0,
      }, currentTenantRevision);
      if (!added.ok) {
        setError(added.error);
        return;
      }
      currentTenantRevision = added.revision;
    }
    setExpectedTenantRevision(currentTenantRevision);
    const result = conversion.scope === 'tenant'
      ? saveTenantUnitEquivalence(sector, draft, currentTenantRevision)
      : saveUnitEquivalence(sector, product, draft, expectedProductRevision);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (conversion.scope === 'tenant') setExpectedTenantRevision(result.revision);
    else setExpectedProductRevision(result.revision);
    setError('');
    setNotice(conversion.scope === 'tenant'
      ? 'Global conversion saved.'
      : `${product.name} exception saved.`);
    setConversion(blankConversion(currentUnit));
    setEditing(false);
  };
  const close = () => {
    setEditing(false);
    setError('');
    setNotice('');
  };

  return <section
    data-testid={`sku-units-${product.id}`}
    aria-labelledby={`sku-units-title-${product.id}`}
    style={baseStyle}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
      <div>
        <div id={`sku-units-title-${product.id}`} style={theme.typography.LabelMedium}>Conversions</div>
        <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, marginTop: theme.sizing.scale100 }}>
          Shared by default. Add an exception only when this product differs.
        </div>
      </div>
      {!editing && <Button
        kind={KIND.tertiary}
        size={SIZE.mini}
        data-testid={`add-unit-equivalence-${product.id}`}
        onClick={() => begin()}
        overrides={{ BaseButton: { style: { minHeight: '45px' } } }}
      >Add conversion</Button>}
    </div>

    {!currentUnit && <p
      data-testid={`sku-unit-review-${product.id}`}
      style={{ ...theme.typography.ParagraphXSmall, margin: 0 }}
    >Add a Unit in Product details before using conversions.</p>}

    {!!rows.length && <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
      {rows.map((row) => <div
        key={row.id ?? `${row.unit}:${row.baseUnit}`}
        data-testid={`unit-equivalence-${product.id}-${row.unit}`}
        data-unit-conversion-scope={row.source === 'legacy-pack' ? 'legacy' : row.scope === 'tenant' ? 'global' : 'product'}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale300 }}
      >
        <span style={{ ...theme.typography.ParagraphSmall, minWidth: 0, overflowWrap: 'anywhere' }}>
          1 {row.unit} = {equivalenceStatus(row) === 'exact' ? '' : '~'}{row.quantity.toLocaleString('es-ES')} {row.baseUnit}
          <span style={{ color: theme.colors.contentSecondary }}>
            {' · '}{row.source === 'legacy-pack' ? 'Imported conversion evidence' : row.scope === 'tenant' ? 'Global conversion' : 'This product'}
          </span>
        </span>
        {!editing && row.source !== 'legacy-pack' && <Button
          kind={KIND.tertiary}
          size={SIZE.mini}
          onClick={() => begin(row)}
          aria-label={`Edit ${row.unit} conversion for ${product.name}`}
          overrides={{ BaseButton: { style: { minHeight: '45px' } } }}
        >Edit</Button>}
      </div>)}
    </div>}
    {!rows.length && <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Conversions show here.</div>}
    {notice && <div role="status" aria-live="polite" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{notice}</div>}

    {editing && <div
      data-testid={`sku-unit-editor-${product.id}`}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, paddingTop: theme.sizing.scale200, borderTop: `1px solid ${theme.colors.borderOpaque}`, minWidth: 0 }}
    >
      <div>
        <div style={theme.typography.LabelSmall}>Conversion rule</div>
        <p style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, margin: `${theme.sizing.scale100} 0 0` }}>
          Record how one unit converts to another.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 8rem), 1fr))', gap: theme.sizing.scale200, alignItems: 'end', minWidth: 0 }}>
        <LiveUnitField
          id={`conversion-from-${product.id}`}
          label="1 of"
          size="compact"
          sector={sector}
          product={product}
          value={conversion.unit}
          extra={options.map((option) => option.label)}
          placeholder="Choose a unit or write one"
          inputTestid={`unit-conversion-from-${product.id}`}
          onCommit={({ value }) => { setConversion((current) => ({ ...current, unit: value })); }}
        />
        <label style={{ ...theme.typography.LabelXSmall, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
          Equals
          <Input value={conversion.quantity} onChange={(event) => setConversion((current) => ({ ...current, quantity: event.currentTarget.value }))} inputMode="decimal" aria-label="Equivalent quantity" placeholder="0" size="compact" />
        </label>
        <LiveUnitField
          id={`conversion-to-${product.id}`}
          label="Unit"
          size="compact"
          sector={sector}
          product={product}
          value={conversion.baseUnit}
          extra={options.map((option) => option.label)}
          placeholder="Choose a unit or write one"
          inputTestid={`unit-conversion-to-${product.id}`}
          onCommit={({ value }) => { setConversion((current) => ({ ...current, baseUnit: value })); }}
        />
      </div>
      <div>
        <div style={{ ...theme.typography.LabelXSmall, marginBottom: theme.sizing.scale100 }}>Applies to</div>
        <div role="group" aria-label="Conversion scope" style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
          <Button
            kind={conversion.scope === 'tenant' ? KIND.secondary : KIND.tertiary}
            size={SIZE.mini}
            data-testid="unit-conversion-scope-global"
            aria-pressed={conversion.scope === 'tenant'}
            onClick={() => setConversion((current) => ({ ...current, scope: 'tenant' }))}
            overrides={{ BaseButton: { style: { minHeight: '45px' } } }}
          >Global conversion</Button>
          <Button
            kind={conversion.scope === 'product' ? KIND.secondary : KIND.tertiary}
            size={SIZE.mini}
            data-testid="unit-conversion-scope-product"
            aria-pressed={conversion.scope === 'product'}
            onClick={() => setConversion((current) => ({ ...current, scope: 'product' }))}
            overrides={{ BaseButton: { style: { minHeight: '45px' } } }}
          >This product</Button>
        </div>
      </div>
      <label style={{ ...theme.typography.LabelXSmall, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>
        Note · optional
        <Input value={conversion.evidence} onChange={(event) => setConversion((current) => ({ ...current, evidence: event.currentTarget.value }))} aria-label="Conversion note" placeholder="Supplier sheet or measured count" size="compact" />
      </label>
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        <Button
          kind={KIND.secondary}
          size={SIZE.compact}
          disabled={!validConversion}
          onClick={save}
          data-testid={`save-unit-equivalence-${product.id}`}
          overrides={{ BaseButton: { style: { minHeight: '45px' } } }}
        >Save conversion</Button>
        <Button kind={KIND.tertiary} size={SIZE.compact} onClick={close} overrides={{ BaseButton: { style: { minHeight: '45px' } } }}>Done</Button>
      </div>
      {error && <div role="alert" data-testid={`sku-units-error-${product.id}`} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{error}</div>}
    </div>}
  </section>;
}
