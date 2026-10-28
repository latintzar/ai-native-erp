/* B1 · Capture today's costs by voice.
 * `D7.market-voice` · phone · canonical `spoken-capture` — ORIGIN.
 *
 * THE LONJA AT 05:00: cold, wet, gloved, one hand, and the number is gone in minutes. Fish is the
 * native case and the hardest environment in the product; draw the capture for that and it serves
 * all three sectors. Fruit borrows the same gesture at Mercabarna but usually has a ticket, so it
 * goes to B3. Meat is absent by default — its D7 is `contract` plus `doc-paper` — and that
 * absence is configurable rather than a rule (C-17).
 *
 * BOTH EXITS ARE ON THE CARD (FLOWS §2a). The same spoken row is a LOT COST in a house that
 * records lotes and a DAY PRICE ON THE SKU in one that does not. Same screen, same gesture, two
 * objects at the other end — and the toggle under the rows says which is live under which
 * configuration, rather than the catalogue holding two cards that differ by a database table.
 *
 * REDUCTION: B1 ≡ D1s. D1s is this screen with the destination moved to stock.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import type { ScenarioMeta } from '../meta';
import PhoneChassis from '../chassis/phone';
import SpokenCapture, { CaptureAbsent, type CaptureRow } from '../canonical/spoken-capture';
import RefChip from '../shell/RefChip';
import { GBatchbook, GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import { type Cast, type Product } from '../data/cast';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'B1',
  title: "Capture today's costs by voice",
  group: 'B',
  frame: 'phone',
  ifText: 'cost is discovered at the market each morning and spoken aloud into the phone',
  dims: ['D7.market-voice'],
  job: "Say today's costs aloud at the market and have them land as rows.",
  decides:
    'the outdoor capture gesture — rows appearing as words land, a row that was not heard staying empty with its recording attached, yesterday as a one-press start, and each row carrying its change against yesterday',
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: "the morning's other captures", ref: 'D1s' },
    { region: 'what the cost then does', ref: 'C3' },
  ],
  open: [{ region: 'the batch ledger these rows land in', ref: 'OPEN-5' }],
  primitives: ['U02', 'U03'],
  kit: ['Voice Button', 'Waveform', 'Figure', 'Segmented Control', 'Button', 'Tag', 'Ghost'],
  canonical: 'spoken-capture',
  delta: 'origin',
  deltaText: 'the card that IS the spoken capture; D1s moves the destination and D2s adds the send',
  sector: { fish: '=', meat: '≠', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [2, 3],
  step: 1,
  fills: ['cost'],
  reads: [],
  live:
    'hold the button and rows appear as words land; release and one row stands empty with its recording, which plays back on the row itself; «like yesterday» fills the list in one press; the toggle moves the same rows between a lote cost and a day price on the SKU',
};

/* ── WHAT THE MORNING DID TO THE PRICE ────────────────────────────────────────────────────────
 * A day's move, by position in the list, so the same market opens the same way every time it is
 * opened and the struck figure beside each row is never a coincidence. Fish moves like this: a
 * good landing takes ten per cent off merluza overnight and a poor one puts it back. */
const MOVES = [0.035, -0.062, 0.108, -0.018, 0.052];

/** Yesterday's cost, read from the cast: the batch this house holds, or the order line's price
 *  stepped back by the trade's working margin where no batch names it. */
const WORKING_MARGIN = 1.42;

/** WHERE THE MEDIAN IS USED, IT IS SHAPED. Three products falling back on the same median print
 *  the same figure three times, which reads as a rendering fault rather than as a coincidence, so
 *  the median is stepped by the product's own position in the shelf. Deterministic, so the same
 *  shelf holds the same figures every time it is opened. */
const SPREAD = [1, 0.78, 1.35, 0.92, 1.24];

