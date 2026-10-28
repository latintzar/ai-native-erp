/* C4 · Move every tier at once.
 *
 * The same margin desk as C3, with one thing changed: what moves the margin. C3 has a slider and
 * C4 has EL CANDADO — a set of sliders under one lock, so a single drag moves every tier and the
 * spread between them survives the move. That is the whole delta, and it is a CONTROL delta:
 * D9.many must never produce a second screen, and this card is the proof.
 *
 * POSITIVE SPACE. One drag moves all tiers while preserving the spread between them, with the
 * count of customers on each tier on its own row, so the size of the act is visible while it is
 * being made.
 *
 * THE LOCK IS THE SUBJECT. Releasing it (a Switch) unlinks the rows and one tier moves alone.
 * There is no third state.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Checkbox, STYLE_TYPE, LABEL_PLACEMENT } from 'baseui/checkbox';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import MarginDesk, {
  PriceResult,
  blendedCost,
  todaysLandings,
  tiersOf,
  priceFrom,
} from '../canonical/margin-desk';
import { Candado } from '../../rocoto/candado';
import { Figure } from '../../rocoto/figure';
import { GCatalogue, GRegion } from '../ghosts/regions';
import { productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C4',
  title: 'Move every tier at once',
  group: 'C',
  frame: 'desk',
  ifText: 'the selling price is cost plus a percentage, and several tiers each carry their own',
  dims: ['D8.margin', 'D9.many'],
  job: 'Move every tier at once and keep the spread between them.',
  decides:
    'that one drag moves every tier while the spread between them holds, and that the number of customers the drag reaches is on the screen while it is being made',
  inherits: [
    { region: 'who sits on each tier', ref: 'J1a' },
    { region: "where today's cost came from", ref: 'B1' },
    { region: 'orders already taken at the old price', ref: 'C5' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [{ region: 'the catalogue this price hangs on', ref: 'OPEN-2' }],
  primitives: ['U05'],
  kit: ['Slider', 'Checkbox (toggle)', 'Figure', 'Ghost'],
  canonical: 'margin-desk',
  delta: 'control',
  deltaText: 'the single margin slider becomes a set of them under one lock',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [2],
  step: 3,
  fills: ['price'],
  reads: ['cost'],
  live:
    'drag any tier while the lock holds and every tier moves with it, the spread intact and the customers reached counted as you drag; release the lock and one tier moves alone',
};

/** The spread a house holds between its tiers, in points of margin off the opening one. The
 *  distances are the subject; the lock is what keeps them. */
const SPREAD = [0, 6, 11, 15];
const OPENING = 26;

export default function C4() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const product = productOf(cast, cast.order.lines[0].product);
  const landings = React.useMemo(() => todaysLandings(cast, product, true), [cast, product]);
  const cost = blendedCost(landings);
  /* the tiers this house actually holds, read off its customers. A band with nobody on it
     would undercut the card's own subject, which is the size of the act. */
  const tiers = React.useMemo(() => tiersOf(cast), [cast]);

  const opening = React.useMemo(() => tiers.map((_, i) => OPENING + (SPREAD[i] ?? 0)), [tiers]);
  const [margins, setMargins] = React.useState<number[]>(opening);
  const [locked, setLocked] = React.useState(true);
  React.useEffect(() => setMargins(opening), [opening]);

  /* the size of the act, live: a locked drag reaches every customer on every tier; released, it
     reaches the one tier that moved. Read from the same numbers the rows are drawn from. */
  const reached = locked
    ? tiers.reduce((s, t) => s + t.customers, 0)
    : tiers.reduce((s, t, i) => s + (margins[i] === opening[i] ? 0 : t.customers), 0);
  const moved = margins.filter((m, i) => m !== opening[i]).length;

  return (
    <DeskChassis daybar={false} daylist={{ open: 2, label: 'the catalogue' }} rows={12} selected={0} height={860}>
      <MarginDesk
        cast={cast}
        product={product}
        landings={landings}
        source="Spoken at the market this morning, one row per landing."
        reason={`One drag, ${tiers.reduce((s, t) => s + t.customers, 0)} customers across ${tiers.length} tiers.`}
        control={
          <Checkbox
            checked={locked}
            checkmarkType={STYLE_TYPE.toggle_round}
            labelPlacement={LABEL_PLACEMENT.left}
            onChange={(e) => setLocked((e.target as HTMLInputElement).checked)}
          >
            {locked ? 'The tiers move together' : 'Each tier moves alone'}
          </Checkbox>
        }
        aside={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: theme.sizing.scale600 }}>
            {/* who sits on each tier — J1a owns the customer */}
            <GRegion to="J1a" height={112} label="who is on each tier" />
            {/* the orders stamped at the price these margins replace */}
            <GRegion to="C5" height={112} label="orders already taken" />
            {/* the catalogue this price hangs on */}
            <GCatalogue rows={4} />
          </div>
        }
      >
        <Candado
          rows={tiers.map((t, i) => ({
            id: t.id,
            name: t.name,
            note: `${t.customers} ${t.customers === 1 ? 'customer' : 'customers'}`,
            result: (
              /* the price the opening margin made stays legible under the one the drag makes */
              <PriceResult
                cost={cost}
                margin={margins[i]}
                unit={`€/${product.unit}`}
                was={margins[i] === opening[i] ? undefined : priceFrom(cost, opening[i])}
              />
            ),
          }))}
          value={margins}
          onChange={setMargins}
          locked={locked}
          link="spread"
          min={0}
          max={80}
          step={1}
          valueToLabel={(v) => `${v}%`}
        />

        <div
          style={{
            marginTop: theme.sizing.scale500,
            paddingTop: theme.sizing.scale500,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: theme.sizing.scale500,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
            {locked
              ? `The spread holds: ${SPREAD.slice(0, tiers.length).map((s) => `+${s}`).join(' · ')} points off ${tiers[0]?.name}`
              : `${moved} of ${tiers.length} tiers moved`}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300 }}>
            <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
              Customers this drag reaches
            </span>
            <Figure value={reached} decimals={0} size="compact" />
          </div>
        </div>
      </MarginDesk>
    </DeskChassis>
  );
}
