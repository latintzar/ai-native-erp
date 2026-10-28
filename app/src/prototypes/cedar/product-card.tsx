/** One exact SKU sheet in every housing: identity and unit → gated price/stock → related products
 * → internal category → requested personalisations → order history → stats. No related SKU, price,
 * history or image is silently inherited. */
import * as React from 'react';
import { SKUArtwork, useApprovedSKUArtwork } from './sku-artwork';
import { CODE_PENDING, codeText } from './product-code';
import { ConfirmationPolicyDoor } from './confirmation-policy-door';
import { allRelatedProductIds, linkProducts, relatedProductIds, unlinkProducts, useProductRelations } from './product-relations';
import { openAssistant } from './assistant';
import { returnAnchor, useHistoryLayer, openOrderLine, openProduct, openTierRegistry } from './anchors';
import { SKUStock, SKUDetailsEditor, useSKUStock } from './product-sheet-sections';
import { categoryOptions, familyOptions, placementFor, saveSKUPlacement, useProductOntology } from './product-ontology';
/* §196.1 · every CMS-like product field is ONE live combobox — the shared organ, lifted from
   Base's own Combobox, never a second dropdown engine. */
import { LiveField, LiveHeading, LiveUnitField, type LiveCommitResult } from './live-field';
import { projectSKU, skuRecord, skuDetails, saveSKU, useSKURecords, takeInitialSKUPrice, type SKUDetails } from './sku-record';
import {
  pendingImportedPrice,
  useCatalogue,
  amendmentsOf,
  amendmentProduct,
  graduatedBase,
  graduatedProducts,
  mintedOf,
} from './catalogue';
import { ProductFace } from './product-face';
import { exactPaintingFor } from './painting-map';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Figure } from './figure';
import { LineChart, CURVE, SIZE as CHART_SIZE } from '../../rocoto/charts';
import { type Cast, type Customer, type Product } from '../../scenarios/data/cast';
import type { SectorId } from '../../scenarios/meta';
import Name from '../../scenarios/shell/Name';
import { ancestorsOf, ground, nodeOf } from './catalogue';
import { buildSales, customerOptionText, RANK, STATE_TEXT, todayId, type Sale } from './sale';
import { nowOf, useDay } from './day';
/* the face, and the family mark that stands where no painting answers — one drawing of the goods
   across the whole app (the never-redraw law) */
import { Face, familyMarkOf } from './product-face';
/* the AI's own mark, at its smallest — the app's one device for «Rocoto did this» */
import { ActDot, Glyph, STEP } from './glyphs';
/* THE APP'S ONE OBJECT DOOR (§43) — the underline every pressable name in the app wears. */
import { Door as ObjectDoor, openOrder } from './anchors';
import { amount, priceTrailOf, type PriceMove } from './knows';
import {
  bandOf,
  ownPriceOf,
  priceHistoryOf,
  priceOn,
  priceUnitOf,
  setCustomerPrice,
  tierNameOf,
  tiersOfHouse,
  useTiers,
  writtenOn,
  type Tier,
} from './tiers';
/* §16.2's own-price sheet is the price entry's grammar at a run of one — same card, same field. */
import { OverlayCard } from '../../rocoto/overlay-card';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { WorkflowDialog } from './workflow-dialog';
import { canonicalPriceEditorAmount, priceEditorAmount, priceEditorUnit, ProductTarifas, PriceEntry, PriceSaveNotice, TarifaModeActs, type Draft } from './stock-tiers';
/* §43's object law: a customer's name is a door to the customer, and the customer renders the SAME
   wherever the door was pressed — so the sheet opens the one profile the albarán opens. */
import { CustomerSheetOverlay } from './customer-sheet-overlay';
import { accountOf, useCustomerEdits } from './customer-edits';
/* §137.2 · the essentials a pointer at rest asks for, on the buyer list's own names */
import { CustomerHoverCard } from './customer-hovercard';
import { usePhone } from './shell';
/* §62.4's ONE SHARED ORGAN. The field a person writes goods into is the SAME component on the
   albarán's add-a-line, on this door, and on the catalogue's own word — so the parse, the offered
   dropdown, the Rocoto face (§116.1), the ↵ button (§116.2) and every key are one implementation. */
import ChipEntry from './chip-entry';
import { inferredUnitKind, productUnitEquivalences, saveTenantUnit, unitDefinitionForLabel, useUnits } from './units';
import { capabilityAvailable } from './release-profile';
import { useWorkspaceCapabilities } from './workspace-capabilities';

import type { ChipLine, ChipRegisters } from './chip-parse';

/* ═══ §16.2 · CUSTOMER-SPECIFIC PRICING, WHERE THE CUSTOMER IS ALREADY NAMED ══════════════════
 * «Multiple tariffs / price groups; CUSTOMER-SPECIFIC PRICING; frequently changing daily prices;
 * arbitrary real-world commercial exceptions.»
 *
 * A price for one account is the SAME OBJECT as a tarifa price — one written fact about (product,
 * whose, day), appended, superseding, readable forever — so it rides the tarifa system's own shape
 * and this file adds no store, no second history and no second Undo (§27.5). `tiers.ts` holds the
 * whole of the mechanism; these three pieces are its surface.
 *
 * AND IT LIVES ON THE BUYER'S OWN ROW. The sheet already names the two accounts that matter for
 * these goods; putting the act anywhere else would be a settings page for a thing a person decides
 * while looking at a customer. The row STATES the exception where one stands, and the act writes it.
 */

/** The act, at the size of the row it rides. */
function OwnPriceAct({ customer, onOpen }: { customer: Customer; onOpen: (c: Customer) => void }) {
  return (
    <Button
      kind={KIND.tertiary}
      size={SIZE.mini}
      shape={SHAPE.pill}
      data-testid={`own-price-${customer.id}`}
      onClick={() => onOpen(customer)}
    >
      Their price
    </Button>
  );
}

