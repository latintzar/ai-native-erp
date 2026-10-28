/* THE FOUR THREADS — FLOWS' walk of time, as data.
 *
 * The rail's second lens (BUILD-PLAN §8.1) puts every card at its step on its thread, so the rail
 * reads as the chain rather than as a list. Each step states what it RECEIVES and what it HANDS
 * ON, because a pointer is only honest if the card upstream actually fills the field.
 *
 * The card lists here are the PLAN's, not a computation: they are the target. The lens renders
 * the cards that actually exist at each step, from the meta objects, so a step whose cards have
 * not been drawn yet shows as empty rather than as a promise.
 */
import type { Thread } from '../meta';

export type ThreadStep = {
  n: number;
  name: string;
  /** what the step receives from the step before */
  receives: string;
  /** what it hands on */
  hands: string;
  /** the dimension the step forks on */
  forksOn?: string;
};

export type ThreadDef = {
  id: Thread;
  name: string;
  note: string;
  steps: ThreadStep[];
};

export const THREADS: ThreadDef[] = [
  {
    id: 1,
    name: "An order's life",
    note: 'The spine. Every other thread exists to fill a field on this one.',
    steps: [
      { n: 1, name: 'Arrival', receives: 'a message on any live channel', hands: 'order{customer, day} and the raw evidence', forksOn: 'D1' },
      { n: 2, name: 'The gate', receives: 'an interpreted order and its evidence', hands: 'a confirmed order', forksOn: 'D2' },
      { n: 3, name: 'Resolutions', receives: 'one unresolved field on one line', hands: 'the field, twice — line and record', forksOn: 'D4 · D5 · D6 · D10' },
      { n: 4, name: 'Price', receives: "a confirmed order and the customer's tier", hands: 'line.price stamped, or an empty slot', forksOn: 'D8' },
      { n: 5, name: 'Lots', receives: 'confirmed lines and lots on hand', hands: 'line.lots[] and the blended cost', forksOn: 'D12' },
      { n: 6, name: 'The sheet', receives: "the day's confirmed lines", hands: 'what the warehouse picks', forksOn: 'the grouping' },
      { n: 7, name: 'Dispatch', receives: 'picked lines and their lot allocation', hands: 'line.sent_qty · line.grade_sold', forksOn: 'D13' },
      { n: 8, name: 'The albarán', receives: 'order, lots and real weights', hands: 'albarán', forksOn: 'D14' },
      { n: 9, name: 'To the customer', receives: 'a confirmed albarán', hands: "a document in the customer's hands", forksOn: 'D15' },
      { n: 10, name: 'Timing', receives: 'the albarán and the route', hands: 'drop.delivered and the signature', forksOn: 'D16 · D17' },
      { n: 11, name: 'The file', receives: 'every confirmed order of the day', hands: 'one file, one time, one format', forksOn: 'a connection or a file' },
    ],
  },
  {
    id: 2,
    name: "A cost's life",
    note: 'From the market floor to the price on a line, and back once when the price drifts.',
    steps: [
      { n: 1, name: 'Capture', receives: "this morning's facts", hands: 'cost{sku or lot, amount, day} and its source', forksOn: 'D7' },
      { n: 2, name: 'Where it lands', receives: 'a cost', hands: 'a day-price on the SKU, or a cost on a lot', forksOn: 'D12' },
      { n: 3, name: 'Margin', receives: "today's cost", hands: 'price{tier, sku, day}', forksOn: 'D8.margin × D9' },
      { n: 4, name: 'The list', receives: 'nothing from step 1', hands: 'a written price list', forksOn: 'D8.list × D9' },
      { n: 5, name: "The customer's price", receives: "the tier price and this customer's agreements", hands: 'price{customer, sku, day}', forksOn: 'D10' },
      { n: 6, name: 'The drift', receives: 'a price that moved after orders were stamped', hands: 'a decision per affected order' },
      { n: 7, name: 'The report', receives: 'cost × real weight × the lot blend', hands: 'margin per line, per customer, per week' },
    ],
  },
  {
    id: 3,
    name: "A supplier albarán's life",
    note: 'The document that arrives with the goods, and the six fields it leaves behind.',
    steps: [
      { n: 1, name: 'Arrival', receives: 'a document, or no gesture at all', hands: 'a document attached to a supplier and a day', forksOn: 'D7' },
      { n: 2, name: 'Parse', receives: 'the document', hands: 'extracted lines' },
      { n: 3, name: 'Check', receives: 'extracted lines', hands: 'agreed lines', forksOn: 'D11' },
      { n: 4, name: 'The lot', receives: 'agreed lines', hands: 'lot{id, sku, qty, cost, traceability[]}', forksOn: 'D12 per family' },
      { n: 5, name: 'Cost out', receives: 'the lot', hands: 'cost on the lot', forksOn: 'D7' },
      { n: 6, name: 'Stock out', receives: 'the lot', hands: 'quantity available to allocate', forksOn: 'D11' },
      { n: 7, name: 'Availability out', receives: 'what arrived', hands: "today's list, which IS the stock record", forksOn: 'D11.published' },
      { n: 8, name: 'Traceability out', receives: "the lot's field set", hands: "the sub-line on a customer's document", forksOn: 'D12 per family' },
    ],
  },
  {
    id: 4,
    name: "A customer's life",
    note: 'The accumulator. It is the reason mornings get quieter.',
    steps: [
      { n: 1, name: 'First contact', receives: 'a sender never seen before', hands: 'record{name, phone}, or a refusal', forksOn: 'D2.new-customers' },
      { n: 2, name: 'The record', receives: 'a customer', hands: 'tier · delivery days · address · contacts' },
      { n: 3, name: 'Tier', receives: 'two tiers that could both apply', hands: 'record.tier', forksOn: 'D10.tier-assignment' },
      { n: 4, name: 'The agreed catalogue', receives: 'an agreed subset', hands: 'record.catalogue[]', forksOn: 'D10.restricted-catalogue' },
      { n: 5, name: 'Agreed prices', receives: 'a negotiation', hands: 'price{customer, sku} overrides', forksOn: 'D10' },
      { n: 6, name: 'Learned mid-order', receives: 'an answer given once', hands: 'record.preference', forksOn: 'D3.setup' },
      { n: 7, name: 'The habitual order', receives: 'the record', hands: 'candidates ordered by evidence' },
      { n: 8, name: 'Questions that are no order', receives: 'a message that is not an order', hands: 'an answer, or a hand-off out', forksOn: 'D3.reply' },
      { n: 9, name: 'Something was wrong', receives: 'a photo about a delivered albarán', hands: "a credit line into tomorrow's file" },
      { n: 10, name: 'Credit or cash', receives: 'the record', hands: 'the cobro control on a drop row' },
      { n: 11, name: 'Their own screen', receives: 'a link', hands: 'the albarán inside their own system', forksOn: 'D15' },
    ],
  },
];

