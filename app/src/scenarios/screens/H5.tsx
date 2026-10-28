/* H5 · Authorise once.
 *
 * THE SAME PUBLIC PAGE with the handshake standing where H4's export row stood — choose the
 * system, authorise, done — and a plain statement of what changes afterwards, which is the whole
 * value of the act: from here on nobody presses anything.
 *
 * THE THIRD STEP IS THE SUBJECT. A handshake screen that ends on «Connected» has told the customer
 * nothing; the step that matters says what their mornings look like now. So the last step carries
 * the sentence and the first two carry the mechanics.
 *
 * WHICH SYSTEM IS STILL OPEN-15. The chooser in step one is a ghosted list, for the same reason
 * H4's tiles are ghosted: the founder has not named a system, and a plausible name in a chooser
 * reads as a decision that a real integration exists.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { ProgressSteps, Step } from 'baseui/progress-steps';
import type { ScenarioMeta } from '../meta';
import PublicChassis from '../chassis/public';
import PublicDoc from '../canonical/public-doc';
import { buildAlbaran } from '../canonical/release';
import { GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'H5',
  title: 'Authorise once',
  group: 'H',
  frame: 'public',
  ifText: 'the customer connects their own system to this distributor for the first time',
  dims: ['D15.connected'],
  job: 'Authorise the connection once, and say what happens from now on.',
  decides:
    'the shape of the one-time handshake, and that its last step states what changes rather than that it finished',
  inherits: [
    { region: 'the albarán underneath', ref: 'H3' },
    { region: 'the export row it replaces', ref: 'H4' },
    { region: 'the ordinary state afterwards', ref: 'H6' },
  ],
  open: [
    { region: 'which systems can be connected', ref: 'OPEN-15' },
    { region: "the house's own letterhead", ref: 'OPEN-18' },
  ],
  primitives: ['U14'],
  kit: ['Progress Steps', 'Button', 'Figure', 'Ghost'],
  canonical: 'public-doc',
  delta: 'control',
  deltaText: 'the handshake stands where H4’s export row stands',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 9,
  fills: [],
  reads: ['albarán'],
  live:
    'walk the three steps; the last one states what every morning looks like afterwards, and the albarán underneath never moves',
};

export default function H5() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const albaran = React.useMemo(() => buildAlbaran(cast), [cast]);
  const [step, setStep] = React.useState(0);

  React.useEffect(() => setStep(0), [cast.sector]);

  return (
    <PublicChassis height={880} decidedIn="H3">
      <PublicDoc
        albaran={albaran}
        lead={
          <section
            style={{
              background: theme.colors.backgroundPrimary,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius400,
              padding: theme.sizing.scale700,
            }}
          >
            <h2 style={{ margin: `0 0 ${theme.sizing.scale500}`, ...theme.typography.HeadingXSmall }}>
              Receive every albarán in your own system
            </h2>

            <ProgressSteps current={step}>
              <Step title="Choose your system">
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, paddingBottom: theme.sizing.scale400 }}>
                  {/* which systems can be connected — OPEN-15 */}
                  <div style={{ display: 'flex', maxWidth: 420 }}>
                    <GRegion open={15} height={96} label="the systems" />
                  </div>
                  <div>
                    <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setStep(1)}>
                      Continue
                    </Button>
                  </div>
                </div>
              </Step>

              <Step title="Authorise">
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, paddingBottom: theme.sizing.scale400 }}>
                  <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                    Your system asks you to allow this distributor to send albaranes. Say yes once.
                  </p>
                  <div style={{ display: 'flex', gap: theme.sizing.scale300 }}>
                    <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setStep(2)}>
                      Allow
                    </Button>
                    <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setStep(0)}>
                      Choose another system
                    </Button>
                  </div>
                </div>
              </Step>

              <Step title="From now on">
                {/* THE STEP THAT MATTERS. What their mornings look like afterwards. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, paddingBottom: theme.sizing.scale400 }}>
                  <p style={{ margin: 0, ...theme.typography.ParagraphMedium }}>
                    Every albarán arrives in your system on the day it is delivered, with its lote
                    and its traceability already on the line. Albarán {albaran.number} is the first
                    one.
                  </p>
                  <div>
                    <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setStep(0)}>
                      Start again
                    </Button>
                  </div>
                </div>
              </Step>
            </ProgressSteps>
          </section>
        }
      />
    </PublicChassis>
  );
}
