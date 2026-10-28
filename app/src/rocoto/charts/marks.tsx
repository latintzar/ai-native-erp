/* THE READING AIDS — the marks that are the same on every Rocoto chart.
 *
 * The grid, the two axes, the hover rule, the hover band and the hover dot. They are separated
 * from the three charts for the same reason the frame is: a bar chart's axis and a line chart's
 * axis are the same axis, and the moment they are two pieces of code they start to differ.
 *
 * Base Web has no chart, so nothing here is forked from it — but every value is read from Base's
 * theme through the `Ink` and `Metrics` the frame resolved, and the tick labels take a Base type
 * step with tabular figures, so a column of ticks aligns without a monospace face.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { AxisBottom, AxisLeft } from '@visx/axis';
import type { AxisScale } from '@visx/axis';
import { GridRows } from '@visx/grid';
import type { Ink, Metrics } from './styled-components';

type TickStyle = {
  fill: string;
  fontFamily: string;
  fontSize: string;
  style: React.CSSProperties;
};

const useTickStyle = (ink: Ink, m: Metrics): TickStyle => {
  const [, theme] = useStyletron();
  const step = theme.typography[m.tick];
  return {
    fill: ink.tick,
    fontFamily: step.fontFamily as string,
    fontSize: step.fontSize as string,
    style: { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' },
  };
};

/** The value rules. Horizontal only: a vertical rule under a line chart fights the line it is
 *  meant to help read. */
export function ValueGrid({
  scale,
  innerWidth,
  ink,
  m,
}: {
  scale: AxisScale;
  innerWidth: number;
  ink: Ink;
  m: Metrics;
}) {
  if (!m.grid) return null;
  return (
    <GridRows
      scale={scale}
      width={innerWidth}
      numTicks={m.valueTicks}
      stroke={ink.grid}
      strokeWidth={1}
    />
  );
}

/** The value axis: labels only. The rules already carry the eye across, so the axis line and the
 *  ticks would be two more strokes saying the same thing. */
export function ValueAxis({
  scale,
  ink,
  m,
  format,
}: {
  scale: AxisScale;
  ink: Ink;
  m: Metrics;
  format: (value: number) => string;
}) {
  const tick = useTickStyle(ink, m);
  if (!m.axes) return null;
  return (
    <AxisLeft
      scale={scale}
      numTicks={m.valueTicks}
      hideAxisLine
      hideTicks
      // the ticks are hidden, so their 8px length would only be a gap nobody asked for; the gap
      // that IS wanted is set on the label itself, which keeps the plot's left edge predictable
      tickLength={0}
      tickFormat={(value) => format(Number(value))}
      tickLabelProps={() => ({ ...tick, textAnchor: 'end', dx: '-0.5em', dy: '0.28em' })}
    />
  );
}

/** The label axis, and the baseline the marks stand on. */
export function LabelAxis({
  scale,
  ink,
  m,
  top,
  format,
  tickValues,
  maxTicks,
}: {
  scale: AxisScale;
  ink: Ink;
  m: Metrics;
  top: number;
  format: (value: number | string) => string;
  tickValues?: Array<number | string>;
  maxTicks?: number;
}) {
  const tick = useTickStyle(ink, m);
  if (!m.axes) return null;
  return (
    <AxisBottom
      top={top}
      scale={scale}
      numTicks={maxTicks == null ? m.labelTicks : Math.min(m.labelTicks, maxTicks)}
      hideTicks
      // same reason as the value axis: with the ticks hidden their length is dead space, and here
      // it was dead space the plot did not have — the labels ran off the bottom of the SVG
      tickLength={0}
      stroke={ink.axis}
      strokeWidth={1}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tickValues={tickValues as any}
      tickFormat={(value) => format(value as number | string)}
      tickLabelProps={(_value, index, values) => ({
        ...tick,
        // Continuous end ticks sit on the plot edge; anchor their labels inside the paper.
        textAnchor: !('bandwidth' in scale) && index === 0 ? 'start'
          : !('bandwidth' in scale) && index === values.length - 1 ? 'end' : 'middle',
        dy: '0.5em',
      })}
    />
  );
}

/** The hover rule on a continuous chart: one hairline standing on the reading. */
export function HoverRule({ x, height, ink }: { x: number; height: number; ink: Ink }) {
  return <line x1={x} x2={x} y1={0} y2={height} stroke={ink.axis} strokeWidth={1} />;
}

/** The hover band on a categorical chart: the bar's own column, lit. */
export function HoverBand({
  x,
  width,
  height,
  ink,
}: {
  x: number;
  width: number;
  height: number;
  ink: Ink;
}) {
  return <rect x={x} y={0} width={width} height={height} fill={ink.band} />;
}

/** The reading itself. The halo is the paper colour, so the dot reads over its own line. */
export function HoverDot({
  x,
  y,
  ink,
  m,
}: {
  x: number;
  y: number;
  ink: Ink;
  m: Metrics;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={m.dot + 2} fill={ink.paper} />
      <circle cx={x} cy={y} r={m.dot} fill={ink.mark} />
    </g>
  );
}
