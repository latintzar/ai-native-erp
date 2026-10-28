/* THE SEVENTEEN DIMENSIONS — brief §4, as data.
 *
 * The consolidated page crosses this table with every card's `dims`, so «the 17 dimensions are
 * covered» becomes a computation instead of an assertion. A configuration with no card is a HOLE
 * in the catalogue, and the table names it out loud.
 *
 * The configuration ids are verbatim from the brief, because `meta.dims` quotes them verbatim and
 * a typo would silently read as a hole. `D12.fish-only` is RETIRED (C-2): D12 is a per-family
 * traceability profile, so the four profile values stand in its place.
 */

export type Dimension = {
  id: string;
  /** the question, in the distributor's language */
  question: string;
  configurations: Array<{ id: string; meaning: string }>;
  /** the dimension is only asked under this condition */
  askedWhen?: string;
  /** configurations retired by a call in BUILD-PLAN §2 */
  retired?: Array<{ id: string; by: string }>;
};

export const DIMENSIONS: Dimension[] = [
  {
    id: 'D1', question: 'Which channels orders arrive on',
    configurations: [
      { id: 'D1.whatsapp', meaning: 'text, voice notes and photographs to a WhatsApp number' },
      { id: 'D1.phone', meaning: 'telephone calls, recorded and transcribed' },
      { id: 'D1.email', meaning: 'email, including spreadsheets and PDFs' },
      { id: 'D1.inperson', meaning: 'taken face to face at the stall and typed in' },
      { id: 'D1.portal', meaning: 'a web page where the customer types their own order' },
    ],
  },
  {
    id: 'D2', question: 'Which orders a person checks before they proceed',
    configurations: [
      { id: 'D2.all', meaning: 'every order is checked and confirmed by a person' },
      { id: 'D2.exceptions', meaning: 'only orders carrying something the software could not resolve' },
      { id: 'D2.new-customers', meaning: 'senders never seen before are held' },
      { id: 'D2.threshold', meaning: 'orders above a value or quantity are held' },
      { id: 'D2.none', meaning: 'no order is held; a person reviews afterwards if they wish' },
    ],
  },
  {
    id: 'D3', question: 'What kinds of work appear in the review list',
    configurations: [
      { id: 'D3.confirm', meaning: 'approving an order that was interpreted correctly' },
      { id: 'D3.edit', meaning: 'changing lines on an order before it proceeds' },
      { id: 'D3.reply', meaning: "answering a customer's question that is not an order" },
      { id: 'D3.resolve', meaning: 'deciding something the software could not decide' },
      { id: 'D3.setup', meaning: 'recording a preference discovered during an order' },
    ],
  },
  {
    id: 'D4', question: 'What a customer is allowed to order',
    configurations: [
      { id: 'D4.sku-only', meaning: 'catalogue products, exactly as they appear there' },
      { id: 'D4.sku-plus-note', meaning: 'catalogue products with free text a person reads' },
      { id: 'D4.sku-plus-class-any', meaning: 'the customer may name a class the catalogue lacks' },
      { id: 'D4.sku-class-restricted', meaning: 'the customer may name a class that exists for that product' },
      { id: 'D4.sku-plus-type', meaning: 'the customer may name a type or variety, recorded as a named field' },
    ],
  },
  {
    id: 'D5', question: 'What units a customer is allowed to order in',
    configurations: [
      { id: 'D5.sku-unit-only', meaning: "orders use the catalogue's unit; anything else is held" },
      { id: 'D5.any-unit', meaning: 'orders may use any unit; Rocoto converts on a stored ratio' },
    ],
  },
  {
    id: 'D6', question: 'How precisely a product must be identified',
    configurations: [
      { id: 'D6.item', meaning: 'the product name alone' },
      { id: 'D6.item-sort', meaning: 'the product name and its origin or variety' },
      { id: 'D6.item-sort-class', meaning: 'name, origin and grade' },
    ],
  },
  {
    id: 'D7', question: 'How cost is recorded',
    configurations: [
      { id: 'D7.market-voice', meaning: 'discovered at the market and spoken into the phone' },
      { id: 'D7.doc-digital', meaning: "from a supplier's albarán arriving by email" },
      { id: 'D7.doc-paper', meaning: "from a supplier's albarán arriving on paper with the goods" },
      { id: 'D7.contract', meaning: 'an agreed price that holds for weeks or months' },
      { id: 'D7.none', meaning: 'cost is not recorded in Rocoto at all' },
    ],
  },
  {
    id: 'D8', question: 'How the selling price is arrived at',
    configurations: [
      { id: 'D8.list', meaning: 'a written price list, changed occasionally' },
      { id: 'D8.margin', meaning: 'cost plus a percentage' },
      { id: 'D8.negotiated', meaning: 'agreed with the customer each time an order is placed' },
      { id: 'D8.none', meaning: 'prices stay in the accounting system. The default' },
    ],
  },
  {
    id: 'D9', question: 'How many prices or margins exist',
    configurations: [
      { id: 'D9.one', meaning: 'one list, or one margin, for every customer' },
      { id: 'D9.many', meaning: 'several, with each customer assigned to one' },
    ],
  },
  {
    id: 'D10', question: 'Agreements that apply to one customer only',
    configurations: [
      { id: 'D10.none', meaning: 'the general rule and the tier decide everything' },
      { id: 'D10.fixed-override', meaning: 'a price agreed for one customer and one product' },
      { id: 'D10.fixed-with-volume', meaning: 'a price agreed against a quantity over a period' },
      { id: 'D10.restricted-catalogue', meaning: 'the customer may order an agreed subset' },
      { id: 'D10.tier-assignment', meaning: "the customer takes that tier's price at order time" },
    ],
  },
  {
    id: 'D11', question: 'How stock is recorded',
    configurations: [
      { id: 'D11.supplier-doc', meaning: 'from purchase documents, digital or paper' },
      { id: 'D11.declared', meaning: 'somebody states a quantity aloud; no document exists' },
      { id: 'D11.published', meaning: 'the list sent to customers each morning IS the stock record' },
      { id: 'D11.none', meaning: 'no stock position is kept. The default' },
    ],
  },
  {
    id: 'D12', question: 'Whether batch numbers are recorded — per FAMILY (C-2)',
    configurations: [
      { id: 'D12.none', meaning: 'the word «lote» does not appear' },
      { id: 'D12.lot', meaning: 'lote · variedad · categoría · calibre · origen · GGN' },
      { id: 'D12.lot+animal', meaning: 'lote and the birth / rearing / slaughter / cutting chain with its plant number' },
      { id: 'D12.lot+fisheries', meaning: 'lote · nombre científico · zona · arte · método · descongelado · buque · fecha' },
    ],
    retired: [
      { id: 'D12.all', by: 'C-2 — a per-family profile, so «every line» is the case where no family is `none`' },
      { id: 'D12.fish-only', by: 'C-2 — a sector is a preset that picks a family default, never a runtime branch' },
    ],
  },
  {
    id: 'D13', question: 'Whether goods are weighed before dispatch',
    configurations: [
      { id: 'D13.as-ordered', meaning: 'the quantity ordered is the quantity charged' },
      { id: 'D13.weigh-some', meaning: 'certain products are weighed' },
      { id: 'D13.weigh-all', meaning: 'everything is weighed' },
    ],
  },
  {
    id: 'D14', question: 'Who produces the albarán',
    configurations: [
      { id: 'D14.rocoto', meaning: 'Rocoto produces it, traceability already filled' },
      { id: 'D14.erp', meaning: "the company's existing system produces it, from data Rocoto sends" },
    ],
  },
  {
    id: 'D15', question: 'How the albarán reaches the customer',
    configurations: [
      { id: 'D15.paper', meaning: 'printed and handed over with the goods' },
      { id: 'D15.link', meaning: 'a link the customer opens in a web page' },
      { id: 'D15.link-export', meaning: "as `link`, plus buttons that add it to the customer's own system" },
      { id: 'D15.connected', meaning: 'authorised once, and every albarán afterwards arrives automatically' },
    ],
  },
  {
    id: 'D16', question: 'When the albarán is sent to the customer',
    configurations: [
      { id: 'D16.on-confirm', meaning: 'the moment the distributor confirms it' },
      { id: 'D16.on-delivery', meaning: 'once the goods are confirmed as delivered' },
    ],
  },
  {
    id: 'D17', question: 'Who confirms that a delivery happened',
    askedWhen: 'D16.on-delivery',
    configurations: [
      { id: 'D17.driver', meaning: 'drivers see their stops, mark each delivered, capture a signature' },
      { id: 'D17.scheduled', meaning: 'the scheduled slot is treated as the confirmation' },
    ],
  },
];

