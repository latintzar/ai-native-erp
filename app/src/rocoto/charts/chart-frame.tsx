/* THE CHART FRAME — the paper all three Rocoto charts are printed on.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`: the overrides contract, the
 * `$`-prefixed shared style props and the `data-baseweb` stamp are Base's. Base Web is MIT,
 * Copyright (c) Uber Technologies, Inc.
 *
 * WHY ONE FRAME AND THREE CHARTS: the line, the bar and the area differ only in the marks. The
 * paper, the axes, the tick figures, the hover, the tooltip, the empty plot, the skeleton, the
 * focus ring and the keyboard are identical, and identical things should be one piece of code —
 * otherwise the third chart quietly grows its own tooltip and the system has two grammars.
 *
 * WHAT IT GUARANTEES, for every chart:
 *   · the plot keeps its real height in every state, so nothing on the page jumps when the
 *     numbers arrive, when they turn out to be absent, or when the chart is disabled;
 *   · an empty plot draws the baseline and says what will be there — it never draws ticks, which
 *     would be numbers nobody measured;
 *   · loading is Base's own Skeleton at the plot's real size, not a spinner over a blank box;
 *   · the pointer and the arrow keys drive the SAME active reading, and the reading is spoken
 *     into a live region, so the chart is readable without a pointer and without eyes.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { getOverrides } from 'baseui/helpers/overrides';
import { Skeleton } from 'baseui/skeleton';
import { Figure } from '../figure';
import {
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
} from './styled-components';
import type { Ink, Margin, Metrics } from './styled-components';
import type { ChartCommonProps, Dash, SharedStyleProps } from './types';

/** The plot's measurements, resolved. Every chart draws inside `innerWidth × innerHeight`. */
export type Dims = {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margin;
  m: Metrics;
};

export type LegendEntry = { name: string; dash: Dash; muted: boolean };

export type TooltipDatum = {
  /** the reading's own name — the x value, or the bar's label */
  label: string;
  /** `was` is handed straight to the Figure, which strikes the value this one replaced */
  rows: Array<{ name?: string; dash?: Dash; muted?: boolean; value: number; was?: number }>;
};

export type ChartFrameProps = ChartCommonProps & {
  /** the `data-baseweb` stamp, and the chart's name in the accessible label */
  baseName: string;
  /** how many readings the pointer and the arrow keys can land on */
  slots: number;
  isEmpty: boolean;
  legend?: LegendEntry[];
  renderMarks: (dims: Dims, ink: Ink, active: number | null) => React.ReactNode;
  indexAt?: (innerX: number, dims: Dims) => number | null;
  tooltipAt?: (index: number, dims: Dims) => { x: number; y: number } | null;
  tooltipFor?: (index: number) => TooltipDatum | null;
};

/** The sentence an empty plot carries by default. It states what WILL be there — an empty state
 *  that spends its line on what is missing spends it on the wrong subject. */
export const EMPTY_TEXT = 'Readings appear here.';

