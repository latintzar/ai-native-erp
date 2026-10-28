/* I1 · The send control.
 *
 * C-6, SETTLED: I1 IS A CARD AND IT IS NOT A SCREEN. Every situation gets a card, and this one is
 * one control on somebody else's surface — so it is drawn the way the method prescribes for a
 * sub-scenario: FULL FIDELITY INSIDE A GHOSTED G1. You see exactly where in the undecided page the
 * decided moment lives, and the card contributes ZERO screens to the app.
 *
 * WHAT IT DECIDES is small and it is the whole of the situation: where the control stands, what it
 * says, and what it says after it has been pressed. In a `D16.on-confirm` house the albarán goes
 * to the customer the moment it is confirmed, so the release and the send are one act — and the
 * evidence that they are one act is that this control sits inside G1's own foot rather than on a
 * screen of its own.
 *
 * THE DELTA-CARD SHOWS BOTH HOUSES. `D16.on-delivery` releases the document and the drop sends it;
 * `D16.on-confirm` collapses the two onto this control. Both states are drawn, because the card's
 * subject is the control's label and its after-state, and those differ.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import { buildAlbaran } from '../canonical/release';
import { GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'I1',
  title: 'The send control',
  group: 'I',
  frame: 'desk',
  ifText: 'the albarán goes to the customer the moment the distributor confirms it',
  dims: ['D16.on-confirm'],
  job: 'Send the albarán to the customer from the albarán screen itself.',
  decides:
    'where the send control stands on the albarán, what its label says, and what it says once it has been pressed',
  inherits: [
    { region: 'the whole albarán around it', ref: 'G1' },
    { region: 'where it lands', ref: 'H2' },
    { region: 'what the customer opens', ref: 'H3' },
  ],
  open: [{ region: "the day's bar and the day's documents", ref: 'OPEN-1' }],
  primitives: [],
  kit: ['Button', 'Tag', 'Ghost'],
  canonical: 'release',
  delta: 'control',
  deltaText: 'one control lifted off G1 and isolated; it adds no screen of its own',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 10,
  fills: ['albarán'],
  reads: ['albarán'],
  nests: { inside: 'G1' },
  live: 'press Send and read the after-state; the control keeps its place in the foot of the albarán',
};

export default function I1() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const albaran = React.useMemo(() => buildAlbaran(cast), [cast]);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => setSent(false), [cast.sector]);

  return (
    <DeskChassis selected={4} rows={11} height={760} daylist={{ label: "the day's albaranes" }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
        {/* THE PARENT, GHOSTED. Everything G1 decides stands here as architecture, so the one
            decided thing is visibly one control on somebody else's screen. */}
        <GRegion to="G1" height={64} shape="line" label="the albarán's head" />
        <GRegion to="G1" height={280} label="the albarán's lines and their traceability" />
        <GRegion to="G1" height={56} shape="line" label="the note for the driver" />

        {/* THE DECIDED MOMENT, AT FULL FIDELITY, in the place it really stands: the foot of the
            albarán, under the document it sends. */}
        <section
          style={{
            border: `1px solid ${theme.colors.contentPrimary}`,
            borderRadius: theme.borders.radius300,
            padding: theme.sizing.scale600,
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale400,
            background: theme.colors.backgroundPrimary,
          }}
        >
          {sent ? (
            <>
              <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
                Sent {albaran.releasedAt} to {albaran.customer.name}
              </Tag>
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                They have the link. Everything after this is on the record.
              </p>
              <div>
                <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setSent(false)}>
                  Send it again
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button kind={KIND.primary} size={SIZE.large} onClick={() => setSent(true)}>
                Send to {albaran.customer.name}
              </Button>
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                Albarán {albaran.number} · {albaran.lines.length} lines
              </p>
            </>
          )}
        </section>

        <GRegion to="H2" height={72} label="where it lands" />
      </div>
    </DeskChassis>
  );
}
