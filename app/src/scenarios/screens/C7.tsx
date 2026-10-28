/* C7 · Decide which tier applies.
 *
 * A customer sits under two tiers at once — the volume band their year puts them in, and the band
 * their group buys under — and the two produce different prices. The tie-break is taken once, on
 * the customer, and never asked again.
 *
 * POSITIVE SPACE. The two candidates, each carrying WHAT IT WOULD PRODUCE FOR THEM, ordered by
 * the evidence behind them. One press stores it.
 *
 * `U01` in its plainest form, and its tail is J2's: the chip becomes a Tag reading «Saved. This
 * is settled.» and the record it wrote is named on the screen.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Agreement, { ChoiceChip, Settled } from '../canonical/agreement';
import { PriceResult, blendedCost, todaysLandings, tiersOf } from '../canonical/margin-desk';
import { Figure } from '../../rocoto/figure';
import { GTiers, GRegion } from '../ghosts/regions';
import { customerOf, productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C7',
  title: 'Decide which tier applies',
  group: 'C',
  frame: 'desk',
  ifText: 'two tiers could both apply to one customer',
  dims: ['D9.many', 'D10.tier-assignment'],
  job: 'Take the tier tie-break once and store it on the customer.',
  decides:
    'which of two tiers a customer takes their price from, with what each would produce for them beside its name, stored on the record so it is never asked again',
  inherits: [
    { region: 'the tier columns', ref: 'C1' },
    { region: 'the customer dossier', ref: 'J1a' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: ['U01'],
  kit: ['Button', 'Tag', 'Figure', 'Ghost'],
  canonical: 'agreement',
  delta: 'origin',
  deltaText: 'the card that IS the agreement surface; C8 puts a free price on it, C9a a quantity',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [2, 4],
  step: 5,
  fills: ['record.tier'],
  reads: ['price'],
  live:
    'press either chip and it carries the price that tier would make them; the other steps back, the chip becomes a Tag reading «Saved. This is settled.», and the record it wrote is named',
};

/** The margin each tier carries, in points off the opening one — the same spread C4 moves. */
const SPREAD = [0, 6, 11, 15];
const OPENING = 26;

export default function C7() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const customer = customerOf(cast, cast.order.customer);
  const product = productOf(cast, cast.order.lines[0].product);
  const landings = React.useMemo(() => todaysLandings(cast, product, true), [cast, product]);
  const cost = blendedCost(landings);
  const tiers = React.useMemo(() => tiersOf(cast, 4), [cast]);

  /* the two that could both apply: the one their volume puts them in, and the one their group
     buys under. Both come off the cast's own tier set. */
  const candidates = tiers.slice(0, 2);
  const margins = candidates.map((_, i) => OPENING + (SPREAD[i] ?? 0));
  /* the evidence that orders them — how much of the year they bought under each */
  const evidence = ['On 14 of their last 16 orders', 'On the group agreement, since March'];

  const [chosen, setChosen] = React.useState<string | null>(null);
  React.useEffect(() => setChosen(null), [cast.sector]);

  const chosenIndex = candidates.findIndex((t) => t.id === chosen);

  return (
    <DeskChassis dossier daybar={false} daylist={{ open: 3, label: 'the customers' }} rows={12} selected={1} height={720}>
      <Agreement
        cast={cast}
        customer={customer}
        product={product}
        reason={
          <>
            Two tiers reach {customer.name}: {candidates[0]?.name} by what they bought this year,
            and {candidates[1]?.name} through the group they buy with.
          </>
        }
        settled={chosen ? <Settled>Saved. This is settled.</Settled> : undefined}
        aside={
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: theme.sizing.scale600, marginTop: theme.sizing.scale500 }}>
            <GTiers rows={4} />
            <GRegion to="J1a" height={120} label="the customer's blocks" />
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
            The tier {customer.name} takes their price from
          </span>

          <div style={{ display: 'flex', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
            {candidates.map((tier, i) => (
              /* each chip CARRIES THE PRICE IT WOULD PRODUCE. A chip that only names a tier makes
                 the reader do the arithmetic the screen exists to show. */
              <ChoiceChip
                key={tier.id}
                label={tier.name}
                chosen={chosen === tier.id}
                onChoose={() => setChosen(tier.id)}
                figure={
                  <Figure
                    value={cost * (1 + margins[i] / 100)}
                    unit={`€/${product.unit}`}
                    size="compact"
                  />
                }
                evidence={chosen && chosen !== tier.id ? undefined : evidence[i]}
              />
            ))}
          </div>

          {chosen && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: theme.sizing.scale500,
                flexWrap: 'wrap',
                paddingTop: theme.sizing.scale400,
                borderTop: `1px solid ${theme.colors.borderOpaque}`,
              }}
            >
              <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                {customer.name} takes {candidates[chosenIndex]?.name} from now on. It is on their
                record, beside their addresses and their delivery days.
              </span>
              <PriceResult
                cost={cost}
                margin={margins[chosenIndex] ?? margins[0]}
                unit={`€/${product.unit}`}
              />
            </div>
          )}
        </div>
      </Agreement>
    </DeskChassis>
  );
}
