/* D1s · Record what arrived, with no document.
 * `D11.declared` · phone · canonical `spoken-capture` — DATA DELTA: the destination is stock.
 *
 * THE SAME GESTURE, THE OTHER OBJECT. B1 stands at the market and the rows land on a cost; D1s
 * stands at the lorry an hour later and the identical rows land on stock. Nothing about the
 * screen changes — the hold, the rows appearing as words land, the row that came off unheard with
 * its recording attached, yesterday as a one-press start. What changes is what the row IS.
 *
 * THE SWITCH IS THE CARD. It sits under the rows and moves the same take between cost and stock
 * in front of you, which is the brief's own example of identical screens holding true. If the two
 * destinations needed two screens, the claim would be false and this card is where that shows.
 *
 * SECTOR. `=` in screen everywhere. Fish: the landing, an hour after the lonja. Fruit: the pallet
 * count at the door. Meat: rare, because meat almost always arrives with paper and goes to B3 —
 * which is a matter of how often the card is opened, never of what it looks like.
 *
 * REDUCTION: B1 ≡ D1s.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import type { ScenarioMeta } from '../meta';
import PhoneChassis from '../chassis/phone';
import SpokenCapture, { type CaptureRow } from '../canonical/spoken-capture';
import RefChip from '../shell/RefChip';
import { GBatchbook, GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'D1s',
  title: 'Record what arrived, with no document',
  group: 'D',
  frame: 'phone',
  ifText: 'somebody states aloud what arrived, and no document exists',
  dims: ['D11.declared'],
  job: 'Say what came off the lorry and have it land as stock.',
  decides:
    'that the spoken capture and its destination are separate facts — the same gesture and the same rows land on a cost or on stock, and which one is a configuration',
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: 'the same gesture, landing on a cost', ref: 'B1' },
    { region: 'the batch these quantities land on', ref: 'E3' },
  ],
  open: [
    { region: 'the batch ledger and the day’s other captures', ref: 'OPEN-5' },
    { region: 'the catalogue these products come from', ref: 'OPEN-2' },
  ],
  primitives: ['U02'],
  kit: ['Voice Button', 'Waveform', 'Figure', 'Segmented Control', 'Button', 'Tag', 'Ghost'],
  canonical: 'spoken-capture',
  delta: 'data',
  deltaText: 'the same rows from the same gesture, landing on stock instead of on a cost',
  sector: { fish: '=', meat: 'Δ', fruit: '=' },
  drawnWith: 'fish',
  thread: [3],
  step: 3,
  fills: ['lot.qty'],
  reads: [],
  live:
    'hold the button and the rows land one at a time; the switch under them moves the same take between a cost and a stock position, and the figures change denomination while the rows stay put',
};

/** How much of yesterday's quantity came again today. Deterministic by position, so the same
 *  lorry arrives the same way every time this card is opened. */
const ARRIVED = [1.12, 0.86, 1.31, 0.74, 1.05];

/** which row of the take came off unheard — the tail lift ran over the third product */
const UNHEARD = 2;

export default function D1s() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [lands, setLands] = React.useState<'stock' | 'cost'>('stock');

  /* ONE SCRIPT, TWO DENOMINATIONS. The rows, their order, their unheard row and their yesterday
     are identical; the switch changes what each figure counts and nothing else. */
  const script: CaptureRow[] = React.useMemo(
    () =>
      cast.products.slice(0, 4).map((p, i) => {
        const batch = cast.batches.find((b) => b.product === p.id);
        const wasQty = batch ? batch.qty : Math.round(40 + i * 13);
        const qty = Math.round(wasQty * ARRIVED[i % ARRIVED.length]);
        const cost = batch ? batch.cost : Math.round((cast.batches[0].cost + i) * 100) / 100;
        return {
          id: p.id,
          name: <Name of={p} />,
          detail: batch ? `lote ${batch.id} · ${batch.day}` : undefined,
          value: lands === 'stock' ? qty : Math.round(cost * (1 + i * 0.02) * 100) / 100,
          was: lands === 'stock' ? wasQty : cost,
          unit: lands === 'stock' ? p.unit : `€/${p.unit}`,
          decimals: lands === 'stock' ? 0 : 2,
          unheard: i === UNHEARD,
          durationMs: 2200,
        };
      }),
    [cast, lands],
  );

  return (
    <PhoneChassis
      header={{ to: 'K' }}
      behind={{ open: 5, label: "the day's captures" }}
      rows={5}
      placement="bottom"
      height={820}
      width={392}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0, maxHeight: 740, overflowY: 'auto' }}>
        <SpokenCapture
          /* THE SECTOR RESTARTS THE CAPTURE; THE SWITCH DOES NOT. That is the card's whole claim:
             the same take is re-denominated in front of you, and rows that vanished when the
             destination moved would prove the opposite of what this screen is for. */
          resetKey={cast.sector}
          head={
            <>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>What arrived</h2>
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                {cast.hour} · the lorry is open
              </p>
            </>
          }
          valueHead={lands === 'stock' ? 'On hand' : 'Paid'}
          script={script}
          prefill={{ label: 'Like yesterday' }}
          empty={<>Hold the button and say the product and how much came. Rows land as you speak.</>}
          commit={
            /* THE SWITCH IS THE CARD. Same rows, same gesture, two objects at the other end. */
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
                What this take is
              </span>
              <SegmentedControl
                activeKey={lands}
                onChange={({ activeKey }) => setLands(activeKey as 'stock' | 'cost')}
              >
                <Segment key="stock" label="A stock position" />
                <Segment key="cost" label="Today's cost" />
              </SegmentedControl>
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                {lands === 'stock' ? (
                  <>
                    Under <code>D11.declared</code> the figures are quantities and they become the
                    stock this house holds. The same take, denominated in euros, is{' '}
                    <RefChip to="B1">the morning&rsquo;s costs</RefChip>
                  </>
                ) : (
                  <>
                    Under <code>D7.market-voice</code> the figures are what was paid and they
                    become the cost. Watch the rows above stay exactly where they are.
                  </>
                )}
              </p>
            </section>
          }
        />

        {/* where the quantities rest */}
        <GBatchbook rows={4} label="the lotes this stock sits in" />
        <GRegion open={2} height={88} label="the catalogue behind the names" />
      </div>
    </PhoneChassis>
  );
}
