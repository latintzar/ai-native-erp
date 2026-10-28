/* WHAT THE COPILOT IS LOOKING AT (FEED-IA §196.2 · E198.11).
 *
 * The mind in the runtime may state NOTHING it was not given, which makes this file the whole
 * boundary of what the agent knows. It reads the desk as it stands — the day, the area a person is
 * in, the document open in front of them, the day's own orders with the flags Rocoto raised, the
 * shortage ledger, and the customer in hand — and hands it over as the `CopilotContext` the
 * runtime's contract types.
 *
 * ⚠ IT IS ASSEMBLED FROM THE SURFACES THE KIT ALREADY HAS, and that is deliberate. Every figure
 * below already appears somewhere a person can look at: `useSupplyIssues` is the same fold the
 * stock screen draws, `flagsOf` is the same judgement the river's rows wear, and the open document
 * is the one in the address bar. So a reply that names «A-2452 · 40 kg» names a row the person can
 * go and check — which is the difference between an agent and a plausible sentence.
 *
 * THE CAPS ARE HERE AND ON THE RUNTIME. This file cuts to the contract's own numbers so a phone on
 * a bad connection sends a small request; the runtime cuts again, because a cap that lives only on
 * the client is a cap a different client does not have.
 */
import type { Cast, Product } from '../../../scenarios/data/cast';
import type { CopilotContext, CopilotContextOrder, CopilotContextStock } from '../runtime-client';
import type { Sale } from '../sale';
import { RANK, flagText, flagsOf, isStanding } from '../sale';
import type { IncomingEvent, SupplyIssue } from '../incoming';
import { expectedOf, fold, rowsOf } from '../incoming';
import type { Rule } from '../rules';

/** the contract's own ceilings — stated once, read by the assembly below */
export const CONTEXT_CAPS = { orders: 40, stock: 60, lines: 30, messages: 20 } as const;

/** THE AREA IS THE ADDRESS, because that is where the app already keeps it: `#/sales/s-101` is the
 *  sales area holding one order, and no second copy of «where am I» can drift from it. */
export function areaOf(hash: string): string {
  return hash.replace(/^#\/?/, '').split('/')[0] || 'sales';
}

/** the id in the address, for the object that lives in this area — the open document, or nothing */
export function openOrderId(hash: string): string {
  const path = hash.replace(/^#\/?/, '');
  return path.startsWith('sales/') ? path.slice('sales/'.length).split('/')[0] : '';
}

const lineRows = (sale: Sale, prices: boolean) =>
  sale.lines
    .filter((line) => !line.off)
    .slice(0, CONTEXT_CAPS.lines)
    .map((line) => ({
      product: line.product.name,
      qty: line.given ?? line.ordered,
      unit: line.unit,
      ...(prices ? { price: line.price } : {}),
    }));

/** THE DAY'S OWN BOOK: the orders for this day that have yet to leave the house, plus the standing
 *  orders that fall on it — the same two rules the supply review already allocates against. */
export function ordersOf(sales: Sale[], today: string): CopilotContextOrder[] {
  return sales
    .filter((sale) => RANK[sale.state] < RANK.sent && (sale.day === today || isStanding(sale, today)))
    .slice(0, CONTEXT_CAPS.orders)
    .map((sale) => ({
      id: sale.id,
      number: sale.number,
      customer: sale.customer.name,
      customerId: sale.customer.id,
      state: sale.state,
      flags: flagsOf(sale).map(flagText),
      lines: lineRows(sale, false),
    }));
}

/** THE FLOOR, WORST FIRST. A shortage is what a person acts on, so the products the book is over
 *  the floor on lead; the rest of the catalogue follows in its own order, and only where somebody
 *  or some rule has actually spoken for the level (`fold`'s `voice` — the same guard `issueOf`
 *  keeps, and the reason this app does not report a house 1.567 kg short on an ordinary morning). */
export function stockOf(a: {
  products: Product[];
  ledger: IncomingEvent[];
  issues: SupplyIssue[];
  rules: Rule[];
  now: Date;
}): CopilotContextStock[] {
  const worstFirst = [
    ...a.issues.map((issue) => issue.product),
    ...a.products.map((product) => product.id),
  ];
  const seen = new Set<string>();
  const rows: CopilotContextStock[] = [];
  for (const id of worstFirst) {
    if (seen.has(id) || rows.length >= CONTEXT_CAPS.stock) continue;
    seen.add(id);
    const product = a.products.find((item) => item.id === id);
    if (!product) continue;
    const standing = fold(rowsOf(a.ledger, id));
    if (!standing.voice) continue;
    const expected = expectedOf(a.rules, id, a.now);
    rows.push({
      product: product.name,
      available: Math.round(standing.standing * 100) / 100,
      unit: product.unit,
      ...(expected
        ? { expected: `the rule announces ${expected.level} ${expected.unit} on ${expected.day} at ${expected.replenishAt}` }
        : {}),
    });
  }
  return rows;
}

/** The whole of it, from the state the Copilot's host already holds. */
export function askContext(a: {
  cast: Cast;
  products: Product[];
  sales: Sale[];
  issues: SupplyIssue[];
  ledger: IncomingEvent[];
  rules: Rule[];
  today: string;
  now: Date;
  hash: string;
}): CopilotContext {
  const open = openOrderId(a.hash);
  const document = open ? a.sales.find((sale) => sale.id === open) : undefined;
  return {
    day: a.today,
    area: areaOf(a.hash),
    document: document
      ? {
        number: document.number,
        customer: document.customer.name,
        state: document.state,
        lines: lineRows(document, true),
      }
      : null,
    orders: ordersOf(a.sales, a.today),
    stock: stockOf({ products: a.products, ledger: a.ledger, issues: a.issues, rules: a.rules, now: a.now }),
    /* THE CUSTOMER IN HAND is the one whose document is open. The chats panel stands down while
       the agent is up (`shell/chats.tsx` reads the visibility event), so «the customer of the open
       conversation» and «the customer of the open document» are the same person whenever there is
       one at all — and the document is the copy the agent can point at. */
    customer: document
      ? { name: document.customer.name, tariff: document.customer.tier }
      : null,
  };
}