function yesterdayCost(cast: Cast, product: Product, index: number): number {
  const batch = cast.batches.find((b) => b.product === product.id);
  if (batch) return batch.cost;
  const line = cast.order.lines.find((l) => l.product === product.id);
  if (line) return Math.round((line.price / WORKING_MARGIN) * 100) / 100;
  const costs = cast.batches.map((b) => b.cost).sort((a, b) => a - b);
  const median = costs[Math.floor(costs.length / 2)] ?? 0;
  return Math.round(median * SPREAD[index % SPREAD.length] * 100) / 100;
}

/** which row of the take came off unheard — a lorry pulled in over the third product */
const UNHEARD = 2;

export default function B1() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [destination, setDestination] = React.useState<'lot' | 'sku'>('lot');

  const script: CaptureRow[] = React.useMemo(
    () =>
      cast.products.slice(0, 4).map((p, i) => {
        const was = yesterdayCost(cast, p, i);
        const batch = cast.batches.find((b) => b.product === p.id);
        return {
          id: p.id,
          name: <Name of={p} />,
          detail: batch ? `lote ${batch.id}` : undefined,
          value: Math.round(was * (1 + MOVES[i % MOVES.length]) * 100) / 100,
          was,
          unit: `€/${p.unit}`,
          decimals: 2,
          unheard: i === UNHEARD,
          durationMs: 2400,
        };
      }),
    [cast],
  );

  return (
    <PhoneChassis
      header={{ to: 'K' }}
      behind={{ to: 'D1s', label: "this morning's captures" }}
      rows={5}
      placement="bottom"
      height={820}
      width={392}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0, maxHeight: 740, overflowY: 'auto' }}>
        {/* MEAT DECLARES `≠`, so the card renders the ABSENCE rather than a screen it would have
            to break to draw. The account buys on a contract and takes its costs off the
            supplier's sheet; switch `D7.market-voice` on for one family and this capture joins
            its rail (C-17). */}
        {cast.sector === 'meat' ? (
          <CaptureAbsent
            because={
              <>
                A meat house agrees its costs for weeks at a time and reads the rest off the sheet
                that comes with the goods, so nobody stands at a market at {cast.hour} with a
                phone. Switch <code>D7.market-voice</code> on for one family and this capture joins
                the rail.
              </>
            }
            instead={
              <>
                <RefChip to="B4">the agreed costs</RefChip>
                <RefChip to="B3">the sheet at the bay</RefChip>
                <RefChip to="K">the rail</RefChip>
              </>
            }
          />
        ) : (
        <SpokenCapture
          resetKey={cast.sector}
          head={
            <>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Today&rsquo;s costs</h2>
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                {cast.hour} · the lonja
              </p>
            </>
          }
          valueHead="Paid today"
          script={script}
          prefill={{ label: 'Like yesterday' }}
          empty={<>Hold the button and say the product, the number and the unit. Rows land as you speak.</>}
          commit={
            /* BOTH EXITS, ON ONE CONTROL. The rows above do not move; what moves is the object
               they land on, and that object is a configuration rather than a screen. */
            <section
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.sizing.scale400,
                padding: theme.sizing.scale500,
                borderRadius: theme.borders.radius300,
                background: theme.colors.backgroundSecondary,
              }}
            >
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Where these rows land
              </span>
              <SegmentedControl
                activeKey={destination}
                onChange={({ activeKey }) => setDestination(activeKey as 'lot' | 'sku')}
              >
                <Segment key="lot" label="On the lote" />
                <Segment key="sku" label="On the product" />
              </SegmentedControl>
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                {destination === 'lot' ? (
                  <>
                    A house that records lotes puts each figure on the lote it bought, so a line
                    drawn from two lotes carries two costs — that is what E2 divides.
                  </>
                ) : (
                  <>
                    A house that records no lote puts each figure on the product as today&rsquo;s
                    cost, and every line sold today reads it.
                  </>
                )}
              </p>
            </section>
          }
        />
        )}

        {/* where the figures rest, and what they become */}
        {destination === 'lot' ? (
          <GBatchbook rows={4} label="the lotes these costs land on" />
        ) : (
          <GRegion open={2} height={96} label="the products these costs land on" />
        )}
        <GRegion to="C3" height={96} label="the price they feed" />
      </div>
    </PhoneChassis>
  );
}
