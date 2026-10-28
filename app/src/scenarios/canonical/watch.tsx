/* THE WATCH — the canonical screen behind C9b and C10.
 *
 * A promise was made in the past and the world has moved since. This screen is how the product
 * shows a standing arrangement without asking anybody to do anything about it: progress against
 * the quantity agreed, and the fixed price laid over the cost it was fixed against.
 *
 * IT IS A WATCHING SCREEN (BUILD-PLAN §3.4), and that is a design decision with teeth: C9b has no
 * controls at all, and an agent who adds a button to it has broken the card's subject. What C10
 * adds is not a control on the watching — it is the lapse decision, which is a different act.
 *
 * THE CHART EARNS ITS PLACE because it carries the decision C10 will make. Cost against the fixed
 * price over the period is the only chart in group C, and a reader who sees the two lines cross
 * already knows what C10 is for. Two series are told apart by STROKE, never by colour: this
 * product has no traffic light, and «under water» is a fact stated in words on the row.
 *
 * P4 owns this file. C9b is its origin; C10 is a control delta on it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { ProgressBar, SIZE as BAR_SIZE } from 'baseui/progress-bar';
import { LineChart } from '../../rocoto/charts';
import { Figure } from '../../rocoto/figure';
import type { Cast, Customer, Product } from '../data/cast';
import { customerOf, productOf } from '../data/cast';
import Name from '../shell/Name';

/* ── THE ARRANGEMENT ──────────────────────────────────────────────────────────────────────── */

export type Arrangement = {
  customer: Customer;
  product: Product;
  /** the price fixed at the moment of agreement (C9a) */
  price: number;
  /** the quantity agreed over the whole period */
  agreedQty: number;
  /** what they have actually taken so far */
  takenQty: number;
  /** the period, in the words the arrangement is written in */
  period: string;
  /** how far through the period the day is, 0–1 */
  elapsed: number;
  /** the cost, day by day, over the period so far */
  costs: Array<{ x: number; y: number }>;
};

/** Where the quantity should stand if they were taking it evenly across the period. The
 *  arrangement's own pace, so «behind» is a fact and not a feeling. */
export const paceQty = (a: Arrangement): number => a.agreedQty * a.elapsed;

/** What they are behind by, in the product's own unit. */
export const shortfall = (a: Arrangement): number => Math.max(0, paceQty(a) - a.takenQty);

/** Today's cost — the last reading on the series. */
export const costToday = (a: Arrangement): number => a.costs[a.costs.length - 1]?.y ?? 0;

/** The margin the fixed price leaves at today's cost, in points. */
export const marginToday = (a: Arrangement): number => {
  const c = costToday(a);
  return c === 0 ? 0 : ((a.price - c) / c) * 100;
};

/* ── THE ARRANGEMENT ON SCREEN ────────────────────────────────────────────────────────────────
 * C9b and C10 watch the SAME arrangement at two moments, so it is built once, here, out of the
 * cast: the customer is Distribuciones Vera, the line is the sector's own first product, and the
 * price it was fixed at is the batch cost the cast holds plus the margin the house was on when
 * the deal was signed. No name is typed.
 *
 * THE COST SERIES IS DETERMINISTIC — a fixed walk rather than a random one — because the chart is
 * read in screenshots and a chart that redraws itself differently on every load cannot be
 * reviewed. The walk's shape is the sector's own: fish moves every morning, fruit weekly, meat
 * barely at all.
 */

/** How hard the cost moves, by sector, and how far into the period today stands. */
const TEMPO: Record<string, { swing: number; elapsed: number; days: number; period: string }> = {
  fish: { swing: 0.22, elapsed: 0.68, days: 90, period: '22.08 to 20.11' },
  meat: { swing: 0.05, elapsed: 0.55, days: 180, period: '22.08 to 18.02' },
  fruit: { swing: 0.12, elapsed: 0.6, days: 120, period: '22.08 to 20.12' },
};

/** The share of the agreed quantity actually taken — behind the pace in every sector, because
 *  that is the situation C10 exists for. */
const TAKEN: Record<string, number> = { fish: 0.44, meat: 0.41, fruit: 0.46 };

const FIXED_MARGIN = 24;

