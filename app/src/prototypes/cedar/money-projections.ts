import { invoiceBalance, isCollectible, peruDate, receiptEffectiveAt, type MoneyState } from './money-model';
import { moneyNow, moneyWorkspace, type MoneySourceSale } from './money-seed';

/** SALES' OWN WORDS, HELD APART FROM MONEY'S (MONEY-SPEC «Money states»). `scheduled` here is a
 *  DELIVERY a person planned in Sales; it never names a repayment or an invoice. Money's own
 *  vocabulary is `MONEY_STATUS_WORDS` in money-model, and the word «Scheduled» is absent from it,
 *  because one word naming two lifecycles is exactly what Peter read on the working-capital card
 *  (FEED-IA §247.6). A sale in one of these states is money the seller still expects. */
export const PROJECTED_SALE_STATES = ['committed', 'made', 'scheduled', 'sent', 'delivered'] as const;

export type MoneyPoint = { at: string; amountMinor: number };
export type MoneyProjectionSource = { saleId: string; invoiceId?: string; at: string; amountMinor: number };

/** Account balance is the retained opening balance plus matched bank receipts through now.
 * Manual/cash evidence can settle an invoice, but only bank evidence changes this account. */
export function projectMoney(state: MoneyState, sales: MoneySourceSale[]) {
  const workspace = moneyWorkspace(state.scope);
  // The sample clock advances with actions; later receipts are included as they are recorded.
  const through = Date.parse(moneyNow(state));
  const bank = state.receipts.filter(receipt => receipt.source === 'demo-bank' && receipt.method !== 'cash'
    && receipt.status === 'matched' && receipt.currency === 'PEN' && Date.parse(receiptEffectiveAt(receipt)) <= through);
  const bankBalanceMinor = workspace.openingBalanceMinor + bank.reduce((sum, receipt) => sum + receipt.amountMinor, 0);
  const today = peruDate(new Date(through).toISOString());
  const dailyHistory: MoneyPoint[] = Array.from({ length: 90 }, (_, index) => ({
    at: new Date(Date.parse(`${today}T12:00:00Z`) + (index - 89) * 86400000).toISOString().slice(0, 10), amountMinor: 0,
  }));
  const daily = new Map(dailyHistory.map(point => [point.at, point]));
  for (const receipt of bank) {
    const point = daily.get(peruDate(receiptEffectiveAt(receipt)));
    if (point) point.amountMinor += receipt.amountMinor;
  }
  const history = dailyHistory.slice(-14);
  const forecast: MoneyPoint[] = Array.from({ length: 7 }, (_, index) => ({
    at: new Date(Date.parse(`${today}T12:00:00Z`) + (index + 1) * 86400000).toISOString().slice(0, 10), amountMinor: 0,
  }));
  const forecastSources: MoneyProjectionSource[] = [];
  const add = (source: MoneyProjectionSource) => {
    const bucket = forecast.find(point => point.at === source.at);
    if (!bucket || !Number.isSafeInteger(source.amountMinor) || source.amountMinor <= 0) return;
    bucket.amountMinor += source.amountMinor;
    forecastSources.push(source);
  };
  const invoiced = new Set(state.invoices.map(invoice => invoice.saleId));
  for (const invoice of state.invoices) {
    if (isCollectible(invoice) && invoice.currency === 'PEN')
      add({ saleId: invoice.saleId, invoiceId: invoice.id, at: invoice.dueAt, amountMinor: invoiceBalance(state, invoice.id) });
  }
  for (const sale of sales) {
    if (invoiced.has(sale.id) || sale.messageOnly || sale.archived || !sale.lines.length || !sale.customer.id
      || !PROJECTED_SALE_STATES.includes((sale.state ?? '') as typeof PROJECTED_SALE_STATES[number])) continue;
    add({ saleId: sale.id, at: sale.day, amountMinor: Math.round(sale.figure * 100) });
  }
  return { referenceAt: new Date(through).toISOString(), openingBalanceMinor: workspace.openingBalanceMinor,
    fxRate: workspace.fxRate, bankBalanceMinor, history, dailyHistory, forecast, forecastSources };
}
