import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
/* §196.1 · the unit is chosen the same way everywhere: a live list of the house's own words,
   filtering as the person types, and the typed word accepted as new. */
import { LiveField, LiveUnitField } from './live-field';
import { Textarea } from 'baseui/textarea';
import type { Cast, Product } from '../../scenarios/data/cast';
import { useCatalogue, graduatedProducts, mintedOf } from './catalogue';
import { saveSKU, skuDetails, skuRecord, useSKURecords, type SKUDetails } from './sku-record';
import { ProductCode } from './product-code';
import { ensureSKUArtworkRequest } from './sku-artwork';
import { openProduct } from './anchors';
import { WorkflowDialog } from './workflow-dialog';
import { inferredUnitKind, saveTenantUnit, tenantUnitDefinitions, useUnits } from './units';
import { linkProducts } from './product-relations';
import { placementFor, saveSKUPlacement } from './product-ontology';

type CreationStep = 'choose' | 'identity' | 'review';
type UnitChoice = string;
type ArtworkChoice = 'request' | 'later';

type CreationDraft = {
  creationId: string;
  name: string;
  code: string;
  description: string;
  unitChoice: UnitChoice;
  customUnit: string;
  artwork: ArtworkChoice;
};

const UNIT_OPTIONS: Array<{ id: UnitChoice; label: string }> = [
  { id: 'kg', label: 'kg' }, { id: 'caja', label: 'Caja' }, { id: 'pieza', label: 'Pieza' },
  { id: 'bandeja', label: 'Bandeja' }, { id: 'saco', label: 'Saco' }, { id: 'manojo', label: 'Manojo' }, { id: 'bote', label: 'Bote' },
  { id: 'custom', label: 'Other unit…' },
];
/* §196.1 · the trade's own starter words. They are OFFERED beside whatever the house already
   uses; they are never the whole of what a person may write. */
const STARTER_UNITS = UNIT_OPTIONS.filter((option) => option.id !== 'custom').map((option) => option.label);