/** Every configuration id in the brief, flattened — the left column of the coverage table. */
export const ALL_CONFIGURATIONS = DIMENSIONS.flatMap((d) =>
  d.configurations.map((c) => ({ dimension: d.id, ...c })),
);

/* ── THE PRIMITIVES — brief §5 ────────────────────────────────────────────────────────────────
 * U01–U15, crossed with the cards that exercise each on the consolidated page. U12 appears only
 * on K, and that is correct. */

export const PRIMITIVES: Array<{ id: string; name: string; note: string }> = [
  { id: 'U01', name: 'Choice chips', note: 'two to four candidates ordered by evidence; one press, stored, never asked again' },
  { id: 'U02', name: 'Voice rows', note: 'hold and speak; rows appear as words land; a row not held keeps its recording' },
  { id: 'U03', name: 'Prefill from last time', note: "yesterday's values as a one-press start" },
  { id: 'U04', name: 'Split slider', note: 'a quantity divided by dragging a boundary; the sum is invariant' },
  { id: 'U05', name: 'Ratio lock', note: 'one slider moves a set of values and holds the spread' },
  { id: 'U06', name: 'Camera capture', note: 'one photograph, edges found; unreadable values asked by voice' },
  { id: 'U07', name: 'Document beside rows', note: 'extracted lines on one side, the original on the other, matching text lit' },
  { id: 'U08', name: 'Cell grid', note: 'a spreadsheet for values changed rarely; bulk edit and a stale marker' },
  { id: 'U09', name: 'Empty-slot queue', note: 'items awaiting a value, completed in one pass; empty shown empty' },
  { id: 'U10', name: 'Dual value', note: 'two related values on one line; both kept, both shown' },
  { id: 'U11', name: 'Change notice', note: 'states what changed and lists what it affects; alters nothing' },
  { id: 'U12', name: 'Absent', note: 'no screen, no menu entry, no disabled button' },
  { id: 'U13', name: 'Export buttons', note: "customer-facing; one file per target system, no account" },
  { id: 'U14', name: 'Connection handshake', note: 'customer-facing; authorise once, receive every document after' },
  { id: 'U15', name: 'Drop list', note: "driver-facing; today's stops in route order, each marked delivered" },
];

