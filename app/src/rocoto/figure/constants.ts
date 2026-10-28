/* GROWN from Base Web's own `src/template-component/` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base has no numeric display primitive.
 */
export const SIZE = {
  mini: 'mini',
  compact: 'compact',
  default: 'default',
  large: 'large',
  display: 'display',
} as const;

/* THE DECIMAL HIERARCHY (Monzo, read off Split: `60.`00, `472.`00, `254.`65 — the cents render
 * markedly smaller than the units). `subordinate` is the house style and the default; `full`
 * is the opt-out for the rare place where the fraction carries as much as the units. */
export const DECIMAL_SCALE = {
  subordinate: 'subordinate',
  full: 'full',
} as const;
