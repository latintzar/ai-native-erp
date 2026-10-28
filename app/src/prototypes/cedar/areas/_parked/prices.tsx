import { solesRate } from '../../currency';
/* PARKED (THE-APP-V2 §1): a product's price model is a property of the product, so Prices folds into Stock. Out of the area glob; the file stays readable and still typechecks. */
/* PRICES — the C group, with the fractal at its heart. APP-B.
 *
 * ═══ THE ONE CLAIM THIS SURFACE MAKES ════════════════════════════════════════════════════════
 * «Everything is technically in pricing… everything is a tier» (THE-ALBARAN-THESIS §2), and the
 * complexity is FINITE: four levels, two axes — tiers across, chronology down. So the item list
 * here is not a list of prices. Each row IS a Price Accordion, and the row knows which of the four
 * levels its own item sits at.
 *
 * THE BLEND LAW, VISIBLE IN ONE LIST (§0, and THE-APP §"The two laws"). The questionnaire's
 * pricing answer sets the level an item's accordion OPENS at, and nothing more: the list below
 * carries MIXED LEVELS SIDE BY SIDE, because a house prices one item off an anchor and another by
 * hand. Every item therefore carries its own level switch, reachable whatever the account answered
 * — that switch is the blend law made operable, and it is the reason this area has no second UI
 * hiding behind a setting.
 *
 * WHAT ELSE STANDS HERE, and why it is the same surface:
 *   · THE MARGIN DESK — today's landed cost, and the margin that turns it into a price. Where the
 *     cost is discovered daily it leads the surface, because it is what the day's prices come off.
 *   · THE SLOT QUEUE — at level 4 the prices are set by hand each day, so the lines waiting for a
 *     number live here as well as on Today, and it is the same queue.
 *   · THE AGREEMENT and THE WATCH — the exception to the rule, made beside the rule; and the
 *     arrangement already running, watched without being touched.
 *
 * THE PUZZLE ASSEMBLES EXISTING PIECES. `price-accordion` is the instrument; `margin-desk`,
 * `agreement`, `watch` and `slot-queue` are the canonical screens groups C already draws. Nothing
 * here is a new organ — the arithmetic, the tiers and the costs all come out of `margin-desk`'s
 * own exported functions, so this surface cannot disagree with the scenarios about a number.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { Slider } from 'baseui/slider';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { PriceAccordion } from '../../../../rocoto/price-accordion';
import type { Level, PriceModel } from '../../../../rocoto/price-accordion';
import { Figure } from '../../figure';
import MarginDesk, {
  PriceResult,
  blendedCost,
  listPrice,
  priceFrom,
  tiersOf,
  todaysLandings,
} from '../../../../scenarios/canonical/margin-desk';
import Agreement, { Gap, Settled } from '../../../../scenarios/canonical/agreement';
import Watch, { arrangementOf } from '../../../../scenarios/canonical/watch';
import SlotQueue, { filledCount, type Slot, type SlotValues } from '../../../../scenarios/canonical/slot-queue';
import Name from '../../../../scenarios/shell/Name';
import { customerOf, productOf, type Cast, type Product } from '../../../../scenarios/data/cast';
import { useConfig } from '../../config';
import { Derivation } from '../../anchors';
import Page from '../../shell/page';
import type { AreaMeta } from '../../shell/area';

export const meta: AreaMeta = {
  id: 'prices',
  title: 'Prices',
  owner: 'APP-B',
};

/* ── THE SECTION ──────────────────────────────────────────────────────────────────────────────
 * A heading NAMES the thing under it, one line says what the block is for, and the derivation that
 * shaped it rides the block it shaped. Same anatomy four times, so one surface reads as one thing.
 */
