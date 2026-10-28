/* GROWN from Base Web's own `src/template-component/index.ts` — same export shape, so a consumer
 * imports a Rocoto chart exactly the way it imports a Base component.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 */
export { default as LineChart } from './line-chart';
export { default as BarChart } from './bar-chart';
export { default as AreaChart } from './area-chart';
// The frame the three share — exported so a fourth chart is grown on it rather than beside it
export { default as ChartFrame, EMPTY_TEXT } from './chart-frame';
export type { Dims, LegendEntry, TooltipDatum, ChartFrameProps } from './chart-frame';
// Constants
export { SIZE, DASH, CURVE, BASELINE } from './constants';
// Reading aids
export { ValueGrid, ValueAxis, LabelAxis, HoverRule, HoverBand, HoverDot } from './marks';
// Styled elements
export {
  Root as StyledRoot,
  Title as StyledTitle,
  Plot as StyledPlot,
  Legend as StyledLegend,
  LegendItem as StyledLegendItem,
  LegendMark as StyledLegendMark,
  Tooltip as StyledTooltip,
  TooltipInner as StyledTooltipInner,
  TooltipLabel as StyledTooltipLabel,
  TooltipRow as StyledTooltipRow,
  TooltipName as StyledTooltipName,
  Empty as StyledEmpty,
  Live as StyledLive,
  metrics,
  plotInk,
  dashArray,
} from './styled-components';
export type { Ink, Margin, Metrics } from './styled-components';
// Types
export * from './types';
