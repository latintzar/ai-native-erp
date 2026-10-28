/* A10 · A line carrying the customer's own words.
 *
 * `D4.sku-plus-note`. Somebody wrote a sentence on the end of an order and a person has to read it.
 *
 * POSITIVE SPACE. How free text rides a line WITHOUT BEING MISTAKEN FOR DATA: verbatim, attributed
 * to the customer, visibly not a field — no label, no box, no place a machine could have put it —
 * and surviving onto the picking sheet, which is the only reason it was written.
 *
 * THIS CARD BREAKS BRIEF §2 RULE 1, and says so. In fruit the note is inert: «el aguacate bien
 * maduro» changes what a picker chooses off the pallet and nothing else. In fish and meat the same
 * slot carries a PREPARATION — cleaned, headless, filleted, sliced thin — and a preparation
 * changes the weight that leaves by a third or more, which is a second job on one line.
 *
 * RESOLVED (C-12): a preparation is `D4.sku-plus-type` — a NAMED FIELD with a stored yield ratio
 * per product × preparation, feeding F1. The free-text note stays inert in every sector. A10 keeps
 * one job, the weight consequence moves into machinery D5 and F1 already require, and rule 1 gains
 * one documented exception.
 *
 * The two states are the card's control, because the account is in one or the other and a founder
 * should be able to see both in one sitting. Where the family has no preparations — fruit — the
 * second state is absent rather than empty, which is the sector delta drawn honestly.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { OrderState } from '../canonical/order-surface';
import { Candidates, preparationsFor, rank, type Candidate } from '../canonical/resolution';
import { Figure } from '../../rocoto/figure';
import RefChip from '../shell/RefChip';
import { GThread, GRegion } from '../ghosts/regions';
import { customerOf, familyOf, productOf } from '../data/cast';
import Name from '../shell/Name';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A10',
  title: "A line carrying the customer's own words",
  group: 'A',
  frame: 'desk',
  ifText: 'a customer may put free text on a line, and this one did',
  dims: ['D4.sku-plus-note', 'D4.sku-plus-type'],
  job: "Carry the customer's sentence on the line it belongs to, all the way to the picking sheet.",
  decides:
    'how free text rides a line without being read as data — verbatim, attributed, visibly not a field — and where a preparation stops being a note and becomes a named field with a yield',
  inherits: [
    { region: "the order card's anatomy", ref: 'A1' },
    { region: 'the rail', ref: 'K' },
    { region: 'the thread the words arrived on', ref: 'chat' },
    { region: 'the dossier', ref: 'J1a' },
    { region: 'the picking sheet the note survives onto', ref: 'F0' },
    { region: 'the weight the preparation produces', ref: 'F1' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: [],
  kit: ['Segmented Control', 'Tile', 'Figure', 'Message', 'Ghost'],
  canonical: 'order-surface',
  delta: 'data',
  deltaText:
    'the note rides the line as data rather than as a control — and where the family has preparations it becomes a named field with a yield (C-12, the documented exception to rule 1)',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1],
  step: 3,
  fills: ['line.note', 'line.preparation'],
  reads: ['record'],
  live:
    'move between the inert note and the named preparation and watch the weight that leaves change with the yield; move the second control and the same words appear on the picking sheet row',
};

export default function A10() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [mode, setMode] = React.useState<React.Key>('note');
  const [where, setWhere] = React.useState<React.Key>('order');
  const [prep, setPrep] = React.useState<string | null>(null);

  const customer = customerOf(cast, cast.order.customer);

  /* THE NOTE AND THE LINE IT BELONGS TO, both read out of the cast: the customer's second message
     is the note, and the line it rides is the one whose product they named in it. */
  const note = cast.order.words[cast.order.words.length - 1];
  const target = React.useMemo(() => {
    const line =
      cast.order.lines.find((l) => {
        const first = productOf(cast, l.product).name.split(' ')[0].toLowerCase();
        return note.toLowerCase().includes(first);
      }) ?? cast.order.lines[0];
    return { line, product: productOf(cast, line.product) };
  }, [cast, note]);

  const { line, product } = target;
  const family = familyOf(cast, product);
  const preparations = preparationsFor(family);
  const hasPreparations = preparations.length > 0;

  React.useEffect(() => {
    setMode('note');
    setWhere('order');
    setPrep(null);
  }, [cast.sector]);

  const candidates: Candidate[] = React.useMemo(
    () =>
      rank(preparations, (p) => p.id, customer.id).map(({ item, history }) => ({
        id: item.id,
        label: item.name,
        history,
        detail: `${Math.round(item.yield * 100)} ${product.unit} leaves for every 100 ordered`,
      })),
    [preparations, customer.id, product.unit],
  );

  const chosenPrep = prep ? preparations.find((p) => p.id === prep) ?? null : null;
  const leaves = chosenPrep ? Math.round(line.qty * chosenPrep.yield * 10) / 10 : null;

  /* the words themselves, riding the line. No label, no box, no field: a quotation mark, the
     customer's name, and the sentence they wrote. */
  const Quotation = () => (
    <blockquote
      style={{
        margin: 0,
        paddingLeft: theme.sizing.scale500,
        borderLeft: `2px solid ${theme.colors.borderOpaque}`,
        ...theme.typography.ParagraphSmall,
      }}
    >
      &laquo;{note}&raquo;
      <footer style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, marginTop: theme.sizing.scale100 }}>
        {customer.name}, {cast.order.placedAt}
      </footer>
    </blockquote>
  );

  return (
    <DeskChassis dossier selected={2} rows={11} height={1060}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          {/* WHAT THE SLOT IS IN THIS ACCOUNT. Where the family keeps preparations there are two
              answers; where it does not, there is one, and the control is shorter. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              What the slot holds in {family.name}
            </span>
            {hasPreparations ? (
              <SegmentedControl activeKey={mode} onChange={({ activeKey }) => setMode(activeKey)}>
                <Segment key="note" label="Words a person reads" description="D4.sku-plus-note" />
                <Segment key="type" label="A preparation, with its yield" description="D4.sku-plus-type" />
              </SegmentedControl>
            ) : (
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                The slot carries the customer&rsquo;s own words, and the weight that leaves is the
                weight that was ordered.
              </p>
            )}
          </div>

          <OrderSurface
            cast={cast}
            order={cast.order}
            state={<OrderState>Waiting on you</OrderState>}
            openLine={line.id}
            renderOpenLine={() => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, paddingTop: theme.sizing.scale400 }}>
                <Quotation />

                {hasPreparations && mode === 'type' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
                    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Preparation
                    </span>
                    <Candidates
                      candidates={candidates}
                      chosen={prep}
                      onChoose={setPrep}
                      settledText={`On the line, and on ${product.name} whenever ${customer.name} says it again.`}
                      ariaLabel="the preparations this family holds"
                    >
                      {chosenPrep && leaves !== null && (
                        <div style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Figure value={leaves} was={line.qty} unit={product.unit} decimals={1} size="large" />
                          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                            {chosenPrep.name} leaves {Math.round(chosenPrep.yield * 100)} of every
                            100 {product.unit}.
                          </span>
                          <RefChip to="F1" size="mini">
                            what the scale records
                          </RefChip>
                        </div>
                      )}
                    </Candidates>
                  </div>
                )}
              </div>
            )}
          />

          {/* ── WHERE THE WORDS GO NEXT. A note nobody in the warehouse reads is decoration. ── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
            <SegmentedControl activeKey={where} onChange={({ activeKey }) => setWhere(activeKey)}>
              <Segment key="order" label="On the order" />
              <Segment key="sheet" label="On the picking sheet" />
            </SegmentedControl>

            {where === 'sheet' && (
              <div
                style={{
                  border: `1px solid ${theme.colors.borderOpaque}`,
                  borderRadius: theme.borders.radius300,
                  padding: theme.sizing.scale500,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.sizing.scale400,
                  background: theme.colors.backgroundPrimary,
                }}
              >
                <GRegion to="F0" shape="line" height={theme.sizing.scale800} label="the sheet's head" />

                {/* the one row that is this card's business, at full fidelity */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: theme.sizing.scale500,
                    alignItems: 'baseline',
                    borderTop: `1px solid ${theme.colors.borderOpaque}`,
                    borderBottom: `1px solid ${theme.colors.borderOpaque}`,
                    padding: `${theme.sizing.scale400} 0`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={theme.typography.LabelMedium}>
                      <Name of={product} /> &middot; {customer.name}
                    </div>
                    <div style={{ marginTop: theme.sizing.scale200 }}>
                      <Quotation />
                    </div>
                    {chosenPrep && mode === 'type' && (
                      <div style={{ ...theme.typography.LabelSmall, marginTop: theme.sizing.scale200 }}>
                        {chosenPrep.name}
                      </div>
                    )}
                  </div>
                  <Figure
                    value={chosenPrep && leaves !== null && mode === 'type' ? leaves : line.qty}
                    unit={line.unit}
                    decimals={line.unit === 'kg' ? 1 : 0}
                    size="default"
                  />
                </div>

                <GRegion to="F0" shape="block" height={120} label="the rest of the day's picking" />
              </div>
            )}
          </section>
        </div>

        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
