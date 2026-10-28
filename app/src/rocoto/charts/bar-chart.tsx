/* THE BAR CHART — a category, and how much of it there is.
 *
 * GROWN on Base Web's own component anatomy (`src/template-component/`). Base Web is MIT,
 * Copyright (c) Uber Technologies, Inc. The band scale and the rect generator are visx's; every
 * mark is Rocoto's.
 *
 * WHAT IT CARRIES:
 *   · Bars are ink. `emphasis` names the one bar that carries the reading and the rest dim —
 *     dimming, not recolouring, because a second colour in this system would say the AI did it.
 *   · The bar a value replaced is drawn as a dashed hairline across the band, where the bar used
 *     to end. It reads over the ink bar as well as over the paper, so the comparison survives
 *     whichever way the value moved — the Figure's supersede law, in bar form.
 *   · Bars stand on zero, always. A bar chart cut off above its baseline turns a small difference
 *     into a cliff, so the value domain includes zero even when the readings do not.
 */
import * as React from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleBand, scaleLinear } from '@visx/scale';
import ChartFrame from './chart-frame';
import type { Dims, TooltipDatum } from './chart-frame';
import { HoverBand, LabelAxis, ValueAxis, ValueGrid } from './marks';
import type { Ink } from './styled-components';
import type { BarChartProps, BarDatum } from './types';

/** the padding between bands: dense data closes the gaps rather than shrinking the bars away */
const bandPadding = (count: number) => (count > 24 ? 0.15 : count > 12 ? 0.24 : 0.32);

const BarChart = (props: BarChartProps) => {
  const {
    data,
    emphasis,
    size = 'default',
    decimals = 0,
    locale = 'es-ES',
    ...rest
  } = props;

  const isEmpty = data.length === 0;
  const muted = (d: BarDatum) => !!emphasis && d.label !== emphasis;

  const formatValue = (value: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : decimals,
    }).format(value);

  const build = (dims: Dims) => {
    const values = data.flatMap((d) => (d.previous === undefined ? [d.value] : [d.value, d.previous]));
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    return {
      xScale: scaleBand<string>({
        domain: data.map((d) => d.label),
        range: [0, dims.innerWidth],
        padding: bandPadding(data.length),
      }),
      yScale: scaleLinear<number>({
        domain: [min, max === min ? min + 1 : max],
        range: [dims.innerHeight, 0],
        nice: true,
      }),
    };
  };

  const renderMarks = (dims: Dims, ink: Ink, active: number | null) => {
    const { xScale, yScale } = build(dims);
    const zero = yScale(0) ?? dims.innerHeight;
    const band = xScale.bandwidth();
    const step = data.length ? dims.innerWidth / data.length : dims.innerWidth;
    /* every band gets its label while the labels have room to stand; past that the axis strides
     * them. The cap is the plot's own width, not a fixed tick count — a count would drop labels
     * off an eight-bar chart that had space for all eight. */
    const room = Math.max(2, Math.floor(dims.innerWidth / 44));
    const stride = Math.max(1, Math.ceil(data.length / room));
    const ticks = data.map((d) => d.label).filter((_, i) => i % stride === 0);
    const crossesZero = (yScale.domain()[0] as number) < 0;

    return (
      <Group left={dims.margin.left} top={dims.margin.top}>
        <ValueGrid scale={yScale} innerWidth={dims.innerWidth} ink={ink} m={dims.m} />
        {active != null && data[active] && (
          <HoverBand x={active * step} width={step} height={dims.innerHeight} ink={ink} />
        )}
        {data.map((d, i) => {
          const left = xScale(d.label) ?? 0;
          const value = yScale(d.value) ?? zero;
          return (
            <Bar
              key={d.label}
              x={left}
              y={Math.min(value, zero)}
              width={band}
              height={Math.max(1, Math.abs(value - zero))}
              fill={muted(d) ? ink.muted : ink.mark}
            />
          );
        })}
        {/* where the bar used to end */}
        {data.map((d) =>
          d.previous === undefined ? null : (
            <line
              key={`${d.label}-was`}
              x1={xScale(d.label) ?? 0}
              x2={(xScale(d.label) ?? 0) + band}
              y1={yScale(d.previous) ?? zero}
              y2={yScale(d.previous) ?? zero}
              stroke={ink.muted}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )
        )}
        {crossesZero && (
          <line x1={0} x2={dims.innerWidth} y1={zero} y2={zero} stroke={ink.axis} strokeWidth={1} />
        )}
        <ValueAxis scale={yScale} ink={ink} m={dims.m} format={formatValue} />
        <LabelAxis
          scale={xScale}
          ink={ink}
          m={dims.m}
          top={dims.innerHeight}
          format={(value) => String(value)}
          tickValues={ticks}
        />
      </Group>
    );
  };

  const indexAt = (innerX: number, dims: Dims): number | null => {
    if (!data.length) return null;
    const step = dims.innerWidth / data.length;
    const i = Math.floor(innerX / step);
    return Math.max(0, Math.min(data.length - 1, i));
  };

  const tooltipAt = (index: number, dims: Dims) => {
    const d = data[index];
    if (!d) return null;
    const { xScale, yScale } = build(dims);
    const zero = yScale(0) ?? dims.innerHeight;
    const value = yScale(d.value) ?? zero;
    return { x: (xScale(d.label) ?? 0) + xScale.bandwidth() / 2, y: Math.min(value, zero) };
  };

  const tooltipFor = (index: number): TooltipDatum | null => {
    const d = data[index];
    if (!d) return null;
    return { label: d.label, rows: [{ value: d.value, was: d.previous }] };
  };

  return (
    <ChartFrame
      baseName="bar-chart"
      size={size}
      decimals={decimals}
      locale={locale}
      slots={data.length}
      isEmpty={isEmpty}
      renderMarks={renderMarks}
      indexAt={indexAt}
      tooltipAt={tooltipAt}
      tooltipFor={tooltipFor}
      {...rest}
    />
  );
};

export default BarChart;
