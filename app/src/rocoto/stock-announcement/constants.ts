/* GROWN from Base Web's own `src/template-component/` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base has no instrument for a declaration that means
 * two different things depending on which of two modes it is submitted in.
 */

/** The two modes. Both take the SAME typed number; only the meaning of submit changes. */
export const MODE = {
  /** the number IS the stock — a statement of the level */
  now: 'now',
  /** the number is added to the stock — a statement of an arrival */
  add: 'add',
} as const;

/** Where the number in the entry came from. This is an attribution, not a status. */
export const SOURCE = {
  /** somebody typed it */
  hand: 'hand',
  /** a document was read and proposed it — the machine's own act */
  document: 'document',
} as const;

/** The document's journey from the camera to the chip. */
export const PHOTO_STATUS = {
  /** nothing attached */
  none: 'none',
  /** the picture is being read; the chip holds its place */
  attaching: 'attaching',
  /** the chip stands, and it can be previewed or thrown away */
  attached: 'attached',
} as const;

/* ── THE BEATS (FEED-IA §115.5 · §115.6 — «I'm describing it like a film») ────────────────────
 * «I want to see the field where they choose the product or take a photo, then choose it, and
 * then it shows how much stock they just added and the number they are choosing.»
 *
 * Three beats, one scene each. The panel plays them in order; a panel given no goods to name
 * opens on the second, which is exactly the instrument that stood here before.
 */
export const BEAT = {
  /** the field where they choose the product, or take a photo */
  name: 'name',
  /** the goods are chosen, so the panel asks the one number */
  amount: 'amount',
  /** «you just added X» — the number, said back */
  landed: 'landed',
} as const;

/** What evidences a stock number on the paper trail. */
export const EVIDENCE = {
  /** an incoming albarán arrived by email and moved the number on its own */
  feed: 'feed',
  /** somebody photographed a document */
  document: 'document',
} as const;

/** Whether incoming documents reach the trail on their own. */
export const FEED = {
  connected: 'connected',
  off: 'off',
} as const;

/* THE MODE SENTENCES — the founder's own words, and the tab label IS the sentence (2026-08-22,
 * THE-ALBARAN-THESIS §5). They are first person because the person is telling us something: the
 * tab is not a filter over a list, it is the claim being made. Overridable through `labels` for a
 * surface too narrow to carry them, never shortened here. */
export const MODE_LABEL: Record<keyof typeof MODE, string> = {
  now: "I'm telling you how much we have now",
  add: "I'm telling you how much we just added",
};

/** The verb on the button, which is the whole thing that changes between the modes. */
export const SUBMIT_LABEL: Record<keyof typeof MODE, string> = {
  now: 'Set stock',
  add: 'Add to stock',
};

/** THE LANDING'S OWN SENTENCE, in his words (§115.5: «it shows how much stock they just added and
 *  the number»). It stands OVER the figure, so the figure is what the sentence is about. */
export const LANDED_LABEL: Record<keyof typeof MODE, string> = {
  now: 'Stock is now',
  add: 'You just added',
};

/** How long the closing preview is given before it leaves — Base's Modal number, and the one
 *  Overlay Card already travels on, so a preview never unmounts mid-exit. */
export const EXIT_DELAY_MS = 500;
