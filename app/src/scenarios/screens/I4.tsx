/* I4 · Capture a signature.
 *
 * WHAT IT IS ATTACHED TO is the whole question. A signature floating on its own screen is a
 * drawing; a signature under the stop it belongs to is a record. So the pad opens IN PLACE, on the
 * stop that was just swiped, with the customer and the albarán still legible above it — and once
 * it exists it stays there, small, as the mark on that row.
 *
 * THE CONTROL DELTA IS ONE SLOT. `drop-list` carries a `renderUnder` slot per stop; I3 leaves it
 * empty and I4 puts the pad in it. Same rows, same swipe, same count.
 *
 * THE SECOND HALF OF THE CARD is what the mark looks like once it exists — the pad's own read-only
 * variant, placed by its baseline rather than by its box, so the signature taken on a tall pad
 * still sits on the line when the row shows it at a third of the size.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import PhoneChassis from '../chassis/phone';
import DropList, { buildRound, type Stop } from '../canonical/drop-list';
import { SignaturePad, SIZE as PAD_SIZE, type SignatureValue } from '../../rocoto/signature-pad';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'I4',
  title: 'Capture a signature',
  group: 'I',
  frame: 'phone',
  ifText: 'the customer signs for the goods at the door',
  dims: ['D16.on-delivery', 'D17.driver'],
  job: 'Take the customer’s signature on the driver’s phone, on the stop it belongs to.',
  decides:
    'what a signature is attached to, and what it looks like once it exists — the mark stays on the row it was given for',
  inherits: [
    { region: 'the stop it belongs to', ref: 'I3' },
    { region: 'the albarán it signs for', ref: 'G1' },
    { region: 'where it appears afterwards', ref: 'H2' },
    { region: 'the delivery address', ref: 'J1a' },
  ],
  open: [{ region: 'who put the stops in this order', ref: 'OPEN-17' }],
  primitives: ['U15'],
  kit: ['Signature Pad', 'la entrega', 'Figure', 'Ghost'],
  canonical: 'drop-list',
  delta: 'control',
  deltaText: 'the signature pad stands in the stop’s own slot, under the row it signs for',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 10,
  fills: ['drop.signature'],
  reads: ['albarán'],
  live:
    'swipe a stop, then sign in the pad that opens under it and confirm — the mark stays on that row at record size, and the row states who signed and when',
};

export default function I4() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const stops = React.useMemo(() => buildRound(cast), [cast]);

  /* the driver is at the second stop of the morning; the first is already behind them */
  const [delivered, setDelivered] = React.useState<Record<string, string>>(() => ({
    [stops[0].id]: stops[0].slot,
  }));
  const [signatures, setSignatures] = React.useState<Record<string, SignatureValue>>({});

  React.useEffect(() => {
    setDelivered({ [stops[0].id]: stops[0].slot });
    setSignatures({});
  }, [cast.sector, stops]);

  const renderUnder = (stop: Stop) => {
    if (!delivered[stop.id]) return null;
    const signature = signatures[stop.id];
    return (
      <div
        style={{
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          padding: theme.sizing.scale500,
          background: theme.colors.backgroundPrimary,
        }}
      >
        {signature ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, minWidth: 0 }}>
            <SignaturePad readOnly value={signature} size={PAD_SIZE.compact} />
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              Signed for albarán {stop.albaran} at {delivered[stop.id]}
            </span>
          </div>
        ) : (
          <SignaturePad
            size={PAD_SIZE.compact}
            label={`Signature for albarán ${stop.albaran}`}
            hint="Sign above the line"
            typedName
            confirmLabel="Keep it"
            onConfirm={(value) => setSignatures((s) => ({ ...s, [stop.id]: value }))}
          />
        )}
      </div>
    );
  };

  return (
    <PhoneChassis
      height={920}
      width={380}
      placement="bottom"
      header={{ open: 17 }}
      behind={{ open: 17, label: 'the round' }}
      rows={4}
    >
      <DropList
        stops={stops}
        delivered={delivered}
        onDeliver={(stop) => setDelivered((d) => ({ ...d, [stop.id]: stop.slot }))}
        renderUnder={renderUnder}
        title={cast.order.deliveryDay}
      />
    </PhoneChassis>
  );
}
