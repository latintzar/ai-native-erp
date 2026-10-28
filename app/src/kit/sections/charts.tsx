/* CHARTS — Line Chart, Bar Chart, Area Chart. Grown in `src/rocoto/charts/`, because Base Web is
 * the one thing this system adopts whole and Base ships no chart at all. The maths is visx's
 * (Airbnb, MIT, deliberately low-level: it owns the scales and the path generators and draws
 * nothing on its own); every mark on the page is Rocoto's.
 *
 * THE GRAMMAR, in one line: ink marks on paper. The axes and the grid are the theme's hairline
 * greys, the series are ink, and there is no palette — a second series is told apart by its
 * stroke, an emphasised series by its weight, a superseded one by dimming. Saffron never appears:
 * in this system it marks the AI's own act, and a chart is a measurement, not an act.
 *
 * THE DATA IS SEEDED AND NEUTRAL. Every series below comes out of one deterministic generator, so
 * the page paints identically on every open and a screenshot of it can be compared with the last
 * one. The names are Series A and Series B for the same reason the rest of the kit uses Uber's
 * own copy verbatim: a themed demo silently decides which chart serves which moment of the
 * product, and that mapping belongs to the situations catalogue, later, made explicitly.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Section, Tile, Grid } from '../chrome';
import { LineChart, BarChart, AreaChart } from '../../rocoto/charts';
import type { BarDatum, Point } from '../../rocoto/charts';

/* ── SEEDED NEUTRAL DATA ──────────────────────────────────────────────────────────────────────
 * mulberry32: 32 bits of state, no dependency, identical output everywhere. */
const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** a run of readings that wanders but stays legible */
const walk = (seed: number, count: number, start: number, step = 7, drift = 0.4): Point[] => {
  const next = rng(seed);
  const out: Point[] = [];
  let value = start;
  for (let i = 0; i < count; i++) {
    value = Math.max(2, value + (next() - 0.5) * step + drift);
    out.push({ x: i + 1, y: Math.round(value * 10) / 10 });
  }
  return out;
};

const bars = (seed: number, labels: string[], base: number, range: number): BarDatum[] => {
  const next = rng(seed);
  return labels.map((label) => ({ label, value: Math.round(base + next() * range) }));
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const SERIES_A = walk(7, 12, 40);
const SERIES_B = walk(23, 12, 26);
const SERIES_C = walk(91, 12, 33);
const BEFORE = walk(51, 12, 34);
const DENSE = walk(3, 120, 52, 4, 0.12);
const SPARK = walk(11, 24, 20, 5);
const AREA = walk(8, 16, 16, 12);
const AREA_BEFORE = walk(88, 16, 11, 9);
const NARROW = walk(41, 16, 180, 6);

const BARS = bars(5, LETTERS, 40, 60);
const BARS_WAS: BarDatum[] = BARS.map((d, i) => ({
  ...d,
  previous: Math.round(d.value * (i % 2 ? 0.82 : 1.19)),
}));
/** a run that crosses zero, so the baseline has something to be a baseline for */
const deltas = (seed: number, labels: string[], range: number): BarDatum[] => {
  const next = rng(seed);
  return labels.map((label) => ({ label, value: Math.round((next() - 0.45) * range) }));
};

const DELTAS = deltas(101, LETTERS, 60);
const DENSE_BARS = bars(
  13,
  Array.from({ length: 36 }, (_, i) => String(i + 1)),
  30,
  70
);

/** a caption inside a Tile that holds more than one chart */
const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        display: 'block',
        marginBottom: theme.sizing.scale100,
      }}
    >
      {children}
    </span>
  );
};

const Stack: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, width: '100%' }}>
      {children}
    </div>
  );
};

