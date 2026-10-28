/** One reviewed split: text identifies the lot; a slider and exact number assign quantity.
 * Drafts never write stock. Receipts, counts and allocation use the same control grammar. */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Slider } from 'baseui/slider';
import type { Lot } from './incoming';

export type RecordedLot = Pick<Lot, 'id' | 'code' | 'left'>;
export type LotShare = { key: string; lotId: string; code: string; quantity: string; existing: boolean };
export const lotNumber = (value: string): number => Number(value.trim().replace(',', '.'));
export const roundLot = (value: number): number => Math.round(value * 100) / 100;
export const sharesOf = (lots: RecordedLot[]): LotShare[] => lots.filter((lot) => lot.left > 0).map((lot) => ({ key: lot.id, lotId: lot.id, code: lot.code, quantity: String(lot.left), existing: true }));
export const emptyShare = (): LotShare => { const id = `lot-${crypto.randomUUID()}`; return { key: id, lotId: id, code: '', quantity: '0', existing: false }; };
export function splitState(shares: LotShare[], total: number, lots: RecordedLot[], enforceAvailability = false) {
  const assigned = roundLot(shares.reduce((sum, share) => sum + (Number.isFinite(lotNumber(share.quantity)) ? lotNumber(share.quantity) : 0), 0));
  const valid = shares.every((share) => {
    const qty = lotNumber(share.quantity);
    const recorded = lots.find((lot) => lot.id === share.lotId);
    return share.quantity.trim() !== '' && Number.isFinite(qty) && qty >= 0 && Math.abs(qty - roundLot(qty)) < 0.000001 &&
      (qty === 0 || !!share.code.trim()) && (!share.code.trim() || share.existing || !lots.some((lot) => lot.code.toLocaleLowerCase() === share.code.trim().toLocaleLowerCase())) &&
      (!enforceAvailability || qty === 0 || (share.existing && !!recorded && qty <= recorded.left + 0.000001)) &&
      shares.filter((other) => other.lotId === share.lotId).length === 1 &&
      (!share.code.trim() || shares.filter((other) => other.code.trim().toLocaleLowerCase() === share.code.trim().toLocaleLowerCase()).length === 1);
  }) && assigned <= total + 0.000001;
  return { assigned, unassigned: roundLot(total - assigned), valid };
}

