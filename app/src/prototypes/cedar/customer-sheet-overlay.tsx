/* A customer sheet opened from another object. This is deliberately an adapter over the Customers
 * area's canonical editable sheet: it supplies the same live account fold and sales/basket facts,
 * while the caller retains ownership of navigation/history layers. */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import type { Cast, Customer } from '../../scenarios/data/cast';
import { CustomerSheet } from './areas/customers';
import { accountOf, useCustomerEdits } from './customer-edits';
import { nowOf, useDay } from './day';
import { useGrants } from './grants';
import { basketOf } from './knows';
import { buildSales, todayId } from './sale';
import { focusThread, usePhone } from './shell';

export type CustomerSheetOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  cast: Cast;
  /** May be the seeded customer. The adapter subscribes to the current account fold itself. */
  customer: Customer;
};

/**
 * Full editable customer sheet for an object-level overlay.
 *
 * It never clones account, sale, or basket data. Successful writes pass through `setAccount` in
 * the canonical sheet and immediately re-read the account fold; historical sales remain the
 * documents built by `buildSales`. The caller owns any product/customer history-layer state.
 *
 * ── §196.6 · THE PHONE RAIL RIDES THIS OVERLAY UNCHANGED (E193.07) ─────────────────────────
 * The calls the runtime holds on this account's number, the diarised Spanish transcript and the
 * Places identity card are organs of `CustomerSheet`, so an account opened from an albarán answers
 * the phone question in exactly the grammar the book answers it in — the §137.1 law, applied to
 * the rail §196.6 added. Nothing about the voice objects is passed in or re-drawn here; each one
 * reads `voice.ts` for itself and states the same posture, «Connected» or «Runtime · not
 * reachable», on both doors.
 */
export function CustomerSheetOverlay({ isOpen, onClose, cast, customer }: CustomerSheetOverlayProps) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const accountEdits = useCustomerEdits();
  const dayEdits = useDay(cast.sector);
  const grants = useGrants();

  const liveCustomer = React.useMemo(() => accountOf(customer), [customer, accountEdits]);
  const sales = React.useMemo(() => buildSales(cast, dayEdits), [cast, dayEdits, grants]);
  const theirs = React.useMemo(
    () => sales.filter((sale) => sale.customer.id === liveCustomer.id),
    [sales, liveCustomer.id],
  );
  const basket = React.useMemo(() => basketOf(cast, liveCustomer), [cast, liveCustomer]);
  const today = todayId(cast);
  const now = nowOf(cast);

  return (
    <OverlayCard
      isOpen={isOpen}
      onClose={onClose}
      scrim={SCRIM.dim}
      size={phone ? 'full' : 800}
      ariaLabel={`Customer: ${liveCustomer.name}`}
      overrides={phone ? {
        Card: {
          style: {
            width: '100%',
            maxWidth: '100%',
            height: '100%',
            maxHeight: '100%',
            margin: 0,
            borderRadius: 0,
          },
        },
      } : undefined}
    >
      <div
        data-testid="customer-sheet-overlay"
        data-customer={liveCustomer.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale700,
          minWidth: 0,
          height: phone ? '100%' : undefined,
          maxHeight: phone ? '100%' : '80vh',
          overflowY: 'auto',
          overflowX: 'clip',
        }}
      >
        <CustomerSheet
          cast={cast}
          customer={liveCustomer}
          theirs={theirs}
          basket={basket}
          today={today}
          now={now}
          onBack={onClose}
          onBackLabel="Close"
          onChat={() => { onClose(); window.setTimeout(() => focusThread(cast.sector, liveCustomer.id), 120); }}
        />
      </div>
    </OverlayCard>
  );
}

export default CustomerSheetOverlay;
