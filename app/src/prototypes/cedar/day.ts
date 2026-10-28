/* THE DAY, DERIVED — APP-A's one answer to «what does today contain».
 *
 * ═══ WHY THIS FILE EXISTS ══════════════════════════════════════════════════════════════════
 * Today and Orders are the same day seen twice: Today is the day as a spine, Orders is the same
 * orders as a working surface. If each area built its own day they would disagree the moment a
 * person confirmed something on one of them, and the prototype's central claim — that the app IS
 * the day's journey to a correct albarán — would be a claim about two different days.
 *
 * So the day is built ONCE, here, out of `data/cast.ts` and nothing else (law 10: no name is
 * typed into a screen), and the edits a person makes to it live in ONE store that both areas
 * read. Confirm an order on Today and it is confirmed in Orders; put the arriving order in the
 * queue on Today and Orders has it.
 *
 * ═══ WHAT THE CONFIG DECIDES HERE, AND WHAT IT NEVER DECIDES ═══════════════════════════════
 * `gate.mode` decides WHICH of today's orders are waiting on the person by default — the queue's
 * default view — and nothing else. Every order still exists, every order is still openable, and
 * the whole queue is one press from the flagged one. That is the blend law at the data layer:
 * the answer sets the default, never the population.
 *
 * A line's own exception outranks the mode, and says so on its own row: a line waiting on an
 * answer cannot proceed on any configuration, so it is held under every gate. That is the same
 * shape the slot queue already uses — one primitive, two reasons, each row saying which one put
 * it there.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';
import type { Cast, Customer, Order, OrderLine, Product } from '../../scenarios/data/cast';
import { customerOf, productOf, scatter } from '../../scenarios/data/cast';
import { priceOf } from '../../scenarios/canonical/resolution';
import { buildRound } from '../../scenarios/canonical/drop-list';
import type { Derived } from './config';
/* type-only, so the ledger's shape lives with the object that owns it and no cycle exists */
import type { SaleEvent, TheatreOrigin } from './sale';
import { approvedCustomerOption } from './customer-option';
import { LEGACY_EUR_TO_PEN, seedSoles, soles } from './currency';
import { CEDAR_DAY_PEN_VERSION, migrateDayCurrency } from './currency-migration';
import { cedarSourceCast } from './cedar-cast';

/* ── THE CLOCK ────────────────────────────────────────────────────────────────────────────────
 * The morning turns on at the cast's own hour — the lonja at 05:00, the meat room at 08:00 — so
 * every time in the app is that hour plus a number of minutes. Change the cast and the whole day
 * moves with it, which is exactly what a fish house and a meat house should look like.
 */

const HHMM = /^(\d{1,2}):(\d{2})$/;

