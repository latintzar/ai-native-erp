/* THE LINE CHART — a run of readings, in ink.
 *
 * GROWN on Base Web's own component anatomy (`src/template-component/`): overrides contract,
 * `$`-prefixed shared style props, `data-baseweb` stamp, `index.ts` export shape. Base Web is MIT,
 * Copyright (c) Uber Technologies, Inc. Base ships no chart; the scales and the path generator
 * come from visx, which owns the maths and draws nothing on its own.
 *
 * WHAT IT CARRIES:
 *   · No palette. A second series is told apart by its STROKE — dashed, dotted, thinner — the way
 *     a printed chart does it. Colour here would have to mean something, and in this system the
 *     only thing colour means is that the AI acted.
 *   · One emphasis. `emphasis` names the single series that carries the reading; every other
 *     series steps back to the hairline weight. Naming it takes one name, so a chart cannot
 *     emphasise two things and end up emphasising nothing.
 *   · The supersede law, made visible. A run marked `superseded` is drawn dimmed and dashed
 *     underneath the run that replaced it — yesterday stays legible under today, exactly as the
 *     Figure keeps the number it replaced struck through beside it.
 */
import * as React from 'react';
import { Group } from '@visx/group';
import { LinePath } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import { curveLinear, curveMonotoneX, curveStepAfter } from '@visx/curve';
import ChartFrame from './chart-frame';
import type { Dims, LegendEntry, TooltipDatum } from './chart-frame';
import { HoverDot, HoverRule, LabelAxis, ValueAxis, ValueGrid } from './marks';
import { dashArray } from './styled-components';
import type { Ink } from './styled-components';
import type { Curve, LineChartProps, LineSeries, Point } from './types';

const CURVES = {
  linear: curveLinear,
  monotone: curveMonotoneX,
  step: curveStepAfter,
};

export const curveOf = (curve: Curve) => CURVES[curve];

/** A domain that never collapses. One flat run would otherwise divide by zero and print a line
 *  through the middle of nothing. */
export const spread = (values: number[]): [number, number] => {
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min !== max) return [min, max];
  const pad = Math.abs(min) > 0 ? Math.abs(min) / 8 : 1;
  return [min - pad, max + pad];
};

