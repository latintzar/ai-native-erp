/* F3 · Goods held at one grade, sent as another.
 *
 * THE CATALOGUE'S BEST UNIFICATION. F1's pair — ordered → sent — and F3's pair — grade held →
 * grade sold — are THE SAME LOCKUP ON THE SAME SCREEN, and which pair appears is the sector.
 * Fish and meat open F1; fruit opens F3; neither is a different product (C-4).
 *
 * WHY FRUIT IS THE HOME. `D13.as-ordered` means the quantity that leaves is the quantity ordered,
 * so a fruit warehouse's whole decision is the CLASS a line leaves at. A pallet held at categoría
 * II going out as categoría I is the ordinary destrío decision, made a dozen times a morning, and
 * it is where a fruit house's margin is actually won.
 *
 * THE MARGIN MOVES AS YOU PRESS, because cost and price are both on the line. The cost is the
 * lote's own, captured at intake. The price is the customer's, agreed on the order.
 *
 * THE ASSUMPTION THIS CARD STATES. A line leaving at the class it is held at clears at what it
 * cost; the class ladder's own prices live on the price list (→C1). One founder sentence replaces
 * that with a real ladder and changes one function in this file. It is stated on the screen rather
 * than buried, for the same reason C5 states its own (BUILD-PLAN §3.2).
 *
 * A FLAG ON THE FRAME. This screen puts cost and margin on a warehouse phone. Who may see cost is
 * a role decision nobody has made, and it touches F1 (quantities only) and C6 (cost at the desk).
 * `OPEN-11`.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { ButtonGroup, MODE } from 'baseui/button-group';
import { Button, SIZE } from 'baseui/button';
import type { ScenarioMeta } from '../meta';
import PhoneChassis from '../chassis/phone';
import DualValue, { Absent, type DualRow } from '../canonical/dual-value';
import { Figure } from '../../rocoto/figure';
import Name from '../shell/Name';
import RefChip from '../shell/RefChip';
import { useSector } from '../shell/context';
import type { Cast } from '../data/cast';
import { batchOf, customerOf, familyOf, productOf } from '../data/cast';

export const meta: ScenarioMeta = {
  id: 'F3',
  title: 'Goods held at one grade, sent as another',
  group: 'F',
  frame: 'phone',
  ifText: 'goods held at one grade are sent as another',
  dims: ['D13.as-ordered', 'D13.weigh-some', 'D13.weigh-all'],
  job: 'Record the grade a line leaves at, with the grade it was held at kept beside it.',
  decides:
    'which grade a line leaves at — both grades kept on one line, with the cost and the price beside them so the margin consequence is legible at the moment of the decision',
  inherits: [
    { region: 'the order these lines came from', ref: 'A1' },
    { region: 'the lote the goods are held in', ref: 'E3' },
    { region: 'the albarán the grade sold prints on', ref: 'G1' },
    { region: "the price list the class ladder's prices live on", ref: 'C1' },
    { region: 'the weighing a fish or meat house does instead', ref: 'F1' },
  ],
  open: [
    { region: 'who may see cost on a warehouse phone', ref: 'OPEN-11' },
    { region: "the day's dispatch queue behind the moment", ref: 'OPEN-1' },
  ],
  primitives: ['U10', 'U01'],
  kit: ['Figure', 'Button Group', 'Overlay Card', 'Ghost'],
  canonical: 'dual-value',
  delta: 'data',
  deltaText: 'the pair holds grades instead of quantities — held → sold',
  sector: { fish: '≠', meat: '≠', fruit: '=' },
  drawnWith: 'fruit',
  thread: [1],
  step: 7,
  fills: ['line.grade_sold'],
  reads: ['cost', 'price'],
  live:
    'press a class and the pair changes while the margin moves with it, because the lote’s cost and the customer’s price are both on the line; the sector switch hands fish and meat back to F1',
};

/* ── THE CLASS LADDER, read from the family ───────────────────────────────────────────────────
 * The family says which of its fields is a class; the catalogue says which classes exist. Where a
 * family records none, there is no grade to lift and the screen belongs to F1. */