export function clockAfter(hour: string, minutes: number): string {
  const m = HHMM.exec(hour);
  const base = m ? Number(m[1]) * 60 + Number(m[2]) : 6 * 60;
  const t = ((base + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/* ── THE DAY'S ORDERS ─────────────────────────────────────────────────────────────────────── */

/** One order in today's list. The cast's own order is one of these; the other four are built from
 *  the same catalogue, so a morning is dense the way a real morning is dense. */
export type DayOrder = {
  /** the customer is the key — an order is a customer and a delivery day (C-19) */
  id: string;
  customer: Customer;
  order: Order;
  total: number;
  /** the hour it reached the desk */
  at: string;
  /** the line that is waiting on an answer, where there is one (U01) */
  unresolved?: string;
  /** the customer changed it after it was recorded (U11) */
  changed?: { raised: OrderLine; dropped: OrderLine; more: number; at: string };
  /** this is the one arriving right now: it is on the capture surface, not yet in the queue */
  arriving?: boolean;
};

export const totalOf = (lines: OrderLine[]): number =>
  lines.reduce((sum, l) => sum + l.qty * l.price, 0);

/** How much more of the raised line the customer now wants. A quantity, never a name. */
export const MORE = 4;

/* ── THE MORNING'S SHAPE, AT THE REAL LOAD (FEED-IA §31.1, §12) ───────────────────────────────
 * «300 orders a day is the design load… a REALISTIC SEED must exist and be the scale every pixel
 * decision is tested against.» A fish house's ordering period runs from the moment the market opens
 * until mid-morning, and the arrivals are NOT spread evenly across it: the bulk lands in the first
 * two hours, while the desk is already processing what came in at five (§26.6 — the overlap is the
 * ordinary case, never a mode). So the hour a row carries is drawn from a curve that leans early,
 * with a real tail: `pow(scatter, 1.7)` puts the median around 06:20 and the last stragglers on
 * 09:30, which is what a morning's column of hours actually looks like.
 */

/** The ordering period, in minutes after the market opens: 05:00 → 09:30 on the fish cast. */
const ORDERING = 270;

/** The hour an order reached the desk, from its own place in the book. Deterministic, so the same
 *  morning renders the same way on every reload — a feed that reshuffles is a feed nobody trusts. */
const arrivalMinutes = (i: number): number => 6 + Math.round(Math.pow(scatter(i * 37 + 11), 1.7) * (ORDERING - 6));

/** The hour the app is standing in: just after the ordering period closes and before the van goes,
 *  so every row on the surface arrived in the past and a message the desk sends now is stamped
 *  later than the words it is answering. */
export const nowOf = (cast: Cast): string => clockAfter(cast.hour, ORDERING + 15);

/* ── WHO ORDERS TODAY, AND WHAT THEY TAKE ─────────────────────────────────────────────────────
 * Three hundred accounts do not all order on one morning, and the ones that do take between one
 * and five lines off a five-product catalogue. Both facts are derived from the row's own index, so
 * a book that grows changes nothing about the rows already in it.
 *
 * A LINE IS SIZED BY WHAT IT COSTS, NOT BY A NUMBER PICKED PER PRODUCT. A house's line is worth
 * somewhere between two hundred and two thousand soles whatever is on it, so the quantity is that
 * money divided by the product's own price — which is why gamba roja at S/ 358.80/kg comes in ones
 * and twos and merluza at S/ 61.62/kg comes in tens, without either band being typed anywhere. It keeps a
 * generated order under the house's own ceiling by construction: five lines at their largest is
 * still inside it, so the orders that trip the guard are the ones deliberately seeded to.
 */

/** How many lines a request carries. Weighted the way a real book is: two and three are the day. */
const LINE_COUNTS = [1, 2, 2, 3, 3, 3, 3, 4, 4, 5];

export function dayLineCount(i: number): number {
  return LINE_COUNTS[Math.floor(scatter(i * 41 + 13) * LINE_COUNTS.length) % LINE_COUNTS.length];
}

/** The products this customer takes, chosen so a house's book has regulars rather than a lottery:
 *  the walk starts at the customer's own place in the catalogue and steps by their own stride. */
export function productsFor(cast: Cast, i: number, count: number): Product[] {
  const n = cast.products.length;
  const start = Math.floor(scatter(i * 43 + 17) * n) % n;
  const stride = 1 + (Math.floor(scatter(i * 47 + 19) * (n - 1)) % (n - 1 || 1));
  const out: Product[] = [];
  for (let k = 0; k < Math.min(count, n); k += 1) out.push(cast.products[(start + k * stride) % n]);
  return out.filter((p, k) => out.indexOf(p) === k);
}

/** A line's amount, sized by the money it is worth and rounded the way the trade writes it. */
export function qtyFor(price: number, i: number, k: number, sourcePrice = price / LEGACY_EUR_TO_PEN): number {
  const money = (55 + Math.pow(scatter(i * 53 + k * 7 + 23), 1.4) * 465) * LEGACY_EUR_TO_PEN;
  const denominator = Math.max(sourcePrice * LEGACY_EUR_TO_PEN, seedSoles(1));
  const raw = money / denominator;
  return raw >= 8 ? Math.round(raw) : Math.max(1, Math.round(raw * 2) / 2);
}

/** «1 stop» · «3 stops». A count that reads «1 stops» is the kind of small wrongness that makes a
 *  screen look machine-made. */
export const plural = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);

/** The lines a customer takes from this account's own catalogue. Deterministic, so the same
 *  morning renders the same way on every reload — a queue that reshuffles is a queue nobody
 *  trusts. The unit is the catalogue's own, so the line's money and its S/ per unit agree.
 *
 *  AND SOME OF THEM ARRIVE IN CONTAINERS (THE-INTELLIGENCE §3). About one line in five is asked
 *  for the way the trade says it — «dos cajas» — so `wasQty` carries their words and the amount
 *  carries the arithmetic. The quantity is the pack's own multiple, so the conversion under the
 *  line is a true sum rather than a rounded claim. */
function linesFor(cast: Cast, i: number): OrderLine[] {
  return productsFor(cast, i, dayLineCount(i)).map((product, k) => {
    const price = priceOf(cast, product);
    const sourcePrice = priceOf(cedarSourceCast(cast), product);
    const pack = product.pack;
    const asked = pack && scatter(i * 59 + k * 3 + 29) > 0.8;
    const boxes = asked ? Math.max(1, Math.round(qtyFor(price, i, k, sourcePrice) / pack!.factor)) : 0;
    return {
      id: `l${k + 1}`,
      product: product.id,
      qty: asked ? Math.round(boxes * pack!.factor * 100) / 100 : qtyFor(price, i, k, sourcePrice),
      unit: product.unit,
      wasQty: asked ? boxes : undefined,
      price,
      lot: product.trace.lote,
    };
  });
}

/** What the customer asked for, said the way they would say it. Composed from the lines rather
 *  than written, so the words and the reading can never describe different orders. */
const asked = (cast: Cast, lines: OrderLine[]): string =>
  lines.map((l) => `${l.qty} ${l.unit} ${productOf(cast, l.product).name}`).join(', ');

/** DOES THIS ACCOUNT ORDER TODAY? Most do — a fish house's book turns over daily — and the ones
 *  that skip are what keeps 296 accounts from reading as 296 identical rows. The five the brief
 *  locked always order: the catalogue is drawn against them. */
const ordersToday = (i: number): boolean => i < 5 || scatter(i * 61 + 31) > 0.045;

/** THE FEW WHO CHANGED THEIR MIND AFTER IT WAS RECORDED (U11). One morning in a hundred rows holds
 *  a handful, and a day's list where it never happens is a day's list hiding the hardest moment the
 *  product has. It rides the sale as a tag rather than holding it back (§6.2). */
const changesToday = (i: number): boolean => scatter(i * 67 + 37) > 0.975;

/** THE DAY IS BUILT ONCE PER CAST (§31.1). It is a pure function of the catalogue, and at three
 *  hundred orders it is no longer free: `buildSales` asks for it twice on every fold and the fold
 *  runs on every act. A cast is a frozen object, so the answer is cached against it and a sector
 *  switch simply misses the cache. */
const DAYS = new WeakMap<Cast, DayOrder[]>();

export function dayOrders(cast: Cast): DayOrder[] {
  const held = DAYS.get(cast);
  if (held) return held;
  const built = buildDayOrders(cast);
  DAYS.set(cast, built);
  return built;
}

function buildDayOrders(cast: Cast): DayOrder[] {
  const own = customerOf(cast, cast.order.customer);
  const out: DayOrder[] = [];

  cast.customers.forEach((customer, i) => {
    /* THE ORDER ARRIVING RIGHT NOW is the cast's own — the one the whole catalogue is drawn
       against, with the customer's real words and the transcript behind them. It stands on the
       capture surface until a person puts it in the queue. */
    if (customer.id === own.id) {
      out.push({
        id: customer.id,
        customer,
        order: cast.order,
        total: totalOf(cast.order.lines),
        at: cast.order.placedAt,
        unresolved: cast.order.lines[0].id,
        arriving: true,
      });
      return;
    }
    if (!ordersToday(i)) return;

    const lines = linesFor(cast, i);
    const minutes = arrivalMinutes(i);
    const placedAt = clockAfter(cast.hour, minutes);
    const first = `For ${cast.order.deliveryDay}: ${asked(cast, lines)}.`;

    const changes = changesToday(i) && lines.length >= 2;
    const raised = lines[0];
    const dropped = lines[lines.length - 1];
    const second = changes
      ? `Make the ${productOf(cast, raised.product).name} ${raised.qty + MORE} ${raised.unit}, and leave the ${productOf(cast, dropped.product).name}.`
      : undefined;

    const order: Order = {
      customer: customer.id,
      deliveryDay: cast.order.deliveryDay,
      placedAt,
      words: second ? [first, second] : [first],
      utterances: second
        ? [{ at: 0, text: first }, { at: 4200, text: second }]
        : [{ at: 0, text: first }],
      lines,
    };

    out.push({
      id: customer.id,
      customer,
      order,
      total: totalOf(lines),
      at: placedAt,
      changed: changes
        ? { raised, dropped, more: MORE, at: clockAfter(cast.hour, Math.min(minutes + 42, ORDERING + 8)) }
        : undefined,
    });
  });

  return out;
}

/* ── THE GATE ─────────────────────────────────────────────────────────────────────────────────
 * `gate.mode` decides the queue's DEFAULT VIEW. Two reasons fill it and each row says which one
 * put it there: the order's own exception (a line waiting on an answer, a change that arrived
 * after the order was recorded), which holds on every configuration, and the threshold, which
 * holds only where a threshold is what they said.
 */

export type HeldReason = { kind: 'answer' | 'change' | 'threshold'; text: string };

export function heldReason(o: DayOrder, d: Derived): HeldReason | null {
  if (o.unresolved) return { kind: 'answer', text: 'One line is waiting on an answer' };
  if (o.changed) return { kind: 'change', text: `Changed at ${o.changed.at}, after it was recorded` };
  if (d.queue.threshold !== null && o.total >= d.queue.threshold) {
    return { kind: 'threshold', text: `Over ${soles(d.queue.threshold)}` };
  }
  return null;
}

/* ── THE EDITS ────────────────────────────────────────────────────────────────────────────────
 * What a person has done to today, in one place, so Today and Orders are the same day. It is a
 * store rather than a context because the app's provider tree belongs to APP-CORE: an area package
 * lands files, it does not wrap the app. `useSyncExternalStore` gives both areas the same value
 * and re-renders both when either one writes.
 */

export type DayEdits = {
  /** the cast these edits belong to — a different cast is a different day */
  sector: SectorId;
  /** the arriving order has been put in the queue */
  surfaced: string[];
  /** orders that have been through the gate */
  confirmed: string[];
  /** the answer a person gave the waiting line, per order */
  answered: Record<string, string>;
  /** the answers made standing for that customer */
  always: string[];
  /** albarán numbers Dispatch has released — the strip and Today read this */
  released: string[];
  /** what was decided about a change, per order */
  notice: Record<string, string>;
  /* ── THE SALE LEDGER (APP-FEED) ───────────────────────────────────────────────────────────
   * Every transition of the day's sales, in the order it happened. It is APPENDED to and never
   * rewritten, and `sale.ts` is the only file that folds it, so the feed and the detail read one
   * history rather than two opinions. `confirmed` and `released` above are states of the SAME
   * object seen from the older surfaces — `sale.ts` folds them in rather than shadowing them. */
  events: SaleEvent[];
};

const PRISTINE: Partial<Record<SectorId, DayEdits>> = {};

const pristine = (sector: SectorId): DayEdits => {
  const held = PRISTINE[sector];
  if (held) return held;
  const made: DayEdits = { sector, surfaced: [], confirmed: [], answered: {}, always: [], released: [], notice: {}, events: [] };
  PRISTINE[sector] = made;
  return made;
};

/** Browser-only design state. The event ledger stays the one source for every surface. */
export const DAY_STORAGE_KEY = 'rocoto-app-day';
const DAY_STORAGE_VERSION = CEDAR_DAY_PEN_VERSION;
const SECTORS: SectorId[] = ['fish', 'meat', 'fruit'];
const recordOf = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const stringsOf = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const stringMapOf = (value: unknown): value is Record<string, string> =>
  recordOf(value) && Object.values(value).every((item) => typeof item === 'string');
const clockAt = (value: string): boolean => /^\d{1,2}:\d{2}$/.test(value);
/** New browser-print evidence is UTC; only print records may introduce it into the legacy clock ledger. */
const utcAt = (value: string): boolean => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const theatreOriginOf = (value: unknown): value is TheatreOrigin =>
  recordOf(value) && typeof value.id === 'string' && value.id.startsWith('theatre:')
    && (value.scenario === 'order' || value.scenario === 'question')
    && value.tainted === true && value.source === 'kit-demo';
const EVENT_STRINGS: Record<SaleEvent['kind'], string[]> = {
  commit: [], make: [], schedule: ['window'], cancel: [], send: [], deliver: [], decline: ['because'],
  'choose-sku': ['line', 'product', 'asked', 'from'],
  'choose-sku-none': ['line', 'asked', 'from'],
  settle: [], read: [], unread: [], flag: ['by'], unflag: ['by'], resolve: ['outcome'], print: [], 'erp-send': [],
  'email-schedule': ['sendAt'], 'email-sent': [], tier: ['tier'], pay: ['how'], lot: ['line'],
  line: ['line'], add: ['line', 'unit'], remove: ['line'], restore: ['line'], amend: ['line', 'word'],
  'prep-note': ['line', 'note'], 'customer-option': ['line', 'action', 'by'], prepare: [], unprepare: [], 'prepare-line': ['line'],
  'unprepare-line': ['line'], 'print-day': ['day'], arrive: ['customer'],
  'source-arrive': ['customer', 'customerName', 'customerPhone', 'text', 'channel', 'sourceEvent', 'conversation', 'occurredAt'],
  'theatre-receive': ['customer', 'scenario', 'text'], 'theatre-process': ['scenario', 'text'],
  'theatre-arrive': ['customer', 'scenario', 'product', 'text'], 'theatre-message': ['text'], 'theatre-amend': ['line'], new: [],
  'draft-name': ['said'], 'draft-day': [], 'slot-taken': [], adopt: ['line', 'how'],
  correct: ['line', 'asked', 'filled'], 'unit-flip': ['line', 'from', 'to'],
  graduate: ['line', 'base', 'amendment'], reply: ['text'], answer: ['text'], delete: [], archive: ['by'],
};

/** Reject malformed stored payloads before the fold can read them. */
function savedEvent(value: unknown): value is SaleEvent {
  if (!recordOf(value) || typeof value.kind !== 'string'
      || !Object.prototype.hasOwnProperty.call(EVENT_STRINGS, value.kind)
      || typeof value.at !== 'string') return false;
  const kind = value.kind as SaleEvent['kind'];
  if (!clockAt(value.at) && (!['print', 'print-day'].includes(kind) || !utcAt(value.at))) return false;
  if (kind !== 'print-day' && (typeof value.sale !== 'string' || !value.sale)) return false;
  if (EVENT_STRINGS[kind].some((key) => typeof value[key] !== 'string')) return false;
  /* ⚠ `klass` IS HISTORY, AND IT IS KEPT ON PURPOSE (FEED-IA §197.2 «Remove class everywhere»).
     No surface writes one and no surface draws one, but a ledger stored before the ruling holds
     `line` events that carry the field — and a guard that rejected them would drop the WHOLE event,
     losing the quantity beside it. So the shape stays legal and the value is simply never read. */
  for (const key of ['sale', 'by', 'window', 'because', 'outcome', 'target', 'sendAt', 'tier', 'how',
    'line', 'unit', 'klass', 'product', 'word', 'asked', 'note', 'day', 'customer', 'said', 'filled',
    'from', 'to', 'base', 'amendment', 'text', 'action']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  }
  for (const key of ['given', 'price', 'finalWeight', 'qty', 'offset', 'take']) {
    if (value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) return false;
  }
  for (const key of ['unitFactor', 'fromFactor', 'toFactor']) {
    const factor = value[key];
    if (factor !== undefined && factor !== null
        && (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 0)) return false;
  }
  if (value.over !== undefined && !stringsOf(value.over)) return false;
  if (value.auto !== undefined && typeof value.auto !== 'boolean') return false;
  if (value.dimensions !== undefined && !stringMapOf(value.dimensions)) return false;
  if (value.prices !== undefined && (!recordOf(value.prices)
      || Object.values(value.prices).some((price) => typeof price !== 'number' || !Number.isFinite(price)))) return false;
  const printEvidence = ['revision', 'requestedAt', 'requestedBy', 'confirmedAt', 'confirmedBy', 'attemptId', 'materialCursor'];
  if (kind !== 'print' && printEvidence.some((key) => value[key] !== undefined)) return false;
  if (kind === 'print') {
    for (const key of ['revision', 'requestedBy', 'confirmedBy', 'attemptId']) {
      if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key])) return false;
    }
    for (const key of ['requestedAt', 'confirmedAt']) {
      if (value[key] !== undefined && (typeof value[key] !== 'string' || !utcAt(value[key] as string))) return false;
    }
    if (value.materialCursor !== undefined && (!Number.isSafeInteger(value.materialCursor) || (value.materialCursor as number) < 0)) return false;
  }
  if (kind === 'lot' && (!Array.isArray(value.allocations) || value.allocations.some((item) =>
    !recordOf(item) || typeof item.batch !== 'string' || typeof item.qty !== 'number'
      || !Number.isFinite(item.qty) || item.qty < 0))) return false;
  if (kind === 'customer-option') {
    if (value.action === 'approve' && !approvedCustomerOption(value.option)) return false;
    if (value.action === 'clear' && value.option !== undefined) return false;
    if (value.action !== 'approve' && value.action !== 'clear') return false;
  }
  if (kind === 'add' && (typeof value.qty !== 'number' || typeof value.price !== 'number'
      || (typeof value.product !== 'string' && typeof value.word !== 'string'))) return false;
  if ((kind === 'new' || kind === 'arrive' || kind === 'source-arrive' || kind === 'theatre-arrive' || kind === 'draft-day') && typeof value.offset !== 'number') return false;
  if ((kind === 'arrive' || kind === 'theatre-arrive') && (typeof value.take !== 'number' || value.take < 0)) return false;
  if (kind === 'source-arrive') {
    if (!['whatsapp', 'phone', 'email'].includes(String(value.channel))) return false;
    if (value.historical !== false || !Number.isFinite(Date.parse(String(value.occurredAt)))) return false;
    if (!Array.isArray(value.lines) || value.lines.length > 100) return false;
    if (value.needsReply !== undefined && !['order', 'ask'].includes(String(value.needsReply))) return false;
    if (value.deliveryDay !== undefined && (typeof value.deliveryDay !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(value.deliveryDay)
      || !Number.isFinite(Date.parse(value.deliveryDay))
      || new Date(value.deliveryDay).toISOString().slice(0, 10) !== value.deliveryDay)) return false;
    if (value.intelligence !== undefined && (!recordOf(value.intelligence)
      || !['model', 'heuristic'].includes(String(value.intelligence.mode))
      || (value.intelligence.model !== undefined && typeof value.intelligence.model !== 'string'))) return false;
    if (value.phoneSource !== undefined) {
      if (!recordOf(value.phoneSource)
        || typeof value.phoneSource.workspaceId !== 'string'
        || typeof value.phoneSource.callSid !== 'string'
        || !stringsOf(value.phoneSource.eventIds)
        || !stringsOf(value.phoneSource.sourceIds)
        || !Array.isArray(value.phoneSource.utterances)
        || value.phoneSource.utterances.some((utterance) => !recordOf(utterance)
          || typeof utterance.id !== 'string'
          || typeof utterance.speaker !== 'number' || !Number.isSafeInteger(utterance.speaker)
          || !['inbound', 'outbound'].includes(String(utterance.track))
          || typeof utterance.start !== 'number' || !Number.isFinite(utterance.start)
          || typeof utterance.end !== 'number' || !Number.isFinite(utterance.end)
          || utterance.end < utterance.start
          || typeof utterance.text !== 'string'
          || typeof utterance.final !== 'boolean')) return false;
    }
    if (value.lines.some((line) => !recordOf(line)
      || typeof line.word !== 'string' || !line.word.trim()
      || typeof line.unit !== 'string' || !line.unit.trim()
      || (line.product !== undefined && typeof line.product !== 'string')
      || (line.evidence !== undefined && typeof line.evidence !== 'string')
      || (line.confidence !== undefined && !['low', 'medium', 'high'].includes(String(line.confidence)))
      || (line.qty !== undefined && (typeof line.qty !== 'number' || !Number.isFinite(line.qty) || line.qty < 0)))) return false;
  }
  if ((kind === 'theatre-receive' || kind === 'theatre-process' || kind === 'theatre-arrive')
      && !['order', 'question'].includes(String(value.scenario))) return false;
  const theatre = value.theatre;
  if (kind.startsWith('theatre-') && (!theatreOriginOf(theatre) || theatre.id !== value.sale)) return false;
  if (kind === 'theatre-amend' && (typeof value.qty !== 'number' || !Number.isFinite(value.qty) || value.qty < 0)) return false;
  if (kind === 'theatre-message' && !['received', 'ai'].includes(String(value.author))) return false;
  if (kind === 'pay' && !['cash', 'card', 'transfer'].includes(String(value.how))) return false;
  if (kind === 'adopt' && !['catalogue', 'one-off'].includes(String(value.how))) return false;
  return true;
}

