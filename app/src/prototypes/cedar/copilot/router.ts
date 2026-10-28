/* THE ROAD TO THE MIND, AND THE POSTURE FOR WHEN THERE IS NONE (FEED-IA §196.2 · E198.11).
 *
 * ═══ WHAT CHANGED, AND IT IS THE WHOLE OF E198 ══════════════════════════════════════════════
 * This file used to BE the agent's answer: a keyword table — `hay.includes('short')` — with one
 * fixed sentence at the end of it. §196.2 asks for «the same shit like all top agents», and a top
 * agent has a mind. The mind lives in the kit runtime now (`backend/app/copilot.py`), behind
 * `runtime.copilot.ask`, and `ask()` below is the road to it.
 *
 * ═══ THE TWO POSTURES, AND WHY THE TABLE STAYS ══════════════════════════════════════════════
 * LIVE      · the runtime answers. The reply is the mind's own words and the proposals are
 *             GROUNDED server-side against the context that was sent, so every order a proposal
 *             names is an order on this desk's book.
 * OFFLINE   · there is no runtime, or it answered a failure. The Copilot SAYS which flows it can
 *             still run and runs them: `answer()` below — the keyword table, kept whole, doing
 *             exactly the job it did before, now as the honest posture rather than as the agent.
 *
 * The offline reply never pretends. It states what it reads and offers the two flows it owns; the
 * cards it mounts do real work with or without a runtime, because they always did.
 *
 * ⚠ THE THINKING STATE IS HONEST NOW. This file's old header said a «pensando…» shimmer «arrives
 * with the runtime, not before it», because a picture of work that is not happening is a lie. The
 * runtime is here, so the wait is real and the surface may show it (`surface.tsx`).
 */
import type { Cast } from '../../../scenarios/data/cast';
import type { Product } from '../../../scenarios/data/cast';
import type { Sale } from '../sale';
import type { SupplyIssue } from '../incoming';
import type { Activity, CopilotCard, CopilotMessage } from './types';
import type {
  CopilotAnswer, CopilotContext, CopilotContextOrder, CopilotProposal, CopilotSessionMessage,
} from '../runtime-client';
import { runtime } from '../runtime-client';
import { CONTEXT_CAPS } from './context';
import { uid } from './store';
import { workspaceAnswer } from './workspace-answer';

export type Reading = {
  cast: Cast;
  products: Product[];
  sales: Sale[];
  issues: SupplyIssue[];
  today: string;
};

const norm = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const CATALOGUE_WORDS = ['categor', 'catalog', 'catalogue', 'family', 'familia', 'classif', 'shelf'];
const SUPPLY_WORDS = ['short', 'shortage', 'missing', 'supply', 'out of', 'ran out', 'no stock', 'sin stock', 'falta'];

/** the longest tenant product name the sentence contains — longest wins, so «gamba roja» beats «gamba» */
export function productIn(text: string, products: Product[]): Product | undefined {
  const hay = norm(text);
  let best: Product | undefined;
  for (const product of products) {
    const name = norm(product.name);
    if (name.length >= 3 && hay.includes(name) && (!best || name.length > norm(best.name).length)) best = product;
  }
  return best;
}

/** the customer the sentence names, by the name their account carries */
export function customerIn(text: string, sales: Sale[]): Sale['customer'] | undefined {
  const hay = norm(text);
  let best: Sale['customer'] | undefined;
  for (const sale of sales) {
    const name = norm(sale.customer.name);
    if (name.length >= 3 && hay.includes(name) && (!best || name.length > norm(best.name).length)) best = sale.customer;
  }
  return best;
}

const trail = (id: string, label: string, summary: string, detail: string[], status: Activity['status'] = 'complete'): Activity =>
  ({ id, label, summary, detail, status });

const turn = (text: string, activity: Activity[], card?: CopilotCard): CopilotMessage => ({
  id: uid('turn'), at: new Date().toISOString(), role: 'copilot', text, activity, ...(card ? { card } : {}),
});

/** the open orders that ask for these goods today */
export function ordersFor(product: Product, sales: Sale[], today: string): Array<{ sale: Sale; asked: number; unit: string }> {
  const rows: Array<{ sale: Sale; asked: number; unit: string }> = [];
  for (const sale of sales) {
    if (sale.day !== today) continue;
    const lines = sale.lines.filter((line) => line.product.id === product.id && !line.off);
    if (!lines.length) continue;
    const asked = lines.reduce((sum, line) => sum + (line.given ?? line.ordered), 0);
    if (asked > 0) rows.push({ sale, asked, unit: lines[0].unit });
  }
  return rows;
}

