/* C8 · Fix a price for one customer and one product.
 *
 * The agreement surface with one thing added: a field where the price is typed, and the GAP
 * between what was typed and what the general rule would have produced.
 *
 * POSITIVE SPACE. The size of the exception. Nobody sets a fixed price without seeing what the
 * rule would have given, so the rule's figure stays on the screen and the difference is drawn as
 * the number is typed. A fixed price agreed blind is the way a house discovers in March that it
 * has been selling under cost since October.
 *
 * A CONTROL DELTA on C7, and nothing else changes: same customer head, same general-rule block,
 * same stored tail.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { Button, KIND, SIZE } from 'baseui/button';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Agreement, { Gap, Settled } from '../canonical/agreement';
import { blendedCost, priceFrom, todaysLandings } from '../canonical/margin-desk';
import { Figure } from '../../rocoto/figure';
import { GCatalogue, GRegion } from '../ghosts/regions';
import { customerOf, productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C8',
  title: 'Fix a price for one customer and one product',
  group: 'C',
  frame: 'desk',
  ifText: 'a price is agreed for one customer on one product, outside the general rule',
  dims: ['D10.fixed-override'],
  job: 'Agree a price with one customer on one product, with the size of the exception visible.',
  decides:
    'that a fixed price is set beside what the general rule would have produced, so the size of the exception is on the screen while it is being agreed',
  inherits: [
    { region: 'the general rule', ref: 'C3' },
    { region: 'the customer dossier', ref: 'J1a' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [{ region: 'the catalogue this price hangs on', ref: 'OPEN-2' }],
  primitives: ['U01'],
  kit: ['Input', 'Button', 'Tag', 'Figure', 'Ghost'],
  canonical: 'agreement',
  delta: 'control',
  deltaText: 'the tier chips become a free price field, and the gap is drawn beside it',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [2, 4],
  step: 5,
  fills: ['price'],
  reads: ['cost'],
  live:
    "type the agreed price and the general rule's figure stays beside it while the gap is drawn as you type; store it and the field becomes a Tag naming the record it changed",
};

const RULE_MARGIN = 26;

export default function C8() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const customer = customerOf(cast, cast.order.customer);
  const product = productOf(cast, cast.order.lines[0].product);
  const landings = React.useMemo(() => todaysLandings(cast, product, true), [cast, product]);
  const cost = blendedCost(landings);
  const rulePrice = priceFrom(cost, RULE_MARGIN);

  const [typed, setTyped] = React.useState('');
  const [stored, setStored] = React.useState(false);
  React.useEffect(() => { setTyped(''); setStored(false); }, [cast.sector]);

  const agreed = typed === '' ? undefined : Number(typed);
  const ready = agreed !== undefined && agreed > 0;

  return (
    <DeskChassis dossier daybar={false} daylist={{ open: 3, label: 'the customers' }} rows={12} selected={1} height={720}>
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
            {customer.name} takes this product every week, and the price is being agreed with them
            directly.
          </>
        }
        settled={stored ? <Settled>Saved. This is settled.</Settled> : undefined}
        aside={
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: theme.sizing.scale600, marginTop: theme.sizing.scale500 }}>
            <GRegion to="C3" height={120} label="the general rule" />
            <GCatalogue rows={5} />
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
              Per {product.unit}, on every order from now on
            </div>
            <Input
              size={INPUT_SIZE.large}
              value={typed}
              type="number"
              inputMode="decimal"
              endEnhancer={`€/${product.unit}`}
              aria-label="the agreed price"
              onChange={(e) => { setTyped((e.target as HTMLInputElement).value); setStored(false); }}
            />
          </div>

          {/* THE GAP, drawn as you type. The card's whole subject. */}
          <Gap rule={rulePrice} agreed={agreed} unit={`€/${product.unit}`} />

          <Button kind={KIND.primary} size={SIZE.large} disabled={!ready} onClick={() => setStored(true)}>
            Agree it
          </Button>
        </div>

        {stored && ready && (
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
              It sits on {customer.name}&rsquo;s record, in the agreed-prices block, and every order
              they place takes it.
            </span>
            <Figure value={agreed as number} was={rulePrice} unit={`€/${product.unit}`} size="large" />
          </div>
        )}
      </Agreement>
    </DeskChassis>
  );
}
