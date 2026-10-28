/* A6 · Say which product was meant, once.
 *
 * `D6.item-sort` or stricter, and the message did not specify. The customer named the product and
 * left the sort unsaid, which is what a person does every morning of their life.
 *
 * POSITIVE SPACE. The one-press disambiguation AND THE EVIDENCE THAT ORDERS THE OPTIONS — «11 of
 * their last 16 orders», never a confidence score. Pressing one hides the others and stores the
 * answer.
 *
 * THE PLACE THE ONE-SCREEN RULE NEARLY FAILS, and the decision that saves it. Fish disambiguates
 * on one axis (zona × arte), meat on the lote, fruit on calibre × categoría. Three axes want a
 * matrix, and a matrix is a different screen. So THE CHIPS ANSWER THE WHOLE SKU, NEVER AN AXIS:
 * every candidate is the product the customer named, complete, at one of the sorts the catalogue
 * actually holds — «Mango de barco · calibre 12 · categoría I» — ranked by this customer's own
 * history. One axis or three, the control is unchanged: run the sector switch and watch it hold.
 *
 * A SECOND STATE IS PART OF THE CARD. When more than four candidates survive the ranking the chip
 * row becomes a Combobox CARRYING THE SAME ORDER. What decides how many survive is how much the
 * customer said, so that is the control: the fewer words, the wider the field.
 *
 * IN FISH IT WRITES THREE TIMES (C-18) — line, record AND batch — because the gear and the
 * production method are the same fact as the D12 traceability field. The condition drawn is the
 * FAMILY's profile, never the sector: a house selling merluza and media canal has two families on
 * one albarán and nothing special happens.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { OrderState } from '../canonical/order-surface';
import {
  Resolution,
  Candidates,
  rank,
  sortsOf,
  sortText,
  withSort,
  withUnplacedLine,
  type Candidate,
  type Sort,
  type Write,
} from '../canonical/resolution';
import { GThread, GCatalogue } from '../ghosts/regions';
import { batchOf, customerOf, familyOf, productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A6',
  title: 'Say which product was meant, once',
  group: 'A',
  frame: 'desk',
  ifText: 'a product must be identified by name and sort, and the message named only the product',
  dims: ['D6.item-sort', 'D6.item-sort-class', 'D3.resolve'],
  job: 'Name the catalogue entry the customer meant, and store the answer against the customer.',
  decides:
    'which complete catalogue entry a line is, ordered by what this customer has taken before — and that answering it once writes to the line, to the record, and in a fisheries family to the lote as well',
  inherits: [
    { region: "the order card's anatomy", ref: 'A1' },
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'the dossier', ref: 'J1a' },
    { region: 'the standing preference this write becomes', ref: 'J2' },
    { region: 'the batch the third write lands on', ref: 'E3' },
  ],
  open: [
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
    { region: 'the catalogue the entries come from', ref: 'OPEN-2' },
  ],
  primitives: ['U01'],
  kit: ['Tile', 'Combobox', 'Segmented Control', 'Figure', 'Message', 'Tag', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: 'the chip row and the evidence that orders it, opening in the line it answers',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1, 3, 4],
  step: 3,
  fills: ['line.sku', 'record.preference', 'lot.traceability[]'],
  reads: ['record'],
  live:
    'move the control for how much the message said and the chip row widens into a combobox carrying the same order; press an entry and the others leave, the line re-forms and the writes appear — two of them, or three where the family records fisheries data',
};

export default function A6() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [said, setSaid] = React.useState<React.Key>('entry');
  const [chosen, setChosen] = React.useState<string | null>(null);

  React.useEffect(() => {
    setChosen(null);
  }, [cast.sector, said]);

  const target = cast.order.lines[0];
  const read = productOf(cast, target.product);
  const family = familyOf(cast, read);
  const customer = customerOf(cast, cast.order.customer);
  const lot = target.lot ? batchOf(cast, target.lot) : undefined;

  /* HOW MANY SURVIVE IS A FUNCTION OF HOW MUCH WAS SAID. The candidate set is the same ranking
     either way; the control only decides where the ranking is cut. */
  const ranked = React.useMemo(
    () => rank(sortsOf(cast, read), (s) => s.id, customer.id),
    [cast, read, customer.id],
  );

  const candidates: Candidate[] = React.useMemo(
    () =>
      ranked
        .slice(0, said === 'entry' ? 3 : ranked.length)
        .map(({ item, history }) => ({ id: item.id, label: sortText(read, item), history })),
    [ranked, said, read],
  );

  const chosenSort: Sort | null = chosen ? ranked.find((r) => r.item.id === chosen)?.item ?? null : null;
  const chosenEntry = chosen ? candidates.find((c) => c.id === chosen) : undefined;

  /* before the answer the line's second row is empty, because the sort is what was left unsaid;
     after it, the row fills with the sort that was pressed — the canonical's own markup, moved by
     data alone */
  const shownCast = chosenSort ? withSort(cast, read.id, chosenSort) : withUnplacedLine(cast, target.product);
  const order = cast.order;

  /* THE WRITES. Two everywhere; three where the family carries fisheries traceability, because
     the arte that answers the order is the same arte the lote has to print (C-18). */
  const writes: Write[] | undefined = React.useMemo(() => {
    if (!chosenSort) return undefined;
    const rows: Write[] = [
      { object: 'This line', text: chosenEntry?.label, ref: 'A1' },
      {
        object: `${customer.name}'s record`,
        text: `${chosenEntry?.label}, whenever they say ${read.name} plainly`,
        ref: 'J2',
      },
    ];
    /* C-18 · THE THIRD WRITE. A fisheries family's gear and production method ARE the D12
       traceability fact, so the answer that settles the line settles the lote in the same press. */
    if (family.traceability === 'lot+fisheries' && lot) {
      rows.push({
        object: `Lote ${lot.id}`,
        text: chosenSort.facts.map((f) => `${f.label} ${f.value}`).join(' · '),
        ref: 'E3',
      });
    }
    return rows;
  }, [chosenSort, chosenEntry, customer.name, read.name, family, lot]);

  return (
    <DeskChassis dossier selected={2} rows={11} height={1020}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          {/* HOW MUCH THE MESSAGE SAID. A property of the situation, and therefore the card's
              control: it moves the row between its two states without inventing a knob. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              What the message said
            </span>
            <SegmentedControl activeKey={said} onChange={({ activeKey }) => setSaid(activeKey)}>
              <Segment key="entry" label="The product and a hint of the sort" />
              <Segment key="product" label="The product alone" />
            </SegmentedControl>
          </div>

          <OrderSurface
            cast={shownCast}
            order={order}
            state={<OrderState>{chosen ? 'Ready for you' : 'One line waiting'}</OrderState>}
            openLine={target.id}
            renderOpenLine={() => (
              <Resolution
                ask={
                  <>
                    Which entry <strong>{customer.name}</strong> meant by {read.name}.
                  </>
                }
                writes={writes}
              >
                <Candidates
                  candidates={candidates}
                  chosen={chosen}
                  onChoose={setChosen}
                  overflowAt={4}
                  ariaLabel="the catalogue entries this line could be"
                />
              </Resolution>
            )}
          />

          <GCatalogue rows={6} />
        </div>

        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