/* ── THE GROUPS — brief §7 ────────────────────────────────────────────────────────────────────
 * The headings the rail's first lens uses, each with what the group decides. */

export const GROUPS: Array<{ id: string; heading: string; decides: string }> = [
  { id: 'A', heading: 'An order arrives', decides: 'what a person must see before an order may proceed, and every field the reading could not settle' },
  { id: 'B', heading: 'Cost', decides: 'how what the distributor paid gets into the product, in four environments' },
  { id: 'C', heading: 'Price', decides: 'how a selling price is arrived at, and what happens when it moves' },
  { id: 'D', heading: 'Stock', decides: 'what is on hand, how it is declared, and what happens when it runs out' },
  { id: 'E', heading: 'Batches', decides: 'that traceability is a property of the batch and never of the line' },
  { id: 'F', heading: 'Dispatch', decides: 'what leaves the warehouse, and the sheet in the picker’s hand' },
  { id: 'G', heading: 'Producing the albarán', decides: 'the last editable moment, and the proof the data landed' },
  { id: 'H', heading: 'Delivering the albarán to the customer', decides: "the product's public face — the only screen a restaurant ever opens" },
  { id: 'I', heading: 'Timing and delivery confirmation', decides: 'when the document goes, and who says the goods arrived' },
  { id: 'J', heading: 'Customer records', decides: 'everything the software learned about a customer, and where it landed' },
  { id: 'K', heading: 'Configurations producing no screen', decides: 'that a dimension switched off removes the destination rather than greying it' },
];