/**
 * THE OFFLINE POSTURE. One turn, its evidence, and — where the sentence asks for work the agent
 * can do — the CARD that does it, mounted in the same turn. Every reply is derived from the
 * tenant's own records this build already holds, which is why it stands on its own when the mind
 * behind the runtime is out of reach.
 */
export function answer(text: string, reading: Reading): CopilotMessage {
  const { products, sales, issues, today } = reading;
  const hay = norm(text);
  const product = productIn(text, products);
  const customer = customerIn(text, sales);
  const wantsCatalogue = CATALOGUE_WORDS.some((word) => hay.includes(word));
  const wantsSupply = SUPPLY_WORDS.some((word) => hay.includes(word));
  const operational = !wantsSupply && !wantsCatalogue ? workspaceAnswer(text, sales, today) : undefined;
  if (operational) return { ...turn(operational.text, operational.activity), proposals: operational.proposals };

  /* 1 · A CATEGORY QUESTION opens the correction, with the named product already in it. */
  if (wantsCatalogue) {
    return turn(
      product
        ? `${product.name} sits in this catalogue’s own tree. Choose where it belongs and say why — the correction is yours to save.`
        : 'Pick the product whose category is wrong, then the corrected one and the reason. Prices, stock and orders stay as they are.',
      [trail('catalogue', 'Catalogue', product ? product.name : `${products.length} products`, product ? [product.name] : ['The correction reads this tenant’s own catalogue.'])],
      { kind: 'catalogue-review' },
    );
  }

  /* 2 · A NAMED PRODUCT is answered from the day's book, and the report is one press away. */
  if (product) {
    const orders = ordersFor(product, sales, today);
    const asked = orders.reduce((sum, row) => sum + row.asked, 0);
    const issue = issues.find((row) => row.product === product.id);
    const line = orders.length
      ? `${product.name}: ${asked} ${orders[0].unit} on ${orders.length === 1 ? 'one open order' : `${orders.length} open orders`} for today.`
      : `${product.name} is clear of open orders today.`;
    const short = issue ? ` The ledger reads ${issue.short} ${issue.unit} short against ${issue.standing} ${issue.unit} available.` : '';
    return turn(
      `${line}${short} Report what the floor actually has and I will lay the affected orders out.`,
      [
        trail('orders', 'Open orders', orders.length ? `${orders.length}` : 'none', orders.map((row) => `${row.sale.number} · ${row.sale.customer.name} · ${row.asked} ${row.unit}`)),
        issue
          ? trail('ledger', 'Stock and orders', `${issue.short} ${issue.unit} short`, [issue.method])
          : trail('ledger', 'Stock and orders', 'the ledger is square', ['The ledger reads square for these goods today.']),
      ],
      { kind: 'supply-report' },
    );
  }

  /* 3 · A NAMED CUSTOMER is answered with their own book. */
  if (customer) {
    const theirs = sales.filter((sale) => sale.customer.id === customer.id && sale.day === today);
    return turn(
      theirs.length
        ? `${customer.name} has ${theirs.length === 1 ? 'one order' : `${theirs.length} orders`} on today’s book.`
        : `${customer.name}’s book is clear today.`,
      [trail('customer', 'Their orders', theirs.length ? `${theirs.length}` : 'none', theirs.map((sale) => `${sale.number} · ${sale.lines.length} lines · ${sale.state}`))],
    );
  }

  /* 4 · «WHAT IS SHORT» reads the shortage ledger itself. */
  if (wantsSupply || hay.includes('today')) {
    const named = issues.slice(0, 6).map((issue) => {
      const found = products.find((item) => item.id === issue.product);
      return `${found?.name ?? issue.product} · ${issue.short} ${issue.unit} short`;
    });
    return turn(
      issues.length
        ? `The ledger reads ${issues.length === 1 ? 'one shortage' : `${issues.length} shortages`} against today’s book. Report one and I will lay the affected orders out.`
        : 'Today’s book is covered by the ledger. Report anything the floor sees differently.',
      [trail('shortages', 'Shortages on the ledger', issues.length ? `${issues.length}` : 'none', named.length ? named : ['Every open line has stock behind it on the ledger.'])],
      { kind: 'supply-report' },
    );
  }

  /* 5 · ANYTHING ELSE says what this agent reads, and keeps the words in the session. */
  return turn(
    `There are ${sales.filter(sale => sale.day === today && !sale.messageOnly && !sale.archived).length} orders on today’s book. Which customer, product or delivery would you like to look at?`,
    [trail('records', 'What I read', `${sales.length} orders · ${products.length} products`, [
      `${sales.length} orders on the book`,
      `${products.length} products in the catalogue`,
      `${issues.length} shortages on the ledger`,
    ], 'complete')],
  );
}


