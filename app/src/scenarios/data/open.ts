/* THE OPEN REGISTER — the regions no scenario decides.
 *
 * Openness is a DESTINATION, not a footnote (BUILD-PLAN §8.3): an `OPEN-n` chip routes to
 * `#/open/<n>`, and this file is what that page reads. Each entry carries what the region is, why
 * it is open, and what would settle it. The inbound count is COMPUTED from the `open` arrays on
 * the 58 meta objects, so it can never disagree with what was actually drawn.
 *
 * Two entries are already closed and say so: OPEN-4 is retired by F0 (C-10) and OPEN-16 is
 * de-fanged by `data/cast.ts` (C-9). A closed OPEN stays in the register with its resolution, so
 * the founder can see the hole and the patch on the same row.
 */

export type OpenRegion = {
  /** the number in `OPEN-n` */
  n: number;
  /** what stands there */
  title: string;
  /** why nobody owns it */
  why: string;
  /** the one thing that would close it */
  settledBy: string;
  /** closed regions carry how they were closed; the register shows them as closed */
  closedBy?: string;
};

export const OPENS: OpenRegion[] = [
  {
    n: 1,
    title: "The day's order list",
    why: 'Thirteen A-cards, C5, C6, G2, H2, H6 and J1a all sit inside it and not one draws it. It is the screen the distributor looks at all morning.',
    settledBy: 'A card that decides the day bar, the row, the row order and the aggregate above them.',
  },
  {
    n: 2,
    title: 'The catalogue',
    why: 'Products, units, classes, calibres, origins and the tree. Fifteen cards write to it or read from it, and the sector field sets live in it.',
    settledBy: "A card that decides the catalogue's own anatomy, once the field sets are settled by E3.",
  },
  {
    n: 3,
    title: 'The customer list',
    why: 'J1a decides one customer. Nobody decides the many.',
    settledBy: 'A card for the landing of the customers area.',
  },
  {
    n: 4,
    title: 'The preparation sheet',
    why: "Brief §3 says Rocoto produces two things, and this is the first: it works on day one at every company, with no connection, no prices and no cooperation from any vendor.",
    settledBy: 'It is drawn.',
    closedBy: 'F0 (C-10) — the sheet is a card in group F, with its grouping as a live control.',
  },
  {
    n: 5,
    title: 'The batch ledger and the document inbox',
    why: 'Where captured documents and batches live between capture and use. B2, B3, D1s, E3 and G2 all point into it.',
    settledBy: 'A card that decides where a captured document waits and what a batch looks like at rest.',
  },
  {
    n: 6,
    title: 'The onboarding questionnaire',
    why: 'The 17 dimensions asked in the distributor\'s own language, as a live structure the UI derives from. It is what makes group K true, and no card draws it.',
    settledBy: 'The puzzle phase, which derives the questionnaire from the assembled reduction.',
  },
  {
    n: 7,
    title: 'Outbound broadcast',
    why: 'D2s sends a list to many customers; D1 models channels as inbound only. Who receives it, on which channel, what the message is, and what a reply to it is.',
    settledBy: 'A founder sentence on who the disponible list goes to and how a reply lands.',
  },
  {
    n: 8,
    title: 'Order editing',
    why: 'D3.edit is a configuration, and the method says editing is unsettled. A3 resolves a line and A13 shows a change\'s consequences; neither edits an order.',
    settledBy: 'A card that decides what editing an order means after it is confirmed.',
  },
  {
    n: 9,
    title: 'D3.reply and the nota de venta',
    why: 'Two things the brief lists and never draws: answering a customer question that is not an order, and the lonja settlement note, which in fish carries cost and traceability origin on one sheet.',
    settledBy: 'A real nota de venta from one lonja house, and a decision on where a reply lands after the hand-off.',
  },
  {
    n: 10,
    title: 'The use-class',
    why: '«White fish for the plancha». D3s ranks substitutes by it in fish, and it exists in no dimension — D4 and D6 model identity, not interchangeability.',
    settledBy: 'A dimension for interchangeability, or a decision that the ranking is learned from history alone.',
  },
  {
    n: 11,
    title: 'Who may see cost',
    why: 'F3 puts cost and margin on a warehouse phone; F1 shows quantities only; C6 shows cost at the desk. No role or visibility model exists anywhere in the brief.',
    settledBy: 'A role model, or a founder sentence that the warehouse sees cost.',
  },
  {
    n: 12,
    title: 'What the ERP does with columns it has no field for',
    why: 'Fish and meat files carry lote and traceability columns the receiving program may have no field for. G3 states the file is ordinary; it does not state what it contains.',
    settledBy: 'One real column map from one real ERP.',
  },
  {
    n: 13,
    title: 'Cold chain',
    why: 'A van carrying fish or meat is carrying a cold chain, and some distributors record a temperature at the drop. It is in neither D17 nor I3.',
    settledBy: 'A founder sentence on whether a temperature is recorded at the door.',
  },
  {
    n: 14,
    title: 'What happens when a volume commitment is missed',
    why: 'Revert, invoice the difference, or renegotiate. The brief\'s own open 6. C10\'s outcome buttons stand as ghosts inside its positive space until it lands.',
    settledBy: 'The founder naming the outcome, or naming that it varies and is a configuration.',
  },
  {
    n: 15,
    title: 'Which cost-control systems accept an import, and in what format',
    why: "The brief's own open 5. It gates H4, the most commercially valuable card in the catalogue, so H4's buttons are drawn ghosted until it is answered.",
    settledBy: 'A list of target systems the founder can confirm are real, with one file format each.',
  },
  {
    n: 16,
    title: 'The meat cast',
    why: 'No meat SKU, supplier or customer was named anywhere, which blocked drawing any meat screen at full fidelity — and a third of the sector thesis with it.',
    settledBy: 'The founder naming the meat products and one meat supplier.',
    closedBy: 'data/cast.ts (C-9) — provisional names carry a flag, and replacing them is one edit to one file and zero screens.',
  },
  {
    n: 17,
    title: 'The route',
    why: 'I3 shows stops «in route order». Who puts them in that order is in no situation.',
    settledBy: 'A card that decides how a round is composed and ordered.',
  },
  {
    n: 18,
    title: "The account's own surfaces",
    why: 'Settings, plan and people sit outside groups A–K entirely.',
    settledBy: 'A decision on whether the account surfaces belong in this catalogue at all.',
  },
];

export const openOf = (n: number): OpenRegion | undefined => OPENS.find((o) => o.n === n);
