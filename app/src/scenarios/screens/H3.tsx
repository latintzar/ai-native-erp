/* H3 · Read the albarán without an account.
 *
 * THE ONLY ROCOTO SCREEN A RESTAURANT EVER OPENS, so this card decides the product's public face.
 * The answer is the document: the public chassis draws a ground and a slot, and what stands around
 * the albarán is the albarán.
 *
 * WHAT THE CHEF IS ACTUALLY READING FOR. The traceability facts, because the law makes them theirs
 * too — the scientific name and the FAO zone go onto their own menu, in their own hand, today. That
 * is the argument for capturing those facts once, well, at 05:00 in the coldest place in the
 * product (FLOWS §3c), and this page is where the argument is cashed.
 *
 * TWO STATES, BOTH DRAWN. An ordinary link opens on the document; a protected link opens on its
 * code. The second frame is the same page in its other state, and typing four digits into it
 * turns it into the first — the drawing accepts any four digits, where the real page checks the
 * one that travelled in the message.
 *
 * THE HOUSE'S OWN LETTERHEAD IS A GHOST (OPEN-18). Every name on this page comes from `cast.ts`,
 * and the distributor's own identity lives on the account's own surfaces, which sit outside groups
 * A–K entirely.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { PinCode } from 'baseui/pin-code';
import type { ScenarioMeta } from '../meta';
import PublicChassis from '../chassis/public';
import PublicDoc from '../canonical/public-doc';
import { buildAlbaran } from '../canonical/release';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'H3',
  title: 'Read the albarán without an account',
  group: 'H',
  frame: 'public',
  ifText: 'the customer opens the link they were sent',
  dims: ['D15.link'],
  job: 'Let a stranger read the albarán in their own browser.',
  decides:
    "the product's public face — the reading order of an albarán for somebody who has never seen this product, and the state a protected link opens on",
  inherits: [
    { region: 'the export row', ref: 'H4' },
    { region: 'the connection offer', ref: 'H5' },
    { region: 'the traceability rows', ref: 'E3' },
    { region: 'the albarán itself', ref: 'G1' },
    { region: 'the record of this opening', ref: 'H2' },
  ],
  open: [{ region: "the house's own letterhead", ref: 'OPEN-18' }],
  primitives: [],
  kit: ['Figure', 'Pin Code', 'Ghost'],
  canonical: 'public-doc',
  delta: 'origin',
  deltaText: 'the card that IS the public page; H4 and H5 put a row above it',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 9,
  fills: [],
  reads: ['albarán', 'lot.traceability[]'],
  live:
    'type four digits into the protected frame and the same page becomes the document; the sector switch swaps the traceability sub-line under every product name',
};

function Caption({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: theme.sizing.scale300,
      }}
    >
      {children}
    </div>
  );
}

export default function H3() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const albaran = React.useMemo(() => buildAlbaran(cast), [cast]);
  const [code, setCode] = React.useState(['', '', '', '']);
  const opened = code.every((c) => c !== '');

  React.useEffect(() => setCode(['', '', '', '']), [cast.sector]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(560px, 2fr) minmax(320px, 1fr)', gap: theme.sizing.scale700, minWidth: 940 }}>
      <div style={{ minWidth: 0 }}>
        <Caption>The link they opened</Caption>
        <PublicChassis height={760}>
          <PublicDoc albaran={albaran} />
        </PublicChassis>
      </div>

      <div style={{ minWidth: 0 }}>
        <Caption>The same page, protected</Caption>
        <PublicChassis height={760}>
          {opened ? (
            <PublicDoc albaran={albaran} />
          ) : (
            <PublicDoc
              albaran={albaran}
              gate={
                <>
                  <h1 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Albarán {albaran.number}</h1>
                  <p style={{ margin: 0, ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary }}>
                    Enter the four digits from the message and the albarán opens.
                  </p>
                  <PinCode
                    values={code}
                    onChange={({ values }) => setCode(values)}
                    aria-label="the code from the message"
                  />
                </>
              }
            />
          )}
        </PublicChassis>
      </div>
    </div>
  );
}