/* ── THE ROAD TO THE RUNTIME (E198.11) ────────────────────────────────────────────────────────
 * One call, one turn back. What the surface hands over is the desk (`context.ts`) and the session
 * so far; what comes back is the mind's reply, its proposals and the evidence of the call.
 *
 * A FAILURE IS A POSTURE, NOT AN ERROR THE PERSON HAS TO READ. `runtime.copilot.ask` throws two
 * ways — the runtime is unreachable, or it answered a failure — and both land in the same place:
 * the Copilot says what it can still do and does it, off the table above. Nothing is fabricated
 * and nothing is swallowed: the journal carries the reason, the person carries the flows.
 */

/** THE SENTENCE THE OFFLINE POSTURE OPENS WITH, so the person knows which Copilot they have.
 *  ⚠ IT IS THE ONLY PLACE THAT SAYS IT. The keyword table's own fallback used to open with the
 *  same fact, and a turn that states what it reads twice reads like a machine repeating itself. */
export const OFFLINE_NOTE =
  'I am answering from this desk’s own records: today’s orders, the shortage ledger and the catalogue.';

const proposalTrail = (proposals: CopilotProposal[], orders: CopilotContextOrder[]): Activity[] => {
  const named = new Set<string>();
  for (const proposal of proposals) {
    if (proposal.kind === 'supply-report') proposal.orderIds.forEach((id) => named.add(id));
    if (proposal.kind === 'drafts') proposal.drafts.forEach((draft) => named.add(draft.orderId));
    if (proposal.kind === 'open-order') named.add(proposal.orderId);
  }
  if (!named.size) return [];
  const rows = [...named].map((id) => {
    const order = orders.find((one) => one.id === id);
    return order ? `${order.number} · ${order.customer}` : id;
  });
  return [trail('proposed', 'Orders this touches', `${rows.length}`, rows)];
};

/** THE MIND'S TURN, in the kit's own object. */
export function turnOf(answered: CopilotAnswer, orders: CopilotContextOrder[]): CopilotMessage {
  const report = answered.proposals.find((one) => one.kind === 'supply-report');
  return {
    id: uid('turn'),
    at: new Date().toISOString(),
    role: 'copilot',
    text: answered.reply.text,
    activity: proposalTrail(answered.proposals, orders),
    proposals: answered.proposals,
    evidence: answered.evidence,
    /* THE CARD IS THE SURFACE'S OWN, UNCHANGED. A supply-report proposal mounts the report form
       that was already there — the mind slots in behind the surface rather than beside it. */
    ...(report ? { card: { kind: 'supply-report' as const } } : {}),
  };
}

/** WHAT THE OFFLINE POSTURE SAYS FIRST, then the flow it can still run for this sentence. */
export function offlineTurn(text: string, reading: Reading): CopilotMessage {
  const turn = answer(text, reading);
  return { ...turn, activity: [trail('answer-basis', 'Workspace records', 'Local reading', [OFFLINE_NOTE]), ...(turn.activity || [])] };
}

/**
 * ASK. The live road, with the offline posture as its answer to any failure.
 *
 * It returns the TURN rather than appending it, because the session store is the surface's to
 * write: one append of the person's words and the agent's answer keeps the revision guard's
 * arithmetic exactly as it was before a mind existed (`store.ts`).
 */
export async function ask(a: {
  text: string;
  reading: Reading;
  context: CopilotContext;
  sessionId: string;
  history: CopilotMessage[];
}): Promise<{ turn: CopilotMessage; posture: 'live' | 'offline' }> {
  const messages: CopilotSessionMessage[] = a.history.slice(-CONTEXT_CAPS.messages).map((message) => ({
    role: message.role === 'copilot' ? 'copilot' : 'person',
    text: message.text,
    at: message.at,
  }));
  let answered: CopilotAnswer;
  try {
    answered = await runtime.copilot.ask({
      session: { id: a.sessionId, messages },
      context: a.context,
      ask: a.text,
    });
  } catch {
    /* THE REASON IS THE BROWSER'S TO REPORT, NOT THE PERSON'S TO READ. `runtime-client` already
       threw a named error; the person gets the flows this build can run without a mind.
       ⚠ ONLY THE CALL IS INSIDE THE TRY. A catch wrapped around the turn-building below would
       turn any bug in this file into a silent «offline», which is the shape of a defect nobody
       ever finds — the offline posture is for a runtime that is out of reach, and nothing else. */
    return { turn: offlineTurn(a.text, a.reading), posture: 'offline' };
  }
  return { turn: turnOf(answered, a.context.orders), posture: 'live' };
}
