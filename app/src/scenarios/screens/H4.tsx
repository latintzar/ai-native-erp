/* H4 · Add this albarán to my own system.
 *
 * THE MOST COMMERCIALLY VALUABLE CARD IN THE CATALOGUE, and the argument is not that it saves the
 * restaurant time. It is that a distributor whose albaranes can be absorbed without retyping
 * becomes easier to buy from than one whose albaranes cannot — a reason for restaurants to choose
 * that distributor, which is a stronger argument to sell to the distributor than any internal
 * saving of theirs.
 *
 * IT IS ALSO THE CARD WITH THE BIGGEST HOLE UNDER IT. `OPEN-15` — which cost-control systems accept
 * an import, and in what format — has no answer, and no amount of drawing produces one. So the row
 * is drawn honestly and in two tiers:
 *
 *   · ONE REAL DESTINATION. A dated file of the albarán's own lines, which needs nobody's
 *     confirmation to be true and works the first time on any system that reads a table. It is a
 *     real button and it really changes state.
 *   · THE NAMED SYSTEMS, AS GHOSTS. Each tile carries the OPEN-15 pointer. Drawing a plausible
 *     product name on one of them would be inventing the answer to the open question, and the
 *     first person to read the card would take it for a decision.
 *
 * THE ROW STANDS ABOVE THE DOCUMENT, because on this card the row is the reason the page was
 * opened and the albarán is the evidence behind it. The list of systems is DATA: adding one is a
 * row in a list and changes no screen, which is the brief's own requirement.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { ScenarioMeta } from '../meta';
import PublicChassis from '../chassis/public';
import PublicDoc from '../canonical/public-doc';
import { buildAlbaran } from '../canonical/release';
import { GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'H4',
  title: 'Add this albarán to my own system',
  group: 'H',
  frame: 'public',
  ifText:
    'the page offers buttons that put the albarán into the customer’s own system, in that system’s own format',
  dims: ['D15.link-export'],
  job: 'Put this albarán into the customer’s own cost-control system in one press.',
  decides:
    'that the export is a row of destinations on the public page, that the list of destinations is data, and that one press is the whole of the interaction',
  inherits: [
    { region: 'the albarán underneath', ref: 'H3' },
    { region: 'the connection that removes the press', ref: 'H5' },
    { region: 'the albarán itself', ref: 'G1' },
  ],
  open: [
    { region: 'which systems accept an import, and in what format', ref: 'OPEN-15' },
    { region: "the house's own letterhead", ref: 'OPEN-18' },
  ],
  primitives: ['U13'],
  kit: ['Button', 'Tag', 'Figure', 'Ghost'],
  canonical: 'public-doc',
  delta: 'control',
  deltaText: 'a row of export destinations stands above the document',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 9,
  fills: [],
  reads: ['albarán'],
  live:
    'press the file destination and the row states the file it produced, named after this albarán; the named systems stand as ghosts until OPEN-15 is answered',
};

export default function H4() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const albaran = React.useMemo(() => buildAlbaran(cast), [cast]);
  const [made, setMade] = React.useState(false);

  React.useEffect(() => setMade(false), [cast.sector]);

  const fileName = `albaran-${albaran.number}.csv`;

  return (
    <PublicChassis height={860} decidedIn="H3">
      <PublicDoc
        albaran={albaran}
        lead={
          <section
            style={{
              background: theme.colors.backgroundPrimary,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius400,
              padding: theme.sizing.scale700,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale500,
            }}
          >
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
              Put this albarán into your system
            </h2>

            <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* THE ONE DESTINATION THAT IS TRUE TODAY: the albarán's own lines, dated, in a
                  format any system that reads a table will take. */}
              {made ? (
                <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>
                  {fileName} · {albaran.lines.length} lines
                </Tag>
              ) : (
                <Button kind={KIND.primary} size={SIZE.default} onClick={() => setMade(true)}>
                  A dated file of these lines
                </Button>
              )}

              {/* THE NAMED SYSTEMS. Ghosts, each carrying OPEN-15, because the founder has not
                  named one yet and a plausible name would read as a decision. */}
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 184 }}>
                  <GRegion open={15} height={40} shape="block" label="a system" />
                </div>
              ))}
            </div>

            {made && (
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                It carries every line below, with its lote and its traceability, ready to read.
              </p>
            )}
          </section>
        }
      />
    </PublicChassis>
  );
}