function Block({
  id,
  title,
  lead,
  derivation,
  actions,
  children,
}: {
  id: string;
  title: string;
  lead?: React.ReactNode;
  derivation?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <section
      id={id}
      data-block={id}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
    >
      <header style={{ display: 'flex', gap: theme.sizing.scale600, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{title}</h2>
          {lead && (
            <p style={{ margin: `${theme.sizing.scale200} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '72ch' }}>
              {lead}
            </p>
          )}
        </div>
        {actions}
      </header>
      {derivation}
      {children}
    </section>
  );
}

/* ── THE FRACTAL, BUILT FROM THE CAST ─────────────────────────────────────────────────────────
 * One function per level, all four fed by `margin-desk`'s own arithmetic: the cost this house
 * actually paid, carried up by the list margin, stepped down by the tier. No price is typed here,
 * so the sector switch moves every number on the surface and the shapes hold still.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The last five trading days, TODAY FIRST, read off the day the cast is standing in. Level 4's
 *  vertical axis is chronology, so the days have to be the account's own days. */
function daysOf(cast: Cast): string[] {
  const [word, date = ''] = cast.order.deliveryDay.split(' ');
  const start = SHORT_DAYS.findIndex((s) => word.startsWith(s));
  const [day, month] = date.split('.');
  const number = Number(day);
  const stamp = (offset: number) => {
    const d = number - offset;
    const name = start >= 0 ? SHORT_DAYS[(start - offset + 35) % 7] : '';
    return `${name} ${String(d).padStart(2, '0')}.${month}`.trim();
  };
  return [0, 1, 2, 3, 4].map(stamp);
}

/** How a day's price sat against today's. Deterministic — a chart that redraws differently on
 *  every load cannot be read in a screenshot. */
const drift = (offset: number) => (offset === 0 ? 1 : 1 + 0.05 * Math.sin(offset * 1.7));

/** An item's price structure at a given level. The level is the ITEM's property, so this is the
 *  one function the level switch calls, and every level is reachable from every other. */
export function modelFor(cast: Cast, product: Product, level: Level): PriceModel {
  const tiers = tiersOf(cast);
  const prices = tiers.map((_, i) => listPrice(cast, product, i));
  const landed = cast.batches.find((b) => b.product === product.id);

  if (level === 1) {
    return { level: 1, price: prices[0], since: landed ? landed.day : cast.order.deliveryDay };
  }

  if (level === 2) {
    return {
      level: 2,
      tiers: tiers.map((t, i) => ({ id: t.id, name: t.name, price: prices[i] })),
    };
  }

  if (level === 3) {
    /* THE CENTRE IS THE SET'S OWN MIDDLE, so the offsets ARE the relationships the house holds
       and the spread the accordion prints is checkable against the tiers beside it. */
    const anchor = round2(prices.reduce((s, p) => s + p, 0) / prices.length);
    return {
      level: 3,
      anchor,
      anchorName: 'Centre',
      /* THE RAMP'S ENDS FRAME THE SET THE HOUSE ACTUALLY HOLDS. A house's tiers sit within a few
         points of each other, so the component's own default ends — 0.6× to 1.6× the anchor —
         bunch three stops into the middle third and leave the drag no resolution. ±12% gives the
         constellation the width of the track and still leaves room to widen it by hand. */
      min: round2(anchor * 0.88),
      max: round2(anchor * 1.12),
      stops: tiers.map((t, i) => ({
        id: t.id,
        name: t.name,
        offset: round1((prices[i] / anchor - 1) * 100),
      })),
    };
  }

  const days = daysOf(cast);
  const log = days.flatMap((day, offset) =>
    tiers.map((t, i) => ({
      id: `${day}:${t.id}:0`,
      day,
      tierId: t.id,
      price: round2(prices[i] * drift(offset)),
    })),
  );
  /* somebody changed their mind about the middle tier this morning. The entry is APPENDED, so the
     price it replaced stays readable underneath — that is the log, and the cell draws both. */
  log.push({
    id: `${days[0]}:${tiers[1].id}:1`,
    day: days[0],
    tierId: tiers[1].id,
    price: round2(prices[1] * 1.04),
  });
  return { level: 4, tiers: tiers.map((t) => ({ id: t.id, name: t.name })), days, log };
}

/** THE BLEND, DEALT. Everything opens where the answer says, and two items deliberately sit on
 *  their own level — one up, one down — because a house that priced every item the same way is a
 *  house nobody in this trade runs. This is the blend law rendered as data, not as a caption. */
export function openingLevels(cast: Cast, opensAt: Level): Record<string, PriceModel> {
  const up = Math.min(4, opensAt + 1) as Level;
  const down = Math.max(1, opensAt - 1) as Level;
  const last = cast.products.length - 1;
  return Object.fromEntries(
    cast.products.map((p, i) => [p.id, modelFor(cast, p, i === 1 ? up : i === last ? down : opensAt)]),
  );
}

const LEVEL_WORD: Record<Level, string> = {
  1: 'One price',
  2: 'Fixed tiers',
  3: 'Anchor and offsets',
  4: 'Set daily',
};

/* ── ONE ITEM ─────────────────────────────────────────────────────────────────────────────────
 * The accordion is the row. The strip under it is this surface's own chrome and the whole of the
 * blend law's operable half: FOUR LEVELS, ALWAYS REACHABLE, whatever the account answered. Change
 * one item here and the item beside it holds its own level — which is the thing the founder asked
 * to be shown rather than argued.
 */
function ItemRow({
  cast,
  product,
  price,
  onPriceChange,
  expanded,
  onExpandedChange,
}: {
  cast: Cast;
  product: Product;
  price: PriceModel;
  onPriceChange: (next: PriceModel) => void;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
}) {
  const [, theme] = useStyletron();

  return (
    <div
      data-item={product.id}
      data-level={price.level}
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      <PriceAccordion
        name={product.name}
        note={`sold by the ${product.unit}`}
        price={price}
        onPriceChange={onPriceChange}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        unit={`S/ per ${product.unit}`}
      />

      {expanded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale400,
            flexWrap: 'wrap',
            padding: `${theme.sizing.scale400} ${theme.sizing.scale600} ${theme.sizing.scale600}`,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
          }}
        >
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
            This item is priced by
          </span>
          {([1, 2, 3, 4] as Level[]).map((level) => (
            <span key={level} data-level-option={level} data-selected={price.level === level ? 'yes' : 'no'}>
              <Button
                kind={price.level === level ? KIND.primary : KIND.secondary}
                size={SIZE.mini}
                shape={SHAPE.pill}
                onClick={() => onPriceChange(modelFor(cast, product, level))}
              >
                {LEVEL_WORD[level]}
              </Button>
            </span>
          ))}
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: '18ch', flex: 1 }}>
            The level belongs to the item, so the item beside this one keeps its own.
          </span>
        </div>
      )}
    </div>
  );
}

/* ── THE MARGIN DESK ──────────────────────────────────────────────────────────────────────────
 * `D8.margin` is one sentence of arithmetic — today's cost, plus a margin, is the price — and the
 * canonical screen is that sentence with a hand on it. The product is chosen on the desk, so the
 * cost block, the disclosure and the price all belong to one item and can be checked against the
 * accordion above.
 */

const OPENING_MARGIN = 28;

function Desk({ cast, daily }: { cast: Cast; daily: boolean }) {
  const [, theme] = useStyletron();
  const [productId, setProductId] = React.useState(cast.products[0].id);
  const [margin, setMargin] = React.useState(OPENING_MARGIN);

  React.useEffect(() => {
    setProductId(cast.products[0].id);
    setMargin(OPENING_MARGIN);
  }, [cast]);

  const product = productOf(cast, productId);
  const landings = React.useMemo(() => todaysLandings(cast, product, daily), [cast, product, daily]);
  const cost = blendedCost(landings);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      <div data-testid="desk-products" style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        {cast.products.map((p) => (
          <span key={p.id} data-desk-product={p.id} data-selected={p.id === product.id ? 'yes' : 'no'}>
            <Button
              kind={p.id === product.id ? KIND.primary : KIND.secondary}
              size={SIZE.mini}
              shape={SHAPE.pill}
              onClick={() => setProductId(p.id)}
            >
              <Name of={p} />
            </Button>
          </span>
        ))}
      </div>

      <MarginDesk
        cast={cast}
        product={product}
        landings={landings}
        source={
          daily
            ? `The landings that came in at ${cast.hour} carry it.`
            : 'The agreed figure carries it, and it holds until the next revision.'
        }
        reason={
          daily
            ? `The cost landed at ${cast.hour}. The price it makes stands on every order taken from now on.`
            : 'The agreed figure holds, so this margin sets the price until somebody revises it.'
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(160px, 220px) minmax(180px, 1fr) auto',
            gap: theme.sizing.scale700,
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={theme.typography.LabelSmall}>Margin on cost</div>
            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              One margin, every customer
            </div>
          </div>
          <div style={{ minWidth: 0 }} data-testid="margin-slider">
            <Slider
              value={[margin]}
              min={0}
              max={80}
              step={1}
              onChange={({ value }) => setMargin(value[0])}
              valueToLabel={(v) => `${v}%`}
            />
          </div>
          <div data-testid="desk-price">
            <PriceResult cost={cost} margin={margin} unit={`S/ per ${product.unit}`} />
          </div>
        </div>
      </MarginDesk>
    </div>
  );
}

/* ── THE SLOT QUEUE ───────────────────────────────────────────────────────────────────────────
 * At level 4 the tiers are discretionary and set each day, so lines confirmed before the number
 * exists hold their slot open. The empty value is drawn EMPTY and never as zero — U09's whole law
 * — and this is the same queue Today carries, on the surface where the prices are made.
 */
function Queue({ cast }: { cast: Cast }) {
  const customer = customerOf(cast, cast.order.customer);

  const slots: Slot[] = React.useMemo(() => {
    const fromOrder = cast.order.lines.map((l, i) => {
      const product = productOf(cast, l.product);
      const batch = cast.batches.find((b) => b.product === product.id);
      return {
        id: l.id,
        product,
        qty: l.qty,
        unit: l.unit,
        reason: i < 2 ? ('cost-pending' as const) : ('agreed' as const),
        lastPrice: round2(l.price * 0.96),
        lastMargin: 24 + i * 3,
        cost: batch?.cost,
      };
    });
    const waiting = cast.products.slice(3, 5).map((product, i) => {
      const batch = cast.batches.find((b) => b.product === product.id);
      return {
        id: `w${i}`,
        product,
        qty: 4 + i * 2,
        unit: product.unit,
        reason: 'agreed' as const,
        lastPrice: batch ? round2(batch.cost * 1.3) : undefined,
        lastMargin: 30 - i * 2,
        cost: batch?.cost,
      };
    });
    return [...fromOrder, ...waiting];
  }, [cast]);

  const [values, setValues] = React.useState<SlotValues>({});
  const [committed, setCommitted] = React.useState(false);
  React.useEffect(() => {
    setValues({});
    setCommitted(false);
  }, [cast]);

  const filled = filledCount(slots, values);
  const complete = filled === slots.length;

  return (
    <SlotQueue
      cast={cast}
      customer={customer}
      day={cast.order.deliveryDay}
      reasons={[
        <>
          These lines are agreed with <Name of={customer} /> each time an order is placed, so a rule
          has none to give.
        </>,
        <>
          The order was confirmed at {cast.order.placedAt} and the cost landed at {cast.hour}. These
          lines held their slot open until the number existed.
        </>,
      ]}
      slots={slots}
      values={values}
      onChange={(next) => {
        setValues(next);
        setCommitted(false);
      }}
      commit={
        <Button
          kind={KIND.primary}
          size={SIZE.large}
          disabled={!complete}
          onClick={() => setCommitted(true)}
          data-testid="commit-pass"
        >
          {complete ? `Stamp ${slots.length} lines` : `${slots.length - filled} slots to go`}
        </Button>
      }
      aside={
        committed ? (
          <div data-testid="pass-closed">
            <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>
              {slots.length} lines stamped · the pass is closed
            </Tag>
          </div>
        ) : undefined
      }
    />
  );
}

/* ── THE AGREEMENT ────────────────────────────────────────────────────────────────────────────
 * One customer, one product, and a price the general rule would take a different view of. The
 * rule stays on the screen beside the exception, and the gap between them is drawn while the
 * number is typed — an exception is only legible next to the thing it is an exception to.
 */

const RULE_MARGIN = 26;

function TheAgreement({ cast }: { cast: Cast }) {
  const [, theme] = useStyletron();
  const customer = customerOf(cast, cast.order.customer);
  const product = productOf(cast, cast.order.lines[0].product);
  const landings = React.useMemo(() => todaysLandings(cast, product, true), [cast, product]);
  const cost = blendedCost(landings);
  const rulePrice = priceFrom(cost, RULE_MARGIN);

  const [typed, setTyped] = React.useState('');
  const [stored, setStored] = React.useState(false);
  React.useEffect(() => {
    setTyped('');
    setStored(false);
  }, [cast]);

  const agreed = typed === '' ? undefined : Number(typed);
  const ready = agreed !== undefined && agreed > 0;

  return (
    <Agreement
      cast={cast}
      customer={customer}
      product={product}
      rule={{
        price: rulePrice,
        how: `${customer.tier}, at ${RULE_MARGIN}% on today’s cost of ${solesRate(cost, product.unit)}`,
      }}
      reason={
        <>
          <Name of={customer} /> takes this every week, and the price is being agreed with them
          directly.
        </>
      }
      settled={stored ? <Settled>Saved. This is settled.</Settled> : undefined}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 260px) minmax(0, 1fr) auto',
          gap: theme.sizing.scale700,
          alignItems: 'end',
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={theme.typography.LabelSmall}>The price agreed with them</div>
          <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, marginBottom: theme.sizing.scale300 }}>
            Per {product.unit}, on every order from now on
          </div>
          <Input
            size={INPUT_SIZE.large}
            value={typed}
            type="number"
            inputMode="decimal"
            endEnhancer={`S/ per ${product.unit}`}
            aria-label="the agreed price"
            onChange={(e) => {
              setTyped((e.target as HTMLInputElement).value);
              setStored(false);
            }}
          />
        </div>

        <Gap rule={rulePrice} agreed={agreed} unit={`S/ per ${product.unit}`} />

        <Button
          kind={KIND.primary}
          size={SIZE.large}
          disabled={!ready}
          onClick={() => setStored(true)}
          data-testid="agree-it"
        >
          Agree it
        </Button>
      </div>

      {stored && ready && (
        <div
          data-testid="agreement-stored"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: theme.sizing.scale500,
            flexWrap: 'wrap',
            paddingTop: theme.sizing.scale400,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
          }}
        >
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            It sits on <Name of={customer} />’s record, and every order they place takes it.
          </span>
          <Figure value={agreed as number} was={rulePrice} unit={`S/ per ${product.unit}`} size="large" />
        </div>
      )}
    </Agreement>
  );
}

/* ── THE PAGE ─────────────────────────────────────────────────────────────────────────────── */

export default function Prices() {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const cast = derived.cast;
  const opensAt = derived.prices.opensAt as Level;

  /* ONE STATE HOLDS THE WHOLE LIST, keyed by item, so an item's level is an item's property and
     the surface has no second copy of a price to fall out of step with. Re-answering the pricing
     question in Settings re-deals the list under the reader — the Russian doll, on this area. */
  const [models, setModels] = React.useState<Record<string, PriceModel>>(() => openingLevels(cast, opensAt));
  const [open, setOpen] = React.useState<string | null>(null);

  React.useEffect(() => {
    setModels(openingLevels(cast, opensAt));
    setOpen(null);
  }, [cast, opensAt]);

  const levels = cast.products.map((p) => models[p.id]?.level ?? opensAt);
  const spread = levels.filter((l, i, a) => a.indexOf(l) === i).sort((a, b) => a - b);

  const items = (
    <Block
      id="items"
      title="Every item, at its own level"
      lead={
        <>
          A row opens onto the structure its item actually has: one price, fixed tiers, tiers hanging
          off an anchor, or a grid of tiers by days with the log behind it. Open a row and the four
          levels stand under it.
        </>
      }
      derivation={
        <Derivation q="pricing" align="stack">
          {derived.prices.leadLabel}, so an item opens at level {opensAt}.{' '}
          {spread.length > 1
            ? `This list holds ${spread.length} levels at once — ${spread.join(', ')} — and each item keeps its own.`
            : 'Each item keeps its own level.'}
        </Derivation>
      }
      actions={
        <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
          {cast.products.length} items
        </Tag>
      }
    >
      <div data-testid="item-list" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        {cast.products.map((product) => {
          const price = models[product.id];
          if (!price) return null;
          return (
            <ItemRow
              key={product.id}
              cast={cast}
              product={product}
              price={price}
              expanded={open === product.id}
              onExpandedChange={(next) => setOpen(next ? product.id : null)}
              onPriceChange={(next) => setModels((prev) => ({ ...prev, [product.id]: next }))}
            />
          );
        })}
      </div>
    </Block>
  );

  const desk = (
    <Block
      id="desk"
      title="Today’s cost, and the margin on it"
      lead="Cost plus a margin is the price. The cost is a lockup rather than a number: where the morning landed twice it opens onto the lotes behind it, weighted by what each one cost."
      derivation={
        <Derivation q="pricing" align="stack">
          {derived.prices.dailyLog
            ? 'Prices move every day here, so this desk stands at the head of the morning.'
            : 'Prices hold here, so this desk sets them and they stay set until somebody moves them.'}
        </Derivation>
      }
    >
      <Desk cast={cast} daily={derived.prices.dailyLog} />
    </Block>
  );

  return (
    <Page title="Prices">
      {/* THE EMPHASIS, AND ONLY THE EMPHASIS. Where the cost is discovered daily the desk is what
          the day's prices come off, so it leads; where prices hold, the list is the subject and the
          desk stands under it. Both are on the surface either way — that is the blend law. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale1000, minWidth: 0 }}>
        {derived.prices.dailyLog ? (
          <>
            {desk}
            {items}
          </>
        ) : (
          <>
            {items}
            {desk}
          </>
        )}

        {derived.prices.slotQueueOnToday && (
          <Block
            id="queue"
            title="The lines waiting for a price"
            lead="A line confirmed before the number exists keeps its slot open, and the slot is drawn empty until somebody fills it."
            derivation={
              <Derivation q="pricing" align="stack">
                Prices are set by hand each day, so this queue stands here as well as on Today. It is
                the same pass.
              </Derivation>
            }
          >
            <Queue cast={cast} />
          </Block>
        )}

        <Block
          id="agreement"
          title="Prices agreed with one customer"
          lead="What the general rule gives them stays on the screen beside what is being promised, and the gap between the two is drawn as it is typed."
        >
          <TheAgreement cast={cast} />
        </Block>

        <Block
          id="watch"
          title="The arrangement you are holding"
          lead="Quantity taken against quantity agreed, and the fixed price laid over the cost it was fixed against. This one watches; the decision it leads to lives on the customer’s own page."
        >
          <Watch cast={cast} arrangement={arrangementOf(cast)} chartWidth={560} />
        </Block>
      </div>
    </Page>
  );
}