const CLASS_FIELDS = ['categoría', 'calibre'];

const classFieldOf = (cast: Cast): string | undefined => {
  const family = familyOf(cast, cast.products[0]);
  return CLASS_FIELDS.find((f) => family.recordFields.includes(f));
};

/** every class the catalogue records, best first */
const ladderOf = (cast: Cast, field: string): string[] =>
  Array.from(new Set(cast.products.map((p) => p.trace[field]).filter(Boolean))).sort();

export default function F3() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const field = classFieldOf(cast);
  const ladder = field ? ladderOf(cast, field) : [];
  /* the class the goods sit at on the shelf: the lowest the catalogue records */
  const held = ladder[ladder.length - 1];

  const [sold, setSold] = React.useState<Record<string, string>>({});
  React.useEffect(() => { setSold({}); }, [cast.sector]);

  /* pescado and carne record a lote and an origin chain and no class, so there is no grade to
     lift and the warehouse's decision is the scale — F1's screen */
  if (!field || ladder.length < 2) {
    return (
      <PhoneChassis behind={{ open: 1, label: "the day's dispatch" }} rows={7} placement="center" width={360} height={620}>
        <Absent
          title="Every line leaves at the class it was bought at"
          because="This family travels on a lote, an origin chain and a weight. The warehouse's decision here is what the scale says."
          instead={{ ref: 'F1', region: 'the weighing' }}
        />
      </PhoneChassis>
    );
  }

  const order = cast.order;
  const customer = customerOf(cast, order.customer);

  const rows: DualRow[] = order.lines.map((line) => {
    const product = productOf(cast, line.product);
    const ordered = product.trace[field];
    const leaving = sold[line.id] ?? held;
    const cost = (line.lot ? batchOf(cast, line.lot)?.cost : undefined) ?? 0;
    /* THE STATED ASSUMPTION: a line leaving at the class it is held at clears at what it cost */
    const price = leaving === ordered ? line.price : cost;
    const margin = price === 0 ? 0 : ((price - cost) / price) * 100;

    return {
      id: line.id,
      title: <Name of={product} />,
      facts: (
        <>
          {order.deliveryDay} · {line.qty} {line.unit} · ordered {field} {ordered}
        </>
      ),
      from: { value: `${field} ${held}` },
      to: leaving === held ? undefined : { value: `${field} ${leaving}` },
      control: (
        <ButtonGroup
          mode={MODE.radio}
          size={SIZE.mini}
          selected={ladder.indexOf(leaving)}
          onClick={(_, index) => setSold((s) => ({ ...s, [line.id]: ladder[index] }))}
        >
          {ladder.map((c) => (
            <Button key={c}>
              {field} {c}
            </Button>
          ))}
        </ButtonGroup>
      ),
      consequence: (
        <div style={{ display: 'flex', gap: theme.sizing.scale600, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Money label="Cost">
            <Figure value={cost} unit={`€/${product.unit}`} size="compact" />
          </Money>
          <Money label="Sold at">
            <Figure value={price} unit={`€/${product.unit}`} size="compact" />
          </Money>
          <Money label="Margin">
            <Figure value={margin} unit="%" decimals={1} size="default" />
          </Money>
        </div>
      ),
    };
  });

  const lifted = order.lines.filter((l) => (sold[l.id] ?? held) !== held).length;

  return (
    <PhoneChassis behind={{ open: 1, label: "the day's dispatch" }} rows={7} placement="bottom" width={320} height={820}>
      <DualValue
        heading="Dispatch"
        standfirst={
          <>
            <Name of={customer} /> · {order.deliveryDay}
          </>
        }
        pair={{ from: 'grade held', to: 'grade sold' }}
        rows={rows}
        foot={
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
            <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              {lifted} of {order.lines.length} lifted. A line leaving at the class it is held at
              clears at what it cost.
            </p>
            <div>
              <RefChip to="C1">the class ladder&rsquo;s prices</RefChip>
            </div>
          </div>
        }
      />
    </PhoneChassis>
  );
}

/** A label above a figure. The label names the number; the unit stays on the number's own line. */
function Money({ label, children }: { label: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <span style={{ whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}
