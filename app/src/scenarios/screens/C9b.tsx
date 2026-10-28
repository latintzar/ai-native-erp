/* C9b · Watch a standing arrangement.
 *
 * The second half of the C9 split. C9a decided what the deal is; this decides how the deal being
 * in progress is DRAWN — and the answer is that it is watched, not managed.
 *
 * POSITIVE SPACE. The arrangement's live state: progress against the agreed quantity, and whether
 * the price they hold is still profitable at today's cost.
 *
 * NO CONTROLS (BUILD-PLAN §3.4). This card exists to show how little happens. Its only moving
 * parts are the sector switch above it and the chart's own hover, which is a disclosure of a
 * reading and not a new act. A button here would be a different card, and that card is C10.
 */
import * as React from 'react';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Watch, { arrangementOf } from '../canonical/watch';
import { GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import { useStyletron } from 'baseui';

export const meta: ScenarioMeta = {
  id: 'C9b',
  title: 'Watch a standing arrangement',
  group: 'C',
  frame: 'desk',
  ifText: 'a price is fixed against a quantity, and the arrangement is in ordinary operation',
  dims: ['D10.fixed-with-volume'],
  job: 'Show how a standing arrangement is going.',
  decides:
    'how a promise already made is drawn — progress against the quantity agreed, and whether the price they hold is still profitable at today’s cost — with nothing to press',
  inherits: [
    { region: 'the terms', ref: 'C9a' },
    { region: "today's cost", ref: 'B1' },
    { region: 'the lapse decision', ref: 'C10' },
    { region: 'the customer dossier', ref: 'J1a' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: [],
  kit: ['Progress Bar', 'Line Chart', 'Figure', 'Ghost'],
  canonical: 'watch',
  delta: 'origin',
  deltaText: 'the card that IS the watching screen; C10 puts the lapse decision under it',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [2],
  step: 5,
  fills: [],
  reads: ['cost', 'price'],
  live:
    'the chart tracks a day under the pointer and reads out that day’s cost; the sector switch swaps the whole arrangement for a calmer one, and nothing else on the card moves because there is nothing else to press',
};

export default function C9b() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const arrangement = React.useMemo(() => arrangementOf(cast), [cast]);

  return (
    <DeskChassis dossier daybar={false} daylist={{ open: 3, label: 'the customers' }} rows={12} selected={4} height={860}>
      <Watch
        cast={cast}
        arrangement={arrangement}
        reason={
          <>
            The terms were agreed on the first day of the period and hold to the last. Nothing on
            this screen asks for a decision; it is here so the decision can be seen coming.
          </>
        }
        aside={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: theme.sizing.scale600, marginTop: theme.sizing.scale500 }}>
            <GRegion to="C9a" height={110} label="the terms" />
            <GRegion to="B1" height={110} label="where today's cost came from" />
            <GRegion to="C10" height={110} label="the lapse decision" />
          </div>
        }
      />
    </DeskChassis>
  );
}