function savedDays(): Partial<Record<SectorId, DayEdits>> {
  if (typeof window === 'undefined') return {};
  try {
    const source: unknown = JSON.parse(window.localStorage.getItem(DAY_STORAGE_KEY) || 'null');
    const raw = migrateDayCurrency(source);
    if (!recordOf(raw) || raw.version !== DAY_STORAGE_VERSION || !recordOf(raw.sectors)) return {};
    if (raw !== source) {
      try {
        window.localStorage.setItem(DAY_STORAGE_KEY, JSON.stringify(raw));
      } catch (error) {
        console.warn('Rocoto will retry the saved day currency upgrade on the next boot', error);
      }
    }
    const result: Partial<Record<SectorId, DayEdits>> = {};
    for (const sector of SECTORS) {
      const value = raw.sectors[sector];
      if (!recordOf(value) || value.sector !== sector || !Array.isArray(value.events)) continue;
      const events = value.events.filter(savedEvent);
      if (events.length !== value.events.length) console.warn('Rocoto ignored malformed saved day events', { sector });
      result[sector] = {
        sector, events,
        surfaced: stringsOf(value.surfaced) ? value.surfaced : [],
        confirmed: stringsOf(value.confirmed) ? value.confirmed : [],
        answered: stringMapOf(value.answered) ? value.answered : {},
        always: stringsOf(value.always) ? value.always : [],
        released: stringsOf(value.released) ? value.released : [],
        notice: stringMapOf(value.notice) ? value.notice : {},
      };
    }
    return result;
  } catch (error) {
    console.warn('Rocoto starts from a fresh day; reading the saved one stalled', error);
    return {};
  }
}

