/* GROWN from Base Web's own `src/template-component/` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships no component for words that were said.
 */

export const SIZE = {
  compact: 'compact',
  default: 'default',
} as const;

/* THE TWO HOUSINGS. A card either carries its own surface or borrows one, and which it does is a
 * decision about the surface it lands on, so it is a prop rather than a guess made by CSS.
 *
 *   card  — the card paints itself: ground, radius, padding, hairline. It is whole on its own, so
 *           it can sit in a page's flow or float bare on a layer with nothing around it.
 *   plain — the card drops its surface, because a chromed housing (Base's Modal, with its header,
 *           its close control and its footer) is already supplying one. Two nested surfaces read
 *           as a mistake, and the inner padding doubles the outer padding.
 */
export const HOUSING = {
  card: 'card',
  plain: 'plain',
} as const;