const createId = (sector: string) => `sku-${sector}-${typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const draftKey = (sector: string, family?: Product) => `rocoto-product-creation-draft:${sector}:${family?.id ?? 'new'}`;
const blankDraft = (sector: string, family?: Product, initialDescription = ''): CreationDraft => ({
  creationId: createId(sector),
  name: '',
  code: '',
  description: family ? initialDescription : '',
  unitChoice: family?.unit && UNIT_OPTIONS.some((option) => option.id === family.unit) ? family.unit as UnitChoice : family?.unit ? 'custom' : '',
  customUnit: family?.unit && !UNIT_OPTIONS.some((option) => option.id === family.unit) ? family.unit : '',
  artwork: 'request',
});
const readDraft = (sector: string, family?: Product, initialDescription = ''): CreationDraft => {
  const blank = blankDraft(sector, family, initialDescription);
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey(sector, family)) || 'null') as Partial<CreationDraft> | null;
    if (!value || typeof value.creationId !== 'string') return blank;
    return {
      ...blank,
      ...value,
      unitChoice: typeof value.unitChoice === 'string' ? value.unitChoice : blank.unitChoice,
      /* Artwork is not a form choice. Creation prepares the exact-SKU image record and the
         product sheet owns the only visible image action: its Upload/Replace pencil. Older
         session drafts that carried the retired choice are normalised here. */
      artwork: 'request',
    };
  } catch { return blank; }
};
const writeDraft = (sector: string, family: Product | undefined, value: CreationDraft): boolean => {
  try {
    sessionStorage.setItem(draftKey(sector, family), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
const clearDraft = (sector: string, family?: Product) => {
  try { sessionStorage.removeItem(draftKey(sector, family)); } catch { /* no stored draft */ }
};
const sameDetails = (left: SKUDetails, right: SKUDetails) =>
  left.name === right.name && left.code === right.code && left.unit === right.unit && left.description === right.description;

/** Identity first: internal placement is derived on save and remains editable in the Product sheet. */
export function CreateSKU({
  cast,
  family,
  onClose,
  onCreated,
  onUpload,
  initialVariationDescription,
}: {
  cast: Cast;
  family?: Product;
  onClose: () => void;
  onCreated?: (product: Product) => void;
  onUpload?: () => void;
  initialVariationDescription?: string;
}) {
  const [, theme] = useStyletron();
  const unitsRevision = useUnits();
  const catalogue = useCatalogue();
  const records = useSKURecords();
  const restored = React.useMemo(() => readDraft(cast.sector, family, initialVariationDescription), [cast.sector, family, initialVariationDescription]);
  const [step, setStep] = React.useState<CreationStep>(family || !onUpload ? 'identity' : 'choose');
  const [name, setName] = React.useState(restored.name);
  const [code, setCode] = React.useState(restored.code);
  const [description, setDescription] = React.useState(restored.description);
  const [unitChoice, setUnitChoice] = React.useState<UnitChoice>(restored.unitChoice);
  const [customUnit, setCustomUnit] = React.useState(restored.customUnit);
  const artwork: ArtworkChoice = 'request';
  const [error, setError] = React.useState('');
  const [showValidation, setShowValidation] = React.useState(false);
  const createdProductId = React.useRef<string | null>(null);
  const newId = React.useRef(restored.creationId);
  const title = family ? 'Add variation' : 'New product';
  const unitOptions = React.useMemo(() => {
    const standard = UNIT_OPTIONS.filter((option) => option.id !== 'custom');
    const known = new Set(standard.map((option) => option.label.trim().toLocaleLowerCase()));
    const tenant = tenantUnitDefinitions(cast.sector)
      .filter((definition) => definition.label.trim() && !known.has(definition.label.trim().toLocaleLowerCase()))
      .map((definition) => ({ id: `tenant:${definition.id}`, label: definition.label }));
    return [...standard, ...tenant, UNIT_OPTIONS[UNIT_OPTIONS.length - 1]];
  }, [cast.sector, unitsRevision]);
  const selectedUnit = unitOptions.find((item) => item.id === unitChoice);
  const unit = unitChoice === 'custom' ? customUnit.trim() : selectedUnit?.label ?? unitChoice;
  const resolvedName = name.trim();
  const resolvedCode = code.trim();
  const codeKey = resolvedCode.toLocaleLowerCase();
  const analysisProduct = React.useMemo<Product>(() => ({
    id: newId.current,
    name: resolvedName || 'Uncategorised product',
    ...(resolvedCode ? { code: resolvedCode } : {}),
    unit: unit || '',
    family: 'unclassified',
    variableWeight: unit.toLocaleLowerCase() === 'kg',
    trace: {},
  }), [resolvedCode, resolvedName, unit]);
  const proposedPlacement = React.useMemo(() => placementFor(cast.sector, analysisProduct), [cast.sector, analysisProduct]);
  const categoryReady = Boolean(resolvedName && proposedPlacement.category.name && !/^(uncategorised|unclassified)$/i.test(proposedPlacement.category.name));

  const codeMatches = React.useMemo(() => {
    if (!codeKey) return [];
    const known = [...cast.products, ...mintedOf(cast.sector, catalogue.state).map((item) => ({ id: item.id, name: item.name, code: item.code, unit: item.unit })), ...graduatedProducts(cast, catalogue.state)];
    return known.filter((item, index, all) => {
      if (item.id === newId.current || item.id === createdProductId.current) return false;
      if (all.findIndex((other) => other.id === item.id) !== index) return false;
      return (skuRecord(cast.sector, item.id, records)?.details.code ?? item.code ?? '').trim().toLocaleLowerCase() === codeKey;
    });
  }, [cast, catalogue.state, codeKey, records]);
  const identityError = family && !description.trim() ? 'Describe what is different about this product.'
    : !resolvedName ? 'Enter the product name.'
      : !resolvedCode ? 'Enter this product’s code.'
        : !unit ? 'Choose a unit or write one.'
          : codeMatches.length ? 'Give this product its own code.' : '';
  const draft = (): CreationDraft => ({ creationId: newId.current, name, code, description, unitChoice, customUnit, artwork });
  const dirty = Boolean(name || code || description || unitChoice || customUnit || artwork !== 'request');
  const saveAndClose = (): boolean => {
    if (dirty && !writeDraft(cast.sector, family, draft())) {
      setError('Saving stalled. Your draft is still here; keep this window open and try again.');
      return false;
    }
    setError('');
    onClose();
    return true;
  };
  const review = () => {
    if (identityError) { setShowValidation(true); return; }
    setError('');
    setShowValidation(false);
    setStep('review');
  };
  const back = () => setStep(step === 'review' ? 'identity' : 'choose');
  const openExisting = () => {
    const existing = codeMatches[0];
    if (!existing) return;
    if (!saveAndClose()) return;
    openProduct(existing.id);
  };

  const create = () => {
    if (identityError) { setShowValidation(true); return; }
    let identitySaved = false;
    try {
      const product: Product = {
        id: newId.current,
        name: resolvedName,
        code: resolvedCode,
        unit,
        family: 'unclassified',
        variableWeight: unit.toLocaleLowerCase() === 'kg',
        trace: {},
      };
      createdProductId.current = product.id;
      const record = skuRecord(cast.sector, product.id);
      const details = { ...skuDetails(cast.sector, product), name: resolvedName, code: resolvedCode, unit, description: family ? description.trim() : '' };
      if (record && record.creationId !== newId.current) throw new Error('This product already exists. Open it to review the current record.');
      if (!record || !sameDetails(record.details, details)) saveSKU(cast.sector, product, details, record?.revision ?? 0, 'You', { creationId: newId.current });
      identitySaved = true;

      catalogue.mint(cast.sector, [{ id: product.id, name: resolvedName, code: resolvedCode, unit, family: 'unclassified' }], 'hand');
      if (!family && categoryReady) {
        saveSKUPlacement(cast.sector, product.id, {
          categoryId: proposedPlacement.category.id,
          categoryName: proposedPlacement.category.name,
          familyId: proposedPlacement.family.id,
          familyName: proposedPlacement.family.name,
        });
      }
      if (family && !linkProducts(cast.sector, family.id, product.id, { source: 'related-sku-creation', reason: description })) {
        throw new Error('Linking this variation to its related product stalled. Try again.');
      }

      const knownUnit = tenantUnitDefinitions(cast.sector).some((definition) => definition.label.trim().toLocaleLowerCase() === unit.toLocaleLowerCase());
      if (!knownUnit) {
        const saved = saveTenantUnit(cast.sector, { label: unit, kind: inferredUnitKind(unit), precision: unit.toLocaleLowerCase() === 'kg' ? 3 : 0 });
        if (!saved.ok) throw new Error(saved.error);
      }
      ensureSKUArtworkRequest(cast.sector, product.id, family ? `${resolvedName}. ${description.trim()}` : resolvedName);
      clearDraft(cast.sector, family);
      onClose();
      if (onCreated) onCreated(product); else openProduct(product.id);
    } catch (caught) {
      const message = (caught as Error).message || 'Saving the product stalled. Your details are still here.';
      setError(identitySaved ? `${message} The product identity is saved; retry to finish setup.` : message);
    }
  };

  const upload = () => {
    if (!writeDraft(cast.sector, family, draft())) {
      setError('Saving stalled. Your draft is still here; keep this window open and try again.');
      return;
    }
    setError('');
    onUpload?.();
  };
  const stepWord: Record<CreationStep, string | undefined> = { choose: undefined, identity: '1 of 2 · Product', review: '2 of 2 · Review' };
  const nextLabel = step === 'identity' ? 'Continue' : family ? 'Create variation' : 'Create product';
  const actions = step === 'choose' ? undefined : <>
    <Button kind={KIND.tertiary} size={SIZE.compact} onClick={saveAndClose}>Save for later</Button>
    <Button size={SIZE.compact} data-testid={step === 'review' ? (family ? 'variation-add' : 'product-add') : 'product-creation-next'} onClick={step === 'review' ? create : review}>{nextLabel}</Button>
  </>;
  const fieldGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: theme.sizing.scale500, minWidth: 0 } as const;
  const summaryRow = (label: string, content: React.ReactNode) => <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(112px, .35fr) minmax(0, 1fr)', gap: theme.sizing.scale400, padding: `${theme.sizing.scale300} 0`, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}><span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>{label}</span><span style={{ ...theme.typography.ParagraphSmall, overflowWrap: 'anywhere' }}>{content}</span></div>;
  return <WorkflowDialog isOpen title={title} ariaLabel={title} onClose={saveAndClose} onBack={step === 'review' || (step === 'identity' && !family && !!onUpload) ? back : undefined} step={stepWord[step]} actions={actions} testId="sku-create">
    <div data-state={step} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      {/* §131 «Why is there so much space there?» — the same question one scale down (E193.21).
          The frame stopped being 600px whatever is in it; a door that reserves 144px and pushes
          its own sentence to the floor of that box is the identical defect inside the frame. The
          name and the line it explains stand together now, and the door is still a 112px target.
          Its FIELDS are untouched. */}
      {step === 'choose' && <section data-testid="product-create-choice" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: theme.sizing.scale500, minWidth: 0 }}>
        <Button kind={KIND.secondary} size={SIZE.large} data-testid="product-add-one" onClick={() => setStep('identity')} overrides={{ BaseButton: { style: { minHeight: '112px', alignItems: 'flex-start', justifyContent: 'flex-start', gap: theme.sizing.scale300, flexDirection: 'column', textAlign: 'left', padding: theme.sizing.scale600 } } }}>
          <span style={theme.typography.HeadingXSmall}>Add one product</span>
          <span style={{ ...theme.typography.ParagraphSmall, fontWeight: 400 }}>Enter its name, code and unit.</span>
        </Button>
        <Button kind={KIND.secondary} size={SIZE.large} data-testid="product-upload" onClick={upload} overrides={{ BaseButton: { style: { minHeight: '112px', alignItems: 'flex-start', justifyContent: 'flex-start', gap: theme.sizing.scale300, flexDirection: 'column', textAlign: 'left', padding: theme.sizing.scale600 } } }}>
          <span style={theme.typography.HeadingXSmall}>Upload a product list</span>
          <span style={{ ...theme.typography.ParagraphSmall, fontWeight: 400 }}>Drop a file, paste rows, or take a photo on your phone.</span>
        </Button>
      </section>}
      {step === 'identity' && <>
        {family && <>
          <div style={{ padding: theme.sizing.scale400, background: theme.colors.backgroundSecondary, borderRadius: theme.borders.radius300 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Related to</span>
            <div style={{ ...theme.typography.LabelMedium, marginTop: theme.sizing.scale100 }}>{family.name}</div>
            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, marginTop: theme.sizing.scale100, fontVariantNumeric: 'tabular-nums' }}><ProductCode code={family.code} /> · {family.unit}</div>
          </div>
          <label style={theme.typography.LabelSmall}>What is different about this product?<Textarea autoFocus value={description} aria-label="Describe the variation" placeholder="Cut, size, fresh or frozen, preparation, packaging…" onChange={(event) => { setDescription(event.currentTarget.value); setError(''); }} overrides={{ Input: { props: { 'data-testid': 'variation-word' } } }} /></label>
        </>}
        {/* §195 · one field grammar across the whole product: the creation frame asks in exactly
            the same shape the sheet answers in. */}
        <LiveField
          id="new-product-name"
          label="Product name"
          value={name}
          suggestions={[]}
          autoFocus={!family}
          placeholder={family ? 'Name this exact sellable product' : 'For example, Gamba roja de Palamós'}
          onType={(value) => { setName(value); setError(''); }}
          onCommit={({ value }) => { setName(value); setError(''); }}
        />
        <div style={fieldGrid}>
          <LiveField
            id="new-product-code"
            label="Code"
            value={code}
            suggestions={[]}
            placeholder="For example, PV-1001"
            onType={(value) => { setCode(value); setError(''); }}
            onCommit={({ value }) => { setCode(value); setError(''); }}
          />
          <LiveUnitField
            id="new-product-unit"
            sector={cast.sector}
            value={unit}
            catalogue={cast.products}
            extra={STARTER_UNITS}
            placeholder="Choose a unit or write one"
            hint="How you sell it: kg, caja, manojo, pieza…"
            inputTestid="product-creation-unit"
            onType={(value) => { setUnitChoice('custom'); setCustomUnit(value); setError(''); }}
            onCommit={({ value }) => { setUnitChoice('custom'); setCustomUnit(value); setError(''); }}
          />
        </div>
      </>}
      {step === 'review' && <section data-testid="product-create-review" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
        <h3 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>Check the product</h3>
        <div data-testid="product-preprocessing-review" style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, padding: `0 ${theme.sizing.scale500}` }}>
          {summaryRow('Product name', resolvedName)}
          {summaryRow('Code', <ProductCode code={resolvedCode} />)}
          {summaryRow('Unit', unit)}
          {family && summaryRow('What differs', description.trim())}
        </div>
      </section>}
      {showValidation && identityError && <span role="alert" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{identityError}</span>}
      {codeMatches.length > 0 && <div role="alert" data-testid="sku-code-duplicate" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>This code is already on {codeMatches.length > 1 ? `${codeMatches.slice(0, -1).map((item) => item.name).join(', ')} and ${codeMatches[codeMatches.length - 1].name}` : codeMatches[0].name}. <Button kind={KIND.tertiary} size={SIZE.compact} onClick={openExisting}>Open existing product</Button></div>}
      {error && <span role="alert" data-testid="sku-create-error">{error}</span>}
    </div>
  </WorkflowDialog>;
}