let SAVED_DAYS = savedDays();
const restored = (sector: SectorId): DayEdits => SAVED_DAYS[sector] ?? pristine(sector);

/** Commit the durable copy before any subscriber can observe a successful edit. */
function saveDay(state: DayEdits): boolean {
  const empty = state.events.length === 0 && state.surfaced.length === 0 && state.confirmed.length === 0
    && state.always.length === 0 && state.released.length === 0
    && Object.keys(state.answered).length === 0 && Object.keys(state.notice).length === 0;
  const next = { ...SAVED_DAYS };
  if (empty) delete next[state.sector];
  else next[state.sector] = state;
  try {
    if (typeof window !== 'undefined') {
      if (Object.keys(next).length === 0) window.localStorage.removeItem(DAY_STORAGE_KEY);
      else window.localStorage.setItem(DAY_STORAGE_KEY, JSON.stringify({ version: DAY_STORAGE_VERSION, sectors: next }));
    }
    SAVED_DAYS = next;
    return true;
  } catch (error) {
    console.warn('Saving day state stalled; the previous day stands as it was', error);
    return false;
  }
}

let edits: DayEdits = restored('fish');
const listeners = new Set<() => void>();

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

const snapshot = (): DayEdits => edits;

// Another tab must refresh this complete ledger before it can append its next command.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== DAY_STORAGE_KEY && event.key !== null) return;
    SAVED_DAYS = savedDays();
    edits = restored(edits.sector);
    listeners.forEach((fn) => fn());
  });
}


