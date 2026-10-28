/* THE DROP LIST — today's stops in route order, on a driver's phone.
 *
 * P6 owns this file. Two cards instantiate it: **I3** (origin — mark stops as delivered) and
 * **I4** (control delta — the signature pad stands over the stop).
 *
 * THE CONDITIONS ARE THE DESIGN. One-handed, in a vehicle, possibly in rain, with the other hand
 * on a crate. So: large targets, one gesture per stop, the count that remains always legible, and
 * a swipe rather than a tap — a tap is what a phone does when it is dropped.
 *
 * THE PER-CUSTOMER DELTA, NEVER A PER-SECTOR ONE (SECTORS §9). A stop that settles cash carries an
 * amount to collect and the control that records it; a stop on credit carries neither. That flag
 * lives on the customer in `cast.ts`, so the sector switch changes only HOW MANY ROWS carry the
 * control — fruit has the most cash at the counter, fish and meat less. Nothing about the screen
 * moves.
 *
 * THE ADDRESS IS A GHOST INSIDE THE ROW, pointing at J1a, which owns a customer's addresses. It is
 * a bare `GhostBlock` with its reference rather than a `GRegion`, because the row is a swipe target
 * and a link inside a swipe target is a link that never fires — a pointer that lies is worse than
 * a pointer that is only written down. The live chip is in the meta strip.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { GhostBlock } from '../../rocoto/ghost';
import { Figure } from '../../rocoto/figure';
import { Entrega, THRESHOLD, SIZE as ENTREGA_SIZE } from '../../rocoto/la-entrega';
import type { Cast, Customer } from '../data/cast';
import Name from '../shell/Name';
import { todaysAlbaranes } from './release';

/* ── THE ROUND ────────────────────────────────────────────────────────────────────────────────
 * Built from the cast's customers, in the order a van would take them. Who put them in that order
 * is OPEN-17 and this file says so rather than deciding it.
 */

export type Stop = {
  id: string;
  customer: Customer;
  /** the slot the round gives this stop */
  slot: string;
  /** the document travelling with the goods */
  albaran: string;
  lines: number;
  /** the amount to collect at the door. Present only where the customer settles cash. */
  collect?: number;
};

/** The slots a morning round runs to, and the value of each drop. Figures, not names — the names
 *  all come from the cast. */
const SLOTS = ['08:20', '09:00', '09:30', '10:15', '11:00'];
const VALUES = [214.6, 388.2, 1240.5, 96.4, 502.0];

export function buildRound(cast: Cast): Stop[] {
  return todaysAlbaranes(cast).map((doc, i) => ({
    id: doc.customer.id,
    customer: doc.customer,
    slot: SLOTS[i % SLOTS.length],
    albaran: doc.number,
    lines: doc.lines,
    collect: doc.customer.settles === 'cash on delivery' ? VALUES[i % VALUES.length] : undefined,
  }));
}

/* ── THE STOP, as the row reads it ──────────────────────────────────────────────────────────── */

function StopFace({ stop, address }: { stop: Stop; address?: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0, width: '100%' }}>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={theme.typography.LabelMedium}>
          <Name of={stop.customer} />
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
            {stop.slot}
          </span>
          {/* the address — a customer's addresses are decided on J1a. The driver reads a street
              here; the albarán's number is behind the stop and belongs on the document. A surface
              that HAS the second line passes it in (`renderAddress`), which is what the app does:
              inside the app every block has an owner, so a catalogue pointer would point at a page
              that is not there. */}
          {address ?? <GhostBlock shape="line" width={104} height={8} reference="J1a" />}
        </span>
      </span>
      {stop.collect !== undefined && (
        <span style={{ whiteSpace: 'nowrap' }}>
          <Figure value={stop.collect} unit="€" size="compact" />
        </span>
      )}
    </span>
  );
}

/* ── THE SCREEN ─────────────────────────────────────────────────────────────────────────────── */

export type DropListProps = {
  stops: Stop[];
  /** the stops already swept, and the time each was swept at */
  delivered: Record<string, string>;
  onDeliver: (stop: Stop) => void;
  /** the cash stops already settled at the door */
  collected?: Record<string, boolean>;
  onCollect?: (stop: Stop) => void;
  /** what stands under a stop — I4's pad hangs here */
  renderUnder?: (stop: Stop) => React.ReactNode;
  /** the row's second line, beside the slot. Additive: left off, it is the ghosted address J1a
   *  owns; a surface that knows what the driver reads there passes it. */
  renderAddress?: (stop: Stop) => React.ReactNode;
  /** the head above the round: the day, and what is left of it */
  title?: React.ReactNode;
  /** anything the round carries under the last stop */
  foot?: React.ReactNode;
};

export default function DropList({
  stops,
  delivered,
  onDeliver,
  collected = {},
  onCollect,
  renderUnder,
  renderAddress,
  title,
  foot,
}: DropListProps) {
  const [, theme] = useStyletron();
  const remaining = stops.filter((s) => !delivered[s.id]).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale400 }}>
        <span style={theme.typography.LabelLarge}>{title ?? 'Today'}</span>
        {/* THE COUNT THAT REMAINS. The one number a driver looks for, and it is legible from the
            seat: how many doors are left. */}
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
          {remaining} {remaining === 1 ? 'stop left' : 'stops left'}
        </span>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
        {stops.map((stop) => (
          <div key={stop.id} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
            <Entrega
              size={ENTREGA_SIZE.large}
              threshold={THRESHOLD.door}
              isCompleted={!!delivered[stop.id]}
              onComplete={() => onDeliver(stop)}
              aria-label={`mark ${stop.customer.name} delivered`}
              label={<StopFace stop={stop} address={renderAddress?.(stop)} />}
              completedLabel={
                <span style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'baseline' }}>
                  <span>{stop.customer.name}</span>
                  <span style={theme.typography.ParagraphSmall}>delivered {delivered[stop.id]}</span>
                </span>
              }
            />

            {/* THE CASH STOP'S SECOND ACT — the cobro. It rides the row it belongs to, it exists
                only where the customer settles cash, and the sector switch changes how many rows
                have it because that flag is on the customer (SECTORS §9). */}
            {stop.collect !== undefined && (
              <div style={{ paddingLeft: theme.sizing.scale1600, display: 'flex' }}>
                {collected[stop.id] ? (
                  <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
                    Collected {stop.collect.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </Tag>
                ) : (
                  <Button
                    kind={KIND.secondary}
                    size={SIZE.compact}
                    onClick={() => onCollect?.(stop)}
                  >
                    Collect {stop.collect.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </Button>
                )}
              </div>
            )}

            {renderUnder?.(stop)}
          </div>
        ))}
      </div>

      {foot}
    </div>
  );
}