export function LotSplitEditor({ total, unit, lots, shares, onChange, context, suggestedLotCode }: {
  total: number; unit: string; lots: RecordedLot[]; shares: LotShare[]; onChange: (next: LotShare[]) => void;
  context: 'receive' | 'count' | 'allocate';
  suggestedLotCode?: string;
}) {
  const [, theme] = useStyletron();
  const state = splitState(shares, total, lots, context === 'allocate');
  const [picking, setPicking] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  const patch = (key: string, change: Partial<LotShare>) => onChange(shares.map((share) => share.key === key ? { ...share, ...change } : share));
  return <section data-testid="lot-split-editor" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
    <div>
      <h4 style={{ ...theme.typography.LabelLarge, margin: 0 }}>{context === 'count' ? 'Allocate this count to lots' : context === 'receive' ? 'Allocate received stock to lots' : 'Allocate stock to lots'}</h4>
      <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, marginBottom: 0 }}>{context === 'allocate' ? 'Choose recorded lots, then enter the quantity taken from each. The product stays on one Delivery Note line.' : 'Enter the lot number you have today, then move the slider or enter an exact quantity. The total stays the same; quantity you leave off a lot stays unassigned.'}</p>
    </div>
    <div data-testid="lot-split-summary" role="status" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.sizing.scale300, padding: theme.sizing.scale400, background: theme.colors.backgroundSecondary, borderRadius: theme.borders.radius300 }}>
      <span style={theme.typography.LabelSmall}>Total {fmt(total)} {unit}</span>
      <span style={theme.typography.ParagraphSmall}>{fmt(state.assigned)} {unit} assigned</span>
      <span style={{ ...theme.typography.LabelSmall, color: state.unassigned < 0 ? theme.colors.negative : theme.colors.contentSecondary }}>{state.unassigned < 0 ? `${fmt(-state.unassigned)} ${unit} over the total` : `${fmt(state.unassigned)} ${unit} unassigned`}</span>
    </div>
    {shares.map((share, index) => {
      const quantity = lotNumber(share.quantity);
      const selected = lots.find((lot) => lot.id === share.lotId);
      const remainingCapacity = Math.max(0, roundLot(total - (state.assigned - (Number.isFinite(quantity) ? quantity : 0))));
      const max = context === 'allocate' && selected ? Math.min(remainingCapacity, Math.max(0, selected.left)) : remainingCapacity;
      const duplicate = !!share.code.trim() && (!share.existing && lots.some((lot) => lot.code.toLocaleLowerCase() === share.code.trim().toLocaleLowerCase()) || shares.some((other) => other.key !== share.key && other.code.trim().toLocaleLowerCase() === share.code.trim().toLocaleLowerCase()));
      const label = share.code.trim() || `lot ${index + 1}`;
      const options = lots.filter((lot) => !shares.some((other) => other.key !== share.key && other.lotId === lot.id)).map((lot) => ({ id: lot.id, left: lot.left, label: `${lot.code} · ${lot.left > 0 ? `${fmt(lot.left)} ${unit} free` : 'Unavailable'}` }));
      return <div key={share.key} data-testid="lot-split-row" data-lot={share.code} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, border: `1px solid ${theme.colors.borderOpaque}`, padding: theme.sizing.scale400, borderRadius: theme.borders.radius300, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.sizing.scale300 }}>
          <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{share.existing ? share.code : `New lot ${index + 1}`}</span>
          <Button kind={KIND.tertiary} size={SIZE.mini} aria-label={`Remove ${label} from split`} onClick={() => onChange(shares.filter((other) => other.key !== share.key))}>Remove</Button>
        </div>
        {picking === share.key ? <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
          <span style={theme.typography.LabelSmall}>Choose a recorded lot</span>
          {options.length > 5 && <Input autoFocus aria-label="Search recorded lots" placeholder="Search lot number" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />}
          <div aria-label="Recorded lots" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, maxHeight: '240px', overflowY: 'auto' }}>
            {options.filter((option) => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((option) => <Button key={option.id} kind={KIND.secondary} size={SIZE.compact} disabled={option.left <= 0} data-testid={`lot-recorded-option-${option.id}`} onClick={() => { const chosen = lots.find((lot) => lot.id === option.id)!; patch(share.key, { lotId: chosen.id, code: chosen.code, existing: true }); setPicking(null); }} overrides={{ BaseButton: { style: { justifyContent: 'flex-start', textAlign: 'left', minHeight: '44px' } } }}>{option.label}</Button>)}
            {!options.some((option) => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <span role="status">That number is still unmatched.</span>}
          </div>
          <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => setPicking(null)}>Cancel selection</Button>
        </div> : <div style={{ display: 'grid', gridTemplateColumns: share.existing ? '1fr' : context === 'allocate' ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 104px', alignItems: 'end', gap: theme.sizing.scale300 }}>
          {!share.existing && context === 'allocate' && <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`lot-choose-recorded-${index + 1}`} onClick={() => { setQuery(''); setPicking(share.key); }}>Choose a recorded lot</Button>}
          {!share.existing && context !== 'allocate' && <label style={theme.typography.LabelSmall}>Lot number on the label
            <Input aria-label={`Lot number ${index + 1}`} value={share.code} onChange={(event) => patch(share.key, { code: event.currentTarget.value })} error={duplicate} placeholder="On the label" />
            {context === 'receive' && suggestedLotCode && share.code.trim() !== suggestedLotCode && (
              <Button
                kind={KIND.tertiary}
                size={SIZE.mini}
                data-testid="lot-use-production-date"
                onClick={() => patch(share.key, { code: suggestedLotCode })}
                overrides={{ BaseButton: { style: { minHeight: '44px', justifyContent: 'flex-start', paddingLeft: 0, paddingRight: 0 } } }}
              >
                Use today's date
              </Button>
            )}
          </label>}
          {(share.existing || context !== 'allocate') && <label style={theme.typography.LabelSmall}>Quantity · {unit}
            <Input aria-label={`Quantity for ${label}`} value={share.quantity} error={!Number.isFinite(quantity) || quantity < 0 || quantity > max + 0.000001} onChange={(event) => patch(share.key, { quantity: event.currentTarget.value })} overrides={{ Input: { props: { inputMode: 'decimal' } } }} />
          </label>}
        </div>}
        {selected && <span data-testid={`lot-availability-${selected.id}`} style={{ ...theme.typography.ParagraphXSmall, color: selected.left > 0 ? theme.colors.contentSecondary : theme.colors.negative }}>{selected.left > 0 ? `${fmt(selected.left)} ${unit} free` : 'Unavailable'}</span>}
        <Slider value={[Math.min(max, Math.max(0, Number.isFinite(quantity) ? quantity : 0))]} min={0} max={Math.max(0.01, max)} step={0.01} disabled={max === 0} onChange={({ value }) => patch(share.key, { quantity: String(roundLot(value[0])) })} valueToLabel={(value) => `${fmt(value)} ${unit}`} overrides={{ Thumb: { props: { 'aria-label': `Allocate to ${label}`, 'aria-valuetext': `${fmt(Number.isFinite(quantity) ? quantity : 0)} ${unit} of ${fmt(total)} ${unit}` } }, Root: { props: { onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); patch(share.key, { quantity: String(event.key === 'Home' ? 0 : max) }); } } }, style: { minHeight: '44px' } } }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.sizing.scale300 }}>
          {lots.length > 0 && (share.existing || context !== 'allocate') ? <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => { setQuery(''); setPicking(share.key); }}>{share.existing ? 'Change lot' : 'Use existing lot'}</Button> : <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{fmt(total ? (Number.isFinite(quantity) ? quantity : 0) / total * 100 : 0)}% of total</span>}
          <Button kind={KIND.tertiary} size={SIZE.mini} disabled={state.unassigned <= 0} onClick={() => patch(share.key, { quantity: String(max) })}>Use remaining</Button>
        </div>
        {duplicate && <p role="alert" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative, margin: 0 }}>This lot number is already recorded. Choose Use existing lot, or enter a different code.</p>}
        {quantity > 0 && !share.code.trim() && <span role="alert" style={theme.typography.ParagraphXSmall}>Enter a lot number, or remove this row to leave the quantity unassigned.</span>}
      </div>;
    })}
    <Button kind={KIND.secondary} size={SIZE.compact} data-testid="lot-split-add" onClick={() => onChange([...shares, emptyShare()])}>{context === 'allocate' ? 'Add another recorded lot' : 'Add another lot'}</Button>
    {!state.valid && <p role="alert" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative, margin: 0 }}>Check the lot numbers and quantities. Use up to two decimal places, stay within the total and keep each share at or under the recorded free quantity.</p>}
    <p style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, margin: 0 }}>{context === 'receive' ? 'Only the quantity received is added to stock.' : context === 'allocate' ? 'This records where this Delivery Note line came from. The receipt stays with the supplier delivery.' : 'Identifying a lot leaves supplier deliveries as they are.'}</p>
  </section>;
}
