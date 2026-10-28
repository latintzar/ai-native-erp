/* THE MARGIN DESK — the canonical screen behind C3 and C4.
 *
 * `D8.margin` is one sentence of arithmetic — today's cost, plus a margin, is the price — and the
 * whole of this screen is that sentence made visible while a hand moves it. C3 is the sentence
 * with one margin in it. C4 is the same sentence with a column of them under a lock, and it is a
 * CONTROL delta and nothing else: the cost, the arithmetic, the disclosure and the copy are the
 * same object, and only the thing that moves the margin changes.
 *
 * THE COST IS A LOCKUP, NOT A NUMBER. «Today's cost» is one contract figure in a meat house and a
 * blend across this morning's landings in a fish house (SECTORS §4), so the Figure carries a
 * disclosure that opens in place and names the lotes behind it. That disclosure is the
 * catalogue's one surviving control delta between the sectors, and it is drawn as ONE control in
 * two states rather than as two screens: live where the day landed more than once, and a plain
 * statement of the single lote where it did not.
 *
 * THE UNIT SHARES THE NUMBER'S LINE, on the cost and on the price alike, at 320px as well as at
 * 1440px. `Figure` is the only thing that draws a number here.
 *
 * P4 owns this file. C3 is its origin; C4 instantiates it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Figure } from '../../rocoto/figure';
import type { Cast, Product } from '../data/cast';
import { batchOf, familyOf, supplierOf } from '../data/cast';
import Name from '../shell/Name';

/* ── THE ARITHMETIC ───────────────────────────────────────────────────────────────────────────
 * Two lines, exported, because the card's copy quotes them and the founder should be able to
 * check the screen against them. */

/** One landing of one product: the lote it came in on, how much of it, and what it cost. */
export type Landing = { id: string; qty: number; cost: number };

/** Today's cost, when the day landed more than once: every kilo weighted by what it cost. */
export const blendedCost = (landings: Landing[]): number => {
  const qty = landings.reduce((s, l) => s + l.qty, 0);
  if (qty === 0) return 0;
  return landings.reduce((s, l) => s + l.qty * l.cost, 0) / qty;
};

/** Cost plus a percentage. The whole of `D8.margin`. */
export const priceFrom = (cost: number, margin: number): number => cost * (1 + margin / 100);

/** THE LANDINGS BEHIND TODAY'S COST.
 *
 * `cast.ts` holds one batch per product, which is the state of the batch ledger at rest. A market
 * morning is not at rest: the same species comes off more than one boat before the orders land,
 * and that is exactly why the fish house's cost is a blend and the meat house's is a number. So
 * where the account discovers its cost daily, the morning is drawn as two landings — the cast's
 * own batch, split by the day's spread, under the two lote ids the cast holds. The moment the
 * cast carries a second batch of the priced product, this reads that instead and stops deriving.
 *
 * No name is typed here: every lote id and every cost comes out of `cast.batches`. */
export function todaysLandings(cast: Cast, product: Product, daily: boolean): Landing[] {
  const own = cast.batches.filter((b) => b.product === product.id);
  if (own.length > 1 || !daily) {
    return (own.length ? own : cast.batches.slice(0, 1)).map((b) => ({ id: b.id, qty: b.qty, cost: b.cost }));
  }
  const base = own[0] ?? cast.batches[0];
  const ids = cast.batches.map((b) => b.id);
  const first = Math.round(base.qty * 0.62);
  /* the second boat sold dearer, by the day's own spread. One number, one place. */
  const spread = 1.09;
  return [
    { id: ids[0], qty: first, cost: base.cost },
    { id: ids[1] ?? ids[0], qty: base.qty - first, cost: Math.round(base.cost * spread * 100) / 100 },
  ];
}

/* ── THE TIERS ────────────────────────────────────────────────────────────────────────────────
 * D9.many, read off the cast rather than declared: every customer carries the tier it sits on, so
 * the tiers a house holds ARE the distinct tiers of its customers, and the count on each row is a
 * count of real customers. That is what makes «the size of the act is visible» a fact instead of
 * a caption.
 *
 * `atLeast` grows the set the way a house grows it — the next band in the same series — for the
 * cards whose subject is a tier arriving (C1/C2's «add a tier as a column»). A tier is a band and
 * not a name, so nothing here is a name typed into a screen. */

export type Tier = { id: string; name: string; customers: number };

export function tiersOf(cast: Cast, atLeast = 0): Tier[] {
  const counted = new Map<string, number>();
  for (const c of cast.customers) counted.set(c.tier, (counted.get(c.tier) ?? 0) + 1);
  const tiers: Tier[] = [...counted.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, customers]) => ({ id: name, name, customers }));
  while (tiers.length < atLeast) {
    tiers.push({ id: `tier ${tiers.length + 1}`, name: `tier ${tiers.length + 1}`, customers: 0 });
  }
  return tiers;
}

/* ── THE LIST ─────────────────────────────────────────────────────────────────────────────────
 * `D8.list` holds a written number rather than computing one, and C1/C2 fill a grid with them.
 * The number still has to come from somewhere true, so it is read off the cast in the same three
 * steps B4 uses for a contract cost — the batch this house actually paid, else the order line
 * stepped back by the trade's working margin, else the sector's median batch — and then carried
 * up by the tier's own margin. A typed price is a price that stops being true the moment the cast
 * moves.
 */

