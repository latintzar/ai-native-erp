/* THE PHONE CHASSIS — the market floor, the loading bay, the cold room, the van.
 *
 * BUILD-PLAN §5.3: a ghosted mobile header, the day's list behind, and the moment slot as an
 * OVERLAY CARD OVER A SCRIM, per the capture doctrine. The doctrine is the reason the moment is
 * an overlay rather than a page: a capture happens ON TOP of what the person was doing, one
 * -handed, and it hands the surface back when it is done.
 *
 * The frame is a plain rectangle at a phone's proportion. No notch, no bezel art, no device
 * chrome: ornament is banned, and a drawn phone would decide nothing the card is deciding.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { OverlayCard } from '../../rocoto/overlay-card';
import { GRegion, GDaylist } from '../ghosts/regions';

export type PhoneChassisProps = {
  /** the moment — the one thing this card decides, over the scrim */
  children: React.ReactNode;
  /** what stands behind the moment, and who decides it */
  behind?: { to?: string; open?: number; label?: React.ReactNode };
  /** how many rows stand behind */
  rows?: number;
  /** the moment reads as a sheet at the bottom (a capture) or as a card in the middle (a decision) */
  placement?: 'bottom' | 'center';
  /** who owns the header of the surface underneath */
  header?: { to?: string; open?: number };
  height?: number;
  width?: number;
};

export default function PhoneChassis({
  children,
  behind,
  rows = 8,
  placement = 'bottom',
  header,
  height = 660,
  width = 340,
}: PhoneChassisProps) {
  const [, theme] = useStyletron();
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);

  return (
    <div
      ref={setNode}
      style={{
        position: 'relative',
        width,
        height,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius500,
        overflow: 'hidden',
        background: theme.colors.backgroundPrimary,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale300,
        padding: theme.sizing.scale400,
      }}
    >
      {/* the surface underneath — architecture, pointered, inert */}
      <GRegion
        {...(header?.to ? { to: header.to } : { open: header?.open ?? 1 })}
        shape="line"
        height={theme.sizing.scale800}
        label="the header"
      />
      <GDaylist rows={rows} selected={-1} {...behind} />

      {/* the moment — over a scrim, on the surface it interrupts */}
      {node && (
        <OverlayCard
          isOpen
          mountNode={node}
          placement={placement}
          size="full"
          scrim="dim"
          dismissable={false}
          animate={false}
          autoFocus={false}
          focusLock={false}
          returnFocus={false}
          ariaLabel="the moment this card decides"
        >
          {children}
        </OverlayCard>
      )}
    </div>
  );
}