/** THE LEDGER, READ WITHOUT A COMPONENT. `useDay` is the hook every surface takes; a reader that
 *  is not a render — the trace export, a report, anything the backend will one day call — asks for
 *  the same snapshot the hook is subscribed to, so the two can never see different mornings. It
 *  mirrors `grantsNow()` in grants.ts, deliberately: one read shape for both module stores. */
export const dayNow = (): DayEdits => edits;
/** Read a named house without changing the visible house. Replay controllers use this so an
 * inactive-world sequence is still idempotent and cannot spin against another world's snapshot. */
export const dayForSector = (sector: SectorId): DayEdits => edits.sector === sector ? edits : restored(sector);

export function setDay(patch: Partial<DayEdits> | ((prev: DayEdits) => Partial<DayEdits>)): boolean {
  const next = { ...edits, ...(typeof patch === 'function' ? patch(edits) : patch) };
  if (!saveDay(next)) return false;
  edits = next;
  listeners.forEach((fn) => fn());
  return true;
}

/** Write a named sector without switching the screen. This is for deterministic kit fixtures
 * whose replay/reset must preserve every unrelated event in that sector’s own ledger. */
export function setDayForSector(
  sector: SectorId,
  patch: Partial<DayEdits> | ((prev: DayEdits) => Partial<DayEdits>),
): DayEdits {
  const previous = edits.sector === sector ? edits : restored(sector);
  const next = { ...previous, ...(typeof patch === 'function' ? patch(previous) : patch), sector };
  if (!saveDay(next)) return previous;
  if (edits.sector === sector) {
    edits = next;
    listeners.forEach((fn) => fn());
  }
  return next;
}

