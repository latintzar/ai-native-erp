/* A11 · Correct or reject a class.
 *
 * `D4.sku-class-restricted`, and the customer named a class the catalogue does not hold.
 *
 * POSITIVE SPACE. The class correction, once: the nearest classes that DO exist for that product,
 * one press, stored against the customer so the same correction never has to happen twice.
 *
 * THE CARD'S WHOLE ARGUMENT IS THE LABEL. Fruit says *categoría* and *calibre* daily; meat says
 * *categoría* and *conformación*; fish rarely says class at all — it says *talla*. That is exactly
 * the D4 label problem the brief names. Run the sector switch and watch: the control is the same
 * control, the chips are the same chips, and THE WORD ON THEM IS CONFIGURATION. A product that
 * needed a different screen per sector would have to redraw here, and it does not.
 *
 * The correction is offered to the customer as a composed line rather than sent on their behalf.
 * Sending is optional: this is a person's trade relationship and the software's job ends at
 * writing the sentence.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { OrderState } from '../canonical/order-surface';
import { Resolution, Candidates, classesOf, listOf, rank, type Candidate, type Write } from '../canonical/resolution';
import { Composer } from '../../rocoto/composer';
import { Message } from '../../rocoto/message';
import { GThread, GCatalogue } from '../ghosts/regions';
import { customerOf, familyOf, productOf } from '../data/cast';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A11',
  title: 'Correct or reject a class',
  group: 'A',
  frame: 'desk',
  ifText: 'a customer may name a class that exists for that product, and this one named a class the catalogue holds under another name',
  dims: ['D4.sku-class-restricted', 'D3.resolve'],
  job: 'Put the line on a class the catalogue holds, and store the correction against the customer.',
  decides:
    'which of the classes that exist a line takes when the customer named another one — and that the word on the control is configuration rather than a screen',
  inherits: [
    { region: "the order card's anatomy", ref: 'A1' },
    { region: 'the rail', ref: 'K' },
    { region: 'the thread the correction joins', ref: 'chat' },
    { region: 'the dossier', ref: 'J1a' },
    { region: 'the standing correction this write becomes', ref: 'J1b' },
  ],
  open: [
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
    { region: 'the catalogue that holds the classes', ref: 'OPEN-2' },
  ],
  primitives: ['U01'],
  kit: ['Tile', 'Composer', 'Message', 'Tag', 'Figure', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: 'the class chips open in the line, and the word on them comes from the family',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fruit',
  thread: [1],
  step: 3,
  fills: ['line.class', 'record.preference'],
  reads: ['record'],
  live:
    'press a class and the line takes it, the chips collapse to a tag and a line to the customer writes itself in the composer; the sector switch changes the word on the control and leaves everything else standing',
};

export default function A11() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [sent, setSent] = React.useState<string | null>(null);

  const customer = customerOf(cast, cast.order.customer);
  const target = cast.order.lines[0];
  const product = productOf(cast, target.product);
  const family = familyOf(cast, product);
  const classes = classesOf(cast, family);

  const candidates: Candidate[] = React.useMemo(
    () =>
      rank(classes.values, (v) => v, customer.id).map(({ item, history }) => ({
        id: item,
        label: `${classes.word} ${item}`,
        history,
      })),
    [classes, customer.id],
  );

  const picked = chosen ? candidates.find((c) => c.id === chosen) : undefined;

  const correction = React.useMemo(() => {
    if (!picked) return '';
    return `${product.name}: we hold ${classes.word} ${listOf(classes.values)}. Yours goes out as ${picked.label}.`;
  }, [picked, product.name, classes]);

  React.useEffect(() => {
    setChosen(null);
    setDraft('');
    setSent(null);
  }, [cast.sector]);

  React.useEffect(() => {
    setDraft(correction);
    setSent(null);
  }, [correction]);

  const writes: Write[] | undefined = picked
    ? [
        { object: 'This line', text: `${product.name} · ${picked.label}`, ref: 'A1' },
        {
          object: `${customer.name}'s record`,
          text: `${classes.word} ${classes.asked} means ${picked.label} for them`,
          ref: 'J1b',
        },
      ]
    : undefined;

  return (
    <DeskChassis dossier selected={2} rows={11} height={1140}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={cast}
            order={cast.order}
            state={<OrderState>{picked ? 'Ready for you' : 'One line waiting'}</OrderState>}
            openLine={target.id}
            renderOpenLine={() => (
              <Resolution
                ask={
                  <>
                    {customer.name} asked for {classes.word} <strong>{classes.asked}</strong>. The
                    catalogue holds {classes.word} {listOf(classes.values)} for{' '}
                    <Name of={product} />. Which one goes out?
                  </>
                }
                writes={writes}
              >
                <Candidates
                  candidates={candidates}
                  chosen={chosen}
                  onChoose={setChosen}
                  ariaLabel={`the ${classes.word} values this catalogue holds`}
                  settledText={`Saved. ${classes.word} ${classes.asked} means this for ${customer.name} from now on.`}
                />
              </Resolution>
            )}
          />

          {/* the correction, written for the person. Sending is theirs to choose. */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              A line to {customer.name}, if you want it
            </span>
            {sent && (
              <Message author="sent" time={cast.order.placedAt} status="sent">
                {sent}
              </Message>
            )}
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={() => {
                if (draft.trim() === '') return;
                setSent(draft);
                setDraft('');
              }}
              disabled={!picked}
              placeholder="the line writes itself once a class is chosen"
              sendLabel="Send the line"
            />
          </section>

          <GCatalogue rows={6} />
        </div>

        <GThread rows={8} />
      </div>
    </DeskChassis>
  );
}