const ChartFrame = (props: ChartFrameProps) => {
  const {
    baseName,
    slots,
    isEmpty,
    legend,
    renderMarks,
    indexAt,
    tooltipAt,
    tooltipFor,
    title,
    size = 'default',
    width,
    height,
    loading = false,
    disabled = false,
    emptyText = EMPTY_TEXT,
    unit,
    decimals = 0,
    locale = 'es-ES',
    activeIndex,
    onActiveIndexChange,
    overrides = {},
  } = props;

  const [, theme] = useStyletron();
  const m = metrics(theme, size);
  const ink = plotInk(theme, disabled);
  const shared: SharedStyleProps = { $size: size, $disabled: disabled };

  /* A chart with a given width, and every sparkline, is its own size. Everything else measures the
   * container it was dropped into and fills it, because a chart that cannot fill its column is a
   * chart nobody can lay out. Until the first measurement lands it draws at its size's own ratio,
   * so the first paint is a chart rather than a collapsed box. */
  const fluid = width == null && size !== 'sparkline';
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    if (!fluid) return;
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width);
      if (next > 0) setMeasured(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fluid]);

  const plotHeight = height ?? m.height;
  const plotWidth = width ?? (fluid ? measured : null) ?? Math.round(plotHeight * m.ratio);
  const margin = m.margin;
  const dims: Dims = {
    width: plotWidth,
    height: plotHeight,
    innerWidth: Math.max(0, plotWidth - margin.left - margin.right),
    innerHeight: Math.max(0, plotHeight - margin.top - margin.bottom),
    margin,
    m,
  };

  /* THE ACTIVE READING. Uncontrolled by default — the chart tracks its own hover. Pass
   * `activeIndex` and it becomes controlled, which is how the kit shows the hover state as a
   * still. */
  const controlled = activeIndex !== undefined;
  const [internalActive, setInternalActive] = React.useState<number | null>(null);
  const drawn = !disabled && !loading && !isEmpty;
  const rawActive = controlled ? (activeIndex ?? null) : internalActive;
  const active = drawn && rawActive != null && rawActive >= 0 && rawActive < slots ? rawActive : null;
  const interactive = drawn && slots > 0 && !!indexAt;

  const setActive = (next: number | null) => {
    if (!interactive) return;
    if (!controlled) setInternalActive(next);
    if (onActiveIndexChange) onActiveIndexChange(next);
  };

  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !indexAt) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = indexAt(event.clientX - rect.left - margin.left, dims);
    if (next !== active) setActive(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!interactive) return;
    let next: number | null = active;
    if (event.key === 'ArrowRight') next = Math.min(slots - 1, (active == null ? -1 : active) + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, (active == null ? slots : active) - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = slots - 1;
    else if (event.key === 'Escape') next = null;
    else return;
    event.preventDefault();
    setActive(next);
  };

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Title, titleProps] = getOverrides(overrides.Title, StyledTitle);
  const [Plot, plotProps] = getOverrides(overrides.Plot, StyledPlot);
  const [LegendBox, legendProps] = getOverrides(overrides.Legend, StyledLegend);
  const [LegendItem, legendItemProps] = getOverrides(overrides.LegendItem, StyledLegendItem);
  const [LegendMark, legendMarkProps] = getOverrides(overrides.LegendMark, StyledLegendMark);
  const [Tooltip, tooltipProps] = getOverrides(overrides.Tooltip, StyledTooltip);
  const [TooltipInner, tooltipInnerProps] = getOverrides(overrides.TooltipInner, StyledTooltipInner);
  const [TooltipLabel, tooltipLabelProps] = getOverrides(overrides.TooltipLabel, StyledTooltipLabel);
  const [TooltipRow, tooltipRowProps] = getOverrides(overrides.TooltipRow, StyledTooltipRow);
  const [Empty, emptyProps] = getOverrides(overrides.Empty, StyledEmpty);

  const reading = active != null && tooltipFor ? tooltipFor(active) : null;
  const anchor = active != null && tooltipAt ? tooltipAt(active, dims) : null;

  /* The tooltip sits above its reading, and flips below when the reading is near the top edge —
   * a tooltip clipped by the plot's own frame states nothing. */
  const gap = parseFloat(theme.sizing.scale300);
  const anchorTop = anchor ? margin.top + anchor.y : 0;
  const flip = anchorTop < plotHeight / 3;
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const [tooltipWidth, setTooltipWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const width = tooltipRef.current?.getBoundingClientRect().width ?? 0;
    if (width > 0) setTooltipWidth(width);
  });
  const halfTooltip = Math.min(plotWidth / 2, (tooltipWidth || 160) / 2);
  const tooltipStyle: React.CSSProperties | null = anchor
    ? {
        left: `${Math.max(halfTooltip, Math.min(plotWidth - halfTooltip, margin.left + anchor.x))}px`,
        top: `${anchorTop}px`,
        transform: flip ? `translate(-50%, ${gap}px)` : `translate(-50%, calc(-100% - ${gap}px))`,
      }
    : null;

  /* The spoken reading is formatted by the SAME rules as the printed one. An earlier version read
   * the raw value out, so the tooltip showed 39 while the live region said 38.9 — the screen and
   * the screen reader stating different numbers is worse than either one alone. */
  const say = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const spoken = reading
    ? `${reading.label}: ${reading.rows
        .map(
          (row) =>
            `${row.name ? `${row.name} ` : ''}${say.format(row.value)}${unit ? ` ${unit}` : ''}` +
            (row.was === undefined ? '' : `, was ${say.format(row.was)}`)
        )
        .join(', ')}`
    : '';

  return (
    <Root
      data-baseweb={baseName}
      role="figure"
      aria-label={title}
      aria-disabled={disabled || undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onBlur={() => setActive(null)}
      style={fluid ? undefined : { width: `${plotWidth}px` }}
      {...shared}
      {...rootProps}
    >
      {title && (
        <Title {...shared} {...titleProps}>
          {title}
        </Title>
      )}

      <Plot {...shared} {...plotProps}>
        <div ref={boxRef} style={{ width: '100%' }}>
          {loading ? (
            /* Base's own Skeleton, at the plot's real size. The title is known, so it stays; the
             * numbers are not, so nothing pretends to be one. */
            <Skeleton animation width={`${plotWidth}px`} height={`${plotHeight}px`} />
          ) : (
            <svg
              width={plotWidth}
              height={plotHeight}
              role="presentation"
              onPointerMove={handlePointer}
              onPointerLeave={() => setActive(null)}
              style={{ display: 'block', touchAction: 'pan-y' }}
            >
              {isEmpty ? (
                /* the baseline, and nothing else */
                <line
                  x1={margin.left}
                  x2={plotWidth - margin.right}
                  y1={plotHeight - margin.bottom}
                  y2={plotHeight - margin.bottom}
                  stroke={ink.axis}
                  strokeWidth={1}
                />
              ) : (
                renderMarks(dims, ink, active)
              )}
            </svg>
          )}
        </div>

        {isEmpty && !loading && (
          <Empty {...shared} {...emptyProps}>
            {emptyText}
          </Empty>
        )}

        {reading && tooltipStyle && (
          <Tooltip data-testid="chart-tooltip" ref={tooltipRef} style={{ ...tooltipStyle, maxWidth: '100%', boxSizing: 'border-box' }} {...shared} {...tooltipProps}>
            <TooltipInner {...shared} {...tooltipInnerProps}>
              <TooltipLabel {...shared} {...tooltipLabelProps}>
                {reading.label}
              </TooltipLabel>
              {reading.rows.map((row, i) => (
                <TooltipRow key={i} {...shared} {...tooltipRowProps}>
                  {row.name && (
                    <StyledTooltipName {...shared}>
                      <StyledTooltipMarkSlot row={row} shared={shared} />
                      {row.name}
                    </StyledTooltipName>
                  )}
                  <Figure
                    value={row.value}
                    was={row.was}
                    unit={unit}
                    decimals={decimals}
                    locale={locale}
                    size="compact"
                  />
                </TooltipRow>
              ))}
            </TooltipInner>
          </Tooltip>
        )}
      </Plot>

      {legend && legend.length > 1 && (
        <LegendBox {...shared} {...legendProps}>
          {legend.map((entry) => (
            <LegendItem key={entry.name} $muted={entry.muted} {...shared} {...legendItemProps}>
              <LegendMark $dash={entry.dash} $muted={entry.muted} {...shared} {...legendMarkProps} />
              {entry.name}
            </LegendItem>
          ))}
        </LegendBox>
      )}

      <StyledLive aria-live="polite">{spoken}</StyledLive>
    </Root>
  );
};

/** the stroke sample inside a tooltip row — the same mark the series is drawn with */
function StyledTooltipMarkSlot({
  row,
  shared,
}: {
  row: { dash?: Dash; muted?: boolean };
  shared: SharedStyleProps;
}) {
  if (!row.dash) return null;
  return <StyledLegendMark $dash={row.dash} $muted={!!row.muted} {...shared} />;
}

export default ChartFrame;
