/* C3 · Set today's margin and see the price.
 *
 * The second half of a fish morning. B1 fills the cost at the lonja at 05:00; C3 turns it into a
 * price before the orders land at 06:00. One sentence of arithmetic, and the whole card is that
 * sentence moving under a hand.
 *
 * POSITIVE SPACE. Today's cost, the margin, and the resulting price with its unit on the number's
 * own line. Moving the margin moves the price in front of you.
 *
 * THE CATALOGUE'S ONE SURVIVING CONTROL DELTA lives on this card and it is drawn, not described:
 * «today's cost» is a blend across this morning's landings in fish and one contract figure in
 * meat, so the cost Figure carries a disclosure that opens in place and names the lotes behind
 * it. Run the sector switch and watch the same control change state without the screen changing.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Slider } from 'baseui/slider';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import MarginDesk, {
  PriceResult,
  blendedCost,
  todaysLandings,
} from '../canonical/margin-desk';
import { GCatalogue, GTiers, GRegion } from '../ghosts/regions';
import { productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C3',
  title: "Set today's margin and see the price",
  group: 'C',
  frame: 'desk',
  ifText: 'the selling price is cost plus a percentage, and one margin serves every customer',
  dims: ['D8.margin', 'D9.one'],
  job: "Turn today's cost into today's price.",
  decides:
    "the arithmetic made visible on one line — today's cost, the margin, and the price it makes — and that moving the margin moves the price in front of you",
  inherits: [
    { region: "where today's cost came from", ref: 'B1' },
    { region: 'the tier columns', ref: 'C4' },
    { region: 'orders already taken at the old price', ref: 'C5' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [{ region: 'the catalogue this price hangs on', ref: 'OPEN-2' }],
  primitives: [],
  kit: ['Slider', 'Figure', 'Button', 'Ghost'],
  canonical: 'margin-desk',
  delta: 'origin',
  deltaText: 'the card that IS the margin desk; C4 puts a column of margins under one lock',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [2],
  step: 3,
  fills: ['price'],
  reads: ['cost'],
  live:
    "drag the margin and the price moves as you drag; click today's cost and the blended-cost disclosure opens in place, live where the morning landed twice and a plain statement of the one lote where it landed once",
};

/** The margin a house starts the morning on, per sector. Fish works on a thin daily margin off a
 *  moving cost; meat and fruit sit further from the market and carry more. */
const OPENING_MARGIN: Record<string, number> = { fish: 28, meat: 34, fruit: 32 };

/** Where today's cost was discovered, in the words the house would use. */
const SOURCE: Record<string, string> = {
  fish: 'Spoken at the lonja this morning, one row per boat.',
  meat: 'The agreed contract figure, held since the last revision.',
  fruit: 'Read off the stall tickets at Mercabarna this morning.',
};

/** Whether the cost moves every morning. It is what makes the disclosure live. */
const DAILY: Record<string, boolean> = { fish: true, meat: false, fruit: true };

export default function C3() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  /* the product this desk is standing on: the first the sector sells, from the cast */
  const product = productOf(cast, cast.order.lines[0].product);
  const daily = DAILY[cast.sector];
  const landings = React.useMemo(() => todaysLandings(cast, product, daily), [cast, product, daily]);
  const cost = blendedCost(landings);

  const [margin, setMargin] = React.useState(OPENING_MARGIN[cast.sector]);
  /* a different sector is a different account, so its margin is its own */
  React.useEffect(() => setMargin(OPENING_MARGIN[cast.sector]), [cast.sector]);

  return (
    <DeskChassis daybar={false} daylist={{ open: 2, label: 'the catalogue' }} rows={12} selected={0} height={720}>
      <MarginDesk
        cast={cast}
        product={product}
        landings={landings}
        source={SOURCE[cast.sector]}
        reason={
          daily
            ? `The cost landed at ${cast.hour}. The price it makes stands on every order taken from now on.`
            : 'The contract figure holds until the next revision, so this margin sets the price for the month.'
        }
        aside={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: theme.sizing.scale600 }}>
            {/* the other tiers, once a house holds more than one — C4's subject */}
            <GTiers rows={4} to="C4" />
            {/* the orders already stamped at the price this one replaces */}
            <GRegion to="C5" height={112} label="orders already taken" />
            {/* the catalogue this price hangs on */}
            <GCatalogue rows={4} />
          </div>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 240px) minmax(200px, 1fr) auto',
            gap: theme.sizing.scale700,
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={theme.typography.LabelSmall}>Margin on cost</div>
            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              One margin, every customer
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <Slider
              value={[margin]}
              min={0}
              max={80}
              step={1}
              onChange={({ value }) => setMargin(value[0])}
              valueToLabel={(v) => `${v}%`}
            />
          </div>

          <PriceResult cost={cost} margin={margin} unit={`€/${product.unit}`} />
        </div>
      </MarginDesk>
    </DeskChassis>
  );
}