/** Clear this sector's browser edits through the same store, including its saved copy. */
export function resetDay(sector: SectorId = edits.sector): void {
  if (sector === edits.sector) setDay(pristine(sector));
  else saveDay(pristine(sector));
}

/** Add one id to a list, once. Every act in this store is idempotent, because a queue row that
 *  can be confirmed twice is a queue row that can be confirmed twice by accident. */
export const withId = (list: string[], id: string): string[] =>
  list.includes(id) ? list : [...list, id];

/** The day's edits for the cast on screen. The sector switch is a different morning, so the
 *  answers given to yesterday's fish do not stand on today's meat. */
export function useDay(sector: SectorId): DayEdits {
  const state = React.useSyncExternalStore(subscribe, snapshot);
  React.useEffect(() => {
    if (edits.sector !== sector) setDay(restored(sector));
  }, [sector]);
  return state.sector === sector ? state : restored(sector);
}

/* ── THE DAY, ASSEMBLED ───────────────────────────────────────────────────────────────────────
 * One function both areas call. It takes the cast, the derivation and the edits, and returns the
 * three sets the spine is made of: what is arriving, what is waiting on a person, and what is
 * recorded and on its way to a sheet.
 */

export type Day = {
  all: DayOrder[];
  /** on the capture surface, not yet in the queue */
  arriving: DayOrder | null;
  /** waiting on the person, under the gate's default view */
  queue: DayOrder[];
  /** every unconfirmed order, whatever the gate shows by default — the blend law's other half */
  waiting: DayOrder[];
  /** through the gate, on today's sheet */
  recorded: DayOrder[];
};

