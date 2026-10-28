/** Customer-facing choices read the existing business stores; previews never send a message. */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { Select } from 'baseui/select';
import { useConfig, type AppConfig } from './config';
import { useHistoryLayer } from './anchors';
import { setGrants, useGrants } from './grants';
import { useTiers } from './tiers';
import { grownProducts, useCatalogue } from './catalogue';
import { projectSKU, skuDetails, useSKURecords } from './sku-record';
import { accountOf, useCustomerEdits } from './customer-edits';
import { confirmationPreview, confirmationPriceMode, confirmationRate } from './confirmation-policy';
import { WorkflowDialog } from './workflow-dialog';
export { confirmationPriceMode } from './confirmation-policy';
import { todayId } from './sale';
import { capabilityAvailable } from './release-profile';

export function CustomerOrderSettings({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: () => void }) {
  const [, theme] = useStyletron();
  const { config, derived, set } = useConfig();
  const grants = useGrants(); const prices = useTiers(); const catalogue = useCatalogue(); useSKURecords(); useCustomerEdits();
  const [error, setError] = React.useState('');
  const [customerId, setCustomerId] = React.useState('');
  useHistoryLayer({ id: 'settings:customer-order-policy', active: open, snapshot: { customer: customerId }, onRestore: saved => { if (!saved) onClose(); else { if (typeof saved.customer === 'string') setCustomerId(saved.customer); onOpen(); } } });
  const cast = derived.cast;
  const customers = cast.customers.map(person => accountOf(person));
  const customer = customers.find(person => person.id === customerId) ?? customers[0];
  const customerOptions = customers.map(person => ({ id: person.id, label: person.name }));
  const allProducts = [...new Map([...cast.products, ...grownProducts(cast, [], catalogue.state)].map(product => [product.id, projectSKU(cast.sector, product)])).values()].filter(product => !skuDetails(cast.sector, product).archived);
  const today = todayId(cast);
  const recentIds = [...new Set(prices.log.filter(stamp => stamp.day === today && allProducts.some(product => product.id === stamp.product)).slice().reverse().map(stamp => stamp.product))];
  const previewProducts = recentIds.length ? recentIds.slice(0, 4).map(id => allProducts.find(product => product.id === id)!) : allProducts.slice(0, 4);
  const mode = confirmationPriceMode(config, grants);
  const write = (ok: boolean) => setError(ok ? '' : 'Saving this setting stalled. Your previous choice is still in use. Try again.');
  React.useEffect(() => { if (!open) setError(''); }, [open]);
  const paragraph = { ...theme.typography.ParagraphSmall, margin: 0, color: theme.colors.contentSecondary };
  const card: React.CSSProperties = { border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 };
  /* Pricing and outbound are independent books. Enabling tariff work must never reveal message
     automation that the active release profile still marks unavailable. */
  const orderReviewProfile = !capabilityAvailable('customerOutbound');
  if (orderReviewProfile) {
    return <WorkflowDialog isOpen={open} onClose={onClose} title="Order review" ariaLabel="Order review product requests" step="Product requests" testId="customer-order-settings-dialog" actions={<Button size={SIZE.compact} onClick={onClose}>Done</Button>}>
      <div data-testid="customer-order-settings" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <section style={card}>
          <span style={theme.typography.LabelMedium}>Product requests</span>
          <Checkbox checked={config.productRequests.suggestNewSkus} onChange={event => write(set({ productRequests: { ...config.productRequests, suggestNewSkus: (event.target as HTMLInputElement).checked } }))} overrides={{ Input: { props: { 'data-testid': 'policy-suggest-skus' } } }}>Suggest an exact product for recurring requests</Checkbox>
          <p style={paragraph}>{config.productRequests.suggestNewSkus ? 'Reviewing a request leaves the product for you to create.' : 'Requests stay as order notes until you choose to review one.'}</p>
        </section>
        {error && <p data-testid="order-policy-save-error" role="alert" style={{ ...paragraph, color: theme.colors.negative }}>{error}</p>}
      </div>
    </WorkflowDialog>;
  }
  const example = customer ? confirmationPreview({ customer, deliveryDay: 'the agreed delivery day', lines: previewProducts.map(product => ({ product, ordered: 1, unit: product.unit })) }, cast, config, grants, todayId(cast)) : '';
  const policyEffect = mode === 'off' ? 'Confirmations are off. Orders stay with your team.' : mode === 'with-prices' ? 'Confirmations may include current customer or tariff prices. Missing prices remain “price to confirm”.' : config.albaran.values === 'unvalued' ? 'Prices are hidden on delivery notes, so confirmation prices are hidden too.' : 'Confirmations carry quantities only.';
  const erpOptions = [{ id: 'base-item-note', label: 'Existing item with line notes' }, { id: 'mapped-variation', label: 'Use a mapped variation when available' }];
  return <WorkflowDialog isOpen={open} onClose={onClose} title="Customer confirmations" ariaLabel="Customer confirmations and product options" step="Policy and preview" testId="customer-order-settings-dialog" actions={<Button size={SIZE.compact} onClick={onClose}>Done</Button>}>
    <div data-testid="customer-order-settings" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      <p style={paragraph}>Changes apply to future confirmations. Existing messages and issued documents stay unchanged.</p>
      <section style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
        <Checkbox checked={grants.confirm} onChange={event => write(setGrants({ confirm: (event.target as HTMLInputElement).checked }, 'confirm'))} overrides={{ Input: { props: { 'data-testid': 'policy-confirm-chat' } } }}>Confirm orders in chat</Checkbox>
        <Checkbox checked={config.confirmation.includePrices} onChange={event => write(set({ confirmation: { includePrices: (event.target as HTMLInputElement).checked } }))} overrides={{ Input: { props: { 'data-testid': 'policy-confirm-prices' } } }}>Include prices in confirmations</Checkbox>
        <Checkbox checked={config.albaran.values === 'valued'} onChange={event => write(set({ albaran: { ...config.albaran, values: (event.target as HTMLInputElement).checked ? 'valued' : 'unvalued' } }))} overrides={{ Input: { props: { 'data-testid': 'policy-albaran-prices' } } }}>Show prices on delivery notes</Checkbox>
      </section>
      <p data-testid="confirmation-policy-effect" style={paragraph}>{policyEffect}</p>
      {customer && <section style={card}>
        <label style={theme.typography.LabelSmall}>Preview for customer<Select data-testid="confirmation-preview-customer" aria-label="Preview for customer" clearable={false} searchable options={customerOptions} value={customerOptions.filter(option => option.id === customer.id)} onChange={({ value }) => setCustomerId(String(value[0]?.id ?? ''))} /></label>
        <p style={paragraph}>{recentIds.length ? 'Your most recent price changes' : 'Example catalogue items'} · {previewProducts.length} items</p>
        {mode === 'with-prices' && previewProducts.some(product => !confirmationRate(cast, product, customer, today)) && <p data-testid="confirmation-price-review-state" style={paragraph}>Order is part confirmed. Review the prices still to set.</p>}
        <p data-testid="confirmation-preview" style={{ ...theme.typography.ParagraphSmall, margin: 0, whiteSpace: 'pre-wrap' }}>{example}</p>
        <p style={paragraph}>Preview only · messages go out from the customer’s chat.</p>
      </section>}
      <section style={card}>
        <span style={theme.typography.LabelMedium}>Product requests and options</span>
        <Checkbox checked={config.productRequests.suggestNewSkus} onChange={event => write(set({ productRequests: { ...config.productRequests, suggestNewSkus: (event.target as HTMLInputElement).checked } }))} overrides={{ Input: { props: { 'data-testid': 'policy-suggest-skus' } } }}>Suggest a product review for recurring requests</Checkbox>
        <p style={paragraph}>{config.productRequests.suggestNewSkus ? 'Recurring requests can be reviewed. Only your approval creates a product.' : 'Recurring requests stay as line notes until you choose a review.'}</p>
        <label style={theme.typography.LabelSmall}>How product options reach your ERP<Select data-testid="policy-erp-options" aria-label="How product options reach your ERP" clearable={false} searchable={false} options={erpOptions} value={erpOptions.filter(option => option.id === config.productRequests.erpLines)} onChange={({ value }) => write(set({ productRequests: { ...config.productRequests, erpLines: (value[0]?.id as AppConfig['productRequests']['erpLines']) ?? 'base-item-note' } }))} /></label>
        <p style={paragraph}>This leaves your ERP items as they are. A mapped variation needs approval; the rest stay in review.</p>
      </section>
      {error && <p data-testid="order-policy-save-error" role="alert" style={{ ...paragraph, color: theme.colors.negative }}>{error}</p>}
    </div>
  </WorkflowDialog>;
}
