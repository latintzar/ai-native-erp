import { solesRate } from './currency';
/** Deterministic preview only. Sending and price acceptance require their own reviewed command. */
import type { AppConfig } from './config';
import type { Grants } from './grants';
import { bandOf, customerHistoryOf, priceHistoryOf, type PriceStamp } from './tiers';
import type { Cast, Customer, Product } from '../../scenarios/data/cast';
import type { Sale } from './sale';
import { customerOptionText } from './customer-option';

export function confirmationPriceMode(config: AppConfig, grants: Pick<Grants, 'confirm'>): 'off' | 'without-prices' | 'with-prices' {
  if (!grants.confirm) return 'off';
  return config.confirmation.includePrices && config.albaran.values === 'valued' ? 'with-prices' : 'without-prices';
}

/** A quotation needs an actual current price, never seeded arithmetic or an old tariff fallback. */
export function confirmationRate(cast: Cast, product: Product, customer: Customer, day: string) {
  // Histories are newest-write first; effective date wins over late imports of older prices.
  const latestAsOf = (history: PriceStamp[]) => history.reduce<PriceStamp | undefined>((held, item) =>
    item.day <= day && (!held || item.day > held.day) ? item : held, undefined);
  const personal = latestAsOf(customerHistoryOf(product, customer));
  const stamp = personal ?? latestAsOf(priceHistoryOf(product, bandOf(cast, customer)));
  if (!stamp || stamp.day !== day || !Number.isFinite(stamp.price) || stamp.price <= 0) return null;
  return { amount: stamp.price, unit: product.unit, stamp: stamp.id, day: stamp.day };
}

export function confirmationPreview(sale: Pick<Sale, 'customer' | 'deliveryDay'> & { lines: Array<Pick<Sale['lines'][number], 'product' | 'ordered' | 'unit' | 'customerOption'>> }, cast: Cast, config: AppConfig, grants: Pick<Grants, 'confirm'>, day: string): string {
  const mode = confirmationPriceMode(config, grants);
  if (mode === 'off') return 'Order received. Your team will confirm it.';
  const lines = sale.lines.map(line => {
    const option = customerOptionText(line);
    const words = `${line.ordered} ${line.unit} ${line.product.name}${option ? ` — ${option}` : ''}`;
    if (mode !== 'with-prices') return words;
    const rate = confirmationRate(cast, line.product, sale.customer, day);
    return `${words}${rate ? ` · ${solesRate(rate.amount, rate.unit)}` : ' · Price to confirm'}`;
  });
  const pending = mode === 'with-prices' && sale.lines.some(line => !confirmationRate(cast, line.product, sale.customer, day));
  return `${pending ? 'Order received' : 'Confirmed'} for ${sale.deliveryDay}:\n${lines.join('\n')}${pending ? '\nWe will confirm the missing prices before proceeding.' : ''}`;
}

