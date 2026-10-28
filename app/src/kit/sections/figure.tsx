/* Figure — the numeric display primitive. Grown from Base's template-component scaffold
 * (see src/rocoto/figure/); this page demonstrates it like any other component. */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import { Figure } from '../../rocoto/figure';
import type { DecimalScale } from '../../rocoto/figure';

/** the quiet label that names a row of examples — the kit's own furniture, not the component's */
const Caption: React.FC<{ w?: number; align?: 'left' | 'right'; children: React.ReactNode }> = ({
  w = 64, align = 'left', children,
}) => {
  const [, theme] = useStyletron();
  return (
    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, width: w, flex: 'none', textAlign: align }}>
      {children}
    </span>
  );
};

/** the prop, live: pick the scale and watch the same number change hierarchy */
function DecimalScaleDemo() {
  const [scale, setScale] = React.useState<DecimalScale>('subordinate');
  return (
    <div data-testid="figure-live" style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'flex-start', width: '100%' }}>
      <SegmentedControl
        activeKey={scale}
        onChange={({ activeKey }) => setScale(activeKey as DecimalScale)}
      >
        <Segment key="subordinate" label="Subordinate" />
        <Segment key="full" label="Full size" />
      </SegmentedControl>
      <Figure value={254.65} unit="/ unit" size="display" decimalScale={scale} />
    </div>
  );
}

const COLUMN: Array<[number, number | undefined]> = [
  [7.85, undefined],
  [96.2, 91.4],
  [184.6, undefined],
  [1412.05, 1380],
  [23904.5, 24110.2],
];

export default function FigureSection() {
  return (
    <Section
      t="Figure"
      n="Display a number, with its unit and its history. The units are the number and the decimals are its tail, so the fraction renders smaller. A value that changed keeps its predecessor struck through beside it, and the unit always shares the number's line."
    >
      <Grid>
        <Tile
          span={5}
          name="Sizes"
          rule="Five sizes, each a position on Base's own type scale; the struck predecessor and the unit sit one rung below the figure. The decimals hold the same proportion at every rung, because the proportion is a ratio of the figure's own size and not a step down the scale."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            {(['mini', 'compact', 'default', 'large', 'display'] as const).map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <Caption>{s}</Caption>
                <Figure value={254.65} unit="/ unit" size={s} />
              </div>
            ))}
          </div>
        </Tile>

        <Tile
          span={3}
          name="Subordinate decimals"
          rule="The fraction sits at 0.65 of the figure's size — the geometric mean of the five value-to-sub ratios this component's own ramp already states. The separator travels with the decimals, because it is the mark that the units have ended."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <Figure value={60} unit="/ unit" size="large" />
            <Figure value={472} unit="/ unit" size="large" />
            <Figure value={254.65} unit="/ unit" size="large" />
          </div>
        </Tile>

        <Tile
          span={4}
          name="Decimal scale"
          rule="Pick the scale and the same number changes hierarchy. Subordinate is the default and the house style; full size is the opt-out, for the rare figure whose decimals carry as much as its units."
        >
          <DecimalScaleDemo />
        </Tile>

        <Tile
          span={5}
          name="In a column"
          rule="Tabular figures align on the separator without a monospace face, and they still align with the fraction shrunk: a smaller run of equal-width digits is still a run of equal-width digits, so every separator lands the same distance from the right edge. A predecessor extends the lockup leftward, so it never moves the separator either."
        >
          <div style={{ display: 'flex', gap: 32, width: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end' }}>
              <Caption w={120} align="right">plain</Caption>
              <div data-testid="figure-column" style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end' }}>
                {COLUMN.map(([v]) => (
                  <Figure key={v} value={v} size="compact" />
                ))}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end' }}>
              <Caption w={120} align="right">with a predecessor</Caption>
              <div data-testid="figure-column-was" style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-end' }}>
                {COLUMN.map(([v, w]) => (
                  <Figure key={v} value={v} was={w} size="compact" />
                ))}
              </div>
            </div>
          </div>
        </Tile>

        <Tile
          span={3}
          name="Superseded value"
          rule="The previous value stays legible: struck, dimmed, kept. It never splits its own decimals — a strike drawn across two sizes breaks in two, and a predecessor with a hierarchy of its own starts competing with the figure that stands. The pair states the direction of change; no arrow, no colour. A screen reader hears only the value that stands."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
            <Figure value={18.4} was={16.9} unit="/ unit" size="large" />
            <Figure value={11.2} was={13.5} unit="/ unit" size="large" />
            <Figure value={412} was={386} size="default" decimals={0} />
          </div>
        </Tile>

        <Tile
          span={4}
          name="Separator, and whole numbers"
          rule="Which mark ends the units is the locale's decision, read from Intl and never from a hard-coded character. A figure with no decimals has no tail to subordinate, so it renders whole."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, alignItems: 'flex-start' }}>
            {(
              [
                ['es-ES', 2],
                ['en-US', 2],
                ['de-DE', 2],
                ['es-ES', 0],
              ] as const
            ).map(([loc, dec], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <Caption w={86}>{`${loc} · ${dec} dp`}</Caption>
                <Figure value={1412.05} locale={loc} decimals={dec} size="default" />
              </div>
            ))}
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}
