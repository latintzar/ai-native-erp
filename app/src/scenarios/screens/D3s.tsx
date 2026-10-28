/* D3s · Offer an alternative.
 * `D11.published`, a product is exhausted and a customer asks for it · desk · canonical
 * `substitution` — ORIGIN.
 *
 * THE ONLY SCREEN IN THE PRODUCT THAT INCREASES REVENUE. Everything else saves an hour; this one
 * turns «we have none» into a sale while the customer is still on the other end. It gets thirty
 * seconds, so the ranking has to be right before the person reads it and the words have to be
 * written before the person decides to send them.
 *
 * DRAWN WITH FISH, BECAUSE FISH IS WHERE THE RANKING IS HARDEST. In fruit the alternative is the
 * same product one grade or origin away — Mango de barco → Mango de avión — a sibling the
 * catalogue already knows. In meat it is another cut or another categoría: also catalogue-
 * adjacent. IN FISH IT IS ANOTHER SPECIES FOR THE SAME USE — Merluza → Rape, both «white fish for
 * the plancha» — and that use-class lives in a fishmonger's head and in no dimension the brief
 * writes down. D4 and D6 model identity; nothing models interchangeability. `OPEN-10`, and the
 * card carries it under the list it ranks.
 *
 * WHAT THE CARD DOES ABOUT IT, TODAY: the ranking is built from THIS CUSTOMER'S OWN HISTORY,
 * which needs no use-class and no new dimension. It is a weaker ranking than a fishmonger's and
 * it is an honest one, and the note says which is which.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Substitution, { type Alternative } from '../canonical/substitution';
import { Message } from '../../rocoto/message';
import { Composer } from '../../rocoto/composer';
import OpenChip from '../shell/OpenChip';
import RefChip from '../shell/RefChip';
import { GThread, GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import { customerOf, productOf } from '../data/cast';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'D3s',
  title: 'Offer an alternative',
  group: 'D',
  frame: 'desk',
  ifText: 'a product on today’s list is exhausted and a customer asks for it',
  dims: ['D11.published'],
  job: 'Offer this customer something else while they are still asking.',
  decides:
    'that the alternatives are ordered by what THIS customer has taken before, that each one carries its margin, and that one press writes the offer for a person to send',
  inherits: [
    { region: 'the thread this is happening in', ref: 'chat' },
    { region: 'the order the line belongs to', ref: 'A1' },
    { region: 'today’s list, which is where the shortage came from', ref: 'D2s' },
  ],
  open: [
    { region: 'the use-class that would rank fish properly', ref: 'OPEN-10' },
    { region: 'the day’s orders behind this one', ref: 'OPEN-1' },
  ],
  primitives: ['U01'],
  kit: ['Message', 'Composer', 'Figure', 'Button', 'Tag', 'Ghost'],
  canonical: 'substitution',
  delta: 'origin',
  deltaText: 'the card that IS the substitution; D4s reaches it through a collision notice',
  sector: { fish: '=', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [3, 1],
  step: 7,
  fills: [],
  reads: ['record', 'lot.qty'],
  live:
    'press an alternative and the offer writes itself into the composer, verbatim and editable; send it and the thread takes it; the ranking’s evidence rides every row',
};

/** How often this customer has taken each alternative, by rank. The ranking is the card's whole
 *  argument, so the evidence behind it is a count of their own orders and never a score. */
const TAKEN = [
  { of: 16, times: 14 },
  { of: 16, times: 9 },
  { of: 16, times: 3 },
];

const WORKING_MARGIN = 1.42;

export default function D3s() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const customer = customerOf(cast, cast.order.customer);
  const short = cast.order.lines[0];
  const wantedProduct = productOf(cast, short.product);

  const alternatives: Alternative[] = React.useMemo(
    () =>
      cast.products
        .filter((p) => p.id !== wantedProduct.id)
        .slice(0, 3)
        .map((p, i) => {
          const batch = cast.batches.find((b) => b.product === p.id);
          const line = cast.order.lines.find((l) => l.product === p.id);
          const cost = batch ? batch.cost : Math.round((cast.batches[0].cost + i * 2) * 100) / 100;
          const price = line ? line.price : Math.round(cost * WORKING_MARGIN * 100) / 100;
          const t = TAKEN[i % TAKEN.length];
          return {
            id: p.id,
            name: <Name of={p} />,
            plain: p.name,
            detail: batch ? `lote ${batch.id} · ${batch.day}` : undefined,
            evidence: `${t.times} of their last ${t.of} orders`,
            available: batch ? batch.qty : 24 + i * 9,
            unit: p.unit,
            price,
            cost,
          };
        }),
    [cast, wantedProduct.id],
  );

  const [offered, setOffered] = React.useState<string | null>(null);
  const [words, setWords] = React.useState('');
  const [sentence, setSentence] = React.useState<string | null>(null);

  React.useEffect(() => {
    setOffered(null);
    setWords('');
    setSentence(null);
  }, [cast.sector]);

  const offer = (a: Alternative) => {
    setOffered(a.id);
    /* THE WORDS ARE WRITTEN, NOT SENT. A message to a customer is theirs to approve, so the
       composer fills verbatim and the send stays a separate act. */
    setWords(
      `${wantedProduct.name} went this morning. I have ${a.available} ${a.unit} of ${a.plain} at ` +
        `${a.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/${a.unit} — shall I put ` +
        `${short.qty} ${short.unit} of it on your ${cast.order.deliveryDay}?`,
    );
  };

  return (
    <DeskChassis dossier selected={2} rows={10} height={880}>
      {/* THE FLOOR. The alternatives carry four figures and a control on one row; below this the
          row wraps a name one word per line, so the stage scrolls sideways instead. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(560px, 1fr) 220px', gap: theme.sizing.scale600, minWidth: 800 }}>
        <Substitution
          wanted={{
            name: <Name of={wantedProduct} />,
            qty: short.qty,
            unit: short.unit,
            available: 0,
          }}
          alternatives={alternatives}
          offered={offered}
          onOffer={offer}
          thread={
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
              <div style={{ ...theme.typography.LabelSmall }}>
                <Name of={customer} /> · {customer.channel} · {cast.order.placedAt}
              </div>
              <Message author="received" time={cast.order.placedAt}>
                {cast.order.words[0]}
              </Message>
            </div>
          }
          rankingNote={
            <>
              The order is this customer&rsquo;s own history, which needs no new dimension. A
              fishmonger ranks by USE — «white fish for the plancha» — and that class lives in no
              dimension the brief writes down: <OpenChip n={10} size="mini" />
            </>
          }
          composer={
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
              {sentence && (
                <Message author="sent" time="now" status="sent">
                  {sentence}
                </Message>
              )}
              <Composer
                value={words}
                onChange={setWords}
                onSend={() => {
                  if (!words.trim()) return;
                  setSentence(words);
                  setWords('');
                }}
                placeholder="Press an alternative and the words appear here."
                sendLabel="Send the offer"
              />
              {sentence && (
                <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  A yes comes back as an order line on{' '}
                  <RefChip to="A1">the order surface</RefChip>
                </p>
              )}
            </div>
          }
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
          <GThread rows={6} />
          <GRegion to="D2s" height={120} label="today’s list" />
        </div>
      </div>
    </DeskChassis>
  );
}
