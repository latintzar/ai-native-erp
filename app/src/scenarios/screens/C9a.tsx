/* C9a · Agree a fixed price against a quantity.
 *
 * C8 with two columns added: a quantity and a period. That is the whole delta, and it is why C9
 * was split — C9 as the brief writes it decides two things at two different times, what the deal
 * is and how the deal is going, and the second of those is C9b.
 *
 * POSITIVE SPACE. The terms — price, quantity, period — and WHAT TODAY'S COST IMPLIES ABOUT THAT
 * PRICE AT THE MOMENT OF SIGNING, so the bet is visible while it is being made.
 *
 * FISH IS THE REASON THIS DIMENSION EXISTS, and the brief says so: a distributor whose cost moves
 * every single morning still fixes a price for one large customer, for a quarter. Drawn with
 * Merluza and Distribuciones Vera — the two names in the cast that carry exactly that deal.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { Button, KIND, SIZE } from 'baseui/button';
import { DatePicker } from 'baseui/datepicker';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Agreement, { Gap, Settled } from '../canonical/agreement';
import { blendedCost, priceFrom, todaysLandings } from '../canonical/margin-desk';
import { Figure } from '../../rocoto/figure';
import { GRegion } from '../ghosts/regions';
import { customerOf, productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C9a',
  title: 'Agree a fixed price against a quantity',
  group: 'C',
  frame: 'desk',
  ifText: 'a price is agreed against a quantity over a period, at the moment of agreement',
  dims: ['D10.fixed-with-volume'],
  job: 'Agree a price, a quantity and a period with one customer.',
  decides:
    "the terms of a volume arrangement — price, quantity and period — and what today's cost implies about that price at the moment it is signed",
  inherits: [
    { region: "today's cost", ref: 'B1' },
    { region: 'the customer dossier', ref: 'J1a' },
    { region: 'how the arrangement then goes', ref: 'C9b' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [{ region: 'the catalogue this price hangs on', ref: 'OPEN-2' }],
  primitives: ['U01'],
  kit: ['Input', 'Datepicker', 'Button', 'Tag', 'Figure', 'Ghost'],
  canonical: 'agreement',
  delta: 'column',
  deltaText: "C8's price field gains a quantity and a period, and the bet at today's cost",
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [2, 4],
  step: 5,
  fills: ['price'],
  reads: ['cost'],
  live:
    "type the price and the «at today's cost this is …» figure moves as you type; set the period with the datepicker; agree it and the terms become the arrangement C9b watches",
};

const RULE_MARGIN = 26;

/** How far ahead a house is willing to fix a price, by sector. Fish fixes for a quarter against a
 *  cost that moves every morning; meat and fruit sit on calmer ground and fix for longer. */
const PERIOD_DAYS: Record<string, number> = { fish: 90, meat: 180, fruit: 120 };