export function arrangementOf(cast: Cast): Arrangement {
  const customer = customerOf(cast, 'vera');
  const product = productOf(cast, cast.order.lines[0].product);
  const batch = cast.batches.find((b) => b.product === product.id) ?? cast.batches[0];
  const base = batch.cost;
  const tempo = TEMPO[cast.sector];

  /* the deal was signed off the cost of the day it was signed */
  const price = Math.round(base * (1 + FIXED_MARGIN / 100) * 100) / 100;

  const readings = 24;
  const costs = Array.from({ length: readings }, (_, i) => {
    const t = i / (readings - 1);
    /* two waves of different lengths: a season under a week. Fixed, so the chart is the same
       chart every time it is drawn. */
    const wave = Math.sin(t * Math.PI * 1.15) * 0.7 + Math.sin(t * Math.PI * 6) * 0.3;
    return {
      x: Math.round(t * tempo.days * tempo.elapsed),
      y: Math.round(base * (1 + tempo.swing * wave) * 100) / 100,
    };
  });

  const agreedQty = cast.sector === 'fish' ? 2400 : cast.sector === 'meat' ? 3600 : 3000;

  return {
    customer,
    product,
    price,
    agreedQty,
    takenQty: Math.round(agreedQty * TAKEN[cast.sector]),
    period: tempo.period,
    elapsed: tempo.elapsed,
    costs,
  };
}

/* ── THE SCREEN ───────────────────────────────────────────────────────────────────────────── */

export type WatchProps = {
  cast: Cast;
  arrangement: Arrangement;
  /** why this arrangement is on screen now */
  reason?: React.ReactNode;
  /** the decision, where there is one. C9b passes none, and that is C9b's subject. */
  decision?: React.ReactNode;
  /** what stands around it */
  aside?: React.ReactNode;
  /** the plot's width — given explicitly so the chart draws at a known size on every surface */
  chartWidth?: number;
};

export default function Watch({
  cast,
  arrangement,
  reason,
  decision,
  aside,
  chartWidth = 620,
}: WatchProps) {
  const [, theme] = useStyletron();
  const { customer, product, price, agreedQty, takenQty, period, costs } = arrangement;
  const progress = Math.min(100, Math.round((takenQty / agreedQty) * 100));
  const pace = Math.round((paceQty(arrangement) / agreedQty) * 100);
  const margin = marginToday(arrangement);
  const behind = shortfall(arrangement);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
      <header style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={theme.typography.HeadingSmall}>
            <Name of={customer} />
          </div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            <Name of={product} /> · {period} · {cast.label}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
            The price they hold
          </div>
          <Figure value={price} unit={`€/${product.unit}`} size="large" />
        </div>
      </header>

      {reason && (
        <div
          style={{
            borderLeft: `3px solid ${theme.colors.contentPrimary}`,
            paddingLeft: theme.sizing.scale500,
            ...theme.typography.ParagraphSmall,
          }}
        >
          {reason}
        </div>
      )}

      {/* ── progress against the quantity agreed ── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
            Taken against the quantity agreed
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400 }}>
            <Figure value={takenQty} unit={product.unit} decimals={0} size="default" />
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary }}>
              of {agreedQty.toLocaleString('es-ES')} {product.unit}
            </span>
          </div>
        </div>
        {/* THE BAR IS INK. Base fills a progress bar with the theme's accent, and in this product
            the accent is saffron — which marks the AI's own act and nothing else. A customer
            taking goods they agreed to take is not the AI acting, so the fill is ink. */}
        <ProgressBar
          value={progress}
          size={BAR_SIZE.large}
          getProgressLabel={() => `${progress}% taken`}
          successValue={100}
          overrides={{
            BarProgress: {
              style: ({ $theme }) => ({ backgroundColor: $theme.colors.contentPrimary }),
            },
          }}
        />
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          The pace the period sets is {pace}% by today.{' '}
          {behind > 0
            ? `They stand ${behind.toLocaleString('es-ES', { maximumFractionDigits: 0 })} ${product.unit} behind it.`
            : 'They are ahead of it.'}
        </span>
      </section>

      {/* ── the fixed price, laid over the cost it was fixed against ── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <LineChart
            title={`Cost against the fixed price · ${period}`}
            width={chartWidth}
            height={220}
            unit={`€/${product.unit}`}
            decimals={2}
            emphasis="Cost"
            formatX={(v) => `day ${v}`}
            series={[
              { name: 'Cost', data: costs },
              {
                name: 'The fixed price',
                dash: 'dashed',
                data: costs.map((p) => ({ x: p.x, y: price })),
              },
            ]}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
            At today&rsquo;s cost of{' '}
            {costToday(arrangement).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            €/{product.unit}, the price they hold leaves
          </span>
          <Figure value={margin} unit="% margin" decimals={1} size="default" />
        </div>
      </section>

      {decision}
      {aside}
    </div>
  );
}
