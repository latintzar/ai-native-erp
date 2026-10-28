/* THE FIGURE — the figure lockup.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs; the
 * component is Rocoto's, because Base ships no numeric display primitive and this product is made
 * almost entirely of numbers that changed.
 *
 * WHAT IT CARRIES:
 *   · The decimal hierarchy. The units are the number and the decimals are its tail, so the
 *     fraction renders at 0.65 of the figure's own size — the Monzo reading of 60,00 · 472,00 ·
 *     254,65. `decimalScale="full"` opts out; `subordinate` is the house style and the default.
 *   · The supersede law, made visible. A price that changed keeps its predecessor struck through
 *     beside it, so yesterday stays legible under today. The pair states the direction — no arrow,
 *     no colour. Colour here would be a traffic light, and this product has none.
 *   · The unit shares the figure's line. Always. A rate unit denominates the number, so a «/kg»
 *     dropped to a second line quotes a price the reader will misread.
 *   · Tabular figures, so a column of these aligns on the separator without a monospace face —
 *     and it still aligns with the fraction shrunk, because a smaller run of tabular digits is
 *     still a run of EQUAL digits: every row's fraction is the same width, so every row's
 *     separator lands at the same distance from the right edge.
 */
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import {
  Root as StyledRoot,
  Was as StyledWas,
  Value as StyledValue,
  Integer as StyledInteger,
  Fraction as StyledFraction,
  Unit as StyledUnit,
} from './styled-components';
import type { FigureProps, SharedStyleProps } from './types';

/* Intl formatters are expensive to build and this component renders dozens to a screen, so the
 * few (locale, decimals) pairs a screen uses are built once. */
const FORMATTERS = new Map<string, Intl.NumberFormat>();
const formatter = (locale: string, decimals: number) => {
  const key = `${locale}|${decimals}`;
  let f = FORMATTERS.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    FORMATTERS.set(key, f);
  }
  return f;
};

/** the whole number, one string — what the superseded figure and any full-scale figure need */
export const format = (n: number, decimals: number, locale: string) =>
  formatter(locale, decimals).format(n);

/**
 * Split at the locale's own decimal separator, and keep the separator WITH the fraction — it is
 * the mark that the units have ended, so it belongs to what follows it. `formatToParts` is what
 * makes this locale-true: es-ES yields `1.412` + `,` + `05`, en-US yields `1,412` + `.` + `05`,
 * and nothing here ever has to know which character that was. The sign and the group separators
 * stay with the units, where they belong.
 */
export const splitFigure = (n: number, decimals: number, locale: string): [string, string] => {
  const parts = formatter(locale, decimals).formatToParts(n);
  const at = parts.findIndex((p) => p.type === 'decimal');
  if (at === -1) return [parts.map((p) => p.value).join(''), ''];
  return [
    parts.slice(0, at).map((p) => p.value).join(''),
    parts.slice(at).map((p) => p.value).join(''),
  ];
};

const Figure = (props: FigureProps) => {
  const {
    value,
    was,
    unit,
    size = 'default',
    decimals = 2,
    decimalScale = 'subordinate',
    locale = 'es-ES',
    approx = false,
    overrides = {},
  } = props;

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Was, wasProps] = getOverrides(overrides.Was, StyledWas);
  const [Value, valueProps] = getOverrides(overrides.Value, StyledValue);
  const [Integer, integerProps] = getOverrides(overrides.Integer, StyledInteger);
  const [Fraction, fractionProps] = getOverrides(overrides.Fraction, StyledFraction);
  const [Unit, unitProps] = getOverrides(overrides.Unit, StyledUnit);

  const superseded = was !== undefined && was !== value;
  const shared: SharedStyleProps = { $size: size, $superseded: superseded, $decimalScale: decimalScale };
  const [units, fraction] = splitFigure(value, decimals, locale);

  return (
    <Root
      data-baseweb="figure"
      data-approx={approx ? 'yes' : undefined}
      /* WHAT IT SAYS OUT LOUD. The tilde is a glyph a reader hears as nothing, so the whole
         lockup names itself once — «about 60 cajas» — and the parts inside are then decoration
         a screen reader is spared. */
      aria-label={approx ? `about ${format(value, decimals, locale)}${unit ? ` ${unit}` : ''}` : undefined}
      {...shared}
      {...rootProps}
    >
      {superseded && (
        // aria-hidden: a screen reader should hear the number that stands, not the one struck out.
        // The change itself is announced by the row's own label, not by reading two figures.
        // It is never split: see the note on Was in styled-components.
        <Was aria-hidden="true" {...shared} {...wasProps}>
          {format(was as number, decimals, locale)}
        </Was>
      )}
      <Value {...shared} {...valueProps}>
        {/* THE ABOUT RIDES THE UNITS (§17.4). It is part of the number, not a label beside it, so
            it takes the units' own size and travels with them at every width. */}
        <Integer {...shared} {...integerProps}>{approx ? `~${units}` : units}</Integer>
        {fraction !== '' && <Fraction {...shared} {...fractionProps}>{fraction}</Fraction>}
      </Value>
      {unit && (
        <Unit {...shared} {...unitProps}>
          {unit}
        </Unit>
      )}
    </Root>
  );
};

export default Figure;