const LineChart = (props: LineChartProps) => {
  const {
    series,
    emphasis,
    curve = 'linear',
    formatX,
    size = 'default',
    decimals = 0,
    locale = 'es-ES',
    ...rest
  } = props;

  const drawn = series.filter((s) => s.data.length > 0);
  const isEmpty = drawn.length === 0;

  /* the run the pointer and the arrow keys walk: the emphasised one when there is one, otherwise
   * the first run that has not been superseded */
  const lead: LineSeries | undefined =
    drawn.find((s) => s.name === emphasis) ?? drawn.find((s) => !s.superseded) ?? drawn[0];

  const muted = (s: LineSeries) => !!s.superseded || (!!emphasis && s.name !== emphasis);
  const dashOf = (s: LineSeries) => s.dash ?? (s.superseded ? 'dashed' : 'solid');

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const label = formatX ?? ((value: number) => number.format(value));
  const formatValue = (value: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : decimals,
    }).format(value);

  const build = (dims: Dims) => {
    const xs = drawn.flatMap((s) => s.data.map((d) => d.x));
    const ys = drawn.flatMap((s) => s.data.map((d) => d.y));
    return {
      xScale: scaleLinear<number>({ domain: spread(xs), range: [0, dims.innerWidth] }),
      yScale: scaleLinear<number>({
        domain: spread(ys),
        range: [dims.innerHeight, 0],
        nice: true,
      }),
    };
  };

  const legend: LegendEntry[] = drawn.map((s) => ({
    name: s.name,
    dash: dashOf(s),
    muted: muted(s),
  }));

  const renderMarks = (dims: Dims, ink: Ink, active: number | null) => {
    const { xScale, yScale } = build(dims);
    const x = (d: Point) => xScale(d.x) ?? 0;
    const y = (d: Point) => yScale(d.y) ?? 0;

    /* drawing order IS the hierarchy: superseded runs first, then the runs that stepped back,
     * then the run that carries the reading, so the reading is never crossed by a hairline */
    const rank = (s: LineSeries) => (s.superseded ? 0 : muted(s) ? 1 : 2);
    const order = [...drawn].sort((a, b) => rank(a) - rank(b));
    const dots = !!lead && lead.data.length <= 12 && dims.m.axes;
    // A scale's numTicks is a suggestion and may return nearly twice that number. Use actual
    // readings at a bounded count so date labels remain separate and never repeat rounded dates.
    const readings = [...new Set(drawn.flatMap((series) => series.data.map((point) => point.x)))].sort((a, b) => a - b);
    const labelCount = Math.min(readings.length, dims.m.labelTicks, Math.max(2, Math.floor(dims.innerWidth / 72)));
    const labelValues = labelCount <= 1 ? readings.slice(0, labelCount) : Array.from({ length: labelCount }, (_, index) =>
      readings[Math.round(index * (readings.length - 1) / (labelCount - 1))]);

    return (
      <Group left={dims.margin.left} top={dims.margin.top}>
        <ValueGrid scale={yScale} innerWidth={dims.innerWidth} ink={ink} m={dims.m} />
        {active != null && lead && lead.data[active] && (
          <HoverRule x={x(lead.data[active])} height={dims.innerHeight} ink={ink} />
        )}
        {order.map((s) => (
          <LinePath<Point>
            key={s.name}
            data={s.data}
            x={x}
            y={y}
            curve={curveOf(curve)}
            stroke={muted(s) ? ink.muted : ink.mark}
            strokeWidth={muted(s) ? dims.m.strokeMuted : dims.m.stroke}
            strokeDasharray={dashArray(dashOf(s))}
            strokeLinecap={dashOf(s) === 'dotted' ? 'round' : 'butt'}
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {dots &&
          order
            .filter((s) => !muted(s))
            .map((s) =>
              s.data.map((d, i) => (
                <circle
                  key={`${s.name}-${i}`}
                  cx={x(d)}
                  cy={y(d)}
                  r={Math.max(1.5, dims.m.dot - 1.5)}
                  fill={ink.mark}
                />
              ))
            )}
        <ValueAxis scale={yScale} ink={ink} m={dims.m} format={formatValue} />
        <LabelAxis
          scale={xScale}
          ink={ink}
          m={dims.m}
          top={dims.innerHeight}
          tickValues={labelValues}
          format={(value) => label(Number(value))}
        />
        {active != null && lead && lead.data[active] && (
          <HoverDot x={x(lead.data[active])} y={y(lead.data[active])} ink={ink} m={dims.m} />
        )}
      </Group>
    );
  };

  const indexAt = (innerX: number, dims: Dims): number | null => {
    if (!lead || !lead.data.length) return null;
    const { xScale } = build(dims);
    const at = xScale.invert(Math.max(0, Math.min(dims.innerWidth, innerX)));
    let best = 0;
    for (let i = 1; i < lead.data.length; i++) {
      if (Math.abs(lead.data[i].x - at) < Math.abs(lead.data[best].x - at)) best = i;
    }
    return best;
  };

  const tooltipAt = (index: number, dims: Dims) => {
    if (!lead || !lead.data[index]) return null;
    const { xScale, yScale } = build(dims);
    return { x: xScale(lead.data[index].x) ?? 0, y: yScale(lead.data[index].y) ?? 0 };
  };

  const tooltipFor = (index: number): TooltipDatum | null => {
    if (!lead || !lead.data[index]) return null;
    const rows = drawn
      .filter((s) => s.data[index])
      .map((s) => ({
        name: drawn.length > 1 ? s.name : undefined,
        dash: drawn.length > 1 ? dashOf(s) : undefined,
        muted: muted(s),
        value: s.data[index].y,
      }));
    return { label: label(lead.data[index].x), rows };
  };

  return (
    <ChartFrame
      baseName="line-chart"
      size={size}
      decimals={decimals}
      locale={locale}
      slots={lead ? lead.data.length : 0}
      isEmpty={isEmpty}
      legend={legend}
      renderMarks={renderMarks}
      indexAt={indexAt}
      tooltipAt={tooltipAt}
      tooltipFor={tooltipFor}
      {...rest}
    />
  );
};

export default LineChart;
