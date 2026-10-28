/* I5 · The round in progress.
 *
 * ONE RULE, AND THE CARD IS THE RULE: only lateness is visually distinct. Everything on time reads
 * the same. A round view that marks every state — on the van, arriving, delivered, signed — is a
 * screen a person has to read all morning; a round view that marks one thing is a screen they
 * glance at from across a desk.
 *
 * THE HOUR IS CONFIGURATION, and the sector moves it: a fish round finishes before a fruit round
 * starts. So the card's one control MOVES THE HOUR and the rows change appearance in front of you.
 * That is a disclosure of the rule rather than a new act, which is what §3.4 allows a watching card
 * — and it is the only honest way to show a rule whose whole content is a threshold.
 *
 * DISTINCTION IS INK, NEVER A HUE. A rule at the head of the row and the row's own weight. This
 * product has no traffic light, and a round view is exactly where one would otherwise be invented.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Slider } from 'baseui/slider';
import { FormControl } from 'baseui/form-control';
import type { ScenarioMeta, SectorId } from '../meta';
import DeskChassis from '../chassis/desk';
import RoundView, { type RoundStop } from '../canonical/round-view';
import { buildRound } from '../canonical/drop-list';
import { GRoute } from '../ghosts/regions';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'I5',
  title: 'The round in progress',
  group: 'I',
  frame: 'desk',
  ifText: 'the distributor looks at a round that is out',
  dims: ['D16.on-delivery', 'D17.driver'],
  job: 'See which drops are still out.',
  decides:
    'that only lateness is visually distinct on a round, and that the hour after which a drop becomes distinct is a configuration',
  inherits: [
    { region: 'each stop, as the driver sees it', ref: 'I3' },
    { region: 'the albaranes behind the stops', ref: 'G1' },
    { region: 'the signature on a stop', ref: 'I4' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [
    { region: 'the route itself, and who ordered it', ref: 'OPEN-17' },
    { region: "the day's bar and the day's list", ref: 'OPEN-1' },
  ],
  primitives: [],
  kit: ['Slider', 'Form Control', 'Ghost'],
  canonical: 'round-view',
  delta: 'origin',
  deltaText: 'the card that IS the round view',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1],
  step: 10,
  fills: [],
  reads: ['drop.delivered'],
  live:
    'drag the hour and rows gain and lose their distinction in front of you — that movement is the rule; the sector switch moves the hour to where that round actually finishes',
};

/** The hour after which a drop still out becomes distinct, per account. A fish round finishes
 *  before a fruit round starts, so the same rule with the same screen fires at three times. */
const HOURS: Record<SectorId, number> = { fish: 10, meat: 12, fruit: 11 };

/** How far through the morning the round is when this card is read. */
const NOW = '11:20';

const hhmm = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export default function I5() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [hour, setHour] = React.useState<number[]>([HOURS[cast.sector]]);

  React.useEffect(() => setHour([HOURS[cast.sector]]), [cast.sector]);

  /* the morning as it stands: the first two doors are behind the driver, the rest are on the van */
  const stops: RoundStop[] = React.useMemo(
    () =>
      buildRound(cast).map((stop, i) => ({
        ...stop,
        delivered: i < 2 ? stop.slot : undefined,
      })),
    [cast],
  );

  return (
    <DeskChassis selected={3} rows={9} height={720} daylist={{ label: "the day's rounds" }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <RoundView
          stops={stops}
          hour={hhmm(hour[0])}
          now={NOW}
          control={
            <div style={{ width: 260 }}>
              <FormControl label="Distinct after">
                <Slider
                  value={hour}
                  min={8}
                  max={14}
                  step={1}
                  onChange={({ value }) => value && setHour(value)}
                  valueToLabel={(v) => hhmm(v)}
                />
              </FormControl>
            </div>
          }
        />

        {/* the round itself, and whoever put the stops in that order */}
        <GRoute rows={6} />
      </div>
    </DeskChassis>
  );
}