const WORKING_MARGIN = 1.42;
const LIST_MARGIN = 30;

/** What this house paid for a product, from the cast. */
export function costOf(cast: Cast, product: Product): number {
  const batch = cast.batches.find((b) => b.product === product.id);
  if (batch) return Math.round((batch.cost + Number.EPSILON) * 100) / 100;
  const line = cast.order.lines.find((l) => l.product === product.id);
  if (line) return Math.round((line.price / WORKING_MARGIN) * 100) / 100;
  const costs = cast.batches.map((b) => b.cost).sort((a, b) => a - b);
  return costs[Math.floor(costs.length / 2)] ?? 0;
}

/** The written price on tier `n` — the cost carried up by the list margin, less the tier's own
 *  step down it. Tier 1 buys most and pays least, which is what a tier IS. */
export function listPrice(cast: Cast, product: Product, tierIndex: number): number {
  const margin = LIST_MARGIN + (TIER_STEP[tierIndex] ?? 0);
  return Math.round(costOf(cast, product) * (1 + margin / 100) * 100) / 100;
}

/** The step each tier stands on, in points of margin off tier 1. The same spread C4's lock keeps. */
export const TIER_STEP = [0, 6, 11, 15];

/** How long a row has sat, by position. Deterministic, so the stale mark is never a coincidence
 *  and the same shelf reads the same way in every screenshot. */
export const AGES = [9, 214, 41, 386, 63];

/* ── THE COST LOCKUP ──────────────────────────────────────────────────────────────────────── */

function CostBlock({
  cast,
  product,
  landings,
  source,
}: {
  cast: Cast;
  product: Product;
  landings: Landing[];
  source: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  const blended = landings.length > 1;
  const cost = blendedCost(landings);
  const lote = familyOf(cast, product).traceability !== 'none' ? landings[0].id : undefined;

  React.useEffect(() => setOpen(false), [cast.sector]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
        Today&rsquo;s cost
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
        <Figure value={cost} unit={`€/${product.unit}`} size="large" />
        {/* THE DISCLOSURE. Live where the day landed twice, a plain statement of the one lote
            where it landed once — the same control, two states, and the card's argument. */}
        {blended ? (
          <Button
            kind={KIND.tertiary}
            size={SIZE.mini}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? 'Hide the lotes' : `Blended across ${landings.length} lotes`}
          </Button>
        ) : (
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {lote ? `One lote · ${lote}` : 'One agreed figure'}
          </span>
        )}
      </div>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>{source}</span>

      {open && (
        <div
          style={{
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius200,
            background: theme.colors.backgroundSecondary,
            padding: theme.sizing.scale400,
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale300,
          }}
        >
          {landings.map((l) => {
            const batch = batchOf(cast, l.id);
            return (
              <div
                key={l.id}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: theme.sizing.scale500, alignItems: 'baseline' }}
              >
                <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>
                  {l.id}
                  {batch ? (
                    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                      {' · '}
                      <Name of={supplierOf(cast, batch.supplier)} />
                      {' · '}
                      {batch.day}
                    </span>
                  ) : null}
                </span>
                <Figure value={l.qty} unit={product.unit} decimals={0} size="compact" />
                <Figure value={l.cost} unit={`€/${product.unit}`} size="compact" />
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale300, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale400 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>
              Every kilo, weighted by what it cost
            </span>
            <Figure value={cost} unit={`€/${product.unit}`} size="compact" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── THE SCREEN ───────────────────────────────────────────────────────────────────────────── */

export type MarginDeskProps = {
  cast: Cast;
  /** the product whose price is being set */
  product: Product;
  /** this morning's landings behind today's cost */
  landings: Landing[];
  /** where today's cost came from, in words — «the lonja, at 05:00» */
  source: React.ReactNode;
  /** why this surface is open now */
  reason?: React.ReactNode;
  /** what moves the margin — one slider on C3, the lock on C4 */
  children: React.ReactNode;
  /** a control above the rows — C4's lock switch */
  control?: React.ReactNode;
  /** what stands beside the arithmetic — the tiers, the orders already taken */
  aside?: React.ReactNode;
};

export default function MarginDesk({
  cast,
  product,
  landings,
  source,
  reason,
  children,
  control,
  aside,
}: MarginDeskProps) {
  const [, theme] = useStyletron();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
      <header style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={theme.typography.HeadingSmall}>
            <Name of={product} />
          </div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {cast.label} · {cast.hour} · sold by the {product.unit}
          </div>
        </div>
        {control}
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

      <CostBlock cast={cast} product={product} landings={landings} source={source} />

      <div
        style={{
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          padding: `${theme.sizing.scale500} ${theme.sizing.scale600}`,
          minWidth: 0,
        }}
      >
        {children}
      </div>

      {aside}
    </div>
  );
}

/** The tail of one margin row: what the margin makes, with its unit on its own line. Shared by
 *  C3's single row and by every row of C4's lock, so the two cards cannot draw the price
 *  differently from each other. */
export function PriceResult({
  cost,
  margin,
  unit,
  was,
}: {
  cost: number;
  margin: number;
  unit: string;
  was?: number;
}) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.sizing.scale100 }}>
      <Figure value={priceFrom(cost, margin)} was={was} unit={unit} size="default" />
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
        {margin.toLocaleString('es-ES', { maximumFractionDigits: 0 })}% on cost
      </span>
    </div>
  );
}
