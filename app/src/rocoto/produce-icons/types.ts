/* GROWN from Base Web's own `src/template-component/types.ts` — same prop idiom, same overrides
 * contract, same `$`-prefixed shared style props.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type { Override } from 'baseui/helpers/overrides';
import type { SIZE, FAMILY, FORM } from './constants';

export type Size = keyof typeof SIZE;
export type Family = keyof typeof FAMILY;
export type Form = keyof typeof FORM;

export type ProduceIconOverrides = {
  /** the lockup: an inline box the size of the icon, so it sits on a line of text */
  Root?: Override;
  /** the drawing itself */
  Svg?: Override;
};

export type ProduceIconProps = {
  /** what kind of thing it is — the one prop that is never optional */
  family: Family;
  /** how it is sold. A form this family does not have falls back to the family's own default. */
  form?: Form;
  /** «merluza», «gamba-roja», «aguacate» — a bespoke silhouette if one has been drawn, and
   *  otherwise ignored, so naming a species can only ever improve the drawing. */
  species?: string;
  /** 16 · 20 · 24 · 32, as positions on Base's sizing scale */
  size?: Size;
  /** single-ink rendering: the drawing takes `currentColor` at three densities. For the print
   *  sheet, and for any context quiet enough that the goods should not be in colour. */
  mono?: boolean;
  /** the accessible name. Absent, the icon is decorative and hidden from screen readers —
   *  which is right beside a product name it would otherwise read twice. */
  title?: string;
  overrides?: ProduceIconOverrides;
};

export type SharedStyleProps = {
  $size: Size;
  $mono: boolean;
  $family: Family;
  $form: Form;
};
