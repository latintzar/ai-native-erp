/* THE SECTOR SWITCH — fish · meat · fruit.
 *
 * It re-renders the screen on the card from `data/cast.ts` and changes nothing else. THAT IS THE
 * WHOLE POINT: it is the mechanical proof of «same screen, different data». A card that breaks
 * under the switch is a defect in the screen, not a fourth sector, and it goes back to SECTORS.
 *
 * Beside it, the card's own verdict for the sector on screen — `=` same screen · `Δ` same screen,
 * different content · `≠` absent — read from `meta.sector`, so the switch always states what the
 * card claims about the sector it is currently rendering.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import type { SectorId, Verdict } from '../meta';
import { SECTORS, CASTS, VERDICT_TEXT } from '../data/cast';
import { useSector } from './context';

export type SectorSwitchProps = {
  /** the card's own verdicts, so the switch can say what this card claims */
  verdicts?: { fish: Verdict; meat: Verdict; fruit: Verdict };
};

export default function SectorSwitch({ verdicts }: SectorSwitchProps) {
  const [, theme] = useStyletron();
  const { sector, setSector } = useSector();
  const index = SECTORS.indexOf(sector);
  const verdict = verdicts?.[sector];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
      {/* THE THREE ARE WRITTEN OUT, not mapped, and that is load-bearing: Base keys a Segment by
          `child.key` and falls back to the child's INDEX, and React prefixes an array key with
          `.$` — so a mapped list hands `onChange` «.$fish» where the control compares against the
          index. Three explicit children keep the contract Base actually documents. */}
      <SegmentedControl
        activeKey={index}
        onChange={({ activeKey }) => setSector(SECTORS[Number(activeKey)] as SectorId)}
        overrides={{ Root: { style: { width: 'auto' } } }}
      >
        <Segment label={CASTS.fish.label} description={CASTS.fish.hour} />
        <Segment label={CASTS.meat.label} description={CASTS.meat.hour} />
        <Segment label={CASTS.fruit.label} description={CASTS.fruit.hour} />
      </SegmentedControl>
      {verdict && (
        <span
          style={{
            ...theme.typography.LabelSmall,
            color: theme.colors.contentSecondary,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ ...theme.typography.LabelMedium, color: theme.colors.contentPrimary }}>{verdict}</span>{' '}
          {VERDICT_TEXT[verdict]}
        </span>
      )}
    </div>
  );
}
