/* GROWN from Base Web's own `src/template-component/` scaffold — same file layout, same prop
 * idiom, same overrides contract. Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import type { Override } from 'baseui/helpers/overrides';
import type { SIZE, DECIMAL_SCALE } from './constants';

export type Size = keyof typeof SIZE;
export type DecimalScale = keyof typeof DECIMAL_SCALE;

export type FigureOverrides = {
  Root?: Override;
  /** the superseded figure, struck through */
  Was?: Override;
  /** the figure itself — wraps Integer and Fraction */
  Value?: Override;
  /** the units of the figure: everything left of the decimal separator */
  Integer?: Override;
  /** the separator and the digits after it — subordinate by default */
  Fraction?: Override;
  /** the unit — always on the figure's own line */
  Unit?: Override;
};

export type FigureProps = {
  /** the number now */
  value: number;
  /** the number this one replaced. Present = superseded; the pair states the direction. */
  was?: number;
  /** «€/kg», «kg», «cajas» — shares the figure's line, never a line of its own */
  unit?: string;
  size?: Size;
  /** decimal places; money is 2, counts are 0 */
  decimals?: number;
  /**
   * How the fraction sits against the units. `subordinate` (the default, the house style) renders
   * the separator and the decimals at a fixed proportion of the figure's own size, so the units
   * read as the number and the decimals read as its tail. `full` keeps one size throughout.
   */
  decimalScale?: DecimalScale;
  /** BCP 47 tag for grouping and the decimal comma. Spain by default. */
  locale?: string;
  /**
   * THE NUMBER IS AN ABOUT (§17.4 · §17.8). «We have about 60 boxes» is a claim a house really
   * makes, and drawing it as «60» would be the software adding a precision nobody offered — so
   * the tilde rides the units, on the number's own line, exactly as the unit does. It is not a
   * status and it takes no colour: an approximate figure is a correct figure.
   */
  approx?: boolean;
  overrides?: FigureOverrides;
};

export type SharedStyleProps = {
  $size: Size;
  $superseded: boolean;
  $decimalScale: DecimalScale;
};