export function buildDay(cast: Cast, d: Derived, e: DayEdits): Day {
  const all = dayOrders(cast);
  const arriving = all.find((o) => o.arriving && !e.surfaced.includes(o.id)) ?? null;
  const live = all.filter((o) => o !== arriving);
  const waiting = live.filter((o) => !e.confirmed.includes(o.id));
  const queue = d.queue.filter === 'all' ? waiting : waiting.filter((o) => heldReason(o, d) !== null);
  const recorded = live.filter((o) => !queue.includes(o));
  return { all, arriving, queue, waiting, recorded };
}

/* ── PICKING ──────────────────────────────────────────────────────────────────────────────────
 * F0's sheet, summarised. The rows of a picking sheet are the lines of the orders that have been
 * recorded, grouped and printed there; the lines that come back from the bench are the ones whose
 * product's weight is decided by a scale rather than by a count (`variableWeight` in the cast).
 * Both numbers therefore move when a person confirms an order — the sheet is a function of the
 * day, not a picture of one.
 *
 * The round's own shape comes from `canonical/drop-list`'s `buildRound`, so Today's rounds and
 * Dispatch's rounds are one list of stops.
 */

export type Picking = {
  lines: number;
  stops: number;
  /** lines whose weight the scale decides */
  weighed: number;
  rounds: Array<{ id: number; stops: number; first: string; last: string }>;
};

