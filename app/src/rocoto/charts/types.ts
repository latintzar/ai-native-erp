/* GROWN from Base Web's own `src/template-component/types.ts` — same `$`-prefixed shared style
 * props, same Overrides shape. Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 */
import type { Override } from 'baseui/helpers/overrides';
import type { SIZE, DASH, CURVE, BASELINE } from './constants';

export type Size = keyof typeof SIZE;
export type Dash = keyof typeof DASH;
export type Curve = keyof typeof CURVE;
export type Baseline = keyof typeof BASELINE;

export type ChartOverrides = {
  Root?: Override;
  /** the line above the plot that names what is charted */
  Title?: Override;
  /** the positioned box the marks are printed in */
  Plot?: Override;
  /** shown only when more than one series is drawn */
  Legend?: Override;
  LegendItem?: Override;
  /** the stroke sample — the actual dash the series is drawn with */
  LegendMark?: Override;
  /** Base's popover anatomy: Body carries the ground, the shadow and the radius */
  Tooltip?: Override;
  /** Base's popover Inner: the padding and the content colour */
  TooltipInner?: Override;
  TooltipLabel?: Override;
  TooltipRow?: Override;
  /** what stands in the plot when there is nothing to draw */
  Empty?: Override;
};

/** One reading. `x` is the position on the continuous axis, `y` is the value. */
export type Point = {
  x: number;
  y: number;
};

/** One run of readings. A chart takes several; they are told apart by stroke, never by colour. */
export type LineSeries = {
  /** the series' name — read out in the tooltip, and in the legend once a second series exists */
  name: string;
  data: Point[];
  /** solid, dashed or dotted. This is how two series are told apart when there is no palette. */
  dash?: Dash;
  /** the run this one replaced. Drawn dimmed and dashed underneath, so yesterday stays legible
   *  under today — the same supersede idea the Figure carries for a single number. */
  superseded?: boolean;
};

/** One bar. */
export type BarDatum = {
  /** the category this bar stands for */
  label: string;
  value: number;
  /** the value this bar replaced. Drawn as a hairline outline where the bar used to end. */
  previous?: number;
};

/** Props every Rocoto chart takes. The frame — paper, axes, tooltip, empty and loading — is one
 *  component underneath, so these behave identically on all three. */
export type ChartCommonProps = {
  /** names what is charted. With one series there is no legend: the title does that job. */
  title?: string;
  size?: Size;
  /** fixed plot width in px. Left off, the chart measures its container and fills it. */
  width?: number;
  /** overrides the height its size would give it */
  height?: number;
  /** true while the numbers are still arriving — the frame draws as a skeleton at its real size */
  loading?: boolean;
  /** an inert chart: marks drop to the disabled greys, the pointer and the keyboard do nothing */
  disabled?: boolean;
  /** what stands in the plot when there is no data. Says what will be there, at its real size. */
  emptyText?: string;
  /** a unit for the values — it shares the figure's line in the tooltip, never a line of its own */
  unit?: string;
  /** decimal places in the tooltip */
  decimals?: number;
  /** BCP 47 tag for grouping and the decimal comma */
  locale?: string;
  /** the reading under the pointer, controlled. Left off, the chart tracks its own hover. */
  activeIndex?: number | null;
  /** fires on hover, on arrow keys, and with null when the pointer or the focus leaves */
  onActiveIndexChange?: (index: number | null) => void;
  overrides?: ChartOverrides;
};

export type LineChartProps = ChartCommonProps & {
  series: LineSeries[];
  /** the name of the one series that carries the reading. Every other series steps back to the
   *  hairline weight. One name, so a chart can emphasise exactly one thing. */
  emphasis?: string;
  curve?: Curve;
  /** turns an x value into its axis label. Numbers by default. */
  formatX?: (value: number) => string;
};

export type BarChartProps = ChartCommonProps & {
  data: BarDatum[];
  /** the label of the one bar that carries the reading. Every other bar dims. */
  emphasis?: string;
};

export type AreaChartProps = ChartCommonProps & {
  data: Point[];
  /** the run this one replaced. Drawn as a dimmed dashed line, never a second fill — two washes
   *  of ink over each other stop being readable. */
  previous?: Point[];
  curve?: Curve;
  baseline?: Baseline;
  formatX?: (value: number) => string;
};

export type SharedStyleProps = {
  $size: Size;
  $disabled: boolean;
};
