/* F1 · Record what actually left.
 *
 * DRAWN FOR THE MIXED MEAT ORDER, AND THAT CONDITION CARRIES THE WHOLE OF SECTORS §2. A single
 * meat order has a media canal that must be weighed and a caja de chorizo that must not, on
 * adjacent lines. A dispatch screen drawn as a whole-order weighing MODE serves fish alone and has
 * to be rebuilt for meat, so the weigh state is PER LINE: the line that weighs takes an input, and
 * the line that does not carries a plain figure and no input at all.
 *
 * THE DUAL VALUE. Ordered and sent, both kept, both shown, the ordered figure struck and never
 * replaced — because the ERP cannot obtain the real weight any other way, and because a customer
 * who ordered 20 kg and received 21.4 kg is owed both numbers.
 *
 * THE THIRD PAIRING, WITH NO NEW CONTROL. The market buys in cajas and the customer buys in kg. A
 * line that arrived as a pack carries that pair in the same lockup, one step smaller, under the
 * product's name — `1 caja → 10 kg` reads exactly like `12 kg → 11.6 kg`, because it is the same
 * component (SECTORS §2, C-5).
 *
 * FRUIT. `D13.as-ordered`: the quantity ordered is the quantity charged, so this destination is off
 * a fruit house's rail entirely and F3 carries the warehouse decision instead (C-4). The card
 * renders that absence rather than an empty list.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { Button, KIND, SIZE } from 'baseui/button';
import type { ScenarioMeta } from '../meta';
import PhoneChassis from '../chassis/phone';
import DualValue, { Absent, Pair, type DualRow } from '../canonical/dual-value';
import Name from '../shell/Name';
import RefChip from '../shell/RefChip';
import { useSector } from '../shell/context';
import { customerOf, lineFacts, productOf } from '../data/cast';

export const meta: ScenarioMeta = {
  id: 'F1',
  title: 'Record what actually left',
  group: 'F',
  frame: 'phone',
  ifText: 'the goods are weighed before dispatch, on every line or on some of them',
  dims: ['D13.weigh-some', 'D13.weigh-all'],
  job: 'Record the weight that actually left, on the lines that weigh.',
  decides:
    'that a weighed line keeps both numbers — ordered struck and sent standing, on one line, with the unit on the number’s own line — and that a line which does not weigh takes no input at all',
  inherits: [
    { region: "the morning's picking queue", ref: 'F0' },
    { region: 'the order these lines came from', ref: 'A1' },
    { region: 'the albarán the weights feed', ref: 'G1' },
    { region: 'the price the weight is charged at', ref: 'C3' },
    { region: 'the grade swap a fruit house makes instead', ref: 'F3' },
  ],
  open: [{ region: "the day's dispatch queue behind the moment", ref: 'OPEN-1' }],
  primitives: ['U10'],
  kit: ['Figure', 'Input', 'Button', 'Overlay Card', 'Ghost'],
  canonical: 'dual-value',
  delta: 'origin',
  deltaText: 'the card that IS the dual value; F3 is the same lockup holding grades',
  sector: { fish: 'Δ', meat: '=', fruit: '≠' },
  drawnWith: 'meat',
  thread: [1],
  step: 7,
  fills: ['line.sent_qty'],
  reads: ['order'],
  live:
    'type a weight on a line that weighs and the ordered figure is struck and kept beside the sent one; the lines that do not weigh hold a plain figure and no input; switch to fish and every line takes one, switch to fruit and the destination is off the rail',
};

export default function F1() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [sent, setSent] = React.useState<Record<string, string>>({});
  const [handed, setHanded] = React.useState(false);

  /* a different sector is a different order on a different bench */
  React.useEffect(() => { setSent({}); setHanded(false); }, [cast.sector]);

  const order = cast.order;
  const customer = customerOf(cast, order.customer);

  /* D13.as-ordered — the destination left the rail, and F3 does the warehouse's work */
  if (cast.sector === 'fruit') {
    return (
      <PhoneChassis behind={{ open: 1, label: "the day's dispatch" }} rows={7} placement="center" width={360} height={620}>
        <Absent
          title="The quantity ordered is the quantity charged"
          because="A fruit house works to the order: what the sheet says is what leaves, and what leaves is what the albarán carries. The warehouse's decision here is the grade a line leaves at."
          instead={{ ref: 'F3', region: 'the grade swap' }}
        />
      </PhoneChassis>
    );
  }

  const weighed = order.lines.filter((l) => productOf(cast, l.product).variableWeight);
  const done = weighed.filter((l) => sent[l.id] !== undefined && sent[l.id] !== '').length;

  const rows: DualRow[] = order.lines.map((line) => {
    const product = productOf(cast, line.product);
    const facts = lineFacts(cast, product);
    const weighs = product.variableWeight;
    const typed = sent[line.id];
    const value = typed === undefined || typed === '' ? undefined : Number(typed.replace(',', '.'));
    const captured = value !== undefined && Number.isFinite(value);

    return {
      id: line.id,
      title: <Name of={product} />,
      facts: (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
          {/* THE THIRD PAIRING. Where the line arrived as a pack, the pack and the catalogue's own
              unit ride the same lockup, one step smaller. No new control appears. */}
          {line.wasQty !== undefined && product.pack && (
            <Pair
              from={{ value: line.wasQty, unit: product.pack.unit }}
              to={{ value: line.qty, unit: line.unit, decimals: line.unit === 'kg' ? 1 : 0 }}
              size="compact"
            />
          )}
          <span>{facts.map((f) => `${f.label} ${f.value}`).join(' · ')}</span>
        </span>
      ),
      from: { value: line.qty, unit: line.unit, decimals: line.unit === 'kg' ? 1 : 0 },
      to: captured ? { value: value as number, unit: product.unit, decimals: 1 } : undefined,
      control: weighs ? (
        <Input
          size={INPUT_SIZE.compact}
          value={typed ?? ''}
          type="number"
          step={0.1}
          onChange={(e) => setSent((s) => ({ ...s, [line.id]: (e.target as HTMLInputElement).value }))}
          placeholder="On the scale"
          endEnhancer={product.unit}
          aria-label={`what left, in ${product.unit}`}
        />
      ) : undefined,
    };
  });

  return (
    <PhoneChassis behind={{ open: 1, label: "the day's dispatch" }} rows={7} placement="bottom" width={320} height={700}>
      <DualValue
        heading="Dispatch"
        standfirst={
          <>
            <Name of={customer} /> · {order.deliveryDay}
          </>
        }
        pair={{ from: 'ordered', to: 'sent' }}
        rows={rows}
        foot={
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {done} of {weighed.length} weighed. The rest leave at the quantity on the sheet.
          </p>
        }
        action={
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              disabled={done < weighed.length}
              onClick={() => setHanded(true)}
            >
              {handed ? 'On the albarán' : 'Hand to the albarán'}
            </Button>
            {handed && (
              <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                Both numbers travel: <RefChip to="G1">the albarán</RefChip>
              </span>
            )}
          </div>
        }
      />
    </PhoneChassis>
  );
}
