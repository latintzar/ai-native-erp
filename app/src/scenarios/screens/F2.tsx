/* F2 · Supply a box weight.
 *
 * The weight of a box of a product is not yet known, and the person who finds that out is standing
 * at the bench with the box in their hands.
 *
 * POSITIVE SPACE. The one-time box weight, stored against the product and never asked again —
 * ONE-HANDED. Type it, or hold the microphone and say it, which is what happens when the other
 * hand is holding the box.
 *
 * REDUCTION: **F2 ≡ A9.** One screen, two entry points. Literally the same `Capture` component,
 * with a voice control in its assist slot because the bench has one hand free and the desk has
 * two. The brief does not name this pair; it should. That is why the moment is an overlay on the
 * phone rather than a page: a capture happens ON TOP of what the person was doing and hands the
 * surface straight back.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import PhoneChassis from '../chassis/phone';
import { Capture, Writes, type Write } from '../canonical/resolution';
import { StatefulVoiceButton } from '../../rocoto/voice-button-kit';
import { Figure } from '../../rocoto/figure';
import RefChip from '../shell/RefChip';
import { productOf } from '../data/cast';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'F2',
  title: 'Supply a box weight',
  group: 'F',
  frame: 'phone',
  ifText: 'the weight of a box of a product is not yet on file, and somebody is holding the box',
  dims: ['D5.any-unit', 'D13.weigh-some', 'D3.setup'],
  job: 'Enter or speak how much a box holds, and store it on the product.',
  decides:
    'the box weight a product carries from now on, captured at the bench with one hand',
  inherits: [
    { region: 'the same capture at the desk', ref: 'A9' },
    { region: 'the lines being picked', ref: 'A1' },
    { region: 'the weighed value this nominal meets', ref: 'F1' },
  ],
  open: [
    { region: 'the catalogue that holds the pack', ref: 'OPEN-2' },
    { region: "the day's picking behind the moment", ref: 'OPEN-1' },
  ],
  primitives: ['U01'],
  kit: ['Input', 'Voice Button', 'Figure', 'Overlay Card', 'Tag', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText:
    "A9's one-field capture, reached from the bench on the phone chassis — F2 ≡ A9, one screen and two entry points",
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 7,
  fills: ['product.pack_factor'],
  reads: [],
  live:
    'type the weight, or hold the microphone and say it and the field fills on release; store it and the tag says it is on the product',
};

export default function F2() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [typed, setTyped] = React.useState('');
  const [stored, setStored] = React.useState(false);
  const [spoke, setSpoke] = React.useState(false);

  React.useEffect(() => {
    setTyped('');
    setStored(false);
    setSpoke(false);
  }, [cast.sector]);

  /* the product on the bench: the first one bought in a pack whose weight the scale has to settle */
  const product = React.useMemo(() => {
    const line = cast.order.lines.find((l) => productOf(cast, l.product).pack) ?? cast.order.lines[0];
    return productOf(cast, line.product);
  }, [cast]);

  const pack = product.pack;
  const ratio = Number(typed.replace(',', '.'));
  const resolves = Number.isFinite(ratio) && ratio > 0;

  const writes: Write[] | undefined =
    stored && resolves && pack
      ? [
          {
            object: product.name,
            text: `a ${pack.unit} holds ${ratio.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ${product.unit}`,
            ref: 'A9',
          },
          {
            object: "Today's picking",
            text: 'every line of this product converts on its own from here',
            ref: 'A1',
          },
        ]
      : undefined;

  return (
    <PhoneChassis
      behind={{ to: 'A1', label: 'the lines being picked' }}
      header={{ to: 'A1' }}
      rows={9}
      placement="bottom"
      height={680}
      width={360}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
        <div>
          <div style={theme.typography.HeadingXSmall}>
            <Name of={product} />
          </div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            How much one {pack ? pack.unit : product.unit} holds
          </div>
        </div>

        <Capture
          label={`One ${pack ? pack.unit : product.unit} holds`}
          unit={product.unit}
          value={typed}
          onChange={setTyped}
          onStore={() => setStored(true)}
          stored={stored}
          storedOn={<Name of={product} />}
          storeLabel="Store it"
          assist={
            stored ? undefined : (
              /* THE OTHER HAND IS HOLDING THE BOX. Hold, say the number, release. */
              <StatefulVoiceButton
                simulate
                seed={`${cast.sector}-${product.id}`}
                size="compact"
                onRecord={() => {
                  setSpoke(true);
                  if (pack) setTyped(String(pack.factor).replace('.', ','));
                }}
              />
            )
          }
        />

        {spoke && !stored && (
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            Heard at the bench. Edit it if the scale says otherwise.
          </span>
        )}

        {resolves && !stored && pack && (
          <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'baseline' }}>
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              One {pack.unit} is
            </span>
            <Figure value={ratio} unit={product.unit} decimals={1} size="large" />
          </div>
        )}

        {writes && <Writes writes={writes} />}

        <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
          <RefChip to="A9" size="mini">
            the same capture at the desk
          </RefChip>
          <RefChip to="F1" size="mini">
            what the scale records
          </RefChip>
        </div>
      </div>
    </PhoneChassis>
  );
}
