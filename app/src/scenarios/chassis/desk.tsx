/* THE DESK CHASSIS — C-11, and the answer to «twenty cards sit in a room nobody draws».
 *
 * OPEN-1, the day's order list, is the landing twenty cards stand inside and not one of them
 * decides. Rather than let twenty agents improvise twenty greys for the same room, the room is
 * built ONCE, here, with the OPEN-1 pointer on it. Every desk card imports this chassis, so the
 * openness stays explicit and the twenty cards agree about the shape of what they are standing in.
 *
 * The parts, per BUILD-PLAN §5.3: `GNav` + `GDaybar` + `GDaylist` (one row selected) + a main slot
 * + an optional ghosted `GDossier` drawer.
 *
 * A builder writes:  <DeskChassis dossier>{ the positive space }</DeskChassis>
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { GNav, GDaybar, GDaylist, GDossier } from '../ghosts/regions';

export type DeskChassisProps = {
  /** the positive space — the one thing this card decides */
  children: React.ReactNode;
  /** the customer dossier drawer, ghosted, on the right */
  dossier?: boolean;
  /** which row of the day's list this card is standing on */
  selected?: number;
  /** how many orders stand in the day (density is real — a list of three where a hundred belong
   *  is a defect, and a fish morning is not a hundred either) */
  rows?: number;
  /** retarget the day's list — on a document card it is the document inbox, not the orders */
  daylist?: { to?: string; open?: number; label?: React.ReactNode };
  /** the day bar is absent on the few desk surfaces that are not the day's list */
  daybar?: boolean;
  /** the surface's own height. The chassis is a window onto a screen, not a page. */
  height?: number;
};

export default function DeskChassis({
  children,
  dossier = false,
  selected = 2,
  rows = 9,
  daylist,
  daybar = true,
  height = 660,
}: DeskChassisProps) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `auto 280px minmax(600px, 1fr)${dossier ? ' 260px' : ''}`,
        minWidth: dossier ? 1420 : 1160,
        height,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        overflow: 'hidden',
        background: theme.colors.backgroundPrimary,
      }}
    >
      {/* the rail — group K decides which destinations exist at all */}
      <div style={{ borderRight: `1px solid ${theme.colors.borderOpaque}`, padding: theme.sizing.scale400, display: 'flex' }}>
        <GNav variant="side" items={5} selected={0} />
      </div>

      {/* the day's list — OPEN-1, drawn once here for the twenty cards that stand in it */}
      <div
        style={{
          borderRight: `1px solid ${theme.colors.borderOpaque}`,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale400,
          padding: theme.sizing.scale400,
          minWidth: 0,
          background: theme.colors.backgroundSecondary,
        }}
      >
        {daybar && <GDaybar />}
        <GDaylist rows={rows} selected={selected} {...daylist} />
      </div>

      {/* the positive space */}
      <div style={{ minWidth: 0, overflowY: 'auto', padding: theme.sizing.scale700 }}>{children}</div>

      {/* the dossier — everything the software learned, decided on J1a */}
      {dossier && (
        <div
          style={{
            borderLeft: `1px solid ${theme.colors.borderOpaque}`,
            padding: theme.sizing.scale400,
            display: 'flex',
            flexDirection: 'column',
            background: theme.colors.backgroundSecondary,
            minWidth: 0,
          }}
        >
          <GDossier />
        </div>
      )}
    </div>
  );
}