/** Customer-specific price entry keeps the exact customer/SKU override separate from tariff history. */
function OwnPriceSheet({
  cast,
  product,
  customer,
  day,
  hour,
  onClose,
}: {
  cast: Cast;
  product: Product;
  customer: Customer | null;
  day: string;
  hour: string;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  useTiers();
  const { country } = useWorkspaceCapabilities(cast.sector);
  const [value, setValue] = React.useState('');
  React.useEffect(() => setValue(''), [customer]);
  if (!customer) return null;

  const band = bandOf(cast, customer);
  const own = ownPriceOf(product, customer, day);
  const onBand = writtenOn(product, band, day) ?? (cast.products.some((item) => item.id === product.id) ? priceOn(cast, product, band, day) : null);
  const standing = own?.price ?? onBand;
  const unit = priceUnitOf(product);
  const editorUnit = priceEditorUnit(unit, country);
  const typed = Number(value.replace(',', '.'));
  const ready = value.trim().length > 0 && Number.isFinite(typed) && typed > 0;
  return (
    <WorkflowDialog
      isOpen
      title="Customer price"
      step={`${customer.name} · ${product.name}`}
      ariaLabel={`A price for ${customer.name}`}
      onClose={onClose}
      testId="own-price-sheet"
      actions={<><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="own-price-close" onClick={onClose}>Cancel</Button><Button size={SIZE.compact} disabled={!ready} data-testid="own-price-save" onClick={() => { if (setCustomerPrice({ product, customer, day, price: canonicalPriceEditorAmount(typed, country), at: hour }).length) onClose(); }}>Save price</Button></>}
    >
      <div data-customer={customer.id} data-standing={standing} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <Input
          size={INPUT_SIZE.large}
          value={value}
          autoFocus
          onChange={(event) => setValue((event.target as HTMLInputElement).value)}
          placeholder={standing === null ? 'Enter price' : priceEditorAmount(standing, country).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          aria-label={`Their price for ${product.name}`}
          endEnhancer={<span style={{ ...theme.typography.LabelMedium, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{editorUnit}</span>}
          overrides={{ Input: { props: { 'data-testid': 'own-price-input', inputMode: 'decimal', autoComplete: 'off' }, style: { ...theme.typography.HeadingLarge, fontVariantNumeric: 'tabular-nums' } }, EndEnhancer: { style: { whiteSpace: 'nowrap' } } }}
        />
        <PriceSaveNotice />
        <span data-testid="own-price-context" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {standing === null ? 'Their first price is still to set.' : `Previous ${priceEditorAmount(standing, country).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${editorUnit}${own ? ` · their own · set ${own.at}` : ` · ${tierNameOf(cast, band)}`}`}
        </span>
      </div>
    </WorkflowDialog>
  );
}

export type ProductCardProps = {
  cast: Cast;
  product: Product;
  /** A related SKU is context only; prices, history, stock and artwork use this SKU's ID. */
  priceParent?: Product;
  openPriceInitially?: boolean;
  /** Existing SKU and accepted uncoded records available to the inline relation picker. */
  availableRelatedItems?: RelatedCatalogueItem[];
  /** Opens either a coded SKU or a stable uncoded catalogue item without losing Products context. */
  onOpenRelated?: (id: string) => void;
  /** Starts a distinct SKU when an established Product cannot safely change Unit. */
  onAddVariation?: (base: Product) => void;
  onBack?: () => void;
  backLabel?: string;
  /** Adjacent exact products in the Products pane's current filtered order. Phone only. */
  onPrevious?: () => void;
  onNext?: () => void;
  /** Pane owns its scrollport; flow is embedded in the document's overlay. */
  layout?: 'pane' | 'flow';
  onRegistry?: () => void;
};

const LOCALE = 'es-ES';

export { SheetPart, SheetRow } from './product-sheet-parts';
import { SheetPart, SheetRow } from './product-sheet-parts';

/** THE LADDER, SAID PLAINLY (THE-DENSE-BRIEF §C). Family · Shelf · Kind · Sort, walked off the tree
 *  the product grounds onto — and the grade register it takes, which is the ladder's own L4. */
export function ladderOf(product: Product): Array<{ level: string; name: string }> {
  const node = ground(product.name, product.family);
  const here = nodeOf(node);
  const walk = [...(here ? [here] : []), ...ancestorsOf(node)].reverse();
  const LEVEL: Record<string, string> = {
    family: 'Family',
    category: 'Shelf',
    type: 'Kind',
    sort: 'Sort',
  };
  return walk.map((n) => ({ level: LEVEL[n.level] ?? n.level, name: n.name }));
}

/** THE SENTENCE THAT SAYS WHERE IT SITS, in the trade's own words rather than in level names — and
 *  it never repeats the name standing above it, because a sheet that says «Pulpo, Pulpo on
 *  Cefalópodos» has spent its second line saying nothing. */
export function placeOf(product: Product): string {
  const ladder = ladderOf(product);
  const shelf = ladder.find((l) => l.level === 'Shelf');
  const family = ladder.find((l) => l.level === 'Family');
  const sort = ladder.find((l) => l.level === 'Sort');
  return [family && family.name, shelf && shelf.name, sort && sort.name].filter(Boolean).join(' › ');
}

/** «2026-08-25» → «25.08», which is how the trade writes a day and how the trail already speaks. */
const dayWords = (id: string): string => (id.includes('-') ? `${id.slice(8)}.${id.slice(5, 7)}` : id);

/** THE PRICE IN TIME — the house's own standing sheet with every written stamp laid on top of it.
 *  One band at a time, because a chart drawing three tarifas at once answers a question nobody
 *  asked and hides the one they did. */
function movesOf(cast: Cast, product: Product, tier: string, priceParent?: Product): PriceMove[] {
  const own = cast.products.some((p) => p.id === product.id);
  const primary = tiersOfHouse(cast)[0].id;
  const written = priceHistoryOf(product, tier).slice().reverse();
  const daysWritten = new Set(written.map((stamp) => dayWords(stamp.day)));
  const trail =
    own && tier === primary && !priceParent
      ? priceTrailOf(cast, product).filter((m) => !daysWritten.has(m.day))
      : [];
  const moves = [
    ...trail,
    ...written.map((stamp) => ({
      day: `${dayWords(stamp.day)} · ${stamp.at}`,
      price: stamp.price,
      author: stamp.author,
    })),
  ];
  if (!moves.length && (own || writtenOn(product, tier, todayId(cast)) !== null))
    moves.push({
      day: dayWords(todayId(cast)),
      price: writtenOn(product, tier, todayId(cast)) ?? priceOn(cast, product, tier, todayId(cast)),
      author: 'house',
    });
  return moves;
}

const AUTHOR_WORDS: Record<PriceMove['author'], string> = {
  house: 'your sheet',
  hand: 'set by hand',
  rule: 'set by a rule',
  rocoto: 'Set automatically',
};

/* ── A NAME IS A DOOR (FEED-IA §43) ───────────────────────────────────────────────────────────
 * «There's a relationship between orders, customers, and products. Those are objects. Clickable
 * across all… no dead names.» So a buyer on this sheet is pressable — this is the relationship read
 * the other way round, «the product sheet shows who takes it», and the connections ARE the app.
 *
 * IT IS THE APP'S ONE `Door` NOW, NOT A THIRD DRAWING OF ONE. This file, the customers' sheet and
 * the river each grew their own pressable name with the same intent and three sets of pixels, which
 * is precisely how «ONE VISUAL IDENTITY per object — recognition before reading» stops being true:
 * a reader ends up learning, per surface, which words are pressable. One component, one underline,
 * everywhere the app says a name.
 */
/** The product sheet can live in a wide page or in Stock's narrow right pane. The page viewport
 * says nothing about that second case, so composition follows the sheet's actual measured width. */
function CustomerDoor({ customer, onOpen }: { customer: Customer; onOpen: () => void }) {
  const [, theme] = useStyletron();
  return (
    <span
      style={{ ...theme.typography.LabelSmall, display: 'inline-flex', alignItems: 'center', minWidth: 0 }}
    >
      {/* §137.2 · resting on a buyer's name shows the essentials; pressing it opens the one
          profile, which on this surface is the overlay this file already mounts. */}
      <CustomerHoverCard customer={customer}>
        <ObjectDoor testid={`customer-door-${customer.id}`} label={`Open ${customer.name}`} onOpen={onOpen}>
          <Name of={customer} />
        </ObjectDoor>
      </CustomerHoverCard>
    </span>
  );
}

/** A SKU's request history is one row per exact Albarán line. A related SKU never quietly
 * joins this evidence: product.id is the only join and each row hands off to that exact line. */
function ProductRequests({
  product,
  sales,
  surface = 'plain',
  returnAnchorId,
}: {
  product: Product;
  sales: Sale[];
  surface?: 'plain' | 'card';
  returnAnchorId: string;
}) {
  const [, theme] = useStyletron();
  const requests = sales
    .flatMap((sale) => sale.lines
      .filter((line) => line.product.id === product.id)
      .map((line) => ({ sale, line })))
    .sort((left, right) => `${right.sale.day}${right.sale.at}`.localeCompare(`${left.sale.day}${left.sale.at}`));
  const [expanded, setExpanded] = React.useState(() => {
    const target = returnAnchor();
    return requests.slice(5).some(({ sale, line }) => productEvidenceAnchor(returnAnchorId, 'order', sale.id, line.id) === target);
  });
  const shown = expanded ? requests : requests.slice(0, 5);

  return (
    <section id={returnAnchorId} data-product-sheet-block="requests" style={{ minWidth: 0 }}>
      <SheetPart surface={surface} testid="product-requests" title="Order history">
        {shown.map(({ sale, line }) => (
          <Button
            key={`${sale.id}:${line.id}`}
            id={productEvidenceAnchor(returnAnchorId, 'order', sale.id, line.id)}
            kind={KIND.tertiary}
            size={SIZE.compact}
            data-testid={`product-request-${sale.id}-${line.id}`}
            data-list-card="inset"
            aria-label={`Open Delivery Note ${sale.number}, ${line.product.name}, for ${sale.customer.name}`}
            onClick={() => openOrderLine(sale.id, line.id, productEvidenceAnchor(returnAnchorId, 'order', sale.id, line.id))}
            overrides={{ BaseButton: { style: { boxSizing: 'border-box', width: `calc(100% - ${theme.sizing.scale400})`, margin: `0 ${theme.sizing.scale200}`, minHeight: '56px', padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`, justifyContent: 'flex-start', textAlign: 'left', backgroundColor: 'transparent', border: '1px solid transparent', borderRadius: theme.borders.radius300, color: theme.colors.contentPrimary, cursor: 'default', ':hover': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque }, ':focus-visible': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque, outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' } } } }}
          >
            <span style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale300, width: '100%', minWidth: 0 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
                <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{sale.customer.name}</span>
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>Delivery Note {sale.number} · {sale.deliveryDay} · {sale.archived ? 'Archived' : STATE_TEXT[sale.state]}</span>
              </span>
              <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap' }}>{amount(line.given)} {line.unit}</span>
            </span>
          </Button>
        ))}
        {requests.length === 0 && <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Orders show here.</span>}
        {requests.length > 5 && <span><Button kind={KIND.tertiary} size={SIZE.mini} data-testid="product-requests-more" overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px' } } }} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show fewer' : `View all ${requests.length} orders`}</Button></span>}
      </SheetPart>
    </section>
  );
}

/** Repeated packing or approved customer-facing instructions, joined back to the exact line that
 * carried them. A variation, category or alias never becomes a personalisation by inference. */
function ProductPersonalisations({
  product,
  sales,
  returnAnchorId,
}: {
  product: Product;
  sales: Sale[];
  returnAnchorId: string;
}) {
  const [, theme] = useStyletron();
  const grouped = new Map<string, { text: string; sale: Sale; lineId: string; count: number; stamp: string }>();
  for (const sale of sales) {
    for (const line of sale.lines.filter((item) => item.product.id === product.id)) {
      const notes = [...new Set([line.prepNote?.trim(), customerOptionText(line)?.trim()].filter((value): value is string => Boolean(value)))];
      for (const text of notes) {
        const key = text.toLocaleLowerCase();
        const stamp = `${sale.day}:${sale.at}`;
        const current = grouped.get(key);
        grouped.set(key, current && current.stamp >= stamp
          ? { ...current, count: current.count + 1 }
          : { text, sale, lineId: line.id, count: (current?.count ?? 0) + 1, stamp });
      }
    }
  }
  const rows = [...grouped.values()].sort((left, right) => right.stamp.localeCompare(left.stamp));
  return (
    <section data-product-sheet-block="personalisations" style={{ minWidth: 0 }}>
      <SheetPart surface="card" testid="product-personalisations" title="Requested personalisations">
        {rows.map((row, index) => (
          <Button
            key={`${row.sale.id}:${row.lineId}:${row.text}`}
            id={productEvidenceAnchor(returnAnchorId, 'personalisation-' + index, row.sale.id, row.lineId)}
            kind={KIND.tertiary}
            size={SIZE.compact}
            data-testid={`product-personalisation-${row.sale.id}-${row.lineId}`}
            data-list-card="inset"
            aria-label={`Open Delivery Note ${row.sale.number} for ${row.text}`}
            onClick={() => openOrderLine(row.sale.id, row.lineId, productEvidenceAnchor(returnAnchorId, 'personalisation-' + index, row.sale.id, row.lineId))}
            overrides={{ BaseButton: { style: {
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center',
              gap: theme.sizing.scale400, width: '100%', minHeight: '56px', padding: theme.sizing.scale400,
              justifyContent: 'stretch', textAlign: 'left', backgroundColor: 'transparent',
              border: '1px solid transparent', borderRadius: theme.borders.radius300, color: theme.colors.contentPrimary, cursor: 'default',
              ':hover': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque },
              ':focus-visible': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque, outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' },
            } } }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
              <span data-testid="product-personalisation-text" style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{row.text}</span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{row.sale.customer.name} · Delivery Note {row.sale.number}</span>
            </span>
            {row.count > 1 && <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>Used {row.count} times</span>}
          </Button>
        ))}
        {rows.length === 0 && <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Personalisations show here once a customer asks for one.</span>}
      </SheetPart>
    </section>
  );
}

/** Exact-SKU sales evidence, with each visual leading to the customer or completed albarán behind it. */
function ProductInsights({
  product,
  sales,
  phone,
  onOpenCustomer,
}: {
  product: Product;
  sales: Sale[];
  phone: boolean;
  onOpenCustomer: (customer: Customer) => void;
}) {
  const [, theme] = useStyletron();
  const [detail, setDetail] = React.useState<'orders' | 'customers' | null>(null);
  React.useEffect(() => setDetail(null), [product.id]);
  const completed = sales.filter((sale) => RANK[sale.state] >= RANK.delivered);
  const unitKey = (value: string) => value.trim().toLocaleLowerCase();
  type UnitBucket = {
    key: string;
    label: string;
    total: number;
    days: Map<string, number>;
    customers: Map<string, number>;
  };
  const buckets = new Map<string, UnitBucket>();
  let invalidQuantityLines = 0;
  const customerOrders = new Map<string, { customer: Customer; orders: Set<string> }>();
  for (const sale of completed) {
    const lines = sale.lines.filter((line) => line.product.id === product.id);
    if (!lines.length) continue;
    const held = customerOrders.get(sale.customer.id) ?? { customer: sale.customer, orders: new Set<string>() };
    held.orders.add(sale.id);
    customerOrders.set(sale.customer.id, held);
    for (const line of lines) {
      // A recorded zero remains valid evidence; corrupt, non-finite and negative legacy values do not.
      if (!Number.isFinite(line.given) || line.given < 0) {
        invalidQuantityLines += 1;
        continue;
      }
      const label = line.unit.trim() || product.unit || 'unit';
      const key = unitKey(label);
      const bucket = buckets.get(key) ?? { key, label, total: 0, days: new Map<string, number>(), customers: new Map<string, number>() };
      bucket.total += line.given;
      bucket.days.set(sale.day, (bucket.days.get(sale.day) ?? 0) + line.given);
      bucket.customers.set(sale.customer.id, (bucket.customers.get(sale.customer.id) ?? 0) + line.given);
      buckets.set(key, bucket);
    }
  }
  const primaryUnit = unitKey(product.unit);
  const unitBuckets = [...buckets.values()].sort((left, right) =>
    Number(right.key === primaryUnit) - Number(left.key === primaryUnit) || left.label.localeCompare(right.label));
  const buyers = [...customerOrders.values()].sort((left, right) => right.orders.size - left.orders.size || left.customer.name.localeCompare(right.customer.name));
  const quantitiesForSale = (sale: Sale) => {
    const values = new Map<string, { label: string; quantity: number }>();
    for (const line of sale.lines.filter((item) => item.product.id === product.id)) {
      if (!Number.isFinite(line.given) || line.given < 0) continue;
      const label = line.unit.trim() || product.unit || 'unit';
      const key = unitKey(label);
      const held = values.get(key) ?? { label, quantity: 0 };
      held.quantity += line.given;
      values.set(key, held);
    }
    return [...values.values()].map((row) => `${amount(row.quantity)} ${row.label}`).join(' + ');
  };
  const quantitiesForCustomer = (customerId: string) => unitBuckets
    .filter((bucket) => (bucket.customers.get(customerId) ?? 0) > 0)
    .map((bucket) => `${amount(bucket.customers.get(customerId) ?? 0)} ${bucket.label}`)
    .join(' · ');
  const evidenceCard = {
    background: theme.colors.backgroundPrimary,
    border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300,
    color: theme.colors.contentPrimary,
    cursor: 'default',
    ':hover': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.contentTertiary },
    ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' },
  };
  const chartButton = {
    BaseButton: {
      style: {
        ...evidenceCard,
        display: 'block',
        width: '100%',
        padding: theme.sizing.scale500,
        textAlign: 'left',
      },
    },
  };
  const metricButton = {
    BaseButton: {
      style: {
        ...evidenceCard,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: theme.sizing.scale200,
        minHeight: '84px',
        padding: theme.sizing.scale500,
        textAlign: 'left',
      },
    },
  };
  return (
    <section
      data-testid="product-insights"
      data-product-sheet-block="insights"
      data-quantity-units={unitBuckets.map((bucket) => bucket.label).join(',')}
      style={{ padding: theme.sizing.scale600, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundSecondary, backgroundImage: `linear-gradient(to right, ${theme.colors.borderOpaque} 1px, transparent 1px), linear-gradient(to bottom, ${theme.colors.borderOpaque} 1px, transparent 1px)`, backgroundSize: '18px 18px' }}
    >
      <SheetPart first testid="product-insights-preview" title="Product performance" aside={<span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Completed Delivery Notes</span>}>
        {completed.length ? <>
          <div data-testid="sku-metrics" style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(148px, 1fr))', gap: theme.sizing.scale400 }}>
            <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Show completed orders" onClick={() => setDetail('orders')} overrides={metricButton}><span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Orders</span><span style={{ ...theme.typography.HeadingXSmall }}>{completed.length}</span></Button>
            <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Show customers" onClick={() => setDetail('customers')} overrides={metricButton}><span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Customers</span><span style={{ ...theme.typography.HeadingXSmall }}>{buyers.length}</span></Button>
            {unitBuckets.map((bucket) => <Button key={bucket.key} kind={KIND.tertiary} size={SIZE.compact} data-testid={`product-quantity-${bucket.key}`} data-unit={bucket.label} aria-label={`Show completed quantity in ${bucket.label}`} onClick={() => setDetail('orders')} overrides={metricButton}><span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Quantity · {bucket.label}</span><span style={{ ...theme.typography.HeadingXSmall, overflowWrap: 'anywhere' }}>{amount(bucket.total)} {bucket.label}</span></Button>)}
          </div>
          {invalidQuantityLines > 0 && <span data-testid="product-insights-invalid" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{invalidQuantityLines} invalid {invalidQuantityLines === 1 ? 'quantity' : 'quantities'} excluded</span>}
          {unitBuckets.map((bucket) => {
            const points = [...bucket.days].sort(([a], [b]) => a.localeCompare(b));
            return points.length > 1 ? <Button key={`time:${bucket.key}`} kind={KIND.tertiary} size={SIZE.compact} data-testid="product-insights-chart" data-unit={bucket.label} data-values={points.map(([, value]) => value).join(',')} aria-label={`Show completed quantity over time in ${bucket.label}`} onClick={() => setDetail('orders')} overrides={chartButton}><LineChart title={`Completed quantity · ${bucket.label}`} size={CHART_SIZE.compact} height={144} decimals={0} unit={bucket.label} curve={CURVE.linear} series={[{ name: 'Quantity', data: points.map(([, y], x) => ({ x, y })) }]} formatX={(x) => dayWords(points[Math.round(x)]?.[0] ?? '')} /></Button> : null;
          })}
          {unitBuckets.map((bucket) => {
            const rows = buyers.map((buyer) => ({ ...buyer, quantity: bucket.customers.get(buyer.customer.id) ?? 0 })).filter((row) => row.quantity > 0).sort((left, right) => right.quantity - left.quantity).slice(0, 5);
            const largest = Math.max(0, ...rows.map((row) => row.quantity));
            if (!rows.length || largest <= 0) return null;
            return <div key={`customers:${bucket.key}`} data-testid="product-customers-chart" data-unit={bucket.label} aria-label={`Quantity by customer in ${bucket.label}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
              <span style={theme.typography.LabelSmall}>Quantity by customer · {bucket.label}</span>
              {rows.map((row) => <Button key={row.customer.id} kind={KIND.tertiary} size={SIZE.compact} data-customer={row.customer.id} data-quantity={row.quantity} aria-label={`Open ${row.customer.name}`} onClick={() => onOpenCustomer(row.customer)} overrides={chartButton}><span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{row.customer.name}</span><span style={{ ...theme.typography.LabelXSmall, whiteSpace: 'nowrap' }}>{amount(row.quantity)} {bucket.label}</span></span><span aria-hidden="true" style={{ display: 'block', height: 4, marginTop: theme.sizing.scale200, background: theme.colors.backgroundSecondary, borderRadius: theme.borders.radius200 }}><span style={{ display: 'block', height: '100%', width: `${(100 * row.quantity) / largest}%`, background: theme.colors.contentSecondary, borderRadius: theme.borders.radius200 }} /></span></Button>)}
            </div>;
          })}
          {detail === 'orders' && <div data-testid="product-insights-orders-detail" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}><span style={theme.typography.LabelSmall}>Completed Delivery Notes</span>{completed.slice().sort((a, b) => `${b.day}${b.at}`.localeCompare(`${a.day}${a.at}`)).map((sale) => <SheetRow key={sale.id} label={<ObjectDoor testid={`product-insight-order-${sale.id}`} label={`Open completed order for ${product.name}`} onOpen={() => openOrder(sale.id)}>{sale.customer.name}</ObjectDoor>} sub={sale.deliveryDay} value={quantitiesForSale(sale)} />)}</div>}
          {detail === 'customers' && <div data-testid="product-insights-details">{buyers.map((row) => <SheetRow key={row.customer.id} label={<CustomerDoor customer={row.customer} onOpen={() => onOpenCustomer(row.customer)} />} sub={`${row.orders.size} completed ${row.orders.size === 1 ? 'order' : 'orders'}`} value={quantitiesForCustomer(row.customer.id)} />)}</div>}
        </> : <div data-testid="sku-insights-empty" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}><span style={theme.typography.LabelSmall}>Completed orders show here</span></div>}
      </SheetPart>
    </section>
  );
}

function ProductFact({
  label,
  value,
  testid,
  onOpen,
}: {
  label: string;
  value: string;
  testid?: string;
  onOpen?: () => void;
}) {
  const [, theme] = useStyletron();
  const content = <>
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: theme.sizing.scale100, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{label}</span>
      <span style={{ ...theme.typography.HeadingXSmall, overflowWrap: 'anywhere', textAlign: 'left', maxWidth: '100%' }}>{value}</span>
    </span>
    {onOpen && <span aria-hidden="true" style={{ display: 'inline-flex', color: theme.colors.contentSecondary }}><Glyph id="edit" size={STEP.small} /></span>}
  </>;
  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'start',
    gap: theme.sizing.scale300,
    width: '100%',
    minHeight: 80,
    padding: theme.sizing.scale500,
    boxSizing: 'border-box',
    border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300,
    background: theme.colors.backgroundPrimary,
    color: theme.colors.contentPrimary,
    fontFamily: 'inherit',
  };
  return onOpen ? <button type="button" data-testid={testid} aria-label={`Edit ${label.toLocaleLowerCase()}`} onClick={onOpen} style={{ ...style, cursor: 'default' }}>{content}</button>
    : <div data-testid={testid} style={style}>{content}</div>;
}

/* ── THE IDENTITY FIELDS ARE LIVE (FEED-IA §196.1) ────────────────────────────────────────────
 * «it doesnt look like live dropdowns … any time its a field that is sort of cms related like a
 * form field for a product there should be a dropdown with suggestions appear which filters as
 * people type… same for units.»
 *
 * ⚠ SUPERSEDES the E189/E190 reading of this block, where Code and Unit were passive cards whose
 * only door was the «Edit product» dialog. The value now stands IN its field: one press puts the
 * caret in it, the Unit carries the house's own vocabulary as a filtering list, and a word the
 * house has never used is accepted as new. The dialog keeps exactly one job — Unit conversions,
 * which is a sub-object surface and not a field (UNT-02.1).
 */
function ProductIdentityFields({
  sector,
  product,
  catalogue,
  description,
  readOnly,
  unitLocked,
  onConversions,
  onAddVariation,
  onSave,
}: {
  sector: SectorId;
  product: Product;
  description: string;
  /** the tenant's catalogue — where the offered units come from */
  catalogue: Array<{ unit?: string }>;
  readOnly?: boolean;
  unitLocked?: boolean;
  onConversions: () => void;
  onAddVariation?: () => void;
  onSave: (patch: Partial<SKUDetails>, policy?: { allowUnitChange?: boolean }) => LiveCommitResult;
}) {
  const [, theme] = useStyletron();
  useUnits();
  const conversions = productUnitEquivalences(sector, product);
  const first = conversions[0];
  const conversionSummary = first
    ? `1 ${first.unit} = ${first.status && first.status !== 'exact' ? '~' : ''}${first.quantity.toLocaleString('es-ES')} ${first.baseUnit}${conversions.length > 1 ? ` · +${conversions.length - 1}` : ''}`
    : 'Conversions still to save';
  return <section
    data-testid="product-units"
    data-product-sheet-block="units"
    style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, padding: theme.sizing.scale600, borderTop: `1px solid ${theme.colors.borderOpaque}`, background: theme.colors.backgroundPrimary, minWidth: 0 }}
  >
    <div data-testid="product-core-facts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: theme.sizing.scale400, alignItems: 'start', minWidth: 0 }}>
      {readOnly
        ? <>
            <ProductFact label="Code" value={codeText(product.code)} />
            <ProductFact label="Unit" value={product.unit || 'Needs review'} />
            <ProductFact label="Description" value={description || 'Kept as it arrived'} />
          </>
        : <>
            <LiveField
              id="product-code"
              label="Code"
              value={product.code || ''}
              suggestions={[]}
              placeholder="For example, PV-1001"
              inputTestid="sku-edit"
              onCommit={({ value }) => onSave({ code: value })}
            />
            <LiveUnitField
              id="product-unit"
              sector={sector}
              product={product}
              catalogue={catalogue}
              value={product.unit || ''}
              inputTestid="product-unit-edit"
              disabled={Boolean(unitLocked)}
              because={unitLocked ? 'Orders, prices and stock use this Unit. Another Unit takes a variation.' : undefined}
              hint="How this product is sold and counted."
              aside={unitLocked && onAddVariation
                ? <Button kind={KIND.secondary} size={SIZE.mini} data-testid="product-unit-add-variation" onClick={onAddVariation} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Add variation</Button>
                : undefined}
              onCommit={({ value }) => onSave({ unit: value }, { allowUnitChange: true })}
            />
            <LiveField
              id="product-description"
              label="Description"
              optional
              value={description}
              suggestions={[]}
              placeholder="Notes for your team"
              onCommit={({ value }) => onSave({ description: value })}
            />
          </>}
    </div>
    <Button
      kind={KIND.tertiary}
      size={SIZE.compact}
      data-testid="product-unit-conversions-manage"
      aria-label="Manage unit conversions"
      onClick={onConversions}
      overrides={{ BaseButton: { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', width: '100%', minHeight: '56px', padding: theme.sizing.scale400, textAlign: 'left', backgroundColor: theme.colors.backgroundPrimary, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, color: theme.colors.contentPrimary, cursor: 'default', ':hover': { backgroundColor: theme.colors.backgroundTertiary }, ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' } } } }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: theme.sizing.scale100, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Conversions</span>
        <span data-testid="product-unit-conversions" style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{conversionSummary}</span>
      </span>
      <span aria-hidden="true" style={{ display: 'inline-flex', color: theme.colors.contentSecondary, transform: 'rotate(-90deg)' }}><Glyph id="caret" size={STEP.small} /></span>
    </Button>
  </section>;
}

const productEvidenceAnchor = (base: string, kind: string, saleId: string, lineId: string) =>
  [base, kind, saleId, lineId].join('-');

type RelatedCatalogueItem = {
  id: string;
  name: string;
  code?: string;
  unit?: string;
  kind?: 'sku' | 'uncoded';
};

/** Related products are direct links to existing tenant SKUs or accepted uncoded records. Category
 * and broad grouping do not create a link, and this editor never creates a record. */
function RelatedItems({
  sector,
  current,
  items,
  allItems,
  manualIds,
  onOpen,
}: {
  sector: SectorId;
  current: Product;
  items: RelatedCatalogueItem[];
  allItems: RelatedCatalogueItem[];
  manualIds: string[];
  onOpen: (id: string) => void;
}) {
  const [, theme] = useStyletron();
  const [relationError, setRelationError] = React.useState('');
  React.useEffect(() => { setRelationError(''); }, [current.id]);
  const linked = new Set(items.map((item) => item.id));
  const identity = (item: RelatedCatalogueItem) => item.kind === 'uncoded'
    ? 'Uncoded item'
    : codeText(item.code);
  /* §196.1 · the relation picker is a live field too — but a relation names an EXISTING record,
     so the typed word is never accepted as new here and no Create SKU door opens from it. */
  const options = allItems
    .filter((item) => item.id !== current.id && !linked.has(item.id))
    .map((item) => ({ id: item.id, value: item.name, note: `${identity(item)} · ${item.unit || 'Unit needs review'}` }));
  const itemRow = (item: RelatedCatalogueItem) => (
    <div key={item.id} data-testid={`product-related-item-${item.id}`} data-product={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale200, minWidth: 0 }}>
      <Button
        kind={KIND.tertiary}
        size={SIZE.compact}
        data-list-card="inset"
        aria-label={`Open ${item.name}`}
        onClick={() => onOpen(item.id)}
        overrides={{ BaseButton: { style: { display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale300, width: '100%', minHeight: '72px', padding: theme.sizing.scale300, textAlign: 'left', backgroundColor: 'transparent', border: '1px solid transparent', borderRadius: theme.borders.radius300, color: theme.colors.contentPrimary, cursor: 'default', ':hover': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque }, ':focus-visible': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque, outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' } } } }}
      >
        <ProductFace of={{ ...item, sector }} size={56} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{item.name}</span>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{identity(item)}</span>
        </span>
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap', textAlign: 'right' }}>{item.unit || '—'}</span>
      </Button>
      {manualIds.includes(item.id)
        ? <Button kind={KIND.tertiary} size={SIZE.compact} data-testid={`product-related-remove-${item.id}`} aria-label={`Remove ${item.name} from related products`} onClick={() => { if (!unlinkProducts(sector, current.id, item.id)) setRelationError('Saving this change stalled. Keep this section open and try again.'); else setRelationError(''); }} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Remove</Button>
        : <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, paddingRight: theme.sizing.scale300 }}>Recorded</span>}
    </div>
  );
  return <section data-testid="product-related-items" data-product-sheet-block="related-items" style={{ minWidth: 0 }}>
    <SheetPart
      surface="card"
      testid="product-related-items-surface"
      title="Related products"
      aside={<span data-testid="product-related-items-count" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{items.length ? `${items.length} linked` : 'Still to link'}</span>}
    >
      {items.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>{items.map(itemRow)}</div> : null}
      {relationError && <div role="alert" data-testid="product-related-save-error" style={{ border: `1px solid ${theme.colors.negative}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale400, color: theme.colors.negative }}>{relationError}</div>}
      <div data-testid="product-related-items-editor" style={{ minWidth: 0, paddingTop: items.length ? theme.sizing.scale400 : 0, borderTop: items.length ? `1px solid ${theme.colors.borderOpaque}` : undefined }}>
        <LiveField
          id="product-related"
          declineSays="Choose a product from the list."
          label="Link a product"
          optional
          allowNew={false}
          value=""
          clearAfterCommit
          suggestions={options}
          placeholder="Type a product name"
          listLabel="Products in your catalogue"
          hint="Links this record to another exact product in your catalogue."
          onCommit={({ id }) => {
            if (!id) return 'Choose a product from the list.';
            if (!linkProducts(sector, current.id, id)) return 'Saving this related product stalled. Keep this selection and try again.';
            setRelationError('');
            return undefined;
          }}
        />
      </div>
    </SheetPart>
  </section>;
}

export default function ProductCard({
  cast,
  product: rawProduct,
  onBack,
  backLabel = 'Back to the delivery note',
  onPrevious,
  onNext,
  layout = 'flow',
  onRegistry,
  priceParent,
  openPriceInitially = false,
  availableRelatedItems = [],
  onOpenRelated = openProduct,
  onAddVariation,
}: ProductCardProps) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { pricing: workspacePricing, inventory, country } = useWorkspaceCapabilities(cast.sector);
  const pricingAvailable = capabilityAvailable('pricing') && workspacePricing;
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const records = useSKURecords();
  const catalogue = useCatalogue();
  const written = useTiers();
  const edits = useDay(cast.sector);
  const accounts = useCustomerEdits();
  const product = React.useMemo(
    () => projectSKU(cast.sector, rawProduct, records),
    [cast.sector, rawProduct, records],
  );
  const details = skuDetails(cast.sector, product, records);
  const record = skuRecord(cast.sector, product.id, records);
  const lastIdentityEdit = record?.history.length ? record.history[record.history.length - 1] : null;
  const baseId = priceParent?.id ?? graduatedBase(product.id) ?? product.id;
  const mintedBase = catalogue.state.minted.find((p) => p.key === `${cast.sector}:${baseId}`);
  const family =
    priceParent ??
    cast.products.find((p) => p.id === baseId) ??
    (mintedBase ? { ...product, ...mintedBase } : product);
  const isVariation = baseId !== product.id;
  const productSales = React.useMemo(
    () => buildSales(cast, edits).filter((sale) => sale.lines.some((line) => line.product.id === product.id)).map((sale) => ({ ...sale, customer: accountOf(sale.customer) })),
    [cast, edits, product.id, accounts],
  );
  const tiers = tiersOfHouse(cast);
  const day = todayId(cast);
  const hour = nowOf(cast);
  const unit = priceUnitOf(product);
  const seeded = cast.products.some((p) => p.id === product.id);
  const hasHistory = productSales.length > 0;
  const { rows: stockRows } = useSKUStock(cast, product);
  const hasStockHistory = stockRows.some((row) => row.kind !== 'rule');
  const hasPriceHistory = seeded || tiers.some((tier) => writtenOn(product, tier.id, day) !== null);
  const unitLocked = hasHistory || hasStockHistory || hasPriceHistory;
  const unpriced = tiers.filter((tier) => !seeded && writtenOn(product, tier.id, day) === null);
  const imported = mintedOf(cast.sector, catalogue.state).find((m) => m.id === product.id);
  const approvedArtwork = useApprovedSKUArtwork(cast.sector, product.id);
  const libraryArtwork = exactPaintingFor(record?.original.name ?? rawProduct.name);
  const originalIdentity = record?.original ?? { name: rawProduct.name, code: rawProduct.code, unit: rawProduct.unit };
  const sourceLabel = imported?.source === 'csv' ? 'Imported catalogue' : imported?.source === 'hand' ? 'Added in Products' : 'Company catalogue';
  const artworkLabel = approvedArtwork ? 'Uploaded product photo' : libraryArtwork ? 'Catalogue illustration' : 'Still to set';
  const edited = !!record && (record.history.length > 1 || seeded);
  const state = details.archived
    ? 'archived'
    : edited
      ? 'edited'
      : imported?.source === 'csv'
        ? 'imported'
        : isVariation
          ? hasHistory
            ? 'variant'
            : 'new-variant'
          : !seeded
            ? 'new'
            : 'active';
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [entry, setEntry] = React.useState(false);
  const [tariff, setTariff] = React.useState<Tier | null>(null);
  const [statsTariff, setStatsTariff] = React.useState<Tier | null>(null);
  const [editorStep, setEditorStep] = React.useState<'units' | null>(null);
  const [archive, setArchive] = React.useState(false);
  const [error, setError] = React.useState('');
  const [open, setOpen] = React.useState<Customer | null>(null);
  const [pricing, setPricing] = React.useState<Customer | null>(null);
  const requestsAnchor = `product-requests-${product.id}`;
  useHistoryLayer({
    id: `sku-price:${product.id}`,
    active: pricingAvailable && entry,
    snapshot: { tier: tariff?.id ?? null },
    onRestore: (v) => {
      setEntry(pricingAvailable && v !== null);
      setTariff(pricingAvailable && v ? (tiers.find((t) => t.id === v.tier) ?? null) : null);
    },
  });
  useHistoryLayer({
    id: `sku-history:${product.id}`,
    active: pricingAvailable && statsTariff !== null,
    snapshot: { tier: statsTariff?.id ?? null },
    onRestore: (v) => setStatsTariff(pricingAvailable && v ? (tiers.find((t) => t.id === v.tier) ?? null) : null),
  });
  useHistoryLayer({
    id: `sku-details:${product.id}`,
    active: editorStep !== null,
    snapshot: { step: editorStep },
    onRestore: (value) => setEditorStep(value ? 'units' : null),
  });
  useHistoryLayer({
    id: `sku-archive:${product.id}`,
    active: archive,
    onRestore: (v) => setArchive(v !== null),
  });
  const relatedCustomer = (id: string): Customer | null => productSales.find((sale) => sale.customer.id === id)?.customer ?? cast.customers.find((customer) => customer.id === id) ?? null;
  useHistoryLayer({
    id: `sku-customer:${product.id}`,
    active: open !== null,
    snapshot: { customer: open?.id ?? null },
    onRestore: (value) => setOpen(value?.customer ? relatedCustomer(String(value.customer)) : null),
  });
  useHistoryLayer({
    id: `sku-customer-price:${product.id}`,
    active: pricingAvailable && pricing !== null,
    snapshot: { customer: pricing?.id ?? null },
    onRestore: (value) => setPricing(pricingAvailable && value?.customer ? relatedCustomer(String(value.customer)) : null),
  });
  React.useEffect(() => {
    setDraft(null);
    setPricing(null);
    setOpen(null);
    setEditorStep(null);
    setArchive(false);
    setStatsTariff(null);
    setTariff(null);
    const requested = takeInitialSKUPrice(cast.sector, product.id);
    setEntry(pricingAvailable && (openPriceInitially || requested));
    sheetRef.current?.scrollTo({ top: 0 });
  }, [product.id, pricingAvailable]);
  React.useEffect(() => {
    const anchor = returnAnchor();
    if (!anchor || (anchor !== requestsAnchor && !anchor.startsWith(requestsAnchor + '-'))) return;
    window.requestAnimationFrame(() => window.document.getElementById(anchor)?.scrollIntoView?.({ block: 'center' }));
  }, [requestsAnchor]);
  const runOfOne = React.useMemo(
    () => [{ key: product.id, name: product.name, product, priceParent: isVariation ? family : undefined }],
    [product, isVariation, family],
  );
  /* The tenant catalogue is a list of exact sellable records. Related rows come only from an
     authored variant or an explicit SKU-to-SKU link; a broad internal category never creates a
     relation. */
  const productRelations = useProductRelations();
  const tenantSKUItems = React.useMemo(() => {
    const mintedRows: Product[] = mintedOf(cast.sector, catalogue.state).map((item) => ({
      id: item.id,
      name: item.name,
      ...(item.code ? { code: item.code } : {}),
      unit: item.unit,
      family: item.family ?? 'unclassified',
      variableWeight: item.unit === 'kg',
      trace: {},
    }));
    const amendmentRows = amendmentsOf(cast.sector, catalogue.state)
      .filter((item) => item.hand || item.sellable)
      .map((item) => amendmentProduct(cast, item));
    return [...cast.products, ...mintedRows, ...graduatedProducts(cast, catalogue.state), ...amendmentRows]
      .filter((item, index, rows) => rows.findIndex((other) => other.id === item.id) === index)
      .map((item) => projectSKU(cast.sector, item, records))
      .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base', numeric: true }) || left.id.localeCompare(right.id));
  }, [cast, catalogue.state, records]);
  const relationCandidates = React.useMemo<RelatedCatalogueItem[]>(() => {
    const rows = [
      ...tenantSKUItems.map((item) => ({ id: item.id, name: item.name, code: item.code, unit: item.unit, kind: 'sku' as const })),
      ...availableRelatedItems,
    ];
    return rows
      .filter((item, index) => rows.findIndex((other) => other.id === item.id) === index)
      .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base', numeric: true }) || left.id.localeCompare(right.id));
  }, [tenantSKUItems, availableRelatedItems]);
  const relatedIds = React.useMemo(
    () => new Set(allRelatedProductIds(cast.sector, product.id, catalogue.state)),
    [cast.sector, product.id, catalogue.state, productRelations],
  );
  const relatedItems = React.useMemo(
    () => relationCandidates.filter((item) => relatedIds.has(item.id)),
    [relationCandidates, relatedIds],
  );
  const manualRelatedIds = React.useMemo(
    () => relatedProductIds(cast.sector, product.id),
    [cast.sector, product.id, productRelations],
  );
  useProductOntology();
  const productPlacement = placementFor(cast.sector, product);
  /* ── THE LIVE FIELDS' ONE WRITE PATH (FEED-IA §196.1) ──────────────────────────────────────
   * Every CMS-like field on this sheet commits through `saveSKU` or `saveSKUPlacement` — the same
   * writers the dialog used — so a live field adds no second ledger, no second history and no
   * second revision guard. A refusal comes back as the sentence the field prints. */
  const putIdentity = (patch: Partial<SKUDetails>, policy?: { allowUnitChange?: boolean }): LiveCommitResult => {
    try {
      const current = skuDetails(cast.sector, rawProduct, records);
      const next: SKUDetails = { ...current, ...patch };
      if (patch.unit && !unitDefinitionForLabel(cast.sector, patch.unit)) {
        const added = saveTenantUnit(cast.sector, {
          label: patch.unit,
          kind: inferredUnitKind(patch.unit),
          precision: patch.unit.trim().toLocaleLowerCase() === 'kg' ? 3 : 0,
        });
        if (!added.ok) return added.error;
      }
      saveSKU(cast.sector, rawProduct, next, record?.revision ?? 0, 'You', { allowUnitChange: policy?.allowUnitChange === true });
      setError('');
      return undefined;
    } catch (caught) {
      return (caught as Error).message;
    }
  };
  const categorySuggestions = React.useMemo(
    () => categoryOptions(cast.sector, tenantSKUItems).map((row) => ({ value: row.name, id: row.id })),
    [cast.sector, tenantSKUItems, productRelations],
  );
  const groupSuggestions = React.useMemo(
    () => familyOptions(cast.sector, productPlacement.category.id, tenantSKUItems).map((row) => ({ value: row.name, id: row.id })),
    [cast.sector, productPlacement.category.id, tenantSKUItems],
  );
  const putPlacement = (patch: { categoryId?: string; categoryName?: string; familyId?: string; familyName?: string }): LiveCommitResult => {
    try {
      saveSKUPlacement(cast.sector, product.id, {
        categoryId: patch.categoryName !== undefined ? patch.categoryId : productPlacement.category.id,
        categoryName: patch.categoryName !== undefined ? patch.categoryName : productPlacement.category.name,
        familyId: patch.familyName !== undefined ? patch.familyId : productPlacement.family.id,
        familyName: patch.familyName !== undefined ? patch.familyName : productPlacement.family.name,
      });
      return undefined;
    } catch (caught) {
      return (caught as Error).message;
    }
  };
  const changeArchive = (archived: boolean) => {
    try {
      saveSKU(cast.sector, product, { ...details, archived }, record?.revision ?? 0, 'You');
      setArchive(false);
      setError('');
      sheetRef.current?.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const history = statsTariff ? movesOf(cast, product, statsTariff.id, isVariation ? family : undefined) : [];
  const pad = phone ? theme.sizing.scale500 : theme.sizing.scale700;
  const gap = phone ? theme.sizing.scale700 : theme.sizing.scale800;
  const sheetWidth = layout === 'pane' ? '720px' : '1040px';
  return (
    <div
      data-testid="product-card"
      data-product={product.id}
      data-sku-state={state}
      data-layout={layout}
      data-variation-of={isVariation ? baseId : undefined}
      ref={sheetRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        ...(layout === 'pane' ? { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'clip' } : {}),
        background: theme.colors.backgroundPrimary,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap,
          padding: `${pad} ${pad} ${theme.sizing.scale1600}`,
          width: '100%',
          maxWidth: sheetWidth,
          boxSizing: 'border-box',
          alignSelf: 'center',
          minWidth: 0,
        }}
      >
        {(onBack || (phone && (onPrevious || onNext))) && <div data-testid="product-sheet-navigation" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
          {onBack ? <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="product-card-back" aria-label={backLabel} onClick={onBack} overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', padding: 0 } } }}><Glyph id="back" size={STEP.medium} /></Button> : <span />}
          {phone && (onPrevious || onNext) && <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale100 }}>
            <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="product-sheet-previous" aria-label="Previous product" disabled={!onPrevious} onClick={onPrevious} overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', padding: 0 } } }}><span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Glyph id="caret" size={STEP.medium} /></span></Button>
            <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="product-sheet-next" aria-label="Next product" disabled={!onNext} onClick={onNext} overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', padding: 0 } } }}><span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Glyph id="caret" size={STEP.medium} /></span></Button>
          </span>}
        </div>}
        <section
          data-testid="product-identity-object"
          style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, background: theme.colors.backgroundPrimary, overflow: 'hidden', minWidth: 0 }}
        >
          <header
            data-testid="product-head"
            data-product-sheet-block="identity"
            style={{
              display: 'grid',
              gridTemplateColumns: phone ? 'minmax(0, 1fr)' : '112px minmax(0, 1fr)',
              alignItems: phone ? 'start' : 'center',
              columnGap: phone ? undefined : theme.sizing.scale600,
              rowGap: phone ? theme.sizing.scale400 : undefined,
              padding: theme.sizing.scale600,
              position: 'relative',
              minWidth: 0,
            }}
          >
            <span data-testid="product-face-seat" style={{ minWidth: 0, justifySelf: phone ? 'center' : undefined }}>
              <SKUArtwork
                product={product}
                sector={cast.sector}
                size={phone ? 88 : 112}
                readOnly={details.archived}
              />
            </span>
            <div data-testid="product-identity-copy" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
              {/* §196.1 · the name is edited where it is read — one press puts the caret in it */}
              <LiveHeading
                id="product-name"
                label="Product name"
                value={product.name}
                placeholder="Name these goods"
                disabled={details.archived}
                onCommit={(next) => putIdentity({ name: next })}
              />
              {edited && lastIdentityEdit && (
                <span
                  data-testid="sku-edited"
                  style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}
                >
                  Updated by {lastIdentityEdit.by}
                </span>
              )}
            </div>
          </header>
          <ProductIdentityFields
            sector={cast.sector}
            product={product}
            catalogue={tenantSKUItems}
            description={details.description}
            readOnly={details.archived}
            unitLocked={unitLocked}
            onAddVariation={onAddVariation ? () => onAddVariation(family) : undefined}
            onConversions={() => setEditorStep('units')}
            onSave={putIdentity}
          />
        </section>
        {details.archived && (
          <section
            data-testid="sku-archived-banner"
            style={{
              padding: theme.sizing.scale500,
              background: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius400,
            }}
          >
            <strong>Archived product</strong>
            <p style={{ margin: `${theme.sizing.scale200} 0`, ...theme.typography.ParagraphSmall }}>
              Kept for its existing orders and history. Restore it to offer it on reviewed orders again.
            </p>
            <Button size={SIZE.compact} data-testid="sku-restore" onClick={() => changeArchive(false)}>
              Restore product
            </Button>
          </section>
        )}
        {error && <p role="alert" style={{ margin: 0 }}>{error}</p>}
        {(() => {
          const importedPrice = pendingImportedPrice(cast.sector, product.id, catalogue.state);
          const lead = tiers[0];
          const needsReview = !details.archived && !!product.unit && importedPrice !== undefined && !!lead && writtenOn(product, lead.id, day) === null;
          return pricingAvailable && needsReview ? <Button kind={KIND.secondary} size={SIZE.compact} data-testid="sku-review-imported-price" onClick={() => { setTariff(lead); setEntry(true); }}>Review imported price · {priceEditorAmount(importedPrice, country).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {priceEditorUnit(unit, country)}</Button> : null;
        })()}
        {pricingAvailable || inventoryAvailable ? <div
          data-testid="product-summary-grid"
          data-product-sheet-block="future-commercial-work"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap, alignItems: 'start', minWidth: 0 }}
        >
          {pricingAvailable && <SheetPart first surface="card" testid="product-tarifas" title={tiers.length === 1 ? 'Price' : 'Tariffs'} aside={<Button kind={KIND.tertiary} size={SIZE.mini} data-testid="product-manage-tariffs" onClick={openTierRegistry} overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px' } } }}>Manage tariffs</Button>}>
            {!details.archived && !!unpriced.length && <span data-testid="sku-price-pending" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{unpriced.length === tiers.length ? 'Set the first price.' : `${unpriced.length} ${unpriced.length === 1 ? 'price needs' : 'prices need'} attention.`}</span>}
            {details.archived ? <div data-testid="product-archived-tarifas" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: theme.sizing.scale400, minWidth: 0 }}>
              {tiers.map((tier) => {
                const unset = !seeded && writtenOn(product, tier.id, day) === null;
                return <div key={tier.id} data-product-price-card="true" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: theme.sizing.scale300, alignItems: 'start', minHeight: 132, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, background: theme.colors.backgroundPrimary, minWidth: 0 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
                    <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{tiers.length === 1 ? 'Price' : tier.name}</span>
                    <span style={{ ...theme.typography.HeadingSmall, overflowWrap: 'anywhere' }}>{unset ? 'Still to set' : `${priceEditorAmount(priceOn(cast, product, tier.id, day), country).toLocaleString(LOCALE)} ${priceEditorUnit(unit, country)}`}</span>
                  </span>
                  <Button kind={KIND.tertiary} size={SIZE.mini} aria-label={`Price history for ${tier.name} · ${product.name}`} onClick={() => setStatsTariff(tier)} overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px' } } }}>History</Button>
                  <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, gridColumn: '1 / -1' }}>Archived · Last recorded price</span>
                </div>;
              })}
            </div> : <ProductTarifas cast={cast} product={product} priceParent={!seeded ? family : undefined} tiers={tiers} day={day} hour={hour} draft={draft} onDraft={setDraft} onOpenTariff={(id) => { setTariff(tiers.find((tier) => tier.id === id) ?? null); setEntry(true); }} onStatsTariff={(id) => setStatsTariff(tiers.find((tier) => tier.id === id) ?? null)} frame="sheet" />}
            {draft && !details.archived && <TarifaModeActs product={product} tiers={tiers} draft={draft} onDraft={setDraft} day={day} hour={hour} />}
            {!details.archived && <ConfirmationPolicyDoor />}
          </SheetPart>}
          {inventoryAvailable && <SKUStock cast={cast} product={product} archived={details.archived} sales={productSales} surface="card" />}
        </div> : null}
        <RelatedItems sector={cast.sector} current={product} items={relatedItems} allItems={relationCandidates} manualIds={manualRelatedIds} onOpen={onOpenRelated} />
        <section data-product-sheet-block="internal-category" style={{ minWidth: 0 }}>
          <SheetPart surface="card" testid="product-category" title="Internal category" aside={<Button kind={KIND.tertiary} size={SIZE.mini} data-testid="product-category-edit" overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px' } } }} onClick={() => openAssistant({ kind: 'catalogue', context: { productId: product.id, productIds: [product.id], categoryId: productPlacement.category.id, source: 'catalogue' } })}>Ask the Copilot</Button>}>
            {/* §196.1 · category and group are the house's own taxonomy — a filtering list of
                what it already uses, and the typed word accepted as a new one. */}
            <div data-testid="product-category-facts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: theme.sizing.scale400, alignItems: 'start', minWidth: 0 }}>
              <LiveField
                id="product-category"
                label="Category"
                optional
                value={productPlacement.saved ? productPlacement.category.name : ''}
                suggestions={categorySuggestions}
                placeholder={productPlacement.category.name || 'Choose a category or write one'}
                hint={productPlacement.saved ? 'Your own filing. Price, stock and artwork stay with the SKU.' : 'Rocoto reads this from the reference until you file it.'}
                disabled={details.archived}
                onCommit={({ value, id }) => putPlacement({ categoryId: id, categoryName: value })}
              />
              <LiveField
                id="product-group"
                label="Group"
                optional
                value={productPlacement.saved ? productPlacement.family.name : ''}
                suggestions={groupSuggestions}
                placeholder={productPlacement.family.name || 'Choose a group or write one'}
                hint={productPlacement.saved ? 'The set this product belongs to inside its category.' : 'Rocoto reads this from the reference until you file it.'}
                disabled={details.archived}
                onCommit={({ value, id }) => putPlacement({ familyId: id, familyName: value })}
              />
            </div>
          </SheetPart>
        </section>
        <ProductPersonalisations product={product} sales={productSales} returnAnchorId={requestsAnchor} />
        <ProductRequests key={product.id} product={product} sales={productSales} surface="card" returnAnchorId={requestsAnchor} />
        {/* ── SOURCE & CHANGES · flat, headed by a noun (FEED-IA §196.1) ──────────────────────
          * ⚠ SUPERSEDES the clock disclosure in the identity head: «no collapsible sections».
          * The record's provenance and its change log are a SECTION of the sheet, standing open,
          * and they keep their place before Product performance so performance is still the end
          * of the main reading sequence (§0.2.5). */}
        <section
          id={`product-details-history-${product.id}`}
          data-testid="product-details-history"
          data-product-sheet-block="details-history"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, padding: theme.sizing.scale600, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, background: theme.colors.backgroundPrimary, minWidth: 0 }}
        >
          <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Source &amp; changes</h3>
          <div data-testid="product-details-history-facts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: theme.sizing.scale300, minWidth: 0 }}>
            <ProductFact label="Original name" value={originalIdentity.name} />
            <ProductFact label="Original code" value={originalIdentity.code || (product.code ? 'Added later' : CODE_PENDING)} />
            <ProductFact label="Original unit" value={originalIdentity.unit || (product.unit ? 'Added later' : 'Needs review')} />
            <ProductFact label="Source" value={sourceLabel} />
            <ProductFact label="Artwork" value={artworkLabel} />
          </div>
          <section data-testid="product-aliases" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, paddingTop: theme.sizing.scale400, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
            <span style={theme.typography.LabelSmall}>Names customers use</span>
            {details.aliases.length ? details.aliases.map((alias, index) => <SheetRow key={`${alias.name}-${alias.customer ?? 'all'}-${index}`} label={alias.name} value={alias.customer ? cast.customers.find((customer) => customer.id === alias.customer)?.name ?? 'Unavailable customer' : 'All customers'} />) : <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Other names show here.</span>}
          </section>
          <section data-testid="product-change-history" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, paddingTop: theme.sizing.scale400, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
            <span style={theme.typography.LabelSmall}>Changes · {record?.history.length ?? 0}</span>
            {record?.history.length ? record.history.slice().reverse().map((event, index) => {
              const changed = ([
                ['Name', event.before.name, event.after.name],
                ['Code', event.before.code, event.after.code],
                ['Unit', event.before.unit, event.after.unit],
                ['Description', event.before.description, event.after.description],
              ] as const).filter(([, before, after]) => before !== after);
              const archivedChanged = event.before.archived !== event.after.archived;
              return <SheetRow
                key={`${event.at}-${index}`}
                label={archivedChanged ? event.after.archived ? 'Product archived' : 'Product restored' : 'Product updated'}
                sub={`${new Date(event.at).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })} · ${event.by}`}
                value={<span style={{ ...theme.typography.ParagraphXSmall, display: 'grid', gap: theme.sizing.scale100, maxWidth: 260, textAlign: 'right' }}>{changed.length ? changed.map(([label, before, after]) => <span key={label} style={{ overflowWrap: 'anywhere' }}>{label}: {before || 'Blank'} → {after || 'Blank'}</span>) : archivedChanged ? <span>{event.after.archived ? 'Archived' : 'Active'}</span> : <span>Saved</span>}</span>}
              />;
            }) : <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Product changes show here.</span>}
          </section>
          {!details.archived && <span><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="sku-archive" onClick={() => setArchive(true)}>Archive product</Button></span>}
        </section>
        <ProductInsights
          product={product}
          sales={productSales}
          phone={phone || layout === 'pane'}
          onOpenCustomer={setOpen}
        />
      </div>
      <SKUDetailsEditor
        cast={cast}
        product={rawProduct}
        isOpen={editorStep !== null}
        onClose={() => setEditorStep(null)}
      />
      <WorkflowDialog
        isOpen={archive}
        title="Archive product"
        ariaLabel={`Archive ${product.name}`}
        onClose={() => setArchive(false)}
        testId="sku-archive-dialog"
        actions={<><Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setArchive(false)}>Keep product</Button><Button size={SIZE.compact} data-testid="sku-archive-confirm" onClick={() => changeArchive(true)}>Archive product</Button></>}
      >
        <p style={{ margin: 0, ...theme.typography.ParagraphSmall }}>
          {product.name} will no longer be offered for new orders. Active orders are not changed; past documents and artwork stay available. You can restore it later.
        </p>
      </WorkflowDialog>
      <PriceEntry
        cast={cast}
        targets={runOfOne}
        at={0}
        isOpen={pricingAvailable && entry && !details.archived}
        phone={phone}
        day={day}
        hour={hour}
        onAt={() => {}}
        onClose={() => {
          setEntry(false);
          setTariff(null);
        }}
        initialTier={tariff?.id}
        dictate={() => `${product.name} ${priceEditorAmount(priceOn(cast, product, tiers[0].id, day), country)}`}
      />
      {pricingAvailable && statsTariff && (
        <WorkflowDialog
          isOpen
          title="Price history"
          step={`${product.name} · ${statsTariff.name}`}
          ariaLabel={`Price history for ${statsTariff.name}`}
          onClose={() => setStatsTariff(null)}
          testId={`tariff-stats-modal-${product.id}-${statsTariff.id}`}
          actions={<><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="tariff-history-close" onClick={() => setStatsTariff(null)}>Close</Button>{!details.archived && <Button size={SIZE.compact} onClick={() => { setTariff(statsTariff); setStatsTariff(null); setEntry(true); }}>Set a new price</Button>}</>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
            <div style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
              {tiers.map((tier) => (
                <Button
                  key={tier.id}
                  kind={tier.id === statsTariff.id ? KIND.secondary : KIND.tertiary}
                  size={SIZE.mini}
                  onClick={() => setStatsTariff(tier)}
                >
                  {tier.name}
                </Button>
              ))}
            </div>
            <div
              data-testid={`tariff-history-chart-${product.id}-${statsTariff.id}`}
              data-history-points={history.length}
              data-history-values={history.map((m) => m.price).join(',')}
            >
              {history.length ? (
                <LineChart
                  title={`${statsTariff.name} price`}
                  series={[
                    { name: statsTariff.name, data: history.map((move, x) => ({ x, y: move.price })) },
                  ]}
                  unit={unit}
                  decimals={2}
                  locale={LOCALE}
                  height={phone ? 180 : 220}
                  formatX={(x) => history[Math.round(x)]?.day ?? ''}
                />
              ) : (
                <p style={theme.typography.ParagraphSmall}>
                  Price history starts with this tariff’s first saved price.
                </p>
              )}
            </div>
            {history
              .slice()
              .reverse()
              .map((move, i) => (
                <SheetRow
                  key={i}
                  label={move.day}
                  sub={AUTHOR_WORDS[move.author]}
                  value={
                    <Figure value={move.price} unit={unit} decimals={2} locale={LOCALE} size="compact" />
                  }
                />
              ))}
          </div>
        </WorkflowDialog>
      )}
      {pricingAvailable && <OwnPriceSheet
        cast={cast}
        product={product}
        customer={details.archived ? null : pricing}
        day={day}
        hour={hour}
        onClose={() => setPricing(null)}
      />}
      {open && <CustomerSheetOverlay isOpen onClose={() => setOpen(null)} cast={cast} customer={open} />}
    </div>
  );
}

export type NewcomerSheetProps = {
  cast: Cast;
  /** the words the catalogue has for it */
  name: string;
  /** where it would sit, in the trade's own words */
  place: string;
  /** how Rocoto came to know it — the sentence with the count in it */
  how: React.ReactNode;
  /** Rocoto counted it, so the sentence wears the mark (§1) */
  observed?: boolean;
  /** whatever else is known: the product it rides, the documents that prove it */
  facts?: Array<{ label: React.ReactNode; sub?: React.ReactNode }>;
  /** the one act that makes it a product */
  act: { label: string; onAct: () => void };
  /** Context for a proposed variation. Adoption precedes price and stock writes. */
  priced?: { product: Product; family: Product; day: string; hour: string };
  onBack?: () => void;
  backLabel?: string;
  layout?: 'pane' | 'flow';
};

export function NewcomerSheet({
  cast,
  name,
  place,
  how,
  facts = [],
  act,
  priced,
  onBack,
  backLabel = 'Catalogue',
  layout = 'flow',
}: NewcomerSheetProps) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { pricing: pricingAvailable, inventory } = useWorkspaceCapabilities();
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  const [reviewing, setReviewing] = React.useState(false);
  const [dossierOpen, setDossierOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    setReviewing(false);
    setDossierOpen(false);
    setError('');
  }, [name]);
  const pad = phone ? theme.sizing.scale500 : theme.sizing.scale700;
  const gap = phone ? theme.sizing.scale700 : theme.sizing.scale800;
  const gridColumns = phone || layout === 'pane' ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))';
  const sheetWidth = layout === 'pane' ? '720px' : '1040px';
  return (
    <div
      data-testid="newcomer-sheet"
      data-sku-state="candidate"
      data-layout={layout}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        ...(layout === 'pane' ? { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'clip' } : {}),
        background: theme.colors.backgroundPrimary,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap,
          padding: `${pad} ${pad} ${theme.sizing.scale1600}`,
          width: '100%',
          maxWidth: sheetWidth,
          boxSizing: 'border-box',
          alignSelf: 'center',
          minWidth: 0,
        }}
      >
        {onBack && <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="product-card-back" aria-label={`Back to ${backLabel}`} onClick={onBack} overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', padding: 0 } } }}><Glyph id="back" size={STEP.medium} /></Button>}
        <header
          data-testid="product-head"
          data-product-sheet-block="identity"
          style={{
            display: 'grid',
            gridTemplateColumns: `${phone ? 80 : 104}px minmax(0, 1fr)`,
            alignItems: 'start',
            columnGap: theme.sizing.scale500,
            minWidth: 0,
          }}
        >
          <ProductFace of={{ name, sector: cast.sector }} size={phone ? 80 : 104} />
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
            <h2 style={{ margin: 0, ...theme.typography.HeadingMedium, overflowWrap: 'anywhere' }}>{name}</h2>
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              {place}
            </span>
            <span style={theme.typography.LabelXSmall}>Needs review</span>
          </div>
        </header>
        {priced && (
          <span>
            <Button kind={KIND.tertiary} size={SIZE.mini} aria-label={`Open ${priced.family.name} family`} onClick={() => openProduct(priced.family.id)}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200 }}><Glyph id="back" size={STEP.small} />{priced.family.name} family</span>
            </Button>
          </span>
        )}
        <section data-product-sheet-block="work">
          <SheetPart
            first
            surface="card"
            title="Review product"
            testid="newcomer-how"
          >
            <p style={{ margin: 0, ...theme.typography.ParagraphSmall }}>{how}</p>
            {facts.map((fact, i) => (
              <SheetRow key={i} label={fact.label} sub={fact.sub} />
            ))}
            {reviewing && (
              <div
                data-testid="candidate-review"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.sizing.scale300,
                  padding: theme.sizing.scale500,
                  background: theme.colors.backgroundSecondary,
                  borderRadius: theme.borders.radius300,
                }}
              >
                <span style={theme.typography.LabelMedium}>{name}</span>
                <span style={theme.typography.ParagraphSmall}>
                  Review {name}{priced ? ` · Unit ${priced.product.unit}` : ''} before adding.
                </span>
              </div>
            )}
            {error && <p role="alert">{error}</p>}
            <span>
              <Button
                size={SIZE.compact}
                data-testid="newcomer-act"
                onClick={() => {
                  if (!reviewing) setReviewing(true);
                  else
                    try {
                      act.onAct();
                    } catch {
                      setError(
                        'Adding this product stalled. The source wording is still here; try again.',
                      );
                    }
                }}
              >
                {reviewing ? act.label : 'Review product'}
              </Button>
              {reviewing && (
                <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setReviewing(false)}>
                  Back
                </Button>
              )}
            </span>
          </SheetPart>
        </section>
        {pricingAvailable && <SheetPart testid="newcomer-tarifas" title="Price">
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            Set a price after adding this product.
          </span>
        </SheetPart>}
        {inventoryAvailable && <SheetPart testid="newcomer-stock" title="Stock & lots">
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            Stock and lots start after this product is added.
          </span>
        </SheetPart>}
        <section data-testid="sku-dossier" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale600 }}>
          <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="sku-dossier-toggle" aria-expanded={dossierOpen} aria-controls="sku-dossier-content"
            onClick={() => setDossierOpen((open) => !open)}
            overrides={{ BaseButton: { style: { minHeight: '44px', justifyContent: 'flex-start', paddingLeft: 0, paddingRight: 0 } } }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200 }}><span aria-hidden="true" style={{ display: 'inline-flex', transform: dossierOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}><Glyph id="caret" size={STEP.small} /></span>Source & review history</span>
          </Button>
          {dossierOpen && <div id="sku-dossier-content" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <SheetRow label="Original wording" value={name} />
            <SheetRow label="Catalogue status" value="Awaiting review" />
          </div>}
        </section>
      </div>
    </div>
  );
}

export function NewGoods({
  cast,
  registers,
  onMint,
  onDone,
}: {
  cast: Cast;
  /** §62's parse needs the house's own registers, and this file is not where they are decided */
  registers: ChipRegisters;
  /** the one act: the goods join the catalogue */
  onMint: (items: Array<{ id: string; name: string; unit: string }>, source: 'hand') => void;
  /** the landing has been read — the door may close, or stand open for the next one */
  onDone?: () => void;
}) {
  const [css, theme] = useStyletron();
  const phone = usePhone();

  const [beat, setBeat] = React.useState<'say' | 'seen' | 'landed'>('say');
  const [read, setRead] = React.useState<ChipLine | null>(null);
  const [words, setWords] = React.useState('');
  const [paper, setPaper] = React.useState<string | null>(null);
  const [unitSaid, setUnitSaid] = React.useState('');
  const [landed, setLanded] = React.useState('');
  const unitRef = React.useRef<HTMLInputElement | null>(null);

  /* ── WHAT THE SENTENCE CAME TO ────────────────────────────────────────────────────────────
   * The goods are every word that is not a count — a product is a THING and never a quantity, so
   * the amount the parser found is dropped rather than written into a name (§109.2's own
   * grammar, and the reason the door takes the trade's whole sentence in one field). */
  const goods = React.useMemo(
    () =>
      (read?.chips ?? [])
        .filter((c) => c.part !== 'quantity' && c.part !== 'unit')
        .map((c) => c.said)
        .join(' ')
        .trim(),
    [read],
  );
  const id = goods
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const unit = (unitSaid.trim() || read?.unit || 'kg').trim();
  const captured = id.length > 0;

  const reset = () => {
    setBeat('say');
    setRead(null);
    setWords('');
    setPaper(null);
    setUnitSaid('');
  };

  /* ONE THING AT A TIME INSIDE THE REVEAL (§115.1 · §76): the name was just answered, so the
     caret goes to its Unit without anybody reaching for a pointer. */
  React.useLayoutEffect(() => {
    if (beat !== 'seen') return;
    unitRef.current?.focus();
    unitRef.current?.select();
  }, [beat]);

  const put = () => {
    if (!captured) return;
    onMint([{ id, name: goods, unit }], 'hand');
    setLanded(goods);
    setBeat('landed');
  };

  /* THE REVEAL ARRIVES; IT DOES NOT JUMP IN (§59.1). Paint only — opacity and a 6px rise — so no
     layout is being animated, and a reader who asked for less motion gets no travel at all. */
  const revealed = css({
    animationName: {
      from: { opacity: 0, transform: 'translateY(6px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    } as unknown as string,
    animationDuration: theme.animation.timing400,
    animationTimingFunction: theme.animation.easeOutCurve,
    animationFillMode: 'both',
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0ms' },
  });

  /** a column of the reveal: the label names the thing, the value carries the weight (§51.24) */
  const column = (name: string, testid: string, grow: number, lead: boolean, body: React.ReactNode) => (
    <span
      data-testid={testid}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: lead ? 'flex-start' : 'center',
        gap: theme.sizing.scale100,
        flex: `${grow} 1 0`,
        minWidth: 0,
      }}
    >
      <span
        style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}
      >
        {name}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          justifyContent: lead ? 'flex-start' : 'center',
          minWidth: 0,
        }}
      >
        {body}
      </span>
    </span>
  );

  const seat = (
    testid: string,
    label: string,
    value: string,
    onValue: (next: string) => void,
    extra?: {
      ref?: React.MutableRefObject<HTMLInputElement | null>;
      end?: React.ReactNode;
      mode?: 'decimal' | 'text';
    },
  ) => (
    <Input
      size={INPUT_SIZE.compact}
      value={value}
      placeholder="—"
      aria-label={label}
      inputRef={extra?.ref}
      endEnhancer={extra?.end}
      onChange={(e) => onValue((e.target as HTMLInputElement).value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && captured) {
          e.preventDefault();
          put();
        }
      }}
      overrides={{
        Input: { props: { 'data-testid': testid, inputMode: extra?.mode ?? 'text' } },
        Root: { style: { width: '100%' } },
        EndEnhancer: {
          style: {
            ...theme.typography.LabelXSmall,
            whiteSpace: 'nowrap',
            backgroundColor: 'transparent',
            paddingLeft: theme.sizing.scale100,
            paddingRight: theme.sizing.scale300,
          },
        },
      }}
    />
  );

  if (beat === 'landed') {
    /* ── BEAT 3 · IT LANDS (§115.5's shape, on this door's own subject) ──────────────────────
       One scene, centred, and it NAMES WHAT LANDED. Nothing asks whether they were sure, and no
       progress bar stands anywhere near it (§115.3). */
    return (
      <div
        data-testid="new-goods-landed"
        data-goods={landed}
        className={revealed}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: theme.sizing.scale500,
          padding: `${theme.sizing.scale900} ${theme.sizing.scale600}`,
          minWidth: 0,
        }}
      >
        <Face name={landed} family={familyMarkOf(cast.sector)} size={phone ? 88 : 112} />
        <span style={{ ...theme.typography.HeadingSmall, minWidth: 0 }}>{landed} is in your catalogue</span>
        <Button
          kind={KIND.secondary}
          size={SIZE.compact}
          data-testid="new-goods-done"
          onClick={() => {
            reset();
            onDone?.();
          }}
        >
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div
      data-testid="new-goods"
      data-beat={beat}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
    >
      {beat === 'say' ? (
        /* ── BEAT 1 · THE FIELD, AND NOTHING ELSE (§115.1 · §116.2) ────────────────────────
           The albarán's own organ, given this house's registers — so the parse, the offers'
           dropdown, the Rocoto face, the ↵ button and the keys are ONE implementation on both
           surfaces and cannot drift apart again (§62.4). */
        <ChipEntry
          registers={registers}
          family={familyMarkOf(cast.sector)}
          autoFocus
          label="What the goods are called"
          initial={words}
          data-testid="new-goods-chips"
          document={paper}
          /* THE PHOTOGRAPH, AT THE NAME MOMENT (§111.2 · §113). The picture is evidence; this
             door has no reader wired to it yet, so it takes the file and says nothing, and the
             words stay exactly as they are. When a reader lands, the sentence it returns
             populates these same words in place and nothing on this surface changes. */
          onPhotograph={(picture) => {
            setPaper(picture.name);
          }}
          onChange={(next) => {
            setRead(next);
            setWords(next.said ?? '');
          }}
          onCommit={(next) => {
            if ((next.said ?? '').trim() === '') return;
            setRead(next);
            setWords((next.said ?? '').trim());
            setBeat('seen');
          }}
        />
      ) : (
        /* ── BEAT 2 · THE REVEAL, COLUMNIZED (§116.2's finished form) ──────────────────────── */
        <div
          className={revealed}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.sizing.scale500,
            minWidth: 0,
          }}
        >
          <div
            data-testid="new-goods-columns"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: phone ? theme.sizing.scale400 : theme.sizing.scale700,
              flexWrap: 'wrap',
              width: '100%',
              minWidth: 0,
            }}
          >
            {/* COLUMN 1 · THE GOODS — type and sort in one (§116.2).
                ⚠ A CLASS SEAT STOOD SMALL BENEATH IT until FEED-IA §197.2 «Remove class
                everywhere»: what the market sells by is in the words themselves, in the SKU. */}
            {column(
              'Type',
              'new-goods-col-name',
              3,
              true,
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.sizing.scale200,
                  width: '100%',
                  minWidth: 0,
                }}
              >
                <button
                  type="button"
                  data-testid="new-goods-name"
                  aria-label="The words on this product"
                  onClick={() => setBeat('say')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.sizing.scale300,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    minWidth: 0,
                    maxWidth: '100%',
                  }}
                >
                  <Face name={read?.node ? read.face : null} family={familyMarkOf(cast.sector)} size={32} />
                  <span
                    style={{
                      ...theme.typography.LabelMedium,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                  >
                    {goods}
                  </span>
                </button>
              </span>,
            )}

            {/* COLUMN 2 · ITS UNIT. A product has no quantity — it has the unit its
                lines are counted in, which is the one fact a title may leave out (§62.3). */}
            {column(
              'Unit',
              'new-goods-col-unit',
              1,
              false,
              seat('new-goods-unit', 'Unit', unit, setUnitSaid, { ref: unitRef }),
            )}

            {/* A newborn product has no persisted price writer in this primitive. Do not show a
                field whose value would disappear; pricing starts on its real product sheet. */}
          </div>

          {/* THE ACT, AND IT IS THE SAME ACT ENTER RUNS. «Continue» is his word and never «Next»
              (§108.1); nothing stands after it and nothing asks whether they are sure (§115.3). */}
          <Button
            kind={KIND.primary}
            size={SIZE.compact}
            disabled={!captured}
            data-testid="new-goods-continue"
            onClick={put}
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