/* ── THE JUNCTIONS ────────────────────────────────────────────────────────────────────────────
 * FLOWS §5, the nine objects. The consolidated page checks every card's `fills` and `reads`
 * against this vocabulary: a field with a reader and no filler is a HOLE; a field with a filler
 * and no reader is BUSYWORK and gets cut. If the assembled app has a tenth seam, something has
 * been invented. */

export type Junction = {
  /** the field name, and the vocabulary `fills` / `reads` must use */
  field: string;
  /** the object it belongs to */
  object: string;
  /** the plan's expectation, for the page to prove or break */
  note: string;
};

export const JUNCTIONS: Junction[] = [
  { field: 'lot', object: 'the lot', note: 'one write, three readers, up to 48h apart' },
  { field: 'cost', object: "today's cost", note: 'the 06:00 collision lives here' },
  { field: 'price', object: 'the price drift', note: 'the only backward edge on the map, and U11 mediates it' },
  { field: 'lot.qty', object: 'the availability list', note: 'the only cycle; D3s and D4s are its collision' },
  { field: 'record', object: 'the record', note: 'the accumulator; the reason mornings get quieter' },
  { field: 'line.sent_qty', object: 'the real weight', note: 'the one number the ERP cannot obtain any other way' },
  { field: 'lot.traceability[]', object: 'the traceability field set', note: 'per family, never per account' },
  { field: 'credit', object: 'the incidencia', note: 'Rocoto captures it; the ERP issues the abono' },
  { field: 'record.credit', object: 'the cobro', note: 'per customer; sector only changes how many rows light it' },
];

/** The informe's input list (BUILD-PLAN §3.3). The report gets no card, so its inputs run through
 *  the same check: anything it wants that no card fills is a new capture card. */
export const INFORME_INPUTS = [
  'line.sent_qty',
  'cost',
  'price',
  'credit',
  'order',
];
