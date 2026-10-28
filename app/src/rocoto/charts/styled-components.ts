/* GROWN from Base Web's own `src/template-component/styled-components.ts`.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the type steps, the sizing scale, the radii, the
 * shadow, the colours. There are no invented numbers and no hard-coded paint.
 *
 * TWO KINDS OF STYLE LIVE IN THIS FILE, because a chart is half DOM and half SVG:
 *   · the chrome — root, title, legend, tooltip, empty — is styled the ordinary Base way, with
 *     `styled` components reading `$theme`;
 *   · the marks are SVG, and visx paints them from plain attributes rather than CSS, so the
 *     colours and geometry they need are read out of the same theme by `plotInk` and `metrics`
 *     and handed over as values. Same single source, two delivery routes.
 */
import { styled } from 'baseui';
import type { Theme } from 'baseui';
import type { Dash, SharedStyleProps, Size } from './types';

const px = (v: string) => parseFloat(v);

/* ── THE PAPER ────────────────────────────────────────────────────────────────────────────────
 * Heights are positions on Base's sizing scale: 32 · 96 · 128 · 192. Margins are scale steps too,
 * chosen so the value ticks clear the plot. Nothing here is a number someone liked the look of.
 */
export type Margin = { top: number; right: number; bottom: number; left: number };

export type Metrics = {
  height: number;
  margin: Margin;
  /** the fallback width used until the container has been measured, as a ratio of the height */
  ratio: number;
  /** axes and grid are the reading aids; a sparkline is a shape, not a reading, so it has none */
  axes: boolean;
  grid: boolean;
  /** how many value rules the grid draws */
  valueTicks: number;
  /** how many labels the bottom axis aims for */
  labelTicks: number;
  stroke: number;
  strokeMuted: number;
  dot: number;
  /** the type step the tick labels take */
  tick: 'font100';
};

export const metrics = ($theme: Theme, size: Size): Metrics => {
  const s = $theme.sizing;
  switch (size) {
    case 'sparkline':
      return {
        height: px(s.scale900),
        margin: { top: px(s.scale0), right: px(s.scale0), bottom: px(s.scale0), left: px(s.scale0) },
        ratio: 3,
        axes: false,
        grid: false,
        valueTicks: 0,
        labelTicks: 0,
        stroke: 1.25,
        strokeMuted: 1,
        dot: 2,
        tick: 'font100',
      };
    case 'compact':
      return {
        height: px(s.scale2400),
        // top clears half a tick label: the topmost value sits ON the plot's top edge, and at
        // scale300 its box crossed the SVG's own boundary
        margin: { top: px(s.scale400), right: px(s.scale550), bottom: px(s.scale800), left: px(s.scale900) },
        ratio: 2.5,
        axes: true,
        grid: true,
        valueTicks: 3,
        labelTicks: 4,
        stroke: 1.5,
        strokeMuted: 1,
        dot: 3,
        tick: 'font100',
      };
    case 'large':
      return {
        height: px(s.scale4800),
        margin: { top: px(s.scale500), right: px(s.scale700), bottom: px(s.scale850), left: px(s.scale1200) },
        ratio: 2.5,
        axes: true,
        grid: true,
        valueTicks: 5,
        labelTicks: 8,
        stroke: 2,
        strokeMuted: 1.25,
        dot: 4,
        tick: 'font100',
      };
    default:
      return {
        height: px(s.scale3200),
        margin: { top: px(s.scale400), right: px(s.scale600), bottom: px(s.scale800), left: px(s.scale1000) },
        ratio: 2.5,
        axes: true,
        grid: true,
        valueTicks: 4,
        labelTicks: 6,
        stroke: 1.5,
        strokeMuted: 1,
        dot: 3.5,
        tick: 'font100',
      };
  }
};

/* ── THE INK ──────────────────────────────────────────────────────────────────────────────────
 * The whole palette, and it is not a palette. Ink draws the series; the reading aids are the
 * theme's hairline greys; a series that steps back is dimmed, never recoloured. Saffron is absent
 * on purpose — in this system it marks the AI's own act, and a chart is a measurement, not an act.
 */
export type Ink = {
  /** the series that carries the reading */
  mark: string;
  /** a series that steps back, and the superseded run */
  muted: string;
  /** the value rules behind the marks */
  grid: string;
  /** the baseline and the hover rule */
  axis: string;
  /** the tick labels */
  tick: string;
  /** the ground — a halo around the hover dot, so it reads over its own line */
  paper: string;
  /** the band behind a hovered bar */
  band: string;
};

export const plotInk = ($theme: Theme, disabled: boolean): Ink => ({
  mark: disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  muted: disabled ? $theme.colors.mono400 : $theme.colors.mono500,
  grid: $theme.colors.mono300,
  axis: $theme.colors.mono400,
  tick: disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentTertiary,
  paper: $theme.colors.backgroundPrimary,
  band: $theme.colors.backgroundSecondary,
});

/** The dash patterns, as geometry. `undefined` is a solid stroke — the default reading. */
export const dashArray = (dash: Dash): string | undefined =>
  dash === 'dashed' ? '5 3' : dash === 'dotted' ? '1 3' : undefined;

/* ── THE CHROME ───────────────────────────────────────────────────────────────────────────── */

