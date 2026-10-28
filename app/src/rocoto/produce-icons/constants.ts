/* GROWN from Base Web's own `src/template-component/` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships no imagery primitive — its icon set is UI
 * chrome (chevrons, spinners, checks) and these are goods.
 *
 * THE TAXONOMY (THE-INTELLIGENCE §7): family × form, plus an optional species slug for the
 * silhouettes worth drawing by hand. Eight families, and per family only the forms that a trade
 * actually distinguishes — a fish is sold whole, filleted, in loins or diced; a bird is sold
 * whole, in pieces or as wings; cheese and rice have one form each and pretending otherwise would
 * invent distinctions the counter does not make.
 */
export const SIZE = {
  mini: 'mini',
  compact: 'compact',
  default: 'default',
  large: 'large',
} as const;

/** every size is a position on Base's own sizing scale — 16 · 20 · 24 · 32 */
export const SIZE_STEP = {
  mini: 'scale600',
  compact: 'scale700',
  default: 'scale800',
  large: 'scale900',
} as const;

export const FAMILY = {
  fish: 'fish',
  shellfish: 'shellfish',
  meat: 'meat',
  poultry: 'poultry',
  fruit: 'fruit',
  vegetable: 'vegetable',
  dairy: 'dairy',
  dry: 'dry',
} as const;

export const FORM = {
  whole: 'whole',
  fillet: 'fillet',
  loin: 'loin',
  diced: 'diced',
  peeled: 'peeled',
  chunk: 'chunk',
  steak: 'steak',
  minced: 'minced',
  pieces: 'pieces',
  wings: 'wings',
  bunch: 'bunch',
  box: 'box',
  generic: 'generic',
} as const;

type FamilyKey = keyof typeof FAMILY;
type FormKey = keyof typeof FORM;

/** the forms each family is actually sold in — the resolver reads this, so a form a family does
 *  not have (fish · minced) falls back to that family's default rather than drawing nothing */
export const FORMS: Record<FamilyKey, readonly FormKey[]> = {
  fish: ['whole', 'fillet', 'loin', 'diced'],
  shellfish: ['whole', 'peeled'],
  meat: ['chunk', 'steak', 'diced', 'minced', 'pieces'],
  poultry: ['whole', 'pieces', 'wings'],
  fruit: ['whole', 'bunch', 'box'],
  vegetable: ['whole', 'bunch', 'box'],
  dairy: ['generic'],
  dry: ['generic'],
};

/** THE NEVER-EMPTY RULE. Every family has a form that always draws, so no lookup can end in a
 *  blank square: a product whose form nobody has recorded still shows its family. */
export const DEFAULT_FORM: Record<FamilyKey, FormKey> = {
  fish: 'whole',
  shellfish: 'whole',
  meat: 'chunk',
  poultry: 'whole',
  fruit: 'whole',
  vegetable: 'whole',
  dairy: 'generic',
  dry: 'generic',
};

/** the drawing grid. Every path in this component is authored against 24 × 24 and nothing else,
 *  so the whole set shares one optical weight at every size. */
export const GRID = 24;