export function picking(cast: Cast, day: Day): Picking {
  const lines = day.recorded.reduce((sum, o) => sum + o.order.lines.length, 0);
  const weighed = day.recorded.reduce(
    (sum, o) => sum + o.order.lines.filter((l) => productOf(cast, l.product).variableWeight).length,
    0,
  );
  /* THE ROUND CARRIES WHAT IS ON THE SHEET, and nothing else: a stop exists because an order is
     recorded, so the stops on the two rounds always add up to the stops the sheet says. Confirm an
     order and a stop appears — the round is a function of the day, not a picture of one. */
  const recorded = new Set(day.recorded.map((o) => o.id));
  const going = buildRound(cast)
    .map((stop, i) => ({ ...stop, round: (i % 2) + 1 }))
    .filter((stop) => recorded.has(stop.id));
  const rounds = [1, 2]
    .map((id) => {
      const own = going.filter((s) => s.round === id);
      return {
        id,
        stops: own.length,
        first: own.length ? own[0].slot : '',
        last: own.length ? own[own.length - 1].slot : '',
      };
    })
    .filter((r) => r.stops > 0);
  return { lines, stops: going.length, weighed, rounds };
}

/* ── THE SLOTS ────────────────────────────────────────────────────────────────────────────────
 * The lines of the day that are waiting for a price, for the one configuration that produces them
 * on Today: prices set by hand each morning (`pricing.level === 4`). They are the arriving
 * customer's own lines, because that is the pass a person actually makes at 06:00 — one customer,
 * one column of hands, top to bottom.
 */

export function slotsOfDay(cast: Cast, o: DayOrder) {
  return o.order.lines.map((line) => {
    const product = productOf(cast, line.product);
    const batch = cast.batches.find((b) => b.product === product.id);
    return {
      id: line.id,
      product,
      qty: line.qty,
      unit: line.unit,
      /* both reasons stand on one queue: a line agreed line by line, and a line whose cost is
         still at the market. The row says which one put it there. */
      reason: (batch ? 'cost-pending' : 'agreed') as 'cost-pending' | 'agreed',
      lastPrice: line.price,
      lastMargin: batch ? Math.round((line.price / batch.cost - 1) * 100) : undefined,
      cost: batch?.cost,
    };
  });
}