export default function C9a() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  /* Distribuciones Vera and the sector's first product: the large customer and the line the deal
     is written on. Both names come out of the cast. */
  const customer = customerOf(cast, 'vera');
  const product = productOf(cast, cast.order.lines[0].product);
  const landings = React.useMemo(() => todaysLandings(cast, product, true), [cast, product]);
  const cost = blendedCost(landings);
  const rulePrice = priceFrom(cost, RULE_MARGIN);

  const [typed, setTyped] = React.useState('');
  const [qty, setQty] = React.useState('2400');
  const [period, setPeriod] = React.useState<Date[]>(() => {
    const from = new Date(2026, 7, 22);
    const to = new Date(2026, 7, 22);
    to.setDate(to.getDate() + PERIOD_DAYS[cast.sector]);
    return [from, to];
  });
  const [signed, setSigned] = React.useState(false);

  React.useEffect(() => {
    setTyped('');
    setSigned(false);
    const from = new Date(2026, 7, 22);
    const to = new Date(2026, 7, 22);
    to.setDate(to.getDate() + PERIOD_DAYS[cast.sector]);
    setPeriod([from, to]);
  }, [cast.sector]);

  const agreed = typed === '' ? undefined : Number(typed);
  const ready = agreed !== undefined && agreed > 0 && Number(qty) > 0;
  const quantity = Number(qty) || 0;

  /* THE BET, at today's cost. Margin in points, and what the whole quantity is worth at it. */
  const marginToday = agreed !== undefined && cost > 0 ? ((agreed - cost) / cost) * 100 : 0;
  const valueOfTerm = agreed !== undefined ? agreed * quantity : 0;
  const marginOfTerm = agreed !== undefined ? (agreed - cost) * quantity : 0;

  return (
    <DeskChassis dossier daybar={false} daylist={{ open: 3, label: 'the customers' }} rows={12} selected={4} height={860}>
      <Agreement
        cast={cast}
        customer={customer}
        product={product}
        rule={{
          price: rulePrice,
          how: `${customer.tier}, at ${RULE_MARGIN}% on today's cost of ${cost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/${product.unit}`,
        }}
        reason={
          <>
            {customer.name} takes this line all year. The price is being fixed against a quantity,
            on a cost that moves every morning at {cast.hour} — which is the whole reason this
            arrangement exists.
          </>
        }
        settled={signed ? <Settled>Saved. This is settled.</Settled> : undefined}
        terms={
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(160px, 1fr) minmax(240px, 1.4fr)',
              gap: theme.sizing.scale700,
              alignItems: 'start',
              paddingTop: theme.sizing.scale500,
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              minWidth: 0,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={theme.typography.LabelSmall}>The quantity agreed</div>
              <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, marginBottom: theme.sizing.scale300 }}>
                Over the whole period
              </div>
              <Input
                size={INPUT_SIZE.compact}
                value={qty}
                type="number"
                inputMode="numeric"
                endEnhancer={product.unit}
                aria-label="the agreed quantity"
                onChange={(e) => { setQty((e.target as HTMLInputElement).value); setSigned(false); }}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={theme.typography.LabelSmall}>The period it holds for</div>
              <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, marginBottom: theme.sizing.scale300 }}>
                {PERIOD_DAYS[cast.sector]} days, as {cast.label} houses write them
              </div>
              <DatePicker
                range
                size={INPUT_SIZE.compact}
                value={period}
                formatString="dd.MM.yyyy"
                onChange={({ date }) => {
                  setPeriod(Array.isArray(date) ? (date as Date[]) : [date as Date]);
                  setSigned(false);
                }}
              />
            </div>
          </div>
        }
        aside={
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: theme.sizing.scale600, marginTop: theme.sizing.scale500 }}>
            <GRegion to="B1" height={120} label="where today's cost came from" />
            <GRegion to="C9b" height={120} label="how the arrangement goes" />
          </div>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 260px) minmax(0, 1fr) auto',
            gap: theme.sizing.scale700,
            alignItems: 'end',
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={theme.typography.LabelSmall}>The price agreed with them</div>
            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, marginBottom: theme.sizing.scale300 }}>
              Held for the whole period
            </div>
            <Input
              size={INPUT_SIZE.large}
              value={typed}
              type="number"
              inputMode="decimal"
              endEnhancer={`€/${product.unit}`}
              aria-label="the agreed price"
              onChange={(e) => { setTyped((e.target as HTMLInputElement).value); setSigned(false); }}
            />
          </div>

          <Gap rule={rulePrice} agreed={agreed} unit={`€/${product.unit}`} />

          <Button kind={KIND.primary} size={SIZE.large} disabled={!ready} onClick={() => setSigned(true)}>
            Agree the terms
          </Button>
        </div>

        {/* THE BET, VISIBLE WHILE IT IS BEING MADE. What today's cost says about this price, and
            what the whole quantity is worth at it. It moves as the number is typed. */}
        <div
          style={{
            padding: `${theme.sizing.scale500}`,
            borderRadius: theme.borders.radius200,
            background: theme.colors.backgroundSecondary,
            minWidth: 0,
          }}
        >
          {ready ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.sizing.scale600 }}>
              <div>
                <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                  At today&rsquo;s cost this is
                </div>
                <Figure value={marginToday} unit="% margin" decimals={1} size="default" />
              </div>
              <div>
                <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                  The whole quantity is worth
                </div>
                <Figure value={valueOfTerm} unit="€" size="default" />
              </div>
              <div>
                <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                  And leaves, at today&rsquo;s cost
                </div>
                <Figure value={marginOfTerm} unit="€" size="default" />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                The bet, at today&rsquo;s cost
              </div>
              <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary }}>
                The margin this price leaves, what the whole quantity is worth, and what it leaves —
                all three arrive as the price is typed.
              </div>
            </div>
          )}
        </div>
      </Agreement>
    </DeskChassis>
  );
}