export default function ChartsSection() {
  return (
    <>
      {/* ══ LINE CHART ═══════════════════════════════════════════════════════════════════════ */}
      <Section
        t="Line Chart"
        n="A run of readings over a continuous axis. One series needs no legend — the title names it. Two series are told apart by the stroke, one series may carry the emphasis, and the run it replaced stays legible underneath."
      >
        <Grid>
          <Tile
            span={6}
            name="Default"
            rule="Ink on paper: the series in the theme's ink, the value rules and the baseline in its hairline greys. Value ticks carry tabular figures, so a column of them aligns without a monospace face."
          >
            <LineChart title="Series A" series={[{ name: 'Series A', data: SERIES_A }]} decimals={1} />
          </Tile>

          <Tile
            span={6}
            name="Hover, with the tooltip"
            rule="The pointer and the arrow keys drive the same reading: a hairline stands on it, a dot marks it, and the tooltip is Base's popover anatomy with the value set in a Figure. Held open here with activeIndex so the state stands still."
          >
            <LineChart
              title="Series A"
              series={[{ name: 'Series A', data: SERIES_A }]}
              activeIndex={7}
              decimals={1}
            />
          </Tile>

          <Tile
            span={6}
            name="Two series"
            rule="No palette. The second series is dashed, and the legend shows the actual stroke rather than a swatch of colour — the same distinction a printed chart makes."
          >
            <LineChart
              title="Two readings"
              decimals={1}
              series={[
                { name: 'Series A', data: SERIES_A },
                { name: 'Series B', data: SERIES_B, dash: 'dashed' },
              ]}
            />
          </Tile>

          <Tile
            span={6}
            name="Emphasis"
            rule="One name, so a chart can emphasise exactly one thing. The named series keeps the full ink weight; every other steps back to a hairline and dims."
          >
            <LineChart
              title="Three readings"
              decimals={1}
              emphasis="Series B"
              series={[
                { name: 'Series A', data: SERIES_A },
                { name: 'Series B', data: SERIES_B, dash: 'solid' },
                { name: 'Series C', data: SERIES_C, dash: 'dotted' },
              ]}
            />
          </Tile>

          <Tile
            span={6}
            name="Superseded"
            rule="The run this one replaced is drawn dimmed and dashed underneath, so yesterday stays legible under today. The same supersede law the Figure carries for a single number."
          >
            <LineChart
              title="Series A"
              decimals={1}
              series={[
                { name: 'Now', data: SERIES_A },
                { name: 'Before', data: BEFORE, superseded: true },
              ]}
            />
          </Tile>

          <Tile
            span={6}
            name="Disabled"
            rule="Marks drop to the disabled greys, the pointer and the keyboard do nothing, and the plot keeps its height — an inert chart still holds its place on the page."
          >
            <LineChart title="Series A" series={[{ name: 'Series A', data: SERIES_A }]} decimals={1} disabled />
          </Tile>

          <Tile
            span={12}
            name="Dense"
            rule="120 readings. The grammar adapts on its own: the point markers go, the bottom axis thins its labels, and the stroke is left to carry the shape."
          >
            <LineChart
              title="Series A"
              size="large"
              decimals={1}
              series={[{ name: 'Series A', data: DENSE }]}
            />
          </Tile>

          <Tile
            span={4}
            name="Sparkline"
            rule="The smallest size: a shape, not a reading. No axes, no grid, no tooltip — it sits inside a row of text or beside a Figure."
          >
            <Stack>
              <LineChart size="sparkline" series={[{ name: 'Series A', data: SPARK }]} />
              <LineChart size="sparkline" series={[{ name: 'Series B', data: SERIES_B }]} />
            </Stack>
          </Tile>

          <Tile
            span={4}
            name="Empty"
            rule="An honest empty plot: the real height, the baseline, and a line that says what will be there. Ticks over an empty plot would be numbers nobody measured."
          >
            <LineChart title="Series A" series={[{ name: 'Series A', data: [] }]} />
          </Tile>

          <Tile
            span={4}
            name="Loading"
            rule="Base's own Skeleton at the plot's real size. The title is known so it stays; the numbers are not, so nothing stands in for one."
          >
            <LineChart title="Series A" series={[{ name: 'Series A', data: SERIES_A }]} loading />
          </Tile>
        </Grid>
      </Section>

      {/* ══ BAR CHART ════════════════════════════════════════════════════════════════════════ */}
      <Section
        t="Bar Chart"
        n="A category, and how much of it there is. Bars are ink and stand on zero; one bar may carry the emphasis and the rest dim; where a value replaced an earlier one, a hairline marks where the bar used to end."
      >
        <Grid>
          <Tile
            span={6}
            name="Default"
            rule="Bars in ink, value rules behind them, the baseline at zero. Nothing is rounded, tinted or lit — the height is the whole statement."
          >
            <BarChart title="Series A" data={BARS} />
          </Tile>

          <Tile
            span={6}
            name="Hover, with the tooltip"
            rule="The band under the pointer lights rather than the bar: recolouring the bar would change the very mark being read. Held open here with activeIndex."
          >
            <BarChart title="Series A" data={BARS} activeIndex={4} />
          </Tile>

          <Tile
            span={6}
            name="Emphasis"
            rule="One label carries the reading. Every other bar dims to the recessive grey — dimming, never a second colour."
          >
            <BarChart title="Series A" data={BARS} emphasis="E" />
          </Tile>

          <Tile
            span={6}
            name="Superseded"
            rule="A dashed hairline across the band marks where the bar used to end. It reads over the ink as well as over the paper, so the comparison survives whichever way the value moved."
          >
            <BarChart title="Series A" data={BARS_WAS} />
          </Tile>

          <Tile
            span={6}
            name="Below the baseline"
            rule="Values that fall below zero hang from the zero rule, which is drawn wherever zero lands. Direction is geometry here, never a red bar and a green one."
          >
            <BarChart title="Change" data={DELTAS} />
          </Tile>

          <Tile
            span={6}
            name="Disabled"
            rule="The same inert state as the other two charts: disabled greys, no pointer, no keyboard, full height kept."
          >
            <BarChart title="Series A" data={BARS} disabled />
          </Tile>

          <Tile
            span={12}
            name="Dense"
            rule="36 bars. The gaps close before the bars thin, and the bottom axis strides its labels rather than stacking them on top of each other."
          >
            <BarChart title="Series A" size="large" data={DENSE_BARS} />
          </Tile>

          <Tile span={4} name="Sparkline" rule="Bars at the smallest size: proportion at a glance, no reading aids.">
            <Stack>
              <BarChart size="sparkline" data={BARS} />
              <BarChart size="sparkline" data={DELTAS} />
            </Stack>
          </Tile>

          <Tile span={4} name="Empty" rule="The real height, the baseline, and the sentence. Override it with emptyText.">
            <BarChart title="Series A" data={[]} emptyText="Readings appear here." />
          </Tile>

          <Tile span={4} name="Loading" rule="Skeleton at the plot's real size, so the page holds still when the numbers land.">
            <BarChart title="Series A" data={BARS} loading />
          </Tile>
        </Grid>
      </Section>

      {/* ══ AREA CHART ═══════════════════════════════════════════════════════════════════════ */}
      <Section
        t="Area Chart"
        n="One run of readings, with the quantity under it. The wash is the same ink laid on thin; a second run is drawn as a line, never a second fill; and it stands on zero unless the baseline is moved on purpose."
      >
        <Grid>
          <Tile
            span={6}
            name="Default"
            rule="The edge carries the reading, the wash carries the quantity, and both are the one ink. Anchored at zero, so the ink spent is proportional to the value."
          >
            <AreaChart title="Series A" data={AREA} decimals={1} />
          </Tile>

          <Tile
            span={6}
            name="Hover, with the tooltip"
            rule="Identical to the line chart's, because it is the same frame underneath — one hairline, one dot, Base's popover anatomy, the value in a Figure."
          >
            <AreaChart title="Series A" data={AREA} activeIndex={9} decimals={1} />
          </Tile>

          <Tile
            span={6}
            name="Superseded"
            rule="The run this one replaced is a dimmed dashed line over the wash. Two washes of ink over each other stop stating anything, so the predecessor never gets a fill of its own."
          >
            <AreaChart title="Series A" data={AREA} previous={AREA_BEFORE} decimals={1} />
          </Tile>

          <Tile
            span={6}
            name="Disabled"
            rule="Inert: the wash and the edge drop to the disabled greys, the pointer and the keyboard do nothing."
          >
            <AreaChart title="Series A" data={AREA} decimals={1} disabled />
          </Tile>

          <Tile
            span={6}
            name="Curves"
            rule="linear states exactly what was measured and is the default; monotone smooths without overshooting; step says the value held until it changed."
          >
            <Stack>
              <Caption>linear</Caption>
              <AreaChart size="compact" data={AREA} curve="linear" decimals={1} />
              <Caption>monotone</Caption>
              <AreaChart size="compact" data={AREA} curve="monotone" decimals={1} />
              <Caption>step</Caption>
              <AreaChart size="compact" data={AREA} curve="step" decimals={1} />
            </Stack>
          </Tile>

          <Tile
            span={6}
            name="Baseline"
            rule="The same readings, both ways. Anchored at zero the movement is a ripple; anchored at the minimum it is a mountain range. zero is the default, and min is a choice someone has to make."
          >
            <Stack>
              <Caption>zero</Caption>
              <AreaChart size="compact" data={NARROW} baseline="zero" decimals={1} />
              <Caption>min</Caption>
              <AreaChart size="compact" data={NARROW} baseline="min" decimals={1} />
            </Stack>
          </Tile>

          <Tile
            span={12}
            name="Dense"
            rule="120 readings. The wash reads as the quantity and the edge stays a hairline, so the shape survives at any count."
          >
            <AreaChart title="Series A" size="large" data={DENSE} decimals={1} />
          </Tile>

          <Tile span={4} name="Sparkline" rule="A shape in a row of text. No axes, no grid, no tooltip.">
            <Stack>
              <AreaChart size="sparkline" data={SPARK} />
              <AreaChart size="sparkline" data={AREA} />
            </Stack>
          </Tile>

          <Tile span={4} name="Empty" rule="The real height, the baseline, the sentence.">
            <AreaChart title="Series A" data={[]} />
          </Tile>

          <Tile span={4} name="Loading" rule="Skeleton at the plot's real size.">
            <AreaChart title="Series A" data={AREA} loading />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
