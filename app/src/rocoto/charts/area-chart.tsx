/* THE AREA CHART — one run of readings, with the quantity under it.
 *
 * GROWN on Base Web's own component anatomy (`src/template-component/`). Base Web is MIT,
 * Copyright (c) Uber Technologies, Inc. The scales and the area generator are visx's.
 *
 * WHAT IT CARRIES:
 *   · One series. An area states a quantity by the ink it spends, and two washes of ink over each
 *     other stop stating anything — so a second run is drawn as a LINE, never a second fill.
 *   · The wash is the same ink as the line, laid on thin. There is no second colour to reach for,
 *     and none is needed: the edge carries the reading, the wash carries the quantity.
 *   · It stands on zero by default. `baseline="min"` exists for series where zero is meaningless,
 *     and it is a deliberate choice rather than a side effect of the data, because an area cut
 *     off above its baseline overstates every change in it.
 */
import * as React from 'react';
import { Group } from '@visx/group';
import { AreaClosed, LinePath } from '@visx/shape';
import { scaleLinear } from '@visx/scale';
import ChartFrame from './chart-frame';
import type { Dims, TooltipDatum } from './chart-frame';
import { HoverDot, HoverRule, LabelAxis, ValueAxis, ValueGrid } from './marks';
import { curveOf, spread } from './line-chart';
import { dashArray } from './styled-components';
import type { Ink } from './styled-components';
import type { AreaChartProps, Point } from './types';

/** How thin the wash is laid on. Ink at a tenth reads as a quantity without competing with the
 *  edge that carries the reading — it is the ink's own opacity, not a second colour. */
const WASH = 0.1;

const AreaChart = (props: AreaChartProps) => {
  const {
    data,
    previous,
    curve = 'linear',
    baseline = 'zero',
    formatX,
    size = 'default',
    decimals = 0,
    locale = 'es-ES',
    ...rest
  } = props;

  const isEmpty = data.length === 0;
  const past = previous && previous.length ? previous : undefined;

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const label = formatX ?? ((value: number) => number.format(value));
  const formatValue = (value: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : decimals,
    }).format(value);

  const build = (dims: Dims) => {
    const points = past ? [...data, ...past] : data;
    const xs = points.map((d) => d.x);
    const ys = points.map((d) => d.y);
    const [low, high] = spread(ys);
    return {
      xScale: scaleLinear<number>({ domain: spread(xs), range: [0, dims.innerWidth] }),
      yScale: scaleLinear<number>({
        domain: baseline === 'zero' ? [Math.min(0, low), Math.max(0, high)] : [low, high],
        range: [dims.innerHeight, 0],
        nice: true,
      }),
    };
  };

  const renderMarks = (dims: Dims, ink: Ink, active: number | null) => {
    const { xScale, yScale } = build(dims);
    const x = (d: Point) => xScale(d.x) ?? 0;
    const y = (d: Point) => yScale(d.y) ?? 0;

    return (
      <Group left={dims.margin.left} top={dims.margin.top}>
        <ValueGrid scale={yScale} innerWidth={dims.innerWidth} ink={ink} m={dims.m} />
        <AreaClosed<Point>
          data={data}
          x={x}
          y={y}
          yScale={yScale}
          curve={curveOf(curve)}
          fill={ink.mark}
          fillOpacity={WASH}
          stroke="none"
        />
        {past && (
          <LinePath<Point>
            data={past}
            x={x}
            y={y}
            curve={curveOf(curve)}
            stroke={ink.muted}
            strokeWidth={dims.m.strokeMuted}
            strokeDasharray={dashArray('dashed')}
            strokeLinejoin="round"
            fill="none"
          />
        )}
        <LinePath<Point>
          data={data}
          x={x}
          y={y}
          curve={curveOf(curve)}
          stroke={ink.mark}
          strokeWidth={dims.m.stroke}
          strokeLinejoin="round"
          fill="none"
        />
        {active != null && data[active] && (
          <HoverRule x={x(data[active])} height={dims.innerHeight} ink={ink} />
        )}
        <ValueAxis scale={yScale} ink={ink} m={dims.m} format={formatValue} />
        <LabelAxis
          scale={xScale}
          ink={ink}
          m={dims.m}
          top={dims.innerHeight}
          format={(value) => label(Number(value))}
        />
        {active != null && data[active] && (
          <HoverDot x={x(data[active])} y={y(data[active])} ink={ink} m={dims.m} />
        )}
      </Group>
    );
  };

  const indexAt = (innerX: number, dims: Dims): number | null => {
    if (!data.length) return null;
    const { xScale } = build(dims);
    const at = xScale.invert(Math.max(0, Math.min(dims.innerWidth, innerX)));
    let best = 0;
    for (let i = 1; i < data.length; i++) {
      if (Math.abs(data[i].x - at) < Math.abs(data[best].x - at)) best = i;
    }
    return best;
  };

  const tooltipAt = (index: number, dims: Dims) => {
    if (!data[index]) return null;
    const { xScale, yScale } = build(dims);
    return { x: xScale(data[index].x) ?? 0, y: yScale(data[index].y) ?? 0 };
  };

  const tooltipFor = (index: number): TooltipDatum | null => {
    const point = data[index];
    if (!point) return null;
    return {
      label: label(point.x),
      rows: [{ value: point.y, was: past && past[index] ? past[index].y : undefined }],
    };
  };

  return (
    <ChartFrame
      baseName="area-chart"
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

export default AreaChart;
