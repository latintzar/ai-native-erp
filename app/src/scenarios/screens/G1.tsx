/* G1 · Release the albarán.
 *
 * THE LAST EDITABLE MOMENT. Everything the software knows is already on the sheet — the lote from
 * the batch, the traceability facts from the family's profile, the weights from the scale — and
 * the only thing a person adds is the one thing software cannot know: a note for the driver. Then
 * it goes.
 *
 * DRAWN WITH THE FISH ALBARÁN, deliberately, because it is the widest traceability sub-line the
 * product will ever print: eight facts on a second, smaller line under the product name. Run the
 * sector switch and the sub-line drops to six for meat and six for fruit — AND THE TABLE'S COLUMNS
 * NEVER MOVE. That stillness is the proof that C-2 is right and D12 is data.
 *
 * THE HOLD IS A1'S HOLD. `HoldToConfirm` is imported from P0's frozen order surface rather than
 * rebuilt: committing an albarán for a real customer costs the same second of intent as committing
 * an order, and two implementations of one gesture is two gestures. That makes G1's primary a
 * SHARED LOCKUP with A1's (C-5), and it is reported as one.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Release, { ReleaseState, buildAlbaran } from '../canonical/release';
import { HoldToConfirm } from '../canonical/order-surface';
import { GBatchbook, GSheet } from '../ghosts/regions';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'G1',
  title: 'Release the albarán',
  group: 'G',
  frame: 'desk',
  ifText: 'Rocoto produces the albarán, with the batch and traceability fields already filled',
  dims: ['D14.rocoto', 'D16.on-delivery'],
  job: 'Check the albarán once, add what software cannot know, and release it.',
  decides:
    'that the editable moment on a document exists for exactly one thing — the note a person adds — and that everything the software already knows is on the sheet before a hand touches it',
  inherits: [
    { region: 'the traceability rows', ref: 'E3' },
    { region: 'the weights', ref: 'F1' },
    { region: 'the lines this document was built from', ref: 'A1' },
    { region: 'the send trigger', ref: 'I1' },
    { region: 'the printed layout', ref: 'H1' },
    { region: 'the delivery record', ref: 'H2' },
    { region: 'the rail', ref: 'K' },
    { region: "the day's picking sheet", ref: 'F0' },
  ],
  open: [
    { region: "the day's bar and the day's documents", ref: 'OPEN-1' },
    { region: 'the batch ledger the lotes came from', ref: 'OPEN-5' },
  ],
  primitives: [],
  kit: ['Figure', 'Textarea', 'Form Control', 'Button', 'Tag', 'Ghost'],
  canonical: 'release',
  delta: 'origin',
  deltaText: 'the card that IS the albarán; I1 is one control lifted off it',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 8,
  fills: ['albarán'],
  reads: ['lot.traceability[]', 'line.sent_qty', 'order'],
  live:
    "type the driver's note — it is the only field on the screen — then hold the primary and the albarán is released; the sector switch swaps the sub-line from eight facts to six with the column heads standing still",
};

export default function G1() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const albaran = React.useMemo(() => buildAlbaran(cast), [cast]);
  const [note, setNote] = React.useState('');
  const [released, setReleased] = React.useState(false);

  /* a different sector is a different house's albarán, so the state that belongs to THIS document
     goes back to the start with it */
  React.useEffect(() => {
    setNote('');
    setReleased(false);
  }, [cast.sector]);

  return (
    <DeskChassis selected={4} rows={11} height={900} daylist={{ label: "the day's albaranes" }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <Release
          albaran={albaran}
          note={note}
          onNote={setNote}
          state={<ReleaseState>{released ? `Released ${albaran.releasedAt}` : 'Open for edits'}</ReleaseState>}
          primary={
            released ? undefined : (
              <HoldToConfirm onConfirm={() => setReleased(true)}>Hold to release</HoldToConfirm>
            )
          }
          after={
            released ? (
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                It travels with the goods to {albaran.customer.name}.
              </p>
            ) : undefined
          }
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
          {/* where the lotes and the traceability facts came from */}
          <GBatchbook rows={5} to="E3" label="the batches behind these lines" />
          {/* the sheet the picker worked from this morning */}
          <GSheet />
        </div>
      </div>
    </DeskChassis>
  );
}