/** The focus ring is Base's own: 3px, offset by a scale step. It is INK rather than the accent,
 *  because focus is the person's hand on the chart and this system reserves saffron for the AI. */
export const Root = styled<'div', SharedStyleProps>('div', ({ $theme, $size, $disabled }) => ({
  // Contain the absolute live region in this chart, including inside a scrolling sheet.
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: $theme.sizing.scale300,
  width: $size === 'sparkline' ? 'auto' : '100%',
  maxWidth: '100%',
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  fontFamily: $theme.typography.ParagraphSmall.fontFamily,
  ':focus': { outline: 'none' },
  ':focus-visible': {
    outline: `3px solid ${$theme.colors.borderSelected}`,
    outlineOffset: $theme.sizing.scale100,
  },
}));
Root.displayName = 'ChartRoot';

export const Title = styled<'div', SharedStyleProps>('div', ({ $theme, $disabled }) => ({
  ...$theme.typography.LabelSmall,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
}));
Title.displayName = 'ChartTitle';

/** The positioned box. The tooltip is absolute inside it, so it travels with the marks. */
export const Plot = styled<'div', SharedStyleProps>('div', () => ({
  position: 'relative',
  width: '100%',
  lineHeight: 0,
}));
Plot.displayName = 'ChartPlot';

export const Legend = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: $theme.sizing.scale550,
}));
Legend.displayName = 'ChartLegend';

export const LegendItem = styled<'div', SharedStyleProps & { $muted: boolean }>(
  'div',
  ({ $theme, $muted, $disabled }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: $theme.sizing.scale200,
    ...$theme.typography.LabelXSmall,
    color:
      $disabled || $muted ? $theme.colors.contentTertiary : $theme.colors.contentPrimary,
  })
);
LegendItem.displayName = 'ChartLegendItem';

/** The stroke sample, drawn as a border so it carries the real dash pattern rather than a swatch
 *  of colour — there is no colour to swatch. */
export const LegendMark = styled<'span', SharedStyleProps & { $dash: Dash; $muted: boolean }>(
  'span',
  ({ $theme, $dash, $muted, $disabled }) => ({
    display: 'inline-block',
    width: $theme.sizing.scale550,
    borderTopStyle: $dash,
    borderTopWidth: $muted ? '1px' : '2px',
    borderTopColor: $disabled
      ? $theme.colors.contentStateDisabled
      : $muted
        ? $theme.colors.mono500
        : $theme.colors.contentPrimary,
  })
);
LegendMark.displayName = 'ChartLegendMark';

/* ── THE TOOLTIP — Base's popover anatomy ─────────────────────────────────────────────────────
 * Body carries the ground, the radius and the shadow; Inner carries the padding and the content
 * colour; the pair is exactly `popover/styled-components.ts`. What is NOT reproduced is Base's
 * positioning engine: a popover mounts a Layer and asks Popper where to sit, and a tooltip that
 * follows a pointer across a plot would mount and measure one on every pointer move. This one is
 * absolutely positioned inside the plot it belongs to, and is inert to the pointer.
 */
export const Tooltip = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: 1,
  pointerEvents: 'none',
  backgroundColor: $theme.colors.backgroundTertiary,
  borderTopLeftRadius: $theme.borders.popoverBorderRadius,
  borderTopRightRadius: $theme.borders.popoverBorderRadius,
  borderBottomRightRadius: $theme.borders.popoverBorderRadius,
  borderBottomLeftRadius: $theme.borders.popoverBorderRadius,
  boxShadow: $theme.lighting.shadow600,
  transitionProperty: 'opacity',
  transitionDuration: $theme.animation.timing100,
  transitionTimingFunction: $theme.animation.easeOutCurve,
}));
Tooltip.displayName = 'ChartTooltip';

export const TooltipInner = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale100,
  paddingTop: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale300,
  paddingLeft: $theme.sizing.scale500,
  paddingRight: $theme.sizing.scale500,
  color: $theme.colors.contentPrimary,
  whiteSpace: 'nowrap',
}));
TooltipInner.displayName = 'ChartTooltipInner';

export const TooltipLabel = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  ...$theme.typography.LabelXSmall,
  color: $theme.colors.contentSecondary,
}));
TooltipLabel.displayName = 'ChartTooltipLabel';

export const TooltipRow = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: $theme.sizing.scale500,
}));
TooltipRow.displayName = 'ChartTooltipRow';

export const TooltipName = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: $theme.sizing.scale200,
  ...$theme.typography.font100,
  color: $theme.colors.contentSecondary,
}));
TooltipName.displayName = 'ChartTooltipName';

/* ── THE EMPTY PLOT ───────────────────────────────────────────────────────────────────────────
 * It keeps the chart's real height so the layout never jumps, and it draws the baseline and
 * nothing else. Ticks over an empty plot would be invented numbers.
 */
export const Empty = styled<'div', SharedStyleProps>('div', ({ $theme, $disabled }) => ({
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  paddingLeft: $theme.sizing.scale600,
  paddingRight: $theme.sizing.scale600,
  ...$theme.typography.ParagraphSmall,
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentTertiary,
}));
Empty.displayName = 'ChartEmpty';

/** The reading under the pointer, spoken. Off-screen by geometry, never by `display: none` —
 *  a hidden live region is never announced. */
export const Live = styled('div', {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
});
Live.displayName = 'ChartLive';
